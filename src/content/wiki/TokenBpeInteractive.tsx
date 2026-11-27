import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const TOKEN_BPE_APPROVED_SHA256 = "c3dfda826ef7b7a9ec021d106223506425efe346bd020a5f2553a7f25388a964";

export type TokenBpeStep = 1 | 2 | 3 | 4 | 5;
export type TokenBpeMode = "sandbox" | "svg";

export interface BpePiece {
  readonly label: string;
  readonly sub?: string | undefined;
  readonly fresh?: boolean | undefined;
}

export interface TokenBpeStepSpec {
  readonly step: TokenBpeStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
  readonly activeRules: readonly number[];
  readonly doneRules: readonly number[];
  readonly pieces: readonly BpePiece[];
  readonly tokenId: number | null;
}

export const BPE_MERGE_RULES = [
  { id: 1, pair: "E6 + 8E", merged: "E6 8E", note: "「推」前两字节" },
  { id: 2, pair: "E7 + 90", merged: "E7 90", note: "「理」前两字节" },
  { id: 3, pair: "E6 8E + A8", merged: "推", note: "凑齐 3 字节「推」" },
  { id: 4, pair: "E7 90 + 86", merged: "理", note: "凑齐 3 字节「理」" },
  { id: 5, pair: "推 + 理", merged: "推理", note: "高频双字词成块" },
] as const;

export const TOKEN_BPE_STEPS: readonly TokenBpeStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 原始 UTF-8 字节",
    badgeText: "步骤 1 / 5 · 底层单字节",
    title: "动作 ① · 把「推理」拆成 6 个真实 UTF-8 单字节块",
    takeaway:
      "常用汉字在 UTF-8 下各占 3 字节：「推」是 E6 8E A8，「理」是 E7 90 86，256 种单字节兜底零未知词。",
    kpi: "6 个单字节块 · 0 次合并",
    detail:
      "字节级 BPE 将全部 256 个单字节收入基础词表：预切分围栏内「推理」转为 E6 8E A8 E7 90 86 共 6 块，哪怕生僻字或 emoji 最差也可退回单字节表示，无需 <unk>。",
    activeRules: [],
    doneRules: [],
    pieces: [
      { label: "E6", sub: "推[0]", fresh: true },
      { label: "8E", sub: "推[1]", fresh: true },
      { label: "A8", sub: "推[2]", fresh: true },
      { label: "E7", sub: "理[0]", fresh: true },
      { label: "90", sub: "理[1]", fresh: true },
      { label: "86", sub: "理[2]", fresh: true },
    ],
    tokenId: null,
  },
  {
    step: 2,
    shortBtn: "② 合并高频双字节",
    badgeText: "步骤 2 / 5 · 规则 1 & 2",
    title: "动作 ② · 按合并表优先级依次并出 E6 8E 与 E7 90",
    takeaway:
      "谁在合并表排最前就先并谁：规则 1 并出 E6 8E，规则 2 抢在规则 3 前并出 E7 90，每并 1 次少 1 块。",
    kpi: "剩 4 块 · 已合并 2 次",
    detail:
      "tokenizer.json 保存按共现频次排好序的合并规则表：第 1 轮 E6+8E（规则 1）→ 剩 5 块；第 2 轮 E7+90（规则 2）排名高于 E6 8E+A8（规则 3），先并出 E7 90 → 剩 4 块。",
    activeRules: [1, 2],
    doneRules: [1, 2],
    pieces: [
      { label: "E6 8E", sub: "规则 1", fresh: true },
      { label: "A8", sub: "待并" },
      { label: "E7 90", sub: "规则 2", fresh: true },
      { label: "86", sub: "待并" },
    ],
    tokenId: null,
  },
  {
    step: 3,
    shortBtn: "③ 凑齐单字「推」「理」",
    badgeText: "步骤 3 / 5 · 规则 3 & 4",
    title: "动作 ③ · 规则 3 与规则 4 分别凑齐完整汉字「推」「理」",
    takeaway:
      "E6 8E + A8 拼回完整汉字「推」，E7 90 + 86 拼回「理」；若生僻字缺规则（如「犇」），就会停在半字字节块。",
    kpi: "剩 2 块 · 已合并 4 次",
    detail:
      "第 3、4 轮分别合出单字「推」(E6 8E A8) 与「理」(E7 90 86)。对比生僻字「犇」(E7 8A 87)：若合并表只有 E7+8A，就会停在 [E7 8A, 87] 两个半字 token，流式输出需靠 IncrementalDetokenizer 攒齐 3 字节再吐字。",
    activeRules: [3, 4],
    doneRules: [1, 2, 3, 4],
    pieces: [
      { label: "推", sub: "E6 8E A8", fresh: true },
      { label: "理", sub: "E7 90 86", fresh: true },
    ],
    tokenId: null,
  },
  {
    step: 4,
    shortBtn: "④ 并成双字词「推理」",
    badgeText: "步骤 4 / 5 · 规则 5",
    title: "动作 ④ · 命中规则 5：相邻单字「推 + 理」合为 1 个子词块",
    takeaway:
      "「推理」在语料中高频共现，继续合并成单个子词块！6 个字节经 5 次合并浓缩成 1 块，序列长度立减 6 倍。",
    kpi: "剩 1 块 · 共合并 5 次",
    detail:
      "单步块数守恒：N_tok = N_byte - 合并次数 = 6 - 5 = 1。推广到全句「推理引擎怎么工作」8 字（24 字节）：N_tok = 24 - 16（字内合并）- 4（双字成词）= 4 个 token。",
    activeRules: [5],
    doneRules: [1, 2, 3, 4, 5],
    pieces: [{ label: "推理", sub: "6 字节合 1 块", fresh: true }],
    tokenId: null,
  },
  {
    step: 5,
    shortBtn: "⑤ 查词表得示意编号",
    badgeText: "步骤 5 / 5 · 字典映射",
    title: "动作 ⑤ · 对照配套词表查出示意编号 9123",
    takeaway: "最终子词块「推理」在词表里查出示意座位号 9123，经上下界安全校验后交由嵌入表抽出浮点数向量。",
    kpi: "「推理」→ 示意编号 9123",
    detail:
      "整句查表得教学示意序列 [9123, 40517, 2256, 1180]（合并表与编号均为示意）。真实 Qwen3-8B 标准词表 vocab_size = 151,936（eos=151645），InputProcessor._validate_model_input 严格拦截 < 0 或超出上界的越界编号。",
    activeRules: [],
    doneRules: [1, 2, 3, 4, 5],
    pieces: [{ label: "推理", sub: "词表条目" }],
    tokenId: 9123,
  },
];

