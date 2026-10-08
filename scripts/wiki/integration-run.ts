import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { runBuild } from "./build";
import {
  type AgentEvent,
  type AgentRequest,
  applyIntegration,
  integrationSchema,
  type RunAgent,
  strayPaths,
} from "./ingest";
import { PAGE_DIRS, parsePage } from "./pages";
import { readRawSnapshot, saveRawSnapshot, withRawSources } from "./raw";
import { createReview } from "./review";
import { isWikiStatePath } from "./review-files";
import { revisePage } from "./revisions";

function snapshotRefs(file: string, text: string | undefined): string[] {
  if (text === undefined) return [];
  const parsed = parsePage(file, text);
  if (!parsed.page || parsed.problems.length)
    throw new Error(`整合来源映射无法读取：${file}：${JSON.stringify(parsed.problems)}`);
  return parsed.page.fm.rawSources ?? [];
}

/** Provenance survives an agent rewrite and the removal of consumed drafts. */
function carrySnapshots(
  stageWiki: string,
  before: Map<string, string>,
  targets: { from: string; into: string }[],
): void {
  for (const { from, into } of targets) {
    const candidates = PAGE_DIRS.map((dir) => `${dir}/${into}.md`).filter((p) =>
      existsSync(join(stageWiki, p)),
    );
    if (candidates.length !== 1) throw new Error(`整合目标必须唯一存在：${into}`);
    const file = candidates[0]!;
    const text = readFileSync(join(stageWiki, file), "utf8");
    const draft = `_drafts/${from}.md`;
    const refs = [
      ...snapshotRefs(draft, before.get(draft)),
      ...snapshotRefs(file, before.get(file)),
      ...snapshotRefs(file, text),
    ];
    // Legacy-only batches retain their existing format. When upgrading a target,
    // preserve its old excerpts as well as the incoming draft's excerpts.
    if (!refs.length) continue;
    for (const [id, path] of [
      [from, draft],
      [into, file],
    ]) {
      if (snapshotRefs(path!, before.get(path!)).length) continue;
      const legacy = before.get(`raw/${id}.md`);
      if (legacy?.trim()) refs.push(saveRawSnapshot(stageWiki, legacy));
    }
    for (const ref of new Set(refs)) readRawSnapshot(stageWiki, ref);
    writeFileSync(join(stageWiki, file), withRawSources(text, refs));
  }
}

function contents(root: string, skipJobs = true): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (skipJobs && isWikiStatePath(relative(root, file).replace(/\\/g, "/"))) continue;
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error(`整合副本不接受符号链接：${file}`);
      if (stat.isDirectory()) walk(file);
      else files.set(relative(root, file).replace(/\\/g, "/"), readFileSync(file, "utf8"));
    }
  };
  walk(root);
  return files;
}

function changed(before: Map<string, string>, after: Map<string, string>): string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p) !== after.get(p));
}

/** Agent-backed proposals and already compiled source drafts share the same staging and review boundary. */
export async function runStagedIntegration(
  root: string,
  request: AgentRequest,
  draftIds: string[],
  today: string,
  deps: {
    runAgent: RunAgent;
    validate: (root: string) => string[];
    onEvent?: (event: AgentEvent) => void;
    repoRoots?: Record<string, string>;
  },
) {
  return prepareStagedIntegration(root, request.allowedWrites, draftIds, today, {
    ...deps,
    prepare: (stageWiki) => deps.runAgent({ ...request, cwd: stageWiki }, deps.onEvent),
  });
}

/** Saving a compiled answer proposes a new source page; it never silently rewrites a concept. */
export async function prepareSourceReview(
  root: string,
  id: string,
  today: string,
  validate: (root: string) => string[],
  repoRoots: Record<string, string>,
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("非法来源页 id");
  return prepareStagedIntegration(root, [`sources/${id}.md`, "_drafts/_integration.json"], [id], today, {
    validate,
    repoRoots,
    prepare: async (wiki) => {
      if (PAGE_DIRS.some((dir) => existsSync(join(wiki, dir, `${id}.md`))))
        throw new Error("目标页已存在，需重新审阅修订");
      const text = readFileSync(join(wiki, "_drafts", `${id}.md`), "utf8");
      const page = parsePage(`${id}.md`, text);
      if (!page.page || page.problems.length || page.page.fm.type !== "source")
        throw new Error("问答草稿必须是合法来源摘要");
      mkdirSync(join(wiki, "sources"), { recursive: true });
      writeFileSync(join(wiki, "sources", `${id}.md`), text);
      writeFileSync(
        join(wiki, "_drafts/_integration.json"),
        JSON.stringify({ promoted: [id], merged: [], rejected: [] }),
      );
      return { ok: true, exitCode: 0 };
    },
  });
}

