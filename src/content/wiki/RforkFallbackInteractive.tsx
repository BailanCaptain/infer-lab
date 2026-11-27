import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { eduBtnStyle, WikiEduSandboxShell } from "./WikiEduSandboxShell";

export const RFORK_SCENARIOS = [
  "hit-seed",
  "planner-miss",
  "seed-transfer-drop",
  "lease-reject-400",
  "cleanup-abort",
] as const;

export type RforkScenarioId = (typeof RFORK_SCENARIOS)[number];
export type RforkDiagramMode = "svg" | "sandbox";
export type RforkOutcomeKind = "p2p-ok" | "p2p-lease-warn" | "fallback-ok" | "safety-abort";

export interface RforkScenarioSpec {
  readonly id: RforkScenarioId;
  readonly index: 1 | 2 | 3 | 4 | 5;
  readonly shortLabel: string;
  readonly humanBtn: string;
  readonly badgeText: string;
  readonly title: string;
  readonly takeaway: string;
  readonly detail: string;
  readonly reachedStage: 2 | 3 | 4;
  readonly faultBadge: string | null;
  readonly outcomeKind: RforkOutcomeKind;
  readonly isFastSuccess: boolean;
  readonly safetyGateTitle: string;
  readonly safetyGateDesc: string;
  readonly finalOutcome: string;
  readonly serviceAvailability: string;
}

