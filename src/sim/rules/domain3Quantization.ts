import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

export const domain3Rules: readonly CouplingRule[] = [
  {
    id: "d3-fp8-missing-weight-block-size",
    domain: "quantization",
    title: "原生 FP8 缺少 weight_block_size 会抛 NotImplementedError",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/configs/fp8_config.py#L45-L54`,
    ],
    description:
      "缺少 quantization_config.weight_block_size 的原生 FP8（per-tensor/per-channel）在昇腾无执行路径，加载即抛 NotImplementedError。",
    rationale: "vLLM Ascend 仅接受分块缩放（block-wise）的原生 FP8 权重。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily === "310P") return null;
      if (input.quantMethod !== "fp8" || input.hasWeightBlockSize !== false) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "NotImplementedError: vLLM Ascend 仅支持包含 quantization_config.weight_block_size 的分块原生 FP8 权重。",
        remediation:
          "换用分块 FP8 权重，或使用 ModelSlim (--quantization ascend) / llm-compressor (--quantization compressed-tensors) 重新量化。",
      };
    },
  },
  {
    id: "d3-fp8-non-dynamic-activation",
    domain: "quantization",
    title: "原生分块 FP8 要求 activation_scheme='dynamic'",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/configs/fp8_config.py#L55-L59`,
    ],
    description: "原生分块 FP8 权重若 activation_scheme != 'dynamic'，配置校验直接抛 NotImplementedError。",
    rationale: "昇腾原生 FP8 校验路径不支持静态激活缩放。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily === "310P") return null;
      if (
        input.quantMethod !== "fp8" ||
        input.hasWeightBlockSize === false ||
        input.activationScheme === undefined ||
        input.activationScheme === "dynamic"
      ) {
        return null;
      }
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `NotImplementedError: 原生 FP8 要求 activation_scheme='dynamic'，当前为 '${input.activationScheme}'。`,
        remediation: "请使用动态激活（dynamic）分块 FP8 权重。",
      };
    },
  },
  {
    id: "d3-fp8-block-950-mxfp8",
    domain: "quantization",
    title: "Ascend 950 加载分块原生 FP8 时重定量化为 MXFP8（kv_b_proj 及非 32 对齐层除外）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L229`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/w8a8_mxfp8.py#L77-L78`,
    ],
    description:
      "在 Ascend 950 (A5) 上，原生分块 FP8 权重加载时重定量化为 MXFP8（每 32 元素 1B E8M0 scale，约 1 B/elem）；kv_b_proj 或 in_features % 32 != 0 的层回退为稠密 model_dtype。",
    rationale: "在 950 上启用原生 npu_quant_matmul 1 字节权重，同时保证矩阵吸收与非对齐投影兼容。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (
        input.quantMethod !== "fp8" ||
        input.hasWeightBlockSize === false ||
        input.hardwareFamily !== "A5"
      ) {
        return null;
      }
      if (input.activationScheme !== undefined && input.activationScheme !== "dynamic") return null;

      const unaligned = input.inFeatures !== undefined && input.inFeatures % 32 !== 0;
      if (input.isKvBProj || unaligned) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "silent-rewrite",
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message: input.isKvBProj
            ? "Ascend 950 保持 kv_b_proj 为稠密 model_dtype（BF16/FP16，约 2 B/elem），不转为 MXFP8。"
            : `因 in_features=${input.inFeatures} 不能被 MXFP8 group_size=32 整除，Ascend 950 将该层回退为稠密 model_dtype（约 2 B/elem）。`,
          effectiveMutation: { resolvedWeightFormat: input.modelDtype ?? "bfloat16", bytesPerElemApprox: 2 },
        };
      }
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "Ascend 950 加载分块 FP8 权重时静默重定量化为 MXFP8（每 32 元素 1B E8M0 scale，约 1 B/elem）以走 npu_quant_matmul。",
        effectiveMutation: { resolvedWeightFormat: "mxfp8", bytesPerElemApprox: 1 },
      };
    },
  },
  {
    id: "d3-fp8-block-non950-bf16-v030",
    domain: "quantization",
    title: "Atlas A2/A3 上分块原生 FP8 静默反量化回 BF16（2× 显存，v0.30.0）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L341-L349`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L281-L309`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L29-L34`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L229`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L272-L355`,
    ],
    description:
      "v0.30.0 在 Atlas A2/A3（STANDARD 量化后端）部署原生分块 FP8 权重时，会静默反量化为 model_dtype（通常 BF16，约 2 B/elem），权重显存翻倍（310P 不适用）。",
    rationale: "Atlas A2/A3 无硬件 FP8 矩阵乘，v0.30.0 展开权重为 model_dtype 并执行非量化 GEMM。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.quantMethod !== "fp8" || input.hasWeightBlockSize === false) return null;
      if (input.activationScheme !== undefined && input.activationScheme !== "dynamic") return null;
      const family = input.hardwareFamily ?? "A3";
      if (family !== "A2" && family !== "A3") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `v0.30.0 在 ${family}（STANDARD 量化后端）加载分块 FP8 时会静默反量化为 ${input.modelDtype ?? "bfloat16"}（约 2 B/elem，显存翻倍）并走非量化 GEMM。`,
        effectiveMutation: { resolvedWeightFormat: input.modelDtype ?? "bfloat16", bytesPerElemApprox: 2 },
      };
    },
  },
  {
    id: "d3-fp8-block-non950-error-main",
    domain: "quantization",
    title: "Atlas A2/A3 直接拦截分块原生 FP8 并抛 NotImplementedError（main）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L425-L433`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L375-L416`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L128`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L207-L212`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L339-L353`,
    ],
    description:
      "vllm-ascend main (8d6180e2) 移除 A2/A3 的静默反量化回退，缺少 WeightFormat.FP8 时 _require_fp8_weight_matmul() 直接抛 NotImplementedError。",
    rationale: "避免在 A2/A3 上加载 FP8 权重时发生意料之外的 2× 显存 OOM。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.quantMethod !== "fp8" || input.hasWeightBlockSize === false) return null;
      if (input.activationScheme !== undefined && input.activationScheme !== "dynamic") return null;
      const family = input.hardwareFamily ?? "A3";
      if (family !== "A2" && family !== "A3") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `NotImplementedError: main 分支下原生分块 FP8 仅支持 Ascend 950，${family} 无硬件 FP8 矩阵乘。`,
        remediation: "改用 BF16 权重，或通过 ModelSlim / llm-compressor 重新量化。",
      };
    },
  },
  {
    id: "d3-fp8-310p-unsupported",
    domain: "quantization",
    title: "Ascend 310P 不支持原生 FP8（COMPATIBILITY 后端未注册 AscendFp8Config）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L341-L349`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L425-L433`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L417-L440`,
    ],
    description:
      "Ascend 310P 使用 QuantizationBackendFamily.COMPATIBILITY（仅 FP16，不支持 BF16），不注册 AscendFp8Config，原生 FP8 无执行路径。",
    rationale: "310P 兼容量化后端仅支持 AscendModelSlimConfig310（FP16 / INT8）。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.quantMethod !== "fp8" || input.hardwareFamily !== "310P") return null;
      const versionSources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L425-L433`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L417-L440`,
            ]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L341-L349`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message:
          "不支持：Ascend 310P (300I DUO) 使用 QuantizationBackendFamily.COMPATIBILITY（模型精度为 FP16 而非 BF16）且未注册 AscendFp8Config，原生 FP8 无执行路径（不会静默反量化）。",
        remediation:
          "改用 FP16 权重或 ModelSlim INT8 权重配合 --quantization ascend (AscendModelSlimConfig310)，或在 Ascend 950 上运行原生 FP8。",
      };
    },
  },
  {
    id: "d3-w8a8-mix-pd-dispatch",
    domain: "quantization",
    title: "W8A8_MIX 按节点角色分派：D 端静态 W8A8，P 端/混部动态 W8A8",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/quantization/methods/w8a8_pdmix.py#L37-L93`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L12`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L150-L152`,
    ],
    description:
      "注册方案名为 'W8A8_MIX'（而非 'W8A8_PDMIX'）：始终加载静态 W8A8 scale，并在 D 端 / kv_both 走静态 AscendW8A8LinearMethod，P 端/混部走动态 AscendW8A8DynamicLinearMethod。",
    rationale: "兼顾 Decode 端静态量化低延迟与 Prefill/混部端动态激活精度。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const versionSources =
        version === "rfork"
          ? [
              `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/quantization/methods/w8a8_pdmix.py#L37-L93`,
              `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L12`,
              `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L150-L152`,
            ]
          : version === "main"
            ? [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93`,
                `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/kv_transfer.py#L12`,
                `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/kv_transfer.py#L155-L157`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93`,
                `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L12`,
                `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L150-L152`,
              ];
      if (input.quantScheme === "W8A8_PDMIX") {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "error",
          evidenceLevel: this.evidenceLevel,
          sources: versionSources,
          message: "w8a8_pdmix.py 中注册的方案名为 'W8A8_MIX'，不是 'W8A8_PDMIX'。",
          remediation: "请将量化方案名更正为 'W8A8_MIX'。",
        };
      }
      if (input.quantScheme !== "W8A8_MIX") return null;
      const isDNode = input.kvRole === "kv_consumer" || input.kvRole === "kv_both";
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message: isDNode
          ? `W8A8_MIX 在 ${input.kvRole}（is_kv_consumer=True）执行静态 AscendW8A8LinearMethod。`
          : "W8A8_MIX 在 P 端/混部实例执行动态 AscendW8A8DynamicLinearMethod（仍会加载静态 scale 缓冲区）。",
        effectiveMutation: {
          w8a8MixRuntimePath: isDNode ? "static-w8a8" : "dynamic-w8a8",
        },
      };
    },
  },
  {
    id: "d3-mxfp8-c8-kv-block-size",
    domain: "quantization",
    title: "MXFP8 C8 KV Cache 要求 block_size 为 512 的整数倍",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1446-L1461`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1509-L1515`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1502-L1508`,
    ],
    description:
      "当 cache_dtype='mxfp8' 时，block_size 必须为 512 的倍数：用户显式传入非法 --block-size 会抛 ValueError，自动选择时静默改写为 block_size=512。",
    rationale: "MXFP8 C8 KV 算子切块按 512 token 对齐。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "mxfp8") return null;
      const blockSize = input.blockSize ?? 128;
      if (blockSize > 0 && blockSize % 512 === 0) return null;
      if (input.userSpecifiedBlockSize) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "error",
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message: `ValueError: C8_MXFP 要求 --block-size 为 512 的整数倍（当前为 ${blockSize}）。`,
          remediation: "将 --block-size 设为 512（或 512 的其他整数倍）。",
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
        message: `MXFP8 C8 KV Cache 已将自动选择的 block_size=${blockSize} 静默改写为 512。`,
        effectiveMutation: { blockSize: 512 },
      };
    },
  },
  {
    id: "d3-turboquant-common-preconditions",
    domain: "quantization",
    title: "TurboQuant 4-bit KV 要求 BF16 与 Ascend A2/A3",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L15-L21`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L291-L303`,
    ],
    description: "turboquant_4bit_nc KV Cache 要求模型精度为 torch.bfloat16 且硬件为 Ascend A2 或 A3。",
    rationale: "TurboQuant 算子仅在 A2/A3 上为 BF16 注册，不支持 310P 或 A5/950。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc") return null;
      const badDtype = input.modelDtype !== undefined && input.modelDtype !== "bfloat16";
      const family = input.hardwareFamily ?? "A3";
      const badHardware = family !== "A2" && family !== "A3";
      if (!badDtype && !badHardware) return null;
      const reasons: string[] = [];
      if (badDtype) reasons.push(`model_dtype=${input.modelDtype}（要求 bfloat16）`);
      if (badHardware) reasons.push(`硬件=${family}（要求 A2 或 A3）`);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: turboquant_4bit_nc 前置条件不满足：${reasons.join("；")}。`,
        remediation: "在 Ascend A2/A3 上使用 bfloat16 精度，或关闭 turboquant_4bit_nc。",
      };
    },
  },
  {
    id: "d3-turboquant-route-a-sfa",
    domain: "quantization",
    title: "TurboQuant Route A（SFA Packed Cache）约束校验",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L24-L53`,
    ],
    description:
      "TurboQuant Route A（model_uses_sfa_sparse=True）禁止 enable_sparse_sfa_c8 与 xlite_graph_config，要求 kv_lora_rank=512 与 qk_rope_head_dim=64，且支持 CP。",
    rationale: "SFA 打包缓存排布与 sparse_sfa_c8 及 xlite 图下沉不兼容。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc" || !input.usesSfaSparse) return null;
      const errors: string[] = [];
      if (input.enableSparseSfaC8) errors.push("与 enable_sparse_sfa_c8=True 互斥");
      if (input.xliteEnabled) errors.push("与 xlite_graph_config.enabled=True 互斥");
      if (input.kvLoraRank !== undefined && input.kvLoraRank !== 512) {
        errors.push(`要求 kv_lora_rank=512（当前 ${input.kvLoraRank}）`);
      }
      if (input.qkRopeHeadDim !== undefined && input.qkRopeHeadDim !== 64) {
        errors.push(`要求 qk_rope_head_dim=64（当前 ${input.qkRopeHeadDim}）`);
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
        message: `ValueError: TurboQuant Route A（SFA 打包缓存）校验失败：${errors.join("；")}。`,
      };
    },
  },
  {
    id: "d3-turboquant-route-b-dsa",
    domain: "quantization",
    title: "TurboQuant Route B（DeepSeek V4 压缩缓存）约束校验",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L56-L95`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L56-L94`,
    ],
    description:
      "TurboQuant Route B（压缩缓存）要求 model_type='deepseek_v4'、head_dim=512、qk_rope_head_dim=64、index_topk ∈ {512,1024}、indexer_kv_dtype='int8'、num_attention_heads % (4*tp)==0，且不支持 CP（pcp=dcp=1）、KVPP、kv_transfer，并需 libnnopbase 符号 NnopbaseSupportTensorV2。",
    rationale: "MixedQuantSparseFlashMla 融合压缩算子严格依赖 DeepSeek V4 排布，且不支持远端 KV 或 CP 切分。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc" || input.usesSfaSparse) return null;
      const errors: string[] = [];
      if (input.modelType !== undefined && input.modelType !== "deepseek_v4") {
        errors.push(`要求 model_type='deepseek_v4'（当前 '${input.modelType}'）`);
      }
      if (input.headDim !== undefined && input.headDim !== 512) {
        errors.push(`要求 head_dim=512（当前 ${input.headDim}）`);
      }
      if (input.qkRopeHeadDim !== undefined && input.qkRopeHeadDim !== 64) {
        errors.push(`要求 qk_rope_head_dim=64（当前 ${input.qkRopeHeadDim}）`);
      }
      if (input.indexTopk !== undefined && input.indexTopk !== 512 && input.indexTopk !== 1024) {
        errors.push(`要求 index_topk 为 512 或 1024（当前 ${input.indexTopk}）`);
      }
      if (input.indexerKvDtype !== undefined && input.indexerKvDtype !== "int8") {
        errors.push(`要求 attention_config.indexer_kv_dtype='int8'（当前 '${input.indexerKvDtype}'）`);
      }
      const tp = Math.max(1, input.tpSize ?? 1);
      if (input.numAttentionHeads !== undefined && input.numAttentionHeads % (4 * tp) !== 0) {
        errors.push(`要求 num_attention_heads (${input.numAttentionHeads}) % (4 * tp=${4 * tp}) == 0`);
      }
      if ((input.pcpSize ?? 1) !== 1 || (input.dcpSize ?? 1) !== 1) {
        errors.push("不支持上下文并行（pcp != 1 或 dcp != 1）");
      }
      if ((input.kvppSize ?? 1) > 1) {
        errors.push("不支持 KV 层间并行（kvpp > 1）");
      }
      if (input.kvConnector !== undefined || input.kvRole !== undefined) {
        errors.push("不支持 KV 传输 / PD 分离");
      }
      if (input.nnopbaseSupportTensorV2 === false) {
        errors.push("缺少 libnnopbase.so 符号 NnopbaseSupportTensorV2");
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
        message: `ValueError: TurboQuant Route B（DeepSeek V4）校验失败：${errors.join("；")}。`,
      };
    },
  },
  {
    id: "d3-turboquant-route-b-mrv2-v030",
    domain: "quantization",
    title: "TurboQuant Route B 要求 use_v2_model_runner（仅 v0.30.0）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L64-L65`,
    ],
    description:
      "v0.30.0 下 TurboQuant Route B（DeepSeek V4 压缩缓存）显式要求 use_v2_model_runner（VLLM_USE_V2_MODEL_RUNNER=1）；main 分支已移除此校验。",
    rationale: "main 分支中 ModelRunner V2 已成为唯一执行器，移除了旧版 V1 守卫。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc" || input.usesSfaSparse) return null;
      if (input.useV2ModelRunner !== false) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "ValueError: v0.30.0 下 DeepSeek V4 TurboQuant Route B 要求开启 use_v2_model_runner（VLLM_USE_V2_MODEL_RUNNER=1）。",
        remediation: "导出环境变量 VLLM_USE_V2_MODEL_RUNNER=1。",
      };
    },
  },
  {
    id: "d3-gqa-c8-requires-quant-weights",
    domain: "quantization",
    title: "GQA C8 KV Cache（--kv-cache-dtype int8）要求 ModelSlim 量化权重",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L570-L587`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L614-L631`,
    ],
    description:
      "标准 GQA 注意力（attention_v1.py）使用静态 C8 KV 量化：当 --kv-cache-dtype 设为 int8（或其他非 MXFP8 量化精度）但未使用带 enable_c8_quant=True 的 ModelSlim --quantization ascend 权重时，直接抛 ValueError。",
    rationale: "GQA C8 KV 量化依赖 ModelSlim 权重中离线校准的静态 KV scale；仅 MXFP8 豁免 enable_c8_quant。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.useMla || input.usesSfaSparse) return null;
      const cacheDtype = input.cacheDtype?.toLowerCase();
      if (
        !cacheDtype ||
        cacheDtype === "auto" ||
        cacheDtype === "float16" ||
        cacheDtype === "bfloat16" ||
        cacheDtype === "float32" ||
        cacheDtype === "mxfp8" ||
        cacheDtype === "turboquant_4bit_nc"
      ) {
        return null;
      }
      if (input.enableC8Quant === true) return null;
      const versionSources =
        version === "main"
          ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L614-L631`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L570-L587`,
            ];
      if (input.enableC8Quant === false || input.quantMethod !== "ascend") {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "error",
          evidenceLevel: this.evidenceLevel,
          sources: versionSources,
          message: `ValueError: GQA 启用 --kv-cache-dtype ${input.cacheDtype} 要求 ModelSlim C8 量化权重（--quantization ascend 且 enable_c8_quant=True）；非量化权重会在 attention_v1.py 直接抛 ValueError。`,
          remediation:
            "改用带 C8 校准参数的 ModelSlim 权重并配合 --quantization ascend，或移除 --kv-cache-dtype int8（保持 auto/BF16）。",
        };
      }
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "warn",
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message: `GQA 启用 --kv-cache-dtype ${input.cacheDtype} 与 --quantization ascend 时，要求权重目录的 quant_model_description.json 包含 C8 KV 校准 scale（enable_c8_quant=True），否则 attention_v1.py 会抛 ValueError。`,
        remediation:
          "请确认 quant_model_description.json 包含 C8 KV scale，或将 --kv-cache-dtype 改回 auto。",
      };
    },
  },
  {
    id: "d3-310p-requires-float16",
    domain: "quantization",
    title: "Ascend 310P（Atlas 300I DUO）不支持 BF16，必须显式传入 --dtype float16",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3-Dense.md#L270-L293`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/_310p/quantization/methods/w8a8_base.py#L25-L34`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L417-L440`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/_310p/quantization/methods/w8a8_base.py#L25-L34`,
    ],
    description:
      "Ascend 310P（Atlas 300I DUO / 200I Pro）硬件不支持 BF16，必须显式指定 --dtype float16；即使加载 --quantization ascend 的 W8A8SC 量化权重也不例外（默认 --dtype auto 会从 config.json 解析为 BF16 而报错）。",
    rationale: "310P COMPATIBILITY 路径的注意力、MoE 与 ModelSlim W8A8/W8A8SC 算子均工作在 float16。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily !== "310P") return null;
      if (input.modelDtype !== "bfloat16") return null;
      const versionSources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L417-L440`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/_310p/quantization/methods/w8a8_base.py#L25-L34`,
            ]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3-Dense.md#L270-L293`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/_310p/quantization/methods/w8a8_base.py#L25-L34`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message:
          "不支持：Ascend 310P（Atlas 300I DUO）无 BF16 硬件支持，必须显式传入 --dtype float16（即便是 ModelSlim W8A8SC --quantization ascend 也需要，否则默认 auto 会从 config.json 推导出 BF16）。",
        remediation: "在 Ascend 310P 上显式添加 --dtype float16。",
      };
    },
  },
  {
    id: "d3-gqa-c8-block-size-multiple-32",
    domain: "quantization",
    title: "GQA C8 INT8 KV Cache 要求 block_size 为 32 的整数倍",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L1560-L1561`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L1608-L1611`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L1648`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L1696-L1698`,
    ],
    description:
      "GQA C8 INT8 分页 KV 解码与分块 Prefill 路径在构造 npu_fused_infer_attention_score 的 NZ 5D 视图前，会断言 block_size % 32 == 0。",
    rationale: "NZ 5D INT8 KV 排布按 32 元素切片对 block_size 进行分块。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.useMla || input.usesSfaSparse) return null;
      const cacheDtype = input.cacheDtype?.toLowerCase();
      if (cacheDtype === "mxfp8") return null;
      const c8Int8Active = cacheDtype === "int8" || Boolean(input.enableC8Quant);
      if (!c8Int8Active) return null;
      if (input.blockSize === undefined || input.blockSize % 32 === 0) return null;
      const versionSources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L1648`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/attention_v1.py#L1696-L1698`,
            ]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L1560-L1561`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L1608-L1611`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message: `AssertionError: C8 INT8 KV Cache 要求 block_size 为 32 的整数倍（当前为 ${input.blockSize}）。`,
        remediation: "将 --block-size 设为 32 的整数倍（例如 64 或 128）。",
      };
    },
  },
];

export function evaluateDomain3Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain3Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
