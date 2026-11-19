---
id: attention-backend-family
title: 注意力后端：模型机制、状态布局与设备实现的连接
type: concept
summary: >-
  注意力后端是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定用哪份状态、按什么形状组织这批 token、最后调哪个算子。GLM
  的一次前向同时走 KDA 和稀疏 MLA 两条分支，不存在"这个模型的后端"。
aliases:
  - attention backend
  - 注意力后端
  - AttentionBackend
  - metadata builder
  - IndexerKPoolMLA
  - Kimi KDA
  - AscendGDNAttentionBackend
  - AscendIndexerKPoolMLABackend
  - attention group
  - 注意力组
  - AscendFAImpl
  - flash_attn_npu_v3
  - flash_attn_npu
  - flash_attn_with_kvcache
  - _validate_fa3_backend
  - 训推一致
  - 训练推理一致
  - enable_training_consistency
chapters:
  - 09
  - '16'
order: 50
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L216-L227'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L181-L196'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L310'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L312-L368'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2049'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L232-L243'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L475'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5039-L5063'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5065-L5083'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L833-L858'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L12-L60'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L62-L97'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L99-L145'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L868'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L816-L869'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L679-L732'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L240-L281'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1357-L1383'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L266-L267'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kv_cache.py#L119-L178'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L301-L327'
  - 'vllm@0fc695fc:vllm/v1/attention/selector.py#L54-L110'
  - 'vllm@0fc695fc:vllm/config/attention.py#L14-L22'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L8-L43
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L45-L73
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L134-L156
  - 'https://arxiv.org/abs/2205.14135'
  - 'https://arxiv.org/abs/2407.08608'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L45'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L82'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L136-L137'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L738
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L246-L288'
  - >-
    vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/context_parallel.md#L26-L41
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L437-L476'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/kda.py#L108-L133'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/developer_guide/Design_Documents/context_parallel.md#L26-L41
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/mla.py#L189-L218'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L842-L873'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L98-L127'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L285-L327'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/mla.py#L39-L70'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/mla.py#L205-L242'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/mla_v1.py#L127-L138'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L868-L898'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1475-L1500'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/mla_attention.py#L488-L503'
  - 'vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L378-L393'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L857-L1063'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L36-L36'
  - 'vllm-ascend@db701c1f:tests/ut/models/test_glm5_next_indexer_kpool_mla.py#L1650-L1680'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/kimi_kda.py#L170-L180'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L607-L636'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L529-L559'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L247-L290'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1484-L1510'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L11-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L920-L1115'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L275-L374'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1793-L1953'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/fa3_v1.py#L11-L66'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L982-L1195'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 后端要实现已经定义的注意力计算和因果约束
  - to: ascend-flash-attention
    kind: builds-on
    note: 密集 MHA/GQA 下 FA、FIA、PA 与 FA3 算子族的片上 Tiling 与执行选路在那页展开
  - to: mla
    kind: builds-on
    note: 理解压缩历史、索引和尾状态，才能解释对应后端输入
  - to: linear-attention
    kind: builds-on
    note: KDA 的递推与卷积状态需要不同于位置 K/V 页的访问方式
  - to: sparse-attention
    kind: builds-on
    note: 每个查询最多 2051 个位置的推导在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 分组用的缓存规格就是那一页讲的 spec
  - to: glm-5-3-flash-baseline
    kind: builds-on
    note: GLM 后端实现的版本口径依赖来源基线定位的源码复制层；源码结论能否代表最终镜像运行行为，仍受安装产物核查边界限制。
  - to: rope
    kind: builds-on
    note: 稀疏 MLA 后端的缓存视图与维度检查依赖潜向量和 RoPE 段的布局约定；GLM 固定配置的 RoPE 段宽度为 0。
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-09edf6e76e4698e7dc9a9f1c5517fe527f3e05c8ca2e288d8ca828bd8072249d.md
  - >-
    raw/sha256-850b6caa1d5a8526fd441a2cebd55b2c9e0ad849fb3c3b07fde7b0cc941b8361.md
---

## 这一层的注意力，最后是谁在算？

**注意力后端（attention backend）是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定它用哪份状态、按什么形状组织这一批 token、最后调哪个算子。**

