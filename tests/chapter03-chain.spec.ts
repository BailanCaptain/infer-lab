import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

const scenes = ["attention", "residual-attn", "ffn", "residual-ffn"];
test("444px 前馈展开后标题不被画布顶部裁掉", async ({ page }) => {
  await page.setViewportSize({ width: 444, height: 599 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const part = page.locator('[data-layer-scene="ffn"]');
  await expect(part.locator("canvas")).toBeVisible();
  await part.getByRole("button", { name: "播放计算", exact: true }).click();
  await part.getByRole("button", { name: "暂停计算", exact: true }).click();
  await part.getByRole("slider").fill("1");
  const canvas = (await part.locator(".layer-scene").boundingBox())!;
  for (const label of await part.locator(".layer-label").all()) {
    if (!(await label.isVisible())) continue;
    const box = (await label.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(canvas.y);
    expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  }
});
for (const width of [1440, 390]) {
  test(`第03章计算链可播放、旋转、复位和读数 ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/chapters/03");
    await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
    for (const kind of scenes) {
      await openLocalScene(page, kind);
      const part = page.locator(`[data-layer-scene="${kind}"]`);
      await part.scrollIntoViewIfNeeded();
      await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
      const play = part.getByRole("button", { name: "播放计算", exact: true });
      await expect(play).toBeEnabled();
      await play.click();
      const slider = part.getByRole("slider");
      await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.015);
      await part.getByRole("button", { name: "暂停计算", exact: true }).click();
      const paused = await slider.inputValue();
      await page.waitForTimeout(200);
      expect(await slider.inputValue()).toBe(paused);
      await slider.fill("0.62");
      const canvas = part.locator("canvas");
      await canvas.scrollIntoViewIfNeeded();
      const before = await canvas.screenshot();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 25, { steps: 8 });
      await page.mouse.up();
      expect((await canvas.screenshot()).equals(before)).toBe(false);
      await part.getByRole("button", { name: "复位视角", exact: true }).click();
      await part.getByText("沿同一份数据核对数值", { exact: true }).click();
      await part.getByRole("spinbutton", { name: "核对维度" }).fill("2048");
      await expect(part.locator(".layer-numbers")).not.toContainText("NaN");
      await expect(part.locator(".layer-numbers")).not.toBeEmpty();
      if (kind === "attention") {
        await part.getByRole("combobox", { name: "核对位置" }).selectOption("3");
        await expect(part.locator('.attention-source-choice[data-masked="true"]')).toHaveCount(2);
        await part.getByRole("combobox", { name: "核对位置" }).selectOption("5");
      }
      await part.getByText("沿同一份数据核对数值", { exact: true }).click();
      await part.screenshot({ path: `tools/wiki-runtime/site-shell/chapter03-${width}-${kind}.png` });
      await slider.fill("1");
      await expect(part).toHaveAttribute("data-phase", "complete");
      await slider.fill("0");
      const idleHeight = kind === "attention" ? 590 : width <= 600 ? 280 : 620;
      expect((await part.locator(".layer-scene").boundingBox())!.height).toBe(idleHeight);
      const labels = await part
        .locator(".layer-label")
        .filter({ visible: true })
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => node.textContent)
            .map((node) => {
              const r = node.getBoundingClientRect();
              return { x: r.x, right: r.right };
            }),
        );
      for (const label of labels) {
        expect(label.x).toBeGreaterThanOrEqual(0);
        // The eight-value attention detail keeps a readable canvas inside a horizontal scroller.
        const right =
          kind === "attention"
            ? (await part.locator(".layer-scene").boundingBox())!.x +
              (await part.locator(".layer-scene").boundingBox())!.width
            : width;
        expect(label.right).toBeLessThanOrEqual(right);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator(".wiki-article").locator('a[href*="/model"], a[href*="/wiki"]')).toHaveCount(0);
  });
}

test("课程目录定位RMS且正文九段按同一依赖顺序排列", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chapters/03");
  await page.getByRole("button", { name: "本页目录", exact: true }).click();
  await page.getByTestId("pagetoc-pop").getByRole("link", { name: "RMSNorm：先准备支路的输入" }).click();
  await expect(page).toHaveURL(/chapters\/03#rms$/);
  await expect(page.locator("#rms")).toBeInViewport();
  expect(
    await page.locator(".wiki-body h2").evaluateAll((nodes) => nodes.slice(0, 9).map((node) => node.id)),
  ).toEqual([
    "two-halves",
    "hidden",
    "residual",
    "rms",
    "attention",
    "attention-add",
    "ffn",
    "ffn-add",
    "whole-layer",
  ]);
  await expect(page.locator('[data-part="mhc"], [data-part="ffn"]')).toHaveCount(0);
});
