import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";

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
  readonly title: string;
  readonly detail: string;
  readonly reachedStage: 2 | 3 | 4;
  readonly faultBadge: string | null;
  readonly outcomeKind: RforkOutcomeKind;
  readonly isFastSuccess: boolean;
  readonly borrowStageStatus: string;
  readonly transferStageStatus: string;
  readonly leaseStatus: string;
  readonly dualGateStatus: string;
  readonly finalOutcome: string;
  readonly serviceAvailability: string;
}

export const RFORK_SCENARIO_SPECS: Record<RforkScenarioId, RforkScenarioSpec> = {
  "hit-seed": {
    id: "hit-seed",
    index: 1,
    shortLabel: "① 正常零拷贝借用",
    title: "现场 ① · 正常零拷贝借用闭环（HCCS/RDMA 直灌显存 + 后台还租发布 Seed）",
    detail:
      "接收方先在租约外完成空架构建、HBM 登记并绑定 seed_key，向 Planner 借到同身份 Seed 与租约，通过五门清单核验后经 HIXL（HCCS/RDMA）按 ≤1GiB/512段分批直灌显存；读完即停续租并后台异步 /put_seed（200/404 记 RELEASED），主线完成收尾与 eval() 后交回模型，推理服务正常可用并发布为新 Seed（未还确认前记 DEFERRED）。",
    reachedStage: 4,
    faultBadge: null,
    outcomeKind: "p2p-ok",
    isFastSuccess: true,
    borrowStageStatus: "200 借到同身份 Seed 与租约（有 LEASE_TTL_SEC 时起续租）",
    transferStageStatus: "五门核验全过 · ≤1GiB/512段直灌完成（TRANSFERRED）",
    leaseStatus: "停续租并后台 /put_seed → 200/404 已归还，登记为新 Seed",
    dualGateStatus: "未触发回退清理（零拷贝直灌一次成功）",
    finalOutcome: "P2P 直灌上线：跳过磁盘 Safetensors 解析与搬运",
    serviceAvailability: "服务可用 · 推理正常且已具备 Seed 能力",
  },
  "planner-miss": {
    id: "planner-miss",
    index: 2,
    shortLabel: "② Planner 404 无可用 Seed",
    title: "现场 ② · Planner 404 无可用 Seed（正常未命中 → 零中断退回本地 Safetensors）",
    detail:
      "首台冷启动（尚无同身份 Seed）或名额占满时，Planner 返回 HTTP 404（仅记 DEBUG，区别于 400 请求头非法）。第 2 步 acquire_seed 返回 None 走 _RForkSeedUnavailable 分支，不打 transfer failed. 汇总；经 prepare_for_fallback 核验 service_stopped && memory_reset 双门全真后注销预登记 HBM，零中断退回本地 Safetensors 加载并在就绪后自登为 Seed。",
    reachedStage: 2,
    faultBadge: "404 / 暂无空闲 Seed",
    outcomeKind: "fallback-ok",
    isFastSuccess: false,
    borrowStageStatus: "Planner 回 404 无可用 Seed（正常冷启动未命中）",
    transferStageStatus: "未进入远端读取（0 字节脏写入）",
    leaseStatus: "未签发有效租约（无需网络还租阻塞）",
    dualGateStatus: "✓ service_stopped && memory_reset 通过 → 干净注销 HBM",
    finalOutcome: "零中断安全降级本地 Safetensors 加载",
    serviceAvailability: "服务正常可用 · 就绪后可自登为 Seed",
  },
  "seed-transfer-drop": {
    id: "seed-transfer-drop",
    index: 3,
    shortLabel: "③ Seed 失联 / 传输中断",
    title: "现场 ③ · Seed 传输中断 / 连接失联（清理干净后零崩溃退回本地加载）",
    detail:
      "第 3 步元数据 HTTP 请求失联或第 4 步分批同步读取（第 k 批）中途遇 Seed 退出、网络断开或传输引擎报错，汇总打印 transfer failed.；此时第 1..k-1 批已写入目标显存。加载器立即停续租并将还租交后台重试，调用 prepare_for_fallback（最多 2 轮）注销 HBM 登记并清空半截脏数据，双门通过后零崩溃退回本地 Safetensors 重载。",
    reachedStage: 4,
    faultBadge: "Seed 失联 / 传输中断",
    outcomeKind: "fallback-ok",
    isFastSuccess: false,
    borrowStageStatus: "200 已领租约，随后 Seed 元数据或传输通道失联",
    transferStageStatus: "第 k 批读取中断（1..k-1 批需先清理撤销）",
    leaseStatus: "停续租 · 后台异步重试 /put_seed（不阻塞本地回退）",
    dualGateStatus: "✓ 双门通过：半截脏显存与 HBM 登记已清空",
    finalOutcome: "丢弃半截传输，零崩溃退回本地 Safetensors 重载",
    serviceAvailability: "服务正常可用 · 已完整重载，绝无脏权重",
  },
  "lease-reject-400": {
    id: "lease-reject-400",
    index: 4,
    shortLabel: "④ 归还 400 / TTL 过期",
    title: "现场 ④ · 租约 TTL 过期或归还期 Planner 返回 400（仅记归还告警，推理服务仍正常可用）",
    detail:
      "第 4 步权重已全部同步读完（TRANSFERRED）并交回模型进入推理，无需回退也无须重读磁盘。后台线程归还租约时：若租约因传输耗时超 TTL 被示例 Planner 清扫会回 404（按约定记 RELEASED 但注明不代表按时归还）；若遇现场 Planner 拒绝或头解析失败回 400，客户端判 REJECTED 立即停试并取消延期 Seed 发布，仅记录归还告警——推理服务照常可用！",
    reachedStage: 4,
    faultBadge: "归还 400 / TTL 告警",
    outcomeKind: "p2p-lease-warn",
    isFastSuccess: true,
    borrowStageStatus: "200 已领租约（传输期间租约 TTL 到期或归还头异常）",
    transferStageStatus: "✓ 权重已 100% 同步读完并在本地显存就绪",
    leaseStatus: "⚠ 归还收 400 REJECTED / TTL 过期告警 → 取消发布 Seed",
    dualGateStatus: "未触发回退（权重已本地就绪，不重读磁盘、保留推理状态）",
    finalOutcome: "仅记归还告警并放弃当 Seed，模型不回退",
    serviceAvailability: "✓ 推理服务仍正常可用（对外接请求不受影响）",
  },
  "cleanup-abort": {
    id: "cleanup-abort",
    index: 5,
    shortLabel: "⑤ 脏缓冲清理失败阻断",
    title: "现场 ⑤ · 传输异常且已写入脏缓冲清理失败（安全门主动阻断静默回退，抛明确异常）",
    detail:
      "第 4 步分批读写入第 1..k-1 批后发生传输异常，进入 prepare_for_fallback（最多 2 轮）撤销 HBM 登记或停 Seed 服务时发生清理失败（batch_unregister_memory / finalize 未收净）。此时旧存储仍被保活且显存含半截脏权重，安全门拒绝 !(service_stopped && memory_reset) 下的静默回退与第二份模型分配，主动抛出明确 RuntimeError 中止启动，严防精度静默损坏与双份占卡 OOM。",
    reachedStage: 4,
    faultBadge: "脏缓冲清理失败",
    outcomeKind: "safety-abort",
    isFastSuccess: false,
    borrowStageStatus: "200 已领租约并进入分批读取",
    transferStageStatus: "第 k 批失败 · 前 k-1 批已写入半截脏缓冲",
    leaseStatus: "停续租并转后台归还；拒绝进入本地默认加载",
    dualGateStatus: "✗ 安全门阻断！2 轮清理未净（保活旧存储防静默损坏）",
    finalOutcome: "✗ 主动阻断带脏数据的静默回退，抛明确 RuntimeError",
    serviceAvailability: "服务中止启动 · 显式报错防精度损坏与双份 OOM",
  },
};

