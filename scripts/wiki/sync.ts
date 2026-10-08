import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { paramEntrySchema } from "../../src/content/wiki/schema";
import { corpusDir, readCorpus } from "./corpus";
import { detectDrift } from "./drift";
import { gitText } from "./git";
import { parseSeeds } from "./ingest";
import { appendWikiLog } from "./log";
import { patrol } from "./maintenance";
import { loadPages } from "./pages";
import { ParameterBulkDeferred, publishParamSync } from "./params/publish-sync";
import { scanRepo } from "./params/scan";
import { parameterDiff, parameterKey } from "./params/sync";
import { queueImportantPr } from "./pr-queue";
import { listTasks } from "./queue";
import { reconcileCycle } from "./reconcile";
import { localFile } from "./review-files";
import { syncGithub } from "./sync-github";
import { checkUrls, collectUrls, httpFetcher, urlFindings } from "./urls";
import { workerDue, workOne } from "./worker";
import { atomicText, digest, WorkflowStore } from "./workflow";

export { readSyncConfig, syncConfigSchema } from "./sync-config";

import { syncConfigSchema } from "./sync-config";

async function runSync(
  root: string,
  input: z.input<typeof syncConfigSchema>,
  progress: (phase: string, repo?: string, ref?: string) => void,
) {
  progress("configuration");
  const config = syncConfigSchema.parse(input);
  if ((config.maxTasks || config.reconcileBatches || config.driftSample) && !config.paid)
    throw new Error("运行队列、交叉审视或衰减检测需显式 paid 配置和共享预算");
  progress("seeds");
  const seeds = parseSeeds(readFileSync(localFile(root, config.seeds), "utf8"));
  const parameters = [];
  let deferred = 0;
  for (const [name, repo] of Object.entries(seeds.repos)) {
    const dir = resolve(root, repo.path);
    if (config.fetch) {
      progress("fetch", name);
      gitText(dir, ["fetch", "origin", "--tags", "--prune"]);
    }
    if (!config.parameters) continue;
    for (const [ref, pin] of Object.entries(repo.refs)) {
      progress("parameter-tip", name, ref);
      const tip = gitText(dir, ["rev-parse", "--verify", `refs/remotes/origin/${ref}^{commit}`]).trim();
      const stateDir = localFile(root, "wiki/_jobs/parameter-sync");
      mkdirSync(stateDir, { recursive: true });
      const path = join(stateDir, `${digest(`${name}:${ref}`)}.json`);
      const schema = z.object({ commit: z.string(), entries: paramEntrySchema.array() });
      progress("parameter-baseline", name, ref);
      const old = existsSync(path)
        ? schema.parse(JSON.parse(readFileSync(path, "utf8")))
        : scanRepo(dir, pin, config.python);
      if (old.commit === tip) {
        if (!existsSync(path)) atomicText(path, JSON.stringify(old));
        parameters.push({ repo: name, ref, changed: false });
        continue;
      }
      progress("parameter-scan", name, ref);
      const next = scanRepo(dir, tip, config.python);
      const diff = parameterDiff(old.entries, next.entries);
      progress("parameter-publish", name, ref);
      let published: Awaited<ReturnType<typeof publishParamSync>>;
      try {
        published = await publishParamSync(root, {
          repo: name,
          repoDir: dir,
          ref,
          before: old,
          after: next,
          maxNewPages: config.maxNewParamPages,
        });
      } catch (error) {
        if (!(error instanceof ParameterBulkDeferred)) throw error;
        deferred++;
        const report = {
          repo: name,
          ref,
          status: "deferred",
          oldCommit: old.commit,
          newCommit: next.commit,
          added: error.added,
          limit: error.limit,
          reason: error.message,
        };
        const warnings = localFile(root, "wiki/warnings");
        mkdirSync(warnings, { recursive: true });
        atomicText(
          join(warnings, `params-deferred-${digest(`${name}:${ref}`).slice(0, 12)}.json`),
          JSON.stringify(report, null, 2),
        );
        parameters.push(report);
        continue;
      }
      const report = {
        repo: name,
        ref,
        oldCommit: old.commit,
        newCommit: next.commit,
        ...diff,
        published,
        qualification: "只刷新确定性定义与谱系；正文变化待审，未更新 seeds 钉点",
      };
      const warnings = localFile(root, "wiki/warnings");
      mkdirSync(warnings, { recursive: true });
      atomicText(
        join(warnings, `params-${digest(`${name}:${ref}`).slice(0, 12)}-${tip.slice(0, 12)}.json`),
        JSON.stringify(report, null, 2),
      );
      // 有留到下一轮的新增项时，检查点只记「已处理到哪」、commit 不前进：
      // 下一晚同一对 commit 再比一次，剩下的自然又是「新增」，谱系区间也不变。
      const heldBack = new Set(published.heldBackKeys ?? []);
      atomicText(
        path,
        JSON.stringify(
          heldBack.size
            ? { commit: old.commit, entries: next.entries.filter((p) => !heldBack.has(parameterKey(p))) }
            : next,
        ),
      );
      parameters.push(report);
    }
  }
  let github: unknown = { status: "disabled" };
  if (config.github) {
    progress("github", config.githubRepo);
    const checkpoint = join(corpusDir(root, config.githubRepo), "checkpoint.json");
    github = existsSync(checkpoint)
      ? await syncGithub(root, config.githubRepo)
      : { status: "needs-initial-import", note: "没有全库检查点；每日任务不会启动大规模首拉" };
    for (const pr of readCorpus(root, config.githubRepo)) await queueImportantPr(root, pr, config.seeds);
  }
  progress("patrol");
  const deadUrls = config.checkUrls
    ? urlFindings(await checkUrls(collectUrls(loadPages(join(root, "wiki")).pages), httpFetcher()))
    : [];
  const inspection = await patrol(root, seeds, config.patrolAgeDays, undefined, deadUrls);
  // 付费环节各自隔离：一处失败记进报告，同一晚后面的环节照跑
  progress("reconcile");
  const reconciliation = config.reconcileBatches
    ? await isolated("reconcile", () => reconcileCycle(root, config.reconcileBatches, config.paid!))
    : undefined;
  progress("drift");
  const drift = config.driftSample
    ? await isolated("drift", () => detectDrift(root, { sample: config.driftSample, policy: config.paid! }))
    : undefined;
  progress("worker");
  const tasks = [];
  for (const task of listTasks(root)
    .filter((t) => workerDue(root, t))
    .slice(0, config.maxTasks))
    tasks.push(
      await isolated(`worker:${task.id}`, () =>
        workOne(root, task.id, config.paid!, { retry: task.state !== "queued" }),
      ),
    );
  return {
    parameters,
    deferred,
    github,
    patrol: inspection,
    tasks,
    reconciliation,
    drift,
    modelCallsAllowed: !!config.paid && config.maxTasks + config.reconcileBatches + config.driftSample > 0,
  };
}

