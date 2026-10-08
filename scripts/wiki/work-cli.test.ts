import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { wikiFixture } from "./test-fixture";

it("inspects without writing and refuses unbudgeted worker requests", () => {
  const f = wikiFixture();
  try {
    const result = f.cli("wiki-work", ["list"]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      gaps: [],
      assessments: [],
      worker: "budgeted-review-required",
      queue: [],
    });
    expect(existsSync(join(f.root, "wiki/_gaps.json"))).toBe(false);
    expect(existsSync(join(f.root, "wiki/_jobs"))).toBe(false);
    const worker = f.cli("wiki-work", ["run"]);
    expect(worker.status).not.toBe(0);
    expect(worker.stderr).toContain("没有待运行任务");
    const unbudgeted = f.cli("wiki-work", ["assess", "--gap", "a".repeat(64)]);
    expect(unbudgeted.status).not.toBe(0);
    expect(existsSync(join(f.root, "wiki/_jobs"))).toBe(false);
  } finally {
    f.cleanup();
  }
});
