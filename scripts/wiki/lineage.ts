/**
 * 版本谱系：一个标识符（参数名、类名、函数名）在各分支上的存亡，以及引入 / 移除的 PR。
 *
 * 这一节**由脚本算，不由 agent 写**。理由很直接：agent 会编 PR 号，而这些事实
 * git 里全都有，四条命令就能算准，上游一更新重算即可。2026-09-12 用户问
 * 「layer sharding 哪个版本移除、PR 是什么、影响是什么」，答案就是这么来的：
 *
 *   git grep -l <名字> origin/<分支> -- <路径>     → 每个分支有没有
 *   git log -S <名字> origin/main -- <路径>        → 哪次提交改变了它的存在
 *   提交标题里的 (#NNNN)                            → PR 号
 *   git show --stat <提交>                          → 影响面
 */

export interface LineageDeps {
  /** 该 ref 上命中该标识符的文件数 */
  countIn: (ref: string, term: string, paths: string[]) => number;
  /** 改变过该标识符存在状态的提交，最新在前 */
  historyOf: (ref: string, term: string, paths: string[]) => Commit[];
  /** 一次提交在给定路径下的改动统计 */
  statOf: (sha: string, paths: string[]) => FileStat[];
}

export interface Commit {
  sha: string;
  date: string;
  subject: string;
}

export interface FileStat {
  path: string;
  added: number;
  removed: number;
}

export interface Presence {
  ref: string;
  files: number;
}

export interface Lineage {
  term: string;
  /** 每个分支上有几个文件命中，按 seeds 里的 ref 顺序 */
  presence: Presence[];
  introduced?: Change;
  removed?: Change;
}

export interface Change {
  sha: string;
  date: string;
  subject: string;
  pr?: number;
  /** 净删除行数最多的几个文件，用来说明影响面 */
  topFiles: FileStat[];
}

/** 上游的提交标题惯例是 `... (#11953)` */
export function prOf(subject: string): number | undefined {
  const m = /\(#(\d+)\)\s*$/.exec(subject.trim());
  return m?.[1] ? Number(m[1]) : undefined;
}

function toChange(c: Commit, stats: FileStat[]): Change {
  const pr = prOf(c.subject);
  const topFiles = [...stats].sort((a, b) => b.removed - a.removed).slice(0, 5);
  return { sha: c.sha, date: c.date, subject: c.subject, ...(pr ? { pr } : {}), topFiles };
}

/**
 * @param refs 要查的分支，**按版本从旧到新排列**——移除点靠相邻两版的有无翻转判定
 * @param paths 限定搜索范围，通常是 `vllm_ascend/`，避免被文档与译文干扰
 */
export function buildLineage(term: string, refs: string[], paths: string[], deps: LineageDeps): Lineage {
  const presence = refs.map((ref) => ({ ref, files: deps.countIn(ref, term, paths) }));
  const newest = refs[refs.length - 1] ?? "main";
  const out: Lineage = { term, presence };

  // 移除点：在最新分支上已经没有了 → 那条历史上最近一次动过它的提交
  const goneOnNewest = (presence[presence.length - 1]?.files ?? 0) === 0;
  if (goneOnNewest) {
    const history = deps.historyOf(newest, term, paths);
    if (history[0]) out.removed = toChange(history[0], deps.statOf(history[0].sha, paths));
  }

  // 引入点：要走**最后一个还有它的分支**的历史。
  // 走最新分支会取到「这个名字在那条历史上第一次出现」，而它已经被删了，
  // 拿到的未必是这个特性的诞生点——已删分支的历史可能被 squash 或改名截断。
  const lastAlive = [...presence].reverse().find((p) => p.files > 0)?.ref;
  if (lastAlive) {
    const aliveHistory = deps.historyOf(lastAlive, term, paths);
    const first = aliveHistory[aliveHistory.length - 1];
    if (first) out.introduced = toChange(first, deps.statOf(first.sha, paths));
  }
  return out;
}

/** 渲染成参数页「版本谱系」一节的 markdown。人和 agent 都不要手改这一节。 */
export function renderLineage(l: Lineage): string {
  const rows = l.presence.map((p) => `| ${p.ref} | ${p.files > 0 ? `有（${p.files} 个文件）` : "无"} |`);
  const out = [
    "## 版本谱系",
    "",
    "<!-- 由 pnpm wiki:lineage 生成，勿手改 -->",
    "",
    "| 版本 | 是否存在 |",
    "| --- | --- |",
    ...rows,
    "",
  ];
  if (l.removed) {
    const { sha, date, subject, pr, topFiles } = l.removed;
    out.push(
      `**移除**：${date}，${pr ? `PR [#${pr}](https://github.com/vllm-project/vllm-ascend/pull/${pr})` : sha} —— ${subject}`,
      "",
      "影响面（删除行数最多的几个文件）：",
      "",
      ...topFiles.map((f) => `- \`${f.path}\` −${f.removed}`),
      "",
    );
  }
  if (l.introduced) {
    const { date, subject, pr, sha } = l.introduced;
    out.push(
      `**引入**：${date}，${pr ? `PR [#${pr}](https://github.com/vllm-project/vllm-ascend/pull/${pr})` : sha} —— ${subject}`,
      "",
    );
  }
  return out.join("\n");
}

/**
 * 整节替换 markdown 里的某个 H2 小节，前后小节原样保留。
 *
 * 参数页的「版本谱系」由 `wiki:lineage:apply` 每次重算覆盖——不管上一次是
 * agent 写的还是脚本生成的。放在库里而不是 CLI 里，是为了让它能被单测直接
 * 引用而不触发 CLI 的副作用。
 */
export function replaceSection(body: string, section: string, content: string): string {
  const i = body.indexOf(section);
  if (i < 0) return `${body.trimEnd()}\n\n${content}\n`;
  const rest = body.slice(i + section.length);
  const next = rest.search(/^##\s/m);
  const tail = next < 0 ? "" : rest.slice(next);
  return `${body.slice(0, i)}${content}\n\n${tail}`.replace(/\n{3,}/g, "\n\n");
}
