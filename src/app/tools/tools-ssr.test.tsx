import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { LEGACY_BASELINE_BADGE_TEXT } from "../../content/wiki/toolDeeplinks";
import { AppShell } from "../AppShell";
import { ToolsPage } from "../pages/ToolsPage";
import { WikiToolBlock } from "../wiki/WikiToolBlock";
import { DeployCalculatorView } from "./DeployCalculatorView";
import { ToolDeepLinkById } from "./ToolDeepLinkChip";

const MLA_CONFIG_JSON = JSON.stringify({
  model_type: "deepseek_v3",
  architectures: ["DeepseekV3ForCausalLM"],
  hidden_size: 7168,
  num_hidden_layers: 61,
  num_attention_heads: 128,
  kv_lora_rank: 512,
  q_lora_rank: 1536,
  qk_rope_head_dim: 64,
  v_head_dim: 128,
  vocab_size: 129280,
});

describe("Wave 3 interactive tools SSR & honest deep-link gate", () => {
  it("renders deploy-calculator in quick-screen, minimal, full and MLA Wave-4 intercept outside RouterProvider", () => {
    for (const mode of ["quick-screen", "minimal", "full"] as const) {
      const html = renderToStaticMarkup(
        createElement(WikiToolBlock, {
          source: `tool: deploy-calculator\nmode: ${mode}\ntitle: 算账台-${mode}\nsummary: 测试 ${mode} 模式`,
        }),
      );
      expect(html).toContain('data-testid="wiki-tool-deploy-calculator"');
      expect(html).toContain('data-testid="deploy-calculator-view"');
      expect(html).toContain(`data-mode="${mode}"`);
      expect(html).toContain(`算账台-${mode}`);
      expect(html).toContain(`mode: ${mode}`);
      expect(html).toContain(`测试 ${mode} 模式`);
    }

    const mlaDirectHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        initialModel: MLA_CONFIG_JSON,
        embedded: true,
      }),
    );
    expect(mlaDirectHtml).toContain('data-testid="wave3-arch-intercept"');
    expect(mlaDirectHtml).toContain('data-testid="tool-deeplink-mla"');
    expect(mlaDirectHtml).toContain('data-legacy-baseline="true"');
    expect(mlaDirectHtml).toContain(LEGACY_BASELINE_BADGE_TEXT);

    const mlaFenceHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: `tool: deploy-calculator\nmode: quick-screen\nmodel: ${MLA_CONFIG_JSON}`,
      }),
    );
    expect(mlaFenceHtml).toContain('data-testid="wave3-arch-intercept"');
    expect(mlaFenceHtml).toContain('data-testid="tool-deeplink-mla"');
    expect(mlaFenceHtml).toContain('data-legacy-baseline="true"');
  });

  it("renders config-doctor in minimal (zero DAG inversion) and full/PD modes outside RouterProvider", () => {
    const minimalHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: config-doctor\nmode: minimal\ntitle: 最小起服务体检\nsummary: 核对单机配置",
      }),
    );
    expect(minimalHtml).toContain('data-testid="wiki-tool-config-doctor"');
    expect(minimalHtml).toContain('data-testid="config-doctor-view"');
    expect(minimalHtml).toContain('data-mode="minimal"');
    expect(minimalHtml).toContain("最小起服务体检");
    expect(minimalHtml).toContain("mode: minimal");
    expect(minimalHtml).toContain("核对单机配置");
    expect(minimalHtml).toContain('data-testid="doctor-cmd-input"');
    expect(minimalHtml).not.toContain('data-testid="doctor-topology-pd"');
    expect(minimalHtml).not.toContain('data-testid="doctor-insights-section"');

    const fullHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source:
          "tool: config-doctor\nmode: full\npreset: pd-pitfall-mooncake-tp-pp-recompute\ntitle: P/D 联检",
      }),
    );
    expect(fullHtml).toContain('data-testid="config-doctor-view"');
    expect(fullHtml).toContain('data-mode="full"');
    expect(fullHtml).toContain('data-topology="pd"');
    expect(fullHtml).toContain('data-testid="doctor-topology-single"');
    expect(fullHtml).toContain('data-testid="doctor-topology-pd"');
    expect(fullHtml).toContain('data-testid="doctor-prefill-input"');
    expect(fullHtml).toContain('data-testid="doctor-decode-input"');
    expect(fullHtml).toContain('data-testid="doctor-rewrites-section"');
    expect(fullHtml).toContain('data-testid="doctor-insights-section"');
    expect(fullHtml).toContain('data-testid="tool-deeplink-pd-disaggregation"');
    expect(fullHtml).toContain('data-legacy-baseline="true"');
    expect(fullHtml).toContain(LEGACY_BASELINE_BADGE_TEXT);

    const wave4PlaceholderHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: troubleshoot-workbench\nmode: logs",
      }),
    );
    expect(wave4PlaceholderHtml).toContain("wiki-tool-placeholder");
  });

  it("enforces honest legacy-baseline badge on un-upgraded pages and omits it on v0.30.0 Core-26 pages", () => {
    for (const legacyId of ["hccl-buffer", "pd-disaggregation", "mla", "mooncake-connector", "npugraph-ex"]) {
      const html = renderToStaticMarkup(createElement(ToolDeepLinkById, { pageId: legacyId }));
      expect(html).toContain(`data-testid="tool-deeplink-${legacyId}"`);
      expect(html).toContain('data-legacy-baseline="true"');
      expect(html).toContain('data-testid="legacy-baseline-badge"');
      expect(html).toContain(LEGACY_BASELINE_BADGE_TEXT);
    }

    for (const upgradedId of [
      "ascend-env-and-serve",
      "core-cli-params",
      "tensor-parallel",
      "kv-cache",
      "quantization",
    ]) {
      const html = renderToStaticMarkup(createElement(ToolDeepLinkById, { pageId: upgradedId }));
      expect(html).toContain(`data-testid="tool-deeplink-${upgradedId}"`);
      expect(html).toContain('data-legacy-baseline="false"');
      expect(html).not.toContain('data-testid="legacy-baseline-badge"');
      expect(html).not.toContain(LEGACY_BASELINE_BADGE_TEXT);
    }
  });

  it("renders AppShell + ToolsPage via StaticRouterProvider for /tools?tab=calculator and /tools?tab=doctor", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);

    const calcContext = await handler.query(new Request("http://localhost/tools?tab=calculator"));
    if (calcContext instanceof Response) throw new Error("unexpected redirect on /tools?tab=calculator");
    const calcRouter = createStaticRouter(handler.dataRoutes, calcContext);
    const calcHtml = renderToStaticMarkup(
      createElement(StaticRouterProvider, { router: calcRouter, context: calcContext }),
    );
    expect(calcHtml).toContain('data-testid="tools-workbench"');
    expect(calcHtml).toContain('data-testid="deploy-calculator-view"');
    expect(calcHtml).toContain('data-mode="full"');
    expect(calcHtml).toContain('data-testid="tools-tab-troubleshoot-preview"');
    expect(calcHtml).toContain('data-testid="tools-tab-aicore-preview"');
    expect(calcHtml).toContain("返回主章节");
    expect(calcHtml).toContain('data-testid="chat-open"');

    const doctorContext = await handler.query(new Request("http://localhost/tools?tab=doctor"));
    if (doctorContext instanceof Response) throw new Error("unexpected redirect on /tools?tab=doctor");
    const doctorRouter = createStaticRouter(handler.dataRoutes, doctorContext);
    const doctorHtml = renderToStaticMarkup(
      createElement(StaticRouterProvider, { router: doctorRouter, context: doctorContext }),
    );
    expect(doctorHtml).toContain('data-testid="tools-workbench"');
    expect(doctorHtml).toContain('data-testid="config-doctor-view"');
    expect(doctorHtml).toContain('data-mode="full"');
    expect(doctorHtml).toContain('data-testid="doctor-ask-assistant"');
  });
});
