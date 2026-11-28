import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseDocLinks } from "./corpus";
import { mapDocRef } from "./corpus-trace";
import { GitError, gitText } from "./git";
import { GithubClient } from "./github";
import {
  inspectThread,
  loadTraceConfig,
  parseTraceUrl,
  REF_BASIS,
  searchErrors,
  searchPlan,
  TraceSession,
} from "./github-trace";
import { parseSeeds } from "./ingest";
import { localFile } from "./review-files";

/**
 * 网页问答里的在线排错（F003 AC4「聊天层接入」；用户 2026-09-23 定为验收项）。
 *
 * 贴进聊天框的报错先经 `searchPlan` 抽出特征词——原始日志、路径、token 不出本机——再在
 * `wiki/github-trace.config.json` 规定的仓库与时间窗口里在线搜 GitHub。命令行
 * `wiki:github-trace` 与 skill 用的是同一套搜索、清洗与缓存，这里只加两件问答需要的事：
 *   1. 第一个 issue 候选顺着正文、评论与 cross-reference 找关联 PR（最多 relatedPrLimit 个）；
 *   2. 候选里的 PR 用本地克隆核对：合并提交进了哪些钉住的版本、哪些 tag（F003 AC5 的本地链路）。
 * 结果只是社区线索：交给问答模型时标明「不是已确认的根因或修复」，不升级成 Wiki 结论，也不写回知识库
 * （用户 2026-09-23：「不需要 排错只是我们的一个功能」）。
 */

/** 出现 Python 异常类名或 traceback 开头才去 GitHub；普通提问不发任何网络请求 */
export const looksLikeError = (message: string) =>
  /Traceback \(most recent call last\)|\b[A-Z][A-Za-z0-9_]*(?:Error|Exception)\b/.test(message);

/** 交给问答模型与界面的候选上限：比命令行的 candidateLimit 小，回答要的是前几条 */
export const CHAT_CANDIDATES = 5;

export type VersionCheck =
  | { status: "no-local-clone"; reason: string }
  | { status: "no-local-commit"; searched: string; reason: string }
  | {
      status: "found";
      /** 本地克隆里对应 PR 的主合并/squash 提交 */
      commit: string;
      /** 同一 PR 在本地克隆中匹配到的全部提交（覆盖多提交 PR，如 vllm#55223） */
      commits?: string[];
      pins: {
        ref: string;
        commit: string;
        /** 有效修复状态：已合入（或已被明确 cherry-pick 回移）且未被后续 revert 撤销 */
        contains: boolean;
        /** 主提交是否为该钉点的 git 祖先（即便后续被 revert 仍保留原始祖先事实） */
        commitAncestor?: boolean;
        sameNumberCommit?: string;
        cherryPickCommit?: string;
        revertedBy?: string;
      }[];
      tags: string[];
      moreTags: number;
    }
  | { status: "error"; reason: string };

export interface ChatTraceCandidate {
  repo: string;
  number: number;
  kind: "issue" | "pr";
  url: string;
  title: string;
  state: string;
  updatedAt: string;
  matchedQueries: number;
  /** 清洗后的正文开头，只给问答模型当线索；清洗阻断时为空 */
  excerpt: string;
  docs?: ReturnType<typeof localDocVersions>;
  versions?: VersionCheck;
  linkedPrs?: { number: number; url: string; basis: string; versions: VersionCheck; excerpt?: string }[];
}

export interface TraceScope {
  repos: string[];
  since: string;
  terms: string[];
}

export type ChatTrace =
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string; scope?: TraceScope }
  | {
      status: "done";
      scope: TraceScope;
      candidates: ChatTraceCandidate[];
      omitted: number;
      complete: boolean;
      problems: string[];
      requests: number;
      cacheHits: number;
    };

const MAX_TAGS = 8;

function threadExcerpt(thread: Awaited<ReturnType<typeof inspectThread>>) {
  const pull = thread.pull as
    | {
        merged?: boolean;
        merge_commit_sha?: string;
        files?: { file: string; patch: { text: string; blocked: boolean } }[];
      }
    | undefined;
  const parts = [
    `已读取 ${thread.url}；${thread.qualification}`,
    thread.body.blocked ? "正文清洗阻塞" : thread.body.text,
    ...thread.comments.filter((c) => !c.blocked).map((c) => `评论 ${c.url}: ${c.text}`),
  ];
  if (pull)
    parts.push(
      `PR merged=${pull.merged}; merge_commit_sha=${pull.merge_commit_sha ?? "未知"}`,
      ...(pull.files ?? []).filter((f) => !f.patch.blocked).map((f) => `${f.file}\n${f.patch.text}`),
    );
  const text = parts.join("\n\n");
  return text.length > 12000 ? `${text.slice(0, 12000)}\n[摘录已截断，未展示的内容不可据此推断]` : text;
}

