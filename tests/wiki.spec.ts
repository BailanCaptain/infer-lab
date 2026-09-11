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
    await expect(page.getByRole("heading", { name: "一句话" })).toBeVisible();
  });

  test("七节结构齐全，顺序与 HANDBOOK 一致", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const h2 = page.getByTestId("wiki-body").getByRole("heading", { level: 2 });
    await expect(h2).toHaveText([
      "一句话",
      "为什么需要它",
      "怎么工作",
      "拿真实数字走一遍",
      "事实表",
      "常见误解",
      "接着看",
    ]);
  });

  test("mermaid 图渲染成 SVG，不是一段源码", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const fig = page.getByTestId("wiki-body").locator("figure.wiki-diagram");
    await expect(fig.first()).toBeVisible();
    // 渲染成功的标志是 svg 真的出现了，且不是失败态退回的源码
    const svg = fig.first().locator("svg");
    await expect(svg).toBeVisible();
    const box = await svg.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(100);
    expect(box?.height ?? 0).toBeGreaterThan(60);
    await expect(fig.first()).not.toHaveClass(/wiki-diagram-failed/);
    // 图里的标识符来自源码，随便挑一个验证文字真的进了 svg
    await expect(svg).toContainText(/[A-Za-z_]/);
  });

  test("正文里的内联证据标记渲染成角标，不是字面量 [C]", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const body = page.getByTestId("wiki-body");
    const badge = body.locator("span.wiki-evidence").first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/^[SCDAIM!]$/);
    // 悬停说明：解决「用户看到一个字母不知道是什么」
    await expect(badge).toHaveAttribute("title", /.+/);
    // 字面量不该再出现在正文里
    await expect(body).not.toContainText("[C]");
  });

  test("中文加粗真的加粗——全角标点旁的 ** 不留字面量", async ({ page }) => {
    // CommonMark 的 flanking 规则遇上中文全角标点会失效：`**换出（D2H）**发生在`
    // 里的闭合 ** 前是「）」后是「发」，判不成 right-flanking，于是整段以字面量
    // 显示。remark-cjk-friendly 按 CommonMark 的 CJK 提案修正这条规则。
    await page.goto("/#/wiki/recompute-cpu-offload");
    const body = page.getByTestId("wiki-body");
    await expect(body.locator("strong", { hasText: "换出（D2H）" })).toBeVisible();
    // 唯一允许留下的 ** 是 Python 幂运算 8 * 1024**3，它本来就不是加粗
    const stars = ((await body.innerText()).match(/\*\*/g) ?? []).length;
    expect(stars).toBeLessThanOrEqual(1);
  });

  test("事实表的「来源」列不被侧栏裁掉", async ({ page }) => {
    await page.goto("/#/wiki/paged-attention");
    // 页面上不止一张表，挑表头里有「来源」的那张——事实表
    const wrap = page
      .getByTestId("wiki-body")
      .locator(".wiki-table-scroll")
      .filter({ has: page.locator("th", { hasText: "来源" }) })
      .first();
    await expect(wrap).toBeVisible();
    // 容器自己能横向滚，表格就不会溢出去压到侧栏底下
    const [clientW, scrollW] = await wrap.evaluate((el) => [el.clientWidth, el.scrollWidth]);
    expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    // 第三列（来源）真的在视口里
    const lastCell = wrap.locator("tbody tr").first().locator("td").last();
    await expect(lastCell).toBeVisible();
    await expect(lastCell).toContainText("#L");
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
