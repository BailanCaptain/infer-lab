import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { HANDBOOK_H2 } from "../scripts/wiki/handbook";
import { wikiFixture } from "../scripts/wiki/test-fixture";

let fixture: ReturnType<typeof wikiFixture>;
let server: ChildProcess;
let origin: string;
let answerId: string;
const state = async () => (await fetch(`${origin}/test-state`)).json();
let liveChat: boolean;
const original =
  "---\nid: a\ntitle: 原有解释\ntype: source\nsummary: 原有解释\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n## 一句话\n原有解释。\n";

test.beforeEach(async ({ context }) => {
  fixture = wikiFixture();
  liveChat = false;
  fixture.write(
    "wiki/HANDBOOK.md",
    Object.values(HANDBOOK_H2)
      .map((h) => `## ${h}\n\nfixture\n`)
      .join("\n"),
  );
  fixture.write("wiki/sources/a.md", original);
  server = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("./fixtures/wiki-review-server.ts", import.meta.url)),
      fixture.root,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const ready = await new Promise<{ origin: string; answerId: string; answer: string }>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timer = setTimeout(() => reject(new Error(errors || "Fixture startup timeout")), 10000);
    server.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    server.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(errors));
    });
    server.stderr!.on("data", (chunk) => {
      errors += chunk;
    });
    server.stdout!.on("data", (chunk) => {
      output += chunk;
      if (output.includes("\n")) {
        clearTimeout(timer);
        resolve(JSON.parse(output.trim()));
      }
    });
  });
  origin = ready.origin;
  answerId = ready.answerId;
  const answer = ready.answer;
  await context.route("**/api/wiki/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/chat") && !liveChat) {
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: text\ndata: ${JSON.stringify({ text: `${answer}\n\n<!-- wiki-coverage: {"satisfied":true,"reason":"当前页证据充分"} -->` })}\n\nevent: done\ndata: ${JSON.stringify({ answerId })}\n\n`,
      });
      return;
    }
    // The real local handlers run against an isolated fixture; mirror a same-origin local proxy.
    const response = await route.fetch({
      url: `${origin}${url.pathname}${url.search}`,
      headers: { ...route.request().headers(), host: new URL(origin).host, origin },
    });
    await route.fulfill({ response });
  });
});

test("coverage metadata stays hidden while the cited answer remains readable", async ({ page }, info) => {
  await page.goto("/#/wiki/a");
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("解释现有材料");
  await page.getByTestId("chat-send").click();
  const log = page.getByTestId("chat-log");
  await expect(log.getByRole("link", { name: "原有解释" })).toBeVisible();
  await expect(log).not.toContainText("wiki-coverage");
  await expect(log).not.toContainText("当前页证据充分");
  await page.screenshot({ path: info.outputPath("coverage-metadata-hidden.png") });
});

test("origin is visible and a cited answer offers actual related pages", async ({ page }, info) => {
  liveChat = true;
  fixture.write(
    "wiki/sources/a.md",
    original.replace(
      "evidence: S",
      "evidence: S\norigin: drop\nrelations: [{to: b, kind: builds-on, note: 理解原有解释所需的背景}]",
    ),
  );
  fixture.write("wiki/sources/b.md", original.replace("id: a", "id: b").replaceAll("原有解释", "相关背景"));
  await page.goto("/#/wiki/a");
  await expect(page.getByTestId("wiki-origin")).toHaveText("资料投喂");
  await expect(page.getByTestId("wiki-origin")).toHaveClass(/is-drop/);
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("原有解释有什么背景？");
  await page.getByTestId("chat-send").click();
  const related = page.getByTestId("chat-related");
  await expect(related.getByRole("link", { name: "相关背景" })).toHaveAttribute("href", "#/wiki/b");
  await page.screenshot({ path: info.outputPath("origin-related.png") });
  await related.getByRole("link", { name: "相关背景" }).click();
  await expect(page).toHaveURL(/#\/wiki\/b$/);
  await expect(page.getByTestId("wiki-origin")).toHaveText("源码提取");
});

test("real citation check explains an unbound marker and prevents saving", async ({ page }, info) => {
  liveChat = true;
  await page.goto("/#/wiki/a");
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("检查未绑定引用");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-uncited")).toContainText("[S1] 未明确绑定所属页");
  await expect(page.getByRole("button", { name: "存进 Wiki", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("chat-log").getByRole("link", { name: "原有解释" })).toHaveAttribute(
    "href",
    "#/wiki/a",
  );
  expect((await state()).calls).toBe(0);
  await page.screenshot({ path: info.outputPath("citation-rejected.png") });
});

test("three uncovered turns persist one gap and show awaiting assessment without compiling", async ({
  page,
}, info) => {
  liveChat = true;
  await page.goto("/#/wiki/a");
  await page.getByTestId("chat-open").click();
  for (let i = 1; i <= 3; i++) {
    await page.getByTestId("chat-input").fill("未收录概念 main 怎么配置？");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-gap").last()).toContainText(
      i === 3 ? "已排进补写队列" : `（${i}/3）`,
    );
  }
  // 2026-09-23 审视：原文「已进入处理队列；预算内核对后生成待审变更」说过头了——自动补写开关关着时
  // 没有任何东西处理队列，打开后也要先写好复测计划才会编译。提示要如实说出这两个前提。
  await expect(page.getByTestId("chat-gap").last()).toContainText("自动补写打开后");
  await expect(page.getByTestId("chat-gap").last()).toContainText("复测计划");
  await expect(page.getByRole("button", { name: "存进 Wiki", exact: true })).toHaveCount(0);
  const current = await state();
  expect(current.gaps).toHaveLength(1);
  expect(current.gaps[0]).toMatchObject({ count: 3, assessment: "unassessed" });
  expect(current.calls).toBe(0);
  expect(current.pages).toBe(1);
  await page.screenshot({ path: info.outputPath("gap-awaiting-assessment.png") });
});

test("continuing after publication shows the new version and starts fresh model context", async ({
  page,
}, info) => {
  liveChat = true;
  await saveFromChat(page);
  const before = await page.getByTestId("chat-version").first().innerText();
  await page.getByRole("button", { name: "批准此版本并发布" }).click();
  await expect(page.getByTestId("review-state")).toContainText("已发布");
  await page.getByRole("tab", { name: "问答" }).click();
  await page.getByTestId("chat-input").fill("现在再解释一次");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-version-notice")).toContainText("知识库已更新");
  await expect(page.getByTestId("chat-version")).toHaveCount(2);
  await expect(page.getByTestId("chat-version").last()).not.toHaveText(before);
  await expect(page.getByTestId("reader-version")).toHaveText(
    await page.getByTestId("chat-version").last().innerText(),
  );
  await expect(page.getByTestId("chat-log")).toContainText("已读到发布后的组合诊断");
  await expect(page.getByTestId("chat-send")).toBeDisabled();
  await page.getByTestId("chat-input").fill("再确认一遍");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-version")).toHaveCount(3);
  await expect
    .poll(async () => (await state()).chatCalls.map((r: { resumed: boolean }) => r.resumed))
    .toEqual([false, false, true]);
  await page.screenshot({ path: info.outputPath("wiki-chat-revision.png"), fullPage: true });
});

test("returning to an offline reader keeps the cached content and its version", async ({ page }, info) => {
  await page.goto("/#/wiki/a");
  await expect(page.getByTestId("wiki-body")).toContainText("原有解释");
  const version = await page.getByTestId("reader-version").innerText();
  const revision = await page.getByTestId("reader-version").getAttribute("title");
  await page.route("**/api/wiki/pages", (route) => route.abort());
  await page.getByRole("link", { name: "返回首页" }).click();
  await expect(page.getByTestId("wiki-body")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("status")).toContainText("仍显示以上版本");
  await expect(page.getByTestId("wiki-body")).toContainText("原有解释");
  await expect(page.getByTestId("reader-version")).toHaveText(version);
  await expect(page.getByTestId("reader-version")).toHaveAttribute("title", revision!);
  await page.screenshot({ path: info.outputPath("wiki-reader-cached.png"), fullPage: true });
});
test.afterEach(async () => {
  if (server && server.exitCode === null)
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      server.kill();
    });
  fixture?.cleanup();
});

async function saveFromChat(page: import("@playwright/test").Page) {
  await page.goto("/#/wiki");
  await expect(page.getByRole("link", { name: "原有解释", exact: true })).toBeVisible();
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("如何组合诊断？");
  await page.getByTestId("chat-send").click();
  await page.getByRole("button", { name: "存进 Wiki", exact: true }).click();
  await expect(page.getByRole("button", { name: "生成待审草稿" })).toBeDisabled();
  await page.getByLabel("本次编译总预算（美元）").fill("1");
  await page.getByRole("button", { name: "生成待审草稿" }).click();
  await expect(page.getByTestId("review-state")).toContainText("待审");
  await expect(page.getByTestId("review-diff")).toContainText("组合诊断");
}

test("save, inspect the real diff, approve, read and retrieve the new publication", async ({
  page,
}, info) => {
  await saveFromChat(page);
  expect((await state()).pages).toBe(1);
  await page.screenshot({ path: info.outputPath("wiki-review-pending.png"), fullPage: true });
  await page.getByRole("button", { name: "批准此版本并发布" }).click();
  await expect(page.getByTestId("review-state")).toContainText("已发布");
  await page.getByRole("tab", { name: "问答" }).click();
  await page.getByTestId("chat-close").click();
  await page.getByRole("link", { name: "组合诊断", exact: true }).click();
  await expect(page.getByTestId("wiki-body")).toContainText("比较两个条件");
  await page.screenshot({ path: info.outputPath("wiki-review-published.png"), fullPage: true });
  expect(await state()).toMatchObject({ pages: 2, hit: `answer-${answerId}`, calls: 1 });
});

test("reject requires a reason and keeps the formal library unchanged", async ({ page }) => {
  await saveFromChat(page);
  await expect(page.getByRole("button", { name: "驳回此版本" })).toBeDisabled();
  await page.getByLabel("驳回原因").fill("需要补充条件的证据");
  await page.getByRole("button", { name: "驳回此版本" }).click();
  await expect(page.getByTestId("review-state")).toContainText("已驳回");
  await expect(page.getByText("驳回原因：需要补充条件的证据")).toBeVisible();
  expect((await state()).pages).toBe(1);
});

test("stale publication reports the conflict and never displays a false success", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await saveFromChat(page);
  fixture.write("wiki/sources/a.md", original.replace("原有解释。", "原有解释已调整。"));
  const id = (await page.getByTestId("review-state").innerText()).split(" · ")[1]!;
  await page.getByRole("button", { name: "批准此版本并发布" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("review-state")).toContainText("待审");
  expect(JSON.parse(readFileSync(join(fixture.root, `wiki/_jobs/reviews/${id}.json`), "utf8")).state).toBe(
    "pending",
  );
  expect((await state()).pages).toBe(1);
});
