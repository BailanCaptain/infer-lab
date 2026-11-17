import { describe, expect, it } from "vitest";
import {
  buildIndex,
  citationCheck,
  deserializeSearchIndex,
  type PageIndex,
  retrieve,
  serializeSearchIndex,
  terms,
} from "./retrieve";

const pages: PageIndex[] = [
  {
    id: "kv-cache",
    title: "KV Cache",
    aliases: ["KV 缓存"],
    summary: "缓存每层每个 token 的 K 与 V，decode 时不再重算。",
    chapters: ["05", "11"],
    evidence: "C",
    related: ["paged-attention", "chunked-prefill"],
    text: "## 是什么\nKV Cache 把 attention 的 key 与 value 存下来。\n## 形状与数值\n每 token 每层 4 KiB。",
  },
  {
    id: "paged-attention",
    title: "PagedAttention",
    aliases: ["分页注意力"],
    summary: "把 KV Cache 切成固定大小的块，attention 靠 block table 寻址读取。",
    chapters: ["11"],
    evidence: "C",
    text: "## 是什么\nPagedAttention 按 block 读 KV。\n## 常见误解\n昇腾后端默认走 FIA 不是 PA。",
  },
  {
    id: "block-table",
    title: "Block Table",
    aliases: ["块表"],
    summary: "每个请求一行，记录它占用了哪些物理 KV block。",
    chapters: ["11"],
    evidence: "C",
    related: ["paged-attention"],
    text: "## 是什么\nblock table 是页表。",
  },
  {
    id: "layer-sharding",
    title: "Layer Sharding",
    aliases: ["层切分"],
    summary: "把注意力层的权重按层切开分到多卡，v0.24 起主线已移除。",
    chapters: ["13"],
    evidence: "C",
    related: [],
    text: "## 一句话\nMLA/SFA 的层级切分，核心实现在 ops/layer_shard_linear.py。",
  },
  {
    // 与 kv-cache 相关，但标题和正文都不含 kv / cache，
    // 所以查 "kv-cache" 时它只能靠图扩展出现——这正是 AC12 要验的路径
    id: "chunked-prefill",
    title: "Chunked Prefill",
    aliases: ["分块预填充"],
    summary: "把长请求的预填充切成若干小段，避免一次占满计算。",
    chapters: ["12"],
    evidence: "C",
    related: ["kv-cache"],
    text: "## 是什么\n长请求的首次前向被切成多段轮流执行。",
  },
];

const index = buildIndex(pages);

