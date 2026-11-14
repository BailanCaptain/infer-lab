import { expect, type Locator, test } from "@playwright/test";
import { rmsProgress } from "../src/app/course/matrix-playback";

async function seekRms(part: Locator, phase: number, amount: number) {
  const slider = part.getByRole("slider");
  await slider.scrollIntoViewIfNeeded();
  const track = (await slider.boundingBox())!;
  const page = part.page();
  const current = Number(await slider.inputValue()) / 100;
  const target = rmsProgress(phase, amount);
  const x = (progress: number) => track.x + 5 + (track.width - 10) * progress;
  const y = track.y + track.height / 2;
  await page.mouse.move(x(current), y);
  await page.mouse.down();
  await page.mouse.move(x(target), y);
  await page.mouse.up();
  expect(Math.abs(Number(await slider.inputValue()) / 100 - target)).toBeLessThan(0.005);
}

test("RMS 未播放时隐藏计算零件，播放后出现，回到起点再次隐藏", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  const play = part.getByRole("button", { name: "播放计算", exact: true });
  await expect(play).toBeEnabled({ timeout: 60000 });
  const work = part.locator(".matrix-rms-work");
  await expect(work).toBeHidden();
  await play.click();
  await expect(work).toBeVisible();
  await part.getByRole("button", { name: "暂停计算", exact: true }).click();
  await expect(work).toBeVisible();
  await part.getByRole("slider").press("Home");
  await expect(work).toBeHidden();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-idle-${width}.png` });
  }
});

test("RMS 起点收起空计算区，输出明确标识待写入与已写入", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  const scene = part.locator(".matrix-part-canvas");
  const output = part.locator('[data-tensor="x_attn"]');
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled({ timeout: 60000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await part.getByRole("slider").press("Home");
    await expect
      .poll(async () => (await scene.boundingBox())!.height)
      .toBeLessThanOrEqual(width === 390 ? 300 : 440);
    await expect(output).toContainText("等待写入");
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-compact-${width}-idle.png` });
    await part.getByRole("button", { name: "播放计算", exact: true }).click();
    await expect.poll(async () => Number(await part.getByRole("slider").inputValue())).toBeGreaterThan(0);
    await part.getByRole("button", { name: "暂停计算", exact: true }).click();
    await expect.poll(async () => (await scene.boundingBox())!.height).toBe(width === 390 ? 480 : 700);
    await seekRms(part, 3, 0.5);
    await expect(output).toContainText("正在写入");
    await part.getByRole("slider").press("End");
    await expect(output).toContainText("本列已写入");
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-compact-${width}-complete.png` });
    await part.getByRole("slider").press("Home");
    await expect(output).toContainText("等待写入");
    await expect
      .poll(async () => (await scene.boundingBox())!.height)
      .toBeLessThanOrEqual(width === 390 ? 300 : 440);
  }
});

test("RMS 在三维图内演示带数值的相加，保留两个操作数和结果", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  const scene = part.locator(".matrix-part-canvas");
  const operands = scene.locator(".matrix-rms-operand");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (let round = 0; round < 4; round++) {
      await seekRms(part, 1, 0.15 * (round + 0.35));
      await expect(scene.locator(".matrix-rms-operator")).toHaveText("+");
      await expect(operands.nth(0)).toBeVisible();
      await expect(operands.nth(1)).toBeVisible();
      await expect(operands.nth(2)).toBeHidden();
      await part.screenshot({
        path: `tools/wiki-runtime/site-shell/rms-arithmetic-${width}-${round}-operands.png`,
      });
      await seekRms(part, 1, 0.15 * (round + 0.8));
      for (const operand of await operands.all()) await expect(operand).toBeVisible();
      const values = await operands.evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute("data-value"))),
      );
      expect(values[0]! + values[1]!).toBeCloseTo(values[2]!, 8);
      await part.screenshot({
        path: `tools/wiki-runtime/site-shell/rms-arithmetic-${width}-${round}-sum.png`,
      });
      const boxes = await scene
        .locator(".matrix-rms-operand, .matrix-rms-operation-title, .matrix-rms-note, .matrix-rms-operator")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => !(node as HTMLElement).hidden)
            .map((node) => {
              const { x, y, width, height } = node.getBoundingClientRect();
              return { x, y, width, height, text: node.textContent };
            }),
        );
      const bounds = (await scene.boundingBox())!;
      for (const [index, box] of boxes.entries()) {
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        for (const other of boxes.slice(index + 1))
          expect(
            box.x + box.width <= other.x ||
              other.x + other.width <= box.x ||
              box.y + box.height <= other.y ||
              other.y + other.height <= box.y,
            `${width}px round ${round}: ${JSON.stringify(box)} overlaps ${JSON.stringify(other)}`,
          ).toBe(true);
      }
    }
  }
});

test("RMS 连线保留完整来源关系，去掉字母标记并将数值放到下方", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await expect(part.getByRole("button", { name: "播放计算", exact: true })).toBeEnabled({ timeout: 60000 });
  const marks = part.locator(".matrix-rms-operand");
  await expect(part.locator(".matrix-rms-origin")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await part.getByRole("button", { name: "复位视角" }).click();
    await seekRms(part, 1, 0.15 * 0.35);
    await expect(marks.nth(0)).toBeVisible();
    await expect(marks.nth(1)).toBeVisible();
    await expect(part.locator(".matrix-rms-operand").nth(0)).toBeVisible();
    await expect(part.locator(".matrix-rms-operand").nth(1)).toBeVisible();
    await expect(part.locator(".matrix-rms-operand small").nth(0)).toHaveText("1–256 维");
    await expect(part.locator(".matrix-rms-operand small").nth(1)).toHaveText("257–512 维");
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-links-${width}-hold.png` });
    const canvas = part.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const before = (await marks.nth(0).boundingBox())!;
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.35);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.4, { steps: 10 });
    await page.mouse.up();
    const after = (await marks.nth(0).boundingBox())!;
    expect(Math.abs(before.x - after.x) + Math.abs(before.y - after.y)).toBeGreaterThan(3);
    const title = (await part.locator(".matrix-rms-operation-title").boundingBox())!;
    expect(title.x).toBeGreaterThanOrEqual(box.x);
    expect(title.x + title.width).toBeLessThanOrEqual(box.x + box.width);
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-links-${width}-rotated.png` });
    await part.getByRole("button", { name: "复位视角" }).click();
    await seekRms(part, 1, 0.15 * 0.08);
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-links-${width}-early.png` });
    await seekRms(part, 1, 0.15 * 0.16);
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-links-${width}-moving.png` });
    await seekRms(part, 1, 0.15 * 0.62);
    await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-links-${width}-merging.png` });
  }
});

