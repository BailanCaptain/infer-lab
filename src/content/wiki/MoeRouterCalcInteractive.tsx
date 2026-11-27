import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const MOE_ROUTER_CALC_APPROVED_SHA256 =
  "8f8aff05f5d90fdc65e84edd69280d4735f52ed6b8bf8b575cf1380a824f314e";
export const MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256 = MOE_ROUTER_CALC_APPROVED_SHA256;

export type MoeCalcStep = 1 | 2 | 3 | 4;
export type MoeCalcMode = "sandbox" | "svg";

export interface MoeExpertSlot {
  readonly id: 1 | 2 | 3 | 4 | 5 | 6;
  readonly logit: string;
  readonly prob: string;
  readonly selected: boolean;
  readonly normWeight: string | null;
  readonly outVec: string | null;
}

export const MOE_EXPERTS: readonly MoeExpertSlot[] = [
  { id: 1, logit: "0", prob: "0.07", selected: false, normWeight: null, outVec: null },
  { id: 2, logit: "2", prob: "0.55", selected: true, normWeight: "0.73", outVec: "[2, 0, 1, −1]" },
  { id: 3, logit: "1", prob: "0.20", selected: true, normWeight: "0.27", outVec: "[0, 1, 2, 1]" },
  { id: 4, logit: "0", prob: "0.07", selected: false, normWeight: null, outVec: null },
  { id: 5, logit: "−1", prob: "0.03", selected: false, normWeight: null, outVec: null },
  { id: 6, logit: "0", prob: "0.07", selected: false, normWeight: null, outVec: null },
];

export interface MoeStepSpec {
  readonly step: MoeCalcStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
}

export const MOE_CALC_STEPS: readonly MoeStepSpec[] = [
  {
    step: 1,
    shortBtn: "① Router 打分",
    badgeText: "步骤 1 / 4 · 门控线性点积",
    title: "动作 ① · Router 门控层给 6 位候选专家打出原始分数 z",
    takeaway:
      "4 维隐藏向量先过超轻量的门控层，给 6 位专家打出原始分 z = [0, 2, 1, 0, −1, 0]，专家本体还没动。",
    kpi: "z = [0, 2, 1, 0, −1, 0]",
    detail:
      "以 6 选 2 浓缩示意 Qwen3-30B-A3B 的 128 选 8 纯稀疏路由：router 只是 [H, E] 线性层（Qwen3-30B-A3B 为 [2048, 128]），在 FP32 精度下算出原始门控 logits z。",
  },
  {
    step: 2,
    shortBtn: "② Softmax 挑 Top-2",
    badgeText: "步骤 2 / 4 · 选人并重归一",
    title: "动作 ② · 全池 Softmax 转概率，挑出前 2 名并除以 0.75 重归一",
    takeaway:
      "挑出最高分专家 2 (0.55) 与专家 3 (0.20)，再除以两项之和 0.75 重归一为 [0.73, 0.27]，权重和严格等于 1.00！",
    kpi: "组合权重 [0.73, 0.27]（和=1）",
    detail:
      "标准 Softmax Top-k（norm_topk_prob = true，无路由校正偏置 b、无额外缩放因子）：p ≈ [0.07, 0.55, 0.20, 0.07, 0.03, 0.07]，取 Top-2 后 [0.55, 0.20] ÷ 0.75 = [0.73, 0.27]（对比 DeepSeek/GLM 用 sigmoid + 偏置选人 + 乘缩放因子）。",
  },
  {
    step: 3,
    shortBtn: "③ 仅激活专家计算",
    badgeText: "步骤 3 / 4 · 稀疏条件计算",
    title: "动作 ③ · 仅专家 2、专家 3 执行前馈矩阵乘，其余 4 位休眠跳过",
    takeaway: "6 位专家常驻显存，但本 token 只唤醒专家 2 和 3 做计算，直接省去 2/3 的前馈乘加开销！",
    kpi: "激活 2 / 6 专家（省 67% 算力）",
    detail:
      "专家 2 算出 E₂(x)=[2, 0, 1, −1]，专家 3 算出 E₃(x)=[0, 1, 2, 1]。落到 Qwen3-30B-A3B：每层 128 个专家（1.125 GiB）仅激活 8 个（6.25% = 1/16），全模型 30.5B 总参每 token 仅激活约 3.3B；但未激活专家权重仍占显存。",
  },
  {
    step: 4,
    shortBtn: "④ 按权重加权合回",
    badgeText: "步骤 4 / 4 · 加权归约输出",
    title: "动作 ④ · 0.73 × E₂(x) + 0.27 × E₃(x) 合回 [1.46, 0.27, 1.27, −0.46]",
    takeaway: "两份专家输出按 0.73 与 0.27 逐维相加，保持 4 维隐藏宽度原样交回主干（零共享专家分支）！",
    kpi: "输出 [1.46, 0.27, 1.27, −0.46]",
    detail:
      "逐维验算：第 1 维 0.73×2+0.27×0=1.46，第 2 维 0.27，第 3 维 0.73×1+0.27×2=1.27，第 4 维 −0.73+0.27=−0.46。Qwen3-30B-A3B 设 num_shared_experts=0，路由加权和即为整层 MoE 输出。",
  },
];

