import { type CSSProperties, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { sourceUrl } from "../../content/wiki/index";
import { parseRepoRef } from "../../content/wiki/schema";
import {
  LEGACY_BASELINE_BADGE_TEXT,
  type ResolvedToolDeepLink,
  resolveToolDeepLink,
} from "../../content/wiki/toolDeeplinks";
import { analyzeParams, fmtBytes, fmtCount } from "../../sim/modelspec/analyze";
import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  buildCurrentPlanCliHint,
  type CalcEvidenceLevel,
  DEFAULT_GPU_MEMORY_UTILIZATION,
  DEFAULT_MAX_NUM_BATCHED_TOKENS,
  DEFAULT_MAX_NUM_SEQS,
  type DeployPlanInput,
  type DeployPlanReport,
  evaluateDeployPlan,
  extractDoctorModelTraitsFromSpec,
  GIB,
  type KvCacheDtype,
  MIB,
  type RooflineAnalysis,
  WAVE4_DEMO_PRESETS,
  type Wave3ModelGateResult,
  type Wave4ArchitectureSummary,
  type Wave4DemoPreset,
  type WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import {
  type LogReconciliationReport,
  parseAscendStartupLog,
  type ReconciliationItemStatus,
  reconcileStartupLog,
  SAMPLE_ASCEND_STARTUP_LOGS,
  type SampleStartupLogTemplate,
} from "../../sim/modelspec/startupLogParser";
import type { CudaGraphMode, RuleVersion } from "../../sim/rules/types";
import {
  buildHardwareDeployHref,
  type DeployOverlayModelKey,
  type DeployOverlayOomStatus,
} from "../model/hardwareDeployOverlay";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkChip } from "./ToolDeepLinkChip";
import {
  buildCalculatorQueryParams,
  buildDeployChatAnalysis,
  type CalculatorQueryOverrides,
  cardIdToHardwareFamily,
  copyTextToClipboard,
  type DeployChatAnalysisPayload,
  evaluateCalculatorModelGate,
  parseCalculatorQueryParams,
  parseCustomModelParam,
  sanitizeDiagnosticText,
  serializeCustomModelForShare,
  workbenchHandoffStore,
} from "./workbenchHandoff";

export { evaluateCalculatorModelGate, parseCustomModelParam, serializeCustomModelForShare };

const DEFAULT_MAX_MODEL_LEN = 32768;
const DEFAULT_PREFILL_TOKENS = 512;
const DEFAULT_DECODE_BATCH_SIZE = 16;
const DEFAULT_DECODE_CONTEXT_LEN = 4096;

const CALCULATOR_SHARE_QUERY_KEYS = [
  "panel",
  "preset",
  "customModel",
  "card",
  "precision",
  "kv",
  "nz",
  "tp",
  "pp",
  "dp",
  "pcp",
  "dcp",
  "ep",
  "u",
  "maxLen",
  "batchTokens",
  "maxSeqs",
  "cudagraph",
  "eager",
  "v2",
  "prefill",
  "decodeBatch",
  "decodeCtx",
  "version",
] as const;

function normalizeCalcInt(value: number, min: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return rounded >= min ? rounded : Math.max(min, fallback);
}

export function parseV2ModelRunnerParam(params?: URLSearchParams): boolean | undefined {
  const raw = params?.get("v2")?.trim().toLowerCase();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return undefined;
}

function getCalculatorQuerySignature(params?: URLSearchParams): string {
  if (!params) return "";
  const pairs: string[] = [];
  for (const key of CALCULATOR_SHARE_QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) {
      pairs.push(`${key}=${value}`);
    }
  }
  return pairs.join("&");
}

export function hasAdvancedQueryOverrides(
  q: CalculatorQueryOverrides,
  useV2ModelRunner?: boolean | undefined,
): boolean {
  const defaultCg: CudaGraphMode = (q.cardId ?? "a2-64g") === "310p-24g" ? "NONE" : "PIECEWISE";
  return Boolean(
    (q.ppSize !== undefined && q.ppSize !== 1) ||
      (q.dpSize !== undefined && q.dpSize !== 1) ||
      (q.pcpSize !== undefined && q.pcpSize !== 1) ||
      (q.dcpSize !== undefined && q.dcpSize !== 1) ||
      (q.kvCacheDtype !== undefined && q.kvCacheDtype !== "auto") ||
      (q.weightNzMode !== undefined && q.weightNzMode !== 1) ||
      (q.cudagraphMode !== undefined && q.cudagraphMode !== defaultCg) ||
      (q.enforceEager === true && defaultCg !== "NONE") ||
      useV2ModelRunner !== undefined ||
      (q.maxNumBatchedTokens !== undefined && q.maxNumBatchedTokens !== DEFAULT_MAX_NUM_BATCHED_TOKENS) ||
      (q.maxNumSeqs !== undefined && q.maxNumSeqs !== DEFAULT_MAX_NUM_SEQS) ||
      (q.prefillTokens !== undefined && q.prefillTokens !== DEFAULT_PREFILL_TOKENS) ||
      (q.decodeBatchSize !== undefined && q.decodeBatchSize !== DEFAULT_DECODE_BATCH_SIZE) ||
      (q.decodeContextLen !== undefined && q.decodeContextLen !== DEFAULT_DECODE_CONTEXT_LEN) ||
      (q.version !== undefined && q.version !== "v0.30.0"),
  );
}

function hasNonPanelCalculatorParams(
  q: CalculatorQueryOverrides,
  customModel: string | null,
  useV2ModelRunner?: boolean | undefined,
): boolean {
  if (customModel !== null || useV2ModelRunner !== undefined) return true;
  return Object.entries(q).some(([key, value]) => key !== "subMode" && value !== undefined);
}

export interface DeployCalculatorViewProps {
  mode?: "quick-screen" | "minimal" | "full" | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  initialModel?: string | undefined;
  embedded?: boolean | undefined;
  searchParams?: URLSearchParams | undefined;
  locationKey?: string | undefined;
  onUpdateSearchParams?: ((params: URLSearchParams, options?: { replace?: boolean }) => void) | undefined;
  onClearCalculatorShareParams?:
    | ((subMode: "static" | "reconcile", pushHistory?: boolean) => void)
    | undefined;
  onNavigateToDoctor?: (() => void) | undefined;
}

const PRECISION_OPTIONS: readonly { value: WeightPrecision; label: string }[] = [
  { value: "bf16", label: "BF16（2 B/param）" },
  { value: "fp16", label: "FP16（2 B/param）" },
  { value: "w8a8", label: "W8A8（静态 INT8）" },
  { value: "w8a8_dynamic", label: "W8A8_DYNAMIC（动态 INT8）" },
  { value: "w4a8", label: "W4A8（INT4 权 / INT8 激）" },
  { value: "fp8_block", label: "FP8_BLOCK（原生分块 FP8）" },
  { value: "w8a8sc_310p", label: "W8A8SC（310P 专用稀疏）" },
];

const CUDAGRAPH_OPTIONS: readonly { value: CudaGraphMode; label: string }[] = [
  { value: "PIECEWISE", label: "PIECEWISE（分段图 · 默认）" },
  { value: "FULL_DECODE_ONLY", label: "FULL_DECODE_ONLY（仅解码全图）" },
  { value: "FULL_AND_PIECEWISE", label: "FULL_AND_PIECEWISE（混合）" },
  { value: "FULL", label: "FULL（整图）" },
  { value: "NONE", label: "NONE（纯 Eager 不录图）" },
];

const DEFAULT_WAVE4_MLA_JSON = JSON.stringify(WAVE4_DEMO_PRESETS[0]!.config, null, 2);

const WAVE4_WIKI_FALLBACK: Record<string, { id: string; label?: string }> = {
  kda: { id: "linear-attention", label: "KDA（线性注意力）" },
  "attention-variants": { id: "sparse-attention", label: "注意力变体与稀疏注意力" },
};

function resolveSafeDeepLink(
  pageId: string,
  opts?: { anchor?: string | undefined; label?: string | undefined },
): ResolvedToolDeepLink {
  try {
    return resolveToolDeepLink(pageId, opts);
  } catch {
    const mapped = WAVE4_WIKI_FALLBACK[pageId];
    if (mapped) {
      try {
        return resolveToolDeepLink(mapped.id, {
          anchor: opts?.anchor,
          label: opts?.label ?? mapped.label,
        });
      } catch {
        // fall through to honest static fallback
      }
    }
    return {
      pageId,
      canonicalId: pageId,
      href: `#/wiki/${pageId}`,
      label: opts?.label ?? pageId,
      verified: [],
      isV030Verified: false,
      isLegacyBaseline: true,
      badgeText: LEGACY_BASELINE_BADGE_TEXT,
    };
  }
}

function matchInitialPresetId(initialModel?: string): string {
  if (!initialModel) return "qwen3-8b";
  const norm = initialModel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const hit = MODEL_PRESETS.find(
    (p) =>
      p.id.toLowerCase().replace(/[^a-z0-9]/g, "") === norm ||
      p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm,
  );
  return hit ? hit.id : "qwen3-8b";
}

function fmtGiB(bytes: number): string {
  return `${(bytes / GIB).toFixed(2)} GiB`;
}

function fmtGiBRange(lowBytes: number, highBytes: number): string {
  if (Math.abs(highBytes - lowBytes) < 1024 * 1024) return fmtGiB(lowBytes);
  return `[${(lowBytes / GIB).toFixed(2)}, ${(highBytes / GIB).toFixed(2)}] GiB`;
}

const EVIDENCE_META: Record<CalcEvidenceLevel, { tag: string; color: string; bg: string }> = {
  C: { tag: "[C] 源码实证", color: "var(--color-ev-source)", bg: "var(--color-kv-soft)" },
  D: { tag: "[D] 公式推导", color: "var(--color-ev-derived)", bg: "var(--color-token-soft)" },
  I: { tag: "[I] 工程区间", color: "var(--color-ev-inference)", bg: "var(--color-weight-soft)" },
};

const RECON_STATUS_META: Record<
  ReconciliationItemStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  "within-interval": {
    label: "区间内吻合",
    color: "var(--color-token)",
    bg: "var(--color-token-soft)",
    border: "color-mix(in srgb, var(--color-token) 40%, var(--color-line))",
  },
  "above-interval": {
    label: "高于预测上界",
    color: "var(--color-warning)",
    bg: "var(--color-weight-soft)",
    border: "color-mix(in srgb, var(--color-weight) 45%, var(--color-line))",
  },
  "below-interval": {
    label: "低于预测下界",
    color: "var(--color-kv)",
    bg: "var(--color-kv-soft)",
    border: "color-mix(in srgb, var(--color-kv) 40%, var(--color-line))",
  },
  "oom-risk": {
    label: "OOM 风险",
    color: "var(--color-danger)",
    bg: "color-mix(in srgb, var(--color-danger) 12%, var(--color-surface-elevated))",
    border: "color-mix(in srgb, var(--color-danger) 48%, var(--color-line))",
  },
  missing: {
    label: "日志未提供",
    color: "var(--color-ink-muted)",
    bg: "var(--color-surface-sunken)",
    border: "var(--color-line)",
  },
};

function SourceRefList({ sources }: { sources: readonly string[] }) {
  if (sources.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {sources.map((src) => {
        if (src.startsWith("wiki:")) {
          const id = src.slice(5);
          return <ToolDeepLinkChip key={src} link={resolveSafeDeepLink(id)} />;
        }
        const repoRef = parseRepoRef(src);
        const href = repoRef ? sourceUrl(repoRef) : src.startsWith("http") ? src : null;
        if (href) {
          return (
            <a
              key={src}
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-kv)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: 999,
                padding: "2px 8px",
                textDecoration: "none",
              }}
            >
              {src} ↗
            </a>
          );
        }
        return (
          <code
            key={src}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-ink-muted)",
              background: "var(--color-surface-sunken)",
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            {src}
          </code>
        );
      })}
    </div>
  );
}

