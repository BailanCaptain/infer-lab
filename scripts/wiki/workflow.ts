import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ID_RE, PAGE_ORIGINS } from "../../src/content/wiki/schema";
import { parsePage } from "./pages";
import { type Screening, screeningSchema } from "./screening";
import { type WorkflowPolicy, workflowPolicySchema } from "./workflow-policy";

export const originSchema = z.enum(PAGE_ORIGINS);
const inputSchema = z.object({
  origin: originSchema,
  sources: z.array(z.object({ ref: z.string().min(1), hash: z.string().min(1) })).min(1),
  targets: z.array(z.string().regex(ID_RE)).min(1),
  recipeHash: z.string().min(1),
});
export type WorkInput = z.infer<typeof inputSchema>;
const attemptSchema = z.object({
  token: z.string().uuid(),
  ownerPid: z.number().int().positive(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  reservedUsd: z.number().finite().positive(),
  costUsd: z.number().finite().nonnegative().optional(),
  state: z.enum(["running", "draft", "failed"]),
  reason: z.string().optional(),
});
export const jobSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-f0-9]{64}$/),
  input: inputSchema.omit({ origin: true }),
  origins: z.array(originSchema),
  state: z.enum(["queued", "running", "draft", "failed", "integrated", "blocked"]),
  screening: screeningSchema.optional(),
  policy: workflowPolicySchema,
  attempts: z.array(attemptSchema),
  artifacts: z.record(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof jobSchema>;
export const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export function workIdentity(value: WorkInput) {
  const parsed = inputSchema.parse(value);
  const sources = [...new Map(parsed.sources.map((s) => [JSON.stringify(s), s])).values()].sort(
    (a, b) => a.ref.localeCompare(b.ref) || a.hash.localeCompare(b.hash),
  );
  const input = { sources, targets: [...new Set(parsed.targets)].sort(), recipeHash: parsed.recipeHash };
  return { input, id: digest(JSON.stringify(input)) };
}

export function atomicText(path: string, text: string): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(temp, "wx");
    try {
      writeFileSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

/** Short JSON transactions only. Agent work must always happen outside locked(). */
export class WorkflowStore {
  readonly jobsDir: string;
  readonly runtimeDir: string;
  private readonly pid: number;
  private readonly isAlive: (pid: number) => boolean;
  constructor(
    readonly root: string,
    deps: { pid?: number; isAlive?: (pid: number) => boolean } = {},
  ) {
    this.jobsDir = join(root, "wiki/_jobs");
    this.runtimeDir = join(root, "tools/wiki-runtime");
    this.pid = deps.pid ?? process.pid;
    this.isAlive = deps.isAlive ?? alive;
  }
  private file(id: string): string {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("非法工作 id");
    return join(this.jobsDir, `${id}.json`);
  }
  get(id: string): Job {
    const job = jobSchema.parse(JSON.parse(readFileSync(this.file(id), "utf8")));
    if (job.id !== id) throw new Error("工作记录 id 与文件不一致");
    return job;
  }
  list(): Job[] {
    if (!existsSync(this.jobsDir)) return [];
    return readdirSync(this.jobsDir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => this.get(name.slice(0, -5)));
  }
  private save(job: Job): Job {
    job.updatedAt = new Date().toISOString();
    const checked = jobSchema.parse(job);
    atomicText(this.file(job.id), `${JSON.stringify(checked, null, 2)}\n`);
    return checked;
  }
  /** Explicit crash recovery only. Serialize recovery callers; never remove a live owner's lock. */
  recoverLock(): void {
    mkdirSync(this.runtimeDir, { recursive: true });
    const guard = join(this.runtimeDir, "workflow-recovery.lock");
    const fd = openSync(guard, "wx");
    try {
      const path = join(this.runtimeDir, "workflow.lock");
      if (!existsSync(path)) return;
      const text = readFileSync(path, "utf8");
      const owner = z.object({ pid: z.number().int().positive(), at: z.string() }).parse(JSON.parse(text));
      if (this.isAlive(owner.pid)) throw new Error(`持锁进程 ${owner.pid} 仍存活，拒绝清理`);
      if (readFileSync(path, "utf8") !== text) throw new Error("锁记录已变化，拒绝清理");
      rmSync(path);
    } finally {
      closeSync(fd);
      rmSync(guard, { force: true });
    }
  }
  async locked<T>(fn: () => T): Promise<T> {
    mkdirSync(this.runtimeDir, { recursive: true });
    mkdirSync(this.jobsDir, { recursive: true });
    const path = join(this.runtimeDir, "workflow.lock");
    let fd: number | undefined;
    for (let tries = 0; fd === undefined; tries++) {
      try {
        fd = openSync(path, "wx");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (tries >= 50)
          throw new Error(`工作状态锁被占用：${path}；若持锁进程已退出，先核对锁记录再清理，不自动抢锁`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    try {
      writeFileSync(fd, JSON.stringify({ pid: this.pid, at: new Date().toISOString() }));
      return fn();
    } finally {
      closeSync(fd);
      rmSync(path, { force: true });
    }
  }
  async enqueue(value: WorkInput, limits: WorkflowPolicy, screening?: Screening): Promise<Job> {
    const parsed = inputSchema.parse(value);
    const policy = workflowPolicySchema.parse(limits);
    const checkedScreening = screening === undefined ? undefined : screeningSchema.parse(screening);
    if (
      checkedScreening &&
      !parsed.sources.some((s) => s.ref === checkedScreening.source && s.hash === checkedScreening.rawHash)
    )
      throw new Error("清洗记录与任务来源不一致");
    const { input, id } = workIdentity(parsed);
    return this.locked(() => {
      if (existsSync(this.file(id))) {
        const job = this.get(id);
        if (JSON.stringify(job.screening) !== JSON.stringify(checkedScreening))
          throw new Error("相同任务的清洗记录不一致");
        // 已完成的任务不会再产生费用，换个预算来复用它的回执也无妨（2026-09-23：诊断由 wiki:work assess
        // 用另一套预算跑完后，夜间任务复用同一份诊断被这里拦住）；未完成的仍不许改预算
        const finished = job.state === "draft" || job.state === "integrated";
        if (!finished && JSON.stringify(job.policy) !== JSON.stringify(policy))
          throw new Error("已有任务预算不能通过重新提交修改或清零");
        job.origins = [...new Set([...job.origins, parsed.origin])].sort();
        return this.save(job);
      }
      const now = new Date().toISOString();
      return this.save({
        schemaVersion: 1,
        id,
        input,
        origins: [parsed.origin],
        state: checkedScreening?.blocked ? "blocked" : "queued",
        screening: checkedScreening,
        policy,
        attempts: [],
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  async claim(id: string, retry = false) {
    return this.locked(() => {
      const job = this.get(id);
      if (job.state === "failed" && !retry) throw new Error("失败任务需要显式重试");
      if (!["queued", "failed"].includes(job.state)) throw new Error(`任务状态 ${job.state} 不可领取`);
      if (
        this.list().some(
          (other) =>
            other.id !== id &&
            other.state === "running" &&
            other.input.targets.some((target) => job.input.targets.includes(target)),
        )
      )
        throw new Error("另一个任务正在处理相同目标");
      if (job.attempts.length >= job.policy.maxAttempts) throw new Error("已达到尝试次数上限");
      const charged = job.attempts.reduce(
        (sum, attempt) => sum + (attempt.costUsd ?? attempt.reservedUsd),
        0,
      );
      if (charged + job.policy.reserveUsd > job.policy.maxCostUsd + 1e-9)
        throw new Error("剩余预算不足；未知费用仍保留预留额度");
      const attempt = {
        token: randomUUID(),
        ownerPid: this.pid,
        startedAt: new Date().toISOString(),
        reservedUsd: job.policy.reserveUsd,
        state: "running" as const,
      };
      job.attempts.push(attempt);
      job.state = "running";
      this.save(job);
      return attempt;
    });
  }
  async finish(
    id: string,
    token: string,
    result: { ok: boolean; costUsd?: number; reason?: string; artifacts?: Record<string, string> },
    publish?: () => void,
  ): Promise<Job> {
    return this.locked(() => {
      const job = this.get(id);
      const attempt = job.attempts.at(-1);
      if (job.state !== "running" || !attempt || attempt.token !== token)
        throw new Error("过期 attempt，拒绝回写");
      const cost = result.costUsd;
      if (cost !== undefined && Number.isFinite(cost) && cost >= 0) attempt.costUsd = cost;
      let reason = result.ok ? undefined : (result.reason ?? "执行失败");
      if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) reason = "费用非法，实际消耗待核对";
      if (cost !== undefined && cost > attempt.reservedUsd)
        reason = ["单次实际消耗超过预留额度，停止发布", reason].filter(Boolean).join("；");
      if (!reason) {
        try {
          publish?.();
        } catch (error) {
          reason = String(error);
        }
      }
      attempt.state = reason ? "failed" : "draft";
      attempt.reason = reason;
      attempt.finishedAt = new Date().toISOString();
      job.state = attempt.state;
      if (!reason) job.artifacts = result.artifacts;
      return this.save(job);
    });
  }
  async recover(): Promise<string[]> {
    return this.locked(() => {
      const recovered: string[] = [];
      for (const job of this.list()) {
        const attempt = job.attempts.at(-1);
        if (job.state !== "running" || !attempt || this.isAlive(attempt.ownerPid)) continue;
        attempt.state = "failed";
        attempt.reason = "持有进程已退出；中断任务需显式重试，费用保留预留额";
        attempt.finishedAt = new Date().toISOString();
        job.state = "failed";
        this.save(job);
        recovered.push(job.id);
      }
      return recovered;
    });
  }
  /** Existing CLI integration may consume legacy drafts without jobs; tracked drafts must match their receipt. */
  matchesDraft(job: Job, target: string): boolean {
    const artifacts = job.artifacts ?? {};
    const draft = `_drafts/${target}.md`;
    const raw = Object.keys(artifacts).filter((path) => /^raw\/[a-z0-9-]+\.md$/.test(path));
    if (!artifacts[draft] || !raw.length) return false;
    for (const [path, hash] of Object.entries(artifacts)) {
      if (path !== draft && !raw.includes(path)) return false;
      const full = join(this.root, "wiki", path);
      if (!existsSync(full) || digest(readFileSync(full)) !== hash) return false;
    }
    const parsed = parsePage(draft, readFileSync(join(this.root, "wiki", draft), "utf8"));
    if (!parsed.page || parsed.problems.length) return false;
    const declared = parsed.page.fm.rawSources ?? [`raw/${target}.md`];
    return declared.length === raw.length && declared.every((path) => raw.includes(path));
  }
  verifyDrafts(targets: string[]): string[] {
    const jobs = this.list();
    const selected: string[] = [];
    for (const target of targets) {
      const candidates = jobs.filter((job) => job.input.targets.includes(target));
      if (!candidates.length) continue;
      if (candidates.some((job) => job.state === "running"))
        throw new Error(`${target} 仍有运行中的任务，不能整合`);
      const matches = candidates.filter((job) => job.state === "draft" && this.matchesDraft(job, target));
      if (!matches.length) throw new Error(`${target} 没有匹配的成功草稿记录，拒绝整合`);
      selected.push(...matches.map((job) => job.id));
    }
    return selected;
  }
  async recordIntegrated(ids: string[]): Promise<void> {
    await this.locked(() => {
      const jobs = ids.map((id) => this.get(id));
      if (jobs.some((job) => !["draft", "integrated"].includes(job.state)))
        throw new Error("整合任务状态已改变，需复核发布结果");
      for (const job of jobs) {
        job.state = "integrated";
        this.save(job);
      }
    });
  }
}
