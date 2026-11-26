import {
  type PdConfigDoctorReport,
  type PdDoctorOptions,
  runPdConfigDoctor,
  runSingleConfigDoctor,
  type SingleConfigDoctorReport,
  type SingleDoctorOptions,
} from "../../sim/doctor/configDoctor";
import { getReaderState } from "./index";
import { type RegistryEntry, resolveCanonicalPageId } from "./schema";

export const LEGACY_BASELINE_BADGE_TEXT = "历史基线页（待更新）" as const;
export const V030_VERIFIED_TAG = "releases/v0.30.0" as const;

export type ToolDeepLinkOwner =
  | "deploy-calculator"
  | "config-doctor"
  | "troubleshoot-workbench"
  | "aicore-lab"
  | "shared";

export interface ToolDeepLinkManifestEntry {
  pageId: string;
  anchor?: string | undefined;
  label?: string | undefined;
  tool: ToolDeepLinkOwner;
}

export interface ResolvedToolDeepLink {
  pageId: string;
  canonicalId: string;
  href: string;
  label: string;
  verified: readonly string[];
  isV030Verified: boolean;
  isLegacyBaseline: boolean;
  badgeText: typeof LEGACY_BASELINE_BADGE_TEXT | null;
}

let cachedPagesRef: readonly RegistryEntry[] | null = null;
let cachedRegistryById: ReadonlyMap<string, RegistryEntry> = new Map();

function getRegistryPages(): readonly RegistryEntry[] {
  return getReaderState().pages;
}

function getRegistryById(): ReadonlyMap<string, RegistryEntry> {
  const pages = getRegistryPages();
  if (pages !== cachedPagesRef) {
    cachedPagesRef = pages;
    cachedRegistryById = new Map(pages.map((page) => [page.id, page]));
  }
  return cachedRegistryById;
}

/**
 * Single-source manifest of every Wiki deep-link emitted by Tool ① (`deploy-calculator`)
 * and Tool ② (`config-doctor`).
 *
 * Upgraded `v0.30.0` Core-26 pages resolve `isLegacyBaseline: false, badgeText: null`.
 * Un-upgraded Wave-4 / legacy-baseline pages resolve `isLegacyBaseline: true, badgeText: "历史基线页（待更新）"`.
 */
