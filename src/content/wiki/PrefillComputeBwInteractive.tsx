import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const PREFILL_COMPUTE_VS_BW_APPROVED_SHA256 =
  "b58286de953e4835d528d1d7accbc226c8520e1b623b2fe797c7b845e3d05813";
export const PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256 = PREFILL_COMPUTE_VS_BW_APPROVED_SHA256;

export const PREFILL_M_STOPS = [1, 12, 64, 256, 1024, 2036, 2048, 4096, 6000] as const;
export const PREFILL_PRESETS = [
  { id: "decode-1", mRows: 1, shortBtn: "Decode 单条 (M=1)" },
  { id: "decode-12", mRows: 12, shortBtn: "拼批 Decode (M=12)" },
  { id: "prefill-2048", mRows: 2048, shortBtn: "整段 Prefill (M=2048)" },
  { id: "prefill-6000", mRows: 6000, shortBtn: "超长突刺 (M=6000)" },
] as const;

export type PrefillDiagramMode = "sandbox" | "svg";

const HIDDEN_DIM = 4096;
const VOCAB_SIZE = 151936;
const KV_KIB_PER_TOK = 144;
const DEFAULT_HISTORY_TOKS = 2048;
const CO_RUNNING_DECODE_REQS = 12;
const STANDARD_CHUNK_BUDGET = 2048;
const MAX_PREFILL_PER_STEP = STANDARD_CHUNK_BUDGET - CO_RUNNING_DECODE_REQS; // 2036
const SCHEMATIC_RIDGE_FLOP_PER_B = 200;
const SCHEMATIC_BW_TBS = 1.6;
const SCHEMATIC_PEAK_TFLOPS = 320;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;

export function stepStopRight(stops: readonly number[], current: number): number {
  for (const s of stops) {
    if (s > current) return s;
  }
  return stops[stops.length - 1]!;
}

export function stepStopLeft(stops: readonly number[], current: number): number {
  for (let i = stops.length - 1; i >= 0; i--) {
    const s = stops[i]!;
    if (s < current) return s;
  }
  return stops[0]!;
}

export interface PrefillComputeBwState {
  readonly mRows: number;
  readonly chunkedEnabled: boolean;
  readonly stageKind: "decode-single" | "decode-batch" | "prefill-ramp" | "prefill" | "prefill-spike";
  readonly intensityFlopPerB: number;
  readonly achievedTflops: number;
  readonly roofPct: number;
  readonly isComputeBound: boolean;
  readonly weightGiB: 15.26;
  readonly kvTrafficText: string;
  readonly kvTrafficMiB: number;
  readonly naiveLogitsMiB: number;
  readonly naiveLogitsText: string;
  readonly slicedLogitsMiB: number;
  readonly slicedLogitsText: string;
  readonly savedLogitsMiB: number;
  readonly savedLogitsText: string;
  readonly savedLogitsShort: string;
  readonly totalSlicedRows: number;
  readonly totalSlicedMiB: number;
  readonly totalSlicedText: string;
  readonly totalSavedMiB: number;
  readonly totalSavedText: string;
  readonly logitsSavedPct: number;
  readonly slicedBarFlex: number;
  readonly savedBarFlex: number;
  readonly unchunkedCoRunningTokens: number;
  readonly activeStepPrefillTokens: number;
  readonly coRunningStepTokens: number;
  readonly decodeBarFlex: number;
  readonly prefillBarFlex: number;
  readonly widthInflationFactor: number;
  readonly needsChunkPrescription: boolean;
  readonly chunkSlices: readonly number[];
  readonly chunkCount: number;
  readonly chunkFormulaText: string;
  readonly chunkPlanText: string;
  readonly regimeBadge: string;
  readonly regimeTone: "is-bad" | "is-warn" | "is-good";
}

function formatByteSize(bytes: number): string {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(2)} GiB`;
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function formatShortByte(bytes: number): string {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)}G`;
  return `${(bytes / MIB).toFixed(1)}M`;
}

