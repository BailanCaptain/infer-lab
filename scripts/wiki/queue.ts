import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { z } from "zod";
import { localFile } from "./review-files";
import { atomicText, digest, WorkflowStore } from "./workflow";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const taskInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gap"), key: hash, cycle: z.number().int().positive().optional() }),
  z.object({
    kind: z.literal("pr"),
    repo: z.string(),
    number: z.number().int().positive(),
    sourceHash: hash,
  }),
  z.object({
    kind: z.literal("rewrite"),
    pageId: z.string(),
    revision: hash,
    source: z.string(),
    reason: z.string(),
  }),
]);
const taskSchema = z
  .object({
    id: hash,
    input: taskInputSchema,
    state: z.enum([
      "queued",
      "running",
      "needs-material",
      "needs-review",
      "awaiting-retest",
      "closed",
      "failed",
    ]),
    createdAt: z.string(),
    lease: z.object({ token: z.string().uuid(), pid: z.number().int().positive() }).optional(),
    attempts: z.number().int().nonnegative(),
    result: z.record(z.unknown()).optional(),
    reason: z.string().optional(),
  })
  .strict();
export type QueueTask = z.infer<typeof taskSchema>;
const pathOf = (root: string, id: string) => localFile(root, `wiki/_jobs/queue/${hash.parse(id)}.json`);
const save = (root: string, task: QueueTask) =>
  atomicText(pathOf(root, task.id), JSON.stringify(taskSchema.parse(task), null, 2));
export const readTask = (root: string, id: string) =>
  taskSchema.parse(JSON.parse(readFileSync(pathOf(root, id), "utf8")));
export function listTasks(root: string) {
  const dir = localFile(root, "wiki/_jobs/queue");
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
        .map((n) => readTask(root, n.slice(0, -5)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    : [];
}
/** Caller must hold the shared lock; used atomically with observations. Never starts a model. */
export function enqueueInLock(root: string, input: z.infer<typeof taskInputSchema>) {
  const value = taskInputSchema.parse(input);
  const id = digest(JSON.stringify(value));
  if (existsSync(pathOf(root, id))) return readTask(root, id);
  mkdirSync(localFile(root, "wiki/_jobs/queue"), { recursive: true });
  const task: QueueTask = {
    id,
    input: value,
    state: "queued",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  save(root, task);
  return task;
}
export const enqueueTask = (root: string, input: z.infer<typeof taskInputSchema>) =>
  new WorkflowStore(root).locked(() => enqueueInLock(root, input));
export async function runTask(
  root: string,
  id: string,
  execute: (task: QueueTask) => Promise<{
    state: Exclude<QueueTask["state"], "queued" | "running">;
    result?: Record<string, unknown>;
  }>,
  retry = false,
) {
  const store = new WorkflowStore(root);
  const task = await store.locked(() => {
    const task = readTask(root, id);
    if (task.state === "running" && task.lease) {
      try {
        process.kill(task.lease.pid, 0);
        throw new Error("队列任务正在运行");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
      }
      task.state = "failed";
      task.reason = "上次进程退出；先核对共享预算与模型回执";
      delete task.lease;
      save(root, task);
    }
    if (
      task.state !== "queued" &&
      !(retry && ["failed", "needs-material", "needs-review"].includes(task.state))
    )
      throw new Error("任务需要显式重试或人工审阅；不自动重复收费");
    task.state = "running";
    task.attempts++;
    task.lease = { token: randomUUID(), pid: process.pid };
    save(root, task);
    return task;
  });
  try {
    const output = await execute(task);
    return await store.locked(() => {
      const current = readTask(root, id);
      if (current.lease?.token !== task.lease?.token) throw new Error("队列租约已变化");
      const next = { ...current, ...output };
      delete next.lease;
      save(root, next);
      return next;
    });
  } catch (error) {
    await store.locked(() => {
      const current = readTask(root, id);
      if (current.lease?.token !== task.lease?.token) return;
      current.state = "failed";
      current.reason = String(error);
      delete current.lease;
      save(root, current);
    });
    throw error;
  }
}