test("RMS 拖动只旋转，保持投影比例并可复位", async ({ page }) => {
  await page.addInitScript(() => {
    const frames: Record<string, number[]> = {};
    Object.defineProperty(window, "rmsCamera", { value: frames });
    const names = new WeakMap<WebGLUniformLocation, string>();
    const locate = WebGL2RenderingContext.prototype.getUniformLocation;
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = locate.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const upload = WebGL2RenderingContext.prototype.uniformMatrix4fv;
    WebGL2RenderingContext.prototype.uniformMatrix4fv = function (location, transpose, values) {
      const name = location && names.get(location);
      if (
        (name === "projectionMatrix" || name === "viewMatrix") &&
        this.canvas instanceof HTMLCanvasElement &&
        this.canvas.closest('[data-part="rms"]')
      )
        frames[name] = Array.from(values);
      return upload.call(this, location, transpose, values);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  const camera = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            rmsCamera: Record<string, number[]>;
          }
        ).rmsCamera,
    );
  await expect.poll(async () => (await camera()).projectionMatrix?.length).toBe(16);
  const before = await camera();
  const box = (await part.locator("canvas").boundingBox())!;
  await part.screenshot({ path: "tools/wiki-runtime/site-shell/rms-camera-default.png" });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 40, { steps: 12 });
  await page.mouse.up();
  const rotated = await camera();
  console.log("RMS camera", {
    pixelsPerUnit: (before.projectionMatrix![0]! * box.width) / 2,
    scaleAfterDrag: rotated.projectionMatrix![0]! / before.projectionMatrix![0]!,
  });
  expect((before.projectionMatrix![0]! * box.width) / 2).toBeGreaterThan(6);
  expect(rotated.viewMatrix).not.toEqual(before.viewMatrix);
  expect.soft(rotated.projectionMatrix).toEqual(before.projectionMatrix);
  await part.screenshot({ path: "tools/wiki-runtime/site-shell/rms-camera-rotated.png" });
  await part.getByRole("button", { name: "复位视角" }).click();
  const reset = await camera();
  for (let i = 0; i < 16; i++) {
    expect(reset.projectionMatrix![i]).toBeCloseTo(before.projectionMatrix![i]!, 5);
    expect(reset.viewMatrix![i]).toBeCloseTo(before.viewMatrix![i]!, 5);
  }
});

