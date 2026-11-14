/// <reference lib="dom" />
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { makeChapterLayer, normalize } from "../src/app/course/chapter-layer";
import { layerBlock } from "../src/app/course/layer-layout";
import {
  inspectPart,
  layoutForPart,
  type MasterParts,
  type MatrixDemo,
  type PartArrow,
  type PartBlock,
  type PartTensor,
  pickPartCell,
  rmsColumn,
  wordFocus,
} from "../src/app/course/matrix-parts";
import { partPlayback, rmsProgress } from "../src/app/course/matrix-playback";
import { makeRmsAnimation } from "../src/app/course/matrix-rms-animation";

afterEach(() => vi.unstubAllGlobals());

test("new layer matrices retain native RMS aspect, depth, groups and column widths", () => {
  const native = source.layoutBlocks.get("collapsed_attn")!;
  const matrix = layerBlock(source, "x", "X", 6, 4096, 0, 0);
  const column = layerBlock(source, "column", "column", 1, 4096, 0, 0);
  const expanded = layerBlock(source, "expanded", "expanded", 6, 8192, 0, 0);
  const ratios = (b: PartBlock) => [(b.x1 - b.x0) / (b.y1 - b.y0), (b.z1 - b.z0) / (b.y1 - b.y0)];
  expect(ratios(matrix)).toEqual(ratios(native));
  expect(matrix.div).toEqual(native.div);
  expect(matrix.cut).toEqual(native.cut);
  expect(column.x1 - column.x0).toBeCloseTo((matrix.x1 - matrix.x0) / 6);
  expect(column.y1 - column.y0).toBe(matrix.y1 - matrix.y0);
  expect(column.z1 - column.z0).toBe(matrix.z1 - matrix.z0);
  expect(expanded.y1 - expanded.y0).toBe(2 * (matrix.y1 - matrix.y0));
  expect(expanded.div).toEqual([6, 32, 1]);
});

test("generic chapter continues the actual RMS data through both residual updates", () => {
  const layer = makeChapterLayer(source);
  expect([layer.count, layer.width]).toEqual([6, 4096]);
  const gamma = Float32Array.from({ length: 4096 }, (_, c) => source.demo.weight("gamma_attn", c));
  const calculated = normalize(layer.input, 6, gamma, source.epsilon).output;
  for (let i = 0; i < layer.input.length; i++) {
    expect(layer.norm1[i]).toBeCloseTo(calculated[i]!, 5);
    expect(layer.mid[i]).toBe(Math.fround(layer.input[i]! + layer.attention.delta[i]!));
    expect(layer.output[i]).toBe(Math.fround(layer.mid[i]! + layer.ffn.delta[i]!));
    expect(Number.isFinite(layer.output[i])).toBe(true);
  }
});

async function rmsMotion() {
  // Only the label DOM is stubbed; geometry and materials use the real master.
  const element = () => ({
    style: {},
    dataset: {},
    append() {},
    remove() {},
    setAttribute() {},
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    clientWidth: 760,
    clientHeight: 700,
  });
  vi.stubGlobal("document", { createElement: element });
  const { makeFlowLook } = await import(
    /* @vite-ignore */ pathToFileURL(resolve("public/experiences/glm-flow/master/flow-look.js")).href
  );
  const T = source.three;
  const scene = new T.Scene();
  const blocks = layoutForPart(source, "rms", "gate").blocks as [PartBlock, PartBlock, PartBlock];
  const look = makeFlowLook({ slabs: "touch" });
  const meshes = blocks.map((block) => look.addBlock(scene, block));
  const host = element() as unknown as HTMLDivElement;
  const animation = makeRmsAnimation({ ...source, makeFlowLook }, host, blocks, meshes, scene);
  const groups = scene.children.filter(
    (object): object is InstanceType<typeof T.InstancedMesh> => object instanceof T.InstancedMesh,
  );
  return { animation, groups, blocks, scene, T, host };
}

