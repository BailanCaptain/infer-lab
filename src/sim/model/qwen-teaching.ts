/**
 * Qwen3-8B（标准稠密基座）与 Qwen3-30B-A3B（标准稀疏 MoE 对照）的确定性教学规格与校验契约。
 *
 * 所有形状与 KV Cache 核算均从官方 config.json（经 `getPresetSpec` 解析）与 `forwardLayer` / `qwenMoeExample` 算子派生，
 * 保证 3D 舞台、2D 架构图谱与单元测试共享同一份单一真相源。
 */
import { kvBytesPerTokenLayer } from "../modelspec/analyze";
import { getPresetSpec } from "../modelspec/presets";
import { attnKvDim, attnQDim, type ModelSpec } from "../modelspec/types";
import { fromArray } from "../tensor/tensor";
import type { Timeline } from "../timeline/types";
import { buildLayerTimeline } from "./forwardLayer";
import { getTokenPreset } from "./presets";
import {
  buildQwenMoeHandCalcExample,
  extractQwenMoeOptions,
  forwardQwenMoeBlock,
  type QwenMoeHandCalcExample,
} from "./qwenMoeExample";

export type QwenTeachingVariantId = "8b" | "30b-a3b";

export interface QwenVariantSummary {
  variant: QwenTeachingVariantId;
  specId: "qwen3-8b" | "qwen3-30b-a3b";
  name: string;
  tagline: string;
  numLayers: number;
  hidden: number;
  vocab: number;
  tieWordEmbeddings: boolean;
  numHeads: number;
  numKvHeads: number;
  headDim: number;
  gqaRatio: number;
  qDim: number;
  kvDim: number;
  qkNorm: boolean;
  ropeTheta: number;
  ffnKind: "dense" | "moe";
  intermediate: number;
  numExperts: number;
  topK: number;
  numSharedExperts: number;
  normTopkProb: boolean;
  dtypeBytes: number;
  kvBytesPerTokenLayer: number;
  kvBytesPerTokenTotal: number;
}

export interface QwenTeachingSegmentSpec {
  n: number;
  part: "input" | "attn" | "ffn" | "stack" | "output";
  title: string;
  comp: "embed" | "norm" | "attn" | "resid" | "dense" | "router" | "expert";
  /** 对应 `forwardLayer` 录制出的 step id（跨层/输出段可为空） */
  forwardStepIds: string[];
  /** 8B 稠密模式的张量形状流 */
  flow8b: string[];
  /** 30B-A3B MoE 模式的张量形状流 */
  flow30b: string[];
  summary: string;
  beats: string[];
}

export interface QwenForwardContractReport {
  spec8b: QwenVariantSummary;
  spec30b: QwenVariantSummary;
  timeline8b: Timeline;
  stepCount8b: number;
  shapeChain8b: Record<string, number[]>;
  moeHandCalc: QwenMoeHandCalcExample;
  moeRealWeightSum: number;
  moeRealNumSharedExperts: 0;
  moeRealOutShape: number[];
}

