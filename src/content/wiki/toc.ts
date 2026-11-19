/**
 * 知识库目录的唯一编排处：按知识主题组织，课程 chapters 只保留课程关联。
 * 已编排页面优先；RFork/参数/记录按各自规则归位；新教学页显式等待编排。
 * 不用页型、生成来源或课程章号猜测知识主题，每页只出现一次。
 */
import type { z } from "zod";
import { pageDisplayTitle } from "./param-display";
import type { tocPlacementSchema } from "./schema";

export type ReadingTrack = "core-26" | "mainline" | "advanced";

export const CORE_26_IDS = [
  // Wave 1 (4)
  "request-overview",
  "ascend-model-onboarding",
  "hf-model-anatomy",
  "quantization",
  // Wave 2 (22)
  "ascend-env-and-serve",
  "token",
  "attention-qkv",
  "gqa",
  "prefill",
  "kv-cache",
  "continuous-batching",
  "paged-attention",
  "chunked-prefill",
  "roofline-and-metrics",
  "hardware-devices",
  "ai-core",
  "ascend-flash-attention",
  "low-precision-formats",
  "collective-communication",
  "tensor-parallel",
  "pipeline-parallel",
  "data-parallel",
  "expert-parallel",
  "npu-worker-lifecycle",
  "kv-cache-memory-profiling",
  "core-cli-params",
] as const;

export const CORE_26_SET: ReadonlySet<string> = new Set(CORE_26_IDS);

export interface TocPage {
  toc?: z.infer<typeof tocPlacementSchema> | undefined;
  id: string;
  title: string;
  displayTitle?: string | undefined;
  type: string;
  chapters: string[];
  order: number;
  origin?: string;
}

export interface TocSection<P> {
  title: string;
  track?: ReadingTrack | undefined;
  pages: P[];
}

export interface TocPart<P> {
  id:
    | "guide"
    | "models"
    | "inference"
    | "hardware"
    | "distributed"
    | "disaggregation"
    | "architecture"
    | "performance"
    | "cases"
    | "references"
    | "rfork"
    | "params";
  title: string;
  blurb: string;
  sections: TocSection<P>[];
}

const PARTS: Pick<TocPart<never>, "id" | "title" | "blurb">[] = [
  { id: "guide", title: "全景入门与新模型上线", blurb: "两条生命线、请求全景与新模型在昇腾上线的标准起步" },
  {
    id: "models",
    title: "标准模型单层计算与多模态输入",
    blurb: "标准 Dense GQA 模型单层前向、MoE 路由与多模态视觉输入",
  },
  {
    id: "inference",
    title: "单实例调度、分页 KV 缓存与注意力状态变体",
    blurb: "单实例请求闭环、分页块表、KV 压缩变体与前缀投机调度",
  },
  {
    id: "hardware",
    title: "昇腾硬件体系、注意力分块与现代量化",
    blurb: "四族昇腾硬件、FlashAttention 算子族与低比特量化双路径",
  },
  {
    id: "distributed",
    title: "集合通信原语、分布式并行与负载均衡",
    blurb: "HCCL 原语、四维基础并行、高阶耦合链与 DP/EP 动态负载均衡",
  },
  {
    id: "disaggregation",
    title: "PD / EPD 分离架构与跨实例外置 KV 体系",
    blurb: "PD/EPD 不对称并行、Mooncake 传输重切分、D 端回退与外置缓存池",
  },
  {
    id: "architecture",
    title: "vllm-ascend 两仓架构、冷启动与图编译引擎",
    blurb: "插件接入、双阶段 Patch、冷启动 7 级显存账与三层图编译",
  },
  {
    id: "performance",
    title: "测量基准、核心调参、版本迁移、服务特性与排障手册",
    blurb: "核心 CLI 调参、v0.30.0 迁移、评测排障三大专道与在线服务特性",
  },
  {
    id: "cases",
    title: "旗舰异构模型端到端全案解剖",
    blurb: "GLM-5.3-Flash 双机 16 卡与 DeepSeek-V4.1-Flash 百万上下文全案",
  },
  {
    id: "references",
    title: "历史版本来源快照与开发档案",
    blurb: "历史基线快照、PR 档案、问答记录与尚待编排的新教学页",
  },
  { id: "rfork", title: "RFork 权重快载专题", blurb: "独立演进的权重快载实现：机制、术语与故障定位" },
  { id: "params", title: "additional_config 参数字典", blurb: "配置定义、默认值、约束线索与版本谱系" },
];

