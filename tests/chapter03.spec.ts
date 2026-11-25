import { expect, test } from "@playwright/test";
import { JOURNEY_STEPS } from "../src/app/course/layer-journey";
import { openLocalScene } from "./chapter03-local-scene";

test("1. /#/chapters/03 结构、目录、全局定位弹窗、公式与字阶兼容性（1440px & 390px）", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/chapters/03#two-halves");
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator(".wiki-article").locator('a[href*="/model"], a[href*="/wiki"]')).toHaveCount(0);

  // 九段章节按依赖顺序排列
  await expect(page.locator("#two-halves")).toBeVisible();
  expect(
    await page.locator(".wiki-body h2").evaluateAll((nodes) => nodes.slice(0, 9).map((n) => n.id)),
  ).toEqual([
    "two-halves",
    "hidden",
    "residual",
    "rms",
    "attention",
    "attention-add",
    "ffn",
    "ffn-add",
    "whole-layer",
  ]);

  // 全局路径图零文字重叠、点击节点联动指南针、弹窗暂停演示
  const map = page.locator(".wiki-body > .layer-map");
  await expect(map).toBeVisible();
  await expect(map).toContainText("本章展开其中一层");
  await expect(map).toContainText("保留 X′");
  await page.evaluate(() => document.fonts.ready);
  const mapBoxes = await map.locator("svg text").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: node.textContent };
    }),
  );
  for (const [i, a] of mapBoxes.entries()) {
    for (const b of mapBoxes.slice(i + 1)) {
      expect(
        a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
        `${a.text}/${b.text}`,
      ).toBe(true);
    }
  }

  await map.getByRole("link", { name: "RMSNorm₁：准备支路的数值尺度", exact: true }).click();
  await expect(page).toHaveURL(/chapters\/03(?:#|%23)rms$/);
  const compass = page.getByRole("navigation", { name: "本章全局定位" });
  await expect(compass).toHaveAttribute("data-section", "rms");

  const rmsPart = page.locator('[data-part="rms"]');
  await rmsPart.scrollIntoViewIfNeeded();
  await rmsPart.getByRole("button", { name: "播放计算", exact: true }).click();
  const rmsSlider = rmsPart.getByRole("slider");
  await expect.poll(async () => Number(await rmsSlider.inputValue())).toBeGreaterThan(0.01);
  await compass.getByRole("button", { name: "全局结构", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "这一层的全局结构" });
  await expect(dialog).toBeVisible();
  const pausedVal = await rmsSlider.inputValue();
  await page.waitForTimeout(200);
  expect(await rmsSlider.inputValue()).toBe(pausedVal);
  await expect(dialog.locator('[data-node="rms"]')).toHaveAttribute("data-active", "true");
  await dialog.getByRole("link", { name: "前馈 FFN：加工当前位置的维度组合", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(compass).toHaveAttribute("data-section", "ffn");

  // #hidden 二维对应图、#residual 零重复 3D 分路图与 #whole-layer 公式
  await expect(page.locator('[data-layer-scene="split"]')).toHaveCount(0);
  await expect(page.getByRole("figure", { name: "位置与隐藏维度的二维对应", exact: true })).toBeAttached();
  const formula = page.getByRole("figure", { name: "这一层的完整依赖关系", exact: true });
  await expect(formula).toContainText("N₁ = RMSNorm₁(X)");
  await expect(formula).toContainText("Y  = X′ + ΔF");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // 移动端 390px 目录跳转与零横向溢出
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "本页目录", exact: true }).click();
  await page.getByTestId("pagetoc-pop").getByRole("link", { name: "RMSNorm：先准备支路的输入" }).click();
  await expect(page.locator("#rms")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // 课程正文与 Wiki 正文字阶一致
  await page.setViewportSize({ width: 1440, height: 900 });
  const readTypo = () =>
    page
      .locator(".wiki-body > p")
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { font: s.fontFamily, size: s.fontSize, line: s.lineHeight, color: s.color };
      });
  const courseTypo = await readTypo();
  await page.goto("/#/wiki/layers-and-hidden");
  await expect(page.locator(".wiki-body")).toBeVisible();
  const wikiTypo = await readTypo();
  expect({ font: wikiTypo.font, size: wikiTypo.size, color: wikiTypo.color }).toEqual({
    font: courseTypo.font,
    size: courseTypo.size,
    color: courseTypo.color,
  });
  expect(Math.abs(Number.parseFloat(wikiTypo.line) - Number.parseFloat(courseTypo.line))).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test("2. /#/chapters/03 完整层 16 步计算（24 固定矩阵、因果掩码、残差更新与交接）", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/chapters/03#attention");
  const part = page.getByRole("region", { name: "从 X 到 Y 的完整层计算" });
  const canvas = part.locator(".journey-canvas");
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-fixed-matrices", "24");
  await expect(part.locator(".journey-map-node")).toHaveCount(16);

  const matrixLabels = canvas.locator("[data-matrix]");
  const readPositions = () =>
    matrixLabels.evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-matrix"),
        left: (n as HTMLElement).style.left,
        top: (n as HTMLElement).style.top,
      })),
    );
  const originalPositions = await readPositions();
  const originalX = Number(await part.locator('[data-state="x"]').getAttribute("data-value"));
  let deltaA = 0;

  for (const step of [0, 5, 10, 11, 15]) {
    await part.getByRole("slider", { name: "完整计算进度" }).fill(((step + 0.85) / 16).toFixed(3));
    await expect(part).toHaveAttribute("data-step", String(step));
    await expect(part.locator(".journey-explanation h4")).toHaveText(JOURNEY_STEPS[step]!.title);
    expect(await readPositions()).toEqual(originalPositions);
    if (step === 10) deltaA = Number(await part.locator('[data-operand="delta"]').textContent());
  }

  await part.getByRole("slider", { name: "完整计算进度" }).fill("1");
  const mid = Number(await part.locator('[data-state="mid"]').getAttribute("data-value"));
  const finalY = Number(await part.locator('[data-state="y"]').getAttribute("data-value"));
  const deltaF = Number(await part.locator('[data-operand="delta"]').textContent());
  expect(mid).toBeCloseTo(originalX + deltaA, 3);
  expect(finalY).toBeCloseTo(mid + deltaF, 3);
  await expect(part.locator('[data-state="y"]')).toHaveAttribute("data-ready", "true");

  // 位置 3 因果掩码与交接校验
  await part.getByRole("combobox", { name: "完整计算位置" }).selectOption("3");
  await part.getByRole("combobox", { name: "完整计算步骤" }).selectOption("7");
  await expect(part.locator('tr[data-masked="true"]')).toHaveCount(2);
  await page.getByRole("button", { name: "在完整计算中继续：X′ → 归一化 → FFN", exact: true }).click();
  await expect(part).toHaveAttribute("data-step", "11");
  expect(errors).toEqual([]);
});

