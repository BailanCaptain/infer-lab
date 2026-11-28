import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveParamDisplayTitle } from "../../src/content/wiki/param-display";
import { buildIndex, type PageIndex, retrieve } from "../../src/content/wiki/retrieve";
import { registrySchema } from "../../src/content/wiki/schema";
import { analyzeTroubleshootInput } from "../../src/sim/troubleshoot/logAnalyzer";
import { localFixVersions, probeRepoGitAccess, repoGitStamp } from "./chat-trace";
import { parseSeeds } from "./ingest";
import { loadPages } from "./pages";

export type Ecosystem = "github" | "gitcode";

export interface LinkedMergedPr {
  ref: string;
  number: number;
  title?: string;
  url?: string;
  source?: string;
  commit_sha?: string;
  has_diff?: boolean;
  docs_only?: boolean;
  diff_excerpt_docs_only?: boolean;
}

export interface DistilledIssueItem {
  key: string;
  ecosystem?: Ecosystem;
  repo: string;
  number: number | string;
  url: string;
  title: string;
  closed_at: string | null;
  comments_complete: boolean;
  raw_sha256: string;
  normalizer_version?: string;
  content_input_sha256?: string;
  resume_input_sha256?: string;
  answer_parsed?: boolean;
  pr_diff_source_ref?: string;
  pr_diff_docs_only?: boolean;
  teacher_model?: string;
  teacher_backend?: string;
  teacher_dtype?: string;
  candidate_prs?: Array<number | string>;
  linked_merged_prs?: LinkedMergedPr[];
  pr_diff_lines?: number;
  verbatim_root_line: string;
  verbatim_root_verified: boolean;
  verbatim_root_source?: string;
  model_verbatim_root_line_rejected?: string;
  verbatim_cascade_lines?: string[];
  forensic_chain_zh?: string;
  thinking_summary?: string;
  distilled: {
    verbatim_root_line?: string;
    verbatim_cascade_lines?: string[];
    error_codes?: string[];
    fault_domain?: string;
    subsystem?: string;
    hardware_soc?: string;
    topology?: string;
    root_cause_confirmed?: boolean | string;
    root_cause_zh?: string;
    pr_fix_mechanism_zh?: string;
    fix_or_workaround_zh?: string;
    fix_pr_refs?: string[];
    fix_pr_numbers?: Array<number | string>;
    unparsed_fix_pr_citations?: string[];
    colloquial_queries_zh?: string[];
    same_code_trap_zh?: string;
    forensic_chain_zh?: string;
  };
}

export interface DistilledPayload {
  schemaVersion: number;
  normalizerVersion?: string;
  status?: string;
  failedCount?: number;
  generatedAt: string;
  teacherModel: string;
  teacherModelsUsed?: string[];
  backend?: string;
  dtype?: string;
  gpu: string;
  vramGiB: number;
  maxNewTokens?: number;
  elapsedSec: number;
  totalIssues: number;
  expectedTotalIssues?: number;
  verbatimVerifiedCount: number;
  modelVerbatimVerifiedCount?: number;
  fallbackVerbatimVerifiedCount?: number;
  forensicChainPresentCount?: number;
  familyCount?: number;
  families?: Array<{
    count?: number;
    verifiedRootCount?: number;
    confirmedRootCauseCount?: number;
    withPrDiffCount?: number;
    memberKeys?: string[];
    representatives?: Array<{
      key?: string;
      repo?: string;
      url?: string;
      title?: string;
      verbatim_root_line?: string;
      verbatim_root_verified?: boolean;
      verified_fix_pr_refs?: string[];
      fix_pr_refs?: string[];
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  }>;
  items: DistilledIssueItem[];
}

export interface RawCorpusItem {
  key: string;
  ecosystem?: Ecosystem;
  repo: string;
  number: number | string;
  url?: string;
  title: string;
  body: string;
  comments_text?: string;
  comments_complete?: boolean;
  detected_error_codes?: string[];
  raw_sha256: string;
  fault_domain_hint?: string;
  pr_diff_source_ref?: string;
  pr_diff_lines?: number;
  pr_diff_snippet?: string;
  candidate_prs?: Array<number | string>;
  linked_merged_prs?: LinkedMergedPr[];
  [extra: string]: unknown;
}

export interface AuditedPrLineage {
  pr: number;
  ref: string;
  commit: string;
  commits?: string[];
  confirmed?: boolean;
  commitConflict?: boolean;
  gitVerificationError?: string;
  inBaselines: Record<string, boolean>;
  backportCommits?: Record<string, string>;
  revertedInBaselines?: Record<string, string>;
}

export interface VllmMergedPrProvenance {
  ref: string;
  repo: "vllm-project/vllm";
  number: number;
  url: string;
  merged: boolean;
  confirmed: boolean;
  docsOnly?: boolean;
  title?: string;
  source?: string;
  commit?: string;
  commits?: string[];
  commitConflict?: boolean;
  gitVerificationError?: string;
  inBaselines?: Record<string, boolean>;
  backportCommits?: Record<string, string>;
  revertedInBaselines?: Record<string, string>;
}

export interface GitcodeMergedMrProvenance {
  ref: string;
  repo: string;
  number: number;
  url: string;
  merged: boolean;
  confirmed: boolean;
  docsOnly?: boolean;
  title?: string;
  source?: string;
}

export interface OtherExternalPrProvenance {
  ref: string;
  repo: string;
  number: number;
  merged: boolean;
  confirmed: boolean;
  docsOnly?: boolean;
}

export const CANONICAL_ASCEND_PINS = [
  "releases/v0.23.0",
  "releases/v0.26.0rc",
  "releases/v0.30.0",
  "main",
] as const;

export const CANONICAL_VLLM_PINS = [
  "releases/v0.23.0",
  "releases/v0.26.0",
  "releases/v0.30.0",
  "main",
] as const;

export const DEFAULT_DUAL_INPUT = "tools/wiki-runtime/colab-distill/distilled_ascend_dual.json";
export const DEFAULT_LEGACY_INPUT = "tools/wiki-runtime/colab-distill/distilled_ascend_github.json";
export const DEFAULT_OUT_REPORT = "tools/wiki-runtime/colab-distill/verified_audit_report.json";

const LINE_BREAK_SPLIT_RE = /\r\n|[\r\n\v\f\x85\u2028\u2029]/;
const ANY_LINE_BREAK_RE = /[\r\n\v\f\x85\u2028\u2029]/;

export function parseStrictBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.trim().toLowerCase() === "true";
  return false;
}

function extractUrlHostEcosystem(urlStr: string): Ecosystem | null {
  const s = urlStr.trim();
  if (!s || /\s/.test(s)) return null;
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  const host = parsed.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com") return "github";
  if (host === "gitcode.com" || host === "www.gitcode.com") return "gitcode";
  return null;
}

export function inferEcosystem(
  item: Pick<DistilledIssueItem, "ecosystem" | "key" | "repo" | "url">,
): Ecosystem {
  const urlEco = extractUrlHostEcosystem(item.url ?? "");
  if (urlEco) return urlEco;
  if (item.ecosystem === "gitcode" || item.ecosystem === "github") return item.ecosystem;
  const keyLower = (item.key ?? "").toLowerCase();
  if (keyLower.startsWith("gitcode:")) return "gitcode";
  if (keyLower.startsWith("github:")) return "github";
  const owner = item.repo.split("/")[0]?.toLowerCase() ?? "";
  if (owner === "cann" || owner === "ascend") return "gitcode";
  return "github";
}

export const DISTILL_SYSTEM_PROMPT_SHA256 =
  "7456cad11833b5fe1580ae196c8c87de6d29aa3a1159a5394441a18ea827a9e5";

export function computeRawSha256(title: string, body: string, commentsText: string): string {
  return createHash("sha256").update(`${title}\n${body}\n${commentsText}`, "utf8").digest("hex");
}

function canonicalJsonStringify(val: unknown): string {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map((v) => (v === undefined ? "null" : canonicalJsonStringify(v))).join(",")}]`;
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(",")}}`;
}

function resolveVerifiedDiffSourceForPrompt(rawRow: RawCorpusItem): { label: string; bound: boolean } {
  const eco = inferEcosystem({
    ecosystem: rawRow.ecosystem,
    key: rawRow.key,
    repo: rawRow.repo,
    url: rawRow.url ?? "",
  });
  const repo = String(rawRow.repo ?? "").trim();
  const linkedPrs = Array.isArray(rawRow.linked_merged_prs)
    ? rawRow.linked_merged_prs.filter((p): p is LinkedMergedPr => Boolean(p && typeof p === "object"))
    : [];
  const linkedCanonical = new Map<string, string>();
  const hasDiffRefs: string[] = [];
  for (const p of linkedPrs) {
    const pUrl = String(p.url ?? "").trim();
    const parsed = parseSinglePrOrMrRef(p.ref || pUrl || p.number, eco, repo, pUrl || undefined);
    if (parsed) {
      const canon = parsed.canonicalRef;
      linkedCanonical.set(canon.toLowerCase(), canon);
      if (parseStrictBool(p.has_diff)) hasDiffRefs.push(canon);
    }
  }
  const rawSrc = String(rawRow.pr_diff_source_ref ?? "").trim();
  if (rawSrc) {
    const parsedSrc = parseSinglePrOrMrRef(rawSrc, eco, repo);
    if (!parsedSrc) return { label: "", bound: false };
    const canonKey = parsedSrc.canonicalRef.toLowerCase();
    const matchedCanon = linkedCanonical.get(canonKey);
    if (!matchedCanon) return { label: "", bound: false };
    const uniqueHasDiffLower = new Set(hasDiffRefs.map((r) => r.toLowerCase()));
    if (uniqueHasDiffLower.size > 1) return { label: "", bound: false };
    if (uniqueHasDiffLower.size === 1 && !uniqueHasDiffLower.has(canonKey)) {
      return { label: "", bound: false };
    }
    return { label: matchedCanon, bound: true };
  }
  const uniqueHasDiff = [...new Set(hasDiffRefs)];
  if (uniqueHasDiff.length === 1) {
    return { label: uniqueHasDiff[0]!, bound: true };
  }
  return { label: "", bound: false };
}

function sliceCodePoints(s: string, limit: number): string {
  if (s.length <= limit) return s;
  return Array.from(s).slice(0, limit).join("");
}

export function buildDistillUserPrompt(rawRow: RawCorpusItem): string {
  const ecosystem = inferEcosystem({
    ecosystem: rawRow.ecosystem,
    key: rawRow.key,
    repo: rawRow.repo,
    url: rawRow.url ?? "",
  });
  const repo = String(rawRow.repo ?? "");
  const num = rawRow.number;
  const title = String(rawRow.title ?? "").trim();
  const body = sliceCodePoints(String(rawRow.body ?? ""), 5000);
  const commentsText = sliceCodePoints(String(rawRow.comments_text ?? ""), 2800);
  const commentsComplete = parseStrictBool(rawRow.comments_complete);
  const linkedPrs = Array.isArray(rawRow.linked_merged_prs)
    ? rawRow.linked_merged_prs.filter((p): p is LinkedMergedPr => Boolean(p && typeof p === "object"))
    : [];
  const prRefs = linkedPrs.filter((p) => Boolean(p.ref)).map((p) => String(p.ref));
  const prTitles = linkedPrs
    .filter((p) => Boolean(p.ref) && Boolean(p.title))
    .map((p) => `${p.ref}: ${p.title}`);
  const prDiff = sliceCodePoints(String(rawRow.pr_diff_snippet ?? ""), 4200);
  const { label: prDiffSource, bound: diffBound } = resolveVerifiedDiffSourceForPrompt(rawRow);
  const domainHint = String(rawRow.fault_domain_hint ?? "");
  const detectedCodes = Array.isArray(rawRow.detected_error_codes)
    ? rawRow.detected_error_codes.filter((c): c is string => typeof c === "string")
    : [];

  const parts: string[] = [
    `生态: ${ecosystem} | 仓库: ${repo} #${num}`,
    `标题（严禁复制到 verbatim_root_line）: ${title}`,
    `预检测错误码: ${detectedCodes.length > 0 ? detectedCodes.join(", ") : "无"} | 领域初判参考: ${domainHint}`,
    `关联已合入 PR/MR: ${prRefs.length > 0 ? prRefs.join(", ") : "无"}`,
  ];
  if (prTitles.length > 0) {
    parts.push(`PR/MR 标题:\n${prTitles.slice(0, 3).join("\n")}`);
  }
  parts.push(`\n正文摘录:\n${body}`);
  parts.push(`\n评论区摘录 (完整=${commentsComplete ? "True" : "False"}):\n${commentsText || "无"}`);
  if (prDiff) {
    const diffHeader =
      diffBound && prDiffSource
        ? `\n关联已合入 PR/MR 代码 Diff (来源=${prDiffSource}, 裁剪<=120行):`
        : "\n关联代码 Diff 摘录 (未绑定单一已合入 PR/MR，请勿归属给特定已合入 PR/MR，裁剪<=120行):";
    parts.push(`${diffHeader}\n\`\`\`diff\n${prDiff}\n\`\`\``);
  }
  return parts.join("\n");
}

export function computeDistillContentSha256(rawRow: RawCorpusItem): string {
  const promptSha = createHash("sha256").update(buildDistillUserPrompt(rawRow), "utf8").digest("hex");
  const basis = {
    item: rawRow,
    prompt_sha256: promptSha,
    system_prompt_sha256: DISTILL_SYSTEM_PROMPT_SHA256,
  };
  return createHash("sha256").update(canonicalJsonStringify(basis), "utf8").digest("hex");
}

export function computeDistillInputSha256(
  rawRow: RawCorpusItem,
  opts: {
    teacherModel: string;
    teacherBackend: string;
    teacherDtype: string;
    maxNewTokens?: number;
    normalizerVersion?: string;
  },
): string {
  const promptSha = createHash("sha256").update(buildDistillUserPrompt(rawRow), "utf8").digest("hex");
  const basis = {
    item: rawRow,
    max_new_tokens: Math.trunc(opts.maxNewTokens ?? 1536),
    normalizer_version: (opts.normalizerVersion ?? "f6-v3").trim(),
    prompt_sha256: promptSha,
    system_prompt_sha256: DISTILL_SYSTEM_PROMPT_SHA256,
    teacher_backend: (opts.teacherBackend ?? "").trim(),
    teacher_dtype: (opts.teacherDtype ?? "").trim(),
    teacher_model: (opts.teacherModel ?? "").trim(),
  };
  return createHash("sha256").update(canonicalJsonStringify(basis), "utf8").digest("hex");
}

