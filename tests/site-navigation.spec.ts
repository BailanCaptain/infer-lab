import { expect, test } from "@playwright/test";

test("首页阅读按钮交互时暂停绘制，移开后继续环绕", async ({ page }) => {
  await page.goto("/#/home");
  const scene = page.getByTestId("city-scene");
  await expect(scene).toHaveAttribute("data-scene-ready", "true");
  await page.getByRole("link", { name: "开始阅读" }).hover();
  await page.waitForTimeout(500);
  const paused = await scene.getAttribute("data-render-count");
  await page.waitForTimeout(600);
  expect(await scene.getAttribute("data-render-count")).toBe(paused);
  await page.mouse.move(10, 10);
  await expect
    .poll(async () => Number(await scene.getAttribute("data-render-count")))
    .toBeGreaterThan(Number(paused));
});

for (const destination of [
  { label: "主章节", chunk: "WikiPage", path: "wiki", status: "正在载入知识库…" },
  { label: "首页", chunk: "HomePage", path: "home", status: "正在载入首页…" },
]) {
  test(`首次进入${destination.label}时先切换页面，不等待代码下载`, async ({ page }) => {
    await page.goto("/#/hardware");
    const hardware = page.frameLocator(".experience-frame");
    await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
    await expect(hardware.locator("#loading")).toBeHidden();
    let release!: () => void;
    const download = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(new RegExp(`/assets/${destination.chunk}-.*\\.js$`), async (route) => {
      await download;
      await route.continue();
    });
    try {
      await page.getByRole("link", { name: destination.label, exact: true }).click();
      await expect(page.getByRole("status")).toHaveText(destination.status, { timeout: 1000 });
      await expect(page.locator(".experience-frame")).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/${destination.path}$`));
      if (destination.path === "wiki") {
        await expect(page.getByRole("link", { name: "主章节", exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
        // A pending download must not prevent switching to another entrance.
        await page.getByRole("link", { name: "模型", exact: true }).click();
        await expect(page.locator(".experience-page h1")).toHaveText("模型探索");
      }
    } finally {
      release();
    }
  });
}

test("四个入口来回切换，记录导航与内容就绪时间", async ({ page }) => {
  await page.addInitScript(() => {
    const events: { type: string; time: number }[] = [];
    Object.assign(window, { navigationEvents: events });
    for (const type of ["pointerdown", "click"]) {
      document.addEventListener(type, () => events.push({ type, time: performance.now() }), true);
    }
    const push = history.pushState.bind(history);
    history.pushState = (...args) => {
      events.push({ type: "route", time: performance.now() });
      push(...args);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/home");
  await expect(page.getByTestId("city-scene")).toHaveAttribute("data-scene-ready", "true");
  const timings = [];
  for (const target of ["主章节", "模型", "硬件", "主章节", "首页", "主章节", "硬件"]) {
    const link = page.getByRole("link", {
      name: target === "主章节" && /\/home$/.test(page.url()) ? "开始阅读" : target,
      exact: true,
    });
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    // Measure real pointer input separately from Playwright's RAF-based stability wait.
    const start = Date.now();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const path = { 主章节: "wiki", 模型: "model", 硬件: "hardware", 首页: "home" }[target];
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    const navigationMs = Date.now() - start;
    if (target === "主章节") await expect(page.getByTestId("knowledge-topics")).toBeVisible();
    if (target === "首页")
      await expect(page.getByTestId("city-scene")).toHaveAttribute("data-scene-ready", "true");
    if (target === "模型")
      await expect(page.frameLocator(".experience-frame").locator("#play")).toBeEnabled();
    if (target === "硬件") {
      const hardware = page.frameLocator(".experience-frame");
      await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
      await expect(hardware.locator("#loading")).toBeHidden();
    }
    const events = await page.evaluate(() =>
      (window as Window & { navigationEvents: { type: string; time: number }[] }).navigationEvents.slice(-3),
    );
    timings.push({ target, navigationMs, readyMs: Date.now() - start, events });
  }
  console.log(JSON.stringify({ navigation: timings }));
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/navigation-hardware.png" });
});