export const RFORK_SCENARIO_SPECS: Record<RforkScenarioId, RforkScenarioSpec> = {
  "hit-seed": {
    id: "hit-seed",
    index: 1,
    shortLabel: "① 正常零拷贝借用",
    humanBtn: "① 正常秒借上线",
    badgeText: "现场 1 / 5 · 零拷贝直通",
    title: "现场 ① · 正常零拷贝借用闭环（HCCS/RDMA 直灌显存 + 后台还租发布 Seed）",
    takeaway: "一路绿灯：不读慢速网盘，直接从邻居卡显存高速把权重拉过来，秒级上线还能继续借给下一台！",
    detail:
      "空架构建与 HBM 登记后向 Planner 借到同身份 Seed 与租约，经五门清单核验后通过 HIXL（HCCS/RDMA）≤1GiB/512段分批直灌显存；读完停续租并后台异步 /put_seed，服务正常上线并登记为新 Seed。",
    reachedStage: 4,
    faultBadge: null,
    outcomeKind: "p2p-ok",
    isFastSuccess: true,
    safetyGateTitle: "无需触发回退（一次直传成功）",
    safetyGateDesc: "跳过本地 Safetensors 磁盘读取与解析，权重已在显存就绪。",
    finalOutcome: "P2P 直灌上线：跳过磁盘 Safetensors 解析与搬运",
    serviceAvailability: "🟢 服务正常上线 · 自己也成为新邻居供后续机器借用",
  },
  "planner-miss": {
    id: "planner-miss",
    index: 2,
    shortLabel: "② Planner 404 无可用 Seed",
    humanBtn: "② 没人可借 (404)",
    badgeText: "现场 2 / 5 · 安全改读硬盘",
    title: "现场 ② · Planner 404 无可用 Seed（正常未命中 → 零中断退回本地 Safetensors）",
    takeaway: "第一台冷启动没人可借（404）：显存还没写进任何半截数据，安全撤掉登记后自动改读本地硬盘上线！",
    detail:
      "首台冷启动或名额占满时 Planner 返回 HTTP 404（404 / 暂无空闲 Seed）；经 prepare_for_fallback 核验 service_stopped && memory_reset 双门通过后注销预登记 HBM，零中断安全降级本地 Safetensors 加载。",
    reachedStage: 2,
    faultBadge: "404 / 暂无空闲 Seed",
    outcomeKind: "fallback-ok",
    isFastSuccess: false,
    safetyGateTitle: "✓ 安全门检查通过：显存干净清零",
    safetyGateDesc: "还没开始传数据（0 字节脏写入），取消借用登记，转走本地 Safetensors 硬盘加载。",
    finalOutcome: "零中断安全降级本地 Safetensors 加载",
    serviceAvailability: "🟢 服务正常上线 · 自动改读本地硬盘兜底成功",
  },
  "seed-transfer-drop": {
    id: "seed-transfer-drop",
    index: 3,
    shortLabel: "③ Seed 失联 / 传输中断",
    humanBtn: "③ 传一半断网",
    badgeText: "现场 3 / 5 · 清空脏数据后改读硬盘",
    title: "现场 ③ · Seed 传输中断 / 连接失联（清理干净后零崩溃退回本地加载）",
    takeaway: "传到一半邻居断网了：先把传了一半的半截脏权重彻底清空，再自动改读本地硬盘，服务照样稳稳上线！",
    detail:
      "分批同步读取中途遇 Seed 退出或网络断开（Seed 失联 / 传输中断），前 k-1 批已写入显存。加载器停续租并调用 prepare_for_fallback（最多 2 轮）清空半截脏数据与 HBM 登记，零崩溃退回本地 Safetensors 重载。",
    reachedStage: 4,
    faultBadge: "Seed 失联 / 传输中断",
    outcomeKind: "fallback-ok",
    isFastSuccess: false,
    safetyGateTitle: "✓ 安全门清扫成功：半截脏权重已擦除",
    safetyGateDesc: "把传了一半的残缺显存彻底回收清零，再从本地 Safetensors 硬盘重新完整加载。",
    finalOutcome: "零崩溃退回本地 Safetensors 重载",
    serviceAvailability: "🟢 服务正常上线 · 残缺数据已清净，重读硬盘无损启动",
  },
  "lease-reject-400": {
    id: "lease-reject-400",
    index: 4,
    shortLabel: "④ 归还 400 REJECTED",
    humanBtn: "④ 归还 400 拒收",
    badgeText: "现场 4 / 5 · 归还 400 禁发新 Seed，推理照常",
    title: "现场 ④ · 归还租约遇 HTTP 400 REJECTED（取消发布新 Seed，推理服务仍正常可用）",
    takeaway:
      "权重已 100% 传完，后台归还遇 HTTP 400 REJECTED 时立即停试并取消发布新 Seed，推理照常可用！（注：TTL 过期返回 404 会被客户端与 200 一并视作 RELEASED。）",
    detail:
      "权重已全部同步读完（TRANSFERRED）。需严格区分归还返回码：若租约因 TTL 过期被清理返回 HTTP 404，planner_client 将 200/404 统一映射为 RELEASED；当归还遭遇 HTTP 400（及 403 等其他不可重试响应映射为 REJECTED）时，8d6180e2 会话立即设 stop=True 停止重试并取消发布新 Seed（注：RETRYABLE 快试未果在 8d6180e2 则转入后台慢试，不直接清空待发布 Seed），不重读 Safetensors 磁盘，推理服务仍正常可用。",
    reachedStage: 4,
    faultBadge: "归还 400 REJECTED",
    outcomeKind: "p2p-lease-warn",
    isFastSuccess: true,
    safetyGateTitle: "无需回退（权重已 100% 传完就绪）",
    safetyGateDesc:
      "HTTP 400 REJECTED 仅取消本卡发布为新 Seed（TTL 过期 404 则视同 RELEASED），绝不推翻已就绪模型。",
    finalOutcome: "400 REJECTED 禁发新 Seed，模型不回退",
    serviceAvailability: "🟢 推理服务仍正常可用（对外接请求完全不受影响）",
  },
  "cleanup-abort": {
    id: "cleanup-abort",
    index: 5,
    shortLabel: "⑤ 脏缓冲清理失败阻断",
    humanBtn: "⑤ 脏显存清不掉",
    badgeText: "现场 5 / 5 · 安全门紧急红灯拦停",
    title: "现场 ⑤ · 传输异常且已写入脏缓冲清理失败（安全门阻断回退：抛明确 RuntimeError）",
    takeaway:
      "传一半断了，而且残留的脏显存清不掉：安全门直接拉闸报错！宁可拒绝启动，也绝不带脏权重吐乱码或双份占爆显存！",
    detail:
      "分批读失败后 2 轮 prepare_for_fallback 未能注销 HBM 或清空脏缓冲（脏缓冲清理失败），旧存储仍驻留半截脏权重；安全门阻断回退：抛明确 RuntimeError 中止启动，严防精度静默损坏与双份 Safetensors OOM。",
    reachedStage: 4,
    faultBadge: "脏缓冲清理失败",
    outcomeKind: "safety-abort",
    isFastSuccess: false,
    safetyGateTitle: "✗ 安全门紧急拦停：2 轮清理仍残留脏显存！",
    safetyGateDesc: "旧显存没释放干净，严禁再硬塞第二份本地模型或带着半截坏权重上线。",
    finalOutcome: "安全门阻断回退：抛明确 RuntimeError",
    serviceAvailability: "🔴 主动拉闸中止启动 · 严防乱码坏精度与双份占卡 OOM",
  },
};

