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
  readonly stationTitle: string;
  readonly stationSub: string;
  readonly badgeText: string;
  readonly takeawayTone: "default" | "accent" | "warn" | "danger";
  readonly title: string;
  readonly takeaway: string;
  readonly kpi: string;
  readonly logTag: string;
  readonly stateTag: string;
  readonly seedTag: string;
  readonly actionTag: string;
  readonly detail: string;
}

export const RFORK_DIAG_STEPS: readonly RforkDiagSpec[] = [
  {
    step: 1,
    shortBtn: "① 配置错直停",
    stationTitle: "0. 配置校验",
    stationSub: "直停不回退",
    badgeText: "分诊 1 / 5 · 缺必填直接中止",
    takeawayTone: "danger",
    title: "阶段 0 · 缺三项必填配置或严格项非法：直接抛异常中止启动（不打汇总、不走回退）",
    takeaway:
      "连必填配置都没写全时绝不会静默退回读盘：进程当场抛配置异常退场，日志里根本不会出现回退汇总；首先核对两端启动参数与绕开开关！",
    kpi: "进程直接中止 · 不打回退汇总",
    logTag: "无回退汇总",
    stateTag: "中止启动",
    seedTag: "未建会话",
    actionTag: "核必填参数",
    detail:
      "缺少三项必填配置或严格参数非法抛 RForkConfigurationError（rfork_loader.py#L889-L892 直接重抛中止启动，未知键打 warning）；若开启 sleep mode、在线权重传输或 --enable-eplb，则命中 safety.py 整体绕开并打 RFork transfer is disabled when ... is enabled 警告。",
  },
  {
    step: 2,
    shortBtn: "② 借前登记败",
    stationTitle: "1. 显存登记",
    stationSub: "借前报错",
    badgeText: "分诊 2 / 5 · 借租约前登记失败",
    takeawayTone: "warn",
    title: "阶段 1 · 借租约前登记目的显存失败：汇总原因栏明确写 destination registration failed.",
    takeaway:
      "还没向调度器借租约就挂在显存预登记：汇总原因栏明确区分于传输失败；首取传输引擎接口版本、张量覆盖区间与更前一行的原始报错！",
    kpi: "原因栏：destination registration failed.",
    logTag: "预登记失败",
    stateTag: "回退本地盘",
    seedTag: "0 租约借入",
    actionTag: "查引擎接口",
    detail:
      "session.register_destination 返回 False 时抛 RuntimeError('destination registration failed.')（rfork_loader.py#L835-L836），具体错误在 transfer_backend.py#L416-L531（缺 batch_register_memory_ex 接口、张量范围未覆盖或返回码异常）；若回滚未完打印 rollback is incomplete，原始登记报错在更前一行。",
  },
  {
    step: 3,
    shortBtn: "③ 没借到读盘",
    stationTitle: "2. 申请来源",
    stationSub: "静默读盘",
    badgeText: "分诊 3 / 5 · 区分冷启动与请求异常",
    takeawayTone: "default",
    title: "阶段 2 · 没有可用来源：不打失败汇总直接读盘，须开 DEBUG 并查申请失败告警",
    takeaway:
      "没借到来源时默认只有 TP0 卡打一条 INFO，其余卡静悄悄转读盘；务必往前查有无“申请来源失败”警告，别把网络或配对键失配误当正常冷启动！",
    kpi: "不打失败汇总 · 非 TP0 需开 DEBUG",
    logTag: "仅 TP0 提示",
    stateTag: "回退本地盘",
    seedTag: "本轮未命中",
    actionTag: "开调试核键",
    detail:
      "planner_client.py#L137-L205 把 404（仅记 debug）、请求异常、非 200 及响应头端口/rank/LEASE_TTL_SEC 非法统一折成 None 走本地加载（仅 tp_rank == 0 打 INFO，16 卡 TP8 下仅 rank 0 与 8 可见；查全卡须设 VLLM_LOGGING_LEVEL=DEBUG），严禁篡改 seed_key 算法强凑命中。",
  },
  {
    step: 4,
    shortBtn: "④ 借后同汇总",
    stationTitle: "3–5. 借后三步",
    stationSub: "同句汇总",
    badgeText: "分诊 4 / 5 · 揪同卡首错与停服注销门",
    takeawayTone: "danger",
    title: "阶段 3–5 · 取清单、五门核对、分批读失败共用同一句汇总，回退前须停服并注销已登记显存",
    takeaway:
      "借后三步失败汇总一字不差，必按同卡揪首条 error！若死在第 7/12 批（前 6 批已写），回退安全门须确认停掉种子服务且注销已登记显存，才释放旧模型重读硬盘！",
    kpi: "查同卡首错 · 停服注销后回退",
    logTag: "同句传输败",
    stateTag: "过双门回退",
    seedTag: "阻断脏复用",
    actionTag: "揪同卡首错",
    detail:
      "session.transfer_from_seed 三步（/get_rfork_transfer_engine_info 协议 1 + 五元组 + 格式表 → validate_weight_manifest 五门核对并排除 3 个运行期张量 → ≤1GiB/512段 batch_transfer_sync_read）返回 False 均抛 RuntimeError('transfer failed.')。prepare_for_fallback（session.py:446-477）检查停止种子服务与注销已登记显存（service_stopped && memory_reset）通过后才释放旧模型回退本地加载，否则保留张量所有者并抛 RuntimeError 拒绝分配第二份模型。",
  },
  {
    step: 5,
    shortBtn: "⑤ 归还404/400",
    stationTitle: "6–8. 归还租约",
    stationSub: "404 与 400",
    badgeText: "分诊 5 / 5 · 区分 404 清租与 400 禁发布",
    takeawayTone: "accent",
    title: "阶段 6–8 · 归还租约 404（清租仍可发新源）vs 400（停试并取消发布新源）与 60s TTL 标尺",
    takeaway:
      "权重读完后对外推理 100% 正常！收 404 记已归还清租约（延后新源仍可发布；默认 TTL=60s 未续租且无时钟跳变下 48.2s<60s 排除过期）；收 400 则停试并取消发布新源（示例调度器 400 仅因请求头解析错）！",
    kpi: "404 仍可发源 · 400 取消发源",
    logTag: "归还回执码",
    stateTag: "推理全正常",
    seedTag: "404发·400禁",
    actionTag: "核耗时与头",
    detail:
      "planner_client.py:228-249 与 session.py:329-392：HTTP 200/404 均记 RELEASED 清除借入租约，延后的本机新 Seed 发布仍可继续完成；HTTP 400 记 REJECTED 立即停试并取消本机新 Seed 发布（示例 Planner 中 400 仅来自请求头缺项/非整数/越界，与到期无关）。在默认 TTL=60s、未触发续租展期且期间无时钟跳变前提下，客户端 held_elapsed=48.2s < 60s 可确定排除到期清扫；75.6s ≥ 60s（或存在续租展期时按展期窗口核对）则将到期收回列为候选之一。",
  },
];

