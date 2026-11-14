import { expect, test } from "@playwright/test";

test("hardware frame cost baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/wiki/tensor-parallel#scene-parallel-mechanism-5");
  const figure = page.getByTestId("scene-parallel-mechanism-5");
  await expect(figure).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await figure.getByRole("button", { name: "连续播放", exact: true }).click();
  const result = await figure.locator(".wiki-scene-canvas").evaluate(async (host) => {
    const times: number[] = [],
      gaps: number[] = [];
    let last = performance.now();
    const end = last + 3000;
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        gaps.push(now - last);
        last = now;
        times.push(Number((host as HTMLElement).dataset.renderMs));
        if (now >= end) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    times.sort((a, b) => a - b);
    gaps.sort((a, b) => a - b);
    return {
      drawCalls: (host as HTMLElement).dataset.drawCalls,
      triangles: (host as HTMLElement).dataset.triangles,
      renderMedianMs: times[Math.floor(times.length / 2)],
      renderP95Ms: times[Math.floor(times.length * 0.95)],
      rafP95Ms: gaps[Math.floor(gaps.length * 0.95)],
    };
  });
  console.log("HARDWARE_FRAME", JSON.stringify(result));
  expect(Number(result.drawCalls)).toBeLessThan(100);
});
