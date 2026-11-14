import { type FfnStep, type MatrixPartKind, RMS_GROUPS } from "./matrix-parts";

export const PART_PLAYBACK_SECONDS = 12;
export const RMS_PLAYBACK_SECONDS = 36;
const RMS_PHASE_SECONDS = [0, 4, 26, 33, RMS_PLAYBACK_SECONDS];

export function rmsProgress(phase: number, amount = 0) {
  const start = RMS_PHASE_SECONDS[phase]!;
  return (start + (RMS_PHASE_SECONDS[phase + 1]! - start) * amount) / RMS_PLAYBACK_SECONDS;
}

// Four pairwise rounds, then hold the sum, mean and root long enough to read.
export function rmsReduction(amount: number) {
  const round = Math.max(0, Math.min(4, amount / 0.15));
  // Seeking through seconds can land a fraction below an exact round boundary.
  const level = Math.min(4, Math.floor(round + 1e-10));
  return {
    level,
    count: RMS_GROUPS / 2 ** level,
    roundAmount: Math.max(0, round - level),
    movement: Math.max(0, Math.min(1, (round - level - 0.5) / 0.22)),
    operation: amount < 0.68 ? "sum" : amount < 0.8 ? "mean" : amount < 0.88 ? "epsilon" : "rms",
  };
}

const captions: Record<MatrixPartKind, string[]> = {
  rms: [
    "取出当前词的整列，逐项平方",
    "把全部平方求平均，加 ε 后开根号",
    "同一维：除以共同的 RMS，再乘自己的 γ",
    "同一维写回同一位置，再写完这一列",
  ],
  mhc: [
    "读取这个词的四条残差流",
    "取出这个词的四个 pre 系数",
    "四路分别乘系数，再逐维相加",
    "写成一路，送入前馈支路",
  ],
  ffn: ["读取这个词的完整输入", "取出当前投影的权重", "输入与权重做点积", "逐维写出这个词的投影结果"],
};

export function partPlayback(kind: MatrixPartKind, step: FfnStep, progress: number) {
  const position = Math.max(0, Math.min(1, progress));
  const phase =
    kind === "rms"
      ? Math.min(3, RMS_PHASE_SECONDS.slice(1).filter((end) => position * RMS_PLAYBACK_SECONDS >= end).length)
      : Math.min(3, Math.floor(position * 4));
  const labels =
    kind === "ffn" && step === "multiply"
      ? ["读取这个词的 gate", "读取同一位置的 up", "限幅后计算 SiLU(gate) × up", "逐项写出门控后的 h"]
      : captions[kind];
  return {
    phase,
    amount:
      position === 1
        ? 1
        : kind === "rms"
          ? (position * RMS_PLAYBACK_SECONDS - RMS_PHASE_SECONDS[phase]!) /
            (RMS_PHASE_SECONDS[phase + 1]! - RMS_PHASE_SECONDS[phase]!)
          : position * 4 - phase,
    caption: position === 1 ? "完整结果 · 可旋转查看" : labels[phase]!,
  };
}
