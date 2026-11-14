import { expect, test } from "@playwright/test";

for (const width of [727, 1440, 390])
  test(`完整模型不随计算步骤替换或移动 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#/chapters/03#attention");
    const part = page.getByRole("region", { name: "从 X 到 Y 的完整层计算" });
    const canvas = part.locator(".journey-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-fixed-matrices", "24");
    const matrixLabels = canvas.locator("[data-matrix]");
    const readPositions = () =>
      matrixLabels.evaluateAll((nodes) =>
        nodes.map((n) => ({
          id: n.getAttribute("data-matrix"),
          world: n.getAttribute("data-position"),
          left: (n as HTMLElement).style.left,
          top: (n as HTMLElement).style.top,
        })),
      );
    const original = await readPositions();
    for (let step = 0; step < 16; step++) {
      await part.getByRole("slider", { name: "完整计算进度" }).fill(((step + 0.65) / 16).toFixed(3));
      await expect(canvas).toHaveAttribute("data-step", String(step));
      expect(await readPositions()).toEqual(original);
      await expect(matrixLabels).toHaveCount(24);
      await expect(canvas.locator("canvas")).toHaveCount(1);
    }
    const mapBox = await part.locator(".journey-model-map").boundingBox();
    const canvasBox = await canvas.boundingBox();
    const controls = await part.getByRole("group", { name: "完整层播放控制" }).boundingBox();
    expect(mapBox!.y + mapBox!.height).toBeLessThan(canvasBox!.y);
    expect(controls!.y).toBeGreaterThanOrEqual(canvasBox!.y + canvasBox!.height);
    await part.getByRole("combobox", { name: "完整计算位置" }).selectOption("3");
    await part.getByRole("combobox", { name: "完整计算步骤" }).selectOption("7");
    await expect(part.locator('tr[data-masked="true"]')).toHaveCount(2);
    const masked = await part
      .locator('tr[data-masked="true"] [data-product]')
      .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute("data-product"))));
    expect(masked).toEqual([0, 0]);
    await part.getByRole("combobox", { name: "完整计算步骤" }).selectOption("9");
    const sums = await part
      .locator("[data-sum]")
      .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute("data-sum"))));
    expect(sums.reduce((a, b) => a + b, 0)).toBeCloseTo(
      Number(await part.locator(".journey-equation").getAttribute("data-result")),
      4,
    );
    await canvas.screenshot({ path: `tools/wiki-runtime/ch03-takeover/fixed-model-${width}.png` });
    await part
      .locator(".journey-model-map")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/fixed-map-${width}.png` });
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  });

test("正文继续沿同一列进入前馈，输入与两次残差更新可核对", async ({ page }) => {
  await page.goto("/#/chapters/03#attention");
  const part = page.getByRole("region", { name: "从 X 到 Y 的完整层计算" });
  await part.locator(".journey-canvas").scrollIntoViewIfNeeded();
  await expect(part.getByRole("button", { name: "播放完整计算", exact: true })).toBeEnabled();
  await part.getByRole("combobox", { name: "完整计算位置" }).selectOption("3");
  await page.getByRole("button", { name: "在完整计算中继续：X′ → 归一化 → FFN", exact: true }).click();
  await expect(part).toHaveAttribute("data-step", "11");
  await expect(part.getByRole("combobox", { name: "完整计算位置" })).toHaveValue("3");
  await expect(part.locator(".journey-canvas [data-matrix]")).toHaveCount(24);
  await part.getByRole("slider", { name: "完整计算进度" }).fill("1");
  const value = async (id: string) =>
    Number(await part.locator(`[data-state="${id}"]`).getAttribute("data-value"));
  expect(await value("y")).toBeCloseTo(
    (await value("mid")) + Number(await part.locator('[data-operand="delta"]').textContent()),
    3,
  );
  await expect(part.locator('[data-state="y"]')).toHaveAttribute("data-ready", "true");
});
