import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { type KeyboardEvent, type Ref, useId, useMemo, useState } from "react";

export interface InteractiveDiagramProps {
  readonly id: string;
  readonly safeSvg: string;
  readonly caption: string;
  readonly scrollRef: Ref<HTMLDivElement>;
  readonly scrollable: boolean;
  readonly onScroll: () => void;
}

export type QuantActPresetId = "standard" | "outlier" | "balanced";
export type QuantWeightColIdx = 0 | 1 | 2;

export const QUANT_ACT_PRESETS: readonly {
  readonly id: QuantActPresetId;
  readonly label: string;
  readonly x: readonly [number, number];
}[] = [
  { id: "standard", label: "标准例 x=[1, 2]", x: [1, 2] },
  { id: "outlier", label: "离群激活 x=[0.1, 32]", x: [0.1, 32] },
  { id: "balanced", label: "双极激活 x=[-1.5, 1]", x: [-1.5, 1] },
];

export const QUANT_WEIGHT_COLS: readonly {
  readonly idx: QuantWeightColIdx;
  readonly label: string;
  readonly w: readonly [number, number];
}[] = [
  { idx: 0, label: "列1 w=[1, -2]", w: [1, -2] },
  { idx: 1, label: "列2 w=[1.5, 0.5]", w: [1.5, 0.5] },
  { idx: 2, label: "列3 w=[0.2, -4]", w: [0.2, -4] },
];

export function roundHalfToEven(val: number): number {
  const floor = Math.floor(val);
  const diff = val - floor;
  if (Math.abs(diff - 0.5) <= 1e-12) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(val);
}

function quantizeSymInt8Pair(vec: readonly [number, number]) {
  const maxAbs = Math.max(Math.abs(vec[0]), Math.abs(vec[1]));
  const scale = maxAbs === 0 ? 1 : maxAbs / 127;
  const q0 = maxAbs === 0 ? 0 : Math.max(-128, Math.min(127, roundHalfToEven(vec[0] / scale)));
  const q1 = maxAbs === 0 ? 0 : Math.max(-128, Math.min(127, roundHalfToEven(vec[1] / scale)));
  return { maxAbs, scale, scaleFrac: `${maxAbs}/127`, q: [q0, q1] as const };
}

export interface QuantInt8ChainState {
  readonly actPresetId: QuantActPresetId;
  readonly weightColIdx: QuantWeightColIdx;
  readonly x: readonly [number, number];
  readonly w: readonly [number, number];
  readonly scaleX: number;
  readonly scaleXFrac: string;
  readonly scaleW: number;
  readonly scaleWFrac: string;
  readonly qx: readonly [number, number];
  readonly qw: readonly [number, number];
  readonly allColsQw: readonly (readonly [number, number])[];
  readonly prod0: number;
  readonly prod1: number;
  readonly accInt32: number;
  readonly dequant: number;
  readonly fpExact: number;
  readonly quantError: number;
  readonly hasUnderflowZero: boolean;
}

export function computeQuantInt8Chain(
  actPresetId: QuantActPresetId,
  weightColIdx: QuantWeightColIdx,
): QuantInt8ChainState {
  const actSpec = QUANT_ACT_PRESETS.find((p) => p.id === actPresetId) ?? QUANT_ACT_PRESETS[0]!;
  const colSpec = QUANT_WEIGHT_COLS[weightColIdx] ?? QUANT_WEIGHT_COLS[0]!;
  const qAct = quantizeSymInt8Pair(actSpec.x);
  const qCol = quantizeSymInt8Pair(colSpec.w);
  const allColsQw = QUANT_WEIGHT_COLS.map((c) => quantizeSymInt8Pair(c.w).q);
  const prod0 = qAct.q[0] * qCol.q[0];
  const prod1 = qAct.q[1] * qCol.q[1];
  const accInt32 = prod0 + prod1;
  const dequant = Number((accInt32 * qAct.scale * qCol.scale).toFixed(6));
  const fpExact = Number((actSpec.x[0] * colSpec.w[0] + actSpec.x[1] * colSpec.w[1]).toFixed(6));
  const quantError = Number((dequant - fpExact).toFixed(6));
  const hasUnderflowZero = (actSpec.x[0] !== 0 && qAct.q[0] === 0) || (actSpec.x[1] !== 0 && qAct.q[1] === 0);
  return {
    actPresetId: actSpec.id,
    weightColIdx: colSpec.idx,
    x: actSpec.x,
    w: colSpec.w,
    scaleX: qAct.scale,
    scaleXFrac: qAct.scaleFrac,
    scaleW: qCol.scale,
    scaleWFrac: qCol.scaleFrac,
    qx: qAct.q,
    qw: qCol.q,
    allColsQw,
    prod0,
    prod1,
    accInt32,
    dequant,
    fpExact,
    quantError,
    hasUnderflowZero,
  };
}