export const TOOL_DEEPLINK_MANIFEST: readonly ToolDeepLinkManifestEntry[] = [
  // ---- Upgraded v0.30.0 Core-26 pages ----
  { pageId: "request-overview", tool: "shared" },
  { pageId: "ascend-model-onboarding", tool: "shared" },
  { pageId: "hf-model-anatomy", tool: "shared" },
  { pageId: "quantization", tool: "shared" },
  { pageId: "ascend-env-and-serve", tool: "config-doctor" },
  {
    pageId: "ascend-env-and-serve",
    anchor: "对照源码",
    label: "环境与起服务（对照源码）",
    tool: "config-doctor",
  },
  { pageId: "continuous-batching", tool: "shared" },
  { pageId: "paged-attention", tool: "shared" },
  { pageId: "roofline-and-metrics", tool: "deploy-calculator" },
  { pageId: "ascend-flash-attention", tool: "shared" },
  { pageId: "core-cli-params", tool: "shared" },
  {
    pageId: "core-cli-params",
    anchor: "对照源码",
    label: "核心参数全分支调优（对照源码）",
    tool: "config-doctor",
  },
  { pageId: "token", tool: "deploy-calculator" },
  { pageId: "gqa", tool: "shared" },
  { pageId: "prefill", tool: "deploy-calculator" },
  { pageId: "kv-cache", tool: "shared" },
  { pageId: "hardware-devices", tool: "shared" },
  { pageId: "low-precision-formats", tool: "shared" },
  { pageId: "npu-worker-lifecycle", tool: "shared" },
  { pageId: "kv-cache-memory-profiling", tool: "shared" },
  { pageId: "attention-qkv", tool: "deploy-calculator" },
  { pageId: "chunked-prefill", tool: "shared" },
  { pageId: "ai-core", tool: "deploy-calculator" },
  { pageId: "collective-communication", tool: "shared" },
  { pageId: "tensor-parallel", tool: "shared" },
  { pageId: "pipeline-parallel", tool: "shared" },
  { pageId: "data-parallel", tool: "shared" },
  { pageId: "expert-parallel", tool: "shared" },

  // ---- Wave-4B upgraded v0.30.0 attention/memory & newly authored pages ----
  { pageId: "kv-cache-spec", tool: "deploy-calculator" },
  { pageId: "mla", tool: "deploy-calculator" },
  { pageId: "linear-attention", label: "KDA（线性注意力）", tool: "deploy-calculator" },
  { pageId: "sparse-attention", tool: "shared" },
  { pageId: "engram-conditional-memory", tool: "deploy-calculator" },
  { pageId: "moe-comm-dispatch", tool: "shared" },
  { pageId: "epd-disaggregation", tool: "config-doctor" },
  { pageId: "model-runner-v2", tool: "config-doctor" },
  { pageId: "v030-release-baseline", tool: "config-doctor" },
  { pageId: "aisbench-and-evalscope", tool: "troubleshoot-workbench" },
  { pageId: "msprobe-accuracy-debug", tool: "troubleshoot-workbench" },
  { pageId: "cluster-serving", tool: "config-doctor" },

  // ---- Wave-4C-1 upgraded v0.30.0 & Exception-B verified pages ----
  { pageId: "hccl-buffer", tool: "shared" },
  { pageId: "pd-disaggregation", tool: "config-doctor" },
  { pageId: "mooncake-connector", tool: "config-doctor" },
  { pageId: "npugraph-ex", tool: "config-doctor" },
  { pageId: "acl-graph", tool: "shared" },
  { pageId: "attention-backend-family", tool: "shared" },
  { pageId: "ascend-950-architecture", tool: "shared" },
  { pageId: "device-memory", tool: "deploy-calculator" },
  { pageId: "sequence-parallel", tool: "config-doctor" },
  { pageId: "fine-grained-tp", tool: "config-doctor" },
  { pageId: "dynamic-chunked-pp", tool: "config-doctor" },
  { pageId: "context-parallel", tool: "config-doctor" },
  { pageId: "recompute-scheduler", tool: "config-doctor" },
  { pageId: "short-request-first", tool: "config-doctor" },
  { pageId: "batch-job-aware-scheduler", tool: "config-doctor" },
  { pageId: "dyntra-lb", tool: "config-doctor" },
  { pageId: "vllm-ascend-for-rl", tool: "config-doctor" },
  { pageId: "kv-cache-quantization", tool: "shared" },
  { pageId: "kv-cache-sparse-offload", tool: "config-doctor" },
  { pageId: "ascend-config-system", tool: "config-doctor" },
  { pageId: "cann-hccl", tool: "shared" },
  { pageId: "tensor-layout", tool: "shared" },
  { pageId: "moe", tool: "deploy-calculator" },
  { pageId: "block-table", tool: "deploy-calculator" },
  { pageId: "quantization-methods", tool: "deploy-calculator" },
  { pageId: "balance-scheduling", tool: "config-doctor" },
  { pageId: "swa-bounded-replay", tool: "deploy-calculator" },
  { pageId: "kvpp", tool: "config-doctor" },

  // ---- Wave-4 Troubleshooting & RFork deep-links ----
  { pageId: "inference-troubleshooting", tool: "troubleshoot-workbench" },
  { pageId: "inference-performance-troubleshooting", tool: "troubleshoot-workbench" },
  { pageId: "inference-correctness-troubleshooting", tool: "troubleshoot-workbench" },
  { pageId: "inference-benchmarking", tool: "troubleshoot-workbench" },
  { pageId: "request-call-chain", tool: "troubleshoot-workbench" },
  { pageId: "sleep-mode", tool: "troubleshoot-workbench" },
  { pageId: "ascend-910b3-measured-baseline", tool: "troubleshoot-workbench" },
  { pageId: "rfork", tool: "shared" },
];

