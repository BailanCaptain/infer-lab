import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import type { RunAgent } from "../scripts/wiki/batch";
import {
  compileRaw,
  type ExpectedAnswerRecord,
  planRawCompile,
  verifyAnswerRecordRaw,
} from "../scripts/wiki/compile-raw";
import { loadHandbook } from "../scripts/wiki/handbook";
import { localDate } from "../scripts/wiki/ingest";
import { validateIntegration } from "../scripts/wiki/integration-check";
import { prepareSourceReview } from "../scripts/wiki/integration-run";
import { type ModelUse, modelUseSchema } from "../scripts/wiki/model-use";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { configuredRepoRoots } from "../scripts/wiki/repo-roots";
import { listReviews, readReview } from "../scripts/wiki/review";
import { localFile } from "../scripts/wiki/review-files";
import { selectedAgent } from "../scripts/wiki/selected-agent";
import { isProduction, selectedModel } from "../scripts/wiki/sync-config";
import { atomicText, digest, WorkflowStore, workIdentity } from "../scripts/wiki/workflow";
import { citedPageLinks, matchesCitedPage } from "../src/content/wiki/retrieve";
import { checkAnswerCitations } from "./citations";
import { checkWriter, HttpError, parseWikiUrl, readJson, send } from "./http";
import { type ToolEvidenceV1, toolEvidenceV1Schema, verifyToolEvidence } from "./tool-evidence";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const answerReceiptV1Schema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    question: z.string().min(1),
    answer: z.string().min(1),
    pages: z.array(z.object({ file: z.string(), text: z.string() })).min(1),
    /** 实际作答模型；2026-09-23 晚加这项之前的记录没有 */
    model: modelUseSchema.optional(),
  })
  .strict();
export const answerReceiptV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    question: z.string().min(1),
    answer: z.string().min(1),
    pages: z.array(z.object({ file: z.string(), text: z.string() })).min(1),
    /** 实际作答模型 */
    model: modelUseSchema.optional(),
    toolEvidence: z.array(toolEvidenceV1Schema).min(1),
  })
  .strict();
export const receiptSchema = z.union([answerReceiptV2Schema, answerReceiptV1Schema]);
export type AnswerReceiptV1 = z.infer<typeof answerReceiptV1Schema>;
export type AnswerReceiptV2 = z.infer<typeof answerReceiptV2Schema>;
export type AnswerReceipt = z.infer<typeof receiptSchema>;

export function verifyAnswerReceipt(id: string, rawReceipt: unknown): AnswerReceipt {
  const receipt = receiptSchema.parse(rawReceipt);
  if (digest(JSON.stringify(receipt)) !== id) {
    throw new Error("回答记录已改变（digest mismatch），不能保存");
  }
  if (receipt.schemaVersion === 2) {
    for (const item of receipt.toolEvidence) {
      const check = verifyToolEvidence(item);
      if (!check.ok) {
        throw new Error(`回答记录工具证据校验失败（${check.reason}），不能保存`);
      }
    }
  }
  return receipt;
}
const supersedesSchema = z
  .object({
    jobId: hash,
    rejectedReviews: z.array(hash).optional(),
  })
  .strict();
const previousMappingSchema = z
  .object({
    jobId: hash,
    rulesHash: hash,
    mappingHash: hash,
    archivedPath: z
      .string()
      .regex(/^wiki\/_jobs\/answer-saves\/history\/[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}\.json$/),
    replacedAt: z.string(),
    rejectedReviewId: hash.optional(),
  })
  .strict();
const mappingSchema = z
  .object({
    jobId: hash,
    budgetUsd: z.number().positive(),
    raw: z.string(),
    rules: z.string(),
    supersedes: supersedesSchema.optional(),
    previousMappings: z.array(previousMappingSchema).optional(),
  })
  .strict();
export const saveAnswerInput = z
  .object({
    budgetUsd: z.number().finite().positive().optional(),
    retry: z.boolean().optional(),
    newAttempt: z.boolean().optional(),
  })
  .strict();
