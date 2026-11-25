import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export type PrefixCachingStep = 1 | 2 | 3 | 4 | 5;
export type PrefixDiagramMode = "svg" | "sandbox";

export interface PrefixBlockView {
  readonly id: "B0" | "B1" | "B2" | "B3";
  readonly roleLabel: string;
  readonly fillText: string;
  readonly cells: readonly ("kv" | "tok" | "cow" | "")[];
  readonly refCnt: 0 | 1 | 2;
  readonly refBadge: string;
  readonly refTone: "" | "ref-1" | "ref-2" | "ref-priv" | "ref-cow";
  readonly state: "shared" | "private" | "cow" | "free";
  readonly highlight?: boolean;
}

export interface PrefixSlotPill {
  readonly text: string;
  readonly target: PrefixBlockView["id"] | null;
  readonly tone: "is-sys" | "is-sys is-hit" | "is-priv" | "is-cow" | "is-empty";
  readonly flow?: boolean;
}

export interface PrefixRequestCardSpec {
  readonly name: string;
  readonly stateText: string;
  readonly stateTone: "" | "is-run" | "is-hit" | "is-cow";
  readonly active: boolean;
  readonly dim: boolean;
  readonly slots: readonly PrefixSlotPill[];
}

export interface PrefixStepSpec {
  readonly step: PrefixCachingStep;
  readonly buttonLabel: string;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly detail: string;
  readonly savedCellsText: string;
  readonly savedNote: string;
  readonly freeLruQueue: readonly string[];
  readonly reqA: PrefixRequestCardSpec;
  readonly reqB: PrefixRequestCardSpec;
  readonly blocks: readonly PrefixBlockView[];
  readonly cowCopyFromTo?: readonly [PrefixBlockView["id"], PrefixBlockView["id"]];
}

