import { expect, test } from "@playwright/test";

test("硬件只加载当前平台，已访问平台切换时复用模型", async ({ page }) => {
  const models: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) models.push(request.url().split("/").at(-1)!);
  });
  await page.goto("/#/hardware");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
  await expect(hardware.locator("#loading")).toBeHidden();
  expect(models.sort()).toEqual(["atlas-800t-a2.glb", "cabinet-42u.glb"]);
  await hardware.getByRole("button", { name: "NVIDIA", exact: true }).click();
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "nvidia");
  await expect(hardware.locator("#loading")).toBeHidden();
  await hardware.getByRole("button", { name: "华为 ASCEND", exact: true }).click();
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
  await hardware.getByRole("button", { name: "NVIDIA", exact: true }).click();
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "nvidia");
  expect(models.sort()).toEqual(["atlas-800t-a2.glb", "cabinet-42u.glb", "dgx-h100.glb"]);
});

test("另一平台加载失败可以重试，不必刷新整个页面", async ({ page }) => {
  let attempts = 0;
  await page.route("**/dgx-h100.glb", async (route) => {
    if (++attempts === 1) await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/#/hardware");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "ascend");
  await hardware.getByRole("button", { name: "NVIDIA", exact: true }).click();
  await expect(hardware.locator("#loading b")).toHaveText("模型载入失败");
  await hardware.getByRole("button", { name: "重试加载", exact: true }).click();
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "nvidia");
  await expect(hardware.locator("#loading")).toBeHidden();
  expect(attempts).toBe(2);
});

test("昇腾四款机型按需懒加载，并支持从机柜连续深入到第五层封装晶粒", async ({ page }) => {
  const models: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) models.push(request.url().split("/").at(-1)!);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/hardware");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "atlas-800t-a2");
  expect(models.sort()).toEqual(["atlas-800t-a2.glb", "cabinet-42u.glb"]);

  // Dock and step-note should not overlap vertically
  const dockBox = await hardware.locator(".dock").boundingBox();
  const noteBox = await hardware.locator(".step-note").boundingBox();
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(noteBox!.y);

  // Switch across new Ascend models and verify on-demand loading
  await hardware.locator('[data-model-key="atlas-800i-a3"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "atlas-800i-a3");
  await expect(hardware.locator("#title")).toHaveText("华为 Atlas 800I A3");
  expect(models).toContain("atlas-800i-a3.glb");

  await hardware.locator('[data-model-key="atlas-800-3000"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "atlas-800-3000");
  await expect(hardware.locator("#title")).toHaveText("华为 Atlas 800 (型号 3000)");
  expect(models).toContain("atlas-800-3000.glb");

  await hardware.locator('[data-model-key="ascend-950dt"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "ascend-950dt");
  await expect(hardware.locator("#title")).toHaveText("昇腾 950DT 架构节点");
  expect(models).toContain("ascend-950dt.glb");

  // Enter Level 4 (封装晶粒) and verify 3D pin callouts
  await hardware.locator('[data-level="4"]').click();
  await expect(hardware.locator("body")).toHaveAttribute("data-level", "4");
  await expect(hardware.locator("#title")).toContainText("昇腾 950DT 白皮书 UMA 封装示意");
  await expect(hardware.locator("#callouts .callout-tag")).toHaveCount(4);
});
