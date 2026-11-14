import type * as Three from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { RMS_GROUPS as GROUPS, type MasterParts, type PartBlock, rmsColumn } from "./matrix-parts";
import { partPlayback, rmsReduction } from "./matrix-playback";

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Contiguous groups animate a column, using the master's fragment shader,
// palette and fine texture. RMS itself still uses all 4,096 values.
export function makeRmsAnimation(
  source: MasterParts,
  host: HTMLDivElement,
  blocks: [PartBlock, PartBlock, PartBlock],
  meshes: Three.Mesh<Three.BufferGeometry, Three.ShaderMaterial>[],
  scene: Three.Scene,
) {
  const T = source.three;
  const [input, parameter, output] = blocks;
  const columnWidth = (input.x1 - input.x0) / input.t.rows.n;
  const height = input.y1 - input.y0;
  const depth = input.z1 - input.z0;
  const centerY = (input.y0 + input.y1) / 2;
  const baseZ = (input.z0 + input.z1) / 2;
  const workX = input.x1 + columnWidth * 1.5;
  const workZ = baseZ;
  const scalarAt = new T.Vector3(workX, centerY, workZ);
  const scalarPark = new T.Vector3(workX, input.y0 - columnWidth * 1.15, workZ);
  const arithmeticSlots = [
    new T.Vector3(workX - 16, input.y0 - 20, workZ),
    new T.Vector3(workX + 16, input.y0 - 20, workZ),
    new T.Vector3(workX, input.y0 - 35, workZ),
  ];
  const matrix = new T.Matrix4();
  const point = new T.Vector3();
  const size = new T.Vector3();
  const rotation = new T.Quaternion();
  const overlay = document.createElement("div");
  overlay.className = "matrix-rms-work";
  overlay.setAttribute("aria-hidden", "true");
  const arithmeticLabels = arithmeticSlots.map((position, index) => {
    const node = document.createElement("span");
    node.className = `matrix-rms-operand${index === 2 ? " matrix-rms-scalar" : ""}`;
    const name = document.createElement("small");
    const value = document.createElement("strong");
    node.append(name, value);
    overlay.append(node);
    return { node, name, value, position };
  });
  const operator = document.createElement("span");
  operator.className = "matrix-rms-operator";
  const arithmeticTitle = document.createElement("span");
  arithmeticTitle.className = "matrix-rms-operation-title";
  const note = document.createElement("span");
  note.className = "matrix-rms-note";
  note.textContent = "整列 4,096 维 · 分组显示运动";
  overlay.append(operator, arithmeticTitle, note);
  host.append(overlay);
  const parts = source.makeFlowLook({ px: 2, minPx: 0, viewH: 0, fine: 16, slabs: "touch" });
  const makeGroup = (block: PartBlock, index: number, id: string) => {
    const template = parts.addBlock(scene, { ...block, id });
    scene.remove(template);
    const geometry = template.geometry.clone();
    geometry.setAttribute(
      "rmsGroup",
      new T.InstancedBufferAttribute(
        Float32Array.from({ length: GROUPS }, (_, i) => i),
        1,
      ),
    );
    const material = template.material;
    material.uniforms.uCol!.value.copy(meshes[index]!.material.uniforms.uCol!.value);
    material.uniforms.uPage!.value.copy(meshes[index]!.material.uniforms.uPage!.value);
    material.uniforms.uSeed!.value = meshes[index]!.material.uniforms.uSeed!.value;
    material.uniforms.rmsWord = { value: 0 };
    material.uniforms.rmsColumns = { value: index === 1 ? 1 : input.t.rows.n };
    // The master vertex shader ignores object rotation. Adapt placement for
    // instancing and map each piece's texture back to the original tensor.
    material.vertexShader =
      `attribute float rmsGroup; uniform float rmsWord, rmsColumns;\n${material.vertexShader}`
        .replace(
          "vPos = p; vNrm = normal;",
          `vPos = vec3((rmsWord + p.x + .5) / rmsColumns - .5,
          .5 - (rmsGroup + .5 - p.y) / ${GROUPS}.0, p.z); vNrm = normal;`,
        )
        .replace(
          "gl_Position = projectionMatrix * viewMatrix * vec4(c + p * s, 1.0);",
          "gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);",
        );
    const group = new T.InstancedMesh(geometry, material, GROUPS);
    group.instanceMatrix.setUsage(T.DynamicDrawUsage);
    group.frustumCulled = false;
    group.userData.rmsSurface = index;
    scene.add(group);
    return group;
  };
  const values = makeGroup(input, 0, "rms:column");
  const gamma = makeGroup(parameter, 1, "rms:gamma");
  const result = makeGroup(output, 2, "rms:result");
  const broadcast = makeGroup(parameter, 1, "rms:broadcast");
  const scalar = parts.addBlock(scene, { ...parameter, id: "rms:scalar" });
  scalar.material.uniforms.uCol!.value.copy(meshes[1]!.material.uniforms.uCol!.value);
  scalar.material.uniforms.uPage!.value.copy(meshes[1]!.material.uniforms.uPage!.value);
  scalar.material.uniforms.uDiv!.value.set(1, 1, 1);
  scalar.material.uniforms.uFine!.value.set(1, 1, 1);
  scalar.material.uniforms.uNoise!.value = 0;
  const arithmetic = ["a", "b", "result", "ghost-a", "ghost-b"].map((name) => {
    const mesh = parts.addBlock(scene, { ...input, id: `rms:operand-${name}` });
    const u = mesh.material.uniforms;
    u.uPage!.value.copy(meshes[0]!.material.uniforms.uPage!.value);
    u.uDiv!.value.set(1, 1, 1);
    u.uFine!.value.set(1, 1, 1);
    u.uNoise!.value = 0;
    u.uDim!.value = name.startsWith("ghost") ? 0.8 : 0;
    return mesh;
  });
  const guides = [0, 1].map((index) => {
    const line = new Line2(
      new LineGeometry().setPositions(new Float32Array(25 * 3)),
      new LineMaterial({ linewidth: 1.6, transparent: true, depthWrite: false, depthTest: false }),
    );
    line.name = `rms:source-${index}`;
    line.renderOrder = 5;
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    return line;
  });
  const halos = guides.map((line, index) => {
    const page: Three.Vector3 = meshes[0]!.material.uniforms.uPage!.value;
    const halo = new Line2(
      line.geometry,
      new LineMaterial({
        linewidth: 3.8,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        color: new T.Color().setRGB(page.x, page.y, page.z, T.SRGBColorSpace),
      }),
    );
    halo.name = `rms:source-halo-${index}`;
    halo.renderOrder = 4;
    halo.frustumCulled = false;
    halo.visible = false;
    scene.add(halo);
    return halo;
  });
  const origins = guides.map((_, index) => {
    const outline = new Line2(
      new LineGeometry().setPositions([-0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0, -0.5, 0.5, 0]),
      new LineMaterial({
        linewidth: 1.25,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        depthTest: false,
      }),
    );
    outline.name = `rms:origin-${index}`;
    outline.renderOrder = 6;
    outline.visible = false;
    scene.add(outline);
    return { outline };
  });
  let showSources = false;
  let arithmeticWord = -1;
  let column: ReturnType<typeof rmsColumn>;
  const format = (n: number, digits = 2) => n.toFixed(digits).replace("-", "−");
  const label = (index: number, name: string, value: number, digits = 2) => {
    const item = arithmeticLabels[index]!;
    const text = format(value, digits);
    if (item.name.textContent !== name) item.name.textContent = name;
    if (item.value.textContent !== text) item.value.textContent = text;
    const raw = String(value);
    if (item.node.dataset.value !== raw) item.node.dataset.value = raw;
  };
  const groups = [values, gamma, result, broadcast];
  let selectedWord = 0;
  let reducing = false;
  const place = (
    group: (typeof groups)[number],
    index: number,
    x: number,
    y: number,
    z: number,
    w = columnWidth,
    h = height / GROUPS,
    d = depth,
    scale = 1,
  ) => {
    point.set(x, y, z);
    size.set(w * scale, h * scale, d * scale);
    matrix.compose(point, rotation, size);
    group.setMatrixAt(index, matrix);
  };
  return {
    bounds: new T.Box3(
      new T.Vector3(input.x0, input.y0 - 48, Math.min(input.z0, parameter.z0, baseZ - depth)),
      new T.Vector3(output.x1, input.y1, input.z1 + depth * 1.2),
    ),
    update(progress: number, word: number, channel = 0) {
      selectedWord = word;
      if (arithmeticWord !== word) {
        column = rmsColumn(source.demo, word, source.epsilon);
        arithmeticWord = word;
      }
      const { phase, amount } = partPlayback("rms", "gate", progress);
      const stage = progress === 1 ? 4 : phase;
      const extractionEnd = stage === 0 ? 0.24 : 0.12;
      const extracting = (stage === 0 || stage === 2) && amount < extractionEnd;
      const reduction = rmsReduction(amount);
      reducing = stage === 1;
      showSources = !extracting && (stage === 0 || (reducing && reduction.count > 1) || stage === 2);
      const x = source.demo.at(input.id, word, channel);
      const g = source.demo.weight(parameter.id, channel);
      const sourceX = input.x0 + (word + 0.5) * columnWidth;
      const targetX = output.x0 + (word + 0.5) * columnWidth;
      const gammaX = (parameter.x0 + parameter.x1) / 2;
      const extraction = stage === 0 || stage === 2 ? amount / extractionEnd : amount;
      const pull = smooth((extraction - 0.14) / 0.44);
      const lift = smooth(extraction / 0.14) * (1 - smooth((extraction - 0.58) / 0.16));
      const pair = smooth((amount - 0.64) / 0.18);
      values.material.uniforms.uCol!.value.copy(meshes[0]!.material.uniforms.uCol!.value);
      if (stage === 2)
        values.material.uniforms.uCol!.value.lerp(meshes[2]!.material.uniforms.uCol!.value, pair);
      for (const group of groups) {
        group.visible = false;
        group.material.uniforms.rmsWord!.value = group === values || group === result ? word : 0;
      }
      values.count = reducing ? reduction.count : GROUPS;
      scalar.visible = stage === 2;
      scalar.position.copy(stage === 2 ? scalarPark : scalarAt);
      if (reducing) scalar.position.lerp(scalarPark, smooth((amount - 0.91) / 0.09));
      scalar.scale.setScalar(columnWidth);
      if (stage === 2) scalar.scale.multiplyScalar(1 - smooth((amount - 0.84) / 0.16));
      values.visible = stage < 3 && progress > 0 && !(reducing && reduction.count === 1);
      gamma.visible = stage === 2 && amount > 0.36 && amount < 0.82;
      result.visible = stage === 3;
      broadcast.visible = stage === 2 && amount < 0.58;
      for (let i = 0; i < GROUPS; i++) {
        const y = input.y1 - ((i + 0.5) / GROUPS) * height;
        const delay = i / GROUPS;
        if (stage === 0) {
          // Move one rigid column clear of the input before splitting it for reduction.
          place(values, i, mix(sourceX, workX, pull), y, baseZ + depth * 1.05 * lift);
        } else if (stage === 1) {
          if (i >= reduction.count) continue;
          if (i < 2) {
            // These exact two groups travel into the arithmetic area and return as their sum.
            place(values, i, workX, centerY, workZ, 0, 0, 0);
            continue;
          }
          const { count, level, movement } = reduction;
          const merge = smooth(movement);
          const groupHeight = mix(height / GROUPS, columnWidth, level / 4);
          const mergedHeight = mix(height / GROUPS, columnWidth, (level + 1) / 4);
          const fromY = input.y1 - ((i + 0.5) / count) * height;
          const pairY = input.y1 - ((Math.floor(i / 2) + 0.5) / (count / 2)) * height;
          // The two faces meet without overlap; the next round replaces them
          // with one block of exactly the same outer dimensions.
          place(
            values,
            i,
            workX,
            count === 1 ? centerY : mix(fromY, pairY + ((i % 2 === 0 ? 1 : -1) * mergedHeight) / 4, merge),
            workZ,
            columnWidth,
            count === 1 ? columnWidth : mix(groupHeight, mergedHeight / 2, merge),
            depth,
          );
        } else if (stage === 2) {
          const divide = smooth((amount - 0.25 - delay * 0.04) / 0.18);
          const bringGamma = smooth((amount - 0.36) / 0.22);
          const gammaWidth = columnWidth * 0.38 * smooth((amount - 0.36) / 0.06) * (1 - pair);
          // Normalize and apply gamma in place, keeping the source parameter column clear.
          place(values, i, mix(sourceX, workX, pull), y, baseZ + depth * 1.05 * lift);
          place(
            broadcast,
            i,
            workX,
            mix(scalarPark.y, y, divide),
            workZ + depth,
            0.9,
            0.9,
            0.9,
            Math.sin(Math.PI * divide),
          );
          place(
            gamma,
            i,
            mix(mix(gammaX, workX + columnWidth * 0.85, bringGamma), workX, pair),
            y,
            mix(baseZ, workZ, bringGamma),
            gammaWidth,
            height / GROUPS,
            gammaWidth,
          );
        } else if (stage === 3) {
          const pass = smooth(amount / 0.32);
          const write = smooth((amount - 0.32) / 0.45);
          // Pass behind gamma, then approach the output's front face as a whole column.
          place(
            result,
            i,
            mix(mix(workX, gammaX + columnWidth * 1.6, pass), targetX, write),
            y,
            baseZ - depth * 0.75 * Math.sin(Math.PI * pass) + depth * 1.05 * Math.sin(Math.PI * write),
          );
        }
      }
      const [a, b, combined, ghostA, ghostB] = arithmetic as [
        typeof scalar,
        typeof scalar,
        typeof scalar,
        typeof scalar,
        typeof scalar,
      ];
      for (const [index, mesh] of arithmetic.entries()) {
        mesh.visible = true;
        mesh.position.copy(arithmeticSlots[index < 3 ? index : index - 3]!);
        mesh.scale.set(columnWidth, columnWidth, depth);
        mesh.material.uniforms.uCol!.value.copy(
          meshes[index === 1 && stage === 2 ? 1 : 0]!.material.uniforms.uCol!.value,
        );
      }
      let local = stage === 0 ? Math.max(0, (amount - extractionEnd) / (1 - extractionEnd)) : amount;
      let unary = false;
      let returnTo: Three.Vector3 | null = null;
      let returningHeight = columnWidth;
      let title = "逐项平方 · 同一个数乘自己";
      let symbol = "×";
      label(0, `第 ${(channel + 1).toLocaleString("en-US")} 维`, x, 3);
      label(1, "同一个 x", x, 3);
      label(2, "平方 x²", x * x, 3);
      if (reducing && reduction.count > 1) {
        const { level, count, roundAmount } = reduction;
        local = roundAmount;
        const length = column.count / count;
        title = `平方和相加 · 第 ${level + 1} 轮`;
        symbol = "+";
        label(0, `1–${length} 维`, column.levels[level]![0]!);
        label(1, `${length + 1}–${length * 2} 维`, column.levels[level]![1]!);
        label(2, `1–${length * 2} 维的和`, column.levels[level + 1]![0]!);
        for (const [i, mesh] of [a, b].entries()) {
          const from = new T.Vector3(workX, input.y1 - ((i + 0.5) / count) * height, workZ);
          mesh.position.copy(from).lerp(arithmeticSlots[i]!, smooth(local / 0.2));
          mesh.scale.y = mix(mix(height / GROUPS, columnWidth, level / 4), columnWidth, smooth(local / 0.2));
        }
        returnTo = new T.Vector3(workX, input.y1 - height / count, workZ);
        returningHeight = mix(height / GROUPS, columnWidth, (level + 1) / 4);
      } else if (reducing) {
        const { operation } = reduction;
        if (operation === "sum") {
          title = "全列的平方和已汇成一个数";
          label(0, "Σ x² · 全部 4,096 维", column.sum);
          local = (amount - 0.6) / 0.08;
          a.position.copy(scalarAt).lerp(arithmeticSlots[0]!, smooth(local / 0.4));
          unary = true;
          symbol = "";
        } else if (operation === "mean") {
          title = "求平均 · 除以这一列的维数";
          symbol = "÷";
          local = (amount - 0.68) / 0.12;
          label(0, "平方和 Σ x²", column.sum);
          label(1, "维数", column.count, 0);
          label(2, "均方", column.meanSquare, 3);
        } else if (operation === "epsilon") {
          title = "加 ε · 保证分母不会为零";
          symbol = "+";
          local = (amount - 0.8) / 0.08;
          label(0, "均方", column.meanSquare, 5);
          label(1, "ε", source.epsilon, 5);
          label(2, "均方 + ε", column.meanSquare + source.epsilon, 5);
        } else {
          title = "开平方 · 得到整列共用的 RMS";
          symbol = "√";
          unary = true;
          local = (amount - 0.88) / 0.12;
          label(0, "均方 + ε", column.meanSquare + source.epsilon, 5);
          label(2, "RMS", column.rms, 3);
          combined.material.uniforms.uCol!.value.copy(scalar.material.uniforms.uCol!.value);
          returnTo = scalarPark;
        }
      } else if (stage >= 2) {
        const divide = stage === 2 && amount < 0.54;
        local =
          stage >= 3
            ? 0.82
            : divide
              ? Math.max(0, (amount - extractionEnd) / (0.54 - extractionEnd))
              : (amount - 0.54) / 0.46;
        title = divide
          ? `第 ${(channel + 1).toLocaleString("en-US")} 维 · 除以同一个 RMS`
          : `第 ${(channel + 1).toLocaleString("en-US")} 维 · 乘对应的 γ`;
        symbol = divide ? "÷" : "×";
        label(0, divide ? "原始 x" : "x ÷ RMS", divide ? x : x / column.rms, 3);
        label(1, divide ? "整列共用 RMS" : "本维 γ", divide ? column.rms : g, 3);
        label(2, divide ? "归一化后" : "输出 y", divide ? x / column.rms : (x / column.rms) * g, 3);
        if (!divide) combined.material.uniforms.uCol!.value.copy(meshes[2]!.material.uniforms.uCol!.value);
        if (stage >= 3) title = `${stage === 3 ? "写回" : "已写回"}输出 · 词数与维数不变`;
      }
      for (const [index, mark] of origins.entries()) {
        const origin = mark.outline.position;
        const channelY = input.y1 - ((channel + 0.5) / input.t.cols) * height;
        const divide = stage === 2 && amount < 0.54;
        mark.outline.scale.set(columnWidth, Math.max(height / input.t.cols, 0.7), 1);
        if (reducing) {
          origin.set(workX, input.y1 - ((index + 0.5) / reduction.count) * height, input.z1 + 0.05);
          mark.outline.scale.y = mix(height / GROUPS, columnWidth, reduction.level / 4);
        } else if (stage === 2 && index === 1) {
          if (divide) {
            origin.set(scalarPark.x, scalarPark.y, scalarPark.z + columnWidth / 2 + 0.05);
            mark.outline.scale.y = columnWidth;
          } else {
            origin.set(gammaX, channelY, parameter.z1 + 0.05);
            mark.outline.scale.x = parameter.x1 - parameter.x0;
          }
        } else if (stage === 0 || (stage === 2 && index === 0)) {
          // The selected values now live in the moving column; the old position is behind it.
          values.getMatrixAt(0, matrix);
          origin.set(matrix.elements[12]!, channelY, matrix.elements[14]! + depth / 2 + 0.05);
        } else origin.set(stage === 2 && !divide ? workX : sourceX, channelY, input.z1 + 0.05);
        const operand = arithmetic[index]!;
        if (showSources && !reducing) {
          const travel = smooth(local / 0.2);
          operand.position.copy(origin).lerp(arithmeticSlots[index]!, travel);
          operand.position.z += depth * Math.sin(Math.PI * travel);
        }
        const fade = smooth(local / 0.08) * (1 - smooth((local - 0.62) / 0.1));
        mark.outline.visible = progress > 0 && showSources && fade > 0;
        mark.outline.material.opacity = 0.9 * fade;
        const sourceColor: Three.Vector3 =
          stage === 2 && index === 1
            ? (divide ? scalar : meshes[1]!).material.uniforms.uCol!.value
            : meshes[0]!.material.uniforms.uCol!.value;
        // The master's uCol is an sRGB Vector3, not a Three Color.
        mark.outline.material.color
          .setRGB(sourceColor.x, sourceColor.y, sourceColor.z, T.SRGBColorSpace)
          .multiplyScalar(0.4);
        const line = guides[index]!;
        line.visible = mark.outline.visible && local > 0.02;
        // Exit the source edge, follow the gap beside its column, then meet the operand's top face.
        const inputSource = stage === 0 || (stage === 2 && divide && index === 0);
        const side = inputSource ? 1 : index === 0 ? -1 : 1;
        const start = origin.clone().add(new T.Vector3((side * mark.outline.scale.x) / 2, 0, 0));
        const destination = arithmeticSlots[2]!.clone();
        destination.x += ((index === 0 ? -1 : 1) * columnWidth) / 4;
        const end = operand.position
          .clone()
          .lerp(destination, smooth((local - 0.5) / 0.22))
          .add(new T.Vector3(0, operand.scale.y / 2, 0));
        const laneX = inputSource
          ? Math.min(
              origin.x + columnWidth / 2 + depth * 0.6 + columnWidth * (0.35 + index * 0.3),
              parameter.x0 - columnWidth * (0.5 - index * 0.3),
            )
          : start.x + side * columnWidth * 0.4;
        const elbowY = Math.min(start.y - columnWidth, Math.max(input.y0 - 4, end.y + columnWidth));
        const bend = new T.Vector3(laneX, elbowY, start.z);
        const top = new T.CubicBezierCurve3(
          start,
          new T.Vector3(laneX, start.y, start.z),
          new T.Vector3(laneX, start.y - columnWidth, start.z),
          bend,
        );
        const bottom = new T.CubicBezierCurve3(
          bend,
          new T.Vector3(laneX, end.y + columnWidth * 1.4, start.z),
          end.clone().add(new T.Vector3(0, columnWidth * 1.4, 0)),
          end,
        );
        const samples = [...top.getPoints(12), ...bottom.getPoints(12).slice(1)];
        const positions = (line.geometry.getAttribute("instanceStart") as Three.InterleavedBufferAttribute)
          .data;
        for (let i = 0; i < samples.length - 1; i++) {
          samples[i]!.toArray(positions.array, i * 6);
          samples[i + 1]!.toArray(positions.array, i * 6 + 3);
        }
        positions.needsUpdate = true;
        line.material.color.copy(mark.outline.material.color);
        line.material.opacity = 0.9 * fade;
        halos[index]!.visible = line.visible;
        halos[index]!.material.opacity = 0.95 * fade;
      }
      const merging = symbol ? smooth((local - 0.5) / 0.22) : 0;
      const returning = returnTo ? smooth((local - 0.86) / 0.14) : 0;
      const hasResult = local >= 0.72 && symbol !== "";
      for (const [index, mesh] of [a, b].entries()) {
        // Keep faint operands at their read positions while their solid copies perform the operation.
        const destination = arithmeticSlots[2]!.clone();
        if (!unary) destination.x += ((index === 0 ? -1 : 1) * columnWidth) / 4;
        mesh.position.lerp(destination, merging);
        if (!unary) mesh.scale.x *= 1 - merging / 2;
        mesh.visible = !hasResult && (index === 0 || !unary);
      }
      combined.visible = hasResult;
      if (returnTo) {
        combined.position.lerp(returnTo, returning);
        combined.scale.y = mix(columnWidth, returningHeight, returning);
      }
      ghostA.visible = merging > 0 || hasResult;
      ghostB.visible = (merging > 0 || hasResult) && !unary;
      overlay.hidden = progress === 0;
      if (progress === 0 || extracting) for (const mesh of arithmetic) mesh.visible = false;
      const ready = !extracting && (!showSources || local >= 0.2);
      arithmeticLabels.forEach(({ node }, index) => {
        node.hidden = index === 2 ? !hasResult || returning > 0.8 : !ready || (index === 1 && unary);
      });
      operator.hidden = !ready || !symbol;
      if (extracting) title = stage === 0 ? "取出这一列 · 再逐项平方" : "取出原输入列 · 准备除以 RMS";
      if (operator.textContent !== symbol) operator.textContent = symbol;
      if (arithmeticTitle.textContent !== title) arithmeticTitle.textContent = title;
      overlay.dataset.arithmetic = reducing ? reduction.operation : stage === 0 ? "square" : "scale";
      overlay.dataset.round = String(reduction.level);
      for (const group of groups) if (group.visible) group.instanceMatrix.needsUpdate = true;
      meshes.forEach((mesh, index) => {
        mesh.visible = true;
        const u = mesh.material.uniforms;
        u.uDim!.value = index === 2 && stage < 4 ? 0.28 : index === 1 ? 0.12 : 0.35;
        u.uDimIn!.value = index === 2 && stage < 4 ? 0.28 : progress === 0 || stage === 4 ? 0 : 0.2;
      });
      overlay.dataset.operation = ["square", "reduce", "scale", "place", "complete"][stage]!;
      note.textContent =
        reducing && reduction.count > 1
          ? `${reduction.count} 组 → ${reduction.count / 2} 组 · 其余组同样相加`
          : "整列 4,096 维 · 分组显示运动";
      const readout = arithmeticLabels.map(({ name, value }) => `${name.textContent} ${value.textContent}`);
      return {
        inputLabel: "输入 x",
        outputStatus: stage < 3 ? "等待写入" : stage === 3 && amount < 0.77 ? "正在写入" : "本列已写入",
        description:
          progress === 0
            ? "输入、参数 γ 与输出。点击播放开始计算。"
            : extracting
              ? title
              : `${title}：${unary ? `${symbol}${readout[0]}` : `${readout[0]} ${symbol} ${readout[1]}`}${hasResult ? `，得到 ${readout[2]}` : ""}`,
      };
    },
    corners(index: number) {
      const mesh = meshes[index]!;
      mesh.updateMatrixWorld();
      return [-0.5, 0.5].flatMap((x) =>
        [-0.5, 0.5].flatMap((y) =>
          [-0.5, 0.5].map((z) => new T.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld)),
        ),
      );
    },
    project(project: (point: Three.Vector3) => { x: number; y: number }) {
      for (const line of [...halos, ...guides])
        line.material.resolution.set(host.clientWidth, host.clientHeight);
      for (const { outline } of origins) outline.material.resolution.set(host.clientWidth, host.clientHeight);
      const moveLabel = (node: HTMLElement, position: string) => {
        if (node.style.transform !== position) node.style.transform = position;
      };
      const operandX = arithmeticSlots.slice(0, 2).map((position) => project(position).x);
      for (const [index, item] of arithmeticLabels.entries()) {
        const p = project(item.position.clone().add(new T.Vector3(0, -columnWidth / 2, 0)));
        const width = Math.min(104, host.clientWidth / 4 - 8);
        // Keep the inward path clear when the solid operands converge on the result.
        const side = index === 2 ? 0 : operandX[index]! <= operandX[1 - index]! ? -1 : 1;
        const left = Math.max(
          6,
          Math.min(
            host.clientWidth - width - 6,
            p.x + side * 5 - (side === -1 ? width : side === 0 ? width / 2 : 0),
          ),
        );
        item.node.style.width = `${width}px`;
        item.node.style.textAlign = side < 0 ? "right" : side > 0 ? "left" : "center";
        moveLabel(item.node, `translate(${left}px, ${p.y + 7}px)`);
      }
      const op = project(new T.Vector3(workX, arithmeticSlots[0]!.y, workZ));
      moveLabel(operator, `translate(${op.x}px, ${op.y}px) translate(-50%, -50%)`);
      moveLabel(
        arithmeticTitle,
        `translate(${host.clientWidth / 2}px, ${host.clientHeight - 42}px) translate(-50%, -50%)`,
      );
    },
    pick(hit: Three.Intersection) {
      const index = hit.object.userData.rmsSurface ?? meshes.indexOf(hit.object as (typeof meshes)[number]);
      if (hit.instanceId !== undefined) {
        const group = hit.object as Three.InstancedMesh;
        group.getMatrixAt(hit.instanceId, matrix);
        const p = hit.point.clone().applyMatrix4(group.matrixWorld.clone().multiply(matrix).invert());
        return {
          word: selectedWord,
          channel: Math.max(
            0,
            Math.min(input.t.cols - 1, Math.floor(((hit.instanceId + 0.5 - p.y) / GROUPS) * input.t.cols)),
          ),
        };
      }
      const p = meshes[index]!.worldToLocal(hit.point.clone());
      return {
        word:
          index === 1
            ? selectedWord
            : Math.max(0, Math.min(input.t.rows.n - 1, Math.floor((p.x + 0.5) * input.t.rows.n))),
        channel: Math.max(0, Math.min(input.t.cols - 1, Math.floor((0.5 - p.y) * input.t.cols))),
      };
    },
    pickMeshes() {
      // A partial sum no longer corresponds to a single input dimension.
      const active = [values, gamma, result].filter(
        (group) => group.visible && !(reducing && group === values),
      );
      for (const group of active) group.computeBoundingSphere();
      return [...meshes, ...active];
    },
    dispose() {
      overlay.remove();
      for (const halo of halos) {
        scene.remove(halo);
        halo.material.dispose();
      }
      for (const line of [...guides, ...origins.map((mark) => mark.outline)]) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      }
    },
  };
}
