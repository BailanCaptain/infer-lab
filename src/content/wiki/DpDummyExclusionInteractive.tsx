import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { type EduBadgeTone, WikiEduSandboxShell } from "./WikiEduSandboxShell";

function tokenBtnStyle(active: boolean, kind: "dark" | "teal" = "teal") {
  if (!active) {
    return {
      background: "var(--color-surface-elevated)",
      borderColor: "var(--color-line)",
      color: "var(--color-ink)",
    } as const;
  }
  const bg = kind === "dark" ? "var(--color-ink)" : "var(--color-token)";
  return {
    background: bg,
    borderColor: bg,
    color: "var(--color-ink-inverse)",
  } as const;
}

export const DP_DUMMY_EXCLUSION_APPROVED_SHA256 =
  "cef3c4e9a19555a84a0ed5511f335d83cd7aa317c117adeadd0259fba286c0cf";
export const DP_FIG_DUMMY_AND_EXCLUSION_APPROVED_SHA256 = DP_DUMMY_EXCLUSION_APPROVED_SHA256;

export const DP_ARCH_MODES = ["dense-dp2", "moe-dp2", "roce-pp-dp-ban"] as const;
export type DpArchMode = (typeof DP_ARCH_MODES)[number];

export const DP_WORKLOAD_MODES = ["balanced-3-2", "skewed-4-0"] as const;
export type DpWorkloadMode = (typeof DP_WORKLOAD_MODES)[number];

export const DP_WAVE_STEPS = [1, 2, 3, 4] as const;
export type DpWaveStep = (typeof DP_WAVE_STEPS)[number];

export const DP_EXEC_PATHS = ["aclgraph-or-mc2", "eager-alltoall"] as const;
export type DpExecPath = (typeof DP_EXEC_PATHS)[number];

export type DpRoceSafeFix = "none" | "pp1-dp2-ep" | "dp1-pp2";
export type DpSandboxMode = "sandbox" | "svg";

export const DP_STEP_LABELS: Readonly<
  Record<DpWaveStep, { readonly shortBtn: string; readonly fullTitle: string }>
> = {
  1: { shortBtn: "① 唤醒", fullTitle: "① 队列感知与唤醒同组" },
  2: { shortBtn: "② 排批", fullTitle: "② 批次构造与宽度对齐" },
  3: { shortBtn: "③ 互算", fullTitle: "③ 前向计算与跨组互算" },
  4: { shortBtn: "④ 收尾", fullTitle: "④ 输出收尾与停机核对" },
};

export interface DpInteractiveSnapshot {
  readonly mode: DpSandboxMode;
  readonly step: DpWaveStep;
  readonly playing: boolean;
}

export function advanceDpStepTick(state: DpInteractiveSnapshot): DpInteractiveSnapshot {
  if (!state.playing || state.mode !== "sandbox") return state;
  if (state.step >= 4) return { ...state, step: 4, playing: false };
  const next = (state.step + 1) as DpWaveStep;
  return { ...state, step: next, playing: next < 4 };
}

export interface DpGroupLaneState {
  readonly groupLabel: string;
  readonly realTokens: number;
  readonly dummyTokens: number;
  readonly alignedWidth: number;
  readonly statusPill: string;
  readonly boxTitle: string;
  readonly boxSub1: string;
  readonly boxSub2: string;
  readonly bgHex: string;
  readonly borderHex: string;
}

export interface DpSandboxComputedState {
  readonly archMode: DpArchMode;
  readonly effectiveArch: "dense-dp2" | "moe-dp2" | "roce-hang" | "roce-dp1-pp2";
  readonly workload: DpWorkloadMode;
  readonly step: DpWaveStep;
  readonly roceSafeFix: DpRoceSafeFix;
  readonly execPath: DpExecPath;
  readonly dp0Real: number;
  readonly dp1Real: number;
  readonly isDp1Idle: boolean;
  readonly requiresDummyEscort: boolean;
  readonly isDeadlocked: boolean;
  readonly numTokensAcrossDp: readonly [number, number];
  readonly numTokensAfterPadding: readonly [number, number];
  readonly isWidthPadded: boolean;
  readonly alignedStepWidth: number;
  readonly dpMetadataBytes: number;
  readonly dpSyncInterval: 16;
  readonly dpHcclMinMiB: 50;
  readonly shortStepBtns: readonly [string, string, string, string];
  readonly canvasHeading: string;
  readonly widthPillText: string;
  readonly group0: DpGroupLaneState;
  readonly group1: DpGroupLaneState;
  readonly centerBridgeTitle: string;
  readonly centerBridgeSub: string;
  readonly centerBridgeRule: string;
  readonly centerBridgeFoot: string;
  readonly centerBridgeTone: "idle" | "comm" | "danger" | "good";
  readonly outputTitle: string;
  readonly outputLine1: string;
  readonly outputLine2: string;
  readonly outputLine3: string;
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly takeaway: string;
  readonly kpi: string;
  readonly detailTitle: string;
  readonly detailBody: string;
}

