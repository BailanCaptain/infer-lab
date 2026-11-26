import type { ComponentType } from "react";
import { AclGraphModeInteractive } from "./AclGraphModeInteractive";
import {
  ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
  AscendFaTilingInteractive,
} from "./AscendFaTilingInteractive";
import { ChunkedPrefillInteractive } from "./ChunkedPrefillInteractive";
import {
  CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256,
  ContinuousBatchingTraceInteractive,
} from "./ContinuousBatchingTraceInteractive";
import {
  ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
  EngramLookupFlowInteractive,
} from "./EngramLookupFlowInteractive";
import { EPLB_CYCLE_APPROVED_SHA256, EplbCycleInteractive } from "./EplbCycleInteractive";
import {
  GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256,
  GqaSharedKvInteractive,
} from "./GqaSharedKvInteractive";
import {
  LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
  LowPrecisionBitInteractive,
} from "./LowPrecisionBitInteractive";
import {
  MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256,
  MemProfWaterfallInteractive,
} from "./MemProfWaterfallInteractive";
import { MLA_INTUITION_APPROVED_SHA256, MlaIntuitionInteractive } from "./MlaIntuitionInteractive";
import {
  ModelOnboardingGatesInteractive,
  ONBOARDING_FOUR_GATES_APPROVED_SHA256,
} from "./ModelOnboardingGatesInteractive";
import { MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256, MoeRouterCalcInteractive } from "./MoeRouterCalcInteractive";
import {
  MOONCAKE_CONNECTOR_APPROVED_SHA256,
  MooncakeConnectorInteractive,
} from "./MooncakeConnectorInteractive";
import {
  PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256,
  PagedAttentionWasteInteractive,
} from "./PagedAttentionWasteInteractive";
import {
  PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
  PdDisaggIntuitionInteractive,
} from "./PdDisaggIntuitionInteractive";
import {
  PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
  PrefillComputeBwInteractive,
} from "./PrefillComputeBwInteractive";
import { PrefixCachingInteractive } from "./PrefixCachingInteractive";
import {
  type InteractiveDiagramProps,
  QuantizationIntuitionInteractive,
} from "./QuantizationIntuitionInteractive";
import {
  REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256,
  RequestCausalKvMlpInteractive,
} from "./RequestCausalKvMlpInteractive";
import { RforkFallbackInteractive } from "./RforkFallbackInteractive";
import {
  RFORK_TROUBLESHOOTING_APPROVED_SHA256,
  RforkTroubleshootingInteractive,
} from "./RforkTroubleshootingInteractive";
import {
  ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
  RooflineMatmulInteractive,
} from "./RooflineMatmulInteractive";
import {
  SPECULATIVE_DECODING_APPROVED_SHA256,
  SpeculativeDecodingInteractive,
} from "./SpeculativeDecodingInteractive";
import {
  TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
  TensorLayoutNdNzInteractive,
} from "./TensorLayoutNdNzInteractive";
import { TOKEN_BPE_APPROVED_SHA256, TokenBpeInteractive } from "./TokenBpeInteractive";
import {
  V030_MIG_FIG_CHECKLIST_APPROVED_SHA256,
  V030MigChecklistInteractive,
} from "./V030MigChecklistInteractive";
import { WORKER_LIFECYCLE_APPROVED_SHA256, WorkerLifecycleInteractive } from "./WorkerLifecycleInteractive";

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/**
 * 纯 TypeScript 同步 FIPS 180-4 UTF-8 SHA-256，供浏览器渲染期同步核对人工注册图与审定 SVG 版本指纹。
 */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, "0")).join("");
}

export interface InteractiveDiagramRegistration {
  readonly id: string;
  /** 绑定人工审定时对应静态 SVG（LF 归一后）的精确 SHA-256；候选预览或正式图变更时自动退回真实静态 SVG */
  readonly approvedSvgSha256: string;
  readonly Component: ComponentType<InteractiveDiagramProps>;
}

const VALID_DIAGRAM_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const QUANTIZATION_INTUITION_APPROVED_SHA256 =
  "babc9b8e90798f1375d7eca7410edc9d85202a0b6924928f4dd498dd48a2e0fc";
export const PREFIX_CACHING_APPROVED_SHA256 =
  "00c404a6eb577a9ad39e13553ff7d5ee6c902c0cbcfc623af2a98cc9b40d06bd";
export const CHUNKED_PREFILL_BUDGET_GAME_APPROVED_SHA256 =
  "6104ef044abcbb31394d3c5d10d1c7c20788ab4c1735eb4367968573e5a6b1e7";
export const ACL_GRAPH_MODE_BUDGET_APPROVED_SHA256 =
  "919524920ff9b4f53d4ee50cbb9cb8c96da51eefb4f2ca1cf07343004b773a77";
