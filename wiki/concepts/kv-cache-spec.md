---
id: kv-cache-spec
title: KV cache 规格：每层的状态怎样换算成页、编进缓存组
type: concept
summary: >-
  KV cache
  规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的说明：一块覆盖多少个位置、每个位置或每份状态占多少字节。管理器据此算出一页多大，再把能共用块号清单、管理方式兼容的层编成缓存组。GLM
  的四类状态被对齐成两档页、编成 5 个组；本页也是 block_size 五种含义的唯一出处。
aliases:
  - KV Cache Spec
  - KVCacheSpec
  - KV 缓存规格
  - KV Cache 规格
  - KV Cache 声明
  - 按层 KV 规格声明
  - AttentionSpec
  - MLAAttentionSpec
  - MambaSpec
  - 缓存组
  - cache group
  - KV cache group
  - page size
  - 页大小
  - 两档页
  - block_size 五义
  - block_size 的五种含义
  - 逻辑块
  - kernel 块
  - 调度块
  - block_size
  - block-size
  - kv_cache_dtype
  - kv-cache-dtype
  - mamba_block_size
  - mamba-block-size
  - mamba_cache_mode
  - mamba-cache-mode
  - disable_hybrid_kv_cache_manager
  - disable-hybrid-kv-cache-manager
  - no-disable-hybrid-kv-cache-manager
chapters:
  - '11'
sources:
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L96-L131'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L159-L200'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L353-L384'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L607-L645'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L829-L871'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1629-L1695'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1029-L1066'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1074-L1193'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1300-L1326'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2072-L2085'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L633'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L847-L856'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1335-L1335'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L279-L285'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L60'
  - 'vllm@0fc695fc:vllm/config/cache.py#L230-L244'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L125-L168
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L185-L225
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5124-L5267'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L121-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L295-L362'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L104-L228
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L459-L548
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L664-L698
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L396
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4097-L4132'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4484-L4528'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L38-L66'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L90-L110
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L112-L147
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L28-L62
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L90-L117'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L82-L138
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L125
  - 'vllm@84030bbe:vllm/v1/kv_cache_interface.py#L862-L881'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L82-L88'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L382-L394'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L288-L352'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1432'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    raw:sha256-445f566a0a282f63725d9137c86f367ed68452ff3720bcd88b66f3a55c1b98cb.md#L1-L1779
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L127-L147
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L42-L61
  - 'vllm@0fc695fc:vllm/config/cache.py#L19-L141'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L132-L138'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L337-L394'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1444-L1516'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L2110-L2155'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1116-L1163'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1409-L1415'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L66-L81'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L71-L146
  - 'vllm@568afb3a:vllm/config/cache.py#L19-L147'
  - 'vllm@568afb3a:vllm/model_executor/models/config.py#L545-L602'
  - 'vllm@84030bbe:vllm/config/cache.py#L19-L197'
  - 'vllm@84030bbe:vllm/model_executor/models/config.py#L609-L657'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L164-L170'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/cache_config.py#L1-L44'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/kv_cache.py#L68-L174'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L624-L656'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L235-L270'
  - 'vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/non_contiguous_kv_cache.md#L1-L274'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1880-L1903'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L26-L41'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_mamba_config.py#L91-L143'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L84-L140'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/cache_config.py#L90-L190'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L646-L665'
  - 'vllm@ced6857a:vllm/v1/kv_cache_interface.py#L970-L989'
  - 'vllm@ced6857a:vllm/config/cache.py#L39-L82'
  - 'vllm@ced6857a:vllm/config/cache.py#L166-L186'
  - 'vllm@ced6857a:vllm/model_executor/models/config.py#L609-L657'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L164-L170'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L332-L350'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L332-L350'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4222-L4242'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L4297-L4325'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5030-L5080'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L5253-L5290'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L907-L918'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1001-L1012'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4577-L4586'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L4758-L4767'
  - 'vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L28-L85'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/kv_cache_interface.py#L19-L41'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/kv_cache_interface.py#L104-L129'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L96-L136'
  - 'vllm-ascend@7d825229:vllm_ascend/core/kv_cache_interface.py#L93-L129'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5288-L5324'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L5551-L5581'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L634-L656'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4003-L4024'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L285-L345'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L308-L324'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/cache_config.py#L286-L366'
  - 'vllm@84030bbe:vllm/v1/kv_cache_interface.py#L554-L603'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4683-L4716'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L4706-L4739'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5552-L5598'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L5895-L5930'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L5720-L5762'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L554-L579'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L648-L660'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L338'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/cache_config.py#L90-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/cache_config.py#L342-L430'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L84-L135'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_mamba_config.py#L42-L175'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/cache_config.py#L100-L155'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L223-L315'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L534-L610'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_mamba_config.py#L42-L175'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache
    kind: builds-on
    note: 先弄清要保存哪几类状态、为什么保存，再看它们怎样被写成规格、换算成页
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: '逻辑块 640、每块号 8,355,840 B、3,855 块三个数的推导都在部署页，本页只用结论'
  - to: linear-attention
    kind: builds-on
    note: KDA 一份状态有多大、为什么每组每请求 4 块，在线性注意力页推导
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-445f566a0a282f63725d9137c86f367ed68452ff3720bcd88b66f3a55c1b98cb.md
  - >-
    raw/sha256-542c7f002806b885e0b1325fcb333b7f312f3a0bf33b617b55ce86e1f01f351a.md
  - >-
    raw/sha256-5ab7b5c46f6e88da2979ce082049c8725f31e33bb11a6c445943e2da4ef5cd73.md
---

## 一层要存的状态，怎样变成缓存池里的一页？

**KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的一张说明：一块覆盖多少个位置、每个位置（或每份状态）占几个字节、用什么精度。** 缓存管理器在调度侧给请求发块号，并登记谁占着哪块。它按规格算出这一层每块占多少字节（即「一页」），再把管理方式兼容、能共用块号清单的层编成一个 KV cache group（缓存组）；同组共享的是块号，各层对应的页可以大小不同。

先认三个词。**块（block）** 是分配的单位：对按位置增长的状态，一块覆盖若干个连续位置；**块号** 是池里一段空间的编号。**页（page）** 是一个块号落到某一层上的那段显存。**缓存组** 是共用一张 [block table](block-table.md)（请求内逻辑位置到块号的映射表）的一批层：同组各层用同一串块号，各自在自己的显存里找到对应的页。

规格对象是一份说明，不是已经分配好的缓存张量。它在启动时决定如何切空间，之后调度器才能按同一套口径给请求发块号。统一管理的代价是页内补齐与短请求尾块空位：有效数据少，不表示只占了那么多显存。

一块覆盖多少 token、底层存储块有多长、一页占多少字节，需要分开看。基础规格默认前两者相等，页字节数交给具体子类计算；特殊子类可以另定存储块长，不能把基础实现里的相等关系当成所有规格的共同约束。

```wiki-diagram
file: kv-cache-spec-intuition
```

图从上往下读三步。第一步，每层按自己要存的东西交规格。第二步换算成页，算法有两种：按位置增长的历史，一页等于「一块的位置数 × 每个位置的字节数」；每条请求固定大小的状态，一页要容纳整份状态。第三步，按共用块号的管理规则分组；各层保存自己的数据，同组共享编号。

有些布局让不同组的层轮流使用同一个物理槽位。这时，槽位得装得下其中任一种状态，较小的状态后面会留下空白。需要哪些层对齐、对齐到几档，以及各组如何共用空间，要由实际布局决定，不能先假定全模型只有一种页大小。

## 为什么要先报规格再分配？代价在哪？

**分配之前必须先知道单价。** 引擎启动时先让每张卡上的每一层报规格，再量出装完权重、跑完一次假数据前向后还剩多少显存（见 [KV cache 显存预算](kv-cache-memory-profiling.md)）。接着，引擎用「一个块号在所有层上合计占多少字节」去除可用显存，得到能切几块，再把块数发回各卡建池。报价和分配是两趟，中间隔着一次显存测量，顺序倒不过来。

一个引擎管多张卡时，各卡先按自己的预算和规格算出可切块数，引擎取最小值发回全部卡。各卡切页时还会拿自己手上的字节数反推块数，确认不少于这个最小值。

