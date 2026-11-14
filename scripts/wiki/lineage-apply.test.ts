import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { replaceSection } from "./lineage";
import { buildParamPage, PARAM_SECTION } from "./params/pages";
import { scanSources } from "./params/scan";
import { wikiFixture } from "./test-fixture";

const GEN = ["## 版本谱系", "", "| 版本 | 是否存在 |"].join("\n");
const lines = (...xs: string[]) => `${xs.join("\n")}\n`;

it("skips a manual parameter page without blocking updates to pinned definitions", () => {
  const f = wikiFixture();
  try {
    const file = "vllm_ascend/config.py";
    const source = "class ExampleConfig:\n    limit: int = 1\n";
    f.write(`repo/${file}`, source);
    const commit = f.commit("definition");
    f.git(["update-ref", "refs/remotes/origin/main", commit]);
    f.write(
      "seeds.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: ${commit}}\nfeatures: []\n`,
    );
    const input = {
      repo: "r",
      ref: "main",
      commit,
      entry: scanSources({ [file]: source })[0]!,
      date: "2026-11-03",
    };
    const manual = buildParamPage({ ...input, pageId: "a-manual" }).replace(PARAM_SECTION, "## 人工定义");
    f.write("wiki/params/a-manual.md", manual);
    f.write("wiki/params/z-generated.md", buildParamPage({ ...input, pageId: "z-generated" }));
    const result = f.cli("wiki-lineage-apply", ["--seeds", "seeds.yaml"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("跳过 wiki/params/a-manual.md");
    expect(readFileSync(join(f.root, "wiki/params/a-manual.md"), "utf8")).toBe(manual);
    expect(readFileSync(join(f.root, "wiki/params/z-generated.md"), "utf8")).toContain("ExampleConfig.limit");
  } finally {
    f.cleanup();
  }
});

describe("replaceSection", () => {
  it("ignores example headings inside fences and preserves unrelated whitespace", () => {
    const body = "## Example\n\n```md\n## 版本谱系\nexample\n```\n\n\n## 版本谱系\nold\n\n## Tail\nkeep\n";
    const result = replaceSection(body, "## 版本谱系", GEN);
    expect(result).toContain("```md\n## 版本谱系\nexample\n```\n\n\n");
    expect(result).not.toContain("\nold\n");
    expect(result).toContain("## Tail\nkeep\n");
  });
  it("整节替换：原有内容被换掉，前后小节都保留", () => {
    const body = lines(
      "## 一句话",
      "x",
      "",
      "## 版本谱系",
      "",
      "agent 瞎写的 PR #999",
      "",
      "## 为什么存在",
      "y",
    );
    const out = replaceSection(body, "## 版本谱系", GEN);
    expect(out).toContain("| 版本 | 是否存在 |");
    // agent 编的 PR 号必须消失——这正是这一节改由脚本生成的原因
    expect(out).not.toContain("#999");
    expect(out).toContain("## 一句话");
    expect(out).toContain("## 为什么存在");
  });

  it("页面里还没有这一节时追加到末尾", () => {
    const out = replaceSection(lines("## 一句话", "x"), "## 版本谱系", GEN);
    expect(out.indexOf("## 版本谱系")).toBeGreaterThan(out.indexOf("## 一句话"));
  });

  it("这一节是最后一节时不吞掉前面的正文", () => {
    const out = replaceSection(lines("## 一句话", "x", "", "## 版本谱系", "旧的"), "## 版本谱系", GEN);
    expect(out).toContain("## 一句话");
    expect(out).not.toContain("旧的");
  });

  it("不留三连空行", () => {
    const body = lines("## 一句话", "x", "", "## 版本谱系", "旧", "", "", "## 尾", "z");
    expect(replaceSection(body, "## 版本谱系", GEN)).not.toMatch(/\n{3,}/);
  });
});
