import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseRepoRef } from "../../src/content/wiki/schema";
import { sourceLines } from "./audit";
import { type RunAgent, runPool } from "./batch";
import { inputByteLimit, jsonBytes } from "./context-window";
import { gitText } from "./git";
import { loadHandbook } from "./handbook";
import { readLongMaterial } from "./long-material";
import { driftStatus, recordDrift } from "./maintenance";
import { loadPages } from "./pages";
import { saveRawSnapshot } from "./raw";
import { configuredRepoRoots } from "./repo-roots";
import { PAGE_TEXT_TIMEOUT_MS, runStructured } from "./structured";
import { atomicText, digest } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

export async function detectDrift(
  root: string,
  /** seeds 不给就读 wiki/seeds/ 下全部仓库表：页面会引用 vllm-ascend、vllm、rfork 等多份配置里的仓库 */
  options: {
    sample: number | null;
    threshold?: number;
    seeds?: string;
    policy: WorkflowPolicy;
    ids?: string[];
  },
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  if (
    options.sample !== null &&
    (!Number.isInteger(options.sample) || options.sample < 1 || options.sample > 10)
  )
    throw new Error("每轮 drift 抽样需要 1–10 页");
  const repoRoots = configuredRepoRoots(root, options.seeds);
  const loaded = loadPages(join(root, "wiki"));
  if (loaded.problems.length) throw new Error("页面解析失败");
  const pages = loaded.pages
    .filter((p) => !options.ids || options.ids.includes(p.fm.id))
    .sort((a, b) => a.fm.updated.localeCompare(b.fm.updated) || a.fm.id.localeCompare(b.fm.id))
    .slice(0, options.sample ?? undefined);
  const results: ({
    page: string;
    status: string;
    reason?: string;
    error?: string;
  } & Partial<Awaited<ReturnType<typeof recordDrift>>>)[] = [];
  await runPool(pages, options.sample === null ? 3 : 1, async (page) => {
    try {
      const sources = page.fm.sources.flatMap((source) => {
        const ref = parseRepoRef(source);
        if (!ref) return [];
        const repoRoot = repoRoots[ref.repo];
        if (!repoRoot) throw new Error(`未配置来源仓库 ${ref.repo}`);
        const text = gitText(repoRoot, ["show", `${ref.commit}:${ref.path}`]);
        const lines = sourceLines(text);
        const start = ref.lineStart ?? 1;
        const end = ref.lineEnd ?? ref.lineStart ?? lines.length;
        if (end > lines.length) throw new Error("drift 来源行号越界");
        return [{ source, text: lines.slice(start - 1, end).join("\n") }];
      });
      if (!sources.length) {
        results.push({
          page: page.fm.id,
          status: "needs-source",
          reason: "该页没有可在本地重提取的源码引用；未调用模型",
        });
        return;
      }
      const original = sources.map((s) => `${s.source}\n\n${s.text}`).join("\n\n");
      const source = `raw:sha256-${digest(original)}.md#L1-L${sourceLines(original).length}`;
      const previous = driftStatus(root, page.fm.id, source, options.threshold);
      if (previous) {
        results.push({ page: page.fm.id, ...previous });
        return;
      }
      saveRawSnapshot(join(root, "wiki"), original);
      const rules = `${loadHandbook(join(root, "wiki")).extract}\n基于所给来源重提取正文，只返回 JSON {"body":"markdown 正文"}；没有提供旧正文，不依据模型记忆补事实。若收到分段摘录，note 只是解释，事实以 quote 为准，缺少证据的部分明确保留缺口。`;
      const budget = inputByteLimit(root, rules);
      const data = {
        topic: page.fm.title,
        sources: sources as unknown,
      };
      if (jsonBytes(data) > budget)
        data.sources = await readLongMaterial(
          root,
          {
            topic: page.fm.title,
            sources,
            maxBytes: budget - 4096,
            origin: page.fm.origin,
            policy: options.policy,
          },
          deps,
        );
      const extracted = await runStructured(
        root,
        {
          kind: "drift-extract-v1",
          // A page may cite many complete source ranges. Keep them intact; the small-JSON
          // decision limit is not the evidence window for a whole-page re-extraction.
          maxInputChars: budget,
          origin: page.fm.origin,
          data,
          rules,
          schema: z.object({ body: z.string().min(1).max(30_000) }).strict(),
          policy: options.policy,
          timeoutMs: PAGE_TEXT_TIMEOUT_MS,
        },
        deps,
      );
      results.push({
        page: page.fm.id,
        status: "checked",
        ...(await recordDrift(root, page.fm.id, page.file, extracted.value.body, source, options.threshold)),
      });
    } catch (error) {
      results.push({ page: page.fm.id, status: "failed", error: String(error) });
    } finally {
      const dir = join(root, "wiki/_jobs/drift");
      mkdirSync(dir, { recursive: true });
      atomicText(join(dir, "last-run.json"), JSON.stringify({ total: pages.length, results }, null, 2));
    }
  });
  return results;
}
