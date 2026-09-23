import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import { relationSchema } from "../../src/content/wiki/schema";
import type { RunAgent } from "./batch";
import { loadPages } from "./pages";
import { proposePages, wikiContents } from "./proposal";
import { configuredRepoRoots } from "./repo-roots";
import { localFile } from "./review-files";
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
  const fits = (batch: WikiPageEntry[]) =>
    JSON.stringify(reconcileInput(batch)).length <= STRUCTURED_INPUT_LIMIT * 0.9;
  const covered = new Set<string>();
  return pages
    .sort((a, b) => a.fm.id.localeCompare(b.fm.id))
    .flatMap((page) => {
      if (covered.has(page.fm.id)) return [];
      covered.add(page.fm.id);
      // 单页就装不下的页永远会被判超量，不排进去（2026-09-23 全库最长一页 13,259 字符，远不到）
      if (!fits([page])) return [];
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
        if (near && fits([...selected, candidate])) {
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
        if (!has(d.a) || !has(d.b) || d.a === d.b)
          ctx.addIssue({ code: "custom", message: "重复页引用无效" });
    });
  const decision = await runStructured(
    root,
    {
      kind: "reconcile-v1",
      origin: "seed",
      data: reconcileInput(selected),
      rules:
        '检查提供的页面正文，返回严格 JSON {"relations":[{"from":"id","relation":{"to":"id","kind":"builds-on|variant-of|conflicts-with|alternative-to","note":"关系说明"},"evidence":[{"page":"id","text":"逐字引文"}]}],"contradictions":[{"a":{"page":"id","text":"引文"},"b":{"page":"id","text":"引文"},"reason":"理由"}],"duplicates":[{"a":"id","b":"id","reason":"理由"}]}。只提出缺失的声明方向；不要写反向边。引文必须来自提供正文，不能把同词出现当作关系成立。矛盾和重复只提待审线索，不删除页、不改写事实。',
      schema,
      policy,
      timeoutMs: PAGE_TEXT_TIMEOUT_MS,
    },
    deps,
  );
  const updates = new Map<string, string>();
  for (const item of decision.value.relations) {
    const page = selected.find((p) => p.fm.id === item.from)!;
    if (page.fm.relations.some((r) => r.to === item.relation.to && r.kind === item.relation.kind)) continue;
    const path = `wiki/${page.file}`;
    const parsed = matter(updates.get(path) ?? before.get(path)!);
    const relations = parsed.data.relations ?? [];
    if (
      !relations.some(
        (r: z.infer<typeof relationSchema>) => r.to === item.relation.to && r.kind === item.relation.kind,
      )
    )
      relations.push(item.relation);
    updates.set(path, matter.stringify(parsed.content, { ...parsed.data, relations }));
  }
  const review = updates.size
    ? await proposePages(
        root,
        before,
        updates,
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
      )
    : undefined;
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
  maxBatches: number,
  policy: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  if (!Number.isInteger(maxBatches) || maxBatches < 1) throw new Error("max-batches 必须是正整数");
  const batches = reconcileBatches(root).map((b) => b.map((p) => p.fm.id));
  if (!batches.length) return { totalBatches: 0, results: [] };
  const path = localFile(root, "wiki/_jobs/reconcile/cursor.json");
  const planHash = digest(JSON.stringify(batches));
  const stored = existsSync(path)
    ? z
        .object({ planHash: z.string(), next: z.number().int().nonnegative() })
        .parse(JSON.parse(readFileSync(path, "utf8")))
    : undefined;
  const start = stored?.planHash === planHash ? stored.next % batches.length : 0;
  const results = [];
  for (let i = 0; i < Math.min(maxBatches, batches.length); i++) {
    const index = (start + i) % batches.length;
    results.push(await reconcileBatch(root, batches[index]!, policy, deps));
    await new WorkflowStore(root).locked(() => {
      mkdirSync(localFile(root, "wiki/_jobs/reconcile"), { recursive: true });
      atomicText(path, JSON.stringify({ planHash, next: (index + 1) % batches.length }));
    });
  }
  return {
    totalBatches: batches.length,
    processed: results.length,
    next: (start + results.length) % batches.length,
    results,
  };
}
