import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { enqueueInLock, listTasks, setClosureCountInLock } from "./queue";
import { localFile } from "./review-files";
import { atomicText, digest, WorkflowStore } from "./workflow";
import { gapPolicySchema } from "./workflow-policy";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const question = z.string().trim().min(1).max(100_000);
const signalSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("independent-review"), reason: z.string().min(1).max(2000), decision: hash })
    .strict(),
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
/** 说法不同、判为同一题的问法：它自己算出的 key 与判定回执（wiki/_jobs/<decision>.json） */
const aliasSchema = z.object({ key: hash, decision: hash }).strict();
const ledgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    policy: gapPolicySchema,
    entries: z.array(
      z
        .object({
          key: hash,
          occurrences: z.array(occurrenceSchema).min(1),
          aliases: z.array(aliasSchema).optional(),
        })
        .strict(),
    ),
  })
  .strict();
type Ledger = z.infer<typeof ledgerSchema>;
type Entry = Ledger["entries"][number];

/** 指代前文的说法：出现就说明问题离不开会话上下文（「应该」里的「该」不算） */
const REFERS_BACK =
  /[它这那其此]|(?<!应)该|上面|上述|前面|刚才|同上|\b(it|this|that|these|those|above|previous)\b/i;
/** 具体对象：带下划线、连字符、点或数字的标识符，驼峰，或两个字母以上的全大写缩写 */
const CONCRETE = /[A-Za-z][A-Za-z0-9]*[_\-.][A-Za-z0-9_\-.]+|[a-z]+[A-Z][A-Za-z0-9]*|\b[A-Z][A-Z0-9]{1,}\b/;

/**
 * 问题本身说得清是在问什么，就不必带会话上下文。2026-09-23 HCCL 那一问先聊过 Block Table、后来又直接问，
 * 带着上下文被记成了两条缺口。规则保守：有指代、是「v0.26 呢？」这种省略追问、或没有具体对象又太短，都照旧带上下文
 * ——判错只会退回原来的记法，不会把不同话题的追问并成一条。
 */
export function selfContained(question: string): boolean {
  const q = question.trim();
  if (REFERS_BACK.test(q)) return false;
  if (/呢\s*[？?]?$/.test(q) && q.length < 20) return false;
  return CONCRETE.test(q) || q.replace(/\s/g, "").length >= 15;
}

/** 认题用的问题与上下文：自含问题不带上下文 */
export function gapIdentity(text: string, contextQuestions: string[]) {
  const question = text.trim();
  // Repeating the same question is one gap, but "now?" about A and B must stay separate.
  const context = selfContained(question)
    ? []
    : contextQuestions.map((q) => q.trim()).filter((q) => q !== question);
  return { question, context };
}

/** Conservative equality: retain case, punctuation, parameter names, versions and negation. */
export const gapKey = (text: string, contextQuestions: string[]) =>
  digest(JSON.stringify(gapIdentity(text, contextQuestions)));

const owns = (entry: Entry, key: string) => entry.key === key || !!entry.aliases?.some((a) => a.key === key);

function readLedger(root: string): Ledger | undefined {
  const path = localFile(root, "wiki/_gaps.json");
  if (!existsSync(path)) return undefined;
  const ledger = ledgerSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const keys = new Set<string>();
  const events = new Set<string>();
  for (const entry of ledger.entries)
    for (const key of [entry.key, ...(entry.aliases ?? []).map((a) => a.key)]) {
      if (keys.has(key)) throw new Error("缺口记录存在重复 key");
      keys.add(key);
    }
  for (const entry of ledger.entries)
    for (const event of entry.occurrences) {
      if (events.has(event.eventId) || !owns(entry, gapKey(event.question, event.contextQuestions)))
        throw new Error("缺口事件重复或归属不符");
      events.add(event.eventId);
    }
  return ledger;
}

