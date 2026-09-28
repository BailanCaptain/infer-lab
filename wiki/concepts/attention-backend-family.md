---
id: attention-backend-family
title: 注意力后端：模型机制、状态布局与设备实现的连接
type: concept
summary: 注意力后端是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定用哪份状态、按什么形状组织这批 token、最后调哪个算子。GLM 的一次前向同时走 KDA 和稀疏 MLA 两条分支，不存在"这个模型的后端"。
aliases: [attention backend, 注意力后端, AttentionBackend, metadata builder, IndexerKPoolMLA, Kimi KDA,
  AscendGDNAttentionBackend, AscendIndexerKPoolMLABackend, attention group, 注意力组,
  FlashAttention, Flash Attention 3, FA3, AscendFAImpl, flash_attn_npu_v3, flash_attn_npu,
  flash_attn_with_kvcache, _validate_fa3_backend, 训推一致, 训练推理一致, enable_training_consistency]
chapters: ["09", "16"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L216-L227
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L181-L196
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L296-L310
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L352-L368
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2049
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L232-L243
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L388
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L475
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5039-L5063
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5065-L5083
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L833-L858
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L12-L60
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L62-L97
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L99-L145
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L841
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L816-L842
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L679-L732
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L240-L281
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1357-L1383
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L266-L267
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kv_cache.py#L119-L178
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L301-L327
  - vllm@0fc695fc:vllm/v1/attention/selector.py#L54-L110
  - vllm@0fc695fc:vllm/config/attention.py#L14-L22
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L8-L43
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L45-L73
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L134-L156
  - https://arxiv.org/abs/2205.14135
  - https://arxiv.org/abs/2407.08608
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L45
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L82
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L136-L137
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 后端要实现已经定义的注意力计算和因果约束}
  - {to: mla, kind: builds-on, note: 理解压缩历史、索引和尾状态，才能解释对应后端输入}
  - {to: linear-attention, kind: builds-on, note: KDA 的递推与卷积状态需要不同于位置 K/V 页的访问方式}
  - {to: sparse-attention, kind: builds-on, note: 每个查询最多 2051 个位置的推导在那一页}
  - {to: kv-cache-spec, kind: builds-on, note: 分组用的缓存规格就是那一页讲的 spec}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 这一层的注意力，最后是谁在算？

**注意力后端（attention backend）是模型层和设备算子之间的那层代码：层说自己是哪种注意力，后端决定它用哪份状态、按什么形状组织这一批 token、最后调哪个算子。**

```wiki-diagram
file: attention-backend-choice
```

问"这个模型用什么后端"是问错了问题。后端是**按层**挂的：每一层自己报出一个后端类，同一次前向里不同的层可以报出不同的类。GLM 的一次前向就同时走两条分支——**KDA**（Kimi Delta Attention，一种线性注意力：不保存历史位置，把整段历史压进一个固定大小的状态）的层走一条，**稀疏 MLA**（Multi-head Latent Attention 的稀疏版：历史压成一条潜向量按位置存，每个查询只挑其中一部分读）的层走另一条，谁也不经过对方的算子。

## 为什么要专门分出这一层，代价是什么

分出这一层，是因为它要同时吃下两种差异。

**一是硬件的差异。**同一个数学机制，在不同设备上是不同的算子。设备实现必须原样保留计算语义、因果关系和请求之间的隔离，只换执行方式——所以后端不是一个"速度选项"，它决定结果对不对，不只是快不快。

**二是层与层之间的差异。**[密集注意力](attention-qkv.md)描述打分、归一化与 V 汇合，[稀疏注意力](sparse-attention.md)在此之上限定能访问哪些位置，[KDA](linear-attention.md)干脆不保存历史位置，改用递推状态。三者连"历史要不要随长度增长"都不一样，状态布局自然也对不上：稀疏 MLA 按位置存压缩历史和索引，KDA 只存一份固定大小的矩阵状态和卷积状态。

