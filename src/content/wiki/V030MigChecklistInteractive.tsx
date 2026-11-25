import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const V030_MIG_CHECKLIST_APPROVED_SHA256 =
  "0668db8ca3208c30576358a4f0dfe64ee648875641275226fb3ad3fdc10cebdc";
export const V030_MIG_FIG_CHECKLIST_APPROVED_SHA256 = V030_MIG_CHECKLIST_APPROVED_SHA256;

export type V030MigStep = 1 | 2 | 3 | 4 | 5 | 6;
export type V030MigDiagramMode = "sandbox" | "svg";

export interface V030MigGateSpec {
  readonly step: V030MigStep;
  readonly shortBtn: string;
  readonly stationTitle: string;
  readonly stationSub: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly riskLevel: "静默失效" | "兜底过渡" | "注册移除" | "留白缩窄" | "显存翻倍" | "执行器红线";
  readonly oldHabitTitle: string;
  readonly oldHabitDesc: string;
  readonly v030RealityTitle: string;
  readonly v030RealityDesc: string;
  readonly prescriptionTitle: string;
  readonly prescriptionDesc: string;
  readonly detail: string;
}

export const V030_MIG_GATES: readonly V030MigGateSpec[] = [
  {
    step: 1,
    shortBtn: "① 4个旧环境变量",
    stationTitle: "① 旧环境变量",
    stationSub: "静默忽略!",
    badgeText: "关卡 1 / 6 · 无声失效头号坑",
    takeawayTone: "danger",
    title: "关卡 ① · 4 个退役环境变量（NZ / MLAPO / FUSED_MC2 / MSMONITOR）静默失效",
    takeaway:
      "脚本里继续 export 旧环境变量不会报任何错，程序直接当没看见回落默认值！必须全部搬进 JSON 配置块！",
    kpi: "旧 env 静默忽略 → 迁入 JSON",
    riskLevel: "静默失效",
    oldHabitTitle: "v0.26 旧脚本习惯",
    oldHabitDesc: "在容器或启动脚本里导出分形、融合注意力、融合通信与监控守护四个旧环境变量。",
    v030RealityTitle: "v0.30.0 真实行为：直接忽略",
    v030RealityDesc: "四个变量已从环境变量表彻底删除，既不报错也不打印警告，全部按内部默认值运行。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc: "统一迁入额外配置 JSON 字段（未知旧键会被强类型校验拒收，务必一并清理）。",
    detail:
      "VLLM_ASCEND_ENABLE_NZ → weight_nz_mode（默认 1，仅接受 0/1/2；RL 开启自动置 0，Sleep Mode 唤醒须显式设 0）；VLLM_ASCEND_ENABLE_MLAPO → enable_mlapo（默认 true）；VLLM_ASCEND_ENABLE_FUSED_MC2 → enable_fused_mc2（默认 0，与 multistream_overlap_shared_expert 互斥）；MSMONITOR_USE_DAEMON → msmonitor_use_daemon（默认 false）。同时删除 enable_async_exponential 等历史废键（main 另移除 profiling_chunk_config）。",
  },
  {
    step: 2,
    shortBtn: "② FLASHCOMM1兜底",
    stationTitle: "② 序列并行键",
    stationSub: "仅剩兜底",
    badgeText: "关卡 2 / 6 · 过渡期兼容兜底",
    takeawayTone: "warn",
    title: "关卡 ② · FLASHCOMM1 环境变量移出正式表，仅留 os.getenv 过渡兜底",
    takeaway:
      "序列并行通信开关虽然靠底层一行兜底还能在 v0.30.0 唤醒，但已移出正式表，到新主线还会撞上上游开关移除！",
    kpi: "勿依赖兜底 → 改写 JSON 字段",
    riskLevel: "兜底过渡",
    oldHabitTitle: "v0.26 / rc2 旧脚本习惯",
    oldHabitDesc: "靠导出旧环境变量开启序列并行通信加速。",
    v030RealityTitle: "v0.30.0 真实行为：仅存兼容兜底",
    v030RealityDesc: "正式注册表已删除该变量，仅配置解析内部暂留一行环境变量兜底读取。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc:
      "立即改写进 JSON 布尔字段；注意社区新主线已移除上游序列并行旧开关，开启会告警并关量化通信。",
    detail:
      "v0.30.0（c09d3e20）中 envs.py 已移除 VLLM_ASCEND_ENABLE_FLASHCOMM1，仅在 ascend_config.py#L745-L756 保留 os.getenv 兜底映射至 enable_flashcomm1；在 main（8d6180e2）中上游已删除 PassConfig.enable_sp，激活 FlashComm1 会打印告警并自动关闭量化 All-Reduce。",
  },
  {
    step: 3,
    shortBtn: "③ W8A8_MIX退场",
    stationTitle: "③ 混合量化名",
    stationSub: "删 MoE 注册",
    badgeText: "关卡 3 / 6 · MoE 量化路径退场",
    takeawayTone: "danger",
    title: "关卡 ③ · W8A8_PDMIX 命名与 W8A8_MIX 的 MoE 专家注册彻底移除",
    takeaway: "以前给混合专家标 W8A8_MIX 只是打弃用警告，升到 v0.30.0 正式版后专家层的该注册已被彻底删除！",
    kpi: "MoE 禁标 W8A8_MIX → 改 DYNAMIC",
    riskLevel: "注册移除",
    oldHabitTitle: "v0.26 旧权重配置习惯",
    oldHabitDesc: "量化描述文件里把混合专家层标成 W8A8_PDMIX 或 W8A8_MIX。",
    v030RealityTitle: "v0.30.0 真实行为：仅保留线性层",
    v030RealityDesc: "正式版彻底移除了混合专家层的 W8A8_MIX 注册，仅保留普通线性层实现。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc: "检查量化描述文件，混合专家层统一迁移至 W8A8_DYNAMIC 动态量化方案。",
    detail:
      "w8a8_pdmix.py 实际注册键名为 W8A8_MIX（非文件名 PDMIX）：v0.26.0rc 起对 moe 打印弃用告警，v0.30.0（w8a8_pdmix.py#L35-L50）仅保留 @register_scheme('W8A8_MIX', 'linear')（AscendW8A8PDMixLinearMethod），MoE 专家须统一改用 W8A8_DYNAMIC。",
  },
  {
    step: 4,
    shortBtn: "④ 默认水位0.92",
    stationTitle: "④ 显存与档案",
    stationSub: "默认 0.92!",
    badgeText: "关卡 4 / 6 · 录图留白缩窄 2%",
    takeawayTone: "warn",
    title: "关卡 ④ · 源码默认显存比例是 0.92（非旧 FAQ 的 0.90）与四家族硬件档案重构",
    takeaway:
      "不传显存比例参数时，源码默认按 0.92 切走预算，留给录图的余量比你以为的 0.90 少了整整 1.28 GiB！",
    kpi: "默认 u=0.92 → 建议显式传 0.90",
    riskLevel: "留白缩窄",
    oldHabitTitle: "旧文档惯性误区",
    oldHabitDesc: "看旧问答写默认 0.9，启动时不传参数，并沿用零散芯片型号函数写分支。",
    v030RealityTitle: "v0.30.0 真实行为：0.92 + 四家族档案",
    v030RealityDesc: "64G 卡预算外留白从 6.40G 缩到 5.12G；芯片识别统一收拢为 A2/A3/310P/A5 四家族档案。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc: "大档位录图显式传 0.90（小模型 0.82~0.88）；自研插件改查四家族布尔能力契约。",
    detail:
      "上游 CacheConfig.gpu_memory_utilization 真实默认为 0.92（faqs.md#L146-L150 残留 0.9 旧文案；910B3 真机可见 60.96G 下 0.6B 在 u=0.90 仍触发 FIA 录图 OOM）。v0.30.0 新增 hardware_profile.py 建立不可变四家族档案（注意 v0.30.0 的 A5 暂不含 RUNTIME_CUSTOM_OPS，main 已补回）。",
  },
  {
    step: 5,
    shortBtn: "⑤ 原生FP8翻倍",
    stationTitle: "⑤ 分块 FP8",
    stationSub: "A2/A3 翻倍!",
    badgeText: "关卡 5 / 6 · 静默反量化显存翻倍",
    takeawayTone: "danger",
    title: "关卡 ⑤ · 原生分块 FP8 权重在 A2/A3 上静默反量化回 BF16（权重显存翻倍）",
    takeaway:
      "在 A2/A3 上直接拉起开源分块 FP8 模型能跑通，但底层悄悄把它还原成了 2 字节 BF16——没加速不说，显存直接翻倍！",
    kpi: "A2/A3 反量化翻倍 · main 直接报错",
    riskLevel: "显存翻倍",
    oldHabitTitle: "直接照搬开源 FP8 权重",
    oldHabitDesc: "拿社区发布的分块 FP8 权重直接上 A2/A3 部署，按 1 字节/参数估算单卡容量。",
    v030RealityTitle: "v0.30.0 真实行为：按卡型分道扬镳",
    v030RealityDesc: "仅昇腾 950 实时转为 1 字节 MXFP8 走量化乘加；A2/A3 静默反量化回 BF16 走普通矩阵乘。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc:
      "A2/A3 务必改用 ModelSlim 重定量 W8A8 或原生 BF16（社区新主线在 A2/A3 直接抛错拦截！）。",
    detail:
      "fp8_block.py#L17-L34 对分块 float8_e4m3fn + weight_scale_inv 权重：仅昇腾 950（A5）对合规层重定量为 MXFP8（32 元素共享 E8M0 scale），Atlas A2/A3 全部反量化回 model_dtype（BF16）使权重驻留翻倍挤占 KV 池；main（fp8_block.py#L114-L130）新增 _require_fp8_weight_matmul() 在 A2/A3 直接抛 NotImplementedError。",
  },
  {
    step: 6,
    shortBtn: "⑥ MRV2切换红线",
    stationTitle: "⑥ 执行器切换",
    stationSub: "默认仍 V1",
    badgeText: "关卡 6 / 6 · 执行器代际交接",
    takeawayTone: "accent",
    title: "关卡 ⑥ · v0.30.0 默认仍为 MRV1（特定特性强制 V2），main 彻底删除 V1",
    takeaway:
      "v0.30.0 正式版默认还是跑一代执行器，但开长文上下文并行或新版负载均衡时必须手开二代；脚本里千万别留 =0 硬锁！",
    kpi: "v0.30 默认 V1 · 清理 =0 备战 main",
    riskLevel: "执行器红线",
    oldHabitTitle: "代际认知混淆或硬编码 =0",
    oldHabitDesc: "误以为正式版已全面默认二代，或在部署模板里硬写环境变量 =0 强锁一代执行器。",
    v030RealityTitle: "v0.30.0 真实行为：默认 V1 + 条件强制 V2",
    v030RealityDesc: "未设环境变量时默认走一代；但开启长序列并行、新旗舰或新版负载均衡时强制要求二代。",
    prescriptionTitle: "安全处方与演进预警",
    prescriptionDesc:
      "命中强制列表显式设 =1，同时清光所有 =0 硬锁（社区新主线已删除一代，留 =0 当场报错退出）。",
    detail:
      "v0.30.0 的 patch_use_v2_model_runner.py 默认返回 False（MRV1），开启 PCP、DeepSeek V4.1（A5）、--enable-return-routed-experts、CPP+async_scheduling 或 V2 EPLB 时须导出 VLLM_USE_V2_MODEL_RUNNER=1；main（mrv2_utils.py#L29-L89）已彻底移除 MRV1，残留 =0 直接抛 ValueError。",
  },
];
export interface V030MigChecklistInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: V030MigDiagramMode | undefined;
  readonly initialStep?: V030MigStep | undefined;
}

