import { span } from "./scene-easing";
import { OPTIMIZATION_LESSONS, offloadStageDetail, optimizationFrame } from "./scene-optimization";
import { DCP_QUERY, dcpKeyVector, dcpValueVector } from "./scene-parallel-mechanisms";

export const numberText = (x: number | string) => (typeof x === "number" ? String(+x.toFixed(2)) : x);

export const INFERENCE_LESSONS = [
  {
    label: "Attention",
    title: "从匹配到上下文：每一行究竟贡献了多少？",
    seconds: 44,
    note: "八位置、四通道单头注意力教学算例；显示保留两位小数，运算使用未取舍值。逻辑展开不表示融合内核必须物化整张分数矩阵。",
    stages: ["认清 Q / K / V", "匹配变成份数", "每行占多少", "合成上下文"],
    details: [
      "追踪位置 7 的查询 Q。K 决定匹配程度，V 是真正取回的四通道内容；它们来自同一位置，却各有用途。",
      "Q 与每行 K 点积，再除以 √4。取指数得到非负的原始份数：0.5 或 1.5。这里的数还没有归一化。",
      "八行的份数合计 8。每行除以 8 后，得到最终占比 1/16 或 3/16；这八个占比相加等于 1。",
      "每条 V 的四个通道一起乘本行占比，再按通道相加。输出仍是一条四通道向量 [25, 15, 12.5, 7.5]，交给本层后续投影。",
    ],
  },
  {
    label: "KV cache",
    title: "位置 6 的这一行数据，存到显存的哪里？",
    seconds: 18,
    note: "普通分页缓存教学示例：每块 4 个位置，K、V 各 2 通道；只展开参与的三个块。共享的是已算好、身份匹配的完整前缀块。",
    stages: [
      "找位置所在的一组",
      "查块号，找到第 3 行",
      "把这一行存进去",
      "共用已有的数据",
      "请求 A 结束",
      "请求 B 结束",
    ],
    details: [
      "每块放 4 个位置。位置 6 属于 4–7 这一组，先找到表中间这一格。蓝色数据还在原处。",
      "表里写着“块 2”。4、5、6、7 中，6 是第三个，所以接收位置就是块 2 的第 3 行。",
      "整行蓝色数据落进这里。已有的数据留在原位，表里的块号仍是 2：这次更新的是内容。",
      "请求 B 也需要同一个完整前缀。它增加一条指向块 7 的使用关系，两条请求共用原数据。",
      "A 结束了。块 2、9 可以再分配；块 7 还有 B 在用，必须保留。",
      "B 也结束了，块 7 才能再分配。空闲不等于擦除，旧内容等到重新分配时再失效或覆盖。",
    ],
  },
  {
    label: "PD 交接",
    title: "P 的历史，怎样安全地接到 D 上？",
    seconds: 52,
    note: "Mooncake V1 固定实现的纯注意力示例：每块 2 个位置，每实例展开参与传输的一张卡。P、D 是两组独立实例；不表示本站 GLM 双机已经启用 PD。",
    stages: ["源块先保留", "D 分目的块", "拉取第一块", "拉取第二块", "确认后释放", "D 接着计算"],
    details: [
      "P 已算完 p0–p3。请求虽按长度上限结束，块 7、12 仍被传输持有，直到收到完成信号。",
      "D 从自己的缓存池分到块 3、5。此时目标槽位已准备好，但还没有历史数据，这条请求等待接收。",
      "D 发起读取：把 P 的块 7 内容复制到 D 的块 3。块号是各自池内编号，传的是 K/V 内容。",
      "再追踪 P#12 → D#5。两块都到达后，D 才具备完整历史；按块依次播放只为看清对应，不代表实际传输包顺序。",
      "D 发回完成信号；信号到达 P 后，P 才释放源块。D 的副本继续保留，源块释放不会删掉目的数据。",
      "D 的请求重新排队。纯注意力示例重算最后的 p3，采样首 token 后继续 decode；混合模型的 N−1 交接见下文。",
    ],
  },
  {
    label: "AI Core",
    title: "同一组数，从显存到 Cube、Vector，再写回",
    seconds: 32,
    note: "按本页 CANN 8.0.RC2 分离架构展示经 GM 交接的逻辑路径；缓冲位置、形状与微型矩阵均为示意，不表示芯片实物布局或最小指令尺寸。",
    stages: [
      "数据在 GM",
      "搬入 L1",
      "操作数就绪",
      "Cube 乘加",
      "经 GM 交接",
      "搬进 UB",
      "Vector 激活",
      "写回 GM",
    ],
    details: [
      "GM 是设备全局内存。输入 x 与权重 W 先在这里，AIC 负责矩阵乘，AIV 负责逐项运算。",
      "先将 x 和 W 搬入矩阵侧 L1。GM 原数据保留，片上缓冲接住本次要用的一块。",
      "x 进入 L0A、W 进入 L0B。只有操作数到达之后，Cube 才能开始计算。",
      "同一行 x 分别乘 W 的两列：1×1+2×2=5；1×(−1)+2×(−2)=−5。L0C 接住完整结果 [5,−5]。",
      "Fixpipe 输出矩阵结果到 GM 中间区。这是本例 AIC 与 AIV 的交接位置。",
      "向量侧从 GM 把 [5,−5] 搬入 UB。这里读到的是矩阵计算的结果，尚未做激活。",
      "Vector 做 ReLU：正数 5 保留，负数 −5 变成 0。UB 中得到 [5,0]，两个通道的对应顺序不变。",
      "把 UB 的 [5,0] 写回 GM 输出槽。原始输入、权重、中间结果与最终输出可以逐一对照。",
    ],
  },
  ...OPTIMIZATION_LESSONS,
] as const;

