/**
 * pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed]
 *                  [--concurrency 3] [--timeout-min 20] [--phase extract|integrate|all] [--dry-run]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { positiveInteger } from "./wiki/batch";
import { formatDryRun } from "./wiki/claude-cli";
import { worktreeDir } from "./wiki/clone";
import { keepUsed, parseDocVars } from "./wiki/docvars";
import { gitText } from "./wiki/git";
import { loadHandbook } from "./wiki/handbook";
import {
  DEFAULT_REF,
  extractRequest,
  type IngestContext,
  integrateRequest,
  localDate,
  parseSeeds,
  readFailures,
  selectIngestFeatures,
  selectIntegrationDrafts,
  selectRelevantPages,
  worktreeKey,
} from "./wiki/ingest";
import { validateIntegration } from "./wiki/integration-check";
import { runStagedIntegration } from "./wiki/integration-run";
import { factsTable } from "./wiki/lint";
import { loadPages, parsePage } from "./wiki/pages";
import { runPersistentExtract, syncFailureProjection } from "./wiki/persistent-extract";
import { selectedAgent } from "./wiki/selected-agent";
import { configuredWorkflowPolicy, isProduction } from "./wiki/sync-config";
import { WorkflowStore } from "./wiki/workflow";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const flag = (name: string) => process.argv.includes(name);

if (flag("--params") || flag("--pr")) {
  try {
    if (flag("--params") && flag("--pr")) throw new Error("--params 与 --pr 不能同时使用");
    if (flag("--params")) await (await import("./wiki-params-ingest")).paramIngestCli(process.argv.slice(2));
    else await (await import("./wiki-pr-ingest")).prIngestCli(process.argv.slice(2));
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}

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
const phase = arg("--phase", "extract") as "extract" | "integrate" | "all";
const dryRun = flag("--dry-run");
const today = localDate();
const concurrency = positiveInteger(Number(arg("--concurrency", "3")), "concurrency");
const timeoutMs = positiveInteger(Number(arg("--timeout-min", "20")) * 60_000, "timeoutMs");
if (!["extract", "integrate", "all"].includes(phase)) throw new Error(`非法 phase：${phase}`);
if (phase === "integrate" && !arg("--only")) throw new Error("独立整合必须用 --only 显式选择草稿");
const store = new WorkflowStore(root);
if (
  !dryRun &&
  !isProduction(root) &&
  phase !== "integrate" &&
  seeds.features.length &&
  ["--max-attempts", "--job-budget-usd", "--attempt-budget-usd"].some((name) => !arg(name))
) {
  throw new Error(
    "提取需显式配置 --job-budget-usd（每任务累计）、--attempt-budget-usd（单次额度）、--max-attempts（总次数）；重试不清零",
  );
}
const policy =
  !dryRun && phase !== "integrate" && seeds.features.length
    ? configuredWorkflowPolicy(root, {
        maxAttempts: Number(arg("--max-attempts")),
        maxCostUsd: Number(arg("--job-budget-usd")),
        reserveUsd: Number(arg("--attempt-budget-usd")),
      })
    : undefined;

// 一个 ref 一份工作树，键与 extractRequest 里的 worktreeKey 对齐
const repoRoots: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  for (const ref of Object.keys(r.refs)) {
    const abs = resolve(root, worktreeDir(r, ref));
    if (!dryRun && !existsSync(abs)) {
      console.error(`x 仓库 ${name} 的 ref ${ref} 不在 ${abs}，先跑 pnpm wiki:clone --seeds ${seedsPath}`);
      process.exit(2);
    }
    if (!dryRun) {
      const actual = gitText(abs, ["rev-parse", "HEAD"]).trim();
      const expected = gitText(abs, ["rev-parse", "--verify", `${r.refs[ref]}^{commit}`]).trim();
      if (actual !== expected)
        throw new Error(`${name}@${ref} HEAD ${actual} 不等于钉住的 ${expected}，请先运行 wiki:clone`);
      if (gitText(abs, ["status", "--porcelain", "--untracked-files=all"]).trim()) {
        throw new Error(`${name}@${ref} 有未提交修改，不能当作钉住版本提取：${abs}`);
      }
    }
    repoRoots[worktreeKey(name, ref)] = abs;
  }
}
if (!dryRun)
  for (const d of ["_drafts", "raw", "concepts", "sources"])
    mkdirSync(join(wikiRoot, d), { recursive: true });
if (!dryRun) {
  await store.recover();
  await syncFailureProjection(store);
}

const only = arg("--only");
const features = selectIngestFeatures(seeds.features, wikiRoot, {
  only: only?.split(","),
  skipExisting: flag("--skip-existing"),
  retryFailed: flag("--retry-failed"),
}).sort((a, b) => a.priority - b.priority);

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
  timeoutMs,
  batchIds: features.map((f) => f.id),
};

async function main() {
  let succeeded: string[] | undefined;
  let extractionFailed = false;
  if (phase !== "integrate") {
    if (dryRun) {
      for (const f of features) console.log(formatDryRun(extractRequest(f, seeds, ctx)));
    } else {
      console.log(`提取 ${features.length} 个 feature：${features.map((f) => f.id).join(", ")}`);
      if (!features.length) {
        console.log("没有需要提取的任务");
        return;
      }
      if (!policy) throw new Error("提取需显式配置 --job-budget-usd、--attempt-budget-usd、--max-attempts");
      const r = await runPersistentExtract(features, seeds, ctx, {
        store,
        policy,
        retry: flag("--retry-failed"),
        runAgent: selectedAgent(process.cwd(), "seed-extract"),
        concurrency,
        log: (s) => console.log(s),
      });
      succeeded = r.succeeded;
      extractionFailed = r.failed.length > 0;
      console.log(
        `提取完成：成功 ${r.succeeded.length}，失败 ${Object.keys(r.failures).length}（见 wiki/_drafts/_failures.json），已报告费用 $${r.costUsd.toFixed(2)}，费用待核对 ${r.unknownCostIds.length} 项${r.unknownCostIds.length ? `（${r.unknownCostIds.join(", ")}）` : ""}`,
      );
    }
  }
  if (phase !== "extract") {
    if (dryRun && phase === "all") {
      console.log("整合计划：仅接收本次提取成功的草稿；dry-run 不读取旧草稿冒充本次结果。");
      return;
    }
    const available = readdirSync(join(wikiRoot, "_drafts"))
      .filter((n) => n.endsWith(".md"))
      .map((n) => n.slice(0, -3));
    const draftIds = selectIntegrationDrafts({
      available,
      failures: readFailures(wikiRoot),
      succeeded,
      only: only?.split(","),
    });
    if (!draftIds.length) {
      console.log("没有草稿可整合");
      if (extractionFailed) process.exitCode = 1;
      return;
    }
    // Task 26：程序按 related 与章节交集挑相关页，不再让 agent 扫全库（风险 R2）
    const toRef = (pg: import("./wiki/pages").WikiPage) => ({
      id: pg.fm.id,
      file: pg.file,
      chapters: pg.fm.chapters,
      relations: pg.fm.relations,
      related: pg.fm.related,
      aliases: pg.fm.aliases,
    });
    const MARK_RE = /\[[SCDAIM!]\d*\](?![\w-])/g;
    const draftRefs = draftIds.map((id) => {
      const file = join(wikiRoot, "_drafts", `${id}.md`);
      const text = readFileSync(file, "utf8");
      const parsed = parsePage(`_drafts/${id}.md`, text);
      const marks = (text.match(MARK_RE) ?? []).length;
      const facts = factsTable(parsed.page?.body ?? text)?.rows ?? 0;
      if (!parsed.page || parsed.problems.length)
        throw new Error(`草稿 ${id} 不合法：${JSON.stringify(parsed.problems)}`);
      return { ...toRef(parsed.page), marks, facts };
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
    const validationRepos = Object.fromEntries(
      Object.entries(seeds.repos).map(([name, repo]) => [name, resolve(root, repo.path)]),
    );
    const r = await runStagedIntegration(root, req, draftIds, today, {
      runAgent: selectedAgent(process.cwd(), "integrate"),
      onEvent: (e) => {
        if (e.kind === "tool") console.log(`  integrate: ${e.name} ${e.target ?? ""}`);
      },
      repoRoots: validationRepos,
      validate: (stageRoot) => validateIntegration(stageRoot, validationRepos),
    });
    const { decision } = r;
    console.log(
      `待审提案：晋升 ${decision.promoted.length}，合并 ${decision.merged.length}，拒收 ${decision.rejected.length}，矛盾 ${decision.contradictions.length}，花费 $${(r.costUsd ?? 0).toFixed(2)}`,
    );
    console.log(
      `wiki:build ${r.pageCount} 页（隔离校验通过，尚未发布）；revision ${r.reviewId}\n查看 pnpm wiki:review show ${r.reviewId}；批准 pnpm wiki:review approve ${r.reviewId}`,
    );
  }
  if (extractionFailed) process.exitCode = 1;
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
