import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { z } from "zod";
import {
  canonicalJson,
  type ToolEvidenceV1,
  toolEvidenceV1Schema,
  verifyToolEvidence,
} from "../../server/tool-evidence";
import { CHAPTER_IDS, CHAPTER_TITLES } from "../../src/content/wiki/chapters";
import {
  type HastNode,
  WIKI_REHYPE_PLUGINS,
  WIKI_REMARK_PLUGINS,
  WIKI_REMARK_SYNTAX_PLUGINS,
} from "../../src/content/wiki/markdown";
import { buildIndex, citedPageLinks } from "../../src/content/wiki/retrieve";
import { ID_RE, parseRawRef } from "../../src/content/wiki/schema";
import { sourceLines } from "./audit";
import { type AgentRequest, type AgentResult, positiveInteger, type RunAgent, runBatch } from "./batch";
import { assertInputFits, inputByteLimit, jsonBytes } from "./context-window";
import { lintPages, splitProblems, wikiFileExists } from "./lint";
import { readLongMaterial } from "./long-material";
import { relevantPageIds } from "./navigation";
import { loadPages, parsePage } from "./pages";
import { prepareRawInput } from "./prepare-input";
import { bindDraftPageLinks, readRawSnapshot, withRawSources } from "./raw";
import { RESTRICTED_PROFILE, restrictedArgs } from "./restricted-claude";
import { sanitizeRawInput } from "./sanitize";
import { unfence } from "./structured";
import { atomicText, digest, originSchema, type WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

/** 编译一份材料的超时：真实编译用过 99 秒与 144 秒（2026-09-16），补写与投喂共用这一个值 */
export const COMPILE_TIMEOUT_MS = 180_000;

export interface ExpectedAnswerRecord {
  question: string;
  answer: string;
  citedPages: { file: string; text: string }[];
  toolEvidence?: ToolEvidenceV1[];
}

export interface RawCompileInput {
  id: string;
  source: string;
  origin: WorkInput["origin"];
  rules: string;
  timeoutMs: number;
  purpose?: "answer-record";
  answerPages?: string[];
  expectedAnswerRecord?: ExpectedAnswerRecord;
  supersedes?: { jobId: string; rejectedReviews?: string[] };
  context?: { why: string; sourceId: string };
}

const answerRecordBundleSchema = z
  .object({
    kind: z.literal("answer-record"),
    question: z.string().min(1),
    answer: z.string().min(1),
    citedPages: z.array(z.object({ file: z.string().min(1), text: z.string() })).min(1),
    toolEvidence: z.array(toolEvidenceV1Schema).min(1).optional(),
  })
  .strict();

interface AnswerRecordMaterial {
  source: string;
  note: string;
  question: string;
  answer: string;
  citedPages: { file: string; text: string }[];
  toolEvidence?: ToolEvidenceV1[];
}

export const ANSWER_RECORD_CORE_SLOT = "::answer-record-core::";

function normalizePages(pages: readonly { file: string; text: string }[]): { file: string; text: string }[] {
  return [...pages]
    .map((p) => ({ file: p.file, text: p.text }))
    .sort((a, b) => a.file.localeCompare(b.file) || a.text.localeCompare(b.text));
}

export function assertAnswerRecordMatchesExpected(
  material: AnswerRecordMaterial,
  expected: ExpectedAnswerRecord,
): void {
  if (material.question.trim() !== expected.question.trim()) {
    throw new Error("问答记录原料快照与已校验回执不一致（question 不匹配），拒绝复用或编译");
  }
  if (material.answer.trim() !== expected.answer.trim()) {
    throw new Error("问答记录原料快照与已校验回执不一致（answer 不匹配），拒绝复用或编译");
  }
  const actualPages = normalizePages(material.citedPages);
  const expectedPages = normalizePages(expected.citedPages);
  if (
    actualPages.length !== expectedPages.length ||
    actualPages.some((p, i) => p.file !== expectedPages[i]!.file || p.text !== expectedPages[i]!.text)
  ) {
    throw new Error("问答记录原料快照与已校验回执不一致（citedPages 引用不匹配），拒绝复用或编译");
  }
  const expectedEv = expected.toolEvidence ?? [];
  const actualEv = material.toolEvidence ?? [];
  if (expectedEv.length !== actualEv.length) {
    throw new Error(
      `问答记录原料快照与已校验回执不一致（toolEvidence 缺失或数量不匹配：预期 ${expectedEv.length}，实际 ${actualEv.length}），拒绝复用或编译`,
    );
  }
  for (let i = 0; i < expectedEv.length; i++) {
    const check = verifyToolEvidence(actualEv[i]);
    if (!check.ok) {
      throw new Error(`问答记录原料快照 toolEvidence 校验失败（${check.reason}），拒绝复用或编译`);
    }
    if (
      actualEv[i]!.outputSha256 !== expectedEv[i]!.outputSha256 ||
      actualEv[i]!.inputSha256 !== expectedEv[i]!.inputSha256 ||
      canonicalJson(actualEv[i]) !== canonicalJson(expectedEv[i])
    ) {
      throw new Error("问答记录原料快照与已校验回执不一致（toolEvidence 摘要不匹配），拒绝复用或编译");
    }
  }
}

export function verifyAnswerRecordRaw(root: string, source: string, expected: ExpectedAnswerRecord): void {
  const ref = parseRawRef(source);
  if (!ref) throw new Error("非法本地来源引用");
  const original = readRawSnapshot(join(root, "wiki"), ref.path);
  const lines = sourceLines(original);
  if (ref.lineEnd > lines.length) throw new Error("本地来源行号越界");
  const slice = lines.slice(ref.lineStart - 1, ref.lineEnd).join("\n");
  let parsed: z.infer<typeof answerRecordBundleSchema>;
  try {
    parsed = answerRecordBundleSchema.parse(JSON.parse(slice));
  } catch (error) {
    throw new Error(`问答记录原料快照格式无效，拒绝复用或编译：${String(error)}`);
  }
  assertAnswerRecordMatchesExpected(
    {
      source,
      note: "",
      question: parsed.question,
      answer: parsed.answer,
      citedPages: parsed.citedPages,
      ...(parsed.toolEvidence?.length ? { toolEvidence: parsed.toolEvidence } : {}),
    },
    expected,
  );
}

function parseAnswerRecordMaterial(
  source: string,
  rawMaterial: { lines?: { line: number; text: string }[] } | null,
): AnswerRecordMaterial | null {
  if (!rawMaterial?.lines) return null;
  let parsed: z.infer<typeof answerRecordBundleSchema>;
  try {
    parsed = answerRecordBundleSchema.parse(
      JSON.parse(rawMaterial.lines.map((line) => line.text).join("\n")),
    );
  } catch (error) {
    throw new Error(`问答记录材料格式无效，拒绝有损编译：${String(error)}`);
  }
  const question = parsed.question.trim();
  const answer = parsed.answer.trim();
  if (!question || !answer) throw new Error("问答记录缺少原问题或原回答正文，拒绝编译");
  if (parsed.toolEvidence?.length) {
    for (const item of parsed.toolEvidence) {
      const check = verifyToolEvidence(item);
      if (!check.ok) {
        throw new Error(`问答记录附带的工具证据校验失败（${check.reason}），拒绝编译`);
      }
    }
  }
  return {
    source,
    note: `question 与 answer 由程序通过 ${ANSWER_RECORD_CORE_SLOT} 原样注入归档页正文（须完整保留，不可改写、删减或翻转）；你只需据此拟定准确的 frontmatter（title、summary、chapters、relations），并在补充小节结合 citedPages / citedContext 说明引用范围、版本/配置条件与 evidence: I 的非实测边界（不照抄引用页整段原文）。`,
    question,
    answer,
    citedPages: parsed.citedPages,
    ...(parsed.toolEvidence?.length ? { toolEvidence: parsed.toolEvidence } : {}),
  };
}

function bindAnswerRecordPageLinks(text: string, pages: { id: string; file: string }[]): string {
  const destinations = new Map<string, string>();
  for (const p of pages) {
    destinations.set(`${p.id}.md`, `../${p.file}`);
    destinations.set(p.file, `../${p.file}`);
    destinations.set(`../${p.file}`, `../${p.file}`);
  }
  let fence = "";
  const inline = /(`+).*?\1|\](\(\s*<?)(?:\.\/)?((?:\.\.\/)?(?:[a-z0-9-]+\/)?[a-z0-9-]+\.md)(?=[#)>\s])/gi;
  const definition =
    /^(\s*\[[^\]]+\]:\s*<?)(?:\.\/)?((?:\.\.\/)?(?:[a-z0-9-]+\/)?[a-z0-9-]+\.md)(?=[#>\s]|$)/i;
  return text
    .split(/(?<=\n)/)
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = "";
        return line;
      }
      if (marker) {
        fence = marker;
        return line;
      }
      return line
        .replace(inline, (match, code: string | undefined, opening: string, file: string) => {
          if (code) return match;
          const target = destinations.get(file);
          return target ? `]${opening}${target}` : match;
        })
        .replace(definition, (match, opening: string, file: string) => {
          const target = destinations.get(file);
          return target ? `${opening}${target}` : match;
        });
    })
    .join("");
}

type AnswerRecordMdastNode = {
  type: string;
  depth?: number;
  value?: string;
  children?: AnswerRecordMdastNode[];
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
};

const answerRecordMdastParser = unified().use(remarkParse).use(WIKI_REMARK_SYNTAX_PLUGINS);

const answerRecordVisibleHastProcessor = unified()
  .use(remarkParse)
  .use(WIKI_REMARK_PLUGINS ?? [])
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(WIKI_REHYPE_PLUGINS ?? []);

const HIDDEN_READER_TAGS = new Set(["details", "script", "style", "template"]);

function mdastPlainText(node: AnswerRecordMdastNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(mdastPlainText).join("");
}

function collectVisibleHastText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "element" && HIDDEN_READER_TAGS.has(node.tagName ?? "")) return "";
  return (node.children ?? []).map(collectVisibleHastText).join("");
}

function renderVisibleReaderText(markdownBody: string): string {
  const tree = answerRecordVisibleHastProcessor.runSync(
    answerRecordVisibleHastProcessor.parse(markdownBody),
  ) as HastNode;
  return (tree.children ?? []).map(collectVisibleHastText).join("\n").replace(/\s+/g, " ").trim();
}

function expandAnswerRecordCore(
  markdown: string,
  ar: AnswerRecordMaterial,
  pages: { id: string; file: string }[],
): { markdown: string; coreExpanded: boolean } {
  const fmMatch = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!fmMatch) {
    return { markdown: bindAnswerRecordPageLinks(markdown, pages), coreExpanded: false };
  }
  const head = fmMatch[0];
  const rest = markdown.slice(head.length);
  const root = answerRecordMdastParser.parse(rest) as AnswerRecordMdastNode;
  const slotMatches: Array<{
    startOffset: number;
    endOffset: number;
    inCollapsedSection: boolean;
    hasHeadingBefore: boolean;
  }> = [];
  let currentH2 = "";
  let hasHeadingBeforeSlot = false;
  for (const child of root.children ?? []) {
    if (child.type === "heading" && child.depth === 2) {
      currentH2 = mdastPlainText(child).trim();
      if (slotMatches.length === 0) hasHeadingBeforeSlot = true;
      continue;
    }
    const startOffset = child.position?.start?.offset;
    const endOffset = child.position?.end?.offset;
    if (
      child.type === "paragraph" &&
      child.children?.length === 1 &&
      child.children[0]?.type === "text" &&
      child.children[0].value?.trim() === ANSWER_RECORD_CORE_SLOT &&
      typeof startOffset === "number" &&
      typeof endOffset === "number" &&
      rest.slice(startOffset, endOffset).trim() === ANSWER_RECORD_CORE_SLOT
    ) {
      slotMatches.push({
        startOffset,
        endOffset,
        inCollapsedSection: currentH2 === "对照源码",
        hasHeadingBefore: hasHeadingBeforeSlot,
      });
    }
  }
  if (slotMatches.length > 1) {
    throw new Error(
      `问答草稿重复出现了 ${slotMatches.length} 次原问题与原回答正文核心占位行 ${ANSWER_RECORD_CORE_SLOT}`,
    );
  }
  const slot = slotMatches[0];
  if (!slot || slot.inCollapsedSection) {
    return { markdown: `${head}${bindAnswerRecordPageLinks(rest, pages)}`, coreExpanded: false };
  }
  const boundQuestion = bindAnswerRecordPageLinks(ar.question, pages).replace(/\r\n/g, "\n").trim();
  const boundAnswer = bindAnswerRecordPageLinks(ar.answer, pages).replace(/\r\n/g, "\n").trim();
  const block = [
    ...(slot.hasHeadingBefore ? [] : ["## 原始问答记录", ""]),
    `**原问题：** ${boundQuestion}`,
    "",
    boundAnswer,
  ].join("\n");
  const replaced = `${rest.slice(0, slot.startOffset)}\n\n${block}\n\n${rest.slice(slot.endOffset)}`;
  return { markdown: `${head}${bindAnswerRecordPageLinks(replaced, pages)}`, coreExpanded: true };
}

function assertAnswerRecordCorePreserved(
  ar: AnswerRecordMaterial,
  pages: { id: string; file: string }[],
  draftBody: string,
  coreExpanded: boolean,
): void {
  const normalize = (text: string) => bindAnswerRecordPageLinks(text, pages).replace(/\r\n/g, "\n").trim();
  const body = normalize(draftBody);
  if (!coreExpanded || body.includes(ANSWER_RECORD_CORE_SLOT)) {
    throw new Error(
      `问答草稿未在顶层可见正文放置独立的原问题与原回答正文核心占位 ${ANSWER_RECORD_CORE_SLOT}（禁止省略占位、自行改写，或将其放入 HTML 注释、代码围栏、折叠区等隐藏上下文）`,
    );
  }
  const expectedQuestion = normalize(ar.question);
  const expectedAnswer = normalize(ar.answer);
  if (!body.includes(expectedQuestion) || !body.includes(expectedAnswer)) {
    throw new Error(
      `问答草稿未完整保留原问题与原回答正文核心（禁止改写、删减或翻转结论；请使用 ${ANSWER_RECORD_CORE_SLOT} 占位由程序原样注入）`,
    );
  }
  const expectedVisibleQuestion = renderVisibleReaderText(bindDraftPageLinks(expectedQuestion, pages));
  const expectedVisibleAnswer = renderVisibleReaderText(bindDraftPageLinks(expectedAnswer, pages));
  const actualVisibleBody = renderVisibleReaderText(draftBody);
  if (
    !expectedVisibleQuestion ||
    !expectedVisibleAnswer ||
    !actualVisibleBody.includes(expectedVisibleQuestion) ||
    !actualVisibleBody.includes(expectedVisibleAnswer)
  ) {
    throw new Error(
      `问答草稿渲染后未在可见正文完整呈现原问题与原回答正文核心（请使用独立顶层段落 ${ANSWER_RECORD_CORE_SLOT} 由程序原样注入）`,
    );
  }
}

/** Also used by CLI dry-run; performs no writes and starts no agent. */
export function planRawCompile(root: string, input: RawCompileInput) {
  if (!ID_RE.test(input.id) || !input.rules.trim()) throw new Error("编译目标或规则无效");
  originSchema.parse(input.origin);
  positiveInteger(input.timeoutMs, "timeoutMs");
  const prepared = prepareRawInput(join(root, "wiki"), input.source);
  const rawMaterial = prepared.compilerData
    ? (JSON.parse(prepared.compilerData) as { source: string; lines?: { line: number; text: string }[] })
    : null;
  const answerRecord =
    input.purpose === "answer-record" ? parseAnswerRecordMaterial(input.source, rawMaterial) : null;
  if (input.purpose === "answer-record" && input.expectedAnswerRecord) {
    verifyAnswerRecordRaw(root, input.source, input.expectedAnswerRecord);
  }
  const material = input.purpose === "answer-record" ? answerRecord : rawMaterial;
  const inventory = loadPages(join(root, "wiki"));
  if (inventory.problems.length) throw new Error("现有页面无法解析，不能提供编译导航");
  const existing = inventory.pages.find((page) => page.fm.id === input.id);
  const others = inventory.pages.filter((page) => page.fm.id !== input.id);
  // 问答记录只链回答用到的页；其余编译只列与材料相关的页：列全库时 104 页就占 10,660 字符（2026-09-23）
  const listed = input.answerPages
    ? others
        .filter((page) => input.answerPages!.includes(page.fm.id))
        .sort((a, b) => a.fm.id.localeCompare(b.fm.id))
    : relevantPageIds(buildIndex(inventory.pages.map((p) => ({ ...p.fm, text: p.body }))), {
        ids: [input.id],
        query: [
          input.id,
          input.context?.why.slice(0, 500),
          ...(rawMaterial?.lines ?? []).map((l) => l.text),
        ].join("\n"),
      })
        .ids.filter((id) => id !== input.id)
        .map((id) => others.find((page) => page.fm.id === id)!);
  const navigation = {
    note: "仅用于章节归属、relations 和页面链接，不是正文事实来源。事实仍只能来自 material；不能凭标题推导邻居的实现。existingPage 存在时，本次是已有页面的正文核对，aliases 必须原样保留 existingPage.aliases，不新增别名；材料中提及的其他概念不是本页别名。没有适合的关系时保留缺口，不编造关联。existingRelations 是当前页已有的入边和出边，保持声明方向，不要把自动派生的反向边再写入 relations。引用本地 raw 材料时，图节点使用材料里的真实类名或函数名；文件路径写在正文，避免把源码文件当作运行组件。pages 只列与本次材料相关的页，omitted 是没列出的页数；没列出不代表库里没有。",
    existingPage: existing ? { id: existing.fm.id, aliases: existing.fm.aliases } : undefined,
    existingRelations: inventory.pages.flatMap((page) =>
      page.fm.relations
        .filter((edge) => page.fm.id === input.id || edge.to === input.id)
        .map(({ to, kind }) => ({ from: page.fm.id, to, kind })),
    ),
    chapterIds: CHAPTER_IDS,
    chapterTitles: CHAPTER_TITLES,
    pages: listed.map((page) => {
      const title = sanitizeRawInput(page.fm.title);
      if (title.blocked) throw new Error("编译导航标题清洗阻塞");
      return { id: page.fm.id, title: title.text, file: page.file };
    }),
    omitted: others.length - listed.length,
  };
  const args = restrictedArgs(input.rules);
  const context = input.context
    ? Object.fromEntries(
        Object.entries(input.context).map(([key, value]) => {
          const clean = sanitizeRawInput(value);
          if (clean.blocked) throw new Error("编译上下文清洗阻塞");
          return [key, clean.text];
        }),
      )
    : undefined;
  const stdin = JSON.stringify({
    mode: "local-material",
    id: input.id,
    purpose: input.purpose,
    outputContract:
      input.purpose === "answer-record"
        ? {
            format: "Return only a complete Markdown page with YAML frontmatter, no surrounding prose.",
            id: input.id,
            type: "source",
            evidence: "I",
            sources: [input.source],
            corePlaceholder: ANSWER_RECORD_CORE_SLOT,
            links: listed.map((page) => ({ title: page.fm.title, href: `../${page.file}` })),
            note: `The output is staged in _drafts/. Place the exact single-line placeholder ${ANSWER_RECORD_CORE_SLOT} once as a standalone top-level paragraph in the visible body (under a ## heading such as ## 原始问答记录, never inside HTML comments, code fences, blockquotes, lists, or ## 对照源码); the program deterministically expands ${ANSWER_RECORD_CORE_SLOT} into the verbatim material.question and verbatim material.answer with bound page links, and rejects any draft missing the visible top-level placeholder or visible rendered Q&A text. Do NOT rewrite, condense, or restate material.answer's conclusions or arithmetic. After the ${ANSWER_RECORD_CORE_SLOT} section, add a concise ## 引用范围与适用边界 section ([I]) linking at least one supplied page via the exact href above to note cited-page context, version/condition scope, and that archived Q&A is evidence: I rather than primary source code or hardware measurement (do not copy whole cited pages).`,
          }
        : {
            format: "Return only a complete Markdown page with YAML frontmatter, no surrounding prose.",
            id: input.id,
            sources: [input.source],
            note: "This is an intermediate draft based only on material, not the final replacement of an existing page. Use exactly the supplied sources entries in frontmatter. Do not split, shorten or change their line ranges, and do not add context or navigation as sources. Do not copy existing generated sections or numbered evidence marks, even when an old number would fit this draft's source count; those numbers belong to the existing page. Existing text is comparison context, not new evidence. Requirements to preserve old text, generated sections, diagrams, formulas and history apply to the later integration, which receives the original page separately and validates their preservation. More precise material locations may be described in the body without changing the source references.",
          },
    answerPages: input.answerPages,
    context,
    navigation,
    material,
  });
  const work: WorkInput = {
    origin: input.origin,
    sources: [{ ref: input.source, hash: prepared.receipt.rawHash }],
    targets: [input.id],
    recipeHash: digest(
      JSON.stringify({
        profile: RESTRICTED_PROFILE,
        args,
        stdin,
        screening: prepared.receipt,
        longMaterial: 1,
        ...(input.purpose === "answer-record" ? { answerRecordProtocol: 4 } : {}),
        ...(input.supersedes ? { supersedes: input.supersedes } : {}),
      }),
    ),
  };
  return { prepared, work, args, stdin, answerRecord };
}

