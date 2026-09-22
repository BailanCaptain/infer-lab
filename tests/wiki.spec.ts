/**
 * 知识库阅读页浏览器验收（F001 AC6 / 计划 Phase 3 Task 21）：
 * - #/wiki 目录列出全部页面，点开能读正文；
 * - 页面间相对链接改写成 hash 路由并可跳转；
 * - <Term> 悬停出摘要卡；
 * - 来源角标指向 GitHub 钉住的行号。
 */
import { expect, test } from "@playwright/test";
import { checkAnswerCitations } from "../server/citations";

test.describe("知识库阅读页", () => {
  test("目录列出页面，点开能读正文", async ({ page }) => {
    await page.goto("/#/wiki");
    const nav = page.getByTestId("wiki-toc");
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    expect(await items.count()).toBeGreaterThanOrEqual(11);

    await nav.getByRole("link", { name: "Block Table" }).click();
    await expect(page).toHaveURL(/#\/wiki\/block-table$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Block Table");
    await expect(page.getByRole("heading", { name: "一句话" })).toBeVisible();
  });

  test("页头写明这页对过哪几个版本：v0.23 与 v0.26 并存，没列出的就是还没人对过", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const versions = page.getByTestId("wiki-versions");
    await expect(versions).toContainText("已核对");
    await expect(versions).toContainText("v0.23.0");
    // 分支名里的 releases/ 是 git 的事，不给读者看
    await expect(versions).not.toContainText("releases/");
  });

  test("RFork 独立成章；参数默认收起，读参数页时展开", async ({ page }) => {
    await page.goto("/#/wiki");
    const toc = page.getByTestId("wiki-toc");
    await expect(toc.locator(".wiki-toc-part-head")).toContainText([
      "推理基础知识",
      "代码全流程",
      "特性",
      "RFork 工作版",
      "参数",
    ]);
    await expect(toc).not.toContainText("未归章");
    await expect(page.getByTestId("toc-flow").locator(".wiki-toc-section").first()).toHaveText("先看全貌");
    await expect(page.getByTestId("toc-params").getByRole("link").first()).toBeHidden();
    await page.goto("/#/wiki/layer-sharding");
    await expect(page.getByTestId("toc-params").getByRole("link", { name: "layer_sharding" })).toBeVisible();
  });

  test("页面骨架：一句话开头，讲那条请求，常见误解收尾，其余小标题是结论句", async ({ page }) => {
    // 2026-09-20 全库统一成这个写法；老的「为什么需要它 / 怎么工作 / 事实表」七节模板已弃用
    await page.goto("/#/wiki/block-table");
    const titles = await page.getByTestId("wiki-body").getByRole("heading", { level: 2 }).allInnerTexts();
    expect(titles[0]).toBe("一句话");
    expect(titles).toContain("那条请求走到这里");
    expect(titles.slice(-2)).toEqual(["常见误解", "接着看"]);
    for (const old of ["为什么需要它", "怎么工作", "拿真实数字走一遍", "事实表"])
      expect(titles).not.toContain(old);
  });

  test("图渲染成 SVG，不是一段源码", async ({ page }) => {
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
    // 里的闭合 ** 前是「）」后是「发」，判不成 right-flanking，整段以字面量显示。
    // remark-cjk-friendly 按 CommonMark 的 CJK 提案修正这条规则。
    // 不绑死某一句——页面会被重跑改写，扫全库才是稳的断言。
    const ids = ["block-table", "kv-pool", "paged-attention", "prefix-caching"];
    let bolds = 0;
    for (const id of ids) {
      await page.goto(`/#/wiki/${id}`);
      const body = page.getByTestId("wiki-body");
      bolds += await body.locator("strong").count();
      expect((await body.innerText()).match(/\*\*/g)).toBeNull();
    }
    expect(bolds).toBeGreaterThan(0);
  });

  test("事实表是给学习者看的：带「意味着什么」列、不超过十行、没有来源列", async ({ page }) => {
    await page.goto("/#/wiki/paged-attention");
    const wrap = page
      .getByTestId("wiki-body")
      .locator(".wiki-table-scroll")
      .filter({ has: page.locator("th", { hasText: "意味着什么" }) })
      .first();
    await expect(wrap).toBeVisible();

    const headers = await wrap.locator("th").allInnerTexts();
    // 版本不同的行分版本列，所以是三列或四列；「来源」列已经去掉
    expect(headers.length).toBeGreaterThanOrEqual(3);
    expect(headers).not.toContain("来源");
    expect(headers[headers.length - 1]).toBe("意味着什么");

    expect(await wrap.locator("tbody tr").count()).toBeLessThanOrEqual(10);
    // 不横向溢出——去掉来源列与侧栏之后应该整屏放得下
    const [clientW, scrollW] = await wrap.evaluate((el) => [el.clientWidth, el.scrollWidth]);
    expect(scrollW).toBeLessThanOrEqual(clientW + 1);
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

  test("接着看由 relations 生成：分组、带理由、悬停出摘要卡", async ({ page }) => {
    // 旧的侧栏「相关词条」已删——它是这一节的劣化复制品（无序、无理由）
    await page.goto("/#/wiki/block-table");
    await expect(page.getByTestId("wiki-related")).toHaveCount(0);

    const next = page.getByTestId("wiki-next");
    await expect(next).toBeVisible();
    // 至少有一组，且每条都带 note——没有理由的链接读者不会点
    const items = next.locator("li");
    expect(await items.count()).toBeGreaterThan(0);
    for (const note of await next.locator(".wiki-next-note").allInnerTexts()) {
      expect(note.trim().length).toBeGreaterThan(0);
    }

    const term = items.first().getByRole("link").first();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await term.hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("带编号的内联标记能点开对应那条来源", async ({ page }) => {
    await page.goto("/#/wiki/block-table");
    const link = page.getByTestId("wiki-body").locator("a.wiki-mark-link").first();
    await expect(link).toBeVisible();
    // 点开的是钉住 commit 的具体行号，不是页面级的来源列表
    await expect(link).toHaveAttribute("href", /^https?:\/\/.+/);
    await expect(link.locator("span.wiki-evidence")).toHaveText(/^[SCM]$/);
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
  test("知识库内没有相关页面的真实拒答不会显示无引用警告", async ({ page }, info) => {
    const answer = "知识库内没有任何页面涉及 profiling_chunk_config，无法比较两个版本的配置解析行为。";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/wiki/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["text", { text: answer }],
          ["cite", checkAnswerCitations(answer, [])],
          ["done", {}],
        ]),
      }),
    );
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("比较 profiling_chunk_config 的版本差异");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-log")).toContainText(answer);
    await expect(page.getByTestId("chat-uncited")).toHaveCount(0);
    // F001 AC7：不报警，但要标成未收录，不能看起来像知识库结论
    await expect(page.getByTestId("chat-uncovered")).toContainText("未收录");
    await page.screenshot({ path: info.outputPath("honest-abstention-mobile.png"), fullPage: true });
  });

  test("声明未收录后接着讲模型自己的知识：标成未收录，不伪装成知识库结论", async ({ page }) => {
    const answer = "知识库里还没有 X 的页面。不过 X 默认开启，阈值是 0.9。";
    await page.route("**/api/wiki/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["text", { text: answer }],
          ["cite", checkAnswerCitations(answer, [])],
          ["done", {}],
        ]),
      }),
    );
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("X 默认开吗");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-uncovered")).toContainText("模型自身知识");
  });

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

