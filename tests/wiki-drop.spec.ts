import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { handbookFixture, wikiFixture } from "../scripts/wiki/test-fixture";

let fixture: ReturnType<typeof wikiFixture>;
let server: ChildProcess;
test.beforeEach(async ({ context }) => {
  fixture = wikiFixture();
  fixture.write("wiki/HANDBOOK.md", handbookFixture());
  fixture.write("wiki/log.md", "# log\n");
  fixture.write(
    "wiki/sources/a.md",
    "---\nid: a\ntitle: 已有知识\ntype: source\nsummary: 现有内容\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-10-06'\n---\n已有内容。\n",
  );
  server = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("./fixtures/wiki-drop-server.ts", import.meta.url)),
      fixture.root,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const origin = await new Promise<string>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timer = setTimeout(() => reject(new Error(errors || "fixture timeout")), 15000);
    server.once("error", reject);
    server.stderr!.on("data", (c) => {
      errors += c;
    });
    server.stdout!.on("data", (c) => {
      output += c;
      if (output.includes("\n")) {
        clearTimeout(timer);
        resolve(JSON.parse(output.trim()).origin);
      }
    });
  });
  await context.route("**/api/wiki/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
      headers: { ...route.request().headers(), host: new URL(origin).host, origin },
    });
    await route.fulfill({ response });
  });
});
test.afterEach(async () => {
  if (server && server.exitCode === null) {
    const done = new Promise<void>((r) => server.once("exit", () => r()));
    server.kill();
    await done;
  }
  fixture?.cleanup();
});

for (const width of [1280, 390])
  test(`Drop complete intake, persisted review, figure preview and publication at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/#/wiki/a");
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "Drop", exact: true }).click();
    const drop = page.getByRole("tabpanel", { name: "Drop 资料" });
    if (width >= 1200) {
      const panel = page.getByTestId("chat-drawer");
      await expect.poll(async () => (await panel.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(540);
      expect((await panel.boundingBox())!.x).toBeGreaterThan(248);
      await expect(page.getByRole("heading", { name: "已有知识", exact: true })).toBeInViewport();
    }
    await drop
      .getByLabel("粘贴正文")
      .fill("每组包含两个单元，每个单元占用 1 B。使用时需要保留来源版本。测试资料只用于隔离知识库。");
    await drop.getByRole("button", { name: "接收并预检" }).click();
    await expect(drop.getByRole("button", { name: "开始处理", exact: true })).toBeEnabled();
    await drop.getByRole("button", { name: "开始处理", exact: true }).click();
    await expect(drop.getByRole("button", { name: "查看整组变更" })).toBeVisible();
    await page.reload();
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "Drop", exact: true }).click();
    await expect(drop.getByLabel("资料批次").locator("option")).toHaveCount(2);
    await drop.getByLabel("资料批次").selectOption({ index: 1 });
    await drop.getByRole("button", { name: "查看整组变更" }).click();
    await expect(page.getByRole("img", { name: "drop-cache-figure.svg 修改后" })).toBeVisible();
    await expect(page.getByText("目录位置前后预览")).toBeVisible();
    await expect(page.getByText(/修改后：.*公开资料/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /公式前后预览/ })).toBeVisible();
    await expect(page.locator(".wiki-drop-assets .wiki-calc-result")).toHaveText("2 B");
    await page.screenshot({ path: info.outputPath(`drop-review-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: /批准/ }).click();
    await expect(page.getByTestId("review-state")).toContainText("已发布");
    await page.getByTestId("chat-close").click();
    await page.goto("/#/wiki/drop-cache");
    await expect(page.getByRole("heading", { name: "新缓存规则", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`drop-published-${width}.png`), fullPage: true });
  });
