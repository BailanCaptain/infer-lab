import { z } from "zod";
import { type FactDispositionEntry, factDispositionEntrySchema } from "../../src/content/wiki/drop";
import { ID_RE, isSourceRef } from "../../src/content/wiki/schema";
import { type SiblingWrite, verifyFactDispositions } from "./fact-disposition";
import { parsePage } from "./pages";

export type RevisionCheckOptions = {
  siblingWrites?: SiblingWrite[];
  factDispositions?: FactDispositionEntry[];
  skipFactDisposition?: boolean;
};

const base = { id: z.string().regex(ID_RE), reason: z.string().trim().min(1).max(2000) };
export const revisionSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("supplement") }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("editorial"),
      factDispositions: z.array(factDispositionEntrySchema).optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("supersede"),
      claims: z
        .array(
          z
            .object({
              old: z.string().trim().min(1).max(8000),
              replacement: z.string().trim().min(1).max(8000),
              sources: z.array(z.string().refine(isSourceRef)).min(1).max(20),
            })
            .strict(),
        )
        .min(1)
        .max(20),
      factDispositions: z.array(factDispositionEntrySchema).optional(),
    })
    .strict(),
]);
export type Revision = z.infer<typeof revisionSchema>;
export const revisionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
  });
export const REVISION_HISTORY_HEADING = "## 已废弃的说法";

/** Recognize legacy tails for migration; examples inside code are not section headers. */
export function splitHistory(body: string): { active: string; history: string } {
  let offset = 0;
  let fence = "";
  for (const line of body.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = "";
    } else if (marker) fence = marker;
    else if (line.trimEnd() === REVISION_HISTORY_HEADING)
      return { active: body.slice(0, offset).trimEnd(), history: body.slice(offset).trimEnd() };
    offset += line.length;
  }
  return { active: body.trimEnd(), history: "" };
}

function parsed(file: string, text: string) {
  const result = parsePage(file, text);
  if (!result.page || result.problems.length) throw new Error(`修订页面不合法：${file}`);
  return result.page;
}

export function assertSupplementPreserves(before: string, after: string, file: string): void {
  let cursor = 0;
  for (const line of before.split(/\r?\n/).filter((line) => line.trim())) {
    const found = after.indexOf(line, cursor);
    if (found < 0) throw new Error(`补充修订不能删改旧正文：${file}`);
    cursor = found + line.length;
  }
}

/** Validate the recorded decision; audit history stays in workflow records, never in learning content. */
export function revisePage(
  file: string,
  before: string,
  after: string,
  revision: Revision | undefined,
  date: string,
  options?: RevisionCheckOptions,
): string {
  const oldPage = parsed(file, before);
  const newPage = parsed(file, after);
  const old = splitHistory(oldPage.body);
  const next = splitHistory(newPage.body);
  if (next.history) throw new Error(`修订历史不能进入正式正文，需重新整合：${file}`);
  if (old.active === next.active && !revision) return after;
  if (!revision) throw new Error(`改写现有正文必须提供修订分类和理由：${file}`);
  if (revision.id !== oldPage.fm.id || revision.id !== newPage.fm.id) throw new Error("修订 id 不匹配");
  const checked = revisionSchema.parse(revision);
  if (checked.kind === "supplement") assertSupplementPreserves(old.active, next.active, file);
  if (checked.kind === "supersede") {
    revisionDateSchema.parse(date);
    const seen = new Set<string>();
    for (const claim of checked.claims) {
      if (
        !old.active.includes(claim.old) ||
        old.active.indexOf(claim.old) !== old.active.lastIndexOf(claim.old)
      )
        throw new Error(`旧说法必须唯一匹配旧正文：${file}`);
      if (!next.active.includes(claim.replacement) || claim.old === claim.replacement)
        throw new Error(`替代结论必须匹配新正文且不同于旧文：${file}`);
      if (claim.sources.some((source) => !newPage.fm.sources.includes(source)))
        throw new Error(`废弃依据必须列入新页 sources：${file}`);
      if (seen.has(claim.old)) throw new Error(`重复废弃同一说法：${file}`);
      seen.add(claim.old);
    }
  }
  if ((checked.kind === "editorial" || checked.kind === "supersede") && !options?.skipFactDisposition) {
    verifyFactDispositions(
      file,
      oldPage,
      newPage,
      checked,
      options?.siblingWrites,
      options?.factDispositions,
    );
  }
  return after;
}

/** Recheck pending proposals under the current publication contract, including unchanged legacy pages. */
export function verifyRevision(
  file: string,
  before: string,
  after: string,
  revision: Revision | undefined,
  date: string,
  options?: RevisionCheckOptions,
): void {
  revisePage(file, before, after, revision, date, options);
}
