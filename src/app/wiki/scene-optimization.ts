import { span } from "./scene-easing";

export const OPTIMIZATION_LESSONS = [
  {
    label: "ND → NZ",
    title: "同一张矩阵，怎样换成按块存放？",
    seconds: 63,
    note: "沿用正文 4×4、2×2 小块的教学算例；地址按元素从 0 编号。真实接口的分块尺寸见正文，展开不表示芯片实物布局。",
    stages: [
      "认清逻辑与地址",
      "看清四个小块",
      "存左上块",
      "存左下块",
      "存右上块",
      "存右下块",
      "核对数值与坐标",
    ],
    details: [
      "左边是逻辑矩阵，右上是 ND 的连续地址。第 2 行第 1 列的数值 5，对应 ND 地址 4；数值、坐标、地址是三件事。",
      "以 2×2 为一块，四块仍组成完整的 4×4 矩阵。NZ 先沿块列向下，再转到下一块列；每块内部逐行存。",
      "先取左上块 [1,2;5,6]，按块内行序展开成 [1,2,5,6]，落入 NZ 地址 0–3。",
      "同一块列继续向下：[9,10;13,14] 落入地址 4–7。已经写入的第一块保留。",
      "再换到右边的块列：[3,4;7,8] 落入地址 8–11。逻辑矩阵里的行列位置没有交换。",
      "最后 [11,12;15,16] 落入地址 12–15，四个小块全部写入。",
      "数值 5 仍在逻辑矩阵第 2 行第 1 列，只是物理地址从 4 变成 2。NZ 转换改变存放顺序；转置才会交换逻辑行列。",
    ],
  },
  {
    label: "W8A8",
    title: "整数怎样算，缩放系数怎样乘回来？",
    seconds: 28,
    note: "沿用正文三通道、零点为 0 的对称量化算例。显示数学上的反量化值；最终存成 BF16 还会产生该类型的舍入。只比较张量元素载荷，另有缩放系数与工作区。",
    stages: [
      "原数与缩放",
      "权重离线量化",
      "激活逐行量化",
      "三个整数乘积",
      "用宽整数累加",
      "乘回两份缩放",
      "对照误差与载荷",
    ],
    details: [
      "激活是一行三个通道，权重是一列三个通道。两者最大绝对值分别为 1.27、2.54，缩放系数分别取 0.01、0.02。",
      "权重除以 0.02 再取整，得到 [20,−127,43]。权重量化在部署前离线完成，整数及系数留作后续复用。",
      "本次输入除以 0.01 再取整，得到 [52,−31,127]。0.523 变成编码 52；每个 token 的激活行使用自己的缩放系数。",
      "逐一对齐同通道的两个整数：52×20、(−31)×(−127)、127×43。每个乘积算出后留在对应格子。",
      "三个乘积相加得到 10438，明显超过 INT8 的范围。这里用宽整数记录累加结果，不能把累加器也当成 8 位。",
      "10438 × 0.01 × 0.02 = 2.0876。行激活的系数和列权重的系数，两份都要乘回。",
      "原数直接点积是 2.0888，量化数学结果是 2.0876，差 0.0012。六个 BF16 元素共 12 B，六个 INT8 元素共 6 B；系数和累加区另计。",
    ],
  },
  {
    label: "KV CPU offload",
    title: "主机多存一份，显存回收后怎样接回来？",
    seconds: 64,
    note: "可选 offload 机制，本站固定 GLM 双机主线未启用。普通完整段示意：2 页×每页 2 个位置，K/V 各 2 通道；本图代表单卡的一份传输，执行组恢复还须汇总参与 worker 的完成通知。",
    stages: [
      "源数据已写好",
      "保存第一页",
      "保存第二页",
      "归还并被 C 覆盖",
      "B 命中并分新页",
      "搬回第一页",
      "搬回第二页",
      "完成后恢复计算",
    ],
    details: [
      "请求 A 的位置 0–3 已经计算完成，存在 NPU 显存页 2、7。主机侧先准备空间；仅有保存计划，不代表副本已经可用。",
      "把页 2 的 K/V 复制到主机槽 0。源页留在显存，原来的计算仍可读取；正在复制的目标不能拿去恢复请求。",
      "页 7 复制到主机槽 1。收到整个段的保存完成通知后，这一段主机副本才登记为可用。",
      "A 归还页 2、7 后旧内容原本还在；因显存紧张，新请求 C 立即分走并覆盖这两页，本地前缀才真正淘汰，主机副本继续保留。",
      "B 需要相同前缀：本地页 2、7 已被 C 覆盖，转而命中主机槽 0、1，先在显存另分空页 9、10 并挂起等待加载。",
      "主机槽 0 搬到新页 9。页号可以改变，位置 0、1 的 K/V 内容和顺序不变；B 仍等待剩余内容。",
      "主机槽 1 搬到新页 10。字节到达后仍要确认加载完成；不能看到一页有值，就把整个请求提前恢复。",
      "加载完成通知到达后，B 从接上的位置继续。本例下一位置为 4，写出新的 K/V；主机保存的原段仍然存在。",
    ],
  },
  {
    label: "分块与调度",
    title: "一个长提示词，怎样和正在生成的请求一起前进？",
    seconds: 54,
    note: "沿用正文 A、B 各 decode 1 个位置、C 提示词 14 个位置、每步预算 8 的算例。横轴是调度步，不是毫秒；各步等宽不表示耗时相等。假设 KV 空间等其余准入条件满足。",
    stages: [
      "三条请求就绪",
      "第 1 步：1 + 1 + 6",
      "第 2 步：1 + 1 + 6",
      "第 3 步：1 + 1 + 2",
      "第 4 步：都做 decode",
      "看懂等待与代价",
    ],
    details: [
      "A、B 已经在生成，各差一个新位置。C 刚到达，提示词有 14 个位置。每个调度步最多安排 8 个位置。",
      "先给 A、B 各一个位置，余下 6 个给 C 的位置 0–5。调度先记账，执行完成后这段历史才就绪；C 还不能输出回答。",
      "C 留在运行队列，从位置 6 接着算到 11。它读取自己已有的历史，不会把上一段丢掉，也不会把位置编号重新从 0 开始。",
      "C 只剩位置 12、13。本步总共 4 个位置，还有 4 个预算空着；提示词完整算完后，C 的第一个回答 token y₀ 才能交付。",
      "C 把刚得到的 y₀ 送去前向，和 A、B 一样各推进一个位置。本步用 3 个预算，不必为了凑满 8 个而编造工作。",
      "A、B 每步继续推进；C 的首个输出要等到第三步结束。分块限制每步处理的位置数，不保证等长的执行时间，也不减少原本应计算的因果位置对。",
    ],
  },
] as const;

