import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planClone, worktreeDir } from "./clone";
import { parseSeeds } from "./ingest";

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
    expect(plan).toHaveProperty("updateWorktrees", [
      { ref: "releases/v0.23.0", commit: "9b4b1e2a", dir: "tools/repos/vllm-ascend@releases-v0.23.0" },
    ]);
  });

  it("不回收该仓库上其他用途的工作树", () => {
    const plan = planClone({ worktrees: [repo.path, "tools/user-checkout"], isRepo: true }, repo);
    expect(plan.pruneWorktrees).toEqual([]);
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

  it("为 seeds 声明的 pins 与 40 位独立提交生成 refs/wiki-pins 恢复计划，并在新克隆下救回脱离分支的固定提交", () => {
    const upstream = mkdtempSync(join(tmpdir(), "wiki-clone-up-"));
    const ws = mkdtempSync(join(tmpdir(), "wiki-clone-ws-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main", upstream]);
      execFileSync("git", ["-C", upstream, "config", "user.email", "t@example.com"]);
      execFileSync("git", ["-C", upstream, "config", "user.name", "t"]);
      execFileSync("git", ["-C", upstream, "config", "uploadpack.allowAnySHA1InWant", "true"]);

      writeFileSync(join(upstream, "main.py"), "main\n");
      execFileSync("git", ["-C", upstream, "add", "-A"]);
      execFileSync("git", ["-C", upstream, "commit", "-q", "-m", "main commit"]);
      const mainSha = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();

      // 创建一个随后删除分支的独立提交（模拟脱离分支/tag 的 db701c1f / ced6857a）
      execFileSync("git", ["-C", upstream, "checkout", "-q", "-b", "temp-pr"]);
      writeFileSync(join(upstream, "glm.py"), "glm5\n");
      execFileSync("git", ["-C", upstream, "add", "-A"]);
      execFileSync("git", ["-C", upstream, "commit", "-q", "-m", "pr commit"]);
      const pinSha = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
      execFileSync("git", ["-C", upstream, "checkout", "-q", "main"]);
      execFileSync("git", ["-C", upstream, "branch", "-D", "temp-pr"]);

      const parsed = parseSeeds(
        [
          "repos:",
          "  demo:",
          `    url: "file://${upstream.replace(/\\/g, "/")}"`,
          "    path: tools/repos/demo",
          "    refs:",
          `      main: "${mainSha.slice(0, 8)}"`,
          "    pins:",
          `      glm-5-3-flash: "${pinSha}"`,
          "features: []",
          "",
        ].join("\n"),
      );
      const plan = planClone(null, parsed.repos.demo!) as ReturnType<typeof planClone> & {
        pinFetches?: { name: string; commit: string; refspec: string }[];
      };
      expect(plan.pinFetches).toEqual([
        {
          name: "glm-5-3-flash",
          commit: pinSha,
          refspec: `+${pinSha}:refs/wiki-pins/glm-5-3-flash`,
        },
      ]);

      // 在全新目录执行 plan.clone + plan.fetch 后，脱离分支的 pinSha 默认不可达；执行 pinFetches 后成功救回并锚定 refs/wiki-pins/glm-5-3-flash
      const targetDir = join(ws, "tools/repos/demo");
      execFileSync("git", plan.clone!, { cwd: ws });
      execFileSync("git", ["-C", targetDir, ...plan.fetch]);
      expect(() =>
        execFileSync("git", ["-C", targetDir, "cat-file", "-e", `${pinSha}^{commit}`], { stdio: "ignore" }),
      ).toThrow();

      for (const p of plan.pinFetches ?? []) {
        execFileSync("git", ["-C", targetDir, "fetch", "-q", "origin", p.refspec]);
      }
      expect(
        execFileSync("git", ["-C", targetDir, "rev-parse", "refs/wiki-pins/glm-5-3-flash"], {
          encoding: "utf8",
        }).trim(),
      ).toBe(pinSha);
    } finally {
      rmSync(upstream, { recursive: true, force: true });
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
