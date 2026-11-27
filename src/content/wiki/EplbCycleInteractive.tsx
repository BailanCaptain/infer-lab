import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
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
    title: "阶段 ② · 算摆法：后台 CPU 算出对调 E1 ↔ E2（规划各 10 对），NPU 仍按旧表实跑 16/4",
    takeaway:
      "后台独立 CPU 子进程算出新表（规划对调 E1 ↔ E2 至各 10 对，待第 3 步搬运切换）；当前 HBM 尚未换表，NPU 前向仍按旧表实跑 16 vs 4 对（峰均比 1.6）！",
    kpi: "NPU 实跑 16/4 (1.6) · 规划 10/10 (待第 3 步搬运切换)",
    imbalanceRatio: "1.0 (计划)",
    card0Header: "卡 0 · 实跑 16 对 (规划 10 对·待第3步切换)",
    card1Header: "卡 1 · 实跑 4 对 (规划 10 对·待第3步切换)",
    card0LoadPct: 80,
    card1LoadPct: 20,
    card0Slots: [
      {
        id: "E0",
        label: "在役专家 E0（保留）",
        pairsText: "实跑 8 对",
        state: "cow",
        badgeTone: "ref-2",
        highlight: true,
      },
      {
        id: "E1→E2*",
        label: "在役 E1（待第 3 步迁入 E2）",
        pairsText: "实8→规2",
        state: "free",
        badgeTone: "ref-cow",
        highlight: true,
      },
    ],
    card1Slots: [
      {
        id: "E2→E1*",
        label: "在役 E2（待第 3 步迁入 E1）",
        pairsText: "实2→规8",
        state: "free",
        badgeTone: "ref-cow",
        highlight: true,
      },
      {
        id: "E3",
        label: "在役专家 E3（保留）",
        pairsText: "实跑 2 对",
        state: "private",
        badgeTone: "ref-priv",
      },
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
export const EPLB_REDUNDANT_OPTIONS = [0, 2] as const;
export type EplbRedundantSlots = (typeof EPLB_REDUNDANT_OPTIONS)[number];
export const EPLB_SOURCE_SKEWS = ["skew-8-4", "even-6-6"] as const;
export type EplbSourceSkew = (typeof EPLB_SOURCE_SKEWS)[number];

export interface EplbComputedState {
  readonly step: EplbStep;
  readonly redundantSlots: EplbRedundantSlots;
  readonly sourceSkew: EplbSourceSkew;
  readonly oldPairs: readonly [number, number];
  readonly oldImbalance: string;
  readonly plannedPairs: readonly [number, number];
  readonly plannedImbalance: string;
  readonly actualPairs: readonly [number, number];
  readonly actualImbalance: string;
  readonly displayImbalance: string;
  readonly card0LoadPct: number;
  readonly card1LoadPct: number;
  readonly card0Header: string;
  readonly card1Header: string;
  readonly card0Slots: readonly EplbSlotView[];
  readonly card1Slots: readonly EplbSlotView[];
  readonly kpiText: string;
  readonly takeawayText: string;
}

export function computeEplbState(
  step: EplbStep = 1,
  redundantSlots: EplbRedundantSlots = 2,
  sourceSkew: EplbSourceSkew = "skew-8-4",
): EplbComputedState {
  const base = EPLB_CYCLE_STEPS[step - 1]!;

  if (step <= 3) {
    const tableSwapped = step === 3;
    const actualPairs: readonly [number, number] = tableSwapped ? [10, 10] : [16, 4];
    const actualImbalance = tableSwapped ? "1.0" : "1.6";
    const card0LoadPct = tableSwapped ? 50 : 80;
    const card1LoadPct = tableSwapped ? 50 : 20;
    return {
      step,
      redundantSlots,
      sourceSkew,
      oldPairs: [16, 4],
      oldImbalance: "1.6",
      plannedPairs: [10, 10],
      plannedImbalance: "1.0",
      actualPairs,
      actualImbalance,
      displayImbalance: base.imbalanceRatio,
      card0LoadPct,
      card1LoadPct,
      card0Header: base.card0Header,
      card1Header: base.card1Header,
      card0Slots: base.card0Slots,
      card1Slots: base.card1Slots,
      kpiText: base.kpi,
      takeawayText: base.takeaway,
    };
  }

  if (step === 4 || redundantSlots === 0) {
    return {
      step,
      redundantSlots,
      sourceSkew,
      oldPairs: [14, 6],
      oldImbalance: "1.4",
      plannedPairs: [14, 6],
      plannedImbalance: "1.4",
      actualPairs: [14, 6],
      actualImbalance: "1.4",
      displayImbalance: "1.4",
      card0LoadPct: 70,
      card1LoadPct: 30,
      card0Header: "卡 0 · 合计 14 对 (0冗余2槽下限)",
      card1Header: "卡 1 · 合计 6 对",
      card0Slots: EPLB_CYCLE_STEPS[3]!.card0Slots,
      card1Slots: EPLB_CYCLE_STEPS[3]!.card1Slots,
      kpiText: step === 5 && redundantSlots === 0 ? "0冗余仅换位：卡在 14/6 对 · 峰均比 1.4" : base.kpi,
      takeawayText:
        step === 5 && redundantSlots === 0
          ? "未预留冗余专家槽（0 冗余、每卡仅 2 槽）：独占 12 对的 E0 无法拆成双副本，无论怎么换位置峰均比都卡死在 1.4！"
          : base.takeaway,
    };
  }

  // step === 5 && redundantSlots === 2
  const e0Card0 = sourceSkew === "skew-8-4" ? 8 : 6;
  const e0Card1 = 12 - e0Card0;
  const c0Actual = e0Card0 + 2 + 2; // 12 or 10
  const c1Actual = e0Card1 + 2 + 2; // 8 or 10
  const actualImb = (Math.max(c0Actual, c1Actual) / 10).toFixed(1);
  const c0Pct = Math.round((c0Actual / 20) * 100);
  const c1Pct = 100 - c0Pct;

  return {
    step: 5,
    redundantSlots: 2,
    sourceSkew,
    oldPairs: [14, 6],
    oldImbalance: "1.4",
    plannedPairs: [10, 10],
    plannedImbalance: "1.0",
    actualPairs: [c0Actual, c1Actual],
    actualImbalance: actualImb,
    displayImbalance: actualImb,
    card0LoadPct: c0Pct,
    card1LoadPct: c1Pct,
    card0Header: `卡 0 · 实际 ${c0Actual} 对 (3 槽)`,
    card1Header: `卡 1 · 实际 ${c1Actual} 对 (3 槽)`,
    card0Slots: [
      {
        id: "E0a",
        label: "E0 本卡副本",
        pairsText: `${e0Card0} 对`,
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
        pairsText: `${e0Card1} 对`,
        state: "private",
        badgeTone: "ref-priv",
        highlight: true,
      },
      { id: "E1b", label: "E1 冗余副本", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
      { id: "E3", label: "专家 E3", pairsText: "2 对", state: "shared", badgeTone: "ref-1" },
    ],
    kpiText: `预测 10/10(1.0) · 实际 ${c0Actual}/${c1Actual} · 峰均比 ${actualImb}`,
    takeawayText:
      sourceSkew === "even-6-6"
        ? "当两张源卡发出的 E0 请求恰好对半（6:6）时，双卡 3 槽副本就近分流实得 10 vs 10 对，实际峰均比与规划预测 1.0 完全重合！"
        : base.takeaway,
  };
}

export interface EplbCycleInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: EplbDiagramMode | undefined;
  readonly initialStep?: EplbStep | undefined;
  readonly initialRedundantSlots?: EplbRedundantSlots | undefined;
  readonly initialSourceSkew?: EplbSourceSkew | undefined;
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
  initialRedundantSlots = 2,
  initialSourceSkew = "skew-8-4",
}: EplbCycleInteractiveProps) {
  const [mode, setMode] = useState<EplbDiagramMode>(initialMode);
  const [step, setStep] = useState<EplbStep>(initialStep);
  const [redundantSlots, setRedundantSlots] = useState<EplbRedundantSlots>(initialRedundantSlots);
  const [sourceSkew, setSourceSkew] = useState<EplbSourceSkew>(initialSourceSkew);
  const [playing, setPlaying] = useState(false);

  const spec = EPLB_CYCLE_STEPS[step - 1]!;
  const state = useMemo(
    () => computeEplbState(step, redundantSlots, sourceSkew),
    [step, redundantSlots, sourceSkew],
  );
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
            {step <= 2 || loadPct <= 30 ? "空等同步" : "配对均衡"}
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
      extraRootAttrs={{
        "data-step": step,
        "data-redundant-slots": redundantSlots,
        "data-source-skew": sourceSkew,
      }}
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="冗余槽位数与源卡分流偏斜切换">
            {EPLB_REDUNDANT_OPTIONS.map((rs) => {
              const active = mode === "sandbox" && redundantSlots === rs;
              return (
                <button
                  key={rs}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`eplb-redundant-${rs}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setRedundantSlots(rs);
                    if (step < 4) setStep(5);
                  }}
                >
                  {rs === 0 ? "0 冗余仅换位 (下限1.4)" : "+2 冗余槽拆副本 (每卡3槽)"}
                </button>
              );
            })}
            {(
              [
                ["skew-8-4", "源卡偏斜 8:4 (实得12/8·1.2)"],
                ["even-6-6", "源卡均分 6:6 (实得10/10·1.0)"],
              ] as const
            ).map(([sk, label]) => {
              const active = mode === "sandbox" && sourceSkew === sk;
              return (
                <button
                  key={sk}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`eplb-skew-${sk}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setRedundantSlots(2);
                    setSourceSkew(sk);
                    if (step < 5) setStep(5);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 5 && redundantSlots === 0 ? "warn" : spec.takeawayTone}
      takeaway={state.takeawayText}
      kpi={state.kpiText}
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
            <span className="wiki-edu-panel-title">① 旧布局 vs 规划预测 vs 源卡就近路由实际落点同屏对账</span>
            <span className={`wiki-edu-badge ${step === 1 ? "is-bad" : step >= 4 ? "is-good" : "is-warn"}`}>
              {`峰均比 ${state.displayImbalance}`}
            </span>
          </div>
          <svg
            viewBox="0 0 860 232"
            width="860"
            height="232"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`EPLB 三列对账：${spec.wireLabel}`}
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
              x="12"
              y="8"
              width="252"
              height="214"
              rx="10"
              fill="#fff0e9"
              stroke="#b54237"
              strokeWidth="1.4"
            />
            <text x="138" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ① 旧布局基线
            </text>
            <rect x="28" y="44" width="220" height="34" rx="6" fill="#ffffff" stroke="#b54237" />
            <text x="138" y="66" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`卡 0 旧载：${state.oldPairs[0]} 对`}
            </text>
            <rect x="28" y="90" width="220" height="34" rx="6" fill="#ffffff" stroke="#d8d8cf" />
            <text x="138" y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`卡 1 旧载：${state.oldPairs[1]} 对`}
            </text>
            <text x="138" y="158" textAnchor="middle" fontSize="13" fontWeight="700" fill="#b54237">
              {`旧峰均比 ${state.oldImbalance}`}
            </text>
            <text x="138" y="198" textAnchor="middle" fontSize="12" fill="#66716d">
              {step <= 3 ? "热度 [8,8,2,2] 挤在卡0" : "热度 [12,4,2,2] 单专家超载"}
            </text>

            <path d="M 268 108 L 292 108" stroke="#c78300" strokeWidth="2.2" markerEnd={`url(#${mWarn})`} />

            <rect
              x="296"
              y="8"
              width="268"
              height="214"
              rx="10"
              fill={step === 3 ? "#f7e7f2" : "#fbfaf6"}
              stroke={step === 3 ? "#9a4b86" : "#087f73"}
              strokeWidth="1.5"
            />
            <text x="430" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ② 规划预测与迁移缓冲
            </text>
            <rect x="314" y="44" width="232" height="34" rx="6" fill="#ddf4ef" stroke="#087f73" />
            <text x="430" y="66" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step === 2
                ? `规划卡 0：${state.plannedPairs[0]} 对 (待第3步切换)`
                : `预测卡 0：${state.plannedPairs[0]} 对`}
            </text>
            <rect x="314" y="90" width="232" height="34" rx="6" fill="#ddf4ef" stroke="#087f73" />
            <text x="430" y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step === 2
                ? `规划卡 1：${state.plannedPairs[1]} 对 (待第3步切换)`
                : `预测卡 1：${state.plannedPairs[1]} 对`}
            </text>
            <text x="430" y="158" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087f73">
              {`预测峰均比 ${state.plannedImbalance}`}
            </text>
            <text x="430" y="198" textAnchor="middle" fontSize="12" fill="#66716d">
              {step === 2
                ? "CPU 已算新表 · 待第 3 步搬运切换"
                : step === 3
                  ? "接收区暂存权重 · 步末原子换表"
                  : step >= 5 && redundantSlots === 2
                    ? "规划按双副本 6:6 均分估计"
                    : "后台子进程异地计算新摆法"}
            </text>

            <path
              d="M 568 62 L 592 62"
              stroke={step <= 2 ? "#c78300" : step === 3 ? "#9a4b86" : "#087f73"}
              strokeWidth={Math.max(1.5, state.actualPairs[0] / 4)}
              strokeDasharray={step <= 2 ? "4 3" : undefined}
              markerEnd={`url(#${step <= 2 ? mWarn : step === 3 ? mComm : mTeal})`}
            />
            <path
              d="M 568 108 L 592 108"
              stroke={step <= 2 ? "#c78300" : "#087f73"}
              strokeWidth={Math.max(1.4, state.actualPairs[1] / 4)}
              strokeDasharray={step <= 2 ? "4 3" : undefined}
              markerEnd={`url(#${step <= 2 ? mWarn : mTeal})`}
            />

            <rect
              x="596"
              y="8"
              width="252"
              height="214"
              rx="10"
              fill={state.actualPairs[0] >= 14 ? "#fff4cf" : "#ddf4ef"}
              stroke={state.actualPairs[0] >= 14 ? "#c78300" : "#087f73"}
              strokeWidth="1.6"
            />
            <text x="722" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ③ 源卡就近路由实际落点
            </text>
            <rect
              x="612"
              y="44"
              width="220"
              height="34"
              rx="6"
              fill="#ffffff"
              stroke={state.actualPairs[0] >= 14 ? "#c78300" : "#087f73"}
            />
            <text x="722" y="66" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`实际卡 0：${state.actualPairs[0]} 对 (${state.card0LoadPct}%)`}
            </text>
            <rect
              x="612"
              y="90"
              width="220"
              height="34"
              rx="6"
              fill="#ffffff"
              stroke={state.actualPairs[0] >= 14 ? "#d8d8cf" : "#087f73"}
            />
            <text x="722" y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`实际卡 1：${state.actualPairs[1]} 对 (${state.card1LoadPct}%)`}
            </text>
            <text x="722" y="158" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`实际峰均比 ${state.actualImbalance}`}
            </text>
            <text x="722" y="198" textAnchor="middle" fontSize="12" fill="#66716d">
              {step <= 2
                ? "未搬运换表 · NPU 仍跑旧表 16/4"
                : step === 3
                  ? "完成搬运换表 · 实跑切至 10/10"
                  : step === 5 && redundantSlots === 2
                    ? sourceSkew === "skew-8-4"
                      ? "纯EP源卡偏斜8:4 → 实得12/8"
                      : "源卡均等6:6 → 实得10/10"
                    : step === 5 && redundantSlots === 0
                      ? "0冗余仅2槽 → 锁死在14/6"
                      : "边宽正比于每卡实收配对数"}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          {renderCardColumn(
            state.card0Header,
            state.card0LoadPct,
            state.card0Slots,
            state.card0LoadPct >= 70,
          )}
          {renderCardColumn(state.card1Header, state.card1LoadPct, state.card1Slots, false)}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