export const MOE_TOPK_OPTIONS = [1, 2, 3] as const;
export type MoeTopK = (typeof MOE_TOPK_OPTIONS)[number];

const EXPERT_BASE_VECS: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, readonly [number, number, number, number]>> = {
  1: [1, 1, 0, 0],
  2: [2, 0, 1, -1],
  3: [0, 1, 2, 1],
  4: [1, 0, -1, 2],
  5: [-1, 2, 0, 1],
  6: [0, -1, 1, 2],
};

const SUBSCRIPTS: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, string>> = {
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
};

function fmtMinusNum(val: number, decimals?: number): string {
  const clean = Math.abs(val) < 1e-9 ? 0 : val;
  const absStr =
    decimals !== undefined
      ? Math.abs(clean).toFixed(decimals)
      : Math.abs(clean - Math.round(clean)) < 1e-6
        ? `${Math.round(Math.abs(clean))}`
        : Math.abs(clean).toFixed(2);
  return clean < 0 ? `−${absStr}` : absStr;
}

export interface MoeComputedExpert {
  readonly id: 1 | 2 | 3 | 4 | 5 | 6;
  readonly logit: number;
  readonly logitText: string;
  readonly prob: number;
  readonly selected: boolean;
  readonly rankOrder: number | null;
  readonly normWeight: number;
  readonly vec: readonly [number, number, number, number];
  readonly compactVec: string;
}

export interface MoeRouterComputedState {
  readonly topK: MoeTopK;
  readonly e3Logit: number;
  readonly experts: readonly MoeComputedExpert[];
  readonly selectedOrdered: readonly MoeComputedExpert[];
  readonly outVec: readonly [number, number, number, number];
  readonly outVecDisplay: string;
  readonly outVecExact6: string;
  readonly weightsExact6: string;
}

