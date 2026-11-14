import { expect, type Page, test } from "@playwright/test";

/**
 * 本页目录（2026-09-27 定稿，方案 A）：长页（H2 ≥ 4）默认就有，不带任何参数。
 * 宽屏正文右侧 sticky 导航，正文宽度不变；放不下时退成右下角「本页目录」按钮 + 浮层。
 */

async function openWiki(page: Page, id: string, query = "") {
  await page.goto(`/#/wiki/${id}${query}`);
  await expect(page.locator('[data-testid="wiki-body"] h2[id]').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 正文栏的最大宽度（.wiki-article 的 --wiki-measure）与实际宽度 */
const articleWidths = (page: Page) =>
  page.locator("article.wiki-article").evaluate((el) => ({
    measure: Number.parseFloat(getComputedStyle(el).maxWidth),
    actual: el.getBoundingClientRect().width,
  }));

test("长页默认有本页目录：1920 下正文右侧 sticky，正文放得下最宽的图；1280 下退成按钮", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWiki(page, "one-request");
  await expect(page.getByTestId("pagetoc-side")).toBeVisible();
  await expect(page.getByTestId("pagetoc-fab")).toBeHidden();
  const { measure, actual } = await articleWidths(page);
  // 目录与正文并排，正文仍放得下最宽的图（934）。
  expect(actual).toBeLessThanOrEqual(measure);
  expect(actual).toBeGreaterThanOrEqual(934);
  // 导航在正文右边，不压在正文上
  const [article, side] = await Promise.all([
    page.locator("article.wiki-article").boundingBox(),
    page.getByTestId("pagetoc-side").boundingBox(),
  ]);
  expect((side?.x ?? 0) - ((article?.x ?? 0) + (article?.width ?? 0))).toBeGreaterThanOrEqual(24);

  // 滚到中间某节：高亮跟着走
  await page.evaluate(() => document.getElementById("34-层-kda")?.scrollIntoView({ block: "start" }));
  await expect(page.locator('[data-testid="pagetoc-side"] [aria-current="location"]')).toHaveText(
    "34 层 KDA",
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("pagetoc-side")).toBeHidden();
  const fab = page.getByRole("button", { name: "本页目录" });
  await fab.click();
  const pop = page.getByTestId("pagetoc-pop");
  await expect(pop).toBeVisible();
  await expect(pop.locator("[aria-current]")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  await expect(fab).toBeFocused();

  // 点条目跳过去，浮层关上
  await fab.click();
  await pop.getByRole("link", { name: "第 7 站 返回与收尾" }).click();
  await expect(pop).toHaveCount(0);
  await expect(page).toHaveURL(/\/wiki\/one-request#/);
  // The reader's sticky header needs the heading's configured scroll margin.
  await expect
    .poll(() =>
      page
        .locator('[id="第-7-站-返回与收尾"]')
        .evaluate((el) =>
          Math.abs(el.getBoundingClientRect().top - Number.parseFloat(getComputedStyle(el).scrollMarginTop)),
        ),
    )
    .toBeLessThan(2);
  const headingTop = await page
    .locator('[id="第-7-站-返回与收尾"]')
    .evaluate((el) => el.getBoundingClientRect().top);
  const headerBottom = await page
    .locator(".reader-header")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(headingTop).toBeGreaterThanOrEqual(headerBottom);
});

test("本页目录只给长页：H2 不到 4 个时不渲染导航，正文宽度在范围内", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWiki(page, "ai-core");
  const h2 = await page.locator('[data-testid="wiki-body"] h2[id]').count();
  const expected = h2 >= 4 ? 1 : 0;
  await expect(page.getByTestId("pagetoc-side")).toHaveCount(expected);
  await expect(page.getByTestId("pagetoc-fab")).toHaveCount(expected);
  const { measure, actual } = await articleWidths(page);
  // 目录与正文并排，正文仍放得下最宽的图（934）。
  expect(actual).toBeLessThanOrEqual(measure);
  expect(actual).toBeGreaterThanOrEqual(934);
});

test("方案 B 与 ?toc= 开关已删：带旧参数也只有方案 A 的导航", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openWiki(page, "glm-5-3-flash-two-node", "?toc=b");
  await expect(page.getByTestId("pagetoc-fab")).toBeVisible();
  await expect(page.locator(".wiki-pagetoc-inline, .wiki-pagetoc-pill")).toHaveCount(0);
});

test("手机上长页只有右下角按钮，不撑出横向滚动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWiki(page, "one-request");
  await expect(page.getByTestId("pagetoc-side")).toBeHidden();
  await expect(page.getByRole("button", { name: "本页目录" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  await page.getByRole("button", { name: "本页目录" }).click();
  await page.getByTestId("pagetoc-pop").getByRole("link", { name: "第 7 站 返回与收尾" }).click();
  // The two-row mobile header and collapsed topic directory must both clear the target.
  await expect
    .poll(async () => {
      const heading = (await page.locator('[id="第-7-站-返回与收尾"]').boundingBox())!;
      const directory = (await page.locator(".reader-directory").boundingBox())!;
      return heading.y - directory.y - directory.height;
    })
    .toBeGreaterThanOrEqual(0);
});

// P3 验收：点「对照源码」，高亮落到了紧跟在它下面的「版本差异」（H3 也在旧的 96px 判定线以内）
test("点目录里的 H2 高亮这个 H2，不是它下面紧跟的 H3；点 H3 高亮 H3", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openWiki(page, "one-request");
  const side = page.getByTestId("pagetoc-side");
  const current = side.locator('[aria-current="location"]');
  await side.getByRole("link", { name: "对照源码", exact: true }).click();
  await expect(current).toHaveText("对照源码");
  await side.getByRole("link", { name: "版本差异", exact: true }).click();
  await expect(current).toHaveText("版本差异");
  await side.getByRole("link", { name: "第 7 站 返回与收尾", exact: true }).click();
  await expect(current).toHaveText("第 7 站 返回与收尾");

  // 1280 下是按钮 + 浮层：跳过去再打开，当前项还是点的那一节
  await page.setViewportSize({ width: 1280, height: 800 });
  const fab = page.getByRole("button", { name: "本页目录" });
  await fab.click();
  await page.getByTestId("pagetoc-pop").getByRole("link", { name: "对照源码", exact: true }).click();
  await fab.click();
  await expect(page.getByTestId("pagetoc-pop").locator('[aria-current="location"]')).toHaveText("对照源码");
});