/** Map the document's own version, never silently substitute the Wiki's current pin. */
export function localDocVersions(root: string, text: string) {
  return parseDocLinks(text)
    .slice(0, 5)
    .map((doc) => {
      try {
        const seeds = parseSeeds(readFileSync(localFile(root, "wiki/seeds/vllm-ascend-code.yaml"), "utf8"));
        const repo = seeds.repos["vllm-ascend"];
        if (!repo) throw new Error("没有 Ascend 文档对应的本地仓库配置");
        return {
          ...doc,
          mappings: Object.entries(repo.refs).map(([ref, commit]) =>
            mapDocRef(resolve(root, repo.path), doc, ref, commit),
          ),
        };
      } catch (error) {
        return { ...doc, mappings: [], reason: String(error) };
      }
    });
}

function isAncestor(dir: string, commit: string, of: string) {
  try {
    gitText(dir, ["merge-base", "--is-ancestor", commit, of]);
    return true;
  } catch (error) {
    if (error instanceof GitError && error.status === 1) return false;
    throw error;
  }
}

const REVERT_SUBJECT_RE = /^(?:\[[^\]]+\]\s*)*Revert\b/i;

function isDirectPrSubject(subject: string, number: number): boolean {
  const trimmed = subject.trim();
  if (!trimmed) return false;
  const prSuffix = `(#${number})`;
  // Exclude commits reverting PR #N unless #N is itself the revert PR's own trailing suffix
  if (REVERT_SUBJECT_RE.test(trimmed)) {
    const quotedPr = new RegExp(`["“][^"”]*\\(#${number}\\)["”]?`);
    if (quotedPr.test(trimmed) && !trimmed.endsWith(prSuffix)) return false;
  }
  if (trimmed.endsWith(prSuffix)) return true;
  return new RegExp(`^Merge pull request #${number}(?:\\s|$)`, "i").test(trimmed);
}

interface RepoPrIndex {
  directByPr: Map<number, string[]>;
  cherryPickByPr: Map<number, string[]>;
  cherryPickBySha7: Map<string, Array<{ citedSha: string; commitSha: string }>>;
}

const REPO_PR_INDEX_CACHE = new Map<string, RepoPrIndex>();

