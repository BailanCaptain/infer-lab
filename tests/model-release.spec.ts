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

test("GLM-5.3-Flash 异构旗舰保留 40 段播放与分层探索，旧深链自动回落且四个视图均无调试控件", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/model?model=glm-5-3-flash");
  await expect(page.locator(".experience-edition-switch")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "异构旗舰：GLM-5.3-Flash" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const chapter = page.frameLocator(".experience-frame");
  await expect(chapter.locator(".seg")).toHaveCount(40);
  await expectReleaseControls(chapter);
  const stage = chapter.frameLocator("#stage");
  await expect(stage.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expectReleaseControls(stage);

  await chapter.locator('[data-play="3"]').click();
  await expect(stage.locator(".lesson-sentence")).toBeVisible();
  await expect(stage.locator(".l.seg:not(.off)", { hasText: "句子里的词" })).toBeVisible();
  await chapter.locator('[data-show="3"]').click();
  await expect(stage.locator(".tok-badge")).toHaveCount(6);
  await expect(stage.locator(".tok-badge").first()).toBeVisible();

  await chapter.locator('[data-play="4"]').click();
  await chapter.locator("#s4 .beats li").nth(1).click();
  await expect(stage.locator("#dotcard")).toBeVisible();
  await expect(stage.locator("#dotpill")).toBeVisible();
  await expect(stage.locator(".l.seg:not(.off)", { hasText: "词表" })).toBeVisible();
  await expect(stage.locator(".l.seg:not(.off)", { hasText: "词向量" })).toBeVisible();
  await expect(stage.locator('[data-elided-active="1"]')).toHaveCount(1);

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

  // Legacy deep link with segment=28 automatically routes to GLM-5.3-Flash segment 28.
  await page.goto("/#/model?view=play&segment=28");
  await expect(page.getByRole("link", { name: "异构旗舰：GLM-5.3-Flash" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const deepChapter = page.frameLocator(".experience-frame");
  await expect(deepChapter.locator("#s28")).toHaveClass(/cur/, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("默认 /model 进入标准基座 Qwen3-8B，四视图可交互、支持 30B-A3B 对照与架构切换及原路返回", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/model");
  await expect(page.locator(".experience-edition-switch")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "标准基座：Qwen3-8B" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const playFrame = page.frameLocator(".experience-frame");
  await expect(playFrame.locator(".seg")).toHaveCount(16);
  await expect(playFrame.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expectReleaseControls(playFrame);

  await playFrame.locator('[data-play="5"]').click();
  await expect(playFrame.locator("#dotcard")).toBeVisible();
  await expect(playFrame.locator("#dotpill")).toBeVisible();
  await expect(playFrame.locator(".tok-badge")).toHaveCount(6);
  await expect(playFrame.locator("#play")).toContainText("暂停");
  const t0 = await playFrame.locator("#time").textContent();
  await expect.poll(() => playFrame.locator("#time").textContent()).not.toBe(t0);
  await playFrame.locator("#play").click();
  await expect(playFrame.locator("#play")).not.toContainText("暂停");

  // Switch to Qwen3-30B-A3B MoE comparison inside stage
  await playFrame.locator('#views button[data-variant="30b-a3b"]').click();
  await expect(playFrame.locator("#title")).toContainText("Qwen3-30B-A3B");
  await expect(playFrame.locator("#legend")).toContainText("96 KiB/tok");

  const tabs = page.getByRole("navigation", { name: "演示视图" });
  await tabs.getByRole("link", { name: "整个模型", exact: true }).click();
  const modelFrame = page.frameLocator(".experience-frame");
  await expect(modelFrame.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expectReleaseControls(modelFrame);

  await tabs.getByRole("link", { name: "单层结构", exact: true }).click();
  const layerFrame = page.frameLocator(".experience-frame");
  await expect(layerFrame.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await expect(layerFrame.locator("#title")).toContainText("单层结构");
  await expectReleaseControls(layerFrame);

  await tabs.getByRole("link", { name: "二维架构", exact: true }).click();
  const archFrame = page.frameLocator(".experience-frame");
  await expect(archFrame.locator("svg").first()).toBeVisible();
  await expectReleaseControls(archFrame);
  await archFrame.locator('.box[data-comp="embed"]').first().click();
  await expect(archFrame.locator(".qwen-arch-inspect")).toContainText("tie_word_embeddings=false");

  // Switch to GLM-5.3-Flash and back to Qwen3-8B
  await page.getByRole("link", { name: "异构旗舰：GLM-5.3-Flash" }).click();
  await expect(page.getByRole("link", { name: "异构旗舰：GLM-5.3-Flash" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: "标准基座：Qwen3-8B" }).click();
  await expect(page.getByRole("link", { name: "标准基座：Qwen3-8B" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Back link honors fromPage=attention-qkv
  await page.goto("/#/model?fromPage=attention-qkv");
  const backLink = page.locator(".experience-heading a").first();
  await expect(backLink).toHaveAttribute("href", /\/wiki\/attention-qkv/);

  // Narrow viewport adaptation (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/experiences/qwen-flow/master/index.html?view=model");
  await expect(page.locator("canvas")).toBeVisible();
  const qTitleBox = await page.locator("#title").boundingBox();
  expect(qTitleBox?.width ?? 0).toBeGreaterThan(240);
  expect(qTitleBox?.height ?? 999).toBeLessThan(120);
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
  await page.goto("/#/model?model=glm-5-3-flash");
  const chapter = page.frameLocator(".experience-frame");
  await expect
    .soft(chapter.locator('#map [data-row="col:embed"]'))
    .toHaveCSS("background-color", "rgb(187, 210, 223)");
  await expect
    .soft(chapter.locator('#map [data-row="col:expand"]'))
    .toHaveCSS("background-color", "rgb(214, 201, 220)");
  await page.goto("/experiences/glm-flow/master/arch.html?pal=tailwind");
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(page.locator('[data-comp="embed"] rect[data-role="wt"]').first()).toHaveAttribute(
    "stroke",
    /#9cb0bd/i,
  );
  await expect(page.locator('line[data-comp="resid"]').first()).toHaveAttribute("stroke", /#8d7b94/i);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/experiences/glm-flow/master/model.html?view=whole");
  await expect(page.locator("canvas")).toBeVisible();
  const titleBox = await page.locator("#title").boundingBox();
  expect(titleBox?.width ?? 0).toBeGreaterThan(240);
  expect(titleBox?.height ?? 999).toBeLessThan(120);
  expect(errors).toEqual([]);
});
