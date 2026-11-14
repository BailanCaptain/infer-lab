import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { paramEntrySchema } from "../../src/content/wiki/schema";
import { runPool } from "./batch";
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
import { restrictedArgs } from "./restricted-claude";
import { localFile } from "./review-files";
import { selectedAgent } from "./selected-agent";
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
  const modelCallsAllowed = [config.maxTasks, config.reconcileBatches, config.driftSample].some(
    (quota) => quota !== 0,
  );
  if (modelCallsAllowed && !config.paid)
    throw new Error("运行队列、交叉审视或衰减检测需显式 paid 配置和共享预算");
  progress("seeds");
  const seeds = parseSeeds(readFileSync(localFile(root, config.seeds), "utf8"));
  const stageFailures: { stage: string; error: string }[] = [];
  const parameters = [];
  let deferred = 0;
  for (const [name, repo] of Object.entries(seeds.repos)) {
    const dir = resolve(root, repo.path);
    if (config.fetch) {
      progress("fetch", name);
      try {
        gitText(dir, ["fetch", "origin", "--tags", "--prune"]);
      } catch (error) {
        stageFailures.push({ stage: `fetch:${name}`, error: String(error) });
        continue;
      }
    }
    if (!config.parameters) continue;
    for (const [ref, pin] of Object.entries(repo.refs)) {
      try {
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
            teachingRefs: repo.refs,
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
      } catch (error) {
        stageFailures.push({ stage: `parameters:${name}:${ref}`, error: String(error) });
      }
    }
  }
  let github: unknown = { status: "disabled" };
  if (config.github) {
    try {
      progress("github", config.githubRepo);
      const checkpoint = join(corpusDir(root, config.githubRepo), "checkpoint.json");
      github = existsSync(checkpoint)
        ? await syncGithub(root, config.githubRepo)
        : { status: "needs-initial-import", note: "没有全库检查点；每日任务不会启动大规模首拉" };
      for (const pr of readCorpus(root, config.githubRepo)) await queueImportantPr(root, pr, config.seeds);
    } catch (error) {
      github = { status: "failed", error: String(error) };
      stageFailures.push({ stage: "github", error: String(error) });
    }
  }
  progress("patrol");
  const patrolResult = await isolated("patrol", async () => {
    const deadUrls = config.checkUrls
      ? urlFindings(await checkUrls(collectUrls(loadPages(join(root, "wiki")).pages), httpFetcher()))
      : [];
    return patrol(root, seeds, config.patrolAgeDays, undefined, deadUrls);
  });
  if (!patrolResult.ok) stageFailures.push({ stage: patrolResult.stage, error: patrolResult.error });
  const inspection = patrolResult.ok ? patrolResult.value : { path: undefined, findings: [] };
  // Check the shared connection before fan-out; failed items keep their existing checkpoints.
  if (modelCallsAllowed) {
    progress("model-preflight");
    const connection = await isolated("model-preflight", async () => {
      const result = await selectedAgent(
        root,
        "nightly-model-preflight",
      )({
        id: "nightly-model-preflight",
        cwd: root,
        allowedWrites: [],
        timeoutMs: 60_000,
        args: restrictedArgs(
          "Connection check. Return only the JSON object requested.",
          config.paid && "reserveUsd" in config.paid ? config.paid.reserveUsd : undefined,
        ),
        stdin: 'Return {"ready":true}.',
      });
      if (!result.ok) throw new Error(result.reason ?? "模型连接检查失败");
      z.object({ ready: z.literal(true) }).parse(JSON.parse(result.output ?? ""));
    });
    if (!connection.ok)
      return {
        parameters,
        deferred,
        github,
        patrol: inspection,
        tasks: [],
        reconciliation: undefined,
        drift: undefined,
        failures: [...stageFailures, { stage: connection.stage, error: connection.error }],
        modelCallsAllowed,
      };
  }
  // 付费环节各自隔离：一处失败记进报告，同一晚后面的环节照跑
  progress("reconcile");
  const reconciliation =
    config.reconcileBatches !== 0
      ? await isolated("reconcile", () =>
          reconcileCycle(root, config.reconcileBatches, config.paid!, { retry: true }),
        )
      : undefined;
  progress("drift");
  const drift =
    config.driftSample !== 0
      ? await isolated("drift", () =>
          detectDrift(root, { sample: config.driftSample, policy: config.paid! }, { retry: false }),
        )
      : undefined;
  progress("worker");
  const due = listTasks(root)
    .filter((t) =>
      t.state === "failed"
        ? !(t.input.kind === "rewrite" && t.input.reason === "content-drift")
        : workerDue(root, t),
    )
    .slice(0, config.maxTasks ?? undefined);
  const runTask = (task: (typeof due)[number]) =>
    isolated(`worker:${task.id}`, () =>
      workOne(root, task.id, config.paid!, { retry: task.state !== "queued" }),
    );
  const tasks = [];
  // Gap/PR jobs can select their destination during compilation; keep those serial.
  for (const task of due.filter((t) => t.input.kind !== "rewrite")) tasks.push(await runTask(task));
  const rewrites = new Map<string, typeof due>();
  for (const task of due) {
    if (task.input.kind !== "rewrite") continue;
    const group = rewrites.get(task.input.pageId) ?? [];
    group.push(task);
    rewrites.set(task.input.pageId, group);
  }
  const completed = await runPool([...rewrites.values()], config.maxTasks === null ? 3 : 1, async (group) => {
    const results = [];
    for (const task of group) results.push(await runTask(task));
    return results;
  });
  tasks.push(...completed.flat());
  return {
    parameters,
    deferred,
    github,
    patrol: inspection,
    tasks,
    reconciliation,
    drift,
    failures: [
      ...stageFailures,
      ...[reconciliation, drift, ...tasks].flatMap((result) =>
        result && !result.ok ? [{ stage: result.stage, error: result.error }] : [],
      ),
      ...(reconciliation?.ok ? (reconciliation.value.failures ?? []) : []),
      ...(drift?.ok
        ? drift.value.flatMap((r) =>
            r.status === "failed" ? [{ stage: `drift:${r.page}`, error: r.error! }] : [],
          )
        : []),
    ],
    modelCallsAllowed,
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
  store.recoverLock(true);
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
          const lastPath = localFile(root, "wiki/_jobs/sync/last-run.json");
          if (existsSync(lastPath)) {
            const last = JSON.parse(readFileSync(lastPath, "utf8"));
            if (last.status === "running" && typeof last.startedAt === "string") {
              const recovered = JSON.stringify(
                {
                  ...last,
                  status: "interrupted",
                  finishedAt: new Date().toISOString(),
                  error: "维护进程已退出；已保存的分段和模型回执可在下一轮复用",
                },
                null,
                2,
              );
              atomicText(
                localFile(root, `wiki/_jobs/sync/run-${digest(`${last.startedAt}:${old.pid}`)}.json`),
                recovered,
              );
              atomicText(lastPath, recovered);
            }
          }
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
    failures?: { stage: string; error: string }[];
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
    await store.recover();
    const result = await runSync(root, input, (phase, repo, ref) => {
      Object.assign(receipt, { phase, repo, ref });
      persist();
    });
    receipt.status = result.failures.length
      ? "failed"
      : result.deferred
        ? "deferred"
        : result.patrol.findings.length
          ? "findings"
          : "succeeded";
    receipt.failures = result.failures;
    receipt.deferred = result.deferred;
    receipt.findings = result.patrol.findings.length;
    okay = result.failures.length === 0;
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
            : "本轮维护失败，检查点已保留；独立步骤继续执行，模型连接检查失败时暂缓依赖它的任务。详见 wiki/_jobs/sync/last-run.json 和同目录逐次运行记录；失败项下轮可续跑。",
        );
      } finally {
        atomicText(lease, JSON.stringify({ pid: process.pid, active: false }));
      }
    });
  }
}
