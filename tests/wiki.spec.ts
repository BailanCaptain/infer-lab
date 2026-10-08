/**
 * 知识库阅读页浏览器验收（F001 AC6 / 计划 Phase 3 Task 21）：
 * - #/wiki 目录列出全部页面，点开能读正文；
 * - 页面间相对链接改写成 hash 路由并可跳转；
 * - <Term> 悬停出摘要卡；
 * - 来源角标指向 GitHub 钉住的行号。
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { parsePage } from "../scripts/wiki/pages";
import { loadStandardConfig, measureStandard } from "../scripts/wiki/standard";
import { checkAnswerCitations } from "../server/citations";

test.describe("知识库阅读页", () => {
  test("目录列出页面，点开能读正文", async ({ page }) => {
    await page.goto("/#/wiki");
    const nav = page.getByTestId("wiki-toc");
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    expect(await items.count()).toBeGreaterThanOrEqual(11);

    // 锚定开头：目录里现在还有闭环长出来的「问答记录：Block Table…」，子串匹配会命中两条
    await nav.getByRole("link", { name: /^Block Table/ }).click();
    await expect(page).toHaveURL(/#\/wiki\/block-table$/);

    // 写作标准（docs/wiki-writing-standard.md）：标题用英文术语，页头就是 frontmatter 的 title；
    // 不设「## 一句话」，开篇是问题式 H2 → 一句定义 → 直觉图；页末「## 对照源码」下依次五个固定 H3。
    const file = "concepts/block-table.md";
    const md = parsePage(file, readFileSync(new URL(`../wiki/${file}`, import.meta.url), "utf8")).page;
    expect(md, `${file} 的 frontmatter 不合法`).toBeTruthy();
    expect(md?.fm.title).toMatch(/^Block Table/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(md?.fm.title ?? "");
    // 对照源码的 H3 顺序与直觉图先行，用 wiki:audit 的同一套检查
    const standard = measureStandard(md?.body ?? "", loadStandardConfig());
    expect(standard.sourceSections).toBeNull();
    expect(standard.diagramFirst).toBeNull();

    const body = page.getByTestId("wiki-body");
    await expect(body.getByRole("heading", { level: 2 }).first()).toBeVisible();
    const opening = await body.evaluate((root) => {
      const h2s = [...root.querySelectorAll("h2")];
      const hasFigure = (el: Element) =>
        el.matches("figure.wiki-diagram") || !!el.querySelector("figure.wiki-diagram");
      const between: string[] = [];
      let el = h2s[0]?.nextElementSibling ?? null;
      for (; el && el.tagName !== "H2" && !hasFigure(el); el = el.nextElementSibling)
        between.push(el.tagName);
      return {
        h2s: h2s.map((h) => h.textContent?.trim() ?? ""),
        between,
        figureInFirstSection: !!el && hasFigure(el),
      };
    });
    expect(opening.h2s).not.toContain("一句话");
    expect(opening.h2s[0]).toMatch(/[？?]$/);
    // 第一个 H2 之后只有讲解段落（先是那句定义），然后就是直觉图，中间不夹表、算式或小标题
    expect(opening.between.length).toBeGreaterThan(0);
    expect(opening.between.every((tag) => tag === "P")).toBe(true);
    expect(opening.figureInFirstSection).toBe(true);
  });

  // 首页的入口文案曾在代码里写死，阅读指南改写之后两边对不上
  test("首页「从这里开始」用阅读指南自己的标题与导语，不写死在代码里", async ({ page }) => {
    await page.goto("/#/wiki/learning-guide");
    const title = await page.getByRole("heading", { level: 1 }).innerText();
    const summary = await page.locator(".wiki-summary").innerText();

    await page.goto("/#/wiki");
    const start = page.getByTestId("wiki-start");
    await expect(start.getByRole("link")).toHaveText(
      new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    await expect(start).toContainText(summary);
    await start.getByRole("link").click();
    await expect(page).toHaveURL(/#\/wiki\/learning-guide$/);
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
      "开始学习",
      "模型结构与计算",
      "推理过程",
      "vLLM 与 Ascend 架构",
      "Ascend 硬件与软件栈",
      "分布式推理与部署",
      "性能与工程优化",
      "服务能力",
      "RFork 工作版",
      "参数参考",
      "来源与更新记录",
    ]);
    await expect(toc).not.toContainText("未归章");
    await expect(page.getByTestId("toc-models").getByRole("link", { name: /^GQA/ })).toBeVisible();
    await expect(page.getByTestId("toc-models").getByRole("link", { name: /^MLA/ })).toBeVisible();
    await expect(page.getByTestId("toc-hardware").getByRole("link", { name: /^(GQA|MLA)/ })).toHaveCount(0);
    await expect(page.getByTestId("toc-params").getByRole("link").first()).toBeHidden();
    await page.goto("/#/wiki/layer-sharding");
    await expect(page.getByTestId("toc-params").getByRole("link", { name: "layer_sharding" })).toBeVisible();
  });

  test("两层结构：上半讲给初学者、不挂证据角标；下半「对照源码」只用固定查阅小标题", async ({ page }) => {
    // 2026-09-25 读者定为初学者：「一句话 / 那条请求 / 常见误解」五步模板弃用。
    // 按新写法改过的页先是讲解，再是给核对源码的人查的「对照源码」。
    await page.goto("/#/wiki/expert-parallel");
    const body = page.getByTestId("wiki-body");
    await expect(body.getByRole("heading", { level: 2, name: "对照源码" })).toBeVisible();
    const layout = await body.evaluate((root) => {
      const h2 = [...root.querySelectorAll("h2")].find((h) => h.textContent?.trim() === "对照源码")!;
      const upperMarks = [...root.querySelectorAll("span.wiki-evidence")].filter(
        (m) => h2.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_PRECEDING,
      ).length;
      const lower: string[] = [];
      for (let el = h2.nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling)
        if (el.tagName === "H3") lower.push(el.textContent?.trim() ?? "");
      const h2s = [...root.querySelectorAll("h2")].map((h) => h.textContent?.trim());
      return { upperMarks, lower, h2s };
    });
    expect(layout.h2s).not.toContain("一句话");
    expect(layout.upperMarks).toBe(0);
    const fixed = ["怎么开", "会报什么错", "开销和什么时候别开", "版本差异", "源码位置"];
    expect(layout.lower.length).toBeGreaterThan(0);
    expect(layout.lower.every((t) => fixed.includes(t))).toBe(true);
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
    const ids = ["block-table", "kv-pool", "kv-cache", "prefix-caching"];
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
    await page.goto("/#/wiki/block-table");
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

  // one-request.md 用 `glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache` 指向另一页的一节。
  // 以前带锚点的链接不改写（点开是 404），标题也没有 id（打开带锚点的地址只停在页顶）。
  const KV_HEADING = "剩下的显存变成多少 KV cache";
  const KV_ID = "剩下的显存变成多少-kv-cache";

  test("跨页锚点链接落到目标页的那一节标题", async ({ page }) => {
    await page.goto("/#/wiki/one-request");
    await page.getByTestId("wiki-body").getByRole("link", { name: KV_HEADING }).click();
    await expect(page.getByTestId("wiki-notfound")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/wiki\/glm-5-3-flash-two-node#/);
    const heading = page.getByRole("heading", { level: 2, name: KV_HEADING });
    await expect(heading).toHaveAttribute("id", KV_ID);
    await expect(heading).toBeInViewport();
    // 落在标题上，而不是恰好能看见：标题贴近视口顶端
    const box = await heading.boundingBox();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(box?.y ?? 999).toBeLessThan(120);
  });

  test("直接打开带锚点的地址，也滚到那一节", async ({ page }) => {
    await page.goto(`/#/wiki/glm-5-3-flash-two-node#${KV_ID}`);
    const heading = page.getByRole("heading", { level: 2, name: KV_HEADING });
    await expect(heading).toBeInViewport();
    expect((await heading.boundingBox())?.y ?? 999).toBeLessThan(120);
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

  // 图曾用满整幅阅读栏（980px），正文散文只有 72ch（约 636px），并排看图明显比正文宽一截
  // 正文栏原来只有 980px，两边空着一大片，而手写 spec 的画布最宽 1000px；
  // 一度改成把图缩到正文宽，图里的字掉到 8.7px。现在反过来：图保持 1:1，正文栏加宽到放得下图。
  const COLUMN_MIN = 1034; // 1000 画布 + 2×16 内边距 + 2×1 边框

  test("桌面上图按 1:1 渲染不缩小，正文栏宽到放得下它们，图、表、代码块与正文同宽", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const id of ["one-request", "glm-5-3-flash", "request-call-chain", "glm-5-3-flash-two-node"]) {
      await page.goto(`/#/wiki/${id}`);
      const body = page.getByTestId("wiki-body");
      await body.locator("figure.wiki-diagram svg").first().waitFor();
      await page.evaluate(() => document.fonts?.ready);

      const report = await body.evaluate((el) => {
        // 正文栏：正文里第一个散文段落的左右边界
        const prose = el.querySelector(":scope > p") as HTMLElement;
        const column = prose.getBoundingClientRect();
        const scaled: string[] = [];
        const spill: string[] = [];
        const misaligned: string[] = [];
        const check = (node: Element, what: string) => {
          const b = node.getBoundingClientRect();
          if (b.width === 0) return;
          if (b.right > column.right + 1 || b.left < column.left - 1) misaligned.push(what);
        };
        for (const fig of el.querySelectorAll("figure.wiki-diagram")) {
          const name = (fig as HTMLElement).dataset.diagram ?? "?";
          const svg = fig.querySelector("svg") as SVGSVGElement | null;
          if (svg) {
            // 1:1：画出来的宽度就是 viewBox 的宽度
            const drawn = svg.getBoundingClientRect().width;
            const scale = drawn / svg.viewBox.baseVal.width;
            if (Math.abs(scale - 1) > 0.01) scaled.push(`${name} 缩放 ${scale.toFixed(3)}`);
            // 放不下的图只能在自己的容器里横滚，不许顶出正文栏
            const canvas = fig.querySelector(".wiki-diagram-svg") as HTMLElement;
            const inside = drawn <= canvas.clientWidth + 1;
            const scrolls = getComputedStyle(canvas).overflowX === "auto";
            if (!inside && !scrolls) spill.push(name);
            check(canvas, `canvas ${name}`);
          }
          check(fig, `figure ${name}`);
          const cap = fig.querySelector("figcaption");
          if (cap) check(cap, `figcaption ${name}`);
        }
        for (const t of el.querySelectorAll(".wiki-table-scroll")) check(t, "table");
        for (const pre of el.querySelectorAll("pre")) check(pre, "pre");
        for (const calc of el.querySelectorAll("figure.wiki-calc")) check(calc, "calc");
        return { column: Math.round(column.width), scaled, spill, misaligned };
      });

      expect(report.scaled, `${id} 这些图被缩小了`).toEqual([]);
      expect(report.spill, `${id} 这些图既放不下又不能横滚`).toEqual([]);
      expect(report.misaligned, `${id} 这些块没和正文对齐（栏宽 ${report.column}）`).toEqual([]);
      expect(report.column, `${id} 正文栏太窄，放不下 1000 宽的画布`).toBeGreaterThanOrEqual(COLUMN_MIN);
    }
    // 加宽之后页面本身仍不横滚
    const [clientW, scrollW] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scrollW).toBeLessThanOrEqual(clientW);
  });

  test("1280 宽度下正文栏仍然放得下 900 的画布，且页面不横滚", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#/wiki/one-request");
    const body = page.getByTestId("wiki-body");
    await body.locator("figure.wiki-diagram svg").first().waitFor();
    const m = await body.evaluate((el) => {
      const canvas = el.querySelector(".wiki-diagram-svg") as HTMLElement;
      const svg = el.querySelector("figure.wiki-diagram svg") as SVGSVGElement;
      return {
        canvas: canvas.clientWidth,
        drawn: Math.round(svg.getBoundingClientRect().width),
        viewBox: svg.viewBox.baseVal.width,
        docW: document.documentElement.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        tocRight: Math.round(document.querySelector("[data-testid=wiki-toc]")!.getBoundingClientRect().right),
        mainLeft: Math.round(document.querySelector(".wiki-main")!.getBoundingClientRect().left),
      };
    });
    expect(m.drawn).toBe(m.viewBox);
    expect(m.canvas).toBeGreaterThanOrEqual(900);
    expect(m.docScroll).toBeLessThanOrEqual(m.docW);
    // 正文区从目录右边缘之后开始，不和目录重叠
    expect(m.mainLeft).toBeGreaterThanOrEqual(m.tocRight);
  });

  // 换页时没人重置滚动位置：从一页的底部点链接，新页面沿用上一页的 scrollY，读者落在末尾
  test("点站内链接落到新页面顶部；带锚点的仍落到对应标题；后退回到原来的位置", async ({ page }) => {
    await page.goto("/#/wiki/one-request");
    await page.getByTestId("wiki-body").waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const from = await page.evaluate(() => Math.round(window.scrollY));
    expect(from).toBeGreaterThan(500);

    // 1) 正文里不带锚点的站内链接
    const plainHref = await page
      .getByTestId("wiki-body")
      .locator('a[href^="#/wiki/"]')
      .evaluateAll((links) =>
        links.map((a) => a.getAttribute("href")).find((href) => href && !href.slice(1).includes("#")),
      );
    expect(plainHref).toBeTruthy();
    expect(plainHref?.slice(1).includes("#")).toBe(false);
    const plain = page.getByTestId("wiki-body").locator(`a[href="${plainHref}"]`).first();
    await plain.click();
    await expect(page).toHaveURL((url) => url.hash === plainHref);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(2);
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();

    // 2) 左侧目录里的链接同样落到顶部
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page
      .getByTestId("wiki-toc")
      .getByRole("link", { name: /^一条请求/ })
      .first()
      .click();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(2);

    // 3) 带锚点的链接仍然落到那一节标题
    const anchorLink = page
      .getByTestId("wiki-body")
      .getByRole("link", { name: "剩下的显存变成多少 KV cache" });
    await page.evaluate(() => document.fonts.ready);
    await anchorLink.scrollIntoViewIfNeeded();
    const leftAt = await page.evaluate(() => Math.round(window.scrollY));
    await anchorLink.click();
    const heading = page.getByRole("heading", { level: 2, name: "剩下的显存变成多少 KV cache" });
    await expect(heading).toBeInViewport();
    expect((await heading.boundingBox())?.y ?? 999).toBeLessThan(120);

    // 4) 后退恢复到离开这一页时的位置，而不是停在顶部或末尾
    expect(leftAt).toBeGreaterThan(200);
    await page.goBack();
    await expect(page).toHaveURL(/#\/wiki\/one-request$/);
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => Math.round(window.scrollY))) - leftAt))
      .toBeLessThanOrEqual(80);
  });

  // 正文角标写的是「来源 3」，来源列表却不显示编号，读者没法数到第 3 条
  test("「查看来源」按 1、2、3 编号，第 N 条就是角标里的来源 N", async ({ page }) => {
    await page.goto("/#/wiki/one-request");
    const sources = page.getByTestId("wiki-sources");
    await sources.locator("summary").click();
    const items = sources.locator("ol > li");
    const count = await items.count();
    expect(count).toBeGreaterThan(2);

    // 浏览器画出来的就是 1..N：decimal、逐条 list-item、没有改过起始值
    const marks = await items.evaluateAll((lis) =>
      lis.map((li) => {
        const cs = getComputedStyle(li);
        return { display: cs.display, type: cs.listStyleType, value: li.getAttribute("value") };
      }),
    );
    for (const [i, m] of marks.entries()) {
      expect(m.display, `第 ${i + 1} 条`).toBe("list-item");
      expect(m.type, `第 ${i + 1} 条`).toBe("decimal");
      expect(m.value, `第 ${i + 1} 条不该改写编号`).toBeNull();
    }
    await expect(sources.locator("ol")).not.toHaveAttribute("start", /.+/);

    // 编号与角标一一对应：角标 [C3] 指向的地址，就是列表第 3 条的地址
    const mark = page.getByTestId("wiki-body").locator("a.wiki-mark-link").first();
    const index = Number(await mark.getAttribute("data-source"));
    expect(index).toBeGreaterThanOrEqual(1);
    expect(await mark.getAttribute("href")).toBe(
      await items
        .nth(index - 1)
        .locator("a")
        .getAttribute("href"),
    );
  });

  // 手机上曾按容器宽度把 900 宽的图缩到 316px，图里的字只剩 4.4px
  test("手机上图按 1:1 显示，画布自己横滚，图说明和滑动提示都看得见", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/wiki/one-request");
    const fig = page.getByTestId("wiki-body").locator("figure.wiki-diagram").first();
    await fig.locator("svg").waitFor();

    const shape = await fig.evaluate((f) => {
      const svg = f.querySelector("svg") as SVGSVGElement;
      const canvas = f.querySelector(".wiki-diagram-svg") as HTMLElement;
      const sizes = [...svg.querySelectorAll("text")]
        .map((t) => {
          const m = t.getScreenCTM();
          return m ? Number.parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b) : 0;
        })
        .filter(Boolean);
      return {
        svgW: Math.round(svg.getBoundingClientRect().width),
        viewBoxW: svg.viewBox.baseVal.width,
        canvasScrolls: canvas.scrollWidth > canvas.clientWidth + 1,
        minFont: Math.min(...sizes),
      };
    });
    // 1:1：画布宽度就是 viewBox 的宽度，字号不被缩小
    expect(shape.svgW).toBe(shape.viewBoxW);
    expect(shape.canvasScrolls).toBe(true);
    expect(shape.minFont).toBeGreaterThanOrEqual(10);

    await expect(fig).toHaveAttribute("data-scrollable", "true");
    await expect(fig.getByTestId("diagram-scroll-hint")).toBeVisible();
    // 图说明在画布外面：把画布拖到最右，说明整句仍在屏幕里，不跟着滚出去
    const caption = fig.locator("figcaption");
    await caption.scrollIntoViewIfNeeded();
    await expect(caption).toBeInViewport();
    await fig.locator(".wiki-diagram-svg").evaluate((el) => {
      el.scrollTo(el.scrollWidth, 0);
    });
    await expect(caption).toBeInViewport();
    const capBox = await caption.boundingBox();
    expect(capBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((capBox?.x ?? 0) + (capBox?.width ?? 0)).toBeLessThanOrEqual(390);
    // 页面本身不横滚
    const [clientW, scrollW] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scrollW).toBeLessThanOrEqual(clientW);
  });

  // 「0 部署」曾被挤成一字一行竖着排
  test("手机上表格列不被挤成竖排：列有最小宽度，放不下就整表在容器里横滚", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/wiki/one-request");
    const body = page.getByTestId("wiki-body");
    await body.locator("table").first().waitFor();

    const cells = await body.evaluate((el) => {
      const out: { text: string; width: number; font: number }[] = [];
      for (const cell of el.querySelectorAll("th, td")) {
        const cs = getComputedStyle(cell);
        const pad = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
        out.push({
          text: cell.textContent?.trim().slice(0, 20) ?? "",
          width: cell.clientWidth - pad,
          font: Number.parseFloat(cs.fontSize),
        });
      }
      return out;
    });
    expect(cells.length).toBeGreaterThan(0);
    const squeezed = cells.filter((c) => c.text.length >= 3 && c.width < c.font * 2.6);
    expect(squeezed, `这些列被挤成竖排：${JSON.stringify(squeezed)}`).toEqual([]);

    // 页面不横滚，超宽的表在自己的容器里滚
    const [clientW, scrollW] = await page.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
    ]);
    expect(scrollW).toBeLessThanOrEqual(clientW);
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
  test("Codex 显示账户额度与请求模型，不伪造实际模型回执", async ({ page }) => {
    await page.route("**/api/wiki/chat", (route) => {
      expect(route.request().headers()["x-wiki-review"]).toBe("1");
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["text", { text: "见 [Sleep Mode](concepts/sleep-mode.md)。" }],
          ["model", { provider: "codex", requested: "gpt-6.1-sol", switched: false, switches: [] }],
          ["cite", { cited: true, selfDeclaredUncovered: false }],
          ["done", { answerId: "a".repeat(64) }],
        ]),
      });
    });
    await page.route("**/api/wiki/status", (route) =>
      route.fulfill({ json: { models: { chatProvider: "codex" } } }),
    );
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("Sleep Mode？");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-model")).toContainText("请求模型 gpt-6.1-sol");
    await expect(page.getByTestId("chat-model")).toContainText("Codex 账户额度");
    await expect(page.getByTestId("chat-model")).toContainText("未返回实际模型回执");
    await page.getByRole("button", { name: "存进 Wiki", exact: true }).click();
    await expect(page.getByText(/使用「状态」中选择的模型编译/)).toBeVisible();
    await expect(page.getByText(/使用 Codex 的 ChatGPT 账户额度，最多尝试两次/)).toBeVisible();
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "生成待审草稿" })).toBeEnabled();
  });
  test("标出实际作答模型；换了模型时说清谁拒答、谁接手（2026-09-23 问答全被换成 Opus 5）", async ({
    page,
  }, info) => {
    const answer = "默认值为 1，见 [A](sources/a.md)。";
    const turns = [
      {
        requested: "claude-opus-5-5[1m]",
        answeredBy: "claude-opus-5",
        switched: true,
        switches: [
          {
            event: "model_refusal_fallback",
            from: "claude-opus-5-5[1m]",
            to: "claude-opus-5",
            reason: "frontier_llm",
          },
        ],
      },
      { requested: "claude-opus-5-5[1m]", answeredBy: "claude-opus-5-5", switched: false, switches: [] },
    ];
    let turn = 0;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/wiki/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["knowledge", { revision: "a".repeat(64), sessionId: "s-1", online: true }],
          ["text", { text: answer }],
          ["model", turns[turn++]],
          ["cite", { cited: true, selfDeclaredUncovered: false }],
          ["done", {}],
        ]),
      }),
    );
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("A 的默认值？");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-model").first()).toContainText("claude-opus-5");
    const notice = page.getByTestId("chat-model-notice");
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText("claude-opus-5-5");
    await expect(notice).toContainText("拒答");
    await expect(notice).toContainText("frontier_llm");
    await expect(notice).toContainText("claude-opus-5 作答");
    await page.screenshot({ path: info.outputPath("model-switch-mobile.png"), fullPage: true });

    await page.getByTestId("chat-input").fill("再问一次");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-model")).toHaveCount(2);
    await expect(page.getByTestId("chat-model").nth(1)).toContainText("claude-opus-5-5");
    // 没换模型就不报警
    await expect(page.getByTestId("chat-model-notice")).toHaveCount(1);
  });

  test("知识库内没有相关页面的真实拒答不会显示无引用警告", async ({ page }, info) => {
    const answer = "知识库内没有任何页面涉及 profiling_chunk_config，无法比较两个版本的配置解析行为。";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/wiki/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse([
          ["knowledge", { revision: "a".repeat(64), sessionId: "s-1", online: true }],
          ["text", { text: answer }],
          ["cite", checkAnswerCitations(answer, [])],
          [
            "notice",
            {
              kind: "offline-claim",
              message:
                "服务端本轮已提供联网工具（WebFetch / WebSearch），模型没有用就说无法联网；这条回答没有经过联网核对。",
            },
          ],
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
    // 2026-09-23：读者要看得到这一轮有没有联网工具，以及模型说「联不了网」却没用工具的情况
    await expect(page.getByTestId("chat-online")).toContainText("本轮可联网");
    await expect(page.getByTestId("chat-tool-notice")).toContainText("已提供联网工具");
    // F001 AC7：不报警，但要标成未收录，不能看起来像知识库结论
    await expect(page.getByTestId("chat-uncovered")).toContainText("未收录");
    await page.screenshot({ path: info.outputPath("honest-abstention-mobile.png"), fullPage: true });
  });

  test("贴报错时显示 GitHub 在线候选与本地版本核对；搜索失败时如实说失败（F003 AC4 聊天层接入）", async ({
    page,
  }, info) => {
    const REPO = "vllm-project/vllm-ascend";
    const trace = {
      status: "done",
      scope: {
        repos: [REPO, "vllm-project/vllm"],
        since: "2025-09-23",
        terms: ["RuntimeError collective failed"],
      },
      candidates: [
        {
          repo: REPO,
          number: 15815,
          kind: "issue",
          url: `https://github.com/${REPO}/issues/15815`,
          title: "RuntimeError: collective failed on 8 cards",
          state: "closed",
          updatedAt: "2026-09-12T00:00:00Z",
          matchedQueries: 2,
          linkedPrs: [
            {
              number: 15981,
              url: `https://github.com/${REPO}/pull/15981`,
              basis: "GitHub cross-referenced 事件；不是修复证明",
              versions: {
                status: "found",
                commit: "a".repeat(40),
                pins: [
                  { ref: "main", commit: "b".repeat(40), contains: true },
                  {
                    ref: "releases/v0.23.0",
                    commit: "c".repeat(40),
                    contains: false,
                    sameNumberCommit: "d".repeat(40),
                  },
                  { ref: "releases/v0.26.0rc", commit: "e".repeat(40), contains: false },
                ],
                tags: ["v0.27.0rc1"],
                moreTags: 0,
              },
            },
          ],
        },
      ],
      omitted: 0,
      complete: true,
      problems: [],
      requests: 4,
      cacheHits: 0,
    };
    let failed = false;
    await page.route("**/api/wiki/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: sse(
          failed
            ? [
                ["trace", { status: "searching" }],
                ["trace", { status: "failed", reason: "GitHub rate-limit (403)" }],
                ["text", { text: "在线搜索暂时失败。" }],
                ["cite", { cited: false, selfDeclaredUncovered: true }],
                ["done", {}],
              ]
            : [
                ["trace", { status: "searching" }],
                ["trace", trace],
                ["text", { text: "社区里有人报过同样的错。" }],
                ["cite", { cited: false, selfDeclaredUncovered: true }],
                ["done", {}],
              ],
        ),
      }),
    );
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByTestId("chat-input").fill("RuntimeError: collective failed on 8 cards");
    await page.getByTestId("chat-send").click();

    const found = page.getByTestId("chat-trace");
    await expect(found).toContainText("GitHub 上的相关讨论");
    await expect(found).toContainText("不是已确认的修复");
    await expect(found.getByRole("link", { name: /vllm-ascend issue #15815/ })).toHaveAttribute(
      "href",
      `https://github.com/${REPO}/issues/15815`,
    );
    await expect(found.getByRole("link", { name: /PR #15981/ })).toHaveAttribute(
      "href",
      `https://github.com/${REPO}/pull/15981`,
    );
    await expect(found).toContainText("main 含");
    await expect(found).toContainText("v0.23.0 不含原提交，有同号提交");
    await expect(found).toContainText("v0.26.0rc 不含");
    await expect(found).toContainText("v0.27.0rc1");
    await page.getByTestId("chat-log").screenshot({ path: info.outputPath("github-trace.png") });

    failed = true;
    await page.getByTestId("chat-input").fill("RuntimeError: collective failed");
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-trace-status").last()).toContainText("在线搜索失败");
    await expect(page.getByTestId("chat-trace-status").last()).toContainText("rate-limit");
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
    models: {
      workModel: "claude-opus-5-5[1m]",
      recorded: 9,
      switched: 8,
      last: {
        at: "2026-09-23T03:26:42Z",
        purpose: "chat",
        event: "model_refusal_fallback",
        from: "claude-opus-5-5[1m]",
        to: "claude-opus-5",
        reason: "frontier_llm",
      },
    },
    pages: { concepts: 38, params: 19, sources: 0 },
    todo: {
      pendingReviews: 0,
      missingTerms: ["token", "softmax"],
      totalTerms: 30,
      gaps: 2,
      mergedGaps: 1,
      queuedTasks: 0,
    },
  });

  test("把预算、夜间维护和会不会自己花钱摆到明面上，打开状态不自动写入", async ({ page }, info) => {
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
    await expect(pane).toContainText("其中 1 条合并了不同说法");
    // 2026-09-23：拒答换模型要在这里看得到，夜间无人值守的调用只能从这里查
    await expect(pane).toContainText("CLI 默认（没有固定）");
    await expect(pane).toContainText("问答、编译、导入整合、后台模型任务");
    await expect(pane).not.toContainText("仍使用 Claude");
    await expect(pane).toContainText("8 / 9 次");
    await expect(pane).toContainText("claude-opus-5-5[1m] → claude-opus-5（frontier_llm）");
    await page.screenshot({ path: info.outputPath("status-models.png"), fullPage: true });
    await expect(pane.getByRole("button", { name: "保存选择" })).toBeDisabled();
    expect(writes).toEqual([]);
  });

  test("状态内选择接入和模型，显式保存后持久化，错误不会假报成功", async ({ page }) => {
    const saved = status();
    Object.assign(saved.models, { chatProvider: "claude", chatModel: "claude-opus-5-5" });
    const writes: unknown[] = [];
    let fail = false;
    await page.route("**/api/wiki/status", (route) => route.fulfill({ json: saved }));
    await page.route("**/api/wiki/status/model", (route) => {
      const input = route.request().postDataJSON();
      writes.push(input);
      if (fail) return route.fulfill({ status: 503, json: { error: "配置暂时无法保存" } });
      Object.assign(saved.models, input);
      return route.fulfill({ json: input });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "状态" }).click();
    const pane = page.getByTestId("status-pane");
    await pane.getByRole("combobox", { name: "接入方式", exact: true }).selectOption("codex");
    await pane.getByRole("combobox", { name: "模型", exact: true }).selectOption("gpt-6-astra");
    expect(writes).toEqual([]);
    await pane.getByRole("button", { name: "保存选择" }).click();
    await expect(pane.getByRole("status")).toContainText("已保存，后续所有模型任务生效");
    expect(writes).toEqual([{ chatProvider: "codex", chatModel: "gpt-6-astra" }]);
    await page.reload();
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "状态" }).click();
    await expect(pane.getByRole("combobox", { name: "模型", exact: true })).toHaveValue("gpt-6-astra");
    await pane.getByRole("combobox", { name: "模型", exact: true }).selectOption("custom");
    await pane.getByLabel("自定义模型名").fill("gpt-custom");
    fail = true;
    await pane.getByRole("button", { name: "保存选择" }).click();
    await expect(pane.getByRole("alert")).toContainText("配置暂时无法保存");
    await expect(pane.getByRole("status")).toHaveCount(0);
    fail = false;
    await pane.getByRole("button", { name: "保存选择" }).click();
    await expect(pane.getByRole("status")).toContainText("已保存");
    await expect(pane.getByLabel("自定义模型名")).toHaveValue("gpt-custom");
  });

  test("预算暂停时说清楚问答用不了和原因", async ({ page }) => {
    await page.route("**/api/wiki/status", (route) => route.fulfill({ json: status({ paused: true }) }));
    await page.goto("/#/wiki");
    await page.getByTestId("chat-open").click();
    await page.getByRole("tab", { name: "状态" }).click();
    await expect(page.getByTestId("status-pane")).toContainText("已暂停，问答用不了（2026-09-16 费用未知");
  });
});

