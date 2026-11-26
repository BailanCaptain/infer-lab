import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearBlobCache,
  createBlobReader,
  GitError,
  gitStats,
  readBlobsAsync,
  setFastProbeSupportForTest,
  warmBlobs,
} from "./git";

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

describe("readBlobsAsync（在线证据的非阻塞批量读取）", () => {
  const paths = ["pkg/a.py", "pkg/b.py", "pkg/空 格.md"];
  const reqs = () => paths.map((path) => ({ commit, path }));
  const plumbing = (args: string[], input?: string) =>
    execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", ...(input ? { input } : {}) }).trim();

  /** 直接构造 tree entry，避免依赖 Windows 创建符号链接的权限。 */
  function specialCommit(withGhost: boolean) {
    const blobA = plumbing(["hash-object", "-w", "pkg/a.py"]);
    const linkBlob = plumbing(["hash-object", "-w", "--stdin"], "pkg/a.py");
    const pkgTree = plumbing(["rev-parse", `${commit}:pkg`]);
    const head = plumbing(["rev-parse", commit]);
    const lines = [
      `100755 blob ${blobA}\texec.sh`,
      `120000 blob ${linkBlob}\tlink`,
      `160000 commit ${head}\tsub-present`,
      `160000 commit ${"1".repeat(40)}\tsub-absent`,
      `040000 tree ${pkgTree}\tdir`,
      ...(withGhost ? [`100644 blob ${"2".repeat(40)}\tghost.py`] : []),
    ];
    const tree = plumbing(["mktree", "--missing"], `${lines.join("\n")}\n`);
    return plumbing(["commit-tree", tree, "-m", withGhost ? "ghost" : "special"]);
  }

  for (const route of ["fast", "compat"] as const) {
    describe(`${route} 路线`, () => {
      beforeEach(() => setFastProbeSupportForTest(route === "compat" ? false : undefined));
      afterEach(() => setFastProbeSupportForTest(undefined));

      it("与同步读取逐字一致；冷读 3 文件进程数 ≤ 4；热读与同步 reader 均不再起进程", async () => {
        const single = paths.map((p) => createBlobReader()(repo, commit, p));
        clearBlobCache();
        const before = gitStats.spawns;
        const reads = await readBlobsAsync(repo, reqs());
        // 快路径：rev-parse + 一次 batch-check + 一次 batch；兼容路线再多一次 ls-tree
        expect(gitStats.spawns - before).toBeLessThanOrEqual(route === "fast" ? 3 : 4);
        expect(reads).toEqual(single);
        expect(reads[1]).toEqual({ kind: "ok", text: "末尾没有换行" });
        const warm = gitStats.spawns;
        expect(await readBlobsAsync(repo, reqs())).toEqual(single);
        for (const p of paths) expect(createBlobReader()(repo, commit, p).kind).toBe("ok");
        expect(gitStats.spawns).toBe(warm);
      });

      it("100755 可读；符号链接、gitlink、目录及非规范路径 missing-file；tag/blob/歧义短 SHA 判 invalid-commit", async () => {
        const special = specialCommit(false);
        plumbing(["tag", "-f", "-a", `annotated-${route}`, "-m", "t", commit]);
        const tagObject = plumbing(["rev-parse", `annotated-${route}`]);
        const blobA = plumbing(["hash-object", "pkg/a.py"]);
        // 构造一个与 commit 前 4 位相同的 blob，使 4 位短前缀在 Git 中成为 ambiguous
        const ambigPrefix = commit.slice(0, 4);
        let colliding = "";
        for (let n = 0; ; n++) {
          const candidate = `collide-${n}`;
          const oid = createHash("sha1").update(`blob ${candidate.length}\0${candidate}`).digest("hex");
          if (oid.startsWith(ambigPrefix) && !oid.startsWith(commit)) {
            colliding = candidate;
            break;
          }
        }
        plumbing(["hash-object", "-w", "--stdin"], colliding);
        const reads = await readBlobsAsync(repo, [
          { commit: special, path: "exec.sh" },
          { commit: special, path: "link" },
          { commit: special, path: "sub-present" },
          { commit: special, path: "sub-absent" },
          { commit: special, path: "dir" },
          { commit: special, path: "nope.py" },
          { commit, path: "pkg/../pkg/a.py" },
          { commit, path: "pkg//a.py" },
          { commit: tagObject, path: "pkg/a.py" },
          { commit: blobA, path: "pkg/a.py" },
          { commit: ambigPrefix, path: "pkg/a.py" },
          { commit: "bad:spec", path: "pkg/a.py" },
          { commit: "deadbeef", path: "pkg/a.py" },
        ]);
        expect(reads).toEqual([
          { kind: "ok", text: "line1\nline2\n" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "missing-file" },
          { kind: "invalid-commit" },
          { kind: "invalid-commit" },
          { kind: "invalid-commit" },
          { kind: "invalid-commit" },
          { kind: "invalid-commit" },
        ]);
        // 同步 reader 读到同一份缓存结论
        expect(createBlobReader()(repo, special, "link")).toEqual({ kind: "missing-file" });
        expect(createBlobReader()(repo, commit, "pkg/../pkg/a.py")).toEqual({ kind: "missing-file" });
      });

      it("树里列着普通文件但对象缺失：整批报 GitError 且不写入任何缓存", async () => {
        const ghost = specialCommit(true);
        const batch = [
          { commit: ghost, path: "exec.sh" },
          { commit: ghost, path: "ghost.py" },
        ];
        await expect(readBlobsAsync(repo, batch)).rejects.toBeInstanceOf(GitError);
        const before = gitStats.spawns;
        await expect(readBlobsAsync(repo, batch)).rejects.toBeInstanceOf(GitError);
        expect(gitStats.spawns).toBeGreaterThan(before);
      });
    });
  }

  it("等待 Git 期间事件循环保持运转（心跳计时器持续触发）", async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 1);
    try {
      await readBlobsAsync(repo, reqs());
    } finally {
      clearInterval(timer);
    }
    expect(ticks).toBeGreaterThan(0);
  });

  it("同 key 的并发批次合并为同一在途任务，进程数与单批相同", async () => {
    const before = gitStats.spawns;
    const [a, b] = await Promise.all([readBlobsAsync(repo, reqs()), readBlobsAsync(repo, reqs())]);
    expect(a).toEqual(b);
    expect(gitStats.spawns - before).toBeLessThanOrEqual(3);
  });

  it("不可读的仓库要报错；空请求不起进程", async () => {
    await expect(readBlobsAsync(join(repo, "not-a-repo"), reqs())).rejects.toBeInstanceOf(GitError);
    const before = gitStats.spawns;
    expect(await readBlobsAsync(join(repo, "not-a-repo"), [])).toEqual([]);
    expect(gitStats.spawns).toBe(before);
  });

  it("缺失 commit 有界负缓存（异步与同步互通零增量），fetch 补齐后不清缓存即恢复", async () => {
    const upstream = mkdtempSync(join(tmpdir(), "wiki-git-aup-"));
    const mirror = mkdtempSync(join(tmpdir(), "wiki-git-adown-"));
    try {
      const up = (...args: string[]) =>
        execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8" }).trim();
      execFileSync("git", ["init", "-q", upstream]);
      up("config", "user.email", "t@example.com");
      up("config", "user.name", "t");
      up("config", "core.autocrlf", "false");
      up("config", "uploadpack.allowAnySHA1InWant", "true");
      writeFileSync(join(upstream, "base.py"), "base\n");
      up("add", "-A");
      up("commit", "-q", "-m", "c1");
      execFileSync("git", ["clone", "-q", upstream, mirror]);
      writeFileSync(join(upstream, "fetched.py"), "fresh evidence\n");
      up("add", "-A");
      up("commit", "-q", "-m", "c2");
      const fetchedSha = up("rev-parse", "HEAD");
      const req = [{ commit: fetchedSha, path: "fetched.py" }];

      expect(await readBlobsAsync(mirror, req)).toEqual([{ kind: "invalid-commit" }]);
      const afterMiss = gitStats.spawns;
      expect(await readBlobsAsync(mirror, req)).toEqual([{ kind: "invalid-commit" }]);
      expect(createBlobReader()(mirror, fetchedSha, "fetched.py")).toEqual({ kind: "invalid-commit" });
      expect(gitStats.spawns).toBe(afterMiss);

      execFileSync("git", ["-C", mirror, "fetch", "-q", "origin", fetchedSha]);
      expect(await readBlobsAsync(mirror, req)).toEqual([{ kind: "ok", text: "fresh evidence\n" }]);
    } finally {
      rmSync(upstream, { recursive: true, force: true });
      rmSync(mirror, { recursive: true, force: true });
    }
  });
});
