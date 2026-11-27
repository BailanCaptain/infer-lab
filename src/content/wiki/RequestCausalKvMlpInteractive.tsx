import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const REQUEST_CAUSAL_KV_MLP_APPROVED_SHA256 =
  "cda2f06596679f3818491af85d6d7a628e896f9986f57ebcf3eb21dcac929b4c";
export const REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256 = REQUEST_CAUSAL_KV_MLP_APPROVED_SHA256;

export type RequestLayerStep = 1 | 2 | 3 | 4;
export type RequestLayerMode = "sandbox" | "svg";

export interface RequestLayerStepSpec {
  readonly step: RequestLayerStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
  readonly kvStored: boolean;
  readonly mlpDone: boolean;
  readonly highlightMask: boolean;
}

export const REQUEST_LAYER_STEPS: readonly RequestLayerStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 输入拆 Q/K/V",
    badgeText: "步骤 1 / 4 · 线性投影",
    title: "动作 ① · 输入向量 [2, 4] 拆出查询 q、键 k、值 v",
    takeaway:
      "「我」「喜欢」两行 4 维向量进层后，各自算出查询 q（找什么）、键 k（检索标签）与值 v（位置内容）。",
    kpi: "输入 [2, 4] → Q / K / V",
    detail:
      "Prefill 首轮把位置 0「我」(token 0) 与位置 1「喜欢」(token 2) 拼成 [2, 4] 送入第 1 层；QKV 投影把孤立词向量拆成三路角色，准备按上下文交互。",
    kvStored: false,
    mlpDone: false,
    highlightMask: false,
  },
  {
    step: 2,
    shortBtn: "② 因果掩码注意力",
    badgeText: "步骤 2 / 4 · 只看前文",
    title: "动作 ② · 因果掩码限制视野：0 号只看 0，1 号融合 0 + 1",
    takeaway:
      "写文章时后词未出：0 号「我」禁看 1 号；1 号「喜欢」用 q₁ 同时看 k₀、k₁，把「我」融入「喜欢」！",
    kpi: "q₀ 看 1 格 · q₁ 融 2 格",
    detail:
      "因果掩码（Causal Mask）屏蔽右上角未来位置（q₀·k₁ 禁看），保证前面位置的表示永不被后文篡改——这正是后续 Decode 无需重算旧位置的数学前提。",
    kvStored: false,
    mlpDone: false,
    highlightMask: true,
  },
  {
    step: 3,
    shortBtn: "③ 当场写读 KV",
    badgeText: "步骤 3 / 4 · 落盘历史",
    title: "动作 ③ · 把 k₀, v₀ 与 k₁, v₁ 当场写入本层 KV cache",
    takeaway: "算完注意力的同时，把两格的 k 和 v 原地存进本层 KV 缓存池，下一轮生成新词时直接读取复用。",
    kpi: "KV 池存入 2 个历史位置",
    detail:
      "Attention.forward（attention.py#L485-L530）结合 attn_metadata 将本轮算出的 k₀, k₁, v₀, v₁ 写入本层 kv_cache；下一轮 Decode 只送 1 个新词即可回头读历史。",
    kvStored: true,
    mlpDone: false,
    highlightMask: false,
  },
  {
    step: 4,
    shortBtn: "④ 残差 MLP 输出",
    badgeText: "步骤 4 / 4 · 末行打分",
    title: "动作 ④ · 残差相加 + RMSNorm + MLP 输出 h [2, 4]，仅末行 h₁ 去打分",
    takeaway: "加回原输入防遗忘，经归一化和 MLP 逐位置加工得 h₀、h₁；穿完全层后只拿末行 h₁ 选出首词「猫」！",
    kpi: "仅末行 h₁ [1, 4] 送打分",
    detail:
      "经残差连接、RMSNorm（layernorm.py#L37-L105）与 SiluAndMul MLP（activation.py#L116-L155）输出 [2, 4]；model_runner_v1.py 用 logits_indices 仅取末行 h₁ [1, 4] 乘 W_head 得 logits₁=[-0.4,-0.5,0.2,2.1,0.8,1.0]，贪心当场选出 3 号「猫」(2.1)。",
    kvStored: true,
    mlpDone: true,
    highlightMask: false,
  },
];

