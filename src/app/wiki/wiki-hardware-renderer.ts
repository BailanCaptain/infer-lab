import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { createExpertAssembly, expertSlot } from "./scene-expert-assembly";
import {
  dpDeployment,
  dpRequestFrame,
  EP_COMBINED_CHANNEL,
  EP_OUTPUT_CHANNEL,
  EP_ROUTE_WEIGHTS,
  epIntroduction,
} from "./scene-hardware-story";
import { createMatrixMesh } from "./scene-matrix-mesh";
import { scenePalette } from "./scene-palette";
import { parallelHardware } from "./scene-parallel-hardware";
import { expertAssignments, parallelPhase, parallelTransfer } from "./scene-playback";
import { setWidePolylinePoints } from "./scene-polyline";
import {
  dpMatrixState,
  dpReplyState,
  EP_FOCUS_ROW,
  REQUEST_TOKENS,
  requestHidden,
  requestIds,
  requestOutput,
  tpInput,
  tpPartial,
  tpSum,
} from "./scene-request-matrix";

const v = (x: number, y: number, z = 0.6) => new T.Vector3(x, y, z);
const smooth = (n: number) => T.MathUtils.smoothstep(n, 0, 1);
const span = (n: number, a: number, b: number) => smooth((n - a) / (b - a));
const fmt = (n: number) => +n.toFixed(2);

