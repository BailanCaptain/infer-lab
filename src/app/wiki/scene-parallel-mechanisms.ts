import { span } from "./scene-easing";
import {
  isStrategyKind,
  SAMPLE_HIDDEN,
  SAMPLE_TOKENS,
  STRATEGY_BOUNDARIES,
  STRATEGY_CHAPTERS,
  STRATEGY_GUIDES,
  STRATEGY_READING_KEYS,
  STRATEGY_SECONDS,
  strategyCue,
  strategyFrame,
  strategyTeaching,
} from "./scene-parallel-strategy";
import { RING_K, RING_V, ringPartial } from "./scene-ring-data";
import type { TeachingFrame } from "./scene-teaching";

export { smooth, span } from "./scene-easing";
export const MECHANISM_SECONDS = 36;
export const mechanismSeconds = (kind: number) =>
  isStrategyKind(kind)
    ? STRATEGY_SECONDS[kind]!
    : kind === 0
      ? 40
      : kind === 1 || kind === 2 || kind === 4
        ? 48
        : MECHANISM_SECONDS;
export const PP_SETUP = 0.24;
const MECHANISM_BOUNDARIES = [
  [0, 0.25, 0.5, 0.75, 1],
  [0, 0.2, 0.48, 0.65, 0.83, 1],
  [0, 0.2, 0.4, 0.88, 1],
  [0, 0.2, 0.52, 0.72, 1],
  [0, 0.22, 0.46, 0.62, 0.92, 1],
];
// Ownership is shared by the split animation, card labels and the arithmetic.
export const PARTITIONS = [
  {
    count: 8,
    columns: 4,
    groups: [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ],
  },
  {
    count: 4,
    columns: 4,
    groups: [
      [0, 1],
      [2, 3],
    ],
  },
  {
    count: 8,
    columns: 4,
    groups: [
      [0, 1, 6, 7],
      [2, 3, 4, 5],
    ],
  },
  {
    count: 8,
    columns: 4,
    groups: [
      [0, 2, 4, 6],
      [1, 3, 5, 7],
    ],
  },
];
// The chapter's illustrative tokenization; every token retains all hidden channels.
export const SP_TOKENS = SAMPLE_TOKENS;
// Last row, first two channels retain the chapter's [1,0] example.
const PP_INPUT = SAMPLE_HIDDEN;
const PP_ACTIVATIONS = Array.from({ length: 9 }, (_, layer) =>
  PP_INPUT.map((row) => row.map((value) => value + layer)),
);
export const ppActivations = (afterLayers: number) => PP_ACTIVATIONS[afterLayers]!;
// A staggered reveal illustrates changed cells, not a GPU's physical instruction order.
export const gridWriteProgress = (p: number, row: number, column: number, columns = 8) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const start = Math.min(0.78, (column + row * 0.3) / (columns + 2.7));
  return span(p, start, start + 0.21);
};
export const ppWriteProgress = (p: number, row: number, column: number) => gridWriteProgress(p, row, column);
// Illustrative segmentation, not output from a particular model's tokenizer.
export const CP_TOKENS = ["请", "介绍", "一下", "并行", "计算", "的", "工作", "原理"];
export const SP_PARTIALS = [
  [
    [1, 3, 3, 1],
    [3, 1, 1, 3],
    [2, 2, 2, 2],
    [8, 15, 15, 8],
  ],
  [
    [0, 4, 4, 0],
    [4, 0, 0, 4],
    [3, 3, 3, 3],
    [9, 16, 16, 9],
  ],
];
export const SP_SUM = SP_PARTIALS[0]!.map((row, r) => row.map((n, c) => n + SP_PARTIALS[1]![r]![c]!));
export const SP_RMS = SP_SUM.map((row) => Math.sqrt(row.reduce((n, x) => n + x * x, 0) / row.length));
export const SP_NORMALIZED = SP_SUM.map((row, r) => row.map((n) => n / SP_RMS[r]!));
export const SP_WEIGHT_COLUMNS = [
  [1, 2, -1, 1],
  [3, 1, 1, -1],
];
export const SP_PROJECTED = SP_NORMALIZED.map((row) =>
  SP_WEIGHT_COLUMNS.map((w) => row.reduce((sum, x, c) => sum + x * w[c]!, 0)),
);
export const PCP_QUERIES = PARTITIONS[2]!.groups;
export const CP_FOCUS = [7, 5];
// Orthogonal Q/K make the causal softmax uniform, so every output can be checked by hand.
export const PCP_EXAMPLE = {
  queries: Array.from({ length: 8 }, (_, q) => [1, q + 1, 0, 0]),
  keys: Array.from({ length: 8 }, (_, p) => [0, 0, p, 1]),
  values: Array.from({ length: 8 }, (_, p) => [2 * p + 1, 2 * p + 2, 2 * p + 3, 2 * p + 4]),
  outputs: Array.from({ length: 8 }, (_, q) => [q + 1, q + 2, q + 3, q + 4]),
};
export const DCP_EXAMPLE = { local: [10, 30], normalizers: [2, 6] };
export const DCP_WEIGHTS = DCP_EXAMPLE.normalizers.map((z) => z / 8);
export const DCP_CONTRIBUTIONS = DCP_EXAMPLE.local.map((o, i) => o * DCP_WEIGHTS[i]!);
export const DCP_OUTPUT = DCP_CONTRIBUTIONS.reduce((a, b) => a + b, 0);
// The existing 10/30 example expanded into four readable history contributions per card.
export const DCP_VALUES = [4, 24, 8, 28, 12, 32, 16, 36];
// QK / sqrt(4) = log(weight); all four V channels survive normalization and merging.
export const DCP_QUERY = [2, 0, 0, 0];
export const dcpKeyVector = (position: number) => [Math.log(position % 2 ? 1.5 : 0.5), 0, 1, -1];
export const dcpChannels = (first: number) => [first, 40 - first, first / 2, 20 - first / 2];
export const dcpValueVector = (position: number) => dcpChannels(DCP_VALUES[position]!);

