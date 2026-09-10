/**
 * 知识库阅读页浏览器验收（F001 AC6 / 计划 Phase 3 Task 21）：
 * - #/wiki 目录列出全部页面，点开能读正文；
 * - 页面间相对链接改写成 hash 路由并可跳转；
 * - <Term> 悬停出摘要卡；
 * - 来源角标指向 GitHub 钉住的行号。
 */
import { expect, test } from "@playwright/test";

test.describe("知识库阅读页", () => {
  test("目录列出页面，点开能读正文", async ({ page }) => {
    await page.goto("/#/wiki");
    const nav = page.getByTestId("wiki-toc");
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    expect(await items.count()).toBeGreaterThanOrEqual(11);

    await nav.getByRole("link", { name: "Block Table" }).click();
    await expect(page).toHaveURL(/#\/wiki\/block-table$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Block Table");
    await expect(page.getByRole("heading", { name: "是什么" })).toBeVisible();
  });

  test("正文里指向其它页的链接可跳转", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const body = page.getByTestId("wiki-body");
    const internal = body.locator('a[href^="#/wiki/"]').first();
    await expect(internal).toBeVisible();
    const href = await internal.getAttribute("href");
    await internal.click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace("#", "\\#")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("related 侧栏的词条悬停出摘要卡", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const term = page.getByTestId("wiki-related").getByRole("link").first();
    await expect(term).toBeVisible();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await term.hover();
    const card = page.getByRole("tooltip");
    await expect(card).toBeVisible();
    await expect(card).not.toBeEmpty();
  });

  test("来源角标指向 GitHub 钉住的行号", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const src = page.getByTestId("wiki-sources").getByRole("link").first();
    await expect(src).toHaveAttribute(
      "href",
      /^https:\/\/github\.com\/vllm-project\/vllm-ascend\/blob\/[0-9a-f]{7,40}\/.+#L\d+/,
    );
  });

  test("未知 id 给出空态而不是白屏", async ({ page }) => {
    await page.goto("/#/wiki/no-such-page");
    await expect(page.getByTestId("wiki-notfound")).toBeVisible();
  });
});
