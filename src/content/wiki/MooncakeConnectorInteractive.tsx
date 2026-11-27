import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
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
export const MOONCAKE_XFER_UNITS = [0.5, 1.5] as const;
export type MooncakeXferUnit = (typeof MOONCAKE_XFER_UNITS)[number];

export interface MooncakeTimelineSpan {
  readonly layer: number;
  readonly compStart: number;
  readonly compEnd: number;
  readonly xferStart: number;
  readonly xferEnd: number;
}

export interface MooncakeComputedState {
  readonly tpMode: MooncakeTpMode;
  readonly xferUnit: MooncakeXferUnit;
  readonly sourceRankCount: 1 | 2;
  readonly segmentCount: 6 | 12;
  readonly segmentKiB: 64 | 32;
  readonly totalKiB: 384;
  readonly pBlock7AddrKiB: 5448 | 5224;
  readonly pBlock12AddrKiB: 5768 | 5384;
  readonly dBlock3AddrKiB: 1192;
  readonly dBlock5AddrKiB: 1320;
  readonly dBlock3Intervals: readonly string[];
  readonly pullTotal: number;
  readonly pushTotal: number;
  readonly savedUnits: number;
  readonly pushSpans: readonly MooncakeTimelineSpan[];
}

export function computeMooncakeTransferState(
  tpMode: MooncakeTpMode = "sym-tp2",
  xferUnit: MooncakeXferUnit = 0.5,
): MooncakeComputedState {
  const isAsym = tpMode === "asym-tp4-tp2";
  const sourceRankCount: 1 | 2 = isAsym ? 2 : 1;
  const segmentKiB: 64 | 32 = isAsym ? 32 : 64;
  const segmentCount: 6 | 12 = isAsym ? 12 : 6;
  const pBlock7AddrKiB: 5448 | 5224 = isAsym ? 5224 : 5448;
  const pBlock12AddrKiB: 5768 | 5384 = isAsym ? 5384 : 5768;

  const layers = 3;
  const compUnit = 1.0;
  const pullTotal = Number((layers * compUnit + layers * xferUnit).toFixed(1));
  const pushSpans: MooncakeTimelineSpan[] = [];
  let prevXferEnd = 0;
  for (let l = 0; l < layers; l++) {
    const compStart = l * compUnit;
    const compEnd = (l + 1) * compUnit;
    const xferStart = Math.max(compEnd, prevXferEnd);
    const xferEnd = Number((xferStart + xferUnit).toFixed(1));
    prevXferEnd = xferEnd;
    pushSpans.push({ layer: l, compStart, compEnd, xferStart, xferEnd });
  }
  const pushTotal = prevXferEnd;
  const savedUnits = Number((pullTotal - pushTotal).toFixed(1));

  return {
    tpMode,
    xferUnit,
    sourceRankCount,
    segmentCount,
    segmentKiB,
    totalKiB: 384,
    pBlock7AddrKiB,
    pBlock12AddrKiB,
    dBlock3AddrKiB: 1192,
    dBlock5AddrKiB: 1320,
    dBlock3Intervals: isAsym ? ["[0..32K←P0]", "[32..64K←P1]"] : ["[0..64K←P0]"],
    pullTotal,
    pushTotal,
    savedUnits,
    pushSpans,
  };
}

