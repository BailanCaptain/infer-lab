import { expect, type Page, test } from "@playwright/test";

/**
 * 知识页样式（2026-09-27 定稿，都是默认样式，不挂参数）：
 * - 正文 15/26、中英文自动留空；行内代码暖沙色小底；表格无竖线、隔行底色；等宽字体栈接上中文字体。
 * - 算式块：```calc 围栏和认得出的 ```text 算式块，外框和图框同一套；一项一行，标签 ｜ 算式 ｜ = 结果；
 *   说明在行下；```calc 里写了 title 才有框下标题。
 */

async function openSpecimen(page: Page) {
  await page.goto("/#/dev/wiki-specimen");
  await expect(page.locator('[data-specimen="table"] table').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function openWiki(page: Page, id: string, query = "") {
  await page.goto(`/#/wiki/${id}${query}`);
  await expect(page.locator('[data-testid="wiki-body"] h2[id]').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 这个元素里的字实际用了哪些字体（Chromium 的 CSS.getPlatformFontsForNode） */
async function platformFonts(page: Page, selector: string): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  await cdp.detach();
  return fonts.map((f: { familyName: string }) => f.familyName);
}

// ---------- 正文、行内代码、表格 ----------

test("正文 15/26，中英文自动留空；行内代码暖沙色小底，含代码的行不比别的行高", async ({ page }) => {
  await openWiki(page, "one-request");
  const body = page.getByTestId("wiki-body");
  await expect(body).toHaveCSS("font-size", "15px");
  await expect(body).toHaveCSS("line-height", "26px");
  await expect(body).toHaveCSS("text-autospace", "normal");
  const code = body.locator("p code").first();
  await expect(code).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // 底色不是页面的米色（以前代码底和页面同色）
  const [codeBg, canvas] = await Promise.all([
    code.evaluate((el) => getComputedStyle(el).backgroundColor),
    page.evaluate(() => getComputedStyle(document.querySelector(".wiki-shell") as Element).backgroundColor),
  ]);
  expect(codeBg).not.toBe(canvas);

  await openSpecimen(page);
  const heights = await page
    .locator('[data-specimen="code"] .wiki-body :is(p, li)')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  for (const h of heights) expect(h % 26, String(h)).toBe(0);
});

test("表格无竖线、隔行底色，数字列右对齐；首列全加粗的表不当合计行", async ({ page }) => {
  await openSpecimen(page);
  const parts = page.locator('[data-specimen="table"] table').nth(1);
  const cell = parts.locator("tbody tr").first().locator("td").first();
  await expect(cell).toHaveCSS("border-left-width", "0px");
  const [odd, even] = await Promise.all(
    [0, 1].map((i) =>
      parts
        .locator("tbody tr")
        .nth(i)
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ),
  );
  expect(odd).toBe("rgba(0, 0, 0, 0)");
  expect(even).not.toBe(odd);
  await expect(parts.locator("td.is-num").first()).toHaveCSS("text-align", "right");
  // 部件表最后一行「整卡合计」上面有一条线
  await expect(parts.locator("tbody tr").last().locator("td").first()).toHaveCSS("border-top-width", "1px");

  // 官方双机部署的并行维度表：TP / DP / EP / PP 首格都加粗，最后一行 PP 不是合计
  await openWiki(page, "glm-5-3-flash-two-node");
  const dims = page.getByTestId("wiki-body").locator("table").first();
  await expect(dims.locator("tbody tr").last().locator("td").first()).toHaveCSS("border-top-width", "0px");
});

test("代码与算式里的中文不再落到新宋体；算式用正文字体、等宽数字、正文字号", async ({ page }) => {
  await openSpecimen(page);
  // 行内代码 `18 × 3 × 4096 × 2048 × 1 B = 432 MiB/层` 里的「层」
  const code = (await platformFonts(page, '[data-specimen="code"] .wiki-body p:nth-of-type(1) code')).join(
    ",",
  );
  expect(code).toMatch(/Noto Sans SC/);
  expect(code).not.toMatch(/SimSun/i);
  // 算式「36,864 B 卷积 + 524,288 B 递推」里的中文
  const expr = page.locator(".wiki-calc").first().locator(".wiki-calc-row").nth(1).locator(".wiki-calc-expr");
  await expect(expr).toHaveCSS("font-size", "15px");
  await expect(expr).toHaveCSS("font-variant-numeric", "tabular-nums");
  expect(await expr.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Inter Variable"/);
  await expect(expr).toContainText("卷积");
  const fonts = (
    await platformFonts(
      page,
      '[data-specimen="calc"] .wiki-calc .wiki-calc-row:nth-of-type(2) .wiki-calc-expr',
    )
  ).join(",");
  expect(fonts).toMatch(/Noto Sans SC/);
  expect(fonts).not.toMatch(/SimSun|JetBrains/i);
});

test("淘汰的试样参数都已删掉：style / table / measure / base / calc / calcbox 不再改变页面", async ({
  page,
}) => {
  await openWiki(page, "one-request");
  const plain = await page.getByTestId("wiki-body").innerHTML();
  await openWiki(page, "one-request", "?style=f&table=1&measure=narrow&base=1&calc=g1&calcbox=1");
  expect(await page.getByTestId("wiki-body").innerHTML()).toBe(plain);
  await expect(page.locator(".wiki-shell")).not.toHaveAttribute("data-wiki-base");
});

// ---------- 算式块 ----------

test("算式块是默认样式：认得出的 ```text 块排成算式块，认不出的仍是代码块；外框和图框一样", async ({
  page,
}) => {
  await openWiki(page, "one-request");
  const body = page.getByTestId("wiki-body");
  const calcs = await body.locator(".wiki-calc").count();
  expect(calcs).toBeGreaterThan(5);
  // 张量形状表之类认不出的块仍是代码块
  expect(await body.locator("pre").count()).toBeGreaterThan(0);
  const frame = (sel: string) =>
    body
      .locator(sel)
      .first()
      .evaluate((el) => {
        const c = getComputedStyle(el);
        return [c.backgroundColor, c.borderTopColor, c.borderTopWidth, c.borderTopLeftRadius].join(" ");
      });
  expect(await frame(".wiki-calc")).toBe(await frame(".wiki-diagram"));
  // ```text 块没有 title，框下不拿标签拼标题
  await openSpecimen(page);
  const textCalcs = page
    .locator('[data-specimen="calc"] .wiki-calc')
    .filter({ hasNot: page.locator(".wiki-calc-caption") });
  await expect(textCalcs).toHaveCount(4);
});

test("桌面一项一行：标签不折行、正文色；结果栏右对齐加粗、上下对齐；多步推导留在算式栏", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWiki(page, "glm-5-3-flash-two-node");
  const block = page.getByTestId("wiki-body").locator(".wiki-calc").first();
  const layout = await block.evaluate((el) => {
    const rows = [...el.querySelectorAll(".wiki-calc-row")];
    const box = (n: Element | null) => n?.getBoundingClientRect();
    return rows.map((r) => {
      const label = r.querySelector(".wiki-calc-label") as HTMLElement;
      const result = r.querySelector(".wiki-calc-result strong");
      return {
        label: label.textContent,
        labelLines: Math.round(label.getBoundingClientRect().height / 26),
        labelColor: getComputedStyle(label).color,
        resultRight: Math.round(box(r.querySelector(".wiki-calc-result"))?.right ?? 0),
        resultTop: Math.round(box(result)?.top ?? 0),
        labelTop: Math.round(label.getBoundingClientRect().top),
        eqLeft: Math.round(box(r.querySelector(".wiki-calc-eq"))?.left ?? 0),
        weight: result ? getComputedStyle(result).fontWeight : "",
      };
    });
  });
  expect(layout.map((r) => r.label)).toContain("KDA 每层每请求的状态（TP=8 之后）");
  for (const r of layout) {
    expect(r.labelLines, r.label ?? "").toBe(1);
    expect(r.labelColor).toBe("rgb(23, 33, 31)");
    expect(r.weight).toBe("700");
    // 结果和标签在同一行
    expect(Math.abs(r.resultTop - r.labelTop)).toBeLessThan(8);
  }
  expect(new Set(layout.map((r) => r.resultRight)).size).toBe(1);
  expect(new Set(layout.map((r) => r.eqLeft)).size).toBe(1);

  // 下一块：「每块字节 = 12 × … = 8,355,840 B = 7.969 MiB」中间步骤在算式栏，只有 7.969 MiB 进结果栏；
  // 旁注「其中 MTP 层占 1,088 B」在它那一行下面，和算式栏左边缘对齐
  const next = page.getByTestId("wiki-body").locator(".wiki-calc").nth(1);
  const bytes = next.locator(".wiki-calc-row").filter({ hasText: "每块字节" });
  await expect(bytes.locator(".wiki-calc-expr")).toContainText("= 8,355,840 B");
  await expect(bytes.locator(".wiki-calc-result strong")).toHaveText("7.969 MiB");
  const perToken = next.locator(".wiki-calc-row").filter({ hasText: "折合每 token" });
  const [expr, note] = await Promise.all([
    perToken.locator(".wiki-calc-expr").boundingBox(),
    perToken.locator(".wiki-calc-note").boundingBox(),
  ]);
  expect(Math.round(note?.x ?? 0)).toBe(Math.round(expr?.x ?? 0));
  expect(note?.y ?? 0).toBeGreaterThan(expr?.y ?? 0);
});

test("```calc 围栏：写了 title 才有框下标题", async ({ page }) => {
  await openSpecimen(page);
  const fence = page.locator('[data-specimen="calc"] .wiki-calc').last();
  await expect(fence.locator(".wiki-calc-caption")).toHaveText("KV 块的大小是怎么定的");
  await expect(page.locator('[data-specimen="calc"] .wiki-calc-caption')).toHaveCount(1);
});

test("手机：标签单占一行，下面一行是算式和结果；不撑出横向滚动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWiki(page, "glm-5-3-flash-two-node");
  const row = page.getByTestId("wiki-body").locator(".wiki-calc-row").filter({ hasText: "逻辑块大小" });
  const [label, expr, result] = await Promise.all([
    row.locator(".wiki-calc-label").boundingBox(),
    row.locator(".wiki-calc-expr").boundingBox(),
    row.locator(".wiki-calc-result").boundingBox(),
  ]);
  expect(expr?.y ?? 0).toBeGreaterThanOrEqual((label?.y ?? 0) + (label?.height ?? 0) - 1);
  expect(Math.abs((result?.y ?? 0) - (expr?.y ?? 0))).toBeLessThan(8);
  for (const open of [() => openWiki(page, "one-request"), () => openSpecimen(page)]) {
    await open();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  }
});
