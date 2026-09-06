import type { Location, Step, TensorRecord, Timeline, Transfer } from "../timeline/types";
import { assertValid } from "../timeline/validate";
import { MAPPING_EVIDENCE, MAPPING_NOTE, stepIO } from "./residencyRules";
import { NPU_910B, type NpuSpec, tensorHome, validateNpuSpec } from "./spec";
import { activeUnits, validateHardwareStep } from "./validate";

/** 纯函数；第三个参数提供 shape/dtype 派生的字节，Step 本身只存张量 id。 */
export function mapResidency(step: Step, spec: NpuSpec, tensors: Record<string, TensorRecord>): Step {
  const specIssues = validateNpuSpec(spec);
  if (specIssues.length) throw new Error(specIssues.join("\n"));
  const { rule, inputs, outputs } = stepIO(step, tensors);
  // stepIO 已验证所有引用与字节数，下方只使用这些 id。
  const residency = Object.fromEntries(step.model.tensors.map((id) => [id, tensorHome(tensors[id]!, spec)]));
  const home = (id: string) => residency[id]!;
  const transfers: Transfer[] = [];
  const path = (id: string, locations: Location[], reason: string) => {
    for (let i = 1; i < locations.length; i++)
      transfers.push({
        tensor: id,
        from: locations[i - 1]!,
        to: locations[i]!,
        bytes: tensors[id]!.bytes,
        reason,
      });
  };
  const l2: Location = { k: "l2" };
  const ub: Location = { k: "ub" };
  if (rule.mode === "gather") {
    const ids = inputs.find((id) => tensors[id]!.role === "input")!;
    const table = step.model.op!.a;
    path(ids, [{ k: "hostDram" }, { k: "pcie" }, home(ids), l2, ub], "输入 id 进入设备并用于查表");
    const output = outputs[0]!;
    path(output, [home(table), l2, ub, l2, home(output)], "仅搬所选词表行，按输出大小计量");
  } else if (rule.mode !== "view") {
    for (const [i, id] of inputs.entries()) {
      const local: Location[] = rule.mode.startsWith("cube")
        ? [{ k: "l1" }, { k: i === 0 ? "l0a" : "l0b" }]
        : [ub];
      path(id, [home(id), l2, ...local], "将输入分块读入局部缓冲");
    }
    for (const id of outputs) {
      const local: Location[] =
        rule.mode === "cube-vector"
          ? [{ k: "l0c" }, l2, ub, l2]
          : [rule.mode === "cube" ? { k: "l0c" } : ub, l2];
      path(
        id,
        [...local, home(id)],
        tensors[id]!.role === "kv" ? "本层 K/V 写入逻辑缓存区" : "结果从局部缓冲写回主要存储",
      );
    }
  }
  const mapped: Step = {
    ...step,
    hardware: {
      specId: spec.id,
      explanation: `${rule.explanation}${MAPPING_NOTE}`,
      residency,
      transfers,
      active: activeUnits(transfers, rule.compute, spec),
    },
    evidence: [...new Set([...step.evidence, ...spec.evidence, ...MAPPING_EVIDENCE, ...rule.evidence])],
  };
  const issues = validateHardwareStep(mapped, tensors, spec);
  if (issues.length) throw new Error(`${step.id}: ${issues.join("\n")}`);
  return mapped;
}

/** 保留模型表与数值引用，只替换步骤；可重复映射，不累加证据或修改原时间线。 */
export function mapTimelineResidency(timeline: Timeline, spec = NPU_910B): Timeline {
  assertValid(timeline);
  const mapped = {
    ...timeline,
    hardwareSpec: spec,
    steps: timeline.steps.map((s) => mapResidency(s, spec, timeline.tensors)),
  };
  assertValid(mapped);
  return mapped;
}
