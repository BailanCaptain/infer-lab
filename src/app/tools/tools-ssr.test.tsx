import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import {
  LEGACY_BASELINE_BADGE_TEXT,
  resolveToolDeepLink,
  V030_VERIFIED_TAG,
} from "../../content/wiki/toolDeeplinks";
import { ASCEND_910B3_MEASURED_BENCHMARKS, SCHEMATIC_TIMING_BADGE } from "../../sim/aicore/matmulRmsScenario";
import { SCHEMATIC_TRACE_BADGE_TEXT } from "../../sim/troubleshoot/timelineSandbox";
import { WARGAME_SCENARIOS } from "../../sim/wargame/scenarios";
import { AppShell } from "../AppShell";
import { ToolsPage, ToolTabErrorBoundary } from "../pages/ToolsPage";
import { WikiToolBlock } from "../wiki/WikiToolBlock";
import { AiCoreLabView } from "./AiCoreLabView";
import { ConfigDoctorView, extractNormalizedCliModel } from "./ConfigDoctorView";
import {
  DeployCalculatorView,
  evaluateCalculatorModelGate,
  formatHardware3dLinkLabel,
  formatRecommendedParallelSummary,
  formatTopologySummaryBadge,
  hasAdvancedQueryOverrides,
  isCurrentDeployPlanValid,
  parseCustomModelParam,
  parseV2ModelRunnerParam,
  resolveCanonicalRecommendedPlan,
  selectContextualPrincipleWikiIds,
  serializeCustomModelForShare,
} from "./DeployCalculatorView";
import {
  buildWarGameQueryParams,
  IncidentWarGameView,
  parseWarGameCaseParam,
  readWarGamePassedIds,
  WARGAME_PROGRESS_STORAGE_KEY,
  writeWarGamePassedIds,
} from "./IncidentWarGameView";
import { ToolDeepLinkById } from "./ToolDeepLinkChip";
import { TroubleshootWorkbenchView } from "./TroubleshootWorkbenchView";
import { encodeDoctorCommandParam, parseCalculatorQueryParams } from "./workbenchHandoff";

const MLA_CONFIG_JSON = JSON.stringify({
  model_type: "deepseek_v3",
  architectures: ["DeepseekV3ForCausalLM"],
  hidden_size: 7168,
  num_hidden_layers: 61,
  num_attention_heads: 128,
  kv_lora_rank: 512,
  q_lora_rank: 1536,
  qk_nope_head_dim: 128,
  qk_rope_head_dim: 64,
  v_head_dim: 128,
  intermediate_size: 18432,
  moe_intermediate_size: 2048,
  n_routed_experts: 256,
  num_experts_per_tok: 8,
  n_shared_experts: 1,
  first_k_dense_replace: 3,
  vocab_size: 129280,
});