const STATIONS = [
  { stage: 1 as const, title: "① 准备空显存", sub: "建好空模型架子" },
  { stage: 2 as const, title: "② 找邻居借权重", sub: "向调度中心领借条" },
  { stage: 3 as const, title: "③ 核对型号清单", sub: "确认层数形状一致" },
  { stage: 4 as const, title: "④ 高速直传显存", sub: "跳过硬盘直灌本卡" },
];

export const RFORK_DROP_BATCH_OPTIONS = [3, 7, 11] as const;
export type RforkDropBatch = (typeof RFORK_DROP_BATCH_OPTIONS)[number];

export interface RforkDerivedFlowState {
  readonly scenario: RforkScenarioId;
  readonly dropBatch: RforkDropBatch;
  readonly serviceStopped: boolean;
  readonly memoryReset: boolean;
  readonly totalBatches: 12;
  readonly writtenBatches: number;
  readonly unknownBatch: number | null;
  readonly unreadBatches: number;
  readonly needsFallback: boolean;
  readonly bothGatesPass: boolean;
  readonly activeExit: "direct-online" | "disk-online" | "safety-abort";
  readonly seedPublishOpen: boolean;
  readonly batchSummaryText: string;
}

export function computeRforkFlowState(
  scenario: RforkScenarioId,
  dropBatch: RforkDropBatch,
  serviceStopped: boolean,
  memoryReset: boolean,
): RforkDerivedFlowState {
  const totalBatches = 12 as const;
  if (scenario === "hit-seed" || scenario === "lease-reject-400") {
    return {
      scenario,
      dropBatch,
      serviceStopped: true,
      memoryReset: true,
      totalBatches,
      writtenBatches: 12,
      unknownBatch: null,
      unreadBatches: 0,
      needsFallback: false,
      bothGatesPass: true,
      activeExit: "direct-online",
      seedPublishOpen: scenario === "hit-seed",
      batchSummaryText: "1–12 批已全量写入 (12/12)",
    };
  }
  if (scenario === "planner-miss") {
    const both = serviceStopped && memoryReset;
    return {
      scenario,
      dropBatch,
      serviceStopped,
      memoryReset,
      totalBatches,
      writtenBatches: 0,
      unknownBatch: null,
      unreadBatches: 12,
      needsFallback: true,
      bothGatesPass: both,
      activeExit: both ? "disk-online" : "safety-abort",
      seedPublishOpen: false,
      batchSummaryText: "0 批已写 · 1–12 批未读",
    };
  }
  const writtenBatches = dropBatch - 1;
  const unreadBatches = totalBatches - dropBatch;
  const both = serviceStopped && memoryReset;
  return {
    scenario,
    dropBatch,
    serviceStopped,
    memoryReset,
    totalBatches,
    writtenBatches,
    unknownBatch: dropBatch,
    unreadBatches,
    needsFallback: true,
    bothGatesPass: both,
    activeExit: both ? "disk-online" : "safety-abort",
    seedPublishOpen: false,
    batchSummaryText: `1–${writtenBatches} 已写 · 第 ${dropBatch} 批未知 · ${dropBatch + 1}–12 未读`,
  };
}

export interface RforkFallbackInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RforkDiagramMode | undefined;
  readonly initialScenario?: RforkScenarioId | undefined;
  readonly initialDropBatch?: RforkDropBatch | undefined;
  readonly initialServiceStopped?: boolean | undefined;
  readonly initialMemoryReset?: boolean | undefined;
}

export function applyRforkGateToggle(
  state: {
    readonly scenario: RforkScenarioId;
    readonly dropBatch: RforkDropBatch;
    readonly serviceStopped: boolean;
    readonly memoryReset: boolean;
  },
  gate: "service" | "memory",
): RforkDerivedFlowState {
  const nextSvc = gate === "service" ? !state.serviceStopped : state.serviceStopped;
  const nextMem = gate === "memory" ? !state.memoryReset : state.memoryReset;
  return computeRforkFlowState(state.scenario, state.dropBatch, nextSvc, nextMem);
}

