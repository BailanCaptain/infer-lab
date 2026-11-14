import { span } from "./scene-easing";
import { expertAssignments } from "./scene-playback";
import type { TeachingFrame } from "./scene-teaching";

/** Kinds 5–7 extend the PP/SP/CP mechanism renderer: 5 = TP, 6 = DP, 7 = EP. */
export const TP_KIND = 5,
  DP_KIND = 6,
  EP_KIND = 7;
export const isStrategyKind = (kind: number) => kind >= TP_KIND && kind <= EP_KIND;
export const STRATEGY_SECONDS: Record<number, number> = { 5: 48, 6: 48, 7: 60 };
export const STRATEGY_BOUNDARIES: Record<number, number[]> = {
  5: [0, 0.26, 0.54, 0.8, 1],
  6: [0, 0.18, 0.38, 0.58, 0.8, 1],
  7: [0, 0.16, 0.3, 0.46, 0.58, 0.8, 1],
};

// The chapter's illustrative tokenization; every token retains all hidden channels.
export const SAMPLE_TOKENS = ["今天", "天气", "很", "好"];
// One 4-token × 8-channel hidden matrix shared by PP and TP; last row starts with the [1,0] example.
export const SAMPLE_HIDDEN = [
  [2, 1, 0, 3, -1, 2, 1, 0],
  [0, 3, 1, -2, 2, 1, 0, 2],
  [-1, 2, 3, 1, 0, -1, 2, 1],
  [1, 0, 2, -1, 3, 1, -2, 4],
];

export function strategyFrame(kind: number, progress: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const b = STRATEGY_BOUNDARIES[kind]!;
  const phase = p === 1 ? b.length - 2 : Math.max(0, b.findIndex((end) => end > p) - 1);
  return { phase, local: (p - b[phase]!) / (b[phase + 1]! - b[phase]!) };
}

/* ---------------- TP: row-parallel down projection, then All-Reduce ---------------- */
export const TP_CARDS = 4;
export const TP_X = SAMPLE_HIDDEN;
// W_down as [input channel, output channel]; card g keeps input rows 2g and 2g+1.
export const TP_W = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [1, 1, 0, 0],
  [0, 0, 1, 1],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 0, -1],
  [0, 1, -1, 0],
];
export const tpInputSlice = (g: number) => TP_X.map((row) => row.slice(2 * g, 2 * g + 2));
export const tpWeightSlice = (g: number) => TP_W.slice(2 * g, 2 * g + 2);
export const TP_PARTIALS = Array.from({ length: TP_CARDS }, (_, g) =>
  tpInputSlice(g).map((x) =>
    [0, 1, 2, 3].map((o) => x[0]! * tpWeightSlice(g)[0]![o]! + x[1]! * tpWeightSlice(g)[1]![o]!),
  ),
);
export const TP_SUM = TP_PARTIALS[0]!.map((row, r) =>
  row.map((_, o) => TP_PARTIALS.reduce((s, part) => s + part[r]![o]!, 0)),
);

export function tpMotion(progress: number) {
  const { phase, local } = strategyFrame(TP_KIND, progress);
  return {
    phase,
    local,
    reveal: phase > 0 ? 1 : span(local, 0, 0.16),
    split: phase > 0 ? 1 : span(local, 0.22, 0.48),
    land: phase > 0 ? 1 : span(local, 0.54, 0.92),
    expand: phase < 1 ? 0 : phase > 1 ? 1 : span(local, 0, 0.16),
    partial: phase < 1 ? 0 : phase > 1 ? 1 : span(local, 0.2, 0.92),
    gather: phase < 2 ? 0 : phase > 2 ? 1 : span(local, 0, 0.3),
    sum: phase < 2 ? 0 : phase > 2 ? 1 : span(local, 0.36, 0.94),
    broadcast: phase < 3 ? 0 : span(local, 0.08, 0.7),
  };
}

