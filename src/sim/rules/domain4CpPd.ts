import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

const MOONCAKE_NON_LAYERWISE_CONNECTORS = new Set([
  "MooncakeConnector",
  "MooncakeConnectorV1",
  "MooncakeConnectorV2",
]);

function isAnyMooncakeConnector(connector: string | undefined): boolean {
  if (!connector) return false;
  return MOONCAKE_NON_LAYERWISE_CONNECTORS.has(connector) || connector === "MooncakeLayerwiseConnector";
}

export const domain4Rules: readonly CouplingRule[] = [
  {
    id: "d4-ulysses-ring-no-runtime-flags",
    domain: "cp-pd",
    title: "Ulysses / Ring CP 在 vllm / vllm-ascend 中无对应运行时参数",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L18-L61`,
    ],
    description:
      "Ulysses 与 Ring Attention 仅作为架构对比概念（vllm 与 vllm-ascend 中无对应运行时开关）；昇腾通过 PCP + DCP 实现上下文并行。",
    rationale: "避免尝试配置并不存在的 Ulysses/Ring CP 命令行参数。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cpRoute !== "ulysses" && input.cpRoute !== "ring") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `CP 路线 '${input.cpRoute}' 在 vllm / vllm-ascend 中没有运行时参数；昇腾通过 PCP + DCP 实现上下文并行。`,
      };
    },
  },
  {
    id: "d4-pcp-requires-mrv2",
    domain: "cp-pd",
    title: "PCP > 1 未启用 ModelRunner V2 会直接抛 ValueError（不会静默强制开启）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1650-L1657`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L2105-L2112`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L54-L61`,
    ],
    description:
      "Prefill 上下文并行（PCP > 1）要求 VLLM_USE_V2_MODEL_RUNNER=1（use_v2_model_runner=True），否则直接抛 ValueError，不会静默启用 MRV2。",
    rationale: "旧版 V1 ModelRunner 不支持昇腾 PCP。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (pcp <= 1 || input.useV2ModelRunner) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: PCP=${pcp} > 1 要求启用 use_v2_model_runner（VLLM_USE_V2_MODEL_RUNNER=1）；platform.py 不会静默强制开启 MRV2。`,
        remediation: "导出 VLLM_USE_V2_MODEL_RUNNER=1，或将 --prefill-context-parallel-size 设为 1。",
      };
    },
  },
  {
    id: "d4-pcp-full-cudagraph-unsupported",
    domain: "cp-pd",
    title: "PCP > 1 不支持 FULL CUDAGraph 模式",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L22-L26`,
    ],
    description: "context_parallel.md 明确说明 PCP > 1 时不支持 FULL cudagraph 模式。",
    rationale: "PCP 图捕获仅与部分 ACLGraph 模式兼容。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (pcp <= 1 || input.cudagraphMode !== "FULL") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `PCP=${pcp} > 1 时不支持 cudagraph_mode=FULL。`,
        remediation: "在 PCP > 1 场景改用 PIECEWISE 或 FULL_DECODE_ONLY。",
      };
    },
  },
  {
    id: "d4-dsa-cp-pcp-mutex",
    domain: "cp-pd",
    title: "enable_dsa_cp 与 PCP > 1 互斥（v0.30.0）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L697-L702`],
    description:
      "v0.30.0 下同时开启 enable_dsa_cp 与 prefill_context_parallel_size > 1 时，AscendConfig 直接抛 ValueError（main 已移除 enable_dsa_cp）。",
    rationale: "DSA-CP 与 PCP 分别管理上下文切分，不能同时生效。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (!input.enableDsaCp || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: DSA-CP 与 PCP > 1 不能同时启用。",
        remediation: "使用 PCP > 1 时请移除 enable_dsa_cp。",
      };
    },
  },
  {
    id: "d4-dsa-cp-mrv2-v030",
    domain: "cp-pd",
    title: "v0.30.0 下 DSA-CP 不支持 ModelRunner V2",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L703-L708`],
    description:
      "v0.30.0 中 enable_dsa_cp 与 use_v2_model_runner 同开会抛 ValueError；main 分支已移除该限制与 enable_dsa_cp。",
    rationale: "MRV2 兼容与 DSA-CP 下线发生在 v0.30.0 之后。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableDsaCp || !input.useV2ModelRunner) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: v0.30.0 下 Model Runner V2 不支持 DSA-CP。",
        remediation: "在 v0.30.0 上关闭 VLLM_USE_V2_MODEL_RUNNER，或改用 PCP 替代 DSA-CP。",
      };
    },
  },
  {
    id: "d4-pcp-dcp-sizing",
    domain: "cp-pd",
    title: "PCP + DCP 分组尺寸与 GQA/SFA 整除约束",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L558-L571`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/model.py#L1445-L1474`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1674-L1701`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L2153-L2166`,
    ],
    description:
      "强制校验：pcp==1 时 tp%dcp==0；pcp>1 时 dcp ∈ {1, pcp, tp*pcp}；GQA/MQA 下 pcp>1 且 dcp>1 时 pcp==dcp 及 KV 头整除；SFA 副本索引器下 dcp ∈ {pcp, tp*pcp}。",
    rationale: "Prefill 与 Decode 间 KV Cache 交织布局要求 PCP / DCP / TP / KV 头满足整除匹配。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const pcp = Math.max(1, input.pcpSize ?? 1);
      const dcp = Math.max(1, input.dcpSize ?? 1);
      const errors: string[] = [];

      if (pcp === 1 && dcp > 1) {
        if (dcp > tp) {
          errors.push(`pcp=1 时 dcp (${dcp}) 不能大于 tp (${tp}) 且 tp (${tp}) 必须能被 dcp (${dcp}) 整除`);
        } else if (tp % dcp !== 0) {
          errors.push(`pcp=1 时 tp (${tp}) 必须能被 dcp (${dcp}) 整除`);
        }
      }
      if (pcp > 1 && dcp !== 1 && dcp !== pcp && dcp !== tp * pcp) {
        errors.push(`pcp=${pcp} > 1 时 dcp (${dcp}) 必须属于 {1, ${pcp}, ${tp * pcp}}`);
      }

      if ((tp > 1 || pcp > 1 || dcp > 1) && input.numAttentionHeads !== undefined) {
        if (input.numAttentionHeads <= 0) {
          errors.push(`要求 num_attention_heads > 0（当前 ${input.numAttentionHeads}）`);
        } else if (input.numAttentionHeads % tp !== 0) {
          errors.push(`要求 num_attention_heads (${input.numAttentionHeads}) 能被 tp (${tp}) 整除`);
        }
      }

      const isGqaMqa = !input.useMla;
      if (isGqaMqa && (tp > 1 || pcp > 1 || dcp > 1) && input.numKvHeads !== undefined) {
        if (input.numKvHeads <= 0) {
          errors.push(`GQA/MQA 要求 total_num_kv_heads > 0（当前 ${input.numKvHeads}）`);
        } else {
          const kvHeadDivisible =
            input.numKvHeads >= tp ? input.numKvHeads % tp === 0 : tp % input.numKvHeads === 0;
          if (!kvHeadDivisible) {
            errors.push(
              input.numKvHeads >= tp
                ? `GQA/MQA 要求 total_num_kv_heads (${input.numKvHeads}) 能被 tp (${tp}) 整除`
                : `GQA/MQA 要求 tp (${tp}) 能被 total_num_kv_heads (${input.numKvHeads}) 整除`,
            );
          } else if (dcp > 1) {
            if (tp <= input.numKvHeads) {
              errors.push(`GQA/MQA 开启 dcp>1 时要求 tp (${tp}) > total_num_kv_heads (${input.numKvHeads})`);
            } else {
              const kvReplication = Math.floor(tp / input.numKvHeads);
              if (dcp > kvReplication) {
                errors.push(`GQA/MQA 要求 dcp (${dcp}) <= tp // total_num_kv_heads (${kvReplication})`);
              } else if (kvReplication % dcp !== 0) {
                errors.push(`GQA/MQA 要求 (tp // total_num_kv_heads = ${kvReplication}) % dcp (${dcp}) == 0`);
              }
            }
          }
          if (input.numAttentionHeads !== undefined && input.numAttentionHeads > 0) {
            if (input.numAttentionHeads % input.numKvHeads !== 0) {
              errors.push(
                `GQA/MQA 要求 num_heads (${input.numAttentionHeads}) 能被 num_kv_heads (${input.numKvHeads}) 整除`,
              );
            } else if (dcp > 1) {
              const groupSize = Math.floor(input.numAttentionHeads / input.numKvHeads);
              if (groupSize % dcp !== 0) {
                errors.push(`GQA/MQA 要求 (num_heads / num_kv_heads = ${groupSize}) % dcp (${dcp}) == 0`);
              }
            }
          }
        }
      }
      if (isGqaMqa && dcp > 1 && pcp > 1 && pcp !== dcp) {
        errors.push(`GQA/MQA 开启 PCP+DCP 时要求 pcp (${pcp}) == dcp (${dcp})`);
      }

      if (input.sfaDcpReplicatedIndexer) {
        if (version === "rfork") {
          if (dcp !== tp) {
            errors.push(`rfork SFA 副本索引器要求 dcp (${dcp}) == tp (${tp})`);
          }
          if (input.hardwareFamily === "A5") {
            errors.push("rfork SFA DCP（副本索引器）不支持 A5");
          }
        } else if (dcp !== pcp && dcp !== tp * pcp) {
          errors.push(`SFA 副本索引器要求 dcp (${dcp}) 属于 {${pcp}, ${tp * pcp}}`);
        }
      }

      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError / AssertionError: PCP/DCP 分组尺寸非法：${errors.join("；")}。`,
        remediation:
          "满足 pcp=1 时 tp % dcp == 0；GQA/MQA 下确保 tp > num_kv_heads 且 (tp // num_kv_heads) % dcp == 0、(num_heads / num_kv_heads) % dcp == 0；SFA 副本索引器下确保 dcp ∈ {pcp, tp * pcp}。",
      };
    },
  },
  {
    id: "d4-kv-connector-missing-kv-role",
    domain: "cp-pd",
    title: "配置 kv_connector 时缺少或传入非法 kv_role",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L130-L140`],
    description:
      'vLLM KVTransferConfig 使用严格区分大小写的 Literal["kv_producer", "kv_consumer", "kv_both"]（L130-L134 非法值校验），且在设置 kv_connector 而 kv_role 为 None 时抛 ValueError（L136-L140）。',
    rationale:
      "KV 传输连接器依赖显式且精确小写的实例角色初始化发送或接收缓冲区，框架不会自动猜测角色或忽略大小写。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.kvConnector) return null;
      if (input.kvRole === undefined) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: this.judgment,
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message: `ValueError: 已配置 kv_connector='${input.kvConnector}' 但未指定 kv_role（kv_role=None 时 KVTransferConfig 直接报错）。`,
          remediation:
            '在 --kv-transfer-config 中显式补充 kv_role：Prefill 实例设为 "kv_producer"，Decode 实例设为 "kv_consumer"，混部实例设为 "kv_both"。',
        };
      }
      if (input.kvRole !== "kv_producer" && input.kvRole !== "kv_consumer" && input.kvRole !== "kv_both") {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: this.judgment,
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message: `ValueError: kv_role='${String(input.kvRole)}' 非法（vLLM KVTransferConfig 严格区分大小写，仅接受 "kv_producer"、"kv_consumer" 或 "kv_both"）。`,
          remediation:
            '将 --kv-transfer-config 中的 kv_role 改为严格小写的 "kv_producer"、"kv_consumer" 或 "kv_both"。',
        };
      }
      return null;
    },
  },
  {
    id: "d4-mooncake-decode-pp-eq-1",
    domain: "cp-pd",
    title: "MooncakeConnector 要求 D 节点 PP == 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2240-L2241`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L437`,
    ],
    description: "MooncakeConnector / MooncakeConnectorV1 断言 decode_parallel_config['pp_size'] == 1。",
    rationale: "跨引擎 KV 拉取映射不支持 Decode 消费端开启多阶段 PP。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pp = input.ppSize ?? 1;
      if (input.kvRole !== "kv_consumer" || pp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `AssertionError: ${input.kvConnector} 要求 D 节点（kv_consumer）PP == 1（当前 PP=${pp}）。`,
        remediation: "在 Decode 节点上设置 --pipeline-parallel-size 1。",
      };
    },
  },
  {
    id: "d4-mooncake-decode-pcp-eq-1",
    domain: "cp-pd",
    title: "MooncakeConnector 要求 D 节点 PCP == 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2153-L2157`,
    ],
    description: "当 kv_role == 'kv_consumer' 且 pcp_size > 1 时，MooncakeConnector 直接抛 ValueError。",
    rationale: "Mooncake 仅在 Prefill 端（kv_producer）支持 PCP。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pcp = input.pcpSize ?? 1;
      if (input.kvRole !== "kv_consumer" || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: ${input.kvConnector} 仅在 P 节点支持 PCP，D 节点 PCP 必须为 1（当前 PCP=${pcp}）。`,
      };
    },
  },
  {
    id: "d4-mooncake-pp-pcp-mutex",
    domain: "cp-pd",
    title: "MooncakeConnector 禁止同时开启 PP > 1 与 PCP > 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2146`,
    ],
    description: "MooncakeConnector 断言 not (pp_size > 1 and pcp_size > 1)。",
    rationale: "MooncakeConnector 尚未实现 PP 与 PCP 联合 rank 映射。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pp = input.ppSize ?? 1;
      const pcp = input.pcpSize ?? 1;
      if (pp <= 1 || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `AssertionError: ${input.kvConnector} 不能同时启用 PP（${pp} > 1）与 PCP（${pcp} > 1）。`,
      };
    },
  },
  {
    id: "d4-mooncake-tp-p-divisible-tp-d",
    domain: "cp-pd",
    title: "MooncakeConnector 要求 TP_P % TP_D == 0",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1212-L1213`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3612-L3615`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L4041`,
    ],
    description:
      "MooncakeConnector 要求 prefill_tp_size % decode_tp_size == 0（Hybrid Mamba 显式断言，GQA 非复制 KV 拉取亦按 group_size = prefill_tp_size // decode_tp_size 假设）。",
    rationale: "KV Cache 头切片拉取要求每个 Decode TP rank 整除映射到若干 Prefill TP rank。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      if (input.prefillTpSize === undefined || input.decodeTpSize === undefined) return null;
      if (input.prefillTpSize % input.decodeTpSize === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `MooncakeConnector 要求 TP_P (${input.prefillTpSize}) % TP_D (${input.decodeTpSize}) == 0。`,
        remediation: "将 TP_P 调整为 TP_D 的整数倍。",
      };
    },
  },
  {
    id: "d4-mooncake-gqa-c8-forbidden",
    domain: "cp-pd",
    title: "MooncakeConnector + GQA 禁止直接开 C8 KV 量化（请改用 MooncakeLayerwiseConnector）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1019-L1043`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1629`,
    ],
    description:
      "GQA 模型使用 MooncakeConnector / V1 / V2 并开启 enable_c8_quant=True 时直接抛 ValueError（P 端存 BF16 而 D 端分配 INT8）；必须改用 MooncakeLayerwiseConnector 或关闭 C8。",
    rationale: "普通 Mooncake P2P 传输未经逐层量化转换，会把 BF16 字节误当 INT8 读取。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.kvConnector || !MOONCAKE_NON_LAYERWISE_CONNECTORS.has(input.kvConnector)) return null;
      const isMha =
        input.numAttentionHeads !== undefined &&
        input.numKvHeads !== undefined &&
        input.numAttentionHeads === input.numKvHeads;
      const isGqa = !input.useMla && !input.usesSfaSparse && !isMha;
      if (!isGqa || !input.enableC8Quant) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: ${input.kvConnector} 不支持在 GQA 模型上开启 C8 KV Cache 量化。`,
        remediation: "改用 MooncakeLayerwiseConnector，或关闭 C8 KV Cache 量化。",
      };
    },
  },
  {
    id: "d4-recompute-scheduler-p-node-disable",
    domain: "cp-pd",
    title: "P 节点上 recompute_scheduler_enable 会被静默关闭",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1120-L1133`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1288-L1305`,
    ],
    description:
      "在 P 节点（kv_role='kv_producer'）开启 recompute_scheduler_enable=True 时，NPUPlatform 打印告警并静默改写为 False。",
    rationale: "重计算调度仅对处理 KV 抢占与重算的 Decode 节点有意义。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.recomputeSchedulerEnable || input.kvRole !== "kv_producer") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "P 节点（kv_producer）上的 recompute_scheduler_enable=True 会被静默关闭为 False。",
        effectiveMutation: { recomputeSchedulerEnable: false },
      };
    },
  },
  {
    id: "d4-recompute-scheduler-non-d-node-error",
    domain: "cp-pd",
    title: "非 PD 分离或 kv_both 实例禁止开启 recompute_scheduler_enable",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1134-L1146`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1306-L1318`,
    ],
    description:
      "未配置 kv_transfer_config 或 kv_role='kv_both'（PD 混部）时开启 recompute_scheduler_enable=True，NPUPlatform 直接抛 ValueError。",
    rationale: "RecomputeSchedulerConfig 仅限 PD 分离架构的 D 节点（kv_consumer）使用。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.recomputeSchedulerEnable) return null;
      if (input.kvRole === "kv_consumer" || input.kvRole === "kv_producer") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: recompute_scheduler_enable 仅支持 PD 分离的 D 节点（kv_role='kv_consumer'），当前 kv_role=${input.kvRole ?? "None"}。`,
      };
    },
  },
  {
    id: "d4-finegrained-tp-requires-recompute",
    domain: "cp-pd",
    title: "finegrained_tp_config 要求开启 recompute_scheduler_enable=True",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L830-L838`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L899-L906`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L164-L173`,
    ],
    description:
      "开启 finegrained_tp_config（v0.30.0 中 oproj/mlp > 0，main 中 > 1；rfork 中 oproj/embedding > 0）且未启用 recompute_scheduler_enable=True 时，直接抛 AssertionError。",
    rationale: "细粒度 TP 依赖重计算调度器维持 Decode 节点的纯解码步形态。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const oproj = input.oprojTensorParallelSize ?? 0;
      const mlp = input.mlpTensorParallelSize ?? 0;
      const embed = input.embeddingTensorParallelSize ?? 0;
      const triggered =
        version === "rfork"
          ? oproj > 0 || embed > 0
          : version === "main"
            ? oproj > 1 || mlp > 1
            : oproj > 0 || mlp > 0;
      if (!triggered) return null;
      if (input.recomputeSchedulerEnable) return null;
      const versionSource =
        version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L164-L173`]
          : version === "main"
            ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L899-L906`]
            : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L830-L838`];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSource,
        message:
          version === "rfork"
            ? "AssertionError: finegrained_tp_config（oproj_tensor_parallel_size / embedding_tensor_parallel_size）要求 recompute_scheduler_enable=True。"
            : "AssertionError: finegrained_tp_config（oproj_tensor_parallel_size / mlp_tensor_parallel_size）要求 recompute_scheduler_enable=True。",
        remediation: "在 D 节点上开启 recompute_scheduler_enable=True。",
      };
    },
  },
  {
    id: "d4-sparse-kv-offload-constraints",
    domain: "cp-pd",
    title: "sparse_kv_offload_config 的 D 节点与拓扑互斥约束",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1012-L1017`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1724-L1772`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L1821-L1867`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L1030-L1076`,
    ],
    description:
      "sparse_kv_offload_config（默认 keep_device_kv_cache=False）仅限 D 节点（is_kv_consumer），且拒绝 Ascend 950、PP>1、PCP*DCP>1、PreemptOffloadConnector、compress_ratios、非稀疏模型、未开 MRV2 的 DSpark（或 rfork 上的 MRV2）、topk_buffer_size < topk 及打包 SFA C8/TQ4。",
    rationale: "稀疏 KV 卸载会改变设备端缓存驻留并依赖 D 节点专属远端 KV 暂存。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.sparseKvOffloadEnabled) return null;
      const errors: string[] = [];
      const hasKvConnector = input.usageContext === "vllm_serve" ? Boolean(input.kvConnector) : true;
      const isKvConsumer = hasKvConnector && (input.kvRole === "kv_consumer" || input.kvRole === "kv_both");
      if (version !== "rfork" && input.hardwareFamily === "A5") errors.push("不支持 Ascend 950 (A5)");
      if (version !== "rfork" && input.hasPreemptOffloadConnector) {
        errors.push("与 PreemptOffloadConnector 互斥");
      }
      if (input.hasCompressRatios) errors.push("与 compress_ratios 互斥");
      if (input.indexTopk === undefined && !input.usesSfaSparse) {
        errors.push("要求具备 index_topk 的稀疏注意力模型");
      }
      if ((input.pcpSize ?? 1) * (input.dcpSize ?? 1) > 1) errors.push("与 PCP/DCP > 1 互斥");
      if ((input.ppSize ?? 1) > 1) errors.push("与 PP > 1 互斥");
      if (!input.keepDeviceKvCache && !isKvConsumer) {
        errors.push(
          "默认 keep_device_kv_cache=False 仅支持已配置连接器的 PD 消费节点（kv_role='kv_consumer' 或 'kv_both'）",
        );
      }
      if (version === "rfork") {
        if (input.useV2ModelRunner) {
          errors.push("rfork 稀疏 KV 卸载暂不支持 VLLM_USE_V2_MODEL_RUNNER=1");
        }
      } else if (input.speculativeMethod === "dspark" && !input.useV2ModelRunner) {
        errors.push("稀疏 KV 卸载配合 DSpark 投机解码要求 use_v2_model_runner=True");
      }
      const rawTopkBuf = input.topkBufferSize ?? (version === "rfork" ? 4096 : -1);
      const effectiveTopkBufferSize =
        version !== "rfork" && rawTopkBuf === -1 ? (1 + (input.numSpecTokens ?? 0)) * 2048 : rawTopkBuf;
      if (input.indexTopk !== undefined && effectiveTopkBufferSize < input.indexTopk) {
        errors.push(`topk_buffer_size (${effectiveTopkBufferSize}) 必须 >= index_topk (${input.indexTopk})`);
      }
      if (
        input.usesSfaSparse &&
        (input.enableSparseSfaC8 || (version !== "rfork" && input.cacheDtype === "turboquant_4bit_nc"))
      ) {
        errors.push("与打包 SFA C8 或 TurboQuant 4-bit 缓存互斥");
      }
      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError / AssertionError: sparse_kv_offload_config 校验失败：${errors.join("；")}。`,
      };
    },
  },
  {
    id: "d4-ascend-config-pd-mla-preconditions",
    domain: "cp-pd",
    title: "AscendConfig 与细粒度 TP 的 MLA / PD Decode 节点及互斥前置约束",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L721-L768`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L707-L802`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L956-L1003`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L276-L285`,
    ],
    description:
      "校验 enable_kv_nz（仅限非稀疏 MLA + PD D 节点）、mlapo_keep_prefill_weights（要求 enable_mlapo=True 且仅限 MLA 模型）、finegrained_tp_config（MoE 限制、DP 整除与 qkv_iproj_tensor_parallel_size 的 TP=PCP=PP=1 + D 节点 + GLM-5.3-Flash 限制）以及 mix_placement / enable_force_eplb / mc2_comm_alg 互斥。",
    rationale: "提前拦截 derive_and_validate 与 FinegrainedTPConfig._validate_preconditions 中的启动期异常。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const errors: string[] = [];
      const hasKvConnector = input.usageContext === "vllm_serve" ? Boolean(input.kvConnector) : true;
      const isKvConsumer = hasKvConnector && (input.kvRole === "kv_consumer" || input.kvRole === "kv_both");

      if (input.enableKvNz === true) {
        if (input.useMla === false || input.usesSfaSparse === true) {
          errors.push("RuntimeError: enable_kv_nz 仅支持非稀疏 MLA 模型");
        }
        if (!isKvConsumer) {
          errors.push(
            "NotImplementedError: enable_kv_nz 仅支持已配置连接器的 PD 分离消费节点（kv_role='kv_consumer' 或 'kv_both'）",
          );
        }
      }

      if (version !== "rfork" && input.mlapoKeepPrefillWeights === true) {
        if (input.enableMlapo === false) {
          errors.push("ValueError: mlapo_keep_prefill_weights=True 要求 enable_mlapo=True");
        }
        if (input.useMla === false) {
          errors.push("ValueError: mlapo_keep_prefill_weights=True 仅支持 MLA 模型（如 DeepSeek）");
        }
      }

      const fgThreshold = version === "main" ? 1 : 0;
      const qkvTp = version === "main" ? (input.qkvIprojTensorParallelSize ?? 0) : 0;
      if (qkvTp > 1) {
        if ((input.tpSize ?? 1) !== 1 || (input.pcpSize ?? 1) !== 1 || (input.ppSize ?? 1) !== 1) {
          errors.push("ValueError: qkv_iproj_tensor_parallel_size > 1 要求 TP=1、PCP=1 且 PP=1");
        }
        if (!isKvConsumer) {
          errors.push(
            "ValueError: qkv_iproj_tensor_parallel_size 仅支持 PD 分离消费节点（kv_role='kv_consumer' 或 'kv_both'）",
          );
        }
        if (
          input.modelType !== undefined &&
          input.modelType !== "glm5_next" &&
          input.modelType !== "glm5_next_text"
        ) {
          errors.push("ValueError: qkv_iproj_tensor_parallel_size 当前仅支持 GLM-5.3-Flash（glm5_next）");
        }
        if (input.linearNumHeads !== undefined && input.linearNumHeads % qkvTp !== 0) {
          errors.push(
            `ValueError: qkv_iproj_tensor_parallel_size (${qkvTp}) 必须整除 KDA 线性注意力头数 (${input.linearNumHeads})`,
          );
        }
      }

      const activeModuleTpSizes = [
        input.oprojTensorParallelSize ?? 0,
        input.lmheadTensorParallelSize ?? 0,
        input.embeddingTensorParallelSize ?? 0,
        input.mlpTensorParallelSize ?? 0,
        qkvTp,
      ].filter((sz) => sz > fgThreshold);

      if (activeModuleTpSizes.length > 0) {
        if (input.isMoe === false) {
          errors.push("AssertionError: finegrained_tp_config 各分模块 TP 仅支持在 MoE 模型上开启");
        }
        if (input.dpSize !== undefined || input.usageContext === "vllm_serve") {
          const dp = input.dpSize ?? 1;
          for (const sz of activeModuleTpSizes) {
            if (dp % sz !== 0) {
              errors.push(
                `AssertionError: finegrained_tp_config 并行度 (${sz}) 必须整除 data_parallel_size (${dp})`,
              );
              break;
            }
          }
        }
      }

      if (
        version !== "rfork" &&
        input.enableForceEplb === true &&
        input.dynamicEplb === true &&
        input.isMoe === true
      ) {
        errors.push("ValueError: enable_force_eplb 不能与 eplb_config.dynamic_eplb 同时开启");
      }

      const rawSedp =
        input.enableSharedExpertDp ?? (version === "rfork" ? Boolean(input.enableFlashcomm1) : false);
      const effectiveSharedExpertDp = Boolean(
        rawSedp && input.enableExpertParallel === true && (input.tpSize ?? 1) > 1,
      );
      const fusedMc2ClearsOverlap =
        version === "rfork"
          ? input.enableFusedMc2 === 1
          : version === "v0.30.0"
            ? input.enableFusedMc2 === 1 || input.enableFusedMc2 === 2
            : (input.enableFusedMc2 ?? 0) > 0;
      const effectiveOverlapSharedExpert = Boolean(
        input.multistreamOverlapSharedExpert === true && !fusedMc2ClearsOverlap,
      );
      if (input.mixPlacement === true && (effectiveSharedExpertDp || effectiveOverlapSharedExpert)) {
        errors.push(
          "ValueError: mix_placement 不支持与生效的 enable_shared_expert_dp 或 multistream_overlap_shared_expert 同时开启",
        );
      }

      if (input.enableFusedMc2 === 1 && input.modelType === "minimax_m3") {
        errors.push(
          version === "rfork"
            ? "AssertionError: MiniMax M3 在 rfork 下不支持 enable_fused_mc2=1（请设为 0 或取消 VLLM_ASCEND_ENABLE_FUSED_MC2）"
            : "AssertionError: MiniMax M3 不支持 enable_fused_mc2=1 (dispatch_ffn_combine)，请改为 2 (MegaMoe) 或 0",
        );
      }

      if (input.mc2CommAlg === "fullmesh_v2") {
        if (input.hardwareFamily !== undefined && input.hardwareFamily !== "A3") {
          errors.push(
            `NotImplementedError: mc2_comm_alg='fullmesh_v2' 仅支持 A3，不受当前硬件 ${input.hardwareFamily} 支持`,
          );
        }
      } else if (input.mc2CommAlg === "hierarchy") {
        if (input.hardwareFamily === "310P" || input.hardwareFamily === "A5") {
          errors.push(
            `NotImplementedError: mc2_comm_alg='hierarchy' 不受当前硬件 ${input.hardwareFamily} 支持`,
          );
        }
        if (version !== "rfork" && input.numExperts !== undefined) {
          const red = input.dynamicEplb ? (input.numRedundantExperts ?? 0) : 0;
          const totalExperts = input.numExperts + red;
          if (totalExperts > 512) {
            errors.push(
              `ValueError: mc2_comm_alg='hierarchy' 最多支持 512 个专家（当前逻辑专家 ${input.numExperts} + EPLB 冗余专家 ${red} = ${totalExperts}）`,
            );
          }
        }
        if (version !== "rfork" && (input.enableFusedMc2 ?? 0) > 0) {
          errors.push(
            "ValueError: enable_fused_mc2 不能与 mc2_comm_alg='hierarchy'（或 enable_mc2_hierarchy_comm=True）同时启用",
          );
        }
      }

      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `${errors.join("；")}。`,
        remediation:
          "请按模型架构（MLA / MoE）与 PD 节点角色（kv_consumer）修正 --additional-config 中的互斥或前置项。",
      };
    },
  },
];

export function evaluateDomain4Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain4Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}

const CP_TOPOLOGY_RULE_IDS = new Set<string>([
  "d4-pcp-requires-mrv2",
  "d4-pcp-dcp-sizing",
  "d4-pcp-full-cudagraph-unsupported",
]);

/**
 * Shared CP / DCP / PCP topology legality evaluator reused across ConfigDoctor and Deploy Calculator.
 */
export function evaluateCpTopologyRules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain4Rules) {
    if (!CP_TOPOLOGY_RULE_IDS.has(rule.id)) continue;
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
