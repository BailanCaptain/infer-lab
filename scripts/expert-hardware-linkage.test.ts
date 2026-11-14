import * as T from "three";
import { expect, test } from "vitest";
import { createExpertAssembly } from "../src/app/wiki/scene-expert-assembly";

test("only selected expert weights unfold during compute, remain weights, and rewind exactly", () => {
  const palette = { board: "#a2b8ad", weight: "#577692", weightSoft: "#9ab0c3", result: "#427b61" };
  const expert = createExpertAssembly(palette),
    before = new T.Matrix4(),
    during = new T.Matrix4();
  expert.update(new Set([0, 1]), 1, 1);
  expert.mesh.getMatrixAt(1, before);
  expert.update(new Set([0, 1]), 2, 0.35, -2);
  expert.mesh.getMatrixAt(1, during);
  expect(during.elements[13]).toBeGreaterThan(before.elements[13]!);
  expert.mesh.getMatrixAt(2 * 4 + 1, during);
  expect(during.elements[13]).toBeCloseTo(before.elements[13]!);
  const color = new T.Color();
  expert.mesh.getColorAt(1, color);
  expect(color.getHexString()).not.toBe(new T.Color(palette.result).getHexString());
  expert.update(new Set([0, 1]), 1, 1);
  expert.mesh.getMatrixAt(1, during);
  expect(during.elements).toEqual(before.elements);
  expert.dispose();
});