export function RforkFallbackInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialScenario = "hit-seed",
  initialDropBatch = 7,
  initialServiceStopped,
  initialMemoryReset,
}: RforkFallbackInteractiveProps) {
  const [mode, setMode] = useState<RforkDiagramMode>(initialMode);
  const [scenario, setScenario] = useState<RforkScenarioId>(initialScenario);
  const [dropBatch, setDropBatch] = useState<RforkDropBatch>(initialDropBatch);
  const [serviceStopped, setServiceStopped] = useState<boolean>(initialServiceStopped ?? true);
  const [memoryReset, setMemoryReset] = useState<boolean>(
    initialMemoryReset ?? initialScenario !== "cleanup-abort",
  );
  const [playing, setPlaying] = useState(false);

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const spec = RFORK_SCENARIO_SPECS[scenario];
  const flow = computeRforkFlowState(scenario, dropBatch, serviceStopped, memoryReset);
  const mTeal = `${id}-${uid}-rf-teal`;
  const mRed = `${id}-${uid}-rf-red`;
  const mAmber = `${id}-${uid}-rf-amber`;
  const mMuted = `${id}-${uid}-rf-muted`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    const timer = setInterval(() => {
      setScenario((prev) => {
        const idx = RFORK_SCENARIOS.indexOf(prev);
        if (idx >= RFORK_SCENARIOS.length - 1) {
          setPlaying(false);
          return prev;
        }
        const next = RFORK_SCENARIOS[idx + 1]!;
        setServiceStopped(true);
        setMemoryReset(next !== "cleanup-abort");
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectScenario = (next: RforkScenarioId) => {
    setPlaying(false);
    setMode("sandbox");
    setScenario(next);
    setServiceStopped(true);
    setMemoryReset(next !== "cleanup-abort");
  };

  const selectBatchStop = (nextBatch: RforkDropBatch) => {
    setPlaying(false);
    setMode("sandbox");
    setDropBatch(nextBatch);
    if (scenario !== "seed-transfer-drop" && scenario !== "cleanup-abort") {
      setScenario("seed-transfer-drop");
      setServiceStopped(true);
      setMemoryReset(true);
    }
  };

  const toggleGate = (gate: "service" | "memory") => {
    setPlaying(false);
    setMode("sandbox");
    const next = applyRforkGateToggle({ scenario, dropBatch, serviceStopped, memoryReset }, gate);
    setServiceStopped(next.serviceStopped);
    setMemoryReset(next.memoryReset);
  };

  const togglePlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (scenario === "cleanup-abort") {
      setScenario("hit-seed");
      setServiceStopped(true);
      setMemoryReset(true);
    }
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
    const idx = RFORK_SCENARIOS.indexOf(scenario);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        selectScenario(RFORK_SCENARIOS[Math.min(RFORK_SCENARIOS.length - 1, idx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectScenario(RFORK_SCENARIOS[Math.max(0, idx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        event.preventDefault();
        selectScenario(RFORK_SCENARIOS[Number(event.key) - 1]!);
        break;
    }
  };

  const stationClass = (stage: 1 | 2 | 3 | 4) => {
    if (spec.outcomeKind === "p2p-ok") return "is-pass";
    if (spec.outcomeKind === "p2p-lease-warn") return stage === 4 ? "is-warn" : "is-pass";
    if (stage < spec.reachedStage) return "is-pass";
    if (stage === spec.reachedStage) return "is-fault";
    return "is-skip";
  };

  const effectiveTakeawayBadge =
    flow.needsFallback && !flow.bothGatesPass
      ? scenario === "planner-miss"
        ? "现场 2 / 5 · 安全门异常拦停"
        : scenario === "seed-transfer-drop"
          ? "现场 3 / 5 · 安全门紧急红灯拦停"
          : spec.badgeText
      : scenario === "cleanup-abort" && flow.bothGatesPass
        ? "现场 5 / 5 · 清空脏数据后改读硬盘"
        : spec.badgeText;
  const effectiveTakeaway =
    flow.needsFallback && !flow.bothGatesPass
      ? scenario === "planner-miss"
        ? "本轮未命中 Seed（已写 0 批），但回退前 prepare_for_fallback 安全门失败：主动抛 RuntimeError 中止启动！"
        : "传一半断了，而且残留的脏显存清不掉：安全门直接拉闸报错！宁可拒绝启动，也绝不带脏权重吐乱码或双份占爆显存！"
      : scenario === "cleanup-abort" && flow.bothGatesPass
        ? "两道安全门恢复通过：已写残缺显存彻底回收归零，零崩溃改读本地 Safetensors 硬盘上线！"
        : spec.takeaway;
  const effectiveDetail =
    flow.needsFallback && !flow.bothGatesPass
      ? scenario === "planner-miss"
        ? "Planner 返回 404（本轮已写 0 批），但 prepare_for_fallback 安全门失败，安全门阻断回退：抛明确 RuntimeError 中止启动。"
        : "分批读失败后 prepare_for_fallback 未能完成双门清理（门1停种子服或门2注销显存失败），安全门阻断回退：抛明确 RuntimeError 中止启动，严防精度静默损坏与双份 Safetensors OOM。"
      : scenario === "cleanup-abort" && flow.bothGatesPass
        ? "两道 prepare_for_fallback 安全门均已恢复通过，前序已写残缺数据与 HBM 登记彻底清零，零崩溃退回本地 Safetensors 重载。"
        : spec.detail;
  const effectiveOutcomeKind =
    flow.activeExit === "safety-abort"
      ? ("safety-abort" as const)
      : flow.activeExit === "disk-online"
        ? ("fallback-ok" as const)
        : spec.outcomeKind;
  const effectiveSafetyTitle =
    flow.needsFallback && !flow.bothGatesPass
      ? scenario === "planner-miss"
        ? "✗ 安全门异常拦停（已写 0 批，未发远端传输）"
        : "✗ 安全门紧急拦停：prepare_for_fallback 未能清空脏显存！"
      : scenario === "cleanup-abort" && flow.bothGatesPass
        ? "✓ 安全门恢复通过：半截脏权重已擦除"
        : spec.safetyGateTitle;
  const effectiveSafetyDesc =
    flow.needsFallback && !flow.bothGatesPass
      ? scenario === "planner-miss"
        ? "Planner 404 本轮已写 0 批，但回退前 prepare_for_fallback 安全门失败，拒绝继续加载。"
        : "已写残缺显存或种子服务未能干净注销，严禁再硬塞第二份本地模型或带着半截坏权重上线。"
      : scenario === "cleanup-abort" && flow.bothGatesPass
        ? "两道安全门均已通过，已写残缺缓冲归零，安全退回本地 Safetensors 重载。"
        : spec.safetyGateDesc;
  const effectiveFinalOutcome =
    flow.activeExit === "safety-abort" && spec.outcomeKind !== "safety-abort"
      ? "安全门阻断回退：抛明确 RuntimeError"
      : flow.activeExit === "disk-online" && spec.outcomeKind === "safety-abort"
        ? "零崩溃退回本地 Safetensors 重载"
        : spec.finalOutcome;
  const effectiveServiceAvail =
    flow.activeExit === "safety-abort" && spec.outcomeKind !== "safety-abort"
      ? "🔴 主动拉闸中止启动 · 回退安全门未通过"
      : flow.activeExit === "disk-online" && spec.outcomeKind === "safety-abort"
        ? "🟢 服务正常上线 · 残缺数据已清净，重读硬盘无损启动"
        : spec.serviceAvailability;

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
      kickerTag="母版 A · 状态机与容灾轨迹"
      kickerTitle="RFork 跨实例零拷贝借权重与安全回退"
      question="新扩容机器直接从隔壁卡显存借权重，万一半路断了会把服务搞崩吗？"
      toolbarLabel="RFork 五种现场状态机控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-scenario": scenario,
        "data-drop-batch": dropBatch,
        "data-exit": flow.activeExit,
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-autoplay"
              aria-pressed={playing}
              style={eduBtnStyle(playing, "dark")}
              onClick={togglePlay}
            >
              {playing ? "⏸ 暂停轮播" : "▶ 轮播 5 种现场"}
            </button>
            {RFORK_SCENARIOS.map((scId) => {
              const item = RFORK_SCENARIO_SPECS[scId];
              const active = mode === "sandbox" && scenario === scId;
              return (
                <button
                  key={scId}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`rfork-scenario-${scId}`}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={eduBtnStyle(active, "teal")}
                  onClick={() => selectScenario(scId)}
                >
                  {item.humanBtn}
                </button>
              );
            })}
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="中断批次与两道回退安全门控制">
            {RFORK_DROP_BATCH_OPTIONS.map((b) => {
              const active =
                mode === "sandbox" &&
                (scenario === "seed-transfer-drop" || scenario === "cleanup-abort") &&
                dropBatch === b;
              return (
                <button
                  key={b}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`rfork-batch-${b}`}
                  aria-pressed={active}
                  style={eduBtnStyle(active, "dark")}
                  onClick={() => selectBatchStop(b)}
                >
                  {`第 ${b}/12 批中断`}
                </button>
              );
            })}
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-gate-service"
              disabled={!flow.needsFallback}
              aria-pressed={mode === "sandbox" && flow.needsFallback && flow.serviceStopped}
              style={eduBtnStyle(mode === "sandbox" && flow.needsFallback && flow.serviceStopped, "teal")}
              onClick={() => toggleGate("service")}
            >
              {flow.serviceStopped ? "门1 停种子服：✓成功" : "门1 停种子服：✗失败"}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="rfork-gate-memory"
              disabled={!flow.needsFallback}
              aria-pressed={mode === "sandbox" && flow.needsFallback && flow.memoryReset}
              style={eduBtnStyle(mode === "sandbox" && flow.needsFallback && flow.memoryReset, "teal")}
              onClick={() => toggleGate("memory")}
            >
              {flow.memoryReset ? "门2 注销显存：✓成功" : "门2 注销显存：✗失败"}
            </button>
          </fieldset>
        </>
      }
      takeawayBadge={effectiveTakeawayBadge}
      takeawayTone={
        effectiveOutcomeKind === "safety-abort"
          ? "danger"
          : effectiveOutcomeKind === "p2p-lease-warn"
            ? "warn"
            : "default"
      }
      takeaway={effectiveTakeaway}
      kpi={effectiveFinalOutcome}
      detailsSummary="查看工程与源码细节（五门清单 / prepare_for_fallback 双门 / 租约状态码）"
      detailsContent={
        <>
          <strong>{spec.shortLabel}</strong>（{spec.title}）：{effectiveDetail}
        </>
      }
    >
      <div>
        <div className="wiki-edu-rfork-rail">
          {STATIONS.map((st) => (
            <div key={st.stage} className={`wiki-edu-station ${stationClass(st.stage)}`}>
              <strong>{st.title}</strong>
              <span>{st.sub}</span>
            </div>
          ))}
        </div>

        <div className="wiki-edu-panel" style={{ marginBottom: "12px" }}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              主干四步借传 · 12 批进度 · 两道回退安全门 · 三条终态出口
            </span>
            <span
              className={`wiki-edu-badge ${flow.activeExit === "safety-abort" ? "is-bad" : flow.activeExit === "disk-online" ? "is-warn" : "is-good"}`}
            >
              {spec.faultBadge ?? flow.batchSummaryText}
            </span>
          </div>
          <svg
            viewBox="0 0 860 244"
            width="860"
            height="244"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`RFork 轨迹导引：${spec.title}`}
          >
            <defs>
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
                id={mAmber}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0,1 L9,5 L0,9 z" fill="#c78300" />
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
                <path d="M0,1 L9,5 L0,9 z" fill="#d8d8cf" />
              </marker>
            </defs>

            {[
              { x: 14, w: 120, label: "① 空架登记" },
              { x: 152, w: 130, label: "② 借租寻源" },
              { x: 300, w: 120, label: "③ 清单核对" },
            ].map((stNode, idx) => {
              const stNum = (idx + 1) as 1 | 2 | 3;
              const hitFault = flow.needsFallback && spec.reachedStage === stNum;
              const skipped = flow.needsFallback && stNum > spec.reachedStage;
              return (
                <g key={stNode.label}>
                  <rect
                    x={stNode.x}
                    y="14"
                    width={stNode.w}
                    height="50"
                    rx="8"
                    fill={hitFault ? "#fff0e9" : skipped ? "#ece9df" : "#ddf4ef"}
                    stroke={hitFault ? "#b54237" : skipped ? "#d8d8cf" : "#087f73"}
                    strokeWidth="1.6"
                  />
                  <text
                    x={stNode.x + stNode.w / 2}
                    y="44"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#17211f"
                  >
                    {stNode.label}
                  </text>
                  <line
                    x1={stNode.x + stNode.w + 2}
                    y1="39"
                    x2={stNode.x + stNode.w + 16}
                    y2="39"
                    stroke={skipped || hitFault ? "#d8d8cf" : "#087f73"}
                    strokeWidth="1.8"
                    markerEnd={`url(#${skipped || hitFault ? mMuted : mTeal})`}
                  />
                </g>
              );
            })}

            <rect
              x="438"
              y="10"
              width="408"
              height="68"
              rx="8"
              fill={
                flow.unknownBatch !== null ? "#fff4cf" : flow.writtenBatches === 12 ? "#ddf4ef" : "#ece9df"
              }
              stroke={
                flow.unknownBatch !== null ? "#c78300" : flow.writtenBatches === 12 ? "#087f73" : "#d8d8cf"
              }
              strokeWidth="1.6"
            />
            <text x="642" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {`④ 12 批直灌进度（${flow.batchSummaryText}）`}
            </text>
            {Array.from({ length: 12 }, (_, bIdx) => {
              const bNum = bIdx + 1;
              const bx = 452 + bIdx * 32;
              const isWritten = bNum <= flow.writtenBatches;
              const isUnknown = flow.unknownBatch === bNum;
              const fill = isWritten ? "#087f73" : isUnknown ? "#b54237" : "#ffffff";
              return (
                <g key={`batch-cell-${bNum}`}>
                  <rect x={bx} y="40" width="28" height="24" rx="4" fill={fill} stroke="#d8d8cf" />
                  <text
                    x={bx + 14}
                    y="56"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={isWritten || isUnknown ? "#ffffff" : "#66716d"}
                  >
                    {isUnknown ? "?" : bNum}
                  </text>
                </g>
              );
            })}

            {!flow.needsFallback ? (
              <path
                className="wiki-edu-wire is-flow"
                d="M 642 78 L 642 104 L 720 104"
                stroke={scenario === "lease-reject-400" ? "#c78300" : "#087f73"}
                markerEnd={`url(#${scenario === "lease-reject-400" ? mAmber : mTeal})`}
              />
            ) : (
              <path
                className="wiki-edu-wire is-flow"
                d={spec.reachedStage === 2 ? "M 217 66 L 217 102" : "M 540 78 L 540 132 L 288 132"}
                stroke={flow.bothGatesPass ? "#c78300" : "#b54237"}
                markerEnd={`url(#${flow.bothGatesPass ? mAmber : mRed})`}
              />
            )}

            <rect
              x="14"
              y="104"
              width="270"
              height="126"
              rx="9"
              fill={!flow.needsFallback ? "#fbfaf6" : flow.bothGatesPass ? "#ddf4ef" : "#fff0e9"}
              stroke={!flow.needsFallback ? "#d8d8cf" : flow.bothGatesPass ? "#087f73" : "#b54237"}
              strokeWidth="1.7"
            />
            <text x="149" y="128" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              回退两道安全门
            </text>
            <rect
              x="28"
              y="140"
              width="242"
              height="32"
              rx="6"
              fill={flow.serviceStopped ? "#ffffff" : "#fff0e9"}
              stroke={flow.serviceStopped ? "#087f73" : "#b54237"}
            />
            <text
              x="149"
              y="161"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={flow.serviceStopped ? "#087f73" : "#b54237"}
            >
              {flow.serviceStopped ? "✓ 门1：停种子服务成功" : "✗ 门1：停种子服务失败"}
            </text>
            <rect
              x="28"
              y="182"
              width="242"
              height="32"
              rx="6"
              fill={flow.memoryReset ? "#ffffff" : "#fff0e9"}
              stroke={flow.memoryReset ? "#087f73" : "#b54237"}
            />
            <text
              x="149"
              y="203"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={flow.memoryReset ? "#087f73" : "#b54237"}
            >
              {flow.memoryReset ? "✓ 门2：注销显存成功" : "✗ 门2：注销显存残留脏块"}
            </text>

            <path
              className={flow.activeExit === "disk-online" ? "wiki-edu-wire is-flow" : "wiki-edu-wire"}
              d="M 286 158 L 542 158"
              stroke={flow.activeExit === "disk-online" ? "#087f73" : "#d8d8cf"}
              markerEnd={`url(#${flow.activeExit === "disk-online" ? mTeal : mMuted})`}
            />
            <path
              className={flow.activeExit === "safety-abort" ? "wiki-edu-wire is-flow" : "wiki-edu-wire"}
              d="M 286 206 L 542 206"
              stroke={flow.activeExit === "safety-abort" ? "#b54237" : "#d8d8cf"}
              markerEnd={`url(#${flow.activeExit === "safety-abort" ? mRed : mMuted})`}
            />

            <rect
              x="548"
              y="88"
              width="298"
              height="42"
              rx="8"
              fill={flow.activeExit === "direct-online" ? "#ddf4ef" : "#fbfaf6"}
              stroke={flow.activeExit === "direct-online" ? "#087f73" : "#d8d8cf"}
              strokeWidth={flow.activeExit === "direct-online" ? "2" : "1.3"}
            />
            <text x="697" y="114" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {flow.seedPublishOpen
                ? "🟢 直传上线 + 新 Seed 发布开启"
                : scenario === "lease-reject-400"
                  ? "🟢 直传上线 · 400 关闭新 Seed"
                  : "出口 1：直传秒级上线"}
            </text>

            <rect
              x="548"
              y="138"
              width="298"
              height="42"
              rx="8"
              fill={flow.activeExit === "disk-online" ? "#ddf4ef" : "#fbfaf6"}
              stroke={flow.activeExit === "disk-online" ? "#087f73" : "#d8d8cf"}
              strokeWidth={flow.activeExit === "disk-online" ? "2" : "1.3"}
            />
            <text x="697" y="164" textAnchor="middle" fontSize="12" fontWeight="700" fill="#17211f">
              {flow.activeExit === "disk-online"
                ? "🟢 出口 2：安全回退本地读盘上线"
                : "出口 2：本地读盘上线（需双门全通）"}
            </text>

            <rect
              x="548"
              y="188"
              width="298"
              height="42"
              rx="8"
              fill={flow.activeExit === "safety-abort" ? "#fff0e9" : "#fbfaf6"}
              stroke={flow.activeExit === "safety-abort" ? "#b54237" : "#d8d8cf"}
              strokeWidth={flow.activeExit === "safety-abort" ? "2" : "1.3"}
            />
            <text
              x="697"
              y="214"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={flow.activeExit === "safety-abort" ? "#b54237" : "#66716d"}
            >
              {flow.activeExit === "safety-abort"
                ? "🔴 出口 3：强制中止防脏数据上线!"
                : "出口 3：安全中止（任一门失败触发）"}
            </text>
          </svg>
        </div>

        <div className="wiki-edu-dual-grid">
          <div className={`wiki-edu-panel${effectiveOutcomeKind === "safety-abort" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">容灾回退安全门</span>
              <span
                className={`wiki-edu-badge ${
                  effectiveOutcomeKind === "safety-abort"
                    ? "is-bad"
                    : spec.isFastSuccess
                      ? "is-mid"
                      : "is-good"
                }`}
              >
                {effectiveOutcomeKind === "safety-abort"
                  ? "清理失败 · 阻断"
                  : spec.isFastSuccess
                    ? "未触发回退"
                    : "已清空 · 改读硬盘"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{effectiveSafetyTitle}</strong>
              <br />
              {effectiveSafetyDesc}
            </div>
          </div>

          <div className={`wiki-edu-panel${effectiveOutcomeKind === "safety-abort" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">最终对外服务状态（红绿灯）</span>
              <span
                className={`wiki-edu-badge ${
                  effectiveOutcomeKind === "safety-abort"
                    ? "is-bad"
                    : effectiveOutcomeKind === "p2p-lease-warn"
                      ? "is-warn"
                      : "is-good"
                }`}
              >
                {effectiveOutcomeKind === "safety-abort" ? "安全中止" : "对外正常服务"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{effectiveServiceAvail}</strong>
              <br />
              {effectiveFinalOutcome}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
