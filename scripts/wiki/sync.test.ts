import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { lintLog } from "./lint";
import { isolated, syncWiki } from "./sync";
import { wikiFixture } from "./test-fixture";
import { digest, WorkflowStore } from "./workflow";

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
    const failed = await syncWiki(f.root, { seeds: "seeds.yaml", parameters: true });
    expect(failed.failures).toContainEqual({
      stage: "parameters:r:main",
      error: expect.stringContaining("rev-parse"),
    });
    const failure = JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"));
    expect(failure).toMatchObject({ status: "failed", phase: "worker" });
    expect(failure.failures[0].error).toContain("rev-parse");
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
    const result = await syncWiki(f.root, { seeds: "seeds.yaml", python });
    expect(result.failures).toContainEqual({
      stage: "parameters:r:main",
      error: expect.stringContaining(python),
    });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8"))).toMatchObject({
      status: "failed",
      phase: "worker",
    });
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_jobs/sync/daily-lease.json"), "utf8")).active).toBe(
      false,
    );
  } finally {
    f.cleanup();
  }
});

it("夜间任务的付费环节各自隔离失败：一处报错记进报告，后面的环节照跑", async () => {
  // 2026-09-23 审视：交叉审视或某个补写任务一抛错，同一晚后面的任务就全不跑了
  const ran: string[] = [];
  const failed = await isolated("reconcile", async () => {
    ran.push("reconcile");
    throw new Error("结构化判定材料超量");
  });
  const worked = await isolated("worker", async () => {
    ran.push("worker");
    return 1;
  });
  expect(failed).toEqual({ ok: false, stage: "reconcile", error: "Error: 结构化判定材料超量" });
  expect(worked).toEqual({ ok: true, value: 1 });
  expect(ran).toEqual(["reconcile", "worker"]);
});

it("recovers a dead process lease without leaving its previous receipt falsely running", async () => {
  const f = wikiFixture();
  try {
    f.write("seeds.yaml", "repos: {}\nfeatures: []\n");
    const old = { startedAt: "2026-01-01T00:00:00Z", status: "running", phase: "drift" };
    const pid = 2147483647;
    const abandoned = new WorkflowStore(f.root, { pid, isAlive: () => true });
    const job = await abandoned.enqueue(
      {
        origin: "seed",
        sources: [{ ref: "test", hash: "old" }],
        targets: ["a"],
        recipeHash: "recovery-test",
      },
      { accountingOnly: true },
    );
    await abandoned.claim(job.id);
    const history = `wiki/_jobs/sync/run-${digest(`${old.startedAt}:${pid}`)}.json`;
    f.write("wiki/_jobs/sync/daily-lease.json", JSON.stringify({ pid, active: true }));
    f.write("wiki/_jobs/sync/last-run.json", JSON.stringify(old));
    f.write(history, JSON.stringify(old));
    f.write("tools/wiki-runtime/workflow.lock", JSON.stringify({ pid, at: old.startedAt }));
    await syncWiki(f.root, { seeds: "seeds.yaml", parameters: false });
    expect(JSON.parse(readFileSync(join(f.root, history), "utf8"))).toMatchObject({
      status: "interrupted",
      phase: "drift",
      finishedAt: expect.any(String),
    });
    expect(new WorkflowStore(f.root).get(job.id).state).toBe("failed");
  } finally {
    f.cleanup();
  }
});