export function computeMoeRouterCalcState(topK: MoeTopK, rawE3Logit: number): MoeRouterComputedState {
  const e3Logit = Math.min(4, Math.max(-2, Math.round(rawE3Logit)));
  const rawLogits: readonly [number, number, number, number, number, number] = [0, 2, e3Logit, 0, -1, 0];
  const maxZ = Math.max(...rawLogits);
  const exps = rawLogits.map((z) => Math.exp(z - maxZ));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sumExp);

  const ids = [1, 2, 3, 4, 5, 6] as const;
  const rankedIds = [...ids].sort((a, b) => {
    const diff = rawLogits[b - 1]! - rawLogits[a - 1]!;
    if (Math.abs(diff) > 1e-9) return diff;
    return a - b;
  });
  const pickedIds = rankedIds.slice(0, topK);
  const pickedSet = new Set<number>(pickedIds);
  const pickedProbSum = pickedIds.reduce((acc, id) => acc + probs[id - 1]!, 0);

  const experts: MoeComputedExpert[] = ids.map((id) => {
    const logit = rawLogits[id - 1]!;
    const prob = probs[id - 1]!;
    const selected = pickedSet.has(id);
    const rankIdx = pickedIds.indexOf(id);
    const normWeight = selected && pickedProbSum > 0 ? prob / pickedProbSum : 0;
    const vec = EXPERT_BASE_VECS[id];
    const compactVec = `[${vec.map((v) => fmtMinusNum(v)).join(",")}]`;
    return {
      id,
      logit,
      logitText: fmtMinusNum(logit),
      prob,
      selected,
      rankOrder: rankIdx >= 0 ? rankIdx : null,
      normWeight,
      vec,
      compactVec,
    };
  });

  const selectedOrdered = pickedIds.map((id) => experts[id - 1]!);
  const out0 = selectedOrdered.reduce((s, ex) => s + ex.normWeight * ex.vec[0], 0);
  const out1 = selectedOrdered.reduce((s, ex) => s + ex.normWeight * ex.vec[1], 0);
  const out2 = selectedOrdered.reduce((s, ex) => s + ex.normWeight * ex.vec[2], 0);
  const out3 = selectedOrdered.reduce((s, ex) => s + ex.normWeight * ex.vec[3], 0);
  const outVec: readonly [number, number, number, number] = [out0, out1, out2, out3];

  return {
    topK,
    e3Logit,
    experts,
    selectedOrdered,
    outVec,
    outVecDisplay: `[${outVec.map((v) => fmtMinusNum(v)).join(", ")}]`,
    outVecExact6: `[${outVec.map((v) => fmtMinusNum(v, 6)).join(", ")}]`,
    weightsExact6: `[${selectedOrdered.map((ex) => ex.normWeight.toFixed(6)).join(", ")}]`,
  };
}

export interface MoeRouterCalcInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MoeCalcMode | undefined;
  readonly initialStep?: MoeCalcStep | undefined;
  readonly initialTopK?: MoeTopK | undefined;
  readonly initialE3Logit?: number | undefined;
}

