import { expect, type Page, test } from "@playwright/test";
import { compileMarkdown } from "../scripts/wiki/compile-markdown";
import type { ReaderSnapshot } from "../src/content/wiki/schema";

const MATH_BODY = [
  "## 单步延迟公式核验",
  "",
  "再记既未与计算重叠、也未与 HBM 访存重叠的暴露通信与下发耗时为 $T_{\\text{comm,exposed}}$，单步耗时满足符号框架：",
  "",
  "$$",
  "T_{\\text{step}} \\ge \\max\\!\\left(T_{\\text{compute}}\\!\\left(\\left\\{\\frac{W_p}{P_{\\text{peak},p}}\\right\\}\\right),\\; \\frac{Q_{\\text{dram}}}{BW_{\\text{dram}}}\\right) + T_{\\text{comm,exposed}}",
  "$$",
  "",
  "安全边界：$\\href{javascript:alert(1)}{click}$。",
  "",
  "## 对照源码",
  "",
  "### 源码位置",
  "",
  "核验条目 [C1]。",
].join("\n");

function buildMathSnapshot(mode: "compiled" | "live", revisionChar: string): ReaderSnapshot {
  const marker = mode === "compiled" ? "编译快照路径标记" : "实时渲染路径标记";
  const body = `${marker}\n\n${MATH_BODY}`;
  const raw = [
    "---",
    "id: math-layout-check",
    "title: 公式上下标与分式排版验收",
    "type: concept",
    "origin: direct",
    "summary: 验证编译快照与实时渲染双路的 KaTeX 下标字号与分式排版。",
    "chapters: ['02']",
    "order: 10",
    "sources:",
    "  - vllm@0fc695fc:vllm/v1/engine/core.py#L1-L10",
    "evidence: C",
    "updated: '2026-11-15'",
    "---",
    "",
    body,
    "",
  ].join("\n");

  return {
    revision: revisionChar.repeat(64),
    registry: {
      version: 1,
      pages: [
        {
          id: "math-layout-check",
          title: "公式上下标与分式排版验收",
          type: "concept",
          origin: "direct",
          summary: "验证编译快照与实时渲染双路的 KaTeX 下标字号与分式排版。",
          aliases: [],
          chapters: ["02"],
          order: 10,
          prerequisites: [],
          sources: ["vllm@0fc695fc:vllm/v1/engine/core.py#L1-L10"],
          verified: [],
          evidence: "C",
          relations: [],
          related: [],
          contradicts: [],
          updated: "2026-11-15",
          file: "concepts/math-layout-check.md",
          backlinks: [],
        },
      ],
    },
    pageTexts: [
      {
        file: "concepts/math-layout-check.md",
        text: raw,
        ...(mode === "compiled" ? { compiled: compileMarkdown(body) } : {}),
      },
    ],
    diagrams: [],
    skipped: [],
  };
}