export const PREFIX_CACHING_STEPS: readonly PrefixStepSpec[] = [
  {
    step: 1,
    buttonLabel: "① 请求 A 写入系统提示词",
    shortBtn: "① A 写入",
    badgeText: "动作 1 / 5 · 首次写入",
    title: "动作 ① · 请求 A 写入系统提示词（分配块 B0, B1，ref_cnt = 1）",
    takeaway: "请求 A 先到：前两块写满后登记共享指纹，末尾未满的提问放进私有块 B2。",
    detail:
      "链式块指纹：h0 = H(∅, sys[0..3]) → B0，h1 = H(h0, sys[4..7]) → B1。昇腾 Qwen3-8B 默认 128 token/块（图中以 4 格浓缩示意），仅整块写满才登记进共享哈希表。",
    savedCellsText: "0 格（首条算满 10 格）",
    savedNote: "前 2 块写满后登记链式 block hash",
    freeLruQueue: ["B3", "B4"],
    reqA: {
      name: "请求 A",
      stateText: "首次计算",
      stateTone: "is-run",
      active: true,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys" },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys" },
        { text: "用户提问：「帮我写快排」", target: "B2", tone: "is-priv" },
      ],
    },
    reqB: {
      name: "请求 B",
      stateText: "尚未到达",
      stateTone: "",
      active: false,
      dim: true,
      slots: [{ text: "等待下一条请求进入…", target: null, tone: "is-empty" }],
    },
    blocks: [
      {
        id: "B0",
        roleLabel: "系统提示 [0..3]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-1",
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "格式约束 [4..7]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-1",
        state: "shared",
        highlight: true,
      },
      {
        id: "B2",
        roleLabel: "A 私有尾 [8..9]",
        fillText: "未满 2/4",
        cells: ["tok", "tok", "", ""],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-priv",
        state: "private",
      },
      {
        id: "B3",
        roleLabel: "空闲物理块",
        fillText: "0/4",
        cells: ["", "", "", ""],
        refCnt: 0,
        refBadge: "空闲",
        refTone: "",
        state: "free",
      },
    ],
  },
  {
    step: 2,
    buttonLabel: "② 请求 B 命中相同前缀",
    shortBtn: "② B 命中复用",
    badgeText: "动作 2 / 5 · 零拷贝命中",
    title: "动作 ② · 请求 B 命中相同前缀（零重算复用 B0, B1，ref_cnt = 2）",
    takeaway: "请求 B 带了同款提示词：直接把指针连向现成的 B0、B1，ref 升为 2，完全不用重算前 8 格！",
    detail:
      "调度器逐块比对链式哈希与额外身份键，连续命中 B0、B1 后直接 touch 将物理块号填入 B 的块表，ref_cnt 从 1 升为 2，零显存拷贝跳过 Prefill 重算。",
    savedCellsText: "省 8/10 格（跳过 80% 计算）",
    savedNote: "仅改逻辑块表指针，不复制物理 KV",
    freeLruQueue: ["B3", "B4"],
    reqA: {
      name: "请求 A",
      stateText: "运行中",
      stateTone: "is-run",
      active: false,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys" },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys" },
        { text: "用户提问：「帮我写快排」", target: "B2", tone: "is-priv" },
      ],
    },
    reqB: {
      name: "请求 B",
      stateText: "前缀命中!",
      stateTone: "is-hit",
      active: true,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys is-hit", flow: true },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys is-hit", flow: true },
      ],
    },
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]（只存 1 份）",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]（只存 1 份）",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
        highlight: true,
      },
      {
        id: "B2",
        roleLabel: "A 私有尾 [8..9]",
        fillText: "未满 2/4",
        cells: ["tok", "tok", "", ""],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-priv",
        state: "private",
      },
      {
        id: "B3",
        roleLabel: "空闲物理块",
        fillText: "0/4",
        cells: ["", "", "", ""],
        refCnt: 0,
        refBadge: "空闲",
        refTone: "",
        state: "free",
      },
    ],
  },
  {
    step: 3,
    buttonLabel: "③ 请求 B 续写分配私有尾块",
    shortBtn: "③ B 独立续写",
    badgeText: "动作 3 / 5 · 满块零拷贝，续写配空块 B3",
    title: "动作 ③ · 请求 B 续写分配私有尾块（满块前缀零拷贝共享，新位置写独立空块 B3）",
    takeaway: "各聊各的问题互不干扰：共享前缀 B0、B1 已满只读；B 的新问题直接领空块 B3 写入。",
    detail:
      "因 B0、B1 均已写满 4/4，请求 B 续写位置 [8..9] 直接从空闲队列摘出空块 B3（注意区分：只有对未写满且 ref_cnt > 1 的共享块做原地追加修改时，才会触发真正的块拷贝 CoW）。",
    savedCellsText: "省 8 格（仅算 B 私有尾 2 格）",
    savedNote: "B 新尾块回看 B0, B1 历史但零重算前缀",
    freeLruQueue: ["B4"],
    reqA: {
      name: "请求 A",
      stateText: "运行中",
      stateTone: "is-run",
      active: false,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys" },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys" },
        { text: "用户提问：「帮我写快排」", target: "B2", tone: "is-priv" },
      ],
    },
    reqB: {
      name: "请求 B",
      stateText: "独立续写",
      stateTone: "is-run",
      active: true,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys" },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys" },
        { text: "用户提问：「解释 KV Cache」", target: "B3", tone: "is-priv", flow: true },
      ],
    },
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
      },
      {
        id: "B2",
        roleLabel: "A 私有尾：「写快排」",
        fillText: "2/4",
        cells: ["tok", "tok", "", ""],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-priv",
        state: "private",
      },
      {
        id: "B3",
        roleLabel: "B 私有尾：「解释 KV」",
        fillText: "2/4",
        cells: ["tok", "tok", "", ""],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-priv",
        state: "private",
        highlight: true,
      },
    ],
  },
  {
    step: 4,
    buttonLabel: "④ 请求 A 结束释放",
    shortBtn: "④ A 结束释放",
    badgeText: "动作 4 / 5 · 安全释放",
    title: "动作 ④ · 请求 A 结束释放（B0, B1 ref_cnt 降为 1 仍存活；全归零才入空闲 LRU）",
    takeaway: "请求 A 结束了也不会误删共享块：只有 A 独占的 B2 归零回收；B0、B1 因 B 还在用而保留。",
    detail:
      "引用计数归零是唯一回收门禁：A 释放后私有块 B2 的 ref_cnt 归 0 立即挂入空闲 LRU 队列；待 B 也结束后，整条链按 B3 → B1 → B0 倒序入空闲 LRU，优先淘汰尾部、尽量保留公共根块。",
    savedCellsText: "累计省 8 格 + 省 2 块重复显存",
    savedNote: "待 B 结束归零后按 B3→B1→B0 倒序入 LRU",
    freeLruQueue: ["B2", "B4"],
    reqA: {
      name: "请求 A",
      stateText: "已结束释放",
      stateTone: "",
      active: false,
      dim: true,
      slots: [{ text: "已生成完毕，归还块表引用", target: null, tone: "is-empty" }],
    },
    reqB: {
      name: "请求 B",
      stateText: "照常解码",
      stateTone: "is-run",
      active: true,
      dim: false,
      slots: [
        { text: "系统提示：「你是昇腾助手…」", target: "B0", tone: "is-sys" },
        { text: "格式约束：「严格输出 JSON…」", target: "B1", tone: "is-sys" },
        { text: "用户提问：「解释 KV Cache」", target: "B3", tone: "is-priv" },
      ],
    },
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀（B 仍在用）",
        fillText: "ref 2→1",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 1,
        refBadge: "ref 2→1",
        refTone: "ref-1",
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "共享前缀（B 仍在用）",
        fillText: "ref 2→1",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 1,
        refBadge: "ref 2→1",
        refTone: "ref-1",
        state: "shared",
        highlight: true,
      },
      {
        id: "B2",
        roleLabel: "原 A 尾块（归零回收）",
        fillText: "ref 1→0",
        cells: ["", "", "", ""],
        refCnt: 0,
        refBadge: "ref 1→0",
        refTone: "",
        state: "free",
        highlight: true,
      },
      {
        id: "B3",
        roleLabel: "B 私有尾（解码中）",
        fillText: "3/4",
        cells: ["tok", "tok", "tok", ""],
        refCnt: 1,
        refBadge: "ref = 1",
        refTone: "ref-priv",
        state: "private",
      },
    ],
  },
  {
    step: 5,
    buttonLabel: "⑤ 写时复制 CoW 分叉",
    shortBtn: "⑤ CoW 分叉拷贝",
    badgeText: "动作 5 / 5 · CoW 拷贝 B3→B2，B3 ref 2→1",
    title: "动作 ⑤ · 写时复制 CoW 分叉（改写 ref_cnt > 1 共享块 B3 时拷出新块 B2，B3 ref 2→1）",
    takeaway: "想修改多人共用的未满块 B3？不能硬改：先拷一份到新块 B2 给 C 改，原块 B3 留给 B 安全读！",
    detail:
      "分支 C 原本与请求 B 共享 [B0, B1, B3]（B3 的 ref_cnt = 2）。当 C 需要原地改写 B3 槽位时，调度器从空闲队头 [ B4 ] 前摘出 B2 拷贝 B3 原内容并改写，B3 引用减为 1（2→1）供 B 无损继续读取。",
    savedCellsText: "仅拷 1 块 B3→B2（B0, B1 仍共享）",
    savedNote: "写时隔离：B 续读 B3，C 改写新块 B2",
    freeLruQueue: ["B4"],
    cowCopyFromTo: ["B3", "B2"],
    reqA: {
      name: "请求 B（原读分支）",
      stateText: "无损续读",
      stateTone: "is-run",
      active: false,
      dim: false,
      slots: [
        { text: "系统提示 + 格式约束", target: "B0", tone: "is-sys" },
        { text: "原分支尾部（继续读 B3）", target: "B3", tone: "is-sys" },
      ],
    },
    reqB: {
      name: "分支 C（原地改写）",
      stateText: "CoW 分身拷贝",
      stateTone: "is-cow",
      active: true,
      dim: false,
      slots: [
        { text: "系统提示 + 格式约束", target: "B0", tone: "is-sys" },
        { text: "改写分支尾部 → 绑新块 B2", target: "B2", tone: "is-cow", flow: true },
      ],
    },
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "写满 4/4",
        cells: ["kv", "kv", "kv", "kv"],
        refCnt: 2,
        refBadge: "ref = 2",
        refTone: "ref-2",
        state: "shared",
      },
      {
        id: "B2",
        roleLabel: "CoW 新块（拷自 B3 并改写）",
        fillText: "拷贝改写",
        cells: ["tok", "tok", "cow", ""],
        refCnt: 1,
        refBadge: "新 ref=1",
        refTone: "ref-cow",
        state: "cow",
        highlight: true,
      },
      {
        id: "B3",
        roleLabel: "原块保留（供 B 无损读）",
        fillText: "ref 2→1",
        cells: ["tok", "tok", "tok", ""],
        refCnt: 1,
        refBadge: "ref 2→1",
        refTone: "ref-1",
        state: "shared",
        highlight: true,
      },
    ],
  },
];

