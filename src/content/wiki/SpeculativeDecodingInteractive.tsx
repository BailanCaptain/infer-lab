import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const SPECULATIVE_DECODING_APPROVED_SHA256 =
  "5d8d6e36ca97828a56cf52f1d1a364e7c95187e0f8e85bf58b9067ba9bb92058";

export type SpecDecodeStep = 1 | 2 | 3 | 4;
export type SpecDecodeMode = "sandbox" | "svg";

export interface SpecVerifySlot {
  readonly pos: 5 | 6 | 7 | 8;
  readonly inputWord: string;
  readonly inputRole: string;
  readonly mainPred: string;
  readonly predTargetPos: 6 | 7 | 8 | 9;
  readonly verdict: "hit" | "mismatch" | "discard";
  readonly verdictLabel: string;
  readonly finalCommitted: string | null;
}

export const SPEC_VERIFY_SLOTS: readonly SpecVerifySlot[] = [
  {
    pos: 5,
    inputWord: "猫",
    inputRole: "已确定末词",
    mainPred: "坐",
    predTargetPos: 6,
    verdict: "hit",
    verdictLabel: "✓ 坐 = 候选1「坐」",
    finalCommitted: "坐（位置 6）",
  },
  {
    pos: 6,
    inputWord: "坐",
    inputRole: "草稿候选 1",
    mainPred: "在",
    predTargetPos: 7,
    verdict: "hit",
    verdictLabel: "✓ 在 = 候选2「在」",
    finalCommitted: "在（位置 7）",
  },
  {
    pos: 7,
    inputWord: "在",
    inputRole: "草稿候选 2",
    mainPred: "垫子",
    predTargetPos: 8,
    verdict: "mismatch",
    verdictLabel: "✗ 垫子 ≠ 候选3「床」",
    finalCommitted: "垫子（位置 8 · 主模型改写）",
  },
  {
    pos: 8,
    inputWord: "床",
    inputRole: "草稿候选 3",
    mainPred: "上",
    predTargetPos: 9,
    verdict: "discard",
    verdictLabel: "作废（读过错词「床」）",
    finalCommitted: null,
  },
];

export interface SpecDecodeStepSpec {
  readonly step: SpecDecodeStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
}

export const SPEC_DECODE_STEPS: readonly SpecDecodeStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 草稿连猜 3 词",
    badgeText: "步骤 1 / 4 · 便宜草拟",
    title: "动作 ① · 接在已确定「猫」后面，轻量草稿层快速连猜「坐、在、床」",
    takeaway: "大模型每步搬一遍权重太贵：先让超轻草稿层（如 MTP / EAGLE）顺着「猫」飞快往后猜出 3 个候选词。",
    kpi: "拼成 1 + 3 = 4 格待验",
    detail:
      "设已确定末词「猫」位于位置 5，草稿数 K = 3（猜位置 6「坐」、位置 7「在」、位置 8「床」）。单层 MTP 通过把同一预测层串行跑 3 遍产出 3 个候选。",
  },
  {
    step: 2,
    shortBtn: "② 主模型一次并验",
    badgeText: "步骤 2 / 4 · 单次前向",
    title: "动作 ② · 主模型只搬一次权重，把 [猫, 坐, 在, 床] 4 格并行算完",
    takeaway:
      "4 格一起送进主模型做 1 次并行前向！主模型在每一格都给出它认为的「下一格标准答案」：[坐, 在, 垫子, 上]。",
    kpi: "1 次前向产出 4 个预测",
    detail:
      "利用批内复用同一份权重的机会，1 次前向并行算出 4 个位置的预测：读「猫」预测位置 6 为「坐」，读「猫 坐」预测位置 7 为「在」，读「猫 坐 在」预测位置 8 为「垫子」。",
  },
  {
    step: 3,
    shortBtn: "③ 错开一格批改",
    badgeText: "步骤 3 / 4 · 逐位核对",
    title: "动作 ③ · 错位比对：前两词命中，第 3 格「垫子 ≠ 床」停笔，末格作废",
    takeaway:
      "前两格「坐」「在」全对！第 3 格主模型说「垫子」而草稿猜「床」——立刻在此停下，第 4 格因读过错词作废。",
    kpi: "命中 2 词 · 分歧停在位置 8",
    detail:
      "Greedy 下直接比相等；随机采样（T>0）则走拒绝采样 min(1, p(x)/q(x)) 与残差分布 norm(max(0, p-q)) 补抽，严格保持与主模型直接采样完全一致的输出分布（默认关闭有损的 block/entropy verify）。",
  },
  {
    step: 4,
    shortBtn: "④ 命中全收保底进 1",
    badgeText: "步骤 4 / 4 · 零损多进",
    title: "动作 ④ · 收下「坐、在」并在分歧点写主模型的「垫子」，一轮净出 3 词！",
    takeaway:
      "1 次主模型前向直接写下「坐、在、垫子」3 个词！就算第 1 词猜错也保底进 1 词；若 3 词全对更能白赚第 4 个奖励词！",
    kpi: "1 轮净写 3 词（保底 ≥1，封顶 4）",
    detail:
      "被拒位置 8 原先写下的「床」KV 无需擦除：调度器将已算计数从 9 退回 8，下一轮送入「垫子 + 新草稿（上 打 盹）」时直接在位置 8 原地覆写（KDA 等递推层则靠 K+1 份状态槽选回位置 7 状态）。",
  },
];

