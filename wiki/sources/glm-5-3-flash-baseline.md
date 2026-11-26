---
id: glm-5-3-flash-baseline
title: GLM-5.3-Flash：模型配置与官方双机来源基线
type: source
origin: gap
summary: 固定 GLM 主线的模型配置、双机教程、控制流与执行侧提交，区分配置、源码推导、量化假设和镜像证据；最终安装产物与权重配套仍待核实，尚未实机部署。
aliases:
  - GLM-5.3-Flash
  - GLM5Next
  - GLM 双机基线
  - GLM 模型配置
chapters: []
order: 130
sources:
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    https://www.modelscope.cn/api/v1/models/Eco-Tech/GLM-5.3-Flash-w8a8/repo/files?Revision=9e55cbc8e2b19e20c63b08b916d2582f25a22504&Recursive=false
  - >-
    https://www.modelscope.cn/api/v1/models/Eco-Tech/GLM-5.3-Flash-w8a8/repo?Revision=9e55cbc8e2b19e20c63b08b916d2582f25a22504&FilePath=config.json
  - >-
    https://quay.io/api/v1/repository/ascend/vllm-ascend/manifest/sha256:d46b8603cff8adb8edc22dfbe4d3ff64f7a35f3692cf6d51e3444efc7b09ead6
  - >-
    https://quay.io/api/v1/repository/ascend/vllm-ascend/manifest/sha256:7fe19dc7631d5670110d50d122ff648e724cb7e5a3f128500854e1ffc0056a74
  - >-
    https://quay.io/v2/ascend/vllm-ascend/blobs/sha256:b13a5fd27f3eac79cda41e6c571d74080b1b71fd835a24657d4ce47a9fd024e3
  - >-
    https://quay.io/v2/ascend/vllm-ascend/blobs/sha256:40ef41925930b4378818ef80495eea345e689f43b4cfb0a4d41ba5d5abf6d56c
  - >-
    https://github.com/vllm-project/vllm-ascend/commit/db701c1fd31de40ab028628ee2580ae68c7fd3c0
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/Dockerfile.a2
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/db701c1fd31de40ab028628ee2580ae68c7fd3c0/glm-5-next-adapt-0826/glm-5-next-transformers.patch
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - 'vllm@0fc695fc:vllm/config/model.py#L1804-L1811'
  - 'vllm@0fc695fc:vllm/config/model.py#L1851-L1857'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2405'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L84-L96'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L814-L814'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L320-L320'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L511-L512'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L778-L781'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L75-L75'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L550-L554'
  - >-
    raw:sha256-cf3b17db3b295d7e328f31ba07fb4f38748d3c17f026e25700bc61650ffa683c.md#L1-L289
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L84-L122'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L810-L828'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L67-L67'
relations:
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 通信组、每卡权重和 KV 预算的推导统一由双机部署页提供
  - to: one-request
    kind: builds-on
    note: R1 的 4 token 示例、15 个块号与 MTP 闭环沿用单请求主线
  - to: glm-5-3-flash
    kind: builds-on
    note: 配置字段对应的模型结构、层形状和权重精度在模型页展开
  - to: vllm-ascend-overview
    kind: builds-on
    note: 官方专用镜像、上游框架与昇腾插件需要分别确定版本，不能由模型配置推断实现
  - to: speculative-decoding
    kind: builds-on
    note: 双机示例开启 MTP，草拟与验证的通用机制见投机解码页
  - to: hardware-devices
    kind: builds-on
    note: 设备数量与逻辑并行组需要分别核对，不能混用卡、设备和服务器的计数
verified: []
evidence: S
contradicts: []
updated: '2026-10-23'
rawSources:
  - >-
    raw/sha256-cf3b17db3b295d7e328f31ba07fb4f38748d3c17f026e25700bc61650ffa683c.md
---

## 这份基线能支持什么

本页固定 GLM 主线共用的来源与数字口径；配置及主线源码于 2026-09-28 复核，镜像与量化仓库元数据保留 2026-09-25 的核查记录。模型选择是 **GLM-5.3-Flash**，不是 GLM-5.3。模型卡将其描述为稀疏与线性混合注意力模型，使用 MoE 与 mHC；对外标称总参数 320B、激活参数 18B。这些宣传口径不代替具体权重、缓存或显存的计算。[S1]

