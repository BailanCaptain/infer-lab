import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const EPLB_CYCLE_APPROVED_SHA256 = "6856cc9972f3346cce73ec68e66982edab2250db0019c24e2c4c66cf0d8137c3";

export type EplbStep = 1 | 2 | 3 | 4 | 5;
export type EplbDiagramMode = "sandbox" | "svg";

export interface EplbSlotView {
  readonly id: string;
  readonly label: string;
  readonly pairsText: string;
  readonly state: "shared" | "private" | "cow" | "free";
  readonly badgeTone: "" | "ref-1" | "ref-2" | "ref-priv" | "ref-cow";
  readonly highlight?: boolean;
}

export interface EplbStepSpec {
  readonly step: EplbStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly imbalanceRatio: string;
  readonly card0Header: string;
  readonly card1Header: string;
  readonly card0LoadPct: number;
  readonly card1LoadPct: number;
  readonly card0Slots: readonly EplbSlotView[];
  readonly card1Slots: readonly EplbSlotView[];
  readonly wireKind: "allgather" | "plan" | "swap-xfer" | "skew-warn" | "replica-hit";
  readonly wireLabel: string;
  readonly detail: string;
}

export const EPLB_CYCLE_STEPS: readonly EplbStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 数配对撞热点",
    badgeText: "阶段 1 / 5 · 网红专家排长龙",
    takeawayTone: "danger",
    title: "阶段 ① · 数热度：窗口 1 内卡 0 挤满热门专家（16 对 vs 4 对，峰均比 1.6）",
    takeaway:
      "两个热门专家 E0、E1 恰巧挤在卡 0（共 16 对），卡 1 只有 4 对早早算完，被迫停在同步点干等卡 0！",
    kpi: "卡0 16对 / 卡1 4对 · 峰均比 1.6",
    imbalanceRatio: "1.6",
    card0Header: "卡 0 · 合计 16 对 (拥堵)",
    card1Header: "卡 1 · 合计 4 对 (空等)",
    card0LoadPct: 80,
    card1LoadPct: 20,
    card0Slots: [
      {
        id: "E0",
        label: "热门专家 E0",
        pairsText: "8 对",
        state: "cow",
        badgeTone: "ref-2",
        highlight: true,
      },
      {
        id: "E1",
        label: "热门专家 E1",
        pairsText: "8 对",
        state: "cow",
        badgeTone: "ref-2",
        highlight: true,
      },
    ],
    card1Slots: [
      { id: "E2", label: "冷门专家 E2", pairsText: "2 对", state: "private", badgeTone: "ref-priv" },
      { id: "E3", label: "冷门专家 E3", pairsText: "2 对", state: "private", badgeTone: "ref-priv" },
    ],
    wireKind: "allgather",
    wireLabel: "汇总热度表",
    detail:
      "2 卡 4 专家示意（平均每卡 L̄ = (16+4)/2 = 10 对）：窗口 1 内 E0、E1 各接 8 对，E2、E3 各接 2 对，峰均比 Imbalance = 16 / 10 = 1.6。默认收集段（MRV1 为 600 步）结束后通过 All-Gather 汇总全卡热度送交后台规划器。",
  },
  {
    step: 2,
    shortBtn: "② 后台排新摆法",
    badgeText: "阶段 2 / 5 · CPU 异地算对调",
    takeawayTone: "default",
    title: "阶段 ② · 算摆法：后台 CPU 进程规划对调 E1 ↔ E2，计划两卡各 10 对",
    takeaway:
      "后台独立 CPU 子进程看表重新排座：计划把卡 0 的 E1 和卡 1 的 E2 对调，两边各凑 8+2=10 对，不抢 NPU 算力！",
    kpi: "计划各 10 对 · 预计峰均比 1.0",
    imbalanceRatio: "1.0 (计划)",
    card0Header: "卡 0 · 计划 10 对",
    card1Header: "卡 1 · 计划 10 对",
    card0LoadPct: 50,
    card1LoadPct: 50,
    card0Slots: [
      { id: "E0", label: "保留专家 E0", pairsText: "8 对", state: "shared", badgeTone: "ref-1" },
      { id: "E2*", label: "计划迁入 E2", pairsText: "2 对", state: "free", badgeTone: "", highlight: true },
    ],
    card1Slots: [
      { id: "E1*", label: "计划迁入 E1", pairsText: "8 对", state: "free", badgeTone: "", highlight: true },
      { id: "E3", label: "保留专家 E3", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
    ],
    wireKind: "plan",
    wireLabel: "规划 E1↔E2",
    detail:
      "Worker 进程因需派生子进程而由补丁改为非守护进程，EPLB 内部再通过 Process(..., daemon=True) 拉起守护规划子进程（MRV1 默认留 algorithm_execution_interval=50 步，默认策略 2 SwiftBalanceEplb）计算新布局，期间 NPU 照常按旧表推理；对调 E1 与 E2 后两边均为 8+2=10 对，估计峰均比压至 10/10 = 1.0。",
  },
  {
    step: 3,
    shortBtn: "③ 逐层搬与换表",
    badgeText: "阶段 3 / 5 · 接收区缓冲原子换表",
    takeawayTone: "accent",
    title: "阶段 ③ · 搬权重：逐层异步互传进接收区，步末等传完后原子切换查表与槽位",
    takeaway:
      "每步异步发起 1 层权重互传（收到的先存接收区），步末确认本层传完后原子切换权重和两张路由表（若传输或后台规划未完，步末仍需等待）！",
    kpi: "逐层异步搬 · 步末等完原子换表",
    imbalanceRatio: "1.0",
    card0Header: "卡 0 · 边跑边收 E2",
    card1Header: "卡 1 · 边跑边收 E1",
    card0LoadPct: 50,
    card1LoadPct: 50,
    card0Slots: [
      { id: "E0", label: "在役专家 E0", pairsText: "8 对", state: "shared", badgeTone: "ref-1" },
      {
        id: "E1→",
        label: "发出 E1 · 接收区收 E2",
        pairsText: "原子换",
        state: "cow",
        badgeTone: "ref-cow",
        highlight: true,
      },
    ],
    card1Slots: [
      {
        id: "E2→",
        label: "发出 E2 · 接收区收 E1",
        pairsText: "原子换",
        state: "cow",
        badgeTone: "ref-cow",
        highlight: true,
      },
      { id: "E3", label: "在役专家 E3", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
    ],
    wireKind: "swap-xfer",
    wireLabel: "互传权重",
    detail:
      "MRV1 用独立 dynamic_eplb HCCL 组每步迁移 1 层 MoE（4 层共 600+50+4=654 步），前向前异步提交收发，步末必须等本层传完（及取规划那步若后台未算完也会阻塞）才同步更新 expert_map 与 log2phy 并拷入接收区权重；v0.30.0 / main 的 MRV2 默认采用 stair 阶梯式异步重均衡（优先协商 HIXL，不一致则回退 Gloo）。",
  },
  {
    step: 4,
    shortBtn: "④ 单专家超载",
    badgeText: "阶段 4 / 5 · 光换位置压不下",
    takeawayTone: "warn",
    title: "阶段 ④ · 再数：窗口 2 里 E0 暴涨至 12 对（超均值 10），光换位置下限卡在 1.4",
    takeaway:
      "流量变了！E0 单个专家就接了 12 对（超过每卡平均 10 对），它放哪张卡哪张卡就至少 14 对，换位置失灵了！",
    kpi: "E0 独占 12 对 · 换位下限 1.4",
    imbalanceRatio: "1.4",
    card0Header: "卡 0 · 合计 14 对 (E0 超载)",
    card1Header: "卡 1 · 合计 6 对",
    card0LoadPct: 70,
    card1LoadPct: 30,
    card0Slots: [
      {
        id: "E0",
        label: "超热专家 E0",
        pairsText: "12 对!",
        state: "cow",
        badgeTone: "ref-2",
        highlight: true,
      },
      { id: "E2", label: "已迁入 E2", pairsText: "2 对", state: "private", badgeTone: "ref-priv" },
    ],
    card1Slots: [
      { id: "E1", label: "已迁入 E1", pairsText: "4 对", state: "private", badgeTone: "ref-priv" },
      { id: "E3", label: "保留专家 E3", pairsText: "2 对", state: "private", badgeTone: "ref-priv" },
    ],
    wireKind: "skew-warn",
    wireLabel: "单专家 > 均值",
    detail:
      "窗口 2 内 E0=12、E1=4、E2=2、E3=2（平均仍为 10 对）：因每卡固定 2 槽，E0 必与另一专家同卡，最轻组合也是 12+2=14 对，只换位置的峰均比下限卡在 14/10 = 1.4，必须引入冗余专家副本。",
  },
  {
    step: 5,
    shortBtn: "⑤ 加副本消峰",
    badgeText: "阶段 5 / 5 · 冗余副本就近分流",
    takeawayTone: "default",
    title: "阶段 ⑤ · 冗余专家副本：两卡各放一份 E0 与 E1（每卡 3 槽），实际峰均比降至 1.2",
    takeaway:
      "启动时预留 2 个冗余槽（每卡 3 格），给超热的 E0 在两张卡各放一份副本就近分流，峰均比进一步压到 1.2！",
    kpi: "卡0 12对 / 卡1 8对 · 峰均比 1.2",
    imbalanceRatio: "1.2",
    card0Header: "卡 0 · 实际 12 对 (3 槽)",
    card1Header: "卡 1 · 实际 8 对 (3 槽)",
    card0LoadPct: 60,
    card1LoadPct: 40,
    card0Slots: [
      {
        id: "E0a",
        label: "E0 本卡副本",
        pairsText: "8 对",
        state: "private",
        badgeTone: "ref-priv",
        highlight: true,
      },
      { id: "E1a", label: "E1 本卡副本", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
      { id: "E2", label: "专家 E2", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
    ],
    card1Slots: [
      {
        id: "E0b",
        label: "E0 冗余副本",
        pairsText: "4 对",
        state: "private",
        badgeTone: "ref-priv",
        highlight: true,
      },
      { id: "E1b", label: "E1 冗余副本", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
      { id: "E3", label: "专家 E3", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
    ],
    wireKind: "replica-hit",
    wireLabel: "就近命中副本",
    detail:
      "冗余槽须在启动时预留且满足 (n_expert + n_redundant) % ep_size == 0（4+2=6 槽 → 每卡 3 槽；额外常驻显存 = 副本位 + 共用接收区）。规划器按副本均分估算为 10:10（1.0），实际纯 EP（tp_size=1）按源卡固定规则就近落本地副本（设卡 0 发 8 对、卡 1 发 4 对），实得 12 vs 8 对，实际峰均比 12/10 = 1.2。",
  },
];
export interface EplbCycleInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: EplbDiagramMode | undefined;
  readonly initialStep?: EplbStep | undefined;
}

export function EplbCycleInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: EplbCycleInteractiveProps) {
  const [mode, setMode] = useState<EplbDiagramMode>(initialMode);
  const [step, setStep] = useState<EplbStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = EPLB_CYCLE_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mComm = `${id}-${uid}-ep-comm`;
  const mTeal = `${id}-${uid}-ep-teal`;
  const mWarn = `${id}-${uid}-ep-warn`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        const next = (prev + 1) as EplbStep;
        if (next >= 5) setPlaying(false);
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: EplbStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const toggleAutoPlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= 5) setStep(1);
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
        selectStep(Math.min(5, step + 1) as EplbStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as EplbStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectStep(Number(event.key) as EplbStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const renderCardColumn = (
    header: string,
    loadPct: number,
    slots: readonly EplbSlotView[],
    isHot: boolean,
  ) => (
    <div className={`wiki-edu-hbm${isHot ? " is-oom" : ""}`}>
      <div className="wiki-edu-col-title">
        <span>{header}</span>
        <span className="mono">{`配对占 ${loadPct}%`}</span>
      </div>
      <div className="wiki-edu-track">
        <div
          className={`wiki-edu-op ${loadPct >= 70 ? "is-bubble" : "is-full"}`}
          style={{ flex: Math.max(0.15, loadPct / 100) }}
        >
          {`配对占 ${loadPct}%`}
        </div>
        {loadPct < 60 && (
          <div className="wiki-edu-op is-eager" style={{ flex: Math.max(0.15, (100 - loadPct) / 100) }}>
            {step === 1 ? "空等同步" : "配对均衡"}
          </div>
        )}
      </div>
      {slots.map((slot) => (
        <div
          key={slot.id}
          className={`wiki-edu-block is-${slot.state}${slot.highlight ? " is-highlight" : ""}`}
        >
          <div className="wiki-edu-block-id">{slot.id}</div>
          <div className="wiki-edu-block-title">{slot.label}</div>
          <span className={`wiki-edu-ref-badge ${slot.badgeTone}`.trim()}>{slot.pairsText}</span>
        </div>
      ))}
    </div>
  );

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
      kickerTitle="EPLB（专家并行在线负载均衡闭环）"
      question="少数“网红专家”排队把整步拖慢，怎么在不停机的情况下把各卡负载抹平？"
      toolbarLabel="EPLB 五步重均衡与冗余副本控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="eplb-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as EplbStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as EplbStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="EPLB 五步闭环切换">
            {EPLB_CYCLE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`eplb-step-${item.step}`}
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
      takeawayTone={spec.takeawayTone}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（峰均比公式 / expert_map 与 log2phy 原子切换 / MRV1 vs MRV2 STAIR）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 双卡令牌分发漏斗与在线重排拓扑（{spec.wireLabel}）</span>
            <span className={`wiki-edu-badge ${step === 1 ? "is-bad" : step >= 4 ? "is-good" : "is-warn"}`}>
              {`峰均比 ${spec.imbalanceRatio}`}
            </span>
          </div>
          <svg
            viewBox="0 0 820 212"
            width="820"
            height="212"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`EPLB 卡间动作：${spec.wireLabel}`}
          >
            <defs>
              <marker
                id={mComm}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#9a4b86" />
              </marker>
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
              x="270"
              y="8"
              width="280"
              height="34"
              rx="8"
              fill="#fbfaf6"
              stroke="#17211f"
              strokeWidth="1.4"
            />
            <text x="410" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {step >= 4 ? "log2phy 路由表：热门 E₀ 双物理槽分流" : "MoE 令牌路由流（10 对词元-专家）"}
            </text>

            <path
              d="M 340 42 L 190 82"
              stroke={step === 1 ? "#c78300" : "#087f73"}
              strokeWidth={step === 1 ? "3.2" : "2.2"}
              markerEnd={`url(#${step === 1 ? mWarn : mTeal})`}
            />
            <path
              d="M 480 42 L 630 82"
              stroke="#087f73"
              strokeWidth={step >= 4 ? "2.4" : "1.4"}
              markerEnd={`url(#${mTeal})`}
            />

            <rect
              x="20"
              y="86"
              width="320"
              height="114"
              rx="10"
              fill={step === 1 ? "#fff0e9" : "#ddf4ef"}
              stroke={step === 1 ? "#b54237" : "#087f73"}
              strokeWidth="1.6"
            />
            <text x="180" y="112" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`卡 0 · 负载 ${spec.card0LoadPct}%`}
            </text>
            <text x="180" y="144" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step === 1 ? "网红 E₀ 堵满 7 对 + E₁ 1 对" : "E₀ 主本(3.5对) + 冷门专家 = 50%"}
            </text>
            <text x="180" y="178" textAnchor="middle" fontSize="12" fill="#66716d">
              {step === 2
                ? "后台守护线程快照计数"
                : step === 3
                  ? "准备发往卡1建立冗余副本"
                  : "无停机持续前向"}
            </text>

            {step === 3 && (
              <path d="M 344 142 L 472 142" stroke="#9a4b86" strokeWidth="2.4" markerEnd={`url(#${mComm})`} />
            )}

            <rect
              x="480"
              y="86"
              width="320"
              height="114"
              rx="10"
              fill={step >= 3 ? "#ddf4ef" : "#fbfaf6"}
              stroke={step === 3 ? "#9a4b86" : "#087f73"}
              strokeWidth="1.6"
            />
            <text x="640" y="112" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`卡 1 · 负载 ${spec.card1LoadPct}%`}
            </text>
            <text x="640" y="144" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step <= 2 ? "仅冷门 E₂+E₃ (2 对 · 空等 AllToAll)" : "新增冗余 E₀' 副本承接分流 → 50%"}
            </text>
            <text x="640" y="178" textAnchor="middle" fontSize="12" fill="#66716d">
              {step === 3
                ? "影子缓冲异步拷入 E₀ 权重"
                : step >= 4
                  ? "原子切换映射表 · 抹平木桶短板"
                  : "80% 时间空转等卡0"}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          {renderCardColumn(spec.card0Header, spec.card0LoadPct, spec.card0Slots, spec.card0LoadPct >= 70)}
          {renderCardColumn(spec.card1Header, spec.card1LoadPct, spec.card1Slots, false)}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
