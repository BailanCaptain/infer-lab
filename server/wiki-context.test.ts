import { cpSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { retrieve } from "../src/content/wiki/retrieve";
import { CODEX_EVIDENCE_LIMIT, codexEvidencePages } from "./codex-chat";
import { relatedReading } from "./related-reading";
import { readKnowledgeSnapshot } from "./snapshot";

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

it("keeps related reading identical for page and section citations", async () => {
  const plain = relatedReading("[MLP](concepts/mlp-residual-norm.md)", snapshot);
  expect(plain.length).toBeGreaterThan(0);
  expect(
    relatedReading("[MLP](concepts/mlp-residual-norm.md#qk-norm先按头归一化再加入位置)", snapshot),
  ).toEqual(plain);
});

it("provides the complete cited GLM pages to the independent judge", async () => {
  const ids = ["mlp-residual-norm", "mla", "attention-qkv", "rope"];
  const { reviewEvidencePages } = await import("./answer-quality");
  const material = reviewEvidencePages(
    snapshot,
    ids.map((id) => `[${id}](concepts/${id}.md)`).join(" "),
    [],
    new Set(ids.map((id) => `concepts/${id}.md`)),
  );
  for (const id of ids) {
    const page = material.find((p) => p.id === id)!;
    expect(page.truncated).toBe(false);
    expect(page.text).toBe(snapshot.pageTexts.find((p) => p.file === `concepts/${id}.md`)!.text);
  }
  expect(material.find((p) => p.id === "mla")!.text).toContain(
    "切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm",
  );
});
