import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export type PrefixCachingStep = 1 | 2 | 3 | 4 | 5;
export type PrefixDiagramMode = "svg" | "sandbox";
export const PREFIX_HIT_PRESETS = ["full-8", "half-7", "diff-salt", "cow-fork"] as const;
export type PrefixHitPreset = (typeof PREFIX_HIT_PRESETS)[number];
export const PREFIX_EVICT_STAGES = ["none", "ab-released", "alloc-evict"] as const;
export type PrefixEvictStage = (typeof PREFIX_EVICT_STAGES)[number];

export interface PrefixBlockView {
  readonly id: "B0" | "B1" | "B2" | "B3" | "B4" | "B5";
  readonly roleLabel: string;
  readonly fillText: string;
  readonly cells: readonly ("kv" | "tok" | "cow" | "")[];
  readonly refCnt: 0 | 1 | 2;
  readonly refBadge: string;
  readonly refTone: "" | "ref-1" | "ref-2" | "ref-priv" | "ref-cow";
  readonly state: "shared" | "private" | "cow" | "free";
  readonly highlight?: boolean;
}

const FREE_BLOCK = (id: PrefixBlockView["id"], roleLabel = "空闲物理块"): PrefixBlockView => ({
  id,
  roleLabel,
  fillText: "0/4",
  cells: ["", "", "", ""],
  refCnt: 0,
  refBadge: "空闲",
  refTone: "",
  state: "free",
});

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
    freeLruQueue: ["B3", "B4", "B5"],
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
      FREE_BLOCK("B4"),
      FREE_BLOCK("B5"),
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
    freeLruQueue: ["B3", "B4", "B5"],
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
      FREE_BLOCK("B4"),
      FREE_BLOCK("B5"),
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
    freeLruQueue: ["B4", "B5"],
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
      FREE_BLOCK("B4"),
      FREE_BLOCK("B5"),
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
    freeLruQueue: ["B4", "B5", "B2"],
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
      FREE_BLOCK("B4"),
      FREE_BLOCK("B5"),
    ],
  },
  {
    step: 5,
    buttonLabel: "⑤ 写时复制 CoW 分叉",
    shortBtn: "⑤ CoW 分叉拷贝",
    badgeText: "动作 5 / 5 · CoW 拷贝 B3→B4，B3 ref 2→1",
    title: "动作 ⑤ · 写时复制 CoW 分叉（改写 ref_cnt > 1 共享块 B3 时拷出新块 B4，B3 ref 2→1）",
    takeaway: "想修改多人共用的未满块 B3？不能硬改：从队头摘空块 B4 拷一份给 C 改，原块 B3 留给 B 安全读！",
    detail:
      "分支 C 原本与请求 B 共享 [B0, B1, B3]（B3 的 ref_cnt = 2）。当 C 需要原地改写 B3 槽位时，调度器从空闲队头摘出 B4（队列余 [ B5, B2 ]）拷贝 B3 原内容并改写，B3 引用减为 1（2→1）供 B 无损继续读取。",
    savedCellsText: "仅拷 1 块 B3→B4（B0, B1 仍共享）",
    savedNote: "写时隔离：B 续读 B3，C 改写新块 B4",
    freeLruQueue: ["B5", "B2"],
    cowCopyFromTo: ["B3", "B4"],
    reqA: {
      name: "请求 B（原读分支）",
      stateText: "无损续读",
      stateTone: "is-run",
      active: false,
      dim: false,
      slots: [
        { text: "系统提示 [0..3]（共享）", target: "B0", tone: "is-sys" },
        { text: "格式约束 [4..7]（共享）", target: "B1", tone: "is-sys" },
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
        { text: "系统提示 [0..3]（共享）", target: "B0", tone: "is-sys" },
        { text: "格式约束 [4..7]（共享）", target: "B1", tone: "is-sys" },
        { text: "改写分支尾部 → 绑新块 B4", target: "B4", tone: "is-cow", flow: true },
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
      FREE_BLOCK("B2", "原 A 尾块（空闲待借）"),
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
      {
        id: "B4",
        roleLabel: "CoW 新块（拷自 B3 并改写）",
        fillText: "拷贝改写",
        cells: ["tok", "tok", "cow", ""],
        refCnt: 1,
        refBadge: "新 ref=1",
        refTone: "ref-cow",
        state: "cow",
        highlight: true,
      },
      FREE_BLOCK("B5"),
    ],
  },
];

