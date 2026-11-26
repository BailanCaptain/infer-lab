import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const LOW_PREC_BIT_ANATOMY_APPROVED_SHA256 =
  "cfa6475f0c2a9d994ccefca95f39d44f3a43a6a6256299f50ac84eba33159f5c";
export const LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256 = LOW_PREC_BIT_ANATOMY_APPROVED_SHA256;

export const LOW_PREC_FORMATS = ["FP16", "BF16", "FP8_E4M3", "FP8_E5M2", "MXFP4"] as const;
export type LowPrecFormat = (typeof LOW_PREC_FORMATS)[number];
export type LowPrecDiagramMode = "sandbox" | "svg";

export const LOW_PREC_OUTLIER_STOPS = [2.8, 24, 600, 70000] as const;
export type LowPrecOutlierStop = (typeof LOW_PREC_OUTLIER_STOPS)[number];

const E2M1_LEVELS = [0, 0.5, 1, 1.5, 2, 3, 4, 6] as const;
const SAMPLE_X = [0.3, 1.2, 2.8] as const;
const SAMPLE_W = [1, -1, 2] as const;
const EXACT_DOT_Y = 4.7;

export interface LowPrecFormatMeta {
  readonly id: LowPrecFormat;
  readonly shortBtn: string;
  readonly label: string;
  readonly totalBits: 16 | 8 | 4;
  readonly signBits: 1;
  readonly expBits: number;
  readonly mantBits: number;
  readonly hasSharedE8M0: boolean;
  readonly effectiveBytesPerElem: number;
  readonly qwen3OProjMiB: number;
  readonly stepInOneTwoText: string;
  readonly maxFiniteVal: number;
  readonly maxFiniteText: string;
  readonly ascendNote: string;
}

export const LOW_PREC_META: Record<LowPrecFormat, LowPrecFormatMeta> = {
  FP16: {
    id: "FP16",
    shortBtn: "FP16 (1/5/10)",
    label: "FP16 半精度浮点（1符 / 5指 / 10尾）",
    totalBits: 16,
    signBits: 1,
    expBits: 5,
    mantBits: 10,
    hasSharedE8M0: false,
    effectiveBytesPerElem: 2,
    qwen3OProjMiB: 32.0,
    stepInOneTwoText: "2⁻¹⁰ ≈ 0.00098（比 BF16 细 8×）",
    maxFiniteVal: 65504,
    maxFiniteText: "65,504",
    ascendNote: "Atlas 300I DUO (310P) 必选浮点格式（不支持 BF16）；A2/A3 算子亦原生支持。",
  },
  BF16: {
    id: "BF16",
    shortBtn: "BF16 (1/8/7)",
    label: "BF16 脑浮点（1符 / 8指 / 7尾）",
    totalBits: 16,
    signBits: 1,
    expBits: 8,
    mantBits: 7,
    hasSharedE8M0: false,
    effectiveBytesPerElem: 2,
    qwen3OProjMiB: 32.0,
    stepInOneTwoText: "2⁻⁷ = 0.0078125",
    maxFiniteVal: 3.38953139e38,
    maxFiniteText: "≈ 3.4 × 10³⁸（同 FP32）",
    ascendNote: "Atlas A2 / A3 / 950 主力浮点基线：保住 FP32 的 8 位指数跨度，大激活抗溢出。",
  },
  FP8_E4M3: {
    id: "FP8_E4M3",
    shortBtn: "FP8 E4M3 (1/4/3)",
    label: "FP8 E4M3（1符 / 4指 / 3尾）",
    totalBits: 8,
    signBits: 1,
    expBits: 4,
    mantBits: 3,
    hasSharedE8M0: false,
    effectiveBytesPerElem: 1,
    qwen3OProjMiB: 16.0,
    stepInOneTwoText: "2⁻³ = 0.125（比特 00111100 → 1.5）",
    maxFiniteVal: 448,
    maxFiniteText: "448（更细但范围窄）",
    ascendNote:
      "纯 FP8 单元素占 1.00 B（单层 o_proj 载荷 16.00 MiB）；配 32 元素共享 E8M0 尺的 MXFP8 有效占 1.03125 B（o_proj 16.50 MiB，昇腾 950 重组目标），而 A2/A3 在 v0.30.0 会把原生分块 FP8 静默反量化回 BF16（2×显存），main 报错拦截。",
  },
  FP8_E5M2: {
    id: "FP8_E5M2",
    shortBtn: "FP8 E5M2 (1/5/2)",
    label: "FP8 E5M2（1符 / 5指 / 2尾）",
    totalBits: 8,
    signBits: 1,
    expBits: 5,
    mantBits: 2,
    hasSharedE8M0: false,
    effectiveBytesPerElem: 1,
    qwen3OProjMiB: 16.0,
    stepInOneTwoText: "2⁻² = 0.25（比特 00111100 → 1.0）",
    maxFiniteVal: 57344,
    maxFiniteText: "57,344（跨度宽但格距粗）",
    ascendNote:
      "同为 8 位字节，比特串 00111100 按 E4M3 读出 1.5，按 E5M2 读出 1.0——绝不可把两种 FP8 当同名格式混读。",
  },
  MXFP4: {
    id: "MXFP4",
    shortBtn: "MXFP4 (E2M1+E8M0)",
    label: "MXFP4 微缩放（4位 E2M1 + 32元素共享 E8M0）",
    totalBits: 4,
    signBits: 1,
    expBits: 2,
    mantBits: 1,
    hasSharedE8M0: true,
    effectiveBytesPerElem: 0.53125,
    qwen3OProjMiB: 8.5,
    stepInOneTwoText: "E2M1 仅 8 个非负格 [0, 0.5, 1, 1.5, 2, 3, 4, 6]",
    maxFiniteVal: 6,
    maxFiniteText: "单格上限 6 × 2^k（32项共 1B E8M0 尺）",
    ascendNote:
      "32×0.5B + 1B E8M0 = 17B/32元素（0.53125B，较 BF16 省 73.44%，o_proj 8.50 MiB）；昇腾 950 原生支持，与 NVFP4（16项 E4M3+全局 FP32）不可互换。",
  },
};