export interface MooncakeConnectorInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MooncakeDiagramMode | undefined;
  readonly initialStep?: MooncakeStep | undefined;
  readonly initialTpMode?: MooncakeTpMode | undefined;
  readonly initialXferUnit?: MooncakeXferUnit | undefined;
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
  initialXferUnit = 0.5,
}: MooncakeConnectorInteractiveProps) {
  const [mode, setMode] = useState<MooncakeDiagramMode>(initialMode);
  const [step, setStep] = useState<MooncakeStep>(initialStep);
  const [tpMode, setTpMode] = useState<MooncakeTpMode>(initialTpMode);
  const [xferUnit, setXferUnit] = useState<MooncakeXferUnit>(initialXferUnit);
  const [playing, setPlaying] = useState(false);
  const spec = MOONCAKE_CONNECTOR_STEPS[step - 1]!;
  const state = useMemo(() => computeMooncakeTransferState(tpMode, xferUnit), [tpMode, xferUnit]);
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
      extraRootAttrs={{
        "data-step": step,
        "data-tp-mode": tpMode,
        "data-xfer-unit": xferUnit,
      }}
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="TP 拓扑与单层传输耗时比切换">
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
              对称 TP2 (6×64K)
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
              异构 P:TP4→D:TP2 (12×32K)
            </button>
            {MOONCAKE_XFER_UNITS.map((xu) => {
              const active = mode === "sandbox" && xferUnit === xu;
              return (
                <button
                  key={xu}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`mooncake-xfer-${xu}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => {
                    setPlaying(false);
                    setMode("sandbox");
                    setXferUnit(xu);
                  }}
                >
                  {`每层传 ${xu} 单位`}
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={
        step === 1 && tpMode === "asym-tp4-tp2"
          ? "动作 1 / 4 · 异构半块对表"
          : step === 2 && tpMode === "asym-tp4-tp2"
            ? "动作 2 / 4 · 12 段半块直传"
            : spec.badgeText
      }
      takeawayTone={spec.takeawayTone}
      takeaway={
        step === 1 && tpMode === "asym-tp4-tp2"
          ? "异构 P:TP4→D:TP2 下，P 每卡单块仅存半份 KV 头（步长 32 KiB）：D 先领好 64 KiB 空块 #3、#5，再同时对准 2 张 P 卡的 #7（5,224 KiB）与 #12（5,384 KiB）！"
          : step === 2 && tpMode === "asym-tp4-tp2"
            ? "不经 CPU 倒手重算：异构 P:TP4→D:TP2 下，D 每卡向 2 张 P 卡各拉 6 段 32 KiB 半块（2 卡 × 6 段 = 12 段）同层直传并拼入目标块上下半区！"
            : step === 4 && xferUnit === 1.5
              ? "当单层传输耗时升至 1.5 单位（慢于单层计算 1.0）且串行发送时：整批拉需 3.0+4.5=7.5 单位，逐层推在 L0 算完即启传，总长压至 5.5 单位（省 2.0）！"
              : spec.takeaway
      }
      kpi={
        step === 1 && tpMode === "asym-tp4-tp2"
          ? "2卡×32K：P#7(5224K)→D#3(1192K)"
          : step === 2 && tpMode === "asym-tp4-tp2"
            ? "2 卡 × 6 段 = 12 段半块直传"
            : step === 4
              ? `示意 ${state.pullTotal.toFixed(1)} → ${state.pushTotal.toFixed(1)} 单位 (省 ${state.savedUnits.toFixed(1)})`
              : spec.kpi
      }
      detailsSummary="查看工程与源码细节（地址换算式 / 非对称 TP 拼头 / V1 vs Layerwise 完成通知与 GQA+C8 禁配）"
      detailsContent={
        <>
          <strong>
            {step === 1 && tpMode === "asym-tp4-tp2"
              ? "动作 ① · 异构 TP 两端对表：2 张 P 卡各押 32 KiB 半块 #7, #12，对齐 D 端 64 KiB 目的块 #3, #5"
              : step === 2 && tpMode === "asym-tp4-tp2"
                ? "动作 ② · 异构 TP 半块拼装搬运：2 卡 × 6 段 = 12 段显存直传"
                : spec.title}
          </strong>
          ：
          {step === 1 && tpMode === "asym-tp4-tp2"
            ? "地址换算公式 addr(b) = base + b × stride：异构 P:TP4→D:TP2 下 P 每卡步长缩半为 32 KiB、D 每卡步长仍为 64 KiB；示意 P 基址 5,000 KiB、D 基址 1,000 KiB，则 2 张 P 卡上的 P#7 均位于 5,000 + 7×32 = 5,224 KiB（P#12 位于 5,000 + 12×32 = 5,384 KiB），共同汇入 D#3 的 1,000 + 3×64 = 1,192 KiB 目的槽位；D 调度器本步给该请求排 0 token 挂入异步加载队列。"
            : step === 2 && tpMode === "asym-tp4-tp2"
              ? "按远端 session_id 分批调用 batch_transfer_sync_read 提交给 TransferEngine（进程登记上限 256 段）：非 MLA 模型须满足 prefill_tp_size % decode_tp_size == 0（如 8 KV 头下 P=TP4、D=TP2），V1 由 D 每卡向 2 张源 P 卡各提交 1 次 6 段批量读（2 卡 × 6 段 = 合计 12 段 32 KiB 半块）再本地重排；注意 v0.30.0 下 GQA + C8 禁配普通 MooncakeConnector（防 bf16 误读为 int8，须改用 Layerwise）。"
              : spec.detail}
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
            viewBox="0 0 860 296"
            width="860"
            height="296"
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
              width="252"
              height="186"
              rx="10"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="136" y="26" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              P 源显存池 (基址 5000K)
            </text>
            <text x="136" y="46" textAnchor="middle" fontSize="12" fill="#66716d">
              {step === 3
                ? "收齐回执 · 释放 #7, #12"
                : tpMode === "asym-tp4-tp2"
                  ? "双源 P0+P1 · 12段×32K"
                  : "单源 P0 · 6段×64K"}
            </text>

            {tpMode === "sym-tp2" ? (
              <>
                {[0, 1, 2].map((ly) => {
                  const ry = 56 + ly * 38;
                  return (
                    <g key={`p-sym-${ly}`}>
                      <rect
                        x="26"
                        y={ry}
                        width="220"
                        height="30"
                        rx="6"
                        fill={step === 3 ? "#ddf4ef" : "#fff4cf"}
                        stroke={step === 3 ? "#087f73" : "#c78300"}
                        strokeWidth="1.4"
                        strokeDasharray={step === 3 ? "4 2" : undefined}
                      />
                      <text
                        x="136"
                        y={ry + 20}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="700"
                        fill="#17211f"
                      >
                        {`L${ly}: #7(5448K) · #12(5768K)`}
                      </text>
                    </g>
                  );
                })}
                <text x="136" y="184" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c78300">
                  {`共 384 KiB · ${spec.pBadge}`}
                </text>
              </>
            ) : (
              <>
                <rect
                  x="22"
                  y="56"
                  width="228"
                  height="54"
                  rx="7"
                  fill={step === 3 ? "#ddf4ef" : "#fff4cf"}
                  stroke={step === 3 ? "#087f73" : "#c78300"}
                  strokeWidth="1.5"
                />
                <text x="136" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  P-Rank0 (头0..1 · 6×32K)
                </text>
                <text x="136" y="98" textAnchor="middle" fontSize="12" fill="#66716d">
                  #7(5224K) · #12(5384K)
                </text>

                <rect
                  x="22"
                  y="118"
                  width="228"
                  height="54"
                  rx="7"
                  fill={step === 3 ? "#ddf4ef" : "#f7e7f2"}
                  stroke={step === 3 ? "#087f73" : "#9a4b86"}
                  strokeWidth="1.5"
                />
                <text x="136" y="138" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                  P-Rank1 (头2..3 · 6×32K)
                </text>
                <text x="136" y="160" textAnchor="middle" fontSize="12" fill="#66716d">
                  #7(5224K) · #12(5384K)
                </text>
              </>
            )}

            <rect
              x="276"
              y="8"
              width="308"
              height="186"
              rx="10"
              fill="#f7e7f2"
              stroke="#9a4b86"
              strokeWidth="1.4"
            />
            <text x="430" y="26" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              Mooncake 地址对表与半块拼头
            </text>
            <rect x="292" y="38" width="276" height="28" rx="6" fill="#ffffff" stroke="#9a4b86" />
            <text x="430" y="57" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {tpMode === "asym-tp4-tp2" ? "P0+P1[5224K] ↦ D#3[1192K]" : "P#7[5448K]↦D#3[1192K] · #12↦#5"}
            </text>

            {spec.wireKind === "v1-ack" ? (
              <path d="M 594 114 L 266 114" stroke="#087f73" strokeWidth="2.4" markerEnd={`url(#${mTeal})`} />
            ) : tpMode === "asym-tp4-tp2" ? (
              <>
                <path
                  d="M 254 84 C 370 84, 490 92, 602 96"
                  fill="none"
                  stroke="#c78300"
                  strokeWidth="2.1"
                  markerEnd={`url(#${mPlum})`}
                />
                <path
                  d="M 254 146 C 370 146, 490 126, 602 120"
                  fill="none"
                  stroke="#9a4b86"
                  strokeWidth="2.1"
                  markerEnd={`url(#${mPlum})`}
                />
              </>
            ) : (
              <>
                <path
                  d="M 266 88 L 594 88"
                  stroke={spec.wireKind === "handshake" ? "#66716d" : "#9a4b86"}
                  strokeWidth="2"
                  markerEnd={`url(#${spec.wireKind === "handshake" ? mMuted : mPlum})`}
                />
                <path
                  d="M 266 122 L 594 122"
                  stroke={spec.wireKind === "handshake" ? "#66716d" : "#9a4b86"}
                  strokeWidth="2"
                  markerEnd={`url(#${spec.wireKind === "handshake" ? mMuted : mPlum})`}
                />
              </>
            )}

            <rect x="292" y="152" width="276" height="30" rx="6" fill="#ffffff" stroke="#d8d8cf" />
            <text x="430" y="172" textAnchor="middle" fontSize="12" fontWeight="700" fill="#9a4b86">
              {tpMode === "asym-tp4-tp2" ? "双源各6段32K = 12段拼满384K" : `${spec.wireLabel} · 6段×64K=384K`}
            </text>

            <rect
              x="598"
              y="8"
              width="252"
              height="186"
              rx="10"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="724" y="26" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              D 目的显存池 (基址 1000K)
            </text>
            <text x="724" y="46" textAnchor="middle" fontSize="12" fill="#087f73">
              D#3(1192K) · D#5(1320K)
            </text>
            {[0, 1, 2].map((ly) => {
              const ry = 56 + ly * 38;
              const rowSpec = spec.layers[ly]!;
              const fillA = rowSpec.dReady ? "#ddf4ef" : rowSpec.transferring ? "#fff4cf" : "#ffffff";
              const fillB = rowSpec.dReady ? "#ddf4ef" : rowSpec.transferring ? "#f7e7f2" : "#ffffff";
              return (
                <g key={`d-ly-${ly}`}>
                  {tpMode === "asym-tp4-tp2" ? (
                    <>
                      <rect
                        x="612"
                        y={ry}
                        width="110"
                        height="30"
                        rx="5"
                        fill={fillA}
                        stroke="#087f73"
                        strokeWidth="1.3"
                      />
                      <rect
                        x="726"
                        y={ry}
                        width="110"
                        height="30"
                        rx="5"
                        fill={fillB}
                        stroke="#9a4b86"
                        strokeWidth="1.3"
                      />
                    </>
                  ) : (
                    <rect
                      x="612"
                      y={ry}
                      width="224"
                      height="30"
                      rx="6"
                      fill={rowSpec.dReady ? "#ddf4ef" : rowSpec.transferring ? "#f7e7f2" : "#ffffff"}
                      stroke={rowSpec.dReady ? "#087f73" : "#9a4b86"}
                      strokeWidth="1.4"
                      strokeDasharray={!rowSpec.dReady ? "4 2" : undefined}
                    />
                  )}
                  <text x="724" y={ry + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {tpMode === "asym-tp4-tp2"
                      ? `L${ly}: 0..32K←P0 | 32..64K←P1`
                      : `L${ly}: #3[64K] · #5[64K]`}
                  </text>
                </g>
              );
            })}
            <text x="724" y="184" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {spec.dBadge}
            </text>

            <rect
              x="10"
              y="202"
              width="840"
              height="88"
              rx="10"
              fill="#fbfaf6"
              stroke="#d8d8cf"
              strokeWidth="1.4"
            />
            <text x="430" y="220" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`可比时间轴 (每层算1·传${xferUnit})：整批拉 ${state.pullTotal.toFixed(1)} vs 逐层推 ${state.pushTotal.toFixed(1)} (省 ${state.savedUnits.toFixed(1)} 单位)`}
            </text>

            <text x="98" y="247" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
              {`整批拉 ${state.pullTotal.toFixed(1)}`}
            </text>
            <rect x="186" y="232" width="204" height="20" rx="4" fill="#fff4cf" stroke="#c78300" />
            <rect
              x="390"
              y="232"
              width={3 * xferUnit * 68}
              height="20"
              rx="4"
              fill="#fff0e9"
              stroke="#b54237"
            />
            <text x="780" y="247" textAnchor="middle" fontSize="12" fill="#66716d">
              齐信释块放行
            </text>

            <text x="98" y="277" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {`逐层推 ${state.pushTotal.toFixed(1)}`}
            </text>
            <rect x="186" y="259" width="204" height="10" rx="3" fill="#ddf4ef" stroke="#087f73" />
            {state.pushSpans.map((sp) => (
              <rect
                key={`push-sp-${sp.layer}`}
                x={186 + sp.xferStart * 68}
                y="272"
                width={xferUnit * 68 - 2}
                height="11"
                rx="3"
                fill="#e8edff"
                stroke="#4c65b6"
              />
            ))}
            <text x="780" y="277" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              末层回调放行
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
