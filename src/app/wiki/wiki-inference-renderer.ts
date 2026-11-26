import * as T from "three";
import { INK, type InferenceKit, inferenceSceneKit, V, type Values } from "./inference-scene-kit";
import { span } from "./scene-easing";
import {
  ATTENTION,
  ATTENTION_OUTPUT,
  ATTENTION_TOTAL,
  CORE_OUTPUT,
  CORE_PRODUCT,
  CORE_W,
  CORE_X,
  inferenceFrame,
  KV_BLOCKS,
  kvOwnership,
  kvRow,
  numberText,
  pdStageStatus,
} from "./scene-inference";
import { setWidePolylinePoints } from "./scene-polyline";
import { epTransferPath } from "./wiki-parallel-strategy-renderer";

const blank = (rows: number, cols: number): Values =>
  Array.from({ length: rows }, () => Array<string>(cols).fill(""));

function attentionScene(k: InferenceKit) {
  const q = k.matrix("Q7 · 查询 / 4 通道", [ATTENTION.query], V(-1.4, 2), INK.blue, 0.64);
  const keys = k.matrix(
    "K · 用来匹配",
    ATTENTION.keys,
    V(-4.8, -1.5),
    INK.gold,
    0.58,
    Array.from({ length: 8 }, (_, i) => `位置${i}`),
    [1.16, 0.58, 0.58, 0.58],
  );
  const vals = k.matrix("V · 取回的内容", ATTENTION.values, V(-1.4, -1.5), INK.blue, 0.58);
  const weights = k.matrix(
    "原始份数",
    ATTENTION.mass.map((x) => [x]),
    V(2, -1.5),
    INK.violet,
    0.58,
    [],
    [1.1],
  );
  const total = k.matrix("总份数", [[8]], V(4.7, 0.25), INK.violet, 0.85);
  const out = k.matrix("注意力输出 O · 4 通道", [ATTENTION_OUTPUT], V(-3.8, -6.55), INK.green, 0.94);
  out.titlePoint.y = -0.76;
  const incoming = k.matrix("当前行 × 占比", blank(1, 4), V(3.8, -5.05), INK.green, 0.94);
  incoming.titlePoint.set(0, -0.76, 0.3);
  const sumIntake = k.matrix("本行已到达", blank(1, 4), V(-3.8, -5.05), INK.green, 0.94);
  sumIntake.titlePoint.set(0, -0.76, 0.3);
  let focusChannel = 0;
  let lastP = 0;
  out.cells.forEach((cell, c) => {
    k.pick(cell, () => {
      focusChannel = c;
      step(lastP);
      k.render();
    });
  });
  const equation = k.label("同一位置的 K、V 在同一行", V(0, -8.15), "equation");
  const contribution = k.transfer([ATTENTION_OUTPUT], INK.green, 1.05);
  const readLine = k.wire([V(0, 0), V(0, 0)], INK.green);
  const readBead = k.box(V(0, 0), V(0.15, 0.15, 0.15), INK.green);
  const match = k.wire([V(0, 0), V(0, 0)], INK.gold);
  const overview = k.label("单头注意力逻辑展开 · 位置 7 查询历史 0..7", V(0, 8.15), "region");
  const singleOwner = k.ownership(0, V(-4.8, 1.35), "本卡 NPU 0");
  k.memory(0, [q, keys, vals, weights, out]);
  const step = (p: number) => {
    lastP = p;
    const f = inferenceFrame(0, p);
    const row = Math.min(7, Math.floor(f.local * 8));
    q.group.position.set(-1.4, 2, 0);
    overview.textContent = "单头注意力逻辑展开 · 位置 7 查询历史 0..7";
    singleOwner.line.visible = true;
    singleOwner.caption.style.visibility = "visible";
    keys.write(ATTENTION.keys, { focus: f.phase === 1 ? row : undefined });
    vals.write(ATTENTION.values, { focus: f.phase === 3 ? row : undefined });
    weights.title.textContent = f.phase >= 2 ? "占比 · 总和 1" : "原始份数";
    weights.write(
      ATTENTION.mass.map((x, i) => [
        f.phase === 0 || (f.phase === 1 && i > row) ? "" : f.phase >= 2 ? (i % 2 ? "3/16" : "1/16") : x,
      ]),
      { focus: f.phase === 1 || f.phase === 3 ? row : undefined },
    );
    total.write([[f.phase >= 2 ? ATTENTION_TOTAL : ""]]);
    const rowLocal = f.local * 8 - row;
    const weighted = ATTENTION.values[row]!.map((x) => (x * ATTENTION.mass[row]!) / ATTENTION_TOTAL);
    incoming.group.visible = f.phase === 3;
    incoming.title.textContent = "当前行 × 占比";
    incoming.write([f.phase === 3 && rowLocal >= 0.2 ? weighted : ["", "", "", ""]]);
    sumIntake.group.visible = f.phase === 3;
    sumIntake.write([rowLocal >= 0.65 ? weighted : ["", "", "", ""]]);
    const arrived = rowLocal >= 0.78;
    const written = f.phase > 3 ? 8 : f.phase === 3 ? row + Number(arrived) : 0;
    k.compute(0, f.phase === 1 || (f.phase === 3 && written < 8));
    const sum = Array.from({ length: 4 }, (_, c) =>
      ATTENTION.values
        .slice(0, written)
        .reduce((s, v, i) => s + (v[c]! * ATTENTION.mass[i]!) / ATTENTION_TOTAL, 0),
    );
    out.write([written ? sum : ["", "", "", ""]], {
      focusCell: written === 8 ? focusChannel : undefined,
    });
    contribution(
      incoming.group.position.clone(),
      sumIntake.group.position.clone(),
      span(rowLocal, 0.3, 0.65),
      f.phase === 3 && rowLocal >= 0.3,
      [weighted],
    );
    readLine.visible = f.phase === 3 && rowLocal < 0.3;
    readBead.visible = f.phase === 3 && rowLocal > 0 && rowLocal < 0.2;
    if (f.phase === 3) {
      const path = epTransferPath(vals.rowPoint(row, 1), incoming.group.position.clone(), 0.7);
      setWidePolylinePoints(readLine, path.getPoints(40));
      readBead.position.copy(path.getPoint(Math.min(1, rowLocal / 0.2)));
    }
    match.visible = f.phase === 1;
    // Selection rather than a flying Q copy: the query remains at its source.
    match.position.set(0, 0, 0);
    if (f.phase === 1) {
      const a = q.rowPoint(0),
        b = keys.rowPoint(row, 1);
      // A short corner remains outside the K grid.
      const points = [a, V(-3.25, a.y, 0.3), V(-3.25, b.y, 0.3), b];
      setWidePolylinePoints(match, points);
    }
    const oFull = numberText(ATTENTION_OUTPUT[focusChannel]!);
    equation.textContent = [
      "Q 找谁 · K 管匹配 · V 给内容",
      "Q·K ÷ √4 → exp → 非负份数",
      "总份数 Z = 8：0.5÷8 = 1/16；1.5÷8 = 3/16",
      written === 8
        ? `通道 ${focusChannel} 输出 = ${oFull} · 整表 O = [25, 15, 12.5, 7.5]（点击任一通道切换）`
        : "同列相加，得到一行四通道上下文",
    ][f.phase]!;
  };
  return step;
}

