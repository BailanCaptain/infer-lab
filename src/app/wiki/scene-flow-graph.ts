import * as T from "three";
import type { scenePalette } from "./scene-palette";

type Palette = ReturnType<typeof scenePalette>;
export type FlowNode = {
  id: string;
  title: string;
  detail: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rows?: number;
  cols?: number;
  kind?: "weight" | "tensor" | "operator" | "workers" | "layers" | "queue" | "cache";
  values?: string[];
  labelBelow?: boolean;
};
export type FlowEdge = {
  from: string;
  to: string;
  start: number;
  end: number;
  result?: boolean;
  bend?: number;
  fromCell?: number;
  toCell?: number;
  context?: boolean;
};
export type FlowSpec = { nodes: FlowNode[]; edges: FlowEdge[] };

export function narrowFlowSpec(spec: FlowSpec): FlowSpec {
  return {
    ...spec,
    nodes: spec.nodes.map((node, i) => ({
      ...node,
      x: i % 2 ? 2.1 : -2.1,
      y: 5 - Math.floor(i / 2) * 3.4,
      width: Math.min(node.width ?? 2.6, 2.8),
      height: Math.min(node.height ?? 1.1, 1.5),
    })),
  };
}

/** Persistent objects and paths: animation moves payloads, never replaces the diagram. */
export function createFlowGraph(spec: FlowSpec, palette: Palette, overlay: HTMLElement) {
  const group = new T.Group();
  const geometry = new T.BoxGeometry(1, 1, 1);
  const ownedGeometries: T.BufferGeometry[] = [geometry];
  const materials: T.Material[] = [];
  const textures: T.Texture[] = [];
  const nodes = new Map<
    string,
    {
      spec: FlowNode;
      mesh: T.Mesh;
      label: HTMLElement;
      point: T.Vector3;
      texture: T.CanvasTexture;
      ctx: CanvasRenderingContext2D;
      signature: string;
    }
  >();
  const annotations: { node: HTMLElement; point: T.Vector3 }[] = [];
  const material = (color: string, opacity = 1) => {
    const m = new T.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
    materials.push(m);
    return m;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material) => {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
    return mesh;
  };
  for (const n of spec.nodes) {
    const w = n.width ?? 2.6,
      h = Math.max(n.height ?? 1.1, (n.rows ?? 1) <= 4 ? (n.rows ?? 1) * 0.52 : 0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * 150);
    canvas.height = Math.round(h * 150);
    const ctx = canvas.getContext("2d")!;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    textures.push(texture);
    const face = new T.MeshBasicMaterial({ map: texture });
    materials.push(face);
    const side = material(
      n.kind === "weight" ? palette.weight : n.kind === "workers" ? palette.board : palette.metal,
    );
    const mesh = new T.Mesh(geometry, [side, side, side, side, face, side]);
    mesh.position.set(n.x, n.y, 0);
    mesh.scale.set(w, h, n.kind === "weight" ? 0.55 : 0.28);
    group.add(mesh);
    // Physical depth communicates a bank of states, a layer stack or an NPU array.
    if (n.kind === "layers") {
      for (let i = 1; i < 7; i++) box(n.x + i * 0.08, n.y + i * 0.07, -i * 0.18, w, h, 0.09, side);
    }
    if (n.kind === "workers") {
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 4; c++) {
          const x = n.x + ((c - 1.5) * w) / 4,
            y = n.y + ((0.5 - r) * h) / 2;
          box(x, y, 0.3, w / 4 - 0.12, h / 2 - 0.12, 0.12, material(palette.board));
          box(x, y, 0.42, w / 4 - 0.28, h / 2 - 0.25, 0.09, material(palette.chip));
        }
    }
    const label = document.createElement("div");
    label.className = "wiki-flow-label";
    label.dataset.node = n.id;
    label.dataset.side = n.labelBelow ? "below" : "above";
    const title = document.createElement("strong"),
      detail = document.createElement("small");
    title.textContent = n.title;
    detail.textContent = n.detail;
    label.append(title, detail);
    overlay.append(label);
    const point = new T.Vector3(n.x, n.y + (n.labelBelow ? -1 : 1) * (h / 2 + 0.18), 0.5);
    annotations.push({ node: label, point });
    nodes.set(n.id, { spec: n, mesh, label, point, texture, ctx, signature: "" });
  }
  const paint = (id: string, values?: string[], active: number[] = []) => {
    const node = nodes.get(id)!;
    const n = node.spec,
      rows = n.rows ?? 1,
      cols = n.cols ?? 1;
    const texts = values ?? n.values ?? [];
    const signature = `${texts.join("|")}:${active.join(",")}`;
    if (signature === node.signature) return;
    node.signature = signature;
    node.label.dataset.values = texts.join(",");
    const { ctx, texture } = node,
      cw = ctx.canvas.width / cols,
      ch = ctx.canvas.height / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c,
          selected = active.includes(i);
        ctx.fillStyle = selected ? palette.result : n.kind === "weight" ? palette.weightSoft : palette.paper;
        ctx.fillRect(c * cw, r * ch, cw, ch);
        ctx.strokeStyle = n.kind === "weight" ? palette.weight : palette.wire;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
        const value = texts[i] ?? "";
        ctx.fillStyle = selected ? palette.paper : palette.ink;
        ctx.font = `600 ${Math.min(ch * 0.7, cw / (value.length * 0.6 + 1))}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value, (c + 0.5) * cw, (r + 0.5) * ch, cw - 8);
      }
    texture.needsUpdate = true;
  };
  for (const n of spec.nodes) paint(n.id);
  const contextEdges = spec.edges
    .filter(
      (edge, i, all) =>
        (edge.fromCell !== undefined || edge.toCell !== undefined) &&
        all.findIndex((e) => e.from === edge.from && e.to === edge.to) === i,
    )
    .map(({ from, to }) => ({ from, to, start: 0, end: 1, context: true }));
  const paths = [...contextEdges, ...spec.edges].map((edge: FlowEdge) => {
    const a = nodes.get(edge.from)!.mesh,
      b = nodes.get(edge.to)!.mesh;
    const delta = b.position.clone().sub(a.position);
    const vertical = Math.abs(delta.y) > Math.abs(delta.x);
    const from = a.position.clone(),
      to = b.position.clone();
    if (vertical) {
      from.y += (Math.sign(delta.y) * a.scale.y) / 2;
      to.y -= (Math.sign(delta.y) * b.scale.y) / 2;
    } else {
      from.x += (Math.sign(delta.x) * a.scale.x) / 2;
      to.x -= (Math.sign(delta.x) * b.scale.x) / 2;
    }
    from.z = to.z = 0.25;
    const cellPort = (id: string, index: number | undefined, point: T.Vector3, other: T.Vector3) => {
      if (index === undefined) return;
      const { mesh, spec: n } = nodes.get(id)!;
      const rows = n.rows ?? 1,
        cols = n.cols ?? 1;
      const w = mesh.scale.x / cols,
        h = mesh.scale.y / rows;
      point.set(
        mesh.position.x + ((index % cols) + 0.5 - cols / 2) * w,
        mesh.position.y + (rows / 2 - Math.floor(index / cols) - 0.5) * h,
        mesh.scale.z / 2 + 0.02,
      );
      // A row lands on its row edge; a horizontal vector lands below its selected cell.
      if (rows > 1 || cols === 1)
        point.x = mesh.position.x + (Math.sign(other.x - mesh.position.x) * mesh.scale.x) / 2;
      else point.y += (Math.sign(other.y - point.y || -1) * h) / 2;
    };
    cellPort(edge.from, edge.fromCell, from, b.position);
    cellPort(edge.to, edge.toCell, to, a.position);
    const control = from.clone().lerp(to, 0.5);
    control.y += edge.bend ?? 0;
    control.z = 0.45;
    const curve = new T.QuadraticBezierCurve3(from, control, to);
    const geo = new T.TubeGeometry(curve, 24, 0.018, 4, false);
    ownedGeometries.push(geo);
    const lineMaterial = material(palette.wire, 0.65);
    const line = new T.Mesh(geo, lineMaterial);
    group.add(line);
    const arrowGeo = new T.ConeGeometry(0.08, 0.2, 5);
    ownedGeometries.push(arrowGeo);
    const arrow = new T.Mesh(arrowGeo, lineMaterial);
    arrow.position.copy(curve.getPoint(0.92));
    arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), curve.getTangent(0.92).normalize());
    group.add(arrow);
    const packets = Array.from({ length: 3 }, () =>
      box(0, 0, 0, 0.13, 0.09, 0.16, material(edge.result ? palette.result : palette.data)),
    );
    return { edge, curve, line, arrow, lineMaterial, packets };
  });
  const animate = (progress: number) => {
    const active = new Set<string>();
    const activities = new Map<string, string>();
    for (const path of paths) {
      const { edge, curve, line, arrow, packets, lineMaterial } = path;
      const t = (progress - edge.start) / (edge.end - edge.start);
      const moving = !edge.context && t >= 0 && t < 1;
      const cellRoute = edge.fromCell !== undefined || edge.toCell !== undefined;
      line.visible = arrow.visible = !cellRoute || moving;
      lineMaterial.color.set(moving ? (edge.result ? palette.result : palette.data) : palette.wire);
      lineMaterial.opacity = edge.context ? 0.16 : moving ? 1 : 0.5;
      if (moving) {
        active.add(edge.from);
        active.add(edge.to);
        activities.set(edge.from, nodes.get(edge.from)!.spec.kind === "weight" ? "读取权重" : "提供输入");
        activities.set(
          edge.to,
          nodes.get(edge.to)!.spec.kind === "operator" ? "正在计算" : edge.result ? "接收结果" : "接收输入",
        );
      }
      packets.forEach((packet, index) => {
        // Highlight the receiving cell first; deliver at the same instant its value is written.
        const at = cellRoute ? (t - 0.18) / 0.82 : t * 1.35 - index * 0.15;
        packet.visible = moving && at >= 0 && at <= 1 && (!cellRoute || index === 0);
        if (packet.visible) {
          packet.position.copy(curve.getPoint(at));
          packet.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), curve.getTangent(at).normalize());
        }
      });
    }
    for (const [id, n] of nodes) {
      n.label.dataset.active = String(active.has(id));
      n.label.dataset.activity = activities.get(id) ?? "";
    }
  };
  const projected = new T.Vector3();
  return {
    group,
    paint,
    animate,
    label(id: string, title: string, detail?: string) {
      const n = nodes.get(id)!;
      n.label.querySelector("strong")!.textContent = title;
      if (detail !== undefined) n.label.querySelector("small")!.textContent = detail;
    },
    project(camera: T.Camera, width: number, height: number, top = 0) {
      group.updateMatrixWorld(true);
      for (const { node, point } of annotations) {
        projected.copy(point).applyMatrix4(group.matrixWorld).project(camera);
        node.style.left = `${(((projected.x + 1) * width) / 2).toFixed(1)}px`;
        node.style.top = `${(top + ((1 - projected.y) * height) / 2).toFixed(1)}px`;
      }
    },
    dispose() {
      for (const { node } of annotations) node.remove();
      for (const g of ownedGeometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      group.removeFromParent();
    },
  };
}

/** The same branched FFN is used for a dense layer and one complete routed expert. */
export function ffnSpec(hidden = "4096", intermediate = "12288"): FlowSpec {
  return {
    nodes: [
      {
        id: "input",
        title: "输入 hidden",
        detail: hidden,
        x: -5.6,
        y: 0,
        width: 1.2,
        height: 1.8,
        rows: 8,
        kind: "tensor",
      },
      {
        id: "gate",
        title: "W_gate",
        detail: `${hidden} → ${intermediate}`,
        x: -2.5,
        y: 1.9,
        width: 2,
        height: 1.35,
        rows: 6,
        cols: 10,
        kind: "weight",
      },
      {
        id: "up",
        title: "W_up",
        detail: `${hidden} → ${intermediate}`,
        x: -2.5,
        y: -1.9,
        width: 2,
        height: 1.35,
        rows: 6,
        cols: 10,
        kind: "weight",
      },
      {
        id: "silu",
        title: "SiLU(gate)",
        detail: "min(g, 10) → SiLU",
        x: 0.3,
        y: 1.9,
        width: 1.6,
        height: 0.7,
        kind: "operator",
        values: ["SiLU"],
      },
      {
        id: "clamp",
        title: "up 限幅",
        detail: "clamp(u, −10, 10)",
        x: 0.3,
        y: -1.9,
        width: 1.6,
        height: 0.7,
        kind: "operator",
        values: ["clamp"],
      },
      {
        id: "multiply",
        title: "对应通道相乘",
        detail: intermediate,
        x: 1,
        y: -0.7,
        width: 1.6,
        height: 1.05,
        rows: 1,
        cols: 1,
        values: ["⊙"],
        kind: "operator",
      },
      {
        id: "down",
        title: "W_down",
        detail: `${intermediate} → ${hidden}`,
        x: 3.9,
        y: -0.7,
        width: 1.6,
        height: 1.9,
        rows: 10,
        cols: 6,
        kind: "weight",
      },
      {
        id: "output",
        title: "输出 Δ",
        detail: hidden,
        x: 6.7,
        y: -0.7,
        width: 1,
        height: 1.4,
        rows: 8,
        kind: "tensor",
      },
    ],
    edges: [
      { from: "input", to: "gate", start: 0, end: 0.25 },
      { from: "input", to: "up", start: 0, end: 0.25 },
      { from: "gate", to: "silu", start: 0.25, end: 0.5 },
      { from: "up", to: "clamp", start: 0.25, end: 0.5 },
      { from: "silu", to: "multiply", start: 0.5, end: 0.75 },
      { from: "clamp", to: "multiply", start: 0.5, end: 0.75 },
      { from: "multiply", to: "down", start: 0.75, end: 0.88 },
      { from: "down", to: "output", start: 0.88, end: 1, result: true },
    ],
  };
}
