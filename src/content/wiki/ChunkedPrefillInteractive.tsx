import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const CHUNKED_BUDGET_OPTIONS = [512, 1024, 2048, 4096] as const;
export type ChunkedBudgetOption = (typeof CHUNKED_BUDGET_OPTIONS)[number];

export const DECODE_CONCURRENCY_OPTIONS = [0, 8, 32] as const;
export type DecodeConcurrencyOption = (typeof DECODE_CONCURRENCY_OPTIONS)[number];

export type ChunkedDiagramMode = "svg" | "sandbox";

export const NEW_PROMPT_TOKENS = 4096;

export interface ChunkStepSlice {
  readonly stepIndex: number;
  readonly decodeTokens: number;
  readonly prefillTokens: number;
  readonly startPos: number;
  readonly endPos: number;
  readonly historyReadPositions: number;
  readonly stepCostUnits: number;
  readonly emitsFirstToken: boolean;
}

export interface ChunkedPrefillPlan {
  readonly budget: ChunkedBudgetOption;
  readonly decodeConcurrency: DecodeConcurrencyOption;
  readonly decodeSlotsPerStep: number;
  readonly prefillCapacityPerStep: number;
  readonly firstStepSlack: number;
  readonly chunkCount: number;
  readonly slices: readonly ChunkStepSlice[];
  readonly cumulativeHistoryPositions: number;
  readonly peakStepUnits: number;
  readonly totalTtftUnits: number;
}

export function computeChunkedPrefillPlan(
  budget: ChunkedBudgetOption,
  decodeConcurrency: DecodeConcurrencyOption,
): ChunkedPrefillPlan {
  const decodeSlotsPerStep = decodeConcurrency;
  const prefillCapacityPerStep = Math.max(1, budget - decodeSlotsPerStep);
  const slices: ChunkStepSlice[] = [];
  let computed = 0;
  let stepIndex = 1;
  while (computed < NEW_PROMPT_TOKENS) {
    const prefillTokens = Math.min(NEW_PROMPT_TOKENS - computed, prefillCapacityPerStep);
    const startPos = computed;
    const endPos = computed + prefillTokens - 1;
    const historyReadPositions = computed + prefillTokens;
    const stepCostUnits = Math.round(120 + decodeSlotsPerStep + prefillTokens + computed * 0.15);
    computed += prefillTokens;
    slices.push({
      stepIndex,
      decodeTokens: decodeSlotsPerStep,
      prefillTokens,
      startPos,
      endPos,
      historyReadPositions,
      stepCostUnits,
      emitsFirstToken: computed >= NEW_PROMPT_TOKENS,
    });
    stepIndex++;
  }
  const firstSlice = slices[0]!;
  const firstStepSlack = Math.max(0, budget - decodeSlotsPerStep - firstSlice.prefillTokens);
  const cumulativeHistoryPositions = slices.reduce((acc, s) => acc + s.historyReadPositions, 0);
  const peakStepUnits = Math.max(...slices.map((s) => s.stepCostUnits));
  const totalTtftUnits = slices.reduce((acc, s) => acc + s.stepCostUnits, 0);

  return {
    budget,
    decodeConcurrency,
    decodeSlotsPerStep,
    prefillCapacityPerStep,
    firstStepSlack,
    chunkCount: slices.length,
    slices,
    cumulativeHistoryPositions,
    peakStepUnits,
    totalTtftUnits,
  };
}

export interface ChunkedPrefillInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: ChunkedDiagramMode | undefined;
  readonly initialBudget?: ChunkedBudgetOption | undefined;
  readonly initialDecodeConcurrency?: DecodeConcurrencyOption | undefined;
}

