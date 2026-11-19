/**
 * 从 ModelSpec 推导参数量、激活参数量、每 token KV Cache 字节数。
 * 每个数字都附带公式项，供工作台展开显示与证据标注：
 * - 参数量公式为 [D]（由 config 形状直接推导）
 * - KV 公式 [D]：MHA/GQA/MQA 每层每 token = 2 · n_kv · d_head · bytes
 * - 假设 [A]：权重字节按 config torch_dtype 统一换算；不含优化器/激活
 */
import { type AttentionSpec, attnKvDim, attnQDim, type LayerSpec, type ModelSpec } from "./types";

export interface ParamItem {
  id: string;
  label: string;
  formula: string;
  count: number;
  /** 该项在一次前向中是否对每个 token 都参与计算（MoE 非激活专家为 false） */
  active: boolean;
}

export interface ParamBreakdown {
  total: number;
  active: number;
  nonEmbedding: number;
  items: ParamItem[];
  perLayer: { index: number; total: number; active: number }[];
}

function layerParams(l: LayerSpec, hidden: number): ParamItem[] {
  const a = l.attention;
  const items: ParamItem[] = [
    { id: "ln1", label: "input_layernorm", formula: "H", count: hidden, active: true },
  ];

  if (a.kind === "mla" || (a.kind === "dsa" && a.kvLoraRank !== undefined)) {
    const kvLora = a.kvLoraRank ?? 512;
    const qkRope = a.qkRopeHeadDim ?? 64;
    const qkNope = a.qkNopeHeadDim ?? 128;
    const vDim = a.vHeadDim ?? 128;
    const qkHead = qkNope + qkRope;
    if (a.qLoraRank && a.qLoraRank > 0) {
      items.push(
        {
          id: "q_a_proj",
          label: "q_a_proj",
          formula: "H × d_q_lora",
          count: hidden * a.qLoraRank,
          active: true,
        },
        {
          id: "q_a_norm",
          label: "q_a_layernorm",
          formula: "d_q_lora",
          count: a.qLoraRank,
          active: true,
        },
        {
          id: "q_b_proj",
          label: "q_b_proj",
          formula: "d_q_lora × n_q·(d_nope+d_rope)",
          count: a.qLoraRank * a.numHeads * qkHead,
          active: true,
        },
      );
    } else {
      items.push({
        id: "q",
        label: "q_proj",
        formula: "H × n_q·(d_nope+d_rope)",
        count: hidden * a.numHeads * qkHead,
        active: true,
      });
    }
    items.push(
      {
        id: "kv_a_proj",
        label: "kv_a_proj_with_mqa",
        formula: "H × (d_c + d_rope)",
        count: hidden * (kvLora + qkRope),
        active: true,
      },
      {
        id: "kv_a_norm",
        label: "kv_a_layernorm",
        formula: "d_c",
        count: kvLora,
        active: true,
      },
      {
        id: "kv_b_proj",
        label: "kv_b_proj",
        formula: "d_c × n_q·(d_nope+d_v)",
        count: kvLora * a.numHeads * (qkNope + vDim),
        active: true,
      },
      {
        id: "o",
        label: "o_proj",
        formula: "(n_q·d_v) × H",
        count: a.numHeads * vDim * hidden,
        active: true,
      },
    );
  } else if (a.kind === "linear_kda") {
    const nK = a.linearNumKeyHeads ?? a.numHeads;
    const nV = a.linearNumValueHeads ?? a.numHeads;
    const dK = a.linearKeyHeadDim ?? a.headDim;
    const dV = a.linearValueHeadDim ?? a.headDim;
    const convK = a.linearConvKernelDim ?? 4;
    const kDim = nK * dK;
    const vDim = nV * dV;
    items.push(
      { id: "kda_q", label: "kda.q_proj", formula: "H × (n_k·d_k)", count: hidden * kDim, active: true },
      { id: "kda_k", label: "kda.k_proj", formula: "H × (n_k·d_k)", count: hidden * kDim, active: true },
      { id: "kda_v", label: "kda.v_proj", formula: "H × (n_v·d_v)", count: hidden * vDim, active: true },
      {
        id: "kda_gate",
        label: "kda.gate_beta_proj",
        formula: "H × (n_v·d_v + n_v)",
        count: hidden * (vDim + nV),
        active: true,
      },
      {
        id: "kda_conv",
        label: "kda.short_conv",
        formula: "(n_v·d_v + 2·n_k·d_k) × k_conv",
        count: (vDim + 2 * kDim) * convK,
        active: true,
      },
      { id: "kda_o", label: "kda.o_proj", formula: "(n_v·d_v) × H", count: vDim * hidden, active: true },
    );
  } else {
    const qd = attnQDim(a);
    const kd = attnKvDim(a);
    items.push(
      {
        id: "q",
        label: "q_proj",
        formula: "H × (n_q·d_h)",
        count: hidden * qd + (a.bias ? qd : 0),
        active: true,
      },
      {
        id: "k",
        label: "k_proj",
        formula: "H × (n_kv·d_h)",
        count: hidden * kd + (a.bias ? kd : 0),
        active: true,
      },
      {
        id: "v",
        label: "v_proj",
        formula: "H × (n_kv·d_h)",
        count: hidden * kd + (a.bias ? kd : 0),
        active: true,
      },
      { id: "o", label: "o_proj", formula: "(n_q·d_h) × H", count: qd * hidden, active: true },
    );
    if (a.qkNorm) {
      items.push({ id: "qn", label: "q_norm", formula: "d_h", count: a.headDim, active: true });
      items.push({ id: "kn", label: "k_norm", formula: "d_h", count: a.headDim, active: true });
    }
  }

  if (a.kind === "dsa") {
    const idxDim = a.indexHeadDim ?? 128;
    const idxHeads = a.indexNumHeads ?? 64;
    const qIn = a.qLoraRank ?? hidden;
    items.push({
      id: "dsa_indexer",
      label: "sparse_indexer (wq_b + wk_weights)",
      formula: "d_in × (n_idx·d_idx) + H × (d_idx + n_idx)",
      count: qIn * idxHeads * idxDim + hidden * (idxDim + idxHeads),
      active: true,
    });
  }

  items.push({ id: "ln2", label: "post_attention_layernorm", formula: "H", count: hidden, active: true });
  if (l.mlp.kind === "dense") {
    const I = l.mlp.intermediate;
    items.push({ id: "gate", label: "gate_proj", formula: "H × I", count: hidden * I, active: true });
    items.push({ id: "up", label: "up_proj", formula: "H × I", count: hidden * I, active: true });
    items.push({ id: "down", label: "down_proj", formula: "I × H", count: I * hidden, active: true });
  } else {
    const m = l.mlp;
    const perExpert = 3 * hidden * m.moeIntermediate;
    items.push({
      id: "router",
      label: "mlp.gate (router)",
      formula: "H × E",
      count: hidden * m.numExperts,
      active: true,
    });
    items.push({
      id: "experts_active",
      label: `激活专家 ×${m.topK}`,
      formula: "k × 3 × H × I_moe",
      count: m.topK * perExpert,
      active: true,
    });
    items.push({
      id: "experts_idle",
      label: `未激活专家 ×${m.numExperts - m.topK}`,
      formula: "(E − k) × 3 × H × I_moe",
      count: (m.numExperts - m.topK) * perExpert,
      active: false,
    });
    if (m.numSharedExperts > 0) {
      items.push({
        id: "shared",
        label: `共享专家 ×${m.numSharedExperts}`,
        formula: "n_s × 3 × H × I_s",
        count: m.numSharedExperts * 3 * hidden * m.sharedIntermediate,
        active: true,
      });
    }
  }
  return items;
}

