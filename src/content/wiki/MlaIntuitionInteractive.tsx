import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const MLA_INTUITION_APPROVED_SHA256 =
  "7cf7def9521bf07b33a68d67fb2c1c12e40539adfa6c34b2bd7f62ecbfc30e16";

export type MlaIntuitionStep = 1 | 2 | 3 | 4;
export type MlaDiagramMode = "sandbox" | "svg";

export interface MlaStepSpec {
  readonly step: MlaIntuitionStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
}

export const MLA_INTUITION_STEPS: readonly MlaStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 压成窄潜向量",
    badgeText: "步骤 1 / 4 · 低秩下投影",
    title: "动作 ① · 写入前把隐藏向量压成共享窄潜向量 c_KV + 可选独立旋转位置向量",
    takeaway:
      "不再给几十个头各算一份长 K、V：先压成全员共用的窄摘要潜向量 c_KV（需位置旋转时另拆小挂环 k_R）。",
    kpi: "c_KV 512 维（+ 可选 k_R）",
    detail:
      "c_t = h_t W_DKV（加 RMSNorm 稳尺度）：DeepSeek-V2 存 512 维潜向量 + 64 维解耦旋转键 k_R（共 576 维，防止 RoPE 旋转矩阵阻断吸收）；GLM-5.3-Flash 设 qk_rope_head_dim=0，仅存纯 512 维潜向量。Q 的中间表示（1536 维）用完即丢，绝不进 KV cache。",
  },
  {
    step: 2,
    shortBtn: "② 缓存体积骤降",
    badgeText: "步骤 2 / 4 · 单槽落盘",
    title: "动作 ② · KV cache 每个历史位置只存这一条窄向量，体积立降几十倍",
    takeaway: "普通 64 头多头每位置要存 32,768 个数；MLA 只存 1 条 512 维潜向量，单位置主缓存直接缩到 1/64！",
    kpi: "32,768 → 512 个数（省 64×）",
    detail:
      "以 64 头 × (256K + 256V) = 32,768 对比 512 维潜向量，主缓存宽度压缩 64×（DeepSeek-V2 576 对 32,768 折合仅 2.25 组 GQA 体积）。注意 TP 多卡下潜向量为所有头共用，每张卡均存完整一份，vLLM 记作 num_kv_heads = 1。",
  },
  {
    step: 3,
    shortBtn: "③ 按需挑位置读取",
    badgeText: "步骤 3 / 4 · 稀疏变体挑子集",
    title: "动作 ③ · 标准 MLA 读全部历史 c_t；稀疏 MLA 变体仅挑候选位置（含 c₀ 等 4 格）",
    takeaway:
      "标准 MLA 读全部因果历史潜向量，稀疏 MLA 变体再由索引器只挑重点位置（如含 c₀ 的 4 格），搬运字节锐减！",
    kpi: "稀疏变体：10 格挑 c₀ 等 4 格",
    detail:
      "区分两层独立机制：标准 MLA（如 DeepSeek-V2）读取全部因果历史位置的 c_t；GLM 稀疏 MLA 变体叠加轻量 indexer 交出候选位置清单（最多 2051 位置），主 attention 仅读取选中位置（如图中 c₀, c₄, c₆, 新）的 512 维潜向量。",
  },
  {
    step: 4,
    shortBtn: "④ 恢复/吸收做多头",
    badgeText: "步骤 4 / 4 · 各头独立还原",
    title: "动作 ④ · 对刚选中的 c₀，各头用专属上投影恢复独立 Kᵢ、Vᵢ（推理期吸收免展开）",
    takeaway:
      "妙处就在这里：虽然共读刚挑出的同一条 c₀，但每个头拿专属矩阵读出各不相同的 Kᵢ、Vᵢ，表达力远超硬砍头数！",
    kpi: "吸收：q̃·c₀ 恒等免展开",
    detail:
      "数学上 k_{t,i}=c_t W_{UK,i}、v_{t,i}=c_t W_{UV,i}（小算例读取刚高亮选中的 c₀=[1,2]，还原出头1 [1,4] 与头2 [2,1] 不同键）。Decode 推理利用结合律 q_i K_iᵀ = (q_i W_{UK,i}ᵀ) Cᵀ 与 (p_i C) W_{UV,i} 将上投影吸收进查询与输出侧，内核把同一份潜向量同时当 K 和 V 直算（缩放仍除 √d_k）。",
  },
];

export type MlaReadMode = "full" | "sparse";
export type MlaRopeDim = 0 | 64;

