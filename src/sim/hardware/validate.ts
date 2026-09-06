import { FORWARD_CLAIMS } from "../model/claims";
import type { HardwareUnit, Location, Step, TensorRecord, Transfer } from "../timeline/types";
import { HARDWARE_CLAIMS } from "./claims";
import { MAPPING_EVIDENCE, stepIO } from "./residencyRules";
import { locationAnchor, type NpuSpec, tensorHome } from "./spec";

function sameLocation(a: Location, b: Location): boolean {
  return (
    locationAnchor(a) === locationAnchor(b) && (a.k !== "hbm" || (b.k === "hbm" && a.region === b.region))
  );
}

/** 活跃搬运单元从 spec 路径推导，避免另一套路径/单元映射。 */
export function activeUnits(transfers: Transfer[], compute: HardwareUnit[], spec: NpuSpec): HardwareUnit[] {
  const units = new Set<HardwareUnit>(compute);
  for (const tr of transfers) {
    for (const location of [tr.from, tr.to]) {
      if (location.k === "hbm" || location.k === "l2") units.add(location.k);
      if (location.k === "hostDram" || location.k === "pcie") units.add("host");
    }
    const route = spec.routes.find(
      (r) => r.from === locationAnchor(tr.from) && r.to === locationAnchor(tr.to),
    );
    if (route?.engine) units.add(route.engine);
  }
  return [...units];
}

export function validateHardwareStep(
  step: Step,
  tensors: Record<string, TensorRecord>,
  spec: NpuSpec,
): string[] {
  const errors: string[] = [];
  const hw = step.hardware;
  if (hw.specId !== spec.id) errors.push("硬件 specId 不一致或缺失");
  if (!hw.explanation?.trim()) errors.push("硬件解释缺失");
  const checkLocation = (loc: Location, label: string) => {
    if (!spec.anchors[locationAnchor(loc)]) errors.push(`${label} 锚点不存在`);
    if (
      loc.k === "hbm" &&
      (!spec.hbmSlots.includes(loc.slot) || !["weight", "act", "kv"].includes(loc.region))
    )
      errors.push(`${label} HBM 槽位或区域无效`);
    if (loc.k === "cube" || loc.k === "vector") errors.push(`${label} 计算单元不能作为存储落点`);
  };
  for (const id of step.model.tensors) {
    const home = hw.residency[id];
    if (!home) {
      errors.push(`张量无主要驻留：${id}`);
      continue;
    }
    const tensor = tensors[id];
    if (!tensor || !sameLocation(home, tensorHome(tensor, spec))) errors.push(`张量主要驻留区域错误：${id}`);
  }
  for (const [id, home] of Object.entries(hw.residency)) {
    if (!Object.hasOwn(tensors, id) || !step.model.tensors.includes(id))
      errors.push(`驻留张量不在本步：${id}`);
    checkLocation(home, `驻留 ${id}`);
  }
  const chains = new Map<string, Transfer[]>();
  for (const tr of hw.transfers) {
    if (!step.model.tensors.includes(tr.tensor)) errors.push(`搬运张量不在本步：${tr.tensor}`);
    if (!Number.isSafeInteger(tr.bytes) || tr.bytes <= 0 || tr.bytes !== tensors[tr.tensor]?.bytes)
      errors.push(`搬运字节不一致：${tr.tensor}`);
    if (!tr.reason.trim() || tr.reason.length > 30) errors.push(`搬运说明无效：${tr.tensor}`);
    checkLocation(tr.from, "搬运起点");
    checkLocation(tr.to, "搬运终点");
    if (!spec.routes.some((r) => r.from === locationAnchor(tr.from) && r.to === locationAnchor(tr.to)))
      errors.push(`非法搬运路径：${locationAnchor(tr.from)}→${locationAnchor(tr.to)}`);
    const chain = chains.get(tr.tensor) ?? [];
    if (chain.length && !sameLocation(chain[chain.length - 1]!.to, tr.from))
      errors.push(`搬运路径不连续：${tr.tensor}`);
    chain.push(tr);
    chains.set(tr.tensor, chain);
  }
  for (const id of step.evidence)
    if (!Object.hasOwn(FORWARD_CLAIMS, id) && !Object.hasOwn(HARDWARE_CLAIMS, id))
      errors.push(`证据未注册：${id}`);
  try {
    const { rule, inputs, outputs } = stepIO(step, tensors);
    for (const id of [...spec.evidence, ...MAPPING_EVIDENCE, ...rule.evidence])
      if (!step.evidence.includes(id)) errors.push(`缺硬件证据：${id}`);
    const expectedActive = activeUnits(hw.transfers, rule.compute, spec);
    if (
      new Set(hw.active).size !== hw.active.length ||
      expectedActive.length !== hw.active.length ||
      expectedActive.some((u) => !hw.active.includes(u))
    )
      errors.push("活跃单元不完整或与路径不符");
    for (const u of hw.active) if (!spec.units[u]) errors.push(`硬件单元未定义：${u}`);
    if (rule.mode === "view") {
      if (hw.transfers.length) errors.push("共享数据视图不应搬运");
    } else {
      const table = rule.mode === "gather" ? step.model.op!.a : undefined;
      for (const [i, id] of inputs.entries()) {
        if (id === table) {
          if (chains.has(id)) errors.push("查表不应搬运完整词表");
          continue;
        }
        const chain = chains.get(id);
        const start: Location | undefined = rule.mode === "gather" ? { k: "hostDram" } : hw.residency[id];
        const end = rule.mode.startsWith("cube") ? (i === 0 ? "l0a" : "l0b") : "ub";
        if (!chain?.length || !start || !sameLocation(chain[0]!.from, start) || chain.at(-1)?.to.k !== end)
          errors.push(`输入搬运不完整：${id}`);
      }
      for (const id of outputs) {
        const chain = chains.get(id);
        const start: Location | undefined = table
          ? hw.residency[table]
          : { k: rule.mode.startsWith("cube") ? "l0c" : "ub" };
        const end = hw.residency[id];
        if (
          !chain?.length ||
          !start ||
          !end ||
          !sameLocation(chain[0]!.from, start) ||
          !sameLocation(chain[chain.length - 1]!.to, end)
        )
          errors.push(`输出搬运不完整：${id}`);
        if (rule.mode === "cube-vector" && !chain?.some((tr) => tr.to.k === "ub"))
          errors.push(`缩放缺少 UB 中转：${id}`);
        if (table && !chain?.some((tr) => tr.to.k === "ub")) errors.push(`查表缺少 UB 中转：${id}`);
      }
      for (const id of chains.keys())
        if (!inputs.includes(id) && !outputs.includes(id)) errors.push(`无关搬运：${id}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}
