import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { CHAPTER_IDS } from "../../src/content/wiki/chapters";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import type { RunAgent } from "./batch";
import { inputByteLimit, jsonBytes } from "./context-window";
import { auditPageFactDispositionsWithAgent } from "./fact-disposition-agent";
import { loadHandbook } from "./handbook";
import { integrationSchema, localDate, selectRelevantPages } from "./ingest";
import { validateIntegration } from "./integration-check";
import { runStagedIntegration } from "./integration-run";
import { lintPages, splitProblems, wikiFileExists } from "./lint";
import { readLongMaterial } from "./long-material";
import { relevantPageIds } from "./navigation";
import { loadPages, parsePage, type WikiPage } from "./pages";
import { configuredRepoRoots } from "./repo-roots";
import { isEmptyReview, listReviews, type Review, readReview, retireReview } from "./review";
import { localFile } from "./review-files";
import { revisePage } from "./revisions";
import { integrateSections } from "./section-integration";
import { PAGE_TEXT_TIMEOUT_MS, runStructured } from "./structured";
import { digest, WorkflowStore } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

/** A compiled draft becomes a complete cross-page proposal, never an automatic publication. */
export async function prepareDraftReview(
  root: string,
  id: string,
  policy: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  const path = `wiki/_drafts/${id}.md`;
  const text = readFileSync(localFile(root, path), "utf8");
  const matching = listReviews(root).filter((r) => r.payload.base[path] === digest(text));
  const prior = matching.find((r) => r.state !== "rejected") ?? matching[0];
  const finish = async (review: Review) => {
    if (review.state === "pending" && isEmptyReview(review))
      review = await retireReview(
        root,
        review.id,
        "本次整合没有文件、日志或矛盾变更；保留材料和判定，不生成空待审",
      );
    return { reviewId: review.id, state: review.state };
  };
  if (prior) return finish(prior);
  const parsed = parsePage(`_drafts/${id}.md`, text);
  if (!parsed.page || parsed.problems.length) throw new Error("整合草稿无效");
  const roots = configuredRepoRoots(root);
  const request = {
    id: "_integrate",
    cwd: "",
    args: [],
    stdin: "",
    timeoutMs: PAGE_TEXT_TIMEOUT_MS,
    allowedWrites: ["concepts/**", "params/**", "sources/**", "_drafts/_integration.json"],
  };
  const result = await runStagedIntegration(root, request, [id], localDate(), {
    repoRoots: roots,
    validate: (stage) => validateIntegration(stage, roots),
    runAgent: async (req) => {
      const loaded = loadPages(req.cwd);
      if (loaded.problems.length) throw new Error("现有页面无法解析");
      const toRef = (p: NonNullable<typeof parsed.page>) => ({ ...p.fm, file: p.file });
      const refs = selectRelevantPages([toRef(parsed.page!)], loaded.pages.map(toRef), { max: 6 });
      const query = `${parsed.page!.fm.title} ${parsed.page!.fm.summary}`;
      const index = buildIndex(loaded.pages.map((p) => ({ ...p.fm, text: p.body })));
      const hits = retrieve(query, index);
      let selected = loaded.pages
        .filter((p) => refs.some((r) => r.id === p.fm.id) || hits.slice(0, 3).some((h) => h.id === p.fm.id))
        .sort((a, b) => Number(b.fm.id === id) - Number(a.fm.id === id))
        .slice(0, 6);
      const related = selected;
      // 目录只列相关页、仅供定位：带全库 id 与摘要时 104 页就占 13,838 字符（2026-09-23），库一大单它就超上限
      const catalog = relevantPageIds(index, {
        ids: selected.map((p) => p.fm.id),
        nodes: [toRef(parsed.page!)],
        query,
      });
      const byId = new Map(loaded.pages.map((p) => [p.fm.id, p.fm]));
      const existing = selected.find((p) => p.fm.id === id);
      const handbook = loadHandbook(
        req.cwd,
        `${parsed.page!.body}\n${existing?.body ?? ""}\n${parsed.page!.fm.sources.join("\n")}\n${existing?.fm.sources.join("\n") ?? ""}`,
        true,
      );
      const writingRules = `${handbook.pageFormat}\n${handbook.integrate}`;
      const rules = `${writingRules}\n本次无文件工具，只返回严格 JSON {"pages":[{"path":"sources/id.md","text":"完整 Markdown"}],"decision":{"promoted":[],"merged":[],"rejected":[],"contradictions":[],"revisions":[]}}。按整合规则判断更新、合并、补关系与矛盾，decision 必须恰好处置本草稿。只可修改已提供全文的页或创建与草稿同 id 的页；材料不足时拒收并说明。来源必须来自草稿或提供的旧页。catalog 只列相关页、仅供定位（catalogOmitted 是没列出的页数），禁止凭它补事实。`;
      const budget = inputByteLimit(root, rules);
      const schema = z
        .object({
          pages: z.array(z.object({ path: z.string(), text: z.string().min(1) }).strict()).max(7),
          decision: integrationSchema,
        })
        .strict()
        .superRefine((value, ctx) => {
          const candidates: WikiPage[] = [];
          const allowedSources = new Set([
            ...parsed.page!.fm.sources,
            ...selected.flatMap((p) => p.fm.sources),
          ]);
          for (const [index, output] of value.pages.entries()) {
            const checked = parsePage(output.path, output.text);
            if (
              !checked.page ||
              checked.problems.length ||
              checked.page.fm.sources.some((source) => !allowedSources.has(source))
            ) {
              ctx.addIssue({
                code: "custom",
                path: ["pages", index, "text"],
                message: "整合输出含未提供的来源或无效页面",
              });
              continue;
            }
            candidates.push(checked.page);
            const previous = selected.find((p) => p.file === output.path);
            if (previous)
              try {
                revisePage(
                  output.path,
                  readFileSync(join(req.cwd, previous.file), "utf8"),
                  output.text,
                  value.decision.revisions?.find((r) => r.id === previous.fm.id),
                  localDate(),
                  { skipFactDisposition: true },
                );
              } catch (error) {
                ctx.addIssue({
                  code: "custom",
                  path: ["pages", index, "text"],
                  params: {
                    rule: String(error).includes("补充修订不能删改")
                      ? "supplement-preservation"
                      : "revision-history",
                  },
                  message: String(error),
                });
              }
          }
          const candidateFiles = new Set(candidates.map((p) => p.file));
          for (const problem of splitProblems(
            lintPages([...loaded.pages.filter((p) => !candidateFiles.has(p.file)), ...candidates], {
              chapterIds: CHAPTER_IDS,
              existsFile: wikiFileExists(req.cwd),
            }),
          ).errors)
            ctx.addIssue({
              code: "custom",
              path: [
                "pages",
                Math.max(
                  0,
                  value.pages.findIndex((p) => p.path === problem.file),
                ),
                "text",
              ],
              params: { rule: problem.rule },
              message: `${problem.rule}: ${problem.message}`,
            });
        });
      const packet = () => ({
        mode: "draft-integration",
        draft: { id, text },
        pages: selected.map((p) => ({
          id: p.fm.id,
          path: p.file,
          text: readFileSync(join(req.cwd, p.file), "utf8"),
        })),
        catalog: catalog.ids.map((pid) => ({
          id: pid,
          title: byId.get(pid)!.title,
          summary: byId.get(pid)!.summary,
        })),
        catalogOmitted: catalog.omitted,
      });
      while (jsonBytes(packet()) > budget && selected.length && selected.at(-1)!.fm.id !== id)
        selected = selected.slice(0, -1);
      if (selected.some((p) => p.fm.id === id)) {
        const previous = selected.find((p) => p.fm.id === id)!;
        const changed = await integrateSections(
          root,
          {
            path: previous.file,
            previous: readFileSync(join(req.cwd, previous.file), "utf8"),
            draft: text,
            rules: writingRules,
            policy,
          },
          deps,
        );
        if (changed) writeFileSync(join(req.cwd, previous.file), changed.text);
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({
            promoted: [],
            merged: changed ? [{ from: id, into: id }] : [],
            rejected: changed ? [] : [{ id, reason: "逐段核对未找到需更改正文的新证据；保持现有内容" }],
            contradictions: [],
            revisions: changed ? [changed.revision] : [],
          }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
      }
      if (jsonBytes(packet()) > budget) {
        const assessmentRules = `${handbook.integrate}
这是一份已编译但超过单次窗口的新草稿。根据逐段阅读后的引文判断收录位置，只返回 {"action":"promote|merge|reject","target":"合并目标 id，仅 merge 时提供","reason":"依据和限制"}。promote 会原样保留完整草稿供人工审阅；merge 只可选提供的现有页；证据不足则 reject。摘要不是事实原文，不能据遗漏断言没有内容。`;
        const assessmentBudget = inputByteLimit(root, assessmentRules);
        const sources = [
          { source: `_drafts/${id}.md`, text },
          ...related.map((p) => ({ source: p.file, text: readFileSync(join(req.cwd, p.file), "utf8") })),
        ];
        const evidence = await readLongMaterial(
          root,
          {
            topic: `${parsed.page!.fm.title}：与所给现有页的重复、补充和独立主题边界`,
            sources,
            maxBytes: assessmentBudget - 8192,
            origin: parsed.page!.fm.origin,
            policy,
          },
          deps,
        );
        const assessment = await runStructured(
          root,
          {
            kind: "long-draft-assessment-v1",
            origin: parsed.page!.fm.origin,
            policy,
            rules: assessmentRules,
            data: { mode: "long-draft-assessment", id, candidates: related.map((p) => p.fm.id), evidence },
            maxInputChars: assessmentBudget,
            timeoutMs: PAGE_TEXT_TIMEOUT_MS,
            schema: z
              .object({
                action: z.enum(["promote", "merge", "reject"]),
                target: z.string().optional(),
                reason: z.string().min(1).max(2000),
              })
              .strict()
              .superRefine((value, ctx) => {
                if (value.action === "merge" && !related.some((p) => p.fm.id === value.target))
                  ctx.addIssue({ code: "custom", message: "合并目标不在提供的现有页中" });
                if (value.action !== "merge" && value.target)
                  ctx.addIssue({ code: "custom", message: "非合并决策不应包含目标" });
              }),
          },
          deps,
        );
        const decision = assessment.value;
        const previous = related.find((p) => p.fm.id === decision.target);
        const changed =
          decision.action === "merge" && previous
            ? await integrateSections(
                root,
                {
                  path: previous.file,
                  previous: readFileSync(join(req.cwd, previous.file), "utf8"),
                  draft: text,
                  draftId: id,
                  rules: writingRules,
                  policy,
                },
                deps,
              )
            : undefined;
        if (changed && previous) writeFileSync(join(req.cwd, previous.file), changed.text);
        if (decision.action === "promote") {
          const directory =
            parsed.page!.fm.type === "param"
              ? "params"
              : parsed.page!.fm.type === "source" || parsed.page!.fm.type === "pr"
                ? "sources"
                : "concepts";
          mkdirSync(join(req.cwd, directory), { recursive: true });
          const original = matter(text);
          writeFileSync(
            join(req.cwd, directory, `${id}.md`),
            matter.stringify(original.content, { ...original.data, updated: localDate() }),
          );
        }
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({
            promoted: decision.action === "promote" ? [id] : [],
            merged: changed && previous ? [{ from: id, into: previous.fm.id }] : [],
            rejected:
              decision.action === "reject" || (decision.action === "merge" && !changed)
                ? [{ id, reason: decision.reason }]
                : [],
            contradictions: [],
            revisions: changed ? [changed.revision] : [],
          }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
      }
      const sources = new Set([...parsed.page!.fm.sources, ...selected.flatMap((p) => p.fm.sources)]);
      const decision = await runStructured(
        root,
        {
          kind: "draft-integration-v1",
          origin: parsed.page!.fm.origin,
          policy,
          data: packet(),
          timeoutMs: PAGE_TEXT_TIMEOUT_MS,
          rules,
          maxInputChars: budget,
          schema,
        },
        deps,
      );
      const paths = new Set<string>();
      const siblingWrites = decision.value.pages.map((p) => {
        const prev = selected.find((s) => s.file === p.path);
        return {
          path: `wiki/${p.path}`,
          before: prev ? readFileSync(join(req.cwd, prev.file), "utf8") : null,
          after: p.text,
        };
      });
      const updatedDecision = {
        ...decision.value.decision,
        revisions: decision.value.decision.revisions ? [...decision.value.decision.revisions] : undefined,
      };
      for (const page of decision.value.pages) {
        const prev = selected.find((s) => s.file === page.path);
        if (!prev || !updatedDecision.revisions) continue;
        const revIdx = updatedDecision.revisions.findIndex((r) => r.id === prev.fm.id);
        const rev = revIdx >= 0 ? updatedDecision.revisions[revIdx] : undefined;
        if (!rev || (rev.kind !== "editorial" && rev.kind !== "supersede")) continue;
        try {
          const entries = await auditPageFactDispositionsWithAgent(
            root,
            {
              path: page.path,
              before: readFileSync(join(req.cwd, prev.file), "utf8"),
              after: page.text,
              revision: rev,
              siblingWrites,
              origin: parsed.page!.fm.origin,
              policy,
            },
            deps,
          );
          updatedDecision.revisions[revIdx] = { ...rev, factDispositions: entries };
        } catch (error) {
          const store = new WorkflowStore(root);
          const job = store.get(decision.jobId);
          const hash = job.artifacts?.[`_jobs/decisions/${decision.jobId}.json`];
          if (job.state === "draft" && hash) {
            await store.rejectCachedDecision(
              decision.jobId,
              hash,
              JSON.stringify([
                {
                  code: "custom",
                  path: ["pages"],
                  params: { rule: "editorial-fact-disposition" },
                  message: String(error),
                },
              ]),
            );
          }
          throw error;
        }
      }
      for (const page of decision.value.pages) {
        if (
          !/^(concepts|params|sources)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(page.path) ||
          paths.has(page.path)
        )
          throw new Error("整合输出路径无效或重复");
        paths.add(page.path);
        if (!selected.some((p) => p.file === page.path) && page.path.split("/").at(-1) !== `${id}.md`)
          throw new Error("整合试图改写未提供全文的页");
        const checked = parsePage(page.path, page.text);
        if (
          !checked.page ||
          checked.problems.length ||
          checked.page.fm.sources.some((source) => !sources.has(source))
        )
          throw new Error("整合输出含未提供的来源或无效页面");
        const target = join(req.cwd, page.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, page.text);
      }
      writeFileSync(join(req.cwd, "_drafts/_integration.json"), JSON.stringify(updatedDecision));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
    },
  });
  return finish(readReview(root, result.reviewId));
}
