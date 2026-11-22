/**
 * Qwen3-30B-A3B 标准稀疏 MoE（Qwen3MoeSparseMoeBlock）教学算子与可核对算例。
 *
 * 语义来源：
 * - HuggingFace transformers `modeling_qwen3_moe.py`（`Qwen3MoeSparseMoeBlock.forward`）
 * - vLLM `vllm/model_executor/models/qwen3_moe.py`（`Qwen3MoeSparseMoeBlock`）
 *
 * 与 DeepSeek-V3 / GLM-5.3-Flash 的关键区别：
 * 1. 纯 Softmax 路由：对全部 128 个专家 logits 做 FP32 Softmax，无 sigmoid + `e_score_correction_bias` 偏置选路；
 * 2. Top-8 重归一（`norm_topk_prob = true`）：挑出前 8 个专家概率后除以这 8 项之和，严格满足 `Σ_{k=0..7} w_k = 1.0`；
 * 3. 零共享专家（`num_shared_experts = 0`）：前馈输出完全由被选中的 8 个路由专家加权求和得到，没有常驻共享 MLP 支路。
 */
import type { ModelSpec } from "../modelspec/types";
import { linearLazy, softmaxLastDim } from "../tensor/ops";
import { fromArray, type Tensor, zeros } from "../tensor/tensor";
import { lazyWeight, weightColumn } from "../weights";

export interface QwenMoeBlockOptions {
  layerIdx?: number;
  hidden: number;
  numExperts: number;
  topK: number;
  moeIntermediate: number;
  normTopkProb: boolean;
  initializerRange: number;
}

export interface QwenMoeForwardResult {
  /** `[S, E]` 路由器原始打分 `x_norm · W_router` */
  routerLogits: Tensor;
  /** `[S, E]` 对 128 个专家做 Softmax 后的完整概率分布（每行和为 1） */
  routerProbs: Tensor;
  /** 每个 token 挑中的 `topK` 个专家编号（按概率从高到低排列，长度 `S × topK`） */
  selectedExperts: number[][];
  /** `[S, topK]` 挑出的前 `topK` 个原始 Softmax 概率（重归一前） */
  topKRawProbs: Tensor;
  /** `[S, topK]` 重归一后的专家权重（`norm_topk_prob=true` 时每行严格和为 1.0） */
  routingWeights: Tensor;
  /** `[S, topK, I_moe]` 被选中专家的 `gate_proj` 输出 */
  expertGate: Tensor;
  /** `[S, topK, I_moe]` 被选中专家的 `up_proj` 输出 */
  expertUp: Tensor;
  /** `[S, topK, I_moe]` `silu(gate) ⊙ up` 门控激活输出 */
  expertAct: Tensor;
  /** `[S, topK, H]` 被选中专家的 `down_proj` 输出（乘路由权重前） */
  expertDown: Tensor;
  /** `[S, topK, H]` 乘上对应重归一路由权重 `w_{s,k}` 后的各专家贡献 */
  weightedExpertOut: Tensor;
  /** `[S, H]` 8 个激活专家加权求和后的最终 MoE 输出（无共享专家） */
  out: Tensor;
  /** Qwen3-30B-A3B 共享专家数固定为 0 */
  numSharedExperts: 0;
  /** 本次序列实际唤醒的去重专家个数 */
  activeExpertCount: number;
}

export interface QwenMoeHandCalcPick {
  rank: number;
  expertId: number;
  logit: number;
  softmaxProb: number;
  renormWeight: number;
  /** 2 维通道切片示例：`[c0, c1]` */
  expertOutSlice: [number, number];
  weightedSlice: [number, number];
}

export interface QwenMoeHandCalcExample {
  /** 架构真源规格形状链 */
  specShapes: {
    input: [string, number];
    routerWeight: [number, number];
    routerLogits: [string, number];
    selectedIndices: [string, number];
    routingWeights: [string, number];
    expertGateUp: [number, number, number];
    expertAct: [string, number, number];
    expertDown: [number, number, number];
    combinedOut: [string, number];
    numSharedExperts: 0;
  };
  /** 单 token（如末位词「存」）在 128 个专家中的 Top-8 重归一手算核对表 */
  tokenLabel: string;
  top8SumBeforeRenorm: number;
  renormWeightSum: number;
  picks: QwenMoeHandCalcPick[];
  /** 8 份加权切片相加后的结果 `[c0, c1]` */
  combinedSlice: [number, number];
}