export interface PrefixComputedState {
  readonly step: PrefixCachingStep;
  readonly hitPreset: PrefixHitPreset;
  readonly evictStage: PrefixEvictStage;
  readonly reusedCells: number;
  readonly recomputeCells: number;
  readonly copiedBlocks: number;
  readonly h0Registered: boolean;
  readonly h1Registered: boolean;
  readonly h1Note: string;
  readonly evictedBlocks: readonly string[];
  readonly freeLruQueue: readonly string[];
  readonly lastTokenLogitsRecomputed: true;
  readonly badgeText: string;
  readonly takeaway: string;
  readonly kpiText: string;
  readonly blocks: readonly PrefixBlockView[];
  readonly reqA: PrefixRequestCardSpec;
  readonly reqB: PrefixRequestCardSpec;
  readonly cowCopyFromTo?: readonly [PrefixBlockView["id"], PrefixBlockView["id"]];
}

export function computePrefixPoolState(
  step: PrefixCachingStep = 2,
  hitPreset: PrefixHitPreset = "full-8",
  evictStage: PrefixEvictStage = "none",
): PrefixComputedState {
  const effectiveStep: PrefixCachingStep = hitPreset === "cow-fork" ? 5 : step;
  const base = PREFIX_CACHING_STEPS[effectiveStep - 1]!;

  if (evictStage === "ab-released") {
    return {
      step: effectiveStep,
      hitPreset,
      evictStage,
      reusedCells: 8,
      recomputeCells: 0,
      copiedBlocks: 0,
      h0Registered: true,
      h1Registered: true,
      h1Note: "h1→B1 留存待捡回",
      evictedBlocks: [],
      freeLruQueue: ["B4", "B5", "B2", "B3", "B1", "B0"],
      lastTokenLogitsRecomputed: true,
      badgeText: "倒序尾插回收 · 空块居前，叶 B1 先于根 B0",
      takeaway:
        "原空闲块 B4、B5 仍在队头；A 与 B 释放块按「无哈希尾 B2,B3 → 叶 B1 → 根 B0」依次追加到空闲队列末尾，优先留存公共根块！",
      kpiText: "队序 [B4,B5,B2,B3,B1,B0] · 叶先于根",
      blocks: [
        {
          id: "B0",
          roleLabel: "根块缓存留存 (殿后最晚汰)",
          fillText: "ref=0 留存",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 0,
          refBadge: "ref=0 缓",
          refTone: "",
          state: "free",
          highlight: true,
        },
        {
          id: "B1",
          roleLabel: "叶块缓存留存 (排 B0 前)",
          fillText: "ref=0 留存",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 0,
          refBadge: "ref=0 缓",
          refTone: "",
          state: "free",
          highlight: true,
        },
        {
          id: "B2",
          roleLabel: "原 A 私有尾 (无哈希空闲)",
          fillText: "空闲",
          cells: ["", "", "", ""],
          refCnt: 0,
          refBadge: "空闲",
          refTone: "",
          state: "free",
        },
        {
          id: "B3",
          roleLabel: "原 B 私有尾 (无哈希空闲)",
          fillText: "空闲",
          cells: ["", "", "", ""],
          refCnt: 0,
          refBadge: "空闲",
          refTone: "",
          state: "free",
        },
        {
          id: "B4",
          roleLabel: "原空闲块 (队头首借)",
          fillText: "0/4",
          cells: ["", "", "", ""],
          refCnt: 0,
          refBadge: "队头",
          refTone: "",
          state: "free",
        },
        FREE_BLOCK("B5"),
      ],
      reqA: {
        name: "请求 A",
        stateText: "已释放",
        stateTone: "",
        active: false,
        dim: true,
        slots: [{ text: "私有尾 B2 先追加至原空块后", target: null, tone: "is-empty" }],
      },
      reqB: {
        name: "请求 B",
        stateText: "已释放",
        stateTone: "",
        active: false,
        dim: true,
        slots: [{ text: "倒序 B3→B1→B0 尾插追加至队尾", target: null, tone: "is-empty" }],
      },
    };
  }

  if (evictStage === "alloc-evict") {
    return {
      step: effectiveStep,
      hitPreset,
      evictStage,
      reusedCells: 0,
      recomputeCells: 20,
      copiedBlocks: 0,
      h0Registered: true,
      h1Registered: false,
      h1Note: "h1 已随叶块 B1 驱逐抹除",
      evictedBlocks: ["B1"],
      freeLruQueue: ["B0"],
      lastTokenLogitsRecomputed: true,
      badgeText: "施压连借 5 块 · 叶块 B1 先于根块 B0 被驱逐",
      takeaway:
        "无关新批次从 LRU 队头连借 5 块（B4、B5、B2、B3、B1 共 20 格全自算）：叶子块 B1 先被借走抹除 h1，殿后的根块 B0 仍安全留存在缓存池队尾！",
      kpiText: "连借 5 块汰叶 B1 · 根 B0 仍留存",
      blocks: [
        {
          id: "B0",
          roleLabel: "根块存活 (h0 仍可命中!)",
          fillText: "ref=0 存活",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 0,
          refBadge: "根块留存",
          refTone: "ref-1",
          state: "shared",
          highlight: true,
        },
        {
          id: "B1",
          roleLabel: "叶块已驱逐 [16..19]",
          fillText: "4/4 覆写",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "已驱逐重分",
          refTone: "ref-cow",
          state: "cow",
          highlight: true,
        },
        {
          id: "B2",
          roleLabel: "新单借用块 3 [8..11]",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "新 ref=1",
          refTone: "ref-priv",
          state: "private",
        },
        {
          id: "B3",
          roleLabel: "新单借用块 4 [12..15]",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "新 ref=1",
          refTone: "ref-priv",
          state: "private",
        },
        {
          id: "B4",
          roleLabel: "新单借用块 1 [0..3]",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "新 ref=1",
          refTone: "ref-priv",
          state: "private",
        },
        {
          id: "B5",
          roleLabel: "新单借用块 2 [4..7]",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "新 ref=1",
          refTone: "ref-priv",
          state: "private",
        },
      ],
      reqA: {
        name: "原共享链",
        stateText: "局部存活",
        stateTone: "is-hit",
        active: false,
        dim: false,
        slots: [
          { text: "根块 h0 仍在空闲队尾可捡回", target: "B0", tone: "is-sys" },
          { text: "叶块 h1 已被借走抹除", target: null, tone: "is-empty" },
        ],
      },
      reqB: {
        name: "新批次施压 (20格)",
        stateText: "队头借 5 块",
        stateTone: "is-cow",
        active: true,
        dim: false,
        slots: [
          { text: "[0..3] 队头摘原空块 B4", target: "B4", tone: "is-priv" },
          { text: "[4..7] 续摘原空块 B5", target: "B5", tone: "is-priv" },
          { text: "[8..11] 续摘无哈希块 B2", target: "B2", tone: "is-priv" },
          { text: "[12..15] 续摘无哈希块 B3", target: "B3", tone: "is-priv" },
          { text: "[16..19] 驱逐叶块 B1 覆写", target: "B1", tone: "is-cow", flow: true },
        ],
      },
    };
  }

  if (hitPreset === "half-7") {
    return {
      step: effectiveStep,
      hitPreset,
      evictStage,
      reusedCells: 4,
      recomputeCells: 6,
      copiedBlocks: 0,
      h0Registered: true,
      h1Registered: true,
      h1Note: "第7格差异 → 第2块失配",
      evictedBlocks: [],
      freeLruQueue: ["B5"],
      lastTokenLogitsRecomputed: true,
      badgeText: "半块 7 格同前缀 · 仅整块 B0 复用 4 格，后 6 格占 B3+B4",
      takeaway:
        "公共前缀减至 7 格（不足两整块）：标准 APC 只按 4 格满块对齐，仅复用 B0 的 4 格；剩余 6 格由 B 自算写入 B3（4/4）与尾块 B4（2/4）！",
      kpiText: "省 4/10 格 · 自算 6 格 (B3+B4)",
      blocks: [
        {
          id: "B0",
          roleLabel: "整块命中 [0..3] (共享)",
          fillText: "4/4",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 2,
          refBadge: "ref = 2",
          refTone: "ref-2",
          state: "shared",
          highlight: true,
        },
        {
          id: "B1",
          roleLabel: "A 第2块 [4..7] (仅 A 用)",
          fillText: "4/4",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-1",
          state: "shared",
        },
        {
          id: "B2",
          roleLabel: "A 私有尾 [8..9]",
          fillText: "2/4",
          cells: ["tok", "tok", "", ""],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-priv",
          state: "private",
        },
        {
          id: "B3",
          roleLabel: "B 重算满块 [4..7]",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-priv",
          state: "private",
          highlight: true,
        },
        {
          id: "B4",
          roleLabel: "B 重算私有尾 [8..9]",
          fillText: "2/4",
          cells: ["tok", "tok", "", ""],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-priv",
          state: "private",
          highlight: true,
        },
        FREE_BLOCK("B5"),
      ],
      reqA: base.reqA,
      reqB: {
        name: "请求 B (共前缀 7 格)",
        stateText: "仅首块命中",
        stateTone: "is-hit",
        active: true,
        dim: false,
        slots: [
          { text: "前 4 格整块命中 → 复用 B0", target: "B0", tone: "is-sys is-hit", flow: true },
          { text: "第 5..8 格失配自算 → 写满 B3", target: "B3", tone: "is-priv", flow: true },
          { text: "末 2 格 [8..9] 自算 → 写尾块 B4", target: "B4", tone: "is-priv", flow: true },
        ],
      },
    };
  }

  if (hitPreset === "diff-salt") {
    return {
      step: effectiveStep,
      hitPreset,
      evictStage,
      reusedCells: 0,
      recomputeCells: 10,
      copiedBlocks: 0,
      h0Registered: true,
      h1Registered: true,
      h1Note: "异盐 salt_B → 首块 h0' 即失配",
      evictedBlocks: [],
      freeLruQueue: [],
      lastTokenLogitsRecomputed: true,
      badgeText: "不同租户 cache_salt · 10 格独立占满 B3, B4, B5",
      takeaway:
        "请求 B 虽带相同文本，但传入不同 cache_salt 身份键：首块指纹 h0'≠h0 连环失配，B 的 10 格独立分配 B3（4/4）、B4（4/4）、B5（2/4）全量重算！",
      kpiText: "异盐 0 命中 · 独占 B3,B4,B5 (10格)",
      blocks: [
        {
          id: "B0",
          roleLabel: "A 盐值块 [0..3] (隔离)",
          fillText: "4/4",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-1",
          state: "shared",
        },
        {
          id: "B1",
          roleLabel: "A 盐值块 [4..7] (隔离)",
          fillText: "4/4",
          cells: ["kv", "kv", "kv", "kv"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-1",
          state: "shared",
        },
        {
          id: "B2",
          roleLabel: "A 私有尾 [8..9]",
          fillText: "2/4",
          cells: ["tok", "tok", "", ""],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-priv",
          state: "private",
        },
        {
          id: "B3",
          roleLabel: "B 异盐块 [0..3] (独立)",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-cow",
          state: "cow",
          highlight: true,
        },
        {
          id: "B4",
          roleLabel: "B 异盐块 [4..7] (独立)",
          fillText: "4/4",
          cells: ["tok", "tok", "tok", "tok"],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-cow",
          state: "cow",
          highlight: true,
        },
        {
          id: "B5",
          roleLabel: "B 异盐尾 [8..9] (独立)",
          fillText: "2/4",
          cells: ["tok", "tok", "", ""],
          refCnt: 1,
          refBadge: "ref = 1",
          refTone: "ref-priv",
          state: "private",
          highlight: true,
        },
      ],
      reqA: base.reqA,
      reqB: {
        name: "请求 B (不同 cache_salt)",
        stateText: "异盐 0 命中",
        stateTone: "is-cow",
        active: true,
        dim: false,
        slots: [
          { text: "异盐首块 [0..3] h0'≠h0 → B3", target: "B3", tone: "is-cow", flow: true },
          { text: "异盐次块 [4..7] 链式独立 → B4", target: "B4", tone: "is-cow", flow: true },
          { text: "异盐尾块 [8..9] 独立分配 → B5", target: "B5", tone: "is-priv" },
        ],
      },
    };
  }

  return {
    step: effectiveStep,
    hitPreset,
    evictStage,
    reusedCells: effectiveStep === 1 ? 0 : 8,
    recomputeCells: effectiveStep === 1 ? 10 : effectiveStep === 5 ? 1 : 2,
    copiedBlocks: effectiveStep === 5 ? 1 : 0,
    h0Registered: true,
    h1Registered: true,
    h1Note: "h1=H(h0,[4..7])→B1",
    evictedBlocks: [],
    freeLruQueue: base.freeLruQueue,
    lastTokenLogitsRecomputed: true,
    badgeText: base.badgeText,
    takeaway: base.takeaway,
    kpiText: base.savedCellsText,
    blocks: base.blocks,
    reqA: base.reqA,
    reqB: base.reqB,
    ...(base.cowCopyFromTo ? { cowCopyFromTo: base.cowCopyFromTo } : {}),
  };
}

export interface PrefixCachingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PrefixDiagramMode | undefined;
  readonly initialStep?: PrefixCachingStep | undefined;
  readonly initialHitPreset?: PrefixHitPreset | undefined;
  readonly initialEvictStage?: PrefixEvictStage | undefined;
}

