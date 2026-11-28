import "../../design/tools.css";
import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import {
  KNOWN_WIKI_TOOLS,
  parseWikiToolFence,
  type WikiToolId,
  type WikiToolSpec,
} from "../../content/wiki/toolFence";

export interface WikiToolRenderProps {
  spec: WikiToolSpec;
}

const pendingTestPreloads: Array<Promise<void>> = [];

function createLazyTool(
  loader: () => Promise<{ default: ComponentType<WikiToolRenderProps> }>,
): LazyExoticComponent<ComponentType<WikiToolRenderProps>> {
  let preloaded: { default: ComponentType<WikiToolRenderProps> } | undefined;
  if (import.meta.env.MODE === "test") {
    pendingTestPreloads.push(
      loader().then((mod) => {
        preloaded = mod;
      }),
    );
  }
  return lazy(() => {
    if (preloaded) {
      const resolved = preloaded;
      return {
        // biome-ignore lint/suspicious/noThenProperty: React 19 lazy() requires a synchronous Thenable during Vitest SSR renderToStaticMarkup
        then(onfulfilled) {
          return Promise.resolve(onfulfilled ? onfulfilled(resolved) : (resolved as never));
        },
      } as PromiseLike<{ default: ComponentType<WikiToolRenderProps> }> as Promise<{
        default: ComponentType<WikiToolRenderProps>;
      }>;
    }
    return loader();
  });
}

const LazyDeployCalculator = createLazyTool(async () => {
  const { DeployCalculatorView } = await import("../tools/DeployCalculatorView");
  return {
    default: function EmbeddedDeployCalculator({ spec }: WikiToolRenderProps) {
      const mode =
        spec.mode === "quick-screen" || spec.mode === "minimal" || spec.mode === "full"
          ? spec.mode
          : undefined;
      return (
        <DeployCalculatorView
          mode={mode}
          title={spec.title}
          summary={spec.summary}
          initialModel={spec.model}
          embedded
        />
      );
    },
  };
});

const LazyConfigDoctor = createLazyTool(async () => {
  const { ConfigDoctorView } = await import("../tools/ConfigDoctorView");
  return {
    default: function EmbeddedConfigDoctor({ spec }: WikiToolRenderProps) {
      const mode = spec.mode === "minimal" || spec.mode === "full" ? spec.mode : undefined;
      return (
        <ConfigDoctorView
          mode={mode}
          title={spec.title}
          summary={spec.summary}
          initialPresetId={spec.preset}
          embedded
        />
      );
    },
  };
});

const LazyTroubleshootWorkbench = createLazyTool(async () => {
  const { WikiTroubleshootWorkbenchBlock } = await import("../tools/TroubleshootWorkbenchView");
  return { default: WikiTroubleshootWorkbenchBlock };
});

const LazyAiCoreLab = createLazyTool(async () => {
  const { WikiAiCoreLabBlock } = await import("../tools/AiCoreLabView");
  return { default: WikiAiCoreLabBlock };
});

const LazyFormulaRuler = createLazyTool(async () => {
  const { WikiFormulaRulerBlock } = await import("../tools/FormulaRulerView");
  return { default: WikiFormulaRulerBlock };
});

const LazyKnobRadar = createLazyTool(async () => {
  const { WikiKnobRadarBlock } = await import("../tools/AscendKnobRadarView");
  return { default: WikiKnobRadarBlock };
});

if (import.meta.env.MODE === "test") {
  await Promise.all(pendingTestPreloads);
}

const TOOL_REGISTRY = new Map<WikiToolId, LazyExoticComponent<ComponentType<WikiToolRenderProps>>>([
  ["deploy-calculator", LazyDeployCalculator],
  ["config-doctor", LazyConfigDoctor],
  ["troubleshoot-workbench", LazyTroubleshootWorkbench],
  ["aicore-lab", LazyAiCoreLab],
  ["formula-ruler", LazyFormulaRuler],
  ["knob-radar", LazyKnobRadar],
]);

const TOOL_MODE_LABELS: Readonly<Record<string, string>> = {
  single: "单场景",
  full: "完整模式",
  "quick-screen": "快速摸底",
  minimal: "精简模式",
  logs: "日志定位",
  timeline: "时序沙箱",
  "kv-token-bytes": "单词与分块 KV",
  "gqa-ratio": "GQA 压缩与复制",
  "mla-compression": "MLA 潜向量压缩",
  "tp-shard-comm": "TP 分片与通信",
  "moe-ep-dispatch": "MoE 专家与派发",
  "cold-start-budget": "7 级冷启动预算",
};

export function formatWikiToolModeBadge(mode: string | undefined, fallback: string): string {
  if (!mode) return fallback;
  return TOOL_MODE_LABELS[mode] ?? mode;
}

export function WikiToolBlock({ source }: { source: string }) {
  const parsed = parseWikiToolFence(source);
  if (!parsed.ok) {
    return (
      <section className="wiki-tool wiki-tool-invalid" data-testid="wiki-tool-invalid" role="note">
        <header className="wiki-tool-head">
          <span className="wiki-tool-badge">wiki-tool 语法错误</span>
        </header>
        <ul className="wiki-tool-errors">
          {parsed.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </section>
    );
  }

  const { spec } = parsed;
  const meta = KNOWN_WIKI_TOOLS[spec.tool];
  const Registered = TOOL_REGISTRY.get(spec.tool);
  const displayTitle = spec.title ?? meta.title;
  const modeLabel = spec.mode ?? "default";

  if (Registered) {
    return (
      <section
        className="wiki-tool"
        data-testid={`wiki-tool-${spec.tool}`}
        data-tool={spec.tool}
        data-mode={modeLabel}
        aria-label={displayTitle}
      >
        <Suspense
          fallback={
            <div className="wiki-tool-loading" role="status" data-testid={`wiki-tool-loading-${spec.tool}`}>
              <header className="wiki-tool-head">
                <strong className="wiki-tool-title">{displayTitle}</strong>
                <span className="wiki-tool-badge">{formatWikiToolModeBadge(spec.mode, meta.title)}</span>
              </header>
              {spec.summary && <p className="wiki-tool-summary">{spec.summary}</p>}
              <p className="wiki-tool-note">正在按需加载交互工具面板…</p>
            </div>
          }
        >
          <Registered spec={spec} />
        </Suspense>
      </section>
    );
  }

  return (
    <section
      className="wiki-tool wiki-tool-placeholder"
      data-testid={`wiki-tool-${spec.tool}`}
      data-tool={spec.tool}
      data-mode={modeLabel}
      aria-label={displayTitle}
    >
      <header className="wiki-tool-head">
        <strong className="wiki-tool-title">{displayTitle}</strong>
        <span className="wiki-tool-badge">{formatWikiToolModeBadge(spec.mode, meta.title)}</span>
      </header>
      {spec.summary && <p className="wiki-tool-summary">{spec.summary}</p>}
      <p className="wiki-tool-note">
        交互工具容器已挂载（<code>{spec.tool}</code>），将在 Wave 3/4 接入完整交互面板。
      </p>
    </section>
  );
}
