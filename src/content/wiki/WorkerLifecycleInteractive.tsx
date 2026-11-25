import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const WORKER_LIFECYCLE_APPROVED_SHA256 =
  "764ad9d9da8e16026f171560e9c504e8bebd52de77b3d4ab325a1d56a666cf54";

export type WorkerLifecycleStep = 1 | 2 | 3 | 4 | 5 | 6;
export type WorkerDiagramMode = "sandbox" | "svg";

export interface WorkerStepSpec {
  readonly step: WorkerLifecycleStep;
  readonly shortBtn: string;
  readonly stationTitle: string;
  readonly stationSub: string;
  readonly driverPhase: "WorkerProc 子进程自驱" | "EngineCore 跨卡广播";
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly hasCrossCardBarrier: boolean;
  readonly barrierLabel: string | null;
  readonly deliverableTitle: string;
  readonly deliverableDesc: string;
  readonly variantTitle: string;
  readonly variantDesc: string;
  readonly detail: string;
}

export const WORKER_LIFECYCLE_STEPS: readonly WorkerStepSpec[] = [
  {
    step: 1,
    shortBtn: "① 构造打补丁",
    stationTitle: "① 构造补丁",
    stationSub: "注算子·验卡型",
    driverPhase: "WorkerProc 子进程自驱",
    badgeText: "第 1 / 6 步 · 子进程本地构造",
    takeawayTone: "default",
    title: "步骤 ① · 构造函数：注入昇腾补丁与自定义算子、加载配置并校验芯片代号",
    takeaway:
      "Worker 进程刚拉起，先把昇腾补丁和自定义算子装进当前进程，并核对安装包与芯片代号，错包当场拦停！",
    kpi: "产出：自定义算子表 + 卡型门禁",
    hasCrossCardBarrier: false,
    barrierLabel: null,
    deliverableTitle: "刚性产物：已注册算子 + 昇腾配置缓存",
    deliverableDesc: "若对调到装模型之后，网络层构造时找不到昇腾融合算子与配置缓存，直接报错。",
    variantTitle: "进程隔离 · 310P 自动分流",
    variantDesc: "每个子进程必须独立打一遍补丁；Atlas 300I DUO (310P) 由平台类自动切入专属子类。",
    detail:
      "WorkerProc 子进程内调用 NPUWorker.__init__：在 super().__init__() 前执行 adapt_patch()、register_dummy_fusion_op()、A2/A3 ATB_EXTENSIONS、register_ascend_customop 与 init_ascend_config，并用 check_ascend_device_type() 对齐 get_soc_version()（8 进程预编 .pyc 可省约 11.7s 导入耗时）。",
  },
  {
    step: 2,
    shortBtn: "② 绑卡与栅栏1",
    stationTitle: "② 绑卡建组",
    stationSub: "拍快照·栅栏 1",
    driverPhase: "WorkerProc 子进程自驱",
    badgeText: "第 2 / 6 步 · 🔒 跨卡栅栏 1",
    takeawayTone: "accent",
    title: "步骤 ② · 绑卡与建组：建组前拍显存快照，全员过栅栏 1 握手 HCCL 通信域",
    takeaway: "先绑卡清缓存并拍下建组前快照（验空闲 ≥ u×总显存），随后全组卡在栅栏 1 等齐握手建通信组！",
    kpi: "🔒 栅栏 1：HCCL 全员握手建组",
    hasCrossCardBarrier: true,
    barrierLabel: "🔒 栅栏 1：HCCL 建组",
    deliverableTitle: "刚性产物：设备句柄 + 建组前快照 + 执行器",
    deliverableDesc:
      "快照特意拍在建组之前，才能让后续 HCCL 通信缓冲如实落入非 Torch 增量；未绑卡前更造不出执行器。",
    variantTitle: "跨卡硬同步 · 310P 内存差异",
    variantDesc: "同组少 1 张卡其余卡就一直停等握手；310P RC 模式改查主机可用内存并关闭即时编译。",
    detail:
      "init_device() 按本机 DP 偏移 local_rank 调 torch.npu.set_device，执行 gc.collect() + empty_cache() 后在建组前拍 MemorySnapshot 校验 free >= total × u（v0.30.0 默认 u=0.92）；再用 hccl 建立 TP/PP/DP/EP/MC2 通信组，注册 FLA 算子并实例化 NPUModelRunner / V2。",
  },
  {
    step: 3,
    shortBtn: "③ 读盘转分形",
    stationTitle: "③ 权重分形",
    stationSub: "读分片·转 NZ",
    driverPhase: "WorkerProc 子进程自驱",
    badgeText: "第 3 / 6 步 · 加载与可选早预热",
    takeawayTone: "default",
    title: "步骤 ③ · 加载权重与分形转换：扫描分片、执行 ND→NZ 重排并可并行早预热",
    takeaway:
      "把本卡分到的权重读进显存并重排成矩阵核偏好的分块格式（NZ），还能开后台线程边读盘边预热省时间！",
    kpi: "产出：常驻分形权重 + 权重实测账",
    hasCrossCardBarrier: false,
    barrierLabel: null,
    deliverableTitle: "刚性产物：本卡常驻权重 + 权重显存实测值",
    deliverableDesc: "不先把驻留权重与缩放系数落盘定型，第④步就无法测准剩余能给 KV 池留多少字节。",
    variantTitle: "早预热重叠 · 310P 强制转 NZ",
    variantDesc: "W8A8 或显式转 NZ 场景可开早预热遮蔽首次初始化；310P 强制转 NZ 且不支持 BF16（须传 FP16）。",
    detail:
      "load_model() 包在 DeviceMemoryProfiler 内：开空参 → 扫 safetensors 截本卡切片 → process_weights_after_loading 调 maybe_trans_nz（weight_nz_mode 默认 1 仅转 INT8，设 2 连浮点转 NZ，RL 强制置 0；910B3 首次 NZ 约 7.16s、二次 0.7ms）。可选开启 enable_early_nz_warmup / enable_early_kernel_warmup 与读盘并行并在返回前 join。",
  },
  {
    step: 4,
    shortBtn: "④ 试跑与栅栏2",
    stationTitle: "④ 试跑对齐",
    stationSub: "量峰值·栅栏 2",
    driverPhase: "EngineCore 跨卡广播",
    badgeText: "第 4 / 6 步 · 🔒 跨卡栅栏 2",
    takeawayTone: "warn",
    title: "步骤 ④ · 预算试跑与跨卡对齐：跑最大批假前向，过栅栏 2 取全组最小块数",
    takeaway:
      "拿最大批假数据真跑一次量出激活与通信峰值，引擎收齐各卡汇报后按最紧那张卡统一块数，富余卡同步缩回！",
    kpi: "🔒 栅栏 2：全组取最小块数对齐",
    hasCrossCardBarrier: true,
    barrierLabel: "🔒 栅栏 2：取 min 块数",
    deliverableTitle: "刚性产物：全组统一的最小块数配置",
    deliverableDesc: "手传显式字节预算也必跑试跑（兼做首次图外编译）；录图前截峰值才不会把图显存误扣进激活。",
    variantTitle: "木桶对齐 · 310P 预算折半",
    variantDesc:
      "全组按 min(num_blocks) 对齐防最紧卡爆池；310P 将扣减后的可用 KV 显存直接整除 2 留作工作区。",
    detail:
      "EngineCore 广播 determine_available_memory() 执行最大批 profile_run()（910B3 Qwen3-8B TP4 约 56s），校验单条 max_model_len 时预留 1 空块余量，物理池按 N_blocks = min_r floor(M_KV^(r) / B_page) 统一并收缩富余卡；注意试跑期间若同卡外部容器释放显存使 free 回升会触发断言失败。",
  },
  {
    step: 5,
    shortBtn: "⑤ 切物理KV池",
    stationTitle: "⑤ 切物理池",
    stationSub: "分块池·留空块",
    driverPhase: "EngineCore 跨卡广播",
    badgeText: "第 5 / 6 步 · 物理缓存池落盘",
    takeawayTone: "default",
    title: "步骤 ⑤ · 一次切出物理 KV 池：弹出 0 号永久空块，清零元数据置于睡眠池外",
    takeaway:
      "按对齐后的块数在显存里一次性切好定长物理 KV 池（运行期不再扩容），并把清零元数据留在睡眠池外防丢失！",
    kpi: "产出：定长物理 KV 池 + 0 号空块",
    hasCrossCardBarrier: false,
    barrierLabel: null,
    deliverableTitle: "刚性产物：定长物理 KV 张量池与块表底座",
    deliverableDesc: "第⑥步录制 Decode 图时必须真实读写物理缓存块，因此切池必须在试跑之后、录图之前。",
    variantTitle: "睡眠池隔离 · 连接器就绪",
    variantDesc: "开启睡眠模式时仅把缓存本体包进可释放标签，块清零元数据留池外避免唤醒后失效。",
    detail:
      "initialize_from_config() 按需先登记 DSpark 草稿层并初始化 KV 连接器（ensure_kv_transfer_initialized），再一次性分配物理 KV 张量（建 BlockPool 后弹出永久 null_block #0）；v0.30.0 中 CaMemAllocator(tag='kv_cache') 仅包裹缓存本体，_init_kv_zero_meta 留池外。",
  },
  {
    step: 6,
    shortBtn: "⑥ 预热与录图",
    stationTitle: "⑥ 预热录图",
    stationSub: "1−u 录图·接客",
    driverPhase: "EngineCore 跨卡广播",
    badgeText: "第 6 / 6 步 · 1−u 录图收尾上线",
    takeawayTone: "accent",
    title: "步骤 ⑥ · 7 类预热与 ACLGraph 录图：支取 1−u 留白录图，绑核后正式接客",
    takeaway:
      "跑完算子预热后，用预算外 1−u 留白逐档录制 Decode 图，打印四项实测账单与 CPU 绑核，服务正式上线接客！",
    kpi: "完成：7 类预热 + 1−u 录图上线",
    hasCrossCardBarrier: false,
    barrierLabel: null,
    deliverableTitle: "刚性产物：多档位 Decode 图池 + 实测建议值",
    deliverableDesc: "图池显存完全由 1−u 预算外留白买单；录完打印扣 150 MiB 安全裕度后的字节预算建议值。",
    variantTitle: "7 类预热收口 · 310P 跳过项",
    variantDesc:
      "含编译区间假前向、4 项 Triton 核与录图后矩阵乘收尾预热；310P 无 Triton、关图扩展并跳过收尾预热。",
    detail:
      "compile_or_warm_up_model() 依次跑编译尺寸 _dummy_run、Triton 四核预热（拒绝采样/惩罚项/RMSNorm/Indexer，main 升级为声明式 JitWarmupRegistry）、capture_model()（910B3 TP4 约 35~40s）、打印 Actual usage 与扣 150 MiB 的 --kv-cache-memory 建议值，最后执行 _warm_up_atb()、bind_cpus 绑核并刷出 Application startup complete。",
  },
];
export interface WorkerLifecycleInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: WorkerDiagramMode | undefined;
  readonly initialStep?: WorkerLifecycleStep | undefined;
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
  const [step, setStep] = useState<WorkerLifecycleStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = WORKER_LIFECYCLE_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mFlow = `${id}-${uid}-wl-flow`;
  const mGate = `${id}-${uid}-wl-gate`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 6) {
          setPlaying(false);
          return 6;
        }
        return (prev + 1) as WorkerLifecycleStep;
      });
    }, 1900);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: WorkerLifecycleStep) => {
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
    if (step >= 6) setStep(1);
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
        selectStep(Math.min(6, step + 1) as WorkerLifecycleStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as WorkerLifecycleStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
        event.preventDefault();
        selectStep(Number(event.key) as WorkerLifecycleStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const spotlightX = 72 + (step - 1) * 143;

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
      toolbarLabel="NPUWorker 六步冷启动与跨卡栅栏控制"
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
              style={eduBtnStyle(playing, "accent")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停演示" : "▶ 自动演示"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as WorkerLifecycleStep)}
            >
              ‹ 上一步
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 6}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(6, step + 1) as WorkerLifecycleStep)}
            >
              下一步 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="NPUWorker 六步冷启动顺序">
            {WORKER_LIFECYCLE_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`worker-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（worker.py 六方法 / 910B3 秒级耗时账单 / 7 类预热与 NPUWorker310 五处定制）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div>
        <div className="wiki-edu-chunks-wrap" style={{ marginBottom: "8px" }}>
          {WORKER_LIFECYCLE_STEPS.map((item) => {
            const stateCls =
              item.step < step
                ? "is-pass"
                : item.step === step
                  ? item.hasCrossCardBarrier
                    ? "is-warn"
                    : "is-pass"
                  : "is-skip";
            return (
              <div
                key={item.step}
                className={`wiki-edu-station ${stateCls}`}
                style={{
                  flex: "1 1 120px",
                  borderColor: item.step === step ? "#e85b32" : undefined,
                }}
              >
                <strong>{item.stationTitle}</strong>
                <span>{item.stationSub}</span>
              </div>
            );
          })}
        </div>

        <svg
          viewBox="0 0 860 64"
          width="860"
          height="64"
          style={{ width: "100%", height: "auto", display: "block", marginBottom: "10px" }}
          role="img"
          aria-label={`NPUWorker 双驱动泳道：当前第 ${step} 步（${spec.driverPhase}）`}
        >
          <defs>
            <marker
              id={mFlow}
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
              id={mGate}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="#b54237" />
            </marker>
          </defs>
          <rect x="8" y="10" width="414" height="44" rx="8" fill="#ece9df" stroke="#d8d8cf" />
          <text x="215" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
            ①–③ 子进程本地自驱（每卡独立准备）
          </text>
          <rect x="438" y="10" width="414" height="44" rx="8" fill="#e8edff" stroke="#4c65b6" />
          <text x="645" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#4c65b6">
            ④–⑥ 引擎跨卡广播（全组统一块数与录图）
          </text>
          <line
            x1="422"
            y1="32"
            x2="436"
            y2="32"
            stroke="#087f73"
            strokeWidth="2"
            markerEnd={`url(#${mFlow})`}
          />
          <circle
            cx={spotlightX}
            cy="10"
            r="7"
            fill={spec.hasCrossCardBarrier ? "#b54237" : "#e85b32"}
            stroke="#ffffff"
            strokeWidth="2"
          />
          {spec.barrierLabel && (
            <g>
              <rect x={Math.max(12, spotlightX - 86)} y="20" width="172" height="24" rx="12" fill="#b54237" />
              <text x={spotlightX} y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                {spec.barrierLabel}
              </text>
            </g>
          )}
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">为什么顺序一步都不能换？</span>
              <span className="wiki-edu-badge is-mid">{spec.driverPhase}</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.deliverableTitle}</strong>
              <br />
              {spec.deliverableDesc}
            </div>
          </div>

          <div className={`wiki-edu-panel${spec.hasCrossCardBarrier ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">跨卡同步栅栏与 310P 定制边界</span>
              <span className={`wiki-edu-badge ${spec.hasCrossCardBarrier ? "is-bad" : "is-good"}`}>
                {spec.hasCrossCardBarrier ? "跨卡硬栅栏" : "卡内顺次推进"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.variantTitle}</strong>
              <br />
              {spec.variantDesc}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
