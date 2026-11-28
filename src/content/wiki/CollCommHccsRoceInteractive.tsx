import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { type EduBadgeTone, WikiEduSandboxShell } from "./WikiEduSandboxShell";

function tokenBtnStyle(active: boolean, kind: "dark" | "teal" = "teal") {
  if (!active) {
    return {
      background: "var(--color-surface-elevated)",
      borderColor: "var(--color-line)",
      color: "var(--color-ink)",
    } as const;
  }
  const bg = kind === "dark" ? "var(--color-ink)" : "var(--color-token)";
  return {
    background: bg,
    borderColor: bg,
    color: "var(--color-ink-inverse)",
  } as const;
}

export const COLL_COMM_HCCS_ROCE_APPROVED_SHA256 =
  "b67de3cb5834e67f6c51f8d9b0b9340dbb3fe9fdd42b852d993b2ac53cd586b7";
export const COLL_COMM_FIG_HCCS_VS_ROCE_APPROVED_SHA256 = COLL_COMM_HCCS_ROCE_APPROVED_SHA256;

export const COLL_COMM_DOMAINS = ["hccs", "roce"] as const;
export type CollCommDomain = (typeof COLL_COMM_DOMAINS)[number];

export const COLL_COMM_GROUP_SIZES = [2, 4, 8, 16] as const;
export type CollCommGroupSize = (typeof COLL_COMM_GROUP_SIZES)[number];

export type CollCommDiagramMode = "sandbox" | "svg";
export type CollParallelStrategyId = "tp" | "sp" | "ep" | "pp";

export const HCCS_NOMINAL_GBPS = 392;
export const ROCE_NOMINAL_GBPS = 25;
export const HCCS_ROCE_CLIFF_RATIO = 15.6;
export const HCCS_ROCE_EXACT_RATIO = Number((HCCS_NOMINAL_GBPS / ROCE_NOMINAL_GBPS).toFixed(2)); // 15.68
export const ASCEND_910B3_TP4_16MIB_MEASURED_US = 523.88;
export const ASCEND_910B3_TP4_16MIB_TRANSIT_MB = 25.165824;

export interface CollStrategyRowMetrics {
  readonly id: CollParallelStrategyId;
  readonly shortTitle: string;
  readonly formulaText: string;
  readonly sendMiB: number;
  readonly sendDecimalMB: number;
  readonly wireSerializationUs: number;
  readonly barPx: number;
  readonly blockingPerLayer: boolean;
  readonly crossNodeHazard: boolean;
  readonly fillColor: string;
  readonly strokeColor: string;
}

export interface CollCommSandboxInput {
  readonly domain: CollCommDomain;
  readonly groupSize: number;
  readonly payloadMiB: number;
  readonly safeHybridApplied?: boolean | undefined;
}

export interface CollCommSandboxState {
  readonly domain: CollCommDomain;
  readonly requestedDomain: CollCommDomain;
  readonly forcedCrossNodeFromIntra: boolean;
  readonly domainLabel: string;
  readonly nominalGBps: number;
  readonly cliffRatio: number;
  readonly exactRatio: number;
  readonly groupSize: number;
  readonly payloadMiB: number;
  readonly ringScale: number;
  readonly tpSendMiB: number;
  readonly tpPerLayerTwoCallsMiB: number;
  readonly spSendMiB: number;
  readonly spHalfStageMiB: number;
  readonly epSendMiB: number;
  readonly ppSendMiB: number;
  readonly dpControlBytesPerDpRank: 8;
  readonly dpControlBytesAtDp2: 16;
  readonly maxRefUs: number;
  readonly tpWireUs: number;
  readonly ppWireUs: number;
  readonly isCrossNodeTpCliff: boolean;
  readonly safeHybridApplied: boolean;
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly summaryText: string;
  readonly rows: readonly CollStrategyRowMetrics[];
}

