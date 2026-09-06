import { mapTimelineResidency } from "./hardware/mapResidency";
import { NPU_910B, type NpuSpec } from "./hardware/spec";
import { type BuildTimelineOptions, buildLayerTimeline } from "./model/forwardLayer";
import type { ModelSpec } from "./modelspec/types";
import type { Timeline } from "./timeline/types";

/** Worker / 播放器使用的双层入口；纯模型入口仍可独立做数值对拍。 */
export function buildHardwareTimeline(
  model: ModelSpec,
  preset: Timeline["preset"],
  options: BuildTimelineOptions & { hardwareSpec?: NpuSpec } = {},
): Timeline {
  const start = performance.now();
  const timeline = mapTimelineResidency(
    buildLayerTimeline(model, preset, options),
    options.hardwareSpec ?? NPU_910B,
  );
  return { ...timeline, buildMs: performance.now() - start };
}
