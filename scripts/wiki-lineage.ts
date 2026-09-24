/**
 * pnpm wiki:lineage <标识符> [--refs a,b,c] [--paths vllm_ascend/] [--seeds ...]
 *
 * 算出一个参数 / 类 / 函数在各分支上的存亡，以及引入与移除的 PR、影响面。
 * 输出直接就是参数页「版本谱系」一节的 markdown。
 *
 * 这一节由脚本算而不是 agent 写：agent 会编 PR 号，而这些事实 git 里全有。
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { worktreeDir } from "./wiki/clone";
import { parseSeeds } from "./wiki/ingest";
import { gitLineage, lineageRefs, renderVerifiedLineage } from "./wiki/lineage-git";
import { localFile } from "./wiki/review-files";
import { atomicText } from "./wiki/workflow";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const term = process.argv[2];
if (!term || term.startsWith("--")) {
  console.error("用法：pnpm wiki:lineage <标识符> [--refs a,b,c] [--paths vllm_ascend/]");
  process.exit(2);
}

const root = process.cwd();
const seeds = parseSeeds(readFileSync(arg("--seeds", "wiki/seeds/vllm-ascend.yaml") as string, "utf8"));
const repoName = Object.keys(seeds.repos)[0] as string;
const repo = seeds.repos[repoName];
if (!repo) throw new Error("seeds 里没有 repo");
const dir = resolve(root, worktreeDir(repo, Object.keys(repo.refs)[0] as string));

/** 默认展示发布分支 + main（lineageRefs 是唯一定义，夜间参数刷新用同一个）；事件由提交与父提交的实际存在性计算。 */
const refs = (arg("--refs")?.split(",") ?? lineageRefs(dir, ["main"], ["main"])).map((r) => r.trim());
const paths = (arg("--paths", "vllm_ascend/") as string).split(",");
const lineage = gitLineage(dir, term, refs, paths);
const path = localFile(root, arg("--out") ?? `wiki/lineage/${term}.json`);
mkdirSync(dirname(path), { recursive: true });
atomicText(path, JSON.stringify(lineage, null, 2));
console.log(
  process.argv.includes("--json") ? JSON.stringify(lineage, null, 2) : renderVerifiedLineage(lineage),
);
