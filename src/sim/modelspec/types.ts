/**
 * ModelSpec：从 HuggingFace config.json 归一化得到的模型结构描述。
 * 它是全站唯一的形状来源：教学章时间轴、3D 网格、工作台数字都从它派生。
 */

export type AttentionKind = "mha" | "gqa" | "mqa" | "mla" | "linear_kda" | "dsa";

export interface AttentionSpec {
  kind: AttentionKind;
  numHeads: number;
  numKvHeads: number;
  headDim: number;
  /** Qwen3 系列在 RoPE 前对 q/k 做 per-head RMSNorm */
  qkNorm: boolean;
  bias: boolean;
  ropeTheta: number;
  /** MLA 专用（M2） */
  qLoraRank?: number;
  kvLoraRank?: number;
  qkRopeHeadDim?: number;
  qkNopeHeadDim?: number;
  vHeadDim?: number;
}

export type MlpSpec =
  | { kind: "dense"; intermediate: number; act: string }
  | {
      kind: "moe";
      numExperts: number;
      topK: number;
      moeIntermediate: number;
      numSharedExperts: number;
      sharedIntermediate: number;
      normTopkProb: boolean;
      act: string;
    };

export interface LayerSpec {
  index: number;
  attention: AttentionSpec;
  mlp: MlpSpec;
}

export type Dtype = "bfloat16" | "float16" | "float32" | "int8" | "fp8";

export interface ModelSpec {
  id: string;
  name: string;
  modelType: string;
  architectures: string[];
  hidden: number;
  numLayers: number;
  vocab: number;
  tieWordEmbeddings: boolean;
  rmsNormEps: number;
  dtype: Dtype;
  /** 权重每参数字节（按 dtype；量化模型在 M2 扩展为分模块） */
  bytesPerParam: number;
  initializerRange: number;
  maxPosition: number;
  /** 逐层描述，支持异构模型（不同层不同注意力/MLP 类型） */
  layers: LayerSpec[];
  /** MTP / NextN 预测层数 */
  numMtpLayers: number;
  /** config 中存在但解析器未使用的字段，页面上显式列出 */
  unrecognized: string[];
  source: { url?: string; note?: string };
}

export const DTYPE_BYTES: Record<Dtype, number> = {
  bfloat16: 2,
  float16: 2,
  float32: 4,
  int8: 1,
  fp8: 1,
};

/** 便捷派生 */
export function attnQDim(a: AttentionSpec): number {
  return a.numHeads * a.headDim;
}
export function attnKvDim(a: AttentionSpec): number {
  return a.numKvHeads * a.headDim;
}
export function isHomogeneous(spec: ModelSpec): boolean {
  const first = spec.layers[0];
  if (!first) return true;
  return spec.layers.every((l) => l.attention.kind === first.attention.kind && l.mlp.kind === first.mlp.kind);
}
