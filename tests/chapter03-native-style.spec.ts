import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("新增完整矩阵沿用认可版RMS的分组纹理与切线", async ({ page }) => {
  await page.addInitScript(() => {
    const names = new WeakMap<WebGLUniformLocation, string>();
    const values: { part: string; name: string; value: number[] }[] = [];
    Object.defineProperty(window, "nativeMatrixUniforms", { value: values });
    const originalLocation = WebGL2RenderingContext.prototype.getUniformLocation;
    const originalVector = WebGL2RenderingContext.prototype.uniform3f;
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = originalLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    WebGL2RenderingContext.prototype.uniform3f = function (location, x, y, z) {
      const name = location && names.get(location);
      const canvas = this.canvas;
      if ((name === "uDiv" || name === "uCut") && canvas instanceof HTMLCanvasElement) {
        const part = canvas.closest("[data-layer-scene], [data-part]");
        if (part)
          values.push({
            part: part.getAttribute("data-layer-scene") ?? part.getAttribute("data-part")!,
            name,
            value: [x, y, z],
          });
      }
      return originalVector.call(this, location, x, y, z);
    };
  });
  await page.goto("/#/chapters/03#rms");
  await expect(page.locator('[data-part="rms"] canvas')).toBeVisible();
  await page.goto("/#/chapters/03#attention-add");
  await openLocalScene(page, "residual-attn");
  await expect(page.locator('[data-layer-scene="residual-attn"] canvas')).toBeVisible();
  const uniforms = await page.evaluate(
    () =>
      (window as unknown as { nativeMatrixUniforms: { part: string; name: string; value: number[] }[] })
        .nativeMatrixUniforms,
  );
  for (const part of ["rms", "residual-attn"]) {
    const divisions = uniforms.filter((entry) => entry.part === part && entry.name === "uDiv");
    expect(divisions.some((entry) => entry.value.join() === "6,16,1")).toBe(true);
    expect(divisions.some((entry) => entry.value[1] === 4096)).toBe(false);
    expect(
      uniforms.some(
        (entry) => entry.part === part && entry.name === "uCut" && entry.value.join() === "1,0,0",
      ),
    ).toBe(true);
  }
});
