import matter from "gray-matter";
import { z } from "zod";
import { EVIDENCE_MARK_RE } from "../../src/content/wiki/evidenceMarks";
import { citationProse } from "../../src/content/wiki/retrieve";
import type { RunAgent } from "./batch";
import { inputByteLimit, jsonBytes, textChunks } from "./context-window";
import { localDate } from "./ingest";
import { markProblems, splitProblems } from "./lint";
import { readLongMaterial } from "./long-material";
import { parsePage } from "./pages";
import { assertSupplementPreserves, type Revision, revisePage, splitHistory } from "./revisions";
import { retainNovelSupplements, type SectionEdit } from "./section-redundancy";
import { loadStandardConfig, proseEvidenceLines } from "./standard";
import { PAGE_TEXT_TIMEOUT_MS, runStructured } from "./structured";
import type { WorkflowPolicy } from "./workflow-policy";

/** Keep every accepted edit discoverable even when selective evidence extraction omits it. */
export function indexPriorChanges(edits: { start: number; end: number; reason: string }[], maxBytes: number) {
  const build = (chars: number) =>
    edits.map(({ start, end, reason }) => {
      const points = Array.from(reason);
      return { start, end, reason: points.slice(0, chars).join(""), truncated: points.length > chars };
    });
  let high = Math.max(0, ...edits.map((edit) => Array.from(edit.reason).length));
  if (jsonBytes(build(high)) <= maxBytes) return build(high);
  // Empty or single-character labels cannot identify an omitted fact to the model.
  let low = Math.min(64, high);
  if (jsonBytes(build(low)) > maxBytes)
    throw new Error("已有修改索引超过可用上下文预算；保留检查点，不能静默遗漏修改");
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (jsonBytes(build(middle)) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return build(low);
}

/** A model may edit only exact spans it has read; the engine retains everything else. */
export async function integrateSections(
  root: string,
  input: {
    path: string;
    previous: string;
    draft: string;
    draftId?: string;
    rules: string;
    policy: WorkflowPolicy;
  },
  deps: { runAgent?: RunAgent; retry?: boolean },
) {
  const previous = parsePage(input.path, input.previous);
  if (!previous.page || previous.problems.length) throw new Error("分段整合的旧页无效");
  const legacy = splitHistory(previous.page.body);
  const old = { ...previous.page, body: legacy.history ? legacy.active : previous.page.body };
  const incoming = parsePage(`_drafts/${input.draftId ?? old.fm.id}.md`, input.draft);
  if (!incoming.page || incoming.problems.length) throw new Error("分段整合的草稿无效或 id 不匹配");
  const draft = incoming.page;
  const draftLocation = `_drafts/${input.draftId ?? old.fm.id}.md#body`;
  const standard = loadStandardConfig();
  const teaching =
    input.path.startsWith("concepts/") && old.body.split(/\r?\n/).includes(`## ${standard.sourceSection}`);
  const oldMarkedLines = new Set(proseEvidenceLines(old.body, standard));
  const oldProseLines = new Set(citationProse(old.body).split(/\r?\n/));
  const withNotes = (body: string, notes: string[]) => {
    if (!notes.length) return body;
    return [splitHistory(body).active, ...new Set(notes)].filter(Boolean).join("\n\n");
  };
  const rules = `${input.rules}
这次只核对旧页的一个连续片段，不能替换整页。返回严格 JSON {"edits":[{"before":"本片段中唯一连续原文","after":"保留原文并补充后的内容，或有证据的替代说法","kind":"supplement|supersede","reason":"修改理由","quote":"草稿中支持该改动的连续逐字引文"}]}。
没有可证实的新内容时 edits=[]；措辞变化不等于事实变化，不为制造差异而改写。只改当前片段所讨论的内容；不可因没看见其他段落就添加全页附录。supplement 必须逐字保留旧页的所有非空行；新增段落应接在完整旧行之后，不能在原有行的中间插入换行或文字。supersede 必须有明确相反证据。不得改图、公式、自动生成区、已有标题、出处编号和版本范围；候选正文不得包含机器修订历史。不要把固定部署升级为上游最新版本。quote 取自草稿正文；如果草稿为分段摘录，只能使用 evidence.quote，不能引用 note 当事实。引文与修改的语义支持关系仍待人工审批。
${teaching ? `本页有「${standard.sourceSection}」：每个 edit 另须返回 sourceNote 字符串，写清该项新增事实的来源对应与证据等级，含适用限制；程序统一放入页末源码区。sourceNote 只写说明段，不写标题或围栏；实现参数和 commit 也放这里。after 中的教学正文不得新增任何证据角标，原有角标随原文保留；不确定条件仍在正文说清，具体 [I]/[D]/[C1] 等标记放 sourceNote。这不是跨片段改正文；不要手动添加全页附录。` : ""}`;
  const budget = inputByteLimit(root, rules);
  const framing = {
    mode: "draft-section-integration",
    id: old.fm.id,
    draft: null as unknown,
    draftLocation,
    draftEvidence: draft.fm.evidence,
    priorChangesRule:
      "priorChangeIndex 按原页位置列出每项已接受修改及理由；truncated=true 表示理由只保留逐字前缀，完整修改仍保存在检查点。priorChanges 是相应详细内容或选择性摘录，摘录没出现某项不代表那项没写。两者仅供避免跨片段重复，不是来源，不能作为新事实的证据。先核对索引：相同事实与限制已写过时，不再整段重讲或重复来源说明；只有当前旧说法确需纠正，或有独立的新条件，才修改当前片段。压缩上下文不是完整正文，不能据它删除或推翻已接受的内容。quote 仍须来自本次 draft，不得从修改上下文取证。",
    sources: [...new Set([...old.fm.sources, ...draft.fm.sources])].map((source, i) => ({
      index: i + 1,
      source,
    })),
    citationRule:
      "sources 给出目标页最终来源编号。旧文编号保持不变；使用带编号的来源引用时按此表编号，不能照搬草稿编号。只有已提供证据确实支持对应性质的结论，才用 [C1]、[S1]、[M1]（1 替换为真实编号）；不能用裸 [1] 或无编号的 [C]。推断、推导、假设、冲突标记 [I]、[D]、[A]、[!] 不带编号。draftEvidence 保留草稿的整体证据状态，逐条依据仍看原文。draftLocation 标识编译草稿正文；draft 中的偏移和行号只属于该草稿，不是原始 raw 文件行号。不得把草稿行号转写为 raw 行号，也不得猜测未提供的原始位置；无法逐字定位时只引用 sources 已提供的范围，并说明依据是草稿转述。只依据未经独立核实的 raw 归档材料时，保留 [I] 及适用限制，归档出处由最终来源列表保留；不要求给 [I] 再配一个编号引用，不能为凑编号改标 S/C/M。已有页含高等级来源也不证明新增材料已核实；代码摘录不是实测结果。",
  };
  // Size the entire fixed frame first. Allocating a third of the total to evidence
  // before reserving the source list and prior edits can leave a negative section budget.
  // Exact request validation still runs below; leave additional room for retry feedback.
  const available =
    budget -
    jsonBytes({
      ...framing,
      priorChangeIndex: [],
      priorChanges: null,
      section: { start: old.body.length, end: old.body.length, text: "" },
    }) -
    2048;
  const materialBytes = Math.min(Math.floor(budget / 3), Math.max(4096, Math.floor((available - 6144) / 2)));
  if (available - materialBytes - 6144 < 32)
    throw new Error("完整来源表、材料与已有修改上下文超过可用预算；保留检查点，不能遗漏规则或来源");
  let material: unknown = { sources: draft.fm.sources, body: draft.body };
  if (jsonBytes(material) > materialBytes)
    material = await readLongMaterial(
      root,
      {
        topic: `${old.fm.title}：用于核对已有正文的新证据和限定条件`,
        // These offsets describe compiled prose, never the raw files cited by that prose.
        sources: [{ source: draftLocation, text: draft.body }],
        maxBytes: materialBytes,
        origin: draft.fm.origin,
        policy: input.policy,
      },
      deps,
    );
  framing.draft = material;
  const remaining = available - jsonBytes(material);
  // Reserve bounded page-wide context as well as space for JSON escaping in each section.
  const contextBytes = Math.max(6144, Math.floor(remaining / 3));
  const chunkBytes = Math.min(24_000, Math.floor((remaining - contextBytes) / 2));
  let edits: SectionEdit[] = [];
  for (const section of textChunks(old.body, chunkBytes)) {
    // Keep the index bounded while preserving the material reader's minimum detail budget.
    const priorChangeIndex = indexPriorChanges(
      edits,
      Math.min(Math.floor(contextBytes / 2), contextBytes - 4096),
    );
    const detailBytes = contextBytes - jsonBytes(priorChangeIndex);
    let priorChanges: unknown = edits.map(({ start, end, after, reason, sourceNote }) => ({
      start,
      end,
      after,
      reason,
      sourceNote,
    }));
    if (jsonBytes(priorChanges) > detailBytes)
      priorChanges = await readLongMaterial(
        root,
        {
          topic: `${old.fm.title}：前面已加入的事实、限定及所在位置，仅用于避免重复，不是新证据`,
          sources: [
            {
              source: `integration-context:${input.path}#prior-edits`,
              text: JSON.stringify(priorChanges, null, 2),
            },
          ],
          maxBytes: detailBytes,
          purpose: "prior-changes",
          origin: draft.fm.origin,
          policy: input.policy,
        },
        deps,
      );
    const schema = z
      .object({
        edits: z
          .object({
            before: z.string().min(1).max(8000),
            after: z.string().min(1).max(8000),
            kind: z.enum(["supplement", "supersede"]),
            reason: z.string().min(1).max(1000),
            quote: z.string().min(1).max(2000),
            sourceNote: z
              .string()
              .trim()
              .min(1)
              .max(2000)
              .refine((note) => !/^ {0,3}(?:#{1,6}\s|`{3}|~{3})/m.test(note), "来源说明不能包含标题或围栏")
              .optional(),
          })
          .strict()
          .array()
          .max(10),
      })
      .strict()
      .superRefine((value, ctx) => {
        for (const [index, edit] of value.edits.entries()) {
          if (
            !section.text.includes(edit.before) ||
            old.body.indexOf(edit.before) !== old.body.lastIndexOf(edit.before) ||
            !draft.body.includes(edit.quote) ||
            edit.before === edit.after
          )
            ctx.addIssue({
              code: "custom",
              path: ["edits", index],
              params: { rule: "section-edit-binding" },
              message: "分段修改未唯一匹配旧文或未绑定草稿原文",
            });
          const candidate = {
            ...old,
            fm: { ...old.fm, sources: framing.sources.map((s) => s.source) },
            body: withNotes(
              old.body.replace(edit.before, () => edit.after),
              edit.sourceNote ? [edit.sourceNote] : [],
            ),
          };
          if (draft.fm.evidence === "I")
            for (const line of citationProse(`${edit.after}\n${edit.sourceNote ?? ""}`).split(/\r?\n/)) {
              if (oldProseLines.has(line)) continue;
              for (const mark of line.matchAll(EVIDENCE_MARK_RE))
                if (
                  /^[CSM]$/.test(mark[1] ?? "") &&
                  framing.sources[Number(mark[2]) - 1]?.source.startsWith("raw:")
                )
                  ctx.addIssue({
                    code: "custom",
                    path: ["edits", index, "after"],
                    params: { rule: "raw-evidence-level" },
                    message:
                      "raw-evidence-level: 未独立核实的归档不能新增为 C/S/M 证据；保留 I 与范围，或引用已提供并支持结论的真正一手来源",
                  });
            }
          if (
            teaching &&
            (!edit.sourceNote ||
              proseEvidenceLines(candidate.body, standard).some((line) => !oldMarkedLines.has(line)))
          )
            ctx.addIssue({
              code: "custom",
              path: ["edits", index, "after"],
              params: { rule: "prose-marks" },
              message: "prose-marks: 新增教学角标须移至 sourceNote，正文保留适用条件；每个修改须提供来源说明",
            });
          for (const problem of splitProblems(markProblems(candidate)).errors)
            ctx.addIssue({
              code: "custom",
              path: ["edits", index, "after"],
              params: { rule: problem.rule },
              message: `${problem.rule}: ${problem.message}`,
            });
          if (edit.kind === "supplement")
            try {
              // An exact substring may end mid-line: validate the resulting page before caching.
              assertSupplementPreserves(old.body, candidate.body, input.path);
            } catch (error) {
              ctx.addIssue({
                code: "custom",
                path: ["edits", index, "after"],
                params: { rule: "supplement-preservation" },
                message: String(error),
              });
            }
        }
      });
    const result = await runStructured(
      root,
      {
        kind: "section-integration-v1",
        origin: draft.fm.origin,
        policy: input.policy,
        data: { ...framing, priorChangeIndex, priorChanges, section },
        rules,
        schema,
        maxInputChars: budget,
        timeoutMs: PAGE_TEXT_TIMEOUT_MS,
      },
      deps,
    );
    for (const edit of result.value.edits) {
      const start = section.start + section.text.indexOf(edit.before);
      edits.push({ ...edit, start, end: start + edit.before.length });
    }
  }
  if (!edits.length) return undefined;
  edits.sort((a, b) => a.start - b.start);
  if (edits.some((edit, i) => i > 0 && edit.start < edits[i - 1]!.end)) throw new Error("分段修订范围重叠");
  edits = await retainNovelSupplements(
    root,
    {
      path: input.path,
      previousBody: old.body,
      edits,
      sourceContext: {
        previousSources: old.fm.sources,
        sources: framing.sources.map((source) => source.source),
        previousEvidence: old.fm.evidence,
        draftEvidence: draft.fm.evidence,
        previousRawSources: old.fm.rawSources,
        draftRawSources: draft.fm.rawSources,
      },
      origin: draft.fm.origin,
      policy: input.policy,
    },
    deps,
  );
  if (!edits.length) return undefined;
  let body = splitHistory(old.body).active;
  for (const edit of [...edits].reverse())
    body = body.slice(0, edit.start) + edit.after + body.slice(edit.end);
  body = withNotes(
    body,
    edits.flatMap((edit) => (edit.sourceNote ? [edit.sourceNote] : [])),
  );
  const superseded = edits.filter((edit) => edit.kind === "supersede");
  const revision: Revision = superseded.length
    ? {
        id: old.fm.id,
        kind: "supersede",
        reason: "按原文逐段核对，保留未修改内容",
        claims: superseded.map((edit) => ({
          old: edit.before,
          replacement: edit.after,
          sources: draft.fm.sources,
        })),
      }
    : {
        id: old.fm.id,
        kind: "supplement",
        reason: edits
          .map((e) => e.reason)
          .join("；")
          .slice(0, 2000),
      };
  // Even mixed supplement/supersede output must preserve every supplement's old lines.
  for (const edit of edits.filter((e) => e.kind === "supplement"))
    assertSupplementPreserves(edit.before, edit.after, input.path);
  const metadata = matter(input.previous).data;
  const text = matter.stringify(body, {
    ...metadata,
    updated: localDate(),
    sources: [...new Set([...old.fm.sources, ...draft.fm.sources])],
  });
  // Check exact-edit history contracts here as well as in the final staged transaction.
  revisePage(input.path, input.previous, text, revision, localDate());
  return { text, revision };
}
