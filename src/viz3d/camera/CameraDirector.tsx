/**
 * 相机导演：读当前步的 camera.view 选方向，用场景包围盒算距离，交给 CameraRig 平滑推过去。
 * 「重置视角」通过 store.cameraResetSeq 触发重新取景。用户拖动接管（OrbitControls）留到下一步。
 */
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { selectNoMotion, selectStep, usePlayback } from "../../timeline";
import { resolveScene } from "../scenes/sceneLayout";
import { type CameraPose, CameraRig } from "./CameraRig";
import { LAB_FOV } from "./views";

export { LAB_FOV };

const IDLE_POSE: CameraPose = { pos: [0, 0.5, 16], target: [0, 0.5, 0] };

export function CameraDirector() {
  const step = usePlayback(selectStep);
  const timeline = usePlayback((s) => s.timeline);
  const noMotion = usePlayback(selectNoMotion);
  const resetSeq = usePlayback((s) => s.cameraResetSeq);
  const size = useThree((s) => s.size);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetSeq 变化时要重新取景
  const pose = useMemo<CameraPose>(() => {
    if (!step || !timeline) return IDLE_POSE;
    const aspect = size.height > 0 ? size.width / size.height : 16 / 9;
    const { layout: L, view: v, distance: d } = resolveScene(step, timeline, aspect);
    const len = Math.hypot(...v.dir) || 1;
    const [cx, cy, cz] = L.center;
    return {
      pos: [cx + (v.dir[0] / len) * d, cy + (v.dir[1] / len) * d, cz + (v.dir[2] / len) * d],
      target: [cx, cy, cz],
    };
  }, [step, timeline, size.width, size.height, resetSeq]);

  return <CameraRig pose={pose} instant={noMotion} />;
}
