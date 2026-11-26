import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const MOONCAKE_CONNECTOR_APPROVED_SHA256 =
  "621ef9173957738f69a47d2c5c1a4fd22c0b317b25277b505337c83d48fc6810";

export type MooncakeStep = 1 | 2 | 3 | 4;
export type MooncakeDiagramMode = "sandbox" | "svg";

export interface MooncakeLayerRow {
  readonly layerLabel: string;
  readonly pSlotText: string;
  readonly dSlotText: string;
  readonly dReady: boolean;
  readonly transferring: boolean;
}

export interface MooncakeStepSpec {
  readonly step: MooncakeStep;
  readonly shortBtn: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly pHeader: string;
  readonly pBadge: string;
  readonly pBadgeTone: "is-good" | "is-mid" | "is-warn";
  readonly dHeader: string;
  readonly dBadge: string;
  readonly dBadgeTone: "is-good" | "is-mid" | "is-warn";
  readonly layers: readonly MooncakeLayerRow[];
  readonly wireKind: "handshake" | "rdma-copy" | "v1-ack" | "layerwise-push";
  readonly wireLabel: string;
  readonly protocolBanner: string;
  readonly detail: string;
}

export const MOONCAKE_CONNECTOR_STEPS: readonly MooncakeStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 分块与对表",
    badgeText: "动作 1 / 4 · 块号换显存地址",
    takeawayTone: "default",
    title: "动作 ① · 两端对表：P 押住源块 #7, #12，D 预分空块 #3, #5 并换算显存地址",
    takeaway:
      "两套实例块号各管各的：D 先领好空块 #3、#5 把请求挂起，再向 P 握手换地址簿，对准 P#7→D#3、P#12→D#5！",
    kpi: "P#7→D#3 (5448→1192 KiB)",
    pHeader: "P 实例 · 源块 #7, #12",
    pBadge: "算完押块待读",
    pBadgeTone: "is-warn",
    dHeader: "D 实例 · 目的块 #3, #5",
    dBadge: "挂起排 0 字",
    dBadgeTone: "is-mid",
    layers: [
      {
        layerLabel: "层 0",
        pSlotText: "P#7, #12 已就绪",
        dSlotText: "D#3, #5 空位",
        dReady: false,
        transferring: false,
      },
      {
        layerLabel: "层 1",
        pSlotText: "P#7, #12 已就绪",
        dSlotText: "D#3, #5 空位",
        dReady: false,
        transferring: false,
      },
      {
        layerLabel: "层 2",
        pSlotText: "P#7, #12 已就绪",
        dSlotText: "D#3, #5 空位",
        dReady: false,
        transferring: false,
      },
    ],
    wireKind: "handshake",
    wireLabel: "握手对地址簿",
    protocolBanner: "调度器侧只记账（挂起等待队列 + 押住源块），Worker 侧登记显存基址与块间距。",
    detail:
      "地址换算公式 addr(b) = base + b × stride：示意 P 基址 5,000 KiB、D 基址 1,000 KiB、单块 64 KiB，则 P#7 位于 5,000 + 7×64 = 5,448 KiB，对应写入 D#3 的 1,000 + 3×64 = 1,192 KiB；D 调度器本步给该请求排 0 token 挂入异步加载队列。",
  },
  {
    step: 2,
    shortBtn: "② 同层零拷贝搬",
    badgeText: "动作 2 / 4 · 6 段同层直传",
    takeawayTone: "accent",
    title: "动作 ② · 按层零拷贝搬运：2 块 × 3 层 = 6 段显存点对点直传",
    takeaway:
      "不经 CPU 倒手重算：Mooncake 传输引擎把 2 个块在 3 层里的 6 段历史 KV，层 0 对层 0 直接搬进 D 显存！",
    kpi: "2 块 × 3 层 = 6 段批量直传",
    pHeader: "P 实例 · 源显存直出",
    pBadge: "源块锁定防改写",
    pBadgeTone: "is-warn",
    dHeader: "D 实例 · 逐层填入",
    dBadge: "后台接收中",
    dBadgeTone: "is-mid",
    layers: [
      {
        layerLabel: "层 0",
        pSlotText: "P#7, #12 源段",
        dSlotText: "D#3, #5 已写入",
        dReady: true,
        transferring: true,
      },
      {
        layerLabel: "层 1",
        pSlotText: "P#7, #12 源段",
        dSlotText: "D#3, #5 已写入",
        dReady: true,
        transferring: true,
      },
      {
        layerLabel: "层 2",
        pSlotText: "P#7, #12 源段",
        dSlotText: "D#3, #5 传输中",
        dReady: false,
        transferring: true,
      },
    ],
    wireKind: "rdma-copy",
    wireLabel: "同层零拷贝",
    protocolBanner: "A2/A3 走 ADXL / RDMA、950DT 对接 HIXL；非对称 TP 时还按头比例拼装 KV 头。",
    detail:
      "6 段 (src, dst, len) 一次批量提交给 TransferEngine（进程登记上限 256 段）。若 P/D 的 TP 不同（非 MLA 模型须满足 prefill_tp_size % decode_tp_size == 0，如 8 KV 头下 P=TP4、D=TP2），V1 由 D 每卡从 2 张 P 卡各读 32 KiB 半块再本地重排；注意 v0.30.0 下 GQA + C8 禁配普通 MooncakeConnector（防 bf16 误读为 int8，须改用 Layerwise）。",
  },
  {
    step: 3,
    shortBtn: "③ V1 整批拉放行",
    badgeText: "动作 3 / 4 · 齐信释块回可调度",
    takeawayTone: "default",
    title: "动作 ③ · V1 完成通知：P 收齐预期 D 卡回执才释源块，D 校验成功回可调度态",
    takeaway:
      "D 读完发回执（P 收齐全部预期 D 卡信号才释放源块，防漏信另有 480s 兜底），成功请求回到可调度态，下一步排上接着算！",
    kpi: "齐收信释 P 块 · D 回可调度态",
    pHeader: "P 实例 · 收齐回执释块",
    pBadge: "齐信回收进池",
    pBadgeTone: "is-good",
    dHeader: "D 实例 · 全部层就绪",
    dBadge: "回可调度态",
    dBadgeTone: "is-good",
    layers: [
      {
        layerLabel: "层 0",
        pSlotText: "齐信后回池",
        dSlotText: "D#3, #5 就绪",
        dReady: true,
        transferring: false,
      },
      {
        layerLabel: "层 1",
        pSlotText: "齐信后回池",
        dSlotText: "D#3, #5 就绪",
        dReady: true,
        transferring: false,
      },
      {
        layerLabel: "层 2",
        pSlotText: "齐信后回池",
        dSlotText: "D#3, #5 就绪",
        dReady: true,
        transferring: false,
      },
    ],
    wireKind: "v1-ack",
    wireLabel: "完成回执释块",
    protocolBanner: "D 读完或失败均发完成信号，P 计齐全部预期 D 卡后还块；D 成功后回到可调度态等下一轮调度。",
    detail:
      "V1（v0.30.0 新拉取入口为 MooncakeConnectorV2 -> MooncakePullConnector）中：D 读取尝试结束无论成败均发信号，P 计数收齐全部预期 D 卡完成信号后才报发完并释放源块（通知丢失则 480s 强制回收，单次传输超时约 33s）；D 仅在读取成功时把请求从等待队列放回可调度态，下一次排上时才接着算（纯注意力模型全命中远端 KV 时仍回退 1 个位置计算末位提示词 logits）。",
  },
  {
    step: 4,
    shortBtn: "④ 逐层推藏等待",
    badgeText: "动作 4 / 4 · 算传流水线重叠",
    takeawayTone: "accent",
    title: "动作 ④ · Layerwise 逐层推对照：P 算完一层推一层，藏住前 L−1 层传输耗时",
    takeaway:
      "想再砍掉等待？换成逐层推：D 先分好块等在前面，P 每算完 1 层马上后台推过去，把前两层传输藏进计算里！",
    kpi: "示意 4.5 → 3.5 单位 (省 1.0)",
    pHeader: "P 实例 · 边算边推",
    pBadge: "算一层推一层",
    pBadgeTone: "is-good",
    dHeader: "D 实例 · 末层回调放行",
    dBadge: "省 (L−1) 层等待",
    dBadgeTone: "is-good",
    layers: [
      {
        layerLabel: "层 0",
        pSlotText: "算完即推 →",
        dSlotText: "与 P 算层 1 重叠",
        dReady: true,
        transferring: true,
      },
      {
        layerLabel: "层 1",
        pSlotText: "算完即推 →",
        dSlotText: "与 P 算层 2 重叠",
        dReady: true,
        transferring: true,
      },
      {
        layerLabel: "层 2",
        pSlotText: "末层写完回调",
        dSlotText: "全齐放行 Decode",
        dReady: true,
        transferring: true,
      },
    ],
    wireKind: "layerwise-push",
    wireLabel: "逐层重叠推送",
    protocolBanner: "逐层推由代理先挑 D 分块再挑 P；P 末层写完回调通知 D 放行（不走 V1 请求级押块）。",
    detail:
      "3 层示意（每层算 1 单位、传 0.5 单位）：整批拉需 3×1 + 3×0.5 = 4.5 单位；Layerwise（MooncakeLayerwiseConnector，main 新增 MooncakePushConnector）把前 L−1 层传输与后续计算重叠，仅需 3×1 + 0.5 = 3.5 单位（省 (3−1)×0.5 = 1 单位），但 D 仍须等末层到齐才开始生成。",
  },
];
export const MOONCAKE_TP_MODES = ["sym-tp2", "asym-tp4-tp2"] as const;
export type MooncakeTpMode = (typeof MOONCAKE_TP_MODES)[number];

