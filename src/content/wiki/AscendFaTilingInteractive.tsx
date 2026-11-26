import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256 =
  "5fb7e7d61dfde37b59212b67594d25fe586083c70eb87594548824257df8f837";

export type AscendFaStep = 1 | 2 | 3 | 4;
export type AscendFaDiagramMode = "sandbox" | "svg";

export interface AscendFaStepSpec {
  readonly step: AscendFaStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly isNaiveOom: boolean;
  readonly hbmScorePeakText: string;
  readonly hbmRoundTripText: string;
  readonly hbmStatusNote: string;
  readonly ubTileTitle: string;
  readonly ubScaleM: string;
  readonly ubDenomL: string;
  readonly ubNumerO: string;
  readonly ubActionNote: string;
  readonly wireDirection: "hbm-explode" | "stream-in" | "rescale-loop" | "write-out";
  readonly wireLabel: string;
  readonly detail: string;
}

export const ASCEND_FA_STEPS: readonly AscendFaStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 朴素爆显存",
    badgeText: "对比基线 · 朴素三步落盘灾难",
    takeawayTone: "danger",
    title: "阶段 ① · 朴素注意力：整张 32K×32K 分数表写回 HBM，首层即爆 64 GiB",
    takeaway:
      "照字面拆成三步：单层打分表高达 64 GiB（是输入 Q 的 256 倍），往返搬运 256 GiB，64G 卡算第一层就爆！",
    kpi: "单层中间表 64 GiB · 往返 256 GiB",
    isNaiveOom: true,
    hbmScorePeakText: "64 GiB (爆卡!)",
    hbmRoundTripText: "256 GiB 往返",
    hbmStatusNote: "写 S(64G) → 读 S 写 P(128G) → 读 P(64G)",
    ubTileTitle: "片上缓冲闲置等搬运",
    ubScaleM: "需看完整行",
    ubDenomL: "等 32K 全齐",
    ubNumerO: "被迫落盘暂存",
    ubActionNote: "计算核做完一步就停下干等 HBM 吞吐巨表",
    wireDirection: "hbm-explode",
    wireLabel: "反复落盘 256G",
    detail:
      "Qwen3-8B 单层（32 查询头、8 KV 头、d=128、BF16）在 N=32768 下：Q 与 O 本体仅各 256 MiB、K 与 V 各 64 MiB（共 640 MiB），但实体化 [32, 32768, 32768] 分数表 S 占 64 GiB（FP32 则达 128 GiB），写 S + 读 S + 写 P + 读 P 额外产生约 256 GiB HBM 流量。",
  },
  {
    step: 2,
    shortBtn: "② 分块进片上",
    badgeText: "动作 2 / 4 · 片上驻留首块",
    takeawayTone: "default",
    title: "阶段 ② · 片上 Tiling：Q 小块驻留片上，第 1 块分数 s=[1, 2] 流式滑入",
    takeaway:
      "把 Q 切小块常驻片上高速缓冲（UB/L1），第 1 块 K/V 滑进来当场算出局部打分 s=[1, 2]，HBM 中间表直接归零！",
    kpi: "HBM 中间落盘 0 B · 暂记 m₁ = 2",
    isNaiveOom: false,
    hbmScorePeakText: "0 B 落盘",
    hbmRoundTripText: "仅读首块 K/V",
    hbmStatusNote: "HBM 只存 Q/K/V/O 本体（合计约 640 MiB）",
    ubTileTitle: "片上缓冲 · 第 1 块 s=[1, 2]",
    ubScaleM: "m₁ = 2",
    ubDenomL: "l₁ ≈ 1.3679",
    ubNumerO: "Õ₁ ≈ 23.6788",
    ubActionNote: "按局部最大值 m₁=2 暂存分子与分母，不写回 HBM",
    wireDirection: "stream-in",
    wireLabel: "滑入块 1",
    detail:
      "四数两分块手算对账（s=[1,2,4,1]，V=[10,20,30,40]）：第 1 块 s=[1,2]、V=[10,20] 进片上 UB，局部最大 m₁ = max(1,2) = 2，未归一化分母 l₁ = e^(1−2) + e^0 ≈ 1.3679，分子 Õ₁ = 10·e^(−1) + 20·1 ≈ 23.6788。",
  },
  {
    step: 3,
    shortBtn: "③ 在线重标定",
    badgeText: "动作 3 / 4 · Online Softmax 修正",
    takeawayTone: "accent",
    title: "阶段 ③ · Online Softmax：第 2 块 [4, 1] 刷新最大值 m₂=4，旧账乘 e⁻² 原地缩放",
    takeaway:
      "遇到更大的新峰值 m₂=4 怎么办？不用回头重读第 1 块！直接给旧账乘一个缩放因子 e⁻² 就能精准对齐新标尺！",
    kpi: "旧账 × e⁻² (0.1353) · 零重读",
    isNaiveOom: false,
    hbmScorePeakText: "0 B 落盘",
    hbmRoundTripText: "流式读块 2",
    hbmStatusNote: "第 1 块早已丢弃，全程零回头重读",
    ubTileTitle: "片上重标定 · 第 2 块 s=[4, 1]",
    ubScaleM: "m₂ = 4 (刷新!)",
    ubDenomL: "l₂ ≈ 1.2349",
    ubNumerO: "Õ₂ ≈ 35.1961",
    ubActionNote: "旧账乘 e^(2−4) ≈ 0.1353 后叠入新块，零近似误差",
    wireDirection: "rescale-loop",
    wireLabel: "原地 × e⁻²",
    detail:
      "利用恒等式 e^(s−m_old)·e^(m_old−m_new) = e^(s−m_new)：新块 s=[4,1]、V=[30,40] 使标尺升至 m₂=4，旧账同乘 e^(2−4)=e^(−2)≈0.1353，得 l₂ = l₁·e^(−2) + (1 + e^(−3)) ≈ 1.2349，Õ₂ = Õ₁·e^(−2) + (30 + 40·e^(−3)) ≈ 35.1961。",
  },
  {
    step: 4,
    shortBtn: "④ 单次写回 O",
    badgeText: "动作 4 / 4 · 精确归一收尾",
    takeawayTone: "default",
    title: "阶段 ④ · 扫完全块单次除 l₂ 写回 O（与全量 Softmax 28.5009 实数代数严格等价）",
    takeaway:
      "全部分块流过片上后做唯一一次除法 O = Õ₂ / l₂，算出 28.5009 一次写回 HBM——省掉 256 GiB 流量且实数代数等价（浮点重排仅末位微小舍入差）！",
    kpi: "输出 28.5009 · 仅写 256 MiB",
    isNaiveOom: false,
    hbmScorePeakText: "0 B 落盘",
    hbmRoundTripText: "写出 256 MiB O",
    hbmStatusNote: "摘除 O(N²) 显存墙，长上下文顺畅跑通",
    ubTileTitle: "片上收尾归一 · O = Õ₂ / l₂",
    ubScaleM: "全局 m = 4",
    ubDenomL: "除以 1.2349",
    ubNumerO: "O = 28.5009",
    ubActionNote: "与全量 Softmax 实数代数等价（有限浮点仅末位舍入差）",
    wireDirection: "write-out",
    wireLabel: "单次写出 O",
    detail:
      "未截断递推值 O = 35.196059 / 1.234909 ≈ 28.5009（上表 35.1961 与 1.2349 为四位小数展示截断），在实数代数上与全量 Softmax 严格相等，有限浮点下仅因加法结合顺序存在末位微小舍入差（跨卡 PCP/DCP 的 npu_attention_update 也复用同一 LSE=m+ln(l) 重标定）。v0.30.0 默认主力为 FIA（npu_fused_infer_attention_score，注意 910B3 普通 GQA 页交错 (H,2H) 视图在 Eager Decode 下会触发整池 Slice 连续化）；RL 训推一致 FA3 须开启 rl_config 双开关，图模式仅支持 PIECEWISE，或开启 enforce_eager 走逐算子 eager 路径。",
  },
];
export interface AscendFaTilingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: AscendFaDiagramMode | undefined;
  readonly initialStep?: AscendFaStep | undefined;
}

