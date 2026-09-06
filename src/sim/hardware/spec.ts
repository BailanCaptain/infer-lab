import type { HardwareUnit, Location, TensorRecord } from "../timeline/types";
import { HARDWARE_CLAIMS } from "./claims";

type Vec3 = [number, number, number];
export interface PartSpec {
  id: string;
  label: string;
  kind: "memory" | "compute" | "engine" | "port" | "host";
  pos: Vec3;
  size: Vec3;
  evidence: string[];
}

export interface NpuSpec {
  id: string;
  name: string;
  representation: "conceptual";
  physical: { hbmStacks: number | null; hccsLanes: number | null };
  parts: PartSpec[];
  anchors: Record<string, { part: string; local: Vec3 }>;
  /** HBM 槽位均为展示分区，物理数量见 physical。 */
  hbmSlots: number[];
  regions: Record<"weight" | "act" | "kv", number>;
  /** 可用于逻辑传输的边；计算单元不作为存储落点。 */
  routes: { from: string; to: string; engine?: HardwareUnit }[];
  units: Partial<Record<HardwareUnit, string[]>>;
  evidence: string[];
}

const part = (
  id: string,
  label: string,
  kind: PartSpec["kind"],
  pos: Vec3,
  evidence: string[],
): PartSpec => ({
  id,
  label,
  kind,
  pos,
  size: [1, 0.4, 0.7],
  evidence,
});
const hbmSlots = [0, 1, 2, 3];
const parts: PartSpec[] = [
  part("host", "Host / DRAM", "host", [-5, 0, 0], ["HW-A06"]),
  part("pcie", "PCIe（概念连接）", "port", [-4, 0, 0], ["HW-A06"]),
  ...hbmSlots.map((slot) =>
    part(`hbm[${slot}]`, `HBM 展示区 ${slot}`, "memory", [-2.5, 0, slot - 1.5], ["HW-S05", "HW-A01"]),
  ),
  part("l2", "核外 L2", "memory", [-1, 0, 0], ["HW-S04"]),
  part("l1", "AIC / L1", "memory", [0, 0, -1], ["HW-S03"]),
  part("l0a", "L0A", "memory", [1, 0, -1.5], ["HW-S03"]),
  part("l0b", "L0B", "memory", [1, 0, -0.5], ["HW-S03"]),
  part("cube", "Cube", "compute", [2, 0, -1], ["HW-S02"]),
  part("l0c", "L0C", "memory", [3, 0, -1], ["HW-S03"]),
  part("fixpipe", "FixPipe", "engine", [3, 0, -2], ["HW-S03"]),
  part("ub", "AIV / UB", "memory", [0, 0, 1.5], ["HW-S03"]),
  part("vector", "Vector", "compute", [1.5, 0, 1.5], ["HW-S02"]),
  part("aic.scalar", "AIC Scalar", "compute", [2, 0, -2.5], ["HW-S01", "HW-S02"]),
  part("aiv.scalar", "AIV Scalar", "compute", [2, 0, 2.5], ["HW-S01", "HW-S02"]),
  ...["mte1", "mte2", "mte3"].map((id, i) => part(id, id.toUpperCase(), "engine", [i, -1, 0], ["HW-S03"])),
  ...Array.from({ length: 7 }, (_, i) =>
    part(`hccs[${i}]`, `HCCS 邻居 ${i}`, "port", [i - 3, 0, 4], ["HW-D01", "HW-A08"]),
  ),
];

export const NPU_910B: NpuSpec = {
  id: "ascend-910b-conceptual-v1",
  name: "昇腾 910B / Atlas A2（概念剖面）",
  representation: "conceptual",
  physical: { hbmStacks: null, hccsLanes: null },
  parts,
  anchors: Object.fromEntries(parts.map((p) => [p.id, { part: p.id, local: [0, 0, 0] as Vec3 }])),
  hbmSlots,
  regions: { weight: 0, act: 1, kv: 2 },
  routes: [
    { from: "host", to: "pcie" },
    ...hbmSlots.flatMap((slot) => [
      { from: "pcie", to: `hbm[${slot}]` },
      { from: `hbm[${slot}]`, to: "l2" },
      { from: "l2", to: `hbm[${slot}]` },
    ]),
    { from: "l2", to: "l1", engine: "mte2" },
    { from: "l1", to: "l0a", engine: "mte1" },
    { from: "l1", to: "l0b", engine: "mte1" },
    { from: "l2", to: "ub", engine: "mte2" },
    { from: "ub", to: "l2", engine: "mte3" },
    { from: "l0c", to: "l2", engine: "fixpipe" },
  ],
  units: {
    host: ["host"],
    hbm: hbmSlots.map((s) => `hbm[${s}]`),
    l2: ["l2"],
    cube: ["cube"],
    vector: ["vector"],
    mte1: ["mte1"],
    mte2: ["mte2"],
    mte3: ["mte3"],
    fixpipe: ["fixpipe"],
    hccs: parts.filter((p) => p.id.startsWith("hccs[")).map((p) => p.id),
  },
  evidence: ["HW-S01", "HW-S03", "HW-S04", "HW-S05", "HW-D01", "HW-A01", "HW-A04", "HW-A06", "HW-A08"],
};

/** 同一位置约定供校验和之后的 AnchorRegistry 复用。 */
export function locationAnchor(location: Location): string {
  if (location.k === "hbm") return `hbm[${location.slot}]`;
  if (location.k === "hostDram") return "host";
  if (location.k === "link") return `${location.from}->${location.to}`;
  return location.k;
}

export function tensorHome(tensor: TensorRecord, spec: NpuSpec): Location {
  const region = tensor.role === "weight" ? "weight" : tensor.role === "kv" ? "kv" : "act";
  return { k: "hbm", slot: spec.regions[region], region };
}

export function validateNpuSpec(spec: NpuSpec): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const p of spec.parts) {
    if (ids.has(p.id)) errors.push(`部件 id 重复：${p.id}`);
    ids.add(p.id);
    if (
      p.pos.length !== 3 ||
      !p.pos.every(Number.isFinite) ||
      p.size.length !== 3 ||
      !p.size.every((v) => Number.isFinite(v) && v > 0)
    )
      errors.push(`部件几何无效：${p.id}`);
  }
  for (const [id, a] of Object.entries(spec.anchors))
    if (!ids.has(a.part) || a.local.length !== 3 || !a.local.every(Number.isFinite))
      errors.push(`锚点无效：${id}`);
  if (!spec.hbmSlots.length || new Set(spec.hbmSlots).size !== spec.hbmSlots.length)
    errors.push("HBM 槽位为空或重复");
  for (const slot of spec.hbmSlots)
    if (!Number.isInteger(slot) || slot < 0 || !spec.anchors[`hbm[${slot}]`])
      errors.push(`HBM 槽位无效：${slot}`);
  for (const [region, slot] of Object.entries(spec.regions))
    if (!spec.hbmSlots.includes(slot)) errors.push(`区域 ${region} 的槽位无效：${slot}`);
  for (const [unit, anchors] of Object.entries(spec.units))
    if (!anchors.length || anchors.some((id) => !spec.anchors[id])) errors.push(`单元锚点无效：${unit}`);
  for (const r of spec.routes)
    if (!spec.anchors[r.from] || !spec.anchors[r.to] || (r.engine && !spec.units[r.engine]))
      errors.push(`搬运路径无效：${r.from}→${r.to}`);
  for (const id of [...spec.evidence, ...spec.parts.flatMap((p) => p.evidence)])
    if (!Object.hasOwn(HARDWARE_CLAIMS, id)) errors.push(`硬件证据未注册：${id}`);
  return errors;
}