function view(entry: Entry, threshold: number, tasks: ReturnType<typeof listTasks>) {
  const closedCount = tasks.reduce((seen, task) => {
    const count = task.result?.closureObservationCount;
    return task.input.kind === "gap" &&
      task.input.key === entry.key &&
      task.state === "closed" &&
      typeof count === "number" &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= entry.occurrences.length
      ? Math.max(seen, count)
      : seen;
  }, 0);
  const pendingCount = entry.occurrences.length - closedCount;
  const first = entry.occurrences[0]!;
  const last = entry.occurrences.at(-1)!;
  return {
    ...entry,
    question: first.question,
    count: entry.occurrences.length,
    pendingCount,
    threshold,
    firstSeen: first.recordedAt,
    lastSeen: last.recordedAt,
    state:
      pendingCount === 0
        ? ("closed" as const)
        : pendingCount >= threshold
          ? ("awaiting-assessment" as const)
          : ("collecting" as const),
    assessment: "unassessed" as const,
  };
}

function queueOccurrence(root: string, entry: Entry, threshold: number) {
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
  const tasks = listTasks(root);
  return ledger?.entries.map((entry) => view(entry, ledger.policy.threshold, tasks)) ?? [];
}

const writeLedger = (root: string, ledger: Ledger) =>
  atomicText(localFile(root, "wiki/_gaps.json"), `${JSON.stringify(ledgerSchema.parse(ledger), null, 2)}\n`);

/**
 * Same successful chat attempt can be delivered again, but cannot acquire different evidence.
 * sameAs 来自 judgeGapIdentity：这个问法判为某条已有缺口的另一种说法。判定指向的缺口已经不在就照旧新建一条。
 */
export function recordGapObservation(
  root: string,
  value: GapObservation,
  policy?: { threshold: number },
  sameAs?: { entryKey: string; decision: string },
) {
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
      return view(entry, ledger.policy.threshold, listTasks(root));
    }
    const key = gapKey(input.question, input.contextQuestions);
    let entry = ledger.entries.find((entry) => owns(entry, key));
    if (!entry && sameAs) {
      entry = ledger.entries.find((entry) => entry.key === sameAs.entryKey);
      if (entry)
        entry.aliases = [...(entry.aliases ?? []), aliasSchema.parse({ key, decision: sameAs.decision })];
    }
    if (!entry) {
      entry = { key, occurrences: [] };
      ledger.entries.push(entry);
    }
    entry.occurrences.push({ ...input, recordedAt: new Date().toISOString() });
    writeLedger(root, ledger);
    queueOccurrence(root, entry, ledger.policy.threshold);
    return view(entry, ledger.policy.threshold, listTasks(root));
  });
}

/**
 * 判错了由人拆开：别名那几次提问拆回自己的缺口。已关闭任务记下的关闭计数只算关闭时已有的前几次，
 * 其中被拆走的要减掉，否则原缺口要多攒几次才会重开。拆出来的缺口够阈值就照常排队。
 */
export function splitGapAlias(root: string, aliasKey: string) {
  return new WorkflowStore(root).locked(() => {
    const ledger = readLedger(root);
    const entry = ledger?.entries.find((e) => e.aliases?.some((a) => a.key === aliasKey));
    if (!ledger || !entry) throw new Error("没有这个别名：只有判为同一题的问法才能拆开");
    const moved = entry.occurrences.filter((o) => gapKey(o.question, o.contextQuestions) === aliasKey);
    for (const task of listTasks(root)) {
      const seen = Number(task.result?.closureObservationCount ?? Number.NaN);
      if (task.input.kind !== "gap" || task.input.key !== entry.key || !Number.isInteger(seen)) continue;
      const counted = moved.filter((o) => entry.occurrences.indexOf(o) < seen).length;
      if (counted) setClosureCountInLock(root, task.id, seen - counted);
    }
    entry.occurrences = entry.occurrences.filter((o) => !moved.includes(o));
    entry.aliases = entry.aliases!.filter((a) => a.key !== aliasKey);
    if (!entry.aliases.length) delete entry.aliases;
    const split: Entry = { key: aliasKey, occurrences: moved };
    ledger.entries.push(split);
    writeLedger(root, ledger);
    queueOccurrence(root, split, ledger.policy.threshold);
    return view(split, ledger.policy.threshold, listTasks(root));
  });
}
