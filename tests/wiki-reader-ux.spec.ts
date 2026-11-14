import { expect, type Page, test } from "@playwright/test";

/**
 * 知识库阅读页的桌面端布局与导航（1440 宽）：
 * 正文与本页目录作为阅读整体居中，最宽 --wiki-measure（1200），放不下目录时退成按钮；
 * 问答侧栏占一列、把正文往左挤；左侧目录换页不丢展开状态；焦点去向明确。
 * 需要另起服务时用 UX_BASE_URL 指过去，不影响默认的 4173。
 */
if (process.env.UX_BASE_URL) test.use({ baseURL: process.env.UX_BASE_URL });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

async function openWiki(page: Page, id: string) {
  await page.goto(`/#/wiki/${id}`);
  await expect(page.getByTestId("wiki-body")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const groupStates = (page: Page) =>
  page
    .locator("details.wiki-toc-part")
    .evaluateAll((els) => els.map((el) => (el as HTMLDetailsElement).open));

/** 图的画布是否被迫横滚 */
const figureOverflow = (page: Page) =>
  page
    .locator(".wiki-diagram-svg")
    .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth).length);

test("左侧目录：换页后手动展开的分组保留，当前页所在分组自动展开", async ({ page }) => {
  await openWiki(page, "collective-communication");
  const before = await groupStates(page);
  const activeGroup = before.indexOf(true);
  const other = before.findIndex((open) => !open);
  expect(activeGroup).toBeGreaterThanOrEqual(0);
  await page.locator("details.wiki-toc-part").nth(other).locator("summary").click();
  expect((await groupStates(page))[other]).toBe(true);

  // 在当前分组里点另一页
  const target = page
    .locator("details.wiki-toc-part")
    .nth(activeGroup)
    .locator(".wiki-toc-group a:not(.is-active)")
    .last();
  const targetHref = (await target.getAttribute("href")) ?? "";
  await target.click();
  await expect(page.locator(".wiki-toc a.is-active")).toHaveAttribute("href", targetHref);
  const after = await groupStates(page);
  expect(after[other]).toBe(true);
  expect(after[activeGroup]).toBe(true);
});

test("左侧目录：换到远处的页，当前项滚进目录可视范围，焦点到正文", async ({ page }) => {
  await openWiki(page, "token");
  const hrefs = await page
    .locator(".wiki-toc .wiki-toc-group a")
    .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  await page.locator(".wiki-toc").evaluate((el) => {
    el.scrollTop = 0;
  });
  // 目录里最后一页：在另一个（原本收起的）分组里，目录滚在顶部时它远在视口下方
  const farHref = hrefs.at(-1)!;
  await page.evaluate((h) => {
    window.location.hash = h.replace(/^#/, "");
  }, farHref);
  const active = page.locator(".wiki-toc a.is-active");
  await expect(active).toHaveAttribute("href", farHref);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = document.querySelector(".wiki-toc a.is-active")!.getBoundingClientRect();
        const nav = document.querySelector(".wiki-toc")!.getBoundingClientRect();
        // 亚像素取整留 1px
        return a.top >= nav.top - 1 && a.bottom <= nav.bottom + 1;
      }),
    )
    .toBe(true);
  await expect(page.locator("#main-content")).toBeFocused();
});

test("--wiki-measure 只定义一次：正文最宽 1200", async ({ page }) => {
  await openWiki(page, "collective-communication");
  const measure = await page
    .locator("article.wiki-article")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).getPropertyValue("--wiki-measure")));
  expect(measure).toBe(1200);
  const article = await rectOf(page, "article.wiki-article");
  expect(article.width).toBeLessThanOrEqual(measure);
  expect(await figureOverflow(page)).toBe(0);
});

test("侧栏焦点：打开到当前页签，Home/End 切页签，aria-controls 指向面板；关闭回到入口按钮", async ({
  page,
}) => {
  await openWiki(page, "token");
  await page.getByTestId("chat-open").click();
  const tabs = page.getByRole("tab");
  await expect(tabs.first()).toBeFocused();
  for (const tab of await tabs.all()) {
    const controls = await tab.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    await expect(page.locator(`[id="${controls}"]`)).toHaveAttribute("role", "tabpanel");
  }
  await page.keyboard.press("End");
  await expect(tabs.last()).toBeFocused();
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("chat-close").click();
  await expect(page.getByTestId("chat-open")).toBeFocused();
});

