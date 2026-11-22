import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { readBudget } from "../scripts/wiki/budget";
import { listGaps } from "../scripts/wiki/gap-ledger";
import {
  hasSecretHarnessArg,
  inspectApiKey,
  sanitizeHarnessArgs,
  stripUrlCredentials,
} from "../scripts/wiki/http-provider";
import { collectStepTerms } from "../scripts/wiki/lint";
import { answeredBy, MODEL_ID, modelSwitched, WORK_MODEL } from "../scripts/wiki/model-use";
import { loadPages } from "../scripts/wiki/pages";
import { listTasks } from "../scripts/wiki/queue";
import { listReviewSummaries } from "../scripts/wiki/review";
import {
  ANTHROPIC_VERSION_RE,
  CLAUDE_SETTING_SOURCES_RE,
  ENV_VAR_NAME_RE,
  harnessCommandSchema,
  readSyncConfig,
  syncConfigSchema,
} from "../scripts/wiki/sync-config";
import { atomicText, WorkflowStore } from "../scripts/wiki/workflow";
import { CHAT_PROVIDERS, defaultModelForProvider } from "../src/content/wiki/chat-models";
import { findPageByName } from "../src/content/wiki/page-names";
import { checkLocalReader, checkWriter, HttpError, parseWikiUrl, readJson, send } from "./http";

