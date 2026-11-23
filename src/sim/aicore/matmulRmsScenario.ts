/**
 * Pure-TS single-scenario simulation model for Tool ④「昇腾 AI Core 算子与流水线实验室」(`aicore-lab`).
 *
 * Focuses strictly on one deep scenario:
 *   Low-bit Matrix Multiply (`QuantMatmul`) + subsequent `AddRMSNorm` across 2 Tiles (`T0`, `T1`).
 *
 * Hardware topology (parts, routes, evidence IDs) is sourced directly from `NPU_910B` in
 * `src/sim/hardware/spec.ts` and `HARDWARE_CLAIMS` in `src/sim/hardware/claims.ts`.
 *
 * IMPORTANT BOUNDARY:
 *   All swimlane timings are schematic relative ordering (`示意相对时序`), NOT `msprof` measured cycles,
 *   and Roofline vertical positions are relative ceiling proximity, NEVER fabricated MFU percentages.
 */

import { HARDWARE_CLAIMS } from "../hardware/claims";
import { NPU_910B, type PartSpec } from "../hardware/spec";

export type AiCoreArch = "910b" | "950";
export type QuantFormatId = "mxfp8" | "w8a8_dynamic" | "per_tensor_int8";
export type SwimlaneId =
  | "aic-mte2"
  | "aic-mte1"
  | "aic-cube"
  | "handoff"
  | "aiv-mte2"
  | "aiv-vector"
  | "aiv-mte3";

export const SCHEMATIC_TIMING_BADGE = "示意相对时序 · 非 msprof 实测周期" as const;

export const AICORE_LAB_WIKI_PAGE_IDS = [
  "ai-core",
  "ascend-950-architecture",
  "low-precision-formats",
  "quantization",
  "roofline-and-metrics",
  "hardware-devices",
  "device-memory",
] as const;

export const SCENARIO_META = {
  id: "quant-matmul-add-rmsnorm",
  title: "低比特矩阵乘 (QuantMatmul) + 后继 AddRMSNorm",
  tileCount: 2,
  tileShape: { m: 32, k: 64, n: 64 },
  /** Logical element sizes used for transparent GM/L2 byte accounting. */
  bytesPerLowBitElem: 1,
  bytesPerActElem: 2,
  /** Schematic GM/L2 Roofline ridge point (FLOP/B) for qualitative slope-vs-ceiling illustration. */
  schematicRidgeAi: 20,
  /** Fixed schematic timeline horizon so toggling optimizations visibly contracts total relative span. */
  timelineHorizonUnits: 112,
} as const;

export const GROUP0_PROBE_VALUES = [0.18, -0.24] as const;
export const GROUP0_LOCAL_MAX = 0.32;
export const OUTLIER_RANGE = { min: 1, max: 24, defaultVal: 16 } as const;
export const PER_TENSOR_GLOBAL_FLOOR = 32;

export interface AiCoreLabInput {
  arch: AiCoreArch;
  doubleBuffer: boolean;
  fuseAddRmsNorm: boolean;
  quantFormat: QuantFormatId;
  outlierCh64: number;
}

export const DEFAULT_AICORE_LAB_INPUT: AiCoreLabInput = {
  arch: "910b",
  doubleBuffer: false,
  fuseAddRmsNorm: false,
  quantFormat: "mxfp8",
  outlierCh64: OUTLIER_RANGE.defaultVal,
};

export interface SwimlaneBlock {
  id: string;
  tile: "T0" | "T1";
  kind: "work" | "stall";
  slotTag?: "Ping" | "Pong" | undefined;
  label: string;
  startUnit: number;
  durationUnit: number;
  leftPct: number;
  widthPct: number;
  tone: "token" | "weight" | "kv" | "comm" | "success" | "warn";
  /** True only when this block reads Matmul output back from external GM/L2. */
  readsMatmulOutputFromGm?: boolean | undefined;
}

export interface SwimlaneTrack {
  id: SwimlaneId;
  label: string;
  domain: "aic" | "bridge" | "aiv";
  engineLabel: string;
  specPartIds: readonly string[];
  blocks: readonly SwimlaneBlock[];
  note?: string | undefined;
}

export interface GmByteBreakdown {
  /** Logical FLOPs for 2 tiles (fixed across hardware/fusion/buffer toggles). */
  totalFlops: number;
  /** AIC MTE2 loads quantized activations X_q + weights W_q (2 tiles). */
  matmulInputWeightBytes: number;
  /** External GM/L2 round-trip for Matmul output (910B FixPipe write + AIV MTE2 read; 0 on 950). */
  matmulHandoffGmBytes: number;
  /** External GM/L2 round-trip for unfused Add intermediate (write + re-read; 0 when fused). */
  unfusedAddGmBytes: number;
  /** Mandatory AIV residual read + final RMSNorm output write (2 tiles). */
  residualAndNormIoBytes: number;
  /** Sum of all external GM/L2 logical bytes across 2 tiles. */
  totalGmBytes: number;
  /** Saved external GM/L2 bytes compared to 910B unfused baseline. */
  savedGmBytesVsBaseline: number;
  /** GM/L2-level arithmetic intensity (FLOP/B). */
  arithmeticIntensity: number;
}

export interface RooflinePoint {
  arithmeticIntensity: number;
  /** Schematic roof level in (0, 1] — NOT a measured MFU percentage. */
  roofLevel: number;
  /** Schematic achieved relative level in (0, 1] — strictly below roofLevel. */
  achievedLevel: number;
  /** SVG coordinates inside viewBox 0 0 420 210 (plot x: 52..394, y: 34..168). */
  svgX: number;
  svgY: number;
  roofSvgY: number;
}

export interface RooflineResponse {
  baseline: RooflinePoint;
  current: RooflinePoint;
  deltaArithmeticIntensity: number;
  deltaSvgX: number;
  /** Positive means operating point moved UPWARD toward the roof (svgY decreased). */
  upwardLiftPx: number;
  movementKind: "baseline" | "vertical-lift" | "rightward-shift" | "right-and-up";
  movementLabel: string;
  gmStatusLabel: string;
  ridgeSvgX: number;
}

