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
import { ID_RE, PAGE_TYPES } from "../../src/content/wiki/schema";
import type { HandbookSlices } from "./handbook";
import { parsePage } from "./pages";

// ---------- 种子清单 ----------

export const seedsSchema = z
  .object({
    repos: z.record(
      z.object({
        url: z.string().url(),
        commit: z.string().regex(/^[0-9a-f]{7,40}$/),
        /** 相对仓库根 */
        path: z.string().min(1),
      }),
    ),
    features: z.array(
      z.object({
        id: z.string().regex(ID_RE),
        title: z.string().min(1),
        type: z.enum(PAGE_TYPES),
        chapters: z.array(z.string().regex(/^\d{2}$/)).min(1),
        priority: z.number().int().min(1).max(3).default(2),
        repo: z.string(),
        entry: z.array(z.string().min(1)).min(1),
        ask: z.string().min(1),
      }),
    ),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    for (const f of s.features) {
      if (!s.repos[f.repo]) {
        ctx.addIssue({ code: "custom", message: `feature ${f.id} 的 repo「${f.repo}」不在 repos 里` });
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

// ---------- agent 请求 ----------

export interface IngestContext {
  handbook: HandbookSlices;
  wikiRoot: string;
  /** repo 名 → 绝对路径 */
  repoRoots: Record<string, string>;
  today: string;
  timeoutMs: number;
  /** 本批全部 feature id，供 related 参考 */
  batchIds: string[];
}

export interface AgentRequest {
  id: string;
  cwd: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
  /** 相对 cwd 的允许写路径（glob），供越界检查 */
  allowedWrites: string[];
}

/**
 * 工具黑名单。注意不能放 Edit：Spike W1（2026-09-07）实测 `Edit(路径)` 规则同时管 Write，
 * 禁 Edit 会把 Write 一起禁掉；而 `Write(路径)` 不是被识别的规则语法。
 */
const DISALLOWED = ["Bash", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Agent"];

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

export function extractRequest(f: SeedFeature, seeds: Seeds, ctx: IngestContext): AgentRequest {
  const repo = seeds.repos[f.repo];
  if (!repo) throw new Error(`repo ${f.repo} 未定义`);
  const repoRoot = ctx.repoRoots[f.repo];
  if (!repoRoot) throw new Error(`repo ${f.repo} 没有本地路径`);
  const draft = `_drafts/${f.id}.md`;
  const raw = `raw/${f.id}.md`;
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.extract.trim()}`),
    "--add-dir",
    repoRoot,
    "--allowedTools",
    "Read",
    "Grep",
    "Glob",
    `Edit(${draft})`,
    `Edit(${raw})`,
    "--disallowedTools",
    ...DISALLOWED,
  ];
  const stdin = [
    `任务：为 feature「${f.title}」写一页 wiki 草稿。`,
    "",
    `- id: ${f.id}`,
    `- type: ${f.type}`,
    `- chapters: ${JSON.stringify(f.chapters)}`,
    `- updated: "${ctx.today}"`,
    `- 来源仓库：${f.repo}@${repo.commit}，本地只读路径 ${repoRoot}`,
    `- sources 写法：${f.repo}@${repo.commit}:<相对路径>#L起-L止`,
    `- 入口文件：${f.entry.join("、")}`,
    `- 要回答的问题：${f.ask}`,
    `- 本批其它 feature id（related 可引用）：${ctx.batchIds.filter((x) => x !== f.id).join(", ") || "无"}`,
    "",
    `只允许写这两个文件（相对当前目录）：${draft}、${raw}。写完回复 DONE ${f.id} sources=<数量>。`,
  ].join("\n");
  return { id: f.id, cwd: ctx.wikiRoot, args, stdin, timeoutMs: ctx.timeoutMs, allowedWrites: [draft, raw] };
}

export function integrateRequest(draftIds: string[], ctx: IngestContext): AgentRequest {
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.integrate.trim()}`),
    "--allowedTools",
    "Read",
    "Grep",
    "Glob",
    "Edit(concepts/**)",
    "Edit(_drafts/_integration.json)",
    "--disallowedTools",
    ...DISALLOWED,
  ];
  const stdin = [
    `任务：整合 ${draftIds.length} 份草稿进 concepts/。今天是 ${ctx.today}。`,
    "",
    "草稿文件：",
    ...draftIds.map((id) => `- _drafts/${id}.md`),
    "",
    "按「整合」规则处理，写 _drafts/_integration.json，回复 DONE integrate promoted=<n> merged=<n> rejected=<n>。",
  ].join("\n");
  return {
    id: "_integrate",
    cwd: ctx.wikiRoot,
    args,
    stdin,
    timeoutMs: ctx.timeoutMs,
    allowedWrites: ["concepts/**", "_drafts/_integration.json"],
  };
}

// ---------- stream-json ----------

export type AgentEvent =
  | { kind: "tool"; name: string; target?: string }
  | { kind: "result"; isError: boolean; sessionId?: string; costUsd?: number };

export interface AgentResult {
  id: string;
  ok: boolean;
  exitCode: number | null;
  sessionId?: string;
  costUsd?: number;
  reason?: string;
  stderrTail: string;
}
export type RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) => Promise<AgentResult>;

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

// ---------- 并发池 ----------

export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
}

// ---------- 扇出提取 ----------

export interface FailureRecord {
  at: string;
  reason: string;
  sessionId?: string;
  stderrTail?: string;
}
export type Failures = Record<string, FailureRecord>;

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
): Promise<{ succeeded: string[]; failures: Failures; costUsd: number }> {
  const before = snapshotDir(ctx.wikiRoot);
  const allowedAll = new Set<string>([FAILURES_FILE]);
  const requests = features.map((f) => extractRequest(f, seeds, ctx));
  for (const r of requests) for (const w of r.allowedWrites) allowedAll.add(w);

  const failures: Failures = readFailures(ctx.wikiRoot);
  const succeeded: string[] = [];
  let costUsd = 0;
  const results = await runPool(requests, deps.concurrency, async (req) => {
    deps.log(`▶ ${req.id}`);
    const r = await deps.runAgent(req, (e) => {
      if (e.kind === "tool") deps.log(`  ${req.id}: ${e.name} ${e.target ?? ""}`);
    });
    costUsd += r.costUsd ?? 0;
    deps.log(`${r.ok ? "✓" : "✗"} ${req.id}${r.reason ? ` (${r.reason})` : ""}`);
    return r;
  });

  const stray = strayPaths(diffSnapshot(before, snapshotDir(ctx.wikiRoot)), allowedAll);
  for (const p of stray) rmSync(join(ctx.wikiRoot, p), { force: true });

  for (const r of results) {
    const draftPath = join(ctx.wikiRoot, `_drafts/${r.id}.md`);
    let reason = r.ok ? undefined : (r.reason ?? `exit ${r.exitCode}`);
    if (!reason && stray.length) reason = `本批出现越界写入，已删除：${stray.join(", ")}`;
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
  return { succeeded, failures, costUsd };
}

// ---------- 整合决策 ----------

export const integrationSchema = z.object({
  promoted: z.array(z.string()),
  merged: z.array(z.object({ from: z.string(), into: z.string() })),
  rejected: z.array(z.object({ id: z.string(), reason: z.string() })),
  contradictions: z.array(z.object({ a: z.string(), b: z.string(), note: z.string() })).default([]),
});
export type Integration = z.infer<typeof integrationSchema>;

function titleOf(wikiRoot: string, rel: string): string {
  const p = join(wikiRoot, rel);
  if (!existsSync(p)) return rel;
  const m = /^title:\s*(.+)$/m.exec(readFileSync(p, "utf8"));
  return m?.[1]?.trim() ?? rel;
}

export function applyIntegration(
  wikiRoot: string,
  d: Integration,
  today: string,
): { problems: string[]; logLines: string[] } {
  const problems: string[] = [];
  const logLines: string[] = [];
  for (const id of d.promoted) {
    if (!existsSync(join(wikiRoot, `concepts/${id}.md`))) {
      problems.push(`promoted ${id} 但 concepts/${id}.md 不存在，草稿保留`);
      continue;
    }
    rmSync(join(wikiRoot, `_drafts/${id}.md`), { force: true });
    logLines.push(
      `## [${today}] ingest | ${titleOf(wikiRoot, `concepts/${id}.md`)}\n晋升 concepts/${id}.md\n`,
    );
  }
  for (const m of d.merged) {
    rmSync(join(wikiRoot, `_drafts/${m.from}.md`), { force: true });
    logLines.push(
      `## [${today}] ingest | ${titleOf(wikiRoot, `concepts/${m.into}.md`)}\nmerged ${m.from} → ${m.into}\n`,
    );
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