/** 从 `ModelSpec` 提取并校验 Qwen3 MoE 参数（要求无共享专家）。 */
export function extractQwenMoeOptions(spec: ModelSpec, layerIdx = 0): QwenMoeBlockOptions {
  const layer = spec.layers[layerIdx];
  if (!layer) throw new Error(`层 ${layerIdx} 不存在（共 ${spec.numLayers} 层）`);
  if (layer.mlp.kind !== "moe") {
    throw new Error(`${spec.name} 第 ${layerIdx} 层不是 MoE 层（当前为 ${layer.mlp.kind}）`);
  }
  if (layer.mlp.numSharedExperts !== 0) {
    throw new Error(
      `Qwen3 标准 MoE 期望 0 个共享专家，但收到 numSharedExperts=${layer.mlp.numSharedExperts}`,
    );
  }
  return {
    layerIdx,
    hidden: spec.hidden,
    numExperts: layer.mlp.numExperts,
    topK: layer.mlp.topK,
    moeIntermediate: layer.mlp.moeIntermediate,
    normTopkProb: layer.mlp.normTopkProb,
    initializerRange: spec.initializerRange,
  };
}

/** 对单行概率选出前 `k` 大下标（概率相同时小专家编号优先，保证完全确定性）。 */
export function selectTopKIndices(
  probs: Float32Array,
  rowOffset: number,
  numExperts: number,
  k: number,
): number[] {
  const indices = Array.from({ length: numExperts }, (_, idx) => idx);
  indices.sort((a, b) => {
    const diff = (probs[rowOffset + b] ?? 0) - (probs[rowOffset + a] ?? 0);
    return diff !== 0 ? diff : a - b;
  });
  return indices.slice(0, k);
}

/**
 * 执行标准 Qwen3-30B-A3B 稀疏 MoE 前向：
 * `xNorm [S, H] -> router [S, 128] -> softmax -> top-8 -> renormalize -> 8 × SwiGLU(H->I_moe->H) -> weighted combine [S, H]`
 */
export function forwardQwenMoeBlock(xNorm: Tensor, opts: QwenMoeBlockOptions): QwenMoeForwardResult {
  const S = xNorm.shape[0] ?? 0;
  const H = xNorm.shape[1] ?? 0;
  if (S <= 0) throw new Error("MoE 输入序列长度必须大于 0");
  if (H !== opts.hidden) {
    throw new Error(`MoE 输入隐藏维不匹配：收到 ${H}，期望 ${opts.hidden}`);
  }
  const E = opts.numExperts;
  const K = opts.topK;
  const Im = opts.moeIntermediate;
  const std = opts.initializerRange;
  const L = `L${opts.layerIdx ?? 0}`;

  // 1. Router 线性打分：[S, H] · [H, E] -> [S, E]
  const wRouter = lazyWeight(`${L}.mlp.gate`, [H, E], ["H", "E"], std);
  const routerLogits = linearLazy(xNorm, wRouter, "E");

  // 2. 全量 128 专家 FP32 Softmax
  const routerProbs = softmaxLastDim(routerLogits);

  // 3. Top-8 选择与概率重归一（norm_topk_prob = true）
  const selectedExperts: number[][] = [];
  const topKRawProbs = zeros([S, K], ["S", "k"]);
  const routingWeights = zeros([S, K], ["S", "k"]);
  const assignments = new Map<number, { s: number; k: number }[]>();

  for (let s = 0; s < S; s++) {
    const rowOff = s * E;
    const picks = selectTopKIndices(routerProbs.data, rowOff, E, K);
    selectedExperts.push(picks);
    let topSum = 0;
    for (let k = 0; k < K; k++) {
      const expId = picks[k] ?? 0;
      const p = routerProbs.data[rowOff + expId] ?? 0;
      topKRawProbs.data[s * K + k] = p;
      topSum += p;
      const list = assignments.get(expId);
      if (list) list.push({ s, k });
      else assignments.set(expId, [{ s, k }]);
    }
    const denom = opts.normTopkProb && topSum > 0 ? topSum : 1;
    for (let k = 0; k < K; k++) {
      routingWeights.data[s * K + k] = (topKRawProbs.data[s * K + k] ?? 0) / denom;
    }
  }

  // 4. 按去重后的被选中专家批量执行 SwiGLU：仅计算真正被路由唤醒的专家，其余专家零计算
  const expertGate = zeros([S, K, Im], ["S", "k", "I_moe"]);
  const expertUp = zeros([S, K, Im], ["S", "k", "I_moe"]);
  const expertAct = zeros([S, K, Im], ["S", "k", "I_moe"]);
  const expertDown = zeros([S, K, H], ["S", "k", "H"]);
  const weightedExpertOut = zeros([S, K, H], ["S", "k", "H"]);
  const out = zeros([S, H], ["S", "H"]);

  const colGate = new Float32Array(H);
  const colUp = new Float32Array(H);
  const colDown = new Float32Array(Im);

  for (const [expId, slots] of assignments) {
    const wGate = lazyWeight(`${L}.mlp.experts.${expId}.gate_proj`, [H, Im], ["H", "I_moe"], std);
    const wUp = lazyWeight(`${L}.mlp.experts.${expId}.up_proj`, [H, Im], ["H", "I_moe"], std);
    const wDown = lazyWeight(`${L}.mlp.experts.${expId}.down_proj`, [Im, H], ["I_moe", "H"], std);

    // gate_proj & up_proj & silu(gate) * up
    for (let j = 0; j < Im; j++) {
      weightColumn(wGate, j, colGate);
      weightColumn(wUp, j, colUp);
      for (const { s, k } of slots) {
        const xOff = s * H;
        let gAcc = 0;
        let uAcc = 0;
        for (let i = 0; i < H; i++) {
          const xv = xNorm.data[xOff + i] ?? 0;
          gAcc += xv * (colGate[i] ?? 0);
          uAcc += xv * (colUp[i] ?? 0);
        }
        const idx = (s * K + k) * Im + j;
        expertGate.data[idx] = gAcc;
        expertUp.data[idx] = uAcc;
        expertAct.data[idx] = (gAcc / (1 + Math.exp(-gAcc))) * uAcc;
      }
    }

    // down_proj & 路由权重缩放累加到本层 MoE 输出（无共享专家）
    for (let h = 0; h < H; h++) {
      weightColumn(wDown, h, colDown);
      for (const { s, k } of slots) {
        const actOff = (s * K + k) * Im;
        let dAcc = 0;
        for (let j = 0; j < Im; j++) {
          dAcc += (expertAct.data[actOff + j] ?? 0) * (colDown[j] ?? 0);
        }
        const outIdx = (s * K + k) * H + h;
        const w = routingWeights.data[s * K + k] ?? 0;
        const weighted = w * dAcc;
        expertDown.data[outIdx] = dAcc;
        weightedExpertOut.data[outIdx] = weighted;
        out.data[s * H + h] = (out.data[s * H + h] ?? 0) + weighted;
      }
    }
  }

  return {
    routerLogits,
    routerProbs,
    selectedExperts,
    topKRawProbs,
    routingWeights,
    expertGate,
    expertUp,
    expertAct,
    expertDown,
    weightedExpertOut,
    out,
    numSharedExperts: 0,
    activeExpertCount: assignments.size,
  };
}

