/**
 * 算式块的解析（2026-09-27 定稿）：一行一项，写成「标签 = 表达式 = 结果」。
 *
 * 两个来源：```calc 围栏（parseCalcFence），和页面里现有的 ```text 算式块（textFenceAsCalc，
 * 每行都是「标签 = …」才认，靠空格对齐的列拆成步骤和说明）。
 *
 * ```calc 的完整写法见 docs/wiki-calc-syntax.md（规则编号和 calc.test.ts 一一对应），这里只记实现要点：
 *
 * - 等号两边必须有空白才算分隔，`a=b` 这种不拆；括号（半角、全角、方括号、花括号）里的等号也不拆，
 *   `min(128, max(a = 4, 8))` 是一步。以 `=` 开头的行接在上一条算式后面，竖着写推导也能读。
 * - 标签里括号外的全角冒号是旧写法「标签：算式 = …」：冒号后面是一个算式时拆成第一步，
 *   冒号在末尾就去掉；冒号后面不是算式时是标签自己的字。
 * - 结果后面跟的东西拆成两段：
 *   - 比较（`≤ 655,360 B`、`≈ 7.969 MiB`）：还是算式的一部分，跟着结果走；
 *   - 说明（`（int8）`、`，占主干 45 层权重的 88%`、单位后面多出来的话 `可用于 KV`）：解释性的话，
 *     版式把它放到这一行下面，所以去掉外层的全角括号或打头的全角逗号。
 * - 结果本身才加粗，只认「数 + 最多两个单位词」，第二个单位词得是英文（`640 个 token`、`2.47 M token`）。
 *   结果本身还是一个算式、后面跟着 `≈ 数` 时（`3,855 × 640 ≈ 2.47 M token`），那个近似数才是结果，
 *   前面的算式退成中间步骤，结果前的符号记成 ≈。
 * - 只在 ```calc 里：`> ` 开头的一行是挂在上一项下面的旁注；反斜杠加任意一个字符按字面显示。
 *   现有的 ```text 块是作者当代码写的，反斜杠和 `>` 都照原样。
 */

/** 连接标签和结果的符号，结果栏前照原样显示 */
export type ResultOp = "=" | "≈" | "≤" | "≥";

export type CalcRow =
  | {
      kind: "eq";
      label: string;
      /** 标签和结果之间的中间步骤，按顺序 */
      steps: string[];
      result: string;
      /** 结果前面的符号：一般是 =，近似结果是 ≈；「标签 ≤ 结果」这种照原样记 ≤、≥ */
      resultOp: ResultOp;
      /** 结果后面的比较：`≤ 655,360 B`、`≈ 7.969 MiB` */
      rel: string;
      /** 解释性的说明，已去掉外层的（）或打头的， */
      note: string;
    }
  /** 没有等号的一行：说明文字，占整行 */
  | { kind: "text"; text: string }
  /** 空行：分组 */
  | { kind: "gap" };

const OPENERS = "[(（{";
const CLOSERS = "])）}";

/** 每个位置前面还没配上的左括号个数；多出来的右括号不让它变成负数 */
function depths(text: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (const c of text) {
    for (let k = 0; k < c.length; k++) out.push(depth);
    if (OPENERS.includes(c)) depth++;
    else if (CLOSERS.includes(c)) depth = Math.max(0, depth - 1);
  }
  return out;
}

/** 括号外第一个匹配的位置、长度和匹配到的字；没有就是 null。re 必须带 g */
function findTop(text: string, re: RegExp): { index: number; length: number; text: string } | null {
  const depth = depths(text);
  for (const m of text.matchAll(re)) {
    if (depth[m.index] === 0) return { index: m.index, length: m[0].length, text: m[0] };
  }
  return null;
}

/**
 * 标签和后面的算式之间的连接符：括号外、前后有空白的 = ≈ ≤ ≥，取最靠前的一个（规则 2、15）。
 * < > ≠ 不算：「提示词 > 8192 − 48 就要切」是一句话，不是算式。
 */
const CONNECTOR = /\s+[=≈≤≥]\s+/g;
/** 以 ≈ ≤ ≥ 开头的续行：等于写在上一行末尾（规则 15） */
const REL_LINE = /^[≈≤≥]\s/;

