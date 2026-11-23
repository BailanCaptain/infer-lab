import "../../design/tools.css";
import { type CSSProperties, type MouseEvent, useId, useMemo, useState } from "react";
import { sourceUrl } from "../../content/wiki/index";
import { parseRepoRef } from "../../content/wiki/schema";
import type { WikiToolSpec } from "../../content/wiki/toolFence";
import { getTroubleshootFixture, TROUBLESHOOT_FIXTURES } from "../../sim/troubleshoot/fixtures";
import {
  analyzeTroubleshootInput,
  type FirstFaultConfidence,
  type LogAnalysisReport,
  type LogDiagnosisFinding,
  type TroubleshootSeverity,
} from "../../sim/troubleshoot/logAnalyzer";
import {
  getTimelineScenario,
  getTimelineSnapshot,
  SCHEMATIC_TRACE_BADGE_TEXT,
  type SpanRole,
  TIMELINE_SCENARIOS,
  type TimelineScenarioId,
  type TimelineSnapshot,
  type TimelineSpan,
} from "../../sim/troubleshoot/timelineSandbox";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkById } from "./ToolDeepLinkChip";
import {
  buildTroubleshootChatAnalysis,
  hasReconcilableStartupMetrics,
  sanitizeDiagnosticText,
  workbenchHandoffStore,
} from "./workbenchHandoff";

export type TroubleshootMode = "logs" | "timeline" | "full";
type ActiveWorkbenchPanel = "logs" | "timeline";

const SEVERITY_META: Readonly<Record<TroubleshootSeverity, { label: string; cls: string }>> = {
  error: { label: "故障定位 error", cls: "is-error" },
  warn: { label: "性能/风险 warn", cls: "is-warn" },
  info: { label: "诊断提示 info", cls: "is-unknown" },
};

const CONFIDENCE_META: Readonly<Record<FirstFaultConfidence, { label: string; cls: string }>> = {
  high: { label: "置信度: 高", cls: "is-error" },
  medium: { label: "置信度: 中", cls: "is-silent-rewrite" },
  low: { label: "置信度: 低（需补证据）", cls: "is-unknown" },
};

const CATEGORY_LABELS: Readonly<Record<LogDiagnosisFinding["category"], string>> = {
  memory: "显存与容量",
  distributed: "HCCL 集合通信",
  "os-process": "主机 / 容器进程",
  compatibility: "芯片与量化兼容",
  graph: "ACLGraph / 编译",
  metrics: "/metrics 性能指标",
  "kv-transfer": "P/D KV 传输",
};

const SPAN_ROLE_STYLE: Readonly<
  Record<SpanRole, { fill: string; stroke: string; text: string; legend: string }>
> = {
  compute: {
    fill: "var(--color-weight-soft)",
    stroke: "var(--color-weight)",
    text: "var(--color-ink)",
    legend: "NPU 计算",
  },
  comm: {
    fill: "var(--color-comm-soft)",
    stroke: "var(--color-comm)",
    text: "var(--color-comm)",
    legend: "HCCL 通信",
  },
  host: {
    fill: "var(--color-surface-sunken)",
    stroke: "var(--color-control)",
    text: "var(--color-ink)",
    legend: "Host 调度/下发",
  },
  kv: {
    fill: "var(--color-kv-soft)",
    stroke: "var(--color-kv)",
    text: "var(--color-kv)",
    legend: "KV 块池",
  },
  proxy: {
    fill: "var(--color-token-soft)",
    stroke: "var(--color-token)",
    text: "var(--color-token)",
    legend: "代理透传",
  },
  output: {
    fill: "var(--color-token-soft)",
    stroke: "var(--color-token)",
    text: "var(--color-token)",
    legend: "流式输出/完成",
  },
  "wait-bubble": {
    fill: "var(--color-canvas)",
    stroke: "var(--color-line-strong)",
    text: "var(--color-ink-muted)",
    legend: "空泡 / 等待阻塞",
  },
  fault: {
    fill: "var(--color-accent-soft)",
    stroke: "var(--color-danger)",
    text: "var(--color-danger)",
    legend: "故障 / 瓶颈热点",
  },
};

function SourceRefLink({ rawRef }: { rawRef: string }) {
  const parsed = parseRepoRef(rawRef);
  const href = parsed ? sourceUrl(parsed) : null;
  if (href) {
    return (
      <a className="wt-source-link" href={href} target="_blank" rel="noreferrer">
        {rawRef}
      </a>
    );
  }
  return <code className="wt-source-link wt-source-link-plain">{rawRef}</code>;
}

