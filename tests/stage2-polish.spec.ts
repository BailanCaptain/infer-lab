import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR = join(process.cwd(), "test-results", "evidence", "stage2-polish");
mkdirSync(EVIDENCE_DIR, { recursive: true });

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `horizontal overflow at ${page.viewportSize()?.width}px on ${page.url()}`,
  ).toBe(true);
}

test("1. /#/tools ①→②→③ 视觉层级、Qwen3-235B-A22B 一键应用推荐方案（TP=8, w8a8_dynamic + 刷新持久化 + 体检台交接）与工程折叠抽屉（1440 & 375）", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/tools?tab=calculator&preset=qwen3-235b-a22b&card=a2-64g&precision=bf16&tp=1");
  const calc = page.getByTestId("deploy-calculator-view");
  await expect(calc).toBeVisible();
  await assertNoHorizontalOverflow(page);

  // Step ① -> ② -> ③ visual Y-order: DeployVerdictStrip strictly above calc-advanced-controls
  const verdictStrip = calc.getByTestId("calc-verdict-strip");
  const advControls = calc.getByTestId("calc-advanced-controls");
  await expect(verdictStrip).toBeVisible();
  await expect(advControls).toBeVisible();
  const verdictBox = (await verdictStrip.boundingBox())!;
  const advBox = (await advControls.boundingBox())!;
  expect(verdictBox.y).toBeLessThan(advBox.y);

  // Mobile 375×812 zero horizontal overflow check
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Engineering drawer default-collapsed & toggleable
  const engDetails = calc.getByTestId("calc-engineering-details");
  await expect(engDetails).not.toHaveAttribute("open", "");
  await calc.getByTestId("calc-engineering-summary").click();
  await expect(engDetails).toHaveAttribute("open", "");
  await calc.getByTestId("calc-engineering-summary").click();
  await expect(engDetails).not.toHaveAttribute("open", "");

  // Qwen3-235B-A22B "一键应用推荐方案" -> TP=8, w8a8_dynamic URL + reload persistence + Doctor handoff
  const applyBtn = calc.getByTestId("calc-apply-recommended-plan");
  await expect(applyBtn).toBeVisible();
  await applyBtn.click();
  await expect(applyBtn).toHaveCount(0);
  await expect(page).toHaveURL(/preset=qwen3-235b-a22b/);
  await expect(page).toHaveURL(/tp=8/);
  await expect(page).toHaveURL(/precision=w8a8_dynamic/);

  await page.reload();
  await expect(calc.getByTestId("calc-apply-recommended-plan")).toHaveCount(0);
  await expect(calc.getByTestId("calc-handoff-cli")).toContainText("-tp 8");
  await page.screenshot({ path: join(EVIDENCE_DIR, "01-tools-qwen235-applied.png") });

  await calc.getByTestId("handoff-to-doctor").click();
  await expect(page).toHaveURL(/#\/tools\?.*tab=doctor/);
  const doctor = page.getByTestId("config-doctor-view");
  await expect(doctor).toBeVisible();
  await expect(doctor.getByTestId("doctor-cmd-input")).toHaveValue(/Qwen3-235B-A22B.*-tp 8/s);
  expect(errors).toEqual([]);
});

