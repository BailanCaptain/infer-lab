import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256 =
  "63d36b197ada3c087177a84eb7636481c3ae2abe53d18edb817de46360ef903e";

export const ROOFLINE_PRECISIONS = ["BF16", "W8A8"] as const;
export type RooflinePrecision = (typeof ROOFLINE_PRECISIONS)[number];

export const ROOFLINE_M_STOPS = [1, 4, 16, 64, 128, 228, 256, 512] as const;
export type RooflineMStop = (typeof ROOFLINE_M_STOPS)[number];
export type RooflineDiagramMode = "sandbox" | "svg";

const HIDDEN_K = 4096;
const HIDDEN_N = 4096;
const SCHEMATIC_BW_TBS = 1.6;
const MIB = 1024 * 1024;

export interface RooflineMatmulState {
  readonly mRows: number;
  readonly precision: RooflinePrecision;
  readonly unitLabel: "FLOP/B" | "OP/B";
  readonly rateUnit: "TFLOP/s" | "TOP/s";
  readonly flops: number;
  readonly flopsText: string;
  readonly weightMiB: number;
  readonly actMiB: number;
  readonly totalMiB: number;
  readonly weightSharePct: number;
  readonly intensity: number;
  readonly ridgePoint: number;
  readonly peakComputeTops: number;
  readonly achievedTops: number;
  readonly ceilingUtilizationPct: number;
  readonly isComputeBound: boolean;
  readonly regimeBadge: string;
  readonly regimeTone: "is-bad" | "is-mid" | "is-good";
}

