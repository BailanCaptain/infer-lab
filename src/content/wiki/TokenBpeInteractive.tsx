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

export interface TokenBpeInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: TokenBpeMode | undefined;
  readonly initialStep?: TokenBpeStep | undefined;
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
}: TokenBpeInteractiveProps) {
  const [mode, setMode] = useState<TokenBpeMode>(initialMode);
  const [step, setStep] = useState<TokenBpeStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = TOKEN_BPE_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-bpe-teal`;

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

  const mergeCount = spec.doneRules.length;
  const remainCount = spec.pieces.length;

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
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="token-bpe-autoplay"
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="BPE 五步归并动作">
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
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 4 || step === 5 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（块数守恒公式 / 半字流式反分词 / 151936 词表校验）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">当前切块序列（原文：「推理」）</span>
            <span className="wiki-edu-badge is-good">{`6 字节 − ${mergeCount} 次合并 = ${remainCount} 块`}</span>
          </div>

          <div className="wiki-edu-chunks-wrap">
            {spec.pieces.map((p, idx) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: ordered sequence piece slots
                key={`${p.label}-${idx}`}
                className={`wiki-edu-chunk-pill${p.fresh ? " is-last" : ""}`}
              >
                <strong>{p.label}</strong>
                <span>{p.sub ?? "片段"}</span>
              </div>
            ))}
          </div>

          <svg
            viewBox="0 0 400 74"
            width="400"
            height="74"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`BPE 合并进度：${spec.title}`}
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
              y="14"
              width="164"
              height="44"
              rx="8"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="90" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {`当前剩 ${remainCount} 个片段`}
            </text>
            <text x="90" y="50" textAnchor="middle" fontSize="12" fill="#66716d">
              E6 8E A8 · E7 90 86
            </text>
            <path
              className={`wiki-edu-wire${spec.tokenId !== null ? " is-flow" : ""}`}
              d="M 176 36 L 220 36"
              stroke={spec.tokenId !== null ? "#087f73" : "#d8d8cf"}
              markerEnd={`url(#${mTeal})`}
            />
            <rect
              x="224"
              y="14"
              width="168"
              height="44"
              rx="8"
              fill={spec.tokenId !== null ? "#fff4cf" : "#fbfaf6"}
              stroke={spec.tokenId !== null ? "#c78300" : "#d8d8cf"}
              strokeWidth="1.5"
            />
            <text x="308" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {spec.tokenId !== null ? `示意编号 ${spec.tokenId}` : "待合并完查词表"}
            </text>
            <text x="308" y="50" textAnchor="middle" fontSize="12" fill="#66716d">
              {spec.tokenId !== null ? "整句 24 字节 → 4 个示意 ID" : "越靠前的规则越先并"}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">合并优先级表（越靠上越先用）</span>
            <span className="wiki-edu-badge is-mid">{`已触发 ${mergeCount} / 5 条`}</span>
          </div>

          <div className="wiki-edu-tok-list">
            {BPE_MERGE_RULES.map((rule) => {
              const isActive = spec.activeRules.includes(rule.id);
              const isDone = spec.doneRules.includes(rule.id);
              const tone = isActive ? "is-sys is-hit" : isDone ? "is-priv" : "is-empty";
              return (
                <div key={rule.id} className={`wiki-edu-tok-pill ${tone}`}>
                  <span>{`规则 ${rule.id}：${rule.pair} → ${rule.merged}`}</span>
                  <span className="wiki-edu-ptr-tag">
                    {isActive ? "⚡ 本步合并" : isDone ? "✓ 已并" : rule.note}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
