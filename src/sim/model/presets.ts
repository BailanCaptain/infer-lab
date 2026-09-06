/**
 * 教学预设句子及其 token id（[S02]）。
 * id 由 scripts/gen-preset-tokens.ts 用 Qwen3 官方 tokenizer.json 离线生成（pnpm gen:presets --write），
 * 并与 @huggingface/transformers 3.x 对拍一致；tokenizer.json 不入库，来源与 SHA-256 记录在 presets.tokens.json。
 * 三个 Qwen3 预设模型共用同一份词表，所以这里的 id 对 0.6B / 8B / 30B-A3B 都有效。
 */
import data from "./presets.tokens.json";

export interface TokenPreset {
  id: string;
  /** 原句（纯文本，不套 chat 模板） */
  text: string;
  /** 教学备注 */
  note: string;
  /** 每个 id 对应的 UTF-8 片段，拼接后等于 text */
  tokens: string[];
  ids: number[];
}

export interface TokenizerSource {
  repo: string;
  file: string;
  revision: string;
  sha256: string;
  url: string;
  verifiedOn: string;
}

export const TOKENIZER_SOURCE: TokenizerSource = data.tokenizer;
export const TOKEN_PRESETS: readonly TokenPreset[] = data.presets;
export const DEFAULT_TOKEN_PRESET_ID = "kv-cache";

export function getTokenPreset(id: string = DEFAULT_TOKEN_PRESET_ID): TokenPreset {
  const p = TOKEN_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`未知预设句子 ${id}`);
  return p;
}
