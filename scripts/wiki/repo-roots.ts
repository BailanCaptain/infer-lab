import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSeeds } from "./ingest";
import { localFile } from "./review-files";

export function configuredRepoRoots(root: string, seeds?: string): Record<string, string> {
  const dir = join(root, "wiki/seeds");
  const roots: Record<string, string> = {};
  if (!existsSync(dir)) return roots;
  const files = seeds
    ? [localFile(root, seeds)]
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
