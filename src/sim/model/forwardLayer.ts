/**
 * Qwen3 单层前向（真实尺寸），边算边把每一步录进 Recorder。
 * 语义来源：transformers v4.51.3 modeling_qwen3.py（见 ./claims.ts 的 [C##]）。
 * 数值来源：权重按 [A01] 哈希生成；输入 token id 由调用方提供。
 * 约定：权重形状写作 [in, out]，y = x · W；HF nn.Linear 存 [out, in]（转置），页面同时标注。
 *
 * Step 是唯一真相源：这里写下的 tensors / highlight / op / lineage 就是 3D 与面板显示的全部依据。
 * hardware 字段留空，由 sim/hardware 的 mapResidency 后处理填充。
 */
import { fmtCount, kvBytesPerTokenLayer } from "../modelspec/analyze";
import { attnKvDim, attnQDim, type ModelSpec } from "../modelspec/types";
import {
  add,
  attentionScores,
  attentionValues,
  causalMaskInplace,
  embedLazy,
  linearLazy,
  mergeHeads,
  rmsnorm,
  rmsnormLastDim,
  ropeInplace,
  siluMul,
  softmaxLastDim,
  splitHeads,
} from "../tensor/ops";
import { clone, fromArray, shapeLabel, type Tensor, zeros } from "../tensor/tensor";
import { Recorder } from "../timeline/recorder";
import type { Highlight, Lineage, OpKind, Step, TensorId, TensorRole, Timeline } from "../timeline/types";
import { assertValid } from "../timeline/validate";
import { type LazyWeight, lazyWeight } from "../weights";
import { assertClaimIds } from "./claims";

export interface ForwardLayerOptions {
  /** 位置 id，默认 0..S−1（prefill）[A02] */
  positions?: number[];
  /** 上一层输出 [S,H]；缺省则从 embedding 开始并录 embed.gather */
  xIn?: Tensor;
}

export interface ForwardLayerResult {
  /** 本层输出 [S,H] */
  x: Tensor;
  /** RoPE 后的 K [S,n_kv,d_h]（写入 KV Cache 的内容） */
  k: Tensor;
  /** V [S,n_kv,d_h] */
  v: Tensor;
  stepIds: string[];
}

interface StepDraft {
  id: string;
  title: string;
  brief: string;
  detail: string;
  formula?: string;
  tensors: TensorId[];
  highlight?: Highlight[];
  op?: { kind: OpKind; a: TensorId; b?: TensorId; out: TensorId };
  lineage: Lineage[];
  view: string;
  evidence: string[];
  terms: string[];
  beats?: NonNullable<Step["beats"]>;
}

