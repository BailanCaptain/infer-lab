import type { IncomingMessage, ServerResponse } from "node:http";
import { readRawSnapshot } from "../scripts/wiki/raw";
import { renderRawSnapshotHtml, serveWikiRawPage } from "../scripts/wiki/raw-viewer";
import { parseRawRef } from "../src/content/wiki/schema";
import { checkLocalReader, HttpError, parseWikiUrl, send } from "./http";

/** Read-only plain source viewer: no Markdown/HTML execution, no arbitrary paths. */
export function handleRawSource(req: IncomingMessage, res: ServerResponse, wikiRoot: string): boolean {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  if (url.pathname !== "/api/wiki/raw" && !url.pathname.startsWith("/wiki-raw/")) return false;
  try {
    checkLocalReader(req);
  } catch (error) {
    send(res, error instanceof HttpError ? error.status : 403, { error: String(error) });
    return true;
  }
  if (url.pathname.startsWith("/wiki-raw/")) {
    return serveWikiRawPage(req.method, url, res, wikiRoot);
  }
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
    const content = readRawSnapshot(wikiRoot, ref.path);
    const { html, csp } = renderRawSnapshotHtml(ref.path, content, {
      range: { lineStart: ref.lineStart, lineEnd: ref.lineEnd },
    });
    res.setHeader("content-security-policy", csp);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(422, { "content-type": "text/plain; charset=utf-8" });
    res.end("原文缺失、完整性校验失败或引用行号越界，请重新核对来源。");
  }
  return true;
}
