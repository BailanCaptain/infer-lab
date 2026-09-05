/**
 * 从 ModelSpec 推导参数量、激活参数量、每 token KV Cache 字节数。
 * 每个数字都附带公式项，供工作台展开显示与证据标注：
 * - 参数量公式为 [D]（由 config 形状直接推导）
 * - KV 公式 [D]：MHA/GQA/MQA 每层每 token = 2 · n_kv · d_head · bytes
 * - 假设 [A]：权重字节按 config torch_dtype 统一换算；不含优化器/激活
 */
import { attnKvDim, attnQDim, type LayerSpec, type ModelSpec } from "./types";

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
  const qd = attnQDim(a);
  const kd = attnKvDim(a);
  const items: ParamItem[] = [
    { id: "ln1", label: "input_layernorm", formula: "H", count: hidden, active: true },
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
  ];
  if (a.qkNorm) {
    items.push({ id: "qn", label: "q_norm", formula: "d_h", count: a.headDim, active: true });
    items.push({ id: "kn", label: "k_norm", formula: "d_h", count: a.headDim, active: true });
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
  for (const l of spec.layers) {
    const li = layerParams(l, spec.hidden);
    const t = li.reduce((s, x) => s + x.count, 0);
    const act = li.filter((x) => x.active).reduce((s, x) => s + x.count, 0);
    perLayer.push({ index: l.index, total: t, active: act });
    layerTotal += t;
    layerActive += act;
  }
  // 逐层项在汇总里合并为“所有层”，避免 36 层 × 12 项撑爆列表；逐层明细由 perLayer 提供
  const first = spec.layers[0];
  if (first) {
    for (const it of layerParams(first, spec.hidden)) {
      const sameAcrossLayers = spec.layers.every((l) =>
        layerParams(l, spec.hidden).some((x) => x.id === it.id && x.count === it.count),
      );
      items.push({
        ...it,
        id: `layers.${it.id}`,
        label: `${it.label} × ${spec.numLayers} 层${sameAcrossLayers ? "" : "（异构，按首层示意）"}`,
        formula: `${spec.numLayers} × ${it.formula}`,
        count: spec.layers.reduce(
          (s, l) => s + (layerParams(l, spec.hidden).find((x) => x.id === it.id)?.count ?? 0),
          0,
        ),
      });
    }
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
  const total = emb + layerTotal + spec.hidden + lmHead;
  const active = emb + layerActive + spec.hidden + lmHead;
  return { total, active, nonEmbedding: layerTotal + spec.hidden, items, perLayer };
}

export interface KvBreakdown {
  /** 每 token（所有层合计）字节 */
  bytesPerToken: number;
  /** 每层每 token 字节 */
  perLayer: { index: number; kind: string; bytes: number; formula: string }[];
  kvDtypeBytes: number;
  notes: string[];
}

/**
 * KV Cache 每 token 字节。kvDtypeBytes 默认与权重 dtype 一致（bf16 = 2）。
 * 线性注意力 / MLA 在 M2 扩展：这里对未知 kind 抛错而不是给错数。
 */
export function analyzeKvPerToken(spec: ModelSpec, kvDtypeBytes = spec.bytesPerParam): KvBreakdown {
  const perLayer: KvBreakdown["perLayer"] = [];
  const notes: string[] = [];
  let sum = 0;
  for (const l of spec.layers) {
    const a = l.attention;
    if (a.kind === "mha" || a.kind === "gqa" || a.kind === "mqa") {
      const bytes = 2 * a.numKvHeads * a.headDim * kvDtypeBytes;
      perLayer.push({
        index: l.index,
        kind: a.kind,
        bytes,
        formula: `2 × ${a.numKvHeads} × ${a.headDim} × ${kvDtypeBytes} B`,
      });
      sum += bytes;
    } else {
      throw new Error(`KV 计算暂不支持注意力类型 ${a.kind}（M2 扩展 MLA / 线性注意力）`);
    }
  }
  if (spec.layers[0]?.attention.kind === "gqa") {
    const a = spec.layers[0].attention;
    notes.push(
      `GQA：${a.numHeads} 个 Q 头共享 ${a.numKvHeads} 个 KV 头，KV 比 MHA 少 ${a.numHeads / a.numKvHeads} 倍`,
    );
  }
  return { bytesPerToken: sum, perLayer, kvDtypeBytes, notes };
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
