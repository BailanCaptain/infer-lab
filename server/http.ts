import type { IncomingMessage, ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

/** Local single-user mutation route. A browser cannot submit a simple cross-site approval. */
export function checkWriter(req: IncomingMessage): void {
  const host = req.headers.host;
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    throw new HttpError(403, "只接受本机审阅请求");
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
    req.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        fail(new HttpError(413, "请求体过大"));
        return;
      }
      chunks.push(chunk);
    });
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