export const REQUEST_PHASE_MODES = ["prefill", "decode"] as const;
export type RequestPhaseMode = (typeof REQUEST_PHASE_MODES)[number];
export type RequestContextLen = 2 | 3;

const ALL_DEMO_TOKENS = [
  { pos: 0, word: "我", vVal: 2 },
  { pos: 1, word: "很", vVal: 4 },
  { pos: 2, word: "喜欢", vVal: 8 },
  { pos: 3, word: "猫", vVal: 10 },
] as const;

const TWO_TOKEN_DEMO = [
  { pos: 0, word: "我", vVal: 2 },
  { pos: 1, word: "喜欢", vVal: 4 },
  { pos: 2, word: "猫", vVal: 8 },
] as const;

export interface RequestLayerDerivedState {
  readonly phase: RequestPhaseMode;
  readonly contextLen: RequestContextLen;
  readonly step: RequestLayerStep;
  readonly tokens: ReadonlyArray<{ readonly pos: number; readonly word: string; readonly vVal: number }>;
  readonly queryRows: readonly number[];
  readonly totalKvCols: number;
  readonly oldKvCols: number;
  readonly newKvWritten: number;
  readonly visibleCellCount: number;
  readonly maskedCellCount: number;
  readonly selectedQueryPos: number;
  readonly visibleValuesForSelected: readonly number[];
  readonly weightedOutput: number;
  readonly weightedOutputText: string;
  readonly nextTokenWord: string;
  readonly badgeText: string;
  readonly takeaway: string;
  readonly kpi: string;
}