```wiki-diagram
file: attention-backend-choice
```

后端是**按层**挂的：每一层报出自己的后端类，同一次前向里不同的层可以报出不同的类。GLM 的一次前向就同时走两条分支——**KDA**（Kimi Delta Attention，一种线性注意力：把历史汇入固定形状的递推状态，不逐位置保留全部 K/V）的层走一条，**稀疏 MLA**（Multi-head Latent Attention 的稀疏版：历史压成潜向量按位置存，每个查询只挑其中一部分读）的层走另一条，谁也不经过对方的算子。

## 为什么要专门分出这一层，代价是什么

分出这一层，是因为它要同时吃下两种差异。

**一是硬件的差异。**同一个数学机制，在不同设备上是不同的算子。设备实现必须原样保留计算语义、因果关系和请求之间的隔离，只换执行方式——所以后端不是一个"速度选项"，它决定结果对不对，不只是快不快。

**二是层与层之间的差异。**[密集注意力](attention-qkv.md)描述打分、归一化与 V 汇合，[稀疏注意力](sparse-attention.md)在此之上限定能访问哪些位置，[KDA](linear-attention.md)改用递推状态。三者连历史怎样保存都不一样，状态布局自然也对不上：稀疏 MLA 按位置存压缩历史和索引，KDA 每份递推状态的矩阵和卷积状态大小固定；运行器还可按缓存策略与投机验证需求保留多份状态，不能把单份状态大小直接当成总分配量。

代价有两条。

**后端不能当插件随便换。**一个候选后端要同时对上五件事：这一层的机制、状态布局、dtype、head 形状、并行约束。满足某一个模型或某一种设备的条件，不等于 GLM 全部层都能用；性能比较也只有在语义和功能一致的前提下才有意义。

**每多一种后端，调度侧就多一份元数据。**后端需要的不只是 Q/K/V 张量，还有缓存布局、请求边界、有效长度和位置索引。模型每引入一种新机制，Runner 就要为它多建一套元数据构建器，多维护一种形状约定。

## 放到 GLM 双机：一个 token 走过 45 层，要问 45 次

部署前提见 [GLM 5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)。本页沿用[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)：第一步是 1 条请求、4 个 token（教学设定）；R1 所在 DP 组的那 8 张卡拿到同样的 4 个 token，差别只在权重分片，每卡 KDA 8 个头、稀疏 MLA 8 个头，这些数都在那一页推导。

主干是第 0–44 层，共 45 层：34 层是 KDA，11 层是稀疏 MLA（第 3、7、11 … 43 层）；编号 45 的 **MTP**（Multi-Token Prediction，多 token 预测用的草稿层）也是稀疏 MLA。层类型在装配时就定死了：装配代码按配置里的层类型表挑分支，挑中哪条，这一层构造的对象和它报出的后端就跟着定了。

固定 GLM 实现的层类型判断有优先顺序：配置对象提供专用判断方法时先用它的结果；否则，KDA 层编号列表非空时检查当前层是否在列表中；再否则才检查逐层类型表。因此，空的 KDA 层列表会继续后续判断，不能单独据此认定模型没有 KDA 层。

| 这一层是 | 层里构造的对象 | 报出的后端 | 最后落到的算子 |
|---|---|---|---|
| KDA，34 层 | 上游的 KimiGatedDeltaNetAttention，运行时被换成昇腾实现 | AscendGDNAttentionBackend | prefill 走短卷积 + 门控前缀和 + 分块 KDA；decode 走逐 token 更新递推状态 |
| 稀疏 MLA，11 层 + 编号 45 的 MTP 层 | AscendIndexerKPoolMLAAttention，它内部再建一个缓存层对象，后端由这个缓存层报出 | AscendIndexerKPoolMLABackend | 稀疏 flash attention：只在选中的位置上读潜向量、打分、汇合 |

表里的几个名字先解释一下。**GDN** 是 Gated DeltaNet，一类带遗忘门的线性注意力；KDA 是它的变体，昇腾的 KDA 实现沿用了 GDN 这个后端接口名，所以 KDA 层报出的是 GDN 后端。**indexer** 是稀疏 MLA 里专门为当前查询挑历史位置的小模块，**KPool** 是它把相邻几个位置合成一个"池"再打分的做法，两者的算法见[稀疏注意力](sparse-attention.md)。

