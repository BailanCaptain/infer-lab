import { expect, type Locator, test } from "@playwright/test";

async function seek(f: Locator, progress: number) {
  await f.getByRole("slider").evaluate((el, p) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      String(Number(input.max) * p),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, progress);
}

test("SP distinguishes summing contributions from copying normalized rows", async ({ page }) => {
  await page.goto("/#/wiki/sequence-parallel#scene-parallel-mechanism-1");
  const f = page.getByTestId("scene-parallel-mechanism-1");
  await expect(f).toHaveAttribute("data-ready", "true");
  const readout = f.getByRole("complementary", { name: "SP 当前数据怎样改变" });
  await expect(readout).toContainText("完整序列：一句话的四行");
  await expect(readout.locator(".wiki-sp-ownership")).toHaveCount(0);
  await seek(f, 0.25);
  await expect(readout).toContainText("卡0贡献 [1, 3, 3, 1]");
  await expect(readout).toContainText("卡1贡献 [0, 4, 4, 0]");
  await expect(readout).toContainText("＝ [1, 7, 7, 1]");
  await seek(f, 0.55);
  await expect(readout).toContainText("各算两行，不跨卡传输");
  await expect(readout.locator("[data-away]")).toHaveCount(4);
  await seek(f, 0.7);
  await expect(readout).toContainText("只复制缺行，不再相加");
  await expect(readout).toContainText("原卡保留，另一卡收到同一行");
  await seek(f, 0.82);
  await expect(readout.locator("[data-away]")).toHaveCount(0);
});

test("CP focus and DCP merge explanation follow the visible calculation", async ({ page }) => {
  await page.goto("/#/wiki/context-parallel#scene-parallel-mechanism-2");
  const pcp = page.getByTestId("scene-parallel-mechanism-2");
  await expect(pcp).toHaveAttribute("data-ready", "true");
  await seek(pcp, 0.58);
  await expect(pcp.locator(".wiki-mechanism-label.name:visible").filter({ hasText: "追踪 Q7" })).toHaveCount(
    1,
  );
  const dcp = page.getByTestId("scene-parallel-mechanism-3");
  await dcp.scrollIntoViewIfNeeded();
  await expect(dcp).toHaveAttribute("data-ready", "true");
  const readout = dcp.getByRole("complementary", { name: "同一个查询的两份答案怎样合并" });
  await seek(dcp, 0.84);
  await expect(readout.getByRole("img", { name: "卡0占2份，卡1占6份" })).toBeVisible();
  await expect(readout).not.toContainText("合并后：");
  await expect(dcp.locator(".wiki-mechanism-label.heading")).not.toContainText("合并完成");
  await seek(dcp, 0.9);
  await expect(readout).toContainText("贡献：[2.5, 7.5, 1.25, 3.75]");
  await expect(readout).not.toContainText("合并后：");
  await seek(dcp, 1);
  await expect(readout).toContainText("合并后：[25, 15, 12.5, 7.5]");
  await expect(dcp.locator(".wiki-mechanism-label.heading")).toContainText("合并完成");
});
