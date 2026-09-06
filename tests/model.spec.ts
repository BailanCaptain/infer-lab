/**
 * `#/model`：整模型结构静帧。四个视图各截一张图给人看；断言只做存在性与悬停条。
 */
import { expect, type Page, test } from "@playwright/test";

async function waitReady(page: Page) {
  await page.waitForFunction(
    () => (window as unknown as { __modelReady?: boolean }).__modelReady === true,
    null,
    {
      timeout: 30_000,
    },
  );
}

test("整模型四个视图 + 悬停", async ({ page }) => {
  await page.goto("/#/model");
  await waitReady(page);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/model-all.png" });
  for (const name of ["词嵌入", "第 0 层", "输出"]) {
    await page.getByTestId("views").getByRole("button", { name }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `test-results/model-${name}.png` });
  }
  await page.getByTestId("views").getByRole("button", { name: "第 0 层" }).click();
  await page.waitForTimeout(1000);
  const box = await page.getByTestId("canvas").boundingBox();
  expect(box).not.toBeNull();
  // 在画布中部扫一条线，找到能悬停出信息条的位置
  let hit = false;
  for (let fx = 0.2; fx <= 0.8 && !hit; fx += 0.05) {
    for (let fy = 0.35; fy <= 0.65 && !hit; fy += 0.1) {
      await page.mouse.move(box!.x + box!.width * fx, box!.y + box!.height * fy);
      await page.waitForTimeout(80);
      hit = (await page.getByTestId("hover").count()) > 0;
    }
  }
  expect(hit).toBe(true);
  await page.screenshot({ path: "test-results/model-hover.png" });
});
