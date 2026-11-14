/// <reference lib="dom" />
import * as T from "three";
import { afterEach, expect, test, vi } from "vitest";
import { createMatrixMesh } from "../src/app/wiki/scene-matrix-mesh";

afterEach(() => vi.unstubAllGlobals());

test("calculation writes cells in order, lifts the active cell, and rewinds to empty slots", () => {
  vi.stubGlobal("document", { createElement: () => ({ dataset: {}, remove() {} }) });
  const m = createMatrixMesh(new T.Group(), { append() {} } as unknown as HTMLElement, 2, 2, "#b97740", {
    result: "#427b61",
    paper: "#eef1e9",
  });
  const transform = new T.Matrix4(),
    color = new T.Color();
  m.write(
    [
      [1, 2],
      [3, 4],
    ],
    [],
    "",
    { result: true, written: 0.375 },
  );
  m.mesh.getMatrixAt(1, transform);
  expect(transform.elements[13]).toBeGreaterThan(0.1);
  m.mesh.getColorAt(3, color);
  expect(color.getHexString()).not.toBe(new T.Color("#427b61").getHexString());
  m.write(
    [
      [1, 2],
      [3, 4],
    ],
    [],
    "",
    { result: true, written: 1 },
  );
  m.mesh.getMatrixAt(1, transform);
  expect(transform.elements[13]).toBeCloseTo(0);
  m.mesh.getColorAt(3, color);
  expect(color.getHexString()).toBe(new T.Color("#427b61").getHexString());
  m.write(
    [
      [1, 2],
      [3, 4],
    ],
    [],
    "",
    { result: true, written: 0 },
  );
  m.mesh.getColorAt(0, color);
  expect(color.getHexString()).not.toBe(new T.Color("#427b61").getHexString());
  m.dispose();
  m.mesh.geometry.dispose();
  m.mesh.material.dispose();
});

test("moving matrix labels project from geometry without forcing DOM layout", () => {
  const nodes: HTMLElement[] = [];
  const measure = vi.fn(() => ({ left: 0, top: 0, width: 100, height: 20 }));
  vi.stubGlobal("document", {
    createElement: () => ({
      dataset: {},
      style: {},
      remove() {},
      getBoundingClientRect: measure,
      get offsetWidth() {
        measure();
        return 100;
      },
      get offsetHeight() {
        measure();
        return 20;
      },
    }),
  });
  const overlay = {
    append(node: HTMLElement) {
      nodes.push(node);
    },
    getBoundingClientRect: measure,
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  const m = createMatrixMesh(new T.Group(), overlay, 2, 2, "#577692", {
    result: "#427b61",
    paper: "#eef1e9",
  });
  const camera = new T.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.z = 10;
  camera.updateMatrixWorld();
  m.group.rotation.x = Math.PI / 2;
  m.write(
    [
      [1, 2],
      [3, 4],
    ],
    ["甲", "乙"],
    "完整矩阵",
  );
  m.renderLabels(camera, 800, 600);
  const before = Number.parseFloat(nodes[0]!.style.left);
  m.group.position.x = 1;
  m.renderLabels(camera, 800, 600);
  expect(Number.parseFloat(nodes[0]!.style.left) - before).toBeCloseTo(80);
  expect(measure).not.toHaveBeenCalled();
  m.dispose();
  m.mesh.geometry.dispose();
  m.mesh.material.dispose();
});

test("matrix instance colors retain the palette instead of multiplying it twice", () => {
  vi.stubGlobal("document", { createElement: () => ({ dataset: {}, remove() {} }) });
  const overlay = { append() {} } as unknown as HTMLElement;
  for (const color of ["#577692", "#b97740", "#427b61"]) {
    const palette = { result: "#427b61", paper: "#eef1e9" };
    const m = createMatrixMesh(new T.Group(), overlay, 1, 1, color, palette);
    m.write([[1]], [], "");
    const actual = new T.Color();
    m.mesh.getColorAt(0, actual);
    actual.multiply(m.mesh.material.color);
    expect(actual.getHexString()).toBe(new T.Color(color).getHexString());
    m.write([[2]], [], "", { result: true });
    m.mesh.getColorAt(0, actual);
    expect(actual.getHexString()).toBe(new T.Color(palette.result).getHexString());
    m.write([[1]], [], "", { color: "#b97740" });
    m.mesh.getColorAt(0, actual);
    expect(actual.getHexString()).toBe(new T.Color("#b97740").getHexString());
    m.dispose();
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
  }
});
