import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";

const evidence = "tools/wiki-runtime/hardware-continuity-2026-11-10";
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
test.beforeAll(() => {
  mkdirSync(evidence, { recursive: true });
});

test("Attention keeps its query and completed output legible without multi-card merge noise", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1300 });
  await page.goto("/#/wiki/attention-qkv");
  const f = page.getByTestId("scene-inference-mechanism-0");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const reference = f.locator('[data-tensor="注意力输出 O · 4 通道"]');
  const query = f.locator('[data-tensor="Q7 · 查询 / 4 通道"]');
  await seek(f, 0.994);
  const before = await reference.first().boundingBox();
  for (const p of [0.994, 0.998, 1]) {
    await seek(f, p);
    await expect(reference).toHaveText(["25", "15", "12.5", "7.5"]);
    for (const cell of await reference.all()) await expect(cell).toBeVisible();
    for (const cell of await query.all()) await expect(cell).toBeVisible();
    const now = await reference.first().boundingBox();
    expect(Math.abs(now!.x - before!.x)).toBeLessThan(0.5);
    expect(Math.abs(now!.y - before!.y)).toBeLessThan(0.5);
    await f
      .locator(".wiki-scene-canvas")
      .screenshot({ path: `${evidence}/attention-continuity-${p.toFixed(3)}.png` });
  }
  await expect(f.getByText("卡 0 合并结果 O · 4 通道", { exact: true })).toBeHidden();
  for (const width of [1600, 1100]) {
    await page.setViewportSize({ width, height: 1300 });
    for (const expanded of [false, true]) {
      if (expanded) await f.getByRole("button", { name: "放大观看图解" }).click();
      const canvas = f.locator(".wiki-scene-canvas");
      await canvas.screenshot({ path: `${evidence}/attention-result-${width}-${expanded}.png` });
      const formula = (await f.locator(".wiki-inference-label.equation").boundingBox())!;
      const title = (await f.getByText("注意力输出 O · 4 通道", { exact: true }).boundingBox())!;
      expect(
        title.y + title.height + 2,
        `${width}: formula must not cover 注意力输出 O · 4 通道`,
      ).toBeLessThanOrEqual(formula.y);
      const bounds = (await canvas.boundingBox())!;
      expect(formula.y + formula.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      if (expanded) await f.getByRole("button", { name: "退出放大观看" }).click();
    }
  }
});

test("hardware contents change with each lesson and rewind to their original state", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1400 });
  const scenes = [
    [0, "attention-qkv"],
    [1, "block-table"],
    [2, "pd-disaggregation"],
    [6, "kv-cache-cpu-offload"],
    [7, "collective-communication"],
  ] as const;
  for (const [kind, slug] of scenes) {
    await page.goto(`/#/wiki/${slug}`);
    const f = page.getByTestId(
      kind === 7 ? "scene-collective-communication" : `scene-inference-mechanism-${kind}`,
    );
    const canvas = f.locator(".wiki-scene-canvas");
    await f.scrollIntoViewIfNeeded();
    await expect(f).toHaveAttribute("data-ready", "true");
    await canvas.scrollIntoViewIfNeeded();
    const b = (await canvas.boundingBox())!;
    const hashes: string[] = [];
    for (const [i, p] of [0, 0.55, 1, 0].entries()) {
      await seek(f, p);
      const bytes = await page.screenshot({
        clip: {
          x: b.x + b.width * 0.12,
          y: b.y + (kind === 7 ? 100 : 140),
          width: b.width * 0.76,
          height: 115,
        },
        path: `${evidence}/hardware-${slug}-${i}.png`,
      });
      hashes.push(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(
      new Set(hashes).size,
      `${slug}: the hardware image must reflect contents, not just the page text`,
    ).toBeGreaterThan(1);
    expect(hashes[3], `${slug}: rewind restores hardware contents`).toBe(hashes[0]);
  }
});

test("all moving labels stay readable during the original four lessons", async ({ page }) => {
  test.setTimeout(120000);
  for (const width of [1600, 1100]) {
    await page.setViewportSize({ width, height: 1300 });
    for (const [kind, slug] of ["attention-qkv", "block-table", "pd-disaggregation"].entries()) {
      await page.goto(`/#/wiki/${slug}`);
      const f = page.getByTestId(`scene-inference-mechanism-${kind}`),
        canvas = f.locator(".wiki-scene-canvas");
      await f.scrollIntoViewIfNeeded();
      await expect(f).toHaveAttribute("data-ready", "true");
      if (width === 1100) {
        await canvas.scrollIntoViewIfNeeded();
        const b = (await canvas.boundingBox())!;
        await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.45);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.53, { steps: 12 });
        await page.mouse.up();
      }
      const phases = kind === 0 ? 4 : kind === 3 ? 8 : 6;
      for (let phase = 0; phase < phases; phase++)
        for (const local of [0.18, 0.28, 0.38, 0.46, 0.54, 0.6, 0.69, 0.85, 0.99]) {
          await seek(f, (phase + local) / phases);
          const collisions = await canvas.locator(".wiki-inference-label:visible").evaluateAll((nodes) => {
            const boxes = nodes
              .filter((n) => n.textContent?.trim())
              .map((n) => ({
                text: n.textContent,
                r: n.getBoundingClientRect(),
                value: n.classList.contains("value"),
              }));
            return boxes.flatMap((a, i) =>
              boxes
                .slice(i + 1)
                .filter(
                  (b) =>
                    (a.value || b.value) &&
                    Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 3 &&
                    Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 4,
                )
                .map((b) => `${a.text}/${b.text}`),
            );
          });
          expect(collisions, `${width} ${slug} phase ${phase} ${local}`).toEqual([]);
        }
      await canvas.screenshot({ path: `${evidence}/${slug}-bounds-${width}.png` });
    }
  }
});