function buildTroubleshootAssistantPrompt(report: LogAnalysisReport): string {
  const { firstFaultVerdict, findings } = report;
  const verdictLine =
    firstFaultVerdict.rank !== null
      ? `首错 Rank 判定：Rank ${firstFaultVerdict.rank}（${CONFIDENCE_META[firstFaultVerdict.confidence].label}）— ${firstFaultVerdict.rationale}`
      : `首错 Rank 判定：暂未锁定单一 Rank（${CONFIDENCE_META[firstFaultVerdict.confidence].label}）— ${firstFaultVerdict.rationale}`;

  const evidenceBlock =
    firstFaultVerdict.primaryEvidenceLines.length > 0
      ? firstFaultVerdict.primaryEvidenceLines
          .slice(0, 5)
          .map(
            (ev) =>
              `- [L${ev.lineNumber}${ev.rank !== null ? ` / Rank ${ev.rank}` : ""}${ev.timestamp ? ` / ${ev.timestamp}` : ""} / ${ev.kind === "root-cause" ? "主故障" : "次生超时"}] ${ev.rawLine}`,
          )
      : ["- （当前输入以 /metrics 指标或无显式异常行为主）"];

  const topFindings =
    findings.length > 0
      ? findings
          .slice(0, 4)
          .map((f, idx) => `${idx + 1}. [${f.ruleId} · 证据 ${f.evidenceLevel}] ${f.title}：${f.summary}`)
      : ["当前未命中内置排障规则，请结合原始片段协助定位最后成功阶段与下一项取证命令。"];

  return [
    "请结合 vllm-ascend (v0.30.0) 源码与排障流程，帮我深究以下在线排障工作台的分析结果：",
    "",
    verdictLine,
    "",
    "关键证据行：",
    ...evidenceBlock,
    "",
    "命中的规则诊断：",
    ...topFindings,
    "",
    "请确认当前最优先的根因方向，并给出最小单项对照实验与验收标准。",
  ].join("\n");
}

const EVIDENCE_LIST_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 6,
};

const EVIDENCE_ROW_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "6px 8px",
  padding: "6px 10px",
  borderRadius: "var(--radius-field)",
  border: "1px solid var(--color-line)",
  background: "var(--color-surface)",
  fontSize: "13.5px",
  lineHeight: 1.5,
};

const CMD_BLOCK_STYLE: CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "7px 10px",
  borderRadius: "var(--radius-field)",
  border: "1px solid var(--color-line)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "13.5px",
  lineHeight: 1.5,
  overflowX: "auto",
  wordBreak: "break-word",
};