/** A landing interval precedes every dependent calculation; scrubbing is stateless. */
export function mechanismFrame(kind: number, progress: number) {
  if (isStrategyKind(kind)) {
    const { phase, local } = strategyFrame(kind, progress);
    return {
      phase,
      local,
      setup: false,
      reveal: 1,
      split: 1,
      stage: 0,
      receive: 0,
      first: 0,
      second: 0,
      input: [] as number[],
      middle: [] as number[],
      output: [] as number[],
    };
  }
  const raw = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const setup = kind === 0 && raw < PP_SETUP;
  const p = kind === 0 ? Math.max(0, (raw - PP_SETUP) / (1 - PP_SETUP)) : raw;
  const boundaries = MECHANISM_BOUNDARIES[kind]!;
  const phase = p === 1 ? boundaries.length - 2 : Math.max(0, boundaries.findIndex((end) => end > p) - 1);
  const local = (p - boundaries[phase]!) / (boundaries[phase + 1]! - boundaries[phase]!);
  if (kind === 0) {
    const stage = phase;
    return {
      phase,
      local,
      setup,
      reveal: span(raw / PP_SETUP, 0, 0.18),
      split: span(raw / PP_SETUP, 0.26, 0.72),
      stage,
      receive: span(local, 0, 0.25),
      first: span(local, 0.3, 0.52),
      second: span(local, 0.6, 0.82),
      input: [1 + stage * 2, stage * 2],
      middle: [2 + stage * 2, 1 + stage * 2],
      output: [3 + stage * 2, 2 + stage * 2],
    };
  }
  return {
    phase,
    local,
    setup: false,
    reveal: phase === 0 ? span(local, 0, 0.22) : 1,
    split: phase === 0 ? span(local, kind === 1 ? 0.65 : 0.25, 0.9) : 1,
    stage: 0,
    receive: 0,
    first: 0,
    second: 0,
    input: [],
    middle: [],
    output: [],
  };
}

/** Both cards work on their own rows; the row is replaced only after its result lands. */
export function spNormalization(p: number) {
  const f = mechanismFrame(1, p),
    enabled = f.phase === 2;
  const work = Math.max(0, (f.local - 0.2) / 0.8) * 2;
  const index = Math.min(1, Math.floor(work)),
    local = work - index;
  return {
    enabled,
    rows: [index, index + 2],
    local,
    landed: f.phase > 2 ? 1 : enabled ? span(local, 0.04, 0.24) : 0,
    divided: f.phase > 2 ? 1 : enabled ? span(local, 0.36, 0.58) : 0,
    written: SP_TOKENS.map((_, r) => (f.phase > 2 ? 1 : enabled ? span(work - (r % 2), 0.72, 0.9) : 0)),
  };
}

export function spProjection(p: number) {
  const f = mechanismFrame(1, p),
    enabled = f.phase === 4;
  const work = Math.min(1, f.local / 0.78);
  const row = Math.min(3, Math.floor(work * 4)),
    local = work * 4 - row;
  return {
    enabled,
    row,
    local,
    landed: enabled ? span(local, 0.1, 0.35) : 0,
    multiplied: enabled ? span(local, 0.4, 0.58) : 0,
    written: SP_TOKENS.map((_, r) => (enabled ? span(work * 4 - r, 0.7, 0.96) : 0)),
    results: SP_PROJECTED,
  };
}

export function ringMotion(p: number) {
  const f = mechanismFrame(4, p);
  return {
    ...f,
    assign: f.phase === 0 ? span(f.local, 0.3, 0.78) : 1,
    project: f.phase === 0 ? span(f.local, 0.8, 0.97) : 1,
    transfer: f.phase < 2 ? 0 : f.phase === 2 ? span(f.local, 0.15, 0.8) : 1,
    active: f.phase === 1 || f.phase === 3 ? 3 : -1,
    localWritten: [0, 1, 2, 3].map((r) =>
      f.phase < 1 ? 0 : f.phase > 1 ? 1 : span(f.local, r === 3 ? 0.88 : 0.94, 0.99),
    ),
    remoteWritten: [0, 1, 2, 3].map((r) =>
      f.phase < 3 ? 0 : f.phase > 3 ? 1 : span(f.local, r === 3 ? 0.88 : 0.94, 0.99),
    ),
    handoff: f.phase === 4 ? span(f.local, 0.08, 0.85) : 0,
  };
}

export function pcpMotion(progress: number) {
  const f = mechanismFrame(2, progress);
  const { phase, local } = f;
  return {
    ...f,
    // Like DP's prelude: rows fade in one after another, then the cut runs until the hand-off to the cards.
    rows: Array.from({ length: 8 }, (_, q) => (phase > 0 ? 1 : span(f.reveal, q * 0.1, q * 0.1 + 0.3))),
    split: phase > 0 ? 1 : span(local, 0.25, 1),
    assign: phase === 0 ? 0 : phase === 1 ? span(local, 0.03, 0.48) : 1,
    localKV: phase < 1 ? 0 : phase === 1 ? span(local, 0.49, 0.65) : 1,
    gather: phase < 1 ? 0 : phase === 1 ? span(local, 0.68, 0.95) : 1,
    active: phase === 2 ? 3 : -1,
    written: Array.from({ length: 8 }, (_, q) => {
      const slot = PCP_QUERIES.find((positions) => positions.includes(q))!.indexOf(q);
      return phase < 2 ? 0 : phase > 2 ? 1 : span(local, slot === 3 ? 0.88 : 0.94, 0.99);
    }),
    handoff: phase === 3 ? span(local, 0.12, 0.75) : 0,
  };
}