function summarizeVariant(variant: QwenTeachingVariantId): QwenVariantSummary {
  const specId = variant === "8b" ? "qwen3-8b" : "qwen3-30b-a3b";
  const spec: ModelSpec = getPresetSpec(specId);
  const layer0 = spec.layers[0];
  if (!layer0) throw new Error(`${spec.name} 缺少第 0 层规格`);
  const a = layer0.attention;
  const kvPerLayer = kvBytesPerTokenLayer(a, spec.bytesPerParam);
  const isMoe = layer0.mlp.kind === "moe";

  return {
    variant,
    specId,
    name: spec.name,
    tagline: isMoe
      ? "48 层稀疏 MoE（GQA 8:1 · 128 选 8 Softmax 重归一 · 0 共享专家）"
      : "36 层标准稠密 Transformer（GQA 4:1 · 逐头 QK-Norm · SwiGLU）",
    numLayers: spec.numLayers,
    hidden: spec.hidden,
    vocab: spec.vocab,
    tieWordEmbeddings: spec.tieWordEmbeddings,
    numHeads: a.numHeads,
    numKvHeads: a.numKvHeads,
    headDim: a.headDim,
    gqaRatio: a.numHeads / a.numKvHeads,
    qDim: attnQDim(a),
    kvDim: attnKvDim(a),
    qkNorm: a.qkNorm,
    ropeTheta: a.ropeTheta,
    ffnKind: layer0.mlp.kind === "moe" ? "moe" : "dense",
    intermediate: layer0.mlp.kind === "moe" ? layer0.mlp.moeIntermediate : layer0.mlp.intermediate,
    numExperts: layer0.mlp.kind === "moe" ? layer0.mlp.numExperts : 1,
    topK: layer0.mlp.kind === "moe" ? layer0.mlp.topK : 1,
    numSharedExperts: layer0.mlp.kind === "moe" ? layer0.mlp.numSharedExperts : 0,
    normTopkProb: layer0.mlp.kind === "moe" ? layer0.mlp.normTopkProb : false,
    dtypeBytes: spec.bytesPerParam,
    kvBytesPerTokenLayer: kvPerLayer,
    kvBytesPerTokenTotal: kvPerLayer * spec.numLayers,
  };
}

export const QWEN3_VARIANTS: Record<QwenTeachingVariantId, QwenVariantSummary> = {
  "8b": summarizeVariant("8b"),
  "30b-a3b": summarizeVariant("30b-a3b"),
};

