import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("注意力标签各自贴近矩阵，旋转后连线也不穿过标签", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/chapters/03#attention");
  await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
  await openLocalScene(page, "attention");
  const part = page.locator('[data-layer-scene="attention"]');
  await part.locator(".layer-scene").scrollIntoViewIfNeeded();
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  const summary = part.locator('[data-matrix="汇总内容"]');
  const output = part.locator('[data-matrix="注意力 ΔA"]');
  // The summary is named above its own column; ΔA is named below its full matrix.
  expect((await output.boundingBox())!.y - (await summary.boundingBox())!.y).toBeGreaterThan(25);
  await part.locator(".layer-scene").screenshot({ path: "tools/wiki-runtime/ch03-takeover/labels-idle.png" });
  const overview = (await part.locator(".layer-scene").boundingBox())!;
  await page.screenshot({
    path: "tools/wiki-runtime/ch03-takeover/labels-overview.png",
    clip: { x: overview.x, y: overview.y + 70, width: overview.width, height: 310 },
  });
  for (const progress of [0.15, 0.425, 0.61, 0.975]) {
    await part.getByRole("slider").fill(String(progress));
    const hits = await part.locator(".layer-scene").evaluate((host) => {
      const frame = host.getBoundingClientRect();
      const labels = Array.from(host.querySelectorAll(".layer-label")).map((label) => ({
        rect: label.getBoundingClientRect(),
        name: label.textContent,
      }));
      const hits: string[] = [];
      for (const path of host.querySelectorAll<SVGPathElement>(".attention-workbench-wires path")) {
        if (Number(getComputedStyle(path).opacity) < 0.1) continue;
        for (let d = 0; d < path.getTotalLength(); d += 2) {
          const p = path.getPointAtLength(d);
          for (const { rect, name } of labels) {
            if (
              p.x + frame.x > rect.left &&
              p.x + frame.x < rect.right &&
              p.y + frame.y > rect.top &&
              p.y + frame.y < rect.bottom
            )
              hits.push(name!);
          }
        }
      }
      return hits;
    });
    expect(hits, `progress ${progress}`).toEqual([]);
    const overlapping = await part.locator(".layer-label").evaluateAll((nodes) => {
      const boxes = nodes.map((node) => node.getBoundingClientRect());
      return boxes.some((a, i) =>
        boxes
          .slice(i + 1)
          .some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top),
      );
    });
    expect(overlapping, `labels at progress ${progress}`).toBe(false);
  }
  await part.getByRole("slider").fill("0.747");
  await part
    .locator(".layer-scene")
    .screenshot({ path: "tools/wiki-runtime/ch03-takeover/labels-project.png" });
  const scene = (await part.locator(".layer-scene").boundingBox())!;
  await page.mouse.move(scene.x + scene.width / 2, scene.y + scene.height / 2);
  await page.mouse.down();
  await page.mouse.move(scene.x + scene.width / 2 + 60, scene.y + scene.height / 2 + 15, { steps: 6 });
  await page.mouse.up();
  await part
    .locator(".layer-scene")
    .screenshot({ path: "tools/wiki-runtime/ch03-takeover/labels-rotated.png" });
  const overlaps = await part.locator(".layer-label").evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect());
    return boxes.flatMap((a, i) =>
      boxes
        .slice(i + 1)
        .filter((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top),
    );
  });
  expect(overlaps).toEqual([]);
});
