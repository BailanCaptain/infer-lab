/**
 * ingest 引擎的纯函数部分：种子清单 schema、两类 agent 请求的构造、stream-json 解析、
 * 快照差集（越界检查）、并发池、扇出提取、整合决策落地。
 * 真正 spawn 在 claude-cli.ts；入口在 scripts/wiki-ingest.ts。
 */
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { buildAdjacency, type RelationNode } from "../../src/content/wiki/relations";
import { ID_RE, PAGE_TYPES } from "../../src/content/wiki/schema";
import { type AgentEvent, type AgentRequest, type RunAgent, runBatch } from "./batch";
import type { HandbookSlices } from "./handbook";
import { PAGE_DIRS, parsePage } from "./pages";
import { revisionDateSchema, revisionSchema } from "./revisions";

// Compatibility exports: the shared contract and executor are defined only in batch.ts.
export { type AgentEvent, type AgentRequest, type AgentResult, type RunAgent, runPool } from "./batch";

// ---------- 种子清单 ----------

const shaField = z.string().regex(/^[0-9a-f]{7,40}$/);

/** 默认 ref 名。一个 repo 至少要有它，feature 不写 `ref` 时用它。 */
export const DEFAULT_REF = "main";

/**
 * 一个 repo 钉一组 ref，而不是一个 commit。
 *
 * 原因（2026-09-11 完整克隆下实测）：`layer_sharding` 在分支间的分布是非单调的——
 * v0.13.0 有 8 个文件、v0.18.0 有 9 个、v0.23.0 有 14 个、v0.24.0rc 起主线为 0、
 * v0.26.0rc 又有 1 处（单测里的残留赋值，不是功能回归）。
 * 「哪个版本移除的」只能按 ref 列表回答，单 commit 模型结构上答不了。
 *
 * 兼容旧格式：只写 `commit: <sha>` 时归一化成 `refs: { main: <sha> }`，
 * 现有的 wiki/seeds/*.yaml 不用改。
 */
const repoSchema = z
  .object({
    url: z.string().url(),
    /** 旧格式，等价于 refs.main */
    commit: shaField.optional(),
    refs: z.record(shaField).optional(),
    /** 相对仓库根 */
    path: z.string().min(1),
  })
  .transform((r) => {
    const refs = r.refs ?? (r.commit ? { [DEFAULT_REF]: r.commit } : undefined);
    return { url: r.url, path: r.path, refs: refs ?? {} };
  })
  .refine((r) => Object.keys(r.refs).length > 0, {
    message: "repo 必须声明 refs（或旧格式的 commit）",
  });

export const seedsSchema = z
  .object({
    repos: z.record(repoSchema),
    features: z.array(
      z
        .object({
          id: z.string().regex(ID_RE),
          title: z.string().min(1),
          type: z.enum(PAGE_TYPES),
          chapters: z.array(z.string().regex(/^\d{2}$/)).min(1),
          priority: z.number().int().min(1).max(3).default(2),
          repo: z.string(),
          /** @deprecated 旧格式的单 ref，归一化进 refs */
          ref: z.string().optional(),
          /**
           * 本 feature 要对照的 ref 列表，都必须是所属 repo 的 refs 的键。
           *
           * 一页只钉一个 ref 是 2026-09-12 被推翻的做法：读者在 v0.23.0 上开发、
           * 页面讲的是 main，对不上就只能干瞪眼。文档的价值恰恰在于讲清版本之间
           * 的差异，所以提取时要同时读多个 ref 并把不同之处写出来。
           */
          refs: z.array(z.string().min(1)).min(1).optional(),
          entry: z.array(z.string().min(1)).min(1),
          /** 对应的官方文档文件（相对仓库根）。不写则 agent 只能顺着源码碰运气——
           *  实测 152 个文档只被碰到 9 个（2026-09-11） */
          docs: z.array(z.string().min(1)).default([]),
          ask: z.string().min(1),
        })
        .transform((f) => ({
          ...f,
          refs: f.refs ?? (f.ref ? [f.ref] : [DEFAULT_REF]),
        })),
    ),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    for (const f of s.features) {
      const repo = s.repos[f.repo];
      if (!repo) {
        ctx.addIssue({ code: "custom", message: `feature ${f.id} 的 repo「${f.repo}」不在 repos 里` });
      } else {
        for (const ref of f.refs) {
          if (!repo.refs[ref]) {
            ctx.addIssue({
              code: "custom",
              message: `feature ${f.id} 的 ref「${ref}」不在 repo ${f.repo} 的 refs 里（有 ${Object.keys(repo.refs).join("、")}）`,
            });
          }
        }
      }
      if (seen.has(f.id)) ctx.addIssue({ code: "custom", message: `feature id 重复：${f.id}` });
      seen.add(f.id);
    }
  });
