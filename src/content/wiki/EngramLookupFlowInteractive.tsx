import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const ENGRAM_LOOKUP_FLOW_APPROVED_SHA256 =
  "9a90f855923913ee523e9403872afa6f9f256b85f8a58876cc7ef4f5f65a6dd7";
export const ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256 = ENGRAM_LOOKUP_FLOW_APPROVED_SHA256;

export type EngramStep = 1 | 2 | 3 | 4;
export type EngramDiagramMode = "sandbox" | "svg";

export const ENGRAM_PLACEMENT_MODES = ["independent", "edp-sharded", "shared-mem"] as const;
export type EngramPlacementMode = (typeof ENGRAM_PLACEMENT_MODES)[number];

export const ENGRAM_PLACEMENT_LABELS: Record<EngramPlacementMode, string> = {
  independent: "独立4份 (107.3G·0通信)",
  "edp-sharded": "EDP分片 (26.8G·2次通信)",
  "shared-mem": "机内共享 (26.8G·0通信)",
};

const TOTAL_TABLE_ROWS = 100_000_000;
const EMBED_DIM = 256;
const GROUP_SIZE = 32;
const ROW_BYTES = EMBED_DIM + (EMBED_DIM / GROUP_SIZE) * 4; // 256 + 32 = 288 B
const BATCH_TOKENS = 8;
const HASH_HEADS = 4;
const LOCAL_DP_REPLICAS = 4;
const GIB = 1024 * 1024 * 1024;

export interface EngramStepSpec {
  readonly step: EngramStep;
  readonly shortBtn: string;
  readonly stationTitle: string;
  readonly badgeBase: string;
}

export const ENGRAM_STEPS: readonly EngramStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 拼窗算哈希",
    stationTitle: "① N-gram 拼窗",
    badgeBase: "步骤 1 / 4 · 短语窗口哈希与边界截断",
  },
  {
    step: 2,
    shortBtn: "② 副本协调/跳过",
    stationTitle: "② 跨副本路由",
    badgeBase: "步骤 2 / 4 · 三种副本放置模式的路由差异",
  },
  {
    step: 3,
    shortBtn: "③ 分片查表反量化",
    stationTitle: "③ 按行查表",
    badgeBase: "步骤 3 / 4 · 按行稀疏直读与现场反量化",
  },
  {
    step: 4,
    shortBtn: "④ 门控融回残差",
    stationTitle: "④ 门控融合",
    badgeBase: "步骤 4 / 4 · 全头归集与门控残差注入",
  },
];

export interface EngramSandboxState {
  readonly step: EngramStep;
  readonly placement: EngramPlacementMode;
  readonly totalTableRows: number;
  readonly rowBytes: 288;
  readonly singleCopyGiB: number;
  readonly totalFootprintGiB: number;
  readonly perReplicaGiB: number;
  readonly savedVsIndependentGiB: number;
  readonly hitRows: 32;
  readonly stepReadBytes: 9216;
  readonly transientHbmKiB: 16;
  readonly edpCollectiveOpsPerStep: 0 | 2;
  readonly head24DivisibleOn16Cards: boolean;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly badgeText: string;
  readonly takeaway: string;
  readonly kpi: string;
}

