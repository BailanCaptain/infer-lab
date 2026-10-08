import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { RunAgent } from "../scripts/wiki/batch";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { WorkflowStore } from "../scripts/wiki/workflow";
import { judgeAnswer } from "./answer-quality";
import { CODEX_EVIDENCE_LIMIT } from "./codex-chat";
import { readKnowledgeSnapshot } from "./snapshot";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const decision = {
  satisfied: false,
  classification: "answer-error",
  reason: "数字与来源不符",
  answerQuote: "默认值为 2",
  evidence: [{ pageId: "a", quote: "默认值为 1。" }],
};
async function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write(
    "wiki/sources/a.md",
    "---\nid: a\ntitle: A\ntype: source\nsummary: A 默认值\nsources: [https://docs.vllm.ai/en/v0.10.0/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n默认值为 1。\n",
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  return {
    ...f,
    input: {
      question: "A 的默认值？",
      contextQuestions: [],
      answer: "默认值为 2 [A](sources/a.md)。",
      snapshot,
      evidencePages: snapshot.pageTexts,
      selection: { provider: "codex" as const, model: "gpt-6.1-sol" },
    },
  };
}
const runner =
  (output: unknown): RunAgent =>
  async (req) => ({
    id: req.id,
    ok: true,
    exitCode: 0,
    stderrTail: "",
    billing: "chatgpt",
    output: JSON.stringify(output),
  });

it.each([false, true])("normalizes only CRLF in verbatim quotes, changed content=%s", async (changed) => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") + "\n第一行 1。\n第二行 2。\n",
  );
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8").replaceAll("\n", "\r\n"),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  const output = {
    ...decision,
    evidence: [{ pageId: "a", quote: changed ? "第一行 1。\n第二行 3。" : "第一行 1。\n第二行 2。" }],
  };
  const result = judgeAnswer(
    f.root,
    { ...f.input, snapshot, evidencePages: snapshot.pageTexts },
    { runAgent: runner(output) },
  );
  if (changed) await expect(result).rejects.toThrow("页面引文不存在");
  else expect((await result).decision).toEqual(output);
});

it("uses a fresh tool-free pinned model, binds the revision, and reuses an intact decision receipt", async () => {
  const f = await setup();
  let calls = 0;
  // The UI changes models while the answering turn is running.
  f.write(
    "wiki/sync.config.local.json",
    JSON.stringify({ chatProvider: "claude", chatModel: "fixture-other" }),
  );
  const runAgent: RunAgent = async (req) => {
    calls++;
    expect(req.provider).toBe("codex");
    expect(req.model).toBe("gpt-6.1-sol");
    expect(req.allowedWrites).toEqual([]);
    expect(req.args).not.toContain("--resume");
    expect(JSON.parse(req.stdin).revision).toBe(f.input.snapshot.revision);
    return runner(decision)(req);
  };
  const result = await judgeAnswer(f.root, f.input, { runAgent });
  expect(result.decision).toEqual(decision);
  expect(await judgeAnswer(f.root, f.input, { runAgent })).toEqual(result);
  expect(calls).toBe(1);
  const job = new WorkflowStore(f.root).get(result.jobId);
  expect(job.attempts[0]!.selection).toEqual(f.input.selection);
  f.write(`wiki/_jobs/decisions/${result.jobId}.json`, JSON.stringify({ ...decision, satisfied: true }));
  await expect(judgeAnswer(f.root, f.input, { runAgent })).rejects.toThrow(/回执已变化/);
});

it.each([
  { ...decision, satisfied: true },
  { ...decision, answerQuote: "编造的回答片段" },
  { ...decision, evidence: [{ pageId: "a", quote: "编造的正文" }] },
  { ...decision, classification: "retrieval-miss" },
  { ...decision, classification: "outdated" },
  { ...decision, answerQuote: "" },
])("rejects unsupported classifications and preserves the failed receipt: %j", async (output) => {
  const f = await setup();
  await expect(judgeAnswer(f.root, f.input, { runAgent: runner(output) })).rejects.toThrow();
  expect(new WorkflowStore(f.root).list()[0]!.state).toBe("failed");
  expect(readFileSync(join(f.root, "wiki/sources/a.md"), "utf8")).toContain("默认值为 1。");
});

it("finds a page omitted from the answer context without claiming it was provided", async () => {
  const f = await setup();
  f.input.evidencePages = [];
  const result = await judgeAnswer(f.root, f.input, {
    runAgent: runner({ ...decision, classification: "retrieval-miss" }),
  });
  expect(result.decision.classification).toBe("retrieval-miss");
});

