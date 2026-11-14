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
