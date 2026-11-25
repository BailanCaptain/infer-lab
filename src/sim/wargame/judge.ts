/**
 * Track 3B (#8b): 生产故障实战通关场 —— 纯确定性防逃课判卷引擎（`sim` 层，零框架依赖）。
 * 联合校验：① 根因单选题；② CLI 语法/模型/拓扑/零未知参数；③ ConfigDoctor 零 error 且无退役变量；
 * ④ DeployCalculator 7 级账本 `oomStatus === "ok"` 且未暴力关图逃课；⑤ 关卡专项修复约束。
 */

import { type ParsedVllmServeCommand, parseVllmServeCommand } from "../doctor/cliParser";
import {
  DEFAULT_GPU_MEMORY_UTILIZATION,
  type PdConfigDoctorReport,
  runPdConfigDoctor,
  runSingleConfigDoctor,
  type SingleConfigDoctorReport,
} from "../doctor/configDoctor";
import {
  type UpgradeTargetVersion,
  VALID_ASCEND_COMPILATION_KEYS,
  VALID_ASCEND_FUSION_KEYS,
  VALID_SCHEDULER_KEYS_BY_TARGET,
  VALID_TOP_LEVEL_KEYS_BY_TARGET,
} from "../doctor/upgradeRadar";
import {
  type DeployPlanInput,
  type DeployPlanReport,
  evaluateDeployPlan,
  type HeadroomStatus,
  type KvCacheDtype,
  type KvOomStatus,
  type WeightPrecision,
} from "../modelspec/deployCalculator";
import type { CudaGraphMode } from "../rules";
import {
  getWarGameScenario,
  type WarGameDebrief,
  type WarGameOptionId,
  type WarGameScenario,
  type WarGameScenarioId,
} from "./scenarios";

export type NormalizedDeployOomStatus =
  | "ok"
  | KvOomStatus
  | `headroom_${Exclude<HeadroomStatus, "safe">}`
  | "q1_blocked"
  | "invalid_command";

export type WarGameCheckId =
  | "root-cause-choice"
  | "cli-syntax-and-unknown-flags"
  | "target-model-and-topology"
  | "config-doctor-clean"
  | "memory-and-graph-guard"
  | "scenario-specific-fix";

export interface WarGameCheckItem {
  id: WarGameCheckId;
  label: string;
  passed: boolean;
  detail: string;
}

export interface WarGameSubmission {
  scenarioId: WarGameScenarioId;
  selectedOptionId: WarGameOptionId | null | undefined;
  commandText: string;
  decodeCommandText?: string | undefined;
}

export interface WarGameJudgeResult {
  scenarioId: WarGameScenarioId;
  passed: boolean;
  oomStatus: NormalizedDeployOomStatus;
  checks: readonly WarGameCheckItem[];
  singleDoctor?: SingleConfigDoctorReport | undefined;
  pdDoctor?: PdConfigDoctorReport | undefined;
  deployPlan?: DeployPlanReport | undefined;
  decodeDeployPlan?: DeployPlanReport | undefined;
  unlockedDebrief: WarGameDebrief | null;
}

const ALLOWED_COMPILATION_KEYS: ReadonlySet<string> = new Set([
  "cudagraph_mode",
  "cudagraph_capture_sizes",
  "max_cudagraph_capture_size",
  "custom_ops",
  "pass_config",
  "level",
  "mode",
  "backend",
  "compile_sizes",
  "splitting_ops",
  "use_inductor",
  "use_cudagraph",
]);

const ALLOWED_KV_TRANSFER_KEYS: ReadonlySet<string> = new Set([
  "kv_connector",
  "kv_role",
  "kv_rank",
  "kv_parallel_size",
  "kv_ip",
  "kv_port",
  "kv_buffer_device",
  "kv_buffer_size",
  "kv_connector_extra_config",
  "kv_connector_module_path",
  "engine_id",
  "enable_permute_local_kv",
  "kv_load_failure_policy",
]);

function collectUnknownJsonKeys(
  parsed: ParsedVllmServeCommand,
  targetVersion: UpgradeTargetVersion,
): string[] {
  const bad: string[] = [];
  if (parsed.compilationConfig) {
    for (const k of Object.keys(parsed.compilationConfig)) {
      if (!ALLOWED_COMPILATION_KEYS.has(k)) bad.push(`--compilation-config.${k}`);
    }
  }
  if (parsed.additionalConfig) {
    const validTop = VALID_TOP_LEVEL_KEYS_BY_TARGET[targetVersion];
    const validSched = VALID_SCHEDULER_KEYS_BY_TARGET[targetVersion];
    for (const [k, v] of Object.entries(parsed.additionalConfig)) {
      if (!validTop.has(k)) {
        bad.push(`--additional-config.${k}`);
      } else if (k === "ascend_compilation_config" && v && typeof v === "object" && !Array.isArray(v)) {
        for (const subK of Object.keys(v)) {
          if (!VALID_ASCEND_COMPILATION_KEYS.has(subK)) {
            bad.push(`--additional-config.ascend_compilation_config.${subK}`);
          }
        }
      } else if (k === "ascend_fusion_config" && v && typeof v === "object" && !Array.isArray(v)) {
        for (const subK of Object.keys(v)) {
          if (!VALID_ASCEND_FUSION_KEYS.has(subK)) {
            bad.push(`--additional-config.ascend_fusion_config.${subK}`);
          }
        }
      } else if (k === "scheduler_config" && v && typeof v === "object" && !Array.isArray(v)) {
        for (const subK of Object.keys(v)) {
          if (!validSched.has(subK)) {
            bad.push(`--additional-config.scheduler_config.${subK}`);
          }
        }
      }
    }
  }
  if (parsed.kvTransferConfig) {
    for (const k of Object.keys(parsed.kvTransferConfig)) {
      if (!ALLOWED_KV_TRANSFER_KEYS.has(k)) bad.push(`--kv-transfer-config.${k}`);
    }
  }
  return bad;
}

