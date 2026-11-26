import { expect, type Locator, test } from "@playwright/test";
import { SWIGLU_SECONDS } from "../src/app/wiki/scene-compute-data";
import { mechanismSeconds } from "../src/app/wiki/scene-parallel-mechanisms";
import { RESIDUAL_SECONDS } from "../src/app/wiki/scene-residual-data";

async function scrub(figure: Locator, seconds: number) {
  await figure.getByRole("slider").evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, seconds);
}
async function scrubFraction(figure: Locator, progress: number) {
  await scrub(figure, Number(await figure.getByRole("slider").getAttribute("max")) * progress);
}
const examples = [
  ["glm-5-3-flash", "model-compute-0", 0, RESIDUAL_SECONDS],
  ["glm-5-3-flash", "model-compute-3", 3, RESIDUAL_SECONDS],
  ["mlp-residual-norm", "model-compute-2", 2, SWIGLU_SECONDS],
  ["tensor-parallel", "parallel-mechanism-5", 5, mechanismSeconds(5)],
  ["data-parallel", "parallel-mechanism-6", 6, mechanismSeconds(6)],
  ["expert-parallel", "parallel-mechanism-7", 7, mechanismSeconds(7)],
  ["one-request", "token-flow", 3, 105],
] as const;
test("request data stays readable and hidden matrix faces do not leak labels", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-1");
  const f = page.getByTestId("scene-token-flow");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const width of [1440, 654]) {
    await page.setViewportSize({ width, height: 1100 });
    await scrub(f, 28 + 2.8);
    const cells = f.locator('.wiki-request-cell[data-focus="true"]:visible');
    expect(await cells.count()).toBeGreaterThan(20);
    expect(
      await cells.evaluateAll((elements) =>
        elements.every((e) => Number.parseFloat(getComputedStyle(e).fontSize) >= 13),
      ),
    ).toBe(true);
    await scrub(f, 28 + 11.2);
    // Four residual sheets overlap in depth: only the front sheet's row labels should show.
    await expect(cells.filter({ hasText: /^h₃₀$/ })).toHaveCount(1);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await scrub(f, 28 + 2.8);
  const canvas = f.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2 + 20);
  await page.mouse.up();
  await expect(f.locator(".wiki-request-cell").filter({ hasText: /^4 × 4096$/ })).toBeVisible();
});

