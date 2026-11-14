import { expect, test } from "@playwright/test";
import { openLocalScene } from "./chapter03-local-scene";

test("第三章默认视角的数据流沿同一阅读基线排列 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const part = page.locator('[data-layer-scene="ffn"]');
  await part.locator(".layer-scene").scrollIntoViewIfNeeded();
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  for (const progress of [0, 0.35, 0.65, 0.9, 1]) {
    await part.getByRole("slider").fill(String(progress));
    await expect(async () => {
      const titles = await part
        .locator(".layer-label strong")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => /更新后的|支路输入|中间表示|ReLU 后|前馈 ΔF/.test(node.textContent ?? ""))
            .map((node) => node.getBoundingClientRect().top),
        );
      expect(titles).toHaveLength(5);
      expect(Math.max(...titles) - Math.min(...titles)).toBeLessThan(14);
    }).toPass({ timeout: 2000 });
  }
});

test("整列投影的八组读数各占一行 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const part = page.locator('[data-layer-scene="ffn"]');
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  await part.getByRole("slider").fill("0.35");
  const rows = await part.locator(".projection-input:visible").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }),
  );
  expect(rows).toHaveLength(8);
  for (let i = 1; i < rows.length; i++) expect(rows[i]!.top).toBeGreaterThan(rows[i - 1]!.bottom + 1);
});

test("选列同步且核对范围跟随实际运算 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/chapters/03#ffn");
  await openLocalScene(page, "ffn");
  const ffn = page.locator('[data-layer-scene="ffn"]');
  await expect(ffn.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  await ffn.getByText("沿同一份数据核对数值", { exact: true }).click();
  await ffn.getByRole("combobox", { name: "核对位置" }).selectOption("3");
  await ffn.getByRole("slider").fill("0.35");
  await expect(ffn.locator(".projection-title")).toContainText("花儿");
  await ffn.getByRole("slider").fill("0.65");
  const dimension = ffn.getByRole("spinbutton", { name: "核对维度" });
  await expect(dimension).toHaveAttribute("max", "8192");
  await dimension.fill("8192");
  await expect(dimension).toHaveValue("8192");
  await expect(ffn.locator(".layer-numbers")).toContainText("H 的第 8192 维");
  await expect(ffn.locator(".layer-numbers")).not.toContainText("NaN");
  await ffn.getByRole("slider").fill("0.85");
  await expect(dimension).toHaveValue("4096");
  await expect(dimension).toHaveAttribute("max", "4096");
  await expect(ffn.locator(".layer-numbers")).toContainText("8,192 个数");
  await openLocalScene(page, "residual-attn");
  const residual = page.locator('[data-layer-scene="residual-attn"]');
  await residual.scrollIntoViewIfNeeded();
  await residual.getByText("沿同一份数据核对数值", { exact: true }).click();
  await residual.getByRole("combobox", { name: "核对位置" }).selectOption("3");
  await expect(residual.locator('.relation-wide .relation-matrix[data-selected-column="3"]')).toHaveCount(3);
  await expect(residual.locator(".residual-relation p")).toContainText("花儿");
  await openLocalScene(page, "attention");
  const attention = page.locator('[data-layer-scene="attention"]');
  await attention.scrollIntoViewIfNeeded();
  await attention.getByText("沿同一份数据核对数值", { exact: true }).click();
  await attention.getByRole("slider").fill("0.45");
  await expect(attention.getByRole("spinbutton")).toHaveAttribute("max", "8");
  await expect(attention.locator(".layer-numbers")).toContainText("汇总列的第");
  await expect(attention.locator(".layer-numbers")).not.toContainText("ΔA");
  await attention.getByRole("slider").fill("0.8");
  await expect(attention.getByRole("spinbutton")).toHaveAttribute("max", "4096");
  await expect(attention.locator(".component-sums > div")).toHaveCount(8);
  await expect(attention.locator(".layer-numbers")).toContainText("输入整列的 8 个数");
  await expect(attention.locator(".layer-numbers")).not.toContainText("NaN");
});