test("RMS hides calculation pieces at the start, including after seeking back", async () => {
  const { animation, scene, groups, blocks } = await rmsMotion();
  const originals = scene.children.filter((object) =>
    blocks.some((block) => block.id === object.userData.block?.id),
  );
  const arithmetic = scene.children.filter((object) => object.userData.block?.id?.startsWith("rms:operand-"));
  expect(arithmetic).toHaveLength(5);
  for (const position of [0, rmsProgress(0, 0.3), 0]) {
    const frame = animation.update(position, 5);
    if (position > 0) {
      expect(arithmetic.filter((object) => object.visible)).toHaveLength(2);
    } else {
      expect([...arithmetic, ...groups].every((object) => !object.visible)).toBe(true);
      expect(originals).toHaveLength(3);
      expect(originals.every((object) => object.visible)).toBe(true);
      expect(frame.description).toContain("点击播放");
    }
  }
  animation.dispose();
});

test("RMS source outlines follow the selected input, reduction groups and gamma, then fade away", async () => {
  const { animation, scene, blocks, groups, T } = await rmsMotion();
  const marks = [0, 1].map((index) => scene.getObjectByName(`rms:origin-${index}`)!);
  const [input, gamma] = blocks;
  const columnWidth = (input.x1 - input.x0) / input.t.rows.n;
  for (const [word, channel] of [
    [0, 0],
    [5, 4095],
  ]) {
    animation.update(rmsProgress(0, 0.3), word!, channel!);
    const selectedColumn = new T.Matrix4();
    groups.find((group) => group.userData.rmsSurface === 0)!.getMatrixAt(0, selectedColumn);
    expect(marks.every((mark) => mark.visible)).toBe(true);
    for (const { position } of marks) {
      expect(position.x).toBeCloseTo(selectedColumn.elements[12]!, 4);
      expect(position.y).toBeCloseTo(input.y1 - ((channel! + 0.5) / input.t.cols) * (input.y1 - input.y0), 4);
    }
    animation.update(rmsProgress(2, 0.7), word!, channel!);
    expect(marks.every((mark) => mark.visible)).toBe(true);
    expect(marks[1]!.position.x).toBeCloseTo((gamma.x0 + gamma.x1) / 2, 4);
  }
  for (let round = 0; round < 4; round++) {
    animation.update(rmsProgress(1, 0.15 * (round + 0.3)), 5);
    const count = 16 / 2 ** round;
    marks.forEach(({ position }, index) => {
      expect(position.x).toBeCloseTo(input.x1 + columnWidth * 1.5, 4);
      expect(position.y).toBeCloseTo(input.y1 - ((index + 0.5) / count) * (input.y1 - input.y0), 4);
    });
  }
  for (const progress of [0, rmsProgress(0, 0.8), rmsProgress(1, 0.85), 1]) {
    animation.update(progress, 5);
    expect(marks.every((mark) => !mark.visible)).toBe(true);
  }
  animation.dispose();
  expect(marks.every((mark) => !scene.children.includes(mark))).toBe(true);
});

test("RMS keeps a continuous connection from each extracted group to its operand while reading", async () => {
  const { animation, scene, blocks, T } = await rmsMotion();
  animation.update(rmsProgress(1, 0.15 * 0.35), 5);
  const width = (blocks[0].x1 - blocks[0].x0) / blocks[0].t.rows.n;
  for (const index of [0, 1]) {
    const line = scene.getObjectByName(`rms:source-${index}`)! as unknown as import("three").Mesh;
    expect(line.visible).toBe(true);
    const start = new T.Vector3().fromBufferAttribute(line.geometry.getAttribute("instanceStart"), 0);
    const ends = line.geometry.getAttribute("instanceEnd");
    const end = new T.Vector3().fromBufferAttribute(ends, ends.count - 1);
    const origin = scene.getObjectByName(`rms:origin-${index}`)!;
    const operand = scene.children.find(
      (object) => object.userData.block?.id === `rms:operand-${index ? "b" : "a"}`,
    )!;
    expect(Math.abs(start.x - origin.position.x)).toBeCloseTo(width / 2, 4);
    expect(start.y).toBeCloseTo(origin.position.y, 4);
    expect(end.x).toBeCloseTo(operand.position.x, 4);
    expect(end.y).toBeCloseTo(operand.position.y + width / 2, 4);
    expect(start.distanceTo(end)).toBeGreaterThan(width);
  }
  animation.update(rmsProgress(1, 0.15 * 0.35), 5);
  for (const index of [0, 1]) {
    expect(scene.getObjectByName(`rms:source-${index}`)!.visible).toBe(true);
    expect(scene.getObjectByName(`rms:origin-${index}`)?.visible).toBe(true);
  }
  animation.dispose();
});

