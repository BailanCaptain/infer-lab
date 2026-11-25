import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256 =
  "6b154bffcdccc053c5fe39aa5eb0168863fc68fcb4f582fad8f0aa4b137117c4";
export const MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256 = MEM_PROF_QWEN3_WATERFALL_APPROVED_SHA256;

export const MEM_PROF_TP_OPTIONS = [1, 2, 4, 8] as const;
export type MemProfTpSize = (typeof MEM_PROF_TP_OPTIONS)[number];
export type MemProfDiagramMode = "sandbox" | "svg";

export const A2_SCHEMATIC_TOTAL_GIB = 64.0;
const REDUNDANCY_BUFFER_GIB = 0.15;

interface TpProfileSpec {
  readonly weightsGiB: number;
  readonly torchPeakGiB: number;
  readonly nonTorchGiB: number;
  readonly blockMiB: number;
  readonly graphGiB: number;
  readonly hcclNote: string;
}

const QWEN3_8B_TP_SPECS: Record<MemProfTpSize, TpProfileSpec> = {
  1: {
    weightsGiB: 15.26,
    torchPeakGiB: 2.14,
    nonTorchGiB: 0.6,
    blockMiB: 18.0,
    graphGiB: 2.59,
    hcclNote: "单卡 world(200M)+dp(50M) 具象化已含在 0.60G 非 Torch 差值内",
  },
  2: {
    weightsGiB: 7.63,
    torchPeakGiB: 1.4,
    nonTorchGiB: 0.85,
    blockMiB: 9.0,
    graphGiB: 2.92,
    hcclNote: "双卡 TP2 通信域具象化已含在 0.85G 非 Torch 差值内，严禁二次重扣",
  },
  4: {
    weightsGiB: 3.82,
    torchPeakGiB: 1.0,
    nonTorchGiB: 0.9,
    blockMiB: 4.5,
    graphGiB: 3.1,
    hcclNote: "四卡共享域经 _HCCL_PG_REGISTRY 去重，全部落入 0.90G 非 Torch 增量",
  },
  8: {
    weightsGiB: 1.91,
    torchPeakGiB: 0.8,
    nonTorchGiB: 1.05,
    blockMiB: 2.25,
    graphGiB: 3.21,
    hcclNote: "八卡权重缩至 1.91G，回填推大本地 KV 视图，图显存逆向涨至 3.21G",
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
  readonly requiredHeadroomGiB: number;
  readonly headroomMarginGiB: number;
  readonly isHeadroomTight: boolean;
  readonly hcclNote: string;
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
  const requiredHeadroomGiB = Number((spec.graphGiB + REDUNDANCY_BUFFER_GIB).toFixed(2));
  const headroomMarginGiB = Number((headroomGiB - requiredHeadroomGiB).toFixed(2));
  const isHeadroomTight = headroomGiB < requiredHeadroomGiB;

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
    requiredHeadroomGiB,
    headroomMarginGiB,
    isHeadroomTight,
    hcclNote: spec.hcclNote,
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
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mCut = `${id}-${uid}-mp-cut`;

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
    if (typeof HTMLInputElement !== "undefined" && event.target instanceof HTMLInputElement) return;
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

  const barTotalPx = 828;
  const pxOf = (gib: number) => Math.max(12, Math.round((gib / state.totalGiB) * barTotalPx));
  const wPx = pxOf(state.weightsGiB);
  const aPx = pxOf(state.torchPeakGiB);
  const nPx = pxOf(state.nonTorchGiB);
  const hPx = pxOf(state.headroomGiB);
  const kvPx = Math.max(40, barTotalPx - wPx - aPx - nPx - hPx);

  const xWeight = 16;
  const xAct = xWeight + wPx;
  const xNonTorch = xAct + aPx;
  const xKv = xNonTorch + nPx;
  const xHeadroom = xKv + kvPx;

  const isSafePreset = mode === "sandbox" && Math.abs(state.utilization - 0.9) < 0.005;
  const isTightPreset = mode === "sandbox" && Math.abs(state.utilization - 0.96) < 0.005;

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
              className={`wiki-edu-slider-chip${state.isHeadroomTight ? " is-oom" : ""}`}
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
              style={eduBtnStyle(isTightPreset, "accent")}
              onClick={() => applyU(0.96)}
            >
              u=0.96 挤爆留白!
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={state.isHeadroomTight ? "1−u 录图余量告急" : "七级账本安全闭合"}
      takeawayTone={state.isHeadroomTight ? "danger" : "default"}
      takeaway={
        state.isHeadroomTight ? (
          <>
            <strong>留白被挤爆</strong>：<span className="mono">{`u=${state.utilization.toFixed(2)}`}</span>{" "}
            把单卡 KV 撑到 <strong>{`${state.kvPoolGiB.toFixed(2)}G`}</strong>，右侧只剩{" "}
            <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong>，不够装{" "}
            <strong>{`${state.requiredHeadroomGiB.toFixed(2)}G`}</strong> 录图与裕度！
          </>
        ) : (
          <>
            单卡扣完权重与试跑峰值后切出 <strong>{`${state.usableBlocks.toLocaleString()} 个可用块`}</strong>
            （已扣 1 空块），右侧留出 <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong> 稳接录图开销。
          </>
        )
      }
      kpi={`可用 ${state.usableBlocks.toLocaleString()} 块 (${state.kvPoolGiB.toFixed(2)}G) · 留白 ${state.headroomGiB.toFixed(2)}G`}
      detailsSummary="查看工程与源码细节（Qwen3-8B vs 30B-A3B 对照 / HCCL 去重禁重扣 / 910B3 60.96 GiB 基数与逆向图涨）"
      detailsContent={
        <>
          <strong>七级扣减算式</strong>：
          <code>M_KV = M_total × u − (M_weights + ΔM_torch_peak + ΔM_non_torch)</code>，全组按{" "}
          <code>min(floor(M_KV / B_block))</code> 对齐并弹出 1 个永久空块。在 <code>64 GiB</code> A2 默认{" "}
          <code>u=0.92</code> 下：<code>Qwen3-8B (BF16, TP=1)</code> 剩 <code>40.88 GiB → 2,325 块</code>
          （扣空块 <code>2,324</code> 块 = <code>297,472 tokens</code>）；
          <code>Qwen3-30B-A3B (W8A8, TP4+EP4)</code> 单卡权重约 <code>7.40 GiB</code>、每块{" "}
          <code>3.0 MiB</code> 剩 <code>48.28 GiB → 16,479 块</code>。注意 <code>Ascend 910B3</code> 真机 OS
          可见总显存为 <code>60.96 GiB</code>（非标称 64G），固定 <code>u</code> 扩 <code>TP=1→8</code>{" "}
          会使图显存从 <code>2.59 GiB</code> 逆向涨至 <code>3.21 GiB</code>，且 <code>Qwen3-0.6B</code> 在{" "}
          <code>u=0.90</code> 下因仅剩 <code>1.71G</code> 装不下 <code>1.98G</code> FIA 捕获触发 OOM（降{" "}
          <code>u=0.82</code> 通过）。
        </>
      }
    >
      <div>
        <svg
          viewBox="0 0 860 108"
          width="860"
          height="108"
          style={{ width: "100%", height: "auto", display: "block", marginBottom: "10px" }}
          role="img"
          aria-label={`64 GiB 显存瀑布条：TP=${state.tpSize}, u=${state.utilization.toFixed(2)}`}
        >
          <defs>
            <marker
              id={mCut}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
            </marker>
          </defs>
          <rect x={xWeight} y="24" width={wPx} height="44" rx="4" fill="#fff4cf" stroke="#c78300" />
          <rect x={xAct} y="24" width={aPx} height="44" rx="3" fill="#fff0e9" stroke="#b54237" />
          <rect x={xNonTorch} y="24" width={nPx} height="44" rx="3" fill="#f7e7f2" stroke="#9a4b86" />
          <rect x={xKv} y="24" width={kvPx} height="44" rx="4" fill="#e8edff" stroke="#4c65b6" />
          <rect
            x={xHeadroom}
            y="24"
            width={hPx}
            height="44"
            rx="4"
            fill={state.isHeadroomTight ? "#fff0e9" : "#ece9df"}
            stroke={state.isHeadroomTight ? "#b54237" : "#66716d"}
            strokeDasharray="4 3"
          />
          <line
            x1={xHeadroom}
            y1="12"
            x2={xHeadroom}
            y2="82"
            stroke="#e85b32"
            strokeWidth="2"
            markerEnd={`url(#${mCut})`}
          />
          {wPx >= 56 && (
            <text
              x={xWeight + wPx / 2}
              y="50"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#17211f"
            >
              {`权重 ${state.weightsGiB}G`}
            </text>
          )}
          <text x={xKv + kvPx / 2} y="50" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
            {`可用 KV 池 ${state.kvPoolGiB.toFixed(2)}G → ${state.usableBlocks.toLocaleString()} 块`}
          </text>
          <text x="18" y="94" fontSize="12" fill="#66716d">
            {`预算 ${state.budgetGiB.toFixed(2)}G = 权重 ${state.weightsGiB}G + 激活 ${state.torchPeakGiB}G + 非Torch ${state.nonTorchGiB}G + KV 池`}
          </text>
          <text
            x="844"
            y="94"
            textAnchor="end"
            fontSize="12"
            fontWeight="700"
            fill={state.isHeadroomTight ? "#b54237" : "#087f73"}
          >
            {`1−u 留白 ${state.headroomGiB.toFixed(2)}G`}
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 预算内扣减（禁二次重扣 HCCL!）</span>
              <span className="wiki-edu-badge is-mid">{`每块 ${state.blockMiB} MiB`}</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>重叠禁区提醒</strong>：{state.hcclNote}。切出的{" "}
              <strong>{`${state.tokenSlots.toLocaleString()} 个词槽`}</strong>按实际上下文长度动态借还，块数 ≠
              固定并发条数！
            </div>
          </div>

          <div className={`wiki-edu-panel${state.isHeadroomTight ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 切完 KV 后：1−u 录图与 150M 裕度</span>
              <span className={`wiki-edu-badge ${state.isHeadroomTight ? "is-bad" : "is-good"}`}>
                {state.isHeadroomTight
                  ? `缺口 −${Math.abs(state.headroomMarginGiB).toFixed(2)}G`
                  : `富余 +${state.headroomMarginGiB.toFixed(2)}G`}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              录图需约 <strong>{`${state.graphGiB.toFixed(2)}G`}</strong> + 安全裕度 <strong>0.15G</strong>
              （共 <strong>{`${state.requiredHeadroomGiB.toFixed(2)}G`}</strong>），扩 TP 时每卡 KV
              池变大，图显存反而逆向递增！
            </div>
            {state.isHeadroomTight && (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="memprof-apply-remediation"
                style={eduBtnStyle(false)}
                onClick={() => applyU(0.9)}
              >
                🔧 一键回调生产安全水位 u = 0.90
              </button>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
