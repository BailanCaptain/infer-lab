import matter from "gray-matter";
import { ID_RE, type ParamEntry, paramEntrySchema } from "../../../src/content/wiki/schema";
import { generatedSection, replaceSection } from "../lineage";
import { sanitizeRawInput } from "../sanitize";
import { digest } from "../workflow";

export const PARAM_SECTION = "## 参数定义（自动生成）";
export const protectedParamSection = (text: string) => generatedSection(text, PARAM_SECTION);
export const paramId = (row: ParamEntry) =>
  `${row.name.replace(/_/g, "-")}-${digest(`${row.file}:${row.class}:${row.json_path}`).slice(0, 12)}`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export function buildParamPage(
  input: { repo: string; ref: string; commit: string; entry: ParamEntry; date: string; pageId?: string },
  previous?: string,
) {
  const p = paramEntrySchema.parse(input.entry);
  if (
    p.review?.verdict === "not-param" ||
    (p.confidence === "suspect" &&
      p.review?.verdict !== "param" &&
      !(previous && input.pageId && matter(previous).data.title === p.name))
  )
    throw new Error("疑似项尚未确认，先复核再生成骨架");
  if (!/^[a-f0-9]{40}$/.test(input.commit)) throw new Error("骨架需要完整 commit SHA");
  for (const text of [p.name, p.type, p.default, p.class, p.json_path, p.file, p.comment, ...p.constraints]) {
    if (!text.trim()) continue;
    const screened = sanitizeRawInput(text);
    if (screened.blocked || screened.text !== text) throw new Error("参数定义清洗阻塞，保留原扫描记录待复核");
  }
  const id = input.pageId ?? paramId(p);
  if (!ID_RE.test(id)) throw new Error("参数页 id 无效");
  const old = previous ? matter(previous) : undefined;
  if (old && old.data.id !== id) throw new Error("现有页面 id 不匹配，拒绝覆盖");
  const source = `${input.repo}@${input.commit}:${p.file}#L${p.line}`;
  const sources = [...new Set([...(old?.data.sources ?? []), source])];
  const section = [
    PARAM_SECTION,
    "",
    "> 此节由参数扫描结果生成；静态定义不保证运行时最终值。",
    "",
    "| 项 | 静态记录 |",
    "| --- | --- |",
    `| 标识 | \`${cell(p.json_path)}\` |`,
    `| 类型 | \`${cell(p.type)}\` |`,
    `| 默认表达式 | \`${cell(p.default)}\` |`,
    `| 定义 | \`${cell(p.file)}:${p.line}\` [C${sources.indexOf(source) + 1}] |`,
    `| 版本 | ${cell(input.ref)} · ${input.commit} |`,
    "",
    "字段注释：",
    "",
    cell(p.comment) || "源码未提供字段注释。",
    "",
    "约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：",
    "",
    ...p.constraints.flatMap((constraint) => ["````python", constraint, "````", ""]),
  ]
    .join("\n")
    .trimEnd();
  const body = old
    ? replaceSection(old.content, PARAM_SECTION, section)
    : `## 一句话\n\n骨架，待补：${p.name} 的静态参数定义。\n\n${section}\n\n## 事实表\n\n静态事实见上方自动生成区；行为与版本差异待核对。\n\n## 为什么存在\n\n骨架，待补：为什么存在。\n\n## 开了的代价\n\n骨架，待补：开了的代价与互斥关系。\n`;
  return matter.stringify(body, {
    ...(old?.data ?? {
      id,
      title: p.name,
      type: "param",
      summary: `${p.name} 的静态定义，正文待补。`,
      origin: "seed",
      evidence: "C",
      updated: input.date,
    }),
    sources,
  });
}