function roundToE2M1(val: number): number {
  const sign = val < 0 ? -1 : 1;
  const abs = Math.abs(val);
  let best: number = E2M1_LEVELS[0];
  let bestDist = Math.abs(abs - best);
  for (let i = 1; i < E2M1_LEVELS.length; i++) {
    const lv = E2M1_LEVELS[i]!;
    const dist = Math.abs(abs - lv);
    if (dist < bestDist) {
      bestDist = dist;
      best = lv;
    }
  }
  return sign * best;
}

function quantizePositiveBinaryFloat(
  val: number,
  expBits: number,
  mantBits: number,
  maxFinite: number,
): { exact: number; display: number; clipped: boolean } {
  if (val === 0) return { exact: 0, display: 0, clipped: false };
  const sign = val < 0 ? -1 : 1;
  const abs = Math.abs(val);
  if (abs > maxFinite) {
    return { exact: sign * maxFinite, display: sign * maxFinite, clipped: true };
  }
  const bias = (1 << (expBits - 1)) - 1;
  const minNormalExp = 1 - bias;
  const minNormal = 2 ** minNormalExp;
  if (abs < minNormal) {
    const subStep = minNormal / (1 << mantBits);
    const exact = sign * (Math.round(abs / subStep) * subStep);
    return { exact, display: Number(exact.toFixed(4)), clipped: false };
  }
  const exp = Math.floor(Math.log2(abs));
  const step = 2 ** (exp - mantBits);
  const rounded = Math.round(abs / step) * step;
  if (rounded > maxFinite) {
    return { exact: sign * maxFinite, display: sign * maxFinite, clipped: true };
  }
  const exact = sign * rounded;
  return { exact, display: Number(exact.toFixed(4)), clipped: false };
}

export interface LowPrecSandboxState {
  readonly format: LowPrecFormat;
  readonly meta: LowPrecFormatMeta;
  readonly outlierVal: LowPrecOutlierStop;
  readonly scaleMismatch: boolean;
  readonly writeScale: number;
  readonly readScale: number;
  readonly mismatchTargetScale: number;
  readonly codes: readonly [number, number, number];
  readonly readback: readonly [number, number, number];
  readonly outlierReadback: number;
  readonly overflowKind: "none" | "ieee-inf" | "e4m3fn-sat-or-nan";
  readonly outlierResultLabel: string;
  readonly isOutlierClipped: boolean;
  readonly isSmallCollapsed: boolean;
  readonly dotHat: number;
  readonly dotError: number;
  readonly statusBadge: string;
  readonly statusTone: "is-good" | "is-warn" | "is-bad";
}

