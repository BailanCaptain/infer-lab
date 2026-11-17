/**
 * pnpm wiki:versions [--from <ref>] [--to <ref>] [--with <repo>:<from>:<to>]... [--mark <id,id>] [--init] [--out <file>]
 *
 * 跨版本核对：钉在 --from 上的每条来源，所引的那几行在 --to 上还是不是原样。
 *   - 全部原样（位置没变，或整段挪了行号）→ 低风险，但仍要人扫一眼（数出来的 [D] 结论不在所引行里）；
 *   - 有一条变了或文件没了 → 列进清单，要人对着新版本的源码看。
 * 看完、该写的版本差异写进正文之后，用 `--mark <id,id>` 把 --to 记进这些页的 `verified`，页头才显示这个版本。
 * 默认比的是 vllm-ascend 的 releases/v0.23.0 → releases/v0.26.0rc，以及与之配套的上游
 * vLLM：seeds 里叫 main 的那个提交其实是 v0.23.0 tag（见 seeds 注释）→ releases/v0.26.0。
 * `--init`：把每页来源里已经引用到的版本记进 `verified`（一页引了哪个版本的源码，就是对过哪个版本）。
 * 它只看所引的源码行：新版本**新增**的行为它看不见，文档 URL 也不比。
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRepoRef } from "../src/content/wiki/schema";
import { loadPages } from "./wiki/pages";
import { configuredRefs, configuredRepoRoots, PRIMARY_REPO } from "./wiki/repo-roots";
import { crossCheck, type VersionPair, withVerified } from "./wiki/versions";

const argv = process.argv.slice(2);
const one = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const many = (name: string) =>
  argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1] as string] : []));

const root = process.cwd();
const roots = configuredRepoRoots(root);
const refs = configuredRefs(root);
const specs = [
  `${PRIMARY_REPO}:${one("--from") ?? "releases/v0.23.0"}:${one("--to") ?? "releases/v0.26.0rc"}`,
  ...(many("--with").length ? many("--with") : ["vllm:releases/v0.23.0:releases/v0.26.0"]),
];
const pairs: VersionPair[] = specs.map((spec) => {
  const [repo = "", from = "", to = ""] = spec.split(":");
  const known = refs[repo];
  if (!known?.[from] || !known[to])
    throw new Error(
      `${spec}：seeds 里 ${repo} 登记的版本只有 ${Object.keys(known ?? {}).join("、") || "（无）"}`,
    );
  return { repo, from: known[from], to: known[to], toRef: to };
});

const cache = new Map<string, string[] | null>();
function read(repo: string, commit: string, path: string): string[] | null {
  const key = `${repo}@${commit}:${path}`;
  if (!cache.has(key)) {
    let lines: string[] | null = null;
    try {
      lines = execFileSync("git", ["-C", roots[repo] ?? "", "show", `${commit}:${path}`], {
        encoding: "utf8",
        maxBuffer: 1 << 28,
        stdio: ["ignore", "pipe", "ignore"],
      }).split("\n");
    } catch {
      lines = null;
    }
    cache.set(key, lines);
  }
  return cache.get(key) ?? null;
}

const { pages } = loadPages(join(root, "wiki"));

if (argv.includes("--init")) {
  const pins = Object.entries(refs[PRIMARY_REPO] ?? {});
  let touched = 0;
  for (const page of pages) {
    const cited = pins
      .filter(([, pin]) =>
        page.fm.sources.some((src) => {
          const ref = parseRepoRef(src);
          return ref?.repo === PRIMARY_REPO && (ref.commit.startsWith(pin) || pin.startsWith(ref.commit));
        }),
      )
      .map(([name]) => name);
    if (cited.length === 0) continue;
    const file = join(root, "wiki", page.file);
    const text = readFileSync(file, "utf8");
    const next = withVerified(text, cited);
    if (next !== text) {
      writeFileSync(file, next);
      touched++;
    }
  }
  console.log(`--init：按已引用的版本给 ${touched} 页记了 verified`);
  process.exit(0);
}
const toRefName = pairs[0]?.toRef ?? "";
// 已经有人对过目标版本的页不再列出来：它们的 v0.23 来源在目标版本上变了是意料之中的，
// 差异已经写进正文（三版本写法的新页一出生就是这样）。
const done = new Set(pages.filter((p) => p.fm.verified.includes(toRefName)).map((p) => p.fm.id));
const results = crossCheck(pages, pairs, read).filter((r) => !done.has(r.id));
const toRef = pairs[0]?.toRef ?? "";
const holds = results.filter((r) => r.holds);
const broken = results.filter((r) => !r.holds);
const count = (v: string) => results.reduce((n, r) => n + r.items.filter((i) => i.verdict === v).length, 0);

const report = [
  `# 跨版本核对 → ${toRef}`,
  "",
  `来源 ${results.reduce((n, r) => n + r.items.length, 0)} 条：原位未变 ${count("same")}，挪了行号 ${count("moved")}，变了 ${count("changed")}，文件没了 ${count("gone")}`,
  `已对过 ${toRefName} 的页 ${done.size}（不再列出）；还没对过的页 ${results.length}：所引源码全部原样 ${holds.length}，需要人看 ${broken.length}`,
  "",
  `## 需要人看（${broken.length} 页，按受影响来源数排）`,
  ...broken
    .sort(
      (a, b) =>
        b.items.filter((i) => i.verdict !== "same" && i.verdict !== "moved").length -
        a.items.filter((i) => i.verdict !== "same" && i.verdict !== "moved").length,
    )
    .flatMap((r) => [
      `### ${r.id}（${r.items.filter((i) => i.verdict === "changed" || i.verdict === "gone").length} / ${r.items.length}）`,
      ...r.items
        .filter((i) => i.verdict === "changed" || i.verdict === "gone")
        .map((i) => `- ${i.verdict} ${i.source}`),
    ]),
  "",
  `## 所引源码全部原样（${holds.length} 页）`,
  holds.map((r) => r.id).join("、"),
  "",
].join("\n");

const out = one("--out");
if (out) writeFileSync(out, report);
else console.log(report);

// 记 verified 必须有人看过：所引的行没变，不等于这页的每句话都成立——「442 个文件」「78 个方法」这类
// 数出来的 [D] 结论不落在任何一条来源的行号里（2026-09-21 第一次跑就撞上了：目录地图页所引的行
// 全部原样，但它的文件数、行数在 v0.26 上显然不同）。所以这里只提供「看完之后记一笔」，不自动记。
const mark = one("--mark");
if (mark) {
  let touched = 0;
  for (const id of mark.split(",")) {
    const page = pages.find((p) => p.fm.id === id.trim());
    if (!page) throw new Error(`--mark：没有 id 为 ${id} 的页`);
    const file = join(root, "wiki", page.file);
    const text = readFileSync(file, "utf8");
    const next = withVerified(text, [toRef]);
    if (next !== text) {
      writeFileSync(file, next);
      touched++;
    }
  }
  console.log(`已把 ${toRef} 记进 ${touched} 页的 verified`);
}
console.log(
  `已对过 ${done.size} 页；还没对过 ${results.length} 页：全部原样 ${holds.length}，需要人看 ${broken.length}${out ? `（清单在 ${out}）` : ""}`,
);
