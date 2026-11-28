import { createHash } from "node:crypto";
import { z } from "zod";
import { sanitizeRawInput } from "../scripts/wiki/sanitize";
import {
  type PdConfigDoctorReport,
  runPdConfigDoctor,
  runSingleConfigDoctor,
  type SingleConfigDoctorReport,
} from "../src/sim/doctor/configDoctor";
import {
  type DeployPlanInput,
  type DeployPlanReport,
  type DoctorModelTraitOverride,
  evaluateDeployPlan,
  GIB,
  MIB,
  resolveDoctorModelTraits,
  WAVE4_DEMO_PRESETS,
} from "../src/sim/modelspec/deployCalculator";
import { parseHfConfig, UnsupportedModelError } from "../src/sim/modelspec/parseHfConfig";
import { MODEL_PRESETS } from "../src/sim/modelspec/presets";
import {
  type ArgvFlagAction,
  type ArgvSecretState,
  classifyArgvSecretToken,
  createArgvSecretState,
  type DiagnosticRedactionMasks,
  isCredentialKey,
  isMandatoryOperandFlagBoundary,
  isNonSecretTypedValue,
  redactCommandFragmentWithSeed,
  redactDiagnosticCredentials,
  seedArgvSecretState,
  splitArgvTokensForSeed,
  stripTerminalControlSequences,
} from "../src/sim/shared/yamlRedactor";
import {
  DECISIVE_ERROR_CODE_RE,
  DIAGNOSTIC_C0_C1_CONTROL_RE,
  DIAGNOSTIC_INVISIBLE_FORMAT_RE,
  guardMalformedMetricLinesForAnalyzer,
  hasMetricsTruncatedMarker,
  inspectVllmMetricAggregateOverflow,
  isAnyValidPromReSyntaxLine,
  METADATA_NUMERIC_ID_LABEL_RE,
  neutralizeDiagnosticPromptTokens,
  stripBoundedHtmlComments,
  stripDiagnosticControlAndInvisibleChars,
} from "../src/sim/troubleshoot/evidenceLineMatcher";
import {
  analyzeTroubleshootInput,
  type LogAnalysisReport,
  type LogDiagnosisFinding,
} from "../src/sim/troubleshoot/logAnalyzer";

export const TOOL_EVIDENCE_VERSIONS = {
  deploy: "deploy-calculator@1",
  doctor: "config-doctor@1",
  troubleshoot: "troubleshoot-log-analyzer@1",
} as const;

export const TOOL_EVIDENCE_LIMITS = {
  maxRawConfigBytes: 64 * 1024,
  maxCommandChars: 8 * 1024,
  maxTroubleshootChars: 64 * 1024,
  maxSummaryChars: 4_000,
  maxPromptBytes: 16_000,
  maxConfigKeys: 2_048,
  maxConfigDepth: 6,
} as const;

const SHA256_RE = /^[a-f0-9]{64}$/;

const ruleVersionSchema = z.enum(["v0.30.0", "main", "rfork"]);
const ascendFamilySchema = z.enum(["A2", "A3", "310P", "A5"]);
const cardIdSchema = z.enum(["a2-64g", "a2-32g", "a3-die64g", "310p-24g", "950dt-128g"]);
const weightPrecisionSchema = z.enum([
  "bf16",
  "fp16",
  "w8a8",
  "w8a8_dynamic",
  "w4a8",
  "fp8_block",
  "w8a8sc_310p",
]);
const kvCacheDtypeSchema = z.enum(["auto", "int8", "mxfp8"]);
const cudagraphModeSchema = z.enum(["NONE", "PIECEWISE", "FULL_DECODE_ONLY", "FULL", "FULL_AND_PIECEWISE"]);

const ALLOWED_PRESET_IDS = new Set<string>([
  ...MODEL_PRESETS.map((p) => p.id),
  ...WAVE4_DEMO_PRESETS.map((p) => p.id),
]);

const deployModelInputSchema = z.union([
  z.string().trim().min(1).max(120),
  z.record(z.string().min(1).max(80), z.unknown()),
]);

const deployAnalysisInputObject = z
  .object({
    kind: z.literal("deploy"),
    model: deployModelInputSchema,
    cardId: cardIdSchema,
    version: ruleVersionSchema.optional(),
    weightPrecision: weightPrecisionSchema.optional(),
    kvCacheDtype: kvCacheDtypeSchema.optional(),
    blockSize: z.number().int().min(1).max(4096).optional(),
    userSpecifiedBlockSize: z.boolean().optional(),
    weightNzMode: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    tpSize: z.number().int().min(1).max(256).optional(),
    ppSize: z.number().int().min(1).max(256).optional(),
    dpSize: z.number().int().min(1).max(256).optional(),
    dpLocalSize: z.number().int().min(1).max(256).optional(),
    pcpSize: z.number().int().min(1).max(256).optional(),
    dcpSize: z.number().int().min(1).max(256).optional(),
    enableEp: z.boolean().optional(),
    useV2ModelRunner: z.boolean().optional(),
    enableEplb: z.boolean().optional(),
    dynamicEplb: z.boolean().optional(),
    engramCpuOffload: z.boolean().optional(),
    numSpecTokens: z.number().int().min(0).max(16).optional(),
    gpuMemoryUtilization: z.number().finite().min(0.1).max(0.99).optional(),
    maxModelLen: z.number().int().min(64).max(1_048_576).optional(),
    maxNumBatchedTokens: z.number().int().min(1).max(1_048_576).optional(),
    maxNumSeqs: z.number().int().min(1).max(65_536).optional(),
    cudagraphMode: cudagraphModeSchema.optional(),
    cudagraphCaptureCount: z.number().int().min(0).max(512).optional(),
    enforceEager: z.boolean().optional(),
    decodeBatchSize: z.number().int().min(1).max(65_536).optional(),
    prefillTokens: z.number().int().min(1).max(1_048_576).optional(),
    decodeContextLen: z.number().int().min(1).max(1_048_576).optional(),
  })
  .strict();

const doctorModelTraitOverrideSchema = z
  .object({
    isMoe: z.boolean().optional(),
    useMla: z.boolean().optional(),
    sfaDcpReplicatedIndexer: z.boolean().optional(),
    numExperts: z.number().int().min(1).max(16_384).optional(),
    numExpertsPerTok: z.number().int().min(1).max(1_024).optional(),
    numAttentionHeads: z.number().int().min(1).max(4_096).optional(),
    numKvHeads: z.number().int().min(1).max(4_096).optional(),
    headDim: z.number().int().min(1).max(4_096).optional(),
  })
  .strict();

const doctorAnalysisInputObject = z
  .object({
    kind: z.literal("doctor"),
    command: z
      .string()
      .trim()
      .min(1)
      .max(TOOL_EVIDENCE_LIMITS.maxCommandChars)
      .refine((s) => Buffer.byteLength(s, "utf8") <= TOOL_EVIDENCE_LIMITS.maxCommandChars),
    decodeCommand: z
      .string()
      .trim()
      .min(1)
      .max(TOOL_EVIDENCE_LIMITS.maxCommandChars)
      .refine((s) => Buffer.byteLength(s, "utf8") <= TOOL_EVIDENCE_LIMITS.maxCommandChars)
      .optional(),
    mode: z.enum(["minimal", "full"]).optional(),
    hardwareFamily: ascendFamilySchema.optional(),
    decodeHardwareFamily: ascendFamilySchema.optional(),
    version: ruleVersionSchema.optional(),
    crossNodeRoce: z.boolean().optional(),
    modelId: z.string().trim().min(1).max(120).optional(),
    modelTraitOverride: doctorModelTraitOverrideSchema.optional(),
  })
  .strict();

const troubleshootAnalysisInputObject = z
  .object({
    kind: z.literal("troubleshoot"),
    rawInput: z
      .string()
      .max(TOOL_EVIDENCE_LIMITS.maxTroubleshootChars)
      .refine(
        (s) =>
          s.trim().length > 0 && Buffer.byteLength(s, "utf8") <= TOOL_EVIDENCE_LIMITS.maxTroubleshootChars,
        {
          message: "排错日志或指标不能为空或超出长度上限",
        },
      ),
  })
  .strict();