test.describe("状态页签", () => {
  const status = (over: { paused?: boolean } = {}) => ({
    budget: {
      limitUsd: 100,
      chargedUsd: 17.31,
      calls: 48,
      maxCalls: 2000,
      paused: !!over.paused,
      ...(over.paused ? { pauseReason: "2026-09-16 费用未知，共享预算暂停" } : {}),
    },
    nightly: {
      lastRun: { status: "succeeded", finishedAt: "2026-09-19T17:23:49Z" },
      maxNewParamPages: 10,
      heldBack: 4,
      fetch: true,
      github: true,
      spendsMoney: false,
      paidWork: { tasks: 0, reconcile: 0, drift: 0 },
    },
    pages: { concepts: 38, params: 19, sources: 0 },
    todo: { pendingReviews: 0, missingTerms: ["token", "softmax"], totalTerms: 30, gaps: 1, queuedTasks: 0 },
  });

  test("把预算、夜间维护和会不会自己花钱摆到明面上，且没有任何写操作", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/wiki/") && r.method() !== "GET") writes.push(r.url());
    });
    await page.route("**/api/wiki/status", (route) => route.fulfill({ json: status() }));
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "状态" }).click();
    const pane = page.getByTestId("status-pane");
    await expect(page.getByTestId("status-spend")).toContainText("不会");
    await expect(pane).toContainText("$17.31 / $100");
    await expect(pane).toContainText("48 / 2000");
    await expect(pane).toContainText("留到下一晚的");
    await expect(pane).toContainText("2 / 30");
    await expect(pane.getByRole("button")).toHaveCount(0);
    expect(writes).toEqual([]);
  });

  test("预算暂停时说清楚问答用不了和原因", async ({ page }) => {
    await page.route("**/api/wiki/status", (route) => route.fulfill({ json: status({ paused: true }) }));
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "状态" }).click();
    await expect(page.getByTestId("status-pane")).toContainText("已暂停，问答用不了（2026-09-16 费用未知");
  });
});
