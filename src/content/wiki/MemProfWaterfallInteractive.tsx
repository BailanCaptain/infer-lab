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

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mFlow = `${id}-${uid}-mem-flow`;
  const isSafePreset = mode === "sandbox" && Math.abs(state.utilization - 0.9) < 0.005;
  const isTightPreset = mode === "sandbox" && Math.abs(state.utilization - 0.96) < 0.005;

  const wfTop = 48;
  const wfBottom = 224;
  const wfPxPerGiB = (wfBottom - wfTop) / A2_SCHEMATIC_TOTAL_GIB;
  const yOfGiB = (g: number) => Number((wfBottom - g * wfPxPerGiB).toFixed(1));
  const afterW = Math.max(0, state.budgetGiB - state.weightsGiB);
  const afterT = Math.max(0, afterW - state.torchPeakGiB);
  const yBudget = yOfGiB(state.budgetGiB);
  const yAfterW = yOfGiB(afterW);
  const yAfterT = yOfGiB(afterT);
  const yKvTop = yOfGiB(state.kvPoolGiB);

  const hrBase = 212;
  const hrMaxGiB = 14;
  const hrMaxH = 140;
  const hrBarH = Number(Math.min(hrMaxH, (state.headroomGiB / hrMaxGiB) * hrMaxH).toFixed(1));
  const grBarH = Number(((state.graphGiB / hrMaxGiB) * hrMaxH).toFixed(1));
  const recTotalH = Number(((state.recommendedHeadroomGiB / hrMaxGiB) * hrMaxH).toFixed(1));
  const yGraphLine = Number((hrBase - grBarH).toFixed(1));
  const yRecLine = Number((hrBase - recTotalH).toFixed(1));

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
        <svg
          viewBox="0 0 860 278"
          width="860"
          height="278"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`64 GiB 显存扣减瀑布（TP=${state.tpSize}, u=${state.utilization.toFixed(2)}）`}
        >
          <defs>
            <marker
              id={mFlow}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="#4c65b6" />
            </marker>
          </defs>

          <rect
            x="10"
            y="8"
            width="466"
            height="264"
            rx="9"
            fill="#fbfaf6"
            stroke="#d8d8cf"
            strokeWidth="1.3"
          />
          <text x="22" y="28" fontSize="12.5" fontWeight="700" fill="#17211f">
            ① 64 GiB 预算内三级扣减瀑布
          </text>
          <text x="462" y="28" textAnchor="end" fontSize="12" fontWeight="700" fill="#e85b32">
            {`u=${state.utilization.toFixed(2)} (${state.budgetGiB.toFixed(2)} GiB)`}
          </text>

          <rect x="24" y={wfTop} width="60" height={yBudget - wfTop} fill="#ffffff" stroke="#d8d8cf" />
          <rect x="24" y={yBudget} width="60" height={wfBottom - yBudget} fill="#ece9df" stroke="#66716d" />
          <line
            x1="18"
            y1={yBudget}
            x2="458"
            y2={yBudget}
            stroke="#e85b32"
            strokeWidth="1.6"
            strokeDasharray="5 3"
          />

          <rect x="110" y={yAfterW} width="60" height={wfBottom - yAfterW} fill="#ece9df" opacity="0.45" />
          <rect
            x="110"
            y={yBudget}
            width="60"
            height={Math.max(3, yAfterW - yBudget)}
            fill="#fff4cf"
            stroke="#c78300"
            strokeWidth="1.4"
          />
          <line x1="170" y1={yAfterW} x2="196" y2={yAfterW} stroke="#66716d" strokeDasharray="3 2" />

          <rect x="196" y={yAfterT} width="60" height={wfBottom - yAfterT} fill="#ece9df" opacity="0.45" />
          <rect
            x="196"
            y={yAfterW}
            width="60"
            height={Math.max(3, yAfterT - yAfterW)}
            fill="#fff0e9"
            stroke="#e85b32"
            strokeWidth="1.4"
          />
          <line x1="256" y1={yAfterT} x2="282" y2={yAfterT} stroke="#66716d" strokeDasharray="3 2" />

          <rect x="282" y={yKvTop} width="60" height={wfBottom - yKvTop} fill="#ece9df" opacity="0.45" />
          <rect
            x="282"
            y={yAfterT}
            width="60"
            height={Math.max(3, yKvTop - yAfterT)}
            fill="#f7e7f2"
            stroke="#9a4b86"
            strokeWidth="1.4"
          />
          <line
            x1="342"
            y1={yKvTop}
            x2="368"
            y2={yKvTop}
            stroke="#4c65b6"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />

          <rect
            x="368"
            y={yKvTop}
            width="76"
            height={Math.max(4, wfBottom - yKvTop)}
            rx="4"
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.6"
          />

          <text x="54" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            总显存
          </text>
          <text x="54" y="262" textAnchor="middle" fontSize="12" fill="#66716d">
            64.00G
          </text>
          <text x="140" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            扣权重
          </text>
          <text
            x="140"
            y="262"
            textAnchor="middle"
            fontSize="12"
            fill="#c78300"
          >{`−${state.weightsGiB.toFixed(2)}G`}</text>
          <text x="226" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            扣激活峰
          </text>
          <text
            x="226"
            y="262"
            textAnchor="middle"
            fontSize="12"
            fill="#e85b32"
          >{`−${state.torchPeakGiB.toFixed(2)}G`}</text>
          <text x="312" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            扣非Torch
          </text>
          <text
            x="312"
            y="262"
            textAnchor="middle"
            fontSize="12"
            fill="#9a4b86"
          >{`−${state.nonTorchGiB.toFixed(2)}G`}</text>
          <text x="406" y="244" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            KV 预算
          </text>
          <text
            x="406"
            y="262"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#4c65b6"
          >{`${state.kvPoolGiB.toFixed(2)}G`}</text>

          <line
            x1="446"
            y1="136"
            x2="490"
            y2="76"
            stroke="#4c65b6"
            strokeWidth="1.8"
            markerEnd={`url(#${mFlow})`}
          />

          <rect
            x="492"
            y="48"
            width="162"
            height="52"
            rx="7"
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.4"
          />
          <text x="573" y="69" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            折算物理总块
          </text>
          <text x="573" y="89" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
            {`${state.totalBlocks.toLocaleString()} 块 (${state.blockMiB}MiB)`}
          </text>

          <line
            x1="573"
            y1="102"
            x2="573"
            y2="114"
            stroke="#4c65b6"
            strokeWidth="1.6"
            markerEnd={`url(#${mFlow})`}
          />
          <rect
            x="492"
            y="116"
            width="162"
            height="50"
            rx="7"
            fill="#fbfaf6"
            stroke="#66716d"
            strokeWidth="1.4"
          />
          <text x="573" y="136" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            扣 1 保留空块
          </text>
          <text x="573" y="156" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`可用 ${state.usableBlocks.toLocaleString()} 块`}
          </text>

          <line
            x1="573"
            y1="168"
            x2="573"
            y2="180"
            stroke="#4c65b6"
            strokeWidth="1.6"
            markerEnd={`url(#${mFlow})`}
          />
          <rect
            x="492"
            y="182"
            width="162"
            height="52"
            rx="7"
            fill="#ddf4ef"
            stroke="#087f73"
            strokeWidth="1.5"
          />
          <text x="573" y="203" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            可用词槽 (×128)
          </text>
          <text x="573" y="223" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
            {`${state.tokenSlots.toLocaleString()} 词槽`}
          </text>

          <rect
            x="666"
            y="8"
            width="184"
            height="264"
            rx="9"
            fill={state.isCaptureOomRisk ? "#fff0e9" : "#fbfaf6"}
            stroke={state.isCaptureOomRisk ? "#b54237" : "#d8d8cf"}
            strokeWidth="1.4"
          />
          <text x="758" y="28" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
            ② 留白 vs 录图与裕度
          </text>

          <rect
            x="688"
            y={hrBase - hrBarH}
            width="54"
            height={hrBarH}
            rx="4"
            fill={state.isCaptureOomRisk ? "#fff0e9" : "#ddf4ef"}
            stroke={state.isCaptureOomRisk ? "#b54237" : "#087f73"}
            strokeWidth="1.5"
          />
          <rect
            x="772"
            y={yRecLine}
            width="54"
            height={Math.max(2, yGraphLine - yRecLine)}
            fill="#fff4cf"
            stroke="#c78300"
          />
          <rect
            x="772"
            y={yGraphLine}
            width="54"
            height={grBarH}
            rx="3"
            fill="#f7e7f2"
            stroke="#9a4b86"
            strokeWidth="1.4"
          />
          <line x1="680" y1={yGraphLine} x2="834" y2={yGraphLine} stroke="#9a4b86" strokeWidth="1.5" />
          <line
            x1="680"
            y1={yRecLine}
            x2="834"
            y2={yRecLine}
            stroke="#c78300"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />

          <text x="715" y="232" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`留 ${state.headroomGiB.toFixed(2)}G`}
          </text>
          <text x="799" y="232" textAnchor="middle" fontSize="12" fontWeight="700" fill="#9a4b86">
            {`图 ${state.graphGiB.toFixed(2)}G`}
          </text>
          <text
            x="758"
            y="256"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={state.isCaptureOomRisk ? "#b54237" : state.isBelowRecommendMargin ? "#c78300" : "#087f73"}
          >
            {state.isCaptureOomRisk
              ? `缺口 −${Math.abs(state.graphMarginGiB).toFixed(2)} GiB (OOM)`
              : state.isBelowRecommendMargin
                ? `差裕度 −${Math.abs(state.recommendMarginGiB).toFixed(2)} GiB`
                : `富余 +${state.recommendMarginGiB.toFixed(2)} GiB (+150MiB)`}
          </text>
        </svg>

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