function calcWireSerializationUs(sendMiB: number, nominalGBps: number): number {
  const bytes = sendMiB * 1024 * 1024;
  const sec = bytes / (nominalGBps * 1e9);
  return Number((sec * 1e6).toFixed(1));
}

export function computeCollCommSandboxState(input: CollCommSandboxInput): CollCommSandboxState {
  const requestedDomain = input.domain;
  const groupSize = Math.max(2, Math.round(input.groupSize));
  const forcedCrossNodeFromIntra = requestedDomain === "hccs" && groupSize > 8;
  const domain: CollCommDomain = forcedCrossNodeFromIntra ? "roce" : requestedDomain;
  const payloadMiB = Math.min(128, Math.max(4, Math.round(input.payloadMiB)));
  const safeHybridApplied = Boolean(input.safeHybridApplied);

  const nominalGBps = domain === "hccs" ? HCCS_NOMINAL_GBPS : ROCE_NOMINAL_GBPS;
  const domainLabel =
    domain === "hccs" ? "机内高速直连域（单机 ≤ 8 卡，392 GB/s）" : "跨机网口域（200GE 线速 25 GB/s）";

  const ringScale = (groupSize - 1) / groupSize;
  const exactHalfStageMiB = ringScale * payloadMiB;
  const exactTpSendMiB = 2 * exactHalfStageMiB;

  const tpSendMiB = Number(exactTpSendMiB.toFixed(2));
  const tpPerLayerTwoCallsMiB = Number((2 * exactTpSendMiB).toFixed(2));
  const spHalfStageMiB = Number(exactHalfStageMiB.toFixed(2));
  const spSendMiB = Number(exactTpSendMiB.toFixed(2));
  const epSendMiB = Number(exactHalfStageMiB.toFixed(2));
  const ppSendMiB = Number(payloadMiB.toFixed(2));

  const tpWireUs = calcWireSerializationUs(exactTpSendMiB, nominalGBps);
  const spWireUs = calcWireSerializationUs(exactTpSendMiB, nominalGBps);
  const epWireUs = calcWireSerializationUs(exactHalfStageMiB, nominalGBps);
  const ppWireUs = calcWireSerializationUs(payloadMiB, nominalGBps);

  // Reference scale for schematic serialization bar: max RoCE TP at current payload
  const maxRefUs = Math.max(10, calcWireSerializationUs(2 * (15 / 16) * payloadMiB, ROCE_NOMINAL_GBPS));
  const toBarPx = (us: number) => Number(Math.min(288, Math.max(0, (us / maxRefUs) * 288)).toFixed(2));

  const isCrossNodeTpCliff = domain === "roce";

  const rows: readonly CollStrategyRowMetrics[] = [
    {
      id: "tp",
      shortTitle: "① 全归约",
      formulaText: "2(N−1)/N · M",
      sendMiB: tpSendMiB,
      sendDecimalMB: Number(((exactTpSendMiB * 1048576) / 1e6).toFixed(2)),
      wireSerializationUs: tpWireUs,
      barPx: toBarPx(tpWireUs),
      blockingPerLayer: true,
      crossNodeHazard: isCrossNodeTpCliff,
      fillColor: isCrossNodeTpCliff ? "var(--color-accent-soft)" : "var(--color-token-soft)",
      strokeColor: isCrossNodeTpCliff ? "var(--color-danger)" : "var(--color-token)",
    },
    {
      id: "sp",
      shortTitle: "② 分散收集",
      formulaText: "(N−1)/N·M × 2",
      sendMiB: spSendMiB,
      sendDecimalMB: Number(((exactTpSendMiB * 1048576) / 1e6).toFixed(2)),
      wireSerializationUs: spWireUs,
      barPx: toBarPx(spWireUs),
      blockingPerLayer: true,
      crossNodeHazard: isCrossNodeTpCliff,
      fillColor: isCrossNodeTpCliff ? "var(--color-accent-soft)" : "var(--color-kv-soft)",
      strokeColor: isCrossNodeTpCliff ? "var(--color-danger)" : "var(--color-kv)",
    },
    {
      id: "ep",
      shortTitle: "③ 专家派发",
      formulaText: "(N−1)/N · M",
      sendMiB: epSendMiB,
      sendDecimalMB: Number(((exactHalfStageMiB * 1048576) / 1e6).toFixed(2)),
      wireSerializationUs: epWireUs,
      barPx: toBarPx(epWireUs),
      blockingPerLayer: false,
      crossNodeHazard: false,
      fillColor: "var(--color-comm-soft)",
      strokeColor: "var(--color-comm)",
    },
    {
      id: "pp",
      shortTitle: "④ 段间交接",
      formulaText: "段间 1×M (非逐层)",
      sendMiB: ppSendMiB,
      sendDecimalMB: Number(((payloadMiB * 1048576) / 1e6).toFixed(2)),
      wireSerializationUs: ppWireUs,
      barPx: toBarPx(ppWireUs),
      blockingPerLayer: false,
      crossNodeHazard: false,
      fillColor: "var(--color-weight-soft)",
      strokeColor: "var(--color-weight)",
    },
  ];

  let takeawayBadge: string;
  let takeawayTone: EduBadgeTone;
  let summaryText: string;

  if (isCrossNodeTpCliff) {
    takeawayBadge = `跨机 ${HCCS_ROCE_EXACT_RATIO}× 悬崖告警`;
    takeawayTone = "danger";
    summaryText = forcedCrossNodeFromIntra
      ? `两台各 8 卡机器拼 ${groupSize} 卡必跨机：25 GB/s 网口下 TP 单次发 ${tpSendMiB.toFixed(1)} MiB，理想串行耗时升至 ${tpWireUs} µs（每层 2 次阻塞同步）。`
      : `跨机 25 GB/s 网口下 ${groupSize} 卡阻塞 TP 单次发 ${tpSendMiB.toFixed(1)} MiB，理想线速串行耗时达 ${tpWireUs} µs（每层 2 次阻塞同步）。`;
  } else if (safeHybridApplied) {
    takeawayBadge = "安全分级 · 机内锁 TP=8";
    takeawayTone = "accent";
    summaryText = `已切回安全分层拓扑：逐层阻塞归约锁在机内（TP=${groupSize} 单次理想串行 ${tpWireUs} µs），跨机网口仅传段间 PP=2 或独立 DP=2。`;
  } else {
    takeawayBadge = "机内高速直连 · 匹配";
    takeawayTone = "default";
    summaryText = `机内 392 GB/s 下 ${groupSize} 卡 TP 单次发 ${tpSendMiB.toFixed(1)} MiB（理想串行 ${tpWireUs} µs），而 PP 仅在段边界传 1 次 ${ppSendMiB} MiB。`;
  }

  return {
    domain,
    requestedDomain,
    forcedCrossNodeFromIntra,
    domainLabel,
    nominalGBps,
    cliffRatio: HCCS_ROCE_CLIFF_RATIO,
    exactRatio: HCCS_ROCE_EXACT_RATIO,
    groupSize,
    payloadMiB,
    ringScale,
    tpSendMiB,
    tpPerLayerTwoCallsMiB,
    spSendMiB,
    spHalfStageMiB,
    epSendMiB,
    ppSendMiB,
    dpControlBytesPerDpRank: 8,
    dpControlBytesAtDp2: 16,
    maxRefUs,
    tpWireUs,
    ppWireUs,
    isCrossNodeTpCliff,
    safeHybridApplied,
    takeawayBadge,
    takeawayTone,
    summaryText,
    rows,
  };
}

