import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, toNamespacedPath } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveParamDisplayTitle } from "../../src/content/wiki/param-display";
import {
  buildIndex,
  deserializeSearchIndex,
  retrieve,
  serializeSearchIndex,
} from "../../src/content/wiki/retrieve";
import { registrySchema } from "../../src/content/wiki/schema";
import { createCachedAgentWikiLoader, loadAgentWiki } from "./agent-access";
import { localFixVersions, repoGitStamp } from "./chat-trace";
import { loadPages } from "./pages";
import {
  computeDistillContentSha256,
  computeDistillInputSha256,
  computeRawSha256,
  DISTILL_SYSTEM_PROMPT_SHA256,
  evaluateAuditGate,
  extractFallbackVerbatimRootLine,
  hasNonProseSourceOccurrence,
  inferEcosystem,
  isDocsOnlyDiffSnippet,
  isProseSummaryNotRuntimeLog,
  isSingleLineInField,
  isTitleLeak,
  isValidForensicChain,
  loadRawCorpusSnapshot,
  partitionItemProvenance,
  sameFilePath,
  verifyDistilledPayload,
} from "./verify-distilled-ascend";

const evalCaseSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum([
      "error-trace",
      "exact-param",
      "exact-concept",
      "arch-deploy",
      "colloquial",
      "negative",
    ]),
    query: z.string().min(1),
    expectedTop1: z.string().min(1).optional(),
    expectedAnyTop3: z.array(z.string().min(1)).min(1).optional(),
    expectEmpty: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.expectEmpty) {
      if (val.category !== "negative") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.id}: expectEmpty cases must use category="negative"`,
        });
      }
      if (val.expectedTop1 || val.expectedAnyTop3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.id}: negative cases cannot declare expectedTop1/expectedAnyTop3`,
        });
      }
    } else if (!val.expectedAnyTop3 || val.expectedAnyTop3.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${val.id}: every positive eval case must declare non-empty expectedAnyTop3`,
      });
    }
  });

const evalSuiteSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  cases: z.array(evalCaseSchema).min(189),
});

const REQUIRED_EXACT_TOP1_CASE_IDS = [
  // All 40 exact Top-1 cases MUST remain present AND declare expectedTop1 (prevents silent replacement or stripping!)
  "err-ei0006-exact",
  "param-shared-engram",
  "param-quantized-allreduce",
  "param-multistream-engram",
  "param-kv-pool-range-debug",
  "param-runtime-config",
  "param-runtime-config-hot-reload",
  "param-megamoe-shared-expert",
  "param-gdn-prefill-checkpoints",
  "param-enable-fused-mc2-3",
  "param-sfa-dcp-tmajor",
  "param-weight-prefetch",
  "param-ascend-store-connector",
  "param-c8-reshape-optim",
  "param-enable-super-kernel",
  "param-combine-quant-mode",
  "param-use-layerwise",
  "param-hccl-buffsize",
  "concept-paged-attention",
  "concept-chunked-prefill",
  "concept-prefix-caching",
  "hccl-ifname-exact",
  "hccl-if-ip-exact",
  "compile-npugraph-ex-underscore-exact",
  "compile-torchair-exact",
  "compile-fake-impl-exact",
  "moe-distribute-dispatch-exact",
  "moe-distribute-combine-exact",
  "moe-dispatch-ffn-combine-exact",
  "quant-modelslim-desc-exact",
  "cann-davinci-manager-exact",
  "cann-libascend-hal-exact",
  "cann-drv-get-dev-info-exact",
  "cann-507008-exact",
  "param-enable-fused-mc2-exact",
  "param-weight-nz-mode-exact",
  "param-enable-npugraph-ex-exact",
  "param-enable-cpu-binding-exact",
  "body-ai-core-cumsum-group-list",
  "body-ai-core-swiglu-quant-single-tensor",
] as const;

const REQUIRED_CRITICAL_CASE_IDS = [
  ...REQUIRED_EXACT_TOP1_CASE_IDS,
  // Key boundary, negative-control, and xhigh corpus-backfeed anchors
  "col-310p-bf16-and-vocab-parallel-boundary",
  "err-cann-smmu-retcode-0x26",
  "col-fa3-mixed-batch-crash",
  "col-dcp-block-table-overflow",
  "col-sleep-wakeup-moe-transpose",
  "neg-adj-code-507036",
  "neg-adj-code-ez3004",
  "neg-adj-code-161999",
  "neg-adj-code-ei0008",
  "xhigh-err00100-aclgraph-capture-contrast",
  "xhigh-err00100-aclnn-broadcast-contrast",
  "xhigh-207001-oom-stale-lasterr",
  "xhigh-e19999-mooncake-hcomm-reg",
  "xhigh-err03005-torchair-scope",
  "xhigh-roce-ibv-post-send-wqe",
] as const;

function resolveLiveRevision(root: string, registryRaw: string): string {
  let gitHead = "";
  try {
    gitHead = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    gitHead = "no-git";
  }
  return createHash("sha256").update(`${gitHead}\n${registryRaw}`, "utf8").digest("hex");
}

describe("engineering-eval-suite（204+ 页真实知识库工程检索、反退化与负例基准）", () => {
  const root = process.cwd();
  const registryRaw = readFileSync(join(root, "src/content/wiki/registry.json"), "utf8");
  const registry = registrySchema.parse(JSON.parse(registryRaw));
  const loadedDisk = loadPages(join(root, "wiki"));
  const bodyByFile = new Map(loadedDisk.pages.map((p) => [p.file, p.body.trim()]));
  const pages = registry.pages.map((page) => {
    const body = bodyByFile.get(page.file) ?? "";
    const derived = deriveParamDisplayTitle(page, body);
    return {
      ...page,
      ...(derived !== page.title ? { displayTitle: derived } : {}),
      text: body,
    };
  });
  const liveRevision = resolveLiveRevision(root, registryRaw);
  const fullIndex = buildIndex(pages);
  const browserIndex = deserializeSearchIndex(serializeSearchIndex(fullIndex, liveRevision));
  const agentWiki = loadAgentWiki(root);

  const suite = evalSuiteSchema.parse(
    JSON.parse(readFileSync(new URL("./engineering-eval-suite.json", import.meta.url), "utf8")),
  );

  it("真实 registry.json 与磁盘正文同步（204+ 篇含 49+ 篇正式参数页），基准集含 189+ 题（170+ 正例、19+ 负例、无重复 ID/query、必选关键用例零缺失）", () => {
    expect(registry.pages.length).toBeGreaterThanOrEqual(204);
    expect(registry.pages.length).toBe(loadedDisk.pages.length);
    expect(registry.pages.filter((p) => p.type === "param").length).toBeGreaterThanOrEqual(49);

    const knownIds = new Set(registry.pages.map((p) => p.id));
    const positives = suite.cases.filter((c) => !c.expectEmpty);
    const negatives = suite.cases.filter((c) => c.expectEmpty);
    expect(suite.cases.length).toBeGreaterThanOrEqual(189);
    expect(positives.length).toBeGreaterThanOrEqual(170);
    expect(negatives.length).toBeGreaterThanOrEqual(19);

    const seenIds = new Set<string>();
    const seenNormQueries = new Set<string>();
    for (const c of suite.cases) {
      expect(seenIds.has(c.id), `duplicate case id: ${c.id}`).toBe(false);
      seenIds.add(c.id);
      const normQ = c.query.trim().toLowerCase().replace(/\s+/g, " ");
      expect(seenNormQueries.has(normQ), `duplicate normalized query on ${c.id}: ${c.query}`).toBe(false);
      seenNormQueries.add(normQ);
    }
    for (const reqId of REQUIRED_CRITICAL_CASE_IDS) {
      expect(seenIds.has(reqId), `missing required critical eval case: ${reqId}`).toBe(true);
    }
    const exactIdSet = new Set(positives.filter((c) => Boolean(c.expectedTop1)).map((c) => c.id));
    for (const reqTop1Id of REQUIRED_EXACT_TOP1_CASE_IDS) {
      expect(
        exactIdSet.has(reqTop1Id),
        `required exact Top-1 case lost expectedTop1 assertion: ${reqTop1Id}`,
      ).toBe(true);
    }

    for (const c of positives) {
      if (c.expectedTop1) expect(knownIds.has(c.expectedTop1), `${c.id}: ${c.expectedTop1}`).toBe(true);
      expect(
        (c.expectedAnyTop3 ?? []).length,
        `${c.id}: expectedAnyTop3 must stay focused (<= 3 targets)`,
      ).toBeLessThanOrEqual(3);
      for (const expectedId of c.expectedAnyTop3 ?? []) {
        expect(knownIds.has(expectedId), `${c.id}: ${expectedId}`).toBe(true);
      }
    }
  });

  it("满足精确参数/概念 Top-1 = 100%（>=40 题）、正向工程查询 100% Top-3 召回率、负例与相邻错误码零误命中，且三路含图扩展完全一致", () => {
    const positives = suite.cases.filter((c) => !c.expectEmpty);
    const exactCases = positives.filter((c) => Boolean(c.expectedTop1));
    const negatives = suite.cases.filter((c) => c.expectEmpty);

    const exactMisses: string[] = [];
    const top3Misses: string[] = [];

    for (const c of positives) {
      const hits = retrieve(c.query, fullIndex, { limit: 5 });
      const browserHits = retrieve(c.query, browserIndex, { limit: 5 });
      expect(browserHits, `serialized parity for ${c.id}`).toEqual(hits);

      const expandedDirect = retrieve(c.query, fullIndex, { limit: 5, expand: true });
      const expandedBrowser = retrieve(c.query, browserIndex, { limit: 5, expand: true });
      expect(expandedBrowser, `serialized expanded parity for ${c.id}`).toEqual(expandedDirect);

      const agentHits = agentWiki.search(c.query, 5);
      expect(
        agentHits.map((h) => `${h.id}:${h.how ?? ""}`),
        `agentWiki full expanded parity for ${c.id}`,
      ).toEqual(expandedDirect.map((h) => `${h.id}:${h.how}`));

      const top3Ids = hits.slice(0, 3).map((h) => h.id);
      if (c.expectedTop1 && hits[0]?.id !== c.expectedTop1) {
        exactMisses.push(
          `${c.id} ("${c.query}") -> got #1=${hits[0]?.id ?? "none"}, expected ${c.expectedTop1}`,
        );
      }
      if (c.expectedAnyTop3 && !c.expectedAnyTop3.some((id) => top3Ids.includes(id))) {
        top3Misses.push(
          `${c.id} ("${c.query}") -> top3=[${top3Ids.join(", ")}], expected one of [${c.expectedAnyTop3.join(", ")}]`,
        );
      }
    }

    expect(exactCases.length).toBeGreaterThanOrEqual(40);
    expect(exactMisses, "Exact param/concept Top-1 misses").toEqual([]);

    expect(
      top3Misses,
      `Expected 100% Top-3 recall across all ${positives.length} positive cases; misses:\n${top3Misses.join("\n")}`,
    ).toEqual([]);

    // Body-contribution regression guard: blanking all page bodies must drop recall sharply on
    // body-grounded diagnostic & mechanism queries (proving metadata/aliases alone cannot pass the suite!)
    const emptyBodyIndex = buildIndex(pages.map((p) => ({ ...p, text: "" })));
    const bodyDependentIds = [
      "err-107030",
      "err-capture-model-oom-trace",
      "err-cann-smmu-retcode-0x26",
      "compile-ez9999-tiling-contrast",
      "quant-modelslim-shard-mismatch",
      "body-aclrt-sync-stream-timeout",
      "body-init-ascend-model-parallel",
      "body-vllm-disable-compile-cache",
      "body-a5-megamoe-quant-types",
      "body-set-pytorch-npu-alloc-env",
      "body-breakable-aclgraph-updatable",
      "body-pinned-mem-register-info",
      "body-worker-dp-world-size",
      "body-tpot-histogram-metric",
      "body-w8a8-dynamic-fused-moe-310",
      "body-mooncake-get-transfer-results",
      "body-custom-model-deepseek-v41",
      "body-ai-core-cumsum-group-list",
      "body-ai-core-swiglu-quant-single-tensor",
    ];
    let fullBodyHits = 0;
    let emptyBodyHits = 0;
    for (const id of bodyDependentIds) {
      const tc = positives.find((c) => c.id === id);
      expect(tc, `missing body-dependent case ${id}`).toBeDefined();
      const fullTop3 = retrieve(tc!.query, fullIndex, { limit: 3 }).map((h) => h.id);
      const emptyTop3 = retrieve(tc!.query, emptyBodyIndex, { limit: 3 }).map((h) => h.id);
      if (tc!.expectedAnyTop3!.some((t) => fullTop3.includes(t))) fullBodyHits += 1;
      if (tc!.expectedAnyTop3!.some((t) => emptyTop3.includes(t))) emptyBodyHits += 1;
    }
    expect(fullBodyHits).toBe(bodyDependentIds.length);
    expect(
      emptyBodyHits,
      `Blanking all 204 page bodies must collapse body-grounded recall (got ${emptyBodyHits}/${bodyDependentIds.length})`,
    ).toBeLessThanOrEqual(2);
    // Per-page body ablation: blanking ONLY ai-core or host-memory-and-hugepages body must drop its body-grounded case
    for (const [pageId, caseId] of [
      ["ai-core", "body-ai-core-cumsum-group-list"],
      ["ai-core", "body-ai-core-swiglu-quant-single-tensor"],
      ["host-memory-and-hugepages", "err-cann-smmu-retcode-0x26"],
    ] as const) {
      const tc = positives.find((c) => c.id === caseId)!;
      const ablated = buildIndex(pages.map((p) => (p.id === pageId ? { ...p, text: "" } : p)));
      const ablatedTop3 = retrieve(tc.query, ablated, { limit: 3 }).map((h) => h.id);
      expect(
        tc.expectedAnyTop3!.some((t) => ablatedTop3.includes(t)),
        `Blanking ${pageId} body alone must drop ${caseId} (got [${ablatedTop3.join(", ")}])`,
      ).toBe(false);
    }
    // Also verify overall suite recall drops meaningfully (>10 percentage points) when bodies are blanked
    const overallEmptyHits = positives.filter((c) => {
      const eTop3 = retrieve(c.query, emptyBodyIndex, { limit: 3 }).map((h) => h.id);
      return c.expectedAnyTop3!.some((t) => eTop3.includes(t));
    }).length;
    expect(overallEmptyHits / positives.length).toBeLessThan(0.9);

    // Whole-token posting guard: verify critical CANN/HCCL/GE/MC2/HAL tokens have real index postings
    // rather than matching accidentally via fuzzy prefix overlap.
    for (const token of [
      "ei0002",
      "ei0004",
      "ei0009",
      "ej0001",
      "ez3002",
      "ez3003",
      "507008",
      "107002",
      "el0004",
      "drvgetdevinfo",
      "rasocketconnect",
      "moedistributedispatch",
      "moedistributecombine",
      "dispatchffncombine",
      "torchair",
      "npugraphex",
      "fakeimpl",
    ]) {
      expect(fullIndex.postings.has(token), `expected whole-token posting for "${token}"`).toBe(true);
    }

    // Canonical mechanism pages must genuinely land in Top-3 on their dedicated fault queries
    const canonicalMechanismChecks: ReadonlyArray<[string, string]> = [
      ["AssertionError: expert_map is required for MC2 token dispatch.", "moe-comm-dispatch"],
      ["ValueError: fused mc2 op cannot be used with hierarchy communication.", "moe-comm-dispatch"],
      ["BackendCompilerFailed npugraph_ex GE compile graph failed", "npugraph-ex"],
      ["There was no fake impl registered for custom op Meta", "dev-new-model-and-custom-op"],
      ["107002 ACL_ERROR_RT_CONTEXT_NULL aclrtSetDevice failed", "ascend-runtime-and-tuning"],
      [
        "DP adjusted local rank is out of bounds for devices ASCEND_RT_VISIBLE_DEVICES",
        "ascend-runtime-and-tuning",
      ],
      ["RaSocketConnect failed: No route to host", "cann-hccl"],
    ];
    for (const [query, mustHitTop3] of canonicalMechanismChecks) {
      const top3 = retrieve(query, fullIndex, { limit: 3 }).map((h) => h.id);
      expect(top3, `canonical query "${query}" -> [${top3.join(", ")}]`).toContain(mustHitTop3);
    }

    // Same-code / adjacent-code contrast pairs must demonstrate targeted RELATIVE ranking
    // (a generic identical ordering cannot trivially pass!)
    const rankOf = (ids: readonly string[], target: string): number => {
      const idx = ids.indexOf(target);
      return idx === -1 ? Number.POSITIVE_INFINITY : idx;
    };
    const contrastPairs: ReadonlyArray<{
      label: string;
      queryA: string;
      preferA: string;
      overA: string;
      queryB: string;
      preferB: string;
      overB: string;
    }> = [
      {
        label: "EI0006 link-establish vs EI0002 Notify wait",
        queryA: "EI0006 Getting socket times out [Wait][LinkEstablish]",
        preferA: "cann-hccl",
        overA: "inference-troubleshooting",
        queryB: "EI0002 The wait execution of the Notify register times out",
        preferB: "inference-troubleshooting",
        overB: "cann-hccl",
      },
      {
        label: "EZ9999 tiling/compile vs EZ9999+507015 AICore runtime",
        queryA: "EZ9999 coreNum is 0, tiling failed CheckMlaAttrs",
        preferA: "npugraph-ex",
        overA: "inference-troubleshooting",
        queryB: "EZ9999 AclrtSynchronizeStreamWithTimeout 507015 aicore exception",
        preferB: "inference-troubleshooting",
        overB: "npugraph-ex",
      },
      {
        label: "507008 HAL/SoC vs EL0004 memory allocation",
        queryA: "507008 ACL_ERROR_RT_SOC_VERSION drvGetDevInfo failed",
        preferA: "ascend-runtime-and-tuning",
        overA: "device-memory",
        queryB: "EL0004: Failed to allocate memory.",
        preferB: "device-memory",
        overB: "ascend-runtime-and-tuning",
      },
      {
        label: "MC2 expert_map vs ModelSlim quant config",
        queryA: "AssertionError: expert_map is required for MC2 token dispatch.",
        preferA: "moe-comm-dispatch",
        overA: "quantization",
        queryB: "ERROR: ModelSlim Quantization Config Not Found quant_model_description.json",
        preferB: "quantization",
        overB: "moe-comm-dispatch",
      },
    ];
    for (const pair of contrastPairs) {
      const hitsA = retrieve(pair.queryA, fullIndex, { limit: 6 }).map((h) => h.id);
      const hitsB = retrieve(pair.queryB, fullIndex, { limit: 6 }).map((h) => h.id);
      expect(hitsA.slice(0, 3), `${pair.label} A top3 -> [${hitsA.slice(0, 3).join(", ")}]`).toContain(
        pair.preferA,
      );
      expect(hitsB.slice(0, 3), `${pair.label} B top3 -> [${hitsB.slice(0, 3).join(", ")}]`).toContain(
        pair.preferB,
      );
      expect(
        rankOf(hitsA, pair.preferA),
        `${pair.label} A: expected ${pair.preferA} ahead of ${pair.overA} in [${hitsA.join(", ")}]`,
      ).toBeLessThan(rankOf(hitsA, pair.overA));
      expect(
        rankOf(hitsB, pair.preferB),
        `${pair.label} B: expected ${pair.preferB} ahead of ${pair.overB} in [${hitsB.join(", ")}]`,
      ).toBeLessThan(rankOf(hitsB, pair.overB));
    }

    for (const neg of negatives) {
      expect(retrieve(neg.query, fullIndex, { limit: 5 }), `negative case ${neg.id}`).toEqual([]);
      expect(retrieve(neg.query, browserIndex, { limit: 5 }), `browser negative case ${neg.id}`).toEqual([]);
      expect(agentWiki.search(neg.query, 5), `agentWiki negative case ${neg.id}`).toEqual([]);
    }
  });

  it("不依赖硬编码数字错误码路由表：未收录报错码的干净索引对 CANN/HCCL/GE 错误码返回空命中", () => {
    const cleanIndex = buildIndex([
      {
        id: "inference-troubleshooting",
        title: "通用排障导览",
        summary: "演示不含任何数字错误码时的检索行为。",
        aliases: [],
        chapters: ["19"],
        evidence: "C",
        relations: [],
        text: "## 先看阶段边界\n\n当请求超时时，先核对入口与调度日志。",
      },
    ]);
    for (const code of [
      "507015",
      "507034",
      "507035",
      "161002",
      "107030",
      "507008",
      "107002",
      "EI0004",
      "EI0009",
      "EZ3002",
      "EL0004",
    ]) {
      expect(retrieve(code, cleanIndex, { limit: 5 })).toEqual([]);
    }

    // Param displayTitle parity check ("size" Top-4 matches production snapshot build including kvpp-config, paged-attention & kv-cache-spec across both loadAgentWiki and MCP createCachedAgentWikiLoader)
    const cachedMcpWiki = createCachedAgentWikiLoader(root)();
    const sizeTop4 = retrieve("size", browserIndex, { limit: 6 })
      .slice(0, 4)
      .map((h) => h.id);
    expect(sizeTop4).toEqual([
      "size-40a1c2ca47b8",
      "kvpp-config-0445bd352140",
      "paged-attention",
      "kv-cache-spec",
    ]);
    expect(
      agentWiki
        .search("size", 6)
        .filter((h) => h.how !== "related")
        .slice(0, 4)
        .map((h) => h.id),
    ).toEqual(sizeTop4);
    expect(
      cachedMcpWiki
        .search("size", 6)
        .filter((h) => h.how !== "related")
        .slice(0, 4)
        .map((h) => h.id),
    ).toEqual(sizeTop4);

    // Empty body never falls back to indexing YAML frontmatter comments in loadAgentWiki or createCachedAgentWikiLoader
    const tmpRoot = mkdtempSync(join(tmpdir(), "wiki-empty-body-"));
    try {
      mkdirSync(join(tmpRoot, "wiki/concepts"), { recursive: true });
      mkdirSync(join(tmpRoot, "src/content/wiki"), { recursive: true });
      writeFileSync(
        join(tmpRoot, "wiki/concepts/empty-body.md"),
        [
          "---",
          "# frontmatteronlytokenxyz",
          "id: empty-body",
          "title: 空正文测试页",
          "type: concept",
          "origin: direct",
          "summary: 验证空正文不会把 YAML 注释送入检索索引。",
          "aliases: []",
          "chapters: ['01']",
          "sources:",
          "  - https://github.com/vllm-project/vllm-ascend/pull/1",
          "relations: []",
          "verified: []",
          "evidence: C",
          "contradicts: []",
          "updated: '2026-11-26'",
          "---",
          "",
        ].join("\n"),
      );
      writeFileSync(
        join(tmpRoot, "src/content/wiki/registry.json"),
        JSON.stringify({
          version: 1,
          pages: [
            {
              id: "empty-body",
              title: "空正文测试页",
              type: "concept",
              origin: "direct",
              summary: "验证空正文不会把 YAML 注释送入检索索引。",
              aliases: [],
              chapters: ["01"],
              order: 500,
              prerequisites: [],
              sources: ["https://github.com/vllm-project/vllm-ascend/pull/1"],
              verified: [],
              evidence: "C",
              relations: [],
              related: [],
              contradicts: [],
              updated: "2026-11-26",
              file: "concepts/empty-body.md",
              backlinks: [],
            },
          ],
        }),
      );
      expect(loadAgentWiki(tmpRoot).search("frontmatteronlytokenxyz", 5)).toEqual([]);
      expect(createCachedAgentWikiLoader(tmpRoot)().search("frontmatteronlytokenxyz", 5)).toEqual([]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("verify-distilled-ascend 严格拒绝标题泄露，并在多关联 MR + 单 diff 场景下仅确认有明确证据链的修复 MR", () => {
    expect(isTitleLeak("[Bug]: EI0006 socket timeout on A3", "[Bug]: EI0006 socket timeout on A3")).toBe(
      true,
    );
    expect(isTitleLeak("EI0006 socket timeout on A3", "[Bug]: EI0006 socket timeout on A3")).toBe(true);
    expect(
      isTitleLeak(
        "[ERROR] HCCL(21431,python3): EI0006 Getting socket times out.",
        "[Bug]: EI0006 socket timeout on A3",
      ),
    ).toBe(false);

    // Multi-MR (#306: !603 + !604) where model cites BOTH MRs without per-MR diff source -> neither over-confirmed
    const bothCited = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 42,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603", "gitcode:Ascend/msit!604"],
      },
    });
    expect(bothCited.gitcodeMergedMrs).toHaveLength(2);
    expect(bothCited.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Even when pr_diff_lines === 0 or linked_merged_prs === [], citing multiple MRs never over-confirms both
    const bothCitedZeroDiff = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603", "gitcode:Ascend/msit!604"],
      },
    });
    expect(bothCitedZeroDiff.gitcodeConfirmedFixMrs).toHaveLength(0);

    const bothCitedNoLinked = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603", "gitcode:Ascend/msit!604"],
      },
    });
    expect(bothCitedNoLinked.gitcodeMentionedMrs).toHaveLength(2);
    expect(bothCitedNoLinked.gitcodeMentionedMrs.every((m) => !m.confirmed)).toBe(true);

    // Full GitCode MR URL with #fragment or ?query parses cleanly and prevents false single-MR confirmation
    const bothCitedWithFragment = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["!603", "https://gitcode.com/Ascend/msit/merge_requests/604#note_1"],
      },
    });
    expect(bothCitedWithFragment.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Multi-MR (#306: !603 + !604) with an UNBOUND diff (pr_diff_lines > 0, no owner) MUST NOT confirm a single MR!
    const unboundSingleModelCited = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 42,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603"],
      },
    });
    expect(unboundSingleModelCited.gitcodeMergedMrs).toHaveLength(2);
    expect(unboundSingleModelCited.gitcodeConfirmedFixMrs).toEqual([]);

    // When diff is explicitly bound to !603 (or no unbound diff exists), single model citation confirms ONLY !603
    const boundSingleModelCited = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "msit bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 42,
      pr_diff_source_ref: "gitcode:Ascend/msit!603",
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603, has_diff: true },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603"],
      },
    });
    expect(boundSingleModelCited.gitcodeMergedMrs).toHaveLength(2);
    expect(boundSingleModelCited.gitcodeConfirmedFixMrs.map((m) => m.ref)).toEqual([
      "gitcode:Ascend/msit!603",
    ]);

    // Alphanumeric GitCode issue ID ("I9ABC1") + persisted unparsed citation blocks false confirmation
    const unparsedCitationBlocksConfirm = partitionItemProvenance({
      key: "gitcode:Ascend/msit#I9ABC1",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: "I9ABC1",
      url: "https://gitcode.com/Ascend/msit/issues/I9ABC1",
      title: "msit alphanumeric bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "b".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!603"],
        fix_pr_numbers: [603],
        unparsed_fix_pr_citations: ["MR 604 (see note)"],
      },
    });
    expect(unparsedCitationBlocksConfirm.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Direct unparsed citation in fix_pr_numbers also blocks false confirmation
    const directUnparsedNumBlocks = partitionItemProvenance({
      key: "gitcode:Ascend/msit#I9ABC1",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: "I9ABC1",
      url: "https://gitcode.com/Ascend/msit/issues/I9ABC1",
      title: "msit alphanumeric bug",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "b".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:Ascend/msit!604", number: 604 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["!603"],
        fix_pr_numbers: ["MR 604 (see note)"],
      },
    });
    expect(directUnparsedNumBlocks.gitcodeConfirmedFixMrs).toHaveLength(0);

    // GitHub vs GitCode same repo/number citations stay distinct (both direct URLs and normalized github: prefix)
    for (const refs of [
      [
        "https://github.com/Ascend/msit/pull/603#discussion",
        "https://gitcode.com/Ascend/msit/merge_requests/603?view=overview",
      ],
      ["github:Ascend/msit#603", "gitcode:Ascend/msit!603"],
    ]) {
      const dualEco = partitionItemProvenance({
        key: "gitcode:Ascend/msit#306",
        ecosystem: "gitcode",
        repo: "Ascend/msit",
        number: 306,
        url: "https://gitcode.com/Ascend/msit/issues/306",
        title: "msit dual ecosystem ref",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "c".repeat(64),
        pr_diff_lines: 0,
        linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
        verbatim_root_line: "RuntimeError: failed",
        verbatim_root_verified: true,
        distilled: {
          root_cause_confirmed: true,
          fix_pr_refs: refs,
        },
      });
      expect(dualEco.gitcodeMergedMrs).toHaveLength(1);
      expect(dualEco.gitcodeConfirmedFixMrs).toHaveLength(0);
      expect(dualEco.otherExternalPrs).toEqual([
        {
          ref: "github:Ascend/msit#603",
          repo: "Ascend/msit",
          number: 603,
          merged: false,
          confirmed: false,
        },
      ]);
      // Round-tripping the exported refs back through partitionItemProvenance remains idempotent!
      const roundTrip = partitionItemProvenance({
        key: "gitcode:Ascend/msit#306",
        ecosystem: "gitcode",
        repo: "Ascend/msit",
        number: 306,
        url: "https://gitcode.com/Ascend/msit/issues/306",
        title: "msit dual ecosystem round-trip",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "c".repeat(64),
        pr_diff_lines: 0,
        linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
        verbatim_root_line: "RuntimeError: failed",
        verbatim_root_verified: true,
        distilled: {
          root_cause_confirmed: true,
          fix_pr_refs: [dualEco.otherExternalPrs[0]!.ref, dualEco.gitcodeMergedMrs[0]!.ref],
        },
      });
      expect(roundTrip.gitcodeConfirmedFixMrs).toHaveLength(0);
      expect(roundTrip.otherExternalPrs[0]?.ref).toBe("github:Ascend/msit#603");
    }

    // Mention-only linked PR with diff and root_cause_confirmed=false must remain referenced, never confirmed
    const mentionOnlyDiff = partitionItemProvenance({
      key: "vllm-project/vllm-ascend#778",
      ecosystem: "github",
      repo: "vllm-project/vllm-ascend",
      number: 778,
      url: "https://github.com/vllm-project/vllm-ascend/issues/778",
      title: "still broken after #603",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 12,
      pr_diff_source_ref: "vllm-project/vllm-ascend#603",
      linked_merged_prs: [
        {
          ref: "vllm-project/vllm-ascend#603",
          number: 603,
          source: "local_git_pr_ref",
          has_diff: true,
        },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: false,
        fix_pr_refs: [],
      },
    });
    expect(mentionOnlyDiff.ascendConfirmedPrNums).toEqual([]);
    expect(mentionOnlyDiff.ascendReferencedPrNums).toEqual([603]);

    // Unparseable commit diff source ref ("owner/repo@sha") blocks attributing its diff to another PR (#604)
    const commitDiffRef = partitionItemProvenance({
      key: "vllm-project/vllm-ascend#779",
      ecosystem: "github",
      repo: "vllm-project/vllm-ascend",
      number: 779,
      url: "https://github.com/vllm-project/vllm-ascend/issues/779",
      title: "direct commit fix diff",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 8,
      pr_diff_source_ref: "vllm-project/vllm-ascend@abcdef12",
      linked_merged_prs: [{ ref: "vllm-project/vllm-ascend#604", number: 604 }],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["#604"],
      },
    });
    expect(commitDiffRef.ascendConfirmedPrNums).toEqual([]);
    expect(commitDiffRef.ascendReferencedPrNums).toEqual([604]);

    // Bare !603 when BOTH Ascend/msit!603 and cann/runtime!603 exist (linked or candidate) confirms neither
    const bareDualRepoCollision = partitionItemProvenance({
      key: "gitcode:Ascend/msit#307",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 307,
      url: "https://gitcode.com/Ascend/msit/issues/307",
      title: "ambiguous bare ref across repos",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "gitcode:Ascend/msit!603", number: 603 },
        { ref: "gitcode:cann/runtime!603", number: 603 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["!603"],
      },
    });
    expect(bareDualRepoCollision.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Linked row with bare ref="!603" and qualified cann/runtime URL resolves to cann/runtime, never Ascend/msit
    const urlRepoOverride = partitionItemProvenance({
      key: "gitcode:Ascend/msit#308",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 308,
      url: "https://gitcode.com/Ascend/msit/issues/308",
      title: "qualified url repo resolution",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        {
          ref: "!603",
          number: 603,
          url: "https://gitcode.com/cann/runtime/merge_requests/603",
        },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["!603"],
      },
    });
    expect(urlRepoOverride.gitcodeMergedMrs.map((m) => m.ref)).toEqual(["gitcode:cann/runtime!603"]);
    expect(urlRepoOverride.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Non-empty object citation and compound two-URL string both block single-MR confirmation
    const objAndCompound = partitionItemProvenance({
      key: "gitcode:Ascend/msit#309",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 309,
      url: "https://gitcode.com/Ascend/msit/issues/309",
      title: "object and compound citations",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["!603"],
        fix_pr_numbers: { number: 604 } as unknown as number[],
      },
    });
    expect(objAndCompound.gitcodeConfirmedFixMrs).toHaveLength(0);

    const compoundUrl = partitionItemProvenance({
      key: "gitcode:Ascend/msit#310",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 310,
      url: "https://gitcode.com/Ascend/msit/issues/310",
      title: "compound url citation",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "d".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: [
          "https://gitcode.com/Ascend/msit/merge_requests/603?view=overview and https://gitcode.com/Ascend/msit/merge_requests/604",
        ],
      },
    });
    expect(compoundUrl.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Full audit entry point: scalar fields don't throw, cross-field multiline root rejected,
    // raw-vs-distilled diff-source conflict flagged & suppresses confirmation, and byRepo preserves forge identity
    const rawBody = "last body line";
    const rawComments = "first comment line";
    const shaOk = computeRawSha256("conflict test", rawBody, rawComments);
    const auditReport = verifyDistilledPayload(
      root,
      {
        schemaVersion: 2,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "test-model",
        gpu: "mock",
        vramGiB: 80,
        elapsedSec: 1,
        totalIssues: 2,
        verbatimVerifiedCount: 0,
        items: [
          {
            key: "gitcode:Ascend/msit#901",
            ecosystem: "gitcode",
            repo: "Ascend/msit",
            number: "I9ABC1",
            url: "https://gitcode.com/Ascend/msit/issues/I9ABC1",
            title: "conflict test",
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true,
            raw_sha256: shaOk,
            pr_diff_lines: 10,
            pr_diff_source_ref: "gitcode:Ascend/msit!604",
            linked_merged_prs: [{ ref: "gitcode:Ascend/msit!604", number: 604, has_diff: true }],
            verbatim_root_line: `${rawBody}\n${rawComments}`,
            verbatim_root_verified: true,
            verbatim_cascade_lines: "first comment line" as unknown as string[],
            distilled: {
              error_codes: "507015" as unknown as string[],
              colloquial_queries_zh: "EI0006 建链超时" as unknown as string[],
              root_cause_confirmed: true,
              fix_pr_refs: ["gitcode:Ascend/msit!604"],
            },
          },
          {
            key: "Ascend/msit#902",
            ecosystem: "github",
            repo: "Ascend/msit",
            number: 902,
            url: "https://github.com/Ascend/msit/issues/902",
            title: "github msit",
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true,
            raw_sha256: "f".repeat(64),
            verbatim_root_line: "",
            verbatim_root_verified: false,
            distilled: {},
          },
        ],
      },
      new Map([
        [
          "gitcode:Ascend/msit#901",
          {
            key: "gitcode:Ascend/msit#901",
            ecosystem: "gitcode",
            repo: "Ascend/msit",
            number: "I9ABC1",
            url: "https://gitcode.com/Ascend/msit/issues/I9ABC1",
            title: "conflict test",
            body: rawBody,
            comments_text: rawComments,
            raw_sha256: shaOk,
            pr_diff_lines: 10,
            pr_diff_source_ref: "gitcode:Ascend/msit!603",
            linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603, has_diff: true }],
          },
        ],
      ]),
      { inputPath: "mock.json", rawCorpusPath: "mock.jsonl" },
    );
    expect(auditReport.provenanceConflictCount).toBe(1);
    expect(auditReport.auditedItems[0]?.provenanceConflict).toBe(true);
    expect(auditReport.auditedItems[0]?.verbatimRootVerified).toBe(false);
    // Provenance conflict suppresses ungrounded errorCodes and rootCauseConfirmed
    expect(auditReport.auditedItems[0]?.errorCodes).toEqual([]);
    expect(auditReport.auditedItems[0]?.rootCauseConfirmed).toBe(false);
    expect(auditReport.auditedItems[0]?.gitcodeConfirmedFixMrs).toEqual([]);
    expect(auditReport.byRepo["gitcode:Ascend/msit"]?.total).toBe(1);
    expect(auditReport.byRepo["github:Ascend/msit"]?.total).toBe(1);

    // 9 linked MRs (603..611) where ONLY #611 is confirmed must NOT drop #611
    const nineLinkedOnlyLast = partitionItemProvenance({
      key: "gitcode:Ascend/msit#903",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 903,
      url: "https://gitcode.com/Ascend/msit/issues/903",
      title: "nine linked MRs",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [603, 604, 605, 606, 607, 608, 609, 610, 611].map((n) => ({
        ref: `gitcode:Ascend/msit!${n}`,
        number: n,
      })),
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/msit!611"],
      },
    });
    expect(nineLinkedOnlyLast.gitcodeMergedMrs).toHaveLength(9);
    expect(nineLinkedOnlyLast.gitcodeConfirmedFixMrs.map((m) => m.number)).toEqual([611]);

    // Raw-vs-distilled provenance conflicts (source switch, omitted colliding link/candidate, SHA mismatch) all block confirmation
    const conflictCases: Array<{
      label: string;
      rawItem: Parameters<typeof verifyDistilledPayload>[2] extends ReadonlyMap<string, infer R> ? R : never;
      distilledItem: Parameters<typeof verifyDistilledPayload>[1]["items"][number];
      expectConflict: boolean;
    }> = [
      {
        label: "source switched from mention-only to fix-linked",
        rawItem: {
          key: "gitcode:Ascend/msit#910",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 910,
          url: "https://gitcode.com/Ascend/msit/issues/910",
          title: "source switch",
          body: "RuntimeError: boom",
          comments_text: "",
          raw_sha256: computeRawSha256("source switch", "RuntimeError: boom", ""),
          pr_diff_lines: 5,
          pr_diff_source_ref: "gitcode:Ascend/msit!603",
          linked_merged_prs: [
            { ref: "gitcode:Ascend/msit!603", number: 603, source: "gitcode_text_ref_pr", has_diff: true },
          ],
        },
        distilledItem: {
          key: "gitcode:Ascend/msit#910",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 910,
          url: "https://gitcode.com/Ascend/msit/issues/910",
          title: "source switch",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: computeRawSha256("source switch", "RuntimeError: boom", ""),
          pr_diff_lines: 5,
          pr_diff_source_ref: "gitcode:Ascend/msit!603",
          linked_merged_prs: [
            { ref: "gitcode:Ascend/msit!603", number: 603, source: "gitcode_linked_pr", has_diff: true },
          ],
          verbatim_root_line: "RuntimeError: boom",
          verbatim_root_verified: true,
          distilled: { root_cause_confirmed: false },
        },
        expectConflict: true,
      },
      {
        label: "omitted colliding raw link",
        rawItem: {
          key: "gitcode:Ascend/msit#911",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 911,
          url: "https://gitcode.com/Ascend/msit/issues/911",
          title: "omitted link",
          body: "RuntimeError: boom",
          comments_text: "",
          raw_sha256: computeRawSha256("omitted link", "RuntimeError: boom", ""),
          linked_merged_prs: [
            { ref: "gitcode:Ascend/msit!603", number: 603 },
            { ref: "gitcode:cann/runtime!603", number: 603 },
          ],
        },
        distilledItem: {
          key: "gitcode:Ascend/msit#911",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 911,
          url: "https://gitcode.com/Ascend/msit/issues/911",
          title: "omitted link",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: computeRawSha256("omitted link", "RuntimeError: boom", ""),
          linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
          verbatim_root_line: "RuntimeError: boom",
          verbatim_root_verified: true,
          distilled: { root_cause_confirmed: true, fix_pr_refs: ["!603"] },
        },
        expectConflict: true,
      },
      {
        label: "omitted colliding raw candidate",
        rawItem: {
          key: "gitcode:Ascend/msit#912",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 912,
          url: "https://gitcode.com/Ascend/msit/issues/912",
          title: "omitted cand",
          body: "RuntimeError: boom",
          comments_text: "",
          raw_sha256: computeRawSha256("omitted cand", "RuntimeError: boom", ""),
          candidate_prs: ["gitcode:cann/runtime!603"],
          linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
        },
        distilledItem: {
          key: "gitcode:Ascend/msit#912",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 912,
          url: "https://gitcode.com/Ascend/msit/issues/912",
          title: "omitted cand",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: computeRawSha256("omitted cand", "RuntimeError: boom", ""),
          candidate_prs: [],
          linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
          verbatim_root_line: "RuntimeError: boom",
          verbatim_root_verified: true,
          distilled: { root_cause_confirmed: true, fix_pr_refs: ["!603"] },
        },
        expectConflict: true,
      },
      {
        label: "raw SHA mismatch suppresses confirmation",
        rawItem: {
          key: "gitcode:Ascend/msit#913",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 913,
          url: "https://gitcode.com/Ascend/msit/issues/913",
          title: "sha mismatch",
          body: "RuntimeError: boom",
          comments_text: "",
          raw_sha256: computeRawSha256("sha mismatch", "RuntimeError: boom", ""),
          linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
        },
        distilledItem: {
          key: "gitcode:Ascend/msit#913",
          ecosystem: "gitcode",
          repo: "Ascend/msit",
          number: 913,
          url: "https://gitcode.com/Ascend/msit/issues/913",
          title: "sha mismatch",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: "0".repeat(64),
          linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
          verbatim_root_line: "RuntimeError: boom",
          verbatim_root_verified: true,
          distilled: { root_cause_confirmed: true, fix_pr_refs: ["gitcode:Ascend/msit!603"] },
        },
        expectConflict: false,
      },
    ];
    for (const tc of conflictCases) {
      const rep = verifyDistilledPayload(
        root,
        {
          schemaVersion: 2,
          generatedAt: "2026-01-01T00:00:00Z",
          teacherModel: "test-model",
          gpu: "mock",
          vramGiB: 80,
          elapsedSec: 1,
          totalIssues: 1,
          verbatimVerifiedCount: 0,
          items: [tc.distilledItem],
        },
        new Map([[tc.rawItem.key, tc.rawItem]]),
        { inputPath: "mock.json", rawCorpusPath: "mock.jsonl" },
      );
      expect(rep.auditedItems[0]?.provenanceConflict, tc.label).toBe(tc.expectConflict);
      expect(rep.auditedItems[0]?.gitcodeConfirmedFixMrs, tc.label).toEqual([]);
    }

    // Bare linked_merged_prs entry without url still populates sameRepoNums & survives cross-repo collision
    const bareLinkedCollision = partitionItemProvenance({
      key: "gitcode:Ascend/msit#I9ABC1",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: "I9ABC1",
      url: "https://gitcode.com/Ascend/msit/issues/I9ABC1",
      title: "bare linked collision",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "!603", number: 603 },
        { ref: "gitcode:cann/runtime!603", number: 603 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:cann/runtime!603"],
        fix_pr_numbers: [603],
      },
    });
    expect(bareLinkedCollision.gitcodeMergedMrs).toHaveLength(2);
    expect(bareLinkedCollision.gitcodeConfirmedFixMrs).toHaveLength(0);

    // Non-string runtime scalar verbatim_root_line / model_verbatim_root_line_rejected never throw TypeError
    const malformedRootReport = verifyDistilledPayload(
      root,
      {
        schemaVersion: 2,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "test-model",
        gpu: "mock",
        vramGiB: 80,
        elapsedSec: 1,
        totalIssues: 1,
        verbatimVerifiedCount: 0,
        items: [
          {
            key: "gitcode:Ascend/msit#914",
            ecosystem: "gitcode",
            repo: "Ascend/msit",
            number: 914,
            url: "https://gitcode.com/Ascend/msit/issues/914",
            title: "non-string root",
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true,
            raw_sha256: "a".repeat(64),
            verbatim_root_line: 507015 as unknown as string,
            model_verbatim_root_line_rejected: 507015 as unknown as string,
            verbatim_root_verified: true,
            distilled: {},
          },
        ],
      },
      new Map(),
      { inputPath: "mock.json", rawCorpusPath: null },
    );
    expect(malformedRootReport.auditedItems[0]?.verbatimRootVerified).toBe(false);
    expect(malformedRootReport.auditedItems[0]?.verbatimRootLine).toBe("");

    // One PR's diff (#603) must NEVER confirm an unrelated model-cited PR (#604), even if root_cause_confirmed=true
    for (const rcFlag of [false, true]) {
      const diffMismatch = partitionItemProvenance({
        key: "vllm-project/vllm-ascend#777",
        ecosystem: "github",
        repo: "vllm-project/vllm-ascend",
        number: 777,
        url: "https://github.com/vllm-project/vllm-ascend/issues/777",
        title: "ascend diff mismatch",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "d".repeat(64),
        pr_diff_lines: 18,
        pr_diff_source_ref: "vllm-project/vllm-ascend#603",
        linked_merged_prs: [{ ref: "vllm-project/vllm-ascend#603", number: 603, has_diff: true }],
        verbatim_root_line: "RuntimeError: failed",
        verbatim_root_verified: true,
        distilled: {
          root_cause_confirmed: rcFlag,
          fix_pr_refs: ["#604"],
        },
      });
      expect(diffMismatch.ascendConfirmedPrNums).toEqual([603]);
      expect(diffMismatch.ascendReferencedPrNums).toEqual([604]);
    }

    // Scalar fix_pr_refs / fix_pr_numbers at runtime never iterate string characters or crash
    const scalarRuntime = partitionItemProvenance({
      key: "gitcode:Ascend/msit#306",
      ecosystem: "gitcode",
      repo: "Ascend/msit",
      number: 306,
      url: "https://gitcode.com/Ascend/msit/issues/306",
      title: "scalar model output",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "e".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603 }],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: "!603" as unknown as string[],
        fix_pr_numbers: 603 as unknown as number[],
      },
    });
    expect(scalarRuntime.gitcodeConfirmedFixMrs.map((m) => m.ref)).toEqual(["gitcode:Ascend/msit!603"]);

    // Bare number colliding with an uncited linked cross-repo PR must not confirm same-repo PR or fabricate a same-repo PR
    const crossRepoBareCollision = partitionItemProvenance({
      key: "vllm-project/vllm-ascend#888",
      ecosystem: "github",
      repo: "vllm-project/vllm-ascend",
      number: 888,
      url: "https://github.com/vllm-project/vllm-ascend/issues/888",
      title: "cross repo bare collision",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "f".repeat(64),
      pr_diff_lines: 0,
      linked_merged_prs: [
        { ref: "vllm-project/vllm#500", number: 500 },
        { ref: "vllm-project/vllm-ascend#603", number: 603 },
      ],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["#603"],
        fix_pr_numbers: [500],
      },
    });
    expect(crossRepoBareCollision.ascendConfirmedPrNums).toEqual([]);
    expect(crossRepoBareCollision.ascendReferencedPrNums).toEqual([603]);
  });

  it("覆盖 V1 Git 血缘（离线自包含临时仓库 + 可选本地克隆）：回移/显式撤销/patch-id撤销/合并提交/松散ref缓存失效", () => {
    // V1 (CI clean-checkout safe!): Always run a self-contained temp git repository verifying
    // direct commits, cherry-picks, explicit reverts, patch-id reverts with own PR number, merge commits,
    // and loose-ref cache invalidation — even before `pnpm wiki:clone` runs!
    const tmpGitRoot = mkdtempSync(join(tmpdir(), "f6-git-lineage-"));
    try {
      const repoDir = join(tmpGitRoot, "tools/repos/vllm");
      mkdirSync(join(tmpGitRoot, "wiki/seeds"), { recursive: true });
      mkdirSync(repoDir, { recursive: true });
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", repoDir, ...args], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: "f6-test",
            GIT_AUTHOR_EMAIL: "f6@example.com",
            GIT_COMMITTER_NAME: "f6-test",
            GIT_COMMITTER_EMAIL: "f6@example.com",
          },
        }).trim();
      git("init", "-b", "main");
      writeFileSync(join(repoDir, "a.py"), "x = 1\n", "utf8");
      git("add", "a.py");
      git("commit", "-m", "initial commit");
      const baseSha = git("rev-parse", "HEAD");

      // Release branch before #101 lands on main
      git("checkout", "-b", "releases/v0.26.0", baseSha);
      git("checkout", "main");

      // Direct PR #101 on main
      writeFileSync(join(repoDir, "a.py"), "x = 2\n", "utf8");
      git("add", "a.py");
      git("commit", "-m", "fix: handle edge case (#101)");
      const sha101 = git("rev-parse", "HEAD");

      // Cherry-pick (from #101) (#102) onto releases/v0.26.0
      git("checkout", "releases/v0.26.0");
      writeFileSync(join(repoDir, "a.py"), "x = 2\n", "utf8");
      git("add", "a.py");
      git("commit", "-m", "[Cherry-pick] fix: handle edge case (from #101) (#102)");
      const sha102 = git("rev-parse", "HEAD");
      git("checkout", "main");

      // PR #201 then reverted by patch-id revert PR #205 whose subject ends in (#205), NOT (#201)!
      writeFileSync(join(repoDir, "b.py"), "y = 10\n", "utf8");
      git("add", "b.py");
      git("commit", "-m", "fix: new feature (#201)");
      const sha201 = git("rev-parse", "HEAD");
      git("revert", "--no-commit", sha201);
      git("commit", "-m", 'Revert "fix: new feature" (#205)');
      const sha205 = git("rev-parse", "HEAD");

      // PR #210 reverted by explicit `This reverts commit <sha>`
      writeFileSync(join(repoDir, "c.py"), "z = 1\n", "utf8");
      git("add", "c.py");
      git("commit", "-m", "fix: explicit revert target (#210)");
      const sha210 = git("rev-parse", "HEAD");
      git("revert", "--no-commit", sha210);
      git("commit", "-m", `Revert explicit\n\nThis reverts commit ${sha210}.`);
      const sha210Rev = git("rev-parse", "HEAD");

      // Merge-commit PR #300
      git("checkout", "-b", "feat-300", baseSha);
      writeFileSync(join(repoDir, "d.py"), "w = 1\n", "utf8");
      git("add", "d.py");
      git("commit", "-m", "feat work");
      git("checkout", "main");
      git("merge", "--no-ff", "feat-300", "-m", "Merge pull request #300 from dev/feat-300");
      const mainTip = git("rev-parse", "HEAD");

      writeFileSync(
        join(tmpGitRoot, "wiki/seeds/vllm-ascend-code.yaml"),
        [
          "repos:",
          "  vllm:",
          "    url: https://github.com/vllm-project/vllm",
          "    path: tools/repos/vllm",
          "    refs:",
          `      "releases/v0.26.0": "${sha102}"`,
          `      main: "${mainTip}"`,
          "features: []",
          "",
        ].join("\n"),
        "utf8",
      );

      const syn101 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 101);
      expect(syn101.status).toBe("found");
      if (syn101.status === "found") {
        expect(syn101.commit).toBe(sha101);
        const rel = syn101.pins.find((p) => p.ref === "releases/v0.26.0");
        expect(rel?.contains).toBe(true);
        expect(rel?.cherryPickCommit).toBe(sha102);
      }

      // Patch-id revert with its own PR number (#205) MUST mark #201 contains=false!
      const syn201 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 201);
      expect(syn201.status).toBe("found");
      if (syn201.status === "found") {
        const mp = syn201.pins.find((p) => p.ref === "main");
        expect(mp?.contains).toBe(false);
        expect(mp?.commitAncestor).toBe(true);
        expect(mp?.revertedBy).toBe(sha205);
      }

      // Explicit `This reverts commit <sha>` revert MUST mark #210 contains=false!
      const syn210 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 210);
      expect(syn210.status).toBe("found");
      if (syn210.status === "found") {
        const mp = syn210.pins.find((p) => p.ref === "main");
        expect(mp?.contains).toBe(false);
        expect(mp?.commitAncestor).toBe(true);
        expect(mp?.revertedBy).toBe(sha210Rev);
      }

      const syn300 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 300);
      expect(syn300.status).toBe("found");

      // P2#1: Adding a loose ref without changing HEAD or packed-refs MUST invalidate in-memory git caches!
      const stampBefore = repoGitStamp(repoDir);
      expect(localFixVersions(tmpGitRoot, "vllm-project/vllm", 404).status).toBe("no-local-commit");
      git("checkout", "--detach", baseSha);
      writeFileSync(join(repoDir, "e.py"), "e = 404\n", "utf8");
      git("add", "e.py");
      git("commit", "-m", "fix: loose ref commit (#404)");
      const sha404 = git("rev-parse", "HEAD");
      git("checkout", "main");
      git("update-ref", "refs/remotes/origin/releases/v0.99.0", sha404);
      expect(repoGitStamp(repoDir)).not.toBe(stampBefore);
      expect(localFixVersions(tmpGitRoot, "vllm-project/vllm", 404).status).toBe("found");

      // R3 P2#2: Linked worktree stamp MUST also reflect loose ref updates in shared commondir!
      const wtDir = join(tmpGitRoot, "linked-wt");
      git("worktree", "add", "--detach", wtDir, baseSha);
      const wtStampBefore = repoGitStamp(wtDir);
      git("update-ref", "refs/heads/main", sha101);
      expect(repoGitStamp(wtDir)).not.toBe(wtStampBefore);
      git("update-ref", "refs/heads/main", mainTip);

      // R6 P1#3: Revert committed on a topic branch, merged into main via --no-ff, and topic branch pruned MUST still mark PR reverted!
      git("checkout", "main");
      writeFileSync(join(repoDir, "side_revert.py"), "x = 510\n", "utf8");
      git("add", "side_revert.py");
      git("commit", "-m", "fix: side branch fix (#510)");
      const sha510 = git("rev-parse", "HEAD");
      git("checkout", "-b", "topic-revert-510");
      git("revert", "--no-edit", sha510);
      const sha510Rev = git("rev-parse", "HEAD");
      git("checkout", "main");
      git("merge", "--no-ff", "-m", "Merge topic-revert-510 into main", "topic-revert-510");
      git("branch", "-D", "topic-revert-510");
      const mainAfterMergeRevert = git("rev-parse", "HEAD");
      writeFileSync(
        join(tmpGitRoot, "wiki/seeds/vllm-ascend-code.yaml"),
        `repos:\n  vllm:\n    url: https://github.com/vllm-project/vllm\n    path: tools/repos/vllm # inline comment (R6 P1#2)\n    refs:\n      main: "${mainAfterMergeRevert}"\n      "releases/v0.26.0": "${sha102}"\nfeatures: []\n`,
        "utf8",
      );
      const syn510 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 510);
      expect(syn510.status).toBe("found");
      if (syn510.status === "found") {
        const mp = syn510.pins.find((p) => p.ref === "main");
        expect(mp?.contains).toBe(false);
        expect(mp?.revertedBy).toBe(sha510Rev);
      }

      // R6 P2#2: Cherry-pick trailer naming a DIFFERENT 40-char SHA sharing the same 7-char prefix MUST NOT falsely match!
      git("checkout", "-b", "rel-collision-26", sha102);
      const fakeCollidingSha =
        `${sha510.slice(0, 7)}${"0".repeat(33)}`.toLowerCase() === sha510.toLowerCase()
          ? `${sha510.slice(0, 7)}${"1".repeat(33)}`
          : `${sha510.slice(0, 7)}${"0".repeat(33)}`;
      writeFileSync(join(repoDir, "cp_collision.py"), "y = 1\n", "utf8");
      git("add", "cp_collision.py");
      git("commit", "-m", `chore: unrelated pick\n\n(cherry picked from commit ${fakeCollidingSha})`);
      const relWithCollision = git("rev-parse", "HEAD");
      writeFileSync(
        join(tmpGitRoot, "wiki/seeds/vllm-ascend-code.yaml"),
        `repos:\n  vllm:\n    url: https://github.com/vllm-project/vllm\n    path: tools/repos/vllm # inline comment\n    refs:\n      main: "${mainAfterMergeRevert}"\n      "releases/v0.26.0": "${relWithCollision}"\nfeatures: []\n`,
        "utf8",
      );
      const syn510Rel = localFixVersions(tmpGitRoot, "vllm-project/vllm", 510);
      expect(syn510Rel.status).toBe("found");
      if (syn510Rel.status === "found") {
        const relPin = syn510Rel.pins.find((p) => p.ref === "releases/v0.26.0");
        expect(relPin?.contains).toBe(false);
        expect(relPin?.cherryPickCommit).toBeUndefined();
      }

      // R7 P2#1: Merge PR whose parent-1 diff touches 1 file (while parent-2 differs on many files) reverted by
      // an inverse patch commit without an explicit SHA or PR number MUST still be detected as reverted!
      git("checkout", "-b", "feat-merge-520", baseSha);
      writeFileSync(join(repoDir, "merge_a.py"), "x = 520\n", "utf8");
      git("add", "merge_a.py");
      git("commit", "-m", "feat: add merge_a");
      git("checkout", "main");
      git("merge", "--no-ff", "-m", "Merge pull request #520 from feat/merge-a", "feat-merge-520");
      git("branch", "-D", "feat-merge-520");
      git("rm", "merge_a.py");
      git("commit", "-m", 'Revert "feat: add merge_a" (#521)');
      const sha520Undo = git("rev-parse", "HEAD");
      writeFileSync(
        join(tmpGitRoot, "wiki/seeds/vllm-ascend-code.yaml"),
        `repos:\n  vllm:\n    url: https://github.com/vllm-project/vllm\n    path: tools/repos/vllm # inline comment\n    refs:\n      main: "${sha520Undo}"\n      "releases/v0.26.0": "${relWithCollision}"\nfeatures: []\n`,
        "utf8",
      );
      const syn520 = localFixVersions(tmpGitRoot, "vllm-project/vllm", 520);
      expect(syn520.status).toBe("found");
      if (syn520.status === "found") {
        const mp = syn520.pins.find((p) => p.ref === "main");
        expect(mp?.contains).toBe(false);
        expect(mp?.revertedBy).toBe(sha520Undo);
      }
    } finally {
      rmSync(tmpGitRoot, { recursive: true, force: true });
    }

    // Live clone lineage assertions (run whenever optional local clones are present)
    if (existsSync(join(root, "tools/repos/vllm-ascend/.git"))) {
      const check15835 = localFixVersions(root, "vllm-project/vllm-ascend", 15835);
      expect(check15835.status).toBe("found");
      if (check15835.status === "found") {
        const rel26 = check15835.pins.find((p) => p.ref === "releases/v0.26.0rc");
        expect(rel26?.contains).toBe(true);
        expect(rel26?.cherryPickCommit?.startsWith("a0ad1705")).toBe(true);
      }
      const check17659 = localFixVersions(root, "vllm-project/vllm-ascend", 17659);
      expect(check17659.status).toBe("found");
      if (check17659.status === "found") {
        const mainPin = check17659.pins.find((p) => p.ref === "main");
        expect(mainPin?.contains).toBe(false);
        expect(mainPin?.commitAncestor).toBe(true);
        expect(mainPin?.revertedBy?.startsWith("5a12ca24")).toBe(true);
      }
      const check9780 = localFixVersions(root, "vllm-project/vllm-ascend", 9780);
      expect(check9780.status).toBe("found");
      if (check9780.status === "found") {
        const main9780 = check9780.pins.find((p) => p.ref === "main");
        expect(main9780?.contains).toBe(false);
        expect(main9780?.commitAncestor).toBe(true);
        expect(main9780?.revertedBy?.startsWith("7388730f")).toBe(true);
      }
    }
    if (existsSync(join(root, "tools/repos/vllm/.git"))) {
      const check55223 = localFixVersions(root, "vllm-project/vllm", 55223);
      expect(check55223.status).toBe("found");
      if (check55223.status === "found") {
        expect(check55223.commits?.length).toBeGreaterThanOrEqual(2);
      }
      const check498 = localFixVersions(root, "vllm-project/vllm", 498);
      expect(check498.status).toBe("found");
      // P1#3 live check: vLLM #58208 reverted by #59125 (cf971b41)
      const check58208 = localFixVersions(root, "vllm-project/vllm", 58208);
      expect(check58208.status).toBe("found");
      if (check58208.status === "found") {
        const main58208 = check58208.pins.find((p) => p.ref === "main");
        expect(main58208?.contains).toBe(false);
        expect(main58208?.revertedBy?.startsWith("cf971b41")).toBe(true);
      }
    }
  }, 60_000);

  it("覆盖 V2-V4 与 Verifier P1/P2/P3 防护：缺失 raw 禁确认、纯文档与未合入 MR 禁确认、SHA冲突、摘要防篡改、Gate 非零、标题/单行/原型键防护", () => {
    // Retrieve hex fuzzy guard: adjacent hex codes never collide; equivalent leading-zero hex matches
    const hexIdx = buildIndex([
      {
        id: "hex-a",
        title: "C000000A",
        aliases: [],
        summary: "",
        chapters: [],
        evidence: "C",
        text: "",
      },
      {
        id: "ret-26",
        title: "retcode0x26",
        aliases: [],
        summary: "",
        chapters: [],
        evidence: "C",
        text: "",
      },
    ]);
    expect(retrieve("C000000B", hexIdx, { limit: 5 })).toEqual([]);
    expect(retrieve("retcode0x026", hexIdx, { limit: 5 }).map((h) => h.id)).toEqual(["ret-26"]);

    // V2: Missing raw corpus (rawSha256Verified === null) MUST fail CLOSED (zero confirmed fixes)
    const noRawRep = verifyDistilledPayload(
      root,
      {
        schemaVersion: 2,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "test-model",
        gpu: "mock",
        vramGiB: 80,
        elapsedSec: 1,
        totalIssues: 1,
        verbatimVerifiedCount: 0,
        items: [
          {
            key: "gitcode:Ascend/msit#1",
            ecosystem: "gitcode",
            repo: "Ascend/msit",
            number: 1,
            url: "https://gitcode.com/Ascend/msit/issues/1",
            title: "missing raw test",
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true,
            raw_sha256: "a".repeat(64),
            linked_merged_prs: [{ ref: "gitcode:Ascend/msit!603", number: 603, source: "gitcode_linked_pr" }],
            verbatim_root_line: "RuntimeError: boom",
            verbatim_root_verified: true,
            distilled: {
              root_cause_confirmed: true,
              fix_pr_refs: ["!603"],
              fault_domain: "constructor",
              colloquial_queries_zh: ["HCCL 建链超时"],
            },
          },
        ],
      },
      new Map(),
      { inputPath: "mem.json", rawCorpusPath: null },
    );
    expect(noRawRep.auditedItems[0]?.rawSha256Verified).toBeNull();
    expect(noRawRep.auditedItems[0]?.gitcodeConfirmedFixMrs).toEqual([]);
    expect(noRawRep.auditedItems[0]?.rootCauseConfirmed).toBe(false);

    // V3: Docs-only MR (!48207) and unmerged MR (!999) NEVER become confirmed runtime fixes
    const docsAndUnmerged = partitionItemProvenance({
      key: "gitcode:Ascend/pytorch#5538",
      ecosystem: "gitcode",
      repo: "Ascend/pytorch",
      number: 5538,
      url: "https://gitcode.com/Ascend/pytorch/issues/5538",
      title: "autograd API consistency",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 12,
      pr_diff_source_ref: "gitcode:Ascend/pytorch!48207",
      linked_merged_prs: [
        {
          ref: "gitcode:Ascend/pytorch!48207",
          number: 48207,
          title: "docs: 新增三个 autograd API 子条目",
          source: "gitcode_linked_pr",
          has_diff: true,
        },
      ],
      verbatim_root_line: "[PASS] resolves to builtin tuple.count",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/pytorch!48207"],
      },
    });
    expect(docsAndUnmerged.gitcodeMergedMrs).toHaveLength(1);
    expect(docsAndUnmerged.gitcodeMergedMrs[0]?.docsOnly).toBe(true);
    expect(docsAndUnmerged.gitcodeConfirmedFixMrs).toEqual([]);

    const unmergedOnly = partitionItemProvenance({
      key: "gitcode:Ascend/pytorch#5539",
      ecosystem: "gitcode",
      repo: "Ascend/pytorch",
      number: 5539,
      url: "https://gitcode.com/Ascend/pytorch/issues/5539",
      title: "unmerged mention",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      linked_merged_prs: [],
      verbatim_root_line: "RuntimeError: failed",
      verbatim_root_verified: true,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["gitcode:Ascend/pytorch!99999"],
      },
    });
    expect(unmergedOnly.gitcodeMentionedMrs).toHaveLength(1);
    expect(unmergedOnly.gitcodeMentionedMrs[0]?.confirmed).toBe(false);

    // V4: evaluateAuditGate flags empty items, totalIssues mismatch, and missing raw corpus
    const emptyGate = evaluateAuditGate(
      {
        schemaVersion: 2,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "m",
        gpu: "mock",
        vramGiB: 80,
        elapsedSec: 1,
        totalIssues: 5,
        verbatimVerifiedCount: 0,
        items: [],
      },
      noRawRep,
      null,
    );
    expect(emptyGate.some((f) => f.startsWith("empty_items"))).toBe(true);
    expect(emptyGate.some((f) => f.startsWith("total_issues_mismatch"))).toBe(true);
    expect(emptyGate.some((f) => f.startsWith("missing_raw_corpus"))).toBe(true);

    // Verifier P2/P3 guards: URL host, blockquote title-leak, single-line span, Chinese prose guard
    expect(
      inferEcosystem({
        key: "gitcode:cann/hccl#1",
        repo: "cann/hccl",
        url: "https://gitcode.com/cann/hccl/issues/1?ref=github.com",
      }),
    ).toBe("gitcode");
    expect(isTitleLeak("> RuntimeError: missing weights", "RuntimeError: missing weights")).toBe(true);
    expect(isTitleLeak("**RuntimeError: missing weights**", "RuntimeError: missing weights")).toBe(true);
    expect(isSingleLineInField("word", "contains word here", "")).toBe(false);
    expect(isSingleLineInField("a\u2028b", "a\u2028b", "")).toBe(false);
    expect(
      isSingleLineInField(
        "RuntimeError: missing weights",
        "There was no RuntimeError: missing weights in this run.",
        "",
      ),
    ).toBe(false);
    expect(
      isSingleLineInField(
        "Only never timeout is supported",
        "两个接口均执行 timeout != -1 校验并报出“Only never timeout is supported”。",
        "",
      ),
    ).toBe(false);
    expect(
      isProseSummaryNotRuntimeLog(
        "| 1 | #9145 | foreach_addcdiv_scalar | arch35 tiling EZ9999 换正式错误码，补负向 UT |",
      ),
    ).toBe(true);
    expect(
      isProseSummaryNotRuntimeLog(
        "`OP_LOGE` 裸宏上报 `EZ9999`（`REPORT_INNER_ERR_MSG`），无结构化错误信息，报错口径不一致。",
      ),
    ).toBe(true);

    // Docs-only diff snippet without docs: title prefix (cann/runtime!5512) + foreign explicit URL + has_diff="false" + prototype key guard
    const docsDiffOnly = partitionItemProvenance(
      {
        key: "gitcode:cann/runtime#1093",
        ecosystem: "gitcode",
        repo: "cann/runtime",
        number: 1093,
        url: "https://gitcode.com/cann/runtime/issues/1093",
        title: "错误码参考写错",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "a".repeat(64),
        pr_diff_lines: 4,
        pr_diff_source_ref: "gitcode:cann/runtime!5512",
        linked_merged_prs: [
          {
            ref: "gitcode:cann/runtime!5512",
            number: 5512,
            title: "错误码参考将 GE Device 内存操作错误写成内存分配失败",
            url: "https://gitcode.com/cann/runtime/merge_requests/5512",
            source: "gitcode_linked_pr",
            has_diff: true,
          },
        ],
        verbatim_root_line: "",
        verbatim_root_verified: false,
        distilled: { root_cause_confirmed: true, fix_pr_refs: ["gitcode:cann/runtime!5512"] },
      },
      "diff --git a/docs/zh/api_ref/25-01_aclError.md b/docs/zh/api_ref/25-01_aclError.md\n--- a/docs/zh/api_ref/25-01_aclError.md\n+++ b/docs/zh/api_ref/25-01_aclError.md\n+fixed",
    );
    expect(docsDiffOnly.gitcodeMergedMrs[0]?.docsOnly).toBe(true);
    expect(docsDiffOnly.gitcodeConfirmedFixMrs).toEqual([]);

    const foreignUrlAndProto = partitionItemProvenance({
      key: "gitcode:Ascend/pytorch#5538",
      ecosystem: "gitcode",
      repo: "Ascend/pytorch",
      number: 5538,
      url: "https://gitcode.com/Ascend/pytorch/issues/5538",
      title: "foreign url test",
      closed_at: "2026-01-01T00:00:00Z",
      comments_complete: true,
      raw_sha256: "a".repeat(64),
      pr_diff_lines: 10,
      linked_merged_prs: [
        {
          ref: "gitcode:Ascend/pytorch!48207",
          number: 8,
          url: "https://example.org/different/project/pull/8",
          has_diff: "false" as unknown as boolean,
        },
      ],
      verbatim_root_line: "",
      verbatim_root_verified: false,
      distilled: {
        root_cause_confirmed: true,
        fix_pr_refs: ["constructor#5", "__proto__#5", "gitcode:Ascend/pytorch!48207"],
      },
    });
    expect(foreignUrlAndProto.gitcodeMergedMrs).toEqual([]);
    expect(foreignUrlAndProto.gitcodeConfirmedFixMrs).toEqual([]);

    // Tampered linked title / zeroed resume digest / duplicate & incomplete payload / fallback-masked unverified rule hit / commitConflict gate
    const rawOkBody = "[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015";
    const rawOkSha = computeRawSha256("dup test", rawOkBody, "");
    const rawMap2 = new Map([
      [
        "gitcode:Ascend/pytorch#5538",
        {
          key: "gitcode:Ascend/pytorch#5538",
          ecosystem: "gitcode" as const,
          repo: "Ascend/pytorch",
          number: 5538,
          url: "https://gitcode.com/Ascend/pytorch/issues/5538",
          title: "dup test",
          body: rawOkBody,
          comments_text: "",
          raw_sha256: rawOkSha,
          pr_diff_lines: 0,
          pr_diff_snippet: "",
          linked_merged_prs: [
            {
              ref: "gitcode:Ascend/pytorch!48207",
              number: 48207,
              title: "docs: api update",
              url: "https://gitcode.com/Ascend/pytorch/merge_requests/48207",
              source: "gitcode_linked_pr",
            },
          ],
        },
      ],
      [
        "gitcode:Ascend/pytorch#9999",
        {
          key: "gitcode:Ascend/pytorch#9999",
          ecosystem: "gitcode" as const,
          repo: "Ascend/pytorch",
          number: 9999,
          url: "https://gitcode.com/Ascend/pytorch/issues/9999",
          title: "omitted raw",
          body: rawOkBody,
          comments_text: "",
          raw_sha256: computeRawSha256("omitted raw", rawOkBody, ""),
          pr_diff_lines: 0,
          pr_diff_snippet: "",
        },
      ],
    ]);
    const tamperedPayload = {
      schemaVersion: 2,
      status: "incomplete",
      failedCount: 2,
      generatedAt: "2026-01-01T00:00:00Z",
      teacherModel: "m",
      gpu: "mock",
      vramGiB: 80,
      elapsedSec: 1,
      totalIssues: 2,
      verbatimVerifiedCount: 2,
      items: [
        {
          key: "gitcode:Ascend/pytorch#5538",
          ecosystem: "gitcode" as const,
          repo: "Ascend/pytorch",
          number: 5538,
          url: "https://gitcode.com/Ascend/pytorch/issues/5538",
          title: "dup test",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: rawOkSha,
          resume_input_sha256: "0".repeat(64),
          pr_diff_lines: 0,
          linked_merged_prs: [
            {
              ref: "gitcode:Ascend/pytorch!48207",
              number: 48207,
              title: "Fix autograd dispatch",
              url: "https://gitcode.com/Ascend/pytorch/merge_requests/48207",
              source: "gitcode_linked_pr",
            },
          ],
          verbatim_root_line: rawOkBody,
          verbatim_root_verified: true,
          model_verbatim_root_line_rejected: "NPU out of memory.",
          distilled: { root_cause_confirmed: true, fix_pr_refs: ["gitcode:Ascend/pytorch!48207"] },
        },
        {
          key: "gitcode:Ascend/pytorch#5538",
          ecosystem: "gitcode" as const,
          repo: "Ascend/pytorch",
          number: 5538,
          url: "https://gitcode.com/Ascend/pytorch/issues/5538",
          title: "dup test",
          closed_at: "2026-01-01T00:00:00Z",
          comments_complete: true,
          raw_sha256: rawOkSha,
          pr_diff_lines: 0,
          verbatim_root_line: rawOkBody,
          verbatim_root_verified: true,
          distilled: { root_cause_confirmed: true },
        },
      ],
    };
    const tamperedRep = verifyDistilledPayload(root, tamperedPayload, rawMap2, {
      inputPath: "mem.json",
      rawCorpusPath: "mem.jsonl",
    });
    expect(tamperedRep.duplicateKeyCount).toBe(1);
    expect(tamperedRep.unmatchedRawKeysCount).toBe(1);
    expect(tamperedRep.auditedItems[0]?.provenanceConflict).toBe(true);
    expect(tamperedRep.auditedItems[0]?.gitcodeConfirmedFixMrs).toEqual([]);
    expect(tamperedRep.unverifiedGeneratedRuleHits).toBeGreaterThanOrEqual(1);
    expect(tamperedRep.prMrLineageSummary.gitcodeMergedMrsCount).toBe(0);
    const tamperedGate = evaluateAuditGate(tamperedPayload, tamperedRep, "mem.jsonl");
    expect(tamperedGate.some((f) => f.startsWith("producer_incomplete_or_failed"))).toBe(true);
    expect(tamperedGate.some((f) => f.startsWith("duplicate_payload_keys"))).toBe(true);
    expect(tamperedGate.some((f) => f.startsWith("incomplete_corpus_coverage"))).toBe(true);
    expect(tamperedGate.some((f) => f.startsWith("provenance_conflict"))).toBe(true);

    // Round 2 parity + adversarial regressions (P1#4, P1#6, P1#8, P2#2, P2#3, P2#4, P2#5, P2#8, P2#11, P2#12)
    // 1. SYSTEM_PROMPT_SHA256 exact parity with scripts/colab/distill_ascend_h100.py
    const pySource = readFileSync(join(root, "scripts/colab/distill_ascend_h100.py"), "utf8");
    const sysPromptMatch = /SYSTEM_PROMPT\s*=\s*"""([\s\S]*?)"""/.exec(pySource);
    expect(sysPromptMatch).not.toBeNull();
    const liveSysPromptSha = createHash("sha256").update(sysPromptMatch![1]!, "utf8").digest("hex");
    expect(DISTILL_SYSTEM_PROMPT_SHA256).toBe(liveSysPromptSha);

    // 2. P1#6: Windows namespaced path alias detection
    const sampleFile = join(root, "scripts/wiki/engineering-eval-suite.json");
    expect(sameFilePath(toNamespacedPath(sampleFile), sampleFile)).toBe(true);

    // 3. P2#3: Whole-line plain prose rejected; #8065 maintainer closure comment flagged as prose (NOT runtime log)
    expect(
      isSingleLineInField("Only never timeout is supported", "Only never timeout is supported", ""),
    ).toBe(false);
    expect(
      isProseSummaryNotRuntimeLog(
        "[zzzzzzyf_]: 已通过 PR #16499 增加 `aclnnQuantGroupedMatmulInplaceAdd` 的 `yRef` 连续性校验：非连续时记录实际 stride，并返回 `ACLNN_ERR_PARAM_INVALID`（161002）。",
      ),
    ).toBe(true);

    // 4. P2#8: CMakeLists.txt is NOT docs-only; partial docs excerpt on fix(gbsa): MR does NOT mark whole MR docsOnly nor confirm runtime fix
    expect(
      isDocsOnlyDiffSnippet(
        "diff --git a/CMakeLists.txt b/CMakeLists.txt\n+++ b/CMakeLists.txt\n+add_compile_options(-O2)",
      ),
    ).toBe(false);
    const partialDocsOnCodeFix = partitionItemProvenance(
      {
        key: "gitcode:cann/ops-transformer#8528",
        ecosystem: "gitcode",
        repo: "cann/ops-transformer",
        number: 8528,
        url: "https://gitcode.com/cann/ops-transformer/issues/8528",
        title: "aclnnGenericBlockSparseAttentionMetadata 507018",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "a".repeat(64),
        pr_diff_lines: 4,
        pr_diff_source_ref: "gitcode:cann/ops-transformer!17000",
        linked_merged_prs: [
          {
            ref: "gitcode:cann/ops-transformer!17000",
            number: 17000,
            title: "fix(gbsa): 明确 TND maxQSeqLen 约束并补充越界日志",
            url: "https://gitcode.com/cann/ops-transformer/merge_requests/17000",
            source: "gitcode_linked_pr",
            has_diff: true,
            diff_excerpt_docs_only: true,
          },
        ],
        verbatim_root_line: "",
        verbatim_root_verified: false,
        distilled: { root_cause_confirmed: true, fix_pr_refs: ["gitcode:cann/ops-transformer!17000"] },
      },
      "diff --git a/docs/gbsa.md b/docs/gbsa.md\n+++ b/docs/gbsa.md\n+note",
    );
    expect(partialDocsOnCodeFix.gitcodeMergedMrs[0]?.docsOnly).toBeUndefined();
    expect(partialDocsOnCodeFix.gitcodeConfirmedFixMrs).toEqual([]);

    // 5. P2#2: Missing-raw row MUST NOT contribute to trusted provenance totals
    expect(noRawRep.prMrLineageSummary.gitcodeMentionedMrsCount).toBe(0);
    expect(noRawRep.prMrLineageSummary.gitcodeMergedMrsCount).toBe(0);
    expect(noRawRep.byEcosystem.gitcode.withPrOrMrProvenance).toBe(0);

    // 6. P2#4 + P2#5 + P2#11 + P2#12 + P1#8: body-copied rejected title leak still counted; unverified cascade fails gate;
    //    string answer_parsed="false" & failedCount="1" fail gate; comments_complete mismatch & same-line patch tamper / forged digest fail!
    const p18TmpDir = mkdtempSync(join(tmpdir(), "f6-p18-"));
    try {
      const p18RawPath = join(p18TmpDir, "dual_raw_corpus.jsonl");
      const origBody =
        "NPU out of memory.\n[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015";
      const origSha = computeRawSha256("NPU out of memory.", origBody, "");
      const origRawRow = {
        key: "gitcode:cann/ops-transformer#8232",
        ecosystem: "gitcode" as const,
        repo: "cann/ops-transformer",
        number: 8232,
        url: "https://gitcode.com/cann/ops-transformer/issues/8232",
        title: "NPU out of memory.",
        body: origBody,
        comments_text: "",
        comments_complete: false,
        raw_sha256: origSha,
        pr_diff_lines: 2,
        pr_diff_snippet: "diff --git a/op.cpp b/op.cpp\n+if (!valid) return ACLNN_ERR_PARAM_INVALID;",
        pr_diff_source_ref: "gitcode:cann/ops-transformer!15623",
        linked_merged_prs: [
          {
            ref: "gitcode:cann/ops-transformer!15623",
            number: 15623,
            title: "fix(op): validate input",
            url: "https://gitcode.com/cann/ops-transformer/merge_requests/15623",
            source: "gitcode_linked_pr",
            has_diff: true,
          },
        ],
      };
      const origContentSha = computeDistillContentSha256(origRawRow);
      const origResumeSha = computeDistillInputSha256(origRawRow, {
        teacherModel: "m",
        teacherBackend: "vllm",
        teacherDtype: "bfloat16",
        maxNewTokens: 1536,
        normalizerVersion: "f6-v3",
      });
      // Tamper ONLY the patch content while keeping identical line count (2 lines) AND hide dual_mining_summary.json!
      const tamperedRawRow = {
        ...origRawRow,
        pr_diff_snippet: "diff --git a/op.cpp b/op.cpp\n+ unrelated change",
      };
      writeFileSync(p18RawPath, `${JSON.stringify(tamperedRawRow)}\n`, "utf8");
      const p18Payload = {
        schemaVersion: 2,
        normalizerVersion: "f6-v3",
        status: "ok",
        failedCount: "1" as unknown as number,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "m",
        backend: "vllm",
        dtype: "bfloat16",
        gpu: "mock",
        vramGiB: 80,
        maxNewTokens: 1536,
        elapsedSec: 1,
        totalIssues: 1,
        verbatimVerifiedCount: 1,
        items: [
          {
            key: origRawRow.key,
            ecosystem: "gitcode" as const,
            repo: origRawRow.repo,
            number: origRawRow.number,
            url: origRawRow.url,
            title: origRawRow.title,
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true, // flipped vs raw false (P2#12)
            raw_sha256: origSha,
            normalizer_version: "f6-v3",
            content_input_sha256: origContentSha, // mismatches tampered patch (P1#8)
            resume_input_sha256: origResumeSha,
            answer_parsed: "false" as unknown as boolean, // string false (P2#11)
            pr_diff_lines: 2,
            pr_diff_source_ref: origRawRow.pr_diff_source_ref,
            linked_merged_prs: origRawRow.linked_merged_prs,
            verbatim_root_line:
              "[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015",
            verbatim_root_verified: true,
            verbatim_root_source: "fallback_log_extractor",
            model_verbatim_root_line_rejected: "NPU out of memory.", // also copied into body (P2#4)
            verbatim_cascade_lines: ["Only never timeout is supported"], // unverified cascade (P2#5)
            distilled: {
              root_cause_confirmed: true,
              fix_pr_refs: ["gitcode:cann/ops-transformer!15623"],
            },
          },
        ],
      };
      const p18Rep = verifyDistilledPayload(
        root,
        p18Payload,
        new Map([[tamperedRawRow.key, tamperedRawRow]]),
        { inputPath: join(p18TmpDir, "dist.json"), rawCorpusPath: p18RawPath },
      );
      expect(p18Rep.auditedItems[0]?.provenanceConflict).toBe(true);
      expect(p18Rep.auditedItems[0]?.gitcodeConfirmedFixMrs).toEqual([]);
      expect(p18Rep.unparsedItemsCount).toBe(1);
      expect(p18Rep.modelTitleLeakRejectedCount).toBe(1);
      expect(p18Rep.unverifiedGeneratedRuleHits).toBe(1);
      const p18Gate = evaluateAuditGate(p18Payload, p18Rep, p18RawPath);
      expect(p18Gate.some((f) => f.startsWith("producer_incomplete_or_failed"))).toBe(true);
      expect(p18Gate.some((f) => f.startsWith("missing_mining_summary"))).toBe(true);
      expect(p18Gate.some((f) => f.startsWith("provenance_conflict"))).toBe(true);

      // Clean row with unverified cascade line fails gate on unverified_cascade_lines
      const cleanRawPath = join(p18TmpDir, "clean_raw.jsonl");
      const cleanRawText = `${JSON.stringify(origRawRow)}\n`;
      writeFileSync(cleanRawPath, cleanRawText, "utf8");
      writeFileSync(
        join(p18TmpDir, "dual_mining_summary.json"),
        JSON.stringify({
          jsonlSha256: createHash("sha256").update(cleanRawText, "utf8").digest("hex"),
          jsonlBytes: Buffer.byteLength(cleanRawText, "utf8"),
          totalItems: 1,
        }),
        "utf8",
      );
      const cleanCascPayload = {
        ...p18Payload,
        failedCount: 0,
        items: [
          {
            ...p18Payload.items[0]!,
            comments_complete: false,
            answer_parsed: true,
          },
        ],
      };
      const cleanCascRep = verifyDistilledPayload(
        root,
        cleanCascPayload,
        new Map([[origRawRow.key, origRawRow]]),
        { inputPath: join(p18TmpDir, "dist2.json"), rawCorpusPath: cleanRawPath },
      );
      expect(cleanCascRep.provenanceConflictCount).toBe(0);
      expect(cleanCascRep.unverifiedCascadeLinesCount).toBe(1);
      expect(
        evaluateAuditGate(cleanCascPayload, cleanCascRep, cleanRawPath).some((f) =>
          f.startsWith("unverified_cascade_lines"),
        ),
      ).toBe(true);
    } finally {
      rmSync(p18TmpDir, { recursive: true, force: true });
    }

    // 7. P1#4: >12-char corrupted vLLM commit SHA and bad Ascend commit SHA both trigger commitConflict + suppress confirmation + exclude from trusted rollups
    if (
      existsSync(join(root, "tools/repos/vllm/.git")) &&
      existsSync(join(root, "tools/repos/vllm-ascend/.git"))
    ) {
      const shaBody = "[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015";
      const shaDigest = computeRawSha256("sha test", shaBody, "");
      const vllmRaw = {
        key: "vllm-project/vllm#55223",
        ecosystem: "github" as const,
        repo: "vllm-project/vllm",
        number: 55223,
        url: "https://github.com/vllm-project/vllm/issues/55223",
        title: "sha test",
        body: shaBody,
        comments_text: "",
        comments_complete: true,
        raw_sha256: shaDigest,
        pr_diff_lines: 0,
        pr_diff_snippet: "",
        linked_merged_prs: [
          {
            ref: "vllm-project/vllm#55223",
            number: 55223,
            url: "https://github.com/vllm-project/vllm/pull/55223",
            commit_sha: `0a742da274cc${"f".repeat(28)}`,
          },
        ],
      };
      const ascendRaw = {
        key: "vllm-project/vllm-ascend#1416",
        ecosystem: "github" as const,
        repo: "vllm-project/vllm-ascend",
        number: 1416,
        url: "https://github.com/vllm-project/vllm-ascend/issues/1416",
        title: "sha test",
        body: shaBody,
        comments_text: "",
        comments_complete: true,
        raw_sha256: shaDigest,
        pr_diff_lines: 0,
        pr_diff_snippet: "",
        linked_merged_prs: [
          {
            ref: "vllm-project/vllm-ascend#1416",
            number: 1416,
            url: "https://github.com/vllm-project/vllm-ascend/pull/1416",
            commit_sha: "deadbeefffff",
          },
        ],
      };
      const badShaRep = verifyDistilledPayload(
        root,
        {
          schemaVersion: 2,
          generatedAt: "2026-01-01T00:00:00Z",
          teacherModel: "m",
          gpu: "mock",
          vramGiB: 80,
          elapsedSec: 1,
          totalIssues: 2,
          verbatimVerifiedCount: 2,
          items: [
            {
              key: vllmRaw.key,
              ecosystem: "github",
              repo: vllmRaw.repo,
              number: 55223,
              url: vllmRaw.url,
              title: vllmRaw.title,
              closed_at: "2026-01-01T00:00:00Z",
              comments_complete: true,
              raw_sha256: shaDigest,
              pr_diff_lines: 0,
              linked_merged_prs: vllmRaw.linked_merged_prs,
              verbatim_root_line: shaBody,
              verbatim_root_verified: true,
              distilled: { root_cause_confirmed: true, fix_pr_refs: ["vllm-project/vllm#55223"] },
            },
            {
              key: ascendRaw.key,
              ecosystem: "github",
              repo: ascendRaw.repo,
              number: 1416,
              url: ascendRaw.url,
              title: ascendRaw.title,
              closed_at: "2026-01-01T00:00:00Z",
              comments_complete: true,
              raw_sha256: shaDigest,
              pr_diff_lines: 0,
              linked_merged_prs: ascendRaw.linked_merged_prs,
              verbatim_root_line: shaBody,
              verbatim_root_verified: true,
              distilled: { root_cause_confirmed: true, fix_pr_refs: ["vllm-project/vllm-ascend#1416"] },
            },
          ],
        },
        new Map([
          [vllmRaw.key, vllmRaw],
          [ascendRaw.key, ascendRaw],
        ]),
        { inputPath: "mem.json", rawCorpusPath: null },
      );
      expect(badShaRep.commitConflictCount).toBe(2);
      expect(badShaRep.auditedItems[0]?.vllmMergedPrs[0]?.commitConflict).toBe(true);
      expect(badShaRep.auditedItems[0]?.vllmMergedPrs[0]?.confirmed).toBe(false);
      expect(badShaRep.auditedItems[1]?.confirmedFixPrLineage).toEqual([]);
      expect(badShaRep.auditedItems[1]?.referencedPrLineage[0]?.commitConflict).toBe(true);
      expect(badShaRep.prMrLineageSummary.vllmMergedPrsCount).toBe(0);
      expect(badShaRep.prMrLineageSummary.ascendReferencedPrs).toBe(0);
    }

    // 8. Round 3 adversarial regressions:
    //    - P2#9: bare 0x026 matches bare 0x26 on BOTH live index and body-only index!
    const liveHex26 = retrieve("0x26", fullIndex, { limit: 3 }).map((h) => h.id);
    const liveHex026 = retrieve("0x026", fullIndex, { limit: 3 }).map((h) => h.id);
    expect(liveHex26.length).toBeGreaterThan(0);
    expect(liveHex026).toEqual(liveHex26);
    const bodyHexIdx = buildIndex([
      {
        id: "smmu-body",
        title: "SMMU fault",
        aliases: [],
        summary: "",
        chapters: [],
        evidence: "C",
        text: "CheckSmmuFault retCode=0x26 on DDR address out of range",
      },
    ]);
    expect(retrieve("0x026", bodyHexIdx, { limit: 3 }).map((h) => h.id)).toEqual(["smmu-body"]);
    // R4 P2#6: Compound identifier `retCode_0x026` matches `retCode_0x26` on BOTH live & body-only index!
    expect(retrieve("retCode_0x026", fullIndex, { limit: 3 }).map((h) => h.id)).toEqual(
      retrieve("retCode_0x26", fullIndex, { limit: 3 }).map((h) => h.id),
    );
    expect(retrieve("retCode_0x026", bodyHexIdx, { limit: 3 }).map((h) => h.id)).toEqual(["smmu-body"]);

    //    - P2#5: hypothetical Chinese SIGSEGV prose (cann/runtime#1069, cann/ops-transformer#7988) rejected as prose
    expect(
      isProseSummaryNotRuntimeLog(
        "`aclrtRandomNumAsync` 的公开参数是 `const aclrtRandomNumTaskInfo*`，若合法输入位于只读内存，任务下发前会触发 `SIGSEGV`。",
      ),
    ).toBe(true);
    expect(
      isProseSummaryNotRuntimeLog(
        "当异常路径真正命中 `context == nullptr` 时，该日志语句会立即对空指针执行解引用并引发段错误（SIGSEGV），无法安全返回 `ge::GRAPH_FAILED`。",
      ),
    ).toBe(true);

    //    - P1#1 + P1#3 + P2#6 + P2#10: modified in-memory rawMap vs on-disk summary, malformed summary counts,
    //      fabricated verified root / nested cascade / missing answer_parsed / familyCount mismatch, and
    //      non-matching unverified root NOT masking rejected title leak!
    const r3Tmp = mkdtempSync(join(tmpdir(), "f6-r3-"));
    try {
      const r3Body =
        "NPU out of memory.\n[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015";
      const r3Sha = computeRawSha256("NPU out of memory.", r3Body, "");
      const r3Row = {
        key: "gitcode:cann/ops-transformer#8232",
        ecosystem: "gitcode" as const,
        repo: "cann/ops-transformer",
        number: 8232,
        url: "https://gitcode.com/cann/ops-transformer/issues/8232",
        title: "NPU out of memory.",
        body: r3Body,
        comments_text: "",
        comments_complete: true,
        raw_sha256: r3Sha,
        pr_diff_lines: 2,
        pr_diff_snippet: "diff --git a/op.cpp b/op.cpp\n+if (!valid) return -1;",
        pr_diff_source_ref: "gitcode:cann/ops-transformer!15623",
        linked_merged_prs: [
          {
            ref: "gitcode:cann/ops-transformer!15623",
            number: 15623,
            title: "fix(op): validate",
            url: "https://gitcode.com/cann/ops-transformer/merge_requests/15623",
            source: "gitcode_linked_pr",
            has_diff: true,
          },
        ],
      };
      const r3RawPath = join(r3Tmp, "dual_raw_corpus.jsonl");
      const r3RawText = `${JSON.stringify(r3Row)}\n`;
      writeFileSync(r3RawPath, r3RawText, "utf8");
      const r3DiskSha = createHash("sha256").update(r3RawText, "utf8").digest("hex");
      // P2#10: String totalItems="1" / jsonlBytes="0" MUST fail mining summary verification!
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({ jsonlSha256: r3DiskSha, jsonlBytes: "0", totalItems: "1" }),
        "utf8",
      );
      const r3ValidContentSha = computeDistillContentSha256(r3Row);
      const r3ValidResumeSha = computeDistillInputSha256(r3Row, {
        teacherModel: "m",
        teacherBackend: "vllm",
        teacherDtype: "bfloat16",
        maxNewTokens: 1536,
        normalizerVersion: "f6-v3",
      });
      const r3Payload = {
        schemaVersion: 2,
        normalizerVersion: "f6-v3",
        status: "ok",
        failedCount: 0,
        generatedAt: "2026-01-01T00:00:00Z",
        teacherModel: "m",
        backend: "vllm",
        dtype: "bfloat16",
        gpu: "mock",
        vramGiB: 80,
        maxNewTokens: 1536,
        elapsedSec: 1,
        totalIssues: 1,
        verbatimVerifiedCount: 1,
        familyCount: 789,
        families: [],
        items: [
          {
            key: r3Row.key,
            ecosystem: "gitcode" as const,
            repo: r3Row.repo,
            number: r3Row.number,
            url: r3Row.url,
            title: r3Row.title,
            closed_at: "2026-01-01T00:00:00Z",
            comments_complete: true,
            raw_sha256: r3Sha,
            normalizer_version: "f6-v3",
            content_input_sha256: r3ValidContentSha,
            resume_input_sha256: r3ValidResumeSha,
            // answer_parsed deliberately omitted (P1#3)
            pr_diff_lines: 2,
            pr_diff_source_ref: r3Row.pr_diff_source_ref,
            linked_merged_prs: r3Row.linked_merged_prs,
            verbatim_root_line: "fabricated non-matching root text", // unverified root matching 0 rules (P1#3 + P2#6)
            verbatim_root_verified: true,
            model_verbatim_root_line_rejected: "NPU out of memory.", // MUST STILL count in unverifiedGeneratedRuleHits! (P2#6)
            verbatim_cascade_lines: [],
            distilled: {
              verbatim_root_line: "fabricated non-matching root text",
              verbatim_cascade_lines: ["fabricated nested cascade line"], // P1#3 nested cascade
              root_cause_confirmed: true,
              fix_pr_refs: ["gitcode:cann/ops-transformer!15623"],
            },
          },
        ],
      };
      const r3RepBadSummary = verifyDistilledPayload(root, r3Payload, new Map([[r3Row.key, r3Row]]), {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
      });
      expect(r3RepBadSummary.miningSummaryDigestVerified).toBe(false);
      expect(r3RepBadSummary.unparsedItemsCount).toBe(1);
      expect(r3RepBadSummary.claimedRootVerificationMismatchCount).toBe(1);
      expect(r3RepBadSummary.unverifiedCascadeLinesCount).toBeGreaterThanOrEqual(1);
      expect(r3RepBadSummary.unverifiedGeneratedRuleHits).toBe(1);
      const r3Gate = evaluateAuditGate(r3Payload, r3RepBadSummary, r3RawPath);
      expect(r3Gate.some((f) => f.startsWith("mining_summary_digest_mismatch"))).toBe(true);
      expect(r3Gate.some((f) => f.startsWith("producer_incomplete_or_failed"))).toBe(true);
      expect(r3Gate.some((f) => f.startsWith("claimed_root_verification_mismatch"))).toBe(true);
      expect(r3Gate.some((f) => f.startsWith("producer_family_contradiction"))).toBe(true);
      expect(r3Gate.some((f) => f.startsWith("unverified_cascade_lines"))).toBe(true);

      // P1#1 + R5 P3#1: Even with an authentic WeakMap-registered RawCorpusSnapshot AND valid on-disk summary,
      // altering the in-memory rawMap MUST fail miningSummaryDigestVerified!
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({
          jsonlSha256: r3DiskSha,
          jsonlBytes: Buffer.byteLength(r3RawText, "utf8"),
          totalItems: 1,
        }),
        "utf8",
      );
      const authenticSnapshot = loadRawCorpusSnapshot(r3RawPath);
      const altRow = { ...r3Row, pr_diff_snippet: "diff --git a/op.cpp b/op.cpp\n+return 0;" };
      const altRep = verifyDistilledPayload(root, r3Payload, new Map([[altRow.key, altRow]]), {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
        rawSnapshot: authenticSnapshot,
      });
      expect(altRep.miningSummaryDigestVerified).toBe(false);

      // R5 P3#1 + P2#5: Real false-negative root claim (source-verified line claimed verbatim_root_verified=false)
      // AND verified root labeled verbatim_root_source="rejected" MUST fail claimedRootVerificationMismatchCount!
      const validLine =
        "[ERROR] RUNTIME(1,p): AclrtSynchronizeStreamWithTimeout failed, error code is 507015";
      const validForensicChain =
        "[1.时序与表象剥离] 首错为流同步超时 507015。[2.底层根因机理] 算子参数校验缺失导致 AICore 同步异常。[3.PR/MR代码分支核验] 已由合并修复补丁增加边界校验。";
      const falseNegPayload = {
        ...r3Payload,
        verbatimVerifiedCount: 0,
        modelVerbatimVerifiedCount: -1,
        fallbackVerbatimVerifiedCount: 0,
        forensicChainPresentCount: 1,
        teacherModelsUsed: ["unrelated-teacher"],
        familyCount: undefined,
        families: undefined,
        items: [
          {
            ...r3Payload.items[0]!,
            answer_parsed: true,
            verbatim_root_line: validLine,
            verbatim_root_verified: false,
            verbatim_root_source: "rejected",
            verbatim_cascade_lines: [],
            forensic_chain_zh: validForensicChain,
            thinking_summary: "同步超时分析摘要",
            distilled: {
              ...r3Payload.items[0]!.distilled,
              verbatim_root_line: validLine,
              verbatim_cascade_lines: [],
              fault_domain: "cann-aicore-smmu",
              subsystem: "invalid_subsystem_value",
              hardware_soc: "Ascend 910B",
              topology: "8-card",
              root_cause_zh: "流同步超时",
              pr_fix_mechanism_zh: "增加校验",
              fix_or_workaround_zh: "升级版本",
              same_code_trap_zh: "区分 OOM 与超时",
              error_codes: ["507015"],
              fix_pr_numbers: [15623],
              colloquial_queries_zh: [{} as unknown as string],
              forensic_chain_zh: validForensicChain,
            },
          },
        ],
      };
      const fnRep = verifyDistilledPayload(root, falseNegPayload, authenticSnapshot.map, {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
        rawSnapshot: authenticSnapshot,
      });
      expect(fnRep.auditedItems[0]?.verbatimRootVerified).toBe(true);
      expect(fnRep.claimedRootVerificationMismatchCount).toBe(1);
      expect(fnRep.unparsedItemsCount).toBe(1);
      const fnGate = evaluateAuditGate(falseNegPayload, fnRep, r3RawPath);
      expect(fnGate.some((f) => f.startsWith("claimed_root_verification_mismatch"))).toBe(true);
      expect(fnGate.some((f) => f.startsWith("producer_incomplete_or_failed"))).toBe(true);
      expect(fnGate.some((f) => f.startsWith("teacher_models_used_mismatch"))).toBe(true);
      expect(fnGate.some((f) => f.startsWith("producer_summary_count_mismatch"))).toBe(true);
      expect(fnGate.some((f) => f.startsWith("producer_family_contradiction"))).toBe(true);

      // R5 P2#2 + R6 P2#8 + P2#9: Git-quoted octal UTF-8 docs path, hunk `--- a/src/kernel.cpp`, and 1-arg `pr_diff_docs_only` all stay docs-only!
      const quotedDocsDiff =
        'diff --git "a/docs/\\347\\224\\250\\346\\263\\225.md" "b/docs/\\347\\224\\250\\346\\263\\225.md"\n+++ "b/docs/\\347\\224\\250\\346\\263\\225.md"\n+用法';
      expect(isDocsOnlyDiffSnippet(quotedDocsDiff)).toBe(true);
      expect(
        isDocsOnlyDiffSnippet(
          "diff --git a/docs/usage.md b/docs/usage.md\n--- a/docs/usage.md\n+++ b/docs/usage.md\n@@ -1,3 +1,2 @@\n--- a/src/kernel.cpp\n",
        ),
      ).toBe(true);
      const quotedDocsItem = {
        key: "gitcode:Ascend/msit#78",
        ecosystem: "gitcode" as const,
        repo: "Ascend/msit",
        number: 78,
        url: "https://gitcode.com/Ascend/msit/issues/78",
        title: "quoted docs diff",
        closed_at: "2026-01-01T00:00:00Z",
        comments_complete: true,
        raw_sha256: "a".repeat(64),
        pr_diff_lines: 3,
        pr_diff_source_ref: "gitcode:Ascend/msit!79",
        pr_diff_docs_only: true,
        linked_merged_prs: [
          {
            ref: "gitcode:Ascend/msit!79",
            number: 79,
            title: "fix(cli): clarify usage",
            url: "https://gitcode.com/Ascend/msit/merge_requests/79",
            source: "gitcode_linked_pr",
            has_diff: true,
          },
        ],
        verbatim_root_line: "",
        verbatim_root_verified: false,
        distilled: { root_cause_confirmed: true, fix_pr_refs: ["gitcode:Ascend/msit!79"] },
      };
      expect(partitionItemProvenance(quotedDocsItem, quotedDocsDiff).gitcodeConfirmedFixMrs).toEqual([]);
      // 1-arg partitionItemProvenance MUST also honor item.pr_diff_docs_only without rawDiffSnippet!
      expect(partitionItemProvenance(quotedDocsItem).gitcodeConfirmedFixMrs).toEqual([]);

      // R5 P1#3 + P2#3 + P2#5: Fabricated representative verbatim_root_line & wrong family counts fail;
      // cross-ecosystem github:vllm-project/vllm#58208 vs vllm-project/vllm#58208 reconciles cleanly!
      const badRepLinePayload = {
        ...falseNegPayload,
        verbatimVerifiedCount: 1,
        modelVerbatimVerifiedCount: 1,
        teacherModelsUsed: ["m"],
        familyCount: 1,
        families: [
          {
            familyId: "FAM-01",
            faultDomain: "cann-aicore-smmu",
            primarySymbol: "507015/AICore-Sync",
            dominantSubsystem: "cann-aiv-timeout",
            count: 1,
            verifiedRootCount: 1,
            confirmedRootCauseCount: 9999,
            withPrDiffCount: 9999,
            ecosystems: { gitcode: 1 },
            repos: { [r3Row.repo]: 1 },
            topErrorCodes: ["507015"],
            memberKeys: [r3Row.key],
            representatives: [
              {
                key: r3Row.key,
                repo: r3Row.repo,
                url: r3Row.url,
                title: r3Row.title,
                verbatim_root_line: "fabricated representative text absent from raw source",
                verbatim_root_verified: true,
                verified_fix_pr_refs: ["gitcode:cann/ops-transformer!15623"],
                cited_pr_refs: ["gitcode:cann/ops-transformer!15623"],
                fix_pr_refs: ["gitcode:cann/ops-transformer!15623"],
                root_cause_zh: "流同步超时",
                pr_fix_mechanism_zh: "增加校验",
                fix_or_workaround_zh: "升级版本",
                same_code_trap_zh: "区分 OOM 与超时",
                forensic_chain_zh: validForensicChain,
                thinking_summary: "同步超时分析摘要",
              },
            ],
          },
        ],
        items: [
          {
            ...falseNegPayload.items[0]!,
            teacher_model: "m",
            teacher_backend: "vllm",
            teacher_dtype: "bfloat16",
            verbatim_root_verified: true,
            verbatim_root_source: "model",
            distilled: {
              ...falseNegPayload.items[0]!.distilled,
              subsystem: "cann-aiv-timeout",
              colloquial_queries_zh: ["507015 同步超时"],
            },
          },
        ],
      };
      const badRepLineRep = verifyDistilledPayload(root, badRepLinePayload, authenticSnapshot.map, {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
        rawSnapshot: authenticSnapshot,
      });
      expect(badRepLineRep.unparsedItemsCount).toBe(0);
      expect(badRepLineRep.claimedRootVerificationMismatchCount).toBe(0);
      const badRepLineGate = evaluateAuditGate(badRepLinePayload, badRepLineRep, r3RawPath);
      expect(badRepLineGate.some((f) => f.startsWith("producer_family_membership_or_rep_mismatch"))).toBe(
        true,
      );

      // R5 P2#3: Cross-ecosystem GitCode issue citing `github:vllm-project/vllm#58208` reconciles cleanly against `vllm-project/vllm#58208`!
      const crossRow = {
        ...r3Row,
        key: "gitcode:Ascend/msit#58208",
        repo: "Ascend/msit",
        number: 58208,
        url: "https://gitcode.com/Ascend/msit/issues/58208",
        pr_diff_lines: 0,
        pr_diff_snippet: "",
        pr_diff_source_ref: undefined,
        linked_merged_prs: [
          {
            ref: "github:vllm-project/vllm#58208",
            number: 58208,
            title: "fix(core): cross-repo fix",
            url: "https://github.com/vllm-project/vllm/pull/58208",
            source: "github_linked_pr",
          },
        ],
      };
      const crossRawPath = join(r3Tmp, "cross_raw.jsonl");
      const crossRawText = `${JSON.stringify(crossRow)}\n`;
      writeFileSync(crossRawPath, crossRawText, "utf8");
      const crossSnap = loadRawCorpusSnapshot(crossRawPath);
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({
          jsonlSha256: crossSnap.sha256,
          jsonlBytes: crossSnap.bytes,
          totalItems: 1,
        }),
        "utf8",
      );
      const crossPayload = {
        ...badRepLinePayload,
        families: [
          {
            familyId: "FAM-01",
            faultDomain: "cann-aicore-smmu",
            primarySymbol: "507015/AICore-Sync",
            dominantSubsystem: "cann-aiv-timeout",
            count: 1,
            verifiedRootCount: 1,
            confirmedRootCauseCount: 1,
            withPrDiffCount: 0,
            ecosystems: { gitcode: 1 },
            repos: { [crossRow.repo]: 1 },
            topErrorCodes: ["507015"],
            sameCodeTraps: ["区分 OOM 与超时"],
            colloquialQueries: ["507015 同步超时"],
            memberKeys: [crossRow.key],
            representatives: [
              {
                key: crossRow.key,
                repo: crossRow.repo,
                url: crossRow.url,
                title: crossRow.title,
                verbatim_root_line: validLine,
                verbatim_root_verified: true,
                verified_fix_pr_refs: ["github:vllm-project/vllm#58208"],
                cited_pr_refs: ["github:vllm-project/vllm#58208"],
                fix_pr_refs: ["github:vllm-project/vllm#58208"],
                root_cause_zh: "流同步超时",
                pr_fix_mechanism_zh: "增加校验",
                fix_or_workaround_zh: "升级版本",
                same_code_trap_zh: "区分 OOM 与超时",
                forensic_chain_zh: validForensicChain,
                thinking_summary: "同步超时分析摘要",
              },
            ],
          },
        ],
        items: [
          {
            ...badRepLinePayload.items[0]!,
            key: crossRow.key,
            repo: crossRow.repo,
            number: crossRow.number,
            url: crossRow.url,
            pr_diff_lines: 0,
            pr_diff_source_ref: undefined,
            linked_merged_prs: crossRow.linked_merged_prs,
            content_input_sha256: computeDistillContentSha256(crossRow),
            resume_input_sha256: computeDistillInputSha256(crossRow, {
              teacherModel: "m",
              teacherBackend: "vllm",
              teacherDtype: "bfloat16",
              maxNewTokens: 1536,
              normalizerVersion: "f6-v3",
            }),
            distilled: {
              ...badRepLinePayload.items[0]!.distilled,
              fix_pr_refs: ["github:vllm-project/vllm#58208"],
              fix_pr_numbers: [58208],
            },
          },
        ],
      };
      const crossRep = verifyDistilledPayload(root, crossPayload, crossSnap.map, {
        inputPath: join(r3Tmp, "cross_dist.json"),
        rawCorpusPath: crossRawPath,
        rawSnapshot: crossSnap,
      });
      const crossGate = evaluateAuditGate(crossPayload, crossRep, crossRawPath);
      expect(crossGate).toEqual([]);

      // R7 P1#2 + P2#2 + P2#6 + P2#7 + P2#8 + P2#9 + P2#10 + P3#1 regressions:
      // 1) Reference-style, relative-inline, multi-link, nested-bracket, backtick-code-span, and balanced-paren Markdown links never qualify as fallback logs (R7+R8+R9+R10 P2#1)
      for (const badMd of [
        "- [RuntimeError: kernel launch failed][pr-42]\n- [RuntimeError: kernel launch failed](../pull/42)",
        "[RuntimeError: kernel launch failed][pr-42] [details][log]",
        "[RuntimeError: kernel launch failed](../pull/42) [details](../pull/43)",
        "[RuntimeError: kernel launch failed](../pull/foo(1))",
        "[RuntimeError: shape [1, 2] failed](../pull/42) [details](../logs)",
        "[RuntimeError: parser rejected `]` in shape](../pull/42) [details](../logs)",
      ]) {
        expect(extractFallbackVerbatimRootLine("link list", badMd, "", [])).toBe("");
      }
      // 1a) R10 P1#1b + P2#2: NBSP between [ERROR] and RUNTIME uses shared [ \t] rule identically to Python;
      //     multiline C++ OP_LOGE macro continuation rejected by fallback!
      expect(
        extractFallbackVerbatimRootLine(
          "nbsp",
          "[ERROR]\u00a0RUNTIME(1): sync fail\nValueError: fallback mismatch in kernel launch\n",
          "",
          [],
        ),
      ).toBe("ValueError: fallback mismatch in kernel launch");
      expect(
        extractFallbackVerbatimRootLine(
          "mlmacro",
          'OP_LOGE(opName,\n  "RuntimeError: kernel launch failed");\n',
          "",
          [],
        ),
      ).toBe("");
      // 1b) R8 P2#3: 480-code-point log ending in a supplementary emoji matches Python len(ln) == 480!
      const emoji480 = `RuntimeError: ${"a".repeat(465)}😀`;
      expect(Array.from(emoji480).length).toBe(480);
      expect(extractFallbackVerbatimRootLine("emoji480", emoji480, "", [])).toBe(emoji480);
      // 2) Plain multi-file unified diff with docs hunk followed by C++ file is NOT docs-only (R7 P2#7),
      //    while plain unified diff without a/ b/ prefix (--- docs/README.md) IS docs-only (R8 P2#7)!
      expect(
        isDocsOnlyDiffSnippet(
          "--- a/docs/README.md\n+++ b/docs/README.md\n@@ -1,1 +1,1 @@\n-old\n+new\n--- a/src/kernel.cpp\n+++ b/src/kernel.cpp\n@@ -1,1 +1,1 @@\n-return 0;\n+return -1;\n",
        ),
      ).toBe(false);
      expect(
        isDocsOnlyDiffSnippet("--- docs/README.md\n+++ docs/README.md\n@@ -1,1 +1,1 @@\n-old\n+new\n"),
      ).toBe(true);
      // 3) Remediation / code-review bullet / C++ macro / English control-experiment prose rejected as non-log (R7+R8+R9+R10)
      expect(
        isProseSummaryNotRuntimeLog(
          "本批对 6 个算子（ops-math#5189）开展审计与整改，静态命中 67 条，按检查语义逐处替换为正式语义码并补负向 UT。",
        ),
      ).toBe(true);
      expect(
        isProseSummaryNotRuntimeLog(
          "- test/st/algorithm/utils/src/hccl_proxy/hccl_stub.cc:1064 HcommSymWinGetPeerPointer 仍返回 HCCL_E_NOT_SUPPORT；",
        ),
      ).toBe(true);
      expect(isProseSummaryNotRuntimeLog('REPORT_INNER_ERR_MSG("EZ9999", ##__VA_ARGS__);  \\')).toBe(true);
      expect(isProseSummaryNotRuntimeLog('HCCL_INFO("[InconsistentCheckParams] channels is empty.");')).toBe(
        true,
      );
      expect(isProseSummaryNotRuntimeLog('OP_LOGE(opName, "RuntimeError: kernel launch failed");')).toBe(
        true,
      );
      expect(
        isProseSummaryNotRuntimeLog(
          "SFA had 24 query rows, KPool returned 20 index rows, and `KvQuantSparseFlashAttentionVllm` raised `EZ0008`",
        ),
      ).toBe(true);
      // R9 P2#10b + R10 P2#3: Genuine bare HCCL_E_* error codes pass; NOTIFY_WAIT, HCCL_SUCCESS, NPU_VISIBLE_DEVICES fail!
      for (const bareCode of ["HCCL_E_PARA", "HCCL_E_INTERNAL", "HCCL_E_NOT_SUPPORT"]) {
        expect(isSingleLineInField(bareCode, bareCode, "")).toBe(true);
      }
      for (const badBare of [
        "NOTIFY_WAIT",
        "HCCL_SUCCESS",
        "NPU_VISIBLE_DEVICES",
        "ACL_ERROR_NONE",
        "[InsV2AllToAllConcurrentExecutorCalcRes]",
      ]) {
        expect(isSingleLineInField(badBare, badBare, "")).toBe(false);
      }
      // 4) Forensic chain overall & per-stage min lengths count Unicode code points, not UTF-16 units (R7+R8 P3#1)
      expect(isValidForensicChain("[1.a] 😀😀😀😀[2.b] 😀😀😀😀[3.c] ok12")).toBe(false);
      expect(
        isValidForensicChain(
          "[1.a] 😀😀 [2.b] 算子参数校验缺失导致核心异常触发同步超时 [3.c] 已由合并修复补丁增加边界校验",
        ),
      ).toBe(false);
      // 5) Producer family integrity mutations (including padded familyId & fictitious (ecosystem) suffix!) fail (R7 P1#2 + R8 P1#1)
      for (const mutatedFam of [
        { ...crossPayload.families[0]!, familyId: "FAM-99" },
        { ...crossPayload.families[0]!, familyId: " FAM-01 " },
        { ...crossPayload.families[0]!, primarySymbol: "FORGED_SYMBOL" },
        { ...crossPayload.families[0]!, primarySymbol: "507015/AICore-Sync (ecosystem)" },
        { ...crossPayload.families[0]!, sameCodeTraps: [] },
        { ...crossPayload.families[0]!, colloquialQueries: [] },
        {
          ...crossPayload.families[0]!,
          representatives: [
            crossPayload.families[0]!.representatives[0]!,
            crossPayload.families[0]!.representatives[0]!,
          ],
        },
        {
          ...crossPayload.families[0]!,
          representatives: [{ ...crossPayload.families[0]!.representatives[0]!, fix_pr_refs: undefined }],
        },
      ]) {
        const g = evaluateAuditGate({ ...crossPayload, families: [mutatedFam] }, crossRep, crossRawPath);
        expect(g.some((f) => f.startsWith("producer_family_membership_or_rep_mismatch"))).toBe(true);
      }
      // 6) Invalid schemaVersion, header normalizerVersion, or omitted/out-of-range/corrupt maxNewTokens (>7168!) fail BOTH verifyDistilledPayload & gate (R7+R8+R9 P2#8)
      for (const badMeta of [
        { ...crossPayload, schemaVersion: 99 },
        { ...crossPayload, normalizerVersion: "f6-v2" },
        { ...crossPayload, maxNewTokens: undefined },
        { ...crossPayload, maxNewTokens: 7169 },
        { ...crossPayload, maxNewTokens: 8192 },
        { ...crossPayload, maxNewTokens: "corrupt" as unknown as number },
      ]) {
        const badMetaRep = verifyDistilledPayload(root, badMeta, crossSnap.map, {
          inputPath: join(r3Tmp, "cross_dist.json"),
          rawCorpusPath: crossRawPath,
          rawSnapshot: crossSnap,
        });
        expect(badMetaRep.provenanceConflictCount).toBeGreaterThanOrEqual(1);
        expect(evaluateAuditGate(badMeta, badMetaRep, crossRawPath).length).toBeGreaterThan(0);
      }
      // 7) Invented code, whitespace " ", full-width digits, and prose word "remediation" each fail ungrounded_error_codes (R7+R8+R9 P2#9)
      for (const badCode of ["INVENTED_UNGROUNDED_CODE", " ", "remediation", "５０７０１５"]) {
        const ungroundedPayload = {
          ...crossPayload,
          items: [
            {
              ...crossPayload.items[0]!,
              distilled: {
                ...crossPayload.items[0]!.distilled,
                error_codes: ["507015", badCode],
              },
            },
          ],
        };
        const ungroundedRep = verifyDistilledPayload(root, ungroundedPayload, crossSnap.map, {
          inputPath: join(r3Tmp, "cross_dist.json"),
          rawCorpusPath: crossRawPath,
          rawSnapshot: crossSnap,
        });
        expect(ungroundedRep.ungroundedErrorCodesCount).toBe(1);
        expect(
          evaluateAuditGate(ungroundedPayload, ungroundedRep, crossRawPath).some((f) =>
            f.startsWith("ungrounded_error_codes"),
          ),
        ).toBe(true);
      }
      // 8) Mixed-teacher header pairing teacher A with teacher B's backend/dtype fails teacher_config_tuple_mismatch (P2#6),
      //    AND reversed topErrorCodes ranking on a 2-row family fails producer_family_membership_or_rep_mismatch (P1#2)!
      const secondRow = {
        ...crossRow,
        key: "gitcode:Ascend/msit#58209",
        number: 58209,
        url: "https://gitcode.com/Ascend/msit/issues/58209",
        body: `${validLine}\nEZ9999 kernel fail`,
        raw_sha256: computeRawSha256(crossRow.title, `${validLine}\nEZ9999 kernel fail`, ""),
      };
      const twoRawPath = join(r3Tmp, "two_raw.jsonl");
      const twoRawText = `${JSON.stringify(crossRow)}\n${JSON.stringify(secondRow)}\n`;
      writeFileSync(twoRawPath, twoRawText, "utf8");
      const twoSnap = loadRawCorpusSnapshot(twoRawPath);
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({ jsonlSha256: twoSnap.sha256, jsonlBytes: twoSnap.bytes, totalItems: 2 }),
        "utf8",
      );
      const twoPayload = {
        ...crossPayload,
        teacherModel: "m",
        teacherModelsUsed: ["m", "m2"],
        backend: "transformers",
        dtype: "float16",
        totalIssues: 2,
        verbatimVerifiedCount: 2,
        modelVerbatimVerifiedCount: 2,
        forensicChainPresentCount: 2,
        families: [
          {
            ...crossPayload.families[0]!,
            count: 2,
            verifiedRootCount: 2,
            confirmedRootCauseCount: 2,
            ecosystems: { gitcode: 2 },
            repos: { [crossRow.repo]: 2 },
            topErrorCodes: ["EZ9999", "507015"], // reversed: EZ9999 (1) ahead of 507015 (2)!
            memberKeys: [crossRow.key, secondRow.key],
            representatives: [
              crossPayload.families[0]!.representatives[0]!,
              {
                ...crossPayload.families[0]!.representatives[0]!,
                key: secondRow.key,
                url: secondRow.url,
              },
            ],
          },
        ],
        items: [
          crossPayload.items[0]!,
          {
            ...crossPayload.items[0]!,
            key: secondRow.key,
            number: secondRow.number,
            url: secondRow.url,
            raw_sha256: secondRow.raw_sha256,
            teacher_model: "m2",
            teacher_backend: "transformers",
            teacher_dtype: "float16",
            content_input_sha256: computeDistillContentSha256(secondRow),
            resume_input_sha256: computeDistillInputSha256(secondRow, {
              teacherModel: "m2",
              teacherBackend: "transformers",
              teacherDtype: "float16",
              maxNewTokens: 1536,
              normalizerVersion: "f6-v3",
            }),
            distilled: {
              ...crossPayload.items[0]!.distilled,
              error_codes: ["507015", "EZ9999"],
            },
          },
        ],
      };
      const twoRep = verifyDistilledPayload(root, twoPayload, twoSnap.map, {
        inputPath: join(r3Tmp, "two_dist.json"),
        rawCorpusPath: twoRawPath,
        rawSnapshot: twoSnap,
      });
      const twoGate = evaluateAuditGate(twoPayload, twoRep, twoRawPath);
      expect(twoGate.some((f) => f.startsWith("teacher_config_tuple_mismatch"))).toBe(true);
      expect(twoGate.some((f) => f.startsWith("producer_family_membership_or_rep_mismatch"))).toBe(true);
      // Restore single-row summary for subsequent crossRawPath assertions
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({ jsonlSha256: crossSnap.sha256, jsonlBytes: crossSnap.bytes, totalItems: 1 }),
        "utf8",
      );

      // R6 P1#4 + P2#3 + P2#6 + P2#7 + P2#11: Fabricated family domain/error codes/rep evidence, missing distilled,
      // omitted teacherModelsUsed / mismatched backend+dtype, 1-char forensic chain, and impossible fallback attribution all fail cleanly!
      const forgedFamPayload = {
        ...crossPayload,
        teacherModelsUsed: undefined,
        backend: "wrong-backend",
        dtype: "fp99",
        families: [
          {
            ...crossPayload.families[0]!,
            faultDomain: "memory-oom",
            topErrorCodes: ["FAKE_CODE"],
            representatives: [
              {
                ...crossPayload.families[0]!.representatives[0]!,
                forensic_chain_zh: undefined,
                cited_pr_refs: ["gitcode:cann/hccl!999"],
                thinking_summary: "invented thinking summary",
              },
            ],
          },
        ],
      };
      const forgedFamGate = evaluateAuditGate(forgedFamPayload, crossRep, crossRawPath);
      expect(forgedFamGate.some((f) => f.startsWith("teacher_backend_mismatch"))).toBe(true);
      expect(forgedFamGate.some((f) => f.startsWith("teacher_dtype_mismatch"))).toBe(true);
      expect(forgedFamGate.some((f) => f.startsWith("teacher_models_used_mismatch"))).toBe(true);
      expect(forgedFamGate.some((f) => f.startsWith("producer_family_membership_or_rep_mismatch"))).toBe(
        true,
      );

      // R6 P2#6: Missing `distilled` object MUST NOT throw TypeError; counts as unparsed & fails gate cleanly!
      const missingDistilledPayload = {
        ...crossPayload,
        items: [
          {
            ...crossPayload.items[0]!,
            distilled: undefined as unknown as (typeof crossPayload.items)[0]["distilled"],
          },
        ],
      };
      const missingDistRep = verifyDistilledPayload(root, missingDistilledPayload, crossSnap.map, {
        inputPath: join(r3Tmp, "cross_dist.json"),
        rawCorpusPath: crossRawPath,
        rawSnapshot: crossSnap,
      });
      expect(missingDistRep.unparsedItemsCount).toBe(1);

      // R6 P2#3 + P2#11: Substring root mislabeled `fallback_log_extractor` AND 1-char forensic chain `"x"` fail!
      const subRootPayload = {
        ...crossPayload,
        items: [
          {
            ...crossPayload.items[0]!,
            verbatim_root_line: "AclrtSynchronizeStreamWithTimeout failed, error code is 507015",
            verbatim_root_source: "fallback_log_extractor",
            forensic_chain_zh: "x",
            distilled: {
              ...crossPayload.items[0]!.distilled,
              verbatim_root_line: "AclrtSynchronizeStreamWithTimeout failed, error code is 507015",
              forensic_chain_zh: "x",
            },
          },
        ],
      };
      const subRootRep = verifyDistilledPayload(root, subRootPayload, crossSnap.map, {
        inputPath: join(r3Tmp, "cross_dist.json"),
        rawCorpusPath: crossRawPath,
        rawSnapshot: crossSnap,
      });
      expect(subRootRep.claimedRootVerificationMismatchCount).toBe(1);
      expect(subRootRep.unparsedItemsCount).toBe(1);
      expect(subRootRep.forensicChainPresentCount).toBe(0);

      // R4 P1#2: Nonexistent non-null rawCorpusPath MUST fail gate (`unreadable_raw_corpus`)
      const ghostPath = join(r3Tmp, "does_not_exist.jsonl");
      const ghostGate = evaluateAuditGate(r3Payload, r3RepBadSummary, ghostPath);
      expect(ghostGate.some((f) => f.startsWith("unreadable_raw_corpus"))).toBe(true);

      // R4 P2#2: Missing jsonlBytes or totalItems in dual_mining_summary.json MUST fail verification
      writeFileSync(
        join(r3Tmp, "dual_mining_summary.json"),
        JSON.stringify({ jsonlSha256: r3DiskSha }),
        "utf8",
      );
      const missingFieldsRep = verifyDistilledPayload(root, r3Payload, new Map([[r3Row.key, r3Row]]), {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
      });
      expect(missingFieldsRep.miningSummaryDigestVerified).toBe(false);

      // R4 P1#5 + P1#7 + P2#1: Fabricated cascade equal to rejected root,
      // bad family member/representative claim, expectedTotalIssues mismatch, and header teacher mismatch all fail!
      const badFamilyPayload = {
        ...r3Payload,
        expectedTotalIssues: 99,
        teacherModel: "forged-header-teacher",
        verbatimVerifiedCount: "0" as unknown as number,
        familyCount: 1,
        families: [
          {
            count: 1,
            verifiedRootCount: 0,
            memberKeys: ["nonexistent/repo#9999"],
            representatives: [
              {
                key: r3Row.key,
                verbatim_root_verified: false,
                verified_fix_pr_refs: ["gitcode:cann/ops-transformer!99999"],
              },
            ],
          },
        ],
        items: [
          {
            ...r3Payload.items[0]!,
            teacher_model: "m",
            answer_parsed: true,
            verbatim_root_line: "fabricated crash line at foo.cc:42",
            verbatim_root_verified: false,
            verbatim_cascade_lines: ["fabricated crash line at foo.cc:42"],
            distilled: {
              ...r3Payload.items[0]!.distilled,
              verbatim_root_line: "fabricated crash line at foo.cc:42",
              verbatim_cascade_lines: ["fabricated crash line at foo.cc:42"],
            },
          },
        ],
      };
      const badFamRep = verifyDistilledPayload(root, badFamilyPayload, new Map([[r3Row.key, r3Row]]), {
        inputPath: join(r3Tmp, "dist.json"),
        rawCorpusPath: r3RawPath,
      });
      expect(badFamRep.unverifiedCascadeLinesCount).toBeGreaterThanOrEqual(1);
      const badFamGate = evaluateAuditGate(badFamilyPayload, badFamRep, r3RawPath);
      expect(badFamGate.some((f) => f.startsWith("expected_total_issues_mismatch"))).toBe(true);
      expect(badFamGate.some((f) => f.startsWith("teacher_model_mismatch"))).toBe(true);
      expect(badFamGate.some((f) => f.startsWith("verbatim_verified_count_mismatch"))).toBe(true);
      expect(badFamGate.some((f) => f.startsWith("producer_family_membership_or_rep_mismatch"))).toBe(true);
      expect(badFamGate.some((f) => f.startsWith("unverified_cascade_lines"))).toBe(true);

      // R11 P1#1 + P2#1 + P2#2 + P2#4 + P2#5 + P2#6-bis + P3#1 regressions:
      // 1) Full-width `１. [ERROR]...` uses ASCII ^[0-9]+\.[ \t]+ parity (not skipped like \d+\.\s+)
      expect(
        extractFallbackVerbatimRootLine(
          "fw-num",
          "１. [ERROR] RUNTIME(1): kernel launch failed\nValueError: fallback mismatch in kernel launch\n",
          "",
          [],
        ),
      ).toBe("１. [ERROR] RUNTIME(1): kernel launch failed");
      // 2) Quoted Markdown link title containing `(` still counts as a link list line
      const qLink =
        '[RuntimeError: parser rejected `]` in shape](../pull/42 "worker (rank 0") [details](../logs)';
      expect(extractFallbackVerbatimRootLine("qlink", qLink, "", [])).toBe("");
      expect(hasNonProseSourceOccurrence("RuntimeError: parser rejected", qLink, "")).toBe(false);
      // 3) C++ comment `// )` & 8 intervening comment lines do not close OP_LOGE early; warnings.warn rejected
      const cppCmtMacro = [
        "OP_LOGE(opName, // )",
        ...Array.from({ length: 8 }, () => "// intervening comment"),
        '  "RuntimeError: kernel launch failed: %d", rc);',
        'warnings.warn("[WARN] deprecated kernel path", RuntimeWarning)',
      ].join("\n");
      expect(extractFallbackVerbatimRootLine("cppcmt", cppCmtMacro, "", [])).toBe("");
      expect(hasNonProseSourceOccurrence("RuntimeError: kernel launch failed", cppCmtMacro, "")).toBe(false);
      expect(isProseSummaryNotRuntimeLog('warnings.warn("RuntimeError: warn", RuntimeWarning)')).toBe(true);
      // 4) `#13934` narrative prose rejected & `#20510` prose cascade fails unverifiedCascadeLinesCount
      expect(
        isProseSummaryNotRuntimeLog(
          "the decode worker crashes with `KeyError: 'prefill_worker_0'` on failover.",
        ),
      ).toBe(true);
      const p20510Body =
        "Without this patch, the worker fails during startup, terminating the engine with HTTP 500.";
      const p20510Row = {
        ...crossRow,
        body: p20510Body,
        raw_sha256: computeRawSha256(crossRow.title, p20510Body, ""),
      };
      const p20510SnapMap = new Map([[p20510Row.key, p20510Row]]);
      const p20510Payload = {
        ...crossPayload,
        items: [
          {
            ...crossPayload.items[0]!,
            key: p20510Row.key,
            raw_sha256: p20510Row.raw_sha256,
            content_input_sha256: computeDistillContentSha256(p20510Row),
            resume_input_sha256: computeDistillInputSha256(p20510Row, {
              teacherModel: "m",
              teacherBackend: "vllm",
              teacherDtype: "bfloat16",
              maxNewTokens: 1536,
              normalizerVersion: "f6-v3",
            }),
            verbatim_root_line: "",
            verbatim_root_verified: false,
            verbatim_root_source: "rejected",
            verbatim_cascade_lines: ["terminating the engine with HTTP 500."],
            distilled: {
              ...crossPayload.items[0]!.distilled,
              verbatim_root_line: "",
              verbatim_cascade_lines: ["terminating the engine with HTTP 500."],
            },
          },
        ],
      };
      const p20510Rep = verifyDistilledPayload(root, p20510Payload, p20510SnapMap, {
        inputPath: join(r3Tmp, "cross_dist.json"),
        rawCorpusPath: crossRawPath,
      });
      expect(p20510Rep.unverifiedCascadeLinesCount).toBe(1);
      // 5) Clearing a deterministic fallback root to `rejected` triggers claimedRootVerificationMismatchCount
      const clearedFbPayload = {
        ...crossPayload,
        items: [
          {
            ...crossPayload.items[0]!,
            verbatim_root_line: "",
            verbatim_root_verified: false,
            verbatim_root_source: "rejected",
            distilled: { ...crossPayload.items[0]!.distilled, verbatim_root_line: "" },
          },
        ],
      };
      const clearedFbRep = verifyDistilledPayload(root, clearedFbPayload, crossSnap.map, {
        inputPath: join(r3Tmp, "cross_dist.json"),
        rawCorpusPath: crossRawPath,
        rawSnapshot: crossSnap,
      });
      expect(clearedFbRep.claimedRootVerificationMismatchCount).toBe(1);
      // 6) Omitting maxNewTokens on a current-schema payload with missing raw row STILL flags provenanceConflictCount
      const omittedBudgetMissingRawRep = verifyDistilledPayload(
        root,
        { ...crossPayload, maxNewTokens: undefined },
        new Map(),
        { inputPath: join(r3Tmp, "cross_dist.json"), rawCorpusPath: crossRawPath },
      );
      expect(omittedBudgetMissingRawRep.provenanceConflictCount).toBe(1);
    } finally {
      rmSync(r3Tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
