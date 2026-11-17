import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export class GitError extends Error {
  constructor(
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

/** 每个 git 调用在 Windows 上约 75ms，调用次数就是校验耗时；测试用它守住批量读取不退化 */
export const gitStats = { spawns: 0 };

/** Only git grep's documented no-match result is an empty successful query. */
export function gitText(root: string, args: string[], allowNoMatch = false): string {
  gitStats.spawns++;
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
  if (result.status === 0) return result.stdout;
  if (allowNoMatch && args[0] === "grep" && result.status === 1 && !result.stderr.trim()) return "";
  throw new GitError(
    result.status,
    `git ${args.join(" ")} 失败：${result.error?.message ?? result.stderr.trim()}`,
  );
}

export type BlobRead = { kind: "ok"; text: string } | { kind: "invalid-commit" | "missing-file" };

const SEP = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = 10;
const MAX_NEGATIVE_COMMITS = 512;

/**
 * 进程级正向缓存。键是 (仓库, commit, 路径)——钉住的 commit 下文件内容不可变，所以跨 reader、
 * 跨请求共享是安全的。缺失 commit 仅做绑定仓库状态指纹的有界负缓存：审计批次切换或 fetch /
 * 引用变化后立即失效，确保新拉取的真实源码立即可见。
 */
const blobs = new Map<string, BlobRead>();
const commits = new Set<string>();
const commonDirs = new Map<string, string>();
const missingCommits = new Map<string, string>();
const blobKey = (root: string, commit: string, path: string) => [root, commit, path].join(SEP);

export function resetNegativeCommitCache(): void {
  missingCommits.clear();
}

export function clearBlobCache(): void {
  blobs.clear();
  commits.clear();
  commonDirs.clear();
  missingCommits.clear();
}

function resolveGitCommonDir(root: string): string {
  const cached = commonDirs.get(root);
  if (cached && existsSync(cached) && existsSync(root)) return cached;
  // An unreadable repository must fail, rather than masquerading as missing evidence.
  const raw = gitText(root, ["rev-parse", "--git-common-dir"]).trim();
  const resolved = resolve(root, raw);
  commonDirs.set(root, resolved);
  return resolved;
}

function safeReadText(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  } catch {
    return "";
  }
}

function safeStatStamp(path: string): string {
  try {
    if (!existsSync(path)) return "";
    const st = statSync(path);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return "";
  }
}

function safeDirStamp(path: string): string {
  try {
    return existsSync(path) ? readdirSync(path).sort().join(",") : "";
  } catch {
    return "";
  }
}

function repoStateStamp(commonDir: string): string {
  return [
    safeReadText(resolve(commonDir, "FETCH_HEAD")),
    safeReadText(resolve(commonDir, "HEAD")),
    safeStatStamp(resolve(commonDir, "packed-refs")),
    safeDirStamp(resolve(commonDir, "objects/pack")),
    safeDirStamp(resolve(commonDir, "refs/wiki-pins")),
  ].join("|");
}

function rememberMissingCommit(key: string, stamp: string): void {
  if (!missingCommits.has(key) && missingCommits.size >= MAX_NEGATIVE_COMMITS) {
    const oldest = missingCommits.keys().next().value;
    if (oldest !== undefined) missingCommits.delete(oldest);
  }
  missingCommits.set(key, stamp);
}

function commitExists(root: string, commit: string): boolean {
  const key = [root, commit].join(SEP);
  if (commits.has(key) && existsSync(root)) return true;
  const commonDir = resolveGitCommonDir(root);
  const stamp = repoStateStamp(commonDir);
  if (missingCommits.get(key) === stamp) return false;
  try {
    if (gitText(root, ["cat-file", "-t", commit]).trim() !== "commit") {
      rememberMissingCommit(key, stamp);
      return false;
    }
  } catch (error) {
    if (!(error instanceof GitError) || error.status !== 128) throw error;
    rememberMissingCommit(key, stamp);
    return false;
  }
  missingCommits.delete(key);
  commits.add(key);
  return true;
}

/** ls-tree distinguishes a genuinely absent path from an object-reading failure. 返回 路径 → blob sha */
function regularFiles(root: string, commit: string, paths: string[]): Map<string, string> {
  const found = new Map<string, string>();
  // Windows 命令行上限约 32K：分批传路径
  for (let i = 0; i < paths.length; i += 80) {
    const chunk = paths.slice(i, i + 80);
    const tree = gitText(root, ["ls-tree", "-z", commit, "--", ...chunk.map((p) => `:(literal)${p}`)]);
    for (const line of tree.split(SEP)) {
      const tab = line.indexOf(TAB);
      if (tab < 0 || !line.startsWith("100")) continue;
      const path = line.slice(tab + 1);
      if (chunk.includes(path)) found.set(path, line.slice(0, tab).split(" ")[2]!);
    }
  }
  return found;
}

/** 一次 `cat-file --batch` 取回一组对象；输出是「<sha> blob <size> 换行 <bytes> 换行」逐个相接 */
function readObjects(root: string, shas: string[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!shas.length) return out;
  gitStats.spawns++;
  const result = spawnSync("git", ["-C", root, "cat-file", "--batch"], {
    input: Buffer.from(shas.map((sha) => `${sha}${String.fromCharCode(LF)}`).join("")),
    maxBuffer: 512 << 20,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
  if (result.status !== 0)
    throw new GitError(
      result.status,
      `git cat-file --batch 失败：${result.error?.message ?? String(result.stderr)}`,
    );
  const buf = result.stdout;
  let at = 0;
  while (at < buf.length) {
    const eol = buf.indexOf(LF, at);
    if (eol < 0) break;
    const [sha, type, size] = buf.toString("utf8", at, eol).split(" ");
    if (type !== "blob") throw new GitError(null, `git cat-file --batch 返回了意外的对象：${sha} ${type}`);
    const start = eol + 1;
    const end = start + Number(size);
    out.set(sha!, buf.toString("utf8", start, end));
    at = end + 1;
  }
  return out;
}

/**
 * 成批预热缓存：每个 commit 一次 ls-tree，每个仓库一次 cat-file --batch。
 * 逐个读是每个文件两个进程；四十多页的库有一百多个被引文件，校验一遍要起上千个进程、近一分钟，
 * 而且是同步的——问答服务会在这段时间里整个卡住。
 */
export function warmBlobs(root: string, requests: { commit: string; path: string }[]): void {
  if (requests.length > 0) resolveGitCommonDir(root);
  const byCommit = new Map<string, Set<string>>();
  for (const { commit, path } of requests) {
    if (blobs.has(blobKey(root, commit, path))) continue;
    if (!byCommit.has(commit)) byCommit.set(commit, new Set());
    byCommit.get(commit)!.add(path);
  }
  const wanted: { commit: string; path: string; sha: string }[] = [];
  for (const [commit, paths] of byCommit) {
    if (!commitExists(root, commit)) continue;
    const files = regularFiles(root, commit, [...paths]);
    for (const path of paths) {
      const sha = files.get(path);
      if (sha) wanted.push({ commit, path, sha });
      else blobs.set(blobKey(root, commit, path), { kind: "missing-file" });
    }
  }
  const objects = readObjects(root, [...new Set(wanted.map((w) => w.sha))]);
  for (const { commit, path, sha } of wanted) {
    const text = objects.get(sha);
    if (text === undefined) throw new GitError(null, `git cat-file --batch 漏了对象：${sha}`);
    blobs.set(blobKey(root, commit, path), { kind: "ok", text });
  }
}

/** Cache by immutable object identity, never by current checkout. */
export function createBlobReader(): (root: string, commit: string, path: string) => BlobRead {
  return (root, commit, path) => {
    const key = blobKey(root, commit, path);
    const cached = blobs.get(key);
    if (cached) return cached;
    if (!commitExists(root, commit)) return { kind: "invalid-commit" };
    warmBlobs(root, [{ commit, path }]);
    return blobs.get(key)!;
  };
}
