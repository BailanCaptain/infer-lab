import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("取列和写回的走线避开矩阵标题，旋转后仍连着矩阵", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const part = page.locator('[data-layer-scene="ffn"]');
  const scene = part.locator(".layer-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  for (const [progress, name] of [
    [0.29, "take"],
    [0.488, "write"],
  ] as const) {
    await part.getByRole("slider").fill(String(progress));
    const visible = await part
      .locator(".layer-wire")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => Number((node as SVGElement).style.opacity) > 0.1)
          .map((node) => node.getAttribute("d")),
      );
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.join(" ")).not.toMatch(/NaN|undefined/);
    const collisions = await scene.evaluate((host) => {
      const origin = host.getBoundingClientRect();
      const labels = Array.from(host.querySelectorAll(".layer-label")).map((node) => ({
        rect: node.getBoundingClientRect(),
        text: node.textContent,
      }));
      const crossings: string[] = [];
      for (const path of host.querySelectorAll<SVGPathElement>(".layer-wire")) {
        if (Number(path.style.opacity) <= 0.1) continue;
        for (let distance = 0; distance <= path.getTotalLength(); distance += 2) {
          const point = path.getPointAtLength(distance);
          const hit = labels.find(
            ({ rect }) =>
              point.x + origin.x > rect.left &&
              point.x + origin.x < rect.right &&
              point.y + origin.y > rect.top &&
              point.y + origin.y < rect.bottom,
          );
          if (hit) {
            crossings.push(
              `${path.dataset.tone}: ${hit.text} at ${point.x.toFixed(1)},${point.y.toFixed(1)}`,
            );
            break;
          }
        }
      }
      return crossings;
    });
    await scene.screenshot({ path: `tools/wiki-runtime/ch03-takeover/wires-${name}.png` });
    expect(collisions, name).toEqual([]);
  }
  await part.getByRole("slider").fill("0.29");
  const paths = part.locator(".layer-wire");
  const before = await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
  const box = (await scene.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  expect(await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))).not.toEqual(before);
});

for (const [kind, anchor, progress] of [
  ["attention", "attention", 0.31],
  ["residual-attn", "attention-add", 0.65],
  ["ffn", "ffn", 0.35],
  ["residual-ffn", "ffn-add", 0.65],
] as const) {
  test(`固定画幅，暂停续播和终点写回 ${kind}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/chapters/03#${anchor}`);
    await openLocalScene(page, kind);
    const part = page.locator(`[data-layer-scene="${kind}"]`);
    const canvas = part.locator(".layer-scene");
    await canvas.scrollIntoViewIfNeeded();
    await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
    const initialHeight = (await canvas.boundingBox())!.height;
    const positions = () =>
      part.locator(".layer-label").evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          const host = node.closest(".layer-scene")!.getBoundingClientRect();
          return [box.x - host.x, box.y - host.y, box.width, box.height];
        }),
      );
    const initial = await positions();
    await part.getByRole("slider").fill(String(progress));
    await expect(part).not.toHaveAttribute("data-phase", "0");
    expect((await canvas.boundingBox())!.height).toBe(initialHeight);
    expect(await positions()).toEqual(initial);
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    await expect
      .poll(async () => Number(await part.getByRole("slider").inputValue()))
      .toBeGreaterThan(progress + 0.002);
    await part.getByRole("button", { name: "暂停计算", exact: true }).click();
    const paused = await part.getByRole("slider").inputValue();
    await page.waitForTimeout(150);
    expect(await part.getByRole("slider").inputValue()).toBe(paused);
    await part.getByRole("slider").fill(String(progress));
    await canvas.screenshot({ path: `tools/wiki-runtime/ch03-takeover/motion-${kind}.png` });
    if (kind.startsWith("residual")) {
      await part.getByRole("button", { name: /4.*写回/ }).click();
      await expect(part.locator(".layer-column-status")).toContainText("结果整列回到");
    }
    await part.getByRole("slider").fill("1");
    await expect(part).toHaveAttribute("data-phase", "complete");
    await expect(part.locator(".layer-column-work")).toBeHidden();
    expect(await positions()).toEqual(initial);
    expect((await canvas.boundingBox())!.height).toBe(initialHeight);
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    await expect.poll(async () => Number(await part.getByRole("slider").inputValue())).toBeLessThan(0.1);
    await part.getByRole("button", { name: "暂停计算", exact: true }).click();
  });
}
