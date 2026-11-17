import type { IncomingMessage, ServerResponse } from "node:http";

export const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function send(res: ServerResponse, status: number, value: unknown): void {
  const dropUpload = status === 413 || (!res.req.complete && status >= 400);
  if (dropUpload) {
    res.shouldKeepAlive = false;
    res.req.pause();
  }
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...(dropUpload ? { connection: "close" } : {}),
  });
  res.end(JSON.stringify(value), () => {
    if (dropUpload) {
      res.socket?.end();
      const timer = setTimeout(() => {
        if (!res.req.destroyed) res.req.destroy();
      }, 80);
      timer.unref();
    }
  });
}

function hasUnsafeUrlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/** Only accept HTTP/1.1 origin-form request targets (/path?query); reject malformed or authority targets. */
export function parseWikiUrl(req: IncomingMessage, res: ServerResponse): URL | null {
  const raw = req.url ?? "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || hasUnsafeUrlChar(raw)) {
    send(res, 400, { error: "无效的请求路径" });
    return null;
  }
  try {
    const url = new URL(raw, "http://localhost");
    if (url.origin !== "http://localhost") {
      send(res, 400, { error: "无效的请求路径" });
      return null;
    }
    return url;
  } catch {
    send(res, 400, { error: "无效的请求路径" });
    return null;
  }
}

/** Local read guard for sensitive workflow/raw/status endpoints against DNS rebinding and cross-site reads. */
export function checkLocalReader(req: IncomingMessage): void {
  const host = req.headers.host;
  if (!host || !LOOPBACK_HOST.test(host)) throw new HttpError(403, "只接受本机读取请求");
  const origin = req.headers.origin;
  if ((origin && origin !== `http://${host}`) || req.headers["sec-fetch-site"] === "cross-site")
    throw new HttpError(403, "只接受同源本机读取请求");
}

/** Local single-user mutation route. A browser cannot submit a simple cross-site approval. */
export function checkWriter(req: IncomingMessage): void {
  const host = req.headers.host;
  if (!host || !LOOPBACK_HOST.test(host)) throw new HttpError(403, "只接受本机审阅请求");
  const origin = req.headers.origin;
  if (
    (origin && origin !== `http://${host}`) ||
    req.headers["sec-fetch-site"] === "cross-site" ||
    req.headers["x-wiki-review"] !== "1"
  )
    throw new HttpError(403, "审阅写入需要同源请求和 x-wiki-review: 1");
  if (req.headers["content-type"]?.split(";")[0]?.trim() !== "application/json")
    throw new HttpError(415, "需要 application/json");
}

export function readJson(req: IncomingMessage, maxBytes = 16_384): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    const fail = (error: Error) => {
      if (!failed) {
        failed = true;
        chunks.length = 0;
        reject(error);
      }
    };
    const onData = (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        req.pause();
        req.removeListener("data", onData);
        fail(new HttpError(413, "请求体过大"));
        return;
      }
      chunks.push(chunk);
    };
    req.on("data", onData);
    req.on("end", () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        fail(new HttpError(400, "请求体不是合法 JSON"));
      }
    });
    req.on("error", fail);
    req.on("aborted", () => fail(new HttpError(400, "请求已中断")));
  });
}
