import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectPart, type MatrixDemo } from "../src/app/course/matrix-parts";
import { createExpertAssembly } from "../src/app/wiki/scene-expert-assembly";
import { expertAssignments } from "../src/app/wiki/scene-playback";

const root = `${process.cwd()}/public/experiences/glm-flow/master/`;
const index = JSON.parse(readFileSync(`${root}demo/continuous/l00.json`, "utf8"));
const bytes = readFileSync(`${root}demo/continuous/l00.bin`);
const data = await import(pathToFileURL(`${root}demo-data.js`).href);
const demo: MatrixDemo = data.makeDemo(
  index.weights,
  index,
  new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
);

describe("native wiki computation reads one continuous teaching example", () => {
  it("Q's displayed output is the full dot product, not a made-up result", () => {
    let sum = 0;
    for (let j = 0; j < 4096; j++) sum += demo.at("x_attn", 0, j) * demo.weight("W_q", 0, j);
    expect(sum).toBeCloseTo(demo.at("Q", 0, 0), 4);
  });
  it("both projections, limiting, SiLU, product and down agree with stored tensors", () => {
    for (const channel of [0, 1, 127])
      for (const step of ["gate", "up", "multiply", "down"] as const) {
        const r = inspectPart(demo, "ffn", step, 0, channel, 1e-5, 10);
        expect(r.calculated).toBeCloseTo(r.stored, 3);
      }
  });
  it("EP keeps every expert weight in place throughout routing and computation", () => {
    const palette = { board: "#557788", result: "#557788", weightSoft: "#557788", weight: "#557788" };
    const assembly = createExpertAssembly(palette);
    const picked = new Set(
      expertAssignments(0)
        .filter((e) => e.rank === 0)
        .map((e) => e.slot),
    );
    assembly.update(picked, 0, 0);
    const before = Array.from(assembly.mesh.instanceMatrix.array);
    expect(assembly.mesh.count).toBe(18 * 4);
    for (let phase = 0; phase < 6; phase++) {
      assembly.update(picked, phase, 0.7);
      expect(Array.from(assembly.mesh.instanceMatrix.array)).toEqual(before);
    }
    assembly.dispose();
  });
});