test("RMS source follows the extracted column instead of staying behind it", async () => {
  const { animation, groups, scene, blocks, T } = await rmsMotion();
  const values = groups.find((group) => group.userData.rmsSurface === 0)!;
  const matrix = new T.Matrix4();
  for (const [phase, amount] of [
    [0, 0.22],
    [0, 0.4],
    [2, 0.1],
    [2, 0.2],
    [2, 0.4],
    [2, 0.7],
  ]) {
    animation.update(rmsProgress(phase!, amount!), 5, 1023);
    values.getMatrixAt(0, matrix);
    const origin = scene.getObjectByName("rms:origin-0")!.position;
    expect(origin.x).toBeCloseTo(matrix.elements[12]!, 4);
    expect(origin.z).toBeCloseTo(matrix.elements[14]! + (blocks[0].z1 - blocks[0].z0) / 2 + 0.05, 4);
  }
  animation.dispose();
});

test("RMS continuous source lines stay visible past the matrices in the reading view", async () => {
  const { animation, scene, blocks, groups, T } = await rmsMotion();
  const matrix = new T.Matrix4();
  const direction = new T.Vector3(
    Math.sin(0.525) * Math.cos(0.349),
    Math.sin(0.349),
    Math.cos(0.525) * Math.cos(0.349),
  );
  const blocked: string[] = [];
  const frames = [0, 2].flatMap((phase) => Array.from({ length: 19 }, (_, i) => [phase, (i + 1) * 0.05]));
  frames.push(
    ...[0, 1, 2, 3].flatMap((round) => [0.15, 0.35, 0.6].map((local) => [1, 0.15 * (round + local)])),
  );
  for (const [phase, amount] of frames) {
    animation.update(rmsProgress(phase!, amount!), 5, 1023);
    const boxes = blocks.map(
      (b) => new T.Box3(new T.Vector3(b.x0, b.y0, b.z0), new T.Vector3(b.x1, b.y1, b.z1)),
    );
    for (const group of groups.filter((group) => group.visible)) {
      for (let i = 0; i < group.count; i++) {
        group.getMatrixAt(i, matrix);
        if (matrix.elements[0]! < 0.01) continue;
        boxes.push(
          new T.Box3(new T.Vector3(-0.5, -0.5, -0.5), new T.Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix),
        );
      }
    }
    for (const index of [0, 1]) {
      const line = scene.getObjectByName(`rms:source-${index}`)! as import("three").Mesh;
      if (!line.visible) continue;
      const points = line.geometry.getAttribute("instanceStart");
      for (let i = 0; i < points.count; i++) {
        const point = new T.Vector3().fromBufferAttribute(points, i).addScaledVector(direction, 0.05);
        const ray = new T.Ray(point, direction);
        if (boxes.some((box) => ray.intersectBox(box, new T.Vector3())))
          blocked.push(`${phase}/${amount} line ${index} point ${i}`);
      }
    }
  }
  expect(blocked).toEqual([]);
  animation.dispose();
});

test("RMS connections disappear with the operands, never imply sources for constants", async () => {
  const { animation, scene } = await rmsMotion();
  const lines = [0, 1].map((index) => scene.getObjectByName(`rms:source-${index}`)!);
  for (const progress of [0, rmsProgress(0, 0.8), rmsProgress(1, 0.75), rmsProgress(1, 0.85), 1]) {
    animation.update(progress, 5);
    expect(lines.every((line) => !line.visible)).toBe(true);
  }
  animation.dispose();
  expect(lines.every((line) => !scene.children.includes(line))).toBe(true);
});

test("RMS provenance is a legible annotation above moving geometry", async () => {
  const { animation, scene } = await rmsMotion();
  animation.update(rmsProgress(1, 0.15 * 0.35), 5);
  for (const index of [0, 1]) {
    const line = scene.getObjectByName(`rms:source-${index}`)! as import("three").Mesh<
      import("three").BufferGeometry,
      import("three/addons/lines/LineMaterial.js").LineMaterial
    >;
    const halo = scene.getObjectByName(`rms:source-halo-${index}`)! as typeof line;
    expect(line.material.depthTest).toBe(false);
    expect(line.material.linewidth).toBeGreaterThanOrEqual(1.5);
    expect(line.material.opacity).toBeGreaterThanOrEqual(0.8);
    expect(halo.visible).toBe(true);
    expect(halo.renderOrder).toBeLessThan(line.renderOrder);
    expect(halo.material.linewidth).toBeGreaterThan(line.material.linewidth);
    expect(halo.geometry).toBe(line.geometry);
  }
  animation.update(0, 5);
  for (const index of [0, 1]) expect(scene.getObjectByName(`rms:source-halo-${index}`)?.visible).toBe(false);
  animation.dispose();
  expect(scene.children.some((object) => object.name.startsWith("rms:source"))).toBe(false);
});