type StepNumber = 1 | 2 | 3 | 4;
type DiagramStep = 0 | StepNumber;

interface FocusRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
}

interface StepSpec {
  readonly step: StepNumber;
  readonly shortLabel: string;
  readonly title: string;
  readonly detail: string;
  readonly badge: { readonly cx: number; readonly cy: number };
  readonly rects: readonly FocusRect[];
  readonly paths?: readonly string[];
}

const STEPS: readonly StepSpec[] = [
  {
    step: 1,
    shortLabel: "1 压权重",
    title: "第 1 步 · 离线做一次：权重压成 INT8",
    detail:
      "离线阶段把 BF16 权重（每个数 2 字节）按输出通道每列除以自己的系数，舍入后截到 −128…127 存成 INT8（每个数 1 字节），下方细条留下每个输出通道的缩放系数。",
    badge: { cx: 244, cy: 80 },
    rects: [{ x: 104, y: 46, w: 430, h: 158, rx: 16 }],
  },
  {
    step: 2,
    shortLabel: "2 压激活",
    title: "第 2 步 · 每次前向：激活当场压成 INT8",
    detail:
      "每次前向把 BF16 输入激活（一行是一个 token）每行除以按本次输入现算的系数压成 INT8，右边细条留下每行的缩放系数；同一份权重每次配新的激活系数。",
    badge: { cx: 244, cy: 274 },
    rects: [{ x: 104, y: 240, w: 430, h: 158, rx: 16 }],
  },
  {
    step: 3,
    shortLabel: "3 整数乘加",
    title: "第 3 步 · 整数乘加（结果先是整数）",
    detail:
      "整数乘加只吃离线压好的 INT8 权重和当场压好的 INT8 激活，算出的结果先是整数；两路缩放系数绕开这一步，不进整数乘加。",
    badge: { cx: 564, cy: 190 },
    rects: [
      { x: 414, y: 56, w: 96, h: 84, rx: 10 },
      { x: 414, y: 250, w: 96, h: 72, rx: 10 },
      { x: 554, y: 180, w: 116, h: 76, rx: 12 },
    ],
    paths: ["M504 118 L532 118 L532 205 L560 205", "M520 286 L540 286 L540 231 L560 231"],
  },
  {
    step: 4,
    shortLabel: "4 乘回系数",
    title: "第 4 步 · 乘回两个系数，恢复输出 BF16",
    detail:
      "整数乘加的结果最后乘回每个输出通道的权重系数和每行的激活系数，输出恢复成 BF16。图示为逻辑步骤，提前量化和融合可以改变实际算子调用次数。",
    badge: { cx: 680, cy: 190 },
    rects: [
      { x: 416, y: 140, w: 92, h: 18, rx: 6 },
      { x: 506, y: 252, w: 18, h: 68, rx: 6 },
      { x: 670, y: 180, w: 108, h: 76, rx: 12 },
      { x: 784, y: 184, w: 84, h: 90, rx: 10 },
    ],
    paths: [
      "M504 149 L548 149 L548 168 L700 168 L700 186",
      "M520 316 L548 316 L548 268 L730 268 L730 250",
      "M664 218 L676 218",
      "M772 218 L790 218",
    ],
  },
];

export interface QuantizationIntuitionInteractiveProps extends InteractiveDiagramProps {
  readonly initialStep?: DiagramStep | undefined;
  readonly initialActPreset?: QuantActPresetId | undefined;
  readonly initialWeightCol?: QuantWeightColIdx | undefined;
}