export type Seeds = z.infer<typeof seedsSchema>;
export type SeedFeature = Seeds["features"][number];

export function parseSeeds(text: string): Seeds {
  return seedsSchema.parse(parseYaml(text));
}

/** `repoRoots` 与磁盘工作树的索引键。一个 ref 一份工作树，所以 repo 名不足以定位。 */
export function worktreeKey(repo: string, ref: string): string {
  return `${repo}@${ref}`;
}

// ---------- agent 请求 ----------

export interface IngestContext {
  handbook: HandbookSlices;
  wikiRoot: string;
  /** `repo@ref` → 该 ref 的本地工作树绝对路径，键由 worktreeKey 生成 */
  repoRoots: Record<string, string>;
  today: string;
  timeoutMs: number;
  /** 本批全部 feature id，供 related 参考 */
  batchIds: string[];
  /** `repo@ref` → 该 ref 的文档变量表，用于在本地展开 `{{ }}` 占位符 */
  docVars?: Record<string, Record<string, string>>;
  /** 上游 docs/source/llms.txt 原文，当作找文档的地图 */
  llmsTxt?: string;
}

/**
 * 工具黑名单，按角色分。
 *
 * 注意不能放 Edit：Spike W1（2026-09-07）实测 `Edit(路径)` 规则同时管 Write，
 * 禁 Edit 会把 Write 一起禁掉；而 `Write(路径)` 不是被识别的规则语法。
 *
 * 联网按角色区分（2026-09-11 修正）：此前一刀切禁掉 WebFetch/WebSearch，
 * 结果是一个讲 vllm-ascend 的知识库连昇腾官方文档都打不开，而 HANDBOOK 还写着
 * 「去官网取展开值」——规则与能力矛盾。真正该限的是**能引什么**，不是能读什么，
 * 那由 lint 的 `source-domain` 规则与 HANDBOOK 的白名单管。
 *
 * 注意 `--allowedTools` 在 `-p` 无人值守模式下是**白名单**而非「免确认表」：
 * 不在表里的工具会被直接拒（实测 2026-09-11：`Claude requested permissions to
 * use WebFetch, but you haven't granted it yet.`）。所以放开联网必须同时做两件事，
 * 从黑名单拿掉、往白名单加上，只做前者等于没做。
 */
const BASE_DISALLOWED = ["Bash", "NotebookEdit", "Task", "Agent"];
const WEB_TOOLS = ["WebFetch", "WebSearch"];
/** 提取：要读官方文档站、昇腾文档、论文，放开联网 */
const EXTRACT_DISALLOWED = BASE_DISALLOWED;
/** 整合：只处理已有草稿、不引入新来源，联网无正当用途 */
const INTEGRATE_DISALLOWED = [...BASE_DISALLOWED, ...WEB_TOOLS];

function baseArgs(system: string): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--append-system-prompt",
    system,
    "--max-turns",
    "80",
  ];
}

/**
 * 文档变量表。上游文档正文里的 `{{ 变量 }}` 只有渲染后才有值。提取 agent 现在
 * 能上网了，但变量表本来就在仓库里（MkDocs 的 mkdocs.yml 或 Sphinx 的 conf.py），
 * 由引擎解出来直接给它，比让它去官网猜哪个渲染值对应哪个变量更准也更快。
 */
function docVarsBlock(vars?: Record<string, string>): string[] {
  const entries = Object.entries(vars ?? {});
  if (entries.length === 0) return [];
  return [
    "",
    "文档变量表（本地文档正文里的 `{{ 变量 }}` 用它展开，**不要把占位符原样抄进页面**）：",
    ...entries.map(([k, v]) => `- {{ ${k} }} → ${v}`),
  ];
}

