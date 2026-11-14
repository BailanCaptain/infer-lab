import { expect, test } from "@playwright/test";

test("手机首页文字不小于 10px，操作文字不小于 12px", async ({ page }) => {
  await page.setViewportSize({ width: 359, height: 646 });
  await page.goto("/#/wiki");
  for (const selector of [".reader-intro .eyebrow", ".reader-collection-note", ".reader-topic p"]) {
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      selector,
    ).toBeGreaterThanOrEqual(10);
  }
  expect(
    await page
      .locator(".reader-header .site-nav strong")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("主章节导航与正文说明保持可读对比度", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/chapters");
  for (const selector of [
    ".reader-intro > p",
    ".reader-collection-note",
    ".reader-topic > p",
    ".wiki-start-link",
  ]) {
    const contrast = await page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((channel) => {
              const srgb = channel / 255;
              return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
            });
          return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
        };
        const style = getComputedStyle(element);
        const background = getComputedStyle(
          element.closest(".wiki-start") ?? document.querySelector(".knowledge-reader")!,
        ).backgroundColor;
        const a = luminance(style.color);
        const b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    expect(contrast, selector).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: "test-results/typography-course.png" });
});

test("GLM 嵌套画布和硬件正文加载同一套中西文字体", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const failedFonts: string[] = [];
  page.on("response", (response) => {
    if (/\.(woff2?|css)(\?|$)/.test(response.url()) && response.status() >= 400)
      failedFonts.push(response.url());
  });
  await page.goto("/#/model");
  const chapter = page.frameLocator(".experience-frame");
  await expect(chapter.locator("#play")).toBeEnabled({ timeout: 60000 });
  for (const body of [chapter.locator("body"), chapter.frameLocator("#right iframe").locator("body")]) {
    await expect(body).toHaveCSS("font-family", /Inter Variable.*Noto Sans SC/);
    await expect
      .poll(() =>
        body.evaluate(async (element) => {
          await element.ownerDocument.fonts.ready;
          return [...element.ownerDocument.fonts]
            .filter((font) => font.status === "loaded")
            .map((font) => font.family);
        }),
      )
      .toEqual(expect.arrayContaining(["Inter Variable", "Noto Sans SC"]));
  }
  await page.screenshot({ path: "test-results/typography-glm.png" });
  await page.goto("/#/hardware");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden({ timeout: 60000 });
  await expect(hardware.locator("body")).toHaveCSS("font-family", /Inter Variable.*Noto Sans SC/);
  await expect(hardware.locator("#diagram svg").first()).toHaveCSS("font-family", /Noto Sans SC/);
  for (const selector of [".vendors button", ".dock button b", ".viewtools button"]) {
    expect(
      await hardware
        .locator(selector)
        .first()
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(12);
  }
  await page.screenshot({ path: "test-results/typography-hardware.png" });
  expect(failedFonts).toEqual([]);
});