export interface OutlierQuantizationResult {
  format: QuantFormatId;
  formatLabel: string;
  outlierCh64: number;
  group0Original: readonly [number, number];
  group0Reconstructed: readonly [number, number];
  /** Mean relative reconstruction error (%) for Group 0 [ch0, ch1]. */
  group0MeanRelErrorPct: number;
  /** Effective quantization step around Group 0 probe values. */
  group0EffectiveStep: number;
  /** Scale governance description (per-32-block E8M0 vs per-token row vs per-tensor global). */
  scaleScope: "block-32-e8m0" | "token-row-int8" | "global-tensor-int8";
  severity: "good" | "warn" | "bad";
  explanation: string;
  sameBlockNuance: string;
}

export interface BufferStepSpec {
  stepNumber: number;
  id: string;
  title: string;
  engine: string;
  fromParts: readonly string[];
  toParts: readonly string[];
  activeParts: readonly string[];
  /** Verified against `NPU_910B.routes` whenever `is950DirectExtension` is false. */
  specRoutes: readonly { from: string; to: string; engine?: string | undefined }[];
  evidenceIds: readonly string[];
  evidenceSummaries: readonly string[];
  is950DirectExtension: boolean;
  residencySummary: string;
  boundaryNote: string;
}

export interface GmComparisonRow {
  id: "910b-unfused" | "910b-fused" | "950-unfused" | "950-fused";
  label: string;
  arch: AiCoreArch;
  fuseAddRmsNorm: boolean;
  bytes: GmByteBreakdown;
}

export interface AiCoreLabResult {
  input: AiCoreLabInput;
  schematicBadge: typeof SCHEMATIC_TIMING_BADGE;
  tracks: readonly SwimlaneTrack[];
  totalRelativeSpanUnits: number;
  bubbleUnits: number;
  t1StartUnit: number;
  usesExternalGmForMatmulHandoff: boolean;
  aivMte2ReadsMatmulFromGm: boolean;
  archNote: string;
  gmBytes: GmByteBreakdown;
  gmComparisonTable: readonly GmComparisonRow[];
  roofline: RooflineResponse;
  quantization: OutlierQuantizationResult;
  bufferSteps: readonly BufferStepSpec[];
  npuSpecId: string;
  npuSpecName: string;
}

const NPU_PARTS_BY_ID: ReadonlyMap<string, PartSpec> = new Map(NPU_910B.parts.map((part) => [part.id, part]));

function assertSpecPartIds(partIds: readonly string[]): readonly string[] {
  for (const id of partIds) {
    if (!NPU_PARTS_BY_ID.has(id)) {
      throw new Error(`AiCoreLab references unknown NPU_910B part id: "${id}"`);
    }
  }
  return partIds;
}

function resolveSpecRoutes(
  pairs: readonly { from: string; to: string; engine?: string | undefined }[],
): readonly { from: string; to: string; engine?: string | undefined }[] {
  return pairs.map((pair) => {
    const found = NPU_910B.routes.find(
      (r) => r.from === pair.from && r.to === pair.to && (pair.engine ? r.engine === pair.engine : true),
    );
    if (!found) {
      throw new Error(`AiCoreLab references unregistered NPU_910B route: ${pair.from} -> ${pair.to}`);
    }
    return { from: found.from, to: found.to, engine: found.engine };
  });
}

function resolveEvidenceSummaries(ids: readonly string[]): readonly string[] {
  return ids.map((id) => {
    const claim = HARDWARE_CLAIMS[id];
    if (!claim) {
      throw new Error(`AiCoreLab references unknown HARDWARE_CLAIMS id: "${id}"`);
    }
    return `${claim.id}: ${claim.text}`;
  });
}

export function computeGmByteBreakdown(arch: AiCoreArch, fuseAddRmsNorm: boolean): GmByteBreakdown {
  const { m, k, n } = SCENARIO_META.tileShape;
  const tiles = SCENARIO_META.tileCount;
  const lowBitB = SCENARIO_META.bytesPerLowBitElem;
  const actB = SCENARIO_META.bytesPerActElem;

  const flopsPerTile = 2 * m * k * n + 6 * m * n;
  const totalFlops = flopsPerTile * tiles;

  const matmulInputWeightBytes = (m * k * lowBitB + k * n * lowBitB) * tiles;
  const tileIntermediateBytes = m * n * actB; // 32 * 64 * 2 B = 4,096 B per tile
  const matmulHandoffGmBytes = arch === "910b" ? tileIntermediateBytes * 2 * tiles : 0;
  const unfusedAddGmBytes = fuseAddRmsNorm ? 0 : tileIntermediateBytes * 2 * tiles;
  const residualAndNormIoBytes = (tileIntermediateBytes + tileIntermediateBytes) * tiles;

  const totalGmBytes =
    matmulInputWeightBytes + matmulHandoffGmBytes + unfusedAddGmBytes + residualAndNormIoBytes;
  const baselineGmBytes =
    matmulInputWeightBytes +
    tileIntermediateBytes * 2 * tiles +
    tileIntermediateBytes * 2 * tiles +
    residualAndNormIoBytes;

  return {
    totalFlops,
    matmulInputWeightBytes,
    matmulHandoffGmBytes,
    unfusedAddGmBytes,
    residualAndNormIoBytes,
    totalGmBytes,
    savedGmBytesVsBaseline: baselineGmBytes - totalGmBytes,
    arithmeticIntensity: totalFlops / totalGmBytes,
  };
}

const ROOFLINE_SVG = {
  xMin: 56,
  xMax: 392,
  yTop: 36,
  yBottom: 166,
  aiMax: 28,
} as const;

function buildRooflinePoint(arithmeticIntensity: number, doubleBuffer: boolean): RooflinePoint {
  const clampedAi = Math.max(0.5, Math.min(ROOFLINE_SVG.aiMax, arithmeticIntensity));
  const roofLevel = Math.min(1, arithmeticIntensity / SCENARIO_META.schematicRidgeAi);
  // Ping-Pong double buffering hides pipeline bubbles without changing GM/L2 bytes -> vertical lift only.
  const efficiencyFactor = doubleBuffer ? 0.9 : 0.56;
  const achievedLevel = roofLevel * efficiencyFactor;
  const plotW = ROOFLINE_SVG.xMax - ROOFLINE_SVG.xMin;
  const plotH = ROOFLINE_SVG.yBottom - ROOFLINE_SVG.yTop;
  const svgX = Number((ROOFLINE_SVG.xMin + (clampedAi / ROOFLINE_SVG.aiMax) * plotW).toFixed(2));
  const roofSvgY = Number((ROOFLINE_SVG.yBottom - roofLevel * plotH).toFixed(2));
  const svgY = Number((ROOFLINE_SVG.yBottom - achievedLevel * plotH).toFixed(2));
  return { arithmeticIntensity, roofLevel, achievedLevel, svgX, svgY, roofSvgY };
}