/** llms.txt 是上游专门为 LLM 写的官方索引，当作找文档的地图。 */
function llmsTxtBlock(text?: string): string[] {
  if (!text?.trim()) return [];
  return ["", "上游的 llms.txt（官方给 LLM 的文档索引，按它找文档，别顺着源码碰运气）：", text.trim()];
}

/** 一个 feature 要对照的每个 ref 的落地信息 */
interface RefTarget {
  ref: string;
  commit: string;
  root: string;
}

function refTargets(f: SeedFeature, seeds: Seeds, ctx: IngestContext): RefTarget[] {
  const repo = seeds.repos[f.repo];
  if (!repo) throw new Error(`repo ${f.repo} 未定义`);
  return f.refs.map((ref) => {
    const commit = repo.refs[ref];
    if (!commit) throw new Error(`repo ${f.repo} 没有 ref ${ref}`);
    const root = ctx.repoRoots[worktreeKey(f.repo, ref)];
    if (!root) throw new Error(`repo ${f.repo} 的 ref ${ref} 没有本地工作树，先跑 pnpm wiki:clone`);
    return { ref, commit, root };
  });
}

/**
 * 要对照的版本清单。
 *
 * 多 ref 时把「必须写差异」顶到任务最显眼的位置。一页只钉一个 ref 是
 * 2026-09-12 被推翻的做法：读者在 v0.23.0 上开发、页面讲的是 main，
 * 对不上就等于没用——文档的价值恰恰在于讲清版本之间的差异。
 */
function refsBlock(repo: string, targets: RefTarget[]): string[] {
  const lines = targets.map(
    (t) =>
      `  - ${t.ref} = ${repo}@${t.commit}，只读路径 ${t.root}，sources 写 ${repo}@${t.commit}:<相对路径>#L起-L止`,
  );
  if (targets.length === 1) return ["- 来源仓库（单版本）：", ...lines];
  return [
    `- **要对照 ${targets.length} 个版本**：`,
    ...lines,
    `  **每条结论都要确认在这 ${targets.length} 个版本上是否一致。** 一致的照常写；`,
    "  不一致的必须写清哪个版本是哪样，该条标 `[!]`，事实表里那一行分版本列。",
  ];
}

