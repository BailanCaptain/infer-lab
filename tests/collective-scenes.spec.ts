import { mkdirSync } from "node:fs";
import { expect, type Locator, test } from "@playwright/test";
import { COLLECTIVE_STEPS, COLLECTIVES, collectiveSeconds } from "../src/app/wiki/scene-collective";

const evidence = process.env.WIKI_SCENE_EVIDENCE_DIR
  ? `${process.env.WIKI_SCENE_EVIDENCE_DIR}/collective`
  : "tools/wiki-runtime/collective-2026-11-10";
const expected = [
  "1,2,3,4;1,2,3,4;1,2,3,4;1,2,3,4",
  "1,_,_,_;_,2,_,_;_,_,3,_;_,_,_,4",
  "1,2,3,4;_,_,_,_;_,_,_,_;_,_,_,_",
  "1,2,3,4;1,2,3,4;1,2,3,4;1,2,3,4",
  "1111,2222,3333,4444;_,_,_,_;_,_,_,_;_,_,_,_",
  "1111,_,_,_;_,2222,_,_;_,_,3333,_;_,_,_,4444",
  "1111,2222,3333,4444;1111,2222,3333,4444;1111,2222,3333,4444;1111,2222,3333,4444",
  "1,10,100,1000;2,20,200,2000;3,30,300,3000;4,40,400,4000",
  "1111,2222,3333,4444;1111,2222,3333,4444;1111,2222,3333,4444;1111,2222,3333,4444",
];
async function seek(figure: Locator, p: number) {
  await figure.getByRole("slider").evaluate((node, progress) => {
    const el = node as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      el,
      String(Number(el.max) * progress),
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, p);
}
async function readable(canvas: Locator) {
  return canvas.locator(".wiki-inference-label:visible").evaluateAll((nodes) => {
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
            Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 3 &&
            Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 4 &&
            (a.value || b.value),
        )
        .map((b) => `${a.text}/${b.text}`),
    );
  });
}
test.beforeAll(() => {
  mkdirSync(evidence, { recursive: true });
});
test("all modes: moving values remain readable, inside canvas, and fullscreen works", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/#/wiki/collective-communication#scene-collective-communication");
  const figure = page.getByTestId("scene-collective-communication"),
    canvas = figure.locator(".wiki-scene-canvas");
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute("data-ready", "true");
  for (const width of [1600, 1100]) {
    await page.setViewportSize({ width, height: 1100 });
    if (width === 1100) {
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.52, { steps: 12 });
      await page.mouse.up();
    }
    for (const [kind, lesson] of COLLECTIVES.entries()) {
      await figure.getByRole("button", { name: lesson.name, exact: true }).click();
      await figure.getByRole("button", { name: "暂停", exact: true }).click();
      const action = kind === 8 ? 5 : Math.floor(COLLECTIVE_STEPS[kind]!.length / 2);
      for (const local of [0, 0.16, 0.3, 0.45, 0.6, 0.76, 0.9]) {
        await seek(figure, (4 + (action + local) * 3.6) / collectiveSeconds(kind));
        expect(await readable(canvas), `${width} ${lesson.name} ${local}`).toEqual([]);
        const clipped = await canvas.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return [...el.querySelectorAll<HTMLElement>(".wiki-inference-label")]
            .filter((n) => !n.hidden && n.textContent?.trim())
            .filter((n) => {
              const r = n.getBoundingClientRect();
              return (
                r.left < box.left - 1 ||
                r.right > box.right + 1 ||
                r.top < box.top - 1 ||
                r.bottom > box.bottom + 1
              );
            })
            .map((n) => n.textContent);
        });
        expect(clipped, `${width} ${lesson.name} ${local} clip`).toEqual([]);
      }
      await seek(figure, (4 + (action + 0.45) * 3.6) / collectiveSeconds(kind));
      await canvas.screenshot({ path: `${evidence}/${kind}-final-layout-${width}.png` });
    }
  }
  await figure.getByRole("button", { name: "放大观看图解" }).click();
  await expect(figure.getByRole("button", { name: "退出放大观看" })).toBeVisible();
  expect(await readable(canvas)).toEqual([]);
  await canvas.screenshot({ path: `${evidence}/ring-fullscreen.png` });
  await figure.getByRole("button", { name: "退出放大观看" }).click();
});
for (const [kind, lesson] of COLLECTIVES.entries()) {
  test(`${lesson.name}: full playback, arrival, rewind, switch and narrow view`, async ({ page }) => {
    test.setTimeout(110_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || /buffer.*small|THREE.*warn/i.test(m.text())) errors.push(m.text());
    });
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/#/wiki/collective-communication#scene-collective-communication");
    const figure = page.getByTestId("scene-collective-communication"),
      canvas = figure.locator(".wiki-scene-canvas");
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute("data-ready", "true");
    if (kind > 0) {
      await figure.getByRole("button", { name: lesson.name, exact: true }).click();
      await figure.getByRole("button", { name: "暂停", exact: true }).click();
    }
    await seek(figure, 0);
    await expect(figure.getByRole("slider")).toHaveAttribute("max", String(collectiveSeconds(kind)));
    expect(await readable(canvas)).toEqual([]);
    await canvas.screenshot({ path: `${evidence}/${kind}-opening.png` });
    await figure.getByRole("combobox", { name: "播放速度" }).selectOption("2");
    await figure.getByRole("button", { name: "连续播放", exact: true }).click();
    const actions = COLLECTIVE_STEPS[kind]!.length;
    for (const action of [0, Math.floor(actions / 2), actions - 1]) {
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-progress")), { timeout: 45000 })
        .toBeGreaterThanOrEqual((4 + (action + 0.45) * 3.6) / collectiveSeconds(kind));
      await canvas.screenshot({ path: `${evidence}/${kind}-played-${action}.png` });
    }
    await expect(figure.getByRole("button", { name: "重新播放", exact: true })).toBeVisible();
    await expect(canvas).toHaveAttribute("data-result", expected[kind]!);
    await figure.screenshot({ path: `${evidence}/${kind}-end.png` });
    for (const action of [0, Math.floor(actions / 2), actions - 1]) {
      await seek(figure, (4 + (action + 0.69) * 3.6) / collectiveSeconds(kind));
      await expect(canvas).toHaveAttribute("data-arrived", "false");
      const before = await canvas.getAttribute("data-result");
      await seek(figure, (4 + (action + 0.76) * 3.6) / collectiveSeconds(kind));
      await expect(canvas).toHaveAttribute("data-arrived", "true");
      await expect(canvas).toHaveAttribute("data-applied", "false");
      await expect(canvas).toHaveAttribute("data-result", before!);
      expect(await readable(canvas), `arrival ${action}`).toEqual([]);
      await canvas.screenshot({ path: `${evidence}/${kind}-arrival-${action}.png` });
      await seek(figure, (4 + (action + 0.9) * 3.6) / collectiveSeconds(kind));
      await expect(canvas).toHaveAttribute("data-applied", "true");
      expect(await readable(canvas), `applied ${action}`).toEqual([]);
    }
    await seek(figure, 1);
    await figure.getByRole("button", { name: "重新播放", exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-progress"))).toBeGreaterThan(0.01);
    await figure.getByRole("button", { name: "暂停", exact: true }).click();
    const paused = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(200);
    expect(await canvas.getAttribute("data-progress")).toBe(paused);
    await page.setViewportSize({ width: 1100, height: 1100 });
    await seek(figure, (4 + (Math.floor(actions / 2) + 0.76) * 3.6) / collectiveSeconds(kind));
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.52, { steps: 12 });
    await page.mouse.up();
    expect(await readable(canvas), "narrow rotation").toEqual([]);
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-rotated.png` });
    await figure.getByRole("button", { name: "复位图解视角" }).click();
    await seek(figure, 1);
    await expect(canvas).toHaveAttribute("data-result", expected[kind]!);
    expect(await readable(canvas), "narrow end").toEqual([]);
    await canvas.screenshot({ path: `${evidence}/${kind}-narrow-end.png` });
    await figure.getByRole("button", { name: kind === 0 ? "Scatter" : "Broadcast", exact: true }).click();
    await figure.getByRole("button", { name: "暂停", exact: true }).click();
    await seek(figure, 0);
    await expect(canvas).toHaveAttribute("data-result", "_,_,_,_;_,_,_,_;_,_,_,_;_,_,_,_");
    expect(errors).toEqual([]);
  });
}