interface TopStageDef {
  readonly stage: 1 | 2 | 3 | 4;
  readonly x: number;
  readonly w: number;
  readonly title: string;
  readonly sub: string;
}

const TOP_STAGES: readonly TopStageDef[] = [
  { stage: 1, x: 20, w: 178, title: "1. 搭空位绑键", sub: "HBM 登记 + 结构摘要" },
  { stage: 2, x: 228, w: 186, title: "2. 问 Planner 借", sub: "200 领租约 / 404 未命中" },
  { stage: 3, x: 444, w: 194, title: "3. 五门核清单", sub: "核名称/形状/格式/字节" },
  { stage: 4, x: 668, w: 192, title: "4. HCCS/RDMA 读", sub: "≤1GiB/512段零拷贝直灌" },
];

function ctrlBtnStyle(pressed: boolean) {
  return pressed
    ? { background: "#17211f", borderColor: "#17211f", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
}

function stepBtnStyle(active: boolean) {
  return active
    ? { background: "#087f73", borderColor: "#087f73", color: "#ffffff" }
    : { background: "#ffffff", borderColor: "#d8d8cf", color: "#17211f" };
}

function stageAppearance(stage: 1 | 2 | 3 | 4, spec: RforkScenarioSpec) {
  if (spec.outcomeKind === "p2p-ok") {
    return stage === 4
      ? { fill: "#f7e7f2", stroke: "#9a4b86", width: "2", ink: "#17211f", sub: "#9a4b86" }
      : { fill: "#ddf4ef", stroke: "#087f73", width: "1.6", ink: "#17211f", sub: "#087f73" };
  }
  if (spec.outcomeKind === "p2p-lease-warn") {
    return stage === 4
      ? { fill: "#fff4cf", stroke: "#c78300", width: "2", ink: "#17211f", sub: "#c78300" }
      : { fill: "#ddf4ef", stroke: "#087f73", width: "1.6", ink: "#17211f", sub: "#087f73" };
  }
  if (stage < spec.reachedStage) {
    return { fill: "#ddf4ef", stroke: "#087f73", width: "1.5", ink: "#17211f", sub: "#66716d" };
  }
  if (stage === spec.reachedStage) {
    return { fill: "#fff0e9", stroke: "#b54237", width: "2.2", ink: "#b54237", sub: "#b54237" };
  }
  return { fill: "#ece9df", stroke: "#d8d8cf", width: "1.2", ink: "#66716d", sub: "#66716d" };
}

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
  initialMode = "svg",
  initialScenario = "hit-seed",
}: RforkFallbackInteractiveProps) {
  const [mode, setMode] = useState<RforkDiagramMode>(initialMode);
  const [scenario, setScenario] = useState<RforkScenarioId>(initialScenario);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const html = useMemo(() => ({ __html: safeSvg }), [safeSvg]);
  const spec = RFORK_SCENARIO_SPECS[scenario];
  const mTeal = `${id}-${uid}-rf-teal`;
  const mRed = `${id}-${uid}-rf-red`;
  const mAmber = `${id}-${uid}-rf-amber`;
  const mMuted = `${id}-${uid}-rf-muted`;

  const selectScenario = (next: RforkScenarioId) => {
    setMode("sandbox");
    setScenario(next);
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

  const faultOriginX = spec.reachedStage === 2 ? 321 : spec.reachedStage === 3 ? 541 : 736;

  return (
    <div
      className="wiki-diagram-interactive"
      data-testid="interactive-diagram-root"
      data-diagram-id={id}
      data-mode={mode}
      data-scenario={scenario}
    >
      <div
        className="wiki-diagram-toolbar"
        role="toolbar"
        aria-label="RFork 跨实例零拷贝权重借用与容灾状态机控制"
        onKeyDown={handleKeyDown}
      >
        <fieldset className="wiki-diagram-mode-switch" aria-label="视图模式">
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-svg"
            aria-pressed={mode === "svg"}
            style={ctrlBtnStyle(mode === "svg")}
            onClick={() => setMode("svg")}
          >
            还原原版静态图
          </button>
          <button
            type="button"
            className="wiki-diagram-ctrl-btn"
            data-testid="diagram-mode-sandbox"
            aria-pressed={mode === "sandbox"}
            style={ctrlBtnStyle(mode === "sandbox")}
            onClick={() => setMode("sandbox")}
          >
            切换交互沙盘 · 亲手试一试
          </button>
        </fieldset>

        <fieldset className="wiki-diagram-step-group" aria-label="RFork 五种现场状态切换">
          {RFORK_SCENARIOS.map((scId) => {
            const item = RFORK_SCENARIO_SPECS[scId];
            const active = mode === "sandbox" && scenario === scId;
            return (
              <button
                key={scId}
                type="button"
                className="wiki-diagram-step-btn"
                data-testid={`rfork-scenario-${scId}`}
                aria-pressed={active}
                aria-current={active ? "step" : undefined}
                style={stepBtnStyle(active)}
                onClick={() => selectScenario(scId)}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </fieldset>
      </div>

      <div className="wiki-diagram-canvas">
        {mode === "svg" ? (
          <div
            key="svg"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: safeSvg 已由共用 sanitizeDiagram 白名单清洗并按实例隔离内部 id
            dangerouslySetInnerHTML={html}
          />
        ) : (
          <div
            key="sandbox"
            className="wiki-diagram-svg"
            ref={scrollRef}
            onScroll={onScroll}
            {...(scrollable ? { tabIndex: 0, role: "group", "aria-label": caption || id } : {})}
          >
            <svg
              viewBox="0 0 880 412"
              width="880"
              height="412"
              role="img"
              aria-label={`RFork 容灾状态机沙盘：${spec.title}`}
              fontFamily="var(--font-sans)"
            >
              <title>{spec.title}</title>
              <defs>
                <marker
                  id={mTeal}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
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
                  orient="auto-start-reverse"
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
                  orient="auto-start-reverse"
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
                  orient="auto-start-reverse"
                >
                  <path d="M0,1 L9,5 L0,9 z" fill="#d8d8cf" />
                </marker>
              </defs>

              <text x="20" y="26" fontSize="14.5" fontWeight="700" fill="#17211f">
                RFork 借用 → 传输 → 校验/清理安全门 → 归还与服务可用性状态机（点上方按钮注入故障）
              </text>

              {/* Top 4 Mainline Stages */}
              {TOP_STAGES.map((st, idx) => {
                const a = stageAppearance(st.stage, spec);
                const nextActive = spec.isFastSuccess || st.stage < spec.reachedStage;
                return (
                  <g key={st.stage}>
                    <rect
                      x={st.x}
                      y="44"
                      width={st.w}
                      height="68"
                      rx="8"
                      fill={a.fill}
                      stroke={a.stroke}
                      strokeWidth={a.width}
                    />
                    <text
                      x={st.x + st.w / 2}
                      y="71"
                      textAnchor="middle"
                      fontSize="13.5"
                      fontWeight="700"
                      fill={a.ink}
                    >
                      {st.title}
                    </text>
                    <text x={st.x + st.w / 2} y="94" textAnchor="middle" fontSize="12" fill={a.sub}>
                      {st.sub}
                    </text>
                    {idx < 3 && (
                      <line
                        x1={st.x + st.w}
                        y1="78"
                        x2={TOP_STAGES[idx + 1]!.x - 2}
                        y2="78"
                        stroke={nextActive ? "#087f73" : "#d8d8cf"}
                        strokeWidth={nextActive ? "2" : "1.4"}
                        markerEnd={`url(#${nextActive ? mTeal : mMuted})`}
                      />
                    )}
                  </g>
                );
              })}

              {/* Branch Connectors in Corridor y=112..164 */}
              {spec.isFastSuccess ? (
                <>
                  <path
                    d="M764 112 L764 162"
                    fill="none"
                    stroke={spec.outcomeKind === "p2p-lease-warn" ? "#c78300" : "#087f73"}
                    strokeWidth="2.4"
                    markerEnd={`url(#${spec.outcomeKind === "p2p-lease-warn" ? mAmber : mTeal})`}
                  />
                  {spec.faultBadge && (
                    <g>
                      <rect x="668" y="122" width="184" height="22" rx="11" fill="#c78300" />
                      <text x="760" y="137" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">
                        {spec.faultBadge}
                      </text>
                    </g>
                  )}
                </>
              ) : (
                <>
                  <path
                    d={`M${faultOriginX} 112 L${faultOriginX} 138 L248 138 L248 162`}
                    fill="none"
                    stroke="#b54237"
                    strokeWidth="2.4"
                    markerEnd={`url(#${mRed})`}
                  />
                  {spec.faultBadge && (
                    <g>
                      <rect x={faultOriginX - 88} y="122" width="176" height="22" rx="11" fill="#b54237" />
                      <text
                        x={faultOriginX}
                        y="137"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        {spec.faultBadge}
                      </text>
                    </g>
                  )}
                </>
              )}

              {/* Middle Row Left: Strict Dual-Gate Cleanup Box */}
              <rect
                x="20"
                y="166"
                width="456"
                height="86"
                rx="10"
                fill={
                  spec.outcomeKind === "safety-abort" ? "#fff0e9" : spec.isFastSuccess ? "#ece9df" : "#fff4cf"
                }
                stroke={
                  spec.outcomeKind === "safety-abort" ? "#b54237" : spec.isFastSuccess ? "#d8d8cf" : "#c78300"
                }
                strokeWidth={spec.isFastSuccess ? "1.2" : "2.2"}
              />
              <text
                x="36"
                y="192"
                fontSize="14"
                fontWeight="700"
                fill={
                  spec.outcomeKind === "safety-abort" ? "#b54237" : spec.isFastSuccess ? "#66716d" : "#17211f"
                }
              >
                {spec.outcomeKind === "safety-abort"
                  ? "✗ 清理安全门阻断（prepare_for_fallback 2 轮失败）"
                  : "容灾清理与严格双门检查（prepare_for_fallback）"}
              </text>
              <text
                x="36"
                y="215"
                fontSize="12.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                fill={
                  spec.outcomeKind === "safety-abort" ? "#b54237" : spec.isFastSuccess ? "#66716d" : "#c78300"
                }
              >
                {spec.outcomeKind === "safety-abort"
                  ? "!(service_stopped && memory_reset) → 保活旧存储"
                  : "service_stopped && memory_reset（最多重试 2 轮）"}
              </text>
              <text x="36" y="237" fontSize="12" fill="#66716d">
                {spec.outcomeKind === "safety-abort"
                  ? "脏缓冲未清净：拒绝静默回退与分配第二份模型，严防精度静默损坏"
                  : "停续租 · 后台还租约 · 注销 HBM 预登记，严防两份权重同卡 OOM"}
              </text>

              {/* Middle Row Right: Fast P2P Success / Lease Reject 400 Box */}
              <rect
                x="512"
                y="166"
                width="348"
                height="86"
                rx="10"
                fill={
                  spec.outcomeKind === "p2p-ok"
                    ? "#ddf4ef"
                    : spec.outcomeKind === "p2p-lease-warn"
                      ? "#fff4cf"
                      : "#ece9df"
                }
                stroke={
                  spec.outcomeKind === "p2p-ok"
                    ? "#087f73"
                    : spec.outcomeKind === "p2p-lease-warn"
                      ? "#c78300"
                      : "#d8d8cf"
                }
                strokeWidth={spec.isFastSuccess ? "2.2" : "1.2"}
              />
              <text
                x="528"
                y="192"
                fontSize="14"
                fontWeight="700"
                fill={
                  spec.outcomeKind === "p2p-ok"
                    ? "#087f73"
                    : spec.outcomeKind === "p2p-lease-warn"
                      ? "#c78300"
                      : "#66716d"
                }
              >
                {spec.outcomeKind === "p2p-lease-warn"
                  ? "✓ 权重本地就绪 · 推理服务仍正常可用"
                  : "✓ P2P 零拷贝快载成功 · 立即对外服务"}
              </text>
              <text x="528" y="215" fontSize="12" fill={spec.isFastSuccess ? "#17211f" : "#66716d"}>
                {spec.outcomeKind === "p2p-lease-warn"
                  ? "主线已完成 eval() 交回模型，不触发回退或重读磁盘"
                  : "主线程不等还租网络：eval() + 尝试发布 Seed 后交回模型"}
              </text>
              <text
                x="528"
                y="237"
                fontSize="12"
                fill={
                  spec.outcomeKind === "p2p-lease-warn"
                    ? "#b54237"
                    : spec.outcomeKind === "p2p-ok"
                      ? "#9a4b86"
                      : "#66716d"
                }
              >
                {spec.outcomeKind === "p2p-lease-warn"
                  ? "归还收 400 REJECTED / TTL 告警：停试并放弃发布为 Seed"
                  : "后台还租；已确认即刻注册 Seed，未确认记 DEFERRED"}
              </text>

              {/* Arrow from Dual-Gate to Local Safetensors Fallback / Abort */}
              <path
                d="M476 210 L494 210 L494 334 L508 334"
                fill="none"
                stroke={
                  spec.outcomeKind === "safety-abort" ? "#b54237" : spec.isFastSuccess ? "#d8d8cf" : "#c78300"
                }
                strokeWidth={spec.isFastSuccess ? "1.4" : "2.2"}
                strokeDasharray={spec.outcomeKind === "safety-abort" ? "4 3" : undefined}
                markerEnd={`url(#${
                  spec.outcomeKind === "safety-abort" ? mRed : spec.isFastSuccess ? mMuted : mAmber
                })`}
              />

              {/* Bottom Row Left: 4-Stage Status Readout */}
              <rect
                x="20"
                y="272"
                width="456"
                height="124"
                rx="10"
                fill="#fbfaf6"
                stroke="#4c65b6"
                strokeWidth="1.5"
              />
              <text x="36" y="295" fontSize="13.5" fontWeight="700" fill="#4c65b6">
                四阶段状态账本（借用 → 传输 → 校验/清理安全门 → 归还）
              </text>
              <text x="36" y="317" fontSize="12" fill="#17211f">
                {`①② 借用：${spec.borrowStageStatus}`}
              </text>
              <text x="36" y="338" fontSize="12" fill="#17211f">
                {`③④ 传输：${spec.transferStageStatus}`}
              </text>
              <text
                x="36"
                y="359"
                fontSize="12"
                fill={spec.outcomeKind === "safety-abort" ? "#b54237" : "#17211f"}
              >
                {`安全门：${spec.dualGateStatus}`}
              </text>
              <text x="36" y="380" fontSize="12" fill="#17211f">
                {`归还：${spec.leaseStatus}`}
              </text>

              {/* Bottom Row Right: Local Disk Safetensors Safe Fallback / Safety Abort */}
              <rect
                x="512"
                y="272"
                width="348"
                height="124"
                rx="10"
                fill={
                  spec.outcomeKind === "safety-abort"
                    ? "#fff0e9"
                    : spec.outcomeKind === "fallback-ok"
                      ? "#ddf4ef"
                      : "#ece9df"
                }
                stroke={
                  spec.outcomeKind === "safety-abort"
                    ? "#b54237"
                    : spec.outcomeKind === "fallback-ok"
                      ? "#087f73"
                      : "#d8d8cf"
                }
                strokeWidth={
                  spec.outcomeKind === "fallback-ok" || spec.outcomeKind === "safety-abort" ? "2.2" : "1.2"
                }
              />
              <text
                x="528"
                y="296"
                fontSize="13.5"
                fontWeight="700"
                fill={
                  spec.outcomeKind === "safety-abort"
                    ? "#b54237"
                    : spec.outcomeKind === "fallback-ok"
                      ? "#087f73"
                      : "#66716d"
                }
              >
                {spec.outcomeKind === "safety-abort"
                  ? "✗ 安全门阻断回退：抛明确 RuntimeError"
                  : spec.outcomeKind === "fallback-ok"
                    ? "✓ 安全降级：本地磁盘 Safetensors 默认加载"
                    : "本地磁盘 Safetensors 回退路径（未触发）"}
              </text>
              <text x="528" y="321" fontSize="12" fill={spec.isFastSuccess ? "#66716d" : "#17211f"}>
                {spec.outcomeKind === "safety-abort"
                  ? "拒绝静默回退本地 Safetensors 加载，严防分配第二份模型"
                  : spec.outcomeKind === "fallback-ok"
                    ? "恢复全局登记表 + GC 清缓存 → 读存储权重并后处理"
                    : "本次直灌已在显存就绪，无须再读本地磁盘权重"}
              </text>
              <text x="528" y="344" fontSize="12" fill="#66716d">
                {spec.finalOutcome}
              </text>
              <text
                x="528"
                y="376"
                fontSize="12.5"
                fontWeight="700"
                fill={spec.outcomeKind === "safety-abort" ? "#b54237" : "#087f73"}
              >
                {`最终可用性：${spec.serviceAvailability}`}
              </text>
            </svg>
          </div>
        )}
      </div>

      <output className="wiki-diagram-step-readout" data-testid="diagram-step-readout" aria-live="polite">
        {mode === "sandbox" ? (
          <>
            <span className="wiki-diagram-step-tag">
              {spec.outcomeKind === "p2p-ok"
                ? "P2P 直灌命中"
                : spec.outcomeKind === "p2p-lease-warn"
                  ? "推理可用 · 归还告警"
                  : spec.outcomeKind === "safety-abort"
                    ? "安全门阻断回退"
                    : "双门容灾降级"}
            </span>
            <strong className="wiki-diagram-step-title">{spec.title}</strong>
            <span className="wiki-diagram-step-detail">{spec.detail}</span>
          </>
        ) : (
          <span className="wiki-diagram-step-overview-hint">
            当前展示审定原图；点击上方「切换交互沙盘 · 亲手试一试」或 ①–⑤ 现场按钮，观察正常直灌、404
            未命中、Seed 失联回退、归还 400/TTL 告警（推理仍可用）与脏缓冲清理失败阻断。
          </span>
        )}
      </output>
    </div>
  );
}
