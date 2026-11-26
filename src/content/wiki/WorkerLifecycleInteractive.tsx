import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const WORKER_LIFECYCLE_APPROVED_SHA256 =
  "764ad9d9da8e16026f171560e9c504e8bebd52de77b3d4ab325a1d56a666cf54";

export type WorkerLifecycleStage = 1 | 2 | 3 | 4 | 5;
export type WorkerDiagramMode = "sandbox" | "svg";

export interface ColdStartCardSpec {
  readonly coldStep: 1 | 2 | 3 | 4 | 5 | 6;
  readonly stage: WorkerLifecycleStage;
  readonly driver: "subproc" | "engine";
  readonly title: string;
  readonly sub: string;
  readonly barrierBadge?: string;
}

export const COLD_START_SIX_CARDS: readonly ColdStartCardSpec[] = [
  { coldStep: 1, stage: 1, driver: "subproc", title: "① 构造补丁", sub: "注算子·验卡型" },
  {
    coldStep: 2,
    stage: 2,
    driver: "subproc",
    title: "② 绑卡建组",
    sub: "建组前快照",
    barrierBadge: "🔒 栅栏 1",
  },
  { coldStep: 3, stage: 3, driver: "subproc", title: "③ 读盘分形", sub: "量化转 NZ" },
  {
    coldStep: 4,
    stage: 4,
    driver: "engine",
    title: "④ 试跑对齐",
    sub: "全组取最小块",
    barrierBadge: "🔒 栅栏 2",
  },
  { coldStep: 5, stage: 5, driver: "engine", title: "⑤ 切物理池", sub: "留 0 号空块" },
  { coldStep: 6, stage: 5, driver: "engine", title: "⑥ 预热录图", sub: "1−u 录图接客" },
];

export interface WorkerStageSpec {
  readonly stage: WorkerLifecycleStage;
  readonly shortBtn: string;
  readonly driverTag: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly hasCrossCardBarrier: boolean;
  readonly deliverableLabel: string;
  readonly whyNoSwapLabel: string;
  readonly barrierOrVariantLabel: string;
  readonly detail: string;
}