代价有两条。

**后端不能当插件随便换。**一个候选后端要同时对上五件事：这一层的机制、状态布局、dtype、head 形状、并行约束。满足某一个模型或某一种设备的条件，不等于 GLM 全部层都能用；性能比较也只有在语义和功能一致的前提下才有意义。

**每多一种后端，调度侧就多一份元数据。**后端需要的不只是 Q/K/V 张量，还有缓存布局、请求边界、有效长度和位置索引。模型每引入一种新机制，Runner 就要为它多建一套元数据构建器，多维护一种形状约定。

## 放到 GLM 双机：一个 token 走过 45 层，要问 45 次

部署前提见 [GLM 5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)。本页沿用[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)：第一步是 1 条请求、4 个 token（教学设定）；R1 所在 DP 组的那 8 张卡拿到同样的 4 个 token，差别只在权重分片，每卡 KDA 8 个头、稀疏 MLA 8 个头，这些数都在那一页推导。

主干是第 0–44 层，共 45 层：34 层是 KDA，11 层是稀疏 MLA（第 3、7、11 … 43 层）；编号 45 的 **MTP**（Multi-Token Prediction，多 token 预测用的草稿层）也是稀疏 MLA。层类型在装配时就定死了：装配代码按配置里的层类型表挑分支，挑中哪条，这一层构造的对象和它报出的后端就跟着定了。

| 这一层是 | 层里构造的对象 | 报出的后端 | 最后落到的算子 |
|---|---|---|---|
| KDA，34 层 | 上游的 KimiGatedDeltaNetAttention，运行时被换成昇腾实现 | AscendGDNAttentionBackend | prefill 走短卷积 + 门控前缀和 + 分块 KDA；decode 走逐 token 更新递推状态 |
| 稀疏 MLA，11 层 + 编号 45 的 MTP 层 | AscendIndexerKPoolMLAAttention，它内部再建一个缓存层对象，后端由这个缓存层报出 | AscendIndexerKPoolMLABackend | 稀疏 flash attention：只在选中的位置上读潜向量、打分、汇合 |

表里的几个名字先解释一下。**GDN** 是 Gated DeltaNet，一类带遗忘门的线性注意力；KDA 是它的变体，昇腾的 KDA 实现沿用了 GDN 这个后端接口名，所以 KDA 层报出的是 GDN 后端。**indexer** 是稀疏 MLA 里专门为当前查询挑历史位置的小模块，**KPool** 是它把相邻几个位置合成一个"池"再打分的做法，两者的算法见[稀疏注意力](sparse-attention.md)。

两条分支在同一个 token 上的开销完全不同。

稀疏 MLA 这边，每个查询最多读 2051 个位置（2048 个选中位置加 0–3 个尾部位置，推导见[稀疏注意力](sparse-attention.md)）。按这个上界，一层一卡的 QK 与 PV 合计约 **33.6 MFLOP / token**，主干 11 层约 **370 MFLOP / token**；这是不含 softmax、投影和 kernel 补齐的静态上界。

KDA 这边没有"读几个位置"这回事：它读写的是每个头一份的矩阵状态和一份卷积状态，大小固定，不随历史变长。45 层里有 34 层因此不随长度增长——这正是这个模型敢把上下文开到十万量级的原因，细节见 [KDA 线性注意力](linear-attention.md)。

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

配置里的层类型表只有 45 项，MTP 层的索引落在表外，判断函数因此返回假，这一层走的是 MLA 分支。它带自己的 indexer 和自己的三份缓存，也确实进了缓存组。**所以真正存 KV 的是 12 层，不是 11 层。**

### KDA 的昇腾实现是按上游版本注册的

模型层里写的是上游类名，运行时由算子注册表换成昇腾实现，而这条注册挂在"上游版本等于 0.23.0"的分支里。换句话说，源码里那条 KDA 路径有明确的注册前提，不能无条件推广到别的上游版本。