export const QWEN3_TEACHING_SEGMENTS: readonly QwenTeachingSegmentSpec[] = [
  {
    n: 1,
    part: "input",
    title: "输入分词（词 → token ID）",
    comp: "embed",
    forwardStepIds: ["embed.gather"],
    flow8b: ["文本 6 词", "token ID [6]"],
    flow30b: ["文本 6 词", "token ID [6]"],
    summary: "将「大模型推理需要显存」按 Qwen3 151,936 词表切分为 6 个整数编号，作为整条推理链路的起点。",
    beats: ["按 BPE 词表切分为 6 个词元", "查出 6 个整数 token ID"],
  },
  {
    n: 2,
    part: "input",
    title: "词嵌入查表（Embedding）",
    comp: "embed",
    forwardStepIds: ["embed.gather"],
    flow8b: ["ids [6]", "E [151936, 4096]", "X₀ [6, 4096]"],
    flow30b: ["ids [6]", "E [151936, 2048]", "X₀ [6, 2048]"],
    summary: "每个 token ID 直接索引词嵌入表 E 的对应行（不作矩阵乘），拼出单路残差主干输入 X₀。",
    beats: ["按行号读取词嵌入表 E", "6 个词向量拼成第 0 层单路输入 X₀"],
  },
  {
    n: 3,
    part: "attn",
    title: "注意力前 RMSNorm（Pre-Norm）",
    comp: "norm",
    forwardStepIds: ["L0.ln1"],
    flow8b: ["X₀ [6, 4096]", "γ [4096]", "X_n [6, 4096]"],
    flow30b: ["X₀ [6, 2048]", "γ [2048]", "X_n [6, 2048]"],
    summary: "对每个 token 的隐藏向量求均方根并缩放，保留单路残差主干原值不动。",
    beats: ["逐 token 计算均方根 RMS", "乘以可学习缩放 γ 得到 X_n"],
  },
  {
    n: 4,
    part: "attn",
    title: "Q / K / V 线性投影（GQA 分组）",
    comp: "attn",
    forwardStepIds: ["L0.attn.q", "L0.attn.k", "L0.attn.v"],
    flow8b: ["X_n [6, 4096]", "Q [6, 32, 128]", "K/V [6, 8, 128] (4:1)"],
    flow30b: ["X_n [6, 2048]", "Q [6, 32, 128]", "K/V [6, 4, 128] (8:1)"],
    summary:
      "Q 保留 32 个查询头；K/V 压缩为 8 头（8B，4:1 GQA）或 4 头（30B-A3B，8:1 GQA），大幅减少 KV 显存。",
    beats: ["W_q 投出 32 个 Q 头（每头 128 维）", "W_k / W_v 投出更少的 KV 头形成 GQA 分组"],
  },
  {
    n: 5,
    part: "attn",
    title: "逐头 QK-Norm（Qwen3 标志设计）",
    comp: "norm",
    forwardStepIds: ["L0.attn.qknorm"],
    flow8b: ["Q/K [6, n_h, 128]", "q_norm/k_norm [128]", "归一化 Q/K"],
    flow30b: ["Q/K [6, n_h, 128]", "q_norm/k_norm [128]", "归一化 Q/K"],
    summary: "在 RoPE 旋转之前，对每个头的 128 维向量单独做 RMSNorm，抑制深层注意力 logits 漂移；V 不参与。",
    beats: ["对 Q 的 32 个头逐头做 128 维 RMSNorm", "对 K 的 KV 头逐头归一化，V 保持原样"],
  },
  {
    n: 6,
    part: "attn",
    title: "RoPE 旋转位置编码（θ = 1,000,000）",
    comp: "attn",
    forwardStepIds: ["L0.attn.rope"],
    flow8b: ["pos 0..5", "Q/K 逐对旋转 (θ=1e6)", "带相对位置信息的 Q'/K'"],
    flow30b: ["pos 0..5", "Q/K 逐对旋转 (θ=1e6)", "带相对位置信息的 Q'/K'"],
    summary: "将每头 128 维配成 64 对分量，按位置角度 pos·θ^(-2k/d_h) 旋转；使 Q·Kᵀ 自然感知相对距离。",
    beats: ["低频与高频旋转角由 θ=1,000,000 决定", "位置 0 不转，越靠后的词转角越大；V 不旋转"],
  },
  {
    n: 7,
    part: "attn",
    title: "写入 KV Cache 与显存核算",
    comp: "attn",
    forwardStepIds: ["L0.kv.write"],
    flow8b: ["K'/V [6, 8, 128]", "KV Block [6, 2, 8, 128]", "4,096 B/tok/层"],
    flow30b: ["K'/V [6, 4, 128]", "KV Block [6, 2, 4, 128]", "2,048 B/tok/层"],
    summary:
      "将 RoPE 后的 K' 与 V 写入本层 KV Cache；8B 每 token 每层占 4 KiB（36 层 144 KiB），30B-A3B 仅占 2 KiB（48 层 96 KiB）。",
    beats: ["把当前步的 K' 与 V 落入本层 KV 槽位", "核算 2·n_kv·d_h·2B：GQA 直接把显存压至 1/4 或 1/8"],
  },
  {
    n: 8,
    part: "attn",
    title: "分组注意力打分 QKᵀ/√128 与因果掩码",
    comp: "attn",
    forwardStepIds: ["L0.attn.scores", "L0.attn.mask"],
    flow8b: ["Q' [6, 32, 128] · K'ᵀ", "Scores [32, 6, 6]", "上三角置 −∞"],
    flow30b: ["Q' [6, 32, 128] · K'ᵀ", "Scores [32, 6, 6]", "上三角置 −∞"],
    summary: "每组 4 个（8B）或 8 个（30B-A3B）Q 头共享 1 个 K 头点积缩放，再用因果掩码屏蔽未来位置 j > i。",
    beats: ["GQA 分组点积并除以 √128", "上三角（未来词）填 −∞，确保严格因果"],
  },
  {
    n: 9,
    part: "attn",
    title: "Softmax 概率与 P·V 加权合头",
    comp: "attn",
    forwardStepIds: ["L0.attn.softmax", "L0.attn.pv", "L0.attn.merge"],
    flow8b: ["P [32, 6, 6]", "P·V [6, 32, 128]", "拼接 [6, 4096]"],
    flow30b: ["P [32, 6, 6]", "P·V [6, 32, 128]", "拼接 [6, 4096]"],
    summary: "逐行 Softmax 得到和为 1 的注意力权重，加权汇聚所属 V 头并把 32 头拼接回 4096 维。",
    beats: ["每行 Softmax 归一化为概率分布", "按权重加权 V 向量并拼接 32 个头"],
  },
  {
    n: 10,
    part: "attn",
    title: "输出投影 W_o 与残差相加①",
    comp: "resid",
    forwardStepIds: ["L0.attn.o", "L0.res1"],
    flow8b: ["Ctx [6, 4096] · W_o [4096, 4096]", "Attn(X) [6, 4096]", "res1 = X₀ + Attn(X)"],
    flow30b: ["Ctx [6, 4096] · W_o [4096, 2048]", "Attn(X) [6, 2048]", "res1 = X₀ + Attn(X)"],
    summary:
      "W_o 混合多头语义并映射回隐藏维 H，直接加回单路残差主干 X₀（区别于 GLM-5.3-Flash 的 4 路 mHC）。",
    beats: ["乘以 W_o 跨头混合并回到隐藏维 H", "逐元素加回 X₀ 形成 res1"],
  },
  {
    n: 11,
    part: "ffn",
    title: "前馈前 RMSNorm（第二处 Pre-Norm）",
    comp: "norm",
    forwardStepIds: ["L0.ln2"],
    flow8b: ["res1 [6, 4096]", "γ₂ [4096]", "X_ffn [6, 4096]"],
    flow30b: ["res1 [6, 2048]", "γ₂ [2048]", "X_ffn [6, 2048]"],
    summary: "进入前馈子块前再做一次逐行 RMSNorm，保持残差主干 res1 原样旁路向下传递。",
    beats: ["从残差主干 res1 分支读入", "逐 token 归一化生成前馈输入 X_ffn"],
  },
  {
    n: 12,
    part: "ffn",
    title: "前馈网络：SwiGLU 稠密 vs 128选8 稀疏 MoE",
    comp: "dense",
    forwardStepIds: ["L0.mlp.gate", "L0.mlp.up", "L0.mlp.act", "L0.mlp.down"],
    flow8b: ["X_ffn [6, 4096]", "gate/up [6, 12288]", "SiLU⊙up → W_down [6, 4096]"],
    flow30b: [
      "Router [2048, 128] → Softmax Top-8 (Σw=1)",
      "8×SwiGLU (I_moe=768, 0 共享)",
      "加权求和 [6, 2048]",
    ],
    summary:
      "Qwen3-8B 使用整块稠密 SwiGLU（4096→12288→4096）；切到 Qwen3-30B-A3B 可对照 128 选 8 纯 Softmax 重归一 MoE（无共享专家）。",
    beats: [
      "稠密路：W_gate/W_up 升维至 12288 做 SiLU 门控",
      "稀疏 MoE 对照：128 专家 FP32 Softmax Top-8 重归一（Σw=1.0，0 共享专家）",
      "下投影回隐藏维 H",
    ],
  },
  {
    n: 13,
    part: "ffn",
    title: "残差相加②与单层输出",
    comp: "resid",
    forwardStepIds: ["L0.res2"],
    flow8b: ["res1 [6, 4096] + FFN [6, 4096]", "X₁ [6, 4096]"],
    flow30b: ["res1 [6, 2048] + MoE [6, 2048]", "X₁ [6, 2048]"],
    summary: "前馈输出加回 res1，完成一整层 Decoder Layer，输出形状与输入完全一致。",
    beats: ["前馈增量加回 res1 残差主干", "输出 X₁ 直接送入第 1 层"],
  },
  {
    n: 14,
    part: "stack",
    title: "同构深层堆叠（36 层 / 48 层）",
    comp: "resid",
    forwardStepIds: [],
    flow8b: ["L00 → L01 → … → L35", "36 层完全同构"],
    flow30b: ["L00 → L01 → … → L47", "48 层全 MoE 同构"],
    summary:
      "不同于 GLM-5.3-Flash 的三类异构层混排，Qwen3 每一层结构完全一致、各自持有独立权重，逐层精炼表征。",
    beats: ["信号沿单路残差贯通全部同构层", "每层独立写入自己的 KV Cache"],
  },
  {
    n: 15,
    part: "output",
    title: "末层 RMSNorm 与独立 LM Head",
    comp: "embed",
    forwardStepIds: [],
    flow8b: ["X₃₆ [6, 4096] → RMSNorm", "W_head [4096, 151936] (非绑定)", "logits [151936]"],
    flow30b: ["X₄₈ [6, 2048] → RMSNorm", "W_head [2048, 151936] (非绑定)", "logits [151936]"],
    summary:
      "末层归一化后只取最后一个词的隐藏向量，乘以独立输出头 W_head（tie_word_embeddings=false），给全部 151,936 个词打分。",
    beats: ["末层 RMSNorm 统一最终表示尺度", "独立 LM Head 投向 151,936 词表维度"],
  },
  {
    n: 16,
    part: "output",
    title: "Softmax 概率与选词进入下一轮",
    comp: "embed",
    forwardStepIds: [],
    flow8b: ["logits [151936]", "Softmax 概率", "Argmax / 采样 → 下一个 token"],
    flow30b: ["logits [151936]", "Softmax 概率", "Argmax / 采样 → 下一个 token"],
    summary:
      "将词表打分转为概率分布并选出新 token；下一轮 Decode 只送入这 1 个新词，历史上下文直接从 KV Cache 读取。",
    beats: ["词表维 Softmax 算出候选概率", "选出下一词并转入增量 Decode 循环"],
  },
];