function Wave4ArchActiveBanner({
  arch,
  tpSize,
  maxNumSeqs,
}: {
  arch: Wave4ArchitectureSummary;
  tpSize: number;
  maxNumSeqs: number;
}) {
  if (arch.activeFeatures.length === 0) return null;
  const wikiIds = new Set<string>();
  if (arch.hasMla) wikiIds.add("mla");
  if (arch.hasCsa2) wikiIds.add("sparse-attention");
  if (arch.hasKda) wikiIds.add("linear-attention");
  if (arch.hasEngram) wikiIds.add("engram-conditional-memory");
  wikiIds.add("kv-cache-spec");

  return (
    <div
      className="wt-calc-wave4-banner"
      data-testid="wave4-arch-active"
      role="status"
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-card)",
        border: "1.5px solid color-mix(in srgb, var(--color-token) 58%, var(--color-line))",
        background: "color-mix(in srgb, var(--color-token-soft) 68%, var(--color-surface-elevated))",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--color-token)",
            color: "var(--color-ink-inverse)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Wave 4 异构注意力/记忆账本已激活 · 检测到 {arch.activeFeatures.join(" / ")}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          fontSize: 13.5,
          color: "var(--color-ink)",
          lineHeight: 1.6,
        }}
      >
        {arch.mla && (
          <div>
            <strong>MLA 潜向量压缩与 TP/DCP 守恒：</strong>
            单层潜向量 ({arch.mla.kvLoraRank} + {arch.mla.qkRopeHeadDim}) 维 →{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {arch.mla.latentBytesPerTokenPerLayer} B/tok/层
            </code>
            （较等效 MHA 压缩 <strong>{arch.mla.compressionRatio.toFixed(1)}×</strong>）。因单潜向量头（
            <code>num_kv_heads_effective=1</code>）无法被 TP={tpSize} 切分，每张 TP 卡均全量复制潜向量，
            {arch.mla.dcpSize > 1
              ? `已通过 DCP=${arch.mla.dcpSize} 沿序列轴分摊为 1/${arch.mla.dcpSize}`
              : "仅开启 DCP > 1 可沿序列轴切分"}
            ；Decode 矩阵吸收（<code>mlapo</code>）显著抬升注意力算术强度。
          </div>
        )}

        {arch.csa2 && (
          <div>
            <strong>CSA2 / DSA 稀疏索引器：</strong>
            除主 KV/潜向量外，每层每 token 额外存储{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>{arch.csa2.indexerBytesPerTokenPerLayer} B</code>{" "}
            稀疏索引器缓存（<code>index_head_dim={arch.csa2.indexHeadDim}</code>,{" "}
            <code>index_n_heads={arch.csa2.indexNumHeads}</code>），Decode 主 KV 读取从全上下文骤降至{" "}
            <strong>top-{arch.csa2.indexTopk}</strong>（有效读取{" "}
            <code>{arch.csa2.effectiveDecodeContextLen}</code> tok，综合读取压缩约{" "}
            <strong>{arch.csa2.decodeBandwidthSavingsRatio.toFixed(1)}×</strong>）。
          </div>
        )}

        {arch.kda && (
          <div>
            <strong>KDA / 线性注意力混合栈：</strong>共 {arch.kda.linearLayerCount} 层线性注意力 +{" "}
            {arch.kda.fullAttnLayerCount} 层全注意力。线性层采用{" "}
            <strong>O(1) 固定递推状态 S + 短卷积态</strong>（每并发序列{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {(arch.kda.perSeqFixedLinearStateBytes / MIB).toFixed(2)} MiB/seq
            </code>
            ，按 <code>max_num_seqs={maxNumSeqs}</code> 预留{" "}
            <strong>{fmtGiB(arch.kda.totalFixedLinearStateBytes)}</strong>，与上下文长度无关）；仅{" "}
            {arch.kda.fullAttnLayerCount} 层全注意力消耗按 token 分页 KV（
            <code style={{ fontFamily: "var(--font-mono)" }}>
              {fmtBytes(arch.kda.perTokenPagedKvBytes)}/tok
            </code>
            ）。
          </div>
        )}

        {arch.engram && (
          <div>
            <strong>Engram 条件记忆（{arch.engram.layerCount} 层）：</strong>
            {arch.engram.dpSharedMemory && !arch.engram.cpuOffload ? (
              <>
                配置校验冲突（<code>dp_shared_memory=true</code> 但 <code>cpu_offload=false</code>
                ，启动期将抛 <code>ValueError</code> 阻断）：未卸载时词表按{" "}
                <code>ETP={arch.engram.etpSize}</code> 计单卡常驻 HBM{" "}
                <strong>{fmtGiB(arch.engram.npuWeightBytesPerRank)}</strong>（Host DRAM <strong>0 B</strong>
                ）。
              </>
            ) : arch.engram.cpuOffload && arch.engram.dpSharedMemory ? (
              <>
                已启用 <code>engram_dp_shared_memory=true</code>（Host DRAM / <code>/dev/shm</code>{" "}
                卸载共享）：单卡 NPU 权重 HBM 占用 <strong>0 B</strong>，单节点需预留{" "}
                <strong>{fmtGiB(arch.engram.hostDramBytesPerNode)}</strong> Host DRAM，Stage 5 中{" "}
                <code>edp</code> 走 Gloo 通信不占 HCCL 显存。
              </>
            ) : arch.engram.cpuOffload ? (
              <>
                已启用 <code>engram_cpu_offload=true</code>、<code>dp_shared_memory=false</code>
                （进程私有 Host DRAM 卸载）：单卡 NPU 权重 HBM 占用 <strong>0 B</strong>，单节点需预留{" "}
                <strong>{fmtGiB(arch.engram.hostDramBytesPerNode)}</strong> Host DRAM（按{" "}
                <code>ETP={arch.engram.etpSize}</code> 切分）。
              </>
            ) : (
              <>
                <code>engram_cpu_offload=false</code>（NPU HBM 常驻）：按{" "}
                <code>ETP={arch.engram.etpSize}</code> 切分，单卡常驻权重增加{" "}
                <strong>{fmtGiB(arch.engram.npuWeightBytesPerRank)}</strong>，并已纳入 Stage 5 HCCL{" "}
                <code>etp/edp</code> 域核算。
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {Array.from(wikiIds).map((id) => (
          <ToolDeepLinkChip key={id} link={resolveSafeDeepLink(id)} />
        ))}
      </div>
    </div>
  );
}

function Wave3InterceptCard({
  gate,
  onReset,
}: {
  gate: Extract<Wave3ModelGateResult, { ok: true; supportedInWave3: false }>;
  onReset: () => void;
}) {
  const deepLink = resolveSafeDeepLink(gate.targetWikiId);
  return (
    <div
      className="wt-calc-intercept"
      data-testid="wave3-arch-intercept"
      role="alert"
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius-card)",
        border: "1.5px solid color-mix(in srgb, var(--color-weight) 65%, var(--color-line))",
        background: "color-mix(in srgb, var(--color-weight-soft) 72%, var(--color-surface-elevated))",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--color-weight)",
            color: "var(--color-ink-inverse)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Wave 3 架构分波边界拦截 · {gate.blockedFeature}
        </span>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--color-ink)",
            background: "var(--color-surface-elevated)",
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid var(--color-line)",
          }}
        >
          model_type={gate.modelType} · 命中: {gate.blockedFeatures.join(" / ")}
        </code>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-ink)", lineHeight: 1.65 }}>{gate.reason}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--color-warning)" }}>
        解锁波次：Wave 4（专章与单测完备后开放，拒绝套用标准 GQA 公式输出伪精确数字）
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <ToolDeepLinkChip link={deepLink} />
        <button type="button" className="wt-preset-btn" onClick={onReset}>
          切回 Qwen3-8B 标准示例
        </button>
      </div>
    </div>
  );
}

