/**
 * pnpm wiki:lineage <标识符> [--refs a,b,c] [--paths vllm_ascend/] [--seeds ...] [--page ...]
 *
 * 带 --page 时恢复固定定义，类字段按精确身份检查各版本是否定义。
 * 不带页面时保留文本检索模式；文本出现及提交标题不能证明参数引入或运行时支持。
 * 输出直接就是参数页「版本谱系」一节的 markdown。
 *
 * 字段模式不推测精确引入/移除事件；参数页发布入口使用固定定义。
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { worktreeDir } from "./wiki/clone";
import { parseSeeds } from "./wiki/ingest";
import { gitLineage, lineageRefs, renderVerifiedLineage } from "./wiki/lineage-git";
import { parameterDefinition } from "./wiki/params/provenance";
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

const pagePath = arg("--page");
// 发布页面默认跟随教学钉点；不带页面的历史查询仍可查看浮动分支。
const fixedRefs = pagePath && !arg("--refs") ? Object.entries(repo.refs) : undefined;
const refs = (
  arg("--refs")?.split(",") ??
  fixedRefs?.map(([, commit]) => commit) ??
  lineageRefs(dir, ["main"], ["main"])
).map((r) => r.trim());
const definition = pagePath
  ? parameterDefinition(dir, readFileSync(resolve(root, pagePath), "utf8"))
  : undefined;
if (pagePath && (!definition || definition.name !== term))
  throw new Error("页面没有匹配的固定参数定义，未重算谱系");
const paths = definition?.class ? [definition.file] : (arg("--paths", "vllm_ascend/") as string).split(",");
const lineage = gitLineage(dir, term, refs, paths, definition?.class || undefined);
if (fixedRefs) {
  lineage.presence.forEach((presence, i) => {
    presence.ref = fixedRefs[i]![0];
  });
}
const path = localFile(root, arg("--out") ?? `wiki/lineage/${term}.json`);
mkdirSync(dirname(path), { recursive: true });
atomicText(path, JSON.stringify(lineage, null, 2));
console.log(
  process.argv.includes("--json") ? JSON.stringify(lineage, null, 2) : renderVerifiedLineage(lineage),
);
