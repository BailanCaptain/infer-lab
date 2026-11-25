import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR = join(process.cwd(), "test-results", "evidence", "wave3");
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

async function assertRooflineSvgTextsInsideViewBox(page: Page) {
  const result = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg[aria-label*="Roofline"]');
    if (!svg) return { found: false, count: 0, overflows: ["Roofline SVG not found"] };
    const vbAttr = svg.getAttribute("viewBox") ?? "";
    const parts = vbAttr.trim().split(/\s+/).map(Number);
    const [vx = 0, vy = 0, vw = 0, vh = 0] = parts;
    const svgCtm = svg.getScreenCTM();
    const texts = Array.from(svg.querySelectorAll("text"));
    const overflows: string[] = [];
    for (const el of texts) {
      const box = el.getBBox();
      const elCtm = el.getScreenCTM();
      let minX = box.x;
      let minY = box.y;
      let maxX = box.x + box.width;
      let maxY = box.y + box.height;
      if (svgCtm && elCtm) {
        const rel = svgCtm.inverse().multiply(elCtm);
        const corners = [
          new DOMPoint(box.x, box.y).matrixTransform(rel),
          new DOMPoint(box.x + box.width, box.y).matrixTransform(rel),
          new DOMPoint(box.x, box.y + box.height).matrixTransform(rel),
          new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(rel),
        ];
        minX = Math.min(...corners.map((p) => p.x));
        minY = Math.min(...corners.map((p) => p.y));
        maxX = Math.max(...corners.map((p) => p.x));
        maxY = Math.max(...corners.map((p) => p.y));
      }
      const label = (el.textContent ?? "").trim();
      if (minX < vx - 1 || minY < vy - 1 || maxX > vx + vw + 1 || maxY > vy + vh + 1) {
        overflows.push(
          `"${label}" bbox(${minX.toFixed(1)},${minY.toFixed(1)},${maxX.toFixed(1)},${maxY.toFixed(1)}) vs viewBox(${vx},${vy},${vw},${vh})`,
        );
      }
    }
    return { found: true, count: texts.length, overflows };
  });
  expect(result.found).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.overflows).toEqual([]);
}

