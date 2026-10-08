import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type DropBatch,
  type DropItem,
  type DropSource,
  dropBatchSchema,
  dropInputSchema,
  dropItemSchema,
} from "../../src/content/wiki/drop";
import { detectDropChain } from "./drop-chain";
import { fetchDrop } from "./drop-fetch";
import { readRawSnapshot, saveRawSnapshot } from "./raw";
import { readReview } from "./review";
import { localFile } from "./review-files";
import { sanitizeRawInput } from "./sanitize";
import { atomicText, digest, WorkflowStore } from "./workflow";

const pathOf = (root: string, id: string) =>
  localFile(root, `wiki/_jobs/drops/batches/${dropBatchSchema.shape.id.parse(id)}.json`);
export function saveBatch(root: string, batch: DropBatch) {
  batch.updatedAt = new Date().toISOString();
  mkdirSync(join(root, "wiki/_jobs/drops/batches"), { recursive: true });
  atomicText(pathOf(root, batch.id), JSON.stringify(dropBatchSchema.parse(batch), null, 2));
  return batch;
}
export function readBatch(root: string, id: string): DropBatch {
  const b = dropBatchSchema.parse(JSON.parse(readFileSync(pathOf(root, id), "utf8")));
  if (b.id !== id) throw new Error("批次身份不匹配");
  if (["running", "cancelling"].includes(b.state)) {
    let alive = false;
    if (b.ownerPid) {
      try {
        process.kill(b.ownerPid, 0);
        alive = true;
      } catch (e) {
        alive = (e as NodeJS.ErrnoException).code !== "ESRCH";
      }
    }
    if (!alive) {
      b.state = b.state === "cancelling" ? "cancelled" : "failed";
      b.stage = "处理进程已退出，可恢复已保存进度";
      b.error = "进程中断；未收到的调用用量仍记为未知，不重复发布";
    }
  }
  if (b.reviewId) {
    const r = readReview(root, b.reviewId);
    if (r.state === "published" || r.state === "rejected") {
      b.state = r.state;
      b.error = r.reason;
    }
  }
  return b;
}
export function listBatches(root: string): DropBatch[] {
  const dir = localFile(root, "wiki/_jobs/drops/batches");
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((p) => p.endsWith(".json"))
        .map((p) => readBatch(root, p.slice(0, -5)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
}
export async function prepareDropItem(
  root: string,
  item: DropItem,
  index: number,
  signal?: AbortSignal,
): Promise<DropSource> {
  const fetched = item.url
    ? await fetchDrop(item.url, signal)
    : {
        original: item.text!,
        text: item.text!,
        parser: "utf8-text-v1",
        omissions: [] as string[],
        url: undefined,
      };
  if (!item.url && !/\.(md|txt|rst|json|csv)$/i.test(item.name))
    throw new Error("仅支持 MD/TXT 等普通文本；PDF、Word、图片尚未支持");
  if (fetched.original.includes("\uFFFD")) throw new Error("资料包含无效 UTF-8 字符，请重新导出文本");
  const clean = sanitizeRawInput(fetched.text);
  if (clean.blocked) throw new Error(`资料隔离：${clean.findings.map((f) => f.reason).join("、")}`);
  const raw = saveRawSnapshot(join(root, "wiki"), fetched.original);
  const parsed = saveRawSnapshot(join(root, "wiki"), clean.text);
  const identity = item.identity ?? (item.url ? new URL(item.url).href : undefined);
  const sourceId = digest(identity ?? `unknown:${digest(fetched.original)}`);
  return {
    item: index,
    name: item.name,
    sourceId,
    identity,
    version: item.version,
    raw,
    parsed,
    url: fetched.url,
    revision: digest(JSON.stringify({ sourceId, raw, version: item.version })),
    receivedAt: new Date().toISOString(),
    parser: fetched.parser,
    omissions: [
      ...fetched.omissions,
      ...(/!\[[^\]]*\]\(|\[[^\]]+\]\([^\s)]+\.(?:pdf|docx?|xlsx?|zip)(?:[?#][^)]*)?\)/i.test(fetched.text)
        ? ["原文包含图像或附件链接，未解析其内容"]
        : []),
      ...clean.findings.map((f) => `清洗：${f.reason}；文本行号对应解析快照`),
    ],
  };
}
async function prepare(root: string, items: DropItem[], start = 0) {
  const sources: DropSource[] = [];
  const issues: DropBatch["issues"] = [];
  for (const [i, item] of items.entries()) {
    try {
      sources.push(await prepareDropItem(root, item, start + i));
    } catch (error) {
      issues.push({ item: start + i, name: item.name, reason: String(error) });
    }
  }
  return { sources: uniqueSources(sources), issues };
}
function uniqueSources(sources: DropSource[]) {
  const unique = new Map<string, DropSource>();
  for (const source of sources) {
    const existing = unique.get(source.revision);
    if (existing)
      existing.omissions = [...new Set([...existing.omissions, `本批重复资料已合并：${source.name}`])];
    else unique.set(source.revision, source);
  }
  return [...unique.values()];
}
const fingerprint = (b: Pick<DropBatch, "sources" | "why" | "series" | "previous">) =>
  digest(
    JSON.stringify({
      revisions: b.sources.map((s) => s.revision).sort(),
      why: b.why,
      series: b.series,
      previous: b.previous,
    }),
  );
function isolateChains(root: string, materials: { sources: DropSource[]; issues: DropBatch["issues"] }) {
  const records = listBatches(root).flatMap((b) => b.sources);
  const entry = (s: DropSource) => ({
    id: s.revision,
    source: s.sourceId,
    receivedAt: s.receivedAt,
    text: readRawSnapshot(join(root, "wiki"), s.parsed),
  });
  for (const s of [...materials.sources]) {
    const flags = detectDropChain(entry(s), [...records, ...materials.sources].map(entry)).filter(
      (f) => f !== "same-source-overlap",
    );
    if (flags.length) {
      materials.issues.push({
        item: s.item,
        name: s.name,
        reason: `资料隔离：跨次操作指令 ${flags.join("、")}；原文保留 ${s.raw}`,
      });
      materials.sources = materials.sources.filter((v) => v !== s);
    }
  }
}
export async function acceptBatch(root: string, value: unknown): Promise<DropBatch> {
  const input = dropInputSchema.parse(value);
  const why = input.why.trim();
  if (why && sanitizeRawInput(why).blocked) throw new Error("收录理由清洗阻塞");
  const keyPath = localFile(root, `wiki/_jobs/drops/requests/${digest(input.key)}.json`);
  const requestHash = digest(JSON.stringify(input));
  const prior = () => {
    if (!existsSync(keyPath)) return;
    const r = JSON.parse(readFileSync(keyPath, "utf8"));
    if (r.hash !== requestHash) throw new Error("幂等键已用于不同资料");
    return readBatch(root, r.id);
  };
  const existing = prior();
  if (existing) return existing;
  const materials = await prepare(root, input.items);
  return new WorkflowStore(root).locked(() => {
    const raced = prior();
    if (raced) return raced;
    isolateChains(root, materials);
    if (input.previous) {
      const prior = readBatch(root, input.previous);
      if ((prior.series ?? prior.id) !== input.series) throw new Error("续传必须关联同一系列");
    }
    const now = new Date().toISOString();
    const next = dropBatchSchema.parse({
      schemaVersion: 2,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      why,
      series: input.series,
      previous: input.previous,
      ...materials,
      fingerprint: "",
      state: "collecting",
      stage: "预检完成",
    });
    next.fingerprint = fingerprint(next);
    const duplicate =
      !input.reintegrate && !next.issues.length
        ? listBatches(root).find((b) => b.fingerprint === next.fingerprint && !b.issues.length)
        : undefined;
    const result = duplicate ?? saveBatch(root, next);
    mkdirSync(join(root, "wiki/_jobs/drops/requests"), { recursive: true });
    atomicText(keyPath, JSON.stringify({ hash: requestHash, id: result.id }));
    return result;
  });
}
export async function editBatch(root: string, id: string, input: { remove?: number[]; items?: DropItem[] }) {
  const items = (input.items ?? []).map((i) => dropItemSchema.parse(i));
  const initial = readBatch(root, id);
  if (initial.state !== "collecting") throw new Error("本批资料已冻结；请续传到新批次");
  const start = Math.max(-1, ...initial.sources.map((s) => s.item), ...initial.issues.map((s) => s.item)) + 1;
  const prepared = await prepare(root, items, start);
  return new WorkflowStore(root).locked(() => {
    const b = readBatch(root, id);
    if (b.state !== "collecting" || b.updatedAt !== initial.updatedAt)
      throw new Error("批次已改变，请刷新后重试");
    isolateChains(root, prepared);
    b.sources = uniqueSources([
      ...b.sources.filter((s) => !input.remove?.includes(s.item)),
      ...prepared.sources,
    ]);
    b.issues = [...b.issues.filter((s) => !input.remove?.includes(s.item)), ...prepared.issues];
    b.fingerprint = fingerprint(b);
    return saveBatch(root, b);
  });
}