export function extractRequest(f: SeedFeature, seeds: Seeds, ctx: IngestContext): AgentRequest {
  const targets = refTargets(f, seeds, ctx);
  const primary = targets[0] as RefTarget;
  const draft = `_drafts/${f.id}.md`;
  const raw = `raw/${f.id}.md`;
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.extract.trim()}`),
    // 每个 ref 一份只读工作树，agent 逐一对照后把差异写进页面
    ...targets.flatMap((t) => ["--add-dir", t.root]),
    "--allowedTools",
    "Read",
    "Grep",
    "Glob",
    ...WEB_TOOLS,
    `Edit(${draft})`,
    `Edit(${raw})`,
    "--disallowedTools",
    ...EXTRACT_DISALLOWED,
  ];
  const stdin = [
    `任务：为 feature「${f.title}」写一页 wiki 草稿。`,
    "",
    `- id: ${f.id}`,
    `- type: ${f.type}`,
    `- chapters: ${JSON.stringify(f.chapters)}`,
    `- updated: "${ctx.today}"`,
    ...refsBlock(f.repo, targets),
    `- 源码入口：${f.entry.join("、")}`,
    `- 文档入口：${f.docs.length > 0 ? f.docs.join("、") : "（未指定，自己按下面的 llms.txt 找）"}`,
    `- 要回答的问题：${f.ask}`,
    `- 本批其它 feature id（related 可引用）：${ctx.batchIds.filter((x) => x !== f.id).join(", ") || "无"}`,
    ...docVarsBlock(ctx.docVars?.[worktreeKey(f.repo, primary.ref)]),
    ...llmsTxtBlock(ctx.llmsTxt),
    "",
    `只允许写这两个文件（相对当前目录）：${draft}、${raw}。写完回复 DONE ${f.id} sources=<数量>。`,
  ].join("\n");
  return { id: f.id, cwd: ctx.wikiRoot, args, stdin, timeoutMs: ctx.timeoutMs, allowedWrites: [draft, raw] };
}

/** 整合阶段需要知道的最少信息，草稿与现有页共用这个形状 */
export interface PageRef extends RelationNode {
  /** Actual path from loadPages; required for every selected existing page. */
  file?: string;
  chapters: string[];
  /** 草稿当前的内联标记数。整合 agent 要删到 MARK_BUDGET 以内，引擎先替它数好。 */
  marks?: number;
  /** 草稿事实表的行数。同理，删到 FACTS_BUDGET 以内。 */
  facts?: number;
}

/** 每页内联标记上限，与 HANDBOOK「整合」第 4 条一致 */
export const MARK_BUDGET = 20;
/** 事实表行数上限，与 HANDBOOK「页面格式」第 5 节一致 */
export const FACTS_BUDGET = 10;

export interface SelectOptions {
  /** 相关页数量上限，默认 30 */
  max?: number;
}

/**
 * 从现有页里挑出与本批草稿相关的那些（风险 R2 的应对）。
 *
 * 原来 HANDBOOK 让整合 agent「读 concepts/ 里全部现有页」。11 页时是 96 KB，
 * 没问题；120–160 页约 1.4 MB、40 万 token 量级，会撞上下文，而且每批都要
 * 重读一遍，成本随页数增长。
 *
 * 挑选规则按相关性从强到弱：
 *   1. 同 id 的现有页（更新时必须读旧结论）
 *   2. relations 一跳邻居，反向边派生
 *   3. 章节有交集
 * 前两类是明确的语义关联，优先保留；第三类只是「可能相关」，超上限时先砍它。
 */
export function selectRelevantPages(
  drafts: PageRef[],
  existing: PageRef[],
  opts: SelectOptions = {},
): PageRef[] {
  const max = opts.max ?? 30;
  const draftIds = new Set(drafts.map((d) => d.id));
  const graph = buildAdjacency([...existing, ...drafts]);
  const wantedIds = new Set(drafts.flatMap((d) => graph.get(d.id) ?? []));
  const wantedChapters = new Set(drafts.flatMap((d) => d.chapters));

  const sameId: PageRef[] = [];
  const linked: PageRef[] = [];
  const sameChapter: PageRef[] = [];
  for (const p of existing) {
    if (draftIds.has(p.id)) sameId.push(p);
    else if (wantedIds.has(p.id)) linked.push(p);
    else if (p.chapters.some((c) => wantedChapters.has(c))) sameChapter.push(p);
  }
  // 组内按 id 排序，保证同样输入给出同样结果
  const byId = (a: PageRef, b: PageRef) => a.id.localeCompare(b.id);
  if (sameId.length > max) throw new Error("同 id 的现有页超过整合上限，请拆小批次");
  return [...sameId.sort(byId), ...linked.sort(byId), ...sameChapter.sort(byId)].slice(0, max);
}

export function integrateRequest(drafts: PageRef[], existing: PageRef[], ctx: IngestContext): AgentRequest {
  const draftIds = drafts.map((d) => d.id);
  const relevant = selectRelevantPages(drafts, existing);
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.integrate.trim()}`),
    "--allowedTools",
    "Read",
    "Grep",
    "Glob",
    ...PAGE_DIRS.map((dir) => `Edit(${dir}/**)`),
    "Edit(_drafts/_integration.json)",
    "--disallowedTools",
    ...INTEGRATE_DISALLOWED,
  ];
  // 要删标记的页与删多少，引擎数好直接给——让 agent 自己数 11 页是在浪费它的注意力，
  // 而且「数一遍」这种指令实测不落地（2026-09-11 那轮只删到 27-40，目标是 20）
  const overBudget = drafts.filter((d) => (d.marks ?? 0) > MARK_BUDGET);
  const factsOver = drafts.filter((d) => (d.facts ?? 0) > FACTS_BUDGET);
  const stdin = [
    `任务：整合 ${draftIds.length} 份草稿到对应的正式页面目录。今天是 ${ctx.today}。`,
    "",
    "草稿文件：",
    ...drafts.map(
      (d) => `- _drafts/${d.id}.md（内联标记 ${d.marks ?? "?"} 处，事实表 ${d.facts ?? "?"} 行）`,
    ),
    ...(overBudget.length > 0
      ? [
          "",
          `以下 ${overBudget.length} 页的内联标记超出 ${MARK_BUDGET} 处上限，按「整合」第 4 条删到达标：`,
          ...overBudget.map(
            (d) => `- ${d.id}：${d.marks} → 至多 ${MARK_BUDGET}，需删掉约 ${(d.marks ?? 0) - MARK_BUDGET} 处`,
          ),
        ]
      : []),
    ...(factsOver.length > 0
      ? [
          "",
          `以下 ${factsOver.length} 页的事实表超出 ${FACTS_BUDGET} 行上限，按「整合」第 5 条删到达标（并去掉「来源」列）：`,
          ...factsOver.map(
            (d) =>
              `- ${d.id}：${d.facts} 行 → 至多 ${FACTS_BUDGET}，需删掉约 ${(d.facts ?? 0) - FACTS_BUDGET} 行`,
          ),
        ]
      : []),
    "",
    relevant.length > 0
      ? "需要对照的现有页（程序已按同 id、relations 与章节交集挑出，**只读这些，不要扫全库**）："
      : "现有页里没有与本批相关的（程序已按 relations 与章节交集查过），核对草稿后处理，不要扫全库。",
    ...relevant.map((p) => {
      if (!p.file) throw new Error(`现有页 ${p.id} 缺少实际 file 路径`);
      return `- ${p.file}`;
    }),
    "",
    "按「整合」规则处理，写 _drafts/_integration.json，回复 DONE integrate promoted=<n> merged=<n> rejected=<n>。",
  ].join("\n");
  return {
    id: "_integrate",
    cwd: ctx.wikiRoot,
    args,
    stdin,
    timeoutMs: ctx.timeoutMs,
    allowedWrites: [...PAGE_DIRS.map((dir) => `${dir}/**`), "_drafts/_integration.json"],
  };
}

