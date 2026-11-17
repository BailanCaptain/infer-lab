import { describe, expect, it } from "vitest";
import registryJson from "./registry.json";
import { registrySchema } from "./schema";
import {
  buildToc,
  CORE_26_IDS,
  CURATED_PAGE_IDS,
  hasCuratedTocPlacement,
  pageTrack,
  partNumeral,
  type TocPage,
} from "./toc";

const registry = registrySchema.parse(registryJson);

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
        track: section.track,
      })),
    ),
  );

describe("buildToc · 184 篇零倒挂知识主题目录", () => {
  it("将 mla / sparse-attention / linear-attention 后移至 inference 的 kv-cache 之后，消除前置倒挂", () => {
    const rows = locations([
      page("tensor-parallel"),
      page("collective-communication"),
      page("mla"),
      page("sparse-attention"),
      page("linear-attention"),
      page("kv-cache"),
      page("attention-qkv"),
    ]);
    expect(rows.filter((p) => p.part === "models").map((p) => p.id)).toEqual(["attention-qkv"]);
    expect(rows.filter((p) => p.part === "inference").map((p) => p.id)).toEqual([
      "kv-cache",
      "mla",
      "sparse-attention",
      "linear-attention",
    ]);
    expect(rows.filter((p) => p.part === "distributed").map((p) => p.id)).toEqual([
      "collective-communication",
      "tensor-parallel",
    ]);
  });

  it("第 7 章 cases 承载旗舰异构全案，独立于基础分布式并行与架构章节", () => {
    const rows = locations([
      page("glm-5-3-flash-two-node"),
      page("collective-communication"),
      page("expert-parallel"),
      page("glm-5-3-flash"),
      page("one-request"),
      page("concurrent-requests"),
    ]);
    expect(rows.filter((p) => p.part === "distributed").map((p) => p.id)).toEqual([
      "collective-communication",
      "expert-parallel",
    ]);
    expect(rows.filter((p) => p.part === "cases").map((p) => p.id)).toEqual([
      "glm-5-3-flash",
      "glm-5-3-flash-two-node",
      "one-request",
      "concurrent-requests",
    ]);
    expect(rows.find((p) => p.id === "glm-5-3-flash-two-node")).toMatchObject({
      part: "cases",
      section: "GLM-5.3-Flash 双机 16 卡全案",
    });
  });

  it("阅读指南与 Wave 1 概览页排在最前，缺失的 🆕 规划页不会阻断 buildToc", () => {
    const input = [page("vllm-v1-shape"), page("learning-guide"), page("sampling")];
    const rows = locations(input);
    expect(rows.filter((p) => p.part === "guide").map((p) => p.id)).toEqual(["learning-guide"]);
    expect(rows.filter((p) => p.id === "vllm-v1-shape")).toEqual([
      { id: "vllm-v1-shape", part: "architecture", section: "主线走廊", track: "mainline" },
    ]);

    const withOverview = locations([...input, page("request-overview"), page("hf-model-anatomy")]);
    expect(withOverview.filter((p) => p.part === "guide").map((p) => p.id)).toEqual([
      "learning-guide",
      "request-overview",
      "hf-model-anatomy",
    ]);
  });

  it("按 12 大顶层分区组织：guide / models / inference / hardware / distributed / disaggregation / architecture / performance / cases", () => {
    const toc = buildToc([
      page("quantization", "feature", ["17"]),
      page("pd-disaggregation"),
      page("acl-graph"),
      page("tensor-parallel", "feature", ["13"]),
      page("ai-core"),
      page("vllm-v1-shape"),
      page("core-cli-params"),
      page("prefix-caching", "feature", ["11"]),
      page("kv-cache"),
      page("token"),
      page("learning-guide"),
      page("glm-5-3-flash"),
    ]);
    expect(toc.map((p) => p.id)).toEqual([
      "guide",
      "models",
      "inference",
      "hardware",
      "distributed",
      "disaggregation",
      "architecture",
      "performance",
      "cases",
    ]);
    expect(toc.find((p) => p.id === "inference")?.title).toBe("单实例调度、分页 KV 缓存与注意力状态变体");
    expect(toc.find((p) => p.id === "hardware")?.sections.flatMap((s) => s.pages.map((p) => p.id))).toEqual([
      "ai-core",
      "quantization",
    ]);
  });

  it("RFork 新子页保持独立与排序，且 rfork 前缀不抢占 source/pr/param 或问答/PR 记录；未归组参数按名称排序", () => {
    const toc = buildToc([
      page("rfork-troubleshooting", "feature", [], 90),
      page("rfork", "feature", [], 10),
      page("rfork-new-topic", "concept", [], 80),
      page("rfork-startup", "concept", [], 20),
      page("rfork-official-guide", "source", [], 5),
      page("rfork-pr-record", "pr", [], 6),
      page("rfork-param-knob", "param", [], 7),
      { ...page("rfork-chat-note", "concept", [], 8), origin: "chat" },
      { ...page("rfork-pr-origin", "concept", [], 9), origin: "pr" },
      page("b-param", "param"),
      page("a-param", "param"),
      page("kv-pool", "feature"),
    ]);
    expect(toc.map((p) => p.id)).toEqual(["disaggregation", "references", "rfork", "params"]);
    expect(toc.find((p) => p.id === "rfork")?.sections.flatMap((s) => s.pages.map((p) => p.id))).toEqual([
      "rfork",
      "rfork-startup",
      "rfork-new-topic",
      "rfork-troubleshooting",
    ]);
    expect(toc.find((p) => p.id === "params")?.sections[0]?.pages.map((p) => p.id)).toEqual([
      "a-param",
      "b-param",
      "rfork-param-knob",
    ]);
    const refRows = locations([
      page("rfork-official-guide", "source", [], 5),
      page("rfork-pr-record", "pr", [], 6),
      { ...page("rfork-chat-note", "concept", [], 8), origin: "chat" },
      { ...page("rfork-pr-origin", "concept", [], 9), origin: "pr" },
    ]);
    expect(refRows).toEqual([
      { id: "rfork-official-guide", part: "references", section: "历史版本与来源快照", track: "advanced" },
      { id: "rfork-chat-note", part: "references", section: "问答记录", track: "advanced" },
      { id: "rfork-pr-record", part: "references", section: "PR 记录", track: "advanced" },
      { id: "rfork-pr-origin", part: "references", section: "PR 记录", track: "advanced" },
    ]);
  });

  it("同节内已编排页保持教学先后，显式改指其他章节时仍服从 deprecated toc 声明", () => {
    const lowPrec: TocPage = {
      ...page("low-precision-formats", "concept", [], 10),
    };
    const quantMethods: TocPage = {
      ...page("quantization-methods", "concept", [], 20),
    };
    const relocated: TocPage = {
      ...page("quantization", "feature", [], 500),
      toc: { part: "performance", section: "自定义性能节" },
    };
    expect(locations([page("quantization"), quantMethods, lowPrec]).map((p) => p.id)).toEqual([
      "low-precision-formats",
      "quantization",
      "quantization-methods",
    ]);
    expect(locations([relocated, lowPrec])).toEqual([
      { id: "low-precision-formats", part: "hardware", section: "主线走廊", track: "mainline" },
      { id: "quantization", part: "performance", section: "自定义性能节", track: "advanced" },
    ]);
  });

  it("hccl-buffer 已迁至 4B 高阶并行耦合链，未编排内容和资料都有可见入口", () => {
    const hcclBuf = { ...page("hccl-buffer"), origin: "gap" };
    const input = [
      hcclBuf,
      { ...page("answer-new", "source"), origin: "chat" },
      { ...page("pr-new", "pr"), origin: "pr" },
      { ...page("gap-new"), origin: "gap" },
      page("new-model", "concept", ["04"]),
      page("new-feature", "feature", ["17"]),
      page("official-new", "source"),
      page("glm-5-3-flash-baseline", "source"),
    ];
    const rows = locations(input);
    expect(rows.find((p) => p.id === hcclBuf.id)).toMatchObject({
      part: "distributed",
      section: "高阶并行耦合链",
    });
    expect(
      buildToc(input)
        .flatMap((p) => p.sections.flatMap((s) => s.pages))
        .find((p) => p.id === hcclBuf.id),
    ).toBe(hcclBuf);
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

  it("专题按新分章归位，lora / structured-output / vllm-ascend-for-rl 并入 performance 同章进阶", () => {
    const expected: Record<string, string> = {
      quantization: "hardware",
      "kv-cache-quantization": "hardware",
      "kv-cache-cpu-offload": "inference",
      "kv-cache-layerwise-offload": "disaggregation",
      "async-scheduling": "inference",
      eplb: "distributed",
      "kv-cache-memory-profiling": "architecture",
      "acl-graph": "architecture",
      lora: "performance",
      "structured-output": "performance",
      "vllm-ascend-for-rl": "performance",
    };
    for (const row of locations(Object.keys(expected).map((id) => page(id)))) {
      expect(row.part, row.id).toBe(expected[row.id]);
    }
  });

  it("Core-26 显式冻结名单恰好 26 篇，三层阅读轨道与 184 篇策划目录无重复且覆盖真实知识库全量 163 页", () => {
    expect(CORE_26_IDS).toHaveLength(26);
    expect(new Set(CORE_26_IDS).size).toBe(26);
    for (const id of CORE_26_IDS) {
      expect(hasCuratedTocPlacement(id), id).toBe(true);
      expect(pageTrack(id), id).toBe("core-26");
    }
    expect(pageTrack("learning-guide")).toBe("mainline");
    expect(pageTrack("moe")).toBe("advanced");
    expect(CURATED_PAGE_IDS.size).toBe(175); // 184 - 9 dynamic rfork topic pages

    const toc = buildToc(registry.pages);
    expect(toc).toHaveLength(12);
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
    expect(parts.length).toBe(12);
    expect(partNumeral(12)).toBe("十二");
    expect(parts.every((_, i) => /^[一二三四五六七八九十]+$/.test(partNumeral(i + 1)))).toBe(true);
  });
});