export function computeRooflineResponse(
  arch: AiCoreArch,
  doubleBuffer: boolean,
  fuseAddRmsNorm: boolean,
): RooflineResponse {
  const baselineBytes = computeGmByteBreakdown("910b", false);
  const currentBytes = computeGmByteBreakdown(arch, fuseAddRmsNorm);
  const baseline = buildRooflinePoint(baselineBytes.arithmeticIntensity, false);
  const current = buildRooflinePoint(currentBytes.arithmeticIntensity, doubleBuffer);

  const deltaArithmeticIntensity = current.arithmeticIntensity - baseline.arithmeticIntensity;
  const deltaSvgX = Number((current.svgX - baseline.svgX).toFixed(2));
  const upwardLiftPx = Number((baseline.svgY - current.svgY).toFixed(2));
  const ridgeSvgX = Number(
    (
      ROOFLINE_SVG.xMin +
      (SCENARIO_META.schematicRidgeAi / ROOFLINE_SVG.aiMax) * (ROOFLINE_SVG.xMax - ROOFLINE_SVG.xMin)
    ).toFixed(2),
  );

  const movedRight = deltaArithmeticIntensity > 0;
  const movedUpOnly = !movedRight && doubleBuffer;
  const movementKind: RooflineResponse["movementKind"] = movedRight
    ? doubleBuffer
      ? "right-and-up"
      : "rightward-shift"
    : movedUpOnly
      ? "vertical-lift"
      : "baseline";

  const movementLabel =
    movementKind === "right-and-up"
      ? "右移提强度 + 纵抬消气泡"
      : movementKind === "rightward-shift"
        ? "省 GM 往返（算术强度右移）"
        : movementKind === "vertical-lift"
          ? "纯纵抬（GM 算术强度不变）"
          : "基线：受 GM 往返与串行气泡压低";

  const gmStatusLabel =
    currentBytes.savedGmBytesVsBaseline > 0
      ? `省 ${currentBytes.savedGmBytesVsBaseline.toLocaleString("en-US")} B GM/L2 往返`
      : "GM/L2 往返未省";

  return {
    baseline,
    current,
    deltaArithmeticIntensity,
    deltaSvgX,
    upwardLiftPx,
    movementKind,
    movementLabel,
    gmStatusLabel,
    ridgeSvgX,
  };
}

export function evaluateOutlierQuantization(
  format: QuantFormatId,
  rawOutlierCh64: number,
): OutlierQuantizationResult {
  const outlierCh64 = Math.max(OUTLIER_RANGE.min, Math.min(OUTLIER_RANGE.max, rawOutlierCh64));
  const g0 = GROUP0_PROBE_VALUES;
  const sameBlockNuance =
    "注意边界：MXFP8 的 E8M0 共享指数粒度为 32 元素；若离群值落在同一 32 元素块内，仍共享该块 E8M0，需依靠 E4M3 浮点指数位缓解而非完全隔离。";

  let rec0: number;
  let rec1: number;
  let effectiveStep: number;
  let formatLabel: string;
  let scaleScope: OutlierQuantizationResult["scaleScope"];
  let explanation: string;

  if (format === "mxfp8") {
    formatLabel = "MXFP8（每 32 通道独立 E8M0 块）";
    scaleScope = "block-32-e8m0";
    // Group 0 [ch0..31] uses its own power-of-two E8M0 scale derived from local max 0.32,
    // isolating it from the ch64 outlier in Group 2 [ch64..95].
    const e8m0Group0 = 2 ** Math.floor(Math.log2(GROUP0_LOCAL_MAX / 256));
    const quantE4m3 = (v: number) => {
      const scaled = v / e8m0Group0;
      const step = 2 ** (Math.floor(Math.log2(Math.abs(scaled))) - 3);
      return Math.round(scaled / step) * step * e8m0Group0;
    };
    rec0 = quantE4m3(g0[0]);
    rec1 = quantE4m3(g0[1]);
    effectiveStep = 2 ** (Math.floor(Math.log2(Math.abs(g0[0] / e8m0Group0))) - 3) * e8m0Group0;
    explanation =
      "Group 0 [ch0..31] 使用自身局部 E8M0 缩放因子，与 Group 2 的 ch64 离群值物理隔离，前组还原误差保持极低且恒定。";
  } else if (format === "w8a8_dynamic") {
    formatLabel = "W8A8_DYNAMIC（同 token 行共享单尺）";
    scaleScope = "token-row-int8";
    // Per-token dynamic INT8 still shares ONE scale across ALL channels of this token row.
    const rowScale = Math.max(GROUP0_LOCAL_MAX, outlierCh64) / 127;
    rec0 = Math.round(g0[0] / rowScale) * rowScale;
    rec1 = Math.round(g0[1] / rowScale) * rowScale;
    effectiveStep = rowScale;
    explanation =
      "Per-token 动态量化按 token 行求 max，但同一行内 ch0..ch95 仍共用一把尺；ch64 离群值拉大步长，会直接压扁 Group 0 小通道精度（需 SmoothQuant/旋转或 MX 分块）。";
  } else {
    formatLabel = "Per-Tensor INT8（全局共享单尺）";
    scaleScope = "global-tensor-int8";
    // Static per-tensor INT8 must cover the global calibration peak across all tokens & channels.
    const globalPeak = Math.max(PER_TENSOR_GLOBAL_FLOOR, outlierCh64 * 1.25);
    const tensorScale = globalPeak / 127;
    rec0 = Math.round(g0[0] / tensorScale) * tensorScale;
    rec1 = Math.round(g0[1] / tensorScale) * tensorScale;
    effectiveStep = tensorScale;
    explanation =
      "整张张量共享单一静态缩放因子，既被跨通道离群值撑大，又受其他 token 的全局峰值牵连，小通道产生严重阶梯量化失真。";
  }

  const err0 = Math.abs(rec0 - g0[0]) / Math.abs(g0[0]);
  const err1 = Math.abs(rec1 - g0[1]) / Math.abs(g0[1]);
  const meanRelErrorPct = Number((((err0 + err1) / 2) * 100).toFixed(2));
  const severity: OutlierQuantizationResult["severity"] =
    meanRelErrorPct > 12 ? "bad" : meanRelErrorPct > 4 ? "warn" : "good";

  return {
    format,
    formatLabel,
    outlierCh64,
    group0Original: g0,
    group0Reconstructed: [Number(rec0.toFixed(4)), Number(rec1.toFixed(4))],
    group0MeanRelErrorPct: meanRelErrorPct,
    group0EffectiveStep: Number(effectiveStep.toFixed(5)),
    scaleScope,
    severity,
    explanation,
    sameBlockNuance,
  };
}

