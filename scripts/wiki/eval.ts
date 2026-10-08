import { z } from "zod";
import type { BlobRead } from "./git";
import { digest } from "./workflow";

const kinds = ["missing", "holdout", "synthesis", "version", "regression", "no-evidence"] as const;
const nonempty = z.string().trim().min(1);
const suiteSchema = z
  .object({
    id: nonempty,
    missingTerms: z.array(nonempty).min(1),
    evidence: z
      .array(
        z
          .object({
            id: nonempty,
            commit: z.string().regex(/^[a-f0-9]{40}$/),
            path: z
              .string()
              .regex(/^[a-zA-Z0-9_./-]+$/)
              .refine((p) => p.split("/").every((part) => part !== "" && part !== "." && part !== "..")),
            start: z.number().int().positive(),
            end: z.number().int().positive(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .min(1),
    cases: z
      .array(
        z
          .object({
            id: nonempty,
            kind: z.enum(kinds),
            question: nonempty,
            requiredFacts: z.array(nonempty).min(1),
            forbiddenClaims: z.array(nonempty).min(1),
            evidenceIds: z.array(nonempty),
            expectedPages: z.array(nonempty),
          })
          .strict(),
      )
      .length(kinds.length),
  })
  .strict();

/** Rubrics stay outside wiki, snapshots and compiler inputs. No model grading here. */
export function verifyEvalSuite(input: unknown, read: (commit: string, path: string) => BlobRead) {
  const suite = suiteSchema.parse(input);
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(suite.cases.map((c) => c.kind)) ||
    !unique(suite.cases.map((c) => c.id)) ||
    !unique(suite.cases.map((c) => c.question)) ||
    !unique(suite.evidence.map((e) => e.id))
  )
    throw new Error("评测场景或证据重复");
  const evidenceIds = new Set(suite.evidence.map((e) => e.id));
  for (const c of suite.cases) {
    if (
      c.evidenceIds.some((id) => !evidenceIds.has(id)) ||
      (c.kind !== "no-evidence" && !c.evidenceIds.length) ||
      (c.kind === "no-evidence" && c.evidenceIds.length)
    )
      throw new Error(`评测证据不完整：${c.id}`);
  }
  for (const e of suite.evidence) {
    const blob = read(e.commit, e.path);
    if (blob.kind !== "ok") throw new Error(`尚未验证：${e.id} (${blob.kind})`);
    if (digest(blob.text) !== e.sha256) throw new Error(`证据内容与固定散列不符：${e.id}`);
    const count = blob.text.replace(/\n$/, "").split("\n").length;
    if (e.start > e.end || e.end > count) throw new Error(`证据行号越界：${e.id}`);
  }
  return { ...suite, revision: digest(JSON.stringify(suite)) };
}

export function checkEvalSnapshot(
  suite: ReturnType<typeof verifyEvalSuite>,
  snapshot: {
    files: { text: string }[];
    pageTexts: { text: string }[];
    registry: { pages: { id: string }[] };
  },
  phase: "before" | "after",
): void {
  const present = suite.missingTerms.filter((term) => snapshot.pageTexts.some((p) => p.text.includes(term)));
  if (phase === "before" && present.length)
    throw new Error(`基线已包含待补主题，请保留原样本并核对历史快照：${present.join(", ")}`);
  for (const c of suite.cases) {
    for (const id of c.expectedPages) {
      if (!snapshot.registry.pages.some((p) => p.id === id)) throw new Error(`回归依赖页不存在：${id}`);
    }
    // Exact wording check only; semantic leakage still needs human review.
    if (
      !(phase === "after" && c.kind === "missing") &&
      snapshot.files.some((p) => p.text.includes(c.question))
    )
      throw new Error(`评测问题已泄漏到知识快照：${c.id}`);
  }
}
