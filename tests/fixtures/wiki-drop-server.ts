import { createServer } from "node:http";
import { join } from "node:path";
import type { RunAgent } from "../../scripts/wiki/batch";
import { handleDrop } from "../../server/drop";
import { handlePages } from "../../server/pages";
import { handleRawSource } from "../../server/raw";
import { handleReview } from "../../server/review";

const root = process.argv[2]!;
const agent: RunAgent = async (req) => {
  const p = JSON.parse(req.stdin);
  let value: unknown;
  if (p.mode === "drop-extract") value = { summary: p.text, quotes: [p.text], conditions: [] };
  else if (p.mode === "drop-discover")
    value = {
      read: [],
      fetch: [],
      search: [],
      pages: [
        {
          path: "sources/drop-cache.md",
          reason: "补充缓存规则",
          toc: { part: "references", section: "公开资料" },
          evidence: [p.notes[0].ref],
        },
      ],
      question: "",
      report: "新增缓存规则及图示，来源已保存。",
      done: true,
    };
  else if (p.mode === "drop-generate")
    value = {
      text: `---\nid: drop-cache\ntitle: 新缓存规则\ntype: source\nsummary: 每组包含两个单元\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-10-06'\n---\n每组包含两个单元。\n\n\`\`\`wiki-diagram\nfile: drop-cache-figure\n\`\`\`\n`,
      revision: null,
      diagrams: [
        {
          id: "drop-cache-figure",
          yaml: "layout: figure\nid: drop-cache-figure\ncaption: 两个单元\nsize: [400, 160]\nitems:\n  - at: [40, 40]\n    size: [140, 60]\n    text: 两个单元\n    tone: kv\n",
        },
      ],
    };
  else value = { issues: [], contradictions: [], report: "已核对图文数量一致" };
  if (p.mode === "drop-generate")
    (value as { text: string }).text += "\n```calc\ntitle: 单元容量\n数据量 = 2 × 1 B = 2 B\n```\n";
  return { id: req.id, ok: true, exitCode: 0, costUsd: 0, stderrTail: "", output: JSON.stringify(value) };
};
const server = createServer(async (req, res) => {
  if (await handleDrop(req, res, root, { runAgent: agent })) return;
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
