import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearBlobCache, createBlobReader, gitStats, warmBlobs } from "./git";

let repo: string;
let commit: string;
const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "wiki-git-"));
  execFileSync("git", ["init", "-q", repo]);
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("config", "core.autocrlf", "false");
  mkdirSync(join(repo, "pkg"));
  writeFileSync(join(repo, "pkg/a.py"), "line1\nline2\n");
  writeFileSync(join(repo, "pkg/b.py"), "末尾没有换行");
  writeFileSync(join(repo, "pkg/空 格.md"), "# 标题\n\n正文\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  commit = git("rev-parse", "--short", "HEAD");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));
beforeEach(() => clearBlobCache());

describe("warmBlobs", () => {
  it("批量读进来的内容与逐个读的逐字相同", () => {
    const paths = ["pkg/a.py", "pkg/b.py", "pkg/空 格.md"];
    const single = paths.map((p) => createBlobReader()(repo, commit, p));
    clearBlobCache();
    warmBlobs(
      repo,
      paths.map((path) => ({ commit, path })),
    );
    const warmed = paths.map((p) => createBlobReader()(repo, commit, p));
    expect(warmed).toEqual(single);
    expect(warmed[1]).toEqual({ kind: "ok", text: "末尾没有换行" });
  });

  it("预热之后再读不再起 git 进程，且跨 reader 共享", () => {
    const paths = Array.from({ length: 3 }, (_, i) => ["pkg/a.py", "pkg/b.py", "pkg/空 格.md"][i]!);
    warmBlobs(
      repo,
      paths.map((path) => ({ commit, path })),
    );
    const before = gitStats.spawns;
    for (const p of paths) expect(createBlobReader()(repo, commit, p).kind).toBe("ok");
    for (const p of paths) expect(createBlobReader()(repo, commit, p).kind).toBe("ok");
    expect(gitStats.spawns).toBe(before);
  });

  it("进程数不随文件数增长", () => {
    const before = gitStats.spawns;
    warmBlobs(
      repo,
      ["pkg/a.py", "pkg/b.py", "pkg/空 格.md"].map((path) => ({ commit, path })),
    );
    // 仓库可读性 + commit 校验 + 一次 ls-tree + 一次 cat-file --batch
    expect(gitStats.spawns - before).toBeLessThanOrEqual(4);
  });

  it("不存在的文件与目录判为 missing-file，不存在的 commit 判为 invalid-commit", () => {
    warmBlobs(repo, [
      { commit, path: "pkg/nope.py" },
      { commit, path: "pkg" },
      { commit: "deadbeef", path: "pkg/a.py" },
    ]);
    const read = createBlobReader();
    expect(read(repo, commit, "pkg/nope.py")).toEqual({ kind: "missing-file" });
    expect(read(repo, commit, "pkg")).toEqual({ kind: "missing-file" });
    expect(read(repo, "deadbeef", "pkg/a.py")).toEqual({ kind: "invalid-commit" });
  });

  it("不可读的仓库要报错，不能伪装成缺文件", () => {
    expect(() => warmBlobs(join(repo, "not-a-repo"), [{ commit, path: "pkg/a.py" }])).toThrow();
  });

  it("单次审计批次内对同一缺失 commit 做有界负缓存，不按引用条数重复拉起 git 进程", () => {
    warmBlobs(repo, [
      { commit: "deadbeef", path: "pkg/a.py" },
      { commit: "deadbeef", path: "pkg/b.py" },
    ]);
    const read = createBlobReader();
    const before = gitStats.spawns;
    expect(read(repo, "deadbeef", "pkg/a.py")).toEqual({ kind: "invalid-commit" });
    expect(read(repo, "deadbeef", "pkg/b.py")).toEqual({ kind: "invalid-commit" });
    expect(read(repo, "deadbeef", "pkg/空 格.md")).toEqual({ kind: "invalid-commit" });
    expect(gitStats.spawns).toBe(before);
  });

  it("缺失 commit 在同进程 git fetch 补齐后（不调 clearBlobCache）立即恢复可读", () => {
    const upstream = mkdtempSync(join(tmpdir(), "wiki-git-up-"));
    const mirror = mkdtempSync(join(tmpdir(), "wiki-git-down-"));
    try {
      execFileSync("git", ["init", "-q", upstream]);
      execFileSync("git", ["-C", upstream, "config", "user.email", "t@example.com"]);
      execFileSync("git", ["-C", upstream, "config", "user.name", "t"]);
      execFileSync("git", ["-C", upstream, "config", "core.autocrlf", "false"]);
      execFileSync("git", ["-C", upstream, "config", "uploadpack.allowAnySHA1InWant", "true"]);
      writeFileSync(join(upstream, "base.py"), "base\n");
      execFileSync("git", ["-C", upstream, "add", "-A"]);
      execFileSync("git", ["-C", upstream, "commit", "-q", "-m", "c1"]);

      execFileSync("git", ["clone", "-q", upstream, mirror]);
      writeFileSync(join(upstream, "fetched.py"), "fresh evidence\n");
      execFileSync("git", ["-C", upstream, "add", "-A"]);
      execFileSync("git", ["-C", upstream, "commit", "-q", "-m", "c2"]);
      const fetchedSha = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();

      // 此时 mirror 尚未 fetch c2：首次预热与读取均判 invalid-commit，且命中单批负缓存
      warmBlobs(mirror, [{ commit: fetchedSha, path: "fetched.py" }]);
      const read = createBlobReader();
      expect(read(mirror, fetchedSha, "fetched.py")).toEqual({ kind: "invalid-commit" });
      const spawnsAfterMiss = gitStats.spawns;
      expect(read(mirror, fetchedSha, "fetched.py")).toEqual({ kind: "invalid-commit" });
      expect(gitStats.spawns).toBe(spawnsAfterMiss);

      // 在同一进程中执行 git fetch 补齐该 SHA，不调用 clearBlobCache()
      execFileSync("git", ["-C", mirror, "fetch", "-q", "origin", fetchedSha]);

      // 同一 reader 与新创建的 reader 都必须感知仓库状态变化并读出真实源码
      expect(read(mirror, fetchedSha, "fetched.py")).toEqual({ kind: "ok", text: "fresh evidence\n" });
      expect(createBlobReader()(mirror, fetchedSha, "fetched.py")).toEqual({
        kind: "ok",
        text: "fresh evidence\n",
      });
    } finally {
      rmSync(upstream, { recursive: true, force: true });
      rmSync(mirror, { recursive: true, force: true });
    }
  });
});