function formatOps(ops: number, isW8A8: boolean): string {
  const suffix = isW8A8 ? "OPs" : "FLOPs";
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)} G${suffix}`;
  return `${(ops / 1e6).toFixed(2)} M${suffix}`;
}

export function computeRooflineMatmulState(
  rawMRows: number,
  precision: RooflinePrecision,
): RooflineMatmulState {
  const mRows = Math.min(512, Math.max(1, Math.round(rawMRows)));
  const isW8A8 = precision === "W8A8";
  const flops = 2 * mRows * HIDDEN_K * HIDDEN_N;
  const weightBytes = (isW8A8 ? 1 : 2) * HIDDEN_K * HIDDEN_N;
  const actReadBytes = (isW8A8 ? 1 : 2) * mRows * HIDDEN_K;
  const actWriteBytes = 2 * mRows * HIDDEN_N;
  const totalBytes = weightBytes + actReadBytes + actWriteBytes;

  const rawIntensity = flops / totalBytes;
  const intensity = Number(rawIntensity.toFixed(2));
  const peakComputeTops = isW8A8 ? 640 : 320;
  const ridgePoint = Number((peakComputeTops / SCHEMATIC_BW_TBS).toFixed(1));
  const rawAchieved = Math.min(peakComputeTops, rawIntensity * SCHEMATIC_BW_TBS);
  const achievedTops = Number(rawAchieved.toFixed(2));
  const ceilingUtilizationPct = Number(((rawAchieved / peakComputeTops) * 100).toFixed(1));
  const isComputeBound = rawIntensity >= ridgePoint;

  const weightMiB = Number((weightBytes / MIB).toFixed(2));
  const actMiB = Number(((actReadBytes + actWriteBytes) / MIB).toFixed(2));
  const totalMiB = Number((totalBytes / MIB).toFixed(2));
  const weightSharePct = Number(((weightBytes / totalBytes) * 100).toFixed(2));

  let regimeBadge: string;
  let regimeTone: "is-bad" | "is-mid" | "is-good";
  if (isComputeBound) {
    regimeBadge = "越过脊点 · 算力平顶";
    regimeTone = "is-good";
  } else if (mRows === 1) {
    regimeBadge = "深陷带宽墙 · 极度饥饿";
    regimeTone = "is-bad";
  } else {
    regimeBadge = "沿带宽斜坡爬升";
    regimeTone = "is-mid";
  }

  return {
    mRows,
    precision,
    unitLabel: isW8A8 ? "OP/B" : "FLOP/B",
    rateUnit: isW8A8 ? "TOP/s" : "TFLOP/s",
    flops,
    flopsText: formatOps(flops, isW8A8),
    weightMiB,
    actMiB,
    totalMiB,
    weightSharePct,
    intensity,
    ridgePoint,
    peakComputeTops,
    achievedTops,
    ceilingUtilizationPct,
    isComputeBound,
    regimeBadge,
    regimeTone,
  };
}

function nearestStopIndex(mRows: number): number {
  let bestIdx = 0;
  let bestDist = Math.abs(ROOFLINE_M_STOPS[0] - mRows);
  for (let i = 1; i < ROOFLINE_M_STOPS.length; i++) {
    const dist = Math.abs(ROOFLINE_M_STOPS[i]! - mRows);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function mapLogX(intensity: number): number {
  const clamped = Math.min(1000, Math.max(0.8, intensity));
  const t = (Math.log10(clamped) - Math.log10(0.8)) / (Math.log10(1000) - Math.log10(0.8));
  return Math.round(46 + t * 310);
}

function mapLogY(tops: number): number {
  const clamped = Math.min(1100, Math.max(1.2, tops));
  const t = (Math.log10(clamped) - Math.log10(1.2)) / (Math.log10(1100) - Math.log10(1.2));
  return Math.round(176 - t * 142);
}
export interface RooflineMatmulInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RooflineDiagramMode | undefined;
  readonly initialMRows?: number | undefined;
  readonly initialPrecision?: RooflinePrecision | undefined;
}

export function RooflineMatmulInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialMRows = 1,
  initialPrecision = "BF16",
}: RooflineMatmulInteractiveProps) {
  const [mode, setMode] = useState<RooflineDiagramMode>(initialMode);
  const [mRows, setMRows] = useState<number>(initialMRows);
  const [precision, setPrecision] = useState<RooflinePrecision>(initialPrecision);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mAxis = `${id}-${uid}-rf-axis`;

  const state = useMemo(() => computeRooflineMatmulState(mRows, precision), [mRows, precision]);
  const stopIdx = nearestStopIndex(state.mRows);

  const applyM = (nextM: number) => {
    setMode("sandbox");
    setMRows(Math.min(512, Math.max(1, Math.round(nextM))));
  };

  const applyPrecision = (nextP: RooflinePrecision) => {
    setMode("sandbox");
    setPrecision(nextP);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      typeof HTMLInputElement !== "undefined" &&
      event.target instanceof HTMLInputElement &&
      (event.key.startsWith("Arrow") ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown")
    ) {
      return;
    }
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        applyM(ROOFLINE_M_STOPS[Math.min(ROOFLINE_M_STOPS.length - 1, stopIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        applyM(ROOFLINE_M_STOPS[Math.max(0, stopIdx - 1)]!);
        break;
      case "1":
        event.preventDefault();
        applyPrecision("BF16");
        break;
      case "2":
        event.preventDefault();
        applyPrecision("W8A8");
        break;
    }
  };

  const ridgeX = mapLogX(state.ridgePoint);
  const roofY = mapLogY(state.peakComputeTops);
  const startX = mapLogX(0.8);
  const startY = mapLogY(0.8 * SCHEMATIC_BW_TBS);
  const dotX = mapLogX(state.intensity);
  const dotY = mapLogY(state.achievedTops);
  const dotColor = state.isComputeBound ? "#087f73" : state.mRows === 1 ? "#b54237" : "#9a4b86";
  const calloutX = Math.min(296, Math.max(108, dotX));
  const calloutY = dotY > 112 ? dotY - 14 : Math.min(168, dotY + 22);

  const isSinglePreset = mode === "sandbox" && state.mRows === 1 && state.precision === "BF16";
  const isWatershedPreset = mode === "sandbox" && state.mRows >= 222 && state.mRows <= 234;
  const isPrefillPreset = mode === "sandbox" && state.mRows === 512;

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={setMode}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 B · 连续调参权衡"
      kickerTitle="Roofline 算术强度 × 行数 M 与量化位宽"
      question="为什么单请求 Decode 连芯片 1% 算力都发挥不出来，拼批和 W8A8 怎么破局？"
      toolbarLabel="Roofline 行数 M 与量化精度调节"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-m-rows": state.mRows,
        "data-precision": state.precision,
        "data-bound": state.isComputeBound ? "compute" : "memory",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="权重与激活精度切换">
            {ROOFLINE_PRECISIONS.map((p) => {
              const active = mode === "sandbox" && state.precision === p;
              return (
                <button
                  key={p}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`roofline-prec-${p}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => applyPrecision(p)}
                >
                  {p === "BF16" ? "BF16 (2字节)" : "W8A8 (1字节)"}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="打包词元行数 M 调节">
            <label htmlFor={sliderId} className="wiki-edu-slider-chip">
              <span className="mono">{`M = ${state.mRows}`}</span>
              <input
                id={sliderId}
                type="range"
                min={1}
                max={512}
                step={1}
                value={state.mRows}
                data-testid="roofline-m-slider"
                aria-valuetext={`M=${state.mRows} tokens`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => applyM(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="roofline-preset-decode"
              aria-pressed={isSinglePreset}
              style={eduBtnStyle(isSinglePreset, "dark")}
              onClick={() => {
                applyPrecision("BF16");
                applyM(1);
              }}
            >
              单请求 M=1
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="roofline-preset-watershed"
              aria-pressed={isWatershedPreset}
              style={eduBtnStyle(isWatershedPreset, "teal")}
              onClick={() => applyM(228)}
            >
              试试 M=228 分水岭
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="roofline-preset-prefill"
              aria-pressed={isPrefillPreset}
              style={eduBtnStyle(isPrefillPreset, "teal")}
              onClick={() => applyM(512)}
            >
              长文 M=512
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={state.regimeBadge}
      takeawayTone={state.isComputeBound ? "default" : state.mRows === 1 ? "danger" : "warn"}
      takeaway={
        state.isComputeBound ? (
          <>
            <strong>吃满算力屋顶</strong>：搬 1 次 <strong>{`${state.weightMiB} MiB`}</strong> 权重一口气算完{" "}
            <strong>{`${state.mRows} 行`}</strong>词元，强度达{" "}
            <strong>{`${state.intensity} ${state.unitLabel}`}</strong>
            ，越过脊点 <strong>{state.ridgePoint}</strong> 稳登平顶！
          </>
        ) : (
          <>
            <strong>受困显存带宽斜坡</strong>：<span className="mono">{`M=${state.mRows}`}</span> 时权重占流量{" "}
            <strong>{`${state.weightSharePct}%`}</strong>，强度仅{" "}
            <strong>{`${state.intensity} ${state.unitLabel}`}</strong>
            ，只发挥出屋顶算力的 <strong>{`${state.ceilingUtilizationPct}%`}</strong>！
          </>
        )
      }
      kpi={`I = ${state.intensity} ${state.unitLabel} · 理想吞吐上限 ${state.achievedTops} ${state.rateUnit}`}
      detailsSummary="查看工程与源码细节（Qwen3-8B q_proj 精确算式 / 950DT 脊点左移 / GQA 与 MoE 稀释边界）"
      detailsContent={
        <>
          按 <code>Qwen3-8B</code> 线性投影 <code>[M, 4096] × [4096, 4096]</code> 核算：乘加量{" "}
          <code>2MNK = {state.flopsText}</code>，理想 HBM 总流量 <code>{state.totalMiB.toFixed(2)} MiB</code>
          （权重 <code>{state.weightMiB.toFixed(2)} MiB</code> + 激活读写{" "}
          <code>{state.actMiB.toFixed(2)} MiB</code>）。教学标尺采用 <code>β_HBM = 1.6 TB/s</code>、BF16{" "}
          <code>320 TFLOP/s</code>（脊点 <code>200 FLOP/B</code>；W8A8 低比特指令屋顶翻倍至{" "}
          <code>640 TOP/s</code>）。注意：原生分块 FP8 在 Atlas A2/A3 上会反量化回 BF16 无省带宽收益（仅昇腾
          950 转 1B MXFP8，且 <code>950DT</code> 凭 <code>4.0 TB/s</code> 将脊点左移至{" "}
          <code>121.5 FLOP/B</code>）；长上下文非共享 GQA KV 强度恒锁 <code>≈ 4 FLOP/B</code>，稀疏 MoE
          单专家有效行数还会被路由分流稀释，线上可开启 <code>--enable-mfu-metrics</code> 对账。
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${state.mRows === 1 ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 搬运账本：权重摊薄了多少？</span>
            <span className={`wiki-edu-badge ${state.regimeTone}`}>{`权重占 ${state.weightSharePct}%`}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>本步 HBM 读写构成</span>
              <span className="mono">{`总流量 ${state.totalMiB.toFixed(2)} MiB`}</span>
            </div>
            <div className="wiki-edu-track">
              <div
                className="wiki-edu-op is-piece"
                style={{ flex: Math.max(0.22, state.weightMiB / state.totalMiB) }}
              >
                {`权重 ${state.weightMiB.toFixed(0)}M`}
              </div>
              <div
                className="wiki-edu-op is-full"
                style={{ flex: Math.max(0.18, state.actMiB / state.totalMiB) }}
              >
                {`激活 ${state.actMiB.toFixed(2)}M`}
              </div>
            </div>
          </div>

          <div className="wiki-edu-metrics">
            <div className="wiki-edu-metric-row">
              <span className="wiki-edu-metric-label">本步乘加总量</span>
              <span className="wiki-edu-metric-val">{state.flopsText}</span>
            </div>
            <div className="wiki-edu-metric-row">
              <span className="wiki-edu-metric-label">权重复用次数 × 单卡理想吞吐上限</span>
              <span className="wiki-edu-metric-val">{`复用 ${state.mRows}× · ${state.achievedTops} ${state.rateUnit}`}</span>
            </div>
            {!state.isComputeBound && (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="roofline-apply-boost"
                style={eduBtnStyle(false)}
                onClick={() => {
                  if (state.precision === "BF16" && state.mRows < 16) {
                    applyPrecision("W8A8");
                    applyM(16);
                  } else {
                    applyM(512);
                  }
                }}
              >
                {state.precision === "BF16" && state.mRows < 16
                  ? "⚡ 试试 W8A8 + 拼批 M=16 提速"
                  : "⚡ 推到 M=512 冲上算力屋顶"}
              </button>
            )}
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② Roofline 对数屋顶落点</span>
            <span className={`wiki-edu-badge ${state.isComputeBound ? "is-good" : "is-warn"}`}>
              {`屋顶占比 ${state.ceilingUtilizationPct}%`}
            </span>
          </div>

          <svg
            viewBox="0 0 380 204"
            width="380"
            height="204"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`Roofline 工作点：M=${state.mRows}, ${state.precision}, I=${state.intensity}`}
          >
            <defs>
              <marker
                id={mAxis}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#66716d" />
              </marker>
            </defs>
            <rect x="38" y="18" width="326" height="162" rx="8" fill="#fbfaf6" stroke="#d8d8cf" />
            <line
              x1="46"
              y1="176"
              x2="358"
              y2="176"
              stroke="#66716d"
              strokeWidth="1.4"
              markerEnd={`url(#${mAxis})`}
            />
            <line
              x1="46"
              y1="176"
              x2="46"
              y2="24"
              stroke="#66716d"
              strokeWidth="1.4"
              markerEnd={`url(#${mAxis})`}
            />

            <line
              x1={ridgeX}
              y1={roofY}
              x2={ridgeX}
              y2="176"
              stroke="#d8d8cf"
              strokeWidth="1.4"
              strokeDasharray="4 3"
            />
            <path
              d={`M ${startX} ${startY} L ${ridgeX} ${roofY} L 356 ${roofY}`}
              fill="none"
              stroke={state.precision === "W8A8" ? "#9a4b86" : "#4c65b6"}
              strokeWidth="2.8"
              strokeLinecap="round"
            />

            <circle cx={dotX} cy={dotY} r="7" fill={dotColor} stroke="#ffffff" strokeWidth="2" />
            <text x="56" y="38" fontSize="12" fontWeight="700" fill="#b54237">
              带宽斜坡
            </text>
            <text x="354" y={roofY - 8} textAnchor="end" fontSize="12" fontWeight="700" fill="#087f73">
              算力平顶
            </text>
            <text x={ridgeX} y="194" textAnchor="middle" fontSize="12" fill="#66716d">
              {`脊点 ${state.ridgePoint}`}
            </text>
            <text x={calloutX} y={calloutY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`M=${state.mRows} (${state.intensity})`}
            </text>
          </svg>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