const chatAnalysisInputUnion = z.discriminatedUnion("kind", [
  deployAnalysisInputObject,
  doctorAnalysisInputObject,
  troubleshootAnalysisInputObject,
]);

type DeployAnalysisInput = z.infer<typeof deployAnalysisInputObject>;
type DoctorAnalysisInput = z.infer<typeof doctorAnalysisInputObject>;
type TroubleshootAnalysisInput = z.infer<typeof troubleshootAnalysisInputObject>;
export type ChatAnalysisInput = z.infer<typeof chatAnalysisInputUnion>;

/**
 * Schema-authored field names that may appear in a validation-issue path. Any other
 * segment (for example a user-supplied config.json key) is replaced by `*`.
 */
const KNOWN_ANALYSIS_PATH_KEYS = new Set<string>([
  ...Object.keys(deployAnalysisInputObject.shape),
  ...Object.keys(doctorAnalysisInputObject.shape),
  ...Object.keys(troubleshootAnalysisInputObject.shape),
  ...Object.keys(doctorModelTraitOverrideSchema.shape),
]);

function valueFreeIssuePath(path: readonly (string | number)[]): (string | number)[] {
  return path.map((segment) =>
    typeof segment === "number" || KNOWN_ANALYSIS_PATH_KEYS.has(segment) ? segment : "*",
  );
}

/**
 * Maps a Zod issue to a message built only from schema constants. Zod's own issues
 * carry `received` values (enum / literal) and user-supplied key names
 * (unrecognized_keys), and HTTP callers stringify ZodError verbatim.
 */
function valueFreeIssueMessage(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === z.ZodParsedType.undefined
        ? "缺少必填字段"
        : `字段类型不符（期望 ${issue.expected}）`;
    case z.ZodIssueCode.invalid_enum_value:
      return `字段取值不在允许范围内（允许值：${issue.options.map(String).join(" | ")}）`;
    case z.ZodIssueCode.invalid_union_discriminator:
      return `kind 取值不在允许范围内（允许值：${issue.options.map(String).join(" | ")}）`;
    case z.ZodIssueCode.invalid_literal:
      return `字段取值必须为 ${String(issue.expected)}`;
    case z.ZodIssueCode.unrecognized_keys:
      return `包含 ${issue.keys.length} 个不支持的字段`;
    case z.ZodIssueCode.too_big:
      return `字段超出上限（${issue.inclusive ? "最大" : "需小于"} ${String(issue.maximum)}）`;
    case z.ZodIssueCode.too_small:
      return `字段低于下限（${issue.inclusive ? "最小" : "需大于"} ${String(issue.minimum)}）`;
    case z.ZodIssueCode.not_finite:
      return "字段必须为有限数值";
    case z.ZodIssueCode.invalid_union:
      return "字段不符合任何允许的形态";
    case z.ZodIssueCode.custom:
      // Only schema-authored refine messages reach here; none of them interpolate input.
      return issue.message;
    default:
      return "字段校验未通过";
  }
}

/** Wraps a schema so every validation issue is value-free (no received values, no user keys). */
function withValueFreeIssues<T extends z.ZodTypeAny>(schema: T) {
  return z.unknown().transform((value, ctx): z.output<T> => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: valueFreeIssuePath(issue.path),
        message: valueFreeIssueMessage(issue),
      });
    }
    return z.NEVER;
  });
}

export const deployAnalysisInputSchema = withValueFreeIssues(deployAnalysisInputObject);
export const doctorAnalysisInputSchema = withValueFreeIssues(doctorAnalysisInputObject);
export const troubleshootAnalysisInputSchema = withValueFreeIssues(troubleshootAnalysisInputObject);
export const chatAnalysisInputSchema = withValueFreeIssues(chatAnalysisInputUnion);

export const toolEvidenceMetricValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export type ToolEvidenceMetricValue = z.infer<typeof toolEvidenceMetricValueSchema>;

export const toolEvidenceV1Schema = z
  .object({
    kind: z.enum(["deploy", "doctor", "troubleshoot"]),
    toolVersion: z.string().min(1).max(64),
    sanitizedInput: z.record(z.string(), z.unknown()),
    inputSha256: z.string().regex(SHA256_RE),
    summary: z.string().min(1).max(TOOL_EVIDENCE_LIMITS.maxSummaryChars),
    keyMetrics: z.record(z.string(), toolEvidenceMetricValueSchema),
    outputSha256: z.string().regex(SHA256_RE),
  })
  .strict();

export type ToolEvidenceV1 = z.infer<typeof toolEvidenceV1Schema>;

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalizeCanonical(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeCanonical);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry !== undefined) out[key] = normalizeCanonical(entry);
  }
  return out;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function computeToolEvidenceOutputSha256(
  payload: Pick<ToolEvidenceV1, "kind" | "toolVersion" | "inputSha256" | "summary" | "keyMetrics">,
): string {
  return sha256Hex(
    canonicalJson({
      kind: payload.kind,
      toolVersion: payload.toolVersion,
      inputSha256: payload.inputSha256,
      summary: payload.summary,
      keyMetrics: payload.keyMetrics,
    }),
  );
}

