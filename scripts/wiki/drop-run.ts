import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { z } from "zod";
import type { DropBatch } from "../../src/content/wiki/drop";
import type { RunAgent } from "./batch";
import { readBatch, saveBatch } from "./drop-batch";
import { integrateDrop } from "./drop-integration";
import { restrictedArgs } from "./restricted-claude";
import { listReviews, rejectReview } from "./review";
import { localFile, replaceText, wikiContents } from "./review-files";
import { selectedAgent } from "./selected-agent";
import { PAGE_TEXT_TIMEOUT_MS, parseStructuredJson } from "./structured";
import { selectedModel } from "./sync-config";
import { atomicText, digest, WorkflowStore } from "./workflow";

const active = new Map<string, AbortController>();
export type DropRunnerDeps = {
  runAgent?: RunAgent;
  validate?: (root: string) => string[];
  testLimits?: { calls?: number };
};
export type DropAsk = <T>(stage: string, data: unknown, rules: string, schema: z.ZodType<T>) => Promise<T>;
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export async function cancelDrop(root: string, id: string) {
  const result = await new WorkflowStore(root).locked(() => {
    const b = readBatch(root, id);
    if (["published", "review", "rejected"].includes(b.state))
      throw new Error("已生成审阅，请在审阅中退回整组");
    b.state = b.state === "running" ? "cancelling" : "cancelled";
    b.stage = b.state === "cancelling" ? "等待当前调用停止" : "已取消";
    return saveBatch(root, b);
  });
  active.get(`${resolve(root)}:${id}`)?.abort();
  return result;
}

/** Returns a durable receipt immediately; all long work is independent of the HTTP connection. */
export async function startDrop(
  root: string,
  id: string,
  options: { retry?: boolean; feedback?: string; newAttempt?: boolean } = {},
  deps: DropRunnerDeps = {},
) {
  if (options.newAttempt) {
    const previous = readBatch(root, id);
    if (previous.reviewId) {
      const review = listReviews(root).find((r) => r.id === previous.reviewId);
      if (review?.state === "publishing") throw new Error("先恢复已开始的发布，不能生成竞争提案");
      if (review?.state === "pending") await rejectReview(root, review.id, "已明确重新整合，旧提案作废");
    }
  }
  const b = await new WorkflowStore(root).locked(() => {
    const b = readBatch(root, id);
    const prior = listReviews(root).find(
      (r) => r.payload.drop?.id === id && r.payload.drop.generation === b.generation,
    );
    if (prior && !options.newAttempt && !options.feedback && !(options.retry && prior.state === "rejected")) {
      b.reviewId = prior.id;
      b.state = prior.state === "publishing" ? "review" : prior.state === "pending" ? "review" : prior.state;
      return saveBatch(root, b);
    }
    if (["running", "cancelling"].includes(b.state) && b.ownerPid && alive(b.ownerPid)) return b;
    if (["review", "published", "archived"].includes(b.state) && !options.newAttempt) return b;
    if (!b.sources.length || b.issues.length) throw new Error("请先处理资料清单中的错误；不能遗漏资料启动");
    if (
      ["failed", "cancelled", "rejected", "needs-input"].includes(b.state) &&
      !options.retry &&
      !options.newAttempt
    )
      throw new Error("需要明确重试或修订");
    if (b.state === "rejected" && !options.feedback?.trim()) options.feedback = b.error;
    if (options.newAttempt || options.feedback) {
      b.generation++;
      b.feedback = options.feedback?.trim() ?? b.feedback;
      b.reviewId = undefined;
      b.question = undefined;
    }
    b.selection = options.newAttempt ? selectedModel(root) : (b.selection ?? selectedModel(root));
    b.state = "running";
    b.stage = "提取资料";
    b.error = undefined;
    b.ownerPid = process.pid;
    b.token = randomUUID();
    return saveBatch(root, b);
  });
  const key = `${resolve(root)}:${id}`;
  if (b.state !== "running" || active.has(key) || b.ownerPid !== process.pid)
    return { batch: b, done: Promise.resolve(b) };
  const controller = new AbortController();
  active.set(key, controller);
  const done = executeDrop(root, b, controller, deps).finally(() => active.delete(key));
  return { batch: b, done };
}