test("retired model-compute-1 inline scenes are absent on matmul-and-weights and glm-5-3-flash", async ({
  page,
}) => {
  await page.goto("/#/wiki/matmul-and-weights");
  await expect(page.getByTestId("scene-model-compute-1")).toHaveCount(0);
  await page.goto("/#/wiki/glm-5-3-flash");
  await expect(page.getByTestId("scene-model-compute-1")).toHaveCount(0);
  await expect(page.getByTestId("scene-model-compute-0")).toHaveCount(1);
  await expect(page.getByTestId("scene-model-compute-3")).toHaveCount(1);
});
for (const [pageId, kind, step, duration] of examples)
  test(`${kind}: own chapter, play, pause, end, replay, offscreen`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/#/wiki/${pageId}#scene-${kind}`);
    const figure = page.getByTestId(`scene-${kind}`),
      canvas = figure.locator(".wiki-scene-canvas");
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute("data-ready", "true", { timeout: 45000 });
    await expect(figure.locator("canvas")).toHaveCount(1);
    await expect(figure.locator(".wiki-scene-steps")).toHaveCount(0);
    await figure.getByRole("button", { name: "连续播放", exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute("data-progress"))).toBeGreaterThan(0.025);
    await figure.getByRole("button", { name: "暂停", exact: true }).click();
    const frozen = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute("data-progress")).toBe(frozen);
    await scrub(figure, duration - 0.2);
    await figure.getByRole("button", { name: "连续播放", exact: true }).click();
    await expect(figure).toHaveAttribute("data-playing", "false");
    await expect(canvas).toHaveAttribute("data-step", String(step));
    await expect(figure.getByRole("button", { name: "重新播放", exact: true })).toBeVisible();
    await figure.screenshot({ path: `tools/wiki-runtime/knowledge-main-rebuild/inline-${kind}.png` });
    await figure.getByRole("button", { name: "重新播放", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-step", String(kind === "token-flow" ? 0 : step));
    await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const offscreen = await canvas.getAttribute("data-progress");
    await page.waitForTimeout(300);
    expect(await canvas.getAttribute("data-progress")).toBe(offscreen);
    await page.goto("/#/wiki");
    await expect(page.locator(".wiki-scene canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
test("TP, DP and EP use the PP renderer and finish with their hand-checkable results", async ({ page }) => {
  for (const [pageId, id, mechanism, result] of [
    ["tensor-parallel", "parallel-mechanism-5", "TP", "2,3,3,6;3,7,1,-1;4,5,2,-3;4,7,-2,3"],
    ["data-parallel", "parallel-mechanism-6", "DP", "A:好的,B:缓存"],
    ["expert-parallel", "parallel-mechanism-7", "EP", "routed=2.4,1.7,1.75,1.75;out=3.4,1.7,2.75,1.75"],
  ] as const) {
    await page.goto(`/#/wiki/${pageId}#scene-${id}`);
    const f = page.getByTestId(`scene-${id}`),
      c = f.locator(".wiki-scene-canvas");
    await expect(f).toHaveAttribute("data-ready", "true", { timeout: 45000 });
    await expect(c).toHaveAttribute("data-mechanism", mechanism);
    await expect(c).toHaveAttribute("data-active-cards", mechanism === "TP" ? "4" : "16");
    await expect(f.locator(".wiki-mechanism-chapters button").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await scrubFraction(f, 0.5);
    await expect(c).toHaveAttribute("data-result", "pending");
    await scrubFraction(f, 1);
    await expect(c).toHaveAttribute("data-result", result);
  }
});
test("mobile scenes fit and playback remains below sticky navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [pageId, kind] of [examples[2], examples[3], examples[6]]) {
    await page.goto(`/#/wiki/${pageId}#scene-${kind}`);
    const f = page.getByTestId(`scene-${kind}`);
    await expect(f).toHaveAttribute("data-ready", "true", { timeout: 45000 });
    await f.getByRole("button", { name: "连续播放", exact: true }).click();
    await f.getByRole("button", { name: "暂停", exact: true }).click();
    expect(await f.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await f.screenshot({ path: `tools/wiki-runtime/knowledge-main-rebuild/inline-${kind}-mobile.png` });
  }
  await page.setViewportSize({ width: 654, height: 619 });
  await page.goto("/#/wiki/tensor-parallel#scene-parallel-mechanism-5");
  const f = page.getByTestId("scene-parallel-mechanism-5");
  await expect(f).toHaveAttribute("data-ready", "true", { timeout: 45000 });
  await f.getByRole("button", { name: "连续播放", exact: true }).click();
  await expect
    .poll(async () => (await f.locator(".wiki-scene-player").boundingBox())!.y)
    .toBeGreaterThanOrEqual(178);
});
test("renderer import failure retries without losing the calculation", async ({ page }) => {
  await page.route("**/wiki-scene-renderer-*.js", (route) => route.abort());
  await page.goto("/#/wiki/mlp-residual-norm#scene-model-compute-2");
  const f = page.getByTestId("scene-model-compute-2");
  await expect(f.getByRole("button", { name: "重新加载" })).toBeVisible();
  await scrub(f, 24);
  await expect(f.getByTestId("scene-equation")).toContainText("SiLU(g)");
  await page.unroute("**/wiki-scene-renderer-*.js");
  await f.getByRole("button", { name: "重新加载" }).click();
  await expect(f).toHaveAttribute("data-ready", "true", { timeout: 45000 });
});

test("request diagrams keep their branches while scrubbing", async ({ page }) => {
  for (const [url, id, required] of [
    ["one-request", "token-flow", ["采样 / MTP", "45 层主干", "Engine · 调度"]],
  ] as const) {
    await page.goto(`/#/wiki/${url}#scene-${id}`);
    const f = page.getByTestId(`scene-${id}`);
    await expect(f).toHaveAttribute("data-ready", "true", { timeout: 45000 });
    const labels = f.locator(".wiki-request-label[data-node]");
    const before = await labels.locator("strong").allTextContents();
    for (const seconds of [0, 14, 28, 56, 76, 84, 98, 105]) {
      await scrub(f, seconds);
      expect(await labels.locator("strong").allTextContents()).toEqual(before);
      for (const name of required) await expect(labels.filter({ hasText: name })).toBeVisible();
    }
  }
});

test("one request player automatically crosses sections and old chapter links seek within it", async ({
  page,
}) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow");
  await expect(f).toHaveAttribute("data-ready", "true");
  await expect(page.locator('.wiki-scene[data-kind="token-flow"]')).toHaveCount(1);
  const canvas = await f.locator("canvas").elementHandle();
  for (const [boundary, next] of [
    [28, 1],
    [56, 2],
    [84, 3],
  ]) {
    await scrub(f, boundary! - 0.3);
    await f.getByRole("button", { name: "连续播放", exact: true }).click();
    await expect(f.locator(".wiki-scene-canvas")).toHaveAttribute("data-step", String(next));
    await expect(f).toHaveAttribute("data-playing", "true");
    expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
    await f.getByRole("button", { name: "暂停", exact: true }).click();
  }
  await expect(f.getByTestId("request-client-text")).toHaveText("先");
  for (const [part, start] of [
    [0, 0],
    [1, 28],
    [2, 56],
    [3, 84],
  ]) {
    await page.goto(`/#/wiki/one-request#scene-token-flow-${part}`);
    await expect(f.getByRole("slider")).toHaveValue(String(start));
  }
});

test("request outputs cross stage boundaries without collapsing or leaking labels", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow"),
    canvas = f.locator(".wiki-scene-canvas");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const [time, payload] of [
    [7, "p₃"],
    [35, "e₀₀"],
    [49, "z₃ₙ"],
    [56, "ℓₖ"],
    [84, "d₃?"],
    [91, "d₃′?"],
  ] as const) {
    await scrub(f, time - 0.05);
    await expect(canvas).toHaveAttribute("data-expansion", "1.000");
    await scrub(f, time + 0.4);
    await expect(canvas).toHaveAttribute("data-expansion", "1.000");
    await expect(canvas).toHaveAttribute("data-handoff", "transferring");
    await expect(canvas).toHaveAttribute("data-handoff-values", new RegExp(payload.replace(/[?]/g, "\\?")));
  }
  await scrub(f, 88.2);
  await expect(f.getByText("d₂ 拒绝 → y₂", { exact: true })).toBeVisible();
  await expect(f.getByTestId("request-client-text")).toHaveText("先");
  await scrub(f, 90.5);
  await expect(f.getByTestId("request-client-text")).toHaveText("先解释缓存作用。");
  const count = await f.locator(".wiki-request-cell").count();
  for (let i = 0; i < 3; i++) {
    await scrub(f, 98.5);
    await scrub(f, 88.2);
    await scrub(f, 90.5);
  }
  expect(await f.locator(".wiki-request-cell").count()).toBe(count);
  await expect(f.getByText("d₂ 拒绝 → y₂", { exact: true })).toHaveCount(0);
});

test("every request handoff keeps cell identities, colors and grid shape", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow"),
    canvas = f.locator(".wiki-scene-canvas");
  await expect(f).toHaveAttribute("data-ready", "true");
  const tones = new Map<string, string>();
  for (let boundary = 7; boundary <= 98; boundary += 7) {
    await scrub(f, boundary + 0.5);
    const matched = (await canvas.getAttribute("data-handoff-matched"))!.split("/");
    expect(Number(matched[0])).toBeGreaterThan(0);
    expect(matched[0]).toBe(matched[1]);
    const shapes = (await canvas.getAttribute("data-handoff-shape"))!.split("→");
    expect(shapes[0]).toBe(shapes[1]);
    const cells = await f.locator(".wiki-request-cell[data-identity]:visible").evaluateAll((elements) =>
      elements.map((el) => ({
        identity: (el as HTMLElement).dataset.identity!,
        tone: (el as HTMLElement).dataset.tone!,
      })),
    );
    for (const cell of cells.filter((c) => c.identity)) {
      if (tones.has(cell.identity)) expect(cell.tone).toBe(tones.get(cell.identity));
      tones.set(cell.identity, cell.tone);
    }
    await scrub(f, boundary + 1.9);
    await expect(canvas).toHaveAttribute("data-handoff", "received");
  }
  await scrub(f, 14);
  await expect(f.getByText("等待返回", { exact: true })).toBeVisible();
});

