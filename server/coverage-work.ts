import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { z } from "zod";
import { positiveInteger, type RunAgent, runBatch } from "../scripts/wiki/batch";
import { listGaps } from "../scripts/wiki/gap-ledger";
import { CATALOG_MAX, relevantPageIds } from "../scripts/wiki/navigation";
import { parsePage } from "../scripts/wiki/pages";
import { RESTRICTED_PROFILE, restrictedArgs } from "../scripts/wiki/restricted-claude";
import { localFile } from "../scripts/wiki/review-files";
import { sanitizeRawInput } from "../scripts/wiki/sanitize";
import { selectedAgent } from "../scripts/wiki/selected-agent";
import { atomicText, digest, WorkflowStore } from "../scripts/wiki/workflow";
import { type WorkflowPolicy, workflowPolicySchema } from "../scripts/wiki/workflow-policy";
import { retrieve } from "../src/content/wiki/retrieve";
import { type CoverageMaterialOptions, prepareCoverageMaterial } from "./coverage-material";
import { readKnowledgeSnapshot, readKnowledgeSnapshotInLock } from "./snapshot";

/** Text limits bound diagnostic input, not provider billing; native budget flags may overshoot. */
export const COVERAGE_CONTEXT_LIMITS = {
  maxPages: 3,
  maxPageChars: 3000,
  /** 目录只列与问题相关的页（2026-09-23 前是 index.md 截前 8,000 字符，库一大只剩按字母排前面的页） */
  maxCatalogPages: CATALOG_MAX,
  maxInputChars: 24000,
} as const;

export const coverageDecisionSchema = z
  .object({
    satisfied: z.boolean().nullable(),
    classification: z.enum(["covered", "missing-knowledge", "retrieval-miss", "outdated", "undetermined"]),
    reason: z.string().trim().min(1).max(4000),
    evidence: z
      .array(z.object({ pageId: z.string().min(1), quote: z.string().min(1).max(2000) }).strict())
      .max(12),
  })
  .strict()
  .superRefine((decision, ctx) => {
    const expected = ["covered", "retrieval-miss"].includes(decision.classification)
      ? true
      : decision.classification === "undetermined"
        ? null
        : false;
    if (decision.satisfied !== expected) ctx.addIssue({ code: "custom", message: "satisfied 与分类矛盾" });
    const minimum = decision.classification === "outdated" ? 2 : expected === true ? 1 : 0;
    if (decision.evidence.length < minimum)
      ctx.addIssue({ code: "custom", message: "该分类缺少可核对的页面引文" });
  });
const legacyReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: z.string(),
    gapKey: z.string(),
    revision: z.string(),
    observationHash: z.string(),
    decision: coverageDecisionSchema,
  })
  .strict();
