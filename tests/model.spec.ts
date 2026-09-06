/**
 * `#/model`："塔"的第一段（第 0 层注意力格子体）静帧。全览、W_q 聚焦 + 悬停、概率叠片各一张；断言只做存在性。
 * SwiftShader 软渲染 10 万个小方块每帧要几秒，所以超时放宽、步骤尽量少。
 */
import { expect, type Page, test } from "@playwright/test";

test.setTimeout(300_000);

async function waitReady(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __modelReady?: boolean }).__modelReady === true,
    null,
    { timeout: 60_000 },
  );
}

test("注意力格子体：全览 / W_q 聚焦 + 悬停 / 概率叠片", async ({ page }) => {
  await page.goto("/#/model");
  await waitReady(page);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/model-all.png" });

  await page.getByTestId("volume-list").getByRole("button", { name: /W_q/ }).click();
  await page.waitForTimeout(2500);
  const box = await page.getByTestId("canvas").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.55);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("hover")).toContainText("W_q");
  await page.screenshot({ path: "test-results/model-wq.png" });

  await page
    .getByTestId("volume-list")
    .getByRole("button", { name: /注意力概率/ })
    .click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/model-probs.png" });
});
