import { describe, expect, it } from "vitest";
import { replaceSection } from "./lineage";

const GEN = ["## 版本谱系", "", "| 版本 | 是否存在 |"].join("\n");
const lines = (...xs: string[]) => `${xs.join("\n")}\n`;

describe("replaceSection", () => {
  it("整节替换：原有内容被换掉，前后小节都保留", () => {
    const body = lines("## 一句话", "x", "", "## 版本谱系", "", "agent 瞎写的 PR #999", "", "## 为什么存在", "y");
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
