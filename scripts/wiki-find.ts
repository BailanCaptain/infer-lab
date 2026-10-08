/**
 * pnpm wiki:find <词或问题> [--limit N] [--page <id>] [--neighbors <id>] [--json]
 *
 * 给能跑命令行的 agent（和人）用的只读入口，与站内问答走同一个检索。
 *   pnpm wiki:find "layer share"        找页：id、标题、摘要、文件路径、已核对的版本
 *   pnpm wiki:find --page block-table   打印这一页的 markdown
 *   pnpm wiki:find --neighbors block-table   这一页和哪些页有关，每条边带理由
 */
import { loadAgentWiki } from "./wiki/agent-access";

const argv = process.argv.slice(2);
const opt = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const wiki = loadAgentWiki(process.cwd());
const json = argv.includes("--json");

const pageId = opt("--page");
const neighborsOf = opt("--neighbors");
if (pageId) {
  const page = wiki.getPage(pageId);
  if (!page) {
    console.error(`没有 id 为 ${pageId} 的页；先用 pnpm wiki:find <词> 找`);
    process.exit(1);
  }
  console.log(page.text);
} else if (neighborsOf) {
  const edges = wiki.neighbors(neighborsOf);
  if (json) console.log(JSON.stringify(edges, null, 2));
  else
    for (const e of edges)
      console.log(`${e.direction === "out" ? "→" : "←"} ${e.kind}  ${e.id}（${e.title}）\n    ${e.note}`);
} else {
  const flags = new Set(["--limit", "--page", "--neighbors"]);
  const query = argv.filter((a, i) => !a.startsWith("--") && !flags.has(argv[i - 1] ?? "")).join(" ");
  if (!query) {
    console.error("用法：pnpm wiki:find <词或问题> [--limit N] | --page <id> | --neighbors <id>  [--json]");
    process.exit(2);
  }
  const hits = wiki.search(query, Number(opt("--limit")) || 5);
  if (json) console.log(JSON.stringify(hits, null, 2));
  else if (hits.length === 0) console.log("没有命中。知识库可能还没收录这个词。");
  else
    for (const h of hits)
      console.log(
        `${h.id}  [${h.how}${h.via ? ` ← ${h.via}` : ""}]  ${h.file}\n    ${h.title}\n    ${h.summary}\n    已核对：${h.verified.join("、") || "（未记录）"}`,
      );
}
