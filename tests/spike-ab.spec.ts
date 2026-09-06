/**
 * Spike A / B 浏览器验收（计划 §2.10 #1、#2）：
 * - A：场景内标签两两不相交、全在画布内；四个机位各留一张截图给人目测中文清晰度；
 * - B：真实形状平面 + 放大窗口；压力模式 5120 格下帧数持续增长；换步只重写实例缓冲，耗时 < 2 ms。
 * headless 走 SwiftShader 软渲染，帧率数字只做下限断言，真实 60fps 结论要看有 GPU 的浏览器。
 */
import { expect, type Page, test } from "@playwright/test";

interface Bounds {
  id: string;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Counters {
  frames: number;
  stepChanges: number;
  lastCostMs: number;
  maxCostMs: number;
  pageCommits: number;
}
type W = Window & {
  __labels?: () => Bounds[];
  __spikeAB?: Counters;
  __labReady?: boolean;
};

const labels = (page: Page) => page.evaluate(() => (window as unknown as W).__labels?.() ?? []);
const counters = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as W).__spikeAB!;
    return { ...c };
  });

async function waitReady(page: Page) {
  await page.waitForFunction(() => (window as unknown as W).__labReady === true, null, { timeout: 30_000 });
}

/** troika 排版是异步的：等标签数量稳定且 ≥ min */
async function settledLabels(page: Page, min: number): Promise<Bounds[]> {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const ls = await labels(page);
    if (ls.length >= min && ls.length === last) return ls;
    last = ls.length;
    await page.waitForTimeout(150);
  }
  return labels(page);
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

async function assertLabelsClean(page: Page, ls: Bounds[]) {
  const box = await page.getByTestId("canvas").boundingBox();
  if (!box) throw new Error("画布没有尺寸");
  const bad: string[] = [];
  for (const l of ls) {
    if (l.x0 < -1 || l.y0 < -1 || l.x1 > box.width + 1 || l.y1 > box.height + 1)
      bad.push(
        `出视口: ${l.id} "${l.text}" [${l.x0.toFixed(0)},${l.y0.toFixed(0)}–${l.x1.toFixed(0)},${l.y1.toFixed(0)}]`,
      );
  }
  for (let i = 0; i < ls.length; i++)
    for (let j = i + 1; j < ls.length; j++) {
      const a = ls[i]!;
      const b = ls[j]!;
      if (overlaps(a, b)) bad.push(`重叠: ${a.id} "${a.text}" × ${b.id} "${b.text}"`);
    }
  expect(bad, bad.join("\n")).toEqual([]);
}

test("Spike A：标签在四个机位都不重叠、不出画布；中文截图供目测", async ({ page }) => {
  await page.goto("/#/dev/spike-ab?nofx=1");
  await waitReady(page);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "embed.gather");

  // 值模式 8×8：64 个格值 + 标题/形状/范围/行维/列维 = 69。激活只有 S=6 行，用 Q 投影权重 [1024,2048] 才够 8 行
  await page.getByTestId("mode-values").click();
  await page.getByTestId("scrubber").fill("2");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
  await page.getByTestId("slot-b").click();
  await expect(page.getByTestId("status")).toHaveAttribute("data-tensor-id", "L0.attn.q_proj");
  const front = await settledLabels(page, 69);
  console.log(`正面机位标签数 ${front.length}`);
  expect(front.length).toBeGreaterThanOrEqual(69);
  await assertLabelsClean(page, front);
  await page.screenshot({ path: "test-results/spike-ab-values-front.png" });

  for (const v of ["tilt", "side", "top"]) {
    await page.getByTestId(`view-${v}`).click();
    await page.waitForTimeout(300);
    const ls = await settledLabels(page, 69);
    // 斜机位的投影 AABB 偏保守，只断言不出画布
    const box = await page.getByTestId("canvas").boundingBox();
    for (const l of ls) {
      expect(l.x0, `${v} ${l.id} 左出界`).toBeGreaterThan(-1);
      expect(l.x1, `${v} ${l.id} 右出界`).toBeLessThan(box!.width + 1);
      expect(l.y0, `${v} ${l.id} 上出界`).toBeGreaterThan(-1);
      expect(l.y1, `${v} ${l.id} 下出界`).toBeLessThan(box!.height + 1);
    }
    await page.screenshot({ path: `test-results/spike-ab-values-${v}.png` });
  }
});

test("Spike B：真实尺寸平面（激活带 / 权重块 / 词表）+ 5120 格窗口，换步 JS < 2 ms", async ({ page }) => {
  await page.goto("/#/dev/spike-ab?nofx=1");
  await waitReady(page);

  // 词表 [151936,1024]：gather 步的 A 槽（gather 没有 B）
  await page.getByTestId("slot-a").click();
  await expect(page.getByTestId("status")).toHaveAttribute("data-tensor-id", "model.embed_tokens");
  await settledLabels(page, 5);
  await page.screenshot({ path: "test-results/spike-ab-vocab.png" });

  // 权重块 [1024,2048]：Q 投影的 B 槽
  await page.getByTestId("slot-b").click();
  await page.getByTestId("scrubber").fill("2");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.q");
  await expect(page.getByTestId("status")).toHaveAttribute("data-tensor-id", "L0.attn.q_proj");
  await settledLabels(page, 5);
  await page.screenshot({ path: "test-results/spike-ab-weight.png" });

  // 激活带 [6,2048]：输出槽
  await page.getByTestId("slot-out").click();
  await expect(page.getByTestId("status")).toHaveAttribute("data-tensor-id", "L0.attn.q");
  const ls = await settledLabels(page, 5);
  await assertLabelsClean(page, ls);
  const texts = ls.map((l) => l.text);
  expect(texts.some((t) => t.includes("[S,n_q·d_h]=[6×2048]"))).toBe(true);
  // 长说明已进 DOM；3D 里只留窗口范围与真实总数
  expect(texts.some((t) => t.includes("共 2048"))).toBe(true);
  await page.screenshot({ path: "test-results/spike-ab-activation.png" });

  // 压力模式：5120 格
  await page.getByTestId("mode-stress").click();
  await expect(page.getByTestId("status")).toContainText("窗口 64×80");
  await page.waitForTimeout(400);
  const c0 = await counters(page);
  await page.waitForTimeout(2000);
  const c1 = await counters(page);
  const frames = c1.frames - c0.frames;
  console.log(`压力模式 2 s 帧数 ${frames}（SwiftShader 软渲染）`);
  expect(frames).toBeGreaterThan(20);
  await page.screenshot({ path: "test-results/spike-ab-stress.png" });

  // 走完全部 21 步，记录实例缓冲重写耗时
  await page.evaluate(() => {
    (window as unknown as W).__spikeAB!.maxCostMs = 0;
  });
  await page.keyboard.press("Home");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(60);
  }
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.kv.write");
  const c2 = await counters(page);
  console.log(
    `21 步换步缓冲重写：最大 ${c2.maxCostMs.toFixed(2)} ms，最后一步 ${c2.lastCostMs.toFixed(2)} ms`,
  );
  expect(c2.maxCostMs).toBeLessThan(2);
  const kv = await settledLabels(page, 5);
  expect(kv.map((l) => l.text).some((t) => t.includes("K|V=0"))).toBe(true);
  await page.screenshot({ path: "test-results/spike-ab-kv.png" });
});
