import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import type { RunAgent } from "../scripts/wiki/batch";
import { budgetedAgent } from "../scripts/wiki/budget";
import { compileRaw, planRawCompile } from "../scripts/wiki/compile-raw";
import { loadHandbook } from "../scripts/wiki/handbook";
import { localDate } from "../scripts/wiki/ingest";
import { validateIntegration } from "../scripts/wiki/integration-check";
import { prepareSourceReview } from "../scripts/wiki/integration-run";
import { configuredRepoRoots } from "../scripts/wiki/repo-roots";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { runRestrictedClaude } from "../scripts/wiki/restricted-claude";
import { listReviews, readReview } from "../scripts/wiki/review";
import { localFile } from "../scripts/wiki/review-files";
import { atomicText, digest, WorkflowStore, workIdentity } from "../scripts/wiki/workflow";
import { citedPageLinks, matchesCitedPage } from "../src/content/wiki/retrieve";
import { checkAnswerCitations } from "./citations";
import { checkWriter, HttpError, readJson, send } from "./http";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const receiptSchema = z
  .object({
    question: z.string().min(1),
    answer: z.string().min(1),
    pages: z.array(z.object({ file: z.string(), text: z.string() })).min(1),
  })
  .strict();
const mappingSchema = z
  .object({ jobId: hash, budgetUsd: z.number().positive(), raw: z.string(), rules: z.string() })
  .strict();
export const saveAnswerInput = z
  .object({ budgetUsd: z.number().finite().positive(), retry: z.boolean().optional() })
  .strict();
const recordPath = (id: string) => `wiki/_jobs/answers/${hash.parse(id)}.json`;
const mappingPath = (id: string) => `wiki/_jobs/answer-saves/${hash.parse(id)}.json`;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Called only for a complete successful server answer, never with client-supplied replacement text. */
export async function captureAnswer(
  root: string,
  question: string,
  answer: string,
  pages: { file: string; text: string }[],
): Promise<string | undefined> {
  if (!checkAnswerCitations(answer, pages).cited) return undefined;
  const links = citedPageLinks(answer);
  const selected = pages.filter((p) => links.some((href) => matchesCitedPage(href, p.file)));
  if (!selected.length || Buffer.byteLength(answer) > 128 * 1024) return undefined;
  const record = receiptSchema.parse({
    question,
    answer,
    pages: selected.sort((a, b) => a.file.localeCompare(b.file)),
  });
  if (Buffer.byteLength(json(record)) > 900 * 1024) return undefined;
  const id = digest(JSON.stringify(record));
  return new WorkflowStore(root).locked(() => {
    if (listReviews(root).some((r) => r.state === "publishing")) return undefined;
    for (const page of selected) {
      const source = localFile(root, `wiki/${page.file}`);
      if (!existsSync(source) || readFileSync(source, "utf8") !== page.text) return undefined;
    }
    const path = localFile(root, recordPath(id));
    mkdirSync(join(root, "wiki/_jobs/answers"), { recursive: true });
    if (!existsSync(path)) atomicText(path, json(record));
    return id;
  });
}

export async function saveAnswer(
  root: string,
  id: string,
  input: z.infer<typeof saveAnswerInput>,
  deps: { runAgent?: RunAgent } = {},
) {
  const checked = saveAnswerInput.parse(input);
  const receipt = receiptSchema.parse(JSON.parse(readFileSync(localFile(root, recordPath(id)), "utf8")));
  if (digest(JSON.stringify(receipt)) !== id) throw new Error("回答记录已改变，不能保存");
  const citations = checkAnswerCitations(receipt.answer, receipt.pages);
  if (!citations.cited) throw new Error(`回答引用检查未通过：${citations.reason}`);
  const store = new WorkflowStore(root);
  const answerPages = receipt.pages.map((p) => p.file.split("/").at(-1)!.slice(0, -3)).sort();
  const mapping = await store.locked(() => {
    const path = localFile(root, mappingPath(id));
    if (existsSync(path)) {
      const old = mappingSchema.parse(JSON.parse(readFileSync(path, "utf8")));
      if (old.budgetUsd !== checked.budgetUsd) throw new Error("已有保存任务的预算不能更改或重置");
      return old;
    }
    const bundle = json({
      kind: "answer-record",
      question: receipt.question,
      answer: receipt.answer,
      citedPages: receipt.pages,
    });
    const raw = saveRawSnapshot(join(root, "wiki"), bundle);
    const rules = loadHandbook(join(root, "wiki")).pageFormat;
    const planned = planRawCompile(root, {
      id: `answer-${id}`,
      origin: "chat",
      source: `raw:${raw.slice(4)}#L1-L${bundle.trimEnd().split("\n").length}`,
      rules,
      timeoutMs: 10 * 60_000,
      purpose: "answer-record",
      answerPages,
    });
    // Job identity follows the existing canonical input ordering, including the frozen recipe.
    const { id: jobId } = workIdentity(planned.work);
    const value = { jobId, budgetUsd: checked.budgetUsd, raw: planned.prepared.receipt.source, rules };
    mkdirSync(join(root, "wiki/_jobs/answer-saves"), { recursive: true });
    atomicText(path, json(value));
    return value;
  });
  const prior = listReviews(root).find(
    (r) => r.payload.base[`wiki/_jobs/${mapping.jobId}.json`] !== undefined,
  );
  if (prior) return { jobId: mapping.jobId, reviewId: prior.id, state: prior.state };
  const policy = { maxAttempts: 2, maxCostUsd: mapping.budgetUsd, reserveUsd: mapping.budgetUsd / 2 };
  const existing = store.list().find((job) => job.id === mapping.jobId);
  if (existing?.state === "running") throw new Error("正在编译这条回答，请稍后查看");
  const result =
    existing?.state === "draft" && store.matchesDraft(existing, `answer-${id}`)
      ? { ok: true, jobId: existing.id, reason: "复用草稿" }
      : await compileRaw(
          store,
          {
            id: `answer-${id}`,
            origin: "chat",
            source: mapping.raw,
            rules: mapping.rules,
            timeoutMs: 10 * 60_000,
            purpose: "answer-record",
            answerPages,
          },
          policy,
          {
            runAgent: deps.runAgent ?? budgetedAgent(root, "answer-compile", runRestrictedClaude),
            retry: checked.retry,
          },
        );
  if (!result.ok) throw new Error(result.reason ?? "编译失败；原回答和任务记录已保留");
  const roots = configuredRepoRoots(root);
  const proposal = await prepareSourceReview(
    root,
    `answer-${id}`,
    localDate(),
    (stage) => validateIntegration(stage, roots),
    roots,
  );
  return {
    jobId: result.jobId!,
    reviewId: proposal.reviewId,
    state: readReview(root, proposal.reviewId).state,
  };
}

export async function handleAnswers(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  deps: { runAgent?: RunAgent } = {},
): Promise<boolean> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (!path.startsWith("/api/wiki/answers/")) return false;
  try {
    const match = /^\/api\/wiki\/answers\/([a-f0-9]{64})\/save$/.exec(path);
    if (!match) throw new HttpError(400, "需要合法的回答标识");
    if (req.method !== "POST") throw new HttpError(405, "需要 POST");
    checkWriter(req);
    const input = saveAnswerInput.parse(await readJson(req));
    send(res, 200, await saveAnswer(root, match[1]!, input, deps));
  } catch (error) {
    send(
      res,
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : (error as NodeJS.ErrnoException).code === "ENOENT"
            ? 404
            : 409,
      { error: String(error) },
    );
  }
  return true;
}
