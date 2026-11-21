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

test("NVIDIA 四机型谱系按需加载并支持五层封装晶粒透视与平台记忆", async ({ page }) => {
  const models: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".glb")) models.push(request.url().split("/").at(-1)!);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/hardware?vendor=nvidia");
  const hardware = page.frameLocator(".experience-frame");
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-platform", "nvidia");
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "dgx-h100");
  await expect(hardware.locator("#modelpicker")).toBeVisible();
  await expect(hardware.locator("#modelgrid button")).toHaveCount(4);
  expect(models.sort()).toEqual(["cabinet-42u.glb", "dgx-h100.glb"]);

  await hardware.locator('[data-model-key="dgx-b200"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "dgx-b200");
  await expect(hardware.locator("#title")).toHaveText("NVIDIA DGX B200");
  await expect(hardware.locator('#wikilinks a[href="/#/wiki/tensor-parallel"]')).toBeVisible();
  await hardware.locator('[data-level="1"]').click();
  await expect(hardware.locator("#facts")).toContainText("2 × NVLink 5 NVSwitch");
  expect(models).toContain("dgx-b200.glb");

  await hardware.locator('[data-model-key="gb200-nvl72"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "gb200-nvl72");
  await expect(hardware.locator("#title")).toHaveText("NVIDIA GB200 NVL72 计算托盘");
  await expect(hardware.locator('#wikilinks a[href="/#/wiki/expert-parallel"]')).toBeVisible();
  await hardware.locator('[data-level="2"]').click();
  await expect(hardware.locator("#facts")).toContainText("CPU/GPU 液冷 · 网卡/存储风冷");
  await expect(hardware.locator("#components")).toContainText("1U 外围辅助风冷风扇排");
  await hardware.locator("#spread").fill("1");
  await page.screenshot({
    path: "tools/wiki-runtime/perf-and-visual-audit-20261122/spread100-gb200-nvl72.png",
  });
  expect(models).toContain("gb200-nvl72.glb");

  await hardware.locator('[data-model-key="h100-nvl-pcie"]').click();
  await expect(hardware.locator("#loading")).toBeHidden();
  await expect(hardware.locator("body")).toHaveAttribute("data-model", "h100-nvl-pcie");
  await expect(hardware.locator("#status")).toContainText("H100 NVL PCIe");
  await expect(hardware.locator('#wikilinks a[href="/#/wiki/pipeline-parallel"]')).toBeVisible();
  expect(models).toContain("h100-nvl-pcie.glb");

  // Enter Level 4 (封装晶粒) on H100 NVL PCIe and verify 4 callout tags + real Wiki jump
  await hardware.locator('[data-level="4"]').click();
  await expect(hardware.locator("body")).toHaveAttribute("data-level", "4");
  await expect(hardware.locator("#title")).toContainText("H100 NVL PCIe");
  await expect(hardware.locator("#callouts .callout-tag")).toHaveCount(4);

  await hardware.locator('#wikilinks a[href="/#/wiki/pipeline-parallel"]').click();
  await expect(page).toHaveURL(/#\/wiki\/pipeline-parallel$/);
  await expect(page.locator("article h1, main h1").first()).toContainText("流水线并行");
});