export function computeRequestLayerState(
  phase: RequestPhaseMode,
  contextLen: RequestContextLen,
  step: RequestLayerStep,
  requestedQueryIdx?: number,
): RequestLayerDerivedState {
  const catalog = contextLen === 3 ? ALL_DEMO_TOKENS : TWO_TOKEN_DEMO;
  const totalKvCols = phase === "prefill" ? contextLen : contextLen + 1;
  const tokens = catalog.slice(0, totalKvCols);
  const queryRows: readonly number[] = phase === "prefill" ? tokens.map((t) => t.pos) : [contextLen];
  const oldKvCols = phase === "prefill" ? 0 : contextLen;
  const newKvWritten = phase === "prefill" ? contextLen : 1;
  const visibleCellCount = phase === "prefill" ? (contextLen * (contextLen + 1)) / 2 : totalKvCols;
  const maskedCellCount = phase === "prefill" ? contextLen * contextLen - visibleCellCount : 0;

  const fallbackPos = queryRows[queryRows.length - 1]!;
  const selectedQueryPos =
    requestedQueryIdx !== undefined && queryRows.includes(requestedQueryIdx)
      ? requestedQueryIdx
      : fallbackPos;

  const visibleValuesForSelected = tokens.slice(0, selectedQueryPos + 1).map((t) => t.vVal);
  const sumV = visibleValuesForSelected.reduce((acc, v) => acc + v, 0);
  const rawWeighted = sumV / visibleValuesForSelected.length;
  const weightedOutput = Number(rawWeighted.toFixed(2));
  const weightedOutputText = Number.isInteger(weightedOutput)
    ? String(weightedOutput)
    : weightedOutput.toFixed(2);
  const nextTokenWord = phase === "prefill" ? "猫" : "鱼";

  const baseSpec = REQUEST_LAYER_STEPS[step - 1]!;
  const phaseLabel =
    phase === "prefill" ? `Prefill (${contextLen}词并行)` : `Decode (第${totalKvCols}词增量)`;

  let kpi = baseSpec.kpi;
  let takeaway = baseSpec.takeaway;
  if (phase === "prefill" && contextLen === 3) {
    if (step === 1) {
      kpi = "输入 [3, 4] → 并行拆 3 组 Q/K/V";
      takeaway = "3 个提示词一次拼成 [3, 4] 并行进层，同时算出 3 组 q、k、v，算力密度远高于逐词计算。";
    } else if (step === 2) {
      kpi = `3×3 下三角 · 6 格可见 / 3 格屏蔽 · 焦点 q${selectedQueryPos} 加权=${weightedOutputText}`;
      takeaway = `3×3 因果掩码放行左下 6 格、屏蔽右上 3 格未来词；当前焦点 q${selectedQueryPos} 等权融合可见 V=[${visibleValuesForSelected.join(",")}] 得 ${weightedOutputText}。`;
    } else if (step === 3) {
      kpi = "一次写 3 格新 KV · 读 0 格旧 KV";
      takeaway = "Prefill 把 3 个位置的 k₀..k₂ 与 v₀..v₂ 一次性写入本层 KV 池，供后续 Decode 直接回头读取。";
    } else {
      kpi = `仅末行 h₂ [1, 4] 送打分 → ★ 选出「${nextTokenWord}」`;
      takeaway = `MLP 输出 [3, 4] 后前两行留好 KV 即退场，仅末行 h₂ [1, 4] 送词表头 ★ 选出「${nextTokenWord}」！`;
    }
  } else if (phase === "decode") {
    if (step === 1) {
      kpi = `输入 [1, 4] → 仅算新词 q${selectedQueryPos}, k${selectedQueryPos}, v${selectedQueryPos}`;
      takeaway = `Decode 每步只送刚生成的 1 个新词「${tokens[selectedQueryPos]!.word}」，绝不重算前 ${oldKvCols} 个历史词的 Q/K/V！`;
    } else if (step === 2) {
      kpi = `1×${totalKvCols} 查询全可见 · V=[${visibleValuesForSelected.join(",")}] 加权=${weightedOutputText}`;
      takeaway = `单行查询 1×${totalKvCols} 无未来词需屏蔽，若可见分数均为 0，对 V=[${visibleValuesForSelected.join(",")}] 等权求和得 ${weightedOutputText}！`;
    } else if (step === 3) {
      kpi = `只写 1 格新 KV · 复用 ${oldKvCols} 格历史 KV`;
      takeaway = `当场只写 1 格新 KV（槽 ${selectedQueryPos}），同时从缓存池拉取前 ${oldKvCols} 格旧 KV 拼齐 ${totalKvCols} 格上下文！`;
    } else {
      kpi = `单行 h${selectedQueryPos} [1, 4] 直送打分 → ★ 选出「${nextTokenWord}」`;
      takeaway = `Decode 本就只有 1 行输出 h${selectedQueryPos} [1, 4]，经残差与 MLP 后直接送词表头选出下一词「${nextTokenWord}」！`;
    }
  }

  return {
    phase,
    contextLen,
    step,
    tokens,
    queryRows,
    totalKvCols,
    oldKvCols,
    newKvWritten,
    visibleCellCount,
    maskedCellCount,
    selectedQueryPos,
    visibleValuesForSelected,
    weightedOutput,
    weightedOutputText,
    nextTokenWord,
    badgeText: `${phaseLabel} · 步骤 ${step} / 4`,
    takeaway,
    kpi,
  };
}

export interface RequestCausalKvMlpInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RequestLayerMode | undefined;
  readonly initialStep?: RequestLayerStep | undefined;
  readonly initialPhase?: RequestPhaseMode | undefined;
  readonly initialContextLen?: RequestContextLen | undefined;
  readonly initialQueryRow?: number | undefined;
}