/** One query stays in focus across blocks; the canvas and adjacent arithmetic share this read cursor. */
export function cpReadFrame(kind: number, progress: number, card: number) {
  const { phase, local } = mechanismFrame(kind, progress);
  const query = kind === 3 ? 7 : CP_FOCUS[card]!;
  const remote = kind === 4 && phase >= 3;
  const blockCard = remote ? 1 - card : card;
  const positions =
    kind === 2
      ? Array.from({ length: 8 }, (_, i) => i)
      : kind === 3
        ? PARTITIONS[3]!.groups[card]!
        : PCP_QUERIES[blockCard]!;
  const valid = positions.filter((p) => p <= query);
  const calculatePhase = kind === 2 ? 2 : remote ? 3 : 1;
  const running = phase === calculatePhase;
  const work = running
    ? Math.max(0, Math.min(1, (local - 0.08) / 0.78)) * valid.length
    : phase > calculatePhase
      ? valid.length
      : 0;
  const index = Math.min(valid.length - 1, Math.floor(work));
  const item = work - index;
  const consumed = Math.min(valid.length, index + (item >= 0.75 ? 1 : 0));
  const position = valid[index]!;
  const weightAt = (p: number) => (kind === 2 ? 1 : kind === 3 ? (p % 2 ? 1.5 : 0.5) : Math.exp(RING_K[p]!));
  const valueAt = (p: number) =>
    kind === 2 ? PCP_EXAMPLE.values[p]![0]! : kind === 3 ? DCP_VALUES[p]! : RING_V[p]!;
  const sum = (indices: number[]) =>
    kind === 4
      ? { u: ringPartial(query, indices).numerator, z: ringPartial(query, indices).z }
      : indices.reduce((s, p) => ({ u: s.u + weightAt(p) * valueAt(p), z: s.z + weightAt(p) }), {
          u: 0,
          z: 0,
        });
  const prior = remote ? sum(PCP_QUERIES[card]!) : { u: 0, z: 0 };
  const read = valid.slice(0, consumed);
  const added = sum(read);
  const total = { u: prior.u + added.u, z: prior.z + added.z };
  const weight = weightAt(position),
    value = valueAt(position);
  // The row being read is shown as its own term, so the running sum never looks like a stale row.
  const earlier = sum(valid.slice(0, index));
  const before = { u: prior.u + earlier.u, z: prior.z + earlier.z };
  const current = { u: total.u - before.u, z: total.z - before.z };
  return {
    phase,
    query,
    positions,
    masked: positions.filter((p) => p > query),
    position,
    index,
    item,
    consumed,
    read,
    running,
    complete: consumed === valid.length,
    prior,
    added,
    total,
    before,
    current,
    pending: running && consumed <= index,
    output: total.z ? total.u / total.z : null,
    weight,
    value,
    product: weight * value,
    scored: running && item >= 0.12,
    weighted: running && item >= 0.4,
    block: kind === 2 ? "收齐的 K/V" : kind === 3 ? `卡${card}的历史` : `块 ${blockCard ? "B" : "A"}`,
  };
}

/** Canvas and explanation must not announce a merged answer before it is written. */
export function dcpMergeFrame(progress: number) {
  const { phase, local } = mechanismFrame(3, progress);
  const enabled = phase === 3;
  return {
    enabled,
    landed: enabled ? span(local, 0.12, 0.34) : 0,
    weighted: enabled && local > 0.55,
    complete: enabled && local > 0.8,
  };
}

/** Chapter checkpoints share the renderer's timing, including PP's deployment prelude. */
export function mechanismChapters(kind: number) {
  if (isStrategyKind(kind))
    return STRATEGY_CHAPTERS[kind]!.map((label, i) => ({
      label,
      start: STRATEGY_BOUNDARIES[kind]![i]! * mechanismSeconds(kind),
    }));
  const names = [
    ["认识输入与模型", "卡0 算前两层", "卡1 接着算", "卡2 接着算", "卡3 算末两层"],
    ["认清 token 行", "合并后分行", "各算自己的行", "收齐全部行", "接入下一次投影"],
    ["从输入看位置分工", "落卡并生成 Q/K/V", "各算自己的查询", "结果留在原卡"],
    ["分存历史", "各读本地历史", "交换局部结果", "按份额合并"],
    ["输入落卡与投影", "先算本地块", "交换 K/V 块", "接着累积远端块", "写回各自输出"],
  ][kind]!;
  const starts =
    kind === 0
      ? [0, ...MECHANISM_BOUNDARIES[0]!.slice(0, 4).map((p) => PP_SETUP + p * (1 - PP_SETUP))]
      : MECHANISM_BOUNDARIES[kind]!.slice(0, -1);
  return names.map((label, i) => ({ label, start: starts[i]! * mechanismSeconds(kind) }));
}