interface RawSegment {
  lane: SwimlaneId;
  key: string;
  label: string;
  start: number;
  duration: number;
  tone: SwimlaneBlock["tone"];
  readsMatmulOutputFromGm?: boolean | undefined;
}

function buildSingleTileSegments(
  arch: AiCoreArch,
  fuseAddRmsNorm: boolean,
): {
  segments: RawSegment[];
  spanUnits: number;
} {
  const is950 = arch === "950";
  const segments: RawSegment[] = [
    { lane: "aic-mte2", key: "load-xw", label: "读 X_q/W_q→L1", start: 0, duration: 8, tone: "token" },
    { lane: "aic-mte1", key: "l1-l0", label: "L1→L0A/L0B", start: 8, duration: 4, tone: "token" },
    { lane: "aic-cube", key: "mmad", label: "MMAD→L0C", start: 12, duration: 9, tone: "weight" },
  ];

  let vecStart: number;
  if (is950) {
    segments.push({
      lane: "handoff",
      key: "l0c-ub",
      label: "L0C→UB 直通",
      start: 21,
      duration: 3,
      tone: "comm",
    });
    segments.push({
      lane: "aiv-mte2",
      key: "load-res-only",
      label: "仅读残差(免读Y)",
      start: 20,
      duration: 4,
      tone: "kv",
      readsMatmulOutputFromGm: false,
    });
    vecStart = 24;
  } else {
    segments.push({
      lane: "handoff",
      key: "fixpipe-gm",
      label: "FixPipe→GM/L2",
      start: 21,
      duration: 6,
      tone: "comm",
    });
    segments.push({
      lane: "aiv-mte2",
      key: "read-matmul-gm",
      label: "读 GM(Y+残差)",
      start: 27,
      duration: 6,
      tone: "kv",
      readsMatmulOutputFromGm: true,
    });
    vecStart = 33;
  }

  let endUnit: number;
  if (fuseAddRmsNorm) {
    segments.push({
      lane: "aiv-vector",
      key: "add-rmsnorm",
      label: "Add+RMSNorm",
      start: vecStart,
      duration: 6,
      tone: "success",
    });
    segments.push({
      lane: "aiv-mte3",
      key: "write-norm",
      label: "写回 Norm(1次)",
      start: vecStart + 6,
      duration: 5,
      tone: "success",
    });
    endUnit = vecStart + 11;
  } else {
    segments.push({
      lane: "aiv-vector",
      key: "vec-add",
      label: "Add",
      start: vecStart,
      duration: 3,
      tone: "warn",
    });
    segments.push({
      lane: "aiv-mte3",
      key: "write-add",
      label: "写 Add→GM",
      start: vecStart + 3,
      duration: 4,
      tone: "warn",
    });
    segments.push({
      lane: "aiv-mte2",
      key: "reread-add",
      label: "重读 Add",
      start: vecStart + 7,
      duration: 4,
      tone: "kv",
      readsMatmulOutputFromGm: false,
    });
    segments.push({
      lane: "aiv-vector",
      key: "vec-rmsnorm",
      label: "RMSNorm",
      start: vecStart + 11,
      duration: 4,
      tone: "kv",
    });
    segments.push({
      lane: "aiv-mte3",
      key: "write-norm",
      label: "写 Norm→GM",
      start: vecStart + 15,
      duration: 5,
      tone: "kv",
    });
    endUnit = vecStart + 20;
  }

  return { segments, spanUnits: endUnit };
}

function computeSafePingPongLag(segments: readonly RawSegment[]): number {
  const laneBounds = new Map<SwimlaneId, { minStart: number; maxEnd: number }>();
  for (const seg of segments) {
    const existing = laneBounds.get(seg.lane);
    const end = seg.start + seg.duration;
    if (!existing) {
      laneBounds.set(seg.lane, { minStart: seg.start, maxEnd: end });
    } else {
      existing.minStart = Math.min(existing.minStart, seg.start);
      existing.maxEnd = Math.max(existing.maxEnd, end);
    }
  }
  let maxSpan = 10;
  for (const b of laneBounds.values()) {
    maxSpan = Math.max(maxSpan, b.maxEnd - b.minStart + 1);
  }
  return maxSpan;
}

function toPct(units: number): number {
  return Number(((units / SCENARIO_META.timelineHorizonUnits) * 100).toFixed(2));
}

