import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const ACL_CAPTURE_MODES = ["NONE", "PIECEWISE", "FULL_DECODE_ONLY", "FULL_AND_PIECEWISE"] as const;

export type AclCaptureMode = (typeof ACL_CAPTURE_MODES)[number];
export type AclDiagramMode = "svg" | "sandbox";
export type BatchExecPath = "FULL_REPLAY" | "PIECEWISE_REPLAY" | "HOST_EAGER";

export const ASCEND_910B3_VISIBLE_GIB = 60.96;
const NON_KV_FIXED_GIB = 10.7;

export interface AclGraphRemediation {
  readonly maxSafeUtilization: number | null;
  readonly safeAlternativeModes: readonly AclCaptureMode[];
  readonly summaryText: string;
}

export interface AclGraphSandboxState {
  readonly captureMode: AclCaptureMode;
  readonly modeLabel: string;
  readonly shortBtn: string;
  readonly speedBadge: string;
  readonly speedTone: "is-good" | "is-mid" | "is-bad";
  readonly speedSummary: string;
  readonly utilization: number;
  readonly decodePath: BatchExecPath;
  readonly mixedPath: BatchExecPath;
  readonly budgetGiB: number;
  readonly kvPoolGiB: number;
  readonly headroomGiB: number;
  readonly captureDemandGiB: number;
  readonly isCaptureOom: boolean;
  readonly marginGiB: number;
  readonly note: string;
  readonly remediation: AclGraphRemediation;
}

const MODE_META: Record<
  AclCaptureMode,
  {
    readonly label: string;
    readonly shortBtn: string;
    readonly speedBadge: string;
    readonly speedTone: "is-good" | "is-mid" | "is-bad";
    readonly speedSummary: string;
    readonly decodePath: BatchExecPath;
    readonly mixedPath: BatchExecPath;
    readonly demandGiB: number;
    readonly note: string;
  }
> = {
  NONE: {
    label: "NONE (Eager)",
    shortBtn: "关闭录图 (Eager)",
    speedBadge: "逐个下发 · 露空泡",
    speedTone: "is-bad",
    speedSummary: "不录图：0 录图显存，但 CPU 每步逐个发算子，NPU 算完一个干等下一个（红框空泡）。",
    decodePath: "HOST_EAGER",
    mixedPath: "HOST_EAGER",
    demandGiB: 0,
    note: "完全关闭图捕获（--enforce-eager）：零录图显存占用（示意 8B 模型，非实测），小批 Decode 暴露 Host 下发空泡。",
  },
  PIECEWISE: {
    label: "PIECEWISE",
    shortBtn: "分段录图",
    speedBadge: "分段打包 · 切口小停顿",
    speedTone: "is-mid",
    speedSummary: "分段录图：把注意力前后的算子各打成一个包，中间留 1 个小切口回 CPU，兼顾灵活与速度。",
    decodePath: "PIECEWISE_REPLAY",
    mixedPath: "PIECEWISE_REPLAY",
    demandGiB: 3.4,
    note: "仅录分段子图：线性/MoE 段成组回放，注意力切口回 Host eager，示意 8B 模型录图峰值约 3.40 GiB（非实测）。",
  },
  FULL_DECODE_ONLY: {
    label: "FULL_DECODE_ONLY",
    shortBtn: "仅 Decode 整图",
    speedBadge: "Decode 整图 · 0 空泡",
    speedTone: "is-good",
    speedSummary: "仅 Decode 整图：最耗时的逐字生成步“一键整串回放”（0 空泡），还省下了分段图显存！",
    decodePath: "FULL_REPLAY",
    mixedPath: "HOST_EAGER",
    demandGiB: 4.2,
    note: "仅纯 Decode 步录整图（可叠 npugraph_ex），混合步退回 Eager，示意 8B 模型录图峰值约 4.20 GiB（非实测）。",
  },
  FULL_AND_PIECEWISE: {
    label: "FULL_AND_PIECEWISE",
    shortBtn: "全量+分段 (默认)",
    speedBadge: "全量双池 · 全程提速",
    speedTone: "is-good",
    speedSummary: "默认满血档：Decode 步整图 0 空泡 + 混合步分段加速，但要同时存两套图（需约 6.15 GiB）。",
    decodePath: "FULL_REPLAY",
    mixedPath: "PIECEWISE_REPLAY",
    demandGiB: 6.15,
    note: "v0.30.0 默认 O2 档：示意 8B 模型非 KV 10.7 GiB、双池录图峰值 6.15 GiB（非实测）；910B3 真机 0.6B 实测在 u=0.90 剩 1.71 GiB 时被 1.98 GiB 峰值打爆，调至 u=0.82 通过。",
  },
};

