import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { getPresetSpec } from "../../sim/modelspec/presets";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { type EduBadgeTone, WikiEduSandboxShell } from "./WikiEduSandboxShell";

function tokenBtnStyle(active: boolean, kind: "dark" | "teal" = "teal") {
  if (!active) {
    return {
      background: "var(--color-surface-elevated)",
      borderColor: "var(--color-line)",
      color: "var(--color-ink)",
    } as const;
  }
  const bg = kind === "dark" ? "var(--color-ink)" : "var(--color-token)";
  return {
    background: bg,
    borderColor: bg,
    color: "var(--color-ink-inverse)",
  } as const;
}

export const TP_TWO_SPLITS_APPROVED_SHA256 =
  "6b052447b3b3e719c4d56c58318356b337dc94f04821ca5ac2baae877dec59fd";
export const TENSOR_PARALLEL_TWO_SPLITS_APPROVED_SHA256 = TP_TWO_SPLITS_APPROVED_SHA256;

export const TP_VIEW_MODES = ["matrix", "gqa"] as const;
export type TpViewMode = (typeof TP_VIEW_MODES)[number];

export const TP_PAIRING_MODES = ["col-then-row", "row-first-trap", "single-gemm"] as const;
export type TpPairingMode = (typeof TP_PAIRING_MODES)[number];
export const TP_STEPS = [1, 2, 3, 4] as const;
export type TpStep = (typeof TP_STEPS)[number];
export type TpSandboxMode = "sandbox" | "svg";

export const TP_GQA_MODELS = ["qwen3-30b-a3b", "qwen3-8b"] as const;
export type TpGqaModelId = (typeof TP_GQA_MODELS)[number];
export const TP_GQA_SIZES = [2, 4, 8] as const;
export type TpGqaSize = (typeof TP_GQA_SIZES)[number];

export const TP_GQA_BLOCK_SIZE = 128;
export const TP_GQA_BF16_BYTES = 2;

/**
 * 对应 vllm@ced6857afa0ea7b2e3f0846a62e1394e90f15607:vllm/distributed/utils.py#L53-L64：
 * 非整除时直接抛错，严禁向上取整或截断。
 */
export function divide(numerator: number, denominator: number): number {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0 ||
    numerator % denominator !== 0
  ) {
    throw new Error(`${numerator} is not divisible by ${denominator}`);
  }
  return numerator / denominator;
}

export interface TpGqaModelOverrides {
  readonly totalQHeads?: number;
  readonly totalKvHeads?: number;
  readonly headDim?: number;
  readonly numLayers?: number;
  readonly blockSize?: number;
  readonly dtypeBytes?: number;
  readonly modelName?: string;
}

export interface TpGqaRankAssignment {
  readonly tpRank: number;
  readonly qHeadStart: number;
  readonly qHeadEnd: number;
  readonly localQHeads: number;
  readonly localKvHeads: number;
  readonly kvHeadIndices: readonly number[];
  readonly shardRank: number;
}

export interface TpGqaReplicationState {
  readonly modelId: TpGqaModelId;
  readonly modelName: string;
  readonly tpSize: number;
  readonly totalQHeads: number;
  readonly totalKvHeads: number;
  readonly headDim: number;
  readonly numLayers: number;
  readonly blockSize: number;
  readonly dtypeBytes: number;
  readonly localQHeads: number;
  readonly localKvHeads: number;
  readonly numKvHeadReplicas: number;
  readonly isKvReplicated: boolean;
  readonly isFloorHit: boolean;
  readonly perCardSingleLayerBlockBytes: number;
  readonly perCardAllLayersBlockBytes: number;
  readonly groupAllLayersBlockBytes: number;
  readonly perCardSingleLayerBlockKiB: number;
  readonly perCardAllLayersBlockMiB: number;
  readonly groupAllLayersBlockMiB: number;
  readonly rankAssignments: readonly TpGqaRankAssignment[];
  readonly rankKvHeadIndices: readonly number[];
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detailTitle: string;
  readonly detailBody: string;
}

function formatCleanDecimal(val: number): string {
  return Number.isInteger(val) ? `${val}` : `${Number(val.toFixed(2))}`;
}

/**
 * 严格对齐 vllm@ced6857afa0ea7b2e3f0846a62e1394e90f15607:
 * vllm/model_executor/layers/linear.py#L1045-L1060 与 #L1295-L1304。
 */
export function computeTpGqaReplicationState(
  modelId: TpGqaModelId = "qwen3-30b-a3b",
  tpSize: TpGqaSize | number = 4,
  overrides?: TpGqaModelOverrides,
): TpGqaReplicationState {
  const spec = getPresetSpec(modelId);
  const attn = spec.layers[0]?.attention;
  if (!attn) throw new Error(`模型 ${modelId} 缺少注意力层规格`);

  const totalQHeads = overrides?.totalQHeads ?? attn.numHeads;
  const totalKvHeads = overrides?.totalKvHeads ?? attn.numKvHeads;
  const headDim = overrides?.headDim ?? attn.headDim;
  const numLayers = overrides?.numLayers ?? spec.numLayers;
  const blockSize = overrides?.blockSize ?? TP_GQA_BLOCK_SIZE;
  const dtypeBytes = overrides?.dtypeBytes ?? spec.bytesPerParam;
  const modelName = overrides?.modelName ?? spec.name;

  if (!Number.isSafeInteger(tpSize) || tpSize < 1) {
    throw new Error(`非法 tpSize: ${tpSize}`);
  }

  const localQHeads = divide(totalQHeads, tpSize);
  let localKvHeads: number;
  let numKvHeadReplicas: number;
  if (tpSize >= totalKvHeads) {
    localKvHeads = 1;
    numKvHeadReplicas = divide(tpSize, totalKvHeads);
  } else {
    localKvHeads = divide(totalKvHeads, tpSize);
    numKvHeadReplicas = 1;
  }

  const isKvReplicated = tpSize > totalKvHeads;
  const isFloorHit = tpSize >= totalKvHeads;

  const rankAssignments: TpGqaRankAssignment[] = Array.from({ length: tpSize }, (_, tpRank) => {
    const qHeadStart = tpRank * localQHeads;
    const qHeadEnd = qHeadStart + localQHeads - 1;
    if (tpSize >= totalKvHeads) {
      const shardRank = Math.floor(tpRank / numKvHeadReplicas);
      return {
        tpRank,
        qHeadStart,
        qHeadEnd,
        localQHeads,
        localKvHeads,
        kvHeadIndices: [shardRank],
        shardRank,
      };
    }
    const kvHeadIndices = Array.from({ length: localKvHeads }, (_, i) => tpRank * localKvHeads + i);
    return {
      tpRank,
      qHeadStart,
      qHeadEnd,
      localQHeads,
      localKvHeads,
      kvHeadIndices,
      shardRank: tpRank,
    };
  });

  const rankKvHeadIndices = rankAssignments.map((r) => r.kvHeadIndices[0] ?? 0);
  const perCardSingleLayerBlockBytes = blockSize * localKvHeads * headDim * 2 * dtypeBytes;
  const perCardAllLayersBlockBytes = perCardSingleLayerBlockBytes * numLayers;
  const groupAllLayersBlockBytes = perCardAllLayersBlockBytes * tpSize;

  const perCardSingleLayerBlockKiB = perCardSingleLayerBlockBytes / 1024;
  const perCardAllLayersBlockMiB = perCardAllLayersBlockBytes / (1024 * 1024);
  const groupAllLayersBlockMiB = groupAllLayersBlockBytes / (1024 * 1024);
  const perCardMiBStr = formatCleanDecimal(perCardAllLayersBlockMiB);
  const groupMiBStr = formatCleanDecimal(groupAllLayersBlockMiB);

  let takeawayBadge: string;
  let takeawayTone: EduBadgeTone;
  let takeaway: string;
  if (isKvReplicated) {
    takeawayBadge = `跨卡复制拐点 · 并行度大于 KV 头数 (${tpSize} > ${totalKvHeads})`;
    takeawayTone = "warn";
    takeaway = `Q 头减半，每 ${numKvHeadReplicas} 张卡各留同一个 KV 头，每卡仍占 ${perCardMiBStr} MiB（全组翻倍至 ${groupMiBStr} MiB）。`;
  } else if (tpSize === totalKvHeads) {
    takeawayBadge = `触底临界 · 并行度等于 KV 头数 (${tpSize} = ${totalKvHeads})`;
    takeawayTone = "default";
    takeaway = `每卡刚好驻留 1 个完整 KV 头（零复制，每卡 ${perCardMiBStr} MiB）；若再把 TP 翻倍，单卡 KV 显存不再缩小。`;
  } else {
    takeawayBadge = `正常等分 · 并行度小于 KV 头数 (${tpSize} < ${totalKvHeads})`;
    takeawayTone = "accent";
    takeaway = `KV 头足够按卡切分（每卡 ${localKvHeads} 个 KV 头），卡数翻倍时 Q 头与单卡 KV 显存同步减半（每卡 ${perCardMiBStr} MiB）。`;
  }

  const kpi = isKvReplicated
    ? `每卡 ${perCardMiBStr} MiB/块 · ${numKvHeadReplicas}× 复制`
    : `每卡 ${perCardMiBStr} MiB/块`;

  return {
    modelId,
    modelName,
    tpSize,
    totalQHeads,
    totalKvHeads,
    headDim,
    numLayers,
    blockSize,
    dtypeBytes,
    localQHeads,
    localKvHeads,
    numKvHeadReplicas,
    isKvReplicated,
    isFloorHit,
    perCardSingleLayerBlockBytes,
    perCardAllLayersBlockBytes,
    groupAllLayersBlockBytes,
    perCardSingleLayerBlockKiB,
    perCardAllLayersBlockMiB,
    groupAllLayersBlockMiB,
    rankAssignments,
    rankKvHeadIndices,
    takeawayBadge,
    takeawayTone,
    takeaway,
    kpi,
    detailTitle: `${modelName} · TP=${tpSize} GQA 分头与 KV 页字节账本`,
    detailBody: `${modelName} 共 ${numLayers} 层、${totalQHeads}Q:${totalKvHeads}KV、显式 head_dim=${headDim}（BF16 2 B，128-token 块、K+V 双份）。按 QKVParallelLinear（tp_size >= total_num_kv_heads 时每卡驻留 1 个 KV 头且 replicas = TP / n_kv，按 tp_rank // replicas 选分片；否则每卡 n_kv / TP 个 KV 头、replicas = 1），单层每块 = ${perCardSingleLayerBlockBytes.toLocaleString("en-US")} B（${formatCleanDecimal(perCardSingleLayerBlockKiB)} KiB），全 ${numLayers} 层单卡 = ${perCardAllLayersBlockBytes.toLocaleString("en-US")} B（${perCardMiBStr} MiB），全组 ${tpSize} 卡合计 = ${groupMiBStr} MiB（不含分配器填充与权重）。`,
  };
}

