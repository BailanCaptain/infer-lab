/**
 * 单层前向（03 章）用到的证据注册表。Step.evidence 里的每个编号都必须在这里能查到。
 * 标记含义：S 官方文档/配置；C 固定版本源码（文件 + 行号）；D 由形状/公式推导；A 教学假设。
 * 核验日期为实际打开来源文件的日期；行号对应 transformers v4.51.3。
 */

export type ClaimKind = "S" | "C" | "D" | "A" | "I" | "M";

export interface Claim {
  id: string;
  kind: ClaimKind;
  /** 一句话结论（中文） */
  text: string;
  /** 来源 URL 或依据说明 */
  source: string;
  /** 文件 + 行号（C 类） */
  loc?: string;
  /** 实际核验日期 */
  verifiedOn?: string;
}

const TF = "https://github.com/huggingface/transformers/blob/v4.51.3/src/transformers";
const QWEN3 = `${TF}/models/qwen3/modeling_qwen3.py`;

export const FORWARD_CLAIMS: Record<string, Claim> = {
  S01: {
    id: "S01",
    kind: "S",
    text: "模型形状（H、层数、n_q/n_kv、d_h、I、V、rope_theta、rms_norm_eps）全部来自 HF 官方 config.json。",
    source: "各预设的 configUrl（src/sim/modelspec/presets.ts），原文随站打包",
    verifiedOn: "2026-09-06",
  },
  S02: {
    id: "S02",
    kind: "S",
    text: "预设句子的 token id 由 Qwen3 官方 tokenizer.json（byte-level BPE）离线生成；0.6B / 8B / 30B-A3B 共用同一份词表。",
    source:
      "https://huggingface.co/Qwen/Qwen3-0.6B/resolve/c1899de289a04d12100db370d81485cdf75e47ca/tokenizer.json（SHA-256 aeb13307…2dae4，见 src/sim/model/presets.tokens.json）；生成脚本 scripts/gen-preset-tokens.ts，结果与 @huggingface/transformers 3.x 对拍一致",
    verifiedOn: "2026-09-06",
  },
  C01: {
    id: "C01",
    kind: "C",
    text: "Qwen3RMSNorm：y = x · rsqrt(mean(x²) + eps) · weight，在最后一维（H）上求均值。",
    source: QWEN3,
    loc: "modeling_qwen3.py L62-80（L74-75）",
    verifiedOn: "2026-09-06",
  },
  C02: {
    id: "C02",
    kind: "C",
    text: "q_proj/k_proj/v_proj 是无偏置线性层；Qwen3 的 q_norm/k_norm 只作用在 head_dim 上，且在 RoPE 之前。",
    source: QWEN3,
    loc: "modeling_qwen3.py L195-196、L217-219",
    verifiedOn: "2026-09-06",
  },
  C03: {
    id: "C03",
    kind: "C",
    text: "RoPE 采用 rotate_half：q_embed = q·cos + rotate_half(q)·sin；inv_freq[k] = base^(−2k/d)。",
    source: QWEN3,
    loc: "modeling_qwen3.py L98-103、L105-129；modeling_rope_utils.py L130",
    verifiedOn: "2026-09-06",
  },
  C04: {
    id: "C04",
    kind: "C",
    text: "GQA 通过 repeat_kv 把 n_kv 个 K/V 头复制 n_q/n_kv 次；分数 = Q·Kᵀ·scaling，scaling = head_dim^−0.5。",
    source: QWEN3,
    loc: "modeling_qwen3.py L132-142、L154-157、L178-179",
    verifiedOn: "2026-09-06",
  },
  C05: {
    id: "C05",
    kind: "C",
    text: "分数加上因果 mask 后，在最后一维做 float32 softmax。",
    source: QWEN3,
    loc: "modeling_qwen3.py L157-162",
    verifiedOn: "2026-09-06",
  },
  C06: {
    id: "C06",
    kind: "C",
    text: "attn_output = P·V，再 transpose/reshape 拼回 [S, n_q·d_h]，最后过 o_proj。",
    source: QWEN3,
    loc: "modeling_qwen3.py L164-166、L170-255（Qwen3Attention.forward）",
    verifiedOn: "2026-09-06",
  },
  C07: {
    id: "C07",
    kind: "C",
    text: "DecoderLayer：x → input_layernorm → self_attn → 残差相加 → post_attention_layernorm → mlp → 残差相加。",
    source: QWEN3,
    loc: "modeling_qwen3.py L284-306",
    verifiedOn: "2026-09-06",
  },
  C08: {
    id: "C08",
    kind: "C",
    text: "Qwen3MLP：down_proj(act_fn(gate_proj(x)) · up_proj(x))，act_fn 由 config.hidden_act 决定（silu）。",
    source: QWEN3,
    loc: "modeling_qwen3.py L82-95（L94）",
    verifiedOn: "2026-09-06",
  },
  C09: {
    id: "C09",
    kind: "C",
    text: "KV Cache 写入的是 RoPE 之后的 key_states 与 value_states，按 layer_idx 分层存放。",
    source: QWEN3,
    loc: "modeling_qwen3.py L224-227",
    verifiedOn: "2026-09-06",
  },
  D01: {
    id: "D01",
    kind: "D",
    text: "每层每 token 的 KV Cache 字节 = 2 · n_kv · d_h · bytes(dtype)。",
    source: "由 C09 写入的张量形状 [S, n_kv, d_h] ×（K、V）与 S01 的 dtype 推导",
  },
  D02: {
    id: "D02",
    kind: "D",
    text: "GQA 中 Q 头 h 使用的 KV 头是 g(h) = ⌊h / (n_q / n_kv)⌋。",
    source: "由 C04 的 repeat_kv（expand 后 reshape，KV 头 g 展开为连续 n_rep 个 Q 头）推导",
  },
  D03: {
    id: "D03",
    kind: "D",
    text: "形状链：[S,H]·[H,n_q·d_h]→[S,n_q·d_h]；[S,H]·[H,n_kv·d_h]→[S,n_kv·d_h]；[S,n_q·d_h]·[n_q·d_h,H]→[S,H]；[S,H]·[H,I]→[S,I]；[S,I]·[I,H]→[S,H]。",
    source: "由 S01 的 config 与 C02/C06/C08 的线性层定义推导；权重按 [in,out] 书写（HF 存 [out,in]）",
  },
  A01: {
    id: "A01",
    kind: "A",
    text: "权重不下载：按 (张量 id, i, j) 哈希生成 U(−√3σ, √3σ)，σ = initializer_range；RMSNorm 权重取 1。形状真实，数值只用于观察机制。",
    source: "src/sim/weights.ts；HF 初始化为 N(0, σ²)、norm 权重 ones",
  },
  A02: {
    id: "A02",
    kind: "A",
    text: "演示为单请求 prefill：batch = 1，位置 id = 0..S−1，无 padding，无滑动窗口。",
    source: "教学简化；decode 与批处理在后续章节展开",
  },
  A03: {
    id: "A03",
    kind: "A",
    text: "因果 mask 用 −1e30 代替 −∞，softmax 后被掩码处为精确 0，与 −∞ 等价。",
    source: "float32 有限值实现；exp(−1e30 − max) 下溢为 0",
  },
};

export function assertClaimIds(ids: Iterable<string>): void {
  const missing = new Set<string>();
  for (const id of ids) if (!FORWARD_CLAIMS[id]) missing.add(id);
  if (missing.size) throw new Error(`证据编号未注册：${[...missing].join(", ")}`);
}
