import { describe, expect, it } from "vitest";
import { opacityAt, parseFade, parseKeys, pointAt, shownAt } from "./animTimeline";
import { controlState, ease, focusAfter, parseRoute, pointAlong, resumeFrom } from "./DiagramPlayer";

describe("分镜播放器的路线", () => {
  it("读出渲染器写的 M / L 折线", () => {
    expect(parseRoute("M52 95 L100.5 95 L100.5 -20 L300 40")).toEqual([
      { x: 52, y: 95 },
      { x: 100.5, y: 95 },
      { x: 100.5, y: -20 },
      { x: 300, y: 40 },
    ]);
  });

  it("按总长度取点：起点是源块、终点是目的块，中途按长度比例落在对应的那一段上", () => {
    const route = parseRoute("M0 0 L100 0 L100 300");
    expect(pointAlong(route, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(route, 1)).toEqual({ x: 100, y: 300 });
    // 总长 400：走 1/8 是第一段中点，走一半已经拐进第二段 100
    expect(pointAlong(route, 0.125)).toEqual({ x: 50, y: 0 });
    expect(pointAlong(route, 0.5)).toEqual({ x: 100, y: 100 });
    expect(pointAlong(route, 2)).toEqual({ x: 100, y: 300 });
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 });
  });

  it("缓动两头停稳、中间对称", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25) + ease(0.75)).toBeCloseTo(1);
  });
});

describe("分镜播放器的关键帧（逐张卡演）", () => {
  it("data-keys 每个折点一个时刻，「-」是中间点；个数不对、头尾是「-」、时刻倒退都不认", () => {
    expect(parseKeys("0 - 0.5 0.8", 4)).toEqual([0, null, 0.5, 0.8]);
    expect(parseKeys("0 0.5", 3)).toBeNull();
    expect(parseKeys("- 0.5", 2)).toBeNull();
    expect(parseKeys("0 -", 2)).toBeNull();
    expect(parseKeys("0.5 0.2", 2)).toBeNull();
    expect(parseKeys(null, 2)).toBeNull();
  });

  it("两个关键点之间整段缓动，中间点按长度分；关键点之前停在起点、之后停在终点；两个关键点同一处就是停住", () => {
    const route = parseRoute("M0 0 L100 0 L100 300");
    const keys = [0.2, null, 0.6];
    expect(pointAt(route, keys, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(route, keys, 0.2)).toEqual({ x: 0, y: 0 });
    // 窗口正中：缓动后走一半，总长 400 的一半落在第二段 100 处
    const mid = pointAt(route, keys, 0.4);
    expect(mid.x).toBeCloseTo(100);
    expect(mid.y).toBeCloseTo(100);
    expect(pointAt(route, keys, 0.9)).toEqual({ x: 100, y: 300 });
    const hold = parseRoute("M0 0 L10 0 L10 0 L10 10");
    const hk = [0, 0.5, 0.7, 1];
    expect(pointAt(hold, hk, 0.6)).toEqual({ x: 10, y: 0 });
    expect(pointAt(hold, hk, 0.85)).toEqual({ x: 10, y: 5 });
  });

  it("data-show / data-hide 决定这一刻看不看得见", () => {
    expect(shownAt(0.2, 0.5, 0.1)).toBe(false);
    expect(shownAt(0.2, 0.5, 0.2)).toBe(true);
    expect(shownAt(0.2, 0.5, 0.49)).toBe(true);
    expect(shownAt(0.2, 0.5, 0.5)).toBe(false);
    expect(shownAt(null, null, 0.7)).toBe(true);
  });

  it("data-fade 从 a 到 b 由不透明淡到透明（并进目的块时淡掉，不在那里摞成一叠）；看不见时总是 0", () => {
    expect(parseFade("0.4 0.5")).toEqual([0.4, 0.5]);
    expect(parseFade("0.5 0.4")).toBeNull();
    expect(parseFade("0.5")).toBeNull();
    expect(parseFade(null)).toBeNull();
    const fade: [number, number] = [0.4, 0.5];
    expect(opacityAt(0.1, 0.5, fade, 0.3)).toBe(1);
    expect(opacityAt(0.1, 0.5, fade, 0.45)).toBeCloseTo(0.5);
    expect(opacityAt(0.1, 0.5, fade, 0.5)).toBe(0);
    expect(opacityAt(0.1, 0.5, fade, 0.05)).toBe(0);
    expect(opacityAt(0.1, null, null, 0.9)).toBe(1);
  });
});

describe("分镜播放器的按钮与接着播", () => {
  it("飞行中「下一步」只标 aria-disabled 不真禁用，键盘焦点留在按钮上；走到最后一格才禁用", () => {
    expect(controlState(2, 6, true, false)).toMatchObject({ nextDisabled: false, nextBusy: true });
    expect(controlState(2, 6, false, false)).toMatchObject({
      nextDisabled: false,
      nextBusy: false,
      primary: "播放",
    });
    expect(controlState(6, 6, false, false)).toMatchObject({
      nextDisabled: true,
      nextBusy: false,
      primary: "从头播放",
    });
    expect(controlState(0, 6, false, true)).toMatchObject({ prevDisabled: true, primary: "暂停" });
  });

  it("按「下一步」走到最后一格、按「上一步」退到第一格时，焦点交给主按钮", () => {
    expect(focusAfter("next", 6, 6)).toBe("primary");
    expect(focusAfter("next", 3, 6)).toBeNull();
    expect(focusAfter("prev", 0, 6)).toBe("primary");
    expect(focusAfter("prev", 2, 6)).toBeNull();
    expect(focusAfter(null, 6, 6)).toBeNull();
  });

  it("重新挂载不到 1 秒接着上次（含没飞完的一步）；换页再回来、图的格数变了都从头", () => {
    const saved = { step: 3, playing: false, flying: true, bands: 7, leftAt: 1000 };
    expect(resumeFrom(saved, 7, 1005)).toEqual(saved);
    expect(resumeFrom(saved, 7, 5000)).toBeUndefined();
    expect(resumeFrom(saved, 5, 1005)).toBeUndefined();
    expect(resumeFrom(undefined, 7, 0)).toBeUndefined();
    expect(resumeFrom({ ...saved, leftAt: null }, 7, 99999)).toEqual({ ...saved, leftAt: null });
  });
});