describe("retrieve", () => {
  it("id 精确命中排在最前，并标明命中方式", () => {
    const hits = retrieve("kv-cache", index);
    expect(hits[0]?.id).toBe("kv-cache");
    expect(hits[0]?.how).toBe("exact");
  });

  it("title 与 alias 都算精确命中，忽略大小写", () => {
    expect(retrieve("KV Cache", index)[0]?.id).toBe("kv-cache");
    expect(retrieve("kv 缓存", index)[0]?.id).toBe("kv-cache");
    expect(retrieve("分页注意力", index)[0]?.id).toBe("paged-attention");
  });

  it("自然语言提问能靠正文词命中", () => {
    const hits = retrieve("block table 是干嘛的", index);
    expect(hits.map((h) => h.id)).toContain("block-table");
  });

  it("完全无关的问题返回空，不硬凑", () => {
    expect(retrieve("今天天气怎么样", index)).toEqual([]);
  });

  it("结果按分数降序且不超过 limit", () => {
    const hits = retrieve("KV cache block", index, { limit: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    }
  });

  it("同一个查询重复调用结果一致", () => {
    expect(retrieve("KV Cache", index)).toEqual(retrieve("KV Cache", index));
  });
});

describe("citationCheck", () => {
  it("带页面链接的断言视为已引用", () => {
    const r = citationCheck("KV Cache 缓存了 K 和 V，见 [KV Cache](concepts/kv-cache.md)。");
    expect(r.cited).toBe(true);
  });

  it("hash 路由形式的链接也算引用", () => {
    expect(citationCheck("见 [KV Cache](#/wiki/kv-cache)").cited).toBe(true);
  });

  it("断言式回答但没有任何页面链接，判未引用", () => {
    const r = citationCheck("KV Cache 就是把 key 和 value 缓存起来，默认是开启的。");
    expect(r.cited).toBe(false);
    expect(r.reason).toMatch(/没有引用/);
  });

  it("agent 自己声明未收录时不算违规", () => {
    const r = citationCheck("知识库里还没有这一条。（未收录）以下是我自己的理解：……");
    expect(r.cited).toBe(true);
    expect(r.selfDeclaredUncovered).toBe(true);
  });

  it("反问或澄清不算断言，不要求引用", () => {
    expect(citationCheck("你是想问昇腾后端的实现，还是上游 vLLM 的？").cited).toBe(true);
  });

  it("空回答不算通过", () => {
    expect(citationCheck("   ").cited).toBe(false);
  });
});

describe("retrieve · 图扩展（AC12）", () => {
  it("扩展额度有限时，相关正文优先于按文件名排在前面的无关邻居", () => {
    const nodes = [
      { id: "anchor", title: "Anchor", text: "入口", related: ["a-unrelated", "z-diagnosis"] },
      { id: "a-unrelated", title: "无关邻居", text: "别的机制", related: [] },
      { id: "z-diagnosis", title: "故障诊断", text: "故障的区分方法", related: ["second-hop"] },
      { id: "second-hop", title: "故障深入", text: "故障故障", related: [] },
    ].map((p) => ({ ...p, aliases: [], summary: "", chapters: [], evidence: "I" }));
    const graph = buildIndex(nodes);
    const result = retrieve("anchor 故障", graph, { limit: 1, expand: true, expansionLimit: 1 });
    expect(result.map((h) => h.id)).toEqual(["anchor", "z-diagnosis"]);
    expect(result[1]).toMatchObject({ how: "related", via: "anchor" });
    expect(retrieve("anchor", graph, { limit: 1, expand: true, expansionLimit: 1 })[1]?.id).toBe(
      "a-unrelated",
    );
  });

  it("只声明单向 relations 的页也能从两端扩展，且不走第二跳", () => {
    const graph = buildIndex([
      {
        ...pages[0]!,
        id: "alpha",
        title: "Alpha",
        aliases: [],
        related: [],
        text: "alpha",
        relations: [{ to: "beta", kind: "builds-on" as const, note: "依赖" }],
      },
      {
        ...pages[0]!,
        id: "beta",
        title: "Beta",
        aliases: [],
        related: [],
        text: "beta",
        relations: [{ to: "gamma", kind: "variant-of" as const, note: "变体" }],
      },
      { ...pages[0]!, id: "gamma", title: "Gamma", aliases: [], related: [], text: "gamma", relations: [] },
    ]);
    expect(retrieve("alpha", graph, { limit: 1, expand: true }).map((h) => h.id)).toEqual(["alpha", "beta"]);
    expect(retrieve("beta", graph, { limit: 1, expand: true, expansionLimit: 2 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "alpha", how: "related", via: "beta" }),
        expect.objectContaining({ id: "gamma", how: "related", via: "beta" }),
      ]),
    );
    expect(retrieve("beta", graph, { limit: 1, expand: true, expansionLimit: 1 })).toHaveLength(2);
  });
  it("命中一页后，把它的 related 作为二级候选带出来", () => {
    const plain = retrieve("kv-cache", index).map((h) => h.id);
    expect(plain).not.toContain("chunked-prefill");
    const ids = retrieve("kv-cache", index, { expand: true }).map((h) => h.id);
    expect(ids[0]).toBe("kv-cache");
    expect(ids).toContain("chunked-prefill");
  });

  it("扩展来的候选标明是从哪一页牵出来的", () => {
    const hits = retrieve("kv-cache", index, { expand: true });
    const cp = hits.find((h) => h.id === "chunked-prefill");
    expect(cp?.how).toBe("related");
    expect(cp?.via).toBe("kv-cache");
  });

  it("直接命中的页不会被标成 related", () => {
    const hits = retrieve("kv-cache", index, { expand: true });
    expect(hits.find((h) => h.id === "kv-cache")?.via).toBeUndefined();
  });

  it("扩展候选排在直接命中之后", () => {
    const hits = retrieve("kv-cache", index, { expand: true });
    const firstRelated = hits.findIndex((h) => h.how === "related");
    const lastDirect = hits.map((h) => h.how !== "related").lastIndexOf(true);
    expect(firstRelated).toBeGreaterThan(lastDirect);
  });

  it("不开 expand 时行为不变", () => {
    expect(retrieve("kv-cache", index)).toEqual(retrieve("kv-cache", index, { expand: false }));
  });

  it("扩展只走一跳，不会把整个图拖进来", () => {
    // 查 block-table：一跳到 paged-attention；paged-attention 再连 kv-cache，
    // kv-cache 再连 chunked-prefill —— 三跳的 chunked-prefill 不该出现。
    const hits = retrieve("block-table", index, { expand: true, limit: 10 });
    expect(hits.find((h) => h.id === "chunked-prefill")).toBeUndefined();
  });

  it("一页什么都没命中时，扩展不产生结果", () => {
    expect(retrieve("今天天气怎么样", index, { expand: true })).toEqual([]);
  });
});

