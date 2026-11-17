import { type CouplingCheckInput, DEFAULT_RULE_VERSION, type RuleVersion, VERIFIED_COMMITS } from "./types";

export const HCCL_DEFAULT_BUFFER_SIZE_MIB = 200;
export const HCCL_MIN_DP_BUFFER_SIZE_MIB = 50;
export const HCCL_DYNAMIC_EPLB_BUFFER_SIZE_MIB = 100;
export const HCCL_SLEEP_LIFECYCLE_ANCHOR_BUFFER_SIZE_MIB = 1;
export const HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB = 150;

export interface HcclAccountingInput extends CouplingCheckInput {
  hasInternalDpGroups?: boolean;
  engramEnabled?: boolean;
  engramDpSharedMemory?: boolean;
  etpSize?: number;
  enableEplb?: boolean;
  dynamicEplb?: boolean;
  pdHeadRatio?: number;
  qkvIprojTensorParallelSize?: number;
  sleepModeExtraCleanup?: boolean;
  netloaderEnabled?: boolean;
  netloaderDraftEnabled?: boolean;
}

export interface HcclDomainEntry {
  groupName: string;
  bufferSizeMiB: number | null;
  reuseDomain: string;
  ranksSignature: string;
  deduplicatedInto?: string;
  source: string;
  notes: string;
}

export interface ProfileRunOverlapInfo {
  alreadyIncludedInProfileRun: true;
  initSnapshotPrecedesDistributedInit: true;
  underestimationSafetyBufferMiB: number;
  nonTorchMemoryNote: string;
  anchors: readonly string[];
}

export interface HcclMemoryEstimate {
  version: RuleVersion;
  dpBufferSizeMiB: number;
  logicalGroups: readonly HcclDomainEntry[];
  uniqueMaterializedGroups: readonly HcclDomainEntry[];
  deduplicatedGroupCount: number;
  totalMaterializedMiB: number;
  mc2GovernedByCannBuffsize: boolean;
  profileRunOverlap: ProfileRunOverlapInfo;
}

/**
 * `calculate_dp_buffer_size()` from `vllm_ascend/utils.py`:
 * `max(math.ceil((dp_size + 1) * 4 / (1024 * 1024)), 50)` MiB.
 */
export function calculateDpBufferSizeMiB(dpSize: number): number {
  const safeDp = Math.max(1, dpSize);
  const int32Bytes = 4;
  const computed = Math.ceil(((safeDp + 1) * int32Bytes) / (1024 * 1024));
  return Math.max(computed, HCCL_MIN_DP_BUFFER_SIZE_MIB);
}

/**
 * `_resolve_reuse_domain(group_name)` from `patch_distributed.py`.
 */
export function resolveReuseDomain(groupName: string): string {
  const groupBaseName = groupName.split(":")[0] ?? groupName;
  if (groupBaseName.includes("eplb") || groupBaseName === "mc2") {
    return groupBaseName;
  }
  return "shared";
}

function makeKey(ranksSignature: string, bufferSizeMiB: number | null, reuseDomain: string): string {
  return `hccl|${ranksSignature}|${bufferSizeMiB ?? "none"}|${reuseDomain}`;
}

function formatRanksSignature(ranks: readonly number[]): string {
  if (ranks.length === 0) return "[]";
  const first = ranks[0] ?? 0;
  let contiguous = ranks.length >= 3;
  if (contiguous) {
    for (let i = 1; i < ranks.length; i += 1) {
      if (ranks[i] !== first + i) {
        contiguous = false;
        break;
      }
    }
  }
  if (contiguous) {
    return `[${first}..${ranks[ranks.length - 1]}]`;
  }
  return `[${ranks.join(",")}]`;
}

interface VllmParallelStateLines {
  world: string;
  innerDpWorld: string;
  tp: string;
  etp: string;
  edp: string;
  dcp: string;
  pcp: string;
  pp: string;
  dp: string;
  ep: string;
  eplb: string;
}