/**
 * P3 最终桌面验收（2026-09-27）发现的问题，每条一个回归测试。只测桌面宽度。
 */
test.describe("P3 最终验收：桌面", () => {
  const open = async (page: import("@playwright/test").Page, id: string, width = 1440) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/#/wiki/${id}`);
    await page.getByTestId("wiki-body").waitFor();
    await page.evaluate(() => document.fonts.ready);
  };

  test("算式块：冒号旧写法的第一步不被吞进标签；结果后的说明文字不进结果栏", async ({ page }) => {
    await page.goto("/#/dev/wiki-specimen");
    const row = page.locator(".wiki-calc-row").filter({
      has: page.locator(".wiki-calc-label", { hasText: /^N 的第 2 步$/ }),
    });
    await expect(row).toHaveCount(1);
    await expect(row.locator(".wiki-calc-expr")).toHaveText("ceil(6003 / 640) + 14 = 10 + 14");
    await expect(row.locator(".wiki-calc-result")).toHaveText("24 块");
    await expect(page.locator(".wiki-calc-label", { hasText: "ceil(" })).toHaveCount(0);

    await open(page, "glm-5-3-flash-two-node");
    const kv = page.locator(".wiki-calc-row").filter({
      has: page.locator(".wiki-calc-label", { hasText: "减激活峰值与非 torch 占用" }),
    });
    await expect(kv.locator(".wiki-calc-result")).toHaveText("30.00 GiB");
    await expect(kv.locator(".wiki-calc-note")).toHaveText("可用于 KV");
  });

  test("同一页的算式块标签栏一样宽：各块算式栏的起点对齐", async ({ page }) => {
    for (const width of [1440, 1920]) {
      await open(page, "glm-5-3-flash-two-node", width);
      const lefts = await page
        .locator("[data-testid=wiki-body] .wiki-calc-expr")
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
      expect(lefts.length).toBeGreaterThan(8);
      expect(Math.max(...lefts) - Math.min(...lefts), `${width}：${lefts.join(",")}`).toBeLessThanOrEqual(1);
    }
  });

  test("「接着看」里的链接落到新页面顶部，和正文链接一样", async ({ page }) => {
    await open(page, "glm-5-3-flash");
    const link = page.getByTestId("wiki-next").locator('a[href="#/wiki/learning-guide"]').first();
    await link.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
    await link.click();
    await expect(page).toHaveURL(/#\/wiki\/learning-guide$/);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(2);
    // 后退仍回到离开时的位置（ScrollRestoration 的 POP）
    await page.goBack();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
  });

  for (const width of [1280, 1440, 1920]) {
    test(`${width} 宽：右下角的「问知识库」「本页目录」按钮不压正文栏`, async ({ page }) => {
      await open(page, "glm-5-3-flash-two-node", width);
      const article = await page.locator("article.wiki-article").boundingBox();
      const right = (article?.x ?? 0) + (article?.width ?? 0);
      const fabs = [page.getByTestId("chat-open"), page.locator(".wiki-pagetoc-fab")];
      let seen = 0;
      for (const fab of fabs) {
        if (!(await fab.isVisible())) continue;
        seen++;
        const box = await fab.boundingBox();
        expect(
          box?.x ?? 0,
          `${width} 宽下按钮左边缘 ${box?.x}，正文栏右边缘 ${right}`,
        ).toBeGreaterThanOrEqual(right + 4);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      }
      expect(seen).toBeGreaterThan(0);
      // 宽屏的右侧本页目录也不被按钮压住
      const side = page.getByTestId("pagetoc-side");
      if (await side.isVisible()) {
        const s = await side.boundingBox();
        const chat = await page.getByTestId("chat-open").boundingBox();
        expect(chat?.x ?? 0).toBeGreaterThanOrEqual((s?.x ?? 0) + (s?.width ?? 0));
      }
      // 按钮缩成图标时名字还在，读屏和测试都按名字找得到
      await expect(page.getByRole("button", { name: "问知识库" })).toBeVisible();
    });
  }

  test("表格首列的短标签不折行，长标签不被挤成一字一行", async ({ page }) => {
    const heightOf = (texts: string[]) =>
      page.evaluate((wanted) => {
        const out: Record<string, number> = {};
        for (const td of document.querySelectorAll<HTMLElement>("[data-testid=wiki-body] td:first-child")) {
          const t = (td.textContent ?? "").trim();
          if (!wanted.includes(t)) continue;
          const range = document.createRange();
          range.selectNodeContents(td);
          out[t] = Math.round(range.getBoundingClientRect().height);
        }
        return out;
      }, texts);
    await open(page, "glm-5-3-flash");
    const short = await heightOf([
      "router 打分",
      "Q、K、V 投影",
      "residual 流",
      "attention 层型",
      "8 位数的格式",
    ]);
    expect(Object.keys(short).length).toBe(5);
    for (const [t, h] of Object.entries(short)) expect(h, t).toBeLessThan(30);

    await open(page, "learning-guide");
    const groups = await heightOf(["模型结构与计算", "vLLM 与 Ascend 架构", "Ascend 硬件与软件栈"]);
    expect(Object.keys(groups).length).toBe(3);
    for (const [t, h] of Object.entries(groups)) expect(h, t).toBeLessThan(30);

    await open(page, "glm-5-3-flash-two-node");
    const long = await heightOf(["TP（tensor parallel）", "PP（pipeline parallel，流水线并行）"]);
    expect(Object.keys(long).length).toBe(2);
    for (const [t, h] of Object.entries(long)) expect(h, t).toBeLessThan(50);
    // 长标签折行也只在空格、标点处折：中文词不被拆成「张量并 / 行」
    const split = await page.evaluate(() => {
      const out: string[] = [];
      for (const td of document.querySelectorAll<HTMLElement>("[data-testid=wiki-body] td:first-child")) {
        const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (const m of (n.textContent ?? "").matchAll(/[一-鿿]{2,}/g)) {
            const range = document.createRange();
            range.setStart(n, m.index);
            range.setEnd(n, m.index + m[0].length);
            const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
            if (tops.size > 1) out.push(m[0]);
          }
        }
      }
      return out;
    });
    expect(split).toEqual([]);
  });

  test("短的算式形行内代码整段不断行", async ({ page }) => {
    for (const id of ["one-request", "concurrent-requests", "learning-guide", "glm-5-3-flash"]) {
      await open(page, id);
      const split = await page
        .locator("[data-testid=wiki-body] :not(pre) > code")
        .evaluateAll((els) =>
          els
            .filter((el) => [...(el.textContent ?? "")].length < 20 && el.getClientRects().length > 1)
            .map((el) => el.textContent),
        );
      expect(split, id).toEqual([]);
    }
  });
});

