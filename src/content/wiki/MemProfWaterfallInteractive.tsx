import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256 =
  "6b154bffcdccc053c5fe39aa5eb0168863fc68fcb4f582fad8f0aa4b137117c4";
export const MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256 = MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256;

export const MEM_PROF_TP_OPTIONS = [1, 2, 4, 8] as const;
export type MemProfTpSize = (typeof MEM_PROF_TP_OPTIONS)[number];
export type MemProfDiagramMode = "sandbox" | "svg";
export type MemProfHeadroomStatus = "safe" | "margin-warn" | "oom-risk";

export const A2_SCHEMATIC_TOTAL_GIB = 64.0;
const RECOMMEND_MARGIN_GIB = 0.15;

interface TpProfileSpec {
  readonly weightsGiB: number;
  readonly torchPeakGiB: number;
  readonly nonTorchGiB: number;
  readonly blockMiB: number;
  readonly graphGiB: number;
  readonly hcclCanvasLabel: string;
}

const QWEN3_8B_TP_SPECS: Record<MemProfTpSize, TpProfileSpec> = {
  1: {
    weightsGiB: 15.26,
    torchPeakGiB: 2.14,
    nonTorchGiB: 0.6,
    blockMiB: 18.0,
    graphGiB: 2.59,
    hcclCanvasLabel: "单卡通信池已含在 0.60G 内",
  },
  2: {
    weightsGiB: 7.63,
    torchPeakGiB: 1.4,
    nonTorchGiB: 0.85,
    blockMiB: 9.0,
    graphGiB: 2.92,
    hcclCanvasLabel: "双卡共享通信域已含在 0.85G",
  },
  4: {
    weightsGiB: 3.82,
    torchPeakGiB: 1.0,
    nonTorchGiB: 0.9,
    blockMiB: 4.5,
    graphGiB: 3.1,
    hcclCanvasLabel: "四卡共享通信域去重含在 0.90G",
  },
  8: {
    weightsGiB: 1.91,
    torchPeakGiB: 0.8,
    nonTorchGiB: 1.05,
    blockMiB: 2.25,
    graphGiB: 3.21,
    hcclCanvasLabel: "八卡池涨推高录图至 3.21G",
  },
};

export interface MemProfWaterfallState {
  readonly utilization: number;
  readonly tpSize: MemProfTpSize;
  readonly totalGiB: number;
  readonly budgetGiB: number;
  readonly headroomGiB: number;
  readonly weightsGiB: number;
  readonly torchPeakGiB: number;
  readonly nonTorchGiB: number;
  readonly kvPoolGiB: number;
  readonly blockMiB: number;
  readonly totalBlocks: number;
  readonly usableBlocks: number;
  readonly tokenSlots: number;
  readonly graphGiB: number;
  readonly recommendedHeadroomGiB: number;
  readonly graphMarginGiB: number;
  readonly recommendMarginGiB: number;
  readonly headroomStatus: MemProfHeadroomStatus;
  readonly isCaptureOomRisk: boolean;
  readonly isBelowRecommendMargin: boolean;
  readonly isHeadroomTight: boolean;
  readonly hcclCanvasLabel: string;
}

