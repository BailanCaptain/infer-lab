import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

test.use({ trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });

const EVIDENCE_DIR = join(process.cwd(), "test-results", "evidence", "final_closure");
const RUNTIME_STAGE_DIR = join(process.cwd(), "tools", "wiki-runtime", "final-closure-2026-11-19");
mkdirSync(EVIDENCE_DIR, { recursive: true });
mkdirSync(RUNTIME_STAGE_DIR, { recursive: true });

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

async function scrubScene(figure: Locator, seconds: number) {
  await figure.getByRole("slider").evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, seconds);
}

async function assertCutawayPlateLoaded(page: Page, diagramId: string) {
  const figure = page.locator(`figure.wiki-diagram[data-diagram="${diagramId}"]`);
  await expect(figure, `${diagramId} figure visible`).toBeVisible();
  await expect(figure, `${diagramId} status ok`).toHaveAttribute("data-status", "ok");
  await figure.scrollIntoViewIfNeeded();

  const metrics = await figure.evaluate(async (el) => {
    const img = el.querySelector("svg image");
    if (!img) return { found: false as const };
    const href = img.getAttribute("href") ?? img.getAttribute("xlink:href") ?? "";
    const rect = img.getBoundingClientRect();
    const resolvedUrl = new URL(href, document.baseURI).href;
    const decoded = await new Promise<{ ok: boolean; naturalWidth: number; naturalHeight: number }>(
      (resolve) => {
        const probe = new Image();
        probe.onload = () =>
          resolve({ ok: true, naturalWidth: probe.naturalWidth, naturalHeight: probe.naturalHeight });
        probe.onerror = () => resolve({ ok: false, naturalWidth: 0, naturalHeight: 0 });
        probe.src = resolvedUrl;
      },
    );
    return {
      found: true as const,
      href,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      ...decoded,
    };
  });

  expect(metrics.found, `${diagramId}: expected <svg><image>`).toBe(true);
  if (!metrics.found) return figure;
  expect(metrics.href, `${diagramId}: expected .webp href`).toMatch(/\.webp$/);
  expect(metrics.ok, `${diagramId}: failed to decode ${metrics.href}`).toBe(true);
  expect(metrics.naturalWidth, `${diagramId}: naturalWidth > 500`).toBeGreaterThan(500);
  expect(metrics.naturalHeight, `${diagramId}: naturalHeight > 100`).toBeGreaterThan(100);
  expect(metrics.renderedWidth, `${diagramId}: rendered bbox width > 500`).toBeGreaterThan(500);
  expect(metrics.renderedHeight, `${diagramId}: rendered bbox height > 100`).toBeGreaterThan(100);
  return figure;
}

