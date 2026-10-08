import { describe, expect, it } from "vitest";
import { lineageTerm, prOf } from "./lineage";

describe("prOf", () => {
  it("从提交标题末尾取 PR 号", () => {
    expect(prOf("[Refactor] remove layer sharding (#11953)")).toBe(11953);
    expect(prOf("  fix something (#1)  ")).toBe(1);
  });

  it("标题中间的 (#n) 不算——只认末尾那个", () => {
    expect(prOf("revert (#123) because of regression")).toBeUndefined();
    expect(prOf("no pr here")).toBeUndefined();
  });
});

// Presence, boundaries, tags, impact and rendering use real Git regression fixtures in lineage-git.test.ts.

describe("lineageTerm", () => {
  it("标题就是参数名时原样返回", () => {
    expect(lineageTerm("enable_matmul_allreduce")).toBe("enable_matmul_allreduce");
  });

  it("标题写成「中文名（参数名）」时取括号里的参数名——2026-09-20 统一写法后 profiling-chunk-config 就是这样", () => {
    expect(lineageTerm("动态切块配置（profiling_chunk_config）")).toBe("profiling_chunk_config");
    expect(lineageTerm("Layer Sharding (layer_sharding)：按层分片")).toBe("layer_sharding");
  });

  it("标题里找不到标识符就返回 undefined，调用方跳过这一页而不是整批失败", () => {
    expect(lineageTerm("动态切块配置")).toBeUndefined();
  });
});
