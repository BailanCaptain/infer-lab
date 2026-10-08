/**
 * 把后端 `reviewDiff` 的文本（每个文件一段 `路径 (新增|更新|删除)` + git unified diff）
 * 解析成可渲染的结构。只做解析，不重新计算差异——批准发布的仍是后端那份字节。
 */
export type FileKind = "added" | "modified" | "deleted";

export interface DiffLine {
  type: "add" | "del" | "ctx";
  text: string;
  oldNo?: number;
  newNo?: number;
  /** 成对的改动行里真正变了的那一段 [起, 止)，用于行内高亮 */
  mark?: [number, number];
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  kind: FileKind;
  added: number;
  deleted: number;
  hunks: DiffHunk[];
}

const KIND: Record<string, FileKind> = { 新增: "added", 更新: "modified", 删除: "deleted" };
const FILE_HEAD = /^(\S+) \((新增|更新|删除)\)$/;
const HUNK_HEAD = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** 正文页才是人要读的；目录、注册表、日志和草稿清理都是程序派生的 */
export function isContentPage(path: string): boolean {
  return /^wiki\/(concepts|params|sources)\/[^/]+\.md$/.test(path);
}

/** 一删一增相邻成对时，标出两行之间真正不同的那一段 */
function markPair(del: DiffLine, add: DiffLine): void {
  const a = del.text;
  const b = add.text;
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;
  // 整行都不同就不标：全行高亮等于没有信息
  if (head + tail < 4) return;
  del.mark = [head, a.length - tail];
  add.mark = [head, b.length - tail];
}

function pairUp(lines: DiffLine[]): void {
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.type !== "del") {
      i++;
      continue;
    }
    let dels = i;
    while (dels < lines.length && lines[dels]!.type === "del") dels++;
    let adds = dels;
    while (adds < lines.length && lines[adds]!.type === "add") adds++;
    const n = Math.min(dels - i, adds - dels);
    for (let k = 0; k < n; k++) markPair(lines[i + k]!, lines[dels + k]!);
    i = adds;
  }
}

export function parseReviewDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    // hunk 里以空格 / + / - / \ 开头的是内容行，哪怕内容长得像文件头也不能当文件头
    const head = hunk && /^[ +\-\\]/.test(line) ? null : FILE_HEAD.exec(line);
    if (head) {
      file = { path: head[1]!, kind: KIND[head[2]!]!, added: 0, deleted: 0, hunks: [] };
      files.push(file);
      hunk = undefined;
      continue;
    }
    if (!file) continue;
    const at = HUNK_HEAD.exec(line);
    if (at) {
      oldNo = Number(at[1]);
      newNo = Number(at[2]);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue; // diff --git / index / --- / +++ 这些文件头
    if (line.startsWith("+")) {
      hunk.lines.push({ type: "add", text: line.slice(1), newNo: newNo++ });
      file.added++;
    } else if (line.startsWith("-")) {
      hunk.lines.push({ type: "del", text: line.slice(1), oldNo: oldNo++ });
      file.deleted++;
    } else if (line.startsWith(" ")) {
      hunk.lines.push({ type: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    }
    // "\ No newline at end of file" 与段间空行：忽略
  }
  for (const f of files) for (const h of f.hunks) pairUp(h.lines);
  return files;
}

/** 新增页的完整原文（供阅读视图渲染） */
export function addedText(file: DiffFile): string {
  return file.hunks.flatMap((h) => h.lines.filter((l) => l.type === "add").map((l) => l.text)).join("\n");
}

/** 拆出 frontmatter，阅读视图只渲染正文 */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  return m ? { frontmatter: m[1]!, body: text.slice(m[0].length) } : { frontmatter: "", body: text };
}