export function computeEngramStepMetrics(
  step: EngramStep,
  placementOrShared: EngramPlacementMode | boolean = "shared-mem",
): EngramSandboxState {
  const placement: EngramPlacementMode =
    typeof placementOrShared === "boolean"
      ? placementOrShared
        ? "shared-mem"
        : "edp-sharded"
      : placementOrShared;

  const singleCopyBytes = TOTAL_TABLE_ROWS * ROW_BYTES;
  const singleCopyGiB = Number((singleCopyBytes / GIB).toFixed(1)); // 26.8
  const fourCopiesGiB = Number(((singleCopyBytes * LOCAL_DP_REPLICAS) / GIB).toFixed(1)); // 107.3
  const savedThreeGiB = Number(((singleCopyBytes * (LOCAL_DP_REPLICAS - 1)) / GIB).toFixed(1)); // 80.5

  const totalFootprintGiB = placement === "independent" ? fourCopiesGiB : singleCopyGiB;
  const perReplicaGiB =
    placement === "edp-sharded"
      ? Number((singleCopyBytes / LOCAL_DP_REPLICAS / GIB).toFixed(1)) // 6.7
      : singleCopyGiB;
  const savedVsIndependentGiB = placement === "independent" ? 0 : savedThreeGiB;
  const edpCollectiveOpsPerStep: 0 | 2 = placement === "edp-sharded" ? 2 : 0;
  const head24DivisibleOn16Cards = placement !== "edp-sharded";

  const hitRows = (BATCH_TOKENS * HASH_HEADS) as 32;
  const stepReadBytes = (hitRows * ROW_BYTES) as 9216;
  const transientHbmKiB = ((hitRows * EMBED_DIM * 2) / 1024) as 16;

  let takeawayTone: EngramSandboxState["takeawayTone"] = "default";
  let badgeText = ENGRAM_STEPS[step - 1]!.badgeBase;
  let takeaway: string;
  let kpi: string;

  if (step === 1) {
    takeawayTone = "accent";
    takeaway =
      "本步 8 个词元各自和紧邻前文拼成短语算 4 个头哈希（共 32 个行号）；遇到图片占位符立刻填 -1 截断，绝不跨模态串味！";
    kpi = "8 词 × 4 头 = 32 个目标行号";
  } else if (step === 2) {
    if (placement === "shared-mem") {
      takeawayTone = "default";
      badgeText = "步骤 2 / 4 · 机内共享内存 · 单份底存 + 0 次跨副本通信";
      takeaway =
        "机内共享同时兼得两头优势：4 个本地副本共读同一份 26.8 GiB 主机内存段（较独立 4 份省 80.5 GiB），且跳过跨副本汇总通信（较 EDP 分片省 2 轮集合通信）！";
      kpi = `全机仅 ${totalFootprintGiB} GiB · 0 次 EDP 通信`;
    } else if (placement === "independent") {
      takeawayTone = "warn";
      badgeText = "步骤 2 / 4 · 独立 4 份主机表 · 0 通信但主机内存翻 4 倍";
      takeaway =
        "4 个本地副本各自独立加载一份完整主机表：虽无需跨副本汇总哈希（0 次 EDP 通信），但全机主机内存暴涨至 107.3 GiB（白白多占 80.5 GiB）！";
      kpi = `全机占 ${totalFootprintGiB} GiB (4×) · 0 次 EDP 通信`;
    } else {
      takeawayTone = "danger";
      badgeText = "步骤 2 / 4 · EDP 跨副本分片 · 省容量但每步多 2 次通信";
      takeaway =
        "把 4 个头按 EDP=4 切给 4 个副本：全机总表虽压回 26.8 GiB（每副本 6.7 GiB），但本步须先做 EDP All-Gather 汇总全组哈希（且若换 24 头在 16 卡下会因 24÷16 除不尽在建层直接报错）！";
      kpi = `全机 ${totalFootprintGiB} GiB · 每步须跑 2 次 EDP 通信`;
    }
  } else if (step === 3) {
    takeawayTone = "default";
    takeaway =
      "上亿行大表（26.8 GiB）无需整表搬进显存，NPU 按行稀疏读取命中的 32 行（合计仅 9,216 B = 9 KiB！）并现场反量化为 16 KiB 脑浮点！";
    kpi = `整表 ${singleCopyGiB} GiB vs 本步仅读 9,216 B (9 KiB)`;
  } else {
    takeawayTone = placement === "edp-sharded" ? "warn" : "default";
    takeaway =
      placement === "edp-sharded"
        ? "EDP 分片模式下，须先跑一次 EDP AllToAll 把命中行送回请求所在副本，再拼齐 4 个头做门控融合；16 KiB 瞬时显存用完即放。"
        : "无需跨副本换行，仅在本副本内拼齐全部 4 个头，投出键值并经门控加回残差流；16 KiB 瞬时向量算完即释，NPU 显存零常驻大表！";
    kpi = `瞬时显存 ${transientHbmKiB} KiB · 本步 EDP 通信 ${edpCollectiveOpsPerStep} 次`;
  }

  return {
    step,
    placement,
    totalTableRows: TOTAL_TABLE_ROWS,
    rowBytes: 288,
    singleCopyGiB,
    totalFootprintGiB,
    perReplicaGiB,
    savedVsIndependentGiB,
    hitRows,
    stepReadBytes,
    transientHbmKiB,
    edpCollectiveOpsPerStep,
    head24DivisibleOn16Cards,
    takeawayTone,
    badgeText,
    takeaway,
    kpi,
  };
}

