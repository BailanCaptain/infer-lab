import type { WikiPage } from "./pages";

/**
 * 过期检测：一页引用的那些文件，在上游是不是已经变了。
 *
 * 这是「持续更新」的判据。2026-09-12 实测：知识库钉在 `28bf3a2e`（2026-08-29），
 * 而 `origin/main` 已经超前 276 个提交，11 页引用的 107 个文件里 93 个变过，
 * 系统对此一无所知。
 *
 * 判据必须是「这页引用的文件变了」而不是「仓库有新提交」——上游每天几十个
 * 提交，绝大多数跟某一页无关。按引用路径过滤才能把重跑压到该跑的那几页。
 */

export interface StaleDeps {
  /** 返回 `from..to` 之间发生过改动的文件（限定在 paths 内） */
  changedFiles: (repo: string, from: string, to: string, paths: string[]) => string[];
  /** 某个 ref 当前的 tip commit；取不到返回 undefined */
  tipOf: (repo: string, ref: string) => string | undefined;
}

export interface PageStale {
  id: string;
  file: string;
  /** 页面引用到的 repo@commit → 变了的文件 */
  drift: { repo: string; pinned: string; ref: string; tip: string; changed: string[] }[];
}

/** 从 `repo@commit:path#Lx-Ly` 里拆出 (repo, commit, path) */
const SRC_RE = /^([a-z0-9][a-z0-9-]*)@([0-9a-f]{7,40}):([^\s#]+)/;

export function citedPaths(page: WikiPage): Map<string, { repo: string; paths: Set<string> }> {
  const out = new Map<string, { repo: string; paths: Set<string> }>();
  for (const src of page.fm.sources) {
    const m = SRC_RE.exec(src);
    if (!m) continue;
    const [, repo = "", commit = "", path = ""] = m;
    const key = `${repo}@${commit}`;
    const rec = out.get(key) ?? { repo, paths: new Set<string>() };
    rec.paths.add(path);
    out.set(key, rec);
  }
  return out;
}

/**
 * @param refOf commit → 它属于哪个 ref（从 seeds 反查）。查不到就用 commit 本身当名字。
 */
export function findStale(
  pages: WikiPage[],
  refOf: (repo: string, commit: string) => string | undefined,
  deps: StaleDeps,
): PageStale[] {
  const out: PageStale[] = [];
  for (const page of pages) {
    const drift: PageStale["drift"] = [];
    for (const [key, { repo, paths }] of citedPaths(page)) {
      const pinned = key.slice(key.indexOf("@") + 1);
      const ref = refOf(repo, pinned);
      if (!ref) continue; // 不在 seeds 里钉过的 commit，不归这里管
      const tip = deps.tipOf(repo, ref);
      if (!tip || tip.startsWith(pinned) || pinned.startsWith(tip)) continue;
      const changed = deps.changedFiles(repo, pinned, tip, [...paths].sort());
      if (changed.length > 0) drift.push({ repo, pinned, ref, tip, changed });
    }
    if (drift.length > 0) out.push({ id: page.fm.id, file: page.file, drift });
  }
  return out.sort(
    (a, b) =>
      b.drift.reduce((n, d) => n + d.changed.length, 0) - a.drift.reduce((n, d) => n + d.changed.length, 0),
  );
}

/** 供 `pnpm wiki:ingest --only` 直接使用的 id 列表 */
export function staleIds(stale: PageStale[]): string {
  return stale.map((s) => s.id).join(",");
}
