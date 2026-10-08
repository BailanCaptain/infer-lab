import { z } from "zod";

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
  selection: z.object({ provider: z.enum(["claude", "codex"]), model: z.string() }).optional(),
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
