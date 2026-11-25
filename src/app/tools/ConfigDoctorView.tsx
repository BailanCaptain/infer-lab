import "../../design/tools.css";
import { type MouseEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { sourceUrl } from "../../content/wiki/index";
import { parseRepoRef } from "../../content/wiki/schema";
import { runPdConfigDoctorWithLinks, runSingleConfigDoctorWithLinks } from "../../content/wiki/toolDeeplinks";
import type { WikiToolSpec } from "../../content/wiki/toolFence";
import { parseVllmServeCommand } from "../../sim/doctor/cliParser";
import type {
  DoctorFinding,
  DoctorMode,
  DoctorScope,
  EffectiveRewriteRow,
  PdConfigDoctorReport,
  SingleConfigDoctorReport,
} from "../../sim/doctor/configDoctor";
import {
  FULL_SINGLE_DOCTOR_PRESETS,
  MINIMAL_DOCTOR_PRESETS,
  PD_DOCTOR_PRESETS,
  type PdDoctorPreset,
  type SingleDoctorPreset,
} from "../../sim/doctor/presets";
import {
  analyzePdUpgradeRadar,
  analyzeSingleUpgradeRadar,
  LEGACY_V023_MIGRATION_SAMPLE_CMD,
  type UpgradeImpactSeverity,
  type UpgradeRadarReport,
  type UpgradeTargetVersion,
} from "../../sim/doctor/upgradeRadar";
import type {
  AscendFamily,
  CouplingCheckInput,
  EnvVarClassification,
  RuleJudgment,
  RuleVersion,
} from "../../sim/rules";
import { buildHardwareDeployHrefFromCommand } from "../model/hardwareDeployOverlay";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { ToolDeepLinkById, ToolDeepLinkChip } from "./ToolDeepLinkChip";
import {
  buildDoctorChatAnalysis,
  buildDoctorQueryParams,
  buildDoctorShareLink,
  copyTextToClipboard,
  type DoctorModelHintKey,
  type DoctorModelTraitOverride,
  type DoctorQueryOverrides,
  hasExplicitDoctorQueryParams,
  type LegacyUpgradeFromVersion,
  matchExactDoctorPresetId,
  parseDoctorQueryParams,
  resolveDoctorModelTraits,
  sanitizeDiagnosticText,
  workbenchHandoffStore,
} from "./workbenchHandoff";

type DoctorTopology = "single" | "pd";
type ModelHintKey = DoctorModelHintKey;
type FindingFilter = "all" | RuleJudgment;

interface PendingDoctor3dReturn {
  readonly seq: number;
  readonly commandText: string;
  readonly hardwareFamily: AscendFamily;
  readonly version: Extract<RuleVersion, "v0.30.0" | "main">;
}

let pendingDoctor3dReturnSeq = 0;
let pendingDoctor3dReturn: PendingDoctor3dReturn | null = null;

export function extractNormalizedCliModel(commandText: string): string | null {
  const raw = parseVllmServeCommand(commandText).model?.trim();
  return raw ? raw.toLowerCase() : null;
}

function toCouplingTraitOverride(
  traits: DoctorModelTraitOverride | undefined,
): Partial<CouplingCheckInput> | undefined {
  if (!traits) return undefined;
  const out: Partial<CouplingCheckInput> = {};
  if (traits.isMoe !== undefined) out.isMoe = traits.isMoe;
  if (traits.useMla !== undefined) out.useMla = traits.useMla;
  if (traits.sfaDcpReplicatedIndexer !== undefined) {
    out.sfaDcpReplicatedIndexer = traits.sfaDcpReplicatedIndexer;
  }
  if (traits.numExperts !== undefined) out.numExperts = traits.numExperts;
  if (traits.numExpertsPerTok !== undefined) out.numExpertsPerTok = traits.numExpertsPerTok;
  if (traits.numAttentionHeads !== undefined) out.numAttentionHeads = traits.numAttentionHeads;
  if (traits.numKvHeads !== undefined) out.numKvHeads = traits.numKvHeads;
  if (traits.headDim !== undefined) out.headDim = traits.headDim;
  return Object.keys(out).length > 0 ? out : undefined;
}

const HARDWARE_OPTIONS: ReadonlyArray<{ value: AscendFamily; label: string }> = [
  { value: "A2", label: "Atlas A2" },
  { value: "A3", label: "Atlas A3" },
  { value: "310P", label: "Atlas 300I DUO (310P)" },
  { value: "A5", label: "Ascend 950 (A5)" },
];

const VERSION_OPTIONS: ReadonlyArray<{ value: Extract<RuleVersion, "v0.30.0" | "main">; label: string }> = [
  { value: "v0.30.0", label: "v0.30.0 (c09d3e20)" },
  { value: "main", label: "main (8d6180e2)" },
];

const UPGRADE_FROM_OPTIONS: ReadonlyArray<{ value: "" | LegacyUpgradeFromVersion; label: string }> = [
  { value: "", label: "关闭" },
  { value: "v0.23.0", label: "从 v0.23.0 (2c59ff10) 升级" },
  { value: "v0.26.0rc", label: "从 v0.26.0rc (2ed6cbba) 升级" },
];

const UPGRADE_SEVERITY_META: Readonly<
  Record<
    UpgradeImpactSeverity,
    { label: string; short: string; cardCls: string; borderColor: string; targetBg: string }
  >
> = {
  "breaking-error": {
    label: "启动即报错 breaking-error",
    short: "硬阻断",
    cardCls: "is-error",
    borderColor: "var(--color-danger)",
    targetBg: "color-mix(in srgb, var(--color-danger) 8%, var(--color-surface-elevated))",
  },
  "silent-noop": {
    label: "静默零读取 silent-noop",
    short: "退役无效",
    cardCls: "is-silent-rewrite",
    borderColor: "var(--color-weight)",
    targetBg: "color-mix(in srgb, var(--color-weight-soft) 65%, var(--color-surface-elevated))",
  },
  "behavior-changed": {
    label: "语义/层级变更 behavior-changed",
    short: "优先级/层级变更",
    cardCls: "is-warn",
    borderColor: "var(--color-comm)",
    targetBg: "color-mix(in srgb, var(--color-comm-soft) 65%, var(--color-surface-elevated))",
  },
  "legacy-counterproductive": {
    label: "历史绕过反噬 legacy-counterproductive",
    short: "吞吐反噬",
    cardCls: "is-warn",
    borderColor: "var(--color-accent)",
    targetBg: "color-mix(in srgb, var(--color-accent-soft) 68%, var(--color-surface-elevated))",
  },
};

const MODEL_HINT_OPTIONS: ReadonlyArray<{ value: ModelHintKey; label: string }> = [
  { value: "auto", label: "自动识别" },
  { value: "qwen3-0.6b", label: "Qwen3-0.6B (Dense GQA)" },
  { value: "qwen3-8b", label: "Qwen3-8B (Dense GQA)" },
  { value: "qwen3-32b", label: "Qwen3-32B (Dense GQA)" },
  { value: "qwen3-30b-a3b", label: "Qwen3-30B-A3B (MoE)" },
  { value: "qwen3-235b-a22b", label: "Qwen3-235B-A22B (MoE)" },
];

const JUDGMENT_META: Readonly<Record<RuleJudgment, { label: string; short: string; cls: string }>> = {
  error: { label: "硬报错 error", short: "硬报错", cls: "is-error" },
  "silent-rewrite": { label: "静默改写 silent-rewrite", short: "静默改写", cls: "is-silent-rewrite" },
  warn: { label: "告警 warn", short: "告警", cls: "is-warn" },
  unknown: { label: "待核 unknown [I]", short: "待核 [I]", cls: "is-unknown" },
};

const SCOPE_LABELS: Readonly<Record<DoctorScope, string>> = {
  single: "单实例",
  prefill: "Prefill",
  decode: "Decode",
  "cross-instance": "跨实例 P↔D",
};

const ENV_META: Readonly<Record<EnvVarClassification["judgment"], { label: string; cls: string }>> = {
  "known-read": { label: "已知读取", cls: "is-known" },
  retired: { label: "已退役", cls: "is-retired" },
  "deprecated-fallback": { label: "弃用回退", cls: "is-deprecated" },
  unknown: { label: "待核 [I]", cls: "is-unknown" },
};

function SourceRefLink({ rawRef }: { rawRef: string }) {
  const parsed = parseRepoRef(rawRef);
  const href = parsed ? sourceUrl(parsed) : null;
  if (href) {
    return (
      <a className="wt-source-link" href={href} target="_blank" rel="noreferrer">
        {rawRef}
      </a>
    );
  }
  return <code className="wt-source-link wt-source-link-plain">{rawRef}</code>;
}

function FindingCard({ finding, showScope }: { finding: DoctorFinding; showScope: boolean }) {
  const jMeta = JUDGMENT_META[finding.judgment];
  return (
    <article
      className={`wt-finding-card ${jMeta.cls}`}
      data-testid={`doctor-finding-${finding.id}`}
      data-judgment={finding.judgment}
    >
      <div className="wt-finding-head">
        <span className={`wt-badge-judgment ${jMeta.cls}`}>{jMeta.label}</span>
        {showScope && <span className="wt-badge-scope">{SCOPE_LABELS[finding.scope]}</span>}
        <span className="wt-badge-evidence">证据 [{finding.evidenceLevel}]</span>
        <h4 className="wt-finding-title">{finding.title}</h4>
      </div>
      <p className="wt-finding-msg">{finding.message}</p>
      {finding.remediation && (
        <p className="wt-finding-remediation">
          <strong>建议修复：</strong>
          {finding.remediation}
        </p>
      )}
      {(finding.sources.length > 0 || finding.deepLinks.length > 0) && (
        <div className="wt-finding-footer">
          {finding.sources.length > 0 && (
            <div className="wt-source-links">
              {finding.sources.map((src) => (
                <SourceRefLink key={`${finding.id}-src-${src}`} rawRef={src} />
              ))}
            </div>
          )}
          {finding.deepLinks.length > 0 && (
            <div className="wt-deeplinks">
              {finding.deepLinks.map((link) => (
                <ToolDeepLinkChip key={`${finding.id}-link-${link.href}`} link={link} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function UpgradeRadarItemCard({
  item,
  fromVersion,
  fromCommit,
  toVersion,
  toCommit,
  showScope,
}: {
  item: UpgradeRadarReport["items"][number];
  fromVersion: LegacyUpgradeFromVersion;
  fromCommit: string;
  toVersion: UpgradeTargetVersion;
  toCommit: string;
  showScope: boolean;
}) {
  const meta = UPGRADE_SEVERITY_META[item.severity];
  return (
    <article
      className={`wt-finding-card ${meta.cardCls}`}
      data-testid={`doctor-upgrade-item-${item.id}`}
      data-severity={item.severity}
      style={{ borderLeftColor: meta.borderColor }}
    >
      <div className="wt-finding-head">
        <span className={`wt-badge-judgment ${meta.cardCls}`}>{meta.label}</span>
        {showScope && <span className="wt-badge-scope">{SCOPE_LABELS[item.scope]}</span>}
        <span className="wt-badge-evidence">证据 [{item.evidenceLevel}]</span>
        <code className="wt-code-inline">{item.subject}</code>
        <h4 className="wt-finding-title">{item.title}</h4>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        <div
          style={{
            padding: "9px 11px",
            borderRadius: "var(--radius-field)",
            border: "1px solid var(--color-line)",
            background: "var(--color-canvas)",
            fontSize: 13.5,
            lineHeight: 1.58,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--color-ink-muted)", marginBottom: 3 }}>
            旧基线行为 · {fromVersion} ({fromCommit})
          </div>
          <div>{item.legacyBehavior}</div>
        </div>
        <div
          style={{
            padding: "9px 11px",
            borderRadius: "var(--radius-field)",
            border: `1px solid color-mix(in srgb, ${meta.borderColor} 38%, var(--color-line))`,
            background: meta.targetBg,
            fontSize: 13.5,
            lineHeight: 1.58,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--color-ink)", marginBottom: 3 }}>
            目标基线冲击 · {toVersion} ({toCommit})
          </div>
          <div>{item.targetBehavior}</div>
        </div>
      </div>
      <p className="wt-finding-remediation">
        <strong>迁移修复建议：</strong>
        {item.remediation}
      </p>
      <div className="wt-finding-footer">
        {item.sources.length > 0 && (
          <div className="wt-source-links">
            {item.sources.map((src) => (
              <SourceRefLink key={`${item.id}-src-${src}`} rawRef={src} />
            ))}
          </div>
        )}
        {item.wikiPageIds.length > 0 && (
          <div className="wt-deeplinks">
            {item.wikiPageIds.map((pid) => (
              <ToolDeepLinkById key={`${item.id}-wiki-${pid}`} pageId={pid} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function UpgradeRadarPanel({
  report,
  showScope,
  onLoadSample,
  onApplyRecommendedSingle,
  onApplyRecommendedPd,
}: {
  report: UpgradeRadarReport;
  showScope: boolean;
  onLoadSample: () => void;
  onApplyRecommendedSingle?: ((cmd: string) => void) | undefined;
  onApplyRecommendedPd?: ((prefillCmd: string, decodeCmd: string) => void) | undefined;
}) {
  const { counts, fromVersion, fromCommit, toVersion, toCommit } = report;
  const hasRecommended = Boolean(report.recommendedSingleCommand || report.recommendedPdCommands);
  return (
    <section
      className="wt-section"
      data-testid="doctor-upgrade-radar"
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-card)",
        border: "1px solid color-mix(in srgb, var(--color-weight) 45%, var(--color-line))",
        background: "color-mix(in srgb, var(--color-weight-soft) 38%, var(--color-surface))",
      }}
    >
      <div className="wt-section-head">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="wt-demo-badge">迁移雷达</span>
          <h3 className="wt-section-title">
            版本迁移冲击波对照：{fromVersion} ({fromCommit}) → {toVersion} ({toCommit})
          </h3>
        </div>
        <button
          type="button"
          className="wt-preset-btn"
          data-testid="doctor-upgrade-load-sample"
          onClick={onLoadSample}
        >
          <span className="wt-preset-dot is-pitfall" />
          <span>加载 v0.23 老脚本迁移示例</span>
        </button>
      </div>

      <div className="wt-summary-left">
        <span className="wt-stat-pill is-error">启动即报错 {counts.breakingError}</span>
        <span className="wt-stat-pill is-rewrite">静默零读取 {counts.silentNoop}</span>
        <span className="wt-stat-pill is-warn">优先级/层级变更 {counts.behaviorChanged}</span>
        <span className="wt-stat-pill is-unknown">历史绕过反噬 {counts.legacyCounterproductive}</span>
      </div>

      {report.items.length === 0 ? (
        <div className="wt-empty-state" data-testid="doctor-upgrade-clean-state">
          <strong>当前命令未命中四类已知静态迁移冲突</strong>（未检出已删 JSON 键、已退役环境变量、FlashComm1
          优先级反转或 Eager 绕过开关）。
          <div style={{ marginTop: 6, fontSize: 13.5 }}>{report.honestBoundaryNote}</div>
        </div>
      ) : (
        <>
          <div className="wt-findings-list">
            {report.items.map((item) => (
              <UpgradeRadarItemCard
                key={`${item.scope}-${item.id}-${item.subject}`}
                item={item}
                fromVersion={fromVersion}
                fromCommit={fromCommit}
                toVersion={toVersion}
                toCommit={toCommit}
                showScope={showScope}
              />
            ))}
          </div>
          {hasRecommended && (
            <div
              className="wt-card"
              data-testid="doctor-upgrade-recommended-box"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderColor: "color-mix(in srgb, var(--color-token) 45%, var(--color-line))",
              }}
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
                <strong style={{ fontSize: 13.5, color: "var(--color-ink)" }}>
                  升级至 {toVersion} 推荐命令草稿（已自动清理退役项与风险绕过）
                </strong>
                {report.recommendedSingleCommand && onApplyRecommendedSingle && (
                  <button
                    type="button"
                    className="wt-assistant-btn"
                    data-testid="doctor-upgrade-apply-recommended"
                    onClick={() => onApplyRecommendedSingle(report.recommendedSingleCommand!)}
                  >
                    一键套用至上方命令框重检
                  </button>
                )}
                {report.recommendedPdCommands && onApplyRecommendedPd && (
                  <button
                    type="button"
                    className="wt-assistant-btn"
                    data-testid="doctor-upgrade-apply-recommended"
                    onClick={() =>
                      onApplyRecommendedPd(
                        report.recommendedPdCommands!.prefillCommand,
                        report.recommendedPdCommands!.decodeCommand,
                      )
                    }
                  >
                    一键套用至 Prefill / Decode 命令框重检
                  </button>
                )}
              </div>
              {report.recommendedSingleCommand && (
                <pre
                  data-testid="doctor-upgrade-recommended-cmd"
                  style={{
                    margin: 0,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-field)",
                    background: "var(--color-surface-sunken)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {report.recommendedSingleCommand}
                </pre>
              )}
              {report.recommendedPdCommands && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <pre
                    data-testid="doctor-upgrade-recommended-prefill-cmd"
                    style={{
                      margin: 0,
                      padding: "8px 10px",
                      borderRadius: "var(--radius-field)",
                      background: "var(--color-surface-sunken)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {`# Prefill\n${report.recommendedPdCommands.prefillCommand}\n\n# Decode\n${report.recommendedPdCommands.decodeCommand}`}
                  </pre>
                </div>
              )}
            </div>
          )}
          <p className="wt-insight-meta" data-testid="doctor-upgrade-boundary-note">
            <strong>核验边界：</strong>
            {report.honestBoundaryNote}
          </p>
        </>
      )}
    </section>
  );
}

interface ScopedRewriteRow {
  scopeLabel?: string | undefined;
  row: EffectiveRewriteRow;
}

function EffectiveRewritesTable({ rows }: { rows: readonly ScopedRewriteRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="wt-section" data-testid="doctor-rewrites-section">
      <div className="wt-section-head">
        <h3 className="wt-section-title">会被自动补齐或悄悄改写的参数</h3>
        <span className="wt-section-meta">共 {rows.length} 项默认补齐 / 静默改写</span>
      </div>
      <div className="wt-table-wrap">
        <table className="wt-table">
          <thead>
            <tr>
              <th>参数项</th>
              <th>命令输入 / 未传</th>
              <th>运行时实际生效值</th>
              <th>改写原因与源码锚点</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ scopeLabel, row }) => (
              <tr
                key={`${scopeLabel ?? "single"}-${row.param}-${row.ruleId ?? row.kind}-${row.effectiveValue}`}
              >
                <td>
                  {scopeLabel && <span className="wt-badge-scope">{scopeLabel}</span>}{" "}
                  <code className="wt-code-inline">{row.param}</code>
                  <span
                    className={`wt-rewrite-kind ${row.kind === "silent-rewrite" ? "is-silent" : "is-default"}`}
                  >
                    {row.kind === "silent-rewrite" ? "静默改写" : "源码默认"}
                  </span>
                </td>
                <td>{row.userInput}</td>
                <td>
                  <strong>{row.effectiveValue}</strong>
                </td>
                <td>
                  <div>{row.reason}</div>
                  {row.source && (
                    <div className="wt-source-links" style={{ marginTop: 6 }}>
                      <SourceRefLink rawRef={row.source} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InstanceInsightsCards({
  report,
  scopeTitle,
}: {
  report: SingleConfigDoctorReport;
  scopeTitle?: string | undefined;
}) {
  const b = report.batchTokensResolution;
  const moe = report.moeCommSelection;
  const hccl = report.hcclEstimate;
  const envs = report.envClassifications;
  const prefix = scopeTitle ? `[${scopeTitle}] ` : "";

  return (
    <div
      className="wt-insights-grid"
      data-testid={scopeTitle ? `doctor-insights-${scopeTitle}` : "doctor-insights"}
    >
      <div className="wt-insight-card">
        <div className="wt-insight-title">
          <span>{prefix}批处理预算推导</span>
          <span className="wt-baseline-pill">max_num_seqs={b.finalMaxNumSeqs}</span>
        </div>
        <div className="wt-insight-value">max_num_batched_tokens = {b.finalMaxNumBatchedTokens}</div>
        <div className="wt-insight-steps">
          <span className="wt-insight-step">初值 {b.initialBatchedTokens}</span>
          <span className="wt-insight-step">DP-MoE {b.afterBatchedDpMoe}</span>
          <span className="wt-insight-step">吞吐 {b.afterThroughputMode}</span>
          <span className="wt-insight-step">Chunked {b.afterChunkedPrefillFloor}</span>
          <span className="wt-insight-step">限长 {b.afterModelLimitCap}</span>
          {b.spPcpRounded && b.spPcpDivisor !== null && (
            <span className="wt-insight-step">SP/PCP×{b.spPcpDivisor} 向上取整</span>
          )}
        </div>
        <p className="wt-insight-meta">
          {b.deviceMemoryFallbackTriggered
            ? "torch_npu 尚未初始化导致显存探测回落，走 2048 起始基线。"
            : "按显式配置或已初始化显存容量完成 6 分支推导。"}
        </p>
      </div>

      {moe && (
        <div className="wt-insight-card">
          <div className="wt-insight-title">
            <span>{prefix}MoE 通信策略</span>
            {moe.mc2TokensCapacity !== null && (
              <span className="wt-baseline-pill">MC2 上限 {moe.mc2TokensCapacity} tok</span>
            )}
          </div>
          <div className="wt-insight-value">{moe.method ?? "未启用 EP 通信"}</div>
          <p className="wt-insight-meta">{moe.reason}</p>
        </div>
      )}

      {hccl && (
        <div className="wt-insight-card">
          <div className="wt-insight-title">
            <span>{prefix}HCCL 通信域常驻显存</span>
            <span className="wt-baseline-pill">
              实体化 {hccl.uniqueMaterializedGroups.length} 组
              {hccl.deduplicatedGroupCount > 0 ? `（复用去重 ${hccl.deduplicatedGroupCount}）` : ""}
            </span>
          </div>
          <div className="wt-insight-value">≈ {hccl.totalMaterializedMiB} MiB</div>
          <p className="wt-insight-meta">
            DP 域单组 {hccl.dpBufferSizeMiB} MiB；
            {hccl.mc2GovernedByCannBuffsize
              ? "MC2 域由环境变量 HCCL_BUFFSIZE 接管。"
              : "常规通信域由内置 buffsize 管理，profile_run 已含预估缓冲。"}
          </p>
        </div>
      )}

      {envs.length > 0 && (
        <div className="wt-insight-card">
          <div className="wt-insight-title">
            <span>{prefix}环境变量源码核验</span>
            <span className="wt-baseline-pill">{envs.length} 项</span>
          </div>
          <div className="wt-env-pills">
            {envs.map((env) => {
              const meta = ENV_META[env.judgment];
              return (
                <span
                  key={`${scopeTitle ?? "single"}-env-${env.name}`}
                  className={`wt-env-pill ${meta.cls}`}
                  title={env.reason}
                >
                  <span>{env.name}</span>
                  <span>· {meta.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function buildAssistantPrompt(opts: {
  mode: DoctorMode;
  topology: DoctorTopology;
  hardwareFamily: AscendFamily;
  decodeHardwareFamily: AscendFamily;
  version: RuleVersion;
  commandText: string;
  prefillCommandText: string;
  decodeCommandText: string;
  findings: readonly DoctorFinding[];
}): string {
  const topFindings = opts.findings.slice(0, 6);
  const summaryLines =
    topFindings.length > 0
      ? topFindings.map(
          (f, idx) =>
            `${idx + 1}. [${JUDGMENT_META[f.judgment].short}${opts.topology === "pd" ? ` / ${SCOPE_LABELS[f.scope]}` : ""}] ${f.title}：${f.message}`,
        )
      : ["当前未检测到硬阻断或告警，请帮我复核是否有潜在性能调优空间。"];

  const cmdBlock =
    opts.topology === "pd"
      ? `Prefill (${opts.hardwareFamily}):\n\`\`\`bash\n${opts.prefillCommandText.trim()}\n\`\`\`\n\nDecode (${opts.decodeHardwareFamily}):\n\`\`\`bash\n${opts.decodeCommandText.trim()}\n\`\`\``
      : `单实例 (${opts.hardwareFamily}):\n\`\`\`bash\n${opts.commandText.trim()}\n\`\`\``;

  return [
    `请结合 vllm-ascend ${opts.version} 源码帮我深究以下 vllm serve 配置体检结果（模式: ${opts.mode}，拓扑: ${opts.topology === "pd" ? "P/D 分离双实例" : "单实例"}）：`,
    "",
    cmdBlock,
    "",
    "主要体检发现：",
    ...summaryLines,
    "",
    "请解释触发原因并给出最小可行的修改命令。",
  ].join("\n");
}

interface InitialDoctorState {
  topology: DoctorTopology;
  activePresetId: string;
  hardwareFamily: AscendFamily;
  decodeHardwareFamily: AscendFamily;
  version: Extract<RuleVersion, "v0.30.0" | "main">;
  commandText: string;
  prefillCommandText: string;
  decodeCommandText: string;
}

function resolveInitialState(effectiveMode: DoctorMode, initialPresetId?: string): InitialDoctorState {
  const fallbackMinimal = MINIMAL_DOCTOR_PRESETS[0]!;
  const fallbackFullSingle = FULL_SINGLE_DOCTOR_PRESETS[0]!;
  const fallbackPd = PD_DOCTOR_PRESETS[0]!;

  if (effectiveMode === "minimal") {
    const matched =
      (initialPresetId ? MINIMAL_DOCTOR_PRESETS.find((p) => p.id === initialPresetId) : undefined) ??
      fallbackMinimal;
    return {
      topology: "single",
      activePresetId: matched.id,
      hardwareFamily: matched.hardwareFamily,
      decodeHardwareFamily: matched.hardwareFamily,
      version: "v0.30.0",
      commandText: matched.command,
      prefillCommandText: fallbackPd.prefillCommand,
      decodeCommandText: fallbackPd.decodeCommand,
    };
  }

  const matchedPd = initialPresetId ? PD_DOCTOR_PRESETS.find((p) => p.id === initialPresetId) : undefined;
  if (matchedPd) {
    return {
      topology: "pd",
      activePresetId: matchedPd.id,
      hardwareFamily: matchedPd.hardwareFamily,
      decodeHardwareFamily: matchedPd.decodeHardwareFamily ?? matchedPd.hardwareFamily,
      version: matchedPd.version === "main" ? "main" : "v0.30.0",
      commandText: fallbackFullSingle.command,
      prefillCommandText: matchedPd.prefillCommand,
      decodeCommandText: matchedPd.decodeCommand,
    };
  }

  const matchedSingle =
    (initialPresetId
      ? (FULL_SINGLE_DOCTOR_PRESETS.find((p) => p.id === initialPresetId) ??
        MINIMAL_DOCTOR_PRESETS.find((p) => p.id === initialPresetId))
      : undefined) ?? fallbackFullSingle;

  return {
    topology: "single",
    activePresetId: matchedSingle.id,
    hardwareFamily: matchedSingle.hardwareFamily,
    decodeHardwareFamily: matchedSingle.hardwareFamily,
    version: matchedSingle.version === "main" ? "main" : "v0.30.0",
    commandText: matchedSingle.command,
    prefillCommandText: fallbackPd.prefillCommand,
    decodeCommandText: fallbackPd.decodeCommand,
  };
}

interface ResolvedDoctorState extends InitialDoctorState {
  fromVersion: LegacyUpgradeFromVersion | undefined;
  modelHint: ModelHintKey;
  crossNodeRoce: boolean;
  isSharedCommandFromUrl: boolean;
}

function resolveDoctorViewState(
  effectiveMode: DoctorMode,
  initialPresetId?: string,
  query?: DoctorQueryOverrides,
): ResolvedDoctorState {
  const base = resolveInitialState(effectiveMode, query?.presetId ?? initialPresetId);
  if (effectiveMode !== "full" || !query) {
    return {
      ...base,
      fromVersion: undefined,
      modelHint: "auto",
      crossNodeRoce: false,
      isSharedCommandFromUrl: false,
    };
  }
  if (query.sharedPrefillCommand !== undefined && query.sharedDecodeCommand !== undefined) {
    const hw = query.hardwareFamily ?? "A3";
    return {
      ...base,
      topology: "pd",
      activePresetId: "",
      hardwareFamily: hw,
      decodeHardwareFamily: query.decodeHardwareFamily ?? hw,
      version: query.version ?? "v0.30.0",
      fromVersion: query.fromVersion,
      prefillCommandText: query.sharedPrefillCommand,
      decodeCommandText: query.sharedDecodeCommand,
      modelHint: query.modelHint ?? "auto",
      crossNodeRoce: query.crossNodeRoce ?? false,
      isSharedCommandFromUrl: true,
    };
  }
  if (query.sharedCommand !== undefined) {
    const hw = query.hardwareFamily ?? "A2";
    return {
      ...base,
      topology: "single",
      activePresetId: "",
      hardwareFamily: hw,
      decodeHardwareFamily: hw,
      version: query.version ?? "v0.30.0",
      fromVersion: query.fromVersion,
      commandText: query.sharedCommand,
      modelHint: query.modelHint ?? "auto",
      crossNodeRoce: query.crossNodeRoce ?? false,
      isSharedCommandFromUrl: true,
    };
  }
  const nextTopology = query.topology ?? base.topology;
  const fallbackPd = PD_DOCTOR_PRESETS[0]!;
  if (nextTopology === "pd" && !query.presetId) {
    const hw = query.hardwareFamily ?? fallbackPd.hardwareFamily;
    return {
      ...base,
      topology: "pd",
      activePresetId: fallbackPd.id,
      hardwareFamily: hw,
      decodeHardwareFamily: query.decodeHardwareFamily ?? fallbackPd.decodeHardwareFamily ?? hw,
      version: query.version ?? (fallbackPd.version === "main" ? "main" : "v0.30.0"),
      fromVersion: query.fromVersion,
      prefillCommandText: fallbackPd.prefillCommand,
      decodeCommandText: fallbackPd.decodeCommand,
      modelHint: query.modelHint ?? "auto",
      crossNodeRoce: query.crossNodeRoce ?? false,
      isSharedCommandFromUrl: false,
    };
  }
  const hw = query.hardwareFamily ?? base.hardwareFamily;
  return {
    ...base,
    topology: nextTopology,
    hardwareFamily: hw,
    decodeHardwareFamily:
      query.decodeHardwareFamily ?? (nextTopology === "pd" ? base.decodeHardwareFamily : hw),
    version: query.version ?? base.version,
    fromVersion: query.fromVersion,
    modelHint: query.modelHint ?? "auto",
    crossNodeRoce: query.crossNodeRoce ?? false,
    isSharedCommandFromUrl: false,
  };
}

export interface ConfigDoctorViewProps {
  mode?: "minimal" | "full" | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  embedded?: boolean | undefined;
  initialPresetId?: string | undefined;
  isActive?: boolean | undefined;
  searchParams?: URLSearchParams | undefined;
  locationKey?: string | undefined;
  onUpdateSearchParams?: ((nextParams: URLSearchParams, opts?: { replace?: boolean }) => void) | undefined;
}

export function ConfigDoctorView({
  mode,
  title,
  summary,
  embedded = false,
  initialPresetId,
  isActive,
  searchParams,
  locationKey,
  onUpdateSearchParams,
}: ConfigDoctorViewProps) {
  const effectiveMode: DoctorMode = mode === "minimal" ? "minimal" : "full";
  const assistant = useOptionalWikiAssistant();
  const idPrefix = useId();
  const isDoctorRouteActive =
    effectiveMode === "full" &&
    !embedded &&
    (isActive !== undefined ? isActive : searchParams?.get("tab") === "doctor");

  const initialQuery = useMemo(
    () => (isDoctorRouteActive && searchParams ? parseDoctorQueryParams(searchParams) : undefined),
    [isDoctorRouteActive, searchParams],
  );
  const defaultState = useMemo(
    () => resolveInitialState(effectiveMode, initialPresetId),
    [effectiveMode, initialPresetId],
  );
  const initial = useMemo(
    () => resolveDoctorViewState(effectiveMode, initialPresetId, initialQuery),
    [effectiveMode, initialPresetId, initialQuery],
  );

  const [topology, setTopology] = useState<DoctorTopology>(initial.topology);
  const [activePresetId, setActivePresetId] = useState<string>(initial.activePresetId);
  const [hardwareFamily, setHardwareFamily] = useState<AscendFamily>(initial.hardwareFamily);
  const [decodeHardwareFamily, setDecodeHardwareFamily] = useState<AscendFamily>(
    initial.decodeHardwareFamily,
  );
  const [version, setVersion] = useState<Extract<RuleVersion, "v0.30.0" | "main">>(initial.version);
  const [fromVersion, setFromVersion] = useState<LegacyUpgradeFromVersion | undefined>(initial.fromVersion);
  const [crossNodeRoce, setCrossNodeRoce] = useState<boolean>(initial.crossNodeRoce);
  const [modelHint, setModelHint] = useState<ModelHintKey>(initial.modelHint);
  const [secondaryOptionsOpen, setSecondaryOptionsOpen] = useState<boolean>(() =>
    Boolean(initial.fromVersion || initial.crossNodeRoce || initial.modelHint !== "auto"),
  );
  const [commandText, setCommandText] = useState<string>(initial.commandText);
  const [prefillCommandText, setPrefillCommandText] = useState<string>(initial.prefillCommandText);
  const [decodeCommandText, setDecodeCommandText] = useState<string>(initial.decodeCommandText);
  const [isSharedCommandFromUrl, setIsSharedCommandFromUrl] = useState<boolean>(
    initial.isSharedCommandFromUrl,
  );
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [shareNotice, setShareNotice] = useState<{
    tone: "warn" | "redacted" | "ok";
    text: string;
  } | null>(null);
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("all");
  const [handoffSourceLabel, setHandoffSourceLabel] = useState<string | null>(null);
  const [modelHintFromHandoff, setModelHintFromHandoff] = useState<boolean>(false);
  const handoffCliModelRef = useRef<string | null>(
    initialQuery?.sharedModelId || initialQuery?.sharedTraitOverride
      ? extractNormalizedCliModel(initial.commandText)
      : null,
  );
  const [handoffModelCtx, setHandoffModelCtx] = useState<{
    modelId?: string | undefined;
    traitOverride?: DoctorModelTraitOverride | undefined;
    cliModel: string | null;
  } | null>(() =>
    initialQuery?.sharedModelId || initialQuery?.sharedTraitOverride
      ? {
          modelId: initialQuery.sharedModelId,
          traitOverride: initialQuery.sharedTraitOverride,
          cliModel: extractNormalizedCliModel(initial.commandText),
        }
      : null,
  );

  const wasActiveRef = useRef<boolean>(isDoctorRouteActive);
  const prevLocationKeyRef = useRef<string | undefined>(locationKey);
  const prevSerializedQueryRef = useRef<string>(searchParams?.toString() ?? "");
  const lastSelfSyncedQueryRef = useRef<string | null>(null);
  const skipNextUrlRestoreRef = useRef<boolean>(false);
  const lastConsumedHandoffSeqRef = useRef<number>(0);
  const strictModePendingHandoffRef = useRef<ReturnType<typeof workbenchHandoffStore.consumeDoctor>>(null);
  const strictModePending3dReturnRef = useRef<PendingDoctor3dReturn | null>(null);
  const handoffApplyingInCommitRef = useRef<boolean>(false);
  const restoringFromUrlInCommitRef = useRef<boolean>(false);
  handoffApplyingInCommitRef.current = false;
  restoringFromUrlInCommitRef.current = false;

  useEffect(() => {
    if (embedded || !isDoctorRouteActive || hasExplicitDoctorQueryParams(searchParams)) return;
    const fresh3d = pendingDoctor3dReturn;
    const ret3d = fresh3d ?? strictModePending3dReturnRef.current;
    if (!ret3d) return;
    if (fresh3d) {
      pendingDoctor3dReturn = null;
      strictModePending3dReturnRef.current = fresh3d;
    }
    handoffApplyingInCommitRef.current = true;
    skipNextUrlRestoreRef.current = true;
    setTopology("single");
    setHardwareFamily(ret3d.hardwareFamily);
    setVersion(ret3d.version);
    setCommandText(ret3d.commandText);
    const matched = matchExactDoctorPresetId({
      topology: "single",
      commandText: ret3d.commandText,
      prefillCommandText: "",
      decodeCommandText: "",
    });
    setActivePresetId(matched ?? "");
  }, [embedded, isDoctorRouteActive, searchParams]);

  useEffect(() => {
    if (embedded) return;
    const applyPending = (fromStrictRemount = false) => {
      const fresh = workbenchHandoffStore.consumeDoctor(lastConsumedHandoffSeqRef.current);
      const payload = fresh ?? (fromStrictRemount ? strictModePendingHandoffRef.current : null);
      if (!payload) return;
      if (fresh) {
        lastConsumedHandoffSeqRef.current = fresh.seq;
        strictModePendingHandoffRef.current = fresh;
      }
      handoffApplyingInCommitRef.current = true;
      skipNextUrlRestoreRef.current = true;
      const cliModel = extractNormalizedCliModel(payload.commandText);
      handoffCliModelRef.current = cliModel;
      setTopology("single");
      setActivePresetId("");
      setHardwareFamily(payload.hardwareFamily);
      setVersion(payload.version);
      setFromVersion(undefined);
      setCommandText(payload.commandText);
      setIsSharedCommandFromUrl(false);
      setShareNotice(null);
      setFindingFilter("all");
      setHandoffSourceLabel(payload.sourceLabel);
      const nextHint: ModelHintKey =
        payload.modelId === "qwen3-0.6b" ||
        payload.modelId === "qwen3-8b" ||
        payload.modelId === "qwen3-30b-a3b" ||
        payload.modelId === "qwen3-32b" ||
        payload.modelId === "qwen3-235b-a22b"
          ? payload.modelId
          : "auto";
      setModelHint(nextHint);
      setModelHintFromHandoff(nextHint !== "auto");
      if (nextHint !== "auto") setSecondaryOptionsOpen(true);
      setHandoffModelCtx(
        payload.modelId || payload.modelTraitOverride
          ? {
              modelId: payload.modelId,
              traitOverride: payload.modelTraitOverride,
              cliModel,
            }
          : null,
      );
    };
    applyPending(true);
    const unsub = workbenchHandoffStore.subscribe(() => applyPending(false));
    return () => {
      unsub();
    };
  }, [embedded]);

  // URL -> State restoration on deep link / Back / Forward (strictly gated by isDoctorRouteActive)
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isDoctorRouteActive;
    const isNewLocation = prevLocationKeyRef.current !== locationKey;
    prevLocationKeyRef.current = locationKey;
    const serialized = searchParams?.toString() ?? "";
    const prevSerialized = prevSerializedQueryRef.current;
    prevSerializedQueryRef.current = serialized;
    if (!isDoctorRouteActive || !searchParams) return;
    if (skipNextUrlRestoreRef.current) {
      skipNextUrlRestoreRef.current = false;
      return;
    }
    if (serialized === lastSelfSyncedQueryRef.current) {
      lastSelfSyncedQueryRef.current = null;
      return;
    }
    const hasExplicit = hasExplicitDoctorQueryParams(searchParams);
    if (!wasActive && !hasExplicit) {
      // Keep-alive tab reactivation via plain ?tab=doctor preserves in-memory draft
      return;
    }
    if (wasActive && !isNewLocation && (serialized === "" || serialized === prevSerialized)) return;
    restoringFromUrlInCommitRef.current = true;
    const parsed = parseDoctorQueryParams(searchParams);
    const next = resolveDoctorViewState(effectiveMode, initialPresetId, parsed);
    const restoredCliModel =
      parsed.sharedModelId || parsed.sharedTraitOverride ? extractNormalizedCliModel(next.commandText) : null;
    handoffCliModelRef.current = restoredCliModel;
    setHandoffModelCtx(
      parsed.sharedModelId || parsed.sharedTraitOverride
        ? {
            modelId: parsed.sharedModelId,
            traitOverride: parsed.sharedTraitOverride,
            cliModel: restoredCliModel,
          }
        : null,
    );
    setHandoffSourceLabel(null);
    setModelHintFromHandoff(false);
    setTopology(next.topology);
    setActivePresetId(next.activePresetId);
    setHardwareFamily(next.hardwareFamily);
    setDecodeHardwareFamily(next.decodeHardwareFamily);
    setVersion(next.version);
    setFromVersion(next.fromVersion);
    setCrossNodeRoce(next.crossNodeRoce);
    setModelHint(next.modelHint);
    if (next.fromVersion || next.crossNodeRoce || next.modelHint !== "auto") {
      setSecondaryOptionsOpen(true);
    }
    setCommandText(next.commandText);
    setPrefillCommandText(next.prefillCommandText);
    setDecodeCommandText(next.decodeCommandText);
    setIsSharedCommandFromUrl(next.isSharedCommandFromUrl);
    setShareNotice(null);
  }, [isDoctorRouteActive, searchParams, locationKey, effectiveMode, initialPresetId]);

  // Safe enum & preset-ID auto-sync (replace mode only; preserves already-redacted URL cmd when editing safe enums)
  useEffect(() => {
    if (!isDoctorRouteActive || !searchParams || !onUpdateSearchParams) return;
    if (handoffApplyingInCommitRef.current || restoringFromUrlInCommitRef.current) return;

    if (isSharedCommandFromUrl) {
      const nextParams = buildDoctorQueryParams(
        {
          topology,
          hardwareFamily,
          ...(topology === "pd" ? { decodeHardwareFamily } : {}),
          version,
          ...(fromVersion ? { fromVersion } : {}),
          modelHint,
          ...(crossNodeRoce ? { crossNodeRoce: true } : {}),
        },
        searchParams,
      );
      for (const sharedKey of ["cmd", "pcmd", "dcmd", "traits", "mid"] as const) {
        const existing = searchParams.get(sharedKey);
        if (existing !== null) {
          nextParams.set(sharedKey, existing);
        }
      }
      const nextStr = nextParams.toString();
      if (nextStr !== searchParams.toString()) {
        lastSelfSyncedQueryRef.current = nextStr;
        onUpdateSearchParams(nextParams, { replace: true });
      }
      return;
    }

    const matchedPresetId = matchExactDoctorPresetId({
      topology,
      commandText,
      prefillCommandText,
      decodeCommandText,
      preferredPresetId: activePresetId,
    });
    const hasSharedModelContext =
      topology === "single" &&
      modelHint === "auto" &&
      (searchParams.has("mid") || searchParams.has("traits"));
    const isAtDefault =
      !hasSharedModelContext &&
      topology === defaultState.topology &&
      matchedPresetId === defaultState.activePresetId &&
      hardwareFamily === defaultState.hardwareFamily &&
      version === defaultState.version &&
      fromVersion === undefined &&
      modelHint === "auto" &&
      !crossNodeRoce;

    if (isAtDefault && !hasExplicitDoctorQueryParams(searchParams)) return;

    const nextParams = isAtDefault
      ? buildDoctorQueryParams({}, searchParams)
      : buildDoctorQueryParams(
          {
            topology,
            presetId: matchedPresetId,
            hardwareFamily,
            ...(topology === "pd" ? { decodeHardwareFamily } : {}),
            version,
            ...(fromVersion ? { fromVersion } : {}),
            modelHint,
            ...(crossNodeRoce ? { crossNodeRoce: true } : {}),
          },
          searchParams,
        );
    if (topology === "single" && modelHint === "auto") {
      for (const ctxKey of ["mid", "traits"] as const) {
        const existing = searchParams.get(ctxKey);
        if (existing !== null) {
          nextParams.set(ctxKey, existing);
        }
      }
    }

    const nextStr = nextParams.toString();
    if (nextStr !== searchParams.toString()) {
      lastSelfSyncedQueryRef.current = nextStr;
      onUpdateSearchParams(nextParams, { replace: true });
    }
  }, [
    isDoctorRouteActive,
    searchParams,
    onUpdateSearchParams,
    isSharedCommandFromUrl,
    topology,
    activePresetId,
    hardwareFamily,
    decodeHardwareFamily,
    version,
    fromVersion,
    modelHint,
    crossNodeRoce,
    commandText,
    prefillCommandText,
    decodeCommandText,
    defaultState,
  ]);

  const effectiveTopology: DoctorTopology = effectiveMode === "minimal" ? "single" : topology;
  const effectiveVersion: RuleVersion = effectiveMode === "minimal" ? "v0.30.0" : version;
  const activeHandoffCtx = effectiveTopology === "single" ? handoffModelCtx : null;
  const activeModelId =
    effectiveMode === "full" ? (modelHint !== "auto" ? modelHint : activeHandoffCtx?.modelId) : undefined;
  const modelTraitOverride = useMemo(() => {
    if (effectiveMode !== "full") return undefined;
    if (modelHint !== "auto") {
      return resolveDoctorModelTraits(modelHint);
    }
    if (activeHandoffCtx) {
      return resolveDoctorModelTraits(activeHandoffCtx.modelId, activeHandoffCtx.traitOverride);
    }
    return undefined;
  }, [effectiveMode, modelHint, activeHandoffCtx]);

  const couplingTraitOverride = useMemo(
    () => toCouplingTraitOverride(modelTraitOverride),
    [modelTraitOverride],
  );

  const singleReport: SingleConfigDoctorReport | null = useMemo(() => {
    if (effectiveTopology !== "single") return null;
    return runSingleConfigDoctorWithLinks(commandText, {
      mode: effectiveMode,
      hardwareFamily,
      version: effectiveVersion,
      ...(effectiveMode === "full" ? { crossNodeRoce } : {}),
      ...(couplingTraitOverride ? { modelTraitOverride: couplingTraitOverride } : {}),
    });
  }, [
    effectiveTopology,
    commandText,
    effectiveMode,
    hardwareFamily,
    effectiveVersion,
    crossNodeRoce,
    couplingTraitOverride,
  ]);

  const pdReport: PdConfigDoctorReport | null = useMemo(() => {
    if (effectiveTopology !== "pd") return null;
    return runPdConfigDoctorWithLinks(prefillCommandText, decodeCommandText, {
      hardwareFamily,
      decodeHardwareFamily,
      version: effectiveVersion,
      crossNodeRoce,
      ...(couplingTraitOverride ? { modelTraitOverride: couplingTraitOverride } : {}),
    });
  }, [
    effectiveTopology,
    prefillCommandText,
    decodeCommandText,
    hardwareFamily,
    decodeHardwareFamily,
    effectiveVersion,
    crossNodeRoce,
    couplingTraitOverride,
  ]);

  const upgradeRadarReport: UpgradeRadarReport | null = useMemo(() => {
    if (effectiveMode !== "full" || !fromVersion) return null;
    const targetVer: UpgradeTargetVersion = version === "main" ? "main" : "v0.30.0";
    if (effectiveTopology === "pd") {
      return analyzePdUpgradeRadar(
        pdReport?.prefill.parsed ?? prefillCommandText,
        pdReport?.decode.parsed ?? decodeCommandText,
        { fromVersion, toVersion: targetVer },
      );
    }
    return analyzeSingleUpgradeRadar(singleReport?.parsed ?? commandText, {
      fromVersion,
      toVersion: targetVer,
    });
  }, [
    effectiveMode,
    fromVersion,
    version,
    effectiveTopology,
    pdReport,
    singleReport,
    prefillCommandText,
    decodeCommandText,
    commandText,
  ]);

  const allFindings =
    effectiveTopology === "pd" ? (pdReport?.allFindings ?? []) : (singleReport?.findings ?? []);
  const errors = effectiveTopology === "pd" ? (pdReport?.errors ?? []) : (singleReport?.errors ?? []);
  const silentRewrites =
    effectiveTopology === "pd" ? (pdReport?.silentRewrites ?? []) : (singleReport?.silentRewrites ?? []);
  const warnings = effectiveTopology === "pd" ? (pdReport?.warnings ?? []) : (singleReport?.warnings ?? []);
  const unknowns = effectiveTopology === "pd" ? (pdReport?.unknowns ?? []) : (singleReport?.unknowns ?? []);

  const doctorHardwareHref = useMemo(() => {
    if (effectiveTopology !== "single" || errors.length > 0) return null;
    const ver: Extract<RuleVersion, "v0.30.0" | "main"> = effectiveVersion === "main" ? "main" : "v0.30.0";
    const baseHref = buildHardwareDeployHrefFromCommand(commandText, {
      hardwareFamily,
      version: ver,
      ...(searchParams ? { preserveParams: searchParams } : {}),
    });
    if (!baseHref) return null;
    return `${baseHref}&fromTools=doctor`;
  }, [effectiveTopology, errors.length, effectiveVersion, commandText, hardwareFamily, searchParams]);

  const visibleFindings = useMemo(() => {
    if (findingFilter === "all") return allFindings;
    return allFindings.filter((f) => f.judgment === findingFilter);
  }, [allFindings, findingFilter]);

  const scopedRewrites: ScopedRewriteRow[] = useMemo(() => {
    if (effectiveTopology === "pd" && pdReport) {
      return [
        ...pdReport.prefill.effectiveRewrites.map((row) => ({ scopeLabel: "Prefill", row })),
        ...pdReport.decode.effectiveRewrites.map((row) => ({ scopeLabel: "Decode", row })),
      ];
    }
    return (singleReport?.effectiveRewrites ?? []).map((row) => ({ row }));
  }, [effectiveTopology, pdReport, singleReport]);

  const currentPresets: readonly (SingleDoctorPreset | PdDoctorPreset)[] =
    effectiveMode === "minimal"
      ? MINIMAL_DOCTOR_PRESETS
      : effectiveTopology === "pd"
        ? PD_DOCTOR_PRESETS
        : FULL_SINGLE_DOCTOR_PRESETS;

  const matchedPresetId = useMemo(
    () =>
      matchExactDoctorPresetId({
        topology: effectiveTopology,
        commandText,
        prefillCommandText,
        decodeCommandText,
        preferredPresetId: activePresetId,
      }),
    [effectiveTopology, commandText, prefillCommandText, decodeCommandText, activePresetId],
  );
  const activePreset = matchedPresetId ? currentPresets.find((p) => p.id === matchedPresetId) : undefined;
  const hasDoctorUrlShareParams = isDoctorRouteActive && hasExplicitDoctorQueryParams(searchParams);

  const clearInheritedHandoffTraits = () => {
    handoffCliModelRef.current = null;
    setHandoffModelCtx(null);
    setHandoffSourceLabel(null);
    if (modelHintFromHandoff) {
      setModelHint("auto");
      setModelHintFromHandoff(false);
    }
  };

  const handleSingleCommandChange = (nextCommand: string) => {
    setCommandText(nextCommand);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    const nextMatched = matchExactDoctorPresetId({
      topology: "single",
      commandText: nextCommand,
      prefillCommandText,
      decodeCommandText,
      preferredPresetId: activePresetId,
    });
    setActivePresetId(nextMatched ?? "");
    if (handoffModelCtx || modelHintFromHandoff || handoffSourceLabel) {
      const nextModel = extractNormalizedCliModel(nextCommand);
      const expectedModel = handoffModelCtx?.cliModel ?? handoffCliModelRef.current;
      if (nextModel !== expectedModel) {
        clearInheritedHandoffTraits();
      }
    }
  };

  const handlePrefillCommandChange = (nextCommand: string) => {
    setPrefillCommandText(nextCommand);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    const nextMatched = matchExactDoctorPresetId({
      topology: "pd",
      commandText,
      prefillCommandText: nextCommand,
      decodeCommandText,
      preferredPresetId: activePresetId,
    });
    setActivePresetId(nextMatched ?? "");
  };

  const handleDecodeCommandChange = (nextCommand: string) => {
    setDecodeCommandText(nextCommand);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    const nextMatched = matchExactDoctorPresetId({
      topology: "pd",
      commandText,
      prefillCommandText,
      decodeCommandText: nextCommand,
      preferredPresetId: activePresetId,
    });
    setActivePresetId(nextMatched ?? "");
  };

  const handleSelectSinglePreset = (preset: SingleDoctorPreset) => {
    handoffCliModelRef.current = null;
    setActivePresetId(preset.id);
    setHardwareFamily(preset.hardwareFamily);
    setCommandText(preset.command);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    setFindingFilter("all");
    setModelHint("auto");
    setModelHintFromHandoff(false);
    setHandoffModelCtx(null);
    setHandoffSourceLabel(null);
    if (effectiveMode === "full") {
      setVersion(preset.version === "main" ? "main" : "v0.30.0");
    }
  };

  const handleSelectPdPreset = (preset: PdDoctorPreset) => {
    handoffCliModelRef.current = null;
    setActivePresetId(preset.id);
    setHardwareFamily(preset.hardwareFamily);
    setDecodeHardwareFamily(preset.decodeHardwareFamily ?? preset.hardwareFamily);
    setVersion(preset.version === "main" ? "main" : "v0.30.0");
    setPrefillCommandText(preset.prefillCommand);
    setDecodeCommandText(preset.decodeCommand);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    setFindingFilter("all");
    setModelHint("auto");
    setModelHintFromHandoff(false);
    setHandoffModelCtx(null);
    setHandoffSourceLabel(null);
  };

  const handleSwitchTopology = (next: DoctorTopology) => {
    if (next === topology) return;
    handoffCliModelRef.current = null;
    setTopology(next);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    setFindingFilter("all");
    setModelHint("auto");
    setModelHintFromHandoff(false);
    setHandoffModelCtx(null);
    setHandoffSourceLabel(null);
    if (next === "pd") {
      const matched = PD_DOCTOR_PRESETS.find((p) => p.id === activePresetId);
      if (!matched && PD_DOCTOR_PRESETS[0]) {
        setActivePresetId(PD_DOCTOR_PRESETS[0].id);
      }
    } else {
      const matched = FULL_SINGLE_DOCTOR_PRESETS.find((p) => p.id === activePresetId);
      if (!matched && FULL_SINGLE_DOCTOR_PRESETS[0]) {
        setActivePresetId(FULL_SINGLE_DOCTOR_PRESETS[0].id);
      }
    }
  };

  const handleCopyShareLink = () => {
    const baseToolsUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#/tools`
        : "http://localhost/#/tools";
    const res = buildDoctorShareLink(
      {
        topology: effectiveTopology,
        hardwareFamily,
        decodeHardwareFamily,
        version,
        ...(fromVersion ? { fromVersion } : {}),
        modelHint,
        crossNodeRoce,
        preferredPresetId: matchedPresetId,
        ...(activeHandoffCtx?.modelId ? { sharedModelId: activeHandoffCtx.modelId } : {}),
        ...(activeHandoffCtx?.traitOverride ? { sharedTraitOverride: activeHandoffCtx.traitOverride } : {}),
        commandText,
        prefillCommandText,
        decodeCommandText,
      },
      searchParams,
      baseToolsUrl,
    );
    if (!res.ok) {
      setShareNotice({ tone: "warn", text: res.reason });
      return;
    }
    void copyTextToClipboard(res.url).then((copied) => {
      if (!copied) {
        setLinkCopied(false);
        setShareNotice({ tone: "warn", text: `剪贴板不可用，请手动复制分享链接：${res.url}` });
        return;
      }
      if (res.redactionCount > 0) {
        setShareNotice({
          tone: "redacted",
          text: `已自动脱敏 ${res.redactionCount} 处敏感凭据/IP 后复制分享链接`,
        });
      } else {
        setShareNotice(null);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  };

  const handleClearShareParams = () => {
    handoffCliModelRef.current = null;
    setHandoffModelCtx(null);
    setHandoffSourceLabel(null);
    setModelHintFromHandoff(false);
    setTopology(defaultState.topology);
    setActivePresetId(defaultState.activePresetId);
    setHardwareFamily(defaultState.hardwareFamily);
    setDecodeHardwareFamily(defaultState.decodeHardwareFamily);
    setVersion(defaultState.version);
    setFromVersion(undefined);
    setCrossNodeRoce(false);
    setModelHint("auto");
    setSecondaryOptionsOpen(false);
    setCommandText(defaultState.commandText);
    setPrefillCommandText(defaultState.prefillCommandText);
    setDecodeCommandText(defaultState.decodeCommandText);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    if (isDoctorRouteActive && searchParams && onUpdateSearchParams) {
      const cleanParams = buildDoctorQueryParams({}, searchParams);
      lastSelfSyncedQueryRef.current = cleanParams.toString();
      onUpdateSearchParams(cleanParams, { replace: false });
    }
  };

  const handleLoadUpgradeSample = () => {
    clearInheritedHandoffTraits();
    setTopology("single");
    setActivePresetId("");
    setHardwareFamily("A2");
    if (!fromVersion) setFromVersion("v0.23.0");
    setSecondaryOptionsOpen(true);
    setCommandText(LEGACY_V023_MIGRATION_SAMPLE_CMD);
    setIsSharedCommandFromUrl(false);
    setShareNotice(null);
    setFindingFilter("all");
  };

  const handleAskAssistant = (event: MouseEvent<HTMLButtonElement>) => {
    if (!assistant) return;
    const rawPrompt = buildAssistantPrompt({
      mode: effectiveMode,
      topology: effectiveTopology,
      hardwareFamily,
      decodeHardwareFamily,
      version: effectiveVersion,
      commandText,
      prefillCommandText,
      decodeCommandText,
      findings: allFindings,
    });
    const { sanitized, redactionCount } = sanitizeDiagnosticText(rawPrompt);
    const mooncakeHint = sanitized.includes("MooncakeConnectorV1") ? "（含 MooncakeConnectorV1）" : "";
    const suggestedQuestion = `请结合 vllm-ascend ${effectiveVersion} 源码深究这套 vllm serve${mooncakeHint} 配置体检结果，并给出最小可行修改命令。`;
    const analysis = buildDoctorChatAnalysis({
      command: effectiveTopology === "pd" ? prefillCommandText : commandText,
      ...(effectiveTopology === "pd" ? { decodeCommand: decodeCommandText, decodeHardwareFamily } : {}),
      mode: effectiveMode,
      hardwareFamily,
      version: effectiveVersion,
      ...(effectiveMode === "full" ? { crossNodeRoce } : {}),
      ...(activeModelId ? { modelId: activeModelId } : {}),
      ...(modelTraitOverride ? { modelTraitOverride } : {}),
    });
    assistant.openChat({
      pendingAttachment: {
        title: `vllm serve 配置体检脱敏快照（${effectiveTopology === "pd" ? "P/D 双实例" : hardwareFamily}）`,
        summary: `共 ${errors.length} 项硬报错 · ${silentRewrites.length} 项静默改写 · ${warnings.length} 项告警`,
        sanitizedBlock: sanitized,
        redactionCount,
        suggestedQuestion,
        ...(analysis ? { analysis } : {}),
      },
      submit: false,
      trigger: event.currentTarget,
    });
  };

  const displayTitle =
    title ?? (effectiveMode === "minimal" ? "vllm serve 最小起服务体检" : "vllm serve 配置体检器");

  return (
    <div
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="config-doctor-view"
      data-mode={effectiveMode}
      data-topology={effectiveTopology}
    >
      {embedded ? (
        <>
          <header className="wiki-tool-head">
            <div className="wt-embedded-title-group">
              <strong className="wiki-tool-title">{displayTitle}</strong>
              <span className="wiki-tool-badge">
                {mode === "minimal" ? "最小起服务" : mode === "full" ? "完整体检" : "配置体检器"}
              </span>
            </div>
            <a className="wt-open-workbench" href="#/tools?tab=doctor">
              打开完整体检工作台 →
            </a>
          </header>
          {summary && <p className="wiki-tool-summary">{summary}</p>}
        </>
      ) : (
        <header className="wt-header">
          <div className="wt-header-main">
            <div className="wt-title-row">
              <h2 className="wt-title">{displayTitle}</h2>
              <span className="wt-baseline-pill">
                基线: {effectiveVersion === "main" ? "main (8d6180e2)" : "v0.30.0 (c09d3e20)"}
              </span>
              {effectiveMode === "full" && (
                <button
                  type="button"
                  className="wt-preset-btn"
                  style={{ padding: "2px 10px", fontSize: 12.5 }}
                  data-testid="doctor-copy-share-link"
                  onClick={handleCopyShareLink}
                >
                  {linkCopied ? "已复制体检分享链接" : "复制体检分享链接"}
                </button>
              )}
              {hasDoctorUrlShareParams && !isSharedCommandFromUrl && (
                <button
                  type="button"
                  className="wt-preset-btn"
                  style={{ padding: "2px 10px", fontSize: 12.5 }}
                  data-testid="doctor-clear-share-params"
                  onClick={handleClearShareParams}
                >
                  清除分享参数
                </button>
              )}
            </div>
            {shareNotice && (
              <p
                className="wt-subtitle"
                data-testid="doctor-share-notice"
                role="status"
                style={{
                  color:
                    shareNotice.tone === "warn"
                      ? "var(--color-danger)"
                      : shareNotice.tone === "redacted"
                        ? "var(--color-warning)"
                        : "var(--color-token)",
                  fontSize: 13,
                }}
              >
                {shareNotice.text}
              </p>
            )}
            {summary && <p className="wt-subtitle">{summary}</p>}
          </div>
          {assistant && (
            <div className="wt-header-actions">
              <button
                type="button"
                className="wt-assistant-btn"
                data-testid="doctor-ask-assistant"
                onClick={handleAskAssistant}
              >
                送入问答助手深究
              </button>
            </div>
          )}
        </header>
      )}

      {isSharedCommandFromUrl && (
        <div className="wt-handoff-banner" data-testid="doctor-share-banner" role="status">
          <span>当前正在检视分享链接带入的启动命令（凭据与 IP 在生成分享链接时已执行脱敏）。</span>
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="doctor-clear-share-params"
            onClick={handleClearShareParams}
          >
            清除分享参数
          </button>
        </div>
      )}

      {handoffSourceLabel && (
        <div className="wt-handoff-banner" data-testid="doctor-handoff-banner" role="status">
          <span>
            {handoffSourceLabel.startsWith("知识页") ? (
              <>
                已从「<strong>{handoffSourceLabel}</strong>」带入启动命令与环境变量，正在按源码规则体检。
              </>
            ) : (
              <>
                已从部署算账台（<strong>{handoffSourceLabel}</strong>）
                {activeHandoffCtx || modelHintFromHandoff
                  ? "带入启动命令、芯片族与模型结构参数，正在按源码规则体检。"
                  : "带入启动命令与芯片族（已手动覆盖模型结构），正在按源码规则体检。"}
              </>
            )}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(activeHandoffCtx || modelHintFromHandoff) && (
              <button
                type="button"
                className="wt-preset-btn"
                data-testid="doctor-clear-handoff-traits"
                onClick={clearInheritedHandoffTraits}
              >
                清除继承的模型结构
              </button>
            )}
            <button
              type="button"
              className="wt-preset-btn"
              onClick={() => {
                handoffCliModelRef.current = null;
                setHandoffSourceLabel(null);
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {effectiveMode === "full" && (
        <div className="wt-toolbar-row">
          <div className="wt-segmented" role="tablist" aria-label="部署拓扑模式">
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTopology === "single"}
              className={`wt-seg-btn ${effectiveTopology === "single" ? "is-active" : ""}`}
              data-testid="doctor-topology-single"
              onClick={() => handleSwitchTopology("single")}
            >
              单实例体检
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTopology === "pd"}
              className={`wt-seg-btn ${effectiveTopology === "pd" ? "is-active" : ""}`}
              data-testid="doctor-topology-pd"
              onClick={() => handleSwitchTopology("pd")}
            >
              P/D 分离双实例联检
            </button>
          </div>
        </div>
      )}

      <div className="wt-presets">
        <span className="wt-presets-label">示例命令（点击切换体验）：</span>
        {currentPresets.map((preset) => {
          const isPresetActive = preset.id === matchedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              className={`wt-preset-btn ${isPresetActive ? "is-active" : ""}`}
              data-testid={`doctor-preset-${preset.id}`}
              onClick={() =>
                preset.kind === "pd" ? handleSelectPdPreset(preset) : handleSelectSinglePreset(preset)
              }
            >
              <span
                className={`wt-preset-dot ${preset.health === "healthy" ? "is-healthy" : "is-pitfall"}`}
              />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>

      {activePreset && <p className="wt-preset-summary">{activePreset.summary}</p>}

      <div className="wt-controls-bar">
        <label className="wt-field" htmlFor={`${idPrefix}-hw`}>
          <span className="wt-field-label">
            {effectiveTopology === "pd" ? "Prefill 硬件族" : "昇腾硬件族"}
          </span>
          <select
            id={`${idPrefix}-hw`}
            className="wt-select"
            data-testid="doctor-hardware-select"
            value={hardwareFamily}
            onChange={(e) => {
              setHardwareFamily(e.target.value as AscendFamily);
              setShareNotice(null);
            }}
          >
            {HARDWARE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {effectiveMode === "minimal" ? (
          <div className="wt-field">
            <span className="wt-field-label">核验基线</span>
            <span className="wt-baseline-pill" data-testid="doctor-minimal-baseline">
              基线: v0.30.0 (c09d3e20)
            </span>
          </div>
        ) : (
          <>
            {effectiveTopology === "pd" && (
              <label className="wt-field" htmlFor={`${idPrefix}-decode-hw`}>
                <span className="wt-field-label">Decode 硬件族</span>
                <select
                  id={`${idPrefix}-decode-hw`}
                  className="wt-select"
                  data-testid="doctor-decode-hardware-select"
                  value={decodeHardwareFamily}
                  onChange={(e) => {
                    setDecodeHardwareFamily(e.target.value as AscendFamily);
                    setShareNotice(null);
                  }}
                >
                  {HARDWARE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="wt-field" htmlFor={`${idPrefix}-ver`}>
              <span className="wt-field-label">规则版本基线</span>
              <select
                id={`${idPrefix}-ver`}
                className="wt-select"
                data-testid="doctor-version-select"
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value as Extract<RuleVersion, "v0.30.0" | "main">);
                  setShareNotice(null);
                }}
              >
                {VERSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {effectiveMode === "full" && (
        <details
          className="wt-advanced-details"
          data-testid="doctor-secondary-options"
          open={secondaryOptionsOpen}
          onToggle={(e) => setSecondaryOptionsOpen(e.currentTarget.open)}
        >
          <summary className="wt-advanced-summary" data-testid="doctor-secondary-summary">
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px" }}>
              <span className="wt-advanced-summary-title">
                进阶场景选项（从旧版升级 / 跨机 RoCE / 模型结构覆盖）
              </span>
              <span className="wt-advanced-summary-meta">
                从旧版升级={fromVersion ?? "关"} · 跨机 RoCE={crossNodeRoce ? "开" : "关"} · 模型结构=
                {modelHint === "auto" ? (activeHandoffCtx ? "已继承算账台" : "自动识别") : modelHint}
              </span>
            </span>
            <span className="wt-advanced-summary-cta">{secondaryOptionsOpen ? "收起选项" : "展开设置"}</span>
          </summary>
          <div className="wt-advanced-body">
            <div className="wt-advanced-row">
              <label className="wt-field" htmlFor={`${idPrefix}-from-ver`}>
                <span className="wt-field-label">从旧版升级对比基线</span>
                <select
                  id={`${idPrefix}-from-ver`}
                  className="wt-select"
                  data-testid="doctor-upgrade-from-select"
                  value={fromVersion ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromVersion(val === "v0.23.0" || val === "v0.26.0rc" ? val : undefined);
                    setShareNotice(null);
                  }}
                >
                  {UPGRADE_FROM_OPTIONS.map((opt) => (
                    <option key={opt.value || "off"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wt-field" htmlFor={`${idPrefix}-model-hint`}>
                <span className="wt-field-label">
                  模型结构覆盖
                  {activeHandoffCtx && modelHint === "auto" ? "（已继承算账台）" : ""}
                </span>
                <select
                  id={`${idPrefix}-model-hint`}
                  className="wt-select"
                  data-testid="doctor-model-hint-select"
                  value={modelHint}
                  onChange={(e) => {
                    setModelHint(e.target.value as ModelHintKey);
                    setModelHintFromHandoff(false);
                    setHandoffModelCtx(null);
                    setShareNotice(null);
                  }}
                >
                  {MODEL_HINT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wt-checkbox-label" htmlFor={`${idPrefix}-roce`}>
                <input
                  id={`${idPrefix}-roce`}
                  type="checkbox"
                  data-testid="doctor-roce-checkbox"
                  checked={crossNodeRoce}
                  onChange={(e) => {
                    setCrossNodeRoce(e.target.checked);
                    setShareNotice(null);
                  }}
                />
                <span>跨机 RoCE 网络</span>
              </label>
            </div>
          </div>
        </details>
      )}

      {effectiveTopology === "pd" ? (
        <div className="wt-editor-grid wt-editor-grid-pd">
          <div className="wt-editor-card">
            <div className="wt-editor-head">
              <label className="wt-editor-title" htmlFor={`${idPrefix}-prefill-cmd`}>
                Prefill 实例命令
              </label>
              <span className="wt-editor-role is-prefill">kv_producer</span>
            </div>
            <textarea
              id={`${idPrefix}-prefill-cmd`}
              className="wt-textarea"
              data-testid="doctor-prefill-input"
              spellCheck={false}
              value={prefillCommandText}
              onChange={(e) => handlePrefillCommandChange(e.target.value)}
            />
          </div>
          <div className="wt-editor-card">
            <div className="wt-editor-head">
              <label className="wt-editor-title" htmlFor={`${idPrefix}-decode-cmd`}>
                Decode 实例命令
              </label>
              <span className="wt-editor-role is-decode">kv_consumer</span>
            </div>
            <textarea
              id={`${idPrefix}-decode-cmd`}
              className="wt-textarea"
              data-testid="doctor-decode-input"
              spellCheck={false}
              value={decodeCommandText}
              onChange={(e) => handleDecodeCommandChange(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="wt-editor-grid">
          <div className="wt-editor-card">
            <div className="wt-editor-head">
              <label className="wt-editor-title" htmlFor={`${idPrefix}-single-cmd`}>
                粘贴你的 vllm serve 启动命令与环境变量
              </label>
              <span className="wt-editor-role">
                {modelTraitOverride?.numKvHeads !== undefined && activeHandoffCtx && modelHint === "auto"
                  ? `继承结构：Q=${modelTraitOverride.numAttentionHeads ?? "?"} / KV=${modelTraitOverride.numKvHeads}${modelTraitOverride.useMla ? " · MLA" : modelTraitOverride.isMoe ? " · MoE" : ""}`
                  : singleReport?.parsed.inferredHints.matchedPresetName
                    ? `识别模型：${singleReport.parsed.inferredHints.matchedPresetName}`
                    : "实时解析"}
              </span>
            </div>
            <textarea
              id={`${idPrefix}-single-cmd`}
              className={`wt-textarea ${effectiveMode === "minimal" ? "wt-textarea-compact" : ""}`}
              data-testid="doctor-cmd-input"
              spellCheck={false}
              value={commandText}
              onChange={(e) => handleSingleCommandChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div
        className={`wt-summary-bar ${errors.length === 0 ? "is-pass" : "is-blocked"}`}
        data-testid="doctor-summary-bar"
      >
        <div className="wt-summary-left">
          {errors.length === 0 ? (
            <span className="wt-pass-banner" data-testid="doctor-pass-banner">
              ✓ 当前规则未发现冲突阻断
            </span>
          ) : (
            <span className="wt-blocked-banner" data-testid="doctor-blocked-banner">
              ✕ 检出 {errors.length} 项硬阻断
            </span>
          )}
          <span className="wt-stat-pill is-error">硬阻断 {errors.length}</span>
          <span className="wt-stat-pill is-rewrite">静默改写 {silentRewrites.length}</span>
          <span className="wt-stat-pill is-warn">风险提示 {warnings.length}</span>
          <span className="wt-stat-pill is-unknown">待核变量 [I] {unknowns.length}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {doctorHardwareHref && (
            <a
              className="wt-assistant-btn"
              data-testid="doctor-open-3d-sharding"
              href={doctorHardwareHref}
              onClick={() => {
                if (!embedded) {
                  pendingDoctor3dReturnSeq += 1;
                  pendingDoctor3dReturn = {
                    seq: pendingDoctor3dReturnSeq,
                    commandText,
                    hardwareFamily,
                    version: effectiveVersion === "main" ? "main" : "v0.30.0",
                  };
                }
              }}
            >
              在 3D 整机看权重切分 →
            </a>
          )}
          {embedded && assistant && (
            <button
              type="button"
              className="wt-assistant-btn"
              data-testid="doctor-ask-assistant"
              onClick={handleAskAssistant}
            >
              送入问答助手深究
            </button>
          )}
        </div>
      </div>

      {effectiveMode === "minimal" &&
        singleReport?.deferredAdvancedPrompt &&
        singleReport.deferredAdvancedFeatures.length > 0 && (
          <div className="wt-notice-deferred" data-testid="doctor-deferred-notice" role="note">
            <div className="wt-notice-deferred-head">
              <span className="wt-notice-deferred-title">{singleReport.deferredAdvancedPrompt}</span>
              <a className="wt-open-workbench" href="#/tools?tab=doctor">
                前往完整配置体检台展开 P/D 分离与图融合联检 →
              </a>
            </div>
            <div className="wt-deferred-tags">
              {singleReport.deferredAdvancedFeatures.map((feat) => (
                <span key={feat} className="wt-deferred-tag">
                  {feat}
                </span>
              ))}
            </div>
          </div>
        )}

      {effectiveMode === "full" && upgradeRadarReport && (
        <UpgradeRadarPanel
          report={upgradeRadarReport}
          showScope={effectiveTopology === "pd"}
          onLoadSample={handleLoadUpgradeSample}
          onApplyRecommendedSingle={(cmd) => handleSingleCommandChange(cmd)}
          onApplyRecommendedPd={(pre, dec) => {
            handlePrefillCommandChange(pre);
            handleDecodeCommandChange(dec);
          }}
        />
      )}

      <section className="wt-section" data-testid="doctor-findings-section">
        <div className="wt-section-head">
          <h3 className="wt-section-title">诊断详情与修改建议（{allFindings.length}）</h3>
          {effectiveMode === "full" && (
            <div className="wt-filter-row">
              {(
                [
                  { id: "all", label: `全部 (${allFindings.length})` },
                  { id: "error", label: `硬报错 (${errors.length})` },
                  { id: "silent-rewrite", label: `静默改写 (${silentRewrites.length})` },
                  { id: "warn", label: `告警 (${warnings.length})` },
                  { id: "unknown", label: `待核 [I] (${unknowns.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`wt-filter-btn ${findingFilter === tab.id ? "is-active" : ""}`}
                  data-testid={`doctor-filter-${tab.id}`}
                  onClick={() => setFindingFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleFindings.length === 0 ? (
          <div className="wt-empty-state">
            {allFindings.length === 0
              ? "当前配置未命中任何硬报错、静默改写或告警规则（仍建议上线前实机核对显存与依赖版本）。"
              : "当前筛选条件下暂无诊断条目，可切换「全部」查看。"}
          </div>
        ) : (
          <div className="wt-findings-list">
            {visibleFindings.map((finding) => (
              <FindingCard
                key={`${finding.scope}-${finding.id}-${finding.title}-${finding.message.slice(0, 24)}`}
                finding={finding}
                showScope={effectiveTopology === "pd"}
              />
            ))}
          </div>
        )}
      </section>

      {effectiveMode === "full" && (
        <>
          <EffectiveRewritesTable rows={scopedRewrites} />
          <section className="wt-section" data-testid="doctor-insights-section">
            <div className="wt-section-head">
              <h3 className="wt-section-title">生效配置拆解</h3>
              <span className="wt-section-meta">
                批处理预算 · MoE 通信策略 · HCCL 常驻显存 · 环境变量核验
              </span>
            </div>
            {effectiveTopology === "pd" && pdReport ? (
              <>
                <InstanceInsightsCards report={pdReport.prefill} scopeTitle="Prefill" />
                <InstanceInsightsCards report={pdReport.decode} scopeTitle="Decode" />
              </>
            ) : (
              singleReport && <InstanceInsightsCards report={singleReport} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function WikiConfigDoctorBlock({ spec }: { spec: WikiToolSpec }) {
  return (
    <ConfigDoctorView
      mode={spec.mode === "minimal" ? "minimal" : "full"}
      title={spec.title}
      summary={spec.summary}
      initialPresetId={spec.preset}
      embedded
    />
  );
}