const json = (path: string): unknown =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
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
  const config =
    existsSync(syncConfigPath) || existsSync(syncConfigPath.replace(/\.json$/, ".local.json"))
      ? readSyncConfig(syncConfigPath)
      : undefined;
  const production = config?.mode === "production";
  let budget:
    | {
        limitUsd: number | null;
        chargedUsd: number;
        calls: number;
        maxCalls: number | null;
        paused: boolean;
        pauseReason?: string;
      }
    | undefined;
  let calls: ReturnType<typeof readBudget>["calls"] = [];
  try {
    const b = readBudget(root);
    calls = b.calls;
    const limitedCalls = b.calls.filter((call) => !call.accountingOnly);
    const unknown = limitedCalls.filter((call) => call.state === "unknown").at(-1);
    budget = {
      limitUsd: production ? null : b.policy.limitUsd,
      chargedUsd: production
        ? b.policy.priorChargedUsd + b.calls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0)
        : b.chargedUsd,
      calls: production ? b.calls.length : limitedCalls.length,
      maxCalls: production ? null : b.policy.maxCalls,
      paused: production ? false : b.paused,
      ...(!production && b.paused && unknown
        ? { pauseReason: `${unknown.startedAt.slice(0, 10)} ${unknown.reason ?? ""}` }
        : {}),
    };
  } catch {
    budget = undefined; // 没建账本
  }

  // 账本从 2026-09-23 晚起记模型，更早的调用没有这项，不算进分母
  const recorded = calls.filter((call) => call.models && !call.billing);
  const switched = recorded.filter((call) => modelSwitched(call.models));
  const last = switched.at(-1);
  // CLI 没报换手、只是作答模型对不上时，按启动时的模型 → 实际作答模型记
  const hop = last?.models && {
    from: last.models.requested ?? "",
    to: answeredBy(last.models) ?? "",
    ...last.models.switches.at(-1),
  };
  const chatProvider = config?.chatProvider ?? "claude";
  const isHttpProvider = chatProvider === "openai-compatible" || chatProvider === "anthropic-compatible";
  const keyStatus =
    isHttpProvider || config?.apiKeyEnv
      ? inspectApiKey(chatProvider, config?.apiKeyEnv, config?.apiBaseUrl)
      : undefined;
  const externalCalls = calls.filter((c) => c.billing === "external").length;
  // Security boundary: NEVER return raw API keys or claudeEnv values here — only env var name and boolean hasApiKey.
  const models = {
    chatProvider,
    ...(config?.chatModel
      ? { chatModel: config.chatModel }
      : chatProvider !== "claude"
        ? { chatModel: defaultModelForProvider(chatProvider, WORK_MODEL) }
        : {}),
    codexCalls: calls.filter((c) => c.billing === "chatgpt").length,
    ...(externalCalls > 0 ? { externalCalls } : {}),
    workModel: config?.chatModel ?? defaultModelForProvider(chatProvider, WORK_MODEL),
    recorded: recorded.length,
    switched: switched.length,
    ...(config?.apiBaseUrl ? { apiBaseUrl: stripUrlCredentials(config.apiBaseUrl) } : {}),
    ...(keyStatus?.apiKeyEnv ? { apiKeyEnv: keyStatus.apiKeyEnv } : {}),
    ...(keyStatus !== undefined ? { hasApiKey: keyStatus.hasApiKey } : {}),
    ...(config?.anthropicVersion ? { anthropicVersion: config.anthropicVersion } : {}),
    ...(config?.claudeCli ? { claudeCli: config.claudeCli } : {}),
    ...(config?.claudeSettingSources !== undefined
      ? { claudeSettingSources: config.claudeSettingSources }
      : {}),
    ...(config?.codexAllowUserConfig ? { codexAllowUserConfig: config.codexAllowUserConfig } : {}),
    ...(config?.harnessCommand
      ? {
          harnessCommand: {
            command: config.harnessCommand.command,
            args: sanitizeHarnessArgs(config.harnessCommand.args ?? []),
          },
        }
      : {}),
    ...(last && hop ? { last: { at: last.startedAt, purpose: last.purpose, ...hop } } : {}),
  };
  let lastRun = json(join(root, "wiki/_jobs/sync/last-run.json")) as
    | { startedAt?: string; finishedAt?: string; status?: string }
    | undefined;
  if (lastRun?.status === "running") {
    const lease = z
      .object({ active: z.boolean(), pid: z.number().int().positive() })
      .safeParse(json(join(root, "wiki/_jobs/sync/daily-lease.json")));
    if (lease.success) {
      let interrupted = !lease.data.active;
      if (!interrupted)
        try {
          process.kill(lease.data.pid, 0);
        } catch (error) {
          interrupted = (error as NodeJS.ErrnoException).code === "ESRCH";
        }
      if (interrupted) lastRun = { ...lastRun, status: "interrupted" };
    }
  }
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
  const paidWork =
    config && [config.maxTasks, config.reconcileBatches, config.driftSample].some((quota) => quota !== 0);

  const names = loadPages(join(root, "wiki")).pages.map((p) => p.fm);
  const gaps = listGaps(root);
  const terms = collectStepTerms();
  const termEntries = terms.map((term) => {
    const page = findPageByName(names, term);
    return { term, ...(page ? { id: page.id, title: page.title } : {}) };
  });
  const reviews = listReviewSummaries(root);
  return {
    mode: config?.mode ?? "test",
    budget,
    models,
    nightly: config && {
      lastRun,
      maxNewParamPages: config.maxNewParamPages,
      heldBack,
      fetch: config.fetch,
      github: config.github,
      /** 夜间任务会不会自己调模型：要同时有 paid 授权块和大于 0 的配额 */
      spendsMoney: !!config.paid && !!paidWork,
      paidWork: { tasks: config.maxTasks, reconcile: config.reconcileBatches, drift: config.driftSample },
    },
    pages: {
      concepts: pageIds(root, "concepts").length,
      params: pageIds(root, "params").length,
      sources: pageIds(root, "sources").length,
    },
    todo: {
      pendingReviews: reviews.filter((r) => r.state === "pending" || r.state === "publishing").length,
      missingTerms: termEntries.filter((t) => !t.id).map((t) => t.term),
      termEntries,
      totalTerms: terms.length,
      gaps: gaps.filter((g) => g.state !== "closed").length,
      closedGaps: gaps.filter((g) => g.state === "closed").length,
      gapEntries: gaps.map((g) => ({
        key: g.key,
        question: g.question,
        state: g.state,
        count: g.count,
        pendingCount: g.pendingCount,
        threshold: g.threshold,
      })),
      /** 其中合并了不同说法的缺口（判为同一题的问法记成别名，可用 wiki:work split-gap 拆开） */
      mergedGaps: gaps.filter((g) => g.state !== "closed" && g.aliases?.length).length,
      queuedTasks: listTasks(root).filter((t) => t.state === "queued").length,
    },
  };
}
export type WikiStatus = ReturnType<typeof readStatus>;

