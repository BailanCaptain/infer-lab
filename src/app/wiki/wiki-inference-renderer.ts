import * as T from "three";
import { INK, type InferenceKit, inferenceSceneKit, V, type Values } from "./inference-scene-kit";
import { span } from "./scene-easing";
import {
  ATTENTION,
  ATTENTION_GROUPS,
  ATTENTION_OUTPUT,
  ATTENTION_TOTAL,
  attentionMerge,
  attentionSum,
  CORE_OUTPUT,
  CORE_PRODUCT,
  CORE_W,
  CORE_X,
  inferenceFrame,
  KV_BLOCKS,
  kvOwnership,
  kvRow,
  pdHandoff,
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
  const splitK = ATTENTION.keys.map((r, i) =>
    k.matrix("", [r], keys.rowPoint(i), INK.gold, 0.58, [`位置${i}`], [1.16, 0.58, 0.58, 0.58]),
  );
  const splitV = ATTENTION.values.map((r, i) => k.matrix("", [r], vals.rowPoint(i), INK.blue, 0.58));
  const splitTitles = [
    k.label("卡 0 · K 与 V", V(-3.8, 1.8), "name"),
    k.label("卡 1 · K 与 V", V(3.8, 1.8), "name"),
  ];
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
  const out = k.matrix("完整计算 O · 保留对照", [ATTENTION_OUTPUT], V(-3.8, -6.8), INK.green, 1.05);
  out.titlePoint.y = -0.75;
  const mergedOut = k.matrix("卡 0 合并结果 O · 4 通道", blank(1, 4), V(3.8, -6.8), INK.green, 1.05);
  mergedOut.titlePoint.y = -0.75;
  const incoming = k.matrix("卡 0 接收 · 待合并", blank(1, 4), V(3.8, -5.2), INK.green, 1.05);
  incoming.titlePoint.set(0, -0.75, 0.3);
  const sumIntake = k.matrix("本行已到达", blank(1, 4), V(-3.8, -5.2), INK.green, 1.05);
  sumIntake.titlePoint.set(0, -0.75, 0.3);
  const local = [0, 1].map((i) =>
    k.matrix(
      `卡 ${i} 的局部平均`,
      [attentionSum(ATTENTION_GROUPS[i]!, true)],
      V(i ? 3.8 : -3.8, -3.75),
      i ? INK.gold : INK.blue,
      1.05,
    ),
  );
  const shares = [0, 1].map((i) =>
    k.label(i ? "6 / 8" : "2 / 8", V(i ? 3.8 : -3.8, -4.55), "fraction", local[i]!.group.parent!),
  );
  const equation = k.label("同一位置的 K、V 在同一行", V(0, -8.6), "equation");
  const contribution = k.transfer([ATTENTION_OUTPUT], INK.green, 1.05);
  const readLine = k.wire([V(0, 0), V(0, 0)], INK.green);
  const readBead = k.box(V(0, 0), V(0.15, 0.15, 0.15), INK.green);
  const merges = [
    k.transfer([ATTENTION_OUTPUT], INK.blue, 1.05),
    k.transfer([ATTENTION_OUTPUT], INK.gold, 1.05),
  ];
  const match = k.wire([V(0, 0), V(0, 0)], INK.gold);
  const overview = k.label("完整逻辑视图 · 历史仍归两卡", V(0, 8.15), "region");
  const owners = [k.ownership(0, V(-3.8, 2.2), "卡 0"), k.ownership(1, V(3.8, 2.2), "卡 1")];
  const queryMeaning = k.label("同一个 Q · 分别查询两块历史", V(0, 1.65), "status");
  const deviceLink = k.hardwareTransfer();
  k.memory(0, [
    { source: keys, rows: ATTENTION_GROUPS[0]! },
    { source: vals, rows: ATTENTION_GROUPS[0]! },
    q,
    mergedOut,
  ]);
  k.memory(1, [
    { source: keys, rows: ATTENTION_GROUPS[1]! },
    { source: vals, rows: ATTENTION_GROUPS[1]! },
    q,
  ]);
  return (p: number) => {
    const f = inferenceFrame(0, p),
      split = f.phase >= 4;
    const merge = attentionMerge(p);
    const receiving = f.local < 0.5 ? 0 : 1;
    q.group.position.lerpVectors(V(-1.4, 2), V(0, 2.75), f.phase < 4 ? 0 : f.phase > 4 ? 1 : f.travel);
    queryMeaning.style.visibility = split && (f.phase > 4 || f.landed) ? "visible" : "hidden";
    deviceLink(1, 0, merge.travels[1]!, merge.enabled && f.local >= 0.5 && merge.added < 2, INK.gold);
    k.compute(0, merge.enabled && merge.added < 2);
    k.compute(1, false);
    const row = Math.min(7, Math.floor(f.local * 8));
    keys.group.visible = vals.group.visible = weights.group.visible = total.group.visible = !split;
    overview.textContent = split ? "两卡布局对照 · 同一查询与结果" : "完整逻辑视图 · 历史仍归两卡";
    owners.forEach((o) => {
      o.line.visible = split;
      o.caption.style.visibility = "visible";
    });
    splitTitles.forEach((title) => {
      title.style.visibility = split && (f.phase > 4 || f.landed) ? "visible" : "hidden";
    });
    for (let i = 0; i < 8; i++) {
      const t = f.phase > 4 ? 1 : f.travel,
        card = i % 2,
        r = Math.floor(i / 2);
      const destK = V(card ? 1.9 : -5.7, 0.75 - r * 0.65);
      const destV = V(card ? 5.3 : -2.3, 0.75 - r * 0.65);
      const fromK = keys.rowPoint(i),
        fromV = vals.rowPoint(i);
      const horizontal = span(t, 0, 0.5),
        vertical = span(t, 0.5, 1);
      splitK[i]!.group.visible = splitV[i]!.group.visible = split;
      splitK[i]!.group.position.set(
        fromK.x + (destK.x - fromK.x) * horizontal,
        fromK.y + (destK.y - fromK.y) * vertical,
        fromK.z,
      );
      splitV[i]!.group.position.set(
        fromV.x + (destV.x - fromV.x) * horizontal,
        fromV.y + (destV.y - fromV.y) * vertical,
        fromV.z,
      );
      splitK[i]!.names[0]!.style.visibility = "visible";
      splitV[i]!.write([ATTENTION.values[i]!], { color: INK.blue });
    }
    local.forEach((m, i) => {
      m.group.visible = split && (f.phase > 4 || f.settled);
      shares[i]!.style.visibility = m.group.visible && !merge.enabled ? "visible" : "hidden";
    });
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
    incoming.write([
      f.phase === 3 && rowLocal >= 0.2
        ? weighted
        : merge.enabled && merge.travels[receiving] === 1 && merge.added === receiving
          ? attentionSum(ATTENTION_GROUPS[receiving]!).map((x) => x / ATTENTION_TOTAL)
          : ["", "", "", ""],
    ]);
    incoming.title.textContent = f.phase === 3 ? "当前行 × 占比" : "卡 0 接收 · 待合并";
    sumIntake.group.visible = f.phase === 3;
    sumIntake.write([rowLocal >= 0.65 ? weighted : ["", "", "", ""]]);
    const arrived = rowLocal >= 0.78;
    const written = f.phase > 3 ? 8 : f.phase === 3 ? row + Number(arrived) : 0;
    const sum = Array.from({ length: 4 }, (_, c) =>
      ATTENTION.values
        .slice(0, written)
        .reduce((s, v, i) => s + (v[c]! * ATTENTION.mass[i]!) / ATTENTION_TOTAL, 0),
    );
    out.write([written ? sum : ["", "", "", ""]]);
    mergedOut.write([
      f.phase === 5
        ? merge.added === 2
          ? ATTENTION_OUTPUT
          : merge.added === 1
            ? attentionSum(ATTENTION_GROUPS[0]!).map((x) => x / ATTENTION_TOTAL)
            : ["", "", "", ""]
        : ["", "", "", ""],
    ]);
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
    for (let i = 0; i < 2; i++) {
      const group = ATTENTION_GROUPS[i]!,
        z = group.reduce((s, j) => s + ATTENTION.mass[j]!, 0);
      local[i]!.write([
        f.phase === 5 && f.local >= (i ? 0.5 : 0.15)
          ? attentionSum(group).map((x) => x / ATTENTION_TOTAL)
          : attentionSum(group, true),
      ]);
      local[i]!.title.textContent =
        f.phase === 5 && f.local >= (i ? 0.5 : 0.15) ? `卡 ${i} · 已乘 ${z}/8` : `卡 ${i} · 平均值`;
      merges[i]!(
        local[i]!.group.position.clone(),
        incoming.group.position.clone(),
        merge.travels[i]!,
        f.phase === 5 && f.local >= (i ? 0.5 : 0.15) && merge.added <= i,
        [attentionSum(group).map((x) => x / ATTENTION_TOTAL)],
      );
    }
    equation.textContent = [
      "Q 找谁 · K 管匹配 · V 给内容",
      "Q·K ÷ √4 → exp → 非负份数",
      "总份数 8：0.5÷8 = 1/16；1.5÷8 = 3/16",
      "同列相加，得到一行上下文",
      "卡 0：内容和 20 ÷ 份数 2 = 10；卡 1：180 ÷ 6 = 30",
      f.settled ? "10×2/8 + 30×6/8 = 25   ✓ 与不切分相同" : "先乘各块份额，再按通道相加",
    ][f.phase]!;
  };
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
  channelNames.forEach((name, c) => {
    k.label(name, V((c - 1.5) * 0.76, 0.78, 0.16), "status", row.group);
  });
  const targetHeaders = channelNames.map((name, c) =>
    k.label(name, V((c - 1.5) * 0.76, 1.95, 0.16), "status", pools[1]!.group),
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
        colors: Array.from({ length: 4 }, (_, j) => (i === 1 && j === 2 && wrote ? INK.blue : "#527966")),
      });
      m.names.forEach((label, j) => {
        label.style.visibility = i === 1 && f.phase > 0 && !sharing ? "visible" : "hidden";
        const selected = f.phase === 1 ? Math.round(lookupRow) === j : j === 2;
        label.style.fontWeight = selected ? "700" : "400";
        label.style.color = selected ? "#254d3b" : "#6e8073";
      });
      floors[i]!.material.color.set(own.refs[i] ? "#c3d3bf" : "#e3e7dc");
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
  k.label("P · prefill 实例", V(-3.2, 6.2), "hardware");
  k.label("D · decode 实例", V(3.2, 6.2), "hardware");
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
      state = pdHandoff(p);
    deviceLink(
      f.phase === 4 ? 1 : 0,
      f.phase === 4 ? 0 : 1,
      f.travel,
      f.phase >= 2 && f.phase <= 4,
      f.phase === 4 ? INK.green : INK.blue,
    );
    k.compute(0, false);
    k.compute(1, f.phase === 5, INK.green);
    sources.forEach((m, i) => {
      m.write(data[i]!, { color: state.released ? INK.muted : INK.blue });
    });
    dests.forEach((m, i) => {
      m.group.visible = state.allocated || f.phase === 1;
      m.write(state.received[i] ? data[i]! : blank(2, 4));
    });
    packets.forEach((move, i) => {
      move(sources[i]!.group.position.clone(), dests[i]!.group.position.clone(), f.travel, f.phase === 2 + i);
    });
    ack(V(4, -4.65), V(-4, -4.65), f.travel, f.phase === 4);
    sourceStatus.textContent = state.released ? "源块：已归还" : "源块：保持占用";
    destStatus.textContent = state.resumed
      ? "历史就绪 · 重算 p3 后继续"
      : state.received.every(Boolean)
        ? "两块已到达"
        : state.allocated
          ? "已分配 · 等待历史"
          : "目的块：尚未分配";
    meaning.textContent =
      f.phase === 4
        ? "D → P 完成信号；到达后才释放源块"
        : f.phase === 5
          ? "D 使用本地副本，P 可以继续服务其他请求"
          : "P #7 → D #3；P #12 → D #5";
  };
}

