/**
 * 知识库问答的薄运行器。node:http，无框架。
 *
 * 路由：
 *   GET  /api/wiki/health  → { ok, pages }
 *   POST /api/wiki/chat    → SSE：tool / text / cite / done
 *
 * 只做三件事：调 AC10 的 retrieve() 预检索、spawn 一次 claude -p、把
 * stream-json 转成 SSE。任何知识判断都在 agent 与 HANDBOOK 里，不写在这。
 *
 * 起法：pnpm dev:server（或 pnpm dev 一起起）。前端经 vite proxy 打过来。
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadHandbook } from "../scripts/wiki/handbook";
import { buildChatRequest, type ChatHit, runChat, sseFrame } from "./chat";
import { neighborhood } from "../src/content/wiki/relations";
import type { Backlink, Relation } from "../src/content/wiki/schema";

const PORT = Number(process.env.WIKI_SERVER_PORT ?? 8790);
const ROOT = resolve(process.cwd());
const WIKI_ROOT = join(ROOT, "wiki");

const handbook = loadHandbook(WIKI_ROOT);

/** registry 与正文用于预检索。server 与前端共用 retrieve 的实现。 */
const registry = JSON.parse(readFileSync(join(ROOT, "src/content/wiki/registry.json"), "utf8")) as {
  pages: {
    id: string;
    title: string;
    aliases: string[];
    summary: string;
    chapters: string[];
    evidence: string;
    file: string;
    relations: Relation[];
    backlinks: Backlink[];
  }[];
};

const { buildIndex, retrieve } = await import("../src/content/wiki/retrieve");
const index = buildIndex(
  registry.pages.map((p) => ({
    id: p.id,
    title: p.title,
    aliases: p.aliases,
    summary: p.summary,
    chapters: p.chapters,
    evidence: p.evidence,
    text: safeRead(join(WIKI_ROOT, p.file)),
  })),
);

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const readBody = (req: import("node:http").IncomingMessage): Promise<string> =>
  new Promise((res, rej) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 100_000) rej(new Error("请求体过大"));
    });
    req.on("end", () => res(body));
    req.on("error", rej);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/wiki/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, pages: registry.pages.length }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/wiki/chat") {
    let input: { message?: string; sessionId?: string };
    try {
      input = JSON.parse(await readBody(req)) as typeof input;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "请求体不是合法 JSON" }));
      return;
    }
    const message = (input.message ?? "").trim();
    if (!message) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "message 不能为空" }));
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    // AC10：检索只经这一个入口，server 不自己 grep
    const hits = retrieve(message, index, { limit: 5 }) as ChatHit[];
    res.write(sseFrame("hits", { hits }));

    // 沿图回答（2026-09-11）：把命中页的地基 / 下游 / 同层一并交给 agent，
    // 否则它读一页就以为读完了——那正是「串不起来」的直接原因。
    const graph = hits.slice(0, 2).flatMap((h) => {
      const page = registry.pages.find((p) => p.id === h.id);
      if (!page) return [];
      return [{ id: page.id, title: page.title, neighborhood: neighborhood(page.relations, page.backlinks) }];
    });

    const chatReq = buildChatRequest(
      { message, ...(input.sessionId ? { sessionId: input.sessionId } : {}), hits, graph },
      { pageFormat: handbook.pageFormat, query: handbook.query },
      { wikiRoot: WIKI_ROOT, indexMd: safeRead(join(WIKI_ROOT, "index.md")), timeoutMs: 5 * 60_000 },
    );

    let answer = "";
    let sessionId: string | undefined;
    try {
      const result = await runChat(chatReq, {
        text: (text) => {
          answer += text;
          res.write(sseFrame("text", { text }));
        },
        tool: (name, target) => res.write(sseFrame("tool", { name, target })),
      });
      sessionId = result.sessionId;
      if (!result.ok) res.write(sseFrame("error", { message: result.reason ?? "agent 失败" }));
    } catch (err) {
      res.write(sseFrame("error", { message: String(err) }));
    }

    // AC7：断言却没引用任何页时明说，不让它伪装成知识库结论
    const { citationCheck } = await import("../src/content/wiki/retrieve");
    const verdict = citationCheck(answer);
    res.write(sseFrame("cite", verdict));
    res.write(sseFrame("done", { sessionId }));
    res.end();
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "no such route" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`wiki server → http://127.0.0.1:${PORT}（${registry.pages.length} 页）`);
});
