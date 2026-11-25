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

  const firstChunk = plan.slices[0]!.prefillTokens;
  const decodeFlex = Math.max(0.18, plan.decodeSlotsPerStep / plan.budget);
  const prefillFlex = Math.max(0.35, firstChunk / plan.budget);
  const isStall = plan.budget >= 4096;
  const isManySteps = plan.chunkCount >= 5;

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
      takeawayTone={isStall ? "danger" : isManySteps ? "warn" : "default"}
      takeaway={
        isStall ? (
          <>
            <strong>预算开太大（4096）</strong>：新长文 1 步全吞完，首字最快，但同车的{" "}
            <strong>{`${plan.decodeSlotsPerStep} 位老用户`}</strong>被迫陪等一整篇长文，流式打字明显卡顿！
          </>
        ) : isManySteps ? (
          <>
            <strong>预算切很薄（{plan.budget}）</strong>：老用户每步吐字极丝滑，但 4096 字长文被切成{" "}
            <strong>{`${plan.chunkCount} 步`}</strong>才吐出第 1 个字（首字变慢）。
          </>
        ) : (
          <>
            <strong>甜点折中档（{plan.budget}）</strong>：每步先保{" "}
            <strong>{`${plan.decodeSlotsPerStep} 位老用户`}</strong>各吐 1 字，剩余{" "}
            <strong>{`${plan.prefillCapacityPerStep} 格`}</strong>切给长文，分 {plan.chunkCount}{" "}
            步稳稳吐出首字。
          </>
        )
      }
      kpi={`每步留给长文 ${plan.prefillCapacityPerStep} 字 · 共 ${plan.chunkCount} 步`}
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
      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${isStall && plan.decodeSlotsPerStep > 0 ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 老用户打字体验（单步等待时长 ITL）</span>
            <span
              className={`wiki-edu-badge ${isStall ? "is-bad" : plan.budget <= 1024 ? "is-good" : "is-mid"}`}
            >
              {isStall ? "被长文堵住 · 明显卡顿" : plan.budget <= 1024 ? "极速小步 · 打字丝滑" : "折中平稳"}
            </span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>同一个 NPU 步里的名额分配</span>
              <span className="mono">{`总预算 ${plan.budget}`}</span>
            </div>
            <div className="wiki-edu-track">
              {plan.decodeSlotsPerStep > 0 && (
                <div className="wiki-edu-op is-full" style={{ flex: decodeFlex }}>
                  {`老用户 ${plan.decodeSlotsPerStep} 字`}
                </div>
              )}
              <div
                className={`wiki-edu-op ${isStall ? "is-bubble" : "is-piece"}`}
                style={{ flex: prefillFlex }}
              >
                {`新长文塞入 ${firstChunk} 字`}
              </div>
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>老用户屏幕上的流式蹦字感受</span>
              <span>每步陪跑越少越丝滑</span>
            </div>
            <div className="wiki-edu-track">
              {isStall ? (
                <>
                  <div className="wiki-edu-op is-full" style={{ flex: 0.5 }}>
                    字
                  </div>
                  <div className="wiki-edu-op is-bubble" style={{ flex: 2.2 }}>
                    ⏸ 干等 4096 字算完…
                  </div>
                  <div className="wiki-edu-op is-full" style={{ flex: 0.5 }}>
                    字
                  </div>
                </>
              ) : (
                <>
                  <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                    字 →
                  </div>
                  <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                    字 →
                  </div>
                  <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                    字 →
                  </div>
                  <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                    丝滑连贯
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="wiki-edu-note-card">
            老用户每步只需算 1 个字，但必须等<strong>同一批里塞进来的长文分块一起算完</strong>才能拿到结果。
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 4096 字新长文要切几步才吐首字（TTFT）</span>
            <span className={`wiki-edu-badge ${isManySteps ? "is-warn" : "is-good"}`}>
              {plan.chunkCount === 1 ? "1 步直出首字" : `切成 ${plan.chunkCount} 步完成`}
            </span>
          </div>

          <div className="wiki-edu-chunks-wrap">
            {plan.slices.map((slice) => (
              <div
                key={slice.stepIndex}
                className={`wiki-edu-chunk-pill${slice.emitsFirstToken ? " is-last" : ""}`}
              >
                <strong>{`第 ${slice.stepIndex} 步 · ${slice.prefillTokens} 字`}</strong>
                <span>{slice.emitsFirstToken ? "⚡ 吐出第 1 个字!" : "只攒历史 KV"}</span>
              </div>
            ))}
          </div>

          <div className="wiki-edu-note-card">
            {isManySteps
              ? `切成了 ${plan.chunkCount} 小块：虽然完全不卡老用户，但后面几块要反复回头读前面攒下的历史，新请求等首字变慢。`
              : plan.chunkCount === 1
                ? "1 步吃下整篇 4096 字：新请求首字最快，但会把单步耗时撑到最大。"
                : `切成 ${plan.chunkCount} 步：前 ${plan.chunkCount - 1} 步分段消化长文，第 ${plan.chunkCount} 步吐出首字，兼顾两边体验。`}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
