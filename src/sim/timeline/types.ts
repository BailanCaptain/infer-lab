/**
 * Step 是唯一真相源：表现层与 DOM 面板只读 Step，不各自推导。
 * camera / beats 字段暂无消费者（表现层重建后会用到），保留。
 */
import type { NpuSpec } from "../hardware/spec";
import type { LazyWeight } from "../weights";

export type TensorId = string;

export type TensorRole = "input" | "weight" | "activation" | "kv" | "scores" | "output";

export interface TensorRecord {
  id: TensorId;
  /** 教学名，如 "X（输入激活）" */
  name: string;
  shape: number[];
  dims: string[];
  role: TensorRole;
  /** 稠密数据（激活等小张量） */
  data?: Float32Array;
  /** 惰性权重（大矩阵）：显示层用 weightAt 随机访问 */
  lazy?: LazyWeight;
  /** 惰性权重的下采样缩略图 */
  thumb?: { rows: number; cols: number; data: Float32Array };
  /** 按 dtype 估算的字节数 */
  bytes: number;
  /** 值域，用于着色 */
  absMax: number;
}

export type Location =
  | { k: "hostDram" }
  | { k: "hbm"; slot: number; region: "weight" | "kv" | "act" }
  | { k: "l2" }
  | { k: "l1" | "l0a" | "l0b" | "l0c" | "ub" | "pcie" }
  | { k: "cube" }
  | { k: "vector" }
  | { k: "link"; from: string; to: string };

export type OpKind =
  | "gather"
  | "rmsnorm"
  | "matmul"
  | "rope"
  | "scores"
  | "mask"
  | "softmax"
  | "pv"
  | "merge"
  | "add"
  | "silu_mul"
  | "kv_write";

export interface Highlight {
  tensor: TensorId;
  rows?: number[];
  cols?: number[];
  head?: number;
  cells?: [number, number][];
}

export interface Lineage {
  out: TensorId;
  from: TensorId[];
  /** 例如 "[S,H] · [H,n_q·d_h] → [S,n_q·d_h]" */
  expr: string;
}

export interface Transfer {
  tensor: TensorId;
  from: Location;
  to: Location;
  /** 本次逻辑数据量，不是实测总线流量；分块细节折叠，重复路径不能直接用于性能估算。 */
  bytes: number;
  /** 为什么搬（中文，≤30 字） */
  reason: string;
}

export type HardwareUnit =
  | "cube"
  | "vector"
  | "hbm"
  | "l2"
  | "hccs"
  | "host"
  | "mte1"
  | "mte2"
  | "mte3"
  | "fixpipe";

export interface Step {
  /** 稳定 id，可进 URL，如 "L0.attn.q" */
  id: string;
  /** ≤ 14 字 */
  title: string;
  narration: {
    /** ≤ 40 字，字幕 */
    brief: string;
    /** 右栏完整解释 */
    detail: string;
    formula?: string;
  };
  /** 步内子节拍，at ∈ [0,1] 单调 */
  beats?: { at: number; label: string }[];
  /** 1× 倍速下本步过渡时长（ms）；缺省用播放引擎的 STEP_TWEEN_MS。有逐格动效的步要长一些。 */
  durationMs?: number;
  model: {
    tensors: TensorId[];
    highlight: Highlight[];
    op?: { kind: OpKind; a: TensorId; b?: TensorId; out: TensorId };
    lineage: Lineage[];
  };
  hardware: {
    /** 填充后对应 Timeline.hardwareSpec；未映射的纯模型步骤不设置。 */
    specId?: string;
    /** 解释逻辑搬运、视图变换与教学简化，不作为 kernel trace。 */
    explanation?: string;
    /** 张量的主要存储位置。读入片上副本不会改变此位置，不表示步内所有副本。 */
    residency: Record<TensorId, Location>;
    transfers: Transfer[];
    active: HardwareUnit[];
  };
  camera: { view: string; pos?: [number, number, number]; target?: [number, number, number] };
  /** 证据编号 ['S03','C02'] */
  evidence: string[];
  /** 术语 id */
  terms: string[];
}

export interface Timeline {
  /** 存在时 validateTimeline 强制验证每一步的硬件完整性。 */
  hardwareSpec?: NpuSpec;
  chapterId: string;
  modelId: string;
  modelName: string;
  preset: { id: string; text: string; tokens: string[]; ids: number[] };
  layerIndex: number;
  tensors: Record<TensorId, TensorRecord>;
  steps: Step[];
  /** 生成耗时（ms），用于性能观察 */
  buildMs: number;
}