export function computeDpSandboxState(
  archMode: DpArchMode = "moe-dp2",
  workload: DpWorkloadMode = "skewed-4-0",
  step: DpWaveStep = 2,
  roceSafeFix: DpRoceSafeFix = "none",
  execPath: DpExecPath = "aclgraph-or-mc2",
): DpSandboxComputedState {
  const dp0Real = workload === "balanced-3-2" ? 3 : 4;
  const dp1Real = workload === "balanced-3-2" ? 2 : 0;
  const isDp1Idle = dp1Real === 0;

  const effectiveArch: DpSandboxComputedState["effectiveArch"] =
    archMode === "roce-pp-dp-ban"
      ? roceSafeFix === "pp1-dp2-ep"
        ? "moe-dp2"
        : roceSafeFix === "dp1-pp2"
          ? "roce-dp1-pp2"
          : "roce-hang"
      : archMode;

  if (effectiveArch === "dense-dp2") {
    const alignedStepWidth = dp0Real;
    const shortStepBtns = ["① 各自收批", "② 保留原宽", "③ 独立前向", "④ 算完直回"] as const;
    const stepMeta = {
      1: {
        badge: "稠密 DP=2 · 步骤 1 / 4 · 独立副本无波次广播",
        tone: "default" as EduBadgeTone,
        heading: "① 稠密模型各自收批，空闲组阻塞待机",
        takeaway: isDp1Idle
          ? "稠密模型两副本完全独立：DP0 收到 4 词直接开工，空闲的 DP1 停在输入队列上真正休眠，无需全组波次广播。"
          : "稠密模型双副本各自接收请求（DP0=3, DP1=2），无需跨组同步启动。",
        kpi: isDp1Idle ? "DP0=4 运行 · DP1=0 真休眠" : "DP0=3 · DP1=2 独立推进",
      },
      2: {
        badge: "稠密 DP=2 · 步骤 2 / 4 · 零假词、零宽度对齐",
        tone: "default" as EduBadgeTone,
        heading: "② 保持各自真实宽度，零陪跑",
        takeaway: isDp1Idle
          ? "DP0 独立排入 4 词批次；DP1 因无请求直接跳过前向（0 假词陪跑、0 跨组同步）。"
          : "DP0 排 3 词、DP1 排 2 词，各自保持原宽互不补齐。",
        kpi: isDp1Idle ? "DP1 零假词陪跑" : "保持原宽 [3, 2]",
      },
      3: {
        badge: "稠密 DP=2 · 步骤 3 / 4 · 各持全量权重零跨组通信",
        tone: "accent" as EduBadgeTone,
        heading: "③ 各持全量权重，零跨组专家互算",
        takeaway: "每组各自常驻整份稠密权重，前向没有任何跨数据并行组通信；DP1 休眠绝不会卡住 DP0。",
        kpi: "跨 DP 集合通信 = 0 次",
      },
      4: {
        badge: "稠密 DP=2 · 步骤 4 / 4 · 算完直回服务端",
        tone: "accent" as EduBadgeTone,
        heading: "④ 各自产出真词，队列空即自然待机",
        takeaway: "各副本算完新词后直接送回服务端，无假词丢弃，也无需每 16 步停机核对。",
        kpi: "零同步税 · 等价双独立实例",
      },
    }[step];

    return {
      archMode,
      effectiveArch,
      workload,
      step,
      roceSafeFix,
      execPath,
      dp0Real,
      dp1Real,
      isDp1Idle,
      requiresDummyEscort: false,
      isDeadlocked: false,
      numTokensAcrossDp: [dp0Real, dp1Real],
      numTokensAfterPadding: [dp0Real, dp1Real],
      isWidthPadded: false,
      alignedStepWidth,
      dpMetadataBytes: 0,
      dpSyncInterval: 16,
      dpHcclMinMiB: 50,
      shortStepBtns,
      canvasHeading: stepMeta.heading,
      widthPillText: `各自宽度 = [${dp0Real}, ${dp1Real}]`,
      group0: {
        groupLabel: "DP0 独立副本",
        realTokens: dp0Real,
        dummyTokens: 0,
        alignedWidth: dp0Real,
        statusPill: `真实批 ${dp0Real} 词`,
        boxTitle: `DP0 真实前向 (${dp0Real} 词)`,
        boxSub1: "独立调度器 + 独立缓存池",
        boxSub2: step >= 4 ? "输出真实新词回服务端" : "自持完整权重独立算",
        bgHex: "var(--color-token-soft)",
        borderHex: "var(--color-token)",
      },
      group1: {
        groupLabel: "DP1 独立副本",
        realTokens: dp1Real,
        dummyTokens: 0,
        alignedWidth: dp1Real,
        statusPill: isDp1Idle ? "真休眠" : `真实批 ${dp1Real} 词`,
        boxTitle: isDp1Idle ? "DP1 真休眠" : `DP1 真实前向 (${dp1Real} 词)`,
        boxSub1: isDp1Idle ? "无活不进模型前向" : "保持原宽不补齐",
        boxSub2: isDp1Idle ? "0 假词 · 0 算力消耗" : "各自回传互不等待",
        bgHex: isDp1Idle ? "var(--color-surface-sunken)" : "var(--color-token-soft)",
        borderHex: isDp1Idle ? "var(--color-control)" : "var(--color-token)",
      },
      centerBridgeTitle: "组间完全隔离",
      centerBridgeSub: "0 跨组通信 · 互不等待",
      centerBridgeRule: "各组自持完整模型",
      centerBridgeFoot: "零跨 DP 死锁风险",
      centerBridgeTone: "idle",
      outputTitle: "④ 各自算完直回服务端",
      outputLine1: isDp1Idle ? "DP0 提交真词 · DP1 静默" : "各自提交真实新词",
      outputLine2: "队列清空即自然待机",
      outputLine3: "无跨组尾段空转",
      takeawayBadge: stepMeta.badge,
      takeawayTone: stepMeta.tone,
      takeaway: stepMeta.takeaway,
      kpi: stepMeta.kpi,
      detailTitle: "稠密 DP=2 · reconfigure_for_independent_dp_rank 隔离机制",
      detailBody:
        "非 MoE 模型启动时将各组内部 dp_size 与 dp_size_local 重设为 1，采用普通 EngineCoreProc 运行：每组拥有全量权重副本与独立物理 KV 池，空闲组阻塞在输入队列上零空转。",
    };
  }

  if (effectiveArch === "roce-dp1-pp2") {
    const totalBatch = dp0Real + dp1Real;
    const shortStepBtns = ["① 单组收批", "② 进前半段", "③ 跨机交接", "④ 尾段返回"] as const;
    return {
      archMode,
      effectiveArch,
      workload,
      step,
      roceSafeFix,
      execPath,
      dp0Real: totalBatch,
      dp1Real: 0,
      isDp1Idle: false,
      requiresDummyEscort: false,
      isDeadlocked: false,
      numTokensAcrossDp: [totalBatch, 0],
      numTokensAfterPadding: [totalBatch, 0],
      isWidthPadded: false,
      alignedStepWidth: totalBatch,
      dpMetadataBytes: 0,
      dpSyncInterval: 16,
      dpHcclMinMiB: 50,
      shortStepBtns,
      canvasHeading: `①~④ 保留流水并行（DP=1, PP=2）：同一微批 ${totalBatch} 词依次经过两段`,
      widthPillText: `同一微批 ${totalBatch} 词 · 两段接力`,
      group0: {
        groupLabel: "Stage 0 (节点 0 · DP=1)",
        realTokens: totalBatch,
        dummyTokens: 0,
        alignedWidth: totalBatch,
        statusPill: `微批 ${totalBatch} 词`,
        boxTitle: `节点0 Stage 0 (${totalBatch}词)`,
        boxSub1: "前半层计算 + 机内专家",
        boxSub2: "跨机点对点发激活至 Stage 1",
        bgHex: "var(--color-token-soft)",
        borderHex: "var(--color-token)",
      },
      group1: {
        groupLabel: "Stage 1 (节点 1 · DP=1)",
        realTokens: totalBatch,
        dummyTokens: 0,
        alignedWidth: totalBatch,
        statusPill: "PP=2 接力正常",
        boxTitle: `节点1 Stage 1 (${totalBatch}词)`,
        boxSub1: "后半层计算 + 收尾采样",
        boxSub2: "无跨机 DP×PP 派发冲突",
        bgHex: "var(--color-token-soft)",
        borderHex: "var(--color-token)",
      },
      centerBridgeTitle: "✓ 已切换：DP=1 · PP=2",
      centerBridgeSub: "同一微批跨机接力传递",
      centerBridgeRule: "单 DP 跨机点对点传递",
      centerBridgeFoot: "零跨组派发冲突",
      centerBridgeTone: "good",
      outputTitle: "④ 尾段采样直接返回",
      outputLine1: `全部 ${totalBatch} 词沿两段跑通`,
      outputLine2: "无假词陪跑 · 无波次停机",
      outputLine3: "安全消解跨机互斥",
      takeawayBadge: "安全处方生效 · 保留流水并行 DP=1, PP=2",
      takeawayTone: "default",
      takeaway: `跨机 RoCE 改为 DP=1、PP=2 后，同一微批（${totalBatch} 词）按流水线依次经过两段，不再触发跨组专家派发冲突！`,
      kpi: `安全拓扑 DP=1 · PP=2 (${totalBatch} 词)`,
      detailTitle: "跨机 RoCE 二选一安全处方 B：固定 DP=1、保留 PP=2",
      detailBody:
        "官方流水线指南明确跨机 RoCE 下 MoE 必须在 PP=1 与 DP=1 间二选一：需要层间切分装大模型时设 DP=1, PP>1；需要多队列吞吐时设 PP=1, DP>1 + EP。",
    };
  }

  if (effectiveArch === "roce-hang") {
    const dummy1 = isDp1Idle ? 1 : 0;
    const raw1 = dp1Real + dummy1;
    const aligned = Math.max(dp0Real, raw1);
    const padToMax = execPath === "aclgraph-or-mc2";
    const numTokensAcrossDp: readonly [number, number] = [dp0Real, raw1];
    const numTokensAfterPadding: readonly [number, number] = padToMax ? [aligned, aligned] : [dp0Real, raw1];
    const deadlockedNow = step >= 3;
    const shortStepBtns = ["① 未置拦截", "② 首步排批", "③ 派发挂死", "④ 阻塞须修"] as const;
    const stepMeta = {
      1: {
        badge: "跨机禁配 1 / 4 · 启动期零报错假象",
        tone: "warn" as EduBadgeTone,
        heading: "① 跨机叠开 PP>1 + DP>1，启动未拦截",
        takeaway: "跨机 RoCE 同时开启流水并行与数据并行部署 MoE 时，启动期没有前置拦截，服务看似正常就绪。",
        kpi: "⚠ 启动期 0 报错（埋雷态）",
      },
      2: {
        badge: "跨机禁配 2 / 4 · 首步排批进入前向",
        tone: "warn" as EduBadgeTone,
        heading: "② 经 16 B 元数据同步后踏入首层前向",
        takeaway: `两组经 16 B 元数据同步后（执行宽度 [${numTokensAfterPadding.join(", ")}]），无防备地进入第 1 层计算。`,
        kpi: `执行宽度 [${numTokensAfterPadding.join(", ")}]`,
      },
      3: {
        badge: "跨机禁配 3 / 4 · 首步跨机派发挂死",
        tone: "danger" as EduBadgeTone,
        heading: "③ 首层跨机专家派发算子挂死",
        takeaway: "进入第 1 个 MoE 层时，底层跨机专家派发不支持叠开 PP>1 与 DP>1，首步前向当场卡死或报错。",
        kpi: "✗ 首步跨机派发挂死",
      },
      4: {
        badge: "跨机禁配 4 / 4 · 服务卡死需应用二选一修复",
        tone: "danger" as EduBadgeTone,
        heading: "④ 阻塞无输出，请切换安全拓扑",
        takeaway: "第 ③ 步发生死锁，请求拿不到首字输出！请点下方按钮切为「保留数据并行」或「保留流水并行」。",
        kpi: "阻塞无输出 · 须二选一修复",
      },
    }[step];

    return {
      archMode,
      effectiveArch,
      workload,
      step,
      roceSafeFix,
      execPath,
      dp0Real,
      dp1Real,
      isDp1Idle,
      requiresDummyEscort: isDp1Idle,
      isDeadlocked: deadlockedNow,
      numTokensAcrossDp,
      numTokensAfterPadding,
      isWidthPadded: padToMax && dp0Real !== raw1,
      alignedStepWidth: aligned,
      dpMetadataBytes: 16,
      dpSyncInterval: 16,
      dpHcclMinMiB: 50,
      shortStepBtns,
      canvasHeading: stepMeta.heading,
      widthPillText: `执行宽度 = [${numTokensAfterPadding.join(", ")}]`,
      group0: {
        groupLabel: "跨机 DP0 × PP>1",
        realTokens: dp0Real,
        dummyTokens: 0,
        alignedWidth: numTokensAfterPadding[0],
        statusPill: deadlockedNow ? "✗ 首步挂死" : "⚠ 启动未拦",
        boxTitle: deadlockedNow ? "DP0 卡在专家派发" : `DP0 排批 (${dp0Real} 词)`,
        boxSub1: "跨机 RoCE + PP>1 + DP>1",
        boxSub2: deadlockedNow ? "等不到合法跨机路径" : "启动期校验未拦截",
        bgHex: "var(--color-accent-soft)",
        borderHex: "var(--color-danger)",
      },
      group1: {
        groupLabel: "跨机 DP1 × PP>1",
        realTokens: dp1Real,
        dummyTokens: dummy1,
        alignedWidth: numTokensAfterPadding[1],
        statusPill: deadlockedNow ? "✗ 同步挂死" : "⚠ 启动未拦",
        boxTitle: deadlockedNow
          ? "DP1 同步阻塞超时"
          : isDp1Idle
            ? "DP1 假词入场"
            : `DP1 排批 (${dp1Real} 词)`,
        boxSub1: "底层算子路径不支持",
        boxSub2: deadlockedNow ? "首步前向静默挂死" : "进首层即触发通信故障",
        bgHex: "var(--color-accent-soft)",
        borderHex: "var(--color-danger)",
      },
      centerBridgeTitle: deadlockedNow ? "✗ 跨机派发死锁" : "⚠ 启动无前置拦截",
      centerBridgeSub: "RoCE 禁叠开 PP>1 与 DP>1",
      centerBridgeRule: "跨机专家派发禁配",
      centerBridgeFoot: "启动无断言 · 首步挂死",
      centerBridgeTone: "danger",
      outputTitle: "✗ 阻断：无法产出首字",
      outputLine1: "卡死在第 ③ 步跨机通信",
      outputLine2: "请在下方点一键修复",
      outputLine3: "切至 PP=1 或 DP=1",
      takeawayBadge: stepMeta.badge,
      takeawayTone: stepMeta.tone,
      takeaway: stepMeta.takeaway,
      kpi: stepMeta.kpi,
      detailTitle: "跨机 RoCE MoE 禁配根因 · MoeDistributeDispatch 拓扑限制",
      detailBody:
        "vllm-ascend 流水线并行指南明确记载：跨节点 RoCE 部署 MoE 模型时，MoeDistributeDispatch 不支持同时开启 PP > 1 与 DP > 1，且 platform.py / ascend_config.py 未置前置断言，误配后进程能走完加载却在首步前向挂死。",
    };
  }

  const dummyTokens = isDp1Idle ? 1 : 0;
  const dp1StartWidth = dp1Real + dummyTokens;
  const alignedStepWidth = Math.max(dp0Real, dp1StartWidth);
  const padToMax = execPath === "aclgraph-or-mc2";
  const numTokensAcrossDp: readonly [number, number] = [dp0Real, dp1StartWidth];
  const numTokensAfterPadding: readonly [number, number] = padToMax
    ? [alignedStepWidth, alignedStepWidth]
    : [dp0Real, dp1StartWidth];
  const isWidthPadded = padToMax && dp0Real !== dp1StartWidth;
  const fixPrefix = roceSafeFix === "pp1-dp2-ep" ? "已切换 PP=1 · " : "";
  const shortStepBtns = [
    isDp1Idle ? "① 唤醒同组" : "① 同波启动",
    isDp1Idle ? "② 填入假词" : "② 同步宽度",
    "③ 专家互算",
    "④ 核对停机",
  ] as const;

  const stepMeta = {
    1: {
      badge: `${fixPrefix}MoE DP=2 · 步骤 1 / 4 · 唤醒同组`,
      tone: "default" as EduBadgeTone,
      heading: isDp1Idle ? "① 唤醒同组：叫醒空闲组防死锁" : "① 双组同波进入本轮",
      takeaway: isDp1Idle
        ? "DP0 收到 4 词而 DP1 为空：协调器立即向全组广播唤醒消息，把空闲的 DP1 叫醒准备陪跑防死锁。"
        : "协调器汇总双组队列（DP0=3 词、DP1=2 词），双组同步进入本轮计算。",
      kpi: isDp1Idle ? "全组唤醒 · DP1 准备陪跑" : "双组同波启动 (3 词 / 2 词)",
    },
    2: {
      badge: `${fixPrefix}MoE DP=2 · 步骤 2 / 4 · ${padToMax ? "16B 同步 + 补齐同宽" : "16B 同步 · 保持原宽"}`,
      tone: isDp1Idle ? ("warn" as EduBadgeTone) : ("default" as EduBadgeTone),
      heading: isDp1Idle
        ? padToMax
          ? "② 填入 1 词假输入并补齐至宽度 4"
          : "② 填入 1 词假输入，Eager 保持 [4, 1]"
        : padToMax
          ? `② 16 B 元数据同步并补齐至 [${numTokensAfterPadding.join(", ")}]`
          : `② 16 B 元数据同步，Eager 保持 [${numTokensAfterPadding.join(", ")}]`,
      takeaway: isDp1Idle
        ? padToMax
          ? "DP1 填入 1 词假输入，经 16 B 元数据同步后，图路径要求统一宽度，执行宽度从 [4, 1] 补齐到 [4, 4]。"
          : "DP1 仍必须填入 1 词假输入并同步 16 B 元数据，但 Eager 路径直接保持执行宽度 [4, 1] 不补宽。"
        : padToMax
          ? `两组经 16 B 元数据同步后取最大值，执行宽度从 [${numTokensAcrossDp.join(", ")}] 补齐到 [${numTokensAfterPadding.join(", ")}]。`
          : `两组经 16 B 元数据同步后，Eager 路径保持各自真实宽度 [${numTokensAfterPadding.join(", ")}]。`,
      kpi: `执行宽度 [${numTokensAfterPadding.join(", ")}] · 元数据 16B`,
    },
    3: {
      badge: `${fixPrefix}MoE DP=2 · 步骤 3 / 4 · 专家互算`,
      tone: "accent" as EduBadgeTone,
      heading: "③ 跨组专家互算，全员到齐才不会卡死",
      takeaway: isDp1Idle
        ? `路由专家跨组只存一份：DP1 靠假词陪跑准时到场参加专家通信（执行宽 [${numTokensAfterPadding.join(", ")}]），替 DP0 算完专家防死锁。`
        : `两组全员到齐参与每层跨组专家通信（执行宽 [${numTokensAfterPadding.join(", ")}]），互算对方命中的专家权重。`,
      kpi: isDp1Idle ? `DP1 陪跑宽 ${numTokensAfterPadding[1]} 防死锁` : "全员参与跨组专家互算",
    },
    4: {
      badge: `${fixPrefix}MoE DP=2 · 步骤 4 / 4 · 丢弃假词与核对停机`,
      tone: "accent" as EduBadgeTone,
      heading: "④ 丢弃假词输出，按每 16 步节拍核对停机",
      takeaway: isDp1Idle
        ? "DP0 提交 4 个真实新词；DP1 的假词输出直接丢弃，并在第 1 步及每 16 步核对全组是否可停机。"
        : "两组各自回传真实输出，并在第 1 步及每 16 步核对全组是否可停机。",
      kpi: isDp1Idle ? "丢弃假输出 · 第1步/每16步核停机" : "第1步/每16步核对停机",
    },
  }[step];

  return {
    archMode,
    effectiveArch,
    workload,
    step,
    roceSafeFix,
    execPath,
    dp0Real,
    dp1Real,
    isDp1Idle,
    requiresDummyEscort: isDp1Idle,
    isDeadlocked: false,
    numTokensAcrossDp,
    numTokensAfterPadding,
    isWidthPadded,
    alignedStepWidth,
    dpMetadataBytes: 16,
    dpSyncInterval: 16,
    dpHcclMinMiB: 50,
    shortStepBtns,
    canvasHeading: stepMeta.heading,
    widthPillText: `执行宽度 = [${numTokensAfterPadding.join(", ")}]`,
    group0: {
      groupLabel: "MoE DP0 执行组",
      realTokens: dp0Real,
      dummyTokens: 0,
      alignedWidth: numTokensAfterPadding[0],
      statusPill: `真实批 ${dp0Real} 词`,
      boxTitle: `DP0 真实请求 (${dp0Real} 词)`,
      boxSub1: `执行宽 = ${numTokensAfterPadding[0]} · 元数据 16B`,
      boxSub2: step >= 4 ? "收齐专家结果输出新词" : "部分专家落在 DP1 卡上",
      bgHex: "var(--color-token-soft)",
      borderHex: "var(--color-token)",
    },
    group1: {
      groupLabel: "MoE DP1 执行组",
      realTokens: dp1Real,
      dummyTokens,
      alignedWidth: numTokensAfterPadding[1],
      statusPill: isDp1Idle ? "假词陪跑" : `真实批 ${dp1Real} 词`,
      boxTitle: isDp1Idle ? "DP1 假词陪跑" : `DP1 真实请求 (${dp1Real} 词)`,
      boxSub1: isDp1Idle
        ? padToMax
          ? `假输入 1 词 → 补齐宽 ${numTokensAfterPadding[1]}`
          : "假输入 1 词 · Eager 宽 1"
        : padToMax
          ? `从 ${dp1Real} 补齐至 ${numTokensAfterPadding[1]}`
          : `保持原宽 ${dp1Real} 词`,
      boxSub2: step >= 4 && isDp1Idle ? "丢弃假词 · 第1/16步核停" : "替 DP0 算本卡驻留专家",
      bgHex: isDp1Idle ? "var(--color-weight-soft)" : "var(--color-token-soft)",
      borderHex: isDp1Idle ? "var(--color-weight)" : "var(--color-token)",
    },
    centerBridgeTitle: isDp1Idle ? "跨组专家互算" : "跨组对齐 + 专家互算",
    centerBridgeSub: padToMax
      ? `宽度补齐 [${numTokensAfterPadding.join(", ")}]`
      : `保持原宽 [${numTokensAfterPadding.join(", ")}]`,
    centerBridgeRule: "缺任一组到场即死锁",
    centerBridgeFoot: "元数据 16B · 缓冲下限 50 MiB",
    centerBridgeTone: "comm",
    outputTitle: "④ 丢弃假词与核对停机",
    outputLine1: isDp1Idle ? "DP0 交真词 · DP1 丢弃假词" : "两组均提交真实新词",
    outputLine2: "第1步及每 16 步核停机",
    outputLine3: isDp1Idle ? "假词输出不污染状态" : "尾段最多空跑 15 步",
    takeawayBadge: stepMeta.badge,
    takeawayTone: stepMeta.tone,
    takeaway: stepMeta.takeaway,
    kpi: stepMeta.kpi,
    detailTitle: "MoE DP=2 · DPEngineCoreProc 陪跑、16 B 元数据同步与补齐分支",
    detailBody:
      "触发陪跑的是 MoE 本身而非 EP（--enable-expert-parallel）：开了 EP 时专家整份跨组分布，不开 EP 时 FusedMoE 按 DP×TP 展平切片摊到全部卡。worker.py#L1278 的 execute_dummy_batch 从 uniform_decode_query_len（非投机为 1，MTP 等草拟为 1+草拟词数）起步并传 skip_gdn_state_update=True。常规一体式 MoE 前向前 _sync_metadata_across_dp（model_runner_v1.py#L842-L881）必先对 (2, DP) int32 = 8×DP B（DP=2 为 16 B）元数据做 CPU All-Reduce（仅 PD 分离 KV 接收端满足条件时可跳过）；仅在开启 ACLGraph、草拟模型、MC2/AllGather 或细粒度 TP 时补齐到最大宽度，而 Eager ALLTOALL 路径 num_tokens_after_padding 保持 [4, 1]（均衡时 [3, 2]）。DP 组 HCCL 缓冲下限 50 MiB，v0.30.0 默认在第 1 步及每 dp_sync_interval=16 步调 sync_dp_state 熄灭 engines_running。",
  };
}