export function verifyToolEvidence(
  evidence: unknown,
): { ok: true; evidence: ToolEvidenceV1 } | { ok: false; reason: string } {
  const parsed = toolEvidenceV1Schema.safeParse(evidence);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `toolEvidence schema invalid: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    };
  }
  const ev = parsed.data;
  const expectedInputSha = sha256Hex(canonicalJson(ev.sanitizedInput));
  if (expectedInputSha !== ev.inputSha256) {
    return {
      ok: false,
      reason: `toolEvidence inputSha256 mismatch (expected ${expectedInputSha}, got ${ev.inputSha256})`,
    };
  }
  const expectedOutputSha = computeToolEvidenceOutputSha256(ev);
  if (expectedOutputSha !== ev.outputSha256) {
    return {
      ok: false,
      reason: `toolEvidence outputSha256 mismatch (expected ${expectedOutputSha}, got ${ev.outputSha256})`,
    };
  }
  return { ok: true, evidence: ev };
}

const SERVER_REDACTION_MASKS: DiagnosticRedactionMasks = {
  keyMask: "[REDACTED]",
  tokenMask: "[REDACTED]",
  flagMask: "[REDACTED]",
  privateKeyMask: "[REDACTED]",
  authMask: "[REDACTED]",
  ipMask: "[REDACTED]",
  bracketedIpMask: "[REDACTED]",
};

export function redactSensitiveText(raw: string): string {
  return redactDiagnosticCredentials(raw, SERVER_REDACTION_MASKS).text;
}

/*
 * Diagnostic input sanitizer (troubleshoot logs and doctor commands).
 *
 * Unlike wiki compiler input (scripts/wiki/sanitize.ts), real vLLM / Qwen diagnostics
 * legitimately contain chat-template tokens (`<|im_start|>` in request logs and
 * `--chat-template`), lines starting with `system:` / `assistant:`, BEL and other C0
 * bytes, active-looking HTML/URLs in HTTP debug logs, and stray unclosed `<!--`.
 * Do NOT route diagnostics through wiki `sanitizeRawInput` blocking; instead neutralize
 * role/control/HTML triggers deterministically in place:
 *  - Strip terminal escape sequences, normalize CR/CRLF -> `\n`, strip C0/C1 control
 *    bytes except `\t` and `\n`, and strip invisible Unicode format characters.
 *  - Remove only CLOSED `<!-- ... -->` comments, keeping their newlines so line numbers
 *    stay exact; an unclosed `<!--` is preserved as escaped text (`<\!--`) and never
 *    blanks the rest of the log.
 *  - Redact sensitive credentials and IPs (preserving multi-line newline counts).
 *  - Escape chat-template tokens, role-label prefixes, and active HTML/URI triggers in
 *    place without adding or dropping any line so analyzer `firstFaultLineNumber` matches
 *    the submitted text.
 *  - Reject only empty-after-sanitization input and explicit natural-language prompt
 *    injection instructions (plain or base64-encoded), with value-free reason codes.
 */
const DIAGNOSTIC_INVISIBLE_RE = DIAGNOSTIC_INVISIBLE_FORMAT_RE;
const DIAGNOSTIC_CONTROL_RE = DIAGNOSTIC_C0_C1_CONTROL_RE;
const DIAGNOSTIC_INSTRUCTION_RE =
  /ignore (?:all )?(?:previous|above) instructions|disregard (?:all )?(?:previous|above)|(?:reveal|override|ignore|print|leak|show|return).{0,60}system prompts?|(?:忽略|无视|覆盖)(?:之前|先前|此前|上面|上文|上述|以上|前面|原有|原始|全部|所有|当前|系统|开发者|用户|这些|那些|这条|这段|一切|的|\s){0,6}(?:指令|提示词)|(?:输出|泄露|显示).{0,12}系统提示词/i;
function decodeHtmlEntitiesOnce(text: string): string {
  return text
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (whole, n: string) => {
      const code = n[0]?.toLowerCase() === "x" ? Number.parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    })
    .replace(/&colon;/gi, ":")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function diagnosticInstructionView(text: string): string {
  return decodeHtmlEntitiesOnce(text.normalize("NFKC"))
    .replace(DIAGNOSTIC_INVISIBLE_RE, "")
    .replace(DIAGNOSTIC_CONTROL_RE, "");
}

function hasEncodedDiagnosticInstruction(text: string, depth = 0): boolean {
  if (depth >= 2) return false;
  for (const m of text.matchAll(/\b[A-Za-z0-9+/]{32,}={0,2}/g)) {
    const decoded = Buffer.from(m[0], "base64").toString("utf8");
    const view = diagnosticInstructionView(decoded);
    if (
      DIAGNOSTIC_INSTRUCTION_RE.test(view.replace(/\s+/g, " ")) ||
      hasEncodedDiagnosticInstruction(view, depth + 1)
    ) {
      return true;
    }
  }
  return false;
}

export function sanitizeDiagnosticText(raw: string): { text: string } | { blockedReasons: string[] } {
  const escStripped = stripTerminalControlSequences(raw);
  const pass1 = redactSensitiveText(stripBoundedHtmlComments(escStripped));
  const normalized = stripBoundedHtmlComments(stripDiagnosticControlAndInvisibleChars(pass1));
  const text = neutralizeDiagnosticPromptTokens(redactSensitiveText(normalized));
  if (!text.trim()) return { blockedReasons: ["empty-input"] };
  const view = diagnosticInstructionView(text);
  if (DIAGNOSTIC_INSTRUCTION_RE.test(view.replace(/\s+/g, " "))) {
    return { blockedReasons: ["instruction-or-active-content"] };
  }
  if (hasEncodedDiagnosticInstruction(view)) {
    return { blockedReasons: ["encoded-instruction"] };
  }
  return { text };
}

function trimTrailingHorizontalWsAndNewlines(text: string): string {
  let end = text.length;
  while (end > 0) {
    const c = text.charCodeAt(end - 1);
    if (c === 32 || c === 9 || c === 10) end -= 1;
    else break;
  }
  return end === text.length ? text : text.slice(0, end);
}

function sanitizeTextPayload(
  label: string,
  raw: string,
  maxChars: number,
  preserveLeadingLines = false,
): string {
  const normalized = stripTerminalControlSequences(raw).replace(/\r\n?/g, "\n");
  const stripped = preserveLeadingLines ? trimTrailingHorizontalWsAndNewlines(normalized) : normalized.trim();
  if (!stripped.trim()) throw new Error(`${label}不能为空`);
  const enforceBytes = maxChars >= 4096;
  if (stripped.length > maxChars || (enforceBytes && Buffer.byteLength(stripped, "utf8") > maxChars)) {
    throw new Error(`${label}超出长度上限（最多 ${maxChars} 字符）`);
  }
  const clean = sanitizeDiagnosticText(stripped);
  if ("blockedReasons" in clean) {
    throw new Error(`${label}清洗未通过（${clean.blockedReasons.join("、")}）`);
  }
  const finalOut = preserveLeadingLines ? clean.text : clean.text.trim();
  if (finalOut.length > maxChars || (enforceBytes && Buffer.byteLength(finalOut, "utf8") > maxChars)) {
    throw new Error(`${label}超出长度上限（最多 ${maxChars} 字符）`);
  }
  return finalOut;
}

const INVISIBLE_KEY_CHAR_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;
const STRUCTURED_ENV_NAME_KEYS = new Set(["name", "key", "env_name", "var"]);
const STRUCTURED_ENV_VALUE_KEYS = new Set(["value", "val", "secret", "default"]);
const AUTHS_CONTAINER_KEYS = new Set(["auths", "registry_auths", "registry-auths"]);
const AUTHS_CREDENTIAL_FIELDS = new Set([
  "auth",
  "identitytoken",
  "registrytoken",
  "password",
  "token",
  "secret",
]);

function normalizeConfigKey(rawKey: string): string {
  return stripTerminalControlSequences(rawKey).replace(INVISIBLE_KEY_CHAR_RE, "");
}

type JsonSecretCtx = "none" | "secret-obj" | "secret-map" | "secret-list";

function sanitizeConfigObject(
  input: unknown,
  depth = 0,
  keyCounter = { count: 0 },
  authsDepth: "root" | "auths" | "registry" = "root",
  secretCtx: JsonSecretCtx = "none",
  argvSeed?: ArgvSecretState,
): unknown {
  if (depth > TOOL_EVIDENCE_LIMITS.maxConfigDepth) {
    throw new Error(`模型 config.json 嵌套层级超过上限（${TOOL_EVIDENCE_LIMITS.maxConfigDepth}）`);
  }
  if (input === null || typeof input === "boolean") {
    return secretCtx === "secret-map" ? "[REDACTED]" : input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("模型 config.json 包含非有限数值");
    return secretCtx === "secret-map" ? "[REDACTED]" : input;
  }
  if (typeof input === "string") {
    if (input.length > 512) throw new Error("模型 config.json 字段字符串过长");
    const stripped = stripTerminalControlSequences(input);
    const clean = sanitizeRawInput(stripped);
    if (clean.blocked && stripped.trim().length > 0) {
      throw new Error("模型 config.json 字符串清洗未通过");
    }
    if (secretCtx === "secret-map") return "[REDACTED]";
    let redacted = clean.blocked ? "" : redactSensitiveText(clean.text);
    if (argvSeed) {
      redacted = redactCommandFragmentWithSeed(redacted, argvSeed, "[REDACTED]");
    }
    if (redacted.length > 512) {
      throw new Error("模型 config.json 字段字符串过长");
    }
    return redacted;
  }
  if (Array.isArray(input)) {
    if (input.length > 512) throw new Error("模型 config.json 数组长度超出上限");
    const itemSecretCtx: JsonSecretCtx =
      secretCtx === "secret-list" ? "secret-obj" : secretCtx === "secret-map" ? "secret-map" : "none";
    const seqState = argvSeed ?? createArgvSecretState();
    let pendingNext: Extract<ArgvFlagAction, { kind: "next" }> | null = seqState.pendingNext ?? null;
    let taken = seqState.pendingTaken ?? 0;
    return input.map((item) => {
      keyCounter.count += 1;
      if (keyCounter.count > TOOL_EVIDENCE_LIMITS.maxConfigKeys) {
        throw new Error(`模型 config.json 字段数量超出上限（${TOOL_EVIDENCE_LIMITS.maxConfigKeys}）`);
      }
      if (typeof item === "string" && itemSecretCtx !== "secret-map") {
        const sanitized = sanitizeConfigObject(item, depth + 1, keyCounter, "root", itemSecretCtx) as string;
        const trimmed = sanitized.trim();
        if (pendingNext) {
          const isBoundary = isMandatoryOperandFlagBoundary(
            trimmed,
            pendingNext.requiresOperand && taken === 0,
          );
          const skipWeak =
            pendingNext.weakFlag !== null && isNonSecretTypedValue(pendingNext.weakFlag, trimmed);
          if (!isBoundary && !skipWeak) {
            taken += 1;
            if (!pendingNext.multi) {
              pendingNext = null;
              taken = 0;
            }
            return "[REDACTED]";
          }
          pendingNext = null;
          taken = 0;
        }
        const action = classifyArgvSecretToken(seqState, trimmed);
        if (action.kind === "inline") {
          return `${trimmed.slice(0, action.valueOffset)}[REDACTED]`;
        }
        if (action.kind === "next") {
          pendingNext = action;
          taken = 0;
        }
        return sanitized;
      }
      pendingNext = null;
      taken = 0;
      return sanitizeConfigObject(item, depth + 1, keyCounter, "root", itemSecretCtx);
    });
  }
  if (typeof input === "object") {
    const entries = Object.entries(input as Record<string, unknown>);
    const hasSecretDescriptor = entries.some(([rawK, rawV]) => {
      if (typeof rawV !== "string") return false;
      const normKey = normalizeConfigKey(rawK).normalize("NFKC").toLowerCase();
      if (!STRUCTURED_ENV_NAME_KEYS.has(normKey)) return false;
      const normVal = normalizeConfigKey(rawV).normalize("NFKC");
      return isCredentialKey(normVal);
    });
    const kindEntry = entries.find(
      ([rawK, rawV]) =>
        typeof rawV === "string" && normalizeConfigKey(rawK).normalize("NFKC").toLowerCase() === "kind",
    );
    const trimmedKind = typeof kindEntry?.[1] === "string" ? kindEntry[1].trim() : "";
    const isSecretManifest = secretCtx === "secret-obj" || trimmedKind === "Secret";
    const isSecretListManifest = trimmedKind === "SecretList";

    const extractArgvFieldTokens = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string");
      if (typeof val === "string") return splitArgvTokensForSeed(val);
      return [];
    };
    const entrypointEntry = entries.find(
      ([rawK]) => normalizeConfigKey(rawK).normalize("NFKC").toLowerCase() === "entrypoint",
    );
    const commandEntry = entries.find(
      ([rawK]) => normalizeConfigKey(rawK).normalize("NFKC").toLowerCase() === "command",
    );
    const entrypointTokens = entrypointEntry ? extractArgvFieldTokens(entrypointEntry[1]) : [];
    const commandTokens = commandEntry ? extractArgvFieldTokens(commandEntry[1]) : [];
    const commandSeed: ArgvSecretState | undefined =
      entrypointTokens.length > 0 ? seedArgvSecretState(entrypointTokens) : undefined;
    const argsSeed: ArgvSecretState | undefined =
      entrypointTokens.length > 0 || commandTokens.length > 0
        ? seedArgvSecretState([...entrypointTokens, ...commandTokens])
        : undefined;

    const prepared: Array<{
      v: unknown;
      nfkcKey: string;
      baseTargetKey: string;
      isLiteralUnchanged: boolean;
      isSecret: boolean;
    }> = [];
    const reservedLiteralKeys = new Set<string>();
    for (const [k, v] of entries) {
      const cleanKey = normalizeConfigKey(k);
      const nfkcKey = cleanKey.normalize("NFKC");
      if (FORBIDDEN_KEYS.has(cleanKey) || FORBIDDEN_KEYS.has(nfkcKey) || cleanKey.length > 80) continue;
      keyCounter.count += 1;
      if (keyCounter.count > TOOL_EVIDENCE_LIMITS.maxConfigKeys) {
        throw new Error(`模型 config.json 字段数量超出上限（${TOOL_EVIDENCE_LIMITS.maxConfigKeys}）`);
      }
      if (v === undefined) continue;
      const nfkcLower = nfkcKey.toLowerCase();
      const isStructuredSecretVal = hasSecretDescriptor && STRUCTURED_ENV_VALUE_KEYS.has(nfkcLower);
      const isAuthsSecretVal = authsDepth === "registry" && AUTHS_CREDENTIAL_FIELDS.has(nfkcLower);
      const isSecretMapLeaf = secretCtx === "secret-map" && (v === null || typeof v !== "object");
      const isDirectCred = isCredentialKey(nfkcKey) && !isNonSecretTypedValue(nfkcKey, v);
      const safePropKey = redactSensitiveText(cleanKey);
      const baseTargetKey = safePropKey || "[REDACTED]";
      if (FORBIDDEN_KEYS.has(baseTargetKey)) continue;
      const isLiteralUnchanged = k === cleanKey && baseTargetKey === cleanKey;
      if (isLiteralUnchanged) {
        reservedLiteralKeys.add(baseTargetKey);
      }
      prepared.push({
        v,
        nfkcKey,
        baseTargetKey,
        isLiteralUnchanged,
        isSecret: isDirectCred || isStructuredSecretVal || isAuthsSecretVal || isSecretMapLeaf,
      });
    }
    const usedKeys = new Set<string>(reservedLiteralKeys);
    const out: Record<string, unknown> = {};
    for (const item of prepared) {
      let targetKey = item.baseTargetKey;
      if (!item.isLiteralUnchanged) {
        if (usedKeys.has(targetKey)) {
          let suffix = 2;
          while (usedKeys.has(`${item.baseTargetKey}#${suffix}`)) suffix += 1;
          targetKey = `${item.baseTargetKey}#${suffix}`;
        }
        usedKeys.add(targetKey);
      }
      const nfkcLower = item.nfkcKey.toLowerCase();
      const nextAuthsDepth =
        authsDepth === "root" && AUTHS_CONTAINER_KEYS.has(nfkcLower)
          ? "auths"
          : authsDepth === "auths"
            ? "registry"
            : "root";
      const nextSecretCtx: JsonSecretCtx =
        secretCtx === "secret-map"
          ? "secret-map"
          : isSecretManifest && (nfkcLower === "data" || nfkcLower === "stringdata")
            ? "secret-map"
            : isSecretListManifest && nfkcLower === "items"
              ? "secret-list"
              : "none";
      out[targetKey] = item.isSecret
        ? "[REDACTED]"
        : sanitizeConfigObject(
            item.v,
            depth + 1,
            keyCounter,
            nextAuthsDepth,
            nextSecretCtx,
            nfkcLower === "command" ? commandSeed : nfkcLower === "args" ? argsSeed : undefined,
          );
    }
    return out;
  }
  throw new Error("模型 config.json 包含不支持的值类型");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildEvidence(
  kind: ToolEvidenceV1["kind"],
  sanitizedInput: Record<string, unknown>,
  summary: string,
  keyMetrics: Record<string, ToolEvidenceMetricValue>,
): ToolEvidenceV1 {
  const toolVersion = TOOL_EVIDENCE_VERSIONS[kind];
  const normalizedInput = normalizeCanonical(sanitizedInput) as Record<string, unknown>;
  const inputSha256 = sha256Hex(canonicalJson(normalizedInput));
  const clippedSummary = redactSensitiveText(summary.trim()).slice(0, TOOL_EVIDENCE_LIMITS.maxSummaryChars);
  const outputSha256 = computeToolEvidenceOutputSha256({
    kind,
    toolVersion,
    inputSha256,
    summary: clippedSummary,
    keyMetrics,
  });
  return toolEvidenceV1Schema.parse({
    kind,
    toolVersion,
    sanitizedInput: normalizedInput,
    inputSha256,
    summary: clippedSummary,
    keyMetrics,
    outputSha256,
  });
}

