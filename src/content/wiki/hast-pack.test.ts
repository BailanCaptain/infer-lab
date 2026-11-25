import { describe, expect, it } from "vitest";
import { compileMarkdown } from "../../../scripts/wiki/compile-markdown";
import { isPackedHastRoot, type PackedHastNode, packCompiledNode, unpackCompiledNode } from "./hast-pack";
import type { CompiledNode } from "./schema";

function roundTripThroughJson(node: CompiledNode): {
  packed: PackedHastNode;
  json: string;
  unpacked: CompiledNode;
} {
  const packed = packCompiledNode(node);
  const json = JSON.stringify(packed);
  const parsed = JSON.parse(json) as PackedHastNode;
  return {
    packed,
    json,
    unpacked: unpackCompiledNode(parsed),
  };
}

describe("hast-pack lossless tuple codec", () => {
  it("严格无损还原 compileMarkdown 全特性子树（组合字符 emoji/重音、wiki-cell/is-wide、<wbr>、KaTeX、abbr[data-source]、标题 id 与 legacyAnchors、代码块 language-*）", () => {
    const markdown = [
      "## 标题与锚点 [C3]",
      "",
      "组合字符与 emoji：caf\u0065\u0301、na\u0069\u0308ve、👨‍👩‍👧‍👦、🏳️‍🌈、👍🏽。",
      "",
      "超长行内代码触发 `<wbr>`：`vllm_ascend/worker/model_runner_v1_with_extra_long_identifier_name.py#L120-L188` 与短专名 GLM-5.3-Flash。",
      "",
      "证据角标：[S1]、[C3]、[D]、[!]。",
      "",
      "行内公式 $E = mc^2 + \\frac{\\alpha_i}{\\sqrt{x^2 + 1}}$，块级公式（含根号 SVG / 矩阵 / 伸缩括号）：",
      "",
      "$$",
      "\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V, \\quad M = \\begin{bmatrix} a_{11} & a_{12} \\\\ b_{21} & b_{22} \\end{bmatrix}",
      "$$",
      "",
      "```text",
      "张量形状 → [B, H]  caf\u0065\u0301  👨‍👩‍👧‍👦  全角Ａ",
      "```",
      "",
      "```python",
      "def forward(x: torch.Tensor) -> torch.Tensor:",
      "    return x * 2",
      "```",
      "",
      "| 列名 | 数值 |",
      "| :--- | ---: |",
      "| KV 块 | 128 |",
      "",
      "1. 第一项",
      "2. 第二项",
      "",
      "3. 起始编号列表",
      "",
      "- [x] 已完成检查项",
      "- [ ] 待办检查项",
      "",
      "内联 HTML：<br> 原样作为 raw 节点保留。",
      "",
      "## 对照源码",
      "",
      "折叠区内容 [M2]。",
    ].join("\n");

    const compiled = compileMarkdown(markdown, {
      "legacy-heading-slug": "标题与锚点",
      "legacy-source-slug": "对照源码",
    });

    const { packed, json, unpacked } = roundTripThroughJson(compiled);

    expect(isPackedHastRoot(packed)).toBe(true);
    expect(unpacked).toEqual(compiled);
    expect(json.length).toBeLessThan(JSON.stringify(compiled).length * 0.65);

    // 验证高频节点确实被编码为专用短元组
    const flatTokens: unknown[] = [];
    const collect = (item: unknown) => {
      flatTokens.push(item);
      if (Array.isArray(item)) {
        for (const sub of item) collect(sub);
      }
    };
    collect(packed);

    // 2 = <wbr>
    expect(flatTokens).toContain(2);
    // [0, value] = 单宽 wiki-cell（如 → 或组合重音字母 é）
    expect(
      flatTokens.some((t) => Array.isArray(t) && t.length === 2 && t[0] === 0 && typeof t[1] === "string"),
    ).toBe(true);
    // [1, value] = 宽字符 wiki-cell is-wide（汉字 / 全角）
    expect(flatTokens).toContainEqual([1, "张"]);
    expect(flatTokens).toContainEqual([1, "Ａ"]);
  });

  it("忠实还原空属性、布尔/数值属性以及特殊 className（空数组、含空格项、非字符串或原始字符串）", () => {
    const syntheticTree: CompiledNode = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {},
          children: [{ type: "text", value: "空属性对象还原为 {}" }],
        },
        {
          type: "element",
          tagName: "ol",
          properties: {
            start: 5,
            reversed: true,
            hidden: false,
            tabIndex: 0,
            "data-count": 42,
            className: ["list-main", "is-compact"],
          },
          children: [],
        },
        {
          type: "element",
          tagName: "span",
          properties: { className: [] },
          children: [{ type: "text", value: "空 className 数组保持 []" }],
        },
        {
          type: "element",
          tagName: "span",
          properties: { className: ["has space", ""] },
          children: [{ type: "text", value: "含空格或空串的 className 数组原样保留" }],
        },
        {
          type: "element",
          tagName: "span",
          properties: { className: "raw-string-class" },
          children: [{ type: "text", value: "原始字符串 className 不误拆为数组" }],
        },
        {
          type: "element",
          tagName: "span",
          properties: { className: ["wiki-cell"], "data-extra": "yes" },
          children: [{ type: "text", value: "带额外属性的 wiki-cell 不丢属性" }],
        },
        {
          type: "element",
          tagName: "custom-el",
          children: [{ type: "text", value: "省略 properties 的元素保持无 properties 键" }],
        },
      ],
    };

    const { packed, unpacked } = roundTripThroughJson(syntheticTree);
    expect(isPackedHastRoot(packed)).toBe(true);
    expect(unpacked).toEqual(syntheticTree);
    expect(Object.hasOwn(unpacked.children![0]!, "properties")).toBe(true);
    expect(unpacked.children![0]!.properties).toEqual({});
    expect(unpacked.children![2]!.properties?.className).toEqual([]);
    expect(unpacked.children![4]!.properties?.className).toBe("raw-string-class");
    expect(Object.hasOwn(unpacked.children![6]!, "properties")).toBe(false);
  });

  it("拒绝损坏或非根节点的紧凑结构", () => {
    expect(isPackedHastRoot("plain text")).toBe(false);
    expect(isPackedHastRoot(2)).toBe(false);
    expect(isPackedHastRoot([0, "x"])).toBe(false);
    expect(isPackedHastRoot(["e", "div", 0])).toBe(false);
    expect(isPackedHastRoot(["r", ["x", "unknown"]])).toBe(false);
    expect(() => unpackCompiledNode(["x" as "r"])).toThrow();
  });
});