export const WORKER_LIFECYCLE_STAGES: readonly WorkerStageSpec[] = [
  {
    stage: 1,
    shortBtn: "① 构造打补丁",
    driverTag: "子进程自驱",
    badgeText: "阶段 1 / 5 · 对应冷启动第 ① 步",
    takeawayTone: "default",
    title: "阶段 ① · 构造函数：注入昇腾补丁与自定义算子、加载配置并校验芯片代号",
    takeaway:
      "子进程刚拉起，先把昇腾补丁和自定义算子装进当前进程，并核对安装包与芯片代号，错装卡型包当场拦停！",
    kpi: "产物：算子注册表 + 卡型门禁",
    hasCrossCardBarrier: false,
    deliverableLabel: "算子表 + 配置缓存",
    whyNoSwapLabel: "未注算子无法构造模型层",
    barrierOrVariantLabel: "310P 自动切专属子类",
    detail:
      "WorkerProc 子进程调用 NPUWorker.__init__：在 super().__init__() 前执行 adapt_patch()、register_dummy_fusion_op()、A2/A3 ATB_EXTENSIONS、register_ascend_customop 与 init_ascend_config，并用 check_ascend_device_type() 核对 get_soc_version()（8 进程预编 .pyc 可省约 11.7s 导入耗时）。",
  },
  {
    stage: 2,
    shortBtn: "② 绑卡与栅栏1",
    driverTag: "子进程自驱",
    badgeText: "阶段 2 / 5 · 🔒 跨卡栅栏 1",
    takeawayTone: "accent",
    title: "阶段 ② · 绑卡与建组：建组前拍显存快照，全员过栅栏 1 握手 HCCL 通信域",
    takeaway:
      "先绑卡清缓存并在建组前拍快照（验空闲 ≥ u×总显存），随后全组卡在栅栏 1 等齐握手建通信组与执行器！",
    kpi: "🔒 栅栏 1：HCCL 全员握手建组",
    hasCrossCardBarrier: true,
    deliverableLabel: "设备句柄 + 快照 + 执行器",
    whyNoSwapLabel: "快照拍在建组前才含通信缓冲",
    barrierOrVariantLabel: "缺 1 卡全组停等握手",
    detail:
      "init_device() 按本机 DP 偏移 local_rank 调 torch.npu.set_device，执行 gc.collect() + empty_cache() 后在建组前拍 MemorySnapshot 校验 free >= total × u（v0.30.0 默认 u=0.92）；再用 hccl 建 TP/PP/DP/EP/MC2 通信组，注册 FLA 算子并实例化 NPUModelRunner / V2（310P RC 模式改用 psutil 查内存并设 jit_compile=False）。",
  },
  {
    stage: 3,
    shortBtn: "③ 读盘与分形",
    driverTag: "子进程自驱",
    badgeText: "阶段 3 / 5 · 对应冷启动第 ③ 步",
    takeawayTone: "default",
    title: "阶段 ③ · 加载权重与按需分形：默认仅量化权重转 NZ，BF16 默认保持 ND",
    takeaway:
      "读入本卡权重分片并按需重排分块格式：默认档下 INT8 量化权重转 NZ，而 Qwen3-8B 等 BF16 权重保持原 ND 布局！",
    kpi: "产物：常驻权重 + 权重实测显存",
    hasCrossCardBarrier: false,
    deliverableLabel: "常驻权重 + 实测占用",
    whyNoSwapLabel: "未装权重无法测剩余 KV 预算",
    barrierOrVariantLabel: "默认仅 INT8 转 NZ",
    detail:
      "load_model() 包在 DeviceMemoryProfiler 内：开空参 → 扫 safetensors 截切片 → process_weights_after_loading 调 maybe_trans_nz（utils.py:369-386：默认 weight_nz_mode=1 仅转 INT8 等量化权重，Qwen3-8B 等 BF16 浮点权重保持 ND，仅设 weight_nz_mode=2 才将浮点权重转 FRACTAL_NZ，RL 开启强制置 0；310P 为 FORCE_NZ 且禁 BF16）。量化或设 2 场景可开早预热与读盘重叠。",
  },
  {
    stage: 4,
    shortBtn: "④ 试跑与栅栏2",
    driverTag: "引擎跨卡广播",
    badgeText: "阶段 4 / 5 · 🔒 跨卡栅栏 2",
    takeawayTone: "warn",
    title: "阶段 ④ · 预算试跑与跨卡对齐：跑最大批假前向，过栅栏 2 取全组最小块数",
    takeaway:
      "拿最大批假数据真跑一次量出激活与通信峰值，引擎收齐各卡汇报后按最紧那张卡统一块数，富余卡同步缩回！",
    kpi: "🔒 栅栏 2：全组取 min 块数对齐",
    hasCrossCardBarrier: true,
    deliverableLabel: "全组统一最小块数",
    whyNoSwapLabel: "手设字节也必跑试跑做首编",
    barrierOrVariantLabel: "310P 可用 KV 整除 2",
    detail:
      "EngineCore 广播 determine_available_memory() 执行最大批 profile_run()（910B3 Qwen3-8B TP4 约 56s，手传显式字节预算仍照跑以完成首次图外编译），校验单条 max_model_len 时预留 1 空块余量，物理池按 N_blocks = min_r floor(M_KV^(r) / B_page) 对齐并收缩富余卡；310P 将可用 KV 直接 // 2 留作工作区。",
  },
  {
    stage: 5,
    shortBtn: "⑤ 切池与录图",
    driverTag: "引擎跨卡广播",
    badgeText: "阶段 5 / 5 · 合并冷启动 ⑤⑥ 步上线",
    takeawayTone: "accent",
    title: "阶段 ⑤ · 切物理池（⑤）+ 预热与 1−u 录图收尾（⑥）：正式就绪接客",
    takeaway:
      "先一次切出定长物理 KV 池并弹出 0 号空块，再跑完预热、用 1−u 留白录好 Decode 图（开 eager 则跳过录图）上线！",
    kpi: "完成：切池 + 预热 + 1−u 录图",
    hasCrossCardBarrier: false,
    deliverableLabel: "物理 KV 池 + Decode 图池",
    whyNoSwapLabel: "先有池才能跑录图并支取 1−u",
    barrierOrVariantLabel: "eager 跳录图·手设字节省建议单",
    detail:
      "第⑤步 initialize_from_config() 切出物理 KV 池并弹出永久 null_block #0（睡眠标签 tag='kv_cache' 仅包缓存本体；块清零元数据 _init_kv_zero_meta 仅在 MRV2 或 MRV1+Mamba+Eagle3 多步草稿下初始化并置池外）。第⑥步 compile_or_warm_up_model() 跑编译尺寸假前向与 Triton 四核预热，未设 --enforce-eager 时调 capture_model() 从 1−u 余量录图；仅未显式传 --kv-cache-memory-bytes 时打印 Actual usage 与扣 150 MiB 建议单（worker.py:908-919），最后执行 ATB 收尾预热与 CPU 绑核。",
  },
];
export const WORKER_LIFECYCLE_STEPS = WORKER_LIFECYCLE_STAGES;

export interface WorkerLifecycleInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: WorkerDiagramMode | undefined;
  readonly initialStep?: WorkerLifecycleStage | undefined;
}

