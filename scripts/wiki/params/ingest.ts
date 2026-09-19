import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import type { ParamEntry } from "../../../src/content/wiki/schema";
import type { RunAgent } from "../batch";
import { lineageSection, replaceSection } from "../lineage";
import { loadPages } from "../pages";
import { saveRawSnapshot } from "../raw";
import { localFile } from "../review-files";
import { runStructured } from "../structured";
import { atomicText, digest, WorkflowStore } from "../workflow";
import type { WorkflowPolicy } from "../workflow-policy";
import { paramSourceContext } from "./context";
import { buildParamPage, paramId, protectedParamSection } from "./pages";

/** The model supplies prose only. Generated definitions and version tables never enter its output contract. */
export async function ingestParam(
  root: string,
  input: { repo: string; ref: string; commit: string; entry: ParamEntry; source: string },
  policy: WorkflowPolicy,
  deps: { runAgent?: RunAgent; retry?: boolean } = {},
) {
  const id = paramId(input.entry);
  const path = localFile(root, `wiki/params/${id}.md`);
  const previous = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  const existing = loadPages(join(root, "wiki")).pages;
  if (existing.some((p) => p.fm.id !== id && p.fm.type === "param" && p.fm.title === input.entry.name))
    throw new Error("发现同名旧参数页，需先显式迁移映射，拒绝创建重复页");
  const skeleton = buildParamPage({ ...input, date: new Date().toISOString().slice(0, 10) }, previous);
  const prose = z
    .string()
    .min(1)
    .max(6000)
    .refine((s) => !/^##\s/m.test(s), "正文段不能自行创建生成区");
  const schema = z.object({ summary: prose, why: prose, costs: prose, conflicts: prose }).strict();
  const decision = await runStructured(
    root,
    {
      kind: "param-prose-v1",
      origin: "seed",
      data: {
        entry: input.entry,
        source: paramSourceContext(input.entry, input.source),
        previous: previous ?? null,
      },
      rules:
        '只补教学正文，返回 JSON {"summary":"一句话作用","why":"为什么存在","costs":"开启代价","conflicts":"互斥与边界"}。只使用所给源码，事实不足明确待核对。不要生成 frontmatter、参数定义或版本表，不得编造 PR 或默认值。推导标 [D]，猜测标 [I]；不要伪造 C/S 编号。',
      schema,
      policy,
    },
    deps,
  );
  let body = matter(skeleton).content;
  body = replaceSection(body, "## 一句话", `## 一句话\n\n${decision.value.summary}`);
  body = replaceSection(body, "## 为什么存在", `## 为什么存在\n\n${decision.value.why}`);
  body = replaceSection(
    body,
    "## 开了的代价",
    `## 开了的代价\n\n${decision.value.costs}\n\n${decision.value.conflicts}`,
  );
  if (
    protectedParamSection(skeleton) !== protectedParamSection(body) ||
    lineageSection(skeleton) !== lineageSection(body)
  )
    throw new Error("正文补写改变了生成区");
  const raw = saveRawSnapshot(join(root, "wiki"), input.source);
  const text = matter.stringify(body, {
    ...matter(skeleton).data,
    rawSources: [...new Set([...(matter(skeleton).data.rawSources ?? []), raw])],
  });
  const store = new WorkflowStore(root);
  const job = await store.enqueue(
    {
      origin: "seed",
      sources: [{ ref: `decision:${decision.jobId}`, hash: digest(JSON.stringify(decision.value)) }],
      targets: [id],
      recipeHash: digest(skeleton),
    },
    policy,
  );
  if (job.state === "draft") {
    if (!store.matchesDraft(job, id)) throw new Error("已生成参数草稿变化");
    return { jobId: job.id, id };
  }
  const attempt = await store.claim(job.id, deps.retry);
  const draft = `_drafts/${id}.md`;
  const priorDraft = existsSync(localFile(root, `wiki/${draft}`))
    ? readFileSync(localFile(root, `wiki/${draft}`), "utf8")
    : undefined;
  const finished = await store.finish(
    job.id,
    attempt.token,
    { ok: true, costUsd: 0, artifacts: { [draft]: digest(text), [raw]: digest(input.source) } },
    () => {
      const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
      const currentDraft = existsSync(localFile(root, `wiki/${draft}`))
        ? readFileSync(localFile(root, `wiki/${draft}`), "utf8")
        : undefined;
      if (current !== previous || currentDraft !== priorDraft)
        throw new Error("参数页或草稿已变化，拒绝覆盖");
      mkdirSync(localFile(root, "wiki/_drafts"), { recursive: true });
      atomicText(localFile(root, `wiki/${draft}`), text);
    },
  );
  if (finished.state !== "draft") throw new Error("参数正文草稿未采纳");
  return { jobId: job.id, decisionJob: decision.jobId, id };
}