describe("retrieve · BM25 计分（2026-09-23 重做：宽松命中不给固定高分）", () => {
  // 复刻 09-23 的真实病例：HCCL 问题里「vllm-ascend」宽松命中两个总览页，
  // 固定 800 分把关键词命中的正确页压到第 3。BM25 下常见片段自然低分。
  const caseIndex = buildIndex([
    {
      id: "vllm-ascend-overview",
      title: "vLLM-Ascend 是什么",
      aliases: ["vllm-ascend", "昇腾插件"],
      summary: "让 vLLM 跑在昇腾上的插件。",
      chapters: ["00"],
      evidence: "C",
      text: "## 一句话\n它注册平台插件。",
    },
    {
      id: "vllm-ascend-repo-map",
      title: "vllm_ascend 目录地图",
      aliases: ["目录结构"],
      summary: "仓库各目录都放什么。",
      chapters: ["00"],
      evidence: "C",
      text: "## 一句话\n从入口读起。",
    },
    {
      id: "hccl-buffer",
      title: "HCCL 通信缓冲区怎么定",
      aliases: ["HCCL_BUFFSIZE", "hccl_buffer_size"],
      summary: "默认 200，dp 组自己算，MC2 组不能单独配。",
      chapters: ["13"],
      evidence: "C",
      text: "## 一句话\n每个通信组建组时决定缓冲区大小。",
    },
  ]);

  it("常见标识符片段压不过具体页的关键词命中（09-23 HCCL 病例）", () => {
    const hits = retrieve(
      "vllm-ascend 里 HCCL 通信缓冲区的大小（HCCL_BUFFSIZE / hccl_buffer_size）是怎么定的？哪些通信组用默认值？",
      caseIndex,
    );
    expect(hits[0]?.id).toBe("hccl-buffer");
  });

  it("只被一页认领的标识符宽松命中仍然排最前", () => {
    expect(retrieve("hccl_buffsize 是多少", caseIndex)[0]?.id).toBe("hccl-buffer");
  });

  it("标题命中 > 摘要命中 > 正文命中", () => {
    const fieldIndex = buildIndex(
      (
        [
          ["in-title", "prefetch 开关", ["别名甲"], "别的话。", "别的正文。"],
          ["in-summary", "另一页", ["别名乙"], "prefetch 的比例。", "别的正文。"],
          ["in-body", "第三页", ["别名丙"], "别的话。", "正文里提到 prefetch 一次。"],
        ] as const
      ).map(([id, title, aliases, summary, text]) => ({
        id,
        title,
        aliases: [...aliases],
        summary,
        chapters: ["00"],
        evidence: "C",
        text,
      })),
    );
    expect(retrieve("prefetch", fieldIndex).map((h) => h.id)).toEqual(["in-title", "in-summary", "in-body"]);
  });

  it("罕见词比满库都是的词权重高", () => {
    const idfIndex = buildIndex(
      [
        ["only-kvpp", "kvpp 组大小"],
        ["config-a", "config 之一"],
        ["config-b", "config 之二"],
        ["config-c", "config 之三"],
      ].map(([id, title]) => ({
        id: id!,
        title: title!,
        aliases: [],
        summary: "各不相干。",
        chapters: ["00"],
        evidence: "C",
        text: "正文。",
      })),
    );
    // 每页都各命中一个词；kvpp 只有一页有，config 四分之三的页都有
    expect(retrieve("kvpp config", idfIndex)[0]?.id).toBe("only-kvpp");
  });

  it("kv cache 这类命中三个相关页的写法不再被降权", () => {
    expect(retrieve("kv cache 显存怎么算", index)[0]?.id).toBe("kv-cache");
  });

  it("问的是本词时，同族长 id 的页不插到它前面（名字最接近的靠前）", () => {
    const family = buildIndex(
      (
        [
          ["kv-cache", "KV Cache"],
          ["kv-cache-spec", "KV Cache Spec"],
          ["kv-cache-memory-profiling", "KV Cache Memory Profiling"],
        ] as const
      ).map(([id, title]) => ({
        id,
        title,
        aliases: [],
        summary: "一句话。",
        chapters: ["00"],
        evidence: "C",
        text: "正文。",
      })),
    );
    expect(retrieve("什么是 KV Cache？", family)[0]?.id).toBe("kv-cache");
  });

  it("片段只占长别名开头一小截时按占比打折：问 prefill 不该输给 Prefill Context Parallel", () => {
    // 复刻真实病例：context-parallel 的别名里有 Prefill Context Parallel 和
    // Decode Context Parallel，「prefill 和 decode 有什么区别」两个片段都被它认领
    const idx = buildIndex([
      {
        id: "prefill",
        title: "Prefill",
        aliases: ["预填充", "prefill 阶段", "TTFT"],
        summary: "首 token 阶段，之后进入 decode。",
        chapters: ["00"],
        evidence: "C",
        text: "prefill 算完首 token，decode 逐 token 生成。",
      },
      {
        id: "context-parallel",
        title: "Context Parallel：把序列维切到多张卡上",
        aliases: ["Prefill Context Parallel", "Decode Context Parallel", "PCP", "DCP"],
        summary: "上下文并行。",
        chapters: ["00"],
        evidence: "C",
        text: "正文。",
      },
      {
        // 真实库里 prefill / decode 满地都是、idf 很低，夹具里也要不止一页提到，
        // 否则「decode 只有 context-parallel 有」会让它理所当然地排第一
        id: "pd-disaggregation",
        title: "PD 分离",
        aliases: ["Prefill/Decode 分离"],
        summary: "P 算 prefill，D 算 decode。",
        chapters: ["00"],
        evidence: "C",
        text: "正文。",
      },
      // 无关填充页：把库撑到接近真实的页数比例，否则三页库里词词都稀有，idf 全失真
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `filler-${i}`,
        title: `无关主题${i}`,
        aliases: [],
        summary: "别的话题。",
        chapters: ["00"],
        evidence: "C",
        text: "与并行无关的正文。",
      })),
    ]);
    expect(retrieve("prefill 和 decode 有什么区别？", idx)[0]?.id).toBe("prefill");
  });
});

