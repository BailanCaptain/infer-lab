/**
 * 来源审计：把页面 frontmatter 里的每条 `repo@commit:path#L起-L止` 拿到钉住的本地仓库里核对，
 * 看文件是否存在、行号是否落在文件范围内、raw/<id>.md 里有没有对应片段。
 * lint 只管格式，这里管「行号是不是真的」，是 F001 AC4 的自动化部分。
 */
import { parseRawRef, parseRepoRef } from "../../src/content/wiki/schema";
import { type BlobRead, warmBlobs } from "./git";
import type { WikiPage } from "./pages";

export type RefVerdict = "ok" | "invalid-commit" | "missing-file" | "out-of-range" | "unknown-repo" | "url";

export interface RefAudit {
  file: string;
  ref: string;
  verdict: RefVerdict;
  /** 源文件总行数，verdict 为 ok 或 out-of-range 时有值 */
  totalLines?: number;
  /** 是否定位到 raw 中同仓库、同版本且覆盖行号的明确引用；不证明摘录语义 */
  inRaw: boolean;
}

export interface AuditDeps {
  /** repo 名 → 本地绝对路径；未列出的 repo 判 unknown-repo */
  repoRoots: Record<string, string>;
  /** 读取引用版本的 git blob，不能读取当前工作树 */
  readBlob: (repoRoot: string, commit: string, path: string) => BlobRead;
  /** 读 raw/<id>.md 原文；不存在返回空串 */
  readRaw: (id: string, rawSources?: string[]) => string;
  /** Must verify snapshot hash before returning text. Missing reader fails closed. */
  readSnapshot?: (path: string) => string;
}

export function sourceLines(text: string): string[] {
  return text === "" ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);
}

/** 把这批页面引用的全部源码文件一次读进缓存，之后逐条核对不再起 git 进程 */
export function warmPageSources(pages: WikiPage[], repoRoots: Record<string, string>): void {
  const byRoot = new Map<string, { commit: string; path: string }[]>();
  for (const page of pages)
    for (const source of page.fm.sources) {
      const ref = parseRepoRef(source);
      const root = ref && repoRoots[ref.repo];
      if (!ref || !root) continue;
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root)!.push({ commit: ref.commit, path: ref.path });
    }
  for (const [root, requests] of byRoot) warmBlobs(root, requests);
}

export function auditPage(page: WikiPage, deps: AuditDeps): RefAudit[] {
  const raw = deps.readRaw(page.fm.id, page.fm.rawSources);
  return page.fm.sources.map((ref): RefAudit => {
    const local = parseRawRef(ref);
    if (local) {
      if (!deps.readSnapshot) throw new Error("未配置 raw 快照校验器");
      const totalLines = sourceLines(deps.readSnapshot(local.path)).length;
      return {
        file: page.file,
        ref,
        totalLines,
        inRaw: true,
        verdict: local.lineEnd <= totalLines ? "ok" : "out-of-range",
      };
    }
    const parsed = parseRepoRef(ref);
    if (!parsed) return { file: page.file, ref, verdict: "url", inRaw: raw.includes(ref) };
    const inRaw = rawRefs(raw).some((candidate) => {
      const other = parseRepoRef(candidate);
      return (
        other &&
        other.repo === parsed.repo &&
        other.path === parsed.path &&
        other.commit === parsed.commit &&
        (parsed.lineStart === undefined ||
          (other.lineStart !== undefined &&
            other.lineStart <= parsed.lineStart &&
            (other.lineEnd ?? other.lineStart) >= (parsed.lineEnd ?? parsed.lineStart)))
      );
    });
    const root = deps.repoRoots[parsed.repo];
    if (!root) return { file: page.file, ref, verdict: "unknown-repo", inRaw };
    const blob = deps.readBlob(root, parsed.commit, parsed.path);
    if (blob.kind !== "ok") return { file: page.file, ref, verdict: blob.kind, inRaw };
    const totalLines = sourceLines(blob.text).length;
    const start = parsed.lineStart ?? 1;
    const end = parsed.lineEnd ?? start;
    const ok = parsed.lineStart === undefined || (start >= 1 && start <= end && end <= totalLines);
    return { file: page.file, ref, verdict: ok ? "ok" : "out-of-range", totalLines, inRaw };
  });
}

export function summarize(audits: RefAudit[]): Record<RefVerdict | "notInRaw", number> {
  const out = {
    ok: 0,
    "invalid-commit": 0,
    "missing-file": 0,
    "out-of-range": 0,
    "unknown-repo": 0,
    url: 0,
    notInRaw: 0,
  };
  for (const a of audits) {
    out[a.verdict]++;
    if (!a.inRaw) out.notInRaw++;
  }
  return out;
}

function rawRefs(raw: string): string[] {
  return raw.match(/[a-z0-9][a-z0-9-]*@[0-9a-f]{7,40}:[^\s`<>）)]+/g) ?? [];
}