export const RFORK_POST_LEASE_FAULTS = ["engine-info", "manifest", "batch7"] as const;
export type RforkPostLeaseFault = (typeof RFORK_POST_LEASE_FAULTS)[number];

export const RFORK_RANK_VIEWS = ["tp0", "non-tp0-info", "non-tp0-debug"] as const;
export type RforkRankView = (typeof RFORK_RANK_VIEWS)[number];

export type RforkReturnCode = 404 | 400;
export type RforkHeldElapsed = 48.2 | 75.6;
export type RforkEffectiveTtl = 60 | 120;

export interface RforkDiagDerivedState {
  readonly step: RforkDiagStep;
  readonly postLeaseFault: RforkPostLeaseFault;
  readonly rankView: RforkRankView;
  readonly returnCode: RforkReturnCode;
  readonly heldSec: RforkHeldElapsed;
  readonly ttlSec: RforkEffectiveTtl;
  readonly anchorNodeIdx: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly anchorLabel: string;
  readonly rankSummaryLine: string;
  readonly isExpiredCandidate: boolean;
  readonly ttlVerdictText: string;
  readonly serviceLineOk: true;
  readonly seedPublishAllowed: boolean;
  readonly seedBranchText: string;
}

export function computeRforkDiagState(
  step: RforkDiagStep,
  postLeaseFault: RforkPostLeaseFault,
  rankView: RforkRankView,
  returnCode: RforkReturnCode,
  heldSec: RforkHeldElapsed,
  ttlSec: RforkEffectiveTtl,
): RforkDiagDerivedState {
  const anchorNodeIdx: 0 | 1 | 2 | 3 | 4 | 5 | 6 =
    step === 1
      ? 0
      : step === 2
        ? 1
        : step === 3
          ? 2
          : step === 4
            ? postLeaseFault === "engine-info"
              ? 3
              : postLeaseFault === "manifest"
                ? 4
                : 5
            : 6;

  const anchorNames = [
    "0.缺必填配置",
    "1.目的显存登记",
    "2.借租未命中",
    "3.取引擎信息",
    "4.五门清单失配",
    "5.第7/12批断连",
    "6–8.归还回执",
  ] as const;

  const rankSummaryLine =
    step === 1
      ? "全 Rank 抛配置异常退场（0 行回退汇总）"
      : step === 3
        ? rankView === "tp0"
          ? "Rank 0 (TP0) 打 1 行 INFO 读盘提示"
          : rankView === "non-tp0-info"
            ? "非 TP0 从卡 INFO 级 0 行静默转读盘!"
            : "非 TP0 开 DEBUG 才显式打印 404/键未配!"
        : step === 4
          ? "末行同句传输失败汇总 ← 往前追同 Rank 首条 error!"
          : step === 2
            ? "汇总明确标目的登记失败（借租前已停）"
            : returnCode === 404
              ? `归还收 404（持租 ${heldSec}s vs TTL ${ttlSec}s）`
              : "归还收 400（立即停试·取消本机发 Seed）";

  const isExpiredCandidate = returnCode === 404 && heldSec >= ttlSec;
  const ttlVerdictText =
    returnCode === 400
      ? "400 仅因请求头解析错 · 与 TTL 到期无关"
      : isExpiredCandidate
        ? `${heldSec}s ≥ TTL ${ttlSec}s · 列入超时回收候选`
        : `${heldSec}s < TTL ${ttlSec}s · 排除自然过期清扫`;

  const seedPublishAllowed = returnCode === 404;
  const seedBranchText = seedPublishAllowed
    ? "✓ 404 清租约 · 本机继续发布新 Seed"
    : "✗ 400 主动停试 · 取消发布新 Seed";

  return {
    step,
    postLeaseFault,
    rankView,
    returnCode,
    heldSec,
    ttlSec,
    anchorNodeIdx,
    anchorLabel: anchorNames[anchorNodeIdx]!,
    rankSummaryLine,
    isExpiredCandidate,
    ttlVerdictText,
    serviceLineOk: true,
    seedPublishAllowed,
    seedBranchText,
  };
}