export function V030MigChecklistInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: V030MigChecklistInteractiveProps) {
  const [mode, setMode] = useState<V030MigDiagramMode>(initialMode);
  const [step, setStep] = useState<V030MigStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = V030_MIG_GATES[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mRed = `${id}-${uid}-v30-red`;
  const mTeal = `${id}-${uid}-v30-teal`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 6) {
          setPlaying(false);
          return 6;
        }
        return (prev + 1) as V030MigStep;
      });
    }, 1900);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: V030MigStep) => {
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
        selectStep(Math.min(6, step + 1) as V030MigStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as V030MigStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
        event.preventDefault();
        selectStep(Number(event.key) as V030MigStep);
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
      kickerTag="母版 A · 逐关升级筛查"
      kickerTitle="v0.30.0 正式版六关升级避坑筛查"
      question="把 v0.26 / rc2 的老启动脚本直接搬到 v0.30.0，哪几处不报错却会悄悄踩雷？"
      toolbarLabel="v0.30.0 升级六关筛查控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="v030-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "accent")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停筛查" : "▶ 逐关筛查"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as V030MigStep)}
            >
              ‹ 上一关
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 6}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(6, step + 1) as V030MigStep)}
            >
              下一关 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="v0.30.0 六项核心升级关卡">
            {V030_MIG_GATES.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`v030-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（AscendConfig JSON 映射表 / FP8 跨卡门控 / main 分支提前预警）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div>
        <div className="wiki-edu-chunks-wrap" style={{ marginBottom: "8px" }}>
          {V030_MIG_GATES.map((item) => {
            const cls = item.step < step ? "is-pass" : item.step === step ? "is-fault" : "is-skip";
            return (
              <div key={item.step} className={`wiki-edu-station ${cls}`} style={{ flex: "1 1 120px" }}>
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
          aria-label={`升级路径：${spec.stationTitle} (${spec.riskLevel})`}
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
          </defs>
          <rect x="10" y="12" width="244" height="40" rx="8" fill="#fff0e9" stroke="#b54237" />
          <text x="132" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#b54237">
            v0.26 / rc2 老写法
          </text>
          <path
            className="wiki-edu-wire is-flow"
            d="M 258 32 L 304 32"
            stroke="#b54237"
            markerEnd={`url(#${mRed})`}
          />
          <rect x="308" y="12" width="244" height="40" rx="8" fill="#fff4cf" stroke="#c78300" />
          <text x="430" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
            {`v0.30.0：${spec.riskLevel}`}
          </text>
          <path
            className="wiki-edu-wire is-flow"
            d="M 556 32 L 602 32"
            stroke="#087f73"
            markerEnd={`url(#${mTeal})`}
          />
          <rect x="606" y="12" width="244" height="40" rx="8" fill="#ddf4ef" stroke="#087f73" />
          <text x="728" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#087f73">
            安全替换处方 + 兼容新主线
          </text>
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-panel is-oom">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 照搬旧脚本会发生什么？</span>
              <span className="wiki-edu-badge is-bad">{spec.riskLevel}</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.oldHabitTitle}</strong>：{spec.oldHabitDesc}
              <br />
              <strong>{spec.v030RealityTitle}</strong>：{spec.v030RealityDesc}
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 生产安全升级处方</span>
              <span className="wiki-edu-badge is-good">一次改到位</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.prescriptionTitle}</strong>
              <br />
              {spec.prescriptionDesc}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