// ---------- stream-json ----------

export function parseStreamJsonLine(line: string): AgentEvent | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (obj.type === "assistant") {
    const msg = obj.message as
      | { content?: { type: string; name?: string; input?: Record<string, unknown> }[] }
      | undefined;
    const tool = msg?.content?.find((c) => c.type === "tool_use");
    if (!tool?.name) return null;
    const input = tool.input ?? {};
    const target = (input.file_path ?? input.pattern ?? input.path) as string | undefined;
    return target !== undefined
      ? { kind: "tool", name: tool.name, target }
      : { kind: "tool", name: tool.name };
  }
  if (obj.type === "result") {
    const e: AgentEvent = { kind: "result", isError: Boolean(obj.is_error) };
    if (typeof obj.session_id === "string") e.sessionId = obj.session_id;
    if (typeof obj.total_cost_usd === "number") e.costUsd = obj.total_cost_usd;
    return e;
  }
  return null;
}

// ---------- 快照与越界 ----------

export type Snapshot = Map<string, string>;

export function snapshotDir(root: string): Snapshot {
  const out: Snapshot = new Map();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out.set(relative(root, abs).replace(/\\/g, "/"), `${st.mtimeMs}:${st.size}`);
    }
  };
  walk(root);
  return out;
}

export function diffSnapshot(before: Snapshot, after: Snapshot): string[] {
  const changed: string[] = [];
  for (const [p, sig] of after) if (before.get(p) !== sig) changed.push(p);
  return changed;
}

function globToRe(glob: string): RegExp {
  // 先把 ** 换成占位符，避免被单 * 的替换吃掉；占位符选一个 glob 里不会出现的字符
  const esc = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§")
    .replace(/\*/g, "[^/]*")
    .replace(/§/g, ".*");
  return new RegExp(`^${esc}$`);
}

export function strayPaths(changed: string[], allowed: Iterable<string>): string[] {
  const res = [...allowed].map(globToRe);
  return changed.filter((p) => !res.some((re) => re.test(p)));
}

/**
 * 把越界路径分成「本批新建的」与「本来就在、被改动的」。
 *
 * 这个区分是 2026-09-11 事故换来的：守卫当时对所有越界路径一律 `rmSync`，
 * 结果把 `wiki/HANDBOOK.md`——规则的唯一真相源——删了，并把 11 个正常产出的
 * agent 全判失败。而 agent 的白名单是 `Edit(_drafts/<id>.md)` 与
 * `Edit(raw/<id>.md)`，它压根没有写 HANDBOOK 的权限，那次改动来自引擎外部。
 *
 * 所以两类要分开处置：
 * - `created`：本批凭空多出来的文件。只可能是 agent 写的，删掉是正确的收容，
 *   且它本来就不存在，删了不丢东西。
 * - `modified`：本来就在的文件被改了。可能是人、编辑器、另一个进程——25 分钟的
 *   窗口里这些都比 agent 越权更可能。**一律不删**，报出来让人自己看。
 */
