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
      "经残差连接、RMSNorm（layernorm.py#L37-L105）与 SiluAndMul MLP（activation.py#L116-L155）输出 [2, 4]；model_runner_v1.py 用 logits_indices 仅取末行 h₁ 乘 W_head 得 logits₁=[-0.4,-0.5,0.2,2.1,0.8,1.0]，贪心当场选出 3 号「猫」(2.1)。",
    kvStored: true,
    mlpDone: true,
    highlightMask: false,
  },
];

export interface RequestCausalKvMlpInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RequestLayerMode | undefined;
  readonly initialStep?: RequestLayerStep | undefined;
}

const RAIL_STAGES = [
  { stage: 1 as const, title: "① 拆 Q / K / V", sub: "输入 [2, 4] 投影" },
  { stage: 2 as const, title: "② 因果掩码融合", sub: "0 看 0 · 1 融 0+1" },
  { stage: 3 as const, title: "③ 写读 KV 池", sub: "保存 k₀,v₀,k₁,v₁" },
  { stage: 4 as const, title: "④ 残差与 MLP", sub: "末行 h₁ 送打分" },
];

export function RequestCausalKvMlpInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
}: RequestCausalKvMlpInteractiveProps) {
  const [mode, setMode] = useState<RequestLayerMode>(initialMode);
  const [step, setStep] = useState<RequestLayerStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = REQUEST_LAYER_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-req-teal`;
  const mIndigo = `${id}-${uid}-req-indigo`;

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
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="request-layer-autoplay"
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="单层前向四步演化">
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
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 4 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（Attention.forward / RMSNorm / logits_indices）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div>
        <div className="wiki-edu-rfork-rail">
          {RAIL_STAGES.map((st) => (
            <div
              key={st.stage}
              className={`wiki-edu-station ${st.stage <= step ? (st.stage === step ? "is-warn" : "is-pass") : "is-skip"}`}
            >
              <strong>{st.title}</strong>
              <span>{st.sub}</span>
            </div>
          ))}
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">因果掩码矩阵（谁能看谁）</span>
              <span className={`wiki-edu-badge ${spec.highlightMask ? "is-warn" : "is-good"}`}>
                {step === 1 ? "准备 q, k, v" : "右上角禁看后文"}
              </span>
            </div>
            <svg
              viewBox="0 0 380 156"
              width="380"
              height="156"
              style={{ width: "100%", height: "auto", display: "block" }}
              role="img"
              aria-label={`因果掩码与 KV 流向：${spec.title}`}
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
              </defs>
              <text x="142" y="20" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
                看 k₀「我」
              </text>
              <text x="242" y="20" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
                看 k₁「喜欢」
              </text>

              <text x="82" y="52" textAnchor="end" fontSize="13" fontWeight="700" fill="#17211f">
                0号 q₀
              </text>
              <rect
                x="94"
                y="30"
                width="96"
                height="36"
                rx="6"
                fill="#ddf4ef"
                stroke="#087f73"
                strokeWidth="1.5"
              />
              <text x="142" y="53" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087f73">
                ✓ 看自己
              </text>
              <rect
                x="194"
                y="30"
                width="96"
                height="36"
                rx="6"
                fill="#fff0e9"
                stroke="#b54237"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
              <text x="242" y="53" textAnchor="middle" fontSize="13" fontWeight="700" fill="#b54237">
                ✗ 禁看后文
              </text>
              <text x="300" y="53" fontSize="12" fontWeight="700" fill="#66716d">
                仅 v₀
              </text>

              <text x="82" y="96" textAnchor="end" fontSize="13" fontWeight="700" fill="#c78300">
                1号 q₁
              </text>
              <rect
                x="94"
                y="74"
                width="96"
                height="36"
                rx="6"
                fill="#fff4cf"
                stroke="#c78300"
                strokeWidth="1.5"
              />
              <text x="142" y="97" textAnchor="middle" fontSize="13" fontWeight="700" fill="#c78300">
                ✓ q₁·k₀
              </text>
              <rect
                x="194"
                y="74"
                width="96"
                height="36"
                rx="6"
                fill="#fff4cf"
                stroke="#c78300"
                strokeWidth="1.5"
              />
              <text x="242" y="97" textAnchor="middle" fontSize="13" fontWeight="700" fill="#c78300">
                ✓ q₁·k₁
              </text>
              <text x="300" y="97" fontSize="12" fontWeight="700" fill="#c78300">
                融 0+1
              </text>

              <path
                className={`wiki-edu-wire${step >= 3 ? " is-flow" : ""}`}
                d="M 192 114 L 192 146 L 356 146"
                stroke={step >= 3 ? "#4c65b6" : "#d8d8cf"}
                markerEnd={`url(#${step >= 3 ? mIndigo : mTeal})`}
              />
              <text x="184" y="142" textAnchor="end" fontSize="12" fontWeight="700" fill="#4c65b6">
                {step >= 3 ? "当场写入 KV 池" : "待写历史 KV"}
              </text>
            </svg>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">本层 KV 缓存池与出口向量</span>
              <span className={`wiki-edu-badge ${spec.mlpDone ? "is-good" : "is-mid"}`}>
                {spec.mlpDone ? "输出 h [2, 4]" : spec.kvStored ? "KV 已落盘" : "计算中"}
              </span>
            </div>

            <div className={`wiki-edu-block ${spec.kvStored ? "is-shared is-highlight" : "is-free"}`}>
              <div className="wiki-edu-block-id">KV</div>
              <div>
                <div className="wiki-edu-block-title">
                  {spec.kvStored ? "历史已存：k₀,v₀「我」+ k₁,v₁「喜欢」" : "本层 KV 槽位（等待写入）"}
                </div>
                <div className="wiki-edu-cells">
                  <span className={`wiki-edu-cell${spec.kvStored ? " fill-kv" : ""}`} />
                  <span className={`wiki-edu-cell${spec.kvStored ? " fill-kv" : ""}`} />
                  <span className="wiki-edu-cell" />
                  <span className="wiki-edu-cell" />
                </div>
              </div>
              <span className={`wiki-edu-ref-badge ${spec.kvStored ? "ref-1" : ""}`.trim()}>
                {spec.kvStored ? "2 格就绪" : "0 格"}
              </span>
            </div>

            <div className="wiki-edu-tok-list">
              <div className={`wiki-edu-tok-pill ${spec.mlpDone ? "is-empty" : "is-sys"}`}>
                <span>h₀ [1, 4] · 仅见「我」</span>
                <span className="wiki-edu-ptr-tag">{spec.mlpDone ? "留 KV 即完" : "逐位置加工"}</span>
              </div>
              <div className={`wiki-edu-tok-pill ${spec.mlpDone ? "is-sys is-hit" : "is-priv"}`}>
                <span>末行 h₁ [1, 4] · 融「我喜欢」</span>
                <span className="wiki-edu-ptr-tag">{spec.mlpDone ? "★ 选出「猫」" : "融合前文"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