/* ---------------- DP: whole requests go to one group; replies return per request ---------------- */
export const DP_REQUESTS = [
  { user: "甲", name: "A", tokens: ["帮我", "写", "一封", "邮件"], reply: "好的" },
  { user: "乙", name: "B", tokens: ["解释", "一下", "缓存", "原理"], reply: "缓存" },
] as const;
// Illustrative embedding rows; the result rows only mark that the group computed every row.
export const DP_INPUT = [
  [
    [1, 0, 2, 1, 0, 1, 2, 0],
    [0, 2, 1, 0, 1, 2, 0, 1],
    [2, 1, 0, 1, 2, 0, 1, 1],
    [1, 1, 2, 0, 0, 1, 1, 2],
  ],
  [
    [0, 1, 1, 2, 1, 0, 0, 2],
    [2, 0, 1, 1, 0, 2, 1, 0],
    [1, 2, 0, 0, 2, 1, 1, 0],
    [0, 1, 2, 1, 1, 0, 2, 1],
  ],
];
export const DP_OUTPUT = DP_INPUT.map((matrix, g) =>
  matrix.map((row) => row.map((x, c) => x + ((c + g) % 3) + 1)),
);
/** Frontend score = waiting × 4 + running, evaluated when each request arrives. */
export function dpScores(phase: number, local: number) {
  const waiting = [
    phase > 1 || (phase === 1 && local >= 0.55) ? 1 : 0,
    phase > 2 || (phase === 2 && local >= 0.55) ? 1 : 0,
  ];
  return waiting.map((w) => w * 4);
}
export function dpMotion(progress: number) {
  const { phase, local } = strategyFrame(DP_KIND, progress);
  const arrive = (own: number) => (phase < own ? 0 : phase > own ? 1 : span(local, 0, 0.16));
  const score = (own: number) => (phase < own ? 0 : phase > own ? 1 : span(local, 0.18, 0.4));
  const route = (own: number) => (phase < own ? 0 : phase > own ? 1 : span(local, 0.56, 0.94));
  // Phase 0 mirrors PP's deployment prelude: whole weights, copy per group, cut, land on the cards.
  const prelude = (a: number, b: number) => (phase > 0 ? 1 : span(local, a, b));
  return {
    phase,
    local,
    reveal: prelude(0, 0.15),
    copy: prelude(0.17, 0.35),
    cut: prelude(0.37, 0.55),
    land: prelude(0.57, 0.95),
    arrive: [arrive(1), arrive(2)],
    score: [score(1), score(2)],
    route: [route(1), route(2)],
    expand: phase < 3 ? 0 : phase > 3 ? 1 : span(local, 0, 0.18),
    compute: phase < 3 ? 0 : phase > 3 ? 1 : span(local, 0.22, 0.92),
    reply: phase < 4 ? 0 : span(local, 0.04, 0.26),
    deliver: phase < 4 ? 0 : span(local, 0.34, 0.86),
    scores: dpScores(phase, local),
  };
}