/** 付费环节的失败隔离：抛错的环节记成 {ok:false, stage, error}，不让同一晚后面的环节跟着停 */
export async function isolated<T>(
  stage: string,
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; stage: string; error: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, stage, error: String(error) };
  }
}

export async function syncWiki(root: string, input: z.input<typeof syncConfigSchema>) {
  const store = new WorkflowStore(root);
  const lease = localFile(root, "wiki/_jobs/sync/daily-lease.json");
  await store.locked(() => {
    if (existsSync(lease)) {
      const old = z
        .object({ active: z.boolean(), pid: z.number().int().positive() })
        .parse(JSON.parse(readFileSync(lease, "utf8")));
      if (old.active)
        try {
          process.kill(old.pid, 0);
          throw new Error("维护任务已运行");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
    }
    mkdirSync(localFile(root, "wiki/_jobs/sync"), { recursive: true });
    atomicText(lease, JSON.stringify({ pid: process.pid, active: true }));
  });
  let okay = false;
  const receipt: {
    startedAt: string;
    finishedAt?: string;
    status: string;
    phase: string;
    repo?: string;
    ref?: string;
    error?: string;
    stack?: string;
    findings?: number;
    deferred?: number;
  } = { startedAt: new Date().toISOString(), status: "running", phase: "start" };
  const receiptPath = localFile(root, "wiki/_jobs/sync/last-run.json");
  const historyPath = localFile(
    root,
    `wiki/_jobs/sync/run-${digest(`${receipt.startedAt}:${process.pid}`)}.json`,
  );
  const persist = () => {
    const text = JSON.stringify(receipt, null, 2);
    atomicText(historyPath, text);
    atomicText(receiptPath, text);
  };
  try {
    const result = await runSync(root, input, (phase, repo, ref) => {
      Object.assign(receipt, { phase, repo, ref });
      persist();
    });
    receipt.status = result.deferred ? "deferred" : result.patrol.findings.length ? "findings" : "succeeded";
    receipt.deferred = result.deferred;
    receipt.findings = result.patrol.findings.length;
    okay = true;
    return result;
  } catch (error) {
    receipt.status = "failed";
    receipt.error = String(error);
    receipt.stack = error instanceof Error ? error.stack : undefined;
    throw error;
  } finally {
    await store.locked(() => {
      try {
        receipt.finishedAt = new Date().toISOString();
        persist();
        appendWikiLog(
          root,
          "review",
          "周期维护",
          okay
            ? "本轮维护执行结束，具体发现见 warnings 和各任务回执；不表示所有语义检查通过。"
            : "本轮维护失败，未完成步骤的检查点保留；详见 wiki/_jobs/sync/last-run.json 和同目录逐次运行记录。未自动重试收费调用。",
        );
      } finally {
        atomicText(lease, JSON.stringify({ pid: process.pid, active: false }));
      }
    });
  }
}
