import type { Step, Timeline } from "./types";

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
 */
export function validateTimeline(tl: Timeline): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const s of tl.steps) {
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
      const rows = rec.shape[0] ?? 0;
      const cols = rec.shape[rec.shape.length - 1] ?? 0;
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