function matchesTargetModel(
  parsed: ParsedVllmServeCommand,
  expectedPresetId: "qwen3-30b-a3b" | "qwen3-8b",
): boolean {
  if (!parsed.model) return false;
  if (expectedPresetId === "qwen3-30b-a3b") {
    return parsed.inferredHints.matchedPresetName === "Qwen3-30B-A3B";
  }
  return parsed.inferredHints.matchedPresetName === "Qwen3-8B";
}

function resolveEffectiveCudagraphMode(
  parsed: ParsedVllmServeCommand,
  hardwareFamily: WarGameScenario["hardwareFamily"],
): CudaGraphMode {
  if (parsed.enforceEager) return "NONE";
  if (parsed.couplingInput.cudagraphMode !== undefined) return parsed.couplingInput.cudagraphMode;
  return hardwareFamily === "310P" ? "NONE" : "PIECEWISE";
}

function resolveWeightPrecisionFromParsed(
  parsed: ParsedVllmServeCommand,
  scenario: WarGameScenario,
  effectiveModelDtype: string | undefined,
): WeightPrecision {
  const q = parsed.couplingInput.quantMethod;
  if (q === "ascend") {
    return scenario.hardwareFamily === "310P" ? "w8a8sc_310p" : "w8a8_dynamic";
  }
  if (q === "fp8") return "fp8_block";
  if (effectiveModelDtype === "float16") return "fp16";
  return "bf16";
}

function resolveKvCacheDtypeFromParsed(parsed: ParsedVllmServeCommand): KvCacheDtype {
  const raw = parsed.rawKvCacheDtype?.toLowerCase();
  if (raw === "int8") return "int8";
  if (raw === "mxfp8") return "mxfp8";
  return "auto";
}

function normalizeDeployPlanOomStatus(plan: DeployPlanReport): NormalizedDeployOomStatus {
  if (plan.fourQuestions.q1Fit.verdict === "blocked") return "q1_blocked";
  if (plan.fourQuestions.q2Capacity.oomStatus !== "fits") return plan.fourQuestions.q2Capacity.oomStatus;
  if (plan.headroomStatus !== "safe") return `headroom_${plan.headroomStatus}`;
  return "ok";
}

function evaluateParsedDeployPlan(
  parsed: ParsedVllmServeCommand,
  scenario: WarGameScenario,
  effectiveModelDtype: string | undefined,
): DeployPlanReport {
  const nzRaw = parsed.couplingInput.weightNzMode;
  const weightNzMode: 0 | 1 | 2 = nzRaw === 0 || nzRaw === 1 || nzRaw === 2 ? nzRaw : 1;
  const cudagraphMode = resolveEffectiveCudagraphMode(parsed, scenario.hardwareFamily);
  const captureSizes = parsed.couplingInput.cudagraphCaptureSizes;
  const input: DeployPlanInput = {
    model: scenario.mustKeep.targetModelPresetId,
    cardId: scenario.cardId,
    version: scenario.version,
    weightPrecision: resolveWeightPrecisionFromParsed(parsed, scenario, effectiveModelDtype),
    kvCacheDtype: resolveKvCacheDtypeFromParsed(parsed),
    weightNzMode,
    tpSize: parsed.couplingInput.tpSize ?? 1,
    ppSize: parsed.couplingInput.ppSize ?? 1,
    dpSize: parsed.couplingInput.dpSize ?? 1,
    pcpSize: parsed.couplingInput.pcpSize ?? 1,
    dcpSize: parsed.couplingInput.dcpSize ?? 1,
    enableEp: Boolean(parsed.couplingInput.enableExpertParallel),
    gpuMemoryUtilization: parsed.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION,
    ...(parsed.couplingInput.maxModelLen !== undefined
      ? { maxModelLen: parsed.couplingInput.maxModelLen }
      : {}),
    ...(parsed.couplingInput.maxNumBatchedTokens !== undefined
      ? { maxNumBatchedTokens: parsed.couplingInput.maxNumBatchedTokens }
      : {}),
    ...(parsed.couplingInput.maxNumSeqs !== undefined ? { maxNumSeqs: parsed.couplingInput.maxNumSeqs } : {}),
    ...(parsed.couplingInput.blockSize !== undefined ? { blockSize: parsed.couplingInput.blockSize } : {}),
    ...(parsed.couplingInput.useV2ModelRunner !== undefined
      ? { useV2ModelRunner: parsed.couplingInput.useV2ModelRunner }
      : {}),
    cudagraphMode,
    ...(captureSizes && captureSizes.length > 0 ? { cudagraphCaptureCount: captureSizes.length } : {}),
    enforceEager: parsed.enforceEager,
  };
  return evaluateDeployPlan(input);
}

const VALID_CLI_DTYPES: ReadonlySet<string> = new Set([
  "auto",
  "half",
  "float16",
  "bfloat16",
  "float",
  "float32",
]);

