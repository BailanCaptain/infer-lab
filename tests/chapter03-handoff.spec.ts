import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("第三章符号公式保留等号，正文与演示共享阅读列", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/chapters/03#whole-layer");
  const formula = page.getByRole("figure", { name: "这一层的完整依赖关系", exact: true });
  await expect(formula).toContainText("N₁ = RMSNorm₁(X)");
  await expect(formula).toContainText("Y  = X′ + ΔF");
  const opening = (await page.locator("#two-halves").boundingBox())!;
  const rms = (await page.locator("#rms").boundingBox())!;
  expect(Math.abs(opening.x - rms.x)).toBeLessThan(2);
  expect(Math.abs(opening.width - rms.width)).toBeLessThan(2);
  await formula.screenshot({ path: "tools/wiki-runtime/ch03-takeover/formulas.png" });
  await page.goto("/#/chapters/03#ffn");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "tools/wiki-runtime/ch03-takeover/ffn-reading.png" });
});

test("矮桌面窗口开始播放时不遮住参数标题且可以暂停", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 712 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const part = page.locator('[data-layer-scene="ffn"]');
  await part.getByRole("button", { name: "播放计算", exact: true }).click();
  await expect.poll(async () => Number(await part.getByRole("slider").inputValue())).toBeGreaterThan(0.03);
  const steps = (await part.getByRole("group", { name: "计算步骤" }).boundingBox())!;
  for (const label of await part.locator(".layer-label:visible").all()) {
    expect((await label.boundingBox())!.y).toBeGreaterThan(steps.y + steps.height);
  }
  await expect(part.getByRole("button", { name: "暂停计算", exact: true })).toBeInViewport();
  await part.getByRole("button", { name: "暂停计算", exact: true }).click();
});
