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
verified: []
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 后端要实现已经定义的注意力计算和因果约束
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

这条路径是密集 MHA/GQA 的扩展阅读。固定版本通过平台选路、显式要求 FA3 且启用批不变时，MLA 或稀疏组合会被校验拒绝；旧 GLM 的显式后端路径则直接返回自身实现。具体条件见下面的"会报什么错"。

## 常见误解

**"一个模型用一个后端。"** 后端按层挂。GLM 的一次前向里，34 层报 GDN 后端，12 层报稀疏 MLA 后端，另外还有只管缓存的两种后端，Runner 因此建出多个注意力组。

**"看平台的后端选择表就知道 GLM 走哪个后端。"** 旧部署的那张表按"是不是 MLA、是不是稀疏、是不是压缩"三个布尔量挑后端；旧 GLM 缓存层直接返回自身后端类，绕过这张表。main 与 rc2 的 GLM 已改接可替换 MLA 包装层，实际 attention 后端会经过通用选择。想读懂路径，要从对应版本模型构造的对象出发，再查注册替换、后端元数据与算子调用。

**"`indexer_kpool_mla_v1.py` 里那段 PyTorch 稀疏注意力就是推理时跑的东西。"** 那段参考实现没有生产调用点，只有单元测试调用它；它里面 query 按 16 个一块的分块常量，是单测参考实现的写法，不能用来描述 NPU 推理的 tiling。推理实际走的是同文件里的重写方法，再进设备算子。

**"框架里有上下文并行模块，所以 GLM 能开 PCP。"** KDA 的 prefill 明确拒绝 PCP 大于 1。模块存在和这个模型支持是两件事。

**"FA3 更快，应该切过去。"** 固定版本只在显式选中并且开了批不变（batch invariant：同一条输入不论和谁拼在一批里，结果都逐位相同）时才尝试 FA3，而 MLA 与稀疏组合会被直接拒绝。GLM 的稀疏 MLA 层不在它的适用范围里。

**"KDA 没有按位置存 K/V，所以不占缓存。"** KDA 仍要存递推状态和卷积状态，并可能保留状态快照；只是每份状态的形状固定，不是每个历史 token 都新增一行 K/V。

## 对照源码

### 怎么开

旧 GLM 部署先按配置的层类型判断装配对象，缓存层直接返回后端类；通用 attention backend 参数不能把这些层统一换成另一种机制。上游通用路径使用 `AttentionConfig.backend`（`"auto"` 或不填表示自动选择），最终传给平台的 `get_attn_backend_cls`。旧版 FA3 还要求显式选择 `FLASH_ATTN` 且 `VLLM_BATCH_INVARIANT` 已启用。main 与 rc2 的 GLM 包装层及 FA3 条件另见版本差异。

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

**v0.30.0rc2 继续按 attention 形式与硬件选择后端，同时把 PCP/DCP 作为独立选择条件。** DCP 的 GQA、MLA、SFA 实现通过公共 mixin 复用普通 V1 后端，只覆盖通信和缓存布局不同的阶段；读专用后端时还须向上追父类。MRV2 PCP 有单独的后端表，不能把 MRV1 的选择结果套过去。

rc2 的 GLM 稀疏层把三种职责分开：模型的 indexer 工厂返回 Glm5NextKPoolIndexerBackend，包装层据此创建索引执行模块；这个模块检查 NoPE 与硬件类别，并拒绝 PCP/DCP。真正计算 attention 的 MLA 包装层被注册为 Ascend 实现，内部构造继承上游的 AscendMLAAttention，再由通用选择器选中 SFA 后端。完成池与尾状态则由各自的 cache-only backend 管理。KDA 另由模型自带实现接入 GatedDeltaNetAttention。因此，名字里的“Backend”既可能指索引计算，也可能指 attention 或缓存管理，须看它的构造者和使用者。

rc2 的 FA3 条件与下表 main 一样：未开 PCP，并且 RL 总开关与训推一致开关都为真；随后仍检查密集 attention 类型及外部包。通用 PCP 后端的存在不绕过 GLM indexer 自身的限制。

上游的后端选择入口（`get_attn_backend`、`AttentionConfig.backend`）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页的 GLM 算例读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：该镜像包含 GLM 5.3 模型代码，2c59ff10 与 2ed6cbba 上都没有 Python 实现。**