function cacheScene(k: InferenceKit) {
  // One spatial cache, above its native NPU: the expanded cells are the data itself.
  const positions = k.compactCache
    ? [V(1.8, 0.1, 3.7), V(-2.4, 0.1, -1.3), V(1.8, 0.1, -1.3)]
    : [V(0, 0.1, 2.1), V(-4.15, 0.1, -1.25), V(4.15, 0.1, -1.25)];
  const table = k.matrix(
    "这条请求的块表 · 记地址",
    [KV_BLOCKS.map((id) => `块 ${id}`)],
    V(k.compactCache ? -0.6 : -3.2, 3.6, -4.6),
    INK.gold,
    0.88,
    [],
    [1.8, 1.8, 1.8],
  );
  const r2 = k.matrix(
    "请求 B 的块表",
    [["块 7"]],
    V(k.compactCache ? 3 : 3.5, 3.6, -4.6),
    INK.violet,
    0.88,
    [],
    [1.8],
  );
  k.label("位置", V(-2.95, -1.45, 0.16), "row", table.group);
  const ranges = ["0–3", "4–7", "8–11"].map((range, i) =>
    k.label(range, V((i - 1) * 1.8, -1.45, 0.16), "status", table.group),
  );
  const groupPositions = [4, 5, 6, 7].map((position, i) => {
    const label = k.label(String(position), V((i - 1.5) * 0.48, -1.45, 0.16), "status", table.group);
    if (position === 6) {
      label.style.background = "#d4e7d1";
      label.style.borderBottom = "2px solid #44866c";
      label.style.padding = "1px 3px";
    }
    return label;
  });
  const sharedRange = k.label("位置 0–3", V(0, -1.45, 0.16), "status", r2.group);
  const row = k.matrix(
    "新数据 · 位置 6",
    [kvRow(6)],
    V(k.compactCache ? -2.4 : -3.5, 1.4, 5.9),
    INK.blue,
    0.76,
  );
  for (const m of [table, r2, row]) m.titlePoint.set(0, 1.9, 0.4);
  const pools = KV_BLOCKS.map((id, i) => {
    const m = k.matrix(
      `显存块 ${id}`,
      Array.from({ length: 4 }, (_, j) => kvRow(i * 4 + j)),
      positions[i]!,
      INK.blue,
      0.76,
      Array.from({ length: 4 }, (_, j) => String(i * 4 + j)),
    );
    m.titlePoint.set(0, 2.7, 0.55);
    return m;
  });
  for (const m of [table, r2, row, ...pools]) m.group.rotation.x = -Math.PI / 2;
  const floors = positions.map((point) =>
    k.box(point.clone().add(V(0, -0.28, 0)), V(3.35, 0.4, 3.45), "#d3ded1"),
  );
  const channelNames = ["K₀", "K₁", "V₀", "V₁"];
  const rowHeaders = channelNames.map((name, c) =>
    k.label(name, V((c - 1.5) * 0.76, 0.88, 0.16), "status", row.group),
  );
  const targetHeaders = channelNames.map((name, c) =>
    k.label(name, V((c - 1.5) * 0.76, 2.02, 0.16), "status", pools[1]!.group),
  );
  const positionHeader = k.label("位置", V(-1.7, 1.95, 0.16), "row", pools[1]!.group);
  k.label("同一张 NPU", k.compactCache ? V(0, -3.9, 5.8) : V(0, -4.1, 6.5), "hardware");
  const poolWidth = k.compactCache ? 4.6 : 6.1;
  const poolFront = k.compactCache ? 6 : 4.1;
  const poolCorners = [
    V(-poolWidth, -0.5, -3.2),
    V(poolWidth, -0.5, -3.2),
    V(poolWidth, -0.5, poolFront),
    V(-poolWidth, -0.5, poolFront),
  ];
  const poolFloor = k.box(
    V(0, -0.55, (poolFront - 3.2) / 2),
    V(poolWidth * 2, 0.08, poolFront + 3.2),
    "#cad6c5",
  );
  poolFloor.material.opacity = 0.14;
  poolFloor.material.depthWrite = false;
  const boundary = k.wire([...poolCorners, poolCorners[0]!], INK.green);
  boundary.material.linewidth = 1.4;
  boundary.material.opacity = 0.5;
  k.label("显存中的缓存池 · 放大示意", V(0, -0.45, poolFront + 0.4), "name");
  // Expansion posts terminate on the same pool boundary that encloses all three blocks.
  poolCorners.forEach((corner) => {
    k.wire([V(Math.sign(corner.x) * 3, -2.65, Math.sign(corner.z) * 2.2), corner], INK.green, true);
  });
  k.root.updateMatrixWorld(true);
  const mapPath = (from: ReturnType<typeof V>, to: ReturnType<typeof V>, side: number) =>
    new T.CubicBezierCurve3(
      from,
      from.clone().add(V(side * 0.6, 1.4, 0.4)),
      to.clone().add(V(side * 0.5, 1.8, -0.6)),
      to,
    );
  // Sharing adds one reference to the existing block, never a second copy of its data.
  const referenceRail = k.compactCache ? -4.1 : -6.4;
  const originalPath = new T.CatmullRomCurve3([
    table.cells[0]!.getWorldPosition(V(0, 0)).add(V(0, 0.2, 0)),
    V(referenceRail, 3.8, -4.6),
    V(referenceRail, 1.2, 2.8),
    pools[0]!.rowPoint(3, -1),
  ]);
  const original = k.wire(originalPath.getPoints(40), INK.gold, true);
  const referencePath = k.compactCache
    ? new T.CatmullRomCurve3([
        r2.rowPoint(0, 1),
        V(4.1, 3.8, -3.5),
        V(4.1, 1.2, 2.8),
        pools[0]!.rowPoint(3, 1),
      ])
    : mapPath(r2.rowPoint(0, -1), pools[0]!.rowPoint(0, 1), 1);
  const shared = k.wire(referencePath.getPoints(40), INK.violet, true);
  const addressPath = new T.CubicBezierCurve3(
    row.group.localToWorld(V(-1.65, 0, 0.3)),
    V(k.compactCache ? -4.5 : -7, 3.5, 4),
    V(k.compactCache ? -4.5 : -7, 5, -4.6),
    table.cells[1]!.getWorldPosition(V(0, 0)).add(V(0, 0.2, 0)),
  );
  const toBlock = mapPath(table.cells[1]!.getWorldPosition(V(0, 0)), pools[1]!.rowPoint(0, 1), 0);
  const lookupPath = {
    getPoint: (t: number) =>
      t < 0.5
        ? toBlock.getPoint(t * 2)
        : pools[1]!.rowPoint(0, 1).lerp(pools[1]!.rowPoint(2, 1), (t - 0.5) * 2),
  };
  const lookupLine = k.wire(addressPath.getPoints(40), INK.gold);
  const probe = k.box(V(0, 0), V(0.24, 0.24, 0.24), INK.green);
  const target = pools[1]!.group.localToWorld(V(0, -0.38, 0));
  const source = row.group.position.clone();
  const delivery = new T.CubicBezierCurve3(
    source,
    source.clone().add(V(0, -1.3, -1)),
    target.clone().add(V(0, 0, 3.5)),
    target,
  );
  const writeLine = k.wire(delivery.getPoints(56), INK.blue);
  const frameCorners = [
    V(-1.57, 0.37, 0.18),
    V(1.57, 0.37, 0.18),
    V(1.57, -0.37, 0.18),
    V(-1.57, -0.37, 0.18),
    V(-1.57, 0.37, 0.18),
  ];
  const receiver = k.wire(
    frameCorners.map((point) => pools[1]!.group.localToWorld(point.clone().add(V(0, -0.38, 0)))),
    INK.green,
  );
  pools[1]!.title.classList.add("status");
  const reveal = (path: { getPoint: (t: number) => T.Vector3 }, amount: number) =>
    Array.from({ length: 41 }, (_, i) => path.getPoint((i / 40) * Math.max(0.0001, amount)));
  return (p: number) => {
    const f = inferenceFrame(1, p),
      own = kvOwnership(p);
    const locating = f.phase === 1 && f.travel >= 0.5;
    const writing = f.phase === 2 && !f.landed;
    const wrote = f.phase > 2 || (f.phase === 2 && f.landed);
    const sharing = f.phase >= 3;
    const lookupRow = Math.max(0, (f.travel - 0.5) * 4);
    table.write([KV_BLOCKS.map((id) => `块 ${id}`)], {
      empty: !own.r1,
      focusCell: sharing ? undefined : 1,
    });
    table.title.textContent = sharing
      ? own.r1
        ? "请求 A 的块表"
        : "请求 A 已结束"
      : "这条请求的块表 · 记地址";
    const expandedRange = !sharing && (f.phase > 0 || f.landed);
    ranges[1]!.style.visibility = expandedRange ? "hidden" : "visible";
    groupPositions.forEach((label) => {
      label.style.visibility = expandedRange ? "visible" : "hidden";
    });
    r2.title.textContent = f.phase === 5 && f.landed ? "请求 B 已结束" : "请求 B 的块表";
    r2.write([[own.r2 ? "块 7" : ""]], { color: INK.violet });
    const arrival = f.phase === 3 ? span(f.local, 0.18, 0.38) : Number(sharing);
    r2.group.visible = arrival > 0;
    r2.cells.forEach((cell) => {
      cell.material.opacity *= arrival;
    });
    [r2.title, sharedRange, ...r2.numbers].forEach((label) => {
      label.style.opacity = String(arrival);
    });
    row.group.visible = f.phase < 2 || writing;
    row.group.position.copy(f.phase === 2 ? delivery.getPoint(f.travel) : source);
    row.title.textContent = writing ? "位置 6" : "新数据 · 位置 6";
    row.titlePoint.set(0, writing ? -1.35 : 2.4, writing ? 0.16 : 0.55);
    rowHeaders.forEach((h) => {
      h.style.visibility = f.phase < 2 ? "visible" : "hidden";
    });
    row.numbers.forEach((n) => {
      n.style.visibility = writing && f.travel > 0.72 ? "hidden" : "visible";
    });
    writeLine.visible = writing;
    receiver.visible = locating || f.phase === 2;
    setWidePolylinePoints(
      receiver,
      frameCorners.map((point) =>
        pools[1]!.group.localToWorld(
          point.clone().add(V(0, f.phase === 1 ? 1.14 - lookupRow * 0.76 : -0.38, 0)),
        ),
      ),
    );
    original.visible = sharing && own.r1;
    original.material.opacity = 0.9;
    original.material.linewidth = f.phase === 4 ? 3.2 : 2.4;
    setWidePolylinePoints(
      original,
      reveal(originalPath, f.phase === 3 ? span(f.local, 0, 0.25) : f.phase === 4 ? 1 - f.travel : 1),
    );
    probe.visible = f.phase < 2 && !f.landed;
    probe.material.color.set(f.phase === 0 ? INK.gold : INK.green);
    probe.position.copy((f.phase === 0 ? addressPath : lookupPath).getPoint(f.travel));
    lookupLine.visible = f.phase < 2;
    lookupLine.material.color.set(f.phase === 0 ? INK.gold : INK.green);
    lookupLine.material.linewidth = 3.2;
    setWidePolylinePoints(lookupLine, reveal(f.phase === 0 ? addressPath : lookupPath, f.travel));
    shared.visible = (f.phase === 3 && f.local > 0.25) || own.r2;
    shared.material.linewidth = f.phase === 3 || f.phase === 5 ? 3.2 : 2.4;
    shared.material.opacity = 0.9;
    setWidePolylinePoints(
      shared,
      reveal(referencePath, f.phase === 3 ? span(f.local, 0.25, 0.9) : f.phase === 5 ? 1 - f.travel : 1),
    );
    targetHeaders.forEach((label) => {
      label.style.visibility = wrote && !sharing ? "visible" : "hidden";
    });
    positionHeader.style.visibility = f.phase > 0 && !sharing ? "visible" : "hidden";
    pools.forEach((m, i) => {
      const values = Array.from({ length: 4 }, (_, j) =>
        i * 4 + j < (wrote ? 7 : 6) ? kvRow(i * 4 + j) : ["", "", "", ""],
      );
      m.write(values, {
        colors: Array.from({ length: 4 }, (_, j) => (i === 1 && j === 2 && wrote ? INK.blue : INK.green)),
        receivingCells: i === 1 && (locating || writing) ? [8, 9, 10, 11] : [],
      });
      m.names.forEach((label, j) => {
        label.style.visibility = i === 1 && f.phase > 0 && !sharing ? "visible" : "hidden";
        const selected = f.phase === 1 ? Math.round(lookupRow) === j : j === 2;
        label.style.fontWeight = selected ? "700" : "500";
        label.style.color = selected ? "#17211f" : "#626d68";
      });
      floors[i]!.material.color.set(own.refs[i] ? "#e5efe9" : "#efede5");
      const ownerText =
        own.refs[i] === 2
          ? "A、B 共用"
          : own.refs[i]
            ? `${i === 0 && own.r2 ? "B" : "A"} 在用`
            : "空闲 · 可再分配";
      m.title.textContent = `显存块 ${KV_BLOCKS[i]}${sharing ? `\n${ownerText}` : ""}`;
      m.title.style.whiteSpace = "pre";
    });
  };
}