function checkRawDeployConfigBudget(model: Record<string, unknown>): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: model, depth: 0 }];
  let visited = 1;
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (node === null || typeof node === "boolean" || typeof node === "string") continue;
    if (typeof node === "number") {
      if (!Number.isFinite(node)) throw new Error("模型 config.json 包含非有限数值");
      continue;
    }
    if (typeof node !== "object") {
      throw new Error("模型 config.json 包含不支持的值类型");
    }
    if (depth > TOOL_EVIDENCE_LIMITS.maxConfigDepth) {
      throw new Error(`模型 config.json 嵌套层级超过上限（${TOOL_EVIDENCE_LIMITS.maxConfigDepth}）`);
    }
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i -= 1) {
        visited += 1;
        if (visited > 4096) throw new Error("模型 config.json 结构节点过多");
        stack.push({ node: node[i], depth: depth + 1 });
      }
    } else {
      const obj = node as Record<string, unknown>;
      for (const k in obj) {
        if (!Object.hasOwn(obj, k)) continue;
        const v = obj[k];
        if (v === undefined) continue;
        visited += 1;
        if (visited > 4096) throw new Error("模型 config.json 结构节点过多");
        stack.push({ node: v, depth: depth + 1 });
      }
    }
  }
  if (Buffer.byteLength(JSON.stringify(model), "utf8") > TOOL_EVIDENCE_LIMITS.maxRawConfigBytes) {
    throw new Error(`模型 config.json 超过体积上限（${TOOL_EVIDENCE_LIMITS.maxRawConfigBytes} 字节）`);
  }
}