export interface CollCommHccsRoceInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: CollCommDiagramMode | undefined;
  readonly initialDomain?: CollCommDomain | undefined;
  readonly initialGroupSize?: CollCommGroupSize | undefined;
  readonly initialPayloadMiB?: number | undefined;
  readonly initialSafeHybridApplied?: boolean | undefined;
}

export function CollCommHccsRoceInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialDomain = "hccs",
  initialGroupSize = 4,
  initialPayloadMiB = 16,
  initialSafeHybridApplied = false,
}: CollCommHccsRoceInteractiveProps) {
  const [mode, setMode] = useState<CollCommDiagramMode>(initialMode);
  const [domain, setDomain] = useState<CollCommDomain>(initialDomain);
  const [groupSize, setGroupSize] = useState<CollCommGroupSize>(initialGroupSize);
  const [payloadMiB, setPayloadMiB] = useState<number>(initialPayloadMiB);
  const [safeHybridApplied, setSafeHybridApplied] = useState<boolean>(initialSafeHybridApplied);

  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cliffArrowId = `${id}-${uid}-coll-cliff`;

  const state = useMemo(
    () => computeCollCommSandboxState({ domain, groupSize, payloadMiB, safeHybridApplied }),
    [domain, groupSize, payloadMiB, safeHybridApplied],
  );

  const selectDomain = (next: CollCommDomain) => {
    setMode("sandbox");
    setSafeHybridApplied(false);
    setDomain(next);
    if (next === "hccs" && groupSize > 8) {
      setGroupSize(8);
    }
  };

  const selectGroupSize = (next: CollCommGroupSize) => {
    setMode("sandbox");
    setSafeHybridApplied(false);
    setGroupSize(next);
    if (next > 8 && domain === "hccs") {
      setDomain("roce");
    }
  };

  const selectPayloadMiB = (next: number) => {
    setMode("sandbox");
    setPayloadMiB(Math.min(128, Math.max(4, Math.round(next))));
  };

  const applyDangerCrossTp16 = () => {
    setMode("sandbox");
    setSafeHybridApplied(false);
    setDomain("roce");
    setGroupSize(16);
  };

  const applySafePrescription = () => {
    setMode("sandbox");
    setDomain("hccs");
    setGroupSize(8);
    setSafeHybridApplied(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (shouldPassKeyToRangeInput(event.target, event.key)) return;
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    const nIdx = COLL_COMM_GROUP_SIZES.indexOf(groupSize);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectGroupSize(COLL_COMM_GROUP_SIZES[Math.min(COLL_COMM_GROUP_SIZES.length - 1, nIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectGroupSize(COLL_COMM_GROUP_SIZES[Math.max(0, nIdx - 1)]!);
        break;
      case "1":
        event.preventDefault();
        selectDomain("hccs");
        break;
      case "2":
        event.preventDefault();
        selectDomain("roce");
        break;
    }
  };

  const isCrossTp16Active = mode === "sandbox" && state.domain === "roce" && groupSize === 16;

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
      kickerTag="母版 B · 拓扑域与带宽悬崖"
      kickerTitle="机内 HCCS/UB vs 跨机 RoCE 带宽悬崖与并行映射"
      question="为什么两台 8 卡服务器拼 16 卡时，绝不能直接开跨机 TP=16，而要拆成机内 TP=8 + 跨机 PP/DP？"
      toolbarLabel="物理互联域、张量载荷 M 与跨机极值控制"
      onToolbarKeyDown={handleKeyDown}
      useTokenVariables
      extraRootAttrs={{
        "data-domain": state.domain,
        "data-group-size": state.groupSize,
        "data-payload-mib": state.payloadMiB,
        "data-cliff": state.isCrossNodeTpCliff ? "true" : "false",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="物理互联域切换">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="coll-domain-hccs"
              aria-pressed={mode === "sandbox" && state.domain === "hccs"}
              style={tokenBtnStyle(mode === "sandbox" && state.domain === "hccs", "teal")}
              onClick={() => selectDomain("hccs")}
            >
              机内直连
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="coll-domain-roce"
              aria-pressed={mode === "sandbox" && state.domain === "roce"}
              style={tokenBtnStyle(mode === "sandbox" && state.domain === "roce", "dark")}
              onClick={() => selectDomain("roce")}
            >
              跨机网口
            </button>
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="完整张量载荷 M 滑块">
            <label
              htmlFor={sliderId}
              className={`wiki-edu-slider-chip${state.isCrossNodeTpCliff ? " is-oom" : ""}`}
            >
              <span className="mono">{`载荷=${state.payloadMiB}M`}</span>
              <input
                id={sliderId}
                type="range"
                min={4}
                max={128}
                step={4}
                value={state.payloadMiB}
                data-testid="coll-m-slider"
                aria-valuetext={`完整张量载荷 ${state.payloadMiB} MiB`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => selectPayloadMiB(Number(e.target.value))}
              />
            </label>
          </fieldset>
        </>
      }
      takeawayBadge={state.takeawayBadge}
      takeawayTone={state.takeawayTone}
      takeaway={state.summaryText}
      kpi={`TP 单次 ${state.tpSendMiB.toFixed(1)} MiB`}
      detailsSummary="查看工程与源码细节（均衡 Ring 公式 / 理想串行口径 / 910B3 实测）"
      detailsContent={
        <>
          源码锚点：<code>vllm@ced6857a:vllm/model_executor/layers/linear.py#L608-L611, #L1775-L1777</code>（
          <code>tensor_model_parallel_all_gather</code> / <code>tensor_model_parallel_all_reduce</code>）、
          <code>vllm/distributed/parallel_state.py#L721-L796, #L1148-L1285</code>（<code>all_reduce</code> /{" "}
          <code>all_gather</code> / <code>reduce_scatter</code> 与 PP <code>isend_tensor_dict</code> /{" "}
          <code>irecv_tensor_dict</code>）及{" "}
          <code>vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L27-L31</code>（
          <code>MoECommType</code>）。均衡 Ring 口径（
          <code>{`M = ${state.payloadMiB} MiB, N = ${state.groupSize}`}</code>
          ）：TP 单次 <code>{`2(N−1)/N·M = ${state.tpSendMiB.toFixed(2)} MiB`}</code>（每层 2 次阻塞归约合计{" "}
          <code>{`${state.tpPerLayerTwoCallsMiB.toFixed(2)} MiB`}</code>）；SP 拆为{" "}
          <code>{`(N−1)/N·M = ${state.spHalfStageMiB.toFixed(2)} MiB`}</code> 两半合计{" "}
          <code>{`${state.spSendMiB.toFixed(2)} MiB`}</code>；EP 等分基准{" "}
          <code>{`(N−1)/N·M = ${state.epSendMiB.toFixed(2)} MiB`}</code>；PP 仅在流水段边界传 1 次{" "}
          <code>{`${state.ppSendMiB} MiB`}</code>（DP CPU 同步张量 <code>(2, dp_size) int32 = 8×DP B</code>
          ，DP=2 为 <code>16 B</code>）。带宽落差口径：A2 七链 HCCS 聚合标称 <code>392 GB/s</code> vs 200GE
          端口线速 <code>25 GB/s</code>，精确比 <code>392/25 = {state.exactRatio}×</code>（四舍五入{" "}
          <code>15.7×</code>，资料常简记 <code>15.6×</code>）；图中微秒数为按 <code>发送字节/标称带宽</code>{" "}
          计算的理想串行耗时，不能直接等同端到端整步倍数。<code>Ascend 910B3</code> 真机{" "}
          <code>TP=4, M=16 MiB</code> 微基准实测单次 transit{" "}
          <code>{`${ASCEND_910B3_TP4_16MIB_TRANSIT_MB} MB`}</code>（恰为 <code>24 MiB</code>），
          <code>hcom_allReduce_</code> 均值耗时 <code>{`${ASCEND_910B3_TP4_16MIB_MEASURED_US} µs`}</code>
          （有效带宽 <code>17.71~17.74 GB/s</code>）。
        </>
      }
    >
      <div className="wiki-edu-w4a-wrap">
        <style>{`
          .wiki-edu-w4a-wrap { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
          .wiki-edu-param-drawer { border: 1px solid var(--color-line); border-radius: 8px; background: var(--color-surface); padding: 7px 11px; font-size: 12.5px; color: var(--color-ink); min-width: 0; }
          .wiki-edu-param-drawer > summary { cursor: pointer; font-weight: 700; color: var(--color-ink); user-select: none; list-style-position: inside; }
          .wiki-edu-param-drawer-body { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-line); min-width: 0; }
          .wiki-edu-param-label { font-size: 12px; font-weight: 700; color: var(--color-ink); }
          .wiki-edu-w4a-svg { width: 100%; max-width: 900px; height: auto; display: block; margin-inline: auto; }
          .wiki-edu-w4a-mobile { display: none; flex-direction: column; gap: 8px; min-width: 0; }
          .wiki-edu-w4a-mcard { padding: 9px 11px; border-radius: 8px; border: 1.5px solid var(--color-line); background: var(--color-surface); display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 12.5px; line-height: 1.45; color: var(--color-ink); }
          .wiki-edu-w4a-mhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 13px; }
          .wiki-edu-w4a-mbar-track { width: 100%; height: 12px; border-radius: 6px; background: var(--color-surface-elevated); border: 1px solid var(--color-line); overflow: hidden; }
          .wiki-edu-w4a-mbar-fill { height: 100%; border-radius: 5px; transition: width 240ms ease, background-color 180ms ease; }
          .wiki-edu-w4a-anim { transition: width 240ms ease, fill 180ms ease, stroke 180ms ease; }
          @media (min-width: 821px) {
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
              flex-wrap: nowrap;
              padding: 8px 10px;
              gap: 6px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
              flex-wrap: nowrap;
              gap: 4px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
              padding: 4px 8px;
              font-size: 12px;
              white-space: nowrap;
              flex-shrink: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip {
              padding: 2px 8px;
              gap: 6px;
              font-size: 12px;
              white-space: nowrap;
              flex-shrink: 1;
              min-width: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip input[type="range"] {
              width: 72px;
              min-width: 56px;
            }
          }
          @media (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; gap: 5px; }
            .wiki-edu-w4a-mcard { padding: 5px 9px; gap: 3px; font-size: 12px; }
            .wiki-edu-w4a-mhead { font-size: 12px; }
            .wiki-edu-w4a-mbar-track { height: 7px; }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
              flex-wrap: nowrap;
              padding: 6px 8px;
              gap: 4px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
              flex-wrap: nowrap;
              gap: 3px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
              padding: 4px 6px;
              font-size: 11.5px;
              white-space: nowrap;
              flex-shrink: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip {
              padding: 2px 6px;
              gap: 4px;
              font-size: 11px;
              white-space: nowrap;
              flex-wrap: nowrap;
              flex-shrink: 1;
              min-width: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip input[type="range"] {
              width: 48px;
              min-width: 36px;
            }
            .wiki-edu-takeaway-badge, .wiki-edu-kpi, .wiki-edu-static-toggle { white-space: normal; overflow-wrap: anywhere; max-width: 100%; }
            .wiki-edu-note-card, .wiki-edu-details-body { min-width: 0; overflow-wrap: anywhere; }
          }
          @container reader-main (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; }
          }
        `}</style>

        <svg
          viewBox="0 0 860 284"
          width="860"
          height="284"
          className="wiki-edu-w4a-svg"
          role="img"
          aria-label={`机内直连与跨机网口带宽悬崖及四类并行单卡发送量标尺（N=${state.groupSize}, M=${state.payloadMiB} MiB）`}
        >
          <defs>
            <marker
              id={cliffArrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="var(--color-danger)" />
            </marker>
          </defs>

          <rect
            x="12"
            y="10"
            width="360"
            height="76"
            rx="8"
            fill={state.domain === "hccs" ? "var(--color-token-soft)" : "var(--color-surface)"}
            stroke={state.domain === "hccs" ? "var(--color-token)" : "var(--color-line)"}
            strokeWidth={state.domain === "hccs" ? "2" : "1.4"}
          />
          <text x="26" y="32" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            机内直连 · 392 GB/s
          </text>
          <rect
            x="26"
            y="42"
            width="332"
            height="12"
            rx="6"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect x="26" y="42" width="332" height="12" rx="6" fill="var(--color-token)" />
          <text x="26" y="74" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            ✓ 锁机内：逐层 TP / SP
          </text>

          <rect
            x="382"
            y="14"
            width="96"
            height="68"
            rx="8"
            fill="var(--color-accent-soft)"
            stroke="var(--color-danger)"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <text
            x="430"
            y="34"
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill="var(--color-danger)"
          >
            {`${state.exactRatio}× 悬崖`}
          </text>
          <line
            x1="396"
            y1="48"
            x2="462"
            y2="48"
            stroke="var(--color-danger)"
            strokeWidth="1.6"
            strokeDasharray="4 3"
            markerEnd={`url(#${cliffArrowId})`}
          />
          <text x="430" y="72" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-danger)">
            ✗ 忌跨机 TP
          </text>

          <rect
            x="488"
            y="10"
            width="360"
            height="76"
            rx="8"
            fill={state.domain === "roce" ? "var(--color-accent-soft)" : "var(--color-comm-soft)"}
            stroke={state.domain === "roce" ? "var(--color-danger)" : "var(--color-comm)"}
            strokeWidth={state.domain === "roce" ? "2" : "1.4"}
          />
          <text x="502" y="32" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            跨机网口 · 25 GB/s
          </text>
          <rect
            x="502"
            y="42"
            width="332"
            height="12"
            rx="6"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect x="502" y="42" width="22" height="12" rx="6" fill="var(--color-danger)" />
          <text x="502" y="74" fontSize="12" fontWeight="700" fill="var(--color-comm)">
            ✓ 宜跨机：段间 PP / 独立 DP
          </text>

          {state.rows.map((row, idx) => {
            const rowY = 100 + idx * 44;
            const textY = rowY + 24;
            const scaledBarW = Number(
              Math.min(390, Math.max(0, (row.wireSerializationUs / state.maxRefUs) * 390)).toFixed(2),
            );
            return (
              <g key={row.id}>
                <rect
                  x="12"
                  y={rowY}
                  width="836"
                  height="38"
                  rx="7"
                  fill={row.fillColor}
                  stroke={row.strokeColor}
                  strokeWidth={row.crossNodeHazard ? "1.8" : "1.4"}
                />
                <text x="26" y={textY} fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
                  {row.shortTitle}
                </text>
                <rect
                  x="200"
                  y={rowY + 11}
                  width="390"
                  height="16"
                  rx="5"
                  fill="var(--color-surface-elevated)"
                  stroke="var(--color-line)"
                />
                <rect
                  x="200"
                  y={rowY + 11}
                  width={scaledBarW}
                  height="16"
                  rx="5"
                  className="wiki-edu-w4a-anim"
                  fill={row.strokeColor}
                />
                <text
                  x="834"
                  y={textY}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="700"
                  fill={row.crossNodeHazard ? "var(--color-danger)" : "var(--color-ink)"}
                >
                  {`${row.sendMiB.toFixed(1)} MiB · ${row.wireSerializationUs} µs`}
                </text>
              </g>
            );
          })}
        </svg>

        <section className="wiki-edu-w4a-mobile" aria-label="移动端物理域与四类通信耗散对照">
          <div
            className="wiki-edu-w4a-mcard"
            style={{
              background: state.domain === "hccs" ? "var(--color-token-soft)" : "var(--color-surface)",
              borderColor: state.domain === "hccs" ? "var(--color-token)" : "var(--color-line)",
            }}
          >
            <div className="wiki-edu-w4a-mhead">
              <span>机内直连 · 392 GB/s</span>
              <span>锁机内 TP/SP</span>
            </div>
            <div className="wiki-edu-w4a-mbar-track">
              <div
                className="wiki-edu-w4a-mbar-fill"
                style={{ width: "100%", background: "var(--color-token)" }}
              />
            </div>
          </div>
          <div
            className="wiki-edu-w4a-mcard"
            style={{
              background: state.domain === "roce" ? "var(--color-accent-soft)" : "var(--color-comm-soft)",
              borderColor: state.domain === "roce" ? "var(--color-danger)" : "var(--color-comm)",
            }}
          >
            <div className="wiki-edu-w4a-mhead">
              <span>跨机网口 · 25 GB/s</span>
              <span>{`${state.exactRatio}× 悬崖`}</span>
            </div>
            <div className="wiki-edu-w4a-mbar-track">
              <div
                className="wiki-edu-w4a-mbar-fill"
                style={{ width: "7%", background: "var(--color-danger)" }}
              />
            </div>
          </div>
          {state.rows.map((row) => {
            const pct = Number(
              Math.min(100, Math.max(0, (row.wireSerializationUs / state.maxRefUs) * 100)).toFixed(2),
            );
            return (
              <div
                key={row.id}
                className="wiki-edu-w4a-mcard"
                style={{ background: row.fillColor, borderColor: row.strokeColor }}
              >
                <div className="wiki-edu-w4a-mhead">
                  <span>{row.shortTitle}</span>
                  <span>{`${row.sendMiB.toFixed(1)} MiB · ${row.wireSerializationUs} µs`}</span>
                </div>
                <div className="wiki-edu-w4a-mbar-track">
                  <div
                    className="wiki-edu-w4a-mbar-fill"
                    style={{ width: `${pct}%`, background: row.strokeColor }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        <details className="wiki-edu-param-drawer" data-testid="coll-param-drawer">
          <summary>{`组卡数与并行规模设置（当前 N=${state.groupSize}）`}</summary>
          <div className="wiki-edu-param-drawer-body">
            <fieldset className="wiki-edu-btn-row" aria-label="通信组卡数 N">
              <span className="wiki-edu-param-label">通信组规模</span>
              {COLL_COMM_GROUP_SIZES.map((n) => {
                const active = mode === "sandbox" && groupSize === n;
                return (
                  <button
                    key={n}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`coll-n-${n}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "dark")}
                    onClick={() => selectGroupSize(n)}
                  >
                    {`N=${n}`}
                  </button>
                );
              })}
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="coll-preset-cross-tp16"
                aria-pressed={isCrossTp16Active}
                style={tokenBtnStyle(isCrossTp16Active, "dark")}
                onClick={applyDangerCrossTp16}
              >
                跨机 16 卡
              </button>
            </fieldset>
            <span style={{ fontSize: "12px", color: "var(--color-ink-muted)" }}>
              单机最多 8 卡；选 N=16 自动联动切至跨机网口。
            </span>
          </div>
        </details>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">
            <strong>频次与载荷总账</strong>：TP 每层 <strong>2 次</strong>阻塞归约（单层发{" "}
            <strong>{`${state.tpPerLayerTwoCallsMiB.toFixed(1)} MiB`}</strong>），SP 两半合计仍发{" "}
            <strong>{`${state.spSendMiB.toFixed(1)} MiB`}</strong>；PP 仅在段边界交接{" "}
            <strong>{`1 次 ${state.ppSendMiB} MiB`}</strong>，DP 状态同步 <strong>8×DP B</strong>（不含 MoE
            跨组通信）。
          </div>
          <div className="wiki-edu-note-card">
            {state.isCrossNodeTpCliff ? (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="coll-apply-safe-prescription"
                style={tokenBtnStyle(false)}
                onClick={applySafePrescription}
              >
                🔧 锁机内 TP=8 + 跨机 PP=2 或 DP=2
              </button>
            ) : (
              <>
                <strong>分级部署铁律</strong>：当前处于{" "}
                <strong>{state.domain === "hccs" ? "机内高速直连域" : "跨机网口域"}</strong>
                ，高频逐层同步锁在机内，低频段间交接走跨机网络。
              </>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
