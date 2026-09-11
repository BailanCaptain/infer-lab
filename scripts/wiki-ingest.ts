/**
 * pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed]
 *                  [--concurrency 3] [--timeout-min 20] [--phase extract|integrate|all] [--dry-run]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBuild } from "./wiki/build";
import { formatDryRun, runClaude } from "./wiki/claude-cli";
import { worktreeDir } from "./wiki/clone";
import { keepUsed, parseDocVars } from "./wiki/docvars";
import { loadHandbook } from "./wiki/handbook";
import {
  applyIntegration,
  DEFAULT_REF,
  extractRequest,
  type IngestContext,
  integrateRequest,
  integrationSchema,
  localDate,
  parseSeeds,
  readFailures,
  runExtractPhase,
  selectRelevantPages,
  worktreeKey,
} from "./wiki/ingest";
import { factsTable, runLint, splitProblems } from "./wiki/lint";
import { loadPages, parsePage } from "./wiki/pages";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const flag = (name: string) => process.argv.includes(name);

const root = process.cwd();
const wikiRoot = join(root, "wiki");
const seedsPath = arg("--seeds");
if (!seedsPath) {
  console.error(
    "用法：pnpm wiki:ingest --seeds wiki/seeds/<name>.yaml [--only a,b] [--skip-existing] [--retry-failed] [--dry-run]",
  );
  process.exit(2);
}
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));
const phase = arg("--phase", "all") as "extract" | "integrate" | "all";
const dryRun = flag("--dry-run");
const today = localDate();

// 一个 ref 一份工作树，键与 extractRequest 里的 worktreeKey 对齐
const repoRoots: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  for (const ref of Object.keys(r.refs)) {
    const abs = resolve(root, worktreeDir(r, ref));
    if (!dryRun && !existsSync(abs)) {
      console.error(`x 仓库 ${name} 的 ref ${ref} 不在 ${abs}，先跑 pnpm wiki:clone --seeds ${seedsPath}`);
      process.exit(2);
    }
    repoRoots[worktreeKey(name, ref)] = abs;
  }
}
for (const d of ["_drafts", "raw", "concepts", "sources"]) mkdirSync(join(wikiRoot, d), { recursive: true });

let features = seeds.features;
const only = arg("--only");
if (only) features = features.filter((f) => only.split(",").includes(f.id));
if (flag("--retry-failed")) {
  const failed = Object.keys(readFailures(wikiRoot));
  features = features.filter((f) => failed.includes(f.id));
}
if (flag("--skip-existing")) {
  features = features.filter(
    (f) =>
      !existsSync(join(wikiRoot, `_drafts/${f.id}.md`)) && !existsSync(join(wikiRoot, `concepts/${f.id}.md`)),
  );
}
features = [...features].sort((a, b) => a.priority - b.priority);

// Task 28：文档变量表在本地解，不让 agent 上网（它的黑名单里有 WebFetch）。
// 两个版本的构建系统不同：main 是 MkDocs、v0.23.0 还是 Sphinx，两处都认。
const readIf = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);
const docVars: Record<string, Record<string, string>> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  for (const ref of Object.keys(r.refs)) {
    const abs = resolve(root, worktreeDir(r, ref));
    const all = parseDocVars({
      mkdocsYml: readIf(join(abs, "mkdocs.yml")),
      confPy: readIf(join(abs, "docs/source/conf.py")),
    });
    // 只留文档正文里真正用到的——extra: 块里还有 generator 这类非变量配置
    const docTexts = listDocFiles(join(abs, "docs")).map((f) => readFileSync(f, "utf8"));
    const vars = keepUsed(all, docTexts);
    if (Object.keys(vars).length > 0) docVars[worktreeKey(name, ref)] = vars;
  }
}
// Task 27：llms.txt 是上游给 LLM 的官方文档索引，当地图注入
const mainRepo = Object.entries(seeds.repos)[0];
const llmsTxt = mainRepo
  ? readIf(resolve(root, worktreeDir(mainRepo[1], DEFAULT_REF), "docs/source/llms.txt"))
  : undefined;

const ctx: IngestContext = {
  handbook: loadHandbook(wikiRoot),
  wikiRoot,
  repoRoots,
  ...(Object.keys(docVars).length > 0 ? { docVars } : {}),
  ...(llmsTxt ? { llmsTxt } : {}),
  today,
  timeoutMs: Number(arg("--timeout-min", "20")) * 60_000,
  batchIds: features.map((f) => f.id),
};

async function main() {
  if (phase !== "integrate") {
    if (dryRun) {
      for (const f of features) console.log(formatDryRun(extractRequest(f, seeds, ctx)));
    } else {
      console.log(`提取 ${features.length} 个 feature：${features.map((f) => f.id).join(", ")}`);
      const r = await runExtractPhase(features, seeds, ctx, {
        runAgent: runClaude,
        concurrency: Number(arg("--concurrency", "3")),
        log: (s) => console.log(s),
      });
      console.log(
        `提取完成：成功 ${r.succeeded.length}，失败 ${Object.keys(r.failures).length}（见 wiki/_drafts/_failures.json），花费 $${r.costUsd.toFixed(2)}`,
      );
    }
  }
  if (phase !== "extract") {
    const draftIds = readdirSync(join(wikiRoot, "_drafts"))
      .filter((n) => n.endsWith(".md"))
      .map((n) => n.slice(0, -3));
    if (!draftIds.length) {
      console.log("没有草稿可整合");
      return;
    }
    // Task 26：程序按 related 与章节交集挑相关页，不再让 agent 扫全库（风险 R2）
    const toRef = (pg: { fm: { id: string; chapters: string[]; related: string[] } }) => ({
      id: pg.fm.id,
      chapters: pg.fm.chapters,
      related: pg.fm.related,
    });
    const MARK_RE = /\[[SCDAIM!]\d*\](?![\w-])/g;
    const draftRefs = draftIds.map((id) => {
      const file = join(wikiRoot, "_drafts", `${id}.md`);
      const text = readFileSync(file, "utf8");
      const parsed = parsePage(`_drafts/${id}.md`, text);
      const marks = (text.match(MARK_RE) ?? []).length;
      const facts = factsTable(parsed.page?.body ?? text)?.rows ?? 0;
      return parsed.page
        ? { ...toRef(parsed.page), marks, facts }
        : { id, chapters: [], related: [], marks, facts };
    });
    const existingRefs = loadPages(wikiRoot).pages.map(toRef);
    const req = integrateRequest(draftRefs, existingRefs, ctx);
    console.log(
      `  相关现有页 ${selectRelevantPages(draftRefs, existingRefs).length} / ${existingRefs.length}`,
    );
    if (dryRun) {
      console.log(formatDryRun(req));
      return;
    }
    console.log(`整合 ${draftIds.length} 份草稿`);
    const r = await runClaude(req, (e) => {
      if (e.kind === "tool") console.log(`  integrate: ${e.name} ${e.target ?? ""}`);
    });
    if (!r.ok) {
      console.error(`x 整合失败：${r.reason}\n${r.stderrTail}`);
      process.exit(1);
    }
    const decisionPath = join(wikiRoot, "_drafts/_integration.json");
    if (!existsSync(decisionPath)) {
      console.error("x 整合 agent 没有写 _drafts/_integration.json");
      process.exit(1);
    }
    const decision = integrationSchema.parse(JSON.parse(readFileSync(decisionPath, "utf8")));
    const applied = applyIntegration(wikiRoot, decision, today);
    for (const p of applied.problems) console.error(`x ${p}`);
    console.log(
      `整合完成：晋升 ${decision.promoted.length}，合并 ${decision.merged.length}，拒收 ${decision.rejected.length}，矛盾 ${decision.contradictions.length}，花费 $${(r.costUsd ?? 0).toFixed(2)}`,
    );
    const b = runBuild(root);
    console.log(`wiki:build ${b.pageCount} 页`);
    // 与 pnpm wiki:lint 同一套警告豁免——否则一条 mark-flood 会让整条流水线在
    // 11 页都已正确落盘之后报失败（2026-09-12 实际发生过）
    const { errors, warnings } = splitProblems(runLint(root, { terms: false }));
    for (const p of warnings) console.warn(`! ${p.file} [${p.rule}] ${p.message}`);
    for (const p of errors) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
    if (errors.length) process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** 递归列出 docs 下的 md 文件，用于统计哪些文档变量真的被用到 */
function listDocFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listDocFiles(full));
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}
