import type { DropBudget, DropRange, DropReceipt } from "../../src/content/wiki/drop";
import { inputByteLimit, jsonBytes, textChunks } from "./context-window";
import { digest } from "./workflow";

export type MaterialRequest = { id: string; hash?: string; start?: number; end?: number };
type Resource = DropReceipt["resources"][number];
export type Material = DropRange & { text: string; lineStart: number; lineEnd: number };

export function mergedRanges(ranges: { start: number; end: number }[]) {
  const merged: { start: number; end: number }[] = [];
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && last.end >= r.start) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

/** Drop-only immutable material registry. IDs are navigation; only input manifests prove provision. */
export class DropContext {
  private readonly entries = new Map<string, Resource & { text: string }>();
  readonly inputs: DropReceipt["inputs"] = [];
  onMaterial?: (resource: Resource, text: string) => void;
  constructor(readonly budget: DropBudget) {}

  add(path: string, kind: Resource["kind"], text: string, origins: Resource["origins"] = []) {
    const hash = digest(text);
    const id = `${kind}:${path}@${hash}`;
    const existing = this.entries.get(id);
    if (existing) {
      for (const origin of origins)
        if (!existing.origins.some((o) => JSON.stringify(o) === JSON.stringify(origin)))
          existing.origins.push(origin);
    } else {
      this.entries.set(id, { id, path, kind, hash, length: text.length, origins, text });
      this.onMaterial?.(this.resource(id), text);
    }
    return id;
  }
  resource(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`材料不存在：${id}`);
    const { text: _text, ...resource } = entry;
    return resource;
  }
  resources() {
    return [...this.entries.keys()].map((id) => this.resource(id));
  }
  range(request: MaterialRequest): DropRange {
    const r = this.resource(request.id);
    if (request.hash && request.hash !== r.hash) throw new Error("材料 hash 已过期");
    const start = request.start ?? 0;
    const end = request.end ?? r.length;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > r.length)
      throw new Error(`材料范围越界：${r.path}`);
    return { id: r.id, hash: r.hash, start, end };
  }
  text(request: MaterialRequest) {
    const range = this.range(request);
    return this.entries.get(range.id)!.text.slice(range.start, range.end);
  }
  chunks(id: string, bytes: number) {
    return textChunks(this.text({ id }), bytes).map(({ start, end }) => this.range({ id, start, end }));
  }
  quoteSupport(required: DropRange, provided: DropRange[], quotes: string[]) {
    const support = [required];
    for (const quote of quotes) {
      let found = false;
      for (const range of provided) {
        const text = this.text(range);
        const breaks = [...text.matchAll(/\r?\n[\t ]*\r?\n/g)];
        for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + quote.length)) {
          found = true;
          if (
            range.id === required.id &&
            range.start + at >= required.start &&
            range.start + at + quote.length <= required.end
          )
            continue;
          // Keep the whole surrounding paragraph, including unquoted qualifiers.
          // Every repeated match is retained: a shared phrase is not a version identity.
          const before = breaks.findLast((m) => m.index + m[0].length <= at);
          const after = breaks.find((m) => m.index >= at + quote.length);
          support.push(
            this.range({
              id: range.id,
              start: range.start + (before ? before.index + before[0].length : 0),
              end: range.start + (after?.index ?? text.length),
            }),
          );
        }
      }
      if (!found) throw new Error("摘录校验失败：模型摘录不能回指本次原文");
    }
    if (!quotes.some((quote) => this.text(required).includes(quote)))
      throw new Error("摘录校验失败：至少一项引文必须来自当前段");
    return this.pack(support).materials.map(({ id, hash, start, end }) => ({ id, hash, start, end }));
  }
  pack(requests: MaterialRequest[]) {
    let requestedBytes = 0;
    const groups = new Map<string, DropRange[]>();
    for (const request of requests) {
      const range = this.range(request);
      requestedBytes += Buffer.byteLength(this.text(range));
      const group = groups.get(range.id) ?? [];
      group.push(range);
      groups.set(range.id, group);
    }
    const materials: Material[] = [];
    for (const [id, ranges] of groups) {
      const full = this.entries.get(id)!.text;
      for (const span of mergedRanges(ranges)) {
        const range = this.range({ id, ...span });
        const text = this.text(range);
        const lineStart = full.slice(0, span.start).split("\n").length;
        const lineEnd = lineStart + (text.replace(/\n$/, "").match(/\n/g)?.length ?? 0);
        materials.push({ ...range, text, lineStart, lineEnd });
      }
    }
    return {
      materials,
      requestedBytes,
      savedBytes: requestedBytes - materials.reduce((n, m) => n + Buffer.byteLength(m.text), 0),
    };
  }
  limit(rules: string) {
    return Math.min(900000, inputByteLimit("", rules, this.budget));
  }
  record(
    stage: string,
    rules: string,
    data: { materials: Material[]; requestedBytes?: number; savedBytes?: number },
  ) {
    const bytes = jsonBytes(data);
    const limit = this.limit(rules);
    if (bytes > limit)
      throw new Error(`上下文预算不足：${stage} 输入 ${bytes} > ${limit} 字节；必要证据尚未核对`);
    for (const material of data.materials)
      if (material.hash !== this.resource(material.id).hash || material.text !== this.text(material))
        throw new Error("材料快照或范围不一致");
    const receipt: DropReceipt["inputs"][number] = {
      key: digest(JSON.stringify({ rules, data })),
      stage,
      rulesHash: digest(rules),
      bytes,
      limit,
      requestedBytes:
        data.requestedBytes ?? data.materials.reduce((n, m) => n + Buffer.byteLength(m.text), 0),
      savedBytes: data.savedBytes ?? 0,
      materials: data.materials.map(({ id, hash, start, end }) => ({ id, hash, start, end })),
    };
    this.inputs.push(receipt);
    return receipt;
  }
  complete(id: string) {
    const length = this.resource(id).length;
    if (!length) return true;
    const ranges = mergedRanges(this.inputs.flatMap((i) => i.materials.filter((m) => m.id === id)));
    return ranges.length === 1 && ranges[0]!.start === 0 && ranges[0]!.end === length;
  }
  covered(request: MaterialRequest) {
    const r = this.range(request);
    return mergedRanges(this.inputs.flatMap((i) => i.materials.filter((m) => m.id === r.id))).some(
      (m) => m.start <= r.start && m.end >= r.end,
    );
  }
  contains(input: DropReceipt["inputs"][number], request: MaterialRequest) {
    const r = this.range(request);
    return input.materials.some((m) => m.id === r.id && m.start <= r.start && m.end >= r.end);
  }
}

export function applyDropEdits(
  old: string,
  hash: string,
  edits: { start: number; end: number; old: string; text: string }[],
) {
  if (digest(old) !== hash) throw new Error("局部修订 hash 已过期");
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let position = 0;
  let previousStart = -1;
  let result = "";
  for (const edit of sorted) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0)
      throw new Error("局部修订范围无效");
    if (edit.start < position || edit.start === previousStart) throw new Error("局部修订范围重叠");
    if (edit.end < edit.start || edit.end > old.length || old.slice(edit.start, edit.end) !== edit.old)
      throw new Error("局部修订原文不匹配");
    if (
      [edit.start, edit.end].some(
        (offset) =>
          offset > 0 &&
          offset < old.length &&
          /[\uD800-\uDBFF]/.test(old[offset - 1]!) &&
          /[\uDC00-\uDFFF]/.test(old[offset]!),
      )
    )
      throw new Error("局部修订越过 Unicode 字符边界");
    result += old.slice(position, edit.start) + edit.text;
    position = edit.end;
    previousStart = edit.start;
  }
  return result + old.slice(position);
}
