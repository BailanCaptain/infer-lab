import { expect, test } from "@playwright/test";

test("正文分块加载失败后可以重试，目录仍然可用", async ({ page }) => {
  await page.route("**/api/wiki/pages", (route) => route.abort());
  let fail = true;
  await page.route(/\/assets\/one-request-[^/]+\.js$/, (route) => (fail ? route.abort() : route.continue()));
  await page.goto("/#/wiki/one-request");
  await expect(page.getByRole("searchbox", { name: "搜索知识库目录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("一条请求要走过七站");
});

test("同页目录跳转保留正文表格和图，不重新挂载整篇 Markdown", async ({ page }) => {
  await page.route("**/api/wiki/pages", (route) => route.abort());
  await page.goto("/#/wiki/one-request");
  const table = page.getByTestId("wiki-body").locator("table").first();
  await expect(table).toBeVisible();
  await table.evaluate((element) => Object.assign(window, { originalArticleTable: element }));
  await page.evaluate(() => {
    location.hash = "/wiki/one-request#对照源码";
  });
  await expect(page).toHaveURL(/对照源码|%E5%AF%B9/);
  await expect
    .poll(() =>
      table.evaluate(
        (element) => element === (window as Window & { originalArticleTable?: Element }).originalArticleTable,
      ),
    )
    .toBe(true);
});
