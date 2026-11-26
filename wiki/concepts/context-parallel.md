---
id: context-parallel
title: 上下文并行（CP）：怎样分位置，又怎样算完整 attention
type: feature
summary: >-
  长序列怎样分给多张卡，为什么会头尾配对；用同一组位置追踪 All-Gather、Ring Attention 和 Ulysses，演算局部结果怎样恢复完整
  attention，再对照 v0.30.0 的 Ascend PCP/DCP 路径、Qwen3 头数约束与 GLM 支持边界。
aliases:
  - Context Parallel
  - 上下文并行
  - CP
  - PCP
  - DCP
  - Prefill Context Parallel
  - Decode Context Parallel
  - 前缀上下文并行
  - 解码上下文并行
  - prefill_context_parallel_size
  - decode_context_parallel_size
  - cp_kv_cache_interleave_size
  - enable_cp
  - enable_dcp
  - enable_pcp
  - DSA-CP
  - Hierarchical CP
  - 层次 CP
  - log-sum-exp
  - AscendAttentionCPImpl
  - AscendMlaCPImpl
  - AscendAttentionDCPImpl
  - Ring Attention
  - Ulysses
  - zigzag
  - 头尾配对
chapters:
  - '15'
order: 20
sources:
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L9-L50
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L663-L721'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L751-L780'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L231-L282'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L111-L130
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L186-L197
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1774-L1794'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L403'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L114-L136'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L717-L752'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L508-L509'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L702-L729'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/context_parallel.md#L66-L103
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L348-L356'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L110-L120'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L320-L346'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L774-L782'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L120-L128'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L336-L344'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/utils.py#L195-L206'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1490-L1500'
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L51-L77
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L78-L123
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L124-L172
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L310-L320'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L125-L131'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L726-L762'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L204-L210'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1513-L1525'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L448-L453'
  - >-
    https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html
  - 'https://arxiv.org/abs/2310.01889'
  - 'https://arxiv.org/abs/2309.14509'
  - >-
    https://docs.nvidia.com/nemo/megatron-bridge/nightly/training/hierarchical-context-parallel.html
  - >-
    raw:sha256-d05316afd5f863583efbb497ab7e97f2e4720e590792b0b2c6a475111ba97982.md#L1-L765
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1700'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/pcp_manager.py#L230-L261'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/block_table.py#L251-L300'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L437-L476'
  - >-
    vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L41
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33'
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/common_cp.py#L109-L175
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/sfa_cp.py#L866-L879
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L41
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L571'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L135-L177'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1617-L1635'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L114-L136'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L727-L761'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1541-L1562'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1650-L1712'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/pcp_manager.py#L225-L250'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/block_table.py#L251-L275'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/utils.py#L320-L329'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L491-L505'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L2105-L2179'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/pcp_manager.py#L225-L248'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/indexer_kpool.py#L782-L800'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 先理解完整的评分、softmax 与 V 汇合
  - to: ascend-flash-attention
    kind: builds-on
    note: 在线 Softmax 与 LSE（log-sum-exp）分块合并的代数恒等式是 CP 跨卡汇聚局部 attention 输出的数学基础
  - to: collective-communication
    kind: builds-on
    note: 理解交换、收集与归约
  - to: block-table
    kind: builds-on
    note: 理解逻辑位置与物理存储槽位
  - to: sequence-parallel
    kind: alternative-to
    note: Megatron SP 在 TP 组内按 token 切分归一化与残差激活，attention 前须收齐；CP 则沿序列位置跨卡切分 attention 计算或 KV 历史，两者正交可叠加
contradicts: []
updated: '2026-11-26'
origin: direct
---

## 上下文并行是什么？

**context parallelism（CP，上下文并行）让多张卡分担同一条长序列的不同位置，并通过通信完成这些位置之间的 attention。** attention 是让一个位置按相关程度读取其他位置的信息。文本会切成 token，一个 token 对应模型中的一行向量；计算途中产生的这些向量称为激活。按位置分工，可以减少每张加速卡负责的 token 数及相应存储。

例如一篇输入分成 8 个 token，编号 0～7（示意）。先把前 4 个位置交给卡 0，后 4 个交给卡 1。向量乘权重矩阵叫线性投影，调整自身数值尺度叫归一化，多次投影与逐元素的非线性变换组成前馈网络（MLP）；这些都可以用本位置的数据计算。到了 attention，卡 1 上的位置 7 还需要读取卡 0 的位置 0～3，通信就发生在这里。

```wiki-diagram
file: context-parallel-overview
```

attention 中，每个位置先得到三个向量：Q（query，当前查询）、K（key，供查询匹配）和 V（value，被取回的内容）。查询与允许访问的 K 打分，经 softmax 转成总和为 1 的权重，再对 V 加权相加。普通因果自注意力规定位置 i 只能读位置 0～i，包括自己。切到不同卡以后，这个规则和计算目标保持不变。

这里分的是同一条请求的位置；[DP](data-parallel.md)主要把不同请求或样本分给不同执行组，[TP](tensor-parallel.md)主要分权重的通道。CP 可以和 TP 组合；单独使用 CP 的教学图中，各位置仍经过同一个模型的各层，权重没有因位置分片而少一部分。

