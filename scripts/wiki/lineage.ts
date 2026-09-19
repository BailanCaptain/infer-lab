/** Section protection helpers. Verified Git history is implemented only in lineage-git.ts. */
/** 上游的提交标题惯例是 `... (#11953)` */
export function prOf(subject: string): number | undefined {
  const m = /\(#(\d+)\)\s*$/.exec(subject.trim());
  return m?.[1] ? Number(m[1]) : undefined;
}

/** 渲染成参数页「版本谱系」一节的 markdown。人和 agent 都不要手改这一节。 */
export const LINEAGE_SECTION = "## 版本谱系";

/** Exact section bytes, excluding examples inside fenced code. Shared with review protection. */
export function generatedSection(text: string, heading: string): string | undefined {
  let fence = "";
  let start: number | undefined;
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = "";
    } else if (marker) fence = marker;
    else if (/^##\s/.test(line)) {
      if (start !== undefined) return text.slice(start, offset).trimEnd();
      if (line.trimEnd() === heading) start = offset;
    }
    offset += line.length;
  }
  return start === undefined ? undefined : text.slice(start).trimEnd();
}
export const lineageSection = (text: string) => generatedSection(text, LINEAGE_SECTION);

/**
 * 整节替换 markdown 里的某个 H2 小节，前后小节原样保留。
 *
 * 参数页的「版本谱系」由 `wiki:lineage:apply` 每次重算覆盖——不管上一次是
 * agent 写的还是脚本生成的。放在库里而不是 CLI 里，是为了让它能被单测直接
 * 引用而不触发 CLI 的副作用。
 */
export function replaceSection(body: string, section: string, content: string): string {
  let fence = "";
  let start: number | undefined;
  let offset = 0;
  for (const line of body.split(/(?<=\n)/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = "";
    } else if (marker) fence = marker;
    else if (/^##\s/.test(line)) {
      if (start !== undefined) return `${body.slice(0, start)}${content.trimEnd()}\n\n${body.slice(offset)}`;
      if (line.trimEnd() === section) start = offset;
    }
    offset += line.length;
  }
  return start === undefined
    ? `${body.trimEnd()}\n\n${content.trimEnd()}\n`
    : `${body.slice(0, start)}${content.trimEnd()}\n`;
}