type CuratedSection = {
  title: string;
  track: "mainline" | "advanced";
  pages: string[];
};

/** 稳定页面 id 决定主位置，组内顺序按零倒挂学习依赖编排。 */
const CURATED: Partial<Record<TocPart<never>["id"], CuratedSection[]>> = {
  guide: [
    {
      title: "概念起步",
      track: "mainline",
      pages: ["learning-guide", "request-overview"],
    },
    {
      title: "新模型上线速查",
      track: "mainline",
      pages: ["hf-model-anatomy", "ascend-model-onboarding", "ascend-env-and-serve"],
    },
  ],
  models: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "token",
        "embedding",
        "matmul-and-weights",
        "mlp-residual-norm",
        "attention-qkv",
        "rope",
        "gqa",
        "layers-and-hidden",
        "lm-head",
      ],
    },
    {
      title: "同章进阶",
      track: "advanced",
      pages: ["moe", "multimodal-inference"],
    },
  ],
  inference: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "prefill",
        "kv-cache",
        "continuous-batching",
        "paged-attention",
        "block-table",
        "chunked-prefill",
        "sampling",
        "streaming-output",
        "request-teardown",
      ],
    },
    {
      title: "注意力缓存压缩与状态变体",
      track: "advanced",
      pages: ["mla", "sparse-attention", "linear-attention", "kv-cache-spec", "swa-bounded-replay"],
    },
    {
      title: "前缀复用与投机解码",
      track: "advanced",
      pages: ["prefix-caching", "speculative-decoding", "dspark"],
    },
    {
      title: "高阶采样、非自回归与单实例调度",
      track: "advanced",
      pages: [
        "sampling-advanced",
        "pooling-and-non-ar",
        "async-scheduling",
        "short-request-first",
        "batch-job-aware-scheduler",
      ],
    },
    {
      title: "本机 DRAM 卸载",
      track: "advanced",
      pages: ["kv-cache-cpu-offload"],
    },
  ],
  hardware: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "roofline-and-metrics",
        "hardware-devices",
        "device-memory",
        "ai-core",
        "ascend-flash-attention",
        "low-precision-formats",
        "quantization",
      ],
    },
    {
      title: "内存分形、950 硬件与注意力总账",
      track: "advanced",
      pages: [
        "tensor-layout",
        "ascend-950-architecture",
        "ascend-950-execution-interconnect",
        "ai-qos",
        "attention-cost",
      ],
    },
    {
      title: "量化深水区与混合 KV 量化",
      track: "advanced",
      pages: ["quantization-methods", "kv-cache-quantization", "quantization-evaluation"],
    },
  ],
  distributed: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "collective-communication",
        "cann-hccl",
        "tensor-parallel",
        "pipeline-parallel",
        "data-parallel",
        "expert-parallel",
      ],
    },
    {
      title: "高阶并行耦合链",
      track: "advanced",
      pages: [
        "sequence-parallel",
        "fine-grained-tp",
        "dynamic-chunked-pp",
        "moe-comm-dispatch",
        "large-scale-ep",
        "context-parallel",
        "kvpp",
        "hccl-buffer",
      ],
    },
    {
      title: "DP / EP 动态负载均衡",
      track: "advanced",
      pages: ["dp-request-routing", "balance-scheduling", "eplb"],
    },
  ],
  disaggregation: [
    {
      title: "主线支撑与专题簇",
      track: "mainline",
      pages: ["pd-disaggregation", "mooncake-connector"],
    },
    {
      title: "EPD、D 节点回退与外置缓存池",
      track: "advanced",
      pages: [
        "epd-disaggregation",
        "dyntra-lb",
        "recompute-scheduler",
        "recompute-cpu-offload",
        "kv-cache-layerwise-offload",
        "kv-cache-sparse-offload",
        "kv-pool",
        "lmcache",
        "ucm",
      ],
    },
  ],
  architecture: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "vllm-v1-shape",
        "engine-processes",
        "vllm-ascend-overview",
        "platform-plugin-registration",
        "ascend-patch-system",
        "ascend-config-system",
        "vllm-platform-interface",
        "npu-platform",
        "npu-worker-lifecycle",
        "kv-cache-memory-profiling",
        "request-call-chain",
        "prepare-inputs-flow",
        "npu-model-runner",
        "model-runner-v2",
        "ops-and-kernels",
        "op-to-ai-core",
        "attention-backend-family",
        "graph-mode-layer",
        "acl-graph",
        "npugraph-ex",
      ],
    },
    {
      title: "同章进阶",
      track: "advanced",
      pages: [
        "api-server-entry",
        "vllm-engine-core",
        "vllm-scheduler",
        "vllm-kv-block-allocation",
        "dev-new-model-and-custom-op",
        "vllm-ascend-repo-map",
        "reading-vllm-ascend",
      ],
    },
  ],
  performance: [
    {
      title: "主线走廊",
      track: "mainline",
      pages: [
        "core-cli-params",
        "v030-release-baseline",
        "inference-troubleshooting",
        "inference-benchmarking",
        "aisbench-and-evalscope",
        "inference-capacity-and-reliability",
        "inference-performance-analysis",
        "inference-performance-walkthrough",
        "inference-performance-troubleshooting",
        "inference-correctness-troubleshooting",
        "msprobe-accuracy-debug",
        "batch-invariance",
      ],
    },
    {
      title: "同章进阶",
      track: "advanced",
      pages: [
        "lora",
        "structured-output",
        "sleep-mode",
        "vllm-ascend-for-rl",
        "cpu-binding",
        "cluster-serving",
        "netloader-guide",
      ],
    },
  ],
  cases: [
    {
      title: "GLM-5.3-Flash 双机 16 卡全案",
      track: "mainline",
      pages: ["glm-5-3-flash", "glm-5-3-flash-two-node", "one-request", "concurrent-requests"],
    },
    {
      title: "DeepSeek-V4.1-Flash 百万上下文与跨代部署全案",
      track: "mainline",
      pages: ["engram-conditional-memory", "deepseek-v4-1-flash", "deepseek-serving-case"],
    },
  ],
  references: [
    {
      title: "历史版本与来源快照",
      track: "advanced",
      pages: [
        "v030rc2-baseline",
        "glm-5-3-flash-baseline",
        "ascend-config-version-source",
        "glm-mlp-version-source",
        "rfork-official-guide",
      ],
    },
    {
      title: "开发与问答档案",
      track: "advanced",
      pages: ["pr-11953", "answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad"],
    },
  ],
  params: [
    {
      title: "图编译、算子融合与精度还原",
      track: "advanced",
      pages: [
        "enable-super-kernel-ce990e186bfa",
        "fuse-allreduce-rms",
        "fused-op-type-fc0f5fcd7be0",
        "size-40a1c2ca47b8",
        "c8-enable-reshape-optim-8bd7e5f82c6c",
        "combine-quant-mode-2a3f7cd47997",
        "enable-matmul-allreduce",
        "enable-async-exponential",
        "block-table-no-commit-optimize-8328d0d2d00d",
        "sfa-dcp-force-tmajor-restore-6d9c266d3ece",
      ],
    },
    {
      title: "MoE 专家均衡（EPLB）与副本搜索",
      track: "advanced",
      pages: [
        "enable-force-eplb-b7ec3661121f",
        "stair-config-cca9e594a052",
        "load-window-bins-cc21068b082d",
        "load-risk-quantile-d89a080ba048",
        "relative-balance-threshold-bcbc40e7dc87",
        "absolute-balance-threshold-71578a0c428d",
        "rank-transfer-limit-99529b37d91d",
        "cross-node-transfer-limit-06ee92260b7a",
        "replica-search-beam-size-6556d1650a62",
        "replica-search-num-stages-e4b10925ff97",
        "replica-search-radius-cd3118b5aae5",
        "placement-search-backtrack-limit-82b03cef98b0",
      ],
    },
    {
      title: "通信重叠、权重二切/预取与分层传输",
      track: "advanced",
      pages: [
        "multistream-overlap-gate",
        "use-fused-overlap-75a180fff6ab",
        "weight-prefetch-config",
        "prefetch-ratio",
        "profiling-chunk-config",
        "kvpp-config-0445bd352140",
        "use-layerwise-b475778cd352",
        "enable-pcp-o-proj-weight-sharding-8528cf5af9c6",
        "enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9",
        "layer-sharding",
        "enable-sleep-mode-extra-cleanup",
      ],
    },
  ],
};

