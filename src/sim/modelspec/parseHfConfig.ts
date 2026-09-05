/**
 * HuggingFace config.json → ModelSpec。
 * 首批支持：qwen3 / qwen3_moe（以及结构相同的 qwen2 / llama）。
 * 未支持的 model_type 抛出带说明的错误；已支持类型中未使用的字段记录到 unrecognized。
 *
 * 字段语义来源 [S]：
 * - transformers Qwen3Config / Qwen3MoeConfig 文档与 modeling_qwen3*.py
 *   https://huggingface.co/docs/transformers/model_doc/qwen3
 *   https://huggingface.co/docs/transformers/model_doc/qwen3_moe
 */
import {
  type AttentionSpec,
  DTYPE_BYTES,
  type Dtype,
  type LayerSpec,
  type MlpSpec,
  type ModelSpec,
} from "./types";

type Json = Record<string, unknown>;

export class UnsupportedModelError extends Error {
  constructor(
    public readonly modelType: string,
    public readonly architectures: string[],
  ) {
    super(
      `暂不支持的 model_type：${modelType}（${architectures.join(", ")}）。首批支持 qwen3 / qwen3_moe / qwen2 / llama。`,
    );
  }
}

const SUPPORTED = new Set(["qwen3", "qwen3_moe", "qwen2", "llama"]);

/** 有些多模态 config 把语言模型放在 text_config 里 */
function unwrapTextConfig(raw: Json): { cfg: Json; nested: boolean } {
  const tc = raw.text_config;
  if (tc && typeof tc === "object" && !Array.isArray(tc)) return { cfg: tc as Json, nested: true };
  return { cfg: raw, nested: false };
}

function num(cfg: Json, key: string, used: Set<string>, fallback?: number): number {
  used.add(key);
  const v = cfg[key];
  if (typeof v === "number") return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`config 缺少数值字段 ${key}`);
}
function bool(cfg: Json, key: string, used: Set<string>, fallback: boolean): boolean {
  used.add(key);
  const v = cfg[key];
  return typeof v === "boolean" ? v : fallback;
}
function str(cfg: Json, key: string, used: Set<string>, fallback: string): string {
  used.add(key);
  const v = cfg[key];
  return typeof v === "string" ? v : fallback;
}

function parseDtype(s: string): Dtype {
  if (s in DTYPE_BYTES) return s as Dtype;
  return "bfloat16";
}

export interface ParseOptions {
  id?: string;
  name?: string;
  sourceUrl?: string;
}

export function parseHfConfig(raw: unknown, opts: ParseOptions = {}): ModelSpec {
  if (!raw || typeof raw !== "object") throw new Error("config 不是 JSON 对象");
  const root = raw as Json;
  const { cfg, nested } = unwrapTextConfig(root);
  const used = new Set<string>();
  const architectures = Array.isArray(root.architectures)
    ? (root.architectures as unknown[]).filter((a): a is string => typeof a === "string")
    : [];
  const modelType = str(cfg, "model_type", used, str(root, "model_type", new Set(), "unknown"));
  if (!SUPPORTED.has(modelType)) throw new UnsupportedModelError(modelType, architectures);

  const hidden = num(cfg, "hidden_size", used);
  const numLayers = num(cfg, "num_hidden_layers", used);
  const numHeads = num(cfg, "num_attention_heads", used);
  const numKvHeads = num(cfg, "num_key_value_heads", used, numHeads);
  const headDim = num(cfg, "head_dim", used, Math.floor(hidden / numHeads));
  const vocab = num(cfg, "vocab_size", used);
  const intermediate = num(cfg, "intermediate_size", used);
  const dtypeStr = str(cfg, "torch_dtype", used, str(cfg, "dtype", used, "bfloat16"));
  const dtype = parseDtype(dtypeStr);

  const attention: AttentionSpec = {
    kind: numKvHeads === numHeads ? "mha" : numKvHeads === 1 ? "mqa" : "gqa",
    numHeads,
    numKvHeads,
    headDim,
    qkNorm: modelType === "qwen3" || modelType === "qwen3_moe",
    bias: bool(cfg, "attention_bias", used, modelType === "qwen2"),
    ropeTheta: num(cfg, "rope_theta", used, 10000),
  };
  const act = str(cfg, "hidden_act", used, "silu");

  // MLP：qwen3_moe 支持 decoder_sparse_step 与 mlp_only_layers 指定哪些层是 dense
  let layers: LayerSpec[];
  if (modelType === "qwen3_moe") {
    const numExperts = num(cfg, "num_experts", used);
    const topK = num(cfg, "num_experts_per_tok", used);
    const moeIntermediate = num(cfg, "moe_intermediate_size", used);
    const normTopkProb = bool(cfg, "norm_topk_prob", used, false);
    const sparseStep = num(cfg, "decoder_sparse_step", used, 1);
    used.add("mlp_only_layers");
    const mlpOnly = new Set(
      Array.isArray(cfg.mlp_only_layers)
        ? (cfg.mlp_only_layers as unknown[]).filter((x): x is number => typeof x === "number")
        : [],
    );
    const moe: MlpSpec = {
      kind: "moe",
      numExperts,
      topK,
      moeIntermediate,
      numSharedExperts: 0,
      sharedIntermediate: 0,
      normTopkProb,
      act,
    };
    const dense: MlpSpec = { kind: "dense", intermediate, act };
    layers = Array.from({ length: numLayers }, (_, i) => ({
      index: i,
      attention,
      // transformers Qwen3MoeDecoderLayer：(i not in mlp_only_layers) and num_experts>0 and (i+1) % sparse_step == 0 → MoE
      mlp: !mlpOnly.has(i) && numExperts > 0 && (i + 1) % sparseStep === 0 ? moe : dense,
    }));
  } else {
    const dense: MlpSpec = { kind: "dense", intermediate, act };
    layers = Array.from({ length: numLayers }, (_, i) => ({ index: i, attention, mlp: dense }));
  }

  // 已知但不影响形状/参数量的字段，避免误报为未识别
  for (const k of [
    "architectures",
    "attention_dropout",
    "bos_token_id",
    "eos_token_id",
    "pad_token_id",
    "max_window_layers",
    "sliding_window",
    "use_sliding_window",
    "use_cache",
    "transformers_version",
    "rope_scaling",
    "output_router_logits",
    "router_aux_loss_coef",
  ])
    used.add(k);

  const spec: ModelSpec = {
    id: opts.id ?? `${modelType}-${hidden}-${numLayers}`,
    name: opts.name ?? architectures[0] ?? modelType,
    modelType,
    architectures,
    hidden,
    numLayers,
    vocab,
    tieWordEmbeddings: bool(
      cfg,
      "tie_word_embeddings",
      used,
      bool(root, "tie_word_embeddings", new Set(), false),
    ),
    rmsNormEps: num(cfg, "rms_norm_eps", used, 1e-6),
    dtype,
    bytesPerParam: DTYPE_BYTES[dtype],
    initializerRange: num(cfg, "initializer_range", used, 0.02),
    maxPosition: num(cfg, "max_position_embeddings", used, 32768),
    layers,
    numMtpLayers: 0,
    unrecognized: Object.keys(cfg).filter((k) => !used.has(k)),
    source: opts.sourceUrl ? { url: opts.sourceUrl } : nested ? { note: "text_config 嵌套" } : {},
  };
  return spec;
}