export function AscendFaTilingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: AscendFaTilingInteractiveProps) {
  const [mode, setMode] = useState<AscendFaDiagramMode>(initialMode);
  const [step, setStep] = useState<AscendFaStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = ASCEND_FA_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mRed = `${id}-${uid}-fa-red`;
  const mTeal = `${id}-${uid}-fa-teal`;
  const mAccent = `${id}-${uid}-fa-accent`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        const next = (prev + 1) as AscendFaStep;
        if (next >= 4) setPlaying(false);
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: AscendFaStep) => {
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
        selectStep(Math.min(4, step + 1) as AscendFaStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as AscendFaStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as AscendFaStep);
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
      kickerTitle="FlashAttention 片上分块与 Online Softmax"
      question="32K 长文算注意力，为什么朴素写法第一层就爆 64 GiB 显存，分块流式怎么做到 0 落盘？"
      toolbarLabel="FlashAttention 片上分块四步演化控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="ascend-fa-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as AscendFaStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as AscendFaStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="FlashAttention 四步演化">
            {ASCEND_FA_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`ascend-fa-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（Qwen3-8B 64 GiB 推导 / 四数重标定手算 / FIA 与 FA3 选路）"
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
              ① 显存 N×N 巨表 vs 片上分块流式扫描矩阵图（{spec.wireLabel}）
            </span>
            <span className={`wiki-edu-badge ${spec.isNaiveOom ? "is-bad" : "is-good"}`}>
              {spec.hbmScorePeakText}
            </span>
          </div>

          <svg
            viewBox="0 0 820 224"
            width="820"
            height="224"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`HBM 与片上缓冲数据流：${spec.wireLabel}`}
          >
            <defs>
              <marker
                id={mRed}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
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
            </defs>

            <rect
              x="12"
              y="8"
              width="368"
              height="208"
              rx="10"
              fill={spec.isNaiveOom ? "#fff0e9" : "#fbfaf6"}
              stroke={spec.isNaiveOom ? "#b54237" : "#d8d8cf"}
              strokeWidth="1.5"
            />
            <text x="196" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              设备显存 HBM (32K 序列)
            </text>
            {spec.isNaiveOom ? (
              <>
                <rect
                  x="28"
                  y="42"
                  width="336"
                  height="124"
                  rx="8"
                  fill="#ffffff"
                  stroke="#b54237"
                  strokeWidth="2"
                />
                <text x="196" y="88" textAnchor="middle" fontSize="14" fontWeight="700" fill="#b54237">
                  ✗ 实体化 32K×32K 分数矩阵 S / P
                </text>
                <text x="196" y="118" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
                  单层瞬时落盘 64 GiB · 直接撑爆显存!
                </text>
                <text x="196" y="148" textAnchor="middle" fontSize="12" fill="#66716d">
                  Q/K/V 本体仅 384 MiB，却被中间矩阵淹没
                </text>
              </>
            ) : (
              <>
                <rect
                  x="28"
                  y="44"
                  width="102"
                  height="44"
                  rx="6"
                  fill="#ddf4ef"
                  stroke="#087f73"
                  strokeWidth="1.6"
                />
                <text x="79" y="71" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  Qᵢ 当前行块
                </text>
                <rect
                  x="144"
                  y="44"
                  width="102"
                  height="44"
                  rx="6"
                  fill={step === 2 ? "#fff4cf" : "#ece9df"}
                  stroke={step === 2 ? "#c78300" : "#d8d8cf"}
                  strokeWidth="1.6"
                />
                <text x="195" y="71" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  K₁,V₁ 块1
                </text>
                <rect
                  x="260"
                  y="44"
                  width="102"
                  height="44"
                  rx="6"
                  fill={step === 3 ? "#fff4cf" : "#ece9df"}
                  stroke={step === 3 ? "#c78300" : "#d8d8cf"}
                  strokeWidth="1.6"
                />
                <text x="311" y="71" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  K₂,V₂ 块2
                </text>
                <rect
                  x="28"
                  y="104"
                  width="334"
                  height="58"
                  rx="7"
                  fill="#ffffff"
                  stroke="#087f73"
                  strokeDasharray="5 3"
                />
                <text x="195" y="138" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087f73">
                  ✓ N×N 分数表免落盘 (0 B) · 仅终态写回 Oᵢ
                </text>
              </>
            )}
            <text x="196" y="198" textAnchor="middle" fontSize="12" fill="#66716d">
              {spec.hbmRoundTripText}
            </text>
            <path
              d={spec.wireDirection === "write-out" ? "M 432 120 L 386 120" : "M 386 92 L 432 92"}
              stroke={spec.isNaiveOom ? "#b54237" : "#087f73"}
              strokeWidth="2.2"
              markerEnd={`url(#${spec.isNaiveOom ? mRed : mTeal})`}
            />

            <rect
              x="438"
              y="8"
              width="370"
              height="208"
              rx="10"
              fill="#ddf4ef"
              stroke="#087f73"
              strokeWidth="1.6"
            />
            <text x="623" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              昇腾 AI Core 片上 L1 / UB 缓冲
            </text>
            <rect x="456" y="44" width="334" height="36" rx="6" fill="#ffffff" stroke="#087f73" />
            <text x="623" y="67" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`m 标尺：${spec.ubScaleM} · l 分母：${spec.ubDenomL}`}
            </text>

            <rect
              x="456"
              y="92"
              width="334"
              height="44"
              rx="6"
              fill={step === 3 ? "#fff4cf" : "#ffffff"}
              stroke={step === 3 ? "#c78300" : "#087f73"}
              strokeWidth="1.6"
            />
            <text x="623" y="119" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`${spec.ubTileTitle}：${spec.ubNumerO}`}
            </text>
            {step === 3 && (
              <path
                d="M 762 142 C 762 174, 484 174, 484 142"
                fill="none"
                stroke="#e85b32"
                strokeWidth="2"
                markerEnd={`url(#${mAccent})`}
              />
            )}
            <text x="623" y="198" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {step === 3 ? "新最大值 m=4 到来：旧分子分母同乘 e^(2−4) 重标定" : spec.wireLabel}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className={`wiki-edu-panel${spec.isNaiveOom ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">设备显存 HBM（慢而大）</span>
              <span className={`wiki-edu-badge ${spec.isNaiveOom ? "is-bad" : "is-good"}`}>
                {spec.hbmScorePeakText}
              </span>
            </div>

            <div className="wiki-edu-tok-list">
              <div className="wiki-edu-tok-pill is-sys">
                <span>Q / K / V 本体</span>
                <span className="wiki-edu-ptr-tag">384 MiB</span>
              </div>
              <div className={`wiki-edu-tok-pill ${spec.isNaiveOom ? "is-cow" : "is-empty"}`}>
                <span>{spec.isNaiveOom ? "巨型分数表 S/P" : "N×N 分数表免落盘"}</span>
                <span className="wiki-edu-ptr-tag">{spec.isNaiveOom ? "64 GiB!" : "0 B"}</span>
              </div>
              <div className={`wiki-edu-tok-pill ${step === 4 ? "is-priv" : "is-sys"}`}>
                <span>注意力输出 O</span>
                <span className="wiki-edu-ptr-tag">{step === 4 ? "写出 256M" : "256 MiB"}</span>
              </div>
            </div>

            <div className="wiki-edu-note-card">{spec.hbmStatusNote}</div>
          </div>

          <div className="wiki-edu-hbm">
            <div className="wiki-edu-col-title">
              <span>AI Core 片上缓冲（UB / L1）</span>
              <span className="mono">{spec.hbmRoundTripText}</span>
            </div>
            <div className={`wiki-edu-block ${spec.isNaiveOom ? "is-free" : "is-private"} is-highlight`}>
              <div className="wiki-edu-block-id">m</div>
              <div className="wiki-edu-block-title">当前最大标尺</div>
              <span className="wiki-edu-ref-badge ref-priv">{spec.ubScaleM}</span>
            </div>
            <div className={`wiki-edu-block ${spec.isNaiveOom ? "is-free" : "is-shared"}`}>
              <div className="wiki-edu-block-id">l</div>
              <div className="wiki-edu-block-title">指数分母累加</div>
              <span className="wiki-edu-ref-badge ref-1">{spec.ubDenomL}</span>
            </div>
            <div
              className={`wiki-edu-block ${spec.isNaiveOom ? "is-free" : step === 3 ? "is-cow" : "is-shared"}`}
            >
              <div className="wiki-edu-block-id">Õ</div>
              <div className="wiki-edu-block-title">{spec.ubTileTitle}</div>
              <span className={`wiki-edu-ref-badge ${step === 3 ? "ref-2" : "ref-1"}`}>{spec.ubNumerO}</span>
            </div>
            <div className="wiki-edu-note-card">{spec.ubActionNote}</div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
