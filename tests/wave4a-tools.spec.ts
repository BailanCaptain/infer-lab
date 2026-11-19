import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR =
  "C:/Users/-/.gemini/antigravity/brain/a61d2784-a8f8-4e8c-a1e1-14b600b1d2b5/browser_evidence/wave4a";
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

async function assertSvgTextsInsideViewBox(page: Page, selector: string, label: string) {
  const result = await page.evaluate((sel) => {
    const svgs = Array.from(document.querySelectorAll<SVGSVGElement>(sel));
    if (svgs.length === 0) {
      return { svgCount: 0, textCount: 0, overflows: [`No SVG matched selector: ${sel}`] };
    }
    let textCount = 0;
    const overflows: string[] = [];
    for (const [idx, svg] of svgs.entries()) {
      const vbAttr = svg.getAttribute("viewBox") ?? "";
      const parts = vbAttr
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const [vx = 0, vy = 0, vw = 0, vh = 0] = parts;
      if (vw <= 0 || vh <= 0) {
        overflows.push(`SVG#${idx} missing valid viewBox: "${vbAttr}"`);
        continue;
      }
      const svgCtm = svg.getScreenCTM();
      const texts = Array.from(svg.querySelectorAll("text"));
      textCount += texts.length;
      for (const el of texts) {
        const textVal = (el.textContent ?? "").trim();
        if (!textVal) continue;
        const box = el.getBBox();
        if (box.width === 0 && box.height === 0) continue;
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
        if (minX < vx - 2 || minY < vy - 2 || maxX > vx + vw + 2 || maxY > vy + vh + 2) {
          overflows.push(
            `SVG#${idx} "${textVal}" bbox(${minX.toFixed(1)},${minY.toFixed(1)},${maxX.toFixed(1)},${maxY.toFixed(1)}) vs viewBox(${vx},${vy},${vw},${vh})`,
          );
        }
      }
    }
    return { svgCount: svgs.length, textCount, overflows };
  }, selector);

  expect(result.svgCount, `${label}: expected at least 1 SVG`).toBeGreaterThan(0);
  expect(result.textCount, `${label}: expected SVG <text> nodes`).toBeGreaterThan(0);
  expect(result.overflows, `${label}: SVG text overflow detected`).toEqual([]);
}

async function assertSvgTextsNoPairwiseCollision(
  page: Page,
  selector: string,
  label: string,
  opts?: { textStartsWith?: string },
) {
  const result = await page.evaluate(
    ({ sel, prefix }) => {
      const svgs = Array.from(document.querySelectorAll<SVGSVGElement>(sel));
      if (svgs.length === 0) {
        return { svgCount: 0, textCount: 0, collisions: [`No SVG matched selector: ${sel}`] };
      }
      let textCount = 0;
      const collisions: string[] = [];
      for (const [idx, svg] of svgs.entries()) {
        const items = Array.from(svg.querySelectorAll("text"))
          .map((el) => {
            const text = (el.textContent ?? "").trim();
            const rect = el.getBoundingClientRect();
            return { text, rect };
          })
          .filter(
            (item) =>
              item.text.length > 0 &&
              (!prefix || item.text.startsWith(prefix)) &&
              item.rect.width > 0.5 &&
              item.rect.height > 0.5,
          );
        textCount += items.length;

        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i]!;
            const b = items[j]!;
            const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
            const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
            if (overlapX > 1.5 && overlapY > 1.5) {
              collisions.push(
                `SVG#${idx} "${a.text}" overlaps "${b.text}" (${overlapX.toFixed(1)}×${overlapY.toFixed(1)}px)`,
              );
            }
          }
        }
      }
      return { svgCount: svgs.length, textCount, collisions };
    },
    { sel: selector, prefix: opts?.textStartsWith ?? "" },
  );

  expect(result.svgCount, `${label}: expected at least 1 SVG`).toBeGreaterThan(0);
  expect(result.textCount, `${label}: expected matching SVG <text> nodes`).toBeGreaterThan(0);
  expect(result.collisions, `${label}: SVG <text> pairwise collision detected`).toEqual([]);
}

