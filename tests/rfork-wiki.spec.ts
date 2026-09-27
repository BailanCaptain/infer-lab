import { expect, test } from "@playwright/test";

test("RFork 专章可从目录阅读、跨页跳转，并核对工作版来源", async ({ page }, info) => {
  await page.goto("/#/wiki/rfork");
  const toc = page.getByTestId("toc-rfork");
  await expect(toc.getByRole("link")).toHaveCount(10);
  await expect(page.getByTestId("wiki-versions")).toContainText("RFork 工作版");
  await expect(page.getByTestId("toc-params").locator(".wiki-toc-chapter")).toHaveText("十");
  await expect(page.getByTestId("wiki-body").locator("figure svg")).toBeVisible();
  await page.screenshot({ path: info.outputPath("rfork-overview.png"), fullPage: true });
  await page.getByTestId("wiki-body").getByRole("link", { name: "传输与内存", exact: true }).click();
  await expect(page).toHaveURL(/#\/wiki\/rfork-transfer$/);
  await expect(page.getByTestId("wiki-body")).toContainText("登记了地址");
  await toc.getByRole("link", { name: /^RFork 排错/ }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("400 本身不能证明 TTL 过期");
  const source = page.locator('a[href*="github.com/yangsonglin13/vllm-ascend/blob/3284850b/"]');
  expect(await source.count()).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("rfork-troubleshooting.png"), fullPage: true });
});

test("RFork 六张机制图可完整显示", async ({ page }, info) => {
  for (const id of [
    "rfork",
    "rfork-startup",
    "rfork-identity",
    "rfork-layout",
    "rfork-transfer",
    "rfork-lifecycle",
  ]) {
    await page.goto(`/#/wiki/${id}`);
    const figure = page.getByTestId("wiki-body").locator("figure");
    await expect(figure.locator("svg")).toBeVisible();
    await figure.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${id}-diagram.png`) });
  }
});
