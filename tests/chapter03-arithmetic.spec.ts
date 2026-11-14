import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

for (const width of [1440, 390]) {
  test(`注意力与前馈保留整列参与运算，文字在画布内 ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/#/chapters/03#attention");
    for (const kind of ["attention", "ffn", "residual-ffn"]) {
      await openLocalScene(page, kind);
      const part = page.locator(`[data-layer-scene="${kind}"]`);
      await part.scrollIntoViewIfNeeded();
      await expect(part.locator("canvas")).toBeVisible();
      const phases =
        kind === "attention"
          ? [0.12, 0.32, 0.62, 0.88, 0.98]
          : kind === "ffn"
            ? [0.15, 0.35, 0.45, 0.65, 0.85, 0.98]
            : [0.38, 0.64, 0.9, 1];
      for (const progress of phases) {
        await part.getByRole("slider").fill(String(progress));
        const work = part.locator(".layer-column-work");
        await expect(work).toBeVisible();
        await expect(work).not.toContainText("NaN");
        await expect(part.locator(".layer-arithmetic")).toHaveCount(0);
        await part.screenshot({
          path: `tools/wiki-runtime/site-shell/chapter03-vector-${width}-${kind}-${progress}.png`,
        });
        const boxes = await part
          .locator(
            ".layer-label, .layer-column-tag, .layer-column-status, .matrix-rms-note, .projection-heading, .projection-sum, .projection-title",
          )
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => !(n as HTMLElement).hidden && n.getBoundingClientRect().width > 0)
              .map((n) => {
                const r = n.getBoundingClientRect();
                return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, text: n.textContent };
              }),
          );
        const bounds = (await part.locator(".layer-scene").boundingBox())!;
        for (const [index, box] of boxes.entries()) {
          expect(box.x, box.text!).toBeGreaterThanOrEqual(bounds.x);
          expect(box.right, box.text!).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
          expect(box.y, box.text!).toBeGreaterThanOrEqual(bounds.y);
          expect(box.bottom, box.text!).toBeLessThanOrEqual(bounds.y + bounds.height);
          for (const other of boxes.slice(index + 1))
            expect(
              box.right <= other.x || other.right <= box.x || box.bottom <= other.y || other.bottom <= box.y,
              `${kind}/${progress}: ${box.text} overlaps ${other.text}`,
            ).toBe(true);
        }
        await part.locator(":scope > figcaption").click();
      }
      await part.getByRole("slider").fill("0.64");
      const before = await part.locator("canvas").screenshot();
      await part.getByRole("slider").fill("0.68");
      expect((await part.locator("canvas").screenshot()).equals(before)).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}