export function RequestCausalKvMlpInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
  initialPhase = "prefill",
  initialContextLen = 3,
  initialQueryRow,
}: RequestCausalKvMlpInteractiveProps) {
  const [mode, setMode] = useState<RequestLayerMode>(initialMode);
  const [step, setStep] = useState<RequestLayerStep>(initialStep);
  const [phase, setPhase] = useState<RequestPhaseMode>(initialPhase);
  const [contextLen, setContextLen] = useState<RequestContextLen>(initialContextLen);
  const [queryRow, setQueryRow] = useState<number | undefined>(initialQueryRow);
  const [playing, setPlaying] = useState(false);

  const spec = REQUEST_LAYER_STEPS[step - 1]!;
  const derived = computeRequestLayerState(phase, contextLen, step, queryRow);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-req-teal`;
  const mIndigo = `${id}-${uid}-req-indigo`;
  const mAmber = `${id}-${uid}-req-amber`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as RequestLayerStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: RequestLayerStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const selectPhaseAndLen = (nextPhase: RequestPhaseMode, nextLen: RequestContextLen) => {
    setPlaying(false);
    setMode("sandbox");
    setPhase(nextPhase);
    setContextLen(nextLen);
    setQueryRow(undefined);
  };

  const togglePlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= 4) setStep(1);
    setPlaying(true);
  };

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
        selectStep(Math.min(4, step + 1) as RequestLayerStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as RequestLayerStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as RequestLayerStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={(next) => {
        setPlaying(false);
        setMode(next);
      }}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 A · 分步机制演化"
      kickerTitle="单层 Transformer 流转（因果掩码 · KV 缓存 · MLP）"
      question="提示词「我喜欢」进模型算了一整层，为什么最后只拿第 2 行去预测「猫」？"
      toolbarLabel="单层 Transformer 四步流转控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-phase": phase,
        "data-context-len": contextLen,
        "data-query-row": derived.selectedQueryPos,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="request-layer-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={togglePlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as RequestLayerStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as RequestLayerStep)}
            >
              下一步 ›
            </button>
            {REQUEST_LAYER_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`request-layer-step-${item.step}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectStep(item.step)}
                >
                  {item.shortBtn}
                </button>
              );
            })}
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="阶段模式与焦点查询行切换">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="request-phase-prefill-3"
              aria-pressed={mode === "sandbox" && phase === "prefill" && contextLen === 3}
              style={eduBtnStyle(mode === "sandbox" && phase === "prefill" && contextLen === 3, "dark")}
              onClick={() => selectPhaseAndLen("prefill", 3)}
            >
              Prefill (3词并行·3×3)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="request-phase-decode-4"
              aria-pressed={mode === "sandbox" && phase === "decode" && contextLen === 3}
              style={eduBtnStyle(mode === "sandbox" && phase === "decode" && contextLen === 3, "dark")}
              onClick={() => selectPhaseAndLen("decode", 3)}
            >
              Decode (第4词增量·1×4)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="request-phase-prefill-2"
              aria-pressed={mode === "sandbox" && phase === "prefill" && contextLen === 2}
              style={eduBtnStyle(mode === "sandbox" && phase === "prefill" && contextLen === 2, "dark")}
              onClick={() => selectPhaseAndLen("prefill", 2)}
            >
              2词基线 (2×2)
            </button>
            {derived.queryRows.map((qIdx) => {
              const qActive = mode === "sandbox" && derived.selectedQueryPos === qIdx;
              return (
                <button
                  key={`q-focus-${qIdx}`}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`request-query-row-${qIdx}`}
                  aria-pressed={qActive}
                  style={eduBtnStyle(qActive, "teal")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setQueryRow(qIdx);
                  }}
                >
                  {`焦点 q${qIdx}「${derived.tokens[qIdx]!.word}」`}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={derived.badgeText}
      takeawayTone={step === 4 ? "accent" : phase === "decode" ? "warn" : "default"}
      takeaway={derived.takeaway}
      kpi={derived.kpi}
      detailsSummary="查看工程与源码细节（Prefill 3×3 因果掩码 vs Decode 1×4 增量查询与末行选词）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}（当前演算：
          {phase === "prefill"
            ? `${contextLen} 词并行输入 [${contextLen}, 4]，${contextLen}×${contextLen} 下三角共 ${derived.visibleCellCount} 个可见格、一次写 ${derived.newKvWritten} 格 KV`
            : `第 ${derived.totalKvCols} 词增量 Decode 输入 [1, 4]，只写 1 格新 KV、复用 ${derived.oldKvCols} 格历史 KV，1×${derived.totalKvCols} 等分权重对 V=[${derived.visibleValuesForSelected.join(",")}] 求和得 ${derived.weightedOutputText}`}
          ）
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              {phase === "prefill"
                ? `因果掩码矩阵 (${contextLen}×${contextLen} 下三角) 与并行 KV 写入`
                : `Decode 增量查询 (1×${derived.totalKvCols}) 与历史 KV 复用`}
            </span>
            <span className={`wiki-edu-badge ${phase === "decode" ? "is-warn" : "is-good"}`}>
              {phase === "prefill"
                ? `${derived.visibleCellCount} 格可见 · 写 ${derived.newKvWritten} 格 KV`
                : `写 1 格新 KV · 读 ${derived.oldKvCols} 格旧 KV`}
            </span>
          </div>
          <svg
            viewBox="0 0 840 236"
            width="840"
            height="236"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`因果掩码与 KV 流向：${derived.badgeText}`}
          >
            <defs>
              <marker
                id={mTeal}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#087f73" />
              </marker>
              <marker
                id={mIndigo}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#4c65b6" />
              </marker>
              <marker
                id={mAmber}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#c78300" />
              </marker>
            </defs>

            {derived.tokens.map((tk, c) => {
              const colX = 88 + c * 90;
              return (
                <text
                  key={`col-hd-${tk.pos}`}
                  x={colX + 42}
                  y="22"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#66716d"
                >
                  {`k${c}「${tk.word}」V=${tk.vVal}`}
                </text>
              );
            })}

            {derived.queryRows.map((qPos, rIdx) => {
              const rowY = phase === "decode" ? 84 : 36 + rIdx * 48;
              const isFocus = qPos === derived.selectedQueryPos;
              return (
                <g key={`q-row-${qPos}`}>
                  <text
                    x="78"
                    y={rowY + 25}
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="700"
                    fill={isFocus ? "#c78300" : "#17211f"}
                  >
                    {`q${qPos}「${derived.tokens[qPos]!.word}」`}
                  </text>
                  {derived.tokens.map((tk, c) => {
                    const colX = 88 + c * 90;
                    const visible = c <= qPos;
                    const cellFill = !visible ? "#fff0e9" : isFocus ? "#fff4cf" : "#ddf4ef";
                    const cellStroke = !visible ? "#b54237" : isFocus ? "#c78300" : "#087f73";
                    return (
                      <g key={`cell-${qPos}-${tk.pos}`}>
                        <rect
                          x={colX}
                          y={rowY}
                          width="84"
                          height="40"
                          rx="6"
                          fill={cellFill}
                          stroke={cellStroke}
                          strokeWidth={isFocus && visible ? "1.9" : "1.4"}
                          strokeDasharray={visible ? undefined : "4 3"}
                        />
                        <text
                          x={colX + 42}
                          y={rowY + 25}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill={cellStroke}
                        >
                          {visible ? (isFocus ? `✓ 1/${qPos + 1}` : "✓ 可见") : "✗ 禁看"}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            <text x="260" y="208" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
              {phase === "prefill"
                ? `${contextLen}×${contextLen} 下三角：${derived.visibleCellCount} 格可见 · ${derived.maskedCellCount} 格未来词屏蔽`
                : `1×${derived.totalKvCols} 单行查询：无未来词需屏蔽 · 全 ${derived.totalKvCols} 格等分求和`}
            </text>

            <path
              className={`wiki-edu-wire${step >= 3 ? " is-flow" : ""}`}
              d="M 450 72 L 486 72"
              stroke={step >= 3 ? "#4c65b6" : "#087f73"}
              markerEnd={`url(#${step >= 3 ? mIndigo : mTeal})`}
            />
            <rect
              x="490"
              y="24"
              width="336"
              height="96"
              rx="8"
              fill="#fbfaf6"
              stroke="#4c65b6"
              strokeWidth="1.5"
            />
            <text x="658" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
              {phase === "decode"
                ? `本层 KV 池：读 ${derived.oldKvCols} 格旧 KV + 只写 1 格新 KV`
                : `本层 KV 池：一次写入 ${derived.newKvWritten} 格新 KV`}
            </text>
            {[0, 1, 2, 3].map((slotIdx) => {
              const sx = 504 + slotIdx * 79;
              const isOld = slotIdx < derived.oldKvCols;
              const isNew = slotIdx >= derived.oldKvCols && slotIdx < derived.totalKvCols;
              const activeKv = step >= 3 || isOld;
              const fill = isOld ? "#e8edff" : isNew && activeKv ? "#ddf4ef" : "#ffffff";
              const stroke = isOld ? "#4c65b6" : isNew && activeKv ? "#087f73" : "#d8d8cf";
              return (
                <g key={`kv-slot-${slotIdx}`}>
                  <rect
                    x={sx}
                    y="60"
                    width="72"
                    height="44"
                    rx="6"
                    fill={fill}
                    stroke={stroke}
                    strokeDasharray={isOld || isNew ? undefined : "4 2"}
                  />
                  <text x={sx + 36} y="87" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {isOld
                      ? `旧 KV${slotIdx}`
                      : isNew
                        ? step >= 3
                          ? `新 KV${slotIdx}`
                          : `待写${slotIdx}`
                        : `空槽${slotIdx}`}
                  </text>
                </g>
              );
            })}

            <path
              className={`wiki-edu-wire${step >= 4 ? " is-flow" : ""}`}
              d="M 450 176 L 486 176"
              stroke="#c78300"
              markerEnd={`url(#${mAmber})`}
            />
            <rect
              x="490"
              y="132"
              width="336"
              height="92"
              rx="8"
              fill="#fff4cf"
              stroke="#c78300"
              strokeWidth="1.6"
            />
            <text x="658" y="156" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`焦点 q${derived.selectedQueryPos} 加权求和：V=[${derived.visibleValuesForSelected.join(",")}] → ${derived.weightedOutputText}`}
            </text>
            <text x="658" y="182" textAnchor="middle" fontSize="12" fill="#66716d">
              {`可见分数均取 0 时 Softmax 权重各 1/${derived.visibleValuesForSelected.length}`}
            </text>
            <text
              x="658"
              y="208"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={derived.selectedQueryPos === derived.totalKvCols - 1 ? "#c78300" : "#66716d"}
            >
              {derived.selectedQueryPos === derived.totalKvCols - 1
                ? `★ 末位 h${derived.selectedQueryPos} [1, 4] 送打分 → ★ 选出「${derived.nextTokenWord}」`
                : `前序 h${derived.selectedQueryPos} [1, 4] 留存 KV 即退场 · 不送打分`}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">Prefill vs Decode 读写代价对照</span>
              <span className="wiki-edu-badge is-mid">
                {phase === "prefill" ? "并行建库期" : "增量复用期"}
              </span>
            </div>
            <div className="wiki-edu-tok-list">
              <div className={`wiki-edu-tok-pill ${phase === "prefill" ? "is-sys is-hit" : "is-empty"}`}>
                <span>{`Prefill (${contextLen}词并行)`}</span>
                <span className="wiki-edu-ptr-tag">{`${contextLen}×${contextLen} 掩码 · 写 ${contextLen} 格新 KV`}</span>
              </div>
              <div className={`wiki-edu-tok-pill ${phase === "decode" ? "is-sys is-hit" : "is-priv"}`}>
                <span>{`Decode (第${contextLen + 1}词增量)`}</span>
                <span className="wiki-edu-ptr-tag">{`1×${contextLen + 1} 查询 · 写 1 新读 ${contextLen} 旧`}</span>
              </div>
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">逐行出口去向（仅末行进词表头）</span>
              <span className={`wiki-edu-badge ${step === 4 ? "is-good" : "is-mid"}`}>
                {step === 4 ? "末行打分选词" : "逐位置前向"}
              </span>
            </div>
            <div className="wiki-edu-tok-list">
              {derived.queryRows.map((qPos) => {
                const isLast = qPos === derived.totalKvCols - 1;
                const isSelected = qPos === derived.selectedQueryPos;
                return (
                  <div
                    key={`exit-pill-${qPos}`}
                    className={`wiki-edu-tok-pill ${isLast && step === 4 ? "is-sys is-hit" : isSelected ? "is-priv" : "is-empty"}`}
                  >
                    <span>{`${isLast ? "末行 " : ""}h${qPos} [1, 4] · 「${derived.tokens[qPos]!.word}」`}</span>
                    <span className="wiki-edu-ptr-tag">
                      {isLast ? `★ 选出「${derived.nextTokenWord}」` : "留 KV 即退场"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