export const MECHANISM_GUIDES = [
  {
    purpose: "模型太大，一张卡装不下：把前后不同的层放到不同卡，让同一份输入依次经过它们。",
    object:
      "“今天 / 天气 / 很 / 好”各占一行，每行 8 格是一个隐藏向量。4 行合成输入矩阵 X；经过每段时，整张矩阵的行列顺序都保留。",
    fixed: "每卡的两层权重",
    moving: "上一段算出的 4×8 隐藏状态",
    outcome: "一张卡只保存自己负责的层；这条请求仍按层的顺序计算。",
  },
  {
    purpose: "让归一化这段按 token 行分工，减少重复；收齐后，两卡用各自的权重列继续投影。",
    object: "“今天 / 天气 / 很 / 好”各占一行；一行四格是四个通道。开始时，两张 TP 卡刚算完同四行的不同贡献。",
    fixed: "TP 切好的权重片",
    moving: "token 行的贡献与结果",
    outcome: "中间每卡只归一化两行；收齐后各算一列。“今天”的两个输出分别是 1.8 和 3.2。",
  },
  {
    purpose: "长输入的第一次 attention 太慢：把不同位置的查询分给两张卡，同时分担计算。",
    object:
      "先看一句话的 8 行输入，再按位置分给两卡。各卡从自己的输入生成 Q/K/V；越靠后的位置，要读取的历史越多。",
    fixed: "每个查询的位置归属",
    moving: "本层计算需要的 K/V",
    outcome: "头尾搭配，让两卡各算 18 对查询–键；查询虽然分开算，能看到的历史范围不缩水。",
  },
  {
    purpose: "生成下一个 token 时，历史缓存太长：两卡分着保存，各读一半，再合成同一份 attention 输出。",
    object: "一对 K、V 属于同一个历史位置：K 用来匹配，V 提供内容。两卡处理的是同一个查询。",
    fixed: "各卡自己的历史 K/V",
    moving: "局部答案与合并所需的分量",
    outcome: "历史不用在每卡重复保存；合并后的答案，等价于读取全部历史得到的答案。",
  },
  {
    purpose: "查询留在所属卡，让 K/V 分块经过它；每读一块，就更新同一份 attention 累积结果。",
    object:
      "8 个位置按头尾配对归两张卡。Q 是查询，K 用于评分，V 提供内容；每行保留4个通道，下方算式展开第0输出通道。",
    fixed: "本卡 Q 与逐行累积结果",
    moving: "成对的 K/V 块 A、B",
    outcome:
      "位置7先读 A：内容20、份额2；再读 B：内容增至200、份额增至8。200÷8得到上下文25，继续本层后续计算。",
  },
  STRATEGY_GUIDES[5]!,
  STRATEGY_GUIDES[6]!,
  STRATEGY_GUIDES[7]!,
];

