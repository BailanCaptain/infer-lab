import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { parseRawRef } from "../../src/content/wiki/schema";
import { runBuild } from "./build";
import { integrationSchema } from "./ingest";
import { validateIntegration } from "./integration-check";
import { lineageSection } from "./lineage";
import { PAGE_DIRS, parsePage } from "./pages";
import { protectedParamSection } from "./params/pages";
import { localFile, optionalText, REGISTRY, replaceText, wikiContents } from "./review-files";
import { verifyRevision } from "./revisions";
import { atomicText, digest, jobSchema, WorkflowStore } from "./workflow";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const writeSchema = z
  .object({ path: z.string(), before: z.string().nullable(), after: z.string().nullable() })
  .strict();
const payloadSchema = z
  .object({
    base: z.record(hash),
    writes: z.array(writeSchema),
    decision: integrationSchema,
    repoRoots: z.record(z.string()),
    /** 本包要在 log.md 末尾追加的条目；发布时追加到当时的 log.md（2026-09-23 前的包直接带整份 log.md） */
    log: z.string().optional(),
  })
  .strict();
export const reviewSchema = z
  .object({
    id: hash,
    state: z.enum(["pending", "publishing", "published", "rejected"]),
    payload: payloadSchema,
    reason: z.string().optional(),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;
type Write = z.infer<typeof writeSchema>;
type Validate = (root: string, repoRoots: Record<string, string>) => string[];
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const reviewPath = (id: string) => `wiki/_jobs/reviews/${hash.parse(id)}.json`;

/**
 * 全库派生文件：发布时由 runBuild 与本包的日志条目重新生成，不进待审包的 base 与 writes。
 * 2026-09-23 前每个包都带着这三份的整份新内容，批了一个包，其余包必然过期。旧包里有，只读不再发布。
 */
const DERIVED = new Set([REGISTRY, "wiki/index.md", "wiki/log.md"]);
const LOG = "wiki/log.md";

function allowed(write: Write): boolean {
  const { path, before, after } = write;
  if (path === REGISTRY || path === "wiki/index.md" || path === "wiki/log.md") return after !== null;
  if (/^wiki\/(concepts|params|sources)\/[a-z0-9][a-z0-9-]*\.md$/.test(path)) return after !== null;
  if (/^wiki\/_drafts\/[a-z0-9][a-z0-9-]*\.md$/.test(path)) return before !== null && after === null;
  if (/^wiki\/raw\/sha256-([a-f0-9]{64})\.md$/.test(path))
    return before === null && after !== null && path === `wiki/raw/sha256-${digest(after)}.md`;
  if (/^wiki\/_jobs\/[a-f0-9]{64}\.json$/.test(path) && before && after) {
    const old = jobSchema.parse(JSON.parse(before));
    const next = jobSchema.parse(JSON.parse(after));
    return (
      old.state === "draft" &&
      !old.screening?.blocked &&
      path === `wiki/_jobs/${old.id}.json` &&
      JSON.stringify({ ...old, state: "integrated" }) === JSON.stringify(next)
    );
  }
  return false;
}

/** The revision hash covers the complete proposal, including job transitions and validation inputs. */
export function readReview(root: string, id: string): Review {
  const record = reviewSchema.parse(JSON.parse(readFileSync(localFile(root, reviewPath(id)), "utf8")));
  if (record.id !== id || digest(JSON.stringify(record.payload)) !== id)
    throw new Error("待审 revision 内容已改变");
  const paths = new Set<string>();
  for (const write of record.payload.writes) {
    localFile(root, write.path);
    if (
      paths.has(write.path) ||
      !allowed(write) ||
      write.before === write.after ||
      record.payload.base[write.path] !== (write.before === null ? undefined : digest(write.before))
    )
      throw new Error(`非法发布 manifest：${write.path}`);
    paths.add(write.path);
  }
  return record;
}

export function listReviews(root: string): Review[] {
  const dir = localFile(root, "wiki/_jobs/reviews");
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((p) => /^[a-f0-9]{64}\.json$/.test(p))
        .sort()
        .map((p) => readReview(root, p.slice(0, -5)))
    : [];
}

function save(root: string, review: Review): void {
  const file = localFile(root, reviewPath(review.id));
  mkdirSync(join(root, "wiki/_jobs/reviews"), { recursive: true });
  atomicText(file, encode(review));
}

/** 只核对本包依赖的文件；库里别处的改动（别的页、别的草稿、手册）不让本包过期 */
function checkBase(root: string, review: Review): void {
  const writes = new Map(review.payload.writes.map((w) => [w.path, w]));
  for (const path of new Set([...Object.keys(review.payload.base), ...writes.keys()])) {
    if (DERIVED.has(path)) continue;
    const text = optionalText(root, path);
    const write = writes.get(path);
    if (review.state === "publishing" && write && (text === write.before || text === write.after)) continue;
    // 原始材料按内容寻址：别的包先存进了同一份，字节相同就不算冲突
    if (write && write.before === null && path.startsWith("wiki/raw/") && text === write.after) continue;
    if ((text === null ? undefined : digest(text)) !== review.payload.base[path])
      throw new Error(`基础内容发生变化：${path}；保留当前内容，需重新整合审阅`);
  }
}

/** 本包写出的正式页引用的原始材料：内容寻址、本不该变，变了说明证据被改，包要过期 */
function citedRaw(writes: Write[], before: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const write of writes) {
    if (!write.after || !/^wiki\/(concepts|params|sources)\/[^/]+\.md$/.test(write.path)) continue;
    const page = parsePage(write.path.slice(5), write.after).page;
    const refs = [
      ...(page?.fm.sources ?? []).flatMap((ref) => parseRawRef(ref)?.path ?? []),
      ...(page?.fm.rawSources ?? []),
    ];
    for (const ref of refs) if (before.has(`wiki/${ref}`)) out.add(`wiki/${ref}`);
  }
  return [...out];
}

/** 在当时的 log.md 末尾追加本包条目；恢复发布时已追加过就不再追加 */
function appendLog(root: string, log: string): void {
  const current = optionalText(root, LOG) ?? "# Wiki log\n";
  if (current.includes(log)) return;
  replaceText(root, LOG, `${current.endsWith("\n") ? current : `${current}\n`}${log}`);
}

export async function createReview(
  root: string,
  before: Map<string, string>,
  after: Map<string, string>,
  decision: Review["payload"]["decision"],
  repoRoots: Record<string, string> = {},
): Promise<Review> {
  return new WorkflowStore(root).locked(() => {
    if (listReviews(root).some((r) => r.state === "publishing")) throw new Error("先恢复未完成的发布");
    const logBefore = before.get(LOG) ?? "";
    const logAfter = after.get(LOG) ?? logBefore;
    if (!logAfter.startsWith(logBefore)) throw new Error("整合只能在 log.md 末尾追加");
    const log = logAfter.slice(logBefore.length);
    const base = new Map([...before].filter(([path]) => !DERIVED.has(path)));
    const candidate = new Map([...after].filter(([path]) => !DERIVED.has(path)));
    for (const [path, text] of base) {
      if (!/^wiki\/(concepts|params|sources)\//.test(path)) continue;
      const section = lineageSection(text);
      if (section !== undefined && lineageSection(candidate.get(path) ?? "") !== section)
        throw new Error(`版本谱系为脚本产物，整合不能改写或删除：${path}`);
      const definition = protectedParamSection(text);
      if (definition !== undefined && protectedParamSection(candidate.get(path) ?? "") !== definition)
        throw new Error(`参数定义为脚本产物，整合不能改写或删除：${path}`);
    }
    const accepted = new Set([...decision.promoted, ...decision.merged.map((m) => m.from)]);
    const ids = [...accepted, ...decision.rejected.map((r) => r.id)];
    // 本批草稿无论晋升、合并还是被整合判掉，都是本包的依据；晋升与合并落到的正式页即使没改写，也是本包审的对象
    const targets = [...decision.promoted, ...decision.merged.map((m) => m.into)];
    const depends = new Set(
      [
        ...ids.map((id) => `wiki/_drafts/${id}.md`),
        ...targets.flatMap((id) => PAGE_DIRS.map((dir) => `wiki/${dir}/${id}.md`)),
      ].filter((p) => base.has(p)),
    );
    const store = new WorkflowStore(root);
    for (const id of new Set(store.verifyDrafts(ids))) {
      const path = `wiki/_jobs/${id}.json`;
      const text = optionalText(root, path)!;
      const job = jobSchema.parse(JSON.parse(text));
      base.set(path, text);
      depends.add(path);
      candidate.set(
        path,
        job.input.targets.every((t) => accepted.has(t)) ? encode({ ...job, state: "integrated" }) : text,
      );
    }
    const writes = [...new Set([...base.keys(), ...candidate.keys()])]
      .sort()
      .filter((p) => base.get(p) !== candidate.get(p))
      .map((path) => ({ path, before: base.get(path) ?? null, after: candidate.get(path) ?? null }));
    for (const write of writes) if (write.before !== null) depends.add(write.path);
    for (const path of citedRaw(writes, base)) depends.add(path);
    const payload = payloadSchema.parse({
      base: Object.fromEntries([...depends].sort().map((path) => [path, digest(base.get(path)!)])),
      writes,
      decision,
      repoRoots,
      ...(log ? { log } : {}),
    });
    if (payload.writes.some((w) => !allowed(w))) throw new Error("候选包含不允许的发布路径或操作");
    const id = digest(JSON.stringify(payload));
    const record: Review = { id, state: "pending", payload };
    checkBase(root, record);
    if (existsSync(localFile(root, reviewPath(id)))) return readReview(root, id);
    save(root, record);
    return record;
  });
}

function withTemp<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "wiki-review-"));
  const within = relative(resolve(tmpdir()), resolve(root));
  if (!within.startsWith("wiki-review-") || within.includes("..")) throw new Error("非法审阅临时目录");
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Deterministic human-readable diff of the same bytes that approval will publish. */
export function reviewDiff(root: string, id: string): string {
  const review = readReview(root, id);
  return withTemp((temp) =>
    [...review.payload.writes]
      .sort(
        (a, b) =>
          Number(!/^wiki\/(concepts|sources|params)\//.test(a.path)) -
          Number(!/^wiki\/(concepts|sources|params)\//.test(b.path)),
      )
      .map((write) => {
        writeFileSync(join(temp, "before"), write.before ?? "");
        writeFileSync(join(temp, "after"), write.after ?? "");
        const result = spawnSync(
          "git",
          ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--", "before", "after"],
          { cwd: temp, encoding: "utf8" },
        );
        if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr || "diff 失败");
        return `\n${write.path} (${write.before === null ? "新增" : write.after === null ? "删除" : "更新"})\n${result.stdout}`;
      })
      .join(""),
  );
}

/** 在当前正式库上叠加本包、重建派生文件后整体校验：别的包先发布了什么，这里都算进去 */
function validateCandidate(root: string, review: Review, validate: Validate): void {
  withTemp((stage) => {
    for (const [path, text] of wikiContents(root)) replaceText(stage, path, text);
    for (const write of review.payload.writes)
      if (!write.path.startsWith("wiki/_jobs/") && !DERIVED.has(write.path))
        replaceText(stage, write.path, write.after);
    if (review.payload.log) appendLog(stage, review.payload.log);
    if (runBuild(stage).problems) throw new Error("批准校验失败：叠加本包后页面 schema 有错");
    const issues = validate(stage, review.payload.repoRoots);
    if (issues.length) throw new Error(`批准校验失败：\n${issues.join("\n")}`);
  });
}

/** A durable publishing state is written BEFORE the first mutation. Recovery resumes exactly this revision. */
export async function approveReview(
  root: string,
  id: string,
  deps: { validate?: Validate; afterWrite?: (path: string) => void } = {},
): Promise<Review> {
  return new WorkflowStore(root).locked(() => {
    const review = readReview(root, id);
    if (review.state === "published") return review;
    if (review.state === "rejected") throw new Error("该 revision 已驳回，不能批准或自动复活");
    if (listReviews(root).some((r) => r.id !== id && r.state === "publishing"))
      throw new Error("先恢复其他未完成的发布");
    checkBase(root, review);
    for (const write of review.payload.writes) {
      if (write.before)
        for (const extract of [lineageSection, protectedParamSection]) {
          const section = extract(write.before);
          if (section !== undefined && extract(write.after ?? "") !== section)
            throw new Error(`自动生成区被修改：${write.path}`);
        }
      if (!/^wiki\/(concepts|params|sources)\//.test(write.path) || !write.before || !write.after) continue;
      const id = write.path.split("/").at(-1)!.slice(0, -3);
      verifyRevision(
        write.path.slice(5),
        write.before,
        write.after,
        review.payload.decision.revisions?.find((r) => r.id === id),
        review.payload.decision.revisionDate ?? "",
      );
    }
    validateCandidate(root, review, deps.validate ?? validateIntegration);
    checkBase(root, review);
    review.state = "publishing";
    save(root, review);
    // Evidence and pages first; consumed drafts and job receipts last. Original bytes remain in the manifest.
    const priority = (w: Write) =>
      w.path.startsWith("wiki/raw/")
        ? 0
        : w.path.startsWith("wiki/_drafts/")
          ? 2
          : w.path.startsWith("wiki/_jobs/")
            ? 3
            : 1;
    for (const write of [...review.payload.writes].sort((a, b) => priority(a) - priority(b))) {
      if (DERIVED.has(write.path)) continue;
      const actual = optionalText(root, write.path);
      if (actual === write.after) continue;
      if (actual !== write.before) throw new Error(`发布期间内容被修改：${write.path}`);
      replaceText(root, write.path, write.after);
      deps.afterWrite?.(write.path);
    }
    if (review.payload.log) appendLog(root, review.payload.log);
    if (runBuild(root).problems) throw new Error("发布后重建注册表与目录失败");
    for (const write of review.payload.writes)
      if (!DERIVED.has(write.path) && optionalText(root, write.path) !== write.after)
        throw new Error(`发布后核对失败：${write.path}`);
    checkBase(root, review);
    review.state = "published";
    save(root, review);
    return review;
  });
}

export async function rejectReview(root: string, id: string, reason: string): Promise<Review> {
  if (!reason.trim()) throw new Error("驳回需填写原因");
  return new WorkflowStore(root).locked(() => {
    const review = readReview(root, id);
    if (review.state === "rejected") return review;
    if (review.state !== "pending") throw new Error("只能驳回尚未批准的 revision");
    review.state = "rejected";
    review.reason = reason.trim();
    save(root, review);
    return review;
  });
}