/** 按连接符把一行拆成标签和其余部分；没有连接符就是 null */
function splitConnector(line: string): { head: string; op: ResultOp; rest: string } | null {
  const c = findTop(line, CONNECTOR);
  if (!c || c.index === 0) return null;
  return {
    head: line.slice(0, c.index),
    op: c.text.trim() as ResultOp,
    rest: line.slice(c.index + c.length),
  };
}

/** 按括号外、两边有空白的等号切开 */
function splitEquals(text: string): string[] {
  const depth = depths(text);
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/\s+=\s+/g)) {
    if (depth[m.index] !== 0) continue;
    out.push(text.slice(start, m.index));
    start = m.index + m[0].length;
  }
  out.push(text.slice(start));
  return out;
}

/** 运算符：前后有空白的 × ÷ + −，ASCII 的 * / - 也认 */
const OPERATOR = "×÷+−*/-";
/** 以运算符（或比较号、箭头、等号）开头的一段：接在前一段后面，不自成一列 */
const LEADING_OP = /^[=≈≤≥×÷+−→*/-]\s/;

/** 带运算符的算式，不是一个数 */
function isExpression(text: string): boolean {
  return new RegExp(`\\s[${OPERATOR}]\\s`).test(text);
}

/** 结果是一个数（可带单位）时才加粗；`TP8 内按元素相加 → …` 这种文字结果照常排 */
export function isNumericResult(result: string): boolean {
  return /^[≈~−-]?\s*\d/.test(result.trim());
}

function unwrapNote(note: string): string {
  const paren = /^（([^（）]*)）$/.exec(note);
  if (paren) return (paren[1] ?? "").trim();
  return note.replace(/^，\s*/, "").trim();
}

/** 结果后面：括号外第一个全角括号或全角逗号起是说明，前后都有空白的比较号起是比较 */
function splitTail(value: string): { result: string; rel: string; note: string } {
  let body = value.trim();
  let note = "";
  const n = findTop(body, /[（，]/g);
  if (n && n.index > 0) {
    note = unwrapNote(body.slice(n.index));
    body = body.slice(0, n.index).trim();
  }
  const r = /\s+(?=[≈≤≥≠<>]\s)/.exec(body);
  if (!r || r.index === 0) return { result: body, rel: "", note };
  return { result: body.slice(0, r.index).trim(), rel: body.slice(r.index).trim(), note };
}

/**
 * 结果只认「数 + 最多两个单位词」：第一个单位词随意（`块`、`GiB`、`个专家`），第二个得是英文
 * （`640 个 token`、`2.47 M token`）。再往后的话是说明：`30.00 GiB 可用于 KV` 的「可用于 KV」。
 */
function splitResultWords(result: string): { result: string; note: string } {
  if (!isNumericResult(result) || isExpression(result)) return { result, note: "" };
  const words = result.trim().split(/\s+/);
  let n = /^[≈~]$/.test(words[0] ?? "") ? 2 : 1;
  if (words.length > n) n++;
  if (/^[A-Za-z][\w/%·.-]*$/.test(words[n] ?? "")) n++;
  if (words.length <= n) return { result, note: "" };
  return { result: words.slice(0, n).join(" "), note: words.slice(n).join(" ") };
}

/**
 * 标签里括号外的全角冒号（旧写法「标签：算式 = …」）：冒号后面是一个算式时，它是第一步；
 * 冒号在末尾就去掉；冒号后面不是算式（`不开 KVPP：每卡每块`）时是标签自己的字。
 */
function splitLabel(text: string): { label: string; lead: string[] } {
  const label = text.trim();
  const colon = findTop(label, /：/g);
  if (!colon) return { label, lead: [] };
  const head = label.slice(0, colon.index).trim();
  const rest = label.slice(colon.index + 1).trim();
  if (!rest) return { label: head, lead: [] };
  if (isExpression(rest)) return { label: head, lead: [rest] };
  return { label, lead: [] };
}

/** 以运算符开头的一段接回前一段：`ceil(6003 / 640)`、`+ 14` 是同一步 */
function joinLeadingOps(segments: string[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (out.length > 0 && LEADING_OP.test(seg)) out[out.length - 1] += ` ${seg}`;
    else out.push(seg);
  }
  return out;
}

type EqRow = Extract<CalcRow, { kind: "eq" }>;
type Draft =
  /** op：标签后面的连接符；标签后直接就是结果时，它就是结果前的符号 */
  | { kind: "eq"; label: string; op: ResultOp; values: string[]; notes: string[] }
  | Exclude<CalcRow, { kind: "eq" }>;

