import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

for (const width of [1440]) {
  test(`所有矩阵预先摆出，阶段切换不替换身份或维度 ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/chapters/03#attention-add");
    for (const kind of ["residual-attn", "ffn", "residual-ffn", "attention"]) {
      await openLocalScene(page, kind);
      const part = page.locator(`[data-layer-scene="${kind}"]`);
      await part.locator(".layer-scene").scrollIntoViewIfNeeded();
      await expect(part.locator("canvas")).toBeVisible();
      await expect(part.getByRole("button", { name: "播放计算" })).toBeEnabled();
      await expect(part.getByRole("alert")).toHaveCount(0);
      const labels = part.locator(".layer-label");
      const count = kind === "ffn" ? 8 : kind === "attention" ? 6 : 3;
      await expect(labels).toHaveCount(count);
      const original = await labels.elementHandles();
      const names = await labels.locator("strong").allTextContents();
      const shapes = await labels.locator("span").allTextContents();
      for (const progress of [0, 0.22, 0.249, 0.251, 0.49, 0.51, 0.74, 0.76, 0.94, 1]) {
        await part.getByRole("slider").fill(String(progress));
        await expect(part.locator(".layer-label:visible")).toHaveCount(count);
        expect(await labels.locator("strong").allTextContents()).toEqual(names);
        expect(await labels.locator("span").allTextContents()).toEqual(shapes);
        if (kind === "attention") {
          const mixture = labels.filter({ hasText: "混合比例" });
          await expect(mixture).toHaveAttribute("data-matrix", "混合比例");
          await expect(mixture.locator("span")).toHaveText("6 × 1");
          await expect(mixture).not.toContainText("参数");
        }
        for (const label of original) expect(await label.evaluate((node) => node.isConnected)).toBe(true);
      }
      await expect(part.locator(".projection-detail")).toBeHidden();
      await part.locator(":scope > figcaption").click();
      await part.screenshot({
        path: `tools/wiki-runtime/site-shell/persistent-${width}-${kind}-complete.png`,
      });
    }
  });
}
