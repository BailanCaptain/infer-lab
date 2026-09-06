import { describe, expect, it } from "vitest";
import { getPresetSpec, MODEL_PRESETS } from "../modelspec/presets";
import { DEFAULT_TOKEN_PRESET_ID, getTokenPreset, TOKEN_PRESETS, TOKENIZER_SOURCE } from "./presets";

/** tokenizer.json 里 model.vocab 的条目数；added_tokens 从这个值起编号（2026-09-06 读取原文得到）。 */
const BPE_VOCAB_SIZE = 151643;

describe("预设句子 token id（[S02]）", () => {
  it("来源信息完整：固定 revision 与 SHA-256", () => {
    expect(TOKENIZER_SOURCE.repo).toBe("Qwen/Qwen3-0.6B");
    expect(TOKENIZER_SOURCE.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(TOKENIZER_SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(TOKENIZER_SOURCE.url).toContain(TOKENIZER_SOURCE.revision);
  });
  it("默认预设存在，id 唯一，未知 id 报错", () => {
    expect(getTokenPreset().id).toBe(DEFAULT_TOKEN_PRESET_ID);
    expect(new Set(TOKEN_PRESETS.map((p) => p.id)).size).toBe(TOKEN_PRESETS.length);
    expect(() => getTokenPreset("nope")).toThrow(/未知预设句子/);
  });
  it("每句 S 在 6–8 之间，tokens 与 ids 等长，片段拼回原文", () => {
    for (const p of TOKEN_PRESETS) {
      expect(p.ids.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.ids.length, p.id).toBeLessThanOrEqual(8);
      expect(p.tokens.length, p.id).toBe(p.ids.length);
      expect(p.tokens.join(""), p.id).toBe(p.text);
      expect(p.note.length, p.id).toBeGreaterThan(0);
    }
  });
  it("所有 id 是普通 BPE 词（非特殊 token），且落在每个预设模型的词表内", () => {
    for (const p of TOKEN_PRESETS) {
      for (const id of p.ids) {
        expect(Number.isInteger(id) && id >= 0 && id < BPE_VOCAB_SIZE, `${p.id}:${id}`).toBe(true);
      }
    }
    for (const m of MODEL_PRESETS) {
      const spec = getPresetSpec(m.id);
      expect(spec.vocab).toBeGreaterThanOrEqual(BPE_VOCAB_SIZE);
    }
  });
  it("golden：与 @huggingface/transformers 对拍过的 id 不漂移", () => {
    expect(getTokenPreset("kv-cache").ids).toEqual([26288, 104949, 113272, 85106, 99580, 24360]);
    expect(getTokenPreset("ascend").ids).toEqual([119219, 100494, 105016, 96555, 100768, 108260]);
    expect(getTokenPreset("hello").ids).toEqual([108386, 3837, 99489, 6313, 100644, 104307, 104472]);
    expect(getTokenPreset("ascend").tokens.slice(0, 2)).toEqual(["昇", "腾"]);
  });
});