const recordPath = (id: string) => `wiki/_jobs/answers/${hash.parse(id)}.json`;
const mappingPath = (id: string) => `wiki/_jobs/answer-saves/${hash.parse(id)}.json`;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function expectedAnswerRecord(receipt: AnswerReceipt): ExpectedAnswerRecord {
  return {
    question: receipt.question,
    answer: receipt.answer,
    citedPages: receipt.pages,
    ...(receipt.schemaVersion === 2 ? { toolEvidence: receipt.toolEvidence } : {}),
  };
}

function buildAnswerCompileRules(root: string, receipt: AnswerReceipt): string {
  const context = [
    receipt.question,
    receipt.answer,
    ...receipt.pages.map((p) => `${p.file}\n${p.text}`),
    ...(receipt.schemaVersion === 2 ? receipt.toolEvidence.map((ev) => ev.summary) : []),
  ].join("\n");
  return loadHandbook(join(root, "wiki"), context, true).pageFormat;
}

function evaluateExistingMapping(
  root: string,
  store: WorkflowStore,
  id: string,
  receipt: z.infer<typeof receiptSchema>,
  answerPages: string[],
  old: z.infer<typeof mappingSchema>,
) {
  const expected = expectedAnswerRecord(receipt);
  verifyAnswerRecordRaw(root, old.raw, expected);
  const oldReviews = listReviews(root).filter(
    (r) => r.payload.base[`wiki/_jobs/${old.jobId}.json`] !== undefined,
  );
  const activeReview = oldReviews.find((r) => r.state !== "rejected");
  const rejectedReviewIds = oldReviews.filter((r) => r.state === "rejected").map((r) => r.id);
  const hasRejectedReview = rejectedReviewIds.length > 0;
  const hasFormalPage = existsSync(localFile(root, `wiki/sources/answer-${id}.md`));
  const oldJob = store.list().find((job) => job.id === old.jobId);
  const hasStartedModelOrDraft =
    oldJob?.state !== "failed" ||
    oldJob.attempts.length === 0 ||
    existsSync(localFile(root, `wiki/_drafts/answer-${id}.md`)) ||
    oldJob.attempts.some(
      (a) =>
        (a.costUsd ?? 0) > 0 ||
        a.usage !== undefined ||
        existsSync(localFile(root, `wiki/_jobs/compilations/${old.jobId}.${a.token}.input.json`)) ||
        existsSync(localFile(root, `wiki/_jobs/compilations/${old.jobId}.${a.token}.output.json`)),
    );
  const rules = buildAnswerCompileRules(root, receipt);
  const basePlanned = planRawCompile(root, {
    id: `answer-${id}`,
    origin: "chat",
    source: old.raw,
    rules,
    timeoutMs: 10 * 60_000,
    purpose: "answer-record",
    answerPages,
    expectedAnswerRecord: expected,
  });
  const { id: basePlannedJobId } = workIdentity(basePlanned.work);
  const limits = oldJob && "maxAttempts" in oldJob.policy ? oldJob.policy : undefined;
  const charged = oldJob
    ? oldJob.attempts.reduce((sum, a) => sum + (a.billing ? 0 : (a.costUsd ?? a.reservedUsd)), 0)
    : 0;
  const subscription = selectedModel(root).provider !== "claude";
  const attemptsExhausted = Boolean(limits && oldJob && oldJob.attempts.length >= limits.maxAttempts);
  const budgetExhausted = Boolean(
    limits && oldJob && !subscription && charged + limits.reserveUsd > limits.maxCostUsd + 1e-9,
  );
  const exhausted = attemptsExhausted || budgetExhausted;
  const canNewAttempt =
    !activeReview &&
    !hasFormalPage &&
    oldJob?.state !== "running" &&
    oldJob?.state !== "integrated" &&
    (hasRejectedReview ||
      (oldJob?.state === "failed" &&
        (!hasStartedModelOrDraft || exhausted || basePlannedJobId !== old.jobId)));
  return {
    activeReview,
    rejectedReviewIds,
    hasRejectedReview,
    hasFormalPage,
    oldJob,
    hasStartedModelOrDraft,
    rules,
    basePlanned,
    basePlannedJobId,
    attemptsExhausted,
    budgetExhausted,
    exhausted,
    canNewAttempt,
  };
}

