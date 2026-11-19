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
  type EngramSpec,
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
      `暂不支持的 model_type：${modelType}（${architectures.join(", ")}）。当前支持 qwen3 / qwen3_moe / qwen2 / llama / mistral / mixtral / deepseek_v2 / deepseek_v3 / deepseek_v4 / glm4_moe_lite / kimi_linear / qwen3_next 等架构。`,
    );
  }
}

const SUPPORTED_DENSE = new Set(["qwen3", "qwen2", "llama", "mistral", "gemma2", "gemma", "internlm2", "yi"]);

const SUPPORTED_MOE = new Set(["qwen3_moe", "qwen2_moe", "mixtral"]);

const SUPPORTED_MLA = new Set(["deepseek_v2", "deepseek_v3", "deepseek_v4", "deepseek_v41", "glm4_moe_lite"]);

const SUPPORTED_KDA = new Set(["kimi_linear", "qwen3_next", "linear_kda", "kda", "bailing_moe_v3"]);

const SUPPORTED = new Set([...SUPPORTED_DENSE, ...SUPPORTED_MOE, ...SUPPORTED_MLA, ...SUPPORTED_KDA]);

function isTruthyFlag(v: unknown): boolean {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === "number") return v > 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s.length > 0 && s !== "false" && s !== "none" && s !== "0";
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

function isLinearLayerTypeName(name: unknown): boolean {
  return typeof name === "string" && /(linear|kda|gdn|deltanet)/i.test(name);
}

