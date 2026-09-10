/**
 * 知识库阅读页浏览器验收（F001 AC6 / 计划 Phase 3 Task 21）：
 * - #/wiki 目录列出全部页面，点开能读正文；
 * - 页面间相对链接改写成 hash 路由并可跳转；
 * - <Term> 悬停出摘要卡；
 * - 来源角标指向 GitHub 钉住的行号。
 */
import { expect, test } from "@playwright/test";

test.describe("知识库阅读页", () => {
  test("目录列出页面，点开能读正文", async ({ page }) => {
    await page.goto("/#/wiki");
    const nav = page.getByTestId("wiki-toc");
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    expect(await items.count()).toBeGreaterThanOrEqual(11);

    await nav.getByRole("link", { name: "Block Table" }).click();
    await expect(page).toHaveURL(/#\/wiki\/block-table$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Block Table");
    await expect(page.getByRole("heading", { name: "是什么" })).toBeVisible();
  });

  test("正文里指向其它页的链接可跳转", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const body = page.getByTestId("wiki-body");
    const internal = body.locator('a[href^="#/wiki/"]').first();
    await expect(internal).toBeVisible();
    const href = await internal.getAttribute("href");
    await internal.click();
    await expect(page).toHaveURL(new RegExp(`${href?.replace("#", "\\#")}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("related 侧栏的词条悬停出摘要卡", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const term = page.getByTestId("wiki-related").getByRole("link").first();
    await expect(term).toBeVisible();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await term.hover();
    const card = page.getByRole("tooltip");
    await expect(card).toBeVisible();
    await expect(card).not.toBeEmpty();
  });

  test("来源角标指向 GitHub 钉住的行号", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const src = page.getByTestId("wiki-sources").getByRole("link").first();
    await expect(src).toHaveAttribute(
      "href",
      /^https:\/\/github\.com\/vllm-project\/vllm-ascend\/blob\/[0-9a-f]{7,40}\/.+#L\d+/,
    );
  });

  test("未知 id 给出空态而不是白屏", async ({ page }) => {
    await page.goto("/#/wiki/no-such-page");
    await expect(page.getByTestId("wiki-notfound")).toBeVisible();
  });
});

/**
 * 问答抽屉（AC7 / AC10）。用假 SSE 拦截 /api/wiki/chat：这里验的是前端如何
 * 消费流与如何呈现「未引用」提示，真实 agent 链路另用 curl 打过 server 实测。
 */
function sse(frames: [string, unknown][]): string {
  return frames.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
}

test.describe("问答抽屉", () => {
  test("发问后流式渲染，答案里的页面链接可跳转", async ({ page }) => {
    await page.route("**/api/wiki/chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["tool", { name: "Read", target: "wiki/concepts/kv-cache.md" }],
          ["text", { text: "KV Cache 缓存每层的 K 与 V，见 " }],
          ["text", { text: "[Block Table](concepts/block-table.md)。" }],
          ["cite", { cited: true, selfDeclaredUncovered: false }],
          ["done", { sessionId: "s-1" }],
        ]),
      });
    });

    await page.goto("/#/wiki/block-table");
    await page.getByTestId("chat-open").click();
    await expect(page.getByTestId("chat-drawer")).toBeVisible();

    await page.getByTestId("chat-input").fill("KV Cache 是什么");
    await page.getByTestId("chat-send").click();

    const log = page.getByTestId("chat-log");
    await expect(log).toContainText("KV Cache 缓存每层的 K 与 V");
    await expect(log).toContainText("正在读：kv-cache.md");

    const link = log.locator('a[href="#/wiki/block-table"]');
    await expect(link).toBeVisible();
  });

  test("回答没有引用任何页时给出明确提示，不伪装成知识库结论", async ({ page }) => {
    await page.route("**/api/wiki/chat", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["text", { text: "这个参数默认是开启的。" }],
          [
            "cite",
            { cited: false, selfDeclaredUncovered: false, reason: "回答里有断言但没有引用任何知识库页面" },
          ],
          ["done", {}],
        ]),
      });
    });

    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("layer_sharding 默认开吗");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("chat-uncited")).toBeVisible();
    await expect(page.getByTestId("chat-uncited")).toContainText("未经本库核对");
  });

  test("服务未启动时给出错误提示而不是静默失败", async ({ page }) => {
    await page.route("**/api/wiki/chat", (route) => route.fulfill({ status: 502, body: "bad gateway" }));
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("x");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-log")).toContainText("502");
  });

  test("关闭后按钮回到浮标状态", async ({ page }) => {
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-close").click();
    await expect(page.getByTestId("chat-drawer")).toHaveCount(0);
    await expect(page.getByTestId("chat-open")).toBeVisible();
  });
});