function inspectAnswerSaveRecovery(
  root: string,
  id: string,
): { canNewAttempt: boolean; budgetUsd: number; rejectedReviewId?: string } | undefined {
  try {
    const mapFile = localFile(root, mappingPath(id));
    const recFile = localFile(root, recordPath(id));
    if (!existsSync(mapFile) || !existsSync(recFile)) return undefined;
    const old = mappingSchema.parse(JSON.parse(readFileSync(mapFile, "utf8")));
    const receipt = verifyAnswerReceipt(id, JSON.parse(readFileSync(recFile, "utf8")));
    const answerPages = receipt.pages.map((p) => p.file.split("/").at(-1)!.slice(0, -3)).sort();
    const state = evaluateExistingMapping(root, new WorkflowStore(root), id, receipt, answerPages, old);
    return {
      canNewAttempt: state.canNewAttempt,
      budgetUsd: old.budgetUsd,
      ...(state.rejectedReviewIds.length ? { rejectedReviewId: state.rejectedReviewIds.at(-1)! } : {}),
    };
  } catch {
    return undefined;
  }
}

/** Called only for a complete successful server answer, never with client-supplied replacement text. */
export async function captureAnswer(
  root: string,
  question: string,
  answer: string,
  pages: { file: string; text: string }[],
  model?: ModelUse,
  toolEvidence?: ToolEvidenceV1[],
): Promise<string | undefined> {
  if (!checkAnswerCitations(answer, pages).cited) return undefined;
  const links = citedPageLinks(answer);
  const selected = pages.filter((p) => links.some((href) => matchesCitedPage(href, p.file)));
  if (!selected.length || Buffer.byteLength(answer) > 128 * 1024) return undefined;
  const sortedPages = selected.sort((a, b) => a.file.localeCompare(b.file));
  let record: AnswerReceipt;
  if (toolEvidence && toolEvidence.length > 0) {
    const verifiedEvidence: ToolEvidenceV1[] = [];
    for (const item of toolEvidence) {
      const check = verifyToolEvidence(item);
      if (!check.ok) throw new Error(`回答工具证据校验失败（${check.reason}）`);
      verifiedEvidence.push(check.evidence);
    }
    record = answerReceiptV2Schema.parse({
      schemaVersion: 2,
      question,
      answer,
      pages: sortedPages,
      ...(model ? { model } : {}),
      toolEvidence: verifiedEvidence,
    });
  } else {
    record = answerReceiptV1Schema.parse({
      schemaVersion: 1,
      question,
      answer,
      pages: sortedPages,
      ...(model ? { model } : {}),
    });
  }
  if (Buffer.byteLength(json(record)) > 900 * 1024) return undefined;
  const id = digest(JSON.stringify(record));
  return new WorkflowStore(root).locked(() => {
    if (listReviews(root).some((r) => r.state === "publishing")) return undefined;
    for (const page of selected) {
      const source = localFile(root, `wiki/${page.file}`);
      if (!existsSync(source) || readFileSync(source, "utf8") !== page.text) return undefined;
    }
    const path = localFile(root, recordPath(id));
    mkdirSync(join(root, "wiki/_jobs/answers"), { recursive: true });
    if (!existsSync(path)) atomicText(path, json(record));
    return id;
  });
}

