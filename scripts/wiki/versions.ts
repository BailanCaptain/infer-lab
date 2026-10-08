import { parseRepoRef } from "../../src/content/wiki/schema";
import type { WikiPage } from "./pages";

/**
 * 跨版本核对：一页引用的那几行源码，在另一个版本上还是不是原样。
 *
 * `wiki:stale` 回答的是「同一条分支往前走了，这页引用的文件变没变」；这里回答的是
 * 「v0.23 上写的这句话，在 v0.26 上还成立吗」。2026-09-21 用户定：v0.23 与 v0.26 长期并存，
 * 不是换版本。从 v0.23 到 v0.26rc，`vllm_ascend/` 下 444 个文件变了 281 个，不可能每页重读；
 * 但一页真正依赖的只是它引用的那几十行——这几行逐行没变，结论就跟着成立，变了的才需要人看。
 *
 * 按「所引的那几行」比，不按文件比：文件变了而所引的函数没动，是最常见的情形。
 */

export type Verdict = "same" | "moved" | "changed" | "gone";

export interface RangeResult {
  verdict: Verdict;
  /** moved 时，这段内容在目标版本里的起始行 */
  at?: number;
}

const norm = (line: string) => line.replace(/\s+$/, "");

export function compareRange(from: string[], start: number, end: number, to: string[] | null): RangeResult {
  if (!to) return { verdict: "gone" };
  const block = from.slice(start - 1, end).map(norm);
  const target = to.map(norm);
  const matchesAt = (i: number) => block.every((line, k) => target[i + k] === line);
  if (start - 1 + block.length <= target.length && matchesAt(start - 1)) return { verdict: "same" };
  // 全是空行的范围到处都能匹配上，搜到也不说明任何问题
  if (block.every((line) => line === "")) return { verdict: "changed" };
  for (let i = 0; i + block.length <= target.length; i++)
    if (matchesAt(i)) return { verdict: "moved", at: i + 1 };
  return { verdict: "changed" };
}

export interface VersionPair {
  repo: string;
  /** 页面来源钉住的那个提交（seeds 里的写法，可以是短号） */
  from: string;
  to: string;
  /** 目标版本在 seeds 里的 ref 名，写进 `verified` 的就是它 */
  toRef: string;
}

export interface PageCross {
  id: string;
  file: string;
  items: ({ source: string } & RangeResult)[];
  /** 这页钉在 from 上的来源，在目标版本里全都原样找得到 */
  holds: boolean;
}

export type ReadLines = (repo: string, commit: string, path: string) => string[] | null;

const samePin = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

export function crossCheck(pages: WikiPage[], pairs: VersionPair[], read: ReadLines): PageCross[] {
  const out: PageCross[] = [];
  for (const page of pages) {
    const items: PageCross["items"] = [];
    for (const source of page.fm.sources) {
      const ref = parseRepoRef(source);
      if (!ref) continue;
      const pair = pairs.find((p) => p.repo === ref.repo && samePin(p.from, ref.commit));
      if (!pair) continue;
      const before = read(ref.repo, ref.commit, ref.path);
      if (!before) continue; // 来源本身读不到是 wiki:audit 的事
      const start = ref.lineStart ?? 1;
      const end = ref.lineEnd ?? ref.lineStart ?? before.length;
      items.push({ source, ...compareRange(before, start, end, read(ref.repo, pair.to, ref.path)) });
    }
    if (items.length === 0) continue;
    out.push({
      id: page.fm.id,
      file: page.file,
      items,
      holds: items.every((i) => i.verdict === "same" || i.verdict === "moved"),
    });
  }
  return out;
}

/** 把 refs 并进 frontmatter 的 `verified`（没有就加在 evidence 前面）。只动这一行。 */
export function withVerified(text: string, refs: string[]): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  const close = lines.indexOf("---", 1);
  if (lines[0] !== "---" || close < 0) throw new Error("页面缺 frontmatter");
  const at = lines.findIndex((line, i) => i < close && line.startsWith("verified:"));
  const have: string[] = at >= 0 ? JSON.parse((lines[at] as string).slice("verified:".length).trim()) : [];
  const merged = [...have, ...refs.filter((r) => !have.includes(r))];
  if (merged.length === have.length) return text;
  const line = `verified: [${merged.map((r) => JSON.stringify(r)).join(", ")}]`;
  if (at >= 0) lines[at] = line;
  else {
    const evidence = lines.findIndex((l, i) => i < close && l.startsWith("evidence:"));
    lines.splice(evidence >= 0 ? evidence : close, 0, line);
  }
  return lines.join(eol);
}
