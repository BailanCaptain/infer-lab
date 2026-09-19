import type { ParamEntry } from "../../../src/content/wiki/schema";

/** Bound long files explicitly. Numbered excerpts retain real source coordinates and declare omissions. */
export function paramSourceContext(entry: ParamEntry, source: string) {
  if (source.length <= 18000) return source;
  const lines = source.split(/\r?\n/);
  const selected = new Set<number>();
  const add = (line: number, radius: number) => {
    for (let i = Math.max(0, line - radius); i <= Math.min(lines.length - 1, line + radius); i++)
      selected.add(i);
  };
  add(entry.line - 1, 15);
  for (let i = 0; i < lines.length && selected.size < 120; i++)
    if (new RegExp(`\\b${entry.name}\\b`).test(lines[i]!)) add(i, 5);
  const text =
    `选择范围：${entry.file} 全文 ${lines.length} 行；仅以下定义与引用上下文，未提供完整类或完整控制流。\n` +
    [...selected]
      .sort((a, b) => a - b)
      .map((i) => `L${i + 1}: ${lines[i]}`)
      .join("\n");
  if (text.length > 20000) throw new Error("单个参数上下文过大，需要人工选择材料，未调用模型");
  return text;
}
