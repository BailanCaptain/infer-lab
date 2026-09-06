/**
 * pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed]
 *                  [--concurrency 3] [--timeout-min 20] [--phase extract|integrate|all] [--dry-run]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBuild } from "./wiki/build";
import { formatDryRun, runClaude } from "./wiki/claude-cli";
import { loadHandbook } from "./wiki/handbook";
import {
  applyIntegration,
  extractRequest,
  type IngestContext,
  integrateRequest,
  integrationSchema,
  parseSeeds,
  readFailures,
  runExtractPhase,
} from "./wiki/ingest";
import { runLint } from "./wiki/lint";

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
const today = new Date().toISOString().slice(0, 10);

const repoRoots: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  const abs = resolve(root, r.path);
  if (!dryRun && !existsSync(abs)) {
    console.error(`x 仓库 ${name} 不在 ${abs}，先跑 pnpm wiki:clone --seeds ${seedsPath}`);
    process.exit(2);
  }
  repoRoots[name] = abs;
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

const ctx: IngestContext = {
  handbook: loadHandbook(wikiRoot),
  wikiRoot,
  repoRoots,
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
    const req = integrateRequest(draftIds, ctx);
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
    const problems = runLint(root, { terms: false });
    for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
    if (problems.length) process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
