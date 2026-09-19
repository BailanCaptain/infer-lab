import type { IncomingMessage, ServerResponse } from "node:http";
import { send } from "./http";
import { readReaderSnapshot } from "./snapshot";

/** One locked snapshot contains both metadata and bodies; never exposes drafts or job records. */
export async function handlePages(req: IncomingMessage, res: ServerResponse, root: string): Promise<boolean> {
  if (new URL(req.url ?? "/", "http://localhost").pathname !== "/api/wiki/pages") return false;
  if (req.method !== "GET") {
    send(res, 405, { error: "需要 GET" });
    return true;
  }
  try {
    send(res, 200, await readReaderSnapshot(root));
  } catch (error) {
    send(res, 503, { error: String(error) });
  }
  return true;
}
