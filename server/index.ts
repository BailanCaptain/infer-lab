/** Local wiki HTTP entry point. Shared handlers own parsing and workflow contracts. */
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { handleAnswers } from "./answers";
import { handleChat } from "./chat-route";
import { send } from "./http";
import { handlePages } from "./pages";
import { handleRawSource } from "./raw";
import { handleReview } from "./review";
import { readKnowledgeSnapshot } from "./snapshot";
import { handleStatus } from "./status";

const root = resolve(process.cwd());
const port = Number(process.env.WIKI_SERVER_PORT ?? 8790);
const server = createServer(async (req, res) => {
  if (handleRawSource(req, res, join(root, "wiki"))) return;
  if (await handleReview(req, res, root)) return;
  if (await handleAnswers(req, res, root)) return;
  if (await handlePages(req, res, root)) return;
  if (await handleStatus(req, res, root)) return;
  if (await handleChat(req, res, root)) return;
  if (req.method === "GET" && new URL(req.url ?? "/", "http://localhost").pathname === "/api/wiki/health") {
    try {
      const snapshot = await readKnowledgeSnapshot(root);
      send(res, 200, { ok: true, pages: snapshot.registry.pages.length, revision: snapshot.revision });
    } catch (error) {
      send(res, 503, { error: String(error) });
    }
    return;
  }
  send(res, 404, { error: "no such route" });
});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(
    "wiki server → http://127.0.0.1:" + (typeof address === "object" && address ? address.port : port),
  );
});