export interface SpeculativeDecodingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: SpecDecodeMode | undefined;
  readonly initialStep?: SpecDecodeStep | undefined;
}

export function SpeculativeDecodingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 3,
}: SpeculativeDecodingInteractiveProps) {
  const [mode, setMode] = useState<SpecDecodeMode>(initialMode);
  const [step, setStep] = useState<SpecDecodeStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = SPEC_DECODE_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-sd-teal`;
  const mRed = `${id}-${uid}-sd-red`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as SpecDecodeStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: SpecDecodeStep) => {
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
        selectStep(Math.min(4, step + 1) as SpecDecodeStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as SpecDecodeStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as SpecDecodeStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const colXs = [52, 150, 248, 346] as const;

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
      kickerTitle="Speculative Decoding（轻量连猜 K 词 + 主模型一次批改）"
      question="先让小草稿瞎猜后面几个词，万一猜错了会不会把最终回答带跑偏？"
      toolbarLabel="投机解码草拟与并行验证四步控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="spec-decode-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as SpecDecodeStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as SpecDecodeStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="投机解码四步循环">
            {SPEC_DECODE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`spec-decode-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（拒绝采样保分布证明 / 被拒 KV 原地覆写 / 加速盈亏比）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 错开一格并排批改（K = 3 候选）</span>
            <span className="wiki-edu-badge is-good">{step >= 2 ? "1 次并行前向" : "准备 1+3 格"}</span>
          </div>

          <svg
            viewBox="0 0 400 132"
            width="400"
            height="132"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`投机解码错位核对：${spec.title}`}
          >
            <defs>
              <marker
                id={mTeal}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#087f73" />
              </marker>
              <marker
                id={mRed}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
              </marker>
            </defs>
            {SPEC_VERIFY_SLOTS.map((slot, idx) => {
              const cx = colXs[idx]!;
              const isConfirmed = idx === 0;
              return (
                <g key={slot.pos}>
                  <rect
                    x={cx - 40}
                    y="8"
                    width="80"
                    height="36"
                    rx="6"
                    fill={isConfirmed ? "#ddf4ef" : "#fbfaf6"}
                    stroke="#087f73"
                    strokeWidth="1.4"
                    strokeDasharray={isConfirmed ? undefined : "4 3"}
                  />
                  <text x={cx} y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
                    {`${slot.pos}:${slot.inputWord}`}
                  </text>

                  <rect
                    x={cx - 40}
                    y="84"
                    width="80"
                    height="36"
                    rx="6"
                    fill={step >= 2 ? (idx === 3 && step >= 3 ? "#ece9df" : "#fff4cf") : "#fbfaf6"}
                    stroke={step >= 2 ? (idx === 3 && step >= 3 ? "#d8d8cf" : "#c78300") : "#d8d8cf"}
                    strokeWidth="1.4"
                  />
                  <text x={cx} y="107" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
                    {step >= 2 ? `预:${slot.mainPred}` : "待前向"}
                  </text>
                </g>
              );
            })}

            {step >= 3 && (
              <>
                <path
                  className="wiki-edu-wire"
                  d="M 150 44 L 58 82"
                  stroke="#087f73"
                  markerEnd={`url(#${mTeal})`}
                />
                <path
                  className="wiki-edu-wire"
                  d="M 248 44 L 156 82"
                  stroke="#087f73"
                  markerEnd={`url(#${mTeal})`}
                />
                <path
                  className="wiki-edu-wire"
                  d="M 346 44 L 254 82"
                  stroke="#b54237"
                  markerEnd={`url(#${mRed})`}
                />
              </>
            )}
          </svg>

          <div className="wiki-edu-note-card">
            永远由<strong>主模型拍板答案</strong>
            ：对上的本来就是主模型的预测；错的当场采用主模型在分歧位的直接修正词（本例「垫子」），零精度损失！
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 本轮批改结论与最终落盘</span>
            <span className="wiki-edu-badge is-mid">{step >= 4 ? "净写 3 词" : "逐格核对"}</span>
          </div>

          <div className="wiki-edu-tok-list">
            {SPEC_VERIFY_SLOTS.map((slot) => {
              const tone =
                step < 3
                  ? "is-sys"
                  : slot.verdict === "hit"
                    ? "is-priv"
                    : slot.verdict === "mismatch"
                      ? "is-sys is-hit"
                      : "is-empty";
              const rightTag =
                step < 3
                  ? slot.inputRole
                  : step === 3
                    ? slot.verdictLabel
                    : (slot.finalCommitted ?? "✗ 作废不写");
              return (
                <div key={slot.pos} className={`wiki-edu-tok-pill ${tone}`}>
                  <span>{`输入 ${slot.pos}「${slot.inputWord}」→ 预测 ${slot.predTargetPos}`}</span>
                  <span className="wiki-edu-ptr-tag">{rightTag}</span>
                </div>
              );
            })}
          </div>

          <div className="wiki-edu-note-card">
            <strong>被拒 KV 不擦除</strong>：已算进度从 <code>9</code> 退回 <code>8</code>，下一轮送入「垫子 +
            上 打 盹」时直接原地覆写位置 8。
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
