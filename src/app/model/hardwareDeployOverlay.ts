import type {
  AscendCalcCardId,
  KvCacheDtype,
  KvOomStatus,
  WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { extractStructuralHfConfig } from "../../sim/modelspec/parseHfConfig";
import type { CudaGraphMode, RuleVersion } from "../../sim/rules/types";

export const MAX_DEPLOY_OVERLAY_PARAM_CHARS = 1024;

export type DeployOverlayModelKey =
  | "qwen3-0.6b"
  | "qwen3-8b"
  | "qwen3-30b-a3b"
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
  const ranksPerNode = mapping.ranksPerNode;
  const nodeCount = Math.max(1, Math.ceil(payload.totalRanks / ranksPerNode));
  const isMultiNode = payload.totalRanks > ranksPerNode;
  const localActiveRanks = Math.min(payload.totalRanks, ranksPerNode);
  const pcp = payload.calc?.pcp ?? 1;
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
