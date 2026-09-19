import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { AgentRequest } from "./batch";
import { resolveClaudeCommand, spawnClaude } from "./claude-cli";
import { atomicText, digest, WorkflowStore } from "./workflow";

const planSchema = z
  .object({
    maxCostUsd: z.number().finite().positive(),
    slots: z
      .array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), reserveUsd: z.number().finite().positive() }))
      .min(1),
  })
  .refine(
    (p) =>
      new Set(p.slots.map((s) => s.id)).size === p.slots.length &&
      p.slots.reduce((n, s) => n + s.reserveUsd, 0) <= p.maxCostUsd,
    "调用预留总额超过授权或 slot 重复",
  );

/** Fixed one-attempt slots reuse workflow accounting. A slot cannot silently become a new paid call. */
export async function runEvalCall(root: string, slotId: string, request: AgentRequest) {
  if (existsSync(join(root, "closed.json"))) throw new Error("本轮评测已结束，未使用预留已取消");
  const plan = planSchema.parse(JSON.parse(readFileSync(join(root, "budget.json"), "utf8")));
  const slot = plan.slots.find((s) => s.id === slotId);
  if (!slot) throw new Error("未分配调用额度");
  const budgets = request.args.flatMap((arg, i) =>
    arg === "--max-budget-usd" ? [Number(request.args[i + 1])] : [],
  );
  if (
    budgets.length !== 1 ||
    !Number.isFinite(budgets[0]) ||
    budgets[0]! <= 0 ||
    budgets[0]! > slot.reserveUsd
  )
    throw new Error("调用额度与预留不一致");
  if (resolveClaudeCommand().shell) throw new Error("评测需要原生 CLI");
  const store = new WorkflowStore(root);
  const requestHash = digest(JSON.stringify(request));
  const binding = join(root, `${slotId}.request.json`);
  await store.locked(() => {
    const authorization = join(root, "authorization.json");
    const config = JSON.stringify(plan);
    if (existsSync(authorization) && readFileSync(authorization, "utf8") !== config)
      throw new Error("本次授权预算配置已改变");
    if (!existsSync(authorization)) atomicText(authorization, config);
    if (existsSync(binding)) {
      if (digest(readFileSync(binding, "utf8")) !== requestHash)
        throw new Error("已固定的调用不可改写，使用其他已分配 slot");
    } else atomicText(binding, JSON.stringify(request));
  });
  const job = await store.enqueue(
    {
      origin: "seed",
      sources: [{ ref: slotId, hash: requestHash }],
      targets: [slotId],
      recipeHash: digest(JSON.stringify(plan)),
    },
    { maxAttempts: 1, maxCostUsd: slot.reserveUsd, reserveUsd: slot.reserveUsd },
  );
  const output = join(root, `${slotId}.result.json`);
  if (existsSync(output)) return JSON.parse(readFileSync(output, "utf8"));
  const charged = store
    .list()
    .reduce((sum, job) => sum + job.attempts.reduce((n, a) => n + (a.costUsd ?? a.reservedUsd), 0), 0);
  if (charged + slot.reserveUsd > plan.maxCostUsd) throw new Error("剩余授权预算不足");
  const attempt = await store.claim(job.id);
  const lines: unknown[] = [];
  let results = 0;
  const result = await spawnClaude(request, (line) => {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    if (!event || typeof event !== "object") return;
    // Keep the actual model/tool inventory, tool results and answer; no process environment dump.
    lines.push(event);
    appendFileSync(join(root, `${slotId}.events.jsonl`), `${JSON.stringify(event)}\n`, "utf8");
    if (event.type !== "result") return;
    results++;
    return {
      isError: event.is_error !== false,
      costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : undefined,
    };
  });
  const accounted =
    typeof result.costUsd === "number" &&
    Number.isFinite(result.costUsd) &&
    result.costUsd >= 0 &&
    result.costUsd <= slot.reserveUsd;
  const reason =
    result.reason ??
    (!accounted ? "费用未知、非法或超过单次预留；停止验收" : results !== 1 ? "没有唯一结果" : undefined);
  const record = {
    ...result,
    ok: result.ok && results === 1 && accounted,
    reason,
    slotId,
    reservedUsd: slot.reserveUsd,
    requestHash,
    lines,
  };
  mkdirSync(root, { recursive: true });
  atomicText(output, JSON.stringify(record, null, 2));
  await store.finish(job.id, attempt.token, record);
  return record;
}
