import { statSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Continuous trace screencasts force GPU readback and distort the live render benchmark.
// Keep action/DOM traces; capture the visual checkpoints explicitly below.
test.use({ trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });

// Keep the opening lightweight: these budgets protect the actual delivered asset and render path.
test("单按钮首页：模型预算、按需绘制与进入主站", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  expect(statSync("public/models/compute-city.glb").size).toBeLessThan(1_500_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const scene = page.getByTestId("city-scene");
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 60_000 });
  await expect(page.locator("h1")).toHaveText(/大模型\s*推理之旅/);
  const orbit = await scene.evaluate(async (element) => {
    const start = performance.now();
    const count = Number(element.dataset.renderCount);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      renders: Number(element.dataset.renderCount) - count,
      seconds: (performance.now() - start) / 1000,
    };
  });
  expect(orbit.renders).toBeGreaterThan(2);
  expect(orbit.renders / orbit.seconds).toBeLessThanOrEqual(32);
  console.log("首页自动环绕", orbit);
  await page.screenshot({ path: "test-results/city-desktop.png" });
  // The cold frame includes the one-time shadow pass. Measure the normal camera pass after it.
  await page.keyboard.press("Escape");
  await expect.poll(async () => Number(await scene.getAttribute("data-draw-calls"))).toBeLessThanOrEqual(25);
  const calls = Number(await scene.getAttribute("data-draw-calls"));
  const triangles = Number(await scene.getAttribute("data-triangles"));
  expect(calls).toBeGreaterThan(0);
  expect(calls).toBeLessThanOrEqual(25);
  expect(triangles).toBeGreaterThan(50_000);
  expect(triangles).toBeLessThan(200_000);
  const idle = await scene.getAttribute("data-render-count");
  await page.waitForTimeout(500);
  expect(await scene.getAttribute("data-render-count")).toBe(idle);
  console.log(`城市实测：${calls} draw calls，${triangles} 三角面，空闲 500ms 新增绘制 0 次`);
  console.log(
    "WebGL renderer:",
    await page.evaluate(() => {
      const gl = document.querySelector("canvas")?.getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unavailable";
    }),
  );
  await expect(page.locator("a, button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /定位|开始探索/ })).toHaveCount(0);
  const overview = await scene.screenshot();
  await expect(page.getByRole("link", { name: "开始阅读" })).toHaveAttribute("href", "#/wiki");
  await page.mouse.click(830, 320);
  await page.mouse.click(1050, 550);
  await page.waitForTimeout(1300);
  expect((await scene.screenshot()).equals(overview)).toBe(true);
  const beforeDrag = await scene.screenshot();
  await page.mouse.move(1050, 620);
  await page.mouse.down();
  await page.mouse.move(1150, 650, { steps: 6 });
  await page.mouse.up();
  expect((await scene.screenshot()).equals(beforeDrag)).toBe(false);
  await page.getByRole("link", { name: "开始阅读" }).click();
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  await expect(scene).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("city-scene")).toHaveAttribute("data-scene-ready", "true", {
    timeout: 60_000,
  });
  // Leaving while the automatic tour is active must release its render loop.
  const outgoing = await scene.elementHandle();
  await page.getByRole("link", { name: "开始阅读" }).click();
  await expect(scene).toHaveCount(0);
  const stopped = await outgoing!.getAttribute("data-render-count");
  await page.waitForTimeout(500);
  expect(await outgoing!.getAttribute("data-render-count")).toBe(stopped);
  expect(errors).toEqual([]);
});

test("手机首页只有一个入口，按钮无需滚动即可使用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/home");
  const scene = page.getByTestId("city-scene");
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 60_000 });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 359, height: 646 },
  ]) {
    await page.setViewportSize(viewport);
    const entry = page.getByRole("link", { name: "开始阅读" });
    await expect(page.locator("a, button")).toHaveCount(1);
    await expect(entry).toBeInViewport({ ratio: 1 });
    expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: `test-results/single-home-${viewport.width}.png` });
  }
  const idle = await scene.getAttribute("data-render-count");
  await page.waitForTimeout(500);
  expect(await scene.getAttribute("data-render-count")).toBe(idle);
  await page.setViewportSize({ width: 3840, height: 2160 });
  const canvas = scene.locator("canvas");
  await expect.poll(() => canvas.evaluate((element) => element.height)).toBeGreaterThan(1000);
  expect(await canvas.evaluate((element) => element.width * element.height)).toBeLessThanOrEqual(2_500_000);
  await page.setViewportSize({ width: 359, height: 646 });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "开始阅读" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
});

test("城市载入失败不阻塞唯一阅读入口，旧首页链接仍可用", async ({ page }) => {
  await page.route("**/compute-city.glb", (route) => route.abort());
  await page.goto("/#/archive/home");
  await expect(page.getByRole("status")).toHaveText("场景暂未载入，仍可开始阅读");
  await expect(page.locator("a, button")).toHaveCount(1);
  await page.getByRole("link", { name: "开始阅读" }).click();
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
});

test("持续拖动跟随浏览器刷新，松手后停止绘制", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/home");
  const scene = page.getByTestId("city-scene");
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 60_000 });
  await page.keyboard.press("Escape");
  await page.mouse.move(950, 550);
  await page.mouse.down();
  // Feed one move per browser frame after a real pointer-down. This measures scheduling
  // independently of Playwright transport speed and the machine's refresh rate.
  const result = await page.evaluate(async () => {
    const host = document.querySelector<HTMLElement>('[data-testid="city-scene"]');
    const canvas = host?.querySelector("canvas");
    if (!host || !canvas) throw new Error("Missing city canvas");
    const startCount = Number(host.dataset.renderCount);
    const start = performance.now();
    let ticks = 0;
    let lastCount = startCount;
    let lastDraw = start;
    const intervals: number[] = [];
    await new Promise<void>((resolve) => {
      function step(now: number) {
        const count = Number(host?.dataset.renderCount);
        if (count !== lastCount) {
          intervals.push(now - lastDraw);
          lastDraw = now;
          lastCount = count;
        }
        canvas?.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
            buttons: 1,
            clientX: 950 + Math.sin(ticks / 24) * 140,
            clientY: 550,
          }),
        );
        ticks++;
        // SwiftShader may produce only 10 frames in 2 seconds. The first no-op move and
        // final queued draw then dominate the ratio; keep the duration and require a
        // meaningful sample without relaxing the 80% scheduling threshold.
        if (now - start < 2000 || ticks < 30) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
    intervals.sort((a, b) => a - b);
    const renders = Number(host.dataset.renderCount) - startCount;
    return {
      renders,
      ticks,
      fps: (renders * 1000) / (performance.now() - start),
      p95: intervals[Math.floor(intervals.length * 0.95)] ?? 0,
    };
  });
  await page.mouse.up();
  console.log("拖动帧调度实测", result);
  expect(result.renders / result.ticks).toBeGreaterThan(0.8);
  await page.waitForTimeout(200);
  const idle = await scene.getAttribute("data-render-count");
  await page.waitForTimeout(500);
  expect(await scene.getAttribute("data-render-count")).toBe(idle);
});