test("2. Wiki 代码块双动作按钮（送去体检 / 看 3D 切分）与 ConfigDoctor → 3D 单卡切分卡 → 原路返回恢复命令闭环", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/wiki/vllm-ascend-for-rl");
  await assertNoHorizontalOverflow(page);
  const sourceDetails = page.getByTestId("wiki-source-check");
  if ((await sourceDetails.getAttribute("open")) === null) {
    await sourceDetails.locator(":scope > summary").click();
  }

  const fenceWithServe = page
    .getByTestId("wiki-code-fence")
    .filter({ has: page.getByTestId("wiki-code-doctor-btn") })
    .first();
  await fenceWithServe.scrollIntoViewIfNeeded();
  await expect(fenceWithServe.getByTestId("wiki-code-doctor-btn")).toBeVisible();
  await expect(fenceWithServe.getByTestId("wiki-code-3d-btn")).toBeVisible();

  await fenceWithServe.getByTestId("wiki-code-doctor-btn").click();
  await expect(page).toHaveURL(/#\/tools\?tab=doctor&fromPage=vllm-ascend-for-rl/);
  const doctor = page.getByTestId("config-doctor-view");
  await expect(doctor.getByTestId("doctor-cmd-input")).toHaveValue(/vllm serve Qwen\/Qwen3-0\.6B/);

  // Enter custom multi-rank serve command -> open 3D sharding -> click Rank pill -> return to Doctor & verify command restored
  const customCmd = "vllm serve Qwen/Qwen3-8B -tp 2 --max-model-len 16384";
  await doctor.getByTestId("doctor-cmd-input").fill(customCmd);
  const open3dBtn = doctor.getByTestId("doctor-open-3d-sharding");
  await expect(open3dBtn).toBeVisible();
  await open3dBtn.click();

  await expect(page).toHaveURL(/#\/hardware\?.*deploy=.*fromTools=doctor/);
  const hwFrame = page.frameLocator("iframe");
  const rank1Pill = hwFrame.getByTestId("deploy-rank-pill-1");
  await expect(rank1Pill).toBeVisible({ timeout: 30_000 });
  await rank1Pill.click();
  await expect(hwFrame.locator("body")).toContainText("单卡权重与缓存切分卡");
  await page.screenshot({ path: join(EVIDENCE_DIR, "02-hardware-rank-shard-card.png") });

  const backToDoctor = page.getByTestId("experience-back-link");
  await expect(backToDoctor).toContainText("返回配置体检台");
  await backToDoctor.click();
  await expect(page).toHaveURL(/#\/tools\?tab=doctor/);
  await expect(page.getByTestId("config-doctor-view").getByTestId("doctor-cmd-input")).toHaveValue(customCmd);
  expect(errors).toEqual([]);
});

test("3. 三处新注册 2D 交互沙盒（roofline-matmul-intensity / gqa-fig-shared-kv-cost-split / rfork-troubleshooting）控件联动与原静态图切换（1440 & 375）", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);

  // (a) roofline-matmul-intensity on /#/wiki/roofline-and-metrics
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki/roofline-and-metrics");
  const rooflineBox = page.locator(
    '[data-testid="interactive-diagram-root"][data-diagram-id="roofline-matmul-intensity"]',
  );
  await rooflineBox.scrollIntoViewIfNeeded();
  await expect(rooflineBox).toHaveAttribute("data-mode", "sandbox");
  const roofBefore = await rooflineBox.getByTestId("diagram-step-readout").textContent();
  await rooflineBox.getByTestId("roofline-prec-W8A8").click();
  await expect(rooflineBox).toHaveAttribute("data-precision", "W8A8");
  expect(await rooflineBox.getByTestId("diagram-step-readout").textContent()).not.toBe(roofBefore);
  await rooflineBox.getByTestId("diagram-mode-svg").click();
  await expect(rooflineBox).toHaveAttribute("data-mode", "svg");
  await rooflineBox.getByTestId("diagram-mode-sandbox").click();
  await expect(rooflineBox).toHaveAttribute("data-mode", "sandbox");
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page);

  // (b) gqa-fig-shared-kv-cost-split on /#/wiki/gqa
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki/gqa");
  const gqaBox = page.locator(
    '[data-testid="interactive-diagram-root"][data-diagram-id="gqa-fig-shared-kv-cost-split"]',
  );
  await gqaBox.scrollIntoViewIfNeeded();
  await expect(gqaBox).toHaveAttribute("data-mode", "sandbox");
  await gqaBox.getByTestId("gqa-mode-mqa-32-1").click();
  await expect(gqaBox).toHaveAttribute("data-ratio-mode", "mqa-32-1");
  await gqaBox.getByTestId("diagram-mode-svg").click();
  await expect(gqaBox).toHaveAttribute("data-mode", "svg");
  await gqaBox.getByTestId("diagram-mode-sandbox").click();
  await expect(gqaBox).toHaveAttribute("data-mode", "sandbox");
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page);

  // (c) rfork-troubleshooting on /#/wiki/rfork-troubleshooting
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki/rfork-troubleshooting");
  const rforkBox = page.locator(
    '[data-testid="interactive-diagram-root"][data-diagram-id="rfork-troubleshooting"]',
  );
  await rforkBox.scrollIntoViewIfNeeded();
  await expect(rforkBox).toHaveAttribute("data-mode", "sandbox");
  await expect(rforkBox).toHaveAttribute("data-step", "1");
  await rforkBox.getByRole("button", { name: "下一类 ›" }).click();
  await expect(rforkBox).toHaveAttribute("data-step", "2");
  await rforkBox.getByTestId("diagram-mode-svg").click();
  await expect(rforkBox).toHaveAttribute("data-mode", "svg");
  await rforkBox.getByTestId("diagram-mode-sandbox").click();
  await expect(rforkBox).toHaveAttribute("data-mode", "sandbox");
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});

test("4. Ctrl+K QuickSearch：「HCCL 超时原理」保持知识页排第一；vllm serve 含 --api-key 展示体检/3D 双动作并彻底脱敏", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki");

  await page.keyboard.press("Control+KeyK");
  const dialog = page.getByTestId("wiki-quick-search-dialog");
  await expect(dialog).toBeVisible();
  const input = dialog.getByTestId("wiki-quick-search-input");

  // (a) "HCCL 超时原理" keeps Wiki hit #1 (cann-hccl)
  await input.fill("HCCL 超时原理");
  const items = dialog.getByTestId("wiki-quick-search-item");
  await expect(items.first()).toBeVisible();
  await expect(items.first()).toContainText(/CANN 与 HCCL|HCCL/);
  await expect(items.first().getByTestId("wiki-quick-search-action-badge")).toHaveCount(0);

  // (b) Literal vllm serve with secret key -> Doctor & 3D actions with redaction (zero raw secret leak)
  const rawSecretCmd = "vllm serve Qwen/Qwen3-8B -tp 2 --api-key sk-secret1234567890";
  await input.fill(rawSecretCmd);
  const actionBadges = dialog.getByTestId("wiki-quick-search-action-badge");
  await expect(actionBadges).toHaveCount(2);
  await expect(actionBadges.nth(0)).toHaveText("工具");
  await expect(actionBadges.nth(1)).toHaveText("3D");
  expect(await dialog.textContent()).not.toContain("sk-secret1234567890");

  // Press Enter on #1 Doctor action -> verify URL & ConfigDoctor command input are redacted
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/tools\?.*tab=doctor/);
  expect(page.url()).not.toContain("sk-secret1234567890");
  const doctorInputVal = await page
    .getByTestId("config-doctor-view")
    .getByTestId("doctor-cmd-input")
    .inputValue();
  expect(doctorInputVal).not.toContain("sk-secret1234567890");
  expect(doctorInputVal).toMatch(/--api-key \[REDACTED(?:_KEY)?\]/);

  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