function buildBufferSteps(arch: AiCoreArch, fuseAddRmsNorm: boolean): readonly BufferStepSpec[] {
  const is950 = arch === "950";
  const step4: BufferStepSpec = is950
    ? {
        stepNumber: 4,
        id: "cross-handoff",
        title: "④ 片上直通交接（950 L0C → UB）",
        engine: "950·L0C→UB 直通通道",
        fromParts: assertSpecPartIds(["l0c"]),
        toParts: assertSpecPartIds(["ub"]),
        activeParts: assertSpecPartIds(["l0c", "ub"]),
        specRoutes: [],
        evidenceIds: ["HW-S03"],
        evidenceSummaries: [
          ...resolveEvidenceSummaries(["HW-S03"]),
          "昇腾 950 (A5) CV 融合子系统新增 L0C→UB 片上直通，免去 Matmul 输出落盘 GM/L2 再重读（对比 NPU_910B 基准拓扑）。",
        ],
        is950DirectExtension: true,
        residencySummary: "Cube 累加结果直接由 L0C 片上直通进入 AIV UB，随路完成所需精度/排布转换。",
        boundaryNote: "省去 8,192 B/tile（2 Tile 共 16,384 B）核外 GM/L2 逻辑往返。",
      }
    : {
        stepNumber: 4,
        id: "cross-handoff",
        title: "④ 跨核交接（L0C → FixPipe → GM/L2 → AIV·MTE2 → UB）",
        engine: "AIC·FixPipe + AIV·MTE2",
        fromParts: assertSpecPartIds(["l0c"]),
        toParts: assertSpecPartIds(["ub"]),
        activeParts: assertSpecPartIds(["l0c", "fixpipe", "l2", "mte2", "ub"]),
        specRoutes: resolveSpecRoutes([
          { from: "l0c", to: "l2", engine: "fixpipe" },
          { from: "l2", to: "ub", engine: "mte2" },
        ]),
        evidenceIds: ["HW-S01", "HW-S03", "HW-S04"],
        evidenceSummaries: resolveEvidenceSummaries(["HW-S01", "HW-S03", "HW-S04"]),
        is950DirectExtension: false,
        residencySummary:
          "910B 分离核中 AIC 与 AIV 各自独立取指，FixPipe 写回 L1 也不等于进入 UB，Matmul 结果必须经核外 GM/L2 交接。",
        boundaryNote:
          "每 Tile 产生 4,096 B 写 + 4,096 B 读 = 8,192 B 逻辑 GM/L2 往返（若命中 L2 则非外部 HBM 事务）。",
      };

  return [
    {
      stepNumber: 1,
      id: "aic-mte2-load",
      title: "① 矩阵侧备料（GM/L2 → AIC·L1）",
      engine: "AIC·MTE2",
      fromParts: assertSpecPartIds(["hbm[0]", "hbm[1]", "l2"]),
      toParts: assertSpecPartIds(["l1"]),
      activeParts: assertSpecPartIds(["hbm[0]", "hbm[1]", "l2", "mte2", "l1"]),
      specRoutes: resolveSpecRoutes([
        { from: "hbm[0]", to: "l2" },
        { from: "hbm[1]", to: "l2" },
        { from: "l2", to: "l1", engine: "mte2" },
      ]),
      evidenceIds: ["HW-S03", "HW-S04", "HW-S05"],
      evidenceSummaries: resolveEvidenceSummaries(["HW-S03", "HW-S04", "HW-S05"]),
      is950DirectExtension: false,
      residencySummary: "AIC·MTE2 将低比特激活分块 X_q 与权重分块 W_q 从 GM/L2 搬入 AIC 片上 L1。",
      boundaryNote: "开启 Ping-Pong 双缓冲后，L1 拆为两份槽位（单槽可用字节减半），T1 搬运与 T0 计算重叠。",
    },
    {
      stepNumber: 2,
      id: "aic-mte1-split",
      title: "② 分块送入阵列缓冲（L1 → L0A / L0B）",
      engine: "AIC·MTE1",
      fromParts: assertSpecPartIds(["l1"]),
      toParts: assertSpecPartIds(["l0a", "l0b"]),
      activeParts: assertSpecPartIds(["l1", "mte1", "l0a", "l0b"]),
      specRoutes: resolveSpecRoutes([
        { from: "l1", to: "l0a", engine: "mte1" },
        { from: "l1", to: "l0b", engine: "mte1" },
      ]),
      evidenceIds: ["HW-S03"],
      evidenceSummaries: resolveEvidenceSummaries(["HW-S03"]),
      is950DirectExtension: false,
      residencySummary: "AIC·MTE1 将左矩阵激活送入 L0A、右矩阵权重送入 L0B，贴近 Cube 矩阵阵列就近供数。",
      boundaryNote: "属核内片上搬运，不增加核外 GM/L2 字节计数。",
    },
    {
      stepNumber: 3,
      id: "aic-cube-mmad",
      title: "③ Cube 矩阵乘加（L0A/L0B → Cube → L0C）",
      engine: "AIC·Cube",
      fromParts: assertSpecPartIds(["l0a", "l0b"]),
      toParts: assertSpecPartIds(["l0c"]),
      activeParts: assertSpecPartIds(["l0a", "l0b", "cube", "l0c"]),
      specRoutes: [],
      evidenceIds: ["HW-S02", "HW-S03"],
      evidenceSummaries: resolveEvidenceSummaries(["HW-S02", "HW-S03"]),
      is950DirectExtension: false,
      residencySummary: "Cube 单元执行 QuantMatmul (MMAD)，结果累加写入 L0C 累加缓冲。",
      boundaryNote: "计算单元本身不是存储器；累加结果驻留在 L0C 中等待下一步移出。",
    },
    step4,
    {
      stepNumber: 5,
      id: "aiv-vector-norm",
      title: fuseAddRmsNorm
        ? "⑤ 向量融合计算（UB ↔ Vector · Add+RMSNorm）"
        : "⑤ 向量拆分计算（Add 落盘 GM 后重读再算 RMSNorm）",
      engine: fuseAddRmsNorm ? "AIV·Vector" : "AIV·Vector + MTE3/MTE2 往返",
      fromParts: assertSpecPartIds(["ub"]),
      toParts: assertSpecPartIds(["ub"]),
      activeParts: assertSpecPartIds(
        fuseAddRmsNorm ? ["ub", "vector"] : ["ub", "vector", "mte3", "l2", "mte2"],
      ),
      specRoutes: fuseAddRmsNorm
        ? []
        : resolveSpecRoutes([
            { from: "ub", to: "l2", engine: "mte3" },
            { from: "l2", to: "ub", engine: "mte2" },
          ]),
      evidenceIds: ["HW-S02", "HW-S03"],
      evidenceSummaries: resolveEvidenceSummaries(["HW-S02", "HW-S03"]),
      is950DirectExtension: false,
      residencySummary: fuseAddRmsNorm
        ? "残差相加结果驻留在 UB 内直接进入 RMSNorm 规约与缩放，中间张量不落盘 GM/L2。"
        : "未融合时 Add 结果经 MTE3 写回 GM/L2，再由下一算子经 AIV·MTE2 重读进 UB 计算 RMSNorm。",
      boundaryNote: fuseAddRmsNorm
        ? "算子融合省去 8,192 B/tile（2 Tile 共 16,384 B）核外 GM/L2 往返，使 Roofline 算术强度右移。"
        : "未融合产生额外 8,192 B/tile GM/L2 往返并加剧 AIV·MTE2/MTE3 流水争用。",
    },
    {
      stepNumber: 6,
      id: "aiv-mte3-store",
      title: "⑥ 写回最终结果（AIV·UB → MTE3 → GM/L2）",
      engine: "AIV·MTE3",
      fromParts: assertSpecPartIds(["ub"]),
      toParts: assertSpecPartIds(["l2", "hbm[1]"]),
      activeParts: assertSpecPartIds(["ub", "mte3", "l2", "hbm[1]"]),
      specRoutes: resolveSpecRoutes([
        { from: "ub", to: "l2", engine: "mte3" },
        { from: "l2", to: "hbm[1]" },
      ]),
      evidenceIds: ["HW-S03", "HW-S04"],
      evidenceSummaries: resolveEvidenceSummaries(["HW-S03", "HW-S04"]),
      is950DirectExtension: false,
      residencySummary: "AIV·MTE3 将归一化后的最终输出分块从 UB 写回核外 L2 / HBM 激活区。",
      boundaryNote: "对应硬件概念剖面路径 ub → l2 (MTE3) → hbm[1]，不代表实机物理地址分配。",
    },
  ];
}

