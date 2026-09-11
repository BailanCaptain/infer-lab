import { describe, expect, it } from "vitest";
import { remarkEvidenceMarks, splitEvidenceMarks } from "./evidenceMarks";

describe("splitEvidenceMarks", () => {
  it("带编号的 [C3] 记下来源下标，供前端渲染成可点链接", () => {
    const parts = splitEvidenceMarks("块大小固定 128 [C3]。");
    const mark = parts?.find((p) => p.type === "inlineCode");
    expect(mark).toEqual({
      type: "inlineCode",
      value: "C",
      data: { hName: "abbr", hProperties: { "data-evidence": "C", "data-source": "3" } },
    });
  });

  it("句末的 [C] 切成角标节点，前后文本保留", () => {
    const parts = splitEvidenceMarks("后端只支持 block_size = 128 [C]。");
    expect(parts).toEqual([
      { type: "text", value: "后端只支持 block_size = 128 " },
      {
        type: "inlineCode",
        value: "C",
        data: { hName: "abbr", hProperties: { "data-evidence": "C" } },
      },
      { type: "text", value: "。" },
    ]);
  });

  it("一句里多个标记都认", () => {
    const parts = splitEvidenceMarks("甲 [S]，乙 [D]，丙 [!]");
    expect(parts?.filter((p) => p.type === "inlineCode").map((p) => p.value)).toEqual(["S", "D", "!"]);
  });

  it("没有标记返回 null，不白白重建节点", () => {
    expect(splitEvidenceMarks("普通句子，没有标记。")).toBeNull();
  });

  it("数组下标与多字母方括号不误判", () => {
    // 注意 [S3] 现在是合法标记（S + 来源编号 3），不在这个列表里
    for (const s of ["arr[0] 的值", "[Ctrl] 键", "[SC] 两档", "[C-1] 区间"]) {
      expect(splitEvidenceMarks(s)).toBeNull();
    }
  });
});

/** 最小 mdast，够验证遍历与跳过规则 */
const text = (value: string) => ({ type: "text", value });
const para = (...children: unknown[]) => ({ type: "paragraph", children });
const root = (...children: unknown[]) => ({ type: "root", children }) as never;

describe("remarkEvidenceMarks", () => {
  it("段落里的标记被替换", () => {
    const tree = root(para(text("形状固定 [C]。")));
    remarkEvidenceMarks()(tree);
    const kids = (tree as { children: { children: { type: string }[] }[] }).children[0]?.children ?? [];
    expect(kids.map((k) => k.type)).toEqual(["text", "inlineCode", "text"]);
  });

  it("代码块与链接文本里的方括号不动", () => {
    const code = { type: "code", value: "a[C]b" };
    const link = { type: "link", url: "x.md", children: [text("看 [C] 这页")] };
    const tree = root(para(code, link));
    remarkEvidenceMarks()(tree);
    const kids = (tree as { children: { children: { type: string }[] }[] }).children[0]?.children ?? [];
    expect(kids.map((k) => k.type)).toEqual(["code", "link"]);
    expect((link.children as { type: string }[]).map((k) => k.type)).toEqual(["text"]);
  });

  it("表格单元格里的标记也认（事实表最后一列常用）", () => {
    const cell = { type: "tableCell", children: [text("128 [C]")] };
    const tree = root({ type: "table", children: [{ type: "tableRow", children: [cell] }] });
    remarkEvidenceMarks()(tree);
    expect((cell.children as { type: string }[]).map((k) => k.type)).toEqual(["text", "inlineCode"]);
  });
});
