/**
 * pnpm wiki:clone --seeds wiki/seeds/vllm-ascend.yaml
 *
 * 按种子里的 repos 完整克隆到 tools/repos/<name>，抓齐全部分支与 tag，
 * 再为每个被引用的非 main ref 建一份工作树。规划逻辑在 wiki/clone.ts（有测试），
 * 这里只做 IO。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type CloneState, planClone } from "./wiki/clone";
import { DEFAULT_REF, parseSeeds } from "./wiki/ingest";

const i = process.argv.indexOf("--seeds");
const seedsPath = process.argv[i + 1];
if (i < 0 || !seedsPath) {
  console.error("用法：pnpm wiki:clone --seeds wiki/seeds/<name>.yaml");
  process.exit(2);
}

const git = (args: string[], cwd?: string) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();

const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));

for (const [name, repo] of Object.entries(seeds.repos)) {
  const mainDir = resolve(process.cwd(), repo.path);
  const isRepo = existsSync(join(mainDir, ".git")) || existsSync(join(mainDir, "HEAD"));
  const state: CloneState | null = existsSync(mainDir)
    ? { worktrees: isRepo ? listWorktrees(mainDir) : [], isRepo }
    : null;
  const plan = planClone(state, repo);

  if (plan.clone) {
    console.log(`克隆 ${name} ← ${repo.url}（完整克隆：跨 ref 查询要求不能用 blob:none）`);
    if (plan.reuseExistingDir) {
      // 目标目录已存在但不是仓库（Windows 上 rm -rf 清空了内容却删不掉目录本身）：
      // 克隆到旁边再把内容搬进去，不依赖能否删除目标目录。
      const tmp = `${mainDir}.tmp-${Date.now()}`;
      git(["clone", "--no-checkout", repo.url, tmp]);
      for (const entry of readdirSync(tmp)) renameSync(join(tmp, entry), join(mainDir, entry));
      rmSync(tmp, { recursive: true, force: true });
    } else {
      mkdirSync(dirname(mainDir), { recursive: true });
      git(plan.clone);
    }
  }
  git(plan.fetch, mainDir);
  git(plan.checkoutMain, mainDir);

  const head = git(["rev-parse", "HEAD"], mainDir);
  const wantMain = repo.refs[DEFAULT_REF];
  if (!wantMain || !head.startsWith(wantMain)) {
    console.error(`x ${name} HEAD ${head.slice(0, 8)} ≠ 钉住的 ${wantMain}`);
    process.exit(1);
  }
  console.log(`ok ${name}@${DEFAULT_REF} → ${head.slice(0, 8)}  ${mainDir}`);

  for (const w of plan.addWorktrees) {
    const dir = resolve(process.cwd(), w.dir);
    // 校验 sha 确实是 commit。写错成 blob / tree 的 sha 时 `worktree add` 只会报
    // 「invalid reference」，看不出是 seeds 写错了（2026-09-11 实际踩过：从一条
    // promisor 报错里抄了个 blob sha 当 commit）。
    const kind = git(["cat-file", "-t", w.commit], mainDir);
    if (kind !== "commit") {
      console.error(`x seeds 里 ${name} 的 ref ${w.ref} 指向 ${w.commit}，那是一个 ${kind} 而不是 commit`);
      process.exit(1);
    }
    console.log(`+ 工作树 ${name}@${w.ref} → ${w.commit}`);
    git(["worktree", "add", "--detach", dir, w.commit], mainDir);
    console.log(`ok ${name}@${w.ref} → ${w.commit}  ${dir}`);
  }

  for (const dir of plan.pruneWorktrees) {
    console.log(`- 回收不再引用的工作树 ${dir}`);
    git(["worktree", "remove", resolve(process.cwd(), dir)], mainDir);
  }
}

/** `git worktree list --porcelain` 的 worktree 行，转成相对仓库根的 posix 路径。 */
function listWorktrees(mainDir: string): string[] {
  const out = git(["worktree", "list", "--porcelain"], mainDir);
  const root = process.cwd().replace(/\\/g, "/");
  return out
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length).trim().replace(/\\/g, "/"))
    .map((p) => (p.toLowerCase().startsWith(root.toLowerCase()) ? p.slice(root.length + 1) : p));
}