export function ChunkedPrefillInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialBudget = 2048,
  initialDecodeConcurrency = 8,
}: ChunkedPrefillInteractiveProps) {
  const [mode, setMode] = useState<ChunkedDiagramMode>(initialMode);
  const [budget, setBudget] = useState<ChunkedBudgetOption>(initialBudget);
  const [decodeConcurrency, setDecodeConcurrency] =
    useState<DecodeConcurrencyOption>(initialDecodeConcurrency);
  const sliderId = useId();
  const plan = useMemo(
    () => computeChunkedPrefillPlan(budget, decodeConcurrency),
    [budget, decodeConcurrency],
  );
  const budgetIdx = CHUNKED_BUDGET_OPTIONS.indexOf(budget);

  const applyBudget = (next: ChunkedBudgetOption) => {
    setMode("sandbox");
    setBudget(next);
  };

  const applyDecode = (next: DecodeConcurrencyOption) => {
    setMode("sandbox");
    setDecodeConcurrency(next);
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
    if (event.key === "0" || event.key === "Escape") {
      event.preventDefault();
      setMode("svg");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      applyBudget(CHUNKED_BUDGET_OPTIONS[Math.min(3, budgetIdx + 1)]!);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyBudget(CHUNKED_BUDGET_OPTIONS[Math.max(0, budgetIdx - 1)]!);
    }
  };

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mFirstTok = `${id}-${uid}-chunk-first`;
  const firstChunk = plan.slices[0]!.prefillTokens;
  const hasDecodeUsers = plan.decodeSlotsPerStep > 0;
  const isDecodeStalled = hasDecodeUsers && plan.peakStepUnits >= 3000;
  const isManySteps = plan.chunkCount >= 5;
  const sliceSeqText = `[${plan.slices.map((s) => s.prefillTokens).join(", ")}]`;
  const costSeqText = `[${plan.slices.map((s) => s.stepCostUnits).join(", ")}]`;

  const colGap = 8;
  const slotTotalW = 800;
  const colW = (slotTotalW - (plan.chunkCount - 1) * colGap) / plan.chunkCount;
  const axisX0 = 84;
  const axisW = 668;
  let accUnits = 0;
  const timeSegments = plan.slices.map((s) => {
    const x0 = axisX0 + (accUnits / plan.totalTtftUnits) * axisW;
    accUnits += s.stepCostUnits;
    const x1 = axisX0 + (accUnits / plan.totalTtftUnits) * axisW;
    return { slice: s, x0, x1, w: Math.max(4, x1 - x0) };
  });

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
      kickerTitle="Chunked Prefill（分块预填充与流式吐字跷跷板）"
      question="一条 4096 字长提问突然插队，怎么才能不让正在聊天的老用户卡顿？"
      toolbarLabel="Chunked Prefill 预算与并发跷跷板控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-budget": budget,
        "data-decode": decodeConcurrency,
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="单步批预算 max_num_batched_tokens">
            <label htmlFor={sliderId} className="wiki-edu-slider-chip">
              <span>{`单步预算 ${budget}`}</span>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={CHUNKED_BUDGET_OPTIONS.length - 1}
                step={1}
                value={budgetIdx}
                data-testid="chunked-budget-slider"
                aria-valuetext={`${budget} tokens`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => {
                  const next = CHUNKED_BUDGET_OPTIONS[Number(e.target.value)];
                  if (next !== undefined) applyBudget(next);
                }}
              />
            </label>
            {CHUNKED_BUDGET_OPTIONS.map((opt) => {
              const active = mode === "sandbox" && budget === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`chunked-budget-${opt}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => applyBudget(opt)}
                >
                  {opt === 2048 ? "2048 (默认)" : `${opt}`}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="在聊老用户数">
            {DECODE_CONCURRENCY_OPTIONS.map((dec) => {
              const active = mode === "sandbox" && decodeConcurrency === dec;
              return (
                <button
                  key={dec}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`chunked-decode-${dec}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => applyDecode(dec)}
                >
                  {`老用户 ${dec} 人`}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={`${plan.chunkCount} 步算完长文`}
      takeawayTone={isDecodeStalled ? "danger" : isManySteps ? "warn" : "default"}
      takeaway={
        isDecodeStalled ? (
          <>
            <strong>预算开太大（{plan.budget}）</strong>：每步先扣{" "}
            <strong>{`${plan.decodeSlotsPerStep} 个老用户槽位`}</strong>后，长文切为{" "}
            <span className="mono">{sliceSeqText}</span>（第 {plan.chunkCount} 步才发首 token）；第 1 步塞入{" "}
            <strong>{`${firstChunk} 字`}</strong>（模拟成本 <strong>{plan.peakStepUnits}</strong>
            ），同车老用户明显卡顿！
          </>
        ) : !hasDecodeUsers && plan.chunkCount === 1 ? (
          <>
            <strong>零并发独占预填充（D=0）</strong>：当前无在跑老用户（老请求 ITL 无样本），4096 字新长文{" "}
            <strong>1 步全量算完</strong>（模拟成本 <strong>{plan.totalTtftUnits}</strong>）直出首 token。
          </>
        ) : isManySteps ? (
          <>
            <strong>预算切很薄（{plan.budget}）</strong>：
            {hasDecodeUsers
              ? `单步峰值成本压低至 ${plan.peakStepUnits}，老用户吐字极丝滑，但 `
              : "当前无在跑老用户（老请求 ITL 无样本），"}
            4096 字长文被切成 <strong>{`${plan.chunkCount} 步`}</strong>（累计等待{" "}
            <strong>{plan.totalTtftUnits}</strong>）才发出首 token。
          </>
        ) : (
          <>
            <strong>折中甜点档（{plan.budget}）</strong>：
            {hasDecodeUsers ? (
              <>
                每步先保 <strong>{`${plan.decodeSlotsPerStep} 位老用户`}</strong>各吐 1 字（峰值步成本{" "}
                <strong>{plan.peakStepUnits}</strong>），余下{" "}
                <strong>{`${plan.prefillCapacityPerStep} 格`}</strong>切给长文，分 {plan.chunkCount} 步发出首
                token。
              </>
            ) : (
              <>
                当前无在跑老用户（老请求 ITL 无样本），每步切{" "}
                <strong>{`${plan.prefillCapacityPerStep} 格`}</strong>
                ，分 {plan.chunkCount} 步（累计成本 <strong>{plan.totalTtftUnits}</strong>）发出首 token。
              </>
            )}
          </>
        )
      }
      kpi={`切片 ${sliceSeqText} · 共 ${plan.chunkCount} 步 · TTFT ${plan.totalTtftUnits}`}
      detailsSummary="查看工程与源码细节（max_num_batched_tokens 扣减与跨步 KV 重读）"
      detailsContent={
        <>
          单步预算 <code>max_num_batched_tokens = {plan.budget}</code> 先扣减在跑 Decode 槽位（
          {plan.decodeSlotsPerStep}），每步最多切 <code>{plan.prefillCapacityPerStep}</code> token
          给新提示词：4096 token 切分序列为{" "}
          <code>[{plan.slices.map((s) => s.prefillTokens).join(" + ")}]</code>，仅第 {plan.chunkCount}{" "}
          步末尾产出首字，跨步累计逻辑历史读取 {plan.cumulativeHistoryPositions} 个位置（
          {(plan.cumulativeHistoryPositions / NEW_PROMPT_TOKENS).toFixed(2)}×）。
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <svg
          viewBox="0 0 840 246"
          width="840"
          height="246"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`Chunked Prefill 双轨图：预算 ${plan.budget}，老用户 ${plan.decodeSlotsPerStep} 人，切 ${plan.chunkCount} 步`}
        >
          <defs>
            <marker
              id={mFirstTok}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="#e85b32" />
            </marker>
          </defs>

          <rect
            x="10"
            y="8"
            width="820"
            height="114"
            rx="9"
            fill="#fbfaf6"
            stroke="#d8d8cf"
            strokeWidth="1.3"
          />
          <text x="20" y="28" fontSize="12.5" fontWeight="700" fill="#17211f">
            ① 上轨：每步批预算槽位（Decode 优先 + Prefill + 剩余空槽）
          </text>
          <text x="820" y="28" textAnchor="end" fontSize="12" fontWeight="700" fill="#4c65b6">
            {`B=${plan.budget} · 共 ${plan.chunkCount} 步`}
          </text>

          {plan.slices.map((s, idx) => {
            const x = 20 + idx * (colW + colGap);
            const cx = Number((x + colW / 2).toFixed(1));
            const boxH = 54;
            const boxY = 40;
            const slack = Math.max(0, plan.budget - s.decodeTokens - s.prefillTokens);
            const decH = s.decodeTokens > 0 ? Math.max(8, (s.decodeTokens / plan.budget) * boxH) : 0;
            const prefH = Math.max(8, Math.min(boxH - decH, (s.prefillTokens / plan.budget) * boxH));
            const slackH = Math.max(0, boxH - decH - prefH);
            return (
              <g key={s.stepIndex}>
                {slackH > 0 && <rect x={x} y={boxY} width={colW} height={slackH} fill="#ece9df" />}
                <rect
                  x={x}
                  y={boxY + slackH}
                  width={colW}
                  height={prefH}
                  fill={isDecodeStalled && idx === 0 ? "#fff0e9" : "#e8edff"}
                />
                {decH > 0 && (
                  <rect x={x} y={boxY + slackH + prefH} width={colW} height={decH} fill="#ddf4ef" />
                )}
                <rect
                  x={x}
                  y={boxY}
                  width={colW}
                  height={boxH}
                  rx="5"
                  fill="none"
                  stroke={s.emitsFirstToken ? "#e85b32" : "#4c65b6"}
                  strokeWidth={s.emitsFirstToken ? "1.8" : "1.3"}
                />
                <text x={cx} y="62" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  {`S${s.stepIndex}`}
                </text>
                <text x={cx} y="83" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
                  {`${s.prefillTokens}`}
                </text>
                <text x={cx} y="112" textAnchor="middle" fontSize="12" fill="#66716d">
                  {plan.chunkCount <= 4 ? `D${s.decodeTokens}·余${slack}` : `D${s.decodeTokens}`}
                </text>
              </g>
            );
          })}

          <rect
            x="10"
            y="130"
            width="820"
            height="108"
            rx="9"
            fill="#fbfaf6"
            stroke="#d8d8cf"
            strokeWidth="1.3"
          />
          <text x="20" y="150" fontSize="12.5" fontWeight="700" fill="#17211f">
            ② 下轨：模拟耗时轴（老请求吐字点 ITL vs 新请求首字 TTFT）
          </text>
          <text
            x="820"
            y="150"
            textAnchor="end"
            fontSize="12"
            fontWeight="700"
            fill={isDecodeStalled ? "#b54237" : "#087f73"}
          >
            {hasDecodeUsers ? `峰值步成本 ${plan.peakStepUnits}` : "老请求 ITL 无样本"}
          </text>

          <text x="20" y="181" fontSize="12" fontWeight="700" fill="#17211f">
            老请求
          </text>
          {!hasDecodeUsers ? (
            <g>
              <rect
                x={axisX0}
                y="163"
                width={axisW}
                height="26"
                rx="5"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeDasharray="5 3"
              />
              <text x={axisX0 + axisW / 2} y="181" textAnchor="middle" fontSize="12" fill="#66716d">
                D = 0：无在跑老请求（ITL 无样本）
              </text>
            </g>
          ) : (
            <g>
              {timeSegments.map(({ slice, x0, x1, w }) => {
                const highCost = slice.stepCostUnits >= 3000;
                return (
                  <g key={slice.stepIndex}>
                    <rect
                      x={x0}
                      y="163"
                      width={w}
                      height="26"
                      rx="4"
                      fill={highCost ? "#fff0e9" : "#ddf4ef"}
                      stroke={highCost ? "#b54237" : "#087f73"}
                      strokeWidth="1.3"
                    />
                    <circle cx={x1} cy="176" r="4.5" fill={highCost ? "#b54237" : "#087f73"} />
                  </g>
                );
              })}
              <text x="760" y="181" fontSize="12" fontWeight="700" fill="#087f73">
                吐字点
              </text>
            </g>
          )}

          <text x="20" y="220" fontSize="12" fontWeight="700" fill="#17211f">
            新长文
          </text>
          {timeSegments.map(({ slice, x0, w }) => (
            <g key={slice.stepIndex}>
              <rect
                x={x0}
                y="202"
                width={w}
                height="26"
                rx="4"
                fill={slice.emitsFirstToken ? "#fff0e9" : "#e8edff"}
                stroke={slice.emitsFirstToken ? "#e85b32" : "#4c65b6"}
                strokeWidth="1.4"
              />
              {w >= 58 && (
                <text
                  x={x0 + w / 2}
                  y="220"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#17211f"
                >
                  {`${slice.stepCostUnits}`}
                </text>
              )}
            </g>
          ))}
          <line
            x1={axisX0 + axisW - 14}
            y1="215"
            x2={axisX0 + axisW + 4}
            y2="215"
            stroke="#e85b32"
            strokeWidth="1.8"
            markerEnd={`url(#${mFirstTok})`}
          />
          <text x="762" y="220" fontSize="12" fontWeight="700" fill="#e85b32">
            {`首字S${plan.chunkCount}`}
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className={`wiki-edu-note-card${isDecodeStalled ? " is-oom" : ""}`}>
            <strong>老请求 ITL 口径</strong>：
            {hasDecodeUsers
              ? `每步 ${plan.decodeSlotsPerStep} 位老用户优先占槽，各步模拟成本序列 ${costSeqText}（峰值 ${plan.peakStepUnits}）。`
              : "D = 0 无在跑 Decode 请求，老请求 ITL 无样本，预算全部供新长文使用。"}
          </div>
          <div className="wiki-edu-note-card">
            <strong>新长文 TTFT 口径</strong>：4096 字切分为 <span className="mono">{sliceSeqText}</span>，第{" "}
            <strong>{plan.chunkCount}</strong> 步末尾发出首 token（累计等待成本{" "}
            <strong>{plan.totalTtftUnits}</strong>）。
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