export interface DpDummyExclusionInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: DpSandboxMode | undefined;
  readonly initialArchMode?: DpArchMode | undefined;
  readonly initialWorkload?: DpWorkloadMode | undefined;
  readonly initialStep?: DpWaveStep | undefined;
  readonly initialRoceSafeFix?: DpRoceSafeFix | undefined;
  readonly initialExecPath?: DpExecPath | undefined;
}

export function DpDummyExclusionInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialArchMode = "moe-dp2",
  initialWorkload = "skewed-4-0",
  initialStep = 2,
  initialRoceSafeFix = "none",
  initialExecPath = "aclgraph-or-mc2",
}: DpDummyExclusionInteractiveProps) {
  const [mode, setMode] = useState<DpSandboxMode>(initialMode);
  const [archMode, setArchMode] = useState<DpArchMode>(initialArchMode);
  const [workload, setWorkload] = useState<DpWorkloadMode>(initialWorkload);
  const [step, setStep] = useState<DpWaveStep>(initialStep);
  const [roceSafeFix, setRoceSafeFix] = useState<DpRoceSafeFix>(initialRoceSafeFix);
  const [execPath, setExecPath] = useState<DpExecPath>(initialExecPath);
  const [playing, setPlaying] = useState(false);

  const state = useMemo(
    () => computeDpSandboxState(archMode, workload, step, roceSafeFix, execPath),
    [archMode, workload, step, roceSafeFix, execPath],
  );

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-dp-teal`;
  const mComm = `${id}-${uid}-dp-comm`;
  const mDanger = `${id}-${uid}-dp-danger`;

  useEffect(() => {
    if (!playing || mode !== "sandbox") return;
    if (step >= 4) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      const ticked = advanceDpStepTick({ mode, step, playing });
      setStep(ticked.step);
      setPlaying(ticked.playing);
    }, 1800);
    return () => clearTimeout(timer);
  }, [playing, mode, step]);

  const selectStep = (next: DpWaveStep) => {
    setPlaying(false);
    setMode("sandbox");
    setStep(next);
  };

  const selectArchMode = (nextArch: DpArchMode) => {
    setPlaying(false);
    setMode("sandbox");
    setArchMode(nextArch);
    setRoceSafeFix("none");
    if (nextArch === "roce-pp-dp-ban" && step < 3) {
      setStep(3);
    }
  };

  const applySafeFix = (fix: "pp1-dp2-ep" | "dp1-pp2") => {
    setPlaying(false);
    setMode("sandbox");
    setRoceSafeFix(fix);
  };

  const togglePlay = () => {
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
        selectStep(Math.min(4, step + 1) as DpWaveStep);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectStep(Math.max(1, step - 1) as DpWaveStep);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
        event.preventDefault();
        selectStep(Number(event.key) as DpWaveStep);
        break;
      case "0":
      case "Escape":
        event.preventDefault();
        setPlaying(false);
        setMode("svg");
        break;
    }
  };

  const question =
    archMode === "roce-pp-dp-ban"
      ? "跨机 RoCE 叠开流水并行（PP>1）与数据并行（DP>1），为什么启动不报错、首步就挂死？"
      : archMode === "dense-dp2"
        ? "同样开了两组数据并行（DP=2），为什么稠密模型能让空闲组真正休眠？"
        : "DP1 队列明明是空的，为什么一换 MoE 模型就得被叫醒跑假词陪跑？";

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      useTokenVariables
      onToggleMode={(next) => {
        setPlaying(false);
        setMode(next);
      }}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 A · 分步状态机与禁配排雷"
      kickerTitle="数据并行（DP）三态对照：稠密真休眠、MoE 陪跑与跨机禁配"
      question={question}
      toolbarLabel="DP 四步波次步进控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-arch": archMode,
        "data-effective-arch": state.effectiveArch,
        "data-workload": workload,
        "data-step": step,
        "data-roce-fix": roceSafeFix,
        "data-exec-path": execPath,
        "data-after-padding": `[${state.numTokensAfterPadding.join(",")}]`,
        "data-deadlocked": String(state.isDeadlocked),
      }}
      toolbar={
        <>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="dp-autoplay"
              aria-label={playing ? "暂停自动演示" : "自动演示"}
              aria-pressed={playing}
              style={tokenBtnStyle(playing, "teal")}
              onClick={togglePlay}
            >
              <span className="dp-compact-only" aria-hidden="true">
                {playing ? "⏸" : "▶"}
              </span>
              <span className="dp-wide-only">{playing ? "⏸ 暂停" : "▶ 自动演示"}</span>
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              aria-label="上一步"
              disabled={step <= 1}
              style={tokenBtnStyle(false)}
              onClick={() => selectStep(Math.max(1, step - 1) as DpWaveStep)}
            >
              <span className="dp-compact-only" aria-hidden="true">
                ‹
              </span>
              <span className="dp-wide-only">‹ 上一步</span>
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              aria-label="下一步"
              disabled={step >= 4}
              style={tokenBtnStyle(false)}
              onClick={() => selectStep(Math.min(4, step + 1) as DpWaveStep)}
            >
              <span className="dp-compact-only" aria-hidden="true">
                ›
              </span>
              <span className="dp-wide-only">下一步 ›</span>
            </button>
          </div>

          <fieldset className="wiki-edu-btn-row" aria-label="DP 四步波次进度">
            {DP_WAVE_STEPS.map((s) => {
              const active = mode === "sandbox" && step === s;
              const fullLbl = state.shortStepBtns[s - 1] ?? `${s}`;
              const circled = ["①", "②", "③", "④"][s - 1] ?? String(s);
              const compactLbl = `${circled}${fullLbl.replace(/^[①②③④]\s*/, "").slice(0, 2)}`;
              return (
                <button
                  key={s}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`dp-step-${s}`}
                  aria-label={fullLbl}
                  aria-pressed={active}
                  aria-current={active ? "step" : undefined}
                  style={tokenBtnStyle(active, "teal")}
                  onClick={() => selectStep(s)}
                >
                  <span className="dp-compact-only" aria-hidden="true">
                    {compactLbl}
                  </span>
                  <span className="dp-wide-only">{fullLbl}</span>
                </button>
              );
            })}
          </fieldset>
        </>
      }
      takeawayBadge={state.takeawayBadge}
      takeawayTone={state.takeawayTone}
      takeaway={state.takeaway}
      kpi={state.kpi}
      detailsSummary="查看工程与源码细节（独立副本重设 / 空闲陪跑对齐 / 跨机 RoCE 禁配与 16 步停机共识）"
      detailsContent={
        <>
          <strong>{state.detailTitle}</strong>：{state.detailBody} 关键源码锚点：稠密模型调{" "}
          <code>reconfigure_for_independent_dp_rank()</code> 退回普通 <code>EngineCoreProc</code>；MoE 模型由{" "}
          <code>DPCoordinator</code> 发 <code>START_DP_WAVE</code>，<code>DPEngineCoreProc</code> 在空闲组调{" "}
          <code>execute_dummy_batch()</code>（<code>_dummy_run</code> 按 <code>uniform_decode_query_len</code>{" "}
          构造最小解码输入），并在第 1 步及每 <code>dp_sync_interval = 16</code> 步执行{" "}
          <code>sync_dp_state</code>。跨机 RoCE 下 <code>MoeDistributeDispatch</code> 严禁叠开{" "}
          <code>PP &gt; 1</code> 与 <code>DP &gt; 1</code>。
        </>
      }
    >
      <style>{`
        .dp-desktop-svg { display: block; width: 100%; max-width: 900px; height: auto; }
        .dp-mobile-stack { display: none; }
        .dp-compact-only { display: none; }
        .dp-wide-only { display: inline; }
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
          flex-wrap: nowrap;
        }
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
          flex-wrap: nowrap;
        }
        .wiki-edu-card[data-diagram-id="${id}"] code,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-details-body,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-note-card {
          overflow-wrap: anywhere;
          word-break: break-word;
          min-width: 0;
        }
        @container reader-main (max-width: 820px) {
          .dp-desktop-svg { display: none; }
          .dp-mobile-stack { display: flex; flex-direction: column; gap: 6px; }
          .dp-mobile-stack .wiki-edu-note-card { padding: 6px 9px; font-size: 12px; line-height: 1.4; }
          .dp-compact-only { display: inline; }
          .dp-wide-only { display: none; }
        }
        @media (max-width: 820px) {
          .dp-desktop-svg { display: none; }
          .dp-mobile-stack { display: flex; flex-direction: column; gap: 6px; }
          .dp-mobile-stack .wiki-edu-note-card { padding: 6px 9px; font-size: 12px; line-height: 1.4; }
          .dp-compact-only { display: inline; }
          .dp-wide-only { display: none; }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
            padding: 6px 6px;
            gap: 3px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
            gap: 2.5px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
            padding: 4px 4.5px;
            font-size: 11px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-kpi,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-takeaway-badge,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-badge {
            white-space: normal;
            max-width: 100%;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        <DpWaveCanvasBody
          state={state}
          mTeal={mTeal}
          mComm={mComm}
          mDanger={mDanger}
          onApplySafeFix={applySafeFix}
          paramDrawer={
            <details
              className="wiki-edu-param-drawer"
              data-testid="dp-param-drawer"
              onKeyDown={handleKeyDown}
              style={{
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-field)",
                padding: "8px 12px",
                background: "var(--color-surface)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "var(--text-caption)",
                  color: "var(--color-ink)",
                }}
              >
                展开架构、负载与执行路径设置（稠密 / MoE / 跨机禁配 · 偏斜 / 满载）
              </summary>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: "8px" }}>
                <fieldset className="wiki-edu-btn-row" aria-label="三类 DP 架构形态">
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-arch-dense"
                    aria-pressed={mode === "sandbox" && archMode === "dense-dp2"}
                    style={tokenBtnStyle(mode === "sandbox" && archMode === "dense-dp2", "dark")}
                    onClick={() => selectArchMode("dense-dp2")}
                  >
                    ① 稠密 DP=2 (真休眠)
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-arch-moe"
                    aria-pressed={mode === "sandbox" && archMode === "moe-dp2"}
                    style={tokenBtnStyle(mode === "sandbox" && archMode === "moe-dp2", "dark")}
                    onClick={() => selectArchMode("moe-dp2")}
                  >
                    ② MoE DP=2 (陪跑防死锁)
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-arch-roce-ban"
                    aria-pressed={mode === "sandbox" && archMode === "roce-pp-dp-ban"}
                    style={tokenBtnStyle(mode === "sandbox" && archMode === "roce-pp-dp-ban", "dark")}
                    onClick={() => selectArchMode("roce-pp-dp-ban")}
                  >
                    ③ 跨机 RoCE PP+DP 禁配
                  </button>
                </fieldset>

                <fieldset className="wiki-edu-btn-row" aria-label="负载偏斜与执行路径">
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-workload-skewed"
                    aria-pressed={mode === "sandbox" && workload === "skewed-4-0"}
                    style={tokenBtnStyle(mode === "sandbox" && workload === "skewed-4-0", "teal")}
                    onClick={() => {
                      setPlaying(false);
                      setMode("sandbox");
                      setWorkload("skewed-4-0");
                    }}
                  >
                    偏斜 DP0=4·DP1=0
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-workload-balanced"
                    aria-pressed={mode === "sandbox" && workload === "balanced-3-2"}
                    style={tokenBtnStyle(mode === "sandbox" && workload === "balanced-3-2", "teal")}
                    onClick={() => {
                      setPlaying(false);
                      setMode("sandbox");
                      setWorkload("balanced-3-2");
                    }}
                  >
                    满载 DP0=3·DP1=2
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-exec-aclgraph"
                    aria-pressed={mode === "sandbox" && execPath === "aclgraph-or-mc2"}
                    style={tokenBtnStyle(mode === "sandbox" && execPath === "aclgraph-or-mc2", "dark")}
                    onClick={() => {
                      setPlaying(false);
                      setMode("sandbox");
                      setExecPath("aclgraph-or-mc2");
                    }}
                  >
                    ACLGraph/MC2 补齐
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="dp-exec-eager"
                    aria-pressed={mode === "sandbox" && execPath === "eager-alltoall"}
                    style={tokenBtnStyle(mode === "sandbox" && execPath === "eager-alltoall", "dark")}
                    onClick={() => {
                      setPlaying(false);
                      setMode("sandbox");
                      setExecPath("eager-alltoall");
                    }}
                  >
                    Eager 保持原宽
                  </button>
                </fieldset>
              </div>
            </details>
          }
        />
      </div>
    </WikiEduSandboxShell>
  );
}

