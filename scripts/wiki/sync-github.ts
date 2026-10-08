import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  type CorpusRecord,
  claimCorpusRepo,
  corpusDir,
  fixingIssues,
  parseDocLinks,
  readCorpus,
  writeCorpus,
} from "./corpus";
import { GithubClient, GithubError, githubCommentSchema, githubItemSchema, repoPath } from "./github";
import { appendWikiLog } from "./log";
import { queueImportantPr } from "./pr-queue";
import { localFile } from "./review-files";
import { atomicText, WorkflowStore } from "./workflow";

const checkpointSchema = z.object({
  schemaVersion: z.literal(1),
  completedAt: z.string().optional(),
  reconcileAfter: z.number().int().default(0),
  full: z.object({ startedAt: z.string(), nextPage: z.number().int().positive() }).optional(),
});
const pullSchema = z.object({ merged: z.boolean() }).passthrough();
const timelineSchema = z
  .object({
    event: z.string(),
    commit_id: z.string().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();
const reviewSchema = z
  .object({
    id: z.number(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({ login: z.string() }).nullable(),
    submitted_at: z.string().nullable(),
  })
  .passthrough();

export async function fetchCorpusRecord(
  client: GithubClient,
  repo: string,
  number: number,
): Promise<CorpusRecord> {
  const base = repoPath(repo);
  const issue = githubItemSchema.parse(await client.get(`${base}/issues/${number}`));
  const discussions = await client.all(`${base}/issues/${number}/comments`, githubCommentSchema);
  const comments: CorpusRecord["comments"] = discussions.map((c) => ({
    id: `discussion-${c.id}`,
    url: c.html_url,
    author: c.user?.login ?? null,
    updatedAt: c.updated_at,
    body: c.body ?? "",
    kind: "discussion",
  }));
  const isPr = issue.pull_request !== undefined;
  let pull: z.infer<typeof pullSchema> | undefined;
  let files: string[] = [];
  let patches: CorpusRecord["patches"] = [];
  let mergeCommit: string | null = null;
  if (isPr) {
    pull = pullSchema.parse(await client.get(`${base}/pulls/${number}`));
    const timeline = await client.all(`${base}/issues/${number}/timeline`, timelineSchema);
    const merged = timeline
      .filter((e) => e.event === "merged" && /^[a-f0-9]{40}$/.test(e.commit_id ?? ""))
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .at(-1);
    mergeCommit = merged?.commit_id ?? null;
    if (merged)
      comments.push({
        id: `merged-${mergeCommit}`,
        url: `${issue.html_url}#event-${String(merged.id ?? "merged")}`,
        author: null,
        updatedAt: merged.created_at ?? issue.updated_at,
        body: `合并提交：${mergeCommit}`,
        kind: "timeline",
      });
    const changedFiles = await client.all(
      `${base}/pulls/${number}/files`,
      z.object({
        filename: z.string(),
        patch: z.string().optional(),
        status: z.string().default("unknown"),
        previous_filename: z.string().optional(),
      }),
    );
    files = changedFiles.map((f) => f.filename);
    patches = changedFiles.map((f) => ({
      file: f.filename,
      patch: f.patch ?? null,
      status: f.status,
      ...(f.previous_filename ? { previousFilename: f.previous_filename } : {}),
    }));
    if (files.length >= 3000) throw new Error("PR 文件列表可能达到 API 截断上限，拒绝标记完整");
    for (const c of await client.all(`${base}/pulls/${number}/comments`, githubCommentSchema))
      comments.push({
        id: `review-comment-${c.id}`,
        url: c.html_url,
        author: c.user?.login ?? null,
        updatedAt: c.updated_at,
        body: c.body ?? "",
        kind: "review-comment",
      });
    for (const c of await client.all(`${base}/pulls/${number}/reviews`, reviewSchema))
      comments.push({
        id: `review-${c.id}`,
        url: c.html_url,
        author: c.user?.login ?? null,
        updatedAt: c.submitted_at ?? issue.updated_at,
        body: c.body ?? "",
        kind: "review",
      });
  }
  comments.sort((a, b) => a.id.localeCompare(b.id));
  const text = [issue.body ?? "", ...comments.map((c) => c.body)].join("\n");
  return {
    schemaVersion: 1,
    repo,
    kind: isPr ? "pr" : "issue",
    number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    author: issue.user?.login ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)).sort(),
    ...(pull ? { merged: pull.merged, mergeCommit } : {}),
    fixes: isPr ? fixingIssues(text) : [],
    files,
    patches,
    docs: parseDocLinks(text),
    comments,
    body: issue.body ?? "",
  };
}

/** Persist entries before advancing progress. A failed run never advances the completed checkpoint. */
export async function syncGithub(
  root: string,
  repo: string,
  options: { full?: boolean; numbers?: number[]; reconcileLimit?: number } = {},
  client = new GithubClient(process.env.GITHUB_TOKEN),
) {
  repoPath(repo);
  if (
    options.reconcileLimit !== undefined &&
    (!Number.isInteger(options.reconcileLimit) || options.reconcileLimit < 0 || options.reconcileLimit > 100)
  )
    throw new Error("reconcileLimit 限 0–100");
  if (options.numbers?.some((n) => !Number.isInteger(n) || n < 1) || (options.numbers?.length ?? 0) > 20)
    throw new Error("小样本采集限 1–20 个有效编号");
  const dir = corpusDir(root, repo);
  claimCorpusRepo(root, repo);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "checkpoint.json");
  const checkpoint = checkpointSchema.parse(
    existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { schemaVersion: 1 },
  );
  const store = new WorkflowStore(root);
  // Long network work uses a distinct operational lease, not the publication lock.
  const leasePath = localFile(root, "wiki/_jobs/sync/github-lease.json");
  await store.locked(() => {
    if (existsSync(leasePath)) {
      const prior = z
        .object({ pid: z.number().int().positive(), active: z.boolean() })
        .parse(JSON.parse(readFileSync(leasePath, "utf8")));
      if (prior.active)
        try {
          process.kill(prior.pid, 0);
          throw new Error("GitHub 同步已运行");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
        }
    }
    mkdirSync(localFile(root, "wiki/_jobs/sync"), { recursive: true });
    atomicText(leasePath, JSON.stringify({ pid: process.pid, active: true }));
  });
  const startedAt = new Date().toISOString();
  let changed = 0;
  let fetched = 0;
  let failed = 0;
  let failureKind = "";
  const refresh = async (number: number) => {
    const row = await fetchCorpusRecord(client, repo, number);
    fetched++;
    if (writeCorpus(root, row)) changed++;
    await queueImportantPr(root, row);
  };
  try {
    if (options.numbers) {
      for (const number of [...new Set(options.numbers)]) await refresh(number);
    } else {
      if (options.full && !checkpoint.full) {
        checkpoint.full = { startedAt, nextPage: 1 };
        atomicText(file, JSON.stringify(checkpoint));
      }
      if (!checkpoint.completedAt && !checkpoint.full)
        throw new Error("首次采集需要 --full，或用 --numbers 做不推进全库检查点的小样本验证");
      const fullStart = checkpoint.full?.startedAt;
      if (checkpoint.full) {
        for await (const page of client.pages(
          `${repoPath(repo)}/issues?state=all&sort=created&direction=asc`,
          githubItemSchema,
          checkpoint.full.nextPage,
        )) {
          for (const item of page.items) await refresh(item.number);
          checkpoint.full.nextPage = page.page + 1;
          atomicText(file, JSON.stringify(checkpoint));
        }
      }
      const since = new Date(
        new Date(fullStart ?? checkpoint.completedAt!).getTime() - 300_000,
      ).toISOString();
      const numbers = new Set<number>();
      for (const row of await client.all(
        `${repoPath(repo)}/issues?state=all&sort=updated&direction=asc&since=${encodeURIComponent(since)}`,
        githubItemSchema,
      ))
        numbers.add(row.number);
      // Comment edits can happen without a reliable parent timestamp update.
      for (const endpoint of ["issues/comments", "pulls/comments"]) {
        const rows = await client.all(
          `${repoPath(repo)}/${endpoint}?sort=updated&direction=asc&since=${encodeURIComponent(since)}`,
          z.object({ issue_url: z.string().optional(), pull_request_url: z.string().optional() }),
        );
        for (const row of rows) {
          const n = /\/(\d+)$/.exec(row.issue_url ?? row.pull_request_url ?? "")?.[1];
          if (n) numbers.add(Number(n));
        }
      }
      // Rolling full-item reconciliation catches deleted comments/reviews without deletion feeds.
      const all = readCorpus(root, repo).sort((a, b) => a.number - b.number);
      const offset = checkpoint.reconcileAfter % Math.max(1, all.length);
      const count = Math.min(options.reconcileLimit ?? 20, all.length);
      for (let i = 0; i < count; i++) numbers.add(all[(offset + i) % all.length]!.number);
      for (const number of numbers) {
        try {
          await refresh(number);
        } catch (error) {
          if (!(error instanceof GithubError) || error.kind !== "not-found") throw error;
          const old = all.find((r) => r.number === number);
          if (!old) throw error;
          if (writeCorpus(root, { ...old, unavailable: true })) changed++;
        }
      }
      checkpoint.reconcileAfter = (offset + count) % Math.max(1, all.length);
      checkpoint.completedAt = startedAt;
      delete checkpoint.full;
      atomicText(file, JSON.stringify(checkpoint));
    }
    const records = readCorpus(root, repo);
    return {
      fetched,
      changed,
      issues: records.filter((r) => r.kind === "issue").length,
      prs: records.filter((r) => r.kind === "pr").length,
      sample: !!options.numbers,
      completedAt: checkpoint.completedAt,
    };
  } catch (error) {
    failed++;
    failureKind = error instanceof GithubError ? error.kind : "validation-or-storage";
    throw error;
  } finally {
    await store.locked(() => {
      try {
        appendWikiLog(
          root,
          "ingest",
          `GitHub ${repo}`,
          `拉取 ${fetched}，变化 ${changed}，失败 ${failed}；${failed ? `未推进完成检查点；${failureKind}` : options.numbers ? "小样本采集，不代表全量完成" : "本轮检查点已更新"}。`,
          startedAt.slice(0, 10),
        );
      } finally {
        atomicText(leasePath, JSON.stringify({ pid: process.pid, active: false }));
      }
    });
  }
}
