import { describe, expect, it } from "vitest";
import {
  ASPECT_KNEE,
  displayAspect,
  fmtAspect,
  fmtCell,
  focusCenter,
  MASK_SENTINEL,
  planeSize,
  rectUv,
  robustScale,
  sampleAxis,
  windowRect,
} from "./scale";

describe("displayAspect", () => {
  it("方阵不变", () => {
    expect(displayAspect(6, 6)).toBe(1);
    expect(displayAspect(1024, 1024)).toBe(1);
  });

  it("压缩极扁比例但保持单调：越扁显示越扁，永不并成同一值", () => {
    const a1024 = displayAspect(6, 1024); // 真实 170:1
    const a2048 = displayAspect(6, 2048); // 真实 341:1
    const a3072 = displayAspect(6, 3072); // 真实 512:1
    expect(a1024).toBeLessThan(a2048);
    expect(a2048).toBeLessThan(a3072);
    // 压缩后仍远小于真实比例，但差别可见（>10%）
    expect(a1024).toBeLessThan(30);
    expect(a3072 / a1024).toBeGreaterThan(1.1);
  });

  it("拐点前后连续", () => {
    const rowsForAspect = (a: number) => displayAspect(1, a);
    const knee = ASPECT_KNEE ** (1 / 0.75); // 显示比恰为拐点时的真实比
    expect(rowsForAspect(knee)).toBeCloseTo(ASPECT_KNEE, 6);
    expect(rowsForAspect(knee * 1.001)).toBeGreaterThan(ASPECT_KNEE);
    expect(rowsForAspect(knee * 0.999)).toBeLessThan(ASPECT_KNEE);
  });

  it("高瘦张量对称压缩", () => {
    expect(displayAspect(1024, 6)).toBeCloseTo(1 / displayAspect(6, 1024), 10);
  });

  it("退化输入不炸", () => {
    expect(displayAspect(0, 5)).toBe(1);
    expect(displayAspect(5, 0)).toBe(1);
  });
});

describe("planeSize", () => {
  const box = { maxW: 9, maxH: 4.5 };

  it("激活是极扁的带，权重是大块", () => {
    const act = planeSize(6, 1024, box);
    const w = planeSize(1024, 3072, box);
    expect(act.w).toBe(9);
    expect(act.h).toBeLessThan(1);
    expect(w.h).toBeGreaterThan(3);
    expect(w.h / act.h).toBeGreaterThan(5);
  });

  it("不超出包围盒，且标出被压缩", () => {
    for (const [r, c] of [
      [6, 1024],
      [1024, 3072],
      [151936, 1024],
      [6, 6],
      [16, 6],
    ] as const) {
      const s = planeSize(r, c, box);
      expect(s.w).toBeLessThanOrEqual(box.maxW + 1e-9);
      expect(s.h).toBeLessThanOrEqual(box.maxH + 1e-9);
      expect(s.w).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(s.h).toBeGreaterThanOrEqual(0.4 - 1e-9);
    }
    expect(planeSize(6, 1024, box).compressed).toBe(true);
    expect(planeSize(6, 6, box).compressed).toBe(false);
    expect(planeSize(6, 1024, box).trueAspect).toBeCloseTo(170.67, 2);
  });

  it("词表这类高瘦张量顶到高度上限", () => {
    const s = planeSize(151936, 1024, box);
    expect(s.h).toBeCloseTo(4.5, 6);
    expect(s.w).toBeLessThan(1);
  });
});

describe("sampleAxis", () => {
  it("不超上限时逐格对应", () => {
    const s = sampleAxis(6, 1024);
    expect([s.count, s.exact]).toEqual([6, true]);
    expect(s.index(5)).toBe(5);
  });

  it("超上限时按 stride 均匀取样，覆盖首尾", () => {
    const s = sampleAxis(3072, 1024);
    expect([s.count, s.exact]).toEqual([1024, false]);
    expect(s.index(0)).toBe(0);
    expect(s.index(1023)).toBe(3069);
    for (let i = 1; i < s.count; i++) expect(s.index(i)).toBeGreaterThan(s.index(i - 1));
  });

  it("零长度轴退化成 1", () => {
    expect(sampleAxis(0, 16).count).toBe(1);
  });
});