function runDeployEvidenceCore(input: DeployAnalysisInput): {
  evidence: ToolEvidenceV1;
  plan: DeployPlanReport;
} {
  let resolvedModel: DeployPlanInput["model"];
  let sanitizedModel: string | Record<string, unknown>;
  if (typeof input.model === "string") {
    const presetId = input.model.trim();
    if (!ALLOWED_PRESET_IDS.has(presetId)) {
      // Value-free: never echo the submitted string (it may be a pasted credential).
      throw new Error("未知模型预设；请使用内置预设 ID 或传入合法 config.json 对象");
    }
    sanitizedModel = presetId;
    const wave4 = WAVE4_DEMO_PRESETS.find((p) => p.id === presetId);
    resolvedModel = wave4 ? wave4.config : presetId;
  } else {
    checkRawDeployConfigBudget(input.model);
    const cleanConfig = sanitizeConfigObject(input.model) as Record<string, unknown>;
    if (Buffer.byteLength(JSON.stringify(cleanConfig), "utf8") > TOOL_EVIDENCE_LIMITS.maxRawConfigBytes) {
      throw new Error(`模型 config.json 超过体积上限（${TOOL_EVIDENCE_LIMITS.maxRawConfigBytes} 字节）`);
    }
    sanitizedModel = cleanConfig;
    // Always validate external custom configs strictly through parseHfConfig so they can never bypass checks as internal ModelSpec.
    // Keep thrown errors value-free so submitted strings cannot be echoed back in HTTP 400 responses.
    try {
      resolvedModel = parseHfConfig(cleanConfig);
    } catch (error) {
      if (error instanceof UnsupportedModelError) {
        throw new Error(
          "暂不支持该模型架构（model_type / architectures）；当前支持 qwen3 / qwen3_moe / qwen2 / llama / mistral / mixtral / deepseek_v2 / deepseek_v3 / deepseek_v4 / glm4_moe_lite / kimi_linear / qwen3_next 等架构。",
        );
      }
      if (error instanceof Error) {
        throw new Error(error.message.replace(/（收到 [^）]*）/, ""));
      }
      throw new Error("模型 config.json 校验未通过");
    }
  }

  const { kind: _kind, model: _model, cardId, ...rest } = input;
  const definedRest = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Omit<
    DeployPlanInput,
    "model" | "cardId"
  >;
  const planInput: DeployPlanInput = { ...definedRest, cardId, model: resolvedModel };
  const report: DeployPlanReport = evaluateDeployPlan(planInput);
  const weightsStage = report.stages[2];
  const q1 = report.fourQuestions.q1Fit;
  const q2 = report.fourQuestions.q2Capacity;
  const q3 = report.fourQuestions.q3Roofline;
  const q4 = report.fourQuestions.q4Recommendation;

  const keyMetrics: Record<string, ToolEvidenceMetricValue> = {
    modelId: report.spec.id,
    cardId: report.card.id,
    ruleVersion: report.version,
    tpSize: report.inputSummary.tpSize,
    ppSize: report.inputSummary.ppSize,
    dpSize: report.inputSummary.dpSize,
    effectiveWeightPrecision: report.inputSummary.effectiveWeightPrecision,
    q1Verdict: q1.verdict,
    blockerCount: q1.blockers.length,
    silentRewriteCount: q1.silentRewrites.length,
    warningCount: q1.warnings.length,
    oomStatus: q2.oomStatus,
    headroomStatus: report.headroomStatus,
    totalHbmGiB: round2(report.totalHbmBytes / GIB),
    weightsPerRankGiB: round2(weightsStage.pointEstimateBytes / GIB),
    kvPoolPointGiB: round2(q2.kvPoolPointBytes / GIB),
    kvBytesPerTokenPerRank: Math.round(q2.kvBytesPerTokenPerRank),
    kvMiBPerBlock: round2(q2.kvBytesPerBlock / MIB),
    usableBlocksPoint: q2.usableBlocksPoint,
    maxConcurrencyPoint: q2.maxConcurrencyPoint,
    minCardsRecommended: q2.minCardsRecommended,
    primaryBottleneck: q3.primaryBottleneck,
    ridgePointFlopsPerByte: round2(q3.roofline.ridgePointFlopsPerByte),
    prefillIntensityFlopsPerByte: round2(q3.roofline.prefillIntensityFlopsPerByte),
    decodeLinearIntensityFlopsPerByte: round2(q3.roofline.decodeLinearIntensityFlopsPerByte),
    recommendedTp: q4.recommendedTp,
    recommendedPp: q4.recommendedPp,
    recommendedPrecision: q4.recommendedPrecision,
  };

  const summary = [
    `[部署算账确定性核算] 模型 ${report.spec.name} @ ${report.card.shortName}（TP=${report.inputSummary.tpSize}, PP=${report.inputSummary.ppSize}, DP=${report.inputSummary.dpSize}, 精度=${report.inputSummary.effectiveWeightPrecision}, 规则=${report.version}）：`,
    `Q1=${q1.verdict}（阻塞 ${q1.blockers.length} / 静默改写 ${q1.silentRewrites.length} / 告警 ${q1.warnings.length}）；`,
    `Q2=${q2.oomStatus}（单卡权重 ${keyMetrics.weightsPerRankGiB} GiB，KV 池点估 ${keyMetrics.kvPoolPointGiB} GiB，可用块 ${q2.usableBlocksPoint}，估算并发 ${q2.maxConcurrencyPoint}，推荐最少 ${q2.minCardsRecommended} 卡）；`,
    `Q3 主瓶颈=${q3.primaryBottleneck}（拐点 ${keyMetrics.ridgePointFlopsPerByte} FLOP/B，Prefill ${keyMetrics.prefillIntensityFlopsPerByte} FLOP/B，Decode 线性 ${keyMetrics.decodeLinearIntensityFlopsPerByte} FLOP/B）；`,
    `静态估算边界：基于解析显存与 Roofline 模型，非目标硬件实测。`,
  ].join("");

  return {
    // cardId is part of the analyzed input, so it must be part of sanitizedInput / inputSha256.
    evidence: buildEvidence("deploy", { ...rest, cardId, model: sanitizedModel }, summary, keyMetrics),
    plan: report,
  };
}

function runDeployEvidence(input: DeployAnalysisInput): ToolEvidenceV1 {
  return runDeployEvidenceCore(input).evidence;
}

/** Returns only redacted evidence plus the derived plan; the raw validated input is never handed back. */
export function runDeployToolEvidenceWithPlan(rawInput: Record<string, unknown>): {
  evidence: ToolEvidenceV1;
  plan: DeployPlanReport;
} {
  const checked = deployAnalysisInputSchema.parse({ kind: "deploy", ...rawInput });
  return runDeployEvidenceCore(checked);
}