export interface MlaSandboxMetrics {
  readonly readMode: MlaReadMode;
  readonly topK: number;
  readonly ropeDim: MlaRopeDim;
  readonly totalDims: number;
  readonly perSlotBytes: number;
  readonly perSlotKiB: number;
  readonly activeSlotCount: number;
  readonly selectedIndices: ReadonlySet<number>;
  readonly readKiB: number;
  readonly fullReadKiB: number;
  readonly unfoldedDot: number;
  readonly absorbedDot: number;
}

const HIST_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SPARSE_PRIORITY_ORDER = [0, 9, 4, 6, 2, 7, 1, 5, 8, 3] as const;

export function computeMlaSandboxState(
  readMode: MlaReadMode,
  rawTopK: number,
  ropeDim: MlaRopeDim,
): MlaSandboxMetrics {
  const topK = Math.min(10, Math.max(1, Math.round(rawTopK)));
  const totalDims = 512 + ropeDim;
  const perSlotBytes = totalDims * 2;
  const perSlotKiB = perSlotBytes / 1024;
  const activeSlotCount = readMode === "full" ? 10 : topK;
  const selectedIndices =
    readMode === "full" ? new Set<number>(HIST_SLOTS) : new Set<number>(SPARSE_PRIORITY_ORDER.slice(0, topK));
  const readKiB = Number(((activeSlotCount * perSlotBytes) / 1024).toFixed(2));
  const fullReadKiB = Number(((10 * perSlotBytes) / 1024).toFixed(2));
  const c0: readonly [number, number] = [1, 2];
  const wDiag: readonly [number, number] = [1, 2];
  const q1: readonly [number, number] = [2, 1];
  const k1: readonly [number, number] = [c0[0] * wDiag[0], c0[1] * wDiag[1]];
  const unfoldedDot = q1[0] * k1[0] + q1[1] * k1[1];
  const qTilde: readonly [number, number] = [q1[0] * wDiag[0], q1[1] * wDiag[1]];
  const absorbedDot = qTilde[0] * c0[0] + qTilde[1] * c0[1];
  return {
    readMode,
    topK,
    ropeDim,
    totalDims,
    perSlotBytes,
    perSlotKiB,
    activeSlotCount,
    selectedIndices,
    readKiB,
    fullReadKiB,
    unfoldedDot,
    absorbedDot,
  };
}

export interface MlaIntuitionInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MlaDiagramMode | undefined;
  readonly initialStep?: MlaIntuitionStep | undefined;
  readonly initialReadMode?: MlaReadMode | undefined;
  readonly initialTopK?: number | undefined;
  readonly initialRopeDim?: MlaRopeDim | undefined;
}

