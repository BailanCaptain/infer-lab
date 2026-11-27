import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
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

export const BATCH_BUDGET_OPTIONS = [8, 5] as const;
export type BatchBudgetOption = (typeof BATCH_BUDGET_OPTIONS)[number];

export interface ComputedBatchTraceState extends BatchTraceStepSpec {
  readonly budget: BatchBudgetOption;
  readonly offsets: readonly number[];
  readonly r3DeferredAtT2: boolean;
  readonly freedPoolText: string;
}

export function computeContinuousBatchTrace(
  step: BatchTraceStep = 2,
  budget: BatchBudgetOption = 8,
): ComputedBatchTraceState {
  if (budget === 8) {
    const base = BATCH_TRACE_STEPS[step - 1]!;
    const offsets = step === 1 ? [0, 3, 5] : step === 2 || step === 3 ? [0, 1, 2, 6] : [0, 1, 2];
    return {
      ...base,
      budget: 8,
      offsets,
      r3DeferredAtT2: false,
      freedPoolText:
        step === 3 ? "R1 完结 → 归还 KV 块" : step === 4 ? "R1 已释 · 步末 R2,R3 全释" : "在跑占块 · 0 退场",
    };
  }

  // Deterministic trace for tight budget = 5 (R1:3+2, R2:2+3, R3:4+2 arrives t=1 mid)
  if (step === 1) {
    return {
      ...BATCH_TRACE_STEPS[0]!,
      budget: 5,
      kpi: "紧拼 [5] / 预算 5 · 满载零填充",
      budgetUsed: 5,
      offsets: [0, 3, 5],
      r3DeferredAtT2: false,
      freedPoolText: "在跑占块 · 0 退场",
    };
  }
  if (step === 2) {
    return {
      step: 2,
      budget: 5,
      shortBtn: "② t=2 老带新混跑",
      badgeText: "迭代 t=2 步首 · 余量 3 不够 R3(4)",
      title: "动作 ② · 预算收紧为 5：先保 R1(+1)、R2(+1) 后仅剩 3 格，R3(4词) 暂留 waiting",
      takeaway:
        "预算从 8 收紧到 5：第一趟先保老请求 R1、R2 各续 1 词（剩 3 格），整条提示词准入下 R3 需 4 格 > 3，本步只能排 [1, 1] 让 R3 继续等候！",
      kpi: "紧拼 [1, 1] / 预算 5 · R3 暂缓",
      detail:
        "token_budget = 5 时：t=2 第一趟排 running（R1+1, R2+1 占 2 剩 3），整条提示词准入下 R3(4词) 超出剩余预算 3，继续留在 waiting 队头，query_start_loc=[0, 1, 2]。",
      queryStartLoc: "[0, 1, 2]",
      budgetUsed: 2,
      offsets: [0, 1, 2],
      r3DeferredAtT2: true,
      freedPoolText: "在跑占块 · 0 退场",
      exitedNote: null,
      waitingList: [{ name: "R3（提示 4 词 > 剩预算 3）", status: "继续等候下轮", tone: "is-cow" }],
      runningList: [
        { name: "R1（续写第 2 词）", status: "优先 +1", tone: "is-priv" },
        { name: "R2（续写第 2 词）", status: "优先 +1", tone: "is-priv" },
      ],
      batchSlices: [
        { label: "R1 [1]", tokens: 1, kind: "is-full" },
        { label: "R2 [1]", tokens: 1, kind: "is-full" },
      ],
    };
  }
  if (step === 3) {
    return {
      step: 3,
      budget: 5,
      shortBtn: "③ t=2 完结当步释块",
      badgeText: "迭代 t=2 步末 · R1 退场腾预算",
      title: "动作 ③ · t=2 步末 R1 满 2 词退场释块，为 waiting 里的 R3 腾出第 4 格预算！",
      takeaway:
        "R1 当步完结离席并归还 KV 块！running 只剩 R2(每步占1)，下一轮剩余预算升至 5−1=4，刚好够接纳 R3(4词)！",
      kpi: "R1 退场释块 · 下轮余量升至 4",
      detail:
        "t=2 步末 R1 凑满 max_tokens=2 立即移出 running 并释放 KV 块；此时 running 仅剩 R2，为 t=3 腾出 4 格预算。",
      queryStartLoc: "[0, 1, 2]",
      budgetUsed: 2,
      offsets: [0, 1, 2],
      r3DeferredAtT2: true,
      freedPoolText: "R1 完结 → 归还 KV 块",
      exitedNote: "⚡ 步末退场：R1 满 2 词移出 running 释块，为 R3 下轮准入腾够预算！",
      waitingList: [{ name: "R3（提示 4 词）", status: "下轮即可准入", tone: "is-sys is-hit" }],
      runningList: [{ name: "R2（已生 2/3 词）", status: "留在 running", tone: "is-priv" }],
      batchSlices: [
        { label: "R1 [1] 完结", tokens: 1, kind: "is-bubble" },
        { label: "R2 [1]", tokens: 1, kind: "is-full" },
      ],
    };
  }
  return {
    step: 4,
    budget: 5,
    shortBtn: "④ t=3 轻装收官",
    badgeText: "迭代 t=3 · R1 退场后 [1, 4] 满载准入",
    title: "动作 ④ · t=3 先排 R2(+1) 剩 4 格，恰好准入 R3(+4) 紧拼 [1, 4]，边界 [0, 1, 5]！",
    takeaway:
      "得益于 R1 上一步及时退场，t=3 先给 R2 留 1 格后剩 4 格预算，恰好把 R3(4词) 拉进同批拼成 [1, 4] 吃满预算 5！",
    kpi: "P/D 混跑 [1, 4] · 边界 [0, 1, 5]",
    detail:
      "预算 5 下 t=3 调度：running 中 R2(+1) 占 1 格，waiting 中 R3(+4) 占 4 格，合拼 [1, 4] 共 5 格，query_start_loc=[0, 1, 5]；步末 R2 满 3/3 完结释块，R3 得首词。",
    queryStartLoc: "[0, 1, 5]",
    budgetUsed: 5,
    offsets: [0, 1, 5],
    r3DeferredAtT2: false,
    freedPoolText: "R1 已释 · 步末 R2 完结",
    exitedNote: null,
    waitingList: [{ name: "waiting 队列已清空", status: "R3 已上车", tone: "is-empty" }],
    runningList: [
      { name: "R2（末词 3/3 完结）", status: "优先 +1", tone: "is-priv" },
      { name: "R3（新提示 4 词准入）", status: "余量准入 +4", tone: "is-sys is-hit" },
    ],
    batchSlices: [
      { label: "R2 [1]", tokens: 1, kind: "is-full" },
      { label: "R3 提示 [4]", tokens: 4, kind: "is-piece" },
    ],
  };
}

export interface ContinuousBatchingTraceInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: BatchTraceMode | undefined;
  readonly initialStep?: BatchTraceStep | undefined;
  readonly initialBudget?: BatchBudgetOption | undefined;
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
  initialBudget = 8,
}: ContinuousBatchingTraceInteractiveProps) {
  const [mode, setMode] = useState<BatchTraceMode>(initialMode);
  const [step, setStep] = useState<BatchTraceStep>(initialStep);
  const [budget, setBudget] = useState<BatchBudgetOption>(initialBudget);
  const [playing, setPlaying] = useState(false);

  const spec = useMemo(() => computeContinuousBatchTrace(step, budget), [step, budget]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-cb-teal`;
  const mAccent = `${id}-${uid}-cb-accent`;
  const mWarn = `${id}-${uid}-cb-warn`;

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

  const budgetLeft = budget - spec.budgetUsed;

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
      extraRootAttrs={{
        "data-step": step,
        "data-budget": budget,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="cb-trace-autoplay"
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="单步 Token 预算档位切换">
            {BATCH_BUDGET_OPTIONS.map((bg) => {
              const active = mode === "sandbox" && budget === bg;
              return (
                <button
                  key={bg}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`cb-trace-budget-${bg}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setBudget(bg);
                  }}
                >
                  {bg === 8 ? "预算 8 (t=2 当步准入 R3)" : "预算 5 (t=2 暂缓 · t=3 排[1,4])"}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={
        spec.r3DeferredAtT2 && step === 2 ? "warn" : step === 2 || step === 3 ? "accent" : "default"
      }
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（统一进度差公式 / query_start_loc / LIFO 抢占与图补齐）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              {`① 双队列流转 → 紧拼一维条带 → query_start_loc 前缀和全景图 (预算 ${budget})`}
            </span>
            <span className="wiki-edu-badge is-good">{`边界 ${spec.queryStartLoc}`}</span>
          </div>

          <svg
            viewBox="0 0 860 250"
            width="860"
            height="250"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`连续批处理全景状态：${spec.title}`}
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
              <marker
                id={mWarn}
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
            <rect
              x="12"
              y="8"
              width="228"
              height="124"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="126" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              Waiting 排队区
            </text>
            <rect
              x="24"
              y="44"
              width="204"
              height="74"
              rx="6"
              fill={spec.r3DeferredAtT2 && step === 2 ? "#fff4cf" : "#ffffff"}
              stroke={spec.r3DeferredAtT2 && step === 2 ? "#c78300" : "#d8d8cf"}
            />
            <text x="126" y="74" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {(spec.waitingList[0]?.name ?? "").slice(0, 12)}
            </text>
            <text x="126" y="102" textAnchor="middle" fontSize="12" fill="#66716d">
              {spec.waitingList[0]?.status ?? ""}
            </text>

            <path
              className={`wiki-edu-wire${!spec.r3DeferredAtT2 && (step === 2 || (budget === 5 && step === 4)) ? " is-flow" : ""}`}
              d="M 244 74 L 290 74"
              stroke={spec.r3DeferredAtT2 && step === 2 ? "#c78300" : "#e85b32"}
              strokeDasharray={spec.r3DeferredAtT2 && step === 2 ? "4 3" : undefined}
              markerEnd={`url(#${spec.r3DeferredAtT2 && step === 2 ? mWarn : mAccent})`}
            />

            <rect
              x="296"
              y="8"
              width="268"
              height="124"
              rx="8"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="430" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              Running 活跃槽位
            </text>
            {spec.runningList.map((r, ri) => {
              const ry = 40 + ri * 28;
              return (
                <g key={`svg-run-${r.name}`}>
                  <rect x="310" y={ry} width="240" height="24" rx="5" fill="#ffffff" stroke="#087f73" />
                  <text x="430" y={ry + 17} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {`${r.name.slice(0, 11)} · ${r.status}`}
                  </text>
                </g>
              );
            })}

            <path
              className={`wiki-edu-wire${step >= 3 ? " is-flow" : ""}`}
              d="M 568 74 L 614 74"
              stroke="#087f73"
              markerEnd={`url(#${mTeal})`}
            />

            <rect
              x="620"
              y="8"
              width="228"
              height="124"
              rx="8"
              fill={step >= 3 ? "#e8edff" : "#fbfaf6"}
              stroke={step >= 3 ? "#4c65b6" : "#d8d8cf"}
              strokeWidth="1.4"
            />
            <text x="734" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              完结释块回池
            </text>
            <text x="734" y="72" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
              {spec.freedPoolText}
            </text>
            <text x="734" y="102" textAnchor="middle" fontSize="12" fill="#66716d">
              当步退出 · 零陪跑空泡
            </text>

            <rect
              x="12"
              y="142"
              width="836"
              height="100"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="430" y="162" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`紧拼条带 (已用 ${spec.budgetUsed}/${budget} · 剩 ${budgetLeft}) · query_start_loc = ${spec.queryStartLoc}`}
            </text>
            {spec.batchSlices.map((s, si) => {
              const slotPx = 720 / budget;
              const sx = 60 + spec.offsets[si]! * slotPx;
              const sw = s.tokens * slotPx - 4;
              const fill =
                s.kind === "is-bubble"
                  ? "#fff0e9"
                  : s.kind === "is-piece"
                    ? "#e8edff"
                    : s.kind === "is-attn"
                      ? "#fff4cf"
                      : "#ddf4ef";
              const stroke =
                s.kind === "is-bubble"
                  ? "#b54237"
                  : s.kind === "is-piece"
                    ? "#4c65b6"
                    : s.kind === "is-attn"
                      ? "#c78300"
                      : "#087f73";
              return (
                <g key={`svg-sl-${s.label}`}>
                  <rect
                    x={sx}
                    y="172"
                    width={sw}
                    height="34"
                    rx="6"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="1.5"
                  />
                  <text
                    x={sx + sw / 2}
                    y="194"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#17211f"
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}
            {budgetLeft > 0 && (
              <rect
                x={60 + spec.budgetUsed * (720 / budget)}
                y="172"
                width={budgetLeft * (720 / budget) - 4}
                height="34"
                rx="6"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeDasharray="4 3"
              />
            )}
            {spec.offsets.map((off) => {
              const tx = 60 + off * (720 / budget);
              return (
                <g key={`off-${off}`}>
                  <line x1={tx} y1="208" x2={tx} y2="216" stroke="#4c65b6" strokeWidth="1.6" />
                  <text x={tx} y="232" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4c65b6">
                    {off}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 双队列明细（先保在跑 · 余量接新）</span>
              <span className="wiki-edu-badge is-good">{`已用 ${spec.budgetUsed} / ${budget}`}</span>
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
      </div>
    </WikiEduSandboxShell>
  );
}