function runDoctorEvidence(input: DoctorAnalysisInput): ToolEvidenceV1 {
  const command = sanitizeTextPayload("启动命令", input.command, TOOL_EVIDENCE_LIMITS.maxCommandChars);
  const decodeCommand = input.decodeCommand
    ? sanitizeTextPayload("Decode 启动命令", input.decodeCommand, TOOL_EVIDENCE_LIMITS.maxCommandChars)
    : undefined;
  const hardwareFamily = input.hardwareFamily ?? "A2";
  const version = input.version ?? "v0.30.0";
  const mode = input.mode ?? "full";
  const safeModelId = input.modelId ? sanitizeTextPayload("模型标识", input.modelId, 120) : undefined;
  const resolvedTraits: DoctorModelTraitOverride | undefined = resolveDoctorModelTraits(
    safeModelId,
    input.modelTraitOverride,
  );

  let keyMetrics: Record<string, ToolEvidenceMetricValue>;
  let summary: string;

  if (decodeCommand) {
    const report: PdConfigDoctorReport = runPdConfigDoctor(command, decodeCommand, {
      hardwareFamily,
      ...(input.decodeHardwareFamily !== undefined
        ? { decodeHardwareFamily: input.decodeHardwareFamily }
        : {}),
      version,
      ...(input.crossNodeRoce !== undefined ? { crossNodeRoce: input.crossNodeRoce } : {}),
      ...(resolvedTraits ? { modelTraitOverride: resolvedTraits } : {}),
    });
    const topRules = report.allFindings
      .slice(0, 6)
      .map((f) => `${f.id}(${f.judgment})`)
      .join(", ");
    keyMetrics = {
      scope: "pd",
      prefillHardwareFamily: report.prefillHardwareFamily,
      decodeHardwareFamily: report.decodeHardwareFamily,
      ruleVersion: report.version,
      hasBlockers: report.hasBlockers,
      totalFindings: report.allFindings.length,
      errorCount: report.errors.length,
      silentRewriteCount: report.silentRewrites.length,
      warningCount: report.warnings.length,
      unknownCount: report.unknowns.length,
      crossInstanceFindingCount: report.crossInstanceFindings.length,
      topRuleIds: topRules || "none",
    };
    summary = `[PD 配置体检确定性核算] P(${report.prefillHardwareFamily}) + D(${report.decodeHardwareFamily}) 规则=${report.version}：阻塞=${report.hasBlockers ? "是" : "否"}（错误 ${report.errors.length} / 静默改写 ${report.silentRewrites.length} / 告警 ${report.warnings.length} / 跨实例 ${report.crossInstanceFindings.length}）；命中规则：${topRules || "无"}。静态规则体检边界：基于启动命令与规则引擎静态判定。`;
  } else {
    const report: SingleConfigDoctorReport = runSingleConfigDoctor(command, {
      mode,
      hardwareFamily,
      version,
      ...(input.crossNodeRoce !== undefined ? { crossNodeRoce: input.crossNodeRoce } : {}),
      ...(resolvedTraits ? { modelTraitOverride: resolvedTraits } : {}),
    });
    const topRules = report.findings
      .slice(0, 6)
      .map((f) => `${f.id}(${f.judgment})`)
      .join(", ");
    keyMetrics = {
      scope: "single",
      doctorMode: report.mode,
      hardwareFamily: report.hardwareFamily,
      ruleVersion: report.version,
      hasBlockers: report.hasBlockers,
      totalFindings: report.findings.length,
      errorCount: report.errors.length,
      silentRewriteCount: report.silentRewrites.length,
      warningCount: report.warnings.length,
      unknownCount: report.unknowns.length,
      effectiveRewriteCount: report.effectiveRewrites.length,
      resolvedBatchTokens: report.batchTokensResolution.finalMaxNumBatchedTokens,
      hcclEstimatedMiB: report.hcclEstimate ? round2(report.hcclEstimate.totalMaterializedMiB) : null,
      topRuleIds: topRules || "none",
    };
    summary = `[单实例配置体检确定性核算] 硬件=${report.hardwareFamily}（模式=${report.mode}, 规则=${report.version}）：阻塞=${report.hasBlockers ? "是" : "否"}（错误 ${report.errors.length} / 静默改写 ${report.silentRewrites.length} / 告警 ${report.warnings.length} / 生效改写 ${report.effectiveRewrites.length}），默认批上限 max_num_batched_tokens=${report.batchTokensResolution.finalMaxNumBatchedTokens}；命中规则：${topRules || "无"}。静态规则体检边界：仅基于命令与环境参数静态校验。`;
  }

  return buildEvidence(
    "doctor",
    {
      command,
      ...(decodeCommand ? { decodeCommand } : {}),
      mode,
      hardwareFamily,
      ...(input.decodeHardwareFamily ? { decodeHardwareFamily: input.decodeHardwareFamily } : {}),
      version,
      ...(input.crossNodeRoce !== undefined ? { crossNodeRoce: input.crossNodeRoce } : {}),
      ...(safeModelId ? { modelId: safeModelId } : {}),
      ...(resolvedTraits ? { modelTraitOverride: resolvedTraits } : {}),
    },
    summary,
    keyMetrics,
  );
}

const PRIMARY_EVIDENCE_MAX_LINES = 4;
const PRIMARY_EVIDENCE_LINE_HEAD_CHARS = 160;
const PRIMARY_EVIDENCE_LINE_TAIL_CHARS = 120;
const PRIMARY_EVIDENCE_MID_WINDOW_MAX_CHARS = 128;
const PRIMARY_EVIDENCE_LINE_MAX_CHARS =
  PRIMARY_EVIDENCE_LINE_HEAD_CHARS + PRIMARY_EVIDENCE_LINE_TAIL_CHARS + 32;
const PRIMARY_EVIDENCE_MID_DECISIVE_RE = new RegExp(
  `${DECISIVE_ERROR_CODE_RE.source}|\\b(?:ACL_ERROR_(?!(?:[A-Z0-9_]*_)?(?:OK|SUCCESS(?:FUL)?|SUCCEEDED|PASS(?:ED)?|NONE|NULL|NIL|NORMAL|READY|DONE|COMPLETED|NO_?ERR(?:OR)?)\\b)[A-Z0-9_]+|EI\\d{4}|EJ\\d{4}|EZ\\d{4}|EL\\d{4}|EH\\d{4}|CheckSmmuFault|OutOfMemoryError|BackendCompilerFailed|ZMQError)\\b|\\bretCode\\s*[:=]\\s*(?:-?[1-9]\\d*|0x0*[1-9a-f][0-9a-f]*|(?!(?:[A-Za-z0-9_]*_)?(?:ok|success(?:ful)?|succeeded|pass(?:ed)?|none|null|nil|false|true|normal|ready|done|completed|no_?err(?:or)?)(?:_|\\b))[A-Za-z_]{2,})[^\\s]{0,24}|\\baclnn[A-Za-z0-9_]+|NPU\\s+out of memory`,
  "gi",
);
const PRIMARY_EVIDENCE_MID_EXCEPTION_RE = /\b(?:RuntimeError|ValueError|AssertionError)\b/gi;
const EXPLICIT_FAULT_MID_PREFIX_RE =
  /(?:error(?:\s+code)?(?:\s+is)?|acl\s+error|err(?:_?code)?|ret(?:_?code)?|status|failed)\s*[:=#(]?\s*$/i;

function countCodePointsRange(text: string, fromUtf16: number, toUtf16: number): number {
  let count = 0;
  for (let i = fromUtf16; i < toUtf16; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < toUtf16) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i += 1;
    }
    count += 1;
  }
  return count;
}

function findBestMidWindowHit(
  collapsed: string,
  totalChars: number,
  headKeep: number,
  tailKeep: number,
): { start: number; len: number } | null {
  const middleLimit = totalChars - tailKeep;
  let fallbackBareNumHit: { start: number; len: number } | null = null;
  for (const re of [PRIMARY_EVIDENCE_MID_DECISIVE_RE, PRIMARY_EVIDENCE_MID_EXCEPTION_RE]) {
    re.lastIndex = 0;
    let lastUtf16 = 0;
    let cpCursor = 0;
    let m = re.exec(collapsed);
    while (m !== null) {
      const tok = m[0];
      const isNumeric = /^\d+$/.test(tok);
      const prefix = isNumeric ? collapsed.slice(Math.max(0, m.index - 28), m.index) : "";
      if (isNumeric && METADATA_NUMERIC_ID_LABEL_RE.test(prefix)) {
        if (tok.length === 0) re.lastIndex += 1;
        m = re.exec(collapsed);
        continue;
      }
      if (m.index > lastUtf16) {
        cpCursor += countCodePointsRange(collapsed, lastUtf16, m.index);
        lastUtf16 = m.index;
      }
      const cpStart = cpCursor;
      const cpLen = Math.min(PRIMARY_EVIDENCE_MID_WINDOW_MAX_CHARS, countCodePointsRange(tok, 0, tok.length));
      if (cpStart + cpLen > headKeep && cpStart < middleLimit) {
        const isExplicit = !isNumeric || EXPLICIT_FAULT_MID_PREFIX_RE.test(prefix);
        if (isExplicit) {
          return { start: cpStart, len: cpLen };
        }
        if (fallbackBareNumHit === null) {
          fallbackBareNumHit = { start: cpStart, len: cpLen };
        }
      }
      if (tok.length === 0) re.lastIndex += 1;
      m = re.exec(collapsed);
    }
    if (fallbackBareNumHit !== null) return fallbackBareNumHit;
  }
  return null;
}