const optionalUrlField = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    if (!/^https?:\/\//i.test(v) || !URL.canParse(v)) return false;
    const parsed = new URL(v);
    return !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  }, "apiBaseUrl 必须是无凭据、无查询参数的 http/https 地址")
  .optional();

const safeHarnessCommandSchema = harnessCommandSchema.refine(
  (cmd) => !hasSecretHarnessArg(cmd.args),
  "harnessCommand.args 不得包含明文 API 密钥、令牌或含凭据 URL（请改用环境变量）",
);

const modelSelectionSchema = z
  .object({
    chatProvider: z.enum(CHAT_PROVIDERS),
    chatModel: z.string().trim().min(1).max(200).regex(MODEL_ID, "模型名格式不正确"),
    apiBaseUrl: optionalUrlField,
    apiKeyEnv: z
      .string()
      .trim()
      .refine((v) => v === "" || ENV_VAR_NAME_RE.test(v), "apiKeyEnv 必须是合法环境变量名")
      .optional(),
    anthropicVersion: z
      .string()
      .trim()
      .refine((v) => v === "" || ANTHROPIC_VERSION_RE.test(v), "anthropicVersion 格式不正确")
      .optional(),
    claudeCli: z.string().trim().optional(),
    claudeSettingSources: z
      .string()
      .trim()
      .refine((v) => CLAUDE_SETTING_SOURCES_RE.test(v), "claudeSettingSources 格式不正确")
      .optional(),
    codexAllowUserConfig: z.boolean().optional(),
    harnessCommand: safeHarnessCommandSchema.nullable().optional(),
  })
  .strict();

/** Only model & non-secret provider connection fields can be changed from the status panel. Never accepts raw API keys or starts a model. */
export async function saveChatModel(root: string, input: unknown) {
  const selection = modelSelectionSchema.parse(input);
  return new WorkflowStore(root).locked(() => {
    const path = join(root, "wiki/sync.config.local.json");
    const current = (json(path) ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = {
      ...current,
      chatProvider: selection.chatProvider,
      chatModel: selection.chatModel,
    };
    const applyOptionalString = (key: "apiBaseUrl" | "apiKeyEnv" | "anthropicVersion" | "claudeCli") => {
      const value = selection[key];
      if (value === undefined) return;
      if (value === "") delete next[key];
      else next[key] = value;
    };
    applyOptionalString("apiBaseUrl");
    applyOptionalString("apiKeyEnv");
    applyOptionalString("anthropicVersion");
    applyOptionalString("claudeCli");
    if (selection.claudeSettingSources !== undefined) {
      if (selection.claudeSettingSources === "") delete next.claudeSettingSources;
      else next.claudeSettingSources = selection.claudeSettingSources;
    }
    if (selection.codexAllowUserConfig !== undefined) {
      if (!selection.codexAllowUserConfig) delete next.codexAllowUserConfig;
      else next.codexAllowUserConfig = true;
    }
    if (selection.harnessCommand !== undefined) {
      if (selection.harnessCommand === null) delete next.harnessCommand;
      else next.harnessCommand = selection.harnessCommand;
    }
    syncConfigSchema.parse({ ...((json(join(root, "wiki/sync.config.json")) as object) ?? {}), ...next });
    atomicText(path, `${JSON.stringify(next, null, 2)}\n`);
    return selection;
  });
}

export async function handleStatus(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<boolean> {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  const pathname = url.pathname;
  if (pathname === "/api/wiki/status/model") {
    try {
      if (req.method !== "POST") throw new HttpError(405, "需要 POST");
      checkWriter(req);
      send(res, 200, await saveChatModel(root, await readJson(req)));
    } catch (error) {
      send(res, error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 503, {
        error: error instanceof z.ZodError ? "请选择接入方式，并填写有效模型名" : String(error),
      });
    }
    return true;
  }
  if (pathname !== "/api/wiki/status") return false;
  if (req.method !== "GET") send(res, 405, { error: "需要 GET" });
  else
    try {
      checkLocalReader(req);
      send(res, 200, readStatus(root));
    } catch (error) {
      send(res, error instanceof HttpError ? error.status : 503, { error: String(error) });
    }
  return true;
}