export function classifyStray(stray: string[], before: Snapshot): { created: string[]; modified: string[] } {
  const created: string[] = [];
  const modified: string[] = [];
  for (const p of stray) (before.has(p) ? modified : created).push(p);
  return { created, modified };
}

// ---------- 扇出提取 ----------

export interface FailureRecord {
  at: string;
  reason: string;
  sessionId?: string;
  stderrTail?: string;
}
export type Failures = Record<string, FailureRecord>;

export function selectIngestFeatures<T extends { id: string }>(
  features: T[],
  wikiRoot: string,
  opts: { only?: string[]; skipExisting?: boolean; retryFailed?: boolean } = {},
): T[] {
  const known = new Set(features.map((f) => f.id));
  for (const id of opts.only ?? []) if (!known.has(id)) throw new Error(`未知 feature id：${id}`);
  const failures = opts.retryFailed ? readFailures(wikiRoot) : {};
  return features.filter(
    (f) =>
      (!opts.only || opts.only.includes(f.id)) &&
      (!opts.retryFailed || Object.hasOwn(failures, f.id)) &&
      (!opts.skipExisting ||
        !["_drafts", ...PAGE_DIRS].some((dir) => existsSync(join(wikiRoot, dir, `${f.id}.md`)))),
  );
}

export function selectIntegrationDrafts(state: {
  available: string[];
  failures: Failures;
  succeeded?: string[];
  only?: string[];
}): string[] {
  const requested = state.succeeded ?? state.only;
  if (!requested) throw new Error("独立整合必须用 --only 显式选择草稿");
  for (const id of requested) {
    if (!ID_RE.test(id)) throw new Error(`非法草稿 id：${id}`);
    if (!state.available.includes(id)) throw new Error(`草稿不存在：${id}`);
    if (Object.hasOwn(state.failures, id)) throw new Error(`草稿 ${id} 上次提取失败，请先重试提取`);
  }
  return [...new Set(requested)].sort();
}

export const FAILURES_FILE = "_drafts/_failures.json";

export function readFailures(wikiRoot: string): Failures {
  const p = join(wikiRoot, FAILURES_FILE);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Failures) : {};
}

export function writeFailures(wikiRoot: string, failures: Failures): void {
  writeFileSync(join(wikiRoot, FAILURES_FILE), `${JSON.stringify(failures, null, 2)}\n`);
}

export interface ExtractDeps {
  runAgent: RunAgent;
  concurrency: number;
  log: (line: string) => void;
}

export async function runExtractPhase(
  features: SeedFeature[],
  seeds: Seeds,
  ctx: IngestContext,
  deps: ExtractDeps,
): Promise<{ succeeded: string[]; failures: Failures; costUsd: number; unknownCostIds: string[] }> {
  const before = snapshotDir(ctx.wikiRoot);
  const allowedAll = new Set<string>([FAILURES_FILE]);
  const requests = features.map((f) => extractRequest(f, seeds, ctx));
  for (const r of requests) for (const w of r.allowedWrites) allowedAll.add(w);

  const failures: Failures = readFailures(ctx.wikiRoot);
  const succeeded: string[] = [];
  const { results, costUsd, unknownCostIds } = await runBatch(requests, {
    concurrency: deps.concurrency,
    runAgent: deps.runAgent,
    onStart: (id) => deps.log(`▶ ${id}`),
    onEvent: (id, e) => {
      if (e.kind === "tool") deps.log(`  ${id}: ${e.name} ${e.target ?? ""}`);
    },
    onResult: (r) => deps.log(`${r.ok ? "✓" : "✗"} ${r.id}${r.reason ? ` (${r.reason})` : ""}`),
  });

  const stray = strayPaths(diffSnapshot(before, snapshotDir(ctx.wikiRoot)), allowedAll);
  const { created, modified } = classifyStray(stray, before);
  // 新建的越界文件才删——本来就在的一律不动，见 classifyStray 的说明
  for (const p of created) rmSync(join(ctx.wikiRoot, p), { force: true });
  if (modified.length) {
    deps.log(`! 本批运行期间这些已有文件被改动（不是 agent 能写的路径，未处理）：${modified.join(", ")}`);
  }

  for (const r of results) {
    const draftPath = join(ctx.wikiRoot, `_drafts/${r.id}.md`);
    let reason = r.ok ? undefined : (r.reason ?? `exit ${r.exitCode}`);
    if (!reason && created.length) reason = `本批出现越界写入，已删除：${created.join(", ")}`;
    if (!reason && !existsSync(draftPath)) reason = "agent 结束但没有产出草稿";
    if (!reason) {
      const parsed = parsePage(`_drafts/${r.id}.md`, readFileSync(draftPath, "utf8"));
      if (parsed.problems.length) reason = parsed.problems.map((p) => `[${p.rule}] ${p.message}`).join("；");
    }
    if (reason) {
      const rec: FailureRecord = { at: new Date().toISOString(), reason, stderrTail: r.stderrTail };
      if (r.sessionId) rec.sessionId = r.sessionId;
      failures[r.id] = rec;
    } else {
      delete failures[r.id];
      succeeded.push(r.id);
    }
  }
  writeFailures(ctx.wikiRoot, failures);
  return { succeeded, failures, costUsd, unknownCostIds };
}

