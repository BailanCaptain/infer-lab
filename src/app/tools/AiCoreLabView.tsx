import "../../design/tools.css";
import { type CSSProperties, type MouseEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { WikiToolSpec } from "../../content/wiki/toolFence";
import {
  AICORE_LAB_WIKI_PAGE_IDS,
  type AiCoreArch,
  type AiCoreLabResult,
  ASCEND_910B3_MEASURED_BENCHMARKS,
  type BufferStepSpec,
  DEFAULT_AICORE_LAB_INPUT,
  GROUP0_LOCAL_MAX,
  OUTLIER_RANGE,
  type QuantFormatId,
  SCENARIO_META,
  type SwimlaneBlock,
  simulateAiCoreLab,
} from "../../sim/aicore/matmulRmsScenario";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkById } from "./ToolDeepLinkChip";
import {
  buildAiCoreQueryParams,
  copyTextToClipboard,
  hasExplicitAiCoreQueryParams,
  parseAiCoreQueryParams,
  sanitizeDiagnosticText,
} from "./workbenchHandoff";

export interface AiCoreLabViewProps {
  mode?: "single" | "full" | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  embedded?: boolean | undefined;
  isActive?: boolean | undefined;
  searchParams?: URLSearchParams | undefined;
  locationKey?: string | undefined;
  onUpdateSearchParams?: ((nextParams: URLSearchParams, opts?: { replace?: boolean }) => void) | undefined;
}

const ARCH_OPTIONS: ReadonlyArray<{ value: AiCoreArch; label: string }> = [
  { value: "910b", label: "Atlas A2/A3（910B AIC/AIV 分离核）" },
  { value: "950", label: "Ascend 950（A5 L0C→UB 片上直通）" },
];

const QUANT_OPTIONS: ReadonlyArray<{ value: QuantFormatId; label: string }> = [
  { value: "mxfp8", label: "MXFP8（每 32 通道独立 E8M0 块）" },
  { value: "w8a8_dynamic", label: "W8A8_DYNAMIC（同 token 行共享单尺）" },
  { value: "per_tensor_int8", label: "Per-Tensor INT8（全局共享单尺）" },
];

const FULL_MODE_DEEPLINKS: readonly { pageId: string; label?: string }[] = AICORE_LAB_WIKI_PAGE_IDS.map(
  (pageId) => ({ pageId }),
);

const TONE_FILL: Readonly<Record<SwimlaneBlock["tone"], { bg: string; stroke: string; text: string }>> = {
  token: { bg: "#087f73", stroke: "#06665c", text: "#ffffff" },
  weight: { bg: "#c78300", stroke: "#9e6800", text: "#ffffff" },
  kv: { bg: "#4c65b6", stroke: "#3b5094", text: "#ffffff" },
  comm: { bg: "#9a4b86", stroke: "#7a3969", text: "#ffffff" },
  success: { bg: "#3c7d51", stroke: "#2e633f", text: "#ffffff" },
  warn: { bg: "#b54237", stroke: "#8f3229", text: "#ffffff" },
};

const SVG_HALO: CSSProperties = {
  paintOrder: "stroke",
  stroke: "#fbfaf6",
  strokeWidth: 4,
  strokeLinejoin: "round",
};

function buildAssistantPrompt(result: AiCoreLabResult): string {
  const { input, gmBytes, roofline, quantization } = result;
  const archText = input.arch === "950" ? "Ascend 950 (A5 L0C→UB 片上直通)" : "Atlas A2/A3 (910B 分离核)";
  return [
    `我在「昇腾 AI Core 算子与流水线实验室」（场景：${SCENARIO_META.title}，2 个 Tile）中配置了以下参数：`,
    `- 硬件架构：${archText}`,
    `- Ping-Pong 双缓冲：${input.doubleBuffer ? "开启" : "关闭"}`,
    `- AddRMSNorm 算子融合：${input.fuseAddRmsNorm ? "开启" : "关闭"}`,
    `- 2 Tile 核外 GM/L2 逻辑流量：${gmBytes.totalGmBytes.toLocaleString("en-US")} B（较基线省 ${gmBytes.savedGmBytesVsBaseline.toLocaleString("en-US")} B），GM/L2 算术强度 ${gmBytes.arithmeticIntensity.toFixed(2)} FLOP/B（Roofline 趋势：${roofline.movementLabel}）`,
    `- 量化格式：${quantization.formatLabel}，ch64 离群值=${quantization.outlierCh64.toFixed(1)}，前组 Group 0 平均相对误差 ${quantization.group0MeanRelErrorPct.toFixed(1)}%`,
    "",
    "请结合本仓库知识库，帮我进一步解释：1）为什么双缓冲只让 Roofline 垂直上移而不改变 GM 算术强度；2）910B 与昇腾 950 在 Cube→Vector 交接及原生量化格式上的关键工程边界。",
  ].join("\n");
}