async function executeDrop(
  root: string,
  initial: DropBatch,
  controller: AbortController,
  deps: DropRunnerDeps,
) {
  const store = new WorkflowStore(root);
  const id = initial.id;
  const dir = localFile(root, `wiki/_jobs/drops/runs/${id}/${initial.generation}`);
  mkdirSync(dir, { recursive: true });
  const check = () => {
    const b = readBatch(root, id);
    if (b.token !== initial.token || b.state === "cancelling" || b.state === "cancelled") controller.abort();
    controller.signal.throwIfAborted();
    return b;
  };
  const timer = setInterval(() => {
    try {
      check();
    } catch {
      controller.abort();
    }
  }, 500);
  const stageRoot = mkdtempSync(join(tmpdir(), "wiki-drop-"));
  const stageRelative = relative(resolve(tmpdir()), resolve(stageRoot));
  if (!stageRelative.startsWith("wiki-drop-") || stageRelative.includes(".."))
    throw new Error("暂存路径越界");
  const update = async (fn: (b: DropBatch) => void) =>
    store.locked(() => {
      const b = readBatch(root, id);
      if (b.token !== initial.token) throw new Error("批次已被新尝试接管");
      fn(b);
      return saveBatch(root, b);
    });
  try {
    const baseFile = join(dir, "base.json");
    const base = await store.locked(() => {
      if (existsSync(baseFile)) return new Map<string, string>(JSON.parse(readFileSync(baseFile, "utf8")));
      const files = wikiContents(root);
      atomicText(baseFile, JSON.stringify([...files]));
      return files;
    });
    for (const [path, text] of base) replaceText(stageRoot, path, text);
    const repairsFile = join(dir, "repairs.json");
    const repairs = new Map<string, { repair: string; previousOutput?: unknown }>(
      existsSync(repairsFile) ? JSON.parse(readFileSync(repairsFile, "utf8")) : [],
    );
    let lastStage = "";
    const priorOutputs = new Map<string, unknown>();
    const ask: DropAsk = async (stage, data, rules, schema) => {
      check();
      lastStage = stage;
      const repair = repairs.get(stage);
      if (repair) data = { ...(data as object), ...repair };
      const stdin = JSON.stringify(data);
      // A single provider context is finite; no silent truncation or false completeness.
      if (Buffer.byteLength(stdin) > 900_000)
        throw new Error("单次上下文超过 900 KB，需拆分相关知识读取；未忽略任何资料");
      const hash = digest(JSON.stringify({ data, rules, selection: initial.selection }));
      const file = join(dir, `${hash}.json`);
      if (existsSync(file)) {
        const parsed = schema.parse(parseStructuredJson(readFileSync(file, "utf8")));
        priorOutputs.set(stage, parsed);
        return parsed;
      }
      const b = check();
      if (deps.testLimits?.calls !== undefined && b.calls.length >= deps.testLimits.calls)
        throw new Error("显式测试调用限额到达；保留进度，尚未验收");
      const callKey = randomUUID();
      await update((b) => {
        b.stage = stage;
        b.calls.push({ key: callKey, startedAt: new Date().toISOString() });
      });
      atomicText(join(dir, `${hash}.input.json`), JSON.stringify({ rules, data }));
      const result = await (deps.runAgent ?? selectedAgent(root, "drop"))({
        ...initial.selection,
        id: `drop-${id}`,
        cwd: stageRoot,
        allowedWrites: [],
        args: restrictedArgs(rules),
        stdin,
        accountingOnly: true,
        signal: controller.signal,
        timeoutMs: PAGE_TEXT_TIMEOUT_MS,
      });
      await update((b) => {
        const call = b.calls.find((c) => c.key === callKey)!;
        call.finishedAt = new Date().toISOString();
        call.costUsd = result.costUsd;
        call.usage = result.usage as Record<string, number> | undefined;
        call.error = result.reason;
      });
      atomicText(join(dir, `${hash}.output.json`), JSON.stringify(result));
      check();
      if (!result.ok || !result.output) throw new Error(result.reason ?? "模型未返回完整结果");
      let parsed: z.output<typeof schema>;
      try {
        parsed = schema.parse(parseStructuredJson(result.output));
      } catch (error) {
        priorOutputs.set(stage, result.output);
        throw new Error(`模型输出协议校验失败：${String(error)}`);
      }
      priorOutputs.set(stage, parsed);
      atomicText(file, JSON.stringify(parsed));
      return parsed;
    };
    const seenFailures = new Set<string>();
    let result: Awaited<ReturnType<typeof integrateDrop>>;
    for (;;) {
      try {
        result = await integrateDrop(root, stageRoot, initial, base, ask, controller.signal, deps);
        break;
      } catch (error) {
        check();
        const message = String(error);
        if (
          !/校验失败|复核未通过|图布局|图规格|页面或来源|提案页身份|未读全文|旧页修订|补充修订|旧说法|替代结论|修订分类/.test(
            message,
          ) ||
          seenFailures.has(`${lastStage}:${message}`)
        )
          throw error;
        seenFailures.add(`${lastStage}:${message}`);
        repairs.set(lastStage, { repair: message, previousOutput: priorOutputs.get(lastStage) });
        if (
          (message.includes("共享图") && message.includes("使用方未读全")) ||
          message.startsWith("Error: 完整性复核未通过")
        ) {
          const stage = "查找相关知识与补证";
          repairs.set(stage, { repair: message, previousOutput: priorOutputs.get(stage) });
        }
        if (message.startsWith("Error: 完整性复核未通过") || message.startsWith("Error: 整合校验失败"))
          for (const [stage, previousOutput] of priorOutputs)
            if (stage.startsWith("整合：")) repairs.set(stage, { repair: message, previousOutput });
        atomicText(repairsFile, JSON.stringify([...repairs]));
        await update((b) => {
          b.stage = "根据校验结果自动修订";
          b.error = message;
        });
        for (const [path] of wikiContents(stageRoot))
          if (!base.has(path) && !path.startsWith("wiki/raw/")) replaceText(stageRoot, path, null);
        for (const [path, text] of base) replaceText(stageRoot, path, text);
      }
    }
    check();
    return await update((b) => {
      b.report = result.report;
      b.error = undefined;
      b.question = result.question;
      b.state = result.question ? "needs-input" : result.reviewId ? "review" : "archived";
      b.reviewId = result.reviewId;
      if (result.reviewId && !b.reviews.includes(result.reviewId)) b.reviews.push(result.reviewId);
      b.stage = result.question ? "等待关键条件补充" : result.reviewId ? "整组变更待审" : "无需发布";
    });
  } catch (error) {
    const created = listReviews(root).filter(
      (r) =>
        r.payload.drop?.id === id &&
        r.payload.drop.generation === initial.generation &&
        r.state === "pending",
    );
    if (controller.signal.aborted)
      for (const r of created) await rejectReview(root, r.id, "批次已取消，禁止发布迟到结果");
    return await update((b) => {
      b.state = controller.signal.aborted ? "cancelled" : "failed";
      b.error = String(error);
      b.stage = controller.signal.aborted ? "已取消" : "保留进度，可重试";
    });
  } finally {
    clearInterval(timer);
    rmSync(stageRoot, { recursive: true, force: true });
  }
}
