import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { ID_RE, type PAGE_ORIGINS, RAW_SNAPSHOT_RE } from "../../src/content/wiki/schema";
import { digest } from "./workflow";

export const rawSnapshotPath = (content: string) => `raw/sha256-${digest(content)}.md`;

export function readRawSnapshot(wikiRoot: string, path: string): string {
  const match = RAW_SNAPSHOT_RE.exec(path);
  if (!match) throw new Error(`非法 raw 快照路径：${path}`);
  const file = join(wikiRoot, path);
  if (!existsSync(file)) throw new Error(`raw 快照不存在：${path}`);
  if (
    lstatSync(join(wikiRoot, "raw")).isSymbolicLink() ||
    !lstatSync(file).isFile() ||
    lstatSync(file).isSymbolicLink()
  )
    throw new Error(`raw 快照路径不是普通文件：${path}`);
  const bytes = readFileSync(file);
  if (digest(bytes) !== match[1]) throw new Error(`raw 快照 hash 不符：${path}`);
  return bytes.toString("utf8");
}

/** Publish a complete immutable inode, never overwrite an existing address. */
export function saveRawSnapshot(wikiRoot: string, content: string): string {
  if (!content.trim()) throw new Error("raw 摘录不能为空");
  const path = rawSnapshotPath(content);
  const dir = join(wikiRoot, "raw");
  mkdirSync(dir, { recursive: true });
  if (lstatSync(dir).isSymbolicLink()) throw new Error("raw 目录不能是符号链接");
  const target = join(wikiRoot, path);
  if (existsSync(target)) {
    readRawSnapshot(wikiRoot, path);
    return path;
  }
  const temp = join(dir, `.${randomUUID()}.tmp`);
  try {
    const fd = openSync(temp, "wx");
    try {
      writeFileSync(fd, content, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      linkSync(temp, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    readRawSnapshot(wikiRoot, path);
    return path;
  } finally {
    rmSync(temp, { force: true });
  }
}

export function readPageRaw(wikiRoot: string, id: string, paths?: string[]): string {
  if (paths?.length) return paths.map((path) => readRawSnapshot(wikiRoot, path)).join("\n");
  if (!ID_RE.test(id)) throw new Error("非法页面 id");
  const legacy = join(wikiRoot, "raw", `${id}.md`);
  return existsSync(legacy) ? readFileSync(legacy, "utf8") : "";
}

export function withRawSources(
  text: string,
  paths: string[],
  origin?: (typeof PAGE_ORIGINS)[number],
): string {
  const parsed = matter(text);
  for (const path of paths) if (!RAW_SNAPSHOT_RE.test(path)) throw new Error(`非法 raw 快照路径：${path}`);
  return matter.stringify(parsed.content, {
    ...parsed.data,
    ...(origin ? { origin } : {}),
    rawSources: [...new Set(paths)].sort(),
  });
}

/** Rewrite actual links to the staging excerpt; preserve fenced and inline code examples. */
export function bindRawSnapshot(text: string, content: string, id: string): { path: string; text: string } {
  if (!ID_RE.test(id)) throw new Error("非法页面 id");
  const path = rawSnapshotPath(content);
  const parsed = matter(text);
  let fence = "";
  const inline = new RegExp(`(\x60+).*?\\1|\\](\\(\\s*<?)(?:\\.\\./)?raw/${id}\\.md(?=[#)>\\s])`, "g");
  const definition = new RegExp(`^(\\s*\\[[^\\]]+\\]:\\s*<?)(?:\\.\\./)?raw/${id}\\.md(?=[#>\\s]|$)`);
  const body = parsed.content
    .split(/(?<=\n)/)
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = "";
        return line;
      }
      if (marker) {
        fence = marker;
        return line;
      }
      return line
        .replace(inline, (match, code: string | undefined, opening: string) =>
          code ? match : `]${opening}../${path}`,
        )
        .replace(definition, `$1../${path}`);
    })
    .join("");
  return { path, text: matter.stringify(body, { ...parsed.data, rawSources: [path] }) };
}
