import { span } from "./scene-easing";

/** Small, explicitly illustrative tensors. Rows keep their token identity in every view. */
export const REQUEST_TOKENS = [
  ["帮我", "写", "一封", "邮件"],
  ["解释", "一下", "缓存", "原理"],
] as const;
export const MATRIX_ROWS = 4;
export const MATRIX_CHANNELS = 6;
export const EP_FOCUS_ROW = 2;
export const requestIds = (owner: number) => REQUEST_TOKENS[owner]!.map((_, row) => 101 + owner * 100 + row);
export const requestHidden = (owner: number) =>
  REQUEST_TOKENS[owner]!.map((_, row) =>
    Array.from({ length: MATRIX_CHANNELS }, (_, channel) => (row + 1) * (channel + 1) + owner),
  );

/** A hand-checkable 4×8 · 8×4 projection; rank k owns one input column and one weight row. */
export const tpInput = () => Array.from({ length: 4 }, (_, row) => Array<number>(8).fill(row + 1));
export const tpWeight = (rank: number, channel: number) => ((rank % 8) + 1) * (channel + 1);
export const tpPartial = (rank: number) =>
  tpInput().map((row) => Array.from({ length: 4 }, (_, channel) => row[rank % 8]! * tpWeight(rank, channel)));
export const tpSum = (count = 8) =>
  Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, channel) => ((count * (count + 1)) / 2) * (row + 1) * (channel + 1)),
  );

/** Illustrative output rows the group writes for a request: same 4 token rows, new values. */
export const requestOutput = (owner: number) =>
  requestHidden(owner).map((row, r) => row.map((x, c) => ((x + r + c) % 7) + 1));
/**
 * Reply step (stages 6–7): the request's matrix is rewritten as the group's output, then
 * carried through the frontend back to its user; it keeps moving until the scene ends.
 */
export function dpReplyState(stage: number, local: number, owner: number) {
  const lag = owner * 0.04;
  const result = stage > 6 ? 1 : stage === 6 ? span(local, lag, 0.38 + lag) : 0;
  const leg = Math.max(0, Math.min(1, (local - 0.42 - lag) / (0.58 - lag)));
  const deliver = stage > 7 ? 1 : stage === 7 ? 0.8 + 0.2 * Math.min(1, local) : stage === 6 ? 0.8 * leg : 0;
  return { result, deliver };
}

/** Frontend sends IDs; only the selected execution group expands them through embedding. */
export function dpMatrixState(stage: number, local: number, owner: number) {
  const arrival = owner ? 3 : 1;
  const embedded = stage > 5 ? 1 : stage === 5 ? Math.min(1, local / 0.55) : 0;
  return {
    tokenized: stage > arrival || (stage === arrival && local >= 0.55),
    embedded,
    columns: embedded === 0 ? 1 : MATRIX_CHANNELS,
    computing: stage === 5 && local >= 0.55,
  };
}
