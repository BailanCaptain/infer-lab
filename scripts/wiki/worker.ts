import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { assessGap, prepareCoverageReview } from "../../server/coverage-work";
import { readKnowledgeSnapshot } from "../../server/snapshot";
import { sourceLines } from "./audit";
import type { RunAgent } from "./batch";
import { COMPILE_TIMEOUT_MS, compileRaw } from "./compile-raw";
import { readCorpus } from "./corpus";
import { prepareDraftReview } from "./draft-review";
import { listGaps } from "./gap-ledger";
import { findGapSources } from "./gap-sources";
import { loadHandbook } from "./handbook";
import { prMaterial } from "./pr-material";
import { prepareRawInput } from "./prepare-input";
import { type QueueTask, readTask, runTask } from "./queue";
import { saveRawSnapshot } from "./raw";
import { hasRetestPlan, runRetest } from "./retest";
import { isEmptyReview, readReview } from "./review";
import { localFile } from "./review-files";
import { selectedAgent } from "./selected-agent";
import { PAGE_TEXT_TIMEOUT_MS, runStructured } from "./structured";
import { digest, WorkflowStore } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

/**
 * 夜间任务该不该捡起这个任务：排队中的；审阅已发布、要复测或关闭的；审阅被驳回、还没按这次驳回重编过的。
 * 最后一种是 2026-09-23 补的——此前驳回后任务永久停在 needs-review（PR 11953 就这样卡着）。
 */
export function workerDue(root: string, task: QueueTask): boolean {
  if (task.state === "queued") return true;
  if (task.state === "running" && task.lease) {
    try {
      process.kill(task.lease.pid, 0);
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH";
    }
  }
  if (task.state !== "needs-review" || typeof task.result?.reviewId !== "string") return false;
  const review = readReview(root, task.result.reviewId);
  return (
    review.state === "published" || (review.state === "rejected" && task.result.recompiledAfter !== review.id)
  );
}

/**
 * 补写决定必须绑定到提供的补料原文上。模型写 source 时会在引用后面加备注（2026-09-23 真实缺口就这样），
 * 引文也常跨行——归档格式每行正文前都有一行定位，整段 includes 必然失败。所以：source 里含有某份材料的
 * 引用就算绑定到它；引文按行核，每一行都得逐字出现在那份材料里，编造的句子过不去。
 */
export function boundSource<T extends { content: { source: string; lines: { text: string }[] } }>(
  sources: T[],
  decision: { source: string; quote: string },
): T | undefined {
  const source = sources.find((s) => decision.source.includes(s.content.source));
  if (!source) return undefined;
  const text = source.content.lines.map((l) => l.text).join("\n");
  const lines = decision.quote
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length && lines.every((l) => text.includes(l)) ? source : undefined;
}

