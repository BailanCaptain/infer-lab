import { describe, expect, it } from "vitest";
import { prOf } from "./lineage";

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
