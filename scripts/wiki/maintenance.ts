import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { CHAPTER_IDS } from "../../src/content/wiki/chapters";
import { gitText } from "./git";
import type { Seeds } from "./ingest";
import { lintPages, wikiFileExists } from "./lint";
import { loadPages, type WikiPage } from "./pages";
import { enqueueInLock } from "./queue";
import { localFile } from "./review-files";
import { citedPaths } from "./stale";
import { atomicText, digest, WorkflowStore } from "./workflow";

export function patrolFindings(pages: WikiPage[], seeds: Seeds, root: string, now: string, maxAgeDays = 30) {
  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0 || !Number.isFinite(Date.parse(now)))
    throw new Error("巡检日期或年龄阈值无效");
  const findings = lintPages(pages, {
    chapterIds: [...CHAPTER_IDS],
    existsFile: wikiFileExists(join(root, "wiki")),
  });
  for (const page of pages) {
    if (Date.parse(now) - Date.parse(page.fm.updated) < maxAgeDays * 86400000) continue;
    for (const [key, citation] of citedPaths(page)) {
      const pinned = key.split("@")[1]!;
      const repo = seeds.repos[citation.repo];
      if (!repo) {
        findings.push({ file: page.file, rule: "source-untracked", message: `引用仓库未配置：${key}` });
        continue;
      }
      const refs = Object.entries(repo.refs).filter(
        ([, sha]) => sha.startsWith(pinned) || pinned.startsWith(sha),
      );
      if (!refs.length) {
        findings.push({
          file: page.file,
          rule: "source-untracked",
          message: `旧提交 ${pinned} 没有受跟踪 ref，尚未验证新 tip`,
        });
        continue;
      }
      for (const [ref] of refs) {
        try {
          const dir = join(root, repo.path);
          const tip = gitText(dir, ["rev-parse", "--verify", `refs/remotes/origin/${ref}^{commit}`]).trim();
          const changed = gitText(dir, ["diff", "--name-only", pinned, tip, "--", ...citation.paths]).trim();
          if (changed)
            findings.push({
              file: page.file,
              rule: "source-changed",
              message: `${citation.repo}@${ref}：旧 ${pinned} → 新 ${tip}；变动 ${changed.replace(/\r?\n/g, "、")}；仅表示内容待复核`,
            });
        } catch {
          findings.push({
            file: page.file,
            rule: "source-unverified",
            message: `无法比较 ${key} 与 ${ref}；不得当作未变动`,
          });
        }
      }
    }
  }
  return findings;
}
export async function patrol(
  root: string,
  seeds: Seeds,
  maxAgeDays = 30,
  now = new Date().toISOString(),
  /** 巡检之外算好的问题（站外死链要联网，不能放进下面这把锁里做），一并写进同一份报告 */
  extra: { file: string; rule: string; message: string }[] = [],
) {
  return new WorkflowStore(root).locked(() => {
    const loaded = loadPages(join(root, "wiki"));
    const findings = [
      ...loaded.problems,
      ...patrolFindings(loaded.pages, seeds, root, now, maxAgeDays),
      ...extra,
    ];
    const path = localFile(root, `wiki/warnings/patrol-${now.slice(0, 10)}.md`);
    mkdirSync(localFile(root, "wiki/warnings"), { recursive: true });
    atomicText(
      path,
      `# 巡检 ${now}\n\n${findings.length ? findings.map((f) => `- ${f.file} [${f.rule}] ${f.message}`).join("\n") : "未发现结构或受跟踪来源变化问题。"}\n`,
    );
    return { path, findings };
  });
}
export function contentDrift(a: string, b: string) {
  const tokens = (s: string) =>
    new Set(
      s
        .normalize("NFKC")
        .toLowerCase()
        .match(/[a-z0-9_]+|[\u4e00-\u9fff]/g) ?? [],
    );
  const left = tokens(a),
    right = tokens(b),
    union = new Set([...left, ...right]);
  return union.size ? 1 - [...left].filter((t) => right.has(t)).length / union.size : 0;
}
export async function recordDrift(
  root: string,
  pageId: string,
  file: string,
  extracted: string,
  source: string,
  threshold = 0.3,
) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error("drift 阈值必须在 0–1");
  return new WorkflowStore(root).locked(() => {
    const original = readFileSync(localFile(root, `wiki/${file}`), "utf8");
    const score = contentDrift(matter(original).content, matter(extracted).content);
    const revision = digest(original);
    const result = {
      pageId,
      revision,
      score,
      threshold,
      qualification: "内容差异待复核，不是事实过期判定",
      ...(score > threshold
        ? {
            task: enqueueInLock(root, { kind: "rewrite", pageId, revision, source, reason: "content-drift" })
              .id,
          }
        : {}),
    };
    const dir = localFile(root, "wiki/warnings");
    mkdirSync(dir, { recursive: true });
    atomicText(
      join(dir, `drift-${pageId}-${revision.slice(0, 12)}.md`),
      `# 提取差异\n\n${JSON.stringify(result, null, 2)}\n`,
    );
    return result;
  });
}