function finish(d: Extract<Draft, { kind: "eq" }>): EqRow {
  const steps = d.values.slice(0, -1).map((v) => v.trim());
  const tail = splitTail(d.values[d.values.length - 1] ?? "");
  let { result, rel } = tail;
  let resultOp: ResultOp = d.values.length === 1 ? d.op : "=";
  if (/^≈\s/.test(rel) && isExpression(result)) {
    steps.push(result);
    result = rel.replace(/^≈\s+/, "");
    rel = "";
    resultOp = "≈";
  }
  // 先写出数、再把数拆开的（`= 13,056 B = 12 层 × (1024 + 64) B`）：拆开的那一步放前面，
  // 推导停在那个数上，加粗的才是数
  const lastStep = steps[steps.length - 1];
  if (lastStep && isExpression(result) && !isExpression(lastStep) && isNumericResult(lastStep)) {
    steps[steps.length - 1] = result;
    result = lastStep;
  }
  const words = splitResultWords(result);
  const note = [words.note, tail.note, ...d.notes].filter(Boolean).join("，");
  return { kind: "eq", label: d.label, steps, result: words.result, resultOp, rel, note };
}

function finishAll(drafts: Draft[]): CalcRow[] {
  while (drafts[drafts.length - 1]?.kind === "gap") drafts.pop();
  return drafts.map((d) => (d.kind === "eq" ? finish(d) : d));
}

/** 转义：`\` 加任意一个字符 → 私用区的占位符，解析完再换回原字符，占位符不会被当成任何语法 */
const ESCAPE_BASE = 0xe000;

function protect(source: string, table: string[]): string {
  return source.replace(/\\(.)/gu, (_, c: string) => {
    table.push(c);
    return String.fromCharCode(ESCAPE_BASE + table.length - 1);
  });
}

/** 占位符所在的私用区；用码位拼出来，源码里不放看不见的字符 */
const PLACEHOLDER = new RegExp(`[${String.fromCharCode(ESCAPE_BASE)}-${String.fromCharCode(0xf8ff)}]`, "g");

function restore(text: string, table: string[]): string {
  return text.replace(PLACEHOLDER, (ch) => table[ch.charCodeAt(0) - ESCAPE_BASE] ?? ch);
}

function restoreRow(row: CalcRow, table: string[]): CalcRow {
  const back = (text: string) => restore(text, table);
  if (row.kind === "gap") return row;
  if (row.kind === "text") return { kind: "text", text: back(row.text) };
  return {
    ...row,
    label: back(row.label),
    steps: row.steps.map(back),
    result: back(row.result),
    rel: back(row.rel),
    note: back(row.note),
  };
}

/** 围栏第一行 `title: …`（冒号全角半角都行）是整组计算的名字；其余行交给 parseCalc */
export function parseCalcFence(source: string): { title: string; rows: CalcRow[] } {
  const table: string[] = [];
  const lines = protect(source, table).split(/\r?\n/);
  while (lines.length > 0 && !lines[0]?.trim()) lines.shift();
  const m = /^\s*title\s*[:：]\s*(.+)$/i.exec(lines[0] ?? "");
  const title = m ? restore((m[1] ?? "").trim(), table) : "";
  const rows = parseCalc((m ? lines.slice(1) : lines).join("\n")).map((r) => restoreRow(r, table));
  return { title, rows };
}

/** ```calc 的一行一行（不含 title 行、不处理转义）；规则见 docs/wiki-calc-syntax.md */
export function parseCalc(source: string): CalcRow[] {
  const drafts: Draft[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const last = drafts[drafts.length - 1];
    if (!line) {
      if (last && last.kind !== "gap") drafts.push({ kind: "gap" });
      continue;
    }
    // 竖排推导的续行：`= 655,360 B` 接到上一条算式后面，上一条的结果退成中间步骤
    if (/^=\s/.test(line) && last?.kind === "eq") {
      last.values.push(...splitEquals(line.replace(/^=\s+/, "")));
      continue;
    }
    // `≈ 0.75 MiB` 开头的续行：接在上一条最后一段的末尾，和写在同一行一样
    if (REL_LINE.test(line) && last?.kind === "eq") {
      last.values[last.values.length - 1] += ` ${line}`;
      continue;
    }
    // 旁注行：`> 其中 MTP 层占 1,088 B` 挂到上一项下面
    if (/^>\s/.test(line) && last?.kind === "eq") {
      last.notes.push(line.replace(/^>\s+/, ""));
      continue;
    }
    const parts = splitConnector(line);
    if (!parts) {
      drafts.push({ kind: "text", text: line });
      continue;
    }
    const { label, lead } = splitLabel(parts.head);
    const values = [...lead, ...splitEquals(parts.rest)];
    drafts.push({ kind: "eq", label, op: lead.length > 0 ? "=" : parts.op, values, notes: [] });
  }
  return finishAll(drafts);
}