test("1. /#/wiki 主目录首屏四宫格工作台入口（1440×900 与 359×844 零横向溢出）", async ({ page }) => {
  const errors = attachErrorCollector(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki");
  await expect(page.getByTestId("wiki-landing-tools")).toBeVisible();
  await expect(page.getByTestId("landing-tool-calculator")).toBeVisible();
  await expect(page.getByTestId("landing-tool-doctor")).toBeVisible();
  await expect(page.getByTestId("landing-tool-troubleshoot")).toBeVisible();
  await expect(page.getByTestId("landing-tool-aicore")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(EVIDENCE_DIR, "01-wiki-hub-four-labs.png") });

  await page.setViewportSize({ width: 359, height: 844 });
  await expect(page.getByTestId("wiki-landing-tools")).toBeVisible();
  await expect(page.getByTestId("landing-tool-troubleshoot")).toBeVisible();
  await expect(page.getByTestId("landing-tool-aicore")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("2. /#/wiki/ai-core 内嵌 aicore-lab (mode: single) 真实交互与 SVG 零越界", async ({ page }) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/wiki/ai-core");
  const wrapper = page.getByTestId("wiki-tool-aicore-lab");
  await expect(wrapper).toBeVisible();
  await expect(wrapper).not.toHaveClass(/wiki-tool-placeholder/);

  const lab = wrapper.getByTestId("aicore-lab-view");
  await expect(lab).toHaveAttribute("data-mode", "single");
  await expect(lab.getByTestId("aicore-schematic-badge")).toContainText("示意相对时序 · 非 msprof 实测周期");

  await lab.scrollIntoViewIfNeeded();
  await assertSvgTextsInsideViewBox(page, '[data-testid="aicore-lab-view"] svg', "ai-core embedded lab");

  const aiBefore = await lab.getByTestId("aicore-ai-readout").textContent();
  await lab.getByTestId("aicore-toggle-db").click();
  await expect(lab.getByTestId("aicore-toggle-db")).toHaveAttribute("aria-pressed", "true");
  expect(await lab.getByTestId("aicore-ai-readout").textContent()).toBe(aiBefore);

  await lab.getByTestId("aicore-toggle-fuse").click();
  await expect(lab.getByTestId("aicore-toggle-fuse")).toHaveAttribute("aria-pressed", "true");
  expect(await lab.getByTestId("aicore-ai-readout").textContent()).not.toBe(aiBefore);
  await expect(lab.getByTestId("aicore-gm-status")).toContainText("省");

  await page.screenshot({ path: join(EVIDENCE_DIR, "02-embed-ai-core-lab.png") });
  expect(errors).toEqual([]);
});

test("3. /#/wiki/inference-troubleshooting 新增两张矢量图与内嵌 troubleshoot-workbench 交互", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/wiki/inference-troubleshooting");

  for (const diagramId of ["troubleshooting-fig-first-fault", "troubleshooting-fig-myths"]) {
    const fig = page.locator(`figure.wiki-diagram[data-diagram="${diagramId}"]`);
    await expect(fig).toBeVisible();
    await fig.scrollIntoViewIfNeeded();
    await assertSvgTextsInsideViewBox(
      page,
      `figure.wiki-diagram[data-diagram="${diagramId}"] svg`,
      `diagram ${diagramId}`,
    );
  }

  const embeddedTool = page.getByTestId("wiki-tool-troubleshoot-workbench");
  await expect(embeddedTool).toBeVisible();
  await expect(embeddedTool).not.toHaveClass(/wiki-tool-placeholder/);
  await embeddedTool.scrollIntoViewIfNeeded();

  const view = embeddedTool.getByTestId("troubleshoot-workbench-view");
  await expect(view).toHaveAttribute("data-mode", "full");
  await view.getByTestId("troubleshoot-tab-timeline").click();
  await expect(view.getByTestId("schematic-trace-badge")).toContainText("示意相对时序 · 非真机实测 Trace");
  await view.getByTestId("troubleshoot-tab-logs").click();
  await expect(view.getByTestId("troubleshoot-panel-a")).toBeVisible();

  await page.screenshot({ path: join(EVIDENCE_DIR, "03-embed-troubleshooting.png") });
  expect(errors).toEqual([]);
});

test("4. /#/tools?tab=troubleshoot Panel A 首错判定 + /metrics + 问答联动，与 Panel B 相对时序沙箱", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/tools?tab=troubleshoot");
  const view = page.getByTestId("troubleshoot-workbench-view");
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute("data-mode", "full");

  // Panel A: multi-rank EI0006 + Rank 3 OOM/EZ9999 -> locks onto Rank 3 (high confidence) and marks Rank 0/1/2 cascade.
  await view.getByTestId("troubleshoot-fixture-multi-rank-hccl-rank3-fault").click();
  const verdict = view.getByTestId("first-fault-verdict");
  await expect(verdict).toBeVisible();
  await expect(verdict).toContainText("Rank 3");
  await expect(verdict).toContainText("置信度: 高");
  await expect(verdict).toContainText(/Rank\s*0|0、1、2|0,\s*1,\s*2/);

  // Switch to /metrics KV preemption storm preset -> verify metrics snapshot cards parse.
  await view.getByTestId("troubleshoot-fixture-metrics-kv-preemption").click();
  await expect(view.getByTestId("troubleshoot-metrics-snapshot")).toBeVisible();
  await expect(view.getByTestId("troubleshoot-finding-metrics-kv-preemption-storm")).toBeVisible();

  // Re-select Rank 3 multi-rank fault & hand off to ChatDrawer.
  await view.getByTestId("troubleshoot-fixture-multi-rank-hccl-rank3-fault").click();
  await view.getByTestId("troubleshoot-ask-assistant").click();
  await expect(page.getByTestId("chat-drawer")).toBeVisible();
  const drafted = await page.getByTestId("chat-input").inputValue();
  expect(drafted).toContain("Rank 3");
  await page.screenshot({ path: join(EVIDENCE_DIR, "04-workbench-troubleshoot-logs.png") });

  // Close drawer if close button exists, then switch to Panel B schematic relative timeline sandbox.
  const closeBtn = page.getByTestId("chat-close");
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
  await view.getByTestId("troubleshoot-tab-timeline").click();
  await expect(view.getByTestId("troubleshoot-panel-b")).toBeVisible();
  await expect(view.getByTestId("schematic-trace-badge")).toContainText("示意相对时序 · 非真机实测 Trace");

  // Check Panel B SVG bounds + pairwise zero-collision across all 6 scenarios (default & fixed).
  const panelBScenarios = [
    "proxy-buffering",
    "host-dispatch-bubble",
    "rank-straggler-hccl",
    "unbounded-prefill-head-of-line",
    "kv-preemption-storm",
    "moe-ep-straggler-dummy",
  ] as const;
  const cfToggle = view.getByTestId("counterfactual-toggle");
  for (const scenarioId of panelBScenarios) {
    await view.getByTestId(`timeline-scenario-${scenarioId}`).click();
    if (await cfToggle.isChecked()) await cfToggle.uncheck();
    await assertSvgTextsInsideViewBox(
      page,
      '[data-testid="schematic-swimlane-svg"] svg',
      `Panel B ${scenarioId} fault`,
    );
    await assertSvgTextsNoPairwiseCollision(
      page,
      '[data-testid="schematic-swimlane-svg"] svg',
      `Panel B ${scenarioId} fault markers`,
      { textStartsWith: "▲" },
    );
    await cfToggle.check();
    await assertSvgTextsInsideViewBox(
      page,
      '[data-testid="schematic-swimlane-svg"] svg',
      `Panel B ${scenarioId} fixed`,
    );
    await assertSvgTextsNoPairwiseCollision(
      page,
      '[data-testid="schematic-swimlane-svg"] svg',
      `Panel B ${scenarioId} fixed markers`,
      { textStartsWith: "▲" },
    );
  }

  // Showcase rank-straggler-hccl counterfactual switch and scroll swimlane + bottom markers into view.
  await view.getByTestId("timeline-scenario-rank-straggler-hccl").click();
  if (await cfToggle.isChecked()) await cfToggle.uncheck();
  const beforeSvgText = await view.getByTestId("schematic-swimlane-svg").textContent();
  await cfToggle.check();
  await expect(cfToggle).toBeChecked();
  const afterSvgText = await view.getByTestId("schematic-swimlane-svg").textContent();
  expect(afterSvgText).not.toBe(beforeSvgText);

  await view.getByTestId("schematic-swimlane-svg").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(EVIDENCE_DIR, "05-workbench-troubleshoot-timeline.png") });
  expect(errors).toEqual([]);
});