/* ---------------- EP: one source row → top-8 experts → combine → All-Gather ---------------- */
export const EP_HIDDEN = SAMPLE_HIDDEN.map((row) => row.slice(0, 4));
export const EP_SOURCE = 0;
export const EP_EXPERTS = expertAssignments(EP_SOURCE);
// Sigmoid scores of the eight winners (illustrative); GLM normalizes them, then multiplies by 2.5.
export const EP_SCORES = [0.9, 0.8, 0.7, 0.7, 0.6, 0.5, 0.4, 0.4];
export const EP_ROUTED_SCALE = 2.5;
const scoreSum = EP_SCORES.reduce((a, b) => a + b, 0);
export const EP_WEIGHTS = EP_SCORES.map((s) => Math.round((s / scoreSum) * EP_ROUTED_SCALE * 1000) / 1000);
export const EP_EXPERT_OUTPUTS = [
  [2, 0, 1, 1],
  [0, 2, 1, -1],
  [1, 1, 0, 2],
  [2, -1, 1, 0],
  [0, 1, 2, 1],
  [1, 0, -1, 2],
  [2, 2, 0, 0],
  [-1, 1, 1, 1],
];
const round = (x: number) => Math.round(x * 1000) / 1000;
export const EP_ROUTED = [0, 1, 2, 3].map((c) =>
  round(EP_EXPERT_OUTPUTS.reduce((s, y, i) => s + EP_WEIGHTS[i]! * y[c]!, 0)),
);
// Rows 1–3 are routed by their own source cards; their values are illustrative.
export const EP_ROUTED_ROWS = [EP_ROUTED, [0.6, 2.1, 1.2, -0.4], [1.5, 0.3, 2.2, 0.9], [-0.5, 1.4, 0.8, 2.6]];
export const EP_SHARED = [
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 1, 0, 0],
  [0, 0, 1, 1],
];
export const EP_OUTPUT = EP_ROUTED_ROWS.map((row, r) => row.map((x, c) => round(x + EP_SHARED[r]![c]!)));
/** Each dispatch copy departs after the previous one so one long route can be followed. */
export const epCopy = (local: number, i: number) => span(local, i / 8, (i + 1) / 8);
/** The visible running sum contains only expert rows already weighted. */
export function epAccumulation(amount: number) {
  const completed = Math.min(8, Math.floor(Math.max(0, amount) * 8));
  return {
    active: Math.min(7, completed),
    completed,
    total: [0, 1, 2, 3].map((c) =>
      round(EP_EXPERT_OUTPUTS.slice(0, completed).reduce((sum, row, i) => sum + EP_WEIGHTS[i]! * row[c]!, 0)),
    ),
  };
}
export function epMotion(progress: number) {
  const { phase, local } = strategyFrame(EP_KIND, progress);
  return {
    phase,
    local,
    // Like DP's prelude: unfold, then split, with no idle gap before the router starts.
    show: phase > 0 ? 1 : span(local, 0, 0.3),
    split: phase > 0 ? 1 : span(local, 0.32, 0.95),
    score: phase < 1 ? 0 : phase > 1 ? 1 : span(local, 0.08, 0.55),
    pick: phase < 1 ? 0 : phase > 1 ? 1 : span(local, 0.6, 0.9),
    dispatch: EP_EXPERTS.map((_, i) => (phase < 2 ? 0 : phase > 2 ? 1 : epCopy(local, i))),
    compute: phase < 3 ? 0 : phase > 3 ? 1 : span(local, 0.1, 0.85),
    combine: EP_EXPERTS.map((_, i) => (phase < 4 ? 0 : phase > 4 ? 1 : epCopy(local / 0.42, i))),
    weigh: phase < 4 ? 0 : phase > 4 ? 1 : Math.max(0, Math.min(1, (local - 0.44) / 0.53)),
    gather: phase < 5 ? 0 : span(local, 0, 0.32),
    shared: phase < 5 ? 0 : span(local, 0.34, 0.5),
    add: phase < 5 ? 0 : span(local, 0.53, 0.83),
    writeback: phase < 5 ? 0 : span(local, 0.85, 1),
  };
}

const n = (x: number) => String(+x.toFixed(2));
const vec = (row: number[]) => `[${row.map(n).join(", ")}]`;

export const STRATEGY_CHAPTERS: Record<number, string[]> = {
  5: ["切分与落卡", "各卡算部分和", "All-Reduce 相加", "每卡拿到完整结果"],
  6: ["两组怎样放权重", "A 进 DP0", "B 进 DP1", "各算各的请求", "回复送回用户"],
  7: ["按行分给源卡", "router 选 8 位", "dispatch 派发", "专家计算", "combine 加权", "拼回整批"],
};

export const STRATEGY_GUIDES: Record<
  number,
  { purpose: string; object: string; fixed: string; moving: string; outcome: string }
> = {
  5: {
    purpose: "一个矩阵太大：沿输入通道切给几张卡，各算一份部分和，再用一次 All-Reduce 加齐。",
    object:
      "“今天 / 天气 / 很 / 好”各占 X 的一行，横向 8 格是输入通道；W 的 8 行对应同样的 8 个输入通道，4 列是输出通道。",
    fixed: "每卡两行 W（同色）",
    moving: "4×4 部分和，加齐后的 Y",
    outcome: "每卡只存 1/4 的 W；每次投影后用一次 All-Reduce 让各卡都拿到完整 Y。",
  },
  6: {
    purpose: "请求多了：把整条请求交给某一个执行组，两组同时服务不同用户。",
    object: "一条请求的 4 个 token 各占一行，横向是隐藏通道。DP 搬动的是整条请求，不切它的行或列。",
    fixed: "每组一份稠密权重，各持一半专家",
    moving: "整条请求，以及回给用户的 token",
    outcome: "两组各自排队、计算、回复；一条请求从头到尾留在选中的组。",
  },
  7: {
    purpose: "专家太多，一张卡放不下：专家整份分到 16 张卡，token 去找选中的专家，算完带回结果。",
    object:
      "DP0 的 4 个 token 各占一行，示意 4 个通道。每卡顶部的小格是它常驻的专家；E 编号决定专家在哪张卡（⌊e/18⌋）。",
    fixed: "每卡 18 位完整专家",
    moving: "token 的一行 hidden 与 8 份专家输出",
    outcome: "专家权重从不搬动；每行 hidden 一去一回，按组合权重合成本层输出。",
  },
};