/**
 * 权重形状遵循全站统一约定 [in, out]（y = x·W），与 HF checkpoint 的 [out, in] 转置相反。
 */
export const TP_CANONICAL_X: readonly [number, number] = [1, 2];
export const TP_CANONICAL_W1: readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
] = [
  [1, 3, -1, 2],
  [2, -1, 2, -2],
];
export const TP_CANONICAL_W2: readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
] = [
  [1, 0],
  [2, 1],
  [1, 1],
  [1, 2],
];

export function formatTpNum(val: number, decimals?: number): string {
  const clean = Math.abs(val) < 1e-9 ? 0 : val;
  const absStr =
    decimals !== undefined
      ? Math.abs(clean).toFixed(decimals)
      : Math.abs(clean - Math.round(clean)) < 1e-6
        ? `${Math.round(Math.abs(clean))}`
        : Math.abs(clean).toFixed(2);
  return clean < 0 ? `−${absStr}` : absStr;
}

export function formatTpVec(vec: readonly number[], decimals?: number): string {
  return `[${vec.map((v) => formatTpNum(v, decimals)).join(", ")}]`;
}

export function reluVec(vec: readonly number[]): number[] {
  return vec.map((v) => Math.max(0, v));
}

export function siluScalar(z: number): number {
  return z / (1 + Math.exp(-z));
}

export interface TpInteractiveStateSnapshot {
  readonly mode: TpSandboxMode;
  readonly viewMode: TpViewMode;
  readonly pairingMode: TpPairingMode;
  readonly step: TpStep;
  readonly playing: boolean;
}

export function reduceTpViewSwitch(
  state: TpInteractiveStateSnapshot,
  nextView: TpViewMode,
): TpInteractiveStateSnapshot {
  return {
    ...state,
    mode: "sandbox",
    viewMode: nextView,
    playing: false,
  };
}

export function advanceTpStepTick(state: TpInteractiveStateSnapshot): TpInteractiveStateSnapshot {
  if (!state.playing || state.mode !== "sandbox" || state.viewMode !== "matrix") {
    return state;
  }
  if (state.step >= 4) {
    return { ...state, step: 4, playing: false };
  }
  const next = (state.step + 1) as TpStep;
  return {
    ...state,
    step: next,
    playing: next < 4,
  };
}

export interface TpSandboxComputedState {
  readonly pairingMode: TpPairingMode;
  readonly step: TpStep;
  readonly x: readonly [number, number];
  readonly colCard0: readonly [number, number];
  readonly colCard1: readonly [number, number];
  readonly fullW1Out: readonly [number, number, number, number];
  readonly rowCard0: readonly [number, number, number, number];
  readonly rowCard1: readonly [number, number, number, number];
  readonly rowReducedSum: readonly [number, number, number, number];
  readonly colReluCard0: readonly [number, number];
  readonly colReluCard1: readonly [number, number];
  readonly trueRelu: readonly [number, number, number, number];
  readonly wrongRowReluCard0: readonly [number, number, number, number];
  readonly wrongRowReluCard1: readonly [number, number, number, number];
  readonly wrongRowFirstReluSum: readonly [number, number, number, number];
  readonly siluTrueCh3: number;
  readonly siluWrongSumCh3: number;
  readonly w2Card0Partial: readonly [number, number];
  readonly w2Card1Partial: readonly [number, number];
  readonly finalMlpOut: readonly [number, number];
  readonly wrongMlpOut: readonly [number, number];
  readonly commCount: 1 | 2;
  readonly shortStepBtns: readonly [string, string, string, string];
  readonly canvasHeading: string;
  readonly commPillText: string;
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detailTitle: string;
  readonly detailBody: string;
}

