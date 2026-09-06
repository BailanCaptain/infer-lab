import { beforeEach, describe, expect, it } from "vitest";
import { buildHardwareTimeline } from "../sim/buildTimeline";
import { getTokenPreset } from "../sim/model/presets";
import { getPresetSpec } from "../sim/modelspec/presets";
import { resetPlaybackStore, SPEED_MAX, SPEED_MIN, selectNoMotion, selectStep, usePlayback } from "./store";

const timeline = buildHardwareTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset(), { chapterId: "t" });
const META = { buildMs: 1, transferMs: 0, cached: false };
const S = () => usePlayback.getState();
const LAST = timeline.steps.length - 1;

beforeEach(() => resetPlaybackStore());

describe("playback store", () => {
  it("初始为 idle；没有时间线时播放/步进都是空操作", () => {
    expect(S().status).toBe("idle");
    S().play();
    S().next();
    expect(S().playing).toBe(false);
    expect(S().stepIndex).toBe(0);
    expect(S().seek("L0.ln1")).toBe(false);
  });
  it("load 后 ready、停在第 0 步、不自动播放；selectStep 给出当前步", () => {
    S().setLoading();
    expect(S().status).toBe("loading");
    S().load(timeline, META);
    expect(S().status).toBe("ready");
    expect(S().stepIndex).toBe(0);
    expect(S().playing).toBe(false);
    expect(selectStep(S())?.id).toBe("embed.gather");
    expect(S().loadMeta).toEqual(META);
  });
  it("next/prev/first/last 在边界处夹住；末步 next 会自动暂停", () => {
    S().load(timeline, META);
    S().prev();
    expect(S().stepIndex).toBe(0);
    S().next();
    expect(S().stepIndex).toBe(1);
    S().last();
    expect(S().stepIndex).toBe(LAST);
    S().next();
    expect(S().stepIndex).toBe(LAST);
    S().play();
    expect(S().stepIndex).toBe(0);
    S().seek(LAST);
    S().next();
    expect(S().stepIndex).toBe(LAST);
    expect(S().playing).toBe(false);
    S().first();
    expect(S().stepIndex).toBe(0);
  });
  it("seek 支持序号与 step id；未知 id / 非整数返回 false 且不改状态", () => {
    S().load(timeline, META);
    expect(S().seek("L0.attn.softmax")).toBe(true);
    expect(selectStep(S())?.id).toBe("L0.attn.softmax");
    expect(S().seek("nope")).toBe(false);
    expect(selectStep(S())?.id).toBe("L0.attn.softmax");
    expect(S().seek(1.5)).toBe(false);
    expect(S().seek(999)).toBe(true);
    expect(S().stepIndex).toBe(LAST);
    expect(S().seek(-3)).toBe(true);
    expect(S().stepIndex).toBe(0);
  });
  it("在末步 play 会从头开始；toggle 往返", () => {
    S().load(timeline, META);
    S().last();
    S().play();
    expect(S().playing).toBe(true);
    expect(S().stepIndex).toBe(0);
    S().toggle();
    expect(S().playing).toBe(false);
    S().toggle();
    expect(S().playing).toBe(true);
  });
  it("倍速夹在 [0.25, 4]，stepSpeed 沿档位走", () => {
    S().setSpeed(100);
    expect(S().speed).toBe(SPEED_MAX);
    S().setSpeed(0);
    expect(S().speed).toBe(SPEED_MIN);
    S().setSpeed(Number.NaN);
    expect(S().speed).toBe(1);
    S().stepSpeed(1);
    expect(S().speed).toBe(2);
    S().stepSpeed(1);
    S().stepSpeed(1);
    expect(S().speed).toBe(4);
    S().setSpeed(0.3);
    S().stepSpeed(-1);
    expect(S().speed).toBe(0.25);
  });
  it("reduced-motion 与 nofx 任一为真即无动效；resetCamera 递增序号并清除接管", () => {
    expect(selectNoMotion(S())).toBe(false);
    S().setNofx(true);
    expect(selectNoMotion(S())).toBe(true);
    S().setNofx(false);
    S().setReducedMotion(true);
    expect(selectNoMotion(S())).toBe(true);
    S().setCameraOverride(true);
    S().resetCamera();
    expect(S().userCameraOverride).toBe(false);
    expect(S().cameraResetSeq).toBe(1);
  });
  it("unload 保留倍速/层/nofx，清掉时间线", () => {
    S().load(timeline, META);
    S().setSpeed(2);
    S().setLayer("hardware");
    S().setNofx(true);
    S().unload();
    expect(S().timeline).toBeNull();
    expect(S().status).toBe("idle");
    expect(S().speed).toBe(2);
    expect(S().layer).toBe("hardware");
    expect(S().nofx).toBe(true);
  });
});