async function assertDiagramSvgsClean(page: Page, pageId: string) {
  const report = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll<SVGSVGElement>(".wiki-diagram svg"));
    const overflows: string[] = [];
    const collisions: string[] = [];
    let textCount = 0;

    for (const [idx, svg] of svgs.entries()) {
      const figure = svg.closest("figure.wiki-diagram");
      const diagramId = figure?.getAttribute("data-diagram") ?? `svg#${idx}`;
      const vbAttr = svg.getAttribute("viewBox") ?? "";
      const [vx = 0, vy = 0, vw = 0, vh = 0] = vbAttr
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (vw <= 0 || vh <= 0) {
        overflows.push(`${diagramId}: missing valid viewBox "${vbAttr}"`);
        continue;
      }

      const svgRect = svg.getBoundingClientRect();
      const canvasEl = svg.closest(".wiki-diagram-canvas") ?? figure;
      const canvasRect = canvasEl?.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) {
        overflows.push(`${diagramId}: zero SVG bounding rect`);
      }
      if (canvasRect && svgRect.right > canvasRect.right + 4) {
        overflows.push(
          `${diagramId}: SVG right (${svgRect.right.toFixed(1)}) overflows container (${canvasRect.right.toFixed(1)})`,
        );
      }

      const svgCtm = svg.getScreenCTM();
      const rects = Array.from(svg.querySelectorAll("rect"))
        .map((r) => ({
          rx: Number(r.getAttribute("x") ?? "0"),
          ry: Number(r.getAttribute("y") ?? "0"),
          rw: Number(r.getAttribute("width") ?? "0"),
          rh: Number(r.getAttribute("height") ?? "0"),
          fill: (r.getAttribute("fill") ?? "").trim().toLowerCase(),
        }))
        .filter((r) => r.fill !== "none" && r.rw >= 80 && r.rh >= 28 && r.rw < vw - 4);

      const texts = Array.from(svg.querySelectorAll("text"));
      const boxes: { text: string; left: number; top: number; right: number; bottom: number }[] = [];
      for (const el of texts) {
        const val = (el.textContent ?? "").trim();
        if (!val) continue;
        textCount += 1;
        const b = el.getBBox();
        if (b.width === 0 && b.height === 0) continue;
        const elCtm = el.getScreenCTM();
        let minX = b.x;
        let minY = b.y;
        let maxX = b.x + b.width;
        let maxY = b.y + b.height;
        if (svgCtm && elCtm) {
          const rel = svgCtm.inverse().multiply(elCtm);
          const corners = [
            new DOMPoint(b.x, b.y).matrixTransform(rel),
            new DOMPoint(b.x + b.width, b.y).matrixTransform(rel),
            new DOMPoint(b.x, b.y + b.height).matrixTransform(rel),
            new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(rel),
          ];
          minX = Math.min(...corners.map((p) => p.x));
          minY = Math.min(...corners.map((p) => p.y));
          maxX = Math.max(...corners.map((p) => p.x));
          maxY = Math.max(...corners.map((p) => p.y));
        }
        if (minX < vx - 3 || minY < vy - 3 || maxX > vx + vw + 3 || maxY > vy + vh + 3) {
          overflows.push(
            `${diagramId} "${val}" bbox(${minX.toFixed(1)},${minY.toFixed(1)},${maxX.toFixed(1)},${maxY.toFixed(1)}) vs viewBox(${vx},${vy},${vw},${vh})`,
          );
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const host = rects
          .filter((rc) => cx >= rc.rx && cx <= rc.rx + rc.rw && cy >= rc.ry && cy <= rc.ry + rc.rh)
          .sort((a, b2) => a.rw * a.rh - b2.rw * b2.rh)[0];
        if (host && (minX < host.rx - 3 || maxX > host.rx + host.rw + 3)) {
          overflows.push(
            `${diagramId} "${val}" x[${minX.toFixed(1)}..${maxX.toFixed(1)}] overflows host rect x[${host.rx}..${host.rx + host.rw}]`,
          );
        }
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) {
          boxes.push({
            text: val,
            left: r.left + 1.5,
            top: r.top + 1.5,
            right: r.right - 1.5,
            bottom: r.bottom - 1.5,
          });
        }
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 3 && oy > 3) {
            collisions.push(
              `${diagramId}: "${a.text}" <-> "${b.text}" (${ox.toFixed(1)}x${oy.toFixed(1)}px)`,
            );
          }
        }
      }
    }

    return {
      svgCount: svgs.length,
      textCount,
      overflows,
      collisions,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(report.svgCount, `${pageId}: expected >= 1 SVG diagram`).toBeGreaterThan(0);
  expect(report.textCount, `${pageId}: expected SVG text labels`).toBeGreaterThan(0);
  expect(report.pageOverflow, `${pageId}: 1440px horizontal page overflow`).toBe(false);
  expect(report.overflows, `${pageId}: SVG overflows`).toEqual([]);
  expect(report.collisions, `${pageId}: SVG text collisions`).toEqual([]);
}

async function expandAndVerifySourceMatrix(page: Page, pageId: string) {
  const details = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "对照源码" }) })
    .first();
  const summary = details.locator("summary").first();
  await expect(summary, `${pageId}: 对照源码 summary visible`).toBeVisible();
  await summary.scrollIntoViewIfNeeded();
  if ((await details.getAttribute("open")) === null) {
    await summary.click();
  }
  await expect(details, `${pageId}: 对照源码 expanded`).toHaveAttribute("open", "");
  await expect(details, `${pageId}: contains v0.23.0`).toContainText("v0.23.0");
  await expect(details, `${pageId}: contains v0.26.0rc`).toContainText("v0.26.0rc");
  await expect(details, `${pageId}: contains v0.30.0`).toContainText("v0.30.0");
  await expect(details, `${pageId}: contains main`).toContainText("main");
  const versionMatrixCount = await details.locator("table").filter({ hasText: "v0.30.0" }).count();
  expect(versionMatrixCount, `${pageId}: expected 4-column version matrix table`).toBeGreaterThan(0);
  return details;
}

