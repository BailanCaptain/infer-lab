---
id: kv-cache-spec
title: "KV cache 规格：每层的状态怎样换算成页、编进缓存组"
type: concept
summary: KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的说明：一块覆盖多少个位置、每个位置或每份状态占多少字节。管理器据此算出一页多大，再把页大小和管理方式相同的层编成缓存组。GLM 的四类状态被对齐成两档页、编成 5 个组；本页也是 block_size 五种含义的唯一出处。
aliases: [KV Cache Spec, KVCacheSpec, KV 缓存规格, KV Cache 规格, KV Cache 声明, 按层 KV 规格声明, AttentionSpec, MLAAttentionSpec, MambaSpec, 缓存组, cache group, KV cache group, page size, 页大小, 两档页, block_size 五义, block_size 的五种含义, 逻辑块, kernel 块, 调度块]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L96-L131
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L159-L200
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L353-L384
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L607-L645
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L829-L871
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1629-L1695
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1029-L1066
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1074-L1193
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L1300-L1326
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2072-L2085
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L633
  - vllm@0fc695fc:vllm/config/vllm.py#L847-L856
  - vllm@0fc695fc:vllm/config/vllm.py#L1335-L1335
  - vllm@0fc695fc:vllm/v1/engine/core.py#L279-L285
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L60
  - vllm@0fc695fc:vllm/config/cache.py#L230-L244
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L125-L168
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L185-L225
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5124-L5267
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L121-L134
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L295-L362
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L104-L228
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L459-L548
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L664-L698
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L396
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4097-L4132
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L4484-L4528
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L38-L66
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L90-L110
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L112-L147
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L28-L62
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/cache_config.py#L90-L117
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L82-L138
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L125
  - vllm@84030bbe:vllm/v1/kv_cache_interface.py#L862-L881
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L82-L88
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L382-L394
  - vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L288-L352
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1432
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: kv-cache, kind: builds-on, note: 先弄清要保存哪几类状态、为什么保存，再看它们怎样被写成规格、换算成页 }
  - { to: glm-5-3-flash-two-node, kind: builds-on, note: 逻辑块 640、每块号 8,355,840 B、3,855 块三个数的推导都在部署页，本页只用结论 }
  - { to: linear-attention, kind: builds-on, note: KDA 一份状态有多大、为什么每组每请求 4 块，在线性注意力页推导 }
contradicts: []
updated: "2026-09-28"
origin: direct
---

## 一层要存的状态，怎样变成缓存池里的一页？

**KV cache 规格（KVCacheSpec）是每个要存状态的层交给缓存管理器的一张说明：一块覆盖多少个位置、每个位置（或每份状态）占几个字节、用什么精度。** 缓存管理器是调度侧给请求发块号、登记谁占着哪块的组件；它从这张说明里算出「一页」，也就是这一层为一个块号占多少字节，再把页大小和管理方式都相同的层编成一个 KV cache group（缓存组），同组的层共用一张块号清单。

先认三个词。**块（block）** 是分配的单位：对按位置增长的状态，一块覆盖若干个连续位置；**块号** 是池里一段空间的编号。**页（page）** 是一个块号落到某一层上的那段显存。**缓存组** 是共用一张 [block table](block-table.md)（请求内逻辑位置到块号的映射表）的一批层：同组各层用同一串块号，各自在自己的显存里找到对应的页。

```wiki-diagram
file: kv-cache-spec
```

图从左往右读三步。第一步，每层按自己要存的东西交规格。第二步换算成页，算法有两种：**按位置增长的状态**一页等于「一块的位置数 × 每个位置的字节数」，例如 [MLA](mla.md) 为每个位置存的压缩表示，以及 indexer（稀疏注意力里给历史位置打分、挑出要读哪些位置的模块）压缩后的 K；**每条请求只有一份的状态**不随长度变，一页就是整份状态，例如 [KDA](linear-attention.md) 线性注意力的卷积历史和递推矩阵，以及 indexer 还没凑满一条的尾巴。第三步，页补到统一的档位，再按管理方式分组。

