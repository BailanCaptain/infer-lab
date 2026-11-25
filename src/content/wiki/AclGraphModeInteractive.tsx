import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";

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
    readonly decodePath: BatchExecPath;
    readonly mixedPath: BatchExecPath;
    readonly demandGiB: number;
    readonly note: string;
  }
> = {
  NONE: {
    label: "NONE (Eager)",
    decodePath: "HOST_EAGER",
    mixedPath: "HOST_EAGER",
    demandGiB: 0,
    note: "完全关闭图捕获（--enforce-eager）：零录图显存占用，但每步数百算子由 Host 逐个下发，小批 Decode 暴露严重下发空泡。",
  },
  PIECEWISE: {
    label: "PIECEWISE",
    decodePath: "PIECEWISE_REPLAY",
    mixedPath: "PIECEWISE_REPLAY",
    demandGiB: 3.4,
    note: "仅录分段子图：线性/MoE 段成组回放，注意力切口回 Host eager（兼容主机 tiling 与动态打断），教学示意录图峰值约 3.40 GiB（非实测）。",
  },
  FULL_DECODE_ONLY: {
    label: "FULL_DECODE_ONLY",
    decodePath: "FULL_REPLAY",
    mixedPath: "HOST_EAGER",
    demandGiB: 4.2,
    note: "仅纯 Decode 步录整图（可叠 npugraph_ex），混合/Prefill 步退回 Eager；省去分段图副本，教学示意录图峰值约 4.20 GiB（非实测）。",
  },
  FULL_AND_PIECEWISE: {
    label: "FULL_AND_PIECEWISE",
    decodePath: "FULL_REPLAY",
    mixedPath: "PIECEWISE_REPLAY",
    demandGiB: 6.15,
    note: "v0.30.0 默认 O2 档：同时捕获分段图与 Decode 整图。示意 8B 模型预算：非 KV 10.7 GiB · O2 双池录图峰值 6.15 GiB，非实测；910B3 真机 0.6B 实测值见正文（u=0.90 剩 1.71 GiB 时因 FIA 1.98 GiB 峰值触发 OOM，u=0.82 占 3.90 GiB 通过）。",
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
  return {
    meta,
    utilization,
    budgetGiB,
    kvPoolGiB,
    headroomGiB,
    captureDemandGiB,
    marginGiB,
    isCaptureOom,
  };
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
    const candidateU = uPct / 100;
    const probe = computeAclGraphBudgetMetrics(captureMode, candidateU);
    if (!probe.isCaptureOom) {
      maxSafeUtilization = probe.utilization;
      break;
    }
  }

  const safeAlternativeModes = REMEDIATION_MODE_PRIORITY.filter((candidateMode) => {
    if (candidateMode === captureMode) return false;
    return !computeAclGraphBudgetMetrics(candidateMode, current.utilization).isCaptureOom;
  });

  const bestAltMode = safeAlternativeModes[0];
  let summaryText: string;
  if (maxSafeUtilization !== null && bestAltMode !== undefined) {
    const altDemand = MODE_META[bestAltMode].demandGiB;
    summaryText = `处方：u ≤ ${maxSafeUtilization.toFixed(2)}，或切 ${bestAltMode}（需 ${altDemand.toFixed(2)}G）`;
  } else if (maxSafeUtilization !== null) {
    summaryText = `处方：将 u 调低至 ≤ ${maxSafeUtilization.toFixed(2)}（余量 ≥ ${current.captureDemandGiB.toFixed(2)}G）`;
  } else if (bestAltMode !== undefined) {
    const altDemand = MODE_META[bestAltMode].demandGiB;
    summaryText = `处方：当前 u 下改用 ${bestAltMode}（需 ${altDemand.toFixed(2)}G）`;
  } else {
    summaryText = "处方：当前 u 下各图模式余量均不足，请调低 u 至 0.82 并切 NONE";
  }

  return {
    maxSafeUtilization,
    safeAlternativeModes,
    summaryText,
  };
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

function renderExecutionLane(yTop: number, title: string, pathKind: BatchExecPath) {
  const badge =
    pathKind === "FULL_REPLAY"
      ? { text: "整图回放 · 0 空泡", fill: "#ddf4ef", stroke: "#087f73", ink: "#087f73" }
      : pathKind === "PIECEWISE_REPLAY"
        ? { text: "分段回放 · 切口 Eager", fill: "#e8edff", stroke: "#4c65b6", ink: "#4c65b6" }
        : { text: "逐算子 Eager · 露空泡", fill: "#fff0e9", stroke: "#b54237", ink: "#b54237" };

  return (
    <g>
      <rect
        x="18"
        y={yTop}
        width="450"
        height="136"
        rx="10"
        fill="#fbfaf6"
        stroke="#d8d8cf"
        strokeWidth="1.4"
      />
      <text x="32" y={yTop + 26} fontSize="13.5" fontWeight="700" fill="#17211f">
        {title}
      </text>
      <rect
        x="294"
        y={yTop + 10}
        width="160"
        height="24"
        rx="12"
        fill={badge.fill}
        stroke={badge.stroke}
        strokeWidth="1.2"
      />
      <text x="374" y={yTop + 26} textAnchor="middle" fontSize="12" fontWeight="700" fill={badge.ink}>
        {badge.text}
      </text>

      {/* Host Track */}
      <text x="32" y={yTop + 58} fontSize="12" fontWeight="700" fill="#66716d">
        Host
      </text>
      {pathKind === "FULL_REPLAY" ? (
        <>
          <rect x="76" y={yTop + 42} width="96" height="22" rx="4" fill="#087f73" />
          <text x="124" y={yTop + 57} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
            1 次整串提交
          </text>
          <text x="184" y={yTop + 57} fontSize="12" fill="#66716d">
            侧流 Event 更新 seq_lens，Host 提前解放
          </text>
        </>
      ) : pathKind === "PIECEWISE_REPLAY" ? (
        <>
          <rect x="76" y={yTop + 42} width="84" height="22" rx="4" fill="#4c65b6" />
          <text x="118" y={yTop + 57} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
            子图 1 提交
          </text>
          <rect
            x="174"
            y={yTop + 42}
            width="92"
            height="22"
            rx="4"
            fill="#fff4cf"
            stroke="#c78300"
            strokeWidth="1.2"
          />
          <text x="220" y={yTop + 57} textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
            切口 Tiling
          </text>
          <rect x="280" y={yTop + 42} width="84" height="22" rx="4" fill="#4c65b6" />
          <text x="322" y={yTop + 57} textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
            子图 2 提交
          </text>
        </>
      ) : (
        <>
          {[0, 1, 2, 3].map((idx) => (
            <rect
              key={idx}
              x={76 + idx * 94}
              y={yTop + 42}
              width="64"
              height="22"
              rx="4"
              fill="#ece9df"
              stroke="#66716d"
              strokeWidth="1.2"
            />
          ))}
          {[0, 1, 2, 3].map((idx) => (
            <text
              key={idx}
              x={108 + idx * 94}
              y={yTop + 57}
              textAnchor="middle"
              fontSize="12"
              fontFamily="var(--font-mono)"
              fill="#17211f"
            >
              {`下发#${idx + 1}`}
            </text>
          ))}
        </>
      )}

      {/* NPU Track */}
      <text x="32" y={yTop + 100} fontSize="12" fontWeight="700" fill="#17211f">
        NPU
      </text>
      {pathKind === "FULL_REPLAY" ? (
        <>
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <rect
              key={idx}
              x={76 + idx * 54}
              y={yTop + 80}
              width="52"
              height="30"
              rx="4"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.4"
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <text
              key={idx}
              x={102 + idx * 54}
              y={yTop + 99}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill="#087f73"
            >
              {`Op${idx + 1}`}
            </text>
          ))}
        </>
      ) : pathKind === "PIECEWISE_REPLAY" ? (
        <>
          <rect
            x="76"
            y={yTop + 80}
            width="114"
            height="30"
            rx="4"
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.4"
          />
          <text x="133" y={yTop + 99} textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
            线性/RMS 子图
          </text>
          <rect
            x="200"
            y={yTop + 80}
            width="96"
            height="30"
            rx="4"
            fill="#fff4cf"
            stroke="#c78300"
            strokeWidth="1.4"
          />
          <text x="248" y={yTop + 99} textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
            Attn (Eager)
          </text>
          <rect
            x="306"
            y={yTop + 80}
            width="134"
            height="30"
            rx="4"
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.4"
          />
          <text x="373" y={yTop + 99} textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
            FFN/MoE 子图
          </text>
        </>
      ) : (
        [0, 1, 2, 3].map((idx) => (
          <g key={idx}>
            <rect
              x={88 + idx * 94}
              y={yTop + 80}
              width="46"
              height="30"
              rx="4"
              fill="#fff4cf"
              stroke="#c78300"
              strokeWidth="1.3"
            />
            <text
              x={111 + idx * 94}
              y={yTop + 99}
              textAnchor="middle"
              fontSize="12"
              fontFamily="var(--font-mono)"
              fill="#17211f"
            >
              {`Op${idx + 1}`}
            </text>
            {idx < 3 && (
              <>
                <rect
                  x={136 + idx * 94}
                  y={yTop + 80}
                  width="44"
                  height="30"
                  rx="4"
                  fill="#fff0e9"
                  stroke="#b54237"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                <text
                  x={158 + idx * 94}
                  y={yTop + 99}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#b54237"
                >
                  空泡
                </text>
              </>
            )}
          </g>
        ))
      )}
    </g>
  );
}

