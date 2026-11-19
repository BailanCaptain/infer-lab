import { describe, expect, it } from "vitest";
import { extractReviewFormulas } from "./DropReviewPreview";

describe("extractReviewFormulas", () => {
  it("extracts legacy ```calc blocks, block $$...$$ KaTeX, and inline $...$ KaTeX in order", () => {
    const md = [
      "---",
      "id: kv-budget",
      "title: KV Budget $ignored = 1$",
      "summary: Cost is $10.",
      "---",
      "## 算账",
      "",
      "单层字节数 $B = 2 \\times n_{kv} \\times d \\times 2$，价格不是 $10 也不是 $3.50。",
      "",
      "$$",
      "\\text{blocks} = \\lfloor M_{\\text{free}} / B_{\\text{block}} \\rfloor",
      "$$",
      "",
      "```python",
      "# $x = 1$ inside code fence must be ignored",
      "price = '$20'",
      "```",
      "",
      "行内代码 `$HOME = /tmp` 也不算公式。",
      "",
      "```calc",
      "legacy = 128 * 2",
      "```",
      "",
      "## 已废弃的说法",
      "",
      "$$\\text{retired} = 999$$",
    ].join("\n");

    const extracted = extractReviewFormulas(md);
    expect(extracted).toContain("$B = 2 \\times n_{kv} \\times d \\times 2$");
    expect(extracted).toContain("\\text{blocks} = \\lfloor M_{\\text{free}} / B_{\\text{block}} \\rfloor");
    expect(extracted).toContain("```calc\nlegacy = 128 * 2\n```");
    expect(extracted).not.toContain("ignored");
    expect(extracted).not.toContain("$10");
    expect(extracted).not.toContain("$3.50");
    expect(extracted).not.toContain("price = '$20'");
    expect(extracted).not.toContain("$HOME");
    expect(extracted).not.toContain("retired");
  });

  it("returns empty string for null or prose-only markdown", () => {
    expect(extractReviewFormulas(null)).toBe("");
    expect(extractReviewFormulas("# Title\n\nNo math here, only $42 budget.\n")).toBe("");
  });
});