it("allows a new user turn to assess again after a transient failure without retrying the old turn", async () => {
  const f = await setup();
  let calls = 0;
  const runAgent: RunAgent = async (req) => {
    calls++;
    if (calls === 1)
      return { id: req.id, ok: false, exitCode: 1, stderrTail: "", billing: "chatgpt", reason: "temporary" };
    return runner(decision)(req);
  };
  await expect(
    judgeAnswer(f.root, { ...f.input, observationId: "turn-one" }, { runAgent }),
  ).rejects.toThrow();
  expect(
    (await judgeAnswer(f.root, { ...f.input, observationId: "turn-two" }, { runAgent })).decision,
  ).toEqual(decision);
  expect(calls).toBe(2);
});

it("records excerpt truncation explicitly and never sends private operational files", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") + "x".repeat(CODEX_EVIDENCE_LIMIT + 1),
  );
  f.write("wiki/_gaps.json", "private question ledger");
  const snapshot = await readKnowledgeSnapshot(f.root);
  await judgeAnswer(
    f.root,
    { ...f.input, snapshot, evidencePages: snapshot.pageTexts },
    {
      runAgent: async (req) => {
        const data = JSON.parse(req.stdin);
        expect(data.pages[0].truncated).toBe(true);
        expect(data.pages[0].text.length).toBe(CODEX_EVIDENCE_LIMIT);
        expect(req.stdin).not.toContain("private question ledger");
        return runner({
          satisfied: null,
          classification: "undetermined",
          reason: "正文不全",
          answerQuote: "",
          evidence: [],
        })(req);
      },
    },
  );
});

it("prioritizes the cited page over unrelated accessible pages in a large snapshot", async () => {
  const f = await setup();
  for (let i = 0; i < 12; i++)
    f.write(
      `wiki/sources/a-noise-${i}.md`,
      `---\nid: a-noise-${i}\ntitle: 无关页面 ${i}\ntype: source\nsummary: 无关材料\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n${"无关正文".repeat(3000)}\n`,
    );
  const snapshot = await readKnowledgeSnapshot(f.root);
  await judgeAnswer(
    f.root,
    { ...f.input, snapshot, evidencePages: snapshot.pageTexts },
    {
      runAgent: async (req) => {
        const data = JSON.parse(req.stdin);
        expect(data.pages[0].id).toBe("a");
        expect(data.pages[0].text).toContain("默认值为 1。");
        expect(data.scope.omittedPages).toBeGreaterThan(0);
        return runner(decision)(req);
      },
    },
  );
});

it("provides relevant late version evidence instead of only the page prefix", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") +
      "\n## 其他背景\n" +
      "背景说明。\n\n".repeat(3000) +
      "\n## 版本差异\n在 baa023ad，hidden_act 不是 silu 时抛错。\n",
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  await judgeAnswer(
    f.root,
    {
      ...f.input,
      question: "baa023ad 的 hidden_act 会检查吗？",
      snapshot,
      evidencePages: snapshot.pageTexts,
    },
    {
      runAgent: async (req) => {
        const data = JSON.parse(req.stdin);
        expect(data.pages[0].text).toContain("在 baa023ad，hidden_act 不是 silu 时抛错。");
        expect(data.pages[0].truncated).toBe(false);
        expect(data.pages[0].text).toBe(snapshot.pageTexts[0]!.text);
        return runner({
          satisfied: null,
          classification: "undetermined",
          reason: "仅测试材料选择",
          answerQuote: "",
          evidence: [],
        })(req);
      },
    },
  );
});

it("reserves space for every cited page and checks details introduced by the answer", async () => {
  const f = await setup();
  for (const id of ["b", "c", "d"])
    f.write(
      `wiki/sources/${id}.md`,
      readFileSync(join(f.root, "wiki/sources/a.md"), "utf8").replace("id: a", `id: ${id}`),
    );
  for (const id of ["a", "b", "c", "d"])
    f.write(
      `wiki/sources/${id}.md`,
      readFileSync(join(f.root, `wiki/sources/${id}.md`), "utf8") +
        "\n## 背景\n" +
        "默认值背景。\n\n".repeat(3000) +
        "\n## 限制\n特殊维度 1536，使用 RMSNorm。\n",
    );
  const snapshot = await readKnowledgeSnapshot(f.root);
  await judgeAnswer(
    f.root,
    {
      ...f.input,
      answer:
        "特殊维度 1536，使用 RMSNorm。" +
        ["a", "b", "c", "d"].map((id) => `[${id}](sources/${id}.md)`).join(" "),
      snapshot,
      evidencePages: snapshot.pageTexts,
    },
    {
      runAgent: async (req) => {
        const data = JSON.parse(req.stdin);
        for (const page of data.pages) {
          expect(page.text).toContain("特殊维度 1536，使用 RMSNorm。");
          expect(page.text.length).toBeGreaterThan(2000);
        }
        expect(
          data.pages.reduce((sum: number, p: { text: string }) => sum + p.text.length, 0),
        ).toBeLessThanOrEqual(CODEX_EVIDENCE_LIMIT);
        return runner({
          satisfied: null,
          classification: "undetermined",
          reason: "测试证据选择",
          answerQuote: "",
          evidence: [],
        })(req);
      },
    },
  );
});