export function MoeRouterCalcInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
  initialTopK = 2,
  initialE3Logit = 1,
}: MoeRouterCalcInteractiveProps) {
  const [mode, setMode] = useState<MoeCalcMode>(initialMode);
  const [step, setStep] = useState<MoeCalcStep>(initialStep);
  const [topK, setTopK] = useState<MoeTopK>(initialTopK);
  const [e3Logit, setE3Logit] = useState<number>(initialE3Logit);
  const [playing, setPlaying] = useState(false);
  const spec = MOE_CALC_STEPS[step - 1]!;
  const calc = useMemo(() => computeMoeRouterCalcState(topK, e3Logit), [topK, e3Logit]);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-moe-teal`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as MoeCalcStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: MoeCalcStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
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
      case "ArrowRight":
        event.preventDefault();
        selectStep(Math.min(4, step + 1) as MoeCalcStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as MoeCalcStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as MoeCalcStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const applyTopK = (nextK: MoeTopK) => {
    setPlaying(false);
    setMode("sandbox");
    setTopK(nextK);
    if (step < 2) setStep(2);
  };

  const applyE3Logit = (nextZ: number) => {
    setPlaying(false);
    setMode("sandbox");
    setE3Logit(Math.min(4, Math.max(-2, Math.round(nextZ))));
  };

  const selNames = calc.selectedOrdered.map((e) => `专家 ${e.id}`).join("、");
  const selWeightsText = calc.selectedOrdered.map((e) => e.normWeight.toFixed(2)).join(", ");
  const isDefaultMoe = calc.topK === 2 && calc.e3Logit === 1;
  const liveTakeaway = isDefaultMoe
    ? spec.takeaway
    : step === 1
      ? `门控层给 6 位候选专家打出当前原始分 z = [${calc.experts.map((e) => e.logitText).join(", ")}]，专家矩阵尚未启动。`
      : step === 2
        ? `全池 Softmax 后按 Top-${calc.topK} 选出 ${selNames}，重归一权重 [${selWeightsText}]（权重和 = 1.00，等分按专家 ID 优先）！`
        : step === 3
          ? `6 位专家常驻显存，本词仅唤醒 ${selNames}（共 ${calc.topK} 位）执行矩阵乘，跳过其余 ${6 - calc.topK} 位休眠专家！`
          : calc.topK === 1
            ? `单选 ${selNames}（重归一权重 1.00）直接输出 ${calc.outVecDisplay} 交回主干（零共享专家分支）！`
            : `${calc.topK} 份入选专家输出按权重 [${selWeightsText}] 逐维相加，合回 ${calc.outVecDisplay} 交回主干！`;

  const liveKpi =
    step === 1
      ? `z = [${calc.experts.map((e) => e.logitText).join(", ")}]`
      : step === 2
        ? `组合权重 [${calc.selectedOrdered.map((e) => e.normWeight.toFixed(2)).join(", ")}]（和=1）`
        : step === 3
          ? `激活 ${calc.topK} / 6 专家（跳过 ${6 - calc.topK} 位）`
          : `输出 ${calc.outVecDisplay}`;

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
      kickerTitle="稀疏 MoE 路由手算（Qwen3-30B-A3B 标准 Softmax Top-k）"
      question="一层放了上百个专家权重，为什么每个词算起来却跟小模型一样快？"
      toolbarLabel="MoE 路由打分与加权合回四步控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-topk": calc.topK,
        "data-e3-logit": calc.e3Logit,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="moe-calc-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "accent")}
              onClick={togglePlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as MoeCalcStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as MoeCalcStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="MoE 四步路由演化">
            {MOE_CALC_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`moe-calc-step-${item.step}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectStep(item.step)}
                >
                  {item.shortBtn}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="Top-k 与专家 3 分数实验">
            {MOE_TOPK_OPTIONS.map((k) => {
              const active = mode === "sandbox" && calc.topK === k;
              return (
                <button
                  key={k}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`moe-topk-${k}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => applyTopK(k)}
                >
                  {`Top-${k}`}
                </button>
              );
            })}
            <label htmlFor={sliderId} className="wiki-edu-slider-chip">
              <span className="mono">{`E3 分=${fmtMinusNum(calc.e3Logit)}`}</span>
              <input
                id={sliderId}
                type="range"
                min={-2}
                max={4}
                step={1}
                value={calc.e3Logit}
                data-testid="moe-e3-slider"
                aria-valuetext={`专家 3 门控分数 ${calc.e3Logit}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => applyE3Logit(Number(e.target.value))}
              />
            </label>
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step >= 3 ? "accent" : "default"}
      takeaway={liveTakeaway}
      kpi={liveKpi}
      detailsSummary="查看工程与源码细节（norm_topk_prob 重归一 / 128 选 8 参数账 / Sigmoid 变体对比）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail} 当前实时精算（6 位小数，等分按专家 ID 升序）：选中专家{" "}
          <code>[{calc.selectedOrdered.map((e) => `E${e.id}`).join(", ")}]</code>，重归一权重{" "}
          <code>{calc.weightsExact6}</code>，加权输出向量 <code>{calc.outVecExact6}</code>。
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <svg
          viewBox="0 0 820 242"
          width="820"
          height="242"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`MoE 6 专家概率条、Top-${calc.topK} 选路连线与加权汇聚`}
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
          </defs>

          {calc.experts.map((ex, idx) => {
            const rowY = 16 + idx * 36;
            const cy = rowY + 14;
            const barW = Number(Math.max(5, ex.prob * 130).toFixed(1));
            const isPicked = step >= 2 && ex.selected;
            const rowFill = isPicked ? "#ddf4ef" : step === 1 ? "#fbfaf6" : "#ece9df";
            const rowStroke = isPicked ? "#087f73" : "#d8d8cf";
            const barFill = isPicked ? "#087f73" : step === 1 ? "#4c65b6" : "#d8d8cf";
            return (
              <g key={ex.id}>
                <rect
                  x="14"
                  y={rowY}
                  width="302"
                  height="28"
                  rx="6"
                  fill={rowFill}
                  stroke={rowStroke}
                  strokeWidth={isPicked ? "1.6" : "1.2"}
                  opacity={step >= 2 && !ex.selected ? 0.65 : 1}
                />
                <text x="24" y={rowY + 19} fontSize="12" fontWeight="700" fill="#17211f">
                  {`E${ex.id} z=${ex.logitText}`}
                </text>
                <rect x="98" y={rowY + 7} width="132" height="14" rx="4" fill="#ffffff" stroke="#d8d8cf" />
                <rect x="98" y={rowY + 7} width={barW} height="14" rx="4" fill={barFill} />
                <text x="306" y={rowY + 19} textAnchor="end" fontSize="12" fontWeight="700" fill="#17211f">
                  {`p=${ex.prob.toFixed(2)}`}
                </text>
                {isPicked && ex.rankOrder !== null && (
                  <path
                    className={`wiki-edu-wire${step >= 4 ? " is-flow" : ""}`}
                    d={`M 318 ${cy} C 374 ${cy}, 380 ${35 + ex.rankOrder * 46}, 434 ${35 + ex.rankOrder * 46}`}
                    stroke="#087f73"
                    strokeWidth={Number((1.6 + ex.normWeight * 3.4).toFixed(1))}
                    markerEnd={`url(#${mTeal})`}
                  />
                )}
              </g>
            );
          })}

          {calc.selectedOrdered.map((sel, idx) => {
            const slotY = 16 + idx * 46;
            const slotCy = slotY + 19;
            const wText = sel.normWeight.toFixed(2);
            const label =
              step === 1
                ? `待选 Top-${idx + 1} 专家`
                : step === 2
                  ? `入选：专家 ${sel.id}（权 ${wText}）`
                  : `${wText} × E${SUBSCRIPTS[sel.id]} ${sel.compactVec}`;
            return (
              <g key={sel.id}>
                <rect
                  x="438"
                  y={slotY}
                  width="242"
                  height="38"
                  rx="7"
                  fill="#ddf4ef"
                  stroke="#087f73"
                  strokeWidth="1.5"
                />
                <text
                  x="559"
                  y={slotY + 24}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#17211f"
                >
                  {label}
                </text>
                <path
                  className={`wiki-edu-wire${step >= 4 ? " is-flow" : ""}`}
                  d={`M 682 ${slotCy} C 734 ${slotCy}, 744 150, 744 162`}
                  stroke={step >= 3 ? "#087f73" : "#d8d8cf"}
                  strokeWidth={step >= 3 ? Number((1.5 + sel.normWeight * 2.8).toFixed(1)) : 1.5}
                  markerEnd={`url(#${mTeal})`}
                />
              </g>
            );
          })}

          <rect
            x="438"
            y="166"
            width="368"
            height="60"
            rx="8"
            fill={step >= 4 ? "#fff4cf" : "#fbfaf6"}
            stroke={step >= 4 ? "#c78300" : "#d8d8cf"}
            strokeWidth="1.6"
          />
          <text x="622" y="191" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
            {step >= 4 ? calc.outVecDisplay : "等待加权相加 [1, 4]"}
          </text>
          <text x="622" y="213" textAnchor="middle" fontSize="12" fill="#66716d">
            {`Top-${calc.topK} 重归一和 = 1.00 · 跳过 ${6 - calc.topK} 位休眠专家`}
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">
            <strong>实时选路结果</strong>：当前选中{" "}
            <strong>{calc.selectedOrdered.map((e) => `专家 ${e.id}`).join("、")}</strong>，重归一权重{" "}
            <code>[{calc.selectedOrdered.map((e) => e.normWeight.toFixed(2)).join(", ")}]</code>（等分按专家
            ID 优先）。
          </div>
          <div className="wiki-edu-note-card">
            <strong>稀疏激活收益</strong>：<strong>{6 - calc.topK}</strong> 位落选专家零矩阵乘；
            {step >= 4 ? (
              <>
                加权合回主干得 <code>{calc.outVecDisplay}</code>。
              </>
            ) : (
              "切换到第 ④ 步查看逐维加权合回结果。"
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
