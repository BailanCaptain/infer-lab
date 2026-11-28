export type KnobEntryKind = "env" | "additional_config" | "cli_core";

export type KnobTuningGoal = "ttft" | "tpot" | "memory" | "comm" | "graph" | "pitfall";

export type KnobLifecycleStatus = "active" | "main-only" | "v030-only" | "retired-trap";

export type KnobVersionSupport = "supported" | "retired" | "absent";

export type KnobVersionTarget = "v0.30.0" | "main";

export interface KnobRecommendedValue {
  readonly label: string;
  readonly value: string | number | boolean;
}

export interface AscendKnobSpec {
  readonly id: string;
  readonly name: string;
  readonly entryKind: KnobEntryKind;
  readonly jsonPath?: string;
  readonly cliFlag?: string;
  readonly goals: readonly KnobTuningGoal[];
  readonly statusByVersion: Readonly<Record<KnobVersionTarget, KnobVersionSupport>>;
  readonly valueType: "bool" | "int" | "float" | "enum" | "string" | "json";
  readonly defaultSummary: string;
  readonly recommendedValues: readonly KnobRecommendedValue[];
  readonly recommendedValuesByVersion?: Partial<Record<KnobVersionTarget, readonly KnobRecommendedValue[]>>;
  readonly summaryZh: string;
  readonly mechanismZh: string;
  readonly tradeoffZh: string;
  readonly replacementHintZh?: string;
  readonly wikiPageId: string;
  readonly wikiAnchor?: string;
  readonly sources: readonly string[];
  readonly evidenceLevel: "C" | "M" | "S";
}

export interface KnobSandboxContext {
  readonly version: KnobVersionTarget;
  readonly soc: "A2" | "A3" | "310P" | "A5";
  readonly modelKind: "dense" | "moe" | "mla_moe" | "engram_moe";
  readonly graphMode: "FULL_AND_PIECEWISE" | "FULL_DECODE_ONLY" | "PIECEWISE" | "NONE";
  readonly tpSize: 1 | 2 | 4 | 8 | 16;
  readonly dpSize: 1 | 2 | 4 | 8;
  readonly ppSize?: 1 | 2 | 4;
  readonly epEnabled: boolean;
  readonly sleepMode: boolean;
  readonly rforkEnabled: boolean;
  readonly loraEnabled: boolean;
  readonly pdRole: "none" | "prefill" | "decode";
}

export type KnobSelectionMap = Readonly<Record<string, string | number | boolean>>;

export type KnobFindingSeverity = "blocker" | "silent-reset" | "perf-trap" | "synergy";

export interface KnobFixAction {
  readonly label: string;
  readonly nextSelections?: Readonly<Record<string, string | number | boolean | null>>;
  readonly nextContextPatch?: Partial<KnobSandboxContext>;
}

export interface KnobConflictFinding {
  readonly id: string;
  readonly severity: KnobFindingSeverity;
  readonly title: string;
  readonly detail: string;
  readonly affectedKnobIds: readonly string[];
  readonly sources: readonly string[];
  readonly evidenceLevel: "C" | "M";
  readonly fixAction?: KnobFixAction;
}

export interface ActiveKnobEntry {
  readonly spec: AscendKnobSpec;
  readonly value: string | number | boolean;
  readonly lifecycle: KnobLifecycleStatus;
  readonly effectiveValue?: string | number | boolean;
  readonly overriddenByRuleId?: string;
}

export interface KnobEvaluationResult {
  readonly activeKnobs: readonly ActiveKnobEntry[];
  readonly findings: readonly KnobConflictFinding[];
  readonly blockers: readonly KnobConflictFinding[];
  readonly silentResets: readonly KnobConflictFinding[];
  readonly perfTraps: readonly KnobConflictFinding[];
  readonly synergies: readonly KnobConflictFinding[];
  readonly shellCommand: string;
  readonly envExports: readonly string[];
  readonly additionalConfigObj: Record<string, unknown>;
  readonly cliArgs: readonly string[];
}

export interface KnobRecipePreset {
  readonly id: string;
  readonly titleZh: string;
  readonly subtitleZh: string;
  readonly tagZh: string;
  readonly context: KnobSandboxContext;
  readonly selections: KnobSelectionMap;
}

export const KNOB_GOAL_LABELS: Readonly<Record<KnobTuningGoal, string>> = {
  ttft: "压首字 TTFT",
  tpot: "降解码 TPOT",
  memory: "抠显存容量",
  comm: "稳 HCCL 通信",
  graph: "图编译与算子融合",
  pitfall: "避坑与废弃排雷",
};

export const DEFAULT_SANDBOX_CONTEXT: KnobSandboxContext = {
  version: "v0.30.0",
  soc: "A3",
  modelKind: "mla_moe",
  graphMode: "FULL_DECODE_ONLY",
  tpSize: 4,
  dpSize: 2,
  ppSize: 1,
  epEnabled: true,
  sleepMode: false,
  rforkEnabled: false,
  loraEnabled: false,
  pdRole: "none",
};

/**
 * Resolves the lifecycle badge of a knob for the selected target version.
 */
export function resolveKnobLifecycle(
  spec: Pick<AscendKnobSpec, "statusByVersion">,
  version: KnobVersionTarget = "v0.30.0",
): KnobLifecycleStatus {
  const current = spec.statusByVersion[version];
  if (current === "retired") return "retired-trap";
  if (spec.statusByVersion["v0.30.0"] === "absent" && spec.statusByVersion.main === "absent") {
    return "retired-trap";
  }
  if (spec.statusByVersion["v0.30.0"] === "absent" && spec.statusByVersion.main === "supported") {
    return "main-only";
  }
  if (spec.statusByVersion["v0.30.0"] === "supported" && spec.statusByVersion.main !== "supported") {
    return "v030-only";
  }
  return "active";
}