export async function workOne(
  root: string,
  taskId: string,
  policy: WorkflowPolicy,
  options: {
    sources?: string[];
    pages?: string[];
    prFiles?: string[];
    timeoutMs?: number;
    retry?: boolean;
  } = {},
  deps: { runAgent?: RunAgent; runChat?: typeof import("../../server/chat").runChat } = {},
) {
  const timeoutMs = options.timeoutMs ?? COMPILE_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600_000)
    throw new Error("worker timeout-ms 需要 1000–600000 毫秒");
  return runTask(
    root,
    taskId,
    async (task) => {
      // 上一版草稿被驳回：带着驳回原因重编一次（编译输入因此不同，不会拿回旧缓存）
      let rejected: { id: string; reason: string } | undefined;
      if (typeof task.result?.reviewId === "string") {
        const review = readReview(root, task.result.reviewId);
        if (review.state === "rejected") {
          if (task.input.kind === "rewrite" && isEmptyReview(review))
            return { state: "closed", result: { ...task.result, closureBasis: "no-publishable-change" } };
          // 已按这次驳回重编过、结果仍是这份被驳回的审阅：停下等人，不再自动收费
          if (task.result.recompiledAfter === review.id)
            return { state: "needs-review", result: task.result };
          rejected = { id: review.id, reason: review.reason ?? "" };
        } else if (review.state !== "published") return { state: "needs-review", result: task.result };
      }
      if (!rejected && typeof task.result?.reviewId === "string") {
        const review = readReview(root, task.result.reviewId);
        if (task.input.kind !== "gap")
          return { state: "closed", result: { ...task.result, closureBasis: "human-published" } };
        await runRetest(root, task.id, review.id, deps.runChat);
        return {
          state: "awaiting-retest",
          result: {
            ...task.result,
            next: `wiki:retest accept --task ${task.id} --input <逐题人工复核.json>`,
          },
        };
      }
      const runner = deps.runAgent ?? selectedAgent(root, "worker-compile");
      const store = new WorkflowStore(root);
      let id: string;
      let source: string;
      let why: string;
      if (task.input.kind === "gap") {
        const assessed = await assessGap(root, task.input.key, policy, {
          runAgent: deps.runAgent,
          retry: options.retry,
        });
        if (!assessed.ok || !("decision" in assessed))
          throw new Error("reason" in assessed ? assessed.reason : "诊断失败");
        const classification = assessed.decision.classification;
        if (["covered", "retrieval-miss"].includes(classification))
          return {
            state: "needs-review",
            result: {
              assessment: assessed.jobId,
              classification,
              compilationStarted: false,
              reason: "先核对现有证据与检索关系，不生成重复新页",
            },
          };
        // 「未判明」是诚实的诊断：候选正文有截断时不能断言全库缺失（2026-09-23 真实缺口 HCCL 缓冲区就停在这里）。
        // 真正判得出来的是下一步——补料判定拿到的是候选页全文加补料原文。人冻结了复测计划就说明要补这个缺口，
        // 那就带着补料继续判；没有计划的照旧停下，等人决定。
        if (classification === "undetermined" && !hasRetestPlan(root, task.id))
          return {
            state: "needs-review",
            result: {
              phase: "retest-plan",
              assessment: assessed.jobId,
              classification,
              compilationStarted: false,
              reason: "诊断未判明：候选正文有截断，不能断言全库缺失",
              next: `要继续，先以 wiki:retest prepare --input <四类题目与判准.json> 冻结计划；任务会带着补料原文和候选页全文再判一次。taskId=${task.id}`,
            },
          };
        const gapInput = task.input;
        if (!hasRetestPlan(root, task.id))
          return {
            state: "needs-review",
            result: {
              phase: "retest-plan",
              assessment: assessed.jobId,
              classification,
              compilationStarted: false,
              next: `先以 wiki:retest prepare --input <四类题目与判准.json> 冻结计划；任务将重新排队，前测完成后才补写。taskId=${task.id}`,
            },
          };
        // 前测在第一次编译之前已经做过；驳回后重编不再跑（知识版本多半已变，也不该重复收费）
        if (!rejected) await runRetest(root, task.id, undefined, deps.runChat);
        const gap = listGaps(root).find((g) => g.key === gapInput.key)!;
        const sources = options.sources?.length
          ? options.sources
          : findGapSources(
              root,
              [...(gap.occurrences.at(-1)?.contextQuestions ?? []), gap.question].join("\n"),
            );
        if (!sources.length)
          return {
            state: "needs-material",
            result: {
              assessment: assessed.jobId,
              classification,
              compilationStarted: false,
              reason: "缺少可核对的外部材料；诊断理由不能作为事实来源",
            },
          };
        const packet = await prepareCoverageReview(root, assessed.jobId, {
          sources,
          pages: options.pages,
        });
        const material = packet.material!;
        const schema = z
          .object({
            action: z.enum(["new", "update", "already-covered", "undetermined"]),
            target: z.string().nullable(),
            source: z.string(),
            quote: z.string(),
            reason: z.string().min(1),
          })
          .strict()
          .superRefine((v, ctx) => {
            if (v.action === "new" || v.action === "update") {
              if (!boundSource(material.sources, v))
                ctx.addIssue({ code: "custom", message: "补写决定没有绑定补料原文" });
              if (v.action === "update" && !material.pages.some((p) => p.id === v.target))
                ctx.addIssue({ code: "custom", message: "更新前未读目标页全文" });
              if (v.action === "new" && (v.target !== null || classification === "outdated"))
                ctx.addIssue({ code: "custom", message: "过期知识必须更新原页" });
            }
          });
        const checked = await runStructured(
          root,
          {
            kind: "gap-material-v1",
            origin: "gap",
            data: { question: packet.question, contextQuestions: packet.contextQuestions, material },
            rules:
              '仅根据补料原文和已提供页面全文决定：返回 JSON {"action":"new|update|already-covered|undetermined","target":"已有页id或null","source":"材料原样引用","quote":"逐字引文","reason":"理由"}。source 只写材料的 raw 引用本身，不加说明；quote 逐字照抄材料正文，可以多行。catalog 只列相关页、仅用于定位（catalogOmitted 是没列出的页数），不算读过正文。能从旧页回答选 already-covered；候选页未读够不能断言全库没有知识，选 undetermined 并说明需要哪些页面。新增仅用于所给证据支持且 catalog 未指向已有主题；更新必须提供目标页全文。社区和聊天文本不得冒充源码实证。',
            schema,
            policy,
            timeoutMs: PAGE_TEXT_TIMEOUT_MS,
          },
          { runAgent: deps.runAgent, retry: options.retry },
        );
        if (!["new", "update"].includes(checked.value.action))
          return {
            state: "needs-review",
            result: {
              assessment: assessed.jobId,
              materialDecision: checked.jobId,
              compilationStarted: false,
            },
          };
        id = checked.value.action === "update" ? checked.value.target! : `gap-${task.input.key.slice(0, 20)}`;
        // 编译只认归档引用本身，不带模型在 source 后面加的备注
        source = boundSource(material.sources, checked.value)!.content.source;
        // Only machine-bounded source and existing page text reach compilation; not the diagnostic reason.
        why = JSON.stringify({
          question: packet.question,
          action: checked.value.action,
          target: checked.value.target,
          previous: material.pages.find((p) => p.id === checked.value.target)?.text,
        });
      } else if (task.input.kind === "pr") {
        const input = task.input;
        const record = readCorpus(root, input.repo).find((r) => r.kind === "pr" && r.number === input.number);
        if (!record || digest(JSON.stringify(record)) !== input.sourceHash)
          throw new Error("PR 语料已更新，需使用新队列项");
        const text = prMaterial(root, record, options.prFiles);
        const raw = saveRawSnapshot(join(root, "wiki"), text);
        source = `raw:${raw.slice(4)}#L1-L${sourceLines(text).length}`;
        id = `pr-${record.number}`;
        why = "记录该 PR 的讨论、变更文件与版本边界；未经源码核对的社区说法保持 I，不声称确认修复。";
      } else {
        const input = task.input;
        const snapshot = await readKnowledgeSnapshot(root);
        const page = snapshot.registry.pages.find((p) => p.id === input.pageId);
        if (!page || digest(readFileSync(localFile(root, `wiki/${page.file}`), "utf8")) !== input.revision)
          return {
            state: "closed",
            result: {
              closureBasis: "superseded-revision",
              reason: "待重写版本已变化；本次不修改新版本，后续检测按当前正文另建任务",
            },
          };
        id = input.pageId;
        source = input.source;
        why = `重新核对现有页面；自动生成区由最终整合阶段逐字保留，中间草稿不复制旧自动生成区或旧出处编号，只据本次材料提取。旧正文仅供对照，内容差异分数不能当作旧结论错误的证据。原文：\n${snapshot.pageTexts.find((p) => p.file === page.file)!.text}`;
      }
      const before = await readKnowledgeSnapshot(root);
      const rawMaterialContext = source.startsWith("raw:")
        ? (prepareRawInput(join(root, "wiki"), source).compilerData ?? "")
        : "";
      const rules = loadHandbook(
        join(root, "wiki"),
        `${id}\n${source}\n${why}\n${rawMaterialContext}`,
        true,
      ).pageFormat;
      const result = await compileRaw(
        store,
        {
          id,
          source,
          origin: task.input.kind === "pr" ? "pr" : "gap",
          rules,
          timeoutMs,
          context: {
            why,
            sourceId: task.id,
            ...(rejected
              ? { rejected: `上一版草稿的审阅 ${rejected.id} 被驳回：${rejected.reason}。按驳回意见重写。` }
              : {}),
          },
        },
        policy,
        { runAgent: runner, retry: options.retry },
      );
      if (!result.ok) throw new Error(result.reason ?? "补写编译失败");
      const review = await prepareDraftReview(root, id, policy, {
        runAgent: deps.runAgent,
        retry: options.retry,
      });
      if (
        task.input.kind === "rewrite" &&
        review.state === "rejected" &&
        isEmptyReview(readReview(root, review.reviewId))
      )
        return {
          state: "closed",
          result: {
            draftId: id,
            compileJob: result.jobId,
            reviewId: review.reviewId,
            closureBasis: "no-publishable-change",
            beforeRevision: before.revision,
            compilationStarted: true,
          },
        };
      return {
        state: "needs-review",
        result: {
          draftId: id,
          compileJob: result.jobId,
          reviewId: review.reviewId,
          ...(rejected ? { recompiledAfter: rejected.id } : {}),
          beforeRevision: before.revision,
          compilationStarted: true,
          next: `请在审阅面板或 wiki:review show ${review.reviewId} 核对完整变更；批准后独立问题复测`,
        },
      };
    },
    options.retry,
  );
}
export { readTask };