export function computeTpSandboxState(
  pairingMode: TpPairingMode = "col-then-row",
  step: TpStep = 4,
): TpSandboxComputedState {
  const x = TP_CANONICAL_X;
  const w1 = TP_CANONICAL_W1;
  const w2 = TP_CANONICAL_W2;

  const colCard0: readonly [number, number] = [
    x[0] * w1[0][0] + x[1] * w1[1][0],
    x[0] * w1[0][1] + x[1] * w1[1][1],
  ];
  const colCard1: readonly [number, number] = [
    x[0] * w1[0][2] + x[1] * w1[1][2],
    x[0] * w1[0][3] + x[1] * w1[1][3],
  ];
  const fullW1Out: readonly [number, number, number, number] = [
    colCard0[0],
    colCard0[1],
    colCard1[0],
    colCard1[1],
  ];

  const rowCard0: readonly [number, number, number, number] = [
    x[0] * w1[0][0],
    x[0] * w1[0][1],
    x[0] * w1[0][2],
    x[0] * w1[0][3],
  ];
  const rowCard1: readonly [number, number, number, number] = [
    x[1] * w1[1][0],
    x[1] * w1[1][1],
    x[1] * w1[1][2],
    x[1] * w1[1][3],
  ];
  const rowReducedSum: readonly [number, number, number, number] = [
    rowCard0[0] + rowCard1[0],
    rowCard0[1] + rowCard1[1],
    rowCard0[2] + rowCard1[2],
    rowCard0[3] + rowCard1[3],
  ];

  const colReluCard0: readonly [number, number] = [Math.max(0, colCard0[0]), Math.max(0, colCard0[1])];
  const colReluCard1: readonly [number, number] = [Math.max(0, colCard1[0]), Math.max(0, colCard1[1])];
  const trueRelu: readonly [number, number, number, number] = [
    colReluCard0[0],
    colReluCard0[1],
    colReluCard1[0],
    colReluCard1[1],
  ];

  const wrongRowReluCard0 = reluVec(rowCard0) as unknown as readonly [number, number, number, number];
  const wrongRowReluCard1 = reluVec(rowCard1) as unknown as readonly [number, number, number, number];
  const wrongRowFirstReluSum: readonly [number, number, number, number] = [
    wrongRowReluCard0[0] + wrongRowReluCard1[0],
    wrongRowReluCard0[1] + wrongRowReluCard1[1],
    wrongRowReluCard0[2] + wrongRowReluCard1[2],
    wrongRowReluCard0[3] + wrongRowReluCard1[3],
  ];

  const siluTrueCh3 = siluScalar(rowReducedSum[3]);
  const siluWrongSumCh3 = siluScalar(rowCard0[3]) + siluScalar(rowCard1[3]);

  const w2Card0Partial: readonly [number, number] = [
    colReluCard0[0] * w2[0][0] + colReluCard0[1] * w2[1][0],
    colReluCard0[0] * w2[0][1] + colReluCard0[1] * w2[1][1],
  ];
  const w2Card1Partial: readonly [number, number] = [
    colReluCard1[0] * w2[2][0] + colReluCard1[1] * w2[3][0],
    colReluCard1[0] * w2[2][1] + colReluCard1[1] * w2[3][1],
  ];
  const finalMlpOut: readonly [number, number] = [
    w2Card0Partial[0] + w2Card1Partial[0],
    w2Card0Partial[1] + w2Card1Partial[1],
  ];
  const wrongMlpOut: readonly [number, number] = [
    wrongRowFirstReluSum[0] * w2[0][0] +
      wrongRowFirstReluSum[1] * w2[1][0] +
      wrongRowFirstReluSum[2] * w2[2][0] +
      wrongRowFirstReluSum[3] * w2[3][0],
    wrongRowFirstReluSum[0] * w2[0][1] +
      wrongRowFirstReluSum[1] * w2[1][1] +
      wrongRowFirstReluSum[2] * w2[2][1] +
      wrongRowFirstReluSum[3] * w2[3][1],
  ];

  if (pairingMode === "col-then-row") {
    const shortStepBtns = ["① 列切", "② 本地激活", "③ 行切", "④ 1次归约"] as const;
    const stepMeta = {
      1: {
        badge: "步骤 1 / 4 · 列切产出完整通道真值",
        tone: "default" as EduBadgeTone,
        takeaway: `两卡同拿完整输入：卡 0 得 ${formatTpVec(colCard0)}，卡 1 得 ${formatTpVec(colCard1)}，均已是完整点积真值（0 通信）。`,
        kpi: `卡0 ${formatTpVec(colCard0)} · 卡1 ${formatTpVec(colCard1)}`,
        detailTitle: "动作 ① · ColumnParallelLinear 沿输出维切分",
        detailBody: `权重按 [in, out] 约定记为 W₁[2, 4]（与 HF checkpoint [out, in] 转置相反）。卡 0 算 [1×1+2×2, 1×3+2×(−1)] = [5, 1]，卡 1 算 [1×(−1)+2×2, 1×2+2×(−2)] = [3, −2]。`,
      },
      2: {
        badge: "步骤 2 / 4 · 逐通道非线性激活留在本卡",
        tone: "default" as EduBadgeTone,
        takeaway: `列切输出已是真值，非线性激活直接在本卡完成：卡 0 得 ${formatTpVec(colReluCard0)}，卡 1 得 ${formatTpVec(colReluCard1)}，零跨卡通信。`,
        kpi: `本地激活 ${formatTpVec(colReluCard0)} | ${formatTpVec(colReluCard1)}`,
        detailTitle: "动作 ② · 本地 ReLU / SiLU 或 Attention 各头本地计算",
        detailBody: `逐元素激活（ReLU/SiLU）或 Attention 各头独立算完本卡头输出均只用本地完整通道；卡 1 第 4 通道为 −2，本地算 ReLU(−2) = 0（SiLU(−2) ≈ ${formatTpNum(siluTrueCh3, 2)}），无需先 All-Gather。`,
      },
      3: {
        badge: "步骤 3 / 4 · 后一层按行切精准接住本地通道",
        tone: "accent" as EduBadgeTone,
        takeaway: `第二层权重按输入行切分：卡 0 得部分和 ${formatTpVec(w2Card0Partial)}，卡 1 得部分和 ${formatTpVec(w2Card1Partial)}，依然 0 通信。`,
        kpi: `部分和 ${formatTpVec(w2Card0Partial)} + ${formatTpVec(w2Card1Partial)}`,
        detailTitle: "动作 ③ · RowParallelLinear 省去中间 All-Gather",
        detailBody: `卡 0 算 5×[1, 0] + 1×[2, 1] = [7, 1]，卡 1 算 3×[1, 1] + 0×[1, 2] = [3, 3]。列切缺的形状恰好由行切分段承接。`,
      },
      4: {
        badge: "步骤 4 / 4 · 整对矩阵仅末尾 1 次归约",
        tone: "accent" as EduBadgeTone,
        takeaway: `末尾仅做 1 次跨卡求和：${formatTpVec(w2Card0Partial)} + ${formatTpVec(w2Card1Partial)} = ${formatTpVec(finalMlpOut)}，与单卡结果完全一致。`,
        kpi: `输出 ${formatTpVec(finalMlpOut)} · 仅 1 次同步`,
        detailTitle: "动作 ④ · 成对配合闭合（稠密层每层固定 2 次归约）",
        detailBody: `单卡全量验算 ReLU([5, 1, 3, −2])·W₂ = [5, 1, 3, 0]·W₂ = [10, 4]；双卡 [7, 1] + [3, 3] = [10, 4]。落到 Qwen3-8B（36 层），Attention 与 MLP 各用一对“先列后行”，整层固定 2 次、全模型 72 次 All-Reduce。`,
      },
    }[step];
    return {
      pairingMode,
      step,
      x,
      colCard0,
      colCard1,
      fullW1Out,
      rowCard0,
      rowCard1,
      rowReducedSum,
      colReluCard0,
      colReluCard1,
      trueRelu,
      wrongRowReluCard0,
      wrongRowReluCard1,
      wrongRowFirstReluSum,
      siluTrueCh3,
      siluWrongSumCh3,
      w2Card0Partial,
      w2Card1Partial,
      finalMlpOut,
      wrongMlpOut,
      commCount: 1,
      shortStepBtns,
      canvasHeading: "成对配合：先列切 → 本地激活 → 后行切 → 跨卡求和",
      commPillText: "整块通信：1 次归约",
      takeawayBadge: stepMeta.badge,
      takeawayTone: stepMeta.tone,
      takeaway: stepMeta.takeaway,
      kpi: stepMeta.kpi,
      detailTitle: stepMeta.detailTitle,
      detailBody: stepMeta.detailBody,
    };
  }

  if (pairingMode === "row-first-trap") {
    const shortStepBtns = ["① 先行切", "② 直接激活", "③ 迫归约", "④ 多1次同步"] as const;
    const stepMeta = {
      1: {
        badge: "反例 1 / 4 · 若把第一层先按行切",
        tone: "warn" as EduBadgeTone,
        takeaway: `先行切后卡 0 得部分和 ${formatTpVec(rowCard0)}，卡 1 得部分和 ${formatTpVec(rowCard1)}，形状虽满 4 维，每个数却只加了一半。`,
        kpi: `部分和 ${formatTpVec(rowCard0)} vs ${formatTpVec(rowCard1)}`,
        detailTitle: "反例步骤 ① · 行切输出只是部分和（Partial Sum）",
        detailBody: `卡 0 仅算 1×[1, 3, −1, 2] = [1, 3, −1, 2]，卡 1 仅算 2×[2, −1, 2, −2] = [4, −2, 4, −4]。第 4 维真值本应是 2 + (−4) = −2，此刻拆在两张卡上。`,
      },
      2: {
        badge: "反例 2 / 4 · 非线性激活与跨卡求和不可交换",
        tone: "danger" as EduBadgeTone,
        takeaway: `直接各自激活再加得错和 ${formatTpVec(wrongRowFirstReluSum)} ≠ 真值 ${formatTpVec(trueRelu)}（继续算会错得 ${formatTpVec(wrongMlpOut)}）。`,
        kpi: `错和 ${formatTpVec(wrongRowFirstReluSum)} ≠ 真值 ${formatTpVec(trueRelu)}`,
        detailTitle: "反例步骤 ② · 严格反例：ReLU(a + b) ≠ ReLU(a) + ReLU(b)",
        detailBody: `卡 0 ReLU([1, 3, −1, 2]) = [1, 3, 0, 2]，卡 1 ReLU([4, −2, 4, −4]) = [4, 0, 4, 0]，相加得 [5, 3, 4, 2] ≠ ReLU([5, 1, 3, −2]) = [5, 1, 3, 0]；换 SiLU 同理：SiLU(2)+SiLU(−4) ≈ ${formatTpNum(siluWrongSumCh3, 2)} ≠ SiLU(−2) ≈ ${formatTpNum(siluTrueCh3, 2)}。`,
      },
      3: {
        badge: "反例 3 / 4 · 被迫在激活前插第 1 次归约",
        tone: "danger" as EduBadgeTone,
        takeaway: `为了不错算，两卡在激活前被迫先做第 1 次跨卡求和合齐 ${formatTpVec(rowReducedSum)}，才能算出正确激活 ${formatTpVec(trueRelu)}。`,
        kpi: `被迫插第 1 次归约 → ${formatTpVec(trueRelu)}`,
        detailTitle: "反例步骤 ③ · 激活前强制同步打断流水",
        detailBody: `线性变换满足 f(a+b)=f(a)+f(b)，但非线性激活（ReLU / GELU / SiLU）不满足。先行切迫使每层激活前停下等待跨卡归约。`,
      },
      4: {
        badge: "反例 4 / 4 · 末尾还要再归约，共 2 次跨卡同步",
        tone: "danger" as EduBadgeTone,
        takeaway: `算完第二层后仍需第 2 次跨卡通信才还原 ${formatTpVec(finalMlpOut)}，比成对配合多 1 次跨卡同步。`,
        kpi: "共 2 次通信 · 多 1 次同步",
        detailTitle: "反例步骤 ④ · 为什么主流模型固定“先列切、后行切”",
        detailBody: `每块从 1 次归约变成 2 次归约后，36 层稠密模型多出 36 次全组屏障同步。先列切拿真值、本地过激活（或各头本地计算）、再行切末尾 1 次归约，省掉中间同步。`,
      },
    }[step];
    return {
      pairingMode,
      step,
      x,
      colCard0,
      colCard1,
      fullW1Out,
      rowCard0,
      rowCard1,
      rowReducedSum,
      colReluCard0,
      colReluCard1,
      trueRelu,
      wrongRowReluCard0,
      wrongRowReluCard1,
      wrongRowFirstReluSum,
      siluTrueCh3,
      siluWrongSumCh3,
      w2Card0Partial,
      w2Card1Partial,
      finalMlpOut,
      wrongMlpOut,
      commCount: 2,
      shortStepBtns,
      canvasHeading: "先行切反例：直接激活必算错，多 1 次跨卡同步",
      commPillText: "被迫通信：2 次（多 1 次同步）",
      takeawayBadge: stepMeta.badge,
      takeawayTone: stepMeta.tone,
      takeaway: stepMeta.takeaway,
      kpi: stepMeta.kpi,
      detailTitle: stepMeta.detailTitle,
      detailBody: stepMeta.detailBody,
    };
  }

  const shortStepBtns = ["① 分法", "② 算局部", "③ 拼与加", "④ 同真值"] as const;
  const singleMeta = {
    1: {
      badge: "单矩阵对照 1 / 4 · 按输出列切 vs 按输入行切",
      tone: "default" as EduBadgeTone,
      takeaway: `同一乘法：列切时两卡同拿完整输入、各存两列权重；行切时各拿一半输入配各自权重行。`,
      kpi: "列切 [2, 2] vs 行切 [1, 4]",
      detailTitle: "单矩阵 ① · [in, out] 视角下的两种切分",
      detailBody: `全页按 y = x·W（权重 [in, out]）书写：沿输出维切即按列切（每卡负责一半输出通道），沿输入维切即按行切（每卡负责内积求和的一半加数）。`,
    },
    2: {
      badge: "单矩阵对照 2 / 4 · 数值完整形状半 vs 形状完整数值半",
      tone: "default" as EduBadgeTone,
      takeaway: `列切算出真值段 ${formatTpVec(colCard0)} 与 ${formatTpVec(colCard1)}；行切算出部分和 ${formatTpVec(rowCard0)} 与 ${formatTpVec(rowCard1)}。`,
      kpi: "列切真值段 vs 行切部分和",
      detailTitle: "单矩阵 ② · 为什么行切不能直接过激活",
      detailBody: `列切的 [5, 1] 与 [3, −2] 已含全部乘积项；行切卡 0 的 [1, 3, −1, 2] 缺了卡 1 的 [4, −2, 4, −4]，不归约就激活一定算错。`,
    },
    3: {
      badge: "单矩阵对照 3 / 4 · 全收集拼接 vs 全归约相加",
      tone: "accent" as EduBadgeTone,
      takeaway: `单次矩阵要集齐完整行时：列切按卡号拼接，行切把对应位置部分和逐项相加。`,
      kpi: "列切全收集 · 行切全归约",
      detailTitle: "单矩阵 ③ · 集合通信原语与偏置单次计入",
      detailBody: `恒等式：xW₁ = [xW₁[:,0:2], xW₁[:,2:4]] (All-Gather) = x₁W₁[0,:] + x₂W₁[1,:] (All-Reduce)。若行切层带偏置 b，只能加一次 b（P₀+P₁+b），不可两卡重复加。`,
    },
    4: {
      badge: "单矩阵对照 4 / 4 · 殊途同归得 [5, 1, 3, −2]",
      tone: "accent" as EduBadgeTone,
      takeaway: `拼接与相加都还原出 ${formatTpVec(fullW1Out)}；若后接按行切层，列切连这一次拼接也可省掉。`,
      kpi: `还原输出 ${formatTpVec(fullW1Out)}`,
      detailTitle: "单矩阵 ④ · 从单矩阵对照走向成对配合",
      detailBody: `单看一次矩阵乘各需 1 次通信；先列切后行切配合时，列切产出的真值分片刚好喂给本地激活与行切输入，省掉第一次 All-Gather。`,
    },
  }[step];

  return {
    pairingMode,
    step,
    x,
    colCard0,
    colCard1,
    fullW1Out,
    rowCard0,
    rowCard1,
    rowReducedSum,
    colReluCard0,
    colReluCard1,
    trueRelu,
    wrongRowReluCard0,
    wrongRowReluCard1,
    wrongRowFirstReluSum,
    siluTrueCh3,
    siluWrongSumCh3,
    w2Card0Partial,
    w2Card1Partial,
    finalMlpOut,
    wrongMlpOut,
    commCount: 1,
    shortStepBtns,
    canvasHeading: "单矩阵对照：列切拼接 vs 行切相加",
    commPillText: `真值 ${formatTpVec(fullW1Out)}`,
    takeawayBadge: singleMeta.badge,
    takeawayTone: singleMeta.tone,
    takeaway: singleMeta.takeaway,
    kpi: singleMeta.kpi,
    detailTitle: singleMeta.detailTitle,
    detailBody: singleMeta.detailBody,
  };
}

