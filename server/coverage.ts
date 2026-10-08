import type { GapSignal } from "../scripts/wiki/gap-ledger";
import { citationCheck, citationProse } from "../src/content/wiki/retrieve";
import { z } from "zod";

export const COVERAGE_REPORT_INSTRUCTION = '回答末尾必须附上隐藏的结构化覆盖状态：<!-- wiki-coverage: {"satisfied":true,"reason":"依据"} -->。satisfied 为 true 表示所问版本与结论有足够本库证据，false 表示材料不足，null 表示无法判明；正文保持自然语言。联网得来的新结论不算已收录。reason 说明范围，不能只凭检索分数判断。';
const reportSchema = z.object({ satisfied: z.boolean().nullable(), reason: z.string().trim().min(1).max(2000) }).strict();
const legacyUncertainty = /(?:现有|已有|当前|所给|本库|库内|这些).{0,12}(?:材料|资料|证据|信息).{0,12}(?:不足|不够|无法|不能)|(?:无法|不能).{0,10}(?:已有|现有|当前|本库).{0,10}(?:判断|确定|确认)/;

/** These are observations, not the budgeted satisfied/classification decision from F004 AC3. */
export function coverageSignals(answer: string, tools: { name: string; target?: string }[]): GapSignal[] {
  const signals: GapSignal[] = [];
  const prose = citationProse(answer);
  const marker = /<!--\s*wiki-coverage:\s*(\{[^\n]*\})\s*-->\s*$/.exec(prose);
  let report: z.infer<typeof reportSchema> | undefined;
  if (marker) {
    try { report = reportSchema.parse(JSON.parse(marker[1]!)); } catch { report = { satisfied: null, reason: "覆盖状态格式无效，需要核对" }; }
  }
  if ((report && report.satisfied !== true) || citationCheck(prose).selfDeclaredUncovered || (!report && legacyUncertainty.test(prose)))
    signals.push({
      kind: "agent-uncovered",
      reason: report ? `模型覆盖状态 ${report.satisfied}：${report.reason}；仍需独立分类核对。`.slice(0, 2000) : "问答模型自述材料不足；尚未独立判定是否缺知识、漏检或版本过期。",
    });
  for (const tool of tools) {
    if (tool.name !== "WebFetch" && tool.name !== "WebSearch") continue;
    const signal: GapSignal = {
      kind: "web-attempt",
      tool: tool.name,
      reason: "模型发起联网工具调用；未核实访问成功、来源性质或知识库是否缺失。",
      ...(tool.target ? { target: tool.target.slice(0, 8000) } : {}),
    };
    if (!signals.some((prior) => JSON.stringify(prior) === JSON.stringify(signal))) signals.push(signal);
    if (signals.length >= 21) break;
  }
  return signals;
}
