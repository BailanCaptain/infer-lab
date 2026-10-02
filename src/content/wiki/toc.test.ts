import { describe, expect, it } from "vitest";
import registry from "./registry.json";
import { buildToc, partNumeral, type TocPage } from "./toc";

const page = (id: string, type = "concept", chapters: string[] = [], order = 500): TocPage => ({
  id,
  title: id,
  type,
  chapters,
  order,
});
const locations = (pages: TocPage[]) =>
  buildToc(pages).flatMap((part) =>
    part.sections.flatMap((section) =>
      section.pages.map((p) => ({
        id: p.id,
        part: part.id,
        section: section.title,
      })),
    ),
  );

describe("buildToc · 知识主题目录", () => {
  it("先学密集注意力再学稀疏变体，先学通信再学并行", () => {
    const rows = locations([
      page("tensor-parallel"),
      page("collective-communication"),
      page("mla"),
      page("sparse-attention"),
      page("attention-qkv"),
    ]);
    expect(rows.filter((p) => p.part === "models").map((p) => p.id)).toEqual([
      "attention-qkv",
      "sparse-attention",
      "mla",
    ]);
    expect(rows.filter((p) => p.part === "distributed").map((p) => p.id)).toEqual([
      "collective-communication",
      "tensor-parallel",
    ]);
  });
  it("双机案例在通信和并行基础之后，保持唯一入口", () => {
    const rows = locations([
      page("glm-5-3-flash-two-node"),
      page("collective-communication"),
      page("expert-parallel"),
    ]);
    expect(rows.map((p) => p.id)).toEqual([
      "collective-communication",
      "expert-parallel",
      "glm-5-3-flash-two-node",
    ]);
    expect(rows[2]).toMatchObject({ part: "distributed", section: "贯穿案例" });
  });
  it("阅读指南先于模型和请求，框架总览保持唯一主题位置", () => {
    const input = [
      page("vllm-v1-shape"),
      page("concurrent-requests"),
      page("learning-guide"),
      page("one-request"),
      page("glm-5-3-flash"),
    ];
    const rows = locations(input);
    expect(rows.filter((p) => p.part === "guide").map((p) => p.id)).toEqual([
      "learning-guide",
      "glm-5-3-flash",
      "one-request",
      "concurrent-requests",
    ]);
    expect(rows.filter((p) => p.id === "vllm-v1-shape")).toEqual([
      { id: "vllm-v1-shape", part: "architecture", section: "组件、职责与进程" },
    ]);
  });
  it("GQA/MLA 与位置编码有明确的模型主题，硬件只放硬件内容", () => {
    const rows = locations([
      page("gqa", "concept", ["04"]),
      page("mla", "concept", ["04"]),
      page("rope"),
      page("hardware-devices"),
      page("ai-core"),
    ]);
    expect(rows.filter((p) => p.part === "models").map((p) => p.id)).toEqual(["rope", "gqa", "mla"]);
    expect(rows.filter((p) => p.part === "models").every((p) => p.section === "Attention 与位置编码")).toBe(
      true,
    );
    expect(rows.filter((p) => p.part === "hardware").map((p) => p.id)).toEqual([
      "hardware-devices",
      "ai-core",
    ]);
  });
  it("学习入口、模型、推理、架构、硬件、分布式、性能按主题排序，不按页型或课程章号", () => {
    const toc = buildToc([
      page("quantization", "feature", ["17"]),
      page("acl-graph"),
      page("tensor-parallel", "feature", ["13"]),
      page("ai-core"),
      page("vllm-v1-shape"),
      page("prefix-caching", "feature", ["11"]),
      page("kv-cache"),
      page("token"),
      page("one-request"),
    ]);
    expect(toc.map((p) => p.id)).toEqual([
      "guide",
      "models",
      "inference",
      "architecture",
      "hardware",
      "distributed",
      "performance",
    ]);
    expect(toc.find((p) => p.id === "inference")?.title).toBe("推理过程");
    expect(toc.find((p) => p.id === "inference")?.sections.flatMap((s) => s.pages.map((p) => p.id))).toEqual([
      "kv-cache",
      "prefix-caching",
    ]);
    expect(locations([page("gqa", "feature", ["08"])])[0]?.part).toBe("models");
  });
  it("RFork 新子页保持独立与排序；参数保留独立入口并按名称排序", () => {
    const toc = buildToc([
      page("rfork-troubleshooting", "feature", [], 90),
      page("rfork", "feature", [], 10),
      page("rfork-new-topic", "concept", [], 80),
      page("rfork-startup", "concept", [], 20),
      page("b-param", "param"),
      page("a-param", "param"),
      page("kv-pool", "feature"),
    ]);
    expect(toc.map((p) => p.id)).toEqual(["inference", "rfork", "params"]);
    expect(toc.find((p) => p.id === "rfork")?.sections.flatMap((s) => s.pages.map((p) => p.id))).toEqual([
      "rfork",
      "rfork-startup",
      "rfork-new-topic",
      "rfork-troubleshooting",
    ]);
    expect(toc.find((p) => p.id === "params")?.sections[0]?.pages.map((p) => p.id)).toEqual([
      "a-param",
      "b-param",
    ]);
  });
  it("已编排的生成教学页进入主题，保留原始身份；未编排内容和资料都有可见入口", () => {
    const gap = { ...page("gap-a5164fe10fa9184412f8"), origin: "gap" };
    const input = [
      gap,
      { ...page("answer-new", "source"), origin: "chat" },
      { ...page("pr-new", "pr"), origin: "pr" },
      { ...page("gap-new"), origin: "gap" },
      page("new-model", "concept", ["04"]),
      page("new-feature", "feature", ["17"]),
      page("official-new", "source"),
      page("glm-5-3-flash-baseline", "source"),
    ];
    const rows = locations(input);
    expect(rows.find((p) => p.id === gap.id)).toMatchObject({
      part: "distributed",
      section: "集合通信与 HCCL",
    });
    expect(
      buildToc(input)
        .flatMap((p) => p.sections.flatMap((s) => s.pages))
        .find((p) => p.id === gap.id),
    ).toBe(gap);
    for (const id of ["new-model", "new-feature", "gap-new"]) {
      expect(rows.find((p) => p.id === id)).toMatchObject({
        part: "references",
        section: "新增教学页（待编排）",
      });
    }
    expect(rows.find((p) => p.id === "answer-new")?.section).toBe("问答记录");
    expect(rows.find((p) => p.id === "pr-new")?.section).toBe("PR 记录");
    expect(rows.find((p) => p.id === "official-new")?.section).toBe("来源与版本依据");
  });
  it("专题按机制归类，量化、状态、调度与服务不都堆到性能区", () => {
    const expected: Record<string, string> = {
      quantization: "models",
      "kv-cache-quantization": "inference",
      "kv-cache-cpu-offload": "inference",
      "kv-cache-layerwise-offload": "distributed",
      "async-scheduling": "inference",
      eplb: "distributed",
      "kv-cache-memory-profiling": "architecture",
      "acl-graph": "performance",
      lora: "serving",
      "structured-output": "serving",
    };
    for (const row of locations(Object.keys(expected).map((id) => page(id)))) {
      expect(row.part, row.id).toBe(expected[row.id]);
    }
  });
  it("请求入口、lm_head、sampling、流式输出、请求收尾与 DP 路由排在相邻页旁，不进待编排", () => {
    const rows = locations([
      page("request-call-chain"),
      page("api-server-entry"),
      page("engine-processes"),
      page("speculative-decoding"),
      page("request-teardown"),
      page("streaming-output"),
      page("sampling"),
      page("prefix-caching"),
      page("lm-head"),
      page("moe"),
      page("balance-scheduling"),
      page("dp-request-routing"),
    ]);
    expect(rows.filter((p) => p.part === "architecture").map((p) => p.id)).toEqual([
      "engine-processes",
      "api-server-entry",
      "request-call-chain",
    ]);
    expect(rows.filter((p) => p.part === "models")).toEqual([
      { id: "moe", part: "models", section: "Decoder 层、MoE 与 lm_head" },
      { id: "lm-head", part: "models", section: "Decoder 层、MoE 与 lm_head" },
    ]);
    expect(rows.filter((p) => p.part === "inference").map((p) => [p.id, p.section])).toEqual([
      ["prefix-caching", "Block table 与 prefix caching"],
      ["sampling", "Sampling 与返回"],
      ["streaming-output", "Sampling 与返回"],
      ["request-teardown", "Sampling 与返回"],
      ["speculative-decoding", "Chunked prefill 与 speculative decoding"],
    ]);
    expect(rows.filter((p) => p.part === "distributed")).toEqual([
      { id: "dp-request-routing", part: "distributed", section: "DP 组分流与 expert 负载" },
      { id: "balance-scheduling", part: "distributed", section: "DP 组分流与 expert 负载" },
    ]);
  });
  it("真实知识库每页恰好出现一次，所有现有教学页都有主题，全部分组有名称", () => {
    const toc = buildToc(registry.pages);
    const rows = locations(registry.pages);
    expect(rows.map((p) => p.id).sort()).toEqual(registry.pages.map((p) => p.id).sort());
    expect(new Set(rows.map((p) => p.id)).size).toBe(rows.length);
    expect(rows.filter((p) => p.section === "新增教学页（待编排）")).toEqual([]);
    expect(toc.every((p) => p.sections.every((s) => s.title.length > 0 && s.pages.length > 0))).toBe(true);
    expect(buildToc([])).toEqual([]);
  });
});

describe("partNumeral · 目录分组的中文序号", () => {
  it("第十组以后接着数，不会断成 undefined", () => {
    expect([1, 5, 10, 11, 12, 19, 20, 21, 99].map(partNumeral)).toEqual([
      "一",
      "五",
      "十",
      "十一",
      "十二",
      "十九",
      "二十",
      "二十一",
      "九十九",
    ]);
    const parts = buildToc(registry.pages);
    expect(parts.length).toBeGreaterThanOrEqual(11);
    expect(partNumeral(11)).toBe("十一");
    expect(parts.every((_, i) => /^[一二三四五六七八九十]+$/.test(partNumeral(i + 1)))).toBe(true);
  });
});
