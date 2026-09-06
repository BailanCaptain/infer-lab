/**
 * Spike C / D 浏览器验收（计划 §2.10 #3、#3b）：
 * - Worker 内构建：0.6B < 500 ms，8B < 5000 ms；
 * - 播放期零 React commit：commit 与 TweenBar 渲染只随换步增加，帧数独立增长；
 * - 快捷键、URL 深链接、nofx。
 */
import { expect, type Page, test } from "@playwright/test";

interface Counters {
  pageCommits: number;
  barRenders: number;
  frames: number;
  stepChanges: number;
  t: number;
}

const readCounters = (page: Page): Promise<Counters> =>
  page.evaluate(() => {
    const c = (window as unknown as { __spikeC: Counters & { progress: { t: number } } }).__spikeC;
    return {
      pageCommits: c.pageCommits,
      barRenders: c.barRenders,
      frames: c.frames,
      stepChanges: c.stepChanges,
      t: c.progress.t,
    };
  });

async function waitReady(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => (window as unknown as { __labReady?: boolean }).__labReady === true,
    null,
    {
      timeout,
    },
  );
}

const buildMs = async (page: Page) => Number(await page.getByTestId("status").getAttribute("data-build-ms"));

test("Qwen3-0.6B 在 Worker 内构建 < 500 ms，播放期零 commit，快捷键与 URL 同步", async ({ page }) => {
  await page.goto("/#/dev/spike-c");
  await waitReady(page);
  const ms = await buildMs(page);
  console.log(`Worker 构建 Qwen3-0.6B: ${ms.toFixed(0)} ms`);
  expect(ms).toBeGreaterThan(0);
  expect(ms).toBeLessThan(500);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "embed.gather");

  // 等首步过渡结束再取基线
  await page.waitForFunction(
    () => (window as unknown as { __spikeC: { progress: { t: number } } }).__spikeC.progress.t === 1,
  );
  const before = await readCounters(page);
  await page.getByTestId("play").click();
  await page.waitForTimeout(3200);
  await page.getByTestId("pause").click();
  const after = await readCounters(page);
  const frames = after.frames - before.frames;
  const stepChanges = after.stepChanges - before.stepChanges;
  const commits = after.pageCommits - before.pageCommits;
  const barRenders = after.barRenders - before.barRenders;
  console.log(
    `播放 3.2 s：帧 ${frames}，换步 ${stepChanges}，页面 commit ${commits}，TweenBar 渲染 ${barRenders}`,
  );
  expect(frames).toBeGreaterThan(30);
  expect(stepChanges).toBeGreaterThanOrEqual(1);
  // 允许 play / pause 各一次 commit，其余只能来自换步
  expect(commits).toBeLessThanOrEqual(stepChanges + 2);
  expect(barRenders).toBe(0);
  expect(frames).toBeGreaterThan(commits * 5);

  // URL 用 step id
  await expect.poll(() => page.url()).toContain("step=L0.");
  const idBefore = await page.getByTestId("canvas").getAttribute("data-step-id");
  await page.keyboard.press("ArrowRight");
  const idAfter = await page.getByTestId("canvas").getAttribute("data-step-id");
  expect(idAfter).not.toBe(idBefore);
  await expect(page.getByTestId("narration-title")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "embed.gather");
  await page.keyboard.press("End");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.kv.write");
  await page.keyboard.press("]");
  await expect(page.getByTestId("speed")).toHaveValue("2");
  await page.getByTestId("snapshot").click();
  await page.screenshot({ path: "test-results/spike-c-0.6b.png" });
});

test("深链接 ?step=&layer=&nofx=1：直达指定步、无动效时 t 立即为 1", async ({ page }) => {
  await page.goto("/#/dev/spike-c?step=L0.attn.softmax&layer=hardware&nofx=1");
  await waitReady(page);
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.softmax");
  await expect(page.getByTestId("status")).toContainText("无动效");
  const c = await readCounters(page);
  expect(c.t).toBe(1);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("canvas")).toHaveAttribute("data-step-id", "L0.attn.pv");
  expect((await readCounters(page)).t).toBe(1);
  await expect.poll(() => page.url()).toContain("nofx=1");
  await expect.poll(() => page.url()).toContain("layer=hardware");
  await expect.poll(() => page.url()).toContain("step=L0.attn.pv");
});

test("Qwen3-8B 在 Worker 内构建 < 5 s，主线程不阻塞", async ({ page }) => {
  await page.goto("/#/dev/spike-c");
  await waitReady(page);
  await page.getByTestId("model").selectOption("qwen3-8b");
  await expect(page.getByTestId("status")).toHaveAttribute("data-status", "loading");
  // 构建期间主线程仍在渲染：帧数继续增长
  const f0 = (await readCounters(page)).frames;
  await page.waitForTimeout(400);
  const f1 = (await readCounters(page)).frames;
  expect(f1).toBeGreaterThan(f0);
  await expect(page.getByTestId("status")).toHaveAttribute("data-status", "ready", { timeout: 30_000 });
  const ms = await buildMs(page);
  console.log(`Worker 构建 Qwen3-8B: ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThan(5000);
  await expect(page.getByTestId("status")).toContainText("Qwen3-8B");
  await page.screenshot({ path: "test-results/spike-c-8b.png" });
});