function SwimlaneSvgChart({ result }: { result: AiCoreLabResult }) {
  const plotX = 212;
  const plotW = 456;
  const topY = 38;
  const rowPitch = 44;
  const barH = 28;
  const totalH = topY + result.tracks.length * rowPitch + 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          fontSize: 13.5,
          color: "var(--color-ink-muted)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#087f73" }} />
          AIC 搬运 (MTE2/MTE1)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#c78300" }} />
          AIC Cube (MMAD)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#9a4b86" }} />
          {result.input.arch === "950" ? "950 L0C→UB 直通" : "FixPipe→GM/L2"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#4c65b6" }} />
          AIV 搬运/拆分计算
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#3c7d51" }} />
          融合 Vector/写回
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "#fff4cf",
              border: "1.5px dashed #c78300",
            }}
          />
          串行/反压气泡
        </span>
      </div>

      <svg
        viewBox={`0 0 680 ${totalH}`}
        role="img"
        aria-label="Ascend C TPipe 2 Tile 并发泳道示意图"
        data-testid="aicore-swimlane-svg"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 12,
          border: "1px solid var(--color-line)",
          background: "#fbfaf6",
        }}
      >
        <text x={12} y={24} fill="#66716d" fontSize={14} fontWeight={600}>
          硬件执行泳道（AIC / AIV）
        </text>
        <text x={668} y={24} textAnchor="end" fill="#66716d" fontSize={14}>
          示意相对推进顺序（非真实周期）→
        </text>

        {[0, 25, 50, 75, 100].map((pct) => {
          const gx = plotX + (pct / 100) * plotW;
          return (
            <line key={pct} x1={gx} y1={topY - 4} x2={gx} y2={totalH - 10} stroke="#ece9df" strokeWidth={1} />
          );
        })}

        {result.tracks.map((track, idx) => {
          const rowY = topY + idx * rowPitch;
          const isDivider = track.id === "aiv-mte2";
          const domainColor =
            track.domain === "aic" ? "#087f73" : track.domain === "bridge" ? "#9a4b86" : "#4c65b6";

          return (
            <g key={track.id} data-testid={`aicore-lane-${track.id}`}>
              {isDivider && (
                <line
                  x1={10}
                  y1={rowY - 6}
                  x2={670}
                  y2={rowY - 6}
                  stroke="#d8d8cf"
                  strokeWidth={1.5}
                  strokeDasharray="5,4"
                />
              )}

              <rect
                x={plotX}
                y={rowY + 2}
                width={plotW}
                height={barH + 4}
                rx={6}
                fill="#f5f2ea"
                stroke="#d8d8cf"
                strokeWidth={1}
              />

              <circle cx={15} cy={rowY + 18} r={4} fill={domainColor} />
              <text x={24} y={rowY + 23} fill="#17211f" fontSize={14} fontWeight={600}>
                {track.label}
              </text>

              {track.blocks.map((block) => {
                const bx = plotX + (block.leftPct / 100) * plotW;
                const bw = Math.max(12, (block.widthPct / 100) * plotW);
                const by = rowY + 4;

                if (block.kind === "stall") {
                  return (
                    <g key={block.id} data-testid={`aicore-stall-${track.id}`}>
                      <rect
                        x={bx}
                        y={by + 1}
                        width={bw}
                        height={barH - 2}
                        rx={5}
                        fill="#fff4cf"
                        stroke="#c78300"
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                      />
                      <title>{block.label}</title>
                      {bw >= 62 && (
                        <text
                          x={bx + bw / 2}
                          y={by + 17}
                          textAnchor="middle"
                          fill="#936300"
                          fontSize={12}
                          fontWeight={600}
                        >
                          {bw >= 115 ? block.label : "流水气泡"}
                        </text>
                      )}
                    </g>
                  );
                }

                const palette = TONE_FILL[block.tone];
                const compactText = block.slotTag ? `${block.slotTag === "Ping" ? "P0" : "P1"}` : block.tile;
                const displayText = bw >= 108 ? block.label : compactText;

                return (
                  <g key={block.id}>
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={barH}
                      rx={5}
                      fill={palette.bg}
                      stroke={palette.stroke}
                      strokeWidth={1}
                    />
                    <title>{`${block.slotTag ? `[${block.slotTag}] ` : ""}${block.label}`}</title>
                    <text
                      x={bx + bw / 2}
                      y={by + 17}
                      textAnchor="middle"
                      fill={palette.text}
                      fontSize={12}
                      fontWeight={700}
                    >
                      {displayText}
                    </text>
                  </g>
                );
              })}

              {track.note && (
                <text
                  x={plotX + plotW - 6}
                  y={rowY + 21}
                  textAnchor="end"
                  fill="#66716d"
                  fontSize={12}
                  style={SVG_HALO}
                >
                  免重读 Matmul 结果
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RooflineSvgChart({ result }: { result: AiCoreLabResult }) {
  const { roofline, gmBytes } = result;
  const { baseline, current, ridgeSvgX } = roofline;
  const markerId = useId();
  const hasMoved = baseline.svgX !== current.svgX || baseline.svgY !== current.svgY;
  const labelAnchorX = current.svgX > 265 ? current.svgX - 12 : current.svgX + 12;
  const labelTextAnchor = current.svgX > 265 ? "end" : "start";
  const labelY = Math.max(52, Math.min(156, current.svgY - 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <strong style={{ fontSize: 14.5, color: "var(--color-ink)" }}>
          Roofline 响应（横轴 = 核外 GM/L2 算术强度）
        </strong>
        <span
          className="wt-baseline-pill"
          data-testid="aicore-gm-status"
          style={{
            borderColor: gmBytes.savedGmBytesVsBaseline > 0 ? "#087f73" : "var(--color-line)",
            background: gmBytes.savedGmBytesVsBaseline > 0 ? "#ddf4ef" : "var(--color-surface-sunken)",
            color: gmBytes.savedGmBytesVsBaseline > 0 ? "#087f73" : "var(--color-ink-muted)",
          }}
        >
          {roofline.gmStatusLabel}
        </span>
      </div>

      <svg
        viewBox="0 0 420 214"
        role="img"
        aria-label="核外 GM/L2 级 Roofline 响应示意图"
        data-testid="aicore-roofline-svg"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 12,
          border: "1px solid var(--color-line)",
          background: "#fbfaf6",
        }}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#e85b32" />
          </marker>
        </defs>

        <line x1={56} y1={166} x2={394} y2={166} stroke="#b8bcb5" strokeWidth={1.5} />
        <line x1={56} y1={28} x2={56} y2={166} stroke="#b8bcb5" strokeWidth={1.5} />

        <line
          x1={ridgeSvgX}
          y1={36}
          x2={ridgeSvgX}
          y2={166}
          stroke="#d8d8cf"
          strokeWidth={1}
          strokeDasharray="4,4"
        />

        <polyline
          points={`56,166 ${ridgeSvgX},36 392,36`}
          fill="none"
          stroke="#66716d"
          strokeWidth={2}
          strokeDasharray="6,4"
        />

        <text x={14} y={22} fill="#66716d" fontSize={13.5} style={SVG_HALO}>
          相对屋顶逼近度
        </text>
        <text x={302} y={28} fill="#66716d" fontSize={13.5} fontWeight={600} style={SVG_HALO}>
          Cube 理论算力顶
        </text>
        <text x={68} y={84} fill="#66716d" fontSize={13.5} style={SVG_HALO}>
          核外带宽斜坡
        </text>
        <text x={224} y={198} textAnchor="middle" fill="#66716d" fontSize={13.5} style={SVG_HALO}>
          GM/L2 算术强度 (FLOP/B) →
        </text>

        <circle cx={baseline.svgX} cy={baseline.svgY} r={5} fill="#8a928f" opacity={0.65} />

        {hasMoved && (
          <line
            x1={baseline.svgX}
            y1={baseline.svgY}
            x2={current.svgX}
            y2={current.svgY}
            stroke="#e85b32"
            strokeWidth={2.5}
            markerEnd={`url(#${markerId})`}
          />
        )}

        <circle
          cx={current.svgX}
          cy={current.svgY}
          r={6.5}
          fill={roofline.deltaArithmeticIntensity > 0 ? "#087f73" : "#c78300"}
          stroke="#fbfaf6"
          strokeWidth={2}
          data-testid="aicore-roofline-dot"
        />

        <text
          x={labelAnchorX}
          y={labelY}
          textAnchor={labelTextAnchor}
          fill="#17211f"
          fontSize={13.5}
          fontWeight={700}
          style={SVG_HALO}
        >
          {roofline.movementLabel}
        </text>
      </svg>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px 12px",
          fontSize: 13.5,
          color: "var(--color-ink-muted)",
        }}
      >
        <span className="mono" data-testid="aicore-ai-readout">
          算术强度：{gmBytes.arithmeticIntensity.toFixed(2)} FLOP/B（Δ
          {roofline.deltaArithmeticIntensity >= 0 ? "+" : ""}
          {roofline.deltaArithmeticIntensity.toFixed(2)}）
        </span>
        <span className="mono" data-testid="aicore-bytes-readout">
          2 Tile 核外 GM/L2：{gmBytes.totalGmBytes.toLocaleString("en-US")} B
        </span>
      </div>
    </div>
  );
}

function OutlierQuantSandbox({ result }: { result: AiCoreLabResult }) {
  const q = result.quantization;
  const badgeStyle: CSSProperties =
    q.severity === "bad"
      ? { background: "#fcebe9", color: "#b54237", borderColor: "#b54237" }
      : q.severity === "warn"
        ? { background: "#fff4cf", color: "#936300", borderColor: "#c78300" }
        : { background: "#ddf4ef", color: "#087f73", borderColor: "#087f73" };

  return (
    <div
      data-testid="aicore-quant-sandbox"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        paddingTop: 10,
        borderTop: "1px solid var(--color-line)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <strong style={{ fontSize: 14, color: "var(--color-ink)" }}>
          同 Token 行跨组离群量化沙箱（Group 0 vs Group 2）
        </strong>
        <span
          className="wt-baseline-pill"
          data-testid="aicore-quant-error-badge"
          style={{ ...badgeStyle, fontWeight: 700 }}
        >
          Group 0 误差：{q.group0MeanRelErrorPct.toFixed(1)}%
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
          gap: 8,
        }}
      >
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--color-line)",
            background: "var(--color-canvas)",
            fontSize: 13.5,
          }}
        >
          <div style={{ color: "var(--color-ink-muted)", fontWeight: 600 }}>
            Group 0 [ch0..31]（局部 max={GROUP0_LOCAL_MAX}）
          </div>
          <div className="mono" style={{ color: "var(--color-ink)", marginTop: 2 }}>
            原值 [{q.group0Original[0].toFixed(2)}, {q.group0Original[1].toFixed(2)}]
          </div>
          <div
            className="mono"
            data-testid="aicore-quant-reconstructed"
            style={{ color: "#087f73", fontWeight: 700 }}
          >
            还原 [{q.group0Reconstructed[0].toFixed(3)}, {q.group0Reconstructed[1].toFixed(3)}]
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--color-line)",
            background: "var(--color-canvas)",
            fontSize: 13.5,
          }}
        >
          <div style={{ color: "var(--color-ink-muted)", fontWeight: 600 }}>Group 2 [ch64..95] 离群通道</div>
          <div className="mono" style={{ color: "#b54237", fontWeight: 700, marginTop: 2 }}>
            ch64 激活幅值 = {q.outlierCh64.toFixed(1)}
          </div>
          <div className="mono" style={{ color: "var(--color-ink-muted)" }}>
            Group 0 量化步长 Δ ≈ {q.group0EffectiveStep.toFixed(4)}
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--color-ink)" }}>
        {q.explanation}
      </p>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--color-ink-muted)" }}>
        {q.sameBlockNuance}
      </p>
    </div>
  );
}

