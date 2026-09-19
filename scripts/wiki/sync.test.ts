import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { lintLog } from "./lint";
import { syncWiki } from "./sync";
import { wikiFixture } from "./test-fixture";

it("keeps daily maintenance uncharged, never starts initial corpus import, and logs failed steps", async () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/a.py", "class AConfig:\n    limit: int = 1\n");
    const pin = f.commit("pin");
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    const result = await syncWiki(f.root, {
      seeds: "seeds.yaml",
      parameters: false,
      github: true,
      githubRepo: "o/r",
    });
    expect(result.github).toMatchObject({ status: "needs-initial-import" });
    expect(result.modelCallsAllowed).toBe(false);
    expect(result.tasks).toEqual([]);
    await expect(syncWiki(f.root, { seeds: "seeds.yaml", reconcileBatches: 1 })).rejects.toThrow("paid");
    await expect(syncWiki(f.root, { seeds: "seeds.yaml", parameters: true })).rejects.toThrow();
    const failure = JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"));
    expect(failure).toMatchObject({ status: "failed", phase: "parameter-tip", repo: "r", ref: "main" });
    expect(failure.error).toContain("rev-parse");
    expect(failure.finishedAt).toBeTruthy();
    const log = readFileSync(join(f.root, "wiki/log.md"), "utf8");
    expect(log).toContain("本轮维护失败");
    expect(lintLog(log)).toEqual([]);
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/daily-lease.json"), "utf8")).active).toBe(
      false,
    );
  } finally {
    f.cleanup();
  }
});

it("uses the configured Python executable and keeps its failure diagnostic after releasing the lease", async () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/a.py", "class AConfig:\n    limit: int = 1\n");
    const pin = f.commit("pin");
    f.git(["update-ref", "refs/remotes/origin/main", pin]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${pin}}\nfeatures: []\n`,
    );
    const python = join(f.root, "missing-python");
    await expect(syncWiki(f.root, { seeds: "seeds.yaml", python })).rejects.toThrow(python);
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"))).toMatchObject({
      status: "failed",
      phase: "parameter-baseline",
      repo: "r",
      ref: "main",
    });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/daily-lease.json"), "utf8")).active).toBe(
      false,
    );
  } finally {
    f.cleanup();
  }
});
