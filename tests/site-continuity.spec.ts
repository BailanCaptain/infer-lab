import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as Window & { frameCallbacks: number };
    scope.frameCallbacks = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        scope.frameCallbacks++;
        callback(time);
      });
  });
});

test("切换测量：共享页头，硬件静止时不持续绘制", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const begin = Date.now();
  await page.goto("/#/wiki");
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  const readingMs = Date.now() - begin;
  const header = await page.locator(".reader-header").boundingBox();
  let beginSwitch = Date.now();
  await page.getByRole("link", { name: "模型", exact: true }).click();
  await expect(page).toHaveURL(/\/model$/);
  const modelSwitchMs = Date.now() - beginSwitch;
  const modelHeaderCount = await page.locator(".reader-header").count();
  await expect(page.frameLocator(".experience-frame").locator("#play")).toBeEnabled();
  const modelReadyMs = Date.now() - beginSwitch;
  const modelPixels = await page
    .frameLocator(".experience-frame")
    .frameLocator("#stage")
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => ({
      pixels: canvas.width * canvas.height,
      css: canvas.clientWidth * canvas.clientHeight,
    }));
  beginSwitch = Date.now();
  await page.getByRole("link", { name: "硬件", exact: true }).click();
  await expect(page).toHaveURL(/\/hardware$/);
  const hardwareSwitchMs = Date.now() - beginSwitch;
  const hardwareHeaderCount = await page.locator(".reader-header").count();
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden();
  const hardwareReadyMs = Date.now() - beginSwitch;
  await page.waitForTimeout(2200);
  const count = () =>
    hardware
      .locator("body")
      .evaluate((el) => (el.ownerDocument.defaultView as Window & { frameCallbacks: number }).frameCallbacks);
  const before = await count();
  await page.waitForTimeout(1000);
  const idleFrames = (await count()) - before;
  beginSwitch = Date.now();
  await page.getByRole("link", { name: "主章节", exact: true }).click();
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  console.log(
    JSON.stringify({
      readingMs,
      modelSwitchMs,
      modelReadyMs,
      hardwareSwitchMs,
      hardwareReadyMs,
      returnMs: Date.now() - beginSwitch,
      idleFrames,
      modelPixels,
      modelHeaderCount,
      hardwareHeaderCount,
      header,
    }),
  );
  expect(modelHeaderCount).toBe(1);
  expect(hardwareHeaderCount).toBe(1);
  expect(idleFrames).toBe(0);
  expect(modelPixels.pixels).toBeLessThanOrEqual(2_500_000);
  // This context uses DPR 1; do not supersample it at a forced DPR of 1.5 or 2.
  expect(modelPixels.pixels).toBeLessThanOrEqual(modelPixels.css);
});

test("宽屏阅读使用可用宽度，常见宽图完整显示", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/wiki/embedding");
  const article = page.locator(".wiki-article");
  await expect(article).toBeVisible();
  const box = (await article.boundingBox())!;
  const diagrams = await page
    .locator(".wiki-diagram-svg")
    .evaluateAll((elements) => elements.map((el) => ({ width: el.clientWidth, scroll: el.scrollWidth })));
  console.log(JSON.stringify({ articleWidth: box.width, diagrams }));
  expect(box.width).toBeGreaterThanOrEqual(1050);
  expect(diagrams.every(({ width, scroll }) => scroll <= width + 1)).toBe(true);
  await page.locator(".wiki-diagram").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reader-wide.png" });
});

test("硬件按需绘制仍响应柜门、视角、自动环绕与展开", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hardware");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden();
  const count = () =>
    hardware
      .locator("body")
      .evaluate((el) => (el.ownerDocument.defaultView as Window & { frameCallbacks: number }).frameCallbacks);
  await page.waitForTimeout(1500);
  const closed = await hardware.locator("canvas").screenshot();
  await hardware.locator("#door").click();
  await expect(hardware.locator("#door")).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(5000);
  expect((await hardware.locator("canvas").screenshot()).equals(closed)).toBe(false);
  let before = await count();
  await page.waitForTimeout(500);
  expect(await count()).toBe(before);
  await page.screenshot({ path: "test-results/reader-hardware.png" });
  await hardware.locator("#top").click();
  await expect.poll(count).toBeGreaterThan(before);
  const top = await hardware.locator("canvas").screenshot();
  await hardware.locator("#rotate").click();
  before = await count();
  await expect.poll(count).toBeGreaterThan(before + 3);
  expect((await hardware.locator("canvas").screenshot()).equals(top)).toBe(false);
  await hardware.locator("#rotate").click();
  await hardware.locator('[data-level="2"]').click();
  // Opening the spread slider changes the stage's height without a window resize.
  await expect
    .poll(async () => {
      const canvas = (await hardware.locator("canvas").boundingBox())!;
      const controls = (await hardware.locator(".viewtools").boundingBox())!;
      return canvas.y + canvas.height - controls.y;
    })
    .toBeLessThanOrEqual(0);
  await page.waitForTimeout(1500);
  const together = await hardware.locator("canvas").screenshot();
  await hardware.locator("#spread").press("End");
  await expect(hardware.locator("#amount")).toHaveText("100%");
  await page.waitForTimeout(300);
  expect((await hardware.locator("canvas").screenshot()).equals(together)).toBe(false);
  before = await count();
  await page.waitForTimeout(500);
  expect(await count()).toBe(before);
  await page.screenshot({ path: "test-results/ai-infra-hardware.png" });
  expect(errors).toEqual([]);
});

test("模型四种视图沿用统一顶栏，手机切换不挤出横向页面", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/model");
  await expect(page.frameLocator(".experience-frame").locator("#play")).toBeEnabled();
  const header = (await page.locator(".reader-header").boundingBox())!;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/reader-model.png" });
  for (const name of ["整个模型", "单层结构", "二维架构"]) {
    await page.getByRole("link", { name, exact: true }).click();
    const frame = page.frameLocator(".experience-frame");
    await expect(frame.locator(name === "二维架构" ? "svg" : "canvas").first()).toBeVisible();
    expect(await page.locator(".reader-header").boundingBox()).toEqual(header);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["主章节", "硬件", "模型"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.locator(".reader-header")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const mobileModel = page.frameLocator(".experience-frame").frameLocator("#stage").locator("canvas");
  await expect(mobileModel).toBeVisible();
  const modelBox = (await mobileModel.boundingBox())!;
  expect(modelBox.x + modelBox.width).toBeLessThanOrEqual(390);
  expect(modelBox.height).toBeGreaterThanOrEqual(200);
  await page.screenshot({ path: "test-results/reader-explore-mobile.png" });
});

test("手机模型内部标题正常换行，视角操作排在标题之后", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ["model", "layer"]) {
    await page.goto(`/#/model?view=${view}`);
    const frame = page.frameLocator(".experience-frame");
    await expect(frame.locator("#title")).toBeVisible();
    const title = (await frame.locator("#title").boundingBox())!;
    const controls = (await frame.locator("#views").boundingBox())!;
    expect(title.width).toBeGreaterThan(300);
    expect(title.height).toBeLessThan(160);
    expect(controls.y).toBeGreaterThanOrEqual(title.y + title.height);
    await expect(frame.locator("canvas")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/compact-${view}-mobile.png` });
  }
});