export function WorkerLifecycleInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: WorkerLifecycleInteractiveProps) {
  const [mode, setMode] = useState<WorkerDiagramMode>(initialMode);
  const [step, setStep] = useState<WorkerLifecycleStage>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = WORKER_LIFECYCLE_STAGES[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-wk-teal`;
  const mWarn = `${id}-${uid}-wk-warn`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        const next = (prev + 1) as WorkerLifecycleStage;
        if (next >= 5) setPlaying(false);
        return next;
      });
    }, 1900);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: WorkerLifecycleStage) => {
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
        selectStep(Math.min(5, step + 1) as WorkerLifecycleStage);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as WorkerLifecycleStage);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectStep(Number(event.key) as WorkerLifecycleStage);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const renderSwimlane = (driver: "subproc" | "engine", laneTitle: string, laneSub: string) => (
    <div className="wiki-edu-panel">
      <div className="wiki-edu-panel-head">
        <span className="wiki-edu-panel-title">{laneTitle}</span>
        <span className="wiki-edu-badge is-mid">{laneSub}</span>
      </div>
      <div className="wiki-edu-chunks-wrap">
        {COLD_START_SIX_CARDS.filter((c) => c.driver === driver).map((card) => {
          const isCurrent = card.stage === step;
          const isDone = card.stage < step;
          const cls = isDone
            ? "is-pass"
            : isCurrent
              ? card.barrierBadge
                ? "is-warn"
                : "is-pass"
              : "is-skip";
          return (
            <div
              key={card.coldStep}
              className={`wiki-edu-station ${cls}`}
              style={{
                flex: "1 1 110px",
                borderColor: isCurrent ? "#17211f" : undefined,
              }}
            >
              <strong>{card.title}</strong>
              <span>{card.barrierBadge ?? card.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

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
      kickerTitle="NPUWorker 冷启动六步单向依赖链"
      question="敲下 vllm serve 后每张 NPU 按什么顺序就位，为什么这六步一步都不能对调？"
      toolbarLabel="NPUWorker 冷启动阶段与跨卡栅栏控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-barrier": spec.hasCrossCardBarrier ? "true" : "false",
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="worker-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as WorkerLifecycleStage)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as WorkerLifecycleStage)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="NPUWorker 五阶段冷启动控制">
            {WORKER_LIFECYCLE_STAGES.map((item) => {
              const active = mode === "sandbox" && step === item.stage;
              return (
                <button
                  key={item.stage}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`worker-step-${item.stage}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectStep(item.stage)}
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
      detailsSummary="查看工程与源码细节（worker.py 六方法 / BF16 ND 默认 / 7 类预热与 NPUWorker310 五处定制）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">双卡启动时序、跨卡同步栅栏与单卡显存水位生长图</span>
            <span className={`wiki-edu-badge ${spec.hasCrossCardBarrier ? "is-warn" : "is-good"}`}>
              {spec.hasCrossCardBarrier ? "跨卡同步栅栏" : "单向依赖链"}
            </span>
          </div>
          <svg
            viewBox="0 0 820 186"
            width="820"
            height="186"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`NPUWorker 冷启动第 ${step} 阶段时序与显存水位`}
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
                id={mWarn}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#c78300" />
              </marker>
            </defs>
            {[1, 2, 3, 4, 5].map((st, idx) => {
              const sx = 18 + idx * 160;
              const active = st === step;
              const done = st < step;
              const hbmH = [18, 28, 72, 92, 128][idx]!;
              return (
                <g key={`wk-svg-${st}`}>
                  <rect
                    x={sx}
                    y="12"
                    width="140"
                    height="162"
                    rx="8"
                    fill={active ? "#ddf4ef" : done ? "#fbfaf6" : "#ece9df"}
                    stroke={active ? "#087f73" : "#d8d8cf"}
                    strokeWidth={active ? "2" : "1.2"}
                  />
                  <rect
                    x={sx + 16}
                    y={152 - hbmH}
                    width="108"
                    height={hbmH}
                    rx="5"
                    fill={st === 4 && active ? "#fff4cf" : "#e8edff"}
                    stroke={st === 4 && active ? "#c78300" : "#4c65b6"}
                  />
                  <text x={sx + 70} y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {`阶段 ${st}`}
                  </text>
                  <text x={sx + 70} y="168" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {["算子补丁", "绑卡栅栏1", "载入权重", "试跑栅栏2", "切池录图"][idx]}
                  </text>
                  {idx < 4 && (
                    <line
                      x1={sx + 142}
                      y1="92"
                      x2={sx + 156}
                      y2="92"
                      stroke={st === 2 ? "#c78300" : "#087f73"}
                      strokeWidth="1.8"
                      markerEnd={`url(#${st === 2 ? mWarn : mTeal})`}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          {renderSwimlane("subproc", "上半场 · 子进程自驱 (①–③)", "每卡本地准备")}
          {renderSwimlane("engine", "下半场 · 引擎广播 (④–⑥)", "跨卡统一配置")}
        </div>

        <div className="wiki-edu-chunks-wrap">
          <div className="wiki-edu-chunk-pill">
            <strong>本步交付产物</strong>
            <span>{spec.deliverableLabel}</span>
          </div>
          <div className="wiki-edu-chunk-pill">
            <strong>禁换序原因</strong>
            <span>{spec.whyNoSwapLabel}</span>
          </div>
          <div className={`wiki-edu-chunk-pill${spec.hasCrossCardBarrier ? " is-last" : ""}`}>
            <strong>{spec.hasCrossCardBarrier ? "跨卡硬栅栏" : "定制与边界"}</strong>
            <span>{spec.barrierOrVariantLabel}</span>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