export interface PrefixCachingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PrefixDiagramMode | undefined;
  readonly initialStep?: PrefixCachingStep | undefined;
}

const BLOCK_WIRE_Y: Record<PrefixBlockView["id"], number> = {
  B0: 54,
  B1: 118,
  B2: 182,
  B3: 246,
};

function renderRequestCard(card: PrefixRequestCardSpec) {
  return (
    <div className={`wiki-edu-req-card${card.active ? " is-active" : ""}${card.dim ? " is-dim" : ""}`}>
      <div className="wiki-edu-req-head">
        <span className="wiki-edu-req-name">{card.name}</span>
        <span className={`wiki-edu-pill-state ${card.stateTone}`.trim()}>{card.stateText}</span>
      </div>
      <div className="wiki-edu-tok-list">
        {card.slots.map((slot) => (
          <div key={slot.text} className={`wiki-edu-tok-pill ${slot.tone}`}>
            <span>{slot.text}</span>
            {slot.target && <span className="wiki-edu-ptr-tag">{`→ ${slot.target}`}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrefixCachingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
}: PrefixCachingInteractiveProps) {
  const [mode, setMode] = useState<PrefixDiagramMode>(initialMode);
  const [step, setStep] = useState<PrefixCachingStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = PREFIX_CACHING_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mKv = `${id}-${uid}-pc-kv`;
  const mTok = `${id}-${uid}-pc-tok`;
  const mAccent = `${id}-${uid}-pc-accent`;
  const mCow = `${id}-${uid}-pc-cow`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        return (prev + 1) as PrefixCachingStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: PrefixCachingStep) => {
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
        selectStep(Math.min(5, step + 1) as PrefixCachingStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as PrefixCachingStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectStep(Number(event.key) as PrefixCachingStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const buildWires = (slots: readonly PrefixSlotPill[], baseY: number, isB: boolean) =>
    slots.map((slot, idx) => {
      if (!slot.target) return null;
      const y1 = baseY + idx * 32;
      const y2 = BLOCK_WIRE_Y[slot.target];
      const stroke = slot.tone.includes("cow")
        ? "#9a4b86"
        : slot.flow && slot.tone.includes("hit")
          ? "#e85b32"
          : slot.tone.includes("priv")
            ? "#087f73"
            : "#4c65b6";
      const marker = slot.tone.includes("cow")
        ? mCow
        : slot.flow && slot.tone.includes("hit")
          ? mAccent
          : slot.tone.includes("priv")
            ? mTok
            : mKv;
      const opacity = isB || !spec.reqB.active ? 0.92 : 0.44;
      return (
        <path
          key={`${baseY}-${slot.text}`}
          className={`wiki-edu-wire${slot.flow ? " is-flow" : ""}`}
          d={`M 4 ${y1} C 66 ${y1}, 72 ${y2}, 130 ${y2}`}
          stroke={stroke}
          opacity={opacity}
          markerEnd={`url(#${marker})`}
        />
      );
    });

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
      kickerTitle="Prefix Caching（前缀缓存与写时复制 CoW）"
      question="两个请求都带相同的系统提示词，为什么第二个不用重算？"
      toolbarLabel="Prefix Caching 共享块表与写时复制控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="prefix-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "accent")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as PrefixCachingStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as PrefixCachingStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="前缀缓存五步动作演化">
            {PREFIX_CACHING_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`prefix-step-${item.step}`}
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
      takeawayTone={spec.step === 2 || spec.step === 5 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.savedCellsText}
      detailsSummary="查看工程与源码细节（链式哈希 / ref_cnt / 倒序 LRU 回收规则）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}（空闲队列队头 [ {spec.freeLruQueue.join(", ")} ] 队尾）
        </>
      }
    >
      <div className="wiki-edu-pc-grid">
        <div className="wiki-edu-pc-requests">
          <div className="wiki-edu-col-title">
            <span>输入对话（逻辑块）</span>
            <span>每块 4 格示意</span>
          </div>
          {renderRequestCard(spec.reqA)}
          {renderRequestCard(spec.reqB)}
        </div>

        <div className="wiki-edu-wires-col">
          <svg
            className="wiki-edu-wires-svg"
            viewBox="0 0 136 288"
            width="136"
            height="288"
            role="img"
            aria-label={`Prefix Caching 连线：${spec.title}`}
          >
            <defs>
              <marker
                id={mKv}
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
                id={mTok}
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
                id={mCow}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#9a4b86" />
              </marker>
            </defs>
            {buildWires(spec.reqA.slots, 64, false)}
            {buildWires(spec.reqB.slots, 198, true)}
            {spec.cowCopyFromTo && (
              <path
                className="wiki-edu-wire is-flow"
                d="M 130 244 C 102 236, 102 202, 130 192"
                stroke="#9a4b86"
                markerEnd={`url(#${mCow})`}
              />
            )}
          </svg>
        </div>

        <div className="wiki-edu-hbm">
          <div className="wiki-edu-col-title">
            <span>NPU 显存物理块池（HBM）</span>
            <span className="mono">{`空闲队列：${spec.freeLruQueue.join(", ")}`}</span>
          </div>
          {spec.blocks.map((block) => (
            <div
              key={block.id}
              className={`wiki-edu-block is-${block.state}${block.highlight ? " is-highlight" : ""}`}
            >
              <div className="wiki-edu-block-id">{block.id}</div>
              <div>
                <div className="wiki-edu-block-title">{block.roleLabel}</div>
                <div className="wiki-edu-cells">
                  {block.cells.map((cell, cellIdx) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed 4-cell memory tray slots
                      key={cellIdx}
                      className={`wiki-edu-cell${cell ? ` fill-${cell}` : ""}`}
                    />
                  ))}
                </div>
              </div>
              <span className={`wiki-edu-ref-badge ${block.refTone}`.trim()}>{block.refBadge}</span>
            </div>
          ))}
          {spec.cowCopyFromTo && (
            <div className="wiki-edu-cow-banner">
              ⚡ 写时复制：原块 B3 正在被 B 读取，先拷贝 1 份到 B2 再改写！
            </div>
          )}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
