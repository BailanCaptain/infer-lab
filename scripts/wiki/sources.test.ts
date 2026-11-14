import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITABLE_DOMAINS, classifySource, handbookDomains, supportsOfficialEvidence } from "./sources";

describe("classifySource", () => {
  it("tlparse 仅登记已核读的固定 README", () => {
    const path = "meta-pytorch/tlparse/blob/98b8782b90f076f3d77a4a414316e3c8d0d127d4/README.md";
    expect(classifySource(`https://github.com/${path}`)).toBe("ecosystem");
    for (const ref of [
      `https://github.com/${path}.bak`,
      `https://github.com/${path.replace("README.md", "other.md")}`,
      `https://github.com/${path.replace("98b8782b90f076f3d77a4a414316e3c8d0d127d4", "main")}`,
      `https://github.com.evil.com/${path}`,
      "https://github.com/meta-pytorch/tlparse/issues/1",
    ])
      expect(classifySource(ref), ref).toBe("unlisted");
  });
  it("Mooncake 仅登记官方 Store 指南承接的固定仓库提交", () => {
    const root = "kvcache-ai/Mooncake/blob/4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/";
    expect(classifySource(`https://github.com/${root}docs/source/deployment/ssd/ssd-offload.md#L1-L61`)).toBe(
      "official",
    );
    expect(classifySource(`https://github.com/${root}mooncake-store/src/master.cpp#L234-L245`)).toBe(
      "official",
    );
    for (const path of [
      root.replace("4da33e5b44c28aec262dff63458c0bdb1c9bc8b0", "main"),
      root.replace(
        "4da33e5b44c28aec262dff63458c0bdb1c9bc8b0/",
        "4da33e5b44c28aec262dff63458c0bdb1c9bc8b0-copy/",
      ),
      root.replace("Mooncake/", "Mooncake-fork/"),
      root.replace("kvcache-ai/", "someone/"),
      "kvcache-ai/Mooncake/issues/",
    ])
      expect(classifySource(`https://github.com/${path}README.md`)).toBe("unlisted");
    expect(classifySource(`https://github.com.evil.com/${root}README.md`)).toBe("unlisted");
  });
  it("UCM 官方依赖只登记核读的固定仓库提交", () => {
    const root = "ModelEngine-Group/unified-cache-management/blob/4b9acbc8dede919ae17b14c3a23903e89623d5e8/";
    for (const file of [
      "ucm/integration/vllm/ucm_connector.py#L1-L20",
      "docs/docs-site/docs/en/developer-guide/request-lifecycle.md",
    ]) {
      expect(classifySource(`https://github.com/${root}${file}`)).toBe("official");
    }
    for (const path of [
      root.replace("4b9acbc8dede919ae17b14c3a23903e89623d5e8", "main"),
      root.replace(
        "4b9acbc8dede919ae17b14c3a23903e89623d5e8/",
        "4b9acbc8dede919ae17b14c3a23903e89623d5e8-copy/",
      ),
      root.replace("unified-cache-management/", "unified-cache-management-fork/"),
      root.replace("ModelEngine-Group/", "someone/"),
    ]) {
      expect(classifySource(`https://github.com/${path}README.md`)).toBe("unlisted");
    }
    expect(classifySource(`https://github.com.evil.com/${root}README.md`)).toBe("unlisted");
  });
  it("Z.ai 仅登记官方 KVPP 指南链接的已核读文章", () => {
    expect(classifySource("https://z.ai/blog/scaling-pain#layersplit")).toBe("official");
    for (const url of [
      "https://z.ai/blog/other",
      "https://z.ai/blog/scaling-pain-copy",
      "https://z.ai/blog/scaling-pain/other",
      "https://z.ai.evil.com/blog/scaling-pain",
    ]) {
      expect(classifySource(url), url).toBe("unlisted");
    }
  });
  it.each(["models/bpe/model.rs", "tokenizer/mod.rs", "tokenizer/added_vocabulary.rs"])(
    "Tokenizers 仅登记已核读提交的文件：%s",
    (file) => {
      const path = `huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/${file}`;
      const kind = classifySource(`https://github.com/${path}#L1-L10`);
      expect(kind).toBe("ecosystem");
      expect(supportsOfficialEvidence(kind)).toBe(false);
      for (const ref of [
        `https://github.com.evil.com/${path}`,
        `https://github.com/${path}.bak`,
        `https://github.com/${path.replace("afaae088837b277c19f90604a1111a272838857b", "main")}`,
        `https://github.com/${path.replace(file, "other.rs")}`,
        `https://github.com/${path.replace("huggingface/", "someone/")}`,
        `https://github.com/${path.replace("tokenizers/blob/", "tokenizers-fork/blob/")}`,
        "https://github.com/huggingface/tokenizers/issues/1",
      ])
        expect(classifySource(ref), ref).toBe("unlisted");
    },
  );
  it("op-plugin 官方算子文档仅放行已核读的固定文件", () => {
    const path =
      "Ascend/op-plugin/blob/aed3889c79923863fc9bfb36105cd6f577508cde/docs/zh/custom_APIs/torch_npu/torch_npu-npu_moe_distribute_combine_v2.md";
    expect(classifySource(`https://github.com/${path}#L257-L279`)).toBe("official");
    for (const ref of [
      `https://github.com.evil.com/${path}`,
      `https://github.com/${path}.bak`,
      `https://github.com/${path.replace("aed3889c79923863fc9bfb36105cd6f577508cde", "main")}`,
      `https://github.com/${path.replace("combine_v2.md", "dispatch_v2.md")}`,
      "https://github.com/Ascend/op-plugin/issues/1",
    ])
      expect(classifySource(ref), ref).toBe("unlisted");
  });
  it.each([
    "https://uvicorn.dev/settings/",
    ...CITABLE_DOMAINS.filter((entry) => entry.path && /^\/(pytorch|Ascend\/pytorch)\//.test(entry.path)).map(
      (entry) => `https://${entry.domain}${entry.path}`,
    ),
  ])("通信依赖仅放行登记的完整路径：%s", (ref) => {
    expect(classifySource(`${ref}#L155-L180`)).toBe("ecosystem");
    if (!ref.endsWith("/")) expect(classifySource(`${ref}.bak`)).toBe("unlisted");
    const url = new URL(ref);
    url.hostname += ".evil.com";
    expect(classifySource(url.href)).toBe("unlisted");
    url.hostname = new URL(ref).hostname;
    url.pathname = "/community/other";
    expect(classifySource(url.href)).toBe("unlisted");
  });
  it.each(["structural_tag.py", "compiler.py"])("XGrammar 仅登记已核读提交的文件：%s", (file) => {
    const path = `mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/${file}`;
    expect(classifySource(`https://github.com/${path}#L27-L39`)).toBe("ecosystem");
    for (const ref of [
      `https://github.com.evil.com/${path}`,
      `https://github.com/${path}.bak`,
      `https://github.com/${path.replace("5433fdbea7003eea61cb863768a05fb8da3bf919", "main")}`,
      `https://github.com/${path.replace(file, "other.py")}`,
      "https://github.com/mlc-ai/xgrammar/issues/1",
    ])
      expect(classifySource(ref), ref).toBe("unlisted");
  });
  it.each([
    "https://www.kernel.org/doc/html/v6.12/admin-guide/cgroup-v2.html",
    "https://docs.docker.com/engine/containers/resource_constraints/",
    "https://docs.docker.com/reference/cli/docker/container/ls/#filter-by-exit-signal",
    "https://docs.docker.com/reference/cli/docker/container/kill/",
    "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
    "https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/",
  ])("已核读的容器内存原始文档可引，伪装域名和社区路径不可引：%s", (ref) => {
    expect(classifySource(ref)).toBe("official");
    const spoofed = new URL(ref);
    spoofed.hostname += ".evil.com";
    expect(classifySource(spoofed.href)).toBe("unlisted");
    const outsideDocs = new URL(ref);
    outsideDocs.pathname = "/community/posts/1";
    expect(classifySource(outsideDocs.href)).toBe("unlisted");
  });
  it("950 白皮书只认已核对的完整文件路径，不信任整个 OBS 存储域", () => {
    const host = "public-download.obs.cn-east-2.myhuaweicloud.com";
    const path = "/ascend/昇腾950 NPU架构白皮书.pdf";
    for (const ref of [`https://${host}${path}`, `https://${host}${encodeURI(path)}#page=17`])
      expect(classifySource(ref)).toBe("official");
    for (const ref of [
      `https://${host}${path}.bak`,
      `https://${host}${path}/another.pdf`,
      `https://${host}/ascend/another.pdf`,
      `https://${host}/other/昇腾950 NPU架构白皮书.pdf`,
      `https://${host}.evil.com${path}`,
      `https://another-bucket.obs.cn-east-2.myhuaweicloud.com${path}`,
    ])
      expect(classifySource(ref), ref).toBe("unlisted");
  });
  it.each([
    "https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf",
    "https://docs.nvidia.com/deeplearning/transformer-engine-releases/release-2.8/user-guide/examples/fp8_primer.html",
    "https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html",
    "https://docs.nvidia.com/nemo/megatron-bridge/nightly/training/hierarchical-context-parallel.html",
    "https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/",
  ])("格式规范与厂商原始说明可作为官方来源：%s", (ref) => {
    expect(classifySource(ref)).toBe("official");
    const spoofed = new URL(ref);
    spoofed.hostname += ".evil.com";
    expect(classifySource(spoofed.href)).toBe("unlisted");
    const outsideDocs = new URL(ref);
    outsideDocs.pathname = "/community/posts/1";
    expect(classifySource(outsideDocs.href)).toBe("unlisted");
  });
  it.each([
    ["DeepInfer", "774ce244b87cc0eb8d4b94ab9f5de2ab22049f01"],
    ["deepseek-recipe", "935817c66f5d6e64838f419692545f06787e485f"],
  ])("%s 原仓属于生态一手，不放行讨论、其他仓库或伪装域名", (repo, commit) => {
    const path = `deepseek-ai/${repo}/blob/${commit}/README.md`;
    expect(classifySource(`https://github.com/${path}`)).toBe("ecosystem");
    for (const url of [
      `https://github.com.evil.com/${path}`,
      `https://github.com/${path.replace("deepseek-ai/", "someone/")}`,
      `https://github.com/${path.replace(`${repo}/`, `${repo}-fork/`)}`,
      `https://github.com/deepseek-ai/${repo}/issues/1`,
      `https://github.com/deepseek-ai/${repo}/pull/1`,
      `https://github.com/deepseek-ai/${repo}/discussions/1`,
      "https://github.com/deepseek-ai/other/blob/main/README.md",
    ])
      expect(classifySource(url), url).toBe("unlisted");
  });
  it.each([
    "IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/pyproject.toml",
    "IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/__init__.py",
    "IBM/terratorch/blob/83c3a928416fcf97deed924cfb99a59a817730bf/terratorch/vllm/plugins/segmentation/segmentation_io_processor.py",
    "prometheus/prometheus/blob/997549d4479dbc52382c83679dd998cd1c8eff27/docs/querying/functions.md",
    "prometheus/client_python/blob/e2f2bf9dcb49b8e8c0bc7fc089ff550edd9d286d/docs/content/multiprocess/_index.md",
    "prometheus/docs/blob/cc0672badce86173b9afaa95a59904576bcd6d6a/docs/practices/histograms.md",
    "snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/arctic_inference/suffix_decoding/cache.py",
    "snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/csrc/suffix_decoding/suffix_tree.cc",
    "intel/auto-round/blob/a85997e19d97762172155c93c4dfc3fcc3976e71/docs/step_by_step.md",
    "ModelCloud/GPTQModel/blob/be3852bf9871785f5fb8f01f359105590a5928b2/README.md",
    "mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/python/xgrammar/tokenizer_info.py",
    "mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info.cc",
    "mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/tokenizer_info_impl.h",
    "mlc-ai/xgrammar/blob/5433fdbea7003eea61cb863768a05fb8da3bf919/cpp/grammar_matcher.cc",
  ])("生态引用只接受已核读固定文件：%s", (path) => {
    const ref = `https://github.com/${path}`;
    expect(classifySource(`${ref}#L1-L10`)).toBe("ecosystem");
    expect(supportsOfficialEvidence(classifySource(ref))).toBe(false);
    for (const other of [
      `${ref}.bak`,
      `${ref}/other.md`,
      ref.replace(/\/blob\/[^/]+\//, "/blob/main/"),
      ref.replace(/\/[^/]+$/, "/unreviewed.md"),
      ref.replace("github.com", "github.com.evil.com"),
    ])
      expect(classifySource(other), other).toBe("unlisted");
  });
  it("Transformers 原仓源码是生态一手，不放行讨论、fork 或伪装域名", () => {
    const path =
      "huggingface/transformers/blob/5f4ecf2d9f867a1255131d2461d75793c0cf1db2/src/transformers/models/qwen3/modeling_qwen3.py";
    expect(classifySource(`https://github.com/${path}`)).toBe("ecosystem");
    for (const url of [
      `https://github.com.evil.com/${path}`,
      `https://github.com/${path.replace("huggingface/", "someone/")}`,
      `https://github.com/${path.replace("transformers/", "transformers-fork/")}`,
      "https://github.com/huggingface/transformers/issues/123",
      "https://github.com/huggingface/transformers/pull/123",
    ])
      expect(classifySource(url)).toBe("unlisted");
  });
  it.each(["README.md", "quant_qwen_moe_w8a8.py"])("ModelSlim 固定 Qwen3 配方精确到 %s", (file) => {
    const path = `Ascend/msmodelslim/blob/3b3f5151521f0b2a0c1f29937fc735ba4938db43/example/Qwen3-MOE/${file}`;
    expect(classifySource(`https://github.com/${path}#L1-L20`)).toBe("official");
    for (const url of [
      `https://github.com/${path}.bak`,
      `https://github.com/${path.replace(file, "other.py")}`,
      `https://github.com/${path.replace("3b3f5151521f0b2a0c1f29937fc735ba4938db43", "26.0.0")}`,
      `https://github.com/${path.replace("Ascend/", "someone/")}`,
      `https://github.com.evil.com/${path}`,
    ])
      expect(classifySource(url)).toBe("unlisted");
  });

  it("repo@commit:path 形式是仓库来源", () => {
    expect(classifySource("vllm-ascend@28bf3a2e:vllm_ascend/a.py#L1-L2")).toBe("repo");
  });

  it("一级官方：项目 README 自己列的那些", () => {
    for (const u of [
      "https://docs.vllm.ai/projects/ascend/en/v0.23.0/installation.html",
      "https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/910/x.html",
      "https://blog.vllm.ai/2025/05/12/hardware-plugin.html",
    ]) {
      expect(classifySource(u), u).toBe("official");
    }
  });

  it("community posts in official spaces do not acquire S merely through their domain", () => {
    for (const url of [
      "https://github.com/vllm-project/vllm-ascend/pull/11953",
      "https://github.com/vllm-project/vllm-ascend/issues/1#issuecomment-2",
      "https://discuss.vllm.ai/t/topic/1",
    ]) {
      expect(classifySource(url)).toBe("community");
      expect(supportsOfficialEvidence(classifySource(url))).toBe(false);
    }
  });

  it("昇腾在 gitee / gitcode 上的一手仓库也算官方，不是镜像", () => {
    // 源码里引了 33 次 gitee.com/ascend/*（ATB 算子库）与 43 次 gitcode 的
    // Ascend / cann 组织仓库（msmodelslim、ops-transformer），都是一手
    expect(classifySource("https://gitee.com/ascend/ascend-transformer-boost")).toBe("official");
    expect(classifySource("https://gitcode.com/Ascend/msmodelslim")).toBe("official");
    expect(classifySource("https://gitcode.com/cann/ops-transformer")).toBe("official");
  });

  it("同一站点的其它组织不算官方", () => {
    expect(classifySource("https://gitee.com/someone/fork")).toBe("unlisted");
    expect(classifySource("https://github.com/randomuser/whatever")).toBe("unlisted");
  });

  it("官方教程指定的 Ascend 镜像元数据可引，其他仓库及伪装域名不可引", () => {
    for (const path of ["api/v1/repository", "v2"]) {
      expect(classifySource(`https://quay.io/${path}/ascend/vllm-ascend/manifest/sha256:abc`)).toBe(
        "official",
      );
      for (const url of [
        `https://quay.io/${path}/someone/vllm-ascend/manifest/sha256:abc`,
        `https://quay.io/${path}/ascend/vllm-ascend-fork/manifest/sha256:abc`,
        `https://quay.io.evil.com/${path}/ascend/vllm-ascend/manifest/sha256:abc`,
      ]) {
        expect(classifySource(url), url).toBe("unlisted");
      }
    }
  });

  it("论文单独一档", () => {
    expect(classifySource("https://arxiv.org/abs/2309.06180")).toBe("paper");
  });

  it("生态一手：能引，但撑不起 S", () => {
    for (const u of [
      "https://pytorch.org/docs/stable/x.html",
      "https://docs.pytorch.org/docs/2.14/distributed.html",
      "https://triton-lang.org/main/x.html",
      "https://huggingface.co/Qwen/Qwen3-0.6B",
      "https://modelscope.cn/models/Qwen/Qwen3-0.6B",
      "https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8",
    ]) {
      expect(classifySource(u), u).toBe("ecosystem");
    }
  });

  it("NumPy 仅登记已核对的 legacy 页面，不能单独支持官方证据", () => {
    const kind = classifySource("https://numpy.org/doc/stable/reference/random/legacy.html");
    expect(kind).toBe("ecosystem");
    expect(supportsOfficialEvidence(kind)).toBe(false);
    for (const url of [
      "https://numpy.org/doc/stable/reference/random/other.html",
      "https://numpy.org/doc/stable/reference/random/legacy.html/extra",
      "https://numpy.org.evil.com/doc/stable/reference/random/legacy.html",
    ]) {
      expect(classifySource(url), url).toBe("unlisted");
    }
  });

  it("镜像站不可引——内容是别处的副本，要引就引原站", () => {
    for (const u of [
      "https://hf-mirror.com/Qwen/Qwen3-0.6B",
      "https://mirrors.tuna.tsinghua.edu.cn/x",
      "https://mirrors.huaweicloud.com/x",
    ]) {
      expect(classifySource(u), u).toBe("unlisted");
    }
  });

  it("AI 生成的二手知识库不可引", () => {
    // vllm-ascend 的 README 挂了 DeepWiki 徽章，但那是 AI 生成的，不是一手来源
    expect(classifySource("https://deepwiki.com/vllm-project/vllm-ascend")).toBe("unlisted");
  });

  it("博客平台与问答站不可引", () => {
    expect(classifySource("https://zhuanlan.zhihu.com/p/123")).toBe("unlisted");
    expect(classifySource("https://mp.weixin.qq.com/s/x")).toBe("unlisted");
  });

  it("只登记 DeepSeek 明确指向的文章和 Berkeley Lab 的 Roofline 页面", () => {
    const pages = [
      "https://zhuanlan.zhihu.com/p/2095560295930508953",
      "https://amcr.lbl.gov/departments/computer-science-department/ppan/roofline-performance-model/",
    ];
    for (const page of pages) {
      expect(classifySource(page), page).toBe("official");
      expect(classifySource(`${page}#reference`), page).toBe("official");
      const url = new URL(page);
      for (const pathname of ["/", `${url.pathname}extra`, `${url.pathname}.bak`, `${url.pathname}child/`]) {
        const other = new URL(page);
        other.pathname = pathname;
        expect(classifySource(other.href), other.href).toBe("unlisted");
      }
      url.hostname += ".evil.com";
      expect(classifySource(url.href), url.href).toBe("unlisted");
    }
    expect(classifySource("https://zhuanlan.zhihu.com/p/2095560295930508954")).toBe("unlisted");
    expect(classifySource("https://amcr.lbl.gov/departments/computer-science-department/ppan/other/")).toBe(
      "unlisted",
    );
  });

  it("子域名不能靠后缀蒙混过关", () => {
    expect(classifySource("https://docs.pytorch.org.evil.com/docs/2.14/distributed.html")).toBe("unlisted");
    expect(classifySource("https://arxiv.org.evil.com/abs/1")).toBe("unlisted");
    expect(classifySource("https://notdocs.vllm.ai/x")).toBe("unlisted");
  });
});

describe("HANDBOOK 与代码的白名单必须一致", () => {
  it("精确页面标记不会把以斜线结尾的页面扩大为目录", () => {
    expect(handbookDomains("| `amcr.lbl.gov/roofline/`（精确） | 已核对页面 | 官方 |")).toEqual([
      { domain: "amcr.lbl.gov", path: "/roofline/", kind: "official" },
    ]);
  });
  it("目录以斜线结尾；单文件条目按完整路径读取", () => {
    expect(handbookDomains("| `files.example/ascend/950.pdf` | 已核对文件 | 官方 |")).toEqual([
      { domain: "files.example", path: "/ascend/950.pdf", kind: "official" },
    ]);
  });
  it("解析 HANDBOOK 的域名表，逐条与代码常量相等", () => {
    // 白名单要被两方看到：agent 靠 HANDBOOK（会注入 prompt）知道能引什么，
    // lint 靠代码常量执行。两份手工同步迟早漂移，所以用这个测试锁住。
    const md = readFileSync(join(process.cwd(), "wiki/HANDBOOK.md"), "utf8");
    expect(handbookDomains(md)).toEqual(CITABLE_DOMAINS);
  });
});