两条分支在同一个 token 上的开销完全不同。

稀疏 MLA 这边，每个查询最多读 2051 个位置（2048 个选中位置加 0–3 个尾部位置，推导见[稀疏注意力](sparse-attention.md)）。按这个上界，一层一卡的 QK 与 PV 合计约 **33.6 MFLOP / token**，主干 11 层约 **370 MFLOP / token**；这是不含 softmax、投影和 kernel 补齐的静态上界。

KDA 这边不逐位置重读全部历史：一次递推读写每个头的矩阵状态与卷积状态，单份状态大小不随历史变长。主干 34 层采用这种机制，减少了逐位置历史存储和访问；为缓存与回退保留的状态份数另计。这有助于长上下文处理，具体内存和执行代价见 [KDA 线性注意力](linear-attention.md)，不能单凭层数推出某个长度必然可部署。

### Runner 怎样把层归拢成组

后端不是逐层各算各的。Runner 在初始化时遍历每个缓存组里的层，调用每一层的后端查询方法，再用「后端的完整类名 + 这一层的缓存规格」当键把层分组，每组建一个元数据构建器。键相同的层共享同一次元数据构建，机制不同的层自然落进不同的组。

| Runner 给的输入 | 后端据此确定什么 |
|---|---|
| 查询边界、有效 token 数 | 哪些行属于同一条请求，哪些是有效输入 |
| 已计算长度与当前位置 | 可访问的因果历史，以及本轮写到哪里 |
| 块表或状态索引 | 从哪读取、向哪写入状态 |
| 层与缓存规格 | 元数据格式、张量形状与访问方式 |
| 并行与执行模式 | 本地分片、通信及相应的支持条件 |

这张表说的是接口职责，不代表所有后端都用同名字段或同一种布局。分组键里的"缓存规格"是什么、它怎样决定一页放多少 token，见[缓存规格](kv-cache-spec.md)；GLM 的主历史、池化索引与尾状态各自承担什么，见 [MLA](mla.md)。

## 几类特殊的"层"

### 一个稀疏 MLA 层其实注册了三个条目

每个稀疏 MLA 层向 Runner 注册的不止主注意力：它还挂着两个只管缓存的模块——一个存 indexer 的 K 池，一个存 kpool 的尾状态。两者的前向是空的，报出的后端也不是稀疏 MLA 后端，而是各自专用的缓存后端。它们存在的意义只有一个：让 Runner 按自己的缓存规格给它们分配和管理那份缓存。所以"一层 = 一个后端"在这里也不成立，一层可以对应三个分组键。

### MTP 的第 45 层也走稀疏 MLA

固定模型配置里的层类型表只有 45 项，MTP 层的索引落在表外；在这份配置下它被判为非 KDA，走 MLA 分支。它带自己的 indexer 和自己的三份缓存，也进缓存组。**所以按位置存压缩历史的是 12 层，不是 11 层。** 这不是给任意自定义层类型判断方法规定行为。

### KDA 的昇腾实现是按上游版本注册的

模型层里写的是上游类名，运行时由算子注册表换成昇腾实现，而这条注册挂在"上游版本等于 0.23.0"的分支里。换句话说，源码里那条 KDA 路径有明确的注册前提，不能无条件推广到别的上游版本。

### PCP 大于 1 会被当场拒绝

KDA 的 prefill 一上来就检查上下文并行组的大小，大于 1 直接抛出未实现。框架里存在上下文并行模块，不足以证明完整的 GLM 混合模型支持这个组合。

## 如果模型是密集注意力：FA3 这条分支

FlashAttention 把 Q、K、V 分块装进更靠近计算单元的存储，在处理不同 K/V 块时维护每一行的归一化统计量和输出累积值；它改变的是执行顺序和数据存放方式，避免把完整的注意力矩阵反复写回设备内存。它被称作"精确注意力"，指的是没有采用稀疏或低秩近似，有限精度下仍可能有舍入差异。FlashAttention-3 的原论文研究的是 NVIDIA Hopper 上的异步执行和低精度计算组织，不能直接当成昇腾 NPU 的执行说明。

