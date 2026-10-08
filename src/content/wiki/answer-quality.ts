import { z } from "zod";

export const answerQualitySchema = z
  .object({
    satisfied: z.boolean().nullable(),
    classification: z.enum([
      "covered",
      "answer-error",
      "missing-knowledge",
      "retrieval-miss",
      "outdated",
      "undetermined",
    ]),
    reason: z.string().trim().min(1).max(2000),
    answerQuote: z.string().max(2000),
    evidence: z
      .array(z.object({ pageId: z.string().min(1), quote: z.string().min(1).max(2000) }).strict())
      .max(12),
  })
  .strict();

export type AnswerQuality =
  | { status: "checking" }
  | { status: "unavailable"; reason: string }
  | { status: "checked"; jobId: string; revision: string; decision: z.infer<typeof answerQualitySchema> };

export const QUALITY_LABELS = {
  covered: "材料支持回答",
  "answer-error": "回答与材料不符",
  "missing-knowledge": "所查材料缺少所需知识",
  "retrieval-miss": "已有知识未被回答利用",
  outdated: "版本不适用",
  undetermined: "证据不足，尚未判明",
} as const;
