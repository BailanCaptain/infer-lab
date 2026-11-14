import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import { relationSchema } from "../../src/content/wiki/schema";
import { type RunAgent, runPool } from "./batch";
import { inputByteLimit, jsonBytes } from "./context-window";
import { readLongMaterial } from "./long-material";
import { loadPages } from "./pages";
import { wikiContents } from "./proposal";
import { checkRelationCoverage, relationMaterial } from "./reconcile-quality";
import { configuredRepoRoots } from "./repo-roots";
import { createReviewInLock, listReviews, readReview } from "./review";
import { localFile, optionalText } from "./review-files";
import { PAGE_TEXT_TIMEOUT_MS, runStructured, STRUCTURED_INPUT_LIMIT } from "./structured";
import { atomicText, digest, WorkflowStore } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

type WikiPageEntry = ReturnType<typeof loadPages>["pages"][number];

/**
 * 交叉审视一批送给模型的输入：只有本批几页的全文。分批与执行共用这一个函数，量出来的就是真正送进去的。
 * 2026-09-23 之前还带全库目录（带摘要时 104 页就有 13,838 字符），固定 6 页一批时 68 批没有一批装得进
 * 40,000 字符的上限；而判定结果（补边、矛盾、重复）本来就只能落在本批页之间，目录只会随库变大把批撑爆。
 */
export function reconcileInput(selected: WikiPageEntry[]) {
  return { pages: selected.map((p) => ({ ...p.fm, body: p.body })) };
}

