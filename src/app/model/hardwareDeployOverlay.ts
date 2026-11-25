import { type ParsedVllmServeCommand, parseVllmServeCommand } from "../../sim/doctor/cliParser";
import { runSingleConfigDoctor } from "../../sim/doctor/configDoctor";
import {
  type AscendCalcCardId,
  DEFAULT_GPU_MEMORY_UTILIZATION,
  evaluateDeployPlan,
  evaluateWave3ModelGate,
  GIB,
  type KvCacheDtype,
  type KvOomStatus,
  type WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { extractStructuralHfConfig, parseHfConfig } from "../../sim/modelspec/parseHfConfig";
import type { AscendFamily, CudaGraphMode, RuleVersion } from "../../sim/rules/types";

export const MAX_DEPLOY_OVERLAY_PARAM_CHARS = 1024;

export type DeployOverlayModelKey =
  | "qwen3-0.6b"
  | "qwen3-8b"
  | "qwen3-30b-a3b"
  | "qwen3-32b"
  | "qwen3-235b-a22b"
  | "deepseek-v3-mla"
  | "hybrid-kda-gqa"
  | "csa2-sparse-mla"
  | "engram-conditional"
  | "custom-dense"
  | "custom-moe"
  | "custom-mla"
  | "custom-kda";

export type DeployOverlayOomStatus = KvOomStatus | "headroom_overflow" | "headroom_risk";

export type Ascend3dHardwareModelId = "atlas-800t-a2" | "atlas-800i-a3" | "atlas-800-3000" | "ascend-950dt";

export interface HardwareModelMappingSpec {
  readonly cardId: AscendCalcCardId;
  readonly hardwareModel: Ascend3dHardwareModelId;
  readonly hardwareDisplayName: string;
  readonly cardShortName: string;
  readonly vendor: "ascend";
  readonly physicalSlotsPerNode: 4 | 8;
  readonly diesPerPhysicalSlot: 1 | 2;
  readonly ranksPerNode: 8 | 16;
  readonly rankHbmGiB: 24 | 32 | 64 | 128;
  readonly physicalSlotHbmGiB: 32 | 48 | 64 | 128;
  readonly partPrefix: "npu" | "card";
  readonly dieLabelPrefix: "Rank" | "Die" | "Chip";
  readonly displacedLowerSlots: readonly number[];
  readonly hasUpperCoolingManifold: boolean;
}

export const CARD_TO_3D_HARDWARE_MAP: Readonly<Record<AscendCalcCardId, HardwareModelMappingSpec>> = {
  "a2-64g": {
    cardId: "a2-64g",
    hardwareModel: "atlas-800t-a2",
    hardwareDisplayName: "Atlas 800T A2",
    cardShortName: "Atlas A2 64G",
    vendor: "ascend",
    physicalSlotsPerNode: 8,
    diesPerPhysicalSlot: 1,
    ranksPerNode: 8,
    rankHbmGiB: 64,
    physicalSlotHbmGiB: 64,
    partPrefix: "npu",
    dieLabelPrefix: "Rank",
    displacedLowerSlots: [],
    hasUpperCoolingManifold: false,
  },
  "a2-32g": {
    cardId: "a2-32g",
    hardwareModel: "atlas-800t-a2",
    hardwareDisplayName: "Atlas 800T A2 (910B4 32G 档)",
    cardShortName: "Atlas A2 32G",
    vendor: "ascend",
    physicalSlotsPerNode: 8,
    diesPerPhysicalSlot: 1,
    ranksPerNode: 8,
    rankHbmGiB: 32,
    physicalSlotHbmGiB: 32,
    partPrefix: "npu",
    dieLabelPrefix: "Rank",
    displacedLowerSlots: [],
    hasUpperCoolingManifold: false,
  },
  "a3-die64g": {
    cardId: "a3-die64g",
    hardwareModel: "atlas-800i-a3",
    hardwareDisplayName: "Atlas 800I A3",
    cardShortName: "Atlas A3 64G/Die",
    vendor: "ascend",
    physicalSlotsPerNode: 8,
    diesPerPhysicalSlot: 2,
    ranksPerNode: 16,
    rankHbmGiB: 64,
    physicalSlotHbmGiB: 128,
    partPrefix: "npu",
    dieLabelPrefix: "Die",
    displacedLowerSlots: [],
    hasUpperCoolingManifold: true,
  },
  "310p-24g": {
    cardId: "310p-24g",
    hardwareModel: "atlas-800-3000",
    hardwareDisplayName: "Atlas 800 (型号 3000 · 300I Duo)",
    cardShortName: "Atlas 310P 24G",
    vendor: "ascend",
    physicalSlotsPerNode: 4,
    diesPerPhysicalSlot: 2,
    ranksPerNode: 8,
    rankHbmGiB: 24,
    physicalSlotHbmGiB: 48,
    partPrefix: "card",
    dieLabelPrefix: "Chip",
    displacedLowerSlots: [0, 2],
    hasUpperCoolingManifold: false,
  },
  "950dt-128g": {
    cardId: "950dt-128g",
    hardwareModel: "ascend-950dt",
    hardwareDisplayName: "昇腾 950DT 架构节点",
    cardShortName: "Ascend 950DT 128G",
    vendor: "ascend",
    physicalSlotsPerNode: 8,
    diesPerPhysicalSlot: 1,
    ranksPerNode: 8,
    rankHbmGiB: 128,
    physicalSlotHbmGiB: 128,
    partPrefix: "npu",
    dieLabelPrefix: "Rank",
    displacedLowerSlots: [],
    hasUpperCoolingManifold: true,
  },
};

export const DEPLOY_MODEL_DISPLAY_NAMES: Readonly<Record<DeployOverlayModelKey, string>> = {
  "qwen3-0.6b": "Qwen3-0.6B",
  "qwen3-8b": "Qwen3-8B",
  "qwen3-30b-a3b": "Qwen3-30B-A3B",
  "qwen3-32b": "Qwen3-32B",
  "qwen3-235b-a22b": "Qwen3-235B-A22B",
  "deepseek-v3-mla": "DeepSeek-V3 MLA 样例",
  "hybrid-kda-gqa": "KDA+GQA 混合样例",
  "csa2-sparse-mla": "CSA2 稀疏注意力样例",
  "engram-conditional": "Engram 条件记忆样例",
  "custom-dense": "自定义稠密模型",
  "custom-moe": "自定义 MoE 模型",
  "custom-mla": "自定义 MLA 模型",
  "custom-kda": "自定义线性注意力模型",
};

const PRESET_MODEL_KEYS = new Set<DeployOverlayModelKey>([
  "qwen3-0.6b",
  "qwen3-8b",
  "qwen3-30b-a3b",
  "qwen3-32b",
  "qwen3-235b-a22b",
  "deepseek-v3-mla",
  "hybrid-kda-gqa",
  "csa2-sparse-mla",
  "engram-conditional",
]);

const ALLOWED_MODEL_KEYS = new Set<DeployOverlayModelKey>(
  Object.keys(DEPLOY_MODEL_DISPLAY_NAMES) as DeployOverlayModelKey[],
);

const ALLOWED_CARD_IDS = new Set<AscendCalcCardId>(
  Object.keys(CARD_TO_3D_HARDWARE_MAP) as AscendCalcCardId[],
);

const ALLOWED_OOM_STATUSES = new Set<DeployOverlayOomStatus>([
  "fits",
  "tight_budget_oom_risk",
  "insufficient_for_single_max_len_seq",
  "weights_exceed_budget",
  "weights_plus_activation_exceed_budget",
  "non_kv_exceeds_budget",
  "headroom_overflow",
  "headroom_risk",
]);

const ALLOWED_PARALLEL_SIZES = new Set<number>([1, 2, 4, 8]);
const ALLOWED_PRECISIONS = new Set<WeightPrecision>([
  "bf16",
  "fp16",
  "w8a8",
  "w8a8_dynamic",
  "w4a8",
  "fp8_block",
  "w8a8sc_310p",
]);
const ALLOWED_KV_DTYPES = new Set<KvCacheDtype>(["auto", "int8", "mxfp8"]);
const ALLOWED_CUDAGRAPH_MODES = new Set<CudaGraphMode>([
  "NONE",
  "PIECEWISE",
  "FULL_DECODE_ONLY",
  "FULL",
  "FULL_AND_PIECEWISE",
]);

export interface HardwareDeployCalculatorRoundTrip {
  readonly subMode?: "static" | "reconcile" | undefined;
  readonly weightPrecision?: WeightPrecision | undefined;
  readonly kvCacheDtype?: KvCacheDtype | undefined;
  readonly weightNzMode?: 0 | 1 | 2 | undefined;
  readonly dpLocal?: number | undefined;
  readonly pcp?: number | undefined;
  readonly dcp?: number | undefined;
  readonly maxModelLen?: number | undefined;
  readonly maxNumBatchedTokens?: number | undefined;
  readonly maxNumSeqs?: number | undefined;
  readonly cudagraphMode?: CudaGraphMode | undefined;
  readonly useV2ModelRunner?: boolean | undefined;
  readonly prefillTokens?: number | undefined;
  readonly decodeBatchSize?: number | undefined;
  readonly decodeContextLen?: number | undefined;
  readonly version?: Extract<RuleVersion, "v0.30.0" | "main"> | undefined;
}

export interface HardwareDeployOverlayPayload {
  readonly modelKey: DeployOverlayModelKey;
  readonly cardId: AscendCalcCardId;
  readonly tp: number;
  readonly pp: number;
  readonly dp: number;
  readonly ep: boolean;
  readonly totalRanks: number;
  readonly cardGiB: number;
  readonly u: number;
  readonly weightGiB: number;
  readonly kvGiB: number;
  readonly runtimeGiB: number;
  readonly oomStatus: DeployOverlayOomStatus;
  readonly headroomOverflow?: boolean | undefined;
  readonly headroomRisk?: boolean | undefined;
  readonly calc?: HardwareDeployCalculatorRoundTrip | undefined;
}

export function getHardwareModelMapping(cardId: AscendCalcCardId): HardwareModelMappingSpec {
  return CARD_TO_3D_HARDWARE_MAP[cardId];
}

function roundGiB(v: number): number {
  return Number(Math.max(0, v).toFixed(3));
}

function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64UrlUtf8(encoded: string): string | null {
  const trimmed = encoded.trim();
  if (!trimmed || trimmed.length > MAX_DEPLOY_OVERLAY_PARAM_CHARS) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed) || trimmed.length % 4 === 1) return null;
  const padLen = (4 - (trimmed.length % 4)) % 4;
  const b64 = `${trimmed.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(padLen)}`;
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (decoded.includes("\0") || !decoded.trim()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function encodeHardwareDeployOverlay(payload: HardwareDeployOverlayPayload): string {
  const c = payload.calc;
  const wire: Record<string, unknown> = {
    v: 1,
    m: payload.modelKey,
    c: payload.cardId,
    tp: payload.tp,
    pp: payload.pp,
    dp: payload.dp,
    ep: payload.ep ? 1 : 0,
    r: payload.totalRanks,
    cg: payload.cardGiB,
    u: Number(payload.u.toFixed(4)),
    w: roundGiB(payload.weightGiB),
    kv: roundGiB(payload.kvGiB),
    rt: roundGiB(payload.runtimeGiB),
    oom: payload.oomStatus,
    ...(payload.headroomOverflow ? { ho: 1 } : {}),
    ...(payload.headroomRisk ? { hr: 1 } : {}),
  };
  if (c) {
    if (c.subMode === "reconcile") wire.sm = "reconcile";
    if (c.weightPrecision) wire.pr = c.weightPrecision;
    if (c.kvCacheDtype && c.kvCacheDtype !== "auto") wire.kd = c.kvCacheDtype;
    if (c.weightNzMode !== undefined && c.weightNzMode !== 1) wire.nz = c.weightNzMode;
    if (c.dpLocal !== undefined) wire.dl = c.dpLocal;
    if (c.pcp !== undefined && c.pcp !== 1) wire.pcp = c.pcp;
    if (c.dcp !== undefined && c.dcp !== 1) wire.dcp = c.dcp;
    if (c.maxModelLen !== undefined) wire.ml = Math.trunc(c.maxModelLen);
    if (c.maxNumBatchedTokens !== undefined && c.maxNumBatchedTokens !== 2048) {
      wire.bt = Math.trunc(c.maxNumBatchedTokens);
    }
    if (c.maxNumSeqs !== undefined && c.maxNumSeqs !== 256) wire.ms = Math.trunc(c.maxNumSeqs);
    if (c.cudagraphMode && c.cudagraphMode !== "PIECEWISE") wire.cm = c.cudagraphMode;
    if (c.useV2ModelRunner !== undefined) wire.v2 = c.useV2ModelRunner ? 1 : 0;
    if (c.prefillTokens !== undefined && c.prefillTokens !== 512) wire.pf = Math.trunc(c.prefillTokens);
    if (c.decodeBatchSize !== undefined && c.decodeBatchSize !== 16) wire.db = Math.trunc(c.decodeBatchSize);
    if (c.decodeContextLen !== undefined && c.decodeContextLen !== 4096) {
      wire.dc = Math.trunc(c.decodeContextLen);
    }
    if (c.version === "main") wire.vr = "main";
  }
  return encodeBase64UrlUtf8(JSON.stringify(wire));
}

function parseBoundedInt(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max ? v : null;
}

function parseBoundedGib(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 4096 ? Number(v.toFixed(3)) : null;
}

export function parseHardwareDeployOverlay(
  raw: string | null | undefined,
): HardwareDeployOverlayPayload | null {
  if (!raw) return null;
  const decoded = decodeBase64UrlUtf8(raw);
  if (!decoded) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1) return null;

  const modelKey = typeof obj.m === "string" ? (obj.m as DeployOverlayModelKey) : null;
  if (!modelKey || !ALLOWED_MODEL_KEYS.has(modelKey)) return null;

  const cardId = typeof obj.c === "string" ? (obj.c as AscendCalcCardId) : null;
  if (!cardId || !ALLOWED_CARD_IDS.has(cardId)) return null;
  const cardSpec = CARD_TO_3D_HARDWARE_MAP[cardId];

  const tp = typeof obj.tp === "number" && ALLOWED_PARALLEL_SIZES.has(obj.tp) ? obj.tp : null;
  const pp = typeof obj.pp === "number" && ALLOWED_PARALLEL_SIZES.has(obj.pp) ? obj.pp : null;
  const dp = typeof obj.dp === "number" && ALLOWED_PARALLEL_SIZES.has(obj.dp) ? obj.dp : null;
  if (tp === null || pp === null || dp === null) return null;

  let pcp = 1;
  if (obj.pcp !== undefined) {
    if (typeof obj.pcp !== "number" || !ALLOWED_PARALLEL_SIZES.has(obj.pcp)) return null;
    pcp = obj.pcp;
  }
  let dcp = 1;
  if (obj.dcp !== undefined) {
    if (typeof obj.dcp !== "number" || !ALLOWED_PARALLEL_SIZES.has(obj.dcp)) return null;
    dcp = obj.dcp;
  }

  if (obj.ep !== 0 && obj.ep !== 1 && typeof obj.ep !== "boolean") return null;
  const ep = Boolean(obj.ep);

  const totalRanks = parseBoundedInt(obj.r, 1, 4096);
  if (totalRanks === null || totalRanks !== tp * pp * dp * pcp) return null;

  if (obj.cg !== cardSpec.rankHbmGiB) return null;

  if (typeof obj.u !== "number" || !Number.isFinite(obj.u) || obj.u < 0.1 || obj.u > 0.99) return null;
  const u = Number(obj.u.toFixed(4));

  const weightGiB = parseBoundedGib(obj.w);
  const kvGiB = parseBoundedGib(obj.kv);
  const runtimeGiB = parseBoundedGib(obj.rt);
  if (weightGiB === null || kvGiB === null || runtimeGiB === null) return null;

  const oomStatus = typeof obj.oom === "string" ? (obj.oom as DeployOverlayOomStatus) : null;
  if (!oomStatus || !ALLOWED_OOM_STATUSES.has(oomStatus)) return null;

  let headroomOverflow = false;
  if (obj.ho !== undefined) {
    if (obj.ho !== 0 && obj.ho !== 1 && typeof obj.ho !== "boolean") return null;
    headroomOverflow = Boolean(obj.ho);
  }

  let headroomRisk = oomStatus === "headroom_risk";
  if (obj.hr !== undefined) {
    if (obj.hr !== 0 && obj.hr !== 1 && typeof obj.hr !== "boolean") return null;
    headroomRisk = Boolean(obj.hr);
  }

  const calc: Record<string, unknown> = {};
  if (obj.dl !== undefined) {
    const dl = parseBoundedInt(obj.dl, 1, dp);
    if (dl === null || dp % dl !== 0 || dl * tp * pp * pcp > cardSpec.ranksPerNode) return null;
    calc.dpLocal = dl;
  }
  if (pcp !== 1) calc.pcp = pcp;
  if (dcp !== 1) calc.dcp = dcp;
  if (obj.sm !== undefined) {
    if (obj.sm !== "static" && obj.sm !== "reconcile") return null;
    calc.subMode = obj.sm;
  }
  if (obj.pr !== undefined) {
    if (typeof obj.pr !== "string" || !ALLOWED_PRECISIONS.has(obj.pr as WeightPrecision)) return null;
    calc.weightPrecision = obj.pr;
  }
  if (obj.kd !== undefined) {
    if (typeof obj.kd !== "string" || !ALLOWED_KV_DTYPES.has(obj.kd as KvCacheDtype)) return null;
    calc.kvCacheDtype = obj.kd;
  }
  if (obj.nz !== undefined) {
    if (obj.nz !== 0 && obj.nz !== 1 && obj.nz !== 2) return null;
    calc.weightNzMode = obj.nz;
  }
  if (obj.ml !== undefined) {
    const ml = parseBoundedInt(obj.ml, 64, 1_048_576);
    if (ml === null) return null;
    calc.maxModelLen = ml;
  }
  if (obj.bt !== undefined) {
    const bt = parseBoundedInt(obj.bt, 1, 1_048_576);
    if (bt === null) return null;
    calc.maxNumBatchedTokens = bt;
  }
  if (obj.ms !== undefined) {
    const ms = parseBoundedInt(obj.ms, 1, 65_536);
    if (ms === null) return null;
    calc.maxNumSeqs = ms;
  }
  if (obj.cm !== undefined) {
    if (typeof obj.cm !== "string" || !ALLOWED_CUDAGRAPH_MODES.has(obj.cm as CudaGraphMode)) return null;
    calc.cudagraphMode = obj.cm;
  }
  if (obj.v2 !== undefined) {
    if (obj.v2 !== 0 && obj.v2 !== 1 && typeof obj.v2 !== "boolean") return null;
    calc.useV2ModelRunner = Boolean(obj.v2);
  }
  if (obj.pf !== undefined) {
    const pf = parseBoundedInt(obj.pf, 1, 1_048_576);
    if (pf === null) return null;
    calc.prefillTokens = pf;
  }
  if (obj.db !== undefined) {
    const db = parseBoundedInt(obj.db, 1, 65_536);
    if (db === null) return null;
    calc.decodeBatchSize = db;
  }
  if (obj.dc !== undefined) {
    const dc = parseBoundedInt(obj.dc, 1, 1_048_576);
    if (dc === null) return null;
    calc.decodeContextLen = dc;
  }
  if (obj.vr !== undefined) {
    if (obj.vr !== "v0.30.0" && obj.vr !== "main") return null;
    calc.version = obj.vr;
  }

  return {
    modelKey,
    cardId,
    tp,
    pp,
    dp,
    ep,
    totalRanks,
    cardGiB: cardSpec.rankHbmGiB,
    u,
    weightGiB,
    kvGiB,
    runtimeGiB,
    oomStatus,
    ...(headroomOverflow ? { headroomOverflow: true } : {}),
    ...(headroomRisk ? { headroomRisk: true } : {}),
    ...(Object.keys(calc).length > 0 ? { calc: calc as HardwareDeployCalculatorRoundTrip } : {}),
  };
}

