import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CacheReadout } from "./CacheReadout";
import { InferenceReadout } from "./InferenceReadout";
import { INFERENCE_LESSONS, inferenceFrame } from "./scene-inference";

describe("KV cache and AI Core scene teaching contracts", () => {
  // KV 讲解按 GPT 11-11 连续版：写入阶段列 1–3 步，共享与释放阶段列 4–6 步。
  it("lists the writing steps first, then the sharing and release steps", () => {
    const stages = INFERENCE_LESSONS[1].stages;
    const startHtml = renderToStaticMarkup(createElement(CacheReadout, { progress: 0.02, onSeek: () => {} }));
    for (const stage of stages.slice(0, 3)) expect(startHtml).toContain(stage);
    expect(startHtml).not.toContain(stages[3]);
    expect(startHtml).toContain("一次生成任务是一条请求");
    expect(startHtml).toContain("块表记地址，显存块放数据");
    expect(startHtml).not.toMatch(/R[12]/);

    const releaseAHtml = renderToStaticMarkup(
      createElement(CacheReadout, { progress: 4.95 / 6, onSeek: () => {} }),
    );
    for (const stage of stages.slice(3)) expect(releaseAHtml).toContain(stage);
    expect(releaseAHtml).toContain("个请求正在用块 7");

    const releaseBHtml = renderToStaticMarkup(createElement(CacheReadout, { progress: 1, onSeek: () => {} }));
    expect(releaseBHtml).toContain("再分配");
  });

  it("tightens AI Core timeline to 32s with immediate motion and exact handoff landing", () => {
    expect(INFERENCE_LESSONS[3].seconds).toBe(32);
    expect(inferenceFrame(3, 0.09 / 8).travel).toBeGreaterThan(0);
    expect(inferenceFrame(3, 6.64 / 8).landed).toBe(false);
    expect(inferenceFrame(3, 6.66 / 8).landed).toBe(true);

    const coreHtml = renderToStaticMarkup(
      createElement(InferenceReadout, { kind: 3, progress: 1, onSeek: () => {} }),
    );
    expect(coreHtml).not.toContain("图中长条表示计算单元");
    expect(coreHtml).toContain("[5, 0] 已写回");
  });
});
