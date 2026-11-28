/**
 * Track 3B (#8b): 生产故障实战通关场 —— 纯确定性防逃课判卷引擎（`sim` 层，零框架依赖）。
 * 联合校验：① 根因单选题；② CLI 语法/模型/拓扑/零未知参数；③ ConfigDoctor 零 error 且无退役变量；
 * ④ DeployCalculator 7 级账本 `oomStatus === "ok"` 且未暴力关图逃课；⑤ 关卡专项修复约束。
 */

import {
  normalizeShellContinuations,
  type ParsedVllmServeCommand,
  parseVllmServeCommand,
} from "../doctor/cliParser";
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

// Pinned vllm@ced6857a vllm/config/compilation.py CompilationConfig fields
const ALLOWED_COMPILATION_KEYS: ReadonlySet<string> = new Set([
  "mode",
  "debug_dump_path",
  "cache_dir",
  "compile_cache_save_format",
  "backend",
  "custom_ops",
  "splitting_ops",
  "use_inductor_graph_partition",
  "inductor_compile_config",
  "inductor_passes",
  "cudagraph_mode",
  "cudagraph_num_of_warmups",
  "cudagraph_capture_sizes",
  "cudagraph_copy_inputs",
  "cudagraph_specialize_lora",
  "compile_sizes",
  "compile_ranges_endpoints",
  "dynamic_shapes_config",
  "fast_moe_cold_start",
  "pass_config",
  "ir_enable_torch_wrap",
  "compile_mm_encoder",
  "cudagraph_mm_encoder",
  "encoder_cudagraph_token_budgets",
  "encoder_cudagraph_max_vision_items_per_batch",
  "encoder_cudagraph_max_frames_per_batch",
  "max_cudagraph_capture_size",
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

function hasGraphOrCompileDisabledOverride(parsed: ParsedVllmServeCommand): boolean {
  if (parsed.enforceEager) return true;
  const cc = parsed.compilationConfig;
  if (cc) {
    if (Object.hasOwn(cc, "mode")) {
      const mode = typeof cc.mode === "string" ? cc.mode.trim().toUpperCase() : cc.mode;
      if (mode === 0 || mode === 0n || mode === "0" || mode === "NONE") return true;
    }
    if (Object.hasOwn(cc, "backend")) {
      const backend = typeof cc.backend === "string" ? cc.backend.trim().toLowerCase() : "";
      if (backend === "eager" || backend === "none") return true;
    }
  }
  if (
    parsed.couplingInput.cudagraphCaptureSizes !== undefined &&
    parsed.couplingInput.cudagraphCaptureSizes.length === 0
  ) {
    return true;
  }
  if (
    parsed.couplingInput.maxCudagraphCaptureSize !== undefined &&
    parsed.couplingInput.maxCudagraphCaptureSize <= 0
  ) {
    return true;
  }
  return false;
}

function resolveEffectiveCudagraphMode(
  parsed: ParsedVllmServeCommand,
  hardwareFamily: WarGameScenario["hardwareFamily"],
): CudaGraphMode {
  if (hasGraphOrCompileDisabledOverride(parsed)) return "NONE";
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

const VALID_COMPILATION_MODES: ReadonlySet<string> = new Set([
  "NONE",
  "STOCK_TORCH_COMPILE",
  "DYNAMO_TRACE_ONCE",
  "VLLM_COMPILE",
]);

const VALID_KV_ROLES: ReadonlySet<string> = new Set(["kv_producer", "kv_consumer", "kv_both"]);

// Pinned vllm@ced6857a vllm/distributed/kv_transfer/kv_connector/factory.py + vllm-ascend@v0.30.0
const VALID_KV_CONNECTORS: ReadonlySet<string> = new Set([
  "ExampleConnector",
  "ExampleHiddenStatesConnector",
  "MultiConnector",
  "MooncakeConnectorV1",
  "MooncakeD2RHConnectorV1",
  "MooncakeConnectorV2",
  "MooncakePullConnector",
  "MooncakeHybridConnector",
  "MooncakeConnectorStoreV1",
  "MooncakeConnector",
  "MooncakeStoreConnector",
  "AscendStoreConnector",
  "MooncakeLayerwiseConnector",
  "UCMConnector",
  "OffloadingConnector",
  "SimpleCPUOffloadConnector",
  "PreemptOffloadConnector",
  "SfaRemoteD2HConnector",
  "LMCacheConnectorV1",
  "LMCacheMPConnector",
  "NixlConnector",
  "NixlPullConnector",
  "NixlPushConnector",
  "HiSparseConnector",
  "MoRIIOConnector",
  "DecodeBenchConnector",
  "FlexKVConnectorV1",
  "HF3FSKVConnector",
]);

// Matches vllm@ced6857a vllm/distributed/kv_transfer/kv_connector/factory.py +
// vllm-ascend@v0.30.0 vllm_ascend/distributed/kv_transfer/__init__.py#L45-L120:
// When kv_connector_module_path is explicit, factory looks up getattr(module, kv_connector),
// so only modules exporting that exact class name can pass a custom module path.
const VALID_CONNECTOR_MODULE_PATHS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["ExampleConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.example_connector"])],
  [
    "ExampleHiddenStatesConnector",
    new Set(["vllm.distributed.kv_transfer.kv_connector.v1.example_hidden_states_connector"]),
  ],
  [
    "LMCacheConnectorV1",
    new Set([
      "vllm.distributed.kv_transfer.kv_connector.v1.lmcache_connector",
      "vllm_ascend.distributed.kv_transfer.kv_pool.lmcache_ascend_connector",
    ]),
  ],
  ["LMCacheMPConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.lmcache_mp_connector"])],
  ["NixlConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.nixl"])],
  ["NixlPullConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.nixl"])],
  ["NixlPushConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.nixl"])],
  ["MultiConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.multi_connector"])],
  ["AscendMultiConnector", new Set(["vllm_ascend.distributed.kv_transfer.ascend_multi_connector"])],
  ["HiSparseConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.hisparse.connector"])],
  ["MoRIIOConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.moriio.moriio_connector"])],
  ["OffloadingConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.offloading_connector"])],
  [
    "AscendOffloadingConnector",
    new Set(["vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.offloading_connector"]),
  ],
  ["DecodeBenchConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.decode_bench_connector"])],
  ["MooncakeConnectorV1", new Set<string>()],
  ["MooncakeD2RHConnectorV1", new Set<string>()],
  ["MooncakeConnectorV2", new Set<string>()],
  ["MooncakePullConnector", new Set(["vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake.connector"])],
  ["MooncakeHybridConnector", new Set<string>()],
  ["MooncakeConnectorStoreV1", new Set<string>()],
  [
    "MooncakeConnector",
    new Set([
      "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_connector",
      "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_d2rh_connector",
      "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_hybrid_connector",
      "vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake.connector",
      "vllm.distributed.kv_transfer.kv_connector.v1.mooncake.mooncake_connector",
    ]),
  ],
  [
    "MooncakeStoreConnector",
    new Set(["vllm.distributed.kv_transfer.kv_connector.v1.mooncake.store.connector"]),
  ],
  [
    "AscendStoreConnector",
    new Set(["vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector"]),
  ],
  [
    "MooncakeLayerwiseConnector",
    new Set(["vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_layerwise_connector"]),
  ],
  ["UCMConnector", new Set<string>()],
  ["UCMConnectorV1", new Set(["vllm_ascend.distributed.kv_transfer.kv_pool.ucm_connector.connector"])],
  [
    "SimpleCPUOffloadConnector",
    new Set(["vllm.distributed.kv_transfer.kv_connector.v1.simple_cpu_offload_connector"]),
  ],
  [
    "AscendSimpleCPUOffloadConnector",
    new Set([
      "vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.simple.simple_cpu_offload_connector",
      "vllm_ascend.distributed.kv_transfer.kv_pool.simple_cpu_offload.simple_cpu_offload_connector",
    ]),
  ],
  ["PreemptOffloadConnector", new Set<string>()],
  [
    "PreemptOffloadConnectorV1",
    new Set([
      "vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.preempt_offload.preempt_offload_connector",
    ]),
  ],
  [
    "RecomputeCPUOffloadConnectorV1",
    new Set([
      "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
    ]),
  ],
  ["FlexKVConnectorV1", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.flexkv_connector"])],
  ["HF3FSKVConnector", new Set(["vllm.distributed.kv_transfer.kv_connector.v1.hf3fs.hf3fs_connector"])],
  ["SfaRemoteD2HConnector", new Set(["vllm_ascend.distributed.kv_transfer.kv_p2p.sfa_pd_rd2h.connector"])],
]);

interface ParsedDockerRunResult {
  readonly hasImage: boolean;
  readonly image: string | undefined;
  readonly lastIpc: string | undefined;
  readonly lastShmSize: string | undefined;
  readonly hasMemoryFlag: boolean;
  readonly lastMemory: string | undefined;
  readonly entrypoint: string | undefined;
  readonly devices: readonly string[];
  readonly deviceMappings: ReadonlyArray<{ readonly host: string; readonly container: string }>;
  readonly volumeMounts: readonly string[];
  readonly volumeMountEntries: ReadonlyArray<{ readonly hostSrc: string; readonly target: string }>;
  readonly runtime: string | undefined;
  readonly unknownFlags: readonly string[];
  readonly hasMissingFlagValue: boolean;
  readonly dockerEnv: Readonly<Record<string, string>>;
  readonly remainingAfterImage: readonly string[];
  readonly stmtOrder: number;
  launchesInsideContainer: number;
}

const DOCKER_RUN_BOOL_FLAGS: ReadonlySet<string> = new Set([
  "-d",
  "--detach",
  "-i",
  "--interactive",
  "-t",
  "--tty",
  "-q",
  "--quiet",
  "--rm",
  "--privileged",
  "--init",
  "--read-only",
  "--sig-proxy",
  "--oom-kill-disable",
  "--no-healthcheck",
  "--publish-all",
  "-P",
]);

const DOCKER_RUN_VALUE_FLAGS: ReadonlySet<string> = new Set([
  "--name",
  "--shm-size",
  "--ipc",
  "--memory",
  "-m",
  "--memory-swap",
  "--memory-reservation",
  "--kernel-memory",
  "-e",
  "--env",
  "--env-file",
  "--entrypoint",
  "--network",
  "--net",
  "--pid",
  "--uts",
  "--userns",
  "--cgroupns",
  "--device",
  "-v",
  "--volume",
  "--mount",
  "-p",
  "--publish",
  "-u",
  "--user",
  "-w",
  "--workdir",
  "--cap-add",
  "--cap-drop",
  "--security-opt",
  "--ulimit",
  "--label",
  "-l",
  "--hostname",
  "-h",
  "--restart",
  "--gpus",
  "--runtime",
  "--cpus",
  "-c",
  "--cpu-shares",
  "--cpuset-cpus",
  "--cpuset-mems",
  "--add-host",
  "--dns",
  "--log-driver",
  "--log-opt",
  "--platform",
  "--pull",
  "--cgroup-parent",
  "--stop-signal",
  "--stop-timeout",
  "--health-cmd",
  "--health-interval",
  "--health-retries",
  "--health-timeout",
  "--health-start-period",
]);

function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function parseDockerGiB(rawVal: string): number | "unlimited" | null {
  const cleaned = stripOuterQuotes(rawVal);
  const m = /^(\d+(?:\.\d+)?)\s*(b|[kmgt](?:i?b?)?)?$/i.exec(cleaned);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num) || num < 0) return null;
  if (num === 0) return "unlimited";
  const unitRaw = (m[2] ?? "b").toLowerCase();
  const prefix = unitRaw[0]!;
  if (prefix === "k") return num / (1024 * 1024);
  if (prefix === "m") return num / 1024;
  if (prefix === "g") return num;
  if (prefix === "t") return num * 1024;
  return num / (1024 * 1024 * 1024);
}

function normalizeContainerMountPath(rawPath: string): string {
  const cleaned = stripOuterQuotes(rawPath);
  return cleaned.length > 1 ? cleaned.replace(/\/+$/, "") : cleaned;
}

function parseDockerRunOptions(
  dockerArgs: readonly string[],
  hostExportedEnv: Readonly<Record<string, string>>,
  stmtOrder: number,
): ParsedDockerRunResult {
  let lastIpc: string | undefined;
  let lastShmSize: string | undefined;
  let hasMemoryFlag = false;
  let lastMemory: string | undefined;
  let entrypoint: string | undefined;
  let runtime: string | undefined;
  const devices: string[] = [];
  const deviceMappings: Array<{ host: string; container: string }> = [];
  const volumeMounts: string[] = [];
  const volumeMountEntries: Array<{ hostSrc: string; target: string }> = [];
  const unknownFlags: string[] = [];
  let hasMissingFlagValue = false;
  const dockerEnv: Record<string, string> = {};
  let imageIdx = dockerArgs.length;

  const recordDockerEnv = (entry: string): void => {
    const eq = entry.indexOf("=");
    if (eq > 0) {
      dockerEnv[entry.slice(0, eq)] = entry.slice(eq + 1);
    } else if (entry.length > 0 && Object.hasOwn(hostExportedEnv, entry)) {
      dockerEnv[entry] = hostExportedEnv[entry]!;
    }
  };
  const DOCKER_VALID_BIND_VOLUME_OPTS = new Set([
    "ro",
    "rw",
    "z",
    "Z",
    "shared",
    "rshared",
    "slave",
    "rslave",
    "private",
    "rprivate",
    "bind",
    "rbind",
    "nocopy",
    "consistent",
    "delegated",
    "cached",
  ]);
  const seenMountTargets = new Set<string>();
  const isValidHostMountSource = (hostSrc: string): boolean =>
    hostSrc.startsWith("/") && hostSrc !== "/dev" && !hostSrc.startsWith("/dev/");
  const isValidAscendHostDeviceForTarget = (hostDev: string, containerDev: string): boolean => {
    if (!hostDev.startsWith("/") || !containerDev.startsWith("/")) return false;
    if (/^\/dev\/davinci(?:0|[1-9]\d*)$/.test(containerDev)) {
      return /^\/dev\/davinci(?:0|[1-9]\d*)$/.test(hostDev);
    }
    if (containerDev === "/dev/davinci_manager") {
      return hostDev === "/dev/davinci_manager" || hostDev === "/dev/davinci_manager_docker";
    }
    if (containerDev === "/dev/devmm_svm" || containerDev === "/dev/hisi_hdc") {
      return hostDev === containerDev;
    }
    return false;
  };
  const recordDockerDevice = (spec: string): void => {
    const cleaned = stripOuterQuotes(spec);
    const parts = cleaned.split(":");
    if (parts.length === 0 || parts.length > 3) {
      unknownFlags.push(spec);
      return;
    }
    const hostDev = normalizeContainerMountPath(parts[0] ?? "");
    const containerDev =
      parts.length >= 2 && parts[1] !== "" ? normalizeContainerMountPath(parts[1]!) : hostDev;
    const mode = parts.length === 3 ? (parts[2] ?? "") : "rwm";
    const validMode =
      /^[rwm]{1,3}$/.test(mode) &&
      new Set(mode).size === mode.length &&
      mode.includes("r") &&
      mode.includes("w");
    if (!validMode || !isValidAscendHostDeviceForTarget(hostDev, containerDev)) {
      unknownFlags.push(spec);
      return;
    }
    devices.push(containerDev);
    deviceMappings.push({ host: hostDev, container: containerDev });
  };
  const recordDockerVolume = (spec: string): void => {
    const cleaned = stripOuterQuotes(spec);
    const parts = cleaned.split(":");
    if (parts.length > 3) {
      unknownFlags.push(spec);
      return;
    }
    if (parts.length < 2) return;
    const hostSrc = normalizeContainerMountPath(parts[0] ?? "");
    const target = normalizeContainerMountPath(parts[1] ?? "");
    if (!target.startsWith("/")) return;
    if (seenMountTargets.has(target)) {
      unknownFlags.push(spec);
      return;
    }
    seenMountTargets.add(target);
    if (parts.length === 3) {
      const optList = (parts[2] ?? "").split(",");
      const optSet = new Set(optList);
      if (
        optList.length === 0 ||
        optList.some((o) => !DOCKER_VALID_BIND_VOLUME_OPTS.has(o)) ||
        (optSet.has("ro") && optSet.has("rw"))
      ) {
        unknownFlags.push(spec);
        return;
      }
    }
    if (hostSrc.startsWith("/")) {
      volumeMountEntries.push({ hostSrc, target });
    }
    if (isValidHostMountSource(hostSrc)) {
      volumeMounts.push(target);
    }
  };
  const recordDockerMount = (spec: string): void => {
    const cleaned = stripOuterQuotes(spec);
    let mountType = "";
    let hostSrc = "";
    let targetPath: string | undefined;
    let hasInvalid = false;
    const allowedMountKeys = new Set([
      "type",
      "src",
      "source",
      "dst",
      "destination",
      "target",
      "readonly",
      "ro",
      "bind-propagation",
      "consistency",
      "bind-nonrecursive",
    ]);
    for (const seg of cleaned.split(",")) {
      const trimmed = seg.trim();
      if (!trimmed) {
        hasInvalid = true;
        break;
      }
      const eq = trimmed.indexOf("=");
      if (eq < 0) {
        if (trimmed !== "readonly" && trimmed !== "ro" && trimmed !== "bind-nonrecursive") {
          hasInvalid = true;
          break;
        }
        continue;
      }
      const k = trimmed.slice(0, eq).trim().toLowerCase();
      const v = trimmed.slice(eq + 1).trim();
      if (!allowedMountKeys.has(k) || !v) {
        hasInvalid = true;
        break;
      }
      if (k === "type") mountType = v.toLowerCase();
      else if (k === "src" || k === "source") hostSrc = normalizeContainerMountPath(v);
      else if (k === "target" || k === "dst" || k === "destination") {
        targetPath = normalizeContainerMountPath(v);
      } else if (
        (k === "readonly" || k === "ro" || k === "bind-nonrecursive") &&
        !/^(?:true|false|1|0)$/i.test(v)
      ) {
        hasInvalid = true;
        break;
      } else if (k === "bind-propagation" && !/^(?:r?private|r?shared|r?slave)$/.test(v)) {
        hasInvalid = true;
        break;
      } else if (
        k === "consistency" &&
        v !== "consistent" &&
        v !== "cached" &&
        v !== "delegated" &&
        v !== "default"
      ) {
        hasInvalid = true;
        break;
      }
    }
    if (hasInvalid) {
      unknownFlags.push(spec);
      return;
    }
    if (targetPath?.startsWith("/")) {
      if (seenMountTargets.has(targetPath)) {
        unknownFlags.push(spec);
        return;
      }
      seenMountTargets.add(targetPath);
      if (mountType === "bind") {
        if (hostSrc.startsWith("/")) {
          volumeMountEntries.push({ hostSrc, target: targetPath });
        }
        if (isValidHostMountSource(hostSrc)) {
          volumeMounts.push(targetPath);
        }
      }
    }
  };

  const parsePortRange = (seg: string, allowEmpty: boolean): { count: number } | null => {
    if (seg === "") return allowEmpty ? { count: 0 } : null;
    const m = /^(\d+)(?:-(\d+))?$/.exec(seg);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : a;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > 65535 || a > b) return null;
    return { count: b - a + 1 };
  };
  const isValidHostAndContainerPorts = (hostSeg: string, containerSeg: string): boolean => {
    const h = parsePortRange(hostSeg, true);
    const c = parsePortRange(containerSeg, false);
    return h !== null && c !== null && (h.count === 0 || h.count === c.count);
  };
  const isValidIPv6Literal = (ip: string): boolean => {
    if (!ip || ip.includes(":::")) return false;
    const dc = ip.split("::");
    if (dc.length > 2) return false;
    const parseGroups = (part: string): string[] | null => {
      if (part === "") return [];
      const segs = part.split(":");
      return segs.every((s) => /^[0-9a-fA-F]{1,4}$/.test(s)) ? segs : null;
    };
    if (dc.length === 2) {
      const left = parseGroups(dc[0]!);
      const right = parseGroups(dc[1]!);
      return left !== null && right !== null && left.length + right.length <= 7;
    }
    const groups = parseGroups(ip);
    return groups !== null && groups.length === 8;
  };
  const isValidDockerPublishSpec = (spec: string): boolean => {
    let body = stripOuterQuotes(spec).trim();
    if (!body) return false;
    const slashIdx = body.lastIndexOf("/");
    if (slashIdx >= 0) {
      const proto = body.slice(slashIdx + 1).toLowerCase();
      if (proto !== "tcp" && proto !== "udp" && proto !== "sctp") return false;
      body = body.slice(0, slashIdx);
    }
    if (body.startsWith("[")) {
      const closeBracket = body.indexOf("]:");
      if (closeBracket < 2) return false;
      const ipv6 = body.slice(1, closeBracket);
      if (!isValidIPv6Literal(ipv6)) return false;
      body = body.slice(closeBracket + 2);
      const restParts = body.split(":");
      if (restParts.length === 1) return parsePortRange(restParts[0]!, false) !== null;
      if (restParts.length === 2) {
        return isValidHostAndContainerPorts(restParts[0]!, restParts[1]!);
      }
      return false;
    }
    const parts = body.split(":");
    if (parts.length === 1) return parsePortRange(parts[0]!, false) !== null;
    if (parts.length === 2) {
      return isValidHostAndContainerPorts(parts[0]!, parts[1]!);
    }
    if (parts.length === 3) {
      const ip = parts[0]!;
      const validIp =
        ip === "" || (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) && ip.split(".").every((o) => Number(o) <= 255));
      return validIp && isValidHostAndContainerPorts(parts[1]!, parts[2]!);
    }
    return false;
  };
  const isValidDockerIpcMode = (rawIpc: string): boolean => {
    const cleaned = stripOuterQuotes(rawIpc).trim();
    return (
      cleaned === "none" ||
      cleaned === "private" ||
      cleaned === "shareable" ||
      cleaned === "host" ||
      /^container:[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(cleaned)
    );
  };

  for (let i = 0; i < dockerArgs.length; i += 1) {
    const tok = dockerArgs[i] ?? "";
    if (tok === "--") {
      imageIdx = Math.min(dockerArgs.length, i + 1);
      break;
    }
    if (!tok.startsWith("-") || tok === "-") {
      imageIdx = i;
      break;
    }
    const eqIdx = tok.indexOf("=");
    if (eqIdx > 0) {
      const flag = tok.slice(0, eqIdx);
      const val = tok.slice(eqIdx + 1);
      if (flag === "--ipc") {
        lastIpc = stripOuterQuotes(val);
        if (!isValidDockerIpcMode(val)) unknownFlags.push(tok);
      } else if (flag === "--shm-size") {
        lastShmSize = val;
        if (parseDockerGiB(val) === null) unknownFlags.push(tok);
      } else if (flag === "-e" || flag === "--env") recordDockerEnv(val);
      else if (flag === "--entrypoint") entrypoint = val;
      else if (flag === "--device") recordDockerDevice(val);
      else if (flag === "-v" || flag === "--volume") recordDockerVolume(val);
      else if (flag === "--mount") recordDockerMount(val);
      else if (flag === "-p" || flag === "--publish") {
        if (!isValidDockerPublishSpec(val)) unknownFlags.push(tok);
      } else if (flag === "--runtime") runtime = stripOuterQuotes(val);
      else if (flag === "--memory" || flag === "-m") {
        hasMemoryFlag = true;
        lastMemory = val;
        if (parseDockerGiB(val) === null) unknownFlags.push(tok);
      } else if (DOCKER_RUN_BOOL_FLAGS.has(flag)) {
        if (!/^(?:true|false|1|0)$/i.test(val)) {
          unknownFlags.push(tok);
        }
      } else if (!DOCKER_RUN_VALUE_FLAGS.has(flag)) {
        unknownFlags.push(flag);
      }
      continue;
    }
    if (tok.startsWith("-m") && tok.length > 2) {
      hasMemoryFlag = true;
      lastMemory = tok.slice(2);
      if (parseDockerGiB(lastMemory) === null) unknownFlags.push(tok);
      continue;
    }
    if (tok.startsWith("-p") && tok.length > 2) {
      if (!isValidDockerPublishSpec(tok.slice(2))) unknownFlags.push(tok);
      continue;
    }
    if (tok.startsWith("-e") && tok.length > 2) {
      recordDockerEnv(tok.slice(2));
      continue;
    }
    if (tok.startsWith("-v") && tok.length > 2) {
      recordDockerVolume(tok.slice(2));
      continue;
    }
    if (DOCKER_RUN_BOOL_FLAGS.has(tok) || /^-[ditPq]+$/.test(tok)) {
      continue;
    }
    if (!DOCKER_RUN_VALUE_FLAGS.has(tok)) {
      unknownFlags.push(tok);
      continue;
    }
    const nextVal = dockerArgs[i + 1];
    if (nextVal !== undefined) {
      i += 1;
      if (tok === "--ipc") {
        lastIpc = stripOuterQuotes(nextVal);
        if (!isValidDockerIpcMode(nextVal)) unknownFlags.push(`${tok}=${nextVal}`);
      } else if (tok === "--shm-size") {
        lastShmSize = nextVal;
        if (parseDockerGiB(nextVal) === null) unknownFlags.push(`${tok}=${nextVal}`);
      } else if (tok === "-e" || flagIsEnv(tok)) recordDockerEnv(nextVal);
      else if (tok === "--entrypoint") entrypoint = nextVal;
      else if (tok === "--device") recordDockerDevice(nextVal);
      else if (tok === "-v" || tok === "--volume") recordDockerVolume(nextVal);
      else if (tok === "--mount") recordDockerMount(nextVal);
      else if (tok === "-p" || tok === "--publish") {
        if (!isValidDockerPublishSpec(nextVal)) unknownFlags.push(`${tok}=${nextVal}`);
      } else if (tok === "--runtime") runtime = stripOuterQuotes(nextVal);
      else if (tok === "--memory" || tok === "-m") {
        hasMemoryFlag = true;
        lastMemory = nextVal;
        if (parseDockerGiB(nextVal) === null) unknownFlags.push(`${tok}=${nextVal}`);
      }
    } else {
      hasMissingFlagValue = true;
      if (tok === "--memory" || tok === "-m") {
        hasMemoryFlag = true;
        lastMemory = undefined;
      }
    }
  }

  const rawImage = imageIdx < dockerArgs.length ? dockerArgs[imageIdx] : undefined;
  const image = rawImage !== undefined && rawImage.trim().length > 0 ? rawImage : undefined;

  return {
    hasImage: image !== undefined,
    image,
    lastIpc,
    lastShmSize,
    hasMemoryFlag,
    lastMemory,
    entrypoint,
    devices,
    deviceMappings,
    volumeMounts,
    volumeMountEntries,
    runtime,
    unknownFlags,
    hasMissingFlagValue,
    dockerEnv,
    remainingAfterImage: imageIdx < dockerArgs.length ? dockerArgs.slice(imageIdx + 1) : [],
    stmtOrder,
    launchesInsideContainer: 0,
  };
}

function flagIsEnv(tok: string): boolean {
  return tok === "--env";
}

function parseHeredocRedirection(
  slice: string,
): { delimiter: string; stripTabs: boolean; quoted: boolean; consumed: number } | null {
  if (!slice.startsWith("<<") || slice.startsWith("<<<")) return null;
  let pos = 2;
  let stripTabs = false;
  if (slice[pos] === "-") {
    stripTabs = true;
    pos += 1;
  }
  while (pos < slice.length && (slice[pos] === " " || slice[pos] === "\t")) pos += 1;
  if (pos >= slice.length) return null;

  let delim = "";
  let hasWord = false;
  let quoted = false;
  let quote: "'" | '"' | null = null;
  while (pos < slice.length) {
    const c = slice[pos] ?? "";
    const n = slice[pos + 1] ?? "";
    if (quote === "'") {
      if (c === "'") quote = null;
      else delim += c;
      pos += 1;
      continue;
    }
    if (quote === '"') {
      if (c === "\\" && pos + 1 < slice.length) {
        if (n === '"' || n === "\\" || n === "$" || n === "`" || n === "\n") {
          if (n !== "\n") delim += n;
          pos += 2;
          continue;
        }
        delim += c + n;
        pos += 2;
        continue;
      }
      if (c === '"') quote = null;
      else delim += c;
      pos += 1;
      continue;
    }
    if (/[ \t\r\n;&|()<>]/.test(c)) break;
    hasWord = true;
    if (c === "'" || c === '"') {
      quoted = true;
      quote = c;
      pos += 1;
      continue;
    }
    if (c === "\\" && pos + 1 < slice.length) {
      quoted = true;
      delim += n;
      pos += 2;
      continue;
    }
    delim += c;
    pos += 1;
  }
  if (!hasWord || quote !== null) return null;
  return { delimiter: delim, stripTabs, quoted, consumed: pos };
}