function computeAclGraphBudgetMetrics(captureMode: AclCaptureMode, rawUtilization: number) {
  const utilization = Math.min(0.95, Math.max(0.82, Math.round(rawUtilization * 100) / 100));
  const meta = MODE_META[captureMode];
  const budgetGiB = Number((ASCEND_910B3_VISIBLE_GIB * utilization).toFixed(2));
  const kvPoolGiB = Number(Math.max(0, budgetGiB - NON_KV_FIXED_GIB).toFixed(2));
  const headroomGiB = Number((ASCEND_910B3_VISIBLE_GIB - budgetGiB).toFixed(2));
  const captureDemandGiB = meta.demandGiB;
  const marginGiB = Number((headroomGiB - captureDemandGiB).toFixed(2));
  const isCaptureOom = captureDemandGiB > headroomGiB;
  return { meta, utilization, budgetGiB, kvPoolGiB, headroomGiB, captureDemandGiB, marginGiB, isCaptureOom };
}

const REMEDIATION_MODE_PRIORITY: readonly AclCaptureMode[] = [
  "FULL_AND_PIECEWISE",
  "FULL_DECODE_ONLY",
  "PIECEWISE",
  "NONE",
];

export function computeAclGraphRemediation(
  captureMode: AclCaptureMode,
  rawUtilization: number,
): AclGraphRemediation {
  const current = computeAclGraphBudgetMetrics(captureMode, rawUtilization);
  if (!current.isCaptureOom) {
    return {
      maxSafeUtilization: current.utilization,
      safeAlternativeModes: [],
      summaryText: `安全富余 +${current.marginGiB.toFixed(2)} GiB（先切光 u 内 KV 池，再从 1−u 录图）`,
    };
  }
  let maxSafeUtilization: number | null = null;
  for (let uPct = 95; uPct >= 82; uPct -= 1) {
    const probe = computeAclGraphBudgetMetrics(captureMode, uPct / 100);
    if (!probe.isCaptureOom) {
      maxSafeUtilization = probe.utilization;
      break;
    }
  }
  const safeAlternativeModes = REMEDIATION_MODE_PRIORITY.filter(
    (m) => m !== captureMode && !computeAclGraphBudgetMetrics(m, current.utilization).isCaptureOom,
  );
  const bestAltMode = safeAlternativeModes[0];
  let summaryText: string;
  if (maxSafeUtilization !== null && bestAltMode !== undefined) {
    summaryText = `处方：u ≤ ${maxSafeUtilization.toFixed(2)}，或切 ${bestAltMode}（需 ${MODE_META[bestAltMode].demandGiB.toFixed(2)}G）`;
  } else if (maxSafeUtilization !== null) {
    summaryText = `处方：将 u 调低至 ≤ ${maxSafeUtilization.toFixed(2)}（余量 ≥ ${current.captureDemandGiB.toFixed(2)}G）`;
  } else if (bestAltMode !== undefined) {
    summaryText = `处方：当前 u 下改用 ${bestAltMode}（需 ${MODE_META[bestAltMode].demandGiB.toFixed(2)}G）`;
  } else {
    summaryText = "处方：当前 u 下各图模式余量均不足，请调低 u 至 0.82 并切 NONE";
  }
  return { maxSafeUtilization, safeAlternativeModes, summaryText };
}