export function MlaIntuitionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
  initialReadMode = "sparse",
  initialTopK = 4,
  initialRopeDim = 0,
}: MlaIntuitionInteractiveProps) {
  const [mode, setMode] = useState<MlaDiagramMode>(initialMode);
  const [step, setStep] = useState<MlaIntuitionStep>(initialStep);
  const [readMode, setReadMode] = useState<MlaReadMode>(initialReadMode);
  const [topK, setTopK] = useState<number>(initialTopK);
  const [ropeDim, setRopeDim] = useState<MlaRopeDim>(initialRopeDim);
  const [playing, setPlaying] = useState(false);
  const spec = MLA_INTUITION_STEPS[step - 1]!;
  const mlaState = useMemo(() => computeMlaSandboxState(readMode, topK, ropeDim), [readMode, topK, ropeDim]);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mKv = `${id}-${uid}-mla-kv`;
  const mTeal = `${id}-${uid}-mla-teal`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        return (prev + 1) as MlaIntuitionStep;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: MlaIntuitionStep) => {
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
    if (shouldPassKeyToRangeInput(event.target, event.key)) return;
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
        selectStep(Math.min(4, step + 1) as MlaIntuitionStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as MlaIntuitionStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as MlaIntuitionStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const applyReadMode = (nextMode: MlaReadMode) => {
    setPlaying(false);
    setMode("sandbox");
    setReadMode(nextMode);
    if (step < 3) setStep(3);
  };

  const applyTopK = (nextK: number) => {
    setPlaying(false);
    setMode("sandbox");
    setReadMode("sparse");
    setTopK(Math.min(10, Math.max(1, Math.round(nextK))));
    if (step < 3) setStep(3);
  };

  const applyRopeDim = (nextRope: MlaRopeDim) => {
    setPlaying(false);
    setMode("sandbox");
    setRopeDim(nextRope);
  };

  const isDefaultMla = readMode === "sparse" && mlaState.topK === 4 && ropeDim === 0;
  const liveTakeaway = isDefaultMla
    ? spec.takeaway
    : step <= 2
      ? `每位置存 512 维潜向量${ropeDim === 64 ? " + 64 维解耦旋转键 k_R（共 576 维，1.125 KiB/格）" : "（纯 512 维，1.00 KiB/格）"}，较 64 头全量缓存大幅瘦身！`
      : step === 3
        ? readMode === "full"
          ? `当前为标准全历史读取：读取全部 10 格潜向量，共搬运 ${mlaState.readKiB} KiB（每格 ${mlaState.perSlotKiB} KiB）。`
          : `当前为稀疏 Top-${mlaState.topK} 读取：10 格中仅挑 ${mlaState.activeSlotCount} 格搬运 ${mlaState.readKiB} KiB（较全读 ${mlaState.fullReadKiB} KiB 省 ${Number((mlaState.fullReadKiB - mlaState.readKiB).toFixed(2))} KiB）！`
        : `各头共读选中潜向量 c₀=[1,2]（本次总读 ${mlaState.readKiB} KiB），头 1 展开算 k=[1,4] 与吸收算 q̃=[2,2] 点积恒等于 ${mlaState.absorbedDot}！`;

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
      kickerTitle="MLA 多头潜在注意力（窄潜向量压缩与按头吸收还原）"
      question="每个位置只存 1 条短短的潜向量摘要，为什么几十个头还能读出各不相同的 K 和 V？"
      toolbarLabel="MLA 压缩存储与吸收还原四步控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-read-mode": readMode,
        "data-topk": mlaState.topK,
        "data-rope-dim": ropeDim,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mla-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as MlaIntuitionStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as MlaIntuitionStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="MLA 四步机制演化">
            {MLA_INTUITION_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`mla-step-${item.step}`}
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

          <fieldset className="wiki-edu-btn-row" aria-label="读取模式与 RoPE 维度实验">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mla-read-full"
              aria-pressed={mode === "sandbox" && readMode === "full"}
              style={eduBtnStyle(mode === "sandbox" && readMode === "full", "dark")}
              onClick={() => applyReadMode("full")}
            >
              读全历史 (10格)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mla-read-sparse"
              aria-pressed={mode === "sandbox" && readMode === "sparse"}
              style={eduBtnStyle(mode === "sandbox" && readMode === "sparse", "teal")}
              onClick={() => applyReadMode("sparse")}
            >
              {`稀疏 Top-${mlaState.topK}`}
            </button>
            <label htmlFor={sliderId} className="wiki-edu-slider-chip">
              <span className="mono">{`k=${mlaState.topK}/10`}</span>
              <input
                id={sliderId}
                type="range"
                min={1}
                max={10}
                step={1}
                value={mlaState.topK}
                data-testid="mla-topk-slider"
                aria-valuetext={`稀疏读取 Top-${mlaState.topK}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => applyTopK(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mla-rope-0"
              aria-pressed={mode === "sandbox" && ropeDim === 0}
              style={eduBtnStyle(mode === "sandbox" && ropeDim === 0, "dark")}
              onClick={() => applyRopeDim(0)}
            >
              +0维 RoPE
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mla-rope-64"
              aria-pressed={mode === "sandbox" && ropeDim === 64}
              style={eduBtnStyle(mode === "sandbox" && ropeDim === 64, "dark")}
              onClick={() => applyRopeDim(64)}
            >
              +64维 RoPE
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 2 || step === 4 ? "accent" : "default"}
      takeaway={liveTakeaway}
      kpi={`实读 ${mlaState.readKiB} KiB / 全读 ${mlaState.fullReadKiB} KiB · 吸收点积=${mlaState.absorbedDot}`}
      detailsSummary="查看工程与源码细节（c₀=[1,2] 低秩手算 / 矩阵结合律吸收 / 解耦 RoPE 与 TP 复制）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <svg
          viewBox="0 0 800 184"
          width="800"
          height="184"
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label={`MLA 潜向量落盘、按需挑取与矩阵吸收点积：${spec.title}`}
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
            y="8"
            width="118"
            height="34"
            rx="7"
            fill="#ddf4ef"
            stroke="#087f73"
            strokeWidth="1.4"
          />
          <text x="67" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            隐藏向量 h
          </text>
          <path
            className="wiki-edu-wire"
            d="M 128 25 L 154 25"
            stroke="#087f73"
            markerEnd={`url(#${mTeal})`}
          />

          <rect
            x="158"
            y="8"
            width="152"
            height="34"
            rx="7"
            fill="#fff4cf"
            stroke="#c78300"
            strokeWidth="1.5"
          />
          <text x="234" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`窄 c_KV (${mlaState.totalDims}维)`}
          </text>
          <path
            className={`wiki-edu-wire${step >= 2 ? " is-flow" : ""}`}
            d="M 312 25 L 368 25 L 368 58"
            stroke="#4c65b6"
            markerEnd={`url(#${mKv})`}
          />

          {HIST_SLOTS.map((slotPos) => {
            const x = 10 + slotPos * 38;
            const picked = step >= 3 && mlaState.selectedIndices.has(slotPos);
            const isNew = slotPos === 9;
            return (
              <g key={slotPos}>
                <rect
                  x={x}
                  y="64"
                  width="34"
                  height="36"
                  rx="5"
                  fill={picked ? "#ddf4ef" : "#e8edff"}
                  stroke={picked ? "#087f73" : "#4c65b6"}
                  strokeWidth={picked || isNew ? "1.8" : "1.2"}
                  opacity={step >= 3 && !picked ? 0.45 : 1}
                />
                <text x={x + 17} y="87" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  {isNew ? "新" : `c${slotPos}`}
                </text>
              </g>
            );
          })}
          <text x="200" y="122" textAnchor="middle" fontSize="12" fill="#66716d">
            {step >= 3
              ? "稀疏 MLA 变体挑子集（含 c₀）；标准 MLA 读全部历史 c_t"
              : "KV cache 每位置只存 1 条共用窄潜向量"}
          </text>
          <rect x="10" y="138" width="380" height="34" rx="6" fill="#fbfaf6" stroke="#d8d8cf" />
          <text x="200" y="160" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`每格 ${mlaState.perSlotKiB} KiB · 读 ${mlaState.activeSlotCount}/10 格 = ${mlaState.readKiB} KiB（全读 ${mlaState.fullReadKiB} KiB）`}
          </text>

          <rect
            x="414"
            y="8"
            width="134"
            height="34"
            rx="7"
            fill="#e8edff"
            stroke="#4c65b6"
            strokeWidth="1.4"
          />
          <text x="481" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            共用 c₀ = [1, 2]
          </text>
          <rect
            x="558"
            y="8"
            width="232"
            height="34"
            rx="7"
            fill={ropeDim === 64 ? "#f7e7f2" : "#fbfaf6"}
            stroke={ropeDim === 64 ? "#9a4b86" : "#d8d8cf"}
            strokeWidth="1.4"
          />
          <text x="674" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {ropeDim === 64 ? "附加解耦 k_R (+64维 · 0.125KiB)" : "纯潜向量模式 (k_R = 0维)"}
          </text>

          <line
            x1="481"
            y1="42"
            x2="481"
            y2="56"
            stroke="#087f73"
            strokeWidth="1.6"
            markerEnd={`url(#${mTeal})`}
          />
          <rect
            x="414"
            y="60"
            width="376"
            height="38"
            rx="7"
            fill="#fff4cf"
            stroke="#c78300"
            strokeWidth="1.4"
          />
          <text x="602" y="84" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`头1 展开算：W=diag(1,2) → k=[1,4] · q[2,1]·k = ${mlaState.unfoldedDot}`}
          </text>

          <rect
            x="414"
            y="106"
            width="376"
            height="38"
            rx="7"
            fill="#ddf4ef"
            stroke="#087f73"
            strokeWidth="1.5"
          />
          <text x="602" y="130" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
            {`头1 吸收算：q̃ = qWᵀ = [2,2] · q̃·c₀ = ${mlaState.absorbedDot}（恒等免展开）`}
          </text>

          <rect x="414" y="150" width="376" height="24" rx="5" fill="#fbfaf6" stroke="#d8d8cf" />
          <text x="602" y="167" textAnchor="middle" fontSize="12" fill="#66716d">
            {step >= 4 ? "头2 读同条 c₀ 还原 k=[2,1] · 各头独立" : "切换步骤 ④ 对照各头独立上投影与吸收"}
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">
            <strong>读取字节账本</strong>：BF16 下每格 <code>{mlaState.totalDims}</code> 维占{" "}
            <strong>{`${mlaState.perSlotBytes} B (${mlaState.perSlotKiB} KiB)`}</strong>；
            {readMode === "full"
              ? `标准全历史读取 10 格共 ${mlaState.readKiB} KiB。`
              : `稀疏 Top-${mlaState.topK} 仅搬运 ${mlaState.readKiB} KiB（较全读 ${mlaState.fullReadKiB} KiB 省 ${Number((mlaState.fullReadKiB - mlaState.readKiB).toFixed(2))} KiB）。`}
          </div>
          <div className="wiki-edu-note-card">
            <strong>矩阵吸收恒等验证</strong>：对 <code>c₀=[1,2], W=diag(1,2), q=[2,1]</code>，展开还原{" "}
            <code>k=[1,4]</code> 与吸收后 <code>q̃=[2,2]</code> 点积均为{" "}
            <strong>{mlaState.absorbedDot}</strong>；头 2 还原 <code>k=[2,1]</code> 互不干扰。
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