/**
 * 生成确定性的「128 选 8 Softmax 重归一」手算核对算例，
 * 供单元测试、2D 架构检视器与 3D 演算卡片共享同一套可逐项手算验证的数字。
 */
export function buildQwenMoeHandCalcExample(): QwenMoeHandCalcExample {
  // 构造 128 个确定性路由器 logits：8 个明显高分峰 + 120 个温和背景项，便于读者肉眼核对 Softmax 与 Top-8 重归一
  const logitsArr = new Float32Array(128);
  for (let e = 0; e < 128; e++) {
    logitsArr[e] = -1.6 + ((e * 17) % 13) * 0.05;
  }
  const featured: [number, number, [number, number]][] = [
    [19, 3.4, [0.42, -0.18]],
    [57, 2.95, [0.31, 0.24]],
    [4, 2.65, [-0.15, 0.36]],
    [83, 2.4, [0.28, 0.12]],
    [102, 2.15, [-0.22, 0.19]],
    [36, 1.95, [0.16, -0.25]],
    [121, 1.8, [0.25, 0.08]],
    [68, 1.65, [-0.1, 0.21]],
  ];
  const sliceByExpert = new Map<number, [number, number]>();
  for (const [expId, logit, outSlice] of featured) {
    logitsArr[expId] = logit;
    sliceByExpert.set(expId, outSlice);
  }

  const probsTensor = softmaxLastDim(fromArray([1, 128], ["S", "E"], logitsArr));
  const topIds = selectTopKIndices(probsTensor.data, 0, 128, 8);
  let top8Sum = 0;
  for (const id of topIds) top8Sum += probsTensor.data[id] ?? 0;

  let c0 = 0;
  let c1 = 0;
  let renormSum = 0;
  const picks: QwenMoeHandCalcPick[] = topIds.map((expertId, rank) => {
    const logit = logitsArr[expertId] ?? 0;
    const softmaxProb = probsTensor.data[expertId] ?? 0;
    const renormWeight = softmaxProb / top8Sum;
    renormSum += renormWeight;
    const expertOutSlice = sliceByExpert.get(expertId) ?? [0, 0];
    const weightedSlice: [number, number] = [
      renormWeight * expertOutSlice[0],
      renormWeight * expertOutSlice[1],
    ];
    c0 += weightedSlice[0];
    c1 += weightedSlice[1];
    return {
      rank: rank + 1,
      expertId,
      logit,
      softmaxProb,
      renormWeight,
      expertOutSlice,
      weightedSlice,
    };
  });

  return {
    specShapes: {
      input: ["S", 2048],
      routerWeight: [2048, 128],
      routerLogits: ["S", 128],
      selectedIndices: ["S", 8],
      routingWeights: ["S", 8],
      expertGateUp: [128, 2048, 1536],
      expertAct: ["S", 8, 768],
      expertDown: [128, 768, 2048],
      combinedOut: ["S", 2048],
      numSharedExperts: 0,
    },
    tokenLabel: "存 (pos=5)",
    top8SumBeforeRenorm: top8Sum,
    renormWeightSum: renormSum,
    picks,
    combinedSlice: [c0, c1],
  };
}
