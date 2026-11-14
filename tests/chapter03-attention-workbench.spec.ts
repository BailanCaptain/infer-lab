import { expect, test } from "@playwright/test";
import { layerStepStart } from "../src/app/course/layer-calculation";
import { openLocalScene } from "./chapter03-local-scene";

const at = (phase: number, amount: number) => {
  const start = layerStepStart("attention", phase);
  return (start + ((phase === 3 ? 1 : layerStepStart("attention", phase + 1)) - start) * amount).toFixed(3);
};

for (const width of [727, 1440]) {
  test(`整列运算直接出现在 3D 原位，且三种运算不同 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/chapters/03#attention");
    await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
    await openLocalScene(page, "attention");
    const part = page.locator('[data-layer-scene="attention"]');
    await part.getByRole("button", { name: /整列乘比例/ }).click();
    const canvas = part.locator(".layer-scene");
    await expect(canvas.locator(".attention-vector[data-role='value']")).toHaveCount(6);
    const slider = part.getByRole("slider");
    await slider.fill(at(1, 0.995));
    const values = await canvas.locator(".attention-cell[data-role='contribution']").evaluateAll((nodes) =>
      nodes.map((n) => ({
        value: Number((n as HTMLElement).dataset.value),
        input: Number((n as HTMLElement).dataset.input),
        alpha: Number((n as HTMLElement).dataset.alpha),
      })),
    );
    expect(values).toHaveLength(48);
    for (const cell of values) expect(cell.value).toBeCloseTo(cell.input * cell.alpha, 5);
    await canvas.screenshot({ path: `tools/wiki-runtime/ch03-takeover/workbench-weight-${width}.png` });
    await slider.fill(at(2, 0.995));
    const sum = await canvas
      .locator(".attention-cell[data-role='sum']")
      .evaluateAll((nodes) => nodes.map((n) => Number((n as HTMLElement).dataset.value)));
    for (let d = 0; d < 8; d++)
      expect(sum[d]).toBeCloseTo(
        values.reduce((s, cell, i) => s + (i % 8 === d ? cell.value : 0), 0),
        5,
      );
    await canvas.screenshot({ path: `tools/wiki-runtime/ch03-takeover/workbench-sum-${width}.png` });
    await slider.fill(at(3, 0.69));
    const products = await canvas.locator(".attention-cell[data-role='product']").evaluateAll((nodes) =>
      nodes.map((n) => ({
        value: Number((n as HTMLElement).dataset.value),
        input: Number((n as HTMLElement).dataset.input),
        weight: Number((n as HTMLElement).dataset.weight),
      })),
    );
    expect(products).toHaveLength(8);
    for (const cell of products) expect(cell.value).toBeCloseTo(cell.input * cell.weight, 7);
    const scalar = Number(await canvas.locator(".attention-dot-result").getAttribute("data-value"));
    expect(scalar).toBeCloseTo(
      products.reduce((s, p) => s + p.value, 0),
      6,
    );
    await canvas.screenshot({ path: `tools/wiki-runtime/ch03-takeover/workbench-project-${width}.png` });
    const before = await canvas
      .locator(".attention-vector")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).style.cssText));
    await slider.fill(at(0, 0.2));
    expect(
      await canvas
        .locator(".attention-vector")
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).style.cssText)),
    ).toEqual(before);
    await expect(part.getByRole("alert")).toHaveCount(0);
    const sceneBox = (await canvas.boundingBox())!;
    const controls = (await part.getByRole("group", { name: "3D 播放控制" }).boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(sceneBox.y + sceneBox.height - 1);
  });
}
