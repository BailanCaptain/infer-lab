import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { RAW_SNAPSHOT_RE } from "../../src/content/wiki/schema";
import { rawSnapshotPath, saveRawSnapshot } from "./raw";
import { atomicText } from "./workflow";

export const REGISTRY = "src/content/wiki/registry.json";

/** Relative to wiki/: operational records are not knowledge or agent compilation input. */
export function isWikiStatePath(path: string): boolean {
  return (
    path === "_jobs" ||
    path.startsWith("_jobs/") ||
    path === "_gaps.json" ||
    /^_gaps\.json\.[a-f0-9-]+\.tmp$/.test(path)
  );
}

/** Refuse links at every ancestor, including an existing destination. */
export function localFile(root: string, path: string): string {
  if (
    !path ||
    path.includes("\\") ||
    path.split("/").some((p) => !p || p === "." || p === ".." || p.includes(":"))
  )
    throw new Error(`非法审阅路径：${path}`);
  let current = resolve(root);
  if (lstatSync(current).isSymbolicLink()) throw new Error("审阅根目录不接受符号链接");
  for (const part of path.split("/")) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error(`审阅路径不接受符号链接：${path}`);
  }
  return current;
}

export function optionalText(root: string, path: string): string | null {
  const full = localFile(root, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

export function replaceText(root: string, path: string, text: string | null): void {
  const full = localFile(root, path);
  if (path.startsWith("wiki/") && RAW_SNAPSHOT_RE.test(path.slice(5))) {
    if (text === null || `wiki/${rawSnapshotPath(text)}` !== path) throw new Error("快照不能删除或改变 hash");
    saveRawSnapshot(join(root, "wiki"), text);
    return;
  }
  if (text === null) rmSync(full, { force: true });
  else {
    mkdirSync(dirname(full), { recursive: true });
    atomicText(full, text);
  }
}

/** All wiki inputs are guarded; durable workflow/review records are separate. */
export function wikiContents(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (path: string) => {
    const full = localFile(root, path);
    if (!existsSync(full)) return;
    for (const name of readdirSync(full).sort()) {
      const next = `${path}/${name}`;
      if (isWikiStatePath(next.slice(5))) continue;
      const file = localFile(root, next);
      if (lstatSync(file).isDirectory()) walk(next);
      else files.set(relative(root, file).replace(/\\/g, "/"), readFileSync(file, "utf8"));
    }
  };
  walk("wiki");
  const registry = optionalText(root, REGISTRY);
  if (registry !== null) files.set(REGISTRY, registry);
  return files;
}
