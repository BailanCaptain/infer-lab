import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { RunAgent } from "../scripts/wiki/batch";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";
import { WorkflowStore } from "../scripts/wiki/workflow";
import { judgeAnswer, reviewEvidencePages } from "./answer-quality";
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

const pageText = (page: { passages: { text: string }[] }) => page.passages.map((p) => p.text).join("\n");

it.each(["sources/a.md#版本差异", "#/wiki/a#%E7%89%88%E6%9C%AC%E5%B7%AE%E5%BC%82"])(
  "preserves a cited version section ahead of keyword-rich background: %s",
  async (href) => {
    const f = await setup();
    f.write(
      "wiki/sources/a.md",
      readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") +
        "\n## 请求收尾\n" +
        "中止队列 引擎状态 请求引用 worker 清理 前端路由。\n".repeat(500) +
        "\n### 附加背景\n" +
        "其他背景说明。\n".repeat(200) +
        "\n### 版本差异\n旧版立即释放；新版等待在途步骤完成。\n" +
        "其他背景说明。\n".repeat(200) +
        "\n### 其他说明\n" +
        "中止队列 引擎状态 请求引用 worker 清理 前端路由。\n".repeat(500),
    );
    const snapshot = await readKnowledgeSnapshot(f.root);
    const material = reviewEvidencePages(
      snapshot,
      `查中止队列、引擎状态、请求引用、worker 清理和前端路由。版本条件见[版本](${href})。`,
      [],
      new Set(["sources/a.md"]),
      5000,
      "取消请求后如何排查？",
    );
    expect(pageText(material[0]!)).toContain("旧版立即释放；新版等待在途步骤完成。");
    expect(Buffer.byteLength(JSON.stringify(material))).toBeLessThanOrEqual(5000);
    for (const p of material[0]!.passages)
      expect(p.text).toBe(snapshot.pageTexts[0]!.text.slice(p.start, p.end));
  },
);

it("resolves repeated heading anchors without counting headings inside code examples", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") +
      "\n```md\n### 版本差异\n伪标题只是示例。\n```\n" +
      "\n### 版本差异\n" +
      "背景说明。\n".repeat(1000) +
      "\n### [版本差异](https://docs.vllm.ai/)\n第二个真实小节保留版本前提。\n" +
      "\n### 背景\n" +
      "背景说明。\n".repeat(1000),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  const material = reviewEvidencePages(
    snapshot,
    "背景说明见[依据](sources/a.md#版本差异-1)。",
    [],
    new Set(),
    2500,
  );
  expect(pageText(material[0]!)).toContain("第二个真实小节保留版本前提。");
  expect(Buffer.byteLength(JSON.stringify(material))).toBeLessThanOrEqual(2500);
});

it("keeps cited pages complete before spending the window on uncited expansions", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") + "解释与条件。\n".repeat(600),
  );
  f.write(
    "wiki/sources/b.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8").replace("id: a", "id: b"),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  const original = snapshot.pageTexts.find((p) => p.file === "sources/a.md")!.text;
  const material = reviewEvidencePages(
    snapshot,
    f.input.answer,
    [{ id: "b" }],
    new Set(["sources/a.md"]),
    16_000,
  );
  expect(material.find((p) => p.id === "a")).toMatchObject({ truncated: false });
  expect(material.find((p) => p.id === "a")!.passages).toEqual([
    { start: 0, end: original.length, text: original },
  ]);
});

it("does not insert generated omission notices into quotable page text", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") + "\n背景说明。\n".repeat(9000),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  await judgeAnswer(
    f.root,
    { ...f.input, snapshot, evidencePages: snapshot.pageTexts },
    {
      runAgent: async (req) => {
        const data = JSON.parse(req.stdin);
        expect(data.pages[0].truncated).toBe(true);
        expect(JSON.stringify(data.pages)).not.toContain("[其间正文省略]");
        const original = snapshot.pageTexts[0]!.text;
        for (const passage of data.pages[0].passages) {
          expect(passage.text).toBe(original.slice(passage.start, passage.end));
        }
        return runner({
          satisfied: null,
          classification: "undetermined",
          reason: "材料不全",
          answerQuote: "",
          evidence: [],
        })(req);
      },
    },
  );
});

it("rejects a verbatim quote from omitted content instead of validating against the full source alone", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") +
      Array.from({ length: 9000 }, (_, i) => `背景记录 ${i}。\n`).join(""),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  let calls = 0;
  await expect(
    judgeAnswer(
      f.root,
      { ...f.input, snapshot, evidencePages: snapshot.pageTexts },
      {
        runAgent: async (req) => {
          calls++;
          const data = JSON.parse(req.stdin);
          const supplied = data.pages[0].passages as { start: number; end: number; text: string }[];
          const original = snapshot.pageTexts[0]!.text;
          const omitted = Array.from(original.matchAll(/背景记录 \d+。/g)).find(
            (m) => !supplied.some((p) => p.text.includes(m[0])),
          );
          expect(omitted).toBeDefined();
          return runner({ ...decision, evidence: [{ pageId: "a", quote: omitted![0] }] })(req);
        },
      },
    ),
  ).rejects.toThrow("页面引文不存在或未提供");
  expect(calls).toBe(1);
});

it("inspects an existing cited page outside retrieval without claiming the answer received it", async () => {
  const f = await setup();
  const material = reviewEvidencePages(f.input.snapshot, f.input.answer, [], new Set());
  expect(material).toHaveLength(1);
  expect(material[0]).toMatchObject({ id: "a", providedToAnswer: false, truncated: false });
});

it("bounds the serialized Unicode passages and metadata even in a tiny review window", async () => {
  const f = await setup();
  f.write(
    "wiki/sources/a.md",
    readFileSync(join(f.root, "wiki/sources/a.md"), "utf8") + '汉字😀\\"\n'.repeat(4000),
  );
  const snapshot = await readKnowledgeSnapshot(f.root);
  for (const budget of [0, 128, 800, 4096]) {
    const material = reviewEvidencePages(snapshot, f.input.answer, [], new Set(["sources/a.md"]), budget);
    if (budget < 2) expect(material).toEqual([]);
    else expect(Buffer.byteLength(JSON.stringify(material))).toBeLessThanOrEqual(budget);
    for (const page of material)
      for (const passage of page.passages) {
        expect(passage.text).toBe(snapshot.pageTexts[0]!.text.slice(passage.start, passage.end));
        expect(passage.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
      }
  }
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
        expect(Buffer.byteLength(JSON.stringify(data.pages))).toBeLessThanOrEqual(CODEX_EVIDENCE_LIMIT);
        expect(Buffer.byteLength(req.stdin, "utf8")).toBeLessThan(128_000 - 16_384 - 8192);
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
        expect(pageText(data.pages[0])).toContain("默认值为 1。");
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
        expect(pageText(data.pages[0])).toContain("在 baa023ad，hidden_act 不是 silu 时抛错。");
        expect(data.pages[0].truncated).toBe(false);
        expect(pageText(data.pages[0])).toBe(snapshot.pageTexts[0]!.text);
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
          expect(pageText(page)).toContain("特殊维度 1536，使用 RMSNorm。");
          expect(pageText(page).length).toBeGreaterThan(2000);
        }
        expect(Buffer.byteLength(JSON.stringify(data.pages))).toBeLessThanOrEqual(CODEX_EVIDENCE_LIMIT);
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