const VLLM_PARALLEL_STATE_LINES: Record<"v030" | "main", VllmParallelStateLines> = {
  v030: {
    world: "L1762",
    innerDpWorld: "L1933",
    tp: "L2074",
    etp: "L2077-L2096",
    edp: "L2125",
    dcp: "L2148",
    pcp: "L2167",
    pp: "L2185",
    dp: "L2203",
    ep: "L2237",
    eplb: "L2262",
  },
  main: {
    world: "L1876",
    innerDpWorld: "L2087",
    tp: "L2232",
    etp: "L2242-L2255",
    edp: "L2302",
    dcp: "L2328",
    pcp: "L2347",
    pp: "L2365",
    dp: "L2394",
    ep: "L2431",
    eplb: "L2456",
  },
};

function getProfileRunOverlapAnchors(version: RuleVersion): readonly string[] {
  if (version === "main") {
    const c = VERIFIED_COMMITS.vllmAscendMain;
    return [
      `vllm-ascend@${c}:vllm_ascend/utils.py#L73-L77`,
      `vllm-ascend@${c}:vllm_ascend/utils.py#L1252-L1299`,
      `vllm-ascend@${c}:vllm_ascend/patch/worker/patch_distributed.py#L40-L188`,
      `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L552-L581`,
      `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L712-L746`,
      `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L1042-L1057`,
      `vllm-ascend@${c}:vllm_ascend/_310p/worker_310p.py#L99-L112`,
      `vllm-ascend@${c}:vllm_ascend/_310p/worker_310p.py#L158-L169`,
    ];
  }
  if (version === "rfork") {
    const c = VERIFIED_COMMITS.rforkMain;
    return [
      `rfork@${c}:vllm_ascend/utils.py#L64-L68`,
      `rfork@${c}:vllm_ascend/utils.py#L1034-L1079`,
      `rfork@${c}:vllm_ascend/patch/worker/patch_distributed.py#L39-L179`,
      `rfork@${c}:vllm_ascend/worker/worker.py#L452-L481`,
      `rfork@${c}:vllm_ascend/worker/worker.py#L543-L570`,
      `rfork@${c}:vllm_ascend/worker/worker.py#L784-L798`,
      `rfork@${c}:vllm_ascend/_310p/worker_310p.py#L76-L97`,
      `rfork@${c}:vllm_ascend/_310p/worker_310p.py#L141-L152`,
    ];
  }
  const c = VERIFIED_COMMITS.vllmAscendV030;
  return [
    `vllm-ascend@${c}:vllm_ascend/utils.py#L73-L77`,
    `vllm-ascend@${c}:vllm_ascend/utils.py#L1241-L1288`,
    `vllm-ascend@${c}:vllm_ascend/patch/worker/patch_distributed.py#L39-L187`,
    `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L461-L490`,
    `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L601-L634`,
    `vllm-ascend@${c}:vllm_ascend/worker/worker.py#L915-L925`,
    `vllm-ascend@${c}:vllm_ascend/_310p/worker_310p.py#L102-L143`,
    `vllm-ascend@${c}:vllm_ascend/_310p/worker_310p.py#L172-L204`,
  ];
}

