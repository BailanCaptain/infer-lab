import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { z } from "zod";
import {
  type DropRange,
  type DropReceipt,
  dropBatchSchema,
  type dropReviewSchema,
  type FactDispositionEntry,
} from "../../src/content/wiki/drop";
import { inputByteLimit, textChunks } from "./context-window";
import { diagramRefs } from "./diagrams";
import { diagramMaterialPaths } from "./drop-assets";
import { mergedRanges } from "./drop-context";
import { DropDiscovery } from "./drop-discovery";
import { collectPageFactDispositions } from "./fact-disposition";
import { loadPages, parsePage, type WikiPage } from "./pages";
import type { Revision } from "./revisions";
import { digest } from "./workflow";

type DropReview = z.infer<typeof dropReviewSchema>;
type Write = { path: string; before: string | null; after: string | null };
const fail = (message: string): never => {
  throw new Error(`Drop 完整性校验失败：${message}`);
};
const covers = (ranges: DropRange[], id: string, start: number, end: number) =>
  mergedRanges(ranges.filter((r) => r.id === id)).some((r) => r.start <= start && r.end >= end);

/** Legacy records stay byte-identical; deleting new fields cannot opt a current batch into legacy. */
export function assertDropProtocol(root: string, drop?: DropReview) {
  if (!drop) return;
  const file = join(root, `wiki/_jobs/drops/batches/${drop.id}.json`);
  if (existsSync(file)) {
    const batch = JSON.parse(readFileSync(file, "utf8"));
    if (
      (batch.protocol === 3 || batch.protocol === 4) &&
      batch.generation === drop.generation &&
      drop.protocol !== batch.protocol
    )
      fail("不能把当前批次降级或篡改协议版本");
  }
  const attempt = join(root, `wiki/_jobs/drops/runs/${drop.id}/${drop.generation}/attempt.json`);
  if (existsSync(attempt)) {
    const recorded = JSON.parse(readFileSync(attempt, "utf8")).protocol;
    if ((recorded === 3 || recorded === 4) && drop.protocol !== recorded)
      fail("不能把当前批次降级或篡改协议版本");
  }
  if ((drop.protocol === 3 || drop.protocol === 4) && !drop.receipt) fail("缺少复核记录");
  if (drop.receipt && drop.protocol !== drop.receipt.protocol) fail("外层协议版本与复核记录协议不一致");
}