async function assertKatexMetrics(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.getByTestId("wiki-body").evaluate((body) => {
    const inlineKatex = body.querySelector("p .katex");
    if (!inlineKatex) throw new Error("未找到行内 .katex 公式节点");
    const baseBox = inlineKatex.querySelector(".katex-html > .base");
    const mainSym = inlineKatex.querySelector(".mord.mathnormal");
    const subSizing = inlineKatex.querySelector(".msupsub .sizing.reset-size6.size3");
    if (!baseBox || !mainSym || !subSizing) throw new Error("行内下标 DOM 结构不完整");

    const baseStyle = getComputedStyle(baseBox);
    const mainFontSize = Number.parseFloat(getComputedStyle(mainSym).fontSize);
    const subFontSize = Number.parseFloat(getComputedStyle(subSizing).fontSize);
    const mainRect = mainSym.getBoundingClientRect();
    const subRect = subSizing.getBoundingClientRect();

    const displayKatex = body.querySelector(".katex-display .katex");
    if (!displayKatex) throw new Error("未找到块级 .katex-display 公式节点");
    const mfracs = [...displayKatex.querySelectorAll(".mfrac")];
    if (mfracs.length < 2) throw new Error(`块级分式数量不足：${mfracs.length}`);

    const fracChecks = mfracs.map((mfrac) => {
      const bar = mfrac.querySelector(".frac-line");
      const rows = mfrac.querySelectorAll(":scope > .vlist-t > .vlist-r > .vlist > span");
      if (!bar || rows.length < 2) throw new Error("分式内部缺 .frac-line 或分子/分母行");
      const barStyle = getComputedStyle(bar);
      const barRect = bar.getBoundingClientRect();
      // KaTeX .mfrac vlist order: denominator row, frac-line row, numerator row (or sorted by vertical y)
      const textSpans = [...rows].filter(
        (el) => !el.querySelector(".frac-line") && (el.textContent?.trim().length ?? 0) > 0,
      );
      if (textSpans.length < 2) throw new Error("分式未找到分子与分母内容行");
      const rects = textSpans
        .map((el) => (el.querySelector(":scope > .mord") ?? el).getBoundingClientRect())
        .sort((a, b) => a.top - b.top);
      const numRect = rects[0]!;
      const denRect = rects[rects.length - 1]!;
      return {
        barDisplay: barStyle.display,
        barBorderBottomWidth: Number.parseFloat(barStyle.borderBottomWidth),
        barWidth: barRect.width,
        barTop: barRect.top,
        barBottom: barRect.bottom,
        numTop: numRect.top,
        numBottom: numRect.bottom,
        denTop: denRect.top,
        denBottom: denRect.bottom,
        centerDelta: Math.abs((numRect.left + numRect.right) / 2 - (denRect.left + denRect.right) / 2),
      };
    });

    const unsafeLinks = body.querySelectorAll('a[href^="javascript:"]').length;
    return {
      baseDisplay: baseStyle.display,
      mainFontSize,
      subFontSize,
      subScale: subFontSize / mainFontSize,
      subBelowMainTop: subRect.top > mainRect.top,
      fracChecks,
      unsafeLinks,
    };
  });

  expect(metrics.baseDisplay).toBe("inline-block");
  expect(metrics.subScale).toBeGreaterThan(0.65);
  expect(metrics.subScale).toBeLessThan(0.75);
  expect(metrics.subBelowMainTop).toBe(true);
  expect(metrics.unsafeLinks).toBe(0);

  for (const frac of metrics.fracChecks) {
    expect(frac.barDisplay).toBe("inline-block");
    expect(frac.barBorderBottomWidth).toBeGreaterThan(0);
    expect(frac.barWidth).toBeGreaterThan(18);
    expect(frac.numBottom).toBeLessThanOrEqual(frac.barBottom + 2);
    expect(frac.numTop).toBeLessThan(frac.barTop - 4);
    expect(frac.denTop).toBeGreaterThanOrEqual(frac.barTop - 2);
    expect(frac.denBottom).toBeGreaterThan(frac.barBottom + 4);
    expect(frac.centerDelta).toBeLessThan(8);
  }
}

test("KaTeX 公式在编译快照与实时渲染双路均正确缩放下标字号并对齐分式排版", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const compiledSnapshot = buildMathSnapshot("compiled", "a");
  const liveSnapshot = buildMathSnapshot("live", "b");
  let currentMode: "compiled" | "live" = "compiled";

  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/api/wiki/pages")) {
      await route.fulfill({
        json: currentMode === "compiled" ? compiledSnapshot : liveSnapshot,
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/#/wiki/math-layout-check");
  await expect(page.getByTestId("wiki-body")).toContainText("编译快照路径标记");
  await assertKatexMetrics(page);

  currentMode = "live";
  await page.getByTestId("chat-open").click();
  await page.getByRole("button", { name: "刷新知识库" }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("实时渲染路径标记");
  await assertKatexMetrics(page);
});
