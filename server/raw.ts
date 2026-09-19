import type { IncomingMessage, ServerResponse } from "node:http";
import { sourceLines } from "../scripts/wiki/audit";
import { readRawSnapshot } from "../scripts/wiki/raw";
import { parseRawRef } from "../src/content/wiki/schema";

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Read-only plain source viewer: no Markdown/HTML execution, no arbitrary paths. */
export function handleRawSource(req: IncomingMessage, res: ServerResponse, wikiRoot: string): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/wiki/raw") return false;
  const ref = parseRawRef(url.searchParams.get("ref") ?? "");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader(
    "content-security-policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
  );
  if (req.method !== "GET" || !ref) {
    res.writeHead(req.method === "GET" ? 400 : 405, { "content-type": "text/plain; charset=utf-8" });
    res.end("需要合法的本地原文引用与行号。");
    return true;
  }
  try {
    const lines = sourceLines(readRawSnapshot(wikiRoot, ref.path));
    if (ref.lineEnd > lines.length) throw new Error("引用行号超出原文范围");
    const body = lines
      .map(
        (text, i) =>
          `<span class="line${i + 1 >= ref.lineStart && i + 1 <= ref.lineEnd ? " selected" : ""}" id="L${i + 1}"><a href="#L${i + 1}" aria-label="第 ${i + 1} 行">${i + 1}</a> ${escapeHtml(text)}</span>`,
      )
      .join("\n");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>本地原文</title><style>body{margin:2rem;background:#fafafa;color:#222;font:16px system-ui}h1{font-size:1.5rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.line{display:block}.line a{display:inline-block;min-width:3ch;color:#626262;text-decoration:none}.selected{background:#fff1bd}.line:target{outline:2px solid #b26a00}code{overflow-wrap:anywhere}</style></head><body><h1>本地原文</h1><p>引用第 ${ref.lineStart}–${ref.lineEnd} 行 · 文件完整性已核对，内容与结论仍需审阅。</p><details><summary>来源标识</summary><code>${escapeHtml(ref.path)}</code></details><pre>${body}</pre></body></html>`,
    );
  } catch {
    res.writeHead(422, { "content-type": "text/plain; charset=utf-8" });
    res.end("原文缺失、完整性校验失败或引用行号越界，请重新核对来源。");
  }
  return true;
}
