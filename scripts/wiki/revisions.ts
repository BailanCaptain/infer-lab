import matter from "gray-matter";
import { z } from "zod";
import { ID_RE, isSourceRef } from "../../src/content/wiki/schema";
import { parsePage } from "./pages";
import { digest } from "./workflow";

const base = { id: z.string().regex(ID_RE), reason: z.string().trim().min(1).max(2000) };
export const revisionSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("supplement") }).strict(),
  z.object({ ...base, kind: z.literal("editorial") }).strict(),
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

/** Layout recognition only; verifyRevision separately authenticates the complete history. */
export function isRevisionEntryHeading(text: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}) · 修订 [a-f0-9]{16}$/.exec(text);
  return !!match && revisionDateSchema.safeParse(match[1]).success;
}

/** The engine's append-only history is last; examples inside code are not section headers. */
function splitHistory(body: string): { active: string; history: string } {
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

const literal = (text: string) => {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
};

function parsed(file: string, text: string) {
  const result = parsePage(file, text);
  if (!result.page || result.problems.length) throw new Error(`修订页面不合法：${file}`);
  return result.page;
}

/** Semantic classification belongs to the agent and reviewer; exact quotations and history belong to the engine. */
export function revisePage(
  file: string,
  before: string,
  after: string,
  revision: Revision | undefined,
  date: string,
): string {
  const oldPage = parsed(file, before);
  const newPage = parsed(file, after);
  const old = splitHistory(oldPage.body);
  const next = splitHistory(newPage.body);
  if (next.history && next.history !== old.history) throw new Error(`不能伪造或修改既有废弃历史：${file}`);
  if (old.active === next.active && !revision && old.history === next.history) return after;
  if (!revision) throw new Error(`改写现有正文必须提供修订分类和理由：${file}`);
  if (revision.id !== oldPage.fm.id || revision.id !== newPage.fm.id) throw new Error("修订 id 不匹配");
  const checked = revisionSchema.parse(revision);
  if (checked.kind === "supplement") {
    let cursor = 0;
    for (const line of old.active.split(/\r?\n/).filter((line) => line.trim())) {
      const found = next.active.indexOf(line, cursor);
      if (found < 0) throw new Error(`补充修订不能删改旧正文：${file}`);
      cursor = found + line.length;
    }
  }
  let history = old.history;
  if (!history && checked.kind !== "supersede") return after;
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
    const key = digest(JSON.stringify({ id: checked.id, date, claims: checked.claims })).slice(0, 16);
    const entries = checked.claims.map((claim) =>
      [
        "旧说法（历史记录，已废弃）：",
        literal(claim.old),
        "替代结论：",
        literal(claim.replacement),
        "废弃依据（来源是否支持结论仍须人审）：",
        ...claim.sources.map((s) => `- \`${s}\``),
      ].join("\n\n"),
    );
    const oldSources = oldPage.fm.sources.map((s, i) => `${i + 1}. \`${s}\``).join("\n");
    history = `${history || REVISION_HISTORY_HEADING}\n\n### ${date} · 修订 ${key}\n\n${entries.join("\n\n")}\n\n旧文的来源编号（仅解释上方历史原文）：\n\n${oldSources}`;
  }
  const raw = matter(after);
  // New inline source numbers stay fixed; append old evidence for historical audit.
  if (checked.kind === "supersede")
    raw.data.sources = [...new Set([...newPage.fm.sources, ...oldPage.fm.sources])];
  return matter.stringify(`${next.active}${history ? `\n\n${history}` : ""}\n`, raw.data);
}

/** Old pending proposals must also satisfy the current history contract before publication. */
export function verifyRevision(
  file: string,
  before: string,
  after: string,
  revision: Revision | undefined,
  date: string,
): void {
  const next = parsed(file, after);
  const old = parsed(file, before);
  if (old.body === next.body && !revision) return;
  const stripped = matter(after);
  stripped.content = splitHistory(next.body).active;
  const expected = revisePage(
    file,
    before,
    matter.stringify(`${stripped.content}\n`, stripped.data),
    revision,
    date,
  );
  if (parsed(file, expected).body.trimEnd() !== next.body.trimEnd())
    throw new Error(`废弃历史与修订决策不一致，需重新整合：${file}`);
}
