import { isFusedMc2SilentlyReset, selectMoeCommMethod } from "./moeComm";
import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

function isAscendSpRequested(input: CouplingCheckInput, version: RuleVersion): boolean {
  if (version === "rfork") {
    return Boolean(input.enableFlashcomm1);
  }
  return Boolean(input.enableFlashcomm1 || input.useSequenceParallelMoe);
}

function isFlashcomm1Supported(input: CouplingCheckInput): boolean {
  const tp = Math.max(1, input.tpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  const moeSp = Boolean(input.isMoe && input.enableExpertParallel && tp > 1);
  const denseSp = Boolean(input.isQwen35Dense && tp > 1 && pp === 1);
  return moeSp || denseSp;
}

export const domain1Rules: readonly CouplingRule[] = [
  {
    id: "d1-tp-collective-pattern",
    domain: "parallelism-moe",
    title: "张量并行（TP）All-Reduce / All-Gather 依赖机内 HCCS/UB 互联",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/linear.py#L608-L610`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/linear.py#L1775-L1776`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/vocab_parallel_embedding.py#L548-L555`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/logits_processor.py#L124-L134`,
    ],
    description:
      "ColumnParallel/RowParallel 层每层触发 2 次阻塞式 All-Reduce，并伴随词表与 logits All-Gather，要求高带宽机内 HCCS/UB 互联。",
    rationale: "每层高频集合通信在跨机 RoCE 下会立即成为瓶颈，TP 应收敛在单机或超节点 HCCS/UB 域内。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      if (tp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `TP=${tp} 每层触发 2 次阻塞式 All-Reduce 及词表/logits All-Gather，请将 TP 通信域收敛在机内 HCCS/UB 高速互联内。`,
      };
    },
  },
  {
    id: "d1-pp-async-send-recv",
    domain: "parallelism-moe",
    title: "流水线并行（PP）采用异步 P2P Send/Recv 级间通信",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/distributed/parallel_state.py#L1067-L1346`],
    description:
      "Pipeline Parallelism 通过非阻塞 torch.distributed isend/irecv 张量字典在相邻 stage 间传递激活。",
    rationale: "P2P 级间通信比 TP All-Reduce 更耐受跨机 RoCE，但需要合理调优微批与分块以抑制流水线气泡。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (pp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `PP=${pp} 阶段间通过异步 isend_tensor_dict/irecv_tensor_dict 传输激活（适合跨机拓扑，但需留意流水线气泡）。`,
      };
    },
  },
  {
    id: "d1-sp-pp-rms-norm-rewrite",
    domain: "parallelism-moe",
    title: "SP + PP>1 静默追加 +rms_norm 自定义算子（v0.30.0）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/vllm.py#L1877-L1899`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/compilation/passes/fusion/sequence_parallelism.py#L162-L179`,
    ],
    description:
      "在 v0.30.0 (vllm@ced6857a) 中，PassConfig.enable_sp 与 PP>1 组合时会静默向 compilation_config.custom_ops 追加 '+rms_norm'（若显式禁用 '-rms_norm' 则告警可能报错）。",
    rationale:
      "SequenceParallelismPass 将 all_reduce -> rms_norm 改写为 reduce_scatter -> rms_norm -> all_gather，跨 PP 阶段依赖自定义 rms_norm。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (!input.enableSp || pp <= 1) return null;
      const customOps = input.customOps ?? [];
      if (customOps.includes("-rms_norm")) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "warn",
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message:
            "PassConfig.enable_sp 叠加 PP>1 且 custom_ops 包含 '-rms_norm'，原生 rms_norm 不支持该组合，运行时极可能报错。",
          remediation: "从 compilation_config.custom_ops 移除 '-rms_norm'，或关闭 SP / PP。",
        };
      }
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "silent-rewrite",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "PassConfig.enable_sp 与 PP>1 组合时，框架会静默向 compilation_config.custom_ops 追加 '+rms_norm'。",
        effectiveMutation: { customOpsAppended: "+rms_norm" },
      };
    },
  },
  {
    id: "d1-sp-pp-removed-in-main",
    domain: "parallelism-moe",
    title: "上游 PassConfig.enable_sp 已在 main 分支移除",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/compilation.py#L204-L237`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L859`,
    ],
    description:
      "上游 vllm@ba15685a (main) 已移除 PassConfig.enable_sp 与 SequenceParallelismPass (+rms_norm 改写)，仅保留 parallel_config.use_sequence_parallel_moe 与昇腾 FlashComm1。",
    rationale: "v0.30.0 的 PassConfig.enable_sp 及 +rms_norm 注入规则在 main 分支不再适用。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableSp) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "上游 vLLM main 已移除 PassConfig.enable_sp 及 PP>1 下的 '+rms_norm' 改写，请改用 use_sequence_parallel_moe 或昇腾 FlashComm1。",
      };
    },
  },
  {
    id: "d1-ascend-sp-tp-gt-1",
    domain: "parallelism-moe",
    title: "昇腾序列并行（SP）要求 tp_size > 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1437-L1439`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1724-L1726`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L758-L761`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
    ],
    description:
      "当启用序列并行且 tp_size <= 1 时，NPUPlatform.check_and_update_config 直接抛出 AssertionError。",
    rationale: "Reduce-Scatter 与 All-Gather 序列并行无法在单张 TP 卡上切分。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const spRequested = isAscendSpRequested(input, version);
      if (!spRequested || tp > 1) return null;
      if (
        version !== "rfork" &&
        input.enableFlashcomm1 &&
        !input.useSequenceParallelMoe &&
        !isFlashcomm1Supported(input)
      ) {
        // FlashComm1 alone logs warning and disables itself when unsupported in v0.30.0/main.
        return null;
      }
      const sources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1724-L1726`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
            ]
          : version === "rfork"
            ? [
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L758-L761`,
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1437-L1439`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
              ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: "AssertionError: 序列并行（SP）仅支持 tp_size > 1。",
        remediation: "将 --tensor-parallel-size 设为 >= 2，或关闭序列并行。",
      };
    },
  },
  {
    id: "d1-ascend-sp-moe-requires-ep",
    domain: "parallelism-moe",
    title: "MoE 模型开启昇腾序列并行要求 enable_expert_parallel=True",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1441-L1442`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1727-L1729`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L763-L765`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
    ],
    description: "MoE 模型开启序列并行但未传 --enable-expert-parallel 时，NPUPlatform 抛 AssertionError。",
    rationale: "MoE 序列并行需要在 EP 通信域边界对齐专家派发与 Reduce-Scatter。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      if (!input.isMoe || input.enableExpertParallel || tp <= 1) return null;
      const spActive =
        version === "rfork" ? Boolean(input.enableFlashcomm1) : Boolean(input.useSequenceParallelMoe);
      if (!spActive) return null;
      const sources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1727-L1729`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
            ]
          : version === "rfork"
            ? [
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L763-L765`,
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1441-L1442`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
              ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: "AssertionError: MoE 模型启用序列并行要求开启 enable_expert_parallel=True。",
        remediation: "添加 --enable-expert-parallel，或关闭序列并行。",
      };
    },
  },
  {
    id: "d1-flashcomm1-unsupported-disable",
    domain: "parallelism-moe",
    title: "FlashComm1 不满足拓扑条件时告警并静默关闭",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L765-L780`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1031-L1068`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L865-L871`,
    ],
    description:
      "FlashComm1 仅在 MoE+EP (tp_size > 1，不限 pp_size) 或 Qwen3.5 Dense (tp_size > 1 且 pp_size == 1) 生效；否则告警并静默关闭。",
    rationale: "防止不支持的稠密模型或 Qwen3.5 Dense PP>1 拓扑误入 FlashComm1 路径。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableFlashcomm1 || isFlashcomm1Supported(input)) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "当前配置不支持 FlashComm1（需满足 MoE+EP 且 tp>1 [不限 pp]，或 Qwen3.5 Dense 且 tp>1、pp==1），已告警并静默关闭。",
        effectiveMutation: { flashcomm1Active: false },
      };
    },
  },
  {
    id: "d1-flashcomm1-disables-quantized-ar",
    domain: "parallelism-moe",
    title: "FlashComm1/SP 静默关闭 quantized_all_reduce_config（main）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L856-L884`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L229`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L128-L146`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L332`,
    ],
    description:
      "vllm-ascend main (8d6180e2) 下激活 FlashComm1 + use_sequence_parallel_moe（含 DP=1，不限 pp_size）会静默将 quantized_all_reduce_config.enable 置为 False。",
    rationale:
      "序列并行以 Reduce-Scatter/All-Gather 取代 TP All-Reduce，int8 量化 All-Reduce 包装器不会被触发。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const moeSpActive = Boolean(
        input.enableFlashcomm1 &&
          input.useSequenceParallelMoe !== false &&
          input.isMoe &&
          input.enableExpertParallel &&
          tp > 1,
      );
      if (!moeSpActive || !input.quantizedAllReduceEnabled) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "FlashComm1/SP 已静默将 additional_config.quantized_all_reduce_config.enable 置为 False。",
        effectiveMutation: { quantizedAllReduceEnabled: false },
      };
    },
  },
  {
    id: "d1-roce-pp-dp-moe-exclusion",
    domain: "parallelism-moe",
    title: "跨机 RoCE 下 MoE 禁止同时开启 PP>1 与 DP>1（无启动校验）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L438-L440`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L430-L432`,
    ],
    description:
      "跨机 RoCE 部署 MoE 时，MoeDistributeDispatch 不支持同时开启 PP > 1 与 DP > 1，且无 Python 启动期校验。",
    rationale:
      "pipeline_parallel.md 明确限制但 platform.py / ascend_config.py 缺少启动断言，存在静默挂死风险。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      const dp = Math.max(1, input.dpSize ?? 1);
      if (!input.isMoe || pp <= 1 || dp <= 1 || input.crossNodeRoce === false) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: input.crossNodeRoce === true ? "error" : "warn",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          input.crossNodeRoce === true
            ? `跨机 RoCE MoE 部署中 PP=${pp} > 1 与 DP=${dp} > 1 不受 MoeDistributeDispatch 支持（且无 Python 启动校验）。`
            : `MoE 同时开启 PP=${pp} > 1 与 DP=${dp} > 1 在跨机 RoCE 下不受支持（无 Python 启动校验，请确认是否为机内互联）。`,
        remediation: "跨机 RoCE MoE 部署请将 PP 或 DP 之一设为 1。",
      };
    },
  },
  {
    id: "d1-fused-mc2-silent-reset",
    domain: "parallelism-moe",
    title: "MegaMoe 配置不满足约束时 `enable_fused_mc2` 静默重置为 0",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L664-L670`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L856-L859`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L87-L97`,
    ],
    description:
      "当请求 MegaMoe（enable_fused_mc2=2，或 main 分支为 3）且硬件支持 is_mega_moe_supported()，但 _is_megamoe_supported_by_config(vc) 为 False 时，AscendConfig 静默将 enable_fused_mc2 重置为 0。",
    rationale: "在不兼容配置形态下静默回退 MegaMoe 融合 MC2，避免直接触发启动报错。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isFusedMc2SilentlyReset(input, version)) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `已请求 MegaMoe（enable_fused_mc2=${input.enableFusedMc2}），但当前配置不满足 _is_megamoe_supported_by_config 约束，AscendConfig 已静默将 enable_fused_mc2 重置为 0。`,
        effectiveMutation: { enableFusedMc2: 0 },
      };
    },
  },
  {
    id: "d1-fused-mc2-3-main-only",
    domain: "parallelism-moe",
    title: "enable_fused_mc2=3 仅限 main 分支（v0.30.0 启动断言报错）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L664-L670`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L841`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L774-L789`,
    ],
    description:
      "v0.30.0（c09d3e20）中 enable_fused_mc2 仅允许 0、1（dispatch_ffn_combine）或 2（MegaMoe）；传入 3 会触发 assert self.enable_fused_mc2 in (0, 1)。模式 3（MegaMoe + 共享专家融合）仅在 main@8d6180e2 支持。",
    rationale: "防止将 main 分支的 enable_fused_mc2=3 配方迁移到 v0.30.0 时在启动阶段抛出 AssertionError。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.enableFusedMc2 !== 3) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `AssertionError: ${version} 不支持 enable_fused_mc2=3（仅允许 0 / 1[dispatch_ffn_combine] / 2[MegaMoe]，取值 3 的共享专家融合仅限 main@8d6180e2）。`,
        remediation:
          "在 v0.30.0 中改用 enable_fused_mc2=2（MegaMoe）或 1（dispatch_ffn_combine），或切换到 main 分支。",
      };
    },
  },
  {
    id: "d1-dp-ep-moe-comm-strategy",
    domain: "parallelism-moe",
    title: "DP + EP 四族昇腾硬件 MoE 通信策略分派",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L281-L342`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L243-L414`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L259-L461`,
    ],
    description:
      "按硬件族（A2 / A3 / 310P / A5）、LoRA 覆写、动态 MC2 容量上限与版本差异选择 ALLGATHER / MC2 / FUSED_MC2 / ALLTOALL。",
    rationale:
      "v0.30.0 的 A5 误用含 PP 的 world_size_across_dp，main 已修正为 world_size_across_dp // pp_size。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.isMoe) return null;
      const result = selectMoeCommMethod(input, version);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: result.sources,
        message: result.usedWorldSizeAcrossDpBug
          ? `${result.reason}（注意：v0.30.0 A5 误用含 PP 的 world_size_across_dp；main 已修正为 world_size_across_dp // pp_size。）`
          : result.reason,
        effectiveMutation: {
          moeCommMethod: result.method,
          mc2TokensCapacity: result.mc2TokensCapacity,
        },
      };
    },
  },
  {
    id: "d1-idle-dp-dummy-batch",
    domain: "parallelism-moe",
    title: "空闲 DP 组须执行 Dummy Batch 集合通信同步",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/engine/core.py#L2204-L2227`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L770-L779`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L1278-L1281`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L194-L197`,
    ],
    description:
      "dp_size > 1 且任一 DP 组存在未完成请求时，空闲 DP rank 必须执行 execute_dummy_batch() (_dummy_run) 以防止 EP/DP 集合通信死锁。",
    rationale: "DPEngineCoreProc.run_busy_loop 与 external_launcher 通过 all-reduce MAX 协调全组步调。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const dp = Math.max(1, input.dpSize ?? 1);
      if (dp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `DP=${dp} > 1：任一 DP 组存在在途请求时，空闲 DP rank 会自动执行 execute_dummy_batch() (_dummy_run) 保持集合通信同步。`,
      };
    },
  },
];

export function evaluateDomain1Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain1Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
