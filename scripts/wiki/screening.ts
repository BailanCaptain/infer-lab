import { z } from "zod";
import { parseRawRef } from "../../src/content/wiki/schema";

/** Persist only reproducible screening metadata, never removed raw spans. */
export const screeningSchema = z.object({
  source: z.string().refine((s) => parseRawRef(s) !== null),
  rawHash: z.string().regex(/^[a-f0-9]{64}$/),
  sanitizerVersion: z.string().min(1),
  cleanHash: z.string().regex(/^[a-f0-9]{64}$/),
  blocked: z.boolean(),
  findings: z.array(z.object({ reason: z.string().min(1) })),
});
export type Screening = z.infer<typeof screeningSchema>;
