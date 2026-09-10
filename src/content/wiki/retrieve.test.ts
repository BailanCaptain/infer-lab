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
    text: "## 是什么\nblock table 是页表。",
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