describe("retrieve · 标识符的宽松写法（用户 2026-09-11 提出）", () => {
  it("空格写法能命中下划线/连字符的 id：layer sharding → layer-sharding", () => {
    expect(retrieve("layer sharding", index)[0]?.id).toBe("layer-sharding");
  });

  it("写不全也能命中：layer share → layer-sharding", () => {
    expect(retrieve("layer share", index)[0]?.id).toBe("layer-sharding");
  });

  it("连写能命中：kvcache → kv-cache", () => {
    expect(retrieve("kvcache", index)[0]?.id).toBe("kv-cache");
  });

  it("大小写与分隔符都不敏感：Paged_Attention → paged-attention", () => {
    expect(retrieve("Paged_Attention", index)[0]?.id).toBe("paged-attention");
  });

  it("中文别名照常命中", () => {
    expect(retrieve("层切分", index)[0]?.id).toBe("layer-sharding");
  });

  it("带疑问句也能剥出标识符：layer share 是什么意思", () => {
    expect(retrieve("layer share 是什么意思", index)[0]?.id).toBe("layer-sharding");
  });

  it("宽松命中要标明，不要冒充精确命中", () => {
    expect(retrieve("layer share", index)[0]?.how).toBe("fuzzy");
    expect(retrieve("layer-sharding", index)[0]?.how).toBe("exact");
  });

  it("过短的片段不触发宽松匹配，避免误命中", () => {
    expect(retrieve("la", index)).toEqual([]);
  });
});

