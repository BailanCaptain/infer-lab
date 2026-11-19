import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CorpusDocument } from "../../src/content/wiki/corpus-retrieve";
import type { Hit } from "../../src/content/wiki/retrieve";
import { type CorpusRecord, corpusDir, readCorpus } from "./corpus";
import { gitText } from "./git";
import { parseSeeds } from "./ingest";
import { containingRefs } from "./lineage-git";
import { fileStamp, localFile } from "./review-files";
import { sanitizeRawInput } from "./sanitize";

const CORPUS_CACHE_LIMIT = 64;
const corpusDocumentsCache = new Map<string, { stamp: string; docs: CorpusDocument[] }>();

function corpusStamp(root: string, repo: string): string {
  const base = corpusDir(root, repo);
  const parts: string[] = [];
  for (const folder of ["issues", "prs"] as const) {
    const dir = join(base, folder);
    if (!existsSync(dir)) continue;
    if (lstatSync(dir).isSymbolicLink()) {
      throw new Error(`审阅路径不接受符号链接：tools/corpus/${repo.split("/")[1]}/${folder}`);
    }
    for (const name of readdirSync(dir)
      .filter((n) => /^\d+\.md$/.test(n))
      .sort()) {
      parts.push(`${folder}/${name}=${fileStamp(join(dir, name))}`);
    }
  }
  return parts.join("\0");
}

export function corpusDocuments(root: string, repo = "vllm-project/vllm-ascend"): CorpusDocument[] {
  const key = `${resolve(root)}:${repo}`;
  const stamp = corpusStamp(root, repo);
  const cached = corpusDocumentsCache.get(key);
  if (cached && cached.stamp === stamp) {
    return cached.docs.map((doc) => ({ ...doc }));
  }
  const docs: CorpusDocument[] = readCorpus(root, repo)
    .map((r) => ({
      id: `github-${r.kind}-${r.number}`,
      title: `${r.kind} #${r.number}: ${r.title}`,
      url: r.url,
      text: [r.body, ...r.comments.map((c) => c.body)].join("\n"),
      unavailable: r.unavailable,
    }))
    .flatMap((r) => {
      const clean = sanitizeRawInput(r.text);
      return clean.blocked ? [] : [{ ...r, title: sanitizeRawInput(r.title).text, text: clean.text }];
    });
  if (corpusDocumentsCache.size >= CORPUS_CACHE_LIMIT && !corpusDocumentsCache.has(key)) {
    const oldest = corpusDocumentsCache.keys().next().value;
    if (oldest !== undefined) corpusDocumentsCache.delete(oldest);
  }
  corpusDocumentsCache.set(key, { stamp, docs });
  return docs.map((doc) => ({ ...doc }));
}
export function traceIssue(records: CorpusRecord[], number: number, localRepo: string) {
  const issue = records.find((r) => r.number === number && r.kind === "issue");
  if (!issue) throw new Error("issue 尚未采集");
  return {
    issue: issue.url,
    chains: records
      .filter((r) => r.kind === "pr" && r.fixes.includes(number))
      .map((pr) => {
        if (!pr.merged) return { pr: pr.url, status: "unmerged" as const };
        if (!pr.mergeCommit) return { pr: pr.url, status: "merge-commit-unavailable" as const };
        try {
          return {
            pr: pr.url,
            commit: pr.mergeCommit,
            status: "ancestry-verified" as const,
            ...containingRefs(localRepo, pr.mergeCommit),
            qualification: "提交祖先关系已核对；是否适用于当前报错仍需检查 PR 与环境",
          };
        } catch {
          return { pr: pr.url, commit: pr.mergeCommit, status: "commit-unavailable" as const };
        }
      }),
  };
}
export function mapDocRef(
  repo: string,
  doc: CorpusRecord["docs"][number],
  pinnedRef: string,
  pinnedCommit: string,
) {
  let commit: string;
  const requested = doc.version === "latest" ? "origin/main" : doc.version;
  try {
    commit = gitText(repo, ["rev-parse", "--verify", `${requested}^{commit}`]).trim();
  } catch {
    return { ...doc, matchesPinned: false, reason: "文档版本在本地没有对应 ref；未套用当前版本" };
  }
  const paths = gitText(repo, ["ls-tree", "-r", "--name-only", commit, "--", "docs/source/"]).split(/\r?\n/);
  const stem = doc.path.replace(/\/$/, "").replace(/\.html$/, "");
  const choices = [
    `docs/source/${stem}.md`,
    `docs/source/${stem}.rst`,
    `docs/source/${stem}/index.md`,
    `docs/source/${stem}/index.rst`,
  ];
  const path = choices.find((p) => paths.includes(p));
  return {
    ...doc,
    commit,
    pinnedRef,
    matchesPinned: commit === gitText(repo, ["rev-parse", "--verify", `${pinnedCommit}^{commit}`]).trim(),
    ...(path ? { localPath: path } : { reason: "该版本没有对应源文档（可能删除、重命名或为生成页）" }),
  };
}

/** Enrich only retrieved records. Links and ancestry remain community leads, separate from formal Wiki citations. */
export function attachCorpusProvenance(root: string, hits: Hit[], repoName = "vllm-project/vllm-ascend") {
  if (!hits.some((h) => h.how === "corpus-exact")) return hits;
  const seedsPath = localFile(root, "wiki/seeds/vllm-ascend.yaml");
  const repo = existsSync(seedsPath)
    ? parseSeeds(readFileSync(seedsPath, "utf8")).repos[repoName.split("/")[1]!]
    : undefined;
  const records = readCorpus(root, repoName);
  return hits.map((h) => {
    if (h.how !== "corpus-exact") return h;
    const record = records.find((r) => r.url === h.url);
    if (!record) return h;
    const detail = !repo?.refs.main
      ? { status: "local-repo-unconfigured", docs: record.docs }
      : {
          ...(record.kind === "issue"
            ? traceIssue(records, record.number, resolve(root, repo.path))
            : { pr: record.url, merged: record.merged, commit: record.mergeCommit }),
          docs: record.docs.map((d) => mapDocRef(resolve(root, repo.path), d, "main", repo.refs.main!)),
        };
    return { ...h, provenance: JSON.stringify(detail) };
  });
}
