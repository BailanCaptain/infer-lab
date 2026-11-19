import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { z } from "zod";
import { judgeAnswer } from "../../server/answer-quality";
import { buildChatRequest, CHAT_TIMEOUT_MS, runChat } from "../../server/chat";
import { retrieveChatContext } from "../../server/chat-route";
import { checkAnswerCitations } from "../../server/citations";
import { codexEvidencePages } from "../../server/codex-chat";
import {
  materializeSnapshot,
  readKnowledgeSnapshot,
  readKnowledgeSnapshotInLock,
  verifySnapshot,
} from "../../server/snapshot";
import type { AnswerQuality } from "../../src/content/wiki/answer-quality";
import { CHAT_PROVIDERS } from "../../src/content/wiki/chat-models";
import { withBudget } from "./budget";
import { listGaps } from "./gap-ledger";
import { MODEL_ID, WORK_MODEL } from "./model-use";
import { readTask } from "./queue";
import { readReview } from "./review";
import { localFile } from "./review-files";
import { selectedModel } from "./sync-config";
import { atomicText, digest, WorkflowStore } from "./workflow";

const caseSchema = z
  .object({
    kind: z.enum(["original", "holdout", "version", "no-evidence"]),
    question: z.string().trim().min(1),
    expected: z.string().trim().min(1),
    forbidden: z.string().trim().min(1),
  })
  .strict();
const planSchema = z
  .object({
    taskId: z.string().regex(/^[a-f0-9]{64}$/),
    beforeRevision: z.string(),
    /** 前测与后测必须同一个模型，所以冻结在计划里；不写就用 WORK_MODEL */
    model: z.string().regex(MODEL_ID).default(WORK_MODEL),
    provider: z.enum(CHAT_PROVIDERS).optional(),
    reserveUsd: z.number().positive().finite(),
    cases: caseSchema.array().length(4),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.cases.map((c) => c.kind)).size === 4 && new Set(p.cases.map((c) => c.question)).size === 4,
    "必须包含四类不同问题",
  );
const pathOf = (root: string, taskId: string, suffix: string) =>
  localFile(
    root,
    `wiki/_jobs/retests/${z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(taskId)}.${suffix}.json`,
  );

export const hasRetestPlan = (root: string, taskId: string) => existsSync(pathOf(root, taskId, "plan"));