function normalizeTitleCompare(s: string): string {
  let cur = s.trim();
  while (cur) {
    let nxt = cur.replace(/^(?:[>\-*+#]+\s*)+/, "");
    nxt = nxt.replace(/^(?:\[[^\]]+\]\s*)+[:：]?\s*/, "");
    nxt = nxt.replace(/^(\*{1,3}|_{1,3}|~{2})(.+?)\1$/, "$2");
    nxt = nxt.replace(/^[ \t"'`*_~「」『』“”‘’]+|[ \t"'`*_~「」『』“”‘’]+$/g, "");
    if (nxt === cur) break;
    cur = nxt;
  }
  return cur.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Hard title-leak gate: reject any verbatim_root_line (or cascade line) that equals or is a
 * substring of the issue title (both raw and after normalizing `> ` blockquotes, `[Bug]:` tags,
 * markdown emphasis wrappers, surrounding quotes, case, and internal whitespace).
 */
export function isTitleLeak(candidate: string, title: string): boolean {
  const cand = candidate.trim();
  const t = title.trim();
  if (!cand || !t) return false;
  if (cand === t || t.includes(cand)) return true;
  const candNorm = normalizeTitleCompare(cand);
  const titleNorm = normalizeTitleCompare(t);
  if (candNorm && titleNorm && (candNorm === titleNorm || titleNorm.includes(candNorm))) return true;
  return false;
}

const NON_WS_DIAG_PUNCT_RE = /[:=()[\]{}<>/\\|'`",!?;@#$%^&*_]/;
const CAMEL_IDENT_RE = /[a-z][A-Z]/;
const CRASH_PHRASE_RE =
  /\b(?:segmentation fault|out of memory|core dumped|address already in use|undefined symbol)\b/i;
const PRECEDING_NEGATION_EN_RE =
  /(?:^|[ \t,([\]["'“‘])(?:no|not|never|without|neither|nor|didn't|did[ \t]+not|doesn't|does[ \t]+not|won't|will[ \t]+not|cannot|can't|absent|none[ \t]+of)(?:[ \t]+(?:any|a|an|the|such|longer|more|further|observed|see|seen|saw|trigger|triggered|hit|raise|raised|throw|thrown|occur|occurred|report|reported|have|had))*[ \t]*["'`“‘(]*$/i;
const PRECEDING_NEGATION_ZH_RE =
  /(?:没有|未出现|未见|不会报|未报|并未报|并未出现|不报|不是|并非|而非|无)[ \t]*["'`“‘(]*$/;
const NEGATED_PROSE_LINE_RE =
  /^(?:there[ \t]+(?:is|was|were|are)[ \t]+no\b|(?:we|i|it|this[ \t]+run)[ \t]+(?:did[ \t]+not|didn't|never)[ \t]+(?:see|hit|get|observe|encounter|reproduce)\b|没有出现|未见|并未出现|未复现)/i;

const DIAG_KEYWORD_RE =
  /\b(?:error|exception|failed|failure|fault|exceeds|overflow|invalid|crash(?:ed)?|abort(?:ed)?|panic|segfault|denied|refused|unreachable|mismatch|unsupported|corrupt|terminated|killed|assert(?:ion)?)\b/i;

const ERROR_CODE_TOKEN_RE =
  /^(?:-?[0-9]{1,12}|0x[0-9a-f]+|retcode=0x[0-9a-f]+|http[ \t]*[0-9]{3}|e[a-z0-9][0-9]{4}|err[0-9]{4,6}|(?:acl|aclnn|hccl|hcomm|rt|ge|fe|drv|ts|tsd|cuda|nccl|npu)_(?:e|err|error)_[a-z0-9_]+|(?:el|ee|ez|ei|ej|em|ew)_[a-z0-9_]+|sig[a-z0-9]+|e[a-z]{3,15})$/i;
const UPPER_ERROR_MACRO_RE = /^(?:[a-z][a-z0-9_]*::)?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
const ERROR_MACRO_HINT_RE =
  /(?:^|_)(?:ERR|ERROR|FAIL|FAILED|FAULT|INVALID|TIMEOUT|NULLPTR|OOM|OOB|OVERFLOW|UNSUPPORTED|MISMATCH|ABORT|DENIED|BUSY|EMPTY|FULL|RANGE|PERM|PARAM|PARAMS|STATUS|BAD|NOTFOUND|UNAVAILABLE)(?:_|$)/;
const POSIX_ERR_CODES = new Set([
  "EINVAL",
  "ENOMEM",
  "ENOENT",
  "EACCES",
  "EAGAIN",
  "EBUSY",
  "ECONNREFUSED",
  "ECONNRESET",
  "EADDRINUSE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "EIO",
  "EFAULT",
  "ERANGE",
  "EPERM",
  "SIGSEGV",
  "SIGABRT",
  "SIGKILL",
  "SIGBUS",
  "SIGTERM",
]);

function codePointLen(s: string): number {
  return Array.from(s).length;
}

export function isValidErrorCodeToken(tok: string): boolean {
  if (!tok || codePointLen(tok) > 48 || ANY_LINE_BREAK_RE.test(tok)) return false;
  for (let i = 0; i < tok.length; i++) {
    if (tok.charCodeAt(i) > 0x7f) return false;
  }
  const up = tok.toUpperCase();
  if (up === "TRUE" || up === "FALSE" || up === "NULL" || up === "NONE" || up === "UNKNOWN" || up === "NAN") {
    return false;
  }
  if (POSIX_ERR_CODES.has(up)) return true;
  if (UPPER_ERROR_MACRO_RE.test(tok) && ERROR_MACRO_HINT_RE.test(tok)) return true;
  if (!ERROR_CODE_TOKEN_RE.test(tok)) return false;
  if (/^[A-Za-z]+$/.test(tok)) return POSIX_ERR_CODES.has(up);
  return true;
}

export function isNonTrivialVerbatimSpan(cand: string, isExactLine: boolean): boolean {
  const cpLen = codePointLen(cand);
  if (cpLen < 8) return false;
  if (/^\[[A-Za-z0-9_]+\]$/.test(cand)) return false;
  const hasNonWsDiag = NON_WS_DIAG_PUNCT_RE.test(cand);
  const hasDigit = /[0-9]/.test(cand);
  const hasCamel = CAMEL_IDENT_RE.test(cand);
  const hasCrash = CRASH_PHRASE_RE.test(cand);
  const hasDiagKw = DIAG_KEYWORD_RE.test(cand);
  const isBareUpper = /^[A-Z][A-Z0-9_]{5,}$/.test(cand);
  const isExcOrMacro =
    /(?:Error|Exception|Fault|Timeout|Segfault|Abort|Panic|Assert)$/.test(cand) ||
    (isBareUpper && isValidErrorCodeToken(cand) && !/_(?:NONE|SUCCESS|OK)$/i.test(cand));
  if (isBareUpper && !isExcOrMacro) return false;
  if (isExactLine) {
    if (NEGATED_PROSE_LINE_RE.test(cand)) return false;
    return hasNonWsDiag || hasDigit || hasCamel || hasCrash || isExcOrMacro || hasDiagKw;
  }
  return cpLen >= 12 && (hasNonWsDiag || hasDigit || hasCamel || hasCrash);
}

function isNegatedOccurrence(line: string, idx: number): boolean {
  const prefix = line.slice(0, idx);
  const clausePrefix = prefix.split(/[.;!?\n。；！？]/).pop() ?? "";
  return PRECEDING_NEGATION_EN_RE.test(clausePrefix) || PRECEDING_NEGATION_ZH_RE.test(clausePrefix);
}

function matchesValidSubstringOccurrence(line: string, cand: string): boolean {
  const isWordStart = /[A-Za-z0-9_]/.test(cand[0] ?? "");
  const isWordEnd = /[A-Za-z0-9_]/.test(cand[cand.length - 1] ?? "");
  let start = 0;
  while (true) {
    const idx = line.indexOf(cand, start);
    if (idx < 0) return false;
    const leftOk = !isWordStart || idx === 0 || !/[A-Za-z0-9_]/.test(line[idx - 1] ?? "");
    const endIdx = idx + cand.length;
    const rightOk = !isWordEnd || endIdx === line.length || !/[A-Za-z0-9_]/.test(line[endIdx] ?? "");
    if (leftOk && rightOk && !isNegatedOccurrence(line, idx)) return true;
    start = idx + 1;
  }
}

export function isSingleLineInField(candidate: string, body: string, commentsText: string): boolean {
  if (!candidate || ANY_LINE_BREAK_RE.test(candidate)) return false;
  const cand = candidate.trim();
  if (!cand) return false;
  for (const fieldText of [body, commentsText]) {
    if (!fieldText || !fieldText.includes(cand)) continue;
    for (const rawLn of fieldText.split(LINE_BREAK_SPLIT_RE)) {
      if (!rawLn.includes(cand)) continue;
      const isExactLine = cand === rawLn.trim();
      if (!isNonTrivialVerbatimSpan(cand, isExactLine)) continue;
      if (isExactLine || matchesValidSubstringOccurrence(rawLn, cand)) return true;
    }
  }
  return false;
}

/**
 * Returns true iff `candidate` has at least one valid single-line occurrence in `body` or `commentsText`
 * whose full containing source line is NOT prose/hypothetical commentary (prevents shortening a hypothetical
 * prose sentence to a bare substring to bypass `isProseSummaryNotRuntimeLog`).
 */
export function hasNonProseSourceOccurrence(candidate: string, body: string, commentsText: string): boolean {
  if (!candidate || ANY_LINE_BREAK_RE.test(candidate)) return false;
  const cand = candidate.trim();
  if (!cand) return false;
  const candRt = RUNTIME_LOG_MARKER_RE.exec(cand);
  const candIsDirectRuntimeLog =
    candRt !== null && (cand.slice(0, candRt.index).match(CJK_CHAR_RE) ?? []).length < 16;
  for (const fieldText of [body, commentsText]) {
    if (!fieldText || !fieldText.includes(cand)) continue;
    const lines = fieldText.split(LINE_BREAK_SPLIT_RE);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const rawLn = lines[lineIdx]!;
      if (!rawLn.includes(cand)) continue;
      const trimmedLn = rawLn.trim();
      const isExactLine = cand === trimmedLn;
      if (!isNonTrivialVerbatimSpan(cand, isExactLine)) continue;
      if (!isExactLine && !matchesValidSubstringOccurrence(rawLn, cand)) continue;
      if (isMarkdownPrOrLinkListLine(trimmedLn)) continue;
      const lnIsStrict = STRICT_LOG_LINE_START_RE.test(trimmedLn);
      if (
        MAINTAINER_CLOSURE_RE.test(trimmedLn) ||
        PY_LOG_CALL_LINE_RE.test(trimmedLn) ||
        (!lnIsStrict && NARRATIVE_PROSE_OVERRIDE_RE.test(trimmedLn)) ||
        isInsidePyLogCallArg(lines, lineIdx) ||
        isInsideCppLogMacroCall(lines, lineIdx)
      ) {
        continue;
      }
      if (!isExactLine && candIsDirectRuntimeLog) {
        if (
          !/^\|.*\|$/.test(trimmedLn) &&
          !HYPOTHETICAL_PROSE_RE.test(trimmedLn) &&
          (lnIsStrict || !PROSE_NOT_LOG_RE.test(trimmedLn))
        ) {
          return true;
        }
        continue;
      }
      if (!isProseSummaryNotRuntimeLog(rawLn)) return true;
    }
  }
  return false;
}

export const CURRENT_SCHEMA_VERSION = 2;
export const CURRENT_NORMALIZER_VERSION = "f6-v3";

const PRIMARY_SYMBOL_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["CheckSmmuFault/0x26", /CheckSmmuFault|retCode=0x26|SMMU|DDR address out of range/i],
  ["EI0002/NotifyWaitTimeout", /EI0002|Notify wait|HCCL_EXEC_TIMEOUT/i],
  [
    "EI0006/EJ0001/HCCL-Link",
    /EI0006|EJ000\d|EI000[1345789]|Getting socket times out|LinkEstablish|RaSocket|HCCL_IF_IP|ranktable|RoCE|RDMA/i,
  ],
  ["ZMQ/TCPStore/Port", /ZMQError|Address already in use|TCPStore|Gloo|ECONNREFUSED/i],
  ["507015/AICore-Sync", /\b507015\b|aicore exception|AclrtSynchronizeStreamWithTimeout/i],
  ["507034/507035/AIV-Timeout", /\b(?:507034|507035|507018)\b|aiv exception/i],
  ["161002/aclnn-Param", /\b(?:161002|161001|561000)\b|GetWorkspaceSize/i],
  ["libopapi/EL0004/Symbol", /libopapi\.so|EL0004|undefined symbol|libascendcl\.so/i],
  ["EZ9999/EZ1001/InnerErr", /\b(?:EZ9999|EZ1001|EZ300\d)\b/i],
  ["107030/207003/Runtime", /\b(?:107030|107002|207003|507008|500001|500002)\b|ACL_ERROR_/i],
  ["ACLGraph/TorchAir-Capture", /capture_model|FULL_DECODE_ONLY|PIECEWISE|aclgraph|torchair|npugraph_ex/i],
  ["MC2/MoeDistribute", /\bmc2\b|MoeDistribute|DispatchFFNCombine|FusedMoE|fused_moe|alltoallv/i],
  ["GroupedMatmul/Quant", /GroupedMatmul|w8a8|w4a8|modelslim|quant|mxfp4|mxfp8|per_token/i],
  [
    "FlashAttn/MlaProlog",
    /MlaProlog|FlashAttentionScore|FusedInferAttentionScore|PagedAttention|ChunkGatedDeltaRule/i,
  ],
  [
    "Mooncake/PD-KVTransfer",
    /mooncake|kv_transfer_config|kv_connector|1p1d|disagg|llm_datadist|transfer_engine/i,
  ],
  [
    "NPU-OOM/207001",
    /NPU out of memory|OutOfMemoryError|\b(?:207001|507011)\b|exit code 137|NPUCachingAllocator/i,
  ],
];

function inferPrimarySymbol(item: DistilledIssueItem): string {
  const dist =
    item.distilled && typeof item.distilled === "object" && !Array.isArray(item.distilled)
      ? item.distilled
      : {};
  const codes = coerceStringList(dist.error_codes);
  const searchBlob = [
    codes.join(" "),
    typeof item.verbatim_root_line === "string" ? item.verbatim_root_line : "",
    typeof item.title === "string" ? item.title : "",
    typeof dist.root_cause_zh === "string" ? dist.root_cause_zh : "",
    typeof dist.pr_fix_mechanism_zh === "string" ? dist.pr_fix_mechanism_zh : "",
  ].join("\n");
  for (const [symName, pat] of PRIMARY_SYMBOL_PATTERNS) {
    if (pat.test(searchBlob)) return symName;
  }
  if (codes.length > 0) return codes[0]!.toUpperCase();
  const aclnnM = /\b(aclnn[A-Z][A-Za-z0-9_]{3,32})\b/.exec(searchBlob);
  if (aclnnM) return aclnnM[1]!;
  const excM =
    /\b(RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|OSError|ImportError|TimeoutError|OutOfMemoryError|ZMQError|Segmentation fault)\b/.exec(
      searchBlob,
    );
  if (excM) return excM[1]!;
  return "general";
}

const MAINTAINER_CLOSURE_RE =
  /^\[[^\]]+\]:[ \t]*(?:已通过|感谢反馈|关联[ \t]*(?:PR|MR)|已合入|已修复|您好|收到|经确认|确认是|(?:PR|MR)[ \t]*[#!][0-9]+)|(?:已通过[ \t]*(?:PR|MR)[ \t]*[#!][0-9]+|通过代码走查发现|尚未在.*设备上复现|请提供该场景的最小复现|请补充.{0,20}复现|建议补充.{0,20}复现)/;
const RUNTIME_LOG_MARKER_RE =
  /\[ERROR\]|Traceback \(most recent call last\)|RuntimeError:|ValueError:|AssertionError:|TypeError:|KeyError:|ImportError:|NPU function error:|HCCL function error:|retCode=0x|error code is [0-9]+|failed with error|AclNN_(?:Parameter|Inner|Check|Op|Graph|Runtime)|free\(\): invalid pointer/i;
const CJK_CHAR_RE = /[\u4e00-\u9fff]/g;
const TRAILING_COMMENT_SPLIT_RE = /[ \t]+(?:#[ \t]+|←[ \t]*|<-[ \t]*|\/\/[ \t]*)/;
const HYPOTHETICAL_PROSE_RE =
  /(?:若.{0,30}(?:会触发|将触发|会引发|将引发|会导致|将导致)|当.{0,35}时.{0,25}(?:会|将).{0,25}(?:触发|引发|导致|解引用)|引发段错误|触发[ \t]*`?SIGSEGV`?|形成对.{0,25}拒绝服务|返回码应为|超过系统上限时.{0,20}返回|时(?:，|,)?[ \t]*(?:应|直接)?返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_|EZ[0-9]{4}|1610[0-9]{2})|应返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_|EZ[0-9]{4}|1610[0-9]{2})|若不一致.{0,10}返回|该参数在算子原型中|预期应与实现一致|中文[ \t]*API[ \t]*错误码参考|头文件定义的|按内存不足排障)/;
const PROSE_NOT_LOG_RE =
  /(?:本[ \t]*Issue[ \t]*汇总|汇总合并|整改前|整改范围|换正式错误码|补负向[ \t]*UT|批量整改|批量合并|文档声明|用例汇总|按公开文档|而非文档承诺|开展审计与整改|审计与整改|静态命中[ \t]*[0-9]+[ \t]*条|替换为正式语义码|重复首报去重|复扫[ \t]*EZ9999|一次故障.{0,12}(?:两个首错|只产生一条首错)|淹没根因码|再次[ \t]*(?:执行[ \t]*)?`?OP_LOGE`?|外层包装(?:处)?.{0,20}(?:`?OP_LOGE`?|补报|不再二次上报)|按检查语义逐处替换|符合仓内错误码规范|中英文(?:接口)?文档|资料[ \t]*[0-9]{6}[ \t]*行的|可考虑在|固定源码|源码证据|快车道轻检|去重反向对照实验|实测摘要|用[ \t]*mock[ \t]*模板|使用测试模板|在[ \t]*ST[ \t]*stub[ \t]*或[ \t]*UT[ \t]*中|观察缺陷组|原包.{0,20}均返回|^[0-9]+\.[ \t]+.{0,80}返回错误码|^(?:[-*+]|[0-9]+\.)[ \t]+`?[A-Za-z0-9_./-]+\.(?:cc|cpp|c|h|hpp|py)(?::[0-9]+)?`?[ \t]+.{0,120}(?:仍返回|定义|返回[ \t]*`?(?:HCCL_E_|ACL_ERROR_|ACLNN_))|^[ \t]*#[ \t]*(?:修复前|修复后|修改前|修改后|期望结果|预期结果|实际结果|复现步骤|注释|说明)[:：]|^[ \t]*[-*+][ \t]+\[`[^`]+\]`[ \t]*(?:级联|cascade|报错)?[:：]|`[^`]+`[ \t]*→[ \t]*`[^`]+`|^[ \t]*self\.[A-Za-z_][A-Za-z0-9_.]*[ \t]*\(|\b(?:REPORT_INNER_ERR_MSG|OP_LOGE|HCCL_ERROR)[ \t]*\(|^[ \t]*return[ \t]+(?:HCCL_E_|ACL_ERROR_|ACLNN_)|\b(?:negative control|without this patch)\b|\b(?:crashes with|fails with|fails during)\b|^On startup,[ \t]+|^[0-9]+\.[ \t]+编译运行|\b(?:raised|returned|failed with)[ \t]+`(?:E[EZIJLMW][0-9]{4}|[1-9][0-9]{5}|[A-Z][A-Z0-9_]{3,})`|`?OP_LOGE`?[ \t]*裸宏|裸[ \t]*`?OP_LOGE`?|无结构化错误信息|报错口径不一致|按预定义错误码解析|头文件定义|校验失败路径统一使用|错误码全部落为|隐式向[ \t]*ErrorManager[ \t]*上报)/;
const CPP_LOG_MACRO_CALL_RE =
  /\b(?:REPORT_INNER_ERR_MSG|OP_LOG[EWDIF](?:_[A-Z0-9_]+)?|OPS_LOG_[EWDIF]|HCCL_(?:ERROR|WARNING|INFO|DEBUG|EVENT)|ACL_LOG_(?:ERROR|WARN|INFO|EVENT)|ASCEND_LOG[EWDIF]|GELOG[EWDIF]|CHK_PRT_RET)[ \t]*\(|^[ \t]*return[ \t]+(?:HCCL_E_|ACL_ERROR_|ACLNN_)|^[ \t]*"[^"]*"[ \t]*\)[ \t]*;?[ \t]*$/;
const PY_LOG_CALL_LINE_RE =
  /\b(?:warnings\.warn|logger\.(?:error|warning|warn|info|debug|exception|critical|fatal)|logging\.(?:error|warning|warn|info|debug|exception|critical|fatal))[ \t]*\(/;
const PY_LOG_ARG_CONT_RE =
  /^[ \t]*(?:[fFrRuUbB]{0,2}["']|[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*[fFrRuUbB]{0,2}["']|\)[ \t]*$)/;
const NARRATIVE_PROSE_OVERRIDE_RE =
  /\b(?:crashes with|fails with|fails during)[ \t]+`?[A-Za-z0-9_.[]|\b(?:raised|returned)[ \t]+`[A-Za-z0-9_]|\b(?:was|is)[ \t]+a[ \t]+`?(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|IndexError|OSError|ImportError):|^[ \t]*-[ \t]+Error:[ \t]+.*plog reports\b/i;
const STRICT_LOG_LINE_START_RE =
  /^(?:\[(?:ERROR|WARN(?:ING)?|FATAL|CRITICAL|PID:|rank[0-9]+|HYBM)\b|(?:ERROR|FATAL|CRITICAL)[ \t]+[0-9]|Traceback \(most recent call last\):|(?:RuntimeError|ValueError|AssertionError|TypeError|KeyError|ImportError|AttributeError|IndexError|OSError|MemoryError|NotImplementedError|TimeoutError|ZMQError|OutOfMemoryError|DistBackendError|ProcessRaisedException):|AclNN_(?:Parameter|Inner|Check|Op|Graph|Runtime)|NPU out of memory|NPU function error:|HCCL function error:|E[EZIJLMW][0-9]{4}\b|E[1-9][0-9]{4}\b|Segmentation fault|free\(\): invalid pointer)/i;
const FALLBACK_CODE_STMT_RE =
  /^(?:\/\/|return[ \t]+|if[ \t]*\(|for[ \t]*\(|while[ \t]*\(|case[ \t]+|#include\b|int[ \t]+|void[ \t]+|bool[ \t]+|const[ \t]+|print[ \t]*\(|printf[ \t]*\(|[A-Z_][A-Z0-9_]*[ \t]*=[ \t]*["']|r[ \t]*=[ \t]*aclnn|`?HCCL_SUCCESS[ \t]*=|[A-Za-z_][A-Za-z0-9_]*[ \t]*==[ \t]*[0-9]+[ \t]*\?|(?:The[ \t]+(?:job|failure)[ \t]+|This |In the |When |After |During |Before |Note:|However,|Although |Because |While |Here |For )[a-z])|\b(?:CHK_PRT_RET|HCOM_ERROR_CODE|ctypes\.CDLL)[ \t]*\(|\),[ \t]*(?:HCCL_E_|ACL_ERROR_|ACLNN_)[A-Z0-9_]+[ \t]*\)[ \t]*;?$|\b(?:there[ \t]+(?:is|was|were|are)[ \t]+no|ruled[ \t]+out)\b/;

function cppMacroOpenParenStep(text: string, inBlockComment: boolean): [number, boolean] {
  let depth = 0;
  let inQuote = "";
  let inBc = inBlockComment;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i]!;
    if (inBc) {
      if (ch === "*" && i + 1 < n && text[i + 1] === "/") {
        inBc = false;
        i += 1;
      }
      continue;
    }
    if (inQuote) {
      if (ch === "\\" && i + 1 < n) {
        i += 1;
        continue;
      }
      if (ch === inQuote) inQuote = "";
      continue;
    }
    if (ch === "/" && i + 1 < n) {
      const nxt = text[i + 1];
      if (nxt === "/") break;
      if (nxt === "*") {
        inBc = true;
        i += 1;
        continue;
      }
    }
    if (ch === '"') {
      inQuote = '"';
    } else if (ch === "'") {
      const isDigitSep =
        i > 0 && i + 1 < n && /[0-9A-Za-z]/.test(text[i - 1]!) && /[0-9A-Za-z]/.test(text[i + 1]!);
      if (!isDigitSep) inQuote = "'";
    } else if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
    }
  }
  return [depth, inBc];
}

function isInsideCppLogMacroCall(lines: readonly string[], idx: number): boolean {
  if (CPP_LOG_MACRO_CALL_RE.test(lines[idx] ?? "")) return true;
  const start = Math.max(0, idx - 64);
  for (let p = idx - 1; p >= start; p--) {
    const prevLine = lines[p] ?? "";
    if (prevLine.trimStart().startsWith("```")) break;
    if (/^[ \t]*(?:\/\/|#)/.test(prevLine)) continue;
    const m = CPP_LOG_MACRO_CALL_RE.exec(prevLine);
    if (m !== null && prevLine.slice(m.index).includes("(")) {
      if (prevLine.slice(0, m.index).includes("//")) continue;
      const parenPos = prevLine.indexOf("(", m.index);
      if (parenPos >= 0) {
        let [depth, inBc] = cppMacroOpenParenStep(prevLine.slice(parenPos), false);
        for (let q = p + 1; q < idx; q++) {
          if ((lines[q] ?? "").trimStart().startsWith("```")) {
            depth = 0;
            break;
          }
          if (depth <= 0 && !inBc) break;
          const [delta, nextBc] = cppMacroOpenParenStep(lines[q] ?? "", inBc);
          depth += delta;
          inBc = nextBc;
        }
        if (depth > 0) return true;
      }
    }
  }
  return false;
}

function isInsidePyLogCallArg(lines: readonly string[], idx: number): boolean {
  const cur = lines[idx] ?? "";
  if (PY_LOG_CALL_LINE_RE.test(cur)) return true;
  if (!PY_LOG_ARG_CONT_RE.test(cur)) return false;
  const start = Math.max(0, idx - 8);
  for (let p = idx - 1; p >= start; p--) {
    const prev = lines[p] ?? "";
    const s = prev.trim();
    if (!s || s.startsWith("```")) break;
    if (
      /(?:UserWarning|DeprecationWarning|FutureWarning|ImportWarning):|^[ \t]*(?:\[ERROR\]|Traceback \(most recent call last\):|\(EngineCore|\[rank[0-9]+\]:)/.test(
        s,
      )
    ) {
      break;
    }
    const m = PY_LOG_CALL_LINE_RE.exec(prev);
    if (m !== null && prev.slice(m.index).includes("(") && !prev.slice(0, m.index).includes("#")) {
      let depth = 0;
      for (let q = p; q < idx; q++) {
        const lineStr = lines[q] ?? "";
        const seg = q === p ? lineStr.slice(m.index) : lineStr;
        let inQ = "";
        for (let k = 0; k < seg.length; k++) {
          const ch = seg[k]!;
          if (inQ) {
            if (ch === "\\" && k + 1 < seg.length) {
              k += 1;
              continue;
            }
            if (ch === inQ) inQ = "";
          } else if (ch === "#") {
            break;
          } else if (ch === '"' || ch === "'") {
            inQ = ch;
          } else if (ch === "(") {
            depth += 1;
          } else if (ch === ")") {
            depth -= 1;
          }
        }
        if (depth <= 0) break;
      }
      if (depth > 0) return true;
    }
  }
  return false;
}

export function isProseSummaryNotRuntimeLog(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Maintainer closure comments / C++ logging macro source lines / repro requests are NEVER runtime logs,
  // even when they quote a symbolic macro or exception string literal.
  if (MAINTAINER_CLOSURE_RE.test(trimmed)) return true;
  if (CPP_LOG_MACRO_CALL_RE.test(trimmed) || PY_LOG_CALL_LINE_RE.test(trimmed)) return true;
  const isStrictLog = STRICT_LOG_LINE_START_RE.test(trimmed);
  if (!isStrictLog && NARRATIVE_PROSE_OVERRIDE_RE.test(trimmed)) return true;
  const rtMatch = RUNTIME_LOG_MARKER_RE.exec(trimmed);
  if (rtMatch !== null) {
    const cjkBefore = (trimmed.slice(0, rtMatch.index).match(CJK_CHAR_RE) ?? []).length;
    if (cjkBefore < 16) return false;
  }
  if (/^\|.*\|$/.test(trimmed)) return true;
  // Hypothetical / static-analysis / doc-spec prose
  if (HYPOTHETICAL_PROSE_RE.test(trimmed)) return true;
  if (!isStrictLog && PROSE_NOT_LOG_RE.test(trimmed)) return true;
  const mainPart = trimmed.split(TRAILING_COMMENT_SPLIT_RE)[0] ?? "";
  return (mainPart.match(CJK_CHAR_RE) ?? []).length >= 14;
}

const FORENSIC_CHAIN_STAGE_RE =
  /\[1\.[^\]]+\]\s*\S[\s\S]{3,}?\[2\.[^\]]+\]\s*\S[\s\S]{3,}?\[3\.[^\]]+\]\s*\S[\s\S]{3,}/u;

export function isValidForensicChain(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const s = val.replace(/\s+/g, " ").trim();
  return Array.from(s).length >= 40 && FORENSIC_CHAIN_STAGE_RE.test(s);
}

const MARKDOWN_PR_URL_RE =
  /https?:\/\/(?:www\.)?(?:github|gitcode)\.com\/[^/ \t\r\n]+\/[^/ \t\r\n]+\/(?:pull|merge_requests|issues|actions\/runs)\/[0-9]+/i;

const MD_LINK_SEP_CHARS = new Set([" ", "\t", ",", ";", "|", "/", "·", "-", "—", "–", "•"]);

export function isMarkdownPrOrLinkListLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (MARKDOWN_PR_URL_RE.test(trimmed)) return true;
  const s = trimmed.replace(/^(?:[-*+]|[0-9]+\.)[ \t]+/, "");
  const n = s.length;
  let i = 0;
  let linkCount = 0;
  while (i < n) {
    while (i < n && MD_LINK_SEP_CHARS.has(s[i]!)) i += 1;
    if (i >= n) break;
    if (s[i] !== "[") return false;
    let brDepth = 1;
    let k = i + 1;
    while (k < n && brDepth > 0) {
      if (s[k] === "\\" && k + 1 < n) {
        k += 2;
        continue;
      }
      if (s[k] === "`") {
        const btStart = k;
        while (k < n && s[k] === "`") k += 1;
        const btLen = k - btStart;
        let m = k;
        let foundClose = -1;
        while (m < n) {
          if (s[m] === "`") {
            const runS = m;
            while (m < n && s[m] === "`") m += 1;
            if (m - runS === btLen) {
              foundClose = m;
              break;
            }
          } else {
            m += 1;
          }
        }
        if (foundClose >= 0) k = foundClose;
        continue;
      }
      if (s[k] === "[") brDepth += 1;
      else if (s[k] === "]") brDepth -= 1;
      k += 1;
    }
    const closeBr = k - 1;
    if (brDepth !== 0 || closeBr < i + 1 || closeBr + 1 >= n) return false;
    const nxt = s[closeBr + 1];
    if (nxt === "(") {
      let depth = 1;
      let inQuote = "";
      let inAngle = false;
      let j = closeBr + 2;
      while (j < n && depth > 0) {
        const ch = s[j];
        if (ch === "\\" && j + 1 < n) {
          j += 2;
          continue;
        }
        if (inQuote) {
          if (ch === inQuote) inQuote = "";
        } else if (inAngle) {
          if (ch === ">") inAngle = false;
        } else {
          const atWsBoundary = j === closeBr + 2 || s[j - 1] === " " || s[j - 1] === "\t";
          if ((ch === '"' || ch === "'") && atWsBoundary) inQuote = ch;
          else if (ch === "<" && atWsBoundary) inAngle = true;
          else if (ch === "(") depth += 1;
          else if (ch === ")") depth -= 1;
        }
        j += 1;
      }
      if (depth !== 0 || inQuote !== "" || inAngle) return false;
      linkCount += 1;
      i = j;
    } else if (nxt === "[") {
      const closeRef = s.indexOf("]", closeBr + 2);
      if (closeRef < 0) return false;
      linkCount += 1;
      i = closeRef + 1;
    } else {
      return false;
    }
  }
  return linkCount >= 1;
}

const FALLBACK_LOG_LINE_PATTERNS: ReadonlyArray<[number, RegExp]> = [
  [
    10,
    /(?:\[ERROR\][ \t]*(?:RUNTIME|HCCL|ASCENDCL|OPAPI|GE|FE|AICPU|TSD|DRV|KERNEL|ATB|TORCHAIR)|CheckSmmuFault|aicore exception|aiv exception|Notify wait execute timeout|NPU function error:|c10_npu::acl::|retCode=0x[0-9a-fA-F]+)/i,
  ],
  [
    8,
    /(?:\b(?:5070[0-9]{2}|1070[0-9]{2}|1610[0-9]{2}|2070[0-9]{2}|5000[0-9]{2}|5610[0-9]{2}|E[EZIJLMW][0-9]{4}|E[1-9][0-9]{4}|ACL_ERROR_[A-Z0-9_]+|HCCL_E_[A-Z0-9_]+)\b|NPU out of memory|libopapi\.so|aclnn[A-Z][A-Za-z0-9_]+.*(?:fail|error|invalid|status|161002))/i,
  ],
  [
    6,
    /(?:(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|IndexError|OSError|ImportError|MemoryError|NotImplementedError|TimeoutError|ZMQError|OutOfMemoryError|DistBackendError|ProcessRaisedException)[ \t]*:|Segmentation fault|SIGSEGV|SIGABRT|Address already in use|core dumped|errCode[ \t]*[=:][ \t]*[0-9]+|error code is [0-9]+)/i,
  ],
  [
    4,
    /(?:Traceback \(most recent call last\):|ERROR[ \t]+[0-9]{2}-[0-9]{2}[ \t]+[0-9]{2}:[0-9]{2}:[0-9]{2}|failed with error|call aclnn|Exception:)/i,
  ],
];

function containsWholeErrorCode(code: string, textUpper: string): boolean {
  const up = code.trim().toUpperCase();
  if (!up) return false;
  const esc = up.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pre = /^[A-Z0-9_]/.test(up) ? "(?<![A-Z0-9_])" : "";
  const suf = /[A-Z0-9_]$/.test(up) ? "(?![A-Z0-9_])" : "";
  return new RegExp(`${pre}${esc}${suf}`).test(textUpper);
}

export function extractFallbackVerbatimRootLine(
  title: string,
  body: string,
  commentsText: string,
  hintCodes: readonly string[],
): string {
  let bestLine = "";
  let bestScore = -1;
  const hintUpper = [
    ...new Set(
      hintCodes
        .map((c) =>
          String(c ?? "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
  for (const fieldText of [body, commentsText]) {
    const lines = fieldText.split(LINE_BREAK_SPLIT_RE);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const rawLn = lines[lineIdx]!;
      const ln = rawLn.trim();
      const lnCpLen = codePointLen(ln);
      if (lnCpLen < 18 || lnCpLen > 480) continue;
      if (
        ln.startsWith("```") ||
        ln.startsWith("#") ||
        ln.startsWith("| ") ||
        ln.startsWith("---") ||
        ln.startsWith("===") ||
        ln.startsWith("http://") ||
        ln.startsWith("https://") ||
        ln.startsWith(">") ||
        ln.startsWith("- ") ||
        ln.startsWith("* ") ||
        ln.startsWith("+ ")
      ) {
        continue;
      }
      if (/^[0-9]+\.[ \t]+/.test(ln)) continue;
      if (FALLBACK_CODE_STMT_RE.test(ln)) continue;
      if (isInsidePyLogCallArg(lines, lineIdx) || isInsideCppLogMacroCall(lines, lineIdx)) continue;
      if (isMarkdownPrOrLinkListLine(ln)) continue;
      if (isProseSummaryNotRuntimeLog(ln)) continue;
      const mainPart = ln.split(TRAILING_COMMENT_SPLIT_RE)[0] ?? "";
      if ((mainPart.match(CJK_CHAR_RE) ?? []).length >= 4 && !STRICT_LOG_LINE_START_RE.test(ln)) continue;
      if (isTitleLeak(ln, title)) continue;
      if (!isSingleLineInField(ln, body, commentsText)) continue;
      let score = 0;
      for (const [weight, pat] of FALLBACK_LOG_LINE_PATTERNS) {
        if (pat.test(ln)) score = Math.max(score, weight);
      }
      if (score === 0) continue;
      const lnUp = ln.toUpperCase();
      for (const code of hintUpper) {
        if (containsWholeErrorCode(code, lnUp)) {
          score += 2;
          break;
        }
      }
      if (ln.includes("[ERROR]") || ln.includes("RuntimeError:") || ln.includes("NPU function error:")) {
        score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLine = ln;
      }
    }
  }
  return bestLine;
}

export interface RawCorpusSnapshot {
  map: Map<string, RawCorpusItem>;
  sha256: string;
  bytes: number;
}

const VERIFIED_RAW_SNAPSHOTS = new WeakMap<
  object,
  { path: string; sha256: string; bytes: number; mapDigest: string }
>();

function computeRawMapDigest(map: ReadonlyMap<string, RawCorpusItem>): string {
  const hash = createHash("sha256");
  const keys = [...map.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const k of keys) {
    hash
      .update(k, "utf8")
      .update("\0")
      .update(canonicalJsonStringify(map.get(k)), "utf8")
      .update("\x1e");
  }
  return hash.digest("hex");
}

export function loadRawCorpusSnapshot(rawPath: string): RawCorpusSnapshot {
  const map = new Map<string, RawCorpusItem>();
  if (!existsSync(rawPath)) {
    return { map, sha256: "", bytes: 0 };
  }
  const rawBuf = readFileSync(rawPath);
  const sha256 = createHash("sha256").update(rawBuf).digest("hex").toLowerCase();
  const lines = rawBuf.toString("utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.replace(/\r$/, "").trim();
    if (!trimmed) continue;
    const rec = JSON.parse(trimmed) as RawCorpusItem;
    if (!rec.key) {
      throw new Error(`Raw corpus record missing key at ${rawPath}:${i + 1}`);
    }
    const existing = map.get(rec.key);
    if (existing) {
      if (canonicalJsonStringify(existing) !== canonicalJsonStringify(rec)) {
        throw new Error(`Conflicting duplicate raw corpus key "${rec.key}" at ${rawPath}:${i + 1}`);
      }
      continue;
    }
    map.set(rec.key, rec);
  }
  const snap: RawCorpusSnapshot = { map, sha256, bytes: rawBuf.length };
  VERIFIED_RAW_SNAPSHOTS.set(snap, {
    path: canonicalPathForAlias(rawPath),
    sha256,
    bytes: rawBuf.length,
    mapDigest: computeRawMapDigest(map),
  });
  return snap;
}

export function loadRawCorpusMap(rawPath: string): Map<string, RawCorpusItem> {
  return loadRawCorpusSnapshot(rawPath).map;
}

interface ParsedRef {
  ecosystem: Ecosystem;
  repo: string;
  number: number;
  canonicalRef: string;
  explicitRepo: boolean;
}

const SHORTHAND_REPOS: Record<string, { ecosystem: Ecosystem; repo: string }> = {
  vllm: { ecosystem: "github", repo: "vllm-project/vllm" },
  "vllm-ascend": { ecosystem: "github", repo: "vllm-project/vllm-ascend" },
};

const MENTION_ONLY_LINK_SOURCES = new Set(["local_git_pr_ref", "gitcode_text_ref_pr", "github_api"]);

function coerceCitationList(raw: unknown): unknown[] {
  if (raw === null || raw === undefined || typeof raw === "boolean") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" || typeof raw === "number") return [raw];
  if (typeof raw === "object" && Object.keys(raw).length > 0) return [raw];
  return [];
}

function coerceStringList(raw: unknown): string[] {
  if (raw === null || raw === undefined || typeof raw === "boolean") return [];
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" || typeof raw === "number" ? [raw] : [];
  const out: string[] = [];
  for (const entry of arr) {
    if (typeof entry !== "string" && typeof entry !== "number") continue;
    const s = String(entry).trim();
    if (s) out.push(s);
  }
  return out;
}

function formatCanonicalRef(
  eco: Ecosystem,
  repo: string,
  number: number,
  defaultEcosystem: Ecosystem,
): string {
  if (eco === "gitcode") return `gitcode:${repo}!${number}`;
  const owner = repo.split("/")[0]?.toLowerCase() ?? "";
  if (defaultEcosystem === "gitcode" || owner === "ascend" || owner === "cann") {
    return `github:${repo}#${number}`;
  }
  return `${repo}#${number}`;
}

function parseUrlIdentity(urlStr: string): { ecosystem: Ecosystem; repo: string; number: number } | null {
  const s = urlStr.trim();
  if (!s || /\s/.test(s)) return null;
  if (/https?:\/\//i.test(s.slice(8))) return null;
  const eco = extractUrlHostEcosystem(s);
  if (!eco) return null;
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return null;
  }
  const pathname = parsed.pathname;
  if (eco === "github") {
    const m = /^\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)(?:\/(?:files|commits|checks)?)?\/?$/i.exec(
      pathname,
    );
    if (!m) return null;
    const number = Number.parseInt(m[2]!, 10);
    return number > 0 ? { ecosystem: "github", repo: m[1]!, number } : null;
  }
  const m =
    /^\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(?:pull|merge_requests)\/(\d+)(?:\/(?:diffs|commits)?)?\/?$/i.exec(
      pathname,
    );
  if (!m) return null;
  const number = Number.parseInt(m[2]!, 10);
  return number > 0 ? { ecosystem: "gitcode", repo: m[1]!, number } : null;
}

function parseSinglePrOrMrRef(
  entry: unknown,
  defaultEcosystem: Ecosystem,
  defaultRepo: string,
  explicitUrl?: string,
): ParsedRef | null {
  if (typeof entry !== "number" && typeof entry !== "string") return null;

  const explicitUrlClean = (explicitUrl ?? "").trim();
  const urlId = explicitUrlClean ? parseUrlIdentity(explicitUrlClean) : null;
  if (explicitUrlClean && !urlId) return null;
  const urlEco: Ecosystem | null = urlId?.ecosystem ?? null;

  const validateAndPack = (
    eco: Ecosystem,
    repo: string,
    number: number,
    explicitRepo: boolean,
  ): ParsedRef | null => {
    if (!Number.isInteger(number) || number <= 0) return null;
    let finalEco = eco;
    let finalRepo = repo;
    let finalExplicit = explicitRepo;
    if (urlId) {
      if (!explicitRepo) {
        if (number !== urlId.number) return null;
        finalEco = urlId.ecosystem;
        finalRepo = urlId.repo;
        finalExplicit = true;
      } else if (
        eco !== urlId.ecosystem ||
        repo.toLowerCase() !== urlId.repo.toLowerCase() ||
        number !== urlId.number
      ) {
        return null;
      }
    }
    return {
      ecosystem: finalEco,
      repo: finalRepo,
      number,
      canonicalRef: formatCanonicalRef(finalEco, finalRepo, number, defaultEcosystem),
      explicitRepo: finalExplicit,
    };
  };

  if (typeof entry === "number") {
    const eco = urlEco ?? defaultEcosystem;
    return validateAndPack(eco, defaultRepo, entry, false);
  }

  const trimmed = entry.trim();
  if (!trimmed) return null;

  const directUrl = parseUrlIdentity(trimmed);
  if (directUrl) {
    return validateAndPack(directUrl.ecosystem, directUrl.repo, directUrl.number, true);
  }

  const ghPrefixed = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/i.exec(trimmed);
  if (ghPrefixed) {
    return validateAndPack("github", ghPrefixed[1]!, Number.parseInt(ghPrefixed[2]!, 10), true);
  }

  const gcPrefixed = /^gitcode:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)[!#](\d+)$/i.exec(trimmed);
  if (gcPrefixed) {
    return validateAndPack("gitcode", gcPrefixed[1]!, Number.parseInt(gcPrefixed[2]!, 10), true);
  }

  const mrBang = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)!(\d+)$/.exec(trimmed);
  if (mrBang) {
    if (urlEco === "github") return null;
    return validateAndPack("gitcode", mrBang[1]!, Number.parseInt(mrBang[2]!, 10), true);
  }

  const ghHash = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/.exec(trimmed);
  if (ghHash) {
    const repo = ghHash[1]!;
    const number = Number.parseInt(ghHash[2]!, 10);
    let eco: Ecosystem;
    if (urlEco) {
      eco = urlEco;
    } else if (repo.toLowerCase() === defaultRepo.toLowerCase()) {
      eco = defaultEcosystem;
    } else {
      const owner = repo.split("/")[0]?.toLowerCase() ?? "";
      eco = owner === "cann" || owner === "ascend" ? "gitcode" : "github";
    }
    return validateAndPack(eco, repo, number, true);
  }

  const shortRef = /^([A-Za-z0-9_.-]+)([#!])(\d+)$/.exec(trimmed);
  if (shortRef) {
    const alias = shortRef[1]!.toLowerCase();
    const target = Object.hasOwn(SHORTHAND_REPOS, alias) ? SHORTHAND_REPOS[alias] : undefined;
    if (target) {
      if (shortRef[2] === "!" && target.ecosystem === "github") return null;
      return validateAndPack(target.ecosystem, target.repo, Number.parseInt(shortRef[3]!, 10), true);
    }
  }

  const bareNum = /^([#!]?)(\d+)$/.exec(trimmed);
  if (bareNum) {
    const delim = bareNum[1]!;
    const number = Number.parseInt(bareNum[2]!, 10);
    const eco = urlEco ?? defaultEcosystem;
    // Never fabricate a GitHub same-repo PR ref from GitCode/GitLab MR `!N` syntax
    if (delim === "!" && eco !== "gitcode") return null;
    return validateAndPack(eco, defaultRepo, number, false);
  }

  return null;
}

export function isDocsOnlyPrOrMrTitle(title?: string): boolean {
  const t = (title ?? "").trim();
  if (!t) return false;
  if (/^(?:\[[^\]]+\]\s*)*docs?(?:\([^)]*\))?\s*[:：]/i.test(t)) return true;
  if (
    /^(?:\[[^\]]+\]\s*)*\[docs?(?:umentation)?\]/i.test(t) &&
    !/\[(?:bugfix|fix|feat|perf|core)\]/i.test(t)
  ) {
    return true;
  }
  if (/^(?:文档|更新资料|补充.*文档|修正.*文档|新增.*文档|错误码参考|接口文档|参数文档)/.test(t)) {
    return true;
  }
  if (/\b(?:api\s+support\s+(?:status|documentation)|update\s+docs?)\b/i.test(t)) return true;
  return false;
}

function unquoteGitPath(raw: string): string {
  let s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    const inner = s.slice(1, -1);
    const bytes: number[] = [];
    const escMap: Record<string, number> = {
      a: 7,
      b: 8,
      f: 12,
      n: 10,
      r: 13,
      t: 9,
      v: 11,
      "\\": 92,
      '"': 34,
    };
    let i = 0;
    while (i < inner.length) {
      const ch = inner[i]!;
      if (ch === "\\" && i + 1 < inner.length) {
        const nxt = inner[i + 1]!;
        if (nxt >= "0" && nxt <= "7") {
          let j = i + 1;
          while (j < Math.min(inner.length, i + 4) && inner[j]! >= "0" && inner[j]! <= "7") j += 1;
          bytes.push(Number.parseInt(inner.slice(i + 1, j), 8) & 0xff);
          i = j;
          continue;
        }
        if (Object.hasOwn(escMap, nxt)) {
          bytes.push(escMap[nxt]!);
          i += 2;
          continue;
        }
        for (const b of Buffer.from(nxt, "utf8")) bytes.push(b);
        i += 2;
        continue;
      }
      for (const b of Buffer.from(ch, "utf8")) bytes.push(b);
      i += 1;
    }
    s = Buffer.from(bytes).toString("utf8");
  }
  if (s.startsWith("a/") || s.startsWith("b/")) s = s.slice(2);
  return s.trim();
}

function extractGitDiffHeaderPaths(line: string, allowHeader: boolean): string[] {
  const mqq = /^diff --git ("(?:\\.|[^"\\])*") ("(?:\\.|[^"\\])*")$/.exec(line);
  if (mqq) return [unquoteGitPath(mqq[1]!), unquoteGitPath(mqq[2]!)];
  const mqu = /^diff --git ("(?:\\.|[^"\\])*") b\/(.+)$/.exec(line);
  if (mqu) return [unquoteGitPath(mqu[1]!), mqu[2]!.trim()];
  const muq = /^diff --git a\/(.+?) ("(?:\\.|[^"\\])*")$/.exec(line);
  if (muq) return [muq[1]!.trim(), unquoteGitPath(muq[2]!)];
  const muu = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
  if (muu) return [muu[1]!.trim(), muu[2]!.trim()];
  if (allowHeader) {
    const mpq = /^(?:\+\+\+|---) ("(?:\\.|[^"\\])*")(?:\t.*|\s+\d{4}-\d{2}-\d{2}\s+.*)?$/.exec(line);
    if (mpq) return [unquoteGitPath(mpq[1]!)];
    const mpu = /^(?:\+\+\+|---) (?:[ab]\/)?([^\t\r\n]+?)(?:\t.*|\s+\d{4}-\d{2}-\d{2}\s+.*)?$/.exec(line);
    if (mpu) return [mpu[1]!.trim()];
  }
  return [];
}

export function isDocsOnlyDiffSnippet(snippet?: string): boolean {
  const s = (snippet ?? "").trim();
  if (!s) return false;
  const paths: string[] = [];
  let oldRem = 0;
  let newRem = 0;
  const hunkRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  for (const line of s.split(LINE_BREAK_SPLIT_RE)) {
    if (line.startsWith("diff --git ")) {
      oldRem = 0;
      newRem = 0;
      paths.push(...extractGitDiffHeaderPaths(line, true));
      continue;
    }
    const hm = hunkRe.exec(line);
    if (hm) {
      oldRem = hm[2] !== undefined ? Number.parseInt(hm[2], 10) : 1;
      newRem = hm[4] !== undefined ? Number.parseInt(hm[4], 10) : 1;
      continue;
    }
    if (oldRem > 0 || newRem > 0) {
      if (line.startsWith("\\ No newline")) continue;
      if (line.startsWith("-")) {
        oldRem = Math.max(0, oldRem - 1);
        continue;
      }
      if (line.startsWith("+")) {
        newRem = Math.max(0, newRem - 1);
        continue;
      }
      if (line.startsWith(" ") || line === "") {
        oldRem = Math.max(0, oldRem - 1);
        newRem = Math.max(0, newRem - 1);
        continue;
      }
      oldRem = 0;
      newRem = 0;
    }
    paths.push(...extractGitDiffHeaderPaths(line, true));
  }
  const uniquePaths = [...new Set(paths.filter((p) => p && p !== "/dev/null"))];
  if (uniquePaths.length === 0) return false;
  // Never match arbitrary .txt files (e.g. CMakeLists.txt is a build file, not documentation!)
  return uniquePaths.every(
    (p) =>
      /(?:^|\/)docs?\//i.test(p) ||
      /\.(?:md|mdx|rst)$/i.test(p) ||
      /(?:^|\/)(?:readme|changelog|releasenote|license)(?:\.(?:md|mdx|rst))?$/i.test(p),
  );
}

export function countLogicalLines(text?: string): number {
  if (!text) return 0;
  const trimmedEnd = text.replace(/\r?\n$/, "");
  if (!trimmedEnd) return 0;
  return trimmedEnd.split(/\r?\n/).length;
}

function resolveDiffSourceKey(
  item: Pick<DistilledIssueItem, "repo" | "pr_diff_lines" | "pr_diff_source_ref" | "linked_merged_prs">,
  ecosystem: Ecosystem,
): string | null {
  const hasPrDiff = (item.pr_diff_lines ?? 0) > 0;
  if (!hasPrDiff) return null;
  const rawSource = String(item.pr_diff_source_ref ?? "").trim();
  const linkedList = Array.isArray(item.linked_merged_prs) ? item.linked_merged_prs : [];
  const explicitDiffKeys = new Set<string>();
  for (const lp of linkedList) {
    if (!lp || !parseStrictBool(lp.has_diff)) continue;
    const p = parseSinglePrOrMrRef(lp.ref || lp.url || lp.number, ecosystem, item.repo, lp.url);
    const k = p
      ? p.canonicalRef.toLowerCase()
      : String(lp.ref || lp.url || "")
          .trim()
          .toLowerCase();
    if (k) explicitDiffKeys.add(k);
  }
  if (rawSource) {
    const p = parseSinglePrOrMrRef(rawSource, ecosystem, item.repo);
    const key = p ? p.canonicalRef.toLowerCase() : rawSource.toLowerCase();
    if (explicitDiffKeys.size > 1) return null;
    if (explicitDiffKeys.size === 1 && !explicitDiffKeys.has(key)) return null;
    return key;
  }
  if (explicitDiffKeys.size === 1) {
    return [...explicitDiffKeys][0]!;
  }
  // Never blindly assume linked_merged_prs[0] owns an unattributed diff!
  return null;
}

interface PartitionedProvenance {
  ascendConfirmedPrNums: number[];
  ascendReferencedPrNums: number[];
  ascendSuppliedCommits: Record<number, string>;
  vllmMergedPrs: VllmMergedPrProvenance[];
  vllmMentionedPrs: VllmMergedPrProvenance[];
  gitcodeMentionedMrs: GitcodeMergedMrProvenance[];
  gitcodeMergedMrs: GitcodeMergedMrProvenance[];
  gitcodeConfirmedFixMrs: GitcodeMergedMrProvenance[];
  otherExternalPrs: OtherExternalPrProvenance[];
}

export function partitionItemProvenance(
  item: DistilledIssueItem,
  rawDiffSnippet?: string,
): PartitionedProvenance {
  const ecosystem = inferEcosystem(item);
  const issueRepoLower = item.repo.toLowerCase();
  const dist =
    item.distilled && typeof item.distilled === "object" && !Array.isArray(item.distilled)
      ? item.distilled
      : {};
  const rootCauseConfirmed = parseStrictBool(dist.root_cause_confirmed);

  const linkedByCanonical = new Map<string, LinkedMergedPr>();
  const modelCitedCanonical = new Set<string>();
  const crossRepoNums = new Set<number>();
  const sameRepoNums = new Set<number>();
  const modelSameRepoExplicitNums = new Set<number>();
  const modelCrossRepoNums = new Set<number>();

  const trackScope = (parsed: ParsedRef, fromModel = false, allowBare = false) => {
    if (!parsed.explicitRepo && !allowBare) return;
    if (parsed.ecosystem === ecosystem && parsed.repo.toLowerCase() === issueRepoLower) {
      sameRepoNums.add(parsed.number);
      if (fromModel) modelSameRepoExplicitNums.add(parsed.number);
    } else {
      crossRepoNums.add(parsed.number);
      if (fromModel) modelCrossRepoNums.add(parsed.number);
    }
  };

  const linkedMergedList = Array.isArray(item.linked_merged_prs) ? item.linked_merged_prs : [];
  for (const lp of linkedMergedList) {
    if (!lp || typeof lp !== "object") continue;
    const parsed = parseSinglePrOrMrRef(lp.ref || lp.url || lp.number, ecosystem, item.repo, lp.url);
    if (parsed) {
      linkedByCanonical.set(parsed.canonicalRef.toLowerCase(), lp);
      trackScope(parsed, false, true);
    }
  }
  const candidateList = coerceCitationList(item.candidate_prs);
  for (const cand of candidateList) {
    const parsed = parseSinglePrOrMrRef(cand, ecosystem, item.repo);
    if (parsed) trackScope(parsed, false);
  }

  const rawModelRefs = coerceCitationList(dist.fix_pr_refs);
  const rawModelNums = coerceCitationList(dist.fix_pr_numbers);
  const persistedUnparsedCitations = coerceCitationList(dist.unparsed_fix_pr_citations).filter((raw) => {
    if (raw === null || raw === undefined || typeof raw === "boolean") return false;
    return String(raw).trim() !== "";
  }).length;

  let unparsedModelCitations = 0;
  const deferredBareModelCitations: ParsedRef[] = [];

  for (const raw of [...rawModelRefs, ...rawModelNums]) {
    if (raw === null || raw === undefined || typeof raw === "boolean") continue;
    if (typeof raw !== "number" && typeof raw !== "string") {
      const nonEmptyStructured = Array.isArray(raw)
        ? raw.length > 0
        : typeof raw === "object" && Object.keys(raw).length > 0;
      if (nonEmptyStructured) unparsedModelCitations += 1;
      continue;
    }
    if (typeof raw === "string" && raw.trim() === "") continue;

    const parsed = parseSinglePrOrMrRef(raw, ecosystem, item.repo);
    if (!parsed) {
      unparsedModelCitations += 1;
      continue;
    }
    if (parsed.explicitRepo) {
      trackScope(parsed, true);
      modelCitedCanonical.add(parsed.canonicalRef.toLowerCase());
    } else {
      deferredBareModelCitations.push(parsed);
    }
  }

  const isBareSameRepoAllowed = (num: number): boolean => {
    if (!crossRepoNums.has(num)) return true;
    return modelSameRepoExplicitNums.has(num) && !modelCrossRepoNums.has(num);
  };

  for (const parsed of deferredBareModelCitations) {
    if (isBareSameRepoAllowed(parsed.number)) {
      modelCitedCanonical.add(parsed.canonicalRef.toLowerCase());
    } else if (
      modelCrossRepoNums.has(parsed.number) &&
      !modelSameRepoExplicitNums.has(parsed.number) &&
      !sameRepoNums.has(parsed.number)
    ) {
      // Bare numeric echo of an explicit cross-repo model citation; skip without fabricating same-repo
    } else {
      unparsedModelCitations += 1;
    }
  }

  const diffSourceCanonical = resolveDiffSourceKey(item, ecosystem);

  const ascendConfirmed = new Set<number>();
  const ascendReferenced = new Set<number>();
  const ascendSuppliedCommits: Record<number, string> = {};
  const vllmMergedMap = new Map<number, VllmMergedPrProvenance>();
  const vllmMentionedMap = new Map<number, VllmMergedPrProvenance>();
  const gitcodeMergedMap = new Map<string, GitcodeMergedMrProvenance>();
  const gitcodeMentionedMap = new Map<string, GitcodeMergedMrProvenance>();
  const otherMap = new Map<string, OtherExternalPrProvenance>();

  const registerRef = (parsed: ParsedRef, sourceKind: "linked_merged" | "model_fix" | "candidate") => {
    // Guard: never reinterpret an ambiguous bare cross-repo number as the issue's own repo
    if (sourceKind !== "linked_merged" && !parsed.explicitRepo && !isBareSameRepoAllowed(parsed.number)) {
      return;
    }

    const canonLower = parsed.canonicalRef.toLowerCase();
    const linked = linkedByCanonical.get(canonLower);
    const isMerged = sourceKind === "linked_merged" || Boolean(linked);
    const linkedSource = (linked?.source ?? "").trim().toLowerCase();
    const isMentionOnlyLink = linkedSource !== "" && MENTION_ONLY_LINK_SOURCES.has(linkedSource);
    const hasDiffSnippet = (item.pr_diff_lines ?? 0) > 0;
    const diffSnippetIsDocsOnly =
      diffSourceCanonical === canonLower &&
      (parseStrictBool(linked?.diff_excerpt_docs_only) ||
        parseStrictBool(item.pr_diff_docs_only) ||
        isDocsOnlyDiffSnippet(rawDiffSnippet));
    // Classify an entire MR as docsOnly ONLY from title or verified full-MR docs_only metadata
    // (never treat a partial docs diff excerpt as proof that a mixed fix(...) MR is docs-only!)
    const isDocsOnly = isDocsOnlyPrOrMrTitle(linked?.title) || parseStrictBool(linked?.docs_only);
    // M6 + V3: When a diff snippet is unbound OR touches only docs, it NEVER corroborates a runtime fix!
    const diffOwnershipCompatible =
      !hasDiffSnippet || (diffSourceCanonical === canonLower && !diffSnippetIsDocsOnly);
    const hasUnambiguousModelFix =
      modelCitedCanonical.has(canonLower) &&
      rootCauseConfirmed &&
      modelCitedCanonical.size === 1 &&
      unparsedModelCitations === 0 &&
      persistedUnparsedCitations === 0 &&
      diffOwnershipCompatible;
    const hasVerifiedFixDiff =
      diffSourceCanonical === canonLower && !isMentionOnlyLink && !diffSnippetIsDocsOnly;
    const hasSpecificFixEvidence = hasVerifiedFixDiff || hasUnambiguousModelFix;
    // V3: NEVER confirm unmerged PR/MRs or docs-only PR/MRs as runtime fixes!
    const isConfirmedFix = isMerged && !isDocsOnly && hasSpecificFixEvidence;
    const repoLower = parsed.repo.toLowerCase();

    if (parsed.ecosystem === "github" && repoLower === "vllm-project/vllm-ascend") {
      if (linked?.commit_sha && linked.commit_sha.trim()) {
        ascendSuppliedCommits[parsed.number] = linked.commit_sha.trim();
      }
      if (isConfirmedFix) {
        ascendConfirmed.add(parsed.number);
        ascendReferenced.delete(parsed.number);
      } else if (!ascendConfirmed.has(parsed.number)) {
        ascendReferenced.add(parsed.number);
      }
      return;
    }

    if (parsed.ecosystem === "github" && repoLower === "vllm-project/vllm") {
      const fullSuppliedCommit = linked?.commit_sha?.trim() ?? "";
      const entry: VllmMergedPrProvenance = {
        ref: `vllm-project/vllm#${parsed.number}`,
        repo: "vllm-project/vllm",
        number: parsed.number,
        url: linked?.url || `https://github.com/vllm-project/vllm/pull/${parsed.number}`,
        merged: isMerged,
        confirmed: isConfirmedFix,
        ...(isDocsOnly ? { docsOnly: true } : {}),
        ...(linked?.title ? { title: linked.title } : {}),
        ...(linked?.source ? { source: linked.source } : {}),
        // Preserve FULL supplied commit_sha until enrichVllmPrProvenance validates it against local git!
        ...(fullSuppliedCommit ? { commit: fullSuppliedCommit } : {}),
      };
      if (isMerged) {
        const existing = vllmMergedMap.get(parsed.number);
        if (!existing || (entry.confirmed && !existing.confirmed)) {
          vllmMergedMap.set(parsed.number, entry);
        }
        vllmMentionedMap.delete(parsed.number);
      } else if (!vllmMergedMap.has(parsed.number) && !vllmMentionedMap.has(parsed.number)) {
        vllmMentionedMap.set(parsed.number, entry);
      }
      return;
    }

    if (parsed.ecosystem === "gitcode") {
      const mapKey = canonLower;
      const entry: GitcodeMergedMrProvenance = {
        ref: parsed.canonicalRef,
        repo: parsed.repo,
        number: parsed.number,
        url: linked?.url || `https://gitcode.com/${parsed.repo}/merge_requests/${parsed.number}`,
        merged: isMerged,
        confirmed: isConfirmedFix,
        ...(isDocsOnly ? { docsOnly: true } : {}),
        ...(linked?.title ? { title: linked.title } : {}),
        ...(linked?.source ? { source: linked.source } : {}),
      };
      if (isMerged) {
        const existing = gitcodeMergedMap.get(mapKey);
        if (!existing || (entry.confirmed && !existing.confirmed)) {
          gitcodeMergedMap.set(mapKey, entry);
        }
        gitcodeMentionedMap.delete(mapKey);
      } else if (!gitcodeMergedMap.has(mapKey) && !gitcodeMentionedMap.has(mapKey)) {
        gitcodeMentionedMap.set(mapKey, entry);
      }
      return;
    }

    const otherKey = parsed.canonicalRef.toLowerCase();
    const existing = otherMap.get(otherKey);
    if (!existing || (isMerged && !existing.merged) || (isConfirmedFix && !existing.confirmed)) {
      otherMap.set(otherKey, {
        ref: parsed.canonicalRef,
        repo: parsed.repo,
        number: parsed.number,
        merged: isMerged,
        confirmed: isConfirmedFix,
        ...(isDocsOnly ? { docsOnly: true } : {}),
      });
    }
  };

  for (const lp of linkedMergedList) {
    if (!lp || typeof lp !== "object") continue;
    const parsed = parseSinglePrOrMrRef(lp.ref || lp.url || lp.number, ecosystem, item.repo, lp.url);
    if (parsed) registerRef(parsed, "linked_merged");
  }
  for (const raw of rawModelRefs) {
    const parsed = parseSinglePrOrMrRef(raw, ecosystem, item.repo);
    if (parsed) registerRef(parsed, "model_fix");
  }
  for (const raw of rawModelNums) {
    const parsed = parseSinglePrOrMrRef(raw, ecosystem, item.repo);
    if (parsed) registerRef(parsed, "model_fix");
  }
  for (const raw of candidateList) {
    const parsed = parseSinglePrOrMrRef(raw, ecosystem, item.repo);
    if (parsed) registerRef(parsed, "candidate");
  }

  const sortConfirmedFirst = <T extends { confirmed: boolean }>(arr: T[]): T[] => [
    ...arr.filter((x) => x.confirmed),
    ...arr.filter((x) => !x.confirmed),
  ];

  const gitcodeMergedMrs = sortConfirmedFirst([...gitcodeMergedMap.values()]);
  const gitcodeConfirmedFixMrs = gitcodeMergedMrs.filter((m) => m.confirmed);

  return {
    ascendConfirmedPrNums: [...ascendConfirmed],
    ascendReferencedPrNums: [...ascendReferenced],
    ascendSuppliedCommits,
    vllmMergedPrs: sortConfirmedFirst([...vllmMergedMap.values()]),
    vllmMentionedPrs: sortConfirmedFirst([...vllmMentionedMap.values()]),
    gitcodeMentionedMrs: sortConfirmedFirst([...gitcodeMentionedMap.values()]),
    gitcodeMergedMrs,
    gitcodeConfirmedFixMrs,
    otherExternalPrs: sortConfirmedFirst([...otherMap.values()]),
  };
}

function extractCanonicalPins(
  pins: ReadonlyArray<{
    ref: string;
    contains: boolean;
    sameNumberCommit?: string;
    cherryPickCommit?: string;
    revertedBy?: string;
  }>,
  canonicalRefs: readonly string[],
): {
  inBaselines: Record<string, boolean>;
  backportCommits: Record<string, string>;
  revertedInBaselines: Record<string, string>;
} {
  const byRef = new Map(pins.map((p) => [p.ref, p]));
  const inBaselines: Record<string, boolean> = {};
  const backportCommits: Record<string, string> = {};
  const revertedInBaselines: Record<string, string> = {};
  for (const ref of canonicalRefs) {
    const pin = byRef.get(ref);
    if (!pin) continue;
    if (pin.revertedBy) {
      inBaselines[ref] = false;
      revertedInBaselines[ref] = pin.revertedBy.slice(0, 8);
      continue;
    }
    // Never promote an unconfirmed same-number commit (`contains: false, sameNumberCommit: ...`) to verified backport!
    inBaselines[ref] = Boolean(pin.contains || pin.cherryPickCommit);
    if (pin.cherryPickCommit) {
      backportCommits[ref] = pin.cherryPickCommit.slice(0, 8);
    }
  }
  return { inBaselines, backportCommits, revertedInBaselines };
}

const LOCAL_FIX_VERSIONS_CACHE = new Map<string, ReturnType<typeof localFixVersions>>();

interface RepoPinState {
  pinHash: string;
  repoAccessErrors: Map<string, string>;
}

function computeRepoPinState(root: string): RepoPinState {
  const repoAccessErrors = new Map<string, string>();
  const seedsPath = resolve(root, "wiki/seeds/vllm-ascend-code.yaml");
  if (!existsSync(seedsPath)) return { pinHash: "no-seeds", repoAccessErrors };
  try {
    const seedsText = readFileSync(seedsPath, "utf8");
    const hash = createHash("sha256").update(seedsText, "utf8");
    // Use the exact same canonical YAML parser as chat-trace.ts (handles inline comments, key order, quoting).
    const parsedSeeds = parseSeeds(seedsText);
    const seenPaths = new Set<string>();
    for (const entry of Object.values(parsedSeeds.repos)) {
      const relPath = String(entry.path ?? "").trim();
      if (!relPath) continue;
      seenPaths.add(relPath);
      const repoDir = resolve(root, relPath);
      const exists = existsSync(repoDir);
      hash.update(`\0${relPath}:${exists ? "1" : "0"}`);
      if (exists) {
        const probe = probeRepoGitAccess(repoDir);
        hash.update(`:${repoGitStamp(repoDir)}:${probe}`);
        if (probe !== "ok") {
          const urlMatch =
            /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(
              String(entry.url ?? "").trim(),
            );
          if (urlMatch) {
            repoAccessErrors.set(
              urlMatch[1]!.toLowerCase(),
              `git access probe failed for ${relPath}: ${probe}`,
            );
          }
        }
      }
    }
    return { pinHash: hash.digest("hex").slice(0, 16), repoAccessErrors };
  } catch {
    return { pinHash: "unreadable-seeds", repoAccessErrors };
  }
}

function getCachedLocalFixVersions(
  root: string,
  repo: string,
  pr: number,
  pinState?: RepoPinState,
): ReturnType<typeof localFixVersions> {
  const effectiveState = pinState ?? computeRepoPinState(root);
  const accessErr = effectiveState.repoAccessErrors.get(repo.toLowerCase());
  if (accessErr) {
    return { status: "error", reason: accessErr };
  }
  const key = `${resolve(root)}::${effectiveState.pinHash}::${repo}#${pr}`;
  const cached = LOCAL_FIX_VERSIONS_CACHE.get(key);
  if (cached !== undefined && cached.status !== "error") return cached;
  const computed = localFixVersions(root, repo, pr);
  // NEVER cache transient Git errors so recovery succeeds cleanly on the next verification!
  if (computed.status !== "error") {
    LOCAL_FIX_VERSIONS_CACHE.set(key, computed);
  }
  return computed;
}

function matchSuppliedCommitSha(
  suppliedRaw: string | undefined,
  allCommits: readonly string[],
): { matched?: string; conflict: boolean } {
  const supplied = (suppliedRaw ?? "").trim().toLowerCase();
  if (!supplied) return { conflict: false };
  if (!/^[0-9a-f]{7,40}$/.test(supplied)) return { conflict: true };
  const matched = allCommits.find((c) => c.toLowerCase().startsWith(supplied));
  return matched ? { matched, conflict: false } : { conflict: true };
}

function checkAscendPrLineageViaCanonicalSeeds(
  root: string,
  prNumbers: readonly number[],
  pinState: RepoPinState,
  suppliedCommits: Readonly<Record<number, string>> = {},
): AuditedPrLineage[] {
  const out: AuditedPrLineage[] = [];
  for (const pr of prNumbers) {
    const check = getCachedLocalFixVersions(root, "vllm-project/vllm-ascend", pr, pinState);
    if (check.status === "error") {
      // Fail closed when a local clone is present but unreadable (e.g. git safe.directory error)
      out.push({
        pr,
        ref: `vllm-project/vllm-ascend#${pr}`,
        commit: "",
        confirmed: false,
        gitVerificationError: check.reason,
        inBaselines: {},
      });
      continue;
    }
    if (check.status !== "found") continue;
    const { inBaselines, backportCommits, revertedInBaselines } = extractCanonicalPins(
      check.pins,
      CANONICAL_ASCEND_PINS,
    );
    const allCommits = check.commits && check.commits.length > 0 ? check.commits : [check.commit];
    const { matched, conflict } = matchSuppliedCommitSha(suppliedCommits[pr], allCommits);
    out.push({
      pr,
      ref: `vllm-project/vllm-ascend#${pr}`,
      commit: (matched ?? check.commit).slice(0, 8),
      ...(allCommits.length > 1 ? { commits: allCommits.map((c) => c.slice(0, 8)) } : {}),
      ...(conflict ? { commitConflict: true } : {}),
      inBaselines,
      ...(Object.keys(backportCommits).length > 0 ? { backportCommits } : {}),
      ...(Object.keys(revertedInBaselines).length > 0 ? { revertedInBaselines } : {}),
    });
  }
  return out;
}

function enrichVllmPrProvenance(
  root: string,
  prs: readonly VllmMergedPrProvenance[],
  pinState: RepoPinState,
): VllmMergedPrProvenance[] {
  return prs.map((entry) => {
    const check = getCachedLocalFixVersions(root, "vllm-project/vllm", entry.number, pinState);
    if (check.status === "error") {
      const supplied = (entry.commit ?? "").trim();
      const badFormat = supplied.length > 0 && !/^[0-9a-f]{7,40}$/i.test(supplied);
      return {
        ...entry,
        confirmed: false,
        gitVerificationError: check.reason,
        ...(badFormat ? { commitConflict: true } : {}),
      };
    }
    if (check.status !== "found") {
      const supplied = (entry.commit ?? "").trim();
      const badFormat = supplied.length > 0 && !/^[0-9a-f]{7,40}$/i.test(supplied);
      return {
        ...entry,
        ...(supplied ? { commit: supplied.slice(0, 12) } : {}),
        ...(badFormat ? { confirmed: false, commitConflict: true } : {}),
      };
    }
    const { inBaselines, backportCommits, revertedInBaselines } = extractCanonicalPins(
      check.pins,
      CANONICAL_VLLM_PINS,
    );
    const allCommits = check.commits && check.commits.length > 0 ? check.commits : [check.commit];
    const { matched, conflict } = matchSuppliedCommitSha(entry.commit, allCommits);
    return {
      ...entry,
      merged: true,
      confirmed: conflict ? false : entry.confirmed,
      commit: (matched ?? check.commit).slice(0, 8),
      ...(allCommits.length > 1 ? { commits: allCommits.map((c) => c.slice(0, 8)) } : {}),
      ...(conflict ? { commitConflict: true } : {}),
      inBaselines,
      ...(Object.keys(backportCommits).length > 0 ? { backportCommits } : {}),
      ...(Object.keys(revertedInBaselines).length > 0 ? { revertedInBaselines } : {}),
    };
  });
}

export const VALID_SUBSYSTEMS: ReadonlySet<string> = new Set([
  "cann-aicore",
  "cann-aiv-timeout",
  "aclnn-op-param",
  "cann-opapi-symbol",
  "hccl-comm",
  "zmq-port-gloo",
  "aclgraph-capture",
  "mooncake-pd",
  "memory-oom",
  "other",
]);

export const FAULT_DOMAIN_EXPECTED_PAGES: Record<string, ReadonlySet<string>> = {
  "hccl-link-net": new Set([
    "cann-hccl",
    "engine-processes",
    "ascend-runtime-and-tuning",
    "collective-communication",
    "hccl-buffer",
    "hardware-devices",
  ]),
  "hccl-wait-cascade": new Set([
    "inference-troubleshooting",
    "cann-hccl",
    "collective-communication",
    "ascend-runtime-and-tuning",
    "request-call-chain",
    "hccl-buffer",
  ]),
  "torchair-ge-compile": new Set([
    "npugraph-ex",
    "acl-graph",
    "graph-mode-layer",
    "dev-new-model-and-custom-op",
    "ops-and-kernels",
  ]),
  "moe-mc2-quant": new Set([
    "moe-comm-dispatch",
    "expert-parallel",
    "moe",
    "quantization",
    "quantization-methods",
    "hccl-buffer",
    "large-scale-ep",
    "eplb",
    "kv-cache-quantization",
    "megamoe-shared-expert-fusion-5a99901d47e6",
    "enable-fused-mc2-782bf6f2bf48",
  ]),
  "cann-aicore-smmu": new Set([
    "ai-core",
    "op-to-ai-core",
    "inference-troubleshooting",
    "ops-and-kernels",
    "acl-graph",
    "ascend-flash-attention",
  ]),
  "cann-opapi-aclnn": new Set([
    "ops-and-kernels",
    "dev-new-model-and-custom-op",
    "ascend-flash-attention",
    "quantization",
    "tensor-layout",
    "ascend-model-onboarding",
  ]),
  "cann-driver-env": new Set([
    "ascend-runtime-and-tuning",
    "ascend-env-and-serve",
    "cann-hccl",
    "device-memory",
    "npu-worker-lifecycle",
    "hardware-devices",
    "engine-processes",
  ]),
  "pd-mooncake": new Set([
    "pd-disaggregation",
    "mooncake-connector",
    "kv-pool",
    "cluster-serving",
    "kv-cache-layerwise-offload",
  ]),
  "memory-oom": new Set([
    "device-memory",
    "kv-cache-memory-profiling",
    "host-memory-and-hugepages",
    "acl-graph",
    "sleep-mode",
    "npu-worker-lifecycle",
    "hccl-buffer",
  ]),
  other: new Set([
    "inference-troubleshooting",
    "ascend-config-system",
    "npu-worker-lifecycle",
    "engine-processes",
    "ascend-model-onboarding",
    "ops-and-kernels",
  ]),
};

export const FAULT_DOMAIN_ALIGNED_RULES: Record<string, ReadonlySet<string>> = {
  "hccl-link-net": new Set(["hccl-link-or-ifname-fault", "zmq-port-conflict"]),
  "hccl-wait-cascade": new Set(["hccl-timeout-cascade", "hccl-link-or-ifname-fault"]),
  "torchair-ge-compile": new Set(["torchair-ge-graph-compile-fault", "graph-capture-failure"]),
  "moe-mc2-quant": new Set(["moe-mc2-or-modelslim-quant-fault"]),
  "cann-aicore-smmu": new Set(["cann-plog-aicore-fault", "exit-139-sigsegv"]),
  "cann-opapi-aclnn": new Set(["cann-opapi-or-aclnn-fault", "soc-310p-or-c8-compat"]),
  "cann-driver-env": new Set([
    "cann-driver-or-device-env-fault",
    "soc-310p-or-c8-compat",
    "zmq-port-conflict",
    "exit-139-sigsegv",
  ]),
  "pd-mooncake": new Set(["mooncake-pd-transfer-error", "mooncake-adxl-endpoint-fallback"]),
  "memory-oom": new Set([
    "oom-stage-split",
    "pre-profile-free-memory",
    "exit-137-sigkill",
    "sleep-mode-fractal-nz-wakeup",
  ]),
  other: new Set([
    "soc-310p-or-c8-compat",
    "zmq-port-conflict",
    "exit-139-sigsegv",
    "debug-logging-hotpath-overhead",
    "metrics-kv-preemption-storm",
    "metrics-low-kv-high-latency",
    "sleep-mode-fractal-nz-wakeup",
  ]),
};

/**
 * Build the Wiki search index using the canonical loadPages + buildIndex pipeline
 * (stripped markdown body + frontmatter title/summary/aliases ONLY — never raw YAML frontmatter!).
 */
export function loadLiveWikiIndex(root: string) {
  const regRaw = registrySchema.parse(
    JSON.parse(readFileSync(resolve(root, "src/content/wiki/registry.json"), "utf8")),
  );
  const bodyByFile = new Map(loadPages(resolve(root, "wiki")).pages.map((p) => [p.file, p.body.trim()]));
  const pageIndexes: PageIndex[] = regRaw.pages.map((p) => {
    const body = bodyByFile.get(p.file) ?? "";
    const derived = deriveParamDisplayTitle(p, body);
    return {
      ...p,
      ...(derived !== p.title ? { displayTitle: derived } : {}),
      text: body,
    };
  });
  return buildIndex(pageIndexes);
}

interface BucketStats {
  total: number;
  rawMatched: number;
  missingRaw: number;
  shaMismatch: number;
  verbatimVerified: number;
  titleLeakRejected: number;
  withDiagRuleHit: number;
  withAnyDiagRuleHit: number;
  domainAlignedDiagRuleHits: number;
  rootLineAnalyzerHits: number;
  cascadeOnlyAnalyzerHits: number;
  withPrOrMrProvenance: number;
  colloquialTested: number;
  colloquialHits: number;
  colloquialHitRate: number;
  domainAlignedTop3Hits: number;
  domainAlignedTop3Rate: number;
  matchedRules?: Record<string, number>;
  unrelatedMatchedRules?: Record<string, number>;
}

function makeBucket(): BucketStats {
  return {
    total: 0,
    rawMatched: 0,
    missingRaw: 0,
    shaMismatch: 0,
    verbatimVerified: 0,
    titleLeakRejected: 0,
    withDiagRuleHit: 0,
    withAnyDiagRuleHit: 0,
    domainAlignedDiagRuleHits: 0,
    rootLineAnalyzerHits: 0,
    cascadeOnlyAnalyzerHits: 0,
    withPrOrMrProvenance: 0,
    colloquialTested: 0,
    colloquialHits: 0,
    colloquialHitRate: 0,
    domainAlignedTop3Hits: 0,
    domainAlignedTop3Rate: 0,
  };
}

function finalizeRate(hits: number, total: number): number {
  return total > 0 ? Math.round((hits / total) * 10000) / 10000 : 0;
}

function isValidNonZeroSha256(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const s = val.trim();
  return /^[0-9a-f]{64}$/i.test(s) && !/^0{64}$/.test(s);
}

function rawMapsEqual(a: ReadonlyMap<string, RawCorpusItem>, b: ReadonlyMap<string, RawCorpusItem>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) return false;
    if (canonicalJsonStringify(va) !== canonicalJsonStringify(vb)) return false;
  }
  return true;
}

function verifyMiningSummaryDigest(
  rawCorpusPath: string | null,
  rawCorpusMap: ReadonlyMap<string, RawCorpusItem>,
  rawSnapshot?: Pick<RawCorpusSnapshot, "sha256" | "bytes">,
): boolean | null {
  if (!rawCorpusPath || !existsSync(rawCorpusPath)) return null;
  let rawParentDir = dirname(rawCorpusPath);
  try {
    rawParentDir = stripWinNamespacePrefix(realpathSync.native(rawParentDir));
  } catch {
    // Fall back to lexical parent if realpath cannot resolve
  }
  const summaryPath = resolve(rawParentDir, "dual_mining_summary.json");
  if (!existsSync(summaryPath)) return null;
  try {
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as Record<string, unknown>;
    const declaredShaRaw =
      typeof summary.jsonlSha256 === "string"
        ? summary.jsonlSha256
        : typeof summary.rawCorpusSha256 === "string"
          ? summary.rawCorpusSha256
          : "";
    const declaredSha = declaredShaRaw.trim().toLowerCase();
    let actualSha: string;
    let actualBytes: number;
    const verifiedSnap = rawSnapshot ? VERIFIED_RAW_SNAPSHOTS.get(rawSnapshot) : undefined;
    if (
      verifiedSnap &&
      verifiedSnap.path === canonicalPathForAlias(rawCorpusPath) &&
      verifiedSnap.mapDigest === computeRawMapDigest(rawCorpusMap)
    ) {
      // Authentic single-read CLI snapshot cryptographically bound to the EXACT audited rawCorpusMap!
      actualSha = verifiedSnap.sha256.toLowerCase();
      actualBytes = verifiedSnap.bytes;
    } else {
      // Direct library call or untrusted/mutated snapshot: read ONE snapshot from disk AND verify rawCorpusMap matches it identically!
      const snap = loadRawCorpusSnapshot(rawCorpusPath);
      if (!rawMapsEqual(rawCorpusMap, snap.map)) return false;
      actualSha = snap.sha256;
      actualBytes = snap.bytes;
    }
    if (!declaredSha || declaredSha !== actualSha) return false;
    if (
      typeof summary.jsonlBytes !== "number" ||
      !Number.isInteger(summary.jsonlBytes) ||
      summary.jsonlBytes !== actualBytes
    ) {
      return false;
    }
    if (
      typeof summary.totalItems !== "number" ||
      !Number.isInteger(summary.totalItems) ||
      summary.totalItems !== rawCorpusMap.size
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function verifyDistilledPayload(
  root: string,
  payload: DistilledPayload,
  rawCorpusMap: ReadonlyMap<string, RawCorpusItem>,
  meta: {
    inputPath: string;
    rawCorpusPath: string | null;
    rawSnapshot?: Pick<RawCorpusSnapshot, "sha256" | "bytes">;
  },
) {
  const index = loadLiveWikiIndex(root);
  const pinState = computeRepoPinState(root);
  const miningSummaryDigestVerified = verifyMiningSummaryDigest(
    meta.rawCorpusPath,
    rawCorpusMap,
    meta.rawSnapshot,
  );

  let rawMatchedCount = 0;
  let missingRawCount = 0;
  let rawSha256VerifiedCount = 0;
  let shaMismatchCount = 0;
  let provenanceConflictCount = 0;
  let commitConflictCount = 0;
  let gitVerificationErrorCount = 0;
  let claimedRootVerificationMismatchCount = 0;
  let duplicateKeyCount = 0;
  let unparsedItemsCount = 0;
  let deterministicVerbatimCount = 0;
  let titleLeakRejectedCount = 0;
  let modelTitleLeakRejectedCount = 0;
  let verbatimCascadeLinesVerified = 0;
  let unverifiedCascadeLinesCount = 0;
  let ungroundedErrorCodesCount = 0;
  let rootLineAnalyzerHitCount = 0;
  let cascadeOnlyAnalyzerHitCount = 0;
  let verifiedDiagnoseHitCount = 0;
  let domainAlignedDiagnosticRuleHitCount = 0;
  let unverifiedGeneratedRuleHits = 0;
  let colloquialTotal = 0;
  let nonEmptyRecallCount = 0;
  let domainAlignedTop3Count = 0;
  let forensicChainPresentCount = 0;

  const seenPayloadKeys = new Set<string>();
  const byEcosystem: Record<Ecosystem, BucketStats> = {
    github: makeBucket(),
    gitcode: makeBucket(),
  };
  const byFaultDomain: Record<string, BucketStats> = Object.create(null);
  const byRepo: Record<
    string,
    {
      ecosystem: Ecosystem;
      repo: string;
      total: number;
      rawMatched: number;
      missingRaw: number;
      shaMismatch: number;
      verbatimVerified: number;
      withDiagRuleHit: number;
      withPrOrMrProvenance: number;
    }
  > = Object.create(null);
  const diagnosticRuleHitCounts: Record<string, number> = Object.create(null);
  const ascendPinCoverage: Record<string, number> = Object.fromEntries(
    CANONICAL_ASCEND_PINS.map((pin) => [pin, 0]),
  );

  const audited = payload.items.map((item) => {
    const isDuplicateKey = seenPayloadKeys.has(item.key);
    if (isDuplicateKey) {
      duplicateKeyCount += 1;
    } else {
      seenPayloadKeys.add(item.key);
    }
    const requireStrictProducerContract =
      Boolean(item.normalizer_version || payload.normalizerVersion) ||
      (meta.rawCorpusPath !== null && existsSync(meta.rawCorpusPath));
    const itemDistilledObj =
      item.distilled && typeof item.distilled === "object" && !Array.isArray(item.distilled)
        ? item.distilled
        : null;
    const dist = itemDistilledObj ?? {};
    const topForensicStrict = typeof item.forensic_chain_zh === "string" ? item.forensic_chain_zh.trim() : "";
    const nestedForensicStrict =
      typeof dist.forensic_chain_zh === "string" ? dist.forensic_chain_zh.trim() : "";
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === "string");
    const isNonEmptyQueryArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim().length >= 4);
    const isIntArray = (v: unknown): v is number[] =>
      Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isInteger(x) && x > 0);
    const hasCompleteCurrentRowSchema =
      itemDistilledObj !== null &&
      typeof item.verbatim_root_line === "string" &&
      typeof itemDistilledObj.verbatim_root_line === "string" &&
      itemDistilledObj.verbatim_root_line.trim() === item.verbatim_root_line.trim() &&
      typeof itemDistilledObj.fault_domain === "string" &&
      Object.hasOwn(FAULT_DOMAIN_EXPECTED_PAGES, itemDistilledObj.fault_domain) &&
      typeof itemDistilledObj.subsystem === "string" &&
      VALID_SUBSYSTEMS.has(itemDistilledObj.subsystem) &&
      typeof itemDistilledObj.hardware_soc === "string" &&
      itemDistilledObj.hardware_soc.trim().length > 0 &&
      typeof itemDistilledObj.topology === "string" &&
      itemDistilledObj.topology.trim().length > 0 &&
      typeof itemDistilledObj.root_cause_confirmed === "boolean" &&
      typeof itemDistilledObj.root_cause_zh === "string" &&
      itemDistilledObj.root_cause_zh.trim().length > 0 &&
      typeof itemDistilledObj.pr_fix_mechanism_zh === "string" &&
      typeof itemDistilledObj.fix_or_workaround_zh === "string" &&
      typeof itemDistilledObj.same_code_trap_zh === "string" &&
      isStringArray(item.verbatim_cascade_lines) &&
      isStringArray(itemDistilledObj.verbatim_cascade_lines) &&
      isStringArray(itemDistilledObj.error_codes) &&
      isStringArray(itemDistilledObj.fix_pr_refs) &&
      isIntArray(itemDistilledObj.fix_pr_numbers) &&
      (itemDistilledObj.unparsed_fix_pr_citations === undefined ||
        isStringArray(itemDistilledObj.unparsed_fix_pr_citations)) &&
      isNonEmptyQueryArray(itemDistilledObj.colloquial_queries_zh) &&
      typeof item.teacher_model === "string" &&
      item.teacher_model.trim().length > 0 &&
      typeof item.teacher_backend === "string" &&
      item.teacher_backend.trim().length > 0 &&
      typeof item.teacher_dtype === "string" &&
      item.teacher_dtype.trim().length > 0 &&
      isValidForensicChain(topForensicStrict) &&
      nestedForensicStrict === topForensicStrict;
    if (
      requireStrictProducerContract
        ? item.answer_parsed !== true || !hasCompleteCurrentRowSchema
        : item.answer_parsed !== undefined && item.answer_parsed !== true
    ) {
      unparsedItemsCount += 1;
    }

    const ecosystem = inferEcosystem(item);
    const rawRow = rawCorpusMap.get(item.key);
    const faultDomain =
      typeof dist.fault_domain === "string" && dist.fault_domain.trim()
        ? dist.fault_domain
        : (rawRow?.fault_domain_hint ?? "other");
    const titleForCheck =
      typeof (rawRow?.title ?? item.title) === "string" ? (rawRow?.title ?? item.title) : "";
    const trimmedRoot = typeof item.verbatim_root_line === "string" ? item.verbatim_root_line.trim() : "";

    let rawSha256Verified: boolean | null = null;
    if (rawRow) {
      if (!isDuplicateKey) rawMatchedCount += 1;
      const computedSha = computeRawSha256(rawRow.title, rawRow.body, rawRow.comments_text ?? "");
      rawSha256Verified = computedSha === rawRow.raw_sha256 && rawRow.raw_sha256 === item.raw_sha256;
      if (!rawSha256Verified) shaMismatchCount += 1;
    } else {
      missingRawCount += 1;
    }

    // Detect provenance conflict between raw corpus row and distilled row symmetrically BEFORE crediting SHA/verbatim/fixes
    let provenanceConflict = false;
    if (typeof item.comments_complete !== "boolean") {
      provenanceConflict = true;
    }
    if (requireStrictProducerContract && !String(item.url ?? "").trim()) {
      provenanceConflict = true;
    }
    if (item.resume_input_sha256 !== undefined && !isValidNonZeroSha256(item.resume_input_sha256)) {
      provenanceConflict = true;
    }
    if (item.content_input_sha256 !== undefined && !isValidNonZeroSha256(item.content_input_sha256)) {
      provenanceConflict = true;
    }
    if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      provenanceConflict = true;
    }
    if (payload.normalizerVersion !== undefined && payload.normalizerVersion !== CURRENT_NORMALIZER_VERSION) {
      provenanceConflict = true;
    }
    if (
      (payload.maxNewTokens !== undefined || requireStrictProducerContract) &&
      (typeof payload.maxNewTokens !== "number" ||
        !Number.isInteger(payload.maxNewTokens) ||
        payload.maxNewTokens < 64 ||
        payload.maxNewTokens > 7168)
    ) {
      provenanceConflict = true;
    }
    if (rawRow) {
      const rawEco = inferEcosystem({
        ecosystem: rawRow.ecosystem,
        key: rawRow.key,
        repo: rawRow.repo,
        url: rawRow.url ?? "",
      });
      if (
        rawEco !== ecosystem ||
        rawRow.repo.toLowerCase() !== item.repo.toLowerCase() ||
        String(rawRow.number) !== String(item.number) ||
        rawRow.title.trim() !== String(item.title ?? "").trim() ||
        (Boolean(rawRow.url?.trim()) && String(item.url ?? "").trim() !== rawRow.url!.trim()) ||
        (rawRow.comments_complete !== undefined &&
          parseStrictBool(rawRow.comments_complete) !== item.comments_complete)
      ) {
        provenanceConflict = true;
      }
      // Cryptographically verify content_input_sha256 and resume_input_sha256 against the raw row
      // (catches same-line-count patch tampering, forged 64-hex digests, or deleted digests!)
      const requireStrictDigests =
        item.content_input_sha256 !== undefined ||
        item.resume_input_sha256 !== undefined ||
        Boolean(item.normalizer_version || payload.normalizerVersion) ||
        (meta.rawCorpusPath !== null && existsSync(meta.rawCorpusPath));
      if (requireStrictDigests) {
        const validMaxNewTokens =
          typeof payload.maxNewTokens === "number" &&
          Number.isInteger(payload.maxNewTokens) &&
          payload.maxNewTokens >= 64 &&
          payload.maxNewTokens <= 7168;
        const effectiveMaxNewTokens = validMaxNewTokens ? payload.maxNewTokens! : 1536;
        const effectiveNormVer = String(
          item.normalizer_version ?? payload.normalizerVersion ?? CURRENT_NORMALIZER_VERSION,
        );
        if (
          !validMaxNewTokens ||
          payload.normalizerVersion !== CURRENT_NORMALIZER_VERSION ||
          effectiveNormVer !== CURRENT_NORMALIZER_VERSION ||
          (item.normalizer_version !== undefined && item.normalizer_version !== CURRENT_NORMALIZER_VERSION)
        ) {
          provenanceConflict = true;
        }
        const expectedContentSha = computeDistillContentSha256(rawRow);
        const expectedResumeSha = computeDistillInputSha256(rawRow, {
          teacherModel: String(item.teacher_model ?? payload.teacherModel ?? ""),
          teacherBackend: String(item.teacher_backend ?? payload.backend ?? ""),
          teacherDtype: String(item.teacher_dtype ?? payload.dtype ?? ""),
          maxNewTokens: effectiveMaxNewTokens,
          normalizerVersion: effectiveNormVer,
        });
        if (
          item.content_input_sha256 !== expectedContentSha ||
          item.resume_input_sha256 !== expectedResumeSha
        ) {
          provenanceConflict = true;
        }
      }
      const rawDiffKey = resolveDiffSourceKey(
        {
          repo: rawRow.repo,
          pr_diff_lines: rawRow.pr_diff_lines ?? (rawRow.pr_diff_source_ref ? 1 : 0),
          pr_diff_source_ref: rawRow.pr_diff_source_ref,
          linked_merged_prs: rawRow.linked_merged_prs,
        },
        rawEco,
      );
      const itemDiffKey = resolveDiffSourceKey(
        {
          repo: item.repo,
          pr_diff_lines: item.pr_diff_lines ?? (item.pr_diff_source_ref ? 1 : 0),
          pr_diff_source_ref: item.pr_diff_source_ref,
          linked_merged_prs: item.linked_merged_prs,
        },
        ecosystem,
      );
      if (rawDiffKey !== itemDiffKey) {
        provenanceConflict = true;
      }
      if ((rawRow.pr_diff_lines ?? 0) !== (item.pr_diff_lines ?? 0)) {
        provenanceConflict = true;
      }
      if (rawRow.pr_diff_snippet !== undefined) {
        const actualDiffLines = countLogicalLines(rawRow.pr_diff_snippet);
        if (
          actualDiffLines !== (rawRow.pr_diff_lines ?? 0) ||
          actualDiffLines !== (item.pr_diff_lines ?? 0)
        ) {
          provenanceConflict = true;
        }
      } else if ((rawRow.pr_diff_lines ?? 0) > 0 || (item.pr_diff_lines ?? 0) > 0) {
        provenanceConflict = true;
      }
      if (Array.isArray(rawRow.linked_merged_prs) || Array.isArray(item.linked_merged_prs)) {
        const buildLinkedSigMap = (
          list: unknown,
          eco: Ecosystem,
          repo: string,
        ): Map<
          string,
          {
            source: string;
            hasDiff: boolean;
            docsOnly: boolean;
            diffExcerptDocsOnly: boolean;
            title: string;
            url: string;
            commitSha: string;
          }
        > => {
          const out = new Map<
            string,
            {
              source: string;
              hasDiff: boolean;
              docsOnly: boolean;
              diffExcerptDocsOnly: boolean;
              title: string;
              url: string;
              commitSha: string;
            }
          >();
          if (!Array.isArray(list)) return out;
          for (const lp of list) {
            if (!lp || typeof lp !== "object") continue;
            const rec = lp as LinkedMergedPr;
            const p = parseSinglePrOrMrRef(rec.ref || rec.url || rec.number, eco, repo, rec.url);
            const k = p
              ? p.canonicalRef.toLowerCase()
              : String(rec.ref || "")
                  .trim()
                  .toLowerCase();
            if (!k) continue;
            out.set(k, {
              source: String(rec.source ?? "")
                .trim()
                .toLowerCase(),
              hasDiff: parseStrictBool(rec.has_diff),
              docsOnly: parseStrictBool(rec.docs_only),
              diffExcerptDocsOnly: parseStrictBool(rec.diff_excerpt_docs_only),
              title: String(rec.title ?? "").trim(),
              url: String(rec.url ?? "").trim(),
              commitSha: String(rec.commit_sha ?? "")
                .trim()
                .toLowerCase(),
            });
          }
          return out;
        };
        const rawLinkedMap = buildLinkedSigMap(rawRow.linked_merged_prs, rawEco, rawRow.repo);
        const itemLinkedMap = buildLinkedSigMap(item.linked_merged_prs, ecosystem, item.repo);
        if (rawLinkedMap.size !== itemLinkedMap.size) {
          provenanceConflict = true;
        } else {
          for (const [k, rawSig] of rawLinkedMap) {
            const itemSig = itemLinkedMap.get(k);
            if (
              !itemSig ||
              itemSig.source !== rawSig.source ||
              itemSig.hasDiff !== rawSig.hasDiff ||
              itemSig.docsOnly !== rawSig.docsOnly ||
              itemSig.diffExcerptDocsOnly !== rawSig.diffExcerptDocsOnly ||
              itemSig.title !== rawSig.title ||
              itemSig.url !== rawSig.url ||
              itemSig.commitSha !== rawSig.commitSha
            ) {
              provenanceConflict = true;
              break;
            }
          }
        }
      }
      if (Array.isArray(rawRow.candidate_prs) || Array.isArray(item.candidate_prs)) {
        const buildCandSet = (list: unknown, eco: Ecosystem, repo: string): Set<string> => {
          const out = new Set<string>();
          for (const raw of coerceCitationList(list)) {
            const p = parseSinglePrOrMrRef(raw, eco, repo);
            if (p) out.add(p.canonicalRef.toLowerCase());
            else {
              const s = String(raw ?? "")
                .trim()
                .toLowerCase();
              if (s) out.add(s);
            }
          }
          return out;
        };
        const rawCandSet = buildCandSet(rawRow.candidate_prs, rawEco, rawRow.repo);
        const itemCandSet = buildCandSet(item.candidate_prs, ecosystem, item.repo);
        if (rawCandSet.size !== itemCandSet.size) {
          provenanceConflict = true;
        } else {
          for (const k of rawCandSet) {
            if (!itemCandSet.has(k)) {
              provenanceConflict = true;
              break;
            }
          }
        }
      }
      const expectedDiffDocsOnly = isDocsOnlyDiffSnippet(rawRow.pr_diff_snippet);
      if (item.pr_diff_docs_only !== undefined) {
        if (typeof item.pr_diff_docs_only !== "boolean" || item.pr_diff_docs_only !== expectedDiffDocsOnly) {
          provenanceConflict = true;
        }
      } else if (expectedDiffDocsOnly && requireStrictProducerContract) {
        provenanceConflict = true;
      }
    }
    if (provenanceConflict) provenanceConflictCount += 1;
    if (!isDuplicateKey && rawRow && rawSha256Verified === true && !provenanceConflict) {
      rawSha256VerifiedCount += 1;
    }

    const trustedRaw =
      !isDuplicateKey && rawRow !== undefined && rawSha256Verified === true && !provenanceConflict;
    const rawBody = trustedRaw ? rawRow.body : null;
    const rawComments = trustedRaw ? (rawRow.comments_text ?? "") : null;
    const isSingleLineInRawField = (cand: string): boolean => {
      if (rawBody === null || rawComments === null) return false;
      return isSingleLineInField(cand, rawBody, rawComments);
    };

    const titleLeak = trimmedRoot.length > 0 && isTitleLeak(trimmedRoot, titleForCheck);
    if (titleLeak) titleLeakRejectedCount += 1;
    const rejectedModelRoot =
      typeof item.model_verbatim_root_line_rejected === "string"
        ? item.model_verbatim_root_line_rejected.trim()
        : "";
    if (rejectedModelRoot.length > 0 && isTitleLeak(rejectedModelRoot, titleForCheck)) {
      modelTitleLeakRejectedCount += 1;
    }

    // Strict raw + SHA256 + conflict-free + single-line same-field + non-prose/non-link-list gate
    const inLogHaystack = isSingleLineInRawField(trimmedRoot);
    const rootIsNonProseLog =
      trimmedRoot.length > 0 &&
      rawBody !== null &&
      rawComments !== null &&
      !isProseSummaryNotRuntimeLog(trimmedRoot) &&
      !isMarkdownPrOrLinkListLine(trimmedRoot) &&
      hasNonProseSourceOccurrence(trimmedRoot, rawBody, rawComments);
    const verbatimRootVerified = trustedRaw && inLogHaystack && !titleLeak && rootIsNonProseLog;
    if (verbatimRootVerified) deterministicVerbatimCount += 1;

    // Reconcile producer's claimed root verification status (BOTH false-positive AND false-negative!),
    // verbatim_root_source attribution (including deterministic fallback_log_extractor verification!),
    // & nested distilled.verbatim_root_line
    const nestedDistilledRoot =
      dist.verbatim_root_line !== undefined
        ? typeof dist.verbatim_root_line === "string"
          ? dist.verbatim_root_line.trim()
          : null
        : undefined;
    const claimedRootSource = item.verbatim_root_source;
    let fallbackAttributionInvalid = false;
    if (
      verbatimRootVerified &&
      claimedRootSource === "fallback_log_extractor" &&
      rawBody !== null &&
      rawComments !== null
    ) {
      const hintCodes = [
        ...coerceStringList(rawRow?.detected_error_codes),
        ...coerceStringList(dist.error_codes),
      ];
      const expectedFallback = extractFallbackVerbatimRootLine(
        titleForCheck,
        rawBody,
        rawComments,
        hintCodes,
      );
      if (!expectedFallback || trimmedRoot !== expectedFallback) {
        fallbackAttributionInvalid = true;
      } else if (
        rejectedModelRoot.length > 0 &&
        isSingleLineInRawField(rejectedModelRoot) &&
        !isTitleLeak(rejectedModelRoot, titleForCheck) &&
        !isProseSummaryNotRuntimeLog(rejectedModelRoot) &&
        !isMarkdownPrOrLinkListLine(rejectedModelRoot) &&
        hasNonProseSourceOccurrence(rejectedModelRoot, rawBody, rawComments)
      ) {
        fallbackAttributionInvalid = true;
      }
    } else if (
      !verbatimRootVerified &&
      claimedRootSource === "rejected" &&
      rawBody !== null &&
      rawComments !== null
    ) {
      const hintCodes = [
        ...coerceStringList(rawRow?.detected_error_codes),
        ...coerceStringList(dist.error_codes),
      ];
      const expectedFallback = extractFallbackVerbatimRootLine(
        titleForCheck,
        rawBody,
        rawComments,
        hintCodes,
      );
      if (
        (expectedFallback &&
          isSingleLineInRawField(expectedFallback) &&
          !isTitleLeak(expectedFallback, titleForCheck) &&
          !isProseSummaryNotRuntimeLog(expectedFallback) &&
          !isMarkdownPrOrLinkListLine(expectedFallback) &&
          hasNonProseSourceOccurrence(expectedFallback, rawBody, rawComments)) ||
        (rejectedModelRoot.length > 0 &&
          isSingleLineInRawField(rejectedModelRoot) &&
          !isTitleLeak(rejectedModelRoot, titleForCheck) &&
          !isProseSummaryNotRuntimeLog(rejectedModelRoot) &&
          !isMarkdownPrOrLinkListLine(rejectedModelRoot) &&
          hasNonProseSourceOccurrence(rejectedModelRoot, rawBody, rawComments))
      ) {
        fallbackAttributionInvalid = true;
      }
    }
    const rootSourceMismatch =
      rawRow !== undefined &&
      (claimedRootSource !== undefined || requireStrictProducerContract) &&
      (verbatimRootVerified
        ? (claimedRootSource !== "model" && claimedRootSource !== "fallback_log_extractor") ||
          fallbackAttributionInvalid
        : claimedRootSource !== "rejected" || fallbackAttributionInvalid);
    if (
      typeof item.verbatim_root_verified !== "boolean" ||
      (rawRow !== undefined && item.verbatim_root_verified !== verbatimRootVerified) ||
      (nestedDistilledRoot !== undefined && nestedDistilledRoot !== trimmedRoot) ||
      rootSourceMismatch
    ) {
      claimedRootVerificationMismatchCount += 1;
    }

    // Deduplicated cascade lines verified within a single logical line of a trusted raw record,
    // AND reconciled against nested dist.verbatim_cascade_lines so fabricated nested lines
    // (even when identical to a rejected root!) cannot bypass the gate!
    const rawTopCascades = item.verbatim_cascade_lines as unknown;
    const rawNestedCascades = dist.verbatim_cascade_lines as unknown;
    const isValidCascadeArray = (arr: unknown): boolean =>
      Array.isArray(arr) &&
      arr.length <= 4 &&
      arr.every(
        (x) =>
          typeof x === "string" &&
          x.trim().length > 0 &&
          (!requireStrictProducerContract || codePointLen(x.trim()) >= 12),
      );
    const topCascades = coerceStringList(rawTopCascades);
    const hasNestedCascades = rawNestedCascades !== undefined;
    const topCascadesValid = rawTopCascades === undefined || isValidCascadeArray(rawTopCascades);
    const nestedCascadesValid = !hasNestedCascades || isValidCascadeArray(rawNestedCascades);
    const nestedCascades = hasNestedCascades ? coerceStringList(rawNestedCascades) : [];
    const cascadesParityMismatch =
      !topCascadesValid ||
      (hasNestedCascades &&
        (!nestedCascadesValid ||
          nestedCascades.length !== topCascades.length ||
          nestedCascades.some((ln, idx) => ln !== topCascades[idx])));
    if (cascadesParityMismatch) {
      unverifiedCascadeLinesCount += 1;
    }

    const verifiedCascadeLines: string[] = [];
    const seenCascades = new Set<string>();
    if (rawBody !== null && rawComments !== null) {
      for (const ln of topCascades) {
        if (!ln || seenCascades.has(ln) || (verbatimRootVerified && ln === trimmedRoot)) {
          unverifiedCascadeLinesCount += 1;
          continue;
        }
        // Verify source authenticity & non-prose/non-macro status FIRST — never skip an unverified cascade!
        if (
          isTitleLeak(ln, titleForCheck) ||
          !isSingleLineInRawField(ln) ||
          isProseSummaryNotRuntimeLog(ln) ||
          isMarkdownPrOrLinkListLine(ln) ||
          !hasNonProseSourceOccurrence(ln, rawBody, rawComments)
        ) {
          unverifiedCascadeLinesCount += 1;
          continue;
        }
        seenCascades.add(ln);
        verifiedCascadeLines.push(ln);
      }
      if (hasNestedCascades) {
        for (const ln of nestedCascades) {
          if (
            !topCascades.includes(ln) &&
            (isTitleLeak(ln, titleForCheck) ||
              !isSingleLineInRawField(ln) ||
              isProseSummaryNotRuntimeLog(ln) ||
              isMarkdownPrOrLinkListLine(ln) ||
              !hasNonProseSourceOccurrence(ln, rawBody, rawComments))
          ) {
            unverifiedCascadeLinesCount += 1;
          }
        }
      }
    }
    verbatimCascadeLinesVerified += verifiedCascadeLines.length;

    const rootRunnableForAnalyzer =
      verbatimRootVerified &&
      rawBody !== null &&
      rawComments !== null &&
      !isProseSummaryNotRuntimeLog(trimmedRoot) &&
      hasNonProseSourceOccurrence(trimmedRoot, rawBody, rawComments);
    const runnableCascades =
      rawBody !== null && rawComments !== null
        ? verifiedCascadeLines.filter(
            (ln) => !isProseSummaryNotRuntimeLog(ln) && hasNonProseSourceOccurrence(ln, rawBody, rawComments),
          )
        : [];
    const rootOnlyDiag = rootRunnableForAnalyzer ? analyzeTroubleshootInput(trimmedRoot) : null;
    const rootLineMatchedRuleIds = rootOnlyDiag
      ? [...new Set(rootOnlyDiag.findings.map((f) => f.ruleId))]
      : [];
    const rootLineAnalyzerHit = rootRunnableForAnalyzer && rootLineMatchedRuleIds.length > 0;

    const verifiedSampleLog = [rootRunnableForAnalyzer ? trimmedRoot : "", ...runnableCascades]
      .filter(Boolean)
      .join("\n");
    const verifiedDiag = verifiedSampleLog ? analyzeTroubleshootInput(verifiedSampleLog) : null;
    const matchedRuleIds = verifiedDiag ? [...new Set(verifiedDiag.findings.map((f) => f.ruleId))] : [];
    const cascadeOnlyAnalyzerHit =
      !rootLineAnalyzerHit && runnableCascades.length > 0 && matchedRuleIds.length > 0;

    const alignedRulesSet = Object.hasOwn(FAULT_DOMAIN_ALIGNED_RULES, faultDomain)
      ? FAULT_DOMAIN_ALIGNED_RULES[faultDomain]!
      : FAULT_DOMAIN_ALIGNED_RULES.other!;
    const domainAlignedRuleIds = matchedRuleIds.filter((id) => alignedRulesSet.has(id));
    const unrelatedRuleIds = matchedRuleIds.filter((id) => !alignedRulesSet.has(id));
    const hasAnyAnalyzerHit = rootLineAnalyzerHit || cascadeOnlyAnalyzerHit;
    const domainAlignedAnalyzerHit = hasAnyAnalyzerHit && domainAlignedRuleIds.length > 0;

    if (rootLineAnalyzerHit) {
      rootLineAnalyzerHitCount += 1;
    } else if (cascadeOnlyAnalyzerHit) {
      cascadeOnlyAnalyzerHitCount += 1;
    }

    if (hasAnyAnalyzerHit) {
      verifiedDiagnoseHitCount += 1;
      for (const ruleId of matchedRuleIds) {
        diagnosticRuleHitCounts[ruleId] = (diagnosticRuleHitCounts[ruleId] ?? 0) + 1;
      }
    }
    if (domainAlignedAnalyzerHit) {
      domainAlignedDiagnosticRuleHitCount += 1;
    }
    // Always track unverified generated root-line rule hits independently — NEVER masked by cascade, fallback root, or non-matching unverified root!
    let itemUnverifiedHit = false;
    if (!verbatimRootVerified && trimmedRoot && !isProseSummaryNotRuntimeLog(trimmedRoot)) {
      const unverifiedDiag = analyzeTroubleshootInput(trimmedRoot);
      if (unverifiedDiag.findings.length > 0) {
        itemUnverifiedHit = true;
      }
    }
    if (
      !itemUnverifiedHit &&
      rejectedModelRoot &&
      (!isSingleLineInRawField(rejectedModelRoot) || isTitleLeak(rejectedModelRoot, titleForCheck)) &&
      !isProseSummaryNotRuntimeLog(rejectedModelRoot)
    ) {
      const rejectedDiag = analyzeTroubleshootInput(rejectedModelRoot);
      if (rejectedDiag.findings.length > 0) {
        itemUnverifiedHit = true;
      }
    }
    if (itemUnverifiedHit) {
      unverifiedGeneratedRuleHits += 1;
    }

    // V2: Fail CLOSED whenever raw evidence is missing, SHA mismatches, duplicate key, or provenance conflicts
    const suppressConfirmations = isDuplicateKey || provenanceConflict || rawSha256Verified !== true;
    const rawProv = partitionItemProvenance(item, trustedRaw ? rawRow.pr_diff_snippet : undefined);
    const prov: PartitionedProvenance = suppressConfirmations
      ? {
          ascendConfirmedPrNums: [],
          ascendReferencedPrNums: [
            ...new Set([...rawProv.ascendConfirmedPrNums, ...rawProv.ascendReferencedPrNums]),
          ],
          ascendSuppliedCommits: rawProv.ascendSuppliedCommits,
          vllmMergedPrs: rawProv.vllmMergedPrs.map((e) => ({ ...e, confirmed: false })),
          vllmMentionedPrs: rawProv.vllmMentionedPrs.map((e) => ({ ...e, confirmed: false })),
          gitcodeMentionedMrs: rawProv.gitcodeMentionedMrs.map((e) => ({ ...e, confirmed: false })),
          gitcodeMergedMrs: rawProv.gitcodeMergedMrs.map((e) => ({ ...e, confirmed: false })),
          gitcodeConfirmedFixMrs: [],
          otherExternalPrs: rawProv.otherExternalPrs.map((e) => ({ ...e, confirmed: false })),
        }
      : rawProv;
    const rawConfirmedAscendLineage = checkAscendPrLineageViaCanonicalSeeds(
      root,
      prov.ascendConfirmedPrNums,
      pinState,
      prov.ascendSuppliedCommits,
    );
    const confirmedFixPrLineage = rawConfirmedAscendLineage.filter(
      (l) => !l.commitConflict && !l.gitVerificationError,
    );
    const demotedConflictedAscend = rawConfirmedAscendLineage.filter(
      (l) => l.commitConflict || Boolean(l.gitVerificationError),
    );
    const referencedPrLineage = [
      ...demotedConflictedAscend,
      ...checkAscendPrLineageViaCanonicalSeeds(
        root,
        prov.ascendReferencedPrNums,
        pinState,
        prov.ascendSuppliedCommits,
      ),
    ];
    const enrichedVllmMerged = enrichVllmPrProvenance(root, prov.vllmMergedPrs, pinState);
    const enrichedVllmMentioned = enrichVllmPrProvenance(root, prov.vllmMentionedPrs, pinState);
    const promotedVllmMerged = enrichedVllmMentioned.filter((p) => p.merged);
    const remainingVllmMentioned = enrichedVllmMentioned.filter((p) => !p.merged);
    const vllmMergedPrs = [...enrichedVllmMerged, ...promotedVllmMerged];
    const vllmMentionedPrs = remainingVllmMentioned;
    const allLineageChecked = [
      ...confirmedFixPrLineage,
      ...referencedPrLineage,
      ...vllmMergedPrs,
      ...vllmMentionedPrs,
    ];
    const itemCommitConflicts = allLineageChecked.filter((p) => p.commitConflict).length;
    const itemGitErrors = allLineageChecked.filter((p) => Boolean(p.gitVerificationError)).length;
    commitConflictCount += itemCommitConflicts;
    gitVerificationErrorCount += itemGitErrors;
    const trustedProvenance =
      !isDuplicateKey &&
      !provenanceConflict &&
      rawSha256Verified === true &&
      itemCommitConflicts === 0 &&
      itemGitErrors === 0;
    const gitcodeMentionedMrs = prov.gitcodeMentionedMrs;
    const gitcodeMergedMrs = prov.gitcodeMergedMrs;
    const gitcodeConfirmedFixMrs = prov.gitcodeConfirmedFixMrs;
    const otherExternalPrs = prov.otherExternalPrs;

    if (trustedProvenance) {
      for (const lineage of [...confirmedFixPrLineage, ...referencedPrLineage]) {
        for (const pin of CANONICAL_ASCEND_PINS) {
          if (lineage.inBaselines[pin]) {
            ascendPinCoverage[pin] = (ascendPinCoverage[pin] ?? 0) + 1;
          }
        }
      }
    }

    const hasPrOrMrProvenance =
      trustedProvenance &&
      (confirmedFixPrLineage.length > 0 ||
        referencedPrLineage.length > 0 ||
        vllmMergedPrs.length > 0 ||
        vllmMentionedPrs.length > 0 ||
        gitcodeMergedMrs.length > 0 ||
        gitcodeMentionedMrs.length > 0 ||
        otherExternalPrs.length > 0);

    const expectedDomainPages = Object.hasOwn(FAULT_DOMAIN_EXPECTED_PAGES, faultDomain)
      ? FAULT_DOMAIN_EXPECTED_PAGES[faultDomain]!
      : FAULT_DOMAIN_EXPECTED_PAGES.other!;
    let itemColloqHits = 0;
    let itemDomainAlignedHits = 0;
    const colloquialEval = coerceStringList(dist.colloquial_queries_zh)
      .slice(0, 3)
      .map((q) => {
        colloquialTotal += 1;
        const hits = retrieve(q, index, { limit: 3 });
        const top3 = hits.map((h) => h.id);
        if (top3.length > 0) {
          nonEmptyRecallCount += 1;
          itemColloqHits += 1;
        }
        const domainAligned = top3.some((id) => expectedDomainPages.has(id));
        if (domainAligned) {
          domainAlignedTop3Count += 1;
          itemDomainAlignedHits += 1;
        }
        return { query: q, top3, domainAligned };
      });

    // Update ecosystem, domain, and repo stats (own-property guarded against prototype keys like "constructor")
    const ecoBucket = byEcosystem[ecosystem];
    let domBucket = Object.hasOwn(byFaultDomain, faultDomain) ? byFaultDomain[faultDomain] : undefined;
    if (!domBucket) {
      domBucket = {
        ...makeBucket(),
        matchedRules: Object.create(null),
        unrelatedMatchedRules: Object.create(null),
      };
      byFaultDomain[faultDomain] = domBucket;
    }
    const repoKey = `${ecosystem}:${item.repo}`;
    let repoBucket = Object.hasOwn(byRepo, repoKey) ? byRepo[repoKey] : undefined;
    if (!repoBucket) {
      repoBucket = {
        ecosystem,
        repo: item.repo,
        total: 0,
        rawMatched: 0,
        missingRaw: 0,
        shaMismatch: 0,
        verbatimVerified: 0,
        withDiagRuleHit: 0,
        withPrOrMrProvenance: 0,
      };
      byRepo[repoKey] = repoBucket;
    }

    for (const b of [ecoBucket, domBucket]) {
      b.total += 1;
      if (rawRow && !isDuplicateKey) b.rawMatched += 1;
      else if (!rawRow) b.missingRaw += 1;
      if (rawRow && rawSha256Verified === false) b.shaMismatch += 1;
      if (verbatimRootVerified) b.verbatimVerified += 1;
      if (titleLeak) b.titleLeakRejected += 1;
      if (hasAnyAnalyzerHit) b.withAnyDiagRuleHit += 1;
      if (domainAlignedAnalyzerHit) b.domainAlignedDiagRuleHits += 1;
      if (b === domBucket ? domainAlignedAnalyzerHit : hasAnyAnalyzerHit) b.withDiagRuleHit += 1;
      if (rootLineAnalyzerHit) b.rootLineAnalyzerHits += 1;
      if (cascadeOnlyAnalyzerHit) b.cascadeOnlyAnalyzerHits += 1;
      if (hasPrOrMrProvenance) b.withPrOrMrProvenance += 1;
      b.colloquialTested += colloquialEval.length;
      b.colloquialHits += itemColloqHits;
      b.domainAlignedTop3Hits += itemDomainAlignedHits;
    }
    if (hasAnyAnalyzerHit && domBucket.matchedRules && domBucket.unrelatedMatchedRules) {
      for (const ruleId of domainAlignedRuleIds) {
        domBucket.matchedRules[ruleId] = (domBucket.matchedRules[ruleId] ?? 0) + 1;
      }
      for (const ruleId of unrelatedRuleIds) {
        domBucket.unrelatedMatchedRules[ruleId] = (domBucket.unrelatedMatchedRules[ruleId] ?? 0) + 1;
      }
    }
    repoBucket.total += 1;
    if (rawRow && !isDuplicateKey) repoBucket.rawMatched += 1;
    else if (!rawRow) repoBucket.missingRaw += 1;
    if (rawRow && rawSha256Verified === false) repoBucket.shaMismatch += 1;
    if (verbatimRootVerified) repoBucket.verbatimVerified += 1;
    if (hasAnyAnalyzerHit) repoBucket.withDiagRuleHit += 1;
    if (hasPrOrMrProvenance) repoBucket.withPrOrMrProvenance += 1;

    const forensicChainZh =
      typeof item.forensic_chain_zh === "string" && item.forensic_chain_zh.trim().length > 0
        ? item.forensic_chain_zh.trim()
        : typeof dist.forensic_chain_zh === "string" && dist.forensic_chain_zh.trim().length > 0
          ? dist.forensic_chain_zh.trim()
          : "";
    if (isValidForensicChain(forensicChainZh)) forensicChainPresentCount += 1;

    // Ground errorCodes strictly against trusted raw text & valid error-code syntax;
    // flag ANY blank, non-string, prose-word, or ungrounded code (R7 P2#9 + R8 P2#9)!
    const rawHaystackUpper = trustedRaw
      ? `${rawRow.title}\n${rawRow.body}\n${rawRow.comments_text ?? ""}`.toUpperCase()
      : "";
    const groundedErrorCodes: string[] = [];
    const seenGroundedCodes = new Set<string>();
    const rawErrorCodesVal = dist.error_codes as unknown;
    if (rawErrorCodesVal !== undefined) {
      if (!Array.isArray(rawErrorCodesVal)) {
        ungroundedErrorCodesCount += 1;
      } else {
        for (const rawCode of rawErrorCodesVal) {
          if (typeof rawCode !== "string") {
            ungroundedErrorCodesCount += 1;
            continue;
          }
          const tok = rawCode.trim();
          if (!tok || rawCode !== tok || !isValidErrorCodeToken(tok)) {
            ungroundedErrorCodesCount += 1;
            continue;
          }
          if (trustedRaw) {
            if (!containsWholeErrorCode(tok, rawHaystackUpper)) {
              ungroundedErrorCodesCount += 1;
              continue;
            }
            const up = tok.toUpperCase();
            if (!seenGroundedCodes.has(up)) {
              seenGroundedCodes.add(up);
              groundedErrorCodes.push(tok);
            }
          }
        }
      }
    }

    return {
      key: item.key,
      ecosystem,
      repo: item.repo,
      url: item.url,
      title: item.title,
      rawSha256: item.raw_sha256,
      rawCorpusMatched: Boolean(rawRow),
      rawSha256Verified,
      provenanceConflict,
      commitConflictCount: itemCommitConflicts,
      gitVerificationErrorCount: itemGitErrors,
      ...(isDuplicateKey ? { duplicateKey: true } : {}),
      commentsComplete: item.comments_complete,
      titleLeakRejected: titleLeak,
      verbatimRootVerified,
      verbatimRootSource: verbatimRootVerified
        ? (item.verbatim_root_source ?? "model")
        : isDuplicateKey
          ? "duplicate_key"
          : !rawRow
            ? "missing_raw"
            : provenanceConflict
              ? "provenance_conflict"
              : rawSha256Verified === false
                ? "sha_mismatch"
                : "rejected",
      verbatimRootLine: verbatimRootVerified ? trimmedRoot : "",
      ...(titleLeak ? { rejectedTitleLeakLine: trimmedRoot } : {}),
      verbatimCascadeLines: verifiedCascadeLines,
      faultDomain,
      subsystem: typeof dist.subsystem === "string" && dist.subsystem.trim() ? dist.subsystem : "other",
      errorCodes: groundedErrorCodes,
      rootCauseConfirmed: suppressConfirmations ? false : parseStrictBool(dist.root_cause_confirmed),
      rootCauseZh: typeof dist.root_cause_zh === "string" ? dist.root_cause_zh : "",
      ...(typeof dist.pr_fix_mechanism_zh === "string" && dist.pr_fix_mechanism_zh
        ? { prFixMechanismZh: dist.pr_fix_mechanism_zh }
        : {}),
      sameCodeTrapZh: typeof dist.same_code_trap_zh === "string" ? dist.same_code_trap_zh : "",
      forensicChainZh,
      rootLineAnalyzerHit,
      cascadeOnlyAnalyzerHit,
      domainAlignedAnalyzerHit,
      rootLineMatchedRuleIds,
      matchedLocalRuleIds: matchedRuleIds,
      domainAlignedRuleIds,
      ...(unrelatedRuleIds.length > 0 ? { unrelatedRuleIds } : {}),
      confirmedFixPrLineage,
      referencedPrLineage,
      vllmMergedPrs,
      ...(vllmMentionedPrs.length > 0 ? { vllmMentionedPrs } : {}),
      gitcodeMentionedMrs,
      gitcodeMergedMrs,
      gitcodeConfirmedFixMrs,
      ...(otherExternalPrs.length > 0 ? { otherExternalPrs } : {}),
      colloquialEval,
    };
  });

  for (const bucket of [...Object.values(byEcosystem), ...Object.values(byFaultDomain)]) {
    bucket.colloquialHitRate = finalizeRate(bucket.colloquialHits, bucket.colloquialTested);
    bucket.domainAlignedTop3Rate = finalizeRate(bucket.domainAlignedTop3Hits, bucket.colloquialTested);
  }

  const unmatchedRawKeysCount = [...rawCorpusMap.keys()].filter((k) => !seenPayloadKeys.has(k)).length;
  const trustedAudited = audited.filter(
    (a) =>
      !a.provenanceConflict &&
      !("duplicateKey" in a && a.duplicateKey) &&
      a.rawSha256Verified === true &&
      a.commitConflictCount === 0 &&
      a.gitVerificationErrorCount === 0,
  );

  const withGitcodeMentionedMr = trustedAudited.filter(
    (a) => a.gitcodeMentionedMrs.length > 0 || a.gitcodeMergedMrs.length > 0,
  ).length;
  const withGitcodeMergedMr = trustedAudited.filter((a) => a.gitcodeMergedMrs.length > 0).length;
  const withGitcodeConfirmedFixMr = trustedAudited.filter((a) => a.gitcodeConfirmedFixMrs.length > 0).length;

  const distinctGitcodeMergedMrs = new Set(
    trustedAudited.flatMap((a) => a.gitcodeMergedMrs.map((m) => m.ref.toLowerCase())),
  );
  const distinctGitcodeConfirmedFixMrs = new Set(
    trustedAudited.flatMap((a) => a.gitcodeConfirmedFixMrs.map((m) => m.ref.toLowerCase())),
  );

  return {
    schemaVersion: 3,
    verifiedAt: new Date().toISOString(),
    inputPath: meta.inputPath,
    rawCorpusPath: meta.rawCorpusPath,
    miningSummaryDigestVerified,
    gpuUsed: payload.gpu,
    vramGiB: payload.vramGiB,
    teacherModel: payload.teacherModel,
    ...(payload.teacherModelsUsed ? { teacherModelsUsed: payload.teacherModelsUsed } : {}),
    ...(payload.backend ? { backend: payload.backend } : {}),
    ...(payload.dtype ? { dtype: payload.dtype } : {}),
    totalMinedAndDistilled: payload.items.length,
    declaredTotalIssues: payload.totalIssues,
    uniquePayloadKeysCount: seenPayloadKeys.size,
    duplicateKeyCount,
    unmatchedRawKeysCount,
    unparsedItemsCount,
    rawMatchedCount,
    missingRawCount,
    shaMismatchCount,
    provenanceConflictCount,
    commitConflictCount,
    gitVerificationErrorCount,
    claimedRootVerificationMismatchCount,
    rawCorpusMatchedCount: rawMatchedCount,
    rawSha256VerifiedCount,
    rawSha256MismatchCount: shaMismatchCount,
    verbatimRootSubstringVerified: deterministicVerbatimCount,
    titleLeakRejectedCount,
    modelTitleLeakRejectedCount,
    verbatimCascadeLinesVerified,
    unverifiedCascadeLinesCount,
    ungroundedErrorCodesCount,
    forensicChainPresentCount,
    rootLineAnalyzerHitCount,
    cascadeOnlyAnalyzerHitCount,
    withVerbatimDiagnosticRuleHit: verifiedDiagnoseHitCount,
    domainAlignedDiagnosticRuleHitCount,
    unverifiedGeneratedRuleHits,
    colloquialQueriesTested: colloquialTotal,
    nonEmptyRecallCount,
    domainAlignedTop3Count,
    colloquialQueriesWithWikiTop3: nonEmptyRecallCount,
    colloquialWikiTop3HitRate: finalizeRate(nonEmptyRecallCount, colloquialTotal),
    domainAlignedTop3Rate: finalizeRate(domainAlignedTop3Count, colloquialTotal),
    withConfirmedFixPrLineageVerified: trustedAudited.filter((a) => a.confirmedFixPrLineage.length > 0)
      .length,
    withReferencedPrLineageVerified: trustedAudited.filter(
      (a) => a.confirmedFixPrLineage.length > 0 || a.referencedPrLineage.length > 0,
    ).length,
    withVllmMergedPrProvenance: trustedAudited.filter((a) => a.vllmMergedPrs.length > 0).length,
    withGitcodeMentionedMr,
    withGitcodeMergedMr,
    withGitcodeConfirmedFixMr,
    withGitcodeMergedMrProvenance: withGitcodeMergedMr,
    byEcosystem,
    byFaultDomain: { ...byFaultDomain },
    byRepo: { ...byRepo },
    diagnosticRuleHitCounts: { ...diagnosticRuleHitCounts },
    prMrLineageSummary: {
      ascendConfirmedPrs: trustedAudited.reduce((sum, a) => sum + a.confirmedFixPrLineage.length, 0),
      ascendReferencedPrs: trustedAudited.reduce((sum, a) => sum + a.referencedPrLineage.length, 0),
      ascendPinCoverage,
      vllmMergedPrsCount: trustedAudited.reduce((sum, a) => sum + a.vllmMergedPrs.length, 0),
      vllmMentionedPrsCount: trustedAudited.reduce((sum, a) => sum + (a.vllmMentionedPrs?.length ?? 0), 0),
      otherExternalPrsCount: trustedAudited.reduce((sum, a) => sum + (a.otherExternalPrs?.length ?? 0), 0),
      gitcodeMentionedMrsCount: trustedAudited.reduce(
        (sum, a) => sum + a.gitcodeMentionedMrs.length + a.gitcodeMergedMrs.length,
        0,
      ),
      gitcodeMergedMrsCount: trustedAudited.reduce((sum, a) => sum + a.gitcodeMergedMrs.length, 0),
      distinctGitcodeMergedMrsCount: distinctGitcodeMergedMrs.size,
      gitcodeConfirmedFixMrsCount: trustedAudited.reduce(
        (sum, a) => sum + a.gitcodeConfirmedFixMrs.length,
        0,
      ),
      distinctGitcodeConfirmedFixMrsCount: distinctGitcodeConfirmedFixMrs.size,
    },
    auditedItems: audited,
  };
}

export function resolveDefaultRawPath(inPath: string): string | null {
  const dir = dirname(inPath);
  const name = basename(inPath).toLowerCase();
  if (name === "distilled_ascend_dual.json" || name.includes("dual")) {
    const dualRaw = resolve(dir, "dual_raw_corpus.jsonl");
    return existsSync(dualRaw) ? dualRaw : null;
  }
  const stem = name.replace(/\.json$/i, "");
  const legacyCandidates = [
    `${stem.replace(/^distilled_/, "raw_")}.jsonl`,
    `${stem}_raw.jsonl`,
    "raw_ascend_github.jsonl",
    "github_raw_corpus.jsonl",
    "raw_ascend_issues.jsonl",
    "raw_ascend_sample.jsonl",
    "ascend_github_raw.jsonl",
  ];
  for (const cand of legacyCandidates) {
    const p = resolve(dir, cand);
    if (existsSync(p)) return p;
  }
  return null;
}

function parseCliArgs(argv: readonly string[]): {
  input?: string;
  raw?: string;
  rawProvided?: boolean;
  out?: string;
  root?: string;
  allowPartial?: boolean;
} {
  const opts: {
    input?: string;
    raw?: string;
    rawProvided?: boolean;
    out?: string;
    root?: string;
    allowPartial?: boolean;
  } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if ((arg === "--input" || arg === "--distilled") && i + 1 < argv.length) {
      opts.input = argv[++i];
    } else if (arg.startsWith("--input=")) {
      opts.input = arg.slice("--input=".length);
    } else if (arg.startsWith("--distilled=")) {
      opts.input = arg.slice("--distilled=".length);
    } else if (arg === "--raw") {
      opts.rawProvided = true;
      opts.raw = i + 1 < argv.length ? argv[++i] : "";
    } else if (arg.startsWith("--raw=")) {
      opts.rawProvided = true;
      opts.raw = arg.slice("--raw=".length);
    } else if (arg === "--out" && i + 1 < argv.length) {
      opts.out = argv[++i];
    } else if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
    } else if (arg === "--root" && i + 1 < argv.length) {
      opts.root = argv[++i];
    } else if (arg.startsWith("--root=")) {
      opts.root = arg.slice("--root=".length);
    } else if (arg === "--allow-partial") {
      opts.allowPartial = true;
    }
  }
  return opts;
}

export function evaluateAuditGate(
  payload: DistilledPayload,
  report: ReturnType<typeof verifyDistilledPayload>,
  rawCorpusPath: string | null,
): string[] {
  const failures: string[] = [];
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    failures.push("empty_items: payload.items is empty");
  }
  if (
    typeof payload.totalIssues !== "number" ||
    !Number.isInteger(payload.totalIssues) ||
    payload.totalIssues !== payload.items.length
  ) {
    failures.push(
      `total_issues_mismatch: declared totalIssues=${String(payload.totalIssues)} !== items.length=${payload.items.length}`,
    );
  }
  if (
    payload.expectedTotalIssues !== undefined &&
    (typeof payload.expectedTotalIssues !== "number" ||
      !Number.isInteger(payload.expectedTotalIssues) ||
      payload.expectedTotalIssues !== payload.items.length)
  ) {
    failures.push(
      `expected_total_issues_mismatch: declared expectedTotalIssues=${String(payload.expectedTotalIssues)} !== items.length=${payload.items.length}`,
    );
  }
  const requireCurrentSchema =
    Boolean(payload.normalizerVersion) || (rawCorpusPath !== null && existsSync(rawCorpusPath));
  if (payload.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    failures.push(
      `invalid_schema_version: declared schemaVersion=${String(payload.schemaVersion)} !== ${CURRENT_SCHEMA_VERSION}`,
    );
  }
  if (
    (payload.normalizerVersion !== undefined || requireCurrentSchema) &&
    payload.normalizerVersion !== CURRENT_NORMALIZER_VERSION
  ) {
    failures.push(
      `invalid_normalizer_version: declared normalizerVersion=${String(payload.normalizerVersion)} !== ${CURRENT_NORMALIZER_VERSION}`,
    );
  }
  if (
    (payload.maxNewTokens !== undefined || requireCurrentSchema) &&
    (typeof payload.maxNewTokens !== "number" ||
      !Number.isInteger(payload.maxNewTokens) ||
      payload.maxNewTokens < 64 ||
      payload.maxNewTokens > 7168)
  ) {
    failures.push(`invalid_max_new_tokens: declared maxNewTokens=${String(payload.maxNewTokens)}`);
  }
  const headerTeacher = typeof payload.teacherModel === "string" ? payload.teacherModel.trim() : "";
  const headerBackend = typeof payload.backend === "string" ? payload.backend.trim() : "";
  const headerDtype = typeof payload.dtype === "string" ? payload.dtype.trim() : "";
  const rowTeachers = [
    ...new Set(
      payload.items
        .map((it) => (typeof it.teacher_model === "string" ? it.teacher_model.trim() : ""))
        .filter(Boolean),
    ),
  ].sort();
  const rowBackends = [
    ...new Set(
      payload.items
        .map((it) => (typeof it.teacher_backend === "string" ? it.teacher_backend.trim() : ""))
        .filter(Boolean),
    ),
  ].sort();
  const rowDtypes = [
    ...new Set(
      payload.items
        .map((it) => (typeof it.teacher_dtype === "string" ? it.teacher_dtype.trim() : ""))
        .filter(Boolean),
    ),
  ].sort();
  const rowConfigTuples = new Set(
    payload.items
      .map((it) => {
        const m = typeof it.teacher_model === "string" ? it.teacher_model.trim() : "";
        const b = typeof it.teacher_backend === "string" ? it.teacher_backend.trim() : "";
        const d = typeof it.teacher_dtype === "string" ? it.teacher_dtype.trim() : "";
        return m && b && d ? `${m}\0${b}\0${d}` : "";
      })
      .filter(Boolean),
  );
  if (rowTeachers.length > 0) {
    if (!headerTeacher || !rowTeachers.includes(headerTeacher)) {
      failures.push(
        `teacher_model_mismatch: header teacherModel=${JSON.stringify(headerTeacher)} not in row teachers [${rowTeachers.join(", ")}]`,
      );
    }
  } else if (requireCurrentSchema && payload.items.length > 0) {
    failures.push("teacher_model_mismatch: missing per-row teacher_model metadata on current-schema payload");
  }
  if (rowBackends.length > 0) {
    if (!headerBackend || !rowBackends.includes(headerBackend)) {
      failures.push(
        `teacher_backend_mismatch: header backend=${JSON.stringify(headerBackend)} not in row backends [${rowBackends.join(", ")}]`,
      );
    }
  } else if (requireCurrentSchema && payload.items.length > 0) {
    failures.push(
      "teacher_backend_mismatch: missing per-row teacher_backend metadata on current-schema payload",
    );
  }
  if (rowDtypes.length > 0) {
    if (!headerDtype || !rowDtypes.includes(headerDtype)) {
      failures.push(
        `teacher_dtype_mismatch: header dtype=${JSON.stringify(headerDtype)} not in row dtypes [${rowDtypes.join(", ")}]`,
      );
    }
  } else if (requireCurrentSchema && payload.items.length > 0) {
    failures.push("teacher_dtype_mismatch: missing per-row teacher_dtype metadata on current-schema payload");
  }
  if (
    rowConfigTuples.size > 0 &&
    !rowConfigTuples.has(`${headerTeacher}\0${headerBackend}\0${headerDtype}`)
  ) {
    failures.push(
      `teacher_config_tuple_mismatch: header (${headerTeacher}, ${headerBackend}, ${headerDtype}) matches no row configuration`,
    );
  }
  // On current-schema payloads, NEVER fall back to headerTeacher when row teachers are missing!
  const effectiveTeachers = requireCurrentSchema
    ? rowTeachers
    : rowTeachers.length > 0
      ? rowTeachers
      : headerTeacher
        ? [headerTeacher]
        : [];
  if (payload.teacherModelsUsed !== undefined || (requireCurrentSchema && payload.items.length > 0)) {
    const validTeacherArr =
      Array.isArray(payload.teacherModelsUsed) &&
      payload.teacherModelsUsed.every((s) => typeof s === "string" && s.trim().length > 0);
    const declaredUsed = validTeacherArr
      ? [...new Set((payload.teacherModelsUsed as string[]).map((s) => s.trim()))].sort()
      : null;
    if (
      !declaredUsed ||
      declaredUsed.length !== effectiveTeachers.length ||
      declaredUsed.some((t, i) => t !== effectiveTeachers[i])
    ) {
      failures.push(
        `teacher_models_used_mismatch: declared=${JSON.stringify(payload.teacherModelsUsed)} !== actual=${JSON.stringify(effectiveTeachers)}`,
      );
    }
  }
  const invalidFailedCount =
    payload.failedCount !== undefined &&
    (typeof payload.failedCount !== "number" ||
      !Number.isInteger(payload.failedCount) ||
      payload.failedCount !== 0);
  if (
    (payload.status !== undefined && payload.status !== "ok") ||
    invalidFailedCount ||
    report.unparsedItemsCount > 0
  ) {
    failures.push(
      `producer_incomplete_or_failed: status=${String(payload.status ?? "unset")}, failedCount=${String(payload.failedCount ?? 0)}, unparsedItems=${report.unparsedItemsCount}`,
    );
  }
  if (report.duplicateKeyCount > 0) {
    failures.push(`duplicate_payload_keys: ${report.duplicateKeyCount} duplicate item key(s) in payload`);
  }
  if (rawCorpusPath === null) {
    failures.push("missing_raw_corpus: raw corpus file not found");
  } else if (!existsSync(rawCorpusPath)) {
    failures.push(`unreadable_raw_corpus: raw corpus path does not exist on disk (${rawCorpusPath})`);
  }
  if (rawCorpusPath !== null && report.unmatchedRawKeysCount > 0) {
    failures.push(
      `incomplete_corpus_coverage: ${report.unmatchedRawKeysCount} raw corpus key(s) omitted from distilled payload`,
    );
  }
  if (report.miningSummaryDigestVerified === false) {
    failures.push(
      "mining_summary_digest_mismatch: raw corpus SHA256 or item count disagrees with dual_mining_summary.json",
    );
  } else if (
    rawCorpusPath !== null &&
    existsSync(rawCorpusPath) &&
    report.miningSummaryDigestVerified !== true
  ) {
    failures.push(
      "missing_mining_summary: dual_mining_summary.json is missing or unreadable next to raw corpus",
    );
  }
  if (report.missingRawCount > 0) {
    failures.push(`missing_raw_rows: ${report.missingRawCount} item(s) missing from raw corpus`);
  }
  if (report.shaMismatchCount > 0) {
    failures.push(`sha_mismatch: ${report.shaMismatchCount} item(s) failed raw_sha256 verification`);
  }
  if (report.provenanceConflictCount > 0) {
    failures.push(
      `provenance_conflict: ${report.provenanceConflictCount} item(s) have raw/distilled provenance conflicts`,
    );
  }
  if (report.commitConflictCount > 0) {
    failures.push(
      `commit_conflict: ${report.commitConflictCount} linked PR commit(s) conflict with verified local git history`,
    );
  }
  if (report.gitVerificationErrorCount > 0) {
    failures.push(
      `git_verification_error: ${report.gitVerificationErrorCount} local git lineage lookup(s) failed on a present clone`,
    );
  }
  if (report.claimedRootVerificationMismatchCount > 0) {
    failures.push(
      `claimed_root_verification_mismatch: ${report.claimedRootVerificationMismatchCount} item(s) contradicted recomputed verbatim root verification`,
    );
  }
  if (
    typeof payload.verbatimVerifiedCount !== "number" ||
    !Number.isInteger(payload.verbatimVerifiedCount) ||
    payload.verbatimVerifiedCount < 0 ||
    (report.missingRawCount === 0 && payload.verbatimVerifiedCount !== report.verbatimRootSubstringVerified)
  ) {
    failures.push(
      `verbatim_verified_count_mismatch: declared verbatimVerifiedCount=${String(payload.verbatimVerifiedCount)} !== recomputed=${report.verbatimRootSubstringVerified}`,
    );
  }
  const actualModelVerified = report.auditedItems.filter(
    (a) => a.verbatimRootVerified && a.verbatimRootSource === "model",
  ).length;
  const actualFallbackVerified = report.auditedItems.filter(
    (a) => a.verbatimRootVerified && a.verbatimRootSource === "fallback_log_extractor",
  ).length;
  const checkSummaryCount = (name: string, declared: unknown, actual: number, enforceExact: boolean) => {
    if (declared === undefined && !requireCurrentSchema) return;
    const validInt = typeof declared === "number" && Number.isInteger(declared) && declared >= 0;
    if (!validInt || (enforceExact && declared !== actual)) {
      failures.push(
        `producer_summary_count_mismatch: declared ${name}=${String(declared)} !== recomputed=${actual}`,
      );
    }
  };
  checkSummaryCount(
    "modelVerbatimVerifiedCount",
    payload.modelVerbatimVerifiedCount,
    actualModelVerified,
    report.missingRawCount === 0,
  );
  checkSummaryCount(
    "fallbackVerbatimVerifiedCount",
    payload.fallbackVerbatimVerifiedCount,
    actualFallbackVerified,
    report.missingRawCount === 0,
  );
  checkSummaryCount(
    "forensicChainPresentCount",
    payload.forensicChainPresentCount,
    report.forensicChainPresentCount,
    true,
  );
  if (
    payload.familyCount !== undefined ||
    payload.families !== undefined ||
    (requireCurrentSchema && payload.items.length > 0)
  ) {
    const fams = payload.families;
    if (
      !Array.isArray(fams) ||
      typeof payload.familyCount !== "number" ||
      !Number.isInteger(payload.familyCount) ||
      payload.familyCount !== fams.length ||
      (payload.items.length > 0 && fams.length === 0)
    ) {
      failures.push(
        `producer_family_contradiction: declared familyCount=${String(payload.familyCount)} vs families.length=${Array.isArray(fams) ? fams.length : "non-array"}`,
      );
    } else if (fams.length > 0) {
      const famItemSum = fams.reduce(
        (acc, f) => acc + (typeof f?.count === "number" && Number.isInteger(f.count) ? f.count : -1000000),
        0,
      );
      const famVerifiedSum = fams.reduce(
        (acc, f) =>
          acc +
          (typeof f?.verifiedRootCount === "number" && Number.isInteger(f.verifiedRootCount)
            ? f.verifiedRootCount
            : -1000000),
        0,
      );
      if (
        famItemSum !== payload.items.length ||
        (report.missingRawCount === 0 && famVerifiedSum !== report.verbatimRootSubstringVerified)
      ) {
        failures.push(
          `producer_family_totals_mismatch: family item sum=${famItemSum} (expected ${payload.items.length}), family verified sum=${famVerifiedSum} (expected ${report.verbatimRootSubstringVerified})`,
        );
      }

      // Reconcile per-family memberKeys partition, summary counts, and representative evidence against audited items!
      const auditedByKey = new Map(report.auditedItems.map((a) => [a.key, a]));
      const itemByKey = new Map(payload.items.map((it) => [it.key, it]));
      const seenFamKeys = new Set<string>();
      const requireFamilyMembership =
        requireCurrentSchema ||
        fams.some((f) => f?.memberKeys !== undefined || f?.representatives !== undefined);
      let familyDetailErrors = 0;
      const canonicalRefIdentity = (refVal: unknown, eco: Ecosystem, repo: string): string => {
        if (typeof refVal !== "string") return "";
        const trimmed = refVal.trim();
        if (!trimmed) return "";
        const parsed = parseSinglePrOrMrRef(trimmed, eco, repo);
        if (parsed) return `${parsed.ecosystem}:${parsed.repo.toLowerCase()}#${parsed.number}`;
        return trimmed.toLowerCase();
      };
      const expectedVerifiedRefs = (a: (typeof report.auditedItems)[number]): string[] => {
        const refs = new Set<string>();
        for (const l of a.confirmedFixPrLineage) {
          refs.add(canonicalRefIdentity(l.ref, a.ecosystem, a.repo));
        }
        for (const p of a.vllmMergedPrs) {
          if (p.confirmed) refs.add(canonicalRefIdentity(p.ref, a.ecosystem, a.repo));
        }
        for (const m of a.gitcodeConfirmedFixMrs) {
          refs.add(canonicalRefIdentity(m.ref, a.ecosystem, a.repo));
        }
        for (const o of a.otherExternalPrs ?? []) {
          if (o.confirmed) refs.add(canonicalRefIdentity(o.ref, a.ecosystem, a.repo));
        }
        refs.delete("");
        return [...refs].sort();
      };
      const computeExpectedFamilySkeletons = (
        items: readonly DistilledIssueItem[],
        minFamilies = 20,
        maxFamilies = 25,
      ): Array<{
        familyId: string;
        faultDomain: string;
        primarySymbol: string;
        mergedSymbols: string[];
        memberKeys: Set<string>;
      }> => {
        interface Bucket {
          domain: string;
          sym: string;
          members: DistilledIssueItem[];
        }
        const keyOf = (domain: string, sym: string) => `${domain}\0${sym}`;
        let grouped = new Map<string, Bucket>();
        for (const it of items) {
          const d =
            it.distilled && typeof it.distilled === "object" && !Array.isArray(it.distilled)
              ? it.distilled
              : {};
          const domain = typeof d.fault_domain === "string" && d.fault_domain ? d.fault_domain : "other";
          const sym = inferPrimarySymbol(it);
          const k = keyOf(domain, sym);
          const existing = grouped.get(k);
          if (existing) existing.members.push(it);
          else grouped.set(k, { domain, sym, members: [it] });
        }
        const clusterRank = (b: Bucket): [number, number, number] => {
          let withDiff = 0;
          let confirmed = 0;
          for (const m of b.members) {
            if ((m.pr_diff_lines ?? 0) > 0) withDiff += 1;
            const d =
              m.distilled && typeof m.distilled === "object" && !Array.isArray(m.distilled)
                ? m.distilled
                : {};
            if (parseStrictBool(d.root_cause_confirmed)) confirmed += 1;
          }
          return [b.members.length, withDiff, confirmed];
        };
        const compareRankDesc = (a: [string, Bucket], b: [string, Bucket]): number => {
          const ra = clusterRank(a[1]);
          const rb = clusterRank(b[1]);
          if (rb[0] !== ra[0]) return rb[0] - ra[0];
          if (rb[1] !== ra[1]) return rb[1] - ra[1];
          return rb[2] - ra[2];
        };

        while (grouped.size < minFamilies) {
          const candidates = [...grouped.entries()]
            .filter(([, b]) => b.members.length >= 8 && new Set(b.members.map((m) => m.repo ?? "")).size >= 2)
            .sort((a, b) => b[1].members.length - a[1].members.length);
          let splitDone = false;
          for (const [k, b] of candidates) {
            const byRepo = new Map<string, DistilledIssueItem[]>();
            for (const m of b.members) {
              const r = String(m.repo || "other");
              const arr = byRepo.get(r);
              if (arr) arr.push(m);
              else byRepo.set(r, [m]);
            }
            const topRepos = [...byRepo.entries()].sort((a, c) => c[1].length - a[1].length);
            if (topRepos.length < 2) continue;
            const [r0Name, r0Items] = topRepos[0]!;
            if (r0Items.length < 3 || b.members.length - r0Items.length < 3) continue;
            const shortR0 = r0Name.split("/").pop() ?? r0Name;
            const symLeft = `${b.sym} (${shortR0})`;
            const symRight = `${b.sym} (ecosystem)`;
            const kLeft = keyOf(b.domain, symLeft);
            const kRight = keyOf(b.domain, symRight);
            if (grouped.has(kLeft) || grouped.has(kRight)) continue;
            grouped.delete(k);
            grouped.set(kLeft, { domain: b.domain, sym: symLeft, members: r0Items });
            grouped.set(kRight, {
              domain: b.domain,
              sym: symRight,
              members: topRepos.slice(1).flatMap(([, lst]) => lst),
            });
            splitDone = true;
            break;
          }
          if (!splitDone) break;
        }

        const mergedSymbolsByKey = new Map<string, string[]>();
        if (grouped.size > maxFamilies) {
          const ordered = [...grouped.entries()].sort(compareRankDesc);
          const keptKeys: string[] = [];
          const seenDomains = new Set<string>();
          for (const [k, b] of ordered) {
            if (!seenDomains.has(b.domain)) {
              seenDomains.add(b.domain);
              keptKeys.push(k);
            }
          }
          for (const [k] of ordered) {
            if (keptKeys.length >= maxFamilies) break;
            if (!keptKeys.includes(k)) keptKeys.push(k);
          }
          const keptSet = new Set(keptKeys);
          const mergedGroups = new Map<string, Bucket>();
          for (const k of keptKeys) {
            const orig = grouped.get(k)!;
            mergedGroups.set(k, { domain: orig.domain, sym: orig.sym, members: [...orig.members] });
          }
          const domainPrimary = new Map<string, string>();
          for (const k of keptKeys) {
            const dom = grouped.get(k)!.domain;
            if (!domainPrimary.has(dom)) domainPrimary.set(dom, k);
          }
          for (const [k, b] of ordered) {
            if (keptSet.has(k)) continue;
            const targetKey = domainPrimary.get(b.domain) ?? keptKeys[0]!;
            const targetBucket = mergedGroups.get(targetKey)!;
            targetBucket.members.push(...b.members);
            if (b.sym !== targetBucket.sym) {
              const list = mergedSymbolsByKey.get(targetKey) ?? [];
              if (!list.includes(b.sym)) list.push(b.sym);
              mergedSymbolsByKey.set(targetKey, list);
            }
          }
          grouped = mergedGroups;
        }

        const finalOrdered = [...grouped.entries()].sort(compareRankDesc);
        return finalOrdered.map(([k, b], idx) => ({
          familyId: `FAM-${String(idx + 1).padStart(2, "0")}`,
          faultDomain: b.domain,
          primarySymbol: b.sym,
          mergedSymbols: mergedSymbolsByKey.get(k) ?? [],
          memberKeys: new Set(b.members.map((m) => m.key)),
        }));
      };

      if (requireFamilyMembership) {
        const expectedSkeletons =
          requireCurrentSchema && report.duplicateKeyCount === 0
            ? computeExpectedFamilySkeletons(payload.items)
            : null;
        if (expectedSkeletons && fams.length !== expectedSkeletons.length) {
          familyDetailErrors += 1;
        }
        const seenFamilyIds = new Set<string>();
        for (let famIdx = 0; famIdx < fams.length; famIdx++) {
          const f = fams[famIdx]!;
          const members = f?.memberKeys;
          if (!Array.isArray(members) || members.length !== f?.count) {
            familyDetailErrors += 1;
            continue;
          }
          const expectedFamId = `FAM-${String(famIdx + 1).padStart(2, "0")}`;
          if (f.familyId !== undefined || requireCurrentSchema) {
            if (
              typeof f.familyId !== "string" ||
              !f.familyId ||
              f.familyId !== f.familyId.trim() ||
              seenFamilyIds.has(f.familyId) ||
              (requireCurrentSchema && f.familyId !== expectedFamId)
            ) {
              familyDetailErrors += 1;
            } else {
              seenFamilyIds.add(f.familyId);
            }
          }
          const famMemberSet = new Set<string>();
          let actualFamVerified = 0;
          let actualFamConfirmedRoot = 0;
          let actualFamWithPrDiff = 0;
          const memberDomains = new Set<string>();
          const memberSymbols = new Set<string>();
          const memberRepoShorts = new Set<string>();
          const memberSubsysCounts = new Map<string, number>();
          const memberEcoCounts = new Map<string, number>();
          const memberRepoCounts = new Map<string, number>();
          const memberCodeCounts = new Map<string, number>();
          const memberTraps = new Set<string>();
          const memberQueries = new Set<string>();
          for (const mk of members) {
            if (typeof mk !== "string" || !auditedByKey.has(mk) || seenFamKeys.has(mk)) {
              familyDetailErrors += 1;
              continue;
            }
            seenFamKeys.add(mk);
            famMemberSet.add(mk);
            const audMember = auditedByKey.get(mk)!;
            const rawMember = itemByKey.get(mk);
            if (audMember.verbatimRootVerified) actualFamVerified += 1;
            if (audMember.rootCauseConfirmed) actualFamConfirmedRoot += 1;
            if ((rawMember?.pr_diff_lines ?? 0) > 0) actualFamWithPrDiff += 1;
            memberDomains.add(audMember.faultDomain);
            if (rawMember) memberSymbols.add(inferPrimarySymbol(rawMember));
            memberRepoShorts.add(audMember.repo.split("/").pop() ?? audMember.repo);
            memberSubsysCounts.set(
              audMember.subsystem,
              (memberSubsysCounts.get(audMember.subsystem) ?? 0) + 1,
            );
            memberEcoCounts.set(audMember.ecosystem, (memberEcoCounts.get(audMember.ecosystem) ?? 0) + 1);
            memberRepoCounts.set(audMember.repo, (memberRepoCounts.get(audMember.repo) ?? 0) + 1);
            const codeList =
              report.missingRawCount === 0 && report.provenanceConflictCount === 0
                ? audMember.errorCodes
                : coerceStringList(rawMember?.distilled?.error_codes);
            for (const c of codeList) {
              memberCodeCounts.set(c, (memberCodeCounts.get(c) ?? 0) + 1);
            }
            if (audMember.sameCodeTrapZh.trim()) memberTraps.add(audMember.sameCodeTrapZh.trim());
            for (const q of coerceStringList(rawMember?.distilled?.colloquial_queries_zh)) {
              memberQueries.add(q);
            }
          }
          if (expectedSkeletons && famIdx < expectedSkeletons.length) {
            const expSkel = expectedSkeletons[famIdx]!;
            const sameMembers =
              famMemberSet.size === expSkel.memberKeys.size &&
              [...famMemberSet].every((k) => expSkel.memberKeys.has(k));
            const expMerged = expSkel.mergedSymbols;
            const mergedMatches =
              expMerged.length === 0
                ? f.mergedSymbols === undefined
                : Array.isArray(f.mergedSymbols) &&
                  f.mergedSymbols.length === expMerged.length &&
                  f.mergedSymbols.every((s, idx) => s === expMerged[idx]);
            if (
              f.familyId !== expSkel.familyId ||
              f.faultDomain !== expSkel.faultDomain ||
              f.primarySymbol !== expSkel.primarySymbol ||
              !mergedMatches ||
              !sameMembers
            ) {
              familyDetailErrors += 1;
            }
          } else if (f.primarySymbol !== undefined || requireCurrentSchema) {
            const rawPrim = typeof f.primarySymbol === "string" ? f.primarySymbol : "";
            const splitM = /^(.+?) \(([^()]+)\)$/.exec(rawPrim);
            const baseSym = splitM ? splitM[1]! : rawPrim;
            const suffixOk = !splitM || splitM[2] === "ecosystem" || memberRepoShorts.has(splitM[2]!);
            const mergedSymsRaw = f.mergedSymbols;
            let mergedSymsValid = true;
            const mergedSymSet = new Set<string>();
            if (mergedSymsRaw !== undefined) {
              if (
                !Array.isArray(mergedSymsRaw) ||
                mergedSymsRaw.length === 0 ||
                !mergedSymsRaw.every((s) => typeof s === "string" && s.length > 0 && s === s.trim())
              ) {
                mergedSymsValid = false;
              } else {
                const seenMergedRaw = new Set<string>();
                for (const s of mergedSymsRaw as string[]) {
                  const mSplit = /^(.+?) \(([^()]+)\)$/.exec(s);
                  const mBase = mSplit ? mSplit[1]! : s;
                  const mSuffixOk = !mSplit || mSplit[2] === "ecosystem" || memberRepoShorts.has(mSplit[2]!);
                  if (seenMergedRaw.has(s) || !mSuffixOk || !memberSymbols.has(mBase)) {
                    mergedSymsValid = false;
                  }
                  seenMergedRaw.add(s);
                  mergedSymSet.add(mBase);
                }
              }
            }
            const allowedSyms = new Set<string>([baseSym, ...mergedSymSet]);
            const allMembersCovered = [...memberSymbols].every((s) => allowedSyms.has(s));
            if (
              !rawPrim ||
              rawPrim !== rawPrim.trim() ||
              !baseSym ||
              !suffixOk ||
              !mergedSymsValid ||
              !memberSymbols.has(baseSym) ||
              !allMembersCovered
            ) {
              familyDetailErrors += 1;
            }
          }
          if (report.missingRawCount === 0 && f.verifiedRootCount !== actualFamVerified) {
            familyDetailErrors += 1;
          }
          if (f.confirmedRootCauseCount !== undefined || requireCurrentSchema) {
            if (
              typeof f.confirmedRootCauseCount !== "number" ||
              !Number.isInteger(f.confirmedRootCauseCount) ||
              f.confirmedRootCauseCount < 0 ||
              (report.missingRawCount === 0 && f.confirmedRootCauseCount !== actualFamConfirmedRoot)
            ) {
              familyDetailErrors += 1;
            }
          }
          if (f.withPrDiffCount !== undefined || requireCurrentSchema) {
            if (
              typeof f.withPrDiffCount !== "number" ||
              !Number.isInteger(f.withPrDiffCount) ||
              f.withPrDiffCount < 0 ||
              f.withPrDiffCount !== actualFamWithPrDiff
            ) {
              familyDetailErrors += 1;
            }
          }
          if (f.faultDomain !== undefined || requireCurrentSchema) {
            if (
              typeof f.faultDomain !== "string" ||
              !Object.hasOwn(FAULT_DOMAIN_EXPECTED_PAGES, f.faultDomain) ||
              memberDomains.size !== 1 ||
              !memberDomains.has(f.faultDomain)
            ) {
              familyDetailErrors += 1;
            }
          }
          if (f.dominantSubsystem !== undefined || requireCurrentSchema) {
            const maxSubsys = Math.max(0, ...memberSubsysCounts.values());
            if (
              typeof f.dominantSubsystem !== "string" ||
              memberSubsysCounts.get(f.dominantSubsystem) !== maxSubsys
            ) {
              familyDetailErrors += 1;
            }
          }
          if (f.ecosystems !== undefined || requireCurrentSchema) {
            const ecoObj =
              f.ecosystems && typeof f.ecosystems === "object" && !Array.isArray(f.ecosystems)
                ? (f.ecosystems as Record<string, unknown>)
                : null;
            if (!ecoObj || Object.keys(ecoObj).length !== memberEcoCounts.size) {
              familyDetailErrors += 1;
            } else {
              for (const [k, v] of Object.entries(ecoObj)) {
                if (typeof v !== "number" || !Number.isInteger(v) || memberEcoCounts.get(k) !== v) {
                  familyDetailErrors += 1;
                }
              }
            }
          }
          if (f.repos !== undefined || requireCurrentSchema) {
            const repoObj =
              f.repos && typeof f.repos === "object" && !Array.isArray(f.repos)
                ? (f.repos as Record<string, unknown>)
                : null;
            const expectedRepoLen = Math.min(6, memberRepoCounts.size);
            if (!repoObj || Object.keys(repoObj).length !== expectedRepoLen) {
              familyDetailErrors += 1;
            } else {
              let minIncludedRepo = Number.POSITIVE_INFINITY;
              const includedRepos = new Set<string>();
              for (const [k, v] of Object.entries(repoObj)) {
                if (typeof v !== "number" || !Number.isInteger(v) || memberRepoCounts.get(k) !== v) {
                  familyDetailErrors += 1;
                } else {
                  includedRepos.add(k);
                  minIncludedRepo = Math.min(minIncludedRepo, v);
                }
              }
              for (const [rk, rv] of memberRepoCounts) {
                if (!includedRepos.has(rk) && rv > minIncludedRepo) {
                  familyDetailErrors += 1;
                }
              }
            }
          }
          if (f.topErrorCodes !== undefined || requireCurrentSchema) {
            const codes = f.topErrorCodes;
            const expectedCodeLen = Math.min(8, memberCodeCounts.size);
            if (
              !Array.isArray(codes) ||
              codes.length !== expectedCodeLen ||
              !codes.every((c) => typeof c === "string" && c.trim().length > 0)
            ) {
              familyDetailErrors += 1;
            } else {
              const codeArr = codes as string[];
              const codeSet = new Set(codeArr);
              if (codeSet.size !== codeArr.length) {
                familyDetailErrors += 1;
              } else {
                let minIncludedCode = Number.POSITIVE_INFINITY;
                let prevCount = Number.POSITIVE_INFINITY;
                for (const c of codeArr) {
                  const cnt = memberCodeCounts.get(c);
                  if (cnt === undefined || cnt > prevCount) {
                    familyDetailErrors += 1;
                  } else {
                    prevCount = cnt;
                    minIncludedCode = Math.min(minIncludedCode, cnt);
                  }
                }
                for (const [ck, cv] of memberCodeCounts) {
                  if (!codeSet.has(ck) && cv > minIncludedCode) {
                    familyDetailErrors += 1;
                  }
                }
              }
            }
          }
          if (f.sameCodeTraps !== undefined || requireCurrentSchema) {
            const expTrapLen = Math.min(3, memberTraps.size);
            const trapsArr = Array.isArray(f.sameCodeTraps) ? f.sameCodeTraps : null;
            const trapSet = trapsArr
              ? new Set(trapsArr.filter((t): t is string => typeof t === "string").map((t) => t.trim()))
              : null;
            if (
              !trapsArr ||
              !trapSet ||
              trapsArr.length !== expTrapLen ||
              trapSet.size !== trapsArr.length ||
              !trapsArr.every((t) => typeof t === "string" && memberTraps.has(t.trim()))
            ) {
              familyDetailErrors += 1;
            }
          }
          if (f.colloquialQueries !== undefined || requireCurrentSchema) {
            const expQueryLen = Math.min(5, memberQueries.size);
            const queriesArr = Array.isArray(f.colloquialQueries) ? f.colloquialQueries : null;
            const querySet = queriesArr
              ? new Set(queriesArr.filter((q): q is string => typeof q === "string").map((q) => q.trim()))
              : null;
            if (
              !queriesArr ||
              !querySet ||
              queriesArr.length !== expQueryLen ||
              querySet.size !== queriesArr.length ||
              !queriesArr.every((q) => typeof q === "string" && memberQueries.has(q.trim()))
            ) {
              familyDetailErrors += 1;
            }
          }
          if (
            requireCurrentSchema &&
            (!Array.isArray(f.representatives) || f.representatives.length !== Math.min(4, members.length))
          ) {
            familyDetailErrors += 1;
          }
          if (Array.isArray(f.representatives)) {
            const seenRepKeys = new Set<string>();
            for (const rep of f.representatives) {
              const rk = typeof rep?.key === "string" ? rep.key : "";
              const aud = rk ? auditedByKey.get(rk) : undefined;
              const rawItem = rk ? itemByKey.get(rk) : undefined;
              if (!aud || !famMemberSet.has(rk) || seenRepKeys.has(rk)) {
                familyDetailErrors += 1;
                continue;
              }
              seenRepKeys.add(rk);
              if (
                report.missingRawCount === 0 &&
                (rep.verbatim_root_verified !== undefined || requireCurrentSchema) &&
                rep.verbatim_root_verified !== aud.verbatimRootVerified
              ) {
                familyDetailErrors += 1;
              }
              if (
                report.missingRawCount === 0 &&
                (rep.verbatim_root_line !== undefined || requireCurrentSchema) &&
                (typeof rep.verbatim_root_line !== "string" ||
                  rep.verbatim_root_line.trim() !== aud.verbatimRootLine)
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.title !== undefined || requireCurrentSchema) &&
                (typeof rep.title !== "string" || rep.title.trim() !== aud.title.trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.url !== undefined || requireCurrentSchema) &&
                (typeof rep.url !== "string" || rep.url.trim() !== aud.url.trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.repo !== undefined || requireCurrentSchema) &&
                (typeof rep.repo !== "string" ||
                  rep.repo.trim().toLowerCase() !== aud.repo.trim().toLowerCase())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.forensic_chain_zh !== undefined || requireCurrentSchema) &&
                (typeof rep.forensic_chain_zh !== "string" ||
                  !isValidForensicChain(rep.forensic_chain_zh) ||
                  rep.forensic_chain_zh.trim() !== aud.forensicChainZh)
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.root_cause_zh !== undefined || requireCurrentSchema) &&
                (typeof rep.root_cause_zh !== "string" || rep.root_cause_zh.trim() !== aud.rootCauseZh.trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.pr_fix_mechanism_zh !== undefined || requireCurrentSchema) &&
                (typeof rep.pr_fix_mechanism_zh !== "string" ||
                  rep.pr_fix_mechanism_zh.trim() !== (aud.prFixMechanismZh ?? "").trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.fix_or_workaround_zh !== undefined || requireCurrentSchema) &&
                (typeof rep.fix_or_workaround_zh !== "string" ||
                  rep.fix_or_workaround_zh.trim() !==
                    String(rawItem?.distilled?.fix_or_workaround_zh ?? "").trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.same_code_trap_zh !== undefined || requireCurrentSchema) &&
                (typeof rep.same_code_trap_zh !== "string" ||
                  rep.same_code_trap_zh.trim() !== aud.sameCodeTrapZh.trim())
              ) {
                familyDetailErrors += 1;
              }
              if (
                (rep.thinking_summary !== undefined || requireCurrentSchema) &&
                (typeof rep.thinking_summary !== "string" ||
                  rep.thinking_summary.trim() !== String(rawItem?.thinking_summary ?? "").trim())
              ) {
                familyDetailErrors += 1;
              }
              if (rep.cited_pr_refs !== undefined || requireCurrentSchema) {
                const expectedCited = coerceStringList(rawItem?.distilled?.fix_pr_refs);
                if (
                  !Array.isArray(rep.cited_pr_refs) ||
                  !rep.cited_pr_refs.every((x) => typeof x === "string" && x.trim().length > 0)
                ) {
                  familyDetailErrors += 1;
                } else {
                  const actualCited = (rep.cited_pr_refs as string[]).map((x) => x.trim());
                  if (
                    actualCited.length !== expectedCited.length ||
                    actualCited.some((v, idx) => v !== expectedCited[idx])
                  ) {
                    familyDetailErrors += 1;
                  }
                }
              }
              const expRefs = expectedVerifiedRefs(aud);
              if (
                requireCurrentSchema &&
                (rep.verified_fix_pr_refs === undefined || rep.fix_pr_refs === undefined)
              ) {
                familyDetailErrors += 1;
              }
              for (const field of [rep.verified_fix_pr_refs, rep.fix_pr_refs]) {
                if (field === undefined) continue;
                if (
                  !Array.isArray(field) ||
                  !field.every((x) => typeof x === "string" && x.trim().length > 0)
                ) {
                  familyDetailErrors += 1;
                  continue;
                }
                const normField = [
                  ...new Set(
                    field.map((x) => canonicalRefIdentity(x, aud.ecosystem, aud.repo)).filter(Boolean),
                  ),
                ].sort();
                if (normField.length !== expRefs.length || normField.some((v, idx) => v !== expRefs[idx])) {
                  familyDetailErrors += 1;
                }
              }
            }
          }
        }
        if (seenFamKeys.size !== payload.items.length) {
          familyDetailErrors += 1;
        }
      }
      if (familyDetailErrors > 0) {
        failures.push(
          `producer_family_membership_or_rep_mismatch: ${familyDetailErrors} family member/representative claim contradiction(s)`,
        );
      }
    }
  }
  if (report.titleLeakRejectedCount > 0) {
    failures.push(
      `title_leak: ${report.titleLeakRejectedCount} item(s) leaked issue title as verbatim_root_line`,
    );
  }
  if (report.unverifiedCascadeLinesCount > 0) {
    failures.push(
      `unverified_cascade_lines: ${report.unverifiedCascadeLinesCount} verbatim_cascade_lines entry/entries failed source verification`,
    );
  }
  if (report.ungroundedErrorCodesCount > 0) {
    failures.push(
      `ungrounded_error_codes: ${report.ungroundedErrorCodesCount} declared error_code token(s) not grounded in raw corpus`,
    );
  }
  return failures;
}

function stripWinNamespacePrefix(p: string): string {
  if (process.platform !== "win32") return p;
  if (p.startsWith("\\\\?\\UNC\\")) return `\\\\${p.slice(8)}`;
  if (p.startsWith("\\\\?\\") || p.startsWith("\\\\.\\")) return p.slice(4);
  return p;
}

function canonicalPathForAlias(p: string): string {
  const stripped = stripWinNamespacePrefix(p);
  let real: string | null = null;
  try {
    real = realpathSync.native(stripped);
  } catch {
    try {
      real = resolve(realpathSync.native(dirname(stripped)), basename(stripped));
    } catch {
      real = null;
    }
  }
  const abs = real ?? resolve(stripped);
  const clean = stripWinNamespacePrefix(abs);
  return process.platform === "win32" ? clean.toLowerCase() : clean;
}

export function sameFilePath(a: string, b: string): boolean {
  if (canonicalPathForAlias(a) === canonicalPathForAlias(b)) return true;
  if (existsSync(a) && existsSync(b)) {
    try {
      const sa = statSync(a, { bigint: true });
      const sb = statSync(b, { bigint: true });
      if (sa.dev === sb.dev && sa.ino === sb.ino && sa.ino !== 0n) return true;
    } catch {
      // Ignore stat errors on transient or virtual paths
    }
  }
  return false;
}

function main() {
  const cwd = resolve(".");
  const cli = parseCliArgs(process.argv.slice(2));
  const root = cli.root ? resolve(cwd, cli.root) : cwd;
  const joinPreservingDotDot = (base: string, rel: string): string => {
    if (!/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(rel)) return resolve(base, rel);
    return isAbsolute(rel) ? rel : `${base.replace(/[\\/]+$/, "")}${sep}${rel}`;
  };

  let inPath: string;
  let inArgRaw: string | null = null;
  if (cli.input) {
    inArgRaw = joinPreservingDotDot(cwd, cli.input);
    const lexicalIn = resolve(cwd, cli.input);
    inPath = existsSync(inArgRaw) ? inArgRaw : lexicalIn;
  } else {
    const dualDefault = resolve(root, DEFAULT_DUAL_INPUT);
    const legacyDefault = resolve(root, DEFAULT_LEGACY_INPUT);
    inPath = existsSync(dualDefault) ? dualDefault : legacyDefault;
  }
  if (!existsSync(inPath)) {
    throw new Error(`Missing distilled artifact at ${inPath}`);
  }

  let rawCorpusPath: string | null;
  let rawArgRaw: string | null = null;
  if (cli.rawProvided) {
    if (!cli.raw || !cli.raw.trim()) {
      throw new Error("Explicit --raw path cannot be empty");
    }
    rawArgRaw = joinPreservingDotDot(cwd, cli.raw);
    const lexicalRaw = resolve(cwd, cli.raw);
    const explicitRaw = existsSync(rawArgRaw) ? rawArgRaw : lexicalRaw;
    if (!existsSync(explicitRaw)) {
      throw new Error(`Explicit --raw corpus file does not exist: ${explicitRaw}`);
    }
    rawCorpusPath = explicitRaw;
  } else {
    rawCorpusPath = resolveDefaultRawPath(inPath);
  }

  const outArgRaw = cli.out ? joinPreservingDotDot(cwd, cli.out) : resolve(cwd, DEFAULT_OUT_REPORT);
  const outPath = cli.out ? outArgRaw : resolve(cwd, DEFAULT_OUT_REPORT);
  const outCandidates = [...new Set([outPath, resolve(cwd, cli.out ?? DEFAULT_OUT_REPORT)])];
  const protectedInputs: string[] = [];
  const pushProtectedWithRealpath = (p: string, protectSummarySibling: boolean) => {
    protectedInputs.push(p);
    if (protectSummarySibling) {
      const parent = dirname(p);
      protectedInputs.push(joinPreservingDotDot(parent, "dual_mining_summary.json"));
      protectedInputs.push(resolve(parent, "dual_mining_summary.json"));
      try {
        const realParent = stripWinNamespacePrefix(realpathSync.native(parent));
        protectedInputs.push(resolve(realParent, "dual_mining_summary.json"));
      } catch {
        // Keep lexical parent summary protections if parent cannot be resolved
      }
    }
    try {
      const real = stripWinNamespacePrefix(realpathSync.native(p));
      protectedInputs.push(real);
      if (protectSummarySibling) {
        protectedInputs.push(resolve(dirname(real), "dual_mining_summary.json"));
      }
    } catch {
      // Keep supplied path protections if realpath cannot resolve
    }
  };
  pushProtectedWithRealpath(inPath, true);
  if (inArgRaw) pushProtectedWithRealpath(inArgRaw, true);
  if (cli.input) pushProtectedWithRealpath(resolve(cwd, cli.input), true);
  if (rawCorpusPath) {
    pushProtectedWithRealpath(rawCorpusPath, true);
    if (rawArgRaw) pushProtectedWithRealpath(rawArgRaw, true);
    if (cli.raw) pushProtectedWithRealpath(resolve(cwd, cli.raw), true);
  }
  for (const protectedPath of protectedInputs) {
    for (const outCand of outCandidates) {
      if (sameFilePath(outCand, protectedPath)) {
        throw new Error(`Refusing to overwrite input/evidence artifact with --out: ${outPath}`);
      }
    }
  }

  const rawSnapshot = rawCorpusPath ? loadRawCorpusSnapshot(rawCorpusPath) : undefined;
  const rawCorpusMap = rawSnapshot ? rawSnapshot.map : new Map<string, RawCorpusItem>();

  const rawParsed = JSON.parse(readFileSync(inPath, "utf8")) as unknown;
  if (!rawParsed || typeof rawParsed !== "object" || !Array.isArray((rawParsed as DistilledPayload).items)) {
    throw new Error(`Malformed distilled payload at ${inPath}: missing items array`);
  }
  const payload = rawParsed as DistilledPayload;
  const report = verifyDistilledPayload(root, payload, rawCorpusMap, {
    inputPath: inPath,
    rawCorpusPath,
    rawSnapshot,
  });
  const gateFailures = evaluateAuditGate(payload, report, rawCorpusPath);
  const gatePassed = gateFailures.length === 0;
  const reportWithGate = { ...report, gatePassed, gateFailures };

  if (gatePassed || cli.allowPartial) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(reportWithGate, null, 2)}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        gatePassed,
        gateFailures,
        outputWritten: gatePassed || Boolean(cli.allowPartial),
        inputPath: report.inputPath,
        rawCorpusPath: report.rawCorpusPath,
        miningSummaryDigestVerified: report.miningSummaryDigestVerified,
        gpuUsed: report.gpuUsed,
        teacherModel: report.teacherModel,
        totalMinedAndDistilled: report.totalMinedAndDistilled,
        declaredTotalIssues: report.declaredTotalIssues,
        duplicateKeyCount: report.duplicateKeyCount,
        unmatchedRawKeysCount: report.unmatchedRawKeysCount,
        rawMatchedCount: report.rawMatchedCount,
        missingRawCount: report.missingRawCount,
        shaMismatchCount: report.shaMismatchCount,
        provenanceConflictCount: report.provenanceConflictCount,
        commitConflictCount: report.commitConflictCount,
        rawSha256VerifiedCount: report.rawSha256VerifiedCount,
        verbatimRootSubstringVerified: report.verbatimRootSubstringVerified,
        titleLeakRejectedCount: report.titleLeakRejectedCount,
        forensicChainPresentCount: report.forensicChainPresentCount,
        rootLineAnalyzerHitCount: report.rootLineAnalyzerHitCount,
        cascadeOnlyAnalyzerHitCount: report.cascadeOnlyAnalyzerHitCount,
        withVerbatimDiagnosticRuleHit: report.withVerbatimDiagnosticRuleHit,
        domainAlignedDiagnosticRuleHitCount: report.domainAlignedDiagnosticRuleHitCount,
        unverifiedGeneratedRuleHits: report.unverifiedGeneratedRuleHits,
        colloquialQueriesTested: report.colloquialQueriesTested,
        nonEmptyRecallCount: report.nonEmptyRecallCount,
        domainAlignedTop3Count: report.domainAlignedTop3Count,
        colloquialWikiTop3HitRate: report.colloquialWikiTop3HitRate,
        domainAlignedTop3Rate: report.domainAlignedTop3Rate,
        withGitcodeMentionedMr: report.withGitcodeMentionedMr,
        withGitcodeMergedMr: report.withGitcodeMergedMr,
        withGitcodeConfirmedFixMr: report.withGitcodeConfirmedFixMr,
        prMrLineageSummary: report.prMrLineageSummary,
        byEcosystem: report.byEcosystem,
        diagnosticRuleHitCounts: report.diagnosticRuleHitCounts,
        outPath,
      },
      null,
      2,
    ),
  );

  if (!gatePassed && !cli.allowPartial) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
