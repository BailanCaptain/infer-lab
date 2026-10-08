import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { z } from "zod";
import { sourceLines } from "./audit";
import type { RunAgent } from "./batch";
import { COMPILE_TIMEOUT_MS, compileRaw } from "./compile-raw";
import { prepareDraftReview } from "./draft-review";
import { detectDropChain } from "./drop-chain";
import { loadHandbook } from "./handbook";
import { readRawSnapshot, saveRawSnapshot } from "./raw";
import { localFile } from "./review-files";
import { sanitizeRawInput } from "./sanitize";
import { selectedAgent } from "./selected-agent";
import { atomicText, digest, WorkflowStore } from "./workflow";
import { type WorkflowPolicy, workflowPolicySchema } from "./workflow-policy";

export { detectDropChain } from "./drop-chain";

const recordSchema = z.object({
  id: z.string(),
  source: z.string(),
  raw: z.string(),
  why: z.string(),
  receivedAt: z.string(),
  state: z.enum(["ready", "quarantined", "draft", "failed"]),
  flags: z.array(z.string()),
  jobId: z.string().optional(),
  reviewId: z.string().optional(),
  reason: z.string().optional(),
});

export async function acceptDrop(
  root: string,
  file: string,
  input: { why?: string; policy: WorkflowPolicy },
  deps: { runAgent?: RunAgent; retry?: boolean; now?: string } = {},
) {
  workflowPolicySchema.parse(input.policy);
  if (
    lstatSync(file).isSymbolicLink() ||
    !lstatSync(file).isFile() ||
    ![".md", ".txt", ".rst", ".json", ".csv"].includes(extname(file).toLowerCase())
  )
    throw new Error("投喂只接受普通文本文件，不接受符号链接或二进制");
  if (lstatSync(file).size > 1024 * 1024) throw new Error("投喂文件超过 1 MiB");
  const original = readFileSync(file, "utf8");
  const cleaned = sanitizeRawInput(original);
  const why = input.why?.trim() ? sanitizeRawInput(input.why) : { blocked: false, text: "" };
  if (why.blocked) throw new Error("投喂理由清洗阻塞");
  const source = basename(file);
  const id = `drop-${digest(JSON.stringify({ source, hash: digest(original) }))}`;
  const store = new WorkflowStore(root);
  const path = localFile(root, `wiki/_jobs/drops/${id}.json`);
  const record = await store.locked(() => {
    if (existsSync(path)) return recordSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    const raw = saveRawSnapshot(join(root, "wiki"), original);
    const receivedAt = deps.now ?? new Date().toISOString();
    const dir = localFile(root, "wiki/_jobs/drops");
    mkdirSync(dir, { recursive: true });
    const history = readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => recordSchema.parse(JSON.parse(readFileSync(join(dir, name), "utf8"))))
      .map((r) => ({ ...r, text: sanitizeRawInput(readRawSnapshot(join(root, "wiki"), r.raw)).text }));
    const flags = cleaned.blocked
      ? ["input-blocked"]
      : detectDropChain({ id, source, receivedAt, text: cleaned.text }, history);
    const next = recordSchema.parse({
      id,
      source,
      raw,
      why: why.text,
      receivedAt,
      state: flags.length ? "quarantined" : "ready",
      flags,
    });
    if (flags.length) {
      const quarantine = localFile(root, "wiki/_drafts/_quarantine");
      mkdirSync(quarantine, { recursive: true });
      atomicText(join(quarantine, `${id}.json`), JSON.stringify(next, null, 2));
      const warnings = localFile(root, "wiki/warnings");
      mkdirSync(warnings, { recursive: true });
      atomicText(
        join(warnings, `${id}.md`),
        `# 投喂隔离\n\n${id} · chained_suspect\n\n原因：${flags.join("、")}。原文快照 ${raw}；未启动模型、未生成可批准草稿。\n`,
      );
    }
    atomicText(path, JSON.stringify(next, null, 2));
    return next;
  });
  if (record.state === "quarantined") return record;
  if (record.reviewId) return record;
  const ref = `raw:${record.raw.slice(4)}#L1-L${sourceLines(original).length}`;
  const result = await compileRaw(
    store,
    {
      id,
      source: ref,
      origin: "drop",
      rules:
        loadHandbook(join(root, "wiki")).pageFormat +
        "\n将投喂文本编译为 source 页面；仅本地材料不能升为源码实证 C。",
      timeoutMs: COMPILE_TIMEOUT_MS,
      context: { why: record.why, sourceId: record.source },
    },
    input.policy,
    { runAgent: deps.runAgent ?? selectedAgent(root, "drop"), retry: deps.retry },
  );
  const review = result.ok ? await prepareDraftReview(root, id, input.policy, deps) : undefined;
  return store.locked(() => {
    const next = {
      ...record,
      state: result.ok ? ("draft" as const) : ("failed" as const),
      jobId: result.jobId,
      reviewId: review?.reviewId,
      reason: result.reason,
    };
    atomicText(path, JSON.stringify(next, null, 2));
    return next;
  });
}

export function dropFiles(path: string, limit = 10): string[] {
  const target = resolve(path);
  if (lstatSync(target).isSymbolicLink()) throw new Error("投喂路径不接受符号链接");
  const files: string[] = [];
  const visit = (file: string) => {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("投喂目录含符号链接");
    if (stat.isDirectory()) for (const name of readdirSync(file).sort()) visit(join(file, name));
    else {
      files.push(file);
      if (files.length > limit) throw new Error(`本次超过 ${limit} 个文件；请缩小目录范围`);
    }
  };
  visit(target);
  return files;
}