function parseElemBytes(raw: unknown, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim().toLowerCase();
  if (s === "int8" || s === "fp8" || s === "float8" || s === "e4m3" || s === "uint8" || s === "c8") return 1;
  if (s === "bfloat16" || s === "bf16" || s === "float16" || s === "fp16") return 2;
  if (s === "float32" || s === "fp32") return 4;
  return fallback;
}

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
  const modelTypeLower = modelType.toLowerCase();

  // Detect Wave 4 architecture flags (MLA / CSA2 / KDA / Engram)
  const hasMlaFlag =
    SUPPORTED_MLA.has(modelTypeLower) || (typeof cfg.kv_lora_rank === "number" && cfg.kv_lora_rank > 0);
  const hasCsa2Flag =
    isTruthyFlag(cfg.index_topk) ||
    isTruthyFlag(cfg.dsa) ||
    isTruthyFlag(cfg.csa2) ||
    isTruthyFlag(cfg.use_csa2) ||
    isTruthyFlag(cfg.cross_stage_attention) ||
    isTruthyFlag(cfg.uses_sfa_sparse) ||
    modelTypeLower === "deepseek_v4" ||
    modelTypeLower === "deepseek_v41" ||
    modelTypeLower.includes("csa2");
  const rawLayerTypes = Array.isArray(cfg.layer_types) ? (cfg.layer_types as unknown[]) : null;
  const hasKdaFlag =
    SUPPORTED_KDA.has(modelTypeLower) ||
    isTruthyFlag(cfg.kda) ||
    isTruthyFlag(cfg.linear_kda) ||
    isTruthyFlag(cfg.kimi_linear) ||
    isTruthyFlag(cfg.use_kda) ||
    rawLayerTypes?.some(isLinearLayerTypeName) ||
    (typeof cfg.hybrid_override_pattern === "string" &&
      /(linear|kda|gdn)/i.test(cfg.hybrid_override_pattern));
  const hasEngramFlag =
    isTruthyFlag(cfg.use_engram) ||
    isTruthyFlag(cfg.engram) ||
    isTruthyFlag(cfg.engram_layers) ||
    isTruthyFlag(cfg.engram_layer_ids) ||
    isTruthyFlag(cfg.engram_config) ||
    isTruthyFlag(cfg.engram_vocab_size) ||
    modelTypeLower.includes("engram");

  const isWave4Arch = hasMlaFlag || hasCsa2Flag || hasKdaFlag || hasEngramFlag;
  if (!SUPPORTED.has(modelTypeLower) && !isWave4Arch) {
    throw new UnsupportedModelError(modelType, architectures);
  }

  const hidden = num(cfg, "hidden_size", used);
  const numLayers = num(cfg, "num_hidden_layers", used);
  const numHeads = num(cfg, "num_attention_heads", used);
  const numKvHeadsRaw = num(cfg, "num_key_value_heads", used, numHeads);
  const vocab = num(cfg, "vocab_size", used);
  const dtypeStr = str(cfg, "torch_dtype", used, str(cfg, "dtype", used, "bfloat16"));
  const dtype = parseDtype(dtypeStr);
  const dtypeBytes = DTYPE_BYTES[dtype];

  const hasRoutedExperts =
    (typeof cfg.n_routed_experts === "number" && cfg.n_routed_experts > 0) ||
    (typeof cfg.num_experts === "number" && cfg.num_experts > 0) ||
    (typeof cfg.num_local_experts === "number" && cfg.num_local_experts > 0);
  const isMoeType = SUPPORTED_MOE.has(modelTypeLower) || hasRoutedExperts;
  const moeIntermediateRaw =
    typeof cfg.moe_intermediate_size === "number" ? cfg.moe_intermediate_size : undefined;
  const intermediateFallback =
    isMoeType && moeIntermediateRaw !== undefined
      ? moeIntermediateRaw
      : isWave4Arch
        ? Math.round(hidden * 4)
        : undefined;
  const intermediate = num(cfg, "intermediate_size", used, intermediateFallback);

  const ropeTheta = num(cfg, "rope_theta", used, 10000);
  const attentionBias = bool(cfg, "attention_bias", used, modelTypeLower === "qwen2");
  const qkNorm = bool(
    cfg,
    "qk_norm",
    used,
    modelTypeLower === "qwen3" || modelTypeLower === "qwen3_moe" || modelTypeLower === "qwen3_next",
  );

  // Build full-attention spec (standard MHA/GQA/MQA, MLA, or DSA/CSA2)
  let fullAttention: AttentionSpec;
  const rawHeadDim = num(cfg, "head_dim", used, Math.floor(hidden / numHeads));
  if (hasMlaFlag || hasCsa2Flag) {
    const kvLoraRank = hasMlaFlag ? num(cfg, "kv_lora_rank", used, 512) : undefined;
    const qLoraRankRaw = cfg.q_lora_rank;
    used.add("q_lora_rank");
    const qLoraRank = typeof qLoraRankRaw === "number" && qLoraRankRaw > 0 ? qLoraRankRaw : undefined;
    const qkRopeHeadDim = hasMlaFlag ? num(cfg, "qk_rope_head_dim", used, 64) : undefined;
    const qkNopeHeadDim = hasMlaFlag ? num(cfg, "qk_nope_head_dim", used, 128) : undefined;
    const vHeadDim = hasMlaFlag ? num(cfg, "v_head_dim", used, 128) : undefined;

    const sparseTopK = hasCsa2Flag ? num(cfg, "index_topk", used, 2048) : undefined;
    const indexHeadDim = hasCsa2Flag ? num(cfg, "index_head_dim", used, 128) : undefined;
    const indexNumHeads = hasCsa2Flag
      ? typeof cfg.index_n_heads === "number"
        ? num(cfg, "index_n_heads", used)
        : num(cfg, "index_num_heads", used, 64)
      : undefined;
    used.add("index_n_heads");
    used.add("index_num_heads");
    used.add("indexer_kv_dtype");
    const indexerKvElemBytes = hasCsa2Flag ? parseElemBytes(cfg.indexer_kv_dtype, 1) : undefined;

    const headDim = hasMlaFlag ? (qkNopeHeadDim ?? 128) + (qkRopeHeadDim ?? 64) : rawHeadDim;
    const effectiveKvHeads = hasMlaFlag ? 1 : numKvHeadsRaw;

    fullAttention = {
      kind: hasCsa2Flag ? "dsa" : "mla",
      numHeads,
      numKvHeads: effectiveKvHeads,
      headDim,
      qkNorm,
      bias: attentionBias,
      ropeTheta,
      ...(qLoraRank !== undefined ? { qLoraRank } : {}),
      ...(kvLoraRank !== undefined ? { kvLoraRank } : {}),
      ...(qkRopeHeadDim !== undefined ? { qkRopeHeadDim } : {}),
      ...(qkNopeHeadDim !== undefined ? { qkNopeHeadDim } : {}),
      ...(vHeadDim !== undefined ? { vHeadDim } : {}),
      ...(sparseTopK !== undefined ? { sparseTopK } : {}),
      ...(indexHeadDim !== undefined ? { indexHeadDim } : {}),
      ...(indexNumHeads !== undefined ? { indexNumHeads } : {}),
      ...(indexerKvElemBytes !== undefined ? { indexerKvElemBytes } : {}),
    };
  } else {
    fullAttention = {
      kind: numKvHeadsRaw === numHeads ? "mha" : numKvHeadsRaw === 1 ? "mqa" : "gqa",
      numHeads,
      numKvHeads: numKvHeadsRaw,
      headDim: rawHeadDim,
      qkNorm,
      bias: attentionBias,
      ropeTheta,
    };
  }

  // Build linear/KDA attention spec when hybrid or pure linear
  let linearAttention: AttentionSpec | null = null;
  if (hasKdaFlag) {
    const linearNumKeyHeads =
      typeof cfg.linear_num_key_heads === "number"
        ? num(cfg, "linear_num_key_heads", used)
        : typeof cfg.num_k_heads === "number"
          ? num(cfg, "num_k_heads", used)
          : numHeads;
    const linearNumValueHeads =
      typeof cfg.linear_num_value_heads === "number"
        ? num(cfg, "linear_num_value_heads", used)
        : typeof cfg.num_v_heads === "number"
          ? num(cfg, "num_v_heads", used)
          : numHeads;
    const linearKeyHeadDim =
      typeof cfg.linear_key_head_dim === "number"
        ? num(cfg, "linear_key_head_dim", used)
        : typeof cfg.head_k_dim === "number"
          ? num(cfg, "head_k_dim", used)
          : rawHeadDim;
    const linearValueHeadDim =
      typeof cfg.linear_value_head_dim === "number"
        ? num(cfg, "linear_value_head_dim", used)
        : typeof cfg.head_v_dim === "number"
          ? num(cfg, "head_v_dim", used)
          : rawHeadDim;
    const linearConvKernelDim =
      typeof cfg.linear_conv_kernel_dim === "number"
        ? num(cfg, "linear_conv_kernel_dim", used)
        : num(cfg, "conv_kernel_size", used, 4);
    used.add("linear_num_key_heads");
    used.add("linear_num_value_heads");
    used.add("linear_key_head_dim");
    used.add("linear_value_head_dim");
    used.add("num_k_heads");
    used.add("num_v_heads");
    used.add("head_k_dim");
    used.add("head_v_dim");
    used.add("linear_conv_kernel_dim");
    used.add("conv_kernel_size");
    used.add("linear_state_dtype");
    used.add("mamba_ssm_cache_dtype");
    const linearStateDtypeBytes = parseElemBytes(cfg.linear_state_dtype ?? cfg.mamba_ssm_cache_dtype, 4);

    linearAttention = {
      kind: "linear_kda",
      numHeads: linearNumValueHeads,
      numKvHeads: linearNumKeyHeads,
      headDim: linearValueHeadDim,
      qkNorm: false,
      bias: attentionBias,
      ropeTheta,
      linearNumKeyHeads,
      linearNumValueHeads,
      linearKeyHeadDim,
      linearValueHeadDim,
      linearConvKernelDim,
      linearStateDtypeBytes,
      linearConvDtypeBytes: dtypeBytes,
    };
  }

  const fullAttnInterval = num(cfg, "full_attention_interval", used, 4);
  used.add("layer_types");
  used.add("hybrid_override_pattern");

  const attentionForLayer = (layerIdx: number): AttentionSpec => {
    if (!linearAttention) return fullAttention;
    if (rawLayerTypes && rawLayerTypes.length > 0) {
      const entry = rawLayerTypes[layerIdx % rawLayerTypes.length];
      return isLinearLayerTypeName(entry) ? linearAttention : fullAttention;
    }
    if (bool(cfg, "all_linear", used, false)) return linearAttention;
    const interval = Math.max(1, fullAttnInterval);
    return (layerIdx + 1) % interval === 0 ? fullAttention : linearAttention;
  };

  const act = str(cfg, "hidden_act", used, str(cfg, "hidden_activation", used, "silu"));

  // MLP：支持 qwen3_moe / qwen2_moe / mixtral / deepseek_v2/v3/v4 MoE（含 first_k_dense_replace / n_routed_experts / n_shared_experts）
  let layers: LayerSpec[];
  if (isMoeType) {
    const numExperts =
      typeof cfg.n_routed_experts === "number"
        ? num(cfg, "n_routed_experts", used)
        : typeof cfg.num_experts === "number"
          ? num(cfg, "num_experts", used)
          : num(cfg, "num_local_experts", used);
    used.add("n_routed_experts");
    used.add("num_experts");
    used.add("num_local_experts");
    const topK = num(cfg, "num_experts_per_tok", used, 8);
    const moeIntermediate = num(
      cfg,
      "moe_intermediate_size",
      used,
      modelTypeLower === "mixtral" ? intermediate : undefined,
    );
    const sharedIntermediateRaw = num(cfg, "shared_expert_intermediate_size", used, 0);
    const numSharedRaw =
      typeof cfg.num_shared_experts === "number"
        ? num(cfg, "num_shared_experts", used)
        : typeof cfg.n_shared_experts === "number"
          ? num(cfg, "n_shared_experts", used)
          : sharedIntermediateRaw > 0
            ? 1
            : 0;
    used.add("num_shared_experts");
    used.add("n_shared_experts");
    const numSharedExperts = Math.max(0, numSharedRaw);
    const sharedIntermediate =
      numSharedExperts > 0 ? (sharedIntermediateRaw > 0 ? sharedIntermediateRaw : moeIntermediate) : 0;
    const normTopkProb = bool(cfg, "norm_topk_prob", used, false);
    const sparseStep = num(cfg, "decoder_sparse_step", used, num(cfg, "moe_layer_freq", used, 1));
    const firstKDenseReplace = Math.max(0, num(cfg, "first_k_dense_replace", used, 0));
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
      numSharedExperts,
      sharedIntermediate,
      normTopkProb,
      act,
    };
    const dense: MlpSpec = { kind: "dense", intermediate, act };
    layers = Array.from({ length: numLayers }, (_, i) => ({
      index: i,
      attention: attentionForLayer(i),
      // Dense for i < first_k_dense_replace or mlp_only_layers; otherwise MoE when (i+1) % sparse_step == 0
      mlp:
        i >= firstKDenseReplace && !mlpOnly.has(i) && numExperts > 0 && (i + 1) % sparseStep === 0
          ? moe
          : dense,
    }));
  } else {
    const dense: MlpSpec = { kind: "dense", intermediate, act };
    layers = Array.from({ length: numLayers }, (_, i) => ({
      index: i,
      attention: attentionForLayer(i),
      mlp: dense,
    }));
  }

  // Engram conditional memory parsing
  let engram: EngramSpec | undefined;
  if (hasEngramFlag) {
    const ec =
      cfg.engram_config && typeof cfg.engram_config === "object" && !Array.isArray(cfg.engram_config)
        ? (cfg.engram_config as Json)
        : {};
    used.add("engram");
    used.add("use_engram");
    used.add("engram_config");
    used.add("engram_vocab_size");
    used.add("engram_hidden_size");
    used.add("engram_layers");
    used.add("engram_layer_ids");
    used.add("engram_dp_shared_memory");
    used.add("etp_size");
    used.add("engram_tp_size");

    const rawLayers = cfg.engram_layers ?? cfg.engram_layer_ids ?? ec.engram_layers ?? ec.layer_ids;
    const layerIds = Array.isArray(rawLayers)
      ? rawLayers.filter((x): x is number => typeof x === "number")
      : typeof rawLayers === "number" && rawLayers > 0
        ? Array.from({ length: Math.min(rawLayers, numLayers) }, (_, idx) => idx)
        : [1, Math.min(15, Math.max(0, numLayers - 1))];
    const engramVocabSize =
      typeof cfg.engram_vocab_size === "number"
        ? cfg.engram_vocab_size
        : typeof ec.vocab_size === "number"
          ? ec.vocab_size
          : Math.max(vocab * 8, 1_000_000);
    const engramHiddenSize =
      typeof cfg.engram_hidden_size === "number"
        ? cfg.engram_hidden_size
        : typeof ec.hidden_size === "number"
          ? ec.hidden_size
          : Math.min(hidden, 1280);
    const dpSharedMemory = Boolean(cfg.engram_dp_shared_memory ?? ec.dp_shared_memory ?? false);
    const rawEtp = cfg.etp_size ?? cfg.engram_tp_size ?? ec.etp_size;
    const etpSize = typeof rawEtp === "number" && rawEtp >= 1 ? Math.round(rawEtp) : undefined;
    engram = {
      enabled: true,
      vocabSize: engramVocabSize,
      hiddenSize: engramHiddenSize,
      layerIds: layerIds.length > 0 ? layerIds : [1],
      dpSharedMemory,
      ...(etpSize !== undefined ? { etpSize } : {}),
      dtypeBytes,
    };
  }

  const numMtpLayers = num(cfg, "num_nextn_predict_layers", used, 0);

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
    "router_jitter_noise",
    "hidden_activation",
    "query_pre_attn_scalar",
    "final_logit_softcapping",
    "attn_logit_softcapping",
    "cache_implementation",
    "pretraining_tp",
    "mlp_bias",
    "quantization_config",
    "routed_scaling_factor",
    "scoring_func",
    "topk_method",
    "n_group",
    "topk_group",
    "ep_size",
    "aux_loss_alpha",
    "seq_aux",
    "csa2",
    "use_csa2",
    "cross_stage_attention",
    "uses_sfa_sparse",
    "dsa",
    "kda",
    "linear_kda",
    "kimi_linear",
    "use_kda",
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
    bytesPerParam: dtypeBytes,
    initializerRange: num(cfg, "initializer_range", used, 0.02),
    maxPosition: num(cfg, "max_position_embeddings", used, 32768),
    layers,
    numMtpLayers,
    ...(engram ? { engram } : {}),
    unrecognized: Object.keys(cfg).filter((k) => !used.has(k)),
    source: opts.sourceUrl ? { url: opts.sourceUrl } : nested ? { note: "text_config 嵌套" } : {},
  };
  return spec;
}
