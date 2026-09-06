/**
 * 把 Worker 客户端与 store 接起来：loading → ready / error。
 * 同一时刻只认最后一次请求，先发后到的旧结果被丢弃。
 */
import { usePlayback } from "./store";
import type { TimelineClient } from "./worker/client";
import type { TimelineRequest } from "./worker/protocol";

let latestSeq = 0;

export async function loadTimelineIntoStore(client: TimelineClient, req: TimelineRequest): Promise<boolean> {
  const seq = ++latestSeq;
  const store = usePlayback.getState();
  store.setLoading();
  try {
    const loaded = await client.load(req);
    if (seq !== latestSeq) return false;
    usePlayback.getState().load(loaded.timeline, {
      buildMs: loaded.buildMs,
      transferMs: loaded.transferMs,
      cached: loaded.cached,
    });
    return true;
  } catch (e) {
    if (seq !== latestSeq) return false;
    usePlayback.getState().setError(e instanceof Error ? e.message : String(e));
    return false;
  }
}
