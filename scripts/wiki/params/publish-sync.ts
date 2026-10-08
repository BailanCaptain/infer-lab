import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ParamEntry } from "../../../src/content/wiki/schema";
import { runBuild } from "../build";
import { replaceSection } from "../lineage";
import { gitLineage, lineageRefs, renderVerifiedLineage } from "../lineage-git";
import { appendWikiLog } from "../log";
import { loadPages } from "../pages";
import { localFile } from "../review-files";
import { atomicText, digest, WorkflowStore } from "../workflow";
import { parameterPageId } from "./identities";
import { buildParamPage } from "./pages";
import { recordParamSource } from "./provenance";
import { parameterDiff, parameterKey } from "./sync";

export class ParameterBulkDeferred extends Error {
  constructor(
    public readonly added: number,
    public readonly limit: number,
  ) {
    super(`新增骨架 ${added} 超过本轮非批量上限 ${limit}；未批量生成`);
  }
}

export interface ParamSyncResult {
  added: number;
  removed: number;
  changed: number;
  written: number;
  /** 超出每晚上限、留到下一轮的新增项数；没有时不出现 */
  heldBack?: number;
  heldBackKeys?: string[];
}

/** Only AST facts and verified Git lineage are refreshed; authored explanations remain byte-preserved. */
export async function publishParamSync(
  root: string,
  input: {
    repo: string;
    repoDir: string;
    ref: string;
    before: { commit: string; entries: ParamEntry[] };
    after: { commit: string; entries: ParamEntry[] };
    maxNewPages: number;
  },
) {
  // 分批时同一对 commit 会连跑几晚，每晚的起点（已处理到哪）不同，回执要分得开
  const receipt = localFile(
    root,
    `wiki/_jobs/parameter-sync/published/${digest(JSON.stringify({ repo: input.repo, ref: input.ref, before: input.before.commit, after: input.after.commit, handled: digest(JSON.stringify(input.before.entries.map(parameterKey).sort())) }))}.json`,
  );
  if (existsSync(receipt)) return JSON.parse(readFileSync(receipt, "utf8")) as ParamSyncResult;
  const full = parameterDiff(input.before.entries, input.after.entries);
  const confirmed = (p: ParamEntry) => p.confidence === "certain" || p.review?.verdict === "param";
  const pages = loadPages(join(root, "wiki")).pages;
  const writes: { path: string; before?: string; after: string }[] = [];
  const skipped: { name: string; file: string; reason: string }[] = [];
  const newPages = full.added
    .map((entry) => ({ entry, id: parameterPageId(root, input.repo, entry, pages) }))
    .filter(({ entry, id }) => id && confirmed(entry) && !pages.some((p) => p.fm.id === id));
  if (!Number.isInteger(input.maxNewPages) || input.maxNewPages < 0)
    throw new Error("非批量上限必须是非负整数");
  // 上限 0 = 明确不生成新页，整批暂缓。上限为正时只做前 N 个，其余留到下一轮，
  // 否则积压一旦超过上限就每晚原样暂缓、永远消化不掉（2026-09 实际卡了 14 个）。
  if (newPages.length > input.maxNewPages && input.maxNewPages === 0)
    throw new ParameterBulkDeferred(newPages.length, input.maxNewPages);
  const held = new Set(
    newPages
      .map(({ entry }) => parameterKey(entry))
      .sort()
      .slice(input.maxNewPages),
  );
  const diff = { ...full, added: full.added.filter((entry) => !held.has(parameterKey(entry))) };
  const updates = [...diff.added, ...diff.changed.map((d) => d.after), ...diff.relocated.map((d) => d.after)];
  // 与 wiki:lineage 同一套展示范围：发布分支 + 本次的 ref；都解析不出（测试夹具）才退回提交对
  const lineageScope = lineageRefs(input.repoDir, [input.ref], [input.before.commit, input.after.commit]);
  const resolved = updates.map((entry) => ({ entry, id: parameterPageId(root, input.repo, entry, pages) }));
  for (const { entry, id } of resolved) {
    if (!id) {
      skipped.push({ name: entry.name, file: entry.file, reason: "explicit-reference-identity" });
      continue;
    }
    const path = localFile(root, `wiki/params/${id}.md`);
    if ((!confirmed(entry) && !existsSync(path)) || (!diff.added.includes(entry) && !existsSync(path))) {
      skipped.push({ name: entry.name, file: entry.file, reason: "unreviewed-or-no-existing-page" });
      continue;
    }
    const before = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    let text = buildParamPage(
      {
        repo: input.repo,
        ref: input.ref,
        commit: input.after.commit,
        entry,
        date: new Date().toISOString().slice(0, 10),
        pageId: id,
      },
      before,
    );
    text = recordParamSource(root, input.repoDir, input.repo, input.after.commit, entry.file, text);
    const lineage = gitLineage(input.repoDir, entry.name, lineageScope, ["vllm_ascend/"]);
    writes.push({ path, before, after: replaceSection(text, "## 版本谱系", renderVerifiedLineage(lineage)) });
  }
  for (const entry of diff.removed) {
    const id = parameterPageId(root, input.repo, entry, pages);
    if (!id) {
      skipped.push({ name: entry.name, file: entry.file, reason: "explicit-reference-identity" });
      continue;
    }
    const path = localFile(root, `wiki/params/${id}.md`);
    if (!existsSync(path)) continue;
    const before = readFileSync(path, "utf8");
    const lineage = gitLineage(input.repoDir, entry.name, lineageScope, ["vllm_ascend/"]);
    writes.push({
      path,
      before,
      after: replaceSection(before, "## 版本谱系", renderVerifiedLineage(lineage)),
    });
  }
  return new WorkflowStore(root).locked(() => {
    if (existsSync(receipt)) return JSON.parse(readFileSync(receipt, "utf8")) as ParamSyncResult;
    for (const w of writes)
      if ((existsSync(w.path) ? readFileSync(w.path, "utf8") : undefined) !== w.before)
        throw new Error("参数同步期间页面被修改，未覆盖");
    mkdirSync(localFile(root, "wiki/params"), { recursive: true });
    for (const w of writes) atomicText(w.path, w.after);
    mkdirSync(localFile(root, "wiki/_drafts"), { recursive: true });
    const queuePath = localFile(root, "wiki/_drafts/_param-queue.json");
    const existing = existsSync(queuePath) ? JSON.parse(readFileSync(queuePath, "utf8")) : [];
    const pending = Array.isArray(existing) ? existing : [existing];
    const change = {
      repo: input.repo,
      ref: input.ref,
      before: input.before.commit,
      after: input.after.commit,
      added: diff.added,
      removed: diff.removed,
      changed: diff.changed,
      skipped,
      state: writes.length ? "static-facts-refreshed-prose-needs-review" : "no-existing-page-updated",
    };
    if (
      !pending.some(
        (p) =>
          p.repo === change.repo &&
          p.ref === change.ref &&
          p.before === change.before &&
          p.after === change.after &&
          JSON.stringify(p.added) === JSON.stringify(change.added),
      )
    )
      pending.push(change);
    atomicText(queuePath, JSON.stringify(pending, null, 2));
    if (runBuild(root).problems) throw new Error("参数派生失败，未推进同步检查点");
    appendWikiLog(
      root,
      "ingest",
      "参数增量",
      `${input.repo}@${input.ref} ${input.before.commit} → ${input.after.commit}；新增 ${diff.added.length} / 删除 ${diff.removed.length} / 变更 ${diff.changed.length}。\n\n${diff.changed.map((d) => `- ${d.after.name}: 默认表达式 ${JSON.stringify(d.before.default)} → ${JSON.stringify(d.after.default)}`).join("\n")}`,
    );
    const result: ParamSyncResult = {
      ...(held.size ? { heldBack: held.size, heldBackKeys: [...held] } : {}),
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      written: writes.length,
    };
    mkdirSync(localFile(root, "wiki/_jobs/parameter-sync/published"), { recursive: true });
    atomicText(receipt, JSON.stringify(result));
    return result;
  });
}
