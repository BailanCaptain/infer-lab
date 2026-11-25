import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const GQA_SHARED_KV_APPROVED_SHA256 =
  "33c40cac9a5bfcc24239a42e29576bf25420e225781cd63ad807c720c4f6ea97";
export const GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256 = GQA_SHARED_KV_APPROVED_SHA256;

export const GQA_RATIO_MODES = ["mha-1-1", "gqa-4-1", "gqa-8-1", "mqa-32-1"] as const;
export type GqaRatioMode = (typeof GQA_RATIO_MODES)[number];
export type GqaDiagramMode = "sandbox" | "svg";

export interface GqaSandboxMetrics {
  readonly ratioMode: GqaRatioMode;
  readonly shortBtn: string;
  readonly label: string;
  readonly modelRef: string;
  readonly numQHeads: 32;
  readonly numKvHeads: 32 | 8 | 4 | 1;
  readonly groupSize: 1 | 4 | 8 | 32;
  readonly wqWoPct: 100;
  readonly scoreMergePct: 100;
  readonly kvPct: number;
  readonly savedPct: number;
  readonly kv4kMiB: number;
  readonly perTok32LayerKiB: number;
  readonly qualityTone: "is-good" | "is-mid" | "is-warn";
  readonly qualityBadge: string;
  readonly summary: string;
  readonly detail: string;
}

const GQA_META: Record<GqaRatioMode, Omit<GqaSandboxMetrics, "ratioMode">> = {
  "mha-1-1": {
    shortBtn: "MHA 1:1 (32KV)",
    label: "MHA 多头注意力（32Q : 32KV）",
    modelRef: "传统 32 层基准（一对一独占）",
    numQHeads: 32,
    numKvHeads: 32,
    groupSize: 1,
    wqWoPct: 100,
    scoreMergePct: 100,
    kvPct: 100,
    savedPct: 0,
    kv4kMiB: 2048,
    perTok32LayerKiB: 512,
    qualityTone: "is-warn",
    qualityBadge: "显存与带宽最重",
    summary:
      "32 个查询头各占 1 组专属 K/V：表达自由度最高，但 4K 请求光 KV 就吃掉 2048 MiB（2 GiB），Decode 搬运极重。",
    detail:
      "MHA 下 n_kv = n_q = 32（d_h=128, BF16）：32 层基准每 token 占 512 KiB，4,096 token 单请求占 2 GiB；小算例中 Q₁ 读专属 V₁ 得 [1.20, 0.80]。",
  },
  "gqa-4-1": {
    shortBtn: "GQA 4:1 (8KV · Qwen3-8B)",
    label: "GQA 4:1 分组共享（32Q : 8KV）",
    modelRef: "Qwen3-8B 主基线（36层 144 KiB/tok）",
    numQHeads: 32,
    numKvHeads: 8,
    groupSize: 4,
    wqWoPct: 100,
    scoreMergePct: 100,
    kvPct: 25,
    savedPct: 75,
    kv4kMiB: 512,
    perTok32LayerKiB: 128,
    qualityTone: "is-good",
    qualityBadge: "质量紧贴 MHA · 省 4×",
    summary: "每 4 个查询头共读 1 组 K/V：各头仍拿自己的 Q 算出不同权重与输出，KV 显存与投影立减 75%！",
    detail:
      "同组共读不等于合并 Q 头：小算例 Q₀=[1,2] 与 Q₁=[0,1] 共读第 0 组 K₀/V₀，仍算出 [0.73,0.18,0.09]→[0.82,0.27] 与 [0.40,0.40,0.20]→[0.60,0.60] 两份不同输出。Qwen3-8B（36层 32Q:8KV）每 tok 为 144.0 KiB（4K 占 576 MiB），TP=8 时每卡恰分 1 个 KV 头零复制。",
  },
  "gqa-8-1": {
    shortBtn: "GQA 8:1 (4KV · 30B-A3B)",
    label: "GQA 8:1 高倍分组（32Q : 4KV）",
    modelRef: "Qwen3-30B-A3B（48层 96 KiB/tok）",
    numQHeads: 32,
    numKvHeads: 4,
    groupSize: 8,
    wqWoPct: 100,
    scoreMergePct: 100,
    kvPct: 12.5,
    savedPct: 87.5,
    kv4kMiB: 256,
    perTok32LayerKiB: 64,
    qualityTone: "is-good",
    qualityBadge: "高并发甜点 · 省 8×",
    summary: "每 8 个查询头共读 1 组 K/V：KV 容量与逻辑读取压到 1/8（256 MiB），腾出大片显存接纳更高并发。",
    detail:
      "Qwen3-30B-A3B 显式指定 head_dim=128、32Q:4KV，哪怕 48 层每 tok 全层 KV 也仅 96.0 KiB（比 36 层 Qwen3-8B 还省 1/3）；注意 TP=8 > n_kv=4 时触发跨卡复制（num_kv_head_replicas=2），单卡保底驻留 1 个 KV 头。",
  },
  "mqa-32-1": {
    shortBtn: "MQA 32:1 (1KV)",
    label: "MQA 多查询注意力（32Q : 1KV）",
    modelRef: "极端单组共享（n_kv = 1）",
    numQHeads: 32,
    numKvHeads: 1,
    groupSize: 32,
    wqWoPct: 100,
    scoreMergePct: 100,
    kvPct: 3.125,
    savedPct: 96.875,
    kv4kMiB: 64,
    perTok32LayerKiB: 16,
    qualityTone: "is-warn",
    qualityBadge: "省 32× · 易损表达质量",
    summary:
      "全部 32 个查询头挤着共读唯一 1 组 K/V：4K 缓存缩到 64 MiB，但缺少独立 V 子空间易导致生成质量下滑。",
    detail:
      "GQA 论文指出 MQA（G=1）虽把 KV 压到 1/n_q，但在大模型上易引起质量退化与训练不稳；且 W_Q/W_O 与逐位置 QKᵀ/PV 乘加次数（小算例恒为 24 次）依然 100% 不省。昇腾 FIA 原生直读双头数，无需在 HBM 做 repeat_kv 展开。",
  },
};

