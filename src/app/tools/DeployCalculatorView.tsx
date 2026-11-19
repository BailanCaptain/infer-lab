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
  type CalcEvidenceLevel,
  DEFAULT_GPU_MEMORY_UTILIZATION,
  DEFAULT_MAX_NUM_BATCHED_TOKENS,
  DEFAULT_MAX_NUM_SEQS,
  type DeployPlanInput,
  type DeployPlanReport,
  evaluateDeployPlan,
  evaluateWave3ModelGate,
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
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkChip } from "./ToolDeepLinkChip";

export interface DeployCalculatorViewProps {
  mode?: "quick-screen" | "minimal" | "full" | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  initialModel?: string | undefined;
  embedded?: boolean | undefined;
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
            {arch.engram.dpSharedMemory ? (
              <>
                已启用 <code>engram_dp_shared_memory=true</code>（Host DRAM / <code>/dev/shm</code>{" "}
                卸载共享）：单卡 NPU 权重 HBM 占用 <strong>0 B</strong>，单节点需预留{" "}
                <strong>{fmtGiB(arch.engram.hostDramBytesPerNode)}</strong> Host DRAM，Stage 5 中{" "}
                <code>edp</code> 走 Gloo 通信不占 HCCL 显存。
              </>
            ) : (
              <>
                <code>engram_dp_shared_memory=false</code>（NPU HBM 常驻）：按{" "}
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

  const minX = 1;
  const maxX = Math.max(1024, Math.ceil(roofline.prefillIntensityFlopsPerByte * 2.2));
  const minY = 1;
  const maxY = Math.max(roofline.peakComputeTflops * 1.45, 64);
  const logX = (v: number) =>
    padL +
    ((Math.log10(Math.max(minX, v)) - Math.log10(minX)) / (Math.log10(maxX) - Math.log10(minX))) * plotW;
  const logY = (v: number) =>
    padT +
    plotH -
    ((Math.log10(Math.max(minY, v)) - Math.log10(minY)) / (Math.log10(maxY) - Math.log10(minY))) * plotH;

  const achieved = (intensity: number) =>
    Math.min(roofline.peakComputeTflops, (intensity * roofline.hbmBandwidthGBs) / 1000);

  const ridgeX = logX(roofline.ridgePointFlopsPerByte);
  const ridgeY = logY(roofline.peakComputeTflops);
  const roofPath = `M ${logX(minX)} ${logY(achieved(minX))} L ${ridgeX} ${ridgeY} L ${logX(maxX)} ${ridgeY}`;
  const ridgeLabelOnLeft = ridgeX > padL + 150;
  const ridgeLabelX = ridgeLabelOnLeft ? ridgeX - 6 : ridgeX + 6;
  const ridgeLabelAnchor = ridgeLabelOnLeft ? "end" : "start";
  const ridgeLabelY = padT + plotH - 12;

  const points = [
    {
      id: "kv",
      label: `Decode KV (${roofline.decodeKvAttnIntensityFlopsPerByte.toFixed(1)})`,
      xVal: roofline.decodeKvAttnIntensityFlopsPerByte,
      yVal: achieved(roofline.decodeKvAttnIntensityFlopsPerByte),
      color: "#4c65b6",
      dy: -12,
    },
    {
      id: "dec",
      label: `Decode GEMM (${roofline.decodeLinearIntensityFlopsPerByte.toFixed(1)})`,
      xVal: roofline.decodeLinearIntensityFlopsPerByte,
      yVal: achieved(roofline.decodeLinearIntensityFlopsPerByte),
      color: "#c78300",
      dy: 20,
    },
    {
      id: "pre",
      label: `Prefill (${roofline.prefillIntensityFlopsPerByte.toFixed(0)})`,
      xVal: roofline.prefillIntensityFlopsPerByte,
      yVal: achieved(roofline.prefillIntensityFlopsPerByte),
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
        aria-label={`Roofline 对照图：脊点 ${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`}
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
        <path d={roofPath} fill="none" stroke="#17211f" strokeWidth="2.4" />
        <text
          x={ridgeLabelX}
          y={ridgeLabelY}
          textAnchor={ridgeLabelAnchor}
          fontSize="13.5"
          fontWeight="700"
          fill="#b54237"
          paintOrder="stroke"
          stroke="#fbfaf6"
          strokeWidth={3.5}
          strokeLinejoin="round"
        >
          脊点 {roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B
        </text>
        <text
          x={padL + 6}
          y={Math.max(14, ridgeY - 11)}
          fontSize="13.5"
          fill="#17211f"
          fontWeight="600"
          paintOrder="stroke"
          stroke="#fbfaf6"
          strokeWidth={3.5}
          strokeLinejoin="round"
        >
          峰值 {roofline.peakComputeTflops} {roofline.computePrecisionLabel}
        </text>
        {points.map((pt) => {
          const cx = logX(pt.xVal);
          const cy = logY(pt.yVal);
          const anchor = cx > width - 155 ? "end" : "start";
          const dx = anchor === "end" ? -10 : 10;
          const labelY =
            pt.id === "pre" ? Math.max(14, cy - 11) : Math.min(padT + plotH - 6, Math.max(14, cy + pt.dy));
          return (
            <g key={pt.id}>
              <circle cx={cx} cy={cy} r="6.5" fill={pt.color} stroke="#fbfaf6" strokeWidth="2" />
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
          TFLOP/s
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
          label="硬件脊点（算力 / 带宽）"
          value={`${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B`}
          sub={`${roofline.peakComputeTflops} ${roofline.computePrecisionLabel} ÷ ${roofline.hbmBandwidthGBs} GB/s`}
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

function FourQuestionsGrid({ plan }: { plan: DeployPlanReport }) {
  const [copied, setCopied] = useState(false);
  const { q1Fit, q2Capacity, q3Roofline, q4Recommendation } = plan.fourQuestions;
  const q1Tone =
    q1Fit.verdict === "blocked"
      ? "var(--color-danger)"
      : q1Fit.verdict === "warn"
        ? "var(--color-warning)"
        : "var(--color-token)";
  const q2Tone = q2Capacity.oomStatus === "fits" ? "var(--color-token)" : "var(--color-danger)";

  const handleCopyCli = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(q4Recommendation.cliHint).then(() => {
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
          <strong style={{ fontSize: 15 }}>Q1 · 架构与精度适配</strong>
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
          <strong style={{ fontSize: 15 }}>Q2 · 单卡与集群装得下吗</strong>
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
          <strong style={{ fontSize: 15 }}>Q3 · 卡算力墙还是带宽墙</strong>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 15 }}>Q4 · 推荐起步拓扑与命令提示</strong>
          <button type="button" className="wt-preset-btn" onClick={handleCopyCli}>
            {copied ? "已复制命令" : "复制命令"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)" }}>{q4Recommendation.rationale}</p>
        <pre
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
          {q4Recommendation.cliHint}
        </pre>
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
  const [expandedStage, setExpandedStage] = useState<number | null>(5);

  return (
    <section className="wt-section wt-calc-stages">
      <div className="wt-section-head">
        <h3 className="wt-section-title">7 级冷启动 HBM 静态区间瀑布账目</h3>
        <span className="wt-section-meta">
          预算 requested = M_total × u（{fmtGiB(plan.requestedBytes)}）｜ 预算外 1−u（
          {fmtGiB(plan.unbudgetedHeadroomBytes)}）支付 Stage 7 录图 + 150 MiB 裕度
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
  logText,
  onLogTextChange,
  activeTemplateId,
  onApplyTemplate,
}: {
  plan: DeployPlanReport;
  logText: string;
  onLogTextChange: (next: string) => void;
  activeTemplateId: string | null;
  onApplyTemplate: (tpl: SampleStartupLogTemplate) => void;
}) {
  const assistant = useOptionalWikiAssistant();
  const parsed = useMemo(() => parseAscendStartupLog(logText), [logText]);
  const recon: LogReconciliationReport = useMemo(() => reconcileStartupLog(plan, parsed), [plan, parsed]);

  const handleAskAssistant = () => {
    if (!assistant) return;
    const lines = recon.items
      .filter((it) => it.status !== "missing")
      .map(
        (it) =>
          `- ${it.title}: 实测 ${formatReconcileValue(it.measured, it.unit)} vs 预测 [${it.predictedLow}, ${it.predictedHigh}] ${it.unit}（${RECON_STATUS_META[it.status].label}，Δ=${formatReconcileDelta(it.delta, it.unit)}）`,
      )
      .join("\n");
    const prompt = [
      `我在昇腾 ${plan.card.name} 上用 ${plan.spec.name}（${plan.inputSummary.weightPrecision}，TP=${plan.inputSummary.tpSize}，PP=${plan.inputSummary.ppSize}，EP=${plan.inputSummary.enableEp ? plan.inputSummary.epWorldSize : "关"}，u=${plan.inputSummary.gpuMemoryUtilization}）做 Mode B 启动日志对账：`,
      recon.summary,
      lines,
      "请结合 vLLM-Ascend 7 级显存账目与 HCCL 不二次扣减守恒，帮我分析偏差根因和调参建议。",
    ].join("\n\n");
    assistant.openChat({ prompt });
  };

  return (
    <section className="wt-section wt-calc-reconcile">
      <div className="wt-presets">
        <span className="wt-presets-label">快速载入参考日志（同步 Mode A 配置）：</span>
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
                background: "var(--color-weight-soft)",
                color: "var(--color-warning)",
                fontWeight: 700,
              }}
            >
              参考模板 · 非真机实测
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
          <span className={recon.overallStatus === "oom-risk" ? "wt-blocked-banner" : "wt-pass-banner"}>
            {recon.summary}
          </span>
          <span className="wt-stat-pill">已提取行：{parsed.matchedLines.length}</span>
          {recon.impliedKvBytesPerToken !== null && (
            <span className="wt-stat-pill is-warn">
              日志反推单 token KV：{fmtBytes(recon.impliedKvBytesPerToken)}
            </span>
          )}
        </div>
        {assistant && (
          <button type="button" className="wt-assistant-btn" onClick={handleAskAssistant}>
            送入问答助手分析偏差
          </button>
        )}
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
  dcpSize: number;
  enableEp: boolean;
  gpuMemoryUtilization: number;
  maxModelLen: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  cudagraphMode: CudaGraphMode;
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
        <span className="wt-field-label">张量并行 TP</span>
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
          <label className="wt-field" style={{ minWidth: 120 }}>
            <span className="wt-field-label">代码基线</span>
            <select
              className="wt-select"
              value={state.version}
              onChange={(e) => onPatch({ version: e.target.value as RuleVersion })}
            >
              <option value="v0.30.0">v0.30.0（推荐）</option>
              <option value="main">main（最新）</option>
            </select>
          </label>

          <label className="wt-field" style={{ minWidth: 145 }}>
            <span className="wt-field-label">weight_nz_mode</span>
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

          <label className="wt-field" style={{ minWidth: 135 }}>
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

          <label className="wt-field" style={{ minWidth: 92 }}>
            <span className="wt-field-label">PP</span>
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

          <label className="wt-field" style={{ minWidth: 92 }}>
            <span className="wt-field-label">DP</span>
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

          <label className="wt-field" style={{ minWidth: 96 }}>
            <span className="wt-field-label">DCP（序列切分）</span>
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

          <label className="wt-field" style={{ minWidth: 180 }}>
            <span className="wt-field-label">
              gpu_memory_utilization = {state.gpuMemoryUtilization.toFixed(2)}
            </span>
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

          <label className="wt-field" style={{ minWidth: 130 }}>
            <span className="wt-field-label">max_model_len</span>
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

          <label className="wt-field" style={{ minWidth: 150 }}>
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

          <label className="wt-field" style={{ minWidth: 205 }}>
            <span className="wt-field-label">cudagraph_mode</span>
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
    </div>
  );
}

export function DeployCalculatorView({
  mode = "full",
  title,
  summary,
  initialModel,
  embedded = false,
}: DeployCalculatorViewProps) {
  const initialTrimmed = initialModel?.trim() ?? "";
  const startsWithJson = initialTrimmed.startsWith("{");
  const defaultPreset = matchInitialPresetId(startsWithJson ? undefined : initialModel);
  const [presetId, setPresetId] = useState<string>(defaultPreset);
  const [useCustomJson, setUseCustomJson] = useState(startsWithJson);
  const [customJsonText, setCustomJsonText] = useState<string>(
    startsWithJson ? initialTrimmed : DEFAULT_WAVE4_MLA_JSON,
  );
  const [activeWave4DemoId, setActiveWave4DemoId] = useState<string | null>(null);
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
  const [subMode, setSubMode] = useState<"static" | "reconcile">("static");
  const [logText, setLogText] = useState<string>(SAMPLE_ASCEND_STARTUP_LOGS[0]?.logText ?? "");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    SAMPLE_ASCEND_STARTUP_LOGS[0]?.id ?? null,
  );
  const [state, setState] = useState<CalcState>({
    version: "v0.30.0",
    cardId: "a2-64g",
    weightPrecision: "bf16",
    kvCacheDtype: "auto",
    weightNzMode: 1,
    tpSize: 1,
    ppSize: 1,
    dpSize: 1,
    dcpSize: 1,
    enableEp: false,
    gpuMemoryUtilization: DEFAULT_GPU_MEMORY_UTILIZATION,
    maxModelLen: 32768,
    maxNumBatchedTokens: DEFAULT_MAX_NUM_BATCHED_TOKENS,
    maxNumSeqs: DEFAULT_MAX_NUM_SEQS,
    cudagraphMode: "PIECEWISE",
    prefillTokens: 512,
    decodeBatchSize: 16,
    decodeContextLen: 4096,
  });

  const patchState = (patch: Partial<CalcState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const modelInput = useCustomJson ? customJsonText : presetId;
  const gate = useMemo(() => evaluateWave3ModelGate(modelInput), [modelInput]);

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
    };
    return evaluateDeployPlan(input);
  }, [gate, state]);

  const handleApplyTemplate = (tpl: SampleStartupLogTemplate) => {
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
      tpSize: rec.tpSize ?? 1,
      ppSize: rec.ppSize ?? 1,
      dpSize: rec.dpSize ?? 1,
      enableEp: Boolean(rec.enableEp),
      gpuMemoryUtilization: rec.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION,
      maxModelLen: rec.maxModelLen ?? 32768,
      maxNumBatchedTokens: rec.maxNumBatchedTokens ?? DEFAULT_MAX_NUM_BATCHED_TOKENS,
      cudagraphMode: rec.cudagraphMode ?? "PIECEWISE",
    }));
  };

  const resetToStandard = () => {
    setUseCustomJson(false);
    setActiveWave4DemoId(null);
    setPresetId("qwen3-8b");
  };

  const applyWave4Demo = (demo: Wave4DemoPreset) => {
    setCustomJsonText(JSON.stringify(demo.config, null, 2));
    setUseCustomJson(true);
    setActiveWave4DemoId(demo.id);
    patchState({
      tpSize: demo.recommendedTp,
      ppSize: demo.recommendedPp,
      dpSize: demo.recommendedDp,
      dcpSize: 1,
      enableEp: demo.recommendedEnableEp,
      weightPrecision: demo.recommendedPrecision,
    });
  };

  const displayTitle = title ?? "「立项四问」双模部署算账台";

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
            </div>
            <p className="wt-subtitle">
              {summary ??
                "Mode A 用 7 级冷启动显存区间 + Roofline 回答「立项四问」；Mode B 粘贴真实 vllm serve 日志逐项对账（HCCL 不二次扣减）。"}
            </p>
          </div>
          {mode === "full" && (
            <div className="wt-segmented" role="tablist" aria-label="算账台双模切换">
              <button
                type="button"
                role="tab"
                aria-selected={subMode === "static"}
                data-testid="calc-submode-static"
                className={`wt-seg-btn${subMode === "static" ? " is-active" : ""}`}
                onClick={() => setSubMode("static")}
              >
                Mode A · 7 级静态估算
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subMode === "reconcile"}
                data-testid="calc-submode-reconcile"
                className={`wt-seg-btn${subMode === "reconcile" ? " is-active" : ""}`}
                onClick={() => setSubMode("reconcile")}
              >
                Mode B · 真机日志对账
              </button>
            </div>
          )}
        </header>
      )}

      <div className="wt-presets">
        <span className="wt-presets-label">模型结构：</span>
        {MODEL_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`wt-preset-btn${!useCustomJson && presetId === p.id ? " is-active" : ""}`}
            onClick={() => {
              setUseCustomJson(false);
              setActiveWave4DemoId(null);
              setPresetId(p.id);
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
            setActiveWave4DemoId(null);
            setUseCustomJson(true);
          }}
        >
          粘贴 config.json
        </button>
        {mode === "full" &&
          WAVE4_DEMO_PRESETS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              data-testid={`wave4-demo-${demo.id}`}
              className={`wt-preset-btn${useCustomJson && activeWave4DemoId === demo.id ? " is-active" : ""}`}
              onClick={() => applyWave4Demo(demo)}
            >
              {demo.label}
            </button>
          ))}
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
              setActiveWave4DemoId(null);
              setCustomJsonText(e.target.value);
            }}
            placeholder="粘贴 HuggingFace config.json 原文..."
          />
        </div>
      )}

      {!gate.ok && (
        <div
          className="wt-card"
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

          {mode === "full" && subMode === "static" && (
            <>
              <FourQuestionsGrid plan={plan} />
              <SevenStageSection plan={plan} />
              <section className="wt-section">
                <div className="wt-section-head">
                  <h3 className="wt-section-title">Roofline 算术强度落点与硬件脊点对照</h3>
                  <span className="wt-section-meta">
                    {plan.card.shortName} · 脊点 {plan.roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B
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
            <ReconcileLogSection
              plan={plan}
              logText={logText}
              onLogTextChange={(next) => {
                setLogText(next);
                setActiveTemplateId(null);
              }}
              activeTemplateId={activeTemplateId}
              onApplyTemplate={handleApplyTemplate}
            />
          )}
        </>
      )}
    </div>
  );
}
