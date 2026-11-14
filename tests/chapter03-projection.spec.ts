import { expect, test } from "@playwright/test";
import { layerStepStart } from "../src/app/course/layer-calculation";
import { openLocalScene } from "./chapter03-local-scene";

const projectionAt = (amount: number) => {
  const start = layerStepStart("attention", 3);
  return String(Math.round((start + (1 - start) * amount) * 1000) / 1000);
};

test("整层与局部的二维关系图不依赖播放", async ({ page }) => {
  await page.goto("/#/chapters/03#two-halves");
  const route = page.getByRole("figure", { name: "一层的两条计算支路与残差连接" });
  await expect(route).toBeVisible();
  await expect(route.locator("svg path")).not.toHaveCount(0);
  await expect(route).toContainText("保留 X′");
  await expect(
    page.getByRole("figure", { name: "注意力在完整模型中的位置", includeHidden: true }),
  ).toBeAttached();
});

for (const width of [1440, 390]) {
  test(`输出投影的八项乘积与右侧输出来自同一计算 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/#/chapters/03#attention");
    await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
    await openLocalScene(page, "attention");
    const part = page.locator('[data-layer-scene="attention"]');
    await part.getByRole("button", { name: /投影并写回/ }).click();
    await expect(part.locator('[data-matrix="汇总内容"]')).toContainText("1 × 8");
    await expect(part.locator('[data-matrix="输出权重 Wₒ"]')).toContainText("8 × 4,096");
    await expect(part.locator('[data-matrix="注意力 ΔA"]')).toContainText("6 × 4,096");
    await part.getByRole("slider").fill(projectionAt(0.69));
    const status = part.locator(".layer-column-status");
    await expect(status).toHaveAttribute("data-arrived", "8");
    await expect(status).toContainText("第 1024 维");
    await part.getByText("沿同一份数据核对数值", { exact: true }).click();
    const rows = await part
      .locator(".attention-products tbody tr")
      .evaluateAll((nodes) =>
        nodes.map((node) => Array.from(node.querySelectorAll("td"), (cell) => Number(cell.textContent))),
      );
    expect(rows).toHaveLength(8);
    for (const row of rows) expect(row[1]! * row[2]!).toBeCloseTo(row[3]!, 2);
    const result = Number(await part.locator(".component-calculation").getAttribute("data-value"));
    expect(Number(await status.getAttribute("data-value"))).toBeCloseTo(result, 5);
    expect(rows.reduce((sum, row) => sum + row[3]!, 0)).toBeCloseTo(result, 2);
    await part.getByRole("slider").fill(projectionAt(0.85));
    await expect(status).toContainText("算齐 4,096 维");
    await part.getByRole("slider").fill("1");
    await expect(part.locator(".layer-caption")).toContainText("X + ΔA");
    await expect(part.locator(".layer-column-work")).toBeHidden();
  });
}
