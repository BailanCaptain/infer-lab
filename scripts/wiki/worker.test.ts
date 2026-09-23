import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CHAT_TIMEOUT_MS } from "../../server/chat";
import { readKnowledgeSnapshot } from "../../server/snapshot";
import type { RunAgent } from "./batch";
import { initBudget } from "./budget";
import { recordGapObservation } from "./gap-ledger";
import { WORK_MODEL } from "./model-use";
import { listTasks, readTask } from "./queue";
import { saveRawSnapshot } from "./raw";
import { acceptRetest, prepareRetest, runRetest } from "./retest";
import { approveReview, rejectReview } from "./review";
import { wikiFixture } from "./test-fixture";
import { boundSource, workerDue, workOne } from "./worker";

const policy = { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 };
async function setup(question: string) {
  const f = wikiFixture();
  f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
  f.write(
    "wiki/sources/a.md",
    "---\nid: a\ntitle: A\ntype: source\nsummary: A 默认值\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n默认值为 1。\n",
  );
  const revision = (await readKnowledgeSnapshot(f.root)).revision;
  for (let i = 0; i < 3; i++)
    await recordGapObservation(f.root, {
      eventId: randomUUID(),
      question,
      contextQuestions: [],
      revision,
      candidates: [],
      signals: [{ kind: "agent-uncovered", reason: "未收录" }],
    });
  return { ...f, task: listTasks(f.root)[0]! };
}
it("does not compile duplicate knowledge for a retrieval miss", async () => {
  const f = await setup("A 默认值？");
  try {
    let calls = 0;
    const result = await workOne(
      f.root,
      f.task.id,
      policy,
      {},
      {
        runAgent: async (req) => {
          calls++;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              satisfied: true,
              classification: "retrieval-miss",
              reason: "已有答案",
              evidence: [{ pageId: "a", quote: "默认值为 1。" }],
            }),
          };
        },
      },
    );
    expect(result).toMatchObject({ state: "needs-review", result: { compilationStarted: false } });
    expect(calls).toBe(1);
    expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
  } finally {
    f.cleanup();
  }
});
it("a budget admission failure does not permanently block an unstarted retest", async () => {
  const question = "B 的上限？";
  const f = await setup(question);
  try {
    const cases = (["original", "holdout", "version", "no-evidence"] as const).map((kind) => ({
      kind,
      question: kind === "original" ? question : `独立问题 ${kind}`,
      expected: "有依据",
      forbidden: "编造",
    }));
    await prepareRetest(f.root, { taskId: f.task.id, model: "fixture-model", reserveUsd: 0.1, cases });
    let calls = 0;
    const timeouts: number[] = [];
    const chat: typeof import("../../server/chat").runChat = async (req, on) => {
      calls++;
      timeouts.push(req.timeoutMs);
      on.text("知识库里还没有这一条。");
      return { ok: true, costUsd: 0 };
    };
    await expect(runRetest(f.root, f.task.id, undefined, chat)).rejects.toThrow(/尚未配置共享预算/);
    expect(calls).toBe(0);
    expect(existsSync(join(f.root, `wiki/_jobs/retests/${f.task.id}.before-original.json`))).toBe(false);
    expect(
      readdirSync(join(f.root, "wiki/_jobs/retests")).some((name) => name.includes("admission-rejected")),
    ).toBe(true);
    await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.1, maxCalls: 4 });
    await runRetest(f.root, f.task.id, undefined, chat);
    expect(calls).toBe(4);
    // 复测和网页问答是同一种调用：账本里问答实测 16–83 秒（2026-09-16），写死 60 秒会超时，
    // 超时记为费用未知、整个共享预算随之暂停
    expect(timeouts).toEqual(Array(4).fill(CHAT_TIMEOUT_MS));
  } finally {
    f.cleanup();
  }
});
it.each([false, true])(
  "integrates through production validation and closes only after semantic review: %s",
  async (passed) => {
    const question = "B 的上限是多少？";
    const f = await setup(question);
    try {
      const cases = (["original", "holdout", "version", "no-evidence"] as const).map((kind, i) => ({
        kind,
        question: i ? `独立问题 ${kind}` : question,
        expected: "正确且有证据",
        forbidden: "没有版本边界",
      }));
      await prepareRetest(f.root, { taskId: f.task.id, model: "fixture-model", reserveUsd: 0.1, cases });
      await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.1, maxCalls: 8 });
      let chatCalls = 0;
      let release!: () => void;
      let started!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const chat: typeof import("../../server/chat").runChat = async (req, on) => {
        chatCalls++;
        if (chatCalls === 1) {
          started();
          await held;
        }
        expect(req.args).not.toContain("--resume");
        expect(req.stdin).not.toContain("正确且有证据");
        on.text(
          chatCalls > 4 && passed && !req.stdin.includes("no-evidence")
            ? `B 在 fixture 版本的上限为 2，参见 [B](sources/gap-${f.task.input.kind === "gap" ? f.task.input.key.slice(0, 20) : ""}.md)。其他版本尚未收录。`
            : "知识库里还没有这一条。",
        );
        return { ok: true, costUsd: 0 };
      };
      const baselineRun = runRetest(f.root, f.task.id, undefined, chat);
      await entered;
      await expect(runRetest(f.root, f.task.id, undefined, chat)).rejects.toThrow(/禁止自动重试收费/);
      release();
      await baselineRun;
      const raw = saveRawSnapshot(join(f.root, "wiki"), "B 在 fixture 版本的上限为 2。\n");
      const source = `raw:${raw.slice(4)}#L1`;
      const runAgent: RunAgent = async (req) => {
        const data = JSON.parse(req.stdin);
        let output: string;
        if (data.mode === "draft-integration")
          output = JSON.stringify({
            pages: [{ path: `sources/${data.draft.id}.md`, text: data.draft.text }],
            decision: { promoted: [data.draft.id], merged: [], rejected: [] },
          });
        else if (data.mode === "coverage-assessment")
          output = JSON.stringify({
            satisfied: false,
            classification: "missing-knowledge",
            reason: "现有摘录没有 B",
            evidence: [],
          });
        else if (data.material?.sources)
          output = JSON.stringify({
            action: "new",
            target: null,
            source,
            quote: "B 在 fixture 版本的上限为 2。",
            reason: "补料支持",
          });
        else
          output = `---\nid: ${req.id}\ntitle: B 上限\ntype: source\nsummary: B 的上限\nsources: [${source}]\nevidence: I\nupdated: '2026-09-16'\n---\n## 一句话\nB 在 fixture 版本的上限为 2。[I] 参见 [A](../sources/a.md)。\n`;
        expect(req.stdin).not.toContain("独立问题 holdout");
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0, output };
      };
      const worked = await workOne(f.root, f.task.id, policy, { sources: [source] }, { runAgent });
      expect(worked.state).toBe("needs-review");
      expect(worked.result?.reviewId).toMatch(/^[a-f0-9]{64}$/);
      const reviewId = String(worked.result!.reviewId);
      await expect(runRetest(f.root, f.task.id, reviewId, chat)).rejects.toThrow(/批准发布/);
      await approveReview(f.root, reviewId);
      const retested = await workOne(f.root, f.task.id, policy, { retry: true }, { runAgent, runChat: chat });
      expect(retested.state).toBe("awaiting-retest");
      await runRetest(f.root, f.task.id, reviewId, chat);
      expect(chatCalls).toBe(8);
      const reviewed = await acceptRetest(f.root, f.task.id, {
        reviewer: "fixture reviewer",
        cases: cases.map((c) => ({
          kind: c.kind,
          passed,
          evidence: passed
            ? "来源、版本边界和无证据拒答均满足冻结判准（固定输出机制测试）"
            : "仍回答未收录，语义效果不通过",
        })),
      });
      expect(reviewed.state).toBe(passed ? "closed" : "needs-review");
    } finally {
      f.cleanup();
    }
  },
);

