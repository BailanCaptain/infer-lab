/**
 * 克隆规划的纯函数部分。IO 在 scripts/wiki-clone.ts。
 *
 * 为什么是完整克隆而不是 `--filter=blob:none`（2026-09-10 实测）：
 * 部分克隆按需拉文件，跨分支 `git grep` 会**静默漏文件**——同一条命令在
 * `releases/v0.23.0` 上，部分克隆数出 11 个匹配文件，完整拉取是 13 个。
 * 参数谱系依赖跨 ref 的准确计数，漏一个就给出错误结论，所以不能用。
 * 附带代价是首次克隆慢、占盘多；`tools/repos/` 不进 git，可随时重建。
 */
import type { Seeds } from "./ingest";
import { DEFAULT_REF } from "./ingest";

export type SeedRepo = Seeds["repos"][string];

export interface CloneState {
  /** 已存在的工作树目录（相对仓库根） */
  worktrees: string[];
  /**
   * 目录里是不是一个 git 仓库。Windows 上 `rm -rf` 可能清空内容却删不掉目录本身
   * （Device or resource busy，2026-09-11 实遇），留下一个空壳；只看目录存不存在
   * 会误判成「已克隆」，然后在空目录上跑 git 命令失败。
   */
  isRepo: boolean;
}

export interface ClonePlan {
  /** 需要克隆时的 argv；已是仓库则为 null */
  clone: string[] | null;
  /** 目标目录已存在（可能是残留空壳），克隆前要先清空而不是 mkdir */
  reuseExistingDir: boolean;
  /** 刷新全部分支与 tag */
  fetch: string[];
  /** 主工作树切到 main 钉住的 commit */
  checkoutMain: string[];
  addWorktrees: { ref: string; commit: string; dir: string }[];
  updateWorktrees: { ref: string; commit: string; dir: string }[];
  pruneWorktrees: string[];
}

/**
 * 一个 ref 一份工作树。main 用仓库主目录，其余用 `<path>@<ref>`，
 * ref 里的 `/` 转成 `-`（Windows 路径不接受斜杠）。
 */
export function worktreeDir(repo: SeedRepo, ref: string): string {
  if (ref === DEFAULT_REF) return repo.path;
  return `${repo.path}@${ref.replace(/\//g, "-")}`;
}

export function planClone(state: CloneState | null, repo: SeedRepo): ClonePlan {
  const wanted = new Map(Object.keys(repo.refs).map((ref) => [worktreeDir(repo, ref), ref]));
  const existing = new Set(state?.worktrees ?? []);
  const mainDir = worktreeDir(repo, DEFAULT_REF);

  const addWorktrees = [...wanted.entries()]
    .filter(([dir]) => dir !== mainDir && !existing.has(dir))
    .map(([dir, ref]) => ({ ref, commit: repo.refs[ref] as string, dir }));

  // main 的工作树是仓库本体，不参与回收
  const pruneWorktrees = [...existing].filter((dir) => dir.startsWith(`${repo.path}@`) && !wanted.has(dir));
  const updateWorktrees = [...wanted.entries()]
    .filter(([dir]) => dir !== mainDir && existing.has(dir))
    .map(([dir, ref]) => ({ ref, commit: repo.refs[ref] as string, dir }));

  const needClone = !state?.isRepo;
  return {
    clone: needClone ? ["clone", "--no-checkout", repo.url, repo.path] : null,
    reuseExistingDir: state !== null,
    fetch: ["fetch", "origin", "+refs/heads/*:refs/remotes/origin/*", "--tags", "--prune"],
    checkoutMain: ["checkout", "--detach", repo.refs[DEFAULT_REF] as string],
    addWorktrees,
    updateWorktrees,
    pruneWorktrees,
  };
}
