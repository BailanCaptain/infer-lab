import { describe, expect, it } from "vitest";
import registry from "./registry.json";
import { buildToc, type TocPage } from "./toc";

const page = (id: string, type: string, chapters: string[] = [], order = 500): TocPage => ({
  id,
  title: id,
  type,
  chapters,
  order,
});

describe("buildToc", () => {
  it("RFork 工作版独立成章，新增 rfork 子页自动按顺序归入且不重复", () => {
    const toc = buildToc([
      page("rfork-troubleshooting", "feature", [], 90),
      page("rfork", "feature", [], 10),
      page("rfork-terms", "concept", [], 20),
      page("rfork-new-topic", "feature", [], 80),
      page("some-param", "param"),
      page("kv-pool", "feature", ["11"]),
    ]);
    expect(toc.map((p) => p.id)).toEqual(["features", "rfork", "params"]);
    expect(toc.find((p) => p.id === "rfork")?.sections.flatMap((s) => s.pages.map((p) => p.id))).toEqual([
      "rfork",
      "rfork-terms",
      "rfork-new-topic",
      "rfork-troubleshooting",
    ]);
    expect(toc.flatMap((p) => p.sections.flatMap((s) => s.pages))).toHaveLength(6);
  });
  it("四部分按「基础 → 全流程 → 特性 → 参数」排，人排的顺序原样保留", () => {
    const toc = buildToc([
      page("some-param", "param"),
      page("kv-pool", "feature", ["11"]),
      page("vllm-scheduler", "concept", ["12"]),
      page("vllm-v1-shape", "concept", ["10"]),
      page("kv-cache", "concept", ["05", "11"]),
      page("one-request", "concept", ["00"]),
    ]);
    expect(toc.map((p) => p.title)).toEqual(["推理基础知识", "代码全流程", "特性", "参数"]);
    expect(toc[0]!.sections[0]!.pages.map((p) => p.id)).toEqual(["one-request", "kv-cache"]);
    expect(toc[1]!.sections.map((s) => [s.title, s.pages.map((p) => p.id)])).toEqual([
      ["先看全貌", ["vllm-v1-shape"]],
      ["每一步：调度、分块、准备输入、前向", ["vllm-scheduler"]],
    ]);
  });

  it("没被点名的新页自动归位，不出现「未归类」", () => {
    const toc = buildToc([
      page("softmax", "concept", ["04"], 30),
      page("token", "concept", ["01"], 10),
      page("new-engine-thing", "concept", ["10"]),
      page("no-chapter-concept", "concept"),
      page("new-feature", "feature", ["17"]),
      page("bare-feature", "feature"),
      page("b-param", "param"),
      page("a-param", "param"),
    ]);
    const ids = (part: string) =>
      toc.find((p) => p.id === part)!.sections.map((s) => [s.title, s.pages.map((p) => p.id)]);
    expect(ids("basics")).toEqual([["", ["token", "softmax"]]]);
    expect(ids("flow")).toEqual([["其他", ["new-engine-thing", "no-chapter-concept"]]]);
    expect(ids("features")).toEqual([
      ["量化与投机解码", ["new-feature"]],
      ["其他", ["bare-feature"]],
    ]);
    expect(ids("params")).toEqual([["", ["a-param", "b-param"]]]);
  });

  it("真实知识库：每一页恰好出现一次，全流程里没有落进「其他」的页", () => {
    const toc = buildToc(registry.pages);
    const listed = toc.flatMap((part) => part.sections.flatMap((s) => s.pages.map((p) => p.id)));
    expect(listed.slice().sort()).toEqual(registry.pages.map((p) => p.id).sort());
    expect(new Set(listed).size).toBe(listed.length);
    expect(toc.find((p) => p.id === "flow")!.sections.map((s) => s.title)).not.toContain("其他");
  });
});
