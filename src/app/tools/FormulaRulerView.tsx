import "../../design/tools.css";
import { type ChangeEvent, type CSSProperties, type DragEvent, useId, useMemo, useState } from "react";
import { type FormulaRulerMode, KNOWN_WIKI_TOOLS, type WikiToolSpec } from "../../content/wiki/toolFence";
import { fmtBytes } from "../../sim/modelspec/analyze";
import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  type DeployPlanReport,
  evaluateDeployPlan,
  GIB,
  getPerRankKvHeadLayout,
  KIB,
  MIB,
} from "../../sim/modelspec/deployCalculator";
import type { AttentionSpec, MlpSpec, ModelSpec } from "../../sim/modelspec/types";
import { selectMoeCommMethod } from "../../sim/rules/moeComm";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import {
  CUSTOM_INFERENCE_BADGE_TEXT,
  MAX_CUSTOM_HF_CONFIG_BYTES,
  RULER_MAX_LEN_OPTIONS,
  RULER_MODEL_PRESETS,
  RULER_PRECISION_OPTIONS,
  RULER_TP_OPTIONS,
  RULER_U_OPTIONS,
  type RulerMaxModelLen,
  type RulerTpSize,
  type RulerWeightPrecision,
  resolveEffectiveRulerModel,
  type TargetMachineStore,
  targetMachineStore,
  useTargetMachine,
} from "./targetMachineStore";
import { buildCalculatorQueryParams, serializeCustomModelForShare } from "./workbenchHandoff";

const MODE_LABELS: Readonly<Record<FormulaRulerMode, string>> = {
  "kv-token-bytes": "单词与分块 KV",
  "gqa-ratio": "GQA 压缩与复制",
  "mla-compression": "MLA 潜向量压缩",
  "tp-shard-comm": "TP 分片与通信",
  "moe-ep-dispatch": "MoE 专家与派发",
  "cold-start-budget": "7 级冷启动预算",
};

const MODE_DEFAULT_FROM_PAGE: Readonly<Record<FormulaRulerMode, string>> = {
  "kv-token-bytes": "kv-cache",
  "gqa-ratio": "gqa",
  "mla-compression": "mla",
  "tp-shard-comm": "tensor-parallel",
  "moe-ep-dispatch": "expert-parallel",
  "cold-start-budget": "kv-cache-memory-profiling",
};

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;

const NUM_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
};

const METRIC_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(192px, 1fr))",
  gap: 10,
};

function fmtGiB(bytes: number): string {
  return `${(bytes / GIB).toFixed(2)} GiB`;
}

function fmtKiB(bytes: number): string {
  return `${(bytes / KIB).toFixed(2)} KiB`;
}

function resolveFromPageSlug(
  explicitFromPage: string | undefined,
  assistantCurrentId: string | undefined,
  mode: FormulaRulerMode,
): string {
  if (explicitFromPage && SAFE_SLUG_RE.test(explicitFromPage.trim())) {
    return explicitFromPage.trim();
  }
  if (assistantCurrentId && SAFE_SLUG_RE.test(assistantCurrentId.trim())) {
    return assistantCurrentId.trim();
  }
  if (typeof window !== "undefined") {
    const m = /^#\/wiki\/([a-z0-9][a-z0-9-_]{0,127})/i.exec(window.location.hash ?? "");
    if (m?.[1]) return m[1];
  }
  return MODE_DEFAULT_FROM_PAGE[mode];
}

function getPrimaryAttn(spec: ModelSpec): AttentionSpec {
  const full = spec.layers.find((l) => l.attention.kind !== "linear_kda");
  return (full ?? spec.layers[0])!.attention;
}

type MetricTone = "kv" | "weight" | "comm" | "accent";

const TONE_COLOR_VAR: Readonly<Record<MetricTone, string>> = {
  kv: "var(--color-kv)",
  weight: "var(--color-weight)",
  comm: "var(--color-comm)",
  accent: "var(--color-accent)",
};

function RulerMetricCard({
  label,
  value,
  sub,
  tone = "kv",
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: MetricTone | undefined;
  testId?: string | undefined;
}) {
  const accentColor = TONE_COLOR_VAR[tone];
  return (
    <div
      data-testid={testId}
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-field)",
        border: "1px solid var(--color-line)",
        borderLeft: `3px solid ${accentColor}`,
        background: "var(--color-surface-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink-muted)" }}>{label}</span>
      <strong style={{ ...NUM_STYLE, fontSize: 16, color: "var(--color-ink)", lineHeight: 1.35 }}>
        {value}
      </strong>
      <span style={{ ...NUM_STYLE, fontSize: 12.5, color: "var(--color-ink-muted)", lineHeight: 1.45 }}>
        {sub}
      </span>
    </div>
  );
}