/** The PP composition: hardware above, a readable front-facing expansion below. */
export async function mountParallelScene(
  host: HTMLDivElement,
  onSelect: (rank: number) => void,
  signal: AbortSignal,
) {
  const hardware = await Promise.all([parallelHardware(0, signal, true), parallelHardware(0, signal, true)]);
  if (signal.aborted || hardware.some((h) => !h)) {
    hardware.forEach((h) => {
      h?.dispose();
    });
    return null;
  }
  const machines = hardware.map((h) => h!);
  const palette = scenePalette(host),
    scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio || 1, 1.5), 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  const overlay = document.createElement("div");
  overlay.className = "wiki-strategy-labels";
  host.append(renderer.domElement, overlay);
  const camera = new T.OrthographicCamera(-7, 7, 6.6, -6.6, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = controls.enablePan = false;
  controls.minPolarAngle = 1.26;
  controls.maxPolarAngle = 1.4;
  controls.minAzimuthAngle = -0.035;
  controls.maxAzimuthAngle = 0.09;
  controls.rotateSpeed = 0.23;
  scene.add(new T.HemisphereLight(0xffffff, 0xb7c5b2, 2.3));
  const light = new T.DirectionalLight(0xffffff, 2.1);
  light.position.set(-5, 8, 15);
  scene.add(light);
  const geometry = new T.BoxGeometry(1, 1, 1);
  const materials: T.Material[] = [],
    lines: Line2[] = [];
  const captions: { node: HTMLElement; point: T.Vector3; parent: T.Object3D }[] = [];
  const matrices: ReturnType<typeof createMatrixMesh>[] = [];
  let step = 0,
    selected = 0,
    progress = 0,
    width = 1,
    height = 1,
    disposed = false;
  const label = (
    text: string,
    point: T.Vector3,
    kind = "name",
    parent: T.Object3D = scene,
    rank?: number,
  ) => {
    const node = document.createElement(rank === undefined ? "span" : "button");
    node.className = `wiki-strategy-label ${kind}`;
    node.textContent = text;
    if (rank !== undefined) {
      node.setAttribute("aria-label", `选择 rank ${rank}`);
      node.onclick = () => onSelect(rank);
    }
    overlay.append(node);
    captions.push({ node, point, parent });
    return node;
  };
  const cube = (parent: T.Object3D, at: T.Vector3, size: T.Vector3, color: string) => {
    const material = new T.MeshLambertMaterial({ color });
    materials.push(material);
    const m = new T.Mesh(geometry, material);
    m.position.copy(at);
    m.scale.copy(size);
    parent.add(m);
    return m;
  };
  const matrix = (rows: number, columns: number, color: string, pitch = 0.48, rowPitch = pitch) => {
    const m = createMatrixMesh(scene, overlay, rows, columns, color, palette, pitch, rowPitch);
    m.group.rotation.x = 1.45;
    matrices.push(m);
    return m;
  };
  const line = (color: string, dashed = false) => {
    const g = new LineGeometry().setPositions([0, 0, 0, 0, 0, 0]);
    const material = new LineMaterial({
      color,
      linewidth: dashed ? 1.8 : 2.8,
      dashed,
      dashSize: 0.12,
      gapSize: 0.1,
      transparent: true,
      opacity: dashed ? 0.55 : 0.9,
      depthTest: !dashed,
    });
    materials.push(material);
    const l = new Line2(g, material);
    scene.add(l);
    lines.push(l);
    return l;
  };
  const route = (l: Line2, a: T.Vector3, b: T.Vector3, t?: number, bend = 0) => {
    const curve = new T.CubicBezierCurve3(
      a,
      v(a.x + bend, T.MathUtils.lerp(a.y, b.y, 0.35), Math.max(a.z, b.z) + 0.7),
      v(b.x + bend, T.MathUtils.lerp(a.y, b.y, 0.65), Math.max(a.z, b.z) + 0.7),
      b,
    );
    // A moving tensor owns the leading edge; leave no future line through its cells.
    const moving = t !== undefined,
      amount = t ?? 1;
    const length = Math.max(0.001, curve.getLength());
    const from = moving ? Math.min(amount, a.y < 0 ? 0.6 / length : 0) : 0;
    const until = moving ? Math.max(from, amount - 0.25 / length) : 1;
    setWidePolylinePoints(
      l,
      Array.from({ length: 33 }, (_, i) => curve.getPointAt(T.MathUtils.lerp(from, until, i / 32))),
    );
    l.visible = until > from && (!moving || amount < 1);
    return curve.getPointAt(amount);
  };
  const ports: T.Vector3[] = [],
    cardLabels: HTMLElement[] = [],
    expertTiles: ReturnType<typeof createExpertAssembly>[] = [];
  machines.forEach((h, group) => {
    h.group.scale.setScalar(0.64);
    h.group.position.set(group ? 2.65 : -2.65, 3.1, -1.4);
    h.group.rotation.x = 0.35;
    scene.add(h.group);
    h.group.updateMatrixWorld(true);
    label(
      `服务器 ${group} · 卡 ${group * 8}–${group * 8 + 7}`,
      v(group ? 2.65 : -2.65, 4.95, -0.5),
      "machine",
    );
    h.points.forEach((p, i) => {
      const rank = group * 8 + i;
      ports.push(h.group.localToWorld(p.clone()));
      cardLabels.push(label(`卡${rank}`, p.clone().add(v(0, 0.28, 0)), "card", h.group, rank));
      const experts = createExpertAssembly(palette);
      experts.mesh.position.copy(p).add(v(0, -0.48, 0));
      experts.mesh.scale.setScalar(0.85);
      h.group.add(experts.mesh);
      expertTiles.push(experts);
    });
  });
  const headings = [label("", v(0, 5.75), "heading"), label("", v(0, -4.9), "note")];
  const owners = [line(palette.wire, true), line(palette.wire, true)];
  const flow = line(palette.data),
    returnFlow = line(palette.result);
  const replies = [line(palette.result), line(palette.result)];
  const packet = matrix(1, 6, palette.data, 0.62);
  const input = matrix(4, 6, palette.data, 0.62, 0.48);
  const dpInputs = [matrix(4, 6, palette.data), matrix(4, 6, palette.data)];
  const dpOutputs = [matrix(4, 6, palette.result), matrix(4, 6, palette.result)];
  const dpNames = [label("", v(-3, -3.45)), label("", v(3, -3.45))];
  const users = [
    label("甲：帮我写一封邮件", v(-3, 0.6), "request"),
    label("乙：解释一下缓存原理", v(3, 0.6), "request"),
  ];
  const entry = label("API 前端 · 接收、分词、选组", v(0, 1.25), "name");
  const movingText = label("", v(0, 0.35), "request");
  const modelCopies = [matrix(8, 4, palette.weight, 0.32), matrix(8, 4, palette.weight, 0.32)];
  const weightRows = Array.from({ length: 16 }, () => matrix(1, 4, palette.weight, 0.32));
  const xColumns = Array.from({ length: 8 }, () => matrix(4, 1, palette.data, 0.4));
  const xFull = matrix(4, 8, palette.data, 0.4);
  const smallX = matrix(4, 1, palette.data, 0.5),
    smallW = matrix(1, 4, palette.weight, 0.5);
  const partial = matrix(4, 4, palette.result, 0.5),
    total = matrix(4, 4, palette.result, 0.5);
  const matrixPacket = matrix(4, 4, palette.result, 0.5);
  const cardResults = Array.from({ length: 16 }, () => matrix(4, 4, palette.result, 0.5));
  const cardInputs = Array.from({ length: 16 }, () => matrix(4, 6, palette.data, 0.48));
  const expertInputs = Array.from({ length: 8 }, () => matrix(1, 6, palette.data, 0.62));
  const expertOutputs = Array.from({ length: 8 }, () => matrix(1, 6, palette.result, 0.62));
  const sourceBuffer = matrix(8, 6, palette.result, 0.43);
  const cardCombined = matrix(1, 6, palette.result, 0.62);
  const epBranches = [matrix(1, 6, palette.data, 0.5), matrix(1, 6, palette.data, 0.5)];
  const localCompute = [line(palette.data), line(palette.weight)];
  const operator = label("×", v(-0.9, -1.55), "operator"),
    equals = label("=", v(1, -1.55), "operator");
  const modelLabel = label("", v(-2.7, -0.05));
  const expertBank = new T.Group();
  scene.add(expertBank);
  const bankUnits = Array.from({ length: 16 }, () => {
    const g = new T.Group();
    expertBank.add(g);
    for (let plate = 0; plate < 3; plate++)
      cube(g, v(0, plate * 0.09, 0), v(0.26, 0.06, 0.4), palette.weight);
    return g;
  });
  const bankLabel = label("", v(2.8, -0.05));
  const replicas = new T.Group();
  scene.add(replicas);
  const replicaCopies = Array.from({ length: 16 }, (_, i) =>
    cube(replicas, v((i - 7.5) * 0.3, 0, 0), v(0.23, 0.23, 0.1), palette.memory),
  );
  replicas.position.set(0, -4, 0.6);
  const replicaLabel = label("归一化 / router 等小参数 · 每卡一份", v(0, -4.5), "note");
  const epRows = Array.from({ length: 8 }, () => matrix(1, 6, palette.result, 0.43));
  const epRowLabels = Array.from({ length: 8 }, (_, i) => label("", v(4.95, -0.45 - i * 0.43), "expert"));
  const epSum = matrix(1, 6, palette.result, 0.62, 0.48);
  // During writeback this row covers the cleared receiving cells in the same plane.
  epSum.mesh.renderOrder = 1;
  epSum.mesh.material.depthTest = false;
  const sumStatus = label("", v(-3.15, -4.15), "note");
  const epExpanded = new T.Group();
  scene.add(epExpanded);
  const expertWeights = [v(-0.85, 0.45, 0), v(0.85, 0.45, 0), v(0, -0.8, 0)].map((p) => {
    const g = new T.Group();
    g.position.copy(p);
    g.rotation.set(0.12, -0.2, 0);
    epExpanded.add(g);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        cube(g, v((c - 1) * 0.28, (1 - r) * 0.28, 0), v(0.25, 0.25, 0.28), palette.weight);
    return g;
  });
  const expertWeightLabels = ["gate 门控", "up 展开", "down 收回"].map((s, i) =>
    label(
      s,
      expertWeights[i]!.position.clone().add(i === 2 ? v(1.15, 0, 0) : v(0, 0.65, 0)),
      "note",
      epExpanded,
    ),
  );
  epExpanded.position.set(3, -1.4, 0.65);
  const expertName = label("", v(3, 0.3));
  const shapeNote = label("", v(0, -4.3), "note");
  const hideAll = () => {
    captions.find((c) => c.node === shapeNote)!.point.y = -4.3;
    captions.find((c) => c.node === headings[1])!.point.y = -4.9;
    matrices.forEach((m) => {
      m.group.visible = false;
      m.group.scale.setScalar(1);
      m.group.rotation.set(1.45, 0, 0);
    });
    lines.forEach((l) => {
      l.visible = false;
    });
    [
      ...users,
      ...dpNames,
      entry,
      movingText,
      modelLabel,
      bankLabel,
      replicaLabel,
      operator,
      equals,
      expertName,
      shapeNote,
      sumStatus,
      ...epRowLabels,
    ].forEach((n) => {
      n.hidden = true;
    });
    expertBank.visible = replicas.visible = epExpanded.visible = false;
    epExpanded.position.set(3, -1.4, 0.65);
    epExpanded.scale.setScalar(1);
    expertWeightLabels.forEach((node) => {
      node.hidden = false;
    });
    expertWeights.forEach((g) => {
      g.scale.setScalar(1);
      g.children.forEach((child) => {
        (child as T.Mesh<T.BoxGeometry, T.MeshLambertMaterial>).material.emissive.set(0);
      });
    });
  };
  const show = (
    m: ReturnType<typeof matrix>,
    at: T.Vector3,
    values: readonly (readonly (number | string)[])[],
    names: readonly string[],
    title: string,
    options: Parameters<typeof m.write>[3] = {},
  ) => {
    m.group.visible = true;
    m.group.position.copy(at);
    m.write(values, names, title, options);
  };
  const text = (node: HTMLElement, s: string) => {
    node.hidden = false;
    if (node.textContent !== s) node.textContent = s;
  };
  const focus = (rank: number, enabled = true) => {
    cardLabels[rank]!.dataset.active = String(enabled);
    machines[Math.floor(rank / 8)]!.chips[rank % 8]!.material.emissive.set(enabled ? "#245b43" : "#000000");
  };
  const cardPoint = (rank: number, slot: "input" | "weight" | "output") =>
    ports[rank]!.clone().add(
      slot === "input" ? v(-0.36, 0.08, 0.2) : slot === "weight" ? v(0.06, 0.15, 0) : v(0.06, -0.24, 0.5),
    );
  const onCard = (
    m: ReturnType<typeof matrix>,
    rank: number,
    slot: "input" | "weight" | "output",
    values: readonly (readonly (number | string)[])[],
    scale: number,
    options: Parameters<typeof m.write>[3] = {},
  ) => {
    show(m, cardPoint(rank, slot), values, [], "", { ...options, numbers: false });
    m.group.scale.setScalar(scale);
    m.group.rotation.x = 0.75;
  };
  const deployment = (local: number) => {
    const d = dpDeployment(local),
      copies = smooth(d.copies),
      landing = d.landing;
    const weightLanding = span(landing, 0, 0.5),
      expertLanding = span(landing, 0.5, 0.86),
      replicaLanding = span(landing, 0.86, 1);
    const weights = Array.from({ length: 8 }, () => Array(4).fill(""));
    text(modelLabel, d.stage === 0 ? "大投影等权重 · 一整张矩阵" : "两台机器各有一份 · 同色对应同一片");
    modelLabel.style.visibility = "visible";
    text(bankLabel, d.stage === 0 ? "全部专家 · 16组，每组18位" : "专家分两半 · 每台 144 位");
    captions.find((c) => c.node === modelLabel)!.point.copy(v(-2.7, -0.05).lerp(v(0, 0.35), copies));
    captions.find((c) => c.node === bankLabel)!.point.copy(v(2.8, -0.05).lerp(v(0, -2.9), copies));
    expertBank.visible = landing < 1;
    replicas.visible = landing < 1;
    replicaLabel.hidden = !replicas.visible;
    replicaCopies.forEach((m, i) => {
      const land = span(replicaLanding, (i % 8) * 0.07, 0.51 + (i % 8) * 0.07);
      m.position.copy(v((i - 7.5) * 0.3, 0, 0)).lerp(ports[i]!.clone().sub(replicas.position), land);
    });
    bankUnits.forEach((g, i) => {
      const start = v(2.9 + ((i % 4) - 1.5) * 0.42, -1.0 - Math.floor(i / 4) * 0.43);
      const separated = v((i < 8 ? -3 : 3) + ((i % 4) - 1.5) * 0.42, -3.05 - Math.floor((i % 8) / 4) * 0.43);
      const land = span(expertLanding, (i % 8) * 0.11, 0.23 + (i % 8) * 0.11);
      g.position.copy(start).lerp(separated, copies).lerp(ports[i]!, land);
      g.scale.setScalar(1 - land * 0.5);
    });
    if (d.stage < 2)
      modelCopies.forEach((m, i) => {
        if (i === 1 && copies === 0) return;
        show(m, v(T.MathUtils.lerp(-2.7, i ? 3 : -3, copies), -1.6 + 0.45 * copies), weights, [], "");
      });
    else
      weightRows.forEach((m, r) => {
        const i = r % 8,
          group = Math.floor(r / 8),
          start = v(group ? 3 : -3, -1.15 + (3.5 - i) * 0.32),
          land = span(weightLanding, i * 0.11, 0.23 + i * 0.11);
        const at = new T.CubicBezierCurve3(
          start,
          start.clone().add(v(group ? 0.55 : -0.55, 1, 0.5)),
          cardPoint(r, "weight").add(v(0, -0.7, 0.5)),
          cardPoint(r, "weight"),
        ).getPointAt(land);
        show(m, at, [Array(4).fill("")], land < 0.75 ? [`W${i}`] : [], "");
        m.group.scale.setScalar(1 - land * 0.5);
        m.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, land);
      });
    if (d.stage === 2) {
      text(modelLabel, "同一输入维切 8 行片 · W0–W7");
      text(bankLabel, "每卡整份持有 18 位专家");
    }
    headings[0]!.textContent = [
      "完整模型 → 三类权重",
      "双机分工 → 两份大矩阵、一套专家",
      landing < 0.5
        ? "先落大矩阵切片 · 依次对应 W0–W7"
        : landing < 0.86
          ? "再落完整专家 · 每卡18位"
          : "最后复制小参数 · 每卡一份",
    ][d.stage]!;
    headings[1]!.textContent = "分配示意 · 权重加载完成后常驻；不表示请求到来后才搬权重";
  };
  const animateDP = (p: number) => {
    const f = dpRequestFrame(p),
      t = f.local;
    if (f.stage === 0) {
      deployment(t);
      host.dataset.matrixShape = "8x4";
      host.dataset.result = "pending";
      return;
    }
    headings[0]!.textContent = "DP 分整条请求 · 每组有自己的队列与状态";
    headings[1]!.textContent = "A、B 各自保留所有 token 行 · MoE 专家仍由两组共同使用";
    weightRows.forEach((m, rank) => {
      onCard(m, rank, "weight", [Array(4).fill("")], 0.5);
    });
    text(entry, "API 前端 · 接收、分词、选组");
    users.forEach((n, i) => {
      text(n, i ? "乙：解释一下缓存原理" : "甲：帮我写一封邮件");
    });
    dpInputs.forEach((m, owner) => {
      captions.find((c) => c.node === dpNames[owner])!.point.copy(v(owner ? 3 : -3, -3.45));
      const req = f.requests[owner]!,
        s = dpMatrixState(f.stage, t, owner),
        r = dpReplyState(f.stage, t, owner),
        side = owner ? 3 : -3;
      const home = v(side, -1.85),
        frontend = v(0, -0.55);
      text(
        dpNames[owner]!,
        `DP${owner} · ${f.stage < (owner ? 4 : 2) ? "等待请求" : f.stage < 5 ? "等待队列" : f.stage === 5 ? "本组8卡计算" : f.stage === 6 ? (r.result < 1 ? "写出本组输出" : "回复经前端送回") : "回复已交回"}`,
      );
      if (s.tokenized && r.deliver === 0)
        route(owners[owner]!, cardPoint(owner * 8 + 3, "input"), v(side, -0.65));
      if (s.tokenized) {
        const at =
          req.place === "arriving"
            ? frontend
            : req.place === "dispatch"
              ? route(flow, frontend, home, span(t, 0.02, 0.94))
              : home;
        show(
          m,
          at,
          s.embedded > 0 ? requestHidden(owner) : requestIds(owner).map((id) => [id]),
          REQUEST_TOKENS[owner]!,
          s.embedded > 0
            ? `请求${owner ? "B" : "A"} · 4行 × 6示意通道`
            : `请求${owner ? "B" : "A"} · 4个编号`,
          { columns: s.columns, expansion: s.embedded > 0 ? s.embedded : 1 },
        );
        // Reply step: the input shrinks away while the group's output is written in its place.
        m.group.scale.setScalar(1 - span(r.result, 0, 0.6));
        m.group.visible = r.result < 0.6;
      }
      if (r.result > 0) {
        const out = dpOutputs[owner]!,
          name = owner ? "b" : "a";
        const via = v(owner ? 0.9 : -0.9, -0.55),
          dest = v(side, -0.3);
        const at =
          r.deliver < 0.4
            ? route(replies[owner]!, home, via, r.deliver / 0.4)
            : route(replies[owner]!, via, dest, Math.min(1, (r.deliver - 0.4) / 0.4));
        show(
          out,
          at,
          requestOutput(owner),
          r.deliver > 0 ? [] : REQUEST_TOKENS[owner]!,
          r.deliver >= 0.8
            ? ""
            : r.deliver > 0
              ? `回复 ${name}`
              : `请求${owner ? "B" : "A"}的输出 · 4行 × 6示意通道`,
          { result: true, written: span(r.result, 0.1, 1), numbers: r.deliver === 0 },
        );
        out.group.scale.setScalar(
          r.deliver < 0.8
            ? T.MathUtils.lerp(1, 0.55, r.deliver / 0.8)
            : T.MathUtils.lerp(0.55, 0.42, (r.deliver - 0.8) / 0.2),
        );
        if (r.deliver >= 0.8) text(users[owner]!, `${owner ? "乙" : "甲"} ← 回复 ${name}`);
      }
      if (req.place === "arriving" && !s.tokenized) {
        const pos = route(flow, v(side, 0.1), frontend, span(t, 0, 0.45));
        const cap = captions.find((c) => c.node === movingText)!;
        cap.point.copy(pos);
        text(movingText, `“${REQUEST_TOKENS[owner]!.join("")}”`);
      }
      if (s.embedded === 1) {
        for (let i = 0; i < 8; i++) {
          const rank = owner * 8 + i;
          const land = f.stage === 5 ? span(t, 0.55 + i * 0.012, 0.72 + i * 0.012) : 1;
          const work = f.stage === 5 ? span(t, 0.82, 0.99) : 1;
          const dest = cardPoint(rank, "input");
          const path = new T.CubicBezierCurve3(
            home,
            v(side, -0.1, 1.4),
            dest.clone().add(v(0, -0.6, 0.8)),
            dest,
          );
          show(cardInputs[rank]!, path.getPointAt(land), requestHidden(owner), [], "", { numbers: false });
          cardInputs[rank]!.group.scale.setScalar(T.MathUtils.lerp(1, 0.17, land));
          cardInputs[rank]!.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, land);
          cardInputs[rank]!.group.visible = land > 0;
          if (land === 1) {
            onCard(
              cardResults[rank]!,
              rank,
              "output",
              Array.from({ length: 4 }, () => Array(4).fill("")),
              0.24,
              { result: true, written: work },
            );
            if (work > 0 && work < 1) {
              focus(rank);
              weightRows[rank]!.group.position.y += 0.12 * Math.sin(work * Math.PI);
            }
          }
        }
        if (f.stage === 5)
          text(dpNames[owner]!, t < 0.82 ? `DP${owner} · 本组各卡读取输入` : `DP${owner} · 各卡写出中间结果`);
      }
    });
    if (f.stage === 1 || f.stage === 3)
      text(entry, f.stage === 1 ? "负载 0 : 0 → 本例先选 DP0" : "负载 4 : 0 → 本次选 DP1");
    if (f.stage >= 5)
      headings[1]!.textContent =
        f.stage === 5
          ? "橙色输入 → 蓝色本卡权重参与 → 绿色中间结果 · 此处演示分工，具体乘法见 TP"
          : "绿色：本组算出的输出 · 经前端送回发请求的用户";
    host.dataset.matrixShape = dpInputs.map((_, i) => `4x${dpMatrixState(f.stage, t, i).columns}`).join(",");
    host.dataset.result = f.stage === 7 ? "A:a;B:b" : "pending";
  };
  const animateTP = (p: number) => {
    const { phase, local: t } = parallelPhase(p),
      group = Math.floor(selected / 8),
      k = selected % 8;
    headings[0]!.textContent = `TP8 · 展开服务器 ${group} 的一次 down 投影`;
    headings[1]!.textContent = "纵向始终是 4 个 token · 只沿输入通道分工 · 矩阵尺寸为缩小算例";
    if (phase >= 2) route(owners[0]!, ports[selected]!, phase === 2 ? v(-1.8, -1.35) : v(0, -0.6));
    const weights = Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 4 }, (_, c) => (r + 1) * (c + 1)),
    );
    if (phase >= 2) {
      const work = phase === 2 ? T.MathUtils.clamp((t - 0.2) / 0.55, 0, 1) : 1;
      const returned =
        phase > 4 ? 8 : phase === 4 ? parallelTransfer(T.MathUtils.clamp((t - 0.14) / 0.86, 0, 1)).count : 0;
      for (let i = 0; i < 8; i++) {
        const rank = group * 8 + i;
        if (phase !== 2 || rank !== selected) {
          onCard(
            xColumns[i]!,
            rank,
            "input",
            tpInput().map((r) => [r[i]!]),
            0.28,
          );
          onCard(weightRows[i]!, rank, "weight", [weights[i]!], 0.5);
        }
        if (phase !== 2 || rank !== selected)
          onCard(cardResults[rank]!, rank, "output", i < returned ? tpSum(8) : tpPartial(i), 0.24, {
            result: true,
            written: work,
          });
        if (work > 0 && work < 1) focus(rank);
      }
      host.dataset.cardOutputs = `${returned} complete;${8 - returned} partial`;
    } else host.dataset.cardOutputs = "0";
    if (phase === 0) {
      show(xFull, v(-3, -1.7), tpInput(), REQUEST_TOKENS[group]!, "输入 X · 4行 × 8通道");
      show(modelCopies[0]!, v(3, -1.7), weights, [], "权重 W · 8行 × 4列");
      text(shapeNote, "X 的一列 × W 的对应一行 → 一张 4×4 部分和");
    } else if (phase === 1) {
      for (let i = 0; i < 8; i++) {
        const land = span(t, i * 0.025, 0.65 + i * 0.025);
        const rank = group * 8 + i,
          x = xColumns[i]!,
          w = weightRows[i]!;
        const xStart = v(-3 + (i - 3.5) * 0.4, -1.7),
          wStart = v(3, -1.7 + (3.5 - i) * 0.32);
        const xDest = cardPoint(rank, "input"),
          wDest = cardPoint(rank, "weight");
        show(
          x,
          new T.CubicBezierCurve3(
            xStart,
            xStart.clone().add(v(-0.5, 1, 0.7)),
            xDest.clone().add(v(0, -0.7, 0.7)),
            xDest,
          ).getPointAt(land),
          tpInput().map((r) => [r[i]!]),
          i === 0 && land === 0 ? REQUEST_TOKENS[group]! : [],
          "",
          { numbers: land < 0.7 },
        );
        show(
          w,
          new T.CubicBezierCurve3(
            wStart,
            wStart.clone().add(v(0.5, 1, 0.7)),
            wDest.clone().add(v(0, -0.7, 0.7)),
            wDest,
          ).getPointAt(land),
          [weights[i]!],
          land < 0.65 ? [`W${i}`] : [],
          "",
          { numbers: land < 0.7 },
        );
        x.group.scale.setScalar(1 - land * 0.72);
        w.group.scale.setScalar(1 - land * 0.5);
        x.group.rotation.x = w.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, land);
      }
      text(shapeNote, "按列切输入、按行切权重 · 同编号成对落卡 · 全部 token 行保留");
    } else if (phase === 2) {
      const unfold = span(t, 0, 0.2),
        work = T.MathUtils.clamp((t - 0.2) / 0.55, 0, 1),
        fold = span(t, 0.8, 1);
      show(
        smallX,
        cardPoint(selected, "input").lerp(v(-4, -1.7), unfold),
        tpInput().map((r) => [r[k]!]),
        unfold === 1 ? REQUEST_TOKENS[group]! : [],
        unfold === 1 ? `卡${selected} · 输入列${k}` : "",
        { numbers: unfold > 0.8, focusRow: Math.min(3, Math.floor(work * 4)) },
      );
      smallX.group.scale.setScalar(T.MathUtils.lerp((0.28 * 0.4) / 0.5, 1, unfold));
      show(
        smallW,
        cardPoint(selected, "weight").lerp(v(-1.8, -1.7), unfold),
        [weights[k]!],
        [],
        unfold === 1 ? `权重行 W${k}` : "",
        { numbers: unfold > 0.8, focusColumn: Math.min(15, Math.floor(work * 16)) % 4 },
      );
      smallW.group.scale.setScalar(T.MathUtils.lerp((0.5 * 0.32) / 0.5, 1, unfold));
      smallX.group.rotation.x = smallW.group.rotation.x = T.MathUtils.lerp(0.75, 1.45, unfold);
      show(
        partial,
        fold > 0 ? route(returnFlow, v(3, -1.7), cardPoint(selected, "output"), fold) : v(3, -1.7),
        tpPartial(k),
        [],
        fold === 0 ? "本卡部分和 · 4×4" : "",
        { result: true, numbers: fold < 0.5, written: work },
      );
      partial.group.visible = unfold === 1;
      partial.group.scale.setScalar(1 - 0.76 * fold);
      partial.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, fold);
      if (fold > 0) {
        smallX.group.position.lerp(cardPoint(selected, "input"), fold);
        smallW.group.position.lerp(cardPoint(selected, "weight"), fold);
        smallX.group.scale.setScalar(T.MathUtils.lerp(1, (0.28 * 0.4) / 0.5, fold));
        smallW.group.scale.setScalar(T.MathUtils.lerp(1, (0.5 * 0.32) / 0.5, fold));
        smallX.group.rotation.x = smallW.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, fold);
        smallX.write(
          tpInput().map((r) => [r[k]!]),
          [],
          "",
          { numbers: false },
        );
        smallW.write([weights[k]!], [], "", { numbers: false });
      }
      operator.hidden = equals.hidden = unfold < 1;
      captions.find((c) => c.node === operator)!.point.set(-3, -1.7, 0.6);
      captions.find((c) => c.node === equals)!.point.set(0.5, -1.7, 0.6);
      const cell = Math.min(15, Math.floor(work * 16)),
        r = Math.floor(cell / 4),
        c = cell % 4;
      if (unfold === 1 && work < 1) {
        const dest = partial.group.localToWorld(new T.Vector3((c - 1.5) * 0.5, 0.15, (r - 1.5) * 0.5));
        const a = smallX.rowPoint(r),
          b = smallW.group.localToWorld(new T.Vector3((c - 1.5) * 0.5, 0, 0));
        const paths = [
          new T.CubicBezierCurve3(a, v(-3.6, -3.2, 0.1), v(dest.x, -3.2, 0.1), dest),
          new T.CubicBezierCurve3(b, v(b.x, -0.7, 0.1), v(dest.x, -0.7, 0.1), dest),
        ];
        paths.forEach((path, i) => {
          setWidePolylinePoints(localCompute[i]!, path.getPoints(24));
          localCompute[i]!.visible = true;
        });
      }
      text(
        shapeNote,
        `第${r + 1}行 × 权重第${c + 1}列：${r + 1} × ${(k + 1) * (c + 1)} = ${(r + 1) * (k + 1) * (c + 1)} · 上方其余7卡同步写出各自部分和`,
      );
    } else if (phase === 3) {
      const { index: current, local, count } = parallelTransfer(t);
      const combine = span(local, 0.48, 0.86);
      show(
        partial,
        v(-3, -1.7)
          .lerp(v(3, -1.7), combine)
          .add(v(0, 0, 1.2 * Math.sin(combine * Math.PI))),
        tpPartial(current),
        combine === 0 ? REQUEST_TOKENS[group]! : [],
        combine === 0 ? `卡${group * 8 + current} · 第${current + 1}/8份` : "",
        { result: true, numbers: combine < 0.25 },
      );
      show(total, v(3, -1.7), tpSum(count), REQUEST_TOKENS[group]!, `已合并 ${count}/8 · 同位置相加`, {
        result: true,
      });
      text(operator, "+");
      captions.find((c) => c.node === operator)!.point.set(0, -1.7, 0.6);
      route(owners[0]!, ports[group * 8 + current]!, v(-3, -0.7));
      const merge = span(local, 0, 0.45);
      show(
        matrixPacket,
        route(returnFlow, cardPoint(group * 8 + current, "output"), v(-3, -1.7), merge),
        tpPartial(current),
        [],
        "",
        { result: true, numbers: merge > 0.65 },
      );
      matrixPacket.group.scale.setScalar(0.25 + merge * 0.75);
      matrixPacket.group.rotation.x = T.MathUtils.lerp(0.75, 1.45, merge);
      matrixPacket.group.visible = merge < 1;
      partial.group.visible = merge === 1 && combine < 1;
      returnFlow.visible = merge < 1;
      if (count > current) total.group.scale.setScalar(1 + 0.025 * Math.sin(span(local, 0.86, 1) * Math.PI));
      focus(group * 8 + current);
      text(
        shapeNote,
        `左上格：${(current * (current + 1)) / 2} + ${current + 1} → ${((current + 1) * (current + 2)) / 2} · 其他15格按同样的位置相加`,
      );
    } else {
      const centered = phase === 4 ? span(t, 0, 0.14) : 1;
      const home = v(3, -1.7).lerp(v(0, -1.65), centered);
      show(total, home, tpSum(8), REQUEST_TOKENS[group]!, "完整输出 · 4行 × 4通道", { result: true });
      if (phase === 4) {
        const { index: r, local } = parallelTransfer(T.MathUtils.clamp((t - 0.14) / 0.86, 0, 1));
        const travel = span(local, 0, 0.86);
        show(
          matrixPacket,
          route(returnFlow, home, cardPoint(group * 8 + r, "output"), travel),
          tpSum(8),
          [],
          "",
          {
            result: true,
            numbers: travel < 0.7,
          },
        );
        matrixPacket.group.scale.setScalar(1 - travel * 0.76);
        matrixPacket.group.rotation.x = T.MathUtils.lerp(1.45, 0.75, travel);
        matrixPacket.group.visible = centered === 1 && travel > 0 && travel < 1;
        returnFlow.visible = centered === 1 && travel < 1;
        focus(group * 8 + r);
      }
      text(shapeNote, "本组8卡都得到这张矩阵 · 左上 36，右下 576");
    }
    host.dataset.matrixShape = phase < 2 ? "4x8" : "4x4";
    host.dataset.result = phase >= 4 ? "36" : "pending";
  };
  const animateEP = (p: number) => {
    const { phase, local: t } = parallelPhase(p, true),
      choices = expertAssignments(selected),
      transfer = parallelTransfer(t),
      current = phase === 2 ? 0 : transfer.index,
      local = phase === 2 ? t : transfer.local,
      merged = transfer.count;
    const values = requestHidden(0).map((r) => [...r]);
    const written = phase === 5 && t >= 0.88;
    if (written)
      values[EP_FOCUS_ROW] = Array.from({ length: 6 }, (_, c) => fmt(EP_COMBINED_CHANNEL * (c + 1)));
    onCard(
      cardInputs[selected]!,
      selected,
      "input",
      values,
      0.18,
      written ? { resultRow: EP_FOCUS_ROW } : { focusRow: EP_FOCUS_ROW },
    );
    const expertPort = (index: number) => {
      const e = choices[index]!;
      return expertTiles[e.rank]!.mesh.localToWorld(expertSlot(e.slot).add(v(0, 0.35, 0.45)));
    };
    const receive = (index: number) => expertPort(index).add(v(0, -0.04, 0.22));
    const outputPort = (index: number) => receive(index).add(v(0, -0.18, 0.22));
    const sourceRow = cardInputs[selected]!.rowPoint(EP_FOCUS_ROW);
    choices.forEach((_, i) => {
      const received = phase > 1 || (phase === 1 && (i < current || (i === current && local >= 0.86)));
      const complete = phase > 2 || (phase === 2 && (i === current ? local >= 0.94 : local >= 0.58));
      if (received) {
        show(expertInputs[i]!, receive(i), [requestHidden(0)[EP_FOCUS_ROW]!], [], "", { numbers: false });
        expertInputs[i]!.group.scale.setScalar(0.14);
        expertInputs[i]!.group.rotation.x = 0.75;
      }
      if (complete) {
        show(
          expertOutputs[i]!,
          outputPort(i),
          [Array.from({ length: 6 }, (_, c) => EP_OUTPUT_CHANNEL[i]! * (c + 1))],
          [],
          "",
          { numbers: false, result: true, written: phase === 2 ? span(local, 0.58, 0.76) : 1 },
        );
        expertOutputs[i]!.group.scale.setScalar(0.14);
        expertOutputs[i]!.group.rotation.x = 0.75;
      }
    });
    if (phase >= 3)
      onCard(
        sourceBuffer,
        selected,
        "output",
        EP_OUTPUT_CHANNEL.map((n) => Array.from({ length: 6 }, (_, c) => n * (c + 1))),
        0.15,
        {
          result: true,
          written: phase > 3 ? 1 : merged / 8,
          ...(phase === 4 ? { focusRow: current } : {}),
        },
      );
    host.dataset.expertResidentOutputs = String(
      phase > 2 || (phase === 2 && local >= 0.94) ? 8 : phase === 2 && local >= 0.76 ? 7 : 0,
    );
    const replacing = phase === 5 && t >= 0.62 && !written;
    show(
      input,
      v(-3.15, -1.4),
      values.map((r, i) => (replacing && i === EP_FOCUS_ROW ? r.map(() => "") : r)),
      REQUEST_TOKENS[0],
      `源卡${selected} · 完整4行输入`,
      {
        focusRow: EP_FOCUS_ROW,
        ...(written ? { resultRow: EP_FOCUS_ROW } : {}),
      },
    );
    headings[0]!.textContent = "EP · 完整输入中，每个 token 独立选择专家";
    headings[1]!.textContent = "始终追踪“一封”这一行 · 其余三行保留，随后各自路由";
    const row = input.rowPoint(EP_FOCUS_ROW),
      resultAt = v(-3.15, -3.7);
    captions.find((c) => c.node === shapeNote)!.point.y = phase >= 4 ? -4.8 : -4.3;
    captions.find((c) => c.node === headings[1])!.point.y = phase >= 4 ? -5.4 : -4.9;
    route(owners[0]!, cardPoint(selected, "input"), v(-3.15, 0));
    if (phase === 0) {
      if (!epIntroduction(t).selected) {
        const unfold = span(t, 0.06, 0.34);
        epExpanded.visible = true;
        epExpanded.position.copy(expertPort(0)).lerp(v(3, -1.4, 0.65), unfold);
        epExpanded.scale.setScalar(0.2 + 0.8 * unfold);
        expertWeightLabels.forEach((node) => {
          node.hidden = unfold < 1;
        });
        text(expertName, "一位专家 = 三套完整权重");
        text(shapeNote, "本层288位专家分在16卡 · 每卡18位 · 先认输入与存放位置");
      } else {
        choices.forEach((e, i) => {
          const m = epRows[i]!,
            reveal = span(t, 2 / 3 + i * 0.025, 0.8 + i * 0.025);
          show(m, v(3, -0.45 - i * 0.43), [Array(6).fill("")], [], "", { written: 0 });
          m.group.scale.x = reveal;
          text(epRowLabels[i]!, `E${e.expert} · 卡${e.rank}`);
          epRowLabels[i]!.hidden = reveal < 0.5;
        });
        text(expertName, "router 为“一封”选出的 8 位专家");
        text(shapeNote, "同一行发给8位专家；其他 token 会有自己的选择");
      }
    } else if (phase === 1 || phase === 2) {
      const e = choices[current]!;
      text(expertName, `卡${e.rank} · 专家 E${e.expert}`);
      focus(e.rank);
      if (phase === 1) {
        const travel = span(local, 0, 0.86);
        choices.forEach((choice, i) => {
          const arrived = i < current || (i === current && local >= 0.86);
          show(
            epRows[i]!,
            v(3, -0.45 - i * 0.43),
            [arrived ? requestHidden(0)[EP_FOCUS_ROW]! : Array(6).fill("")],
            [],
            "",
            { numbers: arrived, color: palette.data, written: arrived ? 1 : 0 },
          );
          text(epRowLabels[i]!, `E${choice.expert}`);
        });
        show(
          packet,
          route(flow, sourceRow, receive(current), travel, e.rank === selected ? 0.55 : 0),
          [requestHidden(0)[EP_FOCUS_ROW]!],
          [],
          "",
          { numbers: false },
        );
        packet.group.scale.setScalar(0.14 + 0.08 * Math.sin(travel * Math.PI));
        packet.group.rotation.x = 0.75;
        packet.group.visible = local < 0.86;
        flow.visible = local < 0.86;
        route(owners[1]!, receive(current), v(1.55, -0.45 - current * 0.43));
        text(shapeNote, `派发 ${current + 1}/8 · 输入找专家，专家权重留在卡${e.rank}`);
      } else {
        const unfold = span(local, 0, 0.18),
          entering = span(local, 0.18, 0.32),
          leaving = span(local, 0.58, 0.76),
          stored = span(local, 0.76, 0.94),
          output = local >= 0.58;
        epExpanded.visible = true;
        epExpanded.position
          .copy(expertPort(current))
          .lerp(v(3, -1.4, 0.65), unfold)
          .lerp(expertPort(current), stored);
        epExpanded.scale.setScalar((0.14 + 0.86 * unfold) * (1 - stored * 0.86));
        expertWeightLabels.forEach((node) => {
          node.hidden = unfold < 1 || stored > 0;
        });
        route(owners[1]!, expertPort(current), v(3, 0.35));
        if (local >= 0.28 && local < 0.58) {
          epBranches.forEach((branch, i) => {
            const fork = span(local, 0.28, 0.4),
              merge = span(local, 0.44, 0.58);
            const from = v(3, -2.3, 1.4),
              through = v(i ? 3.85 : 2.15, -1.5, 1.15),
              to = v(3, -1.8, 1.65);
            const path = new T.QuadraticBezierCurve3(from, v(i ? 4.1 : 1.9, -2.2, 1.8), through);
            const at = path.getPoint(fork).lerp(to, merge);
            show(branch, at, [Array(6).fill("")], [], "", { numbers: false });
            branch.group.scale.setScalar(0.34);
            branch.group.rotation.y = (i ? -1 : 1) * 0.2 * (1 - merge);
            setWidePolylinePoints(localCompute[i]!, [...path.getPoints(16), to]);
            localCompute[i]!.visible = true;
          });
          text(shapeNote, "同一行进入 gate / up → 两路中间向量逐通道相乘 → down（中间数值省略）");
        }
        const activeParts = local < 0.42 ? [0, 1] : [2];
        expertWeights.forEach((g, i) => {
          if (!activeParts.includes(i)) return;
          g.scale.setScalar(1.04);
          g.children.forEach((child) => {
            (child as T.Mesh<T.BoxGeometry, T.MeshLambertMaterial>).material.emissive.set("#163e52");
          });
        });
        const outputAt = v(3, -2.2).lerp(v(3, -3), leaving);
        show(
          packet,
          output
            ? stored > 0
              ? route(returnFlow, v(3, -3), outputPort(current), stored)
              : outputAt
            : receive(current).lerp(v(3, -2.8), unfold).lerp(v(3, -1.8), entering),
          [
            Array.from({ length: 6 }, (_, c) =>
              output ? EP_OUTPUT_CHANNEL[current]! * (c + 1) : requestHidden(0)[EP_FOCUS_ROW]![c]!,
            ),
          ],
          [],
          "",
          { result: output, numbers: output ? leaving === 1 && stored < 0.25 : entering < 0.25 },
        );
        packet.group.scale.setScalar(
          output
            ? (0.3 + 0.7 * leaving) * (1 - stored * 0.86)
            : (0.14 + 0.86 * unfold) * (1 - entering * 0.7),
        );
        packet.group.visible = local < 0.32 || (output && stored < 1);
        text(
          shapeNote,
          `放大 E${e.expert} · ${local < 0.28 ? "权重与输入从本卡展开" : local < 0.58 ? "同一行进 gate / up → 两路逐通道相乘 → down（中间值省略）" : "8位专家分别写出输出，绿色结果留在各自卡上"}`,
        );
      }
    } else {
      text(
        expertName,
        phase === 3 ? "返回源卡的8份结果" : phase === 4 ? "按路由权重合成同一行" : "结果写回“一封”的原位置",
      );
      epRows.forEach((m, i) => {
        const arrived = phase > 3 || i < current || (i === current && local >= 0.86);
        show(
          m,
          v(3, -0.45 - i * 0.43),
          [Array.from({ length: 6 }, (_, c) => (arrived ? EP_OUTPUT_CHANNEL[i]! * (c + 1) : "·"))],
          [],
          "",
          { result: true, numbers: arrived || i !== current || phase > 3, written: arrived ? 1 : 0 },
        );
        text(epRowLabels[i]!, `E${choices[i]!.expert}`);
      });
      if (phase === 3) {
        const e = choices[current]!;
        const travel = span(local, 0, 0.86);
        const dest = sourceBuffer.rowPoint(current);
        const position = route(
          returnFlow,
          outputPort(current),
          dest,
          travel,
          e.rank === selected ? -0.55 : 0,
        );
        focus(e.rank);
        show(
          packet,
          position,
          [Array.from({ length: 6 }, (_, c) => EP_OUTPUT_CHANNEL[current]! * (c + 1))],
          [],
          "",
          { result: true, numbers: false },
        );
        packet.group.scale.setScalar(0.14 + 0.08 * Math.sin(travel * Math.PI));
        packet.group.rotation.x = 0.75;
        packet.group.visible = local < 0.86;
        returnFlow.visible = local < 0.86;
        route(owners[1]!, dest, v(1.55, -0.45 - current * 0.43));
        text(shapeNote, `收回 ${current + 1}/8 · 每一份保留专家编号与全部通道`);
      } else {
        const count = phase === 5 ? 8 : merged;
        const sum = EP_ROUTE_WEIGHTS.slice(0, count).reduce((s, w, i) => s + w * EP_OUTPUT_CHANNEL[i]!, 0);
        if (!written) {
          show(
            cardCombined,
            cardPoint(selected, "output").add(v(0, -0.45, 0.3)),
            [Array.from({ length: 6 }, (_, c) => fmt(sum * (c + 1)))],
            [],
            "",
            { result: true, numbers: false },
          );
          cardCombined.group.scale.setScalar(0.16);
          cardCombined.group.rotation.x = 0.75;
        }
        const returning = phase === 5;
        const enter = returning ? span(t, 0.62, 0.88) : 0;
        const path = new T.CubicBezierCurve3(resultAt, v(-5.9, resultAt.y), v(-5.9, row.y), v(-5.6, row.y));
        const at = returning
          ? t < 0.62
            ? path.getPoint(span(t, 0.04, 0.62))
            : v(-5.6, row.y).lerp(row, enter)
          : resultAt;
        if (!written)
          show(epSum, at, [Array.from({ length: 6 }, (_, c) => fmt(sum * (c + 1)))], [], "", {
            result: true,
            numbers: !returning || t < 0.1 || enter > 0.9,
          });
        if (returning) epSum.group.scale.setScalar(1 - 0.75 * span(t, 0.04, 0.2) + 0.75 * enter);
        if (phase === 4) {
          text(sumStatus, `已合并 ${count}/8 份贡献`);
          const from = v(3, -0.45 - current * 0.43);
          const travel = span(local, 0, 0.7),
            settle = span(local, 0.7, 0.86);
          const path = new T.CurvePath<T.Vector3>();
          path.add(new T.LineCurve3(from, v(0.5, from.y)));
          path.add(new T.CubicBezierCurve3(v(0.5, from.y), v(0.1, from.y), v(0.1, -2.95), v(-3.15, -2.95)));
          setWidePolylinePoints(returnFlow, path.getPoints(24));
          returnFlow.visible = true;
          const position = path.getPoint(travel).lerp(resultAt, settle);
          const weighted = position.x < 0.9;
          const corridor = span(1.1 - position.x, 0, 0.8);
          const belowInput = span(-position.y, 2.65, 2.95);
          show(
            packet,
            position,
            [
              Array.from({ length: 6 }, (_, c) =>
                fmt((weighted ? EP_ROUTE_WEIGHTS[current]! : 1) * EP_OUTPUT_CHANNEL[current]! * (c + 1)),
              ),
            ],
            [],
            "",
            { result: true, numbers: settle === 0 && belowInput > 0.95 },
          );
          packet.group.scale.setScalar(
            T.MathUtils.lerp(T.MathUtils.lerp(0.43 / 0.62, 0.25, corridor), 1, belowInput) *
              (1 - settle * 0.2),
          );
          packet.group.visible = local < 0.86;
          returnFlow.visible = local < 0.7;
          text(
            shapeNote,
            `第1通道：${fmt(EP_ROUTE_WEIGHTS.slice(0, current).reduce((s, w, i) => s + w * EP_OUTPUT_CHANNEL[i]!, 0))} + ${EP_ROUTE_WEIGHTS[current]} × ${EP_OUTPUT_CHANNEL[current]} · 八份合齐得到 6.6`,
          );
        } else {
          if (!written) {
            setWidePolylinePoints(returnFlow, [...path.getPoints(32), row]);
            returnFlow.visible = true;
          }
          text(shapeNote, "六个通道分别合并 → 写回原行 → 后续计算");
        }
      }
    }
    host.dataset.matrixShape = "4x6;focus-row=2";
    host.dataset.result = written ? "combined" : "pending";
  };
  const projected = new T.Vector3();
  const render = () => {
    if (disposed) return;
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    captions.forEach(({ node, point, parent }) => {
      if (node.hidden) return;
      let visible = true;
      for (let p: T.Object3D | null = parent; p; p = p.parent) if (!p.visible) visible = false;
      node.style.display = visible ? "" : "none";
      if (!visible) return;
      projected.copy(point).applyMatrix4(parent.matrixWorld).project(camera);
      node.style.left = `${((projected.x + 1) * width) / 2}px`;
      node.style.top = `${((1 - projected.y) * height) / 2}px`;
    });
    matrices.forEach((m) => {
      m.renderLabels(camera, width, height);
    });
    host.dataset.drawCalls = String(renderer.info.render.calls);
  };
  const animate = (p: number) => {
    progress = Math.max(0, Math.min(1, p));
    hideAll();
    operator.textContent = "×";
    const f = dpRequestFrame(progress),
      tp = parallelPhase(progress),
      ep = parallelPhase(progress, true);
    const resident =
      step === 1 ? f.stage > 0 || dpDeployment(f.local).landing === 1 : step === 0 ? tp.phase > 1 : true;
    machines.forEach((h, g) => {
      h.payloads.forEach((m, i) => {
        m.visible = false;
        focus(g * 8 + i, false);
      });
    });
    const choices = expertAssignments(selected);
    expertTiles.forEach((e, r) => {
      const point = machines[Math.floor(r / 8)]!.points[r % 8]!;
      e.mesh.position.copy(point).add(v(0, -0.48, step === 1 ? 0.65 : 0));
      e.mesh.scale.setScalar(step === 1 ? 0.5 : 0.85);
      e.mesh.visible = step === 2 || (step === 1 && resident);
      e.update(
        new Set(
          step === 2 && (ep.phase > 0 || epIntroduction(ep.local).selected)
            ? choices.filter((x) => x.rank === r).map((x) => x.slot)
            : [],
        ),
        ep.phase,
        ep.local,
        step === 2 && ep.phase === 2 ? -2 : -1,
      );
    });
    focus(selected);
    scene.updateMatrixWorld(true);
    if (step === 1) animateDP(progress);
    else if (step === 0) animateTP(progress);
    else animateEP(progress);
    host.dataset.progress = progress.toFixed(3);
    host.dataset.phase = String(step === 1 ? f.stage : step === 2 ? ep.phase : tp.phase);
    host.dataset.weightState = resident
      ? "resident"
      : (step === 1 && dpDeployment(f.local).stage === 0) || (step === 0 && tp.phase === 0)
        ? "whole"
        : "splitting";
    host.dataset.selected = String(selected);
    host.dataset.step = String(step);
    render();
  };
  const update = (next: number, rank: number) => {
    if (step === next && selected === rank) return;
    step = next;
    selected = rank;
    animate(progress);
  };
  const reset = () => {
    controls.target.set(0, 0, 0);
    camera.position.set(1, 6.1, 25);
    controls.update();
    render();
  };
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    const half = Math.max(6.1, (6.7 * height) / width);
    camera.top = half;
    camera.bottom = -half;
    camera.left = (-half * width) / height;
    camera.right = (half * width) / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    lines.forEach((l) => {
      l.material.resolution.set(width, height);
    });
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  controls.addEventListener("change", render);
  host.dataset.asset = "atlas-800t-a2.glb:npu×16";
  reset();
  resize();
  animate(0);
  return {
    update,
    animate,
    reset,
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      machines.forEach((h) => {
        h.dispose();
      });
      expertTiles.forEach((e) => {
        e.dispose();
      });
      matrices.forEach((m) => {
        m.dispose();
        m.mesh.geometry.dispose();
        m.mesh.material.dispose();
      });
      lines.forEach((l) => {
        l.geometry.dispose();
      });
      materials.forEach((m) => {
        m.dispose();
      });
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      overlay.remove();
    },
  };
}
