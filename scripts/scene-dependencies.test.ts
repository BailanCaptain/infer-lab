import * as T from "three";
import { describe, expect, it } from "vitest";
import {
  FFN,
  matmulOutputState,
  matmulProgress,
  matmulTimeline,
  SWIGLU_DOWN_SUMS,
  swigluTimeline,
} from "../src/app/wiki/scene-compute-data";
import { createExpertAssembly, expertLayout } from "../src/app/wiki/scene-expert-assembly";
import { expertTransferPaths, positionExpertPacket } from "../src/app/wiki/scene-expert-transfer";

describe("a dot product writes one cell, then advances its input row", () => {
  const written = (p: number) => {
    const t = matmulTimeline(p);
    return Array.from({ length: 12 }, (_, n) => ({
      at: [Math.floor(n / 4), n % 4],
      ...matmulOutputState(t, Math.floor(n / 4), n % 4),
    })).filter((cell) => cell.reveal > 0);
  };
  it("first-row dot first-column writes only Y[0,0], then the second row supplies its own values", () => {
    expect(written(0.22).map(({ at, value }) => ({ at, value }))).toEqual([{ at: [0, 0], value: 8 }]);
    expect(written(0.44).map(({ at }) => at)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    expect(matmulTimeline(0.52).row).toBe(1);
    expect(
      written(0.52)
        .map(({ at, value }) => ({ at, value }))
        .at(-1),
    ).toEqual({ at: [1, 0], value: 5 });
    expect(written(1).map(({ value }) => value)).toEqual([8, 6, 5, 7, 5, 2, 2, 3, 2, 7, 2, 5]);
    expect(written(0)).toEqual([]);
  });
  it("visits all twelve outputs in row order rather than filling three rows at once", () => {
    const seen = new Set<string>();
    for (let n = 0; n <= 1000; n++) {
      const t = matmulTimeline(n / 1000);
      seen.add(`${t.row},${t.column}`);
    }
    expect([...seen]).toEqual([
      "0,0",
      "0,1",
      "0,2",
      "0,3",
      "1,0",
      "1,1",
      "1,2",
      "1,3",
      "2,0",
      "2,1",
      "2,2",
      "2,3",
    ]);
  });
  it("selecting any cell seeks the shared clock and resumes with the next input/weight pair", () => {
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 4; column++) {
        for (const local of [0, 0.3, 0.8, 1]) {
          const selected = matmulTimeline(matmulProgress(row, column, local));
          expect([selected.row, selected.column]).toEqual([row, column]);
          expect(selected.local).toBeCloseTo(local, 5);
        }
        if (row * 4 + column < 11) {
          const after = matmulTimeline(matmulProgress(row, column, 1) + 0.001);
          expect(after.index).toBe(row * 4 + column + 1);
          expect([after.row, after.column]).toEqual([Math.floor(after.index / 4), after.index % 4]);
        }
      }
  });
});

describe("SwiGLU waits for the operands that each operation needs", () => {
  it("keeps channelwise gating separate from the subsequent weighted sum", () => {
    FFN.product.forEach((value, j) => {
      expect(Number((FFN.silu[j]! * FFN.up[j]!).toFixed(2))).toBe(value);
    });
    expect(FFN.product[0]!).toBeGreaterThan(FFN.up[0]!);
    expect(Math.abs(FFN.product[1]!)).toBeLessThan(FFN.up[1]! / 10);
    expect(FFN.product[1]!).toBeLessThan(0);
    expect(SWIGLU_DOWN_SUMS).toEqual([
      [0, 3.73, 3.66, 3.72, 3.73, 3.73, 3.44],
      [0, 0, -0.07, -0.13, -0.14, -1.13, -1.13],
      [0, 3.73, 3.73, 3.67, 3.68, 4.67, 4.38],
      [0, -3.73, -3.8, -3.8, -3.79, -4.78, -4.49],
    ]);
  });
  it("forms both projection terms before summing, then transforms, pairs, and sums down contributions", () => {
    for (let n = 0; n <= 1000; n++) {
      const t = swigluTimeline(n / 1000);
      if (t.silu > 0) expect(t.gateReady && t.upReady).toBe(true);
      if (t.pair > 0) expect(t.silu).toBe(1);
      if (t.operation === "down") expect(t.pair).toBe(1);
      if (t.reductions.some((at) => at > 0)) expect(t.arrivals.every((at) => at === 1)).toBe(true);
      expect(t.reductions.filter((at) => at > 0 && at < 1).length).toBeLessThanOrEqual(1);
    }
    expect(swigluTimeline(1).downSum).toBe(1);
    expect(swigluTimeline(0).downSum).toBe(0);
    expect(swigluTimeline(0).arrivals).toEqual([0, 0, 0, 0]);
  });
});