describe("robustScale", () => {
  it("普通数据取分位数，接近最大值", () => {
    const data = Array.from({ length: 1000 }, (_, i) => (i % 2 ? 1 : -1) * (i / 1000));
    const s = robustScale((i) => data[i] ?? 0, data.length);
    expect(s.hasMask).toBe(false);
    expect(s.scale).toBeGreaterThan(0.9);
    expect(s.scale).toBeLessThanOrEqual(1);
  });

  it("掩码哨兵不参与色阶（这是 L0.attn.masked 全黑的根因）", () => {
    // 36 格里 15 格是 −1e30，其余在 ±3 之间
    const data = Array.from({ length: 36 }, (_, i) => (i % 2 ? -1e30 : ((i % 7) - 3) * 1));
    const s = robustScale((i) => data[i] ?? 0, data.length);
    expect(s.hasMask).toBe(true);
    expect(s.scale).toBeLessThan(10);
    expect(s.scale).toBeGreaterThan(0);
  });

  it("全是哨兵时退化为 1", () => {
    const s = robustScale(() => -1e30, 10);
    expect(s).toMatchObject({ scale: 1, hasMask: true, samples: 0 });
  });

  it("全零数据不返回 0 色阶", () => {
    expect(robustScale(() => 0, 10).scale).toBe(1);
  });

  it("大数组按步长抽样，不遍历全部", () => {
    let reads = 0;
    robustScale(() => {
      reads++;
      return 1;
    }, 1_000_000);
    expect(reads).toBeLessThanOrEqual(4096);
  });
});

describe("windowRect", () => {
  const view = { rows: 6, cols: 1024 };

  it("以高亮行列为中心", () => {
    const r = windowRect(view, { rows: [3], cols: [500] }, { rows: 4, cols: 16 });
    expect(r.rows).toBe(4);
    expect(r.cols).toBe(16);
    expect(r.r0).toBe(2);
    expect(r.c0).toBe(493);
  });

  it("分散的多行高亮对准第一行，而不是均值处", () => {
    const vocab = { rows: 151936, cols: 1024 };
    const r = windowRect(vocab, { rows: [26288, 104949, 113272] }, { rows: 6, cols: 12 });
    expect(r.r0).toBeLessThanOrEqual(26288);
    expect(r.r0 + r.rows).toBeGreaterThan(26288);
  });

  it("贴边时夹回范围内", () => {
    expect(windowRect(view, { rows: [0], cols: [0] }, { rows: 4, cols: 16 })).toMatchObject({
      r0: 0,
      c0: 0,
    });
    expect(windowRect(view, { rows: [5], cols: [1023] }, { rows: 4, cols: 16 })).toMatchObject({
      r0: 2,
      c0: 1008,
    });
  });

  it("窗口比张量大时缩到张量大小", () => {
    expect(windowRect({ rows: 6, cols: 6 }, undefined, { rows: 8, cols: 16 })).toEqual({
      r0: 0,
      c0: 0,
      rows: 6,
      cols: 6,
    });
  });

  it("cells 高亮取第一格；无高亮取左上角", () => {
    expect(
      focusCenter({
        cells: [
          [0, 2],
          [2, 4],
        ],
      }),
    ).toEqual({ r: 0, c: 2 });
    expect(focusCenter(undefined)).toEqual({ r: 0, c: 0 });
  });

  it("归一化取景框在 0..1 内", () => {
    const rect = windowRect(view, { rows: [3], cols: [500] }, { rows: 4, cols: 16 });
    const uv = rectUv(rect, view);
    for (const v of uv) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of uv) expect(v).toBeLessThanOrEqual(1);
    expect(uv[2]).toBeGreaterThan(uv[0]);
    expect(uv[3]).toBeGreaterThan(uv[1]);
  });
});

describe("文案", () => {
  it("格值", () => {
    expect(fmtCell(0)).toBe("0");
    expect(fmtCell(1.234)).toBe("1.23");
    expect(fmtCell(12.34)).toBe("12.3");
    expect(fmtCell(-1e30)).toBe("−∞");
    expect(fmtCell(Math.fround(-1e30))).toBe("−∞");
    expect(fmtCell(0.00001)).toBe("1.0e-5");
    expect(fmtCell(Number.NaN)).toBe("—");
    expect(Math.abs(-1e30)).toBeGreaterThan(MASK_SENTINEL);
  });

  it("真实比例", () => {
    expect(fmtAspect(512)).toBe("512:1");
    expect(fmtAspect(3)).toBe("3.0:1");
    expect(fmtAspect(1 / 148.4)).toBe("1:148.4");
  });
});
