import "../../design/tools.css";
import type { ComponentType } from "react";
import {
  KNOWN_WIKI_TOOLS,
  parseWikiToolFence,
  type WikiToolId,
  type WikiToolSpec,
} from "../../content/wiki/toolFence";
import { ConfigDoctorView } from "../tools/ConfigDoctorView";
import { DeployCalculatorView } from "../tools/DeployCalculatorView";

export interface WikiToolRenderProps {
  spec: WikiToolSpec;
}

function EmbeddedDeployCalculator({ spec }: WikiToolRenderProps) {
  const mode =
    spec.mode === "quick-screen" || spec.mode === "minimal" || spec.mode === "full" ? spec.mode : undefined;
  return (
    <DeployCalculatorView
      mode={mode}
      title={spec.title}
      summary={spec.summary}
      initialModel={spec.model}
      embedded
    />
  );
}

function EmbeddedConfigDoctor({ spec }: WikiToolRenderProps) {
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
}

const TOOL_REGISTRY = new Map<WikiToolId, ComponentType<WikiToolRenderProps>>([
  ["deploy-calculator", EmbeddedDeployCalculator],
  ["config-doctor", EmbeddedConfigDoctor],
]);

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
        <Registered spec={spec} />
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
        <span className="wiki-tool-badge">{spec.mode ? `mode: ${spec.mode}` : spec.tool}</span>
      </header>
      {spec.summary && <p className="wiki-tool-summary">{spec.summary}</p>}
      <p className="wiki-tool-note">
        交互工具容器已挂载（<code>{spec.tool}</code>），将在 Wave 3/4 接入完整交互面板。
      </p>
    </section>
  );
}
