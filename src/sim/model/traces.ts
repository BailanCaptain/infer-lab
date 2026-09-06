/**
 * 真实 token 生成 trace：由 `pnpm gen:trace` 用 transformers.js 跑真正的 Qwen3-0.6B（ONNX）离线生成，
 * 记录每句预设贪心续写时每一步的 top-k 下一 token 概率。`[M]` 实测数据，来源字段在每份 trace 的 source 里。
 * 这些文件是生成物：改预设句子或模型后重跑脚本，不要手改。
 */
import ascend from "./traces/ascend.trace.json";
import hello from "./traces/hello.trace.json";
import kvCache from "./traces/kv-cache.trace.json";

export interface TraceCandidate {
  id: number;
  token: string;
  prob: number;
}

export interface TraceStep {
  /** 生成第几个新 token（0 = 紧接输入之后） */
  index: number;
  /** 此时的上下文长度（含已生成） */
  contextLength: number;
  topK: TraceCandidate[];
  chosen: TraceCandidate;
  /** 分布熵（nat） */
  entropy: number;
}

export interface GenerationTrace {
  presetId: string;
  inputText: string;
  inputIds: number[];
  generatedIds: number[];
  generatedText: string;
  steps: TraceStep[];
  source: {
    repo: string;
    revision: string;
    baseModel: string;
    dtype: string;
    decoding: "greedy";
    library: string;
    generatedAt: string;
    note: string;
  };
}

export const GENERATION_TRACES: readonly GenerationTrace[] = [
  kvCache as GenerationTrace,
  ascend as GenerationTrace,
  hello as GenerationTrace,
];

export function getTrace(presetId: string): GenerationTrace | undefined {
  return GENERATION_TRACES.find((t) => t.presetId === presetId);
}