2026-09-25 的核查完成模型配置对照、官方教程核读、远端仓库提交与容器元数据查询，并下载 arm64 镜像中的 Ascend 源码复制层作静态校验。没有下载权重或完整镜像，没有执行下载的代码或运行容器，也没有双机设备。因此本页不是“部署已跑通”的记录，`verified` 不填社区维护分支：这里只核对了下述材料，未逐条确认任何完整框架版本的实现。

后续页面统一使用以下四个钉点；教程、配置与两侧源码各自回答不同问题，不能只写一个“v0.23”代替它们。

| 对象 | 固定提交 | 引用边界 |
|---|---|---|
| 模型配置 | `690b705278a3a58e538fcb37c2ca8b5f9511213c` | 模型维度与配置字段；下文保留旧 revision 的一致性记录 |
| 官方双机教程 | `0576b6471c7a35707920a665352391d33c77451c` | 启动参数与硬件配方 |
| vLLM 控制流 | `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`（tag `v0.23.0`） | 调度、通信组、采样等主线参考实现，未证明镜像最终安装内容与之完全一致 |
| vllm-ascend 执行侧 | `db701c1fd31de40ab028628ee2580ae68c7fd3c0` | 已定位的 arm64 源码复制层；后续安装层仍待核 |

## 模型结构的固定依据

模型仓库：`zai-org/GLM-5.3-Flash`。本页配置与主线统一固定到 revision `690b705278a3a58e538fcb37c2ca8b5f9511213c`。以下值来自其 `config.json` 的 `text_config`，不套用到视觉编码器。[S2]

| 配置 | 值 | 对教学图的意义 |
|---|---|---|
| `architectures`（顶层） | `Glm5NextForConditionalGeneration` | 原模型包含多模态入口；主线先讲文本路径，不把文本图叫作完整多模态计算图 |
| `num_hidden_layers` | 45 | 主干按 45 层标注，不能沿用旧案例的 40 层 |
| `hidden_size`、`vocab_size` | 4096、154880 | 隐藏维度与词表维度分别标注，示意缩放不能改变含义 |
| `first_k_dense_replace`、`intermediate_size`、`moe_intermediate_size` | 3、12288、2048 | 前 3 层为 Dense FFN，主干第 3–44 层共 42 层 MoE；两种中间宽度分开使用 |
| `n_routed_experts`、`num_experts_per_tok`、`n_shared_experts` | 288、8、1 | 每个 MoE 层有 288 个可供选择的路由专家，每 token 选 8 个，另有所有 token 都经过的 1 个共享专家 |
| `mhc`、`hc_mult`、`hc_sinkhorn_iters` | true、4、20 | mHC 的四路残差状态与混合迭代数；不画成普通单路残差 |
| `layer_types` | 34 个 `linear_attention`，11 个 `deepseek_sparse_attention` | 这是按 45 个数组项统计的结果；0 起算的稀疏层是 3、7、…、43，最后第 44 层仍是线性注意力 [D] |
| `num_nextn_predict_layers` | 1 | MTP 层与 45 层主干区分；不由此推断每次请求必然执行投机解码 |
| `max_position_embeddings` | 1048576 | 配置位置上限不等于官方双机服务的实际运行长度 |