function stripHeredocsFromLineOutsideQuotes(
  line: string,
  pending: { delimiter: string; stripTabs: boolean; quoted: boolean }[],
): string {
  let out = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    const next = line[i + 1] ?? "";
    if (quote === "'") {
      out += ch;
      if (ch === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (ch === "\\" && i + 1 < line.length) {
        out += ch + next;
        i += 1;
        continue;
      }
      out += ch;
      if (ch === '"') quote = null;
      continue;
    }
    if (ch === "\\" && i + 1 < line.length) {
      out += ch + next;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#" && (out.length === 0 || /[ \t\r;&|()]/.test(out[out.length - 1] ?? ""))) {
      break;
    }
    if (ch === "<" && next === "<" && line[i + 2] !== "<") {
      const hd = parseHeredocRedirection(line.slice(i));
      if (hd) {
        pending.push({ delimiter: hd.delimiter, stripTabs: hd.stripTabs, quoted: hd.quoted });
        out += " ";
        i += hd.consumed - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function hasTrailingLineContinuation(text: string): boolean {
  let slashCount = 0;
  for (let i = text.length - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function stripShellHeredocs(rawText: string): string {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const outLines: string[] = [];
  const pending: { delimiter: string; stripTabs: boolean; quoted: boolean }[] = [];
  let activeHeredoc: { delimiter: string; stripTabs: boolean; quoted: boolean } | null = null;
  let logicalLineBuf = "";

  for (const line of lines) {
    if (activeHeredoc) {
      if (activeHeredoc.quoted) {
        const candidate = activeHeredoc.stripTabs ? line.replace(/^\t+/, "") : line;
        if (candidate === activeHeredoc.delimiter) {
          activeHeredoc = pending.shift() ?? null;
          logicalLineBuf = "";
        }
        continue;
      }
      const seg = logicalLineBuf.length === 0 && activeHeredoc.stripTabs ? line.replace(/^\t+/, "") : line;
      if (hasTrailingLineContinuation(seg)) {
        logicalLineBuf += seg.slice(0, -1);
        continue;
      }
      const fullLine = logicalLineBuf + seg;
      logicalLineBuf = "";
      if (fullLine === activeHeredoc.delimiter) {
        activeHeredoc = pending.shift() ?? null;
      }
      continue;
    }
    const strippedLine = stripHeredocsFromLineOutsideQuotes(line, pending);
    outLines.push(strippedLine);
    if (pending.length > 0 && !hasTrailingLineContinuation(strippedLine)) {
      activeHeredoc = pending.shift() ?? null;
      logicalLineBuf = "";
    }
  }
  return outLines.join("\n");
}

interface ShellWordPart {
  readonly text: string;
  readonly expandable: boolean;
}

interface ShellToken {
  readonly kind: "word" | "op";
  readonly value: string;
  readonly quoted?: boolean;
  readonly assignBeforeQuote?: boolean;
  readonly precededBySpace?: boolean;
  readonly parts?: readonly ShellWordPart[] | undefined;
}

function isShellAsciiWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r";
}

function lexShellScript(rawText: string): { tokens: ShellToken[]; unterminatedQuote: boolean } {
  const withoutHeredocs = stripShellHeredocs(rawText);
  const src = normalizeShellContinuations(withoutHeredocs);
  const tokens: ShellToken[] = [];
  let i = 0;
  let unterminatedQuote = false;
  let hadLeadingSpace = true;

  while (i < src.length) {
    const ch = src[i] ?? "";
    if (ch === "\n") {
      tokens.push({ kind: "op", value: "\n", precededBySpace: hadLeadingSpace });
      hadLeadingSpace = true;
      i += 1;
      continue;
    }
    if (isShellAsciiWhitespace(ch)) {
      hadLeadingSpace = true;
      i += 1;
      continue;
    }
    if (ch === "#") {
      hadLeadingSpace = true;
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      tokens.push({ kind: "op", value: two, precededBySpace: hadLeadingSpace });
      hadLeadingSpace = false;
      i += 2;
      continue;
    }
    if (ch === ";" || ch === "|" || (ch === "&" && two !== "&>") || ch === "(" || ch === ")") {
      tokens.push({ kind: "op", value: ch, precededBySpace: hadLeadingSpace });
      hadLeadingSpace = false;
      i += 1;
      continue;
    }

    let word = "";
    let quote: "'" | '"' | null = null;
    let wasQuoted = false;
    let assignBeforeQuote = false;
    const wordPrecededBySpace = hadLeadingSpace;
    const parts: { text: string; expandable: boolean }[] = [];
    const pushPart = (text: string, expandable: boolean): void => {
      if (!text) return;
      const last = parts[parts.length - 1];
      if (last && last.expandable === expandable) {
        last.text += text;
      } else {
        parts.push({ text, expandable });
      }
    };
    while (i < src.length) {
      const c = src[i] ?? "";
      const n = src[i + 1] ?? "";
      if (quote === "'") {
        if (c === "'") {
          quote = null;
        } else {
          word += c;
          pushPart(c, false);
        }
        i += 1;
        continue;
      }
      if (quote === '"') {
        if (c === "\\" && i + 1 < src.length) {
          if (n === "\n") {
            i += 2;
            continue;
          }
          if (n === '"' || n === "\\" || n === "$" || n === "`") {
            word += n;
            pushPart(n, false);
            i += 2;
            continue;
          }
          word += c + n;
          pushPart(c + n, true);
          i += 2;
          continue;
        }
        if (c === '"') {
          quote = null;
        } else {
          word += c;
          pushPart(c, true);
        }
        i += 1;
        continue;
      }
      const isRedirAmp =
        c === "&" && (word.endsWith(">") || word.endsWith("<") || (word.length === 0 && n === ">"));
      if (
        isShellAsciiWhitespace(c) ||
        c === "\n" ||
        c === ";" ||
        c === "|" ||
        (c === "&" && !isRedirAmp) ||
        c === "(" ||
        c === ")"
      ) {
        break;
      }
      if (c === "'" || c === '"') {
        wasQuoted = true;
        quote = c;
        i += 1;
        continue;
      }
      if (c === "\\" && i + 1 < src.length) {
        if (n === "\n") {
          i += 2;
          continue;
        }
        wasQuoted = true;
        word += n;
        pushPart(n, false);
        i += 2;
        continue;
      }
      if (!wasQuoted && !assignBeforeQuote && c === "=" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(word)) {
        assignBeforeQuote = true;
      }
      word += c;
      pushPart(c, true);
      i += 1;
    }
    if (quote !== null) unterminatedQuote = true;
    tokens.push({
      kind: "word",
      value: word,
      quoted: wasQuoted,
      assignBeforeQuote,
      precededBySpace: wordPrecededBySpace,
      parts,
    });
    hadLeadingSpace = false;
  }
  return { tokens, unterminatedQuote };
}

const SERVE_ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;

const BENIGN_SHELL_COMMANDS: ReadonlySet<string> = new Set([
  "echo",
  "sleep",
  "mkdir",
  "pwd",
  "whoami",
  "npu-smi",
  "nvidia-smi",
  "set",
  "true",
  "false",
  ":",
]);

interface ShellLaunchEntry {
  readonly kind: "vllm-serve" | "python-api";
  readonly args: readonly string[];
  readonly envVars: Record<string, string>;
  readonly stmtOrder: number;
}

interface ShellExecutionReport {
  readonly launches: ShellLaunchEntry[];
  readonly dockerRuns: ParsedDockerRunResult[];
  bareFlagCount: number;
  unterminatedQuote: boolean;
  syntaxError: boolean;
  stmtSeq: number;
}

type ShellPipelineCmd =
  | { readonly kind: "simple"; readonly tokens: readonly ShellToken[]; readonly redirFailed: boolean }
  | { readonly kind: "subshell"; readonly inner: readonly ShellToken[]; readonly redirFailed: boolean }
  | { readonly kind: "group"; readonly inner: readonly ShellToken[]; readonly redirFailed: boolean }
  | { readonly kind: "arith"; readonly exprTokens: readonly ShellToken[]; readonly redirFailed: boolean }
  | {
      readonly kind: "funcdef";
      readonly name: string;
      readonly body: readonly ShellToken[];
      readonly isSubshell: boolean;
    }
  | {
      readonly kind: "if";
      readonly branches: ReadonlyArray<{ cond: readonly ShellToken[]; body: readonly ShellToken[] }>;
      readonly elseBody: readonly ShellToken[];
      readonly redirFailed: boolean;
    }
  | {
      readonly kind: "loop";
      readonly loopKind: "while" | "until";
      readonly cond: readonly ShellToken[];
      readonly body: readonly ShellToken[];
      readonly redirFailed: boolean;
    }
  | {
      readonly kind: "for";
      readonly varName: string;
      readonly implicitPositional: boolean;
      readonly items: readonly ShellToken[];
      readonly hasDynamicItems: boolean;
      readonly cStyle?:
        | {
            readonly init: readonly ShellToken[];
            readonly cond: readonly ShellToken[];
            readonly step: readonly ShellToken[];
          }
        | undefined;
      readonly body: readonly ShellToken[];
      readonly redirFailed: boolean;
    };

interface ShellPipeline {
  readonly negated: boolean;
  readonly commands: readonly ShellPipelineCmd[];
}

interface ShellAndOrClause {
  readonly op: "start" | "&&" | "||";
  readonly pipeline: ShellPipeline;
}

interface ShellListEntry {
  readonly clauses: readonly ShellAndOrClause[];
  readonly background: boolean;
}

const SHELL_CMD_POS_KEYWORDS: ReadonlySet<string> = new Set(["then", "else", "elif", "do", "{", "!"]);

function nextShellCmdPos(tok: ShellToken, prevCmdPos: boolean): boolean {
  if (tok.kind === "op") return tok.value !== ")";
  if (prevCmdPos && !tok.quoted && SHELL_CMD_POS_KEYWORDS.has(tok.value)) return true;
  return false;
}

function isInputRedirectionFailure(op: string, target: string): boolean {
  if (/^\d*[<>]&$/u.test(op)) {
    return !/^(?:\d+|-)$/.test(target) && isOutputTargetFailure(target);
  }
  if (op === "<>" || /^(?:\d*(?:>>?|>\||<>)|&>>?)$/.test(op) || op === ">") {
    if (op === "<>") {
      return isOutputTargetFailure(target) || (target !== "/dev/null" && !target.startsWith("/dev/fd/"));
    }
    return isOutputTargetFailure(target);
  }
  if (op === "<" || op === "0<" || /^\d+<$/.test(op)) {
    return (
      target !== "/dev/null" &&
      target !== "/dev/zero" &&
      target !== "/dev/stdin" &&
      target !== "/dev/urandom" &&
      target !== "/dev/random" &&
      !target.startsWith("/dev/fd/") &&
      target !== "/etc/hosts" &&
      target !== "/etc/passwd" &&
      target !== "/etc/group" &&
      target !== "/etc/os-release" &&
      target !== "/etc/nsswitch.conf" &&
      target !== "/etc/resolv.conf" &&
      target !== "/usr/bin/env"
    );
  }
  return target.startsWith("/nonexistent");
}

function isOutputTargetFailure(target: string): boolean {
  if (!target || target.startsWith("/nonexistent")) return true;
  if (
    target === "/" ||
    target.endsWith("/") ||
    target === "." ||
    target === ".." ||
    target === "/tmp" ||
    target === "/var/tmp" ||
    target === "/etc" ||
    target === "/dev" ||
    target === "/usr" ||
    target === "/usr/bin" ||
    target === "/usr/sbin" ||
    target === "/bin" ||
    target === "/sbin" ||
    target === "/lib" ||
    target === "/lib64" ||
    target === "/var" ||
    target === "/var/run" ||
    target === "/run" ||
    target === "/root" ||
    target === "/home" ||
    target === "/proc" ||
    target === "/sys"
  ) {
    return true;
  }
  return false;
}

function consumeOneShellRedirection(
  tokens: readonly ShellToken[],
  idx: number,
  onSyntaxError: () => void,
): { matched: boolean; nextIdx: number; failed: boolean } {
  const t = tokens[idx];
  if (!t || t.kind !== "word" || t.quoted) {
    return { matched: false, nextIdx: idx, failed: false };
  }
  const detached = /^(\d*(?:>>?|>\||<<?|<&|>&|&>>?|<>)|[<>])$/.exec(t.value);
  if (detached) {
    const op = detached[1]!;
    const targetTok = tokens[idx + 1];
    if (!targetTok || targetTok.kind !== "word") {
      onSyntaxError();
      return { matched: true, nextIdx: idx + 1, failed: true };
    }
    return {
      matched: true,
      nextIdx: idx + 2,
      failed: isInputRedirectionFailure(op, targetTok.value),
    };
  }
  const attached = /^(\d*(?:>>?|>\||<<?|<&|>&|&>>?|<>))(.+)$/.exec(t.value);
  if (attached) {
    const op = attached[1]!;
    const target = attached[2]!;
    return {
      matched: true,
      nextIdx: idx + 1,
      failed: isInputRedirectionFailure(op, target),
    };
  }
  return { matched: false, nextIdx: idx, failed: false };
}

function skipTrailingShellRedirections(
  tokens: readonly ShellToken[],
  startIdx: number,
  onSyntaxError: () => void = () => {},
): { nextIdx: number; redirFailed: boolean } {
  let i = startIdx;
  let redirFailed = false;
  while (i < tokens.length) {
    const r = consumeOneShellRedirection(tokens, i, onSyntaxError);
    if (!r.matched) break;
    if (r.failed) redirFailed = true;
    i = r.nextIdx;
  }
  return { nextIdx: i, redirFailed };
}

function consumeShellNextOp(
  tokens: readonly ShellToken[],
  startIdx: number,
  onSyntaxError: () => void = () => {},
): { nextOp: string; nextIdx: number; redirFailed: boolean } {
  const { nextIdx: i, redirFailed } = skipTrailingShellRedirections(tokens, startIdx, onSyntaxError);
  if (i >= tokens.length) {
    return { nextOp: ";", nextIdx: i, redirFailed };
  }
  const tok = tokens[i]!;
  if (tok.kind !== "op") {
    onSyntaxError();
    return { nextOp: ";", nextIdx: i, redirFailed };
  }
  if (tok.value === "(" || tok.value === ")") {
    onSyntaxError();
    return { nextOp: ";", nextIdx: i + 1, redirFailed };
  }
  return { nextOp: tok.value, nextIdx: i + 1, redirFailed };
}

function parseWhileOrUntilBlock(
  tokens: readonly ShellToken[],
  startIdx: number,
  loopKind: "while" | "until",
  onSyntaxError: () => void,
): { cmd: ShellPipelineCmd; nextOp: string; nextIdx: number } {
  const cond: ShellToken[] = [];
  const body: ShellToken[] = [];
  let i = startIdx + 1;
  let depth = 1;
  let inBody = false;
  let cmdPos = true;
  let closed = false;

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.kind === "word" && !t.quoted && cmdPos) {
      if (depth === 1 && !inBody && t.value === "do") {
        inBody = true;
        cmdPos = true;
        i += 1;
        continue;
      }
      if (t.value === "while" || t.value === "until" || t.value === "for") {
        depth += 1;
      } else if (t.value === "done") {
        depth -= 1;
        if (depth === 0) {
          closed = true;
          i += 1;
          break;
        }
      }
    }
    if (!inBody) cond.push(t);
    else body.push(t);
    cmdPos = nextShellCmdPos(t, cmdPos);
    i += 1;
  }
  if (!closed || !inBody) onSyntaxError();

  const { nextOp, nextIdx, redirFailed } = consumeShellNextOp(tokens, i, onSyntaxError);
  return { cmd: { kind: "loop", loopKind, cond, body, redirFailed }, nextOp, nextIdx };
}

function parseForBlock(
  tokens: readonly ShellToken[],
  startIdx: number,
  onSyntaxError: () => void,
): { cmd: ShellPipelineCmd; nextOp: string; nextIdx: number } {
  const items: ShellToken[] = [];
  const body: ShellToken[] = [];
  let i = startIdx + 1;
  let hasDynamicItems = false;
  let implicitPositional = false;
  let varName = "";
  let cStyle:
    | {
        readonly init: readonly ShellToken[];
        readonly cond: readonly ShellToken[];
        readonly step: readonly ShellToken[];
      }
    | undefined;

  // C-style for (( init; cond; step ))
  if (
    tokens[i]?.kind === "op" &&
    tokens[i]?.value === "(" &&
    tokens[i + 1]?.kind === "op" &&
    tokens[i + 1]?.value === "("
  ) {
    const endParen = findMatchingParen(tokens, i);
    if (endParen < i + 3 || tokens[endParen - 1]?.kind !== "op" || tokens[endParen - 1]?.value !== ")") {
      hasDynamicItems = true;
      onSyntaxError();
      i = endParen >= 0 ? endParen + 1 : tokens.length;
    } else {
      const inner = tokens.slice(i + 2, endParen - 1);
      const clauses: ShellToken[][] = [[]];
      let parenDepth = 0;
      for (const it of inner) {
        if (it.kind === "op" && it.value === "(") parenDepth += 1;
        else if (it.kind === "op" && it.value === ")" && parenDepth > 0) parenDepth -= 1;
        if (it.kind === "op" && it.value === ";" && parenDepth === 0) {
          clauses.push([]);
        } else {
          clauses[clauses.length - 1]!.push(it);
        }
      }
      if (clauses.length !== 3) {
        hasDynamicItems = true;
        onSyntaxError();
      } else {
        cStyle = { init: clauses[0]!, cond: clauses[1]!, step: clauses[2]! };
      }
      i = endParen + 1;
    }
  } else {
    if (i < tokens.length && tokens[i]!.kind === "word") {
      varName = tokens[i]!.value;
      i += 1;
    } else {
      onSyntaxError();
    }

    while (i < tokens.length && tokens[i]!.kind === "op" && tokens[i]!.value === "\n") i += 1;
    if (tokens[i]?.kind === "word" && !tokens[i]!.quoted && tokens[i]!.value === "in") {
      i += 1;
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (t.kind === "op" && (t.value === ";" || t.value === "\n")) {
          i += 1;
          break;
        }
        if (t.kind === "word" && !t.quoted && t.value === "do") {
          break;
        }
        const hasCmdSub = (t.parts ?? [{ text: t.value, expandable: true }]).some(
          (p) => p.expandable && /(?:\$\(|`)/.test(p.text),
        );
        if (t.kind === "word" && hasCmdSub) {
          hasDynamicItems = true;
        }
        items.push(t);
        i += 1;
      }
    } else {
      implicitPositional = true;
    }
  }

  let foundDo = false;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.kind === "op" && (t.value === ";" || t.value === "\n")) {
      i += 1;
      continue;
    }
    if (t.kind === "word" && !t.quoted && t.value === "do") {
      foundDo = true;
      i += 1;
      break;
    }
    onSyntaxError();
    break;
  }

  let depth = 1;
  let cmdPos = true;
  let closed = false;
  if (foundDo) {
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (t.kind === "word" && !t.quoted && cmdPos) {
        if (t.value === "while" || t.value === "until" || t.value === "for") {
          depth += 1;
        } else if (t.value === "done") {
          depth -= 1;
          if (depth === 0) {
            closed = true;
            i += 1;
            break;
          }
        }
      }
      body.push(t);
      cmdPos = nextShellCmdPos(t, cmdPos);
      i += 1;
    }
  }
  if (!foundDo || !closed) onSyntaxError();

  const { nextOp, nextIdx, redirFailed } = consumeShellNextOp(tokens, i, onSyntaxError);
  return {
    cmd: { kind: "for", varName, implicitPositional, items, hasDynamicItems, cStyle, body, redirFailed },
    nextOp,
    nextIdx,
  };
}

function findMatchingParen(tokens: readonly ShellToken[], openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if (t.kind === "op" && t.value === "(") depth += 1;
    else if (t.kind === "op" && t.value === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingBrace(tokens: readonly ShellToken[], openIdx: number): number {
  let depth = 0;
  let cmdPos = true;
  for (let i = openIdx; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if (t.kind === "word" && !t.quoted && cmdPos) {
      if (t.value === "{") depth += 1;
      else if (t.value === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    cmdPos = nextShellCmdPos(t, cmdPos);
  }
  return -1;
}

function parseIfBlock(
  tokens: readonly ShellToken[],
  startIdx: number,
  onSyntaxError: () => void,
): { cmd: ShellPipelineCmd; nextOp: string; nextIdx: number } {
  const branches: { cond: ShellToken[]; body: ShellToken[] }[] = [];
  let elseBody: ShellToken[] = [];
  let i = startIdx + 1;
  let ifDepth = 1;
  let mode: "cond" | "then" | "else" = "cond";
  let curCond: ShellToken[] = [];
  let curBody: ShellToken[] = [];
  let cmdPos = true;
  let closed = false;

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (ifDepth === 1 && t.kind === "word" && !t.quoted && cmdPos) {
      if (t.value === "then" && mode === "cond") {
        mode = "then";
        cmdPos = true;
        i += 1;
        continue;
      }
      if (t.value === "elif" && mode === "then") {
        branches.push({ cond: curCond, body: curBody });
        curCond = [];
        curBody = [];
        mode = "cond";
        cmdPos = true;
        i += 1;
        continue;
      }
      if (t.value === "else" && mode === "then") {
        branches.push({ cond: curCond, body: curBody });
        curCond = [];
        curBody = [];
        mode = "else";
        cmdPos = true;
        i += 1;
        continue;
      }
      if (t.value === "fi") {
        if (mode === "then") branches.push({ cond: curCond, body: curBody });
        else if (mode === "else") {
          elseBody = curBody;
          if (curBody.length === 0) onSyntaxError();
        }
        closed = true;
        i += 1;
        break;
      }
    }
    if (t.kind === "word" && !t.quoted && cmdPos) {
      if (t.value === "if") ifDepth += 1;
      else if (t.value === "fi" && ifDepth > 1) ifDepth -= 1;
    }

    if (mode === "cond") curCond.push(t);
    else curBody.push(t);
    cmdPos = nextShellCmdPos(t, cmdPos);
    i += 1;
  }
  if (!closed || (mode === "cond" && branches.length === 0)) onSyntaxError();

  const { nextOp, nextIdx, redirFailed } = consumeShellNextOp(tokens, i, onSyntaxError);
  return { cmd: { kind: "if", branches, elseBody, redirFailed }, nextOp, nextIdx };
}

function parseShellLists(
  tokens: readonly ShellToken[],
  onSyntaxError: () => void = () => {},
  depth = 0,
): ShellListEntry[] {
  const entries: ShellListEntry[] = [];
  let i = 0;

  const validateSubTokens = (subTokens: readonly ShellToken[], allowEmpty: boolean): void => {
    if (depth >= 128) {
      onSyntaxError();
      return;
    }
    const subEntries = parseShellLists(subTokens, onSyntaxError, depth + 1);
    if (!allowEmpty && subEntries.length === 0) onSyntaxError();
  };

  const skipNewlines = (): void => {
    while (i < tokens.length && tokens[i]!.kind === "op" && tokens[i]!.value === "\n") {
      i += 1;
    }
  };

  const consumeSeparatorOp = (): { nextOp: string; redirFailed: boolean } => {
    const { nextOp, nextIdx, redirFailed } = consumeShellNextOp(tokens, i, onSyntaxError);
    i = nextIdx;
    return { nextOp, redirFailed };
  };

  const parseOneCommand = (): { cmd: ShellPipelineCmd; nextOp: string } | null => {
    if (i >= tokens.length) return null;
    const cur = tokens[i]!;
    if (cur.kind === "op") {
      if (cur.value === "(") {
        const end = findMatchingParen(tokens, i);
        if (end < 0) {
          onSyntaxError();
          i = tokens.length;
          return null;
        }
        const isArith =
          tokens[i + 1]?.kind === "op" &&
          tokens[i + 1]!.value === "(" &&
          !tokens[i + 1]!.precededBySpace &&
          end >= i + 3 &&
          tokens[end - 1]?.kind === "op" &&
          tokens[end - 1]!.value === ")" &&
          !tokens[end]!.precededBySpace &&
          findMatchingParen(tokens, i + 1) === end - 1;
        if (isArith) {
          const exprTokens = tokens.slice(i + 2, end - 1);
          i = end + 1;
          const { nextOp, redirFailed } = consumeSeparatorOp();
          return { cmd: { kind: "arith", exprTokens, redirFailed }, nextOp };
        }
        const inner = tokens.slice(i + 1, end);
        i = end + 1;
        validateSubTokens(inner, false);
        const { nextOp, redirFailed } = consumeSeparatorOp();
        return { cmd: { kind: "subshell", inner, redirFailed }, nextOp };
      }
      onSyntaxError();
      i += 1;
      return null;
    }
    if (
      !cur.quoted &&
      (cur.value === "}" ||
        cur.value === "fi" ||
        cur.value === "done" ||
        cur.value === "elif" ||
        cur.value === "else" ||
        cur.value === "then" ||
        cur.value === "do")
    ) {
      onSyntaxError();
      i += 1;
      return null;
    }
    if (
      !cur.quoted &&
      cur.value === "function" &&
      tokens[i + 1]?.kind === "word" &&
      tokens[i + 1]!.value.length > 0
    ) {
      const fnName = tokens[i + 1]!.value;
      let j = i + 2;
      if (
        tokens[j]?.kind === "op" &&
        tokens[j]!.value === "(" &&
        tokens[j + 1]?.kind === "op" &&
        tokens[j + 1]!.value === ")"
      ) {
        j += 2;
      }
      while (j < tokens.length && tokens[j]!.kind === "op" && tokens[j]!.value === "\n") j += 1;
      if (tokens[j]?.kind === "word" && !tokens[j]!.quoted && tokens[j]!.value === "{") {
        const end = findMatchingBrace(tokens, j);
        if (end < 0) {
          onSyntaxError();
          i = tokens.length;
          return null;
        }
        const body = tokens.slice(j + 1, end);
        i = end + 1;
        validateSubTokens(body, false);
        const { nextOp } = consumeSeparatorOp();
        return { cmd: { kind: "funcdef", name: fnName, body, isSubshell: false }, nextOp };
      }
      if (tokens[j]?.kind === "op" && tokens[j]!.value === "(") {
        const end = findMatchingParen(tokens, j);
        if (end < 0) {
          onSyntaxError();
          i = tokens.length;
          return null;
        }
        const body = tokens.slice(j + 1, end);
        i = end + 1;
        validateSubTokens(body, false);
        const { nextOp } = consumeSeparatorOp();
        return { cmd: { kind: "funcdef", name: fnName, body, isSubshell: true }, nextOp };
      }
    }
    if (
      !cur.quoted &&
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(cur.value) &&
      tokens[i + 1]?.kind === "op" &&
      tokens[i + 1]!.value === "(" &&
      tokens[i + 2]?.kind === "op" &&
      tokens[i + 2]!.value === ")"
    ) {
      let j = i + 3;
      while (j < tokens.length && tokens[j]!.kind === "op" && tokens[j]!.value === "\n") j += 1;
      if (tokens[j]?.kind === "word" && !tokens[j]!.quoted && tokens[j]!.value === "{") {
        const end = findMatchingBrace(tokens, j);
        if (end < 0) {
          onSyntaxError();
          i = tokens.length;
          return null;
        }
        const body = tokens.slice(j + 1, end);
        i = end + 1;
        validateSubTokens(body, false);
        const { nextOp } = consumeSeparatorOp();
        return { cmd: { kind: "funcdef", name: cur.value, body, isSubshell: false }, nextOp };
      }
      if (tokens[j]?.kind === "op" && tokens[j]!.value === "(") {
        const end = findMatchingParen(tokens, j);
        if (end < 0) {
          onSyntaxError();
          i = tokens.length;
          return null;
        }
        const body = tokens.slice(j + 1, end);
        i = end + 1;
        validateSubTokens(body, false);
        const { nextOp } = consumeSeparatorOp();
        return { cmd: { kind: "funcdef", name: cur.value, body, isSubshell: true }, nextOp };
      }
    }
    if (!cur.quoted && cur.value === "{") {
      const end = findMatchingBrace(tokens, i);
      if (end < 0) {
        onSyntaxError();
        i = tokens.length;
        return null;
      }
      const inner = tokens.slice(i + 1, end);
      i = end + 1;
      validateSubTokens(inner, false);
      const { nextOp, redirFailed } = consumeSeparatorOp();
      return { cmd: { kind: "group", inner, redirFailed }, nextOp };
    }
    if (!cur.quoted && cur.value === "if") {
      const parsedIf = parseIfBlock(tokens, i, onSyntaxError);
      if (parsedIf.cmd.kind === "if") {
        for (const b of parsedIf.cmd.branches) {
          validateSubTokens(b.cond, false);
          validateSubTokens(b.body, false);
        }
        if (parsedIf.cmd.elseBody.length > 0) {
          validateSubTokens(parsedIf.cmd.elseBody, false);
        }
      }
      i = parsedIf.nextIdx;
      return { cmd: parsedIf.cmd, nextOp: parsedIf.nextOp };
    }
    if (!cur.quoted && (cur.value === "while" || cur.value === "until")) {
      const parsedLoop = parseWhileOrUntilBlock(tokens, i, cur.value, onSyntaxError);
      if (parsedLoop.cmd.kind === "loop") {
        validateSubTokens(parsedLoop.cmd.cond, false);
        validateSubTokens(parsedLoop.cmd.body, false);
      }
      i = parsedLoop.nextIdx;
      return { cmd: parsedLoop.cmd, nextOp: parsedLoop.nextOp };
    }
    if (!cur.quoted && cur.value === "for") {
      const parsedFor = parseForBlock(tokens, i, onSyntaxError);
      if (parsedFor.cmd.kind === "for") {
        validateSubTokens(parsedFor.cmd.body, false);
      }
      i = parsedFor.nextIdx;
      return { cmd: parsedFor.cmd, nextOp: parsedFor.nextOp };
    }

    const simpleTokens: ShellToken[] = [];
    let redirFailed = false;
    let sawRedir = false;
    let nextOp = ";";
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (t.kind === "op") {
        nextOp = t.value;
        i += 1;
        break;
      }
      const r = consumeOneShellRedirection(tokens, i, onSyntaxError);
      if (r.matched) {
        sawRedir = true;
        if (r.failed) redirFailed = true;
        i = r.nextIdx;
        continue;
      }
      simpleTokens.push(t);
      i += 1;
    }
    if (simpleTokens.length === 0 && !sawRedir) {
      return null;
    }
    return { cmd: { kind: "simple", tokens: simpleTokens, redirFailed }, nextOp };
  };

  const parsePipeline = (): { pipeline: ShellPipeline; endOp: string } | null => {
    let negated = false;
    let sawBang = false;
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (t.kind === "word" && !t.quoted && t.value === "!") {
        sawBang = true;
        negated = !negated;
        i += 1;
        continue;
      }
      break;
    }
    const commands: ShellPipelineCmd[] = [];
    let endOp = ";";
    while (true) {
      if (i >= tokens.length) {
        if (commands.length === 0 && sawBang) {
          commands.push({ kind: "simple", tokens: [], redirFailed: false });
          negated = !negated;
          break;
        }
        onSyntaxError();
        break;
      }
      const parsed = parseOneCommand();
      if (!parsed) break;
      if (parsed.nextOp === "(" || parsed.nextOp === ")") {
        onSyntaxError();
      }
      commands.push(parsed.cmd);
      endOp = parsed.nextOp;
      if (parsed.nextOp === "|") {
        skipNewlines();
        if (i >= tokens.length) {
          onSyntaxError();
          break;
        }
        continue;
      }
      break;
    }
    if (commands.length === 0) return null;
    return { pipeline: { negated, commands }, endOp };
  };

  skipNewlines();
  while (i < tokens.length) {
    const clauses: ShellAndOrClause[] = [];
    let clauseOp: "start" | "&&" | "||" = "start";
    let background = false;
    while (true) {
      const parsedPipe = parsePipeline();
      if (!parsedPipe) break;
      clauses.push({ op: clauseOp, pipeline: parsedPipe.pipeline });
      if (parsedPipe.endOp === "&&" || parsedPipe.endOp === "||") {
        clauseOp = parsedPipe.endOp;
        skipNewlines();
        if (i >= tokens.length) {
          onSyntaxError();
          break;
        }
        continue;
      }
      background = parsedPipe.endOp === "&";
      break;
    }
    if (clauses.length > 0) {
      entries.push({ clauses, background });
    }
    skipNewlines();
  }
  return entries;
}

interface ShellEnvState {
  readonly vars: Record<string, string>;
  readonly exported: Set<string>;
  readonly args0: string;
  positional: string[];
  allexport: boolean;
  noexec: boolean;
  errexit: boolean;
  pipefail: boolean;
  nounset: boolean;
}

function getExportedEnv(envState: ShellEnvState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of envState.exported) {
    if (Object.hasOwn(envState.vars, key)) {
      out[key] = envState.vars[key]!;
    }
  }
  return out;
}

function evaluateStaticTestCommand(
  args: readonly string[],
  usedUnboundVar = false,
  usedRuntimePid = false,
): "true" | "false" | "unknown" {
  if (usedUnboundVar) return "unknown";
  let negate = false;
  let idx = 0;
  while (idx < args.length && args[idx] === "!") {
    negate = !negate;
    idx += 1;
  }
  const rest = args.slice(idx);
  if (usedRuntimePid && rest.length === 3) {
    return "unknown";
  }
  let base: "true" | "false" | "unknown" = "unknown";
  if (rest.length === 0) {
    base = "false";
  } else if (rest.length === 1) {
    base = rest[0]!.length > 0 ? "true" : "false";
  } else if (rest.length === 2) {
    const [op, target] = rest as [string, string];
    if (op === "-z") base = target.length === 0 ? "true" : "false";
    else if (op === "-n") base = target.length > 0 ? "true" : "false";
    else if (op === "-d") {
      if (
        target === "/" ||
        target === "/tmp" ||
        target === "/var/tmp" ||
        target === "/usr" ||
        target === "/usr/bin" ||
        target === "/usr/sbin" ||
        target === "/etc" ||
        target === "/bin" ||
        target === "/sbin" ||
        target === "/lib" ||
        target === "/lib64" ||
        target === "/var" ||
        target === "/dev" ||
        target === "." ||
        target === ".."
      ) {
        base = "true";
      } else if (
        target === "/dev/null" ||
        target === "/usr/bin/env" ||
        target === "/etc/hosts" ||
        target === "/etc/passwd" ||
        target.startsWith("/nonexistent")
      ) {
        base = "false";
      }
    } else if (op === "-e") {
      if (
        target === "/" ||
        target === "/tmp" ||
        target === "/var/tmp" ||
        target === "/usr" ||
        target === "/usr/bin" ||
        target === "/usr/bin/env" ||
        target === "/usr/sbin" ||
        target === "/etc" ||
        target === "/etc/hosts" ||
        target === "/etc/passwd" ||
        target === "/bin" ||
        target === "/sbin" ||
        target === "/lib" ||
        target === "/lib64" ||
        target === "/var" ||
        target === "/dev" ||
        target === "/dev/null" ||
        target === "/dev/zero" ||
        target === "/dev/stdin" ||
        target === "." ||
        target === ".."
      ) {
        base = "true";
      } else if (target.startsWith("/nonexistent")) {
        base = "false";
      }
    } else if (op === "-f") {
      if (target === "/usr/bin/env" || target === "/etc/hosts" || target === "/etc/passwd") {
        base = "true";
      } else if (
        target === "/" ||
        target === "/tmp" ||
        target === "/var/tmp" ||
        target === "/usr" ||
        target === "/usr/bin" ||
        target === "/usr/sbin" ||
        target === "/etc" ||
        target === "/bin" ||
        target === "/sbin" ||
        target === "/lib" ||
        target === "/lib64" ||
        target === "/var" ||
        target === "/dev" ||
        target === "/dev/null" ||
        target.startsWith("/nonexistent")
      ) {
        base = "false";
      }
    } else if (op === "-c") {
      if (target === "/dev/null" || target === "/dev/zero") base = "true";
      else if (target === "/" || target === "/tmp" || target.startsWith("/nonexistent")) base = "false";
    }
  } else if (rest.length === 3) {
    const [a, op, b] = rest as [string, string, string];
    if (op === "=" || op === "==") base = a === b ? "true" : "false";
    else if (op === "!=") base = a !== b ? "true" : "false";
    else if (
      (op === "-eq" || op === "-ne" || op === "-lt" || op === "-le" || op === "-gt" || op === "-ge") &&
      /^[+-]?\d+$/.test(a) &&
      /^[+-]?\d+$/.test(b)
    ) {
      const na = BigInt(a);
      const nb = BigInt(b);
      const ok =
        op === "-eq"
          ? na === nb
          : op === "-ne"
            ? na !== nb
            : op === "-lt"
              ? na < nb
              : op === "-le"
                ? na <= nb
                : op === "-gt"
                  ? na > nb
                  : na >= nb;
      base = ok ? "true" : "false";
    }
  }
  if (base === "unknown") return "unknown";
  return negate ? (base === "true" ? "false" : "true") : base;
}

const SHELL_QUERY_BUILTINS: ReadonlySet<string> = new Set([
  "vllm",
  "python",
  "python3",
  "docker",
  "env",
  "sudo",
  "nohup",
  "setsid",
  "export",
  "unset",
  "exit",
  "return",
  "break",
  "continue",
  "command",
  "exec",
  "cd",
  "printf",
  "cat",
  "test",
  "[",
  "[[",
  "if",
  "for",
  "while",
  "until",
]);

function unwrapServeStatementWords(
  words: readonly string[],
  exportedBaseEnv: Record<string, string>,
  allowPrefixAssign = true,
  allowCommandBuiltin = true,
): {
  rest: string[];
  env: Record<string, string>;
  replacedProcess: boolean;
  skipFunctions: boolean;
  externalContext: boolean;
  commandQueryTarget?: string | undefined;
} {
  const cmdEnv: Record<string, string> = { ...exportedBaseEnv };
  let replacedProcess = false;
  let skipFunctions = false;
  let externalContext = false;
  let inShellContext = allowPrefixAssign;
  let wIdx = 0;
  if (allowPrefixAssign) {
    while (wIdx < words.length) {
      const m = SERVE_ASSIGN_RE.exec(words[wIdx] ?? "");
      if (!m) break;
      cmdEnv[m[1]!] = m[2]!;
      wIdx += 1;
    }
  }

  while (wIdx < words.length) {
    const w = words[wIdx] ?? "";
    if (w === "nohup") {
      inShellContext = false;
      externalContext = true;
      wIdx += 1;
      if (words[wIdx] === "--") wIdx += 1;
      continue;
    }
    if (w === "setsid") {
      inShellContext = false;
      externalContext = true;
      wIdx += 1;
      while (wIdx < words.length) {
        const sw = words[wIdx] ?? "";
        if (sw === "--") {
          wIdx += 1;
          break;
        }
        if (/^-[cfw]+$/.test(sw) || sw === "--ctty" || sw === "--fork" || sw === "--wait") {
          wIdx += 1;
          continue;
        }
        break;
      }
      continue;
    }
    if (inShellContext && allowCommandBuiltin && w === "command") {
      let cIdx = wIdx + 1;
      let isQuery = false;
      while (cIdx < words.length) {
        const cw = words[cIdx] ?? "";
        if (cw === "--") {
          cIdx += 1;
          break;
        }
        if (/^-[pvV]+$/.test(cw)) {
          if (cw.includes("v") || cw.includes("V")) isQuery = true;
          cIdx += 1;
          continue;
        }
        break;
      }
      if (isQuery) {
        return {
          rest: [],
          env: cmdEnv,
          replacedProcess,
          skipFunctions: true,
          externalContext: false,
          commandQueryTarget: words[cIdx] ?? "",
        };
      }
      skipFunctions = true;
      wIdx = cIdx;
      continue;
    }
    if (inShellContext && w === "exec") {
      let clearEnv = false;
      wIdx += 1;
      while (wIdx < words.length) {
        const xw = words[wIdx] ?? "";
        if (xw === "--") {
          wIdx += 1;
          break;
        }
        if (xw === "-a" && wIdx + 1 < words.length) {
          wIdx += 2;
          continue;
        }
        if (/^-[cl]+$/.test(xw)) {
          if (xw.includes("c")) clearEnv = true;
          wIdx += 1;
          continue;
        }
        break;
      }
      if (clearEnv) {
        for (const k of Object.keys(cmdEnv)) delete cmdEnv[k];
      }
      inShellContext = false;
      externalContext = true;
      if (wIdx < words.length) replacedProcess = true;
      continue;
    }
    if (w === "sudo") {
      inShellContext = false;
      externalContext = true;
      wIdx += 1;
      let keepEnv = false;
      while (wIdx < words.length) {
        const sw = words[wIdx] ?? "";
        if (sw === "--") {
          wIdx += 1;
          break;
        }
        if (sw === "-E" || sw === "--preserve-env") {
          keepEnv = true;
          wIdx += 1;
          continue;
        }
        if ((sw === "-u" || sw === "-g" || sw === "-h" || sw === "-p") && wIdx + 1 < words.length) {
          wIdx += 2;
          continue;
        }
        if (/^-[EHnSbskKPv]+$/.test(sw)) {
          if (sw.includes("E")) keepEnv = true;
          wIdx += 1;
          continue;
        }
        const assign = SERVE_ASSIGN_RE.exec(sw);
        if (assign) {
          cmdEnv[assign[1]!] = assign[2]!;
          wIdx += 1;
          continue;
        }
        break;
      }
      if (!keepEnv) {
        const kept: Record<string, string> = {};
        for (const k of Object.keys(cmdEnv)) {
          if (!Object.hasOwn(exportedBaseEnv, k) || cmdEnv[k] !== exportedBaseEnv[k]) kept[k] = cmdEnv[k]!;
        }
        for (const k of Object.keys(cmdEnv)) delete cmdEnv[k];
        Object.assign(cmdEnv, kept);
      }
      continue;
    }
    if (w === "env") {
      inShellContext = false;
      externalContext = true;
      wIdx += 1;
      let parsingEnvOpts = true;
      while (wIdx < words.length) {
        const ew = words[wIdx] ?? "";
        if (parsingEnvOpts && (ew === "-i" || ew === "--ignore-environment" || ew === "-")) {
          for (const k of Object.keys(cmdEnv)) delete cmdEnv[k];
          wIdx += 1;
          continue;
        }
        if (parsingEnvOpts && ew === "-u" && wIdx + 1 < words.length) {
          delete cmdEnv[words[wIdx + 1]!];
          wIdx += 2;
          continue;
        }
        if (parsingEnvOpts && ew.startsWith("--unset=")) {
          delete cmdEnv[ew.slice("--unset=".length)];
          wIdx += 1;
          continue;
        }
        if (parsingEnvOpts && ew === "--") {
          parsingEnvOpts = false;
          wIdx += 1;
          continue;
        }
        const assign = SERVE_ASSIGN_RE.exec(ew);
        if (assign) {
          cmdEnv[assign[1]!] = assign[2]!;
          wIdx += 1;
          continue;
        }
        break;
      }
      continue;
    }
    break;
  }
  return { rest: words.slice(wIdx), env: cmdEnv, replacedProcess, skipFunctions, externalContext };
}

type ShellFunctionDef = {
  readonly body: readonly ShellToken[];
  readonly isSubshell: boolean;
};

const VALID_CAT_LONG_FLAGS: ReadonlySet<string> = new Set([
  "--show-all",
  "--number-nonblank",
  "--show-ends",
  "--number",
  "--squeeze-blank",
  "--show-tabs",
  "--show-nonprinting",
  "--help",
  "--version",
]);

function unescapePrintfLiterals(raw: string): string {
  return raw.replace(/\\([\\ntr'"abfv0]|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/g, (_m, esc: string) => {
    if (esc === "\\") return "\\";
    if (esc === "n") return "\n";
    if (esc === "t") return "\t";
    if (esc === "r") return "\r";
    if (esc === "'") return "'";
    if (esc === '"') return '"';
    if (esc === "a") return "\x07";
    if (esc === "b") return "\b";
    if (esc === "f") return "\f";
    if (esc === "v") return "\v";
    if (esc === "0") return "\0";
    if (esc.startsWith("x")) return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
    return String.fromCharCode(Number.parseInt(esc, 8) & 0xff);
  });
}

function parseBashPrintfBigInt(raw: string): bigint | null {
  if (raw === "") return 0n;
  if (/^'./.test(raw)) return BigInt(raw.codePointAt(1) ?? 0);
  if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(raw)) {
    const neg = raw.startsWith("-");
    const digits = raw.replace(/^[+-]?0[xX]/, "");
    const v = BigInt(`0x${digits}`);
    return neg ? -v : v;
  }
  if (/^[+-]?0[0-7]*$/.test(raw)) {
    const neg = raw.startsWith("-");
    const digits = raw.replace(/^[+-]?/, "");
    const v = BigInt(digits === "0" ? "0" : `0o${digits}`);
    return neg ? -v : v;
  }
  if (/^[+-]?[1-9]\d*$/.test(raw)) return BigInt(raw);
  return null;
}

function formatBashPrintfResult(fmt: string, args: readonly string[]): { ok: boolean; formatted: string } {
  const isBashFloatArg = (raw: string): boolean => {
    if (raw === "") return true;
    if (/^'./.test(raw)) return true;
    return (
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ||
      /^[+-]?(?:0[xX](?:[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)[pP][+-]?\d+|inf(?:inity)?|nan)$/i.test(
        raw,
      )
    );
  };
  let argIdx = 0;
  let allOk = true;
  let consumedAnyArg = false;
  let formatted = "";
  do {
    const startArgIdx = argIdx;
    for (let idx = 0; idx < fmt.length; idx += 1) {
      if (fmt[idx] === "\\") {
        const nextIdx = fmt.slice(idx).match(/^\\([\\ntr'"abfv0]|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/);
        if (nextIdx) {
          formatted += unescapePrintfLiterals(nextIdx[0]);
          idx += nextIdx[0].length - 1;
          continue;
        }
      }
      if (fmt[idx] !== "%") {
        formatted += fmt[idx]!;
        continue;
      }
      if (fmt[idx + 1] === "%") {
        formatted += "%";
        idx += 1;
        continue;
      }
      const rest = fmt.slice(idx + 1);
      const m = /^([-+ #0']*)(\d+|\*)?(?:\.(\d+|\*)?)?([diouxXeEfFgGaAcsbq])/.exec(rest);
      if (!m) return { ok: false, formatted };
      const flags = m[1] ?? "";
      let width = m[2] && m[2] !== "*" ? Number.parseInt(m[2], 10) : 0;
      if (m[2] === "*") {
        const wArg = argIdx < args.length ? args[argIdx++]! : "";
        const wParsed = parseBashPrintfBigInt(wArg);
        if (wParsed === null) allOk = false;
        else width = Math.abs(Number(wParsed));
      }
      let prec: number | undefined =
        m[3] !== undefined && m[3] !== "*" ? Number.parseInt(m[3], 10) : undefined;
      if (m[3] === "*") {
        const pArg = argIdx < args.length ? args[argIdx++]! : "";
        const pParsed = parseBashPrintfBigInt(pArg);
        if (pParsed === null) allOk = false;
        else prec = Math.max(0, Number(pParsed));
      }
      const conv = m[4]!;
      const valArg = argIdx < args.length ? args[argIdx++]! : "";
      const leftAlign = flags.includes("-");
      const zeroPad = flags.includes("0") && !leftAlign && prec === undefined;
      if (/[diouxX]/.test(conv)) {
        const bi = parseBashPrintfBigInt(valArg);
        if (bi === null) {
          allOk = false;
          formatted += valArg;
        } else {
          const radix = conv === "o" ? 8 : conv === "x" || conv === "X" ? 16 : 10;
          const isNeg = bi < 0n && (conv === "d" || conv === "i");
          const absVal = bi < 0n ? -bi : bi;
          let digits = absVal.toString(radix);
          if (conv === "X") digits = digits.toUpperCase();
          if (prec !== undefined && digits.length < prec) {
            digits = digits.padStart(prec, "0");
          }
          const sign = isNeg ? "-" : flags.includes("+") && (conv === "d" || conv === "i") ? "+" : "";
          const padLen = Math.max(0, width - sign.length - digits.length);
          if (leftAlign) formatted += `${sign}${digits}${" ".repeat(padLen)}`;
          else if (zeroPad) formatted += `${sign}${"0".repeat(padLen)}${digits}`;
          else formatted += `${" ".repeat(padLen)}${sign}${digits}`;
        }
      } else if (/[eEfFgGaA]/.test(conv)) {
        if (!isBashFloatArg(valArg)) allOk = false;
        const num = Number(valArg || 0);
        const s = Number.isFinite(num)
          ? conv === "f" || conv === "F"
            ? num.toFixed(prec ?? 6)
            : String(num)
          : valArg;
        formatted += width > s.length ? (leftAlign ? s.padEnd(width, " ") : s.padStart(width, " ")) : s;
      } else if (conv === "c") {
        const ch = valArg.slice(0, 1) || "\0";
        formatted += width > 1 ? (leftAlign ? ch.padEnd(width, " ") : ch.padStart(width, " ")) : ch;
      } else {
        let s = conv === "b" ? unescapePrintfLiterals(valArg) : valArg;
        if (prec !== undefined) s = s.slice(0, prec);
        formatted += width > s.length ? (leftAlign ? s.padEnd(width, " ") : s.padStart(width, " ")) : s;
      }
      idx += m[0].length;
    }
    consumedAnyArg = argIdx > startArgIdx;
  } while (consumedAnyArg && argIdx < args.length);
  return { ok: allOk, formatted };
}

function parseShellExitStatus(
  rawArg: string | undefined,
  fallbackStatusOrOk: number | boolean,
): { ok: boolean; status: number } {
  if (rawArg === undefined) {
    const fallbackNum =
      typeof fallbackStatusOrOk === "number" ? fallbackStatusOrOk : fallbackStatusOrOk ? 0 : 1;
    const st = ((fallbackNum % 256) + 256) % 256;
    return { ok: st === 0, status: st };
  }
  if (rawArg === "" || !/^[+-]?\d+$/.test(rawArg)) {
    return { ok: false, status: 2 };
  }
  const bi = BigInt(rawArg);
  if (bi < -9223372036854775808n || bi > 9223372036854775807n) {
    return { ok: false, status: 2 };
  }
  const st = Number(bi & 255n);
  return { ok: st === 0, status: st };
}

function expandShellVarSegment(
  segment: string,
  envState: ShellEnvState,
  lastStatusOrOk: number | boolean,
): { text: string; hadUnboundVar: boolean; hadFatalError: boolean; hadRuntimePid: boolean } {
  if (!segment.includes("$")) {
    return { text: segment, hadUnboundVar: false, hadFatalError: false, hadRuntimePid: false };
  }
  const statusNum = typeof lastStatusOrOk === "number" ? lastStatusOrOk : lastStatusOrOk ? 0 : 1;
  let hadUnboundVar = false;
  let hadFatalError = false;
  let hadRuntimePid = false;

  const resolveParam = (
    name: string,
    markUnbound: boolean,
  ): { isSet: boolean; val: string; isRuntimePid: boolean } => {
    if (name === "?") return { isSet: true, val: String(statusNum), isRuntimePid: false };
    if (name === "$") return { isSet: true, val: "12345", isRuntimePid: true };
    if (name === "#") return { isSet: true, val: String(envState.positional.length), isRuntimePid: false };
    if (name === "@" || name === "*") {
      return {
        isSet: envState.positional.length > 0,
        val: envState.positional.join(" "),
        isRuntimePid: false,
      };
    }
    if (/^\d+$/.test(name)) {
      const posIdx = Number.parseInt(name, 10);
      if (posIdx === 0) return { isSet: true, val: envState.args0, isRuntimePid: false };
      if (posIdx <= envState.positional.length) {
        return { isSet: true, val: envState.positional[posIdx - 1] ?? "", isRuntimePid: false };
      }
      if (markUnbound) hadUnboundVar = true;
      return { isSet: false, val: "", isRuntimePid: false };
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      if (Object.hasOwn(envState.vars, name)) {
        return { isSet: true, val: envState.vars[name] ?? "", isRuntimePid: false };
      }
      if (markUnbound) hadUnboundVar = true;
      return { isSet: false, val: "", isRuntimePid: false };
    }
    return { isSet: false, val: "", isRuntimePid: false };
  };

  let out = "";
  let idx = 0;
  while (idx < segment.length) {
    if (segment[idx] !== "$") {
      out += segment[idx]!;
      idx += 1;
      continue;
    }
    const next = segment[idx + 1] ?? "";
    if (next === "{") {
      let depth = 1;
      let j = idx + 2;
      while (j < segment.length && depth > 0) {
        if (segment[j] === "\\" && j + 1 < segment.length) {
          j += 2;
          continue;
        }
        if (segment[j] === "{") depth += 1;
        else if (segment[j] === "}") depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      if (depth !== 0) {
        out += segment.slice(idx);
        break;
      }
      const inner = segment.slice(idx + 2, j);
      const opMatch = /^([A-Za-z_][A-Za-z0-9_]*|\d+|[?#@*$])(:?[?=+-])([\s\S]*)$/.exec(inner);
      if (opMatch) {
        const name = opMatch[1]!;
        const op = opMatch[2]!;
        const argExpr = opMatch[3]!;
        const lookup = resolveParam(name, false);
        if (lookup.isRuntimePid) hadRuntimePid = true;
        const withColon = op.startsWith(":");
        const opChar = op.slice(-1);
        const missingOrEmpty = withColon ? !lookup.isSet || lookup.val === "" : !lookup.isSet;
        if (opChar === "?") {
          if (missingOrEmpty) {
            hadFatalError = true;
            idx = j + 1;
            continue;
          }
          out += lookup.val;
        } else if (opChar === "-") {
          if (missingOrEmpty) {
            const sub = expandShellVarSegment(argExpr, envState, lastStatusOrOk);
            if (sub.hadUnboundVar) hadUnboundVar = true;
            if (sub.hadFatalError) hadFatalError = true;
            if (sub.hadRuntimePid) hadRuntimePid = true;
            out += sub.text;
          } else {
            out += lookup.val;
          }
        } else if (opChar === "=") {
          if (missingOrEmpty) {
            const sub = expandShellVarSegment(argExpr, envState, lastStatusOrOk);
            if (sub.hadUnboundVar) hadUnboundVar = true;
            if (sub.hadFatalError) hadFatalError = true;
            if (sub.hadRuntimePid) hadRuntimePid = true;
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
              envState.vars[name] = sub.text;
              if (envState.allexport) envState.exported.add(name);
            }
            out += sub.text;
          } else {
            out += lookup.val;
          }
        } else if (opChar === "+") {
          if (!missingOrEmpty) {
            const sub = expandShellVarSegment(argExpr, envState, lastStatusOrOk);
            if (sub.hadUnboundVar) hadUnboundVar = true;
            if (sub.hadFatalError) hadFatalError = true;
            if (sub.hadRuntimePid) hadRuntimePid = true;
            out += sub.text;
          }
        }
        idx = j + 1;
        continue;
      }
      const lenMatch = /^#([A-Za-z_][A-Za-z0-9_]*|\d+|[?#@*$])$/.exec(inner);
      if (lenMatch) {
        const name = lenMatch[1]!;
        if (name === "@" || name === "*") {
          out += String(envState.positional.length);
        } else {
          const lookup = resolveParam(name, true);
          if (lookup.isRuntimePid) hadRuntimePid = true;
          out += String(lookup.val.length);
        }
        idx = j + 1;
        continue;
      }
      if (/^(?:[A-Za-z_][A-Za-z0-9_]*|\d+|[?#@*$])$/.test(inner)) {
        const lookup = resolveParam(inner, true);
        if (lookup.isRuntimePid) hadRuntimePid = true;
        out += lookup.val;
        idx = j + 1;
        continue;
      }
      out += segment.slice(idx, j + 1);
      idx = j + 1;
      continue;
    }
    if (/^[?#@*$0-9]$/.test(next)) {
      const lookup = resolveParam(next, true);
      if (lookup.isRuntimePid) hadRuntimePid = true;
      out += lookup.val;
      idx += 2;
      continue;
    }
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(segment.slice(idx + 1));
    if (idMatch) {
      const name = idMatch[0];
      const lookup = resolveParam(name, true);
      if (lookup.isRuntimePid) hadRuntimePid = true;
      out += lookup.val;
      idx += 1 + name.length;
      continue;
    }
    out += "$";
    idx += 1;
  }
  return { text: out, hadUnboundVar, hadFatalError, hadRuntimePid };
}

function expandShellCommandTokens(
  tokens: readonly ShellToken[],
  envState: ShellEnvState,
  lastStatusOrOk: number | boolean,
): {
  words: string[];
  quoted: boolean[];
  assignBeforeQuote: boolean[];
  hadUnboundVar: boolean;
  hadFatalError: boolean;
  hadRuntimePid: boolean;
} {
  const words: string[] = [];
  const quoted: boolean[] = [];
  const assignBeforeQuote: boolean[] = [];
  let hadUnboundVar = false;
  let hadFatalError = false;
  let hadRuntimePid = false;
  for (const tok of tokens) {
    if (
      tok.parts &&
      tok.parts.length === 1 &&
      tok.parts[0]!.expandable &&
      tok.parts[0]!.text === "$@" &&
      tok.quoted
    ) {
      for (const arg of envState.positional) {
        words.push(arg);
        quoted.push(true);
        assignBeforeQuote.push(false);
      }
      continue;
    }
    if (!tok.parts || tok.parts.length === 0) {
      words.push(tok.value);
      quoted.push(Boolean(tok.quoted));
      assignBeforeQuote.push(Boolean(tok.assignBeforeQuote));
      continue;
    }
    let out = "";
    let hadUnquotedParamExpansion = false;
    for (const part of tok.parts) {
      if (!part.expandable) {
        out += part.text;
      } else {
        if (!tok.quoted && part.text.includes("$")) {
          hadUnquotedParamExpansion = true;
        }
        const exp = expandShellVarSegment(part.text, envState, lastStatusOrOk);
        if (exp.hadUnboundVar) hadUnboundVar = true;
        if (exp.hadFatalError) hadFatalError = true;
        if (exp.hadRuntimePid) hadRuntimePid = true;
        out += exp.text;
      }
    }
    if (!tok.quoted && !tok.assignBeforeQuote && hadUnquotedParamExpansion) {
      const splitPieces = out.split(/[ \t\r\n]+/).filter((p) => p.length > 0);
      for (const piece of splitPieces) {
        words.push(piece);
        quoted.push(false);
        assignBeforeQuote.push(false);
      }
    } else {
      words.push(out);
      quoted.push(Boolean(tok.quoted));
      assignBeforeQuote.push(Boolean(tok.assignBeforeQuote));
    }
  }
  return { words, quoted, assignBeforeQuote, hadUnboundVar, hadFatalError, hadRuntimePid };
}

function evaluateBashArithmetic(
  exprTokens: readonly ShellToken[],
  envState: ShellEnvState,
  lastStatusOrOk: number | boolean,
): { valid: boolean; nonZero: boolean; unboundError?: boolean } {
  const exp = expandShellCommandTokens(exprTokens, envState, lastStatusOrOk);
  if (envState.nounset && exp.hadUnboundVar) {
    return { valid: false, nonZero: false, unboundError: true };
  }
  const raw = exp.words.join(" ").trim();
  if (!raw) return { valid: true, nonZero: false };
  const toI64 = (v: bigint): bigint => BigInt.asIntN(64, v);
  type ArithTok =
    | { readonly t: "num"; readonly v: bigint }
    | { readonly t: "id"; readonly v: string }
    | { readonly t: "op"; readonly v: string };
  const toks: ArithTok[] = [];
  let p = 0;
  while (p < raw.length) {
    const ch = raw[p]!;
    if (/\s/.test(ch)) {
      p += 1;
      continue;
    }
    const rest = raw.slice(p);
    const hexMatch = /^0[xX][0-9a-fA-F]+/.exec(rest);
    if (hexMatch) {
      toks.push({ t: "num", v: toI64(BigInt(hexMatch[0])) });
      p += hexMatch[0].length;
      continue;
    }
    const decMatch = /^\d+/.exec(rest);
    if (decMatch) {
      const lit = decMatch[0];
      if (lit.length > 1 && lit.startsWith("0") && !/^0[0-7]+$/.test(lit)) {
        return { valid: false, nonZero: false };
      }
      const val = lit.startsWith("0") ? BigInt(`0o${lit}`) : BigInt(lit);
      toks.push({ t: "num", v: toI64(val) });
      p += lit.length;
      continue;
    }
    const idMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (idMatch) {
      toks.push({ t: "id", v: idMatch[0] });
      p += idMatch[0].length;
      continue;
    }
    const three = raw.slice(p, p + 3);
    if (three === "<<=" || three === ">>=") {
      toks.push({ t: "op", v: three });
      p += 3;
      continue;
    }
    const two = raw.slice(p, p + 2);
    if (
      two === "**" ||
      two === "<<" ||
      two === ">>" ||
      two === "==" ||
      two === "!=" ||
      two === "<=" ||
      two === ">=" ||
      two === "&&" ||
      two === "||" ||
      two === "++" ||
      two === "--" ||
      two === "+=" ||
      two === "-=" ||
      two === "*=" ||
      two === "/=" ||
      two === "%=" ||
      two === "&=" ||
      two === "^=" ||
      two === "|="
    ) {
      toks.push({ t: "op", v: two });
      p += 2;
      continue;
    }
    if ("+-*/%<>&^|~!?:,()=".includes(ch)) {
      toks.push({ t: "op", v: ch });
      p += 1;
      continue;
    }
    return { valid: false, nonZero: false };
  }
  let pos = 0;
  let failed = false;
  let unboundFailed = false;
  const peek = (): ArithTok | undefined => toks[pos];
  const take = (): ArithTok | undefined => toks[pos++];
  const readVar = (name: string): bigint => {
    if (!Object.hasOwn(envState.vars, name)) {
      if (envState.nounset) {
        unboundFailed = true;
        failed = true;
      }
      return 0n;
    }
    const rawVar = (envState.vars[name] ?? "").trim();
    if (!rawVar) return 0n;
    if (/^[+-]?(?:[1-9]\d*|0[xX][0-9a-fA-F]+|0[0-7]*)$/.test(rawVar)) {
      const sign = rawVar.startsWith("-") ? -1n : 1n;
      const abs = rawVar.replace(/^[+-]/, "");
      if (abs.startsWith("0x") || abs.startsWith("0X")) return toI64(sign * BigInt(abs));
      if (abs.length > 1 && abs.startsWith("0")) return toI64(sign * BigInt(`0o${abs}`));
      return toI64(sign * BigInt(abs));
    }
    return 0n;
  };
  const powI64 = (base: bigint, exp: bigint): bigint => {
    let res = 1n;
    let b = BigInt.asUintN(64, base);
    let e = exp;
    while (e > 0n) {
      if ((e & 1n) === 1n) res = BigInt.asUintN(64, res * b);
      b = BigInt.asUintN(64, b * b);
      e >>= 1n;
    }
    return toI64(res);
  };
  const parseComma = (ev: boolean): bigint => {
    let val = parseAssign(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === ",") {
      take();
      val = parseAssign(ev);
    }
    return val;
  };
  const parseAssign = (ev: boolean): bigint => {
    const cur = peek();
    const next = toks[pos + 1];
    if (
      cur?.t === "id" &&
      next?.t === "op" &&
      ["=", "+=", "-=", "*=", "/=", "%=", "&=", "^=", "|=", "<<=", ">>="].includes(next.v)
    ) {
      take();
      take();
      const rhs = parseAssign(ev);
      if (!ev) return 0n;
      const lhs = next.v === "=" ? 0n : readVar(cur.v);
      let res = rhs;
      if (next.v === "+=") res = lhs + rhs;
      else if (next.v === "-=") res = lhs - rhs;
      else if (next.v === "*=") res = lhs * rhs;
      else if (next.v === "/=") {
        if (rhs === 0n) {
          failed = true;
          return 0n;
        }
        res = lhs / rhs;
      } else if (next.v === "%=") {
        if (rhs === 0n) {
          failed = true;
          return 0n;
        }
        res = lhs % rhs;
      } else if (next.v === "&=") res = lhs & rhs;
      else if (next.v === "^=") res = lhs ^ rhs;
      else if (next.v === "|=") res = lhs | rhs;
      else if (next.v === "<<=") res = lhs << (rhs & 63n);
      else if (next.v === ">>=") res = lhs >> (rhs & 63n);
      const wrapped = toI64(res);
      envState.vars[cur.v] = String(wrapped);
      if (envState.allexport) envState.exported.add(cur.v);
      return wrapped;
    }
    return parseTernary(ev);
  };
  const parseTernary = (ev: boolean): bigint => {
    const cond = parseLogOr(ev);
    if (!failed && peek()?.t === "op" && peek()?.v === "?") {
      take();
      const tVal = parseComma(ev && cond !== 0n);
      if (peek()?.t !== "op" || peek()?.v !== ":") {
        failed = true;
        return 0n;
      }
      take();
      const fVal = parseTernary(ev && cond === 0n);
      return ev ? (cond !== 0n ? tVal : fVal) : 0n;
    }
    return cond;
  };
  const parseLogOr = (ev: boolean): bigint => {
    let left = parseLogAnd(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === "||") {
      take();
      const right = parseLogAnd(ev && left === 0n);
      if (ev) left = left !== 0n || right !== 0n ? 1n : 0n;
    }
    return left;
  };
  const parseLogAnd = (ev: boolean): bigint => {
    let left = parseBitOr(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === "&&") {
      take();
      const right = parseBitOr(ev && left !== 0n);
      if (ev) left = left !== 0n && right !== 0n ? 1n : 0n;
    }
    return left;
  };
  const parseBitOr = (ev: boolean): bigint => {
    let left = parseBitXor(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === "|") {
      take();
      const right = parseBitXor(ev);
      if (ev) left = toI64(left | right);
    }
    return left;
  };
  const parseBitXor = (ev: boolean): bigint => {
    let left = parseBitAnd(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === "^") {
      take();
      const right = parseBitAnd(ev);
      if (ev) left = toI64(left ^ right);
    }
    return left;
  };
  const parseBitAnd = (ev: boolean): bigint => {
    let left = parseEq(ev);
    while (!failed && peek()?.t === "op" && peek()?.v === "&") {
      take();
      const right = parseEq(ev);
      if (ev) left = toI64(left & right);
    }
    return left;
  };
  const parseEq = (ev: boolean): bigint => {
    let left = parseRel(ev);
    while (!failed && peek()?.t === "op" && (peek()?.v === "==" || peek()?.v === "!=")) {
      const op = take()!.v as string;
      const right = parseRel(ev);
      if (ev) left = (op === "==" ? left === right : left !== right) ? 1n : 0n;
    }
    return left;
  };
  const parseRel = (ev: boolean): bigint => {
    let left = parseShift(ev);
    while (
      !failed &&
      peek()?.t === "op" &&
      (peek()?.v === "<" || peek()?.v === "<=" || peek()?.v === ">" || peek()?.v === ">=")
    ) {
      const op = take()!.v as string;
      const right = parseShift(ev);
      if (ev) {
        left = (
          op === "<"
            ? left < right
            : op === "<="
              ? left <= right
              : op === ">"
                ? left > right
                : left >= right
        )
          ? 1n
          : 0n;
      }
    }
    return left;
  };
  const parseShift = (ev: boolean): bigint => {
    let left = parseAdd(ev);
    while (!failed && peek()?.t === "op" && (peek()?.v === "<<" || peek()?.v === ">>")) {
      const op = take()!.v as string;
      const right = parseAdd(ev);
      if (ev) {
        left = toI64(op === "<<" ? left << (right & 63n) : left >> (right & 63n));
      }
    }
    return left;
  };
  const parseAdd = (ev: boolean): bigint => {
    let left = parseMul(ev);
    while (!failed && peek()?.t === "op" && (peek()?.v === "+" || peek()?.v === "-")) {
      const op = take()!.v as string;
      const right = parseMul(ev);
      if (ev) left = toI64(op === "+" ? left + right : left - right);
    }
    return left;
  };
  const parseMul = (ev: boolean): bigint => {
    let left = parsePow(ev);
    while (!failed && peek()?.t === "op" && (peek()?.v === "*" || peek()?.v === "/" || peek()?.v === "%")) {
      const op = take()!.v as string;
      const right = parsePow(ev);
      if (!ev) continue;
      if (op === "*") left = toI64(left * right);
      else {
        if (right === 0n) {
          failed = true;
          return 0n;
        }
        left = toI64(op === "/" ? left / right : left % right);
      }
    }
    return left;
  };
  const parsePow = (ev: boolean): bigint => {
    const base = parseUnary(ev);
    if (!failed && peek()?.t === "op" && peek()?.v === "**") {
      take();
      const exp = parsePow(ev);
      if (!ev) return 0n;
      if (exp < 0n) {
        failed = true;
        return 0n;
      }
      return powI64(base, exp);
    }
    return base;
  };
  const parseUnary = (ev: boolean): bigint => {
    const cur = peek();
    if (cur?.t === "op" && (cur.v === "+" || cur.v === "-" || cur.v === "!" || cur.v === "~")) {
      take();
      const v = parseUnary(ev);
      if (!ev) return 0n;
      if (cur.v === "+") return toI64(v);
      if (cur.v === "-") return toI64(-v);
      if (cur.v === "!") return v === 0n ? 1n : 0n;
      return toI64(~v);
    }
    if (cur?.t === "op" && (cur.v === "++" || cur.v === "--") && toks[pos + 1]?.t === "id") {
      take();
      const idTok = take() as { t: "id"; v: string };
      if (!ev) return 0n;
      const nv = toI64(readVar(idTok.v) + (cur.v === "++" ? 1n : -1n));
      envState.vars[idTok.v] = String(nv);
      if (envState.allexport) envState.exported.add(idTok.v);
      return nv;
    }
    return parsePrimary(ev);
  };
  const parsePrimary = (ev: boolean): bigint => {
    const cur = take();
    if (!cur) {
      failed = true;
      return 0n;
    }
    if (cur.t === "num") return cur.v;
    if (cur.t === "id") {
      if (peek()?.t === "op" && (peek()?.v === "++" || peek()?.v === "--")) {
        const op = take()!.v;
        if (!ev) return 0n;
        const old = readVar(cur.v);
        const nv = toI64(old + (op === "++" ? 1n : -1n));
        envState.vars[cur.v] = String(nv);
        if (envState.allexport) envState.exported.add(cur.v);
        return old;
      }
      return ev ? readVar(cur.v) : 0n;
    }
    if (cur.t === "op" && cur.v === "(") {
      const inner = parseComma(ev);
      if (peek()?.t !== "op" || peek()?.v !== ")") {
        failed = true;
        return 0n;
      }
      take();
      return inner;
    }
    failed = true;
    return 0n;
  };
  const result = parseComma(true);
  if (unboundFailed) return { valid: false, nonZero: false, unboundError: true };
  if (failed || pos !== toks.length) return { valid: false, nonZero: false };
  return { valid: true, nonZero: result !== 0n };
}

function executeShellTokens(
  tokens: readonly ShellToken[],
  envState: ShellEnvState,
  functions: Map<string, ShellFunctionDef>,
  report: {
    launches: ShellLaunchEntry[];
    dockerRuns: ParsedDockerRunResult[];
    bareFlagCount: number;
    unterminatedQuote: boolean;
    syntaxError: boolean;
    stmtSeq: number;
  },
  depth: number,
  inFunction = false,
  inLoop = false,
  initialLastStatus = 0,
  condUnknown?: { unknown: boolean },
  suppressErrexitScope = false,
): {
  exited: boolean;
  returned?: boolean | undefined;
  broke?: number | undefined;
  continued?: number | undefined;
  lastOk: boolean;
  lastStatus: number;
  noexecTriggered?: boolean | undefined;
} {
  if (depth > 160) {
    report.syntaxError = true;
    return { exited: true, lastOk: false, lastStatus: 2 };
  }
  if (envState.noexec) return { exited: true, lastOk: true, lastStatus: 0, noexecTriggered: true };
  const entries = parseShellLists(tokens, () => {
    report.syntaxError = true;
  });
  if (report.syntaxError) return { exited: false, lastOk: false, lastStatus: 2 };
  return executeParsedShellLists(
    entries,
    envState,
    functions,
    report,
    depth,
    inFunction,
    inLoop,
    initialLastStatus,
    condUnknown,
    suppressErrexitScope,
  );
}

function executeParsedShellLists(
  entries: readonly ShellListEntry[],
  envState: ShellEnvState,
  functions: Map<string, ShellFunctionDef>,
  report: {
    launches: ShellLaunchEntry[];
    dockerRuns: ParsedDockerRunResult[];
    bareFlagCount: number;
    unterminatedQuote: boolean;
    syntaxError: boolean;
    stmtSeq: number;
  },
  depth: number,
  inFunction = false,
  inLoop = false,
  initialLastStatus = 0,
  condUnknown?: { unknown: boolean },
  suppressErrexitScope = false,
): {
  exited: boolean;
  returned?: boolean | undefined;
  broke?: number | undefined;
  continued?: number | undefined;
  lastOk: boolean;
  lastStatus: number;
  noexecTriggered?: boolean | undefined;
} {
  let lastStatus = initialLastStatus;
  let lastOk = lastStatus === 0;

  const inspectCommandWords = (
    words: readonly string[],
    cmdEnv: Record<string, string>,
    stmtOrder: number,
    skipFunctions = false,
    inContainer = false,
    skipBuiltins = false,
    prevLastStatus = 0,
    wordQuoted: readonly boolean[] = [],
    hadUnboundVar = false,
    inErrexitSuppressedScope = false,
    usedRuntimePid = false,
    prefixAssigns?: Readonly<Record<string, string>>,
  ): {
    exited: boolean;
    returned?: boolean | undefined;
    broke?: number | undefined;
    continued?: number | undefined;
    ok: boolean;
    status: number;
    noexecTriggered?: boolean | undefined;
  } => {
    const head = words[0] ?? "";
    const second = words[1] ?? "";
    if (head === ":") {
      const ok = !skipBuiltins && !inContainer;
      return { exited: false, ok, status: ok ? 0 : 127 };
    }
    if (!inContainer && !skipFunctions && !skipBuiltins && functions.has(head)) {
      const fnDef = functions.get(head)!;
      const fnPositional = words.slice(1);
      const fnEnvState: ShellEnvState = fnDef.isSubshell
        ? {
            vars: { ...envState.vars },
            exported: new Set(envState.exported),
            args0: envState.args0,
            positional: fnPositional,
            allexport: envState.allexport,
            noexec: envState.noexec,
            errexit: envState.errexit,
            pipefail: envState.pipefail,
            nounset: envState.nounset,
          }
        : {
            vars: envState.vars,
            exported: envState.exported,
            args0: envState.args0,
            positional: fnPositional,
            allexport: envState.allexport,
            noexec: envState.noexec,
            errexit: envState.errexit,
            pipefail: envState.pipefail,
            nounset: envState.nounset,
          };
      const savedVars: Array<{
        key: string;
        hadOwn: boolean;
        prevVal: string | undefined;
        wasExported: boolean;
      }> = [];
      if (prefixAssigns) {
        for (const [k, v] of Object.entries(prefixAssigns)) {
          if (!fnDef.isSubshell) {
            savedVars.push({
              key: k,
              hadOwn: Object.hasOwn(fnEnvState.vars, k),
              prevVal: fnEnvState.vars[k],
              wasExported: fnEnvState.exported.has(k),
            });
          }
          fnEnvState.vars[k] = v;
          fnEnvState.exported.add(k);
        }
      }
      const fnFunctions = fnDef.isSubshell ? new Map(functions) : functions;
      try {
        const res = executeShellTokens(
          fnDef.body,
          fnEnvState,
          fnFunctions,
          report,
          depth + 1,
          true,
          false,
          prevLastStatus,
          condUnknown,
          inErrexitSuppressedScope,
        );
        if (!fnDef.isSubshell) {
          envState.allexport = fnEnvState.allexport;
          envState.noexec = fnEnvState.noexec;
          envState.errexit = fnEnvState.errexit;
          envState.pipefail = fnEnvState.pipefail;
          envState.nounset = fnEnvState.nounset;
        }
        return {
          exited: fnDef.isSubshell ? false : res.exited,
          ok: res.lastOk,
          status: res.lastStatus,
          noexecTriggered: res.noexecTriggered,
        };
      } finally {
        if (!fnDef.isSubshell) {
          for (const entry of savedVars) {
            if (entry.hadOwn && entry.prevVal !== undefined) {
              envState.vars[entry.key] = entry.prevVal;
            } else {
              delete envState.vars[entry.key];
            }
            if (entry.wasExported) envState.exported.add(entry.key);
            else envState.exported.delete(entry.key);
          }
        }
      }
    }
    if (!inContainer && !skipBuiltins && head === "pwd") {
      let pi = 1;
      let endOpts = false;
      while (pi < words.length) {
        const w = words[pi]!;
        if (!endOpts && w === "--") {
          endOpts = true;
          pi += 1;
          continue;
        }
        if (!endOpts && w.startsWith("-") && w.length > 1) {
          if (!/^-[LP]+$/.test(w)) return { exited: false, ok: false, status: 2 };
        }
        pi += 1;
      }
      return { exited: false, ok: true, status: 0 };
    }
    if (head === "sleep") {
      let si = 1;
      let endOpts = false;
      const operands: string[] = [];
      while (si < words.length) {
        const w = words[si]!;
        if (!endOpts && w === "--") {
          endOpts = true;
          si += 1;
          continue;
        }
        if (!endOpts && w.startsWith("-") && w.length > 1) return { exited: false, ok: false, status: 1 };
        operands.push(w);
        si += 1;
      }
      if (operands.some((op) => /^inf(?:inity)?[smhd]?$/i.test(op))) {
        return { exited: true, ok: false, status: 124 };
      }
      const validDur =
        operands.length >= 1 && operands.every((op) => /^(?:\d+(?:\.\d*)?|\.\d+)[smhd]?$/i.test(op));
      return { exited: false, ok: validDur, status: validDur ? 0 : 1 };
    }
    if (head === "mkdir") {
      let mi = 1;
      let endOpts = false;
      let parents = false;
      const operands: string[] = [];
      while (mi < words.length) {
        const w = words[mi]!;
        if (!endOpts && w === "--") {
          endOpts = true;
          mi += 1;
          continue;
        }
        if (!endOpts && w.startsWith("-") && w.length > 1) {
          if (w === "-m" && mi + 1 < words.length) {
            mi += 2;
            continue;
          }
          if (/^-[pv]+$/.test(w) || w === "--parents" || w === "--verbose" || w.startsWith("--mode=")) {
            if ((w.startsWith("-") && !w.startsWith("--") && w.includes("p")) || w === "--parents") {
              parents = true;
            }
            mi += 1;
            continue;
          }
          return { exited: false, ok: false, status: 1 };
        }
        operands.push(w);
        mi += 1;
      }
      const knownDirs = new Set([
        "/",
        ".",
        "..",
        "/tmp",
        "/var/tmp",
        "/etc",
        "/dev",
        "/usr",
        "/usr/bin",
        "/usr/sbin",
        "/bin",
        "/sbin",
        "/lib",
        "/lib64",
        "/var",
      ]);
      const knownFiles = new Set(["/dev/null", "/dev/zero", "/etc/hosts", "/etc/passwd", "/usr/bin/env"]);
      const validDirs =
        operands.length >= 1 &&
        operands.every(
          (op) =>
            op.length > 0 &&
            !op.startsWith("/nonexistent") &&
            !knownFiles.has(op) &&
            (parents || !knownDirs.has(op)),
        );
      return { exited: false, ok: validDirs, status: validDirs ? 0 : 1 };
    }
    if (BENIGN_SHELL_COMMANDS.has(head)) {
      const ok = head !== "false";
      return { exited: false, ok, status: ok ? 0 : 1 };
    }
    if (head === "printf") {
      let pi = 1;
      let destVar: string | null = null;
      while (pi < words.length) {
        const pw = words[pi]!;
        if (pw === "--") {
          pi += 1;
          break;
        }
        if (pw === "-v") {
          const cand = words[pi + 1];
          if (inContainer || skipBuiltins || cand === undefined || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cand)) {
            return { exited: false, ok: false, status: inContainer || skipBuiltins ? 1 : 2 };
          }
          destVar = cand;
          pi += 2;
          continue;
        }
        if (pw.startsWith("-v") && pw.length > 2) {
          const cand = pw.slice(2);
          if (inContainer || skipBuiltins || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cand)) {
            return { exited: false, ok: false, status: inContainer || skipBuiltins ? 1 : 2 };
          }
          destVar = cand;
          pi += 1;
          continue;
        }
        if (pw.startsWith("-") && pw.length > 1) {
          return { exited: false, ok: false, status: 2 };
        }
        break;
      }
      const fmt = words[pi];
      if (fmt === undefined) {
        return { exited: false, ok: false, status: 2 };
      }
      const argWords = words.slice(pi + 1);
      const printfRes = formatBashPrintfResult(fmt, argWords);
      if (printfRes.ok && destVar !== null && !inContainer && !skipBuiltins) {
        envState.vars[destVar] = printfRes.formatted;
        if (envState.allexport) envState.exported.add(destVar);
      }
      return { exited: false, ok: printfRes.ok, status: printfRes.ok ? 0 : 1 };
    }
    if (head === "cat") {
      let ci = 1;
      let endOpts = false;
      const operands: string[] = [];
      while (ci < words.length) {
        const w = words[ci]!;
        if (!endOpts && w === "--") {
          endOpts = true;
          ci += 1;
          continue;
        }
        if (!endOpts && w.startsWith("-") && w.length > 1) {
          const validCatOpt = w.startsWith("--") ? VALID_CAT_LONG_FLAGS.has(w) : /^-[AbeEnstTuv]+$/.test(w);
          if (!validCatOpt) return { exited: false, ok: false, status: 1 };
          ci += 1;
          continue;
        }
        operands.push(w);
        ci += 1;
      }
      const allVirtual = operands.every(
        (op) =>
          op === "-" ||
          op === "/dev/null" ||
          op === "/dev/zero" ||
          op === "/usr/bin/env" ||
          op === "/etc/hosts" ||
          op === "/etc/passwd",
      );
      return { exited: false, ok: allVirtual, status: allVirtual ? 0 : 1 };
    }
    if (!inContainer && !skipBuiltins && head === "cd") {
      let ci = 1;
      let endOpts = false;
      const operands: string[] = [];
      const opQuoted: boolean[] = [];
      while (ci < words.length) {
        const w = words[ci]!;
        if (!endOpts && w === "--") {
          endOpts = true;
          ci += 1;
          continue;
        }
        if (!endOpts && w.startsWith("-") && w.length > 1) {
          if (!/^-[LPe@]+$/.test(w)) return { exited: false, ok: false, status: 2 };
          ci += 1;
          continue;
        }
        operands.push(w);
        opQuoted.push(wordQuoted[ci] ?? false);
        ci += 1;
      }
      if (operands.length > 1) return { exited: false, ok: false, status: 1 };
      if (operands.length === 0) return { exited: false, ok: true, status: 0 };
      const targetDir = operands[0]!;
      const isQuoted = opQuoted[0] ?? false;
      if (targetDir === "~" && isQuoted) return { exited: false, ok: false, status: 1 };
      const cdOk =
        targetDir === "" ||
        targetDir === "." ||
        targetDir === ".." ||
        targetDir === "~" ||
        targetDir === "/" ||
        targetDir === "/tmp" ||
        targetDir === "/var/tmp" ||
        targetDir === "/usr" ||
        targetDir === "/usr/bin" ||
        targetDir === "/usr/sbin" ||
        targetDir === "/etc" ||
        targetDir === "/bin" ||
        targetDir === "/sbin" ||
        targetDir === "/lib" ||
        targetDir === "/lib64" ||
        targetDir === "/var";
      return { exited: false, ok: cdOk, status: cdOk ? 0 : 1 };
    }
    if (!inContainer && !skipBuiltins && head === "exit") {
      if (words.length > 2) {
        return { exited: true, ok: false, status: 1 };
      }
      const parsedExit = parseShellExitStatus(words[1], prevLastStatus);
      return { exited: true, ok: parsedExit.ok, status: parsedExit.status };
    }
    if (!inContainer && !skipBuiltins && head === "return") {
      if (words.length > 2) {
        return inFunction
          ? { exited: false, returned: true, ok: false, status: 1 }
          : { exited: false, ok: false, status: 2 };
      }
      const parsedRet = parseShellExitStatus(words[1], prevLastStatus);
      return inFunction
        ? { exited: false, returned: true, ok: parsedRet.ok, status: parsedRet.status }
        : { exited: false, ok: false, status: 2 };
    }
    if (!inContainer && !skipBuiltins && (head === "break" || head === "continue")) {
      const count = second !== "" ? (/^[1-9]\d*$/.test(second) ? Number.parseInt(second, 10) : 0) : 1;
      if (count <= 0) return { exited: false, ok: false, status: 1 };
      if (!inLoop) return { exited: false, ok: true, status: 0 };
      return head === "break"
        ? { exited: false, broke: count, ok: true, status: 0 }
        : { exited: false, continued: count, ok: true, status: 0 };
    }
    if (head === "test" || head === "[" || (!inContainer && !skipBuiltins && head === "[[")) {
      let testArgs: readonly string[] | null = null;
      if (head === "test") testArgs = words.slice(1);
      else if (head === "[" && words[words.length - 1] === "]") testArgs = words.slice(1, -1);
      else if (head === "[[" && words[words.length - 1] === "]]") testArgs = words.slice(1, -1);
      const truth =
        testArgs !== null ? evaluateStaticTestCommand(testArgs, hadUnboundVar, usedRuntimePid) : "unknown";
      if (truth === "unknown" && condUnknown) condUnknown.unknown = true;
      const ok = truth === "true";
      return { exited: false, ok, status: ok ? 0 : 1 };
    }

    if (head === "bash" || head === "sh" || head === "zsh") {
      const VALID_BASH_LONG_OPTS = new Set([
        "--norc",
        "--noprofile",
        "--login",
        "--posix",
        "--noediting",
        "--verbose",
        "--debug",
        "--noexec",
        "--errexit",
        "--nounset",
        "--help",
        "--version",
      ]);
      let noexec = false;
      let errexit = false;
      let pipefail = false;
      let nounset = false;
      let scriptWord: string | null = null;
      let scriptIdx = -1;
      for (let bi = 1; bi < words.length; bi += 1) {
        const bw = words[bi] ?? "";
        if (bw === "--" || bw === "-") break;
        if (bw.startsWith("--")) {
          if (!VALID_BASH_LONG_OPTS.has(bw)) {
            return { exited: false, ok: false, status: 2 };
          }
          if (bw === "--noexec") noexec = true;
          else if (bw === "--errexit") errexit = true;
          else if (bw === "--nounset") nounset = true;
          continue;
        }
        if (bw.startsWith("-") || bw.startsWith("+")) {
          const enable = bw.startsWith("-");
          const flagChars = bw.slice(1);
          if (flagChars.length === 0) break;
          let handledOptArg = false;
          for (let fi = 0; fi < flagChars.length; fi += 1) {
            const ch = flagChars[fi]!;
            if (ch === "o") {
              if (bi + 1 >= words.length) {
                return { exited: false, ok: false, status: 2 };
              }
              const optName = words[bi + 1] ?? "";
              if (!VALID_SET_LONG_OPTS.has(optName)) {
                return { exited: false, ok: false, status: 2 };
              }
              if (optName === "pipefail") pipefail = enable;
              else if (optName === "errexit") errexit = enable;
              else if (optName === "nounset") nounset = enable;
              else if (optName === "noexec") noexec = enable;
              bi += 1;
              handledOptArg = true;
              break;
            }
            if (ch === "O") {
              if (bi + 1 >= words.length) {
                return { exited: false, ok: false, status: 2 };
              }
              bi += 1;
              handledOptArg = true;
              break;
            }
            if (ch === "n") noexec = enable;
            else if (ch === "e") errexit = enable;
            else if (ch === "u") nounset = enable;
            else if (ch === "c") {
              if (!enable) return { exited: false, ok: false, status: 2 };
              const valIdx = words[bi + 1] === "--" && bi + 2 < words.length ? bi + 2 : bi + 1;
              if (valIdx >= words.length) {
                return { exited: false, ok: false, status: 2 };
              }
              scriptWord = words[valIdx] ?? "";
              scriptIdx = valIdx;
              break;
            } else if (!"abefhkmnptuvxBCHPTilrsD".includes(ch)) {
              return { exited: false, ok: false, status: 2 };
            }
          }
          if (scriptWord !== null) break;
          if (handledOptArg) continue;
          continue;
        }
        break;
      }
      if (scriptWord !== null) {
        if (noexec) return { exited: false, ok: true, status: 0 };
        const lexed = lexShellScript(scriptWord);
        if (lexed.unterminatedQuote) report.unterminatedQuote = true;
        const bashArgs0 =
          scriptIdx >= 0 && scriptIdx + 1 < words.length ? (words[scriptIdx + 1] ?? head) : head;
        const bashPositional =
          scriptIdx >= 0 && scriptIdx + 2 < words.length ? words.slice(scriptIdx + 2) : [];
        const subState: ShellEnvState = {
          vars: { ...cmdEnv },
          exported: new Set(Object.keys(cmdEnv)),
          args0: bashArgs0,
          positional: bashPositional,
          allexport: false,
          noexec: false,
          errexit,
          pipefail,
          nounset,
        };
        const subRes = executeShellTokens(
          lexed.tokens,
          subState,
          new Map(),
          report,
          depth + 1,
          false,
          false,
          0,
        );
        return { exited: false, ok: subRes.lastOk, status: subRes.lastStatus };
      }
    }

    if (head === "docker" && second === "run") {
      const parsedDocker = parseDockerRunOptions(words.slice(2), cmdEnv, stmtOrder);
      report.dockerRuns.push(parsedDocker);
      const containerCmdWords =
        parsedDocker.entrypoint !== undefined && parsedDocker.entrypoint.length > 0
          ? [parsedDocker.entrypoint, ...parsedDocker.remainingAfterImage]
          : parsedDocker.remainingAfterImage;
      let containerCmdOk =
        parsedDocker.hasImage && parsedDocker.unknownFlags.length === 0 && !parsedDocker.hasMissingFlagValue;
      if (containerCmdWords.length > 0) {
        const beforeCount = report.launches.length;
        const containerEnv: Record<string, string> = { ...parsedDocker.dockerEnv };
        const sub = unwrapServeStatementWords(containerCmdWords, containerEnv, false);
        if (sub.rest.length > 0) {
          const innerRes = inspectCommandWords(
            sub.rest,
            sub.env,
            stmtOrder,
            true,
            true,
            sub.externalContext,
            0,
          );
          containerCmdOk = containerCmdOk && innerRes.ok;
        } else {
          containerCmdOk = false;
        }
        parsedDocker.launchesInsideContainer = report.launches.length - beforeCount;
      }
      return { exited: false, ok: containerCmdOk, status: containerCmdOk ? 0 : 125 };
    }

    if (head === "vllm" && second === "serve") {
      report.launches.push({ kind: "vllm-serve", args: words.slice(2), envVars: cmdEnv, stmtOrder });
      return { exited: false, ok: true, status: 0 };
    }
    if ((head === "python" || head === "python3") && second === "-m") {
      if (words[2] === "vllm.entrypoints.openai.api_server") {
        report.launches.push({ kind: "python-api", args: words.slice(3), envVars: cmdEnv, stmtOrder });
        return { exited: false, ok: true, status: 0 };
      }
      if (words[2] === "vllm.entrypoints.cli.main" && words[3] === "serve") {
        report.launches.push({ kind: "vllm-serve", args: words.slice(4), envVars: cmdEnv, stmtOrder });
        return { exited: false, ok: true, status: 0 };
      }
    }
    if (head.startsWith("-")) {
      report.bareFlagCount += 1;
    }
    if (condUnknown) condUnknown.unknown = true;
    return { exited: false, ok: false, status: 127 };
  };

  const evaluateCondition = (
    condTokens: readonly ShellToken[],
    incomingStatus: number,
  ): {
    truth: "true" | "false" | "unknown";
    exited: boolean;
    returned?: boolean | undefined;
    broke?: number | undefined;
    continued?: number | undefined;
    lastOk: boolean;
    lastStatus: number;
    noexecTriggered?: boolean | undefined;
  } => {
    const condUnknownState = { unknown: false };
    const condRes = executeShellTokens(
      condTokens,
      envState,
      functions,
      report,
      depth + 1,
      inFunction,
      inLoop,
      incomingStatus,
      condUnknownState,
      true,
    );
    if (condRes.exited || condRes.returned || condRes.broke || condRes.continued || condRes.noexecTriggered) {
      return {
        truth: "unknown",
        exited: condRes.exited,
        returned: condRes.returned,
        broke: condRes.broke,
        continued: condRes.continued,
        lastOk: condRes.lastOk,
        lastStatus: condRes.lastStatus,
        noexecTriggered: condRes.noexecTriggered,
      };
    }
    return {
      truth: condUnknownState.unknown ? "unknown" : condRes.lastOk ? "true" : "false",
      exited: false,
      lastOk: condRes.lastOk,
      lastStatus: condRes.lastStatus,
    };
  };

  const cloneShellEnvState = (
    src: ShellEnvState,
    overrides?: Partial<
      Pick<
        ShellEnvState,
        "errexit" | "noexec" | "allexport" | "pipefail" | "nounset" | "positional" | "args0"
      >
    >,
  ): ShellEnvState => ({
    vars: { ...src.vars },
    exported: new Set(src.exported),
    args0: overrides?.args0 ?? src.args0,
    positional: overrides?.positional ? [...overrides.positional] : [...src.positional],
    allexport: overrides?.allexport ?? src.allexport,
    noexec: overrides?.noexec ?? src.noexec,
    errexit: overrides?.errexit ?? src.errexit,
    pipefail: overrides?.pipefail ?? src.pipefail,
    nounset: overrides?.nounset ?? src.nounset,
  });

  type ExecOutcome = {
    exited: boolean;
    returned?: boolean | undefined;
    broke?: number | undefined;
    continued?: number | undefined;
    lastOk: boolean;
    lastStatus: number;
    noexecTriggered?: boolean | undefined;
    suppressErrexit?: boolean | undefined;
  };

  const VALID_SET_LONG_OPTS = new Set([
    "allexport",
    "braceexpand",
    "emacs",
    "errexit",
    "errtrace",
    "functrace",
    "hashall",
    "histexpand",
    "history",
    "ignoreeof",
    "interactive-comments",
    "keyword",
    "monitor",
    "noclobber",
    "noexec",
    "noglob",
    "nolog",
    "notify",
    "nounset",
    "onecmd",
    "physical",
    "pipefail",
    "posix",
    "privileged",
    "verbose",
    "vi",
    "xtrace",
  ]);

  const evalSingleSimpleCmd = (
    cmd: Extract<ShellPipelineCmd, { kind: "simple" }>,
    curStatus: number,
    cmdSuppressErrexit: boolean,
  ): ExecOutcome => {
    if (cmd.redirFailed) return { exited: false, lastOk: false, lastStatus: 1 };
    const { words, quoted, assignBeforeQuote, hadUnboundVar, hadFatalError, hadRuntimePid } =
      expandShellCommandTokens(cmd.tokens, envState, curStatus);
    if (hadFatalError || (envState.nounset && hadUnboundVar)) {
      return { exited: true, lastOk: false, lastStatus: 1 };
    }
    if (words.length === 0) return { exited: false, lastOk: true, lastStatus: 0 };

    let assignCount = 0;
    while (
      assignCount < words.length &&
      assignBeforeQuote[assignCount] &&
      SERVE_ASSIGN_RE.test(words[assignCount]!)
    ) {
      assignCount += 1;
    }
    if (assignCount === words.length) {
      for (const w of words) {
        const m = SERVE_ASSIGN_RE.exec(w)!;
        envState.vars[m[1]!] = m[2]!;
        if (envState.allexport) envState.exported.add(m[1]!);
      }
      return { exited: false, lastOk: true, lastStatus: 0 };
    }

    const prefixAssigns: Record<string, string> = {};
    for (let ai = 0; ai < assignCount; ai += 1) {
      const m = SERVE_ASSIGN_RE.exec(words[ai]!)!;
      prefixAssigns[m[1]!] = m[2]!;
    }

    let effWords = words.slice(assignCount);
    let allowFns = true;
    if (effWords[0] === "command" && !functions.has("command")) {
      let cIdx = 1;
      let isQuery = false;
      while (cIdx < effWords.length) {
        const cw = effWords[cIdx]!;
        if (cw === "--") {
          cIdx += 1;
          break;
        }
        if (/^-[pvV]+$/.test(cw)) {
          if (cw.includes("v") || cw.includes("V")) isQuery = true;
          cIdx += 1;
          continue;
        }
        break;
      }
      if (!isQuery && cIdx < effWords.length) {
        effWords = effWords.slice(cIdx);
        allowFns = false;
      }
    }
    const effHead = effWords[0] ?? "";
    const dispatchBuiltin = !allowFns || !functions.has(effHead);

    if (dispatchBuiltin && effHead === "set") {
      const applySetOptName = (optName: string, enable: boolean): boolean => {
        if (!VALID_SET_LONG_OPTS.has(optName)) return false;
        if (optName === "allexport") envState.allexport = enable;
        else if (optName === "noexec") envState.noexec = enable;
        else if (optName === "errexit") envState.errexit = enable;
        else if (optName === "pipefail") envState.pipefail = enable;
        else if (optName === "nounset") envState.nounset = enable;
        return true;
      };
      let setOk = true;
      let newPositional: string[] | null = null;
      for (let si = 1; si < effWords.length; si += 1) {
        const sw = effWords[si] ?? "";
        if (sw === "--" || sw === "-") {
          newPositional = effWords.slice(si + 1);
          break;
        }
        if (!sw.startsWith("-") && !sw.startsWith("+")) {
          newPositional = effWords.slice(si);
          break;
        }
        if (sw === "-o" || sw === "+o") {
          const enable = sw === "-o";
          if (si + 1 < effWords.length) {
            const optName = effWords[si + 1] ?? "";
            if (!applySetOptName(optName, enable)) setOk = false;
            si += 1;
          }
          continue;
        }
        if ((sw.startsWith("-") || sw.startsWith("+")) && !sw.startsWith("--") && sw.length > 1) {
          const enable = sw.startsWith("-");
          for (const ch of sw.slice(1)) {
            if (ch === "a") envState.allexport = enable;
            else if (ch === "n") envState.noexec = enable;
            else if (ch === "e") envState.errexit = enable;
            else if (ch === "u") envState.nounset = enable;
            else if (ch === "o") {
              if (si + 1 < effWords.length) {
                const optName = effWords[si + 1] ?? "";
                if (!applySetOptName(optName, enable)) setOk = false;
                si += 1;
              }
              break;
            } else if (!"bfhkmpptvxBCHPT".includes(ch)) {
              setOk = false;
            }
          }
        } else {
          setOk = false;
        }
      }
      if (!setOk) return { exited: false, lastOk: false, lastStatus: 2 };
      if (newPositional !== null) {
        envState.positional = newPositional;
      }
      if (envState.noexec) return { exited: true, lastOk: true, lastStatus: 0, noexecTriggered: true };
      return { exited: false, lastOk: true, lastStatus: 0 };
    }
    if (dispatchBuiltin && effHead === "export") {
      let unexport = false;
      let endOpts = false;
      let exportOk = true;
      for (const w of effWords.slice(1)) {
        if (!endOpts && w === "--") {
          endOpts = true;
          continue;
        }
        if (!endOpts && w === "-p") continue;
        if (!endOpts && w === "-n") {
          unexport = true;
          continue;
        }
        if (!endOpts && w.startsWith("-")) {
          exportOk = false;
          continue;
        }
        const m = SERVE_ASSIGN_RE.exec(w);
        if (m) {
          envState.vars[m[1]!] = m[2]!;
          if (unexport) envState.exported.delete(m[1]!);
          else envState.exported.add(m[1]!);
        } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(w)) {
          if (unexport) envState.exported.delete(w);
          else if (Object.hasOwn(envState.vars, w)) envState.exported.add(w);
        } else {
          exportOk = false;
        }
      }
      return { exited: false, lastOk: exportOk, lastStatus: exportOk ? 0 : 1 };
    }
    if (dispatchBuiltin && effHead === "unset") {
      let unsetOk = true;
      let mode: "default" | "var" | "fn" = "default";
      let endOpts = false;
      for (const w of effWords.slice(1)) {
        if (!endOpts && w === "--") {
          endOpts = true;
          continue;
        }
        if (!endOpts && w === "-f") {
          if (mode === "var") unsetOk = false;
          else mode = "fn";
          continue;
        }
        if (!endOpts && w === "-v") {
          if (mode === "fn") unsetOk = false;
          else mode = "var";
          continue;
        }
        if (!endOpts && (w.startsWith("-") || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(w))) {
          unsetOk = false;
          continue;
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(w)) {
          unsetOk = false;
          continue;
        }
        if (mode === "fn") {
          functions.delete(w);
        } else if (mode === "var") {
          delete envState.vars[w];
          envState.exported.delete(w);
        } else if (Object.hasOwn(envState.vars, w)) {
          delete envState.vars[w];
          envState.exported.delete(w);
        } else {
          functions.delete(w);
        }
      }
      return { exited: false, lastOk: unsetOk, lastStatus: unsetOk ? 0 : 1 };
    }
    if (dispatchBuiltin && effHead === "exit") {
      if (effWords.length > 2) {
        return { exited: true, lastOk: false, lastStatus: 1 };
      }
      const parsedExit = parseShellExitStatus(effWords[1], curStatus);
      return { exited: true, lastOk: parsedExit.ok, lastStatus: parsedExit.status };
    }
    if (dispatchBuiltin && effHead === "return") {
      if (effWords.length > 2) {
        return inFunction
          ? { exited: false, returned: true, lastOk: false, lastStatus: 1 }
          : { exited: false, lastOk: false, lastStatus: 2 };
      }
      const parsedRet = parseShellExitStatus(effWords[1], curStatus);
      if (inFunction) {
        return { exited: false, returned: true, lastOk: parsedRet.ok, lastStatus: parsedRet.status };
      }
      return { exited: false, lastOk: false, lastStatus: 2 };
    }
    if (dispatchBuiltin && (effHead === "break" || effHead === "continue")) {
      const arg = effWords[1];
      const count = arg !== undefined ? (/^[1-9]\d*$/.test(arg) ? Number.parseInt(arg, 10) : 0) : 1;
      if (count <= 0) return { exited: false, lastOk: false, lastStatus: 1 };
      if (inLoop) {
        return effHead === "break"
          ? { exited: false, broke: count, lastOk: true, lastStatus: 0 }
          : { exited: false, continued: count, lastOk: true, lastStatus: 0 };
      }
      return { exited: false, lastOk: true, lastStatus: 0 };
    }
    report.stmtSeq += 1;
    const stmtOrder = report.stmtSeq;
    const {
      rest,
      env: cmdEnv,
      replacedProcess,
      skipFunctions,
      externalContext,
      commandQueryTarget,
    } = unwrapServeStatementWords(words, getExportedEnv(envState), true, !functions.has("command"));
    if (commandQueryTarget !== undefined) {
      const known =
        BENIGN_SHELL_COMMANDS.has(commandQueryTarget) ||
        SHELL_QUERY_BUILTINS.has(commandQueryTarget) ||
        functions.has(commandQueryTarget);
      return { exited: false, lastOk: known, lastStatus: known ? 0 : 1 };
    }
    if (rest.length > 0) {
      const restQuoted = quoted.slice(words.length - rest.length);
      const cmdRes = inspectCommandWords(
        rest,
        cmdEnv,
        stmtOrder,
        skipFunctions,
        false,
        externalContext,
        curStatus,
        restQuoted,
        hadUnboundVar,
        cmdSuppressErrexit,
        hadRuntimePid,
        assignCount > 0 ? prefixAssigns : undefined,
      );
      if (cmdRes.returned && inFunction) {
        return {
          exited: false,
          returned: true,
          lastOk: cmdRes.ok,
          lastStatus: cmdRes.status,
          noexecTriggered: cmdRes.noexecTriggered,
        };
      }
      if (cmdRes.broke && inLoop) {
        return {
          exited: false,
          broke: cmdRes.broke,
          lastOk: cmdRes.ok,
          lastStatus: cmdRes.status,
          noexecTriggered: cmdRes.noexecTriggered,
        };
      }
      if (cmdRes.continued && inLoop) {
        return {
          exited: false,
          continued: cmdRes.continued,
          lastOk: cmdRes.ok,
          lastStatus: cmdRes.status,
          noexecTriggered: cmdRes.noexecTriggered,
        };
      }
      if (replacedProcess || cmdRes.exited) {
        return {
          exited: true,
          lastOk: cmdRes.ok,
          lastStatus: cmdRes.status,
          noexecTriggered: cmdRes.noexecTriggered,
        };
      }
      return {
        exited: false,
        lastOk: cmdRes.ok,
        lastStatus: cmdRes.status,
        noexecTriggered: cmdRes.noexecTriggered,
      };
    }
    return { exited: false, lastOk: true, lastStatus: 0 };
  };

  const probeBranchExits = (branchTokens: readonly ShellToken[], incomingStatus: number): boolean => {
    const probeReport = {
      launches: [] as ShellLaunchEntry[],
      dockerRuns: [] as ParsedDockerRunResult[],
      bareFlagCount: 0,
      unterminatedQuote: false,
      syntaxError: false,
      stmtSeq: 0,
    };
    const res = executeShellTokens(
      branchTokens,
      cloneShellEnvState(envState),
      new Map(functions),
      probeReport,
      depth + 1,
      inFunction,
      inLoop,
      incomingStatus,
    );
    return Boolean(res.exited || res.returned || res.broke || res.continued || res.noexecTriggered);
  };

  const executeSingleCmd = (
    cmd: ShellPipelineCmd,
    curStatus: number,
    cmdSuppressErrexit: boolean,
  ): ExecOutcome => {
    if ("redirFailed" in cmd && cmd.redirFailed) {
      return { exited: false, lastOk: false, lastStatus: 1, suppressErrexit: cmd.kind !== "simple" };
    }
    if (cmd.kind === "funcdef") {
      functions.set(cmd.name, { body: cmd.body, isSubshell: cmd.isSubshell });
      return { exited: false, lastOk: true, lastStatus: 0 };
    }
    if (cmd.kind === "arith") {
      const arith = evaluateBashArithmetic(cmd.exprTokens, envState, curStatus);
      if (arith.unboundError) return { exited: true, lastOk: false, lastStatus: 1 };
      const arithOk = arith.valid && arith.nonZero;
      return { exited: false, lastOk: arithOk, lastStatus: arithOk ? 0 : 1 };
    }
    if (cmd.kind === "subshell") {
      const res = executeShellTokens(
        cmd.inner,
        cloneShellEnvState(envState),
        new Map(functions),
        report,
        depth + 1,
        inFunction,
        false,
        curStatus,
        undefined,
        cmdSuppressErrexit,
      );
      return { exited: false, lastOk: res.lastOk, lastStatus: res.lastStatus };
    }
    if (cmd.kind === "group") {
      return executeShellTokens(
        cmd.inner,
        envState,
        functions,
        report,
        depth + 1,
        inFunction,
        inLoop,
        curStatus,
        condUnknown,
        cmdSuppressErrexit,
      );
    }
    if (cmd.kind === "loop") {
      const MAX_LOOP_ITERS = 4096;
      let iter = 0;
      let loopLastOk = true;
      let loopLastStatus = 0;
      let entered = false;
      while (iter < MAX_LOOP_ITERS) {
        const condRes = evaluateCondition(cmd.cond, iter === 0 ? curStatus : loopLastStatus);
        if (condRes.exited || condRes.returned || condRes.broke || condRes.continued) {
          return condRes;
        }
        const shouldEnter =
          (cmd.loopKind === "while" && condRes.truth === "true") ||
          (cmd.loopKind === "until" && condRes.truth === "false");
        if (!shouldEnter) {
          if (condRes.truth === "unknown" && probeBranchExits(cmd.body, condRes.lastStatus)) {
            return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
          }
          return {
            exited: false,
            lastOk: entered ? loopLastOk : true,
            lastStatus: entered ? loopLastStatus : 0,
            suppressErrexit: true,
          };
        }
        entered = true;
        iter += 1;
        const res = executeShellTokens(
          cmd.body,
          envState,
          functions,
          report,
          depth + 1,
          inFunction,
          true,
          condRes.lastStatus,
          undefined,
          cmdSuppressErrexit,
        );
        loopLastOk = res.lastOk;
        loopLastStatus = res.lastStatus;
        if (res.exited || res.returned) {
          return {
            exited: res.exited,
            returned: res.returned,
            lastOk: loopLastOk,
            lastStatus: loopLastStatus,
            noexecTriggered: res.noexecTriggered,
          };
        }
        if (res.broke) {
          if (res.broke > 1) {
            return {
              exited: false,
              broke: res.broke - 1,
              lastOk: loopLastOk,
              lastStatus: loopLastStatus,
              noexecTriggered: res.noexecTriggered,
            };
          }
          return { exited: false, lastOk: loopLastOk, lastStatus: loopLastStatus, suppressErrexit: true };
        }
        if (res.continued && res.continued > 1) {
          return {
            exited: false,
            continued: res.continued - 1,
            lastOk: loopLastOk,
            lastStatus: loopLastStatus,
            noexecTriggered: res.noexecTriggered,
          };
        }
      }
      return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
    }
    if (cmd.kind === "for") {
      let forLastOk = true;
      let forLastStatus = 0;
      if (cmd.cStyle) {
        const evalForArith = (
          clauseTokens: readonly ShellToken[],
          incomingStatus: number,
          emptyIsOne: boolean,
        ): { valid: boolean; nonZero: boolean; unboundError?: boolean } => {
          if (clauseTokens.length === 0) return { valid: true, nonZero: emptyIsOne };
          return evaluateBashArithmetic(clauseTokens, envState, incomingStatus);
        };
        const initRes = evalForArith(cmd.cStyle.init, curStatus, false);
        if (!initRes.valid || initRes.unboundError) {
          return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
        }
        const MAX_FOR_ITERS = 4096;
        let iter = 0;
        let entered = false;
        while (iter < MAX_FOR_ITERS) {
          const condRes = evalForArith(cmd.cStyle.cond, entered ? forLastStatus : curStatus, true);
          if (!condRes.valid || condRes.unboundError) {
            return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
          }
          if (!condRes.nonZero) {
            return {
              exited: false,
              lastOk: entered ? forLastOk : true,
              lastStatus: entered ? forLastStatus : 0,
              suppressErrexit: true,
            };
          }
          entered = true;
          iter += 1;
          const res = executeShellTokens(
            cmd.body,
            envState,
            functions,
            report,
            depth + 1,
            inFunction,
            true,
            forLastStatus,
            undefined,
            cmdSuppressErrexit,
          );
          forLastOk = res.lastOk;
          forLastStatus = res.lastStatus;
          if (res.exited || res.returned) {
            return {
              exited: res.exited,
              returned: res.returned,
              lastOk: forLastOk,
              lastStatus: forLastStatus,
              noexecTriggered: res.noexecTriggered,
            };
          }
          if (res.broke) {
            if (res.broke > 1) {
              return {
                exited: false,
                broke: res.broke - 1,
                lastOk: forLastOk,
                lastStatus: forLastStatus,
                noexecTriggered: res.noexecTriggered,
              };
            }
            return { exited: false, lastOk: forLastOk, lastStatus: forLastStatus, suppressErrexit: true };
          }
          if (res.continued && res.continued > 1) {
            return {
              exited: false,
              continued: res.continued - 1,
              lastOk: forLastOk,
              lastStatus: forLastStatus,
              noexecTriggered: res.noexecTriggered,
            };
          }
          const stepRes = evalForArith(cmd.cStyle.step, forLastStatus, false);
          if (!stepRes.valid || stepRes.unboundError) {
            return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
          }
        }
        return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
      }
      const expandStaticPathGlob = (pattern: string): string[] => {
        if (!/[*?[]/.test(pattern)) return [pattern];
        const staticPaths = [
          "/",
          "/bin",
          "/dev",
          "/dev/null",
          "/dev/zero",
          "/etc",
          "/etc/hosts",
          "/etc/passwd",
          "/lib",
          "/lib64",
          "/sbin",
          "/tmp",
          "/usr",
          "/usr/bin",
          "/usr/bin/env",
          "/usr/sbin",
          "/var",
          "/var/tmp",
        ];
        let regexSrc = "^";
        for (let gi = 0; gi < pattern.length; gi += 1) {
          const ch = pattern[gi]!;
          if (ch === "*") {
            regexSrc += "[^/]*";
          } else if (ch === "?") {
            regexSrc += "[^/]";
          } else if (ch === "[") {
            const closeIdx = pattern.indexOf("]", gi + 1);
            if (closeIdx > gi + 1) {
              let body = pattern.slice(gi + 1, closeIdx);
              if (body.startsWith("!")) body = `^${body.slice(1)}`;
              regexSrc += `[${body}]`;
              gi = closeIdx;
            } else {
              regexSrc += "\\[";
            }
          } else {
            regexSrc += ch.replace(/[.*+?^${}()|\\]/g, "\\$&");
          }
        }
        regexSrc += "$";
        try {
          const re = new RegExp(regexSrc);
          const matches = staticPaths.filter((p) => re.test(p)).sort();
          return matches.length > 0 ? matches : [pattern];
        } catch {
          return [pattern];
        }
      };
      if (cmd.implicitPositional || !cmd.hasDynamicItems) {
        let loopValues: string[];
        if (cmd.implicitPositional) {
          loopValues = [...envState.positional];
        } else {
          loopValues = [];
          for (const itemTok of cmd.items) {
            const itemExp = expandShellCommandTokens([itemTok], envState, curStatus);
            if (envState.nounset && itemExp.hadUnboundVar) {
              return { exited: true, lastOk: false, lastStatus: 1 };
            }
            for (let ii = 0; ii < itemExp.words.length; ii += 1) {
              const w = itemExp.words[ii]!;
              const isItemQuoted = itemExp.quoted[ii] ?? Boolean(itemTok.quoted);
              if (isItemQuoted) {
                loopValues.push(w);
              } else {
                const splitPieces = w.split(/[ \t\r\n]+/).filter((p) => p.length > 0);
                for (const piece of splitPieces) {
                  loopValues.push(...expandStaticPathGlob(piece));
                }
              }
            }
          }
        }
        for (const iterVal of loopValues) {
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cmd.varName)) {
            envState.vars[cmd.varName] = iterVal;
            if (envState.allexport) envState.exported.add(cmd.varName);
          }
          const res = executeShellTokens(
            cmd.body,
            envState,
            functions,
            report,
            depth + 1,
            inFunction,
            true,
            forLastStatus,
            undefined,
            cmdSuppressErrexit,
          );
          forLastOk = res.lastOk;
          forLastStatus = res.lastStatus;
          if (res.exited || res.returned) {
            return {
              exited: res.exited,
              returned: res.returned,
              lastOk: forLastOk,
              lastStatus: forLastStatus,
              noexecTriggered: res.noexecTriggered,
            };
          }
          if (res.broke) {
            if (res.broke > 1) {
              return {
                exited: false,
                broke: res.broke - 1,
                lastOk: forLastOk,
                lastStatus: forLastStatus,
                noexecTriggered: res.noexecTriggered,
              };
            }
            break;
          }
          if (res.continued && res.continued > 1) {
            return {
              exited: false,
              continued: res.continued - 1,
              lastOk: forLastOk,
              lastStatus: forLastStatus,
              noexecTriggered: res.noexecTriggered,
            };
          }
        }
      }
      return { exited: false, lastOk: forLastOk, lastStatus: forLastStatus, suppressErrexit: true };
    }
    if (cmd.kind === "if") {
      let lastCondStatus = curStatus;
      for (let bi = 0; bi < cmd.branches.length; bi += 1) {
        const b = cmd.branches[bi]!;
        const condRes = evaluateCondition(b.cond, bi === 0 ? curStatus : lastCondStatus);
        lastCondStatus = condRes.lastStatus;
        if (condRes.exited || condRes.returned || condRes.broke || condRes.continued) {
          return condRes;
        }
        if (condRes.truth === "false") continue;
        if (condRes.truth === "true") {
          const res = executeShellTokens(
            b.body,
            envState,
            functions,
            report,
            depth + 1,
            inFunction,
            inLoop,
            condRes.lastStatus,
            undefined,
            cmdSuppressErrexit,
          );
          return { ...res, suppressErrexit: true };
        }
        // Unknown condition: probe current branch & remaining else branches so exit/return traps never fall through.
        if (probeBranchExits(b.body, condRes.lastStatus)) {
          return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
        }
        for (let rbi = bi + 1; rbi < cmd.branches.length; rbi += 1) {
          if (probeBranchExits(cmd.branches[rbi]!.body, lastCondStatus)) {
            return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
          }
        }
        if (cmd.elseBody.length > 0 && probeBranchExits(cmd.elseBody, lastCondStatus)) {
          return { exited: true, lastOk: false, lastStatus: 1, suppressErrexit: true };
        }
        return {
          exited: false,
          lastOk: condRes.lastOk,
          lastStatus: condRes.lastStatus,
          suppressErrexit: true,
        };
      }
      if (cmd.elseBody.length > 0) {
        const res = executeShellTokens(
          cmd.elseBody,
          envState,
          functions,
          report,
          depth + 1,
          inFunction,
          inLoop,
          lastCondStatus,
          undefined,
          cmdSuppressErrexit,
        );
        return { ...res, suppressErrexit: true };
      }
      return { exited: false, lastOk: true, lastStatus: 0, suppressErrexit: true };
    }
    return evalSingleSimpleCmd(cmd, curStatus, cmdSuppressErrexit);
  };

  const executePipeline = (
    pipeline: ShellPipeline,
    curStatus: number,
    pipeSuppressErrexit: boolean,
  ): ExecOutcome => {
    const innerSuppressErrexit = pipeSuppressErrexit || pipeline.negated;
    if (pipeline.commands.length === 1) {
      const res = executeSingleCmd(pipeline.commands[0]!, curStatus, innerSuppressErrexit);
      if (pipeline.negated) {
        const negOk = !res.lastOk;
        return { ...res, lastOk: negOk, lastStatus: negOk ? 0 : 1, suppressErrexit: true };
      }
      return res;
    }
    let pipeStatus = curStatus;
    let lastNonZeroPipeStatus = 0;
    for (const pCmd of pipeline.commands) {
      const stageEnv = cloneShellEnvState(envState);
      const stageFns = new Map(functions);
      const stageReport = {
        launches: report.launches,
        dockerRuns: report.dockerRuns,
        bareFlagCount: report.bareFlagCount,
        unterminatedQuote: report.unterminatedQuote,
        syntaxError: report.syntaxError,
        stmtSeq: report.stmtSeq,
      };
      const stageEntry: ShellListEntry = {
        clauses: [{ op: "start", pipeline: { negated: false, commands: [pCmd] } }],
        background: false,
      };
      const stageRes = executeParsedShellLists(
        [stageEntry],
        stageEnv,
        stageFns,
        stageReport,
        depth + 1,
        inFunction,
        false,
        curStatus,
        undefined,
        innerSuppressErrexit,
      );
      report.bareFlagCount = stageReport.bareFlagCount;
      report.unterminatedQuote = stageReport.unterminatedQuote;
      report.syntaxError = stageReport.syntaxError;
      report.stmtSeq = stageReport.stmtSeq;
      pipeStatus = stageRes.lastStatus;
      if (stageRes.lastStatus !== 0) {
        lastNonZeroPipeStatus = stageRes.lastStatus;
      }
    }
    const rawPipeStatus =
      envState.pipefail && lastNonZeroPipeStatus !== 0 ? lastNonZeroPipeStatus : pipeStatus;
    const rawPipeOk = rawPipeStatus === 0;
    const finalOk = pipeline.negated ? !rawPipeOk : rawPipeOk;
    const finalStatus = pipeline.negated ? (finalOk ? 0 : 1) : rawPipeStatus;
    return {
      exited: false,
      lastOk: finalOk,
      lastStatus: finalStatus,
      suppressErrexit: pipeline.negated,
    };
  };

  for (const entry of entries) {
    if (entry.background) {
      const bgEnvState = cloneShellEnvState(envState, { errexit: false });
      executeParsedShellLists(
        [{ clauses: entry.clauses, background: false }],
        bgEnvState,
        new Map(functions),
        report,
        depth + 1,
        inFunction,
        inLoop,
        lastStatus,
      );
      lastStatus = 0;
      lastOk = true;
      continue;
    }
    for (let ci = 0; ci < entry.clauses.length; ci += 1) {
      const clause = entry.clauses[ci]!;
      if (clause.op === "&&" && !lastOk) continue;
      if (clause.op === "||" && lastOk) continue;
      const isLastClause = ci === entry.clauses.length - 1;
      const clauseSuppressErrexit = suppressErrexitScope || !isLastClause;
      const res = executePipeline(clause.pipeline, lastStatus, clauseSuppressErrexit);
      lastStatus = res.lastStatus;
      lastOk = res.lastOk;
      if (res.exited || res.returned || res.broke || res.continued) {
        return {
          exited: res.exited,
          returned: res.returned,
          broke: res.broke,
          continued: res.continued,
          lastOk,
          lastStatus,
          noexecTriggered: res.noexecTriggered,
        };
      }
      if (envState.errexit && !suppressErrexitScope && !lastOk && !res.suppressErrexit && isLastClause) {
        return { exited: true, lastOk: false, lastStatus };
      }
    }
  }

  return { exited: false, lastOk, lastStatus };
}

function analyzeWarGameShellScript(rawText: string): ShellExecutionReport {
  const { tokens, unterminatedQuote } = lexShellScript(rawText);
  const report = {
    launches: [] as ShellLaunchEntry[],
    dockerRuns: [] as ParsedDockerRunResult[],
    bareFlagCount: 0,
    unterminatedQuote,
    syntaxError: false,
    stmtSeq: 0,
  };
  const initialEnv: ShellEnvState = {
    vars: {},
    exported: new Set(),
    args0: "bash",
    positional: [],
    allexport: false,
    noexec: false,
    errexit: false,
    pipefail: false,
    nounset: false,
  };
  executeShellTokens(tokens, initialEnv, new Map(), report, 0, false);
  if (report.syntaxError) {
    report.launches.length = 0;
  }
  return report;
}

const NO_ARG_BOOL_FLAGS: ReadonlySet<string> = new Set([
  "-ep",
  "--enable-expert-parallel",
  "--no-enable-expert-parallel",
  "--enable-chunked-prefill",
  "--no-enable-chunked-prefill",
  "--enable-prefix-caching",
  "--no-enable-prefix-caching",
  "--enforce-eager",
  "--no-enforce-eager",
  "--enable-lora",
  "--no-enable-lora",
  "--enable-sleep-mode",
  "--no-enable-sleep-mode",
  "--trust-remote-code",
  "--use-sequence-parallel-moe",
  "--no-use-sequence-parallel-moe",
  "--enable-dbo",
  "--no-enable-dbo",
]);

const VALUE_TAKING_CLI_FLAGS: ReadonlySet<string> = new Set([
  "--model",
  "--served-model-name",
  "-tp",
  "--tensor-parallel-size",
  "-pp",
  "--pipeline-parallel-size",
  "-dp",
  "--data-parallel-size",
  "-dpl",
  "--data-parallel-size-local",
  "-pcp",
  "--pcp-size",
  "--prefill-context-parallel-size",
  "-dcp",
  "--dcp-size",
  "--decode-context-parallel-size",
  "--max-model-len",
  "--max-num-batched-tokens",
  "--max-num-seqs",
  "--gpu-memory-utilization",
  "--dtype",
  "-q",
  "--quantization",
  "--kv-cache-dtype",
  "--block-size",
  "--performance-mode",
  "--attention-backend",
  "--ubatch-size",
  "--distributed-executor-backend",
  "--load-format",
  "--shutdown-timeout",
  "--mamba-cache-mode",
  "--host",
  "--port",
  "--additional-config",
  "-cc",
  "--compilation-config",
  "--kv-transfer-config",
  "--speculative-config",
  "-O",
]);

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function normalizeLongCliFlagName(rawFlag: string): string {
  if (!rawFlag.startsWith("--")) return rawFlag;
  const dotIdx = rawFlag.indexOf(".");
  if (dotIdx > 0) {
    return `${rawFlag.slice(0, dotIdx).replace(/_/g, "-")}${rawFlag.slice(dotIdx)}`;
  }
  return rawFlag.replace(/_/g, "-");
}

function parseJsonWithExactInts(rawJson: string): unknown {
  const fast: unknown = JSON.parse(rawJson);
  if (!/\d{16,}/.test(rawJson)) return fast;
  let pos = 0;
  const skipWs = (): void => {
    while (pos < rawJson.length && /[ \t\n\r]/.test(rawJson[pos]!)) pos += 1;
  };
  const parseStr = (): string => {
    const start = pos;
    pos += 1;
    while (pos < rawJson.length) {
      const ch = rawJson[pos]!;
      if (ch === "\\") {
        pos += 2;
        continue;
      }
      if (ch === '"') {
        pos += 1;
        return JSON.parse(rawJson.slice(start, pos)) as string;
      }
      pos += 1;
    }
    throw new SyntaxError("Unterminated JSON string");
  };
  const parseVal = (): unknown => {
    skipWs();
    const ch = rawJson[pos];
    if (ch === '"') return parseStr();
    if (ch === "{") {
      pos += 1;
      skipWs();
      const obj = Object.create(null) as Record<string, unknown>;
      if (rawJson[pos] === "}") {
        pos += 1;
        return obj;
      }
      while (pos < rawJson.length) {
        skipWs();
        const k = parseStr();
        skipWs();
        pos += 1; // ':'
        const v = parseVal();
        if (k !== "__proto__" && k !== "constructor" && k !== "prototype") {
          obj[k] = v;
        }
        skipWs();
        if (rawJson[pos] === ",") {
          pos += 1;
          continue;
        }
        if (rawJson[pos] === "}") {
          pos += 1;
          return obj;
        }
        break;
      }
      return obj;
    }
    if (ch === "[") {
      pos += 1;
      skipWs();
      const arr: unknown[] = [];
      if (rawJson[pos] === "]") {
        pos += 1;
        return arr;
      }
      while (pos < rawJson.length) {
        arr.push(parseVal());
        skipWs();
        if (rawJson[pos] === ",") {
          pos += 1;
          continue;
        }
        if (rawJson[pos] === "]") {
          pos += 1;
          return arr;
        }
        break;
      }
      return arr;
    }
    if (rawJson.startsWith("true", pos)) {
      pos += 4;
      return true;
    }
    if (rawJson.startsWith("false", pos)) {
      pos += 5;
      return false;
    }
    if (rawJson.startsWith("null", pos)) {
      pos += 4;
      return null;
    }
    const numM = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rawJson.slice(pos));
    if (numM) {
      const lit = numM[0];
      pos += lit.length;
      if (!lit.includes(".") && !lit.includes("e") && !lit.includes("E")) {
        const bi = BigInt(lit);
        return bi >= BigInt(Number.MIN_SAFE_INTEGER) && bi <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(bi)
          : bi;
      }
      return Number(lit);
    }
    throw new SyntaxError(`Unexpected JSON token at ${pos}`);
  };
  return parseVal();
}

export function parseDottedJsonValue(rawVal: string): unknown {
  const t = rawVal.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+(?:[eE][+-]?\d+)?|[eE][+-]?\d+)$/.test(t)) {
    try {
      return JSON.parse(t);
    } catch {
      return Number(t);
    }
  }
  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]")) ||
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
  ) {
    try {
      return parseJsonWithExactInts(t);
    } catch {
      return rawVal;
    }
  }
  const toAsciiDigits = (rawDigits: string): string =>
    rawDigits.replace(/\p{Nd}/gu, (ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp >= 48 && cp <= 57) return ch;
      let start = cp;
      while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) {
        start -= 1;
      }
      return String((cp - start) % 10);
    });
  const hrMatch = /^(\p{Nd}+(?:\.\p{Nd}+)?)([kKmMgGtT])$/u.exec(t);
  if (hrMatch) {
    const numStr = toAsciiDigits(hrMatch[1]!);
    const suffix = hrMatch[2]!;
    const multMap: Record<string, number> = {
      k: 1e3,
      m: 1e6,
      g: 1e9,
      t: 1e12,
      K: 2 ** 10,
      M: 2 ** 20,
      G: 2 ** 30,
      T: 2 ** 40,
    };
    const isBinary = suffix === "K" || suffix === "M" || suffix === "G" || suffix === "T";
    if (Object.hasOwn(multMap, suffix) && (!isBinary || !numStr.includes("."))) {
      const product = Math.trunc(Number(numStr) * multMap[suffix]!);
      if (Number.isSafeInteger(product)) return product;
      if (Number.isFinite(product)) return BigInt(product);
    }
  }
  if (/^[+-]?\p{Nd}(?:_?\p{Nd})*$/u.test(t)) {
    const ascii = toAsciiDigits(t).replace(/_/g, "");
    const bi = BigInt(ascii);
    if (bi >= BigInt(Number.MIN_SAFE_INTEGER) && bi <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(bi);
    }
    return bi;
  }
  return rawVal;
}

const UNSAFE_JSON_SEGMENT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainJsonRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function sanitizeJsonValue(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(sanitizeJsonValue);
  if (isPlainJsonRecord(val)) {
    const clean = Object.create(null) as Record<string, unknown>;
    for (const [k, v] of Object.entries(val)) {
      if (UNSAFE_JSON_SEGMENT_KEYS.has(k)) continue;
      clean[k] = sanitizeJsonValue(v);
    }
    return clean;
  }
  return val;
}

function recursiveDictUpdate(target: Record<string, unknown>, update: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(update)) {
    if (UNSAFE_JSON_SEGMENT_KEYS.has(k)) continue;
    const prev = Object.hasOwn(target, k) ? target[k] : undefined;
    if (isPlainJsonRecord(v) && isPlainJsonRecord(prev)) {
      recursiveDictUpdate(prev, v);
    } else if (Array.isArray(v) && Array.isArray(prev)) {
      target[k] = [...prev, ...v.map(sanitizeJsonValue)];
    } else {
      target[k] = sanitizeJsonValue(v);
    }
  }
}

function setNestedJsonField(
  root: Record<string, unknown>,
  segments: readonly string[],
  value: unknown,
  flagPath: string,
  tag: string,
  issues: string[],
): void {
  let cur: Record<string, unknown> = root;
  for (let idx = 0; idx < segments.length - 1; idx += 1) {
    const seg = segments[idx]!;
    if (seg.length === 0 || UNSAFE_JSON_SEGMENT_KEYS.has(seg)) {
      issues.push(`${tag}参数 ${flagPath} 含非法路径段 "${seg}"`);
      return;
    }
    const next = Object.hasOwn(cur, seg) ? cur[seg] : undefined;
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[seg] = Object.create(null) as Record<string, unknown>;
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1];
  if (!leaf || UNSAFE_JSON_SEGMENT_KEYS.has(leaf)) {
    issues.push(`${tag}参数 ${flagPath} 含非法路径段 "${leaf ?? ""}"`);
    return;
  }
  const cleanVal = sanitizeJsonValue(value);
  const existing = Object.hasOwn(cur, leaf) ? cur[leaf] : undefined;
  if (isPlainJsonRecord(cleanVal) && isPlainJsonRecord(existing)) {
    recursiveDictUpdate(existing, cleanVal);
  } else if (Array.isArray(cleanVal) && Array.isArray(existing)) {
    cur[leaf] = [...existing, ...cleanVal];
  } else {
    cur[leaf] = cleanVal;
  }
}

const COMPILATION_BOOL_KEYS = new Set([
  "use_inductor_graph_partition",
  "cudagraph_copy_inputs",
  "cudagraph_specialize_lora",
  "fast_moe_cold_start",
  "compile_mm_encoder",
  "cudagraph_mm_encoder",
]);

const COMPILATION_NULLABLE_INT_KEYS = new Set([
  "max_cudagraph_capture_size",
  "encoder_cudagraph_max_vision_items_per_batch",
  "encoder_cudagraph_max_frames_per_batch",
]);

const COMPILATION_DICT_KEYS = new Set([
  "inductor_compile_config",
  "inductor_passes",
  "dynamic_shapes_config",
  "pass_config",
]);

const PASS_CONFIG_NULLABLE_BOOL_KEYS = new Set([
  "fuse_norm_quant",
  "fuse_act_quant",
  "fuse_attn_quant",
  "enable_sp",
  "fuse_gemm_comms",
  "fuse_allreduce_rms",
  "enable_qk_norm_rope_fusion",
  "fuse_rope_kvcache_cat_mla",
  "fuse_act_padding",
  "fuse_mla_dual_rms_norm",
  "fuse_rope_kvcache",
  "fuse_qk_norm_rope_kvcache",
]);

const ALLOWED_PASS_CONFIG_KEYS = new Set([
  ...PASS_CONFIG_NULLABLE_BOOL_KEYS,
  "eliminate_noops",
  "rope_kvcache_fusion_max_token_num",
  "fi_allreduce_fusion_max_size_mb",
  "sp_min_token_num",
]);

const ALLOWED_DYNAMIC_SHAPES_TYPES = new Set(["backed", "unbacked", "backed_size_oblivious"]);
const ALLOWED_DYNAMIC_SHAPES_KEYS = new Set(["type", "evaluate_guards", "assume_32_bit_indexing"]);

function isNonNegIntValue(val: unknown): boolean {
  return typeof val === "bigint" ? val >= 0n : typeof val === "number" && Number.isInteger(val) && val >= 0;
}

function isPosIntValue(val: unknown): boolean {
  return typeof val === "bigint" ? val > 0n : typeof val === "number" && Number.isInteger(val) && val > 0;
}

function isNonNegNumOrBigInt(val: unknown): boolean {
  return typeof val === "bigint" ? val >= 0n : typeof val === "number" && Number.isFinite(val) && val >= 0;
}

function isPosNumOrBigInt(val: unknown): boolean {
  return typeof val === "bigint" ? val > 0n : typeof val === "number" && Number.isFinite(val) && val > 0;
}

function formatCfgValue(val: unknown): string {
  return typeof val === "bigint" ? `${val}n` : JSON.stringify(val);
}

function validateCompilationObjectStrict(obj: Record<string, unknown>, tag: string, issues: string[]): void {
  for (const [key, val] of Object.entries(obj)) {
    if (!ALLOWED_COMPILATION_KEYS.has(key)) {
      issues.push(`${tag}JSON 配置含未知或拼错字段：--compilation-config.${key}`);
      continue;
    }
    if (COMPILATION_BOOL_KEYS.has(key) && typeof val !== "boolean") {
      issues.push(`${tag}--compilation-config.${key}=${formatCfgValue(val)} 须为布尔值`);
    } else if (key === "ir_enable_torch_wrap" && val !== null && typeof val !== "boolean") {
      issues.push(`${tag}--compilation-config.ir_enable_torch_wrap=${formatCfgValue(val)} 须为布尔值或 null`);
    } else if (key === "cudagraph_num_of_warmups" && !isNonNegIntValue(val)) {
      issues.push(`${tag}--compilation-config.cudagraph_num_of_warmups=${formatCfgValue(val)} 须为非负整数`);
    } else if (COMPILATION_NULLABLE_INT_KEYS.has(key) && val !== null && !isNonNegIntValue(val)) {
      issues.push(`${tag}--compilation-config.${key}=${formatCfgValue(val)} 须为非负整数或 null`);
    } else if (
      key === "compile_sizes" &&
      val !== null &&
      (!Array.isArray(val) || !val.every((x) => isPosIntValue(x) || x === "cudagraph_capture_sizes"))
    ) {
      issues.push(
        `${tag}--compilation-config.compile_sizes 须为正整数或 "cudagraph_capture_sizes" 组成的数组或 null`,
      );
    } else if (
      (key === "cudagraph_capture_sizes" ||
        key === "compile_ranges_endpoints" ||
        key === "encoder_cudagraph_token_budgets") &&
      val !== null &&
      (!Array.isArray(val) || !val.every((x) => isPosIntValue(x)))
    ) {
      issues.push(`${tag}--compilation-config.${key} 须为正整数数组或 null`);
    } else if (
      (key === "custom_ops" || key === "splitting_ops") &&
      !(
        (key === "splitting_ops" && val === null) ||
        (Array.isArray(val) && val.every((x) => typeof x === "string"))
      )
    ) {
      issues.push(`${tag}--compilation-config.${key} 须为字符串数组`);
    } else if (key === "compile_cache_save_format" && val !== "binary" && val !== "unpacked") {
      issues.push(`${tag}--compilation-config.compile_cache_save_format 仅允许 "binary" 或 "unpacked"`);
    } else if (
      (key === "cache_dir" || key === "backend" || key === "debug_dump_path") &&
      !(key === "debug_dump_path" && val === null) &&
      typeof val !== "string"
    ) {
      issues.push(`${tag}--compilation-config.${key} 须为字符串`);
    } else if (
      COMPILATION_DICT_KEYS.has(key) &&
      (val === null || typeof val !== "object" || Array.isArray(val))
    ) {
      issues.push(`${tag}--compilation-config.${key} 须为非空 JSON 对象（不允许传 null）`);
    } else if (key === "pass_config" && val && typeof val === "object" && !Array.isArray(val)) {
      for (const [subK, subV] of Object.entries(val as Record<string, unknown>)) {
        if (!ALLOWED_PASS_CONFIG_KEYS.has(subK)) {
          issues.push(`${tag}JSON 配置含未知或拼错字段：--compilation-config.pass_config.${subK}`);
        } else if (PASS_CONFIG_NULLABLE_BOOL_KEYS.has(subK)) {
          if (subV !== null && typeof subV !== "boolean") {
            issues.push(
              `${tag}--compilation-config.pass_config.${subK}=${formatCfgValue(subV)} 须为布尔值或 null`,
            );
          }
        } else if (subK === "eliminate_noops" && typeof subV !== "boolean") {
          issues.push(
            `${tag}--compilation-config.pass_config.eliminate_noops=${formatCfgValue(subV)} 须为布尔值`,
          );
        } else if (subK === "rope_kvcache_fusion_max_token_num" && !isNonNegIntValue(subV)) {
          issues.push(`${tag}--compilation-config.pass_config.${subK}=${formatCfgValue(subV)} 须为非负整数`);
        } else if (subK === "sp_min_token_num" && subV !== null && !isNonNegIntValue(subV)) {
          issues.push(
            `${tag}--compilation-config.pass_config.sp_min_token_num=${formatCfgValue(subV)} 须为非负整数或 null`,
          );
        } else if (
          subK === "fi_allreduce_fusion_max_size_mb" &&
          subV !== null &&
          !isNonNegNumOrBigInt(subV)
        ) {
          issues.push(
            `${tag}--compilation-config.pass_config.fi_allreduce_fusion_max_size_mb=${formatCfgValue(subV)} 须为非负数值或 null`,
          );
        }
      }
    } else if (key === "dynamic_shapes_config" && val && typeof val === "object" && !Array.isArray(val)) {
      for (const [subK, subV] of Object.entries(val as Record<string, unknown>)) {
        if (!ALLOWED_DYNAMIC_SHAPES_KEYS.has(subK)) {
          issues.push(`${tag}JSON 配置含未知或拼错字段：--compilation-config.dynamic_shapes_config.${subK}`);
        } else if (subK === "type") {
          if (typeof subV !== "string" || !ALLOWED_DYNAMIC_SHAPES_TYPES.has(subV)) {
            issues.push(
              `${tag}--compilation-config.dynamic_shapes_config.type=${formatCfgValue(subV)} 非法（仅允许 backed / unbacked / backed_size_oblivious）`,
            );
          }
        } else if (
          (subK === "evaluate_guards" || subK === "assume_32_bit_indexing") &&
          typeof subV !== "boolean"
        ) {
          issues.push(
            `${tag}--compilation-config.dynamic_shapes_config.${subK}=${formatCfgValue(subV)} 须为布尔值`,
          );
        }
      }
    }
  }
  if (
    Object.hasOwn(obj, "custom_ops") &&
    Array.isArray(obj.custom_ops) &&
    obj.custom_ops.every((x) => typeof x === "string")
  ) {
    const ops = obj.custom_ops as string[];
    const invalidOp = ops.find((op) => op !== "all" && op !== "none" && !/^[+-].+/.test(op));
    if (invalidOp !== undefined) {
      issues.push(
        `${tag}--compilation-config.custom_ops 含非法项 ${JSON.stringify(invalidOp)}（仅允许 "all" / "none" / "+op" / "-op"）`,
      );
    }
    const baseModes = ops.filter((op) => op === "all" || op === "none");
    if (baseModes.length > 1) {
      issues.push(`${tag}--compilation-config.custom_ops 最多允许一个基础模式（"all" 或 "none"）`);
    }
    const enabledOps = new Set(ops.filter((op) => op.startsWith("+")).map((op) => op.slice(1)));
    const disabledOps = new Set(ops.filter((op) => op.startsWith("-")).map((op) => op.slice(1)));
    const conflict = [...enabledOps].find((name) => disabledOps.has(name));
    if (conflict !== undefined) {
      issues.push(`${tag}--compilation-config.custom_ops 同时启用和禁用了算子 ${JSON.stringify(conflict)}`);
    }
  }
  if (Object.hasOwn(obj, "cudagraph_mode")) {
    const rawCg = obj.cudagraph_mode;
    if (
      typeof rawCg !== "string" ||
      rawCg !== rawCg.trim() ||
      !VALID_CUDAGRAPH_MODES.has(rawCg.toUpperCase())
    ) {
      issues.push(
        `${tag}--compilation-config.cudagraph_mode="${String(rawCg)}" 非法（仅允许 NONE / PIECEWISE / FULL / FULL_DECODE_ONLY / FULL_AND_PIECEWISE）`,
      );
    }
  }
  if (Object.hasOwn(obj, "mode")) {
    const rawMode = obj.mode;
    const validIntMode =
      (typeof rawMode === "bigint" && rawMode >= 0n && rawMode <= 3n) ||
      (typeof rawMode === "number" && Number.isInteger(rawMode) && rawMode >= 0 && rawMode <= 3);
    const validStrMode =
      typeof rawMode === "string" &&
      rawMode === rawMode.trim() &&
      VALID_COMPILATION_MODES.has(rawMode.toUpperCase());
    if (!validIntMode && !validStrMode) {
      issues.push(
        `${tag}--compilation-config.mode=${formatCfgValue(rawMode)} 非法（vllm@ced6857a CompilationMode 仅允许 0 / 1 / 2 / 3 或 NONE / STOCK_TORCH_COMPILE / DYNAMO_TRACE_ONCE / VLLM_COMPILE）`,
      );
    } else {
      const isVllmCompileMode =
        rawMode === 3 ||
        rawMode === 3n ||
        (typeof rawMode === "string" && rawMode.trim().toUpperCase() === "VLLM_COMPILE");
      if (isVllmCompileMode && Object.hasOwn(obj, "backend") && typeof obj.backend === "string") {
        if (obj.backend !== "" && obj.backend !== "eager" && obj.backend !== "inductor") {
          issues.push(
            `${tag}--compilation-config.mode=VLLM_COMPILE 时 backend=${JSON.stringify(obj.backend)} 非法（仅允许 "" / "eager" / "inductor"）`,
          );
        }
      }
    }
  }
}

function validateKvTransferObjectStrict(
  obj: Record<string, unknown>,
  tag: string,
  issues: string[],
  requireConnectorRolePair = false,
): void {
  for (const [key, val] of Object.entries(obj)) {
    if (!ALLOWED_KV_TRANSFER_KEYS.has(key)) {
      issues.push(`${tag}JSON 配置含未知或拼错字段：--kv-transfer-config.${key}`);
      continue;
    }
    if (key === "kv_rank" && val !== null && !isNonNegIntValue(val)) {
      issues.push(`${tag}--kv-transfer-config.kv_rank=${formatCfgValue(val)} 须为非负整数`);
    } else if (key === "kv_parallel_size" && !isPosIntValue(val)) {
      issues.push(`${tag}--kv-transfer-config.kv_parallel_size=${formatCfgValue(val)} 须为正整数`);
    } else if (
      key === "kv_port" &&
      (typeof val === "bigint"
        ? val < 1n || val > 65535n
        : typeof val !== "number" || !Number.isInteger(val) || val < 1 || val > 65535)
    ) {
      issues.push(`${tag}--kv-transfer-config.kv_port=${formatCfgValue(val)} 须为 1..65535 整数端口`);
    } else if (key === "kv_buffer_size" && !isPosNumOrBigInt(val)) {
      issues.push(`${tag}--kv-transfer-config.kv_buffer_size=${formatCfgValue(val)} 须为正数`);
    } else if (
      (key === "kv_ip" || key === "kv_buffer_device") &&
      (typeof val !== "string" || val.length === 0 || val !== val.trim())
    ) {
      issues.push(`${tag}--kv-transfer-config.${key}=${formatCfgValue(val)} 须为非空无首尾空白字符串`);
    } else if (key === "kv_load_failure_policy" && val !== "recompute" && val !== "fail") {
      issues.push(
        `${tag}--kv-transfer-config.kv_load_failure_policy=${formatCfgValue(val)} 仅允许 "recompute" 或 "fail"`,
      );
    } else if (
      key === "engine_id" &&
      val !== null &&
      (typeof val !== "string" || val.length === 0 || val !== val.trim())
    ) {
      issues.push(`${tag}--kv-transfer-config.engine_id=${formatCfgValue(val)} 须为非空字符串或 null`);
    } else if (key === "enable_permute_local_kv" && typeof val !== "boolean") {
      issues.push(`${tag}--kv-transfer-config.enable_permute_local_kv=${formatCfgValue(val)} 须为布尔值`);
    } else if (
      key === "kv_connector_extra_config" &&
      (val === null || typeof val !== "object" || Array.isArray(val))
    ) {
      issues.push(`${tag}--kv-transfer-config.kv_connector_extra_config 须为 JSON 对象`);
    }
  }
  const rawConn = obj.kv_connector;
  const rawModPath = obj.kv_connector_module_path;
  const hasExplicitModuleStr =
    typeof rawModPath === "string" && rawModPath === rawModPath.trim() && rawModPath.length > 0;
  if (Object.hasOwn(obj, "kv_connector")) {
    const validClassId = typeof rawConn === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawConn);
    if (rawConn !== null && (!validClassId || (!hasExplicitModuleStr && !VALID_KV_CONNECTORS.has(rawConn)))) {
      issues.push(`${tag}未知或非法的 kv_connector="${String(rawConn)}"`);
    }
  }
  if (Object.hasOwn(obj, "kv_role")) {
    const rawRole = obj.kv_role;
    if (rawRole !== null && (typeof rawRole !== "string" || !VALID_KV_ROLES.has(rawRole))) {
      issues.push(
        `${tag}非法的 kv_role="${String(rawRole)}"（仅允许 kv_producer / kv_consumer / kv_both 或 null）`,
      );
    }
  }
  if (requireConnectorRolePair && typeof rawConn === "string" && typeof obj.kv_role !== "string") {
    issues.push(`${tag}--kv-transfer-config 指定了 kv_connector="${rawConn}" 但缺少有效的非空 kv_role`);
  }
  if (Object.hasOwn(obj, "kv_connector_module_path")) {
    if (rawModPath !== null) {
      const allowedSet = typeof rawConn === "string" ? VALID_CONNECTOR_MODULE_PATHS.get(rawConn) : undefined;
      const validModuleStr = hasExplicitModuleStr && allowedSet !== undefined && allowedSet.has(rawModPath);
      if (!validModuleStr) {
        issues.push(
          `${tag}--kv-transfer-config.kv_connector_module_path=${formatCfgValue(rawModPath)} 非法或与目标 connector 模块不匹配（注：MooncakeConnectorV1 已由 vllm_ascend 注册表映射至 MooncakeConnector，显式传入非 null module_path 会按类名 MooncakeConnectorV1 导入失败）`,
        );
      }
    }
  }
}

function validateAdditionalObjectStrict(
  obj: Record<string, unknown>,
  targetVersion: UpgradeTargetVersion,
  tag: string,
  issues: string[],
): void {
  const validTop = VALID_TOP_LEVEL_KEYS_BY_TARGET[targetVersion];
  const validSched = VALID_SCHEDULER_KEYS_BY_TARGET[targetVersion];
  for (const [k, v] of Object.entries(obj)) {
    if (!validTop.has(k)) {
      issues.push(`${tag}JSON 配置含未知或拼错字段：--additional-config.${k}`);
    } else if (k === "ascend_compilation_config" && v && typeof v === "object" && !Array.isArray(v)) {
      for (const subK of Object.keys(v)) {
        if (!VALID_ASCEND_COMPILATION_KEYS.has(subK)) {
          issues.push(
            `${tag}JSON 配置含未知或拼错字段：--additional-config.ascend_compilation_config.${subK}`,
          );
        }
      }
    } else if (k === "ascend_fusion_config" && v && typeof v === "object" && !Array.isArray(v)) {
      for (const subK of Object.keys(v)) {
        if (!VALID_ASCEND_FUSION_KEYS.has(subK)) {
          issues.push(`${tag}JSON 配置含未知或拼错字段：--additional-config.ascend_fusion_config.${subK}`);
        }
      }
    } else if (k === "scheduler_config" && v && typeof v === "object" && !Array.isArray(v)) {
      for (const subK of Object.keys(v)) {
        if (!validSched.has(subK)) {
          issues.push(`${tag}JSON 配置含未知或拼错字段：--additional-config.scheduler_config.${subK}`);
        }
      }
    }
  }
}

function expandJsonHumanReadableNumbers(rawJson: string): string {
  // Mirror vllm/engine/arg_utils.py _expand_json_human_readable_numbers:
  // leave string literals verbatim and expand bare <num>[kKmMgGtT] numbers outside quotes.
  return rawJson.replace(
    /("(?:\\.|[^"\\])*")|((?<![\p{Nd}\w.])\p{Nd}+(?:\.\p{Nd}+)?[kKmMgGtT](?![\p{Nd}\w]))/gu,
    (full, quotedStr: string | undefined, bareHr: string | undefined) => {
      if (quotedStr !== undefined) return quotedStr;
      if (bareHr !== undefined) {
        const expanded = parseDottedJsonValue(bareHr);
        if (typeof expanded === "bigint") {
          return String(expanded);
        }
        if (typeof expanded === "number" && Number.isFinite(expanded)) {
          return String(expanded);
        }
      }
      return full;
    },
  );
}

function parseJsonObjectStrict(
  rawVal: string,
  flag: string,
  tag: string,
  issues: string[],
  expandHumanNumbers = false,
): Record<string, unknown> | null {
  try {
    const jsonSource = expandHumanNumbers ? expandJsonHumanReadableNumbers(rawVal) : rawVal;
    const parsed: unknown = parseJsonWithExactInts(jsonSource);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      issues.push(
        `${tag}参数 ${flag} 须为 JSON 对象（当前为 ${Array.isArray(parsed) ? "数组" : typeof parsed}）`,
      );
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    issues.push(`${tag}参数 ${flag} 的 JSON 语法非法`);
    return null;
  }
}

function cloneJsonValue(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(cloneJsonValue);
  if (val && typeof val === "object") {
    const out = Object.create(null) as Record<string, unknown>;
    for (const [k, v] of Object.entries(val)) {
      out[k] = cloneJsonValue(v);
    }
    return out;
  }
  return val;
}

function cloneJsonRecord(obj: Record<string, unknown>): Record<string, unknown> {
  return cloneJsonValue(obj) as Record<string, unknown>;
}

interface CanonicalizedSubmissionSide {
  readonly canonicalCommandText: string;
  readonly precheckIssues: readonly string[];
  readonly shellReport: ShellExecutionReport;
  readonly exactCompilationConfig: Record<string, unknown> | null;
  readonly exactKvTransferConfig: Record<string, unknown> | null;
}

function inspectAndCanonicalizeSubmission(
  rawText: string,
  targetVersion: UpgradeTargetVersion,
  prefix = "",
): CanonicalizedSubmissionSide {
  const tag = prefix ? `${prefix}：` : "";
  const shellReport = analyzeWarGameShellScript(rawText);
  const precheckIssues: string[] = [];

  if (rawText.trim().length === 0) {
    precheckIssues.push(`${tag}命令为空`);
    return {
      canonicalCommandText: "",
      precheckIssues,
      shellReport,
      exactCompilationConfig: null,
      exactKvTransferConfig: null,
    };
  }
  if (shellReport.unterminatedQuote) {
    precheckIssues.push(`${tag}脚本存在未闭合的引号`);
  }
  if (shellReport.syntaxError) {
    precheckIssues.push(`${tag}脚本存在未闭合的括号、花括号或控制流语句（syntax error）`);
  }
  for (const dr of shellReport.dockerRuns) {
    if (!dr.hasImage) {
      precheckIssues.push(`${tag}docker run 缺少有效容器镜像（IMAGE）参数`);
    }
    if (dr.unknownFlags.length > 0) {
      precheckIssues.push(`${tag}docker run 含未知或非法参数（${dr.unknownFlags.join(", ")}）`);
    }
    if (dr.hasMissingFlagValue) {
      precheckIssues.push(`${tag}docker run 存在缺少取值的参数`);
    }
  }
  if (shellReport.launches.length === 0) {
    precheckIssues.push(
      `${tag}必须包含完整的 vllm serve <model> 启动命令（禁止仅提交残缺参数片段、注释或 heredoc 非执行文本）`,
    );
    return {
      canonicalCommandText: "",
      precheckIssues,
      shellReport,
      exactCompilationConfig: null,
      exactKvTransferConfig: null,
    };
  }
  if (shellReport.launches.length > 1) {
    precheckIssues.push(`${tag}检测到多条 vllm serve 启动命令（严禁夹带诱饵或重复启动命令）`);
    return {
      canonicalCommandText: "",
      precheckIssues,
      shellReport,
      exactCompilationConfig: null,
      exactKvTransferConfig: null,
    };
  }
  if (shellReport.bareFlagCount > 0) {
    precheckIssues.push(`${tag}检测到孤立的残缺参数行，请汇总到唯一完整的 vllm serve 启动命令中`);
  }

  const launch = shellReport.launches[0]!;
  const args = launch.args;
  const positionalModels: string[] = [];
  const flagModels: string[] = [];
  let firstPositionalArgIdx = -1;
  let hasServedModelName = false;
  const rawTokensWithoutModelOrCc: string[] = [];
  let optimizationLevelConfig: Record<string, unknown> | null = null;
  let lastWholeCompilationConfig: Record<string, unknown> | null = null;
  const dottedCompilationGroups = new Map<
    string,
    Array<{
      readonly segs: readonly string[];
      readonly rawVal: string;
      readonly isListAppend: boolean;
      readonly flagPath: string;
    }>
  >();
  let lastWholeKvTransferConfig: Record<string, unknown> | null = null;
  const dottedKvTransferPatches: Array<{
    readonly segs: readonly string[];
    readonly rawVal: string;
    readonly isListAppend: boolean;
    readonly flagPath: string;
  }> = [];
  let mergedAdditionalConfig: Record<string, unknown> | null = null;
  let additionalTouched = false;
  let endOfFlags = false;

  const applyDottedPatches = (
    patches: ReadonlyArray<{
      readonly segs: readonly string[];
      readonly rawVal: string;
      readonly isListAppend: boolean;
      readonly flagPath: string;
    }>,
  ): Record<string, unknown> => {
    const out = Object.create(null) as Record<string, unknown>;
    for (const patch of patches) {
      if (patch.isListAppend) {
        setNestedJsonField(out, patch.segs, patch.rawVal.split(","), patch.flagPath, tag, precheckIssues);
      } else {
        setNestedJsonField(
          out,
          patch.segs,
          parseDottedJsonValue(patch.rawVal),
          patch.flagPath,
          tag,
          precheckIssues,
        );
      }
    }
    return out;
  };

  const buildEffectiveCompilationConfig = (): Record<string, unknown> | null => {
    // Upstream FlexibleArgumentParser groups dotted options by literal prefix (-cc vs --compilation-config),
    // converting each group to a separate --compilation-config JSON argument; invalid earlier groups still fail.
    let userConfig: Record<string, unknown> | null = null;
    if (dottedCompilationGroups.size > 0) {
      let lastGroupConfig: Record<string, unknown> | null = null;
      for (const patches of dottedCompilationGroups.values()) {
        const groupObj = applyDottedPatches(patches);
        validateCompilationObjectStrict(groupObj, tag, precheckIssues);
        lastGroupConfig = groupObj;
      }
      userConfig = lastGroupConfig;
    } else if (lastWholeCompilationConfig !== null) {
      userConfig = cloneJsonRecord(lastWholeCompilationConfig);
    }
    if (optimizationLevelConfig === null) {
      return userConfig;
    }
    if (userConfig === null) {
      return cloneJsonRecord(optimizationLevelConfig);
    }
    return { ...cloneJsonRecord(optimizationLevelConfig), ...userConfig };
  };

  const buildEffectiveKvTransferConfig = (): Record<string, unknown> | null => {
    if (dottedKvTransferPatches.length > 0) {
      return applyDottedPatches(dottedKvTransferPatches);
    }
    return lastWholeKvTransferConfig ? cloneJsonRecord(lastWholeKvTransferConfig) : null;
  };

  const readArgVal = (
    flagLabel: string,
    inlineVal: string | undefined,
    idx: number,
    allowSingleDashVal = false,
  ): [string | undefined, number] => {
    if (inlineVal !== undefined) return [inlineVal, idx];
    const next = args[idx + 1];
    const isKnownShortFlag =
      next !== undefined &&
      (NO_ARG_BOOL_FLAGS.has(next) ||
        VALUE_TAKING_CLI_FLAGS.has(next) ||
        /^-O\d*$/.test(next) ||
        next.startsWith("-cc."));
    const isMissing =
      next === undefined ||
      next === "--" ||
      next.startsWith("--") ||
      (allowSingleDashVal ? isKnownShortFlag : next.startsWith("-") && !/^-\d/.test(next));
    if (isMissing) {
      precheckIssues.push(`${tag}参数 ${flagLabel} 缺少取值`);
      return [undefined, idx];
    }
    return [next, idx + 1];
  };

  for (let i = 0; i < args.length; i += 1) {
    const tok = args[i] ?? "";
    if (!endOfFlags && tok === "--") {
      endOfFlags = true;
      continue;
    }
    if (endOfFlags || !tok.startsWith("-")) {
      if (tok.trim().length === 0 || tok !== tok.trim()) {
        precheckIssues.push(`${tag}位置模型参数 "${tok}" 为空或包含首尾空白字符`);
      }
      if (firstPositionalArgIdx === -1) firstPositionalArgIdx = i;
      positionalModels.push(tok);
      if (launch.kind === "vllm-serve" && positionalModels.length > 1) {
        precheckIssues.push(
          `${tag}检测到多余位置参数 ${JSON.stringify(tok)}（上游 vllm serve 仅允许单个 <model> 位置参数，且无参布尔开关后不可跟 true/false）`,
        );
      }
      continue;
    }

    const eqIdx = tok.indexOf("=");
    const rawFlag = eqIdx > 0 ? tok.slice(0, eqIdx) : tok;
    const inlineVal = eqIdx > 0 ? tok.slice(eqIdx + 1) : undefined;
    const normFlag = normalizeLongCliFlagName(rawFlag);

    if (NO_ARG_BOOL_FLAGS.has(normFlag)) {
      if (inlineVal !== undefined) {
        precheckIssues.push(
          `${tag}无参布尔开关 ${rawFlag} 不允许通过 "=" 传值（upstream argparse 拒绝 ${tok}）`,
        );
      }
      rawTokensWithoutModelOrCc.push(normFlag === "-ep" ? "--enable-expert-parallel" : normFlag);
      continue;
    }

    if (normFlag === "--model") {
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        if (val !== val.trim()) {
          precheckIssues.push(`${tag}--model="${val}" 包含首尾空白字符`);
        }
        flagModels.push(val);
      }
      continue;
    }

    if (normFlag === "--served-model-name") {
      hasServedModelName = true;
      const servedNames: string[] = [];
      if (inlineVal !== undefined) {
        servedNames.push(inlineVal);
      } else {
        while (i + 1 < args.length && !args[i + 1]!.startsWith("-")) {
          i += 1;
          servedNames.push(args[i]!);
        }
      }
      if (servedNames.length === 0) {
        precheckIssues.push(`${tag}参数 ${rawFlag} 缺少取值`);
      } else {
        for (const sn of servedNames) {
          if (sn.trim().length === 0 || sn !== sn.trim()) {
            precheckIssues.push(`${tag}--served-model-name="${sn}" 为空或包含首尾空白字符`);
          }
        }
        rawTokensWithoutModelOrCc.push("--served-model-name", servedNames[0]!);
      }
      continue;
    }

    if (normFlag === "-O" || normFlag === "--optimization-level" || /^-O\d+$/.test(rawFlag)) {
      if (/^-O\d+$/.test(rawFlag) && inlineVal !== undefined) {
        precheckIssues.push(`${tag}参数 ${tok} 非法（上游 -O<n> 写法不允许通过 "=" 传值）`);
        continue;
      }
      let optRaw: string | undefined;
      if (/^-O\d+$/.test(rawFlag)) {
        optRaw = rawFlag.slice(2);
      } else {
        const [val, ni] = readArgVal(rawFlag, inlineVal, i);
        i = ni;
        optRaw = val;
      }
      if (optRaw !== undefined) {
        const trimmedOpt = optRaw.trim();
        if (!/^[0-3]$/.test(trimmedOpt) || optRaw !== trimmedOpt) {
          precheckIssues.push(
            `${tag}参数 ${rawFlag}=${JSON.stringify(optRaw)} 非法（上游 -O / --optimization-level 仅接受整数 0..3，不接受 JSON）`,
          );
        } else {
          const lvl = Number.parseInt(trimmedOpt, 10);
          optimizationLevelConfig =
            lvl === 0
              ? { mode: 0, cudagraph_mode: "NONE" }
              : lvl === 1
                ? { mode: 3, cudagraph_mode: "PIECEWISE" }
                : { mode: 3, cudagraph_mode: "FULL_AND_PIECEWISE" };
        }
      }
      continue;
    }

    if (normFlag === "-cc" || normFlag === "--compilation-config") {
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        const obj = parseJsonObjectStrict(val, rawFlag, tag, precheckIssues, true);
        if (obj) {
          validateCompilationObjectStrict(obj, tag, precheckIssues);
          lastWholeCompilationConfig = cloneJsonRecord(obj);
        }
      }
      continue;
    }

    if (normFlag.startsWith("-cc.") || normFlag.startsWith("--compilation-config.")) {
      const prefixLen = normFlag.startsWith("-cc.") ? "-cc.".length : "--compilation-config.".length;
      const normPrefix = normFlag.slice(0, normFlag.indexOf("."));
      const dottedPath = normFlag.slice(prefixLen);
      const isListAppend = dottedPath.endsWith("+");
      const cleanPath = isListAppend ? dottedPath.slice(0, -1) : dottedPath;
      const [val, ni] = readArgVal(rawFlag, inlineVal, i, true);
      i = ni;
      if (val !== undefined && cleanPath.length > 0) {
        const segs = cleanPath.split(".");
        let groupPatches = dottedCompilationGroups.get(normPrefix);
        if (!groupPatches) {
          groupPatches = [];
          dottedCompilationGroups.set(normPrefix, groupPatches);
        }
        groupPatches.push({ segs, rawVal: val, isListAppend, flagPath: rawFlag });
      }
      continue;
    }

    if (normFlag === "--additional-config") {
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        const obj = parseJsonObjectStrict(val, rawFlag, tag, precheckIssues);
        if (obj) {
          validateAdditionalObjectStrict(obj, targetVersion, tag, precheckIssues);
          mergedAdditionalConfig = cloneJsonRecord(obj);
        }
        rawTokensWithoutModelOrCc.push(normFlag, val);
      }
      continue;
    }

    if (normFlag.startsWith("--additional-config.")) {
      additionalTouched = true;
      const dottedPath = normFlag.slice("--additional-config.".length);
      const isListAppend = dottedPath.endsWith("+");
      const cleanPath = isListAppend ? dottedPath.slice(0, -1) : dottedPath;
      const [val, ni] = readArgVal(rawFlag, inlineVal, i, true);
      i = ni;
      if (val !== undefined && cleanPath.length > 0) {
        const segs = cleanPath.split(".");
        mergedAdditionalConfig = mergedAdditionalConfig
          ? cloneJsonRecord(mergedAdditionalConfig)
          : (Object.create(null) as Record<string, unknown>);
        setNestedJsonField(
          mergedAdditionalConfig,
          segs,
          isListAppend ? val.split(",") : parseDottedJsonValue(val),
          rawFlag,
          tag,
          precheckIssues,
        );
        validateAdditionalObjectStrict(mergedAdditionalConfig, targetVersion, tag, precheckIssues);
        rawTokensWithoutModelOrCc.push(normFlag, val);
      }
      continue;
    }

    if (normFlag === "--kv-transfer-config") {
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        const obj = parseJsonObjectStrict(val, rawFlag, tag, precheckIssues, true);
        if (obj) {
          validateKvTransferObjectStrict(obj, tag, precheckIssues, true);
          lastWholeKvTransferConfig = cloneJsonRecord(obj);
        }
      }
      continue;
    }

    if (normFlag.startsWith("--kv-transfer-config.")) {
      const dottedPath = normFlag.slice("--kv-transfer-config.".length);
      const isListAppend = dottedPath.endsWith("+");
      const cleanPath = isListAppend ? dottedPath.slice(0, -1) : dottedPath;
      const [val, ni] = readArgVal(rawFlag, inlineVal, i, true);
      i = ni;
      if (val !== undefined && cleanPath.length > 0) {
        const segs = cleanPath.split(".");
        dottedKvTransferPatches.push({ segs, rawVal: val, isListAppend, flagPath: rawFlag });
      }
      continue;
    }

    if (
      normFlag === "--dtype" ||
      normFlag === "-q" ||
      normFlag === "--quantization" ||
      normFlag === "--kv-cache-dtype" ||
      normFlag === "--load-format" ||
      normFlag === "--distributed-executor-backend"
    ) {
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        if (val !== val.trim()) {
          precheckIssues.push(`${tag}参数 ${rawFlag}="${val}" 不允许包含首尾空白字符`);
        }
        rawTokensWithoutModelOrCc.push(normFlag, val);
      }
      continue;
    }

    if (
      normFlag === "-pcp" ||
      normFlag === "-dcp" ||
      normFlag === "-dpl" ||
      VALUE_TAKING_CLI_FLAGS.has(normFlag)
    ) {
      const mappedFlag =
        normFlag === "-pcp"
          ? "--prefill-context-parallel-size"
          : normFlag === "-dcp"
            ? "--decode-context-parallel-size"
            : normFlag === "-dpl"
              ? "--data-parallel-size-local"
              : normFlag;
      const [val, ni] = readArgVal(rawFlag, inlineVal, i);
      i = ni;
      if (val !== undefined) {
        rawTokensWithoutModelOrCc.push(mappedFlag, val);
      }
      continue;
    }

    // Preserve unknown flag token(s) so cliParser reports exact unknownFlags diagnostics
    if (inlineVal !== undefined) {
      rawTokensWithoutModelOrCc.push(`${normFlag}=${inlineVal}`);
    } else {
      rawTokensWithoutModelOrCc.push(normFlag);
    }
  }

  let effectiveModel: string | undefined;
  if (launch.kind === "python-api") {
    if (positionalModels.length > 0) {
      precheckIssues.push(
        `${tag}python -m vllm.entrypoints.openai.api_server 不接受位置模型参数 ${JSON.stringify(positionalModels[0])}，须使用 --model`,
      );
    }
    effectiveModel = flagModels.length > 0 ? flagModels[flagModels.length - 1] : undefined;
  } else {
    if (positionalModels.length > 0 && flagModels.length > 0) {
      precheckIssues.push(
        `${tag}vllm serve 不允许同时传入位置模型 "${positionalModels[0]}" 与 --model "${flagModels[0]}"（上游 cli/serve.py 将拒绝冲突入口）`,
      );
    }
    if (
      flagModels.length === 0 &&
      hasServedModelName &&
      positionalModels.length > 0 &&
      firstPositionalArgIdx > 0
    ) {
      precheckIssues.push(
        `${tag}指定 --served-model-name 时，位置模型参数 "${positionalModels[0]}" 必须位于 vllm serve 后的首个参数位置`,
      );
    }
    effectiveModel = positionalModels[0] ?? flagModels[0];
  }
  if (!effectiveModel) {
    precheckIssues.push(`${tag}未检测到包含目标 <model> 的有效 vllm serve 命令`);
  }

  const mergedCompilationConfig = buildEffectiveCompilationConfig();
  if (mergedCompilationConfig !== null) {
    validateCompilationObjectStrict(mergedCompilationConfig, tag, precheckIssues);
  }
  const mergedKvTransferConfig = buildEffectiveKvTransferConfig();
  if (mergedKvTransferConfig !== null) {
    validateKvTransferObjectStrict(mergedKvTransferConfig, tag, precheckIssues, true);
  }

  const finalArgs: string[] = [];
  if (effectiveModel) {
    if (launch.kind === "python-api") {
      finalArgs.push("--model", effectiveModel);
    } else {
      finalArgs.push(effectiveModel);
    }
  }
  const serializeJsonWithBigInt = (val: unknown): string => {
    if (val === null) return "null";
    if (typeof val === "bigint") return val.toString();
    if (typeof val === "number" || typeof val === "boolean" || typeof val === "string") {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) return `[${val.map(serializeJsonWithBigInt).join(",")}]`;
    if (typeof val === "object") {
      const entries = Object.entries(val as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${JSON.stringify(k)}:${serializeJsonWithBigInt(v)}`);
      return `{${entries.join(",")}}`;
    }
    return "null";
  };

  finalArgs.push(...rawTokensWithoutModelOrCc);
  if (mergedCompilationConfig !== null) {
    finalArgs.push("--compilation-config", serializeJsonWithBigInt(mergedCompilationConfig));
  }
  if (mergedKvTransferConfig !== null) {
    finalArgs.push("--kv-transfer-config", serializeJsonWithBigInt(mergedKvTransferConfig));
  }
  void additionalTouched;

  const envLines = Object.entries(launch.envVars).map(([k, v]) => `export ${k}=${shellSingleQuote(v)}`);
  const head = launch.kind === "python-api" ? "python -m vllm.entrypoints.openai.api_server" : "vllm serve";
  const canonicalCommandText = [...envLines, `${head} ${finalArgs.map(shellSingleQuote).join(" ")}`].join(
    "\n",
  );
  return {
    canonicalCommandText,
    precheckIssues: Array.from(new Set(precheckIssues)),
    shellReport,
    exactCompilationConfig: mergedCompilationConfig,
    exactKvTransferConfig: mergedKvTransferConfig,
  };
}

function isAssignedA3ZeroPair(parsed: ParsedVllmServeCommand): boolean {
  const vis = parsed.visibleDevices;
  return (
    Object.hasOwn(parsed.envVars, "ASCEND_RT_VISIBLE_DEVICES") &&
    vis !== null &&
    vis.length === 2 &&
    ((vis[0] === 0 && vis[1] === 1) || (vis[0] === 1 && vis[1] === 0))
  );
}

function auditSingleCommandSyntax(
  parsed: ParsedVllmServeCommand,
  targetVersion: UpgradeTargetVersion,
  precheckIssues: readonly string[],
  prefix = "",
): string[] {
  const issues: string[] = [...precheckIssues];
  const tag = prefix ? `${prefix}：` : "";
  if (parsed.rawText.trim().length === 0 && issues.length === 0) {
    issues.push(`${tag}命令为空`);
    return issues;
  }
  if ((parsed.normalizedCommandLine.trim().length === 0 || parsed.model === null) && issues.length === 0) {
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
  if (parsed.rawDtype !== undefined && !VALID_CLI_DTYPES.has(parsed.rawDtype.toLowerCase())) {
    issues.push(
      `${tag}非法的 --dtype="${parsed.rawDtype}"（仅允许 auto / bfloat16 / float16 / half / float32）`,
    );
  }
  if (
    parsed.rawKvCacheDtype !== undefined &&
    !VALID_CLI_KV_CACHE_DTYPES.has(parsed.rawKvCacheDtype.toLowerCase())
  ) {
    issues.push(`${tag}非法的 --kv-cache-dtype="${parsed.rawKvCacheDtype}"`);
  }
  if (
    parsed.rawQuantization !== undefined &&
    !VALID_CLI_QUANT_METHODS.has(parsed.rawQuantization.toLowerCase())
  ) {
    issues.push(`${tag}非法的 --quantization="${parsed.rawQuantization}"`);
  }
  if (parsed.compilationConfig) {
    validateCompilationObjectStrict(parsed.compilationConfig, tag, issues);
  }
  if (parsed.kvTransferConfig) {
    validateKvTransferObjectStrict(parsed.kvTransferConfig, tag, issues);
  }
  const badJsonKeys = collectUnknownJsonKeys(parsed, targetVersion);
  if (badJsonKeys.length > 0) {
    issues.push(`${tag}JSON 配置含未知或拼错字段：${badJsonKeys.join(", ")}`);
  }
  return [...new Set(issues)];
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
        ? parsed.kvTransferConfig.kv_connector
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
  if (parsed.model !== keep.targetModelCanonical) {
    issues.push(
      `${tag}模型路径须精确保持 ${keep.targetModelCanonical}（当前为 ${parsed.model ?? "未指定"}）`,
    );
  }
  if (keep.requireAscendQuantFlag && parsed.rawQuantization !== "ascend") {
    issues.push(`${tag}必须显式传入 --quantization ascend（严禁省略后仅靠权重路径名推断）`);
  }
  if (parsed.dataParallelSizeLocal !== undefined && parsed.dataParallelSizeLocal !== keep.dpSize) {
    issues.push(
      `${tag}--data-parallel-size-local=${parsed.dataParallelSizeLocal} 与本关 DP=${keep.dpSize} 冲突`,
    );
  }
  if (parsed.loadFormat !== null && !["auto", "safetensors"].includes(parsed.loadFormat.toLowerCase())) {
    issues.push(`${tag}禁止使用 --load-format=${parsed.loadFormat}（本关严禁 dummy 加载逃课）`);
  }
  const checkMaxSeqs = parsed.couplingInput.maxNumSeqs ?? 128;
  const checkMaxBatched = parsed.couplingInput.maxNumBatchedTokens ?? 2048;
  if (checkMaxBatched < checkMaxSeqs) {
    issues.push(
      `${tag}--max-num-batched-tokens=${checkMaxBatched} 小于 --max-num-seqs=${checkMaxSeqs}（vLLM Scheduler 校验会直接抛 ValueError）`,
    );
  }
  if (scenario.id === "a3-pd-mc2-buffsize-ifname-trap") {
    const maxSeqs = parsed.couplingInput.maxNumSeqs ?? 0;
    if (maxSeqs < 128) {
      issues.push(`${tag}--max-num-seqs=${parsed.couplingInput.maxNumSeqs ?? "未指定"} 低于本关底线 128`);
    }
    const maxBatched = parsed.couplingInput.maxNumBatchedTokens ?? 0;
    if (maxBatched < 2048) {
      issues.push(
        `${tag}--max-num-batched-tokens=${parsed.couplingInput.maxNumBatchedTokens ?? "未指定"} 低于本关底线 2048`,
      );
    }
    if (!isAssignedA3ZeroPair(parsed)) {
      issues.push(
        `${tag}须通过 ASCEND_RT_VISIBLE_DEVICES 导出本机已分配的 1 张双 Die 卡 0,1（禁止缺省、单卡或越界/跨卡设备号）`,
      );
    }
  }
  return issues;
}

function validateMooncakeExtraConfig(
  kvCfg: Record<string, unknown> | null,
  sideLabel: string,
  parsedP: ParsedVllmServeCommand,
  parsedD: ParsedVllmServeCommand | null,
): string | null {
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
  const expDTp = parsedD?.couplingInput.tpSize ?? 1;
  const expDDp = parsedD?.couplingInput.dpSize ?? 1;
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
}

function isValidHcclIfname(raw: string | undefined, nic: string): boolean {
  if (raw === undefined || raw.length === 0 || raw !== raw.trim()) return false;
  let rest = raw;
  let exclude = false;
  let exact = false;
  if (rest.startsWith("^")) {
    exclude = true;
    rest = rest.slice(1);
  }
  if (rest.startsWith("=")) {
    exact = true;
    rest = rest.slice(1);
  }
  if (rest.length === 0 || rest.startsWith("^") || rest.startsWith("=")) return false;
  const parts = rest.split(",");
  const allWellFormed = parts.every(
    (part) => part.length > 0 && !/\s/.test(part) && !part.includes("^") && !part.includes("="),
  );
  if (!allWellFormed) return false;
  const matchesTarget = (part: string, target: string): boolean =>
    exact ? target === part : target.startsWith(part);
  if (exclude) {
    return !parts.some((part) => matchesTarget(part, nic));
  }
  const firstNicIdx = parts.findIndex((part) => matchesTarget(part, nic));
  if (firstNicIdx === -1) return false;
  if (nic !== "eth9") {
    const firstBrokenIdx = parts.findIndex((part) => matchesTarget(part, "eth9"));
    if (firstBrokenIdx !== -1 && firstBrokenIdx <= firstNicIdx) return false;
  }
  return true;
}

function isValidGlooIfname(raw: string | undefined, nic: string): boolean {
  if (raw === undefined || raw.length === 0 || raw !== raw.trim()) return false;
  return raw.split(",").every((p) => p === nic);
}

function auditCase08NodeSide(params: {
  sideLabel: string;
  parsed: ParsedVllmServeCommand | null;
  parsedP: ParsedVllmServeCommand;
  parsedD: ParsedVllmServeCommand | null;
  doctorSide: SingleConfigDoctorReport | undefined;
  expectedIp: string;
  expectedRole: "kv_producer" | "kv_consumer";
}): string[] {
  const { sideLabel, parsed, parsedP, parsedD, doctorSide, expectedIp, expectedRole } = params;
  if (!parsed || parsed.model === null) {
    return [`${sideLabel}未解析出有效的 vllm serve 命令`];
  }
  const issues: string[] = [];
  const actualIp = parsed.envVars.HCCL_IF_IP;
  if (actualIp !== expectedIp) {
    issues.push(
      `${sideLabel} HCCL_IF_IP=${actualIp ?? "未设"}（须精确绑定本机地址 ${expectedIp}，禁止含首尾空格）`,
    );
  }
  const glooIf = parsed.envVars.GLOO_SOCKET_IFNAME;
  if (!isValidGlooIfname(glooIf, "enp65s0f0")) {
    issues.push(
      `${sideLabel} GLOO_SOCKET_IFNAME=${glooIf ?? "未设"}（须设为 enp65s0f0 或逗号列表，禁止含首尾空格）`,
    );
  }
  const hcclIf = parsed.envVars.HCCL_SOCKET_IFNAME;
  if (!isValidHcclIfname(hcclIf, "enp65s0f0")) {
    issues.push(
      `${sideLabel} HCCL_SOCKET_IFNAME=${hcclIf ?? "未设"}（须为有效前缀匹配 enp65s0f0 或 =enp65s0f0，严禁 eth9、空格或缺省）`,
    );
  }
  const buffRaw = parsed.envVars.HCCL_BUFFSIZE;
  const buffOk =
    buffRaw !== undefined &&
    buffRaw === buffRaw.trim() &&
    /^\d+$/.test(buffRaw) &&
    Number.parseInt(buffRaw, 10) === 128;
  if (!buffOk) {
    const typoHint = Object.hasOwn(parsed.envVars, "HCCL_BUFFERSIZE")
      ? "（检测到错拼变量 HCCL_BUFFERSIZE）"
      : "";
    issues.push(`${sideLabel} HCCL_BUFFSIZE=${buffRaw ?? "未设"}${typoHint}（须按本关预算显式设为 128）`);
  }
  const timeoutHacks = ["HCCL_EXEC_TIMEOUT", "HCCL_TRANSFER_TIMEOUT"].filter((k) =>
    Object.hasOwn(parsed.envVars, k),
  );
  if (Object.hasOwn(parsed.envVars, "HCCL_CONNECT_TIMEOUT")) {
    const rawConnTimeout = (parsed.envVars.HCCL_CONNECT_TIMEOUT ?? "").trim();
    const connTimeoutVal = /^\d+$/.test(rawConnTimeout) ? Number.parseInt(rawConnTimeout, 10) : Number.NaN;
    if (!Number.isFinite(connTimeoutVal) || connTimeoutVal <= 0 || connTimeoutVal > 120) {
      timeoutHacks.push("HCCL_CONNECT_TIMEOUT");
    }
  }
  if (timeoutHacks.length > 0) {
    issues.push(`${sideLabel}禁止通过 ${timeoutHacks.join(", ")} 拉长超时掩盖故障`);
  }
  const moeMethod = doctorSide?.moeCommSelection?.method;
  const fusedReset = doctorSide?.moeCommSelection?.fusedMc2SilentlyReset === true;
  if (parsed.couplingInput.enableFusedMc2 !== 1 || moeMethod !== "FUSED_MC2" || fusedReset) {
    issues.push(
      `${sideLabel}须保留 --additional-config '{"enable_fused_mc2":1}' 且确保 MoE 分派命中 FUSED_MC2（当前 enable_fused_mc2=${String(parsed.couplingInput.enableFusedMc2 ?? "未设")}，method=${String(moeMethod ?? "无")}）`,
    );
  }
  const conn =
    typeof parsed.kvTransferConfig?.kv_connector === "string"
      ? parsed.kvTransferConfig.kv_connector
      : undefined;
  if (conn !== "MooncakeConnectorV1") {
    issues.push(`${sideLabel} kv_connector=${conn ?? "未设"}（须为 MooncakeConnectorV1）`);
  }
  const actualRole = doctorSide?.effectiveInput.kvRole;
  if (actualRole !== expectedRole) {
    issues.push(`${sideLabel} kv_role=${actualRole ?? "未设"}（须为单向角色 ${expectedRole}，严禁 kv_both）`);
  }
  if (parsed.rawKvCacheDtype !== undefined && parsed.rawKvCacheDtype !== "auto") {
    issues.push(
      `${sideLabel} --kv-cache-dtype=${parsed.rawKvCacheDtype} 与本关契约不符（须保持 auto 或省略）`,
    );
  }
  const extraErr = validateMooncakeExtraConfig(parsed.kvTransferConfig, sideLabel, parsedP, parsedD);
  if (extraErr) issues.push(extraErr);
  return issues;
}

function evaluateScenarioSpecificCheck(params: {
  scenario: WarGameScenario;
  parsedP: ParsedVllmServeCommand;
  parsedD: ParsedVllmServeCommand | null;
  shellReportP: ShellExecutionReport;
  pdDoctor: PdConfigDoctorReport | undefined;
}): WarGameCheckItem {
  const { scenario, parsedP, shellReportP, pdDoctor } = params;
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
      const a2NodeRanks = 8;
      const validAscendEnv =
        Object.hasOwn(parsedP.envVars, "ASCEND_RT_VISIBLE_DEVICES") &&
        vis !== null &&
        vis.length === 4 &&
        new Set(vis).size === 4 &&
        vis.every((d) => Number.isInteger(d) && d >= 0 && d < a2NodeRanks);
      const reasonableU = effectiveU >= 0.85 && effectiveU <= 0.92;

      const rawDocker = shellReportP.dockerRuns.length === 1 ? shellReportP.dockerRuns[0]! : null;
      const hasDockerRun = rawDocker !== null && rawDocker.hasImage === true;
      const dockerOpts = hasDockerRun ? rawDocker : null;
      const dockerImageRaw = dockerOpts?.image ?? "";
      const dockerImage = dockerImageRaw.trim();
      let hasValidContainerImage = false;
      if (
        hasDockerRun &&
        dockerImage.length > 0 &&
        dockerImage === dockerImageRaw &&
        !/\s/.test(dockerImage)
      ) {
        const atParts = dockerImage.split("@");
        if (atParts.length <= 2) {
          const beforeDigest = atParts[0]!;
          const digestValid = atParts.length === 1 || /^sha256:[0-9a-f]{64}$/.test(atParts[1]!);
          if (digestValid && beforeDigest.length > 0) {
            const lastSlash = beforeDigest.lastIndexOf("/");
            const tail = beforeDigest.slice(lastSlash + 1);
            const colonIdx = tail.indexOf(":");
            const tag = colonIdx >= 0 ? tail.slice(colonIdx + 1) : undefined;
            const a2CompatibleTag =
              tag === undefined ||
              !/^(?:310p|310i|300i|200i|a3|a5|950dt|910a|cpu|cuda|rocm)(?:[-_.]|$)|[-_.](?:310p|310i|300i|200i|a3|a5|950dt|910a|cpu|cuda|rocm)(?:[-_.]|$)/i.test(
                tag,
              );
            const tagValid =
              tag === undefined || (/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag) && a2CompatibleTag);
            const nameWithoutTag =
              colonIdx >= 0
                ? `${beforeDigest.slice(0, lastSlash + 1)}${tail.slice(0, colonIdx)}`
                : beforeDigest;
            if (tagValid && nameWithoutTag.length > 0) {
              const nameParts = nameWithoutTag.split("/");
              const hasDomain =
                nameParts.length > 1 &&
                (nameParts[0]!.includes(".") || nameParts[0]!.includes(":") || nameParts[0] === "localhost");
              const domainValid =
                !hasDomain ||
                /^(?:localhost|[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*)(?::\d{1,5})?$/.test(
                  nameParts[0]!,
                );
              const repoParts = hasDomain ? nameParts.slice(1) : nameParts;
              const repoValid =
                repoParts.length > 0 &&
                repoParts.every((seg) => /^[a-z0-9]+(?:(?:[._]|__|[-]+)[a-z0-9]+)*$/.test(seg));
              const repoLeaf = repoParts[repoParts.length - 1] ?? "";
              hasValidContainerImage =
                domainValid &&
                repoValid &&
                /^(?:vllm-ascend|ascend-vllm|cann-vllm|mindie)(?:[-_][a-z0-9._-]+)*$/.test(repoLeaf);
            }
          }
        }
      }
      const hasCleanDockerFlags =
        dockerOpts !== null && dockerOpts.unknownFlags.length === 0 && !dockerOpts.hasMissingFlagValue;
      const hasValidContainerCommand = dockerOpts !== null && dockerOpts.launchesInsideContainer === 1;
      const hasIpcHost = dockerOpts?.lastIpc === "host";
      const hasIpcNone = dockerOpts?.lastIpc === "none";
      const lastShmRaw = dockerOpts?.lastShmSize;
      const shmGiB = lastShmRaw !== undefined ? parseDockerGiB(lastShmRaw) : null;
      const shmFixed =
        hasValidContainerImage &&
        hasCleanDockerFlags &&
        hasValidContainerCommand &&
        !hasIpcNone &&
        (hasIpcHost || (shmGiB !== null && shmGiB !== "unlimited" && shmGiB >= 16));

      const hasMemFlag = dockerOpts?.hasMemoryFlag === true;
      const lastMemRaw = dockerOpts?.lastMemory;
      const lastMemGiB = lastMemRaw !== undefined ? parseDockerGiB(lastMemRaw) : null;
      const memFixed =
        hasValidContainerImage &&
        hasCleanDockerFlags &&
        hasValidContainerCommand &&
        (!hasMemFlag || lastMemGiB === "unlimited" || (lastMemGiB !== null && lastMemGiB >= 128));

      const resolveAscendRuntimeDevices = (raw: string | undefined, maxRanks: number): Set<number> | null => {
        if (!raw) return null;
        const t = raw.trim();
        if (!t || /^(?:void|none)$/i.test(t)) return null;
        const out = new Set<number>();
        for (const part of t.split(",")) {
          const seg = part.trim();
          if (!seg) return null;
          if (seg.toLowerCase() === "all") {
            for (let r = 0; r < maxRanks; r += 1) out.add(r);
            continue;
          }
          const rangeM = /^(\d+)-(\d+)$/.exec(seg);
          if (rangeM) {
            const a = Number(rangeM[1]);
            const b = Number(rangeM[2]);
            if (!Number.isInteger(a) || !Number.isInteger(b) || a > b || b >= maxRanks) return null;
            for (let r = a; r <= b; r += 1) out.add(r);
            continue;
          }
          if (/^\d+$/.test(seg)) {
            const d = Number(seg);
            if (!Number.isInteger(d) || d >= maxRanks) return null;
            out.add(d);
            continue;
          }
          return null;
        }
        return out;
      };

      const hasRuntimeAscend = dockerOpts?.runtime?.toLowerCase() === "ascend";
      const runtimeVisibleSet = hasRuntimeAscend
        ? resolveAscendRuntimeDevices(dockerOpts?.dockerEnv.ASCEND_VISIBLE_DEVICES, a2NodeRanks)
        : null;
      const runtimeOpts = (dockerOpts?.dockerEnv.ASCEND_RUNTIME_OPTIONS ?? "")
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const runtimeProvidesDevices =
        hasRuntimeAscend &&
        runtimeVisibleSet !== null &&
        validAscendEnv &&
        vis !== null &&
        vis.every((d) => runtimeVisibleSet.has(d));
      const runtimeProvidesDriver = runtimeProvidesDevices && !runtimeOpts.includes("NODRV");
      const devSet = new Set(dockerOpts?.devices ?? []);
      const deviceMappings = dockerOpts?.deviceMappings ?? [];
      const allHostNpusInRange = deviceMappings.every((m) => {
        const hostM = /^\/dev\/davinci(0|[1-9]\d*)$/.exec(m.host);
        if (!hostM)
          return (
            !m.host.startsWith("/dev/davinci") ||
            m.host === "/dev/davinci_manager" ||
            m.host === "/dev/davinci_manager_docker"
          );
        const hostIdx = Number(hostM[1]);
        return Number.isInteger(hostIdx) && hostIdx >= 0 && hostIdx < a2NodeRanks;
      });
      const distinctHostNpusForVis = new Set<string>();
      let eachVisHasHost = true;
      if (vis !== null) {
        for (const d of vis) {
          const targetDev = `/dev/davinci${d}`;
          const hostsForTarget = deviceMappings.filter((m) => m.container === targetDev).map((m) => m.host);
          if (hostsForTarget.length === 0) {
            eachVisHasHost = false;
            break;
          }
          for (const h of hostsForTarget) distinctHostNpusForVis.add(h);
        }
      }
      const hasUniqueValidDavinciMappings =
        allHostNpusInRange && eachVisHasHost && vis !== null && distinctHostNpusForVis.size === vis.length;

      const isValidHostDirSource = (hostSrc: string): boolean => {
        if (!hostSrc.startsWith("/") || hostSrc === "/dev" || hostSrc.startsWith("/dev/")) return false;
        if (
          hostSrc === "/etc" ||
          hostSrc.startsWith("/etc/") ||
          hostSrc === "/proc" ||
          hostSrc.startsWith("/proc/") ||
          hostSrc === "/sys" ||
          hostSrc.startsWith("/sys/") ||
          hostSrc === "/bin" ||
          hostSrc.startsWith("/bin/") ||
          hostSrc === "/sbin" ||
          hostSrc.startsWith("/sbin/") ||
          hostSrc === "/lib" ||
          hostSrc.startsWith("/lib/") ||
          hostSrc === "/lib64" ||
          hostSrc.startsWith("/lib64/") ||
          hostSrc === "/usr" ||
          hostSrc === "/usr/bin" ||
          hostSrc.startsWith("/usr/bin/") ||
          hostSrc === "/usr/sbin" ||
          hostSrc.startsWith("/usr/sbin/") ||
          hostSrc === "/usr/lib" ||
          hostSrc.startsWith("/usr/lib/") ||
          hostSrc === "/usr/lib64" ||
          hostSrc.startsWith("/usr/lib64/") ||
          hostSrc === "/usr/share" ||
          hostSrc.startsWith("/usr/share/") ||
          hostSrc === "/boot" ||
          hostSrc.startsWith("/boot/") ||
          hostSrc.startsWith("/var/log/")
        ) {
          return false;
        }
        const base = hostSrc.slice(hostSrc.lastIndexOf("/") + 1).toLowerCase();
        if (
          base === "hosts" ||
          base === "passwd" ||
          base === "shadow" ||
          base === "group" ||
          base === "fstab" ||
          base === "os-release" ||
          base === "resolv.conf" ||
          base === "ascend_install.info" ||
          base === "version.info" ||
          /\.(?:info|conf|cfg|ini|json|ya?ml|toml|txt|md|log|sh|py|so(?:\.\d+)*|a|o|ko|bin|pt|pth|safetensors|onnx|lock|pid|sock)$/i.test(
            base,
          )
        ) {
          return false;
        }
        return true;
      };
      const allMountEntries = dockerOpts?.volumeMountEntries ?? [];
      const resolveLongestCoveringMount = (
        targetPath: string,
      ): { readonly hostSrc: string; readonly target: string } | null => {
        let best: { readonly hostSrc: string; readonly target: string } | null = null;
        for (const entry of allMountEntries) {
          const covers =
            entry.target === "/" || targetPath === entry.target || targetPath.startsWith(`${entry.target}/`);
          if (covers && (!best || entry.target.length > best.target.length)) {
            best = entry;
          }
        }
        return best;
      };
      const missingDevices =
        !runtimeProvidesDevices && validAscendEnv && vis !== null
          ? [
              ...vis.filter((d) => !devSet.has(`/dev/davinci${d}`)).map((d) => `/dev/davinci${d}`),
              ...(["/dev/davinci_manager", "/dev/devmm_svm", "/dev/hisi_hdc"] as const).filter(
                (ctrl) => !devSet.has(ctrl),
              ),
            ]
          : [];
      const hasRequiredDevices =
        validAscendEnv &&
        vis !== null &&
        allHostNpusInRange &&
        (runtimeProvidesDevices || (missingDevices.length === 0 && hasUniqueValidDavinciMappings));
      const driverMountEntry = resolveLongestCoveringMount("/usr/local/Ascend/driver/lib64");
      const hasDriverMount =
        runtimeProvidesDriver ||
        (driverMountEntry !== null &&
          (driverMountEntry.target === "/usr/local/Ascend/driver" ||
            driverMountEntry.target === "/usr/local/Ascend/driver/lib64" ||
            driverMountEntry.target === "/usr/local/Ascend") &&
          isValidHostDirSource(driverMountEntry.hostSrc) &&
          !driverMountEntry.hostSrc.startsWith("/models"));
      const ckptMountEntry =
        parsedP.model !== null && parsedP.model.startsWith("/")
          ? resolveLongestCoveringMount(parsedP.model)
          : null;
      const hasCheckpointMount =
        ckptMountEntry !== null &&
        isValidHostDirSource(ckptMountEntry.hostSrc) &&
        ckptMountEntry.hostSrc !== "/usr/local/Ascend" &&
        !ckptMountEntry.hostSrc.startsWith("/usr/local/Ascend/");
      const devicesAndMountsOk =
        hasValidContainerImage &&
        hasCleanDockerFlags &&
        hasValidContainerCommand &&
        hasRequiredDevices &&
        hasDriverMount &&
        hasCheckpointMount;

      const ok = noCudaEnv && validAscendEnv && reasonableU && shmFixed && memFixed && devicesAndMountsOk;
      return {
        id: "scenario-specific-fix",
        label:
          "专项修复：扩容容器 --shm-size>=16g / 内存限制，保留 NPU 设备/驱动/模型挂载并改用 ASCEND_RT_VISIBLE_DEVICES",
        passed: ok,
        detail: ok
          ? `已修复容器共享内存/DRAM 限制，保留 NPU 设备与驱动/权重挂载，并设置 ASCEND_RT_VISIBLE_DEVICES=${parsedP.envVars.ASCEND_RT_VISIBLE_DEVICES}（u=${effectiveU.toFixed(2)}）。`
          : [
              shellReportP.dockerRuns.length === 0
                ? "请保留并修复第一行可执行的 docker run 容器启动命令（勿用 echo / heredoc 或直接删掉容器层）"
                : shellReportP.dockerRuns.length > 1
                  ? "检测到多条 docker run 启动命令（严禁夹带诱饵容器参数）"
                  : !shellReportP.dockerRuns[0]!.hasImage
                    ? "docker run 缺少容器镜像（IMAGE）参数，容器层未完整闭合"
                    : !hasValidContainerImage
                      ? `docker run 镜像 "${dockerImage}" 并非与本关服务匹配的 Ascend NPU 容器镜像`
                      : !hasCleanDockerFlags
                        ? `docker run 含未知或缺少取值的参数（${dockerOpts?.unknownFlags.join(", ") || "缺值"}）`
                        : !hasValidContainerCommand
                          ? "vllm serve 必须作为容器内主命令启动，且不可用 --entrypoint=/bin/true 覆盖或放到宿主机侧容器外运行"
                          : "",
              hasValidContainerImage && hasCleanDockerFlags && hasValidContainerCommand && !shmFixed
                ? `容器共享内存不足（最终生效 --ipc=${dockerOpts?.lastIpc ?? "未设"}、--shm-size=${lastShmRaw ?? "未设"}，须设 --shm-size>=16g 或 --ipc=host 且必须在 IMAGE 参数前）`
                : "",
              hasValidContainerImage && hasCleanDockerFlags && hasValidContainerCommand && !memFixed
                ? `容器 cgroup 内存硬限过低或格式非法（当前最终生效 --memory=${lastMemRaw ?? "参数未正确闭合"}，4 进程加载 30B 分片须设 >=128g 或移除 32g 硬限）`
                : "",
              hasValidContainerImage &&
              hasCleanDockerFlags &&
              hasValidContainerCommand &&
              validAscendEnv &&
              !hasRequiredDevices
                ? `容器缺少与 ASCEND_RT_VISIBLE_DEVICES 匹配的 NPU 设备映射（缺少 ${missingDevices.join(", ")}）`
                : "",
              hasValidContainerImage && hasCleanDockerFlags && hasValidContainerCommand && !hasDriverMount
                ? "容器缺少宿主机 Ascend 驱动挂载（需挂载 /usr/local/Ascend/driver/lib64/ 或 /usr/local/Ascend/driver，或使用 --runtime=ascend）"
                : "",
              hasValidContainerImage && hasCleanDockerFlags && hasValidContainerCommand && !hasCheckpointMount
                ? `容器缺少本地权重目录挂载（需通过 -v /models:/models 或 --mount 覆盖 ${parsedP.model ?? "/models/..."}）`
                : "",
              !noCudaEnv ? "仍残留无效的 CUDA_VISIBLE_DEVICES" : "",
              !validAscendEnv
                ? `须显式导出属于单台 8 卡 A2（0..${a2NodeRanks - 1}）且不重复的 4 张卡号 ASCEND_RT_VISIBLE_DEVICES（如 0,1,2,3）`
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
          ? parsedP.kvTransferConfig.kv_connector
          : undefined;
      const dConn =
        typeof params.parsedD?.kvTransferConfig?.kv_connector === "string"
          ? params.parsedD.kvTransferConfig.kv_connector
          : undefined;
      const pExtraErr = validateMooncakeExtraConfig(
        parsedP.kvTransferConfig,
        "Prefill 端",
        parsedP,
        params.parsedD,
      );
      const dExtraErr = validateMooncakeExtraConfig(
        params.parsedD?.kvTransferConfig ?? null,
        "Decode 端",
        parsedP,
        params.parsedD,
      );
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
    case "a3-dual-die-static-kernel-trap": {
      const vis = parsedP.visibleDevices;
      const hasTwoDevices =
        Object.hasOwn(parsedP.envVars, "ASCEND_RT_VISIBLE_DEVICES") &&
        vis !== null &&
        vis.length === 2 &&
        new Set(vis).size === 2;
      const inA3NodeRange =
        hasTwoDevices && vis !== null && vis.every((d) => Number.isInteger(d) && d >= 0 && d < 16);
      const sameDualDieCard =
        inA3NodeRange && vis !== null && Math.floor(vis[0]! / 2) === Math.floor(vis[1]! / 2);
      // In v0.30.0 (c09d3e20), AscendCompilationConfig.enable_npugraph_ex defaults to True when omitted.
      const npugraphExOn = parsedP.couplingInput.enableNpugraphEx !== false;
      const staticKernelOn = parsedP.couplingInput.enableStaticKernel === true;
      const graphPreservesNpugraphEx =
        !parsedP.enforceEager && (cgMode === "FULL_DECODE_ONLY" || cgMode === "FULL");
      const uSafe = effectiveU >= 0.85 && effectiveU <= 0.9;
      const ok = sameDualDieCard && npugraphExOn && staticKernelOn && graphPreservesNpugraphEx && uSafe;
      return {
        id: "scenario-specific-fix",
        label:
          "专项修复：A3 本机 0..15 同卡成对双 Die + 启用 static_kernel(保持 npugraph_ex 开启) + FULL_DECODE_ONLY/FULL + u(0.85~0.90)",
        passed: ok,
        detail: ok
          ? `已绑定同卡成对双 Die (${parsedP.envVars.ASCEND_RT_VISIBLE_DEVICES})，保持 npugraph_ex 开启并生效 static_kernel，切换 cudagraph_mode=${cgMode}（u=${effectiveU.toFixed(2)}）。`
          : [
              !hasTwoDevices
                ? "须通过 ASCEND_RT_VISIBLE_DEVICES 显式导出 2 个不重复逻辑设备号（如 0,1）"
                : !inA3NodeRange
                  ? `当前 ASCEND_RT_VISIBLE_DEVICES=${parsedP.envVars.ASCEND_RT_VISIBLE_DEVICES} 超出单台 Atlas 800I A3 的 0..15 逻辑设备范围`
                  : !sameDualDieCard
                    ? `当前 ASCEND_RT_VISIBLE_DEVICES=${parsedP.envVars.ASCEND_RT_VISIBLE_DEVICES} 跨了两张不同物理卡（A3 双裸片须满足 npu0 // 2 == npu1 // 2，如 0,1 或 2,3）`
                    : "",
              !staticKernelOn
                ? "严禁删掉 enable_static_kernel=true 逃课（本关要求真正生效 Static Kernel）"
                : "",
              !npugraphExOn
                ? "禁止将 enable_npugraph_ex 设为 false（请移除 false 以继承 v0.30.0 默认 True，或显式设为 true）"
                : "",
              !graphPreservesNpugraphEx
                ? `当前 cudagraph_mode=${cgMode} 会触发 _setup_compile_backend 将 npugraph_ex 与 static_kernel 静默重置为 False（须改为 FULL_DECODE_ONLY 或 FULL）`
                : "",
              !uSafe ? `当前 u=${effectiveU.toFixed(2)}（须控制在 0.85 ~ 0.90 留足整图捕获余量）` : "",
            ]
              .filter(Boolean)
              .join("；"),
      };
    }
    case "a3-pd-mc2-buffsize-ifname-trap": {
      const pIssues = auditCase08NodeSide({
        sideLabel: "Prefill 端",
        parsed: parsedP,
        parsedP,
        parsedD: params.parsedD,
        doctorSide: pdDoctor?.prefill,
        expectedIp: "192.0.2.11",
        expectedRole: "kv_producer",
      });
      const dIssues = auditCase08NodeSide({
        sideLabel: "Decode 端",
        parsed: params.parsedD,
        parsedP,
        parsedD: params.parsedD,
        doctorSide: pdDoctor?.decode,
        expectedIp: "192.0.2.12",
        expectedRole: "kv_consumer",
      });
      const pdClean = Boolean(pdDoctor && pdDoctor.errors.length === 0);
      const allIssues = [
        ...(!pdClean ? [`PD 联检仍存在 ${pdDoctor?.errors.length ?? 0} 项阻断错误`] : []),
        ...pIssues,
        ...dIssues,
      ];
      const ok = allIssues.length === 0;
      return {
        id: "scenario-specific-fix",
        label:
          "专项修复：P/D 本机 HCCL_IF_IP + enp65s0f0 双层网卡 + HCCL_BUFFSIZE=128 + enable_fused_mc2=1 + Mooncake 单角色与拓扑",
        passed: ok,
        detail: ok
          ? "已对齐 P(192.0.2.11, kv_producer)/D(192.0.2.12, kv_consumer) 本机 IP、enp65s0f0 双层网卡、HCCL_BUFFSIZE=128、FUSED_MC2 与 Mooncake extra_config。"
          : allIssues.join("；"),
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

  // ② CLI 非空、Shell 可执行语句（heredoc/exit/包装器/Docker边界）、合法语法与零 unknownFlags 校验
  const targetVer: UpgradeTargetVersion = scenario.version === "main" ? "main" : "v0.30.0";
  const canonP = inspectAndCanonicalizeSubmission(
    submission.commandText,
    targetVer,
    isPd ? "Prefill 端" : "",
  );
  const canonD = isPd
    ? inspectAndCanonicalizeSubmission(submission.decodeCommandText ?? "", targetVer, "Decode 端")
    : null;

  const rawParsedP = parseVllmServeCommand(canonP.canonicalCommandText, { version: scenario.version });
  const parsedP: ParsedVllmServeCommand =
    canonP.exactCompilationConfig !== null || canonP.exactKvTransferConfig !== null
      ? {
          ...rawParsedP,
          compilationConfig: canonP.exactCompilationConfig ?? rawParsedP.compilationConfig,
          kvTransferConfig: canonP.exactKvTransferConfig ?? rawParsedP.kvTransferConfig,
        }
      : rawParsedP;
  const rawParsedD = isPd
    ? parseVllmServeCommand(canonD?.canonicalCommandText ?? "", { version: scenario.version })
    : null;
  const parsedD: ParsedVllmServeCommand | null =
    rawParsedD && canonD && (canonD.exactCompilationConfig !== null || canonD.exactKvTransferConfig !== null)
      ? {
          ...rawParsedD,
          compilationConfig: canonD.exactCompilationConfig ?? rawParsedD.compilationConfig,
          kvTransferConfig: canonD.exactKvTransferConfig ?? rawParsedD.kvTransferConfig,
        }
      : rawParsedD;
  const isCase08 = scenario.id === "a3-pd-mc2-buffsize-ifname-trap";
  const syntaxIssues = [
    ...auditSingleCommandSyntax(parsedP, targetVer, canonP.precheckIssues, isPd ? "Prefill 端" : ""),
    ...(parsedD && canonD
      ? auditSingleCommandSyntax(parsedD, targetVer, canonD.precheckIssues, "Decode 端")
      : []),
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
    ? runSingleConfigDoctor(canonP.canonicalCommandText, {
        mode: "full",
        hardwareFamily: scenario.hardwareFamily,
        version: scenario.version,
      })
    : undefined;
  const pdDoctor = isPd
    ? runPdConfigDoctor(canonP.canonicalCommandText, canonD?.canonicalCommandText ?? "", {
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
  const effectiveUP = parsedP.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION;
  const effectiveUD = parsedD
    ? (parsedD.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION)
    : effectiveUP;
  const forbidEager = scenario.hardwareFamily !== "310P";
  const basicGraphGuardOk = forbidEager
    ? !parsedP.enforceEager &&
      cgModeP !== "NONE" &&
      (!parsedD || (!parsedD.enforceEager && cgModeD !== "NONE"))
    : true;
  const case08GraphAndUOk =
    !isCase08 ||
    ((cgModeP === "FULL_DECODE_ONLY" || cgModeP === "FULL") &&
      (cgModeD === "FULL_DECODE_ONLY" || cgModeD === "FULL") &&
      effectiveUP >= 0.85 &&
      effectiveUP <= 0.9 &&
      effectiveUD >= 0.85 &&
      effectiveUD <= 0.9);
  const graphGuardOk = basicGraphGuardOk && case08GraphAndUOk;
  const memAndGraphOk = syntaxOk && topoOk && oomStatus === "ok" && graphGuardOk;
  const memAndGraphCheck: WarGameCheckItem = {
    id: "memory-and-graph-guard",
    label: "7 级显存算账 oomStatus=ok 且未暴力关图逃课",
    passed: memAndGraphOk,
    detail: memAndGraphOk
      ? `evaluateDeployPlan 核算通过（oomStatus=ok，1−u 录图余量 safe${forbidEager ? `，图模式=${cgModeP}` : ""}）。`
      : [
          !basicGraphGuardOk
            ? "检测到通过 --enforce-eager、cudagraph_mode=NONE 或编译关闭覆盖项关闭图模式逃课"
            : !case08GraphAndUOk
              ? `P/D 图模式须保持 FULL_DECODE_ONLY（或 FULL）且 --gpu-memory-utilization 须控制在 0.85 ~ 0.90（当前 P=${cgModeP}/u=${effectiveUP.toFixed(2)}，D=${cgModeD}/u=${effectiveUD.toFixed(2)}）`
              : "",
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
    shellReportP: canonP.shellReport,
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
