/**
 * 数字列右对齐：一列里每个非空的正文格都是「数值或算式、以数字或单位收尾」时，
 * 给这一列的 th/td 加 is-num，由样式决定是否右对齐。作者在 GFM 里写了对齐（`---:`）的列不动。
 *
 * 「0 部署」「4…128 共 7 个」这种以中文收尾的不算数字列：右对齐只对能逐位比较的数有意义。
 */

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const STARTS_NUMERIC = /^(?:[≈~≤≥<>×÷+\-−(]\s*)?\d/;
const ENDS_NUMERIC = /\d(?:\s*(?:[KMGTP]i?B|B|%|ms|s))?\)?$/;

export function isNumericCell(text: string): boolean {
  const t = text.trim();
  return STARTS_NUMERIC.test(t) && ENDS_NUMERIC.test(t);
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function elements(node: HastNode, tag: string): HastNode[] {
  return (node.children ?? []).filter((c) => c.type === "element" && c.tagName === tag);
}

function rowsOf(table: HastNode): { head: HastNode[]; body: HastNode[] } {
  const head = elements(table, "thead").flatMap((s) => elements(s, "tr"));
  const body = [...elements(table, "tbody").flatMap((s) => elements(s, "tr")), ...elements(table, "tr")];
  return { head, body };
}

function cellsOf(row: HastNode): HastNode[] {
  return (row.children ?? []).filter(
    (c) => c.type === "element" && (c.tagName === "td" || c.tagName === "th"),
  );
}

function markTable(table: HastNode): void {
  const { head, body } = rowsOf(table);
  if (body.length === 0) return;
  const width = Math.max(...[...head, ...body].map((r) => cellsOf(r).length));
  for (let col = 0; col < width; col++) {
    const cells = body.map((r) => cellsOf(r)[col]).filter((c): c is HastNode => Boolean(c));
    if (cells.some((c) => c.properties?.align)) continue;
    const filled = cells.map(textOf).filter((t) => t.trim());
    if (filled.length === 0 || !filled.every(isNumericCell)) continue;
    for (const row of [...head, ...body]) {
      const cell = cellsOf(row)[col];
      if (!cell) continue;
      const props = cell.properties ?? {};
      const cls = Array.isArray(props.className) ? props.className : [];
      cell.properties = { ...props, className: [...cls, "is-num"] };
    }
  }
}

export function rehypeNumericColumns() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "table") {
      markTable(node);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  return walk;
}
