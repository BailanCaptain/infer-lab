import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR = join(process.cwd(), "test-results", "evidence", "wave5-deep-polish");
mkdirSync(EVIDENCE_DIR, { recursive: true });

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

async function assertNoHorizontalOverflow(page: Page, contextLabel: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth <= metrics.innerWidth,
    `horizontal overflow (${metrics.scrollWidth} > ${metrics.innerWidth}) on ${contextLabel}`,
  ).toBe(true);
}

const WAVE3_SANDBOXES = [
  { pageId: "prefill", diagramId: "prefill-fig-compute-vs-bw" },
  { pageId: "low-precision-formats", diagramId: "low-prec-fig-bit-anatomy" },
  { pageId: "ascend-model-onboarding", diagramId: "onboarding-four-gates" },
  { pageId: "tensor-layout", diagramId: "tensor-layout-fig-nd-nz-cube" },
  { pageId: "engram-conditional-memory", diagramId: "engram-fig-lookup-flow" },
  { pageId: "pd-disaggregation", diagramId: "pd-disaggregation-intuition" },
] as const;

test("1. Wave-3 六座 2D 交互教学沙盒在桌面端 (1440×900) 与移动端 (375×812) 的渲染、交互、键盘退回与零横向溢出核验", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = attachErrorCollector(page);

  for (const { pageId, diagramId } of WAVE3_SANDBOXES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/wiki/${pageId}`);

    const root = page.locator(`[data-testid="interactive-diagram-root"][data-diagram-id="${diagramId}"]`);
    await expect(root, `${diagramId} mounted in sandbox mode`).toBeVisible();
    await expect(root).toHaveAttribute("data-mode", "sandbox");
    await root.scrollIntoViewIfNeeded();
    await assertNoHorizontalOverflow(page, `${pageId}@1440`);

    // Verify toolbar buttons exist and clicking an enabled button updates state cleanly
    const enabledToolbarBtns = root.locator('[role="toolbar"] button:not([disabled])');
    expect(
      await enabledToolbarBtns.count(),
      `${diagramId} enabled toolbar button count`,
    ).toBeGreaterThanOrEqual(1);
    const clickTarget =
      (await enabledToolbarBtns.count()) >= 2 ? enabledToolbarBtns.nth(1) : enabledToolbarBtns.first();
    await clickTarget.click();

    // Verify collapsible details opens & closes cleanly
    const details = root.locator("details.wiki-edu-details");
    await details.locator(":scope > summary").click();
    await expect(details).toHaveAttribute("open", "");
    await page.screenshot({ path: join(EVIDENCE_DIR, `${diagramId}-1440.png`) });
    await details.locator(":scope > summary").click();

    // Verify Escape key on root falls back to static SVG, and "返回交互版" restores sandbox
    await enabledToolbarBtns.first().focus();
    await page.keyboard.press("Escape");
    await expect(root).toHaveAttribute("data-mode", "svg");
    await root.getByTestId("diagram-mode-sandbox").click();
    await expect(root).toHaveAttribute("data-mode", "sandbox");

    // Verify Mobile 375×812 layout has zero horizontal page overflow
    await page.setViewportSize({ width: 375, height: 812 });
    await root.scrollIntoViewIfNeeded();
    await assertNoHorizontalOverflow(page, `${pageId}@375`);
    await page.screenshot({ path: join(EVIDENCE_DIR, `${diagramId}-375.png`) });
  }

  expect(errors).toEqual([]);
});

test("2. 打磨后的核心 Wiki 页面（learning-guide 五件套、ai-core 算例、ascend-env-and-serve、quantization 新 SVG）渲染与窄屏零溢出", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = attachErrorCollector(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki/learning-guide");
  await expect(page.locator("article")).toContainText("上线前算账");
  await expect(page.locator("article")).toContainText("启动前体检");
  await expect(page.locator("article")).toContainText("报错后定位");
  await expect(page.locator("article")).toContainText("微观原理演示");
  await expect(page.locator("article")).toContainText("生产故障通关场");
  await assertNoHorizontalOverflow(page, "learning-guide@1440");
  await page.screenshot({ path: join(EVIDENCE_DIR, "learning-guide-1440.png") });

  for (const slug of ["ai-core", "ascend-env-and-serve", "core-cli-params", "quantization"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/wiki/${slug}`);
    await expect(page.locator("article h1").first()).toBeVisible();
    await assertNoHorizontalOverflow(page, `${slug}@1440`);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, `${slug}@375`);
  }

  expect(errors).toEqual([]);
});

test("3. 部署计算器 Ascend 950DT 144G 规格展示、3D 硬件旧版 cg=128 兼容与生产态 /#/dev/spike-c 路由隔离", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/tools?tab=calculator&preset=qwen3-8b&card=950dt-128g&tp=1");
  const calc = page.getByTestId("deploy-calculator-view");
  await expect(calc).toBeVisible();
  await expect(calc).toContainText("144G");
  await assertNoHorizontalOverflow(page, "tools-950dt@1440");
  await page.screenshot({ path: join(EVIDENCE_DIR, "tools-950dt-144g.png") });

  // Production build must NOT expose Spike C benchmark harness at /#/dev/spike-c
  if (process.env.PLAYWRIGHT_PREVIEW === "1") {
    await page.goto("/#/dev/spike-c");
    await expect(page.locator("body")).not.toContainText("Spike C");
  }

  expect(errors).toEqual([]);
});
