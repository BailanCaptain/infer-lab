import { describe, expect, it } from "vitest";
import { CHAPTER_TITLES } from "./chapters";
import {
  pageFrontmatterSchema,
  parseRawRef,
  parseRepoRef,
  rawSourceHref,
  readerManifestSchema,
  registrySchema,
  resolveCanonicalPageId,
} from "./schema";

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
    expect(rawSourceHref(ref)).toBe(`./wiki-raw/sha256-${"a".repeat(64)}.html?lines=2-3#L2`);
    expect(rawSourceHref(`raw:${path}#L5`)).toBe(`./wiki-raw/sha256-${"a".repeat(64)}.html?lines=5#L5`);
    expect(rawSourceHref(`raw:../${path}#L1`)).toBeNull();
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
    expect(pageFrontmatterSchema.parse({ ...ok, origin: "direct" }).origin).toBe("direct");
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
    expect(Object.hasOwn(r.pages[0]!, "legacyIds")).toBe(false);
  });

  it("legacyIds 独立于人类 aliases：保留合法旧路由 ID、拒绝非法/自指/跨页重复/占用其他页 canonical ID，且共用解析不匹配 title/aliases", () => {
    const parsedFm = pageFrontmatterSchema.parse({ ...ok, legacyIds: ["kv-cache-v0", "former-kv"] });
    expect(parsedFm.legacyIds).toEqual(["kv-cache-v0", "former-kv"]);
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyIds: ["KV_Cache"] }).success).toBe(false);
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyIds: ["kv-cache"] }).success).toBe(false);
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyIds: ["dup-old", "dup-old"] }).success).toBe(false);

    const entry = (id: string, legacyIds?: string[], aliases = ["Human Alias", "alias-slug"]) => ({
      ...ok,
      id,
      title: `Title ${id}`,
      aliases,
      ...(legacyIds !== undefined ? { legacyIds } : {}),
      file: `concepts/${id}.md`,
    });

    const validReg = registrySchema.parse({
      version: 1,
      pages: [entry("current-page", ["former-page"]), entry("other-page", [])],
    });
    expect(Object.hasOwn(validReg.pages[0]!, "legacyIds")).toBe(true);
    expect(validReg.pages[0]?.legacyIds).toEqual(["former-page"]);

    // 跨页重复 legacyIds 必须拒绝
    expect(
      registrySchema.safeParse({
        version: 1,
        pages: [entry("one", ["old-shared"]), entry("two", ["old-shared"])],
      }).success,
    ).toBe(false);

    // legacyIds 占用其他页 canonical id（无论先后顺序）必须在 registry 与 manifest 入口拒绝
    expect(
      registrySchema.safeParse({
        version: 1,
        pages: [entry("one", ["two"]), entry("two", [])],
      }).success,
    ).toBe(false);
    expect(
      readerManifestSchema.safeParse({
        revision: "a".repeat(64),
        registry: { version: 1, pages: [entry("two", []), entry("one", ["two"])] },
      }).success,
    ).toBe(false);

    // manifest 联查 skipped[].id：健康页 legacyIds 抢占被跳过页规范 ID 必须拒绝，无冲突 skipped 正常通过
    expect(
      readerManifestSchema.safeParse({
        revision: "a".repeat(64),
        registry: { version: 1, pages: [entry("healthy", ["unavailable"])] },
        skipped: [{ id: "unavailable", file: "concepts/unavailable.md", reason: "[schema] invalid" }],
      }).success,
    ).toBe(false);
    expect(
      readerManifestSchema.safeParse({
        revision: "a".repeat(64),
        registry: { version: 1, pages: [entry("healthy", ["former-healthy"])] },
        skipped: [{ id: "unavailable", file: "concepts/unavailable.md", reason: "[schema] invalid" }],
      }).success,
    ).toBe(true);

    expect(resolveCanonicalPageId(validReg.pages, "current-page")).toBe("current-page");
    expect(resolveCanonicalPageId(validReg.pages, "former-page")).toBe("current-page");
    expect(resolveCanonicalPageId(validReg.pages, "Title current-page")).toBeUndefined();
    expect(resolveCanonicalPageId(validReg.pages, "Human Alias")).toBeUndefined();
    expect(resolveCanonicalPageId(validReg.pages, "alias-slug")).toBeUndefined();
    expect(resolveCanonicalPageId(validReg.pages, "missing-page")).toBeUndefined();
  });

  it("legacyAnchors 校验规范 slug、非空目标与自指冲突，省略时不落空对象", () => {
    const valid = pageFrontmatterSchema.parse({
      ...ok,
      legacyAnchors: {
        "old-heading": "新标题名称",
        "old-slug-2": "existing-slug-1",
      },
    });
    expect(valid.legacyAnchors).toEqual({
      "old-heading": "新标题名称",
      "old-slug-2": "existing-slug-1",
    });

    const regWithout = registrySchema.parse({
      version: 1,
      pages: [{ ...ok, file: "concepts/kv-cache.md" }],
    });
    expect(Object.hasOwn(regWithout.pages[0]!, "legacyAnchors")).toBe(false);

    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyAnchors: { "Bad Space": "ok" } }).success).toBe(
      false,
    );
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyAnchors: { "#old": "ok" } }).success).toBe(false);
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyAnchors: { "old-key": "   " } }).success).toBe(
      false,
    );
    expect(pageFrontmatterSchema.safeParse({ ...ok, legacyAnchors: { "same-id": "same-id" } }).success).toBe(
      false,
    );
    expect(
      pageFrontmatterSchema.safeParse({ ...ok, legacyAnchors: { "same-title": "Same Title" } }).success,
    ).toBe(false);
  });
});

describe("CHAPTER_TITLES", () => {
  it("00 到 21 共 22 章", () => {
    expect(Object.keys(CHAPTER_TITLES)).toHaveLength(22);
    expect(CHAPTER_TITLES["11"]).toBe("KV cache 内存系统");
  });
});
