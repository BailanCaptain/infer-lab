import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });

async function scrub(figure: Locator, seconds: number) {
  await figure.getByRole("slider").evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, seconds);
}

async function scrollStepByStep(page: Page, direction: "down" | "up") {
  const maxY = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  );
  const step = Math.max(400, Math.floor(maxY / 5) || 400);
  const targets: number[] = [];
  if (direction === "down") {
    for (let y = 0; y < maxY; y += step) targets.push(y);
    targets.push(maxY);
  } else {
    for (let y = maxY; y > 0; y -= step) targets.push(y);
    targets.push(0);
  }
  let maxCanvases = 0;
  for (const y of targets) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(180);
    const canvases = await page.locator(".wiki-scene canvas").count();
    if (canvases > maxCanvases) maxCanvases = canvases;
  }
  return maxCanvases;
}

test("跨多个 3D 重度 Wiki 页面连续浏览与上下滚动不触发 WebGL 上下文丢失且活跃画布受控", async ({ page }) => {
  const errors: string[] = [];
  const contextLostEvents: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener(
      "webglcontextlost",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.isConnected) {
          (window as unknown as { __liveContextLost?: number }).__liveContextLost =
            ((window as unknown as { __liveContextLost?: number }).__liveContextLost ?? 0) + 1;
        }
      },
      true,
    );
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  const pages = [
    "context-parallel",
    "tensor-parallel",
    "expert-parallel",
    "one-request",
    "glm-5-3-flash",
  ] as const;

  let peakCanvases = 0;
  for (const slug of pages) {
    await page.goto(`/#/wiki/${slug}`);
    const scenes = page.locator(".wiki-scene");
    await expect(scenes.first()).toBeVisible({ timeout: 30_000 });

    const first = scenes.first();
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
    await expect(first.locator("canvas")).toHaveCount(1);

    // Briefly play and pause to confirm WebGL scene renders and advances cleanly.
    await first.getByRole("button", { name: "连续播放", exact: true }).click();
    await expect(first).toHaveAttribute("data-playing", "true");
    await page.waitForTimeout(250);
    await first.getByRole("button", { name: "暂停", exact: true }).click();
    await expect(first).toHaveAttribute("data-playing", "false");

    const downMax = await scrollStepByStep(page, "down");
    const upMax = await scrollStepByStep(page, "up");
    peakCanvases = Math.max(peakCanvases, downMax, upMax);

    // Never show a WebGL context loss error banner on any scene.
    await expect(page.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);

    // First scene should still be ready (or cleanly remounted) after returning to top.
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
    await expect(first.locator("canvas")).toHaveCount(1);
    await expect(page.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);

    const liveLost = await page.evaluate(
      () => (window as unknown as { __liveContextLost?: number }).__liveContextLost ?? 0,
    );
    if (liveLost > 0) contextLostEvents.push(`${slug}:${liveLost}`);
  }

  expect(peakCanvases).toBeLessThanOrEqual(4);
  expect(contextLostEvents).toEqual([]);
  expect(errors).toEqual([]);
});

test("离屏远距离滚动自动回收 WebGL 画布，滚回视口后无缝重挂并保持同一播放时间状态", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/wiki/context-parallel");
  const scenes = page.locator(".wiki-scene");
  await expect(scenes).toHaveCount(3, { timeout: 30_000 });

  const first = scenes.nth(0);
  const last = scenes.nth(2);

  // Mount first scene and seek it to 50% of its timeline.
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await expect(first.locator("canvas")).toHaveCount(1);

  const maxSeconds = Number(await first.getByRole("slider").getAttribute("max"));
  const targetSeconds = Number((maxSeconds * 0.5).toFixed(2));
  await scrub(first, targetSeconds);
  const progressBefore = Number(await first.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(progressBefore).toBeGreaterThan(0.4);
  expect(progressBefore).toBeLessThan(0.6);

  // Scroll far past the first scene (> 1500px keepalive margin) to the bottom of the page.
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  // Verify the distance exceeds the 1500px keepalive margin; if so, the first scene must recycle its WebGL canvas.
  const firstDistance = await first.evaluate((el) => Math.abs(el.getBoundingClientRect().bottom));
  expect(firstDistance).toBeGreaterThan(1500);
  await expect(first.locator("canvas")).toHaveCount(0);
  await expect(first).toHaveAttribute("data-ready", "false");
  // Intentional forceContextLoss during recycle must NEVER produce an error banner.
  await expect(first.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);

  // Scroll back to the first scene: it must cleanly remount and restore the exact playback timestamp.
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await expect(first.locator("canvas")).toHaveCount(1);
  await expect(first.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);

  const progressAfter = Number(await first.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(Math.abs(progressAfter - progressBefore)).toBeLessThan(0.02);
  expect(Number(await first.getByRole("slider").inputValue())).toBeCloseTo(targetSeconds, 1);
  expect(errors).toEqual([]);
});
