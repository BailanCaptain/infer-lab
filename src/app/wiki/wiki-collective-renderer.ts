import * as T from "three";
import { INK, inferenceSceneKit, V } from "./inference-scene-kit";
import { collectiveFrame, collectiveInputs, RANKS } from "./scene-collective";
import { setWidePolylinePoints } from "./scene-polyline";

const xs = [-5.85, -1.95, 1.95, 5.85];
const pitch = 0.67;
const blank = [[""], [""], [""], [""]];
const tones = [INK.blue, INK.gold, INK.violet, INK.green];

/** Orthogonal lanes with rounded corners, shared by the visible wire and moving block. */
function route(points: T.Vector3[]) {
  const path = new T.CurvePath<T.Vector3>();
  let previous = points[0]!;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!,
      next = points[i + 1]!;
    const radius = Math.min(0.2, previous.distanceTo(p) / 3, p.distanceTo(next) / 3);
    const a = p.clone().add(previous.clone().sub(p).normalize().multiplyScalar(radius));
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(radius));
    path.add(new T.LineCurve3(previous, a));
    path.add(new T.QuadraticBezierCurve3(a, p, b));
    previous = b;
  }
  path.add(new T.LineCurve3(previous, points.at(-1)!));
  return path;
}

export async function mountCollectiveScene(host: HTMLDivElement, signal: AbortSignal) {
  const kit = await inferenceSceneKit(host, 0, signal, 5);
  if (!kit) return null;
  let kind = 0;
  kit.label("同一台机器 · 本次选四张 NPU", V(0, 7.65), "region");
  const input = RANKS.map((r) =>
    kit.matrix(
      "输入",
      blank,
      V(xs[r]!, 1.7),
      INK.blue,
      pitch,
      RANKS.map((b) => `块 ${b}`),
      [1.22],
    ),
  );
  const output = RANKS.map((r) =>
    kit.matrix(
      "输出",
      blank,
      V(xs[r]! - 0.24, -3.9),
      INK.green,
      pitch,
      RANKS.map((b) => `块 ${b}`),
      [1.22],
    ),
  );
  const incoming = RANKS.map((r) =>
    kit.matrix("", blank, V(xs[r]! + 1.24, -3.9), INK.blue, pitch, [], [1.08]),
  );
  // Keep captions below the receive area so a travelling whole vector never crosses them.
  for (const matrix of [...output, ...incoming]) matrix.titlePoint.y = -1.65;
  const rankTags = RANKS.map((r) => kit.label(`rank ${r}`, V(xs[r]!, 4.05), "hardware"));
  RANKS.forEach((r) => {
    const owned = kit.ownership(r, V(xs[r]!, 3.65), "");
    owned.caption.textContent = "";
  });
  const outputStates = RANKS.map((r) => kit.label("", V(xs[r]!, -6.15), "status"));
  const packets = RANKS.map(() => kit.matrix("", blank, V(0, 0), INK.blue, pitch, [], [1.08]));
  const lines = RANKS.map(() => kit.wire([V(0, 0), V(0, 0)], INK.blue));
  const deviceLinks = RANKS.map(() => kit.hardwareTransfer());
  RANKS.forEach((r) => {
    kit.memory(r, [input[r]!, output[r]!]);
  });
  const arrows = RANKS.map(() => kit.wire([V(0, 0), V(0, 0)], INK.blue));
  const operators = RANKS.map((r) =>
    RANKS.map((b) => kit.label("", V(xs[r]! + 0.5, -3.9 + (1.5 - b) * pitch, 0.55), "status")),
  );
  const channel = kit.label("", V(0, -0.7), "status");
  const caption = kit.label("每格代表一块 · 格内是该块的示意数值", V(0, -7.05), "region");
  const values = (row: (number | null)[]) => row.map((v) => [v ?? ""]);
  const showRows = (matrix: (typeof input)[number], rows: number[]) => {
    matrix.cells.forEach((cell, i) => {
      cell.visible = rows.includes(i);
    });
    matrix.names.forEach((label, i) => {
      label.textContent =
        matrix === input[0] || matrix === output[0]
          ? `${kind === 7 && output.includes(matrix) ? "源" : "块"} ${i}`
          : "";
    });
  };
  const animate = (progress: number) => {
    const f = collectiveFrame(kind, progress),
      initial = collectiveInputs(kind);
    kit.root.updateMatrixWorld(true);
    RANKS.forEach((r) => {
      input[r]!.write(values(initial[r]!), { color: INK.blue });
      showRows(
        input[r]!,
        RANKS.filter((b) => initial[r]![b] !== null),
      );
      input[r]!.title.textContent = initial[r]!.some((v) => v !== null)
        ? `输入 · ${initial[r]!.filter((v) => v !== null).length} 块`
        : "不提供输入";
      output[r]!.write(values(f.output[r]!), {
        color: kind === 8 || (kind >= 4 && kind <= 6) ? INK.green : INK.blue,
      });
      const noOutput = (kind === 2 || kind === 4) && r !== 0;
      const rows = noOutput ? [] : kind === 1 || kind === 5 ? [r] : [...RANKS];
      showRows(output[r]!, rows);
      output[r]!.title.textContent = noOutput
        ? "无新输出"
        : kind === 8
          ? "工作值"
          : `输出 · ${rows.length} 块`;
      rankTags[r]!.textContent = `rank ${r}${kind < 3 || kind === 4 ? (r === 0 ? " · 根" : "") : ""}`;
      const filled = f.output[r]!.filter((v) => v !== null).length;
      outputStates[r]!.textContent = noOutput
        ? "原输入仍保留"
        : f.ended
          ? kind === 8 || (kind >= 4 && kind <= 6)
            ? "已加齐"
            : "已收齐"
          : filled
            ? `${filled} 块已写入`
            : "等待接收";
      incoming[r]!.group.visible = false;
      operators[r]!.forEach((label) => {
        label.textContent = "";
      });
      packets[r]!.group.visible = false;
      lines[r]!.visible = arrows[r]!.visible = false;
      deviceLinks[r]!(0, 0, 0, false);
      kit.compute(r, false);
    });
    channel.textContent = f.intro ? "蓝色是输入 · 下方等待接收" : f.ended ? "通信结束 · 对照每卡输出" : "";
    caption.textContent =
      kind === 8
        ? "逻辑环：0 → 1 → 2 → 3 → 0 · 路线不表示物理布线"
        : "每格是一块 · 路线表示数据归属，不表示实际网络包顺序";
    f.current?.transfers.forEach((t, index) => {
      const source = t.source === "input" ? input[t.from]! : output[t.from]!;
      const receiver = incoming[t.to]!;
      const color = kind === 8 ? tones[t.slots[0]!]! : INK.blue;
      deviceLinks[index]!(t.from, t.to, f.travel, !f.applied, color);
      kit.compute(t.to, f.arrived && !f.applied && t.operation === "sum", INK.green);
      const row = t.slots[0]!,
        targetRow = t.targets[0]!;
      const sourceCenter =
        t.slots.length === 4
          ? source.group.getWorldPosition(V(0, 0)).add(V(0.72, 0, 0.4))
          : source.rowPoint(row, 1).add(V(0.12, 0, 0.1));
      const destination = receiver;
      const end =
        t.targets.length === 4
          ? destination.group.getWorldPosition(V(0, 0)).add(V(0, 0, 0.4))
          : destination.rowPoint(targetRow).add(V(0, 0, 0.1));
      const lane = kind === 8 && f.action >= 4 ? 0.1 - index * 0.36 : -0.85;
      const fromX = xs[t.from]! + (t.source === "output" ? 2.03 : 0.97);
      const toX = xs[t.to]! + 0.68;
      const path = route([
        sourceCenter,
        V(fromX, sourceCenter.y, 0.65),
        V(fromX, lane, 0.65),
        V(toX, lane, 0.65),
        V(toX, end.y, 0.65),
        end,
      ]);
      const line = lines[index]!;
      line.visible = !f.applied;
      line.material.color.set(color);
      setWidePolylinePoints(line, path.getPoints(80));
      arrows[index]!.visible = !f.arrived;
      arrows[index]!.material.color.set(color);
      setWidePolylinePoints(arrows[index]!, [
        end.clone().add(V(-0.12, 0.09, 0)),
        end,
        end.clone().add(V(-0.12, -0.09, 0)),
      ]);
      const packet = packets[index]!;
      packet.group.visible = f.travel * path.getLength() > 0.65 && f.travel < 1;
      packet.group.position.copy(path.getPointAt(f.travel));
      // A whole vector travels as four aligned cells; a block keeps its own position label.
      const packetValues =
        t.values.length === 4 ? t.values.map((v) => [v]) : [[t.values[0]!], [""], [""], [""]];
      packet.write(packetValues, { color });
      packet.cells.forEach((cell, i) => {
        cell.visible = i < t.values.length;
      });
      if (t.values.length === 1) packet.group.position.y -= (3 * pitch) / 2;
      packet.title.textContent = "";
      if (!f.applied) {
        receiver.group.visible = true;
        receiver.title.textContent = f.arrived ? "到达" : "接收";
        const next = RANKS.map((b) => [
          f.arrived && t.targets.includes(b) ? t.values[t.targets.indexOf(b)]! : "",
        ]);
        receiver.write(next, { color });
        showRows(receiver, t.targets);
        if (f.arrived)
          for (const b of t.targets) operators[t.to]![b]!.textContent = t.operation === "sum" ? "+" : "←";
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
    reset: kit.reset,
    dispose: kit.dispose,
  };
}
