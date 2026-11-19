import { domain1Rules, evaluateDomain1Rules } from "./domain1Parallelism";
import { domain2Rules, evaluateDomain2Rules, resolveDefaultBatchTokens } from "./domain2BatchTokens";
import { domain3Rules, evaluateDomain3Rules } from "./domain3Quantization";
import { domain4Rules, evaluateDomain4Rules } from "./domain4CpPd";
import {
  classifyEnvVar,
  DEPRECATED_FALLBACK_ENV_SPECS,
  DOCS_ONLY_UNKNOWN_ASCEND_VARS,
  DOCS_ONLY_UNKNOWN_HCCL_VARS,
  domain5Rules,
  evaluateDomain5Rules,
  KNOWN_READ_ENV_SPECS,
  RETIRED_ENV_SPECS,
} from "./domain5GraphSchedEnv";
import {
  calculateDpBufferSizeMiB,
  estimateHcclDomainMemory,
  HCCL_DEFAULT_BUFFER_SIZE_MIB,
  HCCL_DYNAMIC_EPLB_BUFFER_SIZE_MIB,
  HCCL_MIN_DP_BUFFER_SIZE_MIB,
  HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
  HCCL_SLEEP_LIFECYCLE_ANCHOR_BUFFER_SIZE_MIB,
  resolveReuseDomain,
} from "./hcclAccounting";
import {
  calculateMc2TokensCapacity,
  isFusedMc2SilentlyReset,
  isMegaMoeActive,
  selectMoeCommMethod,
} from "./moeComm";
import {
  type CouplingCheckInput,
  type CouplingEvaluationReport,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  parseSourceRef,
  type RuleDomain,
  type RuleMatch,
  type RuleVersion,
  SOURCE_REF_PATTERN,
  VERIFIED_COMMITS,
} from "./types";

export const ALL_COUPLING_RULES: readonly CouplingRule[] = [
  ...domain1Rules,
  ...domain2Rules,
  ...domain3Rules,
  ...domain4Rules,
  ...domain5Rules,
];

const RULES_BY_ID: Readonly<Record<string, CouplingRule>> = Object.fromEntries(
  ALL_COUPLING_RULES.map((rule) => [rule.id, rule]),
);

export function getCouplingRuleById(id: string): CouplingRule | null {
  if (!Object.hasOwn(RULES_BY_ID, id)) return null;
  return RULES_BY_ID[id] ?? null;
}

export function getCouplingRulesByDomain(domain: RuleDomain): readonly CouplingRule[] {
  return ALL_COUPLING_RULES.filter((rule) => rule.domain === domain);
}

export function evaluateCouplingRules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): CouplingEvaluationReport {
  const matches: RuleMatch[] = [];
  for (const rule of ALL_COUPLING_RULES) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }

  return {
    version,
    matches,
    errors: matches.filter((m) => m.judgment === "error"),
    silentRewrites: matches.filter((m) => m.judgment === "silent-rewrite"),
    warnings: matches.filter((m) => m.judgment === "warn"),
    unknowns: matches.filter((m) => m.judgment === "unknown"),
    hasBlockers: matches.some((m) => m.judgment === "error"),
  };
}

export type { BatchTokensResolution } from "./domain2BatchTokens";
export type {
  DeprecatedFallbackEnvSpec,
  EnvVarClassification,
  KnownEnvSpec,
  RetiredEnvSpec,
} from "./domain5GraphSchedEnv";
export type {
  HcclAccountingInput,
  HcclDomainEntry,
  HcclMemoryEstimate,
  ProfileRunOverlapInfo,
} from "./hcclAccounting";
export type { Mc2CapacityResult, MoeCommMethod, MoeCommSelectionResult } from "./moeComm";
export type * from "./types";
export {
  ALL_COUPLING_RULES as COUPLING_RULES_REGISTRY,
  calculateDpBufferSizeMiB,
  calculateMc2TokensCapacity,
  classifyEnvVar,
  DEFAULT_RULE_VERSION,
  DEPRECATED_FALLBACK_ENV_SPECS,
  DOCS_ONLY_UNKNOWN_ASCEND_VARS,
  DOCS_ONLY_UNKNOWN_HCCL_VARS,
  domain1Rules,
  domain2Rules,
  domain3Rules,
  domain4Rules,
  domain5Rules,
  estimateHcclDomainMemory,
  evaluateDomain1Rules,
  evaluateDomain2Rules,
  evaluateDomain3Rules,
  evaluateDomain4Rules,
  evaluateDomain5Rules,
  HCCL_DEFAULT_BUFFER_SIZE_MIB,
  HCCL_DYNAMIC_EPLB_BUFFER_SIZE_MIB,
  HCCL_MIN_DP_BUFFER_SIZE_MIB,
  HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
  HCCL_SLEEP_LIFECYCLE_ANCHOR_BUFFER_SIZE_MIB,
  isFusedMc2SilentlyReset,
  isMegaMoeActive,
  KNOWN_READ_ENV_SPECS,
  parseSourceRef,
  RETIRED_ENV_SPECS,
  resolveDefaultBatchTokens,
  resolveReuseDomain,
  SOURCE_REF_PATTERN,
  selectMoeCommMethod,
  VERIFIED_COMMITS,
};
