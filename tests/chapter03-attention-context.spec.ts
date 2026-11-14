import { expect, test } from "@playwright/test";
import { layerStepStart } from "../src/app/course/layer-calculation";
import { openLocalScene } from "./chapter03-local-scene";

for (const width of [727, 1440]) {
  test(`注意力从模型结构读到完整输出，播放控件位于图下 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/chapters/03#attention");
    await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
    await openLocalScene(page, "attention");
    const part = page.locator('[data-layer-scene="attention"]');
    await part.getByRole("button", { name: /投影并写回/ }).click();
    const scene = (await part.locator(".layer-scene").boundingBox())!;
    const controls = (await part.getByRole("group", { name: "3D 播放控制" }).boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(scene.y + scene.height - 1);
    const structure = part.getByRole("figure", { name: "注意力在完整模型中的位置" });
    await expect(structure).toContainText("Wq");
    await expect(structure).toContainText("Wk");
    await expect(structure).toContainText("Wv");
    await expect(structure).toContainText("softmax");
    await expect(structure).toContainText("词表投影");
    await expect(structure).toContainText("保留原输入 X");
    await page.setViewportSize({ width, height: 1300 });
    await structure.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await structure.screenshot({ path: `tools/wiki-runtime/ch03-takeover/attention-structure-${width}.png` });
    await page.setViewportSize({ width, height: 900 });
    const start = layerStepStart("attention", 3);
    await part.getByRole("slider").fill((start + (1 - start) * 0.4).toFixed(3));
    const status = part.locator(".layer-column-status");
    await expect(status).toContainText("8 个输入");
    await expect(part.locator('.attention-cell[data-role="coefficient"]')).toHaveCount(8);
    await expect(part.locator('.attention-cell[data-role="product"]')).toHaveCount(8);
    await part.getByRole("slider").fill((start + (1 - start) * 0.86).toFixed(3));
    await expect(status).toContainText("4,096 维");
    await expect(status).toContainText("Wₒ 的其余列");
    await part.getByRole("slider").fill("1");
    await expect(part.locator(".layer-caption")).toContainText("X + ΔA");
  });
}
