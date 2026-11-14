import { cpSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { retrieve } from "../src/content/wiki/retrieve";
import { CODEX_EVIDENCE_LIMIT, codexEvidencePages } from "./codex-chat";
import { relatedReading } from "./related-reading";
import { readKnowledgeSnapshot } from "./snapshot";

const pageText = (page: { passages: { text: string }[] }) => page.passages.map((p) => p.text).join("\n");

const fixture = wikiFixture();
let snapshot: Awaited<ReturnType<typeof readKnowledgeSnapshot>>;
beforeAll(async () => {
  cpSync(join(process.cwd(), "wiki"), join(fixture.root, "wiki"), {
    recursive: true,
    filter: (path) => !path.split(/[\\/]/).includes("_jobs"),
  });
  snapshot = await readKnowledgeSnapshot(fixture.root);
});
afterAll(() => fixture.cleanup());

// Real corpus regression: a named topic must survive both retrieval and the answer window.
it.each([
  "只对照 vLLM-Ascend 2c59ff10（v0.23）、2ed6cbba（v0.26rc）和 baa023ad（main）：三处都有 GLM-5.3-Flash 的稠密 MLP 模型实现吗？",
  "GLM 稠密 MLP 的 hidden_act 传 relu 时，db701c1f 和 baa023ad 都会检查并报错吗？main 开启序列并行时还按 TP 切权重并 All-Reduce 吗？",
])("retains explicitly requested MLP version evidence: %s", async (question) => {
  const hits = retrieve(question, snapshot.index, { limit: 5 });
  const pages = codexEvidencePages(
    hits.flatMap((h) => snapshot.pageTexts.filter((p) => p.file === `concepts/${h.id}.md`)),
  );
  expect(pages.some((p) => p.file === "concepts/mlp-residual-norm.md")).toBe(true);
});

it("keeps the whole-page answer window bounded and skips oversized pages", () => {
  const small = { file: "concepts/a.md", text: "evidence" };
  expect(
    codexEvidencePages([{ file: "concepts/large.md", text: "x".repeat(CODEX_EVIDENCE_LIMIT + 1) }, small]),
  ).toEqual([small]);
});

it.each(["前缀缓存", "Prefix Caching"])("长问题里的中文或英文主题都进入回答正文：%s", async (topic) => {
  const { retrieveChatContext } = await import("./chat-route");
  const question =
    `两篇提示词都是 100 个 token，前 80 个完全相同，后 20 个不同。第二篇后半段还有几个词也出现在第一篇里。${topic}能把所有重复的词都跳过吗？如果复用 80 个，是不是整条请求一定快 80%？我想弄懂原因。`;
  const { hits } = retrieveChatContext(question, snapshot);
  const pages = codexEvidencePages(
    hits.flatMap((hit) => {
      const file = snapshot.registry.pages.find((p) => p.id === hit.id)?.file;
      return snapshot.pageTexts.filter((p) => p.file === file);
    }),
  );
  expect(pages.some((p) => p.file === "concepts/prefix-caching.md")).toBe(true);
  expect(pages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(CODEX_EVIDENCE_LIMIT);
});

it("量化验收的已有正确性依据能通过一跳扩展进入回答窗口", async () => {
  const { retrieveChatContext } = await import("./chat-route");
  const question =
    "显存不够，团队在低比特量化和把一部分数据移到主存之间二选一。业务质量指标不能降，你会怎样设计小规模验收再决定？";
  const { hits } = retrieveChatContext(question, snapshot);
  const pages = codexEvidencePages(
    hits.flatMap((hit) => {
      const file = snapshot.registry.pages.find((p) => p.id === hit.id)?.file;
      return snapshot.pageTexts.filter((p) => p.file === file);
    }),
  );
  expect(pages.some((p) => p.file === "concepts/inference-correctness-troubleshooting.md")).toBe(true);
  expect(pages.reduce((sum, p) => sum + p.text.length, 0)).toBeLessThanOrEqual(CODEX_EVIDENCE_LIMIT);
});

it("keeps related reading identical for page and section citations", async () => {
  const plain = relatedReading("[MLP](concepts/mlp-residual-norm.md)", snapshot);
  expect(plain.length).toBeGreaterThan(0);
  expect(
    relatedReading("[MLP](concepts/mlp-residual-norm.md#qk-norm先按头归一化再加入位置)", snapshot),
  ).toEqual(plain);
});

it("provides the complete cited GLM pages when their bytes fit the configured evidence window", async () => {
  const ids = ["mlp-residual-norm", "mla", "attention-qkv", "rope"];
  const { reviewEvidencePages } = await import("./answer-quality");
  const material = reviewEvidencePages(
    snapshot,
    ids.map((id) => `[${id}](concepts/${id}.md)`).join(" "),
    [],
    new Set(ids.map((id) => `concepts/${id}.md`)),
    250_000,
  );
  for (const id of ids) {
    const page = material.find((p) => p.id === id)!;
    expect(page.truncated).toBe(false);
    expect(pageText(page)).toBe(snapshot.pageTexts.find((p) => p.file === `concepts/${id}.md`)!.text);
  }
  expect(pageText(material.find((p) => p.id === "mla")!)).toContain(
    "切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm",
  );
});

it("keeps all cited GLM pages represented in a smaller window and marks omissions", async () => {
  const ids = ["mlp-residual-norm", "mla", "attention-qkv", "rope"];
  const { reviewEvidencePages } = await import("./answer-quality");
  const material = reviewEvidencePages(
    snapshot,
    ids.map((id) => `[${id}](concepts/${id}.md)`).join(" "),
    [],
    new Set(ids.map((id) => `concepts/${id}.md`)),
    80_000,
    "切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm",
  );
  expect(material.map((p) => p.id).sort()).toEqual([...ids].sort());
  expect(material.every((p) => pageText(p).length > 0 && p.truncated)).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(material))).toBeLessThanOrEqual(80_000);
  expect(pageText(material.find((p) => p.id === "mla")!)).toContain(
    "切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm",
  );
});