const SECTION_TRACK_BY_ID = new Map<string, "mainline" | "advanced">();
const curatedIds = new Set<string>();
for (const sections of Object.values(CURATED)) {
  for (const section of sections ?? []) {
    for (const id of section.pages) {
      curatedIds.add(id);
      if (!SECTION_TRACK_BY_ID.has(id)) SECTION_TRACK_BY_ID.set(id, section.track);
    }
  }
}

export const CURATED_PAGE_IDS: ReadonlySet<string> = curatedIds;

export function hasCuratedTocPlacement(id: string): boolean {
  return CURATED_PAGE_IDS.has(id);
}

export function pageTrack(id: string): ReadingTrack {
  if (CORE_26_SET.has(id)) return "core-26";
  return SECTION_TRACK_BY_ID.get(id) ?? "advanced";
}

const byOrder = <P extends TocPage>(a: P, b: P) =>
  a.order - b.order || pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), "zh");

export function isRforkTopicPage(p: Pick<TocPage, "id" | "type" | "origin">): boolean {
  if (p.id !== "rfork" && !p.id.startsWith("rfork-")) return false;
  if (p.type === "source" || p.type === "pr" || p.type === "param") return false;
  if (p.origin === "chat" || p.origin === "pr") return false;
  return true;
}

const DIGITS = "零一二三四五六七八九";
/** 目录第 n 组（从 1 数）的中文序号：一…十、十一…九十九；超出范围退回阿拉伯数字。 */
export function partNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return DIGITS.charAt(ones);
  return `${tens > 1 ? DIGITS.charAt(tens) : ""}十${ones > 0 ? DIGITS.charAt(ones) : ""}`;
}