test("RMS 播放完整归约，计算数值显示在对应三维零件旁", async ({ page }) => {
  await page.addInitScript(() => {
    const counts: number[] = [];
    Object.defineProperty(window, "rmsInstances", { value: counts });
    const draw = WebGL2RenderingContext.prototype.drawElementsInstanced;
    WebGL2RenderingContext.prototype.drawElementsInstanced = function (mode, count, type, offset, instances) {
      if (this.canvas instanceof HTMLCanvasElement && this.canvas.closest('[data-part="rms"]'))
        counts.push(instances);
      return draw.call(this, mode, count, type, offset, instances);
    };
  });
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  await expect.soft(part.getByRole("group", { name: "选择词的位置" })).toHaveCount(0);
  await part.getByRole("button", { name: "播放计算", exact: true }).click();
  await expect(part.locator(".matrix-rms-work")).toHaveAttribute("data-operation", "scale", {
    timeout: 33000,
  });
  await part.getByRole("button", { name: "暂停计算", exact: true }).click();
  const reductions = await page.evaluate(
    () => (window as unknown as { rmsInstances: number[] }).rmsInstances,
  );
  // The final scalar uses a native single mesh instead of an instanced column.
  for (const count of [16, 8, 4, 2]) expect.soft(reductions).toContain(count);
  await part.getByRole("button", { name: "逐项平方" }).click();
  expect(await page.evaluate(() => (window as unknown as { rmsInstances: number[] }).rmsInstances)).toContain(
    16,
  );
  await expect(part.locator(".matrix-rms-value")).toHaveCount(0);
  await expect(part.locator(".matrix-rms-scalar")).toContainText("0.379");
  const column = await part.locator("canvas").screenshot();
  await part.getByRole("button", { name: "求 RMS", exact: false }).click();
  await expect(part.locator(".matrix-rms-scalar")).toContainText("1.217");
  await expect(part.locator(".matrix-rms-scalar")).toBeVisible();
  expect((await part.locator("canvas").screenshot()).equals(column)).toBe(false);
  await part.getByRole("button", { name: "逐维缩放" }).click();
  const stored = Number(await part.locator(".matrix-part-inspection").getAttribute("data-stored"));
  expect(Number(await part.locator(".matrix-rms-scalar").getAttribute("data-value"))).toBeCloseTo(stored, 5);
  await part.getByRole("button", { name: "写回结果" }).click();
  expect(Number(await part.locator(".matrix-rms-scalar").getAttribute("data-value"))).toBeCloseTo(stored, 5);
  await expect(part.locator("iframe")).toHaveCount(0);
});

test("RMS 算例随阶段和选中维度变化，桌面与手机均可读", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  const example = part.locator(".matrix-rms-work");
  const result = example.locator(".matrix-rms-scalar");
  const steps = [
    ["逐项平方", "square", "0.379"],
    ["求 RMS", "reduce", "1.217"],
    ["逐维缩放", "scale", "−0.4365"],
    ["写回结果", "place", "−0.4365"],
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await part.scrollIntoViewIfNeeded();
    for (const [name, operation, value] of steps) {
      await part.getByRole("button", { name }).click();
      await expect(part.locator(".matrix-rms-work")).toHaveAttribute("data-operation", operation!);
      await expect(result).toBeVisible();
      expect(Number(await result.getAttribute("data-value"))).toBeCloseTo(
        Number(value!.replace("−", "-")),
        3,
      );
      await expect(result.locator("strong")).toHaveCSS("font-family", /JetBrains Mono/);
      const boxes = await example.locator(".matrix-rms-operand").evaluateAll((nodes) =>
        nodes
          .filter((node) => !(node as HTMLElement).hidden)
          .map((node) => {
            const box = node.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
          }),
      );
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const shapes = await part.locator(".matrix-part-label span").evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          line: Number.parseFloat(getComputedStyle(node).lineHeight),
        })),
      );
      for (const shape of shapes) expect(shape.height).toBeLessThanOrEqual(shape.line + 1);
      await part.screenshot({ path: `tools/wiki-runtime/site-shell/rms-spatial-${width}-${operation}.png` });
    }
  }
  await part.getByRole("button", { name: "求 RMS" }).click();
  await expect(part).toHaveAttribute("data-phase", "1");
  await expect(example.locator(".matrix-rms-operator")).toHaveText("√");
  await expect(part.locator(".matrix-part-playback-caption")).toContainText("ε = 0.00001");
  await part.getByText("核对一个维度的数值", { exact: true }).click();
  const rms = Number(await part.locator(".matrix-part-operand").nth(1).locator("strong").innerText());
  await expect(result).toContainText(rms.toFixed(3));
  for (const channel of ["1", "4096"]) {
    await part.getByRole("spinbutton", { name: "选择输出通道" }).fill(channel);
    const inspection = part.locator(".matrix-part-inspection");
    await expect(inspection).toHaveAttribute("data-channel", String(Number(channel) - 1));
    expect(
      await inspection.evaluate((node) =>
        Math.abs(Number(node.getAttribute("data-calculated")) - Number(node.getAttribute("data-stored"))),
      ),
    ).toBeLessThan(0.00001);
    await part.getByRole("button", { name: "逐维缩放" }).click();
    await expect(example.locator(".matrix-rms-operation-title")).toContainText(
      `第 ${Number(channel).toLocaleString("en-US")} 维`,
    );
    const operands = await inspection.locator(".matrix-part-operand strong").allTextContents();
    const normalized = Number(operands[0]) / Number(operands[1]);
    expect(
      Number(await example.locator(".matrix-rms-operand").nth(0).getAttribute("data-value")),
    ).toBeCloseTo(normalized, 3);
    expect(Number(await result.getAttribute("data-value"))).toBeCloseTo(
      Number(await inspection.getAttribute("data-stored")),
      5,
    );
    await expect(example).toContainText("乘对应的 γ");
  }
  await part.getByRole("slider").press("End");
  await expect(part.locator(".matrix-rms-work")).toHaveAttribute("data-operation", "complete");
  expect(errors).toEqual([]);
});