### PCP 大于 1 会被当场拒绝

KDA 的 prefill 一上来就检查上下文并行组的大小，大于 1 直接抛出未实现。框架里存在上下文并行模块，不足以证明完整的 GLM 混合模型支持这个组合。

## 如果模型是密集注意力：FA3 这条分支

FlashAttention 把 Q、K、V 分块装进更靠近计算单元的存储，在处理不同 K/V 块时维护每一行的归一化统计量和输出累积值；它改变的是执行顺序和数据存放方式，避免把完整的注意力矩阵反复写回设备内存。它被称作"精确注意力"，指的是没有采用稀疏或低秩近似，有限精度下仍可能有舍入差异。FlashAttention-3 的原论文研究的是 NVIDIA Hopper 上的异步执行和低精度计算组织，不能直接当成昇腾 NPU 的执行说明。

固定版本里的 FA3 适配层调用外部包提供的注意力算子，官方文档强调的用途是训练与推理使用一致的实现。适配层接收 query、分页 K/V、有效历史长度、query 的累计长度和页表，调用外部算子后返回注意力输出。它声明的缓存形状是 `[2, num_blocks, block_size, num_kv_heads, head_size]`，最前一维区分 K 和 V，声明支持的 kernel block size 是 128——这是该后端自己的布局约束，推不出全库通用的缓存页大小。

混合批经过适配层时，实现按元数据把 query 和序列信息切成两段分别调用，再按原来的顺序拼接：普通 decode 传 `causal=False`（合法历史范围已经由长度和缓存布局界定），prefill 传 `causal=True`。

这条路径是密集 MHA/GQA 的扩展阅读。GLM 主线的稀疏 MLA 切不过来——平台的选择函数在遇到 MLA 或稀疏组合时会直接抛错，具体条件见下面的"会报什么错"。

## 常见误解

**"一个模型用一个后端。"** 后端按层挂。GLM 的一次前向里，34 层报 GDN 后端，12 层报稀疏 MLA 后端，另外还有只管缓存的两种后端，Runner 因此建出多个注意力组。

**"看平台的后端选择表就知道 GLM 走哪个后端。"** 那张表按"是不是 MLA、是不是稀疏、是不是压缩"三个布尔量挑后端，服务的是通过上游通用路径建层的模型。GLM 的层自己返回后端类，根本不经过这张表。想读懂实际路径，要从模型层实际构造的对象出发，再查注册替换、后端的元数据构建，最后才是算子调用。

**"`indexer_kpool_mla_v1.py` 里那段 PyTorch 稀疏注意力就是推理时跑的东西。"** 那段参考实现没有生产调用点，只有单元测试调用它；它里面 query 按 16 个一块的分块常量，是单测参考实现的写法，不能用来描述 NPU 推理的 tiling。推理实际走的是同文件里的重写方法，再进设备算子。

**"框架里有上下文并行模块，所以 GLM 能开 PCP。"** KDA 的 prefill 明确拒绝 PCP 大于 1。模块存在和这个模型支持是两件事。

**"FA3 更快，应该切过去。"** 固定版本只在显式选中并且开了批不变（batch invariant：同一条输入不论和谁拼在一批里，结果都逐位相同）时才尝试 FA3，而 MLA 与稀疏组合会被直接拒绝。GLM 的稀疏 MLA 层不在它的适用范围里。

**"KDA 层也要占 KV cache。"** KDA 不保存历史位置，只占每条请求固定大小的状态。

## 对照源码

### 怎么开

GLM 这边没有开关：层类型由模型配置里的层类型表决定，后端由层自己返回，不经过任何环境变量。上游能拨的只有 `AttentionConfig.backend`（`"auto"` 或不填表示自动选择），它最终传给平台的 `get_attn_backend_cls`；只有走通用路径建层的模型才受它影响。FA3 那条分支还要额外满足批不变路径已启用（由 `VLLM_BATCH_INVARIANT` 决定）。