it.each([
  {
    question: "两卡 2/6 ms 就绪，协调从 1 降到 0.2 ms，交换 0.5 ms。峰值能保证吞吐吗？",
    answer: "7.5 ms 降到 6.7 ms；双向互联峰值不能当单方向持续带宽，共用端口峰值不能相加。",
    ids: [
      "ascend-950-execution-interconnect",
      "ascend-950-architecture",
      "inference-performance-analysis",
      "inference-performance-troubleshooting",
    ],
    pageId: "ascend-950-architecture",
    evidence: "双向互联值也不能当成单方向的持续可用带宽",
  },
  {
    question: "DeepSeek 长输入前半处理 200 个位置，后半只处理末尾 8 个。后半层删除了吗？首字不变查什么？",
    answer: "后半层没有删除。新生成位置仍过全部层；工作量减少不保证提速。共享全局 KV 不能代替逐层窗口。",
    ids: [
      "deepseek-v4-1-flash",
      "swa-bounded-replay",
      "inference-performance-walkthrough",
      "inference-performance-troubleshooting",
      "deepseek-serving-case",
    ],
    pageId: "deepseek-v4-1-flash",
    evidence: "共享的全局 KV 不能代替这些窗口",
  },
])(
  "retains the inference evidence previously crowded out of review: $pageId",
  async ({ question, answer, ids, pageId, evidence }) => {
    const { reviewEvidencePages } = await import("./answer-quality");
    const material = reviewEvidencePages(
      snapshot,
      answer + ids.map((id) => `[${id}](concepts/${id}.md)`).join(" "),
      retrieve(question, snapshot.index, { limit: 10, expand: true, expansionLimit: 10 }),
      new Set(ids.map((id) => `concepts/${id}.md`)),
      80_000,
      question,
    );
    expect(pageText(material.find((p) => p.id === pageId)!)).toContain(evidence);
    expect(Buffer.byteLength(JSON.stringify(material))).toBeLessThanOrEqual(80_000);
    for (const page of material) {
      const file = snapshot.registry.pages.find((p) => p.id === page.id)!.file;
      const original = snapshot.pageTexts.find((p) => p.file === file)!.text;
      for (const passage of page.passages)
        expect(passage.text).toBe(original.slice(passage.start, passage.end));
    }
  },
);