it("requires a frozen retest plan before compiling and requeues after human preparation", async () => {
  const f = await setup("B 的上限？");
  try {
    let calls = 0;
    const result = await workOne(
      f.root,
      f.task.id,
      policy,
      {},
      {
        runAgent: async (req) => {
          calls++;
          expect(JSON.parse(req.stdin).mode).toBe("coverage-assessment");
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              satisfied: false,
              classification: "missing-knowledge",
              reason: "没有 B",
              evidence: [],
            }),
          };
        },
      },
    );
    expect(result).toMatchObject({
      state: "needs-review",
      result: { phase: "retest-plan", compilationStarted: false },
    });
    expect(calls).toBe(1);
    expect(existsSync(join(f.root, "wiki/_drafts"))).toBe(false);
    await prepareRetest(f.root, {
      taskId: f.task.id,
      model: "fixture-model",
      reserveUsd: 0.1,
      cases: (["original", "holdout", "version", "no-evidence"] as const).map((kind) => ({
        kind,
        question: kind === "original" ? "B 的上限？" : `独立问题 ${kind}`,
        expected: "范围和证据",
        forbidden: "编造",
      })),
    });
    expect(listTasks(f.root)[0]!.state).toBe("queued");
  } finally {
    f.cleanup();
  }
});

it("审阅被驳回后带着驳回原因重编一次；重编结果与被驳回的那版一字不差就停下等人，不再自动收费", async () => {
  // 2026-09-23 实遇：PR 11953 的草稿被驳回后任务永久卡在 needs-review，夜间任务不会再碰它
  const question = "C 的上限是多少？";
  const f = await setup(question);
  try {
    const cases = (["original", "holdout", "version", "no-evidence"] as const).map((kind, i) => ({
      kind,
      question: i ? `独立问题 ${kind}` : question,
      expected: "正确且有证据",
      forbidden: "没有版本边界",
    }));
    await prepareRetest(f.root, { taskId: f.task.id, model: "fixture-model", reserveUsd: 0.1, cases });
    await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.1, maxCalls: 8 });
    let chatCalls = 0;
    const chat: typeof import("../../server/chat").runChat = async (_req, on) => {
      chatCalls++;
      on.text("知识库里还没有这一条。");
      return { ok: true, costUsd: 0 };
    };
    await runRetest(f.root, f.task.id, undefined, chat);
    expect(chatCalls).toBe(4);
    const raw = saveRawSnapshot(join(f.root, "wiki"), "C 在 fixture 版本的上限为 3。\n");
    const source = `raw:${raw.slice(4)}#L1`;
    const rejectedContexts: (string | undefined)[] = [];
    const runAgent: RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      let output: string;
      if (data.mode === "draft-integration")
        output = JSON.stringify({
          pages: [{ path: `sources/${data.draft.id}.md`, text: data.draft.text }],
          decision: { promoted: [data.draft.id], merged: [], rejected: [] },
        });
      else if (data.mode === "coverage-assessment")
        output = JSON.stringify({
          satisfied: false,
          classification: "missing-knowledge",
          reason: "现有摘录没有 C",
          evidence: [],
        });
      else if (data.material?.sources)
        output = JSON.stringify({
          action: "new",
          target: null,
          source,
          quote: "C 在 fixture 版本的上限为 3。",
          reason: "补料支持",
        });
      else {
        rejectedContexts.push(data.context?.rejected);
        const line = data.context?.rejected
          ? "C 在 fixture 版本的上限为 3，其他版本尚未核对。"
          : "C 的上限为 3。";
        output = `---\nid: ${req.id}\ntitle: C 上限\ntype: source\nsummary: C 的上限\nsources: [${source}]\nevidence: I\nupdated: '2026-09-23'\n---\n## 一句话\n${line}[I] 参见 [A](../sources/a.md)。\n`;
      }
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0, output };
    };
    const first = await workOne(f.root, f.task.id, policy, { sources: [source] }, { runAgent });
    const firstReview = String(first.result!.reviewId);
    await rejectReview(f.root, firstReview, "缺少版本边界");
    expect(workerDue(f.root, readTask(f.root, f.task.id))).toBe(true);

    const second = await workOne(f.root, f.task.id, policy, { retry: true, sources: [source] }, { runAgent });
    expect(second.state).toBe("needs-review");
    expect(second.result).toMatchObject({ recompiledAfter: firstReview });
    expect(second.result!.reviewId).not.toBe(firstReview);
    expect(rejectedContexts.at(-1)).toContain("缺少版本边界");
    expect(chatCalls).toBe(4); // 前测已经做过，重编不再跑

    const secondReview = String(second.result!.reviewId);
    await rejectReview(f.root, secondReview, "还是不对");
    const third = await workOne(f.root, f.task.id, policy, { retry: true, sources: [source] }, { runAgent });
    // 重编出来与被驳回的那版一字不差：拿回的仍是那份被驳回的审阅，任务停下，夜间任务不再捡它
    expect(third.result).toMatchObject({ reviewId: secondReview, recompiledAfter: secondReview });
    expect(workerDue(f.root, readTask(f.root, f.task.id))).toBe(false);
  } finally {
    f.cleanup();
  }
});

