import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("查看全局结构时暂停演示并保留观看位置 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/chapters/03#rms");
  for (const selector of ['[data-part="rms"]', '[data-layer-scene="residual-attn"]']) {
    if (selector.includes("residual-attn")) await openLocalScene(page, "residual-attn");
    const part = page.locator(selector);
    await part.scrollIntoViewIfNeeded();
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    const slider = part.getByRole("slider");
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.01);
    await page.getByRole("button", { name: "全局结构", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const paused = await slider.inputValue();
    await page.waitForTimeout(500);
    expect(await slider.inputValue()).toBe(paused);
    await page.keyboard.press("Escape");
    expect(await slider.inputValue()).toBe(paused);
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(Number(paused));
    await part.getByRole("button", { name: "暂停计算", exact: true }).click();
  }
});

for (const width of [727, 1440]) {
  test(`从完整层结构定位正文并返回当前部件 ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 712 });
    await page.goto("/#/chapters/03#two-halves");
    const map = page.locator(".wiki-body > .layer-map");
    await expect(map).toBeVisible();
    expect(await page.locator(".wiki-body h2").first().getAttribute("id")).toBe("two-halves");
    await expect(map).toContainText("本章展开其中一层");
    await expect(map).toContainText("保留 X′");
    await expect(map.getByRole("link", { name: "残差相加：X + ΔA → X′", exact: true })).toBeVisible();
    await expect(map.getByRole("link", { name: "残差相加：X′ + ΔF → Y", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const boxes = await map.locator("svg text").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: node.textContent };
      }),
    );
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
          `${a.text} / ${b.text}`,
        ).toBe(true);
    await map.screenshot({ path: `tools/wiki-runtime/site-shell/chapter03-global-${width}.png` });
    await map.getByRole("link", { name: "RMSNorm₁：准备支路的数值尺度", exact: true }).click();
    await expect(page).toHaveURL(/chapters\/03(?:#|%23)rms$/);
    const compass = page.getByRole("navigation", { name: "本章全局定位" });
    await expect(compass).toHaveAttribute("data-section", "rms");
    await expect(page.locator("#rms")).toBeInViewport();
    const heading = (await page.locator("#rms").boundingBox())!;
    const bar = (await compass.boundingBox())!;
    expect(heading.y).toBeGreaterThan(bar.y + bar.height);
    await compass.getByRole("button", { name: "全局结构", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "这一层的全局结构" });
    await expect(dialog).toBeVisible();
    const diagram = (await dialog.locator(".layer-route-graphic").boundingBox())!;
    expect(diagram.y + diagram.height).toBeLessThanOrEqual(712 - 16);
    await expect(dialog.locator('[data-node="rms"]')).toHaveAttribute("data-active", "true");
    await dialog.getByRole("link", { name: "前馈 FFN：加工当前位置的维度组合", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/chapters\/03(?:#|%23)ffn$/);
    await expect(compass).toHaveAttribute("data-section", "ffn");
    const ffnIntro = page.locator(".course-visual-intro").filter({ has: page.locator("#ffn") });
    await ffnIntro.getByRole("button", { name: "在全局图中定位", exact: true }).click();
    await expect(dialog.locator('[data-active="true"]')).toHaveCount(2);
    await expect(dialog.locator('[data-node="norm2"]')).toHaveAttribute("data-active", "true");
    await expect(dialog.locator('[data-node="ffn"]')).toHaveAttribute("data-active", "true");
    await dialog.screenshot({ path: `tools/wiki-runtime/site-shell/chapter03-global-ffn-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(ffnIntro.getByRole("button", { name: "在全局图中定位", exact: true })).toBeFocused();
    await expect(page.locator(".layer-map")).toHaveCount(1);
    await openLocalScene(page, "ffn");
    const part = page.locator('[data-layer-scene="ffn"]');
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    await expect.poll(async () => Number(await part.getByRole("slider").inputValue())).toBeGreaterThan(0.01);
    await part.getByRole("button", { name: "暂停计算", exact: true }).click();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
