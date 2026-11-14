import { expect, type Locator, test } from "@playwright/test";

const evidence = "tools/wiki-runtime/ep-sp-finish-2026-11-10";
const scenes = [
  ["sequence-parallel", 1, "1.8,3.1999999999999997;3,3.1999999999999997;3,4;2.6,3.8400000000000003"],
  ["context-parallel", 2, "o0,o1,o6,o7|o2,o3,o4,o5"],
  ["context-parallel", 4, "q7=25"],
  ["context-parallel", 3, "25,15,12.5,7.5"],
  ["data-parallel", 6, "A:好的,B:缓存"],
  ["expert-parallel", 7, "routed=2.4,1.7,1.75,1.75;out=3.4,1.7,2.75,1.75"],
] as const;

async function seek(figure: Locator, fraction: number) {
  const actual = await figure.getByRole("slider").evaluate((el, p) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      String(Number(input.max) * p),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return Number(input.value) / Number(input.max);
  }, fraction);
  await expect(figure.locator(".wiki-scene-canvas")).toHaveAttribute("data-progress", actual.toFixed(3));
}

for (const [pageId, kind, result] of scenes)
  test(`${pageId} ${kind}: uninterrupted playback, final result, replay and rewind`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /buffer.*small|WebGL.*warning/i.test(message.text()))
        errors.push(message.text());
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto(`/#/wiki/${pageId}#scene-parallel-mechanism-${kind}`);
    const f = page.getByTestId(`scene-parallel-mechanism-${kind}`);
    const canvas = f.locator(".wiki-scene-canvas");
    await expect(f).toHaveAttribute("data-ready", "true");
    await f.getByRole("combobox", { name: "播放速度" }).selectOption("2");
    await f.getByRole("button", { name: "连续播放", exact: true }).click();
    for (const milestone of [0.25, 0.5, 0.75, 1]) {
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-progress")), { timeout: 15000 })
        .toBeGreaterThanOrEqual(milestone);
      await canvas.screenshot({ path: `${evidence}/played-${kind}-${milestone}.png` });
    }
    await expect(canvas).toHaveAttribute("data-result", result);
    await expect(f).toHaveAttribute("data-playing", "false");
    await f.getByRole("button", { name: "重新播放", exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-progress"))).toBeGreaterThan(0);
    await f.getByRole("button", { name: "暂停", exact: true }).click();
    const paused = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(150);
    await expect(canvas).toHaveAttribute("data-progress", paused!);
    for (const p of [0.79, 0.81, 0.58, 0.46, 0]) await seek(f, p);
    expect(errors).toEqual([]);
  });

test("EP, SP and Ring decimal columns remain separate at desktop widths", async ({ page }) => {
  for (const width of [1600, 1100]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const [pageId, kind] of [
      ["expert-parallel", 7],
      ["sequence-parallel", 1],
      ["context-parallel", 4],
    ] as const) {
      await page.goto(`/#/wiki/${pageId}#scene-parallel-mechanism-${kind}`);
      const f = page.getByTestId(`scene-parallel-mechanism-${kind}`);
      await expect(f).toHaveAttribute("data-ready", "true");
      for (const fraction of kind === 7 ? [0.455, 0.535, 0.69, 0.72, 1] : [1]) {
        await seek(f, fraction);
        await expect(f.locator(".wiki-mechanism-label.value:visible").first()).not.toHaveText("");
        const collisions = await f.locator(".wiki-mechanism-label.value:visible").evaluateAll((elements) => {
          const labels = elements
            .filter((el) => el.textContent?.trim())
            .map((el) => ({
              text: el.textContent,
              rect: el.getBoundingClientRect(),
            }));
          return labels.flatMap((a, i) =>
            labels
              .slice(i + 1)
              .filter(
                (b) =>
                  Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 &&
                  Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 2,
              )
              .map((b) => [a.text, b.text]),
          );
        });
        expect(collisions).toEqual([]);
      }
    }
  }
});