export function optimizationFrame(kind: number, progress: number) {
  const n = OPTIMIZATION_LESSONS[kind]!.stages.length;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * n;
  const phase = Math.min(n - 1, Math.floor(p + 1e-9)),
    local = Math.max(0, p - phase);
  return { phase, local, travel: span(local, 0.15, 0.7), landed: local >= 0.7, settled: local >= 0.86 };
}
export const LAYOUT_MATRIX = Array.from({ length: 4 }, (_, r) =>
  Array.from({ length: 4 }, (_, c) => r * 4 + c + 1),
);
export const LAYOUT_BLOCKS = [
  [1, 2, 5, 6],
  [9, 10, 13, 14],
  [3, 4, 7, 8],
  [11, 12, 15, 16],
];
export const NZ_ORDER = LAYOUT_BLOCKS.flat();
export const nzAddress = (r: number, c: number) =>
  Math.floor(c / 2) * 8 + Math.floor(r / 2) * 4 + (r % 2) * 2 + (c % 2);
export function layoutState(progress: number) {
  const f = optimizationFrame(0, progress);
  return {
    ...f,
    active: Math.max(0, Math.min(3, f.phase - 2)),
    written: Math.max(0, Math.min(4, f.phase - 2 + Number(f.landed))),
  };
}
export const QUANT = (() => {
  const x = [0.523, -0.31, 1.27],
    w = [0.4, -2.54, 0.86];
  const sx = Math.max(...x.map(Math.abs)) / 127,
    sw = Math.max(...w.map(Math.abs)) / 127;
  const qx = x.map((v) => Math.round(v / sx)),
    qw = w.map((v) => Math.round(v / sw));
  const products = qx.map((v, i) => v * qw[i]!);
  const sum = products.reduce((a, b) => a + b, 0),
    original = x.reduce((s, v, i) => s + v * w[i]!, 0);
  const restored = sum * sx * sw;
  return { x, w, sx, sw, qx, qw, products, sum, original, restored, error: original - restored };
})();
export function quantState(progress: number) {
  const f = optimizationFrame(1, progress),
    channel = Math.min(2, Math.floor(f.local * 3));
  const local = f.local * 3 - channel;
  return {
    ...f,
    channel,
    productTravel: span(local, 0.12, 0.64),
    products: f.phase < 3 ? 0 : f.phase > 3 ? 3 : channel + Number(local >= 0.7),
    weights: f.phase > 1 || (f.phase === 1 && f.landed),
    activation: f.phase > 2 || (f.phase === 2 && f.landed),
    summed: f.phase > 4 || (f.phase === 4 && f.landed),
    restored: f.phase > 5 || (f.phase === 5 && f.landed),
  };
}
export const OFFLOAD_DATA = [
  [0, 1, 2, 3],
  [1, 2, 3, 4],
  [2, 3, 4, 5],
  [3, 4, 5, 6],
];
export const OFFLOAD_C_DATA = [
  [9, 8, 9, 8],
  [8, 7, 8, 7],
  [7, 6, 7, 6],
  [6, 5, 6, 5],
];
export function offloadState(progress: number) {
  const f = optimizationFrame(2, progress);
  const released = f.phase > 3 || (f.phase === 3 && f.local >= 0.3);
  const reclaimed = f.phase > 3 || (f.phase === 3 && f.landed);
  return {
    ...f,
    saved: [f.phase > 1 || (f.phase === 1 && f.landed), f.phase > 2 || (f.phase === 2 && f.landed)],
    hostReady: f.phase > 2 || (f.phase === 2 && f.settled),
    released,
    overwriting: f.phase === 3 && released && !reclaimed,
    reclaimed,
    allocated: f.phase > 4 || (f.phase === 4 && f.landed),
    loaded: [f.phase > 5 || (f.phase === 5 && f.landed), f.phase > 6 || (f.phase === 6 && f.landed)],
    ready: f.phase > 6 || (f.phase === 6 && f.settled),
    resumed: f.phase === 7 && f.landed,
  };
}
export function offloadStageDetail(progress: number) {
  const s = offloadState(progress);
  if (s.phase === 2 && !s.hostReady)
    return s.saved[1]
      ? "页 7 字节已写入主机槽 1，正在等待整段完成通知以登记为可用。"
      : "正在将页 7 复制到主机槽 1；整段完成通知到达前，主机副本尚未登记可用。";
  if (s.phase === 3 && !s.released)
    return "请求 A 刚结束，正在归还显存页 2、7 的引用；归还完成前原页仍由 A 持有。";
  if (s.phase === 3 && !s.reclaimed)
    return "A 已归还页 2、7，此时旧前缀仍在原处；新请求 C 立即分走这两页并写入自己的 K/V。";
  if (s.phase === 4 && !s.allocated)
    return "B 需要相同前缀：查本地发现页 2、7 已被 C 覆盖，转而命中主机槽 0、1，正在申请新页 9、10。";
  if (s.phase === 6 && !s.ready)
    return s.loaded[1]
      ? "主机槽 1 字节已写入页 10，正在汇总参与 worker 的加载完成通知。"
      : "正在将主机槽 1 搬回新页 10；完成通知到达前不能提前恢复 B。";
  if (s.phase === 7 && !s.resumed) return "加载完成通知已到达，B 恢复执行并正在计算接续的位置 4。";
  return OPTIMIZATION_LESSONS[2]!.details[s.phase]!;
}
export const SCHEDULE_C = [6, 6, 2, 1];
export const SCHEDULE_STARTS = [0, 6, 12, 14];
export function scheduleState(progress: number) {
  const f = optimizationFrame(3, progress),
    step = Math.max(0, Math.min(3, f.phase - 1));
  const completed = f.phase === 0 ? 0 : f.phase === 5 ? 4 : step + Number(f.landed);
  const planned = f.phase === 0 ? 0 : f.phase === 5 ? 4 : step + Number(f.local >= 0.2);
  const prefix =
    completed === 0 ? 0 : Math.min(14, SCHEDULE_STARTS[completed - 1]! + SCHEDULE_C[completed - 1]!);
  return { ...f, step, completed, planned, prefix, firstToken: completed >= 3 };
}