固定版本里的 FA3 适配层调用外部包提供的注意力算子，官方文档强调的用途是训练与推理使用一致的实现。适配层接收 query、分页 K/V、有效历史长度、query 的累计长度和页表，调用外部算子后返回注意力输出。它声明的缓存形状是 `[2, num_blocks, block_size, num_kv_heads, head_size]`，最前一维区分 K 和 V，声明支持的 kernel block size 是 128——这是该后端自己的布局约束，推不出全库通用的缓存页大小。

混合批经过适配层时，实现按元数据把 query 和序列信息切成两段分别调用，再按原来的顺序拼接：decode 分支传 `causal=False`，prefill 传 `causal=True`。对每请求只有一个查询 token 的普通 decode，合法历史范围可由有效长度界定；多查询 token 的投机 decode 还需要逐查询因果约束，不能从这个固定 false 推出它同样适用。

这条路径是密集 MHA/GQA 的扩展阅读。把 `v0.30.0` 与 `main` 里的整张昇腾平台选择树摊开来看，共有「模型层直报旁路」与「平台 `get_attn_backend_cls` 三级门控」两条主线：

```wiki-diagram
file: attention-backend-family-fig-selector-tree
```

- **标准密集注意力与 MLA / SFA / DSA（通用四元组查表）**：`(use_mla, use_sparse, use_compress)` 为 `(False, False, False)` 默认落入 `AscendAttentionBackend`，内部按阶段与硬件能力在 **FIA**（`npu_fused_infer_attention_score` / `v2`）与 **PA**（`_npu_paged_attention`）等算子之间分流；**MLA / SFA / DSA** 分别对应 `(True, False, False)` / `(True, True, False)` / `(True, False, True)`；310P 由 `COMPATIBILITY` 硬件族落到 `AscendAttentionBackend310`，开启上下文并行 `use_pcp` 则查独立 MRV2 PCP 映射表。
- **Linear（线性注意力 / KDA / GDN）**：不经过通用注意力后端表，由模型层直接报出 `AscendGDNAttentionBackend` 等线性后端。
- **FA3（`AscendFABackend` / `AscendFAImpl`）与 `main` 新增前置分支**：在 `v0.23.0` / `v0.26.0rc` 须显式选 `FLASH_ATTN` 且开批不变，在 `v0.30.0` 与 `main` 改为未开 PCP 且 `rl_config.enabled` 与 `rl_config.enable_training_consistency` 同为真时优先命中（同时要求图模式用 `PIECEWISE` 或 eager，拒绝 `FULL_DECODE_ONLY` 与滑动窗口）；`main` 还为特定草稿/模型增加了 CANN **FA**（`fa_v1`）与 A2/A3 `flash_attn_npu_3`（`flash_attention_v3`）两条前置验证分支。各算子族的片上 Tiling、Online Softmax 与 FA/FIA/PA/FA3 详细分流见[FlashAttention 与昇腾注意力算子族](ascend-flash-attention.md)；具体拒绝条件见下面的[会报什么错](#会报什么错)。

## 常见误解

**"一个模型用一个后端。"** 后端按层挂。GLM 的一次前向里，34 层报 GDN 后端，12 层报稀疏 MLA 后端，另外还有只管缓存的两种后端，Runner 因此建出多个注意力组。

**"看平台的后端选择表就知道 GLM 走哪个后端。"** 旧部署的那张表按"是不是 MLA、是不是稀疏、是不是压缩"三个布尔量挑后端；旧 GLM 缓存层直接返回自身后端类，绕过这张表。`v0.30.0` 与 `main` 的 GLM 已改接可替换 MLA 包装层，实际 attention 后端会经过通用选择。想读懂路径，要从对应版本模型构造的对象出发，再查注册替换、后端元数据与算子调用。

**"`indexer_kpool_mla_v1.py` 里那段 PyTorch 稀疏注意力就是推理时跑的东西。"** 那段参考实现没有生产调用点，只有单元测试调用它；它里面 query 按 16 个一块的分块常量，是单测参考实现的写法，不能用来描述 NPU 推理的 tiling。推理实际走的是同文件里的重写方法，再进设备算子。

**"框架里有上下文并行模块，所以 GLM 能开 PCP。"** KDA 的 prefill 明确拒绝 PCP 大于 1。模块存在和这个模型支持是两件事。

**"FA3 更快，应该切过去。"** 固定版本只在显式选中并且开了批不变（batch invariant：同一条输入不论和谁拼在一批里，结果都逐位相同）时才尝试 FA3，而 MLA 与稀疏组合会被直接拒绝。GLM 的稀疏 MLA 层不在它的适用范围里。

**"KDA 没有按位置存 K/V，所以不占缓存。"** KDA 仍要存递推状态和卷积状态，并可能保留状态快照；只是每份状态的形状固定，不是每个历史 token 都新增一行 K/V。

## 对照源码

### 怎么开

旧 GLM 部署先按配置的层类型判断装配对象，缓存层直接返回后端类；通用 attention backend 参数不能把这些层统一换成另一种机制。上游通用路径使用 `AttentionConfig.backend`（`"auto"` 或不填表示自动选择），最终传给平台的 `get_attn_backend_cls`。旧版 FA3 还要求显式选择 `FLASH_ATTN` 且 `VLLM_BATCH_INVARIANT` 已启用。`v0.30.0` 与 `main` 的 GLM 包装层及 FA3 条件另见版本差异。

### 会报什么错

- 旧版经平台显式请求 FA3 且已启用批不变，但模型是 MLA 或稀疏组合：`FA3 backend does not support MLA and SFA.`
- 通过前述检查后，`flash_attn_npu_v3` 没装，或装了却没有 `flash_attn_with_kvcache`：两句分别的 `ValueError`。
- 未启用批不变就选 FA3：不报错，打印一条"不会启用 FA3"的日志，退回默认的后端选择流程。
- 稀疏 MLA 的设备算子只认 `sparse_mode=3`，传别的值抛 `ValueError`；传进来的 latent、RoPE 两份缓存视图维度对不上，或者拿不到打包好的 MLA 缓存，也各自抛错。
- KDA 的 prefill 在上下文并行组大于 1 时抛 `NotImplementedError`。
- Indexer KPool MLA 请求返回 LSE（softmax 归一化相关的 log-sum-exp 输出）时抛 `NotImplementedError`；该入口不提供这一输出。[C40]
- 同一个层名重复注册进前向上下文时抛 `ValueError: Duplicate layer name`，缓存层也走这条检查。

### 开销和什么时候别开

换后端的代价不在开关，在验证：机制、状态布局、dtype、head 形状、并行约束五项有一项对不上，结果就是错的而不是慢的。所以"某后端在别的模型上更快"不构成切换理由，先确认它能表达这一层的机制。

FA3 只适合密集 MHA/GQA，官方文档把它列为 A2/A3 上的 beta，并说明在[训推一致](vllm-ascend-for-rl.md#为什么训推一致和批不变要分开选择)场景下启用可能带来性能下降，图模式建议配 PIECEWISE。后端初始化还会拒绝 sliding window，以及非 eager 条件下的 `FULL_DECODE_ONLY`。

部署镜像的同一份文档还列出 FA3 不支持 ALiBi 位置偏置、attention logit softcapping（对注意力分数进行软限制）和 FP8 量化注意力；这些也是选择该后端前需要核对的功能条件。[S32][S34]

该固定文档说明，flash_attn_with_kvcache 的 tiling 在主机侧处理，不能捕获进 ACL 图；内核不提供 RoPE 时，框架使用 PyTorch 原生 RoPE 回退。这里的图限制针对这版 FA3，所以指南选择 PIECEWISE，将不兼容部分留在图外。[S32][S34]

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）沿「前置特判（FA3 / FA）→ 硬件兼容分支（310P）→ PCP 分支 → 通用四元组查表」组织注意力后端选择树，并将 `Linear`（KDA/GDN）留在模型层直报路径：**
- **FA / FIA / PA / FA3（`PIECEWISE`）**：标准密集层 `(False, False, False)` 在四版均落入 `AscendAttentionBackend`（`attention_v1.py` 内部按硬件/阶段/量化在 FIA / FIA v2 / PA 之间调度，详见 [FlashAttention 与昇腾注意力算子族](ascend-flash-attention.md)）。训推一致 **FA3（`fa3_v1.AscendFABackend`）**在 `v0.23.0` / `v0.26.0rc` 须显式选 `FLASH_ATTN` 且开 `VLLM_BATCH_INVARIANT`，而在 `v0.30.0` 与 `main` 改为「未开 PCP 且 `rl_config.enabled` 与 `rl_config.enable_training_consistency` 同为真」触发，初始化仍拒绝 `sliding_window` 与 `FULL_DECODE_ONLY`（须配 `PIECEWISE` 或 `enforce_eager`）。`main` 还额外在查表前插入两条特判：A5 特定草稿走 CANN **FA**（`fa_v1.AscendFlashAttentionBackend`），A2/A3 兼容 MiniMax 走 `flash_attention_v3.AscendFlashAttentionBackend`。
- **MLA / SFA / DSA 与 GLM 稀疏路径**：`v0.30.0` 与 `main` 均以 `(use_mla, use_sparse, use_compress)` 映射到 `AscendMLABackend`、`AscendSFABackend`、`AscendDSABackend`，310P 由 `HardwareProfile.attention_backend_family is COMPATIBILITY` 落到 `AscendAttentionBackend310`；PCP/DCP 通过专用映射表与公共 mixin 复用普通 V1 后端。GLM 稀疏层在 `v0.30.0` / `main` 已拆分为 `Glm5NextKPoolIndexerBackend`（索引执行，检查 NoPE 与硬件并拒绝 PCP/DCP）、可替换 MLA 包装层经通用选择命中 `AscendSFABackend`、以及完成池与尾状态各自的 cache-only backend（尾状态改名 `AscendIndexerKPoolTailBackend`）；而正文 GLM 双机绑定算例读的是专用镜像 `db701c1f`（独立 orphan commit，不属于 `2c59ff10` / `2ed6cbba` 维护分支，后两者不含 GLM 5.3 Python 实现）。
- **Linear（KDA / GDN）**：不走平台 `get_attn_backend_cls` 查表；`v0.26.0rc` 取消了上游版本号门控注册，`v0.30.0` / `main` 中 GLM 的 KDA 层直接报出 GDN 后端，`ops/kimi_kda.py` 对应类改名 `AscendKimiK3DeltaAttention`。

| 选择树与后端项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 密集默认（FIA / PA） | `AscendAttentionBackend`（`attention_v1.py` 内部路由 FIA / PA） | 同 `v0.23.0` | 同左，310P 改由 `HardwareProfile` 判 `COMPATIBILITY` 落 `AscendAttentionBackend310` | 同 `v0.30.0`，并在入口增加存储 dtype 合法性校验 |
| 训推一致 FA3（`fa3_v1`） | 显式选 `FLASH_ATTN` 且 `VLLM_BATCH_INVARIANT=1` 才试；拒绝 MLA/SFA、`sliding_window`、`FULL_DECODE_ONLY` | 同 `v0.23.0` | 未开 PCP 且 `rl_config.enabled` + `enable_training_consistency` 同为真；须 `PIECEWISE` 或 eager | 同 `v0.30.0` |
| CANN FA / A2-A3 `flash_attn_npu_3` | 无 | 无 | 无 | 新增 `_validate_flash_attn_backend` → `fa_v1`（A5 特定草稿）与 `_validate_flash_attn_npu_3` → `flash_attention_v3`（兼容 MiniMax） |
| MLA / SFA / DSA | 按 `(use_mla, use_sparse, use_compress)` 查 4 项表 | 同 `v0.23.0` | 4 项表（`MLA / Attention / SFA / DSA`）+ 独立 `use_pcp` MRV2 PCP 映射表 | 同 `v0.30.0`（MRV2 统一执行栈） |
| Linear（KDA / GDN）与 GLM 路径 | 维护分支无 GLM 5.3（镜像 `db701c1f` 按 0.23.0 分支注册 KDA、MLA 缓存层直返 `AscendIndexerKPoolMLABackend`） | 无 GLM 5.3（Kimi KDA 无条件注册） | `models/glm5next/`：KDA 直报 GDN；MLA 包装层经通用选择命中 `AscendSFABackend`；尾状态 `AscendIndexerKPoolTailBackend` | 延续 `models/glm5next/` 拆分（`AscendKimiK3DeltaAttention` + `AscendSFABackend` + cache-only backend） |

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 层类型分支：KDA 还是 MLA | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105`；判断函数 `#L216-L227` |
| 尾状态、K 池两个缓存后端的延迟导入 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L181-L196` |
| 主 MLA 后端由层内部的缓存层报出 | `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L45`、`#L74-L82`、`#L136-L137` |
| 两个只管缓存的层的注册、后端与规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L310`、`#L312-L368` |
| 稀疏 MLA 层构造的注意力对象 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2049` |
| KDA 的昇腾实现按上游版本注册 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768` |
| KDA 层报出 GDN 后端 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L232-L243` |
| KDA 前向：投影、门控、输出归一化 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291` |
| KDA decode：逐 token 更新递推状态 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388` |
| KDA prefill：拒绝 PCP、门控前缀和、分块 KDA | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L475` |
| 推理时真正走的稀疏注意力重写 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| 设备算子：潜向量同时当 K 和 V，只认 `sparse_mode=3` | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| 父类的调用点与算完之后的 V 解压、输出投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028` |
| Runner 按「类名 + 缓存规格」分组 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5039-L5063` |
| 每组建一个元数据构建器 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5065-L5083` |
| 上游的后端选择入口与批不变开关 | `vllm@0fc695fc:vllm/v1/attention/selector.py#L54-L110`；`vllm@0fc695fc:vllm/config/attention.py#L14-L22` |
| 平台的后端选择表（旧基线与四版演进） | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831`；`vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L868`；`vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L816-L869`；`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L247-L290`；`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L275-L374` |
| FA3 / CANN FA / `flash_attn_npu_3` 验证与拒绝 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L833-L858`；`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1484-L1510`；`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1793-L1953` |
| FA3 与 FIA / PA 适配层实现 | `vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L12-L145`；`vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L11-L60`、`attention_v1.py#L920-L1115`；`vllm-ascend@8d6180e2:vllm_ascend/attention/fa3_v1.py#L11-L66`、`attention_v1.py#L982-L1195` |

**证据索引。** 层类型分支、MTP 层落到 MLA、两个缓存后端延迟导入与主 MLA 缓存层后端返回见来源 1–6、37–39 [C1]；KDA 注册前提、GDN 后端与拒绝 PCP 见来源 7–11，推理稀疏路径、设备算子与父类调用点见来源 12–14 [C12]；Runner 分组键与元数据构建器见来源 15–16，四版平台选择表与 FA3/FA/FIA/PA 适配层见来源 17–29、63–70 [C63][C67]；上游选择入口见来源 30–31。FA3 的 beta 状态、图模式建议与训推一致用途见来源 32–34 [S32][S34]；FlashAttention 与 FlashAttention-3 原论文见来源 35–36 [S35][S36]。稀疏 MLA 的 2051 个位置取自主线推导（见[稀疏注意力](sparse-attention.md)与 [MLA](mla.md)），33.6 MFLOP 与 370 MFLOP 是按该位置上界算出的静态量，不含 softmax、投影与 kernel 补齐 [D]。

新版路径的补充映射：来源 41–45 区分 CP 继承、GLM 索引执行与 KDA 层；来源 46–56 支持 GLM 包装注册、Ascend MLA 子类与通用选择；来源 57–59 对照参考实现、默认 query 分块 16 与单测调用；来源 60 说明 Kimi 类名，61–62 说明状态份数与投机状态消费者。来源 32–34 同份官方指南在首段与限制段对包是否开源的说法冲突，本页仅采用其接口、功能和启用条件，安装时仍须检查实际包与入口是否存在 [I]。

**待核：**

- 设备算子的实际 tiling 与 HBM 流量没有实测，本页的 MFLOP 与位置数都是静态上界。
- 完整安装产物是否与固定镜像逐字一致，仍以[来源基线](../sources/glm-5-3-flash-baseline.md)为准。
