export const RANKS = [0, 1, 2, 3] as const;
export const COLLECTIVE_INPUT = RANKS.map((r) => RANKS.map((b) => (b + 1) * 10 ** r));
export const COLLECTIVE_SUM = [1111, 2222, 3333, 4444];
export const COLLECTIVES = [
  {
    name: "Broadcast",
    title: "一份输入，每卡各得一份",
    rule: "复制",
    input: "只有 rank 0 提供完整输入。",
    output: "四卡都得到 [1, 2, 3, 4]。",
  },
  {
    name: "Scatter",
    title: "一份输入，拆给不同的卡",
    rule: "分发",
    input: "rank 0 的四块，分别属于四个接收方。",
    output: "rank 0–3 分别得到 1、2、3、4。",
  },
  {
    name: "Gather",
    title: "各有一块，只拼到根卡",
    rule: "拼接",
    input: "四卡分别提供 1、2、3、4。",
    output: "只有 rank 0 得到 [1, 2, 3, 4]；其余卡没有新的输出。",
  },
  {
    name: "All-Gather",
    title: "各有一块，每卡都拼齐",
    rule: "拼接",
    input: "四卡分别提供 1、2、3、4。",
    output: "四卡都得到 [1, 2, 3, 4]，数值没有相加。",
  },
  {
    name: "Reduce",
    title: "同位置相加，只留在根卡",
    rule: "求和",
    input: "每卡都有四块部分值；同一行表示同一个块位置。",
    output: "只有 rank 0 得到 [1111, 2222, 3333, 4444]。",
  },
  {
    name: "Reduce-Scatter",
    title: "同位置相加，每卡只留一块",
    rule: "求和 · 分片",
    input: "每卡提供四块，归约使用 SUM：逐位置相加。",
    output: "rank 0–3 分别保留 1111、2222、3333、4444。",
  },
  {
    name: "All-Reduce",
    title: "先各自加齐一块，再互相收齐",
    rule: "求和 · 收集",
    input: "先做 Reduce-Scatter，再做 All-Gather。",
    output: "四卡都得到 [1111, 2222, 3333, 4444]。",
  },
  {
    name: "All-to-All",
    title: "按目的卡分发，按来源卡排好",
    rule: "交换",
    input: "每卡的第 j 块发给 rank j；每个接收方按源 rank 排列。",
    output: "rank 0 得到 [1, 10, 100, 1000]；其余卡分别收齐第 1、2、3 块。",
  },
  {
    name: "Ring All-Reduce",
    title: "沿逻辑环，三轮相加、三轮收集",
    rule: "环上求和 · 收集",
    input: "逻辑环为 0 → 1 → 2 → 3 → 0；每轮每卡只发、只收一块。",
    output: "前 3 轮加齐各块，后 3 轮只复制；最终四卡都有完整结果。",
  },
] as const;