const GM_COMPARISON_TABLE: readonly GmComparisonRow[] = [
  {
    id: "910b-unfused",
    label: "910B 分离核 · 未融合（基线）",
    arch: "910b",
    fuseAddRmsNorm: false,
    bytes: computeGmByteBreakdown("910b", false),
  },
  {
    id: "910b-fused",
    label: "910B 分离核 + AddRMSNorm 融合",
    arch: "910b",
    fuseAddRmsNorm: true,
    bytes: computeGmByteBreakdown("910b", true),
  },
  {
    id: "950-unfused",
    label: "昇腾 950 片上直通 · 未融合",
    arch: "950",
    fuseAddRmsNorm: false,
    bytes: computeGmByteBreakdown("950", false),
  },
  {
    id: "950-fused",
    label: "昇腾 950 片上直通 + AddRMSNorm 融合",
    arch: "950",
    fuseAddRmsNorm: true,
    bytes: computeGmByteBreakdown("950", true),
  },
];

export function simulateAiCoreLab(partial?: Partial<AiCoreLabInput>): AiCoreLabResult {
  const input: AiCoreLabInput = {
    arch: partial?.arch ?? DEFAULT_AICORE_LAB_INPUT.arch,
    doubleBuffer: partial?.doubleBuffer ?? DEFAULT_AICORE_LAB_INPUT.doubleBuffer,
    fuseAddRmsNorm: partial?.fuseAddRmsNorm ?? DEFAULT_AICORE_LAB_INPUT.fuseAddRmsNorm,
    quantFormat: partial?.quantFormat ?? DEFAULT_AICORE_LAB_INPUT.quantFormat,
    outlierCh64: Math.max(
      OUTLIER_RANGE.min,
      Math.min(OUTLIER_RANGE.max, partial?.outlierCh64 ?? DEFAULT_AICORE_LAB_INPUT.outlierCh64),
    ),
  };

  const is950 = input.arch === "950";
  const { segments, spanUnits } = buildSingleTileSegments(input.arch, input.fuseAddRmsNorm);
  const t1StartUnit = input.doubleBuffer ? computeSafePingPongLag(segments) : spanUnits + 2;
  const totalRelativeSpanUnits = t1StartUnit + spanUnits;

  const laneBlocks = new Map<SwimlaneId, SwimlaneBlock[]>();
  const allLanes: readonly SwimlaneId[] = [
    "aic-mte2",
    "aic-mte1",
    "aic-cube",
    "handoff",
    "aiv-mte2",
    "aiv-vector",
    "aiv-mte3",
  ];
  for (const id of allLanes) laneBlocks.set(id, []);

  for (const tile of ["T0", "T1"] as const) {
    const offset = tile === "T0" ? 0 : t1StartUnit;
    const slotTag: "Ping" | "Pong" | undefined = input.doubleBuffer
      ? tile === "T0"
        ? "Ping"
        : "Pong"
      : undefined;
    for (const seg of segments) {
      const startUnit = offset + seg.start;
      laneBlocks.get(seg.lane)!.push({
        id: `${tile}-${seg.lane}-${seg.key}`,
        tile,
        kind: "work",
        slotTag,
        label: `${tile} ${seg.label}`,
        startUnit,
        durationUnit: seg.duration,
        leftPct: toPct(startUnit),
        widthPct: toPct(seg.duration),
        tone: seg.tone,
        readsMatmulOutputFromGm: seg.readsMatmulOutputFromGm,
      });
    }
  }

  let bubbleUnits = 0;
  const addStall = (lane: SwimlaneId, startUnit: number, endUnit: number, label: string) => {
    const dur = endUnit - startUnit;
    if (dur < 3) return;
    bubbleUnits += dur;
    laneBlocks.get(lane)!.push({
      id: `stall-${lane}`,
      tile: "T1",
      kind: "stall",
      label,
      startUnit,
      durationUnit: dur,
      leftPct: toPct(startUnit),
      widthPct: toPct(dur),
      tone: "warn",
    });
  };

  // Explicit serial/backpressure stall bubbles on AIC·MTE2 and AIC·Cube between T0 and T1.
  addStall("aic-mte2", 8, t1StartUnit, input.doubleBuffer ? "AIV 未融合反压" : "串行等 T0 释放单槽");
  addStall("aic-cube", 21, t1StartUnit + 12, input.doubleBuffer ? "等待下游反压" : "等待 T1 备料气泡");

  for (const blocks of laneBlocks.values()) {
    blocks.sort((a, b) => a.startUnit - b.startUnit);
  }

  const tracks: SwimlaneTrack[] = [
    {
      id: "aic-mte2",
      label: "AIC·MTE2 → L1",
      domain: "aic",
      engineLabel: "MTE2 (AIC)",
      specPartIds: assertSpecPartIds(["l2", "mte2", "l1"]),
      blocks: laneBlocks.get("aic-mte2")!,
    },
    {
      id: "aic-mte1",
      label: "AIC·MTE1 → L0A/L0B",
      domain: "aic",
      engineLabel: "MTE1 (AIC)",
      specPartIds: assertSpecPartIds(["l1", "mte1", "l0a", "l0b"]),
      blocks: laneBlocks.get("aic-mte1")!,
    },
    {
      id: "aic-cube",
      label: "AIC·Cube (MMAD→L0C)",
      domain: "aic",
      engineLabel: "Cube",
      specPartIds: assertSpecPartIds(["l0a", "l0b", "cube", "l0c"]),
      blocks: laneBlocks.get("aic-cube")!,
    },
    {
      id: "handoff",
      label: is950 ? "950·L0C → UB" : "AIC·FixPipe → GM/L2",
      domain: is950 ? "bridge" : "aic",
      engineLabel: is950 ? "L0C→UB 直通" : "FixPipe",
      specPartIds: assertSpecPartIds(is950 ? ["l0c", "ub"] : ["l0c", "fixpipe", "l2"]),
      blocks: laneBlocks.get("handoff")!,
    },
    {
      id: "aiv-mte2",
      label: "AIV·MTE2 (GM/L2→UB)",
      domain: "aiv",
      engineLabel: "MTE2 (AIV)",
      specPartIds: assertSpecPartIds(["l2", "mte2", "ub"]),
      blocks: laneBlocks.get("aiv-mte2")!,
      note: is950 ? "950 免经 GM/L2 重读 Matmul 结果（仅取残差 / 未融合中间态）" : undefined,
    },
    {
      id: "aiv-vector",
      label: "AIV·Vector (Add+RMSNorm)",
      domain: "aiv",
      engineLabel: "Vector",
      specPartIds: assertSpecPartIds(["ub", "vector"]),
      blocks: laneBlocks.get("aiv-vector")!,
    },
    {
      id: "aiv-mte3",
      label: "AIV·MTE3 (UB→GM)",
      domain: "aiv",
      engineLabel: "MTE3 (AIV)",
      specPartIds: assertSpecPartIds(["ub", "mte3", "l2"]),
      blocks: laneBlocks.get("aiv-mte3")!,
    },
  ];

  const aivMte2Track = tracks.find((t) => t.id === "aiv-mte2")!;
  const aivMte2ReadsMatmulFromGm = aivMte2Track.blocks.some(
    (b) => b.kind === "work" && b.readsMatmulOutputFromGm === true,
  );

  const gmBytes = computeGmByteBreakdown(input.arch, input.fuseAddRmsNorm);
  const roofline = computeRooflineResponse(input.arch, input.doubleBuffer, input.fuseAddRmsNorm);
  const quantization = evaluateOutlierQuantization(input.quantFormat, input.outlierCh64);
  const bufferSteps = buildBufferSteps(input.arch, input.fuseAddRmsNorm);

  const archNote = is950
    ? "昇腾 950 (A5 CV 融合)：L0C → UB 片上直通，AIV·MTE2 无需从核外 GM/L2 重读 Matmul 输出，真实削减核外字节并使 Roofline 算术强度右移。"
    : "910B 分离核 (Atlas A2/A3)：AIC 与 AIV 拥有各自独立的 MTE2 搬运泳道；Cube 累加结果必须经 FixPipe 落回核外 GM/L2，再由 AIV·MTE2 搬入 UB。";

  return {
    input,
    schematicBadge: SCHEMATIC_TIMING_BADGE,
    tracks,
    totalRelativeSpanUnits,
    bubbleUnits,
    t1StartUnit,
    usesExternalGmForMatmulHandoff: !is950,
    aivMte2ReadsMatmulFromGm,
    archNote,
    gmBytes,
    gmComparisonTable: GM_COMPARISON_TABLE,
    roofline,
    quantization,
    bufferSteps,
    npuSpecId: NPU_910B.id,
    npuSpecName: NPU_910B.name,
  };
}