export function computeMemProfWaterfallState(
  rawUtilization: number,
  tpSize: MemProfTpSize,
): MemProfWaterfallState {
  const utilization = Math.min(0.97, Math.max(0.8, Math.round(rawUtilization * 100) / 100));
  const spec = QWEN3_8B_TP_SPECS[tpSize];
  const budgetGiB = Number((A2_SCHEMATIC_TOTAL_GIB * utilization).toFixed(2));
  const headroomGiB = Number((A2_SCHEMATIC_TOTAL_GIB - budgetGiB).toFixed(2));
  const nonKvGiB = spec.weightsGiB + spec.torchPeakGiB + spec.nonTorchGiB;
  const kvPoolGiB = Number(Math.max(0, budgetGiB - nonKvGiB).toFixed(2));
  const totalBlocks = Math.floor((kvPoolGiB * 1024) / spec.blockMiB);
  const usableBlocks = Math.max(0, totalBlocks - 1);
  const tokenSlots = usableBlocks * 128;

  const recommendedHeadroomGiB = Number((spec.graphGiB + RECOMMEND_MARGIN_GIB).toFixed(2));
  const graphMarginGiB = Number((headroomGiB - spec.graphGiB).toFixed(2));
  const recommendMarginGiB = Number((headroomGiB - recommendedHeadroomGiB).toFixed(2));
  const isCaptureOomRisk = headroomGiB < spec.graphGiB;
  const isBelowRecommendMargin = !isCaptureOomRisk && headroomGiB < recommendedHeadroomGiB;
  const headroomStatus: MemProfHeadroomStatus = isCaptureOomRisk
    ? "oom-risk"
    : isBelowRecommendMargin
      ? "margin-warn"
      : "safe";

  return {
    utilization,
    tpSize,
    totalGiB: A2_SCHEMATIC_TOTAL_GIB,
    budgetGiB,
    headroomGiB,
    weightsGiB: spec.weightsGiB,
    torchPeakGiB: spec.torchPeakGiB,
    nonTorchGiB: spec.nonTorchGiB,
    kvPoolGiB,
    blockMiB: spec.blockMiB,
    totalBlocks,
    usableBlocks,
    tokenSlots,
    graphGiB: spec.graphGiB,
    recommendedHeadroomGiB,
    graphMarginGiB,
    recommendMarginGiB,
    headroomStatus,
    isCaptureOomRisk,
    isBelowRecommendMargin,
    isHeadroomTight: isCaptureOomRisk || isBelowRecommendMargin,
    hcclCanvasLabel: spec.hcclCanvasLabel,
  };
}
export interface MemProfWaterfallInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MemProfDiagramMode | undefined;
  readonly initialUtilization?: number | undefined;
  readonly initialTpSize?: MemProfTpSize | undefined;
}

