import { type ChapterLayer, HEAD, projectionWeight } from "./chapter-layer";

export const JOURNEY_NODES = [
  { id: "x", name: "原输入 X", x: 60, y: 65, at: 0 },
  { id: "n1", name: "归一化 N₁", x: 300, y: 65, at: 1 },
  { id: "q", name: "查询 Q", x: 210, y: 225, at: 2 },
  { id: "k", name: "键 K", x: 370, y: 225, at: 3 },
  { id: "v", name: "内容 V", x: 530, y: 225, at: 4 },
  { id: "scores", name: "匹配分数 S", x: 210, y: 370, at: 5 },
  { id: "alpha", name: "混合比例 α", x: 370, y: 370, at: 6 },
  { id: "weighted", name: "各位置贡献", x: 530, y: 370, at: 7 },
  { id: "mixed", name: "汇总内容", x: 530, y: 480, at: 8 },
  { id: "da", name: "注意力 ΔA", x: 210, y: 480, at: 9 },
  { id: "mid", name: "更新后 X′", x: 60, y: 595, at: 10 },
  { id: "n2", name: "归一化 N₂", x: 210, y: 595, at: 11 },
  { id: "h", name: "展开 H", x: 530, y: 595, at: 12 },
  { id: "relu", name: "激活 H₊", x: 530, y: 735, at: 13 },
  { id: "df", name: "前馈 ΔF", x: 210, y: 735, at: 14 },
  { id: "y", name: "本层输出 Y", x: 60, y: 840, at: 15 },
] as const;
export type JourneyNode = (typeof JOURNEY_NODES)[number]["id"];
export const JOURNEY_STEPS = [
  {
    title: "X 进入，保留原输入",
    sources: ["x"],
    target: "x",
    formula: "X → 保留 X，同时交给计算支路",
    why: "每个位置带着原来的 4,096 维表示进入这一层。保留的 X 要等注意力完成后再用。",
  },
  {
    title: "第一次 RMSNorm",
    sources: ["x"],
    target: "n1",
    formula: "N₁ = X ÷ RMS(X) ⊙ γ₁",
    why: "每列用自己的全部维度计算 RMS，再逐维乘增益 γ₁。改变的是支路输入，旁路的 X 原值保留。",
  },
  {
    title: "Wq 生成查询 Q",
    sources: ["n1"],
    target: "q",
    formula: "Q = N₁ Wq · [6,4096] × [4096,8] → [6,8]",
    why: "每个 Q 维度都由 N₁ 的全部 4,096 个数乘对应系数后相加。Wq 是训练学得的映射参数，Q 是本次输入算出的查询。",
  },
  {
    title: "Wk 生成键 K",
    sources: ["n1"],
    target: "k",
    formula: "K = N₁ Wk · [6,4096] × [4096,8] → [6,8]",
    why: "仍从同一份 N₁ 出发，换一组参数 Wk，得到各位置供查询匹配的 K。这里不是把 Q 改名为 K。",
  },
  {
    title: "Wv 生成内容 V",
    sources: ["n1"],
    target: "v",
    formula: "V = N₁ Wv · [6,4096] × [4096,8] → [6,8]",
    why: "第三条映射使用 Wv。V 是实际参与混合的内容；它和 Q、K 都来自 N₁，但权重不同、计算结果不同。",
  },
  {
    title: "Q 与各位置 K 匹配",
    sources: ["q", "k"],
    target: "scores",
    formula: "S[t,j] = Σᵢ Q[t,i] K[j,i] / √8",
    why: "当前位置的 Q 和每个位置的 K 逐维相乘、求和，再除以 √8。此时得到的是分数，尚不是混合比例。",
  },
  {
    title: "屏蔽未来，再做 softmax",
    sources: ["scores"],
    target: "alpha",
    formula: "α = softmax(mask(S)) · 可见位置的比例之和 = 1",
    why: "未来位置的分数先置为 −∞，对应比例为 0。对可见分数取指数并归一化，才得到非负的 α；α 随输入改变。",
  },
  {
    title: "每列 V 乘自己的 α",
    sources: ["v", "alpha"],
    target: "weighted",
    formula: "贡献[j,i] = α[t,j] × V[j,i]",
    why: "比例要落实到内容上：例如取 20%，就把这一列八个数都乘 0.2。每个位置贡献多少由 α 决定，八个维度保留。",
  },
  {
    title: "同维相加，汇成一列",
    sources: ["weighted"],
    target: "mixed",
    formula: "汇总[i] = Σⱼ α[t,j] V[j,i] · [可见位置,8] → [1,8]",
    why: "第 1 维只加到第 1 维，第 2 维只加到第 2 维。多个位置的内容在这里汇入当前这个位置，结果仍是 8 维。",
  },
  {
    title: "Wₒ 投影回 4,096 维",
    sources: ["mixed"],
    target: "da",
    formula: "ΔA = 汇总 Wₒ · [1,8] × [8,4096] → [1,4096]",
    why: "每个输出维使用 Wₒ 中自己的一列系数，把八个输入组合成一个数。4,096 列给出完整 ΔA，恢复能与 X 相加的尺寸。",
  },
  {
    title: "加回保留的 X",
    sources: ["x", "da"],
    target: "mid",
    formula: "X′[t,i] = X[t,i] + ΔA[t,i]",
    why: "到这里才第一次更新主路径。加数是最开始保留的 X，另一项是完整注意力支路算出的 ΔA；形状和位置都不变。",
  },
  {
    title: "用 X′ 再做 RMSNorm",
    sources: ["mid"],
    target: "n2",
    formula: "N₂ = X′ ÷ RMS(X′) ⊙ γ₂",
    why: "第二条支路从刚更新的 X′ 出发，重新计算分母，并使用这一处的 γ₂。旁路继续保留 X′，不会退回最初的 X。",
  },
  {
    title: "W₁ 展开到 8,192 维",
    sources: ["n2"],
    target: "h",
    formula: "H = N₂ W₁ · [1,4096] × [4096,8192] → [1,8192]",
    why: "每个中间维都组合当前位置的全部 4,096 维。各位置分别计算，共用 W₁；增加的是维度，不是位置数量。",
  },
  {
    title: "ReLU 处理每个维度",
    sources: ["h"],
    target: "relu",
    formula: "H₊[t,i] = max(0, H[t,i])",
    why: "负数置零，非负数保留。8,192 个维度槽位仍然存在。这一步引入非线性，不能用一次矩阵乘法替代。",
  },
  {
    title: "W₂ 收回到 4,096 维",
    sources: ["relu"],
    target: "df",
    formula: "ΔF = H₊ W₂ · [1,8192] × [8192,4096] → [1,4096]",
    why: "全部 8,192 维通过 W₂ 重新组合成 4,096 维改变量。它还没有替换 X′，需要进行最后一次残差相加。",
  },
  {
    title: "加回 X′，输出 Y",
    sources: ["mid", "df"],
    target: "y",
    formula: "Y[t,i] = X′[t,i] + ΔF[t,i]",
    why: "同一个位置的表示完成第二次更新。Y 接着作为下一层的 X；这一层还没有生成词，需要后续各层、末端归一化和词表投影。",
  },
] satisfies { title: string; sources: JourneyNode[]; target: JourneyNode; formula: string; why: string }[];

