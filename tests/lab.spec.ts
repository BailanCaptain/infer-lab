/**
 * 活母版页 `#/lab` 验收：三栏壳 + 21 步可播；给用户看的三个状态截图（默认 / 播放中 / matmul 聚焦）+ 窄屏。
 */
import { expect, type Page, test } from "@playwright/test";

async function waitReady(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __labReady?: boolean }).__labReady === true,
    null,
    {
      timeout: 30_000,
    },
  );
}

test("母版页：三栏、步骤列表、解读栏与 3D 联动，三个状态截图", async ({ page }) => {
  await page.goto("/#/lab");
  await waitReady(page);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "embed.gather");
  await expect(page.getByTestId("step-list")).toBeVisible();
  await expect(page.getByTestId("narration-title")).toHaveText("词嵌入查表");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/lab-default.png" });

  // 点课程轨道跳到 Q 投影（matmul）：右栏出现「这一格怎么算」
  await page
    .getByTestId("step-list")
    .getByRole("button", { name: /Q 投影/ })
    .click();
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
  await expect(page.getByTestId("reading")).toContainText("这一格怎么算");
  await expect(page.getByTestId("beats")).toBeVisible();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/lab-matmul.png" });

  // 播放中（步内过渡到一半）
  await page.getByTestId("play").click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: "test-results/lab-playing.png" });
  await page.getByTestId("pause").click();

  // 窄屏：右栏落到下方
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/lab-narrow.png", fullPage: true });

  // 走完全部步骤不报错
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.keyboard.press("End");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.kv.write");
  await expect(page.getByTestId("narration-title")).toHaveText("写入 KV Cache");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/lab-kv.png" });
});