export const TOKEN_BPE_PRESETS = ["tuili", "ben"] as const;
export type TokenBpePresetId = (typeof TOKEN_BPE_PRESETS)[number];

interface SimRule {
  readonly id: number;
  readonly rank: number;
  readonly left: string;
  readonly right: string;
  readonly merged: string;
  readonly stepGroup: 2 | 3 | 4;
  readonly isCompound?: boolean;
}

const SIM_MERGE_TABLE: readonly SimRule[] = [
  { id: 1, rank: 1, left: "E6", right: "8E", merged: "E6 8E", stepGroup: 2 },
  { id: 2, rank: 2, left: "E7", right: "90", merged: "E7 90", stepGroup: 2 },
  { id: 6, rank: 3, left: "E7", right: "8A", merged: "E7 8A", stepGroup: 2 },
  { id: 3, rank: 4, left: "E6 8E", right: "A8", merged: "推", stepGroup: 3 },
  { id: 4, rank: 5, left: "E7 90", right: "86", merged: "理", stepGroup: 3 },
  { id: 5, rank: 6, left: "推", right: "理", merged: "推理", stepGroup: 4, isCompound: true },
];

const DEMO_VOCAB_IDS: Readonly<Record<string, number>> = {
  推理: 9123,
  推: 5412,
  理: 5809,
  "E7 8A": 1420,
  "E6 8E": 1390,
  "E7 90": 1440,
  "87": 135,
  A8: 168,
  "86": 134,
};