test("终极收口 1/5：首页 3D 城市渲染、拖转相机与 Resize 保持机位 ([P2-5])", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/");

  const scene = page.getByTestId("city-scene");
  await expect(scene).toHaveAttribute("data-scene-ready", "true", { timeout: 60_000 });
  const canvasBox = await scene.locator("canvas").boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(800);
  expect(canvasBox?.height ?? 0).toBeGreaterThan(500);

  await page.keyboard.press("Escape");
  await expect(scene).toHaveAttribute("data-camera-position", /^-?\d+\.\d+,-?\d+\.\d+,-?\d+\.\d+$/);
  const homePosition = await scene.getAttribute("data-camera-position");

  // Drag-rotate camera
  await page.mouse.move(960, 520);
  await page.mouse.down();
  await page.mouse.move(780, 440, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe(homePosition);
  const rotatedPosition = await scene.getAttribute("data-camera-position");

  // Resize 1440x900 -> 1320x840 -> 1440x900 and assert camera pose preserved
  await page.setViewportSize({ width: 1320, height: 840 });
  await page.waitForTimeout(250);
  expect(await scene.getAttribute("data-camera-position")).toBe(rotatedPosition);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  expect(await scene.getAttribute("data-camera-position")).toBe(rotatedPosition);

  await page.screenshot({ path: join(EVIDENCE_DIR, "01-intro-city-3d.png") });
  expect(errors).toEqual([]);
});

test("终极收口 2/5：PD 分离 Cutaway PLATE 与 3D 场景全程播放/拖动验收", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachErrorCollector(page);
  await page.addInitScript(() => {
    window.addEventListener(
      "webglcontextlost",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.isConnected) {
          (window as unknown as { __liveContextLost?: number }).__liveContextLost =
            ((window as unknown as { __liveContextLost?: number }).__liveContextLost ?? 0) + 1;
        }
      },
      true,
    );
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/wiki/pd-disaggregation");
  await expect(page.locator("article h1").first()).toBeVisible();

  // Assert pd-plate-mooncake-cutaway loads with naturalWidth & rendered width > 500px
  const pdPlate = await assertCutawayPlateLoaded(page, "pd-plate-mooncake-cutaway");
  await pdPlate.screenshot({ path: join(RUNTIME_STAGE_DIR, "pd-plate-cutaway.png") });
  await assertDiagramSvgsClean(page, "pd-disaggregation");

  // Play & scrub the <WikiScene> 3D scene across start / mid / end frames
  const scene = page.locator(".wiki-scene").first();
  await expect(scene).toBeVisible({ timeout: 30_000 });
  await scene.locator(".wiki-scene-player").scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-ready", "true", { timeout: 45_000 });
  await expect(scene.locator("canvas")).toHaveCount(1);
  const playBtn = scene.getByRole("button", { name: "连续播放", exact: true });
  await expect(playBtn).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);

  // Start frame (t = 0)
  await scrubScene(scene, 0);
  await page.waitForTimeout(200);
  await expect(scene).toHaveAttribute("data-ready", "true");
  await expect(playBtn).toBeEnabled();
  const startProgress = Number(await scene.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(startProgress).toBeLessThanOrEqual(0.05);
  await page.screenshot({ path: join(RUNTIME_STAGE_DIR, "pd-3d-start.png") });

  // Live playback advancing timeline
  await playBtn.click();
  await expect(scene).toHaveAttribute("data-playing", "true");
  await page.waitForTimeout(450);
  await scene.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(scene).toHaveAttribute("data-playing", "false");
  const playedProgress = Number(await scene.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(playedProgress).toBeGreaterThan(startProgress);

  // Mid frame scrub
  const maxSeconds = Number(await scene.getByRole("slider").getAttribute("max"));
  expect(maxSeconds).toBeGreaterThan(1);
  await scrubScene(scene, Number((maxSeconds * 0.5).toFixed(2)));
  await page.waitForTimeout(200);
  const midProgress = Number(await scene.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(midProgress).toBeGreaterThan(0.4);
  expect(midProgress).toBeLessThan(0.6);
  await page.screenshot({ path: join(RUNTIME_STAGE_DIR, "pd-3d-mid.png") });
  await page.screenshot({ path: join(EVIDENCE_DIR, "02-pd-plate-and-3d.png") });

  // End frame scrub
  await scrubScene(scene, maxSeconds);
  await page.waitForTimeout(200);
  const endProgress = Number(await scene.locator(".wiki-scene-canvas").getAttribute("data-progress"));
  expect(endProgress).toBeGreaterThanOrEqual(0.95);
  await page.screenshot({ path: join(RUNTIME_STAGE_DIR, "pd-3d-end.png") });

  await expect(page.getByText("图解暂未载入，步骤讲解仍可阅读。")).toHaveCount(0);
  const liveLost = await page.evaluate(
    () => (window as unknown as { __liveContextLost?: number }).__liveContextLost ?? 0,
  );
  expect(liveLost).toBe(0);
  expect(errors).toEqual([]);
});

test("终极收口 3/5：3 页 Cutaway PLATE + 暖色原生 SVG 零越界 + 对照源码四版本矩阵展开", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const targets = [
    { pageId: "vllm-v1-shape", plateId: "vllm-v1-plate-cutaway", shot: "03-vllm-v1-plate.png" },
    { pageId: "npugraph-ex", plateId: "npugraph-plate-three-tier", shot: "04-npugraph-plate.png" },
    { pageId: "speculative-decoding", plateId: "speculative-plate-mtp-cutaway", shot: null },
  ] as const;

  for (const { pageId, plateId, shot } of targets) {
    await page.goto(`/#/wiki/${pageId}`);
    await expect(page.locator("article h1").first()).toBeVisible();
    const plateFigure = await assertCutawayPlateLoaded(page, plateId);
    await assertDiagramSvgsClean(page, pageId);

    if (shot) {
      await plateFigure.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(EVIDENCE_DIR, shot) });
    }

    await expandAndVerifySourceMatrix(page, pageId);
  }

  expect(errors).toEqual([]);
});

