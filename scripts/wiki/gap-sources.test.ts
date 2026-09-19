import { join } from "node:path";
import { expect, it } from "vitest";
import { parseRawRef } from "../../src/content/wiki/schema";
import { findGapSources } from "./gap-sources";
import { readRawSnapshot } from "./raw";
import { wikiFixture } from "./test-fixture";

it("locates a Chinese topic through its page aliases and honors the requested pinned release", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/prefix_caching.py", "prefix_caching_limit = 16\n");
    const old = f.commit("release");
    f.write("repo/vllm_ascend/prefix_caching.py", "prefix_caching_limit = 32\n");
    const main = f.commit("main");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${main}, 'releases/v0.23.0': ${old}}\nfeatures: []\n`,
    );
    f.write(
      "wiki/concepts/prefix-caching.md",
      `---\nid: prefix-caching\ntitle: Prefix Caching\naliases: [前缀缓存]\ntype: concept\nsummary: 前缀缓存\nsources: [r@${old}:vllm_ascend/prefix_caching.py#L1]\nevidence: C\nupdated: '2026-09-16'\n---\n## 一句话\n前缀缓存。[C1]\n`,
    );
    const sources = findGapSources(f.root, "v0.23.0 的前缀缓存上限是多少？");
    expect(sources).toHaveLength(1);
    const raw = readRawSnapshot(join(f.root, "wiki"), parseRawRef(sources[0]!)!.path);
    expect(raw).toContain(`${old}:`);
    expect(raw).toContain("= 16");
    expect(raw).not.toContain("= 32");
    expect(findGapSources(f.root, "v9.99.0 的前缀缓存上限是多少？")).toEqual([]);
  } finally {
    f.cleanup();
  }
});

it("uses pinned source lines and records the limited scope, excluding uncommitted edits and unmatched queries", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/config.py", `${"\n".repeat(20)}chunk_limit = 16\n${"\n".repeat(30)}`);
    const pin = f.commit("source");
    f.write(
      "wiki/seeds/vllm-ascend.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    f.write("repo/vllm_ascend/config.py", "chunk_limit = 999999\n");
    const sources = findGapSources(f.root, "chunk_limit main 默认是多少？");
    expect(sources).toHaveLength(1);
    const raw = readRawSnapshot(join(f.root, "wiki"), parseRawRef(sources[0]!)!.path);
    expect(raw).toContain(`r@${pin}:vllm_ascend/config.py#L21\nchunk_limit = 16`);
    expect(raw).toContain("未提供完整文件");
    expect(raw).not.toContain("999999");
    expect(findGapSources(f.root, "completely_unknown_identifier")).toEqual([]);
  } finally {
    f.cleanup();
  }
});
