/**
 * 主线程 ↔ 时间线 Worker 的消息协议。Timeline 全是可 structuredClone 的纯数据（见 residency.test.ts）。
 */
import type { Timeline } from "../../sim/timeline/types";

export interface TimelineRequest {
  /** 预设模型 id，如 "qwen3-0.6b" */
  modelId: string;
  /** 预设句子 id，如 "kv-cache" */
  presetId: string;
  layerIndex?: number;
  chapterId?: string;
}

export type TimelineWorkerMessage = { type: "build"; id: number; req: TimelineRequest };

export type TimelineWorkerReply =
  | { type: "done"; id: number; timeline: Timeline; buildMs: number }
  | { type: "error"; id: number; message: string };

export function requestKey(req: TimelineRequest): string {
  return `${req.modelId}|${req.presetId}|L${req.layerIndex ?? 0}|${req.chapterId ?? ""}`;
}
