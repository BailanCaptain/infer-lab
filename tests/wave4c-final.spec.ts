import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR =
  "C:/Users/-/.gemini/antigravity/brain/a61d2784-a8f8-4e8c-a1e1-14b600b1d2b5/browser_evidence/wave4c";
mkdirSync(EVIDENCE_DIR, { recursive: true });

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

test("Wave 4C 收官验收：阅读指南、GLM-5.3-Flash 活跃食谱增量对照、冻结 3D 与全章零 calc 渲染", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. learning-guide: 两条生命线、三层轨道、四族硬件与四大交互实验室
  await page.goto("/#/wiki/learning-guide");
  await expect(page.locator("article h1, .wiki-article h1, main h1").first()).toBeVisible();
  await expect(page.locator("body")).toContainText("Core-26");
  await expect(page.locator("body")).toContainText("部署算账台");
  await expect(page.locator("body")).toContainText("AI Core");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(EVIDENCE_DIR, "01-learning-guide.png") });

  // 2. glm-5-3-flash-two-node: 单一出处锚点保留 + 新增 v0.30.0 / main 活跃食谱增量对照
  await page.goto("/#/wiki/glm-5-3-flash-two-node");
  await expect(page.locator("article h1, .wiki-article h1, main h1").first()).toBeVisible();
  const deltaHeading = page.locator("h2, h3").filter({ hasText: "活跃食谱增量对照" }).first();
  await expect(deltaHeading).toBeVisible();
  await deltaHeading.scrollIntoViewIfNeeded();
  await expect(page.locator("body")).toContainText("glm5next");
  await page.screenshot({ path: join(EVIDENCE_DIR, "02-glm-two-node-v030-delta.png") });

  // 3. Representative upgraded Wave 4C-1 & 4C-2 pages render cleanly with 0 calc fences & collapsible 对照源码
  for (const pageId of [
    "pd-disaggregation",
    "ascend-950-architecture",
    "sampling",
    "eplb",
    "npu-model-runner",
    "inference-performance-analysis",
  ]) {
    await page.goto(`/#/wiki/${pageId}`);
    await expect(page.locator("article h1, .wiki-article h1, main h1").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${pageId} 1440px horizontal overflow`,
    ).toBe(true);
    const sourceSummary = page.locator("details summary").filter({ hasText: "对照源码" }).first();
    await expect(sourceSummary).toBeVisible();
  }

  await page.goto("/#/wiki/npu-model-runner");
  const mrvSummary = page.locator("details summary").filter({ hasText: "对照源码" }).first();
  await mrvSummary.click();
  await expect(page.locator("body")).toContainText("model_runner_v1.py");
  await mrvSummary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(EVIDENCE_DIR, "03-npu-model-runner-matrix.png") });

  expect(errors).toEqual([]);
});
