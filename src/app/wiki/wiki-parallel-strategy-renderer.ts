import * as T from "three";
import type { Line2 } from "three/addons/lines/Line2.js";
import {
  DP_INPUT,
  DP_KIND,
  DP_OUTPUT,
  DP_REQUESTS,
  dpMotion,
  EP_EXPERT_OUTPUTS,
  EP_EXPERTS,
  EP_HIDDEN,
  EP_LOGITS_PREVIEW,
  EP_OUTPUT,
  EP_ROUTED,
  EP_ROUTED_ROWS,
  EP_SCORES,
  EP_SHARED,
  EP_SOURCE,
  EP_WEIGHTS,
  epAccumulation,
  epMotion,
  SAMPLE_TOKENS,
  TP_CARDS,
  TP_KIND,
  TP_PARTIALS,
  TP_SUM,
  tpInputSlice,
  tpMotion,
  tpWeightSlice,
} from "./scene-parallel-strategy";

type Cells = T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[];
export type StrategyGrid = {
  group: T.Group;
  cells: Cells;
  numbers: HTMLElement[];
  title: HTMLElement;
  outlines: Line2[];
  rows: number;
  cols: number;
  pitch: number;
  cellWidth: number;
};
type GridOptions = {
  wide?: number;
  rows?: number;
  cols?: number;
  rowNames?: readonly string[];
  axis?: string | false;
  focusRow?: number;
};
/** The PP renderer's own parts, handed over so every parallel scene shares one visual language. */
export type StrategyKit = {
  root: T.Group;
  ports: T.Vector3[];
  palette: { data: string; result: string };
  cardColors: string[];
  label: (
    text: string,
    parent: T.Object3D,
    point: T.Vector3,
    kind?: string,
    visible?: () => boolean,
  ) => HTMLElement;
  line: (color: string, dashed?: boolean, width?: number) => Line2;
  connect: (l: Line2, points: T.Vector3[]) => void;
  socket: (parent: T.Object3D, point: T.Vector3, count?: number, size?: number) => T.LineSegments;
  grid: (name: string, point: T.Vector3, color: string, o?: GridOptions) => StrategyGrid;
  paintGrid: (
    t: StrategyGrid,
    values: readonly (readonly (number | string)[])[],
    color: string | ((row: number, column: number) => string),
    amount?: number,
    unfold?: number,
    focus?: number,
  ) => void;
  matrixSlot: (point: T.Vector3, scale?: number, cols?: number, rows?: number) => T.LineSegments;
  header: HTMLElement;
  footer: HTMLElement;
  payloads: T.InstancedMesh[];
  chips?: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>[];
  hardwareGroup: T.Group;
  boardCenters: number[];
  orb?: (color: string, radius?: number) => T.Mesh<T.SphereGeometry, T.MeshStandardMaterial>;
  pick?: (object: T.Object3D, action: () => void) => void;
  seek?: (progress: number) => void;
};
export type StrategyContent = {
  animate(p: number): void;
  glow(card: number, p: number): boolean;
  glowColor?: (card: number, p: number) => string | undefined;
  result: string;
  camera: { half: number; targetY: number; footerY: number };
};

const v = (x: number, y: number, z = 0) => new T.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const SUB = "₀₁₂₃";
/** Shared mineral palette across TP, DP and EP (Cobalt input, Cinnabar-Coral weights, Celadon-Jade outputs). */
const MINERAL = {
  data: "#85a9ec",
  weight: "#e0948b",
  result: "#78c8b0",
  shared: "#a8cfc3",
  pad: "#d2d7da",
  lineData: "#4e69bd",
  lineWeight: "#b5564d",
  lineResult: "#12826c",
  lineCross: "#a44a84",
  linePad: "#8a96a3",
  tpCards: ["#85a9ec", "#e0948b", "#a985c6", "#6bb6c9"],
  tpLines: ["#4e69bd", "#b5564d", "#7b5399", "#377f94"],
} as const;

/** Same-direction S route between two matrix centres, drawn behind the matrices it joins. */
const sRoute = (a: T.Vector3, b: T.Vector3, bend = 0.5) => {
  const d = Math.abs(a.y - b.y) * bend;
  const dir = b.y < a.y ? -1 : 1;
  return new T.CubicBezierCurve3(
    a.clone().setZ(0.1),
    v(a.x, a.y + dir * d, 0.1),
    v(b.x, b.y - dir * d, 0.1),
    b.clone().setZ(0.1),
  );
};

/** A fixed transfer aisle with rounded corners and exact matrix-slot endpoints. */
export function epTransferPath(a: T.Vector3, b: T.Vector3, laneX: number): T.Curve<T.Vector3> {
  if (a.y === b.y) return new T.LineCurve3(a.clone(), b.clone());
  const points = [a, v(laneX, a.y, a.z), v(laneX, b.y, b.z), b].filter(
    (p, i, all) => i === 0 || p.distanceTo(all[i - 1]!) > 1e-6,
  );
  const path = new T.CurvePath<T.Vector3>();
  let cursor = a;
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i]!;
    const before = points[i - 1]!.clone().sub(corner);
    const after = points[i + 1]!.clone().sub(corner);
    const radius = Math.min(0.22, before.length() / 2, after.length() / 2);
    const entry = corner.clone().add(before.normalize().multiplyScalar(radius));
    const exit = corner.clone().add(after.normalize().multiplyScalar(radius));
    path.add(new T.LineCurve3(cursor, entry));
    path.add(new T.QuadraticBezierCurve3(entry, corner, exit));
    cursor = exit;
  }
  path.add(new T.LineCurve3(cursor, b));
  return path;
}

/**
 * TP / DP / EP in the PP language: whole matrices with named rows travel between the
 * card they belong to and the expanded work area, land, compute, then return to a card.
 */
export function mountStrategyContent(kit: StrategyKit, kind: number): StrategyContent {
  if (kind === TP_KIND) return tensorParallel(kit);
  if (kind === DP_KIND) return dataParallel(kit);
  return expertParallel(kit);
}

/** Labels are shown by the renderer's caption pass; a flag keeps them under the scene's control. */
const flagged = (kit: StrategyKit) => (text: string, parent: T.Object3D, point: T.Vector3, kind?: string) => {
  const el: HTMLElement = kit.label(text, parent, point, kind, () => el.dataset.off !== "1");
  return el;
};
const setOn = (el: HTMLElement, on: boolean) => {
  el.dataset.off = on ? "0" : "1";
};

const shared = (kit: StrategyKit) => ({
  show: (t: { group: T.Group }, visible: boolean) => {
    t.group.visible = visible;
  },
  move: (t: StrategyGrid, point: T.Vector3, scale = 1) => {
    t.group.position.copy(point);
    t.group.scale.setScalar(scale);
  },
  solid: (color: string) => kit.line(color, false, 2.8),
  dashed: (color: string) => kit.line(color, true),
  operator: (text: string, point: T.Vector3) => flagged(kit)(text, kit.root, point, "operator"),
  /** Travel along a route, drawing it only while the matrix is on the way. */
  travel: (t: StrategyGrid, route: Line2, curve: T.Curve<T.Vector3>, k: number, from: number, to: number) => {
    t.group.position.copy(curve.getPoint(k));
    t.group.scale.setScalar(lerp(from, to, k));
    route.visible = t.group.visible && k > 0 && k < 1;
    kit.connect(route, curve.getPoints(32));
  },
});

/**
 * The card's own payload cubes fly from a whole logical object below the hardware to their
 * resident slots, as PP's layers do; at t = 1 every instance is back at its exact home matrix.
 */
const payloadFlight = (kit: StrategyKit) => {
  const g = kit.hardwareGroup;
  g.updateMatrixWorld(true);
  const m = new T.Matrix4(),
    w = new T.Vector3(),
    q = new T.Quaternion(),
    s = new T.Vector3();
  const homes = kit.payloads.map((p) => {
    p.frustumCulled = false;
    return Array.from({ length: p.count }, (_, i) => {
      p.getMatrixAt(i, m);
      return new T.Vector3().setFromMatrixPosition(m);
    });
  });
  // Facing the reader while laid out; tilted with the board once seated.
  const upright = new T.Quaternion().setFromEuler(new T.Euler(-g.rotation.x, 0, 0));
  const seated = new T.Quaternion();
  const settled = kit.payloads.map(() => false);
  const moved = kit.payloads.map(() => false);
  return {
    fly(card: number, i: number, from: T.Vector3, t: number, size = 1, lift = 2.4) {
      if (t >= 1 && settled[card]) return;
      const payload = kit.payloads[card]!,
        home = homes[card]![i]!;
      if (t >= 1) m.makeTranslation(home.x, home.y, home.z);
      else {
        w.copy(from).lerp(g.localToWorld(home.clone()), t);
        w.z += Math.sin(t * Math.PI) * lift;
        g.worldToLocal(w);
        q.copy(upright).slerp(seated, t);
        m.compose(w, q, s.setScalar(size));
      }
      payload.setMatrixAt(i, m);
      moved[card] = true;
    },
    sync(card: number, allLanded: boolean) {
      if (!moved[card]) return;
      const payload = kit.payloads[card]!;
      payload.instanceMatrix.needsUpdate = true;
      payload.computeBoundingSphere();
      moved[card] = false;
      settled[card] = allLanded;
    },
  };
};