/** 在括号外、连续两个以上空白处切开：纯文本块靠空格对齐的列 */
function splitGaps(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? "";
    if (OPENERS.includes(c)) depth++;
    else if (CLOSERS.includes(c)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && /\s/.test(c) && /\s/.test(text[i + 1] ?? "")) {
      out.push(text.slice(start, i));
      while (/\s/.test(text[i + 1] ?? "")) i++;
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((t) => t.trim()).filter(Boolean);
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * 现有页面里 ```text（或不标语言）的算式块，能不能直接当算式块排：每一行都是「标签 = …」
 * （连接符也可以是 ≈ ≤ ≥），或者以 = ≈ ≤ ≥ 开头接上一行。不是就返回 null，照旧当代码块。
 *
 * 这类块靠空格对齐列：标签后面隔一大段空白再写的是第一步（`卷积状态   3072 × 6 × 2 B = …`），
 * 结果后面隔一大段空白、又不以运算符开头的是说明（`[p₀, p₁, p₂, p₃]        int32 [4]`）。
 * 以运算符开头的那段（`= 561,152 B`、`≤ 655,360 B`、`+ 14`、`→ 给 4`）接回前一段。
 * 标签的旧写法「标签：算式 = …」和 ```calc 一样拆（splitLabel）。
 */
export function textFenceAsCalc(source: string): CalcRow[] | null {
  const drafts: Draft[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const last = drafts[drafts.length - 1];
    if (!line) {
      if (last && last.kind !== "gap") drafts.push({ kind: "gap" });
      continue;
    }
    if (/^=\s/.test(line) && last?.kind === "eq") {
      last.values.push(...splitEquals(squash(line.replace(/^=\s+/, ""))));
      continue;
    }
    if (REL_LINE.test(line) && last?.kind === "eq") {
      last.values[last.values.length - 1] += ` ${squash(line)}`;
      continue;
    }
    if (/^\s/.test(raw)) return null;
    const parts = splitConnector(line);
    if (!parts) return null;
    const [labelSegment = "", ...leadSegments] = splitGaps(parts.head);
    const { label, lead } = splitLabel(labelSegment);
    const [main = "", ...notes] = joinLeadingOps(splitGaps(parts.rest));
    const first = joinLeadingOps([...lead, ...leadSegments]).map(squash);
    const values = [...first, ...splitEquals(squash(main))];
    drafts.push({
      kind: "eq",
      label,
      op: first.length > 0 ? "=" : parts.op,
      values,
      notes: notes.map(squash),
    });
  }
  if (!drafts.some((d) => d.kind === "eq")) return null;
  return finishAll(drafts);
}

export type ExprPart = { kind: "text" | "op" | "gloss"; text: string };

/**
 * 表达式里的零件：运算符（前后有空白的 × ÷ + − * / - = → ≈ ≤ ≥）和全角括号里的括注
 * （`1024 B（512 维 × 2 B）` 里的「512 维 × 2 B」），版式把它们排轻一点，数本身才显眼。
 */
export function splitExpr(text: string): ExprPart[] {
  const out: ExprPart[] = [];
  // OPERATOR 以 - 收尾，放在字符类最后才是字面的减号，不会和前面的字符连成区间
  const op = `[=→≈≤≥${OPERATOR}]`;
  for (const piece of text.split(/(（[^（）]*）)/)) {
    if (!piece) continue;
    if (/^（.*）$/.test(piece)) {
      out.push({ kind: "gloss", text: piece });
      continue;
    }
    for (const bit of piece.split(new RegExp(`(\\s${op}\\s)`))) {
      if (!bit) continue;
      out.push(
        new RegExp(`^\\s${op}\\s$`).test(bit)
          ? { kind: "op", text: bit.trim() }
          : { kind: "text", text: bit },
      );
    }
  }
  return out;
}
