import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";

export type PrefixCachingStep = 1 | 2 | 3 | 4 | 5;
export type PrefixDiagramMode = "svg" | "sandbox";

export interface PrefixBlockView {
  readonly id: "B0" | "B1" | "B2" | "B3";
  readonly roleLabel: string;
  readonly fillText: string;
  readonly refCnt: 0 | 1 | 2;
  readonly state: "shared" | "private" | "free";
  readonly highlight?: boolean;
}

export interface PrefixStepSpec {
  readonly step: PrefixCachingStep;
  readonly buttonLabel: string;
  readonly title: string;
  readonly detail: string;
  readonly hash0Status: "registered" | "hit" | "retained";
  readonly hash1Status: "registered" | "hit" | "retained";
  readonly reqALabel?: string;
  readonly reqASlots: readonly string[] | null;
  readonly reqAStatus: string;
  readonly reqBLabel?: string;
  readonly reqBSlots: readonly string[] | null;
  readonly reqBStatus: string;
  readonly blocks: readonly PrefixBlockView[];
  readonly freeLruQueue: readonly string[];
  readonly savedCellsText: string;
  readonly savedNote: string;
  readonly cowCopyFromTo?: readonly [PrefixBlockView["id"], PrefixBlockView["id"]];
}

export const PREFIX_CACHING_STEPS: readonly PrefixStepSpec[] = [
  {
    step: 1,
    buttonLabel: "① 请求 A 写入系统提示词",
    title: "动作 ① · 请求 A 写入系统提示词（分配块 B0, B1，ref_cnt = 1）",
    detail:
      "请求 A 率先到达：前 8 个系统提示词位置填满物理块 B0、B1（每块 4 格示意，昇腾 Qwen3-8B 默认 128 格/块），计算链式指纹 h0→h1 并登记到哈希表，引用计数均为 1；末尾 2 个未满位置写入私有尾块 B2。",
    hash0Status: "registered",
    hash1Status: "registered",
    reqASlots: ["B0", "B1", "B2"],
    reqAStatus: "运行中 · 完整计算 10 格",
    reqBSlots: null,
    reqBStatus: "尚未到达",
    blocks: [
      {
        id: "B0",
        roleLabel: "系统提示 [0..3]",
        fillText: "写满 4/4 · 只读前缀",
        refCnt: 1,
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "系统提示 [4..7]",
        fillText: "写满 4/4 · 只读前缀",
        refCnt: 1,
        state: "shared",
        highlight: true,
      },
      { id: "B2", roleLabel: "A 独有尾 [8..9]", fillText: "未满 2/4 · A 续写", refCnt: 1, state: "private" },
      { id: "B3", roleLabel: "空闲物理块", fillText: "0/4 · 待分配", refCnt: 0, state: "free" },
    ],
    freeLruQueue: ["B3", "B4"],
    savedCellsText: "0 格（首条算满 10 格）",
    savedNote: "前 2 块写满后登记链式 block hash",
  },
  {
    step: 2,
    buttonLabel: "② 请求 B 命中相同前缀",
    title: "动作 ② · 请求 B 命中相同前缀（touch 零重算复用 B0, B1，ref_cnt = 2）",
    detail:
      "请求 B 携带相同系统提示词进场：逐块比对链式哈希与额外身份键，连续命中 B0、B1！调度器直接将 B0、B1 填进 B 的逻辑块表并把 ref_cnt 加至 2，零显存拷贝跳过前 8 格 Prefill 重算。",
    hash0Status: "hit",
    hash1Status: "hit",
    reqASlots: ["B0", "B1", "B2"],
    reqAStatus: "运行中 · 持有 B0, B1, B2",
    reqBSlots: ["B0", "B1"],
    reqBStatus: "前缀命中 · 零拷贝共享 B0, B1",
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "写满 4/4 · 显存仅 1 份",
        refCnt: 2,
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "写满 4/4 · 显存仅 1 份",
        refCnt: 2,
        state: "shared",
        highlight: true,
      },
      { id: "B2", roleLabel: "A 独有尾 [8..9]", fillText: "未满 2/4 · A 私有", refCnt: 1, state: "private" },
      { id: "B3", roleLabel: "空闲物理块", fillText: "0/4 · 待分配", refCnt: 0, state: "free" },
    ],
    freeLruQueue: ["B3", "B4"],
    savedCellsText: "省 8/10 格（跳过 80% 计算）",
    savedNote: "仅改逻辑块表指针，不复制物理 KV",
  },
  {
    step: 3,
    buttonLabel: "③ 请求 B 续写分配私有尾块",
    title: "动作 ③ · 请求 B 续写分配私有尾块（满块前缀零拷贝共享，新位置写独立空块 B3）",
    detail:
      "因 B0（[0..3]）与 B1（[4..7]）均已写满 4/4 格，请求 B 续写位置 [8..9] 时直接从空闲队列摘出全新空块 B3 写入私有尾部，无需复制 B0、B1 内容（注意区分：只有对未写满且 ref_cnt > 1 的共享块做原地追加修改时，才会触发真正的块拷贝 CoW）。",
    hash0Status: "hit",
    hash1Status: "hit",
    reqASlots: ["B0", "B1", "B2"],
    reqAStatus: "运行中 · 写私有尾块 B2",
    reqBSlots: ["B0", "B1", "B3"],
    reqBStatus: "独立续写 · 新配私有尾块 B3",
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "写满 4/4 · 两请求只读共用",
        refCnt: 2,
        state: "shared",
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "写满 4/4 · 两请求只读共用",
        refCnt: 2,
        state: "shared",
      },
      { id: "B2", roleLabel: "A 独有尾 [8..9]", fillText: "2/4 · A 独立续写", refCnt: 1, state: "private" },
      {
        id: "B3",
        roleLabel: "B 私有尾 [8..9]",
        fillText: "2/4 · 新配空块独立续写",
        refCnt: 1,
        state: "private",
        highlight: true,
      },
    ],
    freeLruQueue: ["B4"],
    savedCellsText: "省 8 格（仅算 B 私有尾 2 格）",
    savedNote: "B 新尾块回看 B0, B1 历史但零重算前缀",
  },
  {
    step: 4,
    buttonLabel: "④ 请求 A 结束释放",
    title: "动作 ④ · 请求 A 结束释放（B0, B1 ref_cnt 降为 1 仍存活；全归零才入空闲 LRU）",
    detail:
      "请求 A 生成完毕释放块表：私有块 B2 的 ref_cnt 从 1 归 0，立即挂入空闲 LRU 队列；共享块 B0、B1 的 ref_cnt 从 2 降为 1，因请求 B 仍持有而继续驻留显存。唯有全部引用归零，块才会按倒序带指纹进入空闲 LRU 链。",
    hash0Status: "retained",
    hash1Status: "retained",
    reqASlots: null,
    reqAStatus: "已结束 teardown · 撤销自身引用",
    reqBSlots: ["B0", "B1", "B3"],
    reqBStatus: "照常生成 · 独占存活的 B0, B1, B3",
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "ref 2→1 · 仍存活保活",
        refCnt: 1,
        state: "shared",
        highlight: true,
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "ref 2→1 · 仍存活保活",
        refCnt: 1,
        state: "shared",
        highlight: true,
      },
      {
        id: "B2",
        roleLabel: "原 A 尾块（已归零）",
        fillText: "ref 1→0 · 已入空闲 LRU",
        refCnt: 0,
        state: "free",
        highlight: true,
      },
      { id: "B3", roleLabel: "B 私有尾 [8..9]", fillText: "3/4 · B 持续解码中", refCnt: 1, state: "private" },
    ],
    freeLruQueue: ["B2", "B4"],
    savedCellsText: "累计省 8 格 + 省 2 块重复显存",
    savedNote: "待 B 也结束归零后按 B3→B1→B0 倒序入 LRU",
  },
  {
    step: 5,
    buttonLabel: "⑤ 写时复制 CoW 分叉",
    title: "动作 ⑤ · 写时复制 CoW 分叉（改写 ref_cnt > 1 共享块 B3 时拷出新块 B2，B3 ref 2→1）",
    detail:
      "新请求/投机修订分支 C 原本与请求 B 共享 [B0, B1, B3]（B3 的 ref_cnt = 2）。当 C 需要改写或修订 B3 内的槽位时，因 ref_cnt > 1 禁止原地覆写：调度器从空闲队头摘出 B2 拷贝 B3 原内容并写入新分支槽位，将 C 的块表槽 2 改绑 B2（ref=1）；原块 B3 引用计数减为 1（2→1）保留原内容供请求 B 无损继续读取。",
    hash0Status: "hit",
    hash1Status: "hit",
    reqALabel: "请求 B 块表（原读分支）",
    reqASlots: ["B0", "B1", "B3"],
    reqAStatus: "无损读 B3 · 原块 ref 2→1",
    reqBLabel: "请求 C 块表（CoW 改写）",
    reqBSlots: ["B0", "B1", "B2"],
    reqBStatus: "CoW 分叉 · 槽 2 改绑新块 B2",
    blocks: [
      {
        id: "B0",
        roleLabel: "共享前缀 [0..3]",
        fillText: "写满 4/4 · B/C 只读共用",
        refCnt: 2,
        state: "shared",
      },
      {
        id: "B1",
        roleLabel: "共享前缀 [4..7]",
        fillText: "写满 4/4 · B/C 只读共用",
        refCnt: 2,
        state: "shared",
      },
      {
        id: "B2",
        roleLabel: "CoW 新块（拷自 B3）",
        fillText: "拷贝 B3 原槽并改写 C 分支",
        refCnt: 1,
        state: "private",
        highlight: true,
      },
      {
        id: "B3",
        roleLabel: "原共享块 [8..9]",
        fillText: "ref 2→1 · 保留原槽供 B 读取",
        refCnt: 1,
        state: "shared",
        highlight: true,
      },
    ],
    freeLruQueue: ["B4"],
    savedCellsText: "仅拷 1 块 B3→B2（B0, B1 仍共享）",
    savedNote: "写时隔离：B 续读 B3，C 改写新块 B2",
    cowCopyFromTo: ["B3", "B2"],
  },
];

