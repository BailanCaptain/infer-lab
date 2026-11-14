/**
 * 可引来源的分级白名单。
 *
 * 「能读什么」与「能引什么」是两回事：读得广理解才准，所以 agent 的联网不设限；
 * 而引用是「你可以去核对」的承诺，必须限。此前把限制加在「能读」上是错的——
 * 既挡住了昇腾官方文档，又没解决真问题。
 *
 * 分级依据（2026-09-11 调研，三路取证）：
 *   1. 项目 README 导航栏自列的官方资源（`README.md:19`）
 *   2. 官方文档的外链统计：github 2902、docs.vllm.ai 209、modelscope 97、
 *      huggingface 31、gitcode 30、hiascend 25、modelers 11
 *   3. 源码注释的外链：gitee 33（全是 `ascend/*`）、gitcode 13（`Ascend|cann/*`）
 *
 * 关键发现：`gitee.com/ascend/*` 与 `gitcode.com/Ascend|cann/*` **不是镜像站**，
 * 是昇腾自己的一手仓库（ATB 算子库、msmodelslim、ops-transformer）。
 *
 * 这份表与 `wiki/HANDBOOK.md`「可引来源」一节必须逐条一致，有测试锁住。
 */

import { parseRawRef, parseRepoRef } from "../../src/content/wiki/schema";

export type SourceKind = "repo" | "raw" | "official" | "paper" | "ecosystem" | "community" | "unlisted";

export interface CitableDomain {
  domain: string;
  /** 限定组织时给出路径前缀，如 github.com 只认 vllm-project */
  prefix?: string;
  /** 单份已核实文件或页面的完整明文路径，不信任同目录的其他对象 */
  path?: string;
  kind: Exclude<SourceKind, "repo" | "raw" | "unlisted">;
}

export const CITABLE_DOMAINS: CitableDomain[] = [
  { domain: "zhuanlan.zhihu.com", path: "/p/2095560295930508953", kind: "official" },
  { domain: "z.ai", path: "/blog/scaling-pain", kind: "official" },
  {
    domain: "github.com",
    prefix: "/ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/",
    kind: "official",
  },
  {
    domain: "github.com",
    prefix: "/kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/",
    kind: "official",
  },
  {
    domain: "amcr.lbl.gov",
    path: "/departments/computer-science-department/ppan/roofline-performance-model/",
    kind: "official",
  },
  {
    domain: "www.kernel.org",
    path: "/doc/html/v6.12/admin-guide/cgroup-v2.html",
    kind: "official",
  },
  { domain: "docs.docker.com", prefix: "/engine/containers/resource_constraints/", kind: "official" },
  { domain: "docs.docker.com", prefix: "/reference/cli/docker/container/ls/", kind: "official" },
  { domain: "docs.docker.com", prefix: "/reference/cli/docker/container/kill/", kind: "official" },
  {
    domain: "kubernetes.io",
    prefix: "/docs/concepts/configuration/manage-resources-containers/",
    kind: "official",
  },
  {
    domain: "kubernetes.io",
    prefix: "/docs/tasks/configure-pod-container/assign-memory-resource/",
    kind: "official",
  },
  { domain: "docs.vllm.ai", kind: "official" },
  { domain: "www.hiascend.com", kind: "official" },
  { domain: "e.huawei.com", kind: "official" },
  {
    domain: "public-download.obs.cn-east-2.myhuaweicloud.com",
    path: "/ascend/昇腾950 NPU架构白皮书.pdf",
    kind: "official",
  },
  { domain: "www.opencompute.org", prefix: "/documents/", kind: "official" },
  { domain: "docs.nvidia.com", prefix: "/deeplearning/", kind: "official" },
  { domain: "docs.nvidia.com", prefix: "/megatron-core/", kind: "official" },
  { domain: "docs.nvidia.com", prefix: "/nemo/megatron-bridge/", kind: "official" },
  { domain: "developer.nvidia.com", prefix: "/blog/", kind: "official" },
  { domain: "blog.vllm.ai", kind: "official" },
  { domain: "discuss.vllm.ai", kind: "community" },
  { domain: "github.com", prefix: "/vllm-project/", kind: "official" },
  {
    domain: "github.com",
    path: "/Ascend/op-plugin/blob/aed3889c79923863fc9bfb36105cd6f577508cde/docs/zh/custom_APIs/torch_npu/torch_npu-npu_moe_distribute_combine_v2.md",
    kind: "official",
  },
  {
    domain: "github.com",
    path: "/Ascend/msmodelslim/blob/3b3f5151521f0b2a0c1f29937fc735ba4938db43/example/Qwen3-MOE/README.md",
    kind: "official",
  },
  {
    domain: "github.com",
    path: "/Ascend/msmodelslim/blob/3b3f5151521f0b2a0c1f29937fc735ba4938db43/example/Qwen3-MOE/quant_qwen_moe_w8a8.py",
    kind: "official",
  },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/structural_tag.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/compiler.py",
    kind: "ecosystem",
  },
  { domain: "github.com", prefix: "/huggingface/transformers/blob/", kind: "ecosystem" },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/tokenizer_info.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info.cc",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info_impl.h",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/arctic_inference/suffix_decoding/cache.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/csrc/suffix_decoding/suffix_tree.cc",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/intel/auto-round/blob/a85997e19d97762172155c93c4dfc3fcc3976e71/docs/step_by_step.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/ModelCloud/GPTQModel/blob/be3852bf9871785f5fb8f01f359105590a5928b2/README.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/pyproject.toml",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/__init__.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/segmentation_io_processor.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/prometheus/prometheus/blob/997549d4479dbc52382c83679dd998cd1c8eff27/docs/querying/functions.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/prometheus/client_python/blob/e2f2bf9dcb49b8e8c0bc7fc089ff550edd9d286d/docs/content/multiprocess/_index.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/prometheus/docs/blob/cc0672badce86173b9afaa95a59904576bcd6d6a/docs/practices/histograms.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/meta-pytorch/tlparse/blob/98b8782b90f076f3d77a4a414316e3c8d0d127d4/README.md",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/bpe/model.rs",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/mod.rs",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/added_vocabulary.rs",
    kind: "ecosystem",
  },
  { domain: "github.com", prefix: "/deepseek-ai/DeepInfer/blob/", kind: "ecosystem" },
  { domain: "github.com", prefix: "/deepseek-ai/deepseek-recipe/blob/", kind: "ecosystem" },
  { domain: "gitee.com", prefix: "/ascend/", kind: "official" },
  { domain: "gitcode.com", prefix: "/Ascend/", kind: "official" },
  { domain: "gitcode.com", prefix: "/cann/", kind: "official" },
  { domain: "quay.io", prefix: "/api/v1/repository/ascend/vllm-ascend/", kind: "official" },
  { domain: "quay.io", prefix: "/v2/ascend/vllm-ascend/", kind: "official" },
  { domain: "arxiv.org", kind: "paper" },
  { domain: "pytorch.org", kind: "ecosystem" },
  { domain: "docs.pytorch.org", kind: "ecosystem" },
  { domain: "uvicorn.dev", prefix: "/settings/", kind: "ecosystem" },
  {
    domain: "github.com",
    path: "/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.h",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUAllocatorConfig.cpp",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/core/npu/NPUCachingAllocator.cpp",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/c10d/ProcessGroupGloo.cpp",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/pytorch/pytorch/blob/449b1768410104d3ed79d3bcfe4ba1d65c7f22c0/torch/csrc/distributed/rpc/tensorpipe_agent.cpp",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/csrc/distributed/rpc/tensorpipe_agent.cpp",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/Ascend/pytorch/blob/8751b36d5d6959e499e6bf6530c1928060ced030/torch_npu/distributed/rpc/backend_registry.py",
    kind: "ecosystem",
  },
  {
    domain: "github.com",
    path: "/pytorch/gloo/blob/54cbae0d3a67fa890b4c3d9ee162b7860315e341/gloo/transport/tcp/device.cc",
    kind: "ecosystem",
  },
  { domain: "numpy.org", path: "/doc/stable/reference/random/legacy.html", kind: "ecosystem" },
  { domain: "triton-lang.org", kind: "ecosystem" },
  { domain: "huggingface.co", kind: "ecosystem" },
  { domain: "modelscope.cn", kind: "ecosystem" },
  { domain: "www.modelscope.cn", kind: "ecosystem" },
  { domain: "modelers.cn", kind: "ecosystem" },
];

