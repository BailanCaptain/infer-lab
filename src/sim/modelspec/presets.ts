/**
 * 内置预设：官方 config.json 原文（2026-09-06 从 HuggingFace 拉取，[S]）。
 */

import { parseHfConfig } from "./parseHfConfig";
import qwen3_0_6b from "./presets/Qwen3-0.6B.config.json";
import qwen3_8b from "./presets/Qwen3-8B.config.json";
import qwen3_30b_a3b from "./presets/Qwen3-30B-A3B.config.json";
import type { ModelSpec } from "./types";

export interface ModelPreset {
  id: string;
  name: string;
  hfRepo: string;
  configUrl: string;
  raw: unknown;
  /** 官方公布的参数量（用于 golden 测试与页面对照）[S] */
  official: { totalParams: number; nonEmbeddingParams?: number; activatedParams?: number; source: string };
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "qwen3-0.6b",
    name: "Qwen3-0.6B",
    hfRepo: "Qwen/Qwen3-0.6B",
    configUrl: "https://huggingface.co/Qwen/Qwen3-0.6B/raw/main/config.json",
    raw: qwen3_0_6b,
    official: {
      totalParams: 0.6e9,
      nonEmbeddingParams: 0.44e9,
      source: "https://huggingface.co/Qwen/Qwen3-0.6B（模型卡：0.6B 总参数，0.44B 非 embedding）",
    },
  },
  {
    id: "qwen3-8b",
    name: "Qwen3-8B",
    hfRepo: "Qwen/Qwen3-8B",
    configUrl: "https://huggingface.co/Qwen/Qwen3-8B/raw/main/config.json",
    raw: qwen3_8b,
    official: {
      totalParams: 8.2e9,
      nonEmbeddingParams: 6.95e9,
      source: "https://huggingface.co/Qwen/Qwen3-8B（模型卡：8.2B 总参数，6.95B 非 embedding）",
    },
  },
  {
    id: "qwen3-30b-a3b",
    name: "Qwen3-30B-A3B",
    hfRepo: "Qwen/Qwen3-30B-A3B",
    configUrl: "https://huggingface.co/Qwen/Qwen3-30B-A3B/raw/main/config.json",
    raw: qwen3_30b_a3b,
    official: {
      totalParams: 30.5e9,
      activatedParams: 3.3e9,
      source: "https://huggingface.co/Qwen/Qwen3-30B-A3B（模型卡：30.5B 总参数，3.3B 激活参数）",
    },
  },
];

const cache = new Map<string, ModelSpec>();
export function getPresetSpec(id: string): ModelSpec {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = MODEL_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`未知预设模型 ${id}`);
  const spec = parseHfConfig(p.raw, { id: p.id, name: p.name, sourceUrl: p.configUrl });
  cache.set(id, spec);
  return spec;
}
export const DEFAULT_MODEL_ID = "qwen3-0.6b";
