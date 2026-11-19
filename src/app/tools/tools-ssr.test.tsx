import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { LEGACY_BASELINE_BADGE_TEXT } from "../../content/wiki/toolDeeplinks";
import { SCHEMATIC_TIMING_BADGE } from "../../sim/aicore/matmulRmsScenario";
import { SCHEMATIC_TRACE_BADGE_TEXT } from "../../sim/troubleshoot/timelineSandbox";
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
  });

  it("renders troubleshoot-workbench in logs, timeline, and full modes with physical Panel A / Panel B isolation outside RouterProvider", () => {
    const logsHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source:
          "tool: troubleshoot-workbench\nmode: logs\ntitle: 日志排障面板\nsummary: 粘贴日志定位首错 Rank",
      }),
    );
    expect(logsHtml).toContain('data-testid="wiki-tool-troubleshoot-workbench"');
    expect(logsHtml).toContain('data-testid="troubleshoot-workbench-view"');
    expect(logsHtml).toContain('data-mode="logs"');
    expect(logsHtml).toContain('data-testid="troubleshoot-panel-a"');
    expect(logsHtml).toContain('data-testid="first-fault-verdict"');
    expect(logsHtml).not.toContain('data-testid="troubleshoot-panel-b"');
    expect(logsHtml).not.toContain('data-testid="schematic-trace-badge"');

    const timelineHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: troubleshoot-workbench\nmode: timeline\ntitle: 相对时序沙箱",
      }),
    );
    expect(timelineHtml).toContain('data-testid="wiki-tool-troubleshoot-workbench"');
    expect(timelineHtml).toContain('data-testid="troubleshoot-workbench-view"');
    expect(timelineHtml).toContain('data-mode="timeline"');
    expect(timelineHtml).toContain('data-testid="troubleshoot-panel-b"');
    expect(timelineHtml).toContain('data-testid="schematic-trace-badge"');
    expect(timelineHtml).toContain(SCHEMATIC_TRACE_BADGE_TEXT);
    expect(timelineHtml).not.toContain('data-testid="troubleshoot-panel-a"');

    const fullLogsHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: troubleshoot-workbench\nmode: full",
      }),
    );
    expect(fullLogsHtml).toContain('data-mode="full"');
    expect(fullLogsHtml).toContain('data-testid="troubleshoot-tab-logs"');
    expect(fullLogsHtml).toContain('data-testid="troubleshoot-tab-timeline"');
    expect(fullLogsHtml).toContain('data-testid="troubleshoot-panel-a"');
    expect(fullLogsHtml).not.toContain('data-testid="schematic-trace-badge"');

    const fullTimelineHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: troubleshoot-workbench\nmode: full\ntab: timeline",
      }),
    );
    expect(fullTimelineHtml).toContain('data-mode="full"');
    expect(fullTimelineHtml).toContain('data-testid="troubleshoot-panel-b"');
    expect(fullTimelineHtml).toContain('data-testid="schematic-trace-badge"');
    expect(fullTimelineHtml).toContain(SCHEMATIC_TRACE_BADGE_TEXT);
  });

  it("renders aicore-lab in single and full modes with permanent schematic timing badge outside RouterProvider", () => {
    const singleHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: aicore-lab\nmode: single\ntitle: AI Core 算子实验室\nsummary: 观察 910B vs 950 泳道",
      }),
    );
    expect(singleHtml).toContain('data-testid="wiki-tool-aicore-lab"');
    expect(singleHtml).toContain('data-testid="aicore-lab-view"');
    expect(singleHtml).toContain('data-mode="single"');
    expect(singleHtml).toContain('data-testid="aicore-schematic-badge"');
    expect(singleHtml).toContain(SCHEMATIC_TIMING_BADGE);
    expect(singleHtml).toContain("#/tools?tab=aicore");
    expect(singleHtml).not.toContain('data-testid="aicore-buffer-inspector"');

    const fullHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: aicore-lab\nmode: full",
      }),
    );
    expect(fullHtml).toContain('data-testid="wiki-tool-aicore-lab"');
    expect(fullHtml).toContain('data-testid="aicore-lab-view"');
    expect(fullHtml).toContain('data-mode="full"');
    expect(fullHtml).toContain('data-testid="aicore-schematic-badge"');
    expect(fullHtml).toContain(SCHEMATIC_TIMING_BADGE);
    expect(fullHtml).toContain('data-testid="aicore-buffer-inspector"');
    expect(fullHtml).toContain('data-testid="aicore-gm-table-section"');
    expect(fullHtml).toContain('data-testid="tool-deeplink-ai-core"');
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

  it("renders AppShell + ToolsPage via StaticRouterProvider for all four workbench tabs", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);

    const renderTab = async (tab: string) => {
      const ctx = await handler.query(new Request(`http://localhost/tools?tab=${tab}`));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on /tools?tab=${tab}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    const calcHtml = await renderTab("calculator");
    expect(calcHtml).toContain('data-testid="tools-workbench"');
    expect(calcHtml).toContain('data-testid="deploy-calculator-view"');
    expect(calcHtml).toContain('data-mode="full"');
    expect(calcHtml).toContain('data-testid="tools-tab-troubleshoot"');
    expect(calcHtml).toContain('data-testid="tools-tab-aicore"');
    expect(calcHtml).not.toContain('data-testid="tools-tab-troubleshoot-preview"');
    expect(calcHtml).not.toContain('data-testid="tools-tab-aicore-preview"');
    expect(calcHtml).toContain("返回主章节");
    expect(calcHtml).toContain('data-testid="chat-open"');

    const doctorHtml = await renderTab("doctor");
    expect(doctorHtml).toContain('data-testid="tools-workbench"');
    expect(doctorHtml).toContain('data-testid="config-doctor-view"');
    expect(doctorHtml).toContain('data-mode="full"');
    expect(doctorHtml).toContain('data-testid="doctor-ask-assistant"');

    const troubleshootHtml = await renderTab("troubleshoot");
    expect(troubleshootHtml).toContain('data-testid="tools-workbench"');
    expect(troubleshootHtml).toContain('data-testid="troubleshoot-workbench-view"');
    expect(troubleshootHtml).toContain('data-mode="full"');
    expect(troubleshootHtml).toContain('data-testid="troubleshoot-tab-logs"');
    expect(troubleshootHtml).toContain('data-testid="troubleshoot-tab-timeline"');
    expect(troubleshootHtml).toContain('data-testid="troubleshoot-ask-assistant"');

    const aicoreHtml = await renderTab("aicore");
    expect(aicoreHtml).toContain('data-testid="tools-workbench"');
    expect(aicoreHtml).toContain('data-testid="aicore-lab-view"');
    expect(aicoreHtml).toContain('data-mode="full"');
    expect(aicoreHtml).toContain('data-testid="aicore-schematic-badge"');
    expect(aicoreHtml).toContain(SCHEMATIC_TIMING_BADGE);
    expect(aicoreHtml).toContain('data-testid="aicore-buffer-inspector"');
    expect(aicoreHtml).toContain('data-testid="aicore-ask-assistant"');
  });
});