export function computeLowPrecState(
  format: LowPrecFormat,
  outlierVal: LowPrecOutlierStop,
  scaleMismatch: boolean,
): LowPrecSandboxState {
  const meta = LOW_PREC_META[format];

  if (format === "MXFP4") {
    const groupMax = Math.max(2.8, outlierVal);
    const expPow = Math.ceil(Math.log2(groupMax / 6));
    const writeScale = 2 ** expPow;
    const mismatchTargetScale = writeScale === 4 ? 0.5 : 4;
    const readScale = scaleMismatch ? mismatchTargetScale : writeScale;
    const c0 = roundToE2M1(SAMPLE_X[0] / writeScale);
    const c1 = roundToE2M1(SAMPLE_X[1] / writeScale);
    const c2 = roundToE2M1(SAMPLE_X[2] / writeScale);
    const codes: readonly [number, number, number] = [c0, c1, c2];
    const raw0 = c0 * readScale;
    const raw1 = c1 * readScale;
    const raw2 = c2 * readScale;
    const readback: readonly [number, number, number] = [
      Number(raw0.toFixed(4)),
      Number(raw1.toFixed(4)),
      Number(raw2.toFixed(4)),
    ];
    const outlierCode = roundToE2M1(outlierVal / writeScale);
    const outlierReadback = Number((outlierCode * readScale).toFixed(2));
    const rawDot = raw0 * SAMPLE_W[0] + raw1 * SAMPLE_W[1] + raw2 * SAMPLE_W[2];
    const dotHat = Number(rawDot.toFixed(4));
    const dotError = Number((rawDot - EXACT_DOT_Y).toFixed(4));
    const isSmallCollapsed = c0 === 0 || c1 === c2;

    let statusBadge: string;
    let statusTone: "is-good" | "is-warn" | "is-bad";
    if (scaleMismatch) {
      statusBadge = `错配 scale=${readScale} · 整体漂移`;
      statusTone = "is-bad";
    } else if (isSmallCollapsed) {
      statusBadge = `离群拉粗 s=${writeScale} · 小数塌缩`;
      statusTone = "is-bad";
    } else {
      statusBadge = `共享尺 s=${writeScale} · 省 73.44%`;
      statusTone = "is-good";
    }

    return {
      format,
      meta,
      outlierVal,
      scaleMismatch,
      writeScale,
      readScale,
      mismatchTargetScale,
      codes,
      readback,
      outlierReadback,
      overflowKind: "none",
      outlierResultLabel: `${outlierReadback}`,
      isOutlierClipped: false,
      isSmallCollapsed,
      dotHat,
      dotError,
      statusBadge,
      statusTone,
    };
  }

  const writeScale = scaleMismatch ? 0.5 : 1;
  const mismatchTargetScale = 4;
  const readScale = scaleMismatch ? mismatchTargetScale : 1;
  const q0 = quantizePositiveBinaryFloat(
    SAMPLE_X[0] / writeScale,
    meta.expBits,
    meta.mantBits,
    meta.maxFiniteVal,
  );
  const q1 = quantizePositiveBinaryFloat(
    SAMPLE_X[1] / writeScale,
    meta.expBits,
    meta.mantBits,
    meta.maxFiniteVal,
  );
  const q2 = quantizePositiveBinaryFloat(
    SAMPLE_X[2] / writeScale,
    meta.expBits,
    meta.mantBits,
    meta.maxFiniteVal,
  );
  const qOut = quantizePositiveBinaryFloat(
    outlierVal / writeScale,
    meta.expBits,
    meta.mantBits,
    meta.maxFiniteVal,
  );

  const codes: readonly [number, number, number] = [q0.display, q1.display, q2.display];
  const raw0 = q0.exact * readScale;
  const raw1 = q1.exact * readScale;
  const raw2 = q2.exact * readScale;
  const readback: readonly [number, number, number] = [
    Number(raw0.toFixed(4)),
    Number(raw1.toFixed(4)),
    Number(raw2.toFixed(4)),
  ];
  const overflowKind: LowPrecSandboxState["overflowKind"] = !qOut.clipped
    ? "none"
    : format === "FP8_E4M3"
      ? "e4m3fn-sat-or-nan"
      : "ieee-inf";
  const outlierReadback =
    overflowKind === "ieee-inf" ? Number.POSITIVE_INFINITY : Number((qOut.exact * readScale).toFixed(2));
  const rawDot = raw0 * SAMPLE_W[0] + raw1 * SAMPLE_W[1] + raw2 * SAMPLE_W[2];
  const dotHat = Number(rawDot.toFixed(4));
  const dotError = Number((rawDot - EXACT_DOT_Y).toFixed(4));
  const capNumText = meta.maxFiniteVal.toLocaleString("en-US");
  const outlierResultLabel =
    overflowKind === "ieee-inf"
      ? `标准 IEEE 上溢为 Inf（仅饱和转换截断于 ${capNumText}）`
      : overflowKind === "e4m3fn-sat-or-nan"
        ? `无 Inf 编码：非饱和转 NaN / 饱和核截断 ${outlierReadback}`
        : `${outlierReadback}`;

  let statusBadge: string;
  let statusTone: "is-good" | "is-warn" | "is-bad";
  if (scaleMismatch) {
    statusBadge = "错配块尺 s=4 · 数值失真 8×";
    statusTone = "is-bad";
  } else if (overflowKind === "ieee-inf") {
    statusBadge = `超上限 ${capNumText} · 上溢 Inf!`;
    statusTone = "is-bad";
  } else if (overflowKind === "e4m3fn-sat-or-nan") {
    statusBadge = `超上限 ${capNumText} · NaN 或饱和 448!`;
    statusTone = "is-bad";
  } else if (format === "FP8_E5M2") {
    statusBadge = "5位指数扛大数 · 2位尾数偏粗";
    statusTone = "is-warn";
  } else {
    statusBadge = "指数覆盖正常 · 无溢出";
    statusTone = "is-good";
  }

  return {
    format,
    meta,
    outlierVal,
    scaleMismatch,
    writeScale,
    readScale,
    mismatchTargetScale,
    codes,
    readback,
    outlierReadback,
    overflowKind,
    outlierResultLabel,
    isOutlierClipped: qOut.clipped,
    isSmallCollapsed: false,
    dotHat,
    dotError,
    statusBadge,
    statusTone,
  };
}