const VALID_CLI_KV_CACHE_DTYPES: ReadonlySet<string> = new Set([
  "auto",
  "int8",
  "fp8",
  "fp8_e4m3",
  "fp8_e5m2",
  "mxfp8",
  "bfloat16",
  "float16",
]);

const VALID_CLI_QUANT_METHODS: ReadonlySet<string> = new Set([
  "ascend",
  "fp8",
  "w8a8",
  "w8a8_dynamic",
  "gptq",
  "awq",
]);

const VALID_CUDAGRAPH_MODES: ReadonlySet<string> = new Set([
  "NONE",
  "PIECEWISE",
  "FULL",
  "FULL_DECODE_ONLY",
  "FULL_AND_PIECEWISE",
]);

const VALID_KV_ROLES: ReadonlySet<string> = new Set(["kv_producer", "kv_consumer", "kv_both"]);

const VALID_KV_CONNECTORS: ReadonlySet<string> = new Set([
  "MooncakeConnectorV1",
  "MooncakeConnector",
  "AscendStoreConnector",
  "LMCacheConnectorV1",
  "NixlConnector",
]);

function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function extractDockerOptionValues(dockerLine: string, flagPattern: string): string[] {
  const re = new RegExp(
    `(?:^|\\s)(?:${flagPattern})(?:\\s*=\\s*("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|[^\\s"']+)|\\s+("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|(?!--?\\w)[^\\s"']+))`,
    "g",
  );
  const out: string[] = [];
  for (const m of dockerLine.matchAll(re)) {
    const raw = m[1] ?? m[2];
    if (raw !== undefined) out.push(stripOuterQuotes(raw));
  }
  if (flagPattern.includes("-m")) {
    const attachedShortMemRe = /(?:^|\s)-m("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[0-9][^\s"']*)/g;
    for (const m of dockerLine.matchAll(attachedShortMemRe)) {
      if (m[1] !== undefined) out.push(stripOuterQuotes(m[1]));
    }
  }
  return out;
}

function hasAnyDockerOption(dockerLine: string, flagPattern: string): boolean {
  const re = new RegExp(`(?:^|\\s)(?:${flagPattern})(?=\\s|=|$)`);
  if (re.test(dockerLine)) return true;
  if (flagPattern.includes("-m")) {
    return /(?:^|\s)-m(?:["']|\d)/.test(dockerLine);
  }
  return false;
}

function parseDockerGiB(rawVal: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*([kmgt])i?b?$/i.exec(stripOuterQuotes(rawVal));
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === "k") return num / (1024 * 1024);
  if (unit === "m") return num / 1024;
  if (unit === "g") return num;
  return num * 1024;
}

function auditSingleCommandSyntax(
  parsed: ParsedVllmServeCommand,
  targetVersion: UpgradeTargetVersion,
  prefix = "",
): string[] {
  const issues: string[] = [];
  const tag = prefix ? `${prefix}：` : "";
  if (parsed.rawText.trim().length === 0) {
    issues.push(`${tag}命令为空`);
    return issues;
  }
  if (parsed.normalizedCommandLine.trim().length === 0 || parsed.model === null) {
    issues.push(`${tag}未检测到包含目标 <model> 的有效 vllm serve 命令`);
  }
  for (const diag of parsed.parseDiagnostics) {
    if (diag.severity === "error") {
      issues.push(`${tag}${diag.message}`);
    }
  }
  if (parsed.unknownFlags.length > 0) {
    issues.push(`${tag}存在未知或拼写错误的 CLI 参数：${parsed.unknownFlags.join(", ")}`);
  }
  if (parsed.rawDtype !== undefined && !VALID_CLI_DTYPES.has(parsed.rawDtype.trim().toLowerCase())) {
    issues.push(
      `${tag}非法的 --dtype="${parsed.rawDtype}"（仅允许 auto / bfloat16 / float16 / half / float32）`,
    );
  }
  if (
    parsed.rawKvCacheDtype !== undefined &&
    !VALID_CLI_KV_CACHE_DTYPES.has(parsed.rawKvCacheDtype.trim().toLowerCase())
  ) {
    issues.push(`${tag}非法的 --kv-cache-dtype="${parsed.rawKvCacheDtype}"`);
  }
  if (
    parsed.rawQuantization !== undefined &&
    !VALID_CLI_QUANT_METHODS.has(parsed.rawQuantization.trim().toLowerCase())
  ) {
    issues.push(`${tag}非法的 --quantization="${parsed.rawQuantization}"`);
  }
  if (parsed.compilationConfig && Object.hasOwn(parsed.compilationConfig, "cudagraph_mode")) {
    const rawCg = parsed.compilationConfig.cudagraph_mode;
    if (typeof rawCg !== "string" || !VALID_CUDAGRAPH_MODES.has(rawCg.trim().toUpperCase())) {
      issues.push(
        `${tag}--compilation-config.cudagraph_mode="${String(rawCg)}" 非法（仅允许 NONE / PIECEWISE / FULL / FULL_DECODE_ONLY / FULL_AND_PIECEWISE）`,
      );
    }
  }
  if (parsed.kvTransferConfig) {
    if (Object.hasOwn(parsed.kvTransferConfig, "kv_connector")) {
      const rawConn = parsed.kvTransferConfig.kv_connector;
      if (typeof rawConn !== "string" || !VALID_KV_CONNECTORS.has(rawConn.trim())) {
        issues.push(`${tag}未知或非法的 kv_connector="${String(rawConn)}"`);
      }
    }
    if (Object.hasOwn(parsed.kvTransferConfig, "kv_role")) {
      const rawRole = parsed.kvTransferConfig.kv_role;
      if (typeof rawRole !== "string" || !VALID_KV_ROLES.has(rawRole.trim())) {
        issues.push(
          `${tag}非法的 kv_role="${String(rawRole)}"（仅允许 kv_producer / kv_consumer / kv_both）`,
        );
      }
    }
  }
  const badJsonKeys = collectUnknownJsonKeys(parsed, targetVersion);
  if (badJsonKeys.length > 0) {
    issues.push(`${tag}JSON 配置含未知或拼错字段：${badJsonKeys.join(", ")}`);
  }
  return issues;
}

function auditSingleTopology(
  parsed: ParsedVllmServeCommand,
  scenario: WarGameScenario,
  role: "single" | "prefill" | "decode",
): string[] {
  const issues: string[] = [];
  const tag = role === "single" ? "" : role === "prefill" ? "Prefill 端：" : "Decode 端：";
  const keep = scenario.mustKeep;

  if (!matchesTargetModel(parsed, keep.targetModelPresetId)) {
    issues.push(
      `${tag}目标模型被篡改（须保持 ${keep.targetModelCanonical} 系列，当前为 ${parsed.model ?? "未指定"}）`,
    );
  }
  const tp = parsed.couplingInput.tpSize ?? 1;
  const pp = parsed.couplingInput.ppSize ?? 1;
  const dp = parsed.couplingInput.dpSize ?? 1;
  const pcp = parsed.couplingInput.pcpSize ?? 1;
  const dcp = parsed.couplingInput.dcpSize ?? 1;
  if (pcp !== 1) {
    issues.push(`${tag}PCP=${pcp} 超出本关硬件卡数预算（须保持 PCP=1）`);
  }
  if (dcp !== 1) {
    issues.push(`${tag}DCP=${dcp} 与本关必守拓扑不符（须保持 DCP=1）`);
  }
  if (role === "decode") {
    const expectedDecodePp = keep.decodePpSize ?? 1;
    if (keep.decodeTpSize !== undefined) {
      if (tp !== keep.decodeTpSize) {
        issues.push(`${tag}Decode TP=${tp} 与本关必守契约 Decode TP=${keep.decodeTpSize} 不符`);
      }
    } else if (![1, 2, 4].includes(tp) || keep.tpSize % tp !== 0) {
      issues.push(`${tag}Decode TP=${tp} 非法（须整除 Prefill TP=${keep.tpSize}）`);
    }
    if (pp !== expectedDecodePp) {
      issues.push(`${tag}Decode PP=${pp} 被篡改（Mooncake D 端须保持 PP=${expectedDecodePp}）`);
    }
  } else {
    if (tp !== keep.tpSize) {
      issues.push(`${tag}TP=${tp} 与必守拓扑 TP=${keep.tpSize} 不符`);
    }
    if (pp !== keep.ppSize) {
      issues.push(`${tag}PP=${pp} 与必守拓扑 PP=${keep.ppSize} 不符`);
    }
    const totalRanks = tp * pp * dp * pcp;
    const expectedRanks = keep.tpSize * keep.ppSize * keep.dpSize;
    if (totalRanks !== expectedRanks) {
      issues.push(`${tag}总逻辑卡数=${totalRanks} 超出或偏离本关预算（须为 ${expectedRanks} 卡）`);
    }
  }
  if (dp !== keep.dpSize) {
    issues.push(`${tag}DP=${dp} 与必守拓扑 DP=${keep.dpSize} 不符`);
  }
  if (keep.requireEp && !parsed.couplingInput.enableExpertParallel) {
    issues.push(`${tag}缺少必守的 --enable-expert-parallel`);
  }
  if (keep.requireAscendQuantFlag && parsed.couplingInput.quantMethod !== "ascend") {
    issues.push(`${tag}缺少必守的 --quantization ascend（W8A8 ModelSlim 量化）`);
  }
  if (!keep.requireAscendQuantFlag && parsed.couplingInput.quantMethod !== undefined) {
    issues.push(
      `${tag}不允许擅自更改权重量化方案（当前检测到 --quantization ${parsed.couplingInput.quantMethod}）`,
    );
  }
  if (parsed.rawDtype !== undefined) {
    const normDtype = parsed.rawDtype.trim().toLowerCase();
    if (normDtype === "float" || normDtype === "float32") {
      issues.push(
        `${tag}不允许使用 --dtype=${parsed.rawDtype}（FP32 会使权重与激活显存翻倍且偏离本关 ${keep.weightPrecision.toUpperCase()} 生产契约）`,
      );
    } else if (keep.weightPrecision === "bf16" && (normDtype === "float16" || normDtype === "half")) {
      issues.push(`${tag}本关必守权重精度为 BF16，不允许将 --dtype 改为 ${parsed.rawDtype}`);
    } else if (keep.weightPrecision === "fp16" && normDtype === "bfloat16") {
      issues.push(`${tag}本关必守权重精度为 FP16，不允许将 --dtype 改为 ${parsed.rawDtype}`);
    }
  }
  if (keep.requiredConnector) {
    const actualConn =
      typeof parsed.kvTransferConfig?.kv_connector === "string"
        ? parsed.kvTransferConfig.kv_connector.trim()
        : undefined;
    if (actualConn !== keep.requiredConnector) {
      issues.push(
        `${tag}kv_connector="${actualConn ?? "未设"}" 被篡改（本关须保持 ${keep.requiredConnector}）`,
      );
    }
  }
  const effMaxLen = parsed.couplingInput.maxModelLen ?? 0;
  if (effMaxLen < keep.minMaxModelLen) {
    issues.push(
      `${tag}--max-model-len=${effMaxLen} 低于本关底线 ${keep.minMaxModelLen}（严禁缩减上下文逃课）`,
    );
  }
  return issues;
}

function evaluateScenarioSpecificCheck(params: {
  scenario: WarGameScenario;
  parsedP: ParsedVllmServeCommand;
  parsedD: ParsedVllmServeCommand | null;
  pdDoctor: PdConfigDoctorReport | undefined;
}): WarGameCheckItem {
  const { scenario, parsedP, pdDoctor } = params;
  const effectiveU = parsedP.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION;
  const cgMode = resolveEffectiveCudagraphMode(parsedP, scenario.hardwareFamily);

  switch (scenario.id) {
    case "rank3-oom-ei0006": {
      const ok = !parsedP.enforceEager && cgMode !== "NONE" && effectiveU >= 0.85 && effectiveU <= 0.9;
      return {
        id: "scenario-specific-fix",
        label: "专项修复：保持图模式并将 u 降至 0.85 ~ 0.90",
        passed: ok,
        detail: ok
          ? `已保留图模式 (${cgMode}) 并将 gpu_memory_utilization=${effectiveU.toFixed(2)} 控制在 0.85~0.90 安全带。`
          : `当前 u=${effectiveU.toFixed(2)}、图模式=${cgMode}；须保留图模式并将 --gpu-memory-utilization 调整至 0.85 ~ 0.90。`,
      };
    }
    case "910b3-u090-aclgraph-oom": {
      const graphKept = !parsedP.enforceEager && cgMode !== "NONE";
      const validU =
        graphKept &&
        effectiveU >= 0.6 &&
        ((cgMode === "FULL_DECODE_ONLY" && effectiveU <= 0.9) || effectiveU <= 0.88);
      return {
        id: "scenario-specific-fix",
        label: "专项修复：保图模式降 u <= 0.88（或 FULL_DECODE_ONLY + u <= 0.90）",
        passed: validU,
        detail: validU
          ? `已按规范配置 cudagraph_mode=${cgMode} 且 u=${effectiveU.toFixed(2)}，留足 910B3 录图预算外余量。`
          : !graphKept
            ? "检测到关闭了 ACLGraph（--enforce-eager 或 NONE），本关严禁暴力关图逃课。"
            : `当前 cudagraph_mode=${cgMode}、u=${effectiveU.toFixed(2)}；保留 ${cgMode} 须 u <= 0.88，或改用 FULL_DECODE_ONLY 配合 u <= 0.90。`,
      };
    }
    case "metrics-preemption-avalanche": {
      const maxSeqs = parsedP.couplingInput.maxNumSeqs ?? 256;
      const prefixEnabled = parsedP.enablePrefixCaching !== false;
      const uSafe = effectiveU >= 0.86 && effectiveU <= 0.9;
      const seqsSafe = maxSeqs >= 16 && maxSeqs <= 128;
      const graphActive = !parsedP.enforceEager && cgMode !== "NONE";
      const ok = uSafe && seqsSafe && prefixEnabled && graphActive;
      return {
        id: "scenario-specific-fix",
        label: "专项修复：收敛 max-num-seqs(16~128)、调回 u(0.86~0.90) 并开启 Prefix Caching",
        passed: ok,
        detail: ok
          ? `已收敛 max_num_seqs=${maxSeqs}、调回 u=${effectiveU.toFixed(2)} 并启用 Prefix Caching，消除 KV 抢占重算风暴。`
          : [
              !seqsSafe ? `当前 max_num_seqs=${maxSeqs}（须收敛至 16 ~ 128 以防块池挤爆）` : "",
              !uSafe ? `当前 u=${effectiveU.toFixed(2)}（须调回 0.86 ~ 0.90 释放可用 KV 池）` : "",
              !prefixEnabled
                ? "仍保留 --no-enable-prefix-caching（请改为 --enable-prefix-caching 复用共享前缀）"
                : "",
              !graphActive ? "严禁关闭 ACLGraph 图模式" : "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    }
    case "legacy-v030-silent-degrade": {
      const noLegacyNz = !Object.hasOwn(parsedP.envVars, "VLLM_ASCEND_ENABLE_NZ");
      const nzZero = parsedP.couplingInput.weightNzMode === 0;
      const graphActive = !parsedP.enforceEager && cgMode !== "NONE";
      const ok = noLegacyNz && nzZero && graphActive;
      return {
        id: "scenario-specific-fix",
        label: "专项修复：移除退役 NZ 变量与 --enforce-eager，改传 weight_nz_mode=0",
        passed: ok,
        detail: ok
          ? `已移除退役变量、通过 additional_config 设置 weight_nz_mode=0，并恢复 ${cgMode} 图模式。`
          : [
              !noLegacyNz ? "仍残留退役变量 VLLM_ASCEND_ENABLE_NZ" : "",
              !nzZero ? '未在 --additional-config 中设置 "weight_nz_mode":0' : "",
              !graphActive ? "仍处于 Eager / NONE 无图状态（请移除 --enforce-eager）" : "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    }
    case "exit-137-cgroup-sigkill": {
      const noCudaEnv = !Object.hasOwn(parsedP.envVars, "CUDA_VISIBLE_DEVICES");
      const vis = parsedP.visibleDevices;
      const validAscendEnv =
        Object.hasOwn(parsedP.envVars, "ASCEND_RT_VISIBLE_DEVICES") &&
        vis !== null &&
        vis.length === 4 &&
        new Set(vis).size === 4;
      const reasonableU = effectiveU >= 0.85 && effectiveU <= 0.92;

      const dockerLine = parsedP.shellPreamble.find((s) => /\bdocker\s+run\b/.test(s)) ?? "";
      const hasDockerRun = dockerLine.length > 0;
      const ipcVals = extractDockerOptionValues(dockerLine, "--ipc");
      const hasIpcHost = ipcVals.some((v) => v.toLowerCase() === "host");
      const shmVals = extractDockerOptionValues(dockerLine, "--shm-size");
      const lastShmRaw = shmVals.length > 0 ? shmVals[shmVals.length - 1] : undefined;
      const shmGiB = lastShmRaw !== undefined ? parseDockerGiB(lastShmRaw) : null;
      const shmFixed = hasDockerRun && (hasIpcHost || (shmGiB !== null && shmGiB >= 16));

      const hasMemFlag = hasAnyDockerOption(dockerLine, "--memory|-m");
      const memVals = extractDockerOptionValues(dockerLine, "--memory|-m");
      const lastMemRaw = memVals.length > 0 ? memVals[memVals.length - 1] : undefined;
      const memFixed =
        hasDockerRun &&
        (!hasMemFlag || (memVals.length > 0 && memVals.every((v) => (parseDockerGiB(v) ?? 0) >= 128)));

      const ok = noCudaEnv && validAscendEnv && reasonableU && shmFixed && memFixed;
      return {
        id: "scenario-specific-fix",
        label: "专项修复：扩容容器 --shm-size>=16g / 内存限制，并改用 ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
        passed: ok,
        detail: ok
          ? `已修复容器共享内存/DRAM 限制并设置 ASCEND_RT_VISIBLE_DEVICES=${parsedP.envVars.ASCEND_RT_VISIBLE_DEVICES}（u=${effectiveU.toFixed(2)}）。`
          : [
              !hasDockerRun ? "请保留并修复第一行 docker run 容器启动命令（勿直接删掉容器层）" : "",
              hasDockerRun && !shmFixed
                ? `容器共享内存不足（当前 ${lastShmRaw ?? "未设"}，须设 --shm-size=16g 或 >=16g / --ipc=host）`
                : "",
              hasDockerRun && !memFixed
                ? `容器 cgroup 内存硬限过低或格式非法（当前 ${lastMemRaw ?? "参数未正确闭合"}，4 进程加载 30B 分片须设 >=128g 或移除 32g 硬限）`
                : "",
              !noCudaEnv ? "仍残留无效的 CUDA_VISIBLE_DEVICES" : "",
              !validAscendEnv
                ? "须显式导出包含 4 张不重复卡号的 ASCEND_RT_VISIBLE_DEVICES（如 0,1,2,3）"
                : "",
              !reasonableU
                ? `当前 u=${effectiveU.toFixed(2)}（本关 exit 137 首要排查容器 DRAM/shm 限制而非 NPU HBM 预算，请将 u 保持在 0.85~0.92）`
                : "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    }
    case "pd-mooncake-kv-mismatch": {
      const pRole = pdDoctor?.prefill.effectiveInput.kvRole;
      const dRole = pdDoctor?.decode.effectiveInput.kvRole;
      const pConn =
        typeof parsedP.kvTransferConfig?.kv_connector === "string"
          ? parsedP.kvTransferConfig.kv_connector.trim()
          : undefined;
      const dConn =
        typeof params.parsedD?.kvTransferConfig?.kv_connector === "string"
          ? params.parsedD.kvTransferConfig.kv_connector.trim()
          : undefined;
      const checkMooncakeExtra = (
        kvCfg: Record<string, unknown> | null,
        sideLabel: string,
      ): string | null => {
        const extra = kvCfg?.kv_connector_extra_config;
        if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
          return `${sideLabel}缺少 kv_connector_extra_config（MooncakeConnectorV1 须声明 prefill/decode 拓扑）`;
        }
        const ex = extra as Record<string, unknown>;
        const pre =
          ex.prefill && typeof ex.prefill === "object" && !Array.isArray(ex.prefill)
            ? (ex.prefill as Record<string, unknown>)
            : null;
        const dec =
          ex.decode && typeof ex.decode === "object" && !Array.isArray(ex.decode)
            ? (ex.decode as Record<string, unknown>)
            : null;
        if (!pre || !dec) {
          return `${sideLabel} kv_connector_extra_config 须同时包含 prefill 与 decode 子对象`;
        }
        const expPTp = parsedP.couplingInput.tpSize ?? 1;
        const expPDp = parsedP.couplingInput.dpSize ?? 1;
        const expPPp = parsedP.couplingInput.ppSize ?? 1;
        const expDTp = params.parsedD?.couplingInput.tpSize ?? 1;
        const expDDp = params.parsedD?.couplingInput.dpSize ?? 1;
        if (pre.tp_size !== expPTp || pre.dp_size !== expPDp) {
          return `${sideLabel} extra_config.prefill(tp=${String(pre.tp_size)},dp=${String(pre.dp_size)}) 与实际 Prefill CLI(tp=${expPTp},dp=${expPDp}) 失配`;
        }
        if (pre.pp_size !== undefined && pre.pp_size !== expPPp) {
          return `${sideLabel} extra_config.prefill.pp_size=${String(pre.pp_size)} 与实际 Prefill PP=${expPPp} 失配`;
        }
        if (dec.tp_size !== expDTp || dec.dp_size !== expDDp) {
          return `${sideLabel} extra_config.decode(tp=${String(dec.tp_size)},dp=${String(dec.dp_size)}) 与实际 Decode CLI(tp=${expDTp},dp=${expDDp}) 失配`;
        }
        if (dec.pp_size !== undefined && dec.pp_size !== 1) {
          return `${sideLabel} extra_config.decode.pp_size=${String(dec.pp_size)} 非法（Decode PP 须为 1）`;
        }
        return null;
      };
      const pExtraErr = checkMooncakeExtra(parsedP.kvTransferConfig, "Prefill 端");
      const dExtraErr = checkMooncakeExtra(params.parsedD?.kvTransferConfig ?? null, "Decode 端");
      const ok =
        Boolean(pdDoctor && pdDoctor.errors.length === 0) &&
        pRole === "kv_producer" &&
        dRole === "kv_consumer" &&
        pConn === "MooncakeConnectorV1" &&
        dConn === "MooncakeConnectorV1" &&
        pExtraErr === null &&
        dExtraErr === null;
      return {
        id: "scenario-specific-fix",
        label:
          "专项修复：4P(kv_producer)→2D(kv_consumer)、MooncakeConnectorV1 且两侧 KV 精度与 extra_config 拓扑一致",
        passed: ok,
        detail: ok
          ? `P/D 双实例角色（kv_producer → kv_consumer）、MooncakeConnectorV1、extra_config 拓扑与 KV 精度联检全部对齐。`
          : [
              `当前 P 端 kv_role=${pRole ?? "未设"}(${pConn ?? "无"})、D 端 kv_role=${dRole ?? "未设"}(${dConn ?? "无"})，阻断错误 ${pdDoctor?.errors.length ?? 0} 项`,
              pExtraErr ?? "",
              dExtraErr ?? "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    }
  }
}

export function judgeWarGameSubmission(submission: WarGameSubmission): WarGameJudgeResult {
  const scenario = getWarGameScenario(submission.scenarioId);
  const isPd = scenario.topology === "pd";

  // ① 单选题校验（错误时不剧透正确选项 ID）
  const choiceOk = submission.selectedOptionId === scenario.question.correctOptionId;
  const choiceCheck: WarGameCheckItem = {
    id: "root-cause-choice",
    label: "根因与首错归因单选题",
    passed: choiceOk,
    detail: choiceOk
      ? `回答正确（选项 ${scenario.question.correctOptionId}）：${scenario.question.explanation}`
      : submission.selectedOptionId
        ? `当前所选选项 ${submission.selectedOptionId} 与现场日志/指标证据链不符，请结合时间戳或指标重新判读。`
        : "尚未作答根因单选题，请先从 A/B/C/D 中选出正确归因。",
  };

  // ② CLI 非空、合法语法与零 unknownFlags 校验
  const targetVer: UpgradeTargetVersion = scenario.version === "main" ? "main" : "v0.30.0";
  const parsedP = parseVllmServeCommand(submission.commandText);
  const parsedD = isPd ? parseVllmServeCommand(submission.decodeCommandText ?? "") : null;
  const syntaxIssues = [
    ...auditSingleCommandSyntax(parsedP, targetVer, isPd ? "Prefill 端" : ""),
    ...(parsedD ? auditSingleCommandSyntax(parsedD, targetVer, "Decode 端") : []),
  ];
  const syntaxOk = syntaxIssues.length === 0;
  const syntaxCheck: WarGameCheckItem = {
    id: "cli-syntax-and-unknown-flags",
    label: "命令非空、语法合法且零未知参数（unknownFlags=0）",
    passed: syntaxOk,
    detail: syntaxOk ? "命令语法解析通过，无拼写错误的 CLI 开关或非法 JSON 字段。" : syntaxIssues.join("；"),
  };

  // ③ 目标模型与必守并行/量化拓扑防篡改校验
  const topoIssues = [
    ...auditSingleTopology(parsedP, scenario, isPd ? "prefill" : "single"),
    ...(parsedD ? auditSingleTopology(parsedD, scenario, "decode") : []),
  ];
  const topoOk = syntaxOk && topoIssues.length === 0;
  const topoCheck: WarGameCheckItem = {
    id: "target-model-and-topology",
    label: "目标模型与必守拓扑未被篡改",
    passed: topoOk,
    detail: !syntaxOk
      ? "需先修复命令行语法后再核验模型与并行拓扑。"
      : topoOk
        ? `已保留目标模型 ${scenario.mustKeep.targetModelCanonical} 与必守并行/量化契约。`
        : topoIssues.join("；"),
  };

  // ④ ConfigDoctor 零 error 且无退役环境变量残留
  const singleDoctor = !isPd
    ? runSingleConfigDoctor(submission.commandText, {
        mode: "full",
        hardwareFamily: scenario.hardwareFamily,
        version: scenario.version,
      })
    : undefined;
  const pdDoctor = isPd
    ? runPdConfigDoctor(submission.commandText, submission.decodeCommandText ?? "", {
        hardwareFamily: scenario.hardwareFamily,
        decodeHardwareFamily: scenario.decodeHardwareFamily ?? scenario.hardwareFamily,
        version: scenario.version,
      })
    : undefined;

  const docErrors = isPd ? (pdDoctor?.errors ?? []) : (singleDoctor?.errors ?? []);
  const retiredEnvs = isPd
    ? [
        ...(pdDoctor?.prefill.envClassifications.filter((e) => e.judgment === "retired") ?? []),
        ...(pdDoctor?.decode.envClassifications.filter((e) => e.judgment === "retired") ?? []),
      ]
    : (singleDoctor?.envClassifications.filter((e) => e.judgment === "retired") ?? []);
  const doctorOk = syntaxOk && docErrors.length === 0 && retiredEnvs.length === 0;
  const doctorCheck: WarGameCheckItem = {
    id: "config-doctor-clean",
    label: "ConfigDoctor 零阻断 error 且无退役环境变量残留",
    passed: doctorOk,
    detail: doctorOk
      ? "ConfigDoctor 规则体检通过：0 项 error，0 项退役环境变量残留。"
      : [
          docErrors.length > 0 ? `存在 ${docErrors.length} 项阻断错误（首项：${docErrors[0]?.title}）` : "",
          retiredEnvs.length > 0
            ? `存在已下线的退役环境变量：${retiredEnvs.map((e) => e.name).join(", ")}`
            : "",
          !syntaxOk && docErrors.length === 0 ? "命令语法未就绪" : "",
        ]
          .filter(Boolean)
          .join("；"),
  };

  // ⑤ 显存算账 evaluateDeployPlan (oomStatus === "ok") 与防暴力关图守卫
  const deployPlan = syntaxOk
    ? evaluateParsedDeployPlan(
        parsedP,
        scenario,
        isPd ? pdDoctor?.prefill.effectiveInput.modelDtype : singleDoctor?.effectiveInput.modelDtype,
      )
    : undefined;
  const decodeDeployPlan =
    syntaxOk && parsedD
      ? evaluateParsedDeployPlan(parsedD, scenario, pdDoctor?.decode.effectiveInput.modelDtype)
      : undefined;

  const pOomStatus: NormalizedDeployOomStatus = deployPlan
    ? normalizeDeployPlanOomStatus(deployPlan)
    : "invalid_command";
  const dOomStatus: NormalizedDeployOomStatus = decodeDeployPlan
    ? normalizeDeployPlanOomStatus(decodeDeployPlan)
    : "ok";
  const oomStatus: NormalizedDeployOomStatus = pOomStatus !== "ok" ? pOomStatus : dOomStatus;

  const cgModeP = resolveEffectiveCudagraphMode(parsedP, scenario.hardwareFamily);
  const cgModeD = parsedD
    ? resolveEffectiveCudagraphMode(parsedD, scenario.decodeHardwareFamily ?? scenario.hardwareFamily)
    : "PIECEWISE";
  const forbidEager = scenario.hardwareFamily !== "310P";
  const graphGuardOk = forbidEager
    ? !parsedP.enforceEager &&
      cgModeP !== "NONE" &&
      (!parsedD || (!parsedD.enforceEager && cgModeD !== "NONE"))
    : true;
  const memAndGraphOk = syntaxOk && topoOk && oomStatus === "ok" && graphGuardOk;
  const memAndGraphCheck: WarGameCheckItem = {
    id: "memory-and-graph-guard",
    label: "7 级显存算账 oomStatus=ok 且未暴力关图逃课",
    passed: memAndGraphOk,
    detail: memAndGraphOk
      ? `evaluateDeployPlan 核算通过（oomStatus=ok，1−u 录图余量 safe${forbidEager ? `，图模式=${cgModeP}` : ""}）。`
      : [
          !graphGuardOk ? "检测到通过 --enforce-eager 或 cudagraph_mode=NONE 暴力关闭图模式逃课" : "",
          oomStatus !== "ok" ? `7 级显存与余量评估未通过（oomStatus=${oomStatus}）` : "",
          !topoOk ? "模型或并行拓扑未满足关卡基线" : "",
        ]
          .filter(Boolean)
          .join("；"),
  };

  // ⑥ 关卡专项根因修复校验
  const specificCheck = evaluateScenarioSpecificCheck({
    scenario,
    parsedP,
    parsedD,
    pdDoctor,
  });

  const checks: readonly WarGameCheckItem[] = [
    choiceCheck,
    syntaxCheck,
    topoCheck,
    doctorCheck,
    memAndGraphCheck,
    specificCheck,
  ];
  const passed = checks.every((c) => c.passed);

  return {
    scenarioId: scenario.id,
    passed,
    oomStatus,
    checks,
    ...(singleDoctor ? { singleDoctor } : {}),
    ...(pdDoctor ? { pdDoctor } : {}),
    ...(deployPlan ? { deployPlan } : {}),
    ...(decodeDeployPlan ? { decodeDeployPlan } : {}),
    unlockedDebrief: passed ? scenario.debrief : null,
  };
}
