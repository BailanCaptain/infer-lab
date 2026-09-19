import { describe, expect, it } from "vitest";
import { CHAPTER_TITLES } from "./chapters";
import { pageFrontmatterSchema, parseRawRef, parseRepoRef, registrySchema } from "./schema";

const ok = {
  id: "kv-cache",
  title: "KV Cache",
  type: "concept",
  summary: "缓存每层每个 token 的 K 与 V，decode 时不再重算。",
  aliases: ["KV 缓存"],
  chapters: ["05", "11"],
  sources: ["vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L120-L188"],
  evidence: "C",
  related: ["paged-attention"],
  updated: "2026-09-07",
};

describe("pageFrontmatterSchema", () => {
  it("accepts only immutable local references with bounded positive line numbers", () => {
    const path = `sha256-${"a".repeat(64)}.md`;
    const ref = `raw:${path}#L2-L3`;
    expect(parseRawRef(ref)).toEqual({ path: `raw/${path}`, lineStart: 2, lineEnd: 3 });
    expect(pageFrontmatterSchema.parse({ ...ok, sources: [ref] }).sources).toEqual([ref]);
    for (const bad of [
      `raw:../${path}#L1`,
      `raw:C:/${path}#L1`,
      `raw:${path}`,
      `raw:${path}#L0`,
      `raw:${path}#L3-L2`,
      `raw:${path}#L9007199254740992`,
      `raw:%2e%2e/${path}#L1`,
    ]) {
      expect(parseRawRef(bad)).toBeNull();
      expect(pageFrontmatterSchema.safeParse({ ...ok, sources: [bad] }).success).toBe(false);
    }
  });
  it("合法页通过，可选数组有默认值", () => {
    const r = pageFrontmatterSchema.parse({ ...ok, aliases: undefined, related: undefined });
    expect(r.aliases).toEqual([]);
    expect(r.related).toEqual([]);
    expect(r.contradicts).toEqual([]);
    expect(r.origin).toBe("seed");
    expect(pageFrontmatterSchema.parse({ ...ok, origin: "drop" }).origin).toBe("drop");
  });
  it("空 sources 拒收", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, sources: [] })).toThrow(/sources/);
  });
  it("sources 只接受 repo@commit:path#L 或 URL", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, sources: ["attention_v1.py"] })).toThrow();
    expect(pageFrontmatterSchema.parse({ ...ok, sources: ["https://docs.vllm.ai/x"] }).sources).toHaveLength(
      1,
    );
  });
  it("id 必须 kebab-case，evidence 只认七档，updated 必须是日期串", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, id: "KV_Cache" })).toThrow();
    expect(() => pageFrontmatterSchema.parse({ ...ok, evidence: "X" })).toThrow();
    expect(pageFrontmatterSchema.parse({ ...ok, evidence: "!" }).evidence).toBe("!");
    expect(() => pageFrontmatterSchema.parse({ ...ok, updated: "昨天" })).toThrow();
  });
  it("parseRepoRef 拆出 repo/commit/path/行号", () => {
    expect(parseRepoRef("vllm-ascend@28bf3a2e:a/b.py#L10-L20")).toEqual({
      repo: "vllm-ascend",
      commit: "28bf3a2e",
      path: "a/b.py",
      lineStart: 10,
      lineEnd: 20,
    });
    expect(parseRepoRef("vllm-ascend@28bf3a2e:a/b.py")).toEqual({
      repo: "vllm-ascend",
      commit: "28bf3a2e",
      path: "a/b.py",
    });
    expect(parseRepoRef("https://x")).toBeNull();
  });
  it("registry 是 pages 数组，每项多一个 file", () => {
    const r = registrySchema.parse({ version: 1, pages: [{ ...ok, file: "concepts/kv-cache.md" }] });
    expect(r.pages[0]?.file).toBe("concepts/kv-cache.md");
  });
});

describe("CHAPTER_TITLES", () => {
  it("00 到 21 共 22 章", () => {
    expect(Object.keys(CHAPTER_TITLES)).toHaveLength(22);
    expect(CHAPTER_TITLES["11"]).toBe("KV Cache 内存系统");
  });
});