export interface MooncakeConnectorInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MooncakeDiagramMode | undefined;
  readonly initialStep?: MooncakeStep | undefined;
  readonly initialTpMode?: MooncakeTpMode | undefined;
}

export function MooncakeConnectorInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
  initialTpMode = "sym-tp2",
}: MooncakeConnectorInteractiveProps) {
  const [mode, setMode] = useState<MooncakeDiagramMode>(initialMode);
  const [step, setStep] = useState<MooncakeStep>(initialStep);
  const [tpMode, setTpMode] = useState<MooncakeTpMode>(initialTpMode);
  const [playing, setPlaying] = useState(false);
  const spec = MOONCAKE_CONNECTOR_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mPlum = `${id}-${uid}-mc-plum`;
  const mTeal = `${id}-${uid}-mc-teal`;
  const mMuted = `${id}-${uid}-mc-muted`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        const next = (prev + 1) as MooncakeStep;
        if (next >= 4) setPlaying(false);
        return next;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: MooncakeStep) => {
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
        selectStep(Math.min(4, step + 1) as MooncakeStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as MooncakeStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as MooncakeStep);
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
      kickerTitle="Mooncake 连接器跨实例 KV 交接"
      question="P 实例和 D 实例的物理块号各管各的，怎么不重算提示词直接把历史 KV 搬过去？"
      toolbarLabel="Mooncake 连接器四步跨实例交接控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mooncake-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as MooncakeStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as MooncakeStep)}
            >
              下一步 ›
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mooncake-tp-sym"
              aria-pressed={mode === "sandbox" && tpMode === "sym-tp2"}
              style={eduBtnStyle(mode === "sandbox" && tpMode === "sym-tp2", "dark")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setTpMode("sym-tp2");
              }}
            >
              对称 TP2 直传
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="mooncake-tp-asym"
              aria-pressed={mode === "sandbox" && tpMode === "asym-tp4-tp2"}
              style={eduBtnStyle(mode === "sandbox" && tpMode === "asym-tp4-tp2", "dark")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setTpMode("asym-tp4-tp2");
              }}
            >
              异构 P:TP4→D:TP2
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="Mooncake 连接器四步交接演化">
            {MOONCAKE_CONNECTOR_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`mooncake-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（地址换算式 / 非对称 TP 拼头 / V1 vs Layerwise 完成通知与 GQA+C8 禁配）"
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
              ① 跨实例离散物理块对表与同层零拷贝搬运沙盘（
              {tpMode === "sym-tp2" ? "对称 TP2" : "异构 P:TP4→D:TP2 半块拼头"}）
            </span>
            <span className={`wiki-edu-badge ${spec.dBadgeTone}`}>{spec.dBadge}</span>
          </div>

          <svg
            viewBox="0 0 840 248"
            width="840"
            height="248"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`Mooncake P/D 数据流：${spec.wireLabel}`}
          >
            <defs>
              <marker
                id={mPlum}
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
                id={mMuted}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#66716d" />
              </marker>
            </defs>

            <rect
              x="10"
              y="8"
              width="256"
              height="232"
              rx="10"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="138" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              P 实例显存池 (基址 5000K)
            </text>
            <text x="138" y="50" textAnchor="middle" fontSize="12" fill="#66716d">
              {step === 3 ? "收齐回执 · 释放 #7, #12" : "源块 #7(5448K) · #12(5768K)"}
            </text>

            {[0, 1, 2].map((ly) => {
              const ry = 66 + ly * 48;
              return (
                <g key={`p-ly-${ly}`}>
                  <text x="34" y={ry + 22} textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
                    {`L${ly}`}
                  </text>
                  {[6, 7, 8, 12].map((blk, bi) => {
                    const bx = 54 + bi * 50;
                    const hit = blk === 7 || blk === 12;
                    return (
                      <g key={`p-${ly}-${blk}`}>
                        <rect
                          x={bx}
                          y={ry}
                          width="44"
                          height="34"
                          rx="6"
                          fill={!hit ? "#ece9df" : step === 3 ? "#ddf4ef" : "#fff4cf"}
                          stroke={!hit ? "#d8d8cf" : step === 3 ? "#087f73" : "#c78300"}
                          strokeWidth={hit ? "1.8" : "1"}
                          strokeDasharray={hit && step === 3 ? "4 2" : undefined}
                        />
                        <text
                          x={bx + 22}
                          y={ry + 22}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="#17211f"
                        >
                          {`#${blk}`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <text x="138" y="226" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
              {step === 4 ? "边算边推：算完1层即刻发出" : spec.pBadge}
            </text>
            <rect
              x="280"
              y="8"
              width="280"
              height="232"
              rx="10"
              fill="#f7e7f2"
              stroke="#9a4b86"
              strokeWidth="1.4"
            />
            <text x="420" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              {step === 4 ? "整批拉 vs 逐层重叠时序" : "Mooncake 地址换算与零拷贝"}
            </text>

            {step !== 4 ? (
              <>
                <rect x="296" y="44" width="248" height="32" rx="6" fill="#ffffff" stroke="#9a4b86" />
                <text x="420" y="65" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  P#7[5448K]↦D#3[1192K] · #12↦#5
                </text>
                {spec.wireKind === "handshake" && (
                  <>
                    <path
                      d="M 556 96 L 284 96"
                      stroke="#66716d"
                      strokeWidth="1.8"
                      markerEnd={`url(#${mMuted})`}
                    />
                    <path
                      d="M 284 132 L 556 132"
                      stroke="#66716d"
                      strokeWidth="1.8"
                      markerEnd={`url(#${mMuted})`}
                    />
                  </>
                )}
                {spec.wireKind === "rdma-copy" && (
                  <>
                    <path
                      d="M 272 90 L 568 90"
                      stroke="#9a4b86"
                      strokeWidth="2.2"
                      markerEnd={`url(#${mPlum})`}
                    />
                    <path
                      d="M 272 132 L 568 132"
                      stroke="#9a4b86"
                      strokeWidth="2.2"
                      markerEnd={`url(#${mPlum})`}
                    />
                    <path
                      d="M 272 174 L 568 174"
                      stroke="#9a4b86"
                      strokeWidth="2.2"
                      markerEnd={`url(#${mPlum})`}
                    />
                  </>
                )}
                {spec.wireKind === "v1-ack" && (
                  <path
                    d="M 568 132 L 272 132"
                    stroke="#087f73"
                    strokeWidth="2.4"
                    markerEnd={`url(#${mTeal})`}
                  />
                )}
                <rect x="296" y="186" width="248" height="38" rx="6" fill="#ffffff" stroke="#d8d8cf" />
                <text x="420" y="210" textAnchor="middle" fontSize="12" fontWeight="700" fill="#9a4b86">
                  {tpMode === "asym-tp4-tp2"
                    ? "D 每卡从 2 张 P 卡拼 32K 半头"
                    : `${spec.wireLabel} · 6段显存直传`}
                </text>
              </>
            ) : (
              <>
                <text x="420" y="56" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
                  V1 整批拉：算3层(3.0) + 传3层(1.5) = 4.5
                </text>
                <rect x="296" y="66" width="160" height="24" rx="5" fill="#fff4cf" stroke="#c78300" />
                <rect x="460" y="66" width="84" height="24" rx="5" fill="#fff0e9" stroke="#b54237" />
                <text x="420" y="118" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
                  Layerwise 逐层推：边算边推 = 3.5 (省1.0!)
                </text>
                <rect x="296" y="128" width="160" height="24" rx="5" fill="#ddf4ef" stroke="#087f73" />
                <rect x="350" y="158" width="144" height="24" rx="5" fill="#e8edff" stroke="#4c65b6" />
                <text x="420" y="214" textAnchor="middle" fontSize="12" fill="#17211f">
                  前 L−1 层传输藏在后续计算底下!
                </text>
              </>
            )}

            <rect
              x="574"
              y="8"
              width="256"
              height="232"
              rx="10"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="702" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              D 实例显存池 (基址 1000K)
            </text>
            <text x="702" y="50" textAnchor="middle" fontSize="12" fill="#087f73">
              目的块 #3(1192K) · #5(1320K)
            </text>
            {[0, 1, 2].map((ly) => {
              const ry = 66 + ly * 48;
              const rowSpec = spec.layers[ly]!;
              return (
                <g key={`d-ly-${ly}`}>
                  {[2, 3, 4, 5].map((blk, bi) => {
                    const bx = 594 + bi * 52;
                    const hit = blk === 3 || blk === 5;
                    return (
                      <g key={`d-${ly}-${blk}`}>
                        <rect
                          x={bx}
                          y={ry}
                          width="46"
                          height="34"
                          rx="6"
                          fill={
                            !hit
                              ? "#ece9df"
                              : rowSpec.dReady
                                ? "#ddf4ef"
                                : rowSpec.transferring
                                  ? "#f7e7f2"
                                  : "#ffffff"
                          }
                          stroke={!hit ? "#d8d8cf" : rowSpec.dReady ? "#087f73" : "#9a4b86"}
                          strokeWidth={hit ? "1.8" : "1"}
                          strokeDasharray={hit && !rowSpec.dReady ? "4 2" : undefined}
                        />
                        <text
                          x={bx + 23}
                          y={ry + 22}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="#17211f"
                        >
                          {`#${blk}`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <text x="702" y="226" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {spec.dBadge}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">{spec.pHeader}</span>
              <span className={`wiki-edu-badge ${spec.pBadgeTone}`}>{spec.pBadge}</span>
            </div>
            <div className="wiki-edu-note-card">{spec.protocolBanner}</div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">{spec.dHeader}</span>
              <span className={`wiki-edu-badge ${spec.dBadgeTone}`}>{spec.dBadge}</span>
            </div>
            <div className="wiki-edu-tok-list">
              {spec.layers.map((row) => (
                <div
                  key={`d-${row.layerLabel}`}
                  className={`wiki-edu-tok-pill ${row.dReady ? "is-priv" : row.transferring ? "is-cow" : "is-empty"}`}
                >
                  <span>{row.layerLabel}</span>
                  <span className="wiki-edu-ptr-tag">{`${row.pSlotText} → ${row.dSlotText}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
