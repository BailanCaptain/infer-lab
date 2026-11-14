import { expect, test } from "@playwright/test";

test("RMS 完整矩阵与运动零件使用母版表面材质", async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.shaderSource;
    const shaders: boolean[] = [];
    Object.defineProperty(window, "rmsNativeShaders", { value: shaders });
    WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
      if (
        this.canvas instanceof HTMLCanvasElement &&
        this.canvas.closest('[data-part="rms"]') &&
        this.getShaderParameter(shader, this.SHADER_TYPE) === this.FRAGMENT_SHADER &&
        source.includes("uPage") &&
        source.includes("uCol")
      )
        shaders.push(source.includes("float shadeAt(") && source.includes("float stackEdge("));
      return original.call(this, shader, source);
    };
  });
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  const nativeShaders = () =>
    page.evaluate(() => (window as unknown as { rmsNativeShaders: boolean[] }).rmsNativeShaders);
  expect((await nativeShaders()).length).toBeGreaterThan(0);
  expect((await nativeShaders()).every(Boolean)).toBe(true);
  await part.getByRole("button", { name: "逐项平方" }).click();
  await part.getByRole("button", { name: "求 RMS" }).click();
  expect((await nativeShaders()).every(Boolean)).toBe(true);
});

test("课程正文与Wiki正文使用同一套字阶、段距和颜色", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const typography = () =>
    page
      .locator(".wiki-body > p")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          font: style.fontFamily,
          size: style.fontSize,
          line: style.lineHeight,
          margin: style.marginBottom,
          color: style.color,
        };
      });
  await page.goto("/#/chapters/03");
  await expect(page.locator(".wiki-body")).toBeVisible();
  const course = await typography();
  await page.goto("/#/wiki/layers-and-hidden");
  await expect(page.locator(".wiki-body")).toBeVisible();
  expect(await typography()).toEqual(course);
});