export interface TpTwoSplitsInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: TpSandboxMode | undefined;
  readonly initialViewMode?: TpViewMode | undefined;
  readonly initialPairingMode?: TpPairingMode | undefined;
  readonly initialStep?: TpStep | undefined;
  readonly initialGqaModel?: TpGqaModelId | undefined;
  readonly initialGqaTpSize?: TpGqaSize | undefined;
}

export function TpTwoSplitsInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialViewMode = "matrix",
  initialPairingMode = "col-then-row",
  initialStep = 4,
  initialGqaModel = "qwen3-30b-a3b",
  initialGqaTpSize = 4,
}: TpTwoSplitsInteractiveProps) {
  const [mode, setMode] = useState<TpSandboxMode>(initialMode);
  const [viewMode, setViewMode] = useState<TpViewMode>(initialViewMode);
  const [pairingMode, setPairingMode] = useState<TpPairingMode>(initialPairingMode);
  const [step, setStep] = useState<TpStep>(initialStep);
  const [gqaModel, setGqaModel] = useState<TpGqaModelId>(initialGqaModel);
  const [gqaTpSize, setGqaTpSize] = useState<TpGqaSize>(initialGqaTpSize);
  const [playing, setPlaying] = useState(false);

  const calc = useMemo(() => computeTpSandboxState(pairingMode, step), [pairingMode, step]);
  const gqaCalc = useMemo(() => computeTpGqaReplicationState(gqaModel, gqaTpSize), [gqaModel, gqaTpSize]);

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-tp-teal`;
  const mComm = `${id}-${uid}-tp-comm`;
  const mDanger = `${id}-${uid}-tp-danger`;
  const mKv = `${id}-${uid}-tp-kv`;

  useEffect(() => {
    if (!playing || mode !== "sandbox" || viewMode !== "matrix") return;
    if (step >= 4) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const ticked = advanceTpStepTick({ mode, viewMode, pairingMode, step, playing });
      setStep(ticked.step);
      setPlaying(ticked.playing);
    }, 1800);
    return () => clearTimeout(timer);
  }, [playing, mode, viewMode, pairingMode, step]);

  const switchView = (nextView: TpViewMode) => {
    const next = reduceTpViewSwitch({ mode, viewMode, pairingMode, step, playing }, nextView);
    setMode(next.mode);
    setViewMode(next.viewMode);
    setPlaying(next.playing);
  };

  const selectStep = (next: TpStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const selectPairingMode = (nextMode: TpPairingMode) => {
    setPlaying(false);
    setMode("sandbox");
    setPairingMode(nextMode);
    if (nextMode === "row-first-trap" && step === 4) {
      setStep(2);
    }
  };

  const togglePlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= 4) setStep(1);
    setPlaying(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    if (event.key === "0" || event.key === "Escape") {
      event.preventDefault();
      setPlaying(false);
      setMode("svg");
      return;
    }
    if (viewMode === "gqa") {
      const idx = TP_GQA_SIZES.indexOf(gqaTpSize);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setMode("sandbox");
        setGqaTpSize(TP_GQA_SIZES[Math.min(TP_GQA_SIZES.length - 1, idx + 1)]!);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setMode("sandbox");
        setGqaTpSize(TP_GQA_SIZES[Math.max(0, idx - 1)]!);
      }
      return;
    }
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        selectStep(Math.min(4, step + 1) as TpStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as TpStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as TpStep);
        break;
    }
  };

  const isGqaView = viewMode === "gqa";

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      useTokenVariables
      onToggleMode={(next) => {
        setPlaying(false);
        setMode(next);
      }}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag={isGqaView ? "母版 A · GQA 头分片与复制拐点" : "母版 A · 分步机制演化"}
      kickerTitle="张量并行（TP）两种切分与 GQA KV 复制拐点"
      question={
        isGqaView
          ? "卡数翻倍，每卡的 KV 还会减半吗？"
          : "为什么先按列切、本地算完、再按行切只通信 1 次，反过来却会算错或多 1 次跨卡同步？"
      }
      toolbarLabel={isGqaView ? "GQA 模型与 TP 卡数切换" : "TP 切分步进与视图切换"}
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-view-mode": viewMode,
        "data-pairing-mode": pairingMode,
        "data-step": step,
        "data-comm-count": isGqaView ? undefined : calc.commCount,
        "data-gqa-model": gqaModel,
        "data-gqa-tp": gqaTpSize,
        "data-gqa-replicas": gqaCalc.numKvHeadReplicas,
      }}
      toolbar={
        isGqaView ? (
          <>
            <fieldset className="wiki-edu-btn-row" aria-label="TP 视图切换">
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="tp-view-matrix"
                aria-label="矩阵演算"
                aria-pressed={false}
                style={tokenBtnStyle(false, "dark")}
                onClick={() => switchView("matrix")}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  矩阵
                </span>
                <span className="tp-wide-only">矩阵演算</span>
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="tp-view-gqa"
                aria-label="GQA 拐点"
                aria-pressed={mode === "sandbox"}
                style={tokenBtnStyle(mode === "sandbox", "dark")}
                onClick={() => switchView("gqa")}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  GQA
                </span>
                <span className="tp-wide-only">GQA 拐点</span>
              </button>
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="GQA 模型切换">
              {TP_GQA_MODELS.map((m) => {
                const active = mode === "sandbox" && gqaModel === m;
                const fullName = m === "qwen3-30b-a3b" ? "Qwen3-30B-A3B" : "Qwen3-8B";
                const compactName = m === "qwen3-30b-a3b" ? "30B" : "8B";
                return (
                  <button
                    key={m}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`tp-gqa-model-${m}`}
                    aria-label={fullName}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "teal")}
                    onClick={() => {
                      setMode("sandbox");
                      setGqaModel(m);
                    }}
                  >
                    <span className="tp-compact-only" aria-hidden="true">
                      {compactName}
                    </span>
                    <span className="tp-wide-only">{fullName}</span>
                  </button>
                );
              })}
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="TP 卡数切换">
              {TP_GQA_SIZES.map((tp) => {
                const active = mode === "sandbox" && gqaTpSize === tp;
                return (
                  <button
                    key={tp}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`tp-gqa-tp-${tp}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setGqaTpSize(tp);
                    }}
                  >
                    {`TP=${tp}`}
                  </button>
                );
              })}
            </fieldset>
          </>
        ) : (
          <>
            <div className="wiki-edu-btn-row">
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="tp-autoplay"
                aria-label={playing ? "暂停自动演示" : "自动演示"}
                aria-pressed={playing}
                style={tokenBtnStyle(playing, "teal")}
                onClick={togglePlay}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  {playing ? "⏸" : "▶"}
                </span>
                <span className="tp-wide-only">{playing ? "⏸ 暂停" : "▶ 自动演示"}</span>
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                aria-label="上一步"
                disabled={step <= 1}
                style={tokenBtnStyle(false)}
                onClick={() => selectStep(Math.max(1, step - 1) as TpStep)}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  ‹
                </span>
                <span className="tp-wide-only">‹ 上一步</span>
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                aria-label="下一步"
                disabled={step >= 4}
                style={tokenBtnStyle(false)}
                onClick={() => selectStep(Math.min(4, step + 1) as TpStep)}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  ›
                </span>
                <span className="tp-wide-only">下一步 ›</span>
              </button>
            </div>

            <fieldset className="wiki-edu-btn-row" aria-label="TP 四步演算进度">
              {TP_STEPS.map((s) => {
                const active = mode === "sandbox" && step === s;
                const fullLbl = calc.shortStepBtns[s - 1] ?? `${s}`;
                const compactCircled = ["①", "②", "③", "④"][s - 1] ?? String(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`tp-step-${s}`}
                    aria-label={fullLbl}
                    aria-pressed={active}
                    aria-current={active ? "step" : undefined}
                    style={tokenBtnStyle(active, "teal")}
                    onClick={() => selectStep(s)}
                  >
                    <span className="tp-compact-only" aria-hidden="true">
                      {compactCircled}
                    </span>
                    <span className="tp-wide-only">{fullLbl}</span>
                  </button>
                );
              })}
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="TP 视图切换">
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="tp-view-matrix"
                aria-label="矩阵演算"
                aria-pressed={mode === "sandbox"}
                style={tokenBtnStyle(mode === "sandbox", "dark")}
                onClick={() => switchView("matrix")}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  矩阵
                </span>
                <span className="tp-wide-only">矩阵演算</span>
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="tp-view-gqa"
                aria-label="GQA 拐点"
                aria-pressed={false}
                style={tokenBtnStyle(false, "dark")}
                onClick={() => switchView("gqa")}
              >
                <span className="tp-compact-only" aria-hidden="true">
                  GQA
                </span>
                <span className="tp-wide-only">GQA 拐点</span>
              </button>
            </fieldset>
          </>
        )
      }
      takeawayBadge={isGqaView ? gqaCalc.takeawayBadge : calc.takeawayBadge}
      takeawayTone={isGqaView ? gqaCalc.takeawayTone : calc.takeawayTone}
      takeaway={isGqaView ? gqaCalc.takeaway : calc.takeaway}
      kpi={isGqaView ? gqaCalc.kpi : calc.kpi}
      detailsSummary={
        isGqaView
          ? "查看工程与源码细节（头分片与复制规则 / 整除守卫 / 头宽与块字节公式）"
          : "查看工程与源码细节（[in, out] 形状约定 / 非线性不可交换证明 / 偏置单次计入与 910B3 归约税）"
      }
      detailsContent={
        isGqaView ? (
          <>
            <strong>{gqaCalc.detailTitle}</strong>：{gqaCalc.detailBody} 上游源码锚点：
            <code>vllm@ced6857afa0ea7b2e3f0846a62e1394e90f15607</code>（
            <code>vllm/model_executor/layers/linear.py#L1045-L1060</code> 与 <code>#L1295-L1304</code>，
            <code>vllm/distributed/utils.py#L53-L64</code> <code>divide()</code> 整除守卫）。当前复制倍数{" "}
            <code>num_kv_head_replicas = {gqaCalc.numKvHeadReplicas}</code>；注意 <code>Qwen3-30B-A3B</code>{" "}
            <code>hidden_size=2048</code> 但显式 <code>head_dim=128</code>
            ，不可用 <code>2048/32</code> 反推头宽；单层每块公式为{" "}
            <code>128 × 本地KV头数 × 128 × 2(K+V) × 2 B</code>。
          </>
        ) : (
          <>
            <strong>{calc.detailTitle}</strong>：{calc.detailBody} 固定教学算例：<code>x = [1, 2]</code>，
            <code>W₁ = [[1, 3, −1, 2], [2, −1, 2, −2]]</code>，
            <code>W₂ = [[1, 0], [2, 1], [1, 1], [1, 2]]</code>（全页采用 <code>[in, out]</code> 约定{" "}
            <code>y = x·W</code>，与 HuggingFace checkpoint 的 <code>[out, in]</code> 转置相反）。反例等式：
            <code>
              ReLU([1, 3, −1, 2]) + ReLU([4, −2, 4, −4]) = [5, 3, 4, 2] ≠ ReLU([5, 1, 3, −2]) = [5, 1, 3, 0]
            </code>
            。
          </>
        )
      }
    >
      <style>{`
        .tp-desktop-svg { display: block; width: 100%; max-width: 900px; height: auto; }
        .tp-mobile-stack { display: none; }
        .tp-compact-only { display: none; }
        .tp-wide-only { display: inline; }
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
          flex-wrap: nowrap;
        }
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
          flex-wrap: nowrap;
        }
        .wiki-edu-card[data-diagram-id="${id}"] code,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-details-body,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-note-card {
          overflow-wrap: anywhere;
          word-break: break-word;
          min-width: 0;
        }
        @container reader-main (max-width: 820px) {
          .tp-desktop-svg { display: none; }
          .tp-mobile-stack { display: flex; flex-direction: column; gap: 6px; }
          .tp-mobile-stack.tp-gqa-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
          .tp-compact-only { display: inline; }
          .tp-wide-only { display: none; }
        }
        @media (max-width: 820px) {
          .tp-desktop-svg { display: none; }
          .tp-mobile-stack { display: flex; flex-direction: column; gap: 4px; }
          .tp-mobile-stack.tp-gqa-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
          .tp-mobile-stack.tp-gqa-grid .wiki-edu-note-card { padding: 4px 7px !important; gap: 1px !important; }
          .tp-compact-only { display: inline; }
          .tp-wide-only { display: none; }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-stage {
            padding: 8px 10px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-dual-grid {
            gap: 5px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-dual-grid .wiki-edu-note-card {
            padding: 5px 8px;
            font-size: 11.5px;
            line-height: 1.35;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-footer {
            padding: 8px 12px;
            gap: 5px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-takeaway {
            gap: 5px 8px;
            font-size: 12px;
            line-height: 1.38;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
            padding: 5px 6px;
            gap: 3px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
            gap: 2px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
            padding: 4px 4.5px;
            font-size: 11px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-kpi,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-takeaway-badge,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-badge {
            white-space: normal;
            max-width: 100%;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        {isGqaView ? (
          <>
            <TpGqaSvgCanvas gqaCalc={gqaCalc} mKv={mKv} />
            <div className="tp-mobile-stack tp-gqa-grid">
              {gqaCalc.rankAssignments.map((r) => {
                const kvLabel =
                  r.kvHeadIndices.length === 1
                    ? `KV${r.kvHeadIndices[0]}`
                    : `KV${r.kvHeadIndices[0]}..${r.kvHeadIndices[r.kvHeadIndices.length - 1]}`;
                const rankVar = `var(--color-rank${(r.kvHeadIndices[0] ?? 0) % 4})`;
                return (
                  <div
                    key={r.tpRank}
                    className="wiki-edu-note-card"
                    style={{
                      borderLeft: `3px solid ${rankVar}`,
                      padding: "6px 8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <strong
                      style={{ fontSize: "12px" }}
                    >{`卡 ${r.tpRank} · Q${r.qHeadStart}~Q${r.qHeadEnd}`}</strong>
                    <span
                      className="mono"
                      style={{ color: "var(--color-ink)", fontWeight: 700, fontSize: "11.5px" }}
                    >
                      {`${kvLabel} · ${formatCleanDecimal(gqaCalc.perCardAllLayersBlockMiB)} MiB/块`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="wiki-edu-dual-grid">
              <div className="wiki-edu-note-card">
                <strong>单卡驻留与块字节</strong>：{gqaCalc.modelName}（{gqaCalc.numLayers} 层，
                {gqaCalc.totalQHeads}Q:{gqaCalc.totalKvHeads}KV，头宽 {gqaCalc.headDim} 维）在{" "}
                <code>TP={gqaCalc.tpSize}</code> 下每卡持 <strong>{gqaCalc.localQHeads} Q 头</strong> +{" "}
                <strong>{gqaCalc.localKvHeads} KV 头</strong>，全层每块{" "}
                <strong>{formatCleanDecimal(gqaCalc.perCardAllLayersBlockMiB)} MiB</strong>。
              </div>
              <div className="wiki-edu-note-card">
                <strong>全组复制账本</strong>：
                {gqaCalc.numKvHeadReplicas > 1
                  ? `每头跨 ${gqaCalc.numKvHeadReplicas} 卡复制`
                  : "无跨卡复制（各卡独占）"}
                ，全组 {gqaCalc.tpSize} 卡每块合计{" "}
                <strong>{formatCleanDecimal(gqaCalc.groupAllLayersBlockMiB)} MiB</strong>（
                {gqaCalc.isKvReplicated
                  ? "已跨过并行度大于 KV 头数拐点，相邻卡持同一 KV 副本"
                  : gqaCalc.isFloorHit
                    ? "恰达每卡 1 KV 头下限，尚无跨卡复制"
                    : "KV 头仍够分，随 TP 翻倍继续减半"}
                ）。
              </div>
            </div>
          </>
        ) : (
          <>
            <TpSandboxSvgCanvas calc={calc} mTeal={mTeal} mComm={mComm} mDanger={mDanger} />
            <TpMatrixMobileCards calc={calc} />
            <details
              className="wiki-edu-param-drawer"
              data-testid="tp-param-drawer"
              onKeyDown={handleKeyDown}
              style={{
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-field)",
                padding: "8px 12px",
                background: "var(--color-surface)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "var(--text-caption)",
                  color: "var(--color-ink)",
                }}
              >
                切换演示模式（标准成对 / 先行切反例 / 单矩阵对照）
              </summary>
              <fieldset
                className="wiki-edu-btn-row"
                aria-label="TP 切分配对模式切换"
                style={{ marginTop: "8px" }}
              >
                <button
                  type="button"
                  className="wiki-edu-btn"
                  data-testid="tp-mode-col-then-row"
                  aria-pressed={mode === "sandbox" && pairingMode === "col-then-row"}
                  style={tokenBtnStyle(mode === "sandbox" && pairingMode === "col-then-row", "dark")}
                  onClick={() => selectPairingMode("col-then-row")}
                >
                  标准成对：先列后行 (1次归约)
                </button>
                <button
                  type="button"
                  className="wiki-edu-btn"
                  data-testid="tp-mode-row-first-trap"
                  aria-pressed={mode === "sandbox" && pairingMode === "row-first-trap"}
                  style={tokenBtnStyle(mode === "sandbox" && pairingMode === "row-first-trap", "dark")}
                  onClick={() => selectPairingMode("row-first-trap")}
                >
                  反例踩坑：若先行切再激活？
                </button>
                <button
                  type="button"
                  className="wiki-edu-btn"
                  data-testid="tp-mode-single-gemm"
                  aria-pressed={mode === "sandbox" && pairingMode === "single-gemm"}
                  style={tokenBtnStyle(mode === "sandbox" && pairingMode === "single-gemm", "dark")}
                  onClick={() => selectPairingMode("single-gemm")}
                >
                  单矩阵列切 vs 行切
                </button>
              </fieldset>
            </details>
            <div className="wiki-edu-dual-grid">
              <div className="wiki-edu-note-card">
                <strong>{pairingMode === "row-first-trap" ? "反例数值现场" : "双卡本地算式"}</strong>：
                {pairingMode === "col-then-row" ? (
                  <>
                    卡 0 列切得真值 <code>{formatTpVec(calc.colCard0)}</code> → 本地激活{" "}
                    <code>{formatTpVec(calc.colReluCard0)}</code> → 部分和{" "}
                    <code>{formatTpVec(calc.w2Card0Partial)}</code>；卡 1 得{" "}
                    <code>{formatTpVec(calc.colCard1)}</code> → <code>{formatTpVec(calc.colReluCard1)}</code>{" "}
                    → <code>{formatTpVec(calc.w2Card1Partial)}</code>。
                  </>
                ) : pairingMode === "row-first-trap" ? (
                  <>
                    先行切直接激活相加得错和 <code>{formatTpVec(calc.wrongRowFirstReluSum)}</code>（真值应为{" "}
                    <code>{formatTpVec(calc.trueRelu)}</code>），迫使激活前插入第 1 次跨卡归约。
                  </>
                ) : (
                  <>
                    列切每卡存半数输出列得真值段 <code>{formatTpVec(calc.colCard0)}</code> 与{" "}
                    <code>{formatTpVec(calc.colCard1)}</code>；行切每卡存半数输入行得部分和{" "}
                    <code>{formatTpVec(calc.rowCard0)}</code> 与 <code>{formatTpVec(calc.rowCard1)}</code>。
                  </>
                )}
              </div>
              <div className="wiki-edu-note-card">
                <strong>跨卡通信账本</strong>：
                {pairingMode === "col-then-row" ? (
                  <>
                    先列切 → 本地算完 → 后行切，整对矩阵仅末尾 <strong>1 次跨卡归约</strong>，合回{" "}
                    <code>{formatTpVec(calc.finalMlpOut)}</code>。
                  </>
                ) : pairingMode === "row-first-trap" ? (
                  <>
                    先行切在激活前强制 <strong>归约 #1</strong>，算完第二层后仍需 <strong>归约 #2</strong>
                    ，比成对配合多 1 次跨卡同步。
                  </>
                ) : (
                  <>
                    单次矩阵乘还原 <code>{formatTpVec(calc.fullW1Out)}</code>
                    ：列切靠全收集拼接，行切靠全归约相加；后接行切层即可省掉拼接。
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </WikiEduSandboxShell>
  );
}

function TpMatrixMobileCards({ calc }: { readonly calc: TpSandboxComputedState }) {
  const { pairingMode, step } = calc;
  const isTrap = pairingMode === "row-first-trap";
  const stations =
    pairingMode === "single-gemm"
      ? [
          {
            title: "① 分法对照",
            body: "列切：两卡均拿全量输入各乘两列；行切：两卡各拿半段输入乘对应行。",
            active: step === 1,
            tone: "default",
          },
          {
            title: "② 本地计算",
            body: `列切真值段 ${formatTpVec(calc.colCard0)} / ${formatTpVec(calc.colCard1)}；行切部分和 ${formatTpVec(calc.rowCard0)} / ${formatTpVec(calc.rowCard1)}。`,
            active: step === 2,
            tone: "default",
          },
          {
            title: "③ 全收集 vs 全归约",
            body: "列切按卡号拼接；行切把对应位置部分和逐项相加。",
            active: step === 3,
            tone: "comm",
          },
          {
            title: "④ 还原同一真值",
            body: `最终都还原为 ${formatTpVec(calc.fullW1Out)}；接行切可省去列切拼接。`,
            active: step === 4,
            tone: "token",
          },
        ]
      : [
          {
            title: isTrap ? "① 两卡先行切" : "① 两卡先列切",
            body: isTrap
              ? `部分和 ${formatTpVec(calc.rowCard0)} 与 ${formatTpVec(calc.rowCard1)}`
              : `真值段 ${formatTpVec(calc.colCard0)} 与 ${formatTpVec(calc.colCard1)}`,
            active: step === 1,
            tone: "default",
          },
          {
            title: isTrap ? (step >= 3 ? "② 激活前被迫归约" : "② 若直接各自激活") : "② 本地激活 (0 通信)",
            body: isTrap
              ? step >= 3
                ? `先归约合齐 ${formatTpVec(calc.rowReducedSum)} 再激活得 ${formatTpVec(calc.trueRelu)}`
                : `卡0得 ${formatTpVec(calc.wrongRowReluCard0)} · 卡1得 ${formatTpVec(calc.wrongRowReluCard1)}`
              : `卡0得 ${formatTpVec(calc.colReluCard0)} · 卡1得 ${formatTpVec(calc.colReluCard1)}`,
            active: step === 2 || (isTrap && step === 3),
            tone: isTrap ? (step >= 3 ? "comm" : "danger") : "token",
          },
          {
            title: isTrap && step <= 2 ? "③ 错和不可恢复" : "③ 两卡行切",
            body:
              isTrap && step <= 2
                ? `错和 ${formatTpVec(calc.wrongRowFirstReluSum)} ≠ 真值 ${formatTpVec(calc.trueRelu)}`
                : `部分和 ${formatTpVec(calc.w2Card0Partial)} 与 ${formatTpVec(calc.w2Card1Partial)}`,
            active: step === 3 && !isTrap,
            tone: isTrap && step <= 2 ? "danger" : "default",
          },
          {
            title: isTrap ? (step <= 2 ? "④ 继续乘则全错" : "④ 第 2 次归约") : "④ 末尾 1 次归约",
            body:
              isTrap && step <= 2
                ? `错得 ${formatTpVec(calc.wrongMlpOut)} ≠ ${formatTpVec(calc.finalMlpOut)}`
                : `合回 ${formatTpVec(calc.finalMlpOut)}（${isTrap ? "共 2 次 · 多 1 次同步" : "仅 1 次同步"}）`,
            active: step === 4,
            tone: isTrap ? "danger" : "comm",
          },
        ];

  return (
    <div className="tp-mobile-stack">
      {stations.map((st) => (
        <div
          key={st.title}
          className="wiki-edu-note-card"
          style={{
            borderColor: st.active
              ? "var(--color-accent)"
              : st.tone === "danger"
                ? "var(--color-danger)"
                : st.tone === "comm"
                  ? "var(--color-comm)"
                  : st.tone === "token"
                    ? "var(--color-token)"
                    : "var(--color-line)",
            borderWidth: st.active ? "2px" : "1px",
          }}
        >
          <strong>{st.title}</strong>：{st.body}
        </div>
      ))}
    </div>
  );
}

function TpGqaSvgCanvas({ gqaCalc, mKv }: { readonly gqaCalc: TpGqaReplicationState; readonly mKv: string }) {
  const { tpSize, rankAssignments, isKvReplicated, numKvHeadReplicas, isFloorHit } = gqaCalc;
  const gap = 8;
  const totalW = 828;
  const cardW = Math.floor((totalW - (tpSize - 1) * gap) / tpSize);

  const replicaGroups: { shardRank: number; firstIdx: number; lastIdx: number }[] = [];
  if (isKvReplicated) {
    for (let i = 0; i < rankAssignments.length; i += numKvHeadReplicas) {
      replicaGroups.push({
        shardRank: rankAssignments[i]!.shardRank,
        firstIdx: i,
        lastIdx: Math.min(rankAssignments.length - 1, i + numKvHeadReplicas - 1),
      });
    }
  }

  return (
    <svg
      className="tp-desktop-svg"
      viewBox="0 0 860 272"
      width="860"
      height="272"
      style={{ width: "100%", maxWidth: "900px", height: "auto" }}
      role="img"
      aria-label={`${gqaCalc.modelName} 在 TP=${tpSize} 下的 Q 头分片与 KV 头驻留映射`}
    >
      <defs>
        <marker id={mKv} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-kv)" />
        </marker>
      </defs>

      <text x="16" y="22" fontSize="13" fontWeight="700" fill="var(--color-ink)">
        {`GQA 头分片（${gqaCalc.modelName} · TP=${tpSize}）`}
      </text>
      <text
        x="844"
        y="22"
        textAnchor="end"
        fontSize="12.5"
        fontWeight="700"
        fill={isKvReplicated ? "var(--color-danger)" : "var(--color-token)"}
      >
        {isKvReplicated
          ? `触及拐点 · ${numKvHeadReplicas}× 复制`
          : isFloorHit
            ? "触底临界 · 1 KV头/卡"
            : `正常等分 · ${gqaCalc.localKvHeads} KV头/卡`}
      </text>

      {rankAssignments.map((r, idx) => {
        const cardX = 16 + idx * (cardW + gap);
        const cx = cardX + cardW / 2;
        const firstKv = r.kvHeadIndices[0] ?? 0;
        const rankColor = `var(--color-rank${firstKv % 4})`;
        const kvTint = `color-mix(in srgb, ${rankColor} 14%, var(--color-surface-elevated))`;
        const kvLabel =
          r.kvHeadIndices.length === 1
            ? `KV${firstKv}`
            : `KV${firstKv}..${r.kvHeadIndices[r.kvHeadIndices.length - 1]}`;
        return (
          <g key={r.tpRank}>
            <rect
              x={cardX}
              y="38"
              width={cardW}
              height="172"
              rx="8"
              fill="var(--color-surface)"
              stroke={isKvReplicated ? "var(--color-warning)" : "var(--color-line)"}
              strokeWidth="1.4"
              style={{ transition: "stroke 0.25s ease, fill 0.25s ease" }}
            />
            <text x={cx} y="58" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
              {`卡 ${r.tpRank}`}
            </text>

            <rect
              x={cardX + 6}
              y="68"
              width={cardW - 12}
              height="48"
              rx="6"
              fill="var(--color-token-soft)"
              stroke="var(--color-token)"
              strokeWidth="1.3"
            />
            <text x={cx} y="88" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
              {`${r.localQHeads} Q头`}
            </text>
            <text x={cx} y="106" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
              {`Q${r.qHeadStart}~Q${r.qHeadEnd}`}
            </text>

            <rect
              x={cardX + 6}
              y="124"
              width={cardW - 12}
              height="76"
              rx="6"
              fill={kvTint}
              stroke={rankColor}
              strokeWidth="1.6"
              style={{ transition: "fill 0.25s ease, stroke 0.25s ease" }}
            />
            <rect x={cardX + 6} y="124" width={cardW - 12} height="5" rx="2" fill={rankColor} />
            <text x={cx} y="148" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
              {kvLabel}
            </text>
            <text x={cx} y="170" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
              {`${formatCleanDecimal(gqaCalc.perCardSingleLayerBlockKiB)} KiB/层`}
            </text>
            <text x={cx} y="191" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
              {`${formatCleanDecimal(gqaCalc.perCardAllLayersBlockMiB)} MiB/块`}
            </text>
          </g>
        );
      })}

      {isKvReplicated ? (
        replicaGroups.map((grp) => {
          const leftX = 16 + grp.firstIdx * (cardW + gap) + 12;
          const rightX = 16 + grp.lastIdx * (cardW + gap) + cardW - 12;
          const midX = (leftX + rightX) / 2;
          const rankColor = `var(--color-rank${grp.shardRank % 4})`;
          return (
            <g key={grp.shardRank}>
              <path
                d={`M ${leftX} 214 L ${leftX} 224 L ${rightX} 224 L ${rightX} 214`}
                fill="none"
                stroke={rankColor}
                strokeWidth="1.8"
              />
              <text
                x={midX}
                y="246"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="var(--color-ink)"
              >
                {`同份 KV${grp.shardRank} (${numKvHeadReplicas}卡)`}
              </text>
            </g>
          );
        })
      ) : (
        <text x="430" y="244" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
          {isFloorHit
            ? `已触底：每卡 1 个 KV 头 · 全组 ${formatCleanDecimal(gqaCalc.groupAllLayersBlockMiB)} MiB/块`
            : `KV 头零重叠 · 全组合计 ${formatCleanDecimal(gqaCalc.groupAllLayersBlockMiB)} MiB/块`}
        </text>
      )}
    </svg>
  );
}

function TpSandboxSvgCanvas({
  calc,
  mTeal,
  mComm,
  mDanger,
}: {
  readonly calc: TpSandboxComputedState;
  readonly mTeal: string;
  readonly mComm: string;
  readonly mDanger: string;
}) {
  const { pairingMode, step } = calc;

  return (
    <svg
      className="tp-desktop-svg"
      viewBox="0 0 860 272"
      width="860"
      height="272"
      style={{ width: "100%", maxWidth: "900px", height: "auto" }}
      role="img"
      aria-label={calc.canvasHeading}
    >
      <defs>
        <marker
          id={mTeal}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-token)" />
        </marker>
        <marker
          id={mComm}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-comm)" />
        </marker>
        <marker
          id={mDanger}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-danger)" />
        </marker>
      </defs>

      <text x="16" y="22" fontSize="13" fontWeight="700" fill="var(--color-ink)">
        {calc.canvasHeading}
      </text>
      <text
        x="844"
        y="22"
        textAnchor="end"
        fontSize="12.5"
        fontWeight="700"
        fill={pairingMode === "row-first-trap" ? "var(--color-danger)" : "var(--color-token)"}
      >
        {calc.commPillText}
      </text>

      {pairingMode === "single-gemm" ? (
        <g>
          <rect
            x="16"
            y="42"
            width="228"
            height="86"
            rx="8"
            fill="var(--color-weight-soft)"
            stroke={step === 1 ? "var(--color-accent)" : "var(--color-weight)"}
            strokeWidth={step === 1 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="130" y="65" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            按列切：两卡持完整输入
          </text>
          <text x="130" y="89" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            {`x=${formatTpVec(calc.x)} · 各乘一半列`}
          </text>
          <text x="130" y="113" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            每卡权重分片 [2, 2]
          </text>

          <line
            x1="246"
            y1="85"
            x2="266"
            y2="85"
            stroke="var(--color-token)"
            strokeWidth="1.8"
            markerEnd={`url(#${mTeal})`}
          />

          <rect
            x="270"
            y="42"
            width="216"
            height="86"
            rx="8"
            fill={step >= 2 ? "var(--color-token-soft)" : "var(--color-surface)"}
            stroke={step === 2 ? "var(--color-accent)" : "var(--color-token)"}
            strokeWidth={step === 2 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="378" y="65" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            数值真值 · 形状各半
          </text>
          <text x="378" y="89" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {`${formatTpVec(calc.colCard0)} | ${formatTpVec(calc.colCard1)}`}
          </text>
          <text x="378" y="113" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            单通道点积项已齐备
          </text>

          <line
            x1="488"
            y1="85"
            x2="510"
            y2="85"
            stroke="var(--color-comm)"
            strokeWidth="1.8"
            markerEnd={`url(#${mComm})`}
          />

          <rect
            x="514"
            y="42"
            width="142"
            height="86"
            rx="8"
            fill={step >= 3 ? "var(--color-comm-soft)" : "var(--color-surface)"}
            stroke={step === 3 ? "var(--color-accent)" : "var(--color-comm)"}
            strokeWidth={step === 3 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="585" y="76" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            全收集拼接
          </text>
          <text x="585" y="102" textAnchor="middle" fontSize="12" fill="var(--color-comm)">
            按卡号直接拼接
          </text>

          <line
            x1="658"
            y1="85"
            x2="680"
            y2="85"
            stroke="var(--color-comm)"
            strokeWidth="1.8"
            markerEnd={`url(#${mComm})`}
          />

          <rect
            x="684"
            y="42"
            width="160"
            height="86"
            rx="8"
            fill={step >= 4 ? "var(--color-token-soft)" : "var(--color-surface)"}
            stroke={step === 4 ? "var(--color-accent)" : "var(--color-token)"}
            strokeWidth={step === 4 ? "2" : "1.5"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="764" y="76" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.fullW1Out)}
          </text>
          <text x="764" y="102" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            接行切可省拼接
          </text>

          <rect
            x="16"
            y="158"
            width="228"
            height="86"
            rx="8"
            fill="var(--color-weight-soft)"
            stroke={step === 1 ? "var(--color-accent)" : "var(--color-weight)"}
            strokeWidth={step === 1 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="130" y="181" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            按行切：两卡各拿半段
          </text>
          <text x="130" y="205" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            卡0 拿行0 · 卡1 拿行1
          </text>
          <text x="130" y="229" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            每卡权重分片 [1, 4]
          </text>

          <line
            x1="246"
            y1="201"
            x2="266"
            y2="201"
            stroke="var(--color-token)"
            strokeWidth="1.8"
            markerEnd={`url(#${mTeal})`}
          />

          <rect
            x="270"
            y="158"
            width="216"
            height="86"
            rx="8"
            fill={step >= 2 ? "var(--color-surface-sunken)" : "var(--color-surface)"}
            stroke={step === 2 ? "var(--color-accent)" : "var(--color-control)"}
            strokeWidth={step === 2 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="378" y="181" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            形状全 · 只是部分和
          </text>
          <text x="378" y="205" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`卡0 ${formatTpVec(calc.rowCard0)}`}
          </text>
          <text x="378" y="229" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`卡1 ${formatTpVec(calc.rowCard1)}`}
          </text>

          <line
            x1="488"
            y1="201"
            x2="510"
            y2="201"
            stroke="var(--color-comm)"
            strokeWidth="1.8"
            markerEnd={`url(#${mComm})`}
          />

          <rect
            x="514"
            y="158"
            width="142"
            height="86"
            rx="8"
            fill={step >= 3 ? "var(--color-comm-soft)" : "var(--color-surface)"}
            stroke={step === 3 ? "var(--color-accent)" : "var(--color-comm)"}
            strokeWidth={step === 3 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="585" y="192" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            全归约相加
          </text>
          <text x="585" y="218" textAnchor="middle" fontSize="12" fill="var(--color-comm)">
            对应位置逐项加
          </text>

          <line
            x1="658"
            y1="201"
            x2="680"
            y2="201"
            stroke="var(--color-comm)"
            strokeWidth="1.8"
            markerEnd={`url(#${mComm})`}
          />

          <rect
            x="684"
            y="158"
            width="160"
            height="86"
            rx="8"
            fill={step >= 4 ? "var(--color-token-soft)" : "var(--color-surface)"}
            stroke={step === 4 ? "var(--color-accent)" : "var(--color-token)"}
            strokeWidth={step === 4 ? "2" : "1.5"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="764" y="192" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.fullW1Out)}
          </text>
          <text x="764" y="218" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            少加一卡必算错
          </text>
        </g>
      ) : (
        <TpPairedOrTrapLanes calc={calc} mTeal={mTeal} mComm={mComm} mDanger={mDanger} />
      )}
    </svg>
  );
}

