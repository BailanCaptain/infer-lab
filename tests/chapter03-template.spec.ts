import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

for (const width of [1440, 390]) {
  test(`chapter template relationships and whole-column arithmetic ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/chapters/03#attention-add");
    await expect(page.getByRole("figure", { name: "位置与隐藏维度的二维对应" })).toBeAttached();
    await expect(page.locator('[data-component="ffn"] .component-map')).toBeAttached();
    for (const kind of ["residual-attn", "ffn", "residual-ffn"]) {
      await openLocalScene(page, kind);
      const part = page.locator(`[data-layer-scene="${kind}"]`);
      await part.scrollIntoViewIfNeeded();
      await expect(part.locator("canvas")).toBeVisible();
      for (const progress of kind === "ffn" ? [0.16, 0.4, 0.65, 0.9] : [0.4, 0.65]) {
        await part.getByRole("slider").fill(String(progress));
        await expect(part.locator(".projection-detail")).toBeVisible();
        await expect(part.locator(".projection-equation")).toHaveCount(8);
        await expect(part.locator(".projection-detail")).not.toContainText("NaN");
        await part.locator(":scope > figcaption").click();
        await part.screenshot({
          path: `tools/wiki-runtime/site-shell/template-${width}-${kind}-${progress}.png`,
        });
      }
      await part.getByRole("slider").fill("1");
      await expect(part.locator(".layer-column-status")).toContainText("写回");
      await expect(part.locator(".layer-scene")).toHaveCSS("height", kind === "ffn" ? "620px" : "390px");
      await part.locator(".layer-scene").scrollIntoViewIfNeeded();
      if (width === 390) await expect(page.getByTestId("pagetoc-fab")).toBeHidden();
      await part.screenshot({ path: `tools/wiki-runtime/site-shell/template-${width}-${kind}-complete.png` });
    }
    for (const [index, figure] of (await page.locator(".lesson-relation").all()).entries()) {
      await figure.scrollIntoViewIfNeeded();
      const texts = await figure.locator("svg:visible text").evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            text: node.textContent,
          };
        }),
      );
      for (const [i, a] of texts.entries()) {
        expect(a.left, a.text!).toBeGreaterThanOrEqual(0);
        expect(a.right, a.text!).toBeLessThanOrEqual(width);
        for (const b of texts.slice(i + 1))
          expect(
            a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom,
            `${a.text} overlaps ${b.text}`,
          ).toBe(true);
      }
      await figure.screenshot({ path: `tools/wiki-runtime/site-shell/relations-${width}-${index}.png` });
    }
  });
}

test("离开计算图只暂停，返回时保留同一个场景与进度", async ({ page }) => {
  await page.goto("/#/chapters/03#attention");
  await openLocalScene(page, "attention");
  const part = page.locator('[data-layer-scene="attention"]');
  await expect(part.locator("canvas")).toBeVisible();
  const original = await part.locator("canvas").elementHandle();
  await part.getByRole("slider").fill("0.62");
  await page.locator("#hidden").scrollIntoViewIfNeeded();
  await expect(part.locator(".layer-scene")).toHaveAttribute("data-in-view", "false");
  await expect(part.locator("canvas")).toBeAttached();
  await part.locator(".layer-scene").scrollIntoViewIfNeeded();
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(part.getByRole("slider")).toHaveValue("0.62");
  await expect(part.locator(".layer-column-work")).toBeVisible();
});
