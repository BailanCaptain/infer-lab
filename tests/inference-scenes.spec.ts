import { mkdirSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";

const evidence = process.env.WIKI_SCENE_EVIDENCE_DIR
  ? `${process.env.WIKI_SCENE_EVIDENCE_DIR}/inference`
  : "tools/wiki-runtime/inference-scenes-2026-11-10";
const scenes = [
  { page: "attention-qkv", seconds: 64, phases: 6, result: "25,15,12.5,7.5" },
  { page: "block-table", seconds: 18, phases: 6, result: "slot=10;refs=0,0,0" },
  { page: "pd-disaggregation", seconds: 52, phases: 6, result: "P=released;D=ready" },
];
async function seek(figure: Locator, progress: number) {
  await figure.getByRole("slider").evaluate((node, p) => {
    const input = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      String(Number(input.max) * p),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, progress);
}
test.beforeAll(() => {
  mkdirSync(evidence, { recursive: true });
});

test("KV continues from writing into sharing without switching or resetting", async ({ page }) => {
  await page.goto("/#/wiki/block-table#scene-inference-mechanism-1");
  const f = page.getByTestId("scene-inference-mechanism-1");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  await expect(f.getByRole("navigation", { name: "缓存图解主题" })).toHaveCount(0);
  await expect(f.getByRole("slider")).toHaveAttribute("max", "18");
  await seek(f, 2.99 / 6);
  const cached = f.locator('[data-tensor="显存块 2"]');
  const values = await cached.allTextContents();
  const before = await cached.nth(8).boundingBox();
  await f.getByRole("button", { name: "连续播放", exact: true }).click();
  await expect(f.locator(".wiki-scene-canvas")).toHaveAttribute("data-phase", "3");
  await f.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(cached).toHaveText(values);
  const after = await cached.nth(8).boundingBox();
  expect(after?.x).toBeCloseTo(before!.x, 1);
  expect(after?.width).toBeCloseTo(before!.width, 1);
  await expect(f.locator(".wiki-scene-canvas")).toHaveAttribute("data-result", "slot=10;refs=1,1,1");
});

for (const [kind, scene] of scenes.entries()) {
  test(`${scene.page}: real playback, numeric labels, replay and narrow rotation`, async ({ page }) => {
    test.setTimeout(100_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || /THREE.*warn|buffer.*small/i.test(message.text()))
        errors.push(message.text());
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto(`/#/wiki/${scene.page}#scene-inference-mechanism-${kind}`);
    const figure = page.getByTestId(`scene-inference-mechanism-${kind}`),
      canvas = figure.locator(".wiki-scene-canvas");
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute("data-ready", "true");
    await figure.screenshot({ path: `${evidence}/${kind}-opening.png` });
    await figure.getByRole("combobox", { name: "播放速度" }).selectOption("2");
    await figure.getByRole("button", { name: "连续播放", exact: true }).click();
    for (let phase = 0; phase < scene.phases; phase++) {
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-progress")), { timeout: 15000 })
        .toBeGreaterThanOrEqual((phase + 0.85) / scene.phases);
      await canvas.screenshot({ path: `${evidence}/${kind}-played-${phase}.png` });
    }
    await expect(figure.getByRole("button", { name: "重新播放", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(canvas).toHaveAttribute("data-result", scene.result);
    await figure.screenshot({ path: `${evidence}/${kind}-end.png` });
    for (let phase = 0; phase < scene.phases; phase++) {
      await seek(figure, (phase + 0.99) / scene.phases);
      const overlaps = await canvas.locator(".wiki-inference-label.value:visible").evaluateAll((nodes) => {
        const boxes = nodes
          .filter((n) => n.textContent?.trim())
          .map((n) => ({ text: n.textContent, r: n.getBoundingClientRect() }));
        return boxes.flatMap((a, i) =>
          boxes
            .slice(i + 1)
            .filter(
              (b) =>
                Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 2 &&
                Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 3,
            )
            .map((b) => `${a.text}/${b.text}`),
        );
      });
      expect(overlaps, `phase ${phase} readable numeric labels`).toEqual([]);
    }
    await seek(figure, 1);
    await figure.getByRole("button", { name: "重新播放", exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-progress"))).toBeGreaterThan(0.01);
    await figure.getByRole("button", { name: "暂停", exact: true }).click();
    const frozen = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute("data-progress")).toBe(frozen);
    await seek(figure, 0);
    await expect(canvas).toHaveAttribute("data-phase", "0");
    await page.setViewportSize({ width: 1100, height: 1100 });
    await seek(figure, 1);
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-rotated.png` });
    await figure.getByRole("button", { name: "复位图解视角" }).click();
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-reset.png` });
    expect(errors).toEqual([]);
  });
}

test("PD delivery and Core activation stay behind their visible handoffs", async ({ page }) => {
  await page.goto("/#/wiki/pd-disaggregation#scene-inference-mechanism-2");
  const f = page.getByTestId("scene-inference-mechanism-2");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const readout = f.getByRole("complementary", { name: "PD 交接 当前讲解" });
  await seek(f, 2.64 / 6);
  await expect(readout).toContainText("0 / 2 块");
  await seek(f, 2.66 / 6);
  await expect(readout).toContainText("1 / 2 块");
  await seek(f, 4.64 / 6);
  await expect(readout).toContainText("仍持有");
  await seek(f, 4.66 / 6);
  await expect(readout).toContainText("已归还");
});

test("reused model demonstrations open at the requested segment", async ({ page }) => {
  for (const [wiki, segment] of [
    ["linear-attention", 14],
    ["mla", 28],
    ["attention-qkv", 31],
  ] as const) {
    await page.goto(`/#/wiki/${wiki}`);
    const link = page.locator(`a[href*="/model?view=play&segment=${segment}"]`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator("iframe.experience-frame")).toHaveAttribute(
      "src",
      new RegExp(`segment=${segment}`),
    );
    await expect(page.frameLocator("iframe.experience-frame").locator("body")).toContainText(
      segment === 14 ? "状态更新与读出" : segment === 28 ? "先压缩" : "注意力分数",
    );
  }
});

test("KV lookup highlights the target slot before the row arrives", async ({ page }) => {
  await page.goto("/#/wiki/block-table#scene-inference-mechanism-1");
  const f = page.getByTestId("scene-inference-mechanism-1");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const row = f.locator(".wiki-inference-label.row").filter({ hasText: /^6$/ });
  await seek(f, 0.5 / 6);
  await expect(row).not.toBeVisible();
  await seek(f, 1.91 / 6);
  await expect(row).toBeVisible();
  await expect(f.locator(".wiki-cache-count")).toContainText("这一组的第 3 个位置");
  await seek(f, 2.4 / 6);
  await expect(row).toBeVisible();
  const writtenRow = f.locator('[data-tensor="显存块 2"]').filter({ hasText: /./ });
  await seek(f, 2.89 / 6);
  await expect(writtenRow).toHaveCount(8);
  await seek(f, 2.91 / 6);
  await expect(writtenRow).toHaveText(["4", "5", "6", "7", "5", "6", "7", "8", "6", "7", "8", "9"]);
  await seek(f, 3.95 / 6);
  await expect(f.locator(".wiki-inference-readout")).toContainText("2 个请求正在用块 7");
  await seek(f, 4.89 / 6);
  await expect(f.locator(".wiki-cache-current")).toContainText("正在归还它占用的块");
  await expect(f.locator(".wiki-inference-readout")).toContainText("2 个请求正在用块 7");
  await seek(f, 4.95 / 6);
  await expect(f.locator(".wiki-inference-readout")).toContainText("1 个请求正在用块 7");
  await seek(f, 5.89 / 6);
  await expect(f.locator(".wiki-cache-current")).toContainText("正在撤掉 B");
  await expect(f.locator(".wiki-inference-readout")).toContainText("1 个请求正在用块 7");
  await seek(f, 1);
  await expect(writtenRow).toHaveCount(12);
  await seek(f, 2.89 / 6);
  await expect(writtenRow).toHaveCount(8);
});

test("KV explains requests and keeps every action visibly moving", async ({ page }) => {
  await page.goto("/#/wiki/block-table#scene-inference-mechanism-1");
  const f = page.getByTestId("scene-inference-mechanism-1");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  await expect(f).toContainText("一次生成任务是一条请求");
  await expect(f).toContainText("块表记地址，显存块放数据");
  await expect(f).not.toContainText(/R[12]/);
  // Compare rendered 3D pixels, excluding the changing clock, captions and progress bar.
  const canvas = f.locator(".wiki-scene-canvas canvas");
  for (let phase = 0; phase < 6; phase++) {
    await seek(f, (phase + 0.2) / 6);
    const before = (await canvas.screenshot()).toString("base64");
    await seek(f, (phase + 0.7) / 6);
    const after = (await canvas.screenshot()).toString("base64");
    const changed = await page.evaluate(
      async (frames) => {
        const bitmaps = await Promise.all(
          frames.map(async (frame) =>
            createImageBitmap(await (await fetch(`data:image/png;base64,${frame}`)).blob()),
          ),
        );
        const surface = new OffscreenCanvas(bitmaps[0]!.width, bitmaps[0]!.height);
        const context = surface.getContext("2d")!;
        const pixels = bitmaps.map((bitmap) => {
          context.clearRect(0, 0, surface.width, surface.height);
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          return context.getImageData(0, 0, surface.width, surface.height).data;
        });
        let count = 0;
        for (let i = 0; i < pixels[0]!.length; i += 4) {
          const difference = [0, 1, 2].reduce(
            (sum, c) => sum + Math.abs(pixels[0]![i + c]! - pixels[1]![i + c]!),
            0,
          );
          if (difference > 70) count++;
        }
        return count;
      },
      [before, after],
    );
    expect(changed, `phase ${phase} has a visible action within 1.5 seconds`).toBeGreaterThan(60);
  }
});

test("KV phone layout retains the whole cache and readable labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/#/wiki/block-table#scene-inference-mechanism-1");
  const f = page.getByTestId("scene-inference-mechanism-1");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const canvas = f.locator(".wiki-scene-canvas");
  for (const progress of [1.85 / 6, 2.45 / 6, 2.99 / 6, 3.95 / 6, 1]) {
    await seek(f, progress);
    const problems = await canvas.evaluate((host) => {
      const bounds = host.getBoundingClientRect();
      const labels = [...host.querySelectorAll<HTMLElement>(".wiki-inference-label")]
        .filter(
          (node) =>
            !node.hidden && node.textContent?.trim() && getComputedStyle(node).visibility !== "hidden",
        )
        .map((node) => ({ text: node.textContent, rect: node.getBoundingClientRect() }));
      const clipped = labels
        .filter(
          ({ rect }) =>
            rect.left < bounds.left ||
            rect.right > bounds.right ||
            rect.top < bounds.top ||
            rect.bottom > bounds.bottom,
        )
        .map(({ text }) => text);
      const overlaps = labels.flatMap((a, i) =>
        labels
          .slice(i + 1)
          .filter(
            (b) =>
              Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 3 &&
              Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 4,
          )
          .map((b) => `${a.text}/${b.text}`),
      );
      return { clipped, overlaps, overflow: host.scrollWidth > host.parentElement!.clientWidth };
    });
    expect(problems).toEqual({ clipped: [], overlaps: [], overflow: false });
  }
});

test("narrow viewport keeps final labels inside the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1100 });
  for (const [kind, scene] of scenes.entries()) {
    await page.goto(`/#/wiki/${scene.page}#scene-inference-mechanism-${kind}`);
    const f = page.getByTestId(`scene-inference-mechanism-${kind}`),
      canvas = f.locator(".wiki-scene-canvas");
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute("data-ready", "true");
    await seek(f, 1);
    const clipped = await canvas.evaluate((host) => {
      const bounds = host.getBoundingClientRect();
      return [...host.querySelectorAll<HTMLElement>(".wiki-inference-label")]
        .filter((n) => !n.hidden && n.textContent && getComputedStyle(n).visibility !== "hidden")
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.left < bounds.left || r.right > bounds.right || r.top < bounds.top || r.bottom > bounds.bottom
          );
        })
        .map((n) => n.textContent);
    });
    expect(clipped, scene.page).toEqual([]);
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-reset.png` });
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.64, box.y + box.height * 0.5, { steps: 12 });
    await page.mouse.up();
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-rotated.png` });
    await f.getByRole("button", { name: "复位图解视角" }).click();
  }
});

test("AI Core presents the static 2D four-step GM handoff walkthrough cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/#/wiki/ai-core");
  await expect(page.getByTestId("scene-inference-mechanism-3")).toHaveCount(0);
  const walkthrough = page.locator("svg[aria-label*='910B 分离架构四步走读']");
  await walkthrough.scrollIntoViewIfNeeded();
  await expect(walkthrough).toBeVisible();
  await expect(walkthrough).toContainText("[5, -5]（跨核中转）");
  await expect(walkthrough).toContainText("[5, 0]（最终写回）");
});