function coreScene(k: InferenceKit) {
  // Spatial 3D separated-architecture stage above a native NPU: elevated GM terrace + AIC & AIV silicon decks.
  const gmDeck = k.box(V(0, 1.72, -3.75), V(13.6, 0.34, 2.55), "#dde7da");
  const aicDeck = k.box(V(-3.7, 0.16, 1.15), V(6.1, 0.32, 5.45), "#e6ece1");
  const aivDeck = k.box(V(3.8, 0.16, 1.15), V(5.7, 0.32, 5.45), "#e2ebe7");
  for (const deck of [gmDeck, aicDeck, aivDeck]) deck.material.opacity = 0.96;

  const terraceRim = (center: T.Vector3, w: number, d: number, y: number, color = INK.green) => {
    const corners = [
      V(center.x - w / 2, y, center.z - d / 2),
      V(center.x + w / 2, y, center.z - d / 2),
      V(center.x + w / 2, y, center.z + d / 2),
      V(center.x - w / 2, y, center.z + d / 2),
    ];
    const line = k.wire([...corners, corners[0]!], color);
    line.material.linewidth = 1.4;
    line.material.opacity = 0.45;
  };
  terraceRim(V(0, 0, -3.75), 13.6, 2.55, 1.9);
  terraceRim(V(-3.7, 0, 1.15), 6.1, 5.45, 0.33, INK.gold);
  terraceRim(V(3.8, 0, 1.15), 5.7, 5.45, 0.33, INK.blue);

  // Dashed 3D expansion leaders connect the native NPU module base up to the expanded on-chip terraces.
  for (const [sx, sz, tx, ty, tz] of [
    [-2.1, 2.1, -6.75, 0.33, 3.87],
    [2.1, 2.1, 6.65, 0.33, 3.87],
    [-2.0, 1.2, -6.8, 1.9, -2.48],
    [2.0, 1.2, 6.8, 1.9, -2.48],
  ] as const) {
    k.wire([V(sx, -4.45, sz), V(tx, ty, tz)], INK.green, true);
  }

  k.label("GM · 设备全局内存", V(0, 2.35, -5.25), "region");
  k.label("AIC · 矩阵侧", V(-3.7, 0.42, -1.92), "region");
  k.label("AIV · 向量侧", V(3.8, 0.42, -1.92), "region");
  k.label("同一张 NPU · 底座同步 GM", V(0, -5.75, 5.15), "hardware");

  const x = k.matrix("输入 x", CORE_X, V(-5.15, 2.02, -3.75), INK.blue, 0.66);
  const w = k.matrix("权重 W", CORE_W, V(-2.05, 2.02, -3.75), INK.gold, 0.58);
  const mid = k.matrix("GM 中间区", [CORE_PRODUCT], V(1.6, 2.02, -3.75), INK.green, 0.68);
  const out = k.matrix("GM 输出", [CORE_OUTPUT], V(5.0, 2.02, -3.75), INK.green, 0.68);
  k.memory(0, [x, w, mid, out]);

  const l1x = k.matrix("L1 · x", CORE_X, V(-5.2, 0.46, -0.78), INK.blue, 0.62);
  const l1w = k.matrix("L1 · W", CORE_W, V(-2.15, 0.46, -0.78), INK.gold, 0.56);
  const a = k.matrix("L0A", CORE_X, V(-5.2, 0.46, 0.88), INK.blue, 0.62);
  const b = k.matrix("L0B", CORE_W, V(-2.15, 0.46, 0.88), INK.gold, 0.56);
  const c = k.matrix("L0C", [CORE_PRODUCT], V(-3.7, 0.46, 3.32), INK.green, 0.66);

  const ub = k.matrix("UB · 计算前", [CORE_PRODUCT], V(3.8, 0.46, -0.68), INK.green, 0.7);
  const activated = k.matrix("UB · 激活后", [CORE_OUTPUT], V(3.8, 0.46, 3.32), INK.green, 0.7);

  for (const m of [x, w, mid, out, l1x, l1w, a, b, c, ub, activated]) {
    m.group.rotation.x = -Math.PI / 2;
  }
  for (const m of [x, mid, out]) m.titlePoint.set(0, 0.78, 0.28);
  w.titlePoint.set(0, 1.02, 0.28);
  l1x.titlePoint.set(0, 0.72, 0.26);
  l1w.titlePoint.set(0, 0.96, 0.26);
  a.titlePoint.set(0, 0.72, 0.26);
  b.titlePoint.set(0, 0.96, 0.26);
  ub.titlePoint.set(0, 0.76, 0.26);
  // Front-row output buffers place titles along their front edge so they never touch the 3D compute housings behind them.
  c.titlePoint.set(-1.35, 0, 0.26);
  c.title.classList.replace("name", "row");
  activated.titlePoint.set(-1.45, 0, 0.26);
  activated.title.classList.replace("name", "row");

  // Volumetric 3D Cube MAC Array: stepped silicon base + 2×2 compute pillars (col 0 → 5, col 1 → -5).
  const cubeBase = k.box(V(-3.7, 0.52, 2.12), V(3.35, 0.36, 1.02), "#9c7538");
  const cubeCap = k.box(V(-3.7, 0.76, 2.12), V(2.85, 0.16, 0.76), INK.gold);
  const cubeNodes = [
    k.box(V(-4.35, 0.96, 1.94), V(0.46, 0.28, 0.26), INK.blue),
    k.box(V(-4.35, 0.96, 2.3), V(0.46, 0.28, 0.26), INK.gold),
    k.box(V(-3.05, 0.96, 1.94), V(0.46, 0.28, 0.26), INK.blue),
    k.box(V(-3.05, 0.96, 2.3), V(0.46, 0.28, 0.26), INK.gold),
  ];
  k.label("Cube · 矩阵乘加", V(0, 0.95, 0.1), "unit", cubeBase);

  // Elevated 3D Fixpipe bridge spanning the canyon from AIC L0C back up to the GM intermediate slot.
  const fixpipeBridge = k.box(V(-0.1, 0.76, 1.15), V(0.56, 0.28, 1.45), "#578b74");
  fixpipeBridge.material.opacity = 0.88;
  k.label("Fixpipe", V(-0.1, 1.18, 1.15), "name");

  // Volumetric 3D Vector ReLU Gate: two parallel channel lanes where negative channel 1 clamps to 0.
  const vectorBase = k.box(V(3.8, 0.52, 1.32), V(3.25, 0.34, 1.08), "#2c6f9e");
  const reluGateBar = k.box(V(3.8, 0.76, 1.32), V(2.85, 0.1, 0.2), "#dceaf4");
  const vectorLanes = [
    k.box(V(3.22, 0.92, 1.32), V(0.62, 0.36, 0.52), INK.green),
    k.box(V(4.38, 0.92, 1.32), V(0.62, 0.36, 0.52), INK.gold),
  ];
  k.label("Vector · ReLU", V(0, 0.98, 0.1), "unit", vectorBase);

  // Structural feed conduits on each silicon deck.
  const toCube = [
    k.wire([V(-5.2, 0.55, 1.22), V(-5.2, 0.62, 2.12), V(-4.7, 0.62, 2.12)], INK.blue),
    k.wire([V(-2.15, 0.55, 1.44), V(-2.15, 0.62, 2.12), V(-2.7, 0.62, 2.12)], INK.gold),
    k.wire([V(-3.7, 0.58, 2.64), V(-3.7, 0.55, 2.98)], INK.green),
  ];
  const vectorFeed = [
    k.wire([V(3.8, 0.55, -0.28), V(3.8, 0.62, 0.76)], INK.green),
    k.wire([V(3.8, 0.62, 1.88), V(3.8, 0.55, 2.94)], INK.green),
  ];

  // Curved 3D Bezier trajectories with genuine vertical height arcs.
  const arc3D = (from: T.Vector3, to: T.Vector3, lift = 1.25, sideX = 0) =>
    new T.CubicBezierCurve3(
      from,
      V(from.x + sideX * 0.35, Math.max(from.y, to.y) + lift, from.z + (to.z - from.z) * 0.28),
      V(to.x + sideX * 0.35, Math.max(from.y, to.y) + lift, from.z + (to.z - from.z) * 0.72),
      to,
    );
  const gmScanCurve = new T.LineCurve3(V(-5.95, 2.25, -3.75), V(-1.25, 2.25, -3.75));
  const routeXToL1 = arc3D(V(-5.15, 2.12, -3.75), V(-5.2, 0.58, -0.78), 0.95);
  const routeWToL1 = arc3D(V(-2.05, 2.12, -3.75), V(-2.15, 0.58, -0.78), 0.95);
  const routeL1ToA = arc3D(V(-5.2, 0.58, -0.78), V(-5.2, 0.58, 0.88), 0.65);
  const routeL1ToB = arc3D(V(-2.15, 0.58, -0.78), V(-2.15, 0.58, 0.88), 0.65);
  const routeFixpipe = new T.CatmullRomCurve3([
    V(-3.7, 0.6, 3.32),
    V(-0.9, 0.95, 2.65),
    V(-0.1, 1.12, 1.15),
    V(0.45, 1.85, -1.35),
    V(1.6, 2.14, -3.75),
  ]);
  const routeMidToUb = arc3D(V(1.6, 2.14, -3.75), V(3.8, 0.58, -0.68), 1.05);
  const routeVectorIn = arc3D(V(3.8, 0.58, -0.68), V(3.8, 0.88, 1.32), 0.45);
  const routeVectorOut = arc3D(V(3.8, 0.88, 1.32), V(3.8, 0.58, 3.32), 0.45);
  const routeWriteback = new T.CatmullRomCurve3([
    V(3.8, 0.6, 3.32),
    V(5.95, 1.45, 2.15),
    V(6.1, 2.35, -0.95),
    V(5.0, 2.14, -3.75),
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
  const gmScanner = k.box(V(-5.15, 2.25, -3.75), V(0.32, 0.14, 1.32), INK.blue);
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
  const equation = k.label("输入和权重常驻 GM，片上缓冲接住当前数据块", V(0, 0.22, 4.78), "equation");

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
      node.position.y = 0.94 + pulse * 0.21;
      node.material.emissive.set(pulse > 0.08 ? "#664914" : "#000000");
    });

    // Volumetric Vector ReLU per-lane clamping animation in Phase 6 ([5, -5] → [5, 0]).
    const reluClamp = f.phase === 6 ? span(f.local, 0.15, 0.65) : f.phase > 6 ? 1 : 0;
    vectorBase.material.emissive.set(f.phase === 6 ? "#154565" : "#000000");
    reluGateBar.material.emissive.set(f.phase === 6 ? "#36739c" : "#000000");
    const posHeight = f.phase >= 6 ? 0.46 : 0.24;
    const negHeight = f.phase === 6 ? 0.42 * (1 - reluClamp) + 0.06 : f.phase > 6 ? 0.06 : 0.24;
    vectorLanes[0]!.scale.y = posHeight;
    vectorLanes[0]!.position.y = 0.72 + posHeight / 2;
    vectorLanes[1]!.scale.y = negHeight;
    vectorLanes[1]!.position.y = 0.72 + negHeight / 2;
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

export async function mountInferenceScene(host: HTMLDivElement, kind: number, signal: AbortSignal) {
  const kit = await inferenceSceneKit(host, kind, signal);
  if (!kit) return null;
  const update = [attentionScene, cacheScene, pdScene, coreScene][kind]!(kit);
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
