/**
 * pnpm wiki:mcp
 *
 * 只读 MCP server（stdio）。三个工具：wiki_search / wiki_get_page / wiki_neighbors。
 * 接法（Claude Code）：claude mcp add llm-wiki -- pnpm --dir <本仓库路径> -s wiki:mcp
 * 它不写任何文件、不调模型、不联网；每次调用都读磁盘上当前的 registry.json 与页面。
 */
import { createInterface } from "node:readline";
import { handleRpc, loadAgentWiki } from "./wiki/agent-access";

const root = process.cwd();
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let id: number | string | null = null;
  try {
    const msg = JSON.parse(line);
    id = msg.id ?? null;
    // 每条消息重新读盘：知识库在另一个进程里被更新之后，不用重启 server
    const reply = handleRpc(msg, loadAgentWiki(root));
    if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32700, message: String(error) } })}\n`,
    );
  }
});
