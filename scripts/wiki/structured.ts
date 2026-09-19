import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { z } from "zod";
import { type RunAgent, runBatch } from "./batch";
import { budgetedAgent } from "./budget";
import { restrictedArgs, runRestrictedClaude } from "./restricted-claude";
import { localFile } from "./review-files";
import { sanitizeRawInput } from "./sanitize";
import { atomicText, digest, WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

export const STRUCTURED_INPUT_LIMIT = 40_000;

/** Normalize a single transport envelope; schema and evidence checks still follow. */
export function parseStructuredJson(text: string): unknown {
  const fenced = /^\s*```(?:json)?\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(text);
  return JSON.parse(fenced ? fenced[1]! : text);
}

/** One tool-free, durable JSON decision. Machine validation never substitutes for evidence review. */
export async function runStructured<T>(
  root: string,
  input: {
    kind: string;
    origin: WorkInput["origin"];
    data: unknown;
    rules: string;
    schema: z.ZodType<T>;
    policy: WorkflowPolicy;
  },
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  const stdin = JSON.stringify(input.data, (_key, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return value;
    const clean = sanitizeRawInput(value);
    if (clean.blocked) throw new Error("结构化判定输入清洗阻塞");
    return clean.text;
  });
  if (stdin.length > STRUCTURED_INPUT_LIMIT) throw new Error("结构化判定材料超量；需要缩小本次范围");
  const store = new WorkflowStore(root);
  const hash = digest(stdin);
  const job = await store.enqueue(
    {
      origin: input.origin,
      sources: [{ ref: input.kind, hash }],
      targets: [`decision-${hash}`],
      recipeHash: digest(JSON.stringify({ kind: input.kind, rules: input.rules, protocol: 1 })),
    },
    input.policy,
  );
  const file = `_jobs/decisions/${job.id}.json`;
  const read = () => {
    const bytes = readFileSync(localFile(root, `wiki/${file}`));
    if (job.artifacts?.[file] !== digest(bytes)) throw new Error("判定回执已变化");
    return input.schema.parse(JSON.parse(bytes.toString("utf8")));
  };
  if (job.state === "draft") return { jobId: job.id, value: read() };
  const attempt = await store.claim(job.id, deps.retry);
  const stage = mkdtempSync(join(tmpdir(), "wiki-decision-"));
  let costUsd: number | undefined = 0;
  try {
    const req = {
      id: job.input.targets[0]!,
      cwd: stage,
      args: restrictedArgs(input.rules, attempt.reservedUsd),
      stdin,
      timeoutMs: 60_000,
      allowedWrites: [],
    };
    mkdirSync(localFile(root, "wiki/_jobs/decisions"), { recursive: true });
    atomicText(
      localFile(root, `wiki/_jobs/decisions/${job.id}.${attempt.token}.input.json`),
      JSON.stringify({ rules: input.rules, stdin }),
    );
    costUsd = undefined;
    const batch = await runBatch([req], {
      concurrency: 1,
      runAgent: deps.runAgent ?? budgetedAgent(root, input.kind, runRestrictedClaude),
    });
    const result = batch.results[0]!;
    costUsd = result.costUsd;
    atomicText(
      localFile(root, `wiki/_jobs/decisions/${job.id}.${attempt.token}.output.json`),
      JSON.stringify(result),
    );
    if (!result.ok || costUsd === undefined) throw new Error(result.reason ?? "判定失败或费用未知");
    if (readdirSync(stage).length || !result.output || result.output.length > 128_000)
      throw new Error("判定越界或缺少有效输出");
    const value = input.schema.parse(parseStructuredJson(result.output));
    const text = JSON.stringify(value);
    const finished = await store.finish(
      job.id,
      attempt.token,
      { ok: true, costUsd, artifacts: { [file]: digest(text) } },
      () => atomicText(localFile(root, `wiki/${file}`), text),
    );
    if (finished.state !== "draft") throw new Error(finished.attempts.at(-1)?.reason ?? "判定未采纳");
    return { jobId: job.id, value };
  } catch (error) {
    if (store.get(job.id).state === "running")
      await store.finish(job.id, attempt.token, { ok: false, costUsd, reason: String(error) });
    throw error;
  } finally {
    if (existsSync(stage) && !lstatSync(stage).isSymbolicLink()) {
      const inside = relative(realpathSync(tmpdir()), realpathSync(stage));
      if (inside.startsWith("wiki-decision-") && !inside.includes(".."))
        rmSync(stage, { recursive: true, force: true });
    }
  }
}
