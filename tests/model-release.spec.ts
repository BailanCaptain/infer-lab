import { expect, type FrameLocator, test } from "@playwright/test";

async function expectReleaseControls(frame: FrameLocator) {
  await expect
    .soft(frame.locator('#tunebar, #tunepop, input[type="color"]'))
    .toHaveCount(0, { timeout: 1000 });
  await expect
    .soft(frame.locator('#views a[href*="pal="], #views a[href*="heads="]'))
    .toHaveCount(0, { timeout: 1000 });
  await expect
    .soft(frame.locator("body"))
    .not.toContainText(/临时调色|一条条往下排|MTP 的颜色还没选/, { timeout: 1000 });
}

test("模型定稿保留 40 段播放与分层探索，四个视图均无调试控件", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/model");
  const chapter = page.frameLocator(".experience-frame");
  await expect(chapter.locator(".seg")).toHaveCount(40);
  await expectReleaseControls(chapter);
  const stage = chapter.frameLocator("#stage");
  await expect(stage.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expectReleaseControls(stage);

  await chapter.locator("#play").click();
  await expect(chapter.locator("#play")).toContainText("暂停");
  const before = await chapter.locator("#time").textContent();
  await expect.poll(() => chapter.locator("#time").textContent()).not.toBe(before);
  await chapter.locator("#play").click();
  await expect(chapter.locator("#play")).not.toContainText("暂停");

  await chapter.locator('[data-show="11"]').click();
  await expect(chapter.locator("#s11")).toHaveClass(/cur/);
  await chapter.locator('[data-play="11"]').click();
  await expect(chapter.locator("#play")).toContainText("暂停");
  const replay = await chapter.locator("#time").textContent();
  await expect.poll(() => chapter.locator("#time").textContent()).not.toBe(replay);
  await chapter.locator("#play").click();
  await chapter.locator("#whole").click();
  await expect(chapter.locator(".seg.cur")).toHaveCount(0);
  await chapter.locator("#next").click();
  await expect(chapter.locator(".seg.cur")).toHaveCount(1);
  await expect(chapter.locator("#play")).toContainText("暂停");
  await chapter.locator("#play").click();
  await page.screenshot({ path: "test-results/model-release-player.png" });

  const tabs = page.getByRole("navigation", { name: "演示视图" });
  await tabs.getByRole("link", { name: "整个模型", exact: true }).click();
  const model = page.frameLocator(".experience-frame");
  await expect(model.locator("#views")).toBeVisible();
  await expectReleaseControls(model);
  await model.getByRole("link", { name: "一层", exact: true }).click();
  await model.getByRole("link", { name: "L04", exact: true }).click();
  await expect(model.locator("#title")).toContainText("L04");
  await expect(model.locator("canvas")).toBeVisible();
  await model.getByRole("link", { name: "单层页", exact: true }).click();
  await expect(model.locator("html")).toHaveAttribute("data-site", "true");
  await expect(model.locator("canvas")).toBeVisible();

  await tabs.getByRole("link", { name: "单层结构", exact: true }).click();
  const layer = page.frameLocator(".experience-frame");
  await expect(layer.locator("#title")).toContainText("L00");
  await expectReleaseControls(layer);
  await layer.getByRole("link", { name: "L03 MLA + MoE", exact: true }).click();
  await expect(layer.locator("#title")).toContainText("L03");
  await layer.getByRole("link", { name: "注意力", exact: true }).click();
  await expect(layer.locator("#title")).toContainText("注意力这一半");
  await layer.getByRole("link", { name: "前馈", exact: true }).click();
  await expect(layer.locator("#title")).toContainText("前馈这一半");
  await page.screenshot({ path: "test-results/model-release-layer.png" });

  await tabs.getByRole("link", { name: "二维架构", exact: true }).click();
  const arch = page.frameLocator(".experience-frame");
  await expect(arch.locator("svg").first()).toBeVisible();
  await expectReleaseControls(arch);
  await arch.locator('.box[data-comp="embed"]').first().click();
  await expect(arch.locator("#tunepop")).toHaveCount(0);
  await page.screenshot({ path: "test-results/model-release-architecture.png" });
  expect(errors).toEqual([]);
});

test("旧浏览器调色和 pal 参数不能改变定稿颜色", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "flow-colors-user",
      JSON.stringify({ embed: ["#000000", "#ff0000"], resid: ["#000000", "#ff0000"] }),
    );
  });
  await page.goto("/#/model");
  const chapter = page.frameLocator(".experience-frame");
  await expect
    .soft(chapter.locator('#map [data-row="col:embed"]'))
    .toHaveCSS("background-color", "rgb(229, 216, 189)");
  await expect
    .soft(chapter.locator('#map [data-row="col:expand"]'))
    .toHaveCSS("background-color", "rgb(222, 203, 228)");
  await page.goto("/experiences/glm-flow/master/arch.html?pal=tailwind");
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(page.locator('[data-comp="embed"] rect[data-role="wt"]').first()).toHaveAttribute(
    "stroke",
    /#9cb0bd/i,
  );
  await expect(page.locator('line[data-comp="resid"]').first()).toHaveAttribute("stroke", /#8d7b94/i);
  expect(errors).toEqual([]);
});
