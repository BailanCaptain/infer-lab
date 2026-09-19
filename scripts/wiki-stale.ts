/**
 * pnpm wiki:stale --seeds wiki/seeds/<name>.yaml [--fetch] [--ids]
 *
 * 报出「引用的上游代码已经变了」的页，并给出可直接喂给
 * `pnpm wiki:ingest --only <ids>` 的 id 列表。
 *
 * 判据是「这页引用的文件变了」，不是「仓库有新提交」——上游每天几十个提交，
 * 绝大多数跟某一页无关；按引用路径过滤才能把重跑压到该跑的那几页。
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { worktreeDir } from "./wiki/clone";
import { gitText } from "./wiki/git";
import { parseSeeds } from "./wiki/ingest";
import { loadPages } from "./wiki/pages";
import { findStale, refOfCommit, staleIds } from "./wiki/stale";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const root = process.cwd();
const seedsPath = arg("--seeds") ?? "wiki/seeds/vllm-ascend.yaml";
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));

/** repo 名 → 该 repo 任意一份工作树（git 元数据是共享的，用哪份都行） */
const repoDir: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  const firstRef = Object.keys(r.refs)[0];
  if (firstRef) repoDir[name] = resolve(root, worktreeDir(r, firstRef));
}

const git = (repo: string, args: string[]): string => {
  const dir = repoDir[repo];
  if (!dir) throw new Error(`来源仓库未配置：${repo}，尚未验证是否过期`);
  return gitText(dir, args);
};

if (process.argv.includes("--fetch")) {
  for (const repo of Object.keys(repoDir)) {
    process.stderr.write(`fetch ${repo}…\n`);
    git(repo, ["fetch", "--all", "--tags", "--prune"]);
  }
}

/** commit → ref 名：先认 seeds 钉点，再按祖先关系（见 refOfCommit） */
const refOf = (repo: string, commit: string): string | undefined => {
  const r = seeds.repos[repo];
  if (!r) return undefined;
  return refOfCommit(r.refs, commit, (c, ref) => {
    try {
      git(repo, ["merge-base", "--is-ancestor", c, `origin/${ref}`]);
      return true;
    } catch {
      return false;
    }
  });
};

const { pages } = loadPages(join(root, "wiki"));
const stale = findStale(pages, refOf, {
  tipOf: (repo, ref) => git(repo, ["rev-parse", "--short", `origin/${ref}`]).trim() || undefined,
  changedFiles: (repo, from, to, paths) =>
    git(repo, ["diff", "--name-only", `${from}..${to}`, "--", ...paths])
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0),
});

if (process.argv.includes("--ids")) {
  console.log(staleIds(stale));
} else if (stale.length === 0) {
  console.log(`扫了 ${pages.length} 页，引用的上游代码都没变。`);
} else {
  console.log(`扫了 ${pages.length} 页，${stale.length} 页引用的上游代码已经变了：\n`);
  for (const s of stale) {
    for (const d of s.drift) {
      console.log(`  ${s.id.padEnd(28)} ${d.ref} ${d.pinned}→${d.tip}  ${d.changed.length} 个文件变过`);
      for (const c of d.changed.slice(0, 3)) console.log(`${" ".repeat(32)}${c}`);
      if (d.changed.length > 3) console.log(`${" ".repeat(32)}… 另 ${d.changed.length - 3} 个`);
    }
  }
  console.log(`\n重跑这些页：pnpm wiki:ingest --seeds ${seedsPath} --only ${staleIds(stale)}`);
}