test("终极收口 4/5：v0.30.0 升级参数页零 rc2 劫持、对照源码与版本谱系/参数定义顺序", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const pageId of ["enable-super-kernel-ce990e186bfa", "stair-config-cca9e594a052"] as const) {
    await page.goto(`/#/wiki/${pageId}`);
    await expect(page.locator("article h1").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${pageId}: 1440px horizontal overflow`,
    ).toBe(true);

    // Zero v0.30.0rc2 对照 hijack
    await expect(page.locator("body")).not.toContainText("v0.30.0rc2 对照");
    await expect(page.locator("h1, h2, h3, summary").filter({ hasText: "v0.30.0rc2" })).toHaveCount(0);
    await expect(page.getByTestId("wiki-versions")).toContainText("v0.30.0");

    // Expand 对照源码
    const sourceDetails = await expandAndVerifySourceMatrix(page, pageId);
    const lineageHeading = page.locator("h2", { hasText: "版本谱系" }).first();
    const paramDefHeading = page.locator("h2", { hasText: "参数定义（自动生成）" }).first();

    await expect(lineageHeading).toBeVisible();
    await expect(paramDefHeading).toBeVisible();

    const sourceBox = await sourceDetails.locator("summary").first().boundingBox();
    const lineageBox = await lineageHeading.boundingBox();
    const paramDefBox = await paramDefHeading.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(lineageBox).not.toBeNull();
    expect(paramDefBox).not.toBeNull();
    expect(lineageBox!.y, `${pageId}: 版本谱系 below 对照源码`).toBeGreaterThan(sourceBox!.y);
    expect(paramDefBox!.y, `${pageId}: 参数定义（自动生成） below 版本谱系`).toBeGreaterThan(lineageBox!.y);

    if (pageId === "enable-super-kernel-ce990e186bfa") {
      await sourceDetails.locator("summary").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(EVIDENCE_DIR, "05-param-enable-super-kernel.png") });
    }
  }

  expect(errors).toEqual([]);
});

test("终极收口 5/5：sampling 旧锚点跳转延伸导览并衔接至 sampling-advanced", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/#/wiki/sampling#beam-search为什么同时保留几条没写完的候选");
  await expect(page.locator("article h1").first()).toBeVisible();

  const handoffHeading = page
    .locator("h2", { hasText: "高阶采样、Beam、Logprobs 与生成式评分延伸导览" })
    .first();
  await expect(handoffHeading).toBeVisible();

  // legacyAnchors must scroll the handoff heading into view
  await expect
    .poll(async () => {
      const box = await handoffHeading.boundingBox();
      return box ? box.y : 9999;
    })
    .toBeLessThan(480);

  // Follow the handoff link to sampling-advanced (Beam Search section)
  const beamLink = page
    .locator('article a[href*="sampling-advanced"]')
    .filter({ hasText: /Beam Search/ })
    .first();
  await expect(beamLink).toBeVisible();
  await beamLink.click();

  await expect(page).toHaveURL(/#\/wiki\/sampling-advanced/);
  await expect(page.locator("article h1").first()).toBeVisible();

  const beamDiagram = page.locator('figure.wiki-diagram[data-diagram="sampling-beam-search"]');
  await expect(beamDiagram).toBeVisible();
  await expect(beamDiagram).toHaveAttribute("data-status", "ok");
  await beamDiagram.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);

  const diagramBox = await beamDiagram.locator("svg").boundingBox();
  expect(diagramBox?.width ?? 0).toBeGreaterThan(400);
  expect(diagramBox?.height ?? 0).toBeGreaterThan(150);
  await assertDiagramSvgsClean(page, "sampling-advanced");

  await page.screenshot({ path: join(EVIDENCE_DIR, "06-sampling-handoff.png") });
  expect(errors).toEqual([]);
});
