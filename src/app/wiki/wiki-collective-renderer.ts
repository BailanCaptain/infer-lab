import * as T from "three";
import { INK, inferenceSceneKit, V, wireTone } from "./inference-scene-kit";
import { collectiveFrame, collectiveInputs, RANKS } from "./scene-collective";
import { setWidePolylinePoints } from "./scene-polyline";

const xs = [-5.25, -1.75, 1.75, 5.25];
const pitch = 0.62;
const blank4 = [[""], [""], [""], [""]];
const blank1 = [[""]];
const RANK_TONES = [INK.blue, INK.gold, INK.green, INK.amethyst] as const;

function route(points: T.Vector3[]) {
  const path = new T.CurvePath<T.Vector3>();
  let previous = points[0]!;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!,
      next = points[i + 1]!;
    const radius = Math.min(0.24, previous.distanceTo(p) / 2.6, p.distanceTo(next) / 2.6);
    const a = p.clone().add(previous.clone().sub(p).normalize().multiplyScalar(radius));
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(radius));
    path.add(new T.LineCurve3(previous, a));
    path.add(new T.QuadraticBezierCurve3(a, p, b));
    previous = b;
  }
  path.add(new T.LineCurve3(previous, points.at(-1)!));
  return path;
}

/** Side-gutter takeoff into the open 3D HCCS corridor (`y ∈ [0.36, 1.28]`), or short local hop when `from === to`. */
function transferCurve(
  from: number,
  to: number,
  sourceKind: "input" | "output",
  isVector: boolean,
  start: T.Vector3,
  end: T.Vector3,
  ringWrap: boolean,
) {
  if (from === to) {
    const midY = Math.max(start.y, end.y) + 0.28;
    return new T.CubicBezierCurve3(start, V(start.x + 0.18, midY, 0.65), V(end.x - 0.18, midY, 0.65), end);
  }
  const gutterX = xs[from]! + (sourceKind === "input" ? -1.52 : 1.52);
  const span = Math.abs(to - from);
  const laneY = ringWrap ? 1.38 : isVector ? 0.78 : span === 1 ? 0.42 : 0.56 + span * 0.16;
  const laneZ = ringWrap ? 0.96 : 0.68;
  return route([start, V(gutterX, start.y, laneZ), V(gutterX, laneY, laneZ), V(end.x, laneY, laneZ), end]);
}