test("RMS clears the whole column before unfolding arithmetic and its source lines", async () => {
  const { animation, scene, groups } = await rmsMotion();
  const operands = scene.children.filter((object) => object.userData.block?.id?.startsWith("rms:operand-"));
  for (const [phase, amount] of [
    [0, 0.12],
    [2, 0.06],
  ]) {
    animation.update(rmsProgress(phase!, amount!), 5);
    expect(groups.find((group) => group.userData.rmsSurface === 0)!.visible).toBe(true);
    expect(operands.some((object) => object.visible)).toBe(false);
    expect(scene.getObjectByName("rms:source-0")!.visible).toBe(false);
  }
  animation.update(rmsProgress(0, 0.5), 5);
  expect(operands.filter((object) => object.visible)).toHaveLength(2);
  expect(scene.getObjectByName("rms:source-0")!.visible).toBe(true);
  animation.dispose();
});

test("RMS connector colors use the master's sRGB vector without invalid Color components", async () => {
  const { animation, scene, T } = await rmsMotion();
  animation.update(rmsProgress(1, 0.15 * 0.35), 5);
  const original = scene.children.find(
    (object) => object.userData.block?.id === "collapsed_attn",
  )! as import("three").Mesh<import("three").BufferGeometry, import("three").ShaderMaterial>;
  const rgb = original.material.uniforms.uCol!.value;
  const expected = new T.Color().setRGB(rgb.x, rgb.y, rgb.z, T.SRGBColorSpace).multiplyScalar(0.4);
  for (const name of ["rms:source-0", "rms:source-1", "rms:origin-0", "rms:origin-1"]) {
    const line = scene.getObjectByName(name)! as import("three").Mesh<
      import("three").BufferGeometry,
      import("three/addons/lines/LineMaterial.js").LineMaterial
    >;
    expect(line.material.color.toArray()).toEqual(expected.toArray());
    expect(line.material.color.toArray().every(Number.isFinite)).toBe(true);
  }
  animation.dispose();
});

test("RMS extracts a straight column without staggering its rows", async () => {
  const { animation, groups, T } = await rmsMotion();
  const column = groups.find((group) => group.userData.rmsSurface === 0)!;
  const matrix = new T.Matrix4();
  for (const progress of [
    rmsProgress(0, 0.2),
    rmsProgress(0, 0.4),
    rmsProgress(0, 0.7),
    rmsProgress(2, 0.16),
  ]) {
    animation.update(progress, 5);
    column.getMatrixAt(0, matrix);
    const [x, z] = [matrix.elements[12]!, matrix.elements[14]!];
    for (let index = 1; index < column.count; index++) {
      column.getMatrixAt(index, matrix);
      expect.soft(matrix.elements[12]).toBeCloseTo(x, 5);
      expect.soft(matrix.elements[14]).toBeCloseTo(z, 5);
    }
  }
  animation.dispose();
});

test("RMS working columns leave gamma visible during scaling in the reading view", async () => {
  const { animation, groups, blocks, T } = await rmsMotion();
  const gamma = blocks[1];
  const screenX = (x: number, z: number) => x * Math.cos(0.525) - z * Math.sin(0.525);
  const gammaLeft = screenX(gamma.x0, gamma.z1);
  const gammaRight = screenX(gamma.x1, gamma.z0);
  const matrix = new T.Matrix4();
  const point = new T.Vector3();
  for (const progress of [rmsProgress(2, 0.6), rmsProgress(2, 0.76), rmsProgress(2, 0.88)]) {
    animation.update(progress, 5);
    for (const group of groups.filter((group) => group.visible && group.userData.rmsSurface !== 1)) {
      for (let index = 0; index < group.count; index++) {
        group.getMatrixAt(index, matrix);
        if (matrix.elements[0]! < 0.01) continue;
        const extents = [-0.5, 0.5].flatMap((x) =>
          [-0.5, 0.5].map((z) => {
            point.set(x, 0, z).applyMatrix4(matrix);
            return screenX(point.x, point.z);
          }),
        );
        expect.soft(Math.max(...extents) < gammaLeft || Math.min(...extents) > gammaRight).toBe(true);
      }
    }
  }
  animation.dispose();
});

