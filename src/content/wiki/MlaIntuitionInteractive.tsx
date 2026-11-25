import { type KeyboardEvent, useEffect, useId, useState } from "react";
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
    badgeText: "步骤 3 / 4 · 轻量搬运",
    title: "动作 ③ · 读取可见历史（或稀疏 indexer 选中的候选位置）潜向量",
    takeaway: "不管是全量读取因果历史，还是稀疏选择只挑重点位置，从 HBM 搬进芯片的都只是这条瘦身后的窄向量！",
    kpi: "图例 10 格挑 4 格窄向量",
    detail:
      "标准 MLA 读取全部因果历史位置；GLM 稀疏 MLA 先由轻量 indexer 交出候选位置清单（最多 2051 位置），主 attention 按清单经 block_table 仅读取命中位置的 512 维潜向量。",
  },
  {
    step: 4,
    shortBtn: "④ 恢复/吸收做多头",
    badgeText: "步骤 4 / 4 · 各头独立还原",
    title: "动作 ④ · 各头用专属上投影恢复独立 Kᵢ、Vᵢ（推理期矩阵吸收免展开直算）",
    takeaway:
      "妙处就在这里：虽然共读同一条摘要 c_KV，但每个头拿专属矩阵读出各不相同的 Kᵢ、Vᵢ，表达力远超硬砍头数！",
    kpi: "吸收：q̃·c 恒等免展开",
    detail:
      "数学上 k_{t,i}=c_t W_{UK,i}、v_{t,i}=c_t W_{UV,i}（小算例 c₀=[1,2] 还原出头1 [1,4] 与头2 [2,1] 不同键）。Decode 推理利用结合律 q_i K_iᵀ = (q_i W_{UK,i}ᵀ) Cᵀ 与 (p_i C) W_{UV,i} 将上投影吸收进查询与输出侧，内核把同一份潜向量同时当 K 和 V 直算（缩放仍除 √d_k）。",
  },
];

export interface MlaIntuitionInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MlaDiagramMode | undefined;
  readonly initialStep?: MlaIntuitionStep | undefined;
}

const HIST_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SELECTED_HIST_INDICES = new Set<number>([1, 4, 6, 9]);

export function MlaIntuitionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 2,
}: MlaIntuitionInteractiveProps) {
  const [mode, setMode] = useState<MlaDiagramMode>(initialMode);
  const [step, setStep] = useState<MlaIntuitionStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = MLA_INTUITION_STEPS[step - 1]!;
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
      extraRootAttrs={{ "data-step": step }}
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
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={step === 2 || step === 4 ? "accent" : "default"}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（c₀=[1,2] 低秩手算 / 矩阵结合律吸收 / 解耦 RoPE 与 TP 复制）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">① 压入窄潜向量池（10 格历史示意）</span>
            <span className="wiki-edu-badge is-good">
              {step >= 3 ? "按需挑 4 格读取" : "每格只存 1 条 c_KV"}
            </span>
          </div>

          <svg
            viewBox="0 0 400 132"
            width="400"
            height="132"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`MLA 潜向量落盘与挑取：${spec.title}`}
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
              压成窄 c_KV (+k_R)
            </text>

            <path
              className={`wiki-edu-wire${step >= 2 ? " is-flow" : ""}`}
              d="M 312 25 L 368 25 L 368 58"
              stroke="#4c65b6"
              markerEnd={`url(#${mKv})`}
            />

            {HIST_SLOTS.map((slotPos) => {
              const x = 10 + slotPos * 38;
              const picked = step >= 3 && SELECTED_HIST_INDICES.has(slotPos);
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
                ? "绿色高亮：本次被选中参与多头注意力的潜向量"
                : "KV cache 每位置只存 1 条共用窄潜向量"}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 缓存瘦身比与各头独立还原</span>
            <span className="wiki-edu-badge is-mid">{step >= 4 ? "吸收免展开" : "单位置省 64×"}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>单位置缓存对比（64头×512 vs 潜向量512）</span>
              <span className="mono">32,768 → 512</span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-full" style={{ flex: 0.18 }}>
                512
              </div>
              <div className="wiki-edu-op is-bubble" style={{ flex: 0.82 }}>
                省掉 32,256 个数（压缩 64×）
              </div>
            </div>
          </div>

          <div className="wiki-edu-tok-list">
            <div className={`wiki-edu-tok-pill ${step >= 4 ? "is-sys is-hit" : "is-sys"}`}>
              <span>头 1 读同一条 c₀=[1,2]</span>
              <span className="wiki-edu-ptr-tag">{step >= 4 ? "还原 k=[1,4] · q̃·c=6" : "专属上投影 1"}</span>
            </div>
            <div className={`wiki-edu-tok-pill ${step >= 4 ? "is-priv" : "is-sys"}`}>
              <span>头 2 读同一条 c₀=[1,2]</span>
              <span className="wiki-edu-ptr-tag">
                {step >= 4 ? "还原 k=[2,1] · 各不相同" : "专属上投影 2"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
