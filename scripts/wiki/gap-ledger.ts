import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { enqueueInLock, listTasks } from "./queue";
import { localFile } from "./review-files";
import { atomicText, digest, WorkflowStore } from "./workflow";
import { gapPolicySchema } from "./workflow-policy";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const question = z.string().trim().min(1).max(100_000);
const signalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent-uncovered"), reason: z.string().min(1).max(2000) }).strict(),
  z
    .object({
      kind: z.literal("web-attempt"),
      reason: z.string().min(1).max(2000),
      tool: z.enum(["WebFetch", "WebSearch"]),
      target: z.string().max(8000).optional(),
    })
    .strict(),
]);
export const gapObservationSchema = z
  .object({
    eventId: z.string().uuid(),
    question,
    contextQuestions: z.array(question).max(6),
    revision: hash,
    candidates: z
      .array(
        z
          .object({
            id: z.string().min(1),
            score: z.number().finite(),
            how: z.enum(["exact", "fuzzy", "keyword", "related", "corpus-exact"]),
          })
          .strict(),
      )
      .max(10),
    signals: z.array(signalSchema).min(1).max(21),
  })
  .strict();
export type GapObservation = z.infer<typeof gapObservationSchema>;
export type GapSignal = GapObservation["signals"][number];
const occurrenceSchema = gapObservationSchema.extend({ recordedAt: z.string().datetime() });
const ledgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    policy: gapPolicySchema,
    entries: z.array(z.object({ key: hash, occurrences: z.array(occurrenceSchema).min(1) }).strict()),
  })
  .strict();
type Ledger = z.infer<typeof ledgerSchema>;

/** Conservative equality: retain case, punctuation, parameter names, versions and negation. */
export function gapKey(text: string, contextQuestions: string[]): string {
  const normalized = text.trim();
  // Repeating the same question is one gap, but "now?" about A and B must stay separate.
  const context = contextQuestions.map((q) => q.trim()).filter((q) => q !== normalized);
  return digest(JSON.stringify({ question: normalized, context }));
}

function readLedger(root: string): Ledger | undefined {
  const path = localFile(root, "wiki/_gaps.json");
  if (!existsSync(path)) return undefined;
  const ledger = ledgerSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const keys = new Set<string>();
  const events = new Set<string>();
  for (const entry of ledger.entries) {
    if (keys.has(entry.key)) throw new Error("缺口记录存在重复 key");
    keys.add(entry.key);
    for (const event of entry.occurrences) {
      if (events.has(event.eventId) || gapKey(event.question, event.contextQuestions) !== entry.key)
        throw new Error("缺口事件重复或归属不符");
      events.add(event.eventId);
    }
  }
  return ledger;
}

function view(entry: Ledger["entries"][number], threshold: number) {
  const first = entry.occurrences[0]!;
  const last = entry.occurrences.at(-1)!;
  return {
    ...entry,
    question: first.question,
    count: entry.occurrences.length,
    threshold,
    firstSeen: first.recordedAt,
    lastSeen: last.recordedAt,
    state: entry.occurrences.length >= threshold ? ("awaiting-assessment" as const) : ("collecting" as const),
    assessment: "unassessed" as const,
  };
}

function queueOccurrence(root: string, entry: Ledger["entries"][number], threshold: number) {
  const prior = listTasks(root).filter((t) => t.input.kind === "gap" && t.input.key === entry.key);
  if (prior.some((t) => t.state !== "closed")) return;
  const last = prior.sort(
    (a, b) => Number(b.result?.closureObservationCount ?? 0) - Number(a.result?.closureObservationCount ?? 0),
  )[0];
  const seen = Number(last?.result?.closureObservationCount ?? 0);
  if (entry.occurrences.length - seen < threshold) return;
  enqueueInLock(root, {
    kind: "gap",
    key: entry.key,
    ...(last ? { cycle: (last.input.kind === "gap" ? (last.input.cycle ?? 0) : 0) + 1 } : {}),
  });
}

/** Atomic reads; inspection must not create a lock, ledger, task or model call. */
export function listGaps(root: string) {
  const ledger = readLedger(root);
  return ledger?.entries.map((entry) => view(entry, ledger.policy.threshold)) ?? [];
}

/** Same successful chat attempt can be delivered again, but cannot acquire different evidence. */
export function recordGapObservation(root: string, value: GapObservation, policy?: { threshold: number }) {
  const input = gapObservationSchema.parse(value);
  const requestedPolicy = policy === undefined ? undefined : gapPolicySchema.parse(policy);
  return new WorkflowStore(root).locked(() => {
    const ledger: Ledger = readLedger(root) ?? {
      schemaVersion: 1,
      policy: requestedPolicy ?? gapPolicySchema.parse({}),
      entries: [],
    };
    if (requestedPolicy && ledger.policy.threshold !== requestedPolicy.threshold)
      throw new Error("已有缺口记录的阈值不能静默更改");
    for (const entry of ledger.entries) {
      const prior = entry.occurrences.find((event) => event.eventId === input.eventId);
      if (!prior) continue;
      if (JSON.stringify(gapObservationSchema.strip().parse(prior)) !== JSON.stringify(input))
        throw new Error("同一缺口事件不能替换问题或证据");
      queueOccurrence(root, entry, ledger.policy.threshold);
      return view(entry, ledger.policy.threshold);
    }
    const key = gapKey(input.question, input.contextQuestions);
    let entry = ledger.entries.find((entry) => entry.key === key);
    if (!entry) {
      entry = { key, occurrences: [] };
      ledger.entries.push(entry);
    }
    entry.occurrences.push({ ...input, recordedAt: new Date().toISOString() });
    atomicText(
      localFile(root, "wiki/_gaps.json"),
      `${JSON.stringify(ledgerSchema.parse(ledger), null, 2)}\n`,
    );
    queueOccurrence(root, entry, ledger.policy.threshold);
    return view(entry, ledger.policy.threshold);
  });
}
