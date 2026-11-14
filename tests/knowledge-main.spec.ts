import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px 主题目录独立滚动到底，滚轮不带动正文`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/wiki");
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    if (viewport.width <= 1024) await page.getByText("主题目录", { exact: true }).click();
    const directory = page.getByTestId("wiki-toc");
    await directory.getByTestId("toc-models").locator("summary").click();
    const bounds = (await directory.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    const pageTop = await page.evaluate(() => window.scrollY);
    const before = await directory.evaluate((el) => el.scrollTop);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => directory.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
    await page.mouse.wheel(0, 10000);
    await expect(directory.getByText("内容与版本", { exact: true })).toBeInViewport();
    await expect
      .poll(() => directory.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
      .toBeLessThanOrEqual(1);
    // At the lower boundary another wheel gesture must not spill into the article.
    await page.mouse.wheel(0, 600);
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(pageTop);
    await page.screenshot({ path: `test-results/directory-scroll-${viewport.width}.png` });
  });
}

// 344px also covers a 359px browser pane with a 15px native scrollbar.
for (const width of [1440, 344, 359]) {
  test(`${width}px 首页唯一入口进入知识主站并可返回`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/wiki");
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    const home = page
      .getByRole("navigation", { name: "全站导航" })
      .getByRole("link", { name: "首页", exact: true });
    await expect(home).toBeInViewport();
    if (width < 640) {
      await page.evaluate(() => document.fonts.ready);
      for (const selector of [".reader-brand > span", ".reader-header .site-nav strong"]) {
        const heights = await page.locator(selector).evaluateAll((elements) =>
          elements.map((element) => ({
            height: element.getBoundingClientRect().height,
            line: Number.parseFloat(getComputedStyle(element).lineHeight),
          })),
        );
        for (const { height, line } of heights) expect(height).toBeLessThanOrEqual(line + 1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await home.click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page).toHaveTitle("大模型推理之旅 · AI Infra");
    await expect(page.getByTestId("city-scene")).toBeVisible();
    const entry = page.getByRole("link", { name: "开始阅读" });
    await expect(page.locator("a, button")).toHaveCount(1);
    await entry.click();
    await expect(page).toHaveURL(/\/wiki$/);
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    await page.locator(".wiki-start-link").click();
    await expect(page).toHaveURL(/\/wiki\/learning-guide$/);
    await expect(page.getByTestId("wiki-body")).toBeVisible();
    await expect(page.getByTestId("city-scene")).toHaveCount(0);
    await page.locator(".reader-breadcrumb").getByRole("link", { name: "主章节", exact: true }).click();
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    await home.click();
    await page.reload();
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  });
}

test("主章节入口呈现主题目录，全文与章节翻页使用知识库", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/#/wiki");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("大模型推理");
  await expect(
    page.getByRole("navigation", { name: "全站导航" }).getByRole("link", { name: "主章节", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "全站导航" }).getByRole("link", { name: "主章节", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  await page.screenshot({ path: "test-results/knowledge-home-desktop.png" });
  const directory = page.getByTestId("wiki-toc");
  await directory.getByRole("searchbox").fill("embedding");
  expect(await directory.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await directory.getByRole("link", { name: /^Embedding/ }).click();
  await expect(page).toHaveURL(/\/wiki\/embedding$/);
  await expect(
    page.getByTestId("wiki-body").getByRole("heading", { name: "对照源码", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("wiki-body").locator("figure svg").first()).toBeVisible();
  await expect(page.locator(".wiki-calc").first()).toBeVisible();
  await expect(directory.getByRole("link", { name: /^Embedding/ })).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "章节翻页" })
    .getByRole("link", { name: /下一节/ })
    .click();
  await expect(page).toHaveURL(/\/wiki\/matmul-and-weights$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("矩阵");
  expect(requests.filter((url) => /\.glb(?:\?|$)|\/experiences\/.*\.html/.test(url))).toEqual([]);
  await page.screenshot({ path: "test-results/knowledge-reading-desktop.png" });
});

test("手机目录可打开、搜索、关闭并继续阅读", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/wiki");
  const directory = page.getByTestId("wiki-toc");
  await expect(directory).toBeHidden();
  await page.getByText("主题目录", { exact: true }).click();
  await directory.getByRole("searchbox").fill("不存在的主题987");
  await expect(directory).toContainText("没有匹配的页面");
  await directory.getByRole("searchbox").fill("embedding");
  await directory.getByRole("link", { name: /^Embedding/ }).click();
  await expect(directory).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Embedding");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByTestId("chat-open").click();
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
  await page.getByTestId("chat-close").click();
  await expect(page.getByTestId("chat-drawer")).toHaveCount(0);
  await page.screenshot({ path: "test-results/knowledge-reading-mobile.png" });
});

test("辅助探索可以从主章节进入并返回主题目录", async ({ page }) => {
  await page.goto("/#/wiki");
  await page
    .getByRole("navigation", { name: "全站导航" })
    .getByRole("link", { name: "模型", exact: true })
    .click();
  await expect(page).toHaveURL(/\/model$/);
  await expect(page.frameLocator(".experience-frame").locator("#play")).toBeEnabled({ timeout: 60000 });
  await page.getByRole("link", { name: "返回主章节", exact: true }).click();
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  await page
    .getByRole("navigation", { name: "全站导航" })
    .getByRole("link", { name: "硬件", exact: true })
    .click();
  await expect(page).toHaveURL(/\/hardware$/);
  await expect(page.frameLocator(".experience-frame").locator("#loading")).toBeHidden({ timeout: 60000 });
  await page.getByRole("link", { name: "返回主章节", exact: true }).click();
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
});
