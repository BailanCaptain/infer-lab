import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

for (const width of [727, 1440]) {
  test(`注意力在同一画面连续计算，标签和控件保持归属 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/chapters/03#attention");
    await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
    await openLocalScene(page, "attention");
    const part = page.locator('[data-layer-scene="attention"]');
    const scene = part.locator(".layer-scene");
    await scene.scrollIntoViewIfNeeded();
    await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
    expect((await scene.boundingBox())!.height).toBe(590);
    await expect(scene.locator(".attention-pair-sign")).toHaveCount(16);
    const positions = () =>
      scene
        .locator(".layer-label")
        .evaluateAll((nodes) =>
          nodes.map((node) => [(node as HTMLElement).style.left, (node as HTMLElement).style.top]),
        );
    const initial = await positions();
    await part
      .locator(".layer-stage")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/composition-stage-${width}.png` });
    for (const progress of [0, 0.31, 0.48, 0.78, 0.94, 1]) {
      await part.getByRole("slider").fill(String(progress));
      expect(await positions()).toEqual(initial);
      await expect(scene.locator('.attention-vector[data-role="coefficient"] .attention-cell')).toHaveCount(
        8,
      );
      await expect(scene.locator(".attention-collection-route")).toHaveCount(6);
      const box = (await scene.boundingBox())!;
      const controls = (await part.getByRole("group", { name: "3D 播放控制" }).boundingBox())!;
      expect(controls.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
      await scene.screenshot({
        path: `tools/wiki-runtime/ch03-takeover/composition-${width}-${progress}.png`,
      });
    }
    await expect(part.getByRole("figure", { name: "注意力在完整模型中的位置" })).toBeVisible();
  });
}

test("矮窗口能滚动到图下控制条并暂停", async ({ page }) => {
  await page.setViewportSize({ width: 727, height: 600 });
  await page.goto("/#/chapters/03#attention");
  await openLocalScene(page, "attention");
  const part = page.locator('[data-layer-scene="attention"]');
  await part.getByRole("button", { name: "播放计算", exact: true }).click();
  await expect
    .poll(async () => (await part.locator(".layer-scene").boundingBox())!.y)
    .toBeGreaterThanOrEqual(60);
  await part.getByRole("group", { name: "3D 播放控制" }).scrollIntoViewIfNeeded();
  const controls = (await part.getByRole("group", { name: "3D 播放控制" }).boundingBox())!;
  expect(controls.y + controls.height).toBeLessThanOrEqual(600);
  await part.getByRole("button", { name: "暂停计算", exact: true }).click();
});