function pdScene(k: InferenceKit) {
  const data = [
    Array.from({ length: 2 }, (_, j) => kvRow(j)),
    Array.from({ length: 2 }, (_, j) => kvRow(j + 2)),
  ];
  k.label("P · prefill 实例", V(-3.2, 6.75), "hardware");
  k.label("D · decode 实例", V(3.2, 6.75), "hardware");
  k.plane("源显存 · 传输期间保留", V(-4, -1.85, -0.35), V(6.3, 6.1, 0.16));
  k.plane("目的显存 · 先分配再接收", V(4, -1.85, -0.35), V(6.3, 6.1, 0.16));
  const sources = [7, 12].map((b, i) =>
    k.matrix(`P #${b}`, data[i]!, V(-4, i ? -3.2 : -0.5), INK.blue, 0.75, [`p${i * 2}`, `p${i * 2 + 1}`]),
  );
  const dests = [3, 5].map((b, i) => k.matrix(`D #${b}`, blank(2, 4), V(4, i ? -3.2 : -0.5), INK.blue, 0.75));
  dests.forEach((m, i) => {
    for (let r = 0; r < 2; r++) {
      const label = k.label(`p${i * 2 + r}`, V(m.width / 2 + 0.18, (0.5 - r) * 0.75, 0.3), "row", m.group);
      label.style.transform = "translate(0, -50%)";
    }
  });
  const packets = data.map((d) => k.transfer(d, INK.blue, 0.75));
  const ack = k.transfer([["完成"]], INK.green, 0.85);
  const sourceStatus = k.label("源块：保持占用", V(-4, -5.4), "status");
  const destStatus = k.label("目的块：尚未分配", V(4, -5.4), "status");
  const meaning = k.label("两边块号独立，内容按位置一一对应", V(0, -6.5), "equation");
  k.ownership(0, V(-4, 1.8), "P 的源缓存");
  k.ownership(1, V(4, 1.8), "D 的目的缓存");
  k.memory(0, sources);
  k.memory(1, dests);
  const deviceLink = k.hardwareTransfer();
  return (p: number) => {
    const f = inferenceFrame(2, p),
      state = pdStageStatus(p);
    deviceLink(
      f.phase === 4 ? 1 : 0,
      f.phase === 4 ? 0 : 1,
      f.travel,
      f.phase >= 2 && f.phase <= 4,
      f.phase === 4 ? INK.green : INK.blue,
    );
    k.compute(0, false);
    k.compute(1, state.recomputing || state.resumed, INK.green);
    sources.forEach((m, i) => {
      m.write(data[i]!, { color: state.released ? INK.muted : INK.blue });
    });
    dests.forEach((m, i) => {
      m.group.visible = state.allocated || f.phase === 1;
      m.write(state.received[i] ? data[i]! : blank(2, 4), {
        color: INK.blue,
        receivingCells: f.phase === 2 + i && !state.received[i] ? [0, 1, 2, 3, 4, 5, 6, 7] : [],
      });
    });
    packets.forEach((move, i) => {
      move(sources[i]!.group.position.clone(), dests[i]!.group.position.clone(), f.travel, f.phase === 2 + i);
    });
    ack(V(4, -4.65), V(-4, -4.65), f.travel, f.phase === 4);
    sourceStatus.textContent = state.released ? "源块：已归还" : "源块：保持占用";
    destStatus.textContent = state.resumed
      ? "p3 重算完成 · 继续 decode"
      : state.recomputing
        ? "正在重算末位 p3…"
        : state.queued
          ? "两块就绪 · 重新入队待调度"
          : state.received.every(Boolean)
            ? "两块已到达 · 发送确认"
            : state.allocated
              ? "块 3、5 已分配 · 等待历史"
              : f.phase === 1
                ? "正在申请块 3、5…"
                : "目的块：尚未分配";
    meaning.textContent =
      f.phase === 4
        ? "D → P 完成信号；到达后才释放源块"
        : f.phase === 5
          ? "D 使用本地副本，P 可以继续服务其他请求"
          : "P #7 → D #3；P #12 → D #5";
  };
}

