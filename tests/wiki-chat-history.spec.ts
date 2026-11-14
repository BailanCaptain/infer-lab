import { expect, test } from "@playwright/test";

test("刷新保留回答、草稿及会话，继续提问沿用 sessionId", async ({ page }) => {
  const requests: { message: string; sessionId?: string }[] = [];
  await page.route("**/api/wiki/chat", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "text/event-stream",
      body: [
        ["knowledge", { sessionId: "test-session", revision: "a".repeat(64), online: true }],
        ["text", { text: "权重按层分散存放，见 [参数页](params/layer-sharding.md)。" }],
        ["cite", { cited: true, selfDeclaredUncovered: false }],
        ["done", { sessionId: "test-session" }],
      ]
        .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        .join(""),
    });
  });
  await page.goto("/#/wiki/sequence-parallel");
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("layer_sharding 是什么");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-log")).toContainText("权重按层分散存放");
  await page.getByTestId("chat-input").fill("那它如何广播？");
  await page.reload();
  await page.getByTestId("chat-open").click();
  await expect(page.getByTestId("chat-log")).toContainText("权重按层分散存放");
  await expect(page.getByTestId("chat-input")).toHaveValue("那它如何广播？");
  await page.getByTestId("chat-send").click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]?.sessionId).toBe("test-session");
});

test("刷新中断的回答保留正文与提示，手机长表格不撑宽面板", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (localStorage.getItem("wiki-chat-history-v1")) return;
    localStorage.setItem(
      "wiki-chat-history-v1",
      JSON.stringify({
        version: 1,
        input: "继续核对",
        sessionId: "pending",
        msgs: [
          { key: "q", role: "user", text: "请对比版本" },
          {
            key: "a",
            role: "agent",
            status: "pending",
            text: "收到的部分回答\n\n| v0.23 | v0.26 | main | 限制 |\n|---|---|---|---|\n| 有 | 无 | 无 | 条件依版本而异 |",
            trace: { status: "searching" },
          },
        ],
      }),
    );
  });
  await page.goto("/#/wiki");
  await page.getByTestId("chat-open").click();
  await expect(page.getByTestId("chat-log")).toContainText("收到的部分回答");
  await expect(page.getByTestId("chat-log")).toContainText("回答已中断");
  await expect(page.getByTestId("chat-input")).toHaveValue("继续核对");
  await expect(page.getByTestId("chat-send")).toBeEnabled();
  const size = await page
    .getByTestId("chat-log")
    .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});