/** 拖动分隔条：dx 为正向右。拖过头由 CSS 夹到上下限。 */
async function dragHandle(page: Page, side: "directory" | "assistant", dx: number) {
  const box = (await page.locator(`.reader-resize-handle.is-${side}`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 200);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

type Rect = { left: number; right: number; top: number; bottom: number; width: number };

const rectOf = (page: Page, selector: string): Promise<Rect> =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
  });

const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 本页目录常驻时，不压正文，不和侧栏、右下角「问知识库」按钮重叠 */
async function expectTocClear(page: Page) {
  const side = page.getByTestId("pagetoc-side");
  if (!(await side.isVisible())) {
    await expect(page.getByRole("button", { name: "本页目录" })).toBeVisible();
    return;
  }
  const toc = await rectOf(page, '[data-testid="pagetoc-side"]');
  expect(intersects(toc, await rectOf(page, "article.wiki-article"))).toBe(false);
  if (await page.getByTestId("chat-drawer").isVisible())
    expect(intersects(toc, await rectOf(page, ".wiki-panel"))).toBe(false);
  else expect(intersects(toc, await rectOf(page, '[data-testid="chat-open"]'))).toBe(false);
}

for (const viewport of [1440, 1920]) {
  for (const directory of ["默认", "拖宽"] as const) {
    test(`${viewport} 宽、左栏${directory}：阅读区居中、留白适度；推挤侧栏后正文仍可读`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport, height: 900 });
      await openWiki(page, "collective-communication");
      if (directory === "拖宽") await dragHandle(page, "directory", 600);

      // 正文与小目录整体居中，左右不再出现大块不对称空白。
      const closed = await rectOf(page, "article.wiki-article");
      const main = await rectOf(page, "main.wiki-main");
      const side = page.getByTestId("pagetoc-side");
      const readingRight = (await side.isVisible())
        ? (await rectOf(page, '[data-testid="pagetoc-side"]')).right
        : closed.right;
      const leftGap = closed.left - main.left;
      const rightGap = main.right - readingRight;
      expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);
      expect(Math.max(leftGap, rightGap)).toBeLessThanOrEqual(144);
      expect(closed.width).toBeGreaterThanOrEqual(800);
      expect(closed.width).toBeLessThanOrEqual(1200);
      if (closed.width >= 934) expect(await figureOverflow(page)).toBe(0);
      const breadcrumb = await rectOf(page, ".reader-breadcrumb");
      const pagination = await rectOf(page, ".reader-pagination");
      expect(Math.abs(breadcrumb.left - closed.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(pagination.left - closed.left)).toBeLessThanOrEqual(1);
      await expectTocClear(page);
      if (directory === "默认") await page.screenshot({ path: testInfo.outputPath("reader-closed.png") });

      // 打开并拖到最宽：侧栏占列，正文区右边缘 = 侧栏左边缘，正文变窄，不被盖住
      await page.getByTestId("chat-open").click();
      await expect(page.getByTestId("chat-drawer")).toBeVisible();
      await dragHandle(page, "assistant", -viewport);
      const panel = await rectOf(page, ".wiki-panel");
      const squeezed = await rectOf(page, "main.wiki-main");
      const open = await rectOf(page, "article.wiki-article");
      expect(Math.abs(squeezed.right - panel.left)).toBeLessThanOrEqual(1);
      expect(open.right).toBeLessThanOrEqual(panel.left);
      expect(open.left < closed.left || open.width < closed.width).toBe(true);
      expect(open.width).toBeGreaterThanOrEqual(480);
      await expectTocClear(page);
      if (directory === "默认") await page.screenshot({ path: testInfo.outputPath("reader-panel.png") });
      await page.getByTestId("chat-close").click();
      expect((await rectOf(page, "article.wiki-article")).width).toBeCloseTo(closed.width, 0);
    });
  }
}