function HbmStackedBar({ plan, compact = false }: { plan: DeployPlanReport; compact?: boolean }) {
  const total = Math.max(1, plan.totalHbmBytes);
  const wBytes = plan.stages[2].pointEstimateBytes;
  const actBytes = plan.stages[3].pointEstimateBytes;
  const nonTorchBytes = plan.stages[4].pointEstimateBytes;
  const kvBytes = plan.stages[5].pointEstimateBytes;
  const aclBytes = plan.stages[6].pointEstimateBytes;
  const uPct = Math.min(100, (plan.requestedBytes / total) * 100);
  const segs = [
    { id: "w", label: "权重", bytes: wBytes, color: "var(--color-weight)" },
    { id: "act", label: "试跑激活峰值", bytes: actBytes, color: "var(--color-accent)" },
    { id: "nt", label: "非 Torch / HCCL", bytes: nonTorchBytes, color: "var(--color-comm)" },
    { id: "kv", label: "可用 KV 池", bytes: kvBytes, color: "var(--color-kv)" },
  ];
  const usedInBudget = wBytes + actBytes + nonTorchBytes + kvBytes;
  const overflow = usedInBudget > plan.requestedBytes;
  const headOverflow = aclBytes > plan.unbudgetedHeadroomBytes;

  return (
    <div
      className="wt-calc-hbm-bar"
      style={{
        padding: compact ? "10px 12px" : "14px 16px",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-line)",
        background: "var(--color-surface-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, fontSize: 13.5 }}
      >
        <strong>
          单卡 HBM {plan.card.hbmGiB} GiB 账目拆解（u = {plan.inputSummary.gpuMemoryUtilization.toFixed(2)} →
          预算 {fmtGiB(plan.requestedBytes)} ｜ 预算外 1−u 余量 {fmtGiB(plan.unbudgetedHeadroomBytes)}）
        </strong>
        <span
          style={{
            color: overflow || headOverflow ? "var(--color-danger)" : "var(--color-token)",
            fontWeight: 600,
          }}
        >
          {overflow ? "预算内超额（OOM）" : headOverflow ? "录图穿透 1−u 余量" : "7 级账目闭环"}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          height: compact ? 22 : 28,
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-line)",
        }}
      >
        {segs.map((s) => {
          const pct = Math.min(100, Math.max(0, (s.bytes / total) * 100));
          if (pct <= 0.2) return null;
          return (
            <div
              key={s.id}
              title={`${s.label}: ${fmtGiB(s.bytes)}`}
              style={{
                width: `${pct}%`,
                background: s.color,
                transition: "width 180ms ease",
              }}
            />
          );
        })}
        <div
          title={`Stage 7 ACLGraph + 150 MiB 裕度: ${fmtGiB(aclBytes)}（由 1−u 余量支付）`}
          style={{
            position: "absolute",
            left: `${uPct}%`,
            top: 0,
            bottom: 0,
            width: `${Math.min(100 - uPct, (aclBytes / total) * 100)}%`,
            background: headOverflow
              ? "var(--color-danger)"
              : "repeating-linear-gradient(45deg, var(--color-token), var(--color-token) 4px, var(--color-token-soft) 4px, var(--color-token-soft) 8px)",
          }}
        />
        <div
          title={`requested_memory = M_total × u (${fmtGiB(plan.requestedBytes)})`}
          style={{
            position: "absolute",
            left: `${uPct}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--color-ink)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          fontSize: 13.5,
          color: "var(--color-ink-muted)",
        }}
      >
        {segs.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }}
            />
            <span>
              {s.label} <strong style={{ color: "var(--color-ink)" }}>{fmtGiB(s.bytes)}</strong>
            </span>
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: headOverflow ? "var(--color-danger)" : "var(--color-token)",
              display: "inline-block",
            }}
          />
          <span>
            Stage 7 录图+150M <strong style={{ color: "var(--color-ink)" }}>{fmtGiB(aclBytes)}</strong> / 1−u{" "}
            {fmtGiB(plan.unbudgetedHeadroomBytes)}
          </span>
        </span>
      </div>
    </div>
  );
}

function RooflineSvgChart({ roofline, compact = false }: { roofline: RooflineAnalysis; compact?: boolean }) {
  const width = compact ? 540 : 680;
  const height = compact ? 235 : 275;
  const padL = 62;
  const padR = 24;
  const padT = 26;
  const padB = 46;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const hasSplitRoof = Math.abs(roofline.prefillPeakComputeTflops - roofline.decodePeakComputeTflops) > 1e-6;
  const minX = 1;
  const maxX = Math.max(
    1024,
    Math.ceil(
      Math.max(
        roofline.prefillIntensityFlopsPerByte,
        roofline.prefillRidgePointFlopsPerByte,
        roofline.decodeRidgePointFlopsPerByte,
      ) * 2.2,
    ),
  );
  const minY = 1;
  const maxY = Math.max(roofline.maxPeakComputeTflops * 1.45, 64);
  const logX = (v: number) =>
    padL +
    ((Math.log10(Math.max(minX, v)) - Math.log10(minX)) / (Math.log10(maxX) - Math.log10(minX))) * plotW;
  const logY = (v: number) =>
    padT +
    plotH -
    ((Math.log10(Math.max(minY, v)) - Math.log10(minY)) / (Math.log10(maxY) - Math.log10(minY))) * plotH;

  const decodeSlopeMinY = Math.min(
    roofline.decodePeakComputeTflops,
    (minX * roofline.hbmBandwidthGBs) / 1000,
  );
  const ridgeX = logX(roofline.decodeRidgePointFlopsPerByte);
  const ridgeY = logY(roofline.decodePeakComputeTflops);
  const roofPath = `M ${logX(minX)} ${logY(decodeSlopeMinY)} L ${ridgeX} ${ridgeY} L ${logX(maxX)} ${ridgeY}`;

  const prefillSlopeMinY = Math.min(
    roofline.prefillPeakComputeTflops,
    (minX * roofline.hbmBandwidthGBs) / 1000,
  );
  const prefillRidgeX = logX(roofline.prefillRidgePointFlopsPerByte);
  const prefillRidgeY = logY(roofline.prefillPeakComputeTflops);
  const prefillRoofPath = `M ${logX(minX)} ${logY(prefillSlopeMinY)} L ${prefillRidgeX} ${prefillRidgeY} L ${logX(maxX)} ${prefillRidgeY}`;

  const ridgeLabelOnLeft = Math.min(ridgeX, prefillRidgeX) > padL + 165;
  const ridgeLabelX = ridgeLabelOnLeft ? ridgeX - 6 : ridgeX + 6;
  const ridgeLabelAnchor = ridgeLabelOnLeft ? "end" : "start";
  const ridgeLabelY = padT + plotH - 10;
  const prefillRidgeLabelX = ridgeLabelOnLeft ? prefillRidgeX - 6 : prefillRidgeX + 6;
  const prefillRidgeLabelY = padT + plotH - 28;
  const prefillPeakHigher = roofline.prefillPeakComputeTflops > roofline.decodePeakComputeTflops;
  const prefillPeakLabelY = prefillPeakHigher
    ? Math.max(16, prefillRidgeY - 8)
    : Math.min(padT + plotH - 42, prefillRidgeY + 15);
  const decodePeakLabelY = hasSplitRoof
    ? prefillPeakHigher
      ? Math.min(padT + plotH - 42, ridgeY + 15)
      : Math.max(16, ridgeY - 8)
    : Math.max(14, ridgeY - 11);
  const shortDecodePrecision =
    roofline.computePrecisionLabel.split("（")[0] ?? roofline.computePrecisionLabel;

  const points = [
    {
      id: "kv",
      label: `Decode KV (${roofline.decodeKvAttnIntensityFlopsPerByte.toFixed(1)})`,
      xVal: roofline.decodeKvAttnIntensityFlopsPerByte,
      yVal: roofline.decodeKvAttnAchievedTflops,
      color: "#4c65b6",
      dy: -12,
    },
    {
      id: "dec",
      label: `Decode GEMM (${roofline.decodeLinearIntensityFlopsPerByte.toFixed(1)})`,
      xVal: roofline.decodeLinearIntensityFlopsPerByte,
      yVal: roofline.decodeLinearAchievedTflops,
      color: "#c78300",
      dy: 20,
    },
    {
      id: "pre",
      label: `Prefill (${roofline.prefillIntensityFlopsPerByte.toFixed(0)})`,
      xVal: roofline.prefillIntensityFlopsPerByte,
      yVal: roofline.prefillAchievedTflops,
      color: "#087f73",
      dy: -11,
    },
  ];
  const xTicks = [1, 4, 16, 64, 256, 1024].filter((t) => t <= maxX);

  return (
    <div className="wt-calc-roofline-chart" style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={
          hasSplitRoof
            ? `Roofline 对照图：Prefill 脊点 ${roofline.prefillRidgePointFlopsPerByte.toFixed(1)} FLOP/B，Decode 脊点 ${roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B`
            : `Roofline 对照图：脊点 ${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`
        }
        style={{ display: "block", maxWidth: width, height: "auto", background: "transparent" }}
      >
        {xTicks.map((t) => (
          <g key={t}>
            <line
              x1={logX(t)}
              x2={logX(t)}
              y1={padT}
              y2={padT + plotH}
              stroke="#d8d8cf"
              strokeDasharray="3 4"
            />
            <text
              x={logX(t)}
              y={padT + plotH + 18}
              textAnchor="middle"
              fontSize="13.5"
              fill="#66716d"
              fontFamily="var(--font-mono)"
            >
              {t}
            </text>
          </g>
        ))}
        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="#66716d" />
        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#66716d" />
        <line
          x1={ridgeX}
          x2={ridgeX}
          y1={padT}
          y2={padT + plotH}
          stroke="#b54237"
          strokeDasharray="5 4"
          strokeWidth="1.5"
        />
        {hasSplitRoof && (
          <>
            <line
              x1={prefillRidgeX}
              x2={prefillRidgeX}
              y1={padT}
              y2={padT + plotH}
              stroke="#087f73"
              strokeDasharray="4 4"
              strokeWidth="1.3"
              strokeOpacity="0.75"
            />
            <path
              d={prefillRoofPath}
              data-testid="roofline-prefill-ceiling"
              fill="none"
              stroke="#087f73"
              strokeWidth="2.2"
              strokeDasharray="6 4"
            />
          </>
        )}
        <path d={roofPath} fill="none" stroke="#17211f" strokeWidth="2.4" />
        {hasSplitRoof && (
          <text
            x={prefillRidgeLabelX}
            y={prefillRidgeLabelY}
            textAnchor={ridgeLabelAnchor}
            fontSize="12.5"
            fontWeight="700"
            fill="#087f73"
            paintOrder="stroke"
            stroke="#fbfaf6"
            strokeWidth={3.5}
            strokeLinejoin="round"
          >
            Prefill 脊点 {roofline.prefillRidgePointFlopsPerByte.toFixed(1)} FLOP/B
          </text>
        )}
        <text
          x={ridgeLabelX}
          y={ridgeLabelY}
          textAnchor={ridgeLabelAnchor}
          fontSize={hasSplitRoof ? "12.5" : "13.5"}
          fontWeight="700"
          fill="#b54237"
          paintOrder="stroke"
          stroke="#fbfaf6"
          strokeWidth={3.5}
          strokeLinejoin="round"
        >
          {hasSplitRoof
            ? `Decode 脊点 ${roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B`
            : `脊点 ${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`}
        </text>
        {hasSplitRoof && (
          <text
            x={padL + 6}
            y={prefillPeakLabelY}
            fontSize="12.5"
            fill="#087f73"
            fontWeight="700"
            paintOrder="stroke"
            stroke="#fbfaf6"
            strokeWidth={3.5}
            strokeLinejoin="round"
          >
            Prefill 峰值 {roofline.prefillPeakComputeTflops}{" "}
            {roofline.prefillPrecisionLabel.includes("INT") ? "TOPS" : "TFLOP/s"} (
            {roofline.prefillPrecisionLabel})
          </text>
        )}
        <text
          x={padL + 6}
          y={decodePeakLabelY}
          fontSize={hasSplitRoof ? "12.5" : "13.5"}
          fill="#17211f"
          fontWeight="600"
          paintOrder="stroke"
          stroke="#fbfaf6"
          strokeWidth={3.5}
          strokeLinejoin="round"
        >
          {hasSplitRoof
            ? `Decode 峰值 ${roofline.decodePeakComputeTflops} ${shortDecodePrecision.includes("INT") ? "TOPS" : "TFLOP/s"} (${shortDecodePrecision})`
            : `峰值 ${roofline.peakComputeTflops} ${roofline.computePrecisionLabel.includes("INT") ? "TOPS" : "TFLOP/s"} (${roofline.computePrecisionLabel})`}
        </text>
        {points.map((pt) => {
          const cx = logX(pt.xVal);
          const cy = logY(pt.yVal);
          const anchor = cx > width - 155 ? "end" : "start";
          const dx = anchor === "end" ? -10 : 10;
          const labelY =
            pt.id === "pre" ? Math.max(16, cy - 11) : Math.min(padT + plotH - 6, Math.max(14, cy + pt.dy));
          return (
            <g key={pt.id}>
              <circle
                cx={cx}
                cy={cy}
                r="6.5"
                data-point-id={pt.id}
                data-achieved-tflops={pt.yVal.toFixed(1)}
                fill={pt.color}
                stroke="#fbfaf6"
                strokeWidth="2"
              />
              <text
                x={cx + dx}
                y={labelY}
                textAnchor={anchor}
                fontSize="13.5"
                fontWeight="700"
                fill={pt.color}
                paintOrder="stroke"
                stroke="#fbfaf6"
                strokeWidth={3.5}
                strokeLinejoin="round"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
        <text x={padL + plotW / 2} y={height - 6} textAnchor="middle" fontSize="13.5" fill="#66716d">
          算术强度（FLOP / Byte，对数轴）
        </text>
        <text
          x={16}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize="13.5"
          fill="#66716d"
          transform={`rotate(-90 16 ${padT + plotH / 2})`}
        >
          {roofline.prefillPrecisionLabel.includes("INT") || roofline.computePrecisionLabel.includes("INT")
            ? hasSplitRoof
              ? "TFLOP/s · TOPS"
              : "TOPS"
            : "TFLOP/s"}
        </text>
      </svg>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "token" | "weight" | "kv" | "danger";
}) {
  const accentColor =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "token"
        ? "var(--color-token)"
        : tone === "weight"
          ? "var(--color-weight)"
          : tone === "kv"
            ? "var(--color-kv)"
            : tone === "accent"
              ? "var(--color-accent)"
              : "var(--color-ink)";
  return (
    <div
      style={{
        padding: "11px 13px",
        borderRadius: "var(--radius-field)",
        border: "1px solid var(--color-line)",
        background: "var(--color-surface-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <span style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}>{label}</span>
      <strong style={{ fontSize: 18, lineHeight: 1.3, color: accentColor, fontFamily: "var(--font-mono)" }}>
        {value}
      </strong>
      {sub && <span style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>{sub}</span>}
    </div>
  );
}

function QuickScreenBody({ plan }: { plan: DeployPlanReport }) {
  const params = useMemo(() => analyzeParams(plan.spec), [plan.spec]);
  const { q1Fit, q2Capacity } = plan.fourQuestions;
  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
    gap: 10,
  };

  return (
    <div className="wt-calc-quick" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={gridStyle}>
        <MetricTile
          label="总参数 / 激活参数"
          value={`${fmtCount(params.total)} / ${fmtCount(params.active)}`}
          sub={plan.isMoe ? "MoE 稀疏激活架构" : "稠密架构（全参激活）"}
          tone="token"
        />
        <MetricTile
          label="单卡常驻权重（Stage 3）"
          value={fmtGiB(plan.stages[2].pointEstimateBytes)}
          sub={`区间 ${fmtGiBRange(plan.stages[2].lowBytes, plan.stages[2].highBytes)} · ${plan.inputSummary.effectiveWeightPrecision}`}
          tone="weight"
        />
        <MetricTile
          label={`单 token / 每 ${q2Capacity.effectiveBlockSize}-tok 块 KV`}
          value={`${fmtBytes(q2Capacity.kvBytesPerTokenPerRank)} / ${fmtBytes(q2Capacity.kvBytesPerBlock)}`}
          sub={`可用 KV 池 ${fmtGiBRange(q2Capacity.kvPoolLowBytes, q2Capacity.kvPoolHighBytes)}`}
          tone="kv"
        />
        <MetricTile
          label="建议最少卡数"
          value={`${q2Capacity.minCardsRecommended} 逻辑卡`}
          sub={`约 ${q2Capacity.minPhysicalCardsRecommended} 张物理卡（当前 ${q2Capacity.currentTotalCards} 逻辑卡）`}
          tone={q2Capacity.oomStatus === "fits" ? "token" : "danger"}
        />
      </div>
      <HbmStackedBar plan={plan} compact />
      {(q1Fit.blockers.length > 0 || q1Fit.silentRewrites.length > 0) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "11px 14px",
            borderRadius: "var(--radius-field)",
            border: `1px solid ${q1Fit.blockers.length > 0 ? "var(--color-danger)" : "var(--color-weight)"}`,
            background:
              q1Fit.blockers.length > 0
                ? "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-elevated))"
                : "var(--color-weight-soft)",
          }}
        >
          {q1Fit.blockers.map((b) => (
            <div key={b.id} style={{ fontSize: 13.5, color: "var(--color-danger)" }}>
              <strong>[阻塞] {b.title}：</strong>
              {b.message}
              {b.remediation ? `（建议：${b.remediation}）` : ""}
            </div>
          ))}
          {q1Fit.silentRewrites.map((rw) => (
            <div key={rw.id} style={{ fontSize: 13.5, color: "var(--color-warning)" }}>
              <strong>[静默改写] {rw.title}：</strong>
              {rw.fromValue} → {rw.toValue}。{rw.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MinimalRooflineBody({ plan }: { plan: DeployPlanReport }) {
  const { roofline } = plan;
  const { q2Capacity, q3Roofline } = plan.fourQuestions;
  const hasSplitRoof = Math.abs(roofline.prefillPeakComputeTflops - roofline.decodePeakComputeTflops) > 1e-6;
  const shortDecodePrecision =
    roofline.computePrecisionLabel.split("（")[0] ?? roofline.computePrecisionLabel;
  const moeNote =
    roofline.moeRouterDilutedRows !== null && roofline.localExpertsPerRank !== null
      ? `MoE 路由稀释：M_eff = (B × topK) / 本卡专家(${roofline.localExpertsPerRank}) = ${roofline.moeRouterDilutedRows.toFixed(2)}`
      : `稠密层有效行数 M_eff = B = ${roofline.decodeLinearMEff.toFixed(0)}`;

  return (
    <div className="wt-calc-minimal" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <MetricTile
          label={hasSplitRoof ? "分阶段脊点（Prefill / Decode）" : "硬件脊点（算力 / 带宽）"}
          value={
            hasSplitRoof
              ? `${roofline.prefillRidgePointFlopsPerByte.toFixed(1)} / ${roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B`
              : `${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`
          }
          sub={
            hasSplitRoof
              ? `Prefill ${roofline.prefillPeakComputeTflops} (${roofline.prefillPrecisionLabel}) · Decode ${roofline.decodePeakComputeTflops} (${shortDecodePrecision})`
              : `${roofline.peakComputeTflops} ${roofline.computePrecisionLabel} ÷ ${roofline.hbmBandwidthGBs} GB/s`
          }
          tone="danger"
        />
        <MetricTile
          label={`Prefill（${roofline.prefillTokens} tok）`}
          value={`${roofline.prefillIntensityFlopsPerByte.toFixed(1)} FLOP/B`}
          sub={
            roofline.prefillRegime === "compute-bound" ? "算力墙（Compute-bound）" : "带宽墙（Memory-bound）"
          }
          tone="token"
        />
        <MetricTile
          label={`Decode GEMM（B=${roofline.decodeBatchSize}）`}
          value={`${roofline.decodeLinearIntensityFlopsPerByte.toFixed(1)} FLOP/B`}
          sub={moeNote}
          tone="weight"
        />
        <MetricTile
          label={roofline.attentionModeLabel}
          value={`${roofline.decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B`}
          sub={`单步 KV/态流量 ${fmtBytes(roofline.decodeKvTrafficBytesPerStep)}（有效 ctx=${roofline.effectiveDecodeContextLen}）`}
          tone="kv"
        />
      </div>
      <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <RooflineSvgChart roofline={roofline} compact />
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink-muted)" }}>{q3Roofline.summary}</p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 16px",
            paddingTop: 8,
            borderTop: "1px solid var(--color-line)",
            fontSize: 13.5,
          }}
        >
          <span>
            可用 KV 池：
            <strong>{fmtGiBRange(q2Capacity.kvPoolLowBytes, q2Capacity.kvPoolHighBytes)}</strong>
          </span>
          <span>
            可用块数：
            <strong>
              [{q2Capacity.usableBlocksRange[0]}, {q2Capacity.usableBlocksRange[1]}]
            </strong>
          </span>
          <span>
            满长并发（{plan.inputSummary.maxModelLen}）：
            <strong>
              [{q2Capacity.maxConcurrencyRange[0].toFixed(1)}x, {q2Capacity.maxConcurrencyRange[1].toFixed(1)}
              x]
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function DeployVerdictStrip({ plan }: { plan: DeployPlanReport }) {
  const { q1Fit, q2Capacity, q3Roofline } = plan.fourQuestions;
  const isBlocked = q1Fit.verdict === "blocked" || q2Capacity.oomStatus !== "fits";
  const isWarn = !isBlocked && q1Fit.verdict === "warn";
  const stripTone = isBlocked ? "is-blocked" : isWarn ? "is-warn" : "is-pass";
  const fitText =
    q1Fit.verdict === "blocked"
      ? "存在配置阻塞"
      : q2Capacity.oomStatus === "fits"
        ? isWarn
          ? "可装下（有提示）"
          : "装得下 ✓"
        : "显存不足（需加卡或降精度）";
  const fitClass = isBlocked ? "is-danger" : isWarn ? "is-warning" : "is-token";
  const bottleneckLabel =
    q3Roofline.primaryBottleneck === "memory-bound"
      ? "带宽墙（Memory-bound）"
      : q3Roofline.primaryBottleneck === "compute-bound"
        ? "算力墙（Compute-bound）"
        : q3Roofline.primaryBottleneck;

  return (
    <div className={`wt-verdict-strip ${stripTone}`} data-testid="calc-verdict-strip" role="status">
      <div className="wt-verdict-item">
        <span className="wt-verdict-label">当前配置能否装下</span>
        <span className={`wt-verdict-value ${fitClass}`}>{fitText}</span>
        <span className="wt-verdict-sub">
          {plan.card.shortName} · {plan.inputSummary.effectiveWeightPrecision} · TP={plan.inputSummary.tpSize}
        </span>
      </div>
      <div className="wt-verdict-item">
        <span className="wt-verdict-label">建议最少卡数</span>
        <span className="wt-verdict-value">{q2Capacity.minCardsRecommended} 逻辑卡</span>
        <span className="wt-verdict-sub">
          约 {q2Capacity.minPhysicalCardsRecommended} 张物理卡（当前 {q2Capacity.currentTotalCards} 逻辑卡）
        </span>
      </div>
      <div className="wt-verdict-item">
        <span className="wt-verdict-label">单卡可用 KV 缓存</span>
        <span className="wt-verdict-value is-token">
          {fmtGiBRange(q2Capacity.kvPoolLowBytes, q2Capacity.kvPoolHighBytes)}
        </span>
        <span className="wt-verdict-sub">
          满长并发 [{q2Capacity.maxConcurrencyRange[0].toFixed(1)}x,{" "}
          {q2Capacity.maxConcurrencyRange[1].toFixed(1)}x]
        </span>
      </div>
      <div className="wt-verdict-item">
        <span className="wt-verdict-label">当前主要瓶颈</span>
        <span className="wt-verdict-value">{bottleneckLabel}</span>
        <span className="wt-verdict-sub">
          {Math.abs(plan.roofline.prefillPeakComputeTflops - plan.roofline.decodePeakComputeTflops) > 1e-6
            ? `Prefill 脊点 ${plan.roofline.prefillRidgePointFlopsPerByte.toFixed(1)} / Decode ${plan.roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B`
            : `硬件脊点 ${plan.roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`}
        </span>
      </div>
    </div>
  );
}

function FourQuestionsGrid({
  plan,
  hardware3dHref,
  onHandoffToDoctor,
}: {
  plan: DeployPlanReport;
  hardware3dHref: string;
  onHandoffToDoctor?: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const { q1Fit, q2Capacity, q3Roofline, q4Recommendation } = plan.fourQuestions;
  const currentPlanValid = q1Fit.verdict !== "blocked" && q2Capacity.oomStatus === "fits";
  const currentPlanCli = useMemo(() => buildCurrentPlanCliHint(plan), [plan]);
  const activeCli = currentPlanValid ? currentPlanCli : q4Recommendation.cliHint;
  const q1Tone =
    q1Fit.verdict === "blocked"
      ? "var(--color-danger)"
      : q1Fit.verdict === "warn"
        ? "var(--color-warning)"
        : "var(--color-token)";
  const q2Tone = q2Capacity.oomStatus === "fits" ? "var(--color-token)" : "var(--color-danger)";

  const handleCopyCli = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(activeCli).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  return (
    <div
      className="wt-calc-4q-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 12,
      }}
    >
      <article className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15 }}>Q1 · 模型与精度兼容吗</strong>
          <span
            style={{
              padding: "2px 9px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 700,
              color: q1Tone,
              border: `1px solid ${q1Tone}`,
            }}
          >
            {q1Fit.verdict === "blocked"
              ? "阻塞"
              : q1Fit.verdict === "warn"
                ? "可跑但有改写/风险"
                : "兼容通过"}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)" }}>{q1Fit.summary}</p>
        {q1Fit.blockers.map((b) => (
          <div key={b.id} style={{ fontSize: 13.5, color: "var(--color-danger)" }}>
            • <strong>{b.title}</strong>：{b.message}
            {b.remediation ? ` 建议：${b.remediation}` : ""}
          </div>
        ))}
        {q1Fit.silentRewrites.map((rw) => (
          <div key={rw.id} style={{ fontSize: 13.5, color: "var(--color-warning)" }}>
            • <strong>静默改写 {rw.param}</strong>（{rw.fromValue} → {rw.toValue}）：{rw.message}
          </div>
        ))}
        {q1Fit.warnings.slice(0, 3).map((w) => (
          <div key={w.id} style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}>
            • <strong>提示</strong>：{w.title} — {w.message}
          </div>
        ))}
      </article>

      <article className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15 }}>Q2 · 显存装得下吗，剩多少 KV</strong>
          <span
            style={{
              padding: "2px 9px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 700,
              color: q2Tone,
              border: `1px solid ${q2Tone}`,
            }}
          >
            {q2Capacity.oomStatus === "fits" ? "装得下" : q2Capacity.oomStatus}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)" }}>{q2Capacity.summary}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13.5 }}>
          <span>
            最少建议卡数：<strong>{q2Capacity.minCardsRecommended}</strong>（
            {q2Capacity.minPhysicalCardsRecommended} 物理卡）
          </span>
          <span>
            单 token 分页 KV：<strong>{fmtBytes(q2Capacity.perTokenPagedKvBytes)}</strong>
          </span>
          {q2Capacity.perSeqFixedLinearStateBytes > 0 && (
            <span>
              单序列线性状态：<strong>{fmtBytes(q2Capacity.perSeqFixedLinearStateBytes)}</strong>
            </span>
          )}
          <span>
            KV 块（{q2Capacity.effectiveBlockSize} tok）：
            <strong>{fmtBytes(q2Capacity.kvBytesPerBlock)}</strong>
          </span>
          <span>
            总词元槽位：
            <strong>{q2Capacity.totalKvTokenSlotsPoint.toLocaleString()}</strong>
          </span>
        </div>
      </article>

      <article className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15 }}>Q3 · 跑起来卡算力还是卡带宽</strong>
          <span className="wt-stat-pill is-warn">{q3Roofline.primaryBottleneck}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)" }}>{q3Roofline.summary}</p>
        {plan.roofline.moeRouterDilutedRows !== null && (
          <div style={{ fontSize: 13.5, color: "var(--color-warning)" }}>
            MoE 路由稀释后单专家有效行 M_eff = {plan.roofline.moeRouterDilutedRows.toFixed(2)}（每卡{" "}
            {plan.roofline.localExpertsPerRank} 个本地专家），Decode 线性层更难爬过脊点。
          </div>
        )}
      </article>

      <article className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 15 }}>
            {currentPlanValid ? "Q4 · 当前方案启动命令（可直接去体检）" : "Q4 · 推荐起步拓扑与启动命令"}
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="wt-preset-btn" onClick={handleCopyCli}>
              {copied ? "已复制命令" : "复制命令"}
            </button>
            {onHandoffToDoctor && (
              <button
                type="button"
                className="wt-assistant-btn"
                data-testid="handoff-to-doctor"
                onClick={onHandoffToDoctor}
              >
                送去配置体检 →
              </button>
            )}
            <a
              href={hardware3dHref}
              className="wt-assistant-btn"
              data-testid="calc-open-3d-hardware"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              在 3D 整机中透视此方案 →
            </a>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)" }}>
          {currentPlanValid
            ? "当前配置可装下，已按你选定的并行度、上下文与图模式生成启动命令："
            : q4Recommendation.rationale}
        </p>
        <pre
          data-testid="calc-handoff-cli"
          style={{
            margin: 0,
            padding: "9px 11px",
            borderRadius: 8,
            background: "var(--color-surface-sunken)",
            border: "1px solid var(--color-line)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {activeCli}
        </pre>
        {currentPlanValid && currentPlanCli !== q4Recommendation.cliHint && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-ink-muted)" }}>
            <strong>精简起步参考：</strong>
            {q4Recommendation.rationale}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {q4Recommendation.relatedWikiIds.map((id) => (
            <ToolDeepLinkChip key={id} link={resolveSafeDeepLink(id)} />
          ))}
        </div>
      </article>
    </div>
  );
}

function SevenStageSection({ plan }: { plan: DeployPlanReport }) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  return (
    <section className="wt-section wt-calc-stages">
      <div className="wt-section-head">
        <h3 className="wt-section-title">单卡显存 7 级冷启动账目拆解</h3>
        <span className="wt-section-meta">
          预算内 = 总显存 × u（{fmtGiB(plan.requestedBytes)}）｜ 预算外 1−u（
          {fmtGiB(plan.unbudgetedHeadroomBytes)}）用来支付录图 + 150 MiB 裕度；HCCL 归入非 Torch
          固定区，不重复扣减
        </span>
      </div>

      <HbmStackedBar plan={plan} />

      <div
        className="wt-card"
        style={{
          padding: 0,
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13.5,
          }}
        >
          <thead>
            <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-line)" }}>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>阶段</th>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>账目名称</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>点估计</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>估算区间 [低, 高]</th>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>证据等级</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>公式与源码</th>
            </tr>
          </thead>
          <tbody>
            {plan.stages.map((st) => {
              const ev = EVIDENCE_META[st.evidenceLevel];
              const isOpen = expandedStage === st.stageIndex;
              return (
                <Fragment key={st.id}>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--color-line)",
                      background: isOpen ? "var(--color-canvas)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      S{st.stageIndex}
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: 600 }}>{st.title}</td>
                    <td
                      style={{
                        padding: "9px 12px",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                      }}
                    >
                      {fmtGiB(st.pointEstimateBytes)}
                    </td>
                    <td
                      style={{
                        padding: "9px 12px",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-ink-muted)",
                      }}
                    >
                      {fmtGiBRange(st.lowBytes, st.highBytes)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          color: ev.color,
                          background: ev.bg,
                        }}
                      >
                        {ev.tag}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="wt-preset-btn"
                        style={{ padding: "3px 10px", fontSize: 13 }}
                        onClick={() => setExpandedStage(isOpen ? null : st.stageIndex)}
                      >
                        {isOpen ? "收起" : "展开明细"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${st.id}-detail`} style={{ borderBottom: "1px solid var(--color-line)" }}>
                      <td colSpan={6} style={{ padding: "11px 14px", background: "var(--color-surface)" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 6 }}>
                          <strong>公式：</strong>
                          {st.formula}
                        </div>
                        {st.notes.map((n) => (
                          <div
                            key={n}
                            style={{ fontSize: 13.5, color: "var(--color-ink-muted)", marginBottom: 4 }}
                          >
                            • {n}
                          </div>
                        ))}
                        <SourceRefList sources={st.sources} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="wt-card wt-calc-hccl-box"
        style={{
          borderColor: "color-mix(in srgb, var(--color-comm) 45%, var(--color-line))",
          background: "color-mix(in srgb, var(--color-comm-soft) 50%, var(--color-surface-elevated))",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ color: "var(--color-comm)", fontSize: 14.5 }}>
            Stage 5 · HCCL 通信域具象化清单 &amp; Workspace/HCCL 不重扣守恒
          </strong>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 700 }}>
            独立具象化 {plan.hcclEstimate.uniqueMaterializedGroups.length} 组 · 合计{" "}
            {plan.hcclEstimate.totalMaterializedMiB} MiB（按 reuse_domain 去重省下{" "}
            {plan.hcclEstimate.deduplicatedGroupCount} 组）
          </span>
        </div>
        <div
          style={{
            padding: "9px 12px",
            borderRadius: 10,
            background: "var(--color-surface-elevated)",
            border: "1px solid color-mix(in srgb, var(--color-comm) 35%, var(--color-line))",
            fontSize: 13.5,
            color: "var(--color-ink)",
          }}
        >
          <strong>严禁在 profile_run 峰值之上二次重扣 HCCL：</strong>
          {plan.workspaceHcclOverlap.explanation}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {plan.hcclEstimate.uniqueMaterializedGroups.map((g) => (
            <div
              key={`${g.groupName}-${g.ranksSignature}-${g.reuseDomain}`}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-line)",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
              }}
            >
              <strong>{g.groupName}</strong> · {g.bufferSizeMiB ?? 0} MiB · domain={g.reuseDomain} · ranks=
              {g.ranksSignature}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatReconcileValue(value: number | null, unit: "GiB" | "tokens"): string {
  if (value === null) return "—";
  if (unit === "tokens") return `${Math.round(value).toLocaleString()} tok`;
  return `${value.toFixed(2)} GiB`;
}

function formatReconcileDelta(delta: number | null, unit: "GiB" | "tokens"): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  if (unit === "tokens") return `${sign}${Math.round(delta).toLocaleString()} tok`;
  return `${sign}${delta.toFixed(2)} GiB`;
}

function ReconcileLogSection({
  plan,
  deployAnalysis,
  hardware3dHref,
  logText,
  onLogTextChange,
  activeTemplateId,
  onApplyTemplate,
}: {
  plan: DeployPlanReport;
  deployAnalysis?: DeployChatAnalysisPayload | undefined;
  hardware3dHref: string;
  logText: string;
  onLogTextChange: (next: string) => void;
  activeTemplateId: string | null;
  onApplyTemplate: (tpl: SampleStartupLogTemplate) => void;
}) {
  const assistant = useOptionalWikiAssistant();
  const parsed = useMemo(() => parseAscendStartupLog(logText), [logText]);
  const recon: LogReconciliationReport = useMemo(() => reconcileStartupLog(plan, parsed), [plan, parsed]);

  const handleAskAssistant = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!assistant) return;
    const lines = recon.items
      .filter((it) => it.status !== "missing")
      .map(
        (it) =>
          `- ${it.title}: 实测 ${formatReconcileValue(it.measured, it.unit)} vs 预测 [${it.predictedLow}, ${it.predictedHigh}] ${it.unit}（${RECON_STATUS_META[it.status].label}，Δ=${formatReconcileDelta(it.delta, it.unit)}）`,
      )
      .join("\n");
    const rawPrompt = [
      `我在昇腾 ${plan.card.name} 上用 ${plan.spec.name}（${plan.inputSummary.weightPrecision}，TP=${plan.inputSummary.tpSize}，PP=${plan.inputSummary.ppSize}，EP=${plan.inputSummary.enableEp ? plan.inputSummary.epWorldSize : "关"}，u=${plan.inputSummary.gpuMemoryUtilization}）做启动日志对账：`,
      recon.summary,
      lines,
      "请结合 vLLM-Ascend 7 级显存账目与 HCCL 不二次扣减守恒，帮我分析偏差根因和调参建议。",
    ].join("\n\n");
    const { sanitized, redactionCount } = sanitizeDiagnosticText(rawPrompt);
    assistant.openChat({
      pendingAttachment: {
        title: `启动日志对账脱敏快照（${plan.spec.name} · ${plan.card.shortName}）`,
        summary: recon.summary,
        sanitizedBlock: sanitized,
        redactionCount,
        suggestedQuestion: `请结合 ${plan.spec.name} 在 ${plan.card.shortName} 上的 7 级显存对账结果，分析偏差根因与调参建议。`,
        ...(deployAnalysis ? { analysis: deployAnalysis } : {}),
      },
      submit: false,
      trigger: event.currentTarget,
    });
  };

  return (
    <section className="wt-section wt-calc-reconcile">
      <div className="wt-presets">
        <span className="wt-presets-label">示例启动日志（点击自动同步上方模型与卡型）：</span>
        {SAMPLE_ASCEND_STARTUP_LOGS.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={`wt-preset-btn${activeTemplateId === tpl.id ? " is-active" : ""}`}
            onClick={() => onApplyTemplate(tpl)}
          >
            <span>{tpl.title}</span>
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 999,
                fontSize: 12,
                background: tpl.isReferenceTemplate ? "var(--color-weight-soft)" : "var(--color-kv-soft)",
                color: tpl.isReferenceTemplate ? "var(--color-warning)" : "var(--color-kv)",
                fontWeight: 700,
              }}
            >
              {tpl.isReferenceTemplate ? "参考模板 · 非真机实测" : "910B3 真机实测 [M]"}
            </span>
          </button>
        ))}
        <button type="button" className="wt-preset-btn" onClick={() => onLogTextChange("")}>
          清空日志
        </button>
      </div>

      <div className="wt-editor-card">
        <div className="wt-editor-head">
          <span className="wt-editor-title">
            粘贴真实 vllm serve 启动日志（自动解析权重 / profile_run / KV / ACLGraph）
          </span>
          <span className="wt-baseline-pill">
            对照基准：{plan.spec.name} · {plan.card.shortName} · TP={plan.inputSummary.tpSize} · u=
            {plan.inputSummary.gpuMemoryUtilization.toFixed(2)}
          </span>
        </div>
        <textarea
          className="wt-textarea"
          data-testid="calc-log-input"
          value={logText}
          onChange={(e) => onLogTextChange(e.target.value)}
          placeholder="粘贴包含 Loading model weights took / Memory profiling takes / Available KV cache memory / NPU KV cache size / Graph capturing finished / Actual usage 的启动日志..."
        />
      </div>

      <div
        className={`wt-summary-bar${recon.overallStatus === "aligned" ? " is-pass" : recon.overallStatus === "oom-risk" ? " is-blocked" : ""}`}
      >
        <div className="wt-summary-left">
          <span
            className={
              recon.overallStatus === "oom-risk"
                ? "wt-blocked-banner"
                : recon.overallStatus === "aligned"
                  ? "wt-pass-banner"
                  : "wt-warn-banner"
            }
          >
            {recon.summary}
          </span>
          <span className="wt-stat-pill">已提取行：{parsed.matchedLines.length}</span>
          {recon.impliedKvBytesPerToken !== null && (
            <span className="wt-stat-pill is-warn">
              日志反推单 token KV：{fmtBytes(recon.impliedKvBytesPerToken)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {assistant && (
            <button type="button" className="wt-assistant-btn" onClick={handleAskAssistant}>
              送入问答助手分析偏差
            </button>
          )}
          <a
            href={hardware3dHref}
            className="wt-assistant-btn"
            data-testid="calc-open-3d-hardware"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            在 3D 整机中透视此方案 →
          </a>
        </div>
      </div>

      <div
        data-testid="hccl-no-double-count-guard"
        style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-field)",
          border: "1px solid color-mix(in srgb, var(--color-comm) 42%, var(--color-line))",
          background: "color-mix(in srgb, var(--color-comm-soft) 55%, var(--color-surface-elevated))",
          fontSize: 13.5,
          color: "var(--color-ink)",
        }}
      >
        <strong style={{ color: "var(--color-comm)" }}>
          HCCL 不二次扣减守恒（hcclDoubleCounted: {String(recon.hcclDoubleCounted)}）：
        </strong>
        {recon.hcclAccountingNote}
      </div>

      {recon.logErrors.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-danger)",
            background: "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface-elevated))",
            color: "var(--color-danger)",
            fontSize: 13.5,
          }}
        >
          <strong>日志中检测到启动异常 / OOM 报错：</strong>
          {recon.logErrors.map((err) => (
            <div key={err} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 4 }}>
              {err}
            </div>
          ))}
        </div>
      )}

      <div className="wt-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-line)" }}>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>对账项</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>静态估算区间</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>日志实测值</th>
              <th style={{ textAlign: "right", padding: "9px 12px" }}>偏差 Δ</th>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>状态</th>
              <th style={{ textAlign: "left", padding: "9px 12px" }}>诊断结论与可能成因</th>
            </tr>
          </thead>
          <tbody>
            {recon.items.map((it) => {
              const st = RECON_STATUS_META[it.status];
              return (
                <tr key={it.id} style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600 }}>{it.title}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    [{it.unit === "tokens" ? it.predictedLow.toLocaleString() : it.predictedLow.toFixed(2)},{" "}
                    {it.unit === "tokens" ? it.predictedHigh.toLocaleString() : it.predictedHigh.toFixed(2)}]{" "}
                    {it.unit === "tokens" ? "tok" : "GiB"}
                  </td>
                  <td
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                    }}
                  >
                    {formatReconcileValue(it.measured, it.unit)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {formatReconcileDelta(it.delta, it.unit)}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: st.color,
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--color-ink-muted)" }}>
                    <div style={{ color: "var(--color-ink)" }}>{it.summary}</div>
                    {it.likelyRootCauses.map((c) => (
                      <div key={c} style={{ fontSize: 13, marginTop: 3 }}>
                        • {c}
                      </div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface CalcState {
  version: RuleVersion;
  cardId: AscendCalcCardId;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  weightNzMode: 0 | 1 | 2;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  pcpSize: number;
  dcpSize: number;
  enableEp: boolean;
  gpuMemoryUtilization: number;
  maxModelLen: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  cudagraphMode: CudaGraphMode;
  useV2ModelRunner: boolean | undefined;
  prefillTokens: number;
  decodeBatchSize: number;
  decodeContextLen: number;
}

function CalcControlsBar({
  mode,
  state,
  isMoe,
  onPatch,
}: {
  mode: "quick-screen" | "minimal" | "full";
  state: CalcState;
  isMoe: boolean;
  onPatch: (patch: Partial<CalcState>) => void;
}) {
  return (
    <div className="wt-controls-bar wt-calc-controls">
      <label className="wt-field" style={{ minWidth: 220 }}>
        <span className="wt-field-label">昇腾硬件卡型</span>
        <select
          className="wt-select"
          value={state.cardId}
          onChange={(e) => onPatch({ cardId: e.target.value as AscendCalcCardId })}
        >
          {ASCEND_CALC_CARDS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="wt-field" style={{ minWidth: 185 }}>
        <span className="wt-field-label">权重精度</span>
        <select
          className="wt-select"
          value={state.weightPrecision}
          onChange={(e) => onPatch({ weightPrecision: e.target.value as WeightPrecision })}
        >
          {PRECISION_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="wt-field" style={{ minWidth: 155 }}>
        <span className="wt-field-label">张量并行 TP（卡数）</span>
        <div className="wt-segmented" style={{ padding: 2 }}>
          {[1, 2, 4, 8].map((tp) => (
            <button
              key={tp}
              type="button"
              className={`wt-seg-btn${state.tpSize === tp ? " is-active" : ""}`}
              style={{ padding: "4px 10px" }}
              onClick={() => onPatch({ tpSize: tp })}
            >
              {tp}
            </button>
          ))}
        </div>
      </div>

      {mode !== "quick-screen" && isMoe && (
        <label className="wt-checkbox-label">
          <input
            type="checkbox"
            checked={state.enableEp}
            onChange={(e) => onPatch({ enableEp: e.target.checked })}
          />
          <span>开启专家并行 EP</span>
        </label>
      )}

      {mode === "minimal" && (
        <>
          <label className="wt-field" style={{ minWidth: 120 }}>
            <span className="wt-field-label">Prefill tokens</span>
            <input
              className="wt-input"
              type="number"
              min={32}
              max={65536}
              step={128}
              value={state.prefillTokens}
              onChange={(e) => onPatch({ prefillTokens: Math.max(1, Number(e.target.value) || 512) })}
            />
          </label>
          <label className="wt-field" style={{ minWidth: 115 }}>
            <span className="wt-field-label">Decode 批 B</span>
            <input
              className="wt-input"
              type="number"
              min={1}
              max={512}
              value={state.decodeBatchSize}
              onChange={(e) => onPatch({ decodeBatchSize: Math.max(1, Number(e.target.value) || 16) })}
            />
          </label>
          <label className="wt-field" style={{ minWidth: 130 }}>
            <span className="wt-field-label">Decode 上下文长</span>
            <input
              className="wt-input"
              type="number"
              min={128}
              max={131072}
              step={512}
              value={state.decodeContextLen}
              onChange={(e) => onPatch({ decodeContextLen: Math.max(128, Number(e.target.value) || 4096) })}
            />
          </label>
        </>
      )}

      {mode === "full" && (
        <>
          <label className="wt-field" style={{ minWidth: 145 }}>
            <span className="wt-field-label">目标上下文长度</span>
            <input
              className="wt-input"
              type="number"
              min={512}
              max={131072}
              step={1024}
              value={state.maxModelLen}
              onChange={(e) => onPatch({ maxModelLen: Math.max(512, Number(e.target.value) || 32768) })}
            />
          </label>

          <label className="wt-field" style={{ minWidth: 180 }}>
            <span className="wt-field-label">显存预算占比 u = {state.gpuMemoryUtilization.toFixed(2)}</span>
            <input
              type="range"
              min={0.7}
              max={0.98}
              step={0.01}
              value={state.gpuMemoryUtilization}
              onChange={(e) => onPatch({ gpuMemoryUtilization: Number(e.target.value) })}
              style={{ accentColor: "var(--color-accent)", height: 36 }}
            />
          </label>
        </>
      )}
    </div>
  );
}

function AdvancedCalcControls({
  state,
  open,
  onOpenChange,
  onPatch,
}: {
  state: CalcState;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onPatch: (patch: Partial<CalcState>) => void;
}) {
  return (
    <details
      className="wt-advanced-details"
      data-testid="calc-advanced-controls"
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
    >
      <summary className="wt-advanced-summary">
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px" }}>
          <span className="wt-advanced-summary-title">
            进阶参数微调（多维并行 / KV 压缩 / 图模式 / Roofline 批假设）
          </span>
          <span className="wt-advanced-summary-meta">
            PP={state.ppSize} · DP={state.dpSize} · PCP={state.pcpSize} · DCP={state.dcpSize} · KV=
            {state.kvCacheDtype} · NZ={state.weightNzMode} · 图={state.cudagraphMode}
            {state.useV2ModelRunner !== undefined ? ` · V2=${state.useV2ModelRunner ? "开" : "关"}` : ""}
          </span>
        </span>
        <span className="wt-advanced-summary-cta">{open ? "收起进阶参数" : "展开微调"}</span>
      </summary>

      <div className="wt-advanced-body">
        <div className="wt-advanced-group">
          <span className="wt-advanced-group-title">多维并行与长序列切分</span>
          <div className="wt-advanced-row">
            <label className="wt-field" style={{ minWidth: 96 }}>
              <span className="wt-field-label">流水线 PP</span>
              <select
                className="wt-select"
                value={state.ppSize}
                onChange={(e) => onPatch({ ppSize: Number(e.target.value) })}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    PP={n}
                  </option>
                ))}
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 96 }}>
              <span className="wt-field-label">数据并行 DP</span>
              <select
                className="wt-select"
                value={state.dpSize}
                onChange={(e) => onPatch({ dpSize: Number(e.target.value) })}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    DP={n}
                  </option>
                ))}
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 118 }}>
              <span className="wt-field-label">PCP（Prefill 切分）</span>
              <select
                className="wt-select"
                value={state.pcpSize}
                onChange={(e) => onPatch({ pcpSize: Number(e.target.value) })}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    PCP={n}
                  </option>
                ))}
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 118 }}>
              <span className="wt-field-label">DCP（Decode 切分）</span>
              <select
                className="wt-select"
                value={state.dcpSize}
                onChange={(e) => onPatch({ dcpSize: Number(e.target.value) })}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    DCP={n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="wt-advanced-group">
          <span className="wt-advanced-group-title">KV 缓存精度、权重格式与图捕获模式</span>
          <div className="wt-advanced-row">
            <label className="wt-field" style={{ minWidth: 145 }}>
              <span className="wt-field-label">KV Cache 精度</span>
              <select
                className="wt-select"
                value={state.kvCacheDtype}
                onChange={(e) => onPatch({ kvCacheDtype: e.target.value as KvCacheDtype })}
              >
                <option value="auto">auto（同权重 2B）</option>
                <option value="int8">int8（C8 压缩）</option>
                <option value="mxfp8">mxfp8（A5 原生）</option>
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 155 }}>
              <span className="wt-field-label">权重排布 weight_nz_mode</span>
              <select
                className="wt-select"
                value={state.weightNzMode}
                onChange={(e) => onPatch({ weightNzMode: Number(e.target.value) as 0 | 1 | 2 })}
              >
                <option value={1}>1（默认按需）</option>
                <option value={2}>2（强制 FRACTAL_NZ）</option>
                <option value={0}>0（关闭）</option>
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 215 }}>
              <span className="wt-field-label">图捕获模式 cudagraph_mode</span>
              <select
                className="wt-select"
                value={state.cudagraphMode}
                onChange={(e) => onPatch({ cudagraphMode: e.target.value as CudaGraphMode })}
              >
                {CUDAGRAPH_OPTIONS.map((cg) => (
                  <option key={cg.value} value={cg.value}>
                    {cg.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 135 }}>
              <span className="wt-field-label">代码规则基线</span>
              <select
                className="wt-select"
                value={state.version}
                onChange={(e) => onPatch({ version: e.target.value as RuleVersion })}
              >
                <option value="v0.30.0">v0.30.0（推荐）</option>
                <option value="main">main（最新）</option>
              </select>
            </label>

            <label className="wt-field" style={{ minWidth: 210 }}>
              <span className="wt-field-label">Model Runner V2</span>
              <select
                className="wt-select"
                data-testid="calc-v2-runner-select"
                value={state.useV2ModelRunner === undefined ? "auto" : state.useV2ModelRunner ? "1" : "0"}
                onChange={(e) =>
                  onPatch({
                    useV2ModelRunner:
                      e.target.value === "1" ? true : e.target.value === "0" ? false : undefined,
                  })
                }
              >
                <option value="auto">默认（随版本自动）</option>
                <option value="1">开启（VLLM_USE_V2_MODEL_RUNNER=1）</option>
                <option value="0">关闭（VLLM_USE_V2_MODEL_RUNNER=0）</option>
              </select>
            </label>
          </div>
        </div>

        <div className="wt-advanced-group">
          <span className="wt-advanced-group-title">调度批处理上限与 Roofline 吞吐假设</span>
          <div className="wt-advanced-row">
            <label className="wt-field" style={{ minWidth: 155 }}>
              <span className="wt-field-label">max_num_batched_tokens</span>
              <input
                className="wt-input"
                type="number"
                min={256}
                max={32768}
                step={512}
                value={state.maxNumBatchedTokens}
                onChange={(e) =>
                  onPatch({
                    maxNumBatchedTokens: Math.max(
                      256,
                      Number(e.target.value) || DEFAULT_MAX_NUM_BATCHED_TOKENS,
                    ),
                  })
                }
              />
            </label>

            <label className="wt-field" style={{ minWidth: 120 }}>
              <span className="wt-field-label">max_num_seqs</span>
              <input
                className="wt-input"
                type="number"
                min={1}
                max={4096}
                step={16}
                value={state.maxNumSeqs}
                onChange={(e) =>
                  onPatch({
                    maxNumSeqs: Math.max(1, Number(e.target.value) || DEFAULT_MAX_NUM_SEQS),
                  })
                }
              />
            </label>

            <label className="wt-field" style={{ minWidth: 120 }}>
              <span className="wt-field-label">Prefill tokens</span>
              <input
                className="wt-input"
                type="number"
                min={32}
                max={65536}
                step={128}
                value={state.prefillTokens}
                onChange={(e) => onPatch({ prefillTokens: Math.max(1, Number(e.target.value) || 512) })}
              />
            </label>

            <label className="wt-field" style={{ minWidth: 115 }}>
              <span className="wt-field-label">Decode 批 B</span>
              <input
                className="wt-input"
                type="number"
                min={1}
                max={512}
                value={state.decodeBatchSize}
                onChange={(e) => onPatch({ decodeBatchSize: Math.max(1, Number(e.target.value) || 16) })}
              />
            </label>

            <label className="wt-field" style={{ minWidth: 130 }}>
              <span className="wt-field-label">Decode 上下文长</span>
              <input
                className="wt-input"
                type="number"
                min={128}
                max={131072}
                step={512}
                value={state.decodeContextLen}
                onChange={(e) => onPatch({ decodeContextLen: Math.max(128, Number(e.target.value) || 4096) })}
              />
            </label>
          </div>
        </div>
      </div>
    </details>
  );
}