export const STRATEGY_READING_KEYS: Record<
  number,
  { sample: string; meaning: string; labels: string; example: string }
> = {
  5: {
    sample: "X：4 行 × 8 输入通道 · W：8 × 4",
    meaning: "X 的一行是一个 token；W 的一行对应一个输入通道。卡g 持有 X 的第 2g、2g+1 列与 W 的同号两行。",
    labels: "卡0–3 是 TP 组内编号；P₀–P₃ 是各卡的部分和，Y 是加齐后的输出。",
    example: "示意 TP4、整数权重；GLM 机内 TP8，down 投影每卡持有 1536 个输入通道。格内数字均可手算。",
  },
  6: {
    sample: "A：4 行 × 8 通道",
    meaning: "一行是一个 token 的隐藏向量；A、B 是两条不同请求，各自整条进入一组。",
    labels: "DP0 / DP1 是执行组编号，各对应一台机器；分数 = 等待数 × 4 + 运行数。",
    example: "格内数值是示意。计算后的矩阵只表示该组算过全部行；“好的”“缓存”是示意的回复 token。",
  },
  7: {
    sample: "今天 · [2, 1, 0, 3]",
    meaning: "“今天”这一行的 4 个通道（实际 4096）。专家输出也是 4 个通道。",
    labels: "E 是专家编号，卡号 = ⌊E ÷ 18⌋；卡0–7 在服务器0，卡8–15 在服务器1。",
    example: `分数与专家输出为示意；组合权重 = 分数 ÷ ${n(scoreSum)} × 2.5，八个权重之和为 2.5。`,
  },
};