test("二维图界定当前组件，矩阵细节由对应三维图展开 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/chapters/03");
  await openLocalScene(page, "attention");
  await openLocalScene(page, "ffn");
  await openLocalScene(page, "residual-attn");
  await expect(page.locator(".layer-map")).toHaveCount(1);
  await expect(page.locator(".component-map")).toHaveCount(2);
  await expect(page.locator(".residual-relation")).toHaveCount(1);
  await expect(page.locator('[data-component="ffn"] .component-context-focus small')).toContainText(
    "本图展开 FFN",
  );
  await expect(page.locator('[data-component="ffn"] .component-reading-note')).toContainText(
    "下方 3D 还会演示入口的第二次归一化",
  );
  await expect(page.locator(".attention-structure-note")).toContainText("这些比例作用在对应位置的 V 上");
  await expect(page.locator(".ffn-relation, .value-projection-relation, .activation-relation")).toHaveCount(
    0,
  );
  for (const figure of await page.locator(".component-map").all()) {
    await figure.scrollIntoViewIfNeeded();
    const boxes = await figure.locator("svg text").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: node.textContent };
      }),
    );
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
          `${a.text} / ${b.text}`,
        ).toBe(true);
  }
  await openLocalScene(page, "ffn");
  const ffn = page.locator('[data-layer-scene="ffn"]');
  await ffn.locator(".layer-scene").scrollIntoViewIfNeeded();
  await expect(ffn.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
  await ffn.getByRole("slider").fill("0.35");
  await expect(ffn.locator('.layer-label[data-active="true"]')).toHaveCount(3);
  await expect(ffn.locator(".layer-label small")).toHaveCount(0);
});

test("组件图、整列投影与数值核对使用同一阶段和同一组乘积 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/#/chapters/03#ffn");
  for (const kind of ["ffn", "attention"]) {
    await openLocalScene(page, kind);
    const part = page.locator(`[data-layer-scene="${kind}"]`);
    await part.scrollIntoViewIfNeeded();
    await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled();
    await part.getByText("沿同一份数据核对数值", { exact: true }).click();
    await part.getByRole("combobox", { name: "核对位置" }).selectOption("3");
    for (const [progress, output, operation] of kind === "ffn"
      ? ([
          [0.355, "H", "× W₁"],
          [0.855, "ΔF", "× W₂"],
        ] as const)
      : ([[0.866, "ΔA", "× Wₒ"]] as const)) {
      await part.getByRole("slider").fill(String(progress));
      await part.getByRole("spinbutton").fill("1024");
      const readout = part.locator(".component-calculation");
      await expect(readout).toHaveAttribute("data-output", output);
      await expect(readout).toHaveAttribute("data-dimension", "1024");
      await expect(readout).toContainText("花儿");
      const sums = (await readout.locator(".component-sums span").allTextContents()).map(Number);
      expect(sums).toHaveLength(8);
      if (kind === "attention") {
        await expect(part.locator(".layer-column-status")).toContainText("第 1024 维");
        await expect(part.locator(".layer-column-status")).toHaveAttribute("data-arrived", "8");
        const rendered = Number(await part.locator(".layer-column-status").getAttribute("data-value"));
        expect(rendered).toBeCloseTo(Number(await readout.getAttribute("data-value")), 5);
        await expect(part.locator(".attention-products tbody tr")).toHaveCount(8);
      } else {
        await expect(part.locator('.component-operation[data-active="true"]')).toHaveText(operation);
        await expect(part.locator(".projection-title")).toContainText("第 1024 维");
        const projected = (
          await part.locator(".projection-equation > span:last-child").allTextContents()
        ).map(Number);
        expect(projected).toHaveLength(8);
        for (let i = 0; i < 8; i++) expect(sums[i]!).toBeCloseTo(projected[i]!, 3);
      }
      expect(sums.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
        Number(await readout.getAttribute("data-value")),
        2,
      );
    }
    if (kind === "attention") {
      for (const [progress, output] of [
        [0, "内容 V"],
        [0.3, "加权内容"],
        [0.45, "汇总内容"],
      ] as const) {
        await part.getByRole("slider").fill(String(progress));
        await expect(part.locator(".component-calculation")).toHaveAttribute("data-output", output);
        if (progress < 0.4) await expect(part.locator(".component-contributions > div")).toHaveCount(4);
      }
    }
  }
});