function normalizeAnchor(anchor: string | undefined): string {
  if (!anchor) return "";
  return anchor.replace(/^#/, "").trim();
}

export const TOOL_DEEPLINK_PAGE_ID_SET: ReadonlySet<string> = new Set(
  TOOL_DEEPLINK_MANIFEST.map(
    (entry) => resolveCanonicalPageId(getRegistryPages(), entry.pageId) ?? entry.pageId,
  ),
);

export function isRegisteredToolDeepLink(pageId: string, anchor?: string): boolean {
  const pages = getRegistryPages();
  const canonical = resolveCanonicalPageId(pages, pageId) ?? pageId;
  const cleanAnchor = normalizeAnchor(anchor);
  if (!cleanAnchor) {
    return TOOL_DEEPLINK_PAGE_ID_SET.has(canonical);
  }
  return TOOL_DEEPLINK_MANIFEST.some((entry) => {
    const entryCanonical = resolveCanonicalPageId(pages, entry.pageId) ?? entry.pageId;
    return entryCanonical === canonical && normalizeAnchor(entry.anchor) === cleanAnchor;
  });
}

export function resolveToolDeepLink(
  pageId: string,
  opts?: { anchor?: string | undefined; label?: string | undefined },
): ResolvedToolDeepLink {
  const pages = getRegistryPages();
  const canonicalId = resolveCanonicalPageId(pages, pageId);
  if (!canonicalId) {
    throw new Error(`Unknown wiki page id in tool deep-link: "${pageId}"`);
  }
  const entry = getRegistryById().get(canonicalId);
  if (!entry) {
    throw new Error(`Resolved wiki page "${canonicalId}" missing from registry.json`);
  }

  const cleanAnchor = normalizeAnchor(opts?.anchor);
  const href = cleanAnchor ? `#/wiki/${canonicalId}#${cleanAnchor}` : `#/wiki/${canonicalId}`;
  const verified = entry.verified ?? [];
  const isRforkMainVerified =
    (canonicalId === "rfork" || canonicalId.startsWith("rfork-")) && verified.includes("main");
  const isV030Verified = verified.includes(V030_VERIFIED_TAG) || isRforkMainVerified;
  const isLegacyBaseline = !isV030Verified;
  const badgeText = isLegacyBaseline ? LEGACY_BASELINE_BADGE_TEXT : null;

  const manifestEntry = TOOL_DEEPLINK_MANIFEST.find((m) => {
    const mCanonical = resolveCanonicalPageId(pages, m.pageId) ?? m.pageId;
    return mCanonical === canonicalId && normalizeAnchor(m.anchor) === cleanAnchor;
  });
  const label = opts?.label?.trim() || manifestEntry?.label?.trim() || entry.title;

  return {
    pageId,
    canonicalId,
    href,
    label,
    verified,
    isV030Verified,
    isLegacyBaseline,
    badgeText,
  };
}

export function resolveToolDeepLinks(
  refs: readonly { pageId: string; anchor?: string | undefined; label?: string | undefined }[],
): ResolvedToolDeepLink[] {
  const seen = new Set<string>();
  const out: ResolvedToolDeepLink[] = [];
  for (const ref of refs) {
    const resolved = resolveToolDeepLink(ref.pageId, { anchor: ref.anchor, label: ref.label });
    if (seen.has(resolved.href)) continue;
    seen.add(resolved.href);
    out.push(resolved);
  }
  return out;
}

export function runSingleConfigDoctorWithLinks(
  commandText: string,
  opts: Omit<SingleDoctorOptions, "resolveDeepLink">,
): SingleConfigDoctorReport {
  return runSingleConfigDoctor(commandText, {
    ...opts,
    resolveDeepLink: resolveToolDeepLink,
  });
}

export function runPdConfigDoctorWithLinks(
  prefillCommandText: string,
  decodeCommandText: string,
  opts: Omit<PdDoctorOptions, "resolveDeepLink">,
): PdConfigDoctorReport {
  return runPdConfigDoctor(prefillCommandText, decodeCommandText, {
    ...opts,
    resolveDeepLink: resolveToolDeepLink,
  });
}