/** 按真实输入大小装批：每批最多 maxPages 页，装到上限的九成为止（留一成给清洗带来的长度变化） */
export function reconcileBatches(root: string, maxPages = 6) {
  const { pages, problems } = loadPages(join(root, "wiki"));
  if (problems.length) throw new Error("现有页面解析失败");
  const index = buildIndex(pages.map((p) => ({ ...p.fm, text: p.body })));
  const inputSize = (batch: WikiPageEntry[]) => JSON.stringify(reconcileInput(batch)).length;
  const covered = new Set<string>();
  return pages
    .sort((a, b) => a.fm.id.localeCompare(b.fm.id))
    .flatMap((page) => {
      if (covered.has(page.fm.id)) return [];
      // 长教学页也须连同相关页核对；沿用完整来源提取的窗口，不能静默遗漏。
      const long = inputSize([page]) > STRUCTURED_INPUT_LIMIT * 0.9;
      const limit = STRUCTURED_INPUT_LIMIT * 0.9;
      const fits = (batch: WikiPageEntry[]) => inputSize(batch) <= limit;
      covered.add(page.fm.id);
      const related = retrieve(`${page.fm.title} ${page.fm.summary}`, index, { expand: true }).map(
        (h) => h.id,
      );
      const selected = [page];
      for (const candidate of pages) {
        if (selected.length >= maxPages) break;
        // 已在别批出现过的页也可以再进来：跨批的相关页才有机会两两比对（沿用原来的分批语义）
        if (candidate.fm.id === page.fm.id) continue;
        const near =
          related.includes(candidate.fm.id) ||
          candidate.fm.chapters.some((ch) => page.fm.chapters.includes(ch));
        if (near && (long || fits([...selected, candidate]))) {
          selected.push(candidate);
          covered.add(candidate.fm.id);
        }
      }
      return [selected];
    });
}
export async function reconcileBatch(
  root: string,
  ids: string[],
  policy: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  const before = wikiContents(root);
  const { pages } = loadPages(join(root, "wiki"));
  const selected = pages.filter((p) => ids.includes(p.fm.id));
  if (!ids.length || ids.length > 6 || selected.length !== new Set(ids).size)
    throw new Error("交叉审视需要 1–6 个现有页");
  const quote = z.object({ page: z.string(), text: z.string().min(1) }).strict();
  const budget = inputByteLimit(root, "");
  const compressed = jsonBytes(reconcileInput(selected)) > budget - 8192;
  const schema = z
    .object({
      relations: z.array(
        z.object({ from: z.string(), relation: relationSchema, evidence: quote.array().min(2) }).strict(),
      ),
      contradictions: z.array(z.object({ a: quote, b: quote, reason: z.string().min(1) }).strict()),
      duplicates: z.array(z.object({ a: z.string(), b: z.string(), reason: z.string().min(1) }).strict()),
    })
    .strict()
    .superRefine((value, ctx) => {
      const has = (id: string) => selected.some((p) => p.fm.id === id);
      const verified = (q: z.infer<typeof quote>) =>
        selected.some((p) => p.fm.id === q.page && p.body.includes(q.text));
      for (const r of value.relations)
        if (
          !has(r.from) ||
          !has(r.relation.to) ||
          r.from === r.relation.to ||
          !r.evidence.some((q) => q.page === r.from) ||
          !r.evidence.some((q) => q.page === r.relation.to) ||
          !r.evidence.every(verified)
        )
          ctx.addIssue({ code: "custom", message: "补边端点或逐字引文不成立" });
      for (const c of value.contradictions)
        if (!verified(c.a) || !verified(c.b) || c.a.page === c.b.page)
          ctx.addIssue({ code: "custom", message: "矛盾未绑定两页原文" });
      for (const d of value.duplicates)
        if (compressed || !has(d.a) || !has(d.b) || d.a === d.b)
          ctx.addIssue({ code: "custom", message: "重复页引用无效" });
    });
  const data = reconcileInput(selected);
  const materialHash = digest(JSON.stringify(selected.map(relationMaterial)));
  const cachePath = localFile(root, `wiki/_jobs/reconcile/material-${materialHash}.json`);
  const cached = existsSync(cachePath)
    ? z
        .object({ jobId: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(JSON.parse(readFileSync(cachePath, "utf8")))
    : undefined;
  if (compressed && !cached) {
    const perPage = Math.floor((budget - 12_000) / selected.length);
    for (const page of data.pages) {
      const excerpt = await readLongMaterial(
        root,
        {
          topic: `${page.title}：查找与 ${ids.join(", ")} 的关系、条件、边界与矛盾`,
          sources: [{ source: page.id, text: page.body }],
          maxBytes: perPage,
          origin: "seed",
          policy,
        },
        deps,
      );
      page.body = excerpt.evidence.map((e) => e.quote).join("\n\n");
    }
  }
  const decision = cached
    ? (() => {
        const job = new WorkflowStore(root).get(cached.jobId);
        const file = `_jobs/decisions/${job.id}.json`;
        const bytes = readFileSync(localFile(root, `wiki/${file}`));
        if (job.state !== "draft" || job.artifacts?.[file] !== digest(bytes))
          throw new Error("关系判定缓存回执已变化");
        return { jobId: job.id, value: schema.parse(JSON.parse(bytes.toString("utf8"))) };
      })()
    : await runStructured(
        root,
        {
          kind: "reconcile-v1",
          maxInputChars: budget,
          origin: "seed",
          data: { ...data, partial: compressed },
          rules:
            '检查提供的页面正文，返回严格 JSON {"relations":[{"from":"a","relation":{"to":"b","kind":"builds-on|variant-of|conflicts-with|alternative-to","note":"关系说明"},"evidence":[{"page":"a","text":"a 页连续逐字引文"},{"page":"b","text":"b 页连续逐字引文"}]}],"contradictions":[{"a":{"page":"id","text":"引文"},"b":{"page":"id","text":"引文"},"reason":"理由"}],"duplicates":[{"a":"id","b":"id","reason":"理由"}]}。每条关系必须分别引用 from 页与 to 页的原文，至少两个端点各一条；from 页中提及或链接 to 页的文字仍只算 from 页证据，不能冒充 to 页引文。只提出缺失的声明方向；不要写反向边。引文必须来自提供正文，不能把同词出现当作关系成立。矛盾的 a.page 与 b.page 必须是不同页面；同页两个章节的差异不属于本轮跨页矛盾。partial=true 表示输入是各页分段阅读后的原文摘录：不能判断整页重复，duplicates 必须为空，也不能据未见内容断言缺失。矛盾和重复只提待审线索，不删除页、不改写事实。',
          schema,
          policy,
          timeoutMs: PAGE_TEXT_TIMEOUT_MS,
        },
        deps,
      );
  const edgeKey = (from: string, to: string, kind: string) => `${[from, to].sort().join("|")}|${kind}`;
  const known = new Set(selected.flatMap((p) => p.fm.relations.map((r) => edgeKey(p.fm.id, r.to, r.kind))));
  for (const prior of listReviews(root).filter((r) => r.state === "pending" || r.state === "publishing"))
    for (const write of prior.payload.writes) {
      if (!/^wiki\/(concepts|params|sources)\//.test(write.path) || !write.after) continue;
      const data = matter(write.after).data;
      for (const relation of data.relations ?? []) known.add(edgeKey(data.id, relation.to, relation.kind));
    }
  const proposals = await runPool(decision.value.relations, 1, async (item) => {
    const pair = [item.from, item.relation.to].map((id) =>
      relationMaterial(selected.find((p) => p.fm.id === id)!),
    );
    const key = digest(JSON.stringify({ pair, relation: item.relation }));
    const path = localFile(root, `wiki/_jobs/reconcile/proposals/${key}.json`);
    if (known.has(edgeKey(item.from, item.relation.to, item.relation.kind)))
      return { item, path, covered: true, reason: "正式或待审关系已存在，不重复核验或入队" };
    if (existsSync(path)) {
      const prior = z
        .object({ reviewId: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(JSON.parse(readFileSync(path, "utf8")));
      if (readReview(root, prior.reviewId).state === "rejected")
        return {
          item,
          path,
          covered: true,
          reason: "相同两页依据和关系已退役，保留原审阅决定",
          priorReviewId: prior.reviewId,
        };
    }
    return { item, path, ...(await checkRelationCoverage(root, item, selected, policy, deps)) };
  });
  const review = await new WorkflowStore(root).locked(() => {
    for (const page of selected)
      if (optionalText(root, `wiki/${page.file}`) !== before.get(`wiki/${page.file}`))
        throw new Error(`关系依据基线在读取时改变：${page.file}`);
    const updates = new Map<string, string>();
    const declared = new Set(
      loadPages(join(root, "wiki")).pages.flatMap((page) =>
        page.fm.relations.map((r) => edgeKey(page.fm.id, r.to, r.kind)),
      ),
    );
    for (const pending of listReviews(root).filter(
      (r) => r.state === "pending" || r.state === "publishing",
    )) {
      for (const write of pending.payload.writes) {
        if (!/^wiki\/(concepts|params|sources)\//.test(write.path) || !write.after) continue;
        const data = matter(write.after).data;
        for (const relation of data.relations ?? [])
          declared.add(edgeKey(data.id, relation.to, relation.kind));
      }
    }
    const included: typeof proposals = [];
    for (const proposal of proposals) {
      if (proposal.covered) continue;
      const { item } = proposal;
      const page = selected.find((p) => p.fm.id === item.from)!;
      const key = edgeKey(item.from, item.relation.to, item.relation.kind);
      // Existing direction wins; inverse navigation is derived, never a second declaration.
      if (declared.has(key)) continue;
      declared.add(key);
      const path = `wiki/${page.file}`;
      const parsed = matter(updates.get(path) ?? before.get(path)!);
      // gray-matter shares cached data: a pending proposal must never mutate future formal-page reads.
      const relations = [...(parsed.data.relations ?? []), item.relation];
      updates.set(path, matter.stringify(parsed.content, { ...parsed.data, relations }));
      included.push(proposal);
    }
    const review = updates.size
      ? createReviewInLock(
          root,
          before,
          new Map([...before, ...updates]),
          {
            promoted: [],
            merged: [],
            rejected: [],
            contradictions: decision.value.contradictions.map((c) => ({
              a: c.a.page,
              b: c.b.page,
              note: c.reason,
            })),
          },
          configuredRepoRoots(root),
          selected.map((p) => `wiki/${p.file}`),
        )
      : undefined;
    if (review)
      for (const proposal of included) {
        mkdirSync(localFile(root, "wiki/_jobs/reconcile/proposals"), { recursive: true });
        atomicText(proposal.path, JSON.stringify({ reviewId: review.id }));
      }
    mkdirSync(localFile(root, "wiki/_jobs/reconcile"), { recursive: true });
    atomicText(cachePath, JSON.stringify({ jobId: decision.jobId }));
    atomicText(
      localFile(root, `wiki/_jobs/reconcile/quality-${decision.jobId}.json`),
      JSON.stringify(
        {
          materialHash,
          decisionJob: decision.jobId,
          reviewId: review?.id,
          relations: proposals.map(({ path: _path, ...result }) => result),
        },
        null,
        2,
      ),
    );
    return review;
  });
  if (decision.value.contradictions.length || decision.value.duplicates.length)
    await new WorkflowStore(root).locked(() => {
      const dir = localFile(root, "wiki/warnings");
      mkdirSync(dir, { recursive: true });
      atomicText(
        join(dir, `reconcile-${decision.jobId}.json`),
        JSON.stringify(
          {
            state: "needs-human-review",
            decisionJob: decision.jobId,
            reviewId: review?.id,
            contradictions: decision.value.contradictions,
            duplicates: decision.value.duplicates,
          },
          null,
          2,
        ),
      );
    });
  return {
    ...decision,
    reviewId: review?.id,
    qualification: "逐字引用已核对；关系、矛盾与判重仍待人工语义审阅",
  };
}

export async function reconcileCycle(
  root: string,
  maxBatches: number | null,
  policy: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  if (maxBatches !== null && (!Number.isInteger(maxBatches) || maxBatches < 1))
    throw new Error("max-batches 必须是正整数");
  const batches = reconcileBatches(root).map((b) => b.map((p) => p.fm.id));
  if (!batches.length) return { totalBatches: 0, processed: 0, results: [], failures: [] };
  const path = localFile(root, "wiki/_jobs/reconcile/cursor.json");
  const planHash = digest(JSON.stringify(batches));
  const stored = existsSync(path)
    ? z
        .object({ planHash: z.string(), next: z.number().int().nonnegative() })
        .parse(JSON.parse(readFileSync(path, "utf8")))
    : undefined;
  const start = stored?.planHash === planHash ? stored.next % batches.length : 0;
  const results: (
    | ({ index: number; ok: true } & Awaited<ReturnType<typeof reconcileBatch>>)
    | { index: number; ok: false; ids: string[]; stage: string; error: string }
  )[] = [];
  const failures: { stage: string; error: string }[] = [];
  const count = Math.min(maxBatches ?? batches.length, batches.length);
  const concurrency = maxBatches === null ? 3 : 1;
  for (let i = 0; i < count; i += concurrency) {
    const round = Array.from(
      { length: Math.min(concurrency, count - i) },
      (_, j) => (start + i + j) % batches.length,
    );
    results.push(
      ...(await runPool(round, concurrency, async (index) => {
        try {
          return { index, ok: true as const, ...(await reconcileBatch(root, batches[index]!, policy, deps)) };
        } catch (error) {
          const failure = { stage: `reconcile:${index}`, error: String(error) };
          failures.push(failure);
          return { index, ok: false as const, ids: batches[index]!, ...failure };
        }
      })),
    );
    await new WorkflowStore(root).locked(() => {
      mkdirSync(localFile(root, "wiki/_jobs/reconcile"), { recursive: true });
      atomicText(path, JSON.stringify({ planHash, next: (start + results.length) % batches.length }));
      atomicText(
        localFile(root, "wiki/_jobs/reconcile/last-run.json"),
        JSON.stringify({ planHash, results, failures }, null, 2),
      );
    });
  }
  return {
    totalBatches: batches.length,
    processed: results.length,
    next: (start + results.length) % batches.length,
    results,
    failures,
  };
}