/** Plain-language narration follows landing/compute/writeback, not just a phase heading. */
export function mechanismCue(kind: number, p: number) {
  if (isStrategyKind(kind)) return strategyCue(kind, p);
  const f = mechanismFrame(kind, p);
  const chapter = kind === 0 ? (f.setup ? 0 : f.stage + 1) : f.phase;
  if (kind === 4) {
    const motion = ringMotion(p);
    const queries = CP_FOCUS;
    if (f.phase === 0)
      return {
        chapter,
        title:
          f.local < 0.3
            ? "先认输入：一句话的 8 个位置"
            : motion.assign < 1
              ? "按位置分工，整行输入一起落卡"
              : "位置已落稳，再生成本地 Q/K/V",
        detail:
          f.local < 0.3
            ? "这句话有8个示意位置。attention 要为每个位置从允许看到的前文取回上下文：Q问要读什么，K用来匹配，V提供内容。Ring让K/V分块过来，读回的上下文继续交给本层输出投影。"
            : motion.assign < 1
              ? "沿用头尾配对：0、1、6、7归卡0，2、3、4、5归卡1。一整行的通道一起保留，颜色与位置编号跟着输入走。"
              : "本卡输入投影成查询 Q、键 K、值 V。K 首项 κ 是本例的匹配评分：块A为 ln(0.5)，块B为 ln(1.5)，取指数后权重是0.5、1.5。下一步先读本地块，再交换 K/V。",
      };
    return {
      chapter,
      title: [
        "同一位置的 Q、K、V 一起归属到卡",
        `第一轮：卡0算位置${queries[0]}，卡1算位置${queries[1]}`,
        motion.transfer < 1 ? "Q 与累积结果留在原地，K/V 块互换" : "远端块已落稳，准备接着计算",
        `第二轮：同一查询继续读远端块，更新已有累积`,
        "读完两块，各位置输出留在所属卡",
      ][chapter]!,
      detail: [
        "Q、K、V 各保留4个通道；同一位置的 K 行与 V 行成对交换。A 是位置0、1、6、7，B 是2、3、4、5；各卡实际由本地输入投影。",
        "Q7、Q5 分别是位置7、5的查询。评分取指数成为权重：U 累加“权重×V”，Z 累加权重；U÷Z 才是已读内容的加权平均。珊瑚红线读 K，青绿线把 V 的贡献加入 U。",
        "接收槽先亮，再接入同色同编号的整块。两条方向线分别表示 A→卡1、B→卡0；本地原块仍保留。此时不开始远端计算。",
        "Q7 接着读 B 的四行；Q5 接着读 A 的0、1，跳过未来位置6、7。右侧保留上一轮累计，再逐项增加新贡献。不是平均两轮的局部答案；实际内核用稳定在线 softmax。",
        "位置7读回上下文 [25,12.5,29,15]，第0通道是200/8=25。它将送入本层输出投影，再参与残差写回；不是给用户的文字答案。各查询仍按自己的可见范围计算。",
      ][chapter]!,
    };
  }
  let title: string;
  let detail: string;
  if (kind === 0) {
    if (f.setup) {
      title =
        f.split === 0
          ? "先看全貌：同一份输入要经过 8 层"
          : f.split < 1
            ? "部署模型：每张卡固定放两层"
            : "部署完成，请求从卡0开始";
      detail =
        f.split === 0
          ? "先展开输入矩阵的通道：每行是一个 token 的隐藏向量。这里用 4 行 × 8 通道示意，深色行“好”的前两格沿用正文的 [1,0] 算例。整张矩阵将依次通过上面的 8 层。"
          : f.split < 1
            ? "模型一张卡装不下时，按层的先后分成四段，每段两层装到一张卡。只在层与层之间切；权重部署好后留在卡上，不跟每次请求搬动。"
            : "整张输入矩阵落入卡0，接下来展开第0、1层的处理。这里各通道 +1 仅用于说明交接；逐格显现帮助对照变化，不代表真实内核的执行顺序。";
    } else if (f.receive < 1) {
      title = `卡${f.stage} 正在接收 ${f.stage === 0 ? "输入矩阵" : `卡${f.stage - 1}的输出`}`;
      detail = `整张 4×8 矩阵保持行序和通道顺序，落稳后才开始计算。深色“好”行的前两个通道仍是 [${f.input.join(", ")}]；没有只取这两个数来传递。`;
    } else if (f.first < 1) {
      title = `卡${f.stage}：第${f.stage * 2}层处理输入`;
      detail = `每个格子的值在本层更新，矩阵仍是 4×8。对照“好”行前两个通道：[${f.input.join(", ")}] → [${f.middle.join(", ")}]。本例以每个通道 +1 简化层计算。`;
    } else if (f.second < 1) {
      title = `第一层的输出，接着交给第${f.stage * 2 + 1}层`;
      detail = `第二层直接读第一层输出的整张矩阵。“好”行前两个通道：[${f.middle.join(", ")}] → [${f.output.join(", ")}]；其余行、列也随计算更新。`;
    } else {
      title =
        f.stage === 3
          ? "四段完成，得到最后的隐藏状态矩阵"
          : `卡${f.stage} 算完，把整张矩阵交给卡${f.stage + 1}`;
      detail =
        f.stage === 3
          ? "“好”行前两个通道得到 [9,8]，其余位置也保留在矩阵里。之后还有出口归一化、词表打分与采样。"
          : "同色、同形状、同数值的整张矩阵成为下一卡的输入；两层权重留在本卡。";
    }
  } else if (kind === 1) {
    const r = Math.min(3, Math.floor(f.local * 4));
    const owner = Math.floor(r / 2);
    const rowTime = f.local * 4 - r;
    if (f.phase === 0) {
      title =
        f.local < 0.4 ? "先看完整序列：今天 / 天气 / 很 / 好" : "同一序列经过 TP 投影，两张卡各有一份贡献";
      detail =
        f.local < 0.4
          ? "一句话的四个 token 排成四行，每行四个通道。先认清行的含义；点状格只表示通道位置。接下来展开两张 TP 卡对这同四行算出的不同贡献。"
          : "两边都包含这四个 token，不是两段不同的句子，也不是重复副本。每个真值要将两卡同位置的贡献相加；随后卡0只保留前两行，卡1只保留后两行。";
    } else if (f.phase === 1) {
      title =
        rowTime < 0.45
          ? `取出“${SP_TOKENS[r]}”的两份贡献`
          : rowTime < 0.85
            ? `同一行的四个通道，分别相加`
            : `把“${SP_TOKENS[r]}”的完整结果写回卡${owner}`;
      detail = `[${SP_PARTIALS[owner]![r]!.join(", ")}] + [${SP_PARTIALS[1 - owner]![r]!.join(", ")}] = [${SP_SUM[r]!.join(", ")}]。SP 切的是行：4行×4列变为每卡2行×4列，列数仍是4；一行的通道必须完整留在一起。`;
    } else if (f.phase === 2) {
      const norm = spNormalization(p);
      title =
        norm.landed < 1
          ? "各自取出本卡的一行，四个通道一起算"
          : norm.divided < 1
            ? "四个通道，除以这一行的同一个均方根"
            : "归一化结果写回本卡的同名行";
      detail = `${norm.rows
        .map(
          (r, g) =>
            `卡${g}“${SP_TOKENS[r]}”：RMS = √((${SP_SUM[r]!.map((x) => `${x}²`).join("+")})/4) = ${SP_RMS[r]}；[${SP_SUM[r]!.join(", ")}] ÷ ${SP_RMS[r]} = [${SP_NORMALIZED[r]!.join(", ")}]。`,
        )
        .join(" ")}归一化只改变数值，不改变列数；每卡仍是2行×4通道。`;
    } else if (f.phase === 3) {
      const gatherWork = Math.max(0, (f.local - 0.18) / 0.82) * 4;
      const row = Math.min(3, Math.floor(gatherWork));
      title =
        f.local < 0.18
          ? "All-Gather 准备：先亮出待接收的两行空槽"
          : gatherWork >= 3.65
            ? "两卡都收齐四行，交给后续投影"
            : `把“${SP_TOKENS[row]}”的结果复制到另一卡的同名行`;
      detail =
        f.local < 0.18
          ? "此时每张卡本地仍只存 2×4 归一化激活，尚未发出跨卡数据。先在对卡标出同名接收空槽，随后逐行补齐。"
          : "原卡保留这一行，另一卡收到相同的数。此处是收齐缺少的行，不再相加；颜色和 token 名称跟着整行走。";
    } else {
      const projection = spProjection(p),
        r = projection.row;
      title = p >= 0.963 ? "投影完成：四列输入，得到两列输出" : `“${SP_TOKENS[r]}”接着乘两张卡各自的权重列`;
      detail =
        p >= 0.963
          ? "四列输入已完成投影，现在把两卡各算出的一列移到中间对照：4行×2通道。左列属于卡0，右列属于卡1，仍分存两卡；这里的展开没有新增收集通信。SP切行不改列数，改变通道数的是最后的4→2投影。"
          : `两卡读同一行 [${SP_NORMALIZED[r]!.join(", ")}]，卡0乘列[1,2,−1,1]，卡1乘列[3,1,1,−1]，分别得到 ${SP_PROJECTED[r]!.map((v) => +v.toFixed(2)).join("、")}。四列是输入；每卡产生一列输出，总共两列。`;
    }
  } else if (kind === 2) {
    const motion = pcpMotion(p);
    if (f.phase === 0) {
      title =
        f.local < 0.25
          ? "先认输入：一句话对应 8 行隐藏向量"
          : f.local < 0.65
            ? "如果按前后半段分，两卡分别要算10对、26对"
            : "改成头尾配对，两卡各算18对";
      detail =
        f.local < 0.25
          ? "每行是一个位置的隐藏向量。attention 要让当前位置结合前文：Q查询、K匹配、V提供内容，按匹配程度读回一行上下文。PCP把不同位置的这份工作分给两卡；先看完整输入。"
          : "位置0只看1个位置，位置7要看8个。连续分仍算得对；把0、1与6、7配到卡0，2、3与4、5配到卡1，是为了平衡计算量，不改变因果顺序。";
    } else if (f.phase === 1) {
      title =
        motion.assign < 1
          ? "同色的输入行，落到负责它的卡"
          : motion.localKV < 1
            ? "由本卡输入生成本地 Q、K、V"
            : "查询留在本卡，补齐它要读取的 K/V";
      detail =
        motion.assign < 1
          ? "行的颜色、位置编号和通道宽度保持不变；输入行就位后才能做本地投影。"
          : motion.localKV < 1
            ? "本地输入 X 分别投影成查询 Q、键 K、值 V。格内开始显示本图的 Q/K/V 教学数值；这里省略投影乘法，不是直接把输入改名成 Q。"
            : "例如位置7归卡0，但它仍要读位置0到7；卡1持有的 K/V 也要临时送来。查询分工不改变可见范围。";
    } else if (f.phase === 2) {
      const a = PCP_QUERIES[0]![motion.active]!;
      const b = PCP_QUERIES[1]![motion.active]!;
      title = `卡0 算位置${a}；卡1 算位置${b}`;
      detail = `Q${a}、Q${b} 分别为这两个位置读上下文。每个合法位置先贡献“权重×V”，累加取回的内容，同时累加取用了多少份。内容总和÷权重总份额就是读回的上下文。本例每行等权，所以是内容的平均；结果仍是一行数字向量。`;
    } else {
      title = "每个位置的输出，留在负责这个位置的卡";
      detail =
        "卡0保留0、1、6、7，卡1保留2、3、4、5。下一步继续本层后续计算，不是在每一层都收集成一份完整输出。";
    }
  } else if (f.phase === 0) {
    title = "历史按位置轮流存：一对 K、V 始终放在一起";
    detail =
      "生成下一个token之前，当前查询要从已有历史中读回上下文。历史K负责匹配、V提供内容；DCP将它们按位置分存两卡。卡0留0、2、4、6，卡1留1、3、5、7，最终必须合成同一份上下文。";
  } else if (f.phase === 1) {
    title = "同一个查询，两张卡各读自己的四个历史位置";
    detail =
      f.local < 0.85
        ? "每张卡先把本地 V 按评分加权累加成 U，同时把权重累加成 Z；U÷Z 才是只看本地历史的答案。Z 还要留着，稍后决定两卡答案各占多少。"
        : "卡0读回上下文[10,30,5,15]，权重总份额2；卡1读回[30,10,15,5]，总份额6。四格是局部上下文，旁边另记份额，下一步用它决定两份上下文各占多少。";
  } else if (f.phase === 2) {
    title = "跨卡交换局部 O 与 LSE（ln 2、ln 6），本卡算 Z = exp(LSE)";
    detail =
      "历史 K/V 缓存留在原卡，跨卡只传局部输出 O 与对数统计 LSE（ln 2、ln 6）；接收卡在本地计算 Z = exp(LSE) = 2、6，由此得到合并权重 2/8 与 6/8，而不是在链路上直接传 Z。";
  } else {
    const merge = dcpMergeFrame(p);
    title = merge.complete
      ? "按全局份额合并完成：O = [25, 15, 12.5, 7.5]"
      : merge.weighted
        ? "两份局部答案已乘 ¼ 与 ¾，准备同列相加"
        : merge.landed < 1
          ? "取出两份局部答案，先放入下方合并位置"
          : "分量 2 与 6 → 各占 ¼ 与 ¾，准备加权相加";
    detail = merge.complete
      ? "两块历史各占¼、¾，逐列得到上下文 [25,15,12.5,7.5]。这行将进入本层输出投影、残差与后续层，帮助当前位置决定接下来生成什么；25不是token编号，也不是直接返回用户的答案。"
      : merge.weighted
        ? "卡0贡献 [2.5, 7.5, 1.25, 3.75]，卡1贡献 [22.5, 7.5, 11.25, 3.75]；乘好各自份额后，下一步同列相加写入合并结果槽。"
        : "全局总份额 Z = 2 + 6 = 8，两块历史分别占 2/8 = ¼ 与 6/8 = ¾。先让两份局部 O 落稳并乘上各自份额，完成前不提前写入合并答案。";
  }
  return { chapter, title, detail };
}

