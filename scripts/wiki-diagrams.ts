import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDiagrams, renderDiagram } from "./wiki/diagrams";
import { figureAdvisories, figureProblems, sketchUsage } from "./wiki/figure";
import { sceneCollisions, sceneOverflows } from "./wiki/scene";

/**
 * spec → SVG。`--check` 只比对不写盘，给 CI 和 pnpm check 用。
 * 跑两次 git diff 必须为空，和 wiki:build 同一套派生纪律。
 */
const root = process.cwd();
const wiki = join(root, "wiki");
const check = process.argv.includes("--check");
const { diagrams, problems } = loadDiagrams(wiki);

for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
if (problems.length) {
  console.error(`\nwiki:diagrams 失败：${problems.length} 个 spec 不合法`);
  process.exit(1);
}

// 两种画错都不会让渲染报错，所以各查一遍：
//   一、字跑出框（第一版「图难看」有一半是这种看不见的溢出）；
//   二、两块东西压在一起（engine-core-loop 的站点标题正好撞进地盘胶囊，全绿却糊成一团）。
const bad = [...diagrams.values()].flatMap((d) =>
  d.spec.layout === "figure"
    ? figureProblems(d.spec).map((m) => `${d.specFile} ${m}`)
    : [
        ...sceneOverflows(d.spec).map((m) => `${d.specFile} ${m}`),
        ...sceneCollisions(d.spec).map((m) => `${d.specFile} ${m}`),
      ],
);
for (const m of bad) console.error(`x ${m}`);
if (bad.length) {
  console.error(`
wiki:diagrams 失败：${bad.length} 处画到了框外或压在一起`);
  process.exit(1);
}

const figures = [...diagrams.values()].flatMap((d) => (d.spec.layout === "figure" ? [d.spec] : []));
const sketches = sketchUsage(figures);
const advisories = [
  ...[...diagrams.values()].flatMap((d) =>
    d.spec.layout === "figure" ? figureAdvisories(d.spec).map((m) => `${d.specFile} ${m}`) : [],
  ),
  ...sketches.promote,
];
if (sketches.total) console.log(`  自由画板 ${sketches.total} 处，分布在 ${sketches.figures} 张图`);
if (advisories.length) {
  console.error(`! 待留意 ${advisories.length} 处（不阻塞）：`);
  for (const m of advisories) console.error(`  ${m}`);
}

const stale: string[] = [];
let written = 0;
for (const diagram of [...diagrams.values()]) {
  const path = join(wiki, diagram.svgFile);
  const next = renderDiagram(diagram.spec);
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === next) continue;
  if (check) {
    stale.push(diagram.svgFile);
    continue;
  }
  writeFileSync(path, next);
  written++;
  console.log(`  写入 ${diagram.svgFile}`);
}

if (stale.length) {
  console.error(`x 以下 SVG 与 spec 不一致，请跑 pnpm wiki:diagrams：\n  ${stale.join("\n  ")}`);
  process.exit(1);
}
console.log(`ok wiki:diagrams ${diagrams.size} 张图${check ? "与 spec 一致" : `，更新 ${written} 张`}`);