interface TopoNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: "ext" | "aic" | "aiv";
}

const TOPO_NODES: readonly TopoNode[] = [
  { id: "hbm[0]", label: "HBM 权重/激活", x: 16, y: 128, w: 108, h: 48, zone: "ext" },
  { id: "l2", label: "核外 L2", x: 148, y: 128, w: 78, h: 48, zone: "ext" },
  { id: "l1", label: "AIC·L1", x: 264, y: 40, w: 82, h: 40, zone: "aic" },
  { id: "l0a", label: "L0A / L0B", x: 376, y: 40, w: 94, h: 40, zone: "aic" },
  { id: "cube", label: "Cube 阵列", x: 500, y: 40, w: 96, h: 40, zone: "aic" },
  { id: "l0c", label: "L0C 累加", x: 626, y: 40, w: 102, h: 40, zone: "aic" },
  { id: "fixpipe", label: "FixPipe", x: 472, y: 94, w: 96, h: 36, zone: "aic" },
  { id: "ub", label: "AIV·UB", x: 264, y: 222, w: 104, h: 44, zone: "aiv" },
  { id: "vector", label: "AIV·Vector", x: 420, y: 222, w: 114, h: 44, zone: "aiv" },
  { id: "mte3", label: "AIV·MTE3", x: 586, y: 222, w: 112, h: 44, zone: "aiv" },
];

