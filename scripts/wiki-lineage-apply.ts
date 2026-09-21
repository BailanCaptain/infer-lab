/**
 * pnpm wiki:lineage:apply [--dir params] [--drafts] [--seeds ...]
 *
 * 把每个参数页的 `## 版本谱系` 一节换成 `wiki:lineage` 从 git 算出来的结果。
 *
 * 这一节不让 agent 写：它会编 PR 号，而「哪些版本有、哪个 PR 引入、哪个 PR 移除、
 * 影响面多大」这些事实 git 里全都有，算得准，而且上游一更新重算即可。
 * 页面里原有的这一节（不管是 agent 写的还是上一次生成的）整节替换。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { LINEAGE_SECTION, lineageTerm, replaceSection } from "./wiki/lineage";
import { publishLineage } from "./wiki/lineage-publish";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const root = process.cwd();
const dir = arg("--dir", process.argv.includes("--drafts") ? "_drafts" : "params") as string;
if (!["params", "_drafts"].includes(dir)) throw new Error("谱系刷新目录限 params / _drafts");
const pagesDir = join(root, "wiki", dir);
if (!existsSync(pagesDir)) {
  console.error(`x 目录不存在：wiki/${dir}`);
  process.exit(2);
}

const seedsArg = arg("--seeds", "wiki/seeds/params-removed.yaml") as string;

/** 页面 title 就是参数名（参数页的约定），拿它去算谱系 */
function titleOf(text: string): string | undefined {
  return matter(text).data.title;
}

const updates: { path: string; before: string; after: string }[] = [];
for (const name of readdirSync(pagesDir).filter((n) => n.endsWith(".md"))) {
  const file = join(pagesDir, name);
  const text = readFileSync(file, "utf8");
  // 只处理参数页；概念页没有这一节也不该有
  if (!/^type:\s*param\s*$/m.test(text.split("---")[1] ?? "")) continue;
  const term = lineageTerm(titleOf(text) ?? "");
  if (!term) {
    console.warn(`! 跳过 wiki/${dir}/${name}：标题里找不到参数名，版本谱系没有重算`);
    continue;
  }

  const md = execFileSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("./wiki-lineage.ts", import.meta.url)),
      term,
      "--seeds",
      seedsArg,
    ],
    { encoding: "utf8", cwd: root, maxBuffer: 32 << 20 },
  ).trim();

  const after = replaceSection(text, LINEAGE_SECTION, md);
  if (text !== after) updates.push({ path: `wiki/${dir}/${name}`, before: text, after });
}
const done = await publishLineage(root, updates);
for (const update of updates) console.log(`ok ${update.path}`);
console.log(done ? `\n${done} 个参数页的版本谱系已重算。` : "没有找到参数页（type: param）。");