export const MECHANISM_READING_KEYS = [
  {
    sample: "输入 X：4 行 × 8 通道",
    meaning:
      "每行是一个 token 的隐藏向量，四行都显示 8 个通道值；深色“好”行的前两个通道对应正文的 [1,0] 算例。",
    labels: "卡0是硬件编号，第0层是模型层号；编号从0开始。",
    example: "本图把每层简化为每个通道 +1，只演示交接；真实层计算包含 attention 和 MLP。",
  },
  {
    sample: "今天 · [1, 3, 3, 1]",
    meaning: "“今天”这一行的四个通道贡献。另一张卡对同一行还有另一份贡献，需要逐格相加。",
    labels: "t0是第0个 token 的位置编号；[4,4] 表示4行、每行4个通道。",
    example: "格内数值是教学示例。切分按行，四个通道始终一起保留。",
  },
  {
    sample: "位置0 · [1, 1, 0, 0]",
    meaning: "位置0的查询向量，含4个通道值。一行属于一个位置，格内数字是数值。",
    labels: "q0 / p0 / o0：位置0的查询、被读取的 K/V、输出；数字0都是位置编号。",
    example: "Q、K、V 的 [8,4] 表示8行、每行4通道。数值是可手算的 attention 示例。",
  },
  {
    sample: "O₀ = [10,30,5,15] · LSE₀ = ln 2（Z₀ = 2）",
    meaning:
      "卡0的局部输出是四通道向量 [10,30,5,15]；跨卡传递对数统计 LSE₀ = ln 2，本卡由 Z₀ = exp(LSE₀) = 2 还原份额。",
    labels: "q7是位置7的查询；O₀ / LSE₀ / Z₀ 的下标0表示卡0，Z = exp(LSE) 在接收卡本地计算。",
    example:
      "K、V 每行保留4个通道；跨卡传 O 与 LSE，合并时按本卡算出的 Z = exp(LSE) 加权四列。数值为教学示例。",
  },
  {
    sample: "Q=[2,0,0,0]，K=[κ,0,1,−1]",
    meaning:
      "一行是一个位置的四通道向量，Q、K、V 分别保留列结构。K 的 κ 表示本块的 ln(0.5) 或 ln(1.5)，数值演算展开第0输出通道。",
    labels: "A：位置0、1、6、7；B：位置2、3、4、5。U 是加权和，Z 是指数和，输出为 U/Z。",
    example:
      "四通道评分为 Q·K/√4=κ，因此第0输出通道沿用正文的25；V 的其余通道分别取 v/2、v+4、40−v。小数显示四舍五入；通信线是算法方向，不是真实网络拓扑。",
  },
  STRATEGY_READING_KEYS[5]!,
  STRATEGY_READING_KEYS[6]!,
  STRATEGY_READING_KEYS[7]!,
];