export function inferenceFrame(kind: number, progress: number) {
  if (kind >= 4) return optimizationFrame(kind - 4, progress);
  const count = INFERENCE_LESSONS[kind]!.stages.length;
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * count;
  const phase = Math.min(count - 1, Math.floor(p));
  const local = p - phase;
  if (kind === 1)
    return { phase, local, travel: span(local, 0, 0.9), landed: local >= 0.9, settled: local >= 0.94 };
  if (kind === 3)
    return { phase, local, travel: span(local, 0.04, 0.65), landed: local >= 0.65, settled: local >= 0.82 };
  return { phase, local, travel: span(local, 0.15, 0.65), landed: local >= 0.65, settled: local >= 0.82 };
}

export function inferenceTeaching(kind: number, progress: number) {
  const f = inferenceFrame(kind, progress),
    lesson = INFERENCE_LESSONS[kind]!;
  let detail: string = lesson.details[f.phase]!;
  if (kind === 1) {
    const own = kvOwnership(progress);
    if (f.phase === 3 && !own.r2)
      detail =
        "请求 B 需要相同的前 4 个位置，正在建立指向块 7 的引用；连接落稳前块 7 仍只有 A 这 1 条使用关系。";
    else if (f.phase === 4 && !f.landed)
      detail = "A 结束，正在归还它占用的块。撤完后块 2、9 可以再分配；块 7 还要留给 B。";
    else if (f.phase === 5 && !f.landed) detail = "正在撤掉 B 的最后一条使用关系。撤完后，块 7 才能再分配。";
  } else if (kind === 2) {
    const pd = pdStageStatus(progress);
    if (f.phase === 1 && !pd.allocated)
      detail = "D 正在自己的缓存池中申请目的块 3、5；分配完成前目标槽位尚未就绪，请求等待分配。";
    else if (pd.queued) detail = "两块历史与确认均已完成，D 将该请求重新放入可调度队列，等待上核恢复前向。";
    else if (pd.recomputing)
      detail = "D 已调度该请求上核，读取本地块 3、5 的历史并重算末位 p3，准备采样首 token。";
    else if (pd.resumed)
      detail =
        "D 已完成末位 p3 重算并采样首 token，随后按正常 decode 步继续生成；混合模型的 N−1 交接见下文。";
  } else if (kind === 6) {
    detail = offloadStageDetail(progress);
  }
  return { title: lesson.stages[f.phase]!, detail, equation: "", tensors: [] };
}

export const ATTENTION = {
  query: DCP_QUERY,
  keys: Array.from({ length: 8 }, (_, i) => dcpKeyVector(i)),
  values: Array.from({ length: 8 }, (_, i) => dcpValueVector(i)),
  mass: Array.from({ length: 8 }, (_, i) =>
    Math.exp(DCP_QUERY.reduce((s, q, c) => s + q * dcpKeyVector(i)[c]!, 0) / 2),
  ),
};
export const ATTENTION_TOTAL = ATTENTION.mass.reduce((a, b) => a + b, 0);
export const attentionSum = (indices: number[], normalized = false) =>
  Array.from(
    { length: 4 },
    (_, c) =>
      indices.reduce((s, i) => s + ATTENTION.values[i]![c]! * ATTENTION.mass[i]!, 0) /
      (normalized ? indices.reduce((s, i) => s + ATTENTION.mass[i]!, 0) : 1),
  );
export const ATTENTION_GROUPS = [
  [0, 2, 4, 6],
  [1, 3, 5, 7],
];
export const ATTENTION_OUTPUT = attentionSum([0, 1, 2, 3, 4, 5, 6, 7], true);
export function attentionMerge(progress: number) {
  const f = inferenceFrame(0, progress);
  return {
    enabled: f.phase === 5,
    travels: [span(f.local, 0.15, 0.42), span(f.local, 0.5, 0.77)],
    added: f.phase === 5 ? Number(f.local >= 0.46) + Number(f.local >= 0.82) : 0,
  };
}
export const KV_BLOCKS = [7, 2, 9];
export const kvSlot = (position: number) => KV_BLOCKS[Math.floor(position / 4)]! * 4 + (position % 4);
export const kvRow = (position: number) => [position, position + 1, position + 2, position + 3];
export function kvOwnership(progress: number) {
  const f = inferenceFrame(1, progress);
  const joined = f.phase > 3 || (f.phase === 3 && f.landed);
  const r1 = f.phase < 4 || (f.phase === 4 && !f.landed);
  const r2 = joined && (f.phase < 5 || !f.landed);
  return { r1, r2, refs: [Number(r1) + Number(r2), Number(r1), Number(r1)] };
}
export function pdHandoff(progress: number) {
  const f = inferenceFrame(2, progress);
  return {
    allocated: f.phase > 1 || (f.phase === 1 && f.landed),
    received: [f.phase > 2 || (f.phase === 2 && f.landed), f.phase > 3 || (f.phase === 3 && f.landed)],
    released: f.phase > 4 || (f.phase === 4 && f.landed),
    resumed: f.phase === 5 && f.landed,
  };
}
export function pdStageStatus(progress: number) {
  const f = inferenceFrame(2, progress);
  const handoff = pdHandoff(progress);
  return {
    ...handoff,
    queued: f.phase === 5 && f.local < 0.25,
    recomputing: f.phase === 5 && f.local >= 0.25 && !handoff.resumed,
  };
}
export const CORE_X = [[1, 2]];
export const CORE_W = [
  [1, -1],
  [2, -2],
];
export const CORE_PRODUCT = CORE_W[0]!.map((_, c) =>
  CORE_X[0]!.reduce((s, x, k) => s + x * CORE_W[k]![c]!, 0),
);
export const CORE_OUTPUT = CORE_PRODUCT.map((x) => Math.max(0, x));