**为什么按层报，不按模型报？** 同一个模型可以同时包含不同类型的层：有的按位置累积历史，有的只保留固定大小的状态，谁也替不了谁报价。跨层共享 KV 的层会借用另一层的缓存，因此不报规格、也不另占块。草稿模型里只存 hidden state（隐藏向量）的层则上报派生规格，单独成组。

规格统一的代价落在三处：

- **补齐的空白。** 小状态要使用更大的物理页时，页内有一部分空间不承载有效数据；后面的步长示意会实际算这部分。
- **短请求没用满的页。** 块覆盖的位置越多，短请求最后一块可能留下的空格就越多；占用按整页计费。
- **不同状态互相影响。** 某些混合布局用固定状态大小倒推历史块长。状态变大（比如[投机解码](speculative-decoding.md)的候选预留或卷积历史增加）时，要重新检查原页能否装下；越过容量才会按对齐单位增大块长。

相邻的几个概念各管一件事：

| 概念 | 回答的问题 | 什么时候定 |
|---|---|---|
| 规格 | 这一层一页多大、一块覆盖几个位置 | 启动时每层报一次 |
| 缓存组 | 哪些层共用一张块号清单 | 启动时由引擎分组 |
| block table | 某条请求在某个组里用了哪些块号 | 每步调度时更新 |
| 显存预算 | 总共能切出多少个块号 | 启动时量一次 |

## 规格有哪几类，各自怎样算一页？

**所有规格都回答同两个问题：一块覆盖几个位置（`block_size`），一页多少字节。** 上游 vLLM 的规格组成一个类家族，基类规定这两个量，并额外给出两项指标。一是存储块长（一页实际存几条，默认等于块大小，带压缩比的 MLA 规格按「块大小 ÷ 压缩比」折算）；二是「这一层最多要多少显存」，用于在启动时检查最长请求是否放得下。每个子类按自己存的东西算一页：

| 规格类 | 存什么 | 一页的字节数怎么算 |
|---|---|---|
| 普通注意力（`AttentionSpec` 及其 full、滑窗等子类） | 每个位置的 K 和 V | 未打包主数据为 $2 \times \text{block\_size} \times n_{\text{kv}} \times d_h \times \text{bytes}$（2 为 K、V 各一份） |
| MLA（`MLAAttentionSpec`） | 每个位置一份压缩表示，不分 K、V | 普通主数据布局为「存储块位置数 × 头数 × 头维 × 每数字节」，存储块 = 块大小 ÷ 压缩比 |
| 递推状态（`MambaSpec`） | 卷积历史、SSM 矩阵等固定形状状态 | 每份状态「各维相乘 × 每数字节」再相加，与块大小无关 |
| hidden state 缓存 | 草稿模型要回看的隐藏向量 | 从 MLA 规格派生，单独成组，页补齐到与其他组等大 |

表里有三点要记住：

1. **MLA 没有系数 2。** 它每个位置只存一份压缩表示，同样头维下一页只有普通注意力的一半，详见 [MLA](mla.md)。
2. **MLA 规格带有压缩比。** 压缩比大于 1 时，一块里的位置先合并成更少的条目再存，一页只存「块大小 ÷ 压缩比」条（例如后文 GLM 的 indexer K）。
3. **递推状态的块大小不决定页大小。** 递推状态一页就是整份状态，块大小只表示「一页替多少个位置负责」。关闭[前缀缓存](prefix-caching.md)（把相同前缀已算状态复给后续请求）时，上游把它设成最大请求长度，表示任何长度的请求都只要一页；开启投机解码（如用模型自带的多 token 预测层 MTP 草拟候选）时，再为每个草稿位置各多留一页。

**每一类都可以带一个「补齐后的页大小」。** 设了它，一页就按补齐后的大小算，但不能比真实需要的小，否则启动时直接断言失败。页对齐就是靠这个字段：状态本身不变，只是页后面多出一段空白。

表中主数据公式不包含量化布局的额外字段。例如 NVFP4 按打包后的宽度计字节，`fp8_ds_mla` 使用专门的每 token 布局；容量规划应读取规格实际返回的页大小，不能只把主数据公式里的「每数字节」改小。

**边界与例外**：若走逐 token、逐头保存量化缩放系数的分支，每块还会为每个 token 的每个 KV 头计入两份 float32 缩放数据。此时页填充下限检查针对的是已经包含缩放数据的大小，容量估算也须使用最终返回的页大小。

**量化和卸载改的也是规格里的字段。** [KV cache 量化](kv-cache-quantization.md)修改规格里的精度和量化方式，页字节与显存账随之缩小。`v0.26` 与 `main` 的稀疏 MLA 规格还多出一个「放在主机内存」的标记，由[稀疏 KV 卸载](kv-cache-sparse-offload.md)开启；改在规格上，就等于直接改在了显存账上。

昇腾在这个家族上加了自己的子类。普通稀疏 MLA 路径由昇腾重建成自己的 MLA 规格，因为它把压缩表示和位置编码段拆开存，与上游拆法不同；GLM 的 indexer 尾状态用昇腾滑窗 MLA 规格（FP32 存储），而 GLM 三份注意力侧缓存走专用补丁路径，后文单独拆解。

## 标准主干走读：Qwen3-8B 的单一缓存组与 1:1 块映射

先用 `v0.30.0` 标准主基线下的 **Qwen3-8B**（36 层标准 GQA，每层 8 个 KV 头，头维 `128`，BF16 精度，单卡 `TP=1`）走通一遍，看「无异构混合层」的标准路径有多干净：

```wiki-diagram
file: kv-cache-spec-flow-qwen3
```

整条链路从启动到运行期只用一套规格、一个缓存组：

1. **平台定默认块长**：`NPUPlatform` 在未显式指定 `--block-size` 时，将昇腾默认块长定为 `block_size = 128`。
2. **全 36 层上报同一规格**：每一层都向 `NPUModelRunner.get_kv_cache_spec()` 交出完全相同的 `FullAttentionSpec`（8 个 KV 头、头维 128、BF16，每数 2 B）。单层每块页大小为：

$$P_{\text{layer}} = 2 \times 128 \times 8 \times 128 \times 2\text{ B} = 524{,}288\text{ B} = 512\text{ KiB}$$

3. **归并为单一缓存组**：36 层规格完全一致，引擎直接归为 **1 个同构缓存组**，无需跨档补齐，也没有页内空白。一个块号横跨 36 层的总显存单价为：

$$P_{\text{block}} = 36 \times 512\text{ KiB} = 18{,}432\text{ KiB} = 18\text{ MiB}$$

4. **逻辑块与物理块 1:1 直映**：`Qwen3-8B` 上，**分配单位（逻辑块）、物理页覆盖位置、算子（kernel）读取单位与前缀哈希粒度全部等于 `128`**。运行期第 2 站调度器只向一个 `BlockPool` 借块，第 3 站按 `slot = block_id * 128 + offset` 直接算出槽位，第 4 站全部 36 层共用同一份块表与 `AscendMetadata`。

| 标准同构口径（Qwen3-8B，TP=1，BF16） | 数值 | 说明 |
|---|---|---|
| 块长 `block_size` | `128` token | 逻辑块、kernel 块与前缀哈希块 1:1 重合 |
| 单层单块页大小 | `512 KiB` | $2 \times 128 \times 8 \times 128 \times 2\text{ B}$ |
| 整模型单块号单价（36 层） | `18 MiB` | $36 \times 512\text{ KiB}$，零页内填充空白 |
| 缓存组数量 | `1` 组 | 全 36 层共用同一张块表 |

只有当模型同时混装注意力层与线性递推状态层（或带压缩比的稀疏 MLA）时，才会跳出这条单组 1:1 路径，进入下面的多组对齐与跨档折算。

## 页大小不同的层，怎样放进同一个池？

**上游处理多种不兼容规格的一条通用路径，是先统一页大小，再把层拆成等大或补齐到等大的组。** 已经能共用同一种管理方式的规格会更早进入单组路径；DeepSeek V4 等模型和 GLM 还有专门的分组逻辑。先看需要统一页的这条路径：

