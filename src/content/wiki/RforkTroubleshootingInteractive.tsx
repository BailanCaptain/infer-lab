import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const RFORK_TROUBLESHOOTING_APPROVED_SHA256 =
  "3b8789468051c0f85fa6823ab51cd55d5946ec2f4a33c2ded20ce294719f9616";

export type RforkDiagStep = 1 | 2 | 3 | 4 | 5;
export type RforkDiagMode = "sandbox" | "svg";

export interface RforkDiagSpec {
  readonly step: RforkDiagStep;
  readonly shortBtn: string;
  readonly stageTag: string;
  readonly stationTitle: string;
  readonly stationSub: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly logHeadline: string;
  readonly stateVerdict: string;
  readonly firstEvidenceTitle: string;
  readonly firstEvidenceList: string;
  readonly visualMode: "abort-0" | "reg-fail-1" | "miss-2" | "chunk-7-of-12" | "ttl-ruler";
  readonly detail: string;
}

export const RFORK_DIAG_STEPS: readonly RforkDiagSpec[] = [
  {
    step: 1,
    shortBtn: "① 配置错直停",
    stageTag: "阶段 0 · 配置解析",
    stationTitle: "0. 配置校验",
    stationSub: "直停不回退",
    badgeText: "分诊 1 / 5 · 缺必填直接中止",
    takeawayTone: "danger",
    title: "阶段 0 · 缺三项必填配置或严格项非法：直接抛异常中止启动（不打汇总、不走回退）",
    takeaway:
      "连配置都没写对时绝不会静默退回读盘：进程当场抛配置异常退场，日志里根本不会出现那句“传输失败回退”汇总！",
    kpi: "进程直接中止 · 不打回退汇总",
    logHeadline: "表象：进程启动即退出，无 transfer failed 汇总警告",
    stateVerdict: "真实状态：阶段 0 被硬拦截，尚未建模型骨架、未碰显存登记与租约。",
    firstEvidenceTitle: "30 秒首取证据",
    firstEvidenceList:
      "核对两端完整启动参数（脱敏凭据）、三项必填项是否齐全、是否开了睡眠/动态均衡触发整体绕开警告。",
    visualMode: "abort-0",
    detail:
      "缺少三项必填配置或严格参数非法时抛出 RForkConfigurationError，由 rfork_loader.py#L889-L892 直接重抛中止启动（未知配置键打 warning）；若开启 sleep mode、在线权重传输或 --enable-eplb，则命中 safety.py 整体绕开并打 RFork transfer is disabled when ... is enabled 警告。",
  },
  {
    step: 2,
    shortBtn: "② 借前登记失败",
    stageTag: "阶段 1 · 显存预登记",
    stationTitle: "1. 登记显存",
    stationSub: "reg failed.",
    badgeText: "分诊 2 / 5 · 借租约前登记报错",
    takeawayTone: "warn",
    title: "阶段 1 · 借租约前登记目的显存失败：汇总明确写 destination registration failed.",
    takeaway:
      "还没向调度器开口借权重就挂了：看一眼汇总原因栏写的是 registration failed，直接查传输引擎版本接口与张量覆盖！",
    kpi: "原因栏：destination registration failed.",
    logHeadline: "表象：汇总原因明确写 destination registration failed.（非 transfer failed.）",
    stateVerdict:
      "真实状态：挂在借租约之前（0 份租约、0 字节远端写入）；注意若回滚未完，原始报错在更前一行！",
    firstEvidenceTitle: "30 秒首取证据",
    firstEvidenceList:
      "查数据系统版本是否支持带显存登记对象的批量接口、报错批次段数与返回码、NPU 分配器张量覆盖范围。",
    visualMode: "reg-fail-1",
    detail:
      "session.register_destination 返回 False 时抛出 RuntimeError('destination registration failed.')（rfork_loader.py#L835-L836），具体错误在 transfer_backend.py#L416-L531（缺 batch_register_memory_ex 接口、张量区间未覆盖或返回错误码）。若紧挨汇总的是 rollback is incomplete，须再往前翻找首条登记报错。",
  },
  {
    step: 3,
    shortBtn: "③ 没借到静默读盘",
    stageTag: "阶段 2 · 申请来源",
    stationTitle: "2. 找调度器借",
    stationSub: "仅 TP0 打 INFO",
    badgeText: "分诊 3 / 5 · 区分冷启动与请求异常",
    takeawayTone: "default",
    title: "阶段 2 · 没有可用来源：不打失败汇总直接读盘，必查是否藏着申请失败告警",
    takeaway:
      "日志静悄悄改读硬盘了？别急着当成首台冷启动——先往前看有没有“申请来源失败”告警，且默认只有 TP0 卡会打 INFO！",
    kpi: "不打失败汇总 · 非 TP0 需开 DEBUG",
    logHeadline: "表象：仅 TP0 打印未借到转本地加载，其余卡在 INFO 下完全静默",
    stateVerdict:
      "真实状态：Planner 回 404、网络不通、状态码非 200 或租约响应头非法，全都会被折算成“没借到”。",
    firstEvidenceTitle: "30 秒首取证据",
    firstEvidenceList:
      "开 VLLM_LOGGING_LEVEL=DEBUG 看全卡日志，往前搜 acquisition failed 警告，核对两端 seed_key 与结构摘要。",
    visualMode: "miss-2",
    detail:
      "planner_client.py#L137-L205 把 404（仅记 debug）、请求异常、非 200 及响应头端口/rank/LEASE_TTL_SEC 非法统一折成 None 走本地加载（仅 tp_rank == 0 按 INFO 打 seed acquisition was unsuccessful，16 卡 TP8 下仅 rank 0 与 rank 8 可见），绝不可修改配对键算法强凑命中。",
  },
  {
    step: 4,
    shortBtn: "④ 借后三步同汇总",
    stageTag: "阶段 3–5 · 取单/核单/分批读",
    stationTitle: "3–5. 借后传输",
    stationSub: "同打 transfer failed",
    badgeText: "分诊 4 / 5 · 揪同卡首错与脏显存剖面",
    takeawayTone: "danger",
    title: "阶段 3–5 · 取清单、五门核对、分批读失败共用同一句 transfer failed. 汇总",
    takeaway:
      "三步报错最后汇总一字不差！必须往前揪出同一个 rank 的第一条 error；若死在第 7/12 批，前 6 批已写进显存必须清零！",
    kpi: "三步同汇总 → 必查同 rank 首条 error",
    logHeadline: "表象：汇总只写 transfer failed.；前序紧跟元数据非 200、五门差集或 chunk 7/12 失败",
    stateVerdict:
      "真实状态：死在五门核对则写入 0 字节；死在第 7/12 批则批 1–6 已写入、批 7 未知，回退须过双安全门清扫！",
    firstEvidenceTitle: "30 秒首取证据",
    firstEvidenceList:
      "按 rank 过滤揪第一条 error：元数据查 HTTP 端口与协议版本 1；五门比对名字/dtype/NZ 格式；读失败抓 chunk k/N 与数据面端点。",
    visualMode: "chunk-7-of-12",
    detail:
      "session.transfer_from_seed 三步（/get_rfork_transfer_engine_info 取协议版本 1 + 五元组清单 + NPU 格式表 → validate_weight_manifest 五门核对并排除 3 个运行期张量 → ≤1GiB/512段 batch_transfer_sync_read）返回 False 均抛同一句 RuntimeError('transfer failed.')；回退须通过 service_stopped && memory_reset 双门，否则抛 RuntimeError 拒绝分配第二份模型。",
  },
  {
    step: 5,
    shortBtn: "⑤ 归还 404/400 判据",
    stageTag: "阶段 6–8 · 还租约与 TTL 标尺",
    stationTitle: "6–8. 归还发布",
    stationSub: "48.2s vs 75.6s",
    badgeText: "分诊 5 / 5 · 持租时长对照 60s TTL",
    takeawayTone: "accent",
    title: "阶段 6–8 · 读完还租约收 404 或 400：模型照常服务，用 held_elapsed 对照 60s TTL 断案",
    takeaway:
      "权重读完后还租约告警不影响对外推理（只放弃当新源）！48.2s 收到 404 铁定没过期，示例调度器回 400 只怪请求头格式错！",
    kpi: "48.2s<60s 排除过期 · 400=请求头解析错",
    logHeadline: "表象：数据已读完，后台归还租约收到 HTTP 404（记 RELEASED）或 400（记 REJECTED 停试）",
    stateVerdict:
      "真实状态：推理服务 100% 正常可用，仅取消登记为新 Seed；404 不等于按时还上，400 在示例调度器与过期无关！",
    firstEvidenceTitle: "30 秒首取证据",
    firstEvidenceList:
      "提取客户端 held_elapsed 与尝试次数对照 TTL（默认 60s），保留 lease= 哈希摘要与 400 响应体核对服务端记录。",
    visualMode: "ttl-ruler",
    detail:
      "示例 Planner（DEFAULT_LEASE_TTL_SEC=60）发出租约才开始计时，真实年龄必短于客户端 held_elapsed：若 held_elapsed=48.2s < 60s 却收 404，铁定排除到期（转查前次超时重发已删、身份不符、Planner 重启或多副本分裂）；若 75.6s ≥ 60s，到期收回才列为候选。示例 Planner 仅在请求头缺项/非整数/越界时回 400（现场自定义实现需另核响应体）。",
  },
];
export interface RforkTroubleshootingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RforkDiagMode | undefined;
  readonly initialStep?: RforkDiagStep | undefined;
}

