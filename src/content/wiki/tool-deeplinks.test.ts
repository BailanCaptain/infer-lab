/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { AICORE_LAB_WIKI_PAGE_IDS } from "../../sim/aicore/matmulRmsScenario";
import { DOCTOR_RULE_WIKI_LINKS, getAllDoctorWikiRefs } from "../../sim/doctor/configDoctor";
import {
  FULL_SINGLE_DOCTOR_PRESETS,
  MINIMAL_DOCTOR_PRESETS,
  PD_DOCTOR_PRESETS,
} from "../../sim/doctor/presets";
import {
  ASCEND_CALC_CARDS,
  evaluateDeployPlan,
  evaluateWave3ModelGate,
  WAVE4_DEMO_PRESETS,
} from "../../sim/modelspec/deployCalculator";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import { ALL_COUPLING_RULES } from "../../sim/rules";
import { TROUBLESHOOT_FIXTURES } from "../../sim/troubleshoot/fixtures";
import { analyzeTroubleshootInput } from "../../sim/troubleshoot/logAnalyzer";
import { TIMELINE_SCENARIOS } from "../../sim/troubleshoot/timelineSandbox";
import { createSlugger, headingSlug } from "./anchors";
import registryData from "./registry.json";
import { resolveCanonicalPageId } from "./schema";
import { CORE_26_IDS } from "./toc";
import {
  isRegisteredToolDeepLink,
  LEGACY_BASELINE_BADGE_TEXT,
  resolveToolDeepLink,
  runPdConfigDoctorWithLinks,
  runSingleConfigDoctorWithLinks,
  TOOL_DEEPLINK_MANIFEST,
  V030_VERIFIED_TAG,
} from "./toolDeeplinks";

interface RegistryPageRow {
  id: string;
  file: string;
  legacyIds?: string[] | undefined;
  verified?: string[] | undefined;
}

const REGISTRY_PAGES = registryData.pages as readonly RegistryPageRow[];
const REGISTRY_BY_ID = new Map(REGISTRY_PAGES.map((p) => [p.id, p]));
const WIKI_ROOT = resolve(process.cwd(), "wiki");

function extractMarkdownValidAnchors(fileRelPath: string): ReadonlySet<string> {
  const fullPath = resolve(WIKI_ROOT, fileRelPath);
  const raw = readFileSync(fullPath, "utf8");
  const parsed = matter(raw);
  const valid = new Set<string>();

  const slug = createSlugger();
  let inFence = false;
  let fenceChar = "";
  for (const line of parsed.content.split(/\r?\n/)) {
    const trimmed = line.trim();
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch?.[1]) {
      const ch = fenceMatch[1][0] ?? "";
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      continue;
    }
    if (inFence) continue;
    const hMatch = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (hMatch?.[1]) {
      // Strip inline markdown formatting markers while preserving plain text
      const plain = hMatch[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_~]/g, "");
      const id = slug(plain);
      if (id) valid.add(id);
    }
  }

  const legacyAnchors = parsed.data.legacyAnchors as Record<string, string> | undefined;
  if (legacyAnchors && typeof legacyAnchors === "object") {
    for (const [oldSlug, target] of Object.entries(legacyAnchors)) {
      if (oldSlug) valid.add(headingSlug(oldSlug));
      if (typeof target === "string" && target.trim().length > 0) {
        valid.add(headingSlug(target));
      }
    }
  }

  return valid;
}