export const JOURNEY_SECONDS = 36;
export function journeyFrame(progress: number) {
  const position = Math.max(0, Math.min(1, progress)) * JOURNEY_STEPS.length;
  const step = Math.min(JOURNEY_STEPS.length - 1, Math.floor(position));
  return { step, amount: position - step };
}
export function journeyTensors(data: ChapterLayer, word: number) {
  const { count, width, attention: a } = data;
  const scores = Float64Array.from({ length: count }, (_, j) => {
    let sum = 0;
    for (let d = 0; d < HEAD; d++) sum += a.q[word * HEAD + d]! * a.k[j * HEAD + d]!;
    return sum / Math.sqrt(HEAD);
  });
  const tensor = (values: Float32Array | Float64Array, rows: number, positions = count) => ({
    values,
    rows,
    positions,
  });
  return {
    x: tensor(data.input, width),
    n1: tensor(data.norm1, width),
    q: tensor(a.q, HEAD),
    k: tensor(a.k, HEAD),
    v: tensor(a.v, HEAD),
    scores: tensor(scores, 1),
    alpha: tensor(a.weights.slice(word * count, (word + 1) * count), 1),
    weighted: tensor(
      Float32Array.from(a.v, (v, i) => v * a.weights[word * count + Math.floor(i / HEAD)]!),
      HEAD,
    ),
    mixed: tensor(a.mixed.slice(word * HEAD, (word + 1) * HEAD), HEAD, 1),
    da: tensor(a.delta, width),
    mid: tensor(data.mid, width),
    n2: tensor(data.norm2.output, width),
    h: tensor(data.ffn.expanded, data.ffn.expanded.length / count),
    relu: tensor(data.ffn.activated, data.ffn.activated.length / count),
    df: tensor(data.ffn.delta, width),
    y: tensor(data.output, width),
  };
}
export type JourneyTensors = ReturnType<typeof journeyTensors>;
export function journeyValue(tensors: JourneyTensors, id: JourneyNode, word: number, dimension: number) {
  const t = tensors[id];
  return t.values[(t.positions === 1 ? 0 : word) * t.rows + Math.min(dimension, t.rows - 1)]!;
}
/** Every term participates; a row in the inspector may group many adjacent dimensions. */
export function journeyProjection(tensors: JourneyTensors, step: number, word: number, dimension: number) {
  const projections: Partial<Record<number, readonly [JourneyNode, number]>> = {
    2: ["n1", 1],
    3: ["n1", 2],
    4: ["n1", 3],
    9: ["mixed", 4],
    12: ["n2", 5],
    14: ["relu", 6],
  };
  const spec = projections[step];
  if (!spec) return [];
  const input = tensors[spec[0]];
  const output = tensors[JOURNEY_STEPS[step]!.target];
  const d = Math.min(dimension, output.rows - 1);
  return Array.from({ length: 8 }, (_, group) => {
    const start = Math.floor((group * input.rows) / 8),
      end = Math.floor(((group + 1) * input.rows) / 8);
    let sum = 0;
    for (let i = start; i < end; i++)
      sum +=
        input.values[(input.positions === 1 ? 0 : word) * input.rows + i]! *
        projectionWeight(i, d, input.rows, spec[1]);
    return { start, end, sum };
  });
}
