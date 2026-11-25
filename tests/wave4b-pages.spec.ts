import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE_DIR = join(process.cwd(), "test-results", "evidence", "wave4b");
mkdirSync(EVIDENCE_DIR, { recursive: true });

const WAVE4B_PAGE_IDS = [
  "mla",
  "sparse-attention",
  "linear-attention",
  "kv-cache-spec",
  "engram-conditional-memory",
  "multimodal-inference",
  "sampling-advanced",
  "pooling-and-non-ar",
  "moe-comm-dispatch",
  "epd-disaggregation",
  "model-runner-v2",
  "dev-new-model-and-custom-op",
  "v030-release-baseline",
  "aisbench-and-evalscope",
  "msprobe-accuracy-debug",
  "cluster-serving",
] as const;

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

async function collectWikiDiagramSvgIssues(page: Page, pageId: string) {
  const result = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll<SVGSVGElement>(".wiki-diagram svg"));
    const overflows: string[] = [];
    const collisions: string[] = [];
    let textCount = 0;

    for (const [idx, svg] of svgs.entries()) {
      const vbAttr = svg.getAttribute("viewBox") ?? "";
      const parts = vbAttr
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const [vx = 0, vy = 0, vw = 0, vh = 0] = parts;
      if (vw <= 0 || vh <= 0) {
        overflows.push(`SVG#${idx} missing viewBox "${vbAttr}"`);
        continue;
      }
      const svgCtm = svg.getScreenCTM();
      const rects = Array.from(svg.querySelectorAll("rect"))
        .map((r) => {
          const rx = Number(r.getAttribute("x") ?? "0");
          const ry = Number(r.getAttribute("y") ?? "0");
          const rw = Number(r.getAttribute("width") ?? "0");
          const rh = Number(r.getAttribute("height") ?? "0");
          return { rx, ry, rw, rh };
        })
        .filter((r) => r.rw >= 80 && r.rh >= 28 && r.rw < vw - 4);
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
            `SVG#${idx} "${val}" bbox(${minX.toFixed(1)},${minY.toFixed(1)},${maxX.toFixed(1)},${maxY.toFixed(1)}) vs viewBox(${vx},${vy},${vw},${vh})`,
          );
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const hostRects = rects
          .filter((rc) => cx >= rc.rx && cx <= rc.rx + rc.rw && cy >= rc.ry && cy <= rc.ry + rc.rh)
          .sort((a, b2) => a.rw * a.rh - b2.rw * b2.rh);
        const host = hostRects[0];
        if (host && (minX < host.rx - 3 || maxX > host.rx + host.rw + 3)) {
          overflows.push(
            `SVG#${idx} "${val}" x[${minX.toFixed(1)}..${maxX.toFixed(1)}] overflows host rect x[${host.rx}..${host.rx + host.rw}]`,
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
            collisions.push(`SVG#${idx}: "${a.text}" <-> "${b.text}" (${ox.toFixed(1)}x${oy.toFixed(1)}px)`);
          }
        }
      }
    }
    return { svgCount: svgs.length, textCount, overflows, collisions };
  });

  expect(result.svgCount, `${pageId}: expected >= 1 wiki-diagram SVG`).toBeGreaterThan(0);
  expect(result.textCount, `${pageId}: expected SVG <text> labels`).toBeGreaterThan(0);
  return {
    overflows: result.overflows.map((s) => `[${pageId}] ${s}`),
    collisions: result.collisions.map((s) => `[${pageId}] ${s}`),
  };
}

test("Wave 4B 全量 16 篇页面渲染、20+ 新老 SVG 零越界零重叠、对照源码折叠展开与 359/1440 零溢出", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = attachErrorCollector(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const screenshotTargets = new Set([
    "engram-conditional-memory",
    "moe-comm-dispatch",
    "epd-disaggregation",
    "model-runner-v2",
    "v030-release-baseline",
    "msprobe-accuracy-debug",
  ]);

  const allOverflows: string[] = [];
  const allCollisions: string[] = [];

  for (const pageId of WAVE4B_PAGE_IDS) {
    await page.goto(`/#/wiki/${pageId}`);
    await expect(page.locator("article h1, .wiki-article h1, main h1").first()).toBeVisible();

    // 1440px zero horizontal overflow
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${pageId} 1440px horizontal overflow`,
    ).toBe(true);

    // SVG bounding box & pairwise collision check
    const issues = await collectWikiDiagramSvgIssues(page, pageId);
    allOverflows.push(...issues.overflows);
    allCollisions.push(...issues.collisions);

    if (screenshotTargets.has(pageId)) {
      const firstDiag = page.locator(".wiki-diagram").first();
      await firstDiag.scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(EVIDENCE_DIR, `${pageId}-diagram.png`) });
    }

    // Verify default-collapsed 对照源码 details/section exists and toggles cleanly
    const sourceToggle = page.locator("details summary").filter({ hasText: "对照源码" }).first();
    if ((await sourceToggle.count()) > 0) {
      await sourceToggle.click();
      await expect(page.locator("body")).toContainText("v0.30.0");
    }
  }

  // Spot-check 359px mobile zero horizontal overflow on all 16 Wave 4B pages
  const mobileOverflows: string[] = [];
  await page.setViewportSize({ width: 359, height: 844 });
  for (const mobileId of WAVE4B_PAGE_IDS) {
    await page.goto(`/#/wiki/${mobileId}`);
    await expect(page.locator("article h1, .wiki-article h1, main h1").first()).toBeVisible();
    const info = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const iw = window.innerWidth;
      if (sw <= iw) return null;
      const culprits: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        let insideScroll = false;
        let p: Element | null = el.parentElement;
        while (p && p !== document.documentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden") {
            insideScroll = true;
            break;
          }
          p = p.parentElement;
        }
        if (insideScroll) continue;
        const r = el.getBoundingClientRect();
        if (r.right > iw + 1 && el.children.length === 0) {
          const txt = (el.textContent ?? "").trim().slice(0, 56);
          culprits.push(`${el.tagName.toLowerCase()}(right=${r.right.toFixed(1)}:"${txt}")`);
          if (culprits.length >= 4) break;
        }
      }
      return `scrollWidth=${sw} > ${iw}: ${culprits.join(", ")}`;
    });
    if (info) mobileOverflows.push(`[${mobileId}] ${info}`);
  }

  expect({
    allOverflows,
    allCollisions,
    mobileOverflows,
    errors,
  }).toEqual({
    allOverflows: [],
    allCollisions: [],
    mobileOverflows: [],
    errors: [],
  });
});
