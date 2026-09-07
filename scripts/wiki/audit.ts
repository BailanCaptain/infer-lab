/**
 * 来源审计：把页面 frontmatter 里的每条 `repo@commit:path#L起-L止` 拿到钉住的本地仓库里核对，
 * 看文件是否存在、行号是否落在文件范围内、raw/<id>.md 里有没有对应片段。
 * lint 只管格式，这里管「行号是不是真的」，是 F001 AC4 的自动化部分。
 */
import { parseRepoRef } from "../../src/content/wiki/schema";
import type { WikiPage } from "./pages";

export type RefVerdict = "ok" | "missing-file" | "out-of-range" | "unknown-repo" | "url";

export interface RefAudit {
  file: string;
  ref: string;
  verdict: RefVerdict;
  /** 源文件总行数，verdict 为 ok 或 out-of-range 时有值 */
  totalLines?: number;
  /** raw/<id>.md 里有没有引用同一个源文件 */
  inRaw: boolean;
}

export interface AuditDeps {
  /** repo 名 → 本地绝对路径；未列出的 repo 判 unknown-repo */
  repoRoots: Record<string, string>;
  /** 读源文件行数；文件不存在返回 null */
  countLines: (repoRoot: string, path: string) => number | null;
  /** 读 raw/<id>.md 原文；不存在返回空串 */
  readRaw: (id: string) => string;
}

export function auditPage(page: WikiPage, deps: AuditDeps): RefAudit[] {
  const raw = deps.readRaw(page.fm.id);
  return page.fm.sources.map((ref): RefAudit => {
    const parsed = parseRepoRef(ref);
    if (!parsed) return { file: page.file, ref, verdict: "url", inRaw: raw.includes(ref) };
    const inRaw = raw.includes(parsed.path);
    const root = deps.repoRoots[parsed.repo];
    if (!root) return { file: page.file, ref, verdict: "unknown-repo", inRaw };
    const totalLines = deps.countLines(root, parsed.path);
    if (totalLines === null) return { file: page.file, ref, verdict: "missing-file", inRaw };
    const start = parsed.lineStart ?? 1;
    const end = parsed.lineEnd ?? start;
    const ok = start >= 1 && start <= end && end <= totalLines;
    return { file: page.file, ref, verdict: ok ? "ok" : "out-of-range", totalLines, inRaw };
  });
}

export function summarize(audits: RefAudit[]): Record<RefVerdict | "notInRaw", number> {
  const out = { ok: 0, "missing-file": 0, "out-of-range": 0, "unknown-repo": 0, url: 0, notInRaw: 0 };
  for (const a of audits) {
    out[a.verdict]++;
    if (!a.inRaw) out.notInRaw++;
  }
  return out;
}
