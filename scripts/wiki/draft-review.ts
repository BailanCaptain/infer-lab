import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import type { RunAgent } from "./batch";
import { loadHandbook } from "./handbook";
import { integrationSchema, localDate, selectRelevantPages } from "./ingest";
import { validateIntegration } from "./integration-check";
import { runStagedIntegration } from "./integration-run";
import { loadPages, parsePage } from "./pages";
import { configuredRepoRoots } from "./repo-roots";
import { listReviews } from "./review";
import { localFile } from "./review-files";
import { runStructured, STRUCTURED_INPUT_LIMIT } from "./structured";
import { digest } from "./workflow";
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
  const prior = listReviews(root).find((r) => r.payload.base[path] === digest(text));
  if (prior) return { reviewId: prior.id, state: prior.state };
  const parsed = parsePage(`_drafts/${id}.md`, text);
  if (!parsed.page || parsed.problems.length) throw new Error("整合草稿无效");
  const roots = configuredRepoRoots(root);
  const request = {
    id: "_integrate",
    cwd: "",
    args: [],
    stdin: "",
    timeoutMs: 60_000,
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
      const hits = retrieve(
        `${parsed.page!.fm.title} ${parsed.page!.fm.summary}`,
        buildIndex(loaded.pages.map((p) => ({ ...p.fm, text: p.body }))),
      );
      let selected = loaded.pages
        .filter((p) => refs.some((r) => r.id === p.fm.id) || hits.slice(0, 3).some((h) => h.id === p.fm.id))
        .sort((a, b) => Number(b.fm.id === id) - Number(a.fm.id === id))
        .slice(0, 6);
      const handbook = loadHandbook(req.cwd);
      const schema = z
        .object({
          pages: z.array(z.object({ path: z.string(), text: z.string().min(1) }).strict()).max(7),
          decision: integrationSchema,
        })
        .strict();
      const packet = () => ({
        mode: "draft-integration",
        draft: { id, text },
        pages: selected.map((p) => ({
          id: p.fm.id,
          path: p.file,
          text: readFileSync(join(req.cwd, p.file), "utf8"),
        })),
        inventory: loaded.pages.map((p) => ({ id: p.fm.id, summary: p.fm.summary })),
      });
      while (
        JSON.stringify(packet()).length > STRUCTURED_INPUT_LIMIT &&
        selected.length &&
        selected.at(-1)!.fm.id !== id
      )
        selected = selected.slice(0, -1);
      const sources = new Set([...parsed.page!.fm.sources, ...selected.flatMap((p) => p.fm.sources)]);
      const decision = await runStructured(
        root,
        {
          kind: "draft-integration-v1",
          origin: parsed.page!.fm.origin,
          policy,
          data: packet(),
          rules: `${handbook.pageFormat}\n${handbook.integrate}\n本次无文件工具，只返回严格 JSON {"pages":[{"path":"sources/id.md","text":"完整 Markdown"}],"decision":{"promoted":[],"merged":[],"rejected":[],"contradictions":[],"revisions":[]}}。按整合规则判断更新、合并、补关系与矛盾，decision 必须恰好处置本草稿。只可修改已提供全文的页或创建与草稿同 id 的页；材料不足时拒收并说明。来源必须来自草稿或提供的旧页，禁止凭索引补事实。`,
          schema,
        },
        deps,
      );
      const paths = new Set<string>();
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
      writeFileSync(join(req.cwd, "_drafts/_integration.json"), JSON.stringify(decision.value.decision));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
    },
  });
  return { reviewId: result.reviewId, state: "pending" };
}
