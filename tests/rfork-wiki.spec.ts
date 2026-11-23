import { expect, test } from "@playwright/test";

test("RFork 专章可从目录阅读、跨页跳转，并核对上游 main 来源", async ({ page }, info) => {
  await page.goto("/#/wiki/rfork");
  const toc = page.getByTestId("toc-rfork");
  await expect(toc.getByRole("link")).toHaveCount(9);
  await expect(page.getByTestId("wiki-versions")).toContainText("main");
  await expect(page.getByTestId("toc-params").locator(".wiki-toc-chapter")).toHaveText("12");
  await expect(page.getByTestId("wiki-body").locator(".wiki-diagram svg").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("rfork-overview.png"), fullPage: true });
  await page.getByTestId("wiki-body").getByRole("link", { name: "传输", exact: true }).first().click();
  await expect(page).toHaveURL(/#\/wiki\/rfork-transfer$/);
  await expect(page.getByTestId("wiki-body")).toContainText("登记了地址");
  await toc.getByRole("link", { name: /^RFork 排错/ }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("400 本身不能证明租约过期");
  const source = page.locator('a[href*="github.com/vllm-project/vllm-ascend/blob/8d6180e2/"]');
  expect(await source.count()).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("rfork-troubleshooting.png"), fullPage: true });
});

test("RFork 六页的机制图均可完整显示", async ({ page }, info) => {
  for (const [id, title] of [
    ["rfork", "RFork："],
    ["rfork-startup", "RFork 启动："],
    ["rfork-identity", "RFork 身份匹配："],
    ["rfork-layout", "RFork 张量布局："],
    ["rfork-transfer", "RFork 传输："],
    ["rfork-lifecycle", "RFork 生命周期："],
  ]) {
    await page.goto(`/#/wiki/${id}`);
    // A hash navigation can return while the previous article is still mounted.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title!);
    await page.evaluate(() => document.fonts.ready);
    const figures = page.getByTestId("wiki-body").locator(".wiki-diagram");
    await expect(figures.first().locator("svg")).toBeVisible();
    for (let i = 0; i < (await figures.count()); i++) {
      const figure = figures.nth(i);
      const svg = figure.locator("svg");
      await figure.scrollIntoViewIfNeeded();
      await expect(svg).toBeVisible();
      await expect(svg).toBeInViewport();
      const fits = await figure.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(fits, `${id} 图 ${i + 1} 横向溢出`).toBe(true);
      await page.screenshot({ path: info.outputPath(`${id}-diagram-${i + 1}.png`) });
    }
  }
});
