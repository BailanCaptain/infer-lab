import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { RAW_SNAPSHOT_RE } from "../../src/content/wiki/schema";
import { rawSnapshotPath, saveRawSnapshot } from "./raw";
import { atomicText } from "./workflow";

export const REGISTRY = "src/content/wiki/registry.json";

/** ctime also detects same-size rewrites whose mtime was restored by an editor. */
export function fileStamp(path: string): string {
  const stat = lstatSync(path, { bigint: true });
  if (!stat.isFile()) throw new Error(`需要普通文件：${path}`);
  return `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
}

const stampCaches = new Map<string, Map<string, { stamp: string; value: unknown }>>();

/**
 * One value per file in `dir`, re-read only when the file's stamp changed; removed files drop out.
 * The stamp is taken before reading, so a write racing the read is picked up on the next call.
 * Cached values are shared between calls: callers must hand out copies, never the values themselves.
 */
export function readByStamp<T>(
  cache: string,
  dir: string,
  names: readonly string[],
  read: (name: string) => T,
): T[] {
  const key = `${cache}:${resolve(dir)}`;
  const previous = stampCaches.get(key);
  const next = new Map<string, { stamp: string; value: unknown }>();
  const values = names.map((name) => {
    const stamp = fileStamp(join(dir, name));
    const cached = previous?.get(name);
    const entry = cached?.stamp === stamp ? cached : { stamp, value: read(name) };
    next.set(name, entry);
    return entry.value as T;
  });
  stampCaches.set(key, next);
  return values;
}

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

/**
 * Mirror read-only `public/wiki-illustrations/` assets into a staging root so staged
 * `runLint`, `validateIntegration`, and `stageDropDiagram` resolve PLATE `<image href="./wiki-illustrations/...">`
 * identically to the live repo without letting reviews mutate `public/`.
 */
export function mirrorPublicIllustrations(sourceRoot: string, stageRoot: string): void {
  const src = join(resolve(sourceRoot), "public", "wiki-illustrations");
  if (!existsSync(src)) return;
  const srcStat = lstatSync(src);
  if (srcStat.isSymbolicLink() || !srcStat.isDirectory()) return;
  const dest = join(resolve(stageRoot), "public", "wiki-illustrations");
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const from = join(src, name);
    const stat = lstatSync(from);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;
    cpSync(from, join(dest, name));
  }
}