export interface BpeTreeNode {
  readonly nodeId: string;
  readonly label: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly tier: 0 | 1 | 2 | 3;
  readonly ruleId: number | null;
  readonly createdAtStep: 1 | 2 | 3 | 4;
  readonly leftChildId: string | null;
  readonly rightChildId: string | null;
}

export interface BpeSimulationResult {
  readonly preset: TokenBpePresetId;
  readonly word: string;
  readonly rawHexBytes: readonly string[];
  readonly allNodes: readonly BpeTreeNode[];
  readonly activeRootNodes: readonly BpeTreeNode[];
  readonly mergesApplied: number;
  readonly activeRuleIds: readonly number[];
  readonly doneRuleIds: readonly number[];
  readonly tokenIds: readonly number[];
  readonly stoppedEarlyReason: string | null;
}

export function runBpeSimulation(
  preset: TokenBpePresetId,
  enableCompoundMerge: boolean,
  step: TokenBpeStep,
): BpeSimulationResult {
  const word = preset === "tuili" ? "推理" : "犇";
  const encoded = new TextEncoder().encode(word);
  const rawHexBytes = Array.from(encoded, (b) => b.toString(16).toUpperCase().padStart(2, "0"));

  const allNodes: BpeTreeNode[] = rawHexBytes.map((hex, idx) => ({
    nodeId: `b-${idx}`,
    label: hex,
    startByte: idx,
    endByte: idx,
    tier: 0,
    ruleId: null,
    createdAtStep: 1,
    leftChildId: null,
    rightChildId: null,
  }));

  let working: BpeTreeNode[] = [...allNodes];
  const doneRuleIds: number[] = [];
  const activeRuleIds: number[] = [];
  const maxAllowedStepGroup = step === 1 ? 1 : step >= 5 ? 4 : step;

  let mergeSeq = 0;
  while (working.length > 1) {
    let bestIdx = -1;
    let bestRule: SimRule | null = null;
    for (let i = 0; i < working.length - 1; i++) {
      const a = working[i]!;
      const b = working[i + 1]!;
      for (const r of SIM_MERGE_TABLE) {
        if (r.isCompound && !enableCompoundMerge) continue;
        if (r.stepGroup > maxAllowedStepGroup) continue;
        if (r.left === a.label && r.right === b.label) {
          if (!bestRule || r.rank < bestRule.rank) {
            bestRule = r;
            bestIdx = i;
          }
        }
      }
    }
    if (!bestRule || bestIdx < 0) break;
    const leftNode = working[bestIdx]!;
    const rightNode = working[bestIdx + 1]!;
    const nextTier = Math.min(3, Math.max(leftNode.tier, rightNode.tier) + 1) as 1 | 2 | 3;
    const mergedNode: BpeTreeNode = {
      nodeId: `m-${mergeSeq++}`,
      label: bestRule.merged,
      startByte: leftNode.startByte,
      endByte: rightNode.endByte,
      tier: nextTier,
      ruleId: bestRule.id,
      createdAtStep: bestRule.stepGroup,
      leftChildId: leftNode.nodeId,
      rightChildId: rightNode.nodeId,
    };
    allNodes.push(mergedNode);
    working = [...working.slice(0, bestIdx), mergedNode, ...working.slice(bestIdx + 2)];
    doneRuleIds.push(bestRule.id);
    if (bestRule.stepGroup === step) activeRuleIds.push(bestRule.id);
  }

  let stoppedEarlyReason: string | null = null;
  if (preset === "ben" && step >= 3) {
    stoppedEarlyReason = "词表缺 E7 8A + 87 尾规则，停在 2 个半字字节片段";
  } else if (preset === "tuili" && !enableCompoundMerge && step >= 4) {
    stoppedEarlyReason = "末轮双字合并已关闭，停在「推」「理」2 个单字片段";
  }

  const tokenIds = working.map(
    (node) => DEMO_VOCAB_IDS[node.label] ?? Number.parseInt(node.label.slice(0, 2), 16),
  );

  return {
    preset,
    word,
    rawHexBytes,
    allNodes,
    activeRootNodes: working,
    mergesApplied: doneRuleIds.length,
    activeRuleIds,
    doneRuleIds,
    tokenIds,
    stoppedEarlyReason,
  };
}