attention 的其余固定形状沿用[模型形状总表](../concepts/glm-5-3-flash.md#全模型形状总表)：KDA 为 64 头 × 128、短卷积核 4；MLA 为 64 头，Q/KV 低秩维度为 1536/512，非旋转 QK 维度及 V 维度均为 256，旋转维度为 0；索引器为 32 头 × 128，top-k 为 2048、压池比为 4。索引器的 2048 是选择上限，不是 KV 逻辑块大小。

旧版来源页固定到 `eb9eb208eb0d988989d07a6a12d0fdeb5f52574a`。[S13] 2026-09-25 曾将这两份 revision 的配置与 glm-flow 母版 `official-config.json` 比较，三者一致；2026-09-28 重新下载两份官方配置，解析后的完整 JSON 仍一致（比较忽略空白排版，保留键和值）。旧页的 `eb9eb208` 配置引用仍有效，新引用统一使用 `690b7052`；这只证明配置一致，不证明所有图形连接或运行时代码均已审计。

官方教程链接的量化仓库 `Eco-Tech/GLM-5.3-Flash-w8a8`，2026-09-25 查询时 master 指向 `9e55cbc8e2b19e20c63b08b916d2582f25a22504`。该树中 config 文件的最后变更 revision 是 `5865345c25abfbe36addb0b2478e1bb1c2d2f582`，其完整 `text_config` 与上述原模型一致。**文件最后变更提交不等于整个量化仓库提交**，下载与复现须固定整个仓库。[S4][S5]

配置比较和下述逐层精度描述核对都不包含权重字节校验；模型原权重与 W8A8 产物不能因配置相同就视为相同数值精度。

**W8A8 不是全模型所有张量都用 8 位。** 执行侧读取模型目录的 `quant_model_description.json`，按层选择量化方法，权重标成 `FLOAT` 的层走不量化实现。[C19]

已取得并核对量化仓库 `9e55cbc8` 与 `3121f187` 两个固定 revision 的逐层精度描述：MLP 两版均为 `W8A8_DYNAMIC`；12 个 MLA 层（含 MTP）的 `q_a`、`kv_a`、`q_b`、`o` 四组权重从旧版 `FLOAT` 改为新版 `W8A8_DYNAMIC`；KDA、KV 展开、索引器、router、视觉塔等仍有 `FLOAT` 项。`FLOAT` 只表示不走该量化方法，最终 BF16 或 FP32 等 dtype 仍须看配置与加载实现。这份精度描述不等于完整的离线量化校准配方，也不证明两版数值质量相同。固定原文、加载精度和容量范围统一见[权重精度](../concepts/glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)与[量化版本和视觉塔](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)；更换 revision 时应按同一口径更新字节账。

量化描述的加载入口见来源 29–30：已有描述时直接复用，否则定位并解析 `quant_model_description.json`。这些代码说明配置如何进入执行侧，不证明任意同名权重目录都和教程镜像配套。

## 双机示例与教学视图

完整的[双机教学解读](../concepts/glm-5-3-flash-two-node.md#部署前提)将命令映射到请求与通信组，并集中列出两端差异；其组构造采用上述固定提交的参考源码，不代表最终镜像已实测。

官方教程（来源 3）仍标 Experimental。本页固定的是教程文件提交 `0576b6471c7a35707920a665352391d33c77451c`，它是**文档提交，不是镜像内运行代码提交**。

按该教程 §5.2 正文及两端命令，固定拓扑为两台 Atlas 800 A2，每台可见设备 0–7；全局 DP=2、本地 DP=1、TP=8，并开启 EP，PP=1。不能改画成跨两机 TP16。节点 0/1 的 DP 起始 rank 分别是 0/1，节点 1 带 `--headless`。

这里的 **2 个 DP 执行组**负责两批请求；源码另构造 **8 个 DP 通信组**，成员分别为跨机同号卡 `{i, i+8}`。EP 组与 MC2 专用通信组各覆盖全部 16 个 rank，每卡每个 MoE 层持有 18 个路由专家；每台机器不是完整模型副本。具体组表与推导只引用[16 张卡怎样分组](../concepts/glm-5-3-flash-two-node.md#16-张卡怎样分组)。[C17][C18]

```wiki-diagram
file: glm-two-node-topology
```

教程 §3.1 写需要“2 Atlas 800 A2 (64GB × 16) nodes”，没有写“每节点”；这里的 16 是两台合计的卡数，即 2×8。§5.2 的 `64GB × 8` 按每台计数，与 A2 容器映射和每台 8 个可见设备一致。图据此表达“每机 8 个可见设备”，两处计数范围不同，不构成设备数量冲突。[S3]

图沿用部署页的容量口径：每卡约 20.58 GiB、其中 MTP 约 540.75 MiB，是 `3121f187` 量化配方下所列主要语言权重的静态子账；视觉塔、MTP 旋转矩阵和量化辅助张量等另计。教程写单卡 64 GB；主线容量算例按 64 GiB = 65,536 MiB 代入，不把 GB 与 GiB 当作相等，也不将算例当作设备可用显存测量。每卡权重与 KV 预算统一见[部署页](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)。

| 维度 | 官方双机实例 | 导读的处理方式 |
|---|---|---|
| 权重 | W8A8，启用 Ascend 量化 | 主线模型保持不变；数值精度和部署格式单独交代 |
| 投机 | `deepseek_mtp`，3 个推测 token，草稿路径 eager | 主线保留 MTP：R1 的 decode 主模型查询长度为 1 个已确定 token + 3 个候选 = 4；实际输出数取决于候选接受结果 |
| 图执行 | `FULL_DECODE_ONLY`；捕获尺寸 4/8/16/32/64/96/128 | `enforce_eager=true` 只在投机配置里作用于草稿侧；主模型仍捕获 decode 图，prefill 不走图 |
| 长度 | `max-model-len=133120` | 与模型配置的位置上限区分，不保证任何输入长度都可运行 |
| 调度与显存预算 | `max-num-batched-tokens=8192`、`max-num-seqs=32`、`gpu-memory-utilization=0.85` | 每个执行组的每步 token 预算、请求数上限与每卡显存预算比例 |
| 前缀缓存 | 命令未显式设置；固定控制流对 hybrid 模型默认关闭 | 相同前缀仍重算；这是源码基线结论，最终镜像行为仍待安装产物核对 |
| chunked prefill | 命令未显式设置；固定控制流默认开启 | 长提示词按每步 token 预算分段处理 |

以上显式参数来自教程；未显式设置的两个默认值已核对固定控制流，decode 查询长度已核对 runner。[C14][C15][C16][C20] 教程的 `deepseek_mtp` 在该版本会归一化为 `mtp`，不是另一个草拟方案。[C26]

R1 是提示词经模板和分词后为 4 token 的示例请求，prefill 的 4 行与 MTP decode 的 4 行含义不同；七站形状、15 个块号和通信账统一引用[单请求主线](../concepts/one-request.md#示例请求-r1-与官方双机部署)。普通自回归「一步一个 token」只作对比，不替代本部署主线。

教程未传 `--additional-config`。在未额外设置相关环境变量时，主线按以下默认分支阅读：`enable_reduce_sample=False`、`lmhead_tensor_parallel_size=0`（不启用独立词表投影 TP）、`enable_flashcomm1=0`，以及 `rejection_sampler_config` 下的 `enable_block_verify=False`、`enable_entropy_verify=False`。其中 SP 关闭的算例还要求调用方未通过共享专家条件开启 SP（覆盖规则见下段）；FlashComm1 也可由环境变量开启，因此这组默认值不覆盖用户另加的开关。[C21][C22][C23][C24][C25]

固定 `db701c1f` 的 `enable_sp()` 在初始化或刷新时，若 `_ENABLE_SP` 原为假而 `enable_shared_expert_dp` 为真，会将 `_ENABLE_SP` 置真（同上来源 25）。构造器的 `enable_shared_expert_dp` 默认为 `False`，只有配置显式开启、EP 开启且 TP > 1 才进该分支。因此按教程原样、无额外配置和环境开关时，不会因共享专家开启 SP；用户另开共享专家 DP 时，则不能只凭 `enable_flashcomm1=0` 判断 SP。这里描述固定源码条件，不是对容器实际运行状态的观测。[C28]

缓存数字统一引用[部署页的 KV 预算](../concepts/glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)：逻辑块 640 token，每个 block id 每卡占 8,355,840 B（约 7.969 MiB），共 5 个缓存组；带 KV 的 MLA 层共 12 层（主干 11 层 + MTP 1 层）。SFA kernel 块 128、indexer-state 块 4、KDA 组及调度对齐块 133120 各有用途，不可互换。

引用预算时需区分两套算例：假设完整权重占 21 GiB 的 3,855 块算例，与仅代入所列主要语言权重子账的 3,908 块算例（后者未扣视觉塔、MTP 旋转矩阵和量化辅助张量）。两者均非实测容量，推导留在链接处。

## 镜像固定与源码对应

教程 A2 镜像名是 `quay.io/ascend/vllm-ascend:glm-5.3-flash`。2026-09-25 查询标签时得到以下不可变标识：[S6][S7]

| 对象 | 固定标识 |
|---|---|
| 多架构镜像索引 | `sha256:d46b8603cff8adb8edc22dfbe4d3ff64f7a35f3692cf6d51e3444efc7b09ead6` |
| Linux arm64 子镜像 | `sha256:7fe19dc7631d5670110d50d122ff648e724cb7e5a3f128500854e1ffc0056a74` |
| Linux amd64 子镜像 | `sha256:5bff4b7b61b7b43fcf6ea636673799153d8ff3204c1a181115b153000853a822` |
| 已读取的 arm64 配置 blob | `sha256:b13a5fd27f3eac79cda41e6c571d74080b1b71fd835a24657d4ce47a9fd024e3` |

固定索引可以防止同名标签漂移；CPU 架构由实际服务器决定，不从 A2 名称推断。2026-09-25 进一步读取了 arm64 的 OCI 配置和构建历史，**没有检查 amd64 的构建内容**。

arm64 元数据记录 `VLLM_TAG=v0.23.0`，Transformers 基础提交为 `b830f5a04adf76cc9206d1d714a55e12df52fbb6`，随后应用 `glm-5-next-transformers.patch`。vllm-ascend 通过构建目录复制安装。构建历史与下述固定提交中的 `Dockerfile.a2` 对应，但基础 tag、文档 commit 和今天的 main 都不能直接等同于容器内最终代码。[S8][S11]

源码复制层共 116,342,438 B（约 111 MiB），层内 `.git/HEAD` 指向 `glm-5.3-flash-0902-1`，对应公开提交 `db701c1fd31de40ab028628ee2580ae68c7fd3c0`。其 Git tree 是 `264ac7c54ee6bd366ae74ffa1f3cf9bd76a40c88`。[S9][S10]

静态校验方法：先计算下载层的 SHA-256，再读层内 Git 元数据，用 `git ls-tree -r` 列出该提交的文件，并按 Git blob 规则逐个校验 tar 中对应文件的哈希。

校验结果为：**3063 个受跟踪 blob 全部存在且哈希一致，缺失或不同均为 0**。另有一个 `csrc/third_party/catlass` 子模块记录不作为普通文件计算 blob 哈希；排除 `.git` 元数据后，层内还有 889 个不属于主仓库 blob 清单的普通文件。这次校验不覆盖子模块内部一致性、第三方文件或后续安装层。[D]

| 对象 | 固定标识或核查结果 |
|---|---|
| Ascend 源码复制层 SHA-256 | `40ef41925930b4378818ef80495eea345e689f43b4cfb0a4d41ba5d5abf6d56c` |
| 复制层中的 Ascend 提交 | `db701c1fd31de40ab028628ee2580ae68c7fd3c0` |
| Transformers 补丁路径 | `glm-5-next-adapt-0826/glm-5-next-transformers.patch` |
| 补丁文件 SHA-256 | `526f261b80fcd38e732efc16f6cb7c27957cbd101eb52a4025bee95fea81c61d` |

补丁包含在上述受跟踪文件比较中，并可从固定提交读取。[S12] 这给模型实现及插件调用链提供了可追溯的源码起点。**复制层一致不等于最终安装产物一致**：后续安装层、上游 vLLM 实际检出内容及 amd64 构建内容仍未逐项检查。主线已按 `vllm@0fc695fc` 与 `vllm-ascend@db701c1f` 核对通信组、缓存默认值和调用链；将这些源码结论提升为镜像运行结论，仍需检查安装阶段改动与最终产物。

## 后续页面的引用边界

本页四个钉点构成知识库三级基线中的**显式例外 B**，专用于支撑 GLM 四篇旗舰案例（模型形状、双机部署、单请求、多请求）及配套冻结 3D 场景，不覆盖社区 `v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、全站默认主基线 [`v0.30.0` 正式版（`c09d3e20`）](../concepts/v030-release-baseline.md) 或最新 `main`（`8d6180e2`）的完整实现；RFork 10 篇专题则属**显式例外 A**，锚定上游 `vllm-ascend` `main`（`8d6180e2`）。各基线的职责分工另见[学习指南的版本差异](../concepts/learning-guide.md#版本差异)。

- 模型结构图可以引用本页固定的配置；图中细节仍需对应官方前向实现核对。glm-flow 的 3D/2D 规格是复用资产，不是高于官方来源的事实依据。
- 文本单请求沿官方 MTP 配置解释；3 个候选、主模型每步 4 行与实际接受数分别计数，主干 45 层与 MTP 第 45 层（0 起算）分开统计。
- 最新教学案例明确使用本页固定材料；旧版专题继续保留原已核对版本与差异。只因主模型更新，不能自动将旧页 `verified` 改为新版本。
- 可复现部署仍缺：最终安装产物及上游 vLLM 检出内容的核实、W8A8 的逐层量化配方与权重字节、权重版本与镜像的配套证据。设备数量已按教程的两机合计与每机口径说明，不列为部署缺口。Ascend 源码复制层与补丁已定位，但这不替代端到端部署验证。无设备情况下继续查公开材料；不编造启动日志、吞吐或性能曲线。
- 官方模型仓库的许可标签不自动覆盖量化产物、第三方图或本地母版文件。公开分发前逐项核对；本轮未复制第三方图片或权重。

旧专题的旧模型数字若尚未迁移，仍按其页面声明的模型与版本理解，不应视为本页 GLM 配置的另一种写法。