在[一条请求的逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里，prefill 是计算输入 prompt 的位置，decode 是继续生成新位置。训练或 prefill 可以分摊一批查询；普通逐 token decode 每条请求通常只有一个新查询，主要需要分摊它要读取的长历史。后文分别解释通用算法与 Ascend 的 PCP/DCP，避免把某个推理实现当成所有 CP 的定义。

## 为什么需要它，代价是什么？

长序列增加了计算量和存储量。对于长度 T 的普通密集因果 attention，合法的查询—键组合有 T(T+1)/2 对，T 加倍时这部分工作量约增至四倍。线性投影、MLP 的位置数也增加，但它们按 T 线性增长。首次回答要等待这些前向步骤完成，瓶颈随模型和长度变化。

每层的激活要存放，推理还要把算好的 K/V 留作后续生成使用，这叫 [KV cache](kv-cache.md)。有些 TP 布局还会复制相同 KV，例如 [MLA](mla.md) 把 K/V 压缩后缓存，采用逐卡复制布局时，这份历史就在各 TP 卡上重复保存。CP 可以分摊位置对应的计算和存储；单张卡不必长期持有整条序列的全部位置数据。

代价是每层 attention 要取得远端位置的信息。可以收集 K/V、分块轮换 K/V，或先移动查询再合并局部输出；对应的峰值缓冲、通信次数和等待方式不同。使用等长分块时，长度不能整除就要补齐；重排位置还要保存恢复下标。短序列、小批次尤其要比较通信开销与节省的计算时间，才能判断收益。

## prefill 的位置怎么分才公平？

[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)让每个位置的工作量都不一样：位置 0 只有 1 个可见的键，位置 7 有 8 个。总合法查询—键组合为 $\sum_{i=1}^{8} i = 36$ 对，所以按前后对半分，两张卡的活差得很远，而头尾配对刚好均分：

| 切分方式（长度 8 的因果序列） | 分到位置与合法查询–键组合算式 | 每卡合法组合数 |
| --- | --- | --- |
| 对半切 · 卡 0 | 位置 0–3：$1 + 2 + 3 + 4$ | **10 对** |
| 对半切 · 卡 1 | 位置 4–7：$5 + 6 + 7 + 8$ | **26 对** |
| **头尾配对 · 卡 0** | 位置 0、1、6、7：$1 + 2 + 7 + 8$ | **18 对** |
| **头尾配对 · 卡 1** | 位置 2、3、4、5：$3 + 4 + 5 + 6$ | **18 对** |

下面的 PCP 3D 演示先用等权算例看位置分工：每个能读到的位置都占 1 份。位置 7 读取 8 行，第 0 通道为 1、3、5、7、9、11、13、15，加起来是 64，再除以 8 份，得到平均值 8。权重不等时为什么也要除以权重总和，放在 Ring 之前单独讲；Ring、DCP 图使用那里两块权重不等的算例。

```wiki-scene
parallel-mechanism:2
```

连续分配仍是正确算法。头尾配对改变的是负载分布：较早的查询需要读取的位置少，较晚的查询需要读取的位置多，两者放在一张卡上可以平衡这部分工作。上面的 18/18 统计的是合法组合数，实际内核还受分块、补齐、访存和通信影响，不意味着耗时严格相等。

若同样 8 个位置分给 **4 张卡**，就得到“卡 0 为什么负责位置 7”的情形：卡 0 负责 0、7，卡 1 负责 1、6，卡 2 负责 2、5，卡 3 负责 3、4，每卡都是 9 对合法组合。连续分成 0～1、2～3、4～5、6～7 时，则分别是 3、7、11、15 对。卡号只是执行归属，序列位置仍保留原编号。

在 prefill 中，输入 prompt 的 token 已经全部给出，同一层各位置的 Q/K/V 可以从该层输入计算。位置 7 不需要等待位置 0 的本层 attention 输出；它需要的是本层位置 0～7 的 K/V。**位置 7 放在卡 0，仍然读取 0～7，不会读取未来位置。**通信提供远端 K/V，位置编号用于应用正确的因果掩码。

固定 Ascend 的 PCP 使用这种头尾分段：长度先补齐到 2 × PCP 的整数倍，分成 2 × PCP 段，第一段配最后一段，依此类推；收集时按恢复下标还原顺序。这个配对方式可以与不同的 attention 通信算法结合，CP 本身不要求所有实现都使用它。

## 分开以后，attention 怎样拿到远端 K/V？

仍用上面的两卡头尾布局：卡 0 负责查询 0、1、6、7，卡 1 负责查询 2、3、4、5，并先从本卡输入计算对应的 Q/K/V。以卡 0 的 Q₇ 为例，本地已有 K/V₀、₁、₆、₇，缺少 K/V₂、₃、₄、₅。

一种直接做法是 **[All-Gather](collective-communication.md#all-gather) K/V**：两卡交换自己的 K/V，按原始位置拼成完整集合，再分别计算本卡 Q 对允许位置的 attention。Q₇ 此时能够读取 0～7；Q₁ 虽然也拿到了后面的 K/V，因果掩码仍只允许它读取 0、1。算完后，卡 0 持有输出 0、1、6、7，卡 1 持有输出 2、3、4、5，输出继续交给这些位置的后续投影和 MLP。

这里完整 K/V 可以只是本层计算期间的临时缓冲，输出仍按位置分工。它容易理解，代价是通信完成前的等待和收齐 K/V 的峰值空间。另一种做法是分块到达、分块计算：Ring Attention 就采用这个思路。分块以后每次只读到一部分历史，所以先弄清一个问题：读回的内容为什么还要除以权重总和。

## 为什么取回的内容还要除以权重总和？

**attention 要得到的是“按相关程度混合后的一份内容”。** V 是历史位置提供的内容向量，Q 与 K 的匹配决定各行 V 在结果里占多大比例。输出仍是一行向量，随后进入本层输出投影、残差和后续层，更新当前 token 的表示；它不是把历史文字直接拼成一段回答。

先只看一个通道：同一个查询读历史块 A，得到局部结果 **10**，权重合计 **2**；读历史块 B，得到局部结果 **30**，权重合计 **6**。这里的权重还没换成占比，B 应占 A 的三倍。下面把每个权重单位画成一格，看看除法前后有什么不同。

```wiki-diagram
file: context-parallel-merge
```

**除以 8，就是把“2 份 A 加 6 份 B”变成“¼ 份 A 加 ¾ 份 B”。** 图中 200 是带着全部权重累积的内容；25 才是按占比混合后的一份输出。两块各有 4 个位置，却不各占一半：决定占比的是权重，而不是位置数。这里权重和恰好为 8，换一组匹配评分就可能是别的数。

直接算 **10 + 30 = 40**，等于两块各取一整份；直接平均 **(10 + 30) ÷ 2 = 20**，等于两块各取一半。两种做法都丢掉了图中的 **2∶6**。正确结果 **25** 更靠近权重较大的 B。

### 图中的 10、30 和权重 2、6 从哪里来？

匹配评分取指数后，得到大于零的**未归一化权重**；每个权重除以所有合法位置的权重总和，才得到总和为 1 的**占比**。这个“取指数，再除以总和”的过程就是 softmax。上图先把同一历史块的贡献合在一起，下面展开到每个位置。

下面贯穿同一个两块历史的算例。只看位置 7 的查询 Q₇、一个 attention 头（独立的一套查询匹配与 V 汇合）、V 的一个通道；真实 V 有多个通道，对每个通道使用相同的占比。Q₇ 能读取全部 8 个位置。所有数字都是教学示意，不是词语的真实相关程度。

| 历史块 | 原始位置 | 每个位置的未归一化权重 | V 的这个通道 |
|---|---|---|---|
| A | 0、1、6、7 | 0.5 | 4、8、12、16 |
| B | 2、3、4、5 | 1.5 | 24、28、32、36 |

**A 的四行各带 0.5，合计权重 2；B 的四行各带 1.5，合计权重 6。** 后面 3D 的“权重总份额”指这个权重和；“份”不是 token 数或通道数。

可以先把各行 V 乘未归一化权重，再把它们加起来，最后统一除以总权重。这和先算每行占比再乘 V 完全等价，因为每一项的分母相同。图里的“内容总和”就是这个**还没除以总权重的加权和**：它是中间量，不是要交出去的上下文。下式以 $U$ 记加权内容之和、$Z$ 记未归一化权重之和、$O$ 记除法之后的输出（图中用中文表示同一组量，数为示意）：

$$O = \frac{U_0 + U_1}{Z_0 + Z_1} = \frac{20 + 180}{2 + 6} = 25 = \frac{1}{4}\times 10 + \frac{3}{4}\times 30$$

| 计算阶段（从两块历史得到一份上下文，示意） | 算式 | 结果 |
| --- | --- | --- |
| 历史块 A（位置 0、1、6、7） | $Z_0 = 4 \times 0.5 = 2$；$U_0 = 0.5 \times (4 + 8 + 12 + 16) = 20$ | 局部输出 $O_0 = 20 \div 2 =$ **10** |
| 历史块 B（位置 2、3、4、5） | $Z_1 = 4 \times 1.5 = 6$；$U_1 = 1.5 \times (24 + 28 + 32 + 36) = 180$ | 局部输出 $O_1 = 180 \div 6 =$ **30** |
| 两块合并（按全局权重总和或两块占比） | $(20 + 180) \div (2 + 6) = \tfrac{1}{4}\times 10 + \tfrac{3}{4}\times 30$ | 完整输出 $O =$ **25** |

**为什么不能直接交出 200？** 它包含了 8 份权重的内容，除以 8 才得到按比例混合的一份。一个检验办法是把所有未归一化权重同时乘 2：两块的相对重要程度仍是 1∶3，加权内容却从 200 变成 400，总权重从 8 变成 16；400÷16 仍是 25。省掉除法，输出会仅因权重的共同尺度改变而翻倍。这里说的是把取指数后的权重一起缩放，不是把 QK 评分乘 2。

表里的 0.5 和 1.5 就是匹配评分取指数后的值；示意故意取成好算的数，任何评分都按同样的方式变成权重。

这也解释了 CP 为什么不能只保存一个局部平均值：只看到 10，不知道它对应多少权重，就无法决定新块到来后它还应占多少。逐块读取时要保留加权内容与权重和；跨卡合并局部输出时还要交换相应的归一化统计。下面看 Ring 怎样随通信逐块更新这两个量。

想先看清整张八行注意力表的原始份数、总份数 $Z=8$ 与完整输出 $[25, 15, 12.5, 7.5]$ 怎样逐行算出，可以先播放 [Attention 的逐行贡献](attention-qkv.md#scene-inference-mechanism-0)；后文 [DCP 3D 图解](#scene-parallel-mechanism-3)再把同一组八行按奇偶位置分给两张卡，核对跨卡合并仍得到完全相同的输出。

## Ring Attention 每一轮在交换和计算什么？

**Ring Attention 让本卡 Q 留在原地，把不同位置的 K/V 块沿逻辑环传给相邻卡。** 每轮计算当前收到的一块，同时尽量发送本块并接收下一块；各块的计算贡献逐步合并。逻辑环是通信顺序，物理机器不必真的连成一个圆。

```wiki-diagram
file: context-parallel-ring
```

图中 A 是位置 0、1、6、7 的 K/V，B 是位置 2、3、4、5 的 K/V；块名不改变其中 token 的原始位置。两卡的完整前向可按三步理解：

1. **先算本块。** 卡 0 的 Q 与 A 配对，卡 1 的 Q 与 B 配对；每个查询分别应用因果掩码，只累计合法位置的贡献。比如 Q₇ 在本轮只算了四个位置，还不是完整答案。
2. **交换 K/V，再算另一块。** 卡 0 收到 B，卡 1 收到 A。Q 不换卡，已有累计值也留在本卡；新增贡献并入同一个查询的累计结果。Q₀ 对 B 没有任何合法位置，这个空贡献应跳过或按零权重处理。
3. **全部合法位置覆盖后输出。** Q₇ 已读过 A 和 B，得到与完整 K/V 一次计算相同的 attention 结果；Q₀ 仍只取位置 0。输出保持在负责该查询的卡上，交给后续计算。

一般 N 卡的概念流程是本地块加 N−1 个远端块，经历 N 轮块计算；若某个块中的位置全部在查询的未来，因果掩码会将该块完全遮住，实现可以跳过这部分无效计算。头尾配对负责平衡查询负载，Ring 负责组织 K/V 的传输与分块计算，两者是可以组合的不同选择。

**累计时要同时维护归一化统计。** 后来的块会改变 softmax 的总分母，已经得到的局部输出也要随之重新加权。下一节把前面 Q₇ 的算例对应到两轮通信。Ring 不需要把完整 K/V 或整张注意力分数矩阵一次性存到每张卡，但会传输远端 K/V；只有块计算足够长、传输能够与其重叠时，通信等待才可能被大幅隐藏。它与使用 ring 拓扑实现的 All-Gather 也不等同：关键区别是边收到块边完成 attention、维护累计结果，而非仅把完整数据收齐。

## 每张卡只有一段历史，结果怎么合成一份？

沿用[为什么要除以权重总和](#为什么取回的内容还要除以权重总和)里的 Q₇ 算例：A 的局部输出为 10、权重和为 2，B 的局部输出为 30、权重和为 6。完整结果为 25。下面把同一计算放回两张卡的通信过程；多个 attention 头分别完成各自的合并。

在 Ring 的两轮中，Q₇ 先看 A 时累计 U=20、Z=2，暂时输出为 10；B 到来后累计 U=200、Z=8，完整输出变成 25。若让两张卡各自计算一个块，也可以把各自的局部输出与归一化统计送到一起，按同样数学关系合并。前者移动 K/V，后者移动局部结果，通信对象不同。

实际评分可能很大，直接计算 exp 会溢出。常用两种等价的稳定表示：

- **在线累计最大值、分母、分子。** 维护已处理评分的最大值 m、按 exp(s−m) 缩放的分母 ℓ 和分子 u。新块使最大值变成 m′ 时，旧 ℓ、u 都先乘 exp(m−m′)，再加入新块按 m′ 缩放的贡献，最终输出 u/ℓ。旧贡献因此与新贡献保持同一尺度。
- **局部输出加 LSE。** LSE 是 log-sum-exp，即 Lᵣ=log Zᵣ。先算全局 L=log(Σ exp(Lᵣ))，再用 exp(Lᵣ−L) 给局部输出 Oᵣ 加权。例子中 L₀=log2、L₁=log6，权重就是 1/4、3/4；LSE 本身不能直接相加。

合并的前提是同一个查询、同一个头、同样的评分和掩码，所有分区覆盖它应读取的全部位置且不重不漏。完全被掩码挡住的块贡献为零；并行实现可能改变浮点相加顺序，数学等价不要求浮点结果逐位相同。

## Ulysses 怎样把位置分工换成头分工？

多个 attention 头分别计算，最后把输出通道拼在一起。**Ulysses 用 [All-to-All](collective-communication.md#all-to-all) 交换“由谁负责哪些位置、哪些头”**，让每张卡在 attention 内部拥有完整序列的一部分头，算完再恢复位置分片。All-to-All 表示每卡把不同的数据块分别发给它们对应的目标卡。

为看清交换维度，回到 8 个位置连续分半的布局，并设 4 个普通多头 attention 头、每头 d 个数（示意）。卡 0 最初持有位置 0～3 的全部 4 个头，卡 1 持有位置 4～7 的全部 4 个头，各卡 Q/K/V 的形状都是 [4, 4, d]，三维依次为位置、头、头内通道。

```wiki-diagram
file: context-parallel-ulysses
```

交换时，卡 0 把本地位置的头 2、3 发给卡 1，卡 1 把本地位置的头 0、1 发给卡 0，本来就归自己负责的头留在本卡。交换后，卡 0 有全部 8 个位置的头 0、1，卡 1 有全部 8 个位置的头 2、3：每卡形状变成 [8, 2, d]，数据量没有因交换翻倍。

现在每卡能独立完成自己两个头的完整 attention，并按原始位置应用因果掩码。输出再做一次反向的 All-to-All：卡 0 收回位置 0～3 的头 2、3，卡 1 收回位置 4～7 的头 0、1，恢复 [4, 4, d] 的位置分片，继续本卡这些位置的后续计算。交换的是激活，不需要在这里移动模型权重。

基本的均分方案要求头数能被并行度整除。[GQA](gqa.md) 的多个 Q 头共享较少的 KV 头，实际实现还会受 KV 头数约束：例如标准稠密模型 `Qwen3-8B` 有 32 个 Q 头、8 个 KV 头，不做 KV 头复制时按头均分最多切到 8 路；MoE 模型 `Qwen3-30B-A3B` 有 32 个 Q 头、4 个 KV 头，不复制 KV 头时上限只有 4 路。而 [MLA](mla.md) 把全部头的历史压成 **1 条共用潜向量**，按头重排时直接撞上“单潜头无法跨卡切分”的墙壁。Ring 按 K/V 位置块轮换，Ulysses 按头重排，两者也能在不同子组组合；Megatron 的层次 CP 就提供组内 All-to-All、组间 Ring 的方式。具体约束取决于后端及 TP 分片，不能只看序列长度选卡数。

## CP、SP 和 chunked prefill 分别改变什么？

同样出现“分成几段”，对应的执行含义不同：

| 机制 | 分工发生在哪里 | attention 如何保持完整 |
|---|---|---|
| Megatron SP | TP 组内归一化、残差等区域按 token 行分工 | 在对应 TP 投影前恢复组内行集合；可另外叠加 CP |
| CP | 同一序列的位置计算或历史存储分给不同设备 | 交换 K/V、重排头/位置，或合并带归一化统计的结果 |
| chunked prefill | 调度器把 prompt 拆到多次执行迭代 | 后续块仍读取前面块已经留下的 KV cache |

[chunked prefill](chunked-prefill.md)主要改变“这一轮处理多少输入”，不自动增加参与同一请求的卡数；CP 改变多张卡如何合作处理位置。两者可以组合：调度器先选本轮要算的 prompt 块，执行时再做 CP 分工，并处理之前轮次留下的历史。SP 与 CP 的组内/组间布局例子见 [SP 页](sequence-parallel.md#spcpulysses-是什么关系)。

## Ascend 的 PCP 与 DCP 分别走哪条计算路径？

落到 `v0.30.0` 主基线（及 `main`）的昇腾执行侧实现，上下文并行拆成两个职责不同的开关：

- **PCP（Prefill Context Parallel，前缀上下文并行）**：在 TP 与 PP 之外新增一个并行维度（单 DP 组设备数 `= PP × TP × PCP`），主要让多组卡分担长 prompt 的 prefill 查询位置。
- **DCP（Decode Context Parallel，解码上下文并行）**：复用已有并行组设备，不额外加卡，把原本逐卡重复保存的 KV 历史按位置交错分存到多张卡上，供 decode 与分块 prefill 联合读取。

在 `v0.30.0` 中，DCP 的公共元数据与通信逻辑通过 `common_cp.py` 的混入类（mixin）复用 V1 注意力后端，GQA、MLA 与稀疏 SFA 只覆盖各自有差异的阶段。不同模型架构能开多大的 DCP，取决于手头本来有没有重复的 KV 历史：以 GQA 模型为例，`Qwen3-8B`（8 个 KV 头）在 `TP=8` 时每张卡恰好分到 1 个不同 KV 头、没有重复副本，`PCP=1` 时 `DCP` 上限为 $8 \div 8 = 1$；`Qwen3-30B-A3B`（4 个 KV 头）在 `TP=8` 时每对卡复制同一份 KV 头，`PCP=1` 时 `DCP` 可取 `2`（若 GQA 同时开启 `PCP > 1` 与 `DCP > 1`，`v0.30.0` 要求 `PCP == DCP`）。而稀疏 SFA 复制索引路径每张卡都保存相同的主潜向量，因此 `v0.30.0` 允许 `DCP` 取 `PCP` 或 `TP × PCP`（早期 `v0.23.0` 与 GLM 专用镜像 `db701c1f` 则只在单个 TP 组内部拆 DCP，见文末[版本差异](#版本差异)）。

| 这一轮在做什么 | 主要交换什么 | 后续怎么计算 |
|---|---|---|
| PCP 普通、非分块 prefill | 本层 K/V 的 All-Gather | 本卡 Q 读取收齐的 K/V；临时缓冲用完释放 |
| 分块 prefill，GQA 后端 | 按头收齐 Q；交换局部输出与 LSE | 各卡读取本地历史，按全局归一化合并 |
| 分块 prefill，MLA 后端 | 上下文 K/V；稀疏路径只取所选块 | 收到 K/V 后计算，不走本表的 Q 收集与 O/LSE 合并路径 |
| decode 的局部历史路径 | 按头收齐 Q；交换局部输出与 LSE | 本地历史算部分 attention，再合并同一查询/头的结果 |

MLA 是把 K/V 压缩后缓存的 attention 形式，见 [MLA](mla.md)；GQA 是多个 Q 头共享一组 K/V 头，见 [GQA](gqa.md)。同样叫 CP，搬动 K/V 还是局部结果，取决于执行阶段和后端。

```wiki-diagram
file: context-parallel-paths
```

走局部结果路径时，Ascend 实现把局部输出 O 和归一化对数统计量 LSE 拼在一起：DCP 轴做 All-to-All，PCP 轴再按需 All-Gather，然后按[局部结果合并公式](#每张卡只有一段历史结果怎么合成一份)更新。下面的 3D 对应这个“查询读取分存历史、合并输出”的路径，图里的局部结果和 LSE 应一起理解。

下面另取一组**两卡交错分存的四通道示意数据**，沿用前例的首通道局部结果 10、30 和归一化量 2、6。偶数位置 0、2、4、6 的 V 首通道为 4、8、12、16，奇数位置 1、3、5、7 为 24、28、32、36；它与前面 Ring 的位置分组及位置对应数值不同。若首通道为 v，整行 V 取 `[v,40−v,v/2,20−v/2]`。同一个 Q=`[2,0,0,0]` 读取两卡的 K：偶数行取 `[ln(0.5),0,1,−1]`，奇数行取 `[ln(1.5),0,1,−1]`，因此 Q·K/√4 的指数分别为 0.5、1.5，四行累计得到 Z₀=2、Z₁=6。

图中 K 第一通道近似显示为 −0.69、0.41，计算仍使用 ln(0.5)、ln(1.5) 的精确值。本例刻意令 Q 后三项为 0，所以评分只由 K 第一通道决定；K 中的 0、1、−1 是另外三个通道的示意值，不是位置编号。卡 0、卡 1 的局部 O 分别为 `[10,30,5,15]`、`[30,10,15,5]`。四列共用分区权重 ¼、¾，逐列合并得到 `[25,15,12.5,7.5]`。图中 O 后面单独一格的 Z 是 exp(LSE)，用于看清归一化量，不是第五个输出通道；实际交换的是 O 与 LSE。

```wiki-scene
parallel-mechanism:3
```

该固定 Ascend 设计选择了收集/交换与合并方案，评估后没有采用 Ring Attention；文档给出的理由是开发复杂度与预期重叠收益。这是该实现的取舍，不能据此断言 Ring 对其他模型、硬件或长序列训练无效。把前面讲过的三条路线与 Ascend 在 `v0.30.0` / `main` 上的组合门槛放在一张对照板里看：

```wiki-diagram
file: context-parallel-fig-matrix
```

**落到 `v0.30.0` 主基线与 `main`，组合部署前需要核对四条门槛：**

- **MRV2 与模式门槛**：`PCP > 1` 强制要求 Model Runner V2，并拒绝 encoder-decoder、LoRA 与 `FULL` 图模式；投机解码白名单在 `v0.30.0` 为 `mtp / eagle3 / dspark`，`main` 扩至 `dflash`。
- **DCP 组大小与架构门槛**：SFA 复制索引路径允许 `DCP` 取 `PCP` 或 `TP × PCP`；GQA/MQA 同时开 PCP+DCP 时要求 `PCP == DCP`（`main` 上非 MLA/SFA 的 GQA 模型 DCP 已进入弃用告警）。
- **虚拟块公式**：交错缓存的虚拟块大小自 `v0.30.0` 起按 `physical_block_size × dcp_world_size` 计算，不再重复乘 PCP。
- **GLM KPool 边界**：GLM KPool 后端在 `v0.30.0` 仍明确拒绝 PCP 与 DCP；`main` 新增了 KPool 的 PCP 支持，但继续拒绝 DCP（完整四版对照见文末[版本差异](#版本差异)）。

## 历史位置怎么分着存？

**输入位置由谁计算，与计算出的 K/V 最终存到哪里，是两套布局。** 前面的头尾配对分配 prefill 的查询；固定 Ascend 的 CP 缓存则按位置交错落槽（轮换粒度默认是 `1`）。下面把交错落槽、虚拟块防重算公式、轮换粒度与复用 TP 显存边界画在一张图里：

```wiki-diagram
file: context-parallel-fig-interleave-slots
```

以 `DCP = 2`、轮换粒度 `= 1` 为例，逻辑位置 `0..7` 交错落进两张卡的本地块槽位：

| 缓存持有卡（`DCP = 2`、粒度 `= 1`） | 逻辑序列位置归属 | 本卡本地槽位 `0..3` 对应位置（不归本卡填 `−1` 跳过写入） |
| --- | --- | --- |
| 卡 0（偶数槽） | `0, 2, 4, 6` | `[0] → pos 0`, `[1] → pos 2`, `[2] → pos 4`, `[3] → pos 6` |
| 卡 1（奇数槽） | `1, 3, 5, 7` | `[0] → pos 1`, `[1] → pos 3`, `[2] → pos 5`, `[3] → pos 7` |

在 `v0.30.0` 主基线与 `main` 中，[块表](block-table.md)把同一个 DCP 缓存组内各卡的本地块拼成虚拟块，大小固定按 `physical_block_size × dcp_world_size` 计算，再按轮换粒度确定持有者和本地偏移；不归本卡的位置填 `−1` 跳过写入，此前取得 K/V 的计算路径要保证持有者能写入自己的部分。

**为什么不能再额外乘一次 PCP？因为 `v0.30.0` 的 `dcp_world_size` 可能已经包含 PCP 维度。** 例如稀疏复制索引路径允许 `TP = 2`、`PCP = 2`、`DCP = 4`（总卡数 $2 \times 2 = 4$，DCP 复用全部 4 张设备）。假设每个本地物理块装 `16` 个位置（示意），虚拟块就是 $16 \times 4 = 64$ 个位置；若照抄早期 `v0.23.0` / `db701c1f`（当时 DCP 只在 TP 内切分、不含 PCP）的 `本地块大小 × PCP × DCP` 公式，再乘一次 `PCP = 2` 算出 `128` 就重复计数了。究竟哪些 rank 属于同一个缓存组，必须读对应版本的建组与块表代码。

轮换粒度（`cp_kv_cache_interleave_size`）必须能整除本地块大小，也可以直接设为一整块。需要整块传输 KV 的场景（如 [PD 分离](pd-disaggregation.md)和 KV 池）须设为整块大小；早期稀疏 CP 路径也强制粒度等于块大小，而 `v0.30.0` 稀疏复制索引路径放宽为整除块大小即可。实际 [GLM 部署的 CP 开关与支持条件](#放到-glm-双机这套部署开了-cp-吗)与上表的教学布局分别说明。

## 复用 TP 的卡，为什么还要建通信组？

旧实现的 DCP 借的是 TP 已有的卡，参与的总卡数不变，但仍然要照常建一个通信组：一个 TP 组被拆成若干个 DCP 组，交换局部结果走的就是这个组。新版跨 PCP/TP 建组也同理：复用设备不等于省掉通信组。TP 里的第几张卡、DCP 里的第几张卡、物理上的第几张卡，也是三个不同的下标，读日志和配置时不能混着看。

还有一点常被想当然：**不能把一张卡上的所有缓存统一除以 DCP 的卡数。** 按位置切的只是那部分随长度增长的历史；稀疏路径的索引状态、别的 attention 形式的状态（比如 [KDA](linear-attention.md) 那种固定大小的递推状态）以及临时缓冲，各有各的复制或分片方式，有的反而是每张卡各留一整份。

## 放到 GLM 双机：这套部署开了 CP 吗？

部署是两台 Atlas 800 A2、每台 8 卡，TP8、DP2、EP16，W8A8 量化，完整前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**没有开：PCP = 1、DCP = 1。** 官方启动命令没有传这两个参数，上游默认值都是 1；起卡时建的并行组也是按 pcp=1、dcp=1 初始化的，参与一次 attention 的就是 TP 的那 8 张卡（MoE 另按 EP16 跨两机派发）。所以这套部署上没有 CP 的实测数据。

不过 DCP 想消掉的那种重复，GLM 身上确实存在：11 层稀疏 MLA 加上 MTP 层，KV 只有一个头，TP8 的 8 张卡各存一份**完全相同**的历史（见 [MLA](mla.md)、[TP 页的这一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)）。每个 token 每张卡要存 13,056 B，也就是 12 层各 1024 B 的主 KV 加 64 B 的索引器；一条满长 133,120 token 的请求就是 1.619 GiB，每张卡都一样（推导见 [KV cache](kv-cache.md)）。

**DCP 能省到什么量级？** 平台层认得这类稀疏模型，也定好了布局：主 KV 按位置分片，负责挑历史位置的那套索引每张卡各留一整份（它要看完整的序列，才能挑出和不开 DCP 时同样的位置），并且要求 DCP 等于 TP。但这套布局是给另一族稀疏 attention 后端写的，GLM 用的 kpool 索引器在固定版本里没有这份代码（见下面第二道门）。所以下表只是「照那套布局把 DCP 开到 8 能省多少」的量级示意（只算随长度增长的主 KV 和索引，不含每条请求固定大小的状态和临时缓冲，本模型没有这份实现也没有实测）：

| 核算项（DCP=8，主 KV 分片、索引复制量级示意） | 算式 | 每卡用量 |
| --- | --- | --- |
| 主 KV 每 token 每层（分给 8 张卡） | $1024\text{ B} \div 8$ | **128 B** |
| 索引每 token 每层（每卡各留一份） | 不随 DCP 切分 | **64 B** |
| 12 层（11 主干 + 1 MTP）每 token 每卡 | $12 \times (128 + 64)$ | **2,304 B** |
| 满长请求 133,120 token 每卡 | $133{,}120 \times 2{,}304\text{ B} = 306{,}708{,}480\text{ B}$ | **$\approx 292.5\text{ MiB}$** |

在固定版本上真要开 CP，会先撞上三道门：

- **PCP 这条路对 GLM 是关着的。** 34 层 KDA 的 prefill 在 PCP 大于 1 时直接抛 NotImplementedError。别的模型能用 PCP，不等于这个混合模型能用。
- **DCP 这条路，平台层放行不等于模型接上了实现。**
  - *平台层放行规则*：平台校验按配置认出稀疏模型（有 `index_topk`、没有 `compress_ratios`），在 `PCP = 1, DCP > 1` 时要求 `DCP == TP`、轮换粒度等于块大小（配错会被就地改写并只留一条 warning）。
  - *KPool 后端绕过现状*：普通 SFA 后端会据此选中“主 KV 分片、索引复制”的 DCP builder 和实现；但 GLM 用的 KPool 后端（把相邻位置的索引键压成一条再挑，见[稀疏 attention](sparse-attention.md)）固定选择普通 builder，绕过了这次选择。它继承的 DCP 查询／KV 收集钩子是空操作，稀疏 attention 调用也设 `return_lse=False`，并未接入局部输出与 LSE 合并路径。
  - *新版显式拦截*：`v0.30.0` 上 KPool 索引器直接抛 `NotImplementedError`，明确拒绝 `PCP > 1` 或 `DCP > 1`；`main`（`8d6180e2`）虽为 KPool 新增了 PCP 支持，仍对 `DCP > 1` 抛 `NotImplementedError`——不能因为平台参数校验通过就把旧路径当作可用 DCP。
- **开着[前缀缓存](prefix-caching.md)时，上游还有一道。** KV cache 分成多组（GLM 正是稀疏 MLA 与 KDA 两类）时用的那个协调器，要求 DCP、PCP 都是 1。

所以 GLM 的双机主线继续用[官方的 TP/DP 配置](../sources/glm-5-3-flash-baseline.md)，本库不把没验证过的 CP 组合写进部署命令；真要开，上面三条得逐条核过。

## 常见误解

- **「所有叫 SP 的方法都和 CP 相同。」** Megatron SP 的重点是 TP 组内部分激活的分片；Ulysses 也使用 SP 名称，却重排整个 attention 的位置/头布局。判断时要看具体方法；Megatron SP 可以与 CP 组合。
- **「开了 DCP，attention 每一步都要先把 KV 凑齐。」** decode 那一步不用，凑的是局部结果和 LSE；但 MLA 后端的分块 prefill 确实要把上下文的 KV 收齐（稀疏那条路只收被挑中的块）。反过来记成「DCP 永远不搬 KV」同样不对。
- **「局部结果加起来或者平均一下就行。」** 各段的 softmax 分母不同，必须按 LSE 换算权重；上面那个例子的答案是 25，不是 40 也不是 20。
- **「DCP 复用 TP 的卡，所以不用建通信组。」** 组照建，只是不新增卡；TP rank、DCP rank 和物理卡号是三个下标。
- **「开了 DCP，每张卡的显存就除以 DCP。」** 只有按位置切的那部分历史会除；索引状态、递推状态和临时缓冲各有各的算法，有的每张卡各留一整份。
- **「分到哪些查询，就只读哪一段历史。」** 位置越靠后要看的历史越多，本地缺的靠交换补齐，可见范围和不切时一模一样。
- **「卡 0 必须处理最前面一段，才能让后面的卡开始算。」** prefill 的 token 输入已知，各卡从本层输入计算 Q/K/V；attention 依赖远端 K/V，不要求按物理卡顺序依次完成本层输出。头尾配对是分配负载，原始位置与因果掩码保持不变。
- **「CP 就是 Ring，或者必须头尾配对。」** 分配位置与传输数据是两个选择；连续分配、头尾配对都可成立，Ring、All-Gather、All-to-All 等也有不同适用条件。
- **「chunked prefill 就是把序列分给多张卡。」** 它先改变调度轮次内的输入量；设备如何合作由 TP、CP 等执行机制决定。

## 对照源码

### 怎么开

两个开关分别管两条路：`--prefill-context-parallel-size`（PCP）和 `--decode-context-parallel-size`（DCP），上游默认都是 1 [C15][C16]；轮换粒度是 `--cp-kv-cache-interleave-size`，默认同样是 1，且在 `v0.30.0` / `main` 中须整除 `block_size`。PCP 要额外的卡：一个 DP 执行组的设备数按 `pipeline × tensor × pcp` 算 [C17]，且在 `v0.30.0` 主基线与 `main` 上开启 `PCP > 1` 必须使用 Model Runner V2。

DCP 不额外增加总卡数，但合法取值随版本与注意力架构区分：在 `v0.30.0` 主基线与 `main` 中，稀疏 SFA 复制索引路径允许 `dcp ∈ {pcp, tp × pcp}`；普通 MLA 要求 `(tp × pcp) ≥ dcp` 且整除；GQA/MQA 在 `PCP = 1` 时要求 `(tp ÷ kv 头数) ≥ dcp` 且整除，同时开启 `PCP > 1` 与 `DCP > 1` 时要求 `pcp == dcp` [C28][C29]（而早期 `v0.23.0` 与固定 GLM 镜像 `db701c1f` 只把单个 TP 组拆成 `tp ÷ dcp` 个 DCP 组，要求 `dcp ≤ tp` 且整除 [C7]，稀疏路径在 `PCP = 1` 下要求 `dcp == tp` 且轮换粒度等于块大小 [S23]，两套代际规则不能混套）。要做整块 KV 传输（PD 分离、KV 池）时，轮换粒度同样必须等于块大小。

### 会报什么错

- **PCP 与 DP 同开**：固定版本在 dp > 1 且 pcp > 1 时抛错，信息写明 PCP 和 DP 不能一起用 [C14]。
- **GLM 的 KDA prefill 遇上 PCP**：固定版本抛 NotImplementedError，信息是 `Kimi KDA prefill does not yet support PCP.`。
- **稀疏路径的 DCP 不等于 TP**：抛 AssertionError，信息写明只支持 dcp_size 等于 tp_size [C10]。
- **轮换粒度和块大小不一致**：稀疏路径下不报错，只打一条 warning，随后把粒度就地改成块大小；日志可用来核对最终生效的配置。
- **开着前缀缓存的混合模型**：上游协调器里有 `assert dcp_world_size == 1, "DCP not support hybrid attn now."`，PCP 同样一条；这个协调器只在开前缀缓存、且 KV cache 分成多组时才用（来源 11–12）[C11]。
- **给 GLM KPool 开 CP**：`v0.30.0` 主基线直接抛 `NotImplementedError("GLM-Next KPool indexing does not support PCP or DCP.")`（来源 57）；`main`（`8d6180e2`）已为 KPool 新增 PCP 支持，仅在 `DCP > 1` 时抛 `NotImplementedError("GLM-Next KPool indexing does not support DCP.")`（来源 60）。
- **投机解码的草稿模型加 DCP**：另有一组按草稿模型的 TP 和 KV 头数算出的上限，见 [Ascend 平台校验](npu-platform.md)。

### 开销和什么时候别开

- **短请求别开。** [示例请求 R1](one-request.md) 一步只有 4 个 token，历史才十几个块，切开省不下什么，补齐和交换的固定开销反而更显眼。
- **PCP 的代价是加卡和逐层收集。** 非分块 prefill 每层做一次 KV 的 All-Gather，用完即扔；[分块 prefill](chunked-prefill.md) 在 GQA 后端改成收集 Q，在 MLA 后端收集 KV 并分段处理，以免峰值显存过高。该分路与下文 Ring 的取舍均来自同一份固定 Ascend 设计说明。
- **官方这组实验改的是 Prefill 端。** 在 DeepSeek-R1-W8A8、64 卡 A3、PD 分离和 128K 输入条件下，P 端从 `(DP2/TP8/EP16)×2` 改成 `(PCP2/TP8/DCP8/EP16)×2`，D 端均为 `(DP32/EP32)×1`。TTFT 从 73.2 秒降到 46.0 秒，每字时延为 82 毫秒和 83 毫秒 [S13]。这说明该配置对照主要改善首字时间；它既不是本部署的实测，也不能证明改变 D 端 DCP 后每字时延仍不变。
- **DCP 的代价是交换和合并，prefill 那一侧还要收 KV。** decode 路上先按头维收集 Q，各卡用本地历史算出局部输出和 LSE，再交换、合并 [C6]；分块 prefill 上，MLA 后端改为收齐上下文 KV，稀疏路径只把稀疏块表点到的块收过来，不收 Q、也不做 LSE 合并，GQA 后端则仍走收 Q 那条 [S22]。省的是重复的 KV，付的是每步多几次通信和一次合并。
- **固定 Ascend 设计没有采用 Ring Attention。** 设计文档说明这是开发复杂度与预期重叠收益的取舍；不代表所有 CP 后端都如此 [S24]。

### 版本差异

按四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`，与发布前候选快照 `7d825229` 同构）与 `main`（`8d6180e2`）；例外 B 固定 GLM 镜像 `db701c1f` 的旧路径一并对照（`db701c1f` 中 KDA prefill 遇 PCP 抛 `NotImplementedError` [C8]，KPool 专用后端固定选普通实现、未接入 SFA 的 CP 分派且独立 `enable_dsa_cp` 被拒，稀疏 DCP 判定见 [C9]）。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 开关函数 | `enable_cp()` 统一判定 [C18] | 只剩 `enable_dcp()` | `enable_dcp()` 与 `enable_pcp()` 分开（`attention/utils.py#L320-L329`）[C20] | 移除旧 `attention/utils.py` 封装，新增 PCP 权重切分开关（`enable_pcp_o_proj_weight_sharding` / `enable_pcp_embedding_lmhead_weight_sharding`） |
| PCP 执行器门槛与投机/图限制 | 仅在 `dp > 1` 时拦 PCP | 非 V2 模型执行器直接报 `ValueError` [C19] | **PCP 强制要求 MRV2**（`platform.py#L1652-L1657`）；`v2/pcp_manager.py#L225-L250` 拒 encoder-decoder、多模态输入、LoRA 与 `FULL` 图（配 DP 或稀疏 MLA 时仅放行 `eager` 或 `FULL_DECODE_ONLY`），投机限 `mtp / eagle3 / dspark` [C21] | PCP 仍要求 MRV2（`platform.py#L2107-L2112`）；`v2/pcp_manager.py#L225-L248` 投机白名单扩至 `mtp / eagle3 / dspark / dflash` |
| 稀疏路径 DCP 判定与取值 | 稀疏、DCP > 1 且 PCP = 1，要求 `dcp == tp` 且粒度 = 块大小（来源 50–51）[C50] | 去掉 `PCP = 1` 条件 [C26]；走复制索引时不再强制粒度 = 块大小 [C27] | 稀疏复制索引允许 `dcp ∈ {pcp, tp × pcp}`（`platform.py#L1674-L1685`）；GQA/MQA 同时开 PCP+DCP 要求 `pcp == dcp`（`platform.py#L1688-L1702`，来源 28–29）[C28] | 延续上述取值；**非 MLA/SFA 的 GQA 模型 DCP 进入弃用日落告警**（RFC #21305，`platform.py#L2163-L2173`） |
| 缓存交错虚拟块与粒度 | `block_size × PCP × DCP` | 过渡 | `physical_block_size × dcp_world_size`，不再重复乘 PCP（`worker/block_table.py#L268-L275`）；轮换粒度须整除块大小 | 同 `v0.30.0` |
| 后端复用与 SFA/C8 边界 | 独立 CP 实现 | 过渡 | `common_cp.py` 通过 mixin 复用 V1 后端公共 metadata/通信，GQA/MLA/SFA 只覆盖差异阶段；SFA 复制索引保留完整索引缓存并切分主 KV，叠加 C8 量化时另做硬件能力检查（`sfa_cp.py`） | 延续 mixin 结构与 SFA/C8 校验 |
| GLM KPool 索引器与 CP | 分支无 GLM 代码 | 分支无 GLM 代码 | `indexer_kpool.py#L498-L499` 明确拒绝 `PCP > 1` 或 `DCP > 1` [C57] | **KPool 已新增 PCP 支持**（`indexer_kpool.py#L885-L899`），`__init__` 仅拒绝 `DCP > 1`（`indexer_kpool.py#L789-L790`）[C60] |

核对 `v0.30.0`（及 `7d825229` 候选快照）源码与配套文档时，还需留意三项细节：

- **设计文档与平台代码口径差异**：`v0.30.0` 周期的 `Design_Documents/context_parallel.md` 仍残留旧句“PCP 不支持”，但同提交 `platform.py` 只在未启用 Model Runner V2 时拒绝 PCP，MRV2 已内置 `AscendPCPManager`（`worker/v2/pcp_manager.py`）；不能拿该设计文档断定 `v0.30.0` 所有执行器都不支持 PCP。
- **索引、主 KV 与通信缓冲分开记账**：SFA 复制索引路径在每张卡保留完整索引缓存，只切分主 SFA KV，不能把索引缓存、主 KV 与临时通信缓冲统一除以 DCP 大小；排查代码时也须同时读 V1 普通后端与 `context_parallel/` 目录下的 mixin 覆盖方法。
- **GLM 实验性 `DSA-CP` 不是通用 PCP/DCP**：`additional_config` 中的 `enable_dsa_cp` 是需要搭配 SP 显式开启的独立实验开关，不会由 `PCP` / `DCP` 大小自动触发。旧 `db701c1f` 的 KPool 构造函数直接拒绝该开关；`v0.30.0` 周期 GLM 教程记录的实验性 `DSA-CP` 仅分担 SFA 查询位置，主 KV、KPool 索引池与尾缓存仍保持复制，KDA 沿用 TP，且 `PCP = DCP = 1`，不能将其混同为“GLM 已支持 DCP 缩减 KV”。

表中的 `main` 指 `sources` 钉住的提交 `8d6180e2`，不代表持续变化的分支最新状态。跨版本配置需要同时核对执行器、模型和 attention 后端；满足一条平台条件，不等于整个组合已经受支持。

### 源码位置

| 看什么 | 去哪 |
|---|---|
| 设计说明：PCP/DCP 分工、交错存放、头尾配对、Ring Attention 的取舍 | vllm-ascend 的 CP 设计文档 |
| 用法、约束与官方实测表 | vllm-ascend 的 CP 用户指南 |
| 位置落到哪张卡、不归本卡的槽位填 −1 | `vllm_ascend/worker/block_table.py` |
| 头尾配对的切分与恢复下标 | `vllm_ascend/worker/pcp_utils.py` |
| 交换局部输出与 LSE、按公式合并 | `vllm_ascend/attention/context_parallel/common_cp.py` |
| DCP、PCP 的通信组怎么建 | 上游 `vllm/distributed/parallel_state.py` |
| 参数默认值与总卡数公式 | 上游 `vllm/config/parallel.py` |
| GLM 稀疏路径的 DCP 判定与平台校验 | `vllm_ascend/utils.py`、`vllm_ascend/platform.py` |
| KDA prefill 拒绝 PCP | `vllm_ascend/ops/kimi_kda.py` |
| GLM KPool 索引器与 CP | 固定版本 `indexer_kpool_mla_v1.py` 的后端选择和稀疏调用，对照 `sfa_v1.py` 的 CP 分派及空收集钩子；`v0.30.0` 的 `indexer_kpool.py` 明确拒绝 PCP 与 DCP，`main` 的 `indexer_kpool.py` 已支持 PCP 且仅拒绝 `DCP > 1` |
| 混合 KV cache 协调器的限制 | 上游 `vllm/v1/core/kv_cache_coordinator.py` |
| 三个版本的开关函数 | `vllm_ascend/attention/utils.py` |
| 通用 CP 与 Megatron SP 的边界、组合方式 | Megatron Core 的 Context Parallel 说明 |
| Ring 的本地 Q、K/V 轮换、在线累计与重叠条件 | Ring Attention 论文 §3、图 2 和算法附录 |
| Ulysses 的位置/头 All-to-All、逆向交换 | Ulysses 论文图 2 及方法节 |

正文里几条不是直接读一处源码得到的，出处如下：

- 通用 CP 定义与 SP/TP 组合来自 Megatron Core 官方说明（来源 31）；Ring 和 Ulysses 分别依据原论文的算法与图（来源 32、33），层次组合依据 Megatron Bridge 文档（来源 34）。
- 两卡 10/26 对比 18/18、四卡 3/7/11/15 对比 9/9/9/9，按普通密集因果掩码数合法查询—键组合；Q₇ 的小数值例子、U/Z 与 LSE 关系是数学推导，不是模型实测。
- 位置分工、K/V 缓存布局、分块 attention 的通信对象是不同层次；固定 Ascend 的头尾位置与恢复下标见 `pcp_utils.py`，缓存持有者见 `block_table.py`，局部 O/LSE 合并见 `common_cp.py`。各版本能力按上表固定提交区分，不能由单个类存在推断整套组合已验证。
- 固定 KPool 后端没有接入普通 SFA 的 CP 分派，依据后端选择、继承的空 DCP 收集钩子和 `return_lse=False` 的稀疏调用，见来源 46–49。
- 本部署 PCP = DCP = 1：启动命令没有传这两个参数，上游默认值为 1，起卡时按 pcp=1、dcp=1 建组，总卡数等于 TP 的 8 张 [D]。
- 每 token 每卡 13,056 B、满长请求 1.619 GiB：取自 [KV cache](kv-cache.md) 与[部署页](glm-5-3-flash-two-node.md)已经推导过的账，本页只引用。
- 「DCP 开到 8」那一段的字节数：按「主 KV 按位置分片、索引每卡各留一份」的布局从 13,056 B 推出，本模型没有这份实现，也没有实测 [D]。
- 待核：kpool 尾状态、KDA 递推状态在 DCP 下怎么放，钉住版本里没有对应代码可核；本部署没有 CP 的时延与吞吐实测数。

固定 Ascend CP 设计说明（来源 1，db701c1f 的第 13–20 行）还明确了阶段边界：PCP 按位置分开保存 KV cache，因此也影响 decode；DCP 除 decode 外，也影响分块 prefill 和复用已有缓存的 prefill。PCP、DCP 的名字表示各自的主要目标，不表示只在名字对应的阶段生效。
