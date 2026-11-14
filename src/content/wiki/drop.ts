import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const dropBudgetSchema = z
  .object({
    contextWindowTokens: z.number().int().positive(),
    outputReserveTokens: z.number().int().positive(),
    algorithm: z.literal(1),
  })
  .strict();
export const dropRangeSchema = z
  .object({
    id: z.string(),
    hash: sha,
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .strict();
export const dropComparisonSchema = z
  .object({
    page: z.string(),
    quote: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export const dropReceiptSchema = z
  .object({
    protocol: z.literal(3),
    baseline: sha,
    budget: dropBudgetSchema,
    resources: z.array(
      z
        .object({
          id: z.string(),
          path: z.string(),
          kind: z.enum(["source", "reference", "rule", "page", "candidate", "diagram"]),
          hash: sha,
          length: z.number().int().nonnegative(),
          origins: z.array(z.record(z.string())),
        })
        .strict(),
    ),
    requiredReads: z.array(z.string()),
    inputs: z.array(
      z
        .object({
          key: sha,
          stage: z.string(),
          rulesHash: sha,
          bytes: z.number().int(),
          limit: z.number().int(),
          requestedBytes: z.number().int().nonnegative(),
          savedBytes: z.number().int().nonnegative(),
          materials: z.array(dropRangeSchema),
        })
        .strict(),
    ),
    queries: z.array(
      z
        .object({
          query: z.string(),
          cursor: z.string().optional(),
          total: z.number().int(),
          ids: z.array(z.string()),
        })
        .strict(),
    ),
    inferredRelations: z
      .array(z.object({ a: z.string(), b: z.string(), note: z.string() }).strict())
      .optional(),
    decisions: z.array(
      z
        .object({
          topic: z.string(),
          topics: z.array(z.string()).optional(),
          evidence: z.array(z.string()).min(1),
          outcome: z.enum(["integrate", "covered", "out-of-scope"]),
          targets: z.array(z.string()),
          reason: z.string().min(1),
          comparisons: z.array(dropComparisonSchema),
        })
        .strict(),
    ),
    plans: z.array(
      z
        .object({
          path: z.string(),
          reason: z.string(),
          evidence: z.array(z.string()),
          comparisons: z.array(dropComparisonSchema),
        })
        .strict(),
    ),
    requiredChecks: z.array(z.string()),
    checks: z.array(
      z
        .object({
          id: z.string(),
          kind: z.enum(["page", "relation", "asset", "coordination", "coverage"]),
          pages: z.array(z.string()),
          asset: z.string().optional(),
          bindings: z.array(dropRangeSchema),
          inputs: z.array(sha).min(1),
          report: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type DropBudget = z.infer<typeof dropBudgetSchema>;
export type DropRange = z.infer<typeof dropRangeSchema>;
export type DropReceipt = z.infer<typeof dropReceiptSchema>;
export const dropReviewSchema = z
  .object({
    id: z.string().uuid(),
    generation: z.number().int(),
    report: z.string(),
    protocol: z.literal(3).optional(),
    receipt: dropReceiptSchema.optional(),
  })
  .strict()
  .refine((d) => (d.protocol === 3) === (d.receipt !== undefined), "新 Drop 提案必须包含完整复核记录");

export const dropItemSchema = z
  .object({
    name: z.string().trim().min(1).max(250),
    text: z.string().optional(),
    url: z.string().url().optional(),
    identity: z.string().trim().min(1).max(2000).optional(),
    version: z.string().trim().max(250).optional(),
  })
  .strict()
  .refine((i) => (i.text !== undefined) !== (i.url !== undefined), "每项需要文字或 URL 二选一");
export const dropInputSchema = z
  .object({
    key: z.string().min(1).max(200),
    why: z.string().max(4000).default(""),
    series: z.string().trim().max(250).optional(),
    previous: z.string().uuid().optional(),
    reintegrate: z.boolean().default(false),
    items: z.array(dropItemSchema).min(1),
  })
  .strict();
export const dropSourceSchema = z.object({
  item: z.number().int().nonnegative(),
  name: z.string(),
  sourceId: z.string(),
  revision: z.string(),
  identity: z.string().optional(),
  version: z.string().optional(),
  raw: z.string(),
  parsed: z.string(),
  url: z.string().optional(),
  receivedAt: z.string(),
  parser: z.string(),
  omissions: z.array(z.string()),
  purpose: z.string().optional(),
});
export const dropBatchSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  why: z.string(),
  series: z.string().optional(),
  previous: z.string().uuid().optional(),
  fingerprint: z.string(),
  sources: z.array(dropSourceSchema),
  issues: z.array(z.object({ item: z.number(), name: z.string(), reason: z.string() })),
  state: z.enum([
    "collecting",
    "running",
    "needs-input",
    "failed",
    "cancelling",
    "cancelled",
    "review",
    "published",
    "rejected",
    "archived",
  ]),
  stage: z.string(),
  error: z.string().optional(),
  question: z.string().optional(),
  feedback: z.string().default(""),
  generation: z.number().int().default(0),
  ownerPid: z.number().optional(),
  token: z.string().optional(),
  selection: z
    .object({ provider: z.enum(["claude", "codex"]), model: z.string(), codexCli: z.string().optional() })
    .optional(),
  protocol: z.literal(3).optional(),
  budget: dropBudgetSchema.optional(),
  receipt: dropReceiptSchema.optional(),
  reviewId: z.string().optional(),
  reviews: z.array(z.string()).default([]),
  calls: z
    .array(
      z.object({
        key: z.string(),
        startedAt: z.string(),
        finishedAt: z.string().optional(),
        costUsd: z.number().optional(),
        usage: z.record(z.number()).optional(),
        error: z.string().optional(),
      }),
    )
    .default([]),
  report: z.string().optional(),
});
export type DropBatch = z.infer<typeof dropBatchSchema>;
export type DropSource = z.infer<typeof dropSourceSchema>;
export type DropItem = z.infer<typeof dropItemSchema>;
export const dropStates: Record<DropBatch["state"], string> = {
  collecting: "校对资料",
  running: "处理中",
  "needs-input": "需要补充",
  failed: "处理失败",
  cancelling: "取消处理中",
  cancelled: "已取消",
  review: "待审阅",
  published: "已发布",
  rejected: "已退回",
  archived: "无需变更",
};
