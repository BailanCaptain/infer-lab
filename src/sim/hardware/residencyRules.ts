import type { HardwareUnit, OpKind, Step, TensorRecord } from "../timeline/types";

interface ResidencyRule {
  mode: "cube" | "cube-vector" | "vector" | "gather" | "view" | "copy";
  compute: HardwareUnit[];
  evidence: string[];
  explanation: string;
}
const vector: ResidencyRule = {
  mode: "vector",
  compute: ["vector"],
  evidence: ["HW-S02", "HW-S03", "HW-A03"],
  explanation: "各输入分块经 L2 搬入 UB，Vector 处理后由 UB 写回 HBM。",
};
const cube: ResidencyRule = {
  mode: "cube",
  compute: ["cube"],
  evidence: ["HW-S02", "HW-S03", "HW-A03"],
  explanation: "左、右输入经 L1 分别搬入 L0A、L0B，Cube 的结果从 L0C 经 FixPipe 写回。",
};

/** 运算映射是教学策略 [A]，各存储单元的职责另有 [S] 依据。 */
export const RESIDENCY_RULES: Record<OpKind, ResidencyRule> = {
  matmul: cube,
  pv: cube,
  scores: {
    ...cube,
    mode: "cube-vector",
    compute: ["cube", "vector"],
    explanation: "QKᵀ 在 Cube 计算，结果经 GM/L2 交换到 AIV 的 UB 做缩放后写回；不预测是否命中缓存。",
  },
  rmsnorm: vector,
  rope: vector,
  mask: vector,
  softmax: vector,
  add: vector,
  silu_mul: vector,
  gather: {
    mode: "gather",
    compute: [],
    evidence: ["HW-S03", "HW-A06", "HW-A07", "HW-A09"],
    explanation:
      "输入 id 经概念 PCIe 连接进入 HBM；仅展示选中词表行的数据访问，不指定查表计算核，不搬整张词表。",
  },
  merge: {
    mode: "view",
    compute: ["host"],
    evidence: ["HW-A07"],
    explanation: "当前实现共享原数据，仅更新形状视图；驻留保持一致，零张量搬运，不启动计算单元。",
  },
  kv_write: {
    mode: "copy",
    compute: [],
    evidence: ["HW-S03", "HW-A07"],
    explanation: "K、V 经 UB 中转，合并为教学缓存块并写入 HBM KV 区；章末展示不表示真实 kernel 写回顺序。",
  },
};

export const MAPPING_EVIDENCE = ["HW-A02", "HW-A04", "HW-A05"];
export const MAPPING_NOTE =
  "主要驻留指后备存储，片上只暂存分块副本；字节为逻辑数据量，路径中的 L2 不保证命中。";

/** 使用完整 lineage，不能只看 op.a/op.out（Q/K norm 和 RoPE 有双输出）。 */
export function stepIO(step: Step, tensors: Record<string, TensorRecord>) {
  const op = step.model.op;
  if (!op || !Object.hasOwn(RESIDENCY_RULES, op.kind)) throw new Error(`${step.id} 缺少或不支持算子`);
  const inputs = [...new Set(step.model.lineage.flatMap((l) => l.from))];
  const outputs = [...new Set(step.model.lineage.map((l) => l.out))];
  if (!inputs.length || !outputs.length) throw new Error(`${step.id} lineage 不完整`);
  for (const id of [...step.model.tensors, ...inputs, ...outputs]) {
    const tensor = tensors[id];
    if (!tensor || !Object.hasOwn(tensors, id) || !step.model.tensors.includes(id))
      throw new Error(`${step.id} 张量未登记或不在本步：${id}`);
    if (!Number.isSafeInteger(tensor.bytes) || tensor.bytes <= 0)
      throw new Error(`${step.id} 张量字节无效：${id}`);
  }
  if (
    !inputs.includes(op.a) ||
    (op.b && !inputs.includes(op.b)) ||
    !outputs.includes(op.out) ||
    inputs.some((id) => outputs.includes(id))
  )
    throw new Error(`${step.id} op 与 lineage 不一致`);
  const rule = RESIDENCY_RULES[op.kind];
  const matrix = rule.mode === "cube" || rule.mode === "cube-vector";
  if (matrix && (!op.b || inputs.length !== 2 || outputs.length !== 1))
    throw new Error(`${step.id} 矩阵步需要两个输入和一个输出`);
  if (
    rule.mode === "gather" &&
    (inputs.length !== 2 ||
      outputs.length !== 1 ||
      tensors[op.a]!.role !== "weight" ||
      !inputs.some((id) => tensors[id]!.role === "input"))
  )
    throw new Error(`${step.id} gather 需要 id、词表和一个输出`);
  if (
    rule.mode === "view" &&
    (inputs.length !== 1 ||
      outputs.length !== 1 ||
      tensors[inputs[0]!]!.data !== tensors[outputs[0]!]!.data ||
      !tensors[inputs[0]!]!.data)
  )
    throw new Error(`${step.id} merge 不是共享数据视图`);
  return { rule, inputs: matrix ? [op.a, op.b!] : inputs, outputs };
}