export function computeAclGraphSandboxState(
  captureMode: AclCaptureMode,
  rawUtilization: number,
): AclGraphSandboxState {
  const metrics = computeAclGraphBudgetMetrics(captureMode, rawUtilization);
  const remediation = computeAclGraphRemediation(captureMode, metrics.utilization);
  return {
    captureMode,
    modeLabel: metrics.meta.label,
    shortBtn: metrics.meta.shortBtn,
    speedBadge: metrics.meta.speedBadge,
    speedTone: metrics.meta.speedTone,
    speedSummary: metrics.meta.speedSummary,
    utilization: metrics.utilization,
    decodePath: metrics.meta.decodePath,
    mixedPath: metrics.meta.mixedPath,
    budgetGiB: metrics.budgetGiB,
    kvPoolGiB: metrics.kvPoolGiB,
    headroomGiB: metrics.headroomGiB,
    captureDemandGiB: metrics.captureDemandGiB,
    isCaptureOom: metrics.isCaptureOom,
    marginGiB: metrics.marginGiB,
    note: metrics.meta.note,
    remediation,
  };
}

function execPathShortLabel(kind: BatchExecPath): string {
  if (kind === "FULL_REPLAY") return "整图重放 · 0 空泡";
  if (kind === "PIECEWISE_REPLAY") return "分段重放 · 1 切口";
  return "Host 逐算子 · 露空泡";
}

function modeCanvasCaption(mode: AclCaptureMode): string {
  if (mode === "FULL_AND_PIECEWISE") return "双池齐备：纯解码整图 + 混批分段（共需 6.15 GiB）";
  if (mode === "FULL_DECODE_ONLY") return "仅录纯解码整图（需 4.20 GiB），混批退回逐算子";
  if (mode === "PIECEWISE") return "双轨共用分段子图（需 3.40 GiB），注意力回 Host";
  return "完全不录图（0.00 GiB），双轨均暴露下发空泡";
}

function renderSvgExecLane(kind: BatchExecPath, laneY: number, arrowId: string) {
  const textY = laneY + 25;
  const midY = laneY + 20;
  if (kind === "FULL_REPLAY") {
    return (
      <g>
        <rect
          x="26"
          y={laneY}
          width="404"
          height="40"
          rx="7"
          fill="#ddf4ef"
          stroke="#087f73"
          strokeWidth="1.5"
        />
        <text x="228" y={textY} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
          ⚡ 1 次整图连续重放：线性 → 注意力 → FFN（0 空泡）
        </text>
      </g>
    );
  }
  if (kind === "PIECEWISE_REPLAY") {
    return (
      <g>
        <rect
          x="26"
          y={laneY}
          width="132"
          height="40"
          rx="6"
          fill="#e8edff"
          stroke="#4c65b6"
          strokeWidth="1.4"
        />
        <text x="92" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
          子图1·线性
        </text>
        <line
          x1="160"
          y1={midY}
          x2="174"
          y2={midY}
          stroke="#4c65b6"
          strokeWidth="1.6"
          markerEnd={`url(#${arrowId})`}
        />
        <rect
          x="176"
          y={laneY}
          width="104"
          height="40"
          rx="6"
          fill="#fff4cf"
          stroke="#c78300"
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
        <text x="228" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
          注意力切口
        </text>
        <line
          x1="282"
          y1={midY}
          x2="296"
          y2={midY}
          stroke="#4c65b6"
          strokeWidth="1.6"
          markerEnd={`url(#${arrowId})`}
        />
        <rect
          x="298"
          y={laneY}
          width="132"
          height="40"
          rx="6"
          fill="#e8edff"
          stroke="#4c65b6"
          strokeWidth="1.4"
        />
        <text x="364" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
          子图2·FFN
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect
        x="26"
        y={laneY}
        width="76"
        height="40"
        rx="6"
        fill="#fff4cf"
        stroke="#c78300"
        strokeWidth="1.4"
      />
      <text x="64" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
        算子1
      </text>
      <rect
        x="108"
        y={laneY}
        width="74"
        height="40"
        rx="6"
        fill="#fff0e9"
        stroke="#b54237"
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />
      <text x="145" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
        空泡
      </text>
      <rect
        x="188"
        y={laneY}
        width="80"
        height="40"
        rx="6"
        fill="#fff4cf"
        stroke="#c78300"
        strokeWidth="1.4"
      />
      <text x="228" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
        算子2
      </text>
      <rect
        x="274"
        y={laneY}
        width="74"
        height="40"
        rx="6"
        fill="#fff0e9"
        stroke="#b54237"
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />
      <text x="311" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
        空泡
      </text>
      <rect
        x="354"
        y={laneY}
        width="76"
        height="40"
        rx="6"
        fill="#fff4cf"
        stroke="#c78300"
        strokeWidth="1.4"
      />
      <text x="392" y={textY} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
        算子3
      </text>
    </g>
  );
}

export interface AclGraphModeInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: AclDiagramMode | undefined;
  readonly initialCaptureMode?: AclCaptureMode | undefined;
  readonly initialUtilization?: number | undefined;
}