export function QuantizationIntuitionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialStep = 0,
  initialActPreset = "standard",
  initialWeightCol = 0,
}: QuantizationIntuitionInteractiveProps) {
  const [step, setStep] = useState<DiagramStep>(initialStep);
  const [actPresetId, setActPresetId] = useState<QuantActPresetId>(initialActPreset);
  const [weightColIdx, setWeightColIdx] = useState<QuantWeightColIdx>(initialWeightCol);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mPipe = `${id}-${uid}-quant-pipe`;
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
  const chain = useMemo(() => computeQuantInt8Chain(actPresetId, weightColIdx), [actPresetId, weightColIdx]);
  const currentSpec = step === 0 ? undefined : STEPS[step - 1];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
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
      case "ArrowRight":
        event.preventDefault();
        setStep((prev) => (prev === 0 ? 1 : (Math.min(4, prev + 1) as StepNumber)));
        break;
      case "ArrowLeft":
        event.preventDefault();
        setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev));
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        setStep(Number(event.key) as StepNumber);
        break;
      case "0":
      case "Home":
      case "Escape":
        event.preventDefault();
        setStep(0);
        break;
      case "End":
        event.preventDefault();
        setStep(4);
        break;
    }
  };

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-mode={step === 0 ? "overview" : "step"}
      data-step={step}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="图解分步阅读控制"
        onKeyDown={handleKeyDown}
      >
        <fieldset className="wiki-diagram-mode-switch" aria-label="视图模式">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-overview"
            aria-pressed={step === 0}
            onClick={() => setStep(0)}
          >
            静态总览
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-step"
            aria-pressed={step > 0}
            onClick={() => setStep((prev) => (prev === 0 ? 1 : prev))}
          >
            手动分步
          </button>
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="四步切换">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-prev"
            disabled={step <= 1}
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev))}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            上一步
          </button>
          {STEPS.map((item) => {
            const active = step === item.step;
            return (
              <button
                key={item.step}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`diagram-step-${item.step}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                onClick={() => setStep(item.step)}
              >
                {item.shortLabel}
              </button>
            );
          })}
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-next"
            disabled={step === 4}
            onClick={() => setStep((prev) => (prev === 0 ? 1 : (Math.min(4, prev + 1) as StepNumber)))}
          >
            下一步
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-step-reset"
            disabled={step === 0}
            onClick={() => setStep(0)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            重置
          </button>
        </fieldset>
      </div>

      <div className="wiki-diagram-canvas">
        <div
          className="wiki-diagram-svg"
          ref={scrollRef}
          onScroll={onScroll}
          {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
        >
          <div className="wiki-diagram-stage">
            <div
              className="wiki-diagram-base"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
              dangerouslySetInnerHTML={html}
            />
            <svg
              className="wiki-diagram-overlay"
              viewBox="0 0 880 440"
              width="880"
              height="440"
              aria-hidden="true"
            >
              {currentSpec?.rects.map((r) => (
                <rect
                  key={`${r.x}-${r.y}-${r.w}-${r.h}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={r.rx}
                  className="wiki-diagram-focus-rect"
                />
              ))}
              {currentSpec?.paths?.map((d) => (
                <path key={d} d={d} className="wiki-diagram-focus-path" />
              ))}
              {currentSpec && (
                <circle
                  cx={currentSpec.badge.cx}
                  cy={currentSpec.badge.cy}
                  r={14}
                  className="wiki-diagram-focus-badge"
                />
              )}
            </svg>
            {STEPS.map((item) => (
              <button
                key={item.step}
                type="button"
                className="wiki-diagram-badge-hit"
                data-testid={`diagram-canvas-badge-${item.step}`}
                aria-label={`切换到第 ${item.step} 步`}
                aria-pressed={step === item.step}
                style={{ left: `${item.badge.cx - 14}px`, top: `${item.badge.cy - 14}px` }}
                onClick={() => setStep(item.step)}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </div>

        {currentSpec && (
          <div className="wiki-edu-panel" data-testid="quant-step-workbench" style={{ marginTop: "10px" }}>
            <div className="wiki-diagram-toolbar" style={{ background: "#fbfaf6" }}>
              <fieldset className="wiki-diagram-step-group" aria-label="输入激活预设切换">
                {QUANT_ACT_PRESETS.map((p) => {
                  const active = chain.actPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="wiki-diagram-ctrl-btn"
                      data-testid={`quant-act-${p.id}`}
                      aria-pressed={active}
                      onClick={() => setActPresetId(p.id)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </fieldset>
              <fieldset className="wiki-diagram-step-group" aria-label="输出通道权重列选择">
                {QUANT_WEIGHT_COLS.map((c) => {
                  const active = chain.weightColIdx === c.idx;
                  return (
                    <button
                      key={c.idx}
                      type="button"
                      className="wiki-diagram-ctrl-btn"
                      data-testid={`quant-col-${c.idx + 1}`}
                      aria-pressed={active}
                      onClick={() => setWeightColIdx(c.idx)}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </fieldset>
            </div>

            <svg
              viewBox="0 0 860 218"
              width="860"
              height="218"
              style={{ width: "100%", height: "auto", display: "block" }}
              role="img"
              aria-label={`对称 INT8 量化全链路实算：x=[${chain.x.join(",")}], w=[${chain.w.join(",")}]`}
            >
              <defs>
                <marker
                  id={mPipe}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,1 L9,5 L0,9 z" fill="#17211f" />
                </marker>
              </defs>

              <rect
                x="10"
                y="8"
                width="206"
                height="202"
                rx="9"
                fill="#fbfaf6"
                stroke={step <= 2 ? "#e85b32" : "#d8d8cf"}
                strokeWidth={step <= 2 ? "2" : "1.3"}
              />
              <text x="113" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                ① 原始浮点矩阵与输入行
              </text>
              {QUANT_WEIGHT_COLS.map((col, cIdx) => {
                const cellX = 22 + cIdx * 62;
                const sel = cIdx === chain.weightColIdx;
                return (
                  <g key={col.idx}>
                    <rect
                      x={cellX}
                      y="38"
                      width="56"
                      height="58"
                      rx="5"
                      fill={sel ? "#fff4cf" : "#ffffff"}
                      stroke={sel ? "#c78300" : "#d8d8cf"}
                      strokeWidth={sel ? "1.8" : "1.2"}
                    />
                    <text
                      x={cellX + 28}
                      y="60"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#17211f"
                    >
                      {`${col.w[0]}`}
                    </text>
                    <text
                      x={cellX + 28}
                      y="84"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#17211f"
                    >
                      {`${col.w[1]}`}
                    </text>
                  </g>
                );
              })}
              <text x="113" y="116" textAnchor="middle" fontSize="12" fill="#c78300" fontWeight="700">
                {`选中列${chain.weightColIdx + 1}: w=[${chain.w[0]}, ${chain.w[1]}]`}
              </text>
              <rect
                x="22"
                y="130"
                width="182"
                height="66"
                rx="6"
                fill="#ddf4ef"
                stroke="#087f73"
                strokeWidth="1.5"
              />
              <text x="113" y="156" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                {`激活行 x = [${chain.x[0]}, ${chain.x[1]}]`}
              </text>
              <text x="113" y="180" textAnchor="middle" fontSize="12" fill="#087f73">
                每行现算动态激活尺度
              </text>

              <line
                x1="218"
                y1="109"
                x2="230"
                y2="109"
                stroke="#17211f"
                strokeWidth="1.5"
                markerEnd={`url(#${mPipe})`}
              />

              <rect
                x="232"
                y="8"
                width="194"
                height="202"
                rx="9"
                fill="#fbfaf6"
                stroke={step <= 2 ? "#e85b32" : "#d8d8cf"}
                strokeWidth={step <= 2 ? "2" : "1.3"}
              />
              <text x="329" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                ② 尺度 max/127 与偶舍入
              </text>
              <rect x="244" y="40" width="170" height="62" rx="6" fill="#fff4cf" stroke="#c78300" />
              <text x="329" y="64" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                {`s_w = ${chain.scaleWFrac}`}
              </text>
              <text x="329" y="88" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
                {`INT8 q_w = [${chain.qw[0]}, ${chain.qw[1]}]`}
              </text>
              <rect x="244" y="112" width="170" height="62" rx="6" fill="#ddf4ef" stroke="#087f73" />
              <text x="329" y="136" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                {`s_x = ${chain.scaleXFrac}`}
              </text>
              <text x="329" y="160" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
                {`INT8 q_x = [${chain.qx[0]}, ${chain.qx[1]}]`}
              </text>
              <text
                x="329"
                y="196"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={chain.hasUnderflowZero ? "#b54237" : "#66716d"}
              >
                {chain.hasUnderflowZero ? "离群拉粗尺度 · 小数归 0!" : "最近偶数舍入至 INT8"}
              </text>

              <line
                x1="428"
                y1="109"
                x2="440"
                y2="109"
                stroke="#17211f"
                strokeWidth="1.5"
                markerEnd={`url(#${mPipe})`}
              />

              <rect
                x="442"
                y="8"
                width="186"
                height="202"
                rx="9"
                fill={step === 3 ? "#fff0e9" : "#fbfaf6"}
                stroke={step === 3 ? "#e85b32" : "#d8d8cf"}
                strokeWidth={step === 3 ? "2" : "1.3"}
              />
              <text x="535" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                ③ INT8 乘累加 INT32
              </text>
              <text x="535" y="72" textAnchor="middle" fontSize="12" fill="#17211f">
                {`${chain.qx[0]} × (${chain.qw[0]}) = ${chain.prod0}`}
              </text>
              <text x="535" y="100" textAnchor="middle" fontSize="12" fill="#17211f">
                {`${chain.qx[1]} × (${chain.qw[1]}) = ${chain.prod1}`}
              </text>
              <rect
                x="456"
                y="122"
                width="158"
                height="44"
                rx="6"
                fill="#e8edff"
                stroke="#4c65b6"
                strokeWidth="1.4"
              />
              <text x="535" y="149" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#4c65b6">
                {`INT32 = ${chain.accInt32}`}
              </text>
              <text x="535" y="192" textAnchor="middle" fontSize="12" fill="#66716d">
                缩放系数绕开此步
              </text>

              <line
                x1="630"
                y1="109"
                x2="642"
                y2="109"
                stroke="#17211f"
                strokeWidth="1.5"
                markerEnd={`url(#${mPipe})`}
              />

              <rect
                x="644"
                y="8"
                width="206"
                height="202"
                rx="9"
                fill={step === 4 ? "#fff0e9" : "#fbfaf6"}
                stroke={step === 4 ? "#e85b32" : "#d8d8cf"}
                strokeWidth={step === 4 ? "2" : "1.3"}
              />
              <text x="747" y="28" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                ④ 反量化恢复与误差对照
              </text>
              <rect
                x="656"
                y="44"
                width="182"
                height="58"
                rx="6"
                fill="#ddf4ef"
                stroke="#087f73"
                strokeWidth="1.4"
              />
              <text x="747" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                {`反量化 ≈ ${chain.dequant.toFixed(6)}`}
              </text>
              <text x="747" y="90" textAnchor="middle" fontSize="12" fill="#087f73">
                {`简记 ${chain.dequant.toFixed(3)}`}
              </text>
              <text x="747" y="136" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                {`浮点精算 = ${chain.fpExact}`}
              </text>
              <text
                x="747"
                y="170"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={Math.abs(chain.quantError) > 0.05 ? "#b54237" : "#087f73"}
              >
                {`量化误差 ${chain.quantError >= 0 ? "+" : ""}${chain.quantError.toFixed(6)}`}
              </text>
              <text x="747" y="196" textAnchor="middle" fontSize="12" fill="#66716d">
                乘回 s_x · s_w 得输出
              </text>
            </svg>
          </div>
        )}
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {currentSpec ? (
          <>
            <span className="wiki-diagram-step-tag">步 {currentSpec.step} / 4</span>
            <strong className="wiki-diagram-step-title">{currentSpec.title}</strong>
            <span className="wiki-diagram-step-detail">
              {currentSpec.detail}（当前算例：<code>{`x=[${chain.x.join(", ")}]`}</code>，
              <code>{`w=[${chain.w.join(", ")}]`}</code> → INT8 <code>{`[${chain.qx.join(", ")}]`}</code> 与{" "}
              <code>{`[${chain.qw.join(", ")}]`}</code>，INT32 累加 <code>{chain.accInt32}</code>，反量化{" "}
              <code>{chain.dequant.toFixed(6)}</code> 对照浮点 <code>{chain.fpExact}</code>）
            </span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            静态总览：展示普通动态 W8A8 Linear 的完整四步路径；点击「手动分步」或 1 至 4 逐步对照。
          </span>
        )}
      </output>
    </div>
  );
}