/**
 * Collapses whitespace and preserves head, middle decisive error window (capped in width so one
 * huge diagnostic token can never blow prompt budget), and tail code points.
 */
function boundEvidenceLine(line: string): string {
  const collapsed = line.replace(/\s+/g, " ").trim();
  const chars = Array.from(collapsed);
  if (chars.length <= PRIMARY_EVIDENCE_LINE_HEAD_CHARS + PRIMARY_EVIDENCE_LINE_TAIL_CHARS) {
    return collapsed;
  }
  const headKeep = 86;
  const tailKeep = 82;
  const hit = findBestMidWindowHit(collapsed, chars.length, headKeep, tailKeep);
  if (hit) {
    const winStart = Math.max(headKeep, hit.start - 24);
    const maxWinEnd = Math.min(chars.length - tailKeep, winStart + PRIMARY_EVIDENCE_MID_WINDOW_MAX_CHARS);
    const desiredEnd = Math.max(winStart + Math.min(84, hit.len + 40), hit.start + hit.len + 32);
    const winEnd = Math.min(maxWinEnd, Math.max(winStart + 1, desiredEnd));
    const parts = [chars.slice(0, headKeep).join("")];
    if (winStart > headKeep) parts.push("…");
    parts.push(chars.slice(winStart, winEnd).join(""));
    if (winEnd < chars.length - tailKeep) parts.push("…");
    parts.push(chars.slice(-tailKeep).join(""));
    const joined = parts.join(" ");
    const joinedChars = Array.from(joined);
    return joinedChars.length <= PRIMARY_EVIDENCE_LINE_MAX_CHARS
      ? joined
      : `${joinedChars.slice(0, PRIMARY_EVIDENCE_LINE_MAX_CHARS - 2).join("")} …`;
  }
  return `${chars.slice(0, PRIMARY_EVIDENCE_LINE_HEAD_CHARS).join("")} … ${chars.slice(-PRIMARY_EVIDENCE_LINE_TAIL_CHARS).join("")}`;
}

const ANALYZER_OMISSION_MARKER_RE =
  /^\s*\.\.\.\s*\[日志节选：[^\]]*(?:下行起原行号\s*L(\d+)|已省略第\s*\d+\s*[–-]\s*(\d+)\s*行)[^\]]*\]\s*\.\.\.\s*$/;

function buildSubmittedLineByAnalyzerNumber(submittedRawInput: string): Map<number, string> {
  const byLineNumber = new Map<number, string>();
  const lines = submittedRawInput.split("\n");
  let currentLineNumber = 1;
  for (const rawLine of lines) {
    const om = ANALYZER_OMISSION_MARKER_RE.exec(rawLine);
    if (om) {
      const nextLine = om[1] ? Number.parseInt(om[1], 10) : om[2] ? Number.parseInt(om[2], 10) + 1 : NaN;
      if (Number.isFinite(nextLine) && nextLine > currentLineNumber) {
        currentLineNumber = nextLine;
      }
      continue;
    }
    byLineNumber.set(currentLineNumber, rawLine);
    currentLineNumber += 1;
  }
  return byLineNumber;
}

/**
 * Bounded, already-sanitized primary-evidence excerpt kept in keyMetrics so it survives the
 * compact prompt form (which drops sanitizedInput). Draws from firstFaultVerdict primary lines
 * first (which derive solely from log signals, never metrics) and tops up from non-metric active
 * findings if needed; lines are defensively re-redacted.
 */
function buildPrimaryEvidenceExcerpt(
  report: LogAnalysisReport,
  activeFindings: readonly LogDiagnosisFinding[],
  submittedRawInput?: string,
): string | null {
  const candidates = [
    ...report.firstFaultVerdict.primaryEvidenceLines,
    ...(activeFindings[0]?.matchedLines ?? []),
  ];
  const submittedByLine =
    submittedRawInput !== undefined ? buildSubmittedLineByAnalyzerNumber(submittedRawInput) : null;
  const seenLines = new Set<number>();
  const lines: string[] = [];
  for (const item of candidates) {
    if (seenLines.has(item.lineNumber)) continue;
    seenLines.add(item.lineNumber);
    const rawSource = submittedByLine?.get(item.lineNumber) ?? item.rawLine;
    const bounded = boundEvidenceLine(redactSensitiveText(rawSource));
    if (!bounded) continue;
    lines.push(`L${item.lineNumber}: ${bounded}`);
    if (lines.length >= PRIMARY_EVIDENCE_MAX_LINES) break;
  }
  return lines.length ? lines.join(" ⏎ ") : null;
}

