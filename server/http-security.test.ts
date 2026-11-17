import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import { connect } from "node:net";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBuild } from "../scripts/wiki/build";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { handleAnswers } from "./answers";
import { handleChat } from "./chat-route";
import { handleDrop } from "./drop";
import { handlePages } from "./pages";
import { handleRawSource } from "./raw";
import { handleReview } from "./review";
import { handleStatus } from "./status";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const f of fixtures.splice(0)) f.cleanup();
});

function createPreparedFixture() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  const raw = saveRawSnapshot(join(f.root, "wiki"), "第一行原文\n第二行原文\n");
  const rawRef = `raw:${raw.slice(4)}#L1-L2`;
  f.write(
    "wiki/sources/a.md",
    `---\nid: a\ntitle: A\ntype: source\nsummary: 示例\nsources: [${rawRef}]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n示例内容。\n`,
  );
  runBuild(f.root);
  return { ...f, rawRef };
}

async function listen(
  handler: (req: IncomingMessage, res: import("node:http").ServerResponse) => Promise<void> | void,
) {
  const server = createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!res.headersSent)
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8", connection: "close" });
      res.end(String(err));
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("missing server address");
  return addr.port;
}

function sendRawHttp(port: number, rawRequest: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(rawRequest);
    });
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(out || "TIMEOUT");
    });
    let out = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      out += chunk;
    });
    socket.on("end", () => resolve(out));
    socket.on("error", reject);
  });
}

describe("HTTP 畸形 URL 与非 origin-form 请求防御", () => {
  const malformedTargets = [
    "//%",
    "http://%",
    "//evil.example/api/wiki/pages",
    "//evil.example/api/wiki/raw",
  ];

  it("所有路由处理器面对畸形或非 origin-form URL 时返回 400 且不抛异常", async () => {
    const f = createPreparedFixture();
    const handlers: Array<{
      name: string;
      run: (req: IncomingMessage, res: import("node:http").ServerResponse) => Promise<boolean> | boolean;
    }> = [
      { name: "drop", run: (req, res) => handleDrop(req, res, f.root) },
      { name: "raw", run: (req, res) => handleRawSource(req, res, join(f.root, "wiki")) },
      { name: "review", run: (req, res) => handleReview(req, res, f.root) },
      { name: "answers", run: (req, res) => handleAnswers(req, res, f.root) },
      { name: "pages", run: (req, res) => handlePages(req, res, f.root) },
      { name: "status", run: (req, res) => handleStatus(req, res, f.root) },
      { name: "chat", run: (req, res) => handleChat(req, res, f.root) },
    ];

    for (const entry of handlers) {
      const port = await listen(async (req, res) => {
        const handled = await entry.run(req, res);
        if (!handled && !res.writableEnded) {
          res.writeHead(404);
          res.end();
        }
      });
      for (const target of malformedTargets) {
        const raw = await sendRawHttp(
          port,
          `GET ${target} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`,
        );
        expect(raw, `${entry.name} target=${target}`).toMatch(/^HTTP\/1\.1 400 /);
      }
    }
  });

  it("真实统一入口 createWikiServer 拦截 GET //% 与 GET //evil.example/... 后服务仍健康响应", async () => {
    const f = createPreparedFixture();
    const appPath = "./app";
    const appModule = (await import(appPath).catch(() => null)) as {
      createWikiServer?: (root: string) => Server;
    } | null;
    expect(appModule?.createWikiServer).toBeTypeOf("function");
    const server = appModule!.createWikiServer!(f.root);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("missing port");

    for (const bad of ["//%", "//evil.example/api/wiki/health"]) {
      const res = await sendRawHttp(
        addr.port,
        `GET ${bad} HTTP/1.1\r\nHost: 127.0.0.1:${addr.port}\r\nConnection: close\r\n\r\n`,
      );
      expect(res, `bad=${bad}`).toMatch(/^HTTP\/1\.1 400 /);
    }

    const health = await fetch(`http://127.0.0.1:${addr.port}/api/wiki/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, pages: 1 });
  });
});

describe("敏感只读接口本机 Host 与跨站读取防护", () => {
  it("拒绝非回环 Host（DNS rebinding）与 cross-site 读取，保留本机正常访问", async () => {
    const f = createPreparedFixture();
    const port = await listen(async (req, res) => {
      if (await handleDrop(req, res, f.root)) return;
      if (handleRawSource(req, res, join(f.root, "wiki"))) return;
      if (await handleReview(req, res, f.root)) return;
      if (await handleStatus(req, res, f.root)) return;
      res.writeHead(404);
      res.end();
    });

    const paths = [
      "/api/wiki/drops",
      `/api/wiki/raw?ref=${encodeURIComponent(f.rawRef)}`,
      "/api/wiki/reviews",
      "/api/wiki/status",
    ];

    for (const path of paths) {
      const rebind = await sendRawHttp(
        port,
        `GET ${path} HTTP/1.1\r\nHost: attacker.example:${port}\r\nConnection: close\r\n\r\n`,
      );
      expect(rebind, `rebind ${path}`).toMatch(/^HTTP\/1\.1 403 /);

      const crossSite = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { "sec-fetch-site": "cross-site" },
      });
      expect(crossSite.status, `cross-site ${path}`).toBe(403);

      const crossOrigin = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { origin: "https://evil.example" },
      });
      expect(crossOrigin.status, `cross-origin ${path}`).toBe(403);

      const ok = await fetch(`http://127.0.0.1:${port}${path}`);
      expect(ok.status, `loopback ${path}`).toBe(200);
    }
  });
});

describe("超大流式请求体 413 收尾防护", () => {
  it("未结束的超大上传在返回 413 后立即暂停并关闭底层连接，不挂起半开流", async () => {
    const f = createPreparedFixture();
    let serverReq: IncomingMessage | undefined;
    const port = await listen(async (req, res) => {
      serverReq = req;
      await handleReview(req, res, f.root);
    });

    const result = await new Promise<{ statusCode: number; closed: boolean }>((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port,
          method: "POST",
          path: `/api/wiki/reviews/${"a".repeat(64)}/approve`,
          headers: {
            "content-type": "application/json",
            "x-wiki-review": "1",
            "transfer-encoding": "chunked",
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => {
            const timer = setTimeout(() => {
              req.destroy();
              resolve({ statusCode: res.statusCode ?? 0, closed: false });
            }, 600);
            req.socket?.once("close", () => {
              clearTimeout(timer);
              resolve({ statusCode: res.statusCode ?? 0, closed: true });
            });
            if (req.socket?.destroyed) {
              clearTimeout(timer);
              resolve({ statusCode: res.statusCode ?? 0, closed: true });
            }
          });
        },
      );
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") reject(err);
      });
      // 只写超过 16KB 的首块，故意不调用 req.end()，模拟半开超大上传
      req.write(`{"junk":"${"x".repeat(24_000)}"`);
    });

    expect(result.statusCode).toBe(413);
    expect(serverReq?.isPaused() || serverReq?.destroyed).toBe(true);
    expect(result.closed).toBe(true);
  });
});
