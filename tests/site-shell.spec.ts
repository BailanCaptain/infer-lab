import { expect, test } from "@playwright/test";
import { CHAPTERS } from "../src/content/chapters";

test("旧课程总览地址现在打开知识主题入口", async ({ page }) => {
  await page.goto("/#/chapters");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("大模型推理");
  await expect(page.getByTestId("knowledge-topics")).toBeVisible();
  await page.getByTestId("wiki-toc").getByRole("searchbox").fill("token");
  await page
    .getByTestId("wiki-toc")
    .getByRole("link", { name: /^Token 与分词/ })
    .click();
  await expect(page).toHaveURL(/wiki\/token$/);
  await expect(page.getByTestId("wiki-body")).toBeVisible();
});
test("历史课程深链接仍可导航、刷新和翻页，新主入口返回知识正文", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/#/chapters/00");
  const directory = page.getByRole("navigation", { name: "课程目录", exact: true });
  await expect(directory.getByRole("link")).toHaveCount(22);
  for (const chapter of CHAPTERS) {
    await directory.getByRole("link", { name: `${chapter.id} ${chapter.title}`, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(chapter.title);
    await expect(page.getByRole("main")).not.toContainText(/Wiki|知识库|问知识库/i);
    await expect(page.getByRole("main").locator('a[href*="/wiki"]')).toHaveCount(0);
    const reader = chapter.id === "03";
    expect(await page.locator(reader ? ".wiki-body > h2" : ".lesson-section").count()).toBeGreaterThanOrEqual(
      3,
    );
    await expect(page.locator(reader ? ".course-formula" : ".lesson-example")).not.toHaveCount(0);
    await expect(page.locator(reader ? ".course-reader-check" : ".lesson-check").first()).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(/尚待编排|待补充/);
  }
  // Native matrix parts may load source modules/data, never an entire viewer or Wiki API.
  expect(requests.filter((url) => /\/experiences\/.*\.html|\/api\/wiki/.test(url))).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PR 影响分析");
  await page
    .getByRole("navigation", { name: "章节翻页" })
    .getByRole("link", { name: /上一章/ })
    .click();
  await expect(page).toHaveURL(/chapters\/20$/);
  await page.goBack();
  await expect(page).toHaveURL(/chapters\/21$/);
  await page.screenshot({ path: "test-results/site-chapter-desktop.png" });
  await page.getByRole("navigation", { name: "全站导航" }).getByRole("link", { name: "主章节" }).click();
  await expect(page.getByTestId("wiki-toc")).toBeVisible();
  await page.goto("/#/chapters/99");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("没有找到这个页面");
});

test("手机目录、全站入口与末章可操作", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chapters/03");
  const directory = page.getByRole("navigation", { name: "课程目录", exact: true });
  await page.getByText("课程目录 · 22 章", { exact: true }).click();
  await directory.getByRole("link", { name: /21 PR 影响分析/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PR 影响分析");
  // Leaving the sample reader mounts the chapter shell with its mobile directory closed.
  await expect(directory).toBeHidden();
  await page.getByText("课程目录 · 22 章", { exact: true }).click();
  await expect(directory).toBeVisible();
  await page.getByText("课程目录 · 22 章", { exact: true }).click();
  await expect(directory).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "主章节" })).toBeVisible();
  await page.screenshot({ path: "test-results/site-chapter-mobile.png" });
});

test("GLM 同源播放、切换视图并回到发起章节", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/#/chapters/02");
  await page.getByRole("link", { name: "打开 GLM 计算演示" }).click();
  await expect(page).toHaveURL(/chapters\/02\?experience=1$/);
  await expect(page.getByRole("navigation", { name: "课程目录", exact: true })).toBeVisible();
  const chapter = page.frameLocator('iframe[title="GLM 模型计算 · 计算演示"]');
  await expect(chapter.getByRole("heading", { level: 1 })).toContainText("一句话");
  await expect(chapter.locator("#play")).toBeEnabled({ timeout: 60000 });
  const initialTime = await chapter.locator("#time").textContent();
  await chapter.locator("#play").click();
  await expect(chapter.locator("#play")).toContainText("暂停");
  await expect.poll(() => chapter.locator("#time").textContent(), { timeout: 60000 }).not.toBe(initialTime);
  await chapter.locator("#play").click();
  await page.screenshot({ path: "test-results/site-glm.png" });
  await page.getByRole("link", { name: "二维架构", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="GLM 模型计算 · 二维架构"]').locator("svg").first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回第 02 章" }).click();
  await expect(page).toHaveURL(/chapters\/02$/);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("硬件各入口复用已认可的整机母版，保持课程上下文", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/hardware?chapter=08");
  const whole = page.frameLocator('iframe[title="硬件 3D · 机柜与整机"]');
  await expect(whole.locator("#loading")).toBeHidden({ timeout: 60000 });
  await whole.getByRole("button", { name: "NVIDIA", exact: true }).click();
  await expect(whole.locator("#title")).toHaveText("NVIDIA DGX H100");
  await whole.getByRole("button", { name: "华为 ASCEND" }).click();
  await expect(whole.locator("#title")).toHaveText("华为 Atlas 800T A2");
  await expect(whole.locator("#source")).toHaveAttribute("href", /^https:\/\/e\.huawei\.com\//);
  await whole.getByRole("button", { name: "抽出服务器 →", exact: true }).click();
  await whole.getByRole("button", { name: "打开机箱 →", exact: true }).click();
  await expect(whole.locator("#components button").first()).toBeVisible();
  // The master uses an 850 ms camera transition; capture its settled composition.
  await page.waitForTimeout(1000);
  await whole.locator(".panel").evaluate((panel) => {
    panel.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/site-hardware.png" });
  await page.getByRole("link", { name: "返回第 08 章" }).click();
  await expect(page).toHaveURL(/chapters\/08$/);
  await page.goto("/#/hardware?view=npu&chapter=07");
  await expect(page.locator(".experience-frame")).toHaveAttribute("src", /whole\/index.html\?/);
  const npu = page.frameLocator(".experience-frame");
  await expect(npu.locator("#loading")).toBeHidden({ timeout: 60000 });
  await expect(npu.locator("body")).toHaveAttribute("data-platform", "ascend");
  await expect(npu.locator("body")).toHaveAttribute("data-level", "3");
  const canvas = await npu.locator("canvas").boundingBox();
  const panel = await npu.locator(".panel").boundingBox();
  expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(panel!.x);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(1440);
  await expect(npu.locator(".brand")).toBeHidden();
  await expect(page.locator(".reader-header")).toBeVisible();
  await expect(page.getByRole("link", { name: "硬件", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "返回第 07 章" })).toHaveAttribute("href", "#/chapters/07");
  await expect(page.getByRole("link", { name: "NPU 模组与内部", exact: true })).toHaveCount(0);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/site-hardware-module.png" });
  expect(errors).toEqual([]);
});

test("窄屏硬件的说明与控件不遮挡画布", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chapters/07?experience=1&view=npu");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden({ timeout: 60000 });
  await expect(page.getByRole("navigation", { name: "课程目录", exact: true })).toBeHidden();
  const canvas = await hardware.locator("canvas").boundingBox();
  const panel = await hardware.locator(".panel").boundingBox();
  const controls = await hardware.locator(".viewtools").boundingBox();
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(controls!.y);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(panel!.y);
  expect(canvas!.width).toBeLessThanOrEqual(390);
  await hardware.getByRole("button", { name: "NVIDIA", exact: true }).click();
  await expect(hardware.locator("#title")).toHaveText("H100 GPU 模组 1");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/site-hardware-mobile.png", fullPage: true });
});
