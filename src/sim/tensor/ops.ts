/**
 * 教学用算子：朴素循环，Float32。与真实尺寸完全相同的代码在缩小的 spec 上跑 golden 测试。
 * 语义来源 [S]：transformers modeling_qwen3.py（RMSNorm、rotate_half RoPE、GQA repeat_kv、SwiGLU）。
 */
import { type LazyWeight, weightColumn, weightRow } from "../weights";
import { type Tensor, zeros } from "./tensor";

/** RMSNorm：y = x / sqrt(mean(x²) + eps) · w，w 默认全 1（HF 初始化为 ones）*/
export function rmsnorm(x: Tensor, eps: number, w?: Float32Array): Tensor {
  const [S, H] = [x.shape[0] ?? 0, x.shape[1] ?? 0];
  const y = zeros([S, H], [...x.dims]);
  for (let s = 0; s < S; s++) {
    let ss = 0;
    for (let h = 0; h < H; h++) {
      const v = x.data[s * H + h] ?? 0;
      ss += v * v;
    }
    const inv = 1 / Math.sqrt(ss / H + eps);
    for (let h = 0; h < H; h++) {
      y.data[s * H + h] = (x.data[s * H + h] ?? 0) * inv * (w ? (w[h] ?? 1) : 1);
    }
  }
  return y;
}

/** 单头 RMSNorm：对 [S, n, d] 的最后一维归一化（Qwen3 q_norm / k_norm）*/
export function rmsnormLastDim(x: Tensor, eps: number): Tensor {
  const d = x.shape[x.shape.length - 1] ?? 1;
  const groups = x.data.length / d;
  const y = zeros([...x.shape], [...x.dims]);
  for (let g = 0; g < groups; g++) {
    let ss = 0;
    for (let k = 0; k < d; k++) {
      const v = x.data[g * d + k] ?? 0;
      ss += v * v;
    }
    const inv = 1 / Math.sqrt(ss / d + eps);
    for (let k = 0; k < d; k++) y.data[g * d + k] = (x.data[g * d + k] ?? 0) * inv;
  }
  return y;
}

/** y[S,out] = x[S,in] · W[in,out]（W 惰性生成，按列流式）*/
export function linearLazy(x: Tensor, w: LazyWeight, outDim: string): Tensor {
  const S = x.shape[0] ?? 0;
  const In = x.shape[1] ?? 0;
  const [wIn, Out] = w.shape;
  if (In !== wIn) throw new Error(`linear 维度不匹配：x[${x.shape}] · W[${w.shape}]`);
  const y = zeros([S, Out], [x.dims[0] ?? "S", outDim]);
  const col = new Float32Array(In);
  const xd = x.data;
  const yd = y.data;
  for (let j = 0; j < Out; j++) {
    weightColumn(w, j, col);
    for (let s = 0; s < S; s++) {
      let acc = 0;
      const base = s * In;
      for (let i = 0; i < In; i++) acc += (xd[base + i] ?? 0) * (col[i] ?? 0);
      yd[s * Out + j] = acc;
    }
  }
  return y;
}

/** Embedding gather：ids[S] → X[S,H]，表 E[vocab,H] 惰性 */
export function embedLazy(ids: number[], table: LazyWeight): Tensor {
  const H = table.shape[1];
  const x = zeros([ids.length, H], ["S", "H"]);
  const row = new Float32Array(H);
  ids.forEach((id, s) => {
    weightRow(table, id, row);
    x.data.set(row, s * H);
  });
  return x;
}

/** [S, n·d] → [S, n, d] 视图 */
export function splitHeads(x: Tensor, n: number, d: number, headDim: string, dDim: string): Tensor {
  const S = x.shape[0] ?? 0;
  if ((x.shape[1] ?? 0) !== n * d) throw new Error("splitHeads 维度不匹配");
  return { shape: [S, n, d], dims: [x.dims[0] ?? "S", headDim, dDim], data: x.data };
}

/**
 * RoPE（HF rotate_half 版）：对每个头的 d 维向量，前半与后半配对旋转。
 * inv_freq[k] = theta^(−2k/d)，k∈[0,d/2)；角度 = pos · inv_freq[k]。
 */
export function ropeInplace(x: Tensor, positions: number[], theta: number): void {
  const [S, n, d] = [x.shape[0] ?? 0, x.shape[1] ?? 0, x.shape[2] ?? 0];
  const half = d / 2;
  const invFreq = new Float64Array(half);
  for (let k = 0; k < half; k++) invFreq[k] = theta ** (-(2 * k) / d);
  for (let s = 0; s < S; s++) {
    const pos = positions[s] ?? s;
    for (let h = 0; h < n; h++) {
      const base = (s * n + h) * d;
      for (let k = 0; k < half; k++) {
        const ang = pos * (invFreq[k] ?? 0);
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const a = x.data[base + k] ?? 0;
        const b = x.data[base + k + half] ?? 0;
        x.data[base + k] = a * c - b * sn;
        x.data[base + k + half] = b * c + a * sn;
      }
    }
  }
}

