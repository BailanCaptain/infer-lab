import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const CONTINUOUS_BATCHING_TRACE_APPROVED_SHA256 =
  "59665c5ea371eb7a63f56b1d690a2510724330792f114809aaa87d5a4f24ff99";
export const CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256 = CONTINUOUS_BATCHING_TRACE_APPROVED_SHA256;

export type BatchTraceStep = 1 | 2 | 3 | 4;
export type BatchTraceMode = "sandbox" | "svg";

export interface BatchQueueItem {
  readonly name: string;
  readonly status: string;
  readonly tone: "is-sys" | "is-sys is-hit" | "is-priv" | "is-cow" | "is-empty";
}

export interface RaggedBatchSlice {
  readonly label: string;
  readonly tokens: number;
  readonly kind: "is-attn" | "is-full" | "is-piece" | "is-bubble";
}

export interface BatchTraceStepSpec {
  readonly step: BatchTraceStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
  readonly queryStartLoc: string;
  readonly budgetUsed: number;
  readonly exitedNote: string | null;
  readonly waitingList: readonly BatchQueueItem[];
  readonly runningList: readonly BatchQueueItem[];
  readonly batchSlices: readonly RaggedBatchSlice[];
}

export const BATCH_TRACE_STEPS: readonly BatchTraceStepSpec[] = [
  {
    step: 1,
    shortBtn: "① t=1 首批准入",
    badgeText: "迭代 t=1 · 无填充紧拼",
    title: "动作 ① · t=1 步首从 waiting 准入 R1(+3)、R2(+2)，一维紧拼 [5]",
    takeaway:
      "不用像静态批处理那样给短提示词补 <pad>：R1(3词) 与 R2(2词) 头尾紧挨拼成 [5]，步中 R3 到达门口排队。",
    kpi: "紧拼 [5] / 预算 8 · 零填充",
    detail:
      "教学设定 token_budget = 8（R1 提示3/生2，R2 提示2/生3，R3 提示4/生2）：t=1 步首 running 为空，接纳 R1、R2 转入 running，query_start_loc=[0, 3, 5]；步末两者各产出首词。",
    queryStartLoc: "[0, 3, 5]",
    budgetUsed: 5,
    exitedNote: null,
    waitingList: [{ name: "R3（提示 4 词）", status: "步中刚到达", tone: "is-sys" }],
    runningList: [
      { name: "R1（提示 3 → 得首词）", status: "占预算 3", tone: "is-priv" },
      { name: "R2（提示 2 → 得首词）", status: "占预算 2", tone: "is-priv" },
    ],
    batchSlices: [
      { label: "R1 提示 [3]", tokens: 3, kind: "is-attn" },
      { label: "R2 提示 [2]", tokens: 2, kind: "is-attn" },
    ],
  },
  {
    step: 2,
    shortBtn: "② t=2 老带新混跑",
    badgeText: "迭代 t=2 步首 · 新客插空补位",
    title: "动作 ② · 先保 running 老请求各续 1 词，再用余量把 R3(+4) 拉进同批混跑",
    takeaway:
      "没有纯 Prefill/Decode 切挡开关！先保 R1、R2 各续 1 词防卡顿，剩 6 格预算当场接纳新客 R3(4词) 同车混跑！",
    kpi: "P/D 混跑 [6] / 预算 8",
    detail:
      "Scheduler.schedule() 固定两趟扫描：第一趟先排 running（R1+1, R2+1 扣 2 剩 6），第二趟用剩余预算从 waiting 接纳 R3(+4)，统一按 num_tokens_with_spec - num_computed_tokens 算差额，query_start_loc=[0, 1, 2, 6]。",
    queryStartLoc: "[0, 1, 2, 6]",
    budgetUsed: 6,
    exitedNote: null,
    waitingList: [{ name: "waiting 队列已清空", status: "0 条排队", tone: "is-empty" }],
    runningList: [
      { name: "R1（续写第 2 词）", status: "优先 +1", tone: "is-priv" },
      { name: "R2（续写第 2 词）", status: "优先 +1", tone: "is-priv" },
      { name: "R3（新提示 4 词）", status: "余量准入 +4", tone: "is-sys is-hit" },
    ],
    batchSlices: [
      { label: "R1 [1]", tokens: 1, kind: "is-full" },
      { label: "R2 [1]", tokens: 1, kind: "is-full" },
      { label: "R3 提示 [4]", tokens: 4, kind: "is-piece" },
    ],
  },
  {
    step: 3,
    shortBtn: "③ t=2 完结当步释块",
    badgeText: "迭代 t=2 步末 · 即完即退",
    title: "动作 ③ · 短请求 R1 凑满 2 词命中停止条件，当步移出 running 并归还 KV 块",
    takeaway:
      "短请求 R1 吃完立刻买单离席！当步从 running 移除并释放 KV 块，只留 R2、R3 继续在跑，零空转陪跑。",
    kpi: "R1 已移出 running 释块 · 剩 2 条在跑",
    detail:
      "t=2 本步拼批仍为 [1, 1, 4]（query_start_loc=[0, 1, 2, 6]）；步末 update_from_output 调 check_stop 发现 R1 满 max_tokens=2，当场触发 remove_all 将 R1 移出 running 并归还物理 KV 块（running 仅剩 R2、R3）。",
    queryStartLoc: "[0, 1, 2, 6]",
    budgetUsed: 6,
    exitedNote: "⚡ 步末退场：R1 满 2 词已从 running 移除，KV 块当场归还池中！",
    waitingList: [{ name: "waiting 队列为空", status: "随时可接新单", tone: "is-empty" }],
    runningList: [
      { name: "R2（已生 2/3 词）", status: "留在 running", tone: "is-priv" },
      { name: "R3（已得首词 1/2）", status: "留在 running", tone: "is-priv" },
    ],
    batchSlices: [
      { label: "R1 [1] 完结", tokens: 1, kind: "is-bubble" },
      { label: "R2 [1]", tokens: 1, kind: "is-full" },
      { label: "R3 提示 [4]", tokens: 4, kind: "is-piece" },
    ],
  },
  {
    step: 4,
    shortBtn: "④ t=3 轻装收官",
    badgeText: "迭代 t=3 · 槽位已回收",
    title: "动作 ④ · t=3 仅剩 R2(+1)、R3(+1) 紧拼 [2] 续跑末词，步末双双完结",
    takeaway: "R1 腾出的槽位与显存块已回到池中；t=3 只算 R2、R3 最后各 1 词（紧拼 [2]），算完双双释块收官！",
    kpi: "纯生成 [2] · 全员零阻塞完结",
    detail:
      "t=3 query_start_loc=[0, 1, 2]；昇腾 ACLGraph 模式下若将 [2] 向上补齐图档位，尾部 slot_mapping 会填 -1 防止污染真实 KV 块，丝毫不影响请求按步动态进出。",
    queryStartLoc: "[0, 1, 2]",
    budgetUsed: 2,
    exitedNote: null,
    waitingList: [{ name: "waiting 队列为空", status: "无积压", tone: "is-empty" }],
    runningList: [
      { name: "R2（末词 3/3 完结）", status: "步末释块", tone: "is-priv" },
      { name: "R3（末词 2/2 完结）", status: "步末释块", tone: "is-priv" },
    ],
    batchSlices: [
      { label: "R2 末词 [1]", tokens: 1, kind: "is-full" },
      { label: "R3 末词 [1]", tokens: 1, kind: "is-full" },
    ],
  },
];

export interface ContinuousBatchingTraceInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: BatchTraceMode | undefined;
  readonly initialStep?: BatchTraceStep | undefined;
}

export function ContinuousBatchingTraceInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
}: ContinuousBatchingTraceInteractiveProps) {
  const [mode, setMode] = useState<BatchTraceMode>(initialMode);
  const [step, setStep] = useState<BatchTraceStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = BATCH_TRACE_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-cb-teal`;
  const mAccent = `${id}-${uid}-cb-accent`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as BatchTraceStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: BatchTraceStep) => {
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
        selectStep(Math.min(4, step + 1) as BatchTraceStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as BatchTraceStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as BatchTraceStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const budgetLeft = 8 - spec.budgetUsed;

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
      kickerTitle="Continuous Batching（waiting / running 两队列迭代追踪）"
      question="短请求两句话就答完了，为什么不用干等慢请求，还能让新客当场插空上车？"
      toolbarLabel="连续批处理两队列四步流转控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="cb-trace-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as BatchTraceStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as BatchTraceStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="连续批处理四步迭代">
            {BATCH_TRACE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`cb-trace-step-${item.step}`}
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
      takeawayTone={step === 2 || step === 3 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（统一进度差公式 / query_start_loc / LIFO 抢占与图补齐）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 双队列流转（先保在跑 · 余量接新）</span>
            <span className="wiki-edu-badge is-good">{`已用 ${spec.budgetUsed} / 8`}</span>
          </div>

          <div className="wiki-edu-col-title">
            <span>waiting 排队区</span>
            <span>余量准入</span>
          </div>
          <div className="wiki-edu-tok-list">
            {spec.waitingList.map((w) => (
              <div key={w.name} className={`wiki-edu-tok-pill ${w.tone}`}>
                <span>{w.name}</span>
                <span className="wiki-edu-ptr-tag">{w.status}</span>
              </div>
            ))}
          </div>

          <svg
            viewBox="0 0 380 34"
            width="380"
            height="34"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`队列准入流向：${spec.title}`}
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
                id={mAccent}
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
            <path
              className={`wiki-edu-wire${step === 2 ? " is-flow" : ""}`}
              d="M 190 4 L 190 28"
              stroke={step === 2 ? "#e85b32" : "#087f73"}
              markerEnd={`url(#${step === 2 ? mAccent : mTeal})`}
            />
            <text x="202" y="21" fontSize="12" fontWeight="700" fill="#17211f">
              {step === 2 ? "余量 6 接纳 R3 上车!" : step === 3 ? "R1 完结即刻释块" : "按步动态重排"}
            </text>
          </svg>

          <div className="wiki-edu-col-title">
            <span>running 活跃列表</span>
            <span>每步优先续跑</span>
          </div>
          <div className="wiki-edu-tok-list">
            {spec.runningList.map((r) => (
              <div key={r.name} className={`wiki-edu-tok-pill ${r.tone}`}>
                <span>{r.name}</span>
                <span className="wiki-edu-ptr-tag">{r.status}</span>
              </div>
            ))}
          </div>
          {spec.exitedNote && <div className="wiki-edu-cow-banner">{spec.exitedNote}</div>}
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 一维紧致拼批（零 &lt;pad&gt; 占位）</span>
            <span className="wiki-edu-badge is-mid">{`边界 ${spec.queryStartLoc}`}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>本步 NPU 实际计算条带</span>
              <span className="mono">{`合拼 [${spec.budgetUsed}] · 剩预算 ${budgetLeft}`}</span>
            </div>
            <div className="wiki-edu-track">
              {spec.batchSlices.map((s) => (
                <div key={s.label} className={`wiki-edu-op ${s.kind}`} style={{ flex: s.tokens }}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="wiki-edu-note-card">
            <strong>翻台零空泡</strong>：老请求续写 1
            词与新请求长提示词紧挨着拼进同一条一维向量；谁先遇到结束符谁<strong>当步买单释块</strong>
            ，新客下一步立刻补位！
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