test("RMS parks its denominator below the matrices and their headings", async () => {
  const { animation, scene, blocks } = await rmsMotion();
  const scalar = scene.children.find((object) => object.userData.block?.id === "rms:scalar")!;
  for (const progress of [rmsProgress(2, 0), rmsProgress(2, 0.4), rmsProgress(2, 0.8)]) {
    animation.update(progress, 5);
    expect(scalar.visible).toBe(true);
    expect(scalar.position.y + scalar.scale.y / 2).toBeLessThan(blocks[0].y0);
  }
  animation.dispose();
});

let demo: MatrixDemo;
let source: MasterParts;
test("playback can seek across all phases and stops at a complete result", () => {
  for (const kind of ["rms", "ffn", "mhc"] as const) {
    for (const step of ["gate", "up", "multiply", "down"] as const) {
      const positions =
        kind === "rms" ? [0, 1, 2, 3].map((phase) => rmsProgress(phase)) : [0, 0.25, 0.5, 0.75];
      expect(positions.map((position) => partPlayback(kind, step, position).phase)).toEqual([0, 1, 2, 3]);
      expect(partPlayback(kind, step, kind === "rms" ? rmsProgress(3, 0.5) : 0.875).amount).toBe(0.5);
      expect(partPlayback(kind, step, 1).amount).toBe(1);
      expect(partPlayback(kind, step, -1).amount).toBe(0);
      expect(partPlayback(kind, step, 2)).toEqual(partPlayback(kind, step, 1));
    }
  }
  expect(partPlayback("ffn", "multiply", 0.5).caption).toContain("SiLU");
  expect(partPlayback("rms", "gate", 0.25).caption).toContain("ε");
});
beforeAll(async () => {
  const root = resolve("public/experiences/glm-flow/master");
  const [module, index, bytes, layout, spec, config, three] = await Promise.all([
    import(/* @vite-ignore */ pathToFileURL(resolve(root, "demo-data.js")).href),
    readFile(resolve(root, "demo/continuous/l00.json"), "utf8").then(JSON.parse),
    readFile(resolve(root, "demo/continuous/l00.bin")),
    import(/* @vite-ignore */ pathToFileURL(resolve(root, "flow-layout.js")).href),
    import(/* @vite-ignore */ pathToFileURL(resolve(root, "truth-spec.js")).href),
    readFile(resolve(root, "../reference/official-config.json"), "utf8").then(JSON.parse),
    import("three"),
  ]);
  demo = module.makeDemo(
    index.weights,
    index,
    new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4),
  );
  const layer = spec.layerSpec(config.text_config, index.ids.length, 0);
  const native = layout.layoutFlow(layer);
  const blocks: PartBlock[] = native.blocks.map(layout.toWorld);
  const tensors: PartTensor[] = layer.tensors;
  source = {
    three,
    demo,
    tensors: new Map(tensors.map((tensor) => [tensor.id, tensor])),
    layoutBlocks: new Map(blocks.map((block) => [block.id, block])),
    layoutArrows: native.arrows.map((arrow: PartArrow) => ({
      ...arrow,
      pts: arrow.pts.map(layout.ptWorld),
    })),
    epsilon: config.text_config.rms_norm_eps,
    limit: config.text_config.swiglu_limit,
    shapeOf: layout.shapeOf,
    makeFlowLook: () => {
      throw new Error("Layout and tensor selection must not require WebGL");
    },
  };
});

test("RMS calculation agrees with the original continuous tensor for every word", () => {
  for (let word = 0; word < 6; word++) {
    for (const channel of [0, 37, 4095]) {
      const part = inspectPart(demo, "rms", "gate", word, channel, 1e-5, 10);
      expect(part.calculated).toBeCloseTo(part.stored, 5);
      expect(part.count).toBe(4096);
    }
  }
});

