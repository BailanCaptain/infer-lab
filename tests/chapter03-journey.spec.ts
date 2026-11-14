import { expect, test } from "@playwright/test";
import { JOURNEY_STEPS } from "../src/app/course/layer-journey";

for (const width of [727, 1440, 390])
  test(`X 到 Y 的完整播放有全部中间计算与真实两次更新 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/chapters/03#attention");
    const part = page.getByRole("region", { name: "从 X 到 Y 的完整层计算" });
    await part.locator(".journey-canvas").scrollIntoViewIfNeeded();
    await expect(part.getByRole("button", { name: "播放完整计算", exact: true })).toBeEnabled();
    await expect(part.locator(".journey-map-node")).toHaveCount(16);
    await part
      .locator(".journey-canvas")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/journey-overview-${width}.png` });
    const original = Number(await part.locator('[data-state="x"]').getAttribute("data-value"));
    let deltaA = 0;
    for (let step = 0; step < 16; step++) {
      await part.getByRole("slider").fill(((step + 0.9) / 16).toFixed(3));
      await expect(part).toHaveAttribute("data-step", String(step));
      await expect(part.locator(".journey-explanation h4")).toHaveText(JOURNEY_STEPS[step]!.title);
      await expect(part.locator(".journey-canvas canvas")).toBeVisible();
      if (step === 10) deltaA = Number(await part.locator('[data-operand="delta"]').textContent());
      expect(Number(await part.locator('[data-state="x"]').getAttribute("data-value"))).toBe(original);
    }
    await part.getByRole("slider").fill("1");
    const mid = Number(await part.locator('[data-state="mid"]').getAttribute("data-value"));
    const final = Number(await part.locator('[data-state="y"]').getAttribute("data-value"));
    const df = Number(await part.locator('[data-operand="delta"]').textContent());
    expect(mid).toBeCloseTo(original + deltaA, 3);
    expect(final).toBeCloseTo(mid + df, 3);
    await expect(part.locator('[data-state="y"]')).toHaveAttribute("data-ready", "true");
    await part
      .locator(".journey-changes")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/journey-changes-${width}.png` });
    await part.getByRole("combobox", { name: "完整计算步骤" }).selectOption("6");
    await part.getByRole("combobox", { name: "完整计算位置" }).selectOption("3");
    await expect(part.locator('tr[data-masked="true"]')).toHaveCount(2);
    await part.getByRole("button", { name: "复位完整模型视角" }).click();
    await part
      .locator(".journey-canvas")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/journey-focus-${width}.png` });
    await part.getByRole("combobox", { name: "完整计算速度" }).selectOption("4");
    await part.getByRole("button", { name: "播放完整计算", exact: true }).click();
    const before = Number(await part.getByRole("slider").inputValue());
    await expect
      .poll(async () => Number(await part.getByRole("slider").inputValue()))
      .toBeGreaterThan(before + 0.005);
    await part.getByRole("button", { name: "暂停完整计算", exact: true }).click();
    await expect(part.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  });
