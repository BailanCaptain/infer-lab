/**
 * 时间线 Worker：在后台线程跑 buildHardwareTimeline（前向 + 硬件映射 + 校验），主线程不卡顿。
 * 由 client.ts 的 createDefaultTimelineClient 以 module worker 方式创建。
 */
import { handleTimelineMessage } from "./handle";
import type { TimelineWorkerMessage } from "./protocol";

self.onmessage = (e: MessageEvent<TimelineWorkerMessage>) => {
  if (e.data?.type !== "build") return;
  const { reply, transfer } = handleTimelineMessage(e.data);
  (self as unknown as Worker).postMessage(reply, transfer);
};