describe("EP packets follow the same connected curves used for their lines", () => {
  it("keeps all six visible cells on the curved return path, including its ends", () => {
    const paths = expertTransferPaths(
      new T.Vector3(),
      new T.Vector3(2, 0, 0),
      new T.Vector3(2, 0.2, 0),
      new T.Vector3(0, 1, 1),
      new T.Vector3(0, 1, 0),
      2,
    );
    const packet = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.1, 0.16), new T.MeshBasicMaterial(), 6);
    const points = paths.flatMap((curve) =>
        Array.from({ length: 5001 }, (_, i) => curve.getPointAt(i / 5000)),
      ),
      matrix = new T.Matrix4();
    for (const at of [0, 0.2, 0.5, 0.8, 1]) {
      positionExpertPacket(packet, paths, 3, at);
      for (let i = 0; i < 6; i++) {
        packet.getMatrixAt(i, matrix);
        const center = new T.Vector3().setFromMatrixPosition(matrix);
        expect(Math.min(...points.map((point) => point.distanceTo(center)))).toBeLessThan(0.002);
      }
    }
    positionExpertPacket(packet, paths, 3, 1);
    packet.getMatrixAt(0, matrix);
    const head = new T.Vector3().setFromMatrixPosition(matrix);
    packet.getMatrixAt(5, matrix);
    expect(head.distanceTo(new T.Vector3().setFromMatrixPosition(matrix))).toBeGreaterThan(0.6);
    for (let phase = 1; phase < 4; phase++) {
      positionExpertPacket(packet, paths, phase, 1);
      const before = Array.from({ length: 6 }, (_, i) => {
        packet.getMatrixAt(i, matrix);
        return new T.Vector3().setFromMatrixPosition(matrix);
      });
      positionExpertPacket(packet, paths, phase + 1, 0);
      before.forEach((point, i) => {
        packet.getMatrixAt(i, matrix);
        expect(point.distanceTo(new T.Vector3().setFromMatrixPosition(matrix))).toBeLessThan(1e-6);
      });
    }
    packet.geometry.dispose();
    packet.material.dispose();
    packet.dispose();
  });
  it("connects each expert port to the actual fixed weight plate edge", () => {
    const assembly = createExpertAssembly({
      board: "#aaa",
      result: "#4a9",
      weight: "#49a",
      weightSoft: "#abc",
    });
    assembly.update(new Set(), 0, 0);
    const matrix = new T.Matrix4();
    for (let slot = 0; slot < 18; slot++) {
      const ports = expertLayout(slot);
      assembly.mesh.getMatrixAt(slot * 4 + 1, matrix);
      expect(ports.input.distanceTo(new T.Vector3(0, 0, -0.5).applyMatrix4(matrix))).toBeLessThan(1e-6);
      assembly.mesh.getMatrixAt(slot * 4 + 3, matrix);
      expect(ports.down.distanceTo(new T.Vector3(0, 0, 0.5).applyMatrix4(matrix))).toBeLessThan(1e-6);
    }
    assembly.dispose();
  });
  it("delivers every cell at combine, including local experts and reverse seeks", () => {
    const packet = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.1, 0.16), new T.MeshBasicMaterial(), 6);
    const matrix = new T.Matrix4();
    for (const offset of [0, 1, 7, 15]) {
      const source = new T.Vector3(0, 1, 0),
        result = new T.Vector3(0, 1.1, 0);
      const paths = expertTransferPaths(
        source,
        new T.Vector3(offset, 0.7, -0.16),
        new T.Vector3(offset, 0.9, 0.21),
        new T.Vector3(0, 1.2, 0.8),
        result,
        0.5,
      );
      for (const [phase, local] of [
        [4, 1],
        [3, 0.5],
        [2, 0],
        [1, 0],
      ]) {
        positionExpertPacket(packet, paths, phase!, local!);
        for (let i = 0; i < 6; i++) {
          packet.getMatrixAt(i, matrix);
          const position = new T.Vector3().setFromMatrixPosition(matrix);
          expect(position.toArray().every(Number.isFinite)).toBe(true);
          if (phase === 4)
            expect(
              position.distanceTo(result.clone().add(new T.Vector3((2.5 - i) * 0.145, 0, 0))),
            ).toBeLessThan(1e-6);
          if (phase === 1) expect(position.distanceTo(source)).toBeLessThan(1e-6);
        }
      }
    }
    packet.geometry.dispose();
    packet.material.dispose();
    packet.dispose();
  });
});