test("RMS partial sums retain exactly the dimensions named by each reduction group", () => {
  const tensor = demo.get("collapsed_attn");
  for (let word = 0; word < 6; word++) {
    const column = rmsColumn(demo, word, source.epsilon);
    expect(column.levels.map((level) => level.length)).toEqual([16, 8, 4, 2, 1]);
    for (const level of column.levels) {
      const length = column.count / level.length;
      for (let group = 0; group < level.length; group++) {
        const start = word * column.count + group * length;
        const expected = tensor.a.slice(start, start + length).reduce((sum, x) => sum + x * x, 0);
        expect(level[group]).toBeCloseTo(expected, 8);
      }
    }
    expect(column.rms ** 2).toBeCloseTo(column.sum / column.count + source.epsilon, 10);
  }
});

test("RMS lifts a real pair, holds its operands, then returns one sum continuously", async () => {
  const { animation, scene, groups, blocks, T } = await rmsMotion();
  const find = (name: string) =>
    scene.children.find((object) => object.userData.block?.id === `rms:operand-${name}`)!;
  const a = find("a");
  const b = find("b");
  const sum = find("result");
  const matrix = new T.Matrix4();
  for (let level = 0; level < 4; level++) {
    animation.update(rmsProgress(1, 0.15 * (level + 0.35)), 5);
    expect(a.visible && b.visible).toBe(true);
    expect(sum.visible).toBe(false);
    expect(a.position.y).toBeLessThan(blocks[0].y0);
    expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThan(20);
    groups[0]!.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBe(0);
    animation.update(rmsProgress(1, 0.15 * (level + 0.8)), 5);
    expect(a.visible || b.visible).toBe(false);
    expect(sum.visible).toBe(true);
    expect(sum.position.y).toBeLessThan(blocks[0].y0);
    animation.update(rmsProgress(1, 0.15 * (level + 0.9999)), 5);
    const returned = sum.position.clone();
    animation.update(rmsProgress(1, 0.15 * (level + 1)), 5);
    expect(a.position.distanceTo(returned)).toBeLessThan(0.001);
  }
  animation.update(rmsProgress(1, 0.64), 5);
  expect(a.visible).toBe(true);
  expect(b.visible || sum.visible).toBe(false);
  expect(groups[0]!.visible).toBe(false);
  animation.dispose();
});

test("mHC reads four different residual streams with the original pre coefficients", () => {
  const part = inspectPart(demo, "mhc", "gate", 3, 29, 1e-5, 10);
  expect(part.calculated).toBeCloseTo(part.stored, 5);
  expect(part.terms).toHaveLength(4);
  expect(new Set(part.terms.map((term) => term.input)).size).toBeGreaterThan(1);
});

test("all four FFN steps reproduce their stored output without mixing word positions", () => {
  for (const step of ["gate", "up", "multiply", "down"] as const) {
    for (const word of [0, 3, 5]) {
      const part = inspectPart(demo, "ffn", step, word, 14, 1e-5, 10);
      expect(part.calculated).toBeCloseTo(part.stored, 4);
    }
  }
});

test("RMS keeps equal input/output shapes and aligns gamma with the output channel axis", () => {
  const { blocks, arrows } = layoutForPart(source, "rms", "gate");
  const [input, gamma, output] = blocks as [PartBlock, PartBlock, PartBlock];
  for (const block of [input, gamma, output]) {
    const native = source.layoutBlocks.get(block.id)!;
    expect(block.x1 - block.x0).toBeCloseTo(native.x1 - native.x0);
    expect(block.y1 - block.y0).toBeCloseTo(native.y1 - native.y0);
    expect(block.z1 - block.z0).toBeCloseTo(native.z1 - native.z0);
  }
  expect([input.orient, gamma.orient, output.orient]).toEqual(["col", "rod", "col"]);
  expect(output.x1 - output.x0).toBeCloseTo(input.x1 - input.x0);
  expect([output.y0, output.y1]).toEqual([input.y0, input.y1]);
  expect([output.z0, output.z1]).toEqual([input.z0, input.z1]);
  expect(output.t.shape).toEqual(input.t.shape);
  expect(output.x0).toBeGreaterThan(input.x1);
  expect([gamma.y0, gamma.y1]).toEqual([output.y0, output.y1]);
  expect(gamma.x0).toBeGreaterThan(input.x1);
  expect(gamma.x1).toBeLessThan(output.x0);
  expect(arrows).toHaveLength(1);
  expect([arrows[0]!.from, arrows[0]!.to]).toEqual([input.id, output.id]);
  expect(new Set(arrows[0]!.pts.map(([, y]) => y)).size).toBe(1);
  for (const [x, y] of arrows[0]!.pts) {
    expect(x).toBeGreaterThan(input.x1);
    expect(x).toBeLessThan(output.x0);
    expect(y).toBeGreaterThan(input.y0);
    expect(y).toBeLessThan(input.y1);
  }
});