export interface LowPrecisionBitInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: LowPrecDiagramMode | undefined;
  readonly initialFormat?: LowPrecFormat | undefined;
  readonly initialOutlier?: LowPrecOutlierStop | undefined;
  readonly initialScaleMismatch?: boolean | undefined;
}

export function LowPrecisionBitInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialFormat = "MXFP4",
  initialOutlier = 2.8,
  initialScaleMismatch = false,
}: LowPrecisionBitInteractiveProps) {
  const [mode, setMode] = useState<LowPrecDiagramMode>(initialMode);
  const [format, setFormat] = useState<LowPrecFormat>(initialFormat);
  const [outlierVal, setOutlierVal] = useState<LowPrecOutlierStop>(initialOutlier);
  const [scaleMismatch, setScaleMismatch] = useState<boolean>(initialScaleMismatch);
  const sliderId = useId();

  const state = useMemo(
    () => computeLowPrecState(format, outlierVal, scaleMismatch),
    [format, outlierVal, scaleMismatch],
  );
  const fmtIdx = LOW_PREC_FORMATS.indexOf(format);
  const outlierIdx = LOW_PREC_OUTLIER_STOPS.indexOf(outlierVal);

  const selectFormat = (next: LowPrecFormat) => {
    setMode("sandbox");
    setFormat(next);
  };

  const selectOutlier = (next: LowPrecOutlierStop) => {
    setMode("sandbox");
    setOutlierVal(next);
  };

  const toggleMismatch = () => {
    setMode("sandbox");
    setScaleMismatch((prev) => !prev);
  };

  const resetClean = () => {
    setMode("sandbox");
    setOutlierVal(2.8);
    setScaleMismatch(false);
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
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectFormat(LOW_PREC_FORMATS[Math.min(LOW_PREC_FORMATS.length - 1, fmtIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectFormat(LOW_PREC_FORMATS[Math.max(0, fmtIdx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectFormat(LOW_PREC_FORMATS[Number(event.key) - 1]!);
        break;
    }
  };

  const { meta } = state;
  // FP32 = 4.00B = 304px (76px/B); MXFP4 载荷 0.50B = 38px，均摊 E8M0 尺度 0.03125B = 2.375px
  const payloadW = (meta.totalBits / 32) * 304;
  const sharedScaleW = meta.hasSharedE8M0 ? (1 / 32 / 4) * 304 : 0;
  const signW = 44;
  const bodyW = meta.hasSharedE8M0 ? 158 : 260;
  const expW = Math.round((meta.expBits / (meta.expBits + meta.mantBits)) * bodyW);
  const mantW = bodyW - expW;
  const hasFault = state.scaleMismatch || state.isOutlierClipped || state.isSmallCollapsed;

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
      kickerTag="母版 B · 格式与缩放权衡"
      kickerTitle="低精度比特位域解剖 × 缩放尺与离群值冲击"
      question="同样叫 8 位或 4 位，为什么有的能扛住大数不爆表，有的配错一把尺子就全盘失真？"
      toolbarLabel="数值格式切换与离群值/错配尺实验"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-format": format,
        "data-outlier": outlierVal,
        "data-mismatch": scaleMismatch ? "true" : "false",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="五种数值格式切换">
            {LOW_PREC_FORMATS.map((f) => {
              const active = mode === "sandbox" && format === f;
              return (
                <button
                  key={f}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`lowprec-fmt-${f}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectFormat(f)}
                >
                  {LOW_PREC_META[f].shortBtn}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="同组离群值与错配尺实验">
            <label htmlFor={sliderId} className="wiki-edu-slider-chip">
              <span className="mono">{`同组最大 ${outlierVal}`}</span>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={LOW_PREC_OUTLIER_STOPS.length - 1}
                step={1}
                value={outlierIdx}
                data-testid="lowprec-outlier-slider"
                aria-valuetext={`同组最大数值 ${outlierVal}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => {
                  const next = LOW_PREC_OUTLIER_STOPS[Number(e.target.value)];
                  if (next !== undefined) selectOutlier(next);
                }}
              />
            </label>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="lowprec-inject-outlier24"
              aria-pressed={mode === "sandbox" && outlierVal === 24 && !scaleMismatch}
              style={eduBtnStyle(mode === "sandbox" && outlierVal === 24 && !scaleMismatch, "dark")}
              onClick={() => {
                setScaleMismatch(false);
                selectOutlier(outlierVal === 24 ? 2.8 : 24);
              }}
            >
              注入离群 24
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="lowprec-toggle-mismatch"
              aria-pressed={mode === "sandbox" && scaleMismatch}
              style={eduBtnStyle(mode === "sandbox" && scaleMismatch, "dark")}
              onClick={toggleMismatch}
            >
              {scaleMismatch
                ? `已错配 s=${state.readScale}（恢复）`
                : `错配 scale=${state.mismatchTargetScale}`}
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={state.statusBadge}
      takeawayTone={
        state.statusTone === "is-bad" ? "danger" : state.statusTone === "is-warn" ? "warn" : "default"
      }
      takeaway={
        state.scaleMismatch ? (
          <>
            载荷编码一比特没坏，但读回时误配了别组的 <strong>{`scale = ${state.readScale}`}</strong>（原写{" "}
            <strong>{state.writeScale}</strong>），导致 <code>[0.3, 1.2, 2.8]</code> 整体漂成{" "}
            <strong>{`[${state.readback.join(", ")}]`}</strong>！
          </>
        ) : state.overflowKind === "ieee-inf" ? (
          <>
            <strong>{meta.shortBtn}</strong> 仅有 <strong>{`${meta.expBits} 位指数`}</strong>（上限{" "}
            <strong>{meta.maxFiniteVal.toLocaleString("en-US")}</strong>）：大数 <strong>{outlierVal}</strong>{" "}
            在标准 IEEE 最近偶数舍入下直接<strong>上溢为 Inf</strong>
            ，将后续点积与归一化污染为 <strong>Inf / NaN</strong>（仅显式饱和转换才会夹断于{" "}
            <strong>{meta.maxFiniteVal.toLocaleString("en-US")}</strong>；切 <code>BF16</code> 靠 8
            位指数即可避免上溢，7 位尾数舍入为 <code>70,144</code>）！
          </>
        ) : state.overflowKind === "e4m3fn-sat-or-nan" ? (
          <>
            <strong>{meta.shortBtn}</strong>（无 <code>Inf</code> 编码，上限 <strong>448</strong>）：大数{" "}
            <strong>{outlierVal}</strong> 在非饱和转换下产出 <strong>NaN</strong>，在显式饱和量化核下夹断于{" "}
            <strong>448</strong>（对比 <code>E5M2</code> 的 5 位指数上限 <code>57,344</code> 可正常容纳{" "}
            <code>600</code>）！
          </>
        ) : state.isSmallCollapsed ? (
          <>
            同组混入大数 <strong>{outlierVal}</strong> 迫使 32 元素共享尺拉粗至{" "}
            <strong>{`s = ${state.writeScale}`}</strong>，小数 <code>[0.3, 1.2, 2.8]</code> 被挤成{" "}
            <strong>{`[${state.readback.join(", ")}]`}</strong>（微缩放把污染关在本 32 元素块内）！
          </>
        ) : (
          <>
            <strong>{meta.label}</strong>：每元素有效占 <strong>{`${meta.effectiveBytesPerElem} B`}</strong>
            （8B 单层输出投影 <strong>{`${meta.qwen3OProjMiB.toFixed(2)} MiB`}</strong>），
            <code>[0.3, 1.2, 2.8]</code> 读回 <strong>{`[${state.readback.join(", ")}]`}</strong>。
          </>
        )
      }
      kpi={`点积 ŷ = ${state.dotHat}（精算 4.7 · 差 ${state.dotError >= 0 ? "+" : ""}${state.dotError}）`}
      detailsSummary="查看工程与源码细节（00111100 双格式异读 / 微缩放 17B 账本 / 四族昇腾硬件选路红线）"
      detailsContent={
        <>
          <strong>{meta.label}</strong>：{meta.ascendNote} 正文经典对照：① 同一字节 <code>00111100</code> 按{" "}
          <code>E4M3</code>（偏置 7）读出 <code>1.5</code>，按 <code>E5M2</code>（偏置 15）读出{" "}
          <code>1.0</code>，且 <code>HiF8</code> 含可变 <code>Dot</code> 位不可混读；② <code>Qwen3-8B</code>{" "}
          单层 <code>o_proj</code>（<code>16.78M</code> 元素）在纯 <code>FP8</code> 载荷下为{" "}
          <code>16.00 MiB</code>，配 <code>E8M0</code> 的 <code>MXFP8</code> 为 <code>16.50 MiB</code>，
          <code>MXFP4</code> 为 <code>8.50 MiB</code>；<code>Qwen3-30B-A3B</code> 48 层路由专家从{" "}
          <code>BF16 54.00 GiB</code> 压至 <code>MXFP8 27.84375 GiB</code> / <code>MXFP4 14.34375 GiB</code>
          ；③ <code>v0.30.0</code> 新增稠密 <code>C8-MXFP</code> KV 缓存（
          <code>--kv-cache-dtype mxfp8</code>，全零通道中性尺度清洗为 <code>127</code>）。
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 比特位域解剖（指数定跨度 · 尾数定细度）</span>
            <span className="wiki-edu-badge is-mid">{`单层投影 ${meta.qwen3OProjMiB.toFixed(2)} MiB`}</span>
          </div>

          <svg
            viewBox="0 0 336 176"
            width="336"
            height="176"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`${meta.label} 位域结构与 FP32 体积对比`}
          >
            <rect x="16" y="12" width="9.5" height="24" rx="3" fill="#fff0e9" stroke="#e85b32" />
            <rect x="25.5" y="12" width="76" height="24" rx="3" fill="#e8edff" stroke="#4c65b6" />
            <rect x="101.5" y="12" width="218.5" height="24" rx="3" fill="#ddf4ef" stroke="#087f73" />
            <text x="63.5" y="29" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#17211f">
              8指
            </text>
            <text x="210.5" y="29" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#17211f">
              FP32 参照 (4字节)
            </text>

            <rect x="16" y="50" width="304" height="24" rx="4" fill="#ece9df" stroke="#d8d8cf" />
            <rect x="16" y="50" width={payloadW} height="24" rx="3" fill="#4c65b6" />
            {sharedScaleW > 0 && (
              <rect x={16 + payloadW} y="50" width={sharedScaleW} height="24" fill="#c78300" />
            )}
            <text x="316" y="67" textAnchor="end" fontSize="13.5" fontWeight="700" fill="#17211f">
              {`单数：${meta.effectiveBytesPerElem} B`}
            </text>

            <rect
              x="16"
              y="92"
              width={signW}
              height="42"
              rx="6"
              fill="#fff0e9"
              stroke="#e85b32"
              strokeWidth="1.5"
            />
            <text
              x={16 + signW / 2}
              y="118"
              textAnchor="middle"
              fontSize="13.5"
              fontWeight="700"
              fill="#17211f"
            >
              1符
            </text>

            <rect
              x={16 + signW}
              y="92"
              width={expW}
              height="42"
              rx="6"
              fill="#e8edff"
              stroke="#4c65b6"
              strokeWidth="1.5"
            />
            <text
              x={16 + signW + expW / 2}
              y="118"
              textAnchor="middle"
              fontSize="13.5"
              fontWeight="700"
              fill="#17211f"
            >
              {`${meta.expBits}指`}
            </text>

            <rect
              x={16 + signW + expW}
              y="92"
              width={mantW}
              height="42"
              rx="6"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text
              x={16 + signW + expW + mantW / 2}
              y="118"
              textAnchor="middle"
              fontSize="13.5"
              fontWeight="700"
              fill="#17211f"
            >
              {`${meta.mantBits}尾`}
            </text>

            {meta.hasSharedE8M0 && (
              <>
                <rect
                  x="222"
                  y="92"
                  width="98"
                  height="42"
                  rx="6"
                  fill="#fff4cf"
                  stroke="#c78300"
                  strokeWidth="1.5"
                />
                <text x="271" y="118" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#17211f">
                  共享E8M0
                </text>
              </>
            )}

            <text x="16" y="160" fontSize="13.5" fill="#66716d">
              {`上限：${meta.maxFiniteText}`}
            </text>
          </svg>

          <div className="wiki-edu-tok-pill is-priv">
            <span>[1, 2) 区间格距</span>
            <span className="wiki-edu-ptr-tag">{meta.stepInOneTwoText}</span>
          </div>
        </div>

        <div className={`wiki-edu-panel${hasFault ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② [0.3, 1.2, 2.8] 缩放与读回实算</span>
            <span className={`wiki-edu-badge ${state.statusTone}`}>
              {`写尺 ${state.writeScale} / 读尺 ${state.readScale}`}
            </span>
          </div>

          <div className="wiki-edu-tok-list">
            <div className="wiki-edu-tok-pill is-sys">
              <span>原向量 x（配权重 [1, -1, 2]）</span>
              <span className="wiki-edu-ptr-tag">
                {outlierVal > 2.8 ? `[0.3, 1.2, 2.8] + 离群 ${outlierVal}` : "[0.3, 1.2, 2.8]"}
              </span>
            </div>
            <div className="wiki-edu-tok-pill is-priv">
              <span>量化落格编码（除以写尺后）</span>
              <span className="wiki-edu-ptr-tag">{`[${state.codes.join(", ")}]`}</span>
            </div>
            <div className={`wiki-edu-tok-pill ${hasFault ? "is-cow" : "is-priv"}`}>
              <span>乘回读尺后还原值 x̂</span>
              <span className="wiki-edu-ptr-tag">{`[${state.readback.join(", ")}]`}</span>
            </div>
            {outlierVal > 2.8 && (
              <div className={`wiki-edu-tok-pill ${state.isOutlierClipped ? "is-cow" : "is-sys"}`}>
                <span>{`同组大数 ${outlierVal} 转换结果`}</span>
                <span className="wiki-edu-ptr-tag">{state.outlierResultLabel}</span>
              </div>
            )}
          </div>

          {(outlierVal > 2.8 || scaleMismatch) && (
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="lowprec-reset-clean"
              style={eduBtnStyle(false)}
              onClick={resetClean}
            >
              🔧 恢复干净同组（清离群 + 对齐本组 scale）
            </button>
          )}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