export function analyzeParams(spec: ModelSpec): ParamBreakdown {
  const items: ParamItem[] = [];
  const emb = spec.vocab * spec.hidden;
  items.push({ id: "embed", label: "embed_tokens", formula: "V × H", count: emb, active: true });
  const perLayer: ParamBreakdown["perLayer"] = [];
  let layerTotal = 0;
  let layerActive = 0;
  const allLayerItems: ParamItem[][] = [];
  for (const l of spec.layers) {
    const li = layerParams(l, spec.hidden);
    allLayerItems.push(li);
    const t = li.reduce((s, x) => s + x.count, 0);
    const act = li.filter((x) => x.active).reduce((s, x) => s + x.count, 0);
    perLayer.push({ index: l.index, total: t, active: act });
    layerTotal += t;
    layerActive += act;
  }
  // 合并所有层出现的参数项（兼容异构层如 DeepSeek-V3 first_k_dense_replace 与 KDA+GQA 混合栈）
  const seenIds = new Map<string, { template: ParamItem; count: number; layersWithId: number }>();
  for (const li of allLayerItems) {
    for (const it of li) {
      const existing = seenIds.get(it.id);
      if (existing) {
        existing.count += it.count;
        existing.layersWithId += 1;
      } else {
        seenIds.set(it.id, { template: it, count: it.count, layersWithId: 1 });
      }
    }
  }
  for (const [id, entry] of seenIds) {
    const sameAcrossLayers = entry.layersWithId === spec.numLayers;
    items.push({
      ...entry.template,
      id: `layers.${id}`,
      label: `${entry.template.label} × ${entry.layersWithId} 层${sameAcrossLayers ? "" : "（异构层）"}`,
      formula: `${entry.layersWithId} × ${entry.template.formula}`,
      count: entry.count,
    });
  }
  let engramTotal = 0;
  if (spec.engram?.enabled) {
    engramTotal = spec.engram.layerIds.length * spec.engram.vocabSize * spec.engram.hiddenSize;
    items.push({
      id: "engram_tables",
      label: `engram_tables（${spec.engram.layerIds.length} 层，${spec.engram.dpSharedMemory ? "Host DRAM 卸载" : "NPU HBM 常驻"}）`,
      formula: `${spec.engram.layerIds.length} × V_engram × H_engram`,
      count: engramTotal,
      active: false,
    });
  }
  items.push({ id: "norm", label: "model.norm", formula: "H", count: spec.hidden, active: true });
  const lmHead = spec.tieWordEmbeddings ? 0 : spec.vocab * spec.hidden;
  items.push({
    id: "lm_head",
    label: spec.tieWordEmbeddings ? "lm_head（与 embed 共享，不重复计）" : "lm_head",
    formula: spec.tieWordEmbeddings ? "0（tie_word_embeddings）" : "H × V",
    count: lmHead,
    active: true,
  });
  const total = emb + layerTotal + engramTotal + spec.hidden + lmHead;
  const active = emb + layerActive + spec.hidden + lmHead;
  return { total, active, nonEmbedding: layerTotal + engramTotal + spec.hidden, items, perLayer };
}

