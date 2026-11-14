import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("比例的来源、对应内容和 3D 运算可以连续追踪", async ({ page }) => {
  await page.setViewportSize({ width: 727, height: 900 });
  await page.goto("/#/chapters/03#attention");
  await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
  await openLocalScene(page, "attention");
  const part = page.locator('[data-layer-scene="attention"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.getByRole("figure", { name: "注意力在完整模型中的位置" })).toBeVisible();
  await part.getByText("沿同一份数据核对数值", { exact: true }).click();
  const sources = part.locator(".attention-source-choice");
  await expect(sources).toHaveCount(6);
  await part
    .locator(".attention-sources")
    .screenshot({ path: "tools/wiki-runtime/ch03-takeover/research-sources-727.png" });
  const values = await sources.evaluateAll((nodes) =>
    nodes.map((node) => ({
      alpha: Number((node as HTMLElement).dataset.alpha),
      value: Number((node as HTMLElement).dataset.value),
      product: Number((node as HTMLElement).dataset.product),
    })),
  );
  expect(values.reduce((sum, item) => sum + item.alpha, 0)).toBeCloseTo(1, 6);
  for (const item of values) expect(item.product).toBeCloseTo(item.alpha * item.value, 6);
  await sources.nth(3).click();
  await expect(part).toHaveAttribute("data-phase", "1");
  await expect(part.locator('.attention-token[data-active="true"]')).toHaveText("花儿");
  await expect(part.locator(".layer-column-status")).toContainText("花儿");
  await part
    .locator(".layer-stage")
    .screenshot({ path: "tools/wiki-runtime/ch03-takeover/research-trace-727.png" });
  await part.getByRole("combobox", { name: "核对位置" }).selectOption("3");
  await expect(sources.nth(4)).toBeDisabled();
  await expect(sources.nth(5)).toBeDisabled();
  await expect(sources.nth(4)).toContainText("不可见");
  await expect(part.getByRole("alert")).toHaveCount(0);
});