const MATMUL_BEATS: NonNullable<Step["beats"]> = [
  { at: 0, label: "读权重列" },
  { at: 0.3, label: "乘加" },
  { at: 0.85, label: "写回" },
];

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export function forwardLayer(
  spec: ModelSpec,
  layerIdx: number,
  ids: number[],
  rec: Recorder,
  opts: ForwardLayerOptions = {},
): ForwardLayerResult {
  const layer = spec.layers[layerIdx];
  if (!layer) throw new Error(`层 ${layerIdx} 不存在（共 ${spec.numLayers} 层）`);
  const a = layer.attention;
  if (a.kind !== "mha" && a.kind !== "gqa" && a.kind !== "mqa")
    throw new Error(`M1 只支持 MHA/GQA/MQA 注意力，${a.kind} 在 M2 扩展`);
  if (a.bias) throw new Error("暂不支持 attention_bias=true（Qwen2 系列），M2 扩展");
  if (layer.mlp.kind !== "dense") throw new Error("M1 只支持 dense MLP，MoE 在 M2 扩展");
  if (layer.mlp.act !== "silu") throw new Error(`暂不支持激活函数 ${layer.mlp.act}`);
  const S = ids.length;
  if (S === 0) throw new Error("输入序列为空");
  for (const id of ids)
    if (!Number.isInteger(id) || id < 0 || id >= spec.vocab) throw new Error(`token id 越界：${id}`);
  const positions = opts.positions ?? range(S);
  if (positions.length !== S) throw new Error("positions 长度与 ids 不一致");
  if (opts.xIn && (opts.xIn.shape[0] !== S || opts.xIn.shape[1] !== spec.hidden))
    throw new Error(`xIn 形状 [${opts.xIn.shape}] 与 [S,H]=[${S},${spec.hidden}] 不一致`);

  const H = spec.hidden;
  const nq = a.numHeads;
  const nkv = a.numKvHeads;
  const d = a.headDim;
  const qd = attnQDim(a);
  const kd = attnKvDim(a);
  const I = layer.mlp.intermediate;
  const eps = spec.rmsNormEps;
  const std = spec.initializerRange;
  const group = nq / nkv;
  const L = `L${layerIdx}`;

  // ---------- 权重（惰性）----------
  const W = {
    E: lazyWeight("model.embed_tokens", [spec.vocab, H], ["V", "H"], std),
    q: lazyWeight(`${L}.attn.q_proj`, [H, qd], ["H", "n_q·d_h"], std),
    k: lazyWeight(`${L}.attn.k_proj`, [H, kd], ["H", "n_kv·d_h"], std),
    v: lazyWeight(`${L}.attn.v_proj`, [H, kd], ["H", "n_kv·d_h"], std),
    o: lazyWeight(`${L}.attn.o_proj`, [qd, H], ["n_q·d_h", "H"], std),
    gate: lazyWeight(`${L}.mlp.gate_proj`, [H, I], ["H", "I"], std),
    up: lazyWeight(`${L}.mlp.up_proj`, [H, I], ["H", "I"], std),
    down: lazyWeight(`${L}.mlp.down_proj`, [I, H], ["I", "H"], std),
  };

  // ---------- 录制辅助 ----------
  const stepIds: string[] = [];
  const emit = (dft: StepDraft): void => {
    rec.step({
      id: dft.id,
      title: dft.title,
      narration: {
        brief: dft.brief,
        detail: dft.detail,
        ...(dft.formula ? { formula: dft.formula } : {}),
      },
      ...(dft.beats ? { beats: dft.beats } : {}),
      model: {
        tensors: dft.tensors,
        highlight: dft.highlight ?? [],
        ...(dft.op ? { op: dft.op } : {}),
        lineage: dft.lineage,
      },
      camera: { view: dft.view },
      evidence: dft.evidence,
      terms: dft.terms,
    });
    stepIds.push(dft.id);
  };
  const T = (id: TensorId, name: string, t: Tensor, role: TensorRole): TensorId =>
    rec.dense(id, name, t, role);
  const lin = (out: TensorId, from: TensorId[], expr: string): Lineage => ({ out, from, expr });
  const mmExpr = (x: Tensor, w: LazyWeight, y: Tensor): string =>
    `${shapeLabel(x)} · ${shapeLabel(w)} → ${shapeLabel(y)}`;
  /** 线性投影步：x[S,in] · W[in,out] → y[S,out] */
  const projStep = (p: {
    id: string;
    title: string;
    brief: string;
    detail: string;
    xId: TensorId;
    x: Tensor;
    w: LazyWeight;
    wName: string;
    yId: TensorId;
    yName: string;
    yRole: TensorRole;
    view: string;
    evidence: string[];
    terms: string[];
  }): Tensor => {
    const y = linearLazy(p.x, p.w, p.w.dims[1]);
    rec.weight(p.wName, p.w);
    T(p.yId, p.yName, y, p.yRole);
    emit({
      id: p.id,
      title: p.title,
      brief: p.brief,
      detail: `${p.detail}\n权重 ${p.w.id} 形状 [${p.w.shape[0]}×${p.w.shape[1]}]（HF 存为转置 [${p.w.shape[1]}×${p.w.shape[0]}]），共 ${fmtCount(p.w.shape[0] * p.w.shape[1])} 个参数，按固定种子生成 [A01]。`,
      formula: `y[s, j] = Σ_i x[s, i] · W[i, j]`,
      tensors: [p.xId, p.w.id, p.yId],
      highlight: [
        { tensor: p.xId, rows: [0] },
        { tensor: p.w.id, cols: [0] },
        { tensor: p.yId, cells: [[0, 0]] },
      ],
      op: { kind: "matmul", a: p.xId, b: p.w.id, out: p.yId },
      lineage: [lin(p.yId, [p.xId, p.w.id], mmExpr(p.x, p.w, y))],
      view: p.view,
      evidence: p.evidence,
      terms: p.terms,
      beats: MATMUL_BEATS,
    });
    return y;
  };

  // ---------- 0. Embedding ----------
  const xInId = `${L}.x_in`;
  let x: Tensor;
  if (opts.xIn) {
    x = opts.xIn;
    T(xInId, `X（第 ${layerIdx} 层输入）`, x, "activation");
  } else {
    const idsT = fromArray([S], ["S"], ids);
    // 教学中的 token id 存储按 int32 计字节，与激活 dtype 分开 [HW-A09]。
    rec.dense("ids", "token id", idsT, "input", 4);
    rec.weight("E（词嵌入表）", W.E);
    x = embedLazy(ids, W.E);
    T(xInId, "X（词嵌入 / 第 0 层输入）", x, "activation");
    emit({
      id: "embed.gather",
      title: "词嵌入查表",
      brief: "每个 token id 取出 E 的一行，拼成 X[S,H]",
      detail: `输入是 S=${S} 个 token id。词嵌入表 E 的形状是 [V,H]=[${spec.vocab}×${H}]，共 ${fmtCount(spec.vocab * H)} 个参数。查表不是矩阵乘法：第 s 个 token 直接复制 E 的第 ids[s] 行，S 行拼成 X[S,H]。真实模型的 E 是训练得到的，本站按固定种子生成，只保留形状与分布 [A01]。`,
      formula: "X[s, :] = E[ids[s], :]",
      tensors: ["ids", W.E.id, xInId],
      highlight: [
        { tensor: W.E.id, rows: ids },
        { tensor: xInId, rows: [0] },
      ],
      op: { kind: "gather", a: W.E.id, out: xInId },
      lineage: [lin(xInId, ["ids", W.E.id], `ids[S] 取 ${shapeLabel(W.E)} 的行 → ${shapeLabel(x)}`)],
      view: "embed",
      evidence: ["S01", "A01"],
      terms: ["token", "embedding", "hidden-size"],
    });
  }

  // ---------- 1. RMSNorm（注意力前）----------
  const ln1 = rmsnorm(x, eps);
  const ln1Id = T(`${L}.ln1.out`, "X_n（RMSNorm 后）", ln1, "activation");
  emit({
    id: `${L}.ln1`,
    title: "RMSNorm（注意力前）",
    brief: "逐行归一化：除以均方根，再乘可学习缩放 w",
    detail: `对 X 的每一行（一个 token 的 H=${H} 维向量）求均方根 sqrt(mean(x²)+ε)，整行除以它，再逐维乘缩放权重 w[H]。它不减均值（区别于 LayerNorm），只把每个 token 的向量拉到统一尺度。ε=${eps}。本站 w 取 1 [A01]，所以归一化后每行的 RMS = sqrt(ms/(ms+ε)) ≈ 1；词嵌入数值很小时 ε 会让它略低于 1（0.6B 约 0.999）。`,
    formula: "y = x / sqrt(mean(x²) + ε) · w",
    tensors: [xInId, ln1Id],
    highlight: [
      { tensor: xInId, rows: [0] },
      { tensor: ln1Id, rows: [0] },
    ],
    op: { kind: "rmsnorm", a: xInId, out: ln1Id },
    lineage: [lin(ln1Id, [xInId], `${shapeLabel(x)} → ${shapeLabel(ln1)}`)],
    view: "norm",
    evidence: ["C01", "C07", "A01"],
    terms: ["rmsnorm"],
  });

  // ---------- 2-4. Q / K / V 投影 ----------
  const qId = `${L}.attn.q`;
  const kId = `${L}.attn.k`;
  const vId = `${L}.attn.v`;
  const q = projStep({
    id: qId,
    title: "Q 投影",
    brief: `X_n 乘 W_q，得到 ${nq} 个 Q 头拼在一起的 [S,n_q·d_h]`,
    detail: `第 s 行 X_n[s,:] 乘以 W_q[H, n_q·d_h] 得到 Q[s,:]，长度 n_q·d_h=${nq}×${d}=${qd}。这一行随后会被切成 ${nq} 段，每段 ${d} 维就是一个头的 query。矩阵乘法逐列进行：输出第 j 列 = X_n 的每一行与 W_q 第 j 列点积。`,
    xId: ln1Id,
    x: ln1,
    w: W.q,
    wName: "W_q",
    yId: qId,
    yName: "Q（所有头拼接）",
    yRole: "activation",
    view: "matmul",
    evidence: ["C02", "D03", "S01"],
    terms: ["linear-projection", "query"],
  });
  const k = projStep({
    id: kId,
    title: "K 投影",
    brief: `乘 W_k 得 [S,n_kv·d_h]：KV 头 ${nkv} 个，比 Q 头少`,
    detail: `W_k 的输出维是 n_kv·d_h=${nkv}×${d}=${kd}，只有 Q 的 ${group === 1 ? "相同宽度（MHA）" : `1/${group}（GQA）`}。这就是 GQA 省 KV Cache 的来源：写进缓存的 K 只有 ${nkv} 个头。`,
    xId: ln1Id,
    x: ln1,
    w: W.k,
    wName: "W_k",
    yId: kId,
    yName: "K（所有 KV 头拼接）",
    yRole: "activation",
    view: "matmul",
    evidence: ["C02", "C04", "D03", "S01"],
    terms: ["linear-projection", "key", "gqa"],
  });
  const v = projStep({
    id: vId,
    title: "V 投影",
    brief: `乘 W_v 得 [S,n_kv·d_h]，与 K 同宽`,
    detail: `V 与 K 形状相同 [S,${kd}]，同样只有 ${nkv} 个头。V 不做归一化、不做 RoPE，直接进入后面的加权求和。`,
    xId: ln1Id,
    x: ln1,
    w: W.v,
    wName: "W_v",
    yId: vId,
    yName: "V（所有 KV 头拼接）",
    yRole: "activation",
    view: "matmul",
    evidence: ["C02", "D03", "S01"],
    terms: ["linear-projection", "value"],
  });
  const qHeads = splitHeads(q, nq, d, "n_q", "d_h");
  const kHeads = splitHeads(k, nkv, d, "n_kv", "d_h");
  const vHeads = splitHeads(v, nkv, d, "n_kv", "d_h");
  const qHeadsId = T(`${L}.attn.q_heads`, "Q（按头切分视图）", qHeads, "activation");
  const kHeadsId = T(`${L}.attn.k_heads`, "K（按头切分视图）", kHeads, "activation");
  const vHeadsId = T(`${L}.attn.v_heads`, "V（按头切分视图）", vHeads, "activation");

  // ---------- 5. Q/K 头内 RMSNorm（Qwen3）----------
  let qn = qHeads;
  let kn = kHeads;
  let qnId = qHeadsId;
  let knId = kHeadsId;
  if (a.qkNorm) {
    qn = rmsnormLastDim(qHeads, eps);
    kn = rmsnormLastDim(kHeads, eps);
    qnId = T(`${L}.attn.q_norm`, "Q（头内归一化后）", qn, "activation");
    knId = T(`${L}.attn.k_norm`, "K（头内归一化后）", kn, "activation");
    emit({
      id: `${L}.attn.qknorm`,
      title: "Q/K 头内归一化",
      brief: `Qwen3 在 RoPE 前对每个头的 ${d} 维做 RMSNorm`,
      detail: `Q[S,n_q·d_h] 先看成 [S,n_q,d_h]，对每个 (token, 头) 的 ${d} 维向量单独做 RMSNorm；K 同理。这是 Qwen3 相对 Llama 的差别之一：归一化只在 head_dim 上，权重 q_norm/k_norm 各只有 d_h=${d} 个参数，并且发生在 RoPE 之前。`,
      formula: "q_h = q_h / sqrt(mean(q_h²) + ε) · w_q",
      tensors: [qHeadsId, kHeadsId, qnId, knId],
      highlight: [
        { tensor: qHeadsId, rows: [0], head: 0 },
        { tensor: qnId, rows: [0], head: 0 },
      ],
      op: { kind: "rmsnorm", a: qHeadsId, out: qnId },
      lineage: [
        lin(qnId, [qHeadsId], `${shapeLabel(qHeads)} → ${shapeLabel(qn)}`),
        lin(knId, [kHeadsId], `${shapeLabel(kHeads)} → ${shapeLabel(kn)}`),
      ],
      view: "heads",
      evidence: ["C02", "A01"],
      terms: ["qk-norm", "rmsnorm", "head-dim"],
    });
  }

  // ---------- 6. RoPE ----------
  const qr = clone(qn);
  const kr = clone(kn);
  ropeInplace(qr, positions, a.ropeTheta);
  ropeInplace(kr, positions, a.ropeTheta);
  const qrId = T(`${L}.attn.q_rope`, "Q（RoPE 后）", qr, "activation");
  const krId = T(`${L}.attn.k_rope`, "K（RoPE 后）", kr, "activation");
  const ropeRow = Math.min(1, S - 1);
  emit({
    id: `${L}.attn.rope`,
    title: "旋转位置编码",
    brief: "按位置 pos 旋转每对 (k, k+d_h/2) 分量",
    detail: `每个头的 ${d} 维向量分成前后两半，第 k 维与第 k+${d / 2} 维配成一对，按角度 pos·θ^(−2k/d_h) 旋转（θ=${a.ropeTheta}）。位置 0 不旋转，位置越大转得越多；低维（k 小）转得快、高维转得慢。Q 和 K 都旋转，之后两者的点积只和相对位置有关。V 不旋转。`,
    formula: "q' = q·cos(pos·ω) + rotate_half(q)·sin(pos·ω)，ω_k = θ^(−2k/d_h)",
    tensors: [qnId, knId, qrId, krId],
    highlight: [
      { tensor: qnId, rows: [ropeRow], head: 0 },
      { tensor: qrId, rows: [ropeRow], head: 0 },
    ],
    op: { kind: "rope", a: qnId, out: qrId },
    lineage: [
      lin(qrId, [qnId], `${shapeLabel(qn)} → ${shapeLabel(qr)}（形状不变）`),
      lin(krId, [knId], `${shapeLabel(kn)} → ${shapeLabel(kr)}（形状不变）`),
    ],
    view: "heads",
    evidence: ["C03", "A02"],
    terms: ["rope", "position"],
  });

  // ---------- 7. 分数 QKᵀ ----------
  const scores = attentionScores(qr, kr);
  const scoresId = T(`${L}.attn.scores`, "分数 QKᵀ/√d_h", scores, "scores");
  emit({
    id: `${L}.attn.scores`,
    title: "注意力分数 QKᵀ",
    brief: "每个 Q 头与所属 KV 头逐位置点积，除以 √d_h",
    detail: `对 Q 头 h，取 KV 头 g(h)=⌊h/${group}⌋：分数[h,i,j] = Q[i,h,:]·K[j,g(h),:] / √${d}。${group > 1 ? `GQA 下每 ${group} 个 Q 头共用同一个 K 头（h=0,1→K 头 0），这就是 repeat_kv 的含义。` : "MHA 下每个 Q 头有自己的 K 头。"}结果是 ${nq} 张 [S,S_k]=[${S}×${S}] 的表，行是 query 位置，列是 key 位置。`,
    formula: "scores[h,i,j] = Q[i,h,:] · K[j,g(h),:] / √d_h",
    tensors: [qrId, krId, scoresId],
    highlight: [
      { tensor: qrId, rows: [0], head: 0 },
      { tensor: krId, head: 0 },
      { tensor: scoresId, head: 0, rows: [0] },
    ],
    op: { kind: "scores", a: qrId, b: krId, out: scoresId },
    lineage: [lin(scoresId, [qrId, krId], `${shapeLabel(qr)} · ${shapeLabel(kr)}ᵀ → ${shapeLabel(scores)}`)],
    view: "attention",
    evidence: ["C04", "D02"],
    terms: ["attention-scores", "gqa", "dot-product"],
  });

  // ---------- 8. 因果 mask ----------
  const masked = clone(scores);
  causalMaskInplace(masked);
  const maskedId = T(`${L}.attn.masked`, "分数（因果掩码后）", masked, "scores");
  const upperCells: [number, number][] = [];
  for (let i = 0; i < S; i++) for (let j = i + 1; j < S; j++) upperCells.push([i, j]);
  emit({
    id: `${L}.attn.mask`,
    title: "因果掩码",
    brief: "位置 i 只能看 j≤i，未来位置置 −∞",
    detail: `生成第 i 个 token 时不能偷看后面的 token，所以每张分数表的右上三角（j>i）加上 −∞，softmax 后这些位置严格为 0。本站用 −1e30 表示 −∞ [A03]。prefill 时 S 个 query 一起算，所以是三角形；decode 时只有 1 行，能看到全部历史 key。`,
    formula: "scores[h,i,j] = −∞  (j > i)",
    tensors: [scoresId, maskedId],
    highlight: [{ tensor: maskedId, head: 0, cells: upperCells }],
    op: { kind: "mask", a: scoresId, out: maskedId },
    lineage: [lin(maskedId, [scoresId], `${shapeLabel(scores)} → ${shapeLabel(masked)}（形状不变）`)],
    view: "attention",
    evidence: ["C05", "A03"],
    terms: ["causal-mask", "prefill"],
  });

  // ---------- 9. Softmax ----------
  const probs = softmaxLastDim(masked);
  const probsId = T(`${L}.attn.probs`, "注意力概率 P", probs, "scores");
  emit({
    id: `${L}.attn.softmax`,
    title: "Softmax",
    brief: "每行归一化成概率，和为 1；被掩码处为 0",
    detail: `对每张表的每一行做 softmax：先减去行最大值（数值稳定），取 exp，再除以行和。得到 P[h,i,:]：query i 分配给各 key 的注意力权重，非负且和为 1。HF 在 float32 下做这一步再转回 bf16。`,
    formula: "P[h,i,j] = exp(s[h,i,j] − max_j s) / Σ_j exp(s[h,i,j] − max_j s)",
    tensors: [maskedId, probsId],
    highlight: [
      { tensor: maskedId, head: 0, rows: [S - 1] },
      { tensor: probsId, head: 0, rows: [S - 1] },
    ],
    op: { kind: "softmax", a: maskedId, out: probsId },
    lineage: [lin(probsId, [maskedId], `${shapeLabel(masked)} → ${shapeLabel(probs)}（形状不变）`)],
    view: "attention",
    evidence: ["C05"],
    terms: ["softmax", "attention-weights"],
  });

  // ---------- 10. P·V ----------
  const ctx = attentionValues(probs, vHeads);
  const ctxId = T(`${L}.attn.ctx`, "上下文向量（按头）", ctx, "activation");
  emit({
    id: `${L}.attn.pv`,
    title: "加权求和 P·V",
    brief: "用概率加权 V 的各行，得到每个头的上下文向量",
    detail: `对 Q 头 h 的 query i：ctx[i,h,:] = Σ_j P[h,i,j] · V[j,g(h),:]。也就是把所有 key 位置的 V 向量按注意力权重加权平均。${group > 1 ? `GQA 下 V 头同样被 ${group} 个 Q 头共享。` : ""}结果形状 [S,n_q,d_h]=[${S}×${nq}×${d}]。`,
    formula: "ctx[i,h,:] = Σ_j P[h,i,j] · V[j,g(h),:]",
    tensors: [probsId, vHeadsId, ctxId],
    highlight: [
      { tensor: probsId, head: 0, rows: [S - 1] },
      { tensor: vHeadsId, head: 0 },
      { tensor: ctxId, rows: [S - 1], head: 0 },
    ],
    op: { kind: "pv", a: probsId, b: vHeadsId, out: ctxId },
    lineage: [
      lin(ctxId, [probsId, vHeadsId], `${shapeLabel(probs)} · ${shapeLabel(vHeads)} → ${shapeLabel(ctx)}`),
    ],
    view: "attention",
    evidence: ["C06", "D02"],
    terms: ["context-vector", "value"],
  });

  // ---------- 11. 拼接多头 ----------
  const merged = mergeHeads(ctx, "n_q·d_h");
  const mergedId = T(`${L}.attn.ctx_merged`, "上下文向量（拼接）", merged, "activation");
  emit({
    id: `${L}.attn.merge`,
    title: "拼接多头",
    brief: "[S,n_q,d_h] 视图变回 [S,n_q·d_h]，不搬数据",
    detail: `${nq} 个头的 ${d} 维输出按头顺序首尾相接，得到 [S,${qd}]。这只是改变看法（reshape），内存里数据不动，和最初 Q 投影输出的排布一致。`,
    tensors: [ctxId, mergedId],
    highlight: [
      { tensor: ctxId, rows: [0] },
      { tensor: mergedId, rows: [0] },
    ],
    op: { kind: "merge", a: ctxId, out: mergedId },
    lineage: [lin(mergedId, [ctxId], `${shapeLabel(ctx)} → ${shapeLabel(merged)}`)],
    view: "heads",
    evidence: ["C06"],
    terms: ["multi-head"],
  });

  // ---------- 12. 输出投影 W_o ----------
  const attnOutId = `${L}.attn.out`;
  const attnOut = projStep({
    id: `${L}.attn.o`,
    title: "输出投影 W_o",
    brief: "拼接后的上下文乘 W_o，回到 H 维",
    detail: `W_o[n_q·d_h, H]=[${qd}×${H}] 把各头的信息混合并映射回隐藏维。这是注意力块的最后一个矩阵乘。`,
    xId: mergedId,
    x: merged,
    w: W.o,
    wName: "W_o",
    yId: attnOutId,
    yName: "注意力输出",
    yRole: "activation",
    view: "matmul",
    evidence: ["C06", "D03"],
    terms: ["linear-projection", "output-projection"],
  });

  // ---------- 13. 残差① ----------
  const res1 = add(x, attnOut);
  const res1Id = T(`${L}.res1`, "X + Attn(X)", res1, "activation");
  emit({
    id: `${L}.res1`,
    title: "残差相加①",
    brief: "注意力输出加回本层输入 X，形状不变",
    detail: `res1 = X + Attn(X)。残差让每一层只需学习「增量」，深层网络才能稳定训练；推理时它是一次逐元素加法，形状保持 [S,H]=[${S}×${H}]。`,
    formula: "res1 = X + Attn(X)",
    tensors: [xInId, attnOutId, res1Id],
    highlight: [
      { tensor: xInId, rows: [0] },
      { tensor: attnOutId, rows: [0] },
      { tensor: res1Id, rows: [0] },
    ],
    op: { kind: "add", a: xInId, b: attnOutId, out: res1Id },
    lineage: [
      lin(res1Id, [xInId, attnOutId], `${shapeLabel(x)} + ${shapeLabel(attnOut)} → ${shapeLabel(res1)}`),
    ],
    view: "residual",
    evidence: ["C07"],
    terms: ["residual"],
  });

  // ---------- 14. RMSNorm（MLP 前）----------
  const ln2 = rmsnorm(res1, eps);
  const ln2Id = T(`${L}.ln2.out`, "res1（RMSNorm 后）", ln2, "activation");
  emit({
    id: `${L}.ln2`,
    title: "RMSNorm（MLP 前）",
    brief: "进入 MLP 前再做一次逐行 RMSNorm",
    detail: `与注意力前相同的运算，权重是另一组 post_attention_layernorm[H]。Pre-Norm 结构：每个子块（注意力、MLP）进入前各归一化一次，残差主干本身不归一化。`,
    formula: "y = x / sqrt(mean(x²) + ε) · w",
    tensors: [res1Id, ln2Id],
    highlight: [
      { tensor: res1Id, rows: [0] },
      { tensor: ln2Id, rows: [0] },
    ],
    op: { kind: "rmsnorm", a: res1Id, out: ln2Id },
    lineage: [lin(ln2Id, [res1Id], `${shapeLabel(res1)} → ${shapeLabel(ln2)}`)],
    view: "norm",
    evidence: ["C01", "C07", "A01"],
    terms: ["rmsnorm", "pre-norm"],
  });

  // ---------- 15-16. gate / up ----------
  const gateId = `${L}.mlp.gate`;
  const upId = `${L}.mlp.up`;
  const gate = projStep({
    id: gateId,
    title: "MLP 门控投影",
    brief: `乘 W_gate[H,I]，从 H=${H} 升到 I=${I}`,
    detail: `MLP 的第一路：W_gate 把每个 token 从 H 维升到中间维 I（${(I / H).toFixed(1)} 倍）。它的输出将经过 SiLU 作为「门」。`,
    xId: ln2Id,
    x: ln2,
    w: W.gate,
    wName: "W_gate",
    yId: gateId,
    yName: "gate = X_n·W_gate",
    yRole: "activation",
    view: "mlp",
    evidence: ["C08", "D03"],
    terms: ["mlp", "swiglu"],
  });
  const up = projStep({
    id: upId,
    title: "MLP 上投影",
    brief: "乘 W_up[H,I]，与 gate 同形状",
    detail: `MLP 的第二路：W_up 与 W_gate 形状相同，输入也相同（X_n），两路可以并行算。工程上常把 W_gate 和 W_up 拼成一个 [H,2I] 矩阵一次算完（vLLM 的 MergedColumnParallelLinear）。`,
    xId: ln2Id,
    x: ln2,
    w: W.up,
    wName: "W_up",
    yId: upId,
    yName: "up = X_n·W_up",
    yRole: "activation",
    view: "mlp",
    evidence: ["C08", "D03"],
    terms: ["mlp", "swiglu"],
  });

  // ---------- 17. SwiGLU ----------
  const act = siluMul(gate, up);
  const actId = T(`${L}.mlp.act`, "silu(gate) ⊙ up", act, "activation");
  emit({
    id: `${L}.mlp.act`,
    title: "SwiGLU 激活",
    brief: "silu(gate) ⊙ up：逐元素相乘，形状不变",
    detail: `silu(g) = g · sigmoid(g)。门控路经过 SiLU 后与上投影路逐元素相乘，得到 [S,I]=[${S}×${I}]。这是整层里除 softmax 外唯一的非线性，在 NPU 上走向量单元而不是矩阵单元。`,
    formula: "act = silu(gate) ⊙ up，silu(g) = g / (1 + e^(−g))",
    tensors: [gateId, upId, actId],
    highlight: [
      { tensor: gateId, rows: [0] },
      { tensor: upId, rows: [0] },
      { tensor: actId, rows: [0] },
    ],
    op: { kind: "silu_mul", a: gateId, b: upId, out: actId },
    lineage: [lin(actId, [gateId, upId], `${shapeLabel(gate)} ⊙ ${shapeLabel(up)} → ${shapeLabel(act)}`)],
    view: "mlp",
    evidence: ["C08"],
    terms: ["swiglu", "silu"],
  });

  // ---------- 18. down ----------
  const downId = `${L}.mlp.down`;
  const down = projStep({
    id: downId,
    title: "MLP 下投影",
    brief: `乘 W_down[I,H]，从 I=${I} 降回 H=${H}`,
    detail: `W_down 把中间维压回隐藏维。MLP 三个矩阵共 3·H·I=${fmtCount(3 * H * I)} 个参数，通常是一层里参数最多的部分。`,
    xId: actId,
    x: act,
    w: W.down,
    wName: "W_down",
    yId: downId,
    yName: "MLP 输出",
    yRole: "activation",
    view: "mlp",
    evidence: ["C08", "D03"],
    terms: ["mlp", "down-projection"],
  });

  // ---------- 19. 残差② ----------
  const res2 = add(res1, down);
  const res2Id = T(`${L}.res2`, `X_out（第 ${layerIdx} 层输出）`, res2, "output");
  emit({
    id: `${L}.res2`,
    title: "残差相加②",
    brief: "MLP 输出加回 res1，得到本层输出 [S,H]",
    detail: `res2 = res1 + MLP(res1)。本层结束，输出形状与输入完全相同 [S,H]=[${S}×${H}]，直接作为下一层的输入。${spec.numLayers} 层重复同样的流程，最后经 model.norm 与 lm_head 得到 logits。`,
    formula: "X_out = res1 + MLP(res1)",
    tensors: [res1Id, downId, res2Id],
    highlight: [
      { tensor: res1Id, rows: [0] },
      { tensor: downId, rows: [0] },
      { tensor: res2Id, rows: [0] },
    ],
    op: { kind: "add", a: res1Id, b: downId, out: res2Id },
    lineage: [
      lin(res2Id, [res1Id, downId], `${shapeLabel(res1)} + ${shapeLabel(down)} → ${shapeLabel(res2)}`),
    ],
    view: "residual",
    evidence: ["C07"],
    terms: ["residual"],
  });

  // ---------- 20. KV 写回 ----------
  const kvBlock = zeros([S, 2, nkv, d], ["S", "K|V", "n_kv", "d_h"]);
  const per = nkv * d;
  for (let s = 0; s < S; s++) {
    kvBlock.data.set(kr.data.subarray(s * per, (s + 1) * per), s * 2 * per);
    kvBlock.data.set(vHeads.data.subarray(s * per, (s + 1) * per), (s * 2 + 1) * per);
  }
  const kvId = T(`${L}.kv.block`, "KV Cache（本层）", kvBlock, "kv");
  const kvBytesPerToken = kvBytesPerTokenLayer(a, spec.bytesPerParam);
  emit({
    id: `${L}.kv.write`,
    title: "写入 KV Cache",
    brief: `本层 K、V 写回缓存：每 token ${kvBytesPerToken} 字节`,
    detail: `写入的是 RoPE 之后的 K 和不变的 V，每个 token 各 n_kv·d_h=${per} 个元素，K+V 共 ${2 * per} 个，按 ${spec.dtype} 每元素 ${spec.bytesPerParam} 字节 = ${kvBytesPerToken} B/token/层；${spec.numLayers} 层合计 ${kvBytesPerToken * spec.numLayers} B/token。下一次 decode 只需算新 token 的 Q，K/V 从这里读，不重算。这就是工作台「每生成一个 token 占多少显存」的来源。`,
    formula: "KV 字节/token/层 = 2 · n_kv · d_h · bytes(dtype)",
    tensors: [krId, vHeadsId, kvId],
    highlight: [{ tensor: krId }, { tensor: vHeadsId }, { tensor: kvId, rows: range(S) }],
    op: { kind: "kv_write", a: krId, b: vHeadsId, out: kvId },
    lineage: [
      lin(kvId, [krId, vHeadsId], `${shapeLabel(kr)} ⊕ ${shapeLabel(vHeads)} → ${shapeLabel(kvBlock)}`),
    ],
    view: "kv",
    evidence: ["C09", "D01", "S01"],
    terms: ["kv-cache", "decode"],
  });

  return { x: res2, k: kr, v: vHeads, stepIds };
}

export interface BuildTimelineOptions {
  layerIndex?: number;
  chapterId?: string;
}

/**
 * 生成一层的完整 Timeline，并在构造期校验不变量（step/张量/证据）。
 * hardware 字段此时为空，由 mapResidency 填充后再次校验。
 */
export function buildLayerTimeline(
  spec: ModelSpec,
  preset: Timeline["preset"],
  opts: BuildTimelineOptions = {},
): Timeline {
  const layerIndex = opts.layerIndex ?? 0;
  const t0 = performance.now();
  const rec = new Recorder(spec.bytesPerParam);
  forwardLayer(spec, layerIndex, preset.ids, rec);
  const tl: Timeline = {
    chapterId: opts.chapterId ?? "03",
    modelId: spec.id,
    modelName: spec.name,
    preset,
    layerIndex,
    tensors: rec.tensors,
    steps: rec.steps,
    buildMs: performance.now() - t0,
  };
  assertValid(tl);
  assertClaimIds(tl.steps.flatMap((s) => s.evidence));
  return tl;
}