// ---------- 整合决策 ----------

const integrationId = z.string().regex(ID_RE);
export const integrationSchema = z.object({
  promoted: z.array(integrationId),
  merged: z.array(z.object({ from: integrationId, into: integrationId })),
  rejected: z.array(z.object({ id: integrationId, reason: z.string() })),
  contradictions: z.array(z.object({ a: integrationId, b: integrationId, note: z.string() })).default([]),
  revisions: z.array(revisionSchema).optional(),
  revisionDate: revisionDateSchema.optional(),
});
export type Integration = z.infer<typeof integrationSchema>;

function titleOf(wikiRoot: string, rel: string): string {
  const p = join(wikiRoot, rel);
  if (!existsSync(p)) return rel;
  const m = /^title:\s*(.+)$/m.exec(readFileSync(p, "utf8"));
  return m?.[1]?.trim() ?? rel;
}

/** 晋升目标目录，与 integrateRequest 的写白名单一致 */
const PROMOTE_DIRS = PAGE_DIRS;

export function applyIntegration(
  wikiRoot: string,
  d: Integration,
  today: string,
): { problems: string[]; logLines: string[] } {
  const problems: string[] = [];
  const logLines: string[] = [];
  for (const id of d.promoted) {
    // 参数页落在 params/，概念页落在 concepts/——两处都找
    const rel = PROMOTE_DIRS.map((dir) => `${dir}/${id}.md`).find((r) => existsSync(join(wikiRoot, r)));
    if (!rel) {
      problems.push(`promoted ${id} 但 ${PROMOTE_DIRS.join(" / ")} 下都没有 ${id}.md，草稿保留`);
      continue;
    }
    rmSync(join(wikiRoot, `_drafts/${id}.md`), { force: true });
    logLines.push(`## [${today}] ingest | ${titleOf(wikiRoot, rel)}\n晋升 ${rel}\n`);
  }
  for (const m of d.merged) {
    const rel = PAGE_DIRS.map((dir) => `${dir}/${m.into}.md`).find((r) => existsSync(join(wikiRoot, r)));
    if (!rel) {
      problems.push(`merged ${m.from} → ${m.into} 但目标页不存在，草稿保留`);
      continue;
    }
    rmSync(join(wikiRoot, `_drafts/${m.from}.md`), { force: true });
    logLines.push(`## [${today}] ingest | ${titleOf(wikiRoot, rel)}\nmerged ${m.from} → ${m.into}\n`);
  }
  for (const c of d.contradictions)
    logLines.push(`## [${today}] review | 矛盾 ${c.a} vs ${c.b}\n${c.note}\n`);
  if (logLines.length) appendFileSync(join(wikiRoot, "log.md"), `${logLines.join("\n")}\n`);
  return { problems, logLines };
}

/**
 * 本地日期 YYYY-MM-DD。不能用 toISOString()：它给的是 UTC，
 * 东八区凌晨跑 ingest 会把页面的 updated 写成前一天。
 */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
