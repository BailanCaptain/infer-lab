import * as T from "three";
import type { scenePalette } from "./scene-palette";

/** A real row/column grid with labels attached to its cells, including during movement. */
export function createMatrixMesh(
  parent: T.Object3D,
  overlay: HTMLElement,
  rows: number,
  columns: number,
  color: string,
  palette: Pick<ReturnType<typeof scenePalette>, "result" | "paper">,
  pitch = 0.5,
  rowPitch = pitch,
) {
  const group = new T.Group();
  parent.add(group);
  const mesh = new T.InstancedMesh(
    new T.BoxGeometry(pitch * 0.88, 0.13, rowPitch * 0.88),
    // Instance colors carry the palette. Tinting the material too squares the color.
    new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    rows * columns,
  );
  mesh.frustumCulled = false;
  group.add(mesh);
  const tags: { node: HTMLSpanElement; point: T.Vector3; enabled: boolean }[] = [];
  const tag = (name: string, point: T.Vector3) => {
    const node = document.createElement("span");
    node.className = `wiki-matrix-label ${name}`;
    overlay.append(node);
    const item = { node, point, enabled: true };
    tags.push(item);
    return item;
  };
  const title = tag("matrix-title", new T.Vector3(0, 0.1, (-rows * rowPitch) / 2 - 0.55));
  const rowNames = Array.from({ length: rows }, (_, row) =>
    tag("matrix-token", new T.Vector3((-columns * pitch) / 2 - 0.13, 0.1, (row - (rows - 1) / 2) * rowPitch)),
  );
  const numbers = Array.from({ length: rows * columns }, () => tag("matrix-number", new T.Vector3()));
  const transform = new T.Matrix4();
  const tint = new T.Color();
  const point = new T.Vector3();
  let activeColumns = columns;
  const write = (
    values: readonly (readonly (number | string)[])[],
    names: readonly string[],
    heading: string,
    options: {
      columns?: number;
      expansion?: number;
      focusRow?: number;
      focusColumn?: number;
      written?: number;
      color?: string;
      resultRow?: number;
      result?: boolean;
      numbers?: boolean;
    } = {},
  ) => {
    activeColumns = options.columns ?? columns;
    if (title.node.textContent !== heading) title.node.textContent = heading;
    title.enabled = Boolean(heading);
    const expansion = options.expansion ?? 1;
    for (let row = 0; row < rows; row++) {
      const name = rowNames[row]!;
      if (name.node.textContent !== (names[row] ?? "")) name.node.textContent = names[row] ?? "";
      name.enabled = Boolean(names[row]);
      name.point.x = (-activeColumns * pitch) / 2 - 0.13;
      name.node.dataset.focus = String(options.focusRow === row);
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        const visible = col < activeColumns;
        const x = (col - (activeColumns - 1) / 2) * pitch * expansion;
        const z = (row - (rows - 1) / 2) * rowPitch;
        const written = T.MathUtils.clamp((options.written ?? 1) * rows * columns - index, 0, 1);
        const lift = 0.2 * Math.sin(written * Math.PI);
        transform
          .makeScale(visible ? (col === 0 ? 1 : expansion) : 0, 1 + lift * 3, visible ? 1 : 0)
          .setPosition(x, lift, z);
        mesh.setMatrixAt(index, transform);
        tint.set(options.result || options.resultRow === row ? palette.result : (options.color ?? color));
        if (options.focusRow !== undefined && options.focusRow !== row)
          tint.lerp(new T.Color(palette.paper), 0.65);
        if (options.focusColumn !== undefined && options.focusColumn !== col)
          tint.lerp(new T.Color(palette.paper), 0.65);
        if (written < 1) tint.lerp(new T.Color(palette.paper), 0.8 * (1 - written));
        mesh.setColorAt(index, tint);
        const number = numbers[index]!;
        number.point.set(x, 0.08 + lift, z);
        number.enabled =
          visible && written === 1 && options.numbers !== false && (activeColumns === 1 || expansion > 0.7);
        const value = String(values[row]?.[col] ?? "");
        if (number.node.textContent !== value) number.node.textContent = value;
        number.node.dataset.muted = String(options.focusRow !== undefined && options.focusRow !== row);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const bounds = (camera: T.Camera, width: number, height: number) => {
    group.updateWorldMatrix(true, false);
    const corners = [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => {
        point
          .set((x * activeColumns * pitch) / 2, 0.1, (z * rows * rowPitch) / 2)
          .applyMatrix4(group.matrixWorld)
          .project(camera);
        return { x: ((point.x + 1) * width) / 2, y: ((1 - point.y) * height) / 2 };
      }),
    );
    const x = Math.min(...corners.map((p) => p.x)),
      y = Math.min(...corners.map((p) => p.y));
    return {
      x,
      y,
      width: Math.max(...corners.map((p) => p.x)) - x,
      height: Math.max(...corners.map((p) => p.y)) - y,
    };
  };
  const renderLabels = (camera: T.Camera, width: number, height: number) => {
    group.updateWorldMatrix(true, false);
    for (const item of tags) {
      const hidden = !group.visible || !item.enabled;
      if (item.node.hidden !== hidden) item.node.hidden = hidden;
      if (item.node.hidden) continue;
      point.copy(item.point).applyMatrix4(group.matrixWorld).project(camera);
      item.node.style.left = `${((point.x + 1) * width) / 2}px`;
      item.node.style.top = `${((1 - point.y) * height) / 2}px`;
    }
    if (!title.node.hidden) {
      // Project the grid's top edge directly; reading DOM bounds here forces layout
      // after every moving cell, twice per matrix per frame.
      const block = bounds(camera, width, height);
      title.node.style.left = `${block.x + block.width / 2}px`;
      title.node.style.top = `${block.y - 8}px`;
      title.node.style.transform = "translate(-50%, -100%)";
    }
  };
  const rowPoint = (row: number) =>
    group.localToWorld(new T.Vector3(0, 0, (row - (rows - 1) / 2) * rowPitch));
  return {
    group,
    mesh,
    write,
    renderLabels,
    rowPoint,
    rowWidth: columns * pitch,
    bounds,
    dispose: () => {
      mesh.dispose();
      tags.forEach(({ node }) => {
        node.remove();
      });
    },
  };
}
