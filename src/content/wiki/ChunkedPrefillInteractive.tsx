import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";

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
    // 示意耗时单位：固定步间调度/下发开销 + 本步计算位置数 + 前序已建 KV 历史重读开销
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
  initialMode = "svg",
  initialBudget = 2048,
  initialDecodeConcurrency = 8,
}: ChunkedPrefillInteractiveProps) {
  const [mode, setMode] = useState<ChunkedDiagramMode>(initialMode);
  const [budget, setBudget] = useState<ChunkedBudgetOption>(initialBudget);
  const [decodeConcurrency, setDecodeConcurrency] =
    useState<DecodeConcurrencyOption>(initialDecodeConcurrency);
  const sliderId = useId();
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
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
      const next = CHUNKED_BUDGET_OPTIONS[Math.min(3, budgetIdx + 1)]!;
      applyBudget(next);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const next = CHUNKED_BUDGET_OPTIONS[Math.max(0, budgetIdx - 1)]!;
      applyBudget(next);
    }
  };

  const rulerTotalPx = 836;
  const decodeWidthPx = Math.round((plan.decodeSlotsPerStep / plan.budget) * rulerTotalPx);
  const firstChunkTokens = plan.slices[0]!.prefillTokens;
  const prefillWidthPx = Math.max(
    12,
    Math.min(rulerTotalPx - decodeWidthPx, Math.round((firstChunkTokens / plan.budget) * rulerTotalPx)),
  );
  const slackWidthPx = Math.max(0, rulerTotalPx - decodeWidthPx - prefillWidthPx);

  // 时间轴最大参照尺度（512 预算 + 32 并发时约 7650 单位），让长短 TTFT 直观横向伸缩对照
  const timelineMaxRef = 7800;
  const timelineScale = 820 / timelineMaxRef;
  const itlRatio = Math.min(1, plan.peakStepUnits / 4400);
  const ttftRatio = Math.min(1, plan.totalTtftUnits / timelineMaxRef);

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-diagram-id={id}
      data-mode={mode}
      data-budget={budget}
      data-decode={decodeConcurrency}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="Chunked Prefill 预算与并发跷跷板控制"
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

        <fieldset className="wiki-diagram-step-group" aria-label="单步批预算 max_num_batched_tokens">
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
            <span>批预算</span>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={CHUNKED_BUDGET_OPTIONS.length - 1}
              step={1}
              value={budgetIdx}
              data-testid="chunked-budget-slider"
              aria-valuetext={`${budget} tokens`}
              style={{ width: "84px", accentColor: "var(--color-accent)", cursor: "pointer" }}
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
                className="wiki-diagram-step-btn"
                data-testid={`chunked-budget-${opt}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                style={stepBtnStyle(active)}
                onClick={() => applyBudget(opt)}
              >
                {opt === 2048 ? "2048 (默认)" : `${opt}`}
              </button>
            );
          })}
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="在跑 Decode 并发数">
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#66716d" }}>Decode 并发</span>
          {DECODE_CONCURRENCY_OPTIONS.map((dec) => {
            const active = mode === "sandbox" && decodeConcurrency === dec;
            return (
              <button
                key={dec}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`chunked-decode-${dec}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                style={stepBtnStyle(active)}
                onClick={() => applyDecode(dec)}
              >
                {`${dec} 条`}
              </button>
            );
          })}
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
              viewBox="0 0 880 398"
              width="880"
              height="398"
              role="img"
              aria-label={`Chunked Prefill 预算沙盘：预算 ${budget}，在跑 Decode ${decodeConcurrency} 条，4096 词分 ${plan.chunkCount} 步算完`}
              fontFamily="var(--font-sans)"
            >
              <title>{`预算 ${budget} · Decode ${decodeConcurrency} 条 · 4096 提示词切 ${plan.chunkCount} 步`}</title>

              {/* Zone 1: Single-step token_budget deduction bar */}
              <text x="22" y="24" fontSize="14.5" fontWeight="700" fill="#17211f">
                ① 单步预算扣减标尺（max_num_batched_tokens = {plan.budget}，新提示词 {NEW_PROMPT_TOKENS} tok）
              </text>
              <text
                x="858"
                y="24"
                textAnchor="end"
                fontSize="12.5"
                fontFamily="var(--font-mono)"
                fill="#66716d"
              >
                {`每步可切给 Prefill = ${plan.budget} − ${plan.decodeSlotsPerStep} = ${plan.prefillCapacityPerStep} tok`}
              </text>

              <rect
                x="22"
                y="36"
                width={rulerTotalPx}
                height="44"
                rx="6"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeWidth="1.2"
              />
              {decodeWidthPx > 0 && (
                <rect
                  x="22"
                  y="36"
                  width={Math.max(decodeWidthPx, 10)}
                  height="44"
                  rx="5"
                  fill="#ddf4ef"
                  stroke="#087f73"
                  strokeWidth="1.5"
                />
              )}
              <rect
                x={22 + decodeWidthPx}
                y="36"
                width={prefillWidthPx}
                height="44"
                rx="5"
                fill="#e8edff"
                stroke="#4c65b6"
                strokeWidth="1.5"
              />
              {slackWidthPx > 4 && (
                <rect
                  x={22 + decodeWidthPx + prefillWidthPx}
                  y="36"
                  width={slackWidthPx}
                  height="44"
                  rx="5"
                  fill="#ece9df"
                  stroke="#66716d"
                  strokeDasharray="4 3"
                />
              )}
              <text
                x={Math.max(82, 22 + decodeWidthPx / 2)}
                y="63"
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="700"
                fill="#087f73"
              >
                {plan.decodeSlotsPerStep > 0 ? `Decode 占 ${plan.decodeSlotsPerStep} 槽` : "Decode 0 槽"}
              </text>
              <text
                x={Math.max(210, 22 + decodeWidthPx + prefillWidthPx / 2)}
                y="63"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#4c65b6"
              >
                {`首步 Prefill 分块 ${firstChunkTokens} tok（共需 ${plan.chunkCount} 步切完 4096 tok）`}
              </text>

              {/* Zone 2: Proportional Multi-Step Chunk Timeline */}
              <text x="22" y="112" fontSize="14.5" fontWeight="700" fill="#17211f">
                ② 跨步比例时间条（单块宽度 ∝ 单步 ITL 耗时；整条总长 ∝ 新长请求首字 TTFT）
              </text>
              <rect
                x="22"
                y="124"
                width="836"
                height="78"
                rx="8"
                fill="#fbfaf6"
                stroke="#d8d8cf"
                strokeWidth="1.2"
              />

              {(() => {
                const gap = 4;
                const totalBandWidth = Math.min(
                  820,
                  Math.max(180, Math.round(plan.totalTtftUnits * timelineScale)),
                );
                const netBlocksWidth = totalBandWidth - (plan.chunkCount - 1) * gap;
                let cursorX = 30;
                return plan.slices.map((slice) => {
                  const w = Math.max(
                    38,
                    Math.round((slice.stepCostUnits / plan.totalTtftUnits) * netBlocksWidth),
                  );
                  const x = cursorX;
                  cursorX += w + gap;
                  const decSliver =
                    plan.decodeSlotsPerStep > 0
                      ? Math.min(
                          Math.max(
                            6,
                            Math.round((slice.decodeTokens / (slice.decodeTokens + slice.prefillTokens)) * w),
                          ),
                          Math.floor(w * 0.35),
                        )
                      : 0;
                  return (
                    <g key={slice.stepIndex}>
                      <rect
                        x={x}
                        y="134"
                        width={w}
                        height="58"
                        rx="6"
                        fill={slice.emitsFirstToken ? "#fff0e9" : "#e8edff"}
                        stroke={slice.emitsFirstToken ? "#e85b32" : "#4c65b6"}
                        strokeWidth={slice.emitsFirstToken ? "2" : "1.3"}
                      />
                      {decSliver > 0 && (
                        <rect
                          x={x}
                          y="134"
                          width={decSliver}
                          height="58"
                          rx="4"
                          fill="#ddf4ef"
                          stroke="#087f73"
                          strokeWidth="1"
                        />
                      )}
                      <text
                        x={x + w / 2}
                        y="155"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="var(--font-mono)"
                        fill="#17211f"
                      >
                        {`S${slice.stepIndex}:${slice.prefillTokens}`}
                      </text>
                      <text
                        x={x + w / 2}
                        y="178"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight={slice.emitsFirstToken ? "700" : "500"}
                        fill={slice.emitsFirstToken ? "#e85b32" : "#66716d"}
                      >
                        {slice.emitsFirstToken ? "出 y₀!" : w >= 68 ? "采样丢弃" : "续"}
                      </text>
                    </g>
                  );
                });
              })()}

              <text x="22" y="222" fontSize="12.5" fill="#66716d">
                {`切分明细：[ ${plan.slices.map((s) => s.prefillTokens).join(" + ")} ] = ${NEW_PROMPT_TOKENS} tok · 仅第 ${plan.chunkCount} 步末尾产出首字 y₀`}
              </text>

              {/* Zone 3: TTFT vs Decode ITL Trade-Off Seesaw Meters */}
              <rect
                x="22"
                y="242"
                width="406"
                height="138"
                rx="10"
                fill="#fbfaf6"
                stroke="#d8d8cf"
                strokeWidth="1.4"
              />
              <text x="38" y="268" fontSize="14" fontWeight="700" fill="#17211f">
                跷跷板左端 · 同批 Decode 单步耗时（ITL 间隔）
              </text>
              <text x="38" y="290" fontSize="12.5" fill="#66716d">
                {`峰值单步合成宽度 = ${plan.decodeSlotsPerStep} (Decode) + ${firstChunkTokens} (Prefill)`}
              </text>
              <rect x="38" y="304" width="374" height="24" rx="6" fill="#ece9df" />
              <rect
                x="38"
                y="304"
                width={Math.max(24, Math.round(374 * itlRatio))}
                height="24"
                rx="6"
                fill={plan.budget >= 4096 ? "#b54237" : plan.budget >= 2048 ? "#c78300" : "#087f73"}
              />
              <text
                x="38"
                y="352"
                fontSize="12.5"
                fontWeight="700"
                fill={plan.budget >= 4096 ? "#b54237" : "#17211f"}
              >
                {plan.budget >= 4096
                  ? "预算拉满：单步算满整条长文，同批流式吐字明显卡顿"
                  : plan.budget <= 1024
                    ? "小预算切薄单步：同批 Decode 吐字丝滑、激活峰值低"
                    : "默认 2048 折中档：兼顾同批 Decode 间隔与吞吐"}
              </text>

              <rect
                x="452"
                y="242"
                width="406"
                height="138"
                rx="10"
                fill="#fbfaf6"
                stroke="#d8d8cf"
                strokeWidth="1.4"
              />
              <text x="468" y="268" fontSize="14" fontWeight="700" fill="#17211f">
                跷跷板右端 · 长请求首字步数与重读（TTFT）
              </text>
              <text x="468" y="290" fontSize="12.5" fill="#66716d">
                {`跨 ${plan.chunkCount} 步完成 · 累计逻辑历史覆盖 ${plan.cumulativeHistoryPositions} 位置`}
              </text>
              <rect x="468" y="304" width="374" height="24" rx="6" fill="#ece9df" />
              <rect
                x="468"
                y="304"
                width={Math.max(24, Math.round(374 * ttftRatio))}
                height="24"
                rx="6"
                fill={plan.chunkCount >= 5 ? "#b54237" : "#4c65b6"}
              />
              <text
                x="468"
                y="352"
                fontSize="12.5"
                fontWeight="700"
                fill={plan.chunkCount >= 5 ? "#b54237" : "#4c65b6"}
              >
                {plan.chunkCount >= 5
                  ? `切碎成 ${plan.chunkCount} 步：后续分块反复重读前序 KV，TTFT 拉长`
                  : plan.chunkCount === 1
                    ? "1 步直出首字：零跨步重读，新长请求 TTFT 最短"
                    : `分 ${plan.chunkCount} 步完成：前 ${plan.chunkCount - 1} 步建历史，末步出 y₀`}
              </text>
            </svg>
          </div>
        )}
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {mode === "sandbox" ? (
          <>
            <span className="wiki-diagram-step-tag">{`${plan.chunkCount} 步切分`}</span>
            <strong className="wiki-diagram-step-title">
              {`批预算 ${plan.budget} · 在跑 Decode ${plan.decodeConcurrency} 条 → 每步剩 ${plan.prefillCapacityPerStep} 格给 Prefill`}
            </strong>
            <span className="wiki-diagram-step-detail">
              {`4096 token 新提示词按 [${plan.slices.map((s) => s.prefillTokens).join(", ")}] 切为 ${plan.chunkCount} 步，跨步逻辑历史覆盖合计 ${plan.cumulativeHistoryPositions} 个位置（${(plan.cumulativeHistoryPositions / NEW_PROMPT_TOKENS).toFixed(2)}×）；调小预算保同批 ITL，调大预算压新单 TTFT。`}
            </span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            当前展示审定原图；点击上方「切换交互沙盘 · 亲手试一试」或拨动批预算 / Decode 并发档位，实时推演
            4096 词长提示词的切块步数与 TTFT/ITL 跷跷板。
          </span>
        )}
      </output>
    </div>
  );
}
