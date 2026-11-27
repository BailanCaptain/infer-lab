import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const SHOT_DIR = process.env.TROUBLESHOOT_SHOT_DIR || "test-results/troubleshoot-3d-shots";

test.describe("Troubleshoot Workbench 3D Hardware Fault Replay", () => {
  test("replays Rank 3 OOM -> Rank 0/1/2 cascade on A2, links back to log lines, clears on pure EI0006, and fits mobile viewport", async ({
    page,
  }) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error" || /buffer|WebGL:\s*INVALID/i.test(msg.text())) {
        errors.push(`console.${msg.type()}: ${msg.text()}`);
      }
    });

    await page.goto("/#/tools?tab=troubleshoot");
    const stage = page.getByTestId("troubleshoot-3d-stage");
    await expect(stage).toBeVisible();
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-hardware-model", "atlas-800t-a2");
    await expect(stage).toHaveAttribute("data-mapping-mode", "single-node-schematic");
    await expect(stage).toHaveAttribute("data-scene-ready", "true", { timeout: 15_000 });

    // 1. Scrub to Stage 0 (initial frame: 4 participating slots, 4 idle, 0 root-cause)
    const slider = page.getByTestId("troubleshoot-3d-slider");
    await slider.fill("0");
    await expect(stage).toHaveAttribute("data-step-index", "0");
    await expect(page.getByTestId("troubleshoot-3d-slot-0")).toHaveAttribute(
      "data-slot-state",
      "participating",
    );
    await expect(page.getByTestId("troubleshoot-3d-slot-3")).toHaveAttribute(
      "data-slot-state",
      "participating",
    );
    await expect(page.getByTestId("troubleshoot-3d-slot-4")).toHaveAttribute("data-slot-state", "idle");
    await page.waitForTimeout(250);
    await stage.screenshot({ path: join(SHOT_DIR, "01-stage0-initial-a2.png") });

    // 2. Step to Stage 1 (10:11:05.214 L8: Rank 3 root-cause lights up, Rank 0..2 still participating)
    await page.getByTestId("troubleshoot-3d-next").click();
    await expect(stage).toHaveAttribute("data-step-index", "1");
    await expect(page.getByTestId("troubleshoot-3d-slot-3")).toHaveAttribute("data-slot-state", "root-cause");
    await expect(page.getByTestId("troubleshoot-3d-slot-0")).toHaveAttribute(
      "data-slot-state",
      "participating",
    );
    await page.waitForTimeout(250);
    await stage.screenshot({ path: join(SHOT_DIR, "02-stage1-rank3-oom.png") });

    // 3. Full live playback from start to end via Replay button
    await page.getByTestId("troubleshoot-3d-replay").click();
    await expect(stage).toHaveAttribute("data-step-index", "4", { timeout: 10_000 });
    await expect(page.getByTestId("troubleshoot-3d-slot-0")).toHaveAttribute(
      "data-slot-state",
      "confirmed-cascade",
    );
    await expect(page.getByTestId("troubleshoot-3d-slot-1")).toHaveAttribute(
      "data-slot-state",
      "confirmed-cascade",
    );
    await expect(page.getByTestId("troubleshoot-3d-slot-2")).toHaveAttribute(
      "data-slot-state",
      "confirmed-cascade",
    );
    await expect(page.getByTestId("troubleshoot-3d-slot-3")).toHaveAttribute("data-slot-state", "root-cause");
    await page.waitForTimeout(250);
    await stage.screenshot({ path: join(SHOT_DIR, "03-stage4-cascade-complete.png") });

    // 4. Click Rank 1 card button -> opens collateral <details> and highlights L6
    await page.getByTestId("troubleshoot-3d-slot-1").click();
    const details = page.getByTestId("troubleshoot-collateral-details");
    await expect(details).toHaveJSProperty("open", true);
    const line6 = page.locator('[data-evidence-line="6"]');
    await expect(line6).toHaveAttribute("data-highlighted", "true");

    // 5. Switch to pure EI0006 timeout fixture -> clears root-cause highlight
    await page.getByTestId("troubleshoot-fixture-pure-hccl-timeout-no-primary").click();
    await expect(page.getByTestId("troubleshoot-3d-slot-0")).toHaveAttribute(
      "data-slot-state",
      "unattributed-timeout",
    );
    for (let r = 0; r < 8; r++) {
      await expect(page.getByTestId(`troubleshoot-3d-slot-${r}`)).not.toHaveAttribute(
        "data-slot-state",
        "root-cause",
      );
    }
    await page.waitForTimeout(250);
    await stage.screenshot({ path: join(SHOT_DIR, "04-pure-ei0006-no-root.png") });

    // 6. Switch back to Rank 3 fault & verify A3 dual-die + narrow mobile viewport (390x844)
    await page.getByTestId("troubleshoot-fixture-multi-rank-hccl-rank3-fault").click();
    await page.getByTestId("troubleshoot-3d-model-a3-die64g").click();
    await expect(stage).toHaveAttribute("data-hardware-model", "atlas-800i-a3");
    await expect(stage).toHaveAttribute("data-scene-ready", "true", { timeout: 15_000 });
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="troubleshoot-3d-stage"]');
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 84;
        window.scrollTo(0, Math.max(0, y));
      }
    });
    await page.waitForTimeout(350);
    await stage.screenshot({ path: join(SHOT_DIR, "05-mobile-390-a3.png") });

    expect(errors).toEqual([]);
  });

  test("renders Blender Cycles cutaway diagram in /#/wiki/hardware-devices and clears CASE-07 in /#/tools?tab=wargame", async ({
    page,
  }) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

    await page.setViewportSize({ width: 1360, height: 900 });
    await page.goto("/#/wiki/hardware-devices");
    const fig = page
      .locator(
        'figure[data-diagram-id="hardware-plate-slot-die-cutaway"], svg[aria-label="三类昇腾推理服务器整机拆解与逻辑设备映射图"]',
      )
      .first();
    await expect(fig).toBeVisible({ timeout: 15_000 });
    await fig.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    await fig.screenshot({ path: join(SHOT_DIR, "06-wiki-hardware-slot-die-cutaway.png") });

    await page.goto("/#/tools?tab=wargame&case=a3-dual-die-static-kernel-trap");
    const wgView = page.getByTestId("wargame-view");
    await expect(wgView).toBeVisible();
    await expect(wgView).toHaveAttribute("data-active-case", "a3-dual-die-static-kernel-trap");
    await expect(page.getByTestId("wargame-provenance-pill")).toContainText("社区案例脱敏改编");

    await page.getByTestId("wargame-option-C").click();
    const cmdInput = page.getByTestId("wargame-cmd-input");
    await cmdInput.fill(
      [
        "export ASCEND_RT_VISIBLE_DEVICES=0,1",
        "vllm serve /models/Qwen3-30B-A3B-W8A8 \\",
        "    --served-model-name qwen3-30b-a3b \\",
        "    --tensor-parallel-size 2 \\",
        "    --enable-expert-parallel \\",
        "    --quantization ascend \\",
        "    --max-model-len 16384 \\",
        "    --gpu-memory-utilization 0.88 \\",
        '    --compilation-config \'{"cudagraph_mode":"FULL_DECODE_ONLY"}\' \\',
        '    --additional-config \'{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true}}\'',
      ].join("\n"),
    );
    await page.getByTestId("wargame-submit-btn").click();
    await expect(page.getByTestId("wargame-debrief-card")).toBeVisible();
    await page.getByTestId("wargame-debrief-card").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOT_DIR, "07-wargame-case07-cleared.png") });

    expect(errors).toEqual([]);
  });

  test("maps physical slots via ASCEND_RT_VISIBLE_DEVICES and degrades gracefully when WebGL is disabled", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
          return null;
        }
        return origGetContext.apply(this, [type, ...rest] as Parameters<typeof origGetContext>);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto("/#/tools?tab=troubleshoot");
    const stage = page.getByTestId("troubleshoot-3d-stage");
    await expect(stage).toBeVisible();
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene-ready", "webgl-fallback");
    await expect(page.getByTestId("troubleshoot-3d-webgl-fallback")).toBeVisible();

    const logInput = page.getByTestId("troubleshoot-log-input");
    await logInput.fill(
      [
        "export ASCEND_RT_VISIBLE_DEVICES=4,5,6,7",
        "2026-04-12 10:11:05.214 ERROR [Worker_TP0] [Rank 0] RuntimeError: NPU out of memory. Tried to allocate 1.80 GiB",
        "2026-04-12 10:12:35.100 ERROR [Worker_TP1] [Rank 1] EI0006 Notify wait execute timeout",
      ].join("\n"),
    );
    await expect(stage).toHaveAttribute("data-mapping-mode", "single-node-mapped");
    await expect(page.getByTestId("troubleshoot-3d-slot-0")).toHaveAttribute("data-slot-state", "idle");
    await expect(page.getByTestId("troubleshoot-3d-slot-4")).toHaveAttribute("data-slot-state", "root-cause");
    await page.getByTestId("troubleshoot-3d-slot-4").click();
    await expect(page.locator('[data-evidence-line="2"]')).toHaveAttribute("data-highlighted", "true");
  });
});
