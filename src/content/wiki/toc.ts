/**
 * 知识库目录的唯一编排处：按知识主题组织，课程 chapters 只保留课程关联。
 * 已编排页面优先；RFork/参数/记录按各自规则归位；新教学页显式等待编排。
 * 不用页型、生成来源或课程章号猜测知识主题，每页只出现一次。
 */
import type { z } from "zod";
import { pageDisplayTitle } from "./param-display";
import type { tocPlacementSchema } from "./schema";
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
  pages: P[];
}
export interface TocPart<P> {
  id:
    | "guide"
    | "models"
    | "inference"
    | "architecture"
    | "hardware"
    | "distributed"
    | "performance"
    | "serving"
    | "rfork"
    | "params"
    | "references";
  title: string;
  blurb: string;
  sections: TocSection<P>[];
}

const PARTS: Pick<TocPart<never>, "id" | "title" | "blurb">[] = [
  { id: "guide", title: "开始学习", blurb: "从模型与请求理解推理，再进入各知识主题" },
  { id: "models", title: "模型结构与计算", blurb: "张量、Decoder 层、注意力与专家结构" },
  { id: "inference", title: "推理过程", blurb: "Prefill、缓存、批处理与生成过程" },
  { id: "architecture", title: "vLLM 与 Ascend 架构", blurb: "组件职责、进程、输入输出与实现位置" },
  { id: "hardware", title: "Ascend 硬件与软件栈", blurb: "从设备与内存到计算、通信和互连" },
  { id: "distributed", title: "分布式推理与部署", blurb: "并行维度、通信与服务拓扑" },
  { id: "performance", title: "性能与工程优化", blurb: "容量规划、执行优化与数值一致性" },
  { id: "serving", title: "服务能力", blurb: "适配器、受约束的输出生成与 RL 权重更新" },
  { id: "rfork", title: "RFork 工作版", blurb: "独立演进的权重加载实现：机制、术语与故障定位" },
  { id: "params", title: "参数参考", blurb: "配置定义、默认值与版本谱系" },
  { id: "references", title: "来源与更新记录", blurb: "固定依据、PR、问答及尚待编排的新教学页" },
];