it("an undetermined assessment continues to the material decision once a retest plan is frozen", async () => {
  // 2026-09-23 真实缺口（HCCL 缓冲区）：诊断对着截断的候选正文只能诚实地答「未判明」，任务就此停死。
  // 真正判得出来的是下一步——补料判定拿到的是候选页全文加补料原文；人冻结了复测计划，就说明要补这个缺口。
  const question = "B 的上限是多少？";
  const f = await setup(question);
  try {
    const raw = saveRawSnapshot(join(f.root, "wiki"), "B 在 fixture 版本的上限为 2。\n");
    const source = `raw:${raw.slice(4)}#L1`;
    const modes: string[] = [];
    const runAgent: RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      modes.push(data.mode ?? (data.material?.sources ? "gap-material" : "compile"));
      const output =
        data.mode === "coverage-assessment"
          ? JSON.stringify({
              satisfied: null,
              classification: "undetermined",
              reason: "候选正文被截断，不能断言全库缺失",
              evidence: [],
            })
          : JSON.stringify({
              action: "already-covered",
              target: "a",
              source,
              quote: "B 在 fixture 版本的上限为 2。",
              reason: "补料核对后旧页已能回答",
            });
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0, output };
    };
    const stopped = await workOne(f.root, f.task.id, policy, { sources: [source] }, { runAgent });
    expect(stopped).toMatchObject({
      state: "needs-review",
      result: { phase: "retest-plan", classification: "undetermined", compilationStarted: false },
    });
    expect(modes).toEqual(["coverage-assessment"]);
    const cases = (["original", "holdout", "version", "no-evidence"] as const).map((kind, i) => ({
      kind,
      question: i ? `独立问题 ${kind}` : question,
      expected: "正确且有证据",
      forbidden: "没有版本边界",
    }));
    await prepareRetest(f.root, { taskId: f.task.id, model: "fixture-model", reserveUsd: 0.1, cases });
    await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.1, maxCalls: 8 });
    const chat: typeof import("../../server/chat").runChat = async (_req, on) => {
      on.text("知识库里还没有这一条。");
      return { ok: true, costUsd: 0 };
    };
    const continued = await workOne(
      f.root,
      f.task.id,
      policy,
      { sources: [source], retry: true },
      { runAgent, runChat: chat },
    );
    expect(modes).toEqual(["coverage-assessment", "gap-material"]);
    expect(continued).toMatchObject({
      state: "needs-review",
      result: { compilationStarted: false, materialDecision: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
  } finally {
    f.cleanup();
  }
});