export function computeGqaSandboxMetrics(ratioMode: GqaRatioMode): GqaSandboxMetrics {
  return { ratioMode, ...GQA_META[ratioMode] };
}

export interface GqaSharedKvInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: GqaDiagramMode | undefined;
  readonly initialRatioMode?: GqaRatioMode | undefined;
}

export function GqaSharedKvInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialRatioMode = "gqa-4-1",
}: GqaSharedKvInteractiveProps) {
  const [mode, setMode] = useState<GqaDiagramMode>(initialMode);
  const [ratioMode, setRatioMode] = useState<GqaRatioMode>(initialRatioMode);
  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mKv = `${id}-${uid}-gqa-kv`;
  const metrics = useMemo(() => computeGqaSandboxMetrics(ratioMode), [ratioMode]);
  const modeIdx = GQA_RATIO_MODES.indexOf(ratioMode);

  const selectRatio = (next: GqaRatioMode) => {
    setMode("sandbox");
    setRatioMode(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typeof HTMLInputElement !== "undefined" && event.target instanceof HTMLInputElement) return;
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
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectRatio(GQA_RATIO_MODES[Math.min(3, modeIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectRatio(GQA_RATIO_MODES[Math.max(0, modeIdx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectRatio(GQA_RATIO_MODES[Number(event.key) - 1]!);
        break;
    }
  };

  const qXs = [30, 78, 126, 174, 226, 274, 322, 370] as const;
  const kvBoxes =
    ratioMode === "mha-1-1"
      ? qXs.map((x, i) => ({ x: x - 18, w: 36, cx: x, label: `KV${i}` }))
      : ratioMode === "gqa-4-1"
        ? [
            { x: 24, w: 162, cx: 105, label: "KV₀（4头共读）" },
            { x: 214, w: 162, cx: 295, label: "KV₁（4头共读）" },
          ]
        : [
            {
              x: 44,
              w: 312,
              cx: 200,
              label: ratioMode === "gqa-8-1" ? "KV₀（8头共读 · 省8×）" : "唯一 KV₀（32头全员共读）",
            },
          ];

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={setMode}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 B · 连续调参权衡"
      kickerTitle="GQA 分组查询注意力（共享 K/V 与四项开销真账）"
      question="几个查询头共读同一份 K、V，为什么各自算出的注意力结果还是不一样？"
      toolbarLabel="GQA 头分组比与显存带宽权衡控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-ratio-mode": ratioMode,
        "data-kv-heads": metrics.numKvHeads,
      }}
      toolbar={
        <>
          <label htmlFor={sliderId} className="wiki-edu-slider-chip">
            <span className="mono">{`32Q : ${metrics.numKvHeads}KV`}</span>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={GQA_RATIO_MODES.length - 1}
              step={1}
              value={modeIdx}
              data-testid="gqa-ratio-slider"
              aria-valuetext={metrics.label}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => {
                const next = GQA_RATIO_MODES[Number(e.target.value)];
                if (next !== undefined) selectRatio(next);
              }}
            />
          </label>

          <fieldset className="wiki-edu-btn-row" aria-label="GQA 分组刻度切换">
            {GQA_RATIO_MODES.map((m) => {
              const active = mode === "sandbox" && ratioMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`gqa-mode-${m}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectRatio(m)}
                >
                  {GQA_META[m].shortBtn}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={metrics.qualityBadge}
      takeawayTone={metrics.qualityTone === "is-warn" ? "warn" : "accent"}
      takeaway={metrics.summary}
      kpi={`4K KV：${metrics.kv4kMiB} MiB（省 ${metrics.savedPct}%）`}
      detailsSummary="查看工程与源码细节（同组独立 Softmax 手算 / TP 复制拐点 / 昇腾 FIA 直读）"
      detailsContent={
        <>
          <strong>{metrics.label}</strong>（{metrics.modelRef}）：{metrics.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① Q 头与共享 KV 组连线（前 8 头缩影）</span>
            <span className={`wiki-edu-badge ${metrics.qualityTone}`}>
              {`每组 ${metrics.groupSize} 个 Q 头`}
            </span>
          </div>

          <svg
            viewBox="0 0 400 132"
            width="400"
            height="132"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`GQA 连线拓扑：${metrics.label}`}
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
            </defs>
            {qXs.map((qx, idx) => {
              const targetIdx =
                ratioMode === "mha-1-1" ? idx : ratioMode === "gqa-4-1" ? Math.floor(idx / 4) : 0;
              const target = kvBoxes[targetIdx]!;
              return (
                <g key={qx}>
                  <rect
                    x={qx - 18}
                    y="8"
                    width="36"
                    height="28"
                    rx="6"
                    fill="#ddf4ef"
                    stroke="#087f73"
                    strokeWidth="1.4"
                  />
                  <text x={qx} y="27" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {`Q${idx}`}
                  </text>
                  <path
                    className="wiki-edu-wire"
                    d={`M ${qx} 36 C ${qx} 64, ${target.cx} 64, ${target.cx} 86`}
                    stroke="#4c65b6"
                    markerEnd={`url(#${mKv})`}
                  />
                </g>
              );
            })}
            {kvBoxes.map((box) => (
              <g key={box.label}>
                <rect
                  x={box.x}
                  y="90"
                  width={box.w}
                  height="34"
                  rx="7"
                  fill="#e8edff"
                  stroke="#4c65b6"
                  strokeWidth="1.6"
                />
                <text x={box.cx} y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  {box.label}
                </text>
              </g>
            ))}
          </svg>

          <div className="wiki-edu-tok-list">
            <div className="wiki-edu-tok-pill is-priv">
              <span>Q₀=[1,2] 独立打分 [0.73, 0.18, 0.09]</span>
              <span className="wiki-edu-ptr-tag">输出 [0.82, 0.27]</span>
            </div>
            <div className="wiki-edu-tok-pill is-cow">
              <span>Q₁=[0,1] 独立打分 [0.40, 0.40, 0.20]</span>
              <span className="wiki-edu-ptr-tag">
                {ratioMode === "mha-1-1" ? "读 V₁ → [1.20, 0.80]" : "读同组 V₀ → [0.60, 0.60]"}
              </span>
            </div>
          </div>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 四项计算与缓存账本（对比 MHA）</span>
            <span className="wiki-edu-badge is-mid">{metrics.modelRef}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>Q / 输出投影 + 逐头打分汇合</span>
              <span className="mono">100%（完全不省）</span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-attn" style={{ flex: 1 }}>
                32 个 Q 头照算 QKᵀ · PV · W_O
              </div>
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>K / V 投影与 KV Cache 显存带宽</span>
              <span className="mono">{`${metrics.kvPct}%（4K 占 ${metrics.kv4kMiB} MiB）`}</span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-full" style={{ flex: Math.max(0.16, metrics.kvPct / 100) }}>
                {`${metrics.kv4kMiB}M`}
              </div>
              {metrics.savedPct > 0 && (
                <div className="wiki-edu-op is-piece" style={{ flex: metrics.savedPct / 100 }}>
                  {`已省 ${metrics.savedPct}%`}
                </div>
              )}
            </div>
          </div>

          {(ratioMode === "mha-1-1" || ratioMode === "mqa-32-1") && (
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="gqa-apply-sweetspot"
              style={eduBtnStyle(false)}
              onClick={() => selectRatio("gqa-4-1")}
            >
              🔧 切回主流均衡档 GQA 4:1（Qwen3-8B 省 4× 且保质量）
            </button>
          )}
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
