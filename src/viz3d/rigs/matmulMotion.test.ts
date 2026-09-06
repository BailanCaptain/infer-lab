import { describe, expect, it } from "vitest";
import {
  type MatmulMotionInput,
  matmulMotion,
  PHASES,
  phaseOf,
  SHOW_HEAD,
  SHOW_TAIL,
  sampleK,
} from "./matmulMotion";

const input: MatmulMotionInput = {
  kIndex: sampleK(1024),
  aRow: [1, 2, 3, 4, 5, 6],
  bCol: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  sum: -0.3722,
  K: 1024,
  aRowStart: { x: -6, y: 0, z: 0 },
  bColStart: { x: 0, y: 4, z: 0 },
  stage: { x: -3, y: 2, z: 0.5 },
  cTarget: { x: 0.2, y: -0.3, z: 0.1 },
  cell: 0.3,
};

describe("sampleK", () => {
  it("长 K 取首尾", () => {
    expect(sampleK(1024)).toEqual([0, 1, 2, 3, 1022, 1023]);
    expect(sampleK(1024)).toHaveLength(SHOW_HEAD + SHOW_TAIL);
  });
  it("短 K 全取", () => {
    expect(sampleK(5)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("phaseOf", () => {
  it("区间连续覆盖 0..1，顺序固定", () => {
    const names = Object.keys(PHASES);
    let prevEnd = 0;
    for (const n of names) {
      const [s, e] = PHASES[n as keyof typeof PHASES];
      expect(s).toBe(prevEnd);
      prevEnd = e;
    }
    expect(prevEnd).toBe(1);
    expect(phaseOf(0).phase).toBe("lift");
    expect(phaseOf(0.3).phase).toBe("multiply");
    expect(phaseOf(0.6).phase).toBe("collapse");
    expect(phaseOf(0.8).phase).toBe("write");
    expect(phaseOf(1).phase).toBe("sweep");
    expect(phaseOf(1).local).toBe(1);
  });
});

describe("matmulMotion", () => {
  it("t=0：A 行 B 列还在各自平面上，乘积不可见", () => {
    const m = matmulMotion(0, input);
    expect(m.phase).toBe("lift");
    for (const c of m.a) expect([c.x, c.y]).toEqual([input.aRowStart.x, input.aRowStart.y]);
    for (const c of m.b) expect([c.x, c.y]).toEqual([input.bColStart.x, input.bColStart.y]);
    for (const p of m.products) expect(p.scale).toBe(0);
    expect(m.sum.scale).toBe(0);
    expect(m.reveal).toBe(0);
  });

  it("lift 结束：A 行与 B 列在舞台上对齐（同 x，不同行）", () => {
    const m = matmulMotion(PHASES.lift[1], input);
    for (let i = 0; i < m.a.length; i++) {
      expect(m.a[i]!.x).toBeCloseTo(m.b[i]!.x, 6);
      expect(m.a[i]!.y).toBeGreaterThan(m.b[i]!.y);
    }
    // 首尾之间留了省略号的位置
    const gap = m.a[SHOW_HEAD]!.x - m.a[SHOW_HEAD - 1]!.x;
    expect(gap).toBeCloseTo(2 * input.cell, 6);
    expect(m.ellipsis.a.scale).toBeCloseTo(1, 6);
  });

  it("multiply：乘积依次冒出，值是 a_k·b_k", () => {
    const mid = (PHASES.multiply[0] + PHASES.multiply[1]) / 2;
    const m = matmulMotion(mid, input);
    expect(m.phase).toBe("multiply");
    expect(m.products[0]!.scale).toBeGreaterThan(m.products[m.products.length - 1]!.scale);
    m.products.forEach((p, i) => {
      expect(p.value).toBeCloseTo(input.aRow[i]! * input.bCol[i]!, 10);
    });
    const end = matmulMotion(PHASES.multiply[1] - 1e-6, input);
    for (const p of end.products) expect(p.scale).toBeCloseTo(1, 2);
  });

  it("collapse：乘积向舞台中心收拢，总和出现且等于真实 C[r,c]", () => {
    const end = matmulMotion(PHASES.collapse[1] - 1e-6, input);
    for (const p of end.products) expect(Math.abs(p.x - input.stage.x)).toBeLessThan(1e-3);
    expect(end.sum.scale).toBe(1);
    expect(end.sum.value).toBe(input.sum);
  });

  it("write：总和从舞台飞到 C[r,c]", () => {
    const start = matmulMotion(PHASES.write[0], input);
    const end = matmulMotion(PHASES.write[1] - 1e-6, input);
    expect(start.sum.x).toBeCloseTo(input.stage.x, 3);
    expect(end.sum.x).toBeCloseTo(input.cTarget.x, 2);
    expect(end.sum.y).toBeCloseTo(input.cTarget.y, 2);
  });

  it("sweep：C 行揭示比例从 0 到 1，舞台元素淡出", () => {
    const s0 = matmulMotion(PHASES.sweep[0], input);
    const s1 = matmulMotion(1, input);
    expect(s0.reveal).toBeCloseTo(0, 6);
    expect(s1.reveal).toBe(1);
    expect(s1.written).toBe(true);
    for (const c of s1.a) expect(c.scale).toBeCloseTo(0, 6);
    expect(s1.sum.scale).toBe(0);
  });

  it("任意 t 输出都是有限数", () => {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const m = matmulMotion(t, input);
      for (const c of [...m.a, ...m.b, ...m.products, m.sum]) {
        for (const v of [c.x, c.y, c.z, c.scale, c.value]) expect(Number.isFinite(v)).toBe(true);
        expect(c.scale).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
