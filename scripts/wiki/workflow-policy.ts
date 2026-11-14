import { z } from "zod";

const limitedPolicySchema = z
  .object({
    maxAttempts: z.number().int().positive().safe(),
    maxCostUsd: z.number().finite().positive(),
    reserveUsd: z.number().finite().positive(),
  })
  .refine((p) => p.reserveUsd <= p.maxCostUsd, "单次预留不能超过总预算");
export const workflowPolicySchema = z.union([
  limitedPolicySchema,
  z.object({ accountingOnly: z.literal(true) }).strict(),
]);
export type WorkflowPolicy = z.infer<typeof workflowPolicySchema>;

/** Observations trigger assessment, never paid compilation by themselves. */
export const gapPolicySchema = z
  .object({ threshold: z.number().int().positive().safe().default(3) })
  .strict();