describe("terms 与技术词检索（Task 751：缩写、数字精度名、驼峰、CLI 与中英混排）", () => {
  it("RoPE / LoRA / MoE 等大小写交错缩写保留完整词，不被拆成双字母碎片，且超长连续串保持线性耗时", () => {
    expect(terms("RoPE")).toEqual(["rope"]);
    expect(terms("LoRA MoE")).toEqual(["lora", "moe"]);
    expect(terms("NPUPlatform")).toEqual(["npuplatform", "npu", "platform"]);
    const start = performance.now();
    expect(terms("x".repeat(100_000))).toHaveLength(1);
    expect(terms("X".repeat(100_000))).toHaveLength(1);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("W8A8 / FP8 / BF16 等字母数字混合词不被数字边界拆碎，大小写查询对称", () => {
    expect(terms("W8A8")).toEqual(["w8a8"]);
    expect(terms("w8a8")).toEqual(["w8a8"]);
    const quantIdx = buildIndex([
      {
        id: "quant-guide",
        title: "权重量化实践",
        aliases: [],
        summary: "昇腾量化概览。",
        chapters: ["08"],
        evidence: "C",
        text: "在线服务常开启 W8A8 动态量化降低显存。",
      },
      {
        id: "w8a8-param",
        title: "w8a8_dynamic",
        aliases: [],
        summary: "动态量化配置项。",
        chapters: ["08"],
        evidence: "C",
        text: "激活按 token 动态缩放。",
      },
    ]);
    expect(retrieve("w8a8", quantIdx).map((h) => h.id)).toEqual(["w8a8-param", "quant-guide"]);
    expect(retrieve("W8A8", quantIdx).map((h) => h.id)).toEqual(["w8a8-param", "quant-guide"]);
  });

  it("AllReduce / allreduce / all_reduce / all-reduce 四种写法双向互通", () => {
    const commIdx = buildIndex([
      {
        id: "camel-doc",
        title: "集合通信概述",
        aliases: [],
        summary: "多卡归约。",
        chapters: ["13"],
        evidence: "C",
        text: "张量并行每层执行一次 AllReduce 同步激活。",
      },
      {
        id: "fuse-op",
        title: "融合算子",
        aliases: [],
        summary: "通信计算融合。",
        chapters: ["16"],
        evidence: "C",
        text: "通过 fuse_allreduce_rms 把通信与归一化合并。",
      },
      {
        id: "snake-api",
        title: "分布式接口",
        aliases: [],
        summary: "底层调用。",
        chapters: ["13"],
        evidence: "C",
        text: "调用 dist.all_reduce 完成求和。",
      },
    ]);
    for (const q of ["AllReduce", "allreduce", "all_reduce", "all-reduce"]) {
      expect(
        retrieve(q, commIdx)
          .map((h) => h.id)
          .sort(),
        q,
      ).toEqual(["camel-doc", "fuse-op", "snake-api"]);
    }
  });

  it("FP8量化、开启RoPE 等中英紧邻混排在脚本边界切开，不产生跨界伪二元串", () => {
    expect(terms("FP8量化")).toEqual(["fp8", "量化"]);
    expect(terms("开启RoPE位置编码")).toEqual(["开启", "rope", "位置", "置编", "编码"]);
    const mixedIdx = buildIndex([
      {
        id: "fp8-mixed",
        title: "精度格式说明",
        aliases: [],
        summary: "低比特推理。",
        chapters: ["08"],
        evidence: "C",
        text: "Hopper 与部分新硬件支持 FP8量化 推理。",
      },
      {
        id: "rope-doc",
        title: "位置编码",
        aliases: [],
        summary: "旋转编码。",
        chapters: ["03"],
        evidence: "C",
        text: "融合算子 fuse_qknorm_rope 在单次访存内完成旋转。",
      },
    ]);
    expect(retrieve("FP8", mixedIdx)[0]?.id).toBe("fp8-mixed");
    expect(retrieve("FP8量化", mixedIdx)[0]?.id).toBe("fp8-mixed");
    expect(retrieve("RoPE 怎么融合", mixedIdx)[0]?.id).toBe("rope-doc");
  });

  it("CLI 开关（含双横线别名、命令串内参数及 -O2 等带数字短选项）可稳定命中标题与正文", () => {
    const cliIdx = buildIndex([
      {
        id: "eager-flag",
        title: "图模式回退",
        aliases: ["--enforce-eager"],
        summary: "关闭图捕获。",
        chapters: ["16"],
        evidence: "C",
        text: "排障时可先回退单算子执行。",
      },
      {
        id: "opt-level",
        title: "编译优化级别",
        aliases: [],
        summary: "图编译配置。",
        chapters: ["16"],
        evidence: "C",
        text: "命令行传入 `vllm serve -O2 --enable-chunked-prefill` 控制档位。",
      },
    ]);
    expect(retrieve("vllm serve --enforce-eager 排障", cliIdx)[0]?.id).toBe("eager-flag");
    expect(retrieve("-O2", cliIdx)[0]?.id).toBe("opt-level");
    expect(retrieve("--enable-chunked-prefill", cliIdx)[0]?.id).toBe("opt-level");
  });

  it("紧凑序列化索引不含正文原文，且还原后保持精确/宽松/BM25/图扩展/社区语料隔离一致", () => {
    const rev = "a".repeat(64);
    const serialized = serializeSearchIndex(index, rev);
    const rawJson = JSON.stringify(serialized);
    expect(rawJson).not.toContain("每 token 每层 4 KiB");
    expect(rawJson).not.toContain("昇腾后端默认走 FIA 不是 PA");
    expect(rawJson).not.toContain("compiled");
    expect(rawJson).not.toContain("diagrams");

    const restored = deserializeSearchIndex(JSON.parse(rawJson));
    const corpus = [
      {
        id: "issue-1",
        title: "HCCL timeout",
        url: "https://github.com/vllm-project/vllm-ascend/issues/1",
        text: "RuntimeError: HCCL collective timeout after 120 seconds",
      },
    ];
    for (const q of [
      "kv-cache",
      "layer share",
      "block table 是干嘛的",
      "RuntimeError: HCCL collective timeout after 60 seconds",
    ]) {
      expect(retrieve(q, restored, { expand: true, corpus }), q).toEqual(
        retrieve(q, index, { expand: true, corpus }),
      );
    }
  });
});