function buildCalcStateFromQuery(
  query: CalculatorQueryOverrides,
  wave4Demo?: Wave4DemoPreset,
  useV2ModelRunner?: boolean | undefined,
): CalcState {
  return {
    version: query.version ?? "v0.30.0",
    cardId: query.cardId ?? "a2-64g",
    weightPrecision: query.weightPrecision ?? wave4Demo?.recommendedPrecision ?? "bf16",
    kvCacheDtype: query.kvCacheDtype ?? "auto",
    weightNzMode: query.weightNzMode ?? 1,
    tpSize: query.tpSize ?? wave4Demo?.recommendedTp ?? 1,
    ppSize: query.ppSize ?? wave4Demo?.recommendedPp ?? 1,
    dpSize: query.dpSize ?? wave4Demo?.recommendedDp ?? 1,
    pcpSize: query.pcpSize ?? 1,
    dcpSize: query.dcpSize ?? 1,
    enableEp: query.enableEp ?? wave4Demo?.recommendedEnableEp ?? false,
    gpuMemoryUtilization: query.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION,
    maxModelLen: normalizeCalcInt(query.maxModelLen ?? DEFAULT_MAX_MODEL_LEN, 512, DEFAULT_MAX_MODEL_LEN),
    maxNumBatchedTokens: normalizeCalcInt(
      query.maxNumBatchedTokens ?? DEFAULT_MAX_NUM_BATCHED_TOKENS,
      256,
      DEFAULT_MAX_NUM_BATCHED_TOKENS,
    ),
    maxNumSeqs: normalizeCalcInt(query.maxNumSeqs ?? DEFAULT_MAX_NUM_SEQS, 1, DEFAULT_MAX_NUM_SEQS),
    cudagraphMode: query.enforceEager
      ? "NONE"
      : (query.cudagraphMode ?? ((query.cardId ?? "a2-64g") === "310p-24g" ? "NONE" : "PIECEWISE")),
    useV2ModelRunner,
    prefillTokens: normalizeCalcInt(query.prefillTokens ?? DEFAULT_PREFILL_TOKENS, 1, DEFAULT_PREFILL_TOKENS),
    decodeBatchSize: normalizeCalcInt(
      query.decodeBatchSize ?? DEFAULT_DECODE_BATCH_SIZE,
      1,
      DEFAULT_DECODE_BATCH_SIZE,
    ),
    decodeContextLen: normalizeCalcInt(
      query.decodeContextLen ?? DEFAULT_DECODE_CONTEXT_LEN,
      128,
      DEFAULT_DECODE_CONTEXT_LEN,
    ),
  };
}

