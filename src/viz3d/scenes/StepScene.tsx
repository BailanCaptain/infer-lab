/**
 * 当前步的 3D 场景：按 sceneLayout 把 a / b / out 摆成构图，每个槽位一个 TensorGrid。
 * 换步时同一槽位的上一张量传给 TensorGrid 做 from→to 插值；播放期没有 React 重渲染。
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Highlight, TensorRecord } from "../../sim/timeline/types";
import { selectStep, usePlayback } from "../../timeline";
import { TensorGrid } from "../primitives/TensorGrid";
import { resolveScene, type SlotKey } from "./sceneLayout";

type PrevMap = Partial<Record<SlotKey, { rec: TensorRecord; hl: Highlight | undefined }>>;

export function StepScene() {
  const step = usePlayback(selectStep);
  const timeline = usePlayback((s) => s.timeline);
  const size = useThree((s) => s.size);
  const prevRef = useRef<PrevMap>({});
  const prev = prevRef.current;

  const aspect = size.height > 0 ? size.width / size.height : 16 / 9;
  const layout = step && timeline ? resolveScene(step, timeline, aspect).layout : null;

  useEffect(() => {
    if (!layout) return;
    const next: PrevMap = {};
    for (const s of layout.slots) next[s.key] = { rec: s.record, hl: s.highlight };
    prevRef.current = next;
  }, [layout]);

  if (!layout) return null;
  return (
    <group>
      {layout.slots.map((s) => (
        <TensorGrid
          key={s.key}
          record={s.record}
          prev={prev[s.key]?.rec ?? null}
          highlight={s.highlight}
          prevHighlight={prev[s.key]?.hl}
          box={s.box}
          window={s.window}
          cellSize={s.cellSize}
          hiWindow={s.hiWindow}
          labelScale={s.labelScale}
          title={s.title}
          position={s.position}
          labelKey={s.key}
        />
      ))}
    </group>
  );
}
