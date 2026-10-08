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
import { restrictedArgs } from "./restricted-claude";
import { localFile } from "./review-files";
import { sanitizeRawInput } from "./sanitize";
import { selectedAgent } from "./selected-agent";
import type { selectedModel } from "./sync-config";
import { atomicText, digest, WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

export const STRUCTURED_INPUT_LIMIT = 40_000;
/** 只回一小段 JSON 的判定 */
export const DECISION_TIMEOUT_MS = 60_000;
/**
 * 要读或写整页正文的调用（整合、交叉审视、衰减重提取、补料判定、参数正文）。写死 60 秒时，
 * 产品路径上唯一一次真实整合超时（2026-09-16），唯一成功的一次是在 300 秒下跑的。
 */
export const PAGE_TEXT_TIMEOUT_MS = 300_000;

/**
 * 模型有时把整段输出包在一层 ```lang 围栏里；围栏只是包装，不是内容。只在整段都在一层围栏内时剥掉它，
 * 正文里自己的代码块不受影响。2026-09-23 真实重编就因为整页被包进 ```markdown，frontmatter 没被识别。
 */
export function unfence(text: string): string {
  const fenced = /^\s*```[\w-]*\r?\n([\s\S]*)```\s*$/.exec(text);
  return fenced ? fenced[1]! : text;
}

/** Normalize a single transport envelope; schema and evidence checks still follow. */
export function parseStructuredJson(text: string): unknown {
  return JSON.parse(unfence(text));
}

/** One tool-free, durable JSON decision. Machine validation never substitutes for evidence review. */
export async function runStructured<T>(
  root: string,
  input: {
    kind: string;
    /** Trusted call sites reading whole pages can request a larger bounded input. */
    maxInputChars?: number;
    origin: WorkInput["origin"];
    data: unknown;
    rules: string;
    schema: z.ZodType<T>;
    policy: WorkflowPolicy;
    /** 默认 DECISION_TIMEOUT_MS；读写整页正文的调用传 PAGE_TEXT_TIMEOUT_MS */
    timeoutMs?: number;
    selection?: ReturnType<typeof selectedModel>;
  },
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  const stdin = JSON.stringify(input.data, (_key, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return value;
    const clean = sanitizeRawInput(value);
    if (clean.blocked) throw new Error("结构化判定输入清洗阻塞");
    return clean.text;
  });
  if (stdin.length > (input.maxInputChars ?? STRUCTURED_INPUT_LIMIT))
    throw new Error("结构化判定材料超量；需要缩小本次范围");
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
  const attempt = await store.claim(job.id, deps.retry, input.selection);
  const stage = mkdtempSync(join(tmpdir(), "wiki-decision-"));
  let costUsd: number | undefined = 0;
  let billing: "chatgpt" | undefined;
  let usage: Record<string, number | undefined> | undefined;
  try {
    const req = {
      ...attempt.selection,
      id: job.input.targets[0]!,
      cwd: stage,
      args: restrictedArgs(input.rules, attempt.reservedUsd || input.policy.reserveUsd),
      stdin,
      timeoutMs: input.timeoutMs ?? DECISION_TIMEOUT_MS,
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
      runAgent: deps.runAgent ?? selectedAgent(root, input.kind),
    });
    const result = batch.results[0]!;
    costUsd = result.costUsd;
    billing = result.billing;
    usage = result.usage;
    atomicText(
      localFile(root, `wiki/_jobs/decisions/${job.id}.${attempt.token}.output.json`),
      JSON.stringify(result),
    );
    if (!result.ok || (costUsd === undefined && billing !== "chatgpt"))
      throw new Error(result.reason ?? "判定失败或费用未知");
    if (readdirSync(stage).length || !result.output || result.output.length > 128_000)
      throw new Error("判定越界或缺少有效输出");
    const value = input.schema.parse(parseStructuredJson(result.output));
    const text = JSON.stringify(value);
    const finished = await store.finish(
      job.id,
      attempt.token,
      { ok: true, costUsd, billing, usage, artifacts: { [file]: digest(text) } },
      () => atomicText(localFile(root, `wiki/${file}`), text),
    );
    if (finished.state !== "draft") throw new Error(finished.attempts.at(-1)?.reason ?? "判定未采纳");
    return { jobId: job.id, value };
  } catch (error) {
    if (store.get(job.id).state === "running")
      await store.finish(job.id, attempt.token, {
        ok: false,
        costUsd,
        billing,
        usage,
        reason: String(error),
      });
    throw error;
  } finally {
    if (existsSync(stage) && !lstatSync(stage).isSymbolicLink()) {
      const inside = relative(realpathSync(tmpdir()), realpathSync(stage));
      if (inside.startsWith("wiki-decision-") && !inside.includes(".."))
        rmSync(stage, { recursive: true, force: true });
    }
  }
}
