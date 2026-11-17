import type { IncomingMessage, ServerResponse } from "node:http";
import { parseWikiUrl, send } from "./http";
import { readReaderSnapshot } from "./snapshot";

/** One locked snapshot contains both metadata and bodies; never exposes drafts or job records. */
export async function handlePages(req: IncomingMessage, res: ServerResponse, root: string): Promise<boolean> {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  if (url.pathname !== "/api/wiki/pages") return false;
  if (req.method !== "GET") {
    send(res, 405, { error: "需要 GET" });
    return true;
  }
  try {
    const snapshot = await readReaderSnapshot(root);
    const etag = `"${snapshot.revision}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "no-cache");
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304);
      res.end();
    } else send(res, 200, snapshot);
  } catch (error) {
    send(res, 503, { error: String(error) });
  }
  return true;
}
