import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { handleAnswers } from "./answers";
import { handleChat } from "./chat-route";
import { handleDrop } from "./drop";
import { handleEvidence } from "./evidence";
import { HttpError, parseWikiUrl, send } from "./http";
import { handlePages } from "./pages";
import { handleRawSource } from "./raw";
import { handleReview } from "./review";
import { readKnowledgeSnapshot } from "./snapshot";
import { handleStatus } from "./status";

export async function dispatchWikiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<void> {
  const url = parseWikiUrl(req, res);
  if (!url) return;
  if (await handleDrop(req, res, root)) return;
  if (handleRawSource(req, res, join(root, "wiki"))) return;
  if (await handleReview(req, res, root)) return;
  if (await handleAnswers(req, res, root)) return;
  if (await handlePages(req, res, root)) return;
  if (await handleEvidence(req, res, root)) return;
  if (await handleStatus(req, res, root)) return;
  if (await handleChat(req, res, root)) return;
  if (req.method === "GET" && url.pathname === "/api/wiki/health") {
    try {
      const snapshot = await readKnowledgeSnapshot(root);
      send(res, 200, { ok: true, pages: snapshot.registry.pages.length, revision: snapshot.revision });
    } catch (error) {
      send(res, 503, { error: String(error) });
    }
    return;
  }
  send(res, 404, { error: "no such route" });
}

export function createWikiServer(root: string): Server {
  return createServer(async (req, res) => {
    try {
      await dispatchWikiRequest(req, res, root);
    } catch (error) {
      if (!res.headersSent) {
        send(res, error instanceof HttpError ? error.status : 500, { error: String(error) });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });
}