export function mechanismTeaching(kind: number, p: number): TeachingFrame {
  if (isStrategyKind(kind)) return strategyTeaching(kind, p);
  const f = mechanismFrame(kind, p);
  if (kind === 1 && f.phase === 4) {
    const r = spProjection(p).row;
    return {
      title: "相同输入行 × 不同权重列 → 两个输出通道",
      equation: SP_WEIGHT_COLUMNS.map(
        (w, g) =>
          `卡${g}：${SP_NORMALIZED[r]!.map((x, c) => `${x}×(${w[c]})`).join(" + ")} = ${+SP_PROJECTED[r]![g]!.toFixed(2)}`,
      ).join("\n"),
      detail:
        "All-Gather 的结果直接作为这里的输入；权重列从各自 NPU 的权重分片展开。收集全体行是这套 TP 权重布局的需要，线性投影本身仍逐 token 独立。两卡算出的输出列不相加。",
      tensors: [],
    };
  }
  if (kind === 4) {
    const cue = mechanismCue(kind, p);
    const equation = [0, 1]
      .map((g) => {
        const read = cpReadFrame(kind, p, g);
        return `卡${g} · Q${read.query}：内容${+read.total.u.toFixed(2)} ÷ 份额${+read.total.z.toFixed(2)}${read.output === null ? "" : ` = 上下文${+read.output.toFixed(2)}`}`;
      })
      .join("\n");
    return {
      title: cue.title,
      equation: f.phase === 4 ? "位置7：20+180=200，2+6=8\n完整输出 200/8 = 25" : equation,
      detail: cue.detail,
      tensors: [],
    };
  }
  if (f.setup)
    return {
      title: "PP 沿层序分段，每层的矩阵保持完整",
      equation: "8 层 → 4 张卡 × 每卡 2 层\n卡0：第0–1层 · 卡1：第2–3层\n卡2：第4–5层 · 卡3：第6–7层",
      detail:
        "每个有厚度的网格代表一层的权重集合。先沿层与层之间分开，再把同色的两层放到对应 NPU；层内矩阵不被 PP 切碎。部署完成后，隐藏向量依次通过四段，权重留在原卡。",
      tensors: [],
    };
  const text = [
    [
      `第 ${f.stage + 1} 段：先接收，再依次计算两层`,
      `“好”行前两个通道：\n输入 [${f.input.join(", ")}]\n第${f.stage * 2}层 → [${f.middle.join(", ")}]\n第${f.stage * 2 + 1}层 → [${f.output.join(", ")}]`,
      "本图用4个 token、每个8通道示意隐藏状态，整张矩阵接收后依次经过本卡两层，再完整交给下一卡。每层以逐元素 +1 简化，只说明先后依赖和归属；真实模型的层计算包含 attention 和 MLP。逐格显现不代表内核串行执行。层权重与 KV 留在所属卡。",
    ],
    [
      [
        "沿 token 行切：每行的四个通道一起保留",
        "ReduceScatter：同一行先相加，再归属",
        "每张卡只归一化自己负责的两行",
        "AllGather：交换完整行，恢复原顺序",
      ][f.phase]!,
      [
        "两份 [4,4] 部分和各分为两段 [2,4]\n上半 t0,t1 → 卡0；下半 t2,t3 → 卡1",
        "[1,3,3,1] + [0,4,4,0] = [1,7,7,1]\n卡0：t0,t1；卡1：t2,t3",
        "RMS = [5,5,5,25]\nt0：[1,7,7,1] ÷ 5 = [0.2,1.4,1.4,0.2]",
        "两卡各得到 [4,4]\n每行四通道保持原位，下一投影按列分工",
      ][f.phase]!,
      [
        "句子示意分为“今天 / 天气 / 很 / 好”四个 token，每行四格是隐藏通道。两张卡对同四行算出了不同贡献：“今天”分别是 [1,3,3,1] 和 [0,4,4,0]，还要相加。钴蓝两行的和归卡0，珊瑚红两行的和归卡1；每行内部不切。",
        "虚线槽先亮出接收位置。当前行的两份部分和从各卡展开，逐通道相加，再写回负责该行的卡；每卡只留下自己负责的两行结果。",
        "两卡之间没有通信。每行用自己的四个通道求均方根；本例 γ=1，忽略 ε 与残差。上下对应的列是同一个隐藏通道。",
        "归一化后的行传给另一卡的同编号空槽，落稳后保留。这里拼接行，不再次求和；下一列并行投影才能读取全部 token。KV 缓存不由本图的 SP 切分。",
      ][f.phase]!,
    ],
    [
      [
        "先按输入位置分工；本层 Q 沿用同一行序",
        "两段一组落卡，再临时收齐本层 K/V",
        "本卡查询只读自己的因果范围，写出对应输出",
        "attention 输出留在所属卡，继续本层后续计算",
      ][f.phase]!,
      [
        "输入 X：8 个位置 × 4 个通道 → 四段\n头尾两段归卡0，中间两段归卡1",
        "卡0：q0,q1,q6,q7\n卡1：q2,q3,q4,q5",
        "卡0：1+2+7+8 = 18\n卡1：3+4+5+6 = 18",
        "卡0：o0,o1,o6,o7\n卡1：o2,o3,o4,o5\n行的归属不变，继续本层后续计算",
      ][f.phase]!,
      [
        "一句话示意分为 8 个 token，输入的每行保留 4 个隐藏通道。先分成 4 个连续段：[0,1]、[2,3]、[4,5]、[6,7]，首尾配成一组。实际先分输入位置，各卡再计算本地 Q/K/V；不是先集中生成完整 Q 再发送。空格表示此时尚未展开输入数值。",
        "先看完整的两行段落到对应卡。Q 留在本卡；同位置输入另外投影出的 K/V 从硬件展开，临时收集为各卡的完整本层 K/V，随后才计算 attention。这里演示非分块、无已缓存前缀的 prefill；旁边的 K/V 是临时计算缓冲，不是常驻缓存归属。",
        "固定追踪 Q7 与 Q5，描边当前读取的历史行。Qq=[1,q+1,0,0]、Kp=[0,0,p,1]，合法评分都是0，指数都是1。Vp=[2p+1,2p+2,2p+3,2p+4]；下方放大第0通道，显示累加与除法，其余通道同法计算。未来位置不参与。分步讲解计算依赖，不表示硬件逐行串行执行。",
        "同色、同编号的输出写回各自 NPU，展开区保留结果供对照。本层 attention 输出还要经过输出投影等后续计算；查询的位置分工继续保留。不是每层都把输出拼成一份全局矩阵：完整模型前向结束后，执行器才在需要时收集隐藏状态并按恢复下标排回全局位置。",
      ][f.phase]!,
    ],
    [
      [
        "K、V 同时按历史行分片，通道宽度保持完整",
        "各卡独立计算局部输出 O 与对数统计 LSE",
        "跨卡交换局部 O 与 LSE，本卡算 Z = exp(LSE)",
        "按全局归一化权重合并",
      ][f.phase]!,
      [
        "K [8,4] 与 V [8,4] → 每卡各 [4,4]\n偶数行归卡0，奇数行归卡1；同一查询 q7",
        "卡0：O₀ = [10,30,5,15]，LSE₀ = ln 2（Z₀ = 2）\n卡1：O₁ = [30,10,15,5]，LSE₁ = ln 6（Z₁ = 6）",
        "跨卡传 O + LSE（ln 2, ln 6）\n接收卡本地算 Z = exp(LSE) = 2, 6；KV 留在原卡",
        dcpMergeFrame(p).complete
          ? "α₀=2/8，α₁=6/8\n¼×[10,30,5,15] + ¾×[30,10,15,5]\n= [25,15,12.5,7.5]"
          : "α₀=2/8，α₁=6/8\n¼×[10,30,5,15] + ¾×[30,10,15,5]\n= [?, ?, ?, ?]（待落稳加权写入）",
      ][f.phase]!,
      [
        "先看完整逻辑位置的 K 和 V，再看同编号的两行成对分到所属卡。这是在解释缓存布局，不表示运行时先集中缓存再搬走；实际写入就按位置归属分存。当前 q7 读取位置 0…7（含自己），后续只交换局部结果，缓存留在所属卡。",
        "每行 K、V 都有四个通道；相同的 Q=[2,0,0,0] 在两卡读取各自的历史。局部 O 已经按本卡历史归一化，不能直接相加。前四格保留 O 的完整向量，独立统计 LSE 对应本卡份额 Z = exp(LSE)。",
        "同查询的局部 O 和 LSE（ln 2、ln 6）一起进入另一卡对应输入槽，本卡再计算 Z = exp(LSE) = 2、6。为了看清合并，下面展开一份相同查询/头的结果；实际通信与归约可融合。",
        dcpMergeFrame(p).complete
          ? "两份归一化量合成全局量 8。四通道共用分区权重 ¼ 和 ¾，按相同列相加得到 [25,15,12.5,7.5]。第0通道仍是正文的 2.5+22.5=25；其余三列也保留自己的结果。Z 是独立统计，不加入输出向量。"
          : "两份归一化量合成全局量 8，四通道共用分区权重 ¼ 和 ¾。待两份局部 O 落稳、乘上各自份额并同列相加后，才会写入最终合并向量。Z 是独立统计，不加入输出向量。",
      ][f.phase]!,
    ],
  ][kind]!;
  let equation = text[1]!;
  if (kind === 1 && f.phase === 1) {
    const row = Math.min(3, Math.floor(f.local * 4)),
      owner = Math.floor(row / 2);
    equation = `${SP_TOKENS[row]} · t${row}：[${SP_PARTIALS[owner]![row]}] + [${SP_PARTIALS[1 - owner]![row]}]\n= [${SP_SUM[row]}] → 卡${owner}`;
  }
  if (kind === 1 && f.phase === 2) {
    equation = spNormalization(p)
      .rows.map((r) => `t${r}：[${SP_SUM[r]}] ÷ ${SP_RMS[r]}\n= [${SP_NORMALIZED[r]}]`)
      .join("\n");
  }
  if (kind === 2 && f.phase === 2) {
    const slot = pcpMotion(p).active;
    equation = PCP_QUERIES.map((positions, rank) => {
      const q = positions[slot]!;
      return `卡${rank} · q${q} → p0…p${q}\n权重 1/${q + 1}；o${q}=[${PCP_EXAMPLE.outputs[q]}]`;
    }).join("\n");
  }
  return { title: text[0]!, equation, detail: text[2]!, tensors: [] };
}
