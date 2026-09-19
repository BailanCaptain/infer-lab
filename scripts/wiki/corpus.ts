import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { repoPath } from "./github";
import { localFile } from "./review-files";
import { atomicText } from "./workflow";

export const corpusRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    repo: z.string(),
    kind: z.enum(["issue", "pr"]),
    number: z.number().int().positive(),
    title: z.string(),
    url: z.string().url(),
    state: z.string(),
    author: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    closedAt: z.string().nullable(),
    labels: z.array(z.string()),
    merged: z.boolean().optional(),
    mergeCommit: z.string().nullable().optional(),
    fixes: z.array(z.number().int().positive()),
    files: z.array(z.string()),
    patches: z
      .array(
        z.object({
          file: z.string(),
          patch: z.string().nullable(),
          status: z.string(),
          previousFilename: z.string().optional(),
        }),
      )
      .default([]),
    docs: z.array(z.object({ url: z.string(), version: z.string(), path: z.string() })),
    comments: z.array(
      z.object({
        id: z.string(),
        url: z.string().url(),
        author: z.string().nullable(),
        updatedAt: z.string(),
        body: z.string(),
        kind: z.enum(["discussion", "review-comment", "review", "timeline"]),
      }),
    ),
    body: z.string(),
    unavailable: z.boolean().optional(),
  })
  .strict();
export type CorpusRecord = z.infer<typeof corpusRecordSchema>;
export const corpusDir = (root: string, repo: string) => {
  repoPath(repo);
  return localFile(root, `tools/corpus/${repo.split("/")[1]}`);
};
export function parseDocLinks(text: string) {
  const found = new Map<string, { url: string; version: string; path: string }>();
  for (const m of text.matchAll(
    /https:\/\/docs\.vllm\.ai\/projects\/ascend\/en\/([^/\s]+)\/([^\s<>"')#?]+)(?:#[^\s<>"')]+)?/g,
  )) {
    const url = new URL(m[0].replace(/[.,;]+$/, ""));
    const version = decodeURIComponent(m[1]!);
    const path = decodeURIComponent(m[2]!).replace(/[.,;]+$/, "");
    if (
      /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(version) &&
      !path.split("/").includes("..") &&
      !path.includes("\\")
    )
      found.set(url.href, { url: url.href, version, path });
  }
  return [...found.values()];
}
export function fixingIssues(text: string): number[] {
  return [
    ...new Set(
      [
        ...text.matchAll(
          /\b(?:fix(?:e[sd])?|clos(?:e[sd]|ing)|resolv(?:e[sd]|ing))\s+(?:#|https:\/\/github\.com\/vllm-project\/vllm-ascend\/issues\/)(\d+)/gi,
        ),
      ].map((m) => Number(m[1])),
    ),
  ];
}
export function writeCorpus(root: string, value: CorpusRecord) {
  const record = corpusRecordSchema.parse(value);
  claimCorpusRepo(root, record.repo);
  const dir = join(corpusDir(root, record.repo), record.kind === "issue" ? "issues" : "prs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${record.number}.md`);
  // One canonical structured record; the readable body is a deterministic projection.
  const text = matter.stringify(
    `# ${record.title}\n\n${record.body}\n\n${record.comments.map((c) => `## ${c.kind} · ${c.author ?? "deleted"}\n\n[原文](${c.url})\n\n${c.body}`).join("\n\n")}\n`,
    { record },
  );
  if (existsSync(path) && readFileSync(path, "utf8") === text) return false;
  atomicText(path, text);
  return true;
}
/** Preserve the documented repo-name directory while preventing another owner from reusing it. */
export function claimCorpusRepo(root: string, repo: string) {
  const dir = corpusDir(root, repo);
  const path = join(dir, "repo.json");
  if (existsSync(path)) {
    if (JSON.parse(readFileSync(path, "utf8")).repo !== repo) throw new Error("语料目录已属于其他仓库");
    return;
  }
  // Legacy folders have no identity file; validate their existing canonical records once.
  readCorpus(root, repo);
  mkdirSync(dir, { recursive: true });
  atomicText(path, JSON.stringify({ repo }));
}
export function readCorpus(root: string, repo: string) {
  const records: CorpusRecord[] = [];
  for (const folder of ["issues", "prs"]) {
    const dir = join(corpusDir(root, repo), folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)
      .filter((n) => /^\d+\.md$/.test(n))
      .sort()) {
      const record = corpusRecordSchema.parse(
        matter(readFileSync(localFile(root, `tools/corpus/${repo.split("/")[1]}/${folder}/${name}`), "utf8"))
          .data.record,
      );
      if (record.repo !== repo) throw new Error("语料目录仓库不符");
      records.push(record);
    }
  }
  return records;
}