export async function mountCollectiveScene(host: HTMLDivElement, signal: AbortSignal) {
  const kit = await inferenceSceneKit(host, 0, signal, 5);
  if (!kit) return null;
  let kind = 0;
  let focusBlock: number | undefined;
  let lastProgress = 0;

  kit.label("同一台 8 卡整机 · 本次取槽 0–3 组成 4 卡通信组", V(0, 6.42), "region");
  const hccsTag = kit.label("机内 HCCS 互联", V(0, 4.62), "subhead");

  kit.root.updateMatrixWorld(true);
  const ports = RANKS.map((r) => kit.port(r));
  for (let r = 0; r < 3; r++) {
    const a = ports[r]!.clone().add(V(0, -0.42, 0.12));
    const b = ports[r + 1]!.clone().add(V(0, -0.42, 0.12));
    const bus = kit.wire([a, b], "#8b9894", true, kit.root, 1.5);
    bus.material.opacity = 0.42;
  }

  const deckY = -2.52;
  RANKS.forEach((r) => {
    const deck = kit.box(V(xs[r]!, deckY, -0.2), V(3.26, 3.82, 0.08), "#f1eee6");
    deck.material.opacity = 0.88;
    const hw = 1.63,
      hh = 1.91;
    const rim = kit.wire(
      [
        V(xs[r]! - hw, deckY + hh, -0.14),
        V(xs[r]! + hw, deckY + hh, -0.14),
        V(xs[r]! + hw, deckY - hh, -0.14),
        V(xs[r]! - hw, deckY - hh, -0.14),
        V(xs[r]! - hw, deckY + hh, -0.14),
      ],
      RANK_TONES[r]!,
      false,
      kit.root,
      1.4,
    );
    rim.material.opacity = 0.45;
    const p = ports[r]!;
    const anchor = kit.wire(
      [p.clone().add(V(0, -0.45, 0.1)), V(xs[r]!, deckY + hh, -0.08)],
      RANK_TONES[r]!,
      true,
      kit.root,
      1.7,
    );
    anchor.material.opacity = 0.48;
  });

  // Elevate rank pills onto the physical NPU cards, well above the HCCS flight corridor.
  const rankPills = RANKS.map((r) => {
    const el = kit.label(`rank ${r} · 槽 ${r}`, V(xs[r]!, 3.12, 0.22), "rank-pill");
    el.style.borderColor = wireTone(RANK_TONES[r]!).getStyle();
    return el;
  });

  const colY = -2.56;
  const input = RANKS.map((r) =>
    kit.matrix(
      "输入",
      blank4,
      V(xs[r]! - 1.04, colY),
      RANK_TONES[r]!,
      pitch,
      r === 0 ? RANKS.map((b) => `块 ${b}`) : [],
      [0.78],
    ),
  );
  const incoming = RANKS.map((r) =>
    kit.matrix("暂存", blank4, V(xs[r]!, colY), RANK_TONES[r]!, pitch, [], [0.76]),
  );
  const output = RANKS.map((r) =>
    kit.matrix("结果", blank4, V(xs[r]! + 1.04, colY), RANK_TONES[r]!, pitch, [], [0.82]),
  );

  for (const m of [...input, ...incoming, ...output]) {
    m.title.classList.replace("name", "subhead");
    m.titlePoint.set(0, 1.74, 0.04);
  }
  input[0]!.names.forEach((n) => {
    n.style.fontSize = "11.5px";
  });

  RANKS.forEach((r) => {
    kit.memory(r, [input[r]!, output[r]!]);
    RANKS.forEach((b) => {
      kit.pick(input[r]!.cells[b]!, () => {
        focusBlock = focusBlock === b ? undefined : b;
        animate(lastProgress);
      });
      kit.pick(output[r]!.cells[b]!, () => {
        const target = kind === 7 ? r : b;
        focusBlock = focusBlock === target ? undefined : target;
        animate(lastProgress);
      });
    });
  });

  const outputStates = RANKS.map((r) => kit.label("", V(xs[r]!, -4.68), "status"));
  const mergeLinks = RANKS.map((r) =>
    RANKS.map((b) => {
      const y = colY + (1.5 - b) * pitch;
      const w = kit.wire(
        [V(xs[r]! + 0.4, y, 0.14), V(xs[r]! + 0.64, y, 0.14)],
        RANK_TONES[b]!,
        false,
        kit.root,
        2.2,
      );
      w.visible = false;
      return w;
    }),
  );

  const singlePackets = RANKS.map(() => kit.matrix("", blank1, V(0, 0), INK.blue, pitch, [], [0.78]));
  const vectorPackets = RANKS.map(() => kit.matrix("", blank4, V(0, 0), INK.blue, pitch, [], [0.78]));
  for (const p of [...singlePackets, ...vectorPackets]) p.title.textContent = "";
  const lines = RANKS.map(() => kit.wire([V(0, 0), V(0, 0)], INK.blue));
  const arrows = RANKS.map(() => kit.wire([V(0, 0), V(0, 0)], INK.blue, false, kit.root, 2.2));

  const channel = kit.label("", V(0, 0.92, 0.6), "status");
  const caption = kit.label("", V(0, -5.38), "equation");

  const toCol = (row: (number | null)[]) => row.map((v) => [v ?? ""]);
  const showRows = (matrix: (typeof input)[number], rows: number[]) => {
    matrix.cells.forEach((cell, i) => {
      cell.visible = rows.includes(i);
    });
    matrix.syncBrackets();
  };

  const animate = (progress: number) => {
    lastProgress = progress;
    const f = collectiveFrame(kind, progress),
      initial = collectiveInputs(kind);
    kit.root.updateMatrixWorld(true);

    const rowPalette = (card: number, isInput: boolean): readonly string[] =>
      kind === 7 && isInput
        ? [RANK_TONES[card]!, RANK_TONES[card]!, RANK_TONES[card]!, RANK_TONES[card]!]
        : RANK_TONES;

    hccsTag.textContent =
      kind === 8
        ? "逻辑环 0 → 1 → 2 → 3 → 0 叠加在机内 HCCS 互联上"
        : "机内 HCCS 互联 · 数据块从源卡经走廊落入目标卡暂存";

    const recvTargets = RANKS.map(() => [] as number[]);
    const arrivedValues = RANKS.map(() => [null, null, null, null] as (number | null)[]);
    const incomingColors = RANKS.map(() => [...RANK_TONES] as string[]);

    if (f.current && !f.applied) {
      f.current.transfers.forEach((t) => {
        t.targets.forEach((targetSlot, idx) => {
          recvTargets[t.to]!.push(targetSlot);
          const tone = kind === 7 ? RANK_TONES[t.from]! : RANK_TONES[t.slots[idx] ?? targetSlot]!;
          incomingColors[t.to]![targetSlot] = tone;
          if (f.arrived) arrivedValues[t.to]![targetSlot] = t.values[idx]!;
        });
      });
    }

    RANKS.forEach((r) => {
      const validIn = RANKS.filter((b) => initial[r]![b] !== null);
      input[r]!.write(toCol(initial[r]!), {
        colors: rowPalette(r, true),
        focus: focusBlock,
      });
      showRows(input[r]!, validIn);
      input[r]!.title.textContent = validIn.length ? "输入" : "";

      const noOutput = (kind === 2 || kind === 4) && r !== 0;
      const outRows = noOutput ? [] : kind === 1 || kind === 5 ? [r] : [...RANKS];
      const outFocusCells =
        focusBlock !== undefined && kind === 7 ? (r === focusBlock ? [0, 1, 2, 3] : []) : undefined;
      output[r]!.write(toCol(f.output[r]!), {
        colors: rowPalette(r, false),
        focus: kind === 7 ? undefined : focusBlock,
        focusCells: outFocusCells,
      });
      showRows(output[r]!, outRows);
      output[r]!.title.textContent = noOutput ? "" : kind === 8 ? "工作" : "结果";

      const stageRows = noOutput ? recvTargets[r]! : outRows;
      incoming[r]!.write(toCol(arrivedValues[r]!), {
        colors: incomingColors[r]!,
        receivingCells: !f.arrived ? recvTargets[r]! : [],
        focus: kind === 7 ? undefined : focusBlock,
        focusCells: outFocusCells,
      });
      showRows(incoming[r]!, stageRows);
      incoming[r]!.title.textContent = stageRows.length ? "暂存" : "";

      const isRoot = (kind < 3 || kind === 4) && r === 0;
      rankPills[r]!.textContent = `rank ${r} · 槽 ${r}${isRoot ? " · 根卡" : ""}`;

      const filled = f.output[r]!.filter((v) => v !== null).length;
      outputStates[r]!.textContent = noOutput
        ? "仅提供输入"
        : f.ended
          ? kind === 8 || (kind >= 4 && kind <= 6)
            ? "已加齐结果"
            : "已收齐结果"
          : filled
            ? `已写入 ${filled} 块`
            : "等待写入";

      for (const link of mergeLinks[r]!) {
        link.visible = false;
      }
      singlePackets[r]!.group.visible = false;
      vectorPackets[r]!.group.visible = false;
      lines[r]!.visible = arrows[r]!.visible = false;
      kit.compute(r, false);
    });

    input[0]!.names.forEach((label, i) => {
      label.textContent = `块 ${i}`;
    });

    channel.textContent = f.intro
      ? "每卡并列展示 [输入 · 暂存 · 结果]（点击任一格可高亮追踪）"
      : f.ended
        ? "通信完成 · 核对每张卡保留的最终块与数值"
        : "";

    const currentOp = f.current?.transfers[0]?.operation;
    const trackSuffix = focusBlock !== undefined ? ` · 当前追踪块 ${focusBlock}` : "";
    caption.textContent =
      kind === 8
        ? `逻辑环 0 → 1 → 2 → 3 → 0：前 3 轮归约相加，后 3 轮直接复制${trackSuffix}`
        : kind === 7
          ? `All-to-All：第 j 块发往 rank j，结果按源 rank 0–3 排${trackSuffix}`
          : kind === 6 && (currentOp === "copy" || f.ended)
            ? `All-Reduce：第 1 阶段归约相加，第 2 阶段直接复制已归约结果${trackSuffix}`
            : `每格代表一块数据 · 先落入暂存，再${currentOp === "sum" || (!currentOp && kind >= 4 && kind <= 5) ? "与同位置累加写入结果" : "原样复制写入结果"}${trackSuffix}`;

    f.current?.transfers.forEach((t, index) => {
      const sourceMat = t.source === "input" ? input[t.from]! : output[t.from]!;
      const receiverMat = incoming[t.to]!;
      const isVector = t.slots.length === 4;
      const primarySlot = t.slots[0]!;
      const targetRow = t.targets[0]!;
      const color = kind === 7 ? RANK_TONES[t.from]! : RANK_TONES[primarySlot]!;

      kit.compute(t.to, f.arrived && !f.applied && t.operation === "sum", color);

      const start = isVector
        ? sourceMat.group.getWorldPosition(V(0, 0)).add(V(0, 0, 0.22))
        : sourceMat.rowPoint(primarySlot, t.source === "input" ? -1 : 1).add(V(0, 0, 0.08));
      const end = isVector
        ? receiverMat.group.getWorldPosition(V(0, 0)).add(V(0, 0, 0.22))
        : receiverMat.rowPoint(targetRow, 0).add(V(0, 0, 0.08));

      const ringWrap = kind === 8 && t.from === 3 && t.to === 0;
      const path = transferCurve(t.from, t.to, t.source, isVector, start, end, ringWrap);

      const line = lines[index]!;
      line.visible = !f.applied;
      line.material.color.copy(wireTone(color));
      line.material.opacity = f.arrived ? 0.45 : 0.92;
      setWidePolylinePoints(line, path.getPoints(56));

      const arrow = arrows[index]!;
      arrow.visible = !f.arrived;
      arrow.material.color.copy(wireTone(color));
      const tip = end.clone();
      const tangent = path.getTangent(0.98).normalize();
      const perp = V(-tangent.y, tangent.x, 0).multiplyScalar(0.11);
      const back = tip.clone().sub(tangent.clone().multiplyScalar(0.18));
      setWidePolylinePoints(arrow, [back.clone().add(perp), tip, back.clone().sub(perp)]);

      if (f.travel > 0.02 && f.travel < 1 && !f.arrived) {
        const pos = path.getPointAt(f.travel);
        // Only reveal floating numeric labels inside the open HCCS flight corridor, preventing overlap with deck rows/headers.
        const halfSpan = isVector ? 1.05 : 0.28;
        const showNumbers = t.from !== t.to && pos.y - halfSpan > -0.32 && pos.y + halfSpan < 2.55;
        if (isVector) {
          const pkt = vectorPackets[index]!;
          pkt.group.visible = true;
          pkt.group.position.copy(pos);
          pkt.write(
            t.values.map((v) => [v]),
            {
              colors: kind === 7 ? Array<string>(4).fill(color) : RANK_TONES,
              focus: kind === 7 ? undefined : focusBlock,
            },
          );
          if (!showNumbers) {
            for (const n of pkt.numbers) n.textContent = "";
          }
        } else {
          const pkt = singlePackets[index]!;
          pkt.group.visible = true;
          pkt.group.position.copy(pos);
          pkt.write([[t.values[0]!]], {
            color,
            empty: false,
            focus:
              focusBlock === undefined ? undefined : (kind === 7 ? t.to : primarySlot) === focusBlock ? 0 : 1,
          });
          if (!showNumbers) {
            pkt.numbers[0]!.textContent = "";
          }
        }
      }

      if (f.arrived && !f.applied) {
        outputStates[t.to]!.textContent = t.operation === "sum" ? "暂存 + 同位累加" : "暂存 → 复制写入";
        for (const b of t.targets) {
          const link = mergeLinks[t.to]![b]!;
          link.material.color.copy(wireTone(color));
          link.visible = true;
        }
      }
    });

    host.dataset.phase = String(f.action);
    host.dataset.progress = progress.toFixed(4);
    host.dataset.arrived = String(f.arrived);
    host.dataset.applied = String(f.applied);
    host.dataset.result = f.output.map((r) => r.map((v) => v ?? "_").join(",")).join(";");
    kit.render();
  };

  return {
    update(step: number) {
      kind = step;
    },
    animate,
    reset() {
      focusBlock = undefined;
      kit.reset();
      animate(lastProgress);
    },
    dispose: kit.dispose,
  };
}