function DpWaveCanvasBody({
  state,
  mTeal,
  mComm,
  mDanger,
  onApplySafeFix,
  paramDrawer,
}: {
  readonly state: DpSandboxComputedState;
  readonly mTeal: string;
  readonly mComm: string;
  readonly mDanger: string;
  readonly onApplySafeFix: (fix: "pp1-dp2-ep" | "dp1-pp2") => void;
  readonly paramDrawer: ReactNode;
}) {
  const bridgeBg =
    state.centerBridgeTone === "danger"
      ? "var(--color-accent-soft)"
      : state.centerBridgeTone === "comm"
        ? "var(--color-comm-soft)"
        : state.centerBridgeTone === "good"
          ? "var(--color-token-soft)"
          : "var(--color-surface-sunken)";
  const bridgeBorder =
    state.centerBridgeTone === "danger"
      ? "var(--color-danger)"
      : state.centerBridgeTone === "comm"
        ? "var(--color-comm)"
        : state.centerBridgeTone === "good"
          ? "var(--color-token)"
          : "var(--color-control)";
  const markerId =
    state.centerBridgeTone === "danger" ? mDanger : state.centerBridgeTone === "comm" ? mComm : mTeal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
      <svg
        className="dp-desktop-svg"
        viewBox="0 0 860 236"
        width="860"
        height="236"
        style={{ width: "100%", maxWidth: "900px", height: "auto" }}
        role="img"
        aria-label={`DP 运行架构 ${state.effectiveArch} 第 ${state.step} 步双组波次与通信演化`}
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
            <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-token)" />
          </marker>
          <marker
            id={mComm}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-comm)" />
          </marker>
          <marker
            id={mDanger}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-danger)" />
          </marker>
        </defs>

        <text x="16" y="20" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {state.canvasHeading}
        </text>
        <text x="844" y="20" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--color-ink-muted)">
          {state.widthPillText}
        </text>

        <rect
          x="16"
          y="36"
          width="252"
          height="86"
          rx="8"
          fill={state.group0.bgHex}
          stroke={state.step <= 2 ? "var(--color-accent)" : state.group0.borderHex}
          strokeWidth={state.step <= 2 ? "2" : "1.5"}
          style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
        />
        <text x="142" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {state.group0.boxTitle}
        </text>
        <text x="142" y="84" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.group0.boxSub1}
        </text>
        <text x="142" y="108" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.group0.boxSub2}
        </text>

        <rect
          x="16"
          y="138"
          width="252"
          height="86"
          rx="8"
          fill={state.group1.bgHex}
          stroke={state.step <= 2 ? "var(--color-accent)" : state.group1.borderHex}
          strokeWidth={state.step <= 2 ? "2" : "1.5"}
          strokeDasharray={state.effectiveArch === "dense-dp2" && state.isDp1Idle ? "4 3" : undefined}
          style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
        />
        <text x="142" y="162" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {state.group1.boxTitle}
        </text>
        <text x="142" y="186" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.group1.boxSub1}
        </text>
        <text x="142" y="210" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.group1.boxSub2}
        </text>

        <line
          x1="270"
          y1="79"
          x2="300"
          y2="108"
          stroke={bridgeBorder}
          strokeWidth="1.8"
          markerEnd={`url(#${markerId})`}
        />
        {!(state.effectiveArch === "dense-dp2" && state.isDp1Idle) && (
          <line
            x1="270"
            y1="181"
            x2="300"
            y2="152"
            stroke={bridgeBorder}
            strokeWidth="1.8"
            markerEnd={`url(#${markerId})`}
          />
        )}

        <rect
          x="304"
          y="50"
          width="252"
          height="160"
          rx="8"
          fill={bridgeBg}
          stroke={state.step === 3 ? "var(--color-accent)" : bridgeBorder}
          strokeWidth={state.step === 3 ? "2" : "1.5"}
          style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
        />
        <text x="430" y="84" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {state.centerBridgeTitle}
        </text>
        <text x="430" y="114" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.centerBridgeSub}
        </text>
        <text
          x="430"
          y="146"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={
            state.centerBridgeTone === "danger"
              ? "var(--color-danger)"
              : state.centerBridgeTone === "comm"
                ? "var(--color-comm)"
                : "var(--color-ink)"
          }
        >
          {state.centerBridgeRule}
        </text>
        <text x="430" y="178" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.centerBridgeFoot}
        </text>

        <line
          x1="558"
          y1="130"
          x2="588"
          y2="130"
          stroke={bridgeBorder}
          strokeWidth="1.8"
          markerEnd={`url(#${markerId})`}
        />

        <rect
          x="592"
          y="50"
          width="252"
          height="160"
          rx="8"
          fill={
            state.isDeadlocked
              ? "var(--color-accent-soft)"
              : state.step >= 4
                ? "var(--color-token-soft)"
                : "var(--color-surface)"
          }
          stroke={
            state.step === 4
              ? "var(--color-accent)"
              : state.isDeadlocked
                ? "var(--color-danger)"
                : "var(--color-token)"
          }
          strokeWidth={state.step === 4 ? "2" : "1.5"}
          style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
        />
        <text x="718" y="84" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {state.outputTitle}
        </text>
        <text x="718" y="114" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.outputLine1}
        </text>
        <text
          x="718"
          y="146"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={state.isDeadlocked ? "var(--color-danger)" : "var(--color-ink)"}
        >
          {state.outputLine2}
        </text>
        <text x="718" y="178" textAnchor="middle" fontSize="12" fill="var(--color-ink)">
          {state.outputLine3}
        </text>
      </svg>

      <div className="dp-mobile-stack">
        <div
          className="wiki-edu-note-card"
          style={{ borderLeft: `4px solid ${state.group0.borderHex}`, background: state.group0.bgHex }}
        >
          <strong>{state.group0.boxTitle}</strong>：{state.group0.boxSub1} · {state.group0.boxSub2}
        </div>
        <div
          className="wiki-edu-note-card"
          style={{ borderLeft: `4px solid ${state.group1.borderHex}`, background: state.group1.bgHex }}
        >
          <strong>{state.group1.boxTitle}</strong>：{state.group1.boxSub1} · {state.group1.boxSub2}
        </div>
        <div
          className="wiki-edu-note-card"
          style={{ borderLeft: `4px solid ${bridgeBorder}`, background: bridgeBg }}
        >
          <strong>{state.centerBridgeTitle}</strong>：{state.centerBridgeSub}（{state.centerBridgeRule}）
        </div>
        <div
          className="wiki-edu-note-card"
          style={{
            borderLeft: `4px solid ${state.isDeadlocked ? "var(--color-danger)" : "var(--color-token)"}`,
          }}
        >
          <strong>{state.outputTitle}</strong>：{state.outputLine1} · {state.outputLine2}
        </div>
      </div>

      {paramDrawer}

      {state.archMode === "roce-pp-dp-ban" && (
        <div
          className={`wiki-edu-panel${state.roceSafeFix === "none" ? " is-oom" : ""}`}
          data-testid="dp-roce-remediation-box"
        >
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">
              {state.roceSafeFix === "none"
                ? "跨机 RoCE 二选一安全处方（禁叠开 PP > 1 与 DP > 1）"
                : `已切换安全拓扑：${state.roceSafeFix === "pp1-dp2-ep" ? "PP=1, DP=2 + EP" : "DP=1, PP=2"}`}
            </span>
            <span className={`wiki-edu-badge ${state.roceSafeFix === "none" ? "is-bad" : "is-good"}`}>
              {state.roceSafeFix === "none" ? "无启动期拦截 · 首步挂死" : "已解除通信挂死"}
            </span>
          </div>
          <div className="wiki-edu-btn-row">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="dp-fix-pp1-dp2"
              aria-pressed={state.roceSafeFix === "pp1-dp2-ep"}
              style={tokenBtnStyle(state.roceSafeFix === "pp1-dp2-ep", "teal")}
              onClick={() => onApplySafeFix("pp1-dp2-ep")}
            >
              保留数据并行（PP=1, DP=2 + EP）
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="dp-fix-dp1-pp2"
              aria-pressed={state.roceSafeFix === "dp1-pp2"}
              style={tokenBtnStyle(state.roceSafeFix === "dp1-pp2", "teal")}
              onClick={() => onApplySafeFix("dp1-pp2")}
            >
              保留流水并行（DP=1, PP=2）
            </button>
          </div>
        </div>
      )}

      <div className="wiki-edu-dual-grid">
        <div className="wiki-edu-note-card">
          <strong>为什么不开专家并行也要陪跑？</strong>：触发陪跑的是 <strong>MoE 跨组路由权重</strong>{" "}
          本身；即使关闭专家并行，专家权重也会展平摊到全部卡，空闲组若不进组同步，忙组照样卡死。
        </div>
        <div className="wiki-edu-note-card">
          <strong>双池代价与停机节拍</strong>：910B3 实测 <code>Qwen3-30B-A3B</code> 扩至 <code>DP=2</code>{" "}
          时双组各自维护独立前缀缓存池，且每 <code>16</code> 步核对一次全组是否可停机。
        </div>
      </div>
    </div>
  );
}