function fmtSeqLenShort(tokens: number): string {
  if (tokens === 131072) return "131K";
  if (tokens % 1024 === 0) return `${tokens / 1024}K`;
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K` : String(tokens);
}

function formatOomOverBudgetCause(plan: DeployPlanReport): string {
  const { stages, requestedBytes, inputSummary, fourQuestions } = plan;
  const q2 = fourQuestions.q2Capacity;
  const wBytes = stages[2].pointEstimateBytes;
  const actBytes = stages[3].pointEstimateBytes;
  const nonTorchBytes = stages[4].pointEstimateBytes;
  const uStr = inputSummary.gpuMemoryUtilization.toFixed(2);
  const prec = inputSummary.effectiveWeightPrecision;
  const card = plan.card.shortName;

  if (q2.oomStatus === "weights_exceed_budget") {
    return `${card}(u=${uStr}, ${prec}) 权重 ${fmtGiB(wBytes)} 已超预算 ${fmtGiB(requestedBytes)}`;
  }
  if (q2.oomStatus === "weights_plus_activation_exceed_budget") {
    return `${card}(u=${uStr}, ${prec}) 权重 ${fmtGiB(wBytes)}+激活 ${fmtGiB(actBytes)} 已超预算 ${fmtGiB(requestedBytes)}`;
  }
  if (q2.oomStatus === "non_kv_exceeds_budget") {
    return `${card}(u=${uStr}, ${prec}) 权重+激活+非Torch/HCCL 合计 ${fmtGiB(wBytes + actBytes + nonTorchBytes)} 已超预算 ${fmtGiB(requestedBytes)}`;
  }
  return `${card}(u=${uStr}, ${prec}) 可用 KV 池已耗尽`;
}

function isLinearStateExhaustingPagedPool(plan: DeployPlanReport): boolean {
  const q2 = plan.fourQuestions.q2Capacity;
  if (q2.kvPoolPointBytes <= 0 || q2.totalFixedLinearStateBytes <= 0) return false;
  if (q2.kvPoolPointBytes < q2.totalFixedLinearStateBytes) return true;
  return q2.kvBytesPerBlock > 0 && q2.usableBlocksPoint === 0;
}

function fmtRulerKvPoolShort(plan: DeployPlanReport): string {
  const q2 = plan.fourQuestions.q2Capacity;
  const maxLen = plan.inputSummary.maxModelLen;
  const seqLabel = fmtSeqLenShort(maxLen);
  if (q2.kvPoolPointBytes > 0) {
    if (isLinearStateExhaustingPagedPool(plan)) {
      return `${fmtGiB(q2.kvPoolPointBytes)}(KDA 固定状态占满)`;
    }
    if (q2.totalFixedLinearStateBytes > 0 && q2.kvBytesPerBlock === 0) {
      return `${fmtGiB(q2.kvPoolPointBytes)}(纯 KDA 并发 ${q2.maxConcurrencyPoint.toFixed(1)}×)`;
    }
    return `${fmtGiB(q2.kvPoolPointBytes)}(${seqLabel} ${q2.maxConcurrencyPoint.toFixed(1)}×)`;
  }
  const oneSeqKvBytes = q2.kvBytesPerTokenPerRank * maxLen;
  const causeLabel =
    q2.oomStatus === "non_kv_exceeds_budget"
      ? "非Torch/激活超预算"
      : q2.oomStatus === "weights_plus_activation_exceed_budget"
        ? "权重+激活超预算"
        : "权重超预算";
  return `超支(${causeLabel}, 1条${seqLabel}需KV ${fmtGiB(oneSeqKvBytes)})`;
}

function RulerQ1BlockersBanner({
  blockers,
}: {
  blockers: DeployPlanReport["fourQuestions"]["q1Fit"]["blockers"];
}) {
  if (blockers.length === 0) return null;
  const top = blockers[0]!;
  return (
    <div
      role="alert"
      data-testid="formula-ruler-blockers-alert"
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius-field)",
        border: "1px solid var(--color-comm)",
        background: "var(--color-accent-soft)",
        color: "var(--color-ink)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ color: "var(--color-comm)" }}>
        配置硬阻塞（{blockers.length} 项 · 无法直接启动）：{top.title}
      </strong>
      {" — "}
      <span>{top.message}</span>
      {blockers.length > 1 && (
        <span style={{ color: "var(--color-ink-muted)" }}>
          {" "}
          （另有 {blockers.length - 1} 项：
          {blockers
            .slice(1)
            .map((b) => b.title)
            .join("；")}
          ）
        </span>
      )}
    </div>
  );
}

function SingleSeqShortfallAlert({ plan }: { plan: DeployPlanReport }) {
  const q2 = plan.fourQuestions.q2Capacity;
  const seqLabel = fmtSeqLenShort(plan.inputSummary.maxModelLen);
  const linearStateExhausted = q2.totalFixedLinearStateBytes > 0 && q2.usableBlocksPoint === 0;
  const linearStatePartial = q2.totalFixedLinearStateBytes > 0 && q2.usableBlocksPoint > 0;
  return (
    <div
      role="status"
      data-testid="kv-single-seq-shortfall-alert"
      style={{
        padding: "8px 12px",
        borderRadius: "var(--radius-field)",
        border: "1px solid var(--color-accent)",
        background: "var(--color-accent-soft)",
        color: "var(--color-ink)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {linearStateExhausted ? (
        <>
          <strong style={{ color: "var(--color-accent)" }}>
            KDA 固定状态预留已耗尽分页可用块（需调小 max_num_seqs、升 TP 或换卡，单调小 max-model-len 无效）：
          </strong>
          当前预算内 KV 总池虽有 <strong style={NUM_STYLE}>{fmtGiB(q2.kvPoolPointBytes)}</strong>，但按{" "}
          <code style={NUM_STYLE}>max_num_seqs={plan.inputSummary.maxNumSeqs}</code> 需固定预留 KDA 线性状态{" "}
          <strong style={NUM_STYLE}>{fmtGiB(q2.totalFixedLinearStateBytes)}</strong>（单并发{" "}
          <strong style={NUM_STYLE}>{fmtGiB(q2.perSeqFixedLinearStateBytes)}</strong>
          ），剩余全注意分页可用块为 <strong style={NUM_STYLE}>0 块</strong>（0 tok），即使缩短{" "}
          <code style={NUM_STYLE}>max-model-len</code> 也无法分配出至少 1 个可用 KV 块。
        </>
      ) : linearStatePartial ? (
        <>
          <strong style={{ color: "var(--color-accent)" }}>
            扣除 KDA 固定状态后，全注意分页仍不足单条 {seqLabel} 满长序列（需调小 max-model-len、降
            max_num_seqs 或扩卡）：
          </strong>
          当前单卡可用 KV 总池 <strong style={NUM_STYLE}>{fmtGiB(q2.kvPoolPointBytes)}</strong>
          ，其中固定线性状态占 <strong style={NUM_STYLE}>{fmtGiB(q2.totalFixedLinearStateBytes)}</strong>
          ，剩余分页约{" "}
          <strong style={NUM_STYLE}>{q2.totalKvTokenSlotsPoint.toLocaleString("en-US")} tok</strong> /{" "}
          {q2.usableBlocksPoint.toLocaleString("en-US")} 块，低于单条{" "}
          <code style={NUM_STYLE}>{plan.inputSummary.maxModelLen.toLocaleString("en-US")}</code>{" "}
          上下文准入门槛。
        </>
      ) : (
        <>
          <strong style={{ color: "var(--color-accent)" }}>
            不足单条 {seqLabel} 满长序列（需调小 max-model-len 或扩卡）：
          </strong>
          当前单卡仍有可用 KV 池 <strong style={NUM_STYLE}>{fmtGiB(q2.kvPoolPointBytes)}</strong>（约{" "}
          <strong style={NUM_STYLE}>{q2.totalKvTokenSlotsPoint.toLocaleString("en-US")} tok</strong> /{" "}
          {q2.usableBlocksPoint.toLocaleString("en-US")} 块），仅低于单条{" "}
          <code style={NUM_STYLE}>{plan.inputSummary.maxModelLen.toLocaleString("en-US")}</code>{" "}
          上下文准入门槛。
        </>
      )}
    </div>
  );
}

function KvTokenBytesLens({ plan }: { plan: DeployPlanReport }) {
  const { spec, inputSummary, fourQuestions, wave4Arch } = plan;
  const q2 = fourQuestions.q2Capacity;
  const attn = getPrimaryAttn(spec);
  const kvElemBytes = inputSummary.kvCacheDtype === "int8" ? 1 : 2;
  const mlaHeadDim = wave4Arch.mla ? wave4Arch.mla.kvLoraRank + wave4Arch.mla.qkRopeHeadDim : 0;
  const mlaElemBytes =
    wave4Arch.mla && mlaHeadDim > 0
      ? Math.round(wave4Arch.mla.latentBytesPerTokenPerLayer / mlaHeadDim)
      : kvElemBytes;
  const perLayerPerTokBytes = wave4Arch.mla
    ? wave4Arch.mla.latentBytesPerTokenPerLayer + (wave4Arch.csa2?.indexerBytesPerTokenPerLayer ?? 0)
    : 2 * getPerRankKvHeadLayout(attn, inputSummary.tpSize).localKvDim * kvElemBytes;
  const layerFormula = wave4Arch.mla
    ? wave4Arch.csa2
      ? `(d_c=${wave4Arch.mla.kvLoraRank}+d_R=${wave4Arch.mla.qkRopeHeadDim})×${mlaElemBytes}B + 索引 ${wave4Arch.csa2.indexerBytesPerTokenPerLayer}B`
      : `(d_c=${wave4Arch.mla.kvLoraRank}+d_R=${wave4Arch.mla.qkRopeHeadDim})×${mlaElemBytes}B`
    : `2×${inputSummary.localKvHeadsPerRank}头×${attn.headDim}维×${kvElemBytes}B`;
  const hasPositiveKvPool = q2.kvPoolPointBytes > 0;
  const shortSingleSeq = hasPositiveKvPool && q2.oomStatus === "insufficient_for_single_max_len_seq";
  const linearStateExhausted = shortSingleSeq && isLinearStateExhaustingPagedPool(plan);
  const pureLinearKda = hasPositiveKvPool && q2.totalFixedLinearStateBytes > 0 && q2.kvBytesPerBlock === 0;
  const tightRisk = hasPositiveKvPool && q2.oomStatus === "tight_budget_oom_risk";
  const seqLabel = fmtSeqLenShort(inputSummary.maxModelLen);

  return (
    <div data-testid="lens-kv-token-bytes" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-kv-layer-bytes"
          tone="kv"
          label="单层 1 token K+V（每卡）"
          value={`${perLayerPerTokBytes.toLocaleString("en-US")} B`}
          sub={`${fmtKiB(perLayerPerTokBytes)} · ${layerFormula}`}
        />
        <RulerMetricCard
          testId="metric-kv-rank-token-bytes"
          tone="kv"
          label="全层每 token 每卡字节"
          value={fmtKiB(q2.kvBytesPerTokenPerRank)}
          sub={`${q2.kvBytesPerTokenPerRank.toLocaleString("en-US")} B · ${inputSummary.localLayersPerRank} 层合计`}
        />
        <RulerMetricCard
          testId="metric-kv-block-mib"
          tone="weight"
          label={`单块大小（block=${q2.effectiveBlockSize}）`}
          value={`${(q2.kvBytesPerBlock / MIB).toFixed(3)} MiB`}
          sub={`${q2.kvBytesPerBlock.toLocaleString("en-US")} B / 物理块`}
        />
        <RulerMetricCard
          testId="metric-kv-pool-tokens"
          tone={q2.oomStatus === "fits" && fourQuestions.q1Fit.blockers.length === 0 ? "accent" : "comm"}
          label="当前可用 KV 池可装容量"
          value={
            linearStateExhausted
              ? "0 tok（KDA 状态占满）"
              : pureLinearKda
                ? `${q2.maxConcurrencyPoint.toFixed(1)}×（纯 KDA 并发）`
                : hasPositiveKvPool
                  ? `${q2.totalKvTokenSlotsPoint.toLocaleString("en-US")} tok`
                  : "0.00 GiB (超支)"
          }
          sub={
            linearStateExhausted
              ? `总池 ${fmtGiB(q2.kvPoolPointBytes)} < 固定线性状态 ${fmtGiB(q2.totalFixedLinearStateBytes)} · 分页 0 块（降 max_num_seqs 或扩卡）`
              : pureLinearKda
                ? `总池 ${fmtGiB(q2.kvPoolPointBytes)} · 纯线性状态 ${fmtGiB(q2.perSeqFixedLinearStateBytes)}/seq（无全注意分页 KV）`
                : hasPositiveKvPool
                  ? shortSingleSeq
                    ? `池点估 ${fmtGiB(q2.kvPoolPointBytes)} · ${q2.usableBlocksPoint.toLocaleString("en-US")} 块 · 不足单条 ${seqLabel} 满长序列`
                    : `池点估 ${fmtGiB(q2.kvPoolPointBytes)} · ${q2.usableBlocksPoint.toLocaleString("en-US")} 块 · ${inputSummary.maxModelLen.toLocaleString("en-US")} 长约 ${q2.maxConcurrencyPoint.toFixed(1)}x${tightRisk ? "（上界偏紧）" : ""}`
                  : `${formatOomOverBudgetCause(plan)} · 1条${seqLabel}需KV ${fmtGiB(q2.kvBytesPerTokenPerRank * inputSummary.maxModelLen)}`
          }
        />
      </div>
      {shortSingleSeq && <SingleSeqShortfallAlert plan={plan} />}
    </div>
  );
}

function GqaRatioLens({ plan }: { plan: DeployPlanReport }) {
  const { spec, inputSummary, fourQuestions, wave4Arch } = plan;
  const attn = getPrimaryAttn(spec);
  const rawFullLayers = spec.layers.filter((l) => l.attention.kind !== "linear_kda").length;
  const hasZeroFullAttnLayers = rawFullLayers === 0;
  const fullLayers = hasZeroFullAttnLayers ? 0 : rawFullLayers;
  const refLayers = hasZeroFullAttnLayers ? spec.numLayers : fullLayers;
  const kvElemBytes = inputSummary.kvCacheDtype === "int8" ? 1 : 2;
  const tp = inputSummary.tpSize;
  const nQ = attn.numHeads;
  const nKv = wave4Arch.hasMla ? 1 : attn.numKvHeads;
  const headDim = wave4Arch.mla ? wave4Arch.mla.vHeadDim : attn.headDim;
  const mhaWholeModelBytes = refLayers * 2 * nQ * headDim * kvElemBytes;
  const curWholeModelBytes = hasZeroFullAttnLayers
    ? 0
    : wave4Arch.mla
      ? fullLayers * wave4Arch.mla.latentBytesPerTokenPerLayer
      : fullLayers * 2 * nKv * headDim * kvElemBytes;
  const ratio = curWholeModelBytes > 0 ? mhaWholeModelBytes / curWholeModelBytes : 1;
  const localQHeads = Math.max(1, Math.ceil(nQ / tp));
  const localKvHeads = inputSummary.localKvHeadsPerRank;
  const isReplicated = !wave4Arch.hasMla && !hasZeroFullAttnLayers && tp > nKv;
  const replicas = isReplicated ? Math.ceil(tp / nKv) : 1;
  const qDivisible = nQ % tp === 0;
  const kvDivisible = isReplicated ? tp % nKv === 0 : nKv % tp === 0;
  const headsIndivisible = !wave4Arch.hasMla && (!qDivisible || !kvDivisible);

  const q2 = fourQuestions.q2Capacity;
  const hasBlocker = fourQuestions.q1Fit.blockers.length > 0;
  const hasPositiveKvPool = q2.kvPoolPointBytes > 0;
  const linearStateExhausted = isLinearStateExhaustingPagedPool(plan);
  const pureLinearKda =
    hasZeroFullAttnLayers ||
    (hasPositiveKvPool && q2.totalFixedLinearStateBytes > 0 && q2.kvBytesPerBlock === 0);
  const seqLabel = fmtSeqLenShort(inputSummary.maxModelLen);
  const tpVerdict = hasZeroFullAttnLayers
    ? hasBlocker
      ? "配置硬阻塞（纯线性状态池）"
      : `纯 KDA 固定状态 ${fmtGiB(q2.totalFixedLinearStateBytes)}`
    : wave4Arch.hasMla
      ? hasBlocker
        ? "配置硬阻塞（MLA 潜向量不随 TP 切分）"
        : "潜向量不随 TP 切分"
      : headsIndivisible
        ? `整除阻塞（${!kvDivisible ? (isReplicated ? `TP=${tp} 非 n_kv=${nKv} 整数倍` : `n_kv=${nKv} 不可被 TP=${tp} 整除`) : `n_q=${nQ} 不可被 TP=${tp} 整除`}）`
        : hasBlocker
          ? `配置硬阻塞（理论免复制上限 TP=${nKv}）`
          : isReplicated
            ? `已越界 TP>${nKv}（复制态）`
            : `安全切分上限 TP=${nKv}`;

  return (
    <div data-testid="lens-gqa-ratio" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-gqa-mha-bytes"
          tone="weight"
          label={`同头宽 MHA 基准（${nQ}Q:${nQ}KV）`}
          value={fmtKiB(mhaWholeModelBytes)}
          sub={`单层 ${(2 * nQ * headDim * kvElemBytes).toLocaleString("en-US")} B · ${refLayers} 层对照`}
        />
        <RulerMetricCard
          testId="metric-gqa-current-bytes"
          tone="kv"
          label={
            hasZeroFullAttnLayers
              ? `当前纯线性 KDA（0 层分页 KV）`
              : wave4Arch.hasMla
                ? `当前 MLA 潜向量（${nQ}Q→1潜头）`
                : `当前 GQA（${nQ}Q:${nKv}KV）`
          }
          value={fmtKiB(curWholeModelBytes)}
          sub={
            hasZeroFullAttnLayers
              ? `全模型 0 层标准注意力（分页 KV = 0 B/token；线性状态池固定 ${fmtGiB(q2.totalFixedLinearStateBytes)}）`
              : `较同维 MHA 压缩 ${ratio.toFixed(1)}×（单层 ${(curWholeModelBytes / fullLayers).toLocaleString("en-US")} B）`
          }
        />
        <RulerMetricCard
          testId="metric-gqa-tp-shard"
          tone={headsIndivisible || isReplicated || wave4Arch.hasMla ? "comm" : "kv"}
          label={`TP=${tp} 每卡驻留头数与字节`}
          value={`${localQHeads}Q : ${localKvHeads}KV · ${fmtKiB(q2.kvBytesPerTokenPerRank)}`}
          sub={
            wave4Arch.hasMla
              ? `MLA 共享潜向量跨 TP=${tp} 整份复制`
              : headsIndivisible
                ? `无法启动：${!kvDivisible && isReplicated ? `TP=${tp} 无法按整数倍均衡复制 n_kv=${nKv}` : `TP=${tp} 无法整除 ${!kvDivisible ? `n_kv=${nKv}` : `n_q=${nQ}`}`}（整除阻塞）`
                : isReplicated
                  ? `replicas=${replicas}（每头跨 ${replicas} 卡复制）`
                  : hasBlocker
                    ? `TP=${tp} ≤ n_kv=${nKv} 几何均分（当前存在启动硬阻塞）`
                    : `TP=${tp} ≤ n_kv=${nKv} 且整除（零冗余均分）`
          }
        />
        <RulerMetricCard
          testId="metric-gqa-tp-boundary"
          tone={hasBlocker || isReplicated || !hasPositiveKvPool || linearStateExhausted ? "comm" : "weight"}
          label="TP 拐点与当前卡可用 KV"
          value={
            linearStateExhausted
              ? `${tpVerdict} · 池 ${fmtGiB(q2.kvPoolPointBytes)}（KDA 占满）`
              : hasPositiveKvPool
                ? `${tpVerdict} · 池 ${fmtGiB(q2.kvPoolPointBytes)}`
                : `${tpVerdict} · 0.00 GiB (超支)`
          }
          sub={
            linearStateExhausted
              ? `总池 ${fmtGiB(q2.kvPoolPointBytes)} 已被 KDA 固定状态 ${fmtGiB(q2.totalFixedLinearStateBytes)} 占满 · 可用 0 tok`
              : pureLinearKda
                ? `${plan.card.shortName}(u=${inputSummary.gpuMemoryUtilization.toFixed(2)}, ${inputSummary.effectiveWeightPrecision}) 纯 KDA 按并发预留 ${fmtGiB(q2.perSeqFixedLinearStateBytes)}/seq · 约 ${q2.maxConcurrencyPoint.toFixed(1)}×`
                : hasPositiveKvPool
                  ? `${plan.card.shortName}(u=${inputSummary.gpuMemoryUtilization.toFixed(2)}, ${inputSummary.effectiveWeightPrecision}) 可装 ${q2.totalKvTokenSlotsPoint.toLocaleString("en-US")} tok · ${seqLabel} 约 ${q2.maxConcurrencyPoint.toFixed(1)}×`
                  : `${formatOomOverBudgetCause(plan)} · 1条${seqLabel}需KV ${fmtGiB(q2.kvBytesPerTokenPerRank * inputSummary.maxModelLen)}`
          }
        />
      </div>
      {isReplicated && !headsIndivisible && (
        <div
          role="status"
          data-testid="gqa-kv-replication-alert"
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-accent)",
            background: "var(--color-accent-soft)",
            color: "var(--color-ink)",
            fontSize: 13,
          }}
        >
          <strong style={{ color: "var(--color-accent)" }}>
            KV 头跨卡复制提示（TP={tp} &gt; n_kv={nKv}）：
          </strong>
          每张卡保底驻留 <code style={NUM_STYLE}>1</code> 个完整 KV 头，同一 KV 头跨{" "}
          <code style={NUM_STYLE}>num_kv_head_replicas = {replicas}</code> 张卡重复驻留，单卡每 token KV 停在{" "}
          <strong style={NUM_STYLE}>{fmtKiB(fourQuestions.q2Capacity.kvBytesPerTokenPerRank)}</strong>，继续加
          TP 卡不再缩减单卡缓存！
        </div>
      )}
    </div>
  );
}

function MlaCompressionLens({
  plan,
  onSelectPreset,
}: {
  plan: DeployPlanReport;
  onSelectPreset: (presetId: string) => void;
}) {
  const { spec, inputSummary, fourQuestions, wave4Arch } = plan;
  const mlaRefPlan = useMemo(
    () =>
      wave4Arch.hasMla
        ? null
        : evaluateDeployPlan({
            model: "deepseek-v3-mla",
            cardId: plan.card.id,
            weightPrecision: inputSummary.weightPrecision,
            tpSize: inputSummary.tpSize,
            maxModelLen: inputSummary.maxModelLen,
            gpuMemoryUtilization: inputSummary.gpuMemoryUtilization,
          }),
    [
      wave4Arch.hasMla,
      plan.card.id,
      inputSummary.weightPrecision,
      inputSummary.tpSize,
      inputSummary.maxModelLen,
      inputSummary.gpuMemoryUtilization,
    ],
  );

  const q2 = fourQuestions.q2Capacity;
  const hasPositiveKvPool = q2.kvPoolPointBytes > 0;
  const seqLabel = fmtSeqLenShort(inputSummary.maxModelLen);
  const uStr = inputSummary.gpuMemoryUtilization.toFixed(2);

  if (wave4Arch.hasMla && wave4Arch.mla) {
    const m = wave4Arch.mla;
    return (
      <div data-testid="lens-mla-compression" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={METRIC_GRID_STYLE}>
          <RulerMetricCard
            testId="metric-mla-equiv-mha"
            tone="weight"
            label={`同头数展开 MHA 单层（${getPrimaryAttn(spec).numHeads} 头）`}
            value={`${m.equivalentMhaBytesPerTokenPerLayer.toLocaleString("en-US")} B`}
            sub={`${fmtKiB(m.equivalentMhaBytesPerTokenPerLayer)} / tok / 层（2×n_q×d_v×2B）`}
          />
          <RulerMetricCard
            testId="metric-mla-latent-layer"
            tone="kv"
            label="MLA 压缩潜向量单层"
            value={`${m.latentBytesPerTokenPerLayer.toLocaleString("en-US")} B`}
            sub={`(d_c=${m.kvLoraRank} + d_R=${m.qkRopeHeadDim}) × 2B = ${fmtKiB(m.latentBytesPerTokenPerLayer)}`}
          />
          <RulerMetricCard
            testId="metric-mla-ratio"
            tone="accent"
            label="单层主缓存压缩比"
            value={`${m.compressionRatio.toFixed(2)}×`}
            sub={`节省 ${((1 - 1 / m.compressionRatio) * 100).toFixed(1)}% 逐位置主状态`}
          />
          <RulerMetricCard
            testId="metric-mla-rank-total"
            tone={hasPositiveKvPool && fourQuestions.q1Fit.blockers.length === 0 ? "comm" : "accent"}
            label={`全层每卡与当前卡容量（TP=${inputSummary.tpSize}）`}
            value={`${fmtKiB(q2.kvBytesPerTokenPerRank)} · ${hasPositiveKvPool ? `池 ${fmtGiB(q2.kvPoolPointBytes)}` : "0.00 GiB (超支)"}`}
            sub={
              hasPositiveKvPool
                ? `${m.replicatedAcrossTp ? "潜向量跨 TP 复制" : "单卡潜向量"} · 权重 ${fmtGiB(plan.stages[2].pointEstimateBytes)} · ${plan.card.shortName}(u=${uStr}) ${seqLabel} 约 ${q2.maxConcurrencyPoint.toFixed(1)}×`
                : `${formatOomOverBudgetCause(plan)} · ${fmtRulerKvPoolShort(plan)}`
            }
          />
        </div>
      </div>
    );
  }

  const attn = getPrimaryAttn(spec);
  const tp = inputSummary.tpSize;
  const kvElemBytes = inputSummary.kvCacheDtype === "int8" ? 1 : 2;
  const curLayerBytes = 2 * getPerRankKvHeadLayout(attn, tp).localKvDim * kvElemBytes;
  const curPerRankBytes = q2.kvBytesPerTokenPerRank;
  const mlaPerRankBytes = mlaRefPlan!.fourQuestions.q2Capacity.kvBytesPerTokenPerRank;
  const mlaVsCurRatio = curPerRankBytes > 0 ? mlaPerRankBytes / curPerRankBytes : 1;
  const mlaRankCompareSub =
    mlaPerRankBytes < curPerRankBytes
      ? `纯 TP=${tp} 下 GQA 切头而 MLA 复制潜缓存：每卡为 ${spec.name} 的 ${mlaVsCurRatio.toFixed(2)}×（省 ${((1 - mlaVsCurRatio) * 100).toFixed(1)}%）`
      : `纯 TP=${tp} 下 GQA 切头而 MLA 复制潜缓存：每卡为 ${spec.name} 的 ${mlaVsCurRatio.toFixed(2)}×`;
  const refMla = mlaRefPlan!.wave4Arch.mla!;
  return (
    <div data-testid="lens-mla-compression" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-mla-current-gqa"
          tone="kv"
          label={`当前 ${spec.name}（标准 GQA）`}
          value={`${fmtKiB(curPerRankBytes)} / tok`}
          sub={`单层 ${curLayerBytes.toLocaleString("en-US")} B · ${plan.card.shortName}(u=${uStr}) 权重 ${fmtGiB(plan.stages[2].pointEstimateBytes)} · KV ${fmtRulerKvPoolShort(plan)}`}
        />
        <RulerMetricCard
          testId="metric-mla-deepseek-rule"
          tone="accent"
          label="MLA 潜向量规则（DeepSeek-V3 对照）"
          value={`${refMla.latentBytesPerTokenPerLayer.toLocaleString("en-US")} B / 层`}
          sub={`(d_c=${refMla.kvLoraRank}+d_R=${refMla.qkRopeHeadDim})×2B；零宽 NoPE(d_R=0) 为 1,024 B/层`}
        />
        <RulerMetricCard
          testId="metric-mla-vs-mha"
          tone="weight"
          label="128 头展开 MHA → MLA 压缩比"
          value={`${refMla.compressionRatio.toFixed(1)}×`}
          sub={`${refMla.equivalentMhaBytesPerTokenPerLayer.toLocaleString("en-US")} B → ${refMla.latentBytesPerTokenPerLayer.toLocaleString("en-US")} B / tok / 层`}
        />
        <RulerMetricCard
          testId="metric-mla-61layer-total"
          tone="comm"
          label="DeepSeek-V3 61 层全模每卡"
          value={fmtKiB(mlaPerRankBytes)}
          sub={mlaRankCompareSub}
        />
      </div>
      <div
        data-testid="mla-non-mla-compare-note"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "7px 11px",
          borderRadius: "var(--radius-field)",
          border: "1px solid var(--color-line)",
          background: "var(--color-surface)",
          fontSize: 13,
          color: "var(--color-ink-muted)",
        }}
      >
        <span>
          当前标尺为非 MLA 模型（<strong style={{ color: "var(--color-ink)" }}>{spec.name}</strong>
          ），已自动并列展示其单 token 缓存与 DeepSeek MLA <code style={NUM_STYLE}>(d_c + d_R) × 2B</code>{" "}
          压缩规则对照。
        </span>
        <button
          type="button"
          className="wt-preset-btn"
          data-testid="mla-switch-preset-btn"
          onClick={() => onSelectPreset("deepseek-v3-mla")}
          style={{ padding: "4px 10px", fontSize: 12.5 }}
        >
          切至 DeepSeek-V3 MLA 实算 →
        </button>
      </div>
    </div>
  );
}

function TpShardCommLens({ plan }: { plan: DeployPlanReport }) {
  const { spec, inputSummary, roofline } = plan;
  const tp = inputSummary.tpSize;
  const tp1Plan = useMemo(
    () =>
      tp === 1
        ? plan
        : evaluateDeployPlan({
            model: spec,
            cardId: plan.card.id,
            weightPrecision: inputSummary.weightPrecision,
            tpSize: 1,
            maxModelLen: inputSummary.maxModelLen,
            gpuMemoryUtilization: inputSummary.gpuMemoryUtilization,
          }),
    [
      tp,
      plan,
      spec,
      inputSummary.weightPrecision,
      inputSummary.maxModelLen,
      inputSummary.gpuMemoryUtilization,
    ],
  );
  const uStr = inputSummary.gpuMemoryUtilization.toFixed(2);
  const layers = inputSummary.localLayersPerRank;
  const arPerLayer = tp > 1 ? 2 : 0;
  const arTotal = arPerLayer * layers;
  const H = spec.hidden;
  const decB = roofline.decodeBatchSize;
  const preT = roofline.prefillTokens;
  const singleArDecBytes = decB * H * 2;
  const singleArPreBytes = preT * H * 2;
  const totalArDecBytes = arTotal * singleArDecBytes;
  const totalArPreBytes = arTotal * singleArPreBytes;

  return (
    <div data-testid="lens-tp-shard-comm" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-tp-weight-gib"
          tone="weight"
          label={`单卡分片权重与腾出 KV（TP=${tp}）`}
          value={fmtGiB(plan.stages[2].pointEstimateBytes)}
          sub={`TP=1 整模 ${fmtGiB(tp1Plan.stages[2].pointEstimateBytes)}（${inputSummary.effectiveWeightPrecision}）· ${plan.card.shortName}(u=${uStr}) KV ${fmtRulerKvPoolShort(plan)}`}
        />
        <RulerMetricCard
          testId="metric-tp-ar-count"
          tone="comm"
          label="列切→行切 All-Reduce 次数"
          value={tp > 1 ? `${arPerLayer} 次/层 · 共 ${arTotal} 次` : "0 次/层（TP=1 免跨卡）"}
          sub={
            tp > 1
              ? `o_proj + down_proj 各 1 次 × ${layers} 层（词表另计）`
              : `扩至 TP≥2 时固定 2 次/层 × ${layers} 层 = ${2 * layers} 次`
          }
        />
        <RulerMetricCard
          testId="metric-tp-decode-comm"
          tone="comm"
          label={`Decode 单步激活通信（B=${decB}）`}
          value={
            tp > 1 ? `${fmtBytes(singleArDecBytes)} / 次` : `0 B（TP≥2 为 ${fmtBytes(singleArDecBytes)}/次）`
          }
          sub={
            tp > 1
              ? `单词 T=1 为 ${fmtBytes(H * 2)} · ${layers} 层累计 ${fmtBytes(totalArDecBytes)}`
              : `${layers} 层累计 ${fmtBytes(totalArDecBytes)}（TP≥2 时每步为 ${fmtBytes(2 * layers * singleArDecBytes)}）`
          }
        />
        <RulerMetricCard
          testId="metric-tp-prefill-comm"
          tone="accent"
          label={`Prefill 单步激活通信（T=${preT}）`}
          value={
            tp > 1 ? `${fmtBytes(singleArPreBytes)} / 次` : `0 B（TP≥2 为 ${fmtBytes(singleArPreBytes)}/次）`
          }
          sub={
            tp > 1
              ? `载荷 T×H×2B（H=${H}） · ${layers} 层累计 ${fmtBytes(totalArPreBytes)}`
              : `${layers} 层累计 ${fmtBytes(totalArPreBytes)}（TP≥2 时每步为 ${fmtBytes(2 * layers * singleArPreBytes)}）`
          }
        />
      </div>
    </div>
  );
}

function extractFirstMoe(
  spec: ModelSpec,
): { moe: Extract<MlpSpec, { kind: "moe" }>; moeLayerCount: number } | null {
  let moe: Extract<MlpSpec, { kind: "moe" }> | null = null;
  let moeLayerCount = 0;
  for (const l of spec.layers) {
    if (l.mlp.kind === "moe") {
      moeLayerCount += 1;
      if (!moe) moe = l.mlp;
    }
  }
  return moe ? { moe, moeLayerCount } : null;
}

function MoeEpDispatchLens({
  plan,
  onSelectPreset,
}: {
  plan: DeployPlanReport;
  onSelectPreset: (presetId: string) => void;
}) {
  const { inputSummary } = plan;
  const tp = inputSummary.tpSize;
  const targetModel = plan.isMoe ? plan.spec : "qwen3-30b-a3b";
  const epOnPlan = useMemo(
    () =>
      evaluateDeployPlan({
        model: targetModel,
        cardId: plan.card.id,
        weightPrecision: inputSummary.weightPrecision,
        tpSize: tp,
        enableEp: true,
        maxModelLen: inputSummary.maxModelLen,
        gpuMemoryUtilization: inputSummary.gpuMemoryUtilization,
      }),
    [
      targetModel,
      plan.card.id,
      inputSummary.weightPrecision,
      tp,
      inputSummary.maxModelLen,
      inputSummary.gpuMemoryUtilization,
    ],
  );
  const epOffPlan = useMemo(
    () =>
      evaluateDeployPlan({
        model: targetModel,
        cardId: plan.card.id,
        weightPrecision: inputSummary.weightPrecision,
        tpSize: tp,
        enableEp: false,
        maxModelLen: inputSummary.maxModelLen,
        gpuMemoryUtilization: inputSummary.gpuMemoryUtilization,
      }),
    [
      targetModel,
      plan.card.id,
      inputSummary.weightPrecision,
      tp,
      inputSummary.maxModelLen,
      inputSummary.gpuMemoryUtilization,
    ],
  );

  const moeInfo = extractFirstMoe(epOnPlan.spec)!;
  const { moe, moeLayerCount } = moeInfo;
  const epWorld = Math.max(1, tp);
  const localExpertsEpOn = Math.ceil(moe.numExperts / epWorld);
  const localSliceDimEpOff = Math.ceil(moe.moeIntermediate / epWorld);
  const moeComm = selectMoeCommMethod(
    {
      hardwareFamily: plan.card.family,
      tpSize: tp,
      ppSize: 1,
      dpSize: 1,
      pcpSize: 1,
      isMoe: true,
      enableExpertParallel: true,
      numExperts: moe.numExperts,
      numExpertsPerTok: moe.topK,
      maxNumBatchedTokens: inputSummary.maxNumBatchedTokens,
      maxNumSeqs: inputSummary.maxNumSeqs,
    },
    plan.version,
  );
  const isDynInt8 = inputSummary.weightPrecision === "w8a8_dynamic";
  const dispPairBytes = epOnPlan.spec.hidden * (isDynInt8 ? 1 : 2) + (isDynInt8 ? 4 : 0);
  const combPairBytes = epOnPlan.spec.hidden * 2;
  const perTokLayerComm = moe.topK * (dispPairBytes + combPairBytes);
  const uStr = inputSummary.gpuMemoryUtilization.toFixed(2);

  return (
    <div data-testid="lens-moe-ep-dispatch" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!plan.isMoe && (
        <div
          role="status"
          data-testid="moe-non-moe-hint"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-weight)",
            background: "var(--color-weight-soft)",
            fontSize: 13,
            color: "var(--color-ink)",
          }}
        >
          <span>
            当前选中的 <strong>{plan.spec.name}</strong> 为稠密前馈模型（无路由专家）；下方先行展示{" "}
            <code style={NUM_STYLE}>qwen3-30b-a3b</code> 参考切分，建议切换到{" "}
            <code style={NUM_STYLE}>qwen3-30b-a3b</code> 实时观察专家并行切分！
          </span>
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="moe-switch-qwen3-moe-btn"
            onClick={() => onSelectPreset("qwen3-30b-a3b")}
            style={{ padding: "4px 10px", fontSize: 12.5 }}
          >
            切到 qwen3-30b-a3b 观察专家切分 →
          </button>
        </div>
      )}
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-moe-routed-topk"
          tone="weight"
          label={`${plan.isMoe ? "" : "[参考] "}路由专家 vs 激活 top-k`}
          value={`${moe.numExperts} 选 top-${moe.topK}`}
          sub={`激活率 ${((moe.topK / moe.numExperts) * 100).toFixed(1)}% · 共享 ${moe.numSharedExperts} 个 · ${moeLayerCount} 层${plan.isMoe ? "" : `（当前稠密 ${plan.spec.name} ${plan.spec.numLayers}层 H=${plan.spec.hidden}）`}`}
        />
        <RulerMetricCard
          testId="metric-moe-ep-on"
          tone="accent"
          label={`EP 开启（EP=${epWorld} 整份分专家）`}
          value={`${localExpertsEpOn} 完整专家 / 卡`}
          sub={`I=${moe.moeIntermediate} 不切 · 权重 ${fmtGiB(epOnPlan.stages[2].pointEstimateBytes)} · ${epOnPlan.card.shortName}(u=${uStr}) KV ${fmtRulerKvPoolShort(epOnPlan)}`}
        />
        <RulerMetricCard
          testId="metric-moe-ep-off"
          tone="kv"
          label={`EP 关闭（TP=${epWorld} 切窄条）`}
          value={`${moe.numExperts} 专家 × 1/${epWorld} 片`}
          sub={`窄条 I/TP=${localSliceDimEpOff} · 权重 ${fmtGiB(epOffPlan.stages[2].pointEstimateBytes)} · KV ${fmtRulerKvPoolShort(epOffPlan)}`}
        />
        <RulerMetricCard
          testId="metric-moe-dispatch-comm"
          tone="comm"
          label="Dispatch + Combine 通信特征"
          value={
            epWorld <= 1
              ? "0 B（单卡免跨卡派发）"
              : moeComm.method === "ALLGATHER"
                ? "ALLGATHER（全收集模式）"
                : `${moeComm.method ?? "ALLTOALL"} · ${fmtBytes(perTokLayerComm)}/tok/层`
          }
          sub={
            epWorld <= 1
              ? `ep_size=1 无跨卡专家通信（扩至多卡走 Dispatch/Combine 时每层上限 ${fmtBytes(perTokLayerComm)}/tok）`
              : moeComm.method === "ALLGATHER"
                ? `${moeComm.reason}（非逐 token top-${moe.topK} 派发模式；若切至 MC2/ALLTOALL 则每层上限 ${fmtBytes(perTokLayerComm)}/tok）`
                : `${moeComm.mc2TokensCapacity !== null ? `MC2 门槛 ${moeComm.mc2TokensCapacity} tok · ` : ""}${moeLayerCount} 层上限 ${fmtBytes(moeLayerCount * perTokLayerComm)}/tok`
          }
        />
      </div>
    </div>
  );
}

function ColdStartBudgetLens({ plan }: { plan: DeployPlanReport }) {
  const {
    stages,
    totalHbmBytes,
    requestedBytes,
    unbudgetedHeadroomBytes,
    headroomStatus,
    inputSummary,
    fourQuestions,
  } = plan;
  const total = Math.max(1, totalHbmBytes);
  const wBytes = stages[2].pointEstimateBytes;
  const actBytes = stages[3].pointEstimateBytes;
  const nonTorchBytes = stages[4].pointEstimateBytes;
  const q2 = fourQuestions.q2Capacity;
  const kvBytes = stages[5].pointEstimateBytes;
  const aclBytes = stages[6].pointEstimateBytes;
  const uPct = Math.min(100, (requestedBytes / total) * 100);
  const hasPositiveKvPool = q2.kvPoolPointBytes > 0;
  const shortSingleSeq = hasPositiveKvPool && q2.oomStatus === "insufficient_for_single_max_len_seq";
  const linearStateExhausted = shortSingleSeq && isLinearStateExhaustingPagedPool(plan);
  const blockers = fourQuestions.q1Fit.blockers;
  const firstBlocker = blockers[0];
  const seqLabel = fmtSeqLenShort(inputSummary.maxModelLen);
  const statusLabel = linearStateExhausted
    ? firstBlocker
      ? "硬阻塞：KDA 固定状态占满分页池"
      : "KDA 固定状态占满分页池"
    : firstBlocker
      ? !hasPositiveKvPool
        ? `硬阻塞(${firstBlocker.title}) + 预算超额`
        : `硬阻塞：${firstBlocker.title}`
      : !hasPositiveKvPool
        ? "预算内超额 (OOM)"
        : shortSingleSeq
          ? `不足单条 ${seqLabel} 满长序列`
          : headroomStatus === "overflow"
            ? "穿透 1−u 录图 OOM 风险"
            : headroomStatus === "risk" || q2.oomStatus === "tight_budget_oom_risk"
              ? "1−u 余量偏紧"
              : "7 级账目与 1−u 余量安全";

  return (
    <div data-testid="lens-cold-start-budget" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          height: 16,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-line)",
        }}
      >
        {[
          { id: "w", bytes: wBytes, bg: "var(--color-weight)" },
          { id: "act", bytes: actBytes, bg: "var(--color-accent)" },
          { id: "nt", bytes: nonTorchBytes, bg: "var(--color-comm)" },
          { id: "kv", bytes: kvBytes, bg: "var(--color-kv)" },
        ].map((seg) => {
          const pct = Math.min(100, Math.max(0, (seg.bytes / total) * 100));
          return pct > 0.2 ? <div key={seg.id} style={{ width: `${pct}%`, background: seg.bg }} /> : null;
        })}
        <div
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
      <div style={METRIC_GRID_STYLE}>
        <RulerMetricCard
          testId="metric-budget-total"
          tone="kv"
          label={`1–2. 总显存 · u=${inputSummary.gpuMemoryUtilization.toFixed(2)}`}
          value={`${fmtGiB(totalHbmBytes)} → 预算 ${fmtGiB(requestedBytes)}`}
          sub={`预算外 1−u 留 ${fmtGiB(unbudgetedHeadroomBytes)}`}
        />
        <RulerMetricCard
          testId="metric-budget-weight-act"
          tone="weight"
          label="3–5. 预算内权重 + 激活峰值"
          value={`${fmtGiB(wBytes)} + ${fmtGiB(actBytes + nonTorchBytes)}`}
          sub={`激活 ${fmtGiB(actBytes)} + 非Torch/HCCL ${fmtGiB(nonTorchBytes)}`}
        />
        <RulerMetricCard
          testId="metric-budget-kv-pool"
          tone={hasPositiveKvPool && !shortSingleSeq ? "kv" : "comm"}
          label="6. 剩余可用 KV 池"
          value={
            linearStateExhausted
              ? `${fmtGiB(q2.kvPoolPointBytes)} (分页 0 块)`
              : hasPositiveKvPool
                ? fmtGiB(q2.kvPoolPointBytes)
                : "0.00 GiB (超支)"
          }
          sub={
            linearStateExhausted
              ? `KDA 固定线性状态已预留 ${fmtGiB(q2.totalFixedLinearStateBytes)} · 可用分页 0 块 / 0 tok（降 max_num_seqs 或扩卡）`
              : hasPositiveKvPool
                ? `${q2.totalFixedLinearStateBytes > 0 ? `固定状态预留 ${fmtGiB(q2.totalFixedLinearStateBytes)} · ` : ""}${q2.usableBlocksPoint.toLocaleString("en-US")} 块 · ${q2.totalKvTokenSlotsPoint.toLocaleString("en-US")} tok · ${shortSingleSeq ? `不足单条 ${seqLabel} 满长` : `${seqLabel} 约 ${q2.maxConcurrencyPoint.toFixed(1)}× 并发`}`
                : `${formatOomOverBudgetCause(plan)} · 1条${seqLabel}仍需KV ${fmtGiB(q2.kvBytesPerTokenPerRank * inputSummary.maxModelLen)}`
          }
        />
        <RulerMetricCard
          testId="metric-budget-headroom"
          tone={!firstBlocker && headroomStatus === "safe" && q2.oomStatus === "fits" ? "accent" : "comm"}
          label="7. 1−u 录图余量状态"
          value={statusLabel}
          sub={`ACLGraph+150M 约 ${fmtGiB(aclBytes)} vs 1−u ${fmtGiB(unbudgetedHeadroomBytes)}`}
        />
      </div>
      {shortSingleSeq && <SingleSeqShortfallAlert plan={plan} />}
    </div>
  );
}

export function nextCustomDrawerOpen(currentOpen: boolean, action: "toggle" | "open" | "close"): boolean {
  if (action === "toggle") return !currentOpen;
  return action === "open";
}

export interface FormulaRulerViewProps {
  mode?: FormulaRulerMode | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  fenceModel?: string | undefined;
  fromPage?: string | undefined;
  embedded?: boolean | undefined;
  store?: TargetMachineStore | undefined;
  customDrawerOpen?: boolean | undefined;
  onCustomDrawerOpenChange?: ((open: boolean) => void) | undefined;
}

export function FormulaRulerView({
  mode = "kv-token-bytes",
  title,
  summary,
  fenceModel,
  fromPage,
  embedded = true,
  store,
  customDrawerOpen,
  onCustomDrawerOpenChange,
}: FormulaRulerViewProps) {
  const activeStore = store ?? targetMachineStore;
  const state = useTargetMachine(activeStore);
  const assistant = useOptionalWikiAssistant();
  const [localDrawerOpen, setLocalDrawerOpen] = useState(() => state.modelMode === "custom");
  const [dragActive, setDragActive] = useState(false);
  const fileInputId = useId();
  const showCustomDrawer = customDrawerOpen ?? localDrawerOpen;
  const updateDrawerOpen = (action: "toggle" | "open" | "close") => {
    const next = nextCustomDrawerOpen(showCustomDrawer, action);
    setLocalDrawerOpen(next);
    onCustomDrawerOpenChange?.(next);
  };

  const effective = useMemo(() => resolveEffectiveRulerModel(state, fenceModel), [state, fenceModel]);

  const effectiveEnableEp = mode === "moe-ep-dispatch" ? true : state.enableEp;

  const plan = useMemo(
    () =>
      evaluateDeployPlan({
        model: effective.spec,
        cardId: state.cardId,
        weightPrecision: state.weightPrecision,
        tpSize: state.tpSize,
        ppSize: 1,
        dpSize: 1,
        enableEp: effectiveEnableEp,
        maxModelLen: state.maxModelLen,
        gpuMemoryUtilization: state.gpuMemoryUtilization,
      }),
    [
      effective.spec,
      state.cardId,
      state.weightPrecision,
      state.tpSize,
      effectiveEnableEp,
      state.maxModelLen,
      state.gpuMemoryUtilization,
    ],
  );

  const resolvedFromPage = resolveFromPageSlug(fromPage, assistant?.wikiHost?.currentId, mode);

  const calculatorLink = useMemo(() => {
    const preserve = new URLSearchParams();
    preserve.set("fromPage", resolvedFromPage);
    const effectiveGraphMode = plan.inputSummary.cudagraphMode;
    const calcParams = buildCalculatorQueryParams(
      {
        presetId: effective.activePresetId ?? undefined,
        cardId: state.cardId,
        weightPrecision: state.weightPrecision,
        tpSize: state.tpSize,
        ppSize: 1,
        dpSize: 1,
        enableEp: plan.isMoe && (mode === "moe-ep-dispatch" || state.enableEp),
        gpuMemoryUtilization: state.gpuMemoryUtilization,
        maxModelLen: state.maxModelLen,
        ...(effectiveGraphMode !== "PIECEWISE" ? { cudagraphMode: effectiveGraphMode } : {}),
        ...(effectiveGraphMode === "NONE" ? { enforceEager: true } : {}),
      },
      preserve,
    );
    if (effective.isCustomModel) {
      const shareGuard = serializeCustomModelForShare(state.validatedCustomJsonText);
      if (!shareGuard.ok) {
        return {
          href: null,
          disabledReason: "自定义 config.json 超过 URL 分享长度上限，请复制 JSON 到部署算账台粘贴",
        } as const;
      }
      calcParams.set("customModel", shareGuard.compact);
    }
    return { href: `#/tools?${calcParams.toString()}`, disabledReason: null } as const;
  }, [
    resolvedFromPage,
    effective.activePresetId,
    effective.isCustomModel,
    state.cardId,
    state.weightPrecision,
    state.tpSize,
    state.enableEp,
    state.gpuMemoryUtilization,
    state.maxModelLen,
    state.validatedCustomJsonText,
    plan.isMoe,
    plan.inputSummary.cudagraphMode,
    mode,
  ]);

  const handleFileLoad = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CUSTOM_HF_CONFIG_BYTES) {
      activeStore.applyCustomConfig("x".repeat(MAX_CUSTOM_HF_CONFIG_BYTES + 8));
      updateDrawerOpen("open");
      return;
    }
    void file.text().then((txt) => {
      activeStore.applyCustomConfig(txt);
      updateDrawerOpen("open");
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileLoad(file);
      return;
    }
    const droppedText = e.dataTransfer?.getData("text/plain");
    if (droppedText?.trim()) {
      activeStore.applyCustomConfig(droppedText);
      updateDrawerOpen("open");
    }
  };

  const handleModelSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__custom__") {
      updateDrawerOpen("open");
      return;
    }
    activeStore.setPreset(val);
    updateDrawerOpen("close");
  };

  const displayTitle = title ?? KNOWN_WIKI_TOOLS["formula-ruler"].title;
  const selectModelValue = effective.isCustomModel
    ? "__custom__"
    : (effective.activePresetId ?? effective.baselinePresetId);

  return (
    <section
      aria-label={displayTitle}
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="formula-ruler-view"
      data-mode={mode}
      data-deviated={String(effective.isDeviated)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      style={{
        gap: 10,
        ...(dragActive
          ? {
              outline: "2px dashed var(--color-accent)",
              outlineOffset: 4,
              borderRadius: "var(--radius-card)",
            }
          : {}),
      }}
    >
      <header
        className="wiki-tool-head"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div className="wt-embedded-title-group">
          <strong className="wiki-tool-title">{displayTitle}</strong>
          <span className="wiki-tool-badge">{MODE_LABELS[mode]}</span>
          {effective.isDeviated ? (
            <span
              data-testid="formula-ruler-custom-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 9px",
                borderRadius: 999,
                border: "1px solid var(--color-weight)",
                background: "var(--color-weight-soft)",
                color: "var(--color-ink)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {CUSTOM_INFERENCE_BADGE_TEXT}
            </span>
          ) : (
            <span className="wt-baseline-pill" data-testid="formula-ruler-baseline-badge">
              审定基线 · {effective.spec.name}
            </span>
          )}
        </div>
        <div style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="ruler-toggle-custom-json"
            aria-expanded={showCustomDrawer}
            onClick={() => updateDrawerOpen("toggle")}
            style={{ padding: "4px 10px", fontSize: 12.5 }}
          >
            {showCustomDrawer ? "收起 config.json" : "粘贴/拖入 config.json"}
          </button>
          <button
            type="button"
            className={`wt-preset-btn${effective.isDeviated ? " is-active" : ""}`}
            data-testid="formula-ruler-reset"
            onClick={() => {
              activeStore.resetToBaseline();
              updateDrawerOpen("close");
            }}
            style={{ padding: "4px 11px", fontSize: 12.5, fontWeight: 700 }}
          >
            恢复审定基线
          </button>
        </div>
      </header>
      {summary && (
        <p className="wiki-tool-summary" style={{ margin: 0 }}>
          {summary}
        </p>
      )}

      <div
        className="wt-controls-bar"
        data-testid="formula-ruler-controls"
        style={{ padding: "10px 12px", gap: "8px 12px", background: "var(--color-surface-elevated)" }}
      >
        <label className="wt-field" style={{ minWidth: 210, flex: "2 1 220px" }}>
          <span className="wt-field-label">目标模型标尺</span>
          <select
            className="wt-select"
            data-testid="ruler-model-select"
            value={selectModelValue}
            onChange={handleModelSelectChange}
          >
            {RULER_MODEL_PRESETS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
            <option value="__custom__">
              {effective.isCustomModel ? `自定义: ${effective.spec.name}` : "自定义 HuggingFace config.json…"}
            </option>
          </select>
        </label>

        <label className="wt-field" style={{ minWidth: 162, flex: "1.3 1 168px" }}>
          <span className="wt-field-label">昇腾卡型</span>
          <select
            className="wt-select"
            data-testid="ruler-card-select"
            value={state.cardId}
            onChange={(e) => activeStore.setCardId(e.target.value as AscendCalcCardId)}
          >
            {ASCEND_CALC_CARDS.map((card) => (
              <option key={card.id} value={card.id}>
                {card.shortName}（{card.hbmGiB} GiB）
              </option>
            ))}
          </select>
        </label>

        <label className="wt-field" style={{ minWidth: 135 }}>
          <span className="wt-field-label">权重精度</span>
          <select
            className="wt-select"
            data-testid="ruler-precision-select"
            value={state.weightPrecision}
            onChange={(e) => activeStore.setWeightPrecision(e.target.value as RulerWeightPrecision)}
          >
            {RULER_PRECISION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="wt-field" style={{ minWidth: 86 }}>
          <span className="wt-field-label">TP 并行</span>
          <select
            className="wt-select"
            data-testid="ruler-tp-select"
            value={state.tpSize}
            onChange={(e) => activeStore.setTpSize(Number(e.target.value) as RulerTpSize)}
          >
            {RULER_TP_OPTIONS.map((tpVal) => (
              <option key={tpVal} value={tpVal}>
                TP = {tpVal}
              </option>
            ))}
          </select>
        </label>

        <label className="wt-field" style={{ minWidth: 112 }}>
          <span className="wt-field-label">上下文长</span>
          <select
            className="wt-select"
            data-testid="ruler-maxlen-select"
            value={state.maxModelLen}
            onChange={(e) => activeStore.setMaxModelLen(Number(e.target.value) as RulerMaxModelLen)}
          >
            {RULER_MAX_LEN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="wt-field" style={{ minWidth: 96 }}>
          <span className="wt-field-label">显存比 u</span>
          <select
            className="wt-select"
            data-testid="ruler-u-select"
            value={state.gpuMemoryUtilization.toFixed(2)}
            onChange={(e) => activeStore.setGpuMemoryUtilization(Number(e.target.value))}
          >
            {RULER_U_OPTIONS.map((uVal) => (
              <option key={uVal} value={uVal.toFixed(2)}>
                u = {uVal.toFixed(2)}
                {Math.abs(uVal - 0.92) < 1e-6
                  ? " (源码默认)"
                  : Math.abs(uVal - 0.9) < 1e-6
                    ? " (稳妥推荐)"
                    : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showCustomDrawer && (
        <div
          className="wt-editor-card"
          data-testid="formula-ruler-custom-drawer"
          style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
              粘贴或拖入 HuggingFace <code style={NUM_STYLE}>config.json</code>（最大 64 KB，经安全准入校验）
            </span>
            <label
              htmlFor={fileInputId}
              className="wt-preset-btn"
              style={{ padding: "3px 10px", fontSize: 12.5, cursor: "pointer" }}
            >
              选择本地 config.json
              <input
                id={fileInputId}
                type="file"
                accept=".json,application/json"
                data-testid="ruler-custom-file-input"
                style={{ display: "none" }}
                onChange={(e) => handleFileLoad(e.target.files?.[0])}
              />
            </label>
          </div>
          <textarea
            className="wt-textarea"
            data-testid="ruler-custom-json-input"
            rows={4}
            value={state.customDraftText}
            onChange={(e) => activeStore.applyCustomConfig(e.target.value)}
            placeholder='{"model_type":"qwen3","hidden_size":4096,"num_hidden_layers":36,"num_attention_heads":32,"num_key_value_heads":8,"intermediate_size":12288,"vocab_size":151936}'
            style={{ minHeight: 84, fontSize: 12.5, fontFamily: "var(--font-mono)" }}
          />
        </div>
      )}

      {state.customError && (
        <div
          role="alert"
          data-testid="formula-ruler-config-error"
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-accent)",
            background: "var(--color-accent-soft)",
            color: "var(--color-ink)",
            fontSize: 13,
          }}
        >
          <strong style={{ color: "var(--color-accent)" }}>自定义 config.json 校验提示：</strong>
          {state.customError}（当前继续沿用安全标尺 <strong style={NUM_STYLE}>{effective.spec.name}</strong>{" "}
          显示，不中断阅读）
        </div>
      )}

      <RulerQ1BlockersBanner blockers={plan.fourQuestions.q1Fit.blockers} />

      {mode === "kv-token-bytes" && <KvTokenBytesLens plan={plan} />}
      {mode === "gqa-ratio" && <GqaRatioLens plan={plan} />}
      {mode === "mla-compression" && (
        <MlaCompressionLens plan={plan} onSelectPreset={(id) => activeStore.setPreset(id)} />
      )}
      {mode === "tp-shard-comm" && <TpShardCommLens plan={plan} />}
      {mode === "moe-ep-dispatch" && (
        <MoeEpDispatchLens plan={plan} onSelectPreset={(id) => activeStore.setPreset(id)} />
      )}
      {mode === "cold-start-budget" && <ColdStartBudgetLens plan={plan} />}

      <footer
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingTop: 2,
        }}
      >
        <span style={{ ...NUM_STYLE, fontSize: 12, color: "var(--color-ink-muted)" }}>
          单真源：{plan.spec.name} · {plan.card.shortName} · TP={plan.inputSummary.tpSize} · u=
          {plan.inputSummary.gpuMemoryUtilization.toFixed(2)}
        </span>
        {calculatorLink.href !== null ? (
          <a
            className="wt-open-workbench"
            data-testid="formula-ruler-open-calculator"
            href={calculatorLink.href}
          >
            带此配置打开部署算账台 →
          </a>
        ) : (
          <div style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span
              data-testid="formula-ruler-calculator-url-limit-note"
              style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 600 }}
            >
              {calculatorLink.disabledReason}
            </span>
            <button
              type="button"
              className="wt-open-workbench"
              data-testid="formula-ruler-open-calculator"
              disabled
              aria-disabled="true"
              style={{ opacity: 0.55, cursor: "not-allowed" }}
            >
              带此配置打开部署算账台 →
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}

const ALLOWED_RULER_MODES = new Set<string>(KNOWN_WIKI_TOOLS["formula-ruler"].allowedModes);

export function WikiFormulaRulerBlock({ spec }: { spec: WikiToolSpec }) {
  const resolvedMode: FormulaRulerMode =
    spec.mode && ALLOWED_RULER_MODES.has(spec.mode) ? (spec.mode as FormulaRulerMode) : "kv-token-bytes";
  return (
    <FormulaRulerView
      mode={resolvedMode}
      title={spec.title}
      summary={spec.summary}
      fenceModel={spec.model}
      embedded
    />
  );
}
