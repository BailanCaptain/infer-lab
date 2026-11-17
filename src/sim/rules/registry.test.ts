import { describe, expect, it } from "vitest";
import {
  ALL_COUPLING_RULES,
  calculateMc2TokensCapacity,
  classifyEnvVar,
  estimateHcclDomainMemory,
  evaluateCouplingRules,
  getCouplingRuleById,
  getCouplingRulesByDomain,
  KNOWN_READ_ENV_SPECS,
  parseSourceRef,
  resolveDefaultBatchTokens,
  SOURCE_REF_PATTERN,
  selectMoeCommMethod,
  VERIFIED_COMMITS,
} from "./index";
import type { RuleDomain, RuleJudgment, RuleVersion } from "./types";

const VALID_DOMAINS: ReadonlySet<RuleDomain> = new Set([
  "parallelism-moe",
  "batch-tokens",
  "quantization",
  "cp-pd",
  "graph-sched-env",
]);

const VALID_JUDGMENTS: ReadonlySet<RuleJudgment> = new Set(["error", "silent-rewrite", "warn", "unknown"]);

const VALID_VERSIONS: ReadonlySet<RuleVersion> = new Set(["v0.30.0", "main", "rfork"]);

describe("Coupling Rules Registry & Schema Integrity", () => {
  it("every rule has unique id, valid metadata, and sources matching SOURCE_REF_PATTERN", () => {
    expect(ALL_COUPLING_RULES.length).toBeGreaterThanOrEqual(35);

    const seenIds = new Set<string>();
    for (const rule of ALL_COUPLING_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(seenIds.has(rule.id)).toBe(false);
      seenIds.add(rule.id);

      expect(VALID_DOMAINS.has(rule.domain)).toBe(true);
      expect(VALID_JUDGMENTS.has(rule.judgment)).toBe(true);
      expect(rule.evidenceLevel === "C" || rule.evidenceLevel === "I").toBe(true);
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.rationale.length).toBeGreaterThan(0);

      expect(rule.versions.length).toBeGreaterThan(0);
      for (const v of rule.versions) {
        expect(VALID_VERSIONS.has(v)).toBe(true);
      }

      expect(rule.sources.length).toBeGreaterThan(0);
      for (const src of rule.sources) {
        expect(src).toMatch(SOURCE_REF_PATTERN);
        const parsed = parseSourceRef(src);
        expect(parsed).not.toBeNull();
        expect(["vllm", "vllm-ascend", "rfork"]).toContain(parsed?.repo);
      }
    }
  });

  it("covers all 5 required domains and supports lookup helpers", () => {
    for (const domain of VALID_DOMAINS) {
      const rules = getCouplingRulesByDomain(domain);
      expect(rules.length).toBeGreaterThan(0);
    }

    expect(getCouplingRuleById("d1-roce-pp-dp-moe-exclusion")?.domain).toBe("parallelism-moe");
    expect(getCouplingRuleById("non-existent-rule-id")).toBeNull();
    expect(getCouplingRuleById("toString")).toBeNull();
  });

  it("marks runtime-dependent defaults and unverified CANN env vars with evidenceLevel I", () => {
    expect(getCouplingRuleById("d2-default-batch-tokens-early-fallback")?.evidenceLevel).toBe("I");
    expect(getCouplingRuleById("d5-cann-env-var-classification")?.evidenceLevel).toBe("I");
  });

  it("aggregates matches into errors, silentRewrites, warnings, unknowns, and hasBlockers", () => {
    const report = evaluateCouplingRules(
      {
        hardwareFamily: "A3",
        tpSize: 1,
        ppSize: 1,
        dpSize: 1,
        pcpSize: 2,
        useV2ModelRunner: false,
        cacheDtype: "mxfp8",
        blockSize: 128,
        userSpecifiedBlockSize: false,
        envVars: { HCCL_BUFFSIZE_EP: "2048" },
      },
      "v0.30.0",
    );

    expect(report.version).toBe("v0.30.0");
    expect(report.hasBlockers).toBe(true);
    expect(report.errors.some((m) => m.ruleId === "d4-pcp-requires-mrv2")).toBe(true);
    expect(report.silentRewrites.some((m) => m.ruleId === "d3-mxfp8-c8-kv-block-size")).toBe(true);
    expect(report.warnings.some((m) => m.ruleId === "d2-default-batch-tokens-early-fallback")).toBe(true);
    expect(report.unknowns.some((m) => m.ruleId === "d5-cann-env-var-classification")).toBe(true);
  });

  it("validates dynamic sources across v0.30.0, main, and rfork for all helpers and KNOWN_READ_ENV_SPECS", () => {
    const allowedCommitsByRepo: Record<string, ReadonlySet<string>> = {
      vllm: new Set([
        VERIFIED_COMMITS.vllmV030,
        VERIFIED_COMMITS.vllmMainVerified,
        VERIFIED_COMMITS.vllmMainFetched,
      ]),
      "vllm-ascend": new Set([VERIFIED_COMMITS.vllmAscendV030, VERIFIED_COMMITS.vllmAscendMain]),
      rfork: new Set([VERIFIED_COMMITS.rforkMain]),
    };

    const assertValidSources = (sources: readonly string[], version: RuleVersion): void => {
      expect(sources.length).toBeGreaterThan(0);
      for (const src of sources) {
        expect(src).toMatch(SOURCE_REF_PATTERN);
        const parsed = parseSourceRef(src);
        expect(parsed).not.toBeNull();
        expect(["vllm", "vllm-ascend", "rfork"]).toContain(parsed?.repo);
        if (parsed) {
          expect(allowedCommitsByRepo[parsed.repo]?.has(parsed.commit)).toBe(true);
        }
        if (version === "rfork") {
          expect(src.startsWith(`vllm-ascend@${VERIFIED_COMMITS.rforkMain}`)).toBe(false);
        }
      }
    };

    for (const version of ["v0.30.0", "main", "rfork"] as const) {
      const batch = resolveDefaultBatchTokens({}, version);
      assertValidSources(batch.sources, version);
      if (version === "rfork") {
        expect(batch.sources.some((s) => s.startsWith(`rfork@${VERIFIED_COMMITS.rforkMain}:`))).toBe(true);
      }

      const cap = calculateMc2TokensCapacity(
        { hardwareFamily: "A3", isMoe: true, enableExpertParallel: true, tpSize: 8 },
        version,
      );
      assertValidSources(cap.sources, version);

      const moeInputs = [
        { isMoe: false },
        { isMoe: true, enableExpertParallel: false },
        { isMoe: true, enableExpertParallel: true, isLoraEnabled: true, tpSize: 4, dpSize: 2 },
        { hardwareFamily: "310P" as const, isMoe: true, enableExpertParallel: true, tpSize: 8, dpSize: 2 },
        {
          hardwareFamily: "A2" as const,
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 8,
          dpSize: 2,
          numExperts: 513,
        },
        {
          hardwareFamily: "A3" as const,
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 8,
          dpSize: 2,
          enableFusedMc2: 1 as const,
        },
        {
          hardwareFamily: "A5" as const,
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 4,
          dpSize: 2,
          enableFusedMc2: 1 as const,
        },
        {
          hardwareFamily: "A5" as const,
          isMoe: true,
          enableExpertParallel: true,
          tpSize: 4,
          dpSize: 2,
          numTokens: 99999,
        },
      ];
      for (const input of moeInputs) {
        assertValidSources(selectMoeCommMethod(input, version).sources, version);
      }

      const hccl = estimateHcclDomainMemory(
        {
          tpSize: 4,
          ppSize: 2,
          dpSize: 2,
          pcpSize: 2,
          dcpSize: 2,
          kvppSize: 8,
          isMoe: true,
          engramEnabled: true,
          etpSize: 2,
          enableEplb: true,
          dynamicEplb: true,
          oprojTensorParallelSize: 2,
          mlpTensorParallelSize: 2,
          qkvIprojTensorParallelSize: 2,
          sleepModeExtraCleanup: true,
          netloaderEnabled: true,
          hasInternalDpGroups: true,
          kvRole: "kv_producer",
          pdHeadRatio: 2,
        },
        version,
      );
      for (const g of hccl.logicalGroups) {
        assertValidSources([g.source], version);
      }
      assertValidSources(hccl.profileRunOverlap.anchors, version);

      for (const envName of Object.keys(KNOWN_READ_ENV_SPECS)) {
        assertValidSources(classifyEnvVar(envName, version).sources, version);
      }
      assertValidSources(classifyEnvVar("HCCL_BUFFSIZE_EP", version).sources, version);
      assertValidSources(classifyEnvVar("ASCEND_CUSTOM_UNVERIFIED", version).sources, version);
    }
  });
});
