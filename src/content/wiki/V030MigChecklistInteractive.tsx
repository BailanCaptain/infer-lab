import { type KeyboardEvent, useEffect, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const V030_MIG_CHECKLIST_APPROVED_SHA256 =
  "0668db8ca3208c30576358a4f0dfe64ee648875641275226fb3ad3fdc10cebdc";
export const V030_MIG_FIG_CHECKLIST_APPROVED_SHA256 = V030_MIG_CHECKLIST_APPROVED_SHA256;

export type V030MigStep = 1 | 2 | 3 | 4 | 5;
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
  readonly riskBadge: string;
  readonly oldCardTag: string;
  readonly v030CardTag: string;
  readonly fixCardTag: string;
  readonly detail: string;
}

export const V030_MIG_GATES: readonly V030MigGateSpec[] = [
  {
    step: 1,
    shortBtn: "① 旧环境变量收口",
    stationTitle: "① 旧环境变量",
    stationSub: "移出注册表",
    badgeText: "关卡 1 / 5 · 退役变量与序列并行兜底",
    takeawayTone: "danger",
    title: "关卡 ① · 4 个旧环境变量失效（3 个 VLLM_ 前缀报未知告警、MSMONITOR 静默）与 FLASHCOMM1 兜底",
    takeaway:
      "3 个 VLLM_ASCEND_* 旧变量已不再生效（触发未知变量告警，严格模式下直接抛错），MSMONITOR 则完全静默失效；FLASHCOMM1 仅剩过渡兜底，请统一迁入 JSON！",
    kpi: "旧 env 失效/仅兜底 → 迁 JSON",
    riskBadge: "配置收口",
    oldCardTag: "继续 export 5 个旧变量",
    v030CardTag: "3项告警失效·1项静默·1项兜底",
    fixCardTag: "全迁 additional_config",
    detail:
      "v0.30.0 从 vllm_ascend/envs.py 移除了 5 个旧变量：① VLLM_ASCEND_ENABLE_NZ / MLAPO / FUSED_MC2 因带 VLLM_ 前缀会被上游 vllm/envs.py:2242 打 Unknown vLLM environment variable detected 警告（严格模式下抛 ValueError）且不再产生昇腾效果，须改用 weight_nz_mode（默认1，RL置0）、enable_mlapo（默认true）、enable_fused_mc2（默认0）；② 非 VLLM_ 前缀的 MSMONITOR_USE_DAEMON 完全静默失效，改用 msmonitor_use_daemon；③ VLLM_ASCEND_ENABLE_FLASHCOMM1 在 ascend_config.py 暂留 os.getenv 兜底（迁 enable_flashcomm1），在 main（ascend_config.py:873-884）仅当有效 MoE SP 与 quantized_all_reduce_config 同时开启时才打印告警并自动关闭量化 All-Reduce。",
  },
  {
    step: 2,
    shortBtn: "② 混合量化名退场",
    stationTitle: "② 混合量化",
    stationSub: "删 MoE 注册",
    badgeText: "关卡 2 / 5 · MoE 量化路径退场",
    takeawayTone: "danger",
    title: "关卡 ② · W8A8_PDMIX 命名与 W8A8_MIX 的 MoE 专家注册彻底移除",
    takeaway:
      "以前给混合专家标 W8A8_MIX 只是打弃用警告，升到 v0.30.0 正式版后专家层的该注册已被彻底删除，仅保留线性层！",
    kpi: "MoE 禁标 W8A8_MIX → 改 DYNAMIC",
    riskBadge: "注册移除",
    oldCardTag: "MoE 标 W8A8_MIX",
    v030CardTag: "仅保留 linear 线性层",
    fixCardTag: "MoE 改用 W8A8_DYNAMIC",
    detail:
      "w8a8_pdmix.py 实际注册键名为 W8A8_MIX（非文件名 PDMIX）：v0.26.0rc 起对 moe 打印弃用告警，v0.30.0（w8a8_pdmix.py#L35-L50）仅保留 @register_scheme('W8A8_MIX', 'linear')（AscendW8A8PDMixLinearMethod），MoE 专家须统一迁移至 W8A8_DYNAMIC。",
  },
  {
    step: 3,
    shortBtn: "③ 默认水位与档案",
    stationTitle: "③ 水位与档案",
    stationSub: "默认 0.92!",
    badgeText: "关卡 3 / 5 · 录图留白缩窄 2%",
    takeawayTone: "warn",
    title: "关卡 ③ · 源码默认显存比例是 0.92（非旧 FAQ 0.90）与 HardwareProfile 四家族重构",
    takeaway:
      "不传显存比例参数时源码默认按 0.92 切预算，64G 卡预算外留白缩至 5.12 GiB；芯片判断同步收拢为四家族能力档案！",
    kpi: "默认 u=0.92 → 建议显式传 0.90",
    riskBadge: "留白缩窄",
    oldCardTag: "误信默认 0.90 留白",
    v030CardTag: "默认 0.92 + 四家族档案",
    fixCardTag: "显式设 u≤0.90·查能力契约",
    detail:
      "上游 CacheConfig.gpu_memory_utilization 真实默认为 0.92（faqs.md#L146-L150 残留 0.9 旧说明；910B3 真机可见 60.96G 下 0.6B 在 u=0.90 仍触发 FIA 录图 OOM，建议生产显式传 0.90 或更低）。v0.30.0 新增 hardware_profile.py 建立 A2 / A3 / _310P / A5 四家族不可变档案（v0.30.0 的 A5 暂不含 RUNTIME_CUSTOM_OPS，main 已补回）。",
  },
  {
    step: 4,
    shortBtn: "④ 分块FP8回退翻倍",
    stationTitle: "④ 分块 FP8",
    stationSub: "A2/A3 翻倍",
    badgeText: "关卡 4 / 5 · 静默回退浮点显存翻倍",
    takeawayTone: "danger",
    title: "关卡 ④ · 原生分块 FP8 权重在 A2/A3 静默回退 model_dtype（显存翻倍）",
    takeaway:
      "在 A2/A3 上拉起开源分块 FP8 权重能跑通，但底层悄悄反量化回模型浮点类型（2 字节），既无低比特加速又让权重显存翻倍！",
    kpi: "A2/A3 回退浮点翻倍 · main 直拒",
    riskBadge: "显存翻倍",
    oldCardTag: "A2/A3 直载分块 FP8",
    v030CardTag: "回退 model_dtype 翻倍",
    fixCardTag: "换重定量 W8A8 或原浮点",
    detail:
      "fp8_block.py#L17-L30 对分块 float8_e4m3fn + weight_scale_inv 权重：仅昇腾 950（A5）对合规层重定量为 1 字节 MXFP8（32 元素共享 E8M0 scale），Atlas A2/A3 全部反量化回退至 model_dtype（通常为 BF16/FP16，2B/元素）走普通 GEMM，权重驻留翻倍挤占 KV 池；main（fp8_block.py#L114-L130）通过 _require_fp8_weight_matmul() 在 A2/A3 直接抛 NotImplementedError。",
  },
  {
    step: 5,
    shortBtn: "⑤ MRV2切换红线",
    stationTitle: "⑤ 执行器代际",
    stationSub: "默认仍 V1",
    badgeText: "关卡 5 / 5 · 执行器代际交接",
    takeawayTone: "accent",
    title: "关卡 ⑤ · v0.30.0 默认仍为 MRV1（特定特性强制 V2），main 彻底删除 V1",
    takeaway:
      "v0.30.0 正式版默认仍走一代执行器，开启长文并行或新版负载均衡时须显式开二代；脚本里务必清光 =0 硬锁备战新主线！",
    kpi: "v0.30 默认 V1 · 清理 =0 备战 main",
    riskBadge: "代际红线",
    oldCardTag: "误认已切 V2 或硬写 =0",
    v030CardTag: "默认 V1·五类特性强制 V2",
    fixCardTag: "按需设 =1 并清光 =0",
    detail:
      "v0.30.0 的 patch_use_v2_model_runner.py 未设环境变量时默认返回 False（MRV1），开启 PCP、DeepSeek V4.1（A5）、--enable-return-routed-experts、CPP+async_scheduling 或 V2 EPLB 时须显式导出 VLLM_USE_V2_MODEL_RUNNER=1；main（mrv2_utils.py#L29-L89）已删除 MRV1，残留 =0 直接抛 ValueError。",
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

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        const next = (prev + 1) as V030MigStep;
        if (next >= 5) setPlaying(false);
        return next;
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
        selectStep(Math.min(5, step + 1) as V030MigStep);
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
      kickerTitle="v0.30.0 正式版五关升级避坑筛查"
      question="把 v0.26 / rc2 的老启动脚本直接搬到 v0.30.0，哪几处会踩中隐蔽变更？"
      toolbarLabel="v0.30.0 升级五关筛查控制"
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
              style={eduBtnStyle(playing, "dark")}
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
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as V030MigStep)}
            >
              下一关 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="v0.30.0 五项核心升级关卡">
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
      detailsSummary="查看工程与源码细节（vllm/envs.py 未知告警区别 / FP8 回退 model_dtype / main 演进门控）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-chunks-wrap">
          {V030_MIG_GATES.map((item) => {
            const cls = item.step < step ? "is-pass" : item.step === step ? "is-fault" : "is-skip";
            return (
              <div key={item.step} className={`wiki-edu-station ${cls}`} style={{ flex: "1 1 132px" }}>
                <strong>{item.stationTitle}</strong>
                <span>{item.stationSub}</span>
              </div>
            );
          })}
        </div>

        <div className="wiki-edu-chunks-wrap">
          <div className="wiki-edu-panel is-oom" style={{ flex: "1 1 220px" }}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 旧版习惯</span>
              <span className="wiki-edu-badge is-bad">{spec.riskBadge}</span>
            </div>
            <div className="wiki-edu-tok-pill is-cow">
              <span>历史配置</span>
              <span className="wiki-edu-ptr-tag">{spec.oldCardTag}</span>
            </div>
          </div>

          <div className="wiki-edu-panel" style={{ flex: "1 1 220px" }}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② v0.30.0 行为</span>
              <span className="wiki-edu-badge is-warn">真实机制</span>
            </div>
            <div className="wiki-edu-tok-pill is-sys">
              <span>当前基线</span>
              <span className="wiki-edu-ptr-tag">{spec.v030CardTag}</span>
            </div>
          </div>

          <div className="wiki-edu-panel" style={{ flex: "1 1 220px" }}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">③ 安全处方</span>
              <span className="wiki-edu-badge is-good">兼容新主线</span>
            </div>
            <div className="wiki-edu-tok-pill is-priv">
              <span>标准写法</span>
              <span className="wiki-edu-ptr-tag">{spec.fixCardTag}</span>
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
