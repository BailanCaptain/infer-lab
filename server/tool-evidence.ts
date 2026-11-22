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
  evaluateDeployPlan,
  GIB,
  MIB,
  WAVE4_DEMO_PRESETS,
} from "../src/sim/modelspec/deployCalculator";
import { parseHfConfig } from "../src/sim/modelspec/parseHfConfig";
import { MODEL_PRESETS } from "../src/sim/modelspec/presets";
import { analyzeTroubleshootInput, type LogAnalysisReport } from "../src/sim/troubleshoot/logAnalyzer";

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
  maxConfigKeys: 200,
  maxConfigDepth: 6,
} as const;

const SHA256_RE = /^[a-f0-9]{64}$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape codes from pasted terminal logs
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

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

export const deployAnalysisInputSchema = z
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
    pcpSize: z.number().int().min(1).max(256).optional(),
    dcpSize: z.number().int().min(1).max(256).optional(),
    enableEp: z.boolean().optional(),
    enableEplb: z.boolean().optional(),
    dynamicEplb: z.boolean().optional(),
    engramCpuOffload: z.boolean().optional(),
    numSpecTokens: z.number().int().min(0).max(16).optional(),
    gpuMemoryUtilization: z.number().finite().min(0.05).max(0.999).optional(),
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

export const doctorAnalysisInputSchema = z
  .object({
    kind: z.literal("doctor"),
    command: z.string().trim().min(1).max(TOOL_EVIDENCE_LIMITS.maxCommandChars),
    decodeCommand: z.string().trim().min(1).max(TOOL_EVIDENCE_LIMITS.maxCommandChars).optional(),
    mode: z.enum(["minimal", "full"]).optional(),
    hardwareFamily: ascendFamilySchema.optional(),
    decodeHardwareFamily: ascendFamilySchema.optional(),
    version: ruleVersionSchema.optional(),
    crossNodeRoce: z.boolean().optional(),
  })
  .strict();

export const troubleshootAnalysisInputSchema = z
  .object({
    kind: z.literal("troubleshoot"),
    rawInput: z.string().trim().min(1).max(TOOL_EVIDENCE_LIMITS.maxTroubleshootChars),
  })
  .strict();

export const chatAnalysisInputSchema = z.discriminatedUnion("kind", [
  deployAnalysisInputSchema,
  doctorAnalysisInputSchema,
  troubleshootAnalysisInputSchema,
]);

export type ChatAnalysisInput = z.infer<typeof chatAnalysisInputSchema>;

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

const SECRET_KEY_RE = /api[_-]?key|secret|token|password|authorization/i;

const MULTI_VALUE_SECRET_FLAG_RE =
  /(?<![A-Za-z0-9_-])(--(?:api[-_]?key|access[-_]?token|auth[-_]?token|bearer[-_]?token|token|password|passwd|secret|client[-_]?secret|bearer))((?:[ \t]*=[ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"'\\;|&<>(){}]+))|(?:(?:(?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*)(?:"[^"\r\n]*"|'[^'\r\n]*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+))+))/gi;
const SECRET_FLAG_SEP_TOKEN_RE =
  /((?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*))("[^"\r\n]*"|'[^'\r\n]*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+)/g;