function FirstFaultVerdictCard({
  report,
  isSampleDemo = false,
}: {
  report: LogAnalysisReport;
  isSampleDemo?: boolean;
}) {
  const { firstFaultVerdict } = report;
  const conf = CONFIDENCE_META[firstFaultVerdict.confidence];
  const cardTone =
    firstFaultVerdict.rank !== null
      ? "is-error"
      : firstFaultVerdict.primaryEvidenceLines.length > 0
        ? "is-warn"
        : "is-unknown";

  return (
    <section
      className={`wt-finding-card ${cardTone}`}
      data-testid="first-fault-verdict"
      data-first-fault-rank={firstFaultVerdict.rank === null ? "none" : String(firstFaultVerdict.rank)}
      data-confidence={firstFaultVerdict.confidence}
    >
      <div className="wt-finding-head">
        {isSampleDemo && <span className="wt-demo-badge">示例演练</span>}
        <span className={`wt-badge-judgment ${conf.cls}`}>{conf.label}</span>
        {firstFaultVerdict.rank !== null ? (
          <span className="wt-badge-scope">首错 Rank: {firstFaultVerdict.rank}</span>
        ) : (
          <span className="wt-badge-evidence">未锁定单一首错 Rank</span>
        )}
        {firstFaultVerdict.cascadeRanks.length > 0 && (
          <span className="wt-badge-evidence">
            次生连带 Rank: {firstFaultVerdict.cascadeRanks.join(" / ")}
          </span>
        )}
        <h3 className="wt-finding-title">最早出错的卡（首错 Rank）判定</h3>
      </div>

      <p className="wt-finding-msg">{firstFaultVerdict.rationale}</p>

      {firstFaultVerdict.primaryEvidenceLines.length > 0 && (
        <div style={EVIDENCE_LIST_STYLE}>
          {firstFaultVerdict.primaryEvidenceLines.map((ev) => (
            <div key={`ff-${ev.lineNumber}-${ev.kind}`} style={EVIDENCE_ROW_STYLE}>
              <span className={`wt-badge-judgment ${ev.kind === "root-cause" ? "is-error" : "is-warn"}`}>
                {ev.kind === "root-cause" ? "主故障" : "次生超时"}
              </span>
              <span className="wt-baseline-pill">
                L{ev.lineNumber}
                {ev.rank !== null ? ` · Rank ${ev.rank}` : ""}
                {ev.timestamp ? ` · ${ev.timestamp}` : ""}
              </span>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "13.5px", wordBreak: "break-all" }}>
                {ev.rawLine}
              </code>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MetricsSnapshotBar({ report }: { report: LogAnalysisReport }) {
  const m = report.metrics;
  if (!m.hasMetrics) return null;

  const kvPct = m.kvCacheUsageRatio !== undefined ? `${(m.kvCacheUsageRatio * 100).toFixed(1)}%` : "—";
  const ttftMs = m.ttftAvgSec !== undefined ? `${(m.ttftAvgSec * 1000).toFixed(0)} ms` : "—";
  const itlMs = m.itlAvgSec !== undefined ? `${(m.itlAvgSec * 1000).toFixed(1)} ms/tok` : "—";

  return (
    <section className="wt-section" data-testid="troubleshoot-metrics-snapshot">
      <div className="wt-section-head">
        <h3 className="wt-section-title">Prometheus /metrics 快照解析</h3>
        <span className="wt-section-meta">已识别 {m.rawMetricCount} 条 vllm:* 指标</span>
      </div>
      <div className="wt-kpi-grid">
        <div className="wt-kpi-card">
          <div className="wt-insight-title">
            <span>KV Cache 使用率</span>
            <span className="wt-baseline-pill">kv_cache_usage_perc</span>
          </div>
          <div className="wt-insight-value">{kvPct}</div>
        </div>
        <div className="wt-kpi-card">
          <div className="wt-insight-title">
            <span>运行 / 排队请求</span>
            <span className="wt-baseline-pill">running / waiting</span>
          </div>
          <div className="wt-insight-value">
            {m.numRequestsRunning ?? "—"} / {m.numRequestsWaiting ?? "—"}
          </div>
        </div>
        <div className="wt-kpi-card">
          <div className="wt-insight-title">
            <span>累计抢占次数</span>
            <span className="wt-baseline-pill">num_preemptions</span>
          </div>
          <div className="wt-insight-value">{m.numPreemptionsTotal ?? "—"}</div>
        </div>
        <div className="wt-kpi-card">
          <div className="wt-insight-title">
            <span>平均 TTFT / ITL</span>
            <span className="wt-baseline-pill">均值推导 [D]</span>
          </div>
          <div className="wt-insight-value">
            {ttftMs} · {itlMs}
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagnosisFindingCard({ finding }: { finding: LogDiagnosisFinding }) {
  const sev = SEVERITY_META[finding.severity];
  return (
    <article
      className={`wt-finding-card ${sev.cls}`}
      data-testid={`troubleshoot-finding-${finding.ruleId}`}
      data-severity={finding.severity}
    >
      <div className="wt-finding-head">
        <span className={`wt-badge-judgment ${sev.cls}`}>{sev.label}</span>
        <span className="wt-badge-scope">{CATEGORY_LABELS[finding.category]}</span>
        <span className="wt-badge-evidence">证据 [{finding.evidenceLevel}]</span>
        <h4 className="wt-finding-title">{finding.title}</h4>
      </div>

      <p className="wt-finding-msg">{finding.summary}</p>
      <p className="wt-insight-meta">
        <strong>源码与机制依据：</strong>
        {finding.mechanism}
      </p>

      <div className="wt-finding-remediation">
        <div>
          <strong>最小区分实验：</strong>
          {finding.experimentStep}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>下一步现场取证命令：</strong>
          <code style={CMD_BLOCK_STYLE}>{finding.nextEvidenceCmd}</code>
        </div>
      </div>

      {finding.matchedLines.length > 0 && (
        <div style={EVIDENCE_LIST_STYLE}>
          {finding.matchedLines.map((line) => (
            <div key={`${finding.ruleId}-L${line.lineNumber}`} style={EVIDENCE_ROW_STYLE}>
              <span className="wt-baseline-pill">
                命中 L{line.lineNumber}
                {line.rank !== null ? ` · Rank ${line.rank}` : ""}
              </span>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "13.5px", wordBreak: "break-all" }}>
                {line.rawLine}
              </code>
            </div>
          ))}
        </div>
      )}

      {(finding.sources.length > 0 || finding.wikiPageIds.length > 0) && (
        <div className="wt-finding-footer">
          {finding.sources.length > 0 && (
            <div className="wt-source-links">
              {finding.sources.map((src) => (
                <SourceRefLink key={`${finding.ruleId}-src-${src}`} rawRef={src} />
              ))}
            </div>
          )}
          {finding.wikiPageIds.length > 0 && (
            <div className="wt-deeplinks">
              {finding.wikiPageIds.map((pageId) => (
                <ToolDeepLinkById key={`${finding.ruleId}-wiki-${pageId}`} pageId={pageId} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function RealLogAnalyzerPanel({
  activeFixtureId,
  rawInput,
  onSelectFixture,
  onClear,
  onRawInputChange,
  onAskAssistant,
  onHandoffToReconcile,
  hasAssistant,
}: {
  activeFixtureId: string;
  rawInput: string;
  onSelectFixture: (fixtureId: string) => void;
  onClear: () => void;
  onRawInputChange: (next: string) => void;
  onAskAssistant: (report: LogAnalysisReport, rawInput: string, trigger: HTMLButtonElement) => void;
  onHandoffToReconcile: (rawInput: string, report: LogAnalysisReport) => void;
  hasAssistant: boolean;
}) {
  const idPrefix = useId();
  const report = useMemo(() => analyzeTroubleshootInput(rawInput), [rawInput]);
  const canReconcile = useMemo(() => hasReconcilableStartupMetrics(rawInput), [rawInput]);
  const activeFixture = TROUBLESHOOT_FIXTURES.find((f) => f.id === activeFixtureId);

  return (
    <div className="wt-section" data-testid="troubleshoot-panel-a">
      {activeFixture && (
        <div className="wt-demo-banner" data-testid="troubleshoot-demo-banner" role="status">
          <div className="wt-demo-banner-main">
            <span className="wt-demo-badge">内置示例</span>
            <span>
              当前展示示例日志（<strong>{activeFixture.label}</strong>），不是你的真实服务报错。
            </span>
          </div>
          <button
            type="button"
            className="wt-assistant-btn"
            data-testid="troubleshoot-clear-input"
            onClick={onClear}
          >
            清空并粘贴你的真实日志
          </button>
        </div>
      )}

      <div className="wt-presets">
        <span className="wt-presets-label">演练样例（点击体验解析效果）：</span>
        {TROUBLESHOOT_FIXTURES.map((fixture) => {
          const isActive = fixture.id === activeFixtureId;
          return (
            <button
              key={fixture.id}
              type="button"
              className={`wt-preset-btn ${isActive ? "is-active" : ""}`}
              data-testid={`troubleshoot-fixture-${fixture.id}`}
              onClick={() => onSelectFixture(fixture.id)}
            >
              <span className={`wt-preset-dot ${fixture.kind === "metrics" ? "is-healthy" : "is-pitfall"}`} />
              <span>{fixture.label}</span>
            </button>
          );
        })}
        {!activeFixture && rawInput.length > 0 && (
          <button
            type="button"
            className="wt-filter-btn"
            data-testid="troubleshoot-clear-input"
            onClick={onClear}
          >
            清空当前日志
          </button>
        )}
      </div>

      {activeFixture && <p className="wt-preset-summary">{activeFixture.summary}</p>}

      <div className="wt-editor-card">
        <div className="wt-editor-head">
          <label className="wt-editor-title" htmlFor={`${idPrefix}-log-input`}>
            粘贴你的报错日志、CANN/HCCL 错误码或 /metrics 指标
          </label>
          <span className="wt-editor-role">
            {report.totalLines > 0
              ? `${report.totalLines} 行 · ${report.detectedRanks.length > 0 ? `识别 Rank: ${report.detectedRanks.join(", ")}` : report.inputKind === "metrics" ? "纯 /metrics" : "单进程/无 Rank 标签"}`
              : "等待粘贴"}
          </span>
        </div>
        <textarea
          id={`${idPrefix}-log-input`}
          className="wt-textarea"
          data-testid="troubleshoot-log-input"
          spellCheck={false}
          placeholder="粘贴多卡交错启动日志、CANN/HCCL 报错（EZ9999 / EI0006 / exitcode -9）或 curl /metrics 快照…"
          value={rawInput}
          onChange={(e) => onRawInputChange(e.target.value)}
        />
      </div>

      <div
        className={`wt-summary-bar ${report.findings.some((f) => f.severity === "error") ? "is-blocked" : "is-pass"}`}
        data-testid="troubleshoot-summary-bar"
      >
        <div className="wt-summary-left">
          <span className="wt-stat-pill is-error">命中规则 {report.findings.length}</span>
          {report.firstFaultVerdict.rank !== null && (
            <span className="wt-stat-pill is-rewrite">首错 Rank {report.firstFaultVerdict.rank}</span>
          )}
          {report.firstFaultVerdict.cascadeRanks.length > 0 && (
            <span className="wt-stat-pill is-warn">
              次生超时 Rank {report.firstFaultVerdict.cascadeRanks.join("/")}
            </span>
          )}
          {report.metrics.hasMetrics && <span className="wt-stat-pill is-unknown">/metrics 已解析</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {canReconcile && (
            <button
              type="button"
              className="wt-preset-btn"
              data-testid="handoff-to-reconcile"
              onClick={() => onHandoffToReconcile(rawInput, report)}
            >
              送去启动对账 →
            </button>
          )}
          {hasAssistant && (
            <button
              type="button"
              className="wt-assistant-btn"
              data-testid="troubleshoot-ask-assistant"
              onClick={(e: MouseEvent<HTMLButtonElement>) =>
                onAskAssistant(report, rawInput, e.currentTarget)
              }
            >
              打包首错与证据送入问答助手
            </button>
          )}
        </div>
      </div>

      {report.inputKind !== "metrics" && (
        <FirstFaultVerdictCard report={report} isSampleDemo={Boolean(activeFixture)} />
      )}
      <MetricsSnapshotBar report={report} />

      <section className="wt-section" data-testid="troubleshoot-findings-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">规则诊断与下一步取证（{report.findings.length}）</h3>
          <span className="wt-section-meta">仅基于上方粘贴的真实日志 / 指标判定，不混入右侧时序演示</span>
        </div>

        {report.findings.length === 0 ? (
          <div className="wt-empty-state">
            当前输入未命中内置故障规则。请确认是否已粘贴包含完整 traceback、错误码（如 EI0006 / EZ9999 /
            exitcode）或 Prometheus <code className="wt-code-inline">vllm:*</code> 指标的原始片段。
          </div>
        ) : (
          <div className="wt-findings-list">
            {report.findings.map((finding) => (
              <DiagnosisFindingCard key={finding.ruleId} finding={finding} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const SCHEMATIC_BADGE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: "var(--radius-field)",
  border: "1px solid color-mix(in srgb, var(--color-weight) 50%, var(--color-line))",
  background: "var(--color-weight-soft)",
  color: "var(--color-warning)",
  fontSize: "13.5px",
  fontWeight: 700,
};

const SVG_CARD_STYLE: CSSProperties = {
  padding: "14px 16px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-line)",
  background: "var(--color-surface-elevated)",
  overflowX: "auto",
};

const LEGEND_ROW_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px 14px",
  marginTop: 10,
  fontSize: "13.5px",
  color: "var(--color-ink-muted)",
};

const RELATIVE_TICKS = [
  { pos: 0, label: "t₀" },
  { pos: 25, label: "t₁" },
  { pos: 50, label: "t₂" },
  { pos: 75, label: "t₃" },
  { pos: 100, label: "t₄" },
] as const;

function estimateCharWidthPx(ch: string): number {
  return ch.charCodeAt(0) > 0x7f ? 13 : 8;
}

function fitSpanLabel(label: string, spanWidthPx: number): string | null {
  const avail = spanWidthPx - 14;
  if (avail < 26) return null;

  let total = 0;
  for (const ch of label) {
    total += estimateCharWidthPx(ch);
  }
  if (total <= avail) return label;

  const budget = avail - 13;
  let used = 0;
  let out = "";
  for (const ch of label) {
    const w = estimateCharWidthPx(ch);
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  const trimmed = out.trimEnd();
  return trimmed.length > 0 ? `${trimmed}…` : null;
}

function SchematicSwimlaneSvg({
  snapshot,
  selectedSpanId,
  onSelectSpan,
}: {
  snapshot: TimelineSnapshot;
  selectedSpanId: string | null;
  onSelectSpan: (span: TimelineSpan) => void;
}) {
  const labelW = 168;
  const plotW = 700;
  const rightPad = 24;
  const totalW = labelW + plotW + rightPad;
  const topAxisH = 34;
  const laneH = 54;
  const plotBottom = topAxisH + snapshot.lanes.length * laneH;

  const xOf = (pct: number) => labelW + (pct / 100) * plotW;

  const sortedMarkers = [...snapshot.markers].sort((a, b) => a.at - b.at);
  const rowEnds: number[] = [];
  const laidOutMarkers = sortedMarkers.map((marker) => {
    const mx = xOf(marker.at);
    const estWidth = 24 + marker.label.length * 13;
    let textAnchor: "start" | "end" = "start";
    let textX = mx + 5;
    let left = textX;
    let right = textX + estWidth;

    if (right > totalW - 8) {
      textAnchor = "end";
      textX = Math.max(labelW + estWidth, mx - 5);
      if (textX > totalW - 8) textX = totalW - 8;
      left = textX - estWidth;
      right = textX;
    }

    let row = rowEnds.findIndex((endX) => left >= endX + 14);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(right);
    } else {
      rowEnds[row] = right;
    }

    return { marker, mx, textX, textAnchor, row };
  });

  const markerRowPitch = 22;
  const markerRows = Math.max(1, rowEnds.length);
  const bottomPad = 12 + markerRows * markerRowPitch;
  const totalH = plotBottom + bottomPad;

  return (
    <div style={SVG_CARD_STYLE} data-testid="schematic-swimlane-svg">
      <div className="wt-section-head" style={{ marginBottom: 8 }}>
        <strong style={{ fontSize: "14px", color: "var(--color-ink)" }}>{snapshot.stateLabel}</strong>
        <span className="wt-section-meta">{snapshot.relativeAxisCaption}</span>
      </div>

      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        role="img"
        aria-label={`${SCHEMATIC_TRACE_BADGE_TEXT}：${snapshot.stateLabel}`}
        style={{ display: "block", minWidth: 620, height: "auto" }}
      >
        {/* Dimensionless relative grid ticks */}
        {RELATIVE_TICKS.map((tick) => {
          const x = xOf(tick.pos);
          return (
            <g key={tick.label}>
              <line
                x1={x}
                y1={topAxisH - 6}
                x2={x}
                y2={totalH - bottomPad}
                stroke="var(--color-line)"
                strokeDasharray="3 4"
                strokeWidth={1}
              />
              <text
                x={x}
                y={18}
                textAnchor="middle"
                fill="var(--color-ink-muted)"
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px", fontWeight: 600 }}
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Lanes & spans */}
        {snapshot.lanes.map((lane, idx) => {
          const y = topAxisH + idx * laneH;
          return (
            <g key={lane.id}>
              <rect
                x={0}
                y={y}
                width={totalW}
                height={laneH - 6}
                rx={8}
                fill={idx % 2 === 0 ? "var(--color-surface)" : "var(--color-canvas)"}
                stroke="var(--color-line)"
                strokeWidth={0.8}
              />
              <text
                x={12}
                y={y + 21}
                fill="var(--color-ink)"
                style={{ fontFamily: "var(--font-sans)", fontSize: "13.5px", fontWeight: 700 }}
              >
                {lane.label}
              </text>
              <text
                x={12}
                y={y + 39}
                fill="var(--color-ink-muted)"
                style={{ fontFamily: "var(--font-sans)", fontSize: "12px" }}
              >
                {lane.sublabel}
              </text>

              {lane.spans.map((span) => {
                const sx = xOf(span.start);
                const sw = Math.max(12, xOf(span.end) - sx);
                const roleStyle = SPAN_ROLE_STYLE[span.role];
                const isSelected = selectedSpanId === span.id;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: SVG <g> cannot use HTML <button>
                  <g
                    key={span.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${span.label}：${span.detail}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelectSpan(span)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectSpan(span);
                      }
                    }}
                  >
                    <title>{`${span.label}：${span.detail}`}</title>
                    <rect
                      x={sx}
                      y={y + 8}
                      width={sw}
                      height={32}
                      rx={6}
                      fill={roleStyle.fill}
                      stroke={isSelected ? "var(--color-accent)" : roleStyle.stroke}
                      strokeWidth={isSelected ? 2.2 : 1.3}
                      strokeDasharray={span.role === "wait-bubble" ? "4 3" : undefined}
                    />
                    {(() => {
                      const fitted = fitSpanLabel(span.label, sw);
                      if (!fitted) return null;
                      return (
                        <text
                          x={sx + 7}
                          y={y + 28}
                          fill={roleStyle.text}
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          {fitted}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Relative phase markers: lines first, staggered paper-halo labels on top */}
        {laidOutMarkers.map(({ marker, mx, row }) => {
          const color =
            marker.tone === "fault"
              ? "var(--color-danger)"
              : marker.tone === "fixed"
                ? "var(--color-token)"
                : "var(--color-kv)";
          const labelY = plotBottom + 16 + row * markerRowPitch;
          return (
            <line
              key={`line-${marker.at}-${marker.label}`}
              x1={mx}
              y1={topAxisH - 4}
              x2={mx}
              y2={labelY - 12}
              stroke={color}
              strokeWidth={1.6}
              strokeDasharray="4 2"
            />
          );
        })}
        {laidOutMarkers.map(({ marker, textX, textAnchor, row }) => {
          const color =
            marker.tone === "fault"
              ? "var(--color-danger)"
              : marker.tone === "fixed"
                ? "var(--color-token)"
                : "var(--color-kv)";
          const labelY = plotBottom + 16 + row * markerRowPitch;
          return (
            <text
              key={`label-${marker.at}-${marker.label}`}
              x={textX}
              y={labelY}
              textAnchor={textAnchor}
              fill={color}
              stroke="var(--color-surface-elevated)"
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke"
              style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700 }}
            >
              ▲ {marker.label}
            </text>
          );
        })}
      </svg>

      <div style={LEGEND_ROW_STYLE}>
        {(["compute", "comm", "host", "kv", "output", "wait-bubble", "fault"] as const).map((role) => (
          <span key={role} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: SPAN_ROLE_STYLE[role].fill,
                border: `1.5px solid ${SPAN_ROLE_STYLE[role].stroke}`,
                display: "inline-block",
              }}
            />
            <span>{SPAN_ROLE_STYLE[role].legend}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SchematicTimelinePanel({ initialScenarioId }: { initialScenarioId?: string | undefined }) {
  const idPrefix = useId();
  const initialScenario = useMemo(() => getTimelineScenario(initialScenarioId), [initialScenarioId]);
  const [scenarioId, setScenarioId] = useState<TimelineScenarioId>(initialScenario.id);
  const [counterfactualOn, setCounterfactualOn] = useState<boolean>(false);
  const [selectedSpan, setSelectedSpan] = useState<TimelineSpan | null>(null);

  const scenario = useMemo(() => getTimelineScenario(scenarioId), [scenarioId]);
  const snapshot = useMemo(
    () => getTimelineSnapshot(scenario.id, counterfactualOn),
    [scenario.id, counterfactualOn],
  );

  const handleSelectScenario = (nextId: TimelineScenarioId) => {
    setScenarioId(nextId);
    setCounterfactualOn(false);
    setSelectedSpan(null);
  };

  return (
    <div className="wt-section" data-testid="troubleshoot-panel-b">
      <div className="wt-toolbar-row">
        <div style={SCHEMATIC_BADGE_STYLE} data-testid="schematic-trace-badge" role="note">
          <span>「{SCHEMATIC_TRACE_BADGE_TEXT}」</span>
        </div>
        <label className="wt-checkbox-label" htmlFor={`${idPrefix}-cf-toggle`}>
          <input
            id={`${idPrefix}-cf-toggle`}
            type="checkbox"
            data-testid="counterfactual-toggle"
            checked={counterfactualOn}
            onChange={(e) => {
              setCounterfactualOn(e.target.checked);
              setSelectedSpan(null);
            }}
          />
          <span>开启对策验证（Counterfactual 对比）</span>
        </label>
      </div>

      <div className="wt-presets">
        <span className="wt-presets-label">六大典型故障沙箱：</span>
        {TIMELINE_SCENARIOS.map((item) => {
          const isActive = item.id === scenario.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`wt-preset-btn ${isActive ? "is-active" : ""}`}
              data-testid={`timeline-scenario-${item.id}`}
              onClick={() => handleSelectScenario(item.id)}
            >
              <span
                className={`wt-preset-dot ${counterfactualOn && isActive ? "is-healthy" : "is-pitfall"}`}
              />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <article className={`wt-finding-card ${counterfactualOn ? "is-warn" : "is-error"}`}>
        <div className="wt-finding-head">
          <span className={`wt-badge-judgment ${counterfactualOn ? "is-warn" : "is-error"}`}>
            {counterfactualOn ? "对策验证态" : "故障现象态"}
          </span>
          <span className="wt-badge-evidence">教学示意 [I]</span>
          <h3 className="wt-finding-title">{scenario.title}</h3>
        </div>
        <p className="wt-finding-msg">{scenario.symptomSummary}</p>
        <p className="wt-insight-meta">
          <strong>阶段边界问题：</strong>
          {scenario.boundaryQuestion}
        </p>
        <p className="wt-finding-remediation">
          <strong>
            {counterfactualOn ? `已开启对策 · ${scenario.counterfactualLabel}：` : "瓶颈读图提示："}
          </strong>
          {counterfactualOn ? scenario.counterfactualSummary : snapshot.bottleneckCallout}
        </p>
      </article>

      <SchematicSwimlaneSvg
        snapshot={snapshot}
        selectedSpanId={selectedSpan?.id ?? null}
        onSelectSpan={setSelectedSpan}
      />

      {selectedSpan && (
        <div className="wt-preset-summary" data-testid="timeline-selected-span">
          <strong>当前选中片段「{selectedSpan.label}」：</strong>
          {selectedSpan.detail}
        </div>
      )}

      <section className="wt-card">
        <h4 className="wt-finding-title" style={{ marginBottom: 8 }}>
          真机排障的关键区分证据（点击任意片段可看说明）
        </h4>
        <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: "14px", lineHeight: 1.65 }}>
          {scenario.discriminatingEvidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div style={{ fontSize: "13.5px" }}>
          <strong>建议现场取证命令：</strong>
          <code style={CMD_BLOCK_STYLE}>{scenario.nextStepCmd}</code>
        </div>
        <div className="wt-finding-footer" style={{ marginTop: 10 }}>
          <div className="wt-deeplinks">
            {scenario.wikiPageIds.map((pageId) => (
              <ToolDeepLinkById key={`${scenario.id}-wiki-${pageId}`} pageId={pageId} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export interface TroubleshootWorkbenchViewProps {
  mode?: TroubleshootMode | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  embedded?: boolean | undefined;
  initialPresetId?: string | undefined;
  initialTab?: ActiveWorkbenchPanel | undefined;
  onNavigateToReconcile?: (() => void) | undefined;
}

export function TroubleshootWorkbenchView({
  mode,
  title,
  summary,
  embedded = false,
  initialPresetId,
  initialTab,
  onNavigateToReconcile,
}: TroubleshootWorkbenchViewProps) {
  const effectiveMode: TroubleshootMode = mode === "logs" || mode === "timeline" ? mode : "full";
  const assistant = useOptionalWikiAssistant();

  const defaultPanel: ActiveWorkbenchPanel =
    effectiveMode === "timeline"
      ? "timeline"
      : effectiveMode === "logs"
        ? "logs"
        : initialTab === "timeline"
          ? "timeline"
          : "logs";

  const initialFixture = useMemo(() => getTroubleshootFixture(initialPresetId), [initialPresetId]);
  const [activeFixtureId, setActiveFixtureId] = useState<string>(initialFixture.id);
  const [rawInput, setRawInput] = useState<string>(initialFixture.content);

  const [activePanel, setActivePanel] = useState<ActiveWorkbenchPanel>(defaultPanel);
  const currentPanel: ActiveWorkbenchPanel = effectiveMode === "full" ? activePanel : effectiveMode;

  const handleSelectFixture = (fixtureId: string) => {
    const picked = getTroubleshootFixture(fixtureId);
    setActiveFixtureId(picked.id);
    setRawInput(picked.content);
  };

  const handleClearLog = () => {
    setActiveFixtureId("");
    setRawInput("");
  };

  const handleRawInputChange = (next: string) => {
    setActiveFixtureId("");
    setRawInput(next);
  };

  const displayTitle =
    title ??
    (effectiveMode === "logs"
      ? "报错日志与 /metrics 定位"
      : effectiveMode === "timeline"
        ? "6 类典型阻塞时序演示"
        : "分析报错日志（在线排障）");

  const handleAskAssistant = (report: LogAnalysisReport, rawInput: string, trigger: HTMLButtonElement) => {
    if (!assistant) return;
    const rawPrompt = buildTroubleshootAssistantPrompt(report);
    const { sanitized, redactionCount } = sanitizeDiagnosticText(rawPrompt);
    const analysis = buildTroubleshootChatAnalysis(rawInput);
    const rankTag =
      report.firstFaultVerdict.rank !== null ? `首错 Rank ${report.firstFaultVerdict.rank}` : "排障日志/指标";
    const suggestedQuestion =
      report.firstFaultVerdict.rank !== null
        ? `请结合排障工作台锁定的首错 Rank ${report.firstFaultVerdict.rank} 与脱敏证据，确认优先根因并给出最小对照实验。`
        : "请结合排障工作台的脱敏日志与 /metrics 证据，确认优先根因并给出下一步取证命令。";
    assistant.openChat({
      pendingAttachment: {
        title: `排障工作台脱敏快照（${rankTag}）`,
        summary: `命中 ${report.findings.length} 条规则 · ${CONFIDENCE_META[report.firstFaultVerdict.confidence].label}`,
        sanitizedBlock: sanitized,
        redactionCount,
        suggestedQuestion,
        ...(analysis ? { analysis } : {}),
      },
      submit: false,
      trigger,
    });
  };

  const handleHandoffToReconcile = (rawInput: string, report: LogAnalysisReport) => {
    const sourceLabel =
      report.firstFaultVerdict.rank !== null
        ? `排障工作台 · 首错 Rank ${report.firstFaultVerdict.rank}`
        : "排障工作台日志";
    workbenchHandoffStore.sendToReconcile({ logText: rawInput, sourceLabel });
    if (onNavigateToReconcile) {
      onNavigateToReconcile();
    } else if (typeof window !== "undefined") {
      window.location.hash = "#/tools?tab=calculator&panel=reconcile";
    }
  };

  return (
    <div
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="troubleshoot-workbench-view"
      data-mode={effectiveMode}
      data-panel={currentPanel}
    >
      {embedded ? (
        <>
          <header className="wiki-tool-head">
            <div className="wt-embedded-title-group">
              <strong className="wiki-tool-title">{displayTitle}</strong>
              <span className="wiki-tool-badge">
                {mode === "logs"
                  ? "日志定位"
                  : mode === "timeline"
                    ? "时序沙箱"
                    : mode === "full"
                      ? "完整排障"
                      : "故障排障台"}
              </span>
            </div>
            <a className="wt-open-workbench" href="#/tools?tab=troubleshoot">
              打开完整排障工作台 →
            </a>
          </header>
          {summary && <p className="wiki-tool-summary">{summary}</p>}
        </>
      ) : (
        <header className="wt-header">
          <div className="wt-header-main">
            <div className="wt-title-row">
              <h2 className="wt-title">{displayTitle}</h2>
              <span className="wt-baseline-pill">基线: v0.30.0 (c09d3e20)</span>
            </div>
            <p className="wt-subtitle">
              {summary ??
                "粘贴真实报错日志或 /metrics 指标，自动定位最早出错的卡（首错 Rank）与下一步取证命令；也可切到右侧查看 6 类典型阻塞的时序演示。"}
            </p>
          </div>
        </header>
      )}

      {effectiveMode === "full" && (
        <div className="wt-toolbar-row">
          <div className="wt-segmented" role="tablist" aria-label="排障功能切换">
            <button
              type="button"
              role="tab"
              aria-selected={currentPanel === "logs"}
              className={`wt-seg-btn ${currentPanel === "logs" ? "is-active" : ""}`}
              data-testid="troubleshoot-tab-logs"
              onClick={() => setActivePanel("logs")}
            >
              分析我的报错日志 / 指标
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currentPanel === "timeline"}
              className={`wt-seg-btn ${currentPanel === "timeline" ? "is-active" : ""}`}
              data-testid="troubleshoot-tab-timeline"
              onClick={() => setActivePanel("timeline")}
            >
              查看 6 类典型阻塞时序演示
            </button>
          </div>
        </div>
      )}

      {currentPanel === "logs" ? (
        <RealLogAnalyzerPanel
          activeFixtureId={activeFixtureId}
          rawInput={rawInput}
          onSelectFixture={handleSelectFixture}
          onClear={handleClearLog}
          onRawInputChange={handleRawInputChange}
          onAskAssistant={handleAskAssistant}
          onHandoffToReconcile={handleHandoffToReconcile}
          hasAssistant={assistant !== null}
        />
      ) : (
        <SchematicTimelinePanel initialScenarioId={initialPresetId} />
      )}
    </div>
  );
}

export function WikiTroubleshootWorkbenchBlock({ spec }: { spec: WikiToolSpec }) {
  const mode: TroubleshootMode = spec.mode === "logs" || spec.mode === "timeline" ? spec.mode : "full";
  const initialTab: ActiveWorkbenchPanel | undefined =
    spec.tab === "timeline" ? "timeline" : spec.tab === "logs" ? "logs" : undefined;

  return (
    <TroubleshootWorkbenchView
      mode={mode}
      title={spec.title}
      summary={spec.summary}
      initialPresetId={spec.preset}
      initialTab={initialTab}
      embedded
    />
  );
}
