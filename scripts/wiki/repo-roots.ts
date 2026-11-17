import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSeeds } from "./ingest";
import { localFile } from "./review-files";

/** 版本标记（frontmatter `verified`、页头的版本标签）说的是这个仓库的分支 */
export const PRIMARY_REPO = "vllm-ascend";

export function isGitRepoRoot(dir: string): boolean {
  return existsSync(join(dir, ".git")) || existsSync(join(dir, "HEAD"));
}

export function configuredRepoRoots(root: string, seeds?: string): Record<string, string> {
  const dir = join(root, "wiki/seeds");
  const roots: Record<string, string> = {};
  const files = seeds
    ? [localFile(root, seeds)]
    : !existsSync(dir)
      ? []
      : readdirSync(dir)
          .filter((f) => /\.ya?ml$/.test(f))
          .sort()
          .map((f) => join(dir, f));
  for (const file of files) {
    for (const [name, repo] of Object.entries(parseSeeds(readFileSync(file, "utf8")).repos)) {
      const path = resolve(root, repo.path);
      if (roots[name] && roots[name] !== path) throw new Error(`仓库 ${name} 的 seeds 路径不一致`);
      roots[name] = path;
    }
  }
  return roots;
}

/** 全部 seeds 里登记过的版本：仓库名 → { ref 名 → 钉住的提交 }。同一个 ref 在两份 seeds 里钉得不一样就报错。 */
export function configuredRefs(root: string): Record<string, Record<string, string>> {
  const dir = join(root, "wiki/seeds");
  const out: Record<string, Record<string, string>> = {};
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()) {
    for (const [name, repo] of Object.entries(parseSeeds(readFileSync(join(dir, file), "utf8")).repos)) {
      const refs = out[name] ?? {};
      for (const [ref, commit] of Object.entries(repo.refs)) {
        if (refs[ref] && refs[ref] !== commit)
          throw new Error(`仓库 ${name} 的 ${ref} 在不同 seeds 里钉的提交不一致`);
        refs[ref] = commit;
      }
      out[name] = refs;
    }
  }
  return out;
}