// ─── Ascend 910B3 真机 msprof 实测对标数据 [M]（与上方示意泳道物理隔离）────────

export interface MeasuredOperatorBenchmark {
  readonly id: "bf16-add-rmsnorm" | "bf16-matmul-v3" | "w8a8-dynamic-quant" | "w8a8-quant-batch-matmul-v3";
  readonly group: "bf16" | "w8a8";
  readonly opName: string;
  readonly kernelName: string;
  readonly coreAndBlocks: string;
  readonly durationUs: number;
  readonly durationRangeUs: readonly [number, number];
  readonly keyCounters: string;
  readonly engineeringNote: string;
}

export interface MeasuredTp4StepEntry {
  readonly id: "tp4-matmul-v3" | "tp4-hcom-allreduce" | "tp4-add-rmsnorm";
  readonly opName: string;
  readonly coreType: "AI_CORE" | "COMMUNICATION" | "AI_VECTOR_CORE";
  readonly durationUs: number;
  readonly detail: string;
  readonly tone: "compute" | "comm" | "vector";
}

export interface Ascend910b3MeasuredBenchmarks {
  readonly evidenceTag: "[M]";
  readonly title: string;
  readonly hardwareLabel: string;
  readonly softwareStack: string;
  readonly shapeLabel: string;
  readonly sampleNote: string;
  readonly singleCardOperators: readonly MeasuredOperatorBenchmark[];
  readonly w8a8SpeedupSummary: {
    readonly gemmOnlyRatio: number;
    readonly withDynamicQuantRatio: number;
    readonly fullBlockWithNormRatio: number;
    readonly bf16GemmUs: number;
    readonly w8a8GemmUs: number;
    readonly w8a8QuantPlusGemmUs: number;
    readonly bf16FullBlockUs: number;
    readonly w8a8FullBlockUs: number;
    readonly takeaway: string;
  };
  readonly tp4CommChain: {
    readonly shapeNote: string;
    readonly tp1ComputePlusNormUs: number;
    readonly tp4TotalChainUs: number;
    readonly computeSavedUs: number;
    readonly overlappedCommUs: number;
    readonly hccsBandwidthRangeGBs: readonly [number, number];
    readonly hccsTransitMB: number;
    readonly tensorSizeMiB: number;
    readonly steps: readonly MeasuredTp4StepEntry[];
    readonly boundaryNote: string;
  };
  readonly rawSources: readonly string[];
}

