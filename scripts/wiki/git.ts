import { spawn, spawnSync } from "node:child_process";
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
  inflightCommonDirs.clear();
  inflightBlobs.clear();
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

/** Guard missing or uncloned local repo paths so commit probes degrade cleanly instead of throwing uncaught GitError. */
function tryResolveGitCommonDir(root: string): string | null {
  const cached = commonDirs.get(root);
  if (cached && existsSync(cached) && existsSync(root)) return cached;
  if (!existsSync(root)) return null;
  try {
    return resolveGitCommonDir(root);
  } catch (error) {
    if (error instanceof GitError && (error.status === 128 || error.status === null)) return null;
    throw error;
  }
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
  const commonDir = tryResolveGitCommonDir(root);
  if (!commonDir) return false;
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
  return parseBatchContents(result.stdout, shas);
}

/**
 * 严格解析 `cat-file --batch` 输出：按请求顺序逐个校验 header 的 oid / 类型 / 长度，按字节切出恰好
 * size 个字节再解码（中文、CRLF、内嵌 NUL、零字节、无末尾换行都逐字保留），并消费结尾 LF。
 * 数量、长度或结束位置任何不符都视为协议错误抛出，绝不把截断当成空文件。
 */
function parseBatchContents(buf: Buffer, shas: string[]): Map<string, string> {
  const out = new Map<string, string>();
  let at = 0;
  for (const want of shas) {
    const eol = buf.indexOf(LF, at);
    if (eol < 0) throw new GitError(null, `git cat-file --batch 输出被截断：缺少 ${want} 的头部`);
    const header = buf.toString("utf8", at, eol);
    const [sha, type, size] = header.split(" ");
    if (type !== "blob" || sha !== want || !/^\d+$/.test(size ?? "")) {
      throw new GitError(null, `git cat-file --batch 返回了意外的对象：${header}（期望 ${want}）`);
    }
    const start = eol + 1;
    const end = start + Number(size);
    if (end >= buf.length || buf[end] !== LF) {
      throw new GitError(null, `git cat-file --batch 输出长度不符：${want}`);
    }
    out.set(sha, buf.toString("utf8", start, end));
    at = end + 1;
  }
  if (at !== buf.length) throw new GitError(null, "git cat-file --batch 返回了多余的输出");
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

// ---------------------------------------------------------------------------
// 异步批量读取：在线证据请求专用。同步 API 会在每个 commit 上 spawnSync 阻塞事件循环，
// 这里改为少量异步子进程并与同步路径共用同一份正/负缓存、模式判定与字节解析器。
// ---------------------------------------------------------------------------

interface GitRun {
  status: number | null;
  stdout: Buffer;
  stderr: string;
}

const MAX_STDERR_BYTES = 64 << 10;

/** 无 shell 的异步 git：启动点计数、排空 stdout/stderr、输出超限即杀进程报错、吞掉子进程提前退出导致的 stdin EPIPE。 */
function runGitAsync(root: string, args: string[], input: Buffer, maxBytes: number): Promise<GitRun> {
  gitStats.spawns++;
  return new Promise((resolveRun, reject) => {
    const label = `git ${args.slice(0, 2).join(" ")}`;
    let settled = false;
    const fail = (error: GitError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("git", ["-C", root, ...args], {
        env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      fail(
        new GitError(null, `${label} 无法启动：${error instanceof Error ? error.message : String(error)}`),
      );
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outBytes = 0;
    let errBytes = 0;
    let overflow = false;
    child.stdout!.on("data", (chunk: Buffer) => {
      if (overflow) return;
      outBytes += chunk.length;
      if (outBytes > maxBytes) {
        overflow = true;
        child.kill();
        return;
      }
      out.push(chunk);
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (errBytes >= MAX_STDERR_BYTES) return;
      errBytes += chunk.length;
      err.push(chunk);
    });
    // 子进程提前退出时写 stdin 会 EPIPE；真实失败由 close 的退出码报告。
    child.stdin!.on("error", () => {});
    child.on("error", (error) => fail(new GitError(null, `${label} 失败：${error.message}`)));
    child.on("close", (status) => {
      if (overflow) return fail(new GitError(null, `${label} 输出超过 ${maxBytes} 字节上限`));
      if (settled) return;
      settled = true;
      resolveRun({ status, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8") });
    });
    child.stdin!.end(input);
  });
}

async function gitOk(root: string, args: string[], input = Buffer.alloc(0), maxBytes = 64 << 20) {
  const run = await runGitAsync(root, args, input, maxBytes);
  if (run.status !== 0) {
    throw new GitError(run.status, `git ${args.slice(0, 2).join(" ")} 失败：${run.stderr.trim()}`);
  }
  return run.stdout;
}

const inflightCommonDirs = new Map<string, Promise<string>>();

async function resolveGitCommonDirAsync(root: string): Promise<string> {
  const cached = commonDirs.get(root);
  if (cached && existsSync(cached) && existsSync(root)) return cached;
  const inflight = inflightCommonDirs.get(root);
  if (inflight) return inflight;
  // 与同步 warmBlobs 契约一致：不可读的仓库直接报错，不能伪装成缺文件。
  const task = gitOk(root, ["rev-parse", "--git-common-dir"]).then((out) => {
    const resolved = resolve(root, out.toString("utf8").trim());
    commonDirs.set(root, resolved);
    return resolved;
  });
  inflightCommonDirs.set(root, task);
  const cleanup = () => {
    if (inflightCommonDirs.get(root) === task) inflightCommonDirs.delete(root);
  };
  task.then(cleanup, cleanup);
  return task;
}

/** 读取 `ls-tree -z <commit> -- :(literal)…`，按 80 条分块（Windows 命令行约 32K 上限）。返回 路径 → [mode, oid]。 */
async function lsTreeEntries(
  root: string,
  commit: string,
  paths: string[],
): Promise<Map<string, [string, string]>> {
  const found = new Map<string, [string, string]>();
  for (let i = 0; i < paths.length; i += 80) {
    const chunk = paths.slice(i, i + 80);
    const tree = await gitOk(root, ["ls-tree", "-z", commit, "--", ...chunk.map((p) => `:(literal)${p}`)]);
    for (const line of tree.toString("utf8").split(SEP)) {
      const tab = line.indexOf(TAB);
      if (tab < 0) continue;
      const path = line.slice(tab + 1);
      const [mode, , oid] = line.slice(0, tab).split(" ");
      if (chunk.includes(path) && mode && oid) found.set(path, [mode, oid]);
    }
  }
  return found;
}

const REGULAR_MODE = /^100[0-7]{3}$/;
const OID_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
/** Git 对 `<rev>:<path>` 中含 `.` / `..` 段、首尾或连续 `/` 等路径有特殊规整；这些只走 ls-tree 的字面路径核对。 */
const pathNeedsLiteralCheck = (path: string) =>
  !path ||
  path.startsWith("/") ||
  path.endsWith("/") ||
  path.includes("//") ||
  /(?:^|\/)\.{1,2}(?:\/|$)/.test(path) ||
  /[\r\n\0]/.test(path);

const isUnsupportedBatchCheck = (run: GitRun) =>
  run.status === 129 ||
  /unknown (?:switch|option|cat-file format|format element)|invalid.*format/i.test(run.stderr);

type PathProbe = { kind: "regular"; oid: string } | { kind: "missing-file" } | { kind: "verify" };

/** 能力探测结果：本机 Git 不支持 `-Z` / `%(objectmode)` 时记住并只走兼容路线，不对每批额外跑 `git --version`。 */
let fastProbeSupported: boolean | undefined;

/**
 * 快路径：一次 `cat-file -Z --batch-check` 同时确认裸 commit 与每个 commit:path 的类型与模式。
 * 仅当确认 Git 不支持 `-Z` / `%(objectmode)` 时返回 undefined（调用方回退兼容路线）；仓库损坏或权限错误直接抛 GitError。
 */
async function fastProbe(
  root: string,
  unchecked: string[],
  items: { commit: string; path: string }[],
): Promise<{ commitOk: Map<string, boolean>; paths: PathProbe[] } | undefined> {
  const inputs = [...unchecked, ...items.map((it) => `${it.commit}:${it.path}`)];
  const run = await runGitAsync(
    root,
    ["cat-file", "-Z", "--batch-check=%(objectname) %(objecttype) %(objectmode)"],
    Buffer.from(inputs.map((s) => `${s}${SEP}`).join(""), "utf8"),
    16 << 20,
  );
  if (run.status !== 0) {
    if (fastProbeSupported !== true && isUnsupportedBatchCheck(run)) {
      fastProbeSupported = false;
      return undefined;
    }
    throw new GitError(run.status, `git cat-file --batch-check 失败：${run.stderr.trim()}`);
  }
  fastProbeSupported = true;
  const lines = run.stdout.toString("utf8").split(SEP);
  if (lines.length !== inputs.length + 1 || lines[inputs.length] !== "") {
    throw new GitError(null, `git cat-file --batch-check 响应数量不符：期望 ${inputs.length}`);
  }
  const commitOk = new Map<string, boolean>();
  unchecked.forEach((commit, i) => {
    const [oid, type] = lines[i]!.split(" ");
    commitOk.set(commit, OID_RE.test(oid ?? "") && type === "commit");
  });
  const paths = items.map((it, j): PathProbe => {
    const line = lines[unchecked.length + j]!;
    if (commitOk.get(it.commit) === false) return { kind: "missing-file" };
    if (line.endsWith(" ambiguous")) {
      commitOk.set(it.commit, false);
      return { kind: "missing-file" };
    }
    if (line.endsWith(" missing")) return { kind: "verify" };
    const [oid, type, mode] = line.split(" ");
    if (!OID_RE.test(oid ?? ""))
      throw new GitError(null, `git cat-file --batch-check 返回了异常响应：${line}`);
    if (type === "submodule" || type === "tree" || type === "commit") return { kind: "missing-file" };
    if (type !== "blob") throw new GitError(null, `git cat-file --batch-check 返回了异常对象：${line}`);
    if (mode && REGULAR_MODE.test(mode)) return { kind: "regular", oid: oid! };
    // 120000 符号链接本身也是 blob；绝不跟随（不使用 --follow-symlinks）。
    if (mode === "120000") return { kind: "missing-file" };
    throw new GitError(null, `git cat-file --batch-check 返回了异常模式：${line}`);
  });
  return { commitOk, paths };
}

/** 兼容路线：每 repo 一次裸 commit `--batch-check`；路径一律交给按 commit 分组的 ls-tree。 */
async function compatCheckCommits(root: string, unchecked: string[]): Promise<Map<string, boolean>> {
  const commitOk = new Map<string, boolean>();
  const askable = unchecked.filter((c) => !/[\s\0]/.test(c));
  for (const c of unchecked) commitOk.set(c, false);
  if (!askable.length) return commitOk;
  const out = await gitOk(
    root,
    ["cat-file", "--batch-check=%(objectname) %(objecttype)"],
    Buffer.from(askable.map((c) => `${c}\n`).join(""), "utf8"),
    16 << 20,
  );
  const lines = out.toString("utf8").split("\n");
  if (lines.length !== askable.length + 1 || lines[askable.length] !== "") {
    throw new GitError(null, `git cat-file --batch-check 响应数量不符：期望 ${askable.length}`);
  }
  askable.forEach((commit, i) => {
    const [oid, type] = lines[i]!.split(" ");
    commitOk.set(commit, OID_RE.test(oid ?? "") && type === "commit");
  });
  return commitOk;
}

type BlobRequest = { commit: string; path: string };

/** 一批真正需要访问 Git 的 (commit, path)；完整成功后才写缓存，任何协议/对象错误整批抛出。 */
async function runBlobBatch(root: string, todo: BlobRequest[]): Promise<Map<string, BlobRead>> {
  const results = new Map<string, BlobRead>();
  const commonDir = await resolveGitCommonDirAsync(root);
  const stamp = repoStateStamp(commonDir);
  const commitState = new Map<string, boolean | undefined>();
  for (const { commit } of todo) {
    if (commitState.has(commit)) continue;
    if (!commit || /[\s\0:]/.test(commit)) {
      commitState.set(commit, false);
      continue;
    }
    const ck = [root, commit].join(SEP);
    if (commits.has(ck)) commitState.set(commit, true);
    else if (missingCommits.get(ck) === stamp) commitState.set(commit, false);
    else commitState.set(commit, undefined);
  }
  const unchecked = [...commitState].filter(([, ok]) => ok === undefined).map(([c]) => c);
  const live = todo.filter((t) => commitState.get(t.commit) !== false);
  const probe = new Map<string, PathProbe>();
  const fastItems = live.filter((t) => !pathNeedsLiteralCheck(t.path));
  let fast: Awaited<ReturnType<typeof fastProbe>>;
  if (fastProbeSupported !== false && (unchecked.length || fastItems.length)) {
    fast = await fastProbe(root, unchecked, fastItems);
    if (fast) fastProbeSupported = true;
  }
  if (fast) {
    for (const [c, ok] of fast.commitOk) commitState.set(c, ok);
    fastItems.forEach((t, i) => {
      probe.set(blobKey(root, t.commit, t.path), fast!.paths[i]!);
    });
  } else if (unchecked.length) {
    const checked = await compatCheckCommits(root, unchecked);
    // 快路径失败但兼容路线成功：确认是能力缺失而非仓库损坏，记住以后直接走兼容路线。
    if (fastProbeSupported === undefined) fastProbeSupported = false;
    for (const [c, ok] of checked) commitState.set(c, ok);
  } else if (fastProbeSupported === undefined && fastItems.length) {
    fastProbeSupported = false;
  }
  // 需要 ls-tree 字面核对的项：兼容路线下全部路径，快路径下的 missing 与特殊路径。
  const verifyByCommit = new Map<string, string[]>();
  for (const t of live) {
    if (commitState.get(t.commit) !== true) continue;
    const p = probe.get(blobKey(root, t.commit, t.path));
    if (p && p.kind !== "verify") continue;
    const list = verifyByCommit.get(t.commit) ?? [];
    if (!list.includes(t.path)) list.push(t.path);
    verifyByCommit.set(t.commit, list);
  }
  await Promise.all(
    [...verifyByCommit].map(async ([commit, paths]) => {
      const entries = await lsTreeEntries(root, commit, paths);
      for (const path of paths) {
        const entry = entries.get(path);
        const key = blobKey(root, commit, path);
        if (!entry || !REGULAR_MODE.test(entry[0])) {
          probe.set(key, { kind: "missing-file" });
        } else if (fast) {
          // 树里列着普通文件，快路径却读不到对象：残缺 clone / 对象丢失，不能永久记成「文件不存在」。
          throw new GitError(null, `仓库对象缺失：${commit}:${path} → ${entry[1]}`);
        } else {
          probe.set(key, { kind: "regular", oid: entry[1] });
        }
      }
    }),
  );
  const wanted = new Set<string>();
  for (const t of live) {
    const p = probe.get(blobKey(root, t.commit, t.path));
    if (commitState.get(t.commit) === true && p?.kind === "regular") wanted.add(p.oid);
  }
  const oids = [...wanted];
  const objects = oids.length
    ? parseBatchContents(
        await gitOk(
          root,
          ["cat-file", "--batch"],
          Buffer.from(oids.map((o) => `${o}\n`).join("")),
          512 << 20,
        ),
        oids,
      )
    : new Map<string, string>();
  // 全部成功后统一提交缓存；批次期间仓库状态变化（fetch 等）时不把旧的 miss 写进新一代负缓存。
  const stampStable = repoStateStamp(commonDir) === stamp;
  for (const [commit, ok] of commitState) {
    const ck = [root, commit].join(SEP);
    if (ok === true) {
      missingCommits.delete(ck);
      commits.add(ck);
    } else if (ok === false) {
      commits.delete(ck);
      if (stampStable && commit && !/[\s\0:]/.test(commit)) rememberMissingCommit(ck, stamp);
    }
  }
  for (const t of todo) {
    const key = blobKey(root, t.commit, t.path);
    if (commitState.get(t.commit) !== true) {
      results.set(key, { kind: "invalid-commit" });
      continue;
    }
    const p = probe.get(key);
    if (p?.kind === "regular") {
      const text = objects.get(p.oid);
      if (text === undefined) throw new GitError(null, `git cat-file --batch 漏了对象：${p.oid}`);
      const read: BlobRead = { kind: "ok", text };
      blobs.set(key, read);
      results.set(key, read);
    } else {
      const read: BlobRead = { kind: "missing-file" };
      blobs.set(key, read);
      results.set(key, read);
    }
  }
  return results;
}

const inflightBlobs = new Map<string, Promise<BlobRead>>();

/**
 * 非阻塞批量读取：返回与 requests 一一对应的 BlobRead。正缓存与同步 API 共享；同 key 的并发请求
 * 合并为同一个在途任务；缺失 commit 走与同步路径相同的、绑定仓库状态指纹的有界负缓存。
 * 冷读 1 个 commit 下任意多个普通文件：rev-parse（每 repo 首次）+ 一次 batch-check + 一次 batch。
 */
export async function readBlobsAsync(root: string, requests: BlobRequest[]): Promise<BlobRead[]> {
  if (!requests.length) return [];
  const pending = new Map<string, BlobRead | Promise<BlobRead>>();
  const todo: BlobRequest[] = [];
  for (const { commit, path } of requests) {
    const key = blobKey(root, commit, path);
    if (pending.has(key)) continue;
    const cached = blobs.get(key) ?? inflightBlobs.get(key);
    if (cached) {
      pending.set(key, cached);
      continue;
    }
    todo.push({ commit, path });
    pending.set(key, Promise.resolve({ kind: "invalid-commit" }));
  }
  if (todo.length) {
    const batch = runBlobBatch(root, todo);
    for (const { commit, path } of todo) {
      const key = blobKey(root, commit, path);
      const task = batch.then((m) => m.get(key)!);
      pending.set(key, task);
      inflightBlobs.set(key, task);
      const cleanup = () => {
        if (inflightBlobs.get(key) === task) inflightBlobs.delete(key);
      };
      task.then(cleanup, cleanup);
    }
  } else {
    await resolveGitCommonDirAsync(root);
  }
  return Promise.all(requests.map(({ commit, path }) => pending.get(blobKey(root, commit, path))!));
}

/** 只预热缓存的异步版本；预热后同步 createBlobReader 读取不再起 git 进程。 */
export async function warmBlobsAsync(root: string, requests: BlobRequest[]): Promise<void> {
  await readBlobsAsync(root, requests);
}

/** 仅供测试：重置能力探测记忆，以便覆盖兼容路线。 */
export function setFastProbeSupportForTest(value: boolean | undefined): void {
  fastProbeSupported = value;
}