function tensorParallel(kit: StrategyKit): StrategyContent {
  const { ports, grid, paintGrid, matrixSlot, header, footer } = kit;
  const palette = { data: MINERAL.data, result: MINERAL.result };
  const label = flagged(kit);
  const { show, move, solid, dashed, operator, travel } = shared(kit);
  const colors = MINERAL.tpCards;
  const lines = MINERAL.tpLines;
  const xs = ports.map((p) => p.x);
  const miniY = -0.12;
  const mini = (g: number) => v(xs[g]!, miniY, 0.3);
  const wLanded = (g: number) => ports[g]!.clone().add(v(0, -0.28, 0));
  kit.payloads.forEach((p) => {
    p.visible = false;
  });
  // The full logical X and W are assembled from the four card slices, so the split is literal.
  const X0 = v(-3.2, -2.55, 0.5),
    W0 = v(2.8, -2.75, 0.5);
  const xCenter = (g: number, open: number) => X0.x + (g - 1.5) * (0.77 + 0.42 * open);
  const wCenter = (g: number, open: number) => W0.y + (1.5 - g) * (1.0 + 0.3 * open);
  const xSlices = Array.from({ length: TP_CARDS }, (_, g) =>
    grid("", X0, colors[g]!, { cols: 2, rowNames: g === 0 ? SAMPLE_TOKENS : [], axis: false }),
  );
  const wSlices = Array.from({ length: TP_CARDS }, (_, g) =>
    grid("", W0, colors[g]!, {
      rows: 2,
      cols: 4,
      rowNames: [`通道${2 * g}`, `通道${2 * g + 1}`],
      axis: false,
      focusRow: -1,
    }),
  );
  const xTitle = label("输入 X · 4 个 token × 8 个输入通道", kit.root, v(X0.x, X0.y + 1.35, 0.4), "name");
  const wTitle = label(
    "down 权重 W · 8 个输入通道 × 4 个输出通道",
    kit.root,
    v(W0.x, W0.y + 2.6, 0.4),
    "name",
  );
  const xAxis = label("8 个输入通道 →", kit.root, v(X0.x, X0.y - 1.4, 0.4), "note");
  const xCuts = [0, 1, 2].map(() => dashed(MINERAL.lineWeight));
  const wCuts = [0, 1, 2].map(() => dashed(MINERAL.lineWeight));
  const tagPoints = Array.from({ length: TP_CARDS }, () => v(0, 0, 0.4));
  const tags = tagPoints.map((point, g) => label(`卡${g}`, kit.root, point, "name small"));
  const minis = {
    x: Array.from({ length: TP_CARDS }, (_, g) =>
      grid("", mini(g), colors[g]!, { cols: 2, rowNames: [], axis: false }),
    ),
    p: Array.from({ length: TP_CARDS }, (_, g) =>
      grid("", mini(g), colors[g]!, { cols: 4, rowNames: [], axis: false }),
    ),
    y: Array.from({ length: TP_CARDS }, (_, g) =>
      grid("", mini(g), palette.result, { cols: 4, rowNames: [], axis: false, focusRow: -1 }),
    ),
  };
  const miniTagPoints = xs.map((x) => v(x, miniY + 0.72, 0.4));
  const miniTags = miniTagPoints.map((point) => label("", kit.root, point, "name small"));
  // Phase 1: card 0 expanded; the other three cards compute at the same time above.
  const bigHome = [v(-4.85, -2.45, 0.5), v(-1.15, -2.45, 0.5), v(3.0, -2.45, 0.5)];
  const bigX = grid("卡0 的输入 X₀ · 4×2", bigHome[0]!, colors[0]!, { cols: 2, axis: "通道0、1" });
  const bigW = grid("卡0 的权重 W₀ · 2×4", bigHome[1]!, colors[0]!, {
    rows: 2,
    cols: 4,
    rowNames: ["通道0", "通道1"],
    axis: "4 个输出通道 →",
    focusRow: -1,
  });
  const bigP = grid("部分和 P₀ · 4×4", bigHome[2]!, colors[0]!, { cols: 4, axis: "每格只加了 2 个通道" });
  const ops1 = [operator("×", v(-3.55, -2.45, 0.5)), operator("=", v(0.85, -2.45, 0.5))];
  const extract = dashed(MINERAL.lineResult);
  const expandRoutes = [solid(lines[0]!), solid(MINERAL.lineWeight)];
  // Phase 2: the four partial sums line up and add cell by cell.
  const sumXs = [-5.45, -3.15, -0.85, 1.45];
  const sumY = -2.45,
    totalHome = v(4.95, sumY, 0.5);
  const gathered = Array.from({ length: TP_CARDS }, (_, g) =>
    grid("", v(sumXs[g]!, sumY, 0.5), colors[g]!, {
      cols: 4,
      rowNames: g === 0 ? SAMPLE_TOKENS : [],
      axis: false,
    }),
  );
  const total = grid("Y = P₀ + P₁ + P₂ + P₃", totalHome, palette.result, {
    cols: 4,
    axis: "4 个输出通道 →",
    focusRow: -1,
  });
  const plus = [0, 1, 2].map((g) => operator("+", v((sumXs[g]! + sumXs[g + 1]!) / 2, sumY, 0.5)));
  const equals = operator("=", v(3.2, sumY, 0.5));
  const gatherRoutes = lines.slice(0, TP_CARDS).map((c) => solid(c));
  const sumSlot = matrixSlot(totalHome, 1, 4);
  const broadcastRoutes = Array.from({ length: TP_CARDS }, () => solid(MINERAL.lineResult));
  const miniSlots = xs.map((x) => matrixSlot(v(x, miniY, 0.3), 0.4, 4));
  return {
    glow: (i, p) => i < TP_CARDS && tpMotion(p).phase >= 1,
    glowColor: (i, p) => (tpMotion(p).phase === 3 ? MINERAL.lineResult : (lines[i] ?? MINERAL.lineData)),
    result: TP_SUM.map((r) => r.join(",")).join(";"),
    camera: { half: 6.7, targetY: -0.55, footerY: -6.1 },
    animate(p) {
      const m = tpMotion(p);
      const { split: open, land } = m;
      header.textContent = [
        land === 0 ? "TP · 一次 down 投影切给 4 张卡" : "TP · 权重片落卡，常驻显存",
        "四卡同时算部分和 · 展开卡0",
        "All-Reduce · 同位置逐格相加",
        m.broadcast === 0
          ? "All-Reduce 相加完成 · 准备分发 Y 回各卡"
          : m.broadcast < 1
            ? "All-Reduce 分发 · 完整 Y 写回每张卡"
            : "All-Reduce 完成 · 每卡都有完整 Y",
      ][m.phase]!;
      footer.textContent = [
        "逻辑全貌：X 的同号列与 W 的同号行属于同一张卡",
        "卡1–3 同时在上方写出自己的部分和",
        "每格 = 四份同位置部分和之和；不同 token 行不混合",
        "权重片始终留在原卡",
      ][m.phase]!;
      // Setup: whole X and W, split along input channels, then land on the cards.
      const setup = m.phase === 0;
      xSlices.forEach((t, g) => {
        show(t, setup);
        const from = v(xCenter(g, open), X0.y, 0.5);
        t.group.position.copy(from).lerp(mini(g), land);
        t.group.position.z += Math.sin(land * Math.PI) * 2.4;
        t.group.scale.setScalar(lerp(1, 0.4, land));
        paintGrid(t, tpInputSlice(g), colors[g]!, 1, m.reveal);
        t.outlines.forEach((o) => {
          o.visible = open > 0.5;
        });
      });
      wSlices.forEach((t, g) => {
        const from = v(W0.x, wCenter(g, open), 0.5);
        t.group.position.copy(from).lerp(wLanded(g), land);
        t.group.position.z += Math.sin(land * Math.PI) * 2.4;
        t.group.scale.setScalar(lerp(1, 0.3, land));
        paintGrid(t, tpWeightSlice(g), colors[g]!, 1, m.reveal, -1);
        t.outlines.forEach((o) => {
          o.visible = open > 0.5;
        });
      });
      [xTitle, wTitle, xAxis].forEach((el) => {
        setOn(el, !(!setup || land > 0));
      });
      xCuts.forEach((c, i) => {
        c.visible = setup && open > 0 && land === 0;
        const x = (xCenter(i, open) + xCenter(i + 1, open)) / 2;
        kit.connect(c, [v(x, X0.y + 1.1, 0.8), v(x, X0.y - 1.1, 0.8)]);
      });
      wCuts.forEach((c, i) => {
        c.visible = setup && open > 0 && land === 0;
        const y = (wCenter(i, open) + wCenter(i + 1, open)) / 2;
        kit.connect(c, [v(W0.x - 1.35, y, 0.8), v(W0.x + 1.0, y, 0.8)]);
      });
      tags.forEach((el, g) => {
        setOn(el, !!(setup && open === 1 && land === 0));
        tagPoints[g]!.set(W0.x + 1.55, wCenter(g, open), 0.4);
      });
      // Card-side minis: X_g after landing, P_g while computing, then the shared Y.
      minis.x.forEach((t, g) => {
        show(t, (setup && land === 1) || (m.phase === 1 && m.partial < 1));
        move(t, mini(g), 0.4);
        paintGrid(t, tpInputSlice(g), colors[g]!);
        if (m.phase === 1)
          t.cells.forEach((c) => {
            c.material.opacity *= 1 - m.partial;
          });
      });
      minis.p.forEach((t, g) => {
        show(t, (m.phase === 1 && m.partial > 0) || (m.phase === 2 && m.gather === 0));
        move(t, mini(g), 0.4);
        paintGrid(t, TP_PARTIALS[g]!, colors[g]!, m.partial);
      });
      miniTags.forEach((el, g) => {
        el.textContent =
          (setup && land === 1) || (m.phase === 1 && m.partial === 0)
            ? `X${SUB[g]}`
            : (m.phase === 1 && m.partial > 0) || (m.phase === 2 && m.gather === 0)
              ? `P${SUB[g]}`
              : m.phase === 3 && m.broadcast === 1
                ? "Y"
                : "";
      });
      miniSlots.forEach((s) => {
        s.visible = m.phase === 3 && m.broadcast > 0.4 && m.broadcast < 1;
      });
      // Phase 1: card 0's slices travel from their actual landed positions into the work area.
      const p1 = m.phase === 1;
      [bigX, bigW, bigP].forEach((t) => {
        show(t, p1);
      });
      ops1.forEach((o) => {
        setOn(o, !(!p1 || m.expand < 1));
      });
      extract.visible = p1;
      kit.connect(extract, [ports[0]!, v(-6.25, ports[0]!.y, 1.2), v(-6.25, -0.7, 1.2), v(-4.0, -0.7, 0.6)]);
      travel(bigX, expandRoutes[0]!, sRoute(mini(0), bigHome[0]!, 0.5), p1 ? m.expand : 0, 0.4, 1);
      travel(bigW, expandRoutes[1]!, sRoute(wLanded(0), bigHome[1]!, 0.5), p1 ? m.expand : 0, 0.3, 1);
      paintGrid(bigX, tpInputSlice(0), colors[0]!);
      paintGrid(bigW, tpWeightSlice(0), colors[0]!, 1, 1, -1);
      paintGrid(bigP, TP_PARTIALS[0]!, colors[0]!, m.partial);
      // Phase 2: four partials travel down and add cell by cell.
      const p2 = m.phase === 2;
      gathered.forEach((t, g) => {
        show(t, m.phase >= 2);
        travel(t, gatherRoutes[g]!, sRoute(mini(g), v(sumXs[g]!, sumY, 0.5), 0.5), m.gather, 0.4, 1);
        t.title.textContent = m.gather === 1 ? `P${SUB[g]} · 卡${g}` : "";
        paintGrid(t, TP_PARTIALS[g]!, colors[g]!);
      });
      show(total, (p2 && m.gather === 1) || m.phase === 3);
      paintGrid(total, TP_SUM, palette.result, m.sum, 1, -1);
      sumSlot.visible = p2 && m.gather > 0.6 && m.sum === 0;
      plus.forEach((o) => {
        setOn(o, !!((p2 && m.gather === 1) || m.phase === 3));
      });
      setOn(equals, (p2 && m.gather === 1) || m.phase === 3);
      // Phase 3: Y returns to every card of the group.
      minis.y.forEach((t, g) => {
        show(t, m.phase === 3 && m.broadcast > 0);
        travel(t, broadcastRoutes[g]!, sRoute(totalHome, mini(g), 0.5), m.broadcast, 1, 0.4);
        paintGrid(t, TP_SUM, palette.result, 1, 1, -1);
      });
    },
  };
}

