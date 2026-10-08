import type { ModelUse } from "./model-use";

/** Shared execution contract. Entry adapters own prompts and artifact validation. */
export interface AgentRequest {
  /** Explicit product execution records usage without inheriting test quotas. */
  accountingOnly?: boolean;
  signal?: AbortSignal;
  /** Omitted means the existing Claude runner and USD accounting. */
  provider?: "claude" | "codex";
  model?: string;
  /** Explicit evidence files for tool-free file generation; relative paths follow staged cwd. */
  evidenceFiles?: { label: string; path: string; allowMissing?: boolean; numbered?: boolean }[];
  id: string;
  cwd: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
  /** Allowed write paths relative to cwd; enforced by the artifact adapter. */
  allowedWrites: string[];
}

export type AgentEvent =
  | { kind: "tool"; name: string; target?: string }
  | { kind: "result"; isError: boolean; sessionId?: string; costUsd?: number };

export interface AgentResult {
  id: string;
  /** Persistent work receipt, when the caller uses the workflow adapter. */
  jobId?: string;
  ok: boolean;
  exitCode: number | null;
  sessionId?: string;
  costUsd?: number;
  billing?: "chatgpt";
  usage?: Record<string, number | undefined>;
  /** 实际作答模型与换手记录，启动器从 stream-json 里认出来的 */
  models?: ModelUse;
  reason?: string;
  stderrTail: string;
  /** Text result for tool-free compilers; file-writing adapters leave this unset. */
  output?: string;
}
export type RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) => Promise<AgentResult>;

export function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} 必须是正整数`);
  return value;
}

export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  positiveInteger(concurrency, "concurrency");
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runBatch(
  requests: AgentRequest[],
  deps: {
    concurrency: number;
    runAgent: RunAgent;
    onStart?: (id: string) => void;
    onEvent?: (id: string, event: AgentEvent) => void;
    onResult?: (result: AgentResult) => void;
  },
): Promise<{ results: AgentResult[]; costUsd: number; unknownCostIds: string[] }> {
  positiveInteger(deps.concurrency, "concurrency");
  const ids = new Set<string>();
  // Validate the entire batch before starting any billable work.
  for (const request of requests) {
    if (!request.id.trim() || ids.has(request.id)) throw new Error(`任务 id 为空或重复：${request.id}`);
    ids.add(request.id);
    positiveInteger(request.timeoutMs, `timeoutMs (${request.id})`);
  }
  const results = await runPool(requests, deps.concurrency, async (request) => {
    deps.onStart?.(request.id);
    let result: AgentResult;
    try {
      result = await deps.runAgent(request, (event) => deps.onEvent?.(request.id, event));
      let reason: string | undefined;
      if (result.id !== request.id) reason = `runner 返回了错误 id：${result.id}，预期 ${request.id}`;
      else if (result.ok && result.exitCode !== 0) reason = `runner 声称成功但 exit ${result.exitCode}`;
      if (result.costUsd !== undefined && (!Number.isFinite(result.costUsd) || result.costUsd < 0)) {
        reason = [reason, "runner 返回了非法费用，实际费用待核对"].filter(Boolean).join("；");
        result = { ...result, costUsd: undefined };
      }
      if (reason) result = { ...result, id: request.id, ok: false, reason };
    } catch (error) {
      result = { id: request.id, ok: false, exitCode: 1, reason: String(error), stderrTail: "" };
    }
    deps.onResult?.(result);
    return result;
  });
  return {
    results,
    costUsd: results.reduce((sum, result) => sum + (result.costUsd ?? 0), 0),
    unknownCostIds: results
      .filter((result) => result.costUsd === undefined && result.billing !== "chatgpt")
      .map((result) => result.id),
  };
}