test("1. /#/wiki 主目录工作台双入口卡与 1440/359 零横向溢出", async ({ page }) => {
  const errors = attachErrorCollector(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki");
  await expect(page.getByTestId("wiki-landing-tools")).toBeVisible();
  await expect(page.getByTestId("landing-tool-calculator")).toBeVisible();
  await expect(page.getByTestId("landing-tool-doctor")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(EVIDENCE_DIR, "01-wiki-hub.png") });

  await page.setViewportSize({ width: 359, height: 844 });
  await expect(page.getByTestId("wiki-landing-tools")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("2. 站内 4 处内嵌 wiki-tool 围栏真实交互与零知识倒挂", async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  // (a) hf-model-anatomy: deploy-calculator quick-screen
  await page.goto("/#/wiki/hf-model-anatomy");
  const calcQuick = page.getByTestId("deploy-calculator-view");
  await expect(calcQuick).toBeVisible();
  await expect(calcQuick).toHaveAttribute("data-mode", "quick-screen");
  await expect(calcQuick.getByRole("button", { name: "Qwen3-8B" })).toHaveClass(/is-active/);

  await calcQuick.getByRole("button", { name: "Qwen3-30B-A3B" }).click();
  await calcQuick.getByLabel("昇腾硬件卡型").selectOption("310p-24g");
  await expect(calcQuick).toContainText(/BF16|float16|310P/i);
  await calcQuick.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(EVIDENCE_DIR, "02-embed-hf-quick-screen.png") });

  // (b) roofline-and-metrics: deploy-calculator minimal
  await page.goto("/#/wiki/roofline-and-metrics");
  const calcMinimal = page.getByTestId("deploy-calculator-view");
  await expect(calcMinimal).toBeVisible();
  await expect(calcMinimal).toHaveAttribute("data-mode", "minimal");
  await assertRooflineSvgTextsInsideViewBox(page);

  await calcMinimal.getByRole("button", { name: "Qwen3-30B-A3B" }).click();
  await expect(calcMinimal).toContainText(/M_eff|路由稀释/);
  await assertRooflineSvgTextsInsideViewBox(page);
  await calcMinimal.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(EVIDENCE_DIR, "03-embed-roofline-minimal.png") });

  // (c) ascend-env-and-serve: config-doctor minimal (zero DAG inversion)
  await page.goto("/#/wiki/ascend-env-and-serve");
  const doctorMin = page.getByTestId("config-doctor-view");
  await expect(doctorMin).toBeVisible();
  await expect(doctorMin).toHaveAttribute("data-mode", "minimal");

  await doctorMin.getByTestId("doctor-preset-minimal-pitfall-310p-dtype-tp-retired-env").click();
  await expect(doctorMin).toContainText("float16");
  await expect(doctorMin).toContainText("ASCEND_RT_VISIBLE_DEVICES");
  await expect(doctorMin).toContainText("VLLM_ASCEND_ENABLE_NZ");

  const cmdInput = doctorMin.getByTestId("doctor-cmd-input");
  const baseCmd = await cmdInput.inputValue();
  await cmdInput.fill(
    `${baseCmd} \\\n    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}'`,
  );
  await expect(doctorMin.getByTestId("doctor-deferred-notice")).toBeVisible();
  await expect(doctorMin.getByTestId("doctor-deferred-notice")).toContainText("完整配置体检台");
  // Zero Chapter 5 P/D rule leakage in minimal mode
  await expect(doctorMin.locator('[data-testid^="doctor-finding-d4-"]')).toHaveCount(0);
  await expect(doctorMin.locator('[data-testid^="doctor-finding-pd-"]')).toHaveCount(0);
  await doctorMin.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(EVIDENCE_DIR, "04-embed-serve-doctor-minimal.png") });

  // (d) core-cli-params: config-doctor full
  await page.goto("/#/wiki/core-cli-params");
  const doctorFull = page.getByTestId("config-doctor-view");
  await expect(doctorFull).toBeVisible();
  await expect(doctorFull).toHaveAttribute("data-mode", "full");
  await expect(doctorFull.getByTestId("doctor-topology-single")).toBeVisible();
  await expect(doctorFull.getByTestId("doctor-topology-pd")).toBeVisible();
  await doctorFull.getByTestId("doctor-topology-pd").click();
  await expect(doctorFull.getByTestId("doctor-prefill-input")).toBeVisible();
  await expect(doctorFull.getByTestId("doctor-decode-input")).toBeVisible();

  expect(errors).toEqual([]);
});