test("request inputs preview their destination and settle before work starts", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow"),
    canvas = f.locator(".wiki-scene-canvas");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const boundary of [14, 35, 42, 63, 77, 84]) {
    await scrub(f, boundary + 0.2);
    await expect(canvas).toHaveAttribute("data-handoff-phase", "preview");
    await expect(canvas).toHaveAttribute("data-handoff-motion", "0.000");
    expect(await f.locator('.wiki-request-cell[data-receiver="true"]:visible').count()).toBeGreaterThan(0);
    await expect(f.locator('.wiki-request-label[data-node][data-receiving="true"]')).toHaveCount(1);
    await scrub(f, boundary + 0.9);
    await expect(canvas).toHaveAttribute("data-handoff-phase", "moving");
    await expect(canvas).toHaveAttribute("data-work", "0.000");
    for (const time of [1.5, 1.7]) {
      await scrub(f, boundary + time);
      await expect(canvas).toHaveAttribute("data-handoff-phase", "settled");
      await expect(canvas).toHaveAttribute("data-handoff-motion", "1.000");
      await expect(canvas).toHaveAttribute("data-work", "0.000");
    }
    await scrub(f, boundary + 1.9);
    await expect(canvas).toHaveAttribute("data-handoff-phase", "computing");
    expect(Number(await canvas.getAttribute("data-work"))).toBeGreaterThan(0);
    await expect(f.locator('.wiki-request-cell[data-receiver="true"]:visible')).toHaveCount(0);
  }
});

