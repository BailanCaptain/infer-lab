/**
 * pnpm wiki:mcp
 *
 * 只读双擎 MCP server（stdio）：3 个知识库工具 + 4 个确定性昇腾仿真工具。
 * 接法（Claude Code）：claude mcp add llm-wiki -- pnpm --dir <本仓库路径> -s wiki:mcp
 * 不写文件、不调模型、不联网；知识库按磁盘 mtime 惰性加载，纯仿真调用零全库 I/O。
 */
import { createInterface } from "node:readline";
import { redactSensitiveText } from "../server/tool-evidence";
import { createCachedAgentWikiLoader, handleRpc } from "./wiki/agent-access";

const getWiki = createCachedAgentWikiLoader(process.cwd());
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON-RPC payload" } })}\n`,
    );
    return;
  }
  const id =
    parsed && typeof parsed === "object" && "id" in parsed
      ? ((parsed as { id?: number | string | null }).id ?? null)
      : null;
  try {
    const reply = handleRpc(parsed as never, getWiki);
    if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
  } catch (error) {
    const safeMsg = redactSensitiveText(error instanceof Error ? error.message : String(error));
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: safeMsg } })}\n`,
    );
  }
});
