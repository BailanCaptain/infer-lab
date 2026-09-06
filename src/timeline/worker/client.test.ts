import { beforeEach, describe, expect, it } from "vitest";
import { validateTimeline } from "../../sim/timeline/validate";
import { loadTimelineIntoStore } from "../load";
import { resetPlaybackStore, usePlayback } from "../store";
import { createTimelineClient, type WorkerLike } from "./client";
import { collectTransferables, handleTimelineMessage } from "./handle";
import type { TimelineWorkerMessage } from "./protocol";

/** 进程内假 Worker：异步回消息，并用 structuredClone 模拟跨线程拷贝（含 buffer 转移）。 */
function fakeWorker(): WorkerLike & { received: TimelineWorkerMessage[]; terminated: boolean } {
  const w: WorkerLike & { received: TimelineWorkerMessage[]; terminated: boolean } = {
    received: [],
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(msg) {
      w.received.push(msg);
      queueMicrotask(() => {
        const { reply, transfer } = handleTimelineMessage(msg);
        const data = structuredClone(reply, { transfer });
        w.onmessage?.({ data });
      });
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

beforeEach(() => resetPlaybackStore());

describe("时间线 Worker 客户端", () => {
  it("请求 → 构建 → 转移后的时间线仍可校验；buildMs 与 transferMs 都有值", async () => {
    const w = fakeWorker();
    const client = createTimelineClient(() => w);
    const r = await client.load({ modelId: "qwen3-0.6b", presetId: "kv-cache", chapterId: "t" });
    expect(r.cached).toBe(false);
    expect(r.timeline.steps).toHaveLength(21);
    expect(r.timeline.preset.text).toBe("大模型推理需要显存");
    expect(r.timeline.hardwareSpec?.id).toBeTruthy();
    expect(validateTimeline(r.timeline)).toEqual([]);
    expect(r.buildMs).toBeGreaterThan(0);
    expect(r.transferMs).toBeGreaterThanOrEqual(0);
    // 转移后源端 buffer 已被剥离
    expect(r.timeline.tensors["L0.res2"]?.data?.length).toBeGreaterThan(0);
  });
  it("同一请求命中缓存，不再发消息；不同 layer 是不同键", async () => {
    const w = fakeWorker();
    const client = createTimelineClient(() => w);
    const req = { modelId: "qwen3-0.6b", presetId: "hello" };
    const a = await client.load(req);
    const b = await client.load(req);
    expect(b.cached).toBe(true);
    expect(b.timeline).toBe(a.timeline);
    expect(w.received).toHaveLength(1);
    await client.load({ ...req, layerIndex: 1 });
    expect(w.received).toHaveLength(2);
  });
  it("未知模型 / 预设在 Worker 内报错，错误回到调用方且不进缓存", async () => {
    const w = fakeWorker();
    const client = createTimelineClient(() => w);
    await expect(client.load({ modelId: "nope", presetId: "kv-cache" })).rejects.toThrow(/未知预设模型/);
    await expect(client.load({ modelId: "qwen3-0.6b", presetId: "nope" })).rejects.toThrow(/未知预设句子/);
    expect(w.received).toHaveLength(2);
    await expect(client.load({ modelId: "nope", presetId: "kv-cache" })).rejects.toThrow();
    expect(w.received).toHaveLength(3);
  });
  it("dispose 终止 Worker 并拒绝未完成的请求", async () => {
    const w = fakeWorker();
    const client = createTimelineClient(() => w);
    const p = client.load({ modelId: "qwen3-0.6b", presetId: "ascend" });
    client.dispose();
    expect(w.terminated).toBe(true);
    await expect(p).rejects.toThrow(/已释放/);
  });
  it("collectTransferables 去重共享 buffer", () => {
    const { reply } = handleTimelineMessage({
      type: "build",
      id: 1,
      req: { modelId: "qwen3-0.6b", presetId: "kv-cache" },
    });
    if (reply.type !== "done") throw new Error(reply.message);
    const buffers = collectTransferables(reply.timeline);
    expect(new Set(buffers).size).toBe(buffers.length);
    const withData = Object.values(reply.timeline.tensors).filter((t) => t.data).length;
    expect(buffers.length).toBeLessThanOrEqual(withData + 5);
    expect(buffers.length).toBeGreaterThan(10);
  });
  it("loadTimelineIntoStore：loading → ready，失败 → error；后发请求覆盖先发", async () => {
    const client = createTimelineClient(fakeWorker);
    const ok = loadTimelineIntoStore(client, { modelId: "qwen3-0.6b", presetId: "kv-cache" });
    expect(usePlayback.getState().status).toBe("loading");
    expect(await ok).toBe(true);
    expect(usePlayback.getState().status).toBe("ready");
    expect(usePlayback.getState().loadMeta?.buildMs).toBeGreaterThan(0);
    const bad = await loadTimelineIntoStore(client, { modelId: "nope", presetId: "kv-cache" });
    expect(bad).toBe(false);
    expect(usePlayback.getState().status).toBe("error");
    expect(usePlayback.getState().error).toMatch(/未知预设模型/);
    const stale = loadTimelineIntoStore(client, { modelId: "qwen3-0.6b", presetId: "ascend" });
    const fresh = loadTimelineIntoStore(client, { modelId: "qwen3-0.6b", presetId: "hello" });
    expect(await stale).toBe(false);
    expect(await fresh).toBe(true);
    expect(usePlayback.getState().timeline?.preset.id).toBe("hello");
  });
});