function coreScene(k: InferenceKit, onSeek?: (p: number) => void) {
  // Enlarged real 910B NPU package as stage: 4 HBM rim pedestals + translucent etched AIC/AIV die zones over the real SoC.
  const deckTint = (pos: T.Vector3, size: T.Vector3, color: string, opacity: number) => {
    const m = k.box(pos, size, color);
    m.material.opacity = opacity;
    m.material.depthWrite = false;
    return m;
  };
  const hbmY = 1.48;
  const dieY = 0.14;
  const hbmZ = -4.35;
  for (const [cx, cw, tone] of [
    [-5.05, 2.05, INK.blue],
    [-1.8, 2.25, INK.gold],
    [1.8, 2.05, INK.green],
    [5.05, 2.05, INK.green],
  ] as const) {
    deckTint(V(cx, hbmY - 0.14, hbmZ), V(cw, 0.12, 2.15), "#fcfcfa", 0.72);
    const hw = cw / 2;
    const hd = 1.08;
    const rim = k.wire(
      [
        V(cx - hw, hbmY - 0.06, hbmZ - hd),
        V(cx + hw, hbmY - 0.06, hbmZ - hd),
        V(cx + hw, hbmY - 0.06, hbmZ + hd),
        V(cx - hw, hbmY - 0.06, hbmZ + hd),
        V(cx - hw, hbmY - 0.06, hbmZ - hd),
      ],
      tone,
    );
    rim.material.linewidth = 1.7;
    rim.material.opacity = 0.65;
  }
  // Connect each of the 4 GM tensor banks straight down to the 4 physical copper HBM stacks on the 910B interposer.
  for (const [gx, hx, hz, tone] of [
    [-5.05, -2.26, -1.03, INK.blue],
    [-1.8, -2.26, 1.36, INK.gold],
    [1.8, 2.26, -1.03, INK.green],
    [5.05, 2.26, 1.36, INK.green],
  ] as const) {
    const lead = k.wire([V(gx, hbmY - 0.18, hbmZ + 1.05), V(hx, -0.78, hz)], tone, true);
    lead.material.opacity = 0.6;
  }

  deckTint(V(-3.55, dieY, 1.65), V(5.9, 0.08, 6.0), "#f5f0e7", 0.34);
  deckTint(V(3.65, dieY, 1.65), V(5.4, 0.08, 6.0), "#e9f2ef", 0.34);
  const terraceRim = (center: T.Vector3, w: number, d: number, y: number, color = INK.green) => {
    const corners = [
      V(center.x - w / 2, y, center.z - d / 2),
      V(center.x + w / 2, y, center.z - d / 2),
      V(center.x + w / 2, y, center.z + d / 2),
      V(center.x - w / 2, y, center.z + d / 2),
    ];
    const line = k.wire([...corners, corners[0]!], color);
    line.material.linewidth = 1.8;
    line.material.opacity = 0.72;
  };
  terraceRim(V(-3.55, 0, 1.65), 5.9, 6.0, dieY + 0.06, INK.gold);
  terraceRim(V(3.65, 0, 1.65), 5.4, 6.0, dieY + 0.06, INK.green);
  const barrier = k.wire([V(0.18, dieY + 0.1, -1.3), V(0.18, dieY + 0.1, 4.6)], INK.violet, true);
  barrier.material.opacity = 0.65;

  k.label("核外 HBM（GM 全局内存 · 4 栈直连）", V(0, 2.68, -5.75), "region");
  k.label("AIC · 矩阵核", V(-5.75, dieY + 0.25, 4.78), "region");
  k.label("AIV · 向量核", V(5.65, dieY + 0.25, 4.78), "region");
  k.label(
    "昇腾 910B 分离架构裸片：AIC / AIV 无直通，中间结果须写回核外 GM 中转",
    V(0, -1.08, 7.05),
    "hardware",
  );

  const x = k.matrix("输入 x", CORE_X, V(-5.05, hbmY + 0.05, hbmZ), INK.blue, 0.68);
  const w = k.matrix("权重 W", CORE_W, V(-1.8, hbmY + 0.05, hbmZ), INK.gold, 0.76);
  const mid = k.matrix("GM 中间区", [CORE_PRODUCT], V(1.8, hbmY + 0.05, hbmZ), INK.green, 0.68);
  const out = k.matrix("GM 输出", [CORE_OUTPUT], V(5.05, hbmY + 0.05, hbmZ), INK.green, 0.68);
  k.memory(0, [x, w, mid, out]);

  const l1x = k.matrix("L1 · x", CORE_X, V(-5.15, dieY + 0.16, -0.55), INK.blue, 0.64);
  const l1w = k.matrix("L1 · W", CORE_W, V(-2.3, dieY + 0.16, -0.55), INK.gold, 0.72);
  const a = k.matrix("L0A", CORE_X, V(-5.15, dieY + 0.16, 1.25), INK.blue, 0.64);
  const b = k.matrix("L0B", CORE_W, V(-2.3, dieY + 0.16, 1.25), INK.gold, 0.72);
  const c = k.matrix("L0C", [CORE_PRODUCT], V(-3.65, dieY + 0.16, 4.02), INK.green, 0.68);

  const ub = k.matrix("UB · 计算前", [CORE_PRODUCT], V(3.75, dieY + 0.16, -0.05), INK.green, 0.7);
  const activated = k.matrix("UB · 激活后", [CORE_OUTPUT], V(3.75, dieY + 0.16, 4.02), INK.green, 0.7);

  for (const m of [x, w, mid, out, l1x, l1w, a, b, c, ub, activated]) {
    m.group.rotation.x = -Math.PI / 2;
  }
  for (const m of [x, mid, out]) m.titlePoint.set(0, 0.88, 0.28);
  w.titlePoint.set(0, 1.22, 0.28);
  l1x.titlePoint.set(0, 0.82, 0.26);
  l1w.titlePoint.set(0, 1.15, 0.26);
  a.titlePoint.set(-0.88, 0, 0.26);
  a.title.classList.replace("name", "row");
  b.titlePoint.set(-0.98, 0, 0.26);
  b.title.classList.replace("name", "row");
  ub.titlePoint.set(0, 0.88, 0.26);
  c.titlePoint.set(-1.35, 0, 0.26);
  c.title.classList.replace("name", "row");
  activated.titlePoint.set(-1.52, 0, 0.26);
  activated.title.classList.replace("name", "row");

  // Volumetric 3D Cube MAC Array on AIC silicon die.
  const cubeBase = k.box(V(-3.55, dieY + 0.24, 2.66), V(2.7, 0.32, 0.82), "#7d6643");
  const cubeCap = k.box(V(-3.55, dieY + 0.44, 2.66), V(2.25, 0.14, 0.62), INK.gold);
  const cubeNodes = [
    k.box(V(-4.1, dieY + 0.62, 2.5), V(0.42, 0.26, 0.22), INK.blue),
    k.box(V(-4.1, dieY + 0.62, 2.82), V(0.42, 0.26, 0.22), INK.gold),
    k.box(V(-3.0, dieY + 0.62, 2.5), V(0.42, 0.26, 0.22), INK.blue),
    k.box(V(-3.0, dieY + 0.62, 2.82), V(0.42, 0.26, 0.22), INK.gold),
  ];
  k.label("Cube · 矩阵乘加", V(0, 1.05, 0.08), "unit", cubeBase);

  // FixPipe transceiver on the inter-core isolation seam, routing L0C out to HBM.
  const fixpipeBridge = k.box(V(0.35, dieY + 0.42, 1.92), V(0.54, 0.26, 1.35), INK.green);
  fixpipeBridge.material.opacity = 0.92;
  k.label("Fixpipe", V(0.35, dieY + 0.96, 1.92), "name");

  // Volumetric 3D Vector ReLU Gate on AIV silicon die.
  const vectorBase = k.box(V(3.75, dieY + 0.24, 1.98), V(2.75, 0.32, 0.88), INK.blue);
  const reluGateBar = k.box(V(3.75, dieY + 0.44, 1.98), V(2.35, 0.09, 0.18), "#edf2f5");
  const vectorLanes = [
    k.box(V(3.22, dieY + 0.58, 1.98), V(0.56, 0.34, 0.44), INK.green),
    k.box(V(4.28, dieY + 0.58, 1.98), V(0.56, 0.34, 0.44), INK.gold),
  ];
  k.label("Vector · ReLU", V(0, 1.05, 0.08), "unit", vectorBase);

  if (onSeek) {
    const jump = (stage: number) => () => onSeek((stage + 0.72) / 8);
    k.pick(x.group, () => onSeek(0.05 / 8));
    k.pick(w.group, () => onSeek(0.05 / 8));
    k.pick(l1x.group, jump(1));
    k.pick(l1w.group, jump(1));
    k.pick(a.group, jump(2));
    k.pick(b.group, jump(2));
    k.pick(cubeBase, jump(3));
    k.pick(c.group, jump(3));
    k.pick(fixpipeBridge, jump(4));
    k.pick(mid.group, jump(4));
    k.pick(ub.group, jump(5));
    k.pick(vectorBase, jump(6));
    k.pick(activated.group, jump(6));
    k.pick(out.group, jump(7));
  }

  // Structural feed conduits on each silicon core zone.
  const toCube = [
    k.wire([V(-5.15, dieY + 0.24, 1.6), V(-5.15, dieY + 0.28, 2.66), V(-4.7, dieY + 0.28, 2.66)], INK.blue),
    k.wire([V(-2.3, dieY + 0.24, 2.0), V(-2.3, dieY + 0.28, 2.66), V(-2.6, dieY + 0.28, 2.66)], INK.gold),
    k.wire([V(-3.65, dieY + 0.26, 3.12), V(-3.65, dieY + 0.24, 3.65)], INK.green),
  ];
  const vectorFeed = [
    k.wire([V(3.75, dieY + 0.24, 0.35), V(3.75, dieY + 0.28, 1.48)], INK.green),
    k.wire([V(3.75, dieY + 0.28, 2.48), V(3.75, dieY + 0.24, 3.62)], INK.green),
  ];

  // Curved 3D Bezier trajectories between off-chip HBM (GM) and on-die AIC / AIV buffers.
  const arc3D = (from: T.Vector3, to: T.Vector3, lift = 1.15, sideX = 0) =>
    new T.CubicBezierCurve3(
      from,
      V(from.x + sideX * 0.35, Math.max(from.y, to.y) + lift, from.z + (to.z - from.z) * 0.28),
      V(to.x + sideX * 0.35, Math.max(from.y, to.y) + lift, from.z + (to.z - from.z) * 0.72),
      to,
    );
  const gmScanCurve = new T.LineCurve3(V(-5.8, hbmY + 0.28, hbmZ), V(-0.9, hbmY + 0.28, hbmZ));
  const routeXToL1 = arc3D(V(-5.05, hbmY + 0.16, hbmZ), V(-5.15, dieY + 0.26, -0.55), 0.9);
  const routeWToL1 = arc3D(V(-1.8, hbmY + 0.16, hbmZ), V(-2.3, dieY + 0.26, -0.55), 0.9);
  const routeL1ToA = arc3D(V(-5.15, dieY + 0.26, -0.55), V(-5.15, dieY + 0.26, 1.25), 0.65);
  const routeL1ToB = arc3D(V(-2.3, dieY + 0.26, -0.55), V(-2.3, dieY + 0.26, 1.25), 0.65);
  const routeFixpipe = new T.CatmullRomCurve3([
    V(-3.65, dieY + 0.28, 4.02),
    V(-0.75, dieY + 0.62, 3.15),
    V(0.35, dieY + 0.78, 1.92),
    V(0.95, 1.35, -1.25),
    V(1.8, hbmY + 0.16, hbmZ),
  ]);
  const routeMidToUb = arc3D(V(1.8, hbmY + 0.16, hbmZ), V(3.75, dieY + 0.26, -0.05), 1.0);
  const routeVectorIn = arc3D(V(3.75, dieY + 0.26, -0.05), V(3.75, dieY + 0.52, 1.98), 0.45);
  const routeVectorOut = arc3D(V(3.75, dieY + 0.52, 1.98), V(3.75, dieY + 0.26, 4.02), 0.45);
  const routeWriteback = new T.CatmullRomCurve3([
    V(3.75, dieY + 0.28, 4.02),
    V(5.8, 0.95, 2.35),
    V(5.95, 1.75, -1.1),
    V(5.05, hbmY + 0.16, hbmZ),
  ]);

  const completedRoutes = [
    k.wire(routeXToL1.getPoints(32), INK.blue, true),
    k.wire(routeWToL1.getPoints(32), INK.gold, true),
    k.wire(routeFixpipe.getPoints(40), INK.green, true),
    k.wire(routeMidToUb.getPoints(32), INK.green, true),
    k.wire(routeWriteback.getPoints(40), INK.green, true),
  ];

  // Sculpted horizontal 3D tile carriers (numeric labels appear only upon landing in target slots).
  const makeCarrier = (rows: number, cols: number, pitch: number, color: string) => {
    const group = new T.Group();
    k.root.add(group);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        k.box(
          V((col - (cols - 1) / 2) * pitch, 0, (r - (rows - 1) / 2) * pitch),
          V(pitch * 0.86, 0.24, pitch * 0.82),
          color,
          group,
        );
      }
    }
    const bus = k.wire([V(0, 0, 0), V(0, 0, 0)], color);
    return { group, bus };
  };
  const carrierX = makeCarrier(1, 2, 0.62, INK.blue);
  const carrierW = makeCarrier(2, 2, 0.56, INK.gold);
  const carrierVec = makeCarrier(1, 2, 0.68, INK.green);
  const gmScanner = k.box(V(-5.05, hbmY + 0.28, hbmZ), V(0.32, 0.14, 1.28), INK.blue);
  gmScanner.material.opacity = 0.55;

  // Pre-arrival 3D receiver frames around destination buffers.
  const makeReceiverFrame = (
    targetMatrix: ReturnType<InferenceKit["matrix"]>,
    pad = 0.1,
    color = INK.green,
  ) => {
    const hw = targetMatrix.width / 2 + pad;
    const hd = targetMatrix.height / 2 + pad;
    const pos = targetMatrix.group.position;
    const pts = [
      V(pos.x - hw, pos.y + 0.16, pos.z - hd),
      V(pos.x + hw, pos.y + 0.16, pos.z - hd),
      V(pos.x + hw, pos.y + 0.16, pos.z + hd),
      V(pos.x - hw, pos.y + 0.16, pos.z + hd),
      V(pos.x - hw, pos.y + 0.16, pos.z - hd),
    ];
    const frame = k.wire(pts, color);
    frame.material.linewidth = 2.4;
    return frame;
  };
  const receivers = {
    l1x: makeReceiverFrame(l1x, 0.1, INK.blue),
    l1w: makeReceiverFrame(l1w, 0.1, INK.gold),
    a: makeReceiverFrame(a, 0.1, INK.blue),
    b: makeReceiverFrame(b, 0.1, INK.gold),
    c: makeReceiverFrame(c, 0.1, INK.green),
    mid: makeReceiverFrame(mid, 0.1, INK.green),
    ub: makeReceiverFrame(ub, 0.1, INK.green),
    activated: makeReceiverFrame(activated, 0.1, INK.green),
    out: makeReceiverFrame(out, 0.1, INK.green),
  };

  const reveal = (curve: { getPoint: (t: number) => T.Vector3 }, amount: number) =>
    Array.from({ length: 37 }, (_, i) => curve.getPoint((i / 36) * Math.max(0.001, amount)));
  const equation = k.label(
    "输入和权重常驻核外 HBM，片上缓冲接住当前分块",
    V(0, dieY + 0.12, 5.75),
    "equation",
  );

  return (p: number) => {
    const f = inferenceFrame(3, p);
    k.compute(0, f.phase === 3 || f.phase === 6, f.phase === 3 ? INK.gold : INK.blue);
    const done = (phase: number) => f.phase > phase || (f.phase === phase && f.landed);

    completedRoutes[0]!.visible = f.phase > 1;
    completedRoutes[1]!.visible = f.phase > 1;
    completedRoutes[2]!.visible = f.phase > 4;
    completedRoutes[3]!.visible = f.phase > 5;
    completedRoutes[4]!.visible = f.phase === 7 && f.landed;
    completedRoutes.forEach((route) => {
      route.material.opacity = 0.34;
    });

    gmScanner.visible = f.phase === 0;
    gmScanner.position.copy(gmScanCurve.getPoint(span(f.local, 0.05, 0.88)));

    l1x.write(CORE_X, { empty: !done(1) });
    l1w.write(CORE_W, { empty: !done(1) });
    a.write(CORE_X, { empty: !done(2) });
    b.write(CORE_W, {
      empty: !done(2),
      focusCell: f.phase === 3 ? (f.local < 0.45 ? 0 : 1) : undefined,
    });
    c.write([
      CORE_PRODUCT.map((value, i) =>
        f.phase > 3 || (f.phase === 3 && f.local >= (i ? 0.82 : 0.4)) ? value : "",
      ),
    ]);
    mid.write([CORE_PRODUCT], { empty: !done(4) });
    ub.write([CORE_PRODUCT], { empty: !done(5) });
    activated.write([CORE_OUTPUT], { empty: !done(6) });
    out.write([CORE_OUTPUT], { empty: !done(7) });

    // Pre-arrival receiver highlights announce destination slots before values write in.
    receivers.l1x.visible = f.phase === 1 && !f.landed;
    receivers.l1w.visible = f.phase === 1 && !f.landed;
    receivers.a.visible = f.phase === 2 && !f.landed;
    receivers.b.visible = f.phase === 2 && !f.landed;
    receivers.c.visible = f.phase === 3 && f.local < 0.82;
    receivers.mid.visible = f.phase === 4 && !f.landed;
    receivers.ub.visible = f.phase === 5 && !f.landed;
    receivers.activated.visible = f.phase === 6 && !f.landed;
    receivers.out.visible = f.phase === 7 && !f.landed;

    // Volumetric Cube MAC column-by-column animation in Phase 3.
    const cubeCol0Pulse = f.phase === 3 ? Math.sin(span(f.local, 0.02, 0.42) * Math.PI) : 0;
    const cubeCol1Pulse = f.phase === 3 ? Math.sin(span(f.local, 0.44, 0.84) * Math.PI) : 0;
    cubeBase.material.emissive.set(f.phase === 3 ? "#5a3d10" : "#000000");
    cubeCap.material.emissive.set(f.phase === 3 ? "#6b4b13" : "#000000");
    cubeNodes.forEach((node, idx) => {
      const pulse = idx < 2 ? cubeCol0Pulse : cubeCol1Pulse;
      node.scale.y = 0.24 + pulse * 0.42;
      node.position.y = dieY + 0.6 + pulse * 0.21;
      node.material.emissive.set(pulse > 0.08 ? "#664914" : "#000000");
    });

    // Volumetric Vector ReLU per-lane clamping animation in Phase 6 ([5, -5] → [5, 0]).
    const reluClamp = f.phase === 6 ? span(f.local, 0.15, 0.65) : f.phase > 6 ? 1 : 0;
    vectorBase.material.emissive.set(f.phase === 6 ? "#1e3746" : "#000000");
    reluGateBar.material.emissive.set(f.phase === 6 ? "#4d6778" : "#000000");
    const posHeight = f.phase >= 6 ? 0.46 : 0.24;
    const negHeight = f.phase === 6 ? 0.42 * (1 - reluClamp) + 0.06 : f.phase > 6 ? 0.06 : 0.24;
    vectorLanes[0]!.scale.y = posHeight;
    vectorLanes[0]!.position.y = dieY + 0.4 + posHeight / 2;
    vectorLanes[1]!.scale.y = negHeight;
    vectorLanes[1]!.position.y = dieY + 0.4 + negHeight / 2;
    vectorLanes[1]!.material.color.set(reluClamp > 0.6 ? INK.muted : INK.gold);

    toCube.forEach((l) => {
      l.material.opacity = f.phase === 3 ? 0.95 : 0.24;
    });
    vectorFeed.forEach((l) => {
      l.material.opacity = f.phase === 6 ? 0.95 : 0.24;
    });
    fixpipeBridge.material.emissive.set(f.phase === 4 ? "#1f543d" : "#000000");

    const driveCarrier = (
      carrier: ReturnType<typeof makeCarrier>,
      curve: { getPoint: (t: number) => T.Vector3 },
      progress: number,
      active: boolean,
    ) => {
      carrier.group.visible = active && progress > 0 && progress < 1;
      carrier.bus.visible = active;
      if (!active) return;
      carrier.group.position.copy(curve.getPoint(progress));
      setWidePolylinePoints(carrier.bus, reveal(curve, progress));
      carrier.bus.material.opacity = progress >= 1 ? 0.35 : 0.92;
    };

    driveCarrier(carrierX, f.phase === 1 ? routeXToL1 : routeL1ToA, f.travel, f.phase === 1 || f.phase === 2);
    driveCarrier(carrierW, f.phase === 1 ? routeWToL1 : routeL1ToB, f.travel, f.phase === 1 || f.phase === 2);

    const vecCurve =
      f.phase === 4
        ? routeFixpipe
        : f.phase === 5
          ? routeMidToUb
          : f.phase === 6
            ? f.local < 0.35
              ? routeVectorIn
              : routeVectorOut
            : routeWriteback;
    const vecTravel =
      f.phase === 6 ? (f.local < 0.35 ? span(f.local, 0.04, 0.34) : span(f.local, 0.36, 0.65)) : f.travel;
    driveCarrier(carrierVec, vecCurve, vecTravel, f.phase >= 4);

    equation.textContent =
      f.phase === 3
        ? f.local < 0.55
          ? "输出通道 0：1×1 + 2×2 = 5"
          : "输出通道 1：1×(−1) + 2×(−2) = −5"
        : f.phase === 6
          ? "逐通道 ReLU：[5,−5] → [5,0]"
          : f.phase === 7 && f.landed
            ? "GM 最终输出 [5,0]；输入和权重仍保留"
            : "搬入 → 到达 → 计算 → 交接 → 写回";
  };
}

export async function mountInferenceScene(
  host: HTMLDivElement,
  kind: number,
  signal: AbortSignal,
  onSeek?: (p: number) => void,
) {
  const kit = await inferenceSceneKit(host, kind, signal);
  if (!kit) return null;
  const update = kind === 3 ? coreScene(kit, onSeek) : [attentionScene, cacheScene, pdScene][kind]!(kit);
  const animate = (p: number) => {
    update(p);
    const frame = inferenceFrame(kind, p);
    host.dataset.phase = String(frame.phase);
    host.dataset.progress = p.toFixed(4);
    host.dataset.result =
      kind === 1 && (frame.phase > 2 || (frame.phase === 2 && frame.landed))
        ? `slot=10;refs=${kvOwnership(p).refs.join(",")}`
        : p === 1
          ? [ATTENTION_OUTPUT.join(","), "slot=10;refs=0,0,0", "P=released;D=ready", CORE_OUTPUT.join(",")][
              kind
            ]!
          : "pending";
    kit.render();
  };
  animate(0);
  return { update() {}, animate, reset: kit.reset, dispose: kit.dispose };
}