test("request detail stays attached to its module and maps actual input/output regions", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const [seconds, owner, output] of [
    [30, "embed", "隐藏表示 H"],
    [40, "layers", "4 个位置 × 4 路残差"],
    [68, "sample", "留在 worker 的候选"],
    [86, "layers", "主干"],
    [88, "sample", "按顺序验证候选"],
    [89, "api", "API · 本批文字"],
    [90, "engine", "下一圈输入已备好"],
    [101, "engine", "R1 占用的缓存"],
  ] as const) {
    await scrub(f, seconds);
    await expect(f.locator(".wiki-request-binding")).toHaveAttribute("data-owner", owner);
    await expect(f.locator(".wiki-request-port[data-port]:not([data-outgoing]):visible")).toHaveCount(2);
    await expect(f.locator('strong[data-port="output"], strong[data-port="both"]')).toContainText(output);
    for (const role of ["owner", "guide", "bracket", "input", "output"])
      await expect(
        f.locator(`.wiki-request-binding-${role}:not([data-outgoing], [data-carried])`),
      ).toHaveAttribute("d", /^M.+L/);
    await expect(f.locator(".wiki-request-label[data-node]")).toHaveCount(8);
  }
  await page.setViewportSize({ width: 654, height: 1000 });
  await scrub(f, 30);
  const inputPort = await f.locator('.wiki-request-port[data-port="input"]').boundingBox();
  const outputPort = await f
    .locator('.wiki-request-port[data-port="output"]:not([data-outgoing])')
    .boundingBox();
  expect(inputPort!.x + inputPort!.width).toBeLessThan(outputPort!.x);
  const viewport = f.locator(".wiki-scene-canvas");
  await viewport.scrollIntoViewIfNeeded();
  const rect = (await viewport.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 80, rect.y + rect.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  const ownerPath = await f.locator(".wiki-request-binding-owner:not([data-outgoing])").getAttribute("d");
  await scrub(f, 30.05);
  await expect(f.locator(".wiki-request-binding-owner:not([data-outgoing])")).toHaveAttribute(
    "d",
    ownerPath!,
  );
});