function ctrlBtnStyle(pressed: boolean) {
  return pressed
    ? { background: "#17211f", borderColor: "#17211f", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
}

function stepBtnStyle(active: boolean) {
  return active
    ? { background: "#087f73", borderColor: "#087f73", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
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
  initialMode = "svg",
  initialCaptureMode = "FULL_AND_PIECEWISE",
  initialUtilization = 0.85,
}: AclGraphModeInteractiveProps) {
  const [mode, setMode] = useState<AclDiagramMode>(initialMode);
  const [captureMode, setCaptureMode] = useState<AclCaptureMode>(initialCaptureMode);
  const [utilization, setUtilization] = useState<number>(initialUtilization);
  const sliderId = useId();
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
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

  // 右侧 60.96 GiB 垂直柱（总高 228px）与 (1-u) 12 GiB 放大水位计
  const tankTop = 76;
  const tankH = 228;
  const headroomPx = Math.max(14, Math.round((1 - state.utilization) * tankH));
  const nonKvPx = Math.round((NON_KV_FIXED_GIB / ASCEND_910B3_VISIBLE_GIB) * tankH);
  const kvPx = Math.max(20, tankH - headroomPx - nonKvPx);

  const gaugeMaxGiB = 12;
  const headroomGaugePx = Math.min(tankH, Math.round((state.headroomGiB / gaugeMaxGiB) * tankH));
  const demandGaugePx = Math.min(tankH, Math.round((state.captureDemandGiB / gaugeMaxGiB) * tankH));
  const headroomLineY = tankTop + tankH - headroomGaugePx;
  const headroomLabelY = Math.max(92, headroomLineY - 8);
  const isSafePreset = mode === "sandbox" && Math.abs(state.utilization - 0.82) < 0.005;
  const isOomPreset = mode === "sandbox" && Math.abs(state.utilization - 0.92) < 0.005;

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-diagram-id={id}
      data-mode={mode}
      data-capture-mode={captureMode}
      data-oom={state.isCaptureOom ? "true" : "false"}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="ACL Graph 捕获模式与显存利用率沙盘控制"
        onKeyDown={handleKeyDown}
      >
        <fieldset className="wiki-diagram-mode-switch" aria-label="视图模式">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-svg"
            aria-pressed={mode === "svg"}
            style={ctrlBtnStyle(mode === "svg")}
            onClick={() => setMode("svg")}
          >
            还原原版静态图
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-sandbox"
            aria-pressed={mode === "sandbox"}
            style={ctrlBtnStyle(mode === "sandbox")}
            onClick={() => setMode("sandbox")}
          >
            切换交互沙盘 · 亲手试一试
          </button>
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="捕获模式切换">
          {ACL_CAPTURE_MODES.map((m) => {
            const active = mode === "sandbox" && captureMode === m;
            return (
              <button
                key={m}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`acl-mode-${m}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                style={stepBtnStyle(active)}
                onClick={() => selectCaptureMode(m)}
              >
                {MODE_META[m].label}
              </button>
            );
          })}
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="显存利用率 u 调节">
          <label
            htmlFor={sliderId}
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#17211f",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
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
              style={{ width: "92px", accentColor: "var(--color-accent)", cursor: "pointer" }}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => selectUtilization(Number(e.target.value) / 100)}
            />
          </label>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="acl-u-safe"
            aria-pressed={isSafePreset}
            style={ctrlBtnStyle(isSafePreset)}
            onClick={() => selectUtilization(0.82)}
          >
            u=0.82 稳妥
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="acl-u-oom"
            aria-pressed={isOomPreset}
            style={ctrlBtnStyle(isOomPreset)}
            onClick={() => selectUtilization(0.92)}
          >
            u=0.92 触发示意 OOM
          </button>
        </fieldset>
      </div>

      <div className="wiki-diagram-canvas">
        {mode === "svg" ? (
          <div
            key="svg"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
            dangerouslySetInnerHTML={html}
          />
        ) : (
          <div
            key="sandbox"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
          >
            <svg
              viewBox="0 0 880 404"
              width="880"
              height="404"
              role="img"
              aria-label={`ACL Graph 沙盘：模式 ${state.modeLabel}，u=${state.utilization.toFixed(2)}，${state.isCaptureOom ? "触发录图期 OOM" : "录图余量正常"}`}
              fontFamily="var(--font-sans)"
            >
              <title>{`ACL Graph ${state.modeLabel} · u=${state.utilization.toFixed(2)}`}</title>

              {/* Left Side: Decode vs Mixed Execution Lanes */}
              <text x="18" y="26" fontSize="14.5" fontWeight="700" fill="#17211f">
                ① 批次执行路径（纯 Decode 步 vs 混合 / Chunked Prefill 步）
              </text>
              {renderExecutionLane(40, "整齐纯 Decode 步（小批计算薄）", state.decodePath)}
              {renderExecutionLane(190, "混合 / Chunked Prefill 步（变长查询）", state.mixedPath)}
              <rect
                x="18"
                y="340"
                width="450"
                height="48"
                rx="8"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeWidth="1.2"
              />
              <text x="32" y="361" fontSize="12.5" fontWeight="700" fill="#17211f">
                {`当前档位：${state.modeLabel}`}
              </text>
              <text x="32" y="379" fontSize="12" fill="#66716d">
                {state.decodePath === "HOST_EAGER"
                  ? "无图可放：小批算子间出现 Host 下发空泡，TPOT 显著上升"
                  : state.mixedPath === "HOST_EAGER"
                    ? "纯 Decode 享整图零空泡；混合步回退 Eager，省去分段图显存"
                    : "Decode 与混合步均受图覆盖，但双份多档图池对 (1−u) 余量要求最高"}
              </text>

              {/* Right Side: Pedagogical Illustrative 8B Budget on 60.96 GiB Visible HBM */}
              <text x="486" y="26" fontSize="13.5" fontWeight="700" fill="#17211f">
                ② 示意 8B 预算（可见 60.96G · 非实测，0.6B 实测见正文）
              </text>
              <rect
                x="486"
                y="40"
                width="376"
                height="286"
                rx="10"
                fill="#fbfaf6"
                stroke={state.isCaptureOom ? "#b54237" : "#d8d8cf"}
                strokeWidth={state.isCaptureOom ? "2" : "1.4"}
              />

              {/* Column A: Full 60.96 GiB HBM Tank */}
              <text x="581" y="64" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
                全卡 60.96 GiB 切分
              </text>
              <rect
                x="508"
                y={tankTop}
                width="146"
                height={headroomPx}
                rx="4"
                fill={state.isCaptureOom ? "#fff0e9" : "#ddf4ef"}
                stroke={state.isCaptureOom ? "#b54237" : "#087f73"}
                strokeWidth="1.4"
                strokeDasharray="4 2"
              />
              <text
                x="581"
                y={tankTop + Math.max(13, Math.round(headroomPx / 2) + 4)}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={state.isCaptureOom ? "#b54237" : "#087f73"}
              >
                {`(1−u) ${state.headroomGiB.toFixed(2)}G`}
              </text>

              <rect
                x="508"
                y={tankTop + headroomPx}
                width="146"
                height={kvPx}
                fill="#e8edff"
                stroke="#4c65b6"
                strokeWidth="1.4"
              />
              <text
                x="581"
                y={tankTop + headroomPx + Math.round(kvPx / 2) - 4}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="700"
                fill="#4c65b6"
              >
                物理 KV 块池
              </text>
              <text
                x="581"
                y={tankTop + headroomPx + Math.round(kvPx / 2) + 14}
                textAnchor="middle"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fill="#17211f"
              >
                {`${state.kvPoolGiB.toFixed(2)} GiB`}
              </text>

              <rect
                x="508"
                y={tankTop + headroomPx + kvPx}
                width="146"
                height={nonKvPx}
                rx="4"
                fill="#fff4cf"
                stroke="#c78300"
                strokeWidth="1.3"
              />
              <text
                x="581"
                y={tankTop + headroomPx + kvPx + Math.round(nonKvPx / 2) + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#c78300"
              >
                {`示意非 KV ${NON_KV_FIXED_GIB.toFixed(1)}G`}
              </text>

              <line
                x1="502"
                y1={tankTop + headroomPx}
                x2="660"
                y2={tankTop + headroomPx}
                stroke="#17211f"
                strokeWidth="2"
              />

              {/* Column B: (1-u) Capture Headroom Zoomed Gauge (0..12 GiB) */}
              <text x="762" y="64" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
                录图峰值 vs (1−u) 余量
              </text>
              <rect
                x="684"
                y={tankTop}
                width="156"
                height={tankH}
                rx="6"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeWidth="1.2"
              />
              {demandGaugePx > 0 && (
                <rect
                  x="696"
                  y={tankTop + tankH - demandGaugePx}
                  width="132"
                  height={demandGaugePx}
                  rx="5"
                  fill={state.isCaptureOom ? "#b54237" : "#087f73"}
                />
              )}
              <line
                x1="680"
                y1={headroomLineY}
                x2="844"
                y2={headroomLineY}
                stroke="#fbfaf6"
                strokeWidth="4.4"
              />
              <line
                x1="680"
                y1={headroomLineY}
                x2="844"
                y2={headroomLineY}
                stroke="#17211f"
                strokeWidth="2.2"
                strokeDasharray="6 3"
              />
              <rect
                x="702"
                y={headroomLabelY - 13}
                width="120"
                height="18"
                rx="4"
                fill="#fbfaf6"
                stroke="#17211f"
                strokeWidth="1.1"
              />
              <text
                x="762"
                y={headroomLabelY}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                paintOrder="stroke"
                stroke="#fbfaf6"
                strokeWidth="4"
                strokeLinejoin="round"
                fill="#17211f"
              >
                {`余量上限 ${state.headroomGiB.toFixed(2)}G`}
              </text>
              <text
                x="762"
                y="320"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={state.isCaptureOom ? "#b54237" : "#17211f"}
              >
                {`示意录图需 ${state.captureDemandGiB.toFixed(2)} GiB`}
              </text>

              {/* Bottom OOM / Healthy Banner */}
              <rect
                x="486"
                y="340"
                width="376"
                height="48"
                rx="8"
                fill={state.isCaptureOom ? "#fff0e9" : "#ddf4ef"}
                stroke={state.isCaptureOom ? "#b54237" : "#087f73"}
                strokeWidth="1.6"
              />
              <text
                x="500"
                y="361"
                fontSize="12.5"
                fontWeight="700"
                fill={state.isCaptureOom ? "#b54237" : "#087f73"}
              >
                {state.isCaptureOom
                  ? `示意录图期 OOM 预警！需 ${state.captureDemandGiB.toFixed(2)}G > (1−u) 余 ${state.headroomGiB.toFixed(2)}G`
                  : `示意录图通过：(1−u) 余 ${state.headroomGiB.toFixed(2)}G ≥ 需 ${state.captureDemandGiB.toFixed(2)}G`}
              </text>
              <text x="500" y="379" fontSize="12" fill="#17211f">
                {state.remediation.summaryText}
              </text>
            </svg>
          </div>
        )}
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {mode === "sandbox" ? (
          <>
            <span className="wiki-diagram-step-tag">
              {state.isCaptureOom ? "示意录图 OOM 预警" : state.modeLabel}
            </span>
            <strong className="wiki-diagram-step-title">
              {`u = ${state.utilization.toFixed(2)}（示意 8B 预算：非 KV 10.7 GiB · KV 池 ${state.kvPoolGiB.toFixed(2)} GiB | 1−u 余量 ${state.headroomGiB.toFixed(2)} GiB vs 示意录图需 ${state.captureDemandGiB.toFixed(2)} GiB，非实测）`}
            </strong>
            <span className="wiki-diagram-step-detail">
              {state.isCaptureOom ? `${state.remediation.summaryText}。${state.note}` : state.note}
            </span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            当前展示审定原图；点击上方「切换交互沙盘 · 亲手试一试」、切换四档模式或调节显存利用率 u（示意 8B
            模型预算：非 KV 10.7 GiB · O2 双池录图峰值 6.15 GiB，非实测；910B3 真机 0.6B 实测值见正文；可点
            「u=0.92 触发示意 OOM」推演录图水位越界）。
          </span>
        )}
      </output>
    </div>
  );
}
