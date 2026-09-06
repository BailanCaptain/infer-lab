import { beforeEach, describe, expect, it } from "vitest";
import { buildHardwareTimeline } from "../sim/buildTimeline";
import { getTokenPreset } from "../sim/model/presets";
import { getPresetSpec } from "../sim/modelspec/presets";
import { advance, progress, STEP_HOLD_MS, STEP_TWEEN_MS } from "./progress";
import { resetPlaybackStore, usePlayback } from "./store";

const timeline = buildHardwareTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset(), { chapterId: "t" });
const META = { buildMs: 1, transferMs: 0, cached: false };
const S = () => usePlayback.getState();
const LAST = timeline.steps.length - 1;

beforeEach(() => {
  resetPlaybackStore();
  S().load(timeline, META);
});

describe("progress（瞬态步内进度）", () => {
  it("载入后从 t=0 开始，prevStepIndex 为 -1；advance 线性推进到 1 后不再变化", () => {
    expect(progress.stepIndex).toBe(0);
    expect(progress.prevStepIndex).toBe(-1);
    expect(progress.t).toBe(0);
    advance(STEP_TWEEN_MS / 2);
    expect(progress.t).toBeCloseTo(0.5);
    advance(STEP_TWEEN_MS);
    expect(progress.t).toBe(1);
    advance(10_000);
    expect(progress.t).toBe(1);
    expect(S().stepIndex).toBe(0);
  });
  it("暂停时换步仍然会重新过渡，但不会自动前进", () => {
    S().next();
    expect(progress.stepIndex).toBe(1);
    expect(progress.prevStepIndex).toBe(0);
    expect(progress.t).toBe(0);
    advance(STEP_TWEEN_MS * 3);
    expect(progress.t).toBe(1);
    expect(S().stepIndex).toBe(1);
  });
  it("播放时：过渡 → 停留 → next；倍速按比例缩短", () => {
    S().play();
    advance(STEP_TWEEN_MS);
    expect(progress.t).toBe(1);
    advance(STEP_HOLD_MS - 1);
    expect(S().stepIndex).toBe(0);
    advance(1);
    expect(S().stepIndex).toBe(1);
    expect(progress.t).toBe(0);
    S().setSpeed(2);
    advance(STEP_TWEEN_MS / 2);
    expect(progress.t).toBe(1);
    advance(STEP_HOLD_MS / 2);
    expect(S().stepIndex).toBe(2);
  });
  it("无动效（nofx 或 reduced-motion）时 t 直接 1，播放只在停留后换步", () => {
    S().setNofx(true);
    S().seek(3);
    expect(progress.t).toBe(1);
    S().setNofx(false);
    S().setReducedMotion(true);
    S().seek(4);
    expect(progress.t).toBe(1);
    S().play();
    advance(STEP_HOLD_MS);
    expect(S().stepIndex).toBe(5);
    expect(progress.t).toBe(1);
  });
  it("动效开关在过渡中途打开时，下一帧直接补到 1", () => {
    advance(STEP_TWEEN_MS / 4);
    expect(progress.t).toBeCloseTo(0.25);
    S().setNofx(true);
    advance(1);
    expect(progress.t).toBe(1);
  });
  it("末步停留结束后自动暂停，停在末步", () => {
    S().last();
    S().play();
    expect(S().stepIndex).toBe(0);
    S().seek(LAST);
    advance(STEP_TWEEN_MS);
    expect(progress.t).toBe(1);
    expect(S().playing).toBe(true);
    advance(STEP_HOLD_MS);
    expect(S().stepIndex).toBe(LAST);
    expect(S().playing).toBe(false);
  });
  it("非法 dt（0、负数、NaN）与无时间线时不推进", () => {
    advance(0);
    advance(-5);
    advance(Number.NaN);
    expect(progress.t).toBe(0);
    resetPlaybackStore();
    advance(1000);
    expect(progress.t).toBe(0);
  });
});
