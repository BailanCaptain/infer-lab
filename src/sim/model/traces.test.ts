import { describe, expect, it } from "vitest";
import { TOKEN_PRESETS } from "./presets";
import { GENERATION_TRACES, getTrace } from "./traces";

describe("真实生成 trace（Qwen3-0.6B ONNX 离线实测）", () => {
  it("三句预设各有一份 trace，输入 id 与预设逐个一致", () => {
    expect(GENERATION_TRACES).toHaveLength(3);
    for (const p of TOKEN_PRESETS) {
      const t = getTrace(p.id);
      expect(t, p.id).toBeDefined();
      expect(t?.inputIds).toEqual(p.ids);
      expect(t?.inputText).toBe(p.text);
    }
  });

  it("每步 top-k 按概率降序、总和 ≤ 1、贪心选中即第一名，上下文长度逐步 +1", () => {
    for (const t of GENERATION_TRACES) {
      expect(t.steps.length).toBeGreaterThanOrEqual(8);
      t.steps.forEach((s, i) => {
        expect(s.index).toBe(i);
        expect(s.contextLength).toBe(t.inputIds.length + i);
        expect(s.topK.length).toBeGreaterThanOrEqual(5);
        for (let j = 1; j < s.topK.length; j++)
          expect(s.topK[j]!.prob).toBeLessThanOrEqual(s.topK[j - 1]!.prob);
        const sum = s.topK.reduce((a, c) => a + c.prob, 0);
        expect(sum).toBeLessThanOrEqual(1 + 1e-6);
        expect(s.chosen.id).toBe(s.topK[0]!.id);
        expect(s.chosen.prob).toBeGreaterThan(0);
        expect(s.entropy).toBeGreaterThanOrEqual(0);
      });
      expect(t.generatedIds).toEqual(t.steps.map((s) => s.chosen.id));
    }
  });

  it("来源可追溯：仓库、revision、dtype、解码方式、生成时间", () => {
    for (const t of GENERATION_TRACES) {
      expect(t.source.repo).toBe("onnx-community/Qwen3-0.6B-ONNX");
      expect(t.source.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(t.source.baseModel).toBe("Qwen/Qwen3-0.6B");
      expect(["q8", "fp32"]).toContain(t.source.dtype);
      expect(t.source.decoding).toBe("greedy");
      expect(Number.isNaN(Date.parse(t.source.generatedAt))).toBe(false);
      expect(t.source.note.length).toBeGreaterThan(0);
    }
  });

  it("token id 都在 Qwen3 普通词表内（< 151643）", () => {
    for (const t of GENERATION_TRACES)
      for (const s of t.steps) for (const c of s.topK) expect(c.id).toBeLessThan(151643);
  });
});
