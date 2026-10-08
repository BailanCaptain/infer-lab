/**
 * pnpm wiki:figshots <页面 id> [阅读页地址]
 *
 * 把一页里的每张图按读者真实看到的样子截下来，存到 test-results/figshots/<id>-<序号>.png。
 * HANDBOOK「图」第 8 条：画完要截图看一遍再交——只看 spec 看不出挤不挤、清不清楚。
 *
 * 阅读页地址默认 http://localhost:5193（pnpm dev）。截图是可以随时重做的派生物，
 * 放在 test-results 里（gitignore）；注意 pnpm test:e2e 开跑时会清空这个目录。
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [id, base = "http://localhost:5193"] = process.argv.slice(2);
if (!id) {
  console.error("用法：pnpm wiki:figshots <页面 id> [阅读页地址]");
  process.exit(1);
}
const dir = "test-results/figshots";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(`${base}/#/wiki/${id}`, { waitUntil: "networkidle" });
await page.waitForSelector("h1", { timeout: 60_000 });
await page.waitForTimeout(1500);
const figures = await page.$$("[data-testid='wiki-body'] figure.wiki-diagram");
let n = 0;
for (const figure of figures) {
  n += 1;
  await figure.scrollIntoViewIfNeeded();
  await figure.screenshot({ path: `${dir}/${id}-${n}.png` });
}
await browser.close();
console.log(n ? `截了 ${n} 张图 → ${dir}/${id}-1…${n}.png` : `${id} 这一页没有图`);