test("request explanations do not stretch an empty green area below the 3D viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const seconds of [6, 36, 68, 103]) {
    await scrub(f, seconds);
    const sizes = await f.evaluate((el) => {
      const visual = el.querySelector(".wiki-scene-visual")!.getBoundingClientRect();
      const tools = el.querySelector(".wiki-scene-tools")!.getBoundingClientRect();
      const explanation = el.querySelector(".wiki-scene-explanation")!.getBoundingClientRect();
      return { gap: visual.bottom - tools.bottom, visual: visual.height, explanation: explanation.height };
    });
    expect(sizes.gap).toBeLessThanOrEqual(1);
    expect(sizes.explanation).toBeCloseTo(sizes.visual, 0);
  }
  await page.setViewportSize({ width: 654, height: 1000 });
  const mobile = await f.locator(".wiki-scene-explanation").evaluate((el) => ({
    scroll: el.scrollHeight,
    height: el.clientHeight,
    contain: getComputedStyle(el).contain,
  }));
  expect(mobile.contain).toBe("none");
  expect(mobile.scroll).toBeLessThanOrEqual(mobile.height + 1);
});

test("request guides and B-to-A markers follow the carried data through each handoff", async ({ page }) => {
  await page.goto("/#/wiki/one-request#scene-token-flow-0");
  const f = page.getByTestId("scene-token-flow");
  await expect(f).toHaveAttribute("data-ready", "true");
  for (const boundary of [7, 21, 35, 42, 56, 70, 84, 91, 98]) {
    for (const delta of [0.2, 0.9, 1.5, 1.9]) {
      await scrub(f, boundary + delta);
      const state = await f.evaluate((el) => {
        const svg = el.querySelector<SVGElement>(".wiki-request-binding")!;
        const opacity = (selector: string) =>
          Number((el.querySelector(selector) as HTMLElement).style.opacity);
        return {
          motion: Number(el.querySelector<HTMLElement>(".wiki-scene-canvas")!.dataset.handoffMotion),
          mix: Number(svg.dataset.mix),
          previous: opacity(".wiki-request-binding-guide[data-outgoing]"),
          next: opacity(".wiki-request-binding-guide:not([data-outgoing])"),
          output: opacity('.wiki-request-port[data-port="output"]:not([data-outgoing])'),
          carried: opacity(".wiki-request-transfer-port"),
          nodes: el.querySelectorAll(".wiki-request-label[data-node]").length,
        };
      });
      expect(state.mix).toBe(state.motion);
      expect(state.previous).toBeCloseTo(0.65 * (1 - state.motion), 2);
      expect(state.next).toBeCloseTo(0.65 * state.motion, 2);
      expect(state.nodes).toBe(8);
      if (delta < 1.4) expect(state.output).toBe(0);
      if (delta > 1.785) expect(state.carried).toBe(0);
      if (boundary === 98 && delta >= 1.5) expect(state.carried).toBe(0);
      await expect(f.locator(".wiki-request-transfer-port")).toHaveText(
        boundary === 98 ? "保留回答" : "B → A",
      );
    }
  }
});

test("computation explanation stays attached to the animation without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/wiki/mlp-residual-norm#scene-model-compute-2");
  const f = page.getByTestId("scene-model-compute-2");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  const stage = (await f.locator(".wiki-scene-canvas").boundingBox())!;
  const explanation = (await f.locator(".wiki-scene-explanation").boundingBox())!;
  expect(explanation.width).toBeGreaterThan(200);
  expect(explanation.y >= stage.y + stage.height - 2 || explanation.x >= stage.x + stage.width - 2).toBe(
    true,
  );
});