function dataParallel(kit: StrategyKit): StrategyContent {
  const { ports, grid, paintGrid, matrixSlot, header, footer } = kit;
  const palette = { data: MINERAL.data, result: MINERAL.result };
  const label = flagged(kit);
  const { show, solid, dashed, travel } = shared(kit);
  const centers = kit.boardCenters.map((x) => kit.hardwareGroup.localToWorld(v(x, 0, 0)).x);
  const miniY = Math.min(...ports.map((p) => p.y)) - 1.5;
  const groupMini = (g: number) => v(centers[g]!, miniY, 0.3);
  // Harmonize DP payload cubes with the mineral palette: TP8-sharded dense (Cobalt),
  // 727.5 MiB per-card replicated modules (Deep Cobalt), and 18/card experts (Coral / Plum).
  const cubeColor = new T.Color();
  kit.payloads.forEach((payload, card) => {
    for (let i = 0; i < payload.count; i++) {
      cubeColor.set(
        i < 12 ? MINERAL.data : i < 16 ? MINERAL.lineData : card < 8 ? MINERAL.weight : "#b07cb0",
      );
      payload.setColorAt(i, cubeColor);
    }
    if (payload.instanceColor) payload.instanceColor.needsUpdate = true;
  });
  kit.boardCenters.forEach((x, b) => {
    label(`DP${b} · 服务器${b} · 卡${b * 8}–${b * 8 + 7}`, kit.hardwareGroup, v(x, 0.5, -2.65), "name");
  });
  const residency = kit.boardCenters.map((x, b) =>
    label(
      b
        ? "TP8 可切稠密 + 727.5 MiB 逐卡复制 + 144 专家 (E144–E287)"
        : "TP8 可切稠密 + 727.5 MiB 逐卡复制 + 144 专家 (E0–E143)",
      kit.hardwareGroup,
      v(x, -0.35, 2.75),
      "note",
    ),
  );
  const frontEnd = label("API 前端 · 分词、打分、选组", kit.root, v(0, miniY - 0.55, 0.4), "name");
  const scoreLabels = [0, 1].map((g) =>
    label("", kit.root, v(g ? 2.6 : -2.6, miniY - 1.25, 0.4), "equation"),
  );
  const userPoints = [v(-5.9, -5.85, 0.4), v(5.9, -5.85, 0.4)];
  const users = DP_REQUESTS.map((r, g) => label(`用户${r.user}`, kit.root, userPoints[g]!, "name"));
  const requestHome = v(0, -4.0, 0.5);
  const requests = DP_REQUESTS.map((r) =>
    grid(`请求 ${r.name}`, requestHome, palette.data, { rowNames: r.tokens, focusRow: -1 }),
  );
  const workHome = [v(-3.65, -3.55, 0.5), v(3.65, -3.55, 0.5)];
  const results = DP_REQUESTS.map((r, g) =>
    grid("", workHome[g]!, palette.result, { rowNames: r.tokens, focusRow: -1 }),
  );
  const routes = [0, 1].map(() => solid(MINERAL.lineData));
  const expandRoutes = [0, 1].map(() => solid(MINERAL.lineData));
  const slots = [0, 1].map((g) => matrixSlot(groupMini(g), 0.4));
  const extracts = [0, 1].map(() => dashed(MINERAL.lineResult));
  const replies = DP_REQUESTS.map(() =>
    grid("", v(0, 0, 0.6), palette.result, { rows: 1, cols: 1, rowNames: [], axis: false, focusRow: 0 }),
  );
  const replyRoutes = [0, 1].map(() => solid(MINERAL.lineResult));
  const moeLink = dashed(MINERAL.lineCross);
  const moeNote = label(
    "MoE 层：请求与 KV 留原组，但 token 会临时跨机访问对侧 144 位专家（见 EP）",
    kit.root,
    v(0, miniY - 0.45, 0.4),
    "note",
  );
  const replyFrom = (g: number) => v(workHome[g]!.x + (g ? -2.25 : 2.25), workHome[g]!.y - 0.75, 0.6);
  // Phase 0: one dense copy and one expert set below the boards → copy → cut → land.
  const { fly, sync: syncPayloadBounds } = payloadFlight(kit);
  const pitch = 0.18,
    denseY = -1.95,
    expertY = -4.35;
  const denseSlice = 4 * pitch,
    expertGroup = 3 * pitch;
  const denseX = (g: number, slice: number, copy: number, cut: number) =>
    lerp(0, centers[g]!, copy) + (slice - 3.5) * (denseSlice + 0.12 * cut);
  const expertX = (card: number, cut: number) => {
    const g = card < 8 ? 0 : 1,
      k = card % 8;
    return (
      (g ? 1 : -1) * lerp(4 * expertGroup, Math.abs(centers[g]!), cut) + (k - 3.5) * (expertGroup + 0.1 * cut)
    );
  };
  const source = (card: number, i: number, m: ReturnType<typeof dpMotion>) => {
    const g = card < 8 ? 0 : 1;
    if (i < 16)
      return v(
        denseX(g, card % 8, m.copy, m.cut) + ((i % 4) - 1.5) * pitch,
        denseY + (1.5 - Math.floor(i / 4)) * pitch,
        0.4 - (g ? 0.3 * (1 - m.copy) : 0),
      );
    const j = i - 16;
    return v(expertX(card, m.cut) + ((j % 3) - 1) * pitch, expertY + (2.5 - Math.floor(j / 3)) * pitch, 0.4);
  };
  const denseTitlePoints = [0, 1].map(() => v(0, denseY + 0.62, 0.4));
  const denseTitles = denseTitlePoints.map((point) => label("", kit.root, point, "name"));
  const expertTitlePoints = [0, 1, 2].map(() => v(0, expertY + 0.82, 0.4));
  const expertTitles = expertTitlePoints.map((point) => label("", kit.root, point, "name"));
  const denseCuts = Array.from({ length: 14 }, () => dashed(MINERAL.lineWeight));
  const expertCut = dashed(MINERAL.lineCross);
  return {
    glow: (i, p) => {
      const m = dpMotion(p);
      const g = i < 8 ? 0 : 1;
      return m.phase === 3 || (m.phase >= g + 1 && m.phase < 3 && m.route[g]! === 1);
    },
    glowColor: (i, p) => {
      const m = dpMotion(p);
      if (m.phase === 4) return MINERAL.lineResult;
      return i < 8 ? MINERAL.lineData : MINERAL.lineCross;
    },
    result: DP_REQUESTS.map((r) => `${r.name}:${r.reply}`).join(","),
    camera: { half: 7.4, targetY: -0.6, footerY: -6.75 },
    animate(p) {
      const m = dpMotion(p);
      header.textContent = [
        m.copy === 0
          ? "DP · 先看全貌：非专家权重，一套路由专家"
          : m.land === 0
            ? "部署模型 · 可切稠密 TP8 + 复制项 727.5 MiB/卡，专家分 16 份"
            : m.land < 0.96
              ? "权重正分落两台机器 16 张卡…"
              : "权重落卡 · 两台机器各是一个执行组",
        "请求 A 到达 · 前端选组",
        "请求 B 到达 · 前端选组",
        "两组算各自请求 · MoE 层 token 临时跨机访专家",
        "回复送回各自的用户",
      ][m.phase]!;
      footer.textContent =
        m.phase === 0
          ? m.land < 0.96
            ? "钴蓝格：TP8 可切稠密与 727.5 MiB 逐卡复制项 · 珊瑚/梅紫格：288 位专家（每机 144、每卡 18）"
            : "每卡：TP8 可切稠密 1/8 + 727.5 MiB 逐卡复制（router/mHC 等）+ 18 位专家（每机 144）"
          : m.phase < 3
            ? "分数 = 等待请求数 × 4 + 运行请求数 · 先比较选组，再预记 +4 并派发"
            : "请求队列与 KV cache 留在原组；到 MoE 层时 token 仍跨机访问另一台 144 位专家";
      residency.forEach((el) => {
        setOn(el, m.phase === 0 && m.land >= 0.96);
      });
      // Phase 0: the cubes on the cards are the very cubes laid out below, so the split is literal.
      kit.payloads.forEach((payload, card) => {
        let allLanded = true;
        for (let i = 0; i < payload.count; i++) {
          const stagger = (card % 8) * 0.025 + (i < 16 ? 0 : 0.06);
          const t = m.phase > 0 ? 1 : clamp01((m.land - stagger) / 0.72);
          if (t < 1) allLanded = false;
          fly(card, i, source(card, i, m), t, m.reveal);
        }
        syncPayloadBounds(card, allLanded);
      });
      const laying = m.phase === 0 && m.land === 0;
      denseTitles.forEach((el, g) => {
        setOn(el, laying && (g === 0 || m.copy > 0.5));
        denseTitlePoints[g]!.set(lerp(0, centers[g]!, m.copy), denseY + 0.62, 0.4);
        el.textContent =
          m.copy < 0.5
            ? "非专家权重（可切稠密 + 逐卡复制项）"
            : m.cut === 0
              ? `DP${g} 的非专家权重`
              : `DP${g} · 可切项 TP8 切 1/8 + 727.5 MiB 逐卡复制`;
      });
      expertTitles.forEach((el, k) => {
        const halves = m.cut > 0;
        setOn(el, laying && m.reveal > 0.5 && (k === 2 ? !halves : halves));
        expertTitlePoints[k]!.set(
          k === 2 ? 0 : expertX(k ? 12 : 4, m.cut) - (expertGroup + 0.1 * m.cut) / 2,
          expertY + 0.82,
          0.4,
        );
        el.textContent = [
          "E0–E143 → 服务器0 · 144 位（每卡 18 位）",
          "E144–E287 → 服务器1 · 144 位（每卡 18 位）",
          "路由专家 E0–E287 · 全集群一套（每机 144、每卡 18）",
        ][k]!;
      });
      denseCuts.forEach((c, k) => {
        const g = k < 7 ? 0 : 1,
          s = k % 7;
        c.visible = laying && m.cut > 0;
        const x = (denseX(g, s, m.copy, m.cut) + denseX(g, s + 1, m.copy, m.cut)) / 2;
        kit.connect(c, [v(x, denseY + 0.45, 0.8), v(x, denseY - 0.45, 0.8)]);
      });
      expertCut.visible = laying && m.cut > 0;
      const mid = (expertX(7, m.cut) + expertX(8, m.cut)) / 2;
      kit.connect(expertCut, [v(mid, expertY + 0.65, 0.8), v(mid, expertY - 0.65, 0.8)]);
      const choosing = m.phase === 1 || m.phase === 2;
      setOn(frontEnd, !!choosing);
      scoreLabels.forEach((el, g) => {
        setOn(el, !!choosing);
        const own = m.phase - 1;
        const decided = m.score[own]! === 1;
        const waiting = m.scores[g]! / 4;
        const suffix = decided && g === own ? (waiting === 0 ? " ← 选中（待预记）" : " ← 已预记 +4") : "";
        el.textContent = `DP${g}：等待${waiting}×4 + 运行0 = ${waiting * 4}${suffix}`;
        el.style.fontWeight = decided && g === own ? "700" : "400";
      });
      users.forEach((el) => {
        setOn(el, !(m.phase === 0));
      });
      requests.forEach((t, g) => {
        const own = g + 1;
        show(t, m.phase >= own && m.phase < 3);
        travel(t, routes[g]!, sRoute(requestHome, groupMini(g), 0.45), m.route[g]!, 1, 0.4);
        t.title.textContent =
          m.route[g]! > 0.1 ? "" : `请求 ${DP_REQUESTS[g]!.name} · 用户${DP_REQUESTS[g]!.user}：4 个 token`;
        paintGrid(t, DP_INPUT[g]!, palette.data, 1, m.arrive[g]!, -1);
        slots[g]!.visible = m.phase === own && m.score[g]! === 1 && m.route[g]! < 1;
      });
      const work = m.phase >= 3;
      results.forEach((t, g) => {
        show(t, work);
        travel(t, expandRoutes[g]!, sRoute(groupMini(g), workHome[g]!, 0.45), work ? m.expand : 0, 0.4, 1);
        t.title.textContent = m.expand === 1 ? `DP${g} 用本机 8 卡算请求 ${DP_REQUESTS[g]!.name}` : "";
        if (m.compute === 0) paintGrid(t, DP_INPUT[g]!, palette.data, 1, 1, -1);
        else paintGrid(t, DP_OUTPUT[g]!, palette.result, m.compute, 1, 3);
        extracts[g]!.visible = work && m.expand === 1;
        kit.connect(extracts[g]!, [
          groupMini(g).add(v(0, 0.1, 0.4)),
          v(workHome[g]!.x, workHome[g]!.y + 1.55, 0.6),
        ]);
      });
      setOn(moeNote, !(m.phase !== 3));
      moeLink.visible = m.phase === 3;
      kit.connect(moeLink, [
        v(centers[0]! + 1.6, miniY + 0.15, 0.6),
        v(centers[1]! - 1.6, miniY + 0.15, 0.6),
      ]);
      replies.forEach((t, g) => {
        show(t, m.phase === 4 && m.reply > 0);
        const to = userPoints[g]!.clone().add(v(g ? -1.3 : 1.3, 0, 0.2));
        travel(t, replyRoutes[g]!, sRoute(replyFrom(g), to, 0.5), m.deliver, 1, 1);
        t.title.textContent = `回复 ${DP_REQUESTS[g]!.name.toLowerCase()}：“${DP_REQUESTS[g]!.reply}”`;
        paintGrid(t, [[""]], palette.result, m.reply, 1, 0);
      });
    },
  };
}