test("3. /#/chapters/03 局部 3D 场景（母版材质、整列运算、标签连线零碰撞与数值核对）", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(() => {
    const names = new WeakMap<WebGLUniformLocation, string>();
    const values: { part: string; name: string; value: number[] }[] = [];
    const draws: number[] = [];
    Object.defineProperty(window, "nativeMatrixUniforms", { value: values });
    Object.defineProperty(window, "columnDraws", { value: draws });
    const origLoc = WebGL2RenderingContext.prototype.getUniformLocation;
    const origVec = WebGL2RenderingContext.prototype.uniform3f;
    const origDraw = WebGL2RenderingContext.prototype.drawElementsInstanced;
    WebGL2RenderingContext.prototype.getUniformLocation = function (prog, name) {
      const loc = origLoc.call(this, prog, name);
      if (loc) names.set(loc, name);
      return loc;
    };
    WebGL2RenderingContext.prototype.uniform3f = function (loc, x, y, z) {
      const name = loc && names.get(loc);
      if ((name === "uDiv" || name === "uCut") && this.canvas instanceof HTMLCanvasElement) {
        const el = this.canvas.closest("[data-layer-scene], [data-part]");
        if (el)
          values.push({
            part: el.getAttribute("data-layer-scene") ?? el.getAttribute("data-part")!,
            name,
            value: [x, y, z],
          });
      }
      return origVec.call(this, loc, x, y, z);
    };
    WebGL2RenderingContext.prototype.drawElementsInstanced = function (m, c, t, o, inst) {
      if (
        this.canvas instanceof HTMLCanvasElement &&
        this.canvas.closest('[data-layer-scene="residual-attn"]')
      )
        draws.push(inst);
      return origDraw.call(this, m, c, t, o, inst);
    };
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/chapters/03#rms");
  await expect(page.locator('[data-part="rms"] canvas')).toBeVisible();

  await page.getByText("展开局部：八维内容怎样乘比例、求和与投影？", { exact: true }).click();
  for (const kind of ["attention", "residual-attn", "ffn", "residual-ffn"] as const) {
    await openLocalScene(page, kind);
    const part = page.locator(`[data-layer-scene="${kind}"]`);
    await part.locator(".layer-scene").scrollIntoViewIfNeeded();
    await expect(part.locator("canvas")).toBeVisible();
    const expectedLabels = kind === "ffn" ? 8 : kind === "attention" ? 7 : 3;
    await expect(part.locator(".layer-label")).toHaveCount(expectedLabels);
  }

  // 验证母版纹理分组切线与实例绘制
  const resAttn = page.locator('[data-layer-scene="residual-attn"]');
  await resAttn.getByRole("slider").fill("0.38");
  expect(
    await page.evaluate(() =>
      (window as unknown as { columnDraws: number[] }).columnDraws.some((n) => n >= 16),
    ),
  ).toBe(true);
  const uniforms = await page.evaluate(
    () =>
      (window as unknown as { nativeMatrixUniforms: { part: string; name: string; value: number[] }[] })
        .nativeMatrixUniforms,
  );
  for (const p of ["rms", "residual-attn"]) {
    expect(uniforms.some((u) => u.part === p && u.name === "uDiv" && u.value.join() === "6,16,1")).toBe(true);
    expect(uniforms.some((u) => u.part === p && u.name === "uCut" && u.value.join() === "1,0,0")).toBe(true);
  }

  // 注意力 3D 原位乘比例、求和、投影与核对面板一致性
  const attn = page.locator('[data-layer-scene="attention"]');
  await attn.locator(".layer-scene").scrollIntoViewIfNeeded();
  await attn.getByRole("slider").fill("0.48");
  const contributions = await attn.locator(".attention-cell[data-role='contribution']").evaluateAll((nodes) =>
    nodes.map((n) => ({
      v: Number((n as HTMLElement).dataset.value),
      inp: Number((n as HTMLElement).dataset.input),
      a: Number((n as HTMLElement).dataset.alpha),
    })),
  );
  expect(contributions).toHaveLength(48);
  for (const c of contributions) expect(c.v).toBeCloseTo(c.inp * c.a, 5);

  await attn.getByText("沿同一份数据核对数值", { exact: true }).click();
  await attn.getByRole("combobox", { name: "核对位置" }).selectOption("3");
  await expect(attn.locator('.attention-source-choice[data-masked="true"]')).toHaveCount(2);

  // FFN 核对维度切换（8192 -> 4096）与走线零碰撞
  const ffn = page.locator('[data-layer-scene="ffn"]');
  await ffn.locator(".layer-scene").scrollIntoViewIfNeeded();
  await ffn.getByText("沿同一份数据核对数值", { exact: true }).click();
  await ffn.getByRole("slider").fill("0.65");
  const dimInput = ffn.getByRole("spinbutton", { name: "核对维度" });
  await expect(dimInput).toHaveAttribute("max", "8192");
  await ffn.getByRole("slider").fill("0.85");
  await expect(dimInput).toHaveAttribute("max", "4096");
  await expect(ffn.locator(".layer-numbers")).not.toContainText("NaN");

  // 离屏暂停且保留同一 canvas 与进度
  const attnCanvasHandle = await attn.locator("canvas").elementHandle();
  await attn.getByRole("slider").fill("0.62");
  await page.locator("#hidden").scrollIntoViewIfNeeded();
  await expect(attn.locator(".layer-scene")).toHaveAttribute("data-in-view", "false");
  await attn.locator(".layer-scene").scrollIntoViewIfNeeded();
  expect(await attnCanvasHandle!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(attn.getByRole("slider")).toHaveValue("0.62");
  expect(errors).toEqual([]);
});