export function RforkTroubleshootingInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialStep = 1,
}: RforkTroubleshootingInteractiveProps) {
  const [mode, setMode] = useState<RforkDiagMode>(initialMode);
  const [step, setStep] = useState<RforkDiagStep>(initialStep);
  const [playing, setPlaying] = useState(false);
  const spec = RFORK_DIAG_STEPS[step - 1]!;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mRed = `${id}-${uid}-rft-red`;
  const mTeal = `${id}-${uid}-rft-teal`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        return (prev + 1) as RforkDiagStep;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: RforkDiagStep) => {
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
        selectStep(Math.min(5, step + 1) as RforkDiagStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as RforkDiagStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectStep(Number(event.key) as RforkDiagStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const stageCenterX = 86 + (step - 1) * 172;

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
      kickerTag="母版 A · 首错证据分诊"
      kickerTitle="RFork 30 秒首错定位与 404 / 400 判据"
      question="日志最后只写一句“transfer failed 回退默认加载”，怎么 30 秒揪出真凶？"
      toolbarLabel="RFork 五阶段首错分诊控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{ "data-step": step }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "accent")}
              onClick={toggleAutoPlay}
            >
              {playing ? "⏸ 暂停分诊" : "▶ 自动分诊"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step <= 1}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as RforkDiagStep)}
            >
              ‹ 上一类
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              disabled={step >= 5}
              style={eduBtnStyle(false)}
              onClick={() => selectStep(Math.min(5, step + 1) as RforkDiagStep)}
            >
              下一类 ›
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="RFork 五类异常现场分诊">
            {RFORK_DIAG_STEPS.map((item) => {
              const active = mode === "sandbox" && step === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`rfork-diag-step-${item.step}`}
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
      detailsSummary="查看工程与源码细节（main 8d6180e2 日志原文表 / held_elapsed 60s TTL 推导 / GLM 32 份租约规则）"
      detailsContent={
        <>
          <strong>{spec.title}</strong>：{spec.detail}
        </>
      }
    >
      <div>
        <div className="wiki-edu-chunks-wrap" style={{ marginBottom: "8px" }}>
          {RFORK_DIAG_STEPS.map((item) => {
            const cls =
              item.step < step
                ? "is-pass"
                : item.step === step
                  ? item.step === 5
                    ? "is-warn"
                    : "is-fault"
                  : "is-skip";
            return (
              <div key={item.step} className={`wiki-edu-station ${cls}`} style={{ flex: "1 1 136px" }}>
                <strong>{item.stationTitle}</strong>
                <span>{item.stationSub}</span>
              </div>
            );
          })}
        </div>

        <svg
          viewBox="0 0 860 88"
          width="860"
          height="88"
          style={{ width: "100%", height: "auto", display: "block", marginBottom: "10px" }}
          role="img"
          aria-label={`RFork 排错剖面：${spec.stageTag}`}
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

          {spec.visualMode === "chunk-7-of-12" ? (
            <g>
              <rect x="14" y="10" width="832" height="68" rx="8" fill="#fbfaf6" stroke="#d8d8cf" />
              <text x="28" y="30" fontSize="12.5" fontWeight="700" fill="#17211f">
                第 7 / 12 批读断连时 B 显存剖面（回退前必须清零脏数据）
              </text>
              <rect x="28" y="40" width="380" height="26" rx="4" fill="#c78300" />
              <text x="218" y="58" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                批 1–6：已写进显存
              </text>
              <rect
                x="414"
                y="40"
                width="96"
                height="26"
                rx="4"
                fill="#fff0e9"
                stroke="#b54237"
                strokeDasharray="4 3"
              />
              <text x="462" y="58" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
                批 7 未知!
              </text>
              <rect x="516" y="40" width="316" height="26" rx="4" fill="#ece9df" stroke="#d8d8cf" />
              <text x="674" y="58" textAnchor="middle" fontSize="12" fill="#66716d">
                批 8–12：尚未执行
              </text>
            </g>
          ) : spec.visualMode === "ttl-ruler" ? (
            <g>
              <rect x="14" y="8" width="832" height="72" rx="8" fill="#fbfaf6" stroke="#d8d8cf" />
              <line
                x1="590"
                y1="12"
                x2="590"
                y2="76"
                stroke="#b54237"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <text x="590" y="24" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
                60s 默认 TTL 线
              </text>
              <rect x="28" y="30" width="440" height="20" rx="4" fill="#ddf4ef" stroke="#087f73" />
              <text x="248" y="44" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
                48.2s &lt; 60s：铁定排除过期!
              </text>
              <rect x="28" y="54" width="690" height="20" rx="4" fill="#fff4cf" stroke="#c78300" />
              <text x="373" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                75.6s ≥ 60s：过期列为候选，核对服务端记录
              </text>
            </g>
          ) : (
            <g>
              <path
                className="wiki-edu-wire is-flow"
                d={`M ${stageCenterX} 6 L ${stageCenterX} 44 L 430 44 L 430 76`}
                stroke={step === 3 ? "#087f73" : "#b54237"}
                markerEnd={`url(#${step === 3 ? mTeal : mRed})`}
              />
              <rect
                x="280"
                y="26"
                width="300"
                height="28"
                rx="14"
                fill={step === 3 ? "#ddf4ef" : "#fff0e9"}
                stroke={step === 3 ? "#087f73" : "#b54237"}
              />
              <text x="430" y="45" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#17211f">
                {spec.stageTag}
              </text>
            </g>
          )}
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className={`wiki-edu-panel${step === 1 || step === 4 ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">① 日志表象 vs 真实阶段状态</span>
              <span className={`wiki-edu-badge ${step === 5 ? "is-good" : step === 3 ? "is-mid" : "is-bad"}`}>
                {step === 5 ? "服务照常可用" : step === 1 ? "直接中止" : "回退分支"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.logHeadline}</strong>
              <br />
              {spec.stateVerdict}
            </div>
          </div>

          <div className="wiki-edu-panel">
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">② 现场 30 秒首取证据清单</span>
              <span className="wiki-edu-badge is-warn">证据优先</span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.firstEvidenceTitle}</strong>
              <br />
              {spec.firstEvidenceList}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