function BufferTopologyInspector({
  result,
  activeStepIdx,
  onSelectStep,
}: {
  result: AiCoreLabResult;
  activeStepIdx: number;
  onSelectStep: (idx: number) => void;
}) {
  const step: BufferStepSpec = result.bufferSteps[activeStepIdx] ?? result.bufferSteps[0]!;
  const activeSet = new Set(step.activeParts);
  const is950 = result.input.arch === "950";
  const isPartActive = (id: string) =>
    activeSet.has(id) ||
    (id === "hbm[0]" && activeSet.has("hbm[1]")) ||
    (id === "l0a" && activeSet.has("l0b"));

  return (
    <section className="wt-section" data-testid="aicore-buffer-inspector">
      <div className="wt-section-head">
        <h3 className="wt-section-title">
          片上缓冲驻留与搬运路径检查器（基于 <code className="wt-code-inline">{result.npuSpecId}</code>）
        </h3>
        <span className="wt-section-meta">点击步骤观察数据在 HBM / L2 / L1 / L0 / L0C / UB 间流转</span>
      </div>

      <div className="wt-presets">
        {result.bufferSteps.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            className={`wt-preset-btn ${idx === activeStepIdx ? "is-active" : ""}`}
            data-testid={`aicore-step-btn-${s.stepNumber}`}
            onClick={() => onSelectStep(idx)}
          >
            {s.title.split("（")[0]}
          </button>
        ))}
      </div>

      <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <svg
          viewBox="0 0 760 288"
          role="img"
          aria-label="NPU_910B 与 Ascend 950 片上缓冲路径示意图"
          data-testid="aicore-buffer-topology-svg"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: 12,
            border: "1px solid var(--color-line)",
            background: "#fbfaf6",
          }}
        >
          {/* AIC zone header placed cleanly ABOVE box, clear of the middle corridor */}
          <text x={252} y={20} fill="#087f73" fontSize={13.5} fontWeight={700}>
            AIC 矩阵核侧（L1 / L0A / L0B / Cube / L0C）
          </text>
          <rect x={248} y={28} width={496} height={112} rx={10} fill="#f5f2ea" stroke="#d8d8cf" />

          {/* AIV zone moved down to leave a generous 48px middle corridor */}
          <rect x={248} y={188} width={496} height={88} rx={10} fill="#f5f2ea" stroke="#d8d8cf" />
          <text x={420} y={208} fill="#4c65b6" fontSize={13.5} fontWeight={700}>
            AIV 向量核侧（UB / Vector / MTE3）
          </text>

          {/* Static structural routes */}
          <line x1={124} y1={152} x2={148} y2={152} stroke="#8a928f" strokeWidth={2} />
          <path
            d="M 226 140 L 264 60"
            fill="none"
            stroke={step.stepNumber === 1 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 1 ? 3 : 1.8}
          />
          <line
            x1={346}
            y1={60}
            x2={376}
            y2={60}
            stroke={step.stepNumber === 2 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 2 ? 3 : 1.8}
          />
          <line
            x1={470}
            y1={60}
            x2={500}
            y2={60}
            stroke={step.stepNumber === 3 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 3 ? 3 : 1.8}
          />
          <line
            x1={596}
            y1={60}
            x2={626}
            y2={60}
            stroke={step.stepNumber === 3 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 3 ? 3 : 1.8}
          />
          <line
            x1={368}
            y1={244}
            x2={420}
            y2={244}
            stroke={step.stepNumber === 5 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 5 ? 3 : 1.8}
          />
          <line
            x1={534}
            y1={244}
            x2={586}
            y2={244}
            stroke={step.stepNumber === 6 ? "#e85b32" : "#8a928f"}
            strokeWidth={step.stepNumber === 6 ? 3 : 1.8}
          />

          {/* 910B FixPipe -> L2 -> AIV MTE2 -> UB path */}
          <path
            d="M 658 80 L 658 112 L 568 112 M 472 112 L 226 152 L 264 244"
            fill="none"
            stroke={!is950 && step.stepNumber === 4 ? "#e85b32" : "#b8bcb5"}
            strokeWidth={!is950 && step.stepNumber === 4 ? 3 : 1.5}
            strokeDasharray={is950 ? "4,4" : undefined}
          />

          {/* 950 L0C -> UB direct path routed cleanly through the open middle corridor (y=140..188) */}
          {is950 && (
            <>
              <path
                d="M 684 80 L 684 164 L 316 164 L 316 222"
                fill="none"
                stroke={step.stepNumber === 4 ? "#e85b32" : "#9a4b86"}
                strokeWidth={step.stepNumber === 4 ? 3.5 : 2.5}
                strokeLinejoin="round"
              />
              <text
                x={516}
                y={169}
                textAnchor="middle"
                fill={step.stepNumber === 4 ? "#e85b32" : "#9a4b86"}
                fontSize={13.5}
                fontWeight={700}
                style={SVG_HALO}
              >
                950 L0C → UB 片上直通
              </text>
            </>
          )}

          {/* Nodes */}
          {TOPO_NODES.map((node) => {
            const active = isPartActive(node.id);
            const muted950Fixpipe = is950 && node.id === "fixpipe";
            const fill = active ? "#fff0e9" : muted950Fixpipe ? "#ece9df" : "#ffffff";
            const stroke = active
              ? "#e85b32"
              : node.zone === "aic"
                ? "#087f73"
                : node.zone === "aiv"
                  ? "#4c65b6"
                  : "#66716d";
            return (
              <g key={node.id} opacity={muted950Fixpipe ? 0.55 : 1}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={active ? 2.5 : 1.5}
                />
                <text
                  x={node.x + node.w / 2}
                  y={node.y + node.h / 2 + 5}
                  textAnchor="middle"
                  fill="#17211f"
                  fontSize={13.5}
                  fontWeight={active ? 700 : 600}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 15, color: "var(--color-ink)" }}>{step.title}</strong>
            <span className="wt-baseline-pill">引擎：{step.engine}</span>
            {step.specRoutes.length > 0 && (
              <span className="wt-baseline-pill">
                注册路由：
                {step.specRoutes.map((r) => `${r.from}→${r.to}`).join(" / ")}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-ink)" }}>{step.residencySummary}</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink-muted)" }}>
            <strong>工程边界：</strong>
            {step.boundaryNote}
          </p>
          <div className="wt-env-pills">
            {step.evidenceSummaries.map((ev) => (
              <span key={ev} className="wt-insight-step" style={{ fontSize: 12 }}>
                {ev}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GmByteAccountingTable({ result }: { result: AiCoreLabResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="wt-section" data-testid="aicore-gm-table-section">
      <div className="wt-section-head">
        <div>
          <h3 className="wt-section-title">核外显存（GM/L2）读写字节明细对比</h3>
          <span className="wt-section-meta">
            当前总流量 {result.gmBytes.totalGmBytes.toLocaleString("en-US")} B
            {result.gmBytes.savedGmBytesVsBaseline > 0
              ? `（较基线省 ${result.gmBytes.savedGmBytesVsBaseline.toLocaleString("en-US")} B）`
              : "（与基线相同）"}
            · 算术强度 {result.gmBytes.arithmeticIntensity.toFixed(2)} FLOP/B
          </span>
        </div>
        <button
          type="button"
          className="wt-filter-btn"
          data-testid="aicore-gm-table-toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "收起字节账本" : "展开完整字节账本"}
        </button>
      </div>

      {expanded && (
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th>配置组合</th>
                <th>输入/权重读</th>
                <th>Matmul→AIV 交接</th>
                <th>Add 未融合往返</th>
                <th>残差/Norm 读写</th>
                <th>总 GM/L2 字节</th>
                <th>算术强度</th>
              </tr>
            </thead>
            <tbody>
              {result.gmComparisonTable.map((row) => {
                const isCurrent =
                  row.arch === result.input.arch && row.fuseAddRmsNorm === result.input.fuseAddRmsNorm;
                return (
                  <tr
                    key={row.id}
                    data-testid={`aicore-gm-row-${row.id}`}
                    style={
                      isCurrent ? { background: "var(--color-accent-soft)", fontWeight: 700 } : undefined
                    }
                  >
                    <td>
                      {row.label}
                      {isCurrent && (
                        <span className="wt-rewrite-kind is-silent" style={{ marginLeft: 8 }}>
                          当前
                        </span>
                      )}
                    </td>
                    <td className="mono">{row.bytes.matmulInputWeightBytes.toLocaleString("en-US")} B</td>
                    <td className="mono">
                      {row.bytes.matmulHandoffGmBytes === 0
                        ? "0 B（片上直通）"
                        : `${row.bytes.matmulHandoffGmBytes.toLocaleString("en-US")} B`}
                    </td>
                    <td className="mono">
                      {row.bytes.unfusedAddGmBytes === 0
                        ? "0 B（UB 融合）"
                        : `${row.bytes.unfusedAddGmBytes.toLocaleString("en-US")} B`}
                    </td>
                    <td className="mono">{row.bytes.residualAndNormIoBytes.toLocaleString("en-US")} B</td>
                    <td className="mono">{row.bytes.totalGmBytes.toLocaleString("en-US")} B</td>
                    <td className="mono">{row.bytes.arithmeticIntensity.toFixed(2)} FLOP/B</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink-muted)" }}>
        边界说明：上表统计的是核外 GM/L2 级逻辑流量（不含 L2 缓存命中过滤，也不能直接除以 HBM
        峰值带宽当成实测加速比）；开启 Ping-Pong 双缓冲不改变任何一行的逻辑字节数。
      </p>
    </section>
  );
}

const MEASURED_CHAIN_TONE: Readonly<Record<"compute" | "comm" | "vector", { bg: string; border: string }>> = {
  compute: { bg: "#c78300", border: "#9e6800" },
  comm: { bg: "#b54237", border: "#8f3229" },
  vector: { bg: "#4c65b6", border: "#3b5094" },
};

function Measured910b3BenchmarkPanel() {
  const data = ASCEND_910B3_MEASURED_BENCHMARKS;
  const { w8a8SpeedupSummary: w8, tp4CommChain: tp4 } = data;
  const maxBarUs = tp4.tp4TotalChainUs;
  const tp1BarPct = (tp4.tp1ComputePlusNormUs / maxBarUs) * 100;
  const tp1GemmPct = (w8.bf16GemmUs / tp4.tp1ComputePlusNormUs) * 100;
  const tp1NormPct = 100 - tp1GemmPct;

  return (
    <section className="wt-section" data-testid="aicore-measured-910b3-section">
      <div className="wt-section-head">
        <div>
          <h3 className="wt-section-title">{data.title}</h3>
          <span className="wt-section-meta">
            {data.hardwareLabel} · {data.shapeLabel} · {data.softwareStack}
          </span>
        </div>
        <span
          className="wt-baseline-pill"
          data-testid="aicore-measured-badge"
          style={{
            borderColor: "#087f73",
            background: "#ddf4ef",
            color: "#087f73",
            fontWeight: 700,
          }}
        >
          msprof 真机实测 {data.evidenceTag}
        </span>
      </div>

      <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink-muted)" }}>{data.sampleNote}</p>

        <div className="wt-table-wrap">
          <table className="wt-table" data-testid="aicore-measured-op-table">
            <thead>
              <tr>
                <th>算子（{data.shapeLabel}）</th>
                <th>核类型 / Block</th>
                <th>均值耗时</th>
                <th>关键硬件计数（msprof）</th>
                <th>工程判读</th>
              </tr>
            </thead>
            <tbody>
              {data.singleCardOperators.map((op) => (
                <tr key={op.id} data-testid={`aicore-measured-op-${op.id}`}>
                  <td>
                    <strong>{op.opName}</strong>
                  </td>
                  <td className="mono">{op.coreAndBlocks}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {op.durationUs.toFixed(2)}µs
                  </td>
                  <td style={{ fontSize: 13 }}>{op.keyCounters}</td>
                  <td style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>{op.engineeringNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          data-testid="aicore-measured-w8a8-callout"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px 14px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--color-line)",
            background: "var(--color-canvas)",
            fontSize: 13.5,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span className="wt-baseline-pill" style={{ fontWeight: 700, color: "#087f73" }}>
              纯 GEMM：{w8.gemmOnlyRatio.toFixed(3)}x（{w8.bf16GemmUs.toFixed(2)} → {w8.w8a8GemmUs.toFixed(2)}
              µs）
            </span>
            <span className="wt-baseline-pill" style={{ fontWeight: 700, color: "#936300" }}>
              含未融合 DynamicQuant：{w8.withDynamicQuantRatio.toFixed(3)}x（
              {w8.w8a8QuantPlusGemmUs.toFixed(2)}µs）
            </span>
            <span className="wt-baseline-pill">
              含 AddRmsNorm 整段：{w8.fullBlockWithNormRatio.toFixed(3)}x
            </span>
          </div>
          <span style={{ color: "var(--color-ink-muted)", fontSize: 13 }}>{w8.takeaway}</span>
        </div>

        <div
          data-testid="aicore-measured-tp4-chain"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingTop: 10,
            borderTop: "1px solid var(--color-line)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <strong style={{ fontSize: 14, color: "var(--color-ink)" }}>
              TP=1 vs TP=4 通信劣化实测对比（{tp4.shapeNote}）
            </strong>
            <span
              className="wt-baseline-pill"
              style={{
                borderColor: "#b54237",
                background: "#fcebe9",
                color: "#b54237",
                fontWeight: 700,
              }}
            >
              未重叠通信 {tp4.steps[1]!.durationUs.toFixed(2)}µs（两步均值）· HCCS 通信矩阵边样本带宽{" "}
              {tp4.hccsBandwidthRangeGBs[0]}~{tp4.hccsBandwidthRangeGBs[1]} GB/s
            </span>
          </div>

          {/* TP=1 proportional baseline bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>单卡 TP=1（无集合通信）</span>
              <span className="mono" style={{ color: "#087f73", fontWeight: 700 }}>
                {tp4.tp1ComputePlusNormUs.toFixed(2)}µs
              </span>
            </div>
            <div
              style={{
                width: "100%",
                background: "var(--color-surface-sunken)",
                borderRadius: 8,
                padding: 3,
                border: "1px solid var(--color-line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: `${tp1BarPct.toFixed(1)}%`,
                  height: 26,
                  borderRadius: 6,
                  overflow: "hidden",
                  gap: 2,
                }}
              >
                <div
                  title={`BF16 MatMulV3 ${w8.bf16GemmUs.toFixed(2)}µs`}
                  style={{
                    width: `${tp1GemmPct.toFixed(1)}%`,
                    background: MEASURED_CHAIN_TONE.compute.bg,
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  MatMulV3 {w8.bf16GemmUs.toFixed(2)}µs
                </div>
                <div
                  title={`BF16 AddRmsNorm 63.58µs`}
                  style={{
                    width: `${tp1NormPct.toFixed(1)}%`,
                    background: MEASURED_CHAIN_TONE.vector.bg,
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  63.58µs
                </div>
              </div>
            </div>
          </div>

          {/* TP=4 proportional degradation bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>
                四卡 TP=4（MatMulV3 → 未重叠 hcom_allReduce_ → AddRmsNorm）
              </span>
              <span className="mono" style={{ color: "#b54237", fontWeight: 700 }}>
                {tp4.tp4TotalChainUs.toFixed(2)}µs（
                {(tp4.tp4TotalChainUs / tp4.tp1ComputePlusNormUs).toFixed(2)}x）
              </span>
            </div>
            <div
              style={{
                width: "100%",
                background: "var(--color-surface-sunken)",
                borderRadius: 8,
                padding: 3,
                border: "1px solid var(--color-line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: 26,
                  borderRadius: 6,
                  overflow: "hidden",
                  gap: 2,
                }}
              >
                {tp4.steps.map((step) => {
                  const pct = (step.durationUs / maxBarUs) * 100;
                  const tone = MEASURED_CHAIN_TONE[step.tone];
                  return (
                    <div
                      key={step.id}
                      data-testid={`aicore-measured-${step.id}`}
                      title={`${step.opName} (${step.durationUs.toFixed(2)}µs): ${step.detail}`}
                      style={{
                        width: `${pct.toFixed(2)}%`,
                        background: tone.bg,
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        padding: "0 4px",
                      }}
                    >
                      {step.opName === "hcom_allReduce_"
                        ? `hcom_allReduce_ ${step.durationUs.toFixed(2)}µs（未重叠）`
                        : `${step.durationUs.toFixed(2)}µs`}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 8,
              fontSize: 12.5,
            }}
          >
            {tp4.steps.map((step) => (
              <div
                key={`detail-${step.id}`}
                style={{
                  padding: "7px 9px",
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-canvas)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <strong>{step.opName}</strong>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {step.durationUs.toFixed(2)}µs
                  </span>
                </div>
                <div style={{ color: "var(--color-ink-muted)", marginTop: 2 }}>{step.detail}</div>
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--color-ink-muted)" }}>
            {tp4.boundaryNote}
          </p>
        </div>
      </div>
    </section>
  );
}

export function AiCoreLabView({
  mode,
  title,
  summary,
  embedded = false,
  isActive,
  searchParams,
  locationKey,
  onUpdateSearchParams,
}: AiCoreLabViewProps) {
  const effectiveMode: "single" | "full" = mode === "single" ? "single" : "full";
  const showSingleHead = embedded || effectiveMode === "single";
  const idPrefix = useId();
  const assistant = useOptionalWikiAssistant();
  const isAiCoreRouteActive =
    effectiveMode === "full" &&
    !embedded &&
    (isActive !== undefined ? isActive : searchParams?.get("tab") === "aicore");

  const initialQuery = useMemo(
    () => (isAiCoreRouteActive && searchParams ? parseAiCoreQueryParams(searchParams) : undefined),
    [isAiCoreRouteActive, searchParams],
  );

  const [arch, setArch] = useState<AiCoreArch>(initialQuery?.arch ?? DEFAULT_AICORE_LAB_INPUT.arch);
  const [doubleBuffer, setDoubleBuffer] = useState<boolean>(
    initialQuery?.doubleBuffer ?? DEFAULT_AICORE_LAB_INPUT.doubleBuffer,
  );
  const [fuseAddRmsNorm, setFuseAddRmsNorm] = useState<boolean>(
    initialQuery?.fuseAddRmsNorm ?? DEFAULT_AICORE_LAB_INPUT.fuseAddRmsNorm,
  );
  const [quantFormat, setQuantFormat] = useState<QuantFormatId>(
    initialQuery?.quantFormat ?? DEFAULT_AICORE_LAB_INPUT.quantFormat,
  );
  const [outlierCh64, setOutlierCh64] = useState<number>(
    initialQuery?.outlierCh64 ?? DEFAULT_AICORE_LAB_INPUT.outlierCh64,
  );
  const [activeStepIdx, setActiveStepIdx] = useState<number>(3);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [copyErrorUrl, setCopyErrorUrl] = useState<string | null>(null);

  const wasActiveRef = useRef<boolean>(isAiCoreRouteActive);
  const prevLocationKeyRef = useRef<string | undefined>(locationKey);
  const lastSelfSyncedQueryRef = useRef<string | null>(null);
  const restoringFromUrlInCommitRef = useRef<boolean>(false);
  restoringFromUrlInCommitRef.current = false;

  useEffect(() => {
    const wasActive = wasActiveRef.current;
    const prevKey = prevLocationKeyRef.current;
    wasActiveRef.current = isAiCoreRouteActive;
    prevLocationKeyRef.current = locationKey;
    if (!isAiCoreRouteActive || !searchParams) return;
    const serialized = searchParams.toString();
    if (serialized === lastSelfSyncedQueryRef.current) {
      lastSelfSyncedQueryRef.current = null;
      return;
    }
    const hasExplicit = hasExplicitAiCoreQueryParams(searchParams);
    if (!wasActive && !hasExplicit) return;
    if (wasActive && prevKey === locationKey && serialized === "") return;
    restoringFromUrlInCommitRef.current = true;
    const parsed = parseAiCoreQueryParams(searchParams);
    setArch(parsed.arch ?? DEFAULT_AICORE_LAB_INPUT.arch);
    setDoubleBuffer(parsed.doubleBuffer ?? DEFAULT_AICORE_LAB_INPUT.doubleBuffer);
    setFuseAddRmsNorm(parsed.fuseAddRmsNorm ?? DEFAULT_AICORE_LAB_INPUT.fuseAddRmsNorm);
    setQuantFormat(parsed.quantFormat ?? DEFAULT_AICORE_LAB_INPUT.quantFormat);
    setOutlierCh64(parsed.outlierCh64 ?? DEFAULT_AICORE_LAB_INPUT.outlierCh64);
  }, [isAiCoreRouteActive, searchParams, locationKey]);

  const isAtDefaultConfig =
    arch === DEFAULT_AICORE_LAB_INPUT.arch &&
    doubleBuffer === DEFAULT_AICORE_LAB_INPUT.doubleBuffer &&
    fuseAddRmsNorm === DEFAULT_AICORE_LAB_INPUT.fuseAddRmsNorm &&
    quantFormat === DEFAULT_AICORE_LAB_INPUT.quantFormat &&
    Math.abs(outlierCh64 - DEFAULT_AICORE_LAB_INPUT.outlierCh64) < 1e-6;

  useEffect(() => {
    if (!isAiCoreRouteActive || !searchParams || !onUpdateSearchParams) return;
    if (restoringFromUrlInCommitRef.current) return;
    if (isAtDefaultConfig && !hasExplicitAiCoreQueryParams(searchParams)) return;

    const nextParams = isAtDefaultConfig
      ? buildAiCoreQueryParams({}, searchParams)
      : buildAiCoreQueryParams(
          { arch, doubleBuffer, fuseAddRmsNorm, quantFormat, outlierCh64 },
          searchParams,
        );
    const nextStr = nextParams.toString();
    if (nextStr !== searchParams.toString()) {
      lastSelfSyncedQueryRef.current = nextStr;
      onUpdateSearchParams(nextParams, { replace: true });
    }
  }, [
    isAiCoreRouteActive,
    searchParams,
    onUpdateSearchParams,
    isAtDefaultConfig,
    arch,
    doubleBuffer,
    fuseAddRmsNorm,
    quantFormat,
    outlierCh64,
  ]);

  const handleCopyShareLink = () => {
    const shareParams = buildAiCoreQueryParams(
      { arch, doubleBuffer, fuseAddRmsNorm, quantFormat, outlierCh64 },
      searchParams,
    );
    const baseToolsUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#/tools`
        : "http://localhost/#/tools";
    const url = `${baseToolsUrl}?${shareParams.toString()}`;
    void copyTextToClipboard(url).then((copied) => {
      if (copied) {
        setCopyErrorUrl(null);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      } else {
        setLinkCopied(false);
        setCopyErrorUrl(url);
      }
    });
  };

  const handleResetDefaults = () => {
    setArch(DEFAULT_AICORE_LAB_INPUT.arch);
    setDoubleBuffer(DEFAULT_AICORE_LAB_INPUT.doubleBuffer);
    setFuseAddRmsNorm(DEFAULT_AICORE_LAB_INPUT.fuseAddRmsNorm);
    setQuantFormat(DEFAULT_AICORE_LAB_INPUT.quantFormat);
    setOutlierCh64(DEFAULT_AICORE_LAB_INPUT.outlierCh64);
    setActiveStepIdx(3);
    if (isAiCoreRouteActive && searchParams && onUpdateSearchParams) {
      const cleanParams = buildAiCoreQueryParams({}, searchParams);
      lastSelfSyncedQueryRef.current = cleanParams.toString();
      onUpdateSearchParams(cleanParams, { replace: false });
    }
  };

  const result = useMemo(
    () =>
      simulateAiCoreLab({
        arch,
        doubleBuffer,
        fuseAddRmsNorm,
        quantFormat,
        outlierCh64,
      }),
    [arch, doubleBuffer, fuseAddRmsNorm, quantFormat, outlierCh64],
  );

  const handleAskAssistant = (event: MouseEvent<HTMLButtonElement>) => {
    if (!assistant) return;
    const rawPrompt = buildAssistantPrompt(result);
    const { sanitized, redactionCount } = sanitizeDiagnosticText(rawPrompt);
    const archLabel = result.input.arch === "950" ? "Ascend 950" : "Ascend 910B";
    assistant.openChat({
      pendingAttachment: {
        title: `AI Core 算子流水线脱敏快照（${archLabel}）`,
        summary: `算术强度 ${result.gmBytes.arithmeticIntensity.toFixed(2)} FLOP/B · 总 GM/L2 ${result.gmBytes.totalGmBytes.toLocaleString("en-US")} B`,
        sanitizedBlock: sanitized,
        redactionCount,
        suggestedQuestion: `请结合 ${archLabel} AI Core 泳道与 Roofline 数据，解释当前配置下的搬运与融合收益边界。`,
      },
      submit: false,
      trigger: event.currentTarget,
    });
  };

  const displayTitle = title ?? "芯片算子沙盘（微观原理演示 · AI Core）";
  const displaySummary =
    summary ??
    "配合硬件章节理解芯片内部怎么跑：切换双缓冲、算子融合与 910B/950 架构，直观对比数据搬运怎样省显存带宽、以及拖动离群值看量化误差为何会放大。";

  return (
    <div
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="aicore-lab-view"
      data-mode={effectiveMode}
      data-arch={arch}
    >
      {showSingleHead ? (
        <>
          <header className="wiki-tool-head">
            <div className="wt-embedded-title-group">
              <strong className="wiki-tool-title">{displayTitle}</strong>
              <span className="wiki-tool-badge">
                {mode === "single" ? "单场景对照" : mode === "full" ? "完整实验室" : "算子实验室"}
              </span>
              <span
                className="wt-baseline-pill"
                data-testid="aicore-schematic-badge"
                style={{
                  borderColor: "#c78300",
                  background: "#fff4cf",
                  color: "#936300",
                  fontWeight: 700,
                }}
              >
                {result.schematicBadge}
              </span>
            </div>
            <a className="wt-open-workbench" href="#/tools?tab=aicore">
              打开完整算子实验室 →
            </a>
          </header>
          {summary && <p className="wiki-tool-summary">{summary}</p>}
        </>
      ) : (
        <header className="wt-header">
          <div className="wt-header-main">
            <div className="wt-title-row">
              <h2 className="wt-title">{displayTitle}</h2>
              <span
                className="wt-baseline-pill"
                data-testid="aicore-schematic-badge"
                style={{
                  borderColor: "#c78300",
                  background: "#fff4cf",
                  color: "#936300",
                  fontWeight: 700,
                }}
              >
                {result.schematicBadge}
              </span>
              {effectiveMode === "full" && (
                <>
                  <button
                    type="button"
                    className="wt-preset-btn"
                    style={{ padding: "2px 10px", fontSize: 12.5 }}
                    data-testid="aicore-copy-share-link"
                    onClick={handleCopyShareLink}
                  >
                    {linkCopied ? "已复制沙盘配置链接" : "复制沙盘配置链接"}
                  </button>
                  {copyErrorUrl && (
                    <span
                      role="alert"
                      data-testid="aicore-copy-fallback"
                      style={{ fontSize: 12.5, color: "var(--color-danger)" }}
                    >
                      剪贴板不可用，请手动复制：<code>{copyErrorUrl}</code>
                    </span>
                  )}
                  {(!isAtDefaultConfig || hasExplicitAiCoreQueryParams(searchParams)) && (
                    <button
                      type="button"
                      className="wt-preset-btn"
                      style={{ padding: "2px 10px", fontSize: 12.5 }}
                      data-testid="aicore-reset-defaults"
                      onClick={handleResetDefaults}
                    >
                      重置默认
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="wt-subtitle">{displaySummary}</p>
          </div>
          {assistant && (
            <div className="wt-header-actions">
              <button
                type="button"
                className="wt-assistant-btn"
                data-testid="aicore-ask-assistant"
                onClick={handleAskAssistant}
              >
                送入问答助手深究
              </button>
            </div>
          )}
        </header>
      )}

      {effectiveMode === "full" && !embedded && (
        <div className="wt-guide-strip" data-testid="aicore-guide-strip">
          <div className="wt-guide-item">
            <strong>① 开「双缓冲」</strong>：搬运与计算重叠，Roofline 红点<strong>只向上抬</strong>
            （不减少显存读写总量）。
          </div>
          <div className="wt-guide-item">
            <strong>② 开「算子融合」或切「950」</strong>：省去中间结果回写显存，Roofline 红点
            <strong>向右移动</strong>。
          </div>
          <div className="wt-guide-item">
            <strong>③ 拉高「离群值」</strong>：观察 <strong>MXFP8 分块量化</strong> vs
            整行共享尺度的精度差距。
          </div>
        </div>
      )}

      <div className="wt-controls-bar" data-testid="aicore-controls-bar">
        <label className="wt-field" htmlFor={`${idPrefix}-arch`} style={{ minWidth: 230 }}>
          <span className="wt-field-label">昇腾芯片架构</span>
          <select
            id={`${idPrefix}-arch`}
            className="wt-select"
            data-testid="aicore-arch-select"
            value={arch}
            onChange={(e) => setArch(e.target.value as AiCoreArch)}
          >
            {ARCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="wt-field" style={{ minWidth: 165 }}>
          <span className="wt-field-label">流水线与融合开关</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              aria-pressed={doubleBuffer}
              className={`wt-preset-btn ${doubleBuffer ? "is-active" : ""}`}
              data-testid="aicore-toggle-db"
              onClick={() => setDoubleBuffer((prev) => !prev)}
            >
              Ping-Pong 双缓冲：{doubleBuffer ? "开 ✓" : "关"}
            </button>
            <button
              type="button"
              aria-pressed={fuseAddRmsNorm}
              className={`wt-preset-btn ${fuseAddRmsNorm ? "is-active" : ""}`}
              data-testid="aicore-toggle-fuse"
              onClick={() => setFuseAddRmsNorm((prev) => !prev)}
            >
              AddRMSNorm 融合：{fuseAddRmsNorm ? "开 ✓" : "关"}
            </button>
          </div>
        </div>

        <label className="wt-field" htmlFor={`${idPrefix}-quant`} style={{ minWidth: 220 }}>
          <span className="wt-field-label">量化格式</span>
          <select
            id={`${idPrefix}-quant`}
            className="wt-select"
            data-testid="aicore-quant-select"
            value={quantFormat}
            onChange={(e) => setQuantFormat(e.target.value as QuantFormatId)}
          >
            {QUANT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="wt-field" htmlFor={`${idPrefix}-outlier`} style={{ minWidth: 185 }}>
          <span className="wt-field-label">
            第 64 通道离群值：<strong className="mono">{outlierCh64.toFixed(1)}</strong>
          </span>
          <input
            id={`${idPrefix}-outlier`}
            type="range"
            min={OUTLIER_RANGE.min}
            max={OUTLIER_RANGE.max}
            step={0.5}
            value={outlierCh64}
            data-testid="aicore-outlier-slider"
            onChange={(e) => setOutlierCh64(Number(e.target.value))}
            style={{ accentColor: "var(--color-accent)", height: 36, cursor: "pointer" }}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <strong style={{ fontSize: 15, color: "var(--color-ink)" }}>
              Ascend C <code className="wt-code-inline">TPipe</code> 并发泳道（2 个 Tile）
            </strong>
            <span className="wt-baseline-pill">{doubleBuffer ? "Ping / Pong 双槽重叠" : "单槽串行排空"}</span>
          </div>

          <SwimlaneSvgChart result={result} />

          <p
            data-testid="aicore-arch-note"
            style={{
              margin: 0,
              padding: "9px 11px",
              borderRadius: 10,
              border: "1px solid var(--color-line)",
              background: "var(--color-canvas)",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--color-ink)",
            }}
          >
            {result.archNote}
          </p>
        </div>

        <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RooflineSvgChart result={result} />
          <OutlierQuantSandbox result={result} />
        </div>
      </div>

      {effectiveMode === "full" && (
        <>
          <BufferTopologyInspector
            result={result}
            activeStepIdx={activeStepIdx}
            onSelectStep={setActiveStepIdx}
          />
          <GmByteAccountingTable result={result} />
          <Measured910b3BenchmarkPanel />
          <section className="wt-section" data-testid="aicore-deeplinks-section">
            <div className="wt-section-head">
              <h3 className="wt-section-title">关联知识库章节深链</h3>
              <span className="wt-section-meta">核对片上缓冲规范、950 架构差异与低精度格式位域</span>
            </div>
            <div className="wt-deeplinks">
              {FULL_MODE_DEEPLINKS.map((ref) => (
                <ToolDeepLinkById key={ref.pageId} pageId={ref.pageId} label={ref.label} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function WikiAiCoreLabBlock({ spec }: { spec: WikiToolSpec }) {
  return (
    <AiCoreLabView
      mode={spec.mode === "single" ? "single" : "full"}
      title={spec.title}
      summary={spec.summary}
      embedded
    />
  );
}
