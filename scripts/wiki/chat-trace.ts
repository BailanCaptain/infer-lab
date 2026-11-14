import { existsSync, readFileSync } from "node:fs";
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
      /** 本地克隆里标题以 (#N) 结尾的那个提交——squash 合并的约定 */
      commit: string;
      pins: { ref: string; commit: string; contains: boolean; sameNumberCommit?: string }[];
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

/** 从 revs 可达、标题以 `(#N)` 结尾的提交，新的在前 */
function numberedCommits(dir: string, revs: string[], number: number) {
  const suffix = `(#${number})`;
  return gitText(dir, ["log", ...revs, "-F", `--grep=${suffix}`, "--format=%H%x09%s", "-n", "20"])
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter(([sha, subject]) => sha && subject?.trimEnd().endsWith(suffix))
    .map(([sha]) => sha!);
}

/**
 * 用本地克隆回答「这个 PR 的修复进了哪些版本」。钉点只认 `wiki/seeds/vllm-ascend-code.yaml`——
 * 夜间任务与行号审计用的也是它。先在远端 main（没有就用 main 钉点）上按 `(#N)` 找合并提交，
 * 再逐个钉点做祖先判断；不在祖先链上的，再看该钉点历史里有没有同号提交（回移常见的样子）。
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
    let head = "refs/remotes/origin/main";
    try {
      gitText(dir, ["rev-parse", "--verify", "--quiet", `${head}^{commit}`]);
    } catch {
      head = entry.refs.main ?? Object.values(entry.refs)[0]!;
    }
    const pinCommits = Object.entries(entry.refs).map(([ref, pin]) => ({
      ref,
      commit: gitText(dir, ["rev-parse", "--verify", `${pin}^{commit}`]).trim(),
    }));
    // 先认 main 上的那个；直接合进发布分支的 PR（如「[Backport v0.26.0rc] … (#15981)」）main 上没有，
    // 再到各发布分支与各钉点上找
    let found = numberedCommits(dir, [head], number);
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
        reason: `本地克隆的 main 与各发布分支上都没有标题以 (#${number}) 结尾的提交：可能尚未合并、不是 squash 合并，或克隆比这个 PR 旧`,
      };
    const commit = found.at(-1)!;
    const pins = pinCommits.map(({ ref, commit: pinCommit }) => {
      const contains = isAncestor(dir, commit, pinCommit);
      const same = contains ? undefined : numberedCommits(dir, [pinCommit], number)[0];
      return { ref, commit: pinCommit, contains, ...(same ? { sameNumberCommit: same } : {}) };
    });
    const tags = gitText(dir, ["tag", "--contains", commit, "--sort=version:refname"])
      .split(/\r?\n/)
      .filter(Boolean);
    return {
      status: "found",
      commit,
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
