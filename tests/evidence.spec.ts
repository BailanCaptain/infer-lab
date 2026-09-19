/**
 * 证据等级的可读性（用户 2026-09-11 提出：只显示一个字母会让人发懵）。
 */
import { expect, test } from "@playwright/test";

test.describe("证据等级要看得懂", () => {
  test("知识库首页给出七档图例", async ({ page }) => {
    await page.goto("/#/wiki");
    const legend = page.getByTestId("evidence-legend");
    await expect(legend).toBeVisible();
    for (const word of ["官方文档", "源码实证", "推导", "教学假设", "推断", "实测", "有冲突"]) {
      await expect(legend).toContainText(word);
    }
  });

  test("页面头部的角标带中文，不是光秃秃一个字母", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const head = page.locator(".wiki-article-head");
    await expect(head.locator(".wiki-evidence-full")).toContainText("源码实证");
  });

  test("空间紧的悬停卡仍用字母，但有 tooltip 兜底", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    await page.getByTestId("wiki-next").getByRole("link").first().hover();
    const badge = page.getByRole("tooltip").locator(".wiki-evidence");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("title", /源码|文档|推导|假设|推断|实测|冲突/);
  });
});
