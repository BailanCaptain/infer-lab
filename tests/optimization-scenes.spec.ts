import { mkdirSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";

const evidence = process.env.WIKI_SCENE_EVIDENCE_DIR
  ? `${process.env.WIKI_SCENE_EVIDENCE_DIR}/optimization`
  : "tools/wiki-runtime/optimization-2026-11-10";
const scenes = [
  { page: "tensor-layout", phases: 7, result: "1,2,5,6,9,10,13,14,3,4,7,8,11,12,15,16" },
  { page: "quantization", phases: 7, result: "10438;2.0876;error=0.0012" },
  { page: "kv-cache-cpu-offload", phases: 8, result: "host=ready;gpu=9,10;next=4" },
  { page: "chunked-prefill", phases: 6, result: "6,6,2,1;prefix=14;first=y0" },
];
async function seek(f: Locator, p: number) {
  await f.getByRole("slider").evaluate((node, progress) => {
    const input = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      String(Number(input.max) * progress),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, p);
}
async function legibility(canvas: Locator) {
  return canvas.evaluate((host) => {
    const bounds = host.getBoundingClientRect();
    const labels = [...host.querySelectorAll<HTMLElement>(".wiki-inference-label,svg text")]
      .filter((n) => !n.hidden && n.textContent?.trim() && getComputedStyle(n).visibility !== "hidden")
      .map((n) => ({
        text: n.textContent,
        r: n.getBoundingClientRect(),
        value: n.classList.contains("value"),
      }));
    return {
      clipped: labels
        .filter(
          ({ r }) =>
            r.left < bounds.left - 1 ||
            r.right > bounds.right + 1 ||
            r.top < bounds.top - 1 ||
            r.bottom > bounds.bottom + 1,
        )
        .map((n) => n.text),
      overlaps: labels.flatMap((a, i) =>
        labels
          .slice(i + 1)
          .filter(
            (b) =>
              (a.value || b.value) &&
              Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 3 &&
              Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 4,
          )
          .map((b) => `${a.text}/${b.text}`),
      ),
    };
  });
}
test.beforeAll(() => {
  mkdirSync(evidence, { recursive: true });
});
for (const [kind, scene] of scenes.entries()) {
  test(`${scene.page}: full playback, handoffs, replay, narrow view and rotation`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || /buffer.*small|THREE.*warn/i.test(m.text())) errors.push(m.text());
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto(`/#/wiki/${scene.page}#scene-inference-mechanism-${kind + 4}`);
    const f = page.getByTestId(`scene-inference-mechanism-${kind + 4}`),
      canvas = f.locator(".wiki-scene-canvas");
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute("data-ready", "true");
    await f.screenshot({ path: `${evidence}/${kind}-opening.png` });
    await f.getByRole("combobox", { name: "播放速度" }).selectOption("2");
    await f.getByRole("button", { name: "连续播放", exact: true }).click();
    for (let phase = 0; phase < scene.phases; phase++) {
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-progress")), { timeout: 15000 })
        .toBeGreaterThanOrEqual((phase + 0.46) / scene.phases);
      await canvas.screenshot({ path: `${evidence}/${kind}-played-${phase}.png` });
    }
    await expect(f.getByRole("button", { name: "重新播放", exact: true })).toBeVisible();
    await expect(canvas).toHaveAttribute("data-result", scene.result);
    await f.screenshot({ path: `${evidence}/${kind}-end.png` });
    for (const width of [1600, 1100]) {
      await page.setViewportSize({ width, height: 1100 });
      if (width === 1100 && kind < 3) {
        await canvas.scrollIntoViewIfNeeded();
        const b = (await canvas.boundingBox())!;
        await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.45);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.53, { steps: 12 });
        await page.mouse.up();
      }
      for (let phase = 0; phase < scene.phases; phase++) {
        for (const local of [0.2, 0.44, 0.6, 0.69, 0.71, 0.86, 0.99]) {
          await seek(f, (phase + local) / scene.phases);
          expect(await legibility(canvas), `${width} phase ${phase} ${local}`).toEqual({
            clipped: [],
            overlaps: [],
          });
          if (local === 0.69 || local === 0.71)
            await canvas.screenshot({ path: `${evidence}/${kind}-${width}-handoff-${phase}-${local}.png` });
        }
      }
      await seek(f, 1);
      await canvas.screenshot({ path: `${evidence}/${kind}-end-${width}.png` });
    }
    if (kind < 3) await f.getByRole("button", { name: "复位图解视角" }).click();
    await f.getByRole("button", { name: "重新播放", exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-progress"))).toBeGreaterThan(0.01);
    await f.getByRole("button", { name: "暂停", exact: true }).click();
    const frozen = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(200);
    expect(await canvas.getAttribute("data-progress")).toBe(frozen);
    await f.locator(".wiki-inference-chapters button").first().click();
    await expect(canvas).toHaveAttribute("data-phase", "0");
    const slider = f.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(canvas).toHaveAttribute("data-result", scene.result);
    await page.keyboard.press("Home");
    await expect(canvas).toHaveAttribute("data-phase", "0");
    await seek(f, 1);
    await f.getByRole("button", { name: "放大观看图解" }).click();
    expect(await legibility(canvas)).toEqual({ clipped: [], overlaps: [] });
    await canvas.screenshot({ path: `${evidence}/${kind}-fullscreen.png` });
    await f.getByRole("button", { name: "退出放大观看" }).click();
    expect(errors).toEqual([]);
  });
}
test("offload and scheduling separate data arrival, completion and planned work", async ({ page }) => {
  await page.goto("/#/wiki/kv-cache-cpu-offload");
  let f = page.getByTestId("scene-inference-mechanism-6");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const ledger = f.locator(".wiki-inference-ledger");
  await seek(f, 2.75 / 8);
  await expect(ledger).toContainText("2 / 2 页到达");
  await expect(ledger).not.toContainText("完整段已就绪");
  await seek(f, 2.9 / 8);
  await expect(ledger).toContainText("完整段已就绪");
  await seek(f, 6.75 / 8);
  await expect(ledger).toContainText("等待加载完成");
  await seek(f, 6.9 / 8);
  await expect(ledger).toContainText("完成通知已到达");
  const cols = f.locator(".wiki-inference-label.status");
  await expect(cols.filter({ hasText: /^K₀$/ })).toHaveCount(4);
  await page.goto("/#/wiki/chunked-prefill");
  f = page.getByTestId("scene-inference-mechanism-7");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  await seek(f, 1.3 / 6);
  await expect(f.locator(".wiki-inference-ledger")).toContainText("0 / 14");
  await expect(f.locator(".wiki-schedule-svg")).toContainText("已排，待执行");
  await seek(f, 1.75 / 6);
  await expect(f.locator(".wiki-inference-ledger")).toContainText("6 / 14");
  await seek(f, 3.69 / 6);
  await expect(f.locator(".wiki-schedule-svg")).not.toContainText("y₀ 已交付");
  await seek(f, 3.71 / 6);
  await expect(f.locator(".wiki-schedule-svg")).toContainText("y₀ 已交付");
});

test("rendered final matrices preserve every element of the page examples", async ({ page }) => {
  const matrix = Array.from({ length: 16 }, (_, i) => i + 1);
  const kv = [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6];
  const values = [
    [...matrix, ...matrix, 1, 2, 5, 6, 9, 10, 13, 14, 3, 4, 7, 8, 11, 12, 15, 16],
    [0.523, -0.31, 1.27, 0.4, -2.54, 0.86, 52, -31, 127, 20, -127, 43, 1040, 3937, 5461, 10438, 2.0876],
    [...kv, ...kv, 4, 5, 6, 7],
  ];
  for (const [kind, scene] of scenes.entries()) {
    await page.goto(`/#/wiki/${scene.page}`);
    const f = page.getByTestId(`scene-inference-mechanism-${kind + 4}`);
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute("data-ready", "true");
    await seek(f, 1);
    if (kind < 3) {
      await expect(f.locator(".wiki-inference-label.value:visible")).toHaveText(values[kind]!.map(String));
    } else {
      await expect(f.locator(".schedule-value")).toHaveText(
        [1, 1, 6, 1, 1, 6, 1, 1, 2, 1, 1, 1].map((n) => `${n} 个位置`),
      );
    }
  }
});