function runTroubleshootEvidence(input: TroubleshootAnalysisInput): ToolEvidenceV1 {
  const rawInput = sanitizeTextPayload(
    "排错日志或指标",
    input.rawInput,
    TOOL_EVIDENCE_LIMITS.maxTroubleshootChars,
    true,
  );
  const report: LogAnalysisReport = analyzeTroubleshootInput(guardMalformedMetricLinesForAnalyzer(rawInput));
  // The client handoff appends this marker when metric samples were dropped during truncation;
  // aggregates and metric-threshold findings derived from the partial subset are untrusted.
  // Log-derived `firstFaultVerdict` and non-metric findings remain valid and must stay intact.
  const metricsIncomplete = hasMetricsTruncatedMarker(rawInput);
  const hasOmissionMarker = /^\s*\.\.\.\s*\[日志节选：[^\]]*\]\s*\.\.\.\s*$/m.test(rawInput);
  const hasSingleLineCompaction = rawInput.includes("...[单行中段省略]...");
  const excerptTruncated = metricsIncomplete || hasOmissionMarker || hasSingleLineCompaction;

  const rawKvRatio = report.metrics.kvCacheUsageRatio;
  const roundedKvRatio = rawKvRatio !== undefined ? round2(rawKvRatio) : undefined;
  const rawPreemptions = report.metrics.numPreemptionsTotal;
  const familyOverflow = inspectVllmMetricAggregateOverflow(rawInput);
  const kvOverflow =
    familyOverflow.kvOverflow ||
    (rawKvRatio !== undefined && (!Number.isFinite(rawKvRatio) || !Number.isFinite(roundedKvRatio!)));
  const runningOverflow =
    familyOverflow.runningOverflow ||
    (report.metrics.numRequestsRunning !== undefined && !Number.isFinite(report.metrics.numRequestsRunning));
  const waitingOverflow =
    familyOverflow.waitingOverflow ||
    (report.metrics.numRequestsWaiting !== undefined && !Number.isFinite(report.metrics.numRequestsWaiting));
  const preemptOverflow =
    familyOverflow.preemptOverflow || (rawPreemptions !== undefined && !Number.isFinite(rawPreemptions));
  const ttftOverflow =
    familyOverflow.ttftOverflow ||
    (report.metrics.ttftAvgSec !== undefined && !Number.isFinite(report.metrics.ttftAvgSec));
  const itlOverflow =
    familyOverflow.itlOverflow ||
    (report.metrics.itlAvgSec !== undefined && !Number.isFinite(report.metrics.itlAvgSec));
  const hitRateOverflow =
    familyOverflow.hitRateOverflow ||
    (report.metrics.prefixCacheHitRate !== undefined && !Number.isFinite(report.metrics.prefixCacheHitRate));
  const metricsOverflow =
    !metricsIncomplete &&
    (kvOverflow ||
      runningOverflow ||
      waitingOverflow ||
      preemptOverflow ||
      ttftOverflow ||
      itlOverflow ||
      hitRateOverflow);

  const activeFindings = report.findings.filter((f) => {
    if (metricsIncomplete && f.category === "metrics") return false;
    if (f.ruleId === "metrics-kv-preemption-storm") {
      return !(kvOverflow || waitingOverflow || preemptOverflow);
    }
    if (f.ruleId === "metrics-low-kv-high-latency") {
      return !(kvOverflow || waitingOverflow || ttftOverflow || itlOverflow);
    }
    return true;
  });
  const errorCount = activeFindings.filter((f) => f.severity === "error").length;
  const warnCount = activeFindings.filter((f) => f.severity === "warn").length;
  const topRules = activeFindings
    .slice(0, 6)
    .map((f) => `${f.ruleId}(${f.severity})`)
    .join(", ");

  // When a pure `/metrics` snapshot is truncated by handoff omission/metrics markers, prevent the
  // handoff metadata lines alone from mislabeling `inputKind` as `"mixed"`.
  const onlyHandoffMarkersOutsideMetrics =
    report.inputKind === "mixed" &&
    report.metrics.hasMetrics &&
    rawInput.split("\n").every((ln) => {
      const t = ln.trim();
      return (
        t === "" ||
        t.startsWith("#") ||
        isAnyValidPromReSyntaxLine(t) ||
        t === "[infra-view] metrics truncated" ||
        /^\.\.\.\s*\[日志节选：[^\]]*\]\s*\.\.\.$/.test(t)
      );
    });
  const effectiveInputKind = onlyHandoffMarkersOutsideMetrics ? "metrics" : report.inputKind;

  const effectiveRank = report.firstFaultVerdict.rank;
  const effectiveLineNumber = report.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber ?? null;
  const effectiveConfidence = report.firstFaultVerdict.confidence;
  const effectiveCascadeCount = report.firstFaultVerdict.cascadeRanks.length;
  const effectiveRationale = report.firstFaultVerdict.rationale;

  const keyMetrics: Record<string, ToolEvidenceMetricValue> = {
    inputKind: effectiveInputKind,
    totalLines: report.totalLines,
    excerptTruncated,
    detectedRankCount: report.detectedRanks.length,
    firstFaultRank: effectiveRank,
    firstFaultLineNumber: effectiveLineNumber,
    firstFaultConfidence: effectiveConfidence,
    primaryEvidence: buildPrimaryEvidenceExcerpt(report, activeFindings, rawInput),
    cascadeRankCount: effectiveCascadeCount,
    findingCount: activeFindings.length,
    errorFindingCount: errorCount,
    warnFindingCount: warnCount,
    unmatchedErrorLineCount: report.unmatchedErrorLines.length,
    hasMetrics: report.metrics.hasMetrics,
    metricsIncomplete,
    metricsOverflow,
    kvCacheUsageRatio:
      !metricsIncomplete && !kvOverflow && roundedKvRatio !== undefined ? roundedKvRatio : null,
    numPreemptionsTotal:
      !metricsIncomplete && !preemptOverflow && rawPreemptions !== undefined ? rawPreemptions : null,
    topRuleIds: topRules || "none",
  };

  const lineScopeNote = excerptTruncated
    ? `已截断摘录保留非空 ${report.totalLines} 行（原输入更长，具体出处见 L 行号）`
    : `共 ${report.totalLines} 行`;
  const summary = [
    `[日志与指标排错确定性核算] 输入类型=${effectiveInputKind}（${lineScopeNote}，识别 Rank ${report.detectedRanks.length} 个）：`,
    `首发故障判定 Rank=${effectiveRank ?? "未知"}（置信度=${effectiveConfidence}，级联 Rank 数=${effectiveCascadeCount}）；`,
    `命中规则 ${activeFindings.length} 条（错误 ${errorCount} / 告警 ${warnCount}）：${topRules || "无"}；`,
    metricsIncomplete
      ? "指标样本在交接截断时被部分丢弃，KV 使用率、抢占总数与依赖指标聚合的告警均已置空/抑制（metricsIncomplete=true），不得据此推断总量；"
      : metricsOverflow
        ? "部分指标样本求和超出 IEEE-754 有限数值范围（metricsOverflow=true），对应聚合指标及依赖该聚合的阈值告警均已置空/抑制；"
        : "",
    `判定依据：${effectiveRationale}。`,
  ].join("");

  return buildEvidence("troubleshoot", { rawInput }, summary, keyMetrics);
}

export function runDeterministicToolEvidence(analysis: ChatAnalysisInput): ToolEvidenceV1 {
  const checked = chatAnalysisInputSchema.parse(analysis);
  switch (checked.kind) {
    case "deploy":
      return runDeployEvidence(checked);
    case "doctor":
      return runDoctorEvidence(checked);
    case "troubleshoot":
      return runTroubleshootEvidence(checked);
  }
}

function sliceUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Buffer.byteLength(text.slice(0, mid), "utf8") <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  // Never leave a dangling high surrogate at the cut.
  const last = text.charCodeAt(lo - 1);
  return last >= 0xd800 && last <= 0xdbff ? text.slice(0, lo - 1) : text.slice(0, lo);
}

const COMPACT_SUMMARY_MAX_BYTES = 600;

/**
 * Renders evidence for the system prompt within TOOL_EVIDENCE_LIMITS.maxPromptBytes.
 * The last line is always a complete JSON array of whole evidence items; when items must
 * be dropped, the preceding line records how many were omitted. Degradation order:
 * full -> compact (sanitizedInput dropped; keyMetrics incl. bounded primaryEvidence kept)
 * -> compact with summaries clipped -> longest prefix of whole clipped items.
 */
export function formatToolEvidenceForPrompt(evidence: ToolEvidenceV1 | readonly ToolEvidenceV1[]): string {
  const items: readonly ToolEvidenceV1[] = Array.isArray(evidence) ? evidence : [evidence as ToolEvidenceV1];
  if (items.length === 0) return "";
  const maxBytes = TOOL_EVIDENCE_LIMITS.maxPromptBytes;
  const header = [
    "【服务端确定性工具核算证据（ToolEvidenceV1 · 权威数值约束）】",
    "以下 JSON 由服务端纯函数确定性工具直接核算生成（零 shell / 零写盘），所有显存占用、KV 池容量、Roofline 带宽/算力强度、配置体检判定与日志首发故障结论必须严格以本工具输出为准：",
    "1. 严禁心算改写、四舍五入篡改或编造工具已核算的数值、单位、阻塞项与静默改写结论；",
    "2. 解释底层原理、公式出处与参数交互机制时，仍须引用对应的知识库 Wiki 页面链接；",
    "3. 若工具输出仅覆盖静态模型估算或局部日志片段，须如实保留适用边界，不得将其夸大为目标硬件实测结果。",
  ].join("\n");
  const render = (body: readonly unknown[], omitted: number): string => {
    const lines = [header];
    if (omitted > 0) {
      lines.push(
        `（受提示词体积上限 ${maxBytes} 字节约束，另有 ${omitted} 条证据被整条省略；下方 JSON 仅包含前 ${body.length} 条完整证据，omittedEvidenceCount=${omitted}）`,
      );
    }
    lines.push(JSON.stringify(body));
    return lines.join("\n");
  };
  const fits = (text: string): boolean => Buffer.byteLength(text, "utf8") <= maxBytes;

  const full = render(items, 0);
  if (fits(full)) return full;

  const compactItems = items.map((item) => ({
    kind: item.kind,
    toolVersion: item.toolVersion,
    inputSha256: item.inputSha256,
    summary: item.summary,
    keyMetrics: item.keyMetrics,
    outputSha256: item.outputSha256,
    sanitizedInputOmitted: true,
  }));
  const compact = render(compactItems, 0);
  if (fits(compact)) return compact;

  const trimmedItems = compactItems.map((item) => ({
    ...item,
    summary: sliceUtf8Bytes(item.summary, COMPACT_SUMMARY_MAX_BYTES),
  }));
  const trimmed = render(trimmedItems, 0);
  if (fits(trimmed)) return trimmed;

  // Largest prefix of whole items that fits (size grows monotonically with the prefix length).
  let lo = 0;
  let hi = trimmedItems.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits(render(trimmedItems.slice(0, mid), trimmedItems.length - mid))) lo = mid;
    else hi = mid - 1;
  }
  return render(trimmedItems.slice(0, lo), trimmedItems.length - lo);
}