it("binds a material decision by the archived reference and checks the quote line by line", () => {
  // 2026-09-23 真实缺口：模型在 source 引用后面加了备注，引文又跨了归档格式里的定位行，整段 includes 必然失败
  const sources = [
    {
      content: {
        source: "raw:x.md#L1-L5",
        lines: [
          { line: 1, text: "来源：r@1:a.py" },
          { line: 2, text: "r@1:a.py#L1" },
          { line: 3, text: "    a = 1" },
          { line: 4, text: "r@1:a.py#L2" },
          { line: 5, text: "    b = 2" },
        ],
      },
    },
  ];
  expect(
    boundSource(sources, { source: "raw:x.md#L1-L5（a.py#L1-L2）；辅证略", quote: "a = 1\n    b = 2" }),
  ).toBe(sources[0]);
  expect(boundSource(sources, { source: "raw:y.md#L1", quote: "a = 1" })).toBeUndefined();
  expect(boundSource(sources, { source: "raw:x.md#L1-L5", quote: "a = 1\nc = 3" })).toBeUndefined();
  expect(boundSource(sources, { source: "raw:x.md#L1-L5", quote: "  " })).toBeUndefined();
});

it("复测计划不写模型时默认用 WORK_MODEL（夜间固定 Opus 5.5）；写了就按冻结的来", async () => {
  const question = "B 的上限？";
  const f = await setup(question);
  try {
    const cases = (["original", "holdout", "version", "no-evidence"] as const).map((kind) => ({
      kind,
      question: kind === "original" ? question : `独立问题 ${kind}`,
      expected: "有依据",
      forbidden: "编造",
    }));
    await prepareRetest(f.root, { taskId: f.task.id, reserveUsd: 0.1, cases });
    const plan = JSON.parse(readFileSync(join(f.root, `wiki/_jobs/retests/${f.task.id}.plan.json`), "utf8"));
    expect(plan.model).toBe(WORK_MODEL);
  } finally {
    f.cleanup();
  }
});
