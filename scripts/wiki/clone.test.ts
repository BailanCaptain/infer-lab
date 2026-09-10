import { describe, expect, it } from "vitest";
import { planClone, worktreeDir } from "./clone";

const repo = {
  url: "https://github.com/vllm-project/vllm-ascend",
  path: "tools/repos/vllm-ascend",
  refs: { main: "28bf3a2e", "releases/v0.23.0": "9b4b1e2a" },
};

describe("worktreeDir", () => {
  it("main 用仓库主目录，其它 ref 各自一份，ref 里的斜杠转成短横", () => {
    expect(worktreeDir(repo, "main")).toBe("tools/repos/vllm-ascend");
    expect(worktreeDir(repo, "releases/v0.23.0")).toBe("tools/repos/vllm-ascend@releases-v0.23.0");
  });
});

describe("planClone", () => {
  it("目录不存在时用完整克隆，绝不带 blob:none", () => {
    const plan = planClone(null, repo);
    expect(plan.clone).toEqual(["clone", "--no-checkout", repo.url, repo.path]);
    expect(plan.clone).not.toContain("--filter=blob:none");
    expect(plan.clone).not.toContain("--depth");
  });

  it("目录存在但不是 git 仓库（残留空目录）时，仍走克隆而不是当成已存在", () => {
    // Windows 上 rm -rf 可能清空内容却删不掉目录（Device or resource busy），
    // 判断依据必须是「是不是仓库」而不是「目录在不在」。
    const plan = planClone({ worktrees: [], isRepo: false }, repo);
    expect(plan.clone).toEqual(["clone", "--no-checkout", repo.url, repo.path]);
    expect(plan.reuseExistingDir).toBe(true);
  });

  it("克隆后要抓全部分支与 tag，否则跨 ref 查询会漏", () => {
    const plan = planClone(null, repo);
    expect(plan.fetch).toEqual([
      "fetch",
      "origin",
      "+refs/heads/*:refs/remotes/origin/*",
      "--tags",
      "--prune",
    ]);
  });

  it("已存在则不重新克隆，仍然刷新 refs", () => {
    const plan = planClone({ worktrees: ["tools/repos/vllm-ascend"], isRepo: true }, repo);
    expect(plan.clone).toBeNull();
    expect(plan.fetch[0]).toBe("fetch");
  });

  it("为每个缺失的非 main ref 建工作树", () => {
    const plan = planClone({ worktrees: ["tools/repos/vllm-ascend"], isRepo: true }, repo);
    expect(plan.addWorktrees).toEqual([
      { ref: "releases/v0.23.0", commit: "9b4b1e2a", dir: "tools/repos/vllm-ascend@releases-v0.23.0" },
    ]);
  });

  it("已存在的工作树不重复建", () => {
    const plan = planClone(
      { worktrees: ["tools/repos/vllm-ascend", "tools/repos/vllm-ascend@releases-v0.23.0"], isRepo: true },
      repo,
    );
    expect(plan.addWorktrees).toEqual([]);
  });

  it("回收不再被 seeds 引用的工作树", () => {
    const plan = planClone(
      { worktrees: ["tools/repos/vllm-ascend", "tools/repos/vllm-ascend@releases-v0.18.0"], isRepo: true },
      repo,
    );
    expect(plan.pruneWorktrees).toEqual(["tools/repos/vllm-ascend@releases-v0.18.0"]);
  });

  it("main 的工作树永不回收", () => {
    const plan = planClone({ worktrees: ["tools/repos/vllm-ascend"], isRepo: true }, repo);
    expect(plan.pruneWorktrees).toEqual([]);
  });

  it("main 要 checkout 到钉住的 commit", () => {
    const plan = planClone({ worktrees: ["tools/repos/vllm-ascend"], isRepo: true }, repo);
    expect(plan.checkoutMain).toEqual(["checkout", "--detach", "28bf3a2e"]);
  });
});