async function prepareStagedIntegration(
  root: string,
  allowedWrites: string[],
  draftIds: string[],
  today: string,
  deps: {
    prepare: (
      wiki: string,
    ) => Promise<{ ok: boolean; exitCode: number | null; reason?: string; costUsd?: number }>;
    validate: (root: string) => string[];
    repoRoots?: Record<string, string>;
  },
) {
  const wikiRoot = join(root, "wiki");
  const before = contents(wikiRoot);
  const stagingRoot = mkdtempSync(join(tmpdir(), "wiki-integration-"));
  const rel = relative(resolve(tmpdir()), resolve(stagingRoot));
  if (!rel.startsWith("wiki-integration-") || rel.includes(".."))
    throw new Error("临时整合目录不在预期范围内");
  const stageWiki = join(stagingRoot, "wiki");
  try {
    cpSync(wikiRoot, stageWiki, {
      recursive: true,
      filter: (path) => !isWikiStatePath(relative(wikiRoot, path).replace(/\\/g, "/")),
    });
    // A previous batch's decision is never proof that this run finished.
    rmSync(join(stageWiki, "_drafts/_integration.json"), { force: true });
    const result = await deps.prepare(stageWiki);
    if (!result.ok) throw new Error(`整合 agent 失败：${result.reason ?? result.exitCode}`);
    const unexpected = strayPaths(changed(before, contents(stageWiki, false)), allowedWrites);
    if (unexpected.length) throw new Error(`整合越界写入：${unexpected.join(", ")}`);
    const decisionFile = join(stageWiki, "_drafts/_integration.json");
    if (!existsSync(decisionFile)) throw new Error("整合 agent 未产出本次决策");
    const decision = integrationSchema.parse(JSON.parse(readFileSync(decisionFile, "utf8")));
    const consumed = [
      ...decision.promoted,
      ...decision.merged.map((m) => m.from),
      ...decision.rejected.map((r) => r.id),
    ];
    if (
      consumed.length !== draftIds.length ||
      new Set(consumed).size !== consumed.length ||
      consumed.some((id) => !draftIds.includes(id))
    ) {
      throw new Error("整合决策必须恰好覆盖本次草稿，不能包含其他批次或重复处置");
    }
    carrySnapshots(stageWiki, before, [
      ...decision.promoted.map((id) => ({ from: id, into: id })),
      ...decision.merged,
    ]);
    const revisions = decision.revisions ?? [];
    if (new Set(revisions.map((r) => r.id)).size !== revisions.length) throw new Error("同页修订分类重复");
    const used = new Set<string>();
    decision.revisionDate = today;
    for (const [file, original] of before) {
      if (!PAGE_DIRS.some((dir) => file.startsWith(`${dir}/`)) || !file.endsWith(".md")) continue;
      const target = join(stageWiki, file);
      if (!existsSync(target)) continue;
      const id = file.split("/").at(-1)!.slice(0, -3);
      const revision = revisions.find((r) => r.id === id);
      if (revision) used.add(id);
      const candidate = readFileSync(target, "utf8");
      if (candidate !== original || revision)
        writeFileSync(target, revisePage(file, original, candidate, revision, today));
    }
    if (revisions.some((r) => !used.has(r.id))) throw new Error("修订分类必须对应本次处理的现有页");
    const issues = deps.validate(stagingRoot);
    if (issues.length) throw new Error(`整合校验失败：\n${issues.join("\n")}`);
    const applied = applyIntegration(stageWiki, decision, today);
    if (applied.problems.length) throw new Error(applied.problems.join("\n"));
    const built = runBuild(stagingRoot);
    if (built.problems) throw new Error("整合 build 存在页面 schema 错误");
    const after = contents(stageWiki, false);
    // The decision belongs to the review record, not a shared mutable batch file.
    const decisionPath = "_drafts/_integration.json";
    if (before.has(decisionPath)) after.set(decisionPath, before.get(decisionPath)!);
    else after.delete(decisionPath);
    // 注册表与目录不进待审包，发布时重建；log.md 只取本次追加的那段（见 review.ts DERIVED）
    const original = new Map([...before].map(([path, text]) => [`wiki/${path}`, text]));
    const candidate = new Map([...after].map(([path, text]) => [`wiki/${path}`, text]));
    const review = await createReview(root, original, candidate, decision, deps.repoRoots);
    return { decision, pageCount: built.pageCount, costUsd: result.costUsd, reviewId: review.id };
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}
