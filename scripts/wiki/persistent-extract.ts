import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type RunAgent, runBatch } from "./batch";
import {
  extractRequest,
  FAILURES_FILE,
  type Failures,
  type IngestContext,
  type SeedFeature,
  type Seeds,
} from "./ingest";
import { atomicText, digest, type Job, type WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";
import { runWorkRequest } from "./workflow-run";

export function seedWorkInput(feature: SeedFeature, seeds: Seeds, ctx: IngestContext): WorkInput {
  // Collection date and other batch members do not turn identical evidence into a new job.
  const recipe = extractRequest(feature, seeds, { ...ctx, today: "assigned-at-execution", batchIds: [] });
  const sources = feature.refs.flatMap((ref) =>
    [...feature.entry, ...feature.docs].map((path) => {
      const commit = seeds.repos[feature.repo]?.refs[ref];
      if (!commit) throw new Error(`来源版本缺失：${feature.repo}@${ref}`);
      return { ref: `${feature.repo}@${commit}:${path}`, hash: commit };
    }),
  );
  return {
    origin: "seed",
    sources,
    targets: [feature.id],
    recipeHash: digest(
      JSON.stringify({ compiler: "raw-snapshot-v1", args: recipe.args, stdin: recipe.stdin }),
    ),
  };
}

/** Compatibility file is derived from jobs for tracked targets; legacy failures remain readable. */
export async function syncFailureProjection(store: WorkflowStore): Promise<Failures> {
  return store.locked(() => {
    const file = join(store.root, "wiki", FAILURES_FILE);
    const failures: Failures = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    const latest = new Map<string, Job>();
    for (const job of store
      .list()
      .sort((a, b) =>
        (a.attempts.at(-1)?.startedAt ?? a.createdAt).localeCompare(
          b.attempts.at(-1)?.startedAt ?? b.createdAt,
        ),
      )) {
      for (const target of job.input.targets) latest.set(target, job);
    }
    for (const [target, job] of latest) {
      if (job.state === "failed" || job.state === "running")
        failures[target] = {
          at: job.updatedAt,
          reason: job.attempts.at(-1)?.reason ?? "任务仍在执行，尚无成功草稿",
        };
      else delete failures[target];
    }
    mkdirSync(dirname(file), { recursive: true });
    atomicText(file, `${JSON.stringify(failures, null, 2)}\n`);
    return failures;
  });
}

export async function runPersistentExtract(
  features: SeedFeature[],
  seeds: Seeds,
  ctx: IngestContext,
  deps: {
    store: WorkflowStore;
    policy: WorkflowPolicy;
    runAgent: RunAgent;
    concurrency: number;
    retry?: boolean;
    log: (line: string) => void;
  },
) {
  const requests = features.map((feature) => extractRequest(feature, seeds, ctx));
  const inputs = new Map(features.map((feature) => [feature.id, seedWorkInput(feature, seeds, ctx)]));
  const batch = await runBatch(requests, {
    concurrency: deps.concurrency,
    onStart: (id) => deps.log(`▶ ${id}`),
    onEvent: (id, event) => {
      if (event.kind === "tool") deps.log(`  ${id}: ${event.name} ${event.target ?? ""}`);
    },
    runAgent: (request, onEvent) =>
      runWorkRequest(deps.store, request, inputs.get(request.id) as WorkInput, deps.policy, {
        runAgent: deps.runAgent,
        retry: deps.retry,
        onEvent,
      }),
  });
  const failures = await syncFailureProjection(deps.store);
  const succeeded: string[] = [];
  const unchanged: string[] = [];
  const failed: string[] = [];
  for (const result of batch.results) {
    if (!result.ok) {
      failed.push(result.id);
      deps.log(`✗ ${result.id}: ${result.reason}`);
      continue;
    }
    const job = result.jobId ? deps.store.get(result.jobId) : undefined;
    if (job?.state === "draft") succeeded.push(result.id);
    else unchanged.push(result.id);
    deps.log(`✓ ${result.id}${result.reason ? `: ${result.reason}` : ""}`);
  }
  return {
    succeeded,
    unchanged,
    failed,
    failures,
    costUsd: batch.costUsd,
    unknownCostIds: batch.unknownCostIds,
  };
}
