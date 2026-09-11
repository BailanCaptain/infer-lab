/**
 * pnpm wiki:lineage <标识符> [--refs a,b,c] [--paths vllm_ascend/] [--seeds ...]
 *
 * 算出一个参数 / 类 / 函数在各分支上的存亡，以及引入与移除的 PR、影响面。
 * 输出直接就是参数页「版本谱系」一节的 markdown。
 *
 * 这一节由脚本算而不是 agent 写：agent 会编 PR 号，而这些事实 git 里全有。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { worktreeDir } from "./wiki/clone";
import { parseSeeds } from "./wiki/ingest";
import { buildLineage, type Commit, type FileStat, renderLineage } from "./wiki/lineage";

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

const git = (args: string[]): string => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  } catch {
    return "";
  }
};

/** 默认按版本从旧到新——移除点靠相邻两版的有无翻转判定，顺序不能乱 */
const defaultRefs = git(["branch", "-r", "--list", "origin/releases/*"])
  .split(/\r?\n/)
  .map((l) => l.trim().replace(/^origin\//, ""))
  .filter((l) => /^releases\/v\d+\.\d+/.test(l))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const refs = (arg("--refs")?.split(",") ?? [...defaultRefs, "main"]).map((r) => r.trim());
const paths = (arg("--paths", "vllm_ascend/") as string).split(",");

const lineage = buildLineage(term, refs, paths, {
  countIn: (ref, t, ps) =>
    git(["grep", "-l", "--fixed-strings", t, `origin/${ref}`, "--", ...ps])
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0).length,
  historyOf: (ref, t, ps) =>
    git(["log", `--format=%h%x09%ad%x09%s`, "--date=short", "-S", t, `origin/${ref}`, "--", ...ps])
      .split(/\r?\n/)
      .filter((l) => l.includes("\t"))
      .map((l) => {
        const [sha = "", date = "", ...rest] = l.split("\t");
        return { sha, date, subject: rest.join("\t") } satisfies Commit;
      }),
  statOf: (sha, ps) =>
    git(["show", "--numstat", "--format=", sha, "--", ...ps])
      .split(/\r?\n/)
      .filter((l) => /^\d+\t\d+\t/.test(l))
      .map((l) => {
        const [a = "0", r = "0", path = ""] = l.split("\t");
        return { path, added: Number(a), removed: Number(r) } satisfies FileStat;
      }),
});

console.log(renderLineage(lineage));