export async function saveAnswer(
  root: string,
  id: string,
  input: z.infer<typeof saveAnswerInput>,
  deps: { runAgent?: RunAgent } = {},
) {
  const checked = saveAnswerInput.parse(input);
  const production = isProduction(root);
  const existingMappingFile = localFile(root, mappingPath(id));
  if (
    !production &&
    selectedModel(root).provider === "claude" &&
    checked.budgetUsd === undefined &&
    !existsSync(existingMappingFile)
  )
    throw new Error("Claude 编译需要本次美元预算");
  const receipt = verifyAnswerReceipt(id, JSON.parse(readFileSync(localFile(root, recordPath(id)), "utf8")));
  const citations = checkAnswerCitations(receipt.answer, receipt.pages);
  if (!citations.cited) throw new Error(`回答引用检查未通过：${citations.reason}`);
  const store = new WorkflowStore(root);
  const answerPages = receipt.pages.map((p) => p.file.split("/").at(-1)!.slice(0, -3)).sort();
  const expected = expectedAnswerRecord(receipt);
  const mapping = await store.locked((): z.infer<typeof mappingSchema> => {
    const path = localFile(root, mappingPath(id));
    if (existsSync(path)) {
      const oldRaw = readFileSync(path, "utf8");
      const old = mappingSchema.parse(JSON.parse(oldRaw));
      if (!production && checked.budgetUsd !== undefined && old.budgetUsd !== checked.budgetUsd)
        throw new Error("已有保存任务的预算不能更改或重置");
      verifyAnswerRecordRaw(root, old.raw, expected);
      if (!checked.newAttempt) return old;
      const evaluated = evaluateExistingMapping(root, store, id, receipt, answerPages, old);
      if (evaluated.activeReview) throw new Error("已有待审或已处理保存结果，不能重建保存映射");
      if (evaluated.hasFormalPage) throw new Error("正式问答来源页已存在，不能重建保存映射");
      if (evaluated.oldJob?.state === "running") throw new Error("正在编译这条回答，请稍后查看");
      if (evaluated.oldJob?.state === "integrated") throw new Error("该保存任务已整合发布，不能重建保存映射");
      if (!evaluated.canNewAttempt)
        throw new Error("已有模型调用或草稿记录，不能重建保存映射；请在原任务上显式重试");

      const { rejectedReviewIds, hasRejectedReview, rules, basePlanned, basePlannedJobId } = evaluated;
      const supersedes =
        basePlannedJobId === old.jobId || hasRejectedReview
          ? {
              jobId: old.jobId,
              ...(rejectedReviewIds.length ? { rejectedReviews: rejectedReviewIds } : {}),
            }
          : undefined;
      const planned = supersedes
        ? planRawCompile(root, {
            id: `answer-${id}`,
            origin: "chat",
            source: old.raw,
            rules,
            timeoutMs: 10 * 60_000,
            purpose: "answer-record",
            answerPages,
            expectedAnswerRecord: expected,
            supersedes,
          })
        : basePlanned;
      const { id: jobId } = workIdentity(planned.work);
      let archivedEntry: z.infer<typeof previousMappingSchema> | undefined;
      if (jobId !== old.jobId) {
        const mappingHash = digest(oldRaw);
        const archivedPath = `wiki/_jobs/answer-saves/history/${id}.${old.jobId}.${mappingHash}.json`;
        mkdirSync(join(root, "wiki/_jobs/answer-saves/history"), { recursive: true });
        const archivedAbs = localFile(root, archivedPath);
        if (!existsSync(archivedAbs)) atomicText(archivedAbs, oldRaw);
        archivedEntry = {
          jobId: old.jobId,
          rulesHash: digest(old.rules),
          mappingHash,
          archivedPath,
          replacedAt: new Date().toISOString(),
          ...(rejectedReviewIds.length ? { rejectedReviewId: rejectedReviewIds.at(-1)! } : {}),
        };
      }
      const previousMappings = [...(old.previousMappings ?? []), ...(archivedEntry ? [archivedEntry] : [])];
      const next = {
        jobId,
        budgetUsd: old.budgetUsd,
        raw: planned.prepared.receipt.source,
        rules,
        ...(supersedes ? { supersedes } : {}),
        ...(previousMappings.length ? { previousMappings } : {}),
      };
      atomicText(path, json(next));
      return next;
    }
    if (!production && selectedModel(root).provider === "claude" && checked.budgetUsd === undefined)
      throw new Error("Claude 编译需要本次美元预算");
    const bundle = json({
      kind: "answer-record",
      question: receipt.question,
      answer: receipt.answer,
      citedPages: receipt.pages,
      ...(receipt.schemaVersion === 2 ? { toolEvidence: receipt.toolEvidence } : {}),
    });
    const raw = saveRawSnapshot(join(root, "wiki"), bundle);
    const rules = buildAnswerCompileRules(root, receipt);
    const planned = planRawCompile(root, {
      id: `answer-${id}`,
      origin: "chat",
      source: `raw:${raw.slice(4)}#L1-L${bundle.trimEnd().split("\n").length}`,
      rules,
      timeoutMs: 10 * 60_000,
      purpose: "answer-record",
      answerPages,
      expectedAnswerRecord: expected,
    });
    // Job identity follows the existing canonical input ordering, including the frozen recipe.
    const { id: jobId } = workIdentity(planned.work);
    const value = { jobId, budgetUsd: checked.budgetUsd ?? 1, raw: planned.prepared.receipt.source, rules };
    mkdirSync(join(root, "wiki/_jobs/answer-saves"), { recursive: true });
    atomicText(path, json(value));
    return value;
  });
  const priorReviews = listReviews(root).filter(
    (r) => r.payload.base[`wiki/_jobs/${mapping.jobId}.json`] !== undefined,
  );
  const activeReview = priorReviews.find((r) => r.state !== "rejected");
  if (activeReview) return { jobId: mapping.jobId, reviewId: activeReview.id, state: activeReview.state };
  const rejectedReview = priorReviews.at(-1);
  if (rejectedReview) {
    if (checked.retry) {
      throw new Error(
        `原保存审阅 ${rejectedReview.id} 已被退回；原审阅与缓存已封存保留，请显式传 newAttempt: true 发起新编译尝试`,
      );
    }
    return { jobId: mapping.jobId, reviewId: rejectedReview.id, state: rejectedReview.state };
  }
  const policy = { maxAttempts: 2, maxCostUsd: mapping.budgetUsd, reserveUsd: mapping.budgetUsd / 2 };
  const existing = store.list().find((job) => job.id === mapping.jobId);
  if (existing?.state === "running") throw new Error("正在编译这条回答，请稍后查看");
  if (!checked.retry && existing?.state === "failed") {
    const state = evaluateExistingMapping(root, store, id, receipt, answerPages, mapping);
    if (state.attemptsExhausted) {
      throw new Error("已达到尝试次数上限；原失败记录已保留，如需恢复请重新生成待审稿");
    }
    if (state.budgetExhausted) {
      throw new Error("剩余预算不足；未知费用仍保留预留额度，如需恢复请重新生成待审稿");
    }
  }
  const result =
    existing?.state === "draft" && store.matchesDraft(existing, `answer-${id}`)
      ? { ok: true, jobId: existing.id, reason: "复用草稿" }
      : await compileRaw(
          store,
          {
            id: `answer-${id}`,
            origin: "chat",
            source: mapping.raw,
            rules: mapping.rules,
            timeoutMs: 10 * 60_000,
            purpose: "answer-record",
            answerPages,
            expectedAnswerRecord: expected,
            ...(mapping.supersedes ? { supersedes: mapping.supersedes } : {}),
          },
          policy,
          {
            runAgent: deps.runAgent ?? selectedAgent(root, "answer-compile"),
            retry: checked.retry,
          },
        );
  if (!result.ok) throw new Error(result.reason ?? "编译失败；原回答和任务记录已保留");
  const roots = configuredRepoRoots(root);
  const proposal = await prepareSourceReview(
    root,
    `answer-${id}`,
    localDate(),
    (stage) => validateIntegration(stage, roots),
    roots,
  );
  return {
    jobId: result.jobId!,
    reviewId: proposal.reviewId,
    state: readReview(root, proposal.reviewId).state,
  };
}

export async function handleAnswers(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  deps: { runAgent?: RunAgent } = {},
): Promise<boolean> {
  const url = parseWikiUrl(req, res);
  if (!url) return true;
  const path = url.pathname;
  if (!path.startsWith("/api/wiki/answers/")) return false;
  const match = /^\/api\/wiki\/answers\/([a-f0-9]{64})\/save$/.exec(path);
  try {
    if (!match) throw new HttpError(400, "需要合法的回答标识");
    if (req.method !== "POST") throw new HttpError(405, "需要 POST");
    checkWriter(req);
    const input = saveAnswerInput.parse(await readJson(req));
    send(res, 200, await saveAnswer(root, match[1]!, input, deps));
  } catch (error) {
    const recovery = match?.[1] ? inspectAnswerSaveRecovery(root, match[1]) : undefined;
    send(
      res,
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : (error as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : 409,
      {
        error: String(error),
        ...(recovery
          ? {
              canNewAttempt: recovery.canNewAttempt,
              budgetUsd: recovery.budgetUsd,
              ...(recovery.rejectedReviewId ? { rejectedReviewId: recovery.rejectedReviewId } : {}),
            }
          : {}),
      },
    );
  }
  return true;
}