为什么一定要补齐？不同组的几层会共用同一片连续显存，块号 b 在这片显存里就是第 b 页；同一时刻一个块号只发给一个组，所以几层轮流用同一片显存也不会撞车。前提是这几层的页一样大，否则同一个块号在各层指向的字节范围对不上。GLM-5.3-Flash（后文简称 GLM）因此只留两档：**大页由 MLA 定，KDA 状态补到大页；小页由 indexer K 定，尾状态补到小页**。图中斜线就是补出来的空白，是统一页大小的代价。

## 为什么要先报规格再分配？代价在哪？

**分配之前必须先知道单价。** 引擎启动时先让每张卡上的每一层报规格，再量出装完权重、跑完一次假数据前向后还剩多少显存（见 [KV cache 显存预算](kv-cache-memory-profiling.md)），用「一个块号在所有层上合计占多少字节」去除，得到能切几块；最后把块数发回各卡，各卡照着规划申请显存、切成页。报价和分配是两趟，中间隔着一次显存测量，顺序倒不过来。一个引擎管着多张卡时，各卡算出的块数可能不同，引擎取其中最小的发回去；每张卡在切页时还会拿自己手上的字节数反推块数，确认不少于这个数。

**为什么按层报，不按模型报？** 同一个模型里的层本来就不一样。GLM 的 45 层主干里，34 层 KDA 存固定大小的递推状态，11 层稀疏 MLA 按位置存压缩表示，谁也替不了谁报价。别的模型还有两种情况也要逐层看：有的层借用另一层的 KV（跨层共享），它不报规格，也就不占块，省下的显存正是从这里来；草稿模型里只存 hidden state 的层报一种派生规格，单独成组。

规格统一的代价落在三处：