export interface HardwareRankDieSlot {
  readonly rankIndex: number;
  readonly dieIndex: 0 | 1;
  readonly active: boolean;
  readonly tpGroup: number;
  readonly ppStage: number;
  readonly dpReplica: number;
}

export interface HardwarePhysicalSlotLayout {
  readonly slotIndex: number;
  readonly partSuffix: string;
  readonly active: boolean;
  readonly displacedOutwardX: -1 | 0 | 1;
  readonly dies: readonly HardwareRankDieSlot[];
}

export interface HardwareInterconnectArc {
  readonly fromRank: number;
  readonly toRank: number;
  readonly kind: "tp" | "pp" | "ep" | "dp";
}

export interface HardwareNodeSlotLayout {
  readonly mapping: HardwareModelMappingSpec;
  readonly totalRanks: number;
  readonly ranksPerNode: number;
  readonly nodeCount: number;
  readonly isMultiNode: boolean;
  readonly localActiveRanks: number;
  readonly activePhysicalSlotCount: number;
  readonly slots: readonly HardwarePhysicalSlotLayout[];
  readonly arcs: readonly HardwareInterconnectArc[];
}

export function computeHardwareNodeSlotLayout(payload: HardwareDeployOverlayPayload): HardwareNodeSlotLayout {
  const mapping = CARD_TO_3D_HARDWARE_MAP[payload.cardId];
  const pcp = payload.calc?.pcp ?? 1;
  const ranksPerNode =
    payload.calc?.dpLocal !== undefined
      ? Math.min(mapping.ranksPerNode, payload.calc.dpLocal * payload.tp * payload.pp * pcp)
      : mapping.ranksPerNode;
  const nodeCount = Math.max(1, Math.ceil(payload.totalRanks / ranksPerNode));
  const isMultiNode = payload.totalRanks > ranksPerNode;
  const localActiveRanks = Math.min(payload.totalRanks, ranksPerNode);
  const innerGroupSize = payload.tp * pcp;
  const replicaStride = innerGroupSize * payload.pp;

  const slots: HardwarePhysicalSlotLayout[] = [];
  let activePhysicalSlotCount = 0;

  for (let slotIndex = 0; slotIndex < mapping.physicalSlotsPerNode; slotIndex += 1) {
    const dies: HardwareRankDieSlot[] = [];
    for (let d = 0; d < mapping.diesPerPhysicalSlot; d += 1) {
      const rankIndex = slotIndex * mapping.diesPerPhysicalSlot + d;
      const active = rankIndex < localActiveRanks;
      const tpGroup = Math.floor(rankIndex / payload.tp);
      const ppStage = Math.floor((rankIndex % replicaStride) / innerGroupSize);
      const dpReplica = Math.floor(rankIndex / replicaStride);
      dies.push({
        rankIndex,
        dieIndex: d === 1 ? 1 : 0,
        active,
        tpGroup,
        ppStage,
        dpReplica,
      });
    }
    const slotActive = dies.some((item) => item.active);
    if (slotActive) activePhysicalSlotCount += 1;
    const isDisplaced = mapping.displacedLowerSlots.includes(slotIndex);
    const displacedOutwardX: -1 | 0 | 1 = isDisplaced ? (slotIndex === 0 ? -1 : 1) : 0;
    slots.push({
      slotIndex,
      partSuffix: `${mapping.partPrefix}${slotIndex}`,
      active: slotActive,
      displacedOutwardX,
      dies,
    });
  }

  const arcs: HardwareInterconnectArc[] = [];
  if (payload.tp > 1) {
    for (let r = 0; r + 1 < localActiveRanks; r += 1) {
      if (Math.floor(r / payload.tp) === Math.floor((r + 1) / payload.tp)) {
        arcs.push({ fromRank: r, toRank: r + 1, kind: "tp" });
      }
    }
  }
  if (payload.pp > 1) {
    for (let r = 0; r + innerGroupSize < localActiveRanks; r += innerGroupSize) {
      if (
        r % innerGroupSize === 0 &&
        Math.floor(r / replicaStride) === Math.floor((r + innerGroupSize) / replicaStride)
      ) {
        arcs.push({ fromRank: r, toRank: r + innerGroupSize, kind: "pp" });
      }
    }
  }
  if (payload.dp > 1) {
    const dpKind = payload.ep ? "ep" : "dp";
    for (let r = 0; r + replicaStride < localActiveRanks; r += replicaStride) {
      if (r % replicaStride === 0) {
        arcs.push({ fromRank: r, toRank: r + replicaStride, kind: dpKind });
      }
    }
  }

  return {
    mapping,
    totalRanks: payload.totalRanks,
    ranksPerNode,
    nodeCount,
    isMultiNode,
    localActiveRanks,
    activePhysicalSlotCount,
    slots,
    arcs,
  };
}

