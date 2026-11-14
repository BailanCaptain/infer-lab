import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { type AgentEvent, type AgentRequest, type AgentResult, type RunAgent, runBatch } from "./batch";
import { parsePage } from "./pages";
import { bindRawSnapshot, saveRawSnapshot } from "./raw";
import { isWikiStatePath } from "./review-files";
import { atomicText, digest, type WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

const readOptional = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);
function snapshot(root: string, skipJobs = true): Map<string, string> {
  const files = new Map<string, string>();
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const key = relative(root, path).replace(/\\/g, "/");
      if (skipJobs && isWikiStatePath(key)) continue;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`工作目录不接受符号链接：${key}`);
      if (stat.isDirectory()) visit(path);
      else files.set(key, digest(readFileSync(path)));
    }
  };
  visit(root);
  return files;
}

/** Seed extraction adapter: isolated attempts can only publish their own draft and immutable raw. */
export async function runWorkRequest(
  store: WorkflowStore,
  request: AgentRequest,
  input: WorkInput,
  policy: WorkflowPolicy,
  deps: { runAgent: RunAgent; retry?: boolean; onEvent?: (event: AgentEvent) => void },
): Promise<AgentResult> {
  const job = await store.enqueue(input, policy);
  if (job.input.targets.length !== 1 || job.input.targets[0] !== request.id)
    throw new Error("提取请求与任务目标不一致");
  const draft = `_drafts/${request.id}.md`;
  const raw = `raw/${request.id}.md`;
  const allowed = new Set([draft, raw]);
  if (request.allowedWrites.length !== 2 || request.allowedWrites.some((p) => !allowed.has(p)))
    throw new Error("提取请求必须只写自己的草稿与 raw");
  const wikiRoot = join(store.root, "wiki");
  if (job.state === "integrated")
    return {
      id: request.id,
      jobId: job.id,
      ok: true,
      exitCode: 0,
      costUsd: 0,
      stderrTail: "",
      reason: "同证据任务已整合，无需重提取",
    };
  if (job.state === "draft") {
    if (!store.matchesDraft(job, request.id))
      throw new Error("已记录草稿或来源发生变化，拒绝当作缓存成功；请先审查任务与文件");
    return {
      id: request.id,
      jobId: job.id,
      ok: true,
      exitCode: 0,
      costUsd: 0,
      stderrTail: "",
      reason: "复用已有待审草稿",
    };
  }
  const attempt = await store.claim(job.id, deps.retry);
  const attemptsRoot = resolve(store.runtimeDir, "attempts");
  mkdirSync(attemptsRoot, { recursive: true });
  const canonicalAttemptsRoot = realpathSync(attemptsRoot);
  const stage = resolve(attemptsRoot, job.id, attempt.token);
  const within = relative(attemptsRoot, stage);
  if (!within || within.startsWith("..") || resolve(stage) === attemptsRoot) throw new Error("非法尝试目录");
  let result: AgentResult = { id: request.id, ok: false, exitCode: 1, stderrTail: "" };
  try {
    const base = snapshot(wikiRoot);
    cpSync(wikiRoot, stage, {
      recursive: true,
      filter: (path) => !isWikiStatePath(relative(wikiRoot, path).replace(/\\/g, "/")),
    });
    for (const dir of ["_drafts", "raw"]) mkdirSync(join(stage, dir), { recursive: true });
    // An old draft cannot serve as proof that this attempt produced anything.
    rmSync(join(stage, draft), { force: true });
    rmSync(join(stage, raw), { force: true });
    const before = snapshot(stage, false);
    if (request.args.includes("--max-budget-usd"))
      throw new Error("agent 费用限制由任务策略统一设置，不能重复传入");
    const batch = await runBatch(
      [
        {
          ...request,
          ...attempt.selection,
          cwd: stage,
          accountingOnly: attempt.accountingOnly,
          args: [
            ...request.args,
            ...(attempt.budgetUsd === undefined ? [] : ["--max-budget-usd", String(attempt.budgetUsd)]),
          ],
        },
      ],
      {
        concurrency: 1,
        runAgent: deps.runAgent,
        onEvent: (_id, event) => deps.onEvent?.(event),
      },
    );
    result = { ...(batch.results[0] as AgentResult), jobId: job.id };
    if (!result.ok) throw new Error(result.reason ?? `exit ${result.exitCode}`);
    const after = snapshot(stage, false);
    const unexpected = [...new Set([...before.keys(), ...after.keys()])].filter(
      (p) => before.get(p) !== after.get(p) && !allowed.has(p),
    );
    if (unexpected.length) throw new Error(`提取越界写：${unexpected.join(", ")}`);
    const draftText = readOptional(join(stage, draft));
    const rawText = readOptional(join(stage, raw));
    if (!draftText || !rawText?.trim()) throw new Error("缺少本次草稿或非空 raw 摘录");
    const parsed = parsePage(draft, draftText);
    if (!parsed.page || parsed.problems.length)
      throw new Error(`草稿 schema 错误：${JSON.stringify(parsed.problems)}`);
    const bound = bindRawSnapshot(draftText, rawText, request.id);
    const final = await store.finish(
      job.id,
      attempt.token,
      {
        ok: true,
        costUsd: result.costUsd,
        billing: result.billing,
        usage: result.usage,
        artifacts: { [draft]: digest(bound.text), [bound.path]: digest(rawText) },
      },
      () => {
        // Verify the original base before publishing; a late attempt cannot reach this callback.
        const current = snapshot(wikiRoot);
        const changed = [...new Set([...base.keys(), ...current.keys()])].filter(
          (p) => base.get(p) !== current.get(p),
        );
        // Other jobs may publish their own draft/raw and compatibility failure records concurrently.
        if (
          changed.some(
            (p) => p === draft || p === raw || (!p.startsWith("_drafts/") && !p.startsWith("raw/")),
          )
        )
          throw new Error("编译期间原文件发生变化，未发布");
        for (const dir of ["_drafts", "raw"]) mkdirSync(join(wikiRoot, dir), { recursive: true });
        // A retained, unreferenced snapshot after an interrupted draft write is safe to reuse.
        saveRawSnapshot(wikiRoot, rawText);
        atomicText(join(wikiRoot, draft), bound.text);
      },
    );
    return { ...result, ok: final.state === "draft", reason: final.attempts.at(-1)?.reason };
  } catch (error) {
    const reason = String(error);
    await store.finish(job.id, attempt.token, {
      ok: false,
      costUsd: result.costUsd,
      billing: result.billing,
      usage: result.usage,
      reason,
    });
    return { ...result, ok: false, reason };
  } finally {
    try {
      if (existsSync(stage)) {
        const actual = relative(canonicalAttemptsRoot, realpathSync(stage));
        if (!actual || actual.startsWith("..") || lstatSync(stage).isSymbolicLink())
          console.warn(`尝试目录实际位置已变化，保留待核对：${stage}`);
        else rmSync(stage, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`尝试目录清理失败，任务结果仍以工作记录为准：${stage} ${String(error)}`);
    }
  }
}