const suppliedTextSchema = z
  .object({
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    chars: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();
const receiptValidationSchema = z
  .object({
    evidence: z.literal("exact-quotes-only"),
    reason: z.literal("unverified"),
    classification: z.literal("model-judgment"),
  })
  .strict();
const suppliedPagesSchema = z.array(suppliedTextSchema.extend({ id: z.string().min(1) }));
/** 2026-09-23 前的回执：范围里记的是截断后的 index.md；只读不写 */
const indexScopedReceiptSchema = legacyReceiptSchema.extend({
  schemaVersion: z.literal(2),
  scope: z
    .object({
      kind: z.literal("provided-excerpts"),
      index: suppliedTextSchema,
      pages: suppliedPagesSchema,
      externalSourcesReviewed: z.literal(false),
    })
    .strict(),
  validation: receiptValidationSchema,
});
const scopedReceiptSchema = legacyReceiptSchema.extend({
  schemaVersion: z.literal(3),
  scope: z
    .object({
      kind: z.literal("provided-excerpts"),
      catalog: z
        .object({
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          pages: z.number().int().nonnegative(),
          omitted: z.number().int().nonnegative(),
        })
        .strict(),
      pages: suppliedPagesSchema,
      externalSourcesReviewed: z.literal(false),
    })
    .strict(),
  validation: receiptValidationSchema,
});
const receiptSchema = z.discriminatedUnion("schemaVersion", [
  legacyReceiptSchema,
  indexScopedReceiptSchema,
  scopedReceiptSchema,
]);
const rootPath = (root: string) => localFile(root, "wiki/_jobs/coverage");
const filesOf = (jobId: string) => ({
  input: `_jobs/coverage/${jobId}.input.json`,
  result: `_jobs/coverage/${jobId}.json`,
});

function readReceipt(root: string, job: ReturnType<WorkflowStore["get"]>) {
  const paths = filesOf(job.id);
  for (const path of [paths.input, paths.result]) {
    const file = localFile(root, `wiki/${path}`);
    if (!existsSync(file) || job.artifacts?.[path] !== digest(readFileSync(file)))
      throw new Error("覆盖判定记录已变化，不能复用");
  }
  const receipt = receiptSchema.parse(
    JSON.parse(readFileSync(localFile(root, `wiki/${paths.result}`), "utf8")),
  );
  if (receipt.jobId !== job.id || !job.input.sources.some((s) => s.ref === `coverage-gap:${receipt.gapKey}`))
    throw new Error("覆盖判定 jobId 或缺口不符");
  return receipt;
}

/** History, explicitly scoped to revisions; never claims a gap has been resolved. */
export function listCoverageAssessments(root: string) {
  return new WorkflowStore(root)
    .list()
    .filter(
      (job) =>
        job.origins.includes("gap") && job.input.sources.some((s) => s.ref.startsWith("coverage-gap:")),
    )
    .map((job) => {
      const receipt = job.state === "draft" ? readReceipt(root, job) : undefined;
      return {
        jobId: job.id,
        gapKey: job.input.sources
          .find((s) => s.ref.startsWith("coverage-gap:"))!
          .ref.slice("coverage-gap:".length),
        state: job.state,
        assessment: receipt?.decision.classification ?? "undetermined",
        ...(receipt ? { scopeStatus: receipt.schemaVersion === 1 ? "legacy-unverified" : "recorded" } : {}),
        ...(receipt ? { receipt } : {}),
        attempts: job.attempts,
      };
    });
}

const reviewStatus = {
  covered: "needs-answer-review",
  "retrieval-miss": "needs-retrieval-review",
  "missing-knowledge": "needs-source-and-page-review",
  outdated: "needs-version-review",
  undetermined: "needs-context-review",
} as const;

/** Read-only handoff, never a compile plan. Free-form model reasoning is deliberately not forwarded. */
export async function prepareCoverageReview(
  root: string,
  jobId: string,
  materialOptions?: CoverageMaterialOptions,
) {
  const store = new WorkflowStore(root);
  return store.locked(() => {
    const job = store.get(jobId);
    if (job.state !== "draft" || !job.origins.includes("gap")) throw new Error("不是可核对的覆盖诊断");
    const receipt = readReceipt(root, job);
    if (receipt.schemaVersion === 1) throw new Error("旧版诊断未记录材料范围，不能直接准备补料核对");
    const snapshot = readKnowledgeSnapshotInLock(root);
    if (snapshot.revision !== receipt.revision) throw new Error("知识版本已变化，需重新判定");
    const gap = listGaps(root).find((g) => g.key === receipt.gapKey);
    if (!gap || digest(JSON.stringify(gap.occurrences)) !== receipt.observationHash)
      throw new Error("缺口观察已变化，需重新判定");
    const frozen = JSON.parse(readFileSync(localFile(root, `wiki/${filesOf(job.id).input}`), "utf8"));
    const material = JSON.parse(frozen.stdin).material as { question: string; contextQuestions: string[] };
    return {
      schemaVersion: 1 as const,
      jobId,
      gapKey: receipt.gapKey,
      revision: receipt.revision,
      observationHash: receipt.observationHash,
      question: material.question,
      contextQuestions: material.contextQuestions,
      status: reviewStatus[receipt.decision.classification],
      compilationAllowed: false as const,
      scope: receipt.scope,
      validation: receipt.validation,
      verifiedQuotes: receipt.decision.evidence,
      ...(materialOptions
        ? {
            material: prepareCoverageMaterial(
              root,
              snapshot,
              receipt.scope.pages.map((p) => p.id),
              materialOptions,
              `${material.question}\n${material.contextQuestions.join("\n")}`,
            ),
          }
        : {}),
    };
  });
}

/** One explicitly budgeted diagnostic call. No source fetch, wiki draft, automatic retry or closure. */
export async function assessGap(
  root: string,
  key: string,
  limits: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean; timeoutMs?: number } = {},
) {
  const policy = workflowPolicySchema.parse(limits);
  const timeoutMs = positiveInteger(deps.timeoutMs ?? 60_000, "timeoutMs");
  const gap = listGaps(root).find((gap) => gap.key === key);
  if (!gap || gap.state !== "awaiting-assessment") throw new Error("缺口不存在或尚未达到判定阈值");
  const snapshot = await readKnowledgeSnapshot(root);
  const latest = gap.occurrences.at(-1)!;
  const observationHash = digest(JSON.stringify(gap.occurrences));
  // Fresh retrieval provides bounded diagnostic excerpts, not an exhaustive absence proof.
  const hits = retrieve(`${latest.question}\n${latest.contextQuestions.join("\n")}`, snapshot.index, {
    limit: 5,
    expand: true,
    expansionLimit: 5,
  });
  const pageTextByFile = new Map(snapshot.pageTexts.map((page) => [page.file, page.text]));
  const pages = hits.slice(0, COVERAGE_CONTEXT_LIMITS.maxPages).map((hit) => {
    const entry = snapshot.registry.pages.find((page) => page.id === hit.id);
    const original = entry ? pageTextByFile.get(entry.file) : undefined;
    if (!entry || original === undefined) throw new Error("覆盖判定正文解析失败");
    const parsed = parsePage(entry.file, original);
    if (!parsed.page) throw new Error("覆盖判定正文解析失败");
    const text = parsed.page.body.slice(0, COVERAGE_CONTEXT_LIMITS.maxPageChars);
    return { id: hit.id, text, truncated: text.length < parsed.page.body.length };
  });
  const catalog = relevantPageIds(
    snapshot.index,
    { ids: pages.map((page) => page.id), query: `${latest.question}\n${latest.contextQuestions.join("\n")}` },
    COVERAGE_CONTEXT_LIMITS.maxCatalogPages,
  );
  const payload = {
    question: latest.question,
    contextQuestions: latest.contextQuestions,
    signals: latest.signals,
    originalCandidates: latest.candidates,
    originalCandidatesRecorded: true,
    originalRevision: latest.revision,
    revision: snapshot.revision,
    catalog: catalog.ids.map((id) => {
      const page = snapshot.index.byId.get(id)!;
      return { id, title: page.title, summary: page.summary };
    }),
    catalogOmitted: catalog.omitted,
    pages,
    contextLimits: COVERAGE_CONTEXT_LIMITS,
    scope:
      "相关页目录与有限候选正文摘录；catalogOmitted 是目录外的页数，truncated 表示正文省略了内容。未提供的正文和外部原文未核对，需省略内容才能确认时应保留未判明",
  };
  if (JSON.stringify(payload).length > COVERAGE_CONTEXT_LIMITS.maxInputChars)
    throw new Error("覆盖判定上下文超过上限，请缩短问题或上下文后重新记录");
  // Screen decoded fields: JSON escaping otherwise hides newlines from role detection.
  const fieldFindings: { reason: string }[] = [];
  const cleanedJson = JSON.stringify(payload, (_key, value: unknown) => {
    if (typeof value !== "string") return value;
    const field = sanitizeRawInput(value);
    if (field.blocked)
      throw new Error(`覆盖判定输入清洗阻塞：${field.findings.map((f) => f.reason).join("、")}`);
    fieldFindings.push(...field.findings);
    return field.text;
  });
  const screened = sanitizeRawInput(cleanedJson);
  if (screened.blocked)
    throw new Error(`覆盖判定输入清洗阻塞：${screened.findings.map((f) => f.reason).join("、")}`);
  screened.findings.push(...fieldFindings);
  const clean = JSON.parse(screened.text) as typeof payload;
  // 判定要读懂页面上的证据与版本记号，但不写回答：拿「读页约定 + 覆盖判定」，不拿问答规则
  const rules = `${snapshot.handbook.reading.trim()}\n\n${snapshot.handbook.coverage.trim()}\n`;
  const stdin = JSON.stringify({ mode: "coverage-assessment", material: clean });
  const work = {
    origin: "gap" as const,
    sources: [
      { ref: `coverage-gap:${key}`, hash: observationHash },
      { ref: `knowledge:${snapshot.revision}`, hash: snapshot.revision },
    ],
    targets: [`coverage-${key}`],
    recipeHash: digest(
      JSON.stringify({
        receiptVersion: 3,
        profile: RESTRICTED_PROFILE,
        rules,
        stdin,
        sanitizer: screened.version,
        timeoutMs,
      }),
    ),
  };
  const store = new WorkflowStore(root);
  const assertCurrent = () => {
    if (readKnowledgeSnapshotInLock(root).revision !== snapshot.revision)
      throw new Error("知识版本已变化，判定保留为失败，需重新核对");
    const currentGap = listGaps(root).find((g) => g.key === key);
    if (!currentGap || digest(JSON.stringify(currentGap.occurrences)) !== observationHash)
      throw new Error("缺口观察已变化，需重新判定");
  };
  const job = await store.enqueue(work, policy);
  if (job.state === "draft")
    return store.locked(() => {
      assertCurrent();
      return { ok: true, ...readReceipt(root, job) };
    });
  const attempt = await store.claim(job.id, deps.retry);
  const paths = filesOf(job.id);
  let stage: string | undefined;
  let costUsd: number | undefined = 0;
  let billing: "chatgpt" | "external" | undefined;
  let usage: Record<string, number | undefined> | undefined;
  try {
    mkdirSync(rootPath(root), { recursive: true });
    const requestText = `${JSON.stringify({ gapKey: key, revision: snapshot.revision, observationHash, rules, stdin, screening: { version: screened.version, findings: screened.findings } }, null, 2)}\n`;
    const inputFile = localFile(root, `wiki/${paths.input}`);
    if (existsSync(inputFile) && readFileSync(inputFile, "utf8") !== requestText)
      throw new Error("覆盖判定输入记录已变化");
    if (!existsSync(inputFile)) atomicText(inputFile, requestText);
    stage = mkdtempSync(join(tmpdir(), "wiki-coverage-"));
    costUsd = undefined;
    const batch = await runBatch(
      [
        {
          id: work.targets[0]!,
          ...attempt.selection,
          cwd: stage,
          accountingOnly: attempt.accountingOnly,
          args: restrictedArgs(rules, attempt.budgetUsd),
          stdin,
          timeoutMs,
          allowedWrites: [],
        },
      ],
      { concurrency: 1, runAgent: deps.runAgent ?? selectedAgent(root, "coverage") },
    );
    const result = batch.results[0]!;
    costUsd = result.costUsd;
    billing = result.billing;
    usage = result.usage;
    atomicText(
      localFile(root, `wiki/_jobs/coverage/${job.id}.${attempt.token}.output.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    if (!result.ok) throw new Error(result.reason ?? "覆盖判定调用失败");
    if (!attempt.accountingOnly && costUsd === undefined && !billing)
      throw new Error("覆盖判定费用尚未核实，保留预留额并停止采纳");
    if (readdirSync(stage).length) throw new Error("无工具覆盖判定产生了文件");
    if (Buffer.byteLength(result.output ?? "") > 128_000) throw new Error("覆盖判定输出过长");
    const decision = coverageDecisionSchema.parse(JSON.parse(result.output ?? ""));
    for (const evidence of decision.evidence) {
      const page = clean.pages.find((page) => page.id === evidence.pageId);
      if (!page?.text.includes(evidence.quote)) throw new Error("覆盖判定引用了未提供的页或原文");
    }
    if (
      decision.classification === "covered" &&
      latest.revision === snapshot.revision &&
      latest.candidates.length === 0
    )
      throw new Error("原检索明确为零命中且同版本已有答案，应核对漏检分类，不能当成历史未知");
    if (decision.classification === "retrieval-miss" && latest.revision !== snapshot.revision)
      throw new Error("原问题与当前知识版本不同，不能确认当时漏检");
    if (
      decision.classification === "retrieval-miss" &&
      decision.evidence.every((e) => latest.candidates.some((p) => p.id === e.pageId))
    )
      throw new Error("引用页已在原候选中，不能把它判为漏检");
    if (
      decision.classification === "outdated" &&
      new Set(decision.evidence.map((e) => `${e.pageId}:${e.quote}`)).size < 2
    )
      throw new Error("版本差异需两个不同的引文依据");
    const receipt = scopedReceiptSchema.parse({
      schemaVersion: 3,
      jobId: job.id,
      gapKey: key,
      revision: snapshot.revision,
      observationHash,
      decision,
      scope: {
        kind: "provided-excerpts",
        catalog: {
          hash: digest(JSON.stringify(clean.catalog)),
          pages: clean.catalog.length,
          omitted: clean.catalogOmitted,
        },
        pages: clean.pages.map((page) => ({
          id: page.id,
          hash: digest(page.text),
          chars: page.text.length,
          truncated: page.truncated,
        })),
        externalSourcesReviewed: false,
      },
      validation: { evidence: "exact-quotes-only", reason: "unverified", classification: "model-judgment" },
    });
    const output = `${JSON.stringify(receipt, null, 2)}\n`;
    const finished = await store.finish(
      job.id,
      attempt.token,
      {
        ok: true,
        costUsd,
        billing,
        usage,
        artifacts: { [paths.input]: digest(requestText), [paths.result]: digest(output) },
      },
      () => {
        assertCurrent();
        atomicText(localFile(root, `wiki/${paths.result}`), output);
      },
    );
    return finished.state === "draft"
      ? { ok: true, ...receipt }
      : { ok: false, jobId: job.id, reason: finished.attempts.at(-1)?.reason };
  } catch (error) {
    const finished = await store.finish(job.id, attempt.token, {
      ok: false,
      costUsd,
      billing,
      usage,
      reason: String(error),
    });
    return { ok: false, jobId: job.id, reason: finished.attempts.at(-1)?.reason ?? String(error) };
  } finally {
    try {
      if (stage && existsSync(stage)) {
        const within = relative(realpathSync(tmpdir()), realpathSync(stage));
        if (
          within.startsWith("wiki-coverage-") &&
          !within.includes("..") &&
          !lstatSync(stage).isSymbolicLink()
        )
          rmSync(stage, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("覆盖判定临时目录清理失败", String(error));
    }
  }
}