test("5. /#/tools?tab=aicore 910B vs 950、Roofline 纵抬/右移、离群量化与 6 步缓冲检查器", async ({
  page,
}) => {
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/tools?tab=aicore");
  const lab = page.getByTestId("aicore-lab-view");
  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute("data-mode", "full");
  await expect(lab.getByTestId("aicore-schematic-badge")).toContainText("示意相对时序 · 非 msprof 实测周期");

  const readDot = async () => {
    const dot = lab.getByTestId("aicore-roofline-dot");
    const cx = Number(await dot.getAttribute("cx"));
    const cy = Number(await dot.getAttribute("cy"));
    return { cx, cy };
  };

  // Baseline: 910B, db=off, fuse=off
  const baseDot = await readDot();

  // Ping-Pong ON -> STRICTLY vertical upward lift (same cx, smaller cy).
  await lab.getByTestId("aicore-toggle-db").click();
  const dbDot = await readDot();
  expect(dbDot.cx).toBe(baseDot.cx);
  expect(dbDot.cy).toBeLessThan(baseDot.cy);

  // AddRMSNorm Fusion ON -> shifts cx strictly rightward.
  await lab.getByTestId("aicore-toggle-fuse").click();
  const fusedDot = await readDot();
  expect(fusedDot.cx).toBeGreaterThan(baseDot.cx);

  // Switch to Ascend 950 (L0C→UB direct) -> shifts cx further rightward.
  await lab.getByTestId("aicore-arch-select").selectOption("950");
  await expect(lab.getByTestId("aicore-arch-note")).toContainText("950");
  await expect(lab.getByTestId("aicore-arch-note")).toContainText("L0C → UB");
  const dot950 = await readDot();
  expect(dot950.cx).toBeGreaterThan(fusedDot.cx);

  // Outlier slider = 20 -> compare MXFP8 vs W8A8_DYNAMIC Group 0 error.
  await lab.getByTestId("aicore-outlier-slider").fill("20");
  const parseErrPct = async () => {
    const txt = (await lab.getByTestId("aicore-quant-error-badge").textContent()) ?? "";
    const m = /([\d.]+)%/.exec(txt);
    return Number(m?.[1] ?? Number.NaN);
  };
  await lab.getByTestId("aicore-quant-select").selectOption("mxfp8");
  const mxErr = await parseErrPct();
  await lab.getByTestId("aicore-quant-select").selectOption("w8a8_dynamic");
  const dynErr = await parseErrPct();
  expect(mxErr).toBeLessThan(4);
  expect(dynErr).toBeGreaterThan(mxErr);

  // 6-step on-chip buffer residency inspector interaction.
  const inspector = lab.getByTestId("aicore-buffer-inspector");
  await expect(inspector).toBeVisible();
  for (const stepNum of [1, 2, 3, 4, 5, 6]) {
    await lab.getByTestId(`aicore-step-btn-${stepNum}`).click();
    await expect(lab.getByTestId(`aicore-step-btn-${stepNum}`)).toHaveClass(/is-active/);
  }
  await lab.getByTestId("aicore-step-btn-4").click();
  await expect(inspector).toContainText("L0C → UB");

  // Verify zero SVG text viewBox overflow AND zero pairwise text collision in full mode (950 + 910B).
  await assertSvgTextsInsideViewBox(page, '[data-testid="aicore-lab-view"] svg', "aicore full mode 950");
  await assertSvgTextsNoPairwiseCollision(
    page,
    '[data-testid="aicore-buffer-topology-svg"]',
    "aicore buffer topology 950",
  );
  await assertSvgTextsNoPairwiseCollision(page, '[data-testid="aicore-swimlane-svg"]', "aicore swimlane 950");

  await page.screenshot({ path: join(EVIDENCE_DIR, "06-workbench-aicore-full.png"), fullPage: true });

  await lab.getByTestId("aicore-arch-select").selectOption("910b");
  await assertSvgTextsNoPairwiseCollision(
    page,
    '[data-testid="aicore-buffer-topology-svg"]',
    "aicore buffer topology 910b",
  );
  expect(errors).toEqual([]);
});
