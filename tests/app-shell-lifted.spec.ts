import { expect, test } from "@playwright/test";

test("AppShell 提升的快捷搜索与持久化问答抽屉在非 Wiki 读者路由可用，且跨路由不丢失状态", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. /#/model 具备快捷搜索按钮与助手 FAB
  await page.goto("/#/model");
  await expect(page.getByTestId("wiki-quick-search-trigger")).toBeVisible();
  await expect(page.getByTestId("chat-open")).toBeVisible();

  // Ctrl+K 打开全库快捷搜索并关闭
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "全库快捷搜索" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "全库快捷搜索" })).toHaveCount(0);

  // 2. /#/hardware 同样具备快捷搜索与助手 FAB
  await page.goto("/#/hardware");
  await expect(page.getByTestId("wiki-quick-search-trigger")).toBeVisible();
  await expect(page.getByTestId("chat-open")).toBeVisible();

  // 3. 在 /#/wiki/block-table 打开助手抽屉并输入草稿，切到 /#/model 后抽屉保持打开且输入不丢
  await page.goto("/#/wiki/block-table");
  await page.getByTestId("chat-open").click();
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
  const chatInput = page.getByTestId("chat-input");
  await chatInput.fill("KV cache 块大小");
  await page
    .getByRole("navigation", { name: "全站导航" })
    .getByRole("link", { name: "模型", exact: true })
    .click();
  await expect(page).toHaveURL(/\/model$/);
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toHaveValue("KV cache 块大小");
});

test("/#/home 仍保持单一入口按钮，/#/chapters/00 不渲染 Wiki 助手或快捷搜索", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/home");
  await expect(page.locator("a, button")).toHaveCount(1);
  await expect(page.getByTestId("chat-open")).toHaveCount(0);
  await expect(page.getByTestId("wiki-quick-search-trigger")).toHaveCount(0);

  await page.goto("/#/chapters/00");
  await expect(page.getByTestId("chat-open")).toHaveCount(0);
  await expect(page.getByTestId("wiki-quick-search-trigger")).toHaveCount(0);
});