function TpPairedOrTrapLanes({
  calc,
  mTeal,
  mComm,
  mDanger,
}: {
  readonly calc: TpSandboxComputedState;
  readonly mTeal: string;
  readonly mComm: string;
  readonly mDanger: string;
}) {
  const { pairingMode, step } = calc;
  const isTrap = pairingMode === "row-first-trap";

  return (
    <g>
      <rect
        x="16"
        y="42"
        width="184"
        height="88"
        rx="8"
        fill="var(--color-weight-soft)"
        stroke={step === 1 ? "var(--color-accent)" : "var(--color-weight)"}
        strokeWidth={step === 1 ? "2" : "1.4"}
        style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
      />
      <text x="108" y="65" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
        {isTrap ? "① 卡0 先行切" : "① 卡0 按列分"}
      </text>
      <text x="108" y="89" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
        {isTrap ? "部分和" : "真值通道"}
      </text>
      <text x="108" y="113" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
        {isTrap ? formatTpVec(calc.rowCard0) : formatTpVec(calc.colCard0)}
      </text>

      <rect
        x="16"
        y="158"
        width="184"
        height="88"
        rx="8"
        fill="var(--color-weight-soft)"
        stroke={step === 1 ? "var(--color-accent)" : "var(--color-weight)"}
        strokeWidth={step === 1 ? "2" : "1.4"}
        style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
      />
      <text x="108" y="181" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
        {isTrap ? "① 卡1 先行切" : "① 卡1 按列分"}
      </text>
      <text x="108" y="205" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
        {isTrap ? "部分和" : "真值通道"}
      </text>
      <text x="108" y="229" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">
        {isTrap ? formatTpVec(calc.rowCard1) : formatTpVec(calc.colCard1)}
      </text>

      <line
        x1="202"
        y1="86"
        x2="222"
        y2={isTrap && step >= 3 ? "118" : "86"}
        stroke={isTrap ? "var(--color-danger)" : "var(--color-token)"}
        strokeWidth="1.8"
        markerEnd={`url(#${isTrap ? mDanger : mTeal})`}
      />
      <line
        x1="202"
        y1="202"
        x2="222"
        y2={isTrap && step >= 3 ? "170" : "202"}
        stroke={isTrap ? "var(--color-danger)" : "var(--color-token)"}
        strokeWidth="1.8"
        markerEnd={`url(#${isTrap ? mDanger : mTeal})`}
      />

      {isTrap && step >= 3 ? (
        <g>
          <rect
            x="226"
            y="52"
            width="184"
            height="184"
            rx="8"
            fill="var(--color-comm-soft)"
            stroke={step === 3 ? "var(--color-accent)" : "var(--color-comm)"}
            strokeWidth={step === 3 ? "2" : "1.5"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="318" y="84" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-comm)">
            ③ 先求和再激活
          </text>
          <text x="318" y="112" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            被迫先归约合齐
          </text>
          <text x="318" y="138" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.rowReducedSum)}
          </text>
          <text x="318" y="168" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            再算激活得真值
          </text>
          <text x="318" y="196" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.trueRelu)}
          </text>
          <text x="318" y="222" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            多 1 次跨卡同步
          </text>
        </g>
      ) : (
        <g>
          <rect
            x="226"
            y="42"
            width="184"
            height="88"
            rx="8"
            fill={
              isTrap
                ? "var(--color-accent-soft)"
                : step >= 2
                  ? "var(--color-token-soft)"
                  : "var(--color-surface)"
            }
            stroke={
              step === 2 ? "var(--color-accent)" : isTrap ? "var(--color-danger)" : "var(--color-token)"
            }
            strokeWidth={step === 2 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="318" y="68" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {isTrap ? "✗ 先激活" : "② 本地激活"}
          </text>
          <text
            x="318"
            y="96"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill={isTrap ? "var(--color-danger)" : "var(--color-ink)"}
          >
            {isTrap ? formatTpVec(calc.wrongRowReluCard0) : formatTpVec(calc.colReluCard0)}
          </text>
          <text x="318" y="117" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            {isTrap ? "未合齐直接算" : "0 通信"}
          </text>

          <rect
            x="226"
            y="158"
            width="184"
            height="88"
            rx="8"
            fill={
              isTrap
                ? "var(--color-accent-soft)"
                : step >= 2
                  ? "var(--color-token-soft)"
                  : "var(--color-surface)"
            }
            stroke={
              step === 2 ? "var(--color-accent)" : isTrap ? "var(--color-danger)" : "var(--color-token)"
            }
            strokeWidth={step === 2 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="318" y="184" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {isTrap ? "✗ 先激活" : "② 本地激活"}
          </text>
          <text
            x="318"
            y="212"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill={isTrap ? "var(--color-danger)" : "var(--color-ink)"}
          >
            {isTrap ? formatTpVec(calc.wrongRowReluCard1) : formatTpVec(calc.colReluCard1)}
          </text>
          <text x="318" y="233" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            {isTrap ? "末维丢负号" : "−2 归 0"}
          </text>
        </g>
      )}

      <line
        x1="412"
        y1={isTrap && step >= 3 ? "118" : "86"}
        x2="432"
        y2={isTrap && step <= 2 ? "118" : "86"}
        stroke={isTrap && step <= 2 ? "var(--color-danger)" : "var(--color-token)"}
        strokeWidth="1.8"
        markerEnd={`url(#${isTrap && step <= 2 ? mDanger : mTeal})`}
      />
      <line
        x1="412"
        y1={isTrap && step >= 3 ? "170" : "202"}
        x2="432"
        y2={isTrap && step <= 2 ? "170" : "202"}
        stroke={isTrap && step <= 2 ? "var(--color-danger)" : "var(--color-token)"}
        strokeWidth="1.8"
        markerEnd={`url(#${isTrap && step <= 2 ? mDanger : mTeal})`}
      />

      {isTrap && step <= 2 ? (
        <g>
          <rect
            x="436"
            y="52"
            width="184"
            height="184"
            rx="8"
            fill="var(--color-accent-soft)"
            stroke="var(--color-danger)"
            strokeWidth="1.6"
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text
            x="528"
            y="88"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill="var(--color-danger)"
          >
            ✗ 出现错和
          </text>
          <text
            x="528"
            y="122"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill="var(--color-danger)"
          >
            {formatTpVec(calc.wrongRowFirstReluSum)}
          </text>
          <text x="528" y="156" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {`≠ ${formatTpVec(calc.trueRelu)}`}
          </text>
          <text x="528" y="192" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            末维 2 + 0 ≠ 0
          </text>
        </g>
      ) : (
        <g>
          <rect
            x="436"
            y="42"
            width="184"
            height="88"
            rx="8"
            fill={step >= 3 ? "var(--color-weight-soft)" : "var(--color-surface)"}
            stroke={!isTrap && step === 3 ? "var(--color-accent)" : "var(--color-weight)"}
            strokeWidth={!isTrap && step === 3 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="528" y="68" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            ③ 卡0 按行分
          </text>
          <text x="528" y="94" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            部分和
          </text>
          <text x="528" y="114" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.w2Card0Partial)}
          </text>

          <rect
            x="436"
            y="158"
            width="184"
            height="88"
            rx="8"
            fill={step >= 3 ? "var(--color-weight-soft)" : "var(--color-surface)"}
            stroke={!isTrap && step === 3 ? "var(--color-accent)" : "var(--color-weight)"}
            strokeWidth={!isTrap && step === 3 ? "2" : "1.4"}
            style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
          />
          <text x="528" y="184" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            ③ 卡1 按行分
          </text>
          <text x="528" y="210" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
            部分和
          </text>
          <text x="528" y="230" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {formatTpVec(calc.w2Card1Partial)}
          </text>
        </g>
      )}

      <line
        x1="622"
        y1={isTrap && step <= 2 ? "144" : "86"}
        x2="640"
        y2={isTrap && step <= 2 ? "144" : "120"}
        stroke={isTrap && step <= 2 ? "var(--color-danger)" : "var(--color-comm)"}
        strokeWidth="1.8"
        markerEnd={`url(#${isTrap && step <= 2 ? mDanger : mComm})`}
      />
      {!(isTrap && step <= 2) && (
        <line
          x1="622"
          y1="202"
          x2="640"
          y2="168"
          stroke="var(--color-comm)"
          strokeWidth="1.8"
          markerEnd={`url(#${mComm})`}
        />
      )}

      <rect
        x="644"
        y="52"
        width="200"
        height="184"
        rx="8"
        fill={
          isTrap ? "var(--color-accent-soft)" : step >= 4 ? "var(--color-comm-soft)" : "var(--color-surface)"
        }
        stroke={step === 4 ? "var(--color-accent)" : isTrap ? "var(--color-danger)" : "var(--color-comm)"}
        strokeWidth={step === 4 ? "2" : "1.5"}
        style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
      />
      <text
        x="744"
        y="84"
        textAnchor="middle"
        fontSize="12.5"
        fontWeight="700"
        fill={isTrap ? "var(--color-danger)" : "var(--color-comm)"}
      >
        {isTrap ? (step <= 2 ? "⚠ 若继续前向" : "④ 第 2 次归约") : "④ 跨卡求和"}
      </text>
      <text x="744" y="114" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
        {isTrap && step <= 2
          ? "错和乘后层"
          : `${formatTpVec(calc.w2Card0Partial)} + ${formatTpVec(calc.w2Card1Partial)}`}
      </text>
      <text
        x="744"
        y="146"
        textAnchor="middle"
        fontSize="13.5"
        fontWeight="700"
        fill={isTrap && step <= 2 ? "var(--color-danger)" : "var(--color-ink)"}
      >
        {isTrap && step <= 2 ? `错得 ${formatTpVec(calc.wrongMlpOut)}` : `= ${formatTpVec(calc.finalMlpOut)}`}
      </text>
      <text
        x="744"
        y="178"
        textAnchor="middle"
        fontSize="12"
        fill={isTrap ? "var(--color-danger)" : "var(--color-ink)"}
      >
        {isTrap ? (step <= 2 ? `≠ ${formatTpVec(calc.finalMlpOut)}` : "共 2 次通信") : "与单卡真值一致"}
      </text>
      <text x="744" y="208" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
        {isTrap ? (step <= 2 ? "点第 ③ 步看修复" : "多 1 次跨卡同步") : "中间 0 拼接 · 仅 1 归约"}
      </text>
    </g>
  );
}