test("RMS 点选三维矩阵可换维度核对，保留当前计算阶段", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  await part.getByRole("button", { name: "逐项平方" }).click();
  const canvas = (await part.locator("canvas").boundingBox())!;
  for (const x of [0.23, 0.29, 0.35]) {
    await page.mouse.click(canvas.x + canvas.width * x, canvas.y + canvas.height * 0.3);
    if (await part.locator("details[open]").count()) break;
  }
  await expect(part.locator(".matrix-part-reading")).toHaveAttribute("open", "");
  await expect(part).toHaveAttribute("data-phase", "0");
  const channel = Number(await part.locator(".matrix-part-inspection").getAttribute("data-channel"));
  expect(channel).not.toBe(1023);
  expect(channel).toBeGreaterThanOrEqual(0);
  expect(channel).toBeLessThan(4096);
  await expect(part.locator(".matrix-rms-operand").nth(0)).toContainText(
    `第 ${(channel + 1).toLocaleString("en-US")} 维`,
  );
  await expect(part.locator(".matrix-part-inspection")).not.toHaveAttribute("data-word", "5");
  await part.getByRole("button", { name: "求 RMS" }).click();
  const rms = Number(await part.locator(".matrix-part-operand").nth(1).locator("strong").innerText());
  await expect(part.locator(".matrix-rms-scalar")).toContainText(rms.toFixed(3));
  await expect(part.locator(".matrix-rms-scalar")).not.toContainText("1.217");
});

test("RMS 配对合并的中间结果在桌面和窄屏都清楚保留", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const [progress, label] of [
      [0.0525, "16 组"],
      [0.2025, "8 组"],
      [0.3525, "4 组"],
      [0.5025, "2 组"],
      [0.64, "Σ x²"],
      [0.78, "均方"],
      [0.86, "ε"],
      [0.975, "RMS"],
    ] as const) {
      await seekRms(part, 1, progress);
      await expect(part.locator(".matrix-rms-work")).toContainText(label);
      await part.screenshot({
        path: `tools/wiki-runtime/site-shell/rms-arithmetic-${width}-stage-${progress}.png`,
      });
    }
  }
});

test("RMS 抽出和缩放中途保持矩阵、标题与下方说明可读", async ({ page }) => {
  await page.goto("/#/chapters/03#rms");
  const part = page.locator('[data-part="rms"]');
  await part.scrollIntoViewIfNeeded();
  await expect(part.locator("canvas")).toBeVisible({ timeout: 60000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const [phase, amount] of [
      [0, 0.05],
      [0, 0.1],
      [0, 0.2],
      [0, 0.3],
      [0, 0.4],
      [0, 0.6],
      [2, 0],
      [2, 0.05],
      [2, 0.4],
      [2, 0.64],
      [2, 0.8],
      [3, 0.2],
      [3, 0.4],
    ]) {
      await seekRms(part, phase!, amount!);
      await expect(part.locator(".matrix-part-label")).toHaveCount(3);
      for (const label of await part.locator(".matrix-part-label").all()) await expect(label).toBeVisible();
      await expect(part.locator(".matrix-rms-note")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await part.screenshot({
        path: `tools/wiki-runtime/site-shell/rms-arithmetic-path-${width}-${phase}-${amount}.png`,
      });
    }
  }
});
