/**
 * pnpm wiki:gaps [--min-hits 8] [--min-pages 3] [--json]
 *
 * 报出「正文反复引用、但知识库里没有页」的概念，以及指向不存在页的 relations。
 * 不阻塞任何流程——它产出的是下一批灌种的待补清单。
 */
import { join } from "node:path";
import { danglingRelations, findGaps } from "./wiki/gaps";
import { loadPages } from "./wiki/pages";

const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(name);
  const v = i >= 0 ? Number(process.argv[i + 1]) : Number.NaN;
  return Number.isFinite(v) ? v : def;
};

const { pages } = loadPages(join(process.cwd(), "wiki"));
const gaps = findGaps(pages, { minHits: arg("--min-hits", 8), minPages: arg("--min-pages", 3) });
const dangling = danglingRelations(pages);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ gaps, dangling }, null, 2));
} else {
  console.log(`扫了 ${pages.length} 页。`);
  if (dangling.length) {
    console.log(`\n断边 ${dangling.length} 条（有人已经说要连过去，但那页不存在）：`);
    for (const d of dangling) console.log(`  ${d.from} → ${d.to}：${d.note}`);
  }
  if (gaps.length) {
    console.log(`\n待补概念 ${gaps.length} 个（跨页反复引用但没有页）：`);
    for (const g of gaps) {
      console.log(`  ${g.term.padEnd(24)} ${String(g.hits).padStart(4)} 次 · ${g.pages.length} 页`);
    }
  }
  if (!gaps.length && !dangling.length) console.log("没有发现漏洞。");
}
