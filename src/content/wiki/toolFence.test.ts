import { describe, expect, it } from "vitest";
import { extractWikiToolFences, parseWikiToolFence } from "./toolFence";

describe("parseWikiToolFence & extractWikiToolFences", () => {
  it("accepts all 4 known tools with allowed modes and optional fields", () => {
    const validCases = [
      "tool: deploy-calculator\nmode: quick-screen\ntitle: 算账台初筛\nsummary: 估算显存需求",
      "tool: config-doctor\nmode: minimal\ntab: doctor",
      "tool: troubleshoot-workbench\nmode: logs\npreset: oom",
      "tool: aicore-lab\nmode: single\nmodel: qwen3-8b",
    ];
    for (const src of validCases) {
      const parsed = parseWikiToolFence(src);
      expect(parsed.ok, src).toBe(true);
    }
  });

  it("rejects empty fence, missing tool, unknown tool, invalid mode, duplicate/unknown keys and malformed lines", () => {
    expect(parseWikiToolFence("   \n# only comment").ok).toBe(false);
    expect(parseWikiToolFence("mode: minimal").ok).toBe(false);
    expect(parseWikiToolFence("tool: unknown-tool").ok).toBe(false);
    expect(parseWikiToolFence("tool: config-doctor\nmode: quick-screen").ok).toBe(false);
    expect(parseWikiToolFence("tool: config-doctor\ntool: deploy-calculator").ok).toBe(false);
    expect(parseWikiToolFence("tool: config-doctor\nextra: foo").ok).toBe(false);
    expect(parseWikiToolFence("tool: config-doctor\nbad line").ok).toBe(false);
  });

  it("extracts top-level wiki-tool blocks while ignoring nested markdown fences", () => {
    const md = [
      "## 正文",
      "",
      "````md",
      "```wiki-tool",
      "tool: unknown",
      "```",
      "````",
      "",
      "```wiki-tool",
      "tool: deploy-calculator",
      "mode: minimal",
      "```",
    ].join("\n");
    const blocks = extractWikiToolFences(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      line: 9,
      source: "tool: deploy-calculator\nmode: minimal",
    });
  });
});
