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
    title: "Native FP8 Without weight_block_size Raises NotImplementedError",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/configs/fp8_config.py#L45-L54`,
    ],
    description:
      "Native FP8 checkpoints without quantization_config.weight_block_size (per-tensor or per-channel FP8) have no Ascend execution path and raise NotImplementedError.",
    rationale: "vLLM Ascend only accepts block-wise native FP8 scales on config load.",
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
          "NotImplementedError: vLLM Ascend serves native FP8 checkpoints only when quantization_config.weight_block_size is present.",
        remediation:
          "Use a block-wise FP8 checkpoint or re-quantize with ModelSlim (--quantization ascend) / llm-compressor (--quantization compressed-tensors).",
      };
    },
  },
  {
    id: "d3-fp8-non-dynamic-activation",
    domain: "quantization",
    title: "Native FP8 Requires activation_scheme='dynamic'",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/configs/fp8_config.py#L55-L59`,
    ],
    description:
      "Native block-wise FP8 checkpoints with activation_scheme != 'dynamic' raise NotImplementedError in AscendFusedMoE/Linear FP8 config verification.",
    rationale: "Static FP8 activation scales are unsupported in Ascend native FP8 config verification.",
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
        message: `NotImplementedError: Native FP8 requires activation_scheme='dynamic', got '${input.activationScheme}'.`,
        remediation: "Use a dynamic-activation block-wise FP8 checkpoint.",
      };
    },
  },
  {
    id: "d3-fp8-block-950-mxfp8",
    domain: "quantization",
    title: "Native Block-Wise FP8 Re-Quantized to MXFP8 on Ascend 950 (Except kv_b_proj / Non-32 Multiples)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L229`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/w8a8/w8a8_mxfp8.py#L77-L78`,
    ],
    description:
      "On Ascend 950 (A5), native block-wise FP8 weights are re-quantized on load to MXFP8 (1 E8M0 scale per 32 elements, ~1 B/elem), except kv_b_proj or layers with in_features % 32 != 0 which remain dense in model_dtype.",
    rationale:
      "Enables native npu_quant_matmul 1-byte weight footprint on 950 while preserving compatibility for absorbed/unaligned projections.",
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
            ? "Ascend 950 keeps kv_b_proj dense in model_dtype (BF16/FP16, ~2 B/elem) instead of MXFP8."
            : `Ascend 950 falls back to dense model_dtype (~2 B/elem) because in_features=${input.inFeatures} is not divisible by MXFP8 group_size=32.`,
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
          "Ascend 950 re-quantizes block-wise FP8 weights to MXFP8 (1B E8M0 scale per 32 elements, ~1 B/elem) for npu_quant_matmul.",
        effectiveMutation: { resolvedWeightFormat: "mxfp8", bytesPerElemApprox: 1 },
      };
    },
  },
  {
    id: "d3-fp8-block-non950-bf16-v030",
    domain: "quantization",
    title: "Native Block-Wise FP8 Silently Dequantized to model_dtype (BF16) on A2/A3 (v0.30.0)",
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
      "In v0.30.0, serving a native block-wise FP8 checkpoint on Atlas A2/A3 (STANDARD quantization_backend_family, which registers AscendFp8Config) silently dequantizes weights into model_dtype (typically BF16, ~2 B/elem), doubling weight memory footprint. Does not apply to 310P (COMPATIBILITY backend; unsupported).",
    rationale:
      "Atlas A2/A3 register AscendFp8Config via STANDARD quantization_backend_family but lack hardware FP8 matmul; v0.30.0 keeps weights expanded in model_dtype (typically BF16) and executes unquantized GEMM.",
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
        message: `On ${family} in v0.30.0 (STANDARD quantization backend), native block-wise FP8 weights are silently dequantized to ${input.modelDtype ?? "bfloat16"} (~2 B/elem, 2x footprint) via unquantized GEMM.`,
        effectiveMutation: { resolvedWeightFormat: input.modelDtype ?? "bfloat16", bytesPerElemApprox: 2 },
      };
    },
  },
  {
    id: "d3-fp8-block-non950-error-main",
    domain: "quantization",
    title: "Native Block-Wise FP8 Rejected on A2/A3 with NotImplementedError (main)",
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
      "In vllm-ascend main (8d6180e2), silent model_dtype (typically BF16) dequantization on Atlas A2/A3 was removed; _require_fp8_weight_matmul() raises NotImplementedError on STANDARD-backend chips lacking WeightFormat.FP8. (310P does not register AscendFp8Config; see d3-fp8-310p-unsupported.)",
    rationale: "Prevents unexpected 2x HBM OOM surprises when deploying FP8 checkpoints on A2/A3 hardware.",
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
        message: `NotImplementedError: Native block-wise FP8 checkpoints run on Ascend 950 only in main; ${family} has no FP8 matmul.`,
        remediation: "Serve the BF16 release or re-quantize with ModelSlim / llm-compressor.",
      };
    },
  },
  {
    id: "d3-fp8-310p-unsupported",
    domain: "quantization",
    title: "Native FP8 Unsupported on Ascend 310P (COMPATIBILITY Backend, No AscendFp8Config)",
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
      "Ascend 310P (300I DUO) uses QuantizationBackendFamily.COMPATIBILITY (and FP16 model_dtype, not BF16), so platform.py only registers AscendModelSlimConfig310 and never imports/registers AscendFp8Config. Native FP8 has no Ascend execution path on 310P in v0.30.0 or main (it never silently dequantizes to BF16).",
    rationale:
      "310P COMPATIBILITY quantization backend only supports AscendModelSlimConfig310 (FP16 / INT8); native FP8 checkpoints have no Ascend execution path.",
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
          "Unsupported: Ascend 310P (300I DUO) uses QuantizationBackendFamily.COMPATIBILITY (model_dtype is FP16, not BF16) and does not register AscendFp8Config, so native FP8 has no Ascend execution path and is unsupported (no silent dequantization).",
        remediation:
          "Use an FP16 checkpoint or a ModelSlim INT8 checkpoint served with --quantization ascend (AscendModelSlimConfig310), or deploy native FP8 on Ascend 950.",
      };
    },
  },
  {
    id: "d3-w8a8-mix-pd-dispatch",
    domain: "quantization",
    title: "W8A8_MIX Scheme Dispatches Static W8A8 on D-Node vs Dynamic W8A8 on P/Colocated",
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
      "Registered scheme name is 'W8A8_MIX' (in w8a8_pdmix.py, not 'W8A8_PDMIX'). It always loads static W8A8 weight/input_scale/deq_scale metadata and dispatches via is_kv_consumer to static AscendW8A8LinearMethod on D-nodes / PD-mixed (kv_consumer or kv_both) vs dynamic AscendW8A8DynamicLinearMethod on P-nodes or colocated instances.",
    rationale:
      "Ensures decode and kv_both nodes benefit from static W8A8 while prefill/colocated nodes keep dynamic activation precision.",
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
          message: "Registered scheme name in w8a8_pdmix.py is 'W8A8_MIX', not 'W8A8_PDMIX'.",
          remediation: "Use quant scheme 'W8A8_MIX'.",
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
          ? `W8A8_MIX on ${input.kvRole} (is_kv_consumer=True) executes static AscendW8A8LinearMethod.`
          : "W8A8_MIX on P-node/colocated executes dynamic AscendW8A8DynamicLinearMethod (still loads static scale buffers).",
        effectiveMutation: {
          w8a8MixRuntimePath: isDNode ? "static-w8a8" : "dynamic-w8a8",
        },
      };
    },
  },
  {
    id: "d3-mxfp8-c8-kv-block-size",
    domain: "quantization",
    title: "MXFP8 C8 KV Cache Requires block_size Multiple of 512",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1446-L1461`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1509-L1515`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1502-L1508`,
    ],
    description:
      "When cache_dtype='mxfp8', block_size must be a multiple of 512: raises ValueError if user explicitly passed --block-size, or silently rewrites block_size=512 if auto-selected.",
    rationale: "MXFP8 C8 KV kernel tiling aligns on 512-token blocks.",
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
          message: `ValueError: C8_MXFP requires --block-size to be a multiple of 512 (got ${blockSize}).`,
          remediation: "Set --block-size 512 (or another multiple of 512).",
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
        message: `MXFP8 C8 KV cache silently rewrites auto block_size=${blockSize} to 512.`,
        effectiveMutation: { blockSize: 512 },
      };
    },
  },
  {
    id: "d3-turboquant-common-preconditions",
    domain: "quantization",
    title: "TurboQuant 4-bit KV Requires BF16 + Ascend A2/A3",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L15-L21`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L291-L303`,
    ],
    description:
      "turboquant_4bit_nc KV cache requires torch.bfloat16 model dtype and Ascend A2 or A3 hardware.",
    rationale: "TurboQuant kernels are only registered for BF16 on A2/A3 (not 310P or A5/950).",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc") return null;
      const badDtype = input.modelDtype !== undefined && input.modelDtype !== "bfloat16";
      const family = input.hardwareFamily ?? "A3";
      const badHardware = family !== "A2" && family !== "A3";
      if (!badDtype && !badHardware) return null;
      const reasons: string[] = [];
      if (badDtype) reasons.push(`model_dtype=${input.modelDtype} (requires bfloat16)`);
      if (badHardware) reasons.push(`hardware=${family} (requires A2 or A3)`);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: turboquant_4bit_nc preconditions failed: ${reasons.join("; ")}.`,
        remediation: "Use bfloat16 on Ascend A2/A3 or disable turboquant_4bit_nc.",
      };
    },
  },
  {
    id: "d3-turboquant-route-a-sfa",
    domain: "quantization",
    title: "TurboQuant Route A (SFA Packed Cache) Constraints",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L24-L53`,
    ],
    description:
      "TurboQuant Route A (model_uses_sfa_sparse=True) forbids enable_sparse_sfa_c8 and xlite_graph_config, requires kv_lora_rank=512 and qk_rope_head_dim=64, and permits CP.",
    rationale: "SFA packed cache layout conflicts with sparse_sfa_c8 and xlite graph lowering.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc" || !input.usesSfaSparse) return null;
      const errors: string[] = [];
      if (input.enableSparseSfaC8) errors.push("incompatible with enable_sparse_sfa_c8=True");
      if (input.xliteEnabled) errors.push("incompatible with xlite_graph_config.enabled=True");
      if (input.kvLoraRank !== undefined && input.kvLoraRank !== 512) {
        errors.push(`requires kv_lora_rank=512 (got ${input.kvLoraRank})`);
      }
      if (input.qkRopeHeadDim !== undefined && input.qkRopeHeadDim !== 64) {
        errors.push(`requires qk_rope_head_dim=64 (got ${input.qkRopeHeadDim})`);
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
        message: `ValueError: TurboQuant Route A (SFA packed) failed: ${errors.join("; ")}.`,
      };
    },
  },
  {
    id: "d3-turboquant-route-b-dsa",
    domain: "quantization",
    title: "TurboQuant Route B (DeepSeek V4 Compressed Cache) Constraints",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L56-L95`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L56-L94`,
    ],
    description:
      "TurboQuant Route B (compressed cache) requires model_type='deepseek_v4', head_dim=512, qk_rope_head_dim=64, index_topk in {512,1024}, indexer_kv_dtype='int8', num_attention_heads % (4*tp)==0, no CP (pcp=dcp=1), no KVPP, no kv_transfer, and libnnopbase NnopbaseSupportTensorV2.",
    rationale:
      "MixedQuantSparseFlashMla fused compressed cache kernel requires exact DeepSeek V4 layout and no remote KV/CP sharding.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cacheDtype !== "turboquant_4bit_nc" || input.usesSfaSparse) return null;
      const errors: string[] = [];
      if (input.modelType !== undefined && input.modelType !== "deepseek_v4") {
        errors.push(`requires model_type='deepseek_v4' (got '${input.modelType}')`);
      }
      if (input.headDim !== undefined && input.headDim !== 512) {
        errors.push(`requires head_dim=512 (got ${input.headDim})`);
      }
      if (input.qkRopeHeadDim !== undefined && input.qkRopeHeadDim !== 64) {
        errors.push(`requires qk_rope_head_dim=64 (got ${input.qkRopeHeadDim})`);
      }
      if (input.indexTopk !== undefined && input.indexTopk !== 512 && input.indexTopk !== 1024) {
        errors.push(`requires index_topk in (512, 1024) (got ${input.indexTopk})`);
      }
      if (input.indexerKvDtype !== undefined && input.indexerKvDtype !== "int8") {
        errors.push(`requires attention_config.indexer_kv_dtype='int8' (got '${input.indexerKvDtype}')`);
      }
      const tp = Math.max(1, input.tpSize ?? 1);
      if (input.numAttentionHeads !== undefined && input.numAttentionHeads % (4 * tp) !== 0) {
        errors.push(`requires num_attention_heads (${input.numAttentionHeads}) % (4 * tp=${4 * tp}) == 0`);
      }
      if ((input.pcpSize ?? 1) !== 1 || (input.dcpSize ?? 1) !== 1) {
        errors.push("does not support context parallelism (pcp != 1 or dcp != 1)");
      }
      if ((input.kvppSize ?? 1) > 1) {
        errors.push("does not support KV layer parallelism (kvpp > 1)");
      }
      if (input.kvConnector !== undefined || input.kvRole !== undefined) {
        errors.push("does not support KV transfer / PD disaggregation");
      }
      if (input.nnopbaseSupportTensorV2 === false) {
        errors.push("requires libnnopbase.so symbol NnopbaseSupportTensorV2");
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
        message: `ValueError: TurboQuant Route B (DeepSeek V4) failed: ${errors.join("; ")}.`,
      };
    },
  },
  {
    id: "d3-turboquant-route-b-mrv2-v030",
    domain: "quantization",
    title: "TurboQuant Route B Requires use_v2_model_runner (v0.30.0 Only)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L64-L65`,
    ],
    description:
      "In v0.30.0, TurboQuant Route B (DeepSeek V4 compressed cache) explicitly requires use_v2_model_runner (VLLM_USE_V2_MODEL_RUNNER=1); this check was removed in main.",
    rationale: "ModelRunner V2 became the sole runner in main, removing the legacy V1 guard.",
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
          "ValueError: In v0.30.0, DeepSeek V4 TurboQuant Route B requires use_v2_model_runner (VLLM_USE_V2_MODEL_RUNNER=1).",
        remediation: "Set VLLM_USE_V2_MODEL_RUNNER=1.",
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