| 项目 | v0.23（来源 22） | v0.26（来源 23、24） | main（来源 25–29） |
|---|---|---|---|
| GLM 5.3 的模型代码 | 没有 | 没有（只有 Kimi KDA 的算子与单测） | 有，在 `vllm_ascend/models/glm5next/` |
| KDA 层报出的后端 | 没有这条路径 | 昇腾 Kimi KDA 实现无条件注册，不再挂版本分支 | GLM 的 KDA 层直接返回 GDN 后端；`ops/kimi_kda.py` 里的类改名成 `AscendKimiK3DeltaAttention` |
| 稀疏 MLA 层报出的后端 | 没有这条路径 | 没有这条路径 | 可替换 MLA 包装层被注册为 Ascend 实现，内部构造上游 `MLAAttention`，通用选择最终返回 `AscendSFABackend` |
| 尾状态缓存后端的名字 | 没有这条路径 | 没有这条路径 | `AscendIndexerKPoolTailBackend`（镜像里叫 `AscendIndexerKPoolStateBackend`） |
| 平台选择表的四个键 | MLA / 密集 / 稀疏 MLA / 压缩 MLA，四项一致 | 一致 | 一致，但 310P 分支换成按硬件画像判断，另加一张 PCP 专用表 |
| FA3 什么时候试 | 显式选 `FLASH_ATTN` 且批不变已启用 | 同 v0.23 | 不再看显式选择，改成没开 PCP，且 RL 总开关与训推一致开关都为真 |

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
| 平台的后端选择表 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831` |
| FA3 的启用条件与三种拒绝 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L833-L858` |
| FA3 适配层：缓存形状、kernel 块、混合批切分 | `vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L12-L60`、`#L62-L97`、`#L99-L145` |

**证据索引。** 层类型分支、MTP 层落到 MLA、两个缓存后端的延迟导入、两个缓存层与稀疏 MLA 层构造的对象见 [C1]–[C6]；主 MLA 后端由层内部的缓存层赋值并返回，见 [C37]–[C39]；KDA 的注册前提、它报出的后端以及 prefill / decode 两条算子分支（含拒绝 PCP）见 [C7]–[C11]；推理实际走的稀疏路径、设备算子与父类调用点见 [C12]–[C14]；Runner 的分组键与元数据构建器见 [C15][C16]；平台选择表与 FA3 的三种拒绝见 [C17][C18]；FA3 适配层的缓存形状、kernel 块与混合批切分见 [C19]–[C21]；三个快照的差异见 [C22]–[C29]；上游选择入口与配置字段见 [C30][C31]；FA3 的 beta 状态、图模式建议与训推一致用途见 [S32]–[S34]；FlashAttention 与 FlashAttention-3 的机制说明见 [S35][S36]。稀疏 MLA 的 2051 个位置取自主线底稿的逐层前向一节，推导在[稀疏注意力](sparse-attention.md)与 [MLA](mla.md) [D]；33.6 MFLOP 与 370 MFLOP 是按这个位置上界算出的静态量，不含 softmax、投影与 kernel 补齐 [D]。

新版路径的补充映射：来源 41–45 区分 rc2 平台选择、CP 继承、GLM 索引执行与 KDA 层；45 与 42 是同一固定文档。来源 46–47、56 支持 main 的包装注册、上游 MLA 构造和通用选择；48–53、55 支持 rc2 的 indexer 工厂、包装构造、Ascend MLA 子类及上游选择；54 是 rc2 FA3 的双开关条件。来源 57–59 对照参考实现、默认 query 分块 16 与单测调用，生产路径由来源 12–14 支持；60 说明 main 中 Kimi 类名，61–62 说明状态份数与投机状态的消费者。来源 32–34 的同份官方指南在首段与限制段对包是否开源的说法冲突，本页仅采用其接口、功能和启用条件，安装时仍须检查实际包与入口是否存在。

**待核：**

- 设备算子的实际 tiling 与 HBM 流量没有实测，本页的 MFLOP 与位置数都是静态上界。
- 完整安装产物是否与固定镜像逐字一致，仍以[来源基线](../sources/glm-5-3-flash-baseline.md)为准。
