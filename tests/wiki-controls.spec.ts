import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

let server: ChildProcess;
let origin: string;
const state = async () => (await fetch(`${origin}/test-state`)).json();
test.beforeEach(async () => {
  server = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("./fixtures/wiki-controls-server.ts", import.meta.url)),
    ],
    {
      env: { ...process.env, WIKI_TEST_WEB_PORT: process.env.WIKI_TEST_WEB_PORT ?? "4173" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  origin = await new Promise<string>((resolve, reject) => {
    let out = "",
      errors = "";
    const timer = setTimeout(() => reject(new Error(errors || "fixture timeout")), 15_000);
    server.once("error", reject);
    server.stderr!.on("data", (data) => {
      errors += data;
    });
    server.stdout!.on("data", (data) => {
      out += data;
      if (out.includes("\n")) {
        clearTimeout(timer);
        resolve(JSON.parse(out.trim()).origin);
      }
    });
  });
});
test.afterEach(async () => {
  if (server?.exitCode === null) {
    const done = new Promise<void>((resolve) => server.once("exit", () => resolve()));
    server.kill();
    await done;
  }
});

for (const [question, stage] of [
  ["生成时停止", "answer"],
  ["核对时停止", "quality"],
  ["缺口时停止", "gap"],
]) {
  test(`${question}：浏览器断流终止实际子进程，下一问可发送`, async ({ page }, info) => {
    await page.goto(`${origin}/#/wiki/a`);
    await expect(page.getByRole("heading", { name: "控制验收资料", exact: true })).toBeVisible();
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill(question!);
    await page.getByTestId("chat-send").click();
    try {
      await expect
        .poll(async () => (await state()).children.some((c: { stage: string }) => c.stage === stage))
        .toBe(true);
    } catch (error) {
      console.log(JSON.stringify(await state()), await page.getByTestId("chat-log").innerText());
      throw error;
    }
    await page.getByRole("button", { name: "停止回答" }).click();
    await expect
      .poll(async () => (await state()).children.find((c: { stage: string }) => c.stage === stage))
      .toMatchObject({ finished: true, cancelled: true });
    await expect.poll(async () => (await state()).activeSessions).toBe(0);
    await page.getByTestId("chat-input").fill("下一问");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-quality").last()).toContainText("独立核对");
    await expect(page.getByRole("button", { name: "停止回答" })).toHaveCount(0);
    await expect(page.getByTestId("chat-log")).not.toContainText("出错了");
    await page.screenshot({ path: info.outputPath(`${stage}-stopped.png`) });
  });
}

test("Drop 达到修订上限后保留批次，刷新可重试；处理中可取消", async ({ page }, info) => {
  await page.goto(`${origin}/#/wiki/a`);
  await page.getByTestId("chat-open").click();
  await page.getByRole("tab", { name: "Drop", exact: true }).click();
  const drop = page.getByRole("tabpanel", { name: "Drop 资料" });
  await drop
    .getByLabel("粘贴正文")
    .fill("每组包含两个单元，每个单元占用 1 B。使用时需要保留来源版本。测试资料只用于隔离知识库。");
  await drop.getByRole("button", { name: "接收并预检" }).click();
  await drop.getByRole("button", { name: "开始处理", exact: true }).click();
  await expect(drop).toContainText("自动修订已达上限");
  await expect(drop.getByText("资料和进度已保留", { exact: false })).toBeVisible();
  await expect(drop.locator("details").filter({ hasText: "查看失败详情" })).not.toHaveAttribute("open");
  const failed = await state();
  expect(failed.generateCalls).toBe(4);
  expect(failed.batches[0]).toMatchObject({ state: "failed" });
  expect(failed.batches[0].reviewId).toBeUndefined();
  await page.screenshot({ path: info.outputPath("drop-limit.png") });
  await page.reload();
  await page.getByTestId("chat-open").click();
  await page.getByRole("tab", { name: "Drop", exact: true }).click();
  await drop.getByLabel("资料批次").selectOption({ index: 1 });
  await expect(drop).toContainText("自动修订已达上限");
  expect((await state()).generateCalls).toBe(4);
  await fetch(`${origin}/test/drop-mode?value=wait`, { method: "POST" });
  await drop.getByRole("button", { name: "按本批模型重试", exact: true }).click();
  await expect
    .poll(async () => (await state()).children.some((c: { stage: string }) => c.stage === "drop"))
    .toBe(true);
  await drop.getByRole("button", { name: "取消处理" }).click();
  await expect.poll(async () => (await state()).batches[0].state).toBe("cancelled");
  await expect
    .poll(async () => (await state()).children.at(-1))
    .toMatchObject({ finished: true, cancelled: true });
  await fetch(`${origin}/test/drop-mode?value=normal`, { method: "POST" });
  await drop.getByRole("button", { name: "按本批模型重试", exact: true }).click();
  await expect(drop.getByRole("button", { name: "查看整组变更" })).toBeVisible();
  expect((await state()).batches[0].state).toBe("review");
  await drop.getByRole("button", { name: "查看整组变更" }).click();
  await expect(page.getByRole("img", { name: "drop-cache-figure.svg 修改后" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("drop-recovered.png") });
});