export function computePrefillComputeBwState(
  rawMRows: number,
  chunkedEnabled = false,
): PrefillComputeBwState {
  const mRows = Math.min(6000, Math.max(1, Math.round(rawMRows)));
  const isDecodePhase = mRows <= 64;
  const unchunkedCoRunningTokens = isDecodePhase ? mRows : mRows + CO_RUNNING_DECODE_REQS;
  const needsChunkPrescription = !isDecodePhase && unchunkedCoRunningTokens > STANDARD_CHUNK_BUDGET;

  const slices: number[] = [];
  if (!isDecodePhase) {
    let rem = mRows;
    while (rem > 0) {
      const take = Math.min(MAX_PREFILL_PER_STEP, rem);
      slices.push(take);
      rem -= take;
    }
  }
  const chunkCount = slices.length || 1;
  const chunkFormulaText = slices.join("+");

  const activeStepPrefillTokens = isDecodePhase
    ? 0
    : chunkedEnabled && needsChunkPrescription
      ? Math.min(mRows, MAX_PREFILL_PER_STEP)
      : mRows;
  const coRunningStepTokens = isDecodePhase ? mRows : CO_RUNNING_DECODE_REQS + activeStepPrefillTokens;

  // 算术强度按总提示词行数 mRows 核对（开启分块时在详情注明首块 2036 行的单步强度）
  const rawIntensity = 1 / (1 / mRows + 1 / HIDDEN_DIM + 1 / HIDDEN_DIM);
  const intensityFlopPerB =
    rawIntensity >= 100 ? Number(rawIntensity.toFixed(1)) : Number(rawIntensity.toFixed(2));
  const rawAchieved = Math.min(SCHEMATIC_PEAK_TFLOPS, rawIntensity * SCHEMATIC_BW_TBS);
  const achievedTflops = Number(rawAchieved.toFixed(1));
  const roofPct = Number(((rawAchieved / SCHEMATIC_PEAK_TFLOPS) * 100).toFixed(1));
  const isComputeBound = rawIntensity >= SCHEMATIC_RIDGE_FLOP_PER_B;

  const stageKind: PrefillComputeBwState["stageKind"] =
    mRows === 1
      ? "decode-single"
      : isDecodePhase
        ? "decode-batch"
        : !isComputeBound
          ? "prefill-ramp"
          : needsChunkPrescription && !chunkedEnabled
            ? "prefill-spike"
            : "prefill";

  let kvBytes: number;
  let kvTrafficText: string;
  if (mRows === 1) {
    kvBytes = DEFAULT_HISTORY_TOKS * KV_KIB_PER_TOK * 1024 + KV_KIB_PER_TOK * 1024;
    kvTrafficText = "读历史 288.0 MiB + 写 144.0 KiB";
  } else if (isDecodePhase) {
    kvBytes = mRows * DEFAULT_HISTORY_TOKS * KV_KIB_PER_TOK * 1024;
    kvTrafficText = `读 ${mRows} 条独立历史 ${(kvBytes / GIB).toFixed(2)} GiB`;
  } else {
    kvBytes = mRows * KV_KIB_PER_TOK * 1024;
    kvTrafficText = `批量写 ${mRows} 格 ${(kvBytes / MIB).toFixed(1)} MiB`;
  }
  const kvTrafficMiB = Number((kvBytes / MIB).toFixed(2));

  // FP32 logits: 单步末行投影 vs 分块多步累计投影（中间块末行采样丢弃但仍算 1 行 lm_head）
  const naiveBytes = mRows * VOCAB_SIZE * 4;
  const slicedRows = isDecodePhase ? mRows : 1;
  const slicedBytes = slicedRows * VOCAB_SIZE * 4;
  const activeChunkSteps = !isDecodePhase && chunkedEnabled && needsChunkPrescription ? chunkCount : 1;
  const totalSlicedRows = isDecodePhase ? mRows : activeChunkSteps;
  const totalSlicedBytes = totalSlicedRows * VOCAB_SIZE * 4;
  const savedBytes = isDecodePhase ? 0 : (mRows - 1) * VOCAB_SIZE * 4;
  const totalSavedBytes = isDecodePhase ? 0 : Math.max(0, naiveBytes - totalSlicedBytes);
  const naiveLogitsMiB = Number((naiveBytes / MIB).toFixed(2));
  const slicedLogitsMiB = Number((slicedBytes / MIB).toFixed(2));
  const savedLogitsMiB = Number((savedBytes / MIB).toFixed(2));
  const totalSlicedMiB = Number((totalSlicedBytes / MIB).toFixed(2));
  const totalSavedMiB = Number((totalSavedBytes / MIB).toFixed(2));
  const naiveLogitsText = formatByteSize(naiveBytes);
  const slicedLogitsText = formatByteSize(slicedBytes);
  const savedLogitsText = formatByteSize(savedBytes);
  const totalSlicedText = formatByteSize(totalSlicedBytes);
  const totalSavedText = formatByteSize(totalSavedBytes);
  const savedLogitsShort = formatShortByte(totalSavedBytes);
  const logitsSavedPct = isDecodePhase ? 0 : Number(((totalSavedBytes / naiveBytes) * 100).toFixed(2));

  const slicedBarFlex = isDecodePhase
    ? 1
    : Math.max(0.18, Number((totalSlicedBytes / naiveBytes).toFixed(4)));
  const savedBarFlex = isDecodePhase ? 0 : Math.max(0.18, Number((1 - slicedBarFlex).toFixed(4)));

  const decodeBarFlex = isDecodePhase
    ? 1
    : Math.max(0.18, Number((CO_RUNNING_DECODE_REQS / coRunningStepTokens).toFixed(4)));
  const prefillBarFlex = isDecodePhase ? 0 : Math.max(0.18, Number((1 - decodeBarFlex).toFixed(4)));
  const widthInflationFactor = isDecodePhase
    ? 1
    : Number((coRunningStepTokens / CO_RUNNING_DECODE_REQS).toFixed(1));

  const chunkPlanText = isDecodePhase
    ? `纯解码批（${mRows} 条请求各推进 1 个新词）：全部 ${mRows} 行均送入词表头各选 1 词，满足 uniform_decode，在 FULL_DECODE_ONLY 下可直接回放解码整图`
    : needsChunkPrescription
      ? chunkedEnabled
        ? `在 12 条在跑请求各占 1 格下，2048 预算每步最多给新提示词 2036 格，${mRows} 词共切 ${chunkCount} 步（${chunkFormulaText}）；每步算 1 行 0.58 MiB 词表头（中间步采样丢弃，全请求共投 ${chunkCount} 行 = ${formatByteSize(chunkCount * VOCAB_SIZE * 4)}，仅末块正式选出首词）`
        : `当前未开分块预填充：${mRows} 词与 12 条在跑解码挤进同一大步（${unchunkedCoRunningTokens} 格 > 2048 预算），全请求仅切末 1 行 = 0.58 MiB 选词但严重阻塞同批吐字；开启分块后每步最多给新提示词 2036 格，共切 ${chunkCount} 步（${chunkFormulaText}）`
      : "同批含 12 格在跑解码时总宽不超过 2048 预算，单步即可算完并切末 1 行选出首词";

  let regimeBadge: string;
  let regimeTone: "is-bad" | "is-warn" | "is-good";
  if (stageKind === "prefill-spike") {
    regimeBadge = "越过 2048 预算 · 挤占同批吐字";
    regimeTone = "is-bad";
  } else if (stageKind === "prefill-ramp") {
    regimeBadge = "仍在带宽斜坡爬升 · 未过脊点";
    regimeTone = "is-warn";
  } else if (isComputeBound) {
    regimeBadge =
      chunkedEnabled && needsChunkPrescription ? "分块护预算 · 算力高复用" : "Cube 算力受限 · 权重复用充分";
    regimeTone = "is-good";
  } else if (mRows === 1) {
    regimeBadge = "HBM 带宽受限 · 搬 15.26G 算 1 词";
    regimeTone = "is-bad";
  } else {
    regimeBadge = "拼批摊薄权重 · 仍在带宽斜坡";
    regimeTone = "is-warn";
  }

  return {
    mRows,
    chunkedEnabled,
    stageKind,
    intensityFlopPerB,
    achievedTflops,
    roofPct,
    isComputeBound,
    weightGiB: 15.26,
    kvTrafficText,
    kvTrafficMiB,
    naiveLogitsMiB,
    naiveLogitsText,
    slicedLogitsMiB,
    slicedLogitsText,
    savedLogitsMiB,
    savedLogitsText,
    savedLogitsShort,
    totalSlicedRows,
    totalSlicedMiB,
    totalSlicedText,
    totalSavedMiB,
    totalSavedText,
    logitsSavedPct,
    slicedBarFlex,
    savedBarFlex,
    unchunkedCoRunningTokens,
    activeStepPrefillTokens,
    coRunningStepTokens,
    decodeBarFlex,
    prefillBarFlex,
    widthInflationFactor,
    needsChunkPrescription,
    chunkSlices: slices,
    chunkCount,
    chunkFormulaText,
    chunkPlanText,
    regimeBadge,
    regimeTone,
  };
}