describe("Wave 3/4 interactive tools SSR & honest deep-link gate", () => {
  it("renders deploy-calculator in quick-screen, minimal, full and unlocked Wave-4 MLA mode outside RouterProvider", () => {
    const expectedCalcBadges = {
      "quick-screen": "快速摸底",
      minimal: "精简算账",
      full: "完整模式",
    } as const;
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
      expect(html).toContain(expectedCalcBadges[mode]);
      expect(html).toContain(`测试 ${mode} 模式`);
    }

    const mlaDirectHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        initialModel: MLA_CONFIG_JSON,
        embedded: true,
      }),
    );
    expect(mlaDirectHtml).toContain('data-testid="wave4-arch-active"');
    expect(mlaDirectHtml).not.toContain('data-testid="wave3-arch-intercept"');
    expect(mlaDirectHtml).toContain("1152 B/tok/层");
    expect(mlaDirectHtml).toContain('data-testid="tool-deeplink-mla"');
    expect(mlaDirectHtml).toContain('data-legacy-baseline="false"');

    const mlaFenceHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: `tool: deploy-calculator\nmode: quick-screen\nmodel: ${MLA_CONFIG_JSON}`,
      }),
    );
    expect(mlaFenceHtml).toContain('data-testid="wave4-arch-active"');
    expect(mlaFenceHtml).not.toContain('data-testid="wave3-arch-intercept"');
    expect(mlaFenceHtml).toContain('data-testid="tool-deeplink-mla"');
    expect(mlaFenceHtml).toContain('data-legacy-baseline="false"');
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
    expect(minimalHtml).toContain("最小起服务");
    expect(minimalHtml).not.toContain("mode: minimal");
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
    expect(fullHtml).toContain('data-legacy-baseline="false"');
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
    expect(fullHtml).toContain('data-testid="aicore-measured-910b3-section"');
    expect(fullHtml).toContain(ASCEND_910B3_MEASURED_BENCHMARKS.title);
    expect(fullHtml).toContain("M=2048, K=4096, N=4096");
    expect(fullHtml).toContain("63.58µs");
    expect(fullHtml).toContain("Vec 74.6% / MTE2 18.6%");
    expect(fullHtml).toContain("256.61µs");
    expect(fullHtml).toContain("Cube util 96.9%");
    expect(fullHtml).toContain("MAC 95.4% 与 MTE2 82.4% 流水重叠");
    expect(fullHtml).toContain("31.79µs");
    expect(fullHtml).toContain("MIX_AIC / 20+20");
    expect(fullHtml).toContain("195.61µs");
    expect(fullHtml).toContain("1.312x");
    expect(fullHtml).toContain("1.128x");
    expect(fullHtml).toContain("70.57µs");
    expect(fullHtml).toContain("hcom_allReduce_");
    expect(fullHtml).toContain("523.88µs");
    expect(fullHtml).toContain("665.47µs");
    expect(fullHtml).toContain("通信矩阵边样本带宽 17.63~17.93 GB/s");
    expect(fullHtml).toContain("71.02µs");
    expect(ASCEND_910B3_MEASURED_BENCHMARKS.rawSources).toEqual([
      "raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L260-L292",
      "raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L935-L950",
    ]);
    expect(fullHtml).toContain('data-testid="tool-deeplink-ai-core"');
  });

  it("enforces honest legacy-baseline badge on archive snapshots and omits it on all Stage-2 verified pages", () => {
    for (const legacyId of ["v030rc2-baseline", "glm-5-3-flash-baseline"]) {
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
      "mla",
      "linear-attention",
      "kv-cache-spec",
      "engram-conditional-memory",
      "hccl-buffer",
      "pd-disaggregation",
      "mooncake-connector",
      "npugraph-ex",
      "rfork",
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
    expect(calcHtml).toContain('data-testid="handoff-to-doctor"');
    expect(calcHtml).toContain('data-testid="tools-tab-troubleshoot"');
    expect(calcHtml).toContain('data-testid="tools-tab-aicore"');
    expect(calcHtml).not.toContain('data-testid="tools-tab-troubleshoot-preview"');
    expect(calcHtml).not.toContain('data-testid="tools-tab-aicore-preview"');
    expect(calcHtml).toContain("返回主章节");
    expect(calcHtml).toContain('data-testid="chat-open"');

    // 验证 ?fromPage + ?preset + ?panel 白名单参数桥接与返回锚点
    const deepQueryCtx = await handler.query(
      new Request(
        "http://localhost/tools?tab=calculator&panel=reconcile&preset=qwen3-30b-a3b&tp=4&fromPage=kv-cache-memory-profiling&fromAnchor=7-级冷启动显存账目",
      ),
    );
    if (deepQueryCtx instanceof Response) throw new Error("unexpected redirect on deep query");
    const deepQueryRouter = createStaticRouter(handler.dataRoutes, deepQueryCtx);
    const deepQueryHtml = renderToStaticMarkup(
      createElement(StaticRouterProvider, { router: deepQueryRouter, context: deepQueryCtx }),
    );
    expect(deepQueryHtml).toContain("返回主章节 · kv-cache-memory-profiling");
    expect(deepQueryHtml).toContain('href="/wiki/kv-cache-memory-profiling#');
    expect(deepQueryHtml).toContain('data-testid="calc-log-input"');
    expect(deepQueryHtml).toContain("TP=4");

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
    expect(troubleshootHtml).toContain('data-testid="handoff-to-reconcile"');

    const aicoreHtml = await renderTab("aicore");
    expect(aicoreHtml).toContain('data-testid="tools-workbench"');
    expect(aicoreHtml).toContain('data-testid="aicore-lab-view"');
    expect(aicoreHtml).toContain('data-mode="full"');
    expect(aicoreHtml).toContain('data-testid="aicore-schematic-badge"');
    expect(aicoreHtml).toContain(SCHEMATIC_TIMING_BADGE);
    expect(aicoreHtml).toContain('data-testid="aicore-buffer-inspector"');
    expect(aicoreHtml).toContain('data-testid="aicore-ask-assistant"');
  });

  it("enforces human-first framing, progressive disclosure, honest doctor verdict, and full share-URL restoration", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);

    const renderUrl = async (url: string) => {
      const ctx = await handler.query(new Request(url));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on ${url}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    // 1. Calculator default view: 3+1 scenario tabs, top-line verdict strip, collapsed advanced details, human submode tabs
    const calcHtml = await renderUrl("http://localhost/tools?tab=calculator");
    expect(calcHtml).toContain("估算要几张卡");
    expect(calcHtml).toContain("检查启动命令");
    expect(calcHtml).toContain("分析报错日志");
    expect(calcHtml).toContain("微观原理演示");
    expect(calcHtml).toContain('data-testid="calc-verdict-strip"');
    expect(calcHtml).toContain('data-testid="calc-advanced-controls"');
    expect(calcHtml).toContain("上线前估算（算卡数）");
    expect(calcHtml).toContain("已有日志对账（查偏差）");
    expect(calcHtml).not.toContain("Mode A · 7 级静态估算");
    expect(calcHtml).not.toContain("Mode B · 真机日志对账");
    expect(calcHtml).not.toContain("Mode A 用 7 级");

    // 2. Full share-URL parameter restoration (including nz, pcp, batchTokens, maxSeqs, cudagraph, pp=1, dp=1)
    const sharedCalcHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-8b&card=a2-64g&tp=2&pp=1&dp=1&pcp=2&dcp=1&nz=2&batchTokens=4096&maxSeqs=64&cudagraph=FULL_DECODE_ONLY&maxLen=16384",
    );
    expect(sharedCalcHtml).toContain("PP=1 · DP=1 · PCP=2 · DCP=1 · KV=auto · NZ=2 · 图=FULL_DECODE_ONLY");
    expect(sharedCalcHtml).toContain("FULL_DECODE_ONLY");
    expect(sharedCalcHtml).toContain("--max-model-len 16384");
    expect(sharedCalcHtml).toContain("--max-num-batched-tokens 4096");
    expect(sharedCalcHtml).toContain("--max-num-seqs 64");

    // 3. ConfigDoctor honest pass copy (never over-claiming "零硬阻断（可起服务）")
    const doctorHealthyHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: config-doctor\nmode: full\npreset: pd-healthy-mooncake-tp4-to-tp2-pp1",
      }),
    );
    expect(doctorHealthyHtml).toContain("当前规则未发现冲突阻断");
    expect(doctorHealthyHtml).not.toContain("零硬阻断（可起服务）");

    // 4. Troubleshoot human labels + explicit built-in demo banner (no Panel A/B jargon)
    const troubleshootHtml = await renderUrl("http://localhost/tools?tab=troubleshoot");
    expect(troubleshootHtml).toContain('data-testid="troubleshoot-demo-banner"');
    expect(troubleshootHtml).toContain("清空并粘贴你的真实日志");
    expect(troubleshootHtml).not.toContain("Panel A");
    expect(troubleshootHtml).not.toContain("Panel B");

    // 5. AI Core lab plain-Chinese guide strip + byte table collapsed by default
    const aicoreHtml = await renderUrl("http://localhost/tools?tab=aicore");
    expect(aicoreHtml).toContain('data-testid="aicore-guide-strip"');
    expect(aicoreHtml).toContain('data-testid="aicore-gm-table-section"');
    expect(aicoreHtml).toContain("展开完整字节账本");
    expect(aicoreHtml).not.toContain('data-testid="aicore-gm-row-');
  });

  it("handles default-vs-override details auto-open, customModel share links, CLI model extraction, and tab ErrorBoundary", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);

    const renderUrl = async (url: string) => {
      const ctx = await handler.query(new Request(url));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on ${url}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    // 1. Default serialized calculator query params must NOT auto-open advanced <details>
    const defaultSerialized = parseCalculatorQueryParams(
      new URLSearchParams(
        "tab=calculator&preset=qwen3-8b&card=a2-64g&precision=bf16&kv=auto&nz=1&tp=1&pp=1&dp=1&pcp=1&dcp=1&ep=0&u=0.92&maxLen=32768&batchTokens=2048&maxSeqs=256&cudagraph=PIECEWISE&eager=0&prefill=512&decodeBatch=16&decodeCtx=4096&version=v0.30.0",
      ),
    );
    expect(hasAdvancedQueryOverrides(defaultSerialized)).toBe(false);
    const defaultShareHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-8b&pp=1&dp=1&nz=1&batchTokens=2048&maxSeqs=256&prefill=512&decodeBatch=16&decodeCtx=4096",
    );
    expect(defaultShareHtml).toMatch(
      /<details[^>]*data-testid="calc-advanced-controls"(?![^>]*\sopen(?:=|\s|>))/,
    );

    // Non-default advanced param DOES auto-open <details>
    const overrideParsed = parseCalculatorQueryParams(
      new URLSearchParams("tab=calculator&pp=2&nz=2&decodeBatch=32"),
    );
    expect(hasAdvancedQueryOverrides(overrideParsed)).toBe(true);
    const overrideHtml = await renderUrl("http://localhost/tools?tab=calculator&pp=2&nz=2&decodeBatch=32");
    expect(overrideHtml).toMatch(/<details[^>]*data-testid="calc-advanced-controls"[^>]*\sopen/);

    // 2. Custom JSON share link: <=4096 chars round-trips via customModel param; >4096 chars & non-finite numbers (1e400) rejected honestly
    const smallCustom = serializeCustomModelForShare(MLA_CONFIG_JSON);
    expect(smallCustom.ok).toBe(true);
    if (smallCustom.ok) {
      const encodedParams = new URLSearchParams({ tab: "calculator", customModel: smallCustom.compact });
      expect(parseCustomModelParam(encodedParams)).toContain('"kv_lora_rank": 512');
      const customShareHtml = await renderUrl(`http://localhost/tools?${encodedParams.toString()}`);
      expect(customShareHtml).toContain('data-testid="wave4-arch-active"');
      expect(customShareHtml).toContain("1152 B/tok/层");
    }

    const hugeCustom = serializeCustomModelForShare(
      JSON.stringify({ model_type: "qwen3", pad: "x".repeat(4200) }),
    );
    expect(hugeCustom.ok).toBe(false);
    if (!hugeCustom.ok) {
      expect(hugeCustom.reason).toContain("4096");
    }

    const nonFiniteCustom = serializeCustomModelForShare('{"model_type":"qwen3","hidden_size":1e400}');
    expect(nonFiniteCustom.ok).toBe(false);
    expect(
      parseCustomModelParam(
        new URLSearchParams({ customModel: '{"model_type":"qwen3","hidden_size":1e400}' }),
      ),
    ).toBeNull();

    // 2b. Model Runner V2 (`?v2=1|0`) wired into UI, URL, advanced <details>, and PCP=2 on v0.30.0
    expect(parseV2ModelRunnerParam(new URLSearchParams("v2=1"))).toBe(true);
    expect(parseV2ModelRunnerParam(new URLSearchParams("v2=0"))).toBe(false);
    expect(parseV2ModelRunnerParam(new URLSearchParams("tab=calculator"))).toBeUndefined();
    expect(hasAdvancedQueryOverrides({}, true)).toBe(true);
    const pcpV2Html = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-8b&card=a2-64g&tp=2&pcp=2&v2=1&version=v0.30.0",
    );
    expect(pcpV2Html).toContain('data-testid="calc-v2-runner-select"');
    expect(pcpV2Html).toContain("V2=开");
    expect(pcpV2Html).toContain("VLLM_USE_V2_MODEL_RUNNER=1");
    expect(pcpV2Html).toContain("--prefill-context-parallel-size 2");
    expect(pcpV2Html).toMatch(/<details[^>]*data-testid="calc-advanced-controls"[^>]*\sopen/);

    // 3. ConfigDoctor CLI model token normalization for stale handoff invalidation
    expect(extractNormalizedCliModel("vllm serve Qwen3-8B -tp 2")).toBe("qwen3-8b");
    expect(extractNormalizedCliModel("vllm serve Qwen3-8B -tp 4 --max-model-len 16384")).toBe("qwen3-8b");
    expect(extractNormalizedCliModel("vllm serve Qwen/Qwen3-30B-A3B -tp 4")).toBe("qwen/qwen3-30b-a3b");

    // 4. Tab-scoped ToolTabErrorBoundary state derivation, retry button & repeated-failure reload recovery
    const derived = ToolTabErrorBoundary.getDerivedStateFromError(new Error("ChunkLoadError: timeout"));
    expect(derived).toEqual({ hasError: true, errorMessage: "ChunkLoadError: timeout" });
    const firstBoundary = new ToolTabErrorBoundary({
      tabId: "aicore",
      activeTab: "aicore",
      tabLabel: "芯片算子沙盘",
      retryCount: 0,
      onRetry: () => {},
      children: null,
    });
    firstBoundary.state = derived;
    const firstFallbackHtml = renderToStaticMarkup(firstBoundary.render());
    expect(firstFallbackHtml).toContain('data-testid="tools-tab-error-aicore"');
    expect(firstFallbackHtml).toContain('data-testid="tools-tab-retry-aicore"');
    expect(firstFallbackHtml).toContain('data-testid="tools-tab-reload-aicore"');
    expect(firstFallbackHtml).toContain("重新加载此工具");
    expect(firstFallbackHtml).toContain("完整刷新此页恢复");
    expect(firstFallbackHtml).toContain("ChunkLoadError: timeout");

    const repeatedBoundary = new ToolTabErrorBoundary({
      tabId: "aicore",
      activeTab: "aicore",
      tabLabel: "芯片算子沙盘",
      retryCount: 1,
      onRetry: () => {},
      children: null,
    });
    repeatedBoundary.state = derived;
    const repeatedFallbackHtml = renderToStaticMarkup(repeatedBoundary.render());
    expect(repeatedFallbackHtml).toContain("模块初始化重试仍失败");
    expect(repeatedFallbackHtml).toContain('class="wt-assistant-btn" data-testid="tools-tab-reload-aicore"');

    // 5. Split-stage Roofline SVG (static W8A8 MoE: Prefill INT8 640 TOPS / ridge 400 vs Decode BF16 320 TFLOPS / ridge 200)
    const splitRooflineHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-30b-a3b&card=a2-64g&precision=w8a8&tp=8&ep=1&prefill=448",
    );
    expect(splitRooflineHtml).toContain('data-testid="roofline-prefill-ceiling"');
    expect(splitRooflineHtml).toContain("Prefill 脊点 400.0 FLOP/B");
    expect(splitRooflineHtml).toContain("Decode 脊点 200.0 FLOP/B");
    expect(splitRooflineHtml).toContain("Prefill 峰值 640");
    expect(splitRooflineHtml).toContain("Decode 峰值 320");
    const prePointMatch = splitRooflineHtml.match(
      /cy="([0-9.]+)"[^>]*data-point-id="pre"[^>]*data-achieved-tflops="([0-9.]+)"/,
    );
    expect(prePointMatch).not.toBeNull();
    expect(Number(prePointMatch?.[2])).toBeGreaterThan(600);

    // 6. Direct custom config.json with 1e400 (Infinity) must be rejected at gate before evaluateDeployPlan
    const infinityGlmConfig = JSON.stringify({
      model_type: "glm4_moe_lite",
      architectures: ["Glm4MoeLiteForCausalLM"],
      hidden_size: 2048,
      num_hidden_layers: 47,
      num_attention_heads: 20,
      kv_lora_rank: 512,
      qk_nope_head_dim: 192,
      qk_rope_head_dim: 64,
      v_head_dim: 256,
      n_routed_experts: 64,
      num_experts_per_tok: 4,
      vocab_size: 154880,
    }).replace('"kv_lora_rank":512', '"kv_lora_rank":1e400');
    const infGate = evaluateCalculatorModelGate(infinityGlmConfig, true);
    expect(infGate.ok).toBe(false);
    if (!infGate.ok) {
      expect(infGate.error).toContain("非有限数值");
    }
    const infSsrHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        initialModel: infinityGlmConfig,
        embedded: true,
      }),
    );
    expect(infSsrHtml).toContain('data-testid="calc-gate-error"');
    expect(infSsrHtml).not.toContain('data-testid="calc-verdict-strip"');
  });

  it("Track 1B: restores Doctor/AiCore/Troubleshoot deep links via SSR, escapes XSS in cmd, preserves fromPage/fromAnchor, and isolates inactive/embedded views", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);
    const renderUrl = async (url: string) => {
      const ctx = await handler.query(new Request(url));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on ${url}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    // 1. ConfigDoctor shared cmd restoration + XSS escaping + clear button + fromPage/fromAnchor
    const xssCmd = 'vllm serve Qwen/Qwen3-8B -tp 2 --served-model-name "<script>alert(1)</script>"';
    const encodedCmd = encodeDoctorCommandParam(xssCmd);
    const doctorShareHtml = await renderUrl(
      `http://localhost/tools?tab=doctor&topology=single&hw=310P&ver=main&hint=qwen3-8b&cmd=${encodedCmd}&fromPage=core-cli-params&fromAnchor=静默改写`,
    );
    expect(doctorShareHtml).toContain('data-testid="doctor-copy-share-link"');
    expect(doctorShareHtml).toContain('data-testid="doctor-share-banner"');
    expect(doctorShareHtml).toContain('data-testid="doctor-clear-share-params"');
    expect(doctorShareHtml).toContain("main (8d6180e2)");
    expect(doctorShareHtml).toContain("返回主章节 · core-cli-params");
    expect(doctorShareHtml).toContain('href="/wiki/core-cli-params#');
    expect(doctorShareHtml).not.toContain("<script>alert(1)</script>");
    expect(doctorShareHtml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    // 2. AiCoreLab full URL parameter restoration + share & reset buttons
    const aicoreShareHtml = await renderUrl(
      "http://localhost/tools?tab=aicore&arch=950&db=1&fuse=1&quant=w8a8_dynamic&outlier=20.5&fromPage=ai-core&fromAnchor=双缓冲",
    );
    expect(aicoreShareHtml).toContain('data-arch="950"');
    expect(aicoreShareHtml).toContain("Ping / Pong 双槽重叠");
    expect(aicoreShareHtml).toContain("20.5");
    expect(aicoreShareHtml).toContain('data-testid="aicore-copy-share-link"');
    expect(aicoreShareHtml).toContain('data-testid="aicore-reset-defaults"');
    expect(aicoreShareHtml).toContain("返回主章节 · ai-core");

    // 3. TroubleshootWorkbench timeline scenario + step=1 (counterfactual) restoration + copy button
    const tsShareHtml = await renderUrl(
      "http://localhost/tools?tab=troubleshoot&panel=timeline&scenario=kv-preemption-storm&step=1&fromPage=hccl-buffer",
    );
    expect(tsShareHtml).toContain('data-panel="timeline"');
    expect(tsShareHtml).toContain("对策验证态");
    expect(tsShareHtml).toContain('data-testid="troubleshoot-copy-share-link"');
    expect(tsShareHtml).toContain("返回主章节 · hccl-buffer");

    // 4. Inactive (isActive=false) and embedded (embedded=true) views strictly ignore searchParams
    const foreignParams = new URLSearchParams(
      `tab=aicore&arch=950&db=1&topology=pd&cmd=${encodedCmd}&panel=timeline&step=1`,
    );
    const inactiveAiCoreHtml = renderToStaticMarkup(
      createElement(AiCoreLabView, { mode: "full", isActive: false, searchParams: foreignParams }),
    );
    expect(inactiveAiCoreHtml).toContain('data-arch="910b"');
    const embeddedDoctorHtml = renderToStaticMarkup(
      createElement(ConfigDoctorView, { mode: "full", embedded: true, searchParams: foreignParams }),
    );
    expect(embeddedDoctorHtml).toContain('data-topology="single"');
    expect(embeddedDoctorHtml).not.toContain("&lt;script&gt;");
    const inactiveTsHtml = renderToStaticMarkup(
      createElement(TroubleshootWorkbenchView, {
        mode: "full",
        isActive: false,
        searchParams: foreignParams,
      }),
    );
    expect(inactiveTsHtml).toContain('data-panel="logs"');
  });

  it("Track 3B: renders tab=wargame SSR, restores ?case=<scenarioId>, guards spoilers/inactive URL, and validates all 8 scenario Wiki deep-links", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);
    const renderUrl = async (url: string) => {
      const ctx = await handler.query(new Request(url));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on ${url}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    // 1. Default tab=wargame SSR: 5th scenario tab active, progress 0 / 8, hints & debrief locked (no spoilers)
    const defaultHtml = await renderUrl("http://localhost/tools?tab=wargame");
    expect(defaultHtml).toContain('data-testid="tools-tab-wargame"');
    expect(defaultHtml).toContain("⑤ 实战闯关演练");
    expect(defaultHtml).toContain("生产故障通关场");
    expect(defaultHtml).toContain('data-testid="wargame-view"');
    expect(defaultHtml).toContain('data-active-case="rank3-oom-ei0006"');
    expect(defaultHtml).toContain('data-testid="wargame-progress-badge"');
    expect(defaultHtml).toContain("已通关 0 / 8 关");
    expect(defaultHtml).toContain('data-testid="wargame-debrief-locked"');
    expect(defaultHtml).not.toContain('data-testid="wargame-debrief-card"');
    expect(defaultHtml).not.toContain('data-testid="wargame-hints-list"');
    expect(defaultHtml).toContain('data-testid="wargame-ask-assistant"');

    // 2. ?tab=wargame&case=pd-mooncake-kv-mismatch SSR restores PD dual-editor + preserves fromPage
    const pdCaseHtml = await renderUrl(
      "http://localhost/tools?tab=wargame&case=pd-mooncake-kv-mismatch&fromPage=pd-disaggregation",
    );
    expect(pdCaseHtml).toContain('data-active-case="pd-mooncake-kv-mismatch"');
    expect(pdCaseHtml).toContain('data-topology="pd"');
    expect(pdCaseHtml).toContain('data-testid="wargame-cmd-input"');
    expect(pdCaseHtml).toContain('data-testid="wargame-decode-cmd-input"');
    expect(pdCaseHtml).toContain("返回主章节 · pd-disaggregation");

    // 3. Inactive / embedded IncidentWarGameView strictly ignores foreign ?case= query param
    const foreignWgParams = new URLSearchParams("tab=calculator&case=metrics-preemption-avalanche");
    const inactiveWgHtml = renderToStaticMarkup(
      createElement(IncidentWarGameView, { isActive: false, searchParams: foreignWgParams }),
    );
    expect(inactiveWgHtml).toContain('data-active-case="rank3-oom-ei0006"');
    expect(parseWarGameCaseParam(new URLSearchParams("case=metrics-preemption-avalanche"))).toBe(
      "metrics-preemption-avalanche",
    );
    expect(
      buildWarGameQueryParams(
        "910b3-u090-aclgraph-oom",
        new URLSearchParams("fromPage=acl-graph"),
      ).toString(),
    ).toBe("tab=wargame&fromPage=acl-graph&case=910b3-u090-aclgraph-oom");

    // 4. Storage persistence (`infer-lab:wargame:v1`) & graceful no-storage fallback
    expect(readWarGamePassedIds(null).size).toBe(0);
    const memStore = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memStore.set(k, v);
      },
    };
    expect(writeWarGamePassedIds(["rank3-oom-ei0006", "pd-mooncake-kv-mismatch"], mockStorage)).toBe(true);
    expect(memStore.has(WARGAME_PROGRESS_STORAGE_KEY)).toBe(true);
    expect([...readWarGamePassedIds(mockStorage)]).toEqual(["rank3-oom-ei0006", "pd-mooncake-kv-mismatch"]);

    // 5. All 8 scenarios' debrief Wiki deep-links resolve to valid v0.30.0 verified pages
    for (const sc of WARGAME_SCENARIOS) {
      for (const ref of sc.debrief.wikiRefs) {
        const resolved = resolveToolDeepLink(ref.pageId, { anchor: ref.anchor, label: ref.label });
        expect(resolved.verified).toContain(V030_VERIFIED_TAG);
        expect(resolved.isV030Verified).toBe(true);
        expect(resolved.isLegacyBaseline).toBe(false);
      }
    }

    // 6. Wave 1 P1-1: DeployCalculator 3D hardware link preserves headroomStatus === "risk" instead of flattening to "fits"
    const { parseHardwareDeployOverlay } = await import("../model/hardwareDeployOverlay");
    const riskHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-8b&card=a2-64g&tp=1&precision=bf16&maxLen=8192&cudagraph=FULL_AND_PIECEWISE&u=0.95",
    );
    const hwHrefMatch =
      /data-testid="calc-open-3d-hardware"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-testid="calc-open-3d-hardware"/.exec(
        riskHtml,
      );
    const rawHwHref = (hwHrefMatch?.[1] ?? hwHrefMatch?.[2] ?? "").replaceAll("&amp;", "&");
    expect(rawHwHref.startsWith("#/hardware?")).toBe(true);
    const hwQuery = new URLSearchParams(rawHwHref.slice("#/hardware?".length));
    const riskOverlay = parseHardwareDeployOverlay(hwQuery.get("deploy"));
    expect(riskOverlay).not.toBeNull();
    expect(riskOverlay?.oomStatus).toBe("headroom_risk");
    expect(riskOverlay?.headroomRisk).toBe(true);

    // 7. Wave 1 Engram conflict UI: v0.30.0 + MRV2 + DP=2 + cpu_offload=false renders conflict warning rather than claiming 0 B HBM
    const { WAVE4_DEMO_PRESETS } = await import("../../sim/modelspec/deployCalculator");
    const engramNoOffloadJson = JSON.stringify({
      ...WAVE4_DEMO_PRESETS.find((d) => d.id === "engram-conditional")?.config,
      engram_cpu_offload: false,
      engram_dp_shared_memory: false,
    });
    const engramConflictHtml = await renderUrl(
      `http://localhost/tools?tab=calculator&version=v0.30.0&tp=2&dp=2&v2=1&customModel=${encodeURIComponent(engramNoOffloadJson)}`,
    );
    expect(engramConflictHtml).toContain("配置校验冲突");
    expect(engramConflictHtml).not.toContain("单卡 NPU 权重 HBM 占用 <strong>0 B</strong>");

    // 8. Master Polish WS1: P1 overflow CTA ("一键应用推荐并行"), honest 3D overflow label, collapsed engineering drawer,
    //    expanded Qwen3-32B / Qwen3-235B-A22B presets, contextual principle chips, Doctor secondary <details>, and Troubleshoot collateral folding
    const { evaluateDeployPlan } = await import("../../sim/modelspec/deployCalculator");
    const overflow310pPlan = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "310p-24g",
      weightPrecision: "bf16",
      tpSize: 1,
    });
    expect(isCurrentDeployPlanValid(overflow310pPlan)).toBe(false);
    expect(formatRecommendedParallelSummary(overflow310pPlan)).toContain("TP=2");
    expect(formatHardware3dLinkLabel(overflow310pPlan)).toBe("去 3D 查看当前 TP=1 溢出态");

    const overflowHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-30b-a3b&card=310p-24g&precision=bf16&tp=1",
    );
    expect(overflowHtml).toContain('data-testid="calc-apply-recommended-plan"');
    expect(overflowHtml).toContain("一键应用推荐并行 (TP=2");
    expect(overflowHtml).toContain("去 3D 查看当前 TP=1 溢出态");
    expect(overflowHtml).not.toContain("在 3D 整机中透视此方案");

    // Pure TP=1 -> TP=2 overflow on Qwen3-32B + A2 64G + BF16
    const q32OverflowHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-32b&card=a2-64g&precision=bf16&tp=1",
    );
    expect(q32OverflowHtml).toContain("一键应用推荐并行 (TP=2)");
    expect(q32OverflowHtml).toContain("去 3D 查看当前 TP=1 溢出态");

    // Applied TP=2 fits -> both CLI and 3D link show TP=2, apply CTA disappears
    const q32FitsHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-32b&card=a2-64g&precision=bf16&tp=2",
    );
    expect(q32FitsHtml).not.toContain('data-testid="calc-apply-recommended-plan"');
    expect(q32FitsHtml).toContain("在 3D 整机中透视此方案 (TP=2) →");
    expect(q32FitsHtml).toContain("-tp 2");
    expect(q32FitsHtml).toContain('data-testid="calc-contextual-principles"');
    expect(
      selectContextualPrincipleWikiIds(
        evaluateDeployPlan({ model: "qwen3-235b-a22b", cardId: "a3-die64g", tpSize: 8, enableEp: true }),
      ),
    ).toEqual(["gqa", "moe", "kv-cache-memory-profiling", "expert-parallel"]);

    // Engineering drawer collapsed by default ONLY on mode="full" && subMode="static"
    expect(q32FitsHtml).toMatch(
      /<details[^>]*data-testid="calc-engineering-details"(?![^>]*\sopen(?:=|\s|>))/,
    );
    expect(q32FitsHtml).toContain(
      '<summary class="wt-calc-eng-summary" data-testid="calc-engineering-summary">展开查看 7 级显存推导、HCCL 通信域与 Roofline 工程依据</summary>',
    );
    const reconcileHtml = await renderUrl("http://localhost/tools?tab=calculator&panel=reconcile");
    expect(reconcileHtml).not.toContain('data-testid="calc-engineering-details"');
    const minimalEmbeddedHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, { mode: "minimal", embedded: true }),
    );
    expect(minimalEmbeddedHtml).not.toContain('data-testid="calc-engineering-details"');

    // ConfigDoctor secondary options collapsed by default, auto-opened when fromVer/roce/hint active
    const docDefaultHtml = await renderUrl("http://localhost/tools?tab=doctor");
    expect(docDefaultHtml).toMatch(
      /<details[^>]*data-testid="doctor-secondary-options"(?![^>]*\sopen(?:=|\s|>))/,
    );
    const docActiveSecHtml = await renderUrl("http://localhost/tools?tab=doctor&roce=1&hint=qwen3-32b");
    expect(docActiveSecHtml).toMatch(/<details[^>]*data-testid="doctor-secondary-options"[^>]*\sopen/);

    // Troubleshoot folds secondary collateral timeout lines into default-collapsed <details>
    const tsCollateralHtml = await renderUrl(
      "http://localhost/tools?tab=troubleshoot&fixture=multi-rank-hccl-rank3-fault",
    );
    expect(tsCollateralHtml).toMatch(
      /<details[^>]*data-testid="troubleshoot-collateral-details"(?![^>]*\sopen(?:=|\s|>))/,
    );

    // 9. Red-Team Regression Suite (Items 1–5):
    //    (a) 235B canonical power-of-two {1,2,4,8} apply -> URL -> remount -> Doctor -> 3D wire round-trip (never PP=5, never falls back to qwen3-8b)
    const { buildCurrentPlanCliHint } = await import("../../sim/modelspec/deployCalculator");
    const { buildCalculatorQueryParams } = await import("./workbenchHandoff");
    const plan235Overflow = evaluateDeployPlan({
      model: "qwen3-235b-a22b",
      cardId: "a2-64g",
      weightPrecision: "bf16",
      tpSize: 1,
    });
    const resolved235 = resolveCanonicalRecommendedPlan(plan235Overflow);
    expect(resolved235).not.toBeNull();
    expect([1, 2, 4, 8]).toContain(resolved235!.nextState.tpSize);
    expect([1, 2, 4, 8]).toContain(resolved235!.nextState.ppSize);
    expect([1, 2, 4, 8]).toContain(resolved235!.nextState.dpSize);
    expect(resolved235!.nextState.tpSize).toBe(8);
    expect(resolved235!.nextState.ppSize).toBe(1);
    expect(resolved235!.nextState.enableEp).toBe(true);
    expect(resolved235!.nextState.weightPrecision).toBe("w8a8_dynamic");
    expect(isCurrentDeployPlanValid(resolved235!.nextPlan)).toBe(true);
    expect(resolved235!.nextPlan.fourQuestions.q1Fit.blockers).toHaveLength(0);

    const q235InitialHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-235b-a22b&card=a2-64g&precision=bf16&tp=1",
    );
    expect(q235InitialHtml).toContain("vllm serve Qwen3-235B-A22B -tp 8");
    expect(q235InitialHtml).not.toContain("vllm serve Qwen3-8B");
    // Qualified precision next to minimum card counts
    expect(q235InitialHtml).toContain("当前 BF16 至少 9 卡");
    expect(q235InitialHtml).toContain("改动态 INT8理论最少 5 卡（推荐 8 卡整机并行）");
    // Single primary apply button (no duplicate second apply button) & Step ③ precedes advanced controls
    expect(q235InitialHtml.match(/data-testid="calc-apply-recommended-plan"/g)?.length).toBe(1);
    expect(q235InitialHtml.match(/一键应用推荐/g)?.length).toBe(1);
    expect(q235InitialHtml.indexOf('data-testid="calc-verdict-strip"')).toBeGreaterThan(0);
    expect(q235InitialHtml.indexOf('data-testid="calc-handoff-cli"')).toBeLessThan(
      q235InitialHtml.indexOf('data-testid="calc-advanced-controls"'),
    );

    // Serialize applied canonical state -> URL -> remount SSR -> CLI & Doctor sourceLabel & 3D payload match 100%
    const applied235Params = buildCalculatorQueryParams({
      subMode: "static",
      presetId: "qwen3-235b-a22b",
      cardId: resolved235!.nextState.cardId,
      weightPrecision: resolved235!.nextState.weightPrecision,
      kvCacheDtype: resolved235!.nextState.kvCacheDtype,
      weightNzMode: resolved235!.nextState.weightNzMode,
      tpSize: resolved235!.nextState.tpSize,
      ppSize: resolved235!.nextState.ppSize,
      dpSize: resolved235!.nextState.dpSize,
      pcpSize: resolved235!.nextState.pcpSize,
      dcpSize: resolved235!.nextState.dcpSize,
      enableEp: resolved235!.nextState.enableEp,
      gpuMemoryUtilization: resolved235!.nextState.gpuMemoryUtilization,
      maxModelLen: resolved235!.nextState.maxModelLen,
      maxNumBatchedTokens: resolved235!.nextState.maxNumBatchedTokens,
      maxNumSeqs: resolved235!.nextState.maxNumSeqs,
      cudagraphMode: resolved235!.nextState.cudagraphMode,
      enforceEager: resolved235!.nextState.cudagraphMode === "NONE",
      version: "v0.30.0",
    });
    expect(parseCalculatorQueryParams(applied235Params)).toMatchObject({
      presetId: "qwen3-235b-a22b",
      tpSize: 8,
      ppSize: 1,
      dpSize: 1,
      enableEp: true,
      weightPrecision: "w8a8_dynamic",
    });
    const q235AppliedHtml = await renderUrl(`http://localhost/tools?${applied235Params.toString()}`);
    expect(q235AppliedHtml).not.toContain('data-testid="calc-apply-recommended-plan"');
    expect(q235AppliedHtml).toContain(resolved235!.cliHint);
    expect(formatTopologySummaryBadge(resolved235!.nextPlan.inputSummary)).toBe("TP=8 · EP");
    const hw235Match =
      /data-testid="calc-open-3d-hardware"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-testid="calc-open-3d-hardware"/.exec(
        q235AppliedHtml,
      );
    const hw235Href = (hw235Match?.[1] ?? hw235Match?.[2] ?? "").replaceAll("&amp;", "&");
    const deployToken = new URLSearchParams(hw235Href.slice("#/hardware?".length)).get("deploy") ?? "";
    const paddedB64 = `${deployToken.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (deployToken.length % 4)) % 4)}`;
    const wire235 = JSON.parse(Buffer.from(paddedB64, "base64").toString("utf-8")) as Record<string, unknown>;
    expect(wire235).toMatchObject({
      m: "qwen3-235b-a22b",
      c: "a2-64g",
      tp: 8,
      pp: 1,
      dp: 1,
      ep: 1,
      r: 8,
      oom: "headroom_risk",
      pr: "w8a8_dynamic",
    });

    //    (b) Single canonical patch on `version=main&v2=0` & `u=0.98&cudagraph=FULL` (pre-apply CLI === post-apply CLI)
    const mainMrv1Blocked = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      version: "main",
      useV2ModelRunner: false,
      tpSize: 1,
    });
    expect(isCurrentDeployPlanValid(mainMrv1Blocked)).toBe(false);
    const mainResolved = resolveCanonicalRecommendedPlan(mainMrv1Blocked, {
      version: "main",
      useV2ModelRunner: false,
    });
    expect(mainResolved).not.toBeNull();
    expect(mainResolved!.nextState.useV2ModelRunner).toBeUndefined();
    expect(isCurrentDeployPlanValid(mainResolved!.nextPlan)).toBe(true);
    expect(mainResolved!.cliHint).toBe(buildCurrentPlanCliHint(mainResolved!.nextPlan));
    expect(mainResolved!.cliHint).not.toContain("VLLM_USE_V2_MODEL_RUNNER=0");

    const headroomFullBlocked = evaluateDeployPlan({
      model: "qwen3-8b",
      cardId: "a2-64g",
      gpuMemoryUtilization: 0.98,
      cudagraphMode: "FULL",
      tpSize: 1,
    });
    expect(isCurrentDeployPlanValid(headroomFullBlocked)).toBe(false);
    const headroomResolved = resolveCanonicalRecommendedPlan(headroomFullBlocked, {
      gpuMemoryUtilization: 0.98,
      cudagraphMode: "FULL",
    });
    expect(headroomResolved).not.toBeNull();
    expect(isCurrentDeployPlanValid(headroomResolved!.nextPlan)).toBe(true);
    expect(headroomResolved!.cliHint).toBe(buildCurrentPlanCliHint(headroomResolved!.nextPlan));

    //    (c) `tight_budget_oom_risk` (`warn`) is NOT mislabeled as hard overflow / blocked
    const tightHtml = await renderUrl(
      "http://localhost/tools?tab=calculator&preset=qwen3-8b&card=310p-24g&precision=w8a8_dynamic&tp=1&u=0.84",
    );
    expect(tightHtml).toContain("显存偏紧（可启动，高并发/录图有 OOM 风险）");
    expect(tightHtml).toContain("在 3D 整机中透视此方案 (TP=1 · 显存偏紧) →");
    expect(tightHtml).not.toContain("显存不足（需加卡或降精度）");
    expect(tightHtml).not.toContain("无法直接启动");
    expect(tightHtml).not.toContain("溢出态");

    // 10. 3D Hardware Stage SSR renders distinct transport-init legend, 可见待命 status, and clean initial state
    const { TroubleshootHardwareStage } = await import("./TroubleshootHardwareStage");
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const visReport = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\n10:00:00 ERROR [Rank 0] RuntimeError: NPU out of memory",
    );
    const stageHtmlA = renderToStaticMarkup(
      createElement(TroubleshootHardwareStage, {
        report: visReport,
        defaultCardId: "a2-64g",
        selectedRank: 0,
        onSelectEvidence: () => {},
      }),
    );
    const stageHtmlB = renderToStaticMarkup(
      createElement(TroubleshootHardwareStage, {
        report: visReport,
        defaultCardId: "a2-64g",
        selectedRank: 0,
        onSelectEvidence: () => {},
      }),
    );
    expect(stageHtmlA).toBe(stageHtmlB);
    expect(stageHtmlA).toContain("传输/Ranktable 初始化异常（EI0004 / EI0009 / EJ0001）");
    expect(stageHtmlA).toContain("可见待命");
    expect(stageHtmlA).toContain('data-scene-ready="loading"');
    expect(stageHtmlA).toContain('data-reduced-motion="false"');

    // 11. v5 #17: computeVisibleBounds accounts for per-instance transforms on InstancedMesh
    const THREE = await import("three");
    const { computeVisibleBounds } = await import("./TroubleshootHardwareStage");
    const instGeom = new THREE.BoxGeometry(1, 1, 1);
    const instMatl = new THREE.MeshBasicMaterial();
    const instMesh = new THREE.InstancedMesh(instGeom, instMatl, 2);
    instMesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0));
    instMesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 4.5, 0));
    instMesh.instanceMatrix.needsUpdate = true;
    const instGroup = new THREE.Group();
    instGroup.add(instMesh);
    const instBox = computeVisibleBounds(instGroup);
    expect(instBox.max.y).toBeCloseTo(5, 4);
    expect(instBox.min.y).toBeCloseTo(-0.5, 4);
    instGeom.dispose();
    instMatl.dispose();
  });
});
