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
import { runStructured } from "./structured";
import { atomicText, digest, WorkflowStore } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

export function reconcileBatches(root: string, maxPages = 6) {
  const { pages, problems } = loadPages(join(root, "wiki"));
  if (problems.length) throw new Error("现有页面解析失败");
  const index = buildIndex(pages.map((p) => ({ ...p.fm, text: p.body })));
  const covered = new Set<string>();
  return pages
    .sort((a, b) => a.fm.id.localeCompare(b.fm.id))
    .flatMap((page) => {
      if (covered.has(page.fm.id)) return [];
      const related = retrieve(`${page.fm.title} ${page.fm.summary}`, index, { expand: true }).map(
        (h) => h.id,
      );
      const selected = [
        page,
        ...pages.filter(
          (p) =>
            p.fm.id !== page.fm.id &&
            (related.includes(p.fm.id) || p.fm.chapters.some((ch) => page.fm.chapters.includes(ch))),
        ),
      ].slice(0, maxPages);
      for (const p of selected) covered.add(p.fm.id);
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
      data: {
        inventory: pages.map((p) => ({ id: p.fm.id, summary: p.fm.summary })),
        pages: selected.map((p) => ({ ...p.fm, body: p.body })),
      },
      rules:
        '检查提供的页面正文，返回严格 JSON {"relations":[{"from":"id","relation":{"to":"id","kind":"builds-on|variant-of|conflicts-with|alternative-to","note":"关系说明"},"evidence":[{"page":"id","text":"逐字引文"}]}],"contradictions":[{"a":{"page":"id","text":"引文"},"b":{"page":"id","text":"引文"},"reason":"理由"}],"duplicates":[{"a":"id","b":"id","reason":"理由"}]}。只提出缺失的声明方向；不要写反向边。引文必须来自提供正文，不能把同词出现当作关系成立。矛盾和重复只提待审线索，不删除页、不改写事实。',
      schema,
      policy,
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