const readOptional = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : undefined);

/** One archived source -> screened text -> validated draft. Never integrates. */
export async function compileRaw(
  store: WorkflowStore,
  input: RawCompileInput,
  policy: WorkflowPolicy,
  deps: { runAgent: RunAgent; retry?: boolean },
): Promise<AgentResult> {
  const plan = planRawCompile(store.root, input);
  const job = await store.enqueue(plan.work, policy, plan.prepared.receipt);
  const base: AgentResult = {
    id: input.id,
    jobId: job.id,
    ok: false,
    exitCode: 1,
    stderrTail: "",
    costUsd: 0,
  };
  if (job.state === "blocked") return { ...base, reason: "清洗阻塞；没有启动编译，需审查材料" };
  if (job.state === "integrated") return { ...base, ok: true, exitCode: 0, reason: "同证据任务已整合" };
  if (job.state === "draft") {
    if (!store.matchesDraft(job, input.id)) throw new Error("已记录草稿或来源发生变化");
    return { ...base, ok: true, exitCode: 0, reason: "复用已有草稿" };
  }
  const previousAttempt = job.attempts.at(-1);
  const attempt = await store.claim(job.id, deps.retry);
  const wiki = join(store.root, "wiki");
  const draft = `_drafts/${input.id}.md`;
  let stage: string | undefined;
  let result = base;
  try {
    const before = readOptional(join(wiki, draft));
    let stdin = plan.stdin;
    if (deps.retry && previousAttempt?.reason === "Error: 编译草稿 schema 无效") {
      const receipt = readOptional(
        join(wiki, `_jobs/compilations/${job.id}.${previousAttempt.token}.output.json`),
      );
      if (receipt) {
        const previous = JSON.parse(receipt) as AgentResult;
        if (
          previous.ok &&
          typeof previous.output === "string" &&
          Buffer.byteLength(previous.output, "utf8") <= 128 * 1024
        ) {
          // Recompute validator rules from the same job's rejected output; never replay model prose as instructions.
          const validationFeedback = parsePage(draft, unfence(previous.output))
            .problems.slice(0, 4)
            .map(({ rule }) => ({ rule }));
          if (validationFeedback.length) stdin = JSON.stringify({ ...JSON.parse(stdin), validationFeedback });
        }
      }
    }
    if (
      deps.retry &&
      (previousAttempt?.reason?.includes("原问题与原回答正文核心") ||
        previousAttempt?.reason?.includes(ANSWER_RECORD_CORE_SLOT))
    ) {
      stdin = JSON.stringify({
        ...JSON.parse(stdin),
        validationFeedback: [{ rule: "answer-record-core-missing", requiredLine: ANSWER_RECORD_CORE_SLOT }],
      });
    }
    const budget = inputByteLimit(store.root, input.rules);
    if (Buffer.byteLength(stdin, "utf8") > budget) {
      const packet = JSON.parse(stdin);
      if (input.purpose === "answer-record" && plan.answerRecord) {
        const ar = plan.answerRecord;
        const coreMaterial = {
          source: ar.source,
          note: ar.note,
          question: ar.question,
          answer: ar.answer,
          ...(ar.toolEvidence?.length ? { toolEvidence: ar.toolEvidence } : {}),
        };
        const corePacketBytes = jsonBytes({ ...packet, material: coreMaterial });
        const remaining = budget - corePacketBytes - 1024;
        if (remaining < 4096) {
          const coreBytes = jsonBytes({ question: ar.question, answer: ar.answer });
          const maxCoreBytes = Math.max(0, budget - jsonBytes({ ...packet, material: undefined }) - 5120);
          throw new Error(
            `原问答核心（question + answer 共 ${coreBytes} 字节）超出当前上下文预算（可用 ${maxCoreBytes} 字节），拒绝有损压缩或静默丢弃原回答`,
          );
        }
        packet.material = {
          ...coreMaterial,
          citedContext: await readLongMaterial(
            store.root,
            {
              topic: `问答归档支撑上下文（问题：${ar.question}）：仅提取与该问题及回答直接相关的引用页原文依据、适用条件、版本与非实测边界；严禁偏离原问题做无关泛化综述`,
              sources: ar.citedPages.map((p) => ({
                source: `cited-page:${p.file}`,
                text: p.text,
              })),
              maxBytes: remaining,
              origin: input.origin,
              policy,
            },
            deps,
          ),
        };
        stdin = JSON.stringify(packet);
      } else {
        const material = packet.material as { source: string; lines: { line: number; text: string }[] };
        packet.material = undefined;
        if (packet.context && jsonBytes(packet.context) > budget / 3) {
          const { sourceId, ...texts } = packet.context;
          packet.context = {
            sourceId,
            ...(await readLongMaterial(
              store.root,
              {
                topic: `${input.id}：已有页面的结构、事实、限制；仅供对照，不作为新证据`,
                // Quote against readable strings, not JSON's escaped representation of the page.
                sources: Object.entries(texts).map(([name, text]) => ({
                  source: `existing-page-context:${name}`,
                  text: text as string,
                })),
                maxBytes: Math.floor(budget / 4),
                origin: input.origin,
                policy,
              },
              deps,
            )),
          };
        }
        const remaining = budget - jsonBytes(packet) - 1024;
        packet.material = await readLongMaterial(
          store.root,
          {
            topic: input.id,
            sources: [{ source: material.source, text: material.lines.map((line) => line.text).join("\n") }],
            maxBytes: remaining,
            origin: input.origin,
            policy,
          },
          deps,
        );
        stdin = JSON.stringify(packet);
      }
    }
    assertInputFits(store.root, input.rules, stdin);
    stage = mkdtempSync(join(tmpdir(), "wiki-compile-"));
    const request: AgentRequest = {
      ...attempt.selection,
      id: input.id,
      cwd: stage,
      accountingOnly: attempt.accountingOnly,
      args: [
        ...plan.args,
        ...(attempt.budgetUsd === undefined ? [] : ["--max-budget-usd", String(attempt.budgetUsd)]),
      ],
      stdin,
      timeoutMs: input.timeoutMs,
      allowedWrites: [],
    };
    mkdirSync(join(wiki, "_jobs/compilations"), { recursive: true });
    atomicText(
      join(wiki, `_jobs/compilations/${job.id}.${attempt.token}.input.json`),
      JSON.stringify({ rules: input.rules, stdin }),
    );
    const batch = await runBatch([request], { concurrency: 1, runAgent: deps.runAgent });
    result = { ...batch.results[0]!, jobId: job.id };
    atomicText(
      join(wiki, `_jobs/compilations/${job.id}.${attempt.token}.output.json`),
      JSON.stringify(result),
    );
    if (!result.ok) throw new Error(result.reason ?? "编译失败");
    if (readdirSync(stage).length) throw new Error("无工具编译产生了文件，拒绝发布");
    if (!result.output || Buffer.byteLength(result.output, "utf8") > 128 * 1024)
      throw new Error("缺少 Markdown 结果或结果过大");
    // 模型偶尔把整页包进一层 ```markdown 围栏（2026-09-23 真实重编）；剥掉包装再按页面 schema 验
    const navigationPages = JSON.parse(plan.stdin).navigation.pages as { id: string; file: string }[];
    const unfenced = unfence(result.output);
    const coreExpansion =
      input.purpose === "answer-record" && plan.answerRecord
        ? expandAnswerRecordCore(unfenced, plan.answerRecord, navigationPages)
        : { markdown: unfenced, coreExpanded: false };
    const output = bindDraftPageLinks(coreExpansion.markdown, navigationPages);
    const parsed = parsePage(draft, output);
    if (!parsed.page || parsed.problems.length) throw new Error("编译草稿 schema 无效");
    if (
      input.purpose === "answer-record" &&
      (parsed.page.fm.type !== "source" || parsed.page.fm.evidence !== "I")
    )
      throw new Error("问答记录必须为 source / I，不能把模型回答升格为一手证据");
    if (parsed.page.fm.sources.some((s) => s !== input.source)) throw new Error("草稿引用了未提供的来源");
    if (input.purpose === "answer-record") {
      const known = new Set(input.answerPages ?? []);
      const links = citedPageLinks(parsed.page.body).map((href) => {
        const withoutRoute = href.startsWith("#/wiki/") ? href.slice("#/wiki/".length) : href;
        return withoutRoute.split("#")[0]!.split("/").at(-1)!.replace(/\.md$/i, "");
      });
      const targets = [...links, ...parsed.page.fm.related, ...parsed.page.fm.relations.map((r) => r.to)];
      if (!targets.length || targets.some((id) => !known.has(id)))
        throw new Error("问答草稿必须关联已提供的页面，不能引用未知页面");
      if (plan.answerRecord) {
        assertAnswerRecordCorePreserved(
          plan.answerRecord,
          navigationPages,
          parsed.page.body,
          coreExpansion.coreExpanded,
        );
      }
    }
    // 2026-09-25 起不再规定开头必须是「## 一句话」；准入只挡掉连一个小节都没有的输出
    if (!/^##\s+\S/m.test(parsed.page.body)) throw new Error("草稿正文没有任何 ## 小节");
    const loaded = loadPages(wiki);
    const issues = splitProblems(
      lintPages([...loaded.pages.filter((p) => p.fm.id !== input.id), parsed.page], {
        chapterIds: CHAPTER_IDS,
        existsFile: wikiFileExists(wiki),
      }),
    ).errors;
    if (loaded.problems.length || issues.length)
      throw new Error(`草稿 lint 失败：${JSON.stringify([...loaded.problems, ...issues])}`);
    const path = parseRawRef(input.source)!.path;
    const text = withRawSources(output, [path], input.origin);
    const finished = await store.finish(
      job.id,
      attempt.token,
      {
        ok: true,
        costUsd: result.costUsd,
        billing: result.billing,
        usage: result.usage,
        artifacts: { [draft]: digest(text), [path]: plan.prepared.receipt.rawHash },
      },
      () => {
        if (
          digest(readRawSnapshot(wiki, path)) !== plan.prepared.receipt.rawHash ||
          readOptional(join(wiki, draft)) !== before
        )
          throw new Error("编译期间来源或草稿发生变化");
        mkdirSync(join(wiki, "_drafts"), { recursive: true });
        atomicText(join(wiki, draft), text);
      },
    );
    return {
      ...result,
      output: undefined,
      ok: finished.state === "draft",
      reason: finished.attempts.at(-1)?.reason,
    };
  } catch (error) {
    const reason = String(error);
    await store.finish(job.id, attempt.token, {
      ok: false,
      costUsd: result.costUsd,
      billing: result.billing,
      usage: result.usage,
      reason,
    });
    return { ...result, output: undefined, ok: false, reason };
  } finally {
    try {
      if (stage && existsSync(stage)) {
        const within = relative(realpathSync(tmpdir()), realpathSync(stage));
        if (
          !within.startsWith("wiki-compile-") ||
          within.includes("..") ||
          lstatSync(stage).isSymbolicLink() ||
          resolve(stage) === resolve(tmpdir())
        )
          console.warn("编译临时目录位置异常，保留现场");
        else rmSync(stage, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`编译临时目录清理失败，保留现场：${String(error)}`);
    }
  }
}