export const ASCEND_910B3_MEASURED_BENCHMARKS: Ascend910b3MeasuredBenchmarks = {
  evidenceTag: "[M]",
  title: "Ascend 910B3 真机算子与 TP=4 通信实测对标 [M]",
  hardwareLabel: "Ascend 910B3 (Atlas A2 · 20 AIC / 40 AIV)",
  softwareStack: "HDK 25.5.0 · CANN 9.1.0 · torch_npu 2.10.0.post7 · vllm-ascend 0.30.0",
  shapeLabel: "M=2048, K=4096, N=4096",
  sampleNote: "msprof 设备 kernel 3 次活跃采样均值（Steps 2–4）；与上方示意相对时序沙盘独立对照",
  singleCardOperators: [
    {
      id: "bf16-add-rmsnorm",
      group: "bf16",
      opName: "BF16 AddRmsNorm",
      kernelName: "aclnnAddRmsNorm_AddRmsNorm_AddRmsNorm",
      coreAndBlocks: "AI_VECTOR_CORE / 40",
      durationUs: 63.58,
      durationRangeUs: [63.04, 64.0],
      keyCounters: "Vec 74.6% / MTE2 18.6% / MTE3 26.9%（3 次均值）",
      engineeringNote:
        "大 token 融合残差归一化下，FP32 平方均值与 rsqrt 向量算术占 AIV 主导，并非 MTE2 搬运占满。",
    },
    {
      id: "bf16-matmul-v3",
      group: "bf16",
      opName: "BF16 MatMulV3",
      kernelName: "aclnnMatmul_MatMulV3Common_MatMulV3",
      coreAndBlocks: "AI_CORE / 20",
      durationUs: 256.61,
      durationRangeUs: [256.12, 257.1],
      keyCounters: "Cube util 96.9% · MAC 95.4% 与 MTE2 82.4% 流水重叠",
      engineeringNote:
        "MAC 与 MTE2 同时高占比印证计算与数据搬运硬件流水重叠，不能拆成互斥墙钟份额；cube_utilization 与 aic_mac_ratio 为不同列。",
    },
    {
      id: "w8a8-dynamic-quant",
      group: "w8a8",
      opName: "W8A8 DynamicQuant",
      kernelName: "aclnnDynamicQuantV2_DynamicQuant_DynamicQuant",
      coreAndBlocks: "AI_VECTOR_CORE / 40",
      durationUs: 31.79,
      durationRangeUs: [31.28, 32.8],
      keyCounters: "AIV Vec 79.8% / MTE2 23.7%（写出 INT8 激活 + per-token scale）",
      engineeringNote: "未与前序归一化融合时，独立 DynamicQuant 多出一次核外 GM/L2 读写往返。",
    },
    {
      id: "w8a8-quant-batch-matmul-v3",
      group: "w8a8",
      opName: "W8A8 QuantBatchMatmulV3",
      kernelName: "aclnnQuantMatmulV5_QuantBatchMatmulV3_QuantBatchMatmulV3",
      coreAndBlocks: "MIX_AIC / 20+20",
      durationUs: 195.61,
      durationRangeUs: [193.56, 197.34],
      keyCounters: "Cube util 91.2%~92.8% · MAC 67.1% / MTE2 91.9%",
      engineeringNote:
        "单看纯 GEMM 较 BF16 提速 1.312x，但计入独立 DynamicQuant（+31.79µs）后净提速降至 1.128x。",
    },
  ],
  w8a8SpeedupSummary: {
    gemmOnlyRatio: 1.312,
    withDynamicQuantRatio: 1.128,
    fullBlockWithNormRatio: 1.095,
    bf16GemmUs: 256.61,
    w8a8GemmUs: 195.61,
    w8a8QuantPlusGemmUs: 227.4,
    bf16FullBlockUs: 320.19,
    w8a8FullBlockUs: 292.45,
    takeaway:
      "纯 GEMM 提速 1.312x（256.61 → 195.61µs），但未融合独立 DynamicQuant（31.79µs）把两算子合计提速压缩至 1.128x（含两侧实测 AddRmsNorm 整段为 1.095x），直接印证算子融合削减核外往返的价值。",
  },
  tp4CommChain: {
    shapeNote: "TP=4 行并行 [2048, 1024] × [4096, 1024]ᵀ → [2048, 4096] BF16 (16 MiB · 两步一致均值)",
    tp1ComputePlusNormUs: 320.19,
    tp4TotalChainUs: 665.47,
    computeSavedUs: 186.04,
    overlappedCommUs: 0,
    hccsBandwidthRangeGBs: [17.63, 17.93],
    hccsTransitMB: 25.17,
    tensorSizeMiB: 16,
    steps: [
      {
        id: "tp4-matmul-v3",
        opName: "MatMulV3",
        coreType: "AI_CORE",
        durationUs: 70.57,
        detail: "AI_CORE / 20 · Cube util 95.5%（两步均值，单步 70.66 / 70.48µs，较单卡省 ~186µs）",
        tone: "compute",
      },
      {
        id: "tp4-hcom-allreduce",
        opName: "hcom_allReduce_",
        coreType: "COMMUNICATION",
        durationUs: 523.88,
        detail:
          "未重叠通信（Overlapped 0.0µs，两步均值，单步 525.10 / 522.66µs）· HCCS 通信矩阵边样本带宽 17.63~17.93 GB/s（聚合 op 带宽 17.71~17.74 GB/s，25.17 MB transit）",
        tone: "comm",
      },
      {
        id: "tp4-add-rmsnorm",
        opName: "AddRmsNorm",
        coreType: "AI_VECTOR_CORE",
        durationUs: 71.02,
        detail: "AI_VECTOR_CORE / 40 · Vec 67.3% / MTE2 27.2%（两步均值，单步 71.14 / 70.90µs）",
        tone: "vector",
      },
    ],
    boundaryNote:
      "测量边界：此处为 2,048 行（16 MiB 输出）独立 HCCL 微基准，采用两步一致均值（单步和 666.90 / 664.04µs，两步均值 70.57 + 523.88 + 71.02 = 665.47µs，较单卡 320.19µs 劣化 2.08x）；17.63~17.93 GB/s 为通信矩阵边样本带宽（聚合 op 带宽 17.71~17.74 GB/s）。在线 c=1 Decode 单次归约仅 8 KiB，不可把 523.88µs × 72 机械套入单 token 账本。",
  },
  rawSources: [
    "raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L260-L292",
    "raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L935-L950",
  ],
};
