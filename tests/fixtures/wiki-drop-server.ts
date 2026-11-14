import { createServer } from "node:http";
import { join } from "node:path";
import { handleDrop } from "../../server/drop";
import { handlePages } from "../../server/pages";
import { handleRawSource } from "../../server/raw";
import { handleReview } from "../../server/review";
import { dropBrowserAgent } from "./drop-browser-agent";

const root = process.argv[2]!;
const server = createServer(async (req, res) => {
  if (await handleDrop(req, res, root, { runAgent: dropBrowserAgent })) return;
  if (await handleReview(req, res, root)) return;
  if (await handlePages(req, res, root)) return;
  if (handleRawSource(req, res, join(root, "wiki"))) return;
  res.writeHead(404);
  res.end();
});
server.listen(0, "127.0.0.1", () => {
  const a = server.address();
  if (a && typeof a !== "string") console.log(JSON.stringify({ origin: `http://127.0.0.1:${a.port}` }));
});