export function redactSensitiveText(raw: string): string {
  return raw
    .replace(MULTI_VALUE_SECRET_FLAG_RE, (full, flag: string, tail: string) => {
      if (/^[ \t]*=/.test(tail)) return `${flag}=[REDACTED]`;
      let matched = 0;
      const replaced = tail.replace(SECRET_FLAG_SEP_TOKEN_RE, (_m, sep: string) => {
        matched += 1;
        return `${sep}[REDACTED]`;
      });
      if (matched === 0) return full;
      return `${flag}${replaced}`;
    })
    .replace(/(Authorization\s*:\s*Bearer\s+)([^\s"']+)/gi, "$1[REDACTED]")
    .replace(/(Authorization\s*:\s*(?:Basic|Token)\s+)([^\s"']+)/gi, "$1[REDACTED]")
    .replace(
      /\b((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|DEEPSEEK_API_KEY|HF_TOKEN|HUGGING_FACE_HUB_TOKEN|VLLM_API_KEY|[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)))\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"']+)/g,
      "$1=[REDACTED]",
    )
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,})\b/g, "[REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, "$1[REDACTED]@");
}

function sanitizeTextPayload(label: string, raw: string, maxChars: number): string {
  const stripped = raw.replace(/\r\n?/g, "\n").replace(ANSI_ESCAPE_RE, "").trim();
  if (!stripped) throw new Error(`${label}不能为空`);
  if (stripped.length > maxChars) throw new Error(`${label}超出长度上限（最多 ${maxChars} 字符）`);
  const clean = sanitizeRawInput(stripped);
  if (clean.blocked) {
    throw new Error(`${label}清洗未通过（${clean.findings.map((f) => f.reason).join("、")}）`);
  }
  return redactSensitiveText(clean.text);
}

function sanitizeConfigObject(input: unknown, depth = 0, keyCounter = { count: 0 }): unknown {
  if (depth > TOOL_EVIDENCE_LIMITS.maxConfigDepth) {
    throw new Error(`模型 config.json 嵌套层级超过上限（${TOOL_EVIDENCE_LIMITS.maxConfigDepth}）`);
  }
  if (input === null || typeof input === "boolean") return input;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("模型 config.json 包含非有限数值");
    return input;
  }
  if (typeof input === "string") {
    if (input.length > 512) throw new Error("模型 config.json 字段字符串过长");
    const stripped = input.replace(ANSI_ESCAPE_RE, "");
    const clean = sanitizeRawInput(stripped);
    if (clean.blocked && stripped.trim().length > 0) {
      throw new Error("模型 config.json 字符串清洗未通过");
    }
    return clean.blocked ? "" : redactSensitiveText(clean.text);
  }
  if (Array.isArray(input)) {
    if (input.length > 256) throw new Error("模型 config.json 数组长度超出上限");
    return input.map((item) => sanitizeConfigObject(item, depth + 1, keyCounter));
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k) || k.length > 80) continue;
      keyCounter.count += 1;
      if (keyCounter.count > TOOL_EVIDENCE_LIMITS.maxConfigKeys) {
        throw new Error(`模型 config.json 字段数量超出上限（${TOOL_EVIDENCE_LIMITS.maxConfigKeys}）`);
      }
      if (v === undefined) continue;
      if (SECRET_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeConfigObject(v, depth + 1, keyCounter);
      }
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

function runDeployEvidence(input: z.infer<typeof deployAnalysisInputSchema>): ToolEvidenceV1 {
  let resolvedModel: DeployPlanInput["model"];
  let sanitizedModel: string | Record<string, unknown>;
  if (typeof input.model === "string") {
    const presetId = input.model.trim();
    if (!ALLOWED_PRESET_IDS.has(presetId)) {
      throw new Error(`未知模型预设 ${presetId}；请使用内置预设 ID 或传入合法 config.json 对象`);
    }
    sanitizedModel = presetId;
    const wave4 = WAVE4_DEMO_PRESETS.find((p) => p.id === presetId);
    resolvedModel = wave4 ? wave4.config : presetId;
  } else {
    const cleanConfig = sanitizeConfigObject(input.model) as Record<string, unknown>;
    if (Buffer.byteLength(JSON.stringify(cleanConfig), "utf8") > TOOL_EVIDENCE_LIMITS.maxRawConfigBytes) {
      throw new Error(`模型 config.json 超过体积上限（${TOOL_EVIDENCE_LIMITS.maxRawConfigBytes} 字节）`);
    }
    sanitizedModel = cleanConfig;
    // Always validate external custom configs strictly through parseHfConfig so they can never bypass checks as internal ModelSpec.
    resolvedModel = parseHfConfig(cleanConfig);
  }

  const { kind: _kind, model: _model, ...rest } = input;
  const planInput: DeployPlanInput = { ...rest, model: resolvedModel };
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

  return buildEvidence("deploy", { ...rest, model: sanitizedModel }, summary, keyMetrics);
}

function runDoctorEvidence(input: z.infer<typeof doctorAnalysisInputSchema>): ToolEvidenceV1 {
  const command = sanitizeTextPayload("启动命令", input.command, TOOL_EVIDENCE_LIMITS.maxCommandChars);
  const decodeCommand = input.decodeCommand
    ? sanitizeTextPayload("Decode 启动命令", input.decodeCommand, TOOL_EVIDENCE_LIMITS.maxCommandChars)
    : undefined;
  const hardwareFamily = input.hardwareFamily ?? "A2";
  const version = input.version ?? "v0.30.0";
  const mode = input.mode ?? "full";

  let keyMetrics: Record<string, ToolEvidenceMetricValue>;
  let summary: string;

  if (decodeCommand) {
    const report: PdConfigDoctorReport = runPdConfigDoctor(command, decodeCommand, {
      hardwareFamily,
      decodeHardwareFamily: input.decodeHardwareFamily,
      version,
      crossNodeRoce: input.crossNodeRoce,
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
      crossNodeRoce: input.crossNodeRoce,
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
    summary = `[单实例配置体检确定性核算] 硬件=${report.hardwareFamily}（模式=${report.mode}, 规则=${report.version}）：阻塞=${report.hasBlockers ? "是" : "否"}（错误 ${report.errors.length} / 静默改写 ${report.silentRewrites.length} / 告警 ${report.warnings.length} / 生效改写 ${report.effectiveRewrites.length}），默认批 token=${report.batchTokensResolution.finalMaxNumBatchedTokens}；命中规则：${topRules || "无"}。静态规则体检边界：仅基于命令与环境参数静态校验。`;
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
    },
    summary,
    keyMetrics,
  );
}

function runTroubleshootEvidence(input: z.infer<typeof troubleshootAnalysisInputSchema>): ToolEvidenceV1 {
  const rawInput = sanitizeTextPayload(
    "排错日志或指标",
    input.rawInput,
    TOOL_EVIDENCE_LIMITS.maxTroubleshootChars,
  );
  const report: LogAnalysisReport = analyzeTroubleshootInput(rawInput);
  const errorCount = report.findings.filter((f) => f.severity === "error").length;
  const warnCount = report.findings.filter((f) => f.severity === "warn").length;
  const topRules = report.findings
    .slice(0, 6)
    .map((f) => `${f.ruleId}(${f.severity})`)
    .join(", ");

  const keyMetrics: Record<string, ToolEvidenceMetricValue> = {
    inputKind: report.inputKind,
    totalLines: report.totalLines,
    detectedRankCount: report.detectedRanks.length,
    firstFaultRank: report.firstFaultVerdict.rank,
    firstFaultConfidence: report.firstFaultVerdict.confidence,
    cascadeRankCount: report.firstFaultVerdict.cascadeRanks.length,
    findingCount: report.findings.length,
    errorFindingCount: errorCount,
    warnFindingCount: warnCount,
    unmatchedErrorLineCount: report.unmatchedErrorLines.length,
    hasMetrics: report.metrics.hasMetrics,
    kvCacheUsageRatio:
      report.metrics.kvCacheUsageRatio !== undefined ? round2(report.metrics.kvCacheUsageRatio) : null,
    numPreemptionsTotal: report.metrics.numPreemptionsTotal ?? null,
    topRuleIds: topRules || "none",
  };

  const summary = [
    `[日志与指标排错确定性核算] 输入类型=${report.inputKind}（共 ${report.totalLines} 行，识别 Rank ${report.detectedRanks.length} 个）：`,
    `首发故障判定 Rank=${report.firstFaultVerdict.rank ?? "未知"}（置信度=${report.firstFaultVerdict.confidence}，级联 Rank 数=${report.firstFaultVerdict.cascadeRanks.length}）；`,
    `命中规则 ${report.findings.length} 条（错误 ${errorCount} / 告警 ${warnCount}）：${topRules || "无"}；`,
    `判定依据：${report.firstFaultVerdict.rationale}。`,
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
  return text.slice(0, lo);
}

export function formatToolEvidenceForPrompt(evidence: ToolEvidenceV1 | readonly ToolEvidenceV1[]): string {
  const items = Array.isArray(evidence) ? evidence : [evidence];
  if (items.length === 0) return "";
  const header = [
    "【服务端确定性工具核算证据（ToolEvidenceV1 · 权威数值约束）】",
    "以下 JSON 由服务端纯函数确定性工具直接核算生成（零 shell / 零写盘），所有显存占用、KV 池容量、Roofline 带宽/算力强度、配置体检判定与日志首发故障结论必须严格以本工具输出为准：",
    "1. 严禁心算改写、四舍五入篡改或编造工具已核算的数值、单位、阻塞项与静默改写结论；",
    "2. 解释底层原理、公式出处与参数交互机制时，仍须引用对应的知识库 Wiki 页面链接；",
    "3. 若工具输出仅覆盖静态模型估算或局部日志片段，须如实保留适用边界，不得将其夸大为目标硬件实测结果。",
  ].join("\n");

  const full = `${header}\n${JSON.stringify(items)}`;
  if (Buffer.byteLength(full, "utf8") <= TOOL_EVIDENCE_LIMITS.maxPromptBytes) return full;

  // Compact representation drops bulky sanitizedInput while keeping digests, summary, and keyMetrics intact.
  const compactItems = items.map((item) => ({
    kind: item.kind,
    toolVersion: item.toolVersion,
    inputSha256: item.inputSha256,
    summary: item.summary,
    keyMetrics: item.keyMetrics,
    outputSha256: item.outputSha256,
    sanitizedInputOmitted: true,
  }));
  const compact = `${header}\n${JSON.stringify(compactItems)}`;
  if (Buffer.byteLength(compact, "utf8") <= TOOL_EVIDENCE_LIMITS.maxPromptBytes) return compact;

  const trimmedItems = compactItems.map((item) => ({
    ...item,
    summary: sliceUtf8Bytes(item.summary, 600),
  }));
  const trimmed = `${header}\n${JSON.stringify(trimmedItems)}`;
  if (Buffer.byteLength(trimmed, "utf8") <= TOOL_EVIDENCE_LIMITS.maxPromptBytes) return trimmed;

  return sliceUtf8Bytes(trimmed, TOOL_EVIDENCE_LIMITS.maxPromptBytes);
}
