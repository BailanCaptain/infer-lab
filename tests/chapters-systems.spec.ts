import { expect, test } from "@playwright/test";

for (const width of [727, 1440, 390]) {
  test(`09 请求路径、真实部件与地址身份 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#/chapters/09");
    const journey = page.getByRole("region", { name: "一次请求的完整软硬件旅程" });
    const hardware = journey.locator(".course-hardware-stage");
    await hardware.scrollIntoViewIfNeeded();
    await expect(hardware).toHaveAttribute("data-ready", "true", { timeout: 25000 });
    await expect(hardware.locator("[data-asset]")).toHaveAttribute("data-asset", "atlas-800t-a2.glb");
    await expect(hardware.locator("[data-part]")).toHaveCount(4);
    for (const [button, part] of [
      ["1 · 入口与分词", "host"],
      ["3 · 准备与提交", "memory"],
      ["4 · 设备计算", "npu"],
      ["6 · 流式返回", "network"],
      ["7 · 结束与回收", "host"],
    ]) {
      await journey.getByRole("button", { name: button, exact: true }).click();
      await expect(hardware).toHaveAttribute("data-focus", part!);
    }
    await hardware.screenshot({ path: `tools/wiki-runtime/ch03-takeover/ch09-hardware-${width}.png` });
    await journey
      .locator(".systems-route")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/ch09-route-${width}.png` });
    const ledger = page.getByRole("region", { name: "两条请求的行与缓存槽位" });
    await expect(ledger.locator("[data-slot]")).toHaveText(["10", "36", "37", "38"]);
    await ledger.getByRole("slider", { name: "A 本轮序列位置" }).fill("8");
    await expect(ledger.locator("[data-slot]").first()).toHaveText("20");
    await ledger.getByRole("combobox", { name: "B 的输入长度" }).selectOption("4");
    await ledger.getByRole("button", { name: "检查批次第 4 行", exact: true }).click();
    await expect(ledger.locator("[data-slot-result]")).toHaveAttribute("data-slot-result", "39");
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  });
  test(`13 数学结果、流水线与十六个实体模组 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/#/chapters/13");
    const lab = page.getByRole("region", { name: "TP PP DP 的计算与硬件对照" });
    await expect(lab.locator("[data-complete]")).toHaveAttribute("data-complete", "5,1,3,-2");
    await lab.getByRole("combobox", { name: "矩阵切分方向" }).selectOption("row");
    await lab.getByRole("spinbutton", { name: "输入 x0", exact: true }).fill("-3");
    await expect(lab.locator("[data-complete]")).toHaveAttribute("data-complete", "1,-11,7,-10");
    const hardware = lab.locator(".course-hardware-stage");
    await hardware.scrollIntoViewIfNeeded();
    await expect(hardware).toHaveAttribute("data-ready", "true", { timeout: 25000 });
    await expect(hardware.locator("[data-rank]")).toHaveCount(16);
    await lab.getByRole("combobox", { name: "检查硬件 rank" }).selectOption("12");
    await expect(lab.locator("[data-members]")).toContainText("8、9、10、11、12、13、14、15");
    await hardware.screenshot({ path: `tools/wiki-runtime/ch03-takeover/ch13-hardware-${width}.png` });
    await lab.getByRole("button", { name: "PP · 分层接力", exact: true }).click();
    await lab.getByRole("combobox", { name: "流水线批次数" }).selectOption("4");
    await expect(lab.locator('[data-batch]:not([data-batch="idle"])')).toHaveCount(16);
    await expect(lab.locator("[data-utilization]")).toHaveAttribute("data-utilization", "0.5714");
    await expect(lab.locator("[data-members]")).toContainText("12、13、14、15");
    await lab
      .locator(".pipeline-timeline")
      .screenshot({ path: `tools/wiki-runtime/ch03-takeover/ch13-pipeline-${width}.png` });
    await lab.getByRole("button", { name: "DP · 分请求", exact: true }).click();
    await lab.getByRole("combobox", { name: "请求 A 的执行组" }).selectOption("1");
    await expect(lab.locator('.parallel-replicas [data-group="1"] strong')).toHaveText("A、B");
    await expect(hardware.locator("[data-rank]")).toHaveCount(16);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  });
}
