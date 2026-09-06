/**
 * 步内进度（计划 §2.3）：模块级瞬态对象，不进 store。
 * 页面里唯一的 rAF 时钟每帧调用 advance(dt)；画面元素自己每帧读 progress.t 直接改 DOM/uniform，
 * 播放期没有任何 React 重渲染。换步时由 store 订阅重置 t。
 */
import { selectNoMotion, usePlayback } from "./store";

/** 一步的过渡时长（1× 倍速，ms） */
export const STEP_TWEEN_MS = 900;
/** 过渡结束后在本步停留的时长（1× 倍速，ms），之后自动进入下一步 */
export const STEP_HOLD_MS = 700;

export interface Progress {
  /** 当前步内进度 ∈ [0,1]；1 表示本步已完全呈现 */
  t: number;
  /** 正在呈现的步序号（与 store.stepIndex 同步） */
  stepIndex: number;
  /** 过渡的起点步序号，用于 from→to 插值；首步为 -1 */
  prevStepIndex: number;
  /** t 到 1 之后累计的停留时间（已乘倍速，ms） */
  holdMs: number;
}

export const progress: Progress = { t: 1, stepIndex: -1, prevStepIndex: -1, holdMs: 0 };

/** 换步 / 载入时调用：重置进度；无动效时直接到 1。 */
export function resetProgress(stepIndex: number, noMotion: boolean): void {
  progress.prevStepIndex = progress.stepIndex;
  progress.stepIndex = stepIndex;
  progress.t = noMotion ? 1 : 0;
  progress.holdMs = 0;
}

/**
 * 每帧推进。dtMs 为真实经过时间；倍速在这里乘。
 * 过渡阶段：t 线性到 1。停留阶段：仅在 playing 时累计，到点后 next()；末步则 pause。
 */
export function advance(dtMs: number): void {
  const s = usePlayback.getState();
  if (!s.timeline || !(dtMs > 0)) return;
  const scaled = dtMs * s.speed;
  if (progress.t < 1) {
    const tween = s.timeline.steps[s.stepIndex]?.durationMs ?? STEP_TWEEN_MS;
    progress.t = selectNoMotion(s) ? 1 : Math.min(1, progress.t + scaled / tween);
    return;
  }
  if (!s.playing) return;
  progress.holdMs += scaled;
  if (progress.holdMs < STEP_HOLD_MS) return;
  progress.holdMs = 0;
  if (s.stepIndex >= s.timeline.steps.length - 1) s.pause();
  else s.next();
}

usePlayback.subscribe((state, prev) => {
  if (state.timeline !== prev.timeline || state.stepIndex !== prev.stepIndex) {
    resetProgress(state.stepIndex, selectNoMotion(state));
  }
});
