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
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { replaceSection } from "./wiki/lineage";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const root = process.cwd();
const dir = arg("--dir", process.argv.includes("--drafts") ? "_drafts" : "params") as string;
const pagesDir = join(root, "wiki", dir);
if (!existsSync(pagesDir)) {
  console.error(`x 目录不存在：wiki/${dir}`);
  process.exit(2);
}

const seedsArg = arg("--seeds", "wiki/seeds/params-removed.yaml") as string;
const SECTION = "## 版本谱系";

/** 页面 title 就是参数名（参数页的约定），拿它去算谱系 */
function titleOf(text: string): string | undefined {
  return /^title:\s*(.+)$/m.exec(text.split("---")[1] ?? "")?.[1]?.trim();
}

let done = 0;
for (const name of readdirSync(pagesDir).filter((n) => n.endsWith(".md"))) {
  const file = join(pagesDir, name);
  const text = readFileSync(file, "utf8");
  const term = titleOf(text);
  if (!term) continue;
  // 只处理参数页；概念页没有这一节也不该有
  if (!/^type:\s*param\s*$/m.test(text.split("---")[1] ?? "")) continue;

  const md = execFileSync(
    "node",
    [
      resolve(root, "node_modules/tsx/dist/cli.mjs"),
      resolve(root, "scripts/wiki-lineage.ts"),
      term,
      "--seeds",
      seedsArg,
    ],
    { encoding: "utf8", cwd: root, maxBuffer: 32 << 20 },
  ).trim();

  writeFileSync(file, replaceSection(text, SECTION, md));
  console.log(`ok ${dir}/${name} ← ${term}`);
  done++;
}
console.log(done ? `\n${done} 个参数页的版本谱系已重算。` : "没有找到参数页（type: param）。");
