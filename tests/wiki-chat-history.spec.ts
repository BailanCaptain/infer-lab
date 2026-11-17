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

test("pagehide 在 50ms textBatch 窗口内先刷入流式分片再写存储，刷新后不丢最后一段文字", async ({ page }) => {
  await page.addInitScript(() => {
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/wiki/chat")) return origFetch(input, init);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: knowledge\ndata: ${JSON.stringify({ sessionId: "sid-pagehide", revision: "a".repeat(64) })}\n\n` +
                `event: text\ndata: ${JSON.stringify({ text: "LAST-CHUNK-MUST-SURVIVE" })}\n\n`,
            ),
          );
          (window as unknown as { __chatChunkSent?: boolean }).__chatChunkSent = true;
          init?.signal?.addEventListener(
            "abort",
            () => {
              try {
                controller.error(new DOMException("Aborted", "AbortError"));
              } catch {
                // ignore closed stream
              }
            },
            { once: true },
          );
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };
  });

  await page.goto("/#/wiki");
  await page.getByTestId("chat-open").click();
  await page.getByTestId("chat-input").fill("测试刷新前流式分片");
  await page.getByTestId("chat-send").click();
  await page.getByTestId("chat-input").fill("刷新前草稿");

  const savedAtPageHide = await page.evaluate(async () => {
    while (!(window as unknown as { __chatChunkSent?: boolean }).__chatChunkSent) {
      await new Promise((r) => setTimeout(r, 0));
    }
    // 给 reader.read() 一次 0ms 宏任务把分片送进 textBatch，但远早于 50ms 批处理定时器
    await new Promise((r) => setTimeout(r, 0));
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    return JSON.parse(localStorage.getItem("wiki-chat-history-v1") ?? "{}") as {
      input?: string;
      msgs?: Array<{ text?: string; status?: string }>;
    };
  });

  expect(savedAtPageHide.input).toBe("刷新前草稿");
  expect(savedAtPageHide.msgs?.[1]?.text).toBe("LAST-CHUNK-MUST-SURVIVE");
  expect(savedAtPageHide.msgs?.[1]?.status).toBe("pending");

  await page.reload();
  await page.getByTestId("chat-open").click();
  await expect(page.getByTestId("chat-log")).toContainText("LAST-CHUNK-MUST-SURVIVE");
  await expect(page.getByTestId("chat-log")).toContainText("回答已中断");
  await expect(page.getByTestId("chat-input")).toHaveValue("刷新前草稿");
});

test("审阅面板内联前后 SVG 剥离原型同名属性，并按实例隔离同名 pattern 渲染真实红蓝像素", async ({
  page,
}, info) => {
  const makePatternSvg = (hex: string, extraAttr: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80" ${extraAttr}>` +
    `<title>共享图案</title>` +
    `<defs><pattern id="review-shared-paint" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${hex}"/></pattern></defs>` +
    `<rect x="0" y="0" width="120" height="80" fill="url(#review-shared-paint)"/>` +
    `</svg>`;

  const beforeSvg = makePatternSvg("#dc2626", 'constructor="x" __proto__="y"');
  const afterSvg = makePatternSvg("#2563eb", 'toString="z" hasOwnProperty="w"');

  await page.route("**/api/wiki/reviews", (route) =>
    route.fulfill({
      json: {
        reviews: [{ id: "rev-svg-collision", state: "pending", files: ["wiki/diagrams/shared.svg"] }],
      },
    }),
  );
  await page.route("**/api/wiki/reviews/rev-svg-collision", (route) =>
    route.fulfill({
      json: {
        review: {
          id: "rev-svg-collision",
          state: "pending",
          payload: {
            writes: [{ path: "wiki/diagrams/shared.svg", before: beforeSvg, after: afterSvg }],
          },
        },
        diff: "",
      },
    }),
  );

  await page.goto("/#/wiki");
  await page.getByTestId("chat-open").click();
  await page.getByRole("tab", { name: /审阅/ }).click();
  await page.getByRole("button", { name: /知识库维护变更/ }).click();

  const beforeSvgLocator = page.locator('figure[data-diagram="shared-before"] svg');
  const afterSvgLocator = page.locator('figure[data-diagram="shared-after"] svg');
  await expect(beforeSvgLocator).toBeVisible();
  await expect(afterSvgLocator).toBeVisible();

  await page.locator(".wiki-drop-assets").screenshot({
    path: info.outputPath("review-svg-pattern-isolation.png"),
  });

  const beforePng = await beforeSvgLocator.screenshot();
  const afterPng = await afterSvgLocator.screenshot();

  const sampleCenter = async (pngBytes: Buffer) =>
    page.evaluate(
      async (bytes) => {
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        const [r, g, b, a] = ctx.getImageData(
          Math.floor(bmp.width / 2),
          Math.floor(bmp.height / 2),
          1,
          1,
        ).data;
        return { r: r!, g: g!, b: b!, a: a! };
      },
      [...pngBytes],
    );

  const beforePixel = await sampleCenter(beforePng);
  const afterPixel = await sampleCenter(afterPng);

  // 修改前为红色（#dc2626），修改后必须为蓝色（#2563eb）而非误引用前图的红色 pattern
  expect(beforePixel.r).toBeGreaterThan(180);
  expect(beforePixel.b).toBeLessThan(80);
  expect(afterPixel.b).toBeGreaterThan(180);
  expect(afterPixel.r).toBeLessThan(80);
});
