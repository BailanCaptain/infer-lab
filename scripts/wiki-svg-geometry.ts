/**
 * Chromium 真实渲染几何门禁：检查 wiki/diagrams/*.svg 的画布越界、内框文字溢出、文字重叠与最小字号（≥12px）。
 * 用法：pnpm wiki:svg-geometry [diagram-id ...]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

interface SvgDefect {
  file: string;
  issues: string[];
}

const BROWSER_SCAN_EXPR = `(() => {
  const svg = document.querySelector("svg");
  if (!svg) return ["missing <svg> root"];
  const out = [];

  const vb = svg.viewBox && svg.viewBox.baseVal;
  const vw = vb && vb.width > 0 ? vb.width : Number(svg.getAttribute("width")) || 900;
  const vh = vb && vb.height > 0 ? vb.height : Number(svg.getAttribute("height")) || 600;
  const vx = vb ? vb.x : 0;
  const vy = vb ? vb.y : 0;

  const svgCtm = svg.getScreenCTM();
  function toRootBox(el) {
    const b = el.getBBox();
    if (b.width <= 0 && b.height <= 0) return null;
    const m = el.getScreenCTM();
    if (!svgCtm || !m) return { x: b.x, y: b.y, width: b.width, height: b.height };
    const rel = svgCtm.inverse().multiply(m);
    const pts = [
      new DOMPoint(b.x, b.y).matrixTransform(rel),
      new DOMPoint(b.x + b.width, b.y).matrixTransform(rel),
      new DOMPoint(b.x, b.y + b.height).matrixTransform(rel),
      new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(rel),
    ];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  const rects = Array.from(svg.querySelectorAll("rect"))
    .filter((r) => !r.closest("defs, clipPath, mask, pattern"))
    .map((r) => ({ el: r, box: toRootBox(r) }))
    .filter((r) => Boolean(r.box && r.box.width >= 36 && r.box.height >= 16));

  const texts = Array.from(svg.querySelectorAll("text")).filter(
    (t) => !t.closest("defs, clipPath, mask") && (t.textContent || "").trim().length > 0,
  );

  const textBoxes = [];

  for (const t of texts) {
    const label = (t.textContent || "").trim().slice(0, 32);
    const fsAttr = t.getAttribute("font-size") || window.getComputedStyle(t).fontSize;
    const fs = Number.parseFloat(fsAttr || "14");
    if (Number.isFinite(fs) && fs < 11.95) {
      out.push('font-size < 12px (' + fs + 'px): "' + label + '"');
    }
    const tb = toRootBox(t);
    if (!tb) continue;
    textBoxes.push({ label, box: tb });

    if (
      tb.x < vx - 3.5 ||
      tb.y < vy - 3.5 ||
      tb.x + tb.width > vx + vw + 3.5 ||
      tb.y + tb.height > vy + vh + 3.5
    ) {
      out.push(
        'viewBox overflow [' + tb.x.toFixed(1) + ',' + tb.y.toFixed(1) + ' ' +
        tb.width.toFixed(1) + 'x' + tb.height.toFixed(1) + ' vs ' + vw + 'x' + vh + ']: "' + label + '"',
      );
    }

    const cx = tb.x + tb.width / 2;
    const cy = tb.y + tb.height / 2;
    const candidates = rects
      .filter(
        ({ box: rb }) =>
          cx >= rb.x + 1 && cx <= rb.x + rb.width - 1 && cy >= rb.y + 1 && cy <= rb.y + rb.height - 1,
      )
      .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);

    const host = candidates[0];
    if (host) {
      const rb = host.box;
      if (rb.width >= 80 && rb.height >= 22) {
        if (tb.x < rb.x - 4.0 || tb.x + tb.width > rb.x + rb.width + 4.0) {
          out.push(
            'hostRect X overflow (text [' + tb.x.toFixed(1) + '..' + (tb.x + tb.width).toFixed(1) +
            '] vs rect [' + rb.x.toFixed(1) + '..' + (rb.x + rb.width).toFixed(1) + ']): "' + label + '"',
          );
        }
      }
    }
  }

  for (let i = 0; i < textBoxes.length; i++) {
    for (let j = i + 1; j < textBoxes.length; j++) {
      const a = textBoxes[i].box;
      const b = textBoxes[j].box;
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      const minH = Math.min(a.height, b.height);
      const minW = Math.min(a.width, b.width);
      if (ox > Math.min(14, minW * 0.4) && oy > minH * 0.45) {
        out.push(
          'text collision (' + ox.toFixed(1) + 'x' + oy.toFixed(1) + 'px): "' +
          textBoxes[i].label + '" <-> "' + textBoxes[j].label + '"',
        );
      }
    }
  }

  return out;
})()`;

async function main(): Promise<void> {
  const diagramsDir = join(process.cwd(), "wiki", "diagrams");
  const filterIds = new Set(process.argv.slice(2).map((s) => s.replace(/\.svg$/i, "")));
  const allSvgs = readdirSync(diagramsDir)
    .filter((f) => f.endsWith(".svg"))
    .filter((f) => filterIds.size === 0 || filterIds.has(f.slice(0, -4)))
    .sort();

  if (allSvgs.length === 0) {
    console.error("未匹配到待检查的 SVG 图文件");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  const defects: SvgDefect[] = [];

  try {
    for (const file of allSvgs) {
      const svgMarkup = readFileSync(join(diagramsDir, file), "utf8");
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#fbfaf6;}</style></head><body>${svgMarkup}</body></html>`,
        { waitUntil: "domcontentloaded" },
      );

      const issues = (await page.evaluate(BROWSER_SCAN_EXPR)) as string[];
      if (issues.length > 0) {
        defects.push({ file, issues });
      }
    }
  } finally {
    await browser.close();
  }

  if (defects.length > 0) {
    for (const d of defects) {
      console.error(`x wiki/diagrams/${d.file}:`);
      for (const issue of d.issues) {
        console.error(`  - ${issue}`);
      }
    }
    console.error(`\nSVG 几何检查失败：${defects.length} / ${allSvgs.length} 张图存在越界、重叠或字号违例`);
    process.exit(1);
  }

  console.log(`ok SVG 几何检查通过（${allSvgs.length} 张图零越界、零碰撞、字号 ≥12px）`);
}

void main();
