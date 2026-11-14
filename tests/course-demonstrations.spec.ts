import { expect, test } from "@playwright/test";

test("3D 仍在加载时暂停，加载完成后不会自行播放", async ({ page }) => {
  let releaseModel!: () => void;
  const modelGate = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  await page.route("**/glm-flow/master/model.html?**", async (route) => {
    await modelGate;
    await route.continue();
  });
  try {
    await page.goto("/experiences/glm-flow/master/chapter.html?site=1&inline=1&segment=11");
    await expect(page.locator("#play")).toContainText("暂停");
    await page.locator("#play").click();
    await expect(page.locator("#play")).not.toContainText("暂停");
    releaseModel();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __chapter: { state: { ready: boolean } } }).__chapter.state.ready,
          ),
        { timeout: 60000 },
      )
      .toBe(true);
    await expect(page.locator("#play")).not.toContainText("暂停");
    await page.locator("#play").click();
    await expect(page.locator("#play")).toContainText("暂停");
    await page.locator("#play").click();
    await expect(page.locator("#play")).not.toContainText("暂停");
  } finally {
    releaseModel();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("正文按需打开定位演示，每次只保留一个播放实例", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/chapters/02");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("#shape table")).toBeVisible();
  await page.locator("#shape").getByRole("button", { name: "在这里播放这一步" }).click();
  const model = page.frameLocator(".lesson-demo-viewport iframe");
  await expect(model.locator("#s11")).toHaveClass(/cur/, { timeout: 60000 });
  await expect(model.locator("#play")).toContainText("暂停");
  await model.locator("#play").click();
  await expect(model.locator("#play")).not.toContainText("暂停");
  await page.screenshot({ path: "test-results/course-inline-model.png" });
  await page.locator("#tiles").getByRole("button", { name: "在这里查看部件" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  const hardware = page.frameLocator(".lesson-demo-viewport iframe");
  await expect(hardware.locator("body")).toHaveAttribute("data-level", "3");
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
  await expect(hardware.locator("#loading")).toBeHidden({ timeout: 60000 });
  await page.getByRole("button", { name: "收起演示" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.locator(".lesson-check summary").nth(1).click();
  await expect(page.locator(".lesson-check details").nth(1).locator("p")).toBeVisible();
  expect(errors).toEqual([]);
});

test("放大演示和切换视图保留来源章节与定位步骤", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/chapters/02");
  await page.locator("#shape").getByRole("link", { name: "放大查看" }).click();
  await expect(page.getByRole("link", { name: "返回第 02 章" })).toBeVisible();
  await expect(page.frameLocator(".experience-frame").locator("#s11")).toHaveClass(/cur/, { timeout: 60000 });
  await page.getByRole("link", { name: "二维架构", exact: true }).click();
  await page.getByRole("link", { name: "计算演示", exact: true }).click();
  await expect(page).toHaveURL(/segment=11/);
  await expect(page.frameLocator(".experience-frame").locator("#s11")).toHaveClass(/cur/, { timeout: 60000 });
  await page.getByRole("link", { name: "返回第 02 章" }).click();
  await expect(page).toHaveURL(/chapters\/02$/);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("手机长表和内嵌演示只在局部滚动，不撑宽正文", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chapters/02");
  await page.locator("#shape").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#shape").getByRole("button", { name: "在这里播放这一步" }).click();
  await expect(page.frameLocator(".lesson-demo-viewport iframe").locator("#s11")).toHaveClass(/cur/, {
    timeout: 60000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/course-inline-mobile.png" });
  await page.getByRole("button", { name: "收起演示" }).click();
});
