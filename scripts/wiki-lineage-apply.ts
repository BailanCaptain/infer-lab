/**
 * pnpm wiki:lineage:apply [--dir params] [--drafts] [--seeds ...]
 *
 * 把每个参数页的 `## 版本谱系` 一节换成 `wiki:lineage` 从 git 算出来的结果。
 *
 * 参数页须有可恢复身份的固定定义；字段按文件、类与字段名检查存在性。
 * 缺少自动定义的人工页保留原文并报告跳过；损坏的固定定义仍阻止发布。
 * 页面里原有的这一节（不管是 agent 写的还是上一次生成的）整节替换。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { LINEAGE_SECTION, lineageTerm, replaceSection } from "./wiki/lineage";
import { publishLineage } from "./wiki/lineage-publish";
import { parsePinnedParamIdentity, protectedParamSection } from "./wiki/params/pages";

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
  if (!protectedParamSection(text)) {
    console.warn(`! 跳过 wiki/${dir}/${name}：没有固定自动定义，保留人工版本说明`);
    continue;
  }
  const term = parsePinnedParamIdentity(text)?.name ?? lineageTerm(titleOf(text) ?? "");
  if (!term) throw new Error(`参数页固定定义缺少可识别的参数身份：wiki/${dir}/${name}`);

  const md = execFileSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("./wiki-lineage.ts", import.meta.url)),
      term,
      "--seeds",
      seedsArg,
      "--page",
      file,
    ],
    { encoding: "utf8", cwd: root, maxBuffer: 32 << 20 },
  ).trim();

  const after = replaceSection(text, LINEAGE_SECTION, md);
  if (text !== after) updates.push({ path: `wiki/${dir}/${name}`, before: text, after });
}
const done = await publishLineage(root, updates);
for (const update of updates) console.log(`ok ${update.path}`);
console.log(done ? `\n${done} 个参数页的版本谱系已重算。` : "没有需要写入的谱系变更。");
