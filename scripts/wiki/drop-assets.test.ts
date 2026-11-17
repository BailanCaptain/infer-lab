import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { collectDropAssetAdvisories, stageDropDiagram, validateDropAssets } from "./drop-assets";
import { wikiFixture } from "./test-fixture";

describe("validateDropAssets teaching standard & line numbers", () => {
  it("allows a concept/feature page without a filler diagram when enforcing teaching rules", () => {
    const f = wikiFixture();
    try {
      f.write(
        "wiki/concepts/no-diagram.md",
        [
          "---",
          "id: no-diagram",
          "title: No Diagram",
          "type: concept",
          "summary: Concept explained cleanly with a decision table instead of a filler diagram.",
          "chapters: ['11']",
          "toc:",
          "  part: inference",
          "  section: 调度",
          "origin: drop",
          "evidence: C",
          "sources:",
          "  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1",
          "updated: '2026-11-15'",
          "---",
          "## 核心判据",
          "",
          "先用干净主干说明什么时候触发，不强挂充数图。",
          "",
          "## 对照源码",
          "",
          "### 四版本核验矩阵",
          "",
          "实现锚点 [C1]。",
          "",
        ].join("\n"),
      );
      expect(validateDropAssets(f.root, ["wiki/concepts/no-diagram.md"], true)).toEqual([]);
    } finally {
      f.cleanup();
    }
  });

  it("reports true file line numbers (including frontmatter offset) on standard violations", () => {
    const f = wikiFixture();
    try {
      f.write(
        "wiki/concepts/stacked.md",
        [
          "---",
          "id: stacked",
          "title: Stacked",
          "type: concept",
          "summary: Adjacent dense blocks.",
          "chapters: ['11']",
          "toc:",
          "  part: inference",
          "  section: 调度",
          "origin: drop",
          "evidence: C",
          "sources:",
          "  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1",
          "updated: '2026-11-15'",
          "---",
          "## 算例",
          "",
          "```calc",
          "甲 = 1 + 1",
          "```",
          "",
          "| 项 | 值 |",
          "| --- | --- |",
          "| 乙 | 2 |",
          "",
          "## 对照源码",
          "",
          "出处 [C1]。",
          "",
        ].join("\n"),
      );
      // Frontmatter occupies lines 1..15 (15 lines). Table starts at file line 22 (not body line 7).
      // Mechanical density/placement rules (stacked-blocks, calc-density, diagram-first, hedge-ratio)
      // must NOT block validateDropAssets, while preserving true file line numbers in advisories.
      expect(validateDropAssets(f.root, ["wiki/concepts/stacked.md"], true)).toEqual([]);
      const advisories = collectDropAssetAdvisories(f.root, ["wiki/concepts/stacked.md"]);
      expect(advisories.some((m) => m.includes("第 22 行"))).toBe(true);
      expect(advisories.some((m) => m.includes("calc 块"))).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("keeps hard standard boundaries (prose-marks, source-sections, diagram-width) blocking in validateDropAssets", () => {
    const f = wikiFixture();
    try {
      f.write(
        "wiki/concepts/hard-violation.md",
        [
          "---",
          "id: hard-violation",
          "title: Hard Violation",
          "type: concept",
          "summary: Teaching prose with raw citation mark and missing source section.",
          "chapters: ['11']",
          "toc:",
          "  part: inference",
          "  section: 调度",
          "origin: drop",
          "evidence: C",
          "sources:",
          "  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1",
          "updated: '2026-11-15'",
          "---",
          "## 核心机制",
          "",
          "正文中泄漏了角标 [C1]。",
          "",
        ].join("\n"),
      );
      const issues = validateDropAssets(f.root, ["wiki/concepts/hard-violation.md"], true);
      expect(issues.some((m) => m.includes("证据角标"))).toBe(true);
      expect(issues.some((m) => m.includes("缺少「## 对照源码」"))).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it("stageDropDiagram 对 native-svg 完整复用严格校验并保留原字节，非法输入及非 native 额外 svg 绝不覆盖已有文件", () => {
    const f = wikiFixture();
    try {
      const figureYaml = stringify({
        layout: "figure",
        id: "keep-existing",
        caption: "原有派生图",
        size: [480, 160],
        items: [{ at: [20, 20], size: [200, 60], text: "入口", tone: "token" }],
      });
      stageDropDiagram(f.root, "keep-existing", figureYaml);
      const savedYaml = readFileSync(join(f.root, "wiki/diagrams/keep-existing.yaml"), "utf8");
      const savedSvg = readFileSync(join(f.root, "wiki/diagrams/keep-existing.svg"), "utf8");

      const validNativeYaml = stringify({
        mode: "native-svg",
        id: "keep-existing",
        caption: "人工原生图",
        size: [600, 240],
        pins: [],
      });
      const validNativeSvg =
        '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><!-- exact bytes --><title><![CDATA[原生 & 标题]]></title><text x="20" y="50" font-size="16" fill="currentColor"><![CDATA[q < k && raw]]></text></svg>\n';

      // 1) figure/scene 附带额外 svg 必须拒绝，不静默覆盖也不静默忽略
      expect(() => stageDropDiagram(f.root, "keep-existing", figureYaml, validNativeSvg)).toThrow(
        /svg|禁止|确定性/,
      );
      // 2) native-svg 缺 svg、尺寸不符、损坏 XML、脚本/事件/外链均拒绝
      expect(() => stageDropDiagram(f.root, "keep-existing", validNativeYaml)).toThrow();
      expect(() =>
        stageDropDiagram(
          f.root,
          "keep-existing",
          validNativeYaml,
          validNativeSvg.replace('viewBox="0 0 600 240"', 'viewBox="0 0 601 240"'),
        ),
      ).toThrow();
      expect(() =>
        stageDropDiagram(
          f.root,
          "keep-existing",
          validNativeYaml,
          `<?xml garbage?>${validNativeSvg.slice(validNativeSvg.indexOf("<svg"))}`,
        ),
      ).toThrow();
      expect(() =>
        stageDropDiagram(
          f.root,
          "keep-existing",
          validNativeYaml,
          validNativeSvg.replace("</svg>", "<script>alert(1)</script></svg>"),
        ),
      ).toThrow();
      expect(() =>
        stageDropDiagram(
          f.root,
          "keep-existing",
          validNativeYaml,
          validNativeSvg.replace('fill="currentColor"', 'fill="url(https://evil.invalid/x)"'),
        ),
      ).toThrow();

      // 全部拒绝后，磁盘原有 YAML/SVG 字节分毫无损
      expect(readFileSync(join(f.root, "wiki/diagrams/keep-existing.yaml"), "utf8")).toBe(savedYaml);
      expect(readFileSync(join(f.root, "wiki/diagrams/keep-existing.svg"), "utf8")).toBe(savedSvg);

      // 合法 native-svg 暂存后逐字节保留人工 SVG
      stageDropDiagram(
        f.root,
        "native-ok",
        validNativeYaml.replace("keep-existing", "native-ok"),
        validNativeSvg,
      );
      expect(readFileSync(join(f.root, "wiki/diagrams/native-ok.svg"), "utf8")).toBe(validNativeSvg);
    } finally {
      f.cleanup();
    }
  });
});
