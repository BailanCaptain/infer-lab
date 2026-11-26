import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const ONBOARDING_FOUR_GATES_APPROVED_SHA256 =
  "ed0f441f8bc4796d9f245137273ed035a5bb45ecb8cc8e47a5cb075fea2f3594";

export type OnboardingGateStep = 1 | 2 | 3 | 4;
export type OnboardingDiagramMode = "sandbox" | "svg";

export interface OnboardingGateSpec {
  readonly step: OnboardingGateStep;
  readonly shortBtn: string;
  readonly stationTitle: string;
  readonly stationSub: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly inspectFile: string;
  readonly passSignal: string;
  readonly pitfallWhere: string;
  readonly riskBadge: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detail: string;
}

export const ONBOARDING_GATES: readonly OnboardingGateSpec[] = [
  {
    step: 1,
    shortBtn: "① 五维版本锁死",
    stationTitle: "① 五维版本锁死",
    stationSub: "锁软件与卡型",
    badgeText: "第一关 / 4 · 五维版本与硬件卡型锁死",
    takeawayTone: "warn",
    inspectFile: "设备状态查询命令与官方版本配套表",
    passSignal: "框架、插件、计算栈、扩展与卡型五维严丝合缝",
    pitfallWhere: "默认预编译包仅面向 A2；在 A3/310P/950 上混装会启动即报错",
    riskBadge: "启动硬校验",
    takeaway:
      "先对齐推理框架、昇腾插件、底层计算栈、张量扩展与硬件卡型五条线；卡型与安装包不一致会在读权重前直接中止启动！",
    kpi: "五维锁齐：v0.30.0 + CANN 9.2.1 + 四族卡型",
    detail:
      "v0.30.0 主基线锁定 vllm@ced6857a、vllm-ascend@c09d3e20、CANN 9.2.1、torch 2.10.0 + torch-npu 2.10.0.post7 及 triton-ascend 3.6.0.post2（310P 不支持 triton）。构建期将目标卡型写入 _build_info.py 的 __device_type__（标准 pip wheel 仅面向 A2）；NPUWorker.__init__ 调用 check_ascend_device_type() 比对 torch_npu.npu.get_soc_version()，不匹配即抛 RuntimeError。A3 注意双裸片 16 逻辑设备号，310P 使用专用 NPUWorker310。",
  },
  {
    step: 2,
    shortBtn: "② 支持矩阵与食谱",
    stationTitle: "② 支持矩阵食谱",
    stationSub: "筛 25 篇活跃",
    badgeText: "第二关 / 4 · 支持矩阵核查与活跃食谱识别",
    takeawayTone: "warn",
    inspectFile: "官方模型支持状态表与模型教程目录",
    passSignal: "命中 25 篇活跃食谱 · 确认可用标准镜像或指定专属镜像",
    pitfallWhere: "剔除 27 篇 3 行停服桩与同页已停服旧型号；勿拿标准镜像硬跑专属分支模型",
    riskBadge: "去伪存真",
    takeaway:
      "先查支持状态表，再从 52 篇模型教程中筛出 25 篇活跃食谱（剔除 27 篇停服桩，注意同文件内 GLM-5 已停服而 GLM-5.1 活跃，并分清 20 篇标准镜像与 5 篇专属镜像）！",
    kpi: "52 篇 = 25 活跃(20标准+5专属) + 27 停服桩",
    detail:
      "supported_models.md 以 ✅/🔵/🟡/🔴/❌ 标注成熟度；docs/source/tutorials/models/ 共 52 篇文档，其中 27 篇为仅 3 行的停服桩（Discontinued stub），仅 25 篇为活跃食谱（20 篇可直接跑 v0.30.0 标准镜像，5 篇如 Qwen3.8-2.4T、Hy4-preview、Dots3-Note 等需专属镜像或 nightly-main）。特别注意 GLM5.md 第 11 行声明 GLM-5 已停服（🔴），第 13 行起介绍的 GLM-5.1 才在 v0.30.0 正式支持（✅）。",
  },
  {
    step: 3,
    shortBtn: "③ 模型代码寻路",
    stationTitle: "③ 模型代码寻路",
    stationSub: "注册表与回退",
    badgeText: "第三关 / 4 · 统一注册表覆盖优先级与回退解析",
    takeawayTone: "accent",
    inspectFile: "模型目录中的结构与架构声明文件",
    passSignal: "统一注册表精确命中（昇腾专有与同名覆写优先，其余走上游内置）或回退后端",
    pitfallWhere: "含自定义建模脚本须开远程代码信任；兼容改名变体可运行时覆盖架构名",
    riskBadge: "覆写优先级",
    takeaway:
      "插件加载期已将 29 项昇腾模型注册进统一注册表并直接覆盖同名上游类：启动时先查「统一注册表（昇腾专有/覆写优先，其余命中上游内置）」，未注册再走「Transformers 自动回退」！",
    kpi: "统一注册表（昇腾覆写优先 + 上游内置）→ 回退后端",
    detail:
      "插件发现阶段 setup.py 经 ascend_model = vllm_ascend:register_model 向统一 ModelRegistry 注册 29 个架构名，其中同名条目（如 Qwen3_5ForConditionalGeneration、Qwen3_5MoeForConditionalGeneration）直接覆盖上游实现以改用 NPU 图像预处理；无同名覆写的架构（如 Qwen3ForCausalLM、Qwen3MoeForCausalLM）保留上游 _TEXT_GENERATION_MODELS 内置类。启动读取 config.json 的 architectures（支持 --hf-overrides 内存覆盖）后，ModelRegistry.resolve_model_cls 先查合并后的统一注册表，未命中且处于常规生成路径时经 _try_resolve_transformers 回退（带 auto_map 须加 --trust-remote-code）。",
  },
  {
    step: 4,
    shortBtn: "④ 权重选型与转换",
    stationTitle: "④ 权重选型转换",
    stationSub: "防翻倍·跑冒烟",
    badgeText: "第四关 / 4 · 权重代际转换与双接口冒烟通关",
    takeawayTone: "danger",
    inspectFile: "目录内量化描述与模型配置文件（通关后执行双接口冒烟）",
    passSignal: "挑对代际精度（950 转微缩放 / 310P 用半精度）· 模型列表与贪心 5 词冒烟全通",
    pitfallWhere: "高危：分块 FP8 在 A2/A3 静默展开为 2 字节脑浮点致显存翻倍；310P 禁脑浮点与扩展图",
    riskBadge: "显存翻倍坑",
    takeaway:
      "原生分块 8 位浮点权重仅在昇腾 950 重组为约 1 字节微缩放格式，在 A2/A3 上会静默反量化回 2 字节脑浮点令权重显存翻倍；四关核准拉起服务后，跑通模型列表与温度 0 贪心冒烟即告通关！",
    kpi: "四级探测 · 防 A2/A3 2×膨胀 · 双接口冒烟收尾",
    detail:
      "maybe_auto_detect_quantization() 依次探测：① quant_model_description.json → 'ascend'（建议显式传 --quantization ascend）；② config.json 中 compressed-tensors（勿加 ascend）；③ 分块 fp8（须带 weight_block_size + dynamic：is_950() 在 fp8_block.py 重组为 MXFP8，排除吸收的 kv_b_proj 与 K%32!=0 层；A2/A3 在 v0.30.0 经 resolve_block_scales 静默回退 model_dtype 翻倍，main 抛 NotImplementedError；310P COMPATIBILITY 后端不注册 AscendFp8Config）；④ 浮点（310P 必传 --dtype float16、FULL_DECODE_ONLY 限 [1,2,4,8] 且设 enable_npugraph_ex:false）。收尾冒烟：日志出现 Application startup complete. 后，用 curl 核验 GET /v1/models 与 POST /v1/completions（temperature: 0, max_tokens: 5；受限网络可设 VLLM_USE_MODELSCOPE=True）。",
  },
];