export const RFORK_ROUTE_AND_FALLBACK_APPROVED_SHA256 =
  "8a818887ca8c5672463f32616905f804ab4a8344dc016e00d03c75e51d07b73d";

export {
  ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
  CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256,
  ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
  EPLB_CYCLE_APPROVED_SHA256,
  GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256,
  LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
  MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256,
  MLA_INTUITION_APPROVED_SHA256,
  MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256,
  MOONCAKE_CONNECTOR_APPROVED_SHA256,
  ONBOARDING_FOUR_GATES_APPROVED_SHA256,
  PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256,
  PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
  PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
  REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256,
  RFORK_TROUBLESHOOTING_APPROVED_SHA256,
  ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
  SPECULATIVE_DECODING_APPROVED_SHA256,
  TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
  TOKEN_BPE_APPROVED_SHA256,
  V030_MIG_FIG_CHECKLIST_APPROVED_SHA256,
  WORKER_LIFECYCLE_APPROVED_SHA256,
};

/**
 * 人工代码审查的编译期静态白名单注册表：
 * 仅允许显式静态 import 的组件，绝不接受外部模块路径、动态 import 或任意组件字符串。
 */
const INTERACTIVE_2D_REGISTRY: ReadonlyMap<string, InteractiveDiagramRegistration> = new Map([
  [
    "quantization-intuition",
    {
      id: "quantization-intuition",
      approvedSvgSha256: QUANTIZATION_INTUITION_APPROVED_SHA256,
      Component: QuantizationIntuitionInteractive,
    },
  ],
  [
    "prefix-caching",
    {
      id: "prefix-caching",
      approvedSvgSha256: PREFIX_CACHING_APPROVED_SHA256,
      Component: PrefixCachingInteractive,
    },
  ],
  [
    "chunked-prefill-fig-budget-game",
    {
      id: "chunked-prefill-fig-budget-game",
      approvedSvgSha256: CHUNKED_PREFILL_BUDGET_GAME_APPROVED_SHA256,
      Component: ChunkedPrefillInteractive,
    },
  ],
  [
    "acl-graph-fig-mode-budget",
    {
      id: "acl-graph-fig-mode-budget",
      approvedSvgSha256: ACL_GRAPH_MODE_BUDGET_APPROVED_SHA256,
      Component: AclGraphModeInteractive,
    },
  ],
  [
    "rfork-fig-route-and-fallback",
    {
      id: "rfork-fig-route-and-fallback",
      approvedSvgSha256: RFORK_ROUTE_AND_FALLBACK_APPROVED_SHA256,
      Component: RforkFallbackInteractive,
    },
  ],
  [
    "request-fig-causal-kv-mlp",
    {
      id: "request-fig-causal-kv-mlp",
      approvedSvgSha256: REQUEST_FIG_CAUSAL_KV_MLP_APPROVED_SHA256,
      Component: RequestCausalKvMlpInteractive,
    },
  ],
  [
    "token-bpe",
    {
      id: "token-bpe",
      approvedSvgSha256: TOKEN_BPE_APPROVED_SHA256,
      Component: TokenBpeInteractive,
    },
  ],
  [
    "gqa-fig-shared-kv-cost-split",
    {
      id: "gqa-fig-shared-kv-cost-split",
      approvedSvgSha256: GQA_FIG_SHARED_KV_COST_SPLIT_APPROVED_SHA256,
      Component: GqaSharedKvInteractive,
    },
  ],
  [
    "moe-router-calc-qwen3",
    {
      id: "moe-router-calc-qwen3",
      approvedSvgSha256: MOE_ROUTER_CALC_QWEN3_APPROVED_SHA256,
      Component: MoeRouterCalcInteractive,
    },
  ],
  [
    "continuous-batching-two-queues-trace",
    {
      id: "continuous-batching-two-queues-trace",
      approvedSvgSha256: CONTINUOUS_BATCHING_TWO_QUEUES_TRACE_APPROVED_SHA256,
      Component: ContinuousBatchingTraceInteractive,
    },
  ],
  [
    "paged-attention-fig-waste-vs-paging",
    {
      id: "paged-attention-fig-waste-vs-paging",
      approvedSvgSha256: PAGED_ATTENTION_FIG_WASTE_VS_PAGING_APPROVED_SHA256,
      Component: PagedAttentionWasteInteractive,
    },
  ],
  [
    "mla-intuition",
    {
      id: "mla-intuition",
      approvedSvgSha256: MLA_INTUITION_APPROVED_SHA256,
      Component: MlaIntuitionInteractive,
    },
  ],
  [
    "speculative-decoding",
    {
      id: "speculative-decoding",
      approvedSvgSha256: SPECULATIVE_DECODING_APPROVED_SHA256,
      Component: SpeculativeDecodingInteractive,
    },
  ],
  [
    "roofline-matmul-intensity",
    {
      id: "roofline-matmul-intensity",
      approvedSvgSha256: ROOFLINE_MATMUL_INTENSITY_APPROVED_SHA256,
      Component: RooflineMatmulInteractive,
    },
  ],
  [
    "ascend-fa-hbm-vs-tiling",
    {
      id: "ascend-fa-hbm-vs-tiling",
      approvedSvgSha256: ASCEND_FA_HBM_VS_TILING_APPROVED_SHA256,
      Component: AscendFaTilingInteractive,
    },
  ],
  [
    "eplb-cycle",
    {
      id: "eplb-cycle",
      approvedSvgSha256: EPLB_CYCLE_APPROVED_SHA256,
      Component: EplbCycleInteractive,
    },
  ],
  [
    "mooncake-connector",
    {
      id: "mooncake-connector",
      approvedSvgSha256: MOONCAKE_CONNECTOR_APPROVED_SHA256,
      Component: MooncakeConnectorInteractive,
    },
  ],
  [
    "worker-lifecycle",
    {
      id: "worker-lifecycle",
      approvedSvgSha256: WORKER_LIFECYCLE_APPROVED_SHA256,
      Component: WorkerLifecycleInteractive,
    },
  ],
  [
    "mem-prof-fig-qwen3-waterfall",
    {
      id: "mem-prof-fig-qwen3-waterfall",
      approvedSvgSha256: MEM_PROF_FIG_QWEN3_WATERFALL_APPROVED_SHA256,
      Component: MemProfWaterfallInteractive,
    },
  ],
  [
    "v030-mig-fig-checklist",
    {
      id: "v030-mig-fig-checklist",
      approvedSvgSha256: V030_MIG_FIG_CHECKLIST_APPROVED_SHA256,
      Component: V030MigChecklistInteractive,
    },
  ],
  [
    "rfork-troubleshooting",
    {
      id: "rfork-troubleshooting",
      approvedSvgSha256: RFORK_TROUBLESHOOTING_APPROVED_SHA256,
      Component: RforkTroubleshootingInteractive,
    },
  ],
  [
    "prefill-fig-compute-vs-bw",
    {
      id: "prefill-fig-compute-vs-bw",
      approvedSvgSha256: PREFILL_FIG_COMPUTE_VS_BW_APPROVED_SHA256,
      Component: PrefillComputeBwInteractive,
    },
  ],
  [
    "low-prec-fig-bit-anatomy",
    {
      id: "low-prec-fig-bit-anatomy",
      approvedSvgSha256: LOW_PREC_FIG_BIT_ANATOMY_APPROVED_SHA256,
      Component: LowPrecisionBitInteractive,
    },
  ],
  [
    "onboarding-four-gates",
    {
      id: "onboarding-four-gates",
      approvedSvgSha256: ONBOARDING_FOUR_GATES_APPROVED_SHA256,
      Component: ModelOnboardingGatesInteractive,
    },
  ],
  [
    "tensor-layout-fig-nd-nz-cube",
    {
      id: "tensor-layout-fig-nd-nz-cube",
      approvedSvgSha256: TENSOR_LAYOUT_FIG_ND_NZ_CUBE_APPROVED_SHA256,
      Component: TensorLayoutNdNzInteractive,
    },
  ],
  [
    "engram-fig-lookup-flow",
    {
      id: "engram-fig-lookup-flow",
      approvedSvgSha256: ENGRAM_FIG_LOOKUP_FLOW_APPROVED_SHA256,
      Component: EngramLookupFlowInteractive,
    },
  ],
  [
    "pd-disaggregation-intuition",
    {
      id: "pd-disaggregation-intuition",
      approvedSvgSha256: PD_DISAGGREGATION_INTUITION_APPROVED_SHA256,
      Component: PdDisaggIntuitionInteractive,
    },
  ],
]);

export function registeredInteractiveDiagramIds(): readonly string[] {
  return [...INTERACTIVE_2D_REGISTRY.keys()];
}

export function resolveInteractiveDiagram(options: {
  id: string;
  svg: string | undefined;
  /** 默认关闭；ReviewPane 等未发布预览必须保持关闭，始终渲染候选自身清洗后的静态 SVG */
  allowInteractive?: boolean | undefined;
}): InteractiveDiagramRegistration | null {
  if (options.allowInteractive !== true || typeof options.svg !== "string" || !options.svg) {
    return null;
  }
  if (!VALID_DIAGRAM_ID_RE.test(options.id)) return null;
  const entry = INTERACTIVE_2D_REGISTRY.get(options.id);
  if (!entry) return null;
  const normalizedSvg = options.svg.replace(/\r\n/g, "\n");
  if (sha256Hex(normalizedSvg) !== entry.approvedSvgSha256) return null;
  return entry;
}