export function MemProfWaterfallInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialUtilization = 0.92,
  initialTpSize = 1,
}: MemProfWaterfallInteractiveProps) {
  const [mode, setMode] = useState<MemProfDiagramMode>(initialMode);
  const [utilization, setUtilization] = useState<number>(initialUtilization);
  const [tpSize, setTpSize] = useState<MemProfTpSize>(initialTpSize);
  const sliderId = useId();

  const state = useMemo(() => computeMemProfWaterfallState(utilization, tpSize), [utilization, tpSize]);
  const tpIdx = MEM_PROF_TP_OPTIONS.indexOf(state.tpSize);

  const applyU = (nextU: number) => {
    setMode("sandbox");
    setUtilization(Math.min(0.97, Math.max(0.8, Math.round(nextU * 100) / 100)));
  };

  const applyTp = (nextTp: MemProfTpSize) => {
    setMode("sandbox");
    setTpSize(nextTp);
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
        applyTp(MEM_PROF_TP_OPTIONS[Math.min(3, tpIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        applyTp(MEM_PROF_TP_OPTIONS[Math.max(0, tpIdx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        applyTp(MEM_PROF_TP_OPTIONS[Number(event.key) - 1]!);
        break;
    }
  };

  const isSafePreset = mode === "sandbox" && Math.abs(state.utilization - 0.9) < 0.005;
  const isTightPreset = mode === "sandbox" && Math.abs(state.utilization - 0.96) < 0.005;

  const takeawayBadge = state.isCaptureOomRisk
    ? "低于估算图显存（OOM 风险）"
    : state.isBelowRecommendMargin
      ? "低于 150MB 建议余量（风险预警）"
      : "七级账本安全闭合";
  const takeawayTone = state.isCaptureOomRisk ? "danger" : state.isBelowRecommendMargin ? "warn" : "default";

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
      kickerTitle="64 GiB 七级显存扣减瀑布与 1−u 录图余量"
      question="启动时可用 KV 块数是怎么一级级扣出来的？为什么严禁再手工减一遍 HCCL 缓冲？"
      toolbarLabel="七级显存扣减瀑布 u 与 TP 调节"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-tp": state.tpSize,
        "data-u": state.utilization.toFixed(2),
        "data-headroom-status": state.headroomStatus,
        "data-headroom-tight": state.isHeadroomTight ? "true" : "false",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="张量并行卡数 TP 切换">
            {MEM_PROF_TP_OPTIONS.map((tp) => {
              const active = mode === "sandbox" && state.tpSize === tp;
              return (
                <button
                  key={tp}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`memprof-tp-${tp}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => applyTp(tp)}
                >
                  {`TP=${tp}`}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="显存比例 u 调节">
            <label
              htmlFor={sliderId}
              className={`wiki-edu-slider-chip${state.isCaptureOomRisk ? " is-oom" : ""}`}
            >
              <span className="mono">{`u = ${state.utilization.toFixed(2)}`}</span>
              <input
                id={sliderId}
                type="range"
                min={80}
                max={97}
                step={1}
                value={Math.round(state.utilization * 100)}
                data-testid="memprof-u-slider"
                aria-valuetext={`u=${state.utilization.toFixed(2)}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => applyU(Number(e.target.value) / 100)}
              />
            </label>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="memprof-u-safe"
              aria-pressed={isSafePreset}
              style={eduBtnStyle(isSafePreset, "teal")}
              onClick={() => applyU(0.9)}
            >
              生产推荐 0.90
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="memprof-u-tight"
              aria-pressed={isTightPreset}
              style={eduBtnStyle(isTightPreset, "dark")}
              onClick={() => applyU(0.96)}
            >
              试试 u=0.96 紧余量
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={takeawayBadge}
      takeawayTone={takeawayTone}
      takeaway={
        state.isCaptureOomRisk ? (
          <>
            <strong>录图空间不足</strong>：<span className="mono">{`u=${state.utilization.toFixed(2)}`}</span>{" "}
            把单卡 KV 撑到 <strong>{`${state.kvPoolGiB.toFixed(2)}G`}</strong>，右侧只剩{" "}
            <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong>，低于参考图显存{" "}
            <strong>{`${state.graphGiB.toFixed(2)}G`}</strong>！
          </>
        ) : state.isBelowRecommendMargin ? (
          <>
            <strong>低于 150MB 建议裕度</strong>：留白 <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong>{" "}
            虽高于参考图显存 <strong>{`${state.graphGiB.toFixed(2)}G`}</strong>，但不足录图后建议安全裕度（
            <strong>{`${state.recommendedHeadroomGiB.toFixed(2)}G`}</strong>），建议适度下调！
          </>
        ) : (
          <>
            单卡扣完三项后切出 <strong>{`${state.usableBlocks.toLocaleString()} 个可用块`}</strong>（已扣 1
            空块），右侧留出 <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong> 充裕覆盖录图与安全裕度。
          </>
        )
      }
      kpi={`可用 ${state.usableBlocks.toLocaleString()} 块 (${state.kvPoolGiB.toFixed(2)}G) · 留白 ${state.headroomGiB.toFixed(2)}G`}
      detailsSummary="查看工程与源码细节（_HCCL_PG_REGISTRY 去重前提 / 150 MiB 建议单口径 / 910B3 60.96 GiB 实测对账）"
      detailsContent={
        <>
          <strong>七级扣减算式</strong>：
          <code>M_KV = M_total × u − (M_weights + ΔM_torch_peak + ΔM_non_torch)</code>，全组按{" "}
          <code>min(floor(M_KV / B_block))</code> 对齐并弹出 1 个永久空块。在 <code>64 GiB</code> A2
          纸面标尺默认 <code>u=0.92</code> 下：<code>Qwen3-8B (BF16, TP=1)</code> 剩{" "}
          <code>40.88 GiB → 2,325 块</code>（扣空块 <code>2,324</code> 块 = <code>297,472 tokens</code>）；
          <code>Qwen3-30B-A3B (W8A8, TP4+EP4)</code> 在跨 <code>group_name</code> 复用前提下经{" "}
          <code>_HCCL_PG_REGISTRY</code> 去重，剩 <code>48.28 GiB → 16,479 块</code>。图中{" "}
          <code>2.59 ~ 3.21 GiB</code> 图显存引自 <code>Ascend 910B3</code>（OS 可见总显存{" "}
          <code>60.96 GiB</code>，固定 <code>u=0.85</code> 扩 <code>TP=1→8</code> 逆向递增）实测参考；
          <code>150 MiB</code>（<code>worker.py:908-928</code> <code>redundancy_buffer</code>）是录图后打印{" "}
          <code>--kv-cache-memory</code> 建议值的安全裕度，低于该裕度属风险预警而非必然分配失败（小模型{" "}
          <code>Qwen3-0.6B</code> 在 <code>910B3 u=0.90</code> 下因仅剩 <code>1.71G</code> 申请{" "}
          <code>1.98G</code> 触发真机 OOM，降 <code>u=0.82</code> 通过）。
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-lane-box">
          <div className="wiki-edu-lane-label">
            <span>{`64 GiB 瀑布切分（预算 ${state.budgetGiB.toFixed(2)}G + 留白 ${state.headroomGiB.toFixed(2)}G）`}</span>
            <span className="mono">{`每块 ${state.blockMiB} MiB`}</span>
          </div>
          <div className="wiki-edu-track">
            <div className="wiki-edu-op is-attn" style={{ flex: Math.max(0.14, state.weightsGiB / 64) }}>
              {`权重 ${state.weightsGiB}G`}
            </div>
            <div
              className="wiki-edu-op is-eager"
              style={{ flex: Math.max(0.12, (state.torchPeakGiB + state.nonTorchGiB) / 64) }}
            >
              {`峰+非T ${(state.torchPeakGiB + state.nonTorchGiB).toFixed(2)}G`}
            </div>
            <div className="wiki-edu-op is-piece" style={{ flex: Math.max(0.32, state.kvPoolGiB / 64) }}>
              {`KV 池 ${state.kvPoolGiB.toFixed(2)}G`}
            </div>
            <div
              className={`wiki-edu-op ${state.isCaptureOomRisk ? "is-bubble" : "is-full"}`}
              style={{ flex: Math.max(0.14, state.headroomGiB / 64) }}
            >
              {`1−u ${state.headroomGiB.toFixed(2)}G`}
            </div>
          </div>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 预算内扣减（禁重扣通信池）</span>
              <span className="wiki-edu-badge is-mid">共享通信域去重</span>
            </div>
            <div className="wiki-edu-metrics">
              <div className="wiki-edu-metric-row">
                <span className="wiki-edu-metric-label">非 Torch 差值口径</span>
                <span className="wiki-edu-metric-val">{state.hcclCanvasLabel}</span>
              </div>
              <div className="wiki-edu-metric-row">
                <span className="wiki-edu-metric-label">物理词槽容量（块数 ≠ 并发数）</span>
                <span className="wiki-edu-metric-val">{`${state.tokenSlots.toLocaleString()} 词槽`}</span>
              </div>
            </div>
          </div>

          <div className={`wiki-edu-panel${state.isCaptureOomRisk ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 1−u 录图与 150MB 建议裕度</span>
              <span
                className={`wiki-edu-badge ${
                  state.isCaptureOomRisk ? "is-bad" : state.isBelowRecommendMargin ? "is-warn" : "is-good"
                }`}
              >
                {state.isCaptureOomRisk
                  ? `图缺口 −${Math.abs(state.graphMarginGiB).toFixed(2)}G`
                  : state.isBelowRecommendMargin
                    ? `裕度差 −${Math.abs(state.recommendMarginGiB).toFixed(2)}G`
                    : `安全富余 +${state.recommendMarginGiB.toFixed(2)}G`}
              </span>
            </div>
            <div className="wiki-edu-metrics">
              <div className="wiki-edu-metric-row">
                <span className="wiki-edu-metric-label">参考图显存 + 150MB 建议裕度</span>
                <span className="wiki-edu-metric-val">{`${state.graphGiB.toFixed(2)}G + 0.15G = ${state.recommendedHeadroomGiB.toFixed(2)}G`}</span>
              </div>
              {state.isHeadroomTight && (
                <button
                  type="button"
                  className="wiki-edu-btn"
                  data-testid="memprof-apply-remediation"
                  style={eduBtnStyle(false)}
                  onClick={() => applyU(0.9)}
                >
                  🔧 一键回调生产推荐水位 u = 0.90
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