test("3. /#/tools?tab=calculator Mode A、Wave-4 异构架构解锁（MLA/KDA/CSA2/Engram）与 Mode B 日志对账", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/tools?tab=calculator");

  const workbench = page.getByTestId("tools-workbench");
  const calc = page.getByTestId("deploy-calculator-view");
  await expect(workbench).toBeVisible();
  await expect(calc).toBeVisible();
  await expect(calc.getByTestId("calc-submode-static")).toHaveAttribute("aria-selected", "true");

  // Mode A: Qwen3-30B-A3B + w8a8_dynamic + TP=4 + EP
  await calc.getByRole("button", { name: "Qwen3-30B-A3B" }).click();
  await calc.getByLabel("权重精度").selectOption("w8a8_dynamic");
  const advDetails = calc.getByTestId("calc-advanced-controls");
  if ((await advDetails.getAttribute("open")) === null) {
    await advDetails.locator("summary").click();
  }
  const epCheckbox = calc.getByLabel("开启专家并行 EP");
  if (!(await epCheckbox.isChecked())) {
    await epCheckbox.check();
  }

  // Decluttered engineering drawer defaults to collapsed; expand to inspect 7 stages, HCCL box & Roofline
  const engDetails = calc.getByTestId("calc-engineering-details");
  await expect(engDetails).not.toHaveAttribute("open", "");
  await calc.getByTestId("calc-engineering-summary").click();
  await expect(engDetails).toHaveAttribute("open", "");

  // Stage 3 ~ 7.40 GiB & Stage 5 HCCL non-double-count
  await expect(calc.locator(".wt-calc-stages")).toContainText(/7\.\d{2}\s*GiB/);
  await expect(calc.locator(".wt-calc-hccl-box")).toContainText("严禁在 profile_run 峰值之上二次重扣 HCCL");
  await assertRooflineSvgTextsInsideViewBox(page);

  // Wave-4C-1 verified deep-links: both hccl-buffer and kv-cache-memory-profiling are now v0.30.0 verified
  const hcclLink = calc.getByTestId("tool-deeplink-hccl-buffer").first();
  await expect(hcclLink).toBeVisible();
  await expect(hcclLink).toHaveAttribute("data-legacy-baseline", "false");
  await expect(hcclLink.getByTestId("legacy-baseline-badge")).toHaveCount(0);

  const kvProfLink = calc.getByTestId("tool-deeplink-kv-cache-memory-profiling").first();
  await expect(kvProfLink).toBeVisible();
  await expect(kvProfLink).toHaveAttribute("data-legacy-baseline", "false");
  await expect(kvProfLink.getByTestId("legacy-baseline-badge")).toHaveCount(0);

  await page.screenshot({ path: join(EVIDENCE_DIR, "05-workbench-calc-mode-a.png"), fullPage: true });

  // Wave-4 MLA unlocked preset demo
  await calc.getByTestId("wave4-demo-deepseek-v3-mla").click();
  const wave4Banner = calc.getByTestId("wave4-arch-active");
  await expect(wave4Banner).toBeVisible();
  await expect(wave4Banner).toContainText("异构架构专属账本已激活");
  await expect(wave4Banner).toContainText("MLA");
  await expect(wave4Banner).toContainText("1152 B/tok/层");
  await expect(calc.getByTestId("wave3-arch-intercept")).toHaveCount(0);
  const mlaLink = wave4Banner.getByTestId("tool-deeplink-mla");
  await expect(mlaLink).toBeVisible();
  await expect(mlaLink).toHaveAttribute("data-legacy-baseline", "false");
  await expect(mlaLink.getByTestId("legacy-baseline-badge")).toHaveCount(0);
  await assertRooflineSvgTextsInsideViewBox(page);
  await page.screenshot({ path: join(EVIDENCE_DIR, "06-workbench-calc-wave4-mla-unlocked.png") });

  // Wave-4 Hybrid KDA + GQA preset demo
  await calc.getByTestId("wave4-demo-hybrid-kda-gqa").click();
  await expect(wave4Banner).toBeVisible();
  await expect(wave4Banner).toContainText("KDA");
  await expect(wave4Banner).toContainText("MiB/seq");
  const kdaLink = wave4Banner.getByTestId("tool-deeplink-linear-attention");
  await expect(kdaLink).toBeVisible();
  await expect(kdaLink).toHaveAttribute("data-legacy-baseline", "false");
  await assertRooflineSvgTextsInsideViewBox(page);

  // Wave-4 Engram preset demo
  await calc.getByTestId("wave4-demo-engram-conditional").click();
  await expect(wave4Banner).toBeVisible();
  await expect(wave4Banner).toContainText("Engram");
  const engramLink = wave4Banner.getByTestId("tool-deeplink-engram-conditional-memory");
  await expect(engramLink).toBeVisible();
  await expect(engramLink).toHaveAttribute("data-legacy-baseline", "false");
  await assertRooflineSvgTextsInsideViewBox(page);

  // Reset back to standard model, switch to Mode B reconcile
  await calc.getByRole("button", { name: "恢复内置预设" }).click();
  await calc.getByTestId("calc-submode-reconcile").click();
  await expect(calc.getByTestId("calc-submode-reconcile")).toHaveAttribute("aria-selected", "true");

  // Click first sample reference log template
  await calc.locator(".wt-calc-reconcile .wt-presets .wt-preset-btn").first().click();
  await expect(calc.getByTestId("hccl-no-double-count-guard")).toBeVisible();
  await expect(calc.getByTestId("hccl-no-double-count-guard")).toContainText("hcclDoubleCounted: false");
  await expect(calc.locator(".wt-calc-reconcile tbody tr")).toHaveCount(6);

  // Mutate Available KV cache memory to 12.00 GiB and assert live drift detection
  const logInput = calc.getByTestId("calc-log-input");
  const origLog = await logInput.inputValue();
  const mutatedLog = origLog.replace(
    /Available KV cache memory:\s*[\d.]+\s*GiB/i,
    "Available KV cache memory: 12.00 GiB",
  );
  expect(mutatedLog).not.toBe(origLog);
  await logInput.fill(mutatedLog);
  await expect(calc.locator(".wt-calc-reconcile")).toContainText(/偏低|偏高|超限|偏差/);
  await page.screenshot({ path: join(EVIDENCE_DIR, "07-workbench-calc-mode-b.png"), fullPage: true });

  expect(errors).toEqual([]);
});

