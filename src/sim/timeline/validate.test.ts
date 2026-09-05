import { describe, expect, it } from "vitest";
import type { Step, TensorRecord, Timeline } from "./types";
import { validateTimeline } from "./validate";

function rec(id: string, shape: number[], dims: string[]): TensorRecord {
  return { id, name: id, shape, dims, role: "activation", bytes: 0, absMax: 0 };
}

function step(over: Partial<Step> & { id: string }): Step {
  return {
    title: "t",
    narration: { brief: "b", detail: "d" },
    model: { tensors: [], highlight: [], lineage: [] },
    hardware: { residency: {}, transfers: [], active: [] },
    camera: { view: "v" },
    evidence: ["S01"],
    terms: [],
    ...over,
  };
}

function tl(tensors: TensorRecord[], steps: Step[]): Timeline {
  return {
    chapterId: "t",
    modelId: "m",
    modelName: "m",
    preset: { id: "p", text: "", tokens: [], ids: [] },
    layerIndex: 0,
    tensors: Object.fromEntries(tensors.map((t) => [t.id, t])),
    steps,
    buildMs: 0,
  };
}

describe("validateTimeline 高亮越界", () => {
  const scores = rec("scores", [4, 5, 5], ["n_q", "S", "S_k"]); // 4 头，S=5
  const q = rec("q", [5, 4, 8], ["S", "n_q", "d_h"]);
  const x = rec("x", [5, 32], ["S", "H"]);

  it("带 head 的高亮：rows 指头内的 S 维，而不是头数", () => {
    const ok = tl(
      [scores, q],
      [
        step({
          id: "a",
          model: {
            tensors: ["scores", "q"],
            highlight: [
              { tensor: "scores", head: 3, rows: [4], cols: [4] },
              { tensor: "q", head: 3, rows: [4], cols: [7] },
            ],
            lineage: [],
          },
        }),
      ],
    );
    expect(validateTimeline(ok)).toEqual([]);
  });
  it("head 越界、head 内行列越界、无头维却指定 head 都报 issue", () => {
    const bad = tl(
      [scores, x],
      [
        step({
          id: "a",
          model: {
            tensors: ["scores", "x"],
            highlight: [
              { tensor: "scores", head: 4, rows: [0] },
              { tensor: "scores", head: 0, rows: [5] },
              { tensor: "scores", head: 0, cols: [5] },
              { tensor: "x", head: 0 },
            ],
            lineage: [],
          },
        }),
      ],
    );
    expect(validateTimeline(bad).map((i) => i.message)).toEqual([
      "高亮 head 越界：scores",
      "高亮行越界：scores",
      "高亮列越界：scores",
      "高亮指定 head 但张量无头维：x",
    ]);
  });
  it("不带 head：rows 按第一维、cols 按最后一维", () => {
    const t = tl(
      [x],
      [
        step({
          id: "a",
          model: {
            tensors: ["x"],
            highlight: [
              { tensor: "x", rows: [5] },
              { tensor: "x", cols: [31] },
            ],
            lineage: [],
          },
        }),
      ],
    );
    expect(validateTimeline(t).map((i) => i.message)).toEqual(["高亮行越界：x"]);
  });
});