export function DeployCalculatorView({
  mode = "full",
  title,
  summary,
  initialModel,
  embedded = false,
  searchParams,
  locationKey,
  onUpdateSearchParams,
  onClearCalculatorShareParams,
  onNavigateToDoctor,
}: DeployCalculatorViewProps) {
  const activeTabParam = searchParams?.get("tab");
  const isCalculatorRouteActive = !activeTabParam || activeTabParam === "calculator";
  const initialQuery = useMemo(
    () =>
      !embedded && searchParams && isCalculatorRouteActive ? parseCalculatorQueryParams(searchParams) : {},
    [embedded, searchParams, isCalculatorRouteActive],
  );
  const initialCustomModelParam = useMemo(
    () => (!embedded && searchParams && isCalculatorRouteActive ? parseCustomModelParam(searchParams) : null),
    [embedded, searchParams, isCalculatorRouteActive],
  );
  const initialV2Param = useMemo(
    () =>
      !embedded && searchParams && isCalculatorRouteActive
        ? parseV2ModelRunnerParam(searchParams)
        : undefined,
    [embedded, searchParams, isCalculatorRouteActive],
  );
  const initialWave4Demo = useMemo(
    () =>
      !initialCustomModelParam && initialQuery.presetId
        ? WAVE4_DEMO_PRESETS.find((d) => d.id === initialQuery.presetId)
        : undefined,
    [initialCustomModelParam, initialQuery.presetId],
  );
  const initialTrimmed = initialModel?.trim() ?? "";
  const startsWithJson =
    Boolean(initialCustomModelParam) || initialTrimmed.startsWith("{") || Boolean(initialWave4Demo);
  const defaultPreset =
    !initialCustomModelParam && !initialWave4Demo && initialQuery.presetId
      ? matchInitialPresetId(initialQuery.presetId)
      : matchInitialPresetId(startsWithJson ? undefined : initialModel);
  const [presetId, setPresetId] = useState<string>(defaultPreset);
  const [useCustomJson, setUseCustomJson] = useState(startsWithJson);
  const [customJsonText, setCustomJsonText] = useState<string>(
    initialCustomModelParam ??
      (initialWave4Demo
        ? JSON.stringify(initialWave4Demo.config, null, 2)
        : startsWithJson
          ? initialTrimmed
          : DEFAULT_WAVE4_MLA_JSON),
  );
  const [activeWave4DemoId, setActiveWave4DemoId] = useState<string | null>(initialWave4Demo?.id ?? null);
  const prevInitialModelRef = useRef<string | undefined>(initialModel);
  useEffect(() => {
    if (prevInitialModelRef.current === initialModel) return;
    prevInitialModelRef.current = initialModel;
    const nextTrimmed = initialModel?.trim() ?? "";
    const nextIsJson = nextTrimmed.startsWith("{");
    setUseCustomJson(nextIsJson);
    if (nextIsJson) {
      setCustomJsonText(nextTrimmed);
    } else {
      setPresetId(matchInitialPresetId(initialModel));
    }
  }, [initialModel]);
  const [subMode, setSubMode] = useState<"static" | "reconcile">(initialQuery.subMode ?? "static");
  const [logText, setLogText] = useState<string>(SAMPLE_ASCEND_STARTUP_LOGS[0]?.logText ?? "");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    SAMPLE_ASCEND_STARTUP_LOGS[0]?.id ?? null,
  );
  const [reconcileHandoffSource, setReconcileHandoffSource] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const [state, setState] = useState<CalcState>(() =>
    buildCalcStateFromQuery(initialQuery, initialWave4Demo, initialV2Param),
  );
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() =>
    hasAdvancedQueryOverrides(initialQuery, initialV2Param),
  );

  const calcQuerySig = useMemo(
    () => (!embedded && isCalculatorRouteActive ? getCalculatorQuerySignature(searchParams) : ""),
    [embedded, isCalculatorRouteActive, searchParams],
  );
  const lastAppliedQuerySigRef = useRef<string>(calcQuerySig);
  const hasLocalEditsRef = useRef<boolean>(false);
  const pendingSelfUrlClearSigRef = useRef<string | null>(null);
  const prevNavRef = useRef<{
    tab: string;
    panel: string | null;
    calcQuerySig: string;
    locationKey: string | undefined;
  }>({
    tab: isCalculatorRouteActive ? "calculator" : (activeTabParam ?? ""),
    panel: isCalculatorRouteActive ? (searchParams?.get("panel") ?? null) : null,
    calcQuerySig,
    locationKey,
  });

  useEffect(() => {
    if (embedded || !searchParams) return;
    const prev = prevNavRef.current;
    const currentTab = isCalculatorRouteActive ? "calculator" : (activeTabParam ?? "");
    const currentPanel = isCalculatorRouteActive ? (searchParams.get("panel") ?? null) : null;
    const isNewNavigation =
      (locationKey !== undefined && locationKey !== prev.locationKey) ||
      calcQuerySig !== prev.calcQuerySig ||
      prev.tab !== currentTab;

    prevNavRef.current = {
      tab: currentTab,
      panel: currentPanel,
      calcQuerySig,
      locationKey,
    };

    if (!isCalculatorRouteActive) return;

    if (pendingSelfUrlClearSigRef.current !== null && calcQuerySig === pendingSelfUrlClearSigRef.current) {
      pendingSelfUrlClearSigRef.current = null;
      lastAppliedQuerySigRef.current = calcQuerySig;
      return;
    }
    pendingSelfUrlClearSigRef.current = null;

    // In-place navigation on calculator tab from ?panel=reconcile -> ?tab=calculator (no panel) resets to static,
    // while switching ?tab=doctor -> ?tab=calculator preserves user's local draft subMode.
    // Clearing lastAppliedQuerySigRef whenever calculator query params are empty ensures navigating back
    // to ?panel=reconcile or re-opening the same share link replays reliably.
    if (!calcQuerySig) {
      lastAppliedQuerySigRef.current = "";
      if (prev.tab === "calculator" && prev.panel === "reconcile" && currentPanel === null) {
        setSubMode("static");
      }
      return;
    }

    const shouldApplyShareUrl =
      calcQuerySig !== lastAppliedQuerySigRef.current || (isNewNavigation && hasLocalEditsRef.current);
    if (!shouldApplyShareUrl) return;

    lastAppliedQuerySigRef.current = calcQuerySig;
    hasLocalEditsRef.current = false;

    const parsed = parseCalculatorQueryParams(searchParams);
    const customModel = parseCustomModelParam(searchParams);
    const parsedV2 = parseV2ModelRunnerParam(searchParams);
    const hasCalcOverrides = hasNonPanelCalculatorParams(parsed, customModel, parsedV2);

    if (!hasCalcOverrides) {
      if (parsed.subMode === "reconcile" || parsed.subMode === "static") {
        setSubMode(parsed.subMode);
      }
      return;
    }

    const matchedWave4 =
      !customModel && parsed.presetId ? WAVE4_DEMO_PRESETS.find((d) => d.id === parsed.presetId) : undefined;

    setSubMode(parsed.subMode ?? "static");
    if (customModel) {
      setUseCustomJson(true);
      setActiveWave4DemoId(null);
      setCustomJsonText(customModel);
    } else if (matchedWave4) {
      setUseCustomJson(true);
      setActiveWave4DemoId(matchedWave4.id);
      setCustomJsonText(JSON.stringify(matchedWave4.config, null, 2));
    } else {
      setUseCustomJson(false);
      setActiveWave4DemoId(null);
      setPresetId(parsed.presetId ? matchInitialPresetId(parsed.presetId) : "qwen3-8b");
    }
    setState(buildCalcStateFromQuery(parsed, matchedWave4, parsedV2));
    setAdvancedOpen(hasAdvancedQueryOverrides(parsed, parsedV2));
    setShareNotice(null);
  }, [embedded, isCalculatorRouteActive, activeTabParam, searchParams, calcQuerySig, locationKey]);

  useEffect(() => {
    if (embedded) return;
    const applyPending = () => {
      const payload = workbenchHandoffStore.consumeReconcile();
      if (!payload) return;
      setSubMode("reconcile");
      setLogText(payload.logText);
      setActiveTemplateId(null);
      setReconcileHandoffSource(payload.sourceLabel);
    };
    applyPending();
    return workbenchHandoffStore.subscribe(applyPending);
  }, [embedded]);

  const markLocalEdit = (nextSubMode: "static" | "reconcile" = subMode, pushHistory = false) => {
    hasLocalEditsRef.current = true;
    if (!embedded && isCalculatorRouteActive && !onUpdateSearchParams && onClearCalculatorShareParams) {
      const targetSig = nextSubMode === "reconcile" ? "panel=reconcile" : "";
      if (calcQuerySig !== targetSig) {
        pendingSelfUrlClearSigRef.current = targetSig;
        lastAppliedQuerySigRef.current = targetSig;
        onClearCalculatorShareParams(nextSubMode, pushHistory);
      }
    }
  };

  const patchState = (patch: Partial<CalcState>) => {
    markLocalEdit();
    setState((prev) => {
      const next: CalcState = { ...prev, ...patch };
      if (patch.maxModelLen !== undefined) {
        next.maxModelLen = normalizeCalcInt(patch.maxModelLen, 512, prev.maxModelLen);
      }
      if (patch.maxNumBatchedTokens !== undefined) {
        next.maxNumBatchedTokens = normalizeCalcInt(patch.maxNumBatchedTokens, 256, prev.maxNumBatchedTokens);
      }
      if (patch.maxNumSeqs !== undefined) {
        next.maxNumSeqs = normalizeCalcInt(patch.maxNumSeqs, 1, prev.maxNumSeqs);
      }
      if (patch.prefillTokens !== undefined) {
        next.prefillTokens = normalizeCalcInt(patch.prefillTokens, 1, prev.prefillTokens);
      }
      if (patch.decodeBatchSize !== undefined) {
        next.decodeBatchSize = normalizeCalcInt(patch.decodeBatchSize, 1, prev.decodeBatchSize);
      }
      if (patch.decodeContextLen !== undefined) {
        next.decodeContextLen = normalizeCalcInt(patch.decodeContextLen, 128, prev.decodeContextLen);
      }
      return next;
    });
  };

  const modelInput = useCustomJson ? customJsonText : presetId;
  const gate = useMemo(
    () => evaluateCalculatorModelGate(modelInput, useCustomJson),
    [modelInput, useCustomJson],
  );

  const plan = useMemo(() => {
    if (!gate.ok || !gate.supportedInWave3) return null;
    const input: DeployPlanInput = {
      model: gate.spec,
      cardId: state.cardId,
      version: state.version,
      weightPrecision: state.weightPrecision,
      kvCacheDtype: state.kvCacheDtype,
      weightNzMode: state.weightNzMode,
      tpSize: state.tpSize,
      ppSize: state.ppSize,
      dpSize: state.dpSize,
      pcpSize: state.pcpSize,
      dcpSize: state.dcpSize,
      enableEp: state.enableEp,
      ...(state.useV2ModelRunner !== undefined ? { useV2ModelRunner: state.useV2ModelRunner } : {}),
      gpuMemoryUtilization: state.gpuMemoryUtilization,
      maxModelLen: state.maxModelLen,
      maxNumBatchedTokens: state.maxNumBatchedTokens,
      maxNumSeqs: state.maxNumSeqs,
      cudagraphMode: state.cudagraphMode,
      enforceEager: state.cudagraphMode === "NONE",
      prefillTokens: state.prefillTokens,
      decodeBatchSize: state.decodeBatchSize,
      decodeContextLen: state.decodeContextLen,
    };
    return evaluateDeployPlan(input);
  }, [gate, state]);

  const deployAnalysis = useMemo(() => {
    if (!plan) return undefined;
    let modelRef: string | Record<string, unknown> | undefined;
    if (!useCustomJson) {
      modelRef = presetId;
    } else if (activeWave4DemoId) {
      modelRef = activeWave4DemoId;
    } else {
      try {
        const parsed: unknown = JSON.parse(customJsonText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          modelRef = parsed as Record<string, unknown>;
        }
      } catch {
        modelRef = undefined;
      }
    }
    if (!modelRef) return undefined;
    return buildDeployChatAnalysis({
      model: modelRef,
      cardId: state.cardId,
      version: state.version,
      weightPrecision: state.weightPrecision,
      kvCacheDtype: state.kvCacheDtype,
      weightNzMode: state.weightNzMode,
      tpSize: state.tpSize,
      ppSize: state.ppSize,
      dpSize: state.dpSize,
      dcpSize: state.dcpSize,
      enableEp: state.enableEp,
      gpuMemoryUtilization: state.gpuMemoryUtilization,
      maxModelLen: state.maxModelLen,
      maxNumBatchedTokens: state.maxNumBatchedTokens,
      maxNumSeqs: state.maxNumSeqs,
      cudagraphMode: state.cudagraphMode,
      enforceEager: state.cudagraphMode === "NONE",
      prefillTokens: state.prefillTokens,
      decodeBatchSize: state.decodeBatchSize,
      decodeContextLen: state.decodeContextLen,
    });
  }, [plan, useCustomJson, presetId, activeWave4DemoId, customJsonText, state]);

  const handleApplyTemplate = (tpl: SampleStartupLogTemplate) => {
    markLocalEdit("reconcile");
    setLogText(tpl.logText);
    setActiveTemplateId(tpl.id);
    const rec = tpl.recommendedPlanInput;
    if (typeof rec.model === "string") {
      setUseCustomJson(false);
      setPresetId(matchInitialPresetId(rec.model));
    }
    setState((prev) => ({
      ...prev,
      cardId: rec.cardId,
      weightPrecision: rec.weightPrecision ?? prev.weightPrecision,
      kvCacheDtype: rec.kvCacheDtype ?? prev.kvCacheDtype,
      weightNzMode: rec.weightNzMode ?? 1,
      tpSize: rec.tpSize ?? 1,
      ppSize: rec.ppSize ?? 1,
      dpSize: rec.dpSize ?? 1,
      pcpSize: rec.pcpSize ?? 1,
      dcpSize: rec.dcpSize ?? 1,
      enableEp: Boolean(rec.enableEp),
      useV2ModelRunner: rec.useV2ModelRunner,
      gpuMemoryUtilization: rec.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION,
      maxModelLen: rec.maxModelLen ?? 32768,
      maxNumBatchedTokens: rec.maxNumBatchedTokens ?? DEFAULT_MAX_NUM_BATCHED_TOKENS,
      maxNumSeqs: rec.maxNumSeqs ?? DEFAULT_MAX_NUM_SEQS,
      cudagraphMode: rec.cudagraphMode ?? "PIECEWISE",
    }));
  };

  const resetToStandard = () => {
    markLocalEdit();
    setUseCustomJson(false);
    setActiveWave4DemoId(null);
    setPresetId("qwen3-8b");
    setShareNotice(null);
  };

  const applyWave4Demo = (demo: Wave4DemoPreset) => {
    markLocalEdit();
    setCustomJsonText(JSON.stringify(demo.config, null, 2));
    setUseCustomJson(true);
    setActiveWave4DemoId(demo.id);
    setShareNotice(null);
    patchState({
      tpSize: demo.recommendedTp,
      ppSize: demo.recommendedPp,
      dpSize: demo.recommendedDp,
      pcpSize: 1,
      dcpSize: 1,
      enableEp: demo.recommendedEnableEp,
      useV2ModelRunner: undefined,
      weightPrecision: demo.recommendedPrecision,
    });
  };

  const handleHandoffToDoctor = () => {
    if (!plan) return;
    const currentPlanValid =
      plan.fourQuestions.q1Fit.verdict !== "blocked" && plan.fourQuestions.q2Capacity.oomStatus === "fits";
    const commandText = currentPlanValid
      ? buildCurrentPlanCliHint(plan)
      : plan.fourQuestions.q4Recommendation.cliHint;
    const modelId = useCustomJson ? (activeWave4DemoId ?? undefined) : presetId;
    workbenchHandoffStore.sendToDoctor({
      commandText,
      hardwareFamily: cardIdToHardwareFamily(plan.card.id),
      version: state.version === "main" ? "main" : "v0.30.0",
      sourceLabel: `${plan.spec.name} · ${plan.card.shortName} · TP=${plan.inputSummary.tpSize}`,
      ...(modelId ? { modelId } : {}),
      modelTraitOverride: extractDoctorModelTraitsFromSpec(plan.spec),
    });
    if (onNavigateToDoctor) {
      onNavigateToDoctor();
    } else if (typeof window !== "undefined") {
      window.location.hash = "#/tools?tab=doctor";
    }
  };

  const customShareGuard = useMemo(
    () => (useCustomJson && !activeWave4DemoId ? serializeCustomModelForShare(customJsonText) : null),
    [useCustomJson, activeWave4DemoId, customJsonText],
  );

  // Live URL sync in replace mode so refreshing after editing TP / card / precision preserves current plan
  useEffect(() => {
    if (embedded || !isCalculatorRouteActive || !searchParams || !onUpdateSearchParams) return;

    const isAtDefault =
      subMode === "static" &&
      !useCustomJson &&
      presetId === "qwen3-8b" &&
      state.cardId === "a2-64g" &&
      state.weightPrecision === "bf16" &&
      state.kvCacheDtype === "auto" &&
      state.weightNzMode === 1 &&
      state.tpSize === 1 &&
      state.ppSize === 1 &&
      state.dpSize === 1 &&
      state.pcpSize === 1 &&
      state.dcpSize === 1 &&
      !state.enableEp &&
      Math.abs(state.gpuMemoryUtilization - DEFAULT_GPU_MEMORY_UTILIZATION) < 1e-6 &&
      state.maxModelLen === DEFAULT_MAX_MODEL_LEN &&
      state.maxNumBatchedTokens === DEFAULT_MAX_NUM_BATCHED_TOKENS &&
      state.maxNumSeqs === DEFAULT_MAX_NUM_SEQS &&
      state.cudagraphMode === "PIECEWISE" &&
      state.useV2ModelRunner === undefined &&
      state.prefillTokens === DEFAULT_PREFILL_TOKENS &&
      state.decodeBatchSize === DEFAULT_DECODE_BATCH_SIZE &&
      state.decodeContextLen === DEFAULT_DECODE_CONTEXT_LEN &&
      state.version === "v0.30.0";

    if (isAtDefault && !calcQuerySig) return;

    let nextParams: URLSearchParams;
    if (isAtDefault) {
      nextParams = new URLSearchParams(searchParams);
      for (const k of CALCULATOR_SHARE_QUERY_KEYS) nextParams.delete(k);
    } else {
      nextParams = buildCalculatorQueryParams(
        {
          subMode,
          presetId: useCustomJson ? (activeWave4DemoId ?? undefined) : presetId,
          cardId: state.cardId,
          weightPrecision: state.weightPrecision,
          kvCacheDtype: state.kvCacheDtype,
          weightNzMode: state.weightNzMode,
          tpSize: state.tpSize,
          ppSize: state.ppSize,
          dpSize: state.dpSize,
          pcpSize: state.pcpSize,
          dcpSize: state.dcpSize,
          enableEp: state.enableEp,
          gpuMemoryUtilization: state.gpuMemoryUtilization,
          maxModelLen: state.maxModelLen,
          maxNumBatchedTokens: state.maxNumBatchedTokens,
          maxNumSeqs: state.maxNumSeqs,
          cudagraphMode: state.cudagraphMode,
          enforceEager: state.cudagraphMode === "NONE",
          prefillTokens: state.prefillTokens,
          decodeBatchSize: state.decodeBatchSize,
          decodeContextLen: state.decodeContextLen,
          version: state.version === "main" ? "main" : "v0.30.0",
        },
        searchParams,
      );
      if (state.useV2ModelRunner !== undefined) {
        nextParams.set("v2", state.useV2ModelRunner ? "1" : "0");
      } else {
        nextParams.delete("v2");
      }
      if (customShareGuard?.ok) {
        nextParams.set("customModel", customShareGuard.compact);
      } else if (!useCustomJson || activeWave4DemoId) {
        nextParams.delete("customModel");
      }
    }

    const nextStr = nextParams.toString();
    if (nextStr !== searchParams.toString()) {
      const nextSig = getCalculatorQuerySignature(nextParams);
      pendingSelfUrlClearSigRef.current = nextSig;
      lastAppliedQuerySigRef.current = nextSig;
      onUpdateSearchParams(nextParams, { replace: true });
    }
  }, [
    embedded,
    isCalculatorRouteActive,
    searchParams,
    onUpdateSearchParams,
    calcQuerySig,
    subMode,
    useCustomJson,
    activeWave4DemoId,
    presetId,
    state,
    customShareGuard,
  ]);

  const handleCopyShareLink = () => {
    if (customShareGuard && !customShareGuard.ok) {
      setShareNotice(customShareGuard.reason);
      return;
    }
    setShareNotice(null);
    if (typeof window === "undefined") return;
    const shareParams = buildCalculatorQueryParams(
      {
        subMode,
        presetId: useCustomJson ? (activeWave4DemoId ?? undefined) : presetId,
        cardId: state.cardId,
        weightPrecision: state.weightPrecision,
        kvCacheDtype: state.kvCacheDtype,
        weightNzMode: state.weightNzMode,
        tpSize: state.tpSize,
        ppSize: state.ppSize,
        dpSize: state.dpSize,
        pcpSize: state.pcpSize,
        dcpSize: state.dcpSize,
        enableEp: state.enableEp,
        gpuMemoryUtilization: state.gpuMemoryUtilization,
        maxModelLen: state.maxModelLen,
        maxNumBatchedTokens: state.maxNumBatchedTokens,
        maxNumSeqs: state.maxNumSeqs,
        cudagraphMode: state.cudagraphMode,
        enforceEager: state.cudagraphMode === "NONE",
        prefillTokens: state.prefillTokens,
        decodeBatchSize: state.decodeBatchSize,
        decodeContextLen: state.decodeContextLen,
        version: state.version === "main" ? "main" : "v0.30.0",
      },
      searchParams,
    );
    if (state.useV2ModelRunner !== undefined) {
      shareParams.set("v2", state.useV2ModelRunner ? "1" : "0");
    }
    if (customShareGuard?.ok) {
      shareParams.set("customModel", customShareGuard.compact);
    }
    const url = `${window.location.origin}${window.location.pathname}#/tools?${shareParams.toString()}`;
    void copyTextToClipboard(url).then((copied) => {
      if (copied) {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1800);
      } else {
        setLinkCopied(false);
        setShareNotice(`剪贴板不可用，请手动复制链接：${url}`);
      }
    });
  };

  const hardware3dHref = useMemo(() => {
    if (!plan) return "#/hardware?vendor=ascend&level=2";
    let modelKey: DeployOverlayModelKey;
    if (!useCustomJson) {
      modelKey =
        presetId === "qwen3-0.6b" || presetId === "qwen3-8b" || presetId === "qwen3-30b-a3b"
          ? presetId
          : "qwen3-8b";
    } else if (
      activeWave4DemoId === "deepseek-v3-mla" ||
      activeWave4DemoId === "hybrid-kda-gqa" ||
      activeWave4DemoId === "csa2-sparse-mla" ||
      activeWave4DemoId === "engram-conditional"
    ) {
      modelKey = activeWave4DemoId;
    } else if (plan.wave4Arch.hasMla) {
      modelKey = "custom-mla";
    } else if (plan.wave4Arch.hasKda) {
      modelKey = "custom-kda";
    } else if (plan.isMoe) {
      modelKey = "custom-moe";
    } else {
      modelKey = "custom-dense";
    }

    const wBytes = plan.stages[2].pointEstimateBytes;
    const actBytes = plan.stages[3].pointEstimateBytes;
    const nonTorchBytes = plan.stages[4].pointEstimateBytes;
    const kvBytes = plan.stages[5].pointEstimateBytes;
    const aclBytes = plan.stages[6].pointEstimateBytes;
    const workspace310pBytes = plan.card.halvesKvForWorkspace
      ? Math.max(0, plan.requestedBytes - (wBytes + actBytes + nonTorchBytes + kvBytes))
      : 0;

    const rawOom = plan.fourQuestions.q2Capacity.oomStatus;
    const oomStatus: DeployOverlayOomStatus =
      rawOom !== "fits"
        ? rawOom
        : plan.headroomStatus === "overflow"
          ? "headroom_overflow"
          : plan.headroomStatus === "risk"
            ? "headroom_risk"
            : "fits";

    return buildHardwareDeployHref(
      {
        modelKey,
        cardId: plan.card.id,
        tp: state.tpSize,
        pp: state.ppSize,
        dp: state.dpSize,
        ep: state.enableEp,
        totalRanks: plan.fourQuestions.q2Capacity.currentTotalCards,
        cardGiB: plan.card.hbmGiB,
        u: state.gpuMemoryUtilization,
        weightGiB: wBytes / GIB,
        kvGiB: kvBytes / GIB,
        runtimeGiB: (actBytes + nonTorchBytes + workspace310pBytes + aclBytes) / GIB,
        oomStatus,
        headroomOverflow: plan.headroomStatus === "overflow",
        headroomRisk: plan.headroomStatus === "risk",
        calc: {
          subMode,
          weightPrecision: state.weightPrecision,
          kvCacheDtype: state.kvCacheDtype,
          weightNzMode: state.weightNzMode,
          pcp: state.pcpSize,
          dcp: state.dcpSize,
          maxModelLen: state.maxModelLen,
          maxNumBatchedTokens: state.maxNumBatchedTokens,
          maxNumSeqs: state.maxNumSeqs,
          cudagraphMode: state.cudagraphMode,
          useV2ModelRunner: state.useV2ModelRunner,
          prefillTokens: state.prefillTokens,
          decodeBatchSize: state.decodeBatchSize,
          decodeContextLen: state.decodeContextLen,
          version: state.version === "main" ? "main" : "v0.30.0",
        },
      },
      searchParams,
      customShareGuard?.ok ? customShareGuard.compact : null,
    );
  }, [plan, useCustomJson, presetId, activeWave4DemoId, state, subMode, searchParams, customShareGuard]);

  const displayTitle = title ?? "估算要几张卡（部署算账）";

  return (
    <div
      className={`wt-root wt-calc-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="deploy-calculator-view"
      data-mode={mode}
    >
      {embedded ? (
        <>
          <header className="wiki-tool-head">
            <div className="wt-embedded-title-group">
              <strong className="wiki-tool-title">{displayTitle}</strong>
              <span className="wiki-tool-badge">
                {mode === "quick-screen"
                  ? "快速摸底"
                  : mode === "minimal"
                    ? "精简算账"
                    : mode === "full"
                      ? "完整模式"
                      : "部署算账台"}
              </span>
            </div>
            <a className="wt-open-workbench" href="#/tools?tab=calculator">
              打开完整算账工作台 →
            </a>
          </header>
          {summary && <p className="wiki-tool-summary">{summary}</p>}
        </>
      ) : (
        <header className="wt-header">
          <div className="wt-header-main">
            <div className="wt-title-row">
              <h2 className="wt-title">{displayTitle}</h2>
              <span className="wt-baseline-pill">vllm-ascend {state.version}</span>
              {mode === "full" && (
                <button
                  type="button"
                  className="wt-preset-btn"
                  style={{ padding: "2px 10px", fontSize: 12.5 }}
                  data-testid="calc-copy-share-link"
                  aria-disabled={Boolean(customShareGuard && !customShareGuard.ok)}
                  onClick={handleCopyShareLink}
                >
                  {linkCopied ? "已复制参数链接" : "复制参数链接"}
                </button>
              )}
            </div>
            {(shareNotice || (customShareGuard && !customShareGuard.ok)) && (
              <p
                className="wt-subtitle"
                data-testid="calc-share-notice"
                role="status"
                style={{ color: "var(--color-warning)", fontSize: 13 }}
              >
                {shareNotice ?? (customShareGuard && !customShareGuard.ok ? customShareGuard.reason : "")}
              </p>
            )}
            <p className="wt-subtitle">
              {summary ??
                "第一步：选模型、昇腾卡型与目标上下文 → 立即看能否装下、最少几张卡与 KV 显存余量；已有启动日志也可切到「已有日志对账」核对偏差。"}
            </p>
          </div>
          {mode === "full" && (
            <div className="wt-segmented" role="tablist" aria-label="算账模式切换">
              <button
                type="button"
                role="tab"
                aria-selected={subMode === "static"}
                data-testid="calc-submode-static"
                className={`wt-seg-btn${subMode === "static" ? " is-active" : ""}`}
                onClick={() => {
                  if (subMode === "static") return;
                  markLocalEdit("static", true);
                  setSubMode("static");
                }}
              >
                上线前估算（算卡数）
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subMode === "reconcile"}
                data-testid="calc-submode-reconcile"
                className={`wt-seg-btn${subMode === "reconcile" ? " is-active" : ""}`}
                onClick={() => {
                  if (subMode === "reconcile") return;
                  markLocalEdit("reconcile", true);
                  setSubMode("reconcile");
                }}
              >
                已有日志对账（查偏差）
              </button>
            </div>
          )}
        </header>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="wt-presets">
          <span className="wt-presets-label">第一步 · 选模型：</span>
          {MODEL_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`wt-preset-btn${!useCustomJson && presetId === p.id ? " is-active" : ""}`}
              onClick={() => {
                markLocalEdit();
                setUseCustomJson(false);
                setActiveWave4DemoId(null);
                setPresetId(p.id);
                setShareNotice(null);
                if (p.id === "qwen3-30b-a3b" && state.tpSize === 1) {
                  patchState({ tpSize: 4, enableEp: true });
                }
              }}
            >
              <span>{p.name}</span>
            </button>
          ))}
          <button
            type="button"
            className={`wt-preset-btn${useCustomJson && activeWave4DemoId === null ? " is-active" : ""}`}
            onClick={() => {
              markLocalEdit();
              setActiveWave4DemoId(null);
              setUseCustomJson(true);
              setShareNotice(null);
            }}
          >
            粘贴 config.json
          </button>
        </div>

        {mode === "full" && (
          <div className="wt-preset-subrow">
            <span className="wt-presets-label" style={{ fontSize: 12.5 }}>
              特殊架构样例（MLA / 线性注意力 / Engram）：
            </span>
            {WAVE4_DEMO_PRESETS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                data-testid={`wave4-demo-${demo.id}`}
                className={`wt-preset-btn${useCustomJson && activeWave4DemoId === demo.id ? " is-active" : ""}`}
                style={{ padding: "4px 10px", fontSize: 12.5 }}
                onClick={() => applyWave4Demo(demo)}
              >
                {demo.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {useCustomJson && (
        <div className="wt-editor-card">
          <div className="wt-editor-head">
            <span className="wt-editor-title">
              自定义 HuggingFace config.json（支持 GQA / MoE / MLA / CSA2 / KDA / Engram 全架构解析）
            </span>
            <button
              type="button"
              className="wt-preset-btn"
              style={{ padding: "3px 10px" }}
              onClick={resetToStandard}
            >
              恢复内置预设
            </button>
          </div>
          <textarea
            className="wt-textarea wt-textarea-compact"
            data-testid="calc-custom-config-input"
            value={customJsonText}
            onChange={(e) => {
              markLocalEdit();
              setActiveWave4DemoId(null);
              setShareNotice(null);
              setCustomJsonText(e.target.value);
            }}
            placeholder="粘贴 HuggingFace config.json 原文..."
          />
        </div>
      )}

      {!gate.ok && (
        <div
          className="wt-card"
          data-testid="calc-gate-error"
          role="alert"
          style={{
            borderColor: "var(--color-danger)",
            background: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-elevated))",
            color: "var(--color-danger)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span>{gate.error}</span>
          <button type="button" className="wt-preset-btn" onClick={resetToStandard}>
            切回 Qwen3-8B
          </button>
        </div>
      )}

      {gate.ok && !gate.supportedInWave3 && <Wave3InterceptCard gate={gate} onReset={resetToStandard} />}

      {plan && (
        <>
          {plan.wave4Arch.activeFeatures.length > 0 && (
            <Wave4ArchActiveBanner
              arch={plan.wave4Arch}
              tpSize={plan.inputSummary.tpSize}
              maxNumSeqs={plan.inputSummary.maxNumSeqs}
            />
          )}

          {(mode !== "full" || subMode === "static") && (
            <CalcControlsBar mode={mode} state={state} isMoe={plan.isMoe} onPatch={patchState} />
          )}

          {mode === "quick-screen" && <QuickScreenBody plan={plan} />}
          {mode === "minimal" && <MinimalRooflineBody plan={plan} />}
          {mode !== "full" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <a
                href={hardware3dHref}
                className="wt-assistant-btn"
                data-testid="calc-open-3d-hardware"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                在 3D 整机中透视此方案 →
              </a>
            </div>
          )}

          {mode === "full" && subMode === "static" && (
            <>
              <DeployVerdictStrip plan={plan} />
              <AdvancedCalcControls
                state={state}
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
                onPatch={patchState}
              />
              <FourQuestionsGrid
                plan={plan}
                hardware3dHref={hardware3dHref}
                onHandoffToDoctor={handleHandoffToDoctor}
              />
              <SevenStageSection plan={plan} />
              <section className="wt-section">
                <div className="wt-section-head">
                  <h3 className="wt-section-title">Roofline 算术强度落点与硬件脊点对照</h3>
                  <span className="wt-section-meta">
                    {Math.abs(
                      plan.roofline.prefillPeakComputeTflops - plan.roofline.decodePeakComputeTflops,
                    ) > 1e-6
                      ? `${plan.card.shortName} · Prefill 脊点 ${plan.roofline.prefillRidgePointFlopsPerByte.toFixed(1)} / Decode 脊点 ${plan.roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B`
                      : `${plan.card.shortName} · 脊点 ${plan.roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`}
                  </span>
                </div>
                <div className="wt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <RooflineSvgChart roofline={plan.roofline} />
                  {plan.roofline.notes.map((n) => (
                    <div key={n} style={{ fontSize: 13.5, color: "var(--color-ink-muted)" }}>
                      • {n}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {mode === "full" && subMode === "reconcile" && (
            <>
              {reconcileHandoffSource && (
                <div className="wt-handoff-banner" data-testid="reconcile-handoff-banner" role="status">
                  <span>
                    已从「<strong>{reconcileHandoffSource}</strong>
                    」带入启动日志与显存快照，可结合上方模型/卡型逐项对账。
                  </span>
                  <button
                    type="button"
                    className="wt-preset-btn"
                    onClick={() => setReconcileHandoffSource(null)}
                  >
                    知道了
                  </button>
                </div>
              )}
              <ReconcileLogSection
                plan={plan}
                deployAnalysis={deployAnalysis}
                hardware3dHref={hardware3dHref}
                logText={logText}
                onLogTextChange={(next) => {
                  setLogText(next);
                  setActiveTemplateId(null);
                }}
                activeTemplateId={activeTemplateId}
                onApplyTemplate={handleApplyTemplate}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
