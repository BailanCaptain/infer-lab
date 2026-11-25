import { type KeyboardEvent, useEffect, useId, useState } from "react";
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

export interface MoeRouterCalcInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MoeCalcMode | undefined;
  readonly initialStep?: MoeCalcStep | undefined;
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
}: MoeRouterCalcInteractiveProps) {
  const [mode, setMode] = useState<MoeCalcMode>(initialMode);
  const [step, setStep] = useState<MoeCalcStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = MOE_CALC_STEPS[step - 1]!;
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
      extraRootAttrs={{ "data-step": step }}
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
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step >= 3 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（norm_topk_prob 重归一 / 128 选 8 参数账 / Sigmoid 变体对比）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">专家池（6 选 2 示意 128 选 8）</span>
            <span className="wiki-edu-badge is-good">{step === 1 ? "全池打分" : "挑出专家 2、专家 3"}</span>
          </div>

          <div className="wiki-edu-tok-list">
            {MOE_EXPERTS.map((ex) => {
              const tone =
                step === 1 ? "is-sys" : ex.selected ? (step >= 3 ? "is-sys is-hit" : "is-priv") : "is-empty";
              const tagText =
                step === 1
                  ? `z = ${ex.logit}`
                  : ex.selected
                    ? step >= 3
                      ? `⚡ 算得 ${ex.outVec}`
                      : `★ p=${ex.prob} → 权 ${ex.normWeight}`
                    : `p=${ex.prob} · 休眠跳过`;
              return (
                <div key={ex.id} className={`wiki-edu-tok-pill ${tone}`}>
                  <span>{`专家 ${ex.id}`}</span>
                  <span className="wiki-edu-ptr-tag">{tagText}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">重归一化与加权合回主干</span>
            <span className="wiki-edu-badge is-mid">{step === 4 ? "和 = 1.00 · 已合回" : "0 共享专家"}</span>
          </div>

          <svg
            viewBox="0 0 400 104"
            width="400"
            height="104"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`MoE 稀疏汇聚：${spec.title}`}
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
            <rect
              x="8"
              y="10"
              width="166"
              height="36"
              rx="7"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="91" y="33" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step >= 2 ? "0.73 × E₂ [2,0,1,−1]" : "待选 Top-1 专家"}
            </text>

            <rect
              x="8"
              y="58"
              width="166"
              height="36"
              rx="7"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="91" y="81" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step >= 2 ? "0.27 × E₃ [0,1,2,1]" : "待选 Top-2 专家"}
            </text>

            <path
              className={`wiki-edu-wire${step >= 4 ? " is-flow" : ""}`}
              d="M 176 28 C 204 28, 204 52, 226 52"
              stroke={step >= 3 ? "#087f73" : "#d8d8cf"}
              markerEnd={`url(#${mTeal})`}
            />
            <path
              className={`wiki-edu-wire${step >= 4 ? " is-flow" : ""}`}
              d="M 176 76 C 204 76, 204 52, 226 52"
              stroke={step >= 3 ? "#087f73" : "#d8d8cf"}
              markerEnd={`url(#${mTeal})`}
            />

            <rect
              x="230"
              y="26"
              width="162"
              height="52"
              rx="8"
              fill={step >= 4 ? "#fff4cf" : "#fbfaf6"}
              stroke={step >= 4 ? "#c78300" : "#d8d8cf"}
              strokeWidth="1.6"
            />
            <text x="311" y="48" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step >= 4 ? "[1.46, 0.27, 1.27, −0.46]" : "等待加权相加"}
            </text>
            <text x="311" y="67" textAnchor="middle" fontSize="12" fill="#66716d">
              {step >= 2 ? "重归一：(0.55+0.20)÷0.75" : "宽度不变 [1, 4]"}
            </text>
          </svg>

          <div className="wiki-edu-note-card">
            <strong>稀疏激活收益</strong>：4 位落选专家<strong>零矩阵乘</strong>；仅入选的 2 位专家输出按{" "}
            <strong>0.73 + 0.27 = 1.00</strong> 合回。
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