function getRepoPrIndex(dir: string): RepoPrIndex {
  const cacheKey = repoGitStamp(dir);
  const cached = REPO_PR_INDEX_CACHE.get(cacheKey);
  if (cached) return cached;

  const directByPr = new Map<number, string[]>();
  const addDirect = (num: number, sha: string) => {
    let arr = directByPr.get(num);
    if (!arr) {
      arr = [];
      directByPr.set(num, arr);
    }
    if (!arr.includes(sha)) arr.push(sha);
  };

  const subjOut = gitText(dir, ["log", "--all", "--format=%H%x09%s"]);
  for (const line of subjOut.split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    const sha = line.slice(0, tab).trim();
    const subject = line.slice(tab + 1).trim();
    if (!sha || !subject) continue;
    const endM = /\(#(\d+)\)$/.exec(subject);
    if (endM) {
      const n = Number.parseInt(endM[1]!, 10);
      if (isDirectPrSubject(subject, n)) addDirect(n, sha);
      continue;
    }
    const mergeM = /^Merge pull request #(\d+)(?:\s|$)/i.exec(subject);
    if (mergeM) {
      const n = Number.parseInt(mergeM[1]!, 10);
      if (isDirectPrSubject(subject, n)) addDirect(n, sha);
    }
  }

  const cherryPickByPr = new Map<number, string[]>();
  const cherryPickBySha7 = new Map<string, Array<{ citedSha: string; commitSha: string }>>();
  const addCpPr = (num: number, sha: string) => {
    let arr = cherryPickByPr.get(num);
    if (!arr) {
      arr = [];
      cherryPickByPr.set(num, arr);
    }
    if (!arr.includes(sha)) arr.push(sha);
  };
  const addCpSha = (citedSha: string, commitSha: string) => {
    const sha7 = citedSha.slice(0, 7);
    let arr = cherryPickBySha7.get(sha7);
    if (!arr) {
      arr = [];
      cherryPickBySha7.set(sha7, arr);
    }
    if (!arr.some((e) => e.citedSha === citedSha && e.commitSha === commitSha)) {
      arr.push({ citedSha, commitSha });
    }
  };

  const cpOut = gitText(dir, [
    "log",
    "--all",
    "-F",
    "--regexp-ignore-case",
    "--grep=from #",
    "--grep=Original PR:",
    "--grep=Cherry-pick of PR",
    "--grep=cherry picked from commit ",
    "--format=%H%x1f%s%x1f%b%x1e",
  ]);
  for (const chunk of cpOut.split("\x1e")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [shaRaw = "", subjectRaw = "", body = ""] = trimmed.split("\x1f");
    const sha = shaRaw.trim();
    const subject = subjectRaw.trim();
    if (!sha || REVERT_SUBJECT_RE.test(subject)) continue;
    const full = `${subject}\n${body}`;
    for (const m of full.matchAll(
      /\((?:from|backport(?:ed)?\s+from|cherry[- ]?pick(?:ed)?\s+from)\s+#(\d+)\)|(?:Original PR:|Cherry-pick of PR)\s*#(\d+)(?!\d)/gi,
    )) {
      const n = Number.parseInt(m[1] ?? m[2] ?? "", 10);
      if (Number.isInteger(n) && n > 0) addCpPr(n, sha);
    }
    for (const m of body.matchAll(/cherry picked from commit ([0-9a-f]{7,40})/gi)) {
      const citedSha = (m[1] ?? "").toLowerCase();
      if (citedSha.length >= 7) addCpSha(citedSha, sha);
    }
  }

  const idx: RepoPrIndex = { directByPr, cherryPickByPr, cherryPickBySha7 };
  REPO_PR_INDEX_CACHE.set(cacheKey, idx);
  return idx;
}

const REV_ANCESTORS_CACHE = new Map<string, Set<string>>();
const RESOLVED_PINS_CACHE = new Map<
  string,
  { head: string; headSha: string; pinCommits: Array<{ ref: string; commit: string }> }
>();

function getRevAncestors(dir: string, rev: string): Set<string> {
  const key = `${repoGitStamp(dir)}::${rev}`;
  const cached = REV_ANCESTORS_CACHE.get(key);
  if (cached) return cached;
  const out = gitText(dir, ["rev-list", rev]);
  const set = new Set<string>();
  for (const ln of out.split(/\r?\n/)) {
    const s = ln.trim();
    if (s) set.add(s);
  }
  REV_ANCESTORS_CACHE.set(key, set);
  return set;
}

function isAncestorFast(dir: string, ancestor: string, descendant: string): boolean {
  return getRevAncestors(dir, descendant).has(ancestor);
}

/** 从 revs 可达、属于 PR #N 的直接提交（含 squash `(#N)`、多提交 PR 与常规 `Merge pull request #N`），新的在前 */
function numberedCommits(dir: string, revs: string[], number: number): string[] {
  const candidates = getRepoPrIndex(dir).directByPr.get(number);
  if (!candidates?.length) return [];
  const resolvedRevs: string[] = [];
  for (const r of revs) {
    if (r.startsWith("--remotes=")) {
      const prefix = r.slice("--remotes=".length).replace(/\*$/, "");
      const out = gitText(dir, ["for-each-ref", "--format=%(objectname)", `refs/remotes/${prefix}`]);
      for (const s of out.split(/\r?\n/)) {
        const trimmed = s.trim();
        if (trimmed && !resolvedRevs.includes(trimmed)) resolvedRevs.push(trimmed);
      }
    } else if (!resolvedRevs.includes(r)) {
      resolvedRevs.push(r);
    }
  }
  return candidates.filter((sha) => resolvedRevs.some((rev) => isAncestorFast(dir, sha, rev)));
}

/** 一次遍历候选钉点，查找带明确回移溯源（`from #N` / `Original PR: #N` / `cherry picked from commit <sha>`）的非 revert 提交 */
function findCherryPickCandidates(
  dir: string,
  revs: readonly string[],
  number: number,
  origCommits: readonly string[],
): string[] {
  if (!revs.length) return [];
  const idx = getRepoPrIndex(dir);
  const pool = new Set<string>(idx.cherryPickByPr.get(number) ?? []);
  for (const orig of origCommits) {
    const origLower = orig.toLowerCase();
    const s7 = origLower.slice(0, 7);
    for (const entry of idx.cherryPickBySha7.get(s7) ?? []) {
      if (origLower.startsWith(entry.citedSha) || entry.citedSha.startsWith(origLower)) {
        pool.add(entry.commitSha);
      }
    }
  }
  const shas: string[] = [];
  for (const sha of pool) {
    if (origCommits.includes(sha)) continue;
    if (revs.some((rev) => isAncestorFast(dir, sha, rev))) shas.push(sha);
  }
  return shas;
}

function computePatchId(dir: string, diffText: string): string | null {
  if (!diffText.trim()) return null;
  const res = spawnSync("git", ["-C", dir, "patch-id", "--stable"], {
    input: diffText,
    encoding: "utf8",
    maxBuffer: 64 << 20,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
  if (res.error) {
    throw new GitError(res.status, `git -C ${dir} patch-id --stable failed: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new GitError(
      res.status,
      `git -C ${dir} patch-id --stable exited ${String(res.status)}: ${(res.stderr || "").trim()}`,
    );
  }
  const id = res.stdout.trim().split(/\s+/)[0] ?? "";
  return /^[0-9a-f]{40}$/i.test(id) && !/^0+$/.test(id) ? id : null;
}

function hasCommitParent(dir: string, sha: string): boolean {
  const out = gitText(dir, ["rev-list", "--parents", "-n", "1", sha]).trim();
  return out.split(/\s+/).length >= 2;
}

function commitDiff(dir: string, sha: string, reverse = false): string {
  if (!hasCommitParent(dir, sha)) {
    return reverse ? "" : gitText(dir, ["show", "--format=", sha]);
  }
  return reverse ? gitText(dir, ["diff", sha, `${sha}^`]) : gitText(dir, ["diff", `${sha}^`, sha]);
}

interface IndexedRevertCommit {
  sha: string;
  subject: string;
  body: string;
  fullMsg: string;
  citedShas: string[];
  quotedPrs: number[];
  isRevertSubject: boolean;
  changedFiles: Set<string>;
}

const REPO_REVERT_INDEX_CACHE = new Map<string, IndexedRevertCommit[]>();
const COMMIT_FILES_CACHE = new Map<string, Set<string>>();

function resolveGitDir(dir: string): string | null {
  const dotGit = join(dir, ".git");
  if (!existsSync(dotGit)) return null;
  try {
    const st = statSync(dotGit);
    if (st.isDirectory()) return dotGit;
    if (st.isFile()) {
      const m = /^gitdir:\s*(.+)$/im.exec(readFileSync(dotGit, "utf8"));
      if (m) return resolve(dir, m[1]!.trim());
    }
  } catch {
    return null;
  }
  return null;
}

export function probeRepoGitAccess(dir: string): string {
  const absDir = resolve(dir);
  if (!existsSync(absDir)) return "missing";
  try {
    const out = gitText(absDir, ["rev-parse", "--is-inside-work-tree"]).trim();
    return out === "true" ? "ok" : `not-wt:${out}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `err:${createHash("sha256").update(msg, "utf8").digest("hex").slice(0, 12)}`;
  }
}

/**
 * 计算本地 git 克隆（含普通仓库与 linked worktree 共享 commondir）的完整引用与进程环境信任指纹
 * （HEAD、packed-refs、全部松散 refs/ 文件内容与 GIT_CONFIG_* 环境），确保任意 ref 或信任配置变更都立即使内存血缘缓存失效。
 */
export function repoGitStamp(dir: string): string {
  const absDir = resolve(dir);
  if (!existsSync(absDir)) return `${absDir}:missing`;
  const gitDir = resolveGitDir(absDir);
  if (!gitDir) return `${absDir}:nogit`;
  const hash = createHash("sha256").update(absDir, "utf8");
  const gitEnvKeys = Object.keys(process.env)
    .filter(
      (k) =>
        k.startsWith("GIT_CONFIG") ||
        k === "GIT_DIR" ||
        k === "GIT_WORK_TREE" ||
        k === "GIT_COMMON_DIR" ||
        k === "HOME" ||
        k === "USERPROFILE",
    )
    .sort();
  for (const k of gitEnvKeys) {
    hash.update(`\0env:${k}=${process.env[k] ?? ""}`);
  }
  const gitDirs: string[] = [resolve(gitDir)];
  const commonDirFile = join(gitDir, "commondir");
  if (existsSync(commonDirFile)) {
    try {
      const commonRel = readFileSync(commonDirFile, "utf8").trim();
      if (commonRel) {
        const commonAbs = resolve(gitDir, commonRel);
        if (!gitDirs.includes(commonAbs) && existsSync(commonAbs)) {
          gitDirs.push(commonAbs);
        }
      }
    } catch {
      hash.update("\0commondir:err");
    }
  }
  const walkRefs = (curDir: string, scopeTag: string, relPrefix: string) => {
    let entries: string[];
    try {
      entries = readdirSync(curDir).sort();
    } catch {
      hash.update(`\0refs-err:${scopeTag}:${relPrefix}`);
      return;
    }
    for (const name of entries) {
      const full = join(curDir, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walkRefs(full, scopeTag, rel);
        } else if (st.isFile()) {
          hash.update(`\0ref:${scopeTag}:${rel}=`).update(readFileSync(full));
        }
      } catch {
        hash.update(`\0ref:${scopeTag}:${rel}=err`);
      }
    }
  };
  for (let i = 0; i < gitDirs.length; i++) {
    const gdir = gitDirs[i]!;
    const tag = i === 0 ? "git" : `common${i}`;
    for (const rel of i === 0 ? ["HEAD", "packed-refs"] : ["packed-refs"]) {
      const p = join(gdir, rel);
      if (existsSync(p)) {
        try {
          hash.update(`\0${tag}:${rel}:`).update(readFileSync(p));
        } catch {
          hash.update(`\0${tag}:${rel}:err`);
        }
      } else {
        hash.update(`\0${tag}:${rel}:none`);
      }
    }
    const refsRoot = join(gdir, "refs");
    if (existsSync(refsRoot)) walkRefs(refsRoot, tag, "");
  }
  return `${absDir}:${hash.digest("hex").slice(0, 16)}`;
}

function extractCitedShas(text: string): string[] {
  return [...text.matchAll(/(?:reverts commit\s+`?|merge commit:\s*`?)([0-9a-f]{7,40})/gi)].map((m) =>
    (m[1] ?? "").toLowerCase(),
  );
}

function getRepoRevertCommits(dir: string): IndexedRevertCommit[] {
  const cacheKey = repoGitStamp(dir);
  const cached = REPO_REVERT_INDEX_CACHE.get(cacheKey);
  if (cached) return cached;
  // Single git log pass fetches commit metadata AND touched files for every revert commit across all reachable commits
  // (omit --first-parent so reverts merged via side branches remain visible even after topic branch pruning;
  // deduplicate merge commits emitted once per parent under -m to keep their parent-1 diff).
  const raw = gitText(dir, [
    "log",
    "--all",
    "--reverse",
    "-F",
    "--regexp-ignore-case",
    "--grep=Revert",
    "-m",
    "--no-renames",
    "--name-only",
    "--format=%x1e%H%x1f%s%x1f%b%x1f",
  ]);
  const seenShas = new Set<string>();
  const indexed: IndexedRevertCommit[] = [];
  for (const chunk of raw.split("\x1e")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [sha = "", subject = "", body = "", filesBlock = ""] = trimmed.split("\x1f");
    const trimmedSha = sha.trim();
    if (trimmedSha.length < 7 || seenShas.has(trimmedSha)) continue;
    seenShas.add(trimmedSha);
    const trimmedSubject = subject.trim();
    const fullMsg = `${trimmedSubject}\n${body}`;
    const changedFiles = new Set<string>();
    for (const ln of filesBlock.split(/\r?\n/)) {
      const f = ln.trim();
      if (f) changedFiles.add(f);
    }
    indexed.push({
      sha: trimmedSha,
      subject: trimmedSubject,
      body,
      fullMsg,
      citedShas: extractCitedShas(fullMsg),
      quotedPrs: [...trimmedSubject.matchAll(/\(#(\d+)\)/g)].map((m) => Number.parseInt(m[1]!, 10)),
      isRevertSubject: REVERT_SUBJECT_RE.test(trimmedSubject),
      changedFiles,
    });
  }
  REPO_REVERT_INDEX_CACHE.set(cacheKey, indexed);
  return indexed;
}

function commitChangedFilesSet(dir: string, sha: string): Set<string> {
  const key = `${repoGitStamp(dir)}::${sha}`;
  const cached = COMMIT_FILES_CACHE.get(key);
  if (cached) return cached;
  const set = new Set<string>();
  // Use `git diff --no-renames --name-only <sha>^ <sha>` (matching commitDiff!) because
  // `git diff-tree -m` ignores `--first-parent` and unions all merge parents' diffs!
  const out = hasCommitParent(dir, sha)
    ? gitText(dir, ["diff", "--no-renames", "--name-only", `${sha}^`, sha])
    : gitText(dir, ["diff-tree", "--no-renames", "--no-commit-id", "--name-only", "-r", "--root", sha]);
  for (const ln of out.split(/\r?\n/)) {
    const s = ln.trim();
    if (s) set.add(s);
  }
  COMMIT_FILES_CACHE.set(key, set);
  return set;
}

const PATCH_ID_CACHE = new Map<string, string | null>();

function getCommitPatchId(dir: string, sha: string, reverse = false): string | null {
  const key = `${repoGitStamp(dir)}::${sha}::${reverse ? "rev" : "fwd"}`;
  if (PATCH_ID_CACHE.has(key)) return PATCH_ID_CACHE.get(key) ?? null;
  const pid = computePatchId(dir, commitDiff(dir, sha, reverse));
  PATCH_ID_CACHE.set(key, pid);
  return pid;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/**
 * 检查 targetCommit 在 pinCommit 上是否被后续 revert 撤销（并支持识别再次 re-revert / 恢复）。
 * 复用按仓库 `.git` 状态缓存的全仓 Revert 索引（~300 条），毫秒级过滤无关提交，
 * 对候选提交用祖先关系 + 显式 commit 引用 + `git patch-id --stable` 精确核验。
 */
function findActiveRevertOnPin(
  dir: string,
  targetCommit: string,
  pinCommit: string,
  prNumber: number,
): string | undefined {
  if (targetCommit === pinCommit) return undefined;
  const allReverts = getRepoRevertCommits(dir);
  if (!allReverts.length) return undefined;

  const prPat = new RegExp(`(?:#${prNumber}\\b|\\(#${prNumber}\\))`);
  const referencesSha = (rec: IndexedRevertCommit, sha: string): boolean => {
    const short7 = sha.slice(0, 7).toLowerCase();
    const shaLower = sha.toLowerCase();
    return rec.citedShas.some((cited) => cited.startsWith(short7) && shaLower.startsWith(cited));
  };
  const citesOnlyForeignTarget = (rec: IndexedRevertCommit, sha: string): boolean => {
    if (referencesSha(rec, sha)) return false;
    if (rec.citedShas.length > 0) return true;
    if (!prPat.test(rec.fullMsg) && rec.quotedPrs.length >= 2 && !rec.quotedPrs.includes(prNumber)) {
      return true;
    }
    return false;
  };

  let origPatchId: string | null | undefined;
  const getOrigPatchId = () => {
    if (origPatchId === undefined) origPatchId = getCommitPatchId(dir, targetCommit, false);
    return origPatchId;
  };
  let targetFiles: Set<string> | undefined;
  const getTargetFiles = () => {
    if (targetFiles === undefined) targetFiles = commitChangedFilesSet(dir, targetCommit);
    return targetFiles;
  };

  let activeRevert: string | undefined;
  let activeRevertPatchId: string | null | undefined;

  for (const rec of allReverts) {
    if (!activeRevert) {
      const explicitSha = referencesSha(rec, targetCommit);
      if (!explicitSha) {
        if (citesOnlyForeignTarget(rec, targetCommit)) continue;
        const mentionsPr = prPat.test(rec.fullMsg);
        if (!mentionsPr && !rec.isRevertSubject) continue;
        // Exact touched-file-set match is mathematically necessary for full-commit `git patch-id --stable` equality!
        // Note: do NOT skip single-PR revert subjects like `Revert "..." (#59125)` because #59125 is the revert PR's own number.
        if (!setsEqual(getTargetFiles(), rec.changedFiles)) continue;
      }
      if (!isAncestorFast(dir, rec.sha, pinCommit) || !isAncestor(dir, targetCommit, rec.sha)) continue;
      if (explicitSha) {
        activeRevert = rec.sha;
        activeRevertPatchId = undefined;
        continue;
      }
      const targetPid = getOrigPatchId();
      if (targetPid) {
        const revPid = getCommitPatchId(dir, rec.sha, true);
        if (revPid && revPid === targetPid) {
          activeRevert = rec.sha;
          activeRevertPatchId = undefined;
        }
      }
    } else {
      const explicitReRevert = referencesSha(rec, activeRevert);
      if (!explicitReRevert) {
        if (citesOnlyForeignTarget(rec, activeRevert)) continue;
        const mentionsPr = prPat.test(rec.fullMsg);
        if (!mentionsPr && !rec.isRevertSubject) continue;
        if (!setsEqual(getTargetFiles(), rec.changedFiles)) continue;
      }
      if (!isAncestorFast(dir, rec.sha, pinCommit) || !isAncestor(dir, activeRevert, rec.sha)) continue;
      if (explicitReRevert) {
        activeRevert = undefined;
        activeRevertPatchId = undefined;
        continue;
      }
      if (activeRevertPatchId === undefined) {
        activeRevertPatchId = getCommitPatchId(dir, activeRevert, false);
      }
      const fwdPid = getCommitPatchId(dir, rec.sha, false);
      const revPid = getCommitPatchId(dir, rec.sha, true);
      const targetPid = getOrigPatchId();
      if ((targetPid && fwdPid === targetPid) || (activeRevertPatchId && revPid === activeRevertPatchId)) {
        activeRevert = undefined;
        activeRevertPatchId = undefined;
      }
    }
  }
  return activeRevert;
}

/**
 * 用本地克隆回答「这个 PR 的修复进了哪些版本」。钉点只认 `wiki/seeds/vllm-ascend-code.yaml`——
 * 夜间任务与行号审计用的也是它。先在远端 main（没有就用 main 钉点）上按 `(#N)` / `Merge pull request #N`
 * 找合并提交，再逐个钉点做祖先判断、cherry-pick 回移识别（如 `(from #15835) (#16103)`）、同号提交检查与
 * 后续 revert 撤销检测（`git patch-id --stable` + 显式 revert 引用）。
 */
export function localFixVersions(root: string, repo: string, number: number): VersionCheck {
  try {
    const seedsPath = localFile(root, "wiki/seeds/vllm-ascend-code.yaml");
    if (!existsSync(seedsPath)) return { status: "no-local-clone", reason: "没有代码钉点配置" };
    const url = `https://github.com/${repo}`.toLowerCase();
    const entry = Object.values(parseSeeds(readFileSync(seedsPath, "utf8")).repos).find(
      (r) => r.url?.toLowerCase().replace(/\.git$/, "") === url,
    );
    const dir = entry ? resolve(root, entry.path) : undefined;
    if (!entry || !dir || !existsSync(dir))
      return { status: "no-local-clone", reason: `本机没有 ${repo} 的克隆` };
    // Always verify live Git access (e.g. safe.directory / config-file trust) before consulting ANY in-memory cache!
    gitText(dir, ["rev-parse", "--is-inside-work-tree"]);
    const pinCacheKey = `${repoGitStamp(dir)}::${JSON.stringify(entry.refs)}`;
    let resolvedPins = RESOLVED_PINS_CACHE.get(pinCacheKey);
    if (!resolvedPins) {
      let head = "refs/remotes/origin/main";
      let headSha = "";
      const refCheck = spawnSync("git", ["-C", dir, "show-ref", "--verify", "--quiet", head], {
        encoding: "utf8",
        env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
      });
      if (refCheck.error) {
        throw new GitError(
          refCheck.status,
          `git show-ref --verify --quiet ${head} 失败：${refCheck.error.message}`,
        );
      }
      if (refCheck.status === 0) {
        headSha = gitText(dir, ["rev-parse", "--verify", "--quiet", `${head}^{commit}`]).trim();
      } else if (refCheck.status === 1 && !(refCheck.stderr || "").trim()) {
        head = entry.refs.main ?? Object.values(entry.refs)[0]!;
        headSha = gitText(dir, ["rev-parse", "--verify", "--quiet", `${head}^{commit}`]).trim();
      } else {
        throw new GitError(
          refCheck.status,
          `git show-ref --verify --quiet ${head} 失败：${(refCheck.stderr || "").trim()}`,
        );
      }
      const refEntries = Object.entries(entry.refs);
      const resolvedShas = gitText(dir, ["rev-parse", ...refEntries.map(([, pin]) => `${pin}^{commit}`)])
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (resolvedShas.length !== refEntries.length || resolvedShas.some((s) => !/^[0-9a-f]{40}$/i.test(s))) {
        throw new Error(`无法解析全部代码钉点：${refEntries.map(([r]) => r).join(", ")}`);
      }
      resolvedPins = {
        head,
        headSha,
        pinCommits: refEntries.map(([ref], i) => ({
          ref,
          commit: resolvedShas[i]!,
        })),
      };
      RESOLVED_PINS_CACHE.set(pinCacheKey, resolvedPins);
    }
    const { head, headSha, pinCommits } = resolvedPins;
    // 先认 main 上的提交；直接合进发布分支的 PR（如「[Backport v0.26.0rc] … (#15981)」）main 上没有，
    // 再到各发布分支与各钉点上找
    let found = numberedCommits(dir, [headSha], number);
    if (!found.length)
      found = numberedCommits(
        dir,
        ["--remotes=origin/releases/*", ...pinCommits.map((p) => p.commit)],
        number,
      );
    if (!found.length)
      return {
        status: "no-local-commit",
        searched: `${head} 与各发布分支`,
        reason: `本地克隆的 main 与各发布分支上都没有对应 #${number} 的合并提交：可能尚未合并，或克隆比这个 PR 旧`,
      };
    const commit = found.at(-1)!;
    // Pass 1: direct ancestry per pin (O(1) via cached rev-list sets)
    const directAncestorByPin = pinCommits.map(({ commit: pinCommit }) =>
      found.find((c) => isAncestorFast(dir, c, pinCommit)),
    );
    const nonAncestorPins = pinCommits.filter((_, i) => !directAncestorByPin[i]).map((p) => p.commit);
    // Pass 2: O(1) indexed lookup across non-ancestor pins for cherry-picks and same-number backports
    const cpCandidates = findCherryPickCandidates(dir, nonAncestorPins, number, found);
    const sameCandidates = nonAncestorPins.length
      ? numberedCommits(dir, nonAncestorPins, number).filter((c) => !found.includes(c))
      : [];

    // Pass 3: resolve effective commit per pin, then check reverts via cached repo revert index
    const pinEffective = pinCommits.map(({ ref, commit: pinCommit }, i) => {
      const anc = directAncestorByPin[i];
      if (anc) return { ref, pinCommit, kind: "direct" as const, target: anc };
      const cp = cpCandidates.find((c) => isAncestorFast(dir, c, pinCommit));
      if (cp) return { ref, pinCommit, kind: "cherry-pick" as const, target: cp };
      const same = sameCandidates.find((c) => isAncestorFast(dir, c, pinCommit));
      if (same) return { ref, pinCommit, kind: "same-number" as const, target: same };
      return { ref, pinCommit, kind: "none" as const, target: undefined };
    });

    const pins = pinEffective.map(({ ref, pinCommit, kind, target }) => {
      if (kind === "direct" && target) {
        const revertedBy = findActiveRevertOnPin(dir, target, pinCommit, number);
        return {
          ref,
          commit: pinCommit,
          contains: !revertedBy,
          commitAncestor: true,
          ...(revertedBy ? { revertedBy } : {}),
        };
      }
      if (kind === "cherry-pick" && target) {
        const revertedBy = findActiveRevertOnPin(dir, target, pinCommit, number);
        return {
          ref,
          commit: pinCommit,
          contains: !revertedBy,
          commitAncestor: false,
          cherryPickCommit: target,
          ...(revertedBy ? { revertedBy } : {}),
        };
      }
      if (kind === "same-number" && target) {
        const revertedBy = findActiveRevertOnPin(dir, target, pinCommit, number);
        return {
          ref,
          commit: pinCommit,
          contains: false,
          commitAncestor: false,
          ...(revertedBy ? { revertedBy } : { sameNumberCommit: target }),
        };
      }
      return { ref, commit: pinCommit, contains: false, commitAncestor: false };
    });
    const tags = gitText(dir, ["tag", "--contains", commit, "--sort=version:refname"])
      .split(/\r?\n/)
      .filter(Boolean);
    return {
      status: "found",
      commit,
      ...(found.length > 1 ? { commits: found } : {}),
      pins,
      tags: tags.slice(0, MAX_TAGS),
      moreTags: Math.max(0, tags.length - MAX_TAGS),
    };
  } catch (error) {
    return { status: "error", reason: String(error instanceof Error ? error.message : error) };
  }
}

export async function traceChat(
  root: string,
  message: string,
  opts: { session?: TraceSession; now?: Date; signal?: AbortSignal } = {},
): Promise<ChatTrace> {
  opts.signal?.throwIfAborted();
  if (!looksLikeError(message)) return { status: "skipped", reason: "问题里没有报错特征" };
  const config = loadTraceConfig(root);
  let plan: ReturnType<typeof searchPlan>;
  try {
    plan = searchPlan(config, message, opts.now ?? new Date());
  } catch (error) {
    return { status: "skipped", reason: error instanceof Error ? error.message : String(error) };
  }
  const session =
    opts.session ??
    new TraceSession(
      config,
      new GithubClient(process.env.GITHUB_TOKEN, (url, init) => {
        opts.signal?.throwIfAborted();
        return fetch(url, {
          ...init,
          signal: opts.signal
            ? AbortSignal.any([opts.signal, ...(init?.signal ? [init.signal] : [])])
            : init?.signal,
        });
      }),
      join(root, "tools/wiki-runtime/github-trace/cache"),
    );
  const scope: TraceScope = {
    repos: [...new Set(plan.queries.map((q) => q.repo))],
    since: plan.since,
    terms: plan.terms,
  };
  const found = await searchErrors(session, plan);
  opts.signal?.throwIfAborted();
  const failed = found.searches.filter((s) => s.error);
  if (found.searches.length > 0 && failed.length === found.searches.length)
    return { status: "failed", reason: failed[0]!.error!, scope };
  const problems = failed.map((s) => `搜索「${s.query}」失败：${s.error}`);
  const top = found.candidates.slice(0, CHAT_CANDIDATES);
  const candidates: ChatTraceCandidate[] = [];
  let followed = false;
  for (const c of top) {
    opts.signal?.throwIfAborted();
    const candidate: ChatTraceCandidate = {
      repo: c.repo,
      number: c.number,
      kind: c.kind === "pr" ? "pr" : "issue",
      url: c.url,
      title: c.title,
      state: c.state,
      updatedAt: c.updatedAt,
      matchedQueries: c.matchedQueries.length,
      excerpt: c.body.blocked
        ? ""
        : c.body.text.slice(0, 12000) +
          (c.body.truncated || c.body.text.length > 12000 ? "\n[搜索正文摘录已截断]" : ""),
      docs: localDocVersions(root, c.body.blocked ? "" : c.body.text),
    };
    if (candidate.kind === "pr") {
      candidate.versions = localFixVersions(root, c.repo, c.number);
      if (c === top[0]) {
        try {
          const thread = await inspectThread(session, c.url);
          candidate.excerpt = threadExcerpt(thread);
          problems.push(...thread.problems.map((p) => `读取 ${c.url}：${p}`));
        } catch (error) {
          problems.push(`读取 ${c.url} 失败：${String(error)}`);
        }
      }
    } else if (!followed) {
      followed = true;
      try {
        const thread = await inspectThread(session, c.url);
        candidate.excerpt = threadExcerpt(thread);
        candidate.docs = localDocVersions(
          root,
          [
            c.body.blocked ? "" : c.body.text,
            thread.body.blocked ? "" : thread.body.text,
            ...thread.comments.filter((comment) => !comment.blocked).map((comment) => comment.text),
          ].join("\n"),
        );
        problems.push(...thread.problems.map((p) => `读取 ${c.url}：${p}`));
        // 同一个编号会以 /issues/N（正文里的 #N）和 /pull/N（cross-reference）两种链接各出现一次：按编号合并依据
        const refs = new Map<
          string,
          { repo: string; number: number; url: string; kind: string; basis: string[] }
        >();
        for (const ref of thread.related) {
          const target = parseTraceUrl(config, ref.url);
          const key = `${target.repo}#${target.number}`;
          const known = refs.get(key);
          if (!known) refs.set(key, { ...target, url: ref.url, basis: [...ref.basis] });
          else {
            known.basis.push(...ref.basis);
            if (target.kind === "pr") Object.assign(known, { url: ref.url, kind: "pr" });
          }
        }
        // 名额（relatedPrLimit）有限，先取主动引用这个 issue 的 PR——修复 PR 通常写着「Fixes #N」，
        // 以 cross-referenced 事件出现；再取评论里提到的；正文里提到的多是背景（「由 #X 引入」）。
        // 2026-09-23 真实跑 #15815：按出现顺序取，正文与评论里的三个旧 PR 占满名额，修复 #15981 被截掉。
        const priority = (basis: string[]) =>
          basis.includes(REF_BASIS.crossReference) ? 0 : basis.includes(REF_BASIS.comment) ? 1 : 2;
        const ordered = [...refs].sort(([, a], [, b]) => priority(a.basis) - priority(b.basis));
        const linked: NonNullable<ChatTraceCandidate["linkedPrs"]> = [];
        for (const [, ref] of ordered) {
          const { number } = ref;
          if (linked.length >= config.relatedPrLimit) break;
          const versions = localFixVersions(root, ref.repo, number);
          // `#N` 提及可能指 issue 也可能指 PR；本地找不到合并提交、链接又不是 /pull/ 的不算关联 PR
          if (ref.kind !== "pr" && versions.status !== "found") continue;
          let excerpt: string | undefined;
          try {
            const detail = await inspectThread(session, ref.url);
            excerpt = threadExcerpt(detail);
            problems.push(...detail.problems.map((p) => `读取 ${ref.url}：${p}`));
          } catch (error) {
            problems.push(`读取 ${ref.url} 失败：${String(error)}`);
          }
          linked.push({ number, url: ref.url, basis: [...new Set(ref.basis)].join("；"), versions, excerpt });
        }
        if (linked.length) candidate.linkedPrs = linked;
      } catch (error) {
        problems.push(`读取 ${c.url} 失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    candidates.push(candidate);
  }
  return {
    status: "done",
    scope,
    candidates,
    omitted: found.omittedCandidates + (found.candidates.length - top.length),
    complete: found.complete && problems.length === 0,
    problems,
    requests: session.requests,
    cacheHits: session.cacheHits,
  };
}

/** 推给界面的那一份：不带正文摘录，只带能点开核对的东西 */
export function publicTrace(trace: ChatTrace) {
  if (trace.status !== "done") return trace;
  return {
    ...trace,
    candidates: trace.candidates.map(({ excerpt: _excerpt, linkedPrs, ...rest }) => ({
      ...rest,
      ...(linkedPrs ? { linkedPrs: linkedPrs.map(({ excerpt: _linkedExcerpt, ...link }) => link) } : {}),
    })),
  };
}
