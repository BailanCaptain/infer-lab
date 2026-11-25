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

export const HF_CONFIG_LIMITS = {
  num_hidden_layers: [1, 512] as const,
  vocab_size: [1, 2_000_000] as const,
  hidden_size: [1, 65_536] as const,
  intermediate_size: [1, 262_144] as const,
  moe_intermediate_size: [1, 262_144] as const,
  num_experts: [1, 4_096] as const,
  num_attention_heads: [1, 512] as const,
  num_key_value_heads: [1, 512] as const,
} as const;

export function assertBoundedInt(value: number, key: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`config 字段 ${key} 超出安全整数范围 [${min}, ${max}]（收到 ${String(value)}）`);
  }
  return value;
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

  const hidden = assertBoundedInt(
    num(cfg, "hidden_size", used),
    "hidden_size",
    ...HF_CONFIG_LIMITS.hidden_size,
  );
  const numLayers = assertBoundedInt(
    num(cfg, "num_hidden_layers", used),
    "num_hidden_layers",
    ...HF_CONFIG_LIMITS.num_hidden_layers,
  );
  const numHeads = assertBoundedInt(
    num(cfg, "num_attention_heads", used),
    "num_attention_heads",
    ...HF_CONFIG_LIMITS.num_attention_heads,
  );
  const numKvHeadsRaw = assertBoundedInt(
    num(cfg, "num_key_value_heads", used, numHeads),
    "num_key_value_heads",
    ...HF_CONFIG_LIMITS.num_key_value_heads,
  );
  const vocab = assertBoundedInt(num(cfg, "vocab_size", used), "vocab_size", ...HF_CONFIG_LIMITS.vocab_size);
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
  const intermediate = assertBoundedInt(
    num(cfg, "intermediate_size", used, intermediateFallback),
    "intermediate_size",
    ...HF_CONFIG_LIMITS.intermediate_size,
  );

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
    used.add("indexer_cache_dtype");
    used.add("indexer_quant");
    used.add("use_indexer_quant");
    used.add("lightning_indexer_quant");
    used.add("enable_indexer_quant");
    const rawIndexerDtype = cfg.indexer_kv_dtype ?? cfg.indexer_cache_dtype;
    const indexerKvDtype =
      hasCsa2Flag && typeof rawIndexerDtype === "string" && rawIndexerDtype.trim().length > 0
        ? rawIndexerDtype.trim().toLowerCase()
        : undefined;
    const rawIndexerQuant =
      cfg.lightning_indexer_quant ?? cfg.indexer_quant ?? cfg.use_indexer_quant ?? cfg.enable_indexer_quant;
    const parsedIndexerQuant =
      typeof rawIndexerQuant === "boolean"
        ? rawIndexerQuant
        : typeof rawIndexerQuant === "number"
          ? rawIndexerQuant !== 0
          : typeof rawIndexerQuant === "string"
            ? rawIndexerQuant.trim().toLowerCase() === "true" || rawIndexerQuant.trim() === "1"
            : undefined;
    const defaultIndexerFloatBytes = dtypeBytes >= 2 ? dtypeBytes : 2;
    const indexerKvElemBytes = hasCsa2Flag
      ? indexerKvDtype !== undefined
        ? parseElemBytes(indexerKvDtype, defaultIndexerFloatBytes)
        : parsedIndexerQuant === true
          ? 1
          : defaultIndexerFloatBytes
      : undefined;
    const indexerQuantEnabled = hasCsa2Flag
      ? parsedIndexerQuant !== undefined
        ? parsedIndexerQuant
        : (indexerKvElemBytes ?? defaultIndexerFloatBytes) <= 1
      : undefined;

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
      ...(indexerKvDtype !== undefined ? { indexerKvDtype } : {}),
      ...(indexerKvElemBytes !== undefined ? { indexerKvElemBytes } : {}),
      ...(indexerQuantEnabled !== undefined ? { indexerQuantEnabled } : {}),
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
    const expertKey =
      typeof cfg.n_routed_experts === "number"
        ? "n_routed_experts"
        : typeof cfg.num_experts === "number"
          ? "num_experts"
          : "num_local_experts";
    const numExperts = assertBoundedInt(
      num(cfg, expertKey, used),
      expertKey,
      ...HF_CONFIG_LIMITS.num_experts,
    );
    used.add("n_routed_experts");
    used.add("num_experts");
    used.add("num_local_experts");
    const topK = num(cfg, "num_experts_per_tok", used, 8);
    const moeIntermediate = assertBoundedInt(
      num(cfg, "moe_intermediate_size", used, modelTypeLower === "mixtral" ? intermediate : undefined),
      "moe_intermediate_size",
      ...HF_CONFIG_LIMITS.moe_intermediate_size,
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
        : cfg.engram && typeof cfg.engram === "object" && !Array.isArray(cfg.engram)
          ? (cfg.engram as Json)
          : {};
    used.add("engram");
    used.add("use_engram");
    used.add("engram_config");
    used.add("engram_vocab_size");
    used.add("engram_hidden_size");
    used.add("engram_layers");
    used.add("engram_layer_ids");
    used.add("engram_cpu_offload");
    used.add("cpu_offload");
    used.add("engram_dp_shared_memory");
    used.add("etp_size");
    used.add("engram_tp_size");

    const parseOptionalBool = (v: unknown): boolean | undefined => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
      }
      return undefined;
    };

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
    const dpSharedMemory = parseOptionalBool(cfg.engram_dp_shared_memory ?? ec.dp_shared_memory) ?? false;
    const rawCpuOffload =
      cfg.engram_cpu_offload ?? cfg.cpu_offload ?? ec.cpu_offload ?? ec.engram_cpu_offload;
    // Upstream vllm/config/engram.py defaults cpu_offload=True
    const cpuOffload = parseOptionalBool(rawCpuOffload) ?? true;
    const rawEtp = cfg.etp_size ?? cfg.engram_tp_size ?? ec.etp_size;
    const etpSize = typeof rawEtp === "number" && rawEtp >= 1 ? Math.round(rawEtp) : undefined;
    engram = {
      enabled: true,
      vocabSize: engramVocabSize,
      hiddenSize: engramHiddenSize,
      layerIds: layerIds.length > 0 ? layerIds : [1],
      cpuOffload,
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

const STRUCTURAL_SCALAR_KEYS = new Set<string>([
  "model_type",
  "hidden_size",
  "num_hidden_layers",
  "num_attention_heads",
  "num_key_value_heads",
  "vocab_size",
  "torch_dtype",
  "dtype",
  "intermediate_size",
  "moe_intermediate_size",
  "rope_theta",
  "attention_bias",
  "qk_norm",
  "head_dim",
  "kv_lora_rank",
  "q_lora_rank",
  "qk_rope_head_dim",
  "qk_nope_head_dim",
  "v_head_dim",
  "index_topk",
  "index_head_dim",
  "index_n_heads",
  "index_num_heads",
  "indexer_kv_dtype",
  "indexer_cache_dtype",
  "indexer_quant",
  "use_indexer_quant",
  "lightning_indexer_quant",
  "enable_indexer_quant",
  "dsa",
  "csa2",
  "use_csa2",
  "cross_stage_attention",
  "uses_sfa_sparse",
  "kda",
  "linear_kda",
  "kimi_linear",
  "use_kda",
  "hybrid_override_pattern",
  "linear_num_key_heads",
  "num_k_heads",
  "linear_num_value_heads",
  "num_v_heads",
  "linear_key_head_dim",
  "head_k_dim",
  "linear_value_head_dim",
  "head_v_dim",
  "linear_conv_kernel_dim",
  "conv_kernel_size",
  "linear_state_dtype",
  "mamba_ssm_cache_dtype",
  "full_attention_interval",
  "all_linear",
  "hidden_act",
  "hidden_activation",
  "n_routed_experts",
  "num_experts",
  "num_local_experts",
  "num_experts_per_tok",
  "shared_expert_intermediate_size",
  "num_shared_experts",
  "n_shared_experts",
  "norm_topk_prob",
  "decoder_sparse_step",
  "moe_layer_freq",
  "first_k_dense_replace",
  "use_engram",
  "engram_vocab_size",
  "engram_hidden_size",
  "engram_cpu_offload",
  "cpu_offload",
  "engram_dp_shared_memory",
  "etp_size",
  "engram_tp_size",
  "num_nextn_predict_layers",
  "tie_word_embeddings",
  "rms_norm_eps",
  "initializer_range",
  "max_position_embeddings",
  "sliding_window",
  "use_sliding_window",
  "max_window_layers",
]);

const STRUCTURAL_INT_ARRAY_KEYS = new Set<string>(["mlp_only_layers", "engram_layers", "engram_layer_ids"]);
const ENGRAM_SUBCONFIG_KEYS = new Set<string>([
  "enabled",
  "vocab_size",
  "hidden_size",
  "engram_layers",
  "layer_ids",
  "cpu_offload",
  "engram_cpu_offload",
  "dp_shared_memory",
  "etp_size",
]);
const QUANT_SUBCONFIG_KEYS = new Set<string>([
  "quant_method",
  "bits",
  "group_size",
  "activation_scheme",
  "fmt",
  "weight_block_size",
  "is_checkpoint_fp8_serialized",
]);

function isSafePrimitive(val: unknown): val is string | number | boolean {
  if (typeof val === "boolean") return true;
  if (typeof val === "number") return Number.isFinite(val);
  if (typeof val === "string") return val.length <= 120;
  return false;
}

const STRUCTURAL_TRUTHY_FLAG_KEYS = new Set<string>([
  "dsa",
  "csa2",
  "use_csa2",
  "cross_stage_attention",
  "uses_sfa_sparse",
  "kda",
  "linear_kda",
  "kimi_linear",
  "use_kda",
  "use_engram",
]);

function pickStructuralScope(scope: Json): Json {
  const out: Json = {};
  for (const [key, val] of Object.entries(scope)) {
    if (key === "architectures" && Array.isArray(val)) {
      const archs = val
        .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80)
        .slice(0, 8);
      if (archs.length > 0) out.architectures = archs;
    } else if (STRUCTURAL_TRUTHY_FLAG_KEYS.has(key)) {
      if (isSafePrimitive(val)) {
        out[key] = val;
      } else if (val !== undefined && val !== null) {
        out[key] = isTruthyFlag(val);
      }
    } else if (STRUCTURAL_SCALAR_KEYS.has(key) && isSafePrimitive(val)) {
      out[key] = val;
    } else if (key === "layer_types" && Array.isArray(val)) {
      out.layer_types = val.filter((x): x is string => typeof x === "string" && x.length <= 64).slice(0, 512);
    } else if (STRUCTURAL_INT_ARRAY_KEYS.has(key)) {
      if (Array.isArray(val)) {
        const ints = val.filter((x): x is number => Number.isSafeInteger(x)).slice(0, 512);
        if (ints.length > 0) out[key] = ints;
        else if (isTruthyFlag(val) && (key === "engram_layers" || key === "engram_layer_ids")) {
          out[key] = [1];
        }
      } else if (typeof val === "number" && Number.isFinite(val)) {
        out[key] = val;
      } else if (isTruthyFlag(val) && (key === "engram_layers" || key === "engram_layer_ids")) {
        out[key] = [1];
      }
    } else if (key === "engram_config" || key === "engram") {
      if (typeof val === "boolean") {
        out[key] = val;
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        const cleanSub: Json = {};
        for (const [sk, sv] of Object.entries(val as Json)) {
          if (!ENGRAM_SUBCONFIG_KEYS.has(sk)) continue;
          if (isSafePrimitive(sv)) cleanSub[sk] = sv;
          else if (Array.isArray(sv)) {
            cleanSub[sk] = sv.filter((x): x is number => Number.isSafeInteger(x)).slice(0, 512);
          }
        }
        if (Object.keys(cleanSub).length > 0) out[key] = cleanSub;
        else if (isTruthyFlag(val)) out[key] = key === "engram" ? true : { enabled: true };
      } else if (isTruthyFlag(val)) {
        out[key] = key === "engram" ? true : { enabled: true };
      }
    } else if (key === "quantization_config" && val && typeof val === "object" && !Array.isArray(val)) {
      const cleanQuant: Json = {};
      for (const [qk, qv] of Object.entries(val as Json)) {
        if (!QUANT_SUBCONFIG_KEYS.has(qk)) continue;
        if (isSafePrimitive(qv)) cleanQuant[qk] = qv;
        else if (Array.isArray(qv) && qv.length <= 8 && qv.every((x) => Number.isFinite(x))) {
          cleanQuant[qk] = qv;
        }
      }
      if (Object.keys(cleanQuant).length > 0) out.quantization_config = cleanQuant;
    }
  }
  return out;
}

/**
 * 提取仅含模型结构与量化维度的最小安全 HF 配置对象，剥离 token / _name_or_path 等无关或敏感字段。
 * 调用方在持久化（localStorage）或写入分享链接（customModel）前必须经过此白名单归一化。
 */
export function extractStructuralHfConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("config 不是 JSON 对象");
  }
  // Ensure the input is a valid, supported HF config first
  parseHfConfig(raw);
  const root = raw as Json;
  const { cfg, nested } = unwrapTextConfig(root);
  if (!nested) {
    return pickStructuralScope(cfg);
  }
  const top: Json = {};
  if (typeof root.model_type === "string" && root.model_type.length <= 80) {
    top.model_type = root.model_type;
  }
  if (Array.isArray(root.architectures)) {
    const archs = root.architectures
      .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80)
      .slice(0, 8);
    if (archs.length > 0) top.architectures = archs;
  }
  if (typeof root.tie_word_embeddings === "boolean") {
    top.tie_word_embeddings = root.tie_word_embeddings;
  }
  top.text_config = pickStructuralScope(cfg);
  return top;
}
