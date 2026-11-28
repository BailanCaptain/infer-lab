import "../../design/tools.css";
import "./AscendKnobRadarView.css";
import { type MouseEvent, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { sourceUrl } from "../../content/wiki/index";
import { parseRepoRef } from "../../content/wiki/schema";
import { resolveToolDeepLink } from "../../content/wiki/toolDeeplinks";
import type { WikiToolSpec } from "../../content/wiki/toolFence";
import {
  type ActiveKnobEntry,
  ASCEND_KNOB_CATALOG,
  type AscendKnobSpec,
  applyKnobFixAction,
  createRawJsonLiteral,
  DEFAULT_SANDBOX_CONTEXT,
  evaluateKnobRecipe,
  getKnobById,
  KNOB_GOAL_LABELS,
  KNOB_RECIPE_PRESETS,
  type KnobConflictFinding,
  type KnobEntryKind,
  type KnobEvaluationResult,
  type KnobFindingSeverity,
  type KnobFixAction,
  type KnobLifecycleStatus,
  type KnobRecipePreset,
  type KnobSandboxContext,
  type KnobSelectionMap,
  type KnobTuningGoal,
  type KnobVersionTarget,
  parseLosslessJson,
  resolveKnobLifecycle,
  stringifyLosslessJson,
  URL_SEL_CORRUPT_SENTINEL_PREFIX,
  URL_SEL_PARSE_ERROR_KEY,
} from "../../sim/knobs";
import { useOptionalWikiAssistant } from "../wiki/assistant-context";
import { DiagramPageContext } from "../wiki/page-context";
import { ToolDeepLinkChip } from "./ToolDeepLinkChip";
import { copyTextToClipboard, preserveWikiBackParams, sanitizeDiagnosticText } from "./workbenchHandoff";

export interface AscendKnobRadarViewProps {
  mode?: "minimal" | "full" | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  initialPresetId?: string | undefined;
  embedded?: boolean | undefined;
  isActive?: boolean | undefined;
  searchParams?: URLSearchParams | undefined;
  locationKey?: string | undefined;
  onUpdateSearchParams?: ((nextParams: URLSearchParams, opts?: { replace?: boolean }) => void) | undefined;
}

type GoalFilter = "all" | KnobTuningGoal;
type EntryKindFilter = "all" | KnobEntryKind;

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;
const MINIMAL_COLLAPSED_LIMIT = 8;

const VERSION_OPTIONS: ReadonlyArray<{ value: KnobVersionTarget; label: string }> = [
  { value: "v0.30.0", label: "v0.30.0 (c09d3e20)" },
  { value: "main", label: "main (8d6180e2)" },
];

const SOC_OPTIONS: ReadonlyArray<{ value: KnobSandboxContext["soc"]; label: string }> = [
  { value: "A2", label: "Atlas A2 (910B)" },
  { value: "A3", label: "Atlas A3 (双裸片)" },
  { value: "310P", label: "Atlas 300I DUO (310P)" },
  { value: "A5", label: "Ascend 950 (A5)" },
];

const MODEL_KIND_OPTIONS: ReadonlyArray<{ value: KnobSandboxContext["modelKind"]; label: string }> = [
  { value: "dense", label: "Dense (Qwen3-8B)" },
  { value: "moe", label: "MoE (Qwen3-235B-A22B)" },
  { value: "mla_moe", label: "MLA+MoE (DeepSeek-V3)" },
  { value: "engram_moe", label: "Engram+MoE (DeepSeek-V4.1)" },
];

const GRAPH_MODE_OPTIONS: ReadonlyArray<{ value: KnobSandboxContext["graphMode"]; label: string }> = [
  { value: "FULL_AND_PIECEWISE", label: "FULL_AND_PIECEWISE" },
  { value: "FULL_DECODE_ONLY", label: "FULL_DECODE_ONLY" },
  { value: "PIECEWISE", label: "PIECEWISE" },
  { value: "NONE", label: "NONE (--enforce-eager)" },
];

const TP_OPTIONS: readonly KnobSandboxContext["tpSize"][] = [1, 2, 4, 8, 16];
const DP_OPTIONS: readonly KnobSandboxContext["dpSize"][] = [1, 2, 4, 8];
const PP_OPTIONS: readonly NonNullable<KnobSandboxContext["ppSize"]>[] = [1, 2, 4];
const CATALOG_ID_SET: ReadonlySet<string> = new Set(ASCEND_KNOB_CATALOG.map((spec) => spec.id));

const PD_ROLE_OPTIONS: ReadonlyArray<{ value: KnobSandboxContext["pdRole"]; label: string }> = [
  { value: "none", label: "混部单实例 (none)" },
  { value: "prefill", label: "PD 分离 · Prefill" },
  { value: "decode", label: "PD 分离 · Decode" },
];

const GOAL_KEYS: readonly KnobTuningGoal[] = ["ttft", "tpot", "memory", "comm", "graph", "pitfall"];

const ENTRY_KIND_OPTIONS: ReadonlyArray<{ value: EntryKindFilter; label: string }> = [
  { value: "all", label: "全部入口" },
  { value: "env", label: "环境变量" },
  { value: "additional_config", label: "additional_config" },
  { value: "cli_core", label: "核心 CLI" },
];

const ENTRY_BADGE_META: Readonly<Record<KnobEntryKind, { label: string; cls: string }>> = {
  env: { label: "ENV", cls: "is-entry-env" },
  additional_config: { label: "JSON", cls: "is-entry-json" },
  cli_core: { label: "CLI", cls: "is-entry-cli" },
};

const LIFECYCLE_BADGE_META: Readonly<Record<KnobLifecycleStatus, { label: string; cls: string }>> = {
  active: { label: "v0.30.0+main", cls: "is-life-active" },
  "main-only": { label: "仅 main", cls: "is-life-main" },
  "v030-only": { label: "仅 v0.30.0", cls: "is-life-v030" },
  "retired-trap": { label: "⚠ 已废弃陷阱", cls: "is-life-trap" },
};

const SEVERITY_META: Readonly<
  Record<KnobFindingSeverity, { badge: string; cardCls: string; badgeCls: string }>
> = {
  blocker: {
    badge: "🔴 启动阻断",
    cardCls: "is-blocker",
    badgeCls: "is-error",
  },
  "silent-reset": {
    badge: "🟠 静默重置/失效",
    cardCls: "is-silent-reset",
    badgeCls: "is-silent-rewrite",
  },
  "perf-trap": {
    badge: "🟡 性能反噬陷阱",
    cardCls: "is-perf-trap",
    badgeCls: "is-warn",
  },
  synergy: {
    badge: "🟢 协同增益",
    cardCls: "is-synergy",
    badgeCls: "is-life-active",
  },
};

function formatKnobValue(val: string | number | boolean): string {
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

function resolveEmbeddedFromPage(pageCtxSlug: string, assistantCurrentId: string | undefined): string {
  if (pageCtxSlug && SAFE_SLUG_RE.test(pageCtxSlug.trim())) return pageCtxSlug.trim();
  if (assistantCurrentId && SAFE_SLUG_RE.test(assistantCurrentId.trim())) return assistantCurrentId.trim();
  if (typeof window !== "undefined") {
    const m = /^#\/wiki\/([a-z0-9][a-z0-9-_]{0,127})/i.exec(window.location.hash ?? "");
    if (m?.[1]) return m[1];
  }
  return "";
}

export function matchesKnobFilter(
  spec: AscendKnobSpec,
  goalFilter: GoalFilter,
  kindFilter: EntryKindFilter,
  rawQuery: string,
): boolean {
  if (goalFilter !== "all" && !spec.goals.includes(goalFilter)) return false;
  if (kindFilter !== "all" && spec.entryKind !== kindFilter) return false;
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const goalText = spec.goals.map((g) => KNOB_GOAL_LABELS[g]).join(" ");
  const haystack = [
    spec.name,
    spec.id,
    spec.jsonPath ?? "",
    spec.cliFlag ?? "",
    spec.summaryZh,
    spec.mechanismZh,
    spec.tradeoffZh,
    spec.replacementHintZh ?? "",
    goalText,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchExactKnobPresetId(
  context: KnobSandboxContext,
  selections: KnobSelectionMap,
  preferredId?: string,
): string | undefined {
  const matches = (p: KnobRecipePreset): boolean => {
    const ctxKeys = Object.keys(p.context) as Array<keyof KnobSandboxContext>;
    for (const k of ctxKeys) {
      if (k === "ppSize") {
        if ((p.context.ppSize ?? 1) !== (context.ppSize ?? 1)) return false;
      } else if (p.context[k] !== context[k]) {
        return false;
      }
    }
    if ((p.context.ppSize ?? 1) !== (context.ppSize ?? 1)) return false;
    const pSelKeys = Object.keys(p.selections);
    const curSelKeys = Object.keys(selections);
    if (pSelKeys.length !== curSelKeys.length) return false;
    for (const k of pSelKeys) {
      if (!Object.hasOwn(selections, k) || selections[k] !== p.selections[k]) return false;
    }
    return true;
  };
  if (preferredId) {
    const pref = KNOB_RECIPE_PRESETS.find((p) => p.id === preferredId);
    if (pref && matches(pref)) return pref.id;
  }
  return KNOB_RECIPE_PRESETS.find(matches)?.id;
}

function KnobWikiDeepLink({
  pageId,
  anchor,
  label,
}: {
  pageId: string;
  anchor?: string | undefined;
  label?: string | undefined;
}) {
  try {
    const link = resolveToolDeepLink(pageId, { anchor, label });
    return <ToolDeepLinkChip link={link} />;
  } catch {
    const safeAnchor = anchor ? `#${anchor.replace(/^#/, "")}` : "";
    return (
      <a
        className="wt-deeplink"
        href={`#/wiki/${pageId}${safeAnchor}`}
        data-testid={`tool-deeplink-${pageId}`}
        data-legacy-baseline="false"
      >
        <span className="wt-deeplink-label">{label ?? `参数专页 · ${pageId}`}</span>
      </a>
    );
  }
}

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

function buildKnobAssistantPrompt(context: KnobSandboxContext, result: KnobEvaluationResult): string {
  const knobLines =
    result.activeKnobs.length > 0
      ? result.activeKnobs.map((entry) => {
          const overrideSuffix =
            entry.effectiveValue !== undefined
              ? `（被规则 ${entry.overriddenByRuleId ?? ""} 静默覆写为 ${formatKnobValue(entry.effectiveValue)}）`
              : "";
          return `  - ${entry.spec.name} = ${formatKnobValue(entry.value)}${overrideSuffix}`;
        })
      : ["  - （当前未显式叠加额外旋钮，仅使用沙盘基础拓扑）"];

  const findingLines =
    result.findings.length > 0
      ? result.findings.map(
          (f) => `  - [${SEVERITY_META[f.severity].badge} · ${f.evidenceLevel}] ${f.title}：${f.detail}`,
        )
      : ["  - 当前组合零阻断、零静默重置"];

  return [
    "我在「昇腾调优旋钮雷达与冲突模拟器」中配置了以下运行拓扑与调优开关组合：",
    `- 目标基线：${context.version} | 芯片：${context.soc} | 模型形态：${context.modelKind} | 图模式：${context.graphMode}`,
    `- 并行与特性：TP=${context.tpSize}, DP=${context.dpSize}, PP=${context.ppSize ?? 1}, EP=${context.epEnabled ? "开" : "关"}, Sleep=${context.sleepMode ? "开" : "关"}, RFork=${context.rforkEnabled ? "开" : "关"}, LoRA=${context.loraEnabled ? "开" : "关"}, PD=${context.pdRole}`,
    "- 已选旋钮：",
    ...knobLines,
    "- 雷达诊断结论：",
    ...findingLines,
    "- 生成启动命令：",
    result.shellCommand,
    "",
    "请结合本仓库知识库与 vllm-ascend 源码，帮我核查这套调优配方的生效链路、潜在性能权衡及最小上线验证建议。",
  ].join("\n");
}

interface ParsedRadarInit {
  context: KnobSandboxContext;
  selections: Record<string, string | number | boolean>;
  presetId: string;
  goalFilter: GoalFilter;
  kindFilter: EntryKindFilter;
  searchQuery: string;
}

const CUSTOM_CONTEXT_URL_KEYS = [
  "model",
  "graph",
  "tp",
  "dp",
  "pp",
  "pd",
  "ep",
  "sleep",
  "rfork",
  "lora",
] as const;

function parseUrlBoolFlag(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  const norm = raw.trim().toLowerCase();
  if (norm === "1" || norm === "true") return true;
  if (norm === "0" || norm === "false") return false;
  return undefined;
}

const UTF8_ENCODER = new TextEncoder();

function utf8ByteLength(text: string): number {
  return UTF8_ENCODER.encode(text).byteLength;
}

interface UrlUnsafeBareInt {
  readonly source: string;
  readonly floatVal: number;
}

const URL_UNSAFE_BARE_INTS = new WeakMap<object, UrlUnsafeBareInt>();

function parseUrlSelections(raw: string | null): Record<string, string | number | boolean> | undefined {
  if (raw === null) return undefined;
  const rawBytes = utf8ByteLength(raw);
  if (rawBytes === 0 || rawBytes > 262144) {
    return { [URL_SEL_PARSE_ERROR_KEY]: rawBytes > 262144 ? "oversized" : "malformed" };
  }
  const trimmed = raw.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  if (trimmed === "none") return {};
  if (trimmed.length === 0 || !trimmed.startsWith("{")) {
    return { [URL_SEL_PARSE_ERROR_KEY]: "malformed" };
  }
  try {
    const parsed = parseLosslessJson(trimmed, (source, floatVal, isIntToken) => {
      if (!Number.isFinite(floatVal)) {
        if (isIntToken) {
          const box = {};
          URL_UNSAFE_BARE_INTS.set(box, { source, floatVal });
          return box;
        }
        return `${URL_SEL_CORRUPT_SENTINEL_PREFIX}non_finite`;
      }
      if (isIntToken && !Number.isSafeInteger(floatVal)) {
        const box = {};
        URL_UNSAFE_BARE_INTS.set(box, { source, floatVal });
        return box;
      }
      return floatVal;
    });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || URL_UNSAFE_BARE_INTS.has(parsed)) {
      return { [URL_SEL_PARSE_ERROR_KEY]: "malformed" };
    }
    const out: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (key === URL_SEL_PARSE_ERROR_KEY) {
        out[URL_SEL_PARSE_ERROR_KEY] = typeof val === "string" && val.length <= 64 ? val : "malformed";
        continue;
      }
      if (!CATALOG_ID_SET.has(key)) continue;
      const spec = getKnobById(key);
      const bareInt = val && typeof val === "object" ? URL_UNSAFE_BARE_INTS.get(val) : undefined;
      if (bareInt) {
        if (spec?.valueType === "int" || spec?.valueType === "float") {
          out[key] =
            utf8ByteLength(bareInt.source) <= 4096
              ? bareInt.source
              : `${URL_SEL_CORRUPT_SENTINEL_PREFIX}oversized`;
        } else {
          out[key] = Number.isFinite(bareInt.floatVal)
            ? bareInt.floatVal
            : `${URL_SEL_CORRUPT_SENTINEL_PREFIX}non_finite`;
        }
      } else if (typeof val === "string") {
        out[key] = utf8ByteLength(val) <= 4096 ? val : `${URL_SEL_CORRUPT_SENTINEL_PREFIX}oversized`;
      } else if (typeof val === "number" || typeof val === "boolean") {
        out[key] = val;
      } else if (val !== undefined) {
        out[key] = `${URL_SEL_CORRUPT_SENTINEL_PREFIX}non_primitive`;
      }
    }
    return out;
  } catch {
    return { [URL_SEL_PARSE_ERROR_KEY]: "malformed" };
  }
}

function serializeUrlSelectionEntries(
  sortedEntries: ReadonlyArray<readonly [string, string | number | boolean | undefined]>,
): string {
  const obj: Record<string, unknown> = {};
  for (const [k, val] of sortedEntries) {
    if (val === undefined) continue;
    if (typeof val === "number") {
      if (!Number.isFinite(val)) {
        obj[k] = `${URL_SEL_CORRUPT_SENTINEL_PREFIX}non_finite`;
      } else if (!Number.isSafeInteger(val) && Number.isInteger(val)) {
        // Preserve float token classification across URL write-back so e.g. 1e20 never flips to bare integer
        obj[k] = createRawJsonLiteral(val.toExponential(), { isIntToken: false, floatVal: val });
      } else {
        obj[k] = val;
      }
    } else {
      obj[k] = val;
    }
  }
  return stringifyLosslessJson(obj);
}

export function appendKnobRadarStateParams(
  params: URLSearchParams,
  opts: {
    context: KnobSandboxContext;
    selections: KnobSelectionMap;
    matchedPresetId?: string | undefined;
    goalFilter: GoalFilter;
    kindFilter: EntryKindFilter;
    searchQuery: string;
    omitDefaultPreset?: boolean | undefined;
  },
): void {
  const { context, selections, matchedPresetId, goalFilter, kindFilter, searchQuery, omitDefaultPreset } =
    opts;
  const defaultPresetId = KNOB_RECIPE_PRESETS[0]?.id;
  if (matchedPresetId) {
    if (!omitDefaultPreset || matchedPresetId !== defaultPresetId) {
      params.set("preset", matchedPresetId);
    }
  } else {
    params.set("ver", context.version);
    params.set("soc", context.soc);
    params.set("model", context.modelKind);
    params.set("graph", context.graphMode);
    params.set("tp", String(context.tpSize));
    params.set("dp", String(context.dpSize));
    params.set("pp", String(context.ppSize ?? 1));
    params.set("pd", context.pdRole);
    params.set("ep", context.epEnabled ? "1" : "0");
    params.set("sleep", context.sleepMode ? "1" : "0");
    params.set("rfork", context.rforkEnabled ? "1" : "0");
    params.set("lora", context.loraEnabled ? "1" : "0");
    const sortedEntries = Object.entries(selections)
      .filter(([, val]) => val !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    params.set("sel", sortedEntries.length === 0 ? "none" : serializeUrlSelectionEntries(sortedEntries));
  }
  if (goalFilter !== "all") params.set("goal", goalFilter);
  if (kindFilter !== "all") params.set("kind", kindFilter);
  if (searchQuery.trim()) params.set("q", searchQuery.trim().slice(0, 80));
}

export function resolveInitialRadarState(
  initialPresetId: string | undefined,
  searchParams: URLSearchParams | undefined,
): ParsedRadarInit {
  const urlPreset = searchParams?.get("preset")?.trim();
  const hasExplicitSel = Boolean(searchParams?.has("sel"));
  const hasCustomCtxParam = Boolean(
    searchParams && CUSTOM_CONTEXT_URL_KEYS.some((key) => searchParams.has(key)),
  );
  const useCustomBase = !urlPreset && (hasExplicitSel || hasCustomCtxParam);

  const targetPresetId = urlPreset || initialPresetId || KNOB_RECIPE_PRESETS[0]!.id;
  const matchedPreset = useCustomBase
    ? undefined
    : (KNOB_RECIPE_PRESETS.find((p) => p.id === targetPresetId) ?? KNOB_RECIPE_PRESETS[0]);

  let context: KnobSandboxContext = matchedPreset
    ? { ...matchedPreset.context, ppSize: matchedPreset.context.ppSize ?? 1 }
    : { ...DEFAULT_SANDBOX_CONTEXT, ppSize: DEFAULT_SANDBOX_CONTEXT.ppSize ?? 1 };
  let selections: Record<string, string | number | boolean> = matchedPreset
    ? { ...matchedPreset.selections }
    : {};

  if (searchParams) {
    const ver = searchParams.get("ver")?.trim();
    if (ver === "v0.30.0" || ver === "main") context = { ...context, version: ver };

    const soc = searchParams.get("soc")?.trim();
    if (soc === "A2" || soc === "A3" || soc === "310P" || soc === "A5") {
      context = { ...context, soc };
    }

    const model = searchParams.get("model")?.trim();
    if (model === "dense" || model === "moe" || model === "mla_moe" || model === "engram_moe") {
      context = { ...context, modelKind: model };
    }

    const graph = searchParams.get("graph")?.trim();
    if (
      graph === "FULL_AND_PIECEWISE" ||
      graph === "FULL_DECODE_ONLY" ||
      graph === "PIECEWISE" ||
      graph === "NONE"
    ) {
      context = { ...context, graphMode: graph };
    }

    const tpRaw = Number(searchParams.get("tp")?.trim());
    if (tpRaw === 1 || tpRaw === 2 || tpRaw === 4 || tpRaw === 8 || tpRaw === 16) {
      context = { ...context, tpSize: tpRaw };
    }

    const dpRaw = Number(searchParams.get("dp")?.trim());
    if (dpRaw === 1 || dpRaw === 2 || dpRaw === 4 || dpRaw === 8) {
      context = { ...context, dpSize: dpRaw };
    }

    const ppRaw = Number(searchParams.get("pp")?.trim());
    if (ppRaw === 1 || ppRaw === 2 || ppRaw === 4) {
      context = { ...context, ppSize: ppRaw };
    }

    const pd = searchParams.get("pd")?.trim();
    if (pd === "none" || pd === "prefill" || pd === "decode") {
      context = { ...context, pdRole: pd };
    }

    const epFlag = parseUrlBoolFlag(searchParams.get("ep"));
    if (epFlag !== undefined) context = { ...context, epEnabled: epFlag };

    const sleepFlag = parseUrlBoolFlag(searchParams.get("sleep"));
    if (sleepFlag !== undefined) context = { ...context, sleepMode: sleepFlag };

    const rforkFlag = parseUrlBoolFlag(searchParams.get("rfork"));
    if (rforkFlag !== undefined) context = { ...context, rforkEnabled: rforkFlag };

    const loraFlag = parseUrlBoolFlag(searchParams.get("lora"));
    if (loraFlag !== undefined) context = { ...context, loraEnabled: loraFlag };

    const parsedSel = parseUrlSelections(searchParams.get("sel"));
    if (parsedSel !== undefined) {
      selections = parsedSel;
    }
  }

  const rawGoal = searchParams?.get("goal")?.trim() as GoalFilter | undefined;
  const goalFilter: GoalFilter =
    rawGoal && (rawGoal === "all" || GOAL_KEYS.includes(rawGoal)) ? rawGoal : "all";

  const rawKind = searchParams?.get("kind")?.trim() as EntryKindFilter | undefined;
  const kindFilter: EntryKindFilter =
    rawKind === "env" || rawKind === "additional_config" || rawKind === "cli_core" ? rawKind : "all";

  const searchQuery = searchParams?.get("q")?.slice(0, 120) ?? "";

  return {
    context,
    selections,
    presetId: matchedPreset?.id ?? "",
    goalFilter,
    kindFilter,
    searchQuery,
  };
}

function KnobCatalogCard({
  spec,
  version,
  selectedValue,
  onToggleValue,
}: {
  spec: AscendKnobSpec;
  version: KnobVersionTarget;
  selectedValue: string | number | boolean | undefined;
  onToggleValue: (knobId: string, value: string | number | boolean) => void;
}) {
  const lifecycle = resolveKnobLifecycle(spec, version);
  const entryMeta = ENTRY_BADGE_META[spec.entryKind];
  const lifeMeta = LIFECYCLE_BADGE_META[lifecycle];
  const isSelected = selectedValue !== undefined;
  const isTrap = lifecycle === "retired-trap";
  const subpath =
    spec.entryKind === "additional_config" && spec.jsonPath && spec.jsonPath !== spec.name
      ? spec.jsonPath
      : spec.entryKind === "cli_core" && spec.cliFlag && spec.cliFlag !== spec.name
        ? spec.cliFlag
        : null;

  const visibleRecommendedValues = spec.recommendedValuesByVersion?.[version] ?? spec.recommendedValues;
  const hasCustomSelected = isSelected && !visibleRecommendedValues.some((rv) => rv.value === selectedValue);

  return (
    <article
      className={`wt-kr-knob-card${isSelected ? " is-selected" : ""}${isTrap ? " is-trap" : ""}`}
      data-testid={`knob-card-${spec.id}`}
      data-entry-kind={spec.entryKind}
      data-lifecycle={lifecycle}
    >
      <div className="wt-kr-knob-head">
        <div className="wt-kr-knob-name-wrap">
          <code className="wt-kr-knob-name">{spec.name}</code>
          {subpath && <code className="wt-kr-knob-subpath">{subpath}</code>}
        </div>
        <div className="wt-kr-badges">
          <span className={`wt-kr-badge is-mono ${entryMeta.cls}`}>{entryMeta.label}</span>
          <span className={`wt-kr-badge ${lifeMeta.cls}`}>{lifeMeta.label}</span>
          <span className="wt-kr-badge is-mono">[{spec.evidenceLevel}]</span>
        </div>
      </div>

      <p className="wt-kr-knob-summary">{spec.summaryZh}</p>

      {spec.replacementHintZh && (
        <p className="wt-kr-replacement-hint">
          <strong>替代指引：</strong>
          {spec.replacementHintZh}
        </p>
      )}

      <div className="wt-kr-values-row">
        {visibleRecommendedValues.map((rv) => {
          const active = isSelected && selectedValue === rv.value;
          return (
            <button
              key={`${spec.id}-val-${String(rv.value)}`}
              type="button"
              aria-pressed={active}
              className={`wt-kr-val-pill${active ? " is-selected" : ""}`}
              data-testid={`knob-val-${spec.id}-${String(rv.value)}`}
              onClick={() => onToggleValue(spec.id, rv.value)}
            >
              <span>{rv.label}</span>
              <code className="wt-kr-val-code">= {formatKnobValue(rv.value)}</code>
            </button>
          );
        })}
        {hasCustomSelected && (
          <button
            type="button"
            aria-pressed={true}
            className="wt-kr-val-pill is-selected"
            data-testid={`knob-val-${spec.id}-custom`}
            onClick={() => onToggleValue(spec.id, selectedValue)}
          >
            <span>当前值</span>
            <code className="wt-kr-val-code">= {formatKnobValue(selectedValue)}</code>
          </button>
        )}
      </div>

      <div className="wt-deeplinks">
        <KnobWikiDeepLink pageId={spec.wikiPageId} anchor={spec.wikiAnchor} />
      </div>

      <details className="wt-collateral-details">
        <summary className="wt-collateral-summary">
          <span>查看底层机制、默认值与源码锚点</span>
          <span className="mono">{spec.sources.length} 处源码</span>
        </summary>
        <div className="wt-collateral-body">
          <div style={{ fontSize: 13, color: "var(--color-ink)" }}>
            <strong>默认行为：</strong>
            {spec.defaultSummary}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-ink)" }}>
            <strong>生效机制：</strong>
            {spec.mechanismZh}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
            <strong>工程边界：</strong>
            {spec.tradeoffZh}
          </div>
          <div className="wt-source-links">
            {spec.sources.map((src) => (
              <SourceRefLink key={`${spec.id}-src-${src}`} rawRef={src} />
            ))}
          </div>
        </div>
      </details>
    </article>
  );
}

function KnobFindingCard({
  finding,
  onApplyFix,
}: {
  finding: KnobConflictFinding;
  onApplyFix: (fix: KnobFixAction) => void;
}) {
  const meta = SEVERITY_META[finding.severity];
  return (
    <article
      className={`wt-kr-finding-card ${meta.cardCls}`}
      data-testid={`knob-finding-${finding.id}`}
      data-severity={finding.severity}
    >
      <div className="wt-finding-head">
        <span className={`wt-badge-judgment ${meta.badgeCls}`}>{meta.badge}</span>
        <span className="wt-badge-evidence">[{finding.evidenceLevel}]</span>
        <h4 className="wt-finding-title">{finding.title}</h4>
      </div>
      <p className="wt-finding-msg">{finding.detail}</p>
      {finding.fixAction && (
        <button
          type="button"
          className="wt-kr-fix-btn"
          data-testid={`knob-fix-${finding.id}`}
          onClick={() => onApplyFix(finding.fixAction!)}
        >
          一键修复：{finding.fixAction.label}
        </button>
      )}
      {finding.sources.length > 0 && (
        <div className="wt-source-links">
          {finding.sources.map((src) => (
            <SourceRefLink key={`${finding.id}-src-${src}`} rawRef={src} />
          ))}
        </div>
      )}
    </article>
  );
}
export function AscendKnobRadarView({
  mode = "full",
  title,
  summary,
  initialPresetId,
  embedded = false,
  isActive = true,
  searchParams,
  locationKey: _locationKey,
  onUpdateSearchParams,
}: AscendKnobRadarViewProps) {
  const idPrefix = useId();
  const assistant = useOptionalWikiAssistant();
  const pageCtxSlug = useContext(DiagramPageContext);
  const effectiveMode: "minimal" | "full" = mode === "minimal" ? "minimal" : "full";

  const [initState] = useState<ParsedRadarInit>(() =>
    resolveInitialRadarState(initialPresetId, !embedded && isActive ? searchParams : undefined),
  );

  const [context, setContext] = useState<KnobSandboxContext>(initState.context);
  const [selections, setSelections] = useState<Record<string, string | number | boolean>>(
    initState.selections,
  );
  const [preferredPresetId, setPreferredPresetId] = useState<string>(initState.presetId);
  const [goalFilter, setGoalFilter] = useState<GoalFilter>(initState.goalFilter);
  const [kindFilter, setKindFilter] = useState<EntryKindFilter>(initState.kindFilter);
  const [searchQuery, setSearchQuery] = useState<string>(initState.searchQuery);
  const [minimalExpanded, setMinimalExpanded] = useState<boolean>(false);
  const [cmdCopied, setCmdCopied] = useState<boolean>(false);
  const [jsonCopied, setJsonCopied] = useState<boolean>(false);

  const lastSyncedQueryRef = useRef<string>(searchParams?.toString() ?? "");
  const skipWriteBackForQueryRef = useRef<string | null>(null);

  // External browser back/forward URL sync on standalone ToolsPage
  useEffect(() => {
    if (embedded || !isActive || !searchParams) return;
    const rawStr = searchParams.toString();
    if (rawStr === lastSyncedQueryRef.current) return;
    lastSyncedQueryRef.current = rawStr;
    skipWriteBackForQueryRef.current = rawStr;
    const next = resolveInitialRadarState(initialPresetId, searchParams);
    setContext(next.context);
    setSelections(next.selections);
    setPreferredPresetId(next.presetId);
    setGoalFilter(next.goalFilter);
    setKindFilter(next.kindFilter);
    setSearchQuery(next.searchQuery);
  }, [embedded, isActive, searchParams, initialPresetId]);

  const matchedPresetId = useMemo(
    () => matchExactKnobPresetId(context, selections, preferredPresetId),
    [context, selections, preferredPresetId],
  );

  // Sync full state back to URL query when standalone active tab
  useEffect(() => {
    if (embedded || !isActive || !searchParams || !onUpdateSearchParams) return;
    const currentUrlStr = searchParams.toString();
    if (skipWriteBackForQueryRef.current === currentUrlStr) {
      skipWriteBackForQueryRef.current = null;
      return;
    }
    skipWriteBackForQueryRef.current = null;

    const nextParams = new URLSearchParams();
    nextParams.set("tab", "knobs");
    preserveWikiBackParams(nextParams, searchParams);
    appendKnobRadarStateParams(nextParams, {
      context,
      selections,
      matchedPresetId,
      goalFilter,
      kindFilter,
      searchQuery,
      omitDefaultPreset: true,
    });

    const nextStr = nextParams.toString();
    if (nextStr !== currentUrlStr) {
      lastSyncedQueryRef.current = nextStr;
      onUpdateSearchParams(nextParams, { replace: true });
    }
  }, [
    embedded,
    isActive,
    searchParams,
    onUpdateSearchParams,
    matchedPresetId,
    context,
    selections,
    goalFilter,
    kindFilter,
    searchQuery,
  ]);

  const result = useMemo(() => evaluateKnobRecipe(context, selections), [context, selections]);

  const filteredKnobs = useMemo(
    () => ASCEND_KNOB_CATALOG.filter((spec) => matchesKnobFilter(spec, goalFilter, kindFilter, searchQuery)),
    [goalFilter, kindFilter, searchQuery],
  );

  const visibleKnobs = useMemo(() => {
    if (effectiveMode === "minimal" && !minimalExpanded) {
      return filteredKnobs.slice(0, MINIMAL_COLLAPSED_LIMIT);
    }
    return filteredKnobs;
  }, [effectiveMode, minimalExpanded, filteredKnobs]);

  const orderedFindings = useMemo(
    () => [...result.blockers, ...result.silentResets, ...result.perfTraps, ...result.synergies],
    [result],
  );

  const fixableIssueCount = useMemo(
    () => orderedFindings.filter((f) => f.severity !== "synergy" && f.fixAction !== undefined).length,
    [orderedFindings],
  );

  const handleSelectPreset = (preset: KnobRecipePreset) => {
    setPreferredPresetId(preset.id);
    setContext({ ...preset.context, ppSize: preset.context.ppSize ?? 1 });
    setSelections({ ...preset.selections });
  };

  const handleClearSelections = () => {
    setPreferredPresetId("");
    setSelections({});
  };

  const handleToggleKnobValue = (knobId: string, value: string | number | boolean) => {
    setPreferredPresetId("");
    setSelections((prev) => {
      const next = { ...prev };
      if (Object.hasOwn(next, knobId) && next[knobId] === value) {
        delete next[knobId];
      } else {
        next[knobId] = value;
      }
      return next;
    });
  };

  const handleRemoveKnob = (knobId: string) => {
    setPreferredPresetId("");
    setSelections((prev) => {
      if (!Object.hasOwn(prev, knobId)) return prev;
      const next = { ...prev };
      delete next[knobId];
      return next;
    });
  };

  const handleApplyFix = (fix: KnobFixAction) => {
    setPreferredPresetId("");
    const updated = applyKnobFixAction(context, selections, fix);
    setContext({ ...updated.context, ppSize: updated.context.ppSize ?? 1 });
    setSelections(updated.selections);
  };

  const handleApplyAllFixes = () => {
    setPreferredPresetId("");
    let curCtx: KnobSandboxContext = { ...context, ppSize: context.ppSize ?? 1 };
    let curSel: Record<string, string | number | boolean> = { ...selections };
    const serializeState = (ctx: KnobSandboxContext, sel: Record<string, string | number | boolean>) =>
      JSON.stringify([ctx, Object.entries(sel).sort(([a], [b]) => a.localeCompare(b))]);
    const seenStates = new Set<string>([serializeState(curCtx, curSel)]);
    for (let step = 0; step < 100; step += 1) {
      const evalRes = evaluateKnobRecipe(curCtx, curSel);
      const nextFixable = evalRes.findings.find((f) => f.severity !== "synergy" && f.fixAction !== undefined);
      if (!nextFixable?.fixAction) break;
      const applied = applyKnobFixAction(curCtx, curSel, nextFixable.fixAction);
      const nextCtx: KnobSandboxContext = { ...applied.context, ppSize: applied.context.ppSize ?? 1 };
      const sig = serializeState(nextCtx, applied.selections);
      if (seenStates.has(sig)) break;
      seenStates.add(sig);
      curCtx = nextCtx;
      curSel = applied.selections;
    }
    setContext(curCtx);
    setSelections(curSel);
  };

  const handleCopyCommand = () => {
    if (result.blockers.length > 0) return;
    void copyTextToClipboard(result.shellCommand).then((ok) => {
      if (ok) {
        setCmdCopied(true);
        setTimeout(() => setCmdCopied(false), 1800);
      }
    });
  };

  const additionalConfigJson = useMemo(
    () =>
      Object.keys(result.additionalConfigObj).length > 0
        ? stringifyLosslessJson(result.additionalConfigObj, 2)
        : "",
    [result.additionalConfigObj],
  );

  const handleCopyJson = () => {
    if (!additionalConfigJson || result.blockers.length > 0) return;
    void copyTextToClipboard(additionalConfigJson).then((ok) => {
      if (ok) {
        setJsonCopied(true);
        setTimeout(() => setJsonCopied(false), 1800);
      }
    });
  };
  const handleAskAssistant = (event: MouseEvent<HTMLButtonElement>) => {
    if (!assistant) return;
    const rawPrompt = buildKnobAssistantPrompt(context, result);
    const { sanitized, redactionCount } = sanitizeDiagnosticText(rawPrompt);
    assistant.openChat({
      pendingAttachment: {
        title: `昇腾调优旋钮雷达快照（${context.version} · ${context.soc}）`,
        summary: `已选 ${result.activeKnobs.length} 项开关 · ${result.blockers.length} 阻断 · ${result.silentResets.length} 静默重置 · ${result.perfTraps.length} 陷阱`,
        sanitizedBlock: sanitized,
        redactionCount,
        suggestedQuestion: `请结合 vllm-ascend ${context.version} 源码，评估这套 ${context.soc} 调优旋钮组合的生效条件与上线风险。`,
      },
      submit: false,
      trigger: event.currentTarget,
    });
  };

  const fromPageSlug = resolveEmbeddedFromPage(pageCtxSlug, assistant?.wikiHost?.currentId);
  const workbenchHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", "knobs");
    if (fromPageSlug) params.set("fromPage", fromPageSlug);
    appendKnobRadarStateParams(params, {
      context,
      selections,
      matchedPresetId,
      goalFilter,
      kindFilter,
      searchQuery,
    });
    return `#/tools?${params.toString()}`;
  }, [fromPageSlug, context, selections, matchedPresetId, goalFilter, kindFilter, searchQuery]);

  const displayTitle = title ?? "昇腾调优旋钮雷达与冲突模拟器";
  const displaySummary =
    summary ??
    `按 6 大调优目标反查 ${ASCEND_KNOB_CATALOG.length} 项环境变量、additional_config 与核心 CLI 旋钮，实时模拟跨开关互斥、静默覆写并生成干净启动命令。`;
  const baselineText = `v0.30.0 c09d3e20 · main 8d6180e2 · ${ASCEND_KNOB_CATALOG.length} 项源码钉点开关`;

  const radarSummaryCls =
    result.blockers.length > 0
      ? "has-blocker"
      : result.silentResets.length > 0 || result.perfTraps.length > 0
        ? "has-warn"
        : "is-clean";

  return (
    <div
      className={`wt-root ${embedded ? "wt-root-embedded" : "wt-root-full"}`}
      data-testid="ascend-knob-radar-view"
      data-mode={effectiveMode}
      data-version={context.version}
    >
      {embedded ? (
        <>
          <header className="wiki-tool-head">
            <div className="wt-embedded-title-group">
              <strong className="wiki-tool-title">{displayTitle}</strong>
              <span className="wiki-tool-badge">{effectiveMode === "minimal" ? "精简模式" : "完整模式"}</span>
              <span className="wt-baseline-pill" data-testid="knob-baseline-badge">
                {baselineText}
              </span>
            </div>
            <a className="wt-open-workbench" href={workbenchHref} data-testid="knob-open-workbench">
              在独立工作台打开完整旋钮雷达 ↗
            </a>
          </header>
          {summary && <p className="wiki-tool-summary">{summary}</p>}
        </>
      ) : (
        <header className="wt-header">
          <div className="wt-header-main">
            <div className="wt-title-row">
              <h2 className="wt-title">{displayTitle}</h2>
              <span className="wt-baseline-pill" data-testid="knob-baseline-badge">
                {baselineText}
              </span>
            </div>
            <p className="wt-subtitle">{displaySummary}</p>
          </div>
          {assistant && (
            <div className="wt-header-actions">
              <button
                type="button"
                className="wt-assistant-btn"
                data-testid="knob-ask-assistant"
                onClick={handleAskAssistant}
              >
                问知识库助手
              </button>
            </div>
          )}
        </header>
      )}

      {/* Row 1: 1-Click Scenario Recipe Presets */}
      <section className="wt-kr-presets-section" aria-label="场景配方预设">
        <div className="wt-kr-presets-head">
          <span className="wt-presets-label">① 一键载入典型配方或排雷靶场</span>
          <button
            type="button"
            className="wt-preset-btn"
            data-testid="knob-clear-selections"
            onClick={handleClearSelections}
          >
            清空已选旋钮（当前 {result.activeKnobs.length} 项）
          </button>
        </div>
        <div className="wt-kr-presets-grid">
          {KNOB_RECIPE_PRESETS.map((preset) => {
            const active = matchedPresetId === preset.id;
            const isMinefield = preset.id === "preset-legacy-docs-minefield";
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                className={`wt-kr-preset-card${active ? " is-active" : ""}${isMinefield ? " is-minefield" : ""}`}
                data-testid={`knob-preset-${preset.id}`}
                onClick={() => handleSelectPreset(preset)}
              >
                <span className="wt-kr-preset-top">
                  <span className="wt-kr-preset-title">{preset.titleZh}</span>
                  <span className="wt-kr-preset-tag">{preset.tagZh}</span>
                </span>
                {(effectiveMode === "full" || active) && (
                  <span className="wt-kr-preset-sub">{preset.subtitleZh}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Row 2: Runtime Sandbox Context Bar */}
      <section className="wt-kr-context-bar" data-testid="knob-context-bar" aria-label="运行拓扑沙盘上下文">
        <div className="wt-kr-context-grid">
          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-ver`}>
            <span className="wt-field-label">目标版本</span>
            <select
              id={`${idPrefix}-ver`}
              className="wt-select"
              data-testid="knob-ctx-version"
              value={context.version}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({ ...prev, version: e.target.value as KnobVersionTarget }));
              }}
            >
              {VERSION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-soc`}>
            <span className="wt-field-label">昇腾芯片</span>
            <select
              id={`${idPrefix}-soc`}
              className="wt-select"
              data-testid="knob-ctx-soc"
              value={context.soc}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({ ...prev, soc: e.target.value as KnobSandboxContext["soc"] }));
              }}
            >
              {SOC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-mk`}>
            <span className="wt-field-label">模型形态</span>
            <select
              id={`${idPrefix}-mk`}
              className="wt-select"
              data-testid="knob-ctx-model-kind"
              value={context.modelKind}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({
                  ...prev,
                  modelKind: e.target.value as KnobSandboxContext["modelKind"],
                }));
              }}
            >
              {MODEL_KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-gm`}>
            <span className="wt-field-label">图模式</span>
            <select
              id={`${idPrefix}-gm`}
              className="wt-select"
              data-testid="knob-ctx-graph-mode"
              value={context.graphMode}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({
                  ...prev,
                  graphMode: e.target.value as KnobSandboxContext["graphMode"],
                }));
              }}
            >
              {GRAPH_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-tp`}>
            <span className="wt-field-label">TP 并行</span>
            <select
              id={`${idPrefix}-tp`}
              className="wt-select"
              data-testid="knob-ctx-tp"
              value={context.tpSize}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({
                  ...prev,
                  tpSize: Number(e.target.value) as KnobSandboxContext["tpSize"],
                }));
              }}
            >
              {TP_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  TP = {n}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-dp`}>
            <span className="wt-field-label">DP 并行</span>
            <select
              id={`${idPrefix}-dp`}
              className="wt-select"
              data-testid="knob-ctx-dp"
              value={context.dpSize}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({
                  ...prev,
                  dpSize: Number(e.target.value) as KnobSandboxContext["dpSize"],
                }));
              }}
            >
              {DP_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  DP = {n}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-pp`}>
            <span className="wt-field-label">PP 流水线</span>
            <select
              id={`${idPrefix}-pp`}
              className="wt-select"
              data-testid="knob-ctx-pp"
              value={context.ppSize ?? 1}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({
                  ...prev,
                  ppSize: Number(e.target.value) as 1 | 2 | 4,
                }));
              }}
            >
              {PP_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  PP = {n}
                </option>
              ))}
            </select>
          </label>

          <label className="wt-kr-context-field" htmlFor={`${idPrefix}-pd`}>
            <span className="wt-field-label">PD 角色</span>
            <select
              id={`${idPrefix}-pd`}
              className="wt-select"
              data-testid="knob-ctx-pd-role"
              value={context.pdRole}
              onChange={(e) => {
                setPreferredPresetId("");
                setContext((prev) => ({ ...prev, pdRole: e.target.value as KnobSandboxContext["pdRole"] }));
              }}
            >
              {PD_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="wt-kr-context-flags">
          {(
            [
              { key: "epEnabled", label: "EP 专家并行", testId: "knob-ctx-ep" },
              { key: "sleepMode", label: "Sleep Mode", testId: "knob-ctx-sleep" },
              { key: "rforkEnabled", label: "RFork 极速拉起", testId: "knob-ctx-rfork" },
              { key: "loraEnabled", label: "LoRA 适配器", testId: "knob-ctx-lora" },
            ] as const
          ).map((item) => {
            const checked = context[item.key];
            return (
              <label key={item.key} className={`wt-kr-flag-chip${checked ? " is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  data-testid={item.testId}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    setPreferredPresetId("");
                    setContext((prev) => ({ ...prev, [item.key]: nextChecked }));
                  }}
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </section>
      {/* Row 3: Two-Column Responsive Workspace */}
      <div className="wt-kr-workspace" data-testid="knob-workspace">
        {/* Left Column: Knob Catalog Explorer */}
        <section className="wt-kr-col" data-testid="knob-explorer-col" aria-label="旋钮探索目录">
          <div className="wt-kr-filter-panel">
            <div className="wt-section-head">
              <h3 className="wt-section-title">② 按调优目标与入口反查旋钮</h3>
              <span className="wt-section-meta" data-testid="knob-match-count">
                匹配 {filteredKnobs.length} / {ASCEND_KNOB_CATALOG.length} 项
              </span>
            </div>

            <div className="wt-filter-row">
              <button
                type="button"
                aria-pressed={goalFilter === "all"}
                className={`wt-filter-btn${goalFilter === "all" ? " is-active" : ""}`}
                data-testid="knob-goal-all"
                onClick={() => setGoalFilter("all")}
              >
                全部
              </button>
              {GOAL_KEYS.map((g) => {
                const active = goalFilter === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={active}
                    className={`wt-filter-btn${active ? " is-active" : ""}`}
                    data-testid={`knob-goal-${g}`}
                    onClick={() => setGoalFilter(active ? "all" : g)}
                  >
                    {KNOB_GOAL_LABELS[g]}
                  </button>
                );
              })}
            </div>

            <div className="wt-toolbar-row">
              <div className="wt-segmented">
                {ENTRY_KIND_OPTIONS.map((opt) => {
                  const active = kindFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      className={`wt-seg-btn${active ? " is-active" : ""}`}
                      data-testid={`knob-kind-${opt.value}`}
                      onClick={() => setKindFilter(opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="wt-kr-search-row">
              <input
                type="search"
                aria-label="检索调优开关名称、JSON 路径或排障现象"
                className="wt-input wt-kr-search-input"
                data-testid="knob-search-input"
                placeholder="搜索如 HCCL_BUFFSIZE、weight_nz_mode、NZ、睡眠、static_kernel…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {(goalFilter !== "all" || kindFilter !== "all" || searchQuery.trim().length > 0) && (
                <button
                  type="button"
                  className="wt-preset-btn"
                  data-testid="knob-reset-filters"
                  onClick={() => {
                    setGoalFilter("all");
                    setKindFilter("all");
                    setSearchQuery("");
                  }}
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>

          {visibleKnobs.length === 0 ? (
            <div className="wt-empty-state" data-testid="knob-empty-catalog">
              未匹配到符合当前目标、入口与关键词的昇腾开关，可点击「清除筛选」查看全部{" "}
              {ASCEND_KNOB_CATALOG.length} 项旋钮。
            </div>
          ) : (
            <div className="wt-kr-knob-list" data-testid="knob-catalog-list">
              {visibleKnobs.map((spec) => (
                <KnobCatalogCard
                  key={spec.id}
                  spec={spec}
                  version={context.version}
                  selectedValue={Object.hasOwn(selections, spec.id) ? selections[spec.id] : undefined}
                  onToggleValue={handleToggleKnobValue}
                />
              ))}
            </div>
          )}

          {effectiveMode === "minimal" && filteredKnobs.length > MINIMAL_COLLAPSED_LIMIT && (
            <button
              type="button"
              className="wt-kr-expand-btn"
              data-testid="knob-minimal-expand-toggle"
              onClick={() => setMinimalExpanded((prev) => !prev)}
            >
              {minimalExpanded
                ? `收起至前 ${MINIMAL_COLLAPSED_LIMIT} 项开关`
                : `展开全部 ${filteredKnobs.length} 项开关`}
            </button>
          )}
        </section>

        {/* Right Column: Live Conflict Radar & Clean Recipe Output */}
        <section className="wt-kr-col" data-testid="knob-radar-col" aria-label="实时冲突雷达与启动命令生成">
          <div className={`wt-kr-radar-summary ${radarSummaryCls}`} data-testid="knob-radar-summary">
            <div className="wt-kr-stat-pills">
              <span className="wt-stat-pill is-error" data-testid="knob-count-blocker">
                🔴 启动阻断 {result.blockers.length}
              </span>
              <span className="wt-stat-pill is-rewrite" data-testid="knob-count-silent-reset">
                🟠 静默重置 {result.silentResets.length}
              </span>
              <span className="wt-stat-pill is-warn" data-testid="knob-count-perf-trap">
                🟡 性能陷阱 {result.perfTraps.length}
              </span>
              <span className="wt-stat-pill" data-testid="knob-count-synergy">
                🟢 协同增益 {result.synergies.length}
              </span>
            </div>
            {fixableIssueCount >= 2 && (
              <button
                type="button"
                className="wt-kr-fix-btn"
                data-testid="knob-fix-all"
                onClick={handleApplyAllFixes}
              >
                一键收敛全部 {fixableIssueCount} 项冲突
              </button>
            )}
          </div>

          <div className="wt-kr-active-box" data-testid="knob-active-box">
            <div className="wt-section-head">
              <h3 className="wt-section-title">当前配方已选旋钮（{result.activeKnobs.length}）</h3>
              <span className="wt-section-meta">点击左侧候选值可切换，被规则覆写项将标出实际生效值</span>
            </div>
            {result.activeKnobs.length === 0 ? (
              <div className="wt-empty-state">
                当前未叠加额外旋钮，下方仅输出基础并行与图模式命令；可从左侧点选候选值或上方载入预设。
              </div>
            ) : (
              <div className="wt-kr-active-pills" data-testid="knob-active-pills">
                {result.activeKnobs.map((entry: ActiveKnobEntry) => {
                  const isOverridden = entry.effectiveValue !== undefined;
                  const isRetired = entry.lifecycle === "retired-trap";
                  return (
                    <span
                      key={entry.spec.id}
                      className={`wt-kr-active-pill${isOverridden ? " is-overridden" : ""}${isRetired ? " is-retired" : ""}`}
                      data-testid={`knob-active-pill-${entry.spec.id}`}
                    >
                      <span>{entry.spec.name}=</span>
                      {isOverridden ? (
                        <>
                          <del className="wt-kr-strike">{formatKnobValue(entry.value)}</del>
                          <span className="wt-kr-effective-val">
                            → {formatKnobValue(entry.effectiveValue!)}
                          </span>
                        </>
                      ) : (
                        <span>{formatKnobValue(entry.value)}</span>
                      )}
                      {isRetired && <span>(废弃剥离)</span>}
                      <button
                        type="button"
                        className="wt-kr-pill-remove"
                        aria-label={`移除 ${entry.spec.name}`}
                        data-testid={`knob-remove-${entry.spec.id}`}
                        onClick={() => handleRemoveKnob(entry.spec.id)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="wt-section" data-testid="knob-findings-section">
            <div className="wt-section-head">
              <h3 className="wt-section-title">③ 实时互斥排雷与协同评估（{orderedFindings.length}）</h3>
            </div>
            {orderedFindings.length === 0 ? (
              <div className="wt-empty-state" data-testid="knob-findings-clean">
                当前拓扑与旋钮组合未触发已知启动阻断、静默重置或性能反噬陷阱。
              </div>
            ) : (
              <div className="wt-findings-list" data-testid="knob-findings-list">
                {orderedFindings.map((finding) => (
                  <KnobFindingCard key={finding.id} finding={finding} onApplyFix={handleApplyFix} />
                ))}
              </div>
            )}
          </div>

          <div className="wt-kr-output-card" data-testid="knob-output-box">
            <div className="wt-section-head">
              <h3 className="wt-section-title">④ 干净启动命令与 JSON 配方预览</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  type="button"
                  className="wt-assistant-btn"
                  data-testid="knob-copy-cmd"
                  disabled={result.blockers.length > 0}
                  onClick={handleCopyCommand}
                >
                  {result.blockers.length > 0
                    ? `存在 ${result.blockers.length} 项启动阻断 · 请先修复`
                    : cmdCopied
                      ? "已复制启动命令 ✓"
                      : "复制启动命令"}
                </button>
                {additionalConfigJson && (
                  <button
                    type="button"
                    className="wt-preset-btn"
                    data-testid="knob-copy-json"
                    disabled={result.blockers.length > 0}
                    onClick={handleCopyJson}
                  >
                    {result.blockers.length > 0
                      ? "修复阻断后可复制 JSON"
                      : jsonCopied
                        ? "已复制 JSON ✓"
                        : "复制 additional_config"}
                  </button>
                )}
                {embedded && assistant && (
                  <button
                    type="button"
                    className="wt-preset-btn"
                    data-testid="knob-ask-assistant"
                    onClick={handleAskAssistant}
                  >
                    问知识库助手
                  </button>
                )}
              </div>
            </div>
            <pre className="wt-kr-code-pre" data-testid="knob-shell-preview">
              {result.shellCommand}
            </pre>
            {additionalConfigJson && (
              <>
                <span className="wt-field-label">格式化 --additional-config JSON 展开预览</span>
                <pre className="wt-kr-code-pre" data-testid="knob-json-preview">
                  {additionalConfigJson}
                </pre>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function WikiKnobRadarBlock({ spec }: { spec: WikiToolSpec }) {
  const mode = spec.mode === "minimal" || spec.mode === "full" ? spec.mode : "minimal";
  return (
    <AscendKnobRadarView
      mode={mode}
      title={spec.title}
      summary={spec.summary}
      initialPresetId={spec.preset}
      embedded
    />
  );
}
