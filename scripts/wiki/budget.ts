import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { AgentRequest, RunAgent } from "./batch";
import { type ModelUse, modelUseSchema } from "./model-use";
import { localFile } from "./review-files";
import { isProduction } from "./sync-config";
import { atomicText, digest, WorkflowStore } from "./workflow";

const policySchema = z
  .object({
    limitUsd: z.number().finite().positive(),
    priorChargedUsd: z.number().finite().nonnegative(),
    reserveUsd: z.number().finite().positive(),
    maxCalls: z.number().int().positive(),
  })
  .strict();
const callSchema = z.object({
  id: z.string().uuid(),
  purpose: z.string(),
  requestHash: z.string(),
  reservedUsd: z.number(),
  startedAt: z.string(),
  ownerPid: z.number().int().positive().optional(),
  finishedAt: z.string().optional(),
  costUsd: z.number().finite().nonnegative().optional(),
  state: z.enum(["running", "finished", "unknown"]),
  reason: z.string().optional(),
  /** 实际作答模型；2026-09-23 晚加这项之前的账目没有 */
  models: modelUseSchema.optional(),
  billing: z.literal("chatgpt").optional(),
  accountingOnly: z.boolean().optional(),
  usage: z.record(z.number().int().nonnegative()).optional(),
});
const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    policy: policySchema,
    calls: z.array(callSchema),
    paused: z.boolean(),
    resumptions: z
      .array(
        z
          .object({
            planId: z.string().regex(/^[a-f0-9]{64}$/),
            beforeHash: z.string().regex(/^[a-f0-9]{64}$/),
            approvedAt: z.string(),
            reason: z.string().trim().min(1).max(2000),
            chargedUsd: z.number().finite().nonnegative(),
            unknownCallIds: z.array(z.string().uuid()),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
const pathOf = (root: string) => localFile(root, "wiki/_jobs/budget/account.json");
const read = (root: string) => {
  if (!existsSync(pathOf(root))) throw new Error("尚未配置共享预算：先运行 wiki:budget init；未启动模型");
  return stateSchema.parse(JSON.parse(readFileSync(pathOf(root), "utf8")));
};
const charged = (s: z.infer<typeof stateSchema>) =>
  s.policy.priorChargedUsd +
  s.calls.filter((c) => !c.accountingOnly).reduce((sum, c) => sum + (c.costUsd ?? c.reservedUsd), 0);
export const readBudget = (root: string) => {
  const state = read(root);
  return {
    ...state,
    chargedUsd: charged(state),
    remainingUsd: Math.max(0, state.policy.limitUsd - charged(state)),
  };
};

/** Read-only proposal. Approval accepts outstanding reservations, not a fabricated invoice. */
export function planBudgetResume(root: string) {
  const state = read(root);
  if (!state.paused) throw new Error("共享预算没有暂停，无需恢复");
  const limitedCalls = state.calls.filter((call) => !call.accountingOnly);
  if (limitedCalls.some((call) => call.state === "running"))
    throw new Error("仍有运行中的调用，先核对调用状态");
  if (limitedCalls.length >= state.policy.maxCalls) throw new Error("调用次数已达上限，恢复不能扩大限制");
  if (charged(state) >= state.policy.limitUsd) throw new Error("预算已耗尽或超额，恢复不能扩大限制");
  const plan = {
    stateHash: digest(JSON.stringify(state)),
    limitUsd: state.policy.limitUsd,
    priorChargedUsd: state.policy.priorChargedUsd,
    chargedUsd: charged(state),
    remainingUsd: Math.max(0, state.policy.limitUsd - charged(state)),
    remainingCalls: state.policy.maxCalls - limitedCalls.length,
    unknownCalls: limitedCalls
      .filter((call) => call.state === "unknown")
      .map((call) => ({ id: call.id, reservedUsd: call.reservedUsd })),
    note: "保留全部旧账目和未知费用预留；实际账单仍可能超过预留。仅在用户明确接受该口径后恢复，不启动模型。",
  };
  return { id: digest(JSON.stringify(plan)), ...plan };
}

/** Applies explicit approval of a specific read-only plan. Old approval never clears a new pause. */
export async function resumeBudget(root: string, planId: string, reason: string) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(planId);
  const approvedReason = z.string().trim().min(1).max(2000).parse(reason);
  return new WorkflowStore(root).locked(() => {
    const state = read(root);
    if (state.resumptions?.some((entry) => entry.planId === planId)) return readBudget(root);
    const plan = planBudgetResume(root);
    if (plan.id !== planId) throw new Error("预算状态已变化，请重新预览并批准恢复方案");
    state.resumptions = [
      ...(state.resumptions ?? []),
      {
        planId,
        beforeHash: plan.stateHash,
        approvedAt: new Date().toISOString(),
        reason: approvedReason,
        chargedUsd: plan.chargedUsd,
        unknownCallIds: plan.unknownCalls.map((call) => call.id),
      },
    ];
    state.paused = false;
    atomicText(pathOf(root), JSON.stringify(state));
    return readBudget(root);
  });
}

export async function initBudget(root: string, input: z.infer<typeof policySchema>) {
  const policy = policySchema.parse(input);
  if (policy.priorChargedUsd > policy.limitUsd || policy.reserveUsd > policy.limitUsd)
    throw new Error("共享预算配置矛盾");
  return new WorkflowStore(root).locked(() => {
    if (existsSync(pathOf(root))) {
      if (JSON.stringify(read(root).policy) !== JSON.stringify(policy))
        throw new Error("已有共享预算不能重置或扩大");
    } else {
      mkdirSync(dirname(pathOf(root)), { recursive: true });
      atomicText(pathOf(root), JSON.stringify({ schemaVersion: 1, policy, calls: [], paused: false }));
    }
    return readBudget(root);
  });
}

/** A local admission limit; the provider may bill more than its soft per-request flag. */
export async function withBudget<
  T extends {
    ok: boolean;
    costUsd?: number;
    reason?: string;
    models?: ModelUse;
    usage?: Record<string, number | undefined>;
  },
>(
  root: string,
  purpose: string,
  request: AgentRequest,
  run: (request: AgentRequest) => Promise<T>,
): Promise<T> {
  if (request.accountingOnly || isProduction(root))
    request = {
      ...request,
      accountingOnly: true,
      args: request.args.filter(
        (arg, index, args) => arg !== "--max-budget-usd" && args[index - 1] !== "--max-budget-usd",
      ),
    };
  const store = new WorkflowStore(root);
  const subscription = request.provider === "codex";
  const claim = await store.locked(() => {
    const state = read(root);
    for (const call of state.calls.filter((c) => c.state === "running")) {
      let alive = false;
      if (call.ownerPid)
        try {
          process.kill(call.ownerPid, 0);
          alive = true;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ESRCH") alive = true;
        }
      if (!alive) {
        call.state = "unknown";
        call.reason = "调用所属进程已退出或旧回执无所属进程，保留全部预留等待账单核对";
        if (call.billing !== "chatgpt" && !call.accountingOnly) state.paused = true;
      }
    }
    if (state.paused) atomicText(pathOf(root), JSON.stringify(state));
    if (!request.accountingOnly && state.paused)
      throw new Error("共享预算已暂停：未知费用或实际超额需核对；未启动模型");
    if (
      !request.accountingOnly &&
      state.calls.filter((c) => !c.accountingOnly).length >= state.policy.maxCalls
    )
      throw new Error("共享模型调用次数已达上限");
    const values = request.args.flatMap((arg, i) =>
      arg === "--max-budget-usd" ? [Number(request.args[i + 1])] : [],
    );
    if (values.length > 1 || values.some((n) => !Number.isFinite(n) || n <= 0))
      throw new Error("单次模型预算无效");
    const reserve =
      subscription || request.accountingOnly
        ? 0
        : Math.min(state.policy.reserveUsd, values[0] ?? state.policy.reserveUsd);
    if (!request.accountingOnly && !subscription && charged(state) + reserve > state.policy.limitUsd + 1e-9)
      throw new Error("共享剩余预算不足，未启动模型");
    const args = [...request.args];
    const index = args.indexOf("--max-budget-usd");
    if (subscription && index >= 0) throw new Error("Codex 账户额度不能使用美元调用限额");
    if (!request.accountingOnly && !subscription && index < 0) args.push("--max-budget-usd", String(reserve));
    else if (!request.accountingOnly && !subscription) args[index + 1] = String(reserve);
    const req = { ...request, args };
    const call = {
      id: randomUUID(),
      purpose,
      requestHash: digest(JSON.stringify(req)),
      reservedUsd: reserve,
      startedAt: new Date().toISOString(),
      ownerPid: process.pid,
      state: "running" as const,
      ...(request.accountingOnly ? { accountingOnly: true } : {}),
      ...(subscription ? { billing: "chatgpt" as const } : {}),
    };
    state.calls.push(call);
    atomicText(pathOf(root), JSON.stringify(state));
    return { call, req };
  });
  const finish = async (
    costUsd: number | undefined,
    reason?: string,
    models?: ModelUse,
    usage?: T["usage"],
  ) =>
    store.locked(() => {
      const state = read(root);
      const call = state.calls.find((c) => c.id === claim.call.id)!;
      const known = typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd >= 0;
      const failure =
        subscription || request.accountingOnly
          ? undefined
          : !known
            ? "费用未知，共享预算暂停"
            : costUsd > call.reservedUsd
              ? "实际消耗超过单次预留，共享预算暂停"
              : undefined;
      call.state = subscription || known ? "finished" : "unknown";
      call.finishedAt = new Date().toISOString();
      if (known && !subscription) call.costUsd = costUsd;
      if (usage) call.usage = z.record(z.number().int().nonnegative()).parse(usage);
      if (models) call.models = models;
      call.reason = [failure, reason].filter(Boolean).join("；") || undefined;
      state.paused ||= !!failure;
      atomicText(pathOf(root), JSON.stringify(state));
      return failure;
    });
  let result: T;
  try {
    result = await run(claim.req);
  } catch (error) {
    await finish(undefined, String(error));
    throw error;
  }
  const failure = await finish(result.costUsd, result.reason, result.models, result.usage);
  return failure
    ? { ...result, ok: false, reason: [failure, result.reason].filter(Boolean).join("；") }
    : result;
}

export const budgetedAgent =
  (root: string, purpose: string, run: RunAgent): RunAgent =>
  (request, onEvent) =>
    withBudget(root, purpose, request, (req) => run(req, onEvent));