export interface RforkTroubleshootingInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RforkDiagMode | undefined;
  readonly initialStep?: RforkDiagStep | undefined;
  readonly initialReturnCode?: RforkReturnCode | undefined;
  readonly initialHeldSec?: RforkHeldElapsed | undefined;
  readonly initialTtlSec?: RforkEffectiveTtl | undefined;
  readonly initialPostLeaseFault?: RforkPostLeaseFault | undefined;
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
  initialReturnCode = 404,
  initialHeldSec = 48.2,
  initialTtlSec = 60,
  initialPostLeaseFault = "batch7",
}: RforkTroubleshootingInteractiveProps) {
  const [mode, setMode] = useState<RforkDiagMode>(initialMode);
  const [step, setStep] = useState<RforkDiagStep>(initialStep);
  const [postLeaseFault, setPostLeaseFault] = useState<RforkPostLeaseFault>(initialPostLeaseFault);
  const [rankView, setRankView] = useState<RforkRankView>("tp0");
  const [returnCode, setReturnCode] = useState<RforkReturnCode>(initialReturnCode);
  const [heldSec, setHeldSec] = useState<RforkHeldElapsed>(initialHeldSec);
  const [ttlSec, setTtlSec] = useState<RforkEffectiveTtl>(initialTtlSec);
  const [playing, setPlaying] = useState(false);

  const spec = RFORK_DIAG_STEPS[step - 1]!;
  const diag = computeRforkDiagState(step, postLeaseFault, rankView, returnCode, heldSec, ttlSec);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-rf-teal`;
  const mRed = `${id}-${uid}-rf-red`;
  const mAmber = `${id}-${uid}-rf-amber`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= 5) {
          setPlaying(false);
          return 5;
        }
        const next = (prev + 1) as RforkDiagStep;
        if (next >= 5) setPlaying(false);
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectStep = (next: RforkDiagStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const applyReturnPreset = (code: RforkReturnCode, held: RforkHeldElapsed) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(5);
    setReturnCode(code);
    setHeldSec(held);
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
      question="日志最后只写一句“传输失败回退默认加载”，怎么 30 秒揪出真凶？"
      toolbarLabel="RFork 五阶段首错分诊控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-step": step,
        "data-return-code": returnCode,
        "data-held-sec": heldSec,
        "data-ttl-sec": ttlSec,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
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
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="归还状态码、持租耗时与首错锚点切换">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-preset-404-48"
              aria-pressed={mode === "sandbox" && step === 5 && returnCode === 404 && heldSec === 48.2}
              style={eduBtnStyle(
                mode === "sandbox" && step === 5 && returnCode === 404 && heldSec === 48.2,
                "dark",
              )}
              onClick={() => applyReturnPreset(404, 48.2)}
            >
              404 + 48.2s (&lt;TTL排除过期)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-preset-404-75"
              aria-pressed={mode === "sandbox" && step === 5 && returnCode === 404 && heldSec === 75.6}
              style={eduBtnStyle(
                mode === "sandbox" && step === 5 && returnCode === 404 && heldSec === 75.6,
                "dark",
              )}
              onClick={() => applyReturnPreset(404, 75.6)}
            >
              404 + 75.6s (&gt;TTL超时回收)
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-preset-400"
              aria-pressed={mode === "sandbox" && step === 5 && returnCode === 400}
              style={eduBtnStyle(mode === "sandbox" && step === 5 && returnCode === 400, "dark")}
              onClick={() => applyReturnPreset(400, 48.2)}
            >
              400 停试禁发Seed
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-toggle-ttl"
              aria-pressed={mode === "sandbox" && ttlSec === 120}
              style={eduBtnStyle(mode === "sandbox" && ttlSec === 120, "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setStep(5);
                setTtlSec((prev) => (prev === 60 ? 120 : 60));
              }}
            >
              {`有效TTL：${ttlSec}s`}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-toggle-fault"
              aria-pressed={mode === "sandbox" && step === 4 && postLeaseFault === "manifest"}
              style={eduBtnStyle(mode === "sandbox" && step === 4 && postLeaseFault === "manifest", "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setStep(4);
                setPostLeaseFault((prev) => (prev === "batch7" ? "manifest" : "batch7"));
              }}
            >
              {postLeaseFault === "manifest" ? "借后首错：清单失配" : "借后首错：第7批断"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-diag-toggle-rank"
              aria-pressed={mode === "sandbox" && rankView !== "tp0"}
              style={eduBtnStyle(mode === "sandbox" && rankView !== "tp0", "teal")}
              onClick={() => {
                setPlaying(false);
                setMode("sandbox");
                setStep(3);
                setRankView((prev) =>
                  prev === "tp0" ? "non-tp0-info" : prev === "non-tp0-info" ? "non-tp0-debug" : "tp0",
                );
              }}
            >
              {rankView === "tp0"
                ? "日志：TP0主卡"
                : rankView === "non-tp0-info"
                  ? "日志：从卡INFO"
                  : "日志：从卡DEBUG"}
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={spec.takeawayTone}
      takeaway={spec.takeaway}
      kpi={spec.kpi}
      detailsSummary="查看工程与源码细节（main 8d6180e2 日志原文 / 停服注销双门 / 404 vs 400 与 60s TTL 前提）"
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
              事件时间轴首错锚点 · Rank 日志汇总 · 归还双结果分流图
            </span>
            <span
              className={`wiki-edu-badge ${step === 5 && returnCode === 404 && !diag.isExpiredCandidate ? "is-good" : "is-warn"}`}
            >
              {`首错锚点：${diag.anchorLabel}`}
            </span>
          </div>
          <svg
            viewBox="0 0 860 236"
            width="860"
            height="236"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`RFork 第 ${step} 类首错时间轴与分流图`}
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
                id={mAmber}
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

            {["0.配置", "1.登记", "2.借租", "3.取信", "4.清单", "5.分批读", "6.归还"].map((tName, idx) => {
              const nx = 14 + idx * 120;
              const isAnchor = idx === diag.anchorNodeIdx;
              const passed = idx < diag.anchorNodeIdx;
              const fill = isAnchor ? (step === 5 ? "#fff4cf" : "#fff0e9") : passed ? "#ddf4ef" : "#ece9df";
              const stroke = isAnchor ? (step === 5 ? "#c78300" : "#b54237") : passed ? "#087f73" : "#d8d8cf";
              return (
                <g key={tName}>
                  <rect
                    x={nx}
                    y="14"
                    width="106"
                    height="58"
                    rx="8"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isAnchor ? "2.2" : "1.3"}
                  />
                  <text x={nx + 53} y="38" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
                    {tName}
                  </text>
                  <text
                    x={nx + 53}
                    y="58"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={isAnchor ? "#b54237" : "#66716d"}
                  >
                    {isAnchor ? "★ 首错锚点" : passed ? "✓ 已过" : "未达"}
                  </text>
                  {idx < 6 && (
                    <line
                      x1={nx + 108}
                      y1="43"
                      x2={nx + 118}
                      y2="43"
                      stroke={passed ? "#087f73" : "#d8d8cf"}
                      strokeWidth="1.6"
                      markerEnd={`url(#${passed ? mTeal : mAmber})`}
                    />
                  )}
                </g>
              );
            })}

            <rect
              x="14"
              y="106"
              width="432"
              height="114"
              rx="9"
              fill="#fbfaf6"
              stroke="#4c65b6"
              strokeWidth="1.5"
            />
            <text x="230" y="130" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              Rank 汇总日志与同卡首错反查链
            </text>
            <rect x="28" y="142" width="404" height="32" rx="6" fill="#e8edff" stroke="#4c65b6" />
            <text x="230" y="163" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {diag.rankSummaryLine}
            </text>
            <text x="230" y="202" textAnchor="middle" fontSize="12" fontWeight="700" fill="#b54237">
              {`▲ 沿同 Rank 往上锁死真凶：${diag.anchorLabel}`}
            </text>
            <path
              className="wiki-edu-wire is-flow"
              d={`M 230 106 L 230 88 L ${67 + diag.anchorNodeIdx * 120} 88 L ${67 + diag.anchorNodeIdx * 120} 74`}
              stroke="#b54237"
              markerEnd={`url(#${mRed})`}
            />

            <rect
              x="466"
              y="106"
              width="380"
              height="114"
              rx="9"
              fill="#fbfaf6"
              stroke="#087f73"
              strokeWidth="1.5"
            />
            <text x="656" y="128" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`归还双结果分流（HTTP ${returnCode} · 持租 ${heldSec}s / TTL ${ttlSec}s）`}
            </text>
            <rect x="482" y="138" width="348" height="30" rx="6" fill="#ddf4ef" stroke="#087f73" />
            <text x="656" y="158" textAnchor="middle" fontSize="12" fontWeight="700" fill="#087f73">
              ✓ 线 A（对外推理服务）：权重已齐 · 100% 正常就绪
            </text>
            <rect
              x="482"
              y="176"
              width="348"
              height="34"
              rx="6"
              fill={returnCode === 400 ? "#fff0e9" : diag.isExpiredCandidate ? "#fff4cf" : "#ddf4ef"}
              stroke={returnCode === 400 ? "#b54237" : diag.isExpiredCandidate ? "#c78300" : "#087f73"}
            />
            <text
              x="656"
              y="198"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={returnCode === 400 ? "#b54237" : "#17211f"}
            >
              {returnCode === 400 ? diag.seedBranchText : `✓ 404 可发新源 · ${diag.ttlVerdictText}`}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-chunks-wrap">
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
              <div key={item.step} className={`wiki-edu-station ${cls}`} style={{ flex: "1 1 132px" }}>
                <strong>{item.stationTitle}</strong>
                <span>{item.stationSub}</span>
              </div>
            );
          })}
        </div>

        {step === 4 && (
          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>第 7/12 批中断剖面</span>
              <span>停服并注销后回退</span>
            </div>
            <div className="wiki-edu-track">
              <div className="wiki-edu-op is-attn" style={{ flex: 6 }}>
                批 1–6 已写入
              </div>
              <div className="wiki-edu-op is-bubble" style={{ flex: 1.8 }}>
                批 7 未知
              </div>
              <div className="wiki-edu-op is-eager" style={{ flex: 5 }}>
                批 8–12 未读
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="wiki-edu-dual-grid">
            <div className="wiki-edu-lane-box">
              <div className="wiki-edu-lane-label">
                <span>持租时长 vs 60s TTL</span>
                <span>未续租无跳钟</span>
              </div>
              <div className="wiki-edu-track">
                <div className="wiki-edu-op is-full" style={{ flex: 4.8 }}>
                  48.2s 排除过期
                </div>
                <div className="wiki-edu-op is-attn" style={{ flex: 5.2 }}>
                  75.6s 过期候选
                </div>
              </div>
            </div>
            <div className="wiki-edu-lane-box">
              <div className="wiki-edu-lane-label">
                <span>归还状态码分流</span>
                <span>推理均正常</span>
              </div>
              <div className="wiki-edu-track">
                <div className="wiki-edu-op is-full" style={{ flex: 1 }}>
                  404 清租可发源
                </div>
                <div className="wiki-edu-op is-bubble" style={{ flex: 1 }}>
                  400 停试禁发源
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="wiki-edu-chunks-wrap">
          <div className="wiki-edu-chunk-pill">
            <strong>日志表象</strong>
            <span>{spec.logTag}</span>
          </div>
          <div className="wiki-edu-chunk-pill">
            <strong>服务状态</strong>
            <span>{spec.stateTag}</span>
          </div>
          <div className="wiki-edu-chunk-pill">
            <strong>新源发布</strong>
            <span>{spec.seedTag}</span>
          </div>
          <div className="wiki-edu-chunk-pill is-last">
            <strong>首查动作</strong>
            <span>{spec.actionTag}</span>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