function mapLogX(intensity: number): number {
  const clamped = Math.min(2200, Math.max(0.8, intensity));
  const t = (Math.log10(clamped) - Math.log10(0.8)) / (Math.log10(2200) - Math.log10(0.8));
  return Math.round(40 + t * 280);
}

function mapLogY(tflops: number): number {
  const clamped = Math.min(480, Math.max(1.2, tflops));
  const t = (Math.log10(clamped) - Math.log10(1.2)) / (Math.log10(480) - Math.log10(1.2));
  return Math.round(146 - t * 114);
}

export interface PrefillComputeBwInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PrefillDiagramMode | undefined;
  readonly initialMRows?: number | undefined;
  readonly initialChunkedEnabled?: boolean | undefined;
}

export function PrefillComputeBwInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialMRows = 2048,
  initialChunkedEnabled = false,
}: PrefillComputeBwInteractiveProps) {
  const [mode, setMode] = useState<PrefillDiagramMode>(initialMode);
  const [mRows, setMRows] = useState<number>(initialMRows);
  const [chunkedEnabled, setChunkedEnabled] = useState<boolean>(initialChunkedEnabled);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mAxis = `${id}-${uid}-pf-axis`;

  const state = useMemo(() => computePrefillComputeBwState(mRows, chunkedEnabled), [mRows, chunkedEnabled]);

  const applyM = (nextM: number) => {
    setMode("sandbox");
    setMRows(Math.min(6000, Math.max(1, Math.round(nextM))));
  };

  const toggleChunked = () => {
    setMode("sandbox");
    setChunkedEnabled((prev) => !prev);
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
        applyM(stepStopRight(PREFILL_M_STOPS, state.mRows));
        break;
      case "ArrowLeft":
        event.preventDefault();
        applyM(stepStopLeft(PREFILL_M_STOPS, state.mRows));
        break;
      case "1":
      case "2":
      case "3":
      case "4": {
        event.preventDefault();
        const preset = PREFILL_PRESETS[Number(event.key) - 1];
        if (preset) applyM(preset.mRows);
        break;
      }
    }
  };

  const ridgeX = mapLogX(SCHEMATIC_RIDGE_FLOP_PER_B);
  const ridgeLowX = mapLogX(120);
  const ridgeHighX = mapLogX(270);
  const roofY = mapLogY(SCHEMATIC_PEAK_TFLOPS);
  const startX = mapLogX(0.8);
  const startY = mapLogY(0.8 * SCHEMATIC_BW_TBS);
  const dotX = mapLogX(state.intensityFlopPerB);
  const dotY = mapLogY(state.achievedTflops);
  const dotColor =
    state.stageKind === "prefill-spike"
      ? "#b54237"
      : state.isComputeBound
        ? "#087f73"
        : state.mRows === 1
          ? "#b54237"
          : "#c78300";
  const calloutX = Math.min(266, Math.max(92, dotX));
  const calloutY = dotY <= 62 ? dotY + 22 : Math.min(138, dotY - 12);
  const unmitigatedSpike = state.needsChunkPrescription && !chunkedEnabled;

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
      kickerTag="母版 B · 连续滑块跷跷板"
      kickerTitle="Prefill 算力吃满 vs Decode 带宽饥饿（Qwen3-8B）"
      question="为什么提示词几千个字一把全喂进去算得快，但一到逐字生成就卡在搬运上，还会拖慢别人？"
      toolbarLabel="单步并行词元行数 M 与典型工况切换"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-m-rows": state.mRows,
        "data-chunked": chunkedEnabled ? "true" : "false",
        "data-stage-kind": state.stageKind,
        "data-bound": state.isComputeBound ? "compute" : "memory",
      }}
      toolbar={
        <>
          <label htmlFor={sliderId} className="wiki-edu-slider-chip">
            <span className="mono">{`M = ${state.mRows}`}</span>
            <input
              id={sliderId}
              type="range"
              min={1}
              max={6000}
              step={1}
              value={state.mRows}
              data-testid="prefill-m-slider"
              aria-valuetext={`提示词或批宽 ${state.mRows} 行词元`}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => applyM(Number(e.target.value))}
            />
          </label>

          <fieldset className="wiki-edu-btn-row" aria-label="Prefill 与 Decode 四档工况预设">
            {PREFILL_PRESETS.map((preset) => {
              const active = mode === "sandbox" && state.mRows === preset.mRows;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`prefill-preset-${preset.id}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => applyM(preset.mRows)}
                >
                  {preset.shortBtn}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={state.regimeBadge}
      takeawayTone={
        state.regimeTone === "is-bad" ? "danger" : state.regimeTone === "is-warn" ? "warn" : "default"
      }
      takeaway={
        state.stageKind === "decode-single" ? (
          <>
            每步只推进 <strong>1 个新词</strong>，却仍要从显存通读 <strong>15.26 GiB</strong> 权重与{" "}
            <strong>288 MiB</strong> 历史缓存，算术强度仅 <strong>1.00 FLOP/B</strong>，算力大面积空等搬运！
          </>
        ) : state.stageKind === "decode-batch" ? (
          <>
            <strong>{`${state.mRows} 条请求`}</strong>拼成一批共摊 1 次权重读取，强度升至{" "}
            <strong>{`${state.intensityFlopPerB} FLOP/B`}</strong>，但仍在带宽斜坡爬升，且独立历史读取增至{" "}
            <strong>{state.kvTrafficText}</strong>。
          </>
        ) : state.stageKind === "prefill-ramp" ? (
          <>
            并行送入 <strong>{`${state.mRows} 行`}</strong>提示词将强度推至{" "}
            <strong>{`${state.intensityFlopPerB} FLOP/B`}</strong>，但
            <strong>仍在带宽斜坡爬升（未越过脊点 200）</strong>；末行切片省掉前{" "}
            <strong>{`${state.mRows - 1} 行`}</strong>（<strong>{state.savedLogitsText}</strong>）词表投影！
          </>
        ) : state.stageKind === "prefill" ? (
          chunkedEnabled && state.needsChunkPrescription ? (
            <>
              开启 2048 分块后保留原题 <strong>{`${state.mRows} 词`}</strong>不变，拆为{" "}
              <strong>{`${state.chunkCount} 步（${state.chunkFormulaText}）`}</strong>接力（单步总宽封顶{" "}
              <strong>2048</strong>）；每步仅切末行算 <strong>0.58 MiB</strong>（全请求{" "}
              <strong>{`${state.chunkCount} 步共投影 ${state.totalSlicedText}，省 ${state.totalSavedText}`}</strong>
              ，中间步采样丢弃）！
            </>
          ) : (
            <>
              搬 1 次 <strong>15.26 GiB</strong> 权重一口气喂饱 <strong>{`${state.mRows} 行`}</strong>
              提示词（强度 <strong>{`${state.intensityFlopPerB} FLOP/B`}</strong>{" "}
              越过脊点登顶），末行切片省掉前{" "}
              <strong>{`${state.mRows - 1} 行（${state.savedLogitsText}）`}</strong>词表投影！
            </>
          )
        ) : (
          <>
            虽吃满矩阵算力（<strong>{`${state.intensityFlopPerB} FLOP/B`}</strong>），但{" "}
            <strong>{`${state.mRows} 词`}</strong>与 12 条在跑解码合占{" "}
            <strong>{`${state.unchunkedCoRunningTokens} 词`}</strong>，已越过 <strong>2048</strong>{" "}
            单步预算（宽度膨胀 <strong>{`${state.widthInflationFactor}×`}</strong>）！
          </>
        )
      }
      kpi={
        chunkedEnabled && state.needsChunkPrescription
          ? `I = ${state.intensityFlopPerB} FLOP/B · 单步 ${state.slicedLogitsText}（${state.chunkCount}步共 ${state.totalSlicedText}）`
          : `I = ${state.intensityFlopPerB} FLOP/B · 选词头 ${state.slicedLogitsText}`
      }
      detailsSummary="查看工程与源码细节（算术强度公式 / 末行切片选词 / 2048 分块预算账）"
      detailsContent={
        state.mRows <= 64 ? (
          <>
            按 <code>Qwen3-8B</code>（36 层，<code>H=4096</code>，<code>V=151,936</code>，BF16 纯权重{" "}
            <code>15.26 GiB</code>，每词元 KV <code>144.0 KiB</code>）核算单层 <code>q_proj</code>：
            <code>I_BF16(M) = 1 / (1/M + 1/4096 + 1/4096)</code>。<code>M=1</code> 得 <code>1.00 FLOP/B</code>
            、<code>M=12</code> 得 <code>11.93 FLOP/B</code>。当前处于纯解码阶段：
            {state.chunkPlanText}（单步词表分数张量为{" "}
            <code>{`[${state.mRows}, 151936] ≈ ${state.slicedLogitsText}`}</code>）。
          </>
        ) : (
          <>
            按 <code>Qwen3-8B</code>（36 层，<code>H=4096</code>，<code>V=151,936</code>，BF16 纯权重{" "}
            <code>15.26 GiB</code>，每词元 KV <code>144.0 KiB</code>）核算单层 <code>q_proj</code>：
            <code>I_BF16(M) = 1 / (1/M + 1/4096 + 1/4096)</code>。<code>M=2048</code> 得{" "}
            <code>1024.0 FLOP/B</code>、<code>M=6000</code> 达 <code>1526.8 FLOP/B</code>（首块{" "}
            <code>2036</code> 行单步约为 <code>1021.0 FLOP/B</code>）。执行侧由{" "}
            <code>logits_indices = query_start_loc[1:num_reqs+1] - 1</code> 仅切每块末行送入{" "}
            <code>lm_head</code>（单步 <code>{state.slicedLogitsText}</code>，全请求共投影{" "}
            <code>{`${state.totalSlicedRows} 行 = ${state.totalSlicedText}`}</code>，较全算{" "}
            <code>{state.naiveLogitsText}</code> 省去 <code>{state.totalSavedText}</code>；中间分块由{" "}
            <code>discard_requests_mask</code> 丢弃临时采样并回拨随机种子偏移；开启{" "}
            <code>prompt_logprobs</code> 则须补算前 <code>N-1</code> 行并默认跳过前缀缓存读取）。混合批会打破{" "}
            <code>uniform_decode</code>（<code>FULL_DECODE_ONLY</code> 下退回 Eager）：{state.chunkPlanText}。
          </>
        )
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${state.mRows === 1 ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 算术强度水位（搬 1 次权重算几行？）</span>
            <span className={`wiki-edu-badge ${state.regimeTone}`}>{`屋顶发挥 ${state.roofPct}%`}</span>
          </div>

          <svg
            viewBox="0 0 340 184"
            width="340"
            height="184"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`Qwen3-8B 算术强度落点：M=${state.mRows}, I=${state.intensityFlopPerB} FLOP/B`}
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
            <rect x="32" y="16" width="296" height="136" rx="8" fill="#fbfaf6" stroke="#d8d8cf" />
            <rect
              x={ridgeLowX}
              y="17"
              width={Math.max(12, ridgeHighX - ridgeLowX)}
              height="134"
              fill="#fff4cf"
              opacity="0.55"
            />
            <line
              x1="40"
              y1="150"
              x2="322"
              y2="150"
              stroke="#66716d"
              strokeWidth="1.4"
              markerEnd={`url(#${mAxis})`}
            />
            <line
              x1="40"
              y1="150"
              x2="40"
              y2="22"
              stroke="#66716d"
              strokeWidth="1.4"
              markerEnd={`url(#${mAxis})`}
            />
            <line
              x1={ridgeX}
              y1={roofY}
              x2={ridgeX}
              y2="150"
              stroke="#c78300"
              strokeWidth="1.3"
              strokeDasharray="4 3"
            />
            <path
              d={`M ${startX} ${startY} L ${ridgeX} ${roofY} L 320 ${roofY}`}
              fill="none"
              stroke="#4c65b6"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <circle cx={dotX} cy={dotY} r="7" fill={dotColor} stroke="#ffffff" strokeWidth="2" />
            <text x="46" y="34" fontSize="13" fontWeight="700" fill="#b54237">
              带宽斜坡
            </text>
            <text x="320" y="28" textAnchor="end" fontSize="13" fontWeight="700" fill="#087f73">
              算力屋顶
            </text>
            <text x={ridgeX} y="172" textAnchor="middle" fontSize="13" fill="#66716d">
              脊点 120–270
            </text>
            <text x={calloutX} y={calloutY} textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`M=${state.mRows}`}
            </text>
          </svg>

          <div className="wiki-edu-tok-pill is-sys">
            <span>全层权重 15.26 GiB · KV 读写</span>
            <span className="wiki-edu-ptr-tag">{state.kvTrafficText}</span>
          </div>
        </div>

        <div className={`wiki-edu-panel${unmitigatedSpike ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 末行选词瘦身 & 同批陪跑账</span>
            <span className={`wiki-edu-badge ${unmitigatedSpike ? "is-bad" : "is-good"}`}>
              {state.logitsSavedPct > 0 ? `选词省 ${state.logitsSavedPct}%` : `选词 ${state.mRows} 行`}
            </span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>末行切片选词（对比全行投影）</span>
              <span className="mono">
                {state.logitsSavedPct > 0
                  ? chunkedEnabled && state.needsChunkPrescription
                    ? `单步 ${state.slicedLogitsText} · ${state.chunkCount}步共 ${state.totalSlicedText}（省 ${state.totalSavedText}）`
                    : `全算 ${state.naiveLogitsText} → 省 ${state.savedLogitsText}`
                  : `每请求各出 1 行（${state.slicedLogitsText}）`}
              </span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-full" style={{ flex: state.slicedBarFlex }}>
                {state.logitsSavedPct > 0
                  ? state.totalSlicedRows > 1
                    ? `共投 ${state.totalSlicedRows}行`
                    : "末行 0.58M"
                  : `选词 ${state.mRows}行`}
              </div>
              {state.logitsSavedPct > 0 && (
                <div className="wiki-edu-op is-piece" style={{ flex: state.savedBarFlex }}>
                  {`省 ${state.savedLogitsShort}`}
                </div>
              )}
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>同批 12 条在跑吐字 + 本步预填充</span>
              <span className="mono">{`本步总宽 ${state.coRunningStepTokens} 词`}</span>
            </div>
            <div className="wiki-edu-track">
              {state.mRows <= 64 ? (
                <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                  {`纯解码 ${state.mRows}词`}
                </div>
              ) : (
                <>
                  <div className="wiki-edu-op is-full" style={{ flex: state.decodeBarFlex }}>
                    在跑 12词
                  </div>
                  <div
                    className={`wiki-edu-op ${unmitigatedSpike ? "is-bubble" : "is-attn"}`}
                    style={{ flex: state.prefillBarFlex }}
                  >
                    {chunkedEnabled && state.needsChunkPrescription
                      ? `首块 ${state.activeStepPrefillTokens}词`
                      : `混入 ${state.activeStepPrefillTokens}词`}
                  </div>
                </>
              )}
            </div>
          </div>

          {state.needsChunkPrescription && (
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="prefill-apply-chunk-budget"
              aria-pressed={mode === "sandbox" && chunkedEnabled}
              style={eduBtnStyle(mode === "sandbox" && chunkedEnabled, "teal")}
              onClick={toggleChunked}
            >
              {chunkedEnabled
                ? `✓ 已开 2048 分块（${state.chunkCount} 步：${state.chunkFormulaText} · 点此关分块看原宽）`
                : `🔧 开启 2048 分块预填充（切 ${state.chunkCount} 步：${state.chunkFormulaText}，封顶 2048）`}
            </button>
          )}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