1. **统一页大小。** 各层页大小不同时，找出最大的页，把其他层的块大小按倍数放大，直到页一样大；放不成整数倍就报错退出。
2. **按规格分类、切成等大的组。** 规格完全相同的层归一类；各类再交错取层，拆成目标大小的组，不足的留空。例如 10 层 full 注意力加 20 层滑窗注意力，切成 3 组、每组 10 层。目标大小通常取最小类的层数；最大类不足最小类的 1.5 倍时，改取最大类的层数以减少空位。
3. **几组共用几片显存。** 每组有几层，就开几片显存；每片由每组各出一层共用。块号在同一时刻只属于一个组，所以一片显存里的第 b 页不会同时被两层写。
4. **块数 = 可用显存 ÷（一页的字节 × 片数）**，每片显存的大小就是「一页 × 块数」。

注意力层和递推状态层混在一起时，页对齐更早就开始了：配置检查阶段就要把注意力的块大小定下来，昇腾的补丁替换了这一步（GLM 以外的混合模型怎么对齐，见[怎么开](#怎么开)）。

GLM 不能直接套上游这套做法。它的 indexer 页和尾状态页远小于 MLA 页，如果按上游规则全部统一到最大页，小页要放大十几倍；上游又假设所有组的页一样大。所以 GLM 用自己的补丁：**只统一到两档页，分组也按自己的规则来**。

规格表之前，还要确认究竟有几份独立状态。[DeepSeek 模型案例](deepseek-v4-1-flash.md#一块历史到底存多少而不是40-层乘一遍)按共享来源层统计分页历史，再把窗口和运行中间态单列；该模型的状态布局不能直接套用下面的 GLM 分组。

## 页有空白时，下一块地址怎么找？

**页的跨度和有效数据长度是两个量。** 页内补齐后，下一块仍从下一页开始；如果只按有效数据长度前进，就会把空白当作下一块的内容。stride（步长）记录沿某个维度前进一步需要跳过多少个元素，storage offset 则记录视图从底层存储的哪里开始。

用一份 FP16 状态作示意：一块有 20 个有效数，每个数 2 B，物理页按 64 B 分配。图中斜线表示未进入逻辑状态的填充：

```wiki-diagram
file: kv-cache-spec-stride
```

读到块号 1，应该去第二页找这 20 个数。地址先按字节计算，交给张量视图的步长再换成元素数（若误用有效数据 $40\text{ B}$ 作为步长，就会落进第 0 页的空白区）：

| 寻址量（FP16 示意，物理页 64 B） | 算式 | 结果 |
|---|---|---|
| 有效数据 | $20 \times 2\text{ B}$ | $40\text{ B}$ |
| 页内空白 | $64\text{ B} - 40\text{ B}$ | $24\text{ B}$ |
| 块步长（元素数） | $64\text{ B} \div 2\text{ B}$ | $32$ 个元素 |
| 块号 1 的字节起点 | $0\text{ B} + 1 \times 64\text{ B}$ | $64\text{ B}$ |

官方的 non-contiguous KV cache 方案让 Model Runner V1 在现有分配上建立带步长的视图，保持块号不变，跳过页内空白，避免为了得到连续视图再复制整池。K、V 与 Mamba 的卷积、递推状态可以有不同的视图、起始偏移和底层缓冲，并不要求全都相邻。需要连续状态行的算子仍有按行搬运：先按请求索引收集要用的行，算完再写回原来的页；省去的是整池复制。

这套视图设计与本页固定 GLM 的布局应分别看待：旧 GLM 的 MLA 热路径要求主历史页没有洞，再把一页拆成连续的 kernel 块。稀疏、压缩、offload 和 connector 各自还有存储与传输约定，不能仅凭模型属于混合模型就套用新视图。版本与观察日志见页末。

## 放到 GLM 双机：四类状态怎样变成两档页、五个组？

**先把三个概念拆开对照**：在标准 `Qwen3-8B` 上，**分配单位**（128 token）、**物理页字节**（单一档 `512 KiB/层`）与 **kernel 读取单位**（128 token）三者 1:1 重合。

进入下面的历史 GLM 双机混合架构后，三者彻底分离：**分配单位**扩成 640 逻辑块；**物理页字节**拆成大页 `655,360 B` 与小页 `40,960 B` 两档；**kernel 读取单位**仍锁在 128（1 逻辑块拆为 5 个连续 kernel 块），最终编成 `1 full + 1 尾状态 + 3 KDA` 共 5 个缓存组。

下面的数字均按[官方双机部署](glm-5-3-flash-two-node.md#部署前提)（例外 B 历史绑定算例）：两台 Atlas 800 A2、每台 8 卡，机内 TP8，两台之间 DP2。每台机器运行一个引擎进程（EngineCore）并带动 8 个 worker，启动时各自执行一遍建池流程（时机见[启动过程](glm-5-3-flash-two-node.md#启动时发生了什么)）。

在 TP8 切分下，MLA 与 indexer 缓存在 8 张卡上各存一份完整副本，KDA 状态则按头切分、每卡只存 8 个头。因此同一台机器内 8 张卡上报的规格完全一致。本节的两档页、五个组与字段回写均由固定源码硬约束推出，运行日志与 KV 配置转储核对见[页末待核](#源码位置)。

GLM-5.3-Flash（本节简称 GLM）的 45 层主干里，34 层 KDA 保存固定大小的递推状态，11 层稀疏 MLA 按位置存压缩表示。MLA 的 indexer 负责给历史位置打分、挑选本次要读的内容，并保存压缩后的 K 与未凑满一条的尾状态。四种状态怎样对齐、分组，先看总览图：

```wiki-diagram
file: kv-cache-spec
```

图中 GLM 的 full 组把 MLA 大页与 indexer 小页成对管理：同组共用块号，并未把两者补成同样大。只有不同组的层轮流使用同一片显存时，才要求共用槽位拥有相同页跨度，使块号 $b$ 在该片显存里始终指向第 $b$ 页。固定镜像因此分成两档：大页由 MLA 定，KDA 补到大页；小页由 indexer K 定，尾状态补到小页（斜线为空白填充，KDA 页约 14.4% 是空白，见[开销](#开销和什么时候别开)）。

共享物理槽位的定大规则也随布局而变。固定 GLM 取「注意力页」与「完整递推状态字节」的较大值，保证槽位能装下任一种状态；其他混合模型分支则将注意力页与卷积块页字节相加，两者不能互换。为容纳整份 KDA，GLM 逻辑块放大到 640；对 prompt 仅 4 个 token 的[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)，full 组首步只用了 4 格，却仍按整块计费。

```wiki-diagram
file: kv-cache-spec-flow
```

上两排是启动时走一次的规划，下排是之后每条请求都要经过的站点，它们只读启动时定下的组和页。

### 配置阶段：逻辑块先定成 640

**逻辑块的长度不是配置出来的，是从 KDA 状态倒推出来的。** 官方教程没有写 `--block-size`，配置对象先填上默认值 16。上游构造汇总配置时，会先跑混合模型配置检查，昇腾替换补丁就在这里把块大小写成 640；[平台](npu-platform.md)更晚才被调用，其通用规则里「非 128 改回 128」的一步遇到混合模型会跳过，640 因此保留下来。

这个配置检查在 GLM 分支里做三件事：

1. **定逻辑块。** 先算下限：$128 \times \lceil \text{KDA 单层状态字节} \div (128 \times \text{MLA 单 token 字节}) \rceil$，即「凑够几个 128 位置小块，一个 MLA 页才装得下整份 KDA 状态」。再与用户值（未写即 16）取较大者，并向上取到 128 的倍数，得到 640（代入数字推导见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)）。
2. **定 KDA 的目标页。** 取「一个 MLA 页」与「一份 KDA 状态」的较大值（即大页本身），KDA 状态补齐到该大小。
3. **定 KDA 组的块大小。** 默认设成最大请求长度 133,120（一条请求一页）；只有前缀缓存打开且 KDA 缓存模式为对齐模式时，才改成逻辑块长度。

**为什么必须是 128 的倍数？** 稀疏注意力（SFA）算子按 128 个位置一块读取历史。逻辑块是 128 的整数倍，worker 就能把一个 MLA 页原样看成几个首尾相接的 kernel 块，不需要在每块中间留洞的特殊视图。

**为什么让 MLA 定大页，而不是反过来？** MLA 保存的是每一步 decode 都要读的历史，是最热的读取路径；让它的页不带补齐，空白全部落在每条请求只有一份的 KDA 状态上。运行时还会复查：MLA 的页如果不等于它的真实大小，切 kernel 块之前直接报错。

用户显式给了块大小时，比 640 小的会被抬回 640，比 640 大的按 128 向上取整后保留。

### 每张卡报四份规格

**GLM 的 12 个 MLA 层（主干 11 层稀疏 MLA 加 MTP 的第 45 层）每层交三份规格，34 个 KDA 层每层交一份。** 四类规格对比如下：

| 状态 | 规格类 | 块大小（位置） | 一页装什么 | 落在哪档 |
|---|---|---|---|---|
| MLA latent | MLA 规格，压缩比 1 | 640 | 640 个位置 × 512 维，BF16 | 大页 |
| indexer K | MLA 规格，压缩比 4 | 640 | 压成 160 条 × 128 维，BF16 | 小页 |
| indexer 尾状态 | 昇腾滑窗 MLA 规格，窗口 4 | 4 | 4 个位置 × 256 维，FP32 | 小页（补齐） |
| KDA 状态 | 递推状态规格 | 133,120 | 一份卷积历史 + 递推矩阵 | 大页（补齐） |

MLA 层的三份缓存不走普通注意力的收集路径。它们各自挂着一个「缓存角色」标记（主缓存、indexer、尾状态），worker 认出标记就原样收下，再由后面的分组补丁按角色配对。尾状态每个位置存 256 维，是压缩用的 K 和门控分数各 128 维，用 FP32 存，等整条凑满、写进 indexer K 时才降到 BF16。KDA 那份规格的形状取决于 TP 大小、头数、头宽、卷积核长和投机 token 数；它还登记了 3 个草稿位置，所以每组每请求要 4 页。

各状态一层有多大、按位置增长的两类合计每 token 多少字节，推导分别在 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态) 和[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)，本页只用它们换算页。

### 对齐成两档页，编成五个组

**四份规格被对齐成两档：MLA 和 KDA 共用大页，indexer K 和尾状态共用小页。** 分组补丁先按角色把规格分成两类，每类取最大的页，写进各自的「补齐后页大小」（$561{,}152\text{ B}$ 是一层一份每卡 KDA 状态，由来见[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)）：

| 规格类别 | 对齐前单页字节 | 对齐算式 | 最终单页字节 | 所属档位 |
|---|---|---|---|---|
| MLA latent | $640 \times 512 \times 2\text{ B} = 655{,}360\text{ B}$ | 本身即大页基准 | $655{,}360\text{ B}$ | 大页 |
| KDA 状态 | $561{,}152\text{ B}$ | $\max(655{,}360,\; 561{,}152)$ | $655{,}360\text{ B}$ | 大页（补齐） |
| indexer K | $(640 \div 4) \times 128 \times 2\text{ B} = 40{,}960\text{ B}$ | 本身即小页基准 | $40{,}960\text{ B}$ | 小页 |
| indexer 尾状态 | $4 \times 256 \times 4\text{ B} = 4{,}096\text{ B}$ | $\max(40{,}960,\; 4{,}096)$ | $40{,}960\text{ B}$ | 小页（补齐） |

对齐之后编组，共 5 个：

- **full 组（1 个）。** 12 份 MLA latent 和 12 份 indexer K 交错排进同一组，每对里 MLA 排在前面。调度器拿组里第一份规格当代表，所以这一组按「历史全部保留」的 full 注意力方式分块；两份缓存拿到的是同一串块号。
- **尾状态组（1 个）。** 12 份尾状态，按滑窗方式管理，只留最近的几块。
- **KDA 组（3 个）。** 先把 34 层 KDA 单独按层号排成清单（连续 KDA 层最长为 3 层），再从第 1、2、3 项分别出发、每隔 3 项取一层，分成 3 组（层数 12、11、11）。这里跳的是 KDA 清单中的位置，不是整个模型的层号；同组各层格式一致，共用一张块号清单。

补丁在分组时还做四条硬检查：三份缓存的层号必须一一对应；逻辑块必须被压缩比 4 整除；尾状态的块大小和滑窗宽度必须等于压缩比；混合缓存管理器必须处于开启状态。与上游不同，**GLM 只在两档内部各自统一页大小**，各组页大小不再全等，上游的通用分配逻辑因此被替换成补丁专用分配。

### 一个块号在两档页里各占一格

**一个块号同时对应 12 片大页显存和 12 片小页显存里各一页。** 分配时共开 24 片显存：第 $i$ 片大页由第 $i$ 个 MLA 层和 3 个 KDA 组各自的第 $i$ 层共用（第 12 片只有 MTP 的 MLA 层和 KDA 第 0 组的第 12 层，即主干第 44 层）；第 $i$ 片小页由同一层的 indexer K 与尾状态共用。

块号 $b$ 在每一片里都指向第 $b$ 页。同一时刻一个块号只发给一个组，因此共用同一片显存的层不会撞车；代价是**只要占住一个块号，就会同时占住 24 片里的各一页**，不论当前哪个组在使用。

一个块号合计 8,355,840 B、折合每 token 13,056 B，按主线算例每卡能切 3,855 块；三个数的推导都在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)，两种块数口径见[两种块数各在什么时候用](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。

各卡拿到规划后，每片显存按原始字节一次申请；配了 KV 传输时首地址按 2 MiB 对齐。GLM 路径**不把一层拆成 K、V 两条**，同一片的几层直接绑到同一块原始显存，切形状时才套上各自精度。MLA 页被视作「块数 × 5」个 128 位置的 kernel 块；indexer 页里的 160 条本身满足 [CANN](cann-hccl.md) 索引算子对块长的要求（16 的倍数且不超过 1024），无需再拆。

请求来了以后，[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)按这 5 个组给 R1 发块号：full 组 1 块、尾状态组 2 块、KDA 三组各 4 块，共 15 块；[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)再把 full 组的逻辑块号展开成 kernel 块号，见[块表](block-table.md#分配块与内核页可能不同)。

## block_size 到底指哪一个？五种含义

**同一个词在五处指不同的东西，而且同一个配置字段在启动过程中被改写过两次：先是默认的 16，配置阶段改成 640，KV 配置算完又改成 4。** 读日志或代码里的 `block_size`，先看它属于哪个阶段、哪个组，再对照下图与汇总表。知识库其他页提到这五种值时都链接到这里。

```wiki-diagram
file: kv-cache-spec-fig-hybrid-alignment
```

| 含义 | 本部署的值 | 谁在用 | 值从哪里来 |
|---|---|---|---|
| 逻辑块 | 640 个位置 | KV 池、full 组（MLA 与 indexer K）、容量算式 | GLM 配置补丁：一个 MLA 页装得下整份 KDA 状态，再取 128 的倍数 |
| kernel 块 | 128 个位置 | SFA 算子；worker 展开块表时用 | 算子支持的块长，写死在昇腾后端和配置补丁里 |
| 尾状态组的块 | 4 个位置 | indexer 尾状态 | 等于 indexer 的压缩比，也是滑窗宽度 |
| KDA 组的块 | 133,120 个位置 | 3 个 KDA 组 | 设成最大请求长度，一条请求一页；前缀缓存加对齐模式时才改成逻辑块 |
| 调度器的块 | 133,120 个位置 | 调度器与缓存协调器的对齐单位 | 各组块大小的最小公倍数 |

**逻辑块（640）** 是 KV 池分配的主单位。full 组的一个块号在每个 MLA 层上覆盖 640 个连续位置，在 indexer K 上覆盖同样 640 个位置压成的 160 条；每块号多少字节、能放多少 token 都按它算。它的值由上一节的配置补丁倒推出来，推导在[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。

**kernel 块（128）** 是稀疏注意力算子一次读取的单位。worker 把 full 组块表里的每个逻辑块号展开成 5 个连续的 kernel 块号再交给算子，展开过程见[块表](block-table.md#分配块与内核页可能不同)。逻辑块必须是它的整数倍，否则启动时报错。

**尾状态组的块（4）** 属于 indexer 尾状态。indexer 每 4 个位置压成一条 K，还没凑满 4 个的那几个位置先放在尾状态里；所以这一组的块长、滑窗宽度都等于压缩比 4，随最新位置向前滑动。R1 第一步在这一组拿到 2 块。

**KDA 组的块（133,120）** 表示「一页替多长的序列负责」。设成最大请求长度，意思是任何请求的 KDA 状态都只要一页，与序列长度无关；每组每请求实际拿 4 块（当前页 + 3 个草稿位置各一页），推导见[线性注意力](linear-attention.md#状态怎么占到块号上)。打开前缀缓存并使用对齐模式时，它改成逻辑块长度，状态才能按块留存并复用。

**调度器的块（133,120）** 是调度侧的 token 对齐单位。调度器和缓存协调器要求它能被每个组的块大小整除，前缀缓存命中长度也按它取整；它取各组块大小的最小公倍数（昇腾补丁再乘上下文并行规模，本部署为 1）。本部署既没开前缀缓存、也没配 KV connector（[PD 分离](pd-disaggregation.md)与 [Mooncake](mooncake-connector.md) 所用的跨实例 KV 搬运插件），因此不走命中取整逻辑，这里主要充当启动期整除约束。

**第六个数不是新含义，而是被改写后的字段。** 引擎算完 KV 配置、通知各卡初始化之前，会把配置里的 `block_size` 字段回写成各组块大小的最小值（本部署是尾状态组的 4）。这一步之后再读该字段，拿到的是 4，不是 640。昇腾补丁计算调度粒度时特意不用回写值，而是直接取各组最小公倍数，防止上游兜底逻辑误将 4 当作缓存块大小并关闭细粒度哈希。

五种值之间的换算只有下面几步（$133{,}120 = 208 \times 640$，同时也是 $4$ 的倍数，所以最小公倍数就是 KDA 组的块）：

| 换算关系 | 算式 | 结果 |
|---|---|---|
| 1 个逻辑块含几个 kernel 块 | $640 \div 128$ | $5$ 个 |
| 1 个逻辑块压成几条 indexer K | $640 \div 4$ | $160$ 条 |
| 调度器的对齐块 | $\text{lcm}(640,\; 4,\; 133{,}120)$ | $133{,}120$ |
| 引擎回写的 `block_size` 字段 | $\min(640,\; 4,\; 133{,}120)$ | $4$ |

还有两个容易混进来的数不算 block_size：160 是 indexer 页里的条数，源码叫存储块长；16 是配置对象的默认值，GLM 补丁生效后就不再出现。

### 打开前缀缓存或 KV connector 以后

**调度粒度之外还会多出一个哈希粒度。** 前缀缓存或 KV connector 打开时，GLM 补丁优先采用显式给定的哈希块长，未给则取各组块大小的最大公约数，并校验各组块大小都能被它整除；两者都关时，哈希粒度直接等于调度粒度。配置了昇腾 KV 存储 connector 时，KDA 缓存模式还会同步切到对齐模式。

三种粒度各管一件事：**哈希粒度决定按多细的单位识别相同前缀，调度粒度给多组状态提供共同的命中与留存边界，kernel 块负责算子里的具体寻址。** 普通一步处理多少 token 仍由请求剩余量和[调度预算](vllm-scheduler.md)决定，不会因为共同粒度是 133,120 就要求每轮推进 133,120 个 token（Mamba align 等分支另做分块对齐）。细粒度哈希也不意味着能在任意哈希边界恢复全部混合状态：MLA 历史、indexer 尾巴和 KDA 状态必须停在同一个有效边界，细节见[前缀缓存](prefix-caching.md#哪些块能被共享)。

## 常见误解

- **「没写块大小参数，块大小就是默认的 16，或者昇腾常用的 128。」** GLM 的配置补丁会把它改成 640；手动给更小的值也会被抬回 640。
- **「启动后读到 block_size 是 4，说明逻辑块是 4 个位置。」** 4 是引擎回写的各组最小值，也就是尾状态组的块长；逻辑块仍是 640。
- **「混合模型会把全模型所有页补成一样大。」** 上游通用路径是这样；GLM 只统一到两档，大页 655,360 B、小页 40,960 B，两档之间差 16 倍。
- **「KDA 组的块大小是 133,120，说明 KDA 按位置存了 13 万格。」** KDA 一页就是一整份状态，133,120 只表示这一页替多长的序列负责。
- **「对齐时只看 KDA 的递推矩阵就够了。」** 卷积历史也在状态里，也要进页；只按递推矩阵算，逻辑块会偏小、装不下整份状态。
- **「页大小相同，就是同一种缓存。」** MLA 与 KDA 共用大页，但一个按位置增长、一个每请求一份，恢复条件和寻址方式都不同；解释一个物理块，要先知道它属于哪个组、哪种状态。
- **「补齐日志里的百分比是卷积状态的占比。」** GLM 分支里，它是 KDA 页里空白的比例，(655,360 − 561,152) ÷ 655,360；按补丁公式推算，日志应印出 14.38%（未实跑，见[页末待核](#源码位置)）。
- **「一层的 KV 总是 K、V 两次独立申请。」** 昇腾普通注意力路径是这样，因为 PD 分离（prefill 和 decode 放在不同实例上，中间搬 KV）的传输侧要求张量第一维就是块数；GLM 路径按规划一片显存申请一次，不拆 K、V，MLA 本来也只存一份压缩表示。
- **「规格写 BF16，申请下来的就是 BF16 张量。」** 申请时一律按原始字节，切形状时才套上精度；字节数来自规格，不来自张量类型，所以换成更小的缓存精度能直接省显存。GLM 的 MLA 缓存精度在代码里写死为 BF16，不受缓存精度参数影响。

## 对照源码

**规格与页字节的来源范围。** 已核来源 1 的固定上游 `kv_cache_interface.py` 第 96–131 行：`block_size` 是一块包含的 token 数，基础 `storage_block_size` 返回它，`page_size_bytes` 由子类实现。来源 2 第 168–180 行在 `is_per_token_head` 分支额外计入 `2 × block_size × num_kv_heads × sizeof(float32)`；缩放张量虽由后端单独管理，空间仍从原始 KV 分配中划出，随后才检查 `page_size_padded` 下限并返回最终页字节数。这些静态公式不能代替设备实际分配测量，也不自动适用于其他量化分支。[I]

### 怎么开

规格不需要打开，模型加载完就自动收集一遍。上游引擎初始化 KV cache 时向各 worker 要规格，昇腾的 `NPUModelRunner.get_kv_cache_spec()` 逐层分发：

- 跨层共享 KV 的层记进 `shared_kv_cache_layers` 后直接跳过，不产生规格，也不占块；
- 普通注意力交给上游造规格；GLM 以外的稀疏 MLA 重建成 `AscendMLAAttentionSpec`，因为昇腾把压缩表示和位置编码段分开存；
- 带 `cache_role` 的 GLM 缓存原样收下：主缓存和 indexer 是上游 `MLAAttentionSpec`（`compress_ratio` 分别为 1 和 4，`model_version="glm5_next"`），尾状态是 `AscendIndexerKPoolStateSpec`；
- 草稿模型的 cache-only 层重建成 `HiddenStateCacheSpec`，分组时单独成组；
- `MambaBase` 层最后收，每层给一份 `MambaSpec`；同时把比递推状态页小的普通注意力页补上 `page_size_padded`，GLM 的三份缓存不参与这一步。


**输入值、配置默认和最终规格要分开看。** 下表都是启动参数，不是逐请求字段；CLI 用连字符，EngineArgs 和离线 LLM 的引擎关键字用下划线。kv_cache_dtype 传进 CacheConfig 后字段名是 cache_dtype；disable_hybrid_kv_cache_manager 属于 SchedulerConfig，其余四项属于 CacheConfig。

| CLI / 引擎关键字 | 定义默认与值域 | 固定 GLM 教程的有效行为 |
|---|---|---|
| `--block-size` / `block_size` | 输入默认 None，构造 CacheConfig 时补成 16；显式输入为正整数，后端另有对齐要求 | 教程未给，补丁推成逻辑块 640；小于 640 抬到 640，大于它按 128 向上取整，641 会变 768；引擎后续字段回写另见前文五义 |
| `--kv-cache-dtype` / `kv_cache_dtype` | 默认 auto；接受该版 CacheDType 枚举，见下文 | 教程保留 auto；MLA 主缓存代码固定 BF16，indexer 与尾状态各有自己的规格，不能借此把整套 GLM 缓存量化 |
| `--mamba-block-size` / `mamba_block_size` | 默认 None；显式值为正整数；通用说明要求为 8 的倍数以符合短卷积内核，对应后端还可有更强约束 | 补丁最后重新赋值：开前缀缓存且模式为 align 时取逻辑块，否则取当时的最大模型长度；教程为 133120，用户填的值也会被覆盖 |
| `--mamba-cache-mode` / `mamba_cache_mode` | 默认 none；枚举 none、all、align | 教程前缀缓存关闭且没有 connector，最后为 none；模型检查和存储 connector 可改写输入模式 |
| `--disable-hybrid-kv-cache-manager` / `disable_hybrid_kv_cache_manager` | 默认 None，按平台、特性与 connector 自动决定；布尔输入 True/False | 本布局要求最终为 False，即保留混合管理；True 使 GLM 分组失败 |

**缓存精度的枚举不等于当前硬件支持清单。** v0.23 的完整输入枚举为 auto、float16、bfloat16、fp8、fp8_e4m3、fp8_e5m2、fp8_inc、fp8_ds_mla、turboquant_k8v4、turboquant_4bit_nc、turboquant_k3v4_nc、turboquant_3bit_nc、int8_per_token_head、fp8_per_token_head、nvfp4。auto 通常跟随模型数据类型，但模型和后端可以另行选择；量化的缩放与支持条件见 [KV cache 量化](kv-cache-quantization.md#怎么开)。固定 GLM 主缓存虽然硬编码 BF16，混合配置补丁仍会读取 cache_dtype 来估算注意力页、推导逻辑块，因此改这个参数可能改变规划或提前报错，不能说它“完全无效”。W8A8 是权重量化设置，也不代表 KV 自动用 8 位。

**三种 Mamba 模式描述保留哪些状态。** none 不为复用前缀留沿途状态，仍然保存当前请求继续计算所需的状态；all 在每个块边界保留状态；align 只在调度步结束且恰好落在块边界时保留。它们改变的是状态副本的留存方式，不是把卷积/递推计算关掉。示意块长为 8、一轮处理到位置 24：支持 all 的模型可以留下 8、16、24 三个边界的状态；align 只留下该步终点 24。若分两步到 16、24，align 则可分别留下这两个终点。复用条件和状态成本沿用[前缀缓存](prefix-caching.md#哪些块能被共享)与[线性注意力](linear-attention.md#状态怎么占到块号上)的推导。

基线先执行上游 Mamba 模型检查：前缀缓存关闭时把模式改回 none；开启时，输入 none 会按模型是否支持 all 选 all 或 align，显式 all 但模型不支持也回退 align；align 要求 chunked prefill 开启。随后 Ascend 补丁检查 AscendStoreConnector（也包括 MultiConnector 中的该子连接器）：混合管理开启且不是 extract_hidden_states 草稿路径时，none 改为 align，其他非 align 模式触发断言。普通 PD connector 不自动触发这次改写。

最后才定 Mamba 块长。**前缀缓存开启且 align → 逻辑块；其余 → 当前模型总长度**，这一赋值不保留显式 mamba_block_size。因此仅接 AscendStoreConnector、但仍关闭前缀缓存时，可以是 align 与 133120 的组合，不能把“align”一概等同于“块长 640”。GLM 教程 none 与 133120 的组合则沿用前文一页负责整条请求的解释。auto-fit 若在后续引擎阶段缩短模型长度，也没有在这段配置补丁中重新推导 Mamba 块；本页 133120 的结论限定为教程显式长度。

固定 GLM 可读作下面的**等效参数片段**：它把教程原本省略的缓存设置写明，仍须配合原有完整双机命令，不是一份新的可直接运行部署方案。block_size=640 在这里是配置推导的结果；mamba_block_size 继续省略，让补丁设定。

```bash
--max-model-len 133120 --no-enable-prefix-caching --kv-cache-dtype auto --mamba-cache-mode none --no-disable-hybrid-kv-cache-manager
```

Python 引擎关键字对应 max_model_len=133120、enable_prefix_caching=False、kv_cache_dtype="auto"、mamba_cache_mode="none"、disable_hybrid_kv_cache_manager=False。双重否定是 CLI 布尔解析的真实写法：disable 标志使字段为 True，no-disable 使字段为 False；省略则保留自动判断。混合管理关闭后，上游一般注意力模型会按统一的完整长度分配，而 GLM 的成对 MLA/indexer 与滑动尾状态依赖混合布局，直接拒绝关闭。

GLM 以外的注意力加递推状态混合模型，走同一个配置补丁的通用分支：注意力块大小取 128 的倍数，让「一个位置的 K 字节 × 块大小」恰好等于递推矩阵那份状态，凑不成相等就报错；递推状态的页补成「一整页注意力 + 一份卷积状态」，各卡收齐规格后，再把比它小的注意力页也补到这个大小（上面收集规格的最后一条），两种页最终一样大。用户显式给了更小的块大小时，这条分支同样会把它改大，不报错。

按固定源码推算，GLM 补丁生效时启动日志应出现下面两行（第二行的百分比是 KDA 页里空白的比例）。这是静态推算，还没有在专用镜像上实跑核对，见页末待核：

```text
Setting GLM-5 logical attention block size to 640 tokens so the contiguous MLA page covers the complete KDA state.
Padding mamba page size by 14.38% to ensure that mamba page size and attention page size are exactly equal.
```

### 会报什么错

- **输入校验与模式约束。** block_size、mamba_block_size 为 0 或负数在字段检查时拒绝；未知 kv_cache_dtype 或 mamba_cache_mode 不在枚举中。缓存模式 align 还要求块长不大于 max_num_batched_tokens；设置了非零 long_prefill_token_threshold 时，它不能小于块长。基线还要求 chunked prefill、允许分块多模态输入，且不支持 V2 model runner 的 align 模式。
- **显式 Mamba 块与前缀。** 上游最终检查：Mamba 块长非 None 且不等于当前最大模型长度时，若前缀缓存关闭，报 `--mamba-block-size can only be set with --enable-prefix-caching`。GLM 补丁可能先把用户值覆盖为最大长度，所以不能承诺“只要传了该参数且关前缀就一定报错”。
- **强制保留混合管理但运行配置不支持。** `Hybrid KV cache manager was explicitly enabled but is not supported in this configuration`；省略参数可以让上游按平台和特性自动选择，但 GLM 最终仍必须保留混合管理，自动关闭不是 GLM 的可用回退。
- **GLM 分组补丁。** 关了混合缓存管理器：`GLM-5's paired MLA/indexer and sliding state layout requires the hybrid KV cache manager.`；三份缓存缺一份：`GLM-5 cache layout requires main MLA, compressed indexer, and compressor-state specs.`；层号对不上：`GLM-5 MLA, indexer, and state cache layer indices do not match.`；逻辑块不能被压缩比整除：`GLM-5 logical block size must be divisible by the indexer compression ratio`；尾状态块长或窗口不等于压缩比：`GLM-5 indexer state block/window size must equal the paired compression ratio`；分配时两档没对齐：`GLM-5 cache specs were not aligned to two physical page sizes.`
- **配置补丁。** 目标页比 KDA 状态还小：`The padded hybrid cache page is smaller than the Mamba/KDA state`；GLM 以外的混合模型凑不齐页：`Cannot align ssm_page_size and attn_page_size.`
- **worker 切页。** MLA 页带了补齐：`GLM-5 main MLA must define the complete large physical page before virtual block splitting`；逻辑块不是 128 的倍数：`GLM-5 logical block size must be divisible by the SFA kernel block size`；规划的层和实际申请的层不一致：`GLM-5 KV cache tensors are not correctly initialized`；申请到的字节不是页大小的整数倍，或按自己的字节反推出的块数少于引擎发下来的块数：`raw_tensor.numel() % page_size_bytes == 0`、`num_blocks >= kv_cache_config.num_blocks` 两条断言。
- **上游。** 补齐后的页比真实页小：`assert self.page_size_padded >= ...`；通用路径统一页大小失败：`The page size of the layer is not divisible by the maximum page size. Cannot unify by adjusting block_size.`

来源 7 的固定上游 `kv_cache_utils.py` 第 1029–1066 行给出这条通用路径：页大小已经相同时直接返回；否则先检查最大页大小能否被当前较小页大小整除，再按商放大较小页对应的 `block_size`，最后断言调整后的页大小等于最大值。能否成功同时取决于整除条件和调整后的实际页大小，并非任意两种页大小都能统一；这不等于 GLM 专用分组路径的规则。[I]
- **打开前缀缓存或 connector 时。** 哈希块长不能整除某个组：`Invalid hash_block_size=...; all GLM-5 KV cache group block sizes must be divisible by it.`

### 开销和什么时候别开

规格本身不占显存，占显存的是它推出来的页和块：

- **补齐。** KDA 页约 14.4% 是空白，34 层、每请求 4 页的 KDA 页子账约 85 MiB，推导在[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)。它未计入借块同时占住的其他槽位，整块计价见下一条。尾状态页 9/10 是空白，但一页只有 40 KiB。
- **块号不分组计价。** 一个块号在大页和小页里各占一格；KDA 组占用某个块号时，小页那一格空着。占住一个块号就是 7.969 MiB，见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。
- **增大块长要重算容量。** full 组按块分配，块越大，短请求留下的空白越多；KDA 页要补到和 MLA 页一样大，块越大补得越多。是否能换来更小块表或执行收益，需测量相应负载，不能只改一个数就认定更快。
- **前缀缓存默认关着。** 打开后 KDA 组的块大小、哈希粒度和状态留存方式都会变，收益与代价见[前缀缓存](prefix-caching.md#glm-双机上它开着吗)。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）的 GLM 分组均在 `models/glm5next/cache_config.py` 实现，并同步支持 DeepSeek-V4.1 专用缓存规划。** 主 MLA 与压缩索引共享调度块编号，尾状态与各 Mamba 组独立分配，规格按两档物理页对齐；索引缓存显式声明不按普通 attention/Mamba 页做统一对齐，尾状态使用环形规格并按每请求固定环管理。在 `patch_kv_cache_utils.py` 中，`v0.30.0` 仍携带 `_ascend_resolve_kv_cache_block_sizes` 与 `_get_kimi_k3_dspark_mixed_kv_cache_groups`；`main` 则将这两项补丁退场，并新增 `_ascend_annotate_eagle_groups` 与 `_uses_qwen4_exp_mtp` 适配。

Worker 还会按实际多组布局修正可用逻辑预算，并在层复用、稀疏卸载、KVPP 开启时继续调整。旧镜像 `db701c1f` 的块长 640 与预算块数是旧配置的计算结果，不是 `v0.30.0` 全模型默认值；迁移须重新读取各组的 `block_size`、`page_size_bytes` 和实际分配张量。

**四版本核验矩阵**（vLLM 对应 `0fc695fc` / `568afb3a` / `ced6857a` / `84030bbe`；本页 GLM 绑定算例固定于专用镜像 `db701c1f`，`v0.23.0` 与 `v0.26.0rc` 维护快照不含 GLM 模型）：

| 项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` | 本页镜像 `db701c1f` |
|---|---|---|---|---|---|
| 上游规格家族 | MLA 带 `compress_ratio` 与模型版本字段 | 同 `v0.23.0` | 压缩比改由 `tokens_per_state` 表达；尾状态专用规格每请求固定 1 块、不参与前缀复用 | 同 `v0.30.0` | 同 `v0.23.0` |
| 逻辑块怎样定 | 通用混合对齐取 128 倍数，使单 K 页对上递推页，凑不齐报错 | 同 `v0.23.0` | GLM 按 `lcm(kernel, kpool×16)` 对齐；SFA C8 按打包字节规划并封顶到覆盖状态的对齐下限 | 同 `v0.30.0`（`patch_mamba_config.py` 对齐规则一致） | GLM 分支让 MLA 页装下 KDA 整份状态，按 128 取整得 640 |
| 异构模型分组 | 无 GLM 布局 | 无 GLM 布局；通用路径具整块分配兜底 | `glm5next/cache_config.py` 与 `deepseek_v41/cache_config.py` 双专线规划 | 同 `v0.30.0`，新增 EAGLE 组标注与 `qwen4_exp` MTP 分支 | patch 中的五组布局 |
| 调度粒度 | CP 分支取 `lcm×DCP×PCP`，其余走上游 | CP 分支只处理 DCP | 对 GLM 先剔除私有组再算调度/哈希（`_ascend_resolve_kv_cache_block_sizes`）；DeepSeek-V4.1 单独处理 | 退役 `_ascend_resolve_kv_cache_block_sizes`，由上游与各模型配置承接 | GLM 取 `lcm×DCP×PCP`，前缀或 connector 启用时另算哈希 |
| 块大小字段回写 | 取所有组最小值 | 取所有组最小值 | 先选可用于前缀复用的组取最小；无此类组才退回全部组 | 同 `v0.30.0` | 取所有组最小值，得 4 |

参数定义与模式默认对照：

| 参数 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` | 迁移时注意 |
|---|---|---|---|---|---|
| `block_size` | 输入 None，构造补 16，正整数 | 相同 | 相同 | 相同 | 模型可改写，640 保留旧 GLM 条件 |
| `kv_cache_dtype` | auto；枚举见上文 | 加 `int4_per_token_head` | 再增 `nvfp4_ds_mla`、`nvfp4_4over6` | 同 `v0.30.0` | 枚举存在不证明 Ascend GLM 可用 |
| `mamba_block_size` | None；正整数及后端约束 | 相同 | 相同 | 相同 | 最终赋值取决于模型补丁 |
| `mamba_cache_mode` | 字段 none；开前缀且输入 none 时按能力选 all/align | 相同 | 开前缀且输入 none 时统一选 align | 同 `v0.30.0` | 显式 all 仍需模型支持，不可只看字段默认 |
| `disable_hybrid_kv_cache_manager` | None，按运行配置决定；可显式布尔 | 相同 | 相同 | 相同 | None 不代表恒定 False |

日志有助于辨认对齐分支：旧通用分支使用 `…to ensure that attention page size is >= mamba page size.`，专用镜像使用 `Setting GLM-5 logical attention block size…`，`v0.30.0` 与 `main` 的模型分支使用 `…to align MLA, recurrent-state, and compressed indexer cache pages.`。多个提交可沿用同一句话，定位版本仍须同时保存安装提交与有效配置。

分配侧的跨版本差异（主要影响普通注意力与稀疏 MLA，GLM 专用路径不经过它们；`db701c1f` 与 `v0.23.0` 一致）：

| 项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 普通路径每层字节预算 | `KVCacheTensor.size` 再按 K/V 切分 | 同 `v0.23.0` | `num_blocks × page_size_bytes`，再按布局切分 | 同 `v0.30.0` |
| sleep mode 的 KV 内存池边界 | 包住整个 KV 初始化 | 同 `v0.23.0` | 只包原始缓冲申请，reshape/绑定及持久元数据留在外面 | 同 `v0.30.0` |
| 普通注意力块张量布局 | 固定轴序 | 同 `v0.23.0` | HND/LBHNC 布局调换块内位置轴与头轴 | 同 `v0.30.0` |
| 稀疏 MLA 的 indexer | 不单独报规格，由 `IndexerWrapper` 顶替 | 独立 `AscendSFAIndexerCacheSpec` | 保留独立规格；indexer 视图按该规格 `block_size` 塑形 | 同 `v0.30.0`；勿混用主 MLA 存储块长 |
| 昇腾主 MLA 页字节属性 | 覆写 `page_size_bytes` | 覆写 `real_page_size_bytes` | 真实页以 `get_storage_block_size` 及精度/缩放字段计 | 同 `v0.30.0` |
| 主机驻留标记 | 无 `store_on_host` 字段 | 有，默认 False | 有，默认 False | 有，默认 False |
| 普通 Mamba 页视图 | 普通分支按连续区域切状态 | 同 `v0.23.0` | 共享填充页与不共享原始张量的 hybrid Mamba 均建按页步长视图 | 保留共享填充页按页步长视图 |

最后一行比较的是 Mamba 具体分支，不等于判断整个版本“有没有非连续张量”。`v0.30.0`（含前置 `rc2`）的 combined K/V 路径还在形状为五维、首维为 2 且元素数匹配时建立 block-first 视图，保留原分配和步长；页内有填充时须核对实际 `shape`、`stride` 和 `offset`。

### 源码位置

| 要找的 | 位置 |
|---|---|
| 规格基类、普通注意力、MLA、递推状态的页算法 | `vllm@0fc695fc:vllm/v1/kv_cache_interface.py`：`KVCacheSpec` L96、`AttentionSpec` L159、`MLAAttentionSpec` L353、`MambaSpec` L607 |
| 缓存组、分配描述、KV 配置 | 同文件 L829–L871：`KVCacheTensor`、`KVCacheGroupSpec`、`KVCacheConfig` |
| 上游分组、统一页大小、等大分组、共享显存 | `vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py`：`get_kv_cache_groups` L1629、`unify_kv_cache_spec_page_size` L1029、`_get_kv_cache_groups_uniform_page_size` L1074、通用分配 L1300–L1326 |
| 多卡取最小块数、调度粒度、字段回写 | 同文件 L2072–L2085、`resolve_kv_cache_block_sizes` L593；`vllm/v1/engine/core.py` L279–L285；`vllm/v1/core/kv_cache_coordinator.py` L82–L88 |
| 递推状态规格的块大小与草稿页 | `vllm/model_executor/layers/mamba/abstract.py` L44–L60；`vllm/model_executor/models/config.py` L382–L394 |
| 默认块大小与昇腾刷新逻辑 | `vllm/config/cache.py` L230–L244；`vllm-ascend@db701c1f:vllm_ascend/utils.py` L1396–L1432；先后顺序：`vllm/config/vllm.py` 的 `__post_init__` 先在 L856 调混合模型配置检查，后在 L1335 调平台 |
| GLM 配置补丁：逻辑块、目标页、KDA 组块大小 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py` L11、L44–L56、L125–L168、L185–L225 |
| 逐层收集规格 | `vllm_ascend/worker/model_runner_v1.py` `get_kv_cache_spec` L5124–L5267 |
| GLM 三份 MLA 侧规格、KDA 状态形状 | `vllm_ascend/ops/indexer_kpool_mla.py` L121–L134；`vllm_ascend/models/glm5_next.py` L295–L362；`vllm_ascend/core/kv_cache_interface.py` L288–L352；`vllm_ascend/ops/kimi_kda_state.py` L9–L32 |
| 两档页、五个组、每块号字节与共享显存 | `vllm_ascend/patch/platform/patch_kv_cache_utils.py` L104–L228、L459–L548、L664–L698 |
| GLM 调度粒度与哈希粒度 | 同文件 `_ascend_resolve_kv_cache_block_sizes` L332–L396 |
| worker 申请原始显存、MLA 页切 kernel 块 | `vllm_ascend/worker/model_runner_v1.py` L4097–L4132、L4484–L4528；`vllm_ascend/attention/indexer_kpool_mla_v1.py` L38–L66 |
| 版本对照 | `vllm-ascend@2c59ff10` 的 `patch_mamba_config.py` L90–L110、`patch_kv_cache_utils.py` L112–L147；`vllm-ascend@2ed6cbba` 的 `patch_kv_cache_utils.py` L28–L62；`vllm-ascend@baa023ad` 的 `models/glm5next/cache_config.py` L90–L117、`patch_kv_cache_utils.py` L82–L138、`patch_mamba_config.py` L110–L125；`vllm@84030bbe:vllm/v1/kv_cache_interface.py` L862–L881 |


多缓存组的调度粒度也有版本差别：v0.23 维护快照在 DCP 或 PCP 不为 1 时，取各组块长的最小公倍数，再乘 DCP 和 PCP；启用前缀缓存时，哈希粒度取最大公约数。所列 v0.26 快照的对应分支只在 DCP 不为 1 时进入，也只乘 DCP。

**正文证据索引。** 规格基类与各类页算法见 [C1][C2][C3][C4]；上游分组、统一页大小与共享显存见 [C6][C8][C9]；多卡取最小块数见 [C10]。调度粒度与字段回写对应来源 11、14；递推状态的块大小与草稿页对应 15、39；默认 16 对应 16，教程没有块大小参数、最大长度 133,120 对应 [S42]。GLM 配置补丁对应 17–19；逐层收集与缓存角色对应 20；indexer K 与尾状态规格对应 22、40；两档页、五个组与每块号的共享显存对应 24–26；GLM 调度与哈希粒度对应 27；worker 按原始字节申请、不拆 K/V、MLA 页切 kernel 块对应 28–30。

正文算式各自采用以下推导口径：

- 两档页：MLA 与 indexer K 的页按「存储块位置数 × 头数 × 头维 × 字节」算，KDA 与尾状态取所在档的最大页。[D]
- 五种 block_size 的换算：kernel 块数、indexer 条数、最小公倍数与回写的最小值都由五个组的三种块长直接算出。[D]
- 补齐日志的百分比按补丁里的公式代入大页与 KDA 状态，打印保留两位小数。[D]
- 两档页相差 16 倍，是大页除以小页。[D]
- 各卡规格相同，由 MLA 与 indexer 缓存不按 TP 切、KDA 状态按头切推出。[D]

**待核：缺运行时材料。** 两档页、五个组、块大小回写成 4 和两行启动日志都是按固定源码静态推出的，还缺专用镜像上的启动日志和 KV 配置转储来确认；main 上逻辑块仍为 640 也是静态推算，未在 main 镜像上实跑。

- 来源 44 与18为相同的目标页计算；45–46分别对应上述旧版CP调度粒度分支。
- 参数来源：47–48 为基线默认、枚举与范围；49–51 为模式改写、混合管理决策和联动检查；52–53 为 CLI 入口；54–55 说明 GLM 主缓存固定 BF16、配置阶段仍读取缓存精度；56–60 对照 v0.26/main 的字段和 Mamba 策略。Ascend 对显式 Mamba 块长的覆盖见来源 19；块长、页字节与预算使用前文链接的统一推导。
- 启动先后见来源 64：先向 worker 收规格，再量可用显存，然后进入引擎的分组与容量规划；不是先完成分组再做量测。

- non-contiguous KV cache 的物理页、步长、按行 gather/scatter、MRV1范围和组合验证要求见官方设计来源65；示意20个数、64B页由同一地址规则演算。rc2对应分支的临时观察点为`[non-contiguous-kv-cache]`日志，记录shape、stride、offset与contiguity；四版路径区别见上表。[S65]
- 来源66补足配置入口到hybrid检查的调用；67落实AscendStore与MultiConnector子项识别。来源68–70分别是rc2逻辑块对齐、调度粒度和实际GLM分组；71–76是上游规格、字段与Mamba模式；77–78显示rc2/main回写块大小时先选可用于前缀复用的组，仅无此类组时才退回全部组。
- 分配版本表的补充依据：79–82对应普通路径的每层字节预算；83–86对应旧版整段初始化与新版仅原始分配进入sleep内存池；87–91对应主MLA属性、主机驻留与独立indexer规格，92–93对应main/rc2实际indexer视图。普通布局轴序与跨层共享另见[KV cache版本表](kv-cache.md#版本差异)。
- 来源94补足上游Mamba块长不同于配置块长时退回调度粒度的分支；95落实KV传输开启后才做首地址对齐；96是布尔参数生成正、反两个CLI开关的实现。97核对v0.26仍取全部组最小块长；98给出rc2按排序后的KDA清单分组的实际调用；99补足main的MLA规格字段与合并条件。
- 100–104对照四版Mamba视图与rc2 combined K/V视图分支；105–106显示共同粒度用于缓存留存和命中对齐，107是Mamba align的另行分块，并跳过普通decode。
- `v0.30.0`（`c09d3e20`）的 GLM 两档页对齐与组规划、`_ascend_resolve_kv_cache_block_sizes` 与 `patch_mamba_config` 见来源 108–111；`main`（`8d6180e2`）的对应规划、EAGLE/`qwen4_exp` MTP 扩展及 `deepseek_v41` 专线分流见来源 112–115。