export type CollectiveTransfer = {
  from: number;
  to: number;
  source: "input" | "output";
  slots: number[];
  targets: number[];
  values: number[];
  operation: "copy" | "sum";
};
type Step = { title: string; detail: string; transfers: CollectiveTransfer[] };
export type CollectiveBuffer = (number | null)[][];
const empty = (): CollectiveBuffer => RANKS.map(() => RANKS.map(() => null));
const clone = (a: CollectiveBuffer) => a.map((row) => [...row]);
export function collectiveInputs(kind: number): CollectiveBuffer {
  if (kind < 2) return RANKS.map((r) => (r === 0 ? [1, 2, 3, 4] : [null, null, null, null]));
  if (kind < 4) return RANKS.map((r) => RANKS.map((b) => (b === r ? r + 1 : null)));
  return COLLECTIVE_INPUT.map((row) => [...row]);
}
function apply(buffer: CollectiveBuffer, transfer: CollectiveTransfer) {
  transfer.targets.forEach((slot, i) => {
    buffer[transfer.to]![slot] =
      (transfer.operation === "sum" ? (buffer[transfer.to]![slot] ?? 0) : 0) + transfer.values[i]!;
  });
}
function plan(kind: number): Step[] {
  const steps: Step[] = [];
  const add = (
    from: number,
    to: number,
    slots: number[],
    targets = slots,
    operation: "copy" | "sum" = "copy",
    source: "input" | "output" = "input",
    values = slots.map((b) => COLLECTIVE_INPUT[from]![b]!),
  ) => {
    const local = from === to;
    steps.push({
      title: local ? `rank ${to} · 取本地数据` : `rank ${from} → rank ${to}`,
      detail: `${slots.length === 4 ? "完整四块" : `块 ${slots[0]}`} ${operation === "sum" ? "到达后，才与接收方同位置的值相加。" : "保持数值和顺序，放入接收位置。"}${local ? "这一步不经过网络。" : ""}`,
      transfers: [{ from, to, slots, targets, values, operation, source }],
    });
  };
  if (kind === 0) for (const to of RANKS) add(0, to, [...RANKS]);
  if (kind === 1) for (const to of RANKS) add(0, to, [to]);
  if (kind === 2 || kind === 3)
    for (const from of RANKS) {
      for (const to of kind === 2 ? [0] : RANKS) add(from, to, [from], [from], "copy", "input", [from + 1]);
    }
  if (kind === 4) for (const from of RANKS) add(from, 0, [...RANKS], [...RANKS], "sum");
  if (kind === 5 || kind === 6) {
    for (const to of RANKS) for (const from of RANKS) add(from, to, [to], [to], "sum");
    if (kind === 6)
      for (const from of RANKS)
        for (const to of RANKS) {
          if (from !== to) add(from, to, [from], [from], "copy", "output", [COLLECTIVE_SUM[from]!]);
        }
  }
  if (kind === 7) for (const to of RANKS) for (const from of RANKS) add(from, to, [to], [from]);
  if (kind === 8) {
    for (const r of RANKS) add(r, r, [...RANKS]);
    const working = COLLECTIVE_INPUT.map((row) => [...row]);
    for (let round = 0; round < 6; round++) {
      const sum = round < 3;
      const transfers = RANKS.map((from): CollectiveTransfer => {
        const block = (from - round + 8) % 4;
        return {
          from,
          to: (from + 1) % 4,
          source: "output",
          slots: [block],
          targets: [block],
          values: [working[from]![block]!],
          operation: sum ? "sum" : "copy",
        };
      });
      // Every sender reads the start-of-round snapshot; no within-round forwarding.
      transfers.forEach((t) => {
        apply(working, t);
      });
      steps.push({
        title: `第 ${round + 1} 轮 · ${sum ? "Reduce-Scatter" : "All-Gather"}`,
        detail: sum
          ? "四条逻辑链路同时收发。收到以后加上本卡同位置的值，下一轮再转发。"
          : "每张卡把上一轮收到的完整块继续转发；收到直接写入，不再相加。",
        transfers,
      });
    }
  }
  return steps;
}
export const COLLECTIVE_STEPS = COLLECTIVES.map((_, kind) => plan(kind));
export const collectiveSeconds = (kind: number) => 8 + COLLECTIVE_STEPS[kind]!.length * 3.6;
export function collectiveFrame(kind: number, progress: number) {
  const steps = COLLECTIVE_STEPS[kind]!;
  const time = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * collectiveSeconds(kind);
  const action = Math.min(steps.length, Math.floor((time - 4) / 3.6 + 1e-9));
  const local = Math.min(1, Math.max(0, (time - 4) / 3.6 - action));
  const before = empty();
  for (let i = 0; i < Math.min(action, steps.length); i++)
    for (const t of steps[i]!.transfers) apply(before, t);
  const current = action >= 0 && action < steps.length ? steps[action]! : null;
  const arrived = local >= 0.7;
  const applied = local >= 0.86;
  const output = clone(before);
  if (applied && current) for (const t of current.transfers) apply(output, t);
  return {
    action,
    local,
    before,
    output,
    current,
    arrived,
    applied,
    travel: Math.max(0, Math.min(1, (local - 0.12) / 0.58)),
    ended: action === steps.length,
    intro: action < 0,
  };
}
export function collectiveTeaching(kind: number, p: number) {
  const f = collectiveFrame(kind, p),
    lesson = COLLECTIVES[kind]!;
  return {
    title: f.intro ? "先看每卡的输入" : (f.current?.title ?? "看每卡最后拿到什么"),
    detail: f.intro ? lesson.input : (f.current?.detail ?? lesson.output),
    equation: "",
  };
}
