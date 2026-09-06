/**
 * 播放引擎 store（计划 §2.3）。只放会触发 React 重渲染的离散状态：
 * 时间线、当前步、播放/暂停、倍速、层视图、动效开关。
 * 步内进度 t 不在这里，见 progress.ts（瞬态 ref，播放期零重渲染）。
 */
import { create } from "zustand";
import type { Step, Timeline } from "../sim/timeline/types";

export type LayerView = "model" | "hardware" | "both";
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export const SPEED_STEPS = [0.25, 0.5, 1, 2, 4] as const;
export const SPEED_MIN = SPEED_STEPS[0];
export const SPEED_MAX = SPEED_STEPS[SPEED_STEPS.length - 1] as number;

export interface LoadMeta {
  /** Worker 内 buildHardwareTimeline 的耗时（ms） */
  buildMs: number;
  /** 主线程从发出请求到拿到可用对象的额外耗时（ms，不含 buildMs） */
  transferMs: number;
  /** 命中缓存时为 true */
  cached: boolean;
}

export interface PlaybackState {
  timeline: Timeline | null;
  status: LoadStatus;
  error: string | null;
  loadMeta: LoadMeta | null;
  stepIndex: number;
  playing: boolean;
  speed: number;
  layer: LayerView;
  /** 系统 prefers-reduced-motion */
  reducedMotion: boolean;
  /** URL ?nofx=1 */
  nofx: boolean;
  /** 用户拖过相机后为 true，直到 resetCamera */
  userCameraOverride: boolean;
  /** 每次 resetCamera 递增，相机组件据此瞬移/回位 */
  cameraResetSeq: number;
}

export interface PlaybackActions {
  setLoading(): void;
  setError(message: string): void;
  load(timeline: Timeline, meta: LoadMeta): void;
  unload(): void;
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  first(): void;
  last(): void;
  /** 按序号或 step id 跳转；未知 id 返回 false 且不改状态 */
  seek(target: number | string): boolean;
  setSpeed(speed: number): void;
  /** 沿 SPEED_STEPS 上/下调一档 */
  stepSpeed(direction: 1 | -1): void;
  setLayer(layer: LayerView): void;
  setReducedMotion(value: boolean): void;
  setNofx(value: boolean): void;
  setCameraOverride(value: boolean): void;
  resetCamera(): void;
}

export type PlaybackStore = PlaybackState & PlaybackActions;

const INITIAL: PlaybackState = {
  timeline: null,
  status: "idle",
  error: null,
  loadMeta: null,
  stepIndex: 0,
  playing: false,
  speed: 1,
  layer: "both",
  reducedMotion: false,
  nofx: false,
  userCameraOverride: false,
  cameraResetSeq: 0,
};

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
}

export const usePlayback = create<PlaybackStore>()((set, get) => {
  const stepCount = () => get().timeline?.steps.length ?? 0;
  const clampIndex = (i: number) => Math.min(Math.max(0, i), Math.max(0, stepCount() - 1));
  return {
    ...INITIAL,
    setLoading: () => set({ status: "loading", error: null }),
    setError: (message) => set({ status: "error", error: message, playing: false }),
    load: (timeline, meta) =>
      set({ timeline, status: "ready", error: null, loadMeta: meta, stepIndex: 0, playing: false }),
    unload: () => set({ ...INITIAL, speed: get().speed, layer: get().layer, nofx: get().nofx }),
    play: () => {
      const s = get();
      if (!s.timeline) return;
      const atEnd = s.stepIndex >= stepCount() - 1;
      set({ playing: true, stepIndex: atEnd ? 0 : s.stepIndex });
    },
    pause: () => set({ playing: false }),
    toggle: () => (get().playing ? get().pause() : get().play()),
    next: () => {
      const s = get();
      if (!s.timeline) return;
      if (s.stepIndex >= stepCount() - 1) {
        set({ playing: false });
        return;
      }
      set({ stepIndex: s.stepIndex + 1 });
    },
    prev: () => {
      const s = get();
      if (!s.timeline) return;
      set({ stepIndex: clampIndex(s.stepIndex - 1) });
    },
    first: () => get().timeline && set({ stepIndex: 0 }),
    last: () => get().timeline && set({ stepIndex: clampIndex(stepCount() - 1) }),
    seek: (target) => {
      const s = get();
      if (!s.timeline) return false;
      let index: number;
      if (typeof target === "number") {
        if (!Number.isInteger(target)) return false;
        index = clampIndex(target);
      } else {
        index = s.timeline.steps.findIndex((st) => st.id === target);
        if (index < 0) return false;
      }
      set({ stepIndex: index });
      return true;
    },
    setSpeed: (speed) => set({ speed: clampSpeed(speed) }),
    stepSpeed: (direction) => {
      const cur = get().speed;
      const i = SPEED_STEPS.findIndex((v) => v >= cur);
      const at = i < 0 ? SPEED_STEPS.length - 1 : i;
      const nextI = Math.min(SPEED_STEPS.length - 1, Math.max(0, at + direction));
      set({ speed: SPEED_STEPS[nextI] as number });
    },
    setLayer: (layer) => set({ layer }),
    setReducedMotion: (value) => set({ reducedMotion: value }),
    setNofx: (value) => set({ nofx: value }),
    setCameraOverride: (value) => set({ userCameraOverride: value }),
    resetCamera: () => set({ userCameraOverride: false, cameraResetSeq: get().cameraResetSeq + 1 }),
  };
});

/** 离开章节页或测试之间调用，回到初始状态（保留 actions）。 */
export function resetPlaybackStore(): void {
  usePlayback.setState({ ...INITIAL });
}

// ---------- 选择器 ----------
export const selectStep = (s: PlaybackState): Step | undefined => s.timeline?.steps[s.stepIndex];
export const selectStepCount = (s: PlaybackState): number => s.timeline?.steps.length ?? 0;
/** 系统 reduced-motion 或 ?nofx=1 任一为真：t 直接 1，相机瞬移，关后期特效 */
export const selectNoMotion = (s: PlaybackState): boolean => s.reducedMotion || s.nofx;
