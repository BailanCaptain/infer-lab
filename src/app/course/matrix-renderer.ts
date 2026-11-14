import type * as Three from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  type FfnStep,
  layoutForPart,
  type MasterParts,
  type MatrixPartKind,
  type PartBlock,
  pickPartCell,
  wordFocus,
} from "./matrix-parts";
import { partPlayback } from "./matrix-playback";
import { makeRmsAnimation } from "./matrix-rms-animation";

export interface PartRenderer {
  select(word: number, channel: number): void;
  seek(progress: number): void;
  resetView(): void;
  dispose(): void;
}

export function mountMatrixPart(
  host: HTMLDivElement,
  source: MasterParts,
  kind: MatrixPartKind,
  step: FfnStep,
  onSelect: (word: number, channel: number) => void,
  onError: (message: string) => void,
): PartRenderer {
  const T = source.three;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(kind === "rms" ? 2 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  const look = source.makeFlowLook({
    px: renderer.getPixelRatio(),
    minPx: 0,
    viewH: 420,
    fine: 16,
    slabs: "touch",
  });
  const { blocks, arrows } = layoutForPart(source, kind, step);
  const [input, parameter, output] = blocks as [PartBlock, PartBlock, PartBlock];
  const style = getComputedStyle(host);
  const color = (token: string) => style.getPropertyValue(token).trim();
  const background = new T.Color(color("--color-surface"));
  const page = background.clone().convertLinearToSRGB();
  const labels = document.createElement("div");
  labels.className = "matrix-part-labels";
  labels.setAttribute("aria-hidden", "true");
  host.append(labels);
  const cornersOf = (block: PartBlock) =>
    [block.x0, block.x1].flatMap((x) =>
      [block.y0, block.y1].flatMap((y) => [block.z0, block.z1].map((z) => new T.Vector3(x, y, z))),
    );
  const labelItems = blocks.map((block, index) => {
    const mesh = look.addBlock(scene, block);
    const ink = new T.Color(
      color(
        block.kind === "weight"
          ? "--color-matrix-parameter"
          : index === 2
            ? "--color-matrix-output"
            : "--color-matrix-input",
      ),
    ).convertLinearToSRGB();
    if (kind !== "rms" || index > 0) mesh.material.uniforms.uCol!.value.set(ink.r, ink.g, ink.b);
    mesh.material.uniforms.uPage!.value.set(page.r, page.g, page.b);
    if (kind !== "rms") mesh.material.uniforms.uNoise!.value = block.kind === "data" ? 0.1 : 0.08;
    if (block.t.deck?.kind === "stream") {
      // Mark the actual stream boundaries on the visible faces without enlarging the stack.
      const points = Array.from({ length: block.div[2] - 1 }, (_, index) => {
        const z = block.z1 - ((index + 1) / block.div[2]) * (block.z1 - block.z0);
        return [
          new T.Vector3(block.x0, block.y1 + 0.03, z),
          new T.Vector3(block.x1, block.y1 + 0.03, z),
          new T.Vector3(block.x1 + 0.03, block.y1, z),
          new T.Vector3(block.x1 + 0.03, block.y0, z),
        ];
      }).flat();
      scene.add(
        new T.LineSegments(
          new T.BufferGeometry().setFromPoints(points),
          new T.LineBasicMaterial({ color: color("--color-token"), transparent: true, opacity: 0.7 }),
        ),
      );
    }
    const node = document.createElement("div");
    node.className = "matrix-part-label";
    node.dataset.tensor = block.id;
    const name = document.createElement("strong");
    name.textContent = block.t.name;
    const shape = document.createElement("span");
    shape.textContent = block.t.shape.map((n) => n.toLocaleString("en-US")).join(" × ");
    node.append(name, shape);
    const status = kind === "rms" && index === 2 ? document.createElement("small") : null;
    if (status) node.append(status);
    labels.append(node);
    const side = kind === "rms" ? "top" : index === 2 || block.id === "W_down" ? "bottom" : "top";
    node.dataset.side = side;
    return { node, block, corners: cornersOf(block), side, status };
  });
  const paths = arrows.map((arrow) => {
    const from = blocks.find((block) => block.id === arrow.from)!;
    const to = blocks.find((block) => block.id === arrow.to)!;
    const points = arrow.pts.map(
      ([x, y], i) =>
        new T.Vector3(
          x,
          y,
          T.MathUtils.lerp((from.z0 + from.z1) / 2, (to.z0 + to.z1) / 2, i / (arrow.pts.length - 1)),
        ),
    );
    const attach = (point: Three.Vector3, other: Three.Vector3, block: PartBlock) => {
      const dx = other.x - point.x;
      const dy = other.y - point.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        point.x = dx > 0 ? block.x1 : block.x0;
        point.y = T.MathUtils.clamp(point.y, block.y0, block.y1);
      } else {
        point.y = dy > 0 ? block.y1 : block.y0;
        point.x = T.MathUtils.clamp(point.x, block.x0, block.x1);
      }
    };
    attach(points[0]!, points[1]!, from);
    attach(points.at(-1)!, points.at(-2)!, to);
    const curve = new T.CurvePath<Three.Vector3>();
    let previous = points[0]!;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]!;
      const corner = points[i]!;
      const b = points[i + 1]!;
      const radius = Math.min(4, corner.distanceTo(a) / 3, corner.distanceTo(b) / 3);
      const before = corner.clone().lerp(a, radius / corner.distanceTo(a));
      const after = corner.clone().lerp(b, radius / corner.distanceTo(b));
      curve.add(new T.LineCurve3(previous, before));
      curve.add(new T.QuadraticBezierCurve3(before, corner, after));
      previous = after;
    }
    curve.add(new T.LineCurve3(previous, points.at(-1)!));
    // Keep straight runs whole; only tessellate the rounded turns to avoid subpixel join seams.
    const samples = curve.curves.flatMap((piece, i) =>
      piece.getPoints(piece instanceof T.LineCurve3 ? 1 : 8).slice(i === 0 ? 0 : 1),
    );
    const startColor = new T.Color(
      color(from.kind === "weight" ? "--color-matrix-parameter" : "--color-matrix-input"),
    );
    const endColor = new T.Color(color("--color-matrix-output"));
    const geometry = new LineGeometry();
    geometry.setPositions(samples.flatMap((point) => point.toArray()));
    geometry.setColors(
      samples.flatMap((_, i) =>
        startColor
          .clone()
          .lerp(endColor, i / (samples.length - 1))
          .toArray(),
      ),
    );
    const material = new LineMaterial({ linewidth: 1.8, vertexColors: true, alphaToCoverage: true });
    const track = new Line2(geometry, material);
    scene.add(track);
    return { track };
  });
  const rmsAnimation =
    kind === "rms" ? makeRmsAnimation(source, host, [input, parameter, output], look.meshes, scene) : null;

  const markerGeometry = new T.BoxGeometry(1, 1, 1);
  const markerMaterial = new T.MeshBasicMaterial({
    color: color("--color-accent"),
    transparent: true,
    opacity: 0.65,
  });
  const markers = blocks.map((block) =>
    Array.from({ length: block.t.deck?.kind === "stream" ? block.div[2] : 1 }, () => {
      const marker = new T.Mesh(markerGeometry, markerMaterial);
      scene.add(marker);
      return marker;
    }),
  );
  const bound = new T.Box3();
  for (const block of blocks) for (const corner of cornersOf(block)) bound.expandByPoint(corner);
  for (const arrow of arrows)
    for (const point of arrow.pts) bound.expandByPoint(new T.Vector3(point[0], point[1], 0.4));
  const idleBound = bound.clone();
  if (rmsAnimation) {
    bound.union(rmsAnimation.bounds);
  }
  const center = bound.getCenter(new T.Vector3());
  const startDirection = new T.Vector3(
    Math.sin(0.525) * Math.cos(0.349),
    Math.sin(0.349),
    Math.cos(0.525) * Math.cos(0.349),
  );
  camera.position.copy(center).addScaledVector(startDirection, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI - 0.2;
  controls.update();
  let compact = false;
  let width = 1;
  let height = 1;
  const project = (point: Three.Vector3) => {
    const p = point.clone().project(camera);
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
  };
  const render = () => {
    if (rmsAnimation) {
      camera.updateMatrixWorld();
      placeLabels();
      rmsAnimation.project(project);
    }
    renderer.render(scene, camera);
  };
  const placeLabels = () => {
    for (const [index, { node, corners: blockCorners, side }] of labelItems.entries()) {
      const projected = (rmsAnimation?.corners(index) ?? blockCorners).map(project);
      const left = Math.min(...projected.map((p) => p.x));
      const right = Math.max(...projected.map((p) => p.x));
      const top = Math.min(...projected.map((p) => p.y));
      const bottom = Math.max(...projected.map((p) => p.y));
      const labelWidth = kind === "rms" ? Math.min(96, width * 0.18) : Math.min(130, width / 3);
      const x = (left + right - labelWidth) / 2;
      const y = side === "top" ? top - node.offsetHeight - 10 : bottom + 10;
      const position = `width:${labelWidth}px;left:${Math.max(6, Math.min(width - labelWidth - 6, x)).toFixed(2)}px;top:${Math.max(4, Math.min(height - 42, y)).toFixed(2)}px`;
      if (node.getAttribute("style") !== position) node.setAttribute("style", position);
    }
  };
  const fitCamera = (viewHeight: number, verticalMargin: number) => {
    // RMS framing is tied to the starting pose, not the angle reached by dragging.
    const view = rmsAnimation ? camera.clone() : camera;
    if (rmsAnimation) view.position.copy(center).addScaledVector(startDirection, 1000);
    view.left = -width / 2;
    view.right = width / 2;
    view.top = viewHeight / 2;
    view.bottom = -viewHeight / 2;
    view.zoom = 1;
    view.updateProjectionMatrix();
    view.lookAt(center);
    view.updateMatrixWorld(true);
    const frame = compact ? idleBound : bound;
    const corners = [frame.min.x, frame.max.x].flatMap((x) =>
      [frame.min.y, frame.max.y].flatMap((y) =>
        [frame.min.z, frame.max.z].map((z) => new T.Vector3(x, y, z)),
      ),
    );
    let fit = 0;
    for (const corner of corners) {
      const point = corner.clone().project(view);
      fit = Math.max(
        fit,
        Math.abs(point.x) / (rmsAnimation ? 0.95 : 0.88),
        Math.abs(point.y) / verticalMargin,
      );
    }
    view.zoom /= fit;
    if (rmsAnimation) {
      // Reserve space above the scene for tensor labels.
      view.top += 22 / view.zoom;
      view.bottom += 22 / view.zoom;
    }
    view.updateProjectionMatrix();
    if (rmsAnimation) {
      Object.assign(camera, {
        left: view.left,
        right: view.right,
        top: view.top,
        bottom: view.bottom,
        zoom: view.zoom,
      });
      camera.updateProjectionMatrix();
    }
  };
  const resize = () => {
    const nextWidth = Math.max(1, host.clientWidth);
    const nextHeight = Math.max(1, host.clientHeight);
    if (width !== nextWidth || height !== nextHeight) renderer.setSize(nextWidth, nextHeight);
    width = nextWidth;
    height = nextHeight;
    const nextCompact = !!rmsAnimation && host.dataset.idle === "true";
    if (compact !== nextCompact) {
      compact = nextCompact;
      const nextCenter = (compact ? idleBound : bound).getCenter(new T.Vector3());
      camera.position.add(nextCenter.clone().sub(center));
      center.copy(nextCenter);
      controls.target.copy(center);
      controls.update();
    }
    for (const { track } of paths) track.material.resolution.set(width, height);
    fitCamera(height, rmsAnimation ? 0.84 : 0.68);
    // The master's minimum-pixel shader assumes perspective; size thin rods in orthographic world units instead.
    for (const mesh of look.meshes) {
      const block = mesh.userData.block as PartBlock;
      const minimum = 3 / camera.zoom;
      mesh.scale.set(
        Math.max(block.x1 - block.x0, minimum),
        Math.max(block.y1 - block.y0, minimum),
        Math.max(block.z1 - block.z0, minimum),
      );
    }
    placeLabels();
    render();
  };
  let selectedWord = 0;
  let selectedChannel = 0;
  let progress = 1;
  const applyPlayback = () => {
    const { phase, amount } = partPlayback(kind, step, progress);
    const active = progress < 1;
    for (const block of blocks) look.grow(block.id, null);
    if (rmsAnimation) {
      const frame = rmsAnimation.update(progress, selectedWord, selectedChannel);
      const description = `RMSNorm，第 ${selectedWord + 1} 个词，第 ${selectedChannel + 1} 维。${frame.description}`;
      if (host.getAttribute("aria-label") !== description) host.setAttribute("aria-label", description);
      const name = labelItems[0]!.node.querySelector("strong")!;
      if (name.textContent !== frame.inputLabel) name.textContent = frame.inputLabel;
      const status = labelItems[2]!.status!;
      if (status.textContent !== frame.outputStatus) status.textContent = frame.outputStatus;
      for (const { track } of paths) track.visible = false;
      for (const group of markers) for (const marker of group) marker.visible = false;
    } else if (active) {
      const lit =
        phase === 0
          ? input.id
          : phase === 1
            ? kind === "rms"
              ? input.id
              : parameter.id
            : phase === 2
              ? parameter.id
              : output.id;
      for (const block of blocks) {
        look.dimOne(block.id, block.id === lit ? 0.35 : 0.7);
        look.focus(
          block.id,
          block.kind === "data" ? wordFocus(block, selectedWord) : null,
          block.id === lit || phase === 2 ? 0 : 0.4,
        );
      }
      // Use the master's word-by-word fill: earlier words are complete, the selected word is written along its channel axis.
      const row = output.orient === "row";
      look.grow(output.id, 0, (selectedWord + 1) / output.t.rows.n, row ? 1 : 0);
      look.front(
        output.id,
        row ? 2 : 1,
        selectedWord / output.t.rows.n,
        (selectedWord + 1) / output.t.rows.n,
        phase === 3 ? amount : 0,
        0,
      );
      for (const [i, group] of markers.entries())
        for (const marker of group) {
          if (i === 2) marker.visible = phase === 3 && amount > (selectedChannel + 0.5) / output.t.cols;
          else if (phase < 2) marker.visible = false;
        }
      if (phase === 1 && kind !== "mhc") {
        const scanning = kind === "ffn" && step === "multiply" ? 1 : 0;
        const block = blocks[scanning]!;
        for (const marker of markers[scanning]!) {
          marker.visible = true;
          if (block.orient === "row") marker.position.x = block.x0 + amount * (block.x1 - block.x0);
          else marker.position.y = block.y1 - amount * (block.y1 - block.y0);
        }
        if (kind === "ffn" && step !== "multiply") {
          const marker = markers[1]![0]!;
          marker.visible = true;
          if (parameter.orient === "wt") {
            marker.position.y = parameter.y1 - amount * (parameter.y1 - parameter.y0);
            marker.scale.y = Math.max(0.16, (parameter.y1 - parameter.y0) / 600);
          } else {
            marker.position.x = parameter.x0 + amount * (parameter.x1 - parameter.x0);
            marker.scale.x = Math.max(0.16, (parameter.x1 - parameter.x0) / 600);
          }
        }
      }
      if (kind === "mhc" && phase === 2) {
        const stream = Math.min(3, Math.floor(amount * 4));
        look.focus(
          input.id,
          [
            [selectedWord, 0, stream],
            [selectedWord + 1, input.div[1], stream + 1],
          ],
          0,
        );
      }
    }
    render();
  };
  const select = (word: number, channel: number) => {
    selectedWord = word;
    selectedChannel = channel;
    blocks.forEach((block, i) => {
      const data = block.kind === "data";
      const coefficient = block.id === "pre_ffn";
      const dotInput = kind === "ffn" && step !== "multiply" && block.id === input.id;
      const horizontal = block.orient === "row" || block.orient === "wt" || block.orient === "bar";
      const fraction = (Math.min(channel, block.t.cols - 1) + 0.5) / block.t.cols;
      look.dimOne(block.id, data ? 0.14 : 0);
      look.focus(block.id, data ? wordFocus(block, word) : null);
      for (const [stream, marker] of markers[i]!.entries()) {
        marker.visible = !coefficient && !dotInput;
        const w = block.x1 - block.x0;
        const h = block.y1 - block.y0;
        const wordW = data && !horizontal ? w / block.t.rows.n : w;
        const wordH = data && horizontal ? h / block.t.rows.n : h;
        marker.position.set(
          horizontal
            ? block.x0 + fraction * w
            : data
              ? block.x0 + (word + 0.5) * wordW
              : (block.x0 + block.x1) / 2,
          horizontal
            ? data
              ? block.y1 - (word + 0.5) * wordH
              : (block.y0 + block.y1) / 2
            : block.y1 - fraction * h,
          block.z1 - (stream / markers[i]!.length) * (block.z1 - block.z0) + 0.15,
        );
        marker.scale.set(
          horizontal ? Math.max(0.16, w / 600) : wordW,
          horizontal ? wordH : Math.max(0.16, h / 600),
          0.1,
        );
      }
    });
    applyPlayback();
  };
  const raycaster = new T.Raycaster();
  const point = new T.Vector2();
  let pointer: { x: number; y: number } | null = null;
  let dragged = false;
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY };
    dragged = false;
  };
  const pointerMove = (event: PointerEvent) => {
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    dragged = true;
  };
  const pointerUp = () => {
    pointer = null;
  };
  const click = (event: MouseEvent) => {
    if (dragged) return;
    const rect = renderer.domElement.getBoundingClientRect();
    point.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
    raycaster.setFromCamera(point, camera);
    const hit = raycaster.intersectObjects(rmsAnimation?.pickMeshes() ?? look.meshes, false)[0];
    if (!hit) return;
    if (rmsAnimation) {
      const selected = rmsAnimation.pick(hit);
      onSelect(selected.word, selected.channel);
      return;
    }
    const block = hit.object.userData.block as PartBlock;
    const selected = pickPartCell(
      block,
      {
        x: (hit.point.x - block.x0) / (block.x1 - block.x0),
        y: (block.y1 - hit.point.y) / (block.y1 - block.y0),
      },
      { word: selectedWord, channel: selectedChannel },
      kind,
      step,
    );
    onSelect(selected.word, selected.channel);
  };
  const lost = (event: Event) => {
    event.preventDefault();
    onError("绘图上下文已中断，请重新载入这幅图。");
  };
  renderer.domElement.addEventListener("click", click);
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", pointerUp);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const observer = new ResizeObserver(resize);
  const rotate = rmsAnimation ? render : resize;
  controls.addEventListener("change", rotate);
  observer.observe(host);
  resize();
  select(0, 0);
  return {
    select,
    seek(nextProgress) {
      progress = Math.max(0, Math.min(1, nextProgress));
      if (rmsAnimation) applyPlayback();
      else select(selectedWord, selectedChannel);
    },
    resetView() {
      camera.position.copy(center).addScaledVector(startDirection, 1000);
      controls.target.copy(center);
      controls.update();
      resize();
    },
    dispose() {
      observer.disconnect();
      controls.removeEventListener("change", rotate);
      controls.dispose();
      rmsAnimation?.dispose();
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set<Three.BufferGeometry>();
      const materials = new Set<Three.Material>();
      scene.traverse((object) => {
        if (object instanceof T.Mesh || object instanceof T.LineSegments) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      // Line2 uses the app's Three module, so dispose it explicitly across the master module boundary.
      for (const { track } of paths) {
        track.geometry.dispose();
        track.material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.remove();
    },
  };
}