export const ENGRAM_WINDOW_MODES = ["normal", "mm-boundary"] as const;
export type EngramWindowMode = (typeof ENGRAM_WINDOW_MODES)[number];

export interface EngramLookupFlowInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: EngramDiagramMode | undefined;
  readonly initialStep?: EngramStep | undefined;
  readonly initialPlacement?: EngramPlacementMode | undefined;
  readonly initialSharedMem?: boolean | undefined;
  readonly initialWindowKind?: EngramWindowMode | undefined;
}

export function EngramLookupFlowInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 3,
  initialPlacement,
  initialSharedMem,
  initialWindowKind = "normal",
}: EngramLookupFlowInteractiveProps) {
  const defaultPlacement: EngramPlacementMode =
    initialPlacement ?? (initialSharedMem === false ? "edp-sharded" : "shared-mem");
  const [mode, setMode] = useState<EngramDiagramMode>(initialMode);
  const [step, setStep] = useState<EngramStep>(initialStep);
  const [placement, setPlacement] = useState<EngramPlacementMode>(defaultPlacement);
  const [windowKind, setWindowKind] = useState<EngramWindowMode>(initialWindowKind);
  const [playing, setPlaying] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-eg-teal`;
  const mRed = `${id}-${uid}-eg-red`;
  const mAccent = `${id}-${uid}-eg-acc`;

  const state = useMemo(() => computeEngramStepMetrics(step, placement), [step, placement]);

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        const next = (prev + 1) as EngramStep;
        if (next >= 4) setPlaying(false);
        return next;
      });
    }, 1850);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: EngramStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const selectPlacement = (next: EngramPlacementMode) => {
    setPlaying(false);
    setMode("sandbox");
    setPlacement(next);
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
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectStep(Math.min(4, step + 1) as EngramStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as EngramStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as EngramStep);
        break;
    }
  };

  const stepActive = (target: EngramStep) => step === target;
  const colStroke = (target: EngramStep) => {
    if (step !== target) return "#d8d8cf";
    if (target === 2 && placement === "edp-sharded") return "#b54237";
    if (target === 2 && placement === "independent") return "#c78300";
    return "#087f73";
  };
  const tokenLabels =
    windowKind === "mm-boundary" ? (["图", "腾", "推", "理"] as const) : (["昇", "腾", "推", "理"] as const);

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
      kickerTag="母版 A · 四步稀疏查表"
      kickerTitle="Engram 条件记忆：N-gram 稀疏查表与三种副本放置模式"
      question="上亿行条件记忆大表怎么做到每步只取几行，而且不占宝贵的 NPU 显存？"
      toolbarLabel="Engram 四步查表与三种副本放置模式切换"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-placement": placement,
        "data-window": windowKind,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="engram-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as EngramStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as EngramStep)}
            >
              下一步 ›
            </button>
            {ENGRAM_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`engram-step-${item.step}`}
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

          <fieldset className="wiki-edu-btn-row" aria-label="4 副本放置模式与短语窗切换">
            {ENGRAM_PLACEMENT_MODES.map((pm) => {
              const active = mode === "sandbox" && placement === pm;
              return (
                <button
                  key={pm}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`engram-place-${pm}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => selectPlacement(pm)}
                >
                  {ENGRAM_PLACEMENT_LABELS[pm]}
                </button>
              );
            })}
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="engram-window-normal"
              aria-pressed={mode === "sandbox" && windowKind === "normal"}
              style={eduBtnStyle(mode === "sandbox" && windowKind === "normal", "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setWindowKind("normal");
              }}
            >
              纯文本短语窗
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="engram-window-mm"
              aria-pressed={mode === "sandbox" && windowKind === "mm-boundary"}
              style={eduBtnStyle(mode === "sandbox" && windowKind === "mm-boundary", "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setWindowKind("mm-boundary");
                setStep(1);
              }}
            >
              含图截断 (-1)
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={state.badgeText}
      takeawayTone={state.takeawayTone}
      takeaway={state.takeaway}
      kpi={state.kpi}
      detailsSummary="查看工程与源码细节（三种主机/分片模式真账 / 主机分块指针直读 / 跨机共享池实测）"
      detailsContent={
        <>
          按正文算例（<code>10⁸</code> 行 × <code>288 B = 26.8 GiB</code>，单步命中 <code>32</code> 行仅读{" "}
          <code>9,216 B = 9 KiB</code> → <code>16 KiB BF16</code>）对照单机 4 个 DP 副本三种互斥模式：①{" "}
          <strong>独立 4 份主机表</strong>（各建 <code>HostUvaBuffer</code>）：0 次跨副本 EDP
          通信，但主机内存翻为 <code>107.3 GiB</code>；② <strong>EDP 分片</strong>（
          <code>dp_shared_memory=false</code>，按 <code>EDP=4</code> 切头）：全机合计仅占{" "}
          <code>26.8 GiB</code>（每副本 <code>6.7 GiB</code>），但每步须跑 <code>gather_engram_hashes</code>
          （All-Gather）与 <code>exchange_engram_rows</code>（AllToAll）2 轮设备通信，且强校验{" "}
          <code>n_hash_cols % (TP×EDP) == 0</code>（24 头在 16 卡下除不尽即抛 <code>ValueError</code>）；③{" "}
          <strong>机内共享内存</strong>（<code>dp_shared_memory=true</code>，POSIX <code>/dev/shm</code> + CPU{" "}
          <code>Gloo</code>）：单份 <code>26.8 GiB</code> + <code>0</code> 次 EDP 通信并解除跨 DP
          头整除限制。在 <code>main</code> 跨实例 <code>shared_engram</code> 中，4 台 A3 超节点表底存从{" "}
          <code>824 GiB</code> 压至 <code>208 GiB</code>（强制 MRV2，与 <code>sleep_mode</code> 互斥；A2/A5 走
          HIXL RDMA 须设 <code>--shutdown-timeout &gt; 0</code>）。
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              ① 主机上亿行大表与 NPU 按行稀疏直读拓扑（点选步骤 / 放置模式联动）
            </span>
            <span
              className={`wiki-edu-badge ${
                placement === "shared-mem" ? "is-good" : placement === "independent" ? "is-warn" : "is-bad"
              }`}
            >
              {placement === "shared-mem"
                ? "单份内存 · 0次EDP"
                : placement === "independent"
                  ? "4份内存 · 0次EDP"
                  : "分片1份 · 2次EDP"}
            </span>
          </div>

          <svg
            viewBox="0 0 840 248"
            width="840"
            height="248"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`Engram 四步查表：第 ${step} 步，模式 ${ENGRAM_PLACEMENT_LABELS[placement]}`}
          >
            <defs>
              <marker
                id={mTeal}
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
                id={mRed}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
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
            </defs>

            <rect
              x="10"
              y="8"
              width="236"
              height="232"
              rx="10"
              fill={stepActive(1) ? "#ddf4ef" : "#fbfaf6"}
              stroke={colStroke(1)}
              strokeWidth={stepActive(1) ? "2" : "1.3"}
            />
            <text x="128" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ① 词元滑窗与多头哈希
            </text>
            {tokenLabels.map((tk, idx) => {
              const tx = 22 + idx * 54;
              const isImg = windowKind === "mm-boundary" && idx === 0;
              return (
                <g key={tk}>
                  <rect
                    x={tx}
                    y="40"
                    width="46"
                    height="30"
                    rx="6"
                    fill={isImg ? "#fff0e9" : "#ffffff"}
                    stroke={isImg ? "#b54237" : "#087f73"}
                    strokeWidth="1.4"
                    strokeDasharray={isImg ? "4 2" : undefined}
                  />
                  <text x={tx + 23} y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
                    {tk}
                  </text>
                </g>
              );
            })}
            <text x="128" y="92" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              {windowKind === "mm-boundary" ? "遇图占位填 -1 阻断串味" : "2/3-gram 滑窗拼短语"}
            </text>
            <rect x="22" y="106" width="212" height="28" rx="6" fill="#ffffff" stroke="#d8d8cf" />
            <text
              x="128"
              y="125"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={windowKind === "mm-boundary" ? "#b54237" : "#17211f"}
            >
              {windowKind === "mm-boundary" ? "H₀ → -1 (跳过查表)" : "H₀ → 行号 482"}
            </text>
            <rect x="22" y="140" width="212" height="28" rx="6" fill="#ffffff" stroke="#d8d8cf" />
            <text x="128" y="159" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              H₁ → 行号 91,037
            </text>
            <rect x="22" y="174" width="212" height="28" rx="6" fill="#ffffff" stroke="#d8d8cf" />
            <text x="128" y="193" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              H₂,H₃ → 274,110 / 661,504
            </text>
            <text x="128" y="226" textAnchor="middle" fontSize="12" fill="#66716d">
              8词×4头 = 32 个行号
            </text>
            <line
              x1="248"
              y1="124"
              x2="272"
              y2="124"
              stroke={placement === "edp-sharded" ? "#b54237" : "#087f73"}
              strokeWidth="1.8"
              markerEnd={`url(#${placement === "edp-sharded" ? mRed : mTeal})`}
            />

            <rect
              x="276"
              y="8"
              width="288"
              height="232"
              rx="10"
              fill={
                step === 2 || step === 3
                  ? placement === "edp-sharded"
                    ? "#fff0e9"
                    : placement === "independent"
                      ? "#fff4cf"
                      : "#ddf4ef"
                  : "#fbfaf6"
              }
              stroke={step === 3 ? "#087f73" : colStroke(2)}
              strokeWidth={step === 2 || step === 3 ? "2" : "1.3"}
            />
            <text x="420" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ② 主机内存池 (10⁸行·288B)
            </text>
            <text
              x="420"
              y="56"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={
                placement === "edp-sharded" ? "#b54237" : placement === "independent" ? "#c78300" : "#087f73"
              }
            >
              {placement === "shared-mem"
                ? "共享 /dev/shm 单份 26.8 GiB"
                : placement === "independent"
                  ? "独立复制 4 份 = 107.3 GiB!"
                  : "EDP=4 切头分片 · 各 6.7 GiB"}
            </text>

            <rect
              x="292"
              y="72"
              width="256"
              height="28"
              rx="5"
              fill={step >= 3 && windowKind !== "mm-boundary" ? "#ddf4ef" : "#ffffff"}
              stroke={step >= 3 && windowKind !== "mm-boundary" ? "#087f73" : "#d8d8cf"}
              strokeWidth="1.4"
            />
            <text x="420" y="91" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              命中行 482 [INT8+尺 288B]
            </text>

            <rect x="292" y="106" width="256" height="28" rx="5" fill="#ece9df" stroke="#d8d8cf" />
            <text x="420" y="125" textAnchor="middle" fontSize="12" fill="#66716d">
              其余 99,999,968 行静默 (0 B)
            </text>

            <rect
              x="292"
              y="140"
              width="256"
              height="28"
              rx="5"
              fill={step >= 3 ? "#ddf4ef" : "#ffffff"}
              stroke={step >= 3 ? "#087f73" : "#d8d8cf"}
              strokeWidth="1.4"
            />
            <text x="420" y="159" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              命中行 91,037 [INT8+尺 288B]
            </text>

            <rect
              x="292"
              y="174"
              width="256"
              height="28"
              rx="5"
              fill={placement === "edp-sharded" ? "#fff0e9" : "#ffffff"}
              stroke={placement === "edp-sharded" ? "#b54237" : "#087f73"}
            />
            <text
              x="420"
              y="193"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={placement === "edp-sharded" ? "#b54237" : "#087f73"}
            >
              {placement === "edp-sharded" ? "⚠ 须跑 All-Gather + AllToAll" : "✓ 4 副本直读 · 0 次跨卡通信"}
            </text>
            <text x="420" y="226" textAnchor="middle" fontSize="12" fill="#66716d">
              按行稀疏仅抓 32×288B = 9 KiB
            </text>
            <line
              x1="566"
              y1="124"
              x2="590"
              y2="124"
              stroke={step >= 3 ? "#e85b32" : "#087f73"}
              strokeWidth="1.8"
              markerEnd={`url(#${step >= 3 ? mAccent : mTeal})`}
            />

            <rect
              x="594"
              y="8"
              width="236"
              height="232"
              rx="10"
              fill={stepActive(4) ? "#ddf4ef" : "#fbfaf6"}
              stroke={colStroke(4)}
              strokeWidth={stepActive(4) ? "2" : "1.3"}
            />
            <text x="712" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
              ③ NPU 瞬时反量化融合
            </text>
            <text x="712" y="56" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              HBM 常驻大表：0 B
            </text>

            <rect x="608" y="72" width="208" height="36" rx="6" fill="#ffffff" stroke="#087f73" />
            <text x="712" y="95" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step >= 3 ? "现场反量化 → 16 KiB BF16" : "等待稀疏抓回 9 KiB"}
            </text>

            <rect x="608" y="118" width="208" height="36" rx="6" fill="#fff4cf" stroke="#c78300" />
            <text x="712" y="141" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {step >= 4 ? "门控注入 h' = h + α·v" : "门控投影拼齐 4 个头"}
            </text>

            <rect
              x="608"
              y="164"
              width="208"
              height="36"
              rx="6"
              fill="#fbfaf6"
              stroke="#66716d"
              strokeDasharray="4 2"
            />
            <text x="712" y="187" textAnchor="middle" fontSize="12" fontWeight="700" fill="#66716d">
              16 KiB 瞬时缓冲当步即释
            </text>
            <text x="712" y="226" textAnchor="middle" fontSize="12" fill="#66716d">
              单步仅触达整表 0.00003%
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 四步关键动作焦点与多模态边界</span>
              <span className="wiki-edu-badge is-good">{ENGRAM_STEPS[step - 1]!.stationTitle}</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>短语窗截断机制</strong>：纯文本窗口把当前词与前邻词拼成 2/3-gram 算 4
              头行号；一旦窗口滑过图片占位符，硬件/算子立即把该头哈希置为 <strong>-1 跳过查表</strong>
              ，杜绝图像特征被误当作文本词元查表串味。
            </div>
          </div>

          <div className={`wiki-edu-panel${placement !== "shared-mem" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 三档放置模式的容量与通信真账</span>
              <span className="wiki-edu-badge is-good">NPU 显存 0 常驻大表</span>
            </div>

            <div className="wiki-edu-lane-box">
              <div className="wiki-edu-lane-label">
                <span>上亿行静态底存 vs 本步按行触达量</span>
                <span className="mono">
                  {`${state.singleCopyGiB} GiB vs ${state.stepReadBytes.toLocaleString()} B`}
                </span>
              </div>
              <div className="wiki-edu-track">
                <div className="wiki-edu-op is-piece" style={{ flex: 0.78 }}>
                  {`单份整表 ${state.singleCopyGiB} GiB`}
                </div>
                <div className="wiki-edu-op is-full" style={{ flex: 0.22 }}>
                  读 9 KiB
                </div>
              </div>
            </div>

            <div className="wiki-edu-tok-list">
              <div className={`wiki-edu-tok-pill ${placement === "independent" ? "is-cow" : "is-priv"}`}>
                <span>单机 4 副本总表驻留体积</span>
                <span className="wiki-edu-ptr-tag">
                  {placement === "independent"
                    ? `${state.totalFootprintGiB} GiB（4 份重复驻留!）`
                    : placement === "edp-sharded"
                      ? `${state.totalFootprintGiB} GiB（4 副本分片 · 每份 ${state.perReplicaGiB} GiB）`
                      : `${state.totalFootprintGiB} GiB（共享单份 · 较独立省 ${state.savedVsIndependentGiB} GiB）`}
                </span>
              </div>
              <div className={`wiki-edu-tok-pill ${placement === "edp-sharded" ? "is-cow" : "is-sys"}`}>
                <span>每步跨副本 EDP 通信 & 24 头/16 卡反例</span>
                <span className="wiki-edu-ptr-tag">
                  {placement === "edp-sharded"
                    ? "每步 2 次通信 · 24÷16 除不尽建层即拒"
                    : "0 次跨副本通信 · 24÷4=6 可启动"}
                </span>
              </div>
            </div>

            {placement !== "shared-mem" && (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="engram-enable-shared-fix"
                style={eduBtnStyle(false)}
                onClick={() => selectPlacement("shared-mem")}
              >
                🔧 切至机内共享（兼得 26.8 GiB 单份底存 + 0 次跨副本通信）
              </button>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
