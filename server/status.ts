import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { readBudget } from "../scripts/wiki/budget";
import { listGaps } from "../scripts/wiki/gap-ledger";
import { answeredBy, modelSwitched, WORK_MODEL } from "../scripts/wiki/model-use";
import { collectStepTerms } from "../scripts/wiki/lint";
import { listTasks } from "../scripts/wiki/queue";
import { listReviews } from "../scripts/wiki/review";
import { readSyncConfig } from "../scripts/wiki/sync";
import { send } from "./http";

const json = (path: string): unknown => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined);
const pageIds = (root: string, dir: string) =>
  existsSync(join(root, "wiki", dir))
    ? readdirSync(join(root, "wiki", dir))
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -3))
    : [];

/**
 * 面板「状态」页签的数据：把原本只能翻文件才知道的运行状态摆到明面上。
 * 只读、不起子进程、不调模型——每一项都是读本机已有的文件。要 git 才算得出的（哪些页的上游变了）
 * 不放这里，给命令。
 */
export function readStatus(root: string, syncConfigPath = join(root, "wiki/sync.config.json")) {
  let budget:
    | { limitUsd: number; chargedUsd: number; calls: number; maxCalls: number; paused: boolean; pauseReason?: string }
    | undefined;
  let calls: ReturnType<typeof readBudget>["calls"] = [];
  try {
    const b = readBudget(root);
    calls = b.calls;
    const unknown = b.calls.filter((call) => call.state === "unknown").at(-1);
    budget = {
      limitUsd: b.policy.limitUsd,
      chargedUsd: b.chargedUsd,
      calls: b.calls.length,
      maxCalls: b.policy.maxCalls,
      paused: b.paused,
      ...(b.paused && unknown ? { pauseReason: `${unknown.startedAt.slice(0, 10)} ${unknown.reason ?? ""}` } : {}),
    };
  } catch {
    budget = undefined; // 没建账本
  }

  const config = existsSync(syncConfigPath) ? readSyncConfig(syncConfigPath) : undefined;
  // 账本从 2026-09-23 晚起记模型，更早的调用没有这项，不算进分母
  const recorded = calls.filter((call) => call.models);
  const switched = recorded.filter((call) => modelSwitched(call.models));
  const last = switched.at(-1);
  // CLI 没报换手、只是作答模型对不上时，按启动时的模型 → 实际作答模型记
  const hop = last?.models && {
    from: last.models.requested ?? "",
    to: answeredBy(last.models) ?? "",
    ...last.models.switches.at(-1),
  };
  const models = {
    ...(config?.chatModel ? { chatModel: config.chatModel } : {}),
    workModel: WORK_MODEL,
    recorded: recorded.length,
    switched: switched.length,
    ...(last && hop ? { last: { at: last.startedAt, purpose: last.purpose, ...hop } } : {}),
  };
  const lastRun = json(join(root, "wiki/_jobs/sync/last-run.json")) as
    | { startedAt?: string; finishedAt?: string; status?: string }
    | undefined;
  const warnings = join(root, "wiki/warnings");
  const latestParams = existsSync(warnings)
    ? readdirSync(warnings)
        .filter((name) => /^params-[a-f0-9]+-[a-f0-9]+\.json$/.test(name))
        .map((name) => join(warnings, name))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
    : undefined;
  const heldBack = latestParams
    ? ((json(latestParams) as { published?: { heldBack?: number } }).published?.heldBack ?? 0)
    : 0;
  const paidWork = config ? config.maxTasks + config.reconcileBatches + config.driftSample : 0;

  const ids = new Set(["concepts", "params", "sources"].flatMap((dir) => pageIds(root, dir)));
  const terms = collectStepTerms();
  const reviews = listReviews(root);
  return {
    budget,
    models,
    nightly: config && {
      lastRun,
      maxNewParamPages: config.maxNewParamPages,
      heldBack,
      fetch: config.fetch,
      github: config.github,
      /** 夜间任务会不会自己调模型：要同时有 paid 授权块和大于 0 的配额 */
      spendsMoney: !!config.paid && paidWork > 0,
      paidWork: { tasks: config.maxTasks, reconcile: config.reconcileBatches, drift: config.driftSample },
    },
    pages: {
      concepts: pageIds(root, "concepts").length,
      params: pageIds(root, "params").length,
      sources: pageIds(root, "sources").length,
    },
    todo: {
      pendingReviews: reviews.filter((r) => r.state === "pending" || r.state === "publishing").length,
      missingTerms: terms.filter((t) => !ids.has(t)),
      totalTerms: terms.length,
      gaps: listGaps(root).length,
      queuedTasks: listTasks(root).filter((t) => t.state === "queued").length,
    },
  };
}
export type WikiStatus = ReturnType<typeof readStatus>;

export async function handleStatus(req: IncomingMessage, res: ServerResponse, root: string): Promise<boolean> {
  if (new URL(req.url ?? "/", "http://localhost").pathname !== "/api/wiki/status") return false;
  if (req.method !== "GET") send(res, 405, { error: "需要 GET" });
  else
    try {
      send(res, 200, readStatus(root));
    } catch (error) {
      send(res, 503, { error: String(error) });
    }
  return true;
}
