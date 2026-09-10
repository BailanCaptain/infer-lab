import { describe, expect, it } from "vitest";
import { buildIndex, citationCheck, type PageIndex, retrieve } from "./retrieve";

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