/** Reconstruct provision from durable actual inputs, then recompute graph obligations from both versions. */
export function validateDropReceipt(
  root: string,
  drop: DropReview | undefined,
  writes: Write[],
  revisions?: Revision[],
) {
  assertDropProtocol(root, drop);
  if (!drop?.receipt) return;
  const receipt = drop.receipt;
  const dir = join(root, `wiki/_jobs/drops/runs/${drop.id}/${drop.generation}`);
  const base = new Map<string, string>(JSON.parse(readFileSync(join(dir, "base.json"), "utf8")));
  const after = new Map(base);
  for (const w of writes)
    if (w.after !== null) after.set(w.path, w.after);
    else after.delete(w.path);
  const pages = (files: Map<string, string>) =>
    [...files]
      .flatMap(([path, text]) => {
        if (!/^wiki\/(concepts|sources|params)\/[^/]+\.md$/.test(path)) return [];
        const parsed = parsePage(path.slice(5), text);
        if (!parsed.page || parsed.problems.length) fail(`页面快照无效 ${path}`);
        return [parsed.page!];
      })
      .sort((a, b) => a.file.localeCompare(b.file));
  const oldPages = pages(base);
  const newPages = pages(after);
  const permittedPaths = new Set([...oldPages, ...newPages].map((p) => p.file));
  if (loadPages(join(root, "wiki")).pages.some((p) => !permittedPaths.has(p.file)))
    fail("知识目录已改变，请基于新页面重新整合");
  // loadPages is ordered by directory then filename; use that exact order for the frozen index identity.
  const ordered = (items: WikiPage[]) =>
    [...items].sort((a, b) => {
      const dirs = ["concepts", "params", "sources"];
      return (
        dirs.indexOf(a.file.split("/")[0]!) - dirs.indexOf(b.file.split("/")[0]!) ||
        a.file.localeCompare(b.file)
      );
    });
  if (new DropDiscovery(ordered(oldPages)).snapshot !== receipt.baseline) fail("知识基线身份不一致");
  const resources = new Map(receipt.resources.map((r) => [r.id, r]));
  if (resources.size !== receipt.resources.length) fail("材料身份重复");
  const texts = new Map<string, string>();
  for (const resource of receipt.resources) {
    const text = readFileSync(join(dir, `material-${resource.hash}.txt`), "utf8");
    if (digest(text) !== resource.hash || text.length !== resource.length)
      fail(`材料快照改变 ${resource.path}`);
    if (resource.kind === "page" && base.get(`wiki/${resource.path}`) !== text)
      fail(`旧页版本不一致 ${resource.path}`);
    if (
      (resource.kind === "source" || resource.kind === "reference") &&
      after.get(`wiki/${resource.path}`) !== text
    )
      fail(`原文版本不一致 ${resource.path}`);
    if ((resource.kind === "source" || resource.kind === "reference") && base.has(`wiki/${resource.path}`)) {
      const actual = join(root, "wiki", resource.path);
      if (!existsSync(actual) || readFileSync(actual, "utf8") !== text)
        fail(`原文快照缺失或改变 ${resource.path}`);
    }
    texts.set(resource.id, text);
  }
  const inputMap = new Map(receipt.inputs.map((i) => [i.key, i]));
  for (const input of receipt.inputs) {
    const actual = JSON.parse(readFileSync(join(dir, `input-${input.key}.json`), "utf8"));
    if (digest(JSON.stringify(actual)) !== input.key || digest(actual.rules) !== input.rulesHash)
      fail("实际请求 hash 不一致");
    const bytes = Buffer.byteLength(JSON.stringify(actual.data));
    const limit = Math.min(900000, inputByteLimit("", actual.rules, receipt.budget));
    if (bytes !== input.bytes || limit !== input.limit || bytes > limit)
      fail("实际输入超出固定预算或计数不符");
    const ranges: DropRange[] = [];
    if (!Array.isArray(actual.data.materials)) fail("实际输入缺少材料表");
    for (const material of actual.data.materials) {
      const r = resources.get(material.id);
      if (
        !r ||
        material.hash !== r.hash ||
        material.start < 0 ||
        material.end > r.length ||
        material.end < material.start ||
        texts.get(r.id)!.slice(material.start, material.end) !== material.text
      )
        fail("实际材料范围或原文不一致");
      if (ranges.some((a) => a.id === material.id && a.start < material.end && a.end > material.start))
        fail("单次输入存在重复材料范围");
      ranges.push({ id: material.id, hash: material.hash, start: material.start, end: material.end });
    }
    if (JSON.stringify(ranges) !== JSON.stringify(input.materials)) fail("输入材料清单与实际提供不一致");
  }
  const provided = receipt.inputs.flatMap((i) => i.materials);
  for (const id of receipt.requiredReads) {
    const r = resources.get(id);
    if (!r || (r.length && !covers(provided, id, 0, r.length))) fail(`必需阅读有缺口 ${id}`);
  }
  const batchFile = join(root, `wiki/_jobs/drops/batches/${drop.id}.json`);
  const batch = dropBatchSchema.parse(JSON.parse(readFileSync(batchFile, "utf8")));
  if (JSON.stringify(batch.budget) !== JSON.stringify(receipt.budget)) fail("运行预算快照改变");
  for (const source of batch.sources) {
    const r = receipt.resources.find(
      (r) =>
        r.kind === "source" &&
        r.path === source.parsed &&
        r.origins.some((o) => o.sourceId === source.sourceId && o.revision === source.revision),
    );
    if (!r || !receipt.requiredReads.includes(r.id)) fail("接受的原文没有完整覆盖任务");
  }
  for (const r of receipt.resources.filter((r) => r.kind === "source")) {
    if (!receipt.requiredReads.includes(r.id)) fail("补证原文未完整阅读");
    const decisions = receipt.decisions.filter((d) =>
      r.origins.some((o) => d.topic.startsWith(`${o.sourceId}:`)),
    );
    const spans = decisions.flatMap((d) => {
      const match = /:(\d+)-(\d+)$/.exec(d.topic);
      return match ? [{ id: r.id, hash: r.hash, start: Number(match[1]), end: Number(match[2]) }] : [];
    });
    if (r.length && !covers(spans, r.id, 0, r.length)) fail("原文段落缺少处理结果");
  }
  const checkIds = new Set(receipt.checks.map((c) => c.id));
  if (checkIds.size !== receipt.checks.length || receipt.requiredChecks.some((id) => !checkIds.has(id)))
    fail("必要复核任务缺失");
  for (const check of receipt.checks) {
    const input = inputMap.get(check.inputs.at(-1)!) ?? fail("复核缺少实际输入");
    if (check.inputs.some((key) => !inputMap.has(key))) fail("复核缺少实际输入");
    for (const binding of check.bindings) {
      const r = resources.get(binding.id) ?? fail("复核材料不存在");
      if (r.hash !== binding.hash || !covers(input.materials, r.id, binding.start, binding.end))
        fail("复核原文不在本次实际输入");
      if ((r.kind === "candidate" || r.kind === "diagram") && after.get(`wiki/${r.path}`) !== texts.get(r.id))
        fail("复核绑定的候选已经过期");
    }
  }
  const changed = writes.filter((w) => /^wiki\/(concepts|sources|params)\//.test(w.path) && w.after !== null);
  const targetIds = changed.map((w) => w.path.split("/").at(-1)!.slice(0, -3));
  const finalResource = (pid: string) => {
    const p = newPages.find((p) => p.fm.id === pid) ?? fail(`关系端点不存在 ${pid}`);
    return (
      receipt.resources.find(
        (r) =>
          r.path === p.file &&
          r.hash === digest(after.get(`wiki/${p.file}`)!) &&
          r.kind === (targetIds.includes(pid) ? "candidate" : "page"),
      ) ?? fail(`关系端点未提供 ${pid}`)
    );
  };
  const chunks = (r: DropReceipt["resources"][number]) =>
    textChunks(texts.get(r.id)!, 12000).map((c) => ({ id: r.id, hash: r.hash, start: c.start, end: c.end }));
  const hasCheck = (
    kind: DropReceipt["checks"][number]["kind"],
    pids: string[],
    ranges: DropRange[],
    asset?: string,
  ) =>
    receipt.checks.some(
      (c) =>
        c.kind === kind &&
        c.asset === asset &&
        c.pages.length === pids.length &&
        pids.every((p) => c.pages.includes(p)) &&
        ranges.every((r) => covers(c.bindings, r.id, r.start, r.end)),
    );
  const requiredDiagramRanges = (did: string): DropRange[] => {
    const yamlAfter = after.get(`wiki/diagrams/${did}.yaml`) ?? fail(`共享资产缺少图规格 ${did}`);
    let relPaths: string[];
    try {
      relPaths = diagramMaterialPaths(did, yamlAfter);
    } catch {
      fail(`共享资产图规格无效 ${did}`);
    }
    return relPaths!.map((relPath) => {
      const expectedText = after.get(`wiki/${relPath}`) ?? fail(`共享资产缺少文件内容 ${relPath}`);
      const expectedHash = digest(expectedText);
      const resource =
        receipt.resources.find(
          (r) => r.kind === "diagram" && r.path === relPath && r.hash === expectedHash,
        ) ?? fail(`共享资产缺少当前候选 ${relPath}`);
      return { id: resource.id, hash: resource.hash, start: 0, end: resource.length };
    });
  };
  for (const pid of targetIds) {
    const r = finalResource(pid);
    const plan = receipt.plans.find((p) => p.path === r.path) ?? fail("目标页缺少整合判断");
    const relevant = receipt.resources.filter(
      (s) => s.kind === "source" && plan.evidence.some((ref) => ref.startsWith(`raw:${s.path.slice(4)}#`)),
    );
    if (!relevant.length) fail("目标页缺少本批原文依据");
    const old = receipt.resources.find((s) => s.kind === "page" && s.path === r.path);
    const newPage = newPages.find((p) => p.fm.id === pid)!;
    const nativePageDiagramRanges = [...new Set(diagramRefs(newPage.body))].flatMap((did) => {
      const yamlAfter = after.get(`wiki/diagrams/${did}.yaml`);
      if (!yamlAfter) return [];
      const relPaths = diagramMaterialPaths(did, yamlAfter);
      return relPaths.length > 1 ? requiredDiagramRanges(did) : [];
    });
    for (const candidate of chunks(r))
      for (const source of relevant)
        for (const sourceChunk of chunks(source))
          for (const prior of old ? chunks(old) : [undefined])
            if (
              !hasCheck(
                "page",
                [pid],
                [candidate, sourceChunk, ...(prior ? [prior] : []), ...nativePageDiagramRanges],
              )
            )
              fail(`逐页原文复核缺段 ${pid}`);
  }
  const changedAssets = [
    ...new Set(
      writes
        .filter((w) => /^wiki\/diagrams\/.*\.(yaml|svg)$/.test(w.path))
        .map((w) =>
          w.path
            .split("/")
            .at(-1)!
            .replace(/\.(yaml|svg)$/, ""),
        ),
    ),
  ];
  const tasks = new Map(
    [
      ...new DropDiscovery(oldPages).impact(targetIds, changedAssets),
      ...new DropDiscovery(newPages).impact(targetIds, changedAssets),
    ].map((t) => [t.id, t]),
  );
  for (const edge of receipt.inferredRelations ?? []) {
    const pair = [edge.a, edge.b].sort();
    tasks.set(`semantic:${pair.join(":")}`, {
      id: `semantic:${pair.join(":")}`,
      kind: "relation",
      pages: pair,
    });
  }
  for (let a = 0; a < targetIds.length; a++)
    for (let b = a + 1; b < targetIds.length; b++) {
      const pair = [targetIds[a]!, targetIds[b]!].sort();
      tasks.set(`coordination:${pair.join(":")}`, {
        id: `coordination:${pair.join(":")}`,
        kind: "coordination",
        pages: pair,
      });
    }
  for (const task of tasks.values()) {
    const combinations = task.pages
      .map((pid) => chunks(finalResource(pid)))
      .reduce<DropRange[][]>((sets, ranges) => sets.flatMap((set) => ranges.map((r) => [...set, r])), [[]]);
    const assetRanges = task.asset ? requiredDiagramRanges(task.asset) : [];
    for (const ranges of combinations)
      if (!hasCheck(task.kind, task.pages, [...ranges, ...assetRanges], task.asset))
        fail(`跨页或共享资产复核缺失 ${task.id}`);
  }
  if (receipt.protocol === 4) {
    const sortedChanged = [...changed].sort((a, b) => a.path.localeCompare(b.path));
    const expected: FactDispositionEntry[] = [];
    for (const w of sortedChanged) {
      const prior = base.get(w.path);
      if (!prior || w.after === null) continue;
      const pid = w.path.split("/").at(-1)!.slice(0, -3);
      const rev = revisions?.find((r) => r.id === pid);
      const pageSealed = receipt.factDispositions.filter((e) => e.pageId === pid);
      try {
        expected.push(
          ...collectPageFactDispositions(w.path.slice(5), prior, w.after, rev, sortedChanged, pageSealed),
        );
      } catch (error) {
        fail(String(error));
      }
    }
    for (const entry of expected) {
      if (entry.verification !== "semantic-check") continue;
      if (!entry.checkId || !receipt.requiredChecks.includes(entry.checkId))
        fail(`协议四语义复核事实缺少绑定复核记录 ${entry.pageId}`);
      const checkRecord =
        receipt.checks.find((c) => c.id === entry.checkId) ??
        fail(`协议四语义复核记录不存在 ${entry.checkId}`);
      const oldRes = receipt.resources.find(
        (r) => r.kind === "page" && r.path.endsWith(`/${entry.pageId}.md`),
      );
      const candRes = finalResource(entry.pageId);
      if (oldRes?.length && !covers(checkRecord.bindings, oldRes.id, 0, oldRes.length))
        fail(`协议四语义复核未完整覆盖旧页 ${entry.checkId}`);
      if (candRes.length && !covers(checkRecord.bindings, candRes.id, 0, candRes.length))
        fail(`协议四语义复核未完整覆盖候选页 ${entry.checkId}`);
      if (entry.outlet === "migrated" && entry.targetPage) {
        const targetRes = finalResource(entry.targetPage);
        if (targetRes.length && !covers(checkRecord.bindings, targetRes.id, 0, targetRes.length))
          fail(`协议四语义复核未完整覆盖跨页目标 ${entry.checkId}`);
      }
    }
    if (JSON.stringify(receipt.factDispositions) !== JSON.stringify(expected))
      fail("协议四事实去向记录缺失或与候选页面不一致");
  }
}