/** 稳定页面 id 决定主位置，组内顺序按学习依赖编排。 */
const CURATED: Partial<Record<TocPart<never>["id"], TocSection<string>[]>> = {
  guide: [{ title: "阅读路线", pages: ["learning-guide", "request-overview"] }],
  models: [
    { title: "输入表示与张量计算", pages: ["token", "embedding", "matmul-and-weights"] },
    { title: "数值表示与量化", pages: ["low-precision-formats", "quantization", "quantization-methods"] },
    {
      title: "Decoder 层、MoE 与 lm_head",
      pages: ["layers-and-hidden", "mlp-residual-norm", "moe", "lm-head"],
    },
    {
      title: "Attention 与位置编码",
      pages: [
        "attention-qkv",
        "rope",
        "gqa",
        "linear-attention",
        "sparse-attention",
        "mla",
        "attention-cost",
      ],
    },
  ],
  inference: [
    { title: "Prefill、Decode 与 KV cache", pages: ["prefill", "kv-cache", "kv-cache-spec"] },
    { title: "Block table 与 prefix caching", pages: ["block-table", "prefix-caching"] },
    { title: "Sampling 与返回", pages: ["sampling", "streaming-output", "request-teardown"] },
    { title: "Chunked prefill 与 speculative decoding", pages: ["chunked-prefill", "speculative-decoding"] },
    {
      title: "调度与执行重叠",
      pages: ["async-scheduling", "short-request-first", "batch-job-aware-scheduler"],
    },
    {
      title: "KV cache 量化与分层存储",
      pages: [
        "kv-cache-quantization",
        "kv-cache-cpu-offload",
        "kv-cache-sparse-offload",
        "recompute-cpu-offload",
        "recompute-scheduler",
      ],
    },
    { title: "外部 KV cache 与 connector", pages: ["kv-pool", "lmcache", "ucm"] },
  ],
  architecture: [
    {
      title: "组件、职责与进程",
      pages: [
        "vllm-v1-shape",
        "vllm-ascend-overview",
        "engine-processes",
        "api-server-entry",
        "request-call-chain",
      ],
    },
    {
      title: "启动与平台适配",
      pages: [
        "platform-plugin-registration",
        "vllm-platform-interface",
        "npu-platform",
        "ascend-config-system",
        "ascend-patch-system",
        "npu-worker-lifecycle",
        "kv-cache-memory-profiling",
      ],
    },
    {
      title: "EngineCore、Scheduler 与 KV block 分配",
      pages: ["vllm-engine-core", "vllm-scheduler", "vllm-kv-block-allocation"],
    },
    {
      title: "Model runner 与 attention backend",
      pages: [
        "prepare-inputs-flow",
        "npu-model-runner",
        "attention-backend-family",
        "ops-and-kernels",
        "op-to-ai-core",
      ],
    },
    { title: "源码阅读", pages: ["vllm-ascend-repo-map", "reading-vllm-ascend"] },
  ],
  hardware: [
    { title: "设备、内存与计算单元", pages: ["hardware-devices", "device-memory", "ai-core"] },
    { title: "软件栈与互连", pages: ["cann-hccl", "ai-qos"] },
  ],
  distributed: [
    { title: "集合通信与 HCCL", pages: ["collective-communication", "gap-a5164fe10fa9184412f8"] },
    {
      title: "并行维度",
      pages: [
        "tensor-parallel",
        "data-parallel",
        "expert-parallel",
        "pipeline-parallel",
        "sequence-parallel",
        "context-parallel",
      ],
    },
    { title: "并行策略进阶", pages: ["fine-grained-tp", "dynamic-chunked-pp", "large-scale-ep", "kvpp"] },
    {
      title: "DP 组分流与 expert 负载",
      pages: ["dp-request-routing", "balance-scheduling", "eplb", "dyntra-lb"],
    },
    {
      title: "贯穿案例",
      pages: ["glm-5-3-flash", "glm-5-3-flash-two-node", "one-request", "concurrent-requests"],
    },
    {
      title: "PD 分离与 KV 传输",
      pages: ["pd-disaggregation", "mooncake-connector", "kv-cache-layerwise-offload"],
    },
  ],
  performance: [
    { title: "启动与权重加载", pages: ["netloader-guide", "sleep-mode"] },
    {
      title: "Graph mode 与主机资源",
      pages: ["graph-mode-layer", "acl-graph", "npugraph-ex", "cpu-binding"],
    },
    { title: "数值一致性", pages: ["batch-invariance"] },
  ],
  serving: [
    { title: "LoRA 与 structured output", pages: ["lora", "structured-output"] },
    { title: "RL 与权重更新", pages: ["vllm-ascend-for-rl"] },
  ],
};

const byOrder = <P extends TocPage>(a: P, b: P) =>
  a.order - b.order || pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), "zh");

function isRforkTopicPage(p: Pick<TocPage, "id" | "type" | "origin">): boolean {
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
    const sections = (CURATED[part.id] ?? []).map((s) => ({
      title: s.title,
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
      else sections.push({ title, pages: take([page.id]) });
    }
    if (part.id === "rfork") {
      sections.push({
        title: "工作版机制与维护",
        pages: remaining(isRforkTopicPage),
      });
    } else if (part.id === "params") {
      sections.push({
        title: "配置与版本",
        pages: remaining((p) => p.type === "param").sort((a, b) =>
          pageDisplayTitle(a).localeCompare(pageDisplayTitle(b), "en"),
        ),
      });
    } else if (part.id === "references") {
      sections.push(
        { title: "问答记录", pages: remaining((p) => p.origin === "chat") },
        { title: "PR 记录", pages: remaining((p) => p.type === "pr" || p.origin === "pr") },
        { title: "来源与版本依据", pages: remaining((p) => p.type === "source") },
        { title: "新增教学页（待编排）", pages: remaining((p) => !p.toc) },
      );
    }
    return { ...part, sections: sections.filter((s) => s.pages.length > 0) };
  }).filter((part) => part.sections.length > 0);
}