/** 把一条 `sources` 归类。仓库引用与三档 URL 之外一律 `unlisted`。 */
export function classifySource(ref: string): SourceKind {
  if (parseRawRef(ref)) return "raw";
  if (parseRepoRef(ref)) return "repo";
  if (!/^https?:\/\//i.test(ref)) return "unlisted";
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return "unlisted";
  }
  // 用 host 全等而不是后缀匹配：`arxiv.org.evil.com` 不能蒙混过关
  const host = url.hostname.toLowerCase();
  if (
    host === "github.com" &&
    /^\/vllm-project\/[^/]+\/(?:issues|pull|discussions)(?:\/|$)/.test(url.pathname)
  )
    return "community";
  for (const d of CITABLE_DOMAINS) {
    if (host !== d.domain) continue;
    if (d.path && url.pathname !== encodeURI(d.path)) continue;
    if (d.prefix && !url.pathname.startsWith(d.prefix)) continue;
    return d.kind;
  }
  return "unlisted";
}

/** `evidence: S` 需要一手来源撑着；生态站（PyTorch、HF 等）撑不起。 */
export function supportsOfficialEvidence(kind: SourceKind): boolean {
  return kind === "official" || kind === "paper";
}

const ROW_RE = /^\|\s*`([^`]+)`\s*(（精确）)?\s*\|\s*([^|]*?)\s*\|\s*(官方|论文|生态|社区)\s*\|/;

/**
 * 从 HANDBOOK 的「可引来源」表里解析域名清单，用于与代码常量比对。
 * 表格形状：`| \`域名[路径]\`（精确） | 说明 | 官方/论文/生态 |`。
 * 无标记时目录以 / 结尾、文件精确匹配；（精确）使末尾带 / 的页面也只匹配自身。
 */
export function handbookDomains(markdown: string): CitableDomain[] {
  const kindOf: Record<string, CitableDomain["kind"]> = {
    官方: "official",
    论文: "paper",
    生态: "ecosystem",
    社区: "community",
  };
  const out: CitableDomain[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;
    const [, spec, exact, , kindText] = m;
    const kind = kindOf[kindText ?? ""];
    if (!spec || !kind) continue;
    const slash = spec.indexOf("/");
    if (slash < 0) out.push({ domain: spec, kind });
    else {
      const path = spec.slice(slash);
      out.push({
        domain: spec.slice(0, slash),
        ...(!exact && path.endsWith("/") ? { prefix: path } : { path }),
        kind,
      });
    }
  }
  return out;
}
