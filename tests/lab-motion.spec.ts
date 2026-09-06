/**
 * Q 投影一步的动效：连续截图五个阶段（抽行抽列 / 逐项相乘 / 收拢 / 写回 / 逐格揭示）。
 * matmul 步 1× 倍速 4.5 s（Step.durationMs）；这里只抓帧给人看，不做像素断言。
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

test("Q 投影动效五帧", async ({ page }) => {
  await page.goto("/#/lab?step=L0.attn.q");
  await waitReady(page);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
  // 等标签排版与首次过渡完成，再从头播这一步
  await page.waitForTimeout(2500);
  await page.getByTestId("first").click();
  await page.getByTestId("scrubber").fill("2");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
  const t0 = Date.now();
  const marks = [
    ["lift", 500],
    ["multiply", 1600],
    ["collapse", 2750],
    ["write", 3550],
    ["sweep", 4300],
  ] as const;
  for (const [name, ms] of marks) {
    const wait = t0 + ms - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    const t = await page.evaluate(
      () => (window as unknown as { __labProgress?: { t: number; stepIndex: number } }).__labProgress,
    );
    console.log(`${name}: t=${t?.t.toFixed(3)} step=${t?.stepIndex}`);
    await page.screenshot({ path: `test-results/motion-${name}.png` });
  }
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
});