export interface ModelOnboardingGatesInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: OnboardingDiagramMode | undefined;
  readonly initialStep?: OnboardingGateStep | undefined;
}

export function ModelOnboardingGatesInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: ModelOnboardingGatesInteractiveProps) {
  const [mode, setMode] = useState<OnboardingDiagramMode>(initialMode);
  const [step, setStep] = useState<OnboardingGateStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = ONBOARDING_GATES[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-ob-teal`;
  const mRed = `${id}-${uid}-ob-red`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 4) {
          setPlaying(false);
          return 4;
        }
        const next = (prev + 1) as OnboardingGateStep;
        if (next >= 4) setPlaying(false);
        return next;
      });
    }, 1900);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: OnboardingGateStep) => {
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
        selectStep(Math.min(4, step + 1) as OnboardingGateStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as OnboardingGateStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as OnboardingGateStep);
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
      kickerTag="母版 A · 四关上线门禁"
      kickerTitle="昇腾新模型上线四道关（v0.30.0 标准流水线）"
      question="拿到一个 HuggingFace 新模型目录，到底按哪几步确认能不能在昇腾上顺利跑起来？"
      toolbarLabel="新模型上线四道关通关控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step, "data-playing": playing ? "true" : "false" }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="onboarding-autoplay"
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
              onClick={() => selectStep(Math.max(1, step - 1) as OnboardingGateStep)}
            >
              ‹ 上一关
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 4}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as OnboardingGateStep)}
            >
              下一关 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="新模型上线四道关卡">
            {ONBOARDING_GATES.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`onboarding-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（五维版本与芯片校验 / 52 篇食谱去伪存真 / 统一注册表与回退解析 / 分块 FP8 代际分叉与冒烟命令）"
      detailsContent={
        <>
          <strong>{spec.badgeText}</strong>：{spec.detail}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">新模型四道准入流水线与阻断分流拓扑</span>
            <span className={`wiki-edu-badge ${spec.takeawayTone === "danger" ? "is-bad" : "is-good"}`}>
              {spec.riskBadge}
            </span>
          </div>
          <svg
            viewBox="0 0 840 176"
            width="840"
            height="176"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`新模型上线第 ${step} 关流水线拓扑`}
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
            </defs>
            {ONBOARDING_GATES.map((g, idx) => {
              const gx = 16 + idx * 208;
              const active = g.step === step;
              const passed = g.step < step;
              return (
                <g key={`ob-svg-${g.step}`}>
                  <rect
                    x={gx}
                    y="14"
                    width="184"
                    height="96"
                    rx="9"
                    fill={active ? "#ddf4ef" : passed ? "#fbfaf6" : "#ece9df"}
                    stroke={active ? "#087f73" : "#d8d8cf"}
                    strokeWidth={active ? "2.1" : "1.3"}
                  />
                  <text x={gx + 92} y="42" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17211f">
                    {`第 ${g.step} 关`}
                  </text>
                  <text x={gx + 92} y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
                    {["环境对齐", "活跃食谱", "类名覆写", "量化冒烟"][idx]}
                  </text>
                  <text x={gx + 92} y="94" textAnchor="middle" fontSize="12" fill="#66716d">
                    {passed ? "✓ 已核验" : active ? "● 当前核验" : "待进入"}
                  </text>
                  {idx < 3 && (
                    <line
                      x1={gx + 186}
                      y1="62"
                      x2={gx + 204}
                      y2="62"
                      stroke="#087f73"
                      strokeWidth="1.8"
                      markerEnd={`url(#${mTeal})`}
                    />
                  )}
                  {active && (
                    <>
                      <line
                        x1={gx + 92}
                        y1="112"
                        x2={gx + 92}
                        y2="132"
                        stroke="#b54237"
                        strokeWidth="1.6"
                        markerEnd={`url(#${mRed})`}
                      />
                      <rect
                        x={gx + 12}
                        y="136"
                        width="160"
                        height="28"
                        rx="6"
                        fill="#fff0e9"
                        stroke="#b54237"
                      />
                      <text
                        x={gx + 92}
                        y="155"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="700"
                        fill="#b54237"
                      >
                        {["拒非匹配芯片", "拒停服旧桩", "覆写上游同名", "分清A2与950"][idx]}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="wiki-edu-gates-rail">
          {ONBOARDING_GATES.map((item) => {
            const cls =
              item.step < step
                ? "is-pass"
                : item.step === step
                  ? item.takeawayTone === "danger"
                    ? "is-fault"
                    : "is-warn"
                  : "is-skip";
            return (
              <div key={item.step} className={`wiki-edu-station ${cls}`}>
                <strong>{item.stationTitle}</strong>
                <span>{item.stationSub}</span>
              </div>
            );
          })}
        </div>

        <div className="wiki-edu-gates-cards">
          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 看哪个入口 / 配置</span>
              <span className="wiki-edu-badge is-mid">核对点</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.inspectFile}</strong>
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 过关绿灯信号</span>
              <span className="wiki-edu-badge is-good">准予放行</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.passSignal}</strong>
            </div>
          </div>

          <div className={`wiki-edu-panel${spec.takeawayTone === "danger" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">③ 卡壳去哪查</span>
              <span className={`wiki-edu-badge ${spec.takeawayTone === "danger" ? "is-bad" : "is-warn"}`}>
                {spec.riskBadge}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.pitfallWhere}</strong>
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