test("chapter scenes use a readable adjacent explanation and keep their rendered results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 654, height: 1000 });
  for (const [pageId, id, , duration] of examples) {
    await page.goto(`/#/wiki/${pageId}#scene-${id}`);
    const f = page.getByTestId(`scene-${id}`);
    await expect(f).toHaveAttribute("data-ready", "true");
    await scrub(f, duration);
    const stage = (await f.locator(".wiki-scene-canvas").boundingBox())!;
    const reading = (await f.locator(".wiki-scene-explanation").boundingBox())!;
    if (id.startsWith("token-flow")) {
      expect(reading.y).toBeGreaterThanOrEqual(stage.y + stage.height);
      expect(stage.width).toBeGreaterThan(500);
    } else {
      expect(reading.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
      expect(Math.abs(reading.y - stage.y)).toBeLessThan(100);
    }
    expect(await f.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const sizes = await f
      .locator(
        ".wiki-compute-label strong, .wiki-flow-label strong, .wiki-request-label strong, .wiki-hardware-label.rank strong",
      )
      .evaluateAll((nodes) => nodes.map((n) => parseFloat(getComputedStyle(n).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    if (id === "model-compute-0")
      await expect(f.locator('[data-node="out"]')).toHaveAttribute("data-values", "0.849,1.131");
    if (id === "model-compute-3")
      await expect(f.locator('[data-node="out"]')).toHaveAttribute("data-values", "1.5,2.5,3.5,4.5");
    if (id === "token-flow") {
      await expect(f.getByTestId("request-client-text")).toContainText("</think>KV cache");
      await expect(f.locator('[data-node="cache"]')).toHaveAttribute("data-values", "R1 已归还");
      await scrub(f, 76);
      await expect(f.locator('[data-node="client"]')).toHaveAttribute("data-values", "收到：先");
      await scrub(f, 0);
      await expect(f.locator('[data-node="client"]')).toHaveAttribute("data-values", "发送一句话");
      await expect(f.locator('[data-node="engine"]')).toHaveAttribute("data-values", "p₀,p₁,p₂,p₃,");
      await expect(f.getByTestId("request-client-text")).toHaveText("等待服务端返回…");
      await scrub(f, 105);
    }
    await f.screenshot({ path: `tools/wiki-runtime/knowledge-main-rebuild/all-scenes-${id}-654.png` });
  }
});

test("SwiGLU visibly gates before mixing, with every channel inspectable", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/#/wiki/mlp-residual-norm#scene-model-compute-2");
  const f = page.getByTestId("scene-model-compute-2"),
    c = f.locator(".wiki-scene-canvas");
  await f.scrollIntoViewIfNeeded();
  await expect(f).toHaveAttribute("data-ready", "true");
  await expect(c).toHaveAttribute("data-structure-visible", "true");
  await expect(c).toHaveAttribute("data-spatial-meaning", "structure-extraction-compute-writeback");
  await expect(c).toHaveAttribute("data-structure-cells", "104");
  await expect(f.locator("[data-structure-node]")).toHaveCount(9);
  await scrub(f, 5.8);
  await expect(f.locator(".wiki-compute-formula")).toContainText("2.48");
  await scrub(f, 12);
  await expect(c).toHaveAttribute("data-operation", "up");
  await expect(f.locator(".wiki-compute-formula")).toContainText("u[");
  await scrub(f, 32);
  await expect(c).toHaveAttribute("data-output-ready", "true");
  await expect(c).toHaveAttribute("data-unfold", "0.000");
  await expect(f.locator(".wiki-compute-formula")).toContainText("3.44");
  await f.getByLabel("down 输出", { exact: true }).selectOption({ index: 1 });
  await expect(f.locator(".wiki-compute-formula")).toContainText("−1.13");
  await expect(f.locator('[data-structure-node="delta"]')).toHaveAttribute("data-ready", "true");
  await scrub(f, 0);
  await expect(c).toHaveAttribute("data-output-ready", "false");
  await expect(f.locator('[data-structure-node="delta"]')).toHaveAttribute("data-ready", "false");
  expect(requests.some((url) => url.includes("/master/"))).toBe(false);
});

test("new computation figures fit desktop, reading panel and phone", async ({ page }) => {
  for (const width of [1440, 654, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, id] of [["mlp-residual-norm", "model-compute-2"]] as const) {
      await page.goto(`/#/wiki/${name}#scene-${id}`);
      const f = page.getByTestId(`scene-${id}`);
      await f.scrollIntoViewIfNeeded();
      await expect(f).toHaveAttribute("data-ready", "true");
      await scrub(f, 16.5);
      expect(await f.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(f.locator(".wiki-compute-formula")).toContainText("s[1]");
      await f.getByLabel("中间通道", { exact: true }).click();
      await page.keyboard.press("Escape");
      await f.screenshot({ path: `tools/wiki-runtime/knowledge-main-rebuild/spatial-${id}-${width}.png` });
    }
  }
});