const BLOCK_ROW_Y: Record<PrefixBlockView["id"], number> = {
  B0: 60,
  B1: 95,
  B2: 130,
  B3: 165,
  B4: 200,
  B5: 235,
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
  initialHitPreset = "full-8",
  initialEvictStage = "none",
}: PrefixCachingInteractiveProps) {
  const [mode, setMode] = useState<PrefixDiagramMode>(initialMode);
  const [step, setStep] = useState<PrefixCachingStep>(initialStep);
  const [hitPreset, setHitPreset] = useState<PrefixHitPreset>(initialHitPreset);
  const [evictStage, setEvictStage] = useState<PrefixEvictStage>(initialEvictStage);
  const [playing, setPlaying] = useState(false);

  const state = useMemo(
    () => computePrefixPoolState(step, hitPreset, evictStage),
    [step, hitPreset, evictStage],
  );
  const spec = PREFIX_CACHING_STEPS[state.step - 1]!;
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
    setHitPreset("full-8");
    setEvictStage("none");
    setStep(next);
  };

  const toggleAutoPlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    setHitPreset("full-8");
    setEvictStage("none");
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
      extraRootAttrs={{
        "data-step": state.step,
        "data-hit-preset": hitPreset,
        "data-evict-stage": evictStage,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="prefix-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={state.step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, state.step - 1) as PrefixCachingStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={state.step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, state.step + 1) as PrefixCachingStep)}
            >
              下一步 ›
            </button>
            {PREFIX_CACHING_STEPS.map((item) => {
              const active =
                mode === "sandbox" &&
                evictStage === "none" &&
                (hitPreset === "full-8" || (hitPreset === "cow-fork" && item.step === 5)) &&
                state.step === item.step;
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="前缀命中档位与倒序驱逐实验">
            {(
              [
                ["full-8", "全命中8格"],
                ["half-7", "半块7格(仅复4格)"],
                ["diff-salt", "异盐0命中"],
                ["cow-fork", "CoW共享尾分叉"],
              ] as const
            ).map(([hp, label]) => {
              const active = mode === "sandbox" && evictStage === "none" && hitPreset === hp;
              return (
                <button
                  key={hp}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`prefix-preset-${hp}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setEvictStage("none");
                    setHitPreset(hp);
                    if (hp === "cow-fork") setStep(5);
                    else if (step === 1 || step === 5) setStep(2);
                  }}
                >
                  {label}
                </button>
              );
            })}
            {(
              [
                ["ab-released", "A+B全释入LRU"],
                ["alloc-evict", "施压先汰叶B1"],
              ] as const
            ).map(([es, label]) => {
              const active = mode === "sandbox" && evictStage === es;
              return (
                <button
                  key={es}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`prefix-evict-${es}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setEvictStage(es);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={state.badgeText}
      takeawayTone={
        evictStage === "alloc-evict" || (evictStage === "none" && hitPreset === "diff-salt")
          ? "warn"
          : evictStage === "none" && (state.step === 2 || state.step === 5)
            ? "accent"
            : "default"
      }
      takeaway={state.takeaway}
      kpi={state.kpiText}
      detailsSummary="查看工程与源码细节（链式哈希 / ref_cnt / 倒序 LRU 回收与末位 logits 重算边界）"
      detailsContent={
        <>
          <strong>
            {evictStage === "ab-released"
              ? "倒序尾插回收 · A 与 B 全部释放归池"
              : evictStage === "alloc-evict"
                ? "LRU 队头施压借块 · 先汰叶块 B1 保根块 B0"
                : hitPreset === "half-7"
                  ? "半块 7 格同前缀 · 整块对齐复用边界"
                  : hitPreset === "diff-salt"
                    ? "多租户 cache_salt 隔离 · 首块指纹即分流"
                    : spec.title}
          </strong>
          ：
          {evictStage === "ab-released"
            ? "请求归还块引用归零后追加到 FreeKVCacheBlockQueue 队尾：原空块 B4、B5 居前先借，A 与 B 的无哈希尾块 B2、B3 次之，满块链按 B1（叶）→ B0（根）倒序入队。"
            : evictStage === "alloc-evict"
              ? "新批次申请 20 格（5 块）时从空闲队头依次弹出 B4、B5、B2、B3、B1：弹出叶块 B1 时同步抹除 h1 哈希项，而排在队尾的根块 B0 与 h0 完好留存。"
              : hitPreset === "half-7"
                ? "标准 APC 仅对写满整块（4/4）注册块哈希：7 格公共前缀仅首块 B0（4 格）命中复用，第 2 块因第 7 格起文本分叉失配，剩余 6 格由 B 自算写入 B3（4/4）与尾块 B4（2/4）。"
                : hitPreset === "diff-salt"
                  ? "额外身份键 cache_salt 参与首块哈希混入：h0' = H(salt_B, [0..3]) ≠ h0，首块即失配导致整条哈希链分流，B 独立分配 B3、B4、B5 全量重算 10 格。"
                  : spec.detail}
          （当前核算：复用 <code>{state.reusedCells}</code> 格、自算 <code>{state.recomputeCells}</code>{" "}
          格、块复制 <code>{state.copiedBlocks}</code> 块；常规整段全命中时仍须回退保留末 <code>1</code>{" "}
          个位置计算下一词 logits；空闲队列队头 [ {state.freeLruQueue.join(", ")} ] 队尾）
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              ① 逻辑块表 → 链式哈希索引 → HBM 物理块槽与倒序 LRU 全景图
            </span>
            <span className="wiki-edu-badge is-good">{`复用 ${state.reusedCells} 格 · 拷贝 ${state.copiedBlocks} 块`}</span>
          </div>

          <svg
            viewBox="0 0 860 286"
            width="860"
            height="286"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`Prefix Caching 全景状态：${state.badgeText}`}
          >
            <defs>
              <marker
                id={mKv}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#4c65b6" />
              </marker>
              <marker
                id={mTok}
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
                id={mAccent}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#e85b32" />
              </marker>
              <marker
                id={mCow}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#9a4b86" />
              </marker>
            </defs>

            <text x="104" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ① 逻辑块表
            </text>
            <text x="312" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ② 链式哈希表
            </text>
            <text x="546" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ③ 物理块池(ref)
            </text>
            <text x="768" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ④ 空闲 LRU
            </text>

            <rect
              x="12"
              y="38"
              width="184"
              height="90"
              rx="8"
              fill="#fbfaf6"
              stroke="#4c65b6"
              strokeWidth="1.4"
            />
            <text x="104" y="58" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {state.reqA.name.slice(0, 10)}
            </text>
            <text x="104" y="86" textAnchor="middle" fontSize="12" fill="#4c65b6">
              {evictStage === "alloc-evict"
                ? "根块 h0→B0 留存"
                : evictStage === "ab-released"
                  ? "引用归零返池"
                  : state.step === 4 && hitPreset === "full-8"
                    ? "退共享引用 2→1"
                    : "前缀 → B0, B1"}
            </text>
            <text x="104" y="112" textAnchor="middle" fontSize="12" fill="#087f73">
              {evictStage === "alloc-evict"
                ? "叶块 B1 已被汰"
                : evictStage === "ab-released"
                  ? "尾块已回收"
                  : state.step === 5
                    ? "原读尾 → B3"
                    : state.step === 4 && hitPreset === "full-8"
                      ? "尾块 B2 已回收"
                      : "私有尾 → B2"}
            </text>

            <rect
              x="12"
              y="138"
              width="184"
              height="94"
              rx="8"
              fill={evictStage === "none" && hitPreset === "diff-salt" ? "#fff0e9" : "#ddf4ef"}
              stroke={evictStage === "none" && hitPreset === "diff-salt" ? "#b54237" : "#087f73"}
              strokeWidth="1.5"
            />
            <text x="104" y="158" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {evictStage === "alloc-evict"
                ? "新批次施压 (20格)"
                : evictStage === "ab-released"
                  ? "请求 B (已释放)"
                  : hitPreset === "half-7"
                    ? "请求 B (共7格)"
                    : hitPreset === "diff-salt"
                      ? "请求 B (异盐)"
                      : state.reqB.name.slice(0, 10)}
            </text>
            <text x="104" y="186" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {evictStage === "alloc-evict"
                ? "连借5块汰叶B1"
                : evictStage === "ab-released"
                  ? "倒序尾插返池"
                  : hitPreset === "diff-salt"
                    ? "异盐 → B3,B4,B5重算"
                    : hitPreset === "half-7"
                      ? "首块B0+自算B3,B4"
                      : state.step === 5
                        ? "CoW改写 → B4"
                        : state.step === 1
                          ? "等待进入…"
                          : "零拷贝 → B0,B1"}
            </text>
            <rect x="24" y="198" width="160" height="24" rx="5" fill="#fff4cf" stroke="#c78300" />
            <text x="104" y="215" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
              末位1词必算 logits
            </text>

            <rect
              x="220"
              y="38"
              width="184"
              height="194"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <rect x="232" y="48" width="160" height="34" rx="6" fill="#e8edff" stroke="#4c65b6" />
            <text x="312" y="70" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              h0: 根[0..3]+盐A→B0
            </text>
            <rect
              x="232"
              y="98"
              width="160"
              height="38"
              rx="6"
              fill={
                !state.h1Registered ||
                (evictStage === "none" && (hitPreset === "diff-salt" || hitPreset === "half-7"))
                  ? "#fff0e9"
                  : "#e8edff"
              }
              stroke={
                !state.h1Registered ||
                (evictStage === "none" && (hitPreset === "diff-salt" || hitPreset === "half-7"))
                  ? "#b54237"
                  : "#4c65b6"
              }
              strokeDasharray={!state.h1Registered ? "4 2" : undefined}
            />
            <text x="312" y="122" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {!state.h1Registered
                ? "h1: 随叶B1驱逐抹除"
                : evictStage === "ab-released"
                  ? "h1: 留存待捡回"
                  : hitPreset === "half-7"
                    ? "第7格异: 块2失配"
                    : hitPreset === "diff-salt"
                      ? "异盐B: h0'失配"
                      : "h1: H(h0,[4..7])→B1"}
            </text>
            <rect x="232" y="152" width="160" height="68" rx="6" fill="#fff4cf" stroke="#c78300" />
            <text x="312" y="178" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              全命中恢复边界
            </text>
            <text x="312" y="204" textAnchor="middle" fontSize="12" fill="#66716d">
              留末1词算 logits
            </text>
            <path d="M 196 76 L 218 68" stroke="#4c65b6" strokeWidth="1.8" markerEnd={`url(#${mKv})`} />
            <path d="M 196 176 L 218 118" stroke="#087f73" strokeWidth="1.8" markerEnd={`url(#${mTok})`} />
            <path d="M 404 66 L 430 60" stroke="#4c65b6" strokeWidth="1.8" markerEnd={`url(#${mKv})`} />
            {state.h1Registered && (
              <path d="M 404 116 L 430 95" stroke="#4c65b6" strokeWidth="1.8" markerEnd={`url(#${mKv})`} />
            )}

            <rect
              x="432"
              y="38"
              width="228"
              height="224"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            {state.blocks.map((blk) => {
              const ry = BLOCK_ROW_Y[blk.id] - 15;
              const fill =
                blk.state === "shared"
                  ? "#e8edff"
                  : blk.state === "private"
                    ? "#ddf4ef"
                    : blk.state === "cow"
                      ? "#f7e7f2"
                      : "#ece9df";
              const stroke =
                blk.state === "shared"
                  ? "#4c65b6"
                  : blk.state === "private"
                    ? "#087f73"
                    : blk.state === "cow"
                      ? "#9a4b86"
                      : "#d8d8cf";
              return (
                <g key={`svg-${blk.id}`}>
                  <rect
                    x="444"
                    y={ry}
                    width="204"
                    height="30"
                    rx="6"
                    fill={fill}
                    stroke={blk.highlight ? "#e85b32" : stroke}
                    strokeWidth={blk.highlight ? "1.8" : "1.3"}
                    strokeDasharray={blk.state === "free" ? "4 2" : undefined}
                  />
                  <text x="546" y={ry + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {`${blk.id} · ${blk.fillText} · ${blk.refBadge}`}
                  </text>
                </g>
              );
            })}
            {state.cowCopyFromTo && (
              <path
                className="wiki-edu-wire is-flow"
                d={`M 650 ${BLOCK_ROW_Y[state.cowCopyFromTo[0]]} C 668 ${BLOCK_ROW_Y[state.cowCopyFromTo[0]] + 7}, 668 ${BLOCK_ROW_Y[state.cowCopyFromTo[1]] - 7}, 650 ${BLOCK_ROW_Y[state.cowCopyFromTo[1]]}`}
                stroke="#9a4b86"
                markerEnd={`url(#${mCow})`}
              />
            )}

            <path d="M 660 148 L 682 148" stroke="#e85b32" strokeWidth="1.8" markerEnd={`url(#${mAccent})`} />
            <rect
              x="684"
              y="38"
              width="164"
              height="224"
              rx="8"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="766" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
              队头 (先借走)
            </text>
            {state.freeLruQueue.length === 0 ? (
              <text x="766" y="140" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
                池已满 (0 空闲块)
              </text>
            ) : (
              state.freeLruQueue.slice(0, 6).map((qId, qi) => {
                const qy = 62 + qi * 25;
                const isLeaf = qId === "B1";
                const isRoot = qId === "B0";
                return (
                  <g key={`lru-${qId}`}>
                    <rect
                      x="700"
                      y={qy}
                      width="132"
                      height="21"
                      rx="5"
                      fill={isLeaf ? "#fff4cf" : isRoot ? "#ddf4ef" : "#ffffff"}
                      stroke={isLeaf ? "#c78300" : isRoot ? "#087f73" : "#d8d8cf"}
                    />
                    <text
                      x="766"
                      y={qy + 15}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#17211f"
                    >
                      {isLeaf ? "B1 (叶·先汰)" : isRoot ? "B0 (根·后汰)" : qId}
                    </text>
                  </g>
                );
              })
            )}
            <text x="766" y="248" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              叶B1早于根B0淘汰
            </text>

            <text x="430" y="278" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`账本：跳过 ${state.reusedCells} 格 · 自算 ${state.recomputeCells} 格 · 物理拷贝 ${state.copiedBlocks} 块`}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-pc-requests">
            <div className="wiki-edu-col-title">
              <span>请求逻辑块映射</span>
              <span>每块 4 格示意</span>
            </div>
            {renderRequestCard(state.reqA)}
            {renderRequestCard(state.reqB)}
          </div>

          <div className="wiki-edu-hbm">
            <div className="wiki-edu-col-title">
              <span>NPU 显存物理块池（HBM）</span>
              <span className="mono">{`LRU 队头→[${state.freeLruQueue.join(", ")}]`}</span>
            </div>
            {state.blocks.map((block) => (
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
            {state.cowCopyFromTo && (
              <div className="wiki-edu-cow-banner">
                {`⚡ 写时复制：原块 ${state.cowCopyFromTo[0]} 正在被 B 读取，先拷贝 1 份到 ${state.cowCopyFromTo[1]} 再改写！`}
              </div>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
