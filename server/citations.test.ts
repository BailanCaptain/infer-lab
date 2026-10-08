import { expect, it } from "vitest";
import { answerCitationGuide, checkAnswerCitations } from "./citations";

const page = (id: string, body: string) => ({
  file: `sources/${id}.md`,
  text: `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 示例\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n${body}\n`,
});
const pages = [page("a", "默认开启 [S1]。"), page("b", "默认关闭 [S1]。")];

it("offers only copyable citations that the production checker accepts for the exact page", () => {
  const inputs = [...pages, page("c", "推断 [I]。示例 `[C1]`，无效来源 [S2]。")];
  const guide = answerCitationGuide(inputs);
  expect(guide).toEqual([
    { pageLink: "[a](sources/a.md)", sourceLinks: ["[S1](sources/a.md)"] },
    { pageLink: "[b](sources/b.md)", sourceLinks: ["[S1](sources/b.md)"] },
    { pageLink: "[c](sources/c.md)", sourceLinks: [] },
  ]);
  for (const entry of guide)
    for (const link of [entry.pageLink, ...entry.sourceLinks])
      expect(checkAnswerCitations(`材料说明。${link}`, inputs).cited).toBe(true);
});

it("keeps equal source numbers attached to separate pages without claiming semantic truth", () => {
  expect(checkAnswerCitations("A 开启 [S1](sources/a.md)，B 关闭 [S1](sources/b.md)。", pages).cited).toBe(
    true,
  );
  // Same valid citation structure, deliberately false claim: this is NOT a semantic judge.
  expect(checkAnswerCitations("A 关闭 [S1](sources/a.md)。", pages).cited).toBe(true);
});
it.each(["sources/a.md", "../sources/a.md", "#/wiki/a"])("accepts the existing page route %s", (href) => {
  expect(checkAnswerCitations(`默认开启 [S1](${href})。`, pages).cited).toBe(true);
});
it.each(["sources/a.md#一句话", "../sources/a.md#%E4%B8%80", "#/wiki/a#一句话"])(
  "accepts section citations without weakening snapshot ownership: %s",
  (href) => {
    expect(checkAnswerCitations(`默认开启 [S1](${href})。`, pages).cited).toBe(true);
    expect(checkAnswerCitations(`默认开启 [A](${href.replace("/a", "/unknown")})。`, pages).cited).toBe(
      false,
    );
    expect(checkAnswerCitations(`默认开启 [S2](${href})。`, pages).cited).toBe(false);
    expect(checkAnswerCitations(`默认开启。\`[A](${href})\``, pages).cited).toBe(false);
  },
);
it.each(["0", "2", "999999999999999999999999"])("rejects out-of-range source %s", (index) => {
  expect(checkAnswerCitations(`默认开启 [S${index}](sources/a.md)。`, pages)).toMatchObject({
    cited: false,
    reason: expect.stringContaining("条来源"),
  });
});
it("cannot borrow a marker from another page or from code examples", () => {
  expect(checkAnswerCitations("开启 [C1](sources/b.md)。", [page("a", "实现 [C1]。"), ...pages]).cited).toBe(
    false,
  );
  expect(checkAnswerCitations("开启 [S1](sources/a.md)。", [page("a", "示例 `[S1]`。")]).cited).toBe(false);
  expect(checkAnswerCitations("开启 [S1](sources/a.md)。", [page("a", "```md\n[S1]\n```")]).cited).toBe(
    false,
  );
});
it("keeps code samples, honest abstention and explicitly inferred answers usable", () => {
  expect(checkAnswerCitations("例子 `[C99]`，见 [A](sources/a.md)。", pages).cited).toBe(true);
  expect(checkAnswerCitations("归档推断 [I]，见 [A](sources/a.md)。", pages).cited).toBe(true);
  expect(checkAnswerCitations("据此推导 [D]，见 [A](sources/a.md)。", pages).cited).toBe(true);
  expect(checkAnswerCitations("知识库里还没有这一条。", pages).selfDeclaredUncovered).toBe(true);
});

it("recognizes the actual Chinese absence statement from the version baseline without accepting bare evidence marks", () => {
  const answer =
    "知识库内没有任何页面涉及 `profiling_chunk_config`，预检索到的候选页与该问题无关。" +
    "在当前知识快照中，尚无证据支持比较两个版本的配置解析行为。";
  expect(checkAnswerCitations(answer, pages)).toMatchObject({
    cited: true,
    selfDeclaredUncovered: true,
  });
  expect(checkAnswerCitations(`${answer} 默认开启 [C1]。`, pages)).toMatchObject({ cited: false });
  expect(checkAnswerCitations("该配置在两个版本中都保留 need_timing=true。", pages)).toMatchObject({
    cited: false,
    selfDeclaredUncovered: false,
  });
});