test("4. /#/tools?tab=doctor P/D 双实例联检、健康基线与问答助手深究联动", async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/tools?tab=doctor");

  const doctor = page.getByTestId("config-doctor-view");
  await expect(doctor).toBeVisible();
  await expect(doctor).toHaveAttribute("data-mode", "full");

  // Secondary options drawer defaults to collapsed and toggles cleanly
  const secOptions = doctor.getByTestId("doctor-secondary-options");
  await expect(secOptions).not.toHaveAttribute("open", "");
  await doctor.getByTestId("doctor-secondary-summary").click();
  await expect(secOptions).toHaveAttribute("open", "");
  await doctor.getByTestId("doctor-secondary-summary").click();

  // Switch to P/D dual-instance mode and select pitfall preset
  await doctor.getByTestId("doctor-topology-pd").click();
  await doctor.getByTestId("doctor-preset-pd-pitfall-mooncake-tp-pp-recompute").click();

  await expect(doctor.getByTestId("doctor-blocked-banner")).toBeVisible();
  await expect(doctor.getByTestId("doctor-finding-d4-mooncake-tp-p-divisible-tp-d")).toBeVisible();
  await expect(doctor.getByTestId("doctor-finding-d4-mooncake-decode-pp-eq-1")).toBeVisible();
  await expect(doctor.getByTestId("doctor-finding-d4-recompute-scheduler-p-node-disable")).toBeVisible();

  // Wave-4C-1 verified deep-links on pd-disaggregation & mooncake-connector
  const pdLink = doctor.getByTestId("tool-deeplink-pd-disaggregation").first();
  await expect(pdLink).toBeVisible();
  await expect(pdLink).toHaveAttribute("data-legacy-baseline", "false");
  await expect(pdLink.getByTestId("legacy-baseline-badge")).toHaveCount(0);

  const mooncakeLink = doctor.getByTestId("tool-deeplink-mooncake-connector").first();
  await expect(mooncakeLink).toBeVisible();
  await expect(mooncakeLink).toHaveAttribute("data-legacy-baseline", "false");
  await expect(mooncakeLink.getByTestId("legacy-baseline-badge")).toHaveCount(0);

  await page.screenshot({ path: join(EVIDENCE_DIR, "08-workbench-doctor-pd.png"), fullPage: true });

  // Switch to healthy P/D preset -> 0 blockers
  await doctor.getByTestId("doctor-preset-pd-healthy-mooncake-tp4-to-tp2-pp1").click();
  await expect(doctor.getByTestId("doctor-pass-banner")).toBeVisible();
  await expect(doctor.getByTestId("doctor-blocked-banner")).toHaveCount(0);

  // One-click handoff to persistent Wiki assistant drawer
  await doctor.getByTestId("doctor-ask-assistant").click();
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
  const chatInput = page.getByTestId("chat-input");
  await expect(chatInput).toBeVisible();
  const drafted = await chatInput.inputValue();
  expect(drafted).toContain("MooncakeConnectorV1");
  expect(drafted).toContain("vllm serve");
  await page.screenshot({ path: join(EVIDENCE_DIR, "09-workbench-doctor-chat-handoff.png") });

  expect(errors).toEqual([]);
});