export function estimateHcclDomainMemory(
  input: HcclAccountingInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): HcclMemoryEstimate {
  const tp = Math.max(1, input.tpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  const dp = Math.max(1, input.dpSize ?? 1);
  const pcp = Math.max(1, input.pcpSize ?? 1);
  const dcp = Math.max(1, input.dcpSize ?? 1);
  const kvpp = Math.max(1, input.kvppSize ?? 1);
  const worldSize = tp * pp * dp * pcp;

  const vllmCommit = version === "main" ? VERIFIED_COMMITS.vllmMainFetched : VERIFIED_COMMITS.vllmV030;
  const vllmLines = version === "main" ? VLLM_PARALLEL_STATE_LINES.main : VLLM_PARALLEL_STATE_LINES.v030;
  const ascendRepoPrefix =
    version === "rfork"
      ? `rfork@${VERIFIED_COMMITS.rforkMain}`
      : `vllm-ascend@${version === "main" ? VERIFIED_COMMITS.vllmAscendMain : VERIFIED_COMMITS.vllmAscendV030}`;

  const dpBufferSizeMiB = calculateDpBufferSizeMiB(dp);
  const candidateGroups: HcclDomainEntry[] = [];

  const pushGroup = (
    groupName: string,
    bufferSizeMiB: number | null,
    ranks: readonly number[],
    source: string,
    notes: string,
  ): void => {
    candidateGroups.push({
      groupName,
      bufferSizeMiB,
      reuseDomain: resolveReuseDomain(groupName),
      ranksSignature: formatRanksSignature(ranks),
      source,
      notes,
    });
  };

  // Canonical coordinate mapping matching vllm all_ranks shape (1, dp, pp, pcp, tp)
  const rankAt = (d: number, p: number, c: number, t: number): number => ((d * pp + p) * pcp + c) * tp + t;

  const worldRanks = Array.from({ length: worldSize }, (_, i) => i);
  const innerDpWorldRanks = Array.from({ length: tp * pp * pcp }, (_, i) => i);
  const tpRanks = Array.from({ length: tp }, (_, t) => rankAt(0, 0, 0, t));
  const ppRanks = Array.from({ length: pp }, (_, p) => rankAt(0, p, 0, 0));
  const dpRanks = Array.from({ length: dp }, (_, d) => rankAt(d, 0, 0, 0));
  const pcpRanks = Array.from({ length: pcp }, (_, c) => rankAt(0, 0, c, 0));

  const dcpRanks: number[] = [];
  if (dcp === 1) {
    dcpRanks.push(0);
  } else {
    // all_ranks.transpose(-1, -2).reshape(-1, dcp)[0] -> iterates tp first, then pcp
    const limit = Math.min(dcp, tp * pcp);
    for (let k = 0; k < limit; k += 1) {
      const t = Math.floor(k / pcp);
      const c = k % pcp;
      dcpRanks.push(rankAt(0, 0, c, t));
    }
    if (version === "main") {
      dcpRanks.sort((a, b) => a - b);
    }
  }

  const epRanks: number[] = [];
  for (let d = 0; d < dp; d += 1) {
    for (let c = 0; c < pcp; c += 1) {
      for (let t = 0; t < tp; t += 1) {
        epRanks.push(rankAt(d, 0, c, t));
      }
    }
  }

  pushGroup(
    "world",
    HCCL_DEFAULT_BUFFER_SIZE_MIB,
    worldRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.world}`,
    "Global world group",
  );

  if (input.hasInternalDpGroups) {
    pushGroup(
      "inner_dp_world",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      innerDpWorldRanks,
      `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.innerDpWorld}`,
      "External DP / multi-DP-group inner world",
    );
  }

  pushGroup(
    "tp",
    HCCL_DEFAULT_BUFFER_SIZE_MIB,
    tpRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.tp}`,
    "Tensor parallel group",
  );

  if (input.engramEnabled) {
    const etpSize = Math.max(1, input.etpSize ?? tp);
    const etpRanks: number[] = [];
    if (etpSize === tp) {
      etpRanks.push(...tpRanks);
    } else {
      const limit = Math.min(etpSize, dp * tp);
      for (let k = 0; k < limit; k += 1) {
        const d = Math.floor(k / tp);
        const t = k % tp;
        etpRanks.push(rankAt(d, 0, 0, t));
      }
    }
    const etpSource =
      version === "main" && etpSize !== tp
        ? `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#L107`
        : `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.etp}`;
    pushGroup("etp", HCCL_DEFAULT_BUFFER_SIZE_MIB, etpRanks, etpSource, "Engram TP group");

    if (!input.engramDpSharedMemory) {
      const edpRanks: number[] = [];
      if (pcp > 1) {
        for (let d = 0; d < dp; d += 1) {
          for (let c = 0; c < pcp; c += 1) {
            edpRanks.push(rankAt(d, 0, c, 0));
          }
        }
      } else {
        edpRanks.push(...dpRanks);
      }
      const edpSource =
        version !== "rfork" && pcp > 1
          ? `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${version === "main" ? "L134" : "L104"}`
          : `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.edp}`;
      pushGroup(
        "edp",
        HCCL_DEFAULT_BUFFER_SIZE_MIB,
        edpRanks,
        edpSource,
        "Engram DP group (uses gloo when dp_shared_memory=True)",
      );
    }
  }

  pushGroup(
    "dcp",
    HCCL_DEFAULT_BUFFER_SIZE_MIB,
    dcpRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.dcp}`,
    "Decode context parallel group",
  );

  pushGroup(
    "pcp",
    HCCL_DEFAULT_BUFFER_SIZE_MIB,
    pcpRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.pcp}`,
    "Prefill context parallel group",
  );

  pushGroup(
    "pp",
    HCCL_DEFAULT_BUFFER_SIZE_MIB,
    ppRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.pp}`,
    "Pipeline parallel group",
  );

  if (version === "main" && pp > 1) {
    pushGroup(
      "pp_single_stage",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      [0],
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/distributed/parallel_state.py#L2376`,
      "Main-only single-rank PP stage group",
    );
    pushGroup(
      "pp_broadcast",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      ppRanks,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/worker/v2/model_runner.py#L184`,
      "Main-only HCCL PP broadcast group",
    );
  }

  pushGroup(
    "dp",
    dpBufferSizeMiB,
    dpRanks,
    `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.dp}`,
    `DP group uses max(ceil((dp+1)*4/1MiB), 50) = ${dpBufferSizeMiB} MiB`,
  );

  if (input.isMoe) {
    pushGroup(
      "ep",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      epRanks,
      `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.ep}`,
      "Expert parallel group (dp * pcp * tp)",
    );
  }

  if (input.enableEplb) {
    pushGroup(
      "eplb",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      epRanks,
      `vllm@${vllmCommit}:vllm/distributed/parallel_state.py#${vllmLines.eplb}`,
      "EPLB group (reuse_domain='eplb', not shared)",
    );
  }

  const mc2Line = version === "main" ? "L195" : version === "rfork" ? "L87" : "L165";
  pushGroup(
    "mc2",
    null,
    epRanks,
    `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${mc2Line}`,
    "MC2 group returns pg_options=None and is governed by CANN HCCL_BUFFSIZE",
  );

  if (input.dynamicEplb) {
    const dynEplbLine = version === "main" ? "L200" : version === "rfork" ? "L91" : "L170";
    pushGroup(
      "dynamic_eplb",
      HCCL_DYNAMIC_EPLB_BUFFER_SIZE_MIB,
      epRanks,
      `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${dynEplbLine}`,
      "Dynamic EPLB group (100 MiB, reuse_domain='dynamic_eplb')",
    );
  }

  if (kvpp > 1 && version !== "rfork") {
    const kvppRanks = Array.from({ length: Math.min(kvpp, pcp * tp) }, (_, i) => i);
    const kvppLine = version === "main" ? "L150" : "L120";
    pushGroup(
      "kvpp",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      kvppRanks,
      `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${kvppLine}`,
      "KV layer parallel group",
    );
  }

  if (input.kvRole === "kv_producer" && (input.pdHeadRatio ?? 1) > 1) {
    const subTp = Math.max(1, Math.floor(tp / (input.pdHeadRatio ?? 1)));
    const pTp0Ranks = Array.from({ length: subTp }, (_, i) => i);
    const pTpLine = version === "main" ? "L181" : version === "rfork" ? "L73" : "L151";
    pushGroup(
      "p_tp_0",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      pTp0Ranks,
      `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${pTpLine}`,
      "PD producer sub-TP group",
    );
  }

  // Fine-grained TP slices along DP axis: stage_ranks[0:group_size, 0] -> stride pcp * tp
  const buildFineGrainedDpAxisRanks = (size: number): number[] => {
    const clamped = Math.max(1, Math.min(dp, size));
    return Array.from({ length: clamped }, (_, d) => rankAt(d, 0, 0, 0));
  };

  const fgThreshold = version === "main" ? 1 : 0;
  if ((input.oprojTensorParallelSize ?? 0) > fgThreshold) {
    const size = input.oprojTensorParallelSize ?? 1;
    const otpLine = version === "main" ? "L238-L239" : version === "rfork" ? "L127-L128" : "L205-L206";
    pushGroup(
      "otp",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      buildFineGrainedDpAxisRanks(size),
      `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${otpLine}`,
      "Fine-grained o_proj TP group (DP-axis slice)",
    );
  }
  if ((input.mlpTensorParallelSize ?? 0) > fgThreshold) {
    const size = input.mlpTensorParallelSize ?? 1;
    const mlptpLine = version === "main" ? "L244-L245" : version === "rfork" ? "L133-L134" : "L211-L212";
    pushGroup(
      "mlptp",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      buildFineGrainedDpAxisRanks(size),
      `${ascendRepoPrefix}:vllm_ascend/distributed/parallel_state.py#${mlptpLine}`,
      "Fine-grained MLP TP group (DP-axis slice)",
    );
  }

  if (version === "main" && (input.qkvIprojTensorParallelSize ?? 1) > 1) {
    const size = input.qkvIprojTensorParallelSize ?? 1;
    pushGroup(
      "qkv_iproj_tp",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      buildFineGrainedDpAxisRanks(size),
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/distributed/parallel_state.py#L246-L247`,
      "Main-only fine-grained QKV/iproj TP group (DP-axis slice)",
    );
  }

  if (worldSize > 1 && input.sleepModeExtraCleanup && version !== "rfork") {
    pushGroup(
      "sleep_lifecycle_anchor",
      HCCL_SLEEP_LIFECYCLE_ANCHOR_BUFFER_SIZE_MIB,
      worldRanks,
      `${ascendRepoPrefix}:vllm_ascend/device_allocator/sleep_mem_optimized.py#L171-L176`,
      "Lazy sleep lifecycle anchor group (1 MiB)",
    );
  }

  const netloaderLine = version === "rfork" ? "L282" : "L553";
  if (input.netloaderEnabled) {
    pushGroup(
      "netloader",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      worldRanks,
      `${ascendRepoPrefix}:vllm_ascend/model_loader/netloader/netloader.py#${netloaderLine}`,
      "NetLoader weight streaming group",
    );
  }
  if (input.netloaderDraftEnabled) {
    pushGroup(
      "netloader_draft",
      HCCL_DEFAULT_BUFFER_SIZE_MIB,
      worldRanks,
      `${ascendRepoPrefix}:vllm_ascend/model_loader/netloader/netloader.py#${netloaderLine}`,
      "NetLoader draft weight streaming group",
    );
  }

  // Deduplicate via _HCCL_PG_REGISTRY key: (ranks, buffer_size, reuse_domain)
  const seen = new Map<string, HcclDomainEntry>();
  const logicalGroups: HcclDomainEntry[] = [];
  const uniqueMaterializedGroups: HcclDomainEntry[] = [];

  for (const entry of candidateGroups) {
    if (entry.bufferSizeMiB === null) {
      logicalGroups.push(entry);
      continue;
    }
    const key = makeKey(entry.ranksSignature, entry.bufferSizeMiB, entry.reuseDomain);
    const existing = seen.get(key);
    if (existing && entry.groupName !== "pp_broadcast") {
      logicalGroups.push({
        ...entry,
        deduplicatedInto: existing.groupName,
      });
    } else {
      seen.set(key, entry);
      logicalGroups.push(entry);
      uniqueMaterializedGroups.push(entry);
    }
  }

  const totalMaterializedMiB = uniqueMaterializedGroups.reduce((sum, g) => sum + (g.bufferSizeMiB ?? 0), 0);

  return {
    version,
    dpBufferSizeMiB,
    logicalGroups,
    uniqueMaterializedGroups,
    deduplicatedGroupCount: logicalGroups.filter((g) => g.deduplicatedInto !== undefined).length,
    totalMaterializedMiB,
    mc2GovernedByCannBuffsize: true,
    profileRunOverlap: {
      alreadyIncludedInProfileRun: true,
      initSnapshotPrecedesDistributedInit: true,
      underestimationSafetyBufferMiB: HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
      nonTorchMemoryNote:
        "NPUWorker._init_device captures init_snapshot BEFORE _init_worker_distributed_environment(), and profile_run() runs dummy forward passes (plus MC2 warmup) to materialize HCCL buffers; therefore profile_result.non_kv_cache_memory ALREADY includes materialized HCCL buffers (do not double-count in log reconciliation mode; worker.py also reserves a 150 MiB underestimation safety buffer).",
      anchors: getProfileRunOverlapAnchors(version),
    },
  };
}