/** 稀疏索引器单层每 token 字节（DeepseekV32IndexerCache: head_dim * elemBytes + scale） */
export function indexerBytesPerTokenLayer(a: AttentionSpec): number {
  if (a.kind !== "dsa") return 0;
  const idxDim = a.indexHeadDim ?? 128;
  const idxElem = a.indexerKvElemBytes ?? 1;
  const scaleBytes = idxElem <= 1 ? Math.max(1, Math.floor(idxDim / 128)) * 4 : 0;
  return idxDim * idxElem + scaleBytes;
}

/** 单层每 token 的分页 KV 字节：
 * - MHA/GQA/MQA：2 · n_kv · d_h · bytes [D01]
 * - MLA：(kv_lora_rank + qk_rope_head_dim) · bytes（单潜向量头，无 ×2）
 * - DSA/CSA2：基线 KV/潜向量 + 稀疏索引器 k_cache
 * - linear_kda：0（无按 token 增长的 KV Cache，改为每并发序列固定递推状态）
 */
export function kvBytesPerTokenLayer(a: AttentionSpec, kvDtypeBytes: number): number {
  if (a.kind === "linear_kda") return 0;
  if (a.kind === "mla") {
    return ((a.kvLoraRank ?? 512) + (a.qkRopeHeadDim ?? 64)) * kvDtypeBytes;
  }
  if (a.kind === "dsa") {
    const base =
      a.kvLoraRank !== undefined
        ? (a.kvLoraRank + (a.qkRopeHeadDim ?? 64)) * kvDtypeBytes
        : 2 * a.numKvHeads * a.headDim * kvDtypeBytes;
    return base + indexerBytesPerTokenLayer(a);
  }
  return 2 * a.numKvHeads * a.headDim * kvDtypeBytes;
}

/** KDA / 线性注意力单层每条并发序列固定状态字节（S 递推矩阵 + short conv，与上下文长度无关） */
export function linearStateBytesPerSeqLayer(
  a: AttentionSpec,
  tpSize = 1,
): {
  recurrentBytes: number;
  convBytes: number;
  totalBytes: number;
} {
  if (a.kind !== "linear_kda") return { recurrentBytes: 0, convBytes: 0, totalBytes: 0 };
  const safeTp = Math.max(1, tpSize);
  const localVHeads = Math.max(1, Math.ceil((a.linearNumValueHeads ?? a.numHeads) / safeTp));
  const localKHeads = Math.max(1, Math.ceil((a.linearNumKeyHeads ?? a.numHeads) / safeTp));
  const dK = a.linearKeyHeadDim ?? a.headDim;
  const dV = a.linearValueHeadDim ?? a.headDim;
  const convK = Math.max(2, a.linearConvKernelDim ?? 4);
  const stateElemBytes = a.linearStateDtypeBytes ?? 4;
  const convElemBytes = a.linearConvDtypeBytes ?? 2;
  const recurrentBytes = localVHeads * dK * dV * stateElemBytes;
  const convDim = localVHeads * dV + 2 * localKHeads * dK;
  const convBytes = convDim * (convK - 1) * convElemBytes;
  return { recurrentBytes, convBytes, totalBytes: recurrentBytes + convBytes };
}