test("FFN projections align contracted and output axes in their native orientations", () => {
  for (const step of ["gate", "up"] as const) {
    const { blocks } = layoutForPart(source, "ffn", step);
    const [input, weight, output] = blocks as [PartBlock, PartBlock, PartBlock];
    expect(blocks.map((block) => block.orient)).toEqual(["col", "wt", "row"]);
    expect([input.y0, input.y1]).toEqual([weight.y0, weight.y1]);
    expect([weight.x0, weight.x1]).toEqual([output.x0, output.x1]);
    expect(output.y1).toBeLessThan(weight.y0);
    expect(input.x0 - weight.x1).toBeCloseTo(8);
  }
  const { blocks } = layoutForPart(source, "ffn", "down");
  const [input, weight, output] = blocks as [PartBlock, PartBlock, PartBlock];
  expect(blocks.map((block) => block.orient)).toEqual(["row", "wl", "col"]);
  expect([input.x0, input.x1]).toEqual([weight.x0, weight.x1]);
  expect([weight.y0, weight.y1]).toEqual([output.y0, output.y1]);
  expect(output.x0).toBeGreaterThan(weight.x1);
});

test("picking follows row, column and weight axes without changing a weight's word", () => {
  const current = { word: 2, channel: 37 };
  const gate = layoutForPart(source, "ffn", "gate").blocks;
  expect(pickPartCell(gate[2]!, { x: 0.25, y: 4.5 / 6 }, current, "ffn", "gate")).toEqual({
    word: 4,
    channel: 3072,
  });
  expect(pickPartCell(gate[1]!, { x: 0.25, y: 0.5 }, current, "ffn", "gate")).toEqual({
    word: 2,
    channel: 3072,
  });
  const down = layoutForPart(source, "ffn", "down").blocks;
  expect(pickPartCell(down[1]!, { x: 0.25, y: 0.5 }, current, "ffn", "down")).toEqual({
    word: 2,
    channel: 2048,
  });
  expect(pickPartCell(down[2]!, { x: 4.5 / 6, y: 0.25 }, current, "ffn", "down")).toEqual({
    word: 4,
    channel: 1024,
  });
  expect(pickPartCell(down[2]!, { x: 1, y: 1 }, current, "ffn", "down")).toEqual({
    word: 5,
    channel: 4095,
  });
});

test("choosing an input word or mHC pre coefficient preserves the inspected output channel", () => {
  const current = { word: 2, channel: 37 };
  const downInput = layoutForPart(source, "ffn", "down").blocks[0]!;
  expect(pickPartCell(downInput, { x: 0.8, y: 4.5 / 6 }, current, "ffn", "down")).toEqual({
    word: 4,
    channel: 37,
  });
  const pre = layoutForPart(source, "mhc", "gate").blocks[1]!;
  expect(pre.t.shape).toEqual([6, 4]);
  expect(pickPartCell(pre, { x: 4.5 / 6, y: 0.8 }, current, "mhc", "gate")).toEqual({
    word: 4,
    channel: 37,
  });
});

test("word highlighting covers all channels and residual streams on the displayed word axis", () => {
  const row = layoutForPart(source, "ffn", "down").blocks[0]!;
  const residual = layoutForPart(source, "mhc", "gate").blocks[0]!;
  expect(row.div).toEqual([48, 6, 1]);
  expect(wordFocus(row, 4)).toEqual([
    [0, 4, 0],
    [48, 5, 1],
  ]);
  expect(residual.div).toEqual([6, 16, 4]);
  expect(wordFocus(residual, 4)).toEqual([
    [4, 0, 0],
    [5, 16, 4],
  ]);
});