/**
 * 注意力分数：scores[n_q, S, S_k] = Q_h · K_{g(h)}ᵀ / sqrt(d)，GQA 下 g(h) = floor(h / (n_q/n_kv))。
 */
export function attentionScores(q: Tensor, k: Tensor): Tensor {
  const [S, nq, d] = [q.shape[0] ?? 0, q.shape[1] ?? 0, q.shape[2] ?? 0];
  const [Sk, nkv] = [k.shape[0] ?? 0, k.shape[1] ?? 0];
  const group = nq / nkv;
  const scale = 1 / Math.sqrt(d);
  const out = zeros([nq, S, Sk], ["n_q", "S", "S_k"]);
  for (let h = 0; h < nq; h++) {
    const kh = Math.floor(h / group);
    for (let i = 0; i < S; i++) {
      const qb = (i * nq + h) * d;
      for (let j = 0; j < Sk; j++) {
        const kb = (j * nkv + kh) * d;
        let acc = 0;
        for (let t = 0; t < d; t++) acc += (q.data[qb + t] ?? 0) * (k.data[kb + t] ?? 0);
        out.data[(h * S + i) * Sk + j] = acc * scale;
      }
    }
  }
  return out;
}

/** 因果 mask：j > i 置为 −∞（用 −1e30 表示，softmax 后为 0）*/
export function causalMaskInplace(scores: Tensor): void {
  const [n, S, Sk] = [scores.shape[0] ?? 0, scores.shape[1] ?? 0, scores.shape[2] ?? 0];
  const offset = Sk - S; // 支持 decode（S=1）时的历史键
  for (let h = 0; h < n; h++)
    for (let i = 0; i < S; i++)
      for (let j = i + offset + 1; j < Sk; j++) scores.data[(h * S + i) * Sk + j] = -1e30;
}

/** 最后一维 softmax */
export function softmaxLastDim(x: Tensor): Tensor {
  const d = x.shape[x.shape.length - 1] ?? 1;
  const groups = x.data.length / d;
  const y = zeros([...x.shape], [...x.dims]);
  for (let g = 0; g < groups; g++) {
    let m = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < d; k++) m = Math.max(m, x.data[g * d + k] ?? 0);
    let sum = 0;
    for (let k = 0; k < d; k++) {
      const e = Math.exp((x.data[g * d + k] ?? 0) - m);
      y.data[g * d + k] = e;
      sum += e;
    }
    for (let k = 0; k < d; k++) y.data[g * d + k] = (y.data[g * d + k] ?? 0) / sum;
  }
  return y;
}

/** out[S, n_q, d] = P[n_q,S,S_k] · V[S_k, n_kv, d]（GQA 共享 V 头）*/
export function attentionValues(p: Tensor, v: Tensor): Tensor {
  const [nq, S, Sk] = [p.shape[0] ?? 0, p.shape[1] ?? 0, p.shape[2] ?? 0];
  const [, nkv, d] = [v.shape[0] ?? 0, v.shape[1] ?? 0, v.shape[2] ?? 0];
  const group = nq / nkv;
  const out = zeros([S, nq, d], ["S", "n_q", "d_h"]);
  for (let h = 0; h < nq; h++) {
    const vh = Math.floor(h / group);
    for (let i = 0; i < S; i++) {
      const ob = (i * nq + h) * d;
      for (let j = 0; j < Sk; j++) {
        const pij = p.data[(h * S + i) * Sk + j] ?? 0;
        if (pij === 0) continue;
        const vb = (j * nkv + vh) * d;
        for (let t = 0; t < d; t++) out.data[ob + t] = (out.data[ob + t] ?? 0) + pij * (v.data[vb + t] ?? 0);
      }
    }
  }
  return out;
}

/** [S, n, d] → [S, n·d]（拼接头）*/
export function mergeHeads(x: Tensor, dim: string): Tensor {
  const [S, n, d] = [x.shape[0] ?? 0, x.shape[1] ?? 0, x.shape[2] ?? 0];
  return { shape: [S, n * d], dims: [x.dims[0] ?? "S", dim], data: x.data };
}

export function add(a: Tensor, b: Tensor): Tensor {
  if (a.data.length !== b.data.length) throw new Error("add 形状不匹配");
  const y = zeros([...a.shape], [...a.dims]);
  for (let i = 0; i < a.data.length; i++) y.data[i] = (a.data[i] ?? 0) + (b.data[i] ?? 0);
  return y;
}

/** SwiGLU 的门控：silu(gate) ⊙ up */
export function siluMul(gate: Tensor, up: Tensor): Tensor {
  if (gate.data.length !== up.data.length) throw new Error("siluMul 形状不匹配");
  const y = zeros([...gate.shape], [...gate.dims]);
  for (let i = 0; i < gate.data.length; i++) {
    const g = gate.data[i] ?? 0;
    y.data[i] = (g / (1 + Math.exp(-g))) * (up.data[i] ?? 0);
  }
  return y;
}
