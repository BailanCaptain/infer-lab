/**
 * 主线程侧的时间线客户端：一个 Worker、按 requestKey 缓存、并发请求按 id 配对。
 * spawn 可注入，测试里用假 Worker 在进程内跑 handleTimelineMessage。
 */
import type { Timeline } from "../../sim/timeline/types";
import {
  requestKey,
  type TimelineRequest,
  type TimelineWorkerMessage,
  type TimelineWorkerReply,
} from "./protocol";

export interface WorkerLike {
  postMessage(msg: TimelineWorkerMessage): void;
  onmessage: ((e: { data: TimelineWorkerReply }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  terminate(): void;
}

export interface LoadedTimeline {
  timeline: Timeline;
  /** Worker 内构建耗时 */
  buildMs: number;
  /** 往返总耗时减去 buildMs：消息序列化、转移与排队 */
  transferMs: number;
  cached: boolean;
}

export interface TimelineClient {
  load(req: TimelineRequest): Promise<LoadedTimeline>;
  /** 终止 Worker 并清空缓存 */
  dispose(): void;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function createTimelineClient(spawn: () => WorkerLike): TimelineClient {
  let worker: WorkerLike | null = null;
  let nextId = 1;
  const cache = new Map<string, Promise<LoadedTimeline>>();
  const pending = new Map<
    number,
    { resolve: (v: LoadedTimeline) => void; reject: (e: Error) => void; t0: number }
  >();

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker;
    worker = spawn();
    worker.onmessage = (e) => {
      const reply = e.data;
      const p = pending.get(reply.id);
      if (!p) return;
      pending.delete(reply.id);
      if (reply.type === "done") {
        const total = now() - p.t0;
        p.resolve({
          timeline: reply.timeline,
          buildMs: reply.buildMs,
          transferMs: Math.max(0, total - reply.buildMs),
          cached: false,
        });
      } else p.reject(new Error(reply.message));
    };
    worker.onerror = (e) => {
      const err = new Error(e.message ?? "时间线 Worker 出错");
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    };
    return worker;
  };

  return {
    load(req) {
      const key = requestKey(req);
      const hit = cache.get(key);
      if (hit) return hit.then((v) => ({ ...v, cached: true }));
      const promise = new Promise<LoadedTimeline>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject, t0: now() });
        ensureWorker().postMessage({ type: "build", id, req });
      });
      cache.set(key, promise);
      promise.catch(() => cache.delete(key));
      return promise;
    },
    dispose() {
      worker?.terminate();
      worker = null;
      cache.clear();
      const err = new Error("时间线客户端已释放");
      for (const p of pending.values()) p.reject(err);
      pending.clear();
    },
  };
}

/** 浏览器默认实现：Vite module worker。 */
export function createDefaultTimelineClient(): TimelineClient {
  return createTimelineClient(
    () =>
      new Worker(new URL("./timeline.worker.ts", import.meta.url), {
        type: "module",
      }) as unknown as WorkerLike,
  );
}