export function buildToc<P extends TocPage>(pages: P[]): TocPart<P>[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const placed = new Set<string>();
  const take = (ids: string[]) =>
    ids.flatMap((id) => {
      const page = byId.get(id);
      if (!page || placed.has(id)) return [];
      placed.add(id);
      return [page];
    });
  const remaining = (matches: (p: P) => boolean) =>
    take(
      pages
        .filter((p) => !p.toc && matches(p))
        .sort(byOrder)
        .map((p) => p.id),
    );

  return PARTS.map((part): TocPart<P> => {
    const sections: TocSection<P>[] = (CURATED[part.id] ?? []).map((s) => ({
      title: s.title,
      track: s.track,
      pages: take(
        s.pages.filter((id) => {
          const explicit = byId.get(id)?.toc;
          return !explicit || (explicit.part === part.id && explicit.section === s.title);
        }),
      ),
    }));
    for (const page of pages.filter((p) => p.toc?.part === part.id).sort(byOrder)) {
      const title = page.toc!.section;
      const section = sections.find((s) => s.title === title);
      if (section) section.pages.push(...take([page.id]));
      else sections.push({ title, track: "advanced", pages: take([page.id]) });
    }
    if (part.id === "rfork") {
      sections.push({
        title: "工作版机制与维护",
        track: "advanced",
        pages: remaining(isRforkTopicPage),
      });
    } else if (part.id === "params") {
      sections.push({
        title: "其他参数（待归组）",
        track: "advanced",
        pages: remaining((p) => p.type === "param").sort((a, b) =>
          pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), "en"),
        ),
      });
    } else if (part.id === "references") {
      sections.push(
        { title: "问答记录", track: "advanced", pages: remaining((p) => p.origin === "chat") },
        {
          title: "PR 记录",
          track: "advanced",
          pages: remaining((p) => p.type === "pr" || p.origin === "pr"),
        },
        { title: "来源与版本依据", track: "advanced", pages: remaining((p) => p.type === "source") },
        {
          title: "新增教学页（待编排）",
          track: "advanced",
          pages: remaining((p) => !p.toc && !isRforkTopicPage(p) && p.type !== "param"),
        },
      );
    }
    return { ...part, sections: sections.filter((s) => s.pages.length > 0) };
  }).filter((part) => part.sections.length > 0);
}
