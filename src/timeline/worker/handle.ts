/**
 * Worker 内的请求处理，独立成纯函数以便在 Node 测试里用假 Worker 走同一条路径。
 */
import { buildHardwareTimeline } from "../../sim/buildTimeline";
import { getTokenPreset } from "../../sim/model/presets";
import { getPresetSpec } from "../../sim/modelspec/presets";
import type { Timeline } from "../../sim/timeline/types";
import type { TimelineWorkerMessage, TimelineWorkerReply } from "./protocol";

/** 收集时间线里所有 Float32Array 的底层 buffer（去重），用于零拷贝转移。 */
export function collectTransferables(timeline: Timeline): ArrayBuffer[] {
  const seen = new Set<ArrayBuffer>();
  for (const t of Object.values(timeline.tensors)) {
    if (t.data && t.data.buffer instanceof ArrayBuffer) seen.add(t.data.buffer);
    if (t.thumb && t.thumb.data.buffer instanceof ArrayBuffer) seen.add(t.thumb.data.buffer);
  }
  return [...seen];
}

export function handleTimelineMessage(msg: TimelineWorkerMessage): {
  reply: TimelineWorkerReply;
  transfer: ArrayBuffer[];
} {
  try {
    const { req } = msg;
    const options: Parameters<typeof buildHardwareTimeline>[2] = {};
    if (req.layerIndex !== undefined) options.layerIndex = req.layerIndex;
    if (req.chapterId !== undefined) options.chapterId = req.chapterId;
    const timeline = buildHardwareTimeline(getPresetSpec(req.modelId), getTokenPreset(req.presetId), options);
    return {
      reply: { type: "done", id: msg.id, timeline, buildMs: timeline.buildMs },
      transfer: collectTransferables(timeline),
    };
  } catch (e) {
    return {
      reply: { type: "error", id: msg.id, message: e instanceof Error ? e.message : String(e) },
      transfer: [],
    };
  }
}