export interface TokenBpeInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: TokenBpeMode | undefined;
  readonly initialStep?: TokenBpeStep | undefined;
  readonly initialPreset?: TokenBpePresetId | undefined;
  readonly initialCompoundMerge?: boolean | undefined;
}

export function TokenBpeInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
  initialPreset = "tuili",
  initialCompoundMerge = true,
}: TokenBpeInteractiveProps) {
  const [mode, setMode] = useState<TokenBpeMode>(initialMode);
  const [step, setStep] = useState<TokenBpeStep>(initialStep);
  const [preset, setPreset] = useState<TokenBpePresetId>(initialPreset);
  const [compoundMerge, setCompoundMerge] = useState<boolean>(initialCompoundMerge);
  const [playing, setPlaying] = useState(false);

  const spec = TOKEN_BPE_STEPS[step - 1]!;
  const sim = runBpeSimulation(preset, compoundMerge, step);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-bpe-teal`;
  const mAmber = `${id}-${uid}-bpe-amber`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        return (prev + 1) as TokenBpeStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: TokenBpeStep) => {
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
        selectStep(Math.min(5, step + 1) as TokenBpeStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as TokenBpeStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectStep(Number(event.key) as TokenBpeStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const mergeCount = sim.mergesApplied;
  const remainCount = sim.activeRootNodes.length;
  const byteCount = sim.rawHexBytes.length;
  const idListText = sim.tokenIds.join(", ");

  const dynamicKpi =
    preset === "tuili" && compoundMerge
      ? spec.kpi
      : step === 5
        ? `「${sim.word}」→ 示意编号 [${idListText}]`
        : `${byteCount} 字节 − ${mergeCount} 次合并 = 剩 ${remainCount} 块`;

  const dynamicTakeaway =
    preset === "tuili" && compoundMerge
      ? spec.takeaway
      : sim.stoppedEarlyReason
        ? `「${sim.word}」(${byteCount} 字节)：${sim.stoppedEarlyReason}；${step === 5 ? `最终查出 ${remainCount} 个示意编号 [${idListText}]，256 单字节兜底永不报未知词！` : `当前经 ${mergeCount} 次合并剩 ${remainCount} 个片段。`}`
        : `「${sim.word}」先由 UTF-8 拆出 ${byteCount} 个原始字节 [${sim.rawHexBytes.join(" ")}]，本步累计合并 ${mergeCount} 次，剩余 ${remainCount} 个片段。`;

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
      kickerTitle="字节级 BPE 分词（UTF-8 字节 → 逐轮合并 → Token ID）"
      question="为什么常见词变成 1 个编号，生僻字却会被拆成两半字节且从不报未知词？"
      toolbarLabel="字节级 BPE 五步合并演化控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-preset": preset,
        "data-compound": compoundMerge ? "true" : "false",
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="token-bpe-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as TokenBpeStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as TokenBpeStep)}
            >
              下一步 ›
            </button>
            {TOKEN_BPE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`token-bpe-step-${item.step}`}
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

          <fieldset className="wiki-edu-btn-row" aria-label="输入词预设与双字合并开关">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="token-bpe-preset-tuili"
              aria-pressed={mode === "sandbox" && preset === "tuili"}
              style={eduBtnStyle(mode === "sandbox" && preset === "tuili", "dark")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setPreset("tuili");
              }}
            >
              预设：「推理」(6字节)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="token-bpe-preset-ben"
              aria-pressed={mode === "sandbox" && preset === "ben"}
              style={eduBtnStyle(mode === "sandbox" && preset === "ben", "dark")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setPreset("ben");
              }}
            >
              生僻字：「犇」(3字节停2块)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="token-bpe-toggle-compound"
              aria-pressed={mode === "sandbox" && compoundMerge}
              style={eduBtnStyle(mode === "sandbox" && compoundMerge, "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setCompoundMerge((v) => !v);
              }}
            >
              {compoundMerge ? "末轮双字合并：开" : "末轮双字合并：关"}
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={sim.stoppedEarlyReason ? "warn" : step === 4 || step === 5 ? "accent" : "default"}
      takeaway={dynamicTakeaway}
      kpi={dynamicKpi}
      detailsSummary="查看工程与源码细节（块数守恒公式 / 半字流式反分词 / 151936 词表校验）"
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
              {`UTF-8 原始字节块 → 逐轮最高优合并树 → 最终序列（原文：「${sim.word}」）`}
            </span>
            <span className={`wiki-edu-badge ${sim.stoppedEarlyReason ? "is-warn" : "is-good"}`}>
              {`${byteCount} 字节 − ${mergeCount} 次合并 = ${remainCount} 块`}
            </span>
          </div>

          <svg
            viewBox="0 0 840 244"
            width="840"
            height="244"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`BPE 合并演化树：「${sim.word}」步骤 ${step}`}
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
                id={mAmber}
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

            {(() => {
              const leafSpan = byteCount === 6 ? 88 : 156;
              const leafStartX = byteCount === 6 ? 24 : 68;
              const leafW = byteCount === 6 ? 76 : 118;
              const nodeMap = new Map(sim.allNodes.map((n) => [n.nodeId, n]));
              const rootIds = new Set(sim.activeRootNodes.map((n) => n.nodeId));
              const cxOf = (n: BpeTreeNode) =>
                leafStartX + ((n.startByte + n.endByte) / 2) * leafSpan + leafW / 2;
              const yOf = (tier: BpeTreeNode["tier"]) => 22 + tier * 56;

              return (
                <>
                  {sim.allNodes
                    .filter((n) => n.leftChildId && n.rightChildId)
                    .map((parent) => {
                      const left = nodeMap.get(parent.leftChildId!)!;
                      const right = nodeMap.get(parent.rightChildId!)!;
                      const px = cxOf(parent);
                      const py = yOf(parent.tier);
                      const isFresh = parent.createdAtStep === step;
                      const stroke = isFresh ? "#087f73" : "#4c65b6";
                      return (
                        <g key={`wire-${parent.nodeId}`}>
                          <path
                            d={`M ${cxOf(left)} ${yOf(left.tier) + 34} L ${px - 10} ${py}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={isFresh ? "2" : "1.5"}
                          />
                          <path
                            d={`M ${cxOf(right)} ${yOf(right.tier) + 34} L ${px + 10} ${py}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={isFresh ? "2" : "1.5"}
                          />
                        </g>
                      );
                    })}

                  {sim.allNodes.map((node) => {
                    const cx = cxOf(node);
                    const ny = yOf(node.tier);
                    const boxW = node.tier === 0 ? leafW : Math.min(168, leafW + node.tier * 22);
                    const isRoot = rootIds.has(node.nodeId);
                    const isFresh = node.createdAtStep === step && step > 1;
                    const fill = isFresh ? "#ddf4ef" : isRoot ? "#fff4cf" : "#fbfaf6";
                    const stroke = isFresh ? "#087f73" : isRoot ? "#c78300" : "#d8d8cf";
                    return (
                      <g key={node.nodeId}>
                        <rect
                          x={cx - boxW / 2}
                          y={ny}
                          width={boxW}
                          height="34"
                          rx="7"
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isRoot || isFresh ? "1.8" : "1.3"}
                        />
                        <text
                          x={cx}
                          y={ny + 22}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="#17211f"
                        >
                          {node.ruleId ? `R${node.ruleId}:${node.label}` : `0x${node.label}`}
                        </text>
                      </g>
                    );
                  })}

                  {sim.stoppedEarlyReason && (
                    <g>
                      <rect
                        x="44"
                        y="190"
                        width="472"
                        height="34"
                        rx="7"
                        fill="#fff0e9"
                        stroke="#b54237"
                        strokeDasharray="4 3"
                      />
                      <text x="280" y="212" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
                        {`⏸ ${sim.stoppedEarlyReason}`}
                      </text>
                    </g>
                  )}
                </>
              );
            })()}

            <path
              className={`wiki-edu-wire${step === 5 ? " is-flow" : ""}`}
              d="M 556 122 L 592 122"
              stroke={step === 5 ? "#c78300" : "#087f73"}
              markerEnd={`url(#${step === 5 ? mAmber : mTeal})`}
            />

            <rect
              x="598"
              y="22"
              width="226"
              height="202"
              rx="10"
              fill={step === 5 ? "#fff4cf" : "#fbfaf6"}
              stroke={step === 5 ? "#c78300" : "#d8d8cf"}
              strokeWidth="1.6"
            />
            <text x="711" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {step === 5 ? "词表映射结果" : "待查表序列出口"}
            </text>
            <text x="711" y="72" textAnchor="middle" fontSize="12" fill="#66716d">
              {`当前剩 ${remainCount} 个根片段`}
            </text>
            {step === 5 ? (
              sim.activeRootNodes.map((rn, idx) => (
                <g key={`out-${rn.nodeId}`}>
                  <rect
                    x="614"
                    y={90 + idx * 54}
                    width="194"
                    height="42"
                    rx="7"
                    fill="#ffffff"
                    stroke="#c78300"
                    strokeWidth="1.4"
                  />
                  <text
                    x="711"
                    y={116 + idx * 54}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#17211f"
                  >
                    {remainCount === 1
                      ? `示意编号 ${sim.tokenIds[idx]}`
                      : `「${rn.label}」→ 示意编号 ${sim.tokenIds[idx]}`}
                  </text>
                </g>
              ))
            ) : (
              <g>
                <rect x="614" y="96" width="194" height="58" rx="7" fill="#ddf4ef" stroke="#087f73" />
                <text x="711" y="122" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
                  {sim.activeRootNodes.map((n) => n.label).join(" · ")}
                </text>
                <text x="711" y="142" textAnchor="middle" fontSize="12" fill="#66716d">
                  待第 ⑤ 步查词表编号
                </text>
              </g>
            )}
            <text x="711" y="210" textAnchor="middle" fontSize="12" fill="#66716d">
              256 单字节兜底零未知词
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">{`当前切块序列（原文：「${sim.word}」）`}</span>
              <span className="wiki-edu-badge is-good">{`UTF-8: ${sim.rawHexBytes.join(" ")}`}</span>
            </div>
            <div className="wiki-edu-chunks-wrap">
              {sim.activeRootNodes.map((node, idx) => (
                <div
                  key={node.nodeId}
                  className={`wiki-edu-chunk-pill${node.createdAtStep === step && step > 1 ? " is-last" : ""}`}
                >
                  <strong>{node.label}</strong>
                  <span>
                    {step === 5
                      ? `示意 ID ${sim.tokenIds[idx]}`
                      : node.ruleId
                        ? `规则 ${node.ruleId}`
                        : "单字节"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">合并优先级表（越靠上越先用）</span>
              <span className="wiki-edu-badge is-mid">{`已触发 ${mergeCount} 次合并`}</span>
            </div>
            <div className="wiki-edu-tok-list">
              {(preset === "ben"
                ? [
                    { id: 6, pair: "E7 + 8A", merged: "E7 8A", note: "「犇」前两字节" },
                    { id: 99, pair: "E7 8A + 87", merged: "缺失规则", note: "词表未收录 · 停在2块" },
                  ]
                : BPE_MERGE_RULES
              ).map((rule) => {
                const isMissing = rule.id === 99;
                const isDisabledCompound = rule.id === 5 && !compoundMerge;
                const isActive = sim.activeRuleIds.includes(rule.id);
                const isDone = sim.doneRuleIds.includes(rule.id);
                const tone =
                  isMissing || isDisabledCompound
                    ? "is-cow"
                    : isActive
                      ? "is-sys is-hit"
                      : isDone
                        ? "is-priv"
                        : "is-empty";
                return (
                  <div key={rule.id} className={`wiki-edu-tok-pill ${tone}`}>
                    <span>
                      {isMissing
                        ? `缺项：${rule.pair} → 停驻`
                        : `规则 ${rule.id}：${rule.pair} → ${rule.merged}`}
                    </span>
                    <span className="wiki-edu-ptr-tag">
                      {isMissing
                        ? "✗ 无此规则"
                        : isDisabledCompound
                          ? "⏸ 开关已关"
                          : isActive
                            ? "⚡ 本步合并"
                            : isDone
                              ? "✓ 已并"
                              : rule.note}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
