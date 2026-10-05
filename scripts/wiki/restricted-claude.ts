import type { AgentRequest, RunAgent } from "./batch";
import { resolveClaudeCommand, spawnClaude } from "./claude-cli";
import { MODEL_ID, WORK_MODEL } from "./model-use";

export const RESTRICTED_PROFILE = "restricted-text-v1";
export function restrictedArgs(rules: string, budget?: number, model = WORK_MODEL): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--safe-mode",
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--disable-slash-commands",
    "--no-session-persistence",
    "--setting-sources",
    "",
    "--model",
    model,
    "--system-prompt",
    rules,
    ...(budget === undefined ? [] : ["--max-budget-usd", String(budget)]),
  ];
}

/** Fail closed on profile changes, missing/duplicate results, or tool activity. */
export const runRestrictedClaude: RunAgent = async (req: AgentRequest) => {
  const budget = Number(req.args[req.args.indexOf("--max-budget-usd") + 1]);
  const rules = req.args[req.args.indexOf("--system-prompt") + 1] ?? "";
  const reject = (reason: string) => ({
    id: req.id,
    ok: false,
    exitCode: 1,
    costUsd: 0,
    stderrTail: "",
    reason,
  });
  if (
    !rules ||
    !MODEL_ID.test(req.model ?? WORK_MODEL) ||
    !Number.isFinite(budget) ||
    budget <= 0 ||
    req.allowedWrites.length ||
    JSON.stringify(req.args) !== JSON.stringify(restrictedArgs(rules, budget, req.model ?? WORK_MODEL))
  )
    return reject("受限编译配置不匹配");
  // Empty --tools argv must survive Windows quoting exactly. Never use shell fallback.
  if (resolveClaudeCommand().shell) return reject("受限编译需要可直接执行的 claude 二进制路径（CLAUDE_CLI）");
  let results = 0;
  let output: string | undefined;
  let invalid = false;
  let diagnostic: string | undefined;
  const result = await spawnClaude(req, (line) => {
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    if (!value || typeof value !== "object") return;
    const message = value.message as { content?: { type?: string }[] } | undefined;
    if (Array.isArray(message?.content) && message.content.some((c) => !c || c.type === "tool_use"))
      invalid = true;
    if (value.type !== "result") return;
    results++;
    if (value.is_error === true && typeof value.result === "string") diagnostic = value.result.slice(0, 2000);
    if (
      value.is_error !== false ||
      typeof value.result !== "string" ||
      Buffer.byteLength(value.result, "utf8") > 128 * 1024
    )
      invalid = true;
    else output = value.result;
    return {
      isError: invalid,
      costUsd: typeof value.total_cost_usd === "number" ? value.total_cost_usd : undefined,
    };
  });
  if (!result.ok || invalid || results !== 1 || !output?.trim())
    return {
      ...result,
      ok: false,
      reason: diagnostic
        ? `${result.reason ?? "provider-error"}: ${diagnostic}`
        : (result.reason ?? "受限编译未返回唯一有效文本，或出现工具调用"),
    };
  return { ...result, output };
};
