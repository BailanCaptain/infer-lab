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
    shortLabel: "④ 归还 400 / TTL 过期",
    humanBtn: "④ 归还超时告警",
    badgeText: "现场 4 / 5 · 权重已到手，照常服务",
    title: "现场 ④ · 租约 TTL 过期或归还期 Planner 返回 400（仅记归还告警，推理服务仍正常可用）",
    takeaway:
      "权重已经 100% 传完了，只是后台“还借条”时超时告警：不用重读硬盘，推理服务照常接客，仅放弃当新邻居！",
    detail:
      "权重已全部同步读完（TRANSFERRED），后台归还租约遇 TTL 过期或 400 REJECTED（归还 400 / TTL 告警）时立即停试并取消发布新 Seed，不重读 Safetensors 磁盘，推理服务仍正常可用。",
    reachedStage: 4,
    faultBadge: "归还 400 / TTL 告警",
    outcomeKind: "p2p-lease-warn",
    isFastSuccess: true,
    safetyGateTitle: "无需回退（权重已 100% 传完就绪）",
    safetyGateDesc: "只记一条归还告警日志并取消当新邻居资格，绝不推翻已就绪的模型。",
    finalOutcome: "仅记归还告警并放弃当 Seed，模型不回退",
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

export interface RforkFallbackInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: RforkDiagramMode | undefined;
  readonly initialScenario?: RforkScenarioId | undefined;
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
}: RforkFallbackInteractiveProps) {
  const [mode, setMode] = useState<RforkDiagramMode>(initialMode);
  const [scenario, setScenario] = useState<RforkScenarioId>(initialScenario);
  const [playing, setPlaying] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const spec = RFORK_SCENARIO_SPECS[scenario];
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
        return RFORK_SCENARIOS[idx + 1]!;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, mode]);

  const selectScenario = (next: RforkScenarioId) => {
    setPlaying(false);
    setMode("sandbox");
    setScenario(next);
  };

  const togglePlay = () => {
    setMode("sandbox");
    if (playing) {
      setPlaying(false);
      return;
    }
    if (scenario === "cleanup-abort") setScenario("hit-seed");
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

  const originX = spec.reachedStage === 2 ? 310 : spec.reachedStage === 3 ? 540 : 760;

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
      extraRootAttrs={{ "data-scenario": scenario }}
      toolbar={
        <>
          <button
            type="button"
            className="wiki-edu-btn"
            data-testid="rfork-autoplay"
            aria-pressed={playing}
            style={eduBtnStyle(playing, "accent")}
            onClick={togglePlay}
          >
            {playing ? "⏸ 暂停轮播" : "▶ 轮播 5 种现场"}
          </button>

          <fieldset className="wiki-edu-btn-row" aria-label="RFork 五种现场状态切换">
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
          </fieldset>
        </>
      }
      takeawayBadge={spec.badgeText}
      takeawayTone={
        spec.outcomeKind === "safety-abort"
          ? "danger"
          : spec.outcomeKind === "p2p-lease-warn"
            ? "warn"
            : "default"
      }
      takeaway={spec.takeaway}
      kpi={spec.finalOutcome}
      detailsSummary="查看工程与源码细节（五门清单 / prepare_for_fallback 双门 / 租约状态码）"
      detailsContent={
        <>
          <strong>{spec.shortLabel}</strong>（{spec.title}）：{spec.detail}
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

        <svg
          viewBox="0 0 880 56"
          width="880"
          height="56"
          style={{ width: "100%", height: "auto", display: "block", marginBottom: "10px" }}
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
          {spec.isFastSuccess ? (
            <path
              className="wiki-edu-wire is-flow"
              d="M 760 4 L 760 48"
              stroke={spec.outcomeKind === "p2p-lease-warn" ? "#c78300" : "#087f73"}
              markerEnd={`url(#${spec.outcomeKind === "p2p-lease-warn" ? mAmber : mTeal})`}
            />
          ) : (
            <path
              className="wiki-edu-wire is-flow"
              d={`M ${originX} 4 L ${originX} 26 L 220 26 L 220 48`}
              stroke="#b54237"
              markerEnd={`url(#${mRed})`}
            />
          )}
          {spec.faultBadge && (
            <g>
              <rect
                x={Math.max(12, originX - 92)}
                y="14"
                width="184"
                height="24"
                rx="12"
                fill={spec.outcomeKind === "p2p-lease-warn" ? "#c78300" : "#b54237"}
              />
              <text x={originX} y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                {spec.faultBadge}
              </text>
            </g>
          )}
        </svg>

        <div className="wiki-edu-dual-grid">
          <div className={`wiki-edu-panel${spec.outcomeKind === "safety-abort" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">容灾回退安全门</span>
              <span
                className={`wiki-edu-badge ${
                  spec.outcomeKind === "safety-abort" ? "is-bad" : spec.isFastSuccess ? "is-mid" : "is-good"
                }`}
              >
                {spec.outcomeKind === "safety-abort"
                  ? "清理失败 · 阻断"
                  : spec.isFastSuccess
                    ? "未触发回退"
                    : "已清空 · 改读硬盘"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.safetyGateTitle}</strong>
              <br />
              {spec.safetyGateDesc}
            </div>
          </div>

          <div className={`wiki-edu-panel${spec.outcomeKind === "safety-abort" ? " is-oom" : ""}`}>
            <div className="wiki-edu-panel-head">
              <span className="wiki-edu-panel-title">最终对外服务状态（红绿灯）</span>
              <span
                className={`wiki-edu-badge ${
                  spec.outcomeKind === "safety-abort"
                    ? "is-bad"
                    : spec.outcomeKind === "p2p-lease-warn"
                      ? "is-warn"
                      : "is-good"
                }`}
              >
                {spec.outcomeKind === "safety-abort" ? "安全中止" : "对外正常服务"}
              </span>
            </div>
            <div className="wiki-edu-note-card">
              <strong>{spec.serviceAvailability}</strong>
              <br />
              {spec.finalOutcome}
            </div>
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
