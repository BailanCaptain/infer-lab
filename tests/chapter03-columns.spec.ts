import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("分路只说明数据依赖，不创建复制矩阵的3D播放器", async ({ page }) => {
  await page.goto("/#/chapters/03#residual");
  await expect(page.locator("#residual")).toBeVisible();
  await expect(page.locator('[data-layer-scene="split"]')).toHaveCount(0);
  await expect(page.getByRole("figure", { name: "同一份输入的两条路径" })).toBeVisible();
  await page
    .getByRole("figure", { name: "同一份输入的两条路径" })
    .screenshot({ path: "tools/wiki-runtime/site-shell/chapter03-residual-route.png" });
});

for (const width of [1440, 390]) {
  test(`整列参与残差，分组相加后整列写回 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const original = WebGL2RenderingContext.prototype.drawElementsInstanced;
      const draws: number[] = [];
      Object.defineProperty(window, "columnDraws", { value: draws });
      WebGL2RenderingContext.prototype.drawElementsInstanced = function (
        mode,
        count,
        type,
        offset,
        instances,
      ) {
        if (
          this.canvas instanceof HTMLCanvasElement &&
          this.canvas.closest('[data-layer-scene="residual-attn"]')
        )
          draws.push(instances);
        return original.call(this, mode, count, type, offset, instances);
      };
    });
    await page.goto("/#/chapters/03#attention-add");
    await openLocalScene(page, "residual-attn");
    const part = page.locator('[data-layer-scene="residual-attn"]');
    await expect(part.locator("canvas")).toBeVisible();
    await part.getByRole("slider").fill("0.38");
    await expect(part.locator(".layer-column-work")).toBeVisible();
    expect(
      await page.evaluate(() =>
        (window as unknown as { columnDraws: number[] }).columnDraws.some((n) => n >= 16),
      ),
    ).toBe(true);
    await expect(part.locator(".layer-arithmetic")).toHaveCount(0);
    await part.locator("figcaption").click();
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/chapter03-columns-${width}-aligned.png` });
    const before = await part.locator("canvas").screenshot();
    await part.getByRole("slider").fill("0.71");
    expect((await part.locator("canvas").screenshot()).equals(before)).toBe(false);
    await part.locator("figcaption").click();
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/chapter03-columns-${width}-adding.png` });
    await part.getByRole("slider").fill("1");
    await expect(part.locator(".layer-column-status")).toContainText("整列已写回");
    await part.getByRole("slider").fill("0");
    await expect(part.locator(".layer-column-work")).toBeHidden();
  });
}