/** Narration follows landing → computing → write-back for each strategy. */
export function strategyCue(kind: number, progress: number) {
  const { phase } = strategyFrame(kind, progress);
  if (kind === TP_KIND) {
    const m = tpMotion(progress);
    const p00 = tpInputSlice(0)[3]!;
    const w0 = tpWeightSlice(0);
    return {
      chapter: phase,
      title: [
        m.split === 0
          ? "先看完整对象：输入 X 与 down 权重 W"
          : m.land === 0
            ? "沿输入通道切成 4 份：X 切列，W 切同号的行"
            : "权重片落到各卡，常驻显存",
        m.expand < 1 ? "四张卡同时开算：展开卡0 看一份" : "卡0：自己的两列 × 自己的两行 = 4×4 部分和",
        m.gather < 1 ? "All-Reduce：四份部分和汇到一起" : "同一位置的四份逐格相加",
        m.broadcast < 1 ? "加齐的 Y 回到每张卡" : "每卡都有完整 Y，权重始终没动",
      ][phase]!,
      detail: [
        m.split === 0
          ? "X 有 4 个 token 行、8 个输入通道；W 把 8 个输入通道映射到 4 个输出通道。Y = XW 的每一格都要把 8 个通道的乘积加齐。这是逻辑全貌：实际每卡的输入列由上一步列切在本卡算出，不是先集中再切开。"
          : m.land === 0
            ? "卡g 拿 X 的第 2g、2g+1 列和 W 的第 2g、2g+1 行。token 行不切，4 行都留着。这里示意 4 张卡；GLM 机内是 8 张，每卡 1536 个通道。"
            : "同色的 W 片留在所属卡，处理之后每个请求时都直接使用；输入列随请求在本卡产生。",
        m.expand < 1
          ? "四张卡互不等待，同时计算；下方放大卡0 的这一份，其余三卡在上方同步写出自己的部分和。"
          : `“好”行：${p00[0]}×W₀ + ${p00[1]}×W₁ = ${vec(TP_PARTIALS[0]![3]!)}，其中 W₀ = ${vec(w0[0]!)}、W₁ = ${vec(w0[1]!)}。每格只加了本卡的 2 个通道，还缺另外 6 个。`,
        `左上格：${TP_PARTIALS.map((p) => p[0]![0]).join(" + ")} = ${TP_SUM[0]![0]}。四份形状相同，按同行同列相加；不同 token 的行不会混在一起。`,
        "All-Reduce 的结果是：每张卡都拿到同一份完整 Y，下一步（残差、下一层）各卡都从完整 hidden 出发。图中把求和与分发拆成两段；实际通信算法可交错进行。",
      ][phase]!,
    };
  }
  if (kind === DP_KIND) {
    const m = dpMotion(progress);
    return {
      chapter: phase,
      title: [
        m.copy === 0
          ? "先看全貌：一份稠密权重，一套路由专家"
          : m.cut === 0
            ? "稠密权重复制一份：两组各一份"
            : m.land === 0
              ? "机内 TP8 切 8 片；专家按编号分成 16 份"
              : "权重落卡：两台机器 = 两个 DP 组",
        m.score[0]! < 1 ? "甲的请求 A 到达：前端先比较两组分数" : "A 整条送进 DP0，前端记下一笔",
        m.score[1]! < 1 ? "乙的请求 B 到达：DP0 刚记了一笔" : "B 整条送进 DP1",
        "两组各算自己的请求，行数不变",
        m.deliver < 1 ? "各组产生下一个 token" : "回复分别回到甲、乙",
      ][phase]!,
      detail: [
        m.copy === 0
          ? "上排蓝格是稠密层权重（attention、共享专家等，所有 token 都要用）；下排是一个 MoE 层的 288 位路由专家，每格一位，E0–E287 只有一套。"
          : m.cut === 0
            ? "DP 给每个执行组一份稠密权重，所以蓝色整份复制成两份，各对一台机器。路由专家不复制。"
            : m.land === 0
              ? "每份稠密权重在机内按 TP8 切成 8 片，每卡一片；288 位专家按编号连续切成 16 份，每份 18 位，E0–E143 归服务器0，E144–E287 归服务器1。"
              : "每卡下层是本组稠密权重的 1/8，上层是自己的 18 位专家。稠密权重两台各一份，专家两台各一半：每台机器不是完整模型副本。",
        m.score[0]! < 1
          ? "分数 = 等待请求数 × 4 + 运行请求数。此刻两组都是 0 分；同分，本例取 DP0。"
          : "A 的 4 行一起进 DP0 的等待队列。前端立即把 DP0 的等待数加 1：分数变成 1×4 + 0 = 4，让紧接着的请求看到这笔分配。",
        m.score[1]! < 1
          ? "B 在下一次负载推送前到达：DP0 = 1×4 + 0 = 4，DP1 = 0。选分数小的组。"
          : "B 进 DP1。选组看的是到达时的负载，不是轮流，也不是按用户绑定；A 仍然整条留在 DP0。",
        "DP0 用本机 8 卡计算 A 的全部 4 行，DP1 计算 B 的 4 行；一条请求的行不会分给另一组。到了 MoE 层，两组的 token 仍会到对方机器上找专家（见 EP）。",
        m.deliver < 1
          ? "prefill 结束时，最后一行的输出决定下一个 token：A 得到“好的”，B 得到“缓存”（示意）。"
          : "回复经前端回到各自的用户。请求状态与 KV cache 留在原组，后续每一步生成仍由这一组完成。",
      ][phase]!,
    };
  }
  const m = epMotion(progress);
  const remote = EP_EXPERTS.filter((e) => e.rank !== EP_SOURCE).length;
  const crossing = EP_EXPERTS.filter((e) => e.rank >= 8).length;
  return {
    chapter: phase,
    title: [
      m.split === 0 ? "DP0 的 8 张卡，各有同一份 4 行 hidden" : "按行分工：卡0–3 各派发一行，卡4–7 只有补位",
      m.pick < 1 ? "router 为“今天”打分" : "选出 8 位专家：落在 6 张卡",
      "dispatch：这一行送到每位专家所在的卡",
      "各卡用自己的专家算这一行",
      m.weigh === 0 ? "combine：8 份输出回到卡0" : "乘组合权重，再相加",
      m.add < 1 && m.shared < 1 ? "All-Gather：四张卡的行拼回整批" : "加上共享专家，得到本层输出",
    ][phase]!,
    detail: [
      m.split === 0
        ? "示例请求 R1 有 4 个 token。本层 attention 之后，DP0 每张卡都持有同一份 4 行 hidden（实际每行 4096 个数，这里示意 4 个）。"
        : "这是本地取切片，没有通信：每行只由一张卡负责找专家，避免 8 张卡重复派发同一行。下面跟卡0 的“今天”；卡1–3 同时为自己的行做同样的事。",
      m.pick < 1
        ? "router 用 sigmoid 给 288 位专家各打一个 0–1 的分，选最高的 8 位（图中分数为示意）。"
        : `组合权重 = 分数 ÷ 8 个分数之和 ${n(scoreSum)} × 2.5，所以八个权重加起来是 2.5，不是 1。专家 e 在卡 ⌊e/18⌋；E0、E1 就在卡0 本卡。`,
      `E0、E1 在本卡，不用发；其余 ${remote} 份经卡间链路发出，其中 ${crossing} 份跨到服务器1。专家权重不动，动的是这一行 hidden 的副本。`,
      "每位专家是一套完整的 gate / up / down 前馈网络，输出仍是 4 个通道（示意数）。同一张卡上的两位专家各用各的权重。",
      m.weigh === 0
        ? "每份结果沿原路回到源卡卡0，按专家编号排好，等全部到齐。"
        : `逐通道：Σ 组合权重 × 专家输出 = 路由部分 ${vec(EP_ROUTED)}。`,
      m.add < 1 && m.shared < 1
        ? "combine 只合齐同一个 token 的专家贡献；不同 token 的行由 TP8 的 All-Gather 拼回 4 行，补位行丢掉。"
        : `共享专家每个 token 都要经过，不参与 EP，由本机 TP8 合算。路由部分 + 共享部分：“今天” = ${vec(EP_ROUTED)} + ${vec(EP_SHARED[0]!)} = ${vec(EP_OUTPUT[0]!)}。`,
    ][phase]!,
  };
}