### 会报什么错

- 请求 FA3 但模型是 MLA 或稀疏组合：`FA3 backend does not support MLA and SFA.`
- 请求 FA3 但 `flash_attn_npu_v3` 没装，或装了却没有 `flash_attn_with_kvcache`：两句分别的 `ValueError`。
- 未启用批不变就选 FA3：不报错，打印一条"不会启用 FA3"的日志，退回默认的后端选择流程。
- 稀疏 MLA 的设备算子只认 `sparse_mode=3`，传别的值抛 `ValueError`；传进来的 latent、RoPE 两份缓存视图维度对不上，或者拿不到打包好的 MLA 缓存，也各自抛错。
- KDA 的 prefill 在上下文并行组大于 1 时抛 `NotImplementedError`。
- 同一个层名重复注册进前向上下文时抛 `ValueError: Duplicate layer name`，缓存层也走这条检查。

### 开销和什么时候别开

换后端的代价不在开关，在验证：机制、状态布局、dtype、head 形状、并行约束五项有一项对不上，结果就是错的而不是慢的。所以"某后端在别的模型上更快"不构成切换理由，先确认它能表达这一层的机制。

FA3 只适合密集 MHA/GQA，官方文档把它列为 A2/A3 上的 beta，并说明在训推一致场景下启用可能带来性能下降，图模式建议配 PIECEWISE。后端初始化还会拒绝 sliding window，以及非 eager 条件下的 `FULL_DECODE_ONLY`。

### 版本差异

上游的后端选择入口（`get_attn_backend`、`AttentionConfig.backend`）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页的 GLM 算例读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：GLM 5.3 的模型代码只在镜像里，2c59ff10 与 2ed6cbba 上都没有 Python 实现。**

| 项目 | v0.23[C22] | v0.26[C23][C24] | main[C25]–[C29] |
|---|---|---|---|
| GLM 5.3 的模型代码 | 没有 | 没有（只有 Kimi KDA 的算子与单测） | 有，在 `vllm_ascend/models/glm5next/` |
| KDA 层报出的后端 | 没有这条路径 | 昇腾 Kimi KDA 实现无条件注册，不再挂版本分支 | GLM 的 KDA 层直接返回 GDN 后端；`ops/kimi_kda.py` 里的类改名成 `AscendKimiK3DeltaAttention` |
| 稀疏 MLA 层报出的后端 | 没有这条路径 | 没有这条路径 | 不再是模型自带的后端类，改用上游的 MLA 包装层，后端回到平台表里的 `AscendSFABackend` |
| 尾状态缓存后端的名字 | 没有这条路径 | 没有这条路径 | `AscendIndexerKPoolTailBackend`（镜像里叫 `AscendIndexerKPoolStateBackend`） |
| 平台选择表的四个键 | MLA / 密集 / 稀疏 MLA / 压缩 MLA，四项一致 | 一致 | 一致，但 310P 分支换成按硬件画像判断，另加一张 PCP 专用表 |
| FA3 什么时候试 | 显式选 `FLASH_ATTN` 且批不变已启用 | 同 v0.23 | 不再看显式选择，改成没开 PCP 且 RL 配置里的训推一致开关为真 |

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 层类型分支：KDA 还是 MLA | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105`；判断函数 `#L216-L227` |
| 尾状态、K 池两个缓存后端的延迟导入 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L181-L196` |
| 主 MLA 后端由层内部的缓存层报出 | `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L45`、`#L74-L82`、`#L136-L137` |
| 两个只管缓存的层各自报出的后端与规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L296-L310`、`#L352-L368` |
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

**待核：**

- 设备算子的实际 tiling 与 HBM 流量没有实测，本页的 MFLOP 与位置数都是静态上界。
- 完整安装产物是否与固定镜像逐字一致，仍以[来源基线](../sources/glm-5-3-flash-baseline.md)为准。