export interface PrefixCachingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: PrefixDiagramMode | undefined;
  readonly initialStep?: PrefixCachingStep | undefined;
}

const BLOCK_Y: Record<PrefixBlockView["id"], number> = {
  B0: 148,
  B1: 208,
  B2: 268,
  B3: 328,
};

function blockColors(block: PrefixBlockView) {
  if (block.state === "shared") {
    return {
      fill: "#e8edff",
      stroke: block.highlight ? "#e85b32" : "#4c65b6",
      badgeFill: block.refCnt >= 2 ? "#e85b32" : "#4c65b6",
      badgeText: "#ffffff",
      subText: "#17211f",
    };
  }
  if (block.state === "private") {
    return {
      fill: "#ddf4ef",
      stroke: block.highlight ? "#e85b32" : "#087f73",
      badgeFill: "#087f73",
      badgeText: "#ffffff",
      subText: "#17211f",
    };
  }
  return {
    fill: "#ece9df",
    stroke: block.highlight ? "#c78300" : "#d8d8cf",
    badgeFill: "#66716d",
    badgeText: "#ffffff",
    subText: "#66716d",
  };
}

function ctrlBtnStyle(pressed: boolean) {
  return pressed
    ? { background: "#17211f", borderColor: "#17211f", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
}

function stepBtnStyle(active: boolean) {
  return active
    ? { background: "#087f73", borderColor: "#087f73", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
}

export function PrefixCachingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "svg",
  initialStep = 2,
}: PrefixCachingInteractiveProps) {
  const [mode, setMode] = useState<PrefixDiagramMode>(initialMode);
  const [step, setStep] = useState<PrefixCachingStep>(initialStep);
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
  const spec = PREFIX_CACHING_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const markerKv = `${id}-${uid}-pc-kv`;
  const markerTeal = `${id}-${uid}-pc-teal`;
  const markerAccent = `${id}-${uid}-pc-accent`;

  const selectStep = (next: PrefixCachingStep) => {
    setMode("sandbox");
    setStep(next);
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
        setMode("svg");
        break;
    }
  };

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-diagram-id={id}
      data-mode={mode}
      data-step={step}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="Prefix Caching 共享块表与私有尾块续写交互控制"
        onKeyDown={handleKeyDown}
      >
        <fieldset className="wiki-diagram-mode-switch" aria-label="视图模式">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-svg"
            aria-pressed={mode === "svg"}
            style={ctrlBtnStyle(mode === "svg")}
            onClick={() => setMode("svg")}
          >
            还原原版静态图
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-sandbox"
            aria-pressed={mode === "sandbox"}
            style={ctrlBtnStyle(mode === "sandbox")}
            onClick={() => setMode("sandbox")}
          >
            切换交互沙盘 · 亲手试一试
          </button>
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="前缀缓存五步动作演化">
          {PREFIX_CACHING_STEPS.map((item) => {
            const active = mode === "sandbox" && step === item.step;
            return (
              <button
                key={item.step}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`prefix-step-${item.step}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                style={stepBtnStyle(active)}
                onClick={() => selectStep(item.step)}
              >
                {item.buttonLabel}
              </button>
            );
          })}
        </fieldset>
      </div>

      <div className="wiki-diagram-canvas">
        {mode === "svg" ? (
          <div
            key="svg"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
            dangerouslySetInnerHTML={html}
          />
        ) : (
          <div
            key="sandbox"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
          >
            <svg
              viewBox="0 0 880 376"
              width="880"
              height="376"
              role="img"
              aria-label={`Prefix Caching 交互沙盘：${spec.title}`}
              fontFamily="var(--font-sans)"
            >
              <title>{spec.title}</title>
              <defs>
                <marker
                  id={markerKv}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" fill="#4c65b6" />
                </marker>
                <marker
                  id={markerTeal}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" fill="#087f73" />
                </marker>
                <marker
                  id={markerAccent}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" fill="#e85b32" />
                </marker>
              </defs>

              {/* Top Chain Hash Bar */}
              <text x="16" y="24" fontSize="14" fontWeight="700" fill="#17211f">
                链式块指纹登记表（block hash = H(前块哈希, 本块 token, 额外身份键)）
              </text>
              <rect
                x="16"
                y="36"
                width="256"
                height="44"
                rx="8"
                fill={spec.hash0Status === "hit" ? "#fff0e9" : "#e8edff"}
                stroke={spec.hash0Status === "hit" ? "#e85b32" : "#4c65b6"}
                strokeWidth="1.5"
              />
              <text
                x="28"
                y="55"
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#17211f"
              >
                h0 = H(∅, sys[0..3]) → B0
              </text>
              <text x="28" y="72" fontSize="12" fill={spec.hash0Status === "hit" ? "#e85b32" : "#66716d"}>
                {spec.hash0Status === "hit" ? "命中! 零重算直指 B0" : "已登记 · 整块写满可共享"}
              </text>
              <path
                d="M272 58 L302 58"
                fill="none"
                stroke="#4c65b6"
                strokeWidth="1.6"
                markerEnd={`url(#${markerKv})`}
              />
              <rect
                x="306"
                y="36"
                width="268"
                height="44"
                rx="8"
                fill={spec.hash1Status === "hit" ? "#fff0e9" : "#e8edff"}
                stroke={spec.hash1Status === "hit" ? "#e85b32" : "#4c65b6"}
                strokeWidth="1.5"
              />
              <text
                x="318"
                y="55"
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#17211f"
              >
                h1 = H(h0, sys[4..7]) → B1
              </text>
              <text x="318" y="72" fontSize="12" fill={spec.hash1Status === "hit" ? "#e85b32" : "#66716d"}>
                {spec.hash1Status === "hit" ? "命中! 链式前缀一致直指 B1" : "已登记 · 依赖前块 h0"}
              </text>
              <rect
                x="594"
                y="36"
                width="270"
                height="44"
                rx="8"
                fill="#ece9df"
                stroke="#d8d8cf"
                strokeWidth="1.3"
                strokeDasharray="5 3"
              />
              <text x="608" y="55" fontSize="12.5" fontWeight="700" fill="#17211f">
                未满尾块 [8..9]（2/4 格）
              </text>
              <text x="608" y="72" fontSize="12" fill="#66716d">
                未满整块默认不登记共享哈希
              </text>

              {/* Column Headers */}
              <text x="16" y="112" fontSize="13.5" fontWeight="700" fill="#17211f">
                ① 逻辑块表（Block Table）
              </text>
              <text x="296" y="112" fontSize="13.5" fontWeight="700" fill="#17211f">
                ② 物理 KV 块池（同池共享 · ref_cnt）
              </text>
              <text x="602" y="112" fontSize="13.5" fontWeight="700" fill="#17211f">
                ③ 计算节省与空闲 LRU 链
              </text>

              {/* Request A Logical Block Table */}
              <rect
                x="16"
                y="124"
                width="210"
                height="98"
                rx="10"
                fill={spec.reqASlots ? "#fbfaf6" : "#ece9df"}
                stroke={spec.reqASlots ? "#4c65b6" : "#d8d8cf"}
                strokeWidth="1.5"
                strokeDasharray={spec.reqASlots ? undefined : "5 3"}
              />
              <text x="28" y="146" fontSize="13.5" fontWeight="700" fill="#17211f">
                {spec.reqALabel ?? "请求 A 块表"}
              </text>
              <text x="28" y="165" fontSize="12" fill="#66716d">
                {spec.reqAStatus}
              </text>
              <text
                x="28"
                y="196"
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={spec.reqASlots ? "#4c65b6" : "#66716d"}
              >
                {spec.reqASlots ? `槽 [0,1,2] → [${spec.reqASlots.join(", ")}]` : "槽已清空（引用已归还）"}
              </text>

              {/* Request B Logical Block Table */}
              <rect
                x="16"
                y="242"
                width="210"
                height="110"
                rx="10"
                fill={spec.reqBSlots ? "#fbfaf6" : "#ece9df"}
                stroke={
                  step === 2 || step === 3 || step === 5 ? "#e85b32" : spec.reqBSlots ? "#087f73" : "#d8d8cf"
                }
                strokeWidth={step === 2 || step === 3 || step === 5 ? "2" : "1.5"}
                strokeDasharray={spec.reqBSlots ? undefined : "5 3"}
              />
              <text x="28" y="264" fontSize="13.5" fontWeight="700" fill="#17211f">
                {spec.reqBLabel ?? "请求 B 块表"}
              </text>
              <text
                x="28"
                y="283"
                fontSize="12"
                fill={step === 2 || step === 3 || step === 5 ? "#e85b32" : "#66716d"}
              >
                {spec.reqBStatus}
              </text>
              <text
                x="28"
                y="314"
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={spec.reqBSlots ? "#087f73" : "#66716d"}
              >
                {spec.reqBSlots ? `槽 → [${spec.reqBSlots.join(", ")}]` : "等待请求 B 到达"}
              </text>
              {step === 3 && (
                <text x="28" y="338" fontSize="12" fontWeight="700" fill="#c78300">
                  满块零拷贝，续写配空块 B3
                </text>
              )}
              {step === 5 && (
                <text x="28" y="338" fontSize="12" fontWeight="700" fill="#e85b32">
                  CoW 拷贝 B3→B2，B3 ref 2→1
                </text>
              )}

              {/* Pointer Arrows from Request A & Request B to Physical Blocks */}
              {spec.reqASlots?.map((bid, idx) => {
                const targetY = BLOCK_Y[bid as PrefixBlockView["id"]];
                const startY = 152 + idx * 20;
                return (
                  <path
                    key={`a-${bid}`}
                    d={`M226 ${startY} C258 ${startY}, 262 ${targetY - 6}, 292 ${targetY - 6}`}
                    fill="none"
                    stroke="#4c65b6"
                    strokeWidth="1.6"
                    markerEnd={`url(#${markerKv})`}
                  />
                );
              })}
              {spec.reqBSlots?.map((bid, idx) => {
                const targetY = BLOCK_Y[bid as PrefixBlockView["id"]];
                const startY = 272 + idx * 22;
                const isFork = (step === 3 && bid === "B3") || (step === 5 && bid === "B2");
                return (
                  <path
                    key={`b-${bid}`}
                    d={`M226 ${startY} C258 ${startY}, 262 ${targetY + 6}, 292 ${targetY + 6}`}
                    fill="none"
                    stroke={isFork ? "#e85b32" : "#087f73"}
                    strokeWidth={isFork ? "2.1" : "1.7"}
                    markerEnd={`url(#${isFork ? markerAccent : markerTeal})`}
                  />
                );
              })}
              {spec.cowCopyFromTo && (
                <path
                  d={`M576 ${BLOCK_Y[spec.cowCopyFromTo[0]]} C595 ${BLOCK_Y[spec.cowCopyFromTo[0]]}, 595 ${BLOCK_Y[spec.cowCopyFromTo[1]]}, 580 ${BLOCK_Y[spec.cowCopyFromTo[1]]}`}
                  fill="none"
                  stroke="#e85b32"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  markerEnd={`url(#${markerAccent})`}
                />
              )}

              {/* Physical KV Block Pool */}
              {spec.blocks.map((block, idx) => {
                const y = 124 + idx * 60;
                const c = blockColors(block);
                return (
                  <g key={block.id}>
                    <rect
                      x="296"
                      y={y}
                      width="280"
                      height="48"
                      rx="8"
                      fill={c.fill}
                      stroke={c.stroke}
                      strokeWidth={block.highlight ? "2" : "1.4"}
                    />
                    <text
                      x="310"
                      y={y + 20}
                      fontSize="13.5"
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                      fill="#17211f"
                    >
                      {block.id} · {block.roleLabel}
                    </text>
                    <text x="310" y={y + 38} fontSize="12" fill={c.subText}>
                      {block.fillText}
                    </text>
                    <rect x="482" y={y + 11} width="84" height="26" rx="13" fill={c.badgeFill} />
                    <text
                      x="524"
                      y={y + 28}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                      fill={c.badgeText}
                    >
                      {`ref=${block.refCnt}`}
                    </text>
                  </g>
                );
              })}

              {/* Right Summary Cards */}
              <rect
                x="602"
                y="124"
                width="262"
                height="106"
                rx="10"
                fill="#ddf4ef"
                stroke="#087f73"
                strokeWidth="1.5"
              />
              <text x="616" y="148" fontSize="13" fontWeight="700" fill="#17211f">
                节省的 Prefill 计算格数
              </text>
              <text
                x="616"
                y="176"
                fontSize="14"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#087f73"
              >
                {spec.savedCellsText}
              </text>
              <text x="616" y="202" fontSize="12" fill="#17211f">
                {spec.savedNote}
              </text>

              <rect
                x="602"
                y="244"
                width="262"
                height="108"
                rx="10"
                fill="#fff4cf"
                stroke="#c78300"
                strokeWidth="1.5"
              />
              <text x="616" y="268" fontSize="13" fontWeight="700" fill="#17211f">
                空闲 LRU 淘汰队列（ref_cnt = 0）
              </text>
              <text
                x="616"
                y="298"
                fontSize="14"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill="#c78300"
              >
                {`队头 [ ${spec.freeLruQueue.join(" → ")} ] 队尾`}
              </text>
              <text x="616" y="322" fontSize="12" fill="#17211f">
                归零块带哈希入队；被新请求借走时才抹除
              </text>
              <text x="616" y="340" fontSize="12" fill="#66716d">
                倒序归还使开头前缀块留存最久
              </text>
            </svg>
          </div>
        )}
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {mode === "sandbox" ? (
          <>
            <span className="wiki-diagram-step-tag">动作 {spec.step} / 5</span>
            <strong className="wiki-diagram-step-title">{spec.title}</strong>
            <span className="wiki-diagram-step-detail">{spec.detail}</span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            当前展示审定原图；点击上方「切换交互沙盘 · 亲手试一试」或 ①–⑤
            动作按钮，逐步拨弄链式哈希、逻辑块表共享指针、私有尾块续写、ref_cnt 归零入空闲 LRU 链与写时复制
            CoW 分叉。
          </span>
        )}
      </output>
    </div>
  );
}