const SAFE_WIKI_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;
const UNSAFE_ANCHOR_RE = /[\r\n\0/\\]/;
const MAX_CUSTOM_MODEL_SHARE_CHARS = 4096;

function hasNonFiniteJsonValue(val: unknown): boolean {
  if (typeof val === "number") return !Number.isFinite(val);
  if (Array.isArray(val)) return val.some(hasNonFiniteJsonValue);
  if (val && typeof val === "object") return Object.values(val).some(hasNonFiniteJsonValue);
  return false;
}

export function sanitizeCompactCustomModelParam(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOM_MODEL_SHARE_CHARS || !trimmed.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (hasNonFiniteJsonValue(parsed)) return null;
    const clean = extractStructuralHfConfig(parsed);
    const compact = JSON.stringify(clean);
    return compact.length <= MAX_CUSTOM_MODEL_SHARE_CHARS ? compact : null;
  } catch {
    return null;
  }
}

export function canRestoreDeployModelOnReturn(
  payload: HardwareDeployOverlayPayload,
  preserveParams?: URLSearchParams,
): boolean {
  if (PRESET_MODEL_KEYS.has(payload.modelKey)) return true;
  return sanitizeCompactCustomModelParam(preserveParams?.get("customModel")) !== null;
}

function copySafeWikiContext(target: URLSearchParams, source?: URLSearchParams): void {
  if (!source) return;
  const fromPage = source.get("fromPage")?.trim();
  if (fromPage && SAFE_WIKI_SLUG_RE.test(fromPage)) {
    target.set("fromPage", fromPage);
  }
  const fromAnchor = source.get("fromAnchor")?.trim().replace(/^#+/, "");
  if (fromAnchor && !UNSAFE_ANCHOR_RE.test(fromAnchor)) {
    target.set("fromAnchor", fromAnchor);
  }
}

export function buildHardwareDeployHref(
  payload: HardwareDeployOverlayPayload,
  preserveParams?: URLSearchParams,
  customModelCompact?: string | null,
): string {
  const mapping = CARD_TO_3D_HARDWARE_MAP[payload.cardId];
  const encoded = encodeHardwareDeployOverlay(payload);
  const next = new URLSearchParams();
  next.set("vendor", "ascend");
  next.set("model", mapping.hardwareModel);
  next.set("level", "2");
  next.set("deploy", encoded);
  if (!PRESET_MODEL_KEYS.has(payload.modelKey)) {
    const safeCustom = sanitizeCompactCustomModelParam(
      customModelCompact ?? preserveParams?.get("customModel"),
    );
    if (safeCustom) next.set("customModel", safeCustom);
  }
  copySafeWikiContext(next, preserveParams);
  return `#/hardware?${next.toString()}`;
}

export function buildCalculatorReturnToFromDeploy(
  payload: HardwareDeployOverlayPayload,
  preserveParams?: URLSearchParams,
): string {
  const next = new URLSearchParams();
  next.set("tab", "calculator");
  copySafeWikiContext(next, preserveParams);
  const c = payload.calc;
  if (c?.subMode === "reconcile") next.set("panel", "reconcile");
  if (PRESET_MODEL_KEYS.has(payload.modelKey)) {
    next.set("preset", payload.modelKey);
  } else {
    const safeCustom = sanitizeCompactCustomModelParam(preserveParams?.get("customModel"));
    if (safeCustom) next.set("customModel", safeCustom);
  }
  next.set("card", payload.cardId);
  if (c?.weightPrecision) next.set("precision", c.weightPrecision);
  if (c?.kvCacheDtype) next.set("kv", c.kvCacheDtype);
  if (c?.weightNzMode !== undefined) next.set("nz", String(c.weightNzMode));
  next.set("tp", String(payload.tp));
  next.set("pp", String(payload.pp));
  next.set("dp", String(payload.dp));
  if (c?.pcp && c.pcp !== 1) next.set("pcp", String(c.pcp));
  if (c?.dcp && c.dcp !== 1) next.set("dcp", String(c.dcp));
  next.set("ep", payload.ep ? "1" : "0");
  const fixed2 = Number(payload.u.toFixed(2));
  next.set(
    "u",
    Math.abs(payload.u - fixed2) < 1e-9 ? payload.u.toFixed(2) : String(Number(payload.u.toFixed(4))),
  );
  if (c?.maxModelLen !== undefined) next.set("maxLen", String(c.maxModelLen));
  if (c?.maxNumBatchedTokens !== undefined) next.set("batchTokens", String(c.maxNumBatchedTokens));
  if (c?.maxNumSeqs !== undefined) next.set("maxSeqs", String(c.maxNumSeqs));
  if (c?.cudagraphMode) {
    next.set("cudagraph", c.cudagraphMode);
    if (c.cudagraphMode === "NONE") next.set("eager", "1");
  }
  if (c?.useV2ModelRunner !== undefined) next.set("v2", c.useV2ModelRunner ? "1" : "0");
  if (c?.prefillTokens !== undefined) next.set("prefill", String(c.prefillTokens));
  if (c?.decodeBatchSize !== undefined) next.set("decodeBatch", String(c.decodeBatchSize));
  if (c?.decodeContextLen !== undefined) next.set("decodeCtx", String(c.decodeContextLen));
  if (c?.version) next.set("version", c.version);
  return `/tools?${next.toString()}`;
}

export interface DeployModelStructuralSpec {
  readonly modelKey: DeployOverlayModelKey;
  readonly displayName: string;
  readonly numLayers: number;
  readonly hiddenSize: number;
  readonly numHeads: number;
  readonly numKvHeads: number;
  readonly headDim: number;
  readonly isMoe: boolean;
  readonly firstKDenseLayers: number;
  readonly moeLayerMask?: readonly boolean[] | undefined;
  readonly numExperts: number;
  readonly topK: number;
  readonly numSharedExperts: number;
  readonly hasMla: boolean;
  readonly kvLoraRank?: number | undefined;
  readonly qkRopeHeadDim?: number | undefined;
  readonly hasCsa2: boolean;
  readonly hasKda: boolean;
  readonly hasEngram: boolean;
  readonly engramLayerCount?: number | undefined;
  readonly tieWordEmbeddings: boolean;
  readonly isCustomTemplate?: boolean | undefined;
}

export const DEPLOY_MODEL_STRUCTURAL_SPECS: Readonly<
  Record<DeployOverlayModelKey, DeployModelStructuralSpec>
> = {
  "qwen3-0.6b": {
    modelKey: "qwen3-0.6b",
    displayName: "Qwen3-0.6B",
    numLayers: 28,
    hiddenSize: 1024,
    numHeads: 16,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 28,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: true,
  },
  "qwen3-8b": {
    modelKey: "qwen3-8b",
    displayName: "Qwen3-8B",
    numLayers: 36,
    hiddenSize: 4096,
    numHeads: 32,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 36,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "qwen3-32b": {
    modelKey: "qwen3-32b",
    displayName: "Qwen3-32B",
    numLayers: 64,
    hiddenSize: 5120,
    numHeads: 64,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 64,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "qwen3-30b-a3b": {
    modelKey: "qwen3-30b-a3b",
    displayName: "Qwen3-30B-A3B",
    numLayers: 48,
    hiddenSize: 2048,
    numHeads: 32,
    numKvHeads: 4,
    headDim: 128,
    isMoe: true,
    firstKDenseLayers: 0,
    numExperts: 128,
    topK: 8,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "qwen3-235b-a22b": {
    modelKey: "qwen3-235b-a22b",
    displayName: "Qwen3-235B-A22B",
    numLayers: 94,
    hiddenSize: 4096,
    numHeads: 64,
    numKvHeads: 4,
    headDim: 128,
    isMoe: true,
    firstKDenseLayers: 0,
    numExperts: 128,
    topK: 8,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "deepseek-v3-mla": {
    modelKey: "deepseek-v3-mla",
    displayName: "DeepSeek-V3 MLA 样例",
    numLayers: 61,
    hiddenSize: 7168,
    numHeads: 128,
    numKvHeads: 1,
    headDim: 192,
    isMoe: true,
    firstKDenseLayers: 3,
    numExperts: 256,
    topK: 8,
    numSharedExperts: 1,
    hasMla: true,
    kvLoraRank: 512,
    qkRopeHeadDim: 64,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "hybrid-kda-gqa": {
    modelKey: "hybrid-kda-gqa",
    displayName: "KDA+GQA 混合样例",
    numLayers: 32,
    hiddenSize: 4096,
    numHeads: 32,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 32,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: true,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "csa2-sparse-mla": {
    modelKey: "csa2-sparse-mla",
    displayName: "CSA2 稀疏注意力样例",
    numLayers: 61,
    hiddenSize: 7168,
    numHeads: 128,
    numKvHeads: 1,
    headDim: 192,
    isMoe: true,
    firstKDenseLayers: 3,
    numExperts: 256,
    topK: 8,
    numSharedExperts: 1,
    hasMla: true,
    kvLoraRank: 512,
    qkRopeHeadDim: 64,
    hasCsa2: true,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
  },
  "engram-conditional": {
    modelKey: "engram-conditional",
    displayName: "Engram 条件记忆样例",
    numLayers: 36,
    hiddenSize: 4096,
    numHeads: 32,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 36,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: true,
    engramLayerCount: 2,
    tieWordEmbeddings: false,
  },
  "custom-dense": {
    modelKey: "custom-dense",
    displayName: "自定义稠密模型",
    numLayers: 32,
    hiddenSize: 4096,
    numHeads: 32,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 32,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
    isCustomTemplate: true,
  },
  "custom-moe": {
    modelKey: "custom-moe",
    displayName: "自定义 MoE 模型",
    numLayers: 48,
    hiddenSize: 2048,
    numHeads: 32,
    numKvHeads: 4,
    headDim: 128,
    isMoe: true,
    firstKDenseLayers: 0,
    numExperts: 128,
    topK: 8,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
    isCustomTemplate: true,
  },
  "custom-mla": {
    modelKey: "custom-mla",
    displayName: "自定义 MLA 模型",
    numLayers: 61,
    hiddenSize: 7168,
    numHeads: 128,
    numKvHeads: 1,
    headDim: 192,
    isMoe: true,
    firstKDenseLayers: 3,
    numExperts: 256,
    topK: 8,
    numSharedExperts: 1,
    hasMla: true,
    kvLoraRank: 512,
    qkRopeHeadDim: 64,
    hasCsa2: false,
    hasKda: false,
    hasEngram: false,
    tieWordEmbeddings: false,
    isCustomTemplate: true,
  },
  "custom-kda": {
    modelKey: "custom-kda",
    displayName: "自定义线性注意力模型",
    numLayers: 32,
    hiddenSize: 4096,
    numHeads: 32,
    numKvHeads: 8,
    headDim: 128,
    isMoe: false,
    firstKDenseLayers: 32,
    numExperts: 0,
    topK: 0,
    numSharedExperts: 0,
    hasMla: false,
    hasCsa2: false,
    hasKda: true,
    hasEngram: false,
    tieWordEmbeddings: false,
    isCustomTemplate: true,
  },
};
export function resolveDeployModelStructuralSpec(
  modelKey: DeployOverlayModelKey,
  customModelRaw?: string | null | undefined,
): DeployModelStructuralSpec {
  const base = DEPLOY_MODEL_STRUCTURAL_SPECS[modelKey];
  if (PRESET_MODEL_KEYS.has(modelKey) || !customModelRaw) return base;
  const sanitized = sanitizeCompactCustomModelParam(customModelRaw);
  if (!sanitized) return base;
  try {
    const parsedSpec = parseHfConfig(JSON.parse(sanitized));
    const firstFull =
      parsedSpec.layers.find((l) => l.attention.kind !== "linear_kda")?.attention ??
      parsedSpec.layers[0]?.attention;
    const firstMoe = parsedSpec.layers.find((l) => l.mlp.kind === "moe")?.mlp;
    const firstMoeIdx = parsedSpec.layers.findIndex((l) => l.mlp.kind === "moe");
    const moeLayerMask = parsedSpec.layers.map((l) => l.mlp.kind === "moe");
    const hasMla = parsedSpec.layers.some(
      (l) =>
        l.attention.kind === "mla" || (l.attention.kind === "dsa" && l.attention.kvLoraRank !== undefined),
    );
    const hasCsa2 = parsedSpec.layers.some((l) => l.attention.kind === "dsa");
    const hasKda = parsedSpec.layers.some((l) => l.attention.kind === "linear_kda");
    return {
      modelKey,
      displayName: DEPLOY_MODEL_DISPLAY_NAMES[modelKey],
      numLayers: parsedSpec.numLayers,
      hiddenSize: parsedSpec.hidden,
      numHeads: firstFull?.numHeads ?? base.numHeads,
      numKvHeads: firstFull?.numKvHeads ?? base.numKvHeads,
      headDim: firstFull?.headDim ?? base.headDim,
      isMoe: firstMoe?.kind === "moe",
      firstKDenseLayers: firstMoe?.kind === "moe" ? Math.max(0, firstMoeIdx) : parsedSpec.numLayers,
      moeLayerMask,
      numExperts: firstMoe?.kind === "moe" ? firstMoe.numExperts : 0,
      topK: firstMoe?.kind === "moe" ? firstMoe.topK : 0,
      numSharedExperts: firstMoe?.kind === "moe" ? firstMoe.numSharedExperts : 0,
      hasMla,
      kvLoraRank: firstFull?.kvLoraRank,
      qkRopeHeadDim: firstFull?.qkRopeHeadDim,
      hasCsa2,
      hasKda,
      hasEngram: Boolean(parsedSpec.engram?.enabled),
      engramLayerCount: parsedSpec.engram?.layerIds.length,
      tieWordEmbeddings: parsedSpec.tieWordEmbeddings,
      isCustomTemplate: false,
    };
  } catch {
    return base;
  }
}

export interface PpLayerRange {
  readonly startLayer: number;
  readonly endLayer: number;
  readonly layerCount: number;
  readonly effectiveStages: number;
  readonly remainderLayers: number;
}

/**
 * 与 `deployCalculator.ts` (`getContiguousPpStages`) 及上游 `vllm/distributed/utils.py:get_pp_indices` 完全一致：
 * 无法整除时的余数层从倒数第 2 段往前依次各加 1 层（末段保留给 final_norm / lm_head）。
 */
export function computePpLayerRange(totalLayers: number, ppSize: number, ppStage: number): PpLayerRange {
  const safeLayers = Math.max(1, Math.trunc(totalLayers));
  const safePp = Math.max(1, Math.trunc(ppSize));
  const effectiveStages = Math.min(safePp, safeLayers);
  const base = Math.floor(safeLayers / effectiveStages);
  const rem = safeLayers % effectiveStages;
  if (ppStage < 0 || ppStage >= effectiveStages) {
    return {
      startLayer: safeLayers,
      endLayer: safeLayers - 1,
      layerCount: 0,
      effectiveStages,
      remainderLayers: rem,
    };
  }
  const partitions = Array.from({ length: effectiveStages }, () => base);
  for (let i = 2; i < rem + 2; i += 1) {
    partitions[effectiveStages - i]! += 1;
  }
  let offset = 0;
  for (let s = 0; s < ppStage; s += 1) {
    offset += partitions[s]!;
  }
  const count = partitions[ppStage]!;
  return {
    startLayer: offset,
    endLayer: offset + count - 1,
    layerCount: count,
    effectiveStages,
    remainderLayers: rem,
  };
}

export interface EpExpertRange {
  readonly count: number;
  readonly startExpert: number;
  readonly endExpert: number;
  readonly capacityPerRank: number;
}

/**
 * 与上游 `vllm_ascend/ops/moe/expert_map_manager.py` 的连续商数 + 余数切分一致：
 * 前 `E % EP` 个 EP rank 各分得 `floor(E / EP) + 1` 个专家，其余 rank 各分得 `floor(E / EP)` 个专家。
 */
export function computeEpExpertRange(numExperts: number, epWorldSize: number, epRank: number): EpExpertRange {
  const safeExperts = Math.max(0, Math.trunc(numExperts));
  const safeWorld = Math.max(1, Math.trunc(epWorldSize));
  const capacityPerRank = safeExperts > 0 ? Math.ceil(safeExperts / safeWorld) : 0;
  if (safeExperts === 0 || epRank < 0 || epRank >= safeWorld) {
    return { count: 0, startExpert: safeExperts, endExpert: safeExperts - 1, capacityPerRank };
  }
  const base = Math.floor(safeExperts / safeWorld);
  const rem = safeExperts % safeWorld;
  const count = epRank < rem ? base + 1 : base;
  const startExpert = epRank < rem ? epRank * (base + 1) : rem * (base + 1) + (epRank - rem) * base;
  return {
    count,
    startExpert,
    endExpert: startExpert + count - 1,
    capacityPerRank,
  };
}

function countStageMoeAndDenseLayers(
  spec: DeployModelStructuralSpec,
  ppRange: PpLayerRange,
): { moeLayersInStage: number; denseLayersInStage: number } {
  if (ppRange.layerCount <= 0 || !spec.isMoe) {
    return { moeLayersInStage: 0, denseLayersInStage: Math.max(0, ppRange.layerCount) };
  }
  if (spec.moeLayerMask && spec.moeLayerMask.length === spec.numLayers) {
    let moeCount = 0;
    for (let l = ppRange.startLayer; l <= ppRange.endLayer; l += 1) {
      if (spec.moeLayerMask[l]) moeCount += 1;
    }
    return { moeLayersInStage: moeCount, denseLayersInStage: ppRange.layerCount - moeCount };
  }
  const denseInStage = Math.max(
    0,
    Math.min(ppRange.endLayer + 1, spec.firstKDenseLayers) - ppRange.startLayer,
  );
  return {
    moeLayersInStage: Math.max(0, ppRange.layerCount - denseInStage),
    denseLayersInStage: denseInStage,
  };
}

export interface HardwareRankShardSummary {
  readonly rankIndex: number;
  readonly totalRanks: number;
  readonly nodeIndex: number;
  readonly nodeCount: number;
  readonly isMultiNode: boolean;
  readonly isLocalNodeRank: boolean;
  readonly physicalSlotIndex: number;
  readonly dieIndexInSlot: 0 | 1;
  readonly hardwareSlotLabel: string;
  readonly multiNodeNote: string | null;
  readonly dpReplica: number;
  readonly ppStage: number;
  readonly tpRank: number;
  readonly pcpRank: number;
  readonly epRank: number;
  readonly epWorldSize: number;
  readonly groupBadge: string;
  readonly layerStart: number;
  readonly layerEnd: number;
  readonly layerCount: number;
  readonly ppSummary: string;
  readonly tpSummary: string;
  readonly kvSummary: string;
  readonly kvHeadReplicated: boolean;
  readonly kvReplicationNotice: string | null;
  readonly mlaLatentNotice: string | null;
  readonly routedExpertsOnRank: number;
  readonly moeSummary: string;
  readonly collectiveSummary: string;
  readonly topologyBoundaryNote: string;
}

export function computeRankShardSummary(
  payload: HardwareDeployOverlayPayload,
  rankIndex: number,
  customModelRaw?: string | null | undefined,
): HardwareRankShardSummary {
  const mapping = CARD_TO_3D_HARDWARE_MAP[payload.cardId];
  const spec = resolveDeployModelStructuralSpec(payload.modelKey, customModelRaw);
  const safeRank = Math.max(0, Math.min(payload.totalRanks - 1, Math.trunc(rankIndex)));
  const tp = payload.tp;
  const pp = payload.pp;
  const dp = payload.dp;
  const ep = payload.ep;
  const pcp = payload.calc?.pcp ?? 1;
  const dcp = payload.calc?.dcp ?? 1;

  const effectiveRanksPerNode =
    payload.calc?.dpLocal !== undefined
      ? Math.min(mapping.ranksPerNode, payload.calc.dpLocal * tp * pp * pcp)
      : mapping.ranksPerNode;
  const nodeCount = Math.max(1, Math.ceil(payload.totalRanks / effectiveRanksPerNode));
  const isMultiNode = payload.totalRanks > effectiveRanksPerNode;
  const nodeIndex = Math.floor(safeRank / effectiveRanksPerNode);
  const isLocalNodeRank = nodeIndex === 0;
  const localRank = safeRank % effectiveRanksPerNode;
  const physicalSlotIndex = Math.floor(localRank / mapping.diesPerPhysicalSlot);
  const dieIndexInSlot: 0 | 1 = localRank % mapping.diesPerPhysicalSlot === 1 ? 1 : 0;

  const slotCode = `${mapping.partPrefix}${physicalSlotIndex}`;
  const hardwareSlotLabel =
    mapping.diesPerPhysicalSlot === 2
      ? mapping.partPrefix === "card"
        ? `${isMultiNode ? `节点 #${nodeIndex} · ` : ""}PCIe 标卡 ${slotCode} · Chip ${dieIndexInSlot}（单卡双芯 48 GiB，本芯 24 GiB）`
        : `${isMultiNode ? `节点 #${nodeIndex} · ` : ""}双芯模组 ${slotCode} · Die ${dieIndexInSlot}（共封装 128 GiB，本 Die 64 GiB）`
      : `${isMultiNode ? `节点 #${nodeIndex} · ` : ""}物理模组 ${slotCode}（单卡 ${mapping.rankHbmGiB} GiB）`;

  const multiNodeNote = isMultiNode
    ? isLocalNodeRank
      ? `跨 ${nodeCount} 台整机共 ${payload.totalRanks} Ranks；当前选中本机（节点 #0）槽位`
      : `跨 ${nodeCount} 台整机共 ${payload.totalRanks} Ranks；Rank ${safeRank} 位于远端节点 #${nodeIndex}（3D 舞台仅渲染第 0 台整机）`
    : null;

  const innerGroupSize = tp * pcp;
  const replicaStride = innerGroupSize * pp;
  const dpReplica = Math.floor(safeRank / replicaStride);
  const ppStage = Math.floor((safeRank % replicaStride) / innerGroupSize);
  const tpRank = safeRank % tp;
  const pcpRank = Math.floor((safeRank % innerGroupSize) / tp);
  const epWorldSize = spec.isMoe && ep ? tp * dp * pcp : 1;
  const epRank = dpReplica * innerGroupSize + pcpRank * tp + tpRank;

  const groupParts = [`DP 副本 #${dpReplica}`, `PP 段 #${ppStage}`, `TP 秩 #${tpRank}`];
  if (pcp > 1) groupParts.push(`PCP 秩 #${pcpRank}`);
  if (dcp > 1) groupParts.push(`DCP=${dcp}`);
  const groupBadge = groupParts.join(" · ");

  const ppRange = computePpLayerRange(spec.numLayers, pp, ppStage);
  const templateHint = spec.isCustomTemplate ? `（按 ${spec.numLayers} 层代表结构示意）` : "";
  let ppEndpointNote = "";
  if (pp <= 1) {
    ppEndpointNote = spec.tieWordEmbeddings ? " + 共享词表/LM Head" : " + embed_tokens + lm_head";
  } else if (ppStage === 0) {
    ppEndpointNote = " + 输入词表 embed_tokens";
  } else if (ppStage === ppRange.effectiveStages - 1) {
    ppEndpointNote = " + final_norm / lm_head";
  }
  const remNote =
    pp > 1 && ppRange.remainderLayers > 0 ? `；余 ${ppRange.remainderLayers} 层自倒数第 2 段往前分配` : "";
  const ppSummary =
    ppRange.layerCount > 0
      ? `第 ${ppRange.startLayer}–${ppRange.endLayer} 层（共 ${ppRange.layerCount}/${spec.numLayers} 层${ppEndpointNote}${remNote}）${templateHint}`
      : `空流水段（PP=${pp} 超过模型总层数 ${spec.numLayers}）`;

  const qHeadsPerRank = Math.max(1, Math.ceil(spec.numHeads / tp));
  const qStart = Math.min(spec.numHeads - 1, tpRank * qHeadsPerRank);
  const qEnd = Math.min(spec.numHeads - 1, qStart + qHeadsPerRank - 1);
  const tpSummary =
    tp === 1
      ? `TP=1 整份常驻（QKV / GateUp / O / Down 矩阵不切分，Q 头 H0–H${spec.numHeads - 1}）`
      : `QKV / GateUp 按列切 1/${tp}（分片 #${tpRank}/${tp}，Q 头 H${qStart}–H${qEnd}）；O / Down 按行切 1/${tp}`;

  let kvSummary: string;
  let kvHeadReplicated = false;
  let kvReplicationNotice: string | null = null;
  let mlaLatentNotice: string | null = null;
  const dcpSuffix = dcp > 1 ? `；DCP=${dcp} 按历史序列位置切 1/${dcp}` : "";

  if (spec.hasMla) {
    const lora = spec.kvLoraRank ?? 512;
    const rope = spec.qkRopeHeadDim ?? 64;
    const latentVec = rope > 0 ? `c_KV(${lora}) + k_R(${rope})` : `c_KV(${lora})`;
    mlaLatentNotice = `MLA 潜向量全卡驻留：单头低秩潜向量 ${latentVec} 在 TP 各卡完整驻留，不随 TP 切头${spec.hasCsa2 ? "（含 Lightning Indexer 索引缓存全卡驻留）" : ""}${dcpSuffix}`;
    kvSummary = mlaLatentNotice;
  } else if (tp > spec.numKvHeads) {
    kvHeadReplicated = true;
    const replicasPerKv = Math.max(1, Math.floor(tp / spec.numKvHeads));
    const kvIdx = Math.min(spec.numKvHeads - 1, Math.floor(tpRank / replicasPerKv));
    kvReplicationNotice = `KV 头复制 (TP > numKvHeads)：总 KV 头仅 ${spec.numKvHeads} 个 < TP=${tp}，本卡驻留 KV${kvIdx} 完整副本（每 ${replicasPerKv} 张 TP 卡共享同一 KV 头）${dcpSuffix}`;
    kvSummary = kvReplicationNotice;
  } else if (tp === 1) {
    kvSummary = `完整持有全部 ${spec.numKvHeads} 个 KV 头（KV0–KV${spec.numKvHeads - 1}）${spec.hasKda ? "；KDA 线性层固定状态整份常驻" : ""}${dcpSuffix}`;
  } else {
    const kvPerRank = Math.max(1, Math.ceil(spec.numKvHeads / tp));
    const kvStart = Math.min(spec.numKvHeads - 1, tpRank * kvPerRank);
    const kvEnd = Math.min(spec.numKvHeads - 1, kvStart + kvPerRank - 1);
    const kvRangeTxt = kvStart === kvEnd ? `KV${kvStart}` : `KV${kvStart}–KV${kvEnd}`;
    kvSummary = `持有 ${kvPerRank}/${spec.numKvHeads} 个 KV 头（${kvRangeTxt}）${spec.hasKda ? `；KDA 线性层递归/卷积状态按 1/${tp} 切头` : ""}${dcpSuffix}`;
  }

  const { moeLayersInStage, denseLayersInStage } = countStageMoeAndDenseLayers(spec, ppRange);
  let routedExpertsOnRank = 0;
  let moeSummary: string;
  if (!spec.isMoe) {
    moeSummary =
      tp === 1
        ? `稠密 FFN（无路由专家）：Gate / Up / Down 整份驻留${spec.hasEngram ? "；Engram 条件记忆表默认卸载至主机内存" : ""}`
        : `稠密 FFN（无路由专家）：Gate / Up 按列切 1/${tp}，Down 按行切 1/${tp}${spec.hasEngram ? "；Engram 条件记忆表默认卸载至主机内存" : ""}`;
  } else if (ppRange.layerCount === 0) {
    routedExpertsOnRank = 0;
    moeSummary = `空流水段：本卡无层驻留（不承载路由专家或共享专家）`;
  } else if (moeLayersInStage === 0) {
    routedExpertsOnRank = 0;
    const denseSliceTxt =
      tp === 1 ? "Gate / Up / Down 整份驻留" : `Gate / Up 按列切 1/${tp}，Down 按行切 1/${tp}`;
    moeSummary = `本流水段（第 ${ppRange.startLayer}–${ppRange.endLayer} 层）全为稠密 FFN 层：本卡不驻留 MoE 路由专家或共享专家（${denseSliceTxt}）`;
  } else {
    const densePrefixTxt =
      denseLayersInStage > 0 ? `（本段含 ${denseLayersInStage} 层稠密 + ${moeLayersInStage} 层 MoE）` : "";
    const sharedTxt =
      spec.numSharedExperts > 0
        ? `；${spec.numSharedExperts} 个共享专家各卡常驻、内部矩阵按 1/${tp} 切分`
        : "；无独立共享专家，Router 门控各卡完整常驻";
    if (ep) {
      const epRange = computeEpExpertRange(spec.numExperts, epWorldSize, epRank);
      routedExpertsOnRank = epRange.count;
      const rangeStr =
        epRange.count > 0
          ? epRange.startExpert === epRange.endExpert
            ? `E${epRange.startExpert}`
            : `E${epRange.startExpert}–E${epRange.endExpert}`
          : "无分配槽";
      const capDetail =
        epRange.count !== epRange.capacityPerRank
          ? `本卡 ${epRange.count} 个、容量上限 ${epRange.capacityPerRank} 个/卡`
          : `容量 ${epRange.capacityPerRank} 个/卡`;
      moeSummary = `EP 开启（EP 域=${epWorldSize}）：本卡承载 ${rangeStr}（${capDetail}，共 ${spec.numExperts} 专家每词激活 Top-${spec.topK}）${sharedTxt}${densePrefixTxt}`;
    } else {
      routedExpertsOnRank = spec.numExperts;
      const sliceDiv = tp * dp * pcp;
      moeSummary = `EP 关闭：全部 ${spec.numExperts} 个路由专家均驻留本卡，专家内部 GateUp/Down 按 1/${sliceDiv} 张量切分${sharedTxt}${densePrefixTxt}`;
    }
  }

  const commItems: string[] = [];
  if (tp > 1) commItems.push(`TP 组内 All-Reduce（${tp} 卡同组归约）`);
  if (pcp > 1) {
    commItems.push(`PCP 上下文并行（Query 序列按 1/${pcp} 切分，${pcp} 卡跨组聚合 KV 上下文注意力）`);
  }
  if (dcp > 1 && pcp <= 1) {
    commItems.push(`DCP 解码上下文并行（KV 历史按 1/${dcp} 切分并跨卡归约注意力）`);
  }
  if (spec.isMoe && ep && epWorldSize > 1 && moeLayersInStage > 0) {
    commItems.push(`EP 组内 All-to-All 或 MC2（${epWorldSize} 卡专家分发/合并）`);
  }
  if (pp > 1) {
    const peerHint =
      ppStage === 0
        ? "向 PP 段 #1 点对点传激活"
        : ppStage === ppRange.effectiveStages - 1
          ? `接收 PP 段 #${ppStage - 1} 激活并输出 logits`
          : `在 PP 段 #${ppStage - 1} → #${ppStage + 1} 间 P2P 接力传激活`;
    commItems.push(`PP 段间 P2P（${peerHint}）`);
  }
  if (dp > 1 && !(spec.isMoe && ep && moeLayersInStage > 0)) {
    commItems.push(`DP 副本 #${dpReplica} 独立承载请求批次（推理期无梯度同步）`);
  }
  if (commItems.length === 0) {
    commItems.push("单卡独立完成全部层前向，无跨卡集合通信");
  }
  const collectiveSummary = commItems.join(" · ");
  const topologyBoundaryNote =
    "注：3D 连线表达逻辑并行分组与数据交接关系，不冒充交换芯片物理走线或真实包序。";

  return {
    rankIndex: safeRank,
    totalRanks: payload.totalRanks,
    nodeIndex,
    nodeCount,
    isMultiNode,
    isLocalNodeRank,
    physicalSlotIndex,
    dieIndexInSlot,
    hardwareSlotLabel,
    multiNodeNote,
    dpReplica,
    ppStage,
    tpRank,
    pcpRank,
    epRank,
    epWorldSize,
    groupBadge,
    layerStart: ppRange.startLayer,
    layerEnd: ppRange.endLayer,
    layerCount: ppRange.layerCount,
    ppSummary,
    tpSummary,
    kvSummary,
    kvHeadReplicated,
    kvReplicationNotice,
    mlaLatentNotice,
    routedExpertsOnRank,
    moeSummary,
    collectiveSummary,
    topologyBoundaryNote,
  };
}

const FALLBACK_PRESET_HF_CONFIGS: Readonly<Partial<Record<DeployOverlayModelKey, Record<string, unknown>>>> =
  {
    "qwen3-32b": {
      architectures: ["Qwen3ForCausalLM"],
      attention_bias: false,
      head_dim: 128,
      hidden_act: "silu",
      hidden_size: 5120,
      intermediate_size: 25600,
      max_position_embeddings: 40960,
      model_type: "qwen3",
      num_attention_heads: 64,
      num_hidden_layers: 64,
      num_key_value_heads: 8,
      rms_norm_eps: 1e-6,
      rope_theta: 1000000,
      tie_word_embeddings: false,
      torch_dtype: "bfloat16",
      vocab_size: 151936,
    },
    "qwen3-235b-a22b": {
      architectures: ["Qwen3MoeForCausalLM"],
      attention_bias: false,
      decoder_sparse_step: 1,
      head_dim: 128,
      hidden_act: "silu",
      hidden_size: 4096,
      intermediate_size: 12288,
      max_position_embeddings: 40960,
      mlp_only_layers: [],
      model_type: "qwen3_moe",
      moe_intermediate_size: 1536,
      norm_topk_prob: true,
      num_attention_heads: 64,
      num_experts: 128,
      num_experts_per_tok: 8,
      num_hidden_layers: 94,
      num_key_value_heads: 4,
      rms_norm_eps: 1e-6,
      rope_theta: 1000000,
      tie_word_embeddings: false,
      torch_dtype: "bfloat16",
      vocab_size: 151936,
    },
  };

const FAMILY_DEFAULT_CARD_MAP: Readonly<Record<AscendFamily, AscendCalcCardId>> = {
  A2: "a2-64g",
  A3: "a3-die64g",
  "310P": "310p-24g",
  A5: "950dt-128g",
};

const CARD_TO_FAMILY_MAP: Readonly<Record<AscendCalcCardId, AscendFamily>> = {
  "a2-64g": "A2",
  "a2-32g": "A2",
  "a3-die64g": "A3",
  "310p-24g": "310P",
  "950dt-128g": "A5",
};

const ALLOWED_RAW_DTYPES: ReadonlySet<string> = new Set([
  "auto",
  "bfloat16",
  "bf16",
  "float16",
  "fp16",
  "half",
]);

const UNSUPPORTED_MODEL_QUANT_RE =
  /(?:^|[-_./])(?:awq|gptq|gguf|bnb|bitsandbytes|exl2|aqlm|hqq|quanto|mxfp4|nvfp4|fp4|int4|4bit|w8a16|w4a16|w4a4|w8a8[_-]?pdmix)(?:$|[-_./])/i;

const IMPLICIT_MODEL_QUANT_RE =
  /(?:^|[-_./])(?:fp8|mxfp8|int8|8bit|c8|w8a8(?:sc|c8|[_-]?dynamic|[_-]?mix|-310)?|w4a8|quant(?:ized)?)(?:$|[-_./])/i;

export interface BuildHardwareDeployFromCommandOptions {
  readonly cardId?: AscendCalcCardId | null | undefined;
  readonly hardwareFamily?: AscendFamily | null | undefined;
  readonly version?: Extract<RuleVersion, "v0.30.0" | "main"> | undefined;
  readonly preserveParams?: URLSearchParams | undefined;
}

function hasUnsupportedShellSyntaxOrMultiCommand(rawText: string): boolean {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\\[ \t]*\n/g, " ");
  let quote: "'" | '"' | null = null;
  const statements: string[] = [];
  let cur = "";

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i] ?? "";
    const next = normalized[i + 1] ?? "";

    if (quote === "'") {
      if (ch === "'") quote = null;
      else if (ch === "$" && /^\{?[A-Za-z_][A-Za-z0-9_]*/.test(normalized.slice(i + 1))) return true;
      cur += ch;
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < normalized.length) {
        cur += ch + next;
        i += 1;
        continue;
      }
      if (ch === '"') {
        quote = null;
      } else if (
        ch === "`" ||
        (ch === "$" && /^(?:\(|\{|[A-Za-z0-9_?#@*!$])/.test(normalized.slice(i + 1)))
      ) {
        return true;
      }
      cur += ch;
      continue;
    }

    if (ch === "\\" && i + 1 < normalized.length) {
      cur += ch + next;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "#" && (cur.length === 0 || /\s/.test(cur[cur.length - 1] ?? ""))) {
      while (i < normalized.length && normalized[i] !== "\n") i += 1;
      if (cur.trim().length > 0) statements.push(cur.trim());
      cur = "";
      continue;
    }
    if (ch === ";" || ch === "|" || ch === "`") return true;
    if (ch === "&" && next === "&") return true;
    if ((ch === "<" || ch === ">") && next === "(") return true;
    if (ch === "$" && /^(?:\(|\{|[A-Za-z0-9_?#@*!$])/.test(normalized.slice(i + 1))) return true;
    if (ch === "\n") {
      if (cur.trim().length > 0) statements.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (quote !== null) return true;
  if (cur.trim().length > 0) statements.push(cur.trim());
  if (statements.length === 0) return true;

  let serveCount = 0;
  for (const stmt of statements) {
    const isServe =
      /(?:^|\s)vllm\s+serve(?:\s|$)/.test(stmt) ||
      /(?:^|\s)python3?\s+-m\s+vllm\.entrypoints\.(?:openai\.api_server|cli\.main)(?:\s|$)/.test(stmt);
    if (isServe) {
      serveCount += 1;
      continue;
    }
    const isPureExportOrAssign =
      /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=\S+(?:\s+[A-Za-z_][A-Za-z0-9_]*=\S+)*$/.test(stmt);
    if (!isPureExportOrAssign) return true;
  }
  return serveCount !== 1;
}

/**
 * 严格匹配受支持的 6 个预设模型标识（与 `QuickSearch.tsx` 共享同一套边界规则）：
 * 明确拒绝蒸馏版（如 `DeepSeek-R1-Distill-Qwen-32B`、`0528-Qwen3`）、多模态 VL/Audio/Omni、Lite/V2/V4、占位符 `<model>` 与未展开变量 `$VAR`。
 */
export function matchDeployPresetModelKey(
  modelText: string | null | undefined,
  options?: { readonly allowShortMoeAlias?: boolean | undefined },
): DeployOverlayModelKey | null {
  if (!modelText) return null;
  const trimmed = modelText.trim();
  if (!trimmed || trimmed.includes("<") || trimmed.includes(">") || trimmed.includes("$")) return null;
  const s = trimmed.toLowerCase();
  if (
    /(?:^|[^a-z0-9])(?:distill|distilled|vl|audio|omni|embedding|reranker|coder[-_.\s]?v2|lite)(?:$|[^a-z0-9])/.test(
      s,
    )
  ) {
    return null;
  }
  if (/0528[-_.\s]?qwen|r1[-_.\s]?qwen|r1[-_.\s]?llama/.test(s)) return null;

  if (/(?:^|[^a-z0-9])qwen3[-_.\s]?0\.6b(?![0-9a-z])/.test(s)) return "qwen3-0.6b";
  if (/(?:^|[^a-z0-9])qwen3[-_.\s]?30b[-_.\s]?a3b(?![0-9a-z])/.test(s)) return "qwen3-30b-a3b";
  if (options?.allowShortMoeAlias && /(?:^|[^a-z0-9])qwen3[-_.\s]?30b(?![0-9a-z])/.test(s)) {
    return "qwen3-30b-a3b";
  }
  if (/(?:^|[^a-z0-9])qwen3[-_.\s]?235b[-_.\s]?a22b(?![0-9a-z])/.test(s)) return "qwen3-235b-a22b";
  if (options?.allowShortMoeAlias && /(?:^|[^a-z0-9])qwen3[-_.\s]?235b(?![0-9a-z])/.test(s)) {
    return "qwen3-235b-a22b";
  }
  if (/(?:^|[^a-z0-9])qwen3[-_.\s]?32b(?![0-9a-z])/.test(s)) return "qwen3-32b";
  if (/(?:^|[^a-z0-9])qwen3[-_.\s]?8b(?![0-9a-z])/.test(s)) return "qwen3-8b";

  if (
    !/(?:^|[^a-z0-9])(?:qwen\d*|llama\d*|deepseek[-_.\s]?(?:v[24]|v3\.2))(?![0-9a-z])/.test(s) &&
    /(?:^|[^a-z0-9])deepseek[-_.\s]?(?:v3(?:\.1)?|r1)(?![0-9a-z.])/.test(s)
  ) {
    return "deepseek-v3-mla";
  }
  return null;
}

/**
 * 从单条 `vllm serve` 命令（或已解析的 `ParsedVllmServeCommand`）确定性构建 `/hardware?deploy=...` 链接：
 * - 严格拒绝多命令合写、解析错误、占位符 `<model>`、未知模型、未知卡型或超出 `{1,2,4,8}` 并行档位的配置（一律返回 `null`）。
 */
export function buildHardwareDeployHrefFromCommand(
  commandOrParsed: string | ParsedVllmServeCommand,
  options?: BuildHardwareDeployFromCommandOptions,
): string | null {
  const rawSource = typeof commandOrParsed === "string" ? commandOrParsed : commandOrParsed.rawText;
  if (hasUnsupportedShellSyntaxOrMultiCommand(rawSource)) return null;

  const parsed =
    typeof commandOrParsed === "string" ? parseVllmServeCommand(commandOrParsed) : commandOrParsed;

  if (parsed.shellPreamble.length > 0) return null;
  if (parsed.parseDiagnostics.some((d) => d.severity === "error")) return null;
  if (
    Object.hasOwn(parsed.envVars, "VLLM_PP_LAYER_PARTITION") ||
    /\bVLLM_PP_LAYER_PARTITION\s*=/.test(rawSource)
  ) {
    return null;
  }
  if (parsed.rawDtype !== undefined && !ALLOWED_RAW_DTYPES.has(parsed.rawDtype.toLowerCase())) {
    return null;
  }
  if (
    /(?:^|\s)--(?:kv[-_]cache[-_]memory[-_]bytes|num[-_]gpu[-_]blocks[-_]override)(?:\s|=|$)/i.test(rawSource)
  ) {
    return null;
  }

  const modelKey = matchDeployPresetModelKey(parsed.model);
  if (!modelKey) return null;

  const modelLower = (parsed.model ?? "").toLowerCase();
  const rawQuant = parsed.rawQuantization?.toLowerCase();
  if (UNSUPPORTED_MODEL_QUANT_RE.test(modelLower)) return null;
  if (!rawQuant && IMPLICIT_MODEL_QUANT_RE.test(modelLower)) return null;

  let cardId: AscendCalcCardId | null = null;
  if (options?.cardId && ALLOWED_CARD_IDS.has(options.cardId)) {
    cardId = options.cardId;
  } else if (options?.hardwareFamily && Object.hasOwn(FAMILY_DEFAULT_CARD_MAP, options.hardwareFamily)) {
    cardId = FAMILY_DEFAULT_CARD_MAP[options.hardwareFamily];
  } else if (rawQuant === "w8a8sc") {
    cardId = "310p-24g";
  }
  if (!cardId) return null;

  const ci = parsed.couplingInput;
  const tp = ci.tpSize ?? 1;
  const pp = ci.ppSize ?? 1;
  const dp = ci.dpSize ?? 1;
  const pcp = ci.pcpSize ?? 1;
  const dcp = ci.dcpSize ?? 1;
  if (
    parsed.dataParallelSizeLocal !== undefined &&
    (parsed.dataParallelSizeLocal < 1 ||
      parsed.dataParallelSizeLocal > dp ||
      dp % parsed.dataParallelSizeLocal !== 0 ||
      parsed.dataParallelSizeLocal * tp * pp * pcp > CARD_TO_3D_HARDWARE_MAP[cardId].ranksPerNode)
  ) {
    return null;
  }
  if (
    !ALLOWED_PARALLEL_SIZES.has(tp) ||
    !ALLOWED_PARALLEL_SIZES.has(pp) ||
    !ALLOWED_PARALLEL_SIZES.has(dp) ||
    !ALLOWED_PARALLEL_SIZES.has(pcp) ||
    !ALLOWED_PARALLEL_SIZES.has(dcp)
  ) {
    return null;
  }

  const u = parsed.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION;
  if (!Number.isFinite(u) || u < 0.1 || u > 0.99) return null;

  const specInfo = DEPLOY_MODEL_STRUCTURAL_SPECS[modelKey];
  if (specInfo.numHeads % tp !== 0) return null;

  let weightPrecision: WeightPrecision;
  if (rawQuant) {
    if (rawQuant === "fp8" || rawQuant === "fp8_block") {
      weightPrecision = "fp8_block";
    } else if (rawQuant === "w4a8") {
      weightPrecision = "w4a8";
    } else if (rawQuant === "w8a8sc" || (rawQuant === "ascend" && cardId === "310p-24g")) {
      weightPrecision = "w8a8sc_310p";
    } else if (rawQuant === "w8a8_dynamic" || rawQuant === "w8a8-dynamic") {
      weightPrecision = "w8a8_dynamic";
    } else if (rawQuant === "w8a8") {
      weightPrecision = "w8a8";
    } else if (rawQuant === "ascend") {
      if (/(?:^|[-_./])w4a8(?:$|[-_./])/.test(modelLower)) {
        weightPrecision = "w4a8";
      } else if (specInfo.isMoe || /(?:^|[-_./])w8a8[_-]?dynamic(?:$|[-_./])/.test(modelLower)) {
        weightPrecision = "w8a8_dynamic";
      } else {
        weightPrecision = "w8a8";
      }
    } else {
      return null;
    }
  } else if (ci.modelDtype === "float32") {
    return null;
  } else if (ci.modelDtype === "float16") {
    weightPrecision = "fp16";
  } else if (cardId === "310p-24g") {
    return null;
  } else {
    weightPrecision = "bf16";
  }

  let kvCacheDtype: KvCacheDtype = "auto";
  if (parsed.rawKvCacheDtype) {
    const kd = parsed.rawKvCacheDtype.toLowerCase();
    if (kd === "auto") kvCacheDtype = "auto";
    else if (kd === "int8" || kd === "c8") kvCacheDtype = "int8";
    else if (kd === "mxfp8" || kd === "fp8" || kd === "fp8_e4m3" || kd === "fp8_e4m3fn") {
      kvCacheDtype = "mxfp8";
    } else {
      return null;
    }
  }

  const version: Extract<RuleVersion, "v0.30.0" | "main"> = options?.version ?? "v0.30.0";
  const cardFamily = CARD_TO_FAMILY_MAP[cardId];
  const doctorReport = runSingleConfigDoctor(rawSource, {
    mode: "full",
    hardwareFamily: cardFamily,
    version,
  });
  if (doctorReport.hasBlockers || doctorReport.errors.length > 0) return null;

  const weightNzMode: 0 | 1 | 2 =
    ci.weightNzMode === 0 || ci.weightNzMode === 1 || ci.weightNzMode === 2 ? ci.weightNzMode : 1;
  const enableEplb =
    /(?:^|\s)--enable-eplb(?:\s|=|$)/.test(parsed.normalizedCommandLine) &&
    !/(?:^|\s)--no-enable-eplb(?:\s|=|$)/.test(parsed.normalizedCommandLine);
  const gate = evaluateWave3ModelGate(modelKey);
  const modelForCalc =
    gate.ok && gate.supportedInWave3 ? gate.spec : (FALLBACK_PRESET_HF_CONFIGS[modelKey] ?? modelKey);

  try {
    const plan = evaluateDeployPlan({
      model: modelForCalc,
      cardId,
      version,
      weightPrecision,
      kvCacheDtype,
      weightNzMode,
      tpSize: tp,
      ppSize: pp,
      dpSize: dp,
      pcpSize: pcp,
      dcpSize: dcp,
      enableEp: Boolean(ci.enableExpertParallel && specInfo.isMoe),
      enableEplb,
      gpuMemoryUtilization: u,
      ...(ci.blockSize !== undefined ? { blockSize: ci.blockSize } : {}),
      ...(ci.userSpecifiedBlockSize ? { userSpecifiedBlockSize: true } : {}),
      ...(ci.numSpecTokens !== undefined ? { numSpecTokens: ci.numSpecTokens } : {}),
      ...(ci.maxModelLen !== undefined ? { maxModelLen: ci.maxModelLen } : {}),
      ...(ci.maxNumBatchedTokens !== undefined ? { maxNumBatchedTokens: ci.maxNumBatchedTokens } : {}),
      ...(ci.maxNumSeqs !== undefined ? { maxNumSeqs: ci.maxNumSeqs } : {}),
      ...(ci.cudagraphMode !== undefined ? { cudagraphMode: ci.cudagraphMode } : {}),
      ...(ci.cudagraphCaptureSizes !== undefined
        ? { cudagraphCaptureCount: ci.cudagraphCaptureSizes.length }
        : {}),
      enforceEager: parsed.enforceEager,
      ...(ci.useV2ModelRunner !== undefined ? { useV2ModelRunner: ci.useV2ModelRunner } : {}),
    });

    if (plan.fourQuestions.q1Fit.verdict === "blocked" || plan.fourQuestions.q1Fit.blockers.length > 0) {
      return null;
    }

    const extraHcclBytes =
      Math.max(
        0,
        (doctorReport.hcclEstimate?.totalMaterializedMiB ?? 0) - plan.hcclEstimate.totalMaterializedMiB,
      ) *
      1024 *
      1024;
    const wBytes = plan.stages[2].pointEstimateBytes;
    const actBytes = plan.stages[3].pointEstimateBytes;
    const nonTorchBytes = plan.stages[4].pointEstimateBytes + extraHcclBytes;
    const kvBytes = Math.max(0, plan.stages[5].pointEstimateBytes - extraHcclBytes);
    const aclBytes = plan.stages[6].pointEstimateBytes;
    const workspace310pBytes = plan.card.halvesKvForWorkspace
      ? Math.max(0, plan.requestedBytes - (wBytes + actBytes + nonTorchBytes + kvBytes))
      : 0;
    const rawOom = plan.fourQuestions.q2Capacity.oomStatus;
    const oomStatus: DeployOverlayOomStatus =
      rawOom !== "fits"
        ? rawOom
        : plan.headroomStatus === "overflow"
          ? "headroom_overflow"
          : plan.headroomStatus === "risk"
            ? "headroom_risk"
            : "fits";

    const payload: HardwareDeployOverlayPayload = {
      modelKey,
      cardId,
      tp,
      pp,
      dp,
      ep: Boolean(ci.enableExpertParallel && specInfo.isMoe),
      totalRanks: tp * pp * dp * pcp,
      cardGiB: plan.card.hbmGiB,
      u,
      weightGiB: wBytes / GIB,
      kvGiB: kvBytes / GIB,
      runtimeGiB: (actBytes + nonTorchBytes + workspace310pBytes + aclBytes) / GIB,
      oomStatus,
      headroomOverflow: plan.headroomStatus === "overflow",
      headroomRisk: plan.headroomStatus === "risk",
      calc: {
        weightPrecision,
        kvCacheDtype,
        weightNzMode,
        ...(parsed.dataParallelSizeLocal !== undefined ? { dpLocal: parsed.dataParallelSizeLocal } : {}),
        pcp,
        dcp,
        ...(ci.maxModelLen !== undefined ? { maxModelLen: ci.maxModelLen } : {}),
        ...(ci.maxNumBatchedTokens !== undefined ? { maxNumBatchedTokens: ci.maxNumBatchedTokens } : {}),
        ...(ci.maxNumSeqs !== undefined ? { maxNumSeqs: ci.maxNumSeqs } : {}),
        ...(ci.cudagraphMode !== undefined ? { cudagraphMode: ci.cudagraphMode } : {}),
        ...(ci.useV2ModelRunner !== undefined ? { useV2ModelRunner: ci.useV2ModelRunner } : {}),
        version,
      },
    };
    const encoded = encodeHardwareDeployOverlay(payload);
    if (encoded.length > MAX_DEPLOY_OVERLAY_PARAM_CHARS) return null;
    if (!parseHardwareDeployOverlay(encoded)) return null;
    return buildHardwareDeployHref(payload, options?.preserveParams);
  } catch {
    return null;
  }
}