- **补齐的空白。** KDA 一层一份状态补到一个大页，约 14.4% 是空白，合计多占多少显存见后面的[开销](#开销和什么时候别开)。
- **块变大。** 为了让一个 MLA 页装得下整份 KDA 状态，逻辑块长到 640 个位置。一条只有 4 个 token 的请求 R1（主线的[示例请求](one-request.md#示例请求-r1-与官方双机部署)）第一步就占 15 个块号，full 组那一块只用了 4 格，见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。
- **耦合。** 块长由最大的那份固定状态倒推出来；任何一层的状态变大（比如[投机解码](speculative-decoding.md)每步先草拟、再一起验证的候选 token 变多，或者卷积历史变长），逻辑块都跟着变长，所有按位置存的层一起受影响。

相邻的几个概念各管一件事：

| 概念 | 回答的问题 | 什么时候定 |
|---|---|---|
| 规格 | 这一层一页多大、一块覆盖几个位置 | 启动时每层报一次 |
| 缓存组 | 哪些层共用一张块号清单 | 启动时由引擎分组 |
| block table | 某条请求在某个组里用了哪些块号 | 每步调度时更新 |
| 显存预算 | 总共能切出多少个块号 | 启动时量一次 |

## 规格有哪几类，各自怎样算一页？

**所有规格都回答同两个问题：一块覆盖几个位置（block_size），一页多少字节。** 上游 vLLM 的规格是一个类家族，基类规定这两个量，外加两项：存储块长（一页实际存几条，默认等于块大小，MLA 一类规格带压缩比时变成「块大小 ÷ 压缩比」），以及「这一层最多要多少显存」，用来在启动时检查最长的请求放不放得下。每个子类按自己存的东西算一页：

| 规格类 | 存什么 | 一页的字节数怎么算 |
|---|---|---|
| 普通注意力（AttentionSpec 及其 full、滑窗等子类） | 每个位置的 K 和 V | 2 × 块大小 × KV 头数 × 头维 × 每个数的字节；2 是 K、V 各一份 |
| MLA（MLAAttentionSpec） | 每个位置一份压缩表示，不分 K、V | 存储块的位置数 × 头数 × 头维 × 每个数的字节；存储块 = 块大小 ÷ 压缩比 |
| 递推状态（MambaSpec） | 卷积历史、SSM 矩阵等几份固定形状的状态 | 每份状态「各维相乘 × 每个数的字节」再相加，和块大小无关 |
| hidden state 缓存 | 草稿模型要回看的隐藏向量 | 从 MLA 规格派生，单独成组，页补到和其他组一样大 |

表里有三点要记住。**第一，MLA 没有那个 2。** 它每个位置只存一份压缩表示，所以同样的头维，一页只有普通注意力的一半；详见 [MLA](mla.md)。**第二，MLA 规格多了一个压缩比。** 压缩比大于 1 时，一块里的位置先按压缩比合并成更少的条目再存，一页只存「块大小 ÷ 压缩比」条；GLM 的 indexer K 就是这样存的。**第三，递推状态的块大小不决定页大小。** 递推状态的页就是整份状态；块大小只说明「一页替多少个位置负责」。[前缀缓存](prefix-caching.md)（把相同前缀已经算好的状态借给后来的请求复用）关闭时，上游把它设成最大请求长度，意思是任何长度的请求都只要一页；开了投机解码（例如用 MTP，也就是模型自带的多 token 预测层来草拟候选），还要为每个草稿位置各多留一页。

**每一类都可以带一个「补齐后的页大小」。** 设了它，一页就按补齐后的大小算，但不能比真实需要的小，否则启动时直接断言失败。页对齐就是靠这个字段：状态本身不变，只是页后面多出一段空白。

**量化和卸载改的也是规格里的字段。** [KV cache 量化](kv-cache-quantization.md)改的是规格里的精度和量化方式，页字节随之变小，显存账也就跟着变；v0.26 和 main 的稀疏 MLA 规格还多一个「放在主机内存」的标记，由[稀疏 KV 卸载](kv-cache-sparse-offload.md)打开。改在规格上，就等于改在了显存账上。

昇腾在这个家族上加了自己的子类。稀疏 MLA 的普通路径由昇腾重建成自己的 MLA 规格，因为它把压缩表示和位置编码段拆开存，和上游的拆法不同；GLM 的 indexer 尾状态用昇腾的滑窗 MLA 规格，FP32 存储。GLM 的三份注意力侧缓存不走这条普通路径，下一节讲。

## 页大小不同的层，怎样放进同一个池？

**上游的通用做法是把页统一成一样大，再把层切成层数相同的组。** 这是 vLLM 处理混合模型的通用路径，只有 DeepSeek V4 等少数模型和 GLM 走自己的分支：

1. **统一页大小。** 各层页大小不同时，找出最大的页，把其他层的块大小按倍数放大，直到页一样大；放不成整数倍就报错退出。
2. **按规格分类、切成等大的组。** 规格完全相同的层归一类；各类再切成层数相同的组，组里的层隔几层取一层，不取连续的一段。例如 10 层 full 注意力加 20 层滑窗注意力，切成 3 组、每组 10 层。
3. **几组共用几片显存。** 每组有几层，就开几片显存；每片由每组各出一层共用。块号在同一时刻只属于一个组，所以一片显存里的第 b 页不会同时被两层写。
4. **块数 = 可用显存 ÷（一页的字节 × 片数）**，每片显存的大小就是「一页 × 块数」。

注意力层和递推状态层混在一起时，页对齐更早就开始了：配置检查阶段就要把注意力的块大小定下来，昇腾的补丁替换了这一步（GLM 以外的混合模型怎么对齐，见[怎么开](#怎么开)）。

GLM 不能直接套上游这套做法。它的 indexer 页和尾状态页远小于 MLA 页，如果按上游规则全部统一到最大页，小页要放大十几倍；上游又假设所有组的页一样大。所以 GLM 用自己的补丁：**只统一到两档页，分组也按自己的规则来**。

## 放到 GLM 双机：四类状态怎样变成两档页、五个组？

下面的数字都按[官方双机部署](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、每台 8 卡，机内 TP8，两台之间 DP2。每台机器有一个引擎进程（EngineCore）带 8 个 worker，启动时各自把下面这套流程走一遍，时机见部署页的[启动过程](glm-5-3-flash-two-node.md#启动时发生了什么)。MLA 和 indexer 的缓存在 TP8 的 8 张卡上各存一份完整的，不按卡切；KDA 状态跟着头切，每卡只存自己 8 个头那份。所以同一台机器的 8 张卡报上来的规格完全相同。本节的两档页、五个组和字段回写都是按固定源码推出的：不是两档会直接报错、组数由层型决定，这些有源码硬约束；但还没有拿运行日志和 KV 配置转储核对过，见[页末待核](#源码位置)。

```wiki-diagram
file: kv-cache-spec-flow
```

上两排是启动时走一次的规划，下排是之后每条请求都要经过的站点，它们只读启动时定下的组和页。

### 配置阶段：逻辑块先定成 640

**逻辑块的长度不是配置出来的，是从 KDA 状态倒推出来的。** 官方教程没有写 `--block-size`，配置对象先填上默认值 16。上游构造汇总配置时，先跑混合模型配置检查——昇腾替换掉的那一版在这里把块大小写成 640；[平台](npu-platform.md)更晚才被调用，通用规则里「不是 128 就改回 128」那一步遇到混合模型会跳过，640 因此留下。真正定值的就是这个配置检查，它在 GLM 分支里做三件事：

1. **定逻辑块。** 下限 = 128 × 向上取整（KDA 一层一份状态的字节 ÷（128 × MLA 每个位置的字节）），意思是「凑够几个 128 位置的小块，一个 MLA 页才装得下整份 KDA 状态」。再和用户给的值（没给就是 16）取较大者，向上取到 128 的倍数，得到 640。代入数字的推导见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)，这里不重算。
2. **定 KDA 的目标页。** 取「一个 MLA 页」和「一份 KDA 状态」中较大的那个，也就是大页本身；KDA 状态补到这个大小。
3. **定 KDA 组的块大小。** 设成最大请求长度 133,120（教程里的最大长度），也就是一条请求一页；只有前缀缓存打开、并且 KDA 缓存模式是对齐模式时，才改成逻辑块长度。

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

**四份规格被对齐成两档：MLA 和 KDA 共用大页，indexer K 和尾状态共用小页。** 分组补丁先按角色把规格分成两类，每类取最大的页，写进各自的「补齐后页大小」：

```calc
title: 四份规格对齐成两档页
MLA 一页 = 640 × 512 × 2 B = 655,360 B
KDA 一页 = max(655,360 B, 561,152 B) = 655,360 B
indexer K 一页 = 640 ÷ 4 × 128 × 2 B = 40,960 B
尾状态一页 = max(40,960 B, 4 × 256 × 4 B) = 40,960 B
> 561,152 B 是一层一份 KDA 状态（每卡），由来见线性注意力页
```

对齐之后编组，共 5 个：

- **full 组（1 个）。** 12 份 MLA latent 和 12 份 indexer K 交错排进同一组，每对里 MLA 排在前面。调度器拿组里第一份规格当代表，所以这一组按「历史全部保留」的 full 注意力方式分块；两份缓存拿到的是同一串块号。
- **尾状态组（1 个）。** 12 份尾状态，按滑窗方式管理，只留最近的几块。
- **KDA 组（3 个）。** 34 层 KDA 按层号恢复出排布：连续的 KDA 层最长一段是 3 层，于是按层号每隔 3 层取一层，分成 3 组，层数 12、11、11。同组各层存储格式相同，共用一张块号清单。

补丁在分组时还做几条检查：三份缓存的层号必须一一对应；逻辑块要能被压缩比 4 整除；尾状态的块大小和滑窗宽度都必须等于压缩比；混合缓存管理器必须开着。和上游比，**GLM 不是把全模型的页补成一样大，而是两档各自统一**，各组的页也就不全相同；上游「所有组页大小一致」的假设在这里不成立，所以分配也换成了补丁里的专用逻辑。

### 一个块号在两档页里各占一格

**一个块号同时对应 12 片大页显存和 12 片小页显存里各一页。** 分配时开 24 片显存：第 i 片大页由第 i 个 MLA 层和 3 个 KDA 组各自的第 i 层共用，第 12 片只剩 MTP 的 MLA 层和 KDA 第 0 组的第 12 层（主干第 44 层）；第 i 片小页由同一层的 indexer K 和尾状态共用。块号 b 在每片里都指向第 b 页。一个块号同一时刻只发给一个组，所以共用一片显存的几层不会撞车；代价是**占住一个块号就占住了 24 片里各一页**，不管是哪个组在用。

一个块号合计 8,355,840 B、折合每 token 13,056 B，按主线算例每卡能切 3,855 块；三个数的推导都在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)，两种块数口径见[两种块数各在什么时候用](glm-5-3-flash-two-node.md#两种块数各在什么时候用)。

各卡拿到规划后，每片显存按原始字节一次申请；配了 KV 传输时首地址按 2 MiB 对齐。GLM 这条路径**不把一层拆成 K、V 两条**，同一片的几层直接绑到同一块原始显存上，切形状时才套上各自的精度。MLA 页被看成「块数 × 5」个 128 位置的 kernel 块；indexer 页里的 160 条正好符合 [CANN](cann-hccl.md)（昇腾的算子与运行时软件栈）索引算子对块长的要求（16 的倍数、不超过 1024），不用再拆。

请求来了以后，[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)按这 5 个组给 R1 发块号：full 组 1 块、尾状态组 2 块、KDA 三组各 4 块，共 15 块；[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)再把 full 组的逻辑块号展开成 kernel 块号，见[块表](block-table.md#分配块与内核页可能不同)。

## block_size 到底指哪一个？五种含义

**同一个词在五处指不同的东西，而且同一个配置字段在启动过程中被改写过两次：先是默认的 16，配置阶段改成 640，KV 配置算完又改成 4。** 读日志或代码里的 block_size，先看它属于哪个阶段、哪个组，再对照下表。知识库其他页提到这五种值时都链接到这里。

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

**KDA 组的块（133,120）** 表示「一页替多长的序列负责」。设成最大请求长度，意思是任何请求的 KDA 状态都只要一页，和它有多长无关；每组每请求实际拿 4 块，是这一页加上 3 个草稿位置各一页，推导见[线性注意力](linear-attention.md#状态怎么占到块号上)。打开前缀缓存并使用对齐模式时，它改成逻辑块长度，状态才能按块留存、被别的请求复用。

**调度器的块（133,120）** 是调度侧的 token 对齐单位。调度器和缓存协调器要求它能被每个组的块大小整除，前缀缓存命中的长度也按它取整。它取各组块大小的最小公倍数；昇腾的补丁再乘上下文并行规模，本部署为 1。本部署没开前缀缓存，也没配 KV connector（vLLM 里把 KV 在实例之间、或在显存和外部存储之间搬运的插件，[PD 分离](pd-disaggregation.md)和 [Mooncake](mooncake-connector.md) 都靠它），用不到按它取整的命中逻辑，它主要是启动时的一条整除约束。

**第六个数不是新含义，而是被改写后的字段。** 引擎算完 KV 配置、让各卡初始化之前，会把配置里的 block_size 字段改写成各组块大小的最小值，本部署是尾状态组的 4。所以这一步之后再读这个字段，拿到的是 4，不是 640。昇腾补丁算调度粒度时特意不用这个回写值，而是直接取各组块大小的最小公倍数：按上游的兜底逻辑，4 会被当成缓存块大小，细粒度哈希随之被关掉。

五种值之间的换算只有下面几步：

```calc
title: 五种 block_size 之间怎样换算
逻辑块里有几个 kernel 块 = 640 ÷ 128 = 5
逻辑块压成几条 indexer K = 640 ÷ 4 = 160
调度器的块 = lcm(640, 4, 133120) = 133,120
引擎回写的字段值 = min(640, 4, 133120) = 4
> 133,120 = 208 × 640，也是 4 的倍数，所以最小公倍数就是 KDA 组的块
```

还有两个容易混进来的数不算 block_size：160 是 indexer 页里的条数，源码叫存储块长；16 是配置对象的默认值，GLM 补丁生效后就不再出现。

### 打开前缀缓存或 KV connector 以后

**调度粒度之外还会多出一个哈希粒度。** 前缀缓存或 KV connector 打开时，GLM 补丁用显式给出的哈希块长，没给就取各组块大小的最大公约数，并检查每个组的块大小都能被它整除；两者都关时，哈希粒度直接等于调度粒度。配了昇腾的 KV 存储 connector，KDA 的缓存模式还会被改成对齐模式。

三种粒度各管一件事：**哈希粒度决定按多细的单位识别相同前缀，调度粒度约束每次推进和命中的边界，kernel 块负责算子里的具体寻址。** 它们的数值可以不同。细粒度哈希也不等于能在每个哈希边界恢复全部混合状态：MLA 历史、indexer 尾巴和 KDA 状态必须停在同一个有效边界上，细节见[前缀缓存](prefix-caching.md#哪些块能被共享)。

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

### 怎么开

规格不需要打开，模型加载完就自动收集一遍。上游引擎初始化 KV cache 时向各 worker 要规格，昇腾的 `NPUModelRunner.get_kv_cache_spec()` 逐层分发：

- 跨层共享 KV 的层记进 `shared_kv_cache_layers` 后直接跳过，不产生规格，也不占块；
- 普通注意力交给上游造规格；GLM 以外的稀疏 MLA 重建成 `AscendMLAAttentionSpec`，因为昇腾把压缩表示和位置编码段分开存；
- 带 `cache_role` 的 GLM 缓存原样收下：主缓存和 indexer 是上游 `MLAAttentionSpec`（`compress_ratio` 分别为 1 和 4，`model_version="glm5_next"`），尾状态是 `AscendIndexerKPoolStateSpec`；
- 草稿模型的 cache-only 层重建成 `HiddenStateCacheSpec`，分组时单独成组；
- `MambaBase` 层最后收，每层给一份 `MambaSpec`；同时把比递推状态页小的普通注意力页补上 `page_size_padded`，GLM 的三份缓存不参与这一步。

能改变结果的参数：

- `--block-size`：GLM 分支里比 640 小的抬回 640，比 640 大的按 128 向上取整。
- `--enable-prefix-caching`：改哈希粒度；对齐模式下 KDA 组的块大小从最大长度改成逻辑块。
- `--kv-transfer-config` 用 `AscendStoreConnector` 时，`mamba_cache_mode` 从 `none` 改成 `align`。
- `--disable-hybrid-kv-cache-manager`：GLM 分组直接报错，见下一节。
- `--kv-cache-dtype`：不影响 GLM 的 MLA 主缓存，那里写死 BF16。

GLM 以外的注意力加递推状态混合模型，走同一个配置补丁的通用分支：注意力块大小取 128 的倍数，让「一个位置的 K 字节 × 块大小」恰好等于递推矩阵那份状态，凑不成相等就报错；递推状态的页补成「一整页注意力 + 一份卷积状态」，各卡收齐规格后，再把比它小的注意力页也补到这个大小（上面收集规格的最后一条），两种页最终一样大。用户显式给了更小的块大小时，这条分支同样会把它改大，不报错。

按固定源码推算，GLM 补丁生效时启动日志应出现下面两行（第二行的百分比是 KDA 页里空白的比例）。这是静态推算，还没有在专用镜像上实跑核对，见页末待核：

```text
Setting GLM-5 logical attention block size to 640 tokens so the contiguous MLA page covers the complete KDA state.
Padding mamba page size by 14.38% to ensure that mamba page size and attention page size are exactly equal.
```

### 会报什么错

- **GLM 分组补丁。** 关了混合缓存管理器：`GLM-5's paired MLA/indexer and sliding state layout requires the hybrid KV cache manager.`；三份缓存缺一份：`GLM-5 cache layout requires main MLA, compressed indexer, and compressor-state specs.`；层号对不上：`GLM-5 MLA, indexer, and state cache layer indices do not match.`；逻辑块不能被压缩比整除：`GLM-5 logical block size must be divisible by the indexer compression ratio`；尾状态块长或窗口不等于压缩比：`GLM-5 indexer state block/window size must equal the paired compression ratio`；分配时两档没对齐：`GLM-5 cache specs were not aligned to two physical page sizes.`
- **配置补丁。** 目标页比 KDA 状态还小：`The padded hybrid cache page is smaller than the Mamba/KDA state`；GLM 以外的混合模型凑不齐页：`Cannot align ssm_page_size and attn_page_size.`
- **worker 切页。** MLA 页带了补齐：`GLM-5 main MLA must define the complete large physical page before virtual block splitting`；逻辑块不是 128 的倍数：`GLM-5 logical block size must be divisible by the SFA kernel block size`；规划的层和实际申请的层不一致：`GLM-5 KV cache tensors are not correctly initialized`；申请到的字节不是页大小的整数倍，或按自己的字节反推出的块数少于引擎发下来的块数：`raw_tensor.numel() % page_size_bytes == 0`、`num_blocks >= kv_cache_config.num_blocks` 两条断言。
- **上游。** 补齐后的页比真实页小：`assert self.page_size_padded >= ...`；通用路径统一页大小失败：`The page size of the layer is not divisible by the maximum page size. Cannot unify by adjusting block_size.`
- **打开前缀缓存或 connector 时。** 哈希块长不能整除某个组：`Invalid hash_block_size=...; all GLM-5 KV cache group block sizes must be divisible by it.`

### 开销和什么时候别开

规格本身不占显存，占显存的是它推出来的页和块：

- **补齐。** KDA 页约 14.4% 是空白，34 层、每请求 4 页一起放大，一条请求的 KDA 状态占约 85 MiB，推导在[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)。尾状态页 9/10 是空白，但一页只有 40 KiB。
- **块号不分组计价。** 一个块号在大页和小页里各占一格；KDA 组占用某个块号时，小页那一格空着。占住一个块号就是 7.969 MiB，见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。
- **别把块大小调大。** full 组按块分配，块越大，短请求留下的空白越多；KDA 页要补到和 MLA 页一样大，块越大补得越多。
- **前缀缓存默认关着。** 打开后 KDA 组的块大小、哈希粒度和状态留存方式都会变，收益与代价见[前缀缓存](prefix-caching.md#glm-双机上它开着吗)。

### 版本差异

钉点同 [KV cache 的版本差异](kv-cache.md#版本差异)：v0.23 为 Ascend 2c59ff10 / vLLM 0fc695fc，v0.26 为 Ascend 2ed6cbba / vLLM 568afb3a，main 为 Ascend baa023ad / vLLM 84030bbe。**本页 GLM 数字取自专用镜像 Ascend db701c1f，控制流仍按 vLLM 0fc695fc。** v0.23 和 v0.26 里没有 GLM-5.3-Flash 的模型文件，下表这两列只说明混合模型在那两版上走哪条路径。

| 项 | v0.23 | v0.26 | main | 本页镜像 db701c1f |
|---|---|---|---|---|
| 上游规格家族 | MLA 规格带压缩比和模型版本字段 | 同 v0.23 | 重构：MLA 规格不再带压缩比，新增尾状态专用规格（每请求固定 1 块，不参与前缀缓存） | 同 v0.23 |
| 逻辑块怎样定 | 无 GLM 分支，只有通用混合对齐：块长取 128 的倍数，注意力页恰好对上递推页，凑不齐报错；日志写 `…to ensure that attention page size is >= mamba page size.` | 同 v0.23 | 按 lcm(128, 4 × 16) = 128 对齐，下限仍由 KDA 状态推出，状态不变时也是 640；日志改为 `…to align MLA, recurrent-state, and compressed indexer cache pages.` | GLM 分支：MLA 页装下 KDA 状态，按 128 取整；日志以 `Setting GLM-5 logical attention block size` 开头 |
| 两档页与五个组 | 无；昇腾分组补丁只处理上下文并行的调度粒度和 DeepSeek V4 分组 | 无；多了一个整块分配的兜底分组 | 挪到 glm5next 模型目录下的缓存规划文件，仍是两档页加按层交错的 KDA 组 | 分组补丁里的 GLM 分支 |
| 调度粒度 | 昇腾只在上下文并行时改写为 lcm × dcp × pcp，其余走上游 lcm | 同上，只乘 dcp | 先剔除尾状态这类不可复用的私有组，再算调度和哈希粒度 | GLM 分支：lcm × dcp × pcp；开前缀缓存或 connector 才另算哈希粒度 |
| 块大小字段回写成各组最小值 | 有 | 有 | 有 | 有 |

三套实现定块大小时打印的日志文案不同，看启动日志里这一行，就能分辨实际装的是哪份代码。

分配侧还有几处跨版本差异，主要影响普通注意力和稀疏 MLA，GLM 专用路径不经过它们；db701c1f 在这几项上与 v0.23 相同：

| 项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 一层的字节预算 | 引擎给的 `KVCacheTensor.size` 除以 K、V 切分因子 | 同 v0.23 | 自己算 `num_blocks × page_size_bytes`，同一条 `KVCacheTensor` 里每层各拿私有缓冲 |
| sleep mode 的 KV 内存池边界 | 包住整个 KV 初始化 | 同 v0.23 | 只包住原始缓冲的申请，块表和后端元数据不随睡眠丢弃 |
| 普通注意力块张量布局 | 固定轴序 | 同 v0.23 | `VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时块内轴序改变，字节数不变 |
| 稀疏 MLA 的 indexer | 不单独报规格，由 `IndexerWrapper` 顶替 | 独立的 `AscendSFAIndexerCacheSpec` | 同 v0.26，物理块长统一走 `get_storage_block_size()`，算子块长 = `block_size // tokens_per_state` |
| 昇腾 MLA 规格覆写的页字节属性 | `page_size_bytes` | `real_page_size_bytes` | 同 v0.26，物理块长走 `get_storage_block_size()`；按属性名取页大小的脚本跨版本会读到不同的值 |
| 稀疏 MLA 规格的「放主机内存」标记 | 无 | 有 `store_on_host` | 有 |

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

**正文证据索引。** 规格基类与各类页算法见 [C1][C2][C3][C4]；上游分组、统一页大小与共享显存见 [C6][C8][C9]；多卡取最小块数见 [C10]；调度粒度与字段回写见 [C11][C12]；递推状态的块大小与草稿页见 [C13]；默认 16 见 [C14]，教程没有块大小参数、最大长度 133,120 见 [S40]。GLM 配置补丁见 [C15][C17]；逐层收集与缓存角色见 [C18]；indexer K 与尾状态规格见 [C20]；两档页、五个组与每块号的共享显存见 [C22][C23][C24]；GLM 调度与哈希粒度见 [C25]；worker 按原始字节申请、不拆 K/V、MLA 页切 kernel 块见 [C26][C27]。

正文算式各自采用以下推导口径：

- 两档页：MLA 与 indexer K 的页按「存储块位置数 × 头数 × 头维 × 字节」算，KDA 与尾状态取所在档的最大页。[D]
- 五种 block_size 的换算：kernel 块数、indexer 条数、最小公倍数与回写的最小值都由四个组的块大小直接算出。[D]
- 补齐日志的百分比按补丁里的公式代入大页与 KDA 状态，打印保留两位小数。[D]
- 两档页相差 16 倍，是大页除以小页。[D]
- 各卡规格相同，由 MLA 与 indexer 缓存不按 TP 切、KDA 状态按头切推出。[D]

**待核：缺运行时材料。** 两档页、五个组、块大小回写成 4 和两行启动日志都是按固定源码静态推出的，还缺专用镜像上的启动日志和 KV 配置转储来确认；main 上逻辑块仍为 640 也是静态推算，未在 main 镜像上实跑。