export function strategyTeaching(kind: number, progress: number): TeachingFrame {
  const { phase } = strategyFrame(kind, progress);
  const cue = strategyCue(kind, progress);
  if (kind === TP_KIND)
    return {
      title: cue.title,
      equation: [
        "X [4,8] → 每卡 [4,2]\nW [8,4] → 每卡 [2,4]",
        "Pg = Xg [4,2] × Wg [2,4] = [4,4]",
        `Y = P₀ + P₁ + P₂ + P₃\n左上格 = ${TP_PARTIALS.map((p) => p[0]![0]).join(" + ")} = ${TP_SUM[0]![0]}`,
        "每卡 Y [4,4] · 权重片不动",
      ][phase]!,
      detail:
        "这是 TP 中按输入通道切的 row parallel：前一步 column parallel 已让每卡只算出自己那几列，正好接上这里的同号权重行。每卡结果形状完整、数值只是部分和；一次 All-Reduce 后各卡得到同一份 Y。",
      tensors: [],
    };
  if (kind === DP_KIND)
    return {
      title: cue.title,
      equation: [
        "稠密权重：两组各一份 · 每组 TP8\n路由专家：E0–E143 | E144–E287",
        "分数 = 等待 × 4 + 运行\nDP0 0 · DP1 0 → DP0",
        "DP0 1×4+0 = 4 · DP1 0 → DP1",
        "A [4,8] 留在 DP0 · B [4,8] 留在 DP1",
        "A → DP0 → “好的” → 甲\nB → DP1 → “缓存” → 乙",
      ][phase]!,
      detail:
        "DP 分的是请求，不是矩阵：每组有自己的 scheduler、等待队列和 KV cache。前端按分数选组，派定后不迁移。",
      tensors: [],
    };
  return {
    title: cue.title,
    equation: [
      "每卡 [4,4] 相同 → 卡0–3 各取一行 [1,4]",
      `权重 = 分数 ÷ ${n(scoreSum)} × 2.5\nΣ 权重 = ${n(EP_WEIGHTS.reduce((a, b) => a + b, 0))}`,
      "1 行 → 8 份：2 份本卡 + 6 份跨卡",
      "每位专家：[1,4] → [1,4]",
      `路由部分 = Σ wᵢ × yᵢ = ${vec(EP_ROUTED)}`,
      "All-Gather → [4,4]\n输出 = 路由部分 + 共享专家",
    ][phase]!,
    detail:
      "GLM 每个 MoE 层有 288 位路由专家，每卡 18 位，每个 token 选 8 位；另有 1 位共享专家不参与 EP。router 用 sigmoid 打分，入选分数归一化后乘 2.5 作为组合权重。",
    tensors: [],
  };
}