/**
 * 端到端校验 Qwen3-8B（真实尺寸 `forwardLayer` 21 步）与 Qwen3-30B-A3B（`qwenMoeExample` 128 选 8 重归一）契约。
 */
export function verifyQwen3ForwardContract(presetId = "kv-cache"): QwenForwardContractReport {
  const preset = getTokenPreset(presetId);
  const spec8bRaw = getPresetSpec("qwen3-8b");
  const timeline8b = buildLayerTimeline(spec8bRaw, preset, { layerIndex: 0, chapterId: "03" });

  const shapeChain8b: Record<string, number[]> = {};
  for (const [id, rec] of Object.entries(timeline8b.tensors)) {
    shapeChain8b[id] = [...rec.shape];
  }

  const spec30bRaw = getPresetSpec("qwen3-30b-a3b");
  const moeOpts = extractQwenMoeOptions(spec30bRaw, 0);
  const sampleH = moeOpts.hidden;
  const xSample = new Float32Array(sampleH);
  for (let i = 0; i < sampleH; i++) {
    xSample[i] = Math.sin((i + 1) * 0.137) * 0.25;
  }
  const moeOut = forwardQwenMoeBlock(fromArray([1, sampleH], ["S", "H"], xSample), moeOpts);
  let moeRealWeightSum = 0;
  for (let k = 0; k < moeOpts.topK; k++) {
    moeRealWeightSum += moeOut.routingWeights.data[k] ?? 0;
  }

  return {
    spec8b: QWEN3_VARIANTS["8b"],
    spec30b: QWEN3_VARIANTS["30b-a3b"],
    timeline8b,
    stepCount8b: timeline8b.steps.length,
    shapeChain8b,
    moeHandCalc: buildQwenMoeHandCalcExample(),
    moeRealWeightSum,
    moeRealNumSharedExperts: moeOut.numSharedExperts,
    moeRealOutShape: [...moeOut.out.shape],
  };
}
