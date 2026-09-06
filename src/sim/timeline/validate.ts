import { validateNpuSpec } from "../hardware/spec";
import { validateHardwareStep } from "../hardware/validate";
import type { Step, Timeline } from "./types";

/** 教学维度名中表示「头」的符号（见 tensor.ts 的 dims 约定） */
const HEAD_DIMS = new Set(["n_q", "n_kv"]);

export interface ValidationIssue {
  step: string;
  message: string;
}

/**
 * 时间轴不变量：这是「两层同步」的机械校验。
 * - step id 唯一；引用的张量都已登记；高亮行列在 shape 内
 * - 每步 evidence 非空；beats.at 单调递增且在 [0,1]
 * - transfers 引用的张量在本步 residency 中有落点
 * - matmul lineage 的维度可乘
 * - hardwareSpec 存在时：驻留/路径/字节/证据/活跃单元完整，否则只接受空硬件数据
 */
export function validateTimeline(tl: Timeline): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (tl.hardwareSpec)
    for (const message of validateNpuSpec(tl.hardwareSpec)) issues.push({ step: "hardwareSpec", message });
  const ids = new Set<string>();
  for (const s of tl.steps) {
    if (tl.hardwareSpec) {
      for (const message of validateHardwareStep(s, tl.tensors, tl.hardwareSpec))
        issues.push({ step: s.id, message });
    } else if (
      s.hardware.specId ||
      s.hardware.transfers.length ||
      Object.keys(s.hardware.residency).length ||
      s.hardware.active.length
    ) {
      issues.push({ step: s.id, message: "硬件数据缺少 Timeline.hardwareSpec" });
    }
    if (ids.has(s.id)) issues.push({ step: s.id, message: "step id 重复" });
    ids.add(s.id);
    if (s.title.length > 14) issues.push({ step: s.id, message: `title 超过 14 字：${s.title.length}` });
    if (s.narration.brief.length > 40)
      issues.push({ step: s.id, message: `brief 超过 40 字：${s.narration.brief.length}` });
    if (s.evidence.length === 0) issues.push({ step: s.id, message: "evidence 为空" });
    for (const t of s.model.tensors)
      if (!tl.tensors[t]) issues.push({ step: s.id, message: `张量未登记：${t}` });
    for (const h of s.model.highlight) {
      const rec = tl.tensors[h.tensor];
      if (!rec) {
        issues.push({ step: s.id, message: `高亮张量未登记：${h.tensor}` });
        continue;
      }
      // 带 head 的高亮：rows/cols 指头内的二维（跳过头维），头维本身另行越界检查
      const headIdx = h.head === undefined ? -1 : rec.dims.findIndex((dn) => HEAD_DIMS.has(dn));
      if (h.head !== undefined) {
        if (headIdx < 0) issues.push({ step: s.id, message: `高亮指定 head 但张量无头维：${h.tensor}` });
        else if (h.head < 0 || h.head >= (rec.shape[headIdx] ?? 0))
          issues.push({ step: s.id, message: `高亮 head 越界：${h.tensor}` });
      }
      const axes = rec.shape.map((_, i) => i).filter((i) => i !== headIdx);
      const rows = rec.shape[axes[0] ?? 0] ?? 0;
      const cols = rec.shape[axes[axes.length - 1] ?? 0] ?? 0;
      if (h.rows?.some((r) => r < 0 || r >= rows))
        issues.push({ step: s.id, message: `高亮行越界：${h.tensor}` });
      if (h.cols?.some((c) => c < 0 || c >= cols))
        issues.push({ step: s.id, message: `高亮列越界：${h.tensor}` });
    }
    if (s.model.op) {
      const { a, b, out, kind } = s.model.op;
      for (const t of [a, b, out])
        if (t && !tl.tensors[t]) issues.push({ step: s.id, message: `op 张量未登记：${t}` });
      if (kind === "matmul" && b) {
        const A = tl.tensors[a];
        const B = tl.tensors[b];
        const O = tl.tensors[out];
        if (A && B && O) {
          const k1 = A.shape[A.shape.length - 1];
          const k2 = B.shape[0];
          if (k1 !== k2) issues.push({ step: s.id, message: `matmul 维度不可乘：${A.shape} · ${B.shape}` });
          if (O.shape[O.shape.length - 1] !== B.shape[1])
            issues.push({ step: s.id, message: "matmul 输出列数不匹配" });
        }
      }
    }
    if (s.beats) {
      let prev = -1;
      for (const b of s.beats) {
        if (b.at < 0 || b.at > 1 || b.at <= prev)
          issues.push({ step: s.id, message: `beats 不单调：${b.label}` });
        prev = b.at;
      }
    }
    for (const tr of s.hardware.transfers) {
      if (!tl.tensors[tr.tensor]) issues.push({ step: s.id, message: `transfer 张量未登记：${tr.tensor}` });
      if (!s.hardware.residency[tr.tensor])
        issues.push({ step: s.id, message: `transfer 张量无驻留落点：${tr.tensor}` });
    }
  }
  return issues;
}

export function assertValid(tl: Timeline): void {
  const issues = validateTimeline(tl);
  if (issues.length) throw new Error(issues.map((i) => `${i.step}: ${i.message}`).join("\n"));
}

export function stepIndexById(tl: Timeline, id: string): number {
  return tl.steps.findIndex((s: Step) => s.id === id);
}