describe("Honest Tool Deep-Link Manifest & Badge Gate", () => {
  it("100% of TOOL_DEEPLINK_MANIFEST entries resolve to existing canonical pages and on-disk markdown files", () => {
    expect(TOOL_DEEPLINK_MANIFEST.length).toBeGreaterThanOrEqual(45);

    for (const entry of TOOL_DEEPLINK_MANIFEST) {
      const canonical = resolveCanonicalPageId(REGISTRY_PAGES, entry.pageId);
      expect(canonical, `Manifest pageId "${entry.pageId}" must exist in registry.json`).toBeDefined();

      const resolved = resolveToolDeepLink(entry.pageId, {
        anchor: entry.anchor,
        label: entry.label,
      });
      expect(resolved.canonicalId).toBe(canonical);
      expect(resolved.href).toMatch(/^#\/wiki\/[a-z0-9-]+(?:#.+)?$/);
      expect(resolved.label.length).toBeGreaterThan(0);

      const pageRow = REGISTRY_BY_ID.get(resolved.canonicalId);
      expect(pageRow).toBeDefined();
      const absMd = resolve(WIKI_ROOT, pageRow!.file);
      expect(existsSync(absMd), `Markdown file missing on disk: ${absMd}`).toBe(true);
    }
  });

  it("validates every anchored manifest entry against real headings or frontmatter.legacyAnchors on disk", () => {
    const anchoredEntries = TOOL_DEEPLINK_MANIFEST.filter((e) => Boolean(e.anchor));
    expect(anchoredEntries.length).toBeGreaterThan(0);

    for (const entry of anchoredEntries) {
      const resolved = resolveToolDeepLink(entry.pageId, { anchor: entry.anchor });
      const pageRow = REGISTRY_BY_ID.get(resolved.canonicalId)!;
      const validAnchors = extractMarkdownValidAnchors(pageRow.file);
      const cleanAnchor = entry.anchor!.replace(/^#/, "").trim();
      expect(
        validAnchors.has(cleanAnchor),
        `Anchor "#${cleanAnchor}" not found in ${pageRow.file} (canonical: ${resolved.canonicalId})`,
      ).toBe(true);
    }
  });

  it("classifies all 26 Core-26 v0.30.0 pages as verified (isLegacyBaseline === false, badgeText === null)", () => {
    expect(CORE_26_IDS.length).toBe(26);
    for (const pageId of CORE_26_IDS) {
      expect(
        isRegisteredToolDeepLink(pageId),
        `Core-26 page "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      const resolved = resolveToolDeepLink(pageId);
      expect(resolved.isV030Verified, `Core-26 page "${pageId}" must include releases/v0.30.0`).toBe(true);
      expect(resolved.isLegacyBaseline).toBe(false);
      expect(resolved.badgeText).toBeNull();
    }
  });

  it("classifies Wave-4B upgraded v0.30.0 attention/memory & newly authored pages as verified (isLegacyBaseline === false)", () => {
    const wave4bVerifiedPages = [
      "mla",
      "sparse-attention",
      "linear-attention",
      "kv-cache-spec",
      "engram-conditional-memory",
      "moe-comm-dispatch",
      "epd-disaggregation",
      "model-runner-v2",
      "v030-release-baseline",
      "aisbench-and-evalscope",
      "msprobe-accuracy-debug",
      "cluster-serving",
    ] as const;

    for (const pageId of wave4bVerifiedPages) {
      expect(
        isRegisteredToolDeepLink(pageId),
        `Wave-4B page "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      const resolved = resolveToolDeepLink(pageId);
      expect(resolved.isV030Verified, `Wave-4B page "${pageId}" must include releases/v0.30.0`).toBe(true);
      expect(resolved.isLegacyBaseline).toBe(false);
      expect(resolved.badgeText).toBeNull();
    }
  });

  it("honestly marks un-upgraded Wave-4C / Exception-B legacy-baseline pages with '历史基线页（待更新）'", () => {
    const legacyPages = [
      "hccl-buffer",
      "pd-disaggregation",
      "mooncake-connector",
      "npugraph-ex",
      "acl-graph",
      "ascend-950-architecture",
      "device-memory",
    ] as const;

    for (const pageId of legacyPages) {
      expect(
        isRegisteredToolDeepLink(pageId),
        `Legacy page "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      const resolved = resolveToolDeepLink(pageId);
      expect(resolved.isV030Verified).toBe(false);
      expect(resolved.isLegacyBaseline).toBe(true);
      expect(resolved.badgeText).toBe(LEGACY_BASELINE_BADGE_TEXT);
      expect(resolved.badgeText).toBe("历史基线页（待更新）");
    }
  });

  it("throws on unknown page IDs instead of emitting broken links", () => {
    expect(() => resolveToolDeepLink("non-existent-wiki-page-xyz")).toThrow(/Unknown wiki page id/);
  });

  it("enforces every coupling rule and configDoctor deep-link is registered in TOOL_DEEPLINK_MANIFEST", () => {
    // 1. Every coupling rule in src/sim/rules/ has an explicit mapping in DOCTOR_RULE_WIKI_LINKS
    for (const rule of ALL_COUPLING_RULES) {
      const refs = DOCTOR_RULE_WIKI_LINKS[rule.id];
      expect(refs, `Rule "${rule.id}" is missing from DOCTOR_RULE_WIKI_LINKS`).toBeDefined();
      expect(refs!.length).toBeGreaterThan(0);
    }

    // 2. Every ref in DOCTOR_RULE_WIKI_LINKS is registered in TOOL_DEEPLINK_MANIFEST and resolves cleanly
    for (const ref of getAllDoctorWikiRefs()) {
      expect(
        isRegisteredToolDeepLink(ref.pageId, ref.anchor),
        `Doctor wiki ref "${ref.pageId}${ref.anchor ? `#${ref.anchor}` : ""}" must be registered in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      const resolved = resolveToolDeepLink(ref.pageId, { anchor: ref.anchor, label: ref.label });
      expect(resolved.href).toContain(`#/wiki/${resolved.canonicalId}`);
    }

    // 3. Every deep-link attached at runtime across all presets resolves cleanly
    for (const preset of [...MINIMAL_DOCTOR_PRESETS, ...FULL_SINGLE_DOCTOR_PRESETS]) {
      const report = runSingleConfigDoctorWithLinks(preset.command, {
        mode: preset.mode,
        hardwareFamily: preset.hardwareFamily,
        version: preset.version,
      });
      for (const finding of report.findings) {
        expect(finding.deepLinks.length).toBeGreaterThan(0);
        for (const link of finding.deepLinks) {
          expect(isRegisteredToolDeepLink(link.canonicalId)).toBe(true);
        }
      }
    }

    for (const preset of PD_DOCTOR_PRESETS) {
      const report = runPdConfigDoctorWithLinks(preset.prefillCommand, preset.decodeCommand, {
        hardwareFamily: preset.hardwareFamily,
        decodeHardwareFamily: preset.decodeHardwareFamily,
        version: preset.version,
      });
      for (const finding of report.allFindings) {
        expect(finding.deepLinks.length).toBeGreaterThan(0);
        for (const link of finding.deepLinks) {
          expect(isRegisteredToolDeepLink(link.canonicalId)).toBe(true);
        }
      }
    }
  });

  it("enforces cross-engine contract: deployCalculator cards, MODEL_PRESETS relatedWikiIds, and Wave-4 gate targets are 100% registered", () => {
    // 1. Every wiki:* source on ASCEND_CALC_CARDS resolves in TOOL_DEEPLINK_MANIFEST
    expect(ASCEND_CALC_CARDS.length).toBeGreaterThanOrEqual(5);
    for (const card of ASCEND_CALC_CARDS) {
      for (const src of card.sources) {
        if (!src.startsWith("wiki:")) continue;
        const pageId = src.slice("wiki:".length);
        expect(
          isRegisteredToolDeepLink(pageId),
          `Card "${card.id}" wiki source "${pageId}" must be registered in TOOL_DEEPLINK_MANIFEST`,
        ).toBe(true);
        const resolved = resolveToolDeepLink(pageId);
        expect(resolved.href).toBe(`#/wiki/${resolved.canonicalId}`);
      }
    }

    // 2. Every MODEL_PRESETS × ASCEND_CALC_CARDS plan (+ branch-covering variants) emits only registered relatedWikiIds
    for (const preset of MODEL_PRESETS) {
      for (const card of ASCEND_CALC_CARDS) {
        const plan = evaluateDeployPlan({ model: preset.id, cardId: card.id });
        expect(plan.fourQuestions.q4Recommendation.relatedWikiIds.length).toBeGreaterThan(0);
        for (const pageId of plan.fourQuestions.q4Recommendation.relatedWikiIds) {
          expect(
            isRegisteredToolDeepLink(pageId),
            `deployCalculator relatedWikiId "${pageId}" (${preset.id} × ${card.id}) must be registered in TOOL_DEEPLINK_MANIFEST`,
          ).toBe(true);
          const resolved = resolveToolDeepLink(pageId);
          expect(resolved.href).toBe(`#/wiki/${resolved.canonicalId}`);
        }
      }
    }

    // Exercise extra branches (FP8, C8, MXFP8, TP/PP/DP/EP) to cover all q4Recommendation relatedWikiIds
    const branchPlans = [
      evaluateDeployPlan({
        model: "qwen3-8b",
        cardId: "a2-64g",
        weightPrecision: "fp8_block",
        kvCacheDtype: "int8",
        tpSize: 2,
        ppSize: 2,
        dpSize: 2,
      }),
      evaluateDeployPlan({
        model: "qwen3-30b-a3b",
        cardId: "950dt-128g",
        weightPrecision: "fp8_block",
        kvCacheDtype: "mxfp8",
        tpSize: 4,
        dpSize: 2,
        enableEp: true,
      }),
    ];
    for (const plan of branchPlans) {
      for (const pageId of plan.fourQuestions.q4Recommendation.relatedWikiIds) {
        expect(isRegisteredToolDeepLink(pageId)).toBe(true);
        expect(resolveToolDeepLink(pageId).href).toMatch(/^#\/wiki\/[a-z0-9-]+$/);
      }
    }

    // 3. Wave-4 unlocked MLA / CSA2 / KDA / Engram presets parse cleanly and emit 100% registered relatedWikiIds
    expect(WAVE4_DEMO_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const demo of WAVE4_DEMO_PRESETS) {
      const gate = evaluateWave3ModelGate(demo.config);
      expect(gate.ok, `Wave-4 preset ${demo.id} must parse cleanly`).toBe(true);
      if (!gate.ok) continue;
      expect(gate.supportedInWave3, `Wave-4 preset ${demo.id} must be unlocked in Wave 4`).toBe(true);
      if (!gate.supportedInWave3) continue;
      expect(gate.wave4Features).toEqual(expect.arrayContaining([...demo.features]));

      const plan = evaluateDeployPlan({
        model: gate.spec,
        cardId: "950dt-128g",
        tpSize: demo.recommendedTp,
        ppSize: demo.recommendedPp,
        dpSize: demo.recommendedDp,
        dcpSize: 2,
        enableEp: demo.recommendedEnableEp,
        weightPrecision: demo.recommendedPrecision,
      });
      expect(plan.wave4Arch.activeFeatures).toEqual(expect.arrayContaining([...demo.features]));
      expect(plan.fourQuestions.q4Recommendation.relatedWikiIds.length).toBeGreaterThan(0);
      for (const pageId of plan.fourQuestions.q4Recommendation.relatedWikiIds) {
        expect(
          isRegisteredToolDeepLink(pageId),
          `Wave-4 preset ${demo.id} relatedWikiId "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
        ).toBe(true);
        const resolved = resolveToolDeepLink(pageId);
        expect(resolved.href).toBe(`#/wiki/${resolved.canonicalId}`);
      }
    }
  });

  it("enforces Wave-4 cross-engine contract: troubleshoot-workbench, aicore-lab, and troubleshooting/rfork manifest pages are 100% registered", () => {
    // 1. Newly registered Wave-4 troubleshooting & RFork pages resolve cleanly and dynamically match registry verified status.
    const wave4ManifestPages = [
      "inference-troubleshooting",
      "inference-performance-troubleshooting",
      "inference-correctness-troubleshooting",
      "inference-benchmarking",
      "request-call-chain",
      "rfork",
    ] as const;

    for (const pageId of wave4ManifestPages) {
      expect(
        isRegisteredToolDeepLink(pageId),
        `Wave-4 page "${pageId}" must be registered in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      const resolved = resolveToolDeepLink(pageId);
      expect(resolved.href).toBe(`#/wiki/${resolved.canonicalId}`);
      const pageRow = REGISTRY_BY_ID.get(resolved.canonicalId);
      expect(pageRow).toBeDefined();
      const expectedV030 = (pageRow!.verified ?? []).includes(V030_VERIFIED_TAG);
      expect(resolved.isV030Verified).toBe(expectedV030);
      expect(resolved.isLegacyBaseline).toBe(!expectedV030);
      expect(resolved.badgeText).toBe(expectedV030 ? null : LEGACY_BASELINE_BADGE_TEXT);
    }

    // 2. Every wikiPageId emitted by troubleshoot Panel A (all fixtures) and Panel B (all 6 scenarios) is registered.
    expect(TROUBLESHOOT_FIXTURES.length).toBeGreaterThanOrEqual(8);
    for (const fixture of TROUBLESHOOT_FIXTURES) {
      const report = analyzeTroubleshootInput(fixture.content);
      expect(report.findings.length).toBeGreaterThan(0);
      for (const finding of report.findings) {
        expect(finding.wikiPageIds.length).toBeGreaterThan(0);
        for (const pageId of finding.wikiPageIds) {
          expect(
            isRegisteredToolDeepLink(pageId),
            `Troubleshoot fixture "${fixture.id}" rule "${finding.ruleId}" wikiPageId "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
          ).toBe(true);
          expect(resolveToolDeepLink(pageId).href).toMatch(/^#\/wiki\/[a-z0-9-]+$/);
        }
      }
    }

    expect(TIMELINE_SCENARIOS.length).toBe(6);
    for (const scenario of TIMELINE_SCENARIOS) {
      expect(scenario.wikiPageIds.length).toBeGreaterThan(0);
      for (const pageId of scenario.wikiPageIds) {
        expect(
          isRegisteredToolDeepLink(pageId),
          `Timeline scenario "${scenario.id}" wikiPageId "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
        ).toBe(true);
        expect(resolveToolDeepLink(pageId).href).toMatch(/^#\/wiki\/[a-z0-9-]+$/);
      }
    }

    // 3. Every wikiPageId referenced by aicore-lab is registered.
    expect(AICORE_LAB_WIKI_PAGE_IDS.length).toBeGreaterThanOrEqual(5);
    for (const pageId of AICORE_LAB_WIKI_PAGE_IDS) {
      expect(
        isRegisteredToolDeepLink(pageId),
        `AiCoreLab wikiPageId "${pageId}" must be in TOOL_DEEPLINK_MANIFEST`,
      ).toBe(true);
      expect(resolveToolDeepLink(pageId).href).toMatch(/^#\/wiki\/[a-z0-9-]+$/);
    }
  });
});