export function AclGraphModeInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialCaptureMode = "FULL_AND_PIECEWISE",
  initialUtilization = 0.85,
}: AclGraphModeInteractiveProps) {
  const [mode, setMode] = useState<AclDiagramMode>(initialMode);
  const [captureMode, setCaptureMode] = useState<AclCaptureMode>(initialCaptureMode);
  const [utilization, setUtilization] = useState<number>(initialUtilization);
  const sliderId = useId();
  const state = useMemo(
    () => computeAclGraphSandboxState(captureMode, utilization),
    [captureMode, utilization],
  );

  const selectCaptureMode = (next: AclCaptureMode) => {
    setMode("sandbox");
    setCaptureMode(next);
  };

  const selectUtilization = (next: number) => {
    setMode("sandbox");
    setUtilization(Math.min(0.95, Math.max(0.82, Math.round(next * 100) / 100)));
  };

  const applySafeRemediation = () => {
    setMode("sandbox");
    if (state.remediation.maxSafeUtilization !== null) {
      setUtilization(state.remediation.maxSafeUtilization);
    } else if (state.remediation.safeAlternativeModes[0]) {
      setCaptureMode(state.remediation.safeAlternativeModes[0]);
    } else {
      setCaptureMode("NONE");
      setUtilization(0.82);
    }
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
    const modeIdx = ACL_CAPTURE_MODES.indexOf(captureMode);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectCaptureMode(ACL_CAPTURE_MODES[Math.min(3, modeIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectCaptureMode(ACL_CAPTURE_MODES[Math.max(0, modeIdx - 1)]!);
        break;
    }
  };

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arrowId = `${id}-${uid}-acl-arrow`;
  const tankTop = 50;
  const tankH = 188;
  const pxPerGiB = tankH / ASCEND_910B3_VISIBLE_GIB;
  const headroomH = Number((state.headroomGiB * pxPerGiB).toFixed(1));
  const fixedH = Number((NON_KV_FIXED_GIB * pxPerGiB).toFixed(1));
  const kvH = Number(Math.max(0, tankH - headroomH - fixedH).toFixed(1));
  const budgetY = Number((tankTop + headroomH).toFixed(1));
  const fixedTopY = Number((tankTop + headroomH + kvH).toFixed(1));
  const demandH = Number((state.captureDemandGiB * pxPerGiB).toFixed(1));
  const demandEndY = Number((tankTop + demandH).toFixed(1));
  const isSafePreset = mode === "sandbox" && Math.abs(state.utilization - 0.82) < 0.005;
  const isOomPreset = mode === "sandbox" && Math.abs(state.utilization - 0.92) < 0.005;

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
      kickerTitle="ACLGraph 图捕获 × gpu_memory_utilization (u)"
      question={
        <>
          为什么把显存利用率 <span className="mono">u</span> 调高到 0.92，反而启动就 OOM？
        </>
      }
      toolbarLabel="ACLGraph 捕获模式与显存利用率沙盘控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-capture-mode": captureMode,
        "data-oom": state.isCaptureOom ? "true" : "false",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="捕获模式切换">
            {ACL_CAPTURE_MODES.map((m) => {
              const active = mode === "sandbox" && captureMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`acl-mode-${m}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => selectCaptureMode(m)}
                >
                  {MODE_META[m].shortBtn}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="显存利用率 u 调节">
            <label
              htmlFor={sliderId}
              className={`wiki-edu-slider-chip${state.isCaptureOom ? " is-oom" : ""}`}
            >
              <span className="mono">{`u = ${state.utilization.toFixed(2)}`}</span>
              <input
                id={sliderId}
                type="range"
                min={82}
                max={95}
                step={1}
                value={Math.round(state.utilization * 100)}
                data-testid="acl-utilization-slider"
                aria-valuetext={`gpu-memory-utilization ${state.utilization.toFixed(2)}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => selectUtilization(Number(e.target.value) / 100)}
              />
            </label>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="acl-u-safe"
              aria-pressed={isSafePreset}
              style={eduBtnStyle(isSafePreset, "teal")}
              onClick={() => selectUtilization(0.82)}
            >
              稳妥 0.82
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="acl-u-oom"
              aria-pressed={isOomPreset}
              style={eduBtnStyle(isOomPreset, "accent")}
              onClick={() => {
                if (captureMode === "NONE") setCaptureMode("FULL_AND_PIECEWISE");
                selectUtilization(0.92);
              }}
            >
              u=0.92 触发示意 OOM
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={state.isCaptureOom ? "示意录图期 OOM 预警" : "显存账本安全"}
      takeawayTone={state.isCaptureOom ? "danger" : "default"}
      takeaway={
        state.isCaptureOom ? (
          <>
            <strong>破案了</strong>：<span className="mono">{`u=${state.utilization.toFixed(2)}`}</span>{" "}
            把中间 KV 池撑得太大，顶上只剩 <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong> 留白，装不下{" "}
            <strong>{`${state.captureDemandGiB.toFixed(2)}G`}</strong> 录图数据！（
            {state.remediation.summaryText}）
          </>
        ) : (
          <>
            当前 <span className="mono">{`u=${state.utilization.toFixed(2)}`}</span> 给顶部留了{" "}
            <strong>{`${state.headroomGiB.toFixed(2)}G`}</strong> 留白，轻松装下{" "}
            <strong>{`${state.captureDemandGiB.toFixed(2)}G`}</strong> 录图开销，服务平稳启动。
          </>
        )
      }
      kpi={`录图 ${state.captureDemandGiB.toFixed(2)}G / 留白 ${state.headroomGiB.toFixed(2)}G`}
      detailsSummary="查看工程与源码细节（v0.30.0 O2 双池规则 / 910B3 0.6B 真机实测）"
      detailsContent={
        <>
          <strong>{state.modeLabel}</strong>：{state.note}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <svg
          viewBox="0 0 840 260"
          width="840"
          height="260"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`ACLGraph ${state.modeLabel} 双轨执行与显存水箱对照（u=${state.utilization.toFixed(2)}）`}
        >
          <defs>
            <marker
              id={arrowId}
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
            width="434"
            height="244"
            rx="10"
            fill="#fbfaf6"
            stroke="#d8d8cf"
            strokeWidth="1.4"
          />
          <text x="26" y="32" fontSize="13" fontWeight="700" fill="#17211f">
            ① 执行轨道：算子下发 vs 图重放
          </text>
          <text x="430" y="32" textAnchor="end" fontSize="12" fontWeight="700" fill="#087f73">
            {state.speedBadge}
          </text>

          <text x="26" y="62" fontSize="12" fontWeight="700" fill="#17211f">
            纯 Decode 步
          </text>
          <text x="430" y="62" textAnchor="end" fontSize="12" fill="#66716d">
            {execPathShortLabel(state.decodePath)}
          </text>
          {renderSvgExecLane(state.decodePath, 70, arrowId)}

          <text x="26" y="142" fontSize="12" fontWeight="700" fill="#17211f">
            混合 / Prefill 步
          </text>
          <text x="430" y="142" textAnchor="end" fontSize="12" fill="#66716d">
            {execPathShortLabel(state.mixedPath)}
          </text>
          {renderSvgExecLane(state.mixedPath, 150, arrowId)}

          <text x="26" y="232" fontSize="12" fill="#66716d">
            {modeCanvasCaption(state.captureMode)}
          </text>

          <rect
            x="456"
            y="8"
            width="374"
            height="244"
            rx="10"
            fill={state.isCaptureOom ? "#fff0e9" : "#fbfaf6"}
            stroke={state.isCaptureOom ? "#b54237" : "#d8d8cf"}
            strokeWidth="1.5"
          />
          <text x="472" y="32" fontSize="13" fontWeight="700" fill="#17211f">
            ② 64G 卡水箱与录图侧尺 (可见 60.96G)
          </text>

          <rect
            x="472"
            y={tankTop}
            width="120"
            height={headroomH}
            fill="#ffffff"
            stroke="#d8d8cf"
            strokeWidth="1.2"
          />
          <rect
            x="472"
            y={budgetY}
            width="120"
            height={kvH}
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.3"
          />
          <rect
            x="472"
            y={fixedTopY}
            width="120"
            height={fixedH}
            fill="#ece9df"
            stroke="#d8d8cf"
            strokeWidth="1.2"
          />
          <rect
            x="472"
            y={tankTop}
            width="120"
            height={tankH}
            rx="6"
            fill="none"
            stroke={state.isCaptureOom ? "#b54237" : "#66716d"}
            strokeWidth="1.6"
          />

          <text x="532" y="138" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            KV 缓存池
          </text>
          <text x="532" y="158" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
            {`${state.kvPoolGiB.toFixed(2)} GiB`}
          </text>
          <text x="532" y="227" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
            {`基础 ${NON_KV_FIXED_GIB}G`}
          </text>

          <rect
            x="608"
            y={tankTop}
            width="38"
            height={tankH}
            rx="5"
            fill="#ffffff"
            stroke="#d8d8cf"
            strokeWidth="1.2"
          />
          {demandH > 0 && (
            <rect
              x="608"
              y={tankTop}
              width="38"
              height={demandH}
              rx="4"
              fill={state.isCaptureOom ? "#b54237" : "#9a4b86"}
              stroke={state.isCaptureOom ? "#b54237" : "#9a4b86"}
            />
          )}
          <line
            x1="466"
            y1={budgetY}
            x2="654"
            y2={budgetY}
            stroke="#e85b32"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
          {demandH > 0 && (
            <line x1="604" y1={demandEndY} x2="652" y2={demandEndY} stroke="#17211f" strokeWidth="1.5" />
          )}

          <text x="662" y="68" fontSize="12" fontWeight="700" fill="#17211f">
            {`留白 1−u：${state.headroomGiB.toFixed(2)} GiB`}
          </text>
          <text x="662" y="108" fontSize="12" fontWeight="700" fill="#9a4b86">
            {`录图侧尺：${state.captureDemandGiB.toFixed(2)} GiB`}
          </text>
          <text
            x="662"
            y="148"
            fontSize="12"
            fontWeight="700"
            fill={state.isCaptureOom ? "#b54237" : "#087f73"}
          >
            {state.isCaptureOom
              ? `缺口 −${Math.abs(state.marginGiB).toFixed(2)} GiB`
              : `富余 +${state.marginGiB.toFixed(2)} GiB`}
          </text>
          <text x="662" y="188" fontSize="12" fill="#e85b32" fontWeight="700">
            {`预算 u=${state.utilization.toFixed(2)} (${state.budgetGiB.toFixed(2)}G)`}
          </text>
          <text x="662" y="228" fontSize="12" fill={state.isCaptureOom ? "#b54237" : "#66716d"}>
            {state.isCaptureOom ? "状态：侧尺刺破预算线!" : "状态：侧尺稳居留白内"}
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">{state.speedSummary}</div>
          <div className="wiki-edu-note-card">
            {state.isCaptureOom ? (
              <button
                type="button"
                className="wiki-edu-fix-btn"
                data-testid="acl-apply-remediation"
                style={{ background: "#b54237", borderColor: "#b54237", color: "#ffffff" }}
                onClick={applySafeRemediation}
              >
                {state.remediation.maxSafeUtilization !== null
                  ? `🔧 一键降到安全上限 u = ${state.remediation.maxSafeUtilization.toFixed(2)}`
                  : `🔧 ${state.remediation.summaryText}`}
              </button>
            ) : (
              <>
                <strong>同尺度结论</strong>：先切完{" "}
                <span className="mono">{`u=${state.utilization.toFixed(2)}`}</span> 内的 KV 池（
                <strong>{`${state.kvPoolGiB.toFixed(2)} GiB`}</strong>），顶部留白{" "}
                <strong>{`${state.headroomGiB.toFixed(2)} GiB`}</strong> 充足容纳{" "}
                <strong>{`${state.captureDemandGiB.toFixed(2)} GiB`}</strong> 录图开销。
              </>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