/** Freeze holdouts before compilation. Rubrics are operational data excluded from all knowledge snapshots. */
export async function prepareRetest(root: string, input: Omit<z.input<typeof planSchema>, "beforeRevision">) {
  const snapshot = await readKnowledgeSnapshot(root);
  const selection = selectedModel(root);
  if (
    (input.model && input.model !== selection.model) ||
    (input.provider && input.provider !== selection.provider)
  )
    throw new Error("复测模型必须与状态中的全局选择一致");
  const plan = planSchema.parse({ ...input, ...selection, beforeRevision: snapshot.revision });
  const task = readTask(root, plan.taskId);
  if (task.input.kind !== "gap" || task.result?.compilationStarted || task.state === "closed")
    throw new Error("必须在缺口补写前冻结复测问题");
  const gapInput = task.input;
  const gap = listGaps(root).find((g) => g.key === gapInput.key)!;
  if (plan.cases.find((c) => c.kind === "original")!.question !== gap.question)
    throw new Error("原问题不匹配缺口记录");
  for (const c of plan.cases.filter((c) => c.kind !== "original"))
    if (snapshot.pageTexts.some((p) => p.text.includes(c.question)))
      throw new Error("留出问题已泄漏进知识正文");
  return new WorkflowStore(root).locked(() => {
    const current = readTask(root, plan.taskId);
    if (
      current.state === "running" ||
      current.result?.compilationStarted ||
      current.state === "closed" ||
      readKnowledgeSnapshotInLock(root).revision !== plan.beforeRevision
    )
      throw new Error("必须在稳定基线及缺口补写前冻结计划");
    const path = pathOf(root, task.id, "plan");
    const bytes = JSON.stringify(plan);
    if (existsSync(path) && readFileSync(path, "utf8") !== bytes) throw new Error("复测计划不能事后改写");
    mkdirSync(localFile(root, "wiki/_jobs/retests"), { recursive: true });
    atomicText(path, bytes);
    if (current.state === "needs-review" && current.result?.phase === "retest-plan") {
      current.state = "queued";
      atomicText(localFile(root, `wiki/_jobs/queue/${current.id}.json`), JSON.stringify(current, null, 2));
    }
    return plan;
  });
}
export async function runRetest(
  root: string,
  taskId: string,
  reviewId?: string,
  execute: typeof runChat = runChat,
) {
  const plan = planSchema.parse(JSON.parse(readFileSync(pathOf(root, taskId, "plan"), "utf8")));
  const selection = selectedModel(root);
  if (selection.provider !== (plan.provider ?? "claude") || selection.model !== plan.model)
    throw new Error("全局模型已变化，不能混用模型进行前后复测；请使用原模型或建立新的复测计划");
  const phase = reviewId ? "after" : "before";
  const review = reviewId ? readReview(root, reviewId) : undefined;
  if (review && review.state !== "published") throw new Error("复测前必须已批准发布");
  const task = readTask(root, taskId);
  if (
    review &&
    (!task.result?.draftId ||
      ![...review.payload.decision.promoted, ...review.payload.decision.merged.map((m) => m.from)].includes(
        String(task.result.draftId),
      ))
  )
    throw new Error("批准包未包含该缺口草稿");
  const snapshot = await readKnowledgeSnapshot(root);
  if (phase === "after" && snapshot.revision === plan.beforeRevision) throw new Error("知识版本没有变化");
  if (phase === "before" && snapshot.revision !== plan.beforeRevision)
    throw new Error("基线版本已变化，不能事后补做基线");
  const location = await materializeSnapshot(root, snapshot);
  const results = [];
  for (const c of plan.cases) {
    const path = pathOf(root, taskId, `${phase}-${c.kind}`);
    const cached = await new WorkflowStore(root).locked(() => {
      if (existsSync(path)) {
        const old = JSON.parse(readFileSync(path, "utf8"));
        if (
          old.revision !== snapshot.revision ||
          old.reviewId !== reviewId ||
          old.planHash !== digest(JSON.stringify(plan))
        )
          throw new Error("复测已绑定其他版本，不自动重试收费");
        if (!old.outcome?.ok) throw new Error("该独立调用未成功或中断，禁止自动重试收费");
        return old;
      }
      atomicText(
        path,
        JSON.stringify({
          revision: snapshot.revision,
          reviewId,
          planHash: digest(JSON.stringify(plan)),
          state: "started",
        }),
      );
      return undefined;
    });
    if (cached) {
      results.push(cached);
      continue;
    }
    const context = retrieveChatContext(c.question, snapshot);
    const pages =
      selection.provider !== "claude"
        ? codexEvidencePages(
            snapshot.pageTexts.filter((p) =>
              snapshot.registry.pages.some(
                (r) => r.file === p.file && context.hits.some((h) => h.id === r.id),
              ),
            ),
          )
        : snapshot.pageTexts;
    const req = buildChatRequest({ message: c.question, ...context }, snapshot.handbook, {
      wikiRoot: location,
      revision: snapshot.revision,
      timeoutMs: CHAT_TIMEOUT_MS,
      ...selection,
      pages,
      ...(selection.provider === "claude"
        ? { control: { model: plan.model, maxCostUsd: plan.reserveUsd } }
        : {}),
    });
    let answer = "";
    let executeStarted = false;
    let outcome: Awaited<ReturnType<typeof runChat>>;
    try {
      outcome = await withBudget(root, "independent-retest", req, (bounded) => {
        executeStarted = true;
        return execute(bounded, {
          text: (text) => {
            answer += text;
          },
        });
      });
    } catch (error) {
      // Admission can reject before the runner is invoked. Preserve that receipt,
      // but allow the same frozen case to start once budget is available.
      // A runner failure keeps its started marker and remains non-retryable.
      if (!executeStarted)
        await new WorkflowStore(root).locked(() => {
          atomicText(
            `${path}.admission-rejected-${randomUUID()}.json`,
            JSON.stringify({
              ...JSON.parse(readFileSync(path, "utf8")),
              state: "admission-rejected",
              reason: String(error),
            }),
          );
          renameSync(path, `${path}.unstarted-${randomUUID()}.json`);
        });
      throw error;
    }
    verifySnapshot(root, location, snapshot);
    let quality: AnswerQuality = { status: "unavailable", reason: "作答未成功，未启动评判" };
    if (outcome.ok && answer.trim()) {
      try {
        quality = await judgeAnswer(root, {
          question: c.question,
          contextQuestions: [],
          answer,
          snapshot,
          evidencePages: pages,
          selection,
        });
      } catch (error) {
        quality = { status: "unavailable", reason: String(error) };
      }
    }
    const result = {
      kind: c.kind,
      question: c.question,
      answer,
      outcome,
      citations: checkAnswerCitations(answer, pages),
      revision: snapshot.revision,
      reviewId,
      planHash: digest(JSON.stringify(plan)),
      semanticStatus: "needs-human-review",
      quality,
    };
    atomicText(path, JSON.stringify(result, null, 2));
    results.push(result);
    if (!outcome.ok) throw new Error("复测失败；保留回执，不自动关闭缺口");
  }
  return {
    taskId,
    results,
    semanticStatus: "needs-human-review",
    note: "四个独立会话的实际答案已存档；需按冻结判准核对事实、引用、版本与反例，不能仅凭引用格式关闭",
  };
}
export async function acceptRetest(
  root: string,
  taskId: string,
  input: {
    reviewer: string;
    cases: { kind: z.infer<typeof caseSchema>["kind"]; passed: boolean; evidence: string }[];
  },
) {
  const checked = z
    .object({
      reviewer: z.string().trim().min(1),
      cases: z
        .array(
          z
            .object({ kind: caseSchema.shape.kind, passed: z.boolean(), evidence: z.string().trim().min(1) })
            .strict(),
        )
        .length(4),
    })
    .strict()
    .parse(input);
  if (new Set(checked.cases.map((c) => c.kind)).size !== 4) throw new Error("复核需覆盖四类问题");
  return new WorkflowStore(root).locked(() => {
    const snapshot = readKnowledgeSnapshotInLock(root);
    const plan = planSchema.parse(JSON.parse(readFileSync(pathOf(root, taskId, "plan"), "utf8")));
    const planHash = digest(JSON.stringify(plan));
    const task = readTask(root, taskId);
    const hashes: Record<string, string> = {};
    for (const c of checked.cases) {
      const bytes = readFileSync(pathOf(root, taskId, `after-${c.kind}`), "utf8");
      const result = JSON.parse(bytes);
      if (
        !result.outcome.ok ||
        result.revision !== snapshot.revision ||
        result.planHash !== planHash ||
        result.kind !== c.kind
      )
        throw new Error("复测未成功或知识版本已变化");
      if (c.passed && !result.citations?.cited) throw new Error("引用检查未通过，不能标记验收通过");
      const baseline = readFileSync(pathOf(root, taskId, `before-${c.kind}`), "utf8");
      const prior = JSON.parse(baseline);
      if (
        !prior.outcome?.ok ||
        prior.planHash !== planHash ||
        prior.revision !== plan.beforeRevision ||
        prior.revision === result.revision
      )
        throw new Error("缺少同配置独立基线对照");
      hashes[c.kind] = digest(bytes);
      hashes[`before-${c.kind}`] = digest(baseline);
    }
    const record = { ...checked, hashes, revision: snapshot.revision, acceptedAt: new Date().toISOString() };
    atomicText(pathOf(root, taskId, "review"), JSON.stringify(record, null, 2));
    task.state = checked.cases.every((c) => c.passed) ? "closed" : "needs-review";
    task.result = {
      ...task.result,
      retestReviewHash: digest(JSON.stringify(record)),
      closureBasis: "explicit-semantic-review",
      closureObservationCount:
        task.input.kind === "gap"
          ? (listGaps(root).find((g) => task.input.kind === "gap" && g.key === task.input.key)?.count ?? 0)
          : 0,
    };
    atomicText(localFile(root, `wiki/_jobs/queue/${task.id}.json`), JSON.stringify(task, null, 2));
    return task;
  });
}
