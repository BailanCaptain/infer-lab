/**
 * 把正文里的内联证据标记 `[C]`、`[S]` 变成可悬停的角标。
 *
 * HANDBOOK「页面格式」要求逐条结论在句末加 `[S]`/`[C]`/`[D]`/`[A]`/`[I]`/`[M]`/`[!]`，
 * 因为页级 `evidence` 表达不了一页里混合来源的情况。但读者看到光秃秃一个 `[C]`
 * 不知道那是什么——这正是「证据等级用户会不会蒙」的问题，所以渲染成带 tooltip
 * 的角标，而不是让字面量原样出现在句子里。
 *
 * 实现上给 mdast 塞一个 `inlineCode` 节点并改写它的 hName，让 mdast-util-to-hast
 * 输出 `<abbr data-evidence="C">C</abbr>`，前端再把 `abbr` 映射成 EvidenceBadge。
 * 这样不需要自定义节点类型，也不需要放开 raw HTML。
 */

/**
 * 七档字母的内联标记。只认前后不粘连的 `[X]`——`arr[0]`、`[S3]`、`[Ctrl]`
 * 都不能被误判成证据标记。`!` 在字符类里是字面量，不用转义。
 */
export const EVIDENCE_MARK_RE = /\[([SCDAIM!])\](?![\w-])/g;

type TextNode = { type: "text"; value: string };
type MarkNode = {
  type: "inlineCode";
  value: string;
  data: { hName: "abbr"; hProperties: Record<string, string> };
};

/** 把一个文本节点按证据标记切成 text / mark 交替的序列；没有标记就返回 null */
export function splitEvidenceMarks(value: string): (TextNode | MarkNode)[] | null {
  EVIDENCE_MARK_RE.lastIndex = 0;
  const out: (TextNode | MarkNode)[] = [];
  let last = 0;
  let m: RegExpExecArray | null = EVIDENCE_MARK_RE.exec(value);
  while (m) {
    const level = m[1] ?? "";
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    out.push({
      type: "inlineCode",
      value: level,
      data: { hName: "abbr", hProperties: { "data-evidence": level } },
    });
    last = m.index + m[0].length;
    m = EVIDENCE_MARK_RE.exec(value);
  }
  if (out.length === 0) return null;
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/** 不进入代码块与链接文本——那里的方括号是内容，不是标记 */
const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "definition"]);

/** 结构化的 mdast 节点。@types/mdast 没装，这里只声明真正用到的三个字段。 */
type AnyNode = { type: string; value?: string; children?: AnyNode[] };

export function remarkEvidenceMarks() {
  return (tree: AnyNode) => {
    walk(tree);
  };
}

function walk(node: AnyNode): void {
  const kids = node.children;
  if (!kids) return;
  const next: AnyNode[] = [];
  for (const child of kids) {
    if (child.type === "text" && typeof child.value === "string") {
      const parts = splitEvidenceMarks(child.value);
      if (parts) {
        next.push(...(parts as unknown as AnyNode[]));
        continue;
      }
    }
    if (!SKIP.has(child.type)) walk(child);
    next.push(child);
  }
  node.children = next;
}