function expertParallel(kit: StrategyKit): StrategyContent {
  const { ports, grid, paintGrid, header, footer } = kit;
  const palette = { data: "#85a9ec", result: "#78c8b0" };
  const weightColor = "#e0948b";
  const sharedColor = "#a8cfc3";
  const lineData = "#4e69bd";
  const lineWeight = "#b5564d";
  const lineResult = "#12826c";
  const intraArcColor = "#4e69bd";
  const crossArcColor = "#a44a84";
  const slateTones = ["#586470", "#74818e", "#4b5661", "#8a96a3"];
  const winnerIndexByExpert = new Map(EP_EXPERTS.map((e, idx) => [e.expert, idx]));
  const dieColor = new T.Color();
  const label = flagged(kit);
  const { show, move, solid, dashed, operator, travel } = shared(kit);
  kit.boardCenters.forEach((x, b) => {
    label(`服务器${b} · 卡${b * 8}–${b * 8 + 7}`, kit.root, v(x * 0.86, 5.56, 0.25), "name");
  });
  const above = (card: number, dx = 0) => ports[card]!.clone().add(v(dx, 0.42, 0.2));
  const slotX = (expert: number) => (expert % 18 === 1 ? 0.3 : expert % 18 === 0 && expert > 0 ? -0.3 : -0.3);
  const H0 = v(-4.55, -2.75, 0.5);
  const hidden = grid("DP0 每卡同持 hidden · [4,4]", H0, palette.data, {
    cols: 4,
    axis: "4 个通道（实际 4096）→",
    focusRow: 0,
  });
  const L0 = v(1.45, -2.75, 0.5);
  const routerProjOp = operator("→ router →", v(-1.6, -2.75, 0.5));
  const logitsGrid = grid("每卡先算 router logits · [4,288] FP32", L0, weightColor, {
    rows: 4,
    cols: 3,
    wide: 1.5,
    rowNames: [],
    axis: "288 位专家打分（示意前 3 项）→",
    focusRow: 0,
  });
  const rowCuts = [0, 1, 2].map(() => dashed(lineWeight));
  const logitsCuts = [0, 1, 2].map(() => dashed(lineWeight));
  const rowsOut = SAMPLE_TOKENS.map((name) =>
    grid("", H0, palette.data, { rows: 1, cols: 4, rowNames: [name], axis: false, focusRow: 0 }),
  );
  const rowRoutes = SAMPLE_TOKENS.map(() => solid(lineData));
  const logitsOut = SAMPLE_TOKENS.map(() =>
    grid("", L0, weightColor, { rows: 1, cols: 3, wide: 1.5, rowNames: [], axis: false, focusRow: 0 }),
  );
  const logitRoutes = SAMPLE_TOKENS.map(() => solid(lineWeight));
  const padTags = [4, 5, 6, 7].map((i) => label("补位 (pad)", kit.root, v(ports[i]!.x, 1.62, 0.35), "note"));
  // The focused source row, then the router's score / weight per selected expert.
  const focusHome = v(-5.45, 0.02, 0.5);
  const focus = grid("卡0 · 今天 ([1,4] & [1,288])", focusHome, palette.data, {
    rows: 1,
    cols: 4,
    rowNames: [],
    axis: false,
    focusRow: 0,
    wide: 1.3,
  });
  const routerHome = v(-2.55, -3.1, 0.5);
  const router = grid("本卡 [1,288] 切片 · 准备 top-8", routerHome, palette.data, {
    rows: 8,
    cols: 2,
    wide: 1.85,
    rowNames: EP_EXPERTS.map((e) => `E${e.expert} · 卡${e.rank}`),
    axis: "原 sigmoid 分 · 原分÷5×2.5（偏置选 ID）",
    focusRow: -1,
  });
  const marks = EP_EXPERTS.map((e, i) => {
    const firstOnCard = EP_EXPERTS.findIndex((other) => other.rank === e.rank) === i;
    const isLower = e.rank % 8 >= 4;
    const isRemote = e.rank >= 8;
    const point = above(e.rank, slotX(e.expert)).add(v(0, -0.62, 0));
    const mark = kit.socket(kit.root, point, 1, 0.32);
    const tagPoint = isLower ? v(ports[e.rank]!.x, 1.56, 0.35) : v(ports[e.rank]!.x, 4.78, 0.35);
    const tag = label(
      EP_EXPERTS.filter((other) => other.rank === e.rank)
        .map((other) => `E${other.expert}`)
        .join(" · "),
      kit.root,
      tagPoint,
      isRemote ? "expert-pill remote" : "expert-pill",
    );
    const stem = firstOnCard ? dashed(isRemote ? crossArcColor : intraArcColor) : null;
    if (stem) {
      stem.visible = false;
      const cardEdge = isLower
        ? v(ports[e.rank]!.x, 2.34, 0.25)
        : ports[e.rank]!.clone().add(v(0, 0.04, 0.2));
      const pillEdge = isLower ? v(ports[e.rank]!.x, 1.82, 0.35) : v(ports[e.rank]!.x, 4.54, 0.35);
      kit.connect(stem, [pillEdge, cardEdge]);
    }
    return { mark, tag, stem, firstOnCard, rank: e.rank };
  });
  // Physical card-to-card HCCS (Server 0) and cross-server RDMA (Server 0 -> Server 1) 3D arcs.
  const remoteRanks = [...new Set(EP_EXPERTS.map((e) => e.rank).filter((r) => r !== EP_SOURCE))];
  const hwArcs = new Map(
    remoteRanks.map((rank) => {
      const isCross = rank >= 8;
      const from = ports[EP_SOURCE]!.clone().add(v(0, -0.46, 0.35));
      const to = ports[rank]!.clone().add(v(0, -0.46, 0.35));
      const mid = from.clone().lerp(to, 0.5);
      const avgY = (from.y + to.y) * 0.5;
      mid.y = isCross
        ? avgY + (rank === 8 ? 1.55 : rank === 11 ? 1.88 : 1.32)
        : rank === 5
          ? avgY - 0.55
          : avgY + 1.05;
      mid.z = isCross ? 1.6 : 1.05;
      const curve = new T.QuadraticBezierCurve3(from, mid, to);
      const wire = kit.line(isCross ? crossArcColor : intraArcColor, false, isCross ? 2.4 : 2.1);
      wire.visible = false;
      kit.connect(wire, curve.getPoints(28));
      return [rank, { rank, isCross, curve, wire }] as const;
    }),
  );
  const packetOrb = kit.orb?.(intraArcColor, 0.14) ?? null;
  const bridgeBadge = label("", kit.root, v(0, 1.62, 0.4), "bridge-pill");
  setOn(bridgeBadge, false);
  const bankHome = v(3.6, -3.1, 0.5);
  const bankRow = (i: number) => v(bankHome.x, bankHome.y + (3.5 - i) * 0.5, bankHome.z);
  const bank = grid("专家接收区 · 同一行的 8 份副本", bankHome, palette.data, {
    rows: 8,
    cols: 4,
    wide: 1.3,
    rowNames: [],
    axis: false,
    focusRow: -1,
  });
  const bankTags = EP_EXPERTS.map((e, i) =>
    label(`E${e.expert} · 卡${e.rank}`, kit.root, bankRow(i).add(v(2.05, 0, 0)), "note"),
  );
  const bankOwner = dashed(lineResult);
  const copies = EP_EXPERTS.map(() =>
    grid("", focusHome, palette.data, {
      rows: 1,
      cols: 4,
      wide: 1.3,
      rowNames: [],
      axis: false,
      focusRow: 0,
    }),
  );
  const copyRoutes = EP_EXPERTS.map(() => solid(lineData));
  const dispatchPaths = EP_EXPERTS.map((_, i) => epTransferPath(focusHome, bankRow(i), 1.15));
  // Phase 3 expands one remote expert, as PP and TP expand the working card.
  const FOCUS = 2;
  const focusExpert = EP_EXPERTS[FOCUS]!;
  const expertInHome = v(-3.6, -1.6, 0.5),
    expertOutHome = v(-3.6, -4.4, 0.5);
  const expertIn = grid(`到达卡${focusExpert.rank} 的“今天”`, expertInHome, palette.data, {
    rows: 1,
    cols: 4,
    rowNames: [],
    axis: false,
    focusRow: 0,
    wide: 1.3,
  });
  const expertOut = grid(`E${focusExpert.expert} 的输出`, expertOutHome, palette.result, {
    rows: 1,
    cols: 4,
    rowNames: [],
    axis: false,
    focusRow: 0,
    wide: 1.3,
  });
  const expertOp = operator(`↓ E${focusExpert.expert} ↓`, v(-3.6, -2.65, 0.5));
  const expertNote = label("gate / up → 门控相乘 → down", kit.root, v(-3.6, -3.3, 0.4), "note");
  const expertRoutes = [solid(lineData), solid(lineResult)];
  const expertPaths = [
    epTransferPath(bankRow(FOCUS), expertInHome, 0.3),
    epTransferPath(expertOutHome, bankRow(FOCUS), 0.3),
  ];
  const outputsHome = v(-0.6, -3.1, 0.5);
  const weights = grid("权重 wᵢ", v(-3.6, -3.1, 0.5), weightColor, {
    rows: 8,
    cols: 1,
    wide: 1.85,
    rowNames: EP_EXPERTS.map((e) => `E${e.expert}`),
    axis: false,
    focusRow: -1,
  });
  const outputs = grid("专家输出 yᵢ", outputsHome, palette.result, {
    rows: 8,
    cols: 4,
    rowNames: [],
    wide: 1.3,
    axis: "4 个通道 →",
    focusRow: -1,
  });
  const backRows = EP_EXPERTS.map(() =>
    grid("", above(0), palette.result, {
      rows: 1,
      cols: 4,
      wide: 1.3,
      rowNames: [],
      axis: false,
      focusRow: 0,
    }),
  );
  const backRoutes = EP_EXPERTS.map(() => solid(lineResult));
  const backPaths = EP_EXPERTS.map((_, i) =>
    epTransferPath(bankRow(i), v(outputsHome.x, bankRow(i).y, 0.5), 0.3),
  );
  const routedHome = v(4.6, -3.1, 0.5);
  const routed = grid("路由部分 = Σ wᵢ × yᵢ", routedHome, palette.result, {
    rows: 1,
    cols: 4,
    wide: 2.2,
    rowNames: [],
    axis: false,
    focusRow: 0,
  });
  const weighOp = operator("Σ →", v(2.1, -3.1, 0.5));
  const times = EP_EXPERTS.map((_, i) => label("×", kit.root, v(-2.3, -3.1 + (3.5 - i) * 0.5, 0.5), "note"));
  const weightedNote = label("", kit.root, v(3.5, -4.25, 0.5), "equation");
  const extract = dashed(lineResult);
  const combineExtract = dashed(lineResult);
  const routedRoute = solid(lineResult);
  // Finalize: TP8 All-Gather 8 slots ([8,4] -> crop 4 pad -> [4,4]), shared TP8 All-Reduce, add, retain on Cards 0–7.
  const finalY = -2.25;
  const padY = -4.45;
  const gatheredX = -5.4;
  const sharedX = 0.1;
  const outputX = 5.4;
  const gathered = grid("TP8 All-Gather · 8 槽 [8,4]", v(gatheredX, finalY, 0.5), palette.result, {
    cols: 4,
    wide: 2.2,
    axis: false,
    focusRow: 0,
  });
  const gatheredPad = grid("", v(gatheredX, padY, 0.5), MINERAL.pad, {
    cols: 4,
    wide: 2.2,
    rowNames: ["补4", "补5", "补6", "补7"],
    axis: false,
    focusRow: -1,
  });
  const padTailNote = label(
    "尾部 4 行补位（卡4–7）· 裁剪丢弃",
    kit.root,
    v(gatheredX, padY - 1.32, 0.5),
    "note",
  );
  const cropLine = dashed(lineWeight);
  const sharedOut = grid("共享专家 [4,4] · TP8 All-Reduce", v(sharedX, finalY, 0.5), sharedColor, {
    cols: 4,
    wide: 2.2,
    rowNames: [],
    axis: false,
    focusRow: -1,
  });
  const sharedReduceBus = solid(lineResult);
  const sharedReduceDrop = solid(lineResult);
  const sharedReduceNote = label(
    "TP8 All-Reduce · 合齐 8 卡共享部分和",
    kit.root,
    v(sharedX, -0.55, 0.5),
    "note",
  );
  const output = grid("本层 MoE 输出 [4,4]", v(outputX, finalY, 0.5), palette.result, {
    cols: 4,
    wide: 2.2,
    rowNames: [],
    axis: false,
    focusRow: 0,
  });
  const finalOps = [operator("+", v(-2.65, finalY, 0.5)), operator("=", v(2.75, finalY, 0.5))];
  const gatherRows = [1, 2, 3].map(() =>
    grid("", above(1), palette.result, {
      rows: 1,
      cols: 4,
      rowNames: [],
      axis: false,
      focusRow: 0,
      wide: 2.2,
    }),
  );
  const gatherRoutes = [1, 2, 3].map(() => solid(lineResult));
  const gatherPaths = [1, 2, 3].map((r) =>
    epTransferPath(above(r).setZ(0.5), v(gatheredX, finalY + (1.5 - r) * 0.5, 0.5), 0.3),
  );
  const padGatherRows = [4, 5, 6, 7].map(() =>
    grid("", above(4), MINERAL.pad, {
      rows: 1,
      cols: 4,
      rowNames: [],
      axis: false,
      focusRow: -1,
      wide: 2.2,
    }),
  );
  const padGatherRoutes = [4, 5, 6, 7].map(() => dashed(MINERAL.linePad));
  const padGatherPaths = [4, 5, 6, 7].map((r, idx) =>
    epTransferPath(above(r).setZ(0.5), v(gatheredX, padY + (1.5 - idx) * 0.5, 0.5), 0.75),
  );
  const routedGatherPath = epTransferPath(routedHome, v(gatheredX, finalY + 0.75, 0.5), 0.3);
  const returnedCards = Array.from({ length: 8 }, () =>
    grid("", v(outputX, finalY, 0.5), palette.result, {
      cols: 4,
      wide: 2.2,
      rowNames: [],
      axis: false,
      focusRow: 0,
    }),
  );
  const returnRoutes = Array.from({ length: 8 }, () => solid(lineResult));
  const retained = label("DP0 · 卡0–7 每卡均保留完整 [4,4] 输出", kit.root, v(-3.5, 0.15, 0.5), "name");
  const blankRow = ["", "", "", ""];
  const padRow = ["—", "—", "—", "—"];
  const { fly, sync: syncPayloadBounds } = payloadFlight(kit);
  const brickPitchX = 0.2,
    brickPitchY = 0.27;
  const deployGroupCenter = (card: number, cut: number) => {
    const row = card < 8 ? 0 : 1,
      col = card % 8;
    const gy = lerp(-2.72 + (0.5 - row) * 0.88, row === 0 ? -1.62 : -3.82, cut);
    return v((col - 3.5) * lerp(1.24, 1.66, cut), gy, 0.42);
  };
  const deployBrickSource = (card: number, j: number, cut: number) => {
    const c = deployGroupCenter(card, cut);
    return v(c.x + ((j % 6) - 2.5) * brickPitchX, c.y + (1 - Math.floor(j / 6)) * brickPitchY, c.z);
  };
  const deployBanner = label("", kit.root, v(0, -0.82, 0.45), "name");
  const deployServerSplit = dashed(crossArcColor);
  const deployColCuts = Array.from({ length: 7 }, () => dashed(lineWeight));
  const deployTagPoints = Array.from({ length: 16 }, (_, card) =>
    deployGroupCenter(card, 1).add(v(0, card % 2 === 0 ? -0.52 : -0.9, 0)),
  );
  const deployTags = deployTagPoints.map((pt, card) =>
    label(`卡${card} · E${card * 18}–${card * 18 + 17}`, kit.root, pt, "note"),
  );
  if (kit.pick && kit.seek) {
    const dispatchMid = (i: number) => 0.4 + ((i + 0.5) / 8) * 0.14;
    const seekCard: Record<number, number> = {
      0: 0.34,
      1: 0.22,
      2: 0.6,
      3: 0.22,
      5: dispatchMid(3), // 0.46125 -> E90 on Card 5
      8: dispatchMid(4), // 0.47875 -> E144 on Card 8
      11: dispatchMid(6), // 0.51375 -> E198 on Card 11
      14: dispatchMid(7), // 0.53125 -> E252 on Card 14
    };
    kit.chips?.forEach((chip, rank) => {
      kit.pick!(chip, () => kit.seek!(seekCard[rank] ?? 0.08));
    });
    kit.payloads.forEach((payload, rank) => {
      kit.pick!(payload, () => kit.seek!(seekCard[rank] ?? 0.08));
    });
    kit.pick(hidden.group, () => kit.seek!(0.2));
    kit.pick(logitsGrid.group, () => kit.seek!(0.2));
    kit.pick(focus.group, () => kit.seek!(0.32));
    kit.pick(router.group, () => kit.seek!(0.36));
    kit.pick(bank.group, () => kit.seek!(0.48));
    kit.pick(expertIn.group, () => kit.seek!(0.6));
    kit.pick(expertOut.group, () => kit.seek!(0.6));
    kit.pick(weights.group, () => kit.seek!(0.78));
    kit.pick(outputs.group, () => kit.seek!(0.78));
    kit.pick(routed.group, () => kit.seek!(0.81));
    kit.pick(gathered.group, () => kit.seek!(0.88));
    kit.pick(sharedOut.group, () => kit.seek!(0.92));
    kit.pick(output.group, () => kit.seek!(0.96));
  }
  return {
    glow: (i, p) => {
      const m = epMotion(p);
      if (m.phase === 0) return m.land > 0.35 + i * 0.025;
      if (m.phase === 1 || m.phase === 6) return i < 8;
      if (m.phase === 2) return i === EP_SOURCE;
      if (m.phase === 4) return EP_EXPERTS.some((e) => e.rank === i);
      const active =
        m.phase === 3 ? Math.min(7, Math.floor(m.local * 8)) : Math.min(7, Math.floor((m.local / 0.42) * 8));
      if (m.weigh === 0) return i === EP_SOURCE || i === EP_EXPERTS[active]!.rank;
      return i === EP_SOURCE || EP_EXPERTS.some((e) => e.rank === i);
    },
    glowColor: (i, p) => {
      const m = epMotion(p);
      if (m.phase === 0) return i >= 8 ? crossArcColor : intraArcColor;
      if (m.phase === 1) return intraArcColor;
      if (m.phase === 2) return lineWeight;
      if (m.phase === 6) return lineResult;
      if (i === EP_SOURCE) return m.phase >= 5 ? lineResult : intraArcColor;
      return i >= 8 ? crossArcColor : intraArcColor;
    },
    result: `routed=${EP_ROUTED.join(",")};out=${EP_OUTPUT[0]!.join(",")}`,
    camera: { half: 7.4, targetY: -0.6, footerY: -6.75 },
    animate(p) {
      const m = epMotion(p);
      const accumulation = epAccumulation(m.weigh);
      const gather = [0, 1, 2, 3].map((r) => clamp01(m.gather * 4 - r));
      const padGather = [0, 1, 2, 3].map((r) => clamp01(m.gather * 4 - r));
      const pickedCount =
        m.phase > 2 ? 8 : m.phase === 2 ? EP_EXPERTS.filter((_, i) => m.pick > (i + 0.5) / 8).length : 0;
      const ch6Stage = m.crop < 1 ? 0 : m.add === 0 ? 1 : m.writeback === 0 ? 2 : 3;
      header.textContent = [
        m.cut === 0
          ? "EP · 先看本层 288 位路由专家权重全貌"
          : m.land === 0
            ? "按 ⌊E ÷ 18⌋ 切成 16 份 · 每卡分得 18 位完整专家"
            : m.land < 0.96
              ? "288 位专家正分落 16 张卡显存…"
              : "288 位专家已落卡常驻 · 后续推理不再搬动",
        m.project === 0
          ? "DP0 每卡同持 [4,4] hidden"
          : m.split === 0
            ? "每卡先算 [4,288] FP32 router logits"
            : "MC2 prepare · 把 hidden 与 logits 一起补齐切给 8 卡",
        pickedCount === 0
          ? "源卡0 对本地 [1,288] 切片做 sigmoid + 偏置排序"
          : pickedCount < 8
            ? `源卡0 本地 top-8 · 已选出 ${pickedCount}/8 位专家`
            : "源卡0 本地 top-8 完成 · 选中 8 位专家（权和 2.5）",
        "dispatch · 这一行去找 8 位专家",
        "专家在各自的卡上原位计算",
        m.weigh === 0 ? "combine · 8 份结果回到源卡" : "combine · 乘组合权重再相加",
        ch6Stage === 0
          ? m.gather < 1
            ? "TP8 All-Gather · 8 槽 [1,4] 拼成 [8,4]"
            : "裁去卡4–7 的 4 行补位 · 恢复 [4,4]"
          : ch6Stage === 1
            ? "共享专家 · TP8 All-Reduce 合齐完整 [4,4]"
            : ch6Stage === 2
              ? "加上共享专家，得到本层输出"
              : m.writeback < 1
                ? "完整 [4,4] 同步保留到 DP0 全部 8 卡"
                : "本层完成 · DP0 卡0–7 均持有完整 [4,4]",
      ][m.phase]!;
      footer.textContent =
        m.phase === 0
          ? m.land < 0.96
            ? "深钛灰晶粒为本层 288 位路由专家权重（每块一位完整专家）；上排归服务器0，下排归服务器1"
            : "每卡 18 位专家权重已落入显存常驻；后续推理权重一步不动，仅被唤醒的 8 位点亮"
          : m.phase === 1
            ? m.split === 0
              ? "固定路径中，每张 TP 卡先算出全部 4 行的 [4,288] FP32 router logits，再进入 MC2 prepare"
              : "MC2 prepare 本地补齐 8 槽（卡0–3 有效，卡4–7 补位）并切分 [hidden, logits]，零集合通信"
            : m.phase === 2
              ? pickedCount < 8
                ? `偏置校正分决定选哪 8 位，原始 sigmoid 分归一化×2.5 作权重（已点亮 ${pickedCount}/8 颗）`
                : "卡1–3 同时为自己的行做同样的事；288 颗常驻专家中本行已点亮选中的 8 颗"
              : m.phase === 3
                ? "下方展开各卡接收行 · 靛蓝弧为机内 HCCS，梅紫弧为跨机 RDMA · 虚线连向当前持有卡"
                : m.phase <= 5
                  ? "卡1–3 同时为自己的行做同样的事；288 颗常驻专家中本行仅点亮选中的 8 颗"
                  : "TP8 All-Gather 裁剪 4 行补位 + 共享专家 TP8 All-Reduce，最终 DP0 全部 8 卡均留完整输出";
      const isRouting = m.phase >= 2 && m.phase <= 5;
      const activeWinner =
        m.phase === 3
          ? Math.min(7, Math.floor(m.local * 8))
          : m.phase === 4
            ? FOCUS
            : m.phase === 5
              ? m.weigh > 0
                ? accumulation.completed < 8
                  ? accumulation.active
                  : -1
                : Math.min(7, Math.floor((m.local / 0.42) * 8))
              : -1;
      kit.payloads.forEach((payload, card) => {
        let allLanded = true;
        for (let j = 0; j < payload.count; j++) {
          const stagger = card * 0.022 + Math.floor(j / 6) * 0.015;
          const t = m.phase > 0 ? 1 : clamp01((m.land - stagger) / 0.6);
          if (t < 1) allLanded = false;
          fly(card, j, deployBrickSource(card, j, m.cut), t, m.reveal, 2.05);
          const wIdx = winnerIndexByExpert.get(card * 18 + j);
          const picked = wIdx !== undefined && isRouting && (m.phase > 2 || m.pick > (wIdx + 0.5) / 8);
          const step = ((j % 6) + Math.floor(j / 6) + card) % 4;
          dieColor.set(picked ? (wIdx === activeWinner ? "#d95b4f" : "#e6887e") : slateTones[step]!);
          payload.setColorAt(j, dieColor);
        }
        syncPayloadBounds(card, allLanded);
        if (payload.instanceColor) payload.instanceColor.needsUpdate = true;
      });
      const laying = m.phase === 0 && m.land < 0.12;
      setOn(deployBanner, laying && m.reveal > 0.35);
      deployBanner.textContent =
        m.cut < 0.25
          ? "本层 288 位路由专家权重（E0–E287 · 全集群只存一套，不复制）"
          : "按编号连续切成 16 份 · 上排归服务器0（卡0–7），下排归服务器1（卡8–15）";
      deployServerSplit.visible = laying && m.cut > 0.12;
      kit.connect(deployServerSplit, [v(-6.6, -2.86, 0.55), v(6.6, -2.86, 0.55)]);
      deployColCuts.forEach((wire, k) => {
        wire.visible = laying && m.cut > 0.12;
        const x = (k - 3) * lerp(1.24, 1.66, m.cut);
        kit.connect(wire, [v(x, -1.2, 0.55), v(x, -4.22, 0.55)]);
      });
      deployTags.forEach((el, card) => {
        setOn(el, laying && m.cut > 0.55);
        const c = deployGroupCenter(card, m.cut);
        deployTagPoints[card]!.set(c.x, c.y + (card % 2 === 0 ? -0.52 : -0.9), 0.45);
      });
      // Phase 1: every TP card first projects [4,288] FP32 router logits, then MC2 prepare pads (8 slots)
      // and slices [hidden, logits] together to [1,H] & [1,288] per card (Cards 0–3 valid, Cards 4–7 pad).
      show(hidden, m.phase === 1);
      paintGrid(hidden, EP_HIDDEN, palette.data, 1, m.show, 0);
      if (m.split > 0)
        hidden.cells.forEach((c) => {
          c.material.opacity = 0.15;
        });
      hidden.title.textContent = m.split <= 0.05 ? "DP0 每卡同持 hidden · [4,4]" : "";
      setOn(routerProjOp, m.phase === 1 && m.project > 0 && m.split <= 0.05);
      show(logitsGrid, m.phase === 1 && m.project > 0);
      paintGrid(logitsGrid, EP_LOGITS_PREVIEW, weightColor, m.project, m.project, 0);
      if (m.split > 0)
        logitsGrid.cells.forEach((c) => {
          c.material.opacity = 0.15;
        });
      logitsGrid.title.textContent = m.split <= 0.05 ? "每卡先算 router logits · [4,288] FP32" : "";
      rowCuts.forEach((c, i) => {
        c.visible = m.phase === 1 && m.split > 0 && m.split < 0.4;
        const y = H0.y + (1 - i) * 0.5;
        kit.connect(c, [v(H0.x - 1.25, y, 0.8), v(H0.x + 1.0, y, 0.8)]);
      });
      logitsCuts.forEach((c, i) => {
        c.visible = m.phase === 1 && m.split > 0 && m.split < 0.4;
        const y = L0.y + (1 - i) * 0.5;
        kit.connect(c, [v(L0.x - 1.2, y, 0.8), v(L0.x + 1.2, y, 0.8)]);
      });
      rowsOut.forEach((t, r) => {
        show(t, (m.phase === 1 && m.split > 0) || (m.phase >= 2 && m.phase <= 5));
        const from = v(H0.x, H0.y + (1.5 - r) * 0.5, 0.5);
        travel(t, rowRoutes[r]!, sRoute(from, above(r), 0.45), m.phase === 1 ? m.split : 1, 1, 0.3);
        paintGrid(t, [EP_HIDDEN[r]!], palette.data, 1, 1, 0);
      });
      logitsOut.forEach((t, r) => {
        show(t, m.phase === 1 && m.split > 0 && m.split < 1);
        const from = v(L0.x, L0.y + (1.5 - r) * 0.5, 0.5);
        travel(t, logitRoutes[r]!, sRoute(from, above(r).add(v(0, -0.26, 0)), 0.45), m.split, 1, 0.28);
        paintGrid(t, [EP_LOGITS_PREVIEW[r]!], weightColor, 1, 1, 0);
      });
      padTags.forEach((el) => {
        setOn(el, !!((m.phase === 1 && m.split >= 0.7) || (m.phase === 2 && m.pick === 0)));
      });
      // Phase 2: local top-8 on Card 0's [1,288] slice (bias-adjusted scores pick IDs; raw sigmoid ×2.5 = weights).
      const routing = m.phase >= 2 && m.phase <= 5;
      show(focus, m.phase === 2 || m.phase === 3);
      paintGrid(focus, [EP_HIDDEN[0]!], palette.data, 1, m.phase === 2 ? clamp01(m.local / 0.12) : 1, 0);
      extract.visible = m.phase >= 2 && m.phase <= 3;
      kit.connect(extract, [
        ports[0]!,
        v(-7.2, ports[0]!.y, 0.5),
        v(-7.2, focusHome.y, 0.5),
        v(-6.68, focusHome.y, 0.5),
      ]);
      show(router, m.phase === 2 || m.phase === 3);
      router.title.textContent =
        pickedCount === 0
          ? m.score === 0
            ? "本卡 [1,288] 切片 · 准备 top-8 打分"
            : "sigmoid + 偏置排序 · 筛选候选专家"
          : pickedCount < 8
            ? `已选出 ${pickedCount}/8 位 · 原分归一化×2.5`
            : "已选出 8 位专家 · 原分 ÷ 5 × 2.5";
      paintGrid(
        router,
        EP_EXPERTS.map((_, i) => [
          EP_SCORES[i]!,
          m.phase > 2 || m.pick > (i + 0.5) / 8 ? EP_WEIGHTS[i]! : "",
        ]),
        weightColor,
        m.phase === 2 ? m.score : 1,
        1,
        -1,
      );
      marks.forEach(({ mark, tag, stem, firstOnCard, rank }) => {
        const pickedOnCard = EP_EXPERTS.filter(
          (other, idx) => other.rank === rank && (m.phase > 2 || m.pick > (idx + 0.5) / 8),
        );
        const on = routing && firstOnCard && pickedOnCard.length > 0;
        mark.visible = false;
        if (firstOnCard) {
          tag.textContent = pickedOnCard.map((other) => `E${other.expert}`).join(" · ");
        }
        setOn(tag, on);
        if (stem) stem.visible = on;
      });
      // The same eight slots receive, compute and hand back their rows; only one route is active.
      const p3 = m.phase === 4;
      const k = p3 ? m.local : 0;
      const expand = clamp01(k / 0.2),
        written = clamp01((k - 0.3) / 0.38),
        back = clamp01((k - 0.76) / 0.22);
      const bankVisible = m.phase === 3 || p3 || (m.phase === 5 && m.weigh === 0);
      const activeExpert =
        m.phase === 3
          ? Math.min(7, Math.floor(m.local * 8))
          : p3
            ? FOCUS
            : Math.min(7, Math.floor((m.local / 0.42) * 8));
      const bankValues = EP_EXPERTS.map((_, i) => {
        if (m.phase === 3) return m.dispatch[i] === 1 ? EP_HIDDEN[0]! : blankRow;
        if (p3 && i === FOCUS) return k === 0 ? EP_HIDDEN[0]! : back === 1 ? EP_EXPERT_OUTPUTS[i]! : blankRow;
        if (p3) return m.compute > (i + 0.5) / 9 ? EP_EXPERT_OUTPUTS[i]! : EP_HIDDEN[0]!;
        return m.combine[i] === 0 ? EP_EXPERT_OUTPUTS[i]! : blankRow;
      });
      show(bank, bankVisible);
      bank.title.textContent =
        m.phase === 3
          ? "专家接收区 · 同一行的 8 份副本"
          : p3
            ? "各卡上的专家 · 原位计算"
            : "专家输出 · 按原行回收";
      paintGrid(
        bank,
        bankValues,
        (r) => (bankValues[r] === EP_EXPERT_OUTPUTS[r] ? palette.result : palette.data),
        1,
        1,
        activeExpert,
      );
      bank.cells.forEach((cell, i) => {
        const row = Math.floor(i / 4);
        if (bankValues[row] === blankRow) cell.material.opacity = row === activeExpert ? 0.3 : 0.08;
      });
      bankTags.forEach((el, i) => {
        setOn(el, bankVisible);
        el.style.opacity = i === activeExpert ? "1" : "0.52";
        el.style.fontWeight = i === activeExpert ? "700" : "500";
      });
      const activeRank = EP_EXPERTS[activeExpert]!.rank;
      bankOwner.visible = bankVisible;
      const ownerPort = ports[activeRank]!;
      const isLowerOwner = activeRank % 8 >= 4;
      const ownerStart = isLowerOwner ? v(ownerPort.x, 1.34, 0.25) : v(ownerPort.x, 4.82, 0.25);
      const corridorY = isLowerOwner ? 1.04 : 5.02;
      kit.connect(bankOwner, [
        ownerStart,
        v(ownerStart.x, corridorY, 0.2),
        v(7.12, corridorY, 0.2),
        v(7.12, bankRow(activeExpert).y, 0.2),
        v(6.58, bankRow(activeExpert).y, 0.2),
      ]);
      // Animate 3D HCCS / RDMA hardware arcs, luminous token orb, and inter-server bridge summary.
      const showBridge = m.phase >= 3 && m.phase <= 5;
      setOn(bridgeBadge, showBridge);
      if (showBridge) {
        bridgeBadge.textContent =
          m.phase === 3
            ? "本卡直取 2 份 · 机内 HCCS 2 份 · 跨机 RDMA 4 份"
            : p3
              ? "6 张命中卡并行跑 SwiGLU · 专家权重常驻不搬动"
              : m.weigh === 0
                ? "远端 6 份输出沿 HCCS / RDMA 返回源卡 0"
                : "源卡 0 本地按组合权重 wᵢ 加权求和";
      }
      hwArcs.forEach(({ rank, isCross, wire }) => {
        const dispatched = EP_EXPERTS.some((e, i) => e.rank === rank && m.dispatch[i]! > 0);
        const visible = (m.phase === 3 && dispatched) || p3 || (m.phase === 5 && m.weigh === 0);
        wire.visible = visible;
        if (!visible) return;
        const isCurrent = rank === activeRank && (m.phase === 3 || p3 || (m.phase === 5 && m.weigh === 0));
        wire.material.color.set(isCross ? crossArcColor : intraArcColor);
        wire.material.opacity = isCurrent ? 0.95 : p3 ? 0.36 : 0.42;
        wire.material.linewidth = isCurrent ? 3.1 : isCross ? 2.1 : 1.9;
      });
      if (packetOrb) {
        const flight =
          m.phase === 3
            ? m.dispatch[activeExpert]!
            : m.phase === 5 && m.weigh === 0
              ? m.combine[activeExpert]!
              : 0;
        const activeArc = hwArcs.get(activeRank);
        const moving = !!activeArc && flight > 0 && flight < 1;
        packetOrb.visible = moving;
        if (moving && activeArc) {
          const t = m.phase === 3 ? flight : 1 - flight;
          packetOrb.position.copy(activeArc.curve.getPoint(t));
          const orbColor = m.phase === 5 ? lineResult : activeArc.isCross ? crossArcColor : intraArcColor;
          packetOrb.material.color.set(orbColor);
          packetOrb.material.emissive.set(orbColor);
        }
      }
      copies.forEach((t, i) => {
        const d = m.dispatch[i]!;
        show(t, m.phase === 3 && d > 0 && d < 1);
        travel(t, copyRoutes[i]!, dispatchPaths[i]!, d, 1, 1);
        paintGrid(t, [EP_HIDDEN[0]!], palette.data, 1, 1, 0);
        if (d < 0.16 || d > 0.9)
          t.numbers.forEach((el) => {
            el.textContent = "";
          });
      });
      // Expand one expert's calculation, then land its output back in the same slot.
      show(expertIn, p3 && back === 0);
      travel(expertIn, expertRoutes[0]!, expertPaths[0]!, expand, 1, 1);
      paintGrid(expertIn, [EP_HIDDEN[0]!], palette.data, 1, 1, 0);
      expertIn.title.textContent = expand === 1 ? `卡${focusExpert.rank} · 输入“今天”` : "";
      show(expertOut, p3 && written > 0 && back < 1);
      travel(expertOut, expertRoutes[1]!, expertPaths[1]!, back, 1, 1);
      paintGrid(expertOut, [EP_EXPERT_OUTPUTS[FOCUS]!], palette.result, written, 1, 0);
      expertOut.title.textContent = back === 0 ? `E${focusExpert.expert} · 输出` : "";
      setOn(expertOp, p3 && expand === 1 && back === 0);
      setOn(expertNote, p3 && expand === 1 && back === 0);
      // Phase 5: results come back to the source card, stack, then weigh and add.
      combineExtract.visible = m.phase === 5;
      kit.connect(combineExtract, [
        ports[0]!,
        v(-6.6, ports[0]!.y, 0.2),
        v(-6.6, -0.42, 0.2),
        v(-0.6, -0.42, 0.2),
      ]);
      show(weights, m.phase === 5);
      paintGrid(
        weights,
        EP_WEIGHTS.map((w) => [w]),
        weightColor,
        1,
        1,
        accumulation.active,
      );
      times.forEach((el, i) => {
        setOn(el, m.phase === 5 && m.weigh > 0);
        el.style.opacity = i === accumulation.active ? "1" : "0.25";
      });
      show(outputs, m.phase === 5);
      paintGrid(
        outputs,
        EP_EXPERT_OUTPUTS.map((row, i) => (m.combine[i]! === 1 ? row : blankRow)),
        palette.result,
        1,
        1,
        m.weigh > 0 ? accumulation.active : -1,
      );
      outputs.cells.forEach((c, k) => {
        if (m.combine[Math.floor(k / 4)]! < 1) c.material.opacity = 0.16;
      });
      backRows.forEach((t, i) => {
        const c = m.combine[i]!;
        show(t, m.phase === 5 && c > 0 && c < 1);
        travel(t, backRoutes[i]!, backPaths[i]!, c, 1, 1);
        paintGrid(t, [EP_EXPERT_OUTPUTS[i]!], palette.result, 1, 1, 0);
        if (c < 0.14 || c > 0.9)
          t.numbers.forEach((el) => {
            el.textContent = "";
          });
      });
      show(routed, (m.phase === 5 && m.weigh > 0) || (m.phase === 6 && gather[0]! < 1));
      move(routed, routedHome);
      paintGrid(routed, [accumulation.total], palette.result, 1, 1, 0);
      routed.title.textContent = m.phase === 5 ? `已累加 ${accumulation.completed}/8 份贡献` : "";
      travel(routed, routedRoute, routedGatherPath, m.phase === 6 ? gather[0]! : 0, 1, 1);
      setOn(weighOp, !!(m.phase === 5 && m.weigh > 0));
      setOn(weightedNote, m.phase === 5 && m.weigh > 0);
      const active = accumulation.active;
      weightedNote.textContent =
        accumulation.completed === 8
          ? "8 份贡献已合齐 · 四个通道分别相加"
          : `第 0 通道：${EP_WEIGHTS[active]} × ${EP_EXPERT_OUTPUTS[active]![0]} = ${+(EP_WEIGHTS[active]! * EP_EXPERT_OUTPUTS[active]![0]!).toFixed(3)}`;
      // Phase 6: TP8 All-Gather 8 slots ([8,4]) -> crop 4 pad rows ([4,4]) -> shared TP8 All-Reduce -> add -> retain on Cards 0–7.
      const p5 = m.phase === 6;
      show(gathered, p5);
      gathered.title.textContent =
        m.crop === 0
          ? "TP8 All-Gather · 8 槽 [8,4]"
          : m.crop < 1
            ? "裁去 4 行补位 → [4,4]"
            : "路由合并 [4,4] · 已裁补位";
      paintGrid(
        gathered,
        EP_ROUTED_ROWS.map((row, r) => (gather[r] === 1 ? row : blankRow)),
        palette.result,
        1,
        1,
        0,
      );
      gathered.cells.forEach((c, i) => {
        if (gather[Math.floor(i / 4)]! < 1) c.material.opacity = 0.16;
      });
      show(gatheredPad, p5 && m.crop < 1);
      move(gatheredPad, v(gatheredX, padY - 0.45 * m.crop, 0.5));
      paintGrid(
        gatheredPad,
        [0, 1, 2, 3].map((r) => (padGather[r] === 1 ? padRow : blankRow)),
        MINERAL.pad,
        1,
        1,
        -1,
      );
      gatheredPad.cells.forEach((c, i) => {
        const arrived = padGather[Math.floor(i / 4)]! === 1;
        c.material.opacity = (arrived ? 0.65 : 0.14) * (1 - m.crop);
      });
      setOn(padTailNote, p5 && m.gather > 0.25 && m.crop < 0.9);
      cropLine.visible = p5 && m.crop > 0 && m.crop < 1;
      kit.connect(cropLine, [v(gatheredX - 1.8, -3.35, 0.8), v(gatheredX + 1.8, -3.35, 0.8)]);
      gatherRows.forEach((t, k) => {
        const r = k + 1;
        show(t, p5 && gather[r]! < 1);
        travel(t, gatherRoutes[k]!, gatherPaths[k]!, gather[r]!, 0.3, 1);
        paintGrid(t, [EP_ROUTED_ROWS[r]!], palette.result, 1, 1, 0);
      });
      padGatherRows.forEach((t, k) => {
        show(t, p5 && padGather[k]! > 0 && padGather[k]! < 1);
        travel(t, padGatherRoutes[k]!, padGatherPaths[k]!, padGather[k]!, 0.26, 1);
        paintGrid(t, [padRow], MINERAL.pad, 1, 1, -1);
      });
      const sharedActive = p5 && m.shared > 0;
      sharedReduceBus.visible = sharedActive && m.add === 0;
      sharedReduceDrop.visible = sharedActive && m.add === 0;
      kit.connect(sharedReduceBus, [v(ports[0]!.x, -0.18, 0.35), v(ports[3]!.x, -0.18, 0.35)]);
      kit.connect(sharedReduceDrop, [
        v((ports[0]!.x + ports[3]!.x) / 2, -0.18, 0.35),
        v(sharedX, -0.18, 0.35),
        v(sharedX, finalY + 1.15, 0.5),
      ]);
      setOn(sharedReduceNote, sharedActive && m.add === 0);
      show(sharedOut, sharedActive);
      sharedOut.title.textContent =
        m.shared < 1 ? "共享专家 · TP8 All-Reduce…" : "共享专家 [4,4] · TP8 All-Reduce";
      paintGrid(sharedOut, EP_SHARED, sharedColor, m.shared, 1, -1);
      show(output, p5 && m.add > 0);
      paintGrid(output, EP_OUTPUT, palette.result, m.add, 1, 0);
      setOn(finalOps[0]!, !!(p5 && m.shared === 1));
      setOn(finalOps[1]!, !!(p5 && m.add > 0));
      returnedCards.forEach((t, card) => {
        show(t, p5 && m.writeback > 0);
        paintGrid(t, EP_OUTPUT, palette.result, 1, 1, 0);
        travel(
          t,
          returnRoutes[card]!,
          sRoute(v(outputX, finalY, 0.5), above(card), 0.38),
          m.writeback,
          1,
          0.22,
        );
      });
      setOn(retained, p5 && m.writeback === 1);
    },
  };
}