test.describe("P4 最终验收：桌面", () => {
  const PAGES = [
    "learning-guide",
    "glm-5-3-flash",
    "glm-5-3-flash-two-node",
    "one-request",
    "concurrent-requests",
    "request-call-chain",
    "tensor-parallel",
    "expert-parallel",
  ];
  const open = async (page: import("@playwright/test").Page, id: string, width = 1440) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/#/wiki/${id}`);
    await page.getByTestId("wiki-body").waitFor();
    await page.evaluate(() => document.fonts.ready);
  };

  test("行内代码里的标识符放得进一行就整个不断；参数连同取值不拆；页面不横滚", async ({ page }) => {
    for (const id of PAGES) {
      await open(page, id);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        for (const code of document.querySelectorAll<HTMLElement>(
          "[data-testid=wiki-body] :not(pre) > code",
        )) {
          const text = code.textContent ?? "";
          const tops = (rects: DOMRectList | DOMRect[]) =>
            new Set([...rects].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
          // 整段不超过 30 个字符的（`--data-parallel-size-local 1`）连空格处也不断
          if ([...text].length <= 30 && tops(code.getClientRects()) > 1) out.push(`整段断开：${text}`);
          // 逐个标识符：不超过 40 个字符的不断；更长的在正文里放得进一行也不断
          const nodes: Text[] = [];
          const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
          const starts: number[] = [];
          let all = "";
          for (const n of nodes) {
            starts.push(all.length);
            all += n.data;
          }
          const at = (i: number): [Text, number] => {
            let k = starts.length - 1;
            while (starts[k] > i) k--;
            return [nodes[k], i - starts[k]];
          };
          const block = code.closest("td, th, p, li, blockquote, dd") as HTMLElement;
          const inTable = block.matches("td, th");
          for (const m of all.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(...at(m.index));
            range.setEnd(...at(m.index + m[0].length - 1));
            range.setEnd(range.endContainer, range.endOffset + 1);
            if (tops(range.getClientRects()) <= 1) continue;
            const long = [...m[0]].length > 40;
            const width = [...range.getClientRects()].reduce((s, r) => s + r.width, 0);
            if (!long || (!inTable && width <= block.clientWidth)) out.push(`标识符断开：${m[0]}`);
          }
        }
        return out;
      });
      expect(bad, id).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${id} 页面横滚`).toBeLessThanOrEqual(0);
    }
  });

  test("表格单元格末行不剩单个字；首列标签一行排完；表格不超出正文栏", async ({ page }) => {
    for (const id of PAGES) {
      await open(page, id);
      const result = await page.evaluate(() => {
        const orphans: string[] = [];
        const body = document.querySelector("[data-testid=wiki-body]") as HTMLElement;
        body.querySelectorAll("table").forEach((table, ti) => {
          for (const td of table.querySelectorAll<HTMLElement>("td")) {
            const chars: { c: string; mid: number }[] = [];
            const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              // 证据角标不是字，只数正文
              if (n.parentElement?.closest(".wiki-evidence")) continue;
              const s = n.textContent ?? "";
              for (let i = 0; i < s.length; i++) {
                if (/\s/.test(s[i])) continue;
                const range = document.createRange();
                range.setStart(n, i);
                range.setEnd(n, i + 1);
                const r = range.getClientRects()[0];
                if (r) chars.push({ c: s[i], mid: r.top + r.height / 2 });
              }
            }
            if (chars.length < 2) continue;
            const last = Math.max(...chars.map((x) => x.mid));
            const first = Math.min(...chars.map((x) => x.mid));
            if (last - first < 8) continue;
            const tail = chars.filter((x) => last - x.mid < 8).map((x) => x.c);
            if (tail.length <= 1)
              orphans.push(
                `表 ${ti + 1} 第 ${td.cellIndex + 1} 列末行只剩「${tail.join("")}」：${td.textContent}`,
              );
          }
        });
        const overflow = [...body.querySelectorAll<HTMLElement>(".wiki-table-scroll")]
          .map((s, i) => ({ i: i + 1, over: s.scrollWidth - s.clientWidth }))
          .filter((x) => x.over > 0)
          .map((x) => `表 ${x.i} 超出 ${x.over}px`);
        return { orphans, overflow };
      });
      expect(result.orphans, id).toEqual([]);
      expect(result.overflow, id).toEqual([]);
    }
    await open(page, "tensor-parallel");
    const label = page.locator("[data-testid=wiki-body] td:first-child", {
      hasText: "总 attention 头数不能被 TP 整除",
    });
    await expect(label).toHaveCount(1);
    const lines = await label.evaluate((td) => {
      const range = document.createRange();
      range.selectNodeContents(td);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(lines).toBe(1);
  });

  test("纯文本块按字符格对齐：汉字占两个半角字宽，作者用空格排的每一列都落在该落的位置", async ({ page }) => {
    await page.goto("/#/dev/wiki-specimen");
    const blocks = page.locator('[data-specimen="plain-text"] pre > code.language-text');
    await expect(blocks).toHaveCount(7);
    await page.evaluate(() => document.fonts.ready);
    const off = await blocks.evaluateAll((codes) => {
      // 东亚宽字符（与 markdown.ts 的 WIDE_CHAR 同一组码位）占两个半角格
      const WIDE: [number, number][] = [
        [0x1100, 0x115f],
        [0x2e80, 0x303e],
        [0x3041, 0x33ff],
        [0x3400, 0x4dbf],
        [0x4e00, 0x9fff],
        [0xa000, 0xa4cf],
        [0xac00, 0xd7a3],
        [0xf900, 0xfaff],
        [0xfe30, 0xfe4f],
        [0xff00, 0xff60],
        [0xffe0, 0xffe6],
        [0x20000, 0x3fffd],
      ];
      const isWide = (c: string) => {
        const u = c.codePointAt(0) ?? 0;
        return WIDE.some(([a, b]) => u >= a && u <= b);
      };
      const out: string[] = [];
      for (const code of codes) {
        const pre = code.parentElement as HTMLElement;
        const cs = getComputedStyle(pre);
        const origin =
          pre.getBoundingClientRect().left +
          Number.parseFloat(cs.borderLeftWidth) +
          Number.parseFloat(cs.paddingLeft) -
          pre.scrollLeft;
        const chars: { n: Text; i: number; c: string }[] = [];
        const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n as Text;
          for (let i = 0; i < t.data.length; i++) chars.push({ n: t, i, c: t.data[i] });
        }
        const rectOf = (x: { n: Text; i: number }) => {
          const range = document.createRange();
          range.setStart(x.n, x.i);
          range.setEnd(x.n, x.i + 1);
          return range.getBoundingClientRect();
        };
        const ascii = chars.find((x) => /[!-~]/.test(x.c));
        const ch = ascii ? rectOf(ascii).width : 0;
        // 每个字的中线要落在它那一格（汉字两格）的中线上。
        // 容差 2px：格宽按 Chromium 的 1/64px 取整（1ch = 7.796875 而不是 7.8），一行上百格累计约 1.4px；
        // 错一格是 7.8px，修之前汉字每个少 0.2em，一行下来差到 13px 以上
        let col = 0;
        let line = "";
        for (const x of chars) {
          if (x.c === "\n") {
            col = 0;
            line = "";
            continue;
          }
          line += x.c;
          const w = isWide(x.c) ? 2 : 1;
          if (x.c !== " ") {
            const r = rectOf(x);
            const diff = (r.left + r.right) / 2 - (origin + (col + w / 2) * ch);
            if (Math.abs(diff) > 2) out.push(`「${line}」第 ${col} 格偏 ${diff.toFixed(1)}px`);
          }
          col += w;
        }
      }
      return out;
    });
    expect(off.slice(0, 10)).toEqual([]);
  });
});