export interface KvBreakdown {
  /** 每 token（所有层合计）字节 */
  bytesPerToken: number;
  /** 每条并发序列固定线性状态字节（非 KDA 为 0） */
  fixedStateBytesPerSeq: number;
  /** 每层每 token 字节 */
  perLayer: { index: number; kind: string; bytes: number; formula: string }[];
  kvDtypeBytes: number;
  notes: string[];
}

/**
 * KV Cache 每 token 字节（Wave 4 支持 MHA/GQA/MQA + MLA + DSA/CSA2 + KDA 混合栈）。
 */
export function analyzeKvPerToken(spec: ModelSpec, kvDtypeBytes = spec.bytesPerParam): KvBreakdown {
  const perLayer: KvBreakdown["perLayer"] = [];
  const notes: string[] = [];
  let sum = 0;
  let fixedStatePerSeq = 0;
  let linearCount = 0;
  let mlaCount = 0;
  let dsaCount = 0;

  for (const l of spec.layers) {
    const a = l.attention;
    const bytes = kvBytesPerTokenLayer(a, kvDtypeBytes);
    if (a.kind === "mha" || a.kind === "gqa" || a.kind === "mqa") {
      perLayer.push({
        index: l.index,
        kind: a.kind,
        bytes,
        formula: `2 × ${a.numKvHeads} × ${a.headDim} × ${kvDtypeBytes} B`,
      });
    } else if (a.kind === "mla") {
      mlaCount += 1;
      const kvLora = a.kvLoraRank ?? 512;
      const qkRope = a.qkRopeHeadDim ?? 64;
      perLayer.push({
        index: l.index,
        kind: a.kind,
        bytes,
        formula: `(${kvLora} + ${qkRope}) × ${kvDtypeBytes} B（潜向量单头，TP 复制）`,
      });
    } else if (a.kind === "dsa") {
      dsaCount += 1;
      const idxBytes = indexerBytesPerTokenLayer(a);
      const baseFormula =
        a.kvLoraRank !== undefined
          ? `(${a.kvLoraRank} + ${a.qkRopeHeadDim ?? 64}) × ${kvDtypeBytes} B`
          : `2 × ${a.numKvHeads} × ${a.headDim} × ${kvDtypeBytes} B`;
      perLayer.push({
        index: l.index,
        kind: a.kind,
        bytes,
        formula: `${baseFormula} + 稀疏索引器 ${idxBytes} B`,
      });
    } else if (a.kind === "linear_kda") {
      linearCount += 1;
      const st = linearStateBytesPerSeqLayer(a, 1);
      fixedStatePerSeq += st.totalBytes;
      perLayer.push({
        index: l.index,
        kind: a.kind,
        bytes: 0,
        formula: `0 B/tok（固定递推态 ${(st.totalBytes / 1024).toFixed(1)} KiB/seq）`,
      });
    }
    sum += bytes;
  }

  if (mlaCount > 0) {
    notes.push(
      `MLA：${mlaCount} 层将 KV 压缩为单潜向量头 (kv_lora_rank + qk_rope_head_dim)，TP 无法切分该单头，仅 DCP>1 可按序列轴切分。`,
    );
  }
  if (dsaCount > 0) {
    notes.push(`CSA2/DSA：${dsaCount} 层额外保存轻量稀疏索引器 k_cache，Decode 仅按 top-k 读取主 KV 块。`);
  }
  if (linearCount > 0) {
    notes.push(
      `KDA 混合栈：${linearCount} 层线性注意力采用 O(1) 固定递推状态（TP=1 下每并发序列 ${fmtBytes(fixedStatePerSeq)}），仅剩余 ${spec.layers.length - linearCount} 层全注意力消耗按 token 分页 KV。`,
    );
  } else if (spec.layers[0]?.attention.kind === "gqa") {
    const a = spec.layers[0].attention;
    notes.push(
      `GQA：${a.numHeads} 个 Q 头共享 ${a.numKvHeads} 个 KV 头，KV 比 MHA 少 ${a.numHeads / a.numKvHeads} 倍`,
    );
  }
  return { bytesPerToken: sum, fixedStateBytesPerSeq: fixedStatePerSeq, perLayer, kvDtypeBytes, notes };
}

/** 权重总字节（按 dtype） */
export function weightBytes(spec: ModelSpec): number {
  return analyzeParams(spec).total * spec.bytesPerParam;
}

/** 便于显示的单位换算 */
export function fmtBytes(b: number): string {
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TiB`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GiB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MiB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${b} B`;
}
export function fmtCount(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
