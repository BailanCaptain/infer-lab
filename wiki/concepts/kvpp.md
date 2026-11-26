---
id: kvpp
title: KVPP：KV cache 按层分给各卡常驻，算到时整层广播
type: feature
summary: >-
  TP 组里 MLA 的 KV cache 每张卡各存一份一样的；KVPP 把各层分给不同的卡长期保存，每卡另留 2
  个暂存区，算到某层时由常驻卡提前一层整层广播。对照 GQA（如 Qwen3-8B）为何无需 KVPP，讲清分法、容量账、广播与等待，以及
  v0.30.0 与 main 的非混合 MLA 支持边界。
aliases:
  - KVPP
  - KV Pipeline Parallelism
  - KV pipeline parallelism
  - KV 流水并行
  - KV 层并行
  - KV 按层并行
  - KV cache 按层切分
  - KV layer parallelism
  - KV 广播
  - MLA KV 去重
  - enable_kvpp
  - KVPPConfig
  - KVPPScheduler
  - KVPPRuntime
  - KVPPPhysicalCachePlan
  - KVPP_SCRATCH_BUFFER_COUNT
  - BroadcastKVPPTransport
  - LayerSplit
  - 常驻卡
  - 暂存区
chapters:
  - '13'
order: 60
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L52-L100'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1490-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L60-L89'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L18-L56'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L107-L178'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L540-L546'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1103'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/kvpp_cache.py#L30-L57'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kvpp.py#L9-L36'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L23-L64'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L87-L114'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/model_states/default.py#L74-L85'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2486-L2487'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4177-L4177'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4772-L4774'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2057-L2061'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L1716-L1719'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L935-L940
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L214-L246
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L839-L839'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L922-L928'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2439'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L1-L56'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L57-L137'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L138-L197'
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/kvpp.md#L1-L64
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L333-L344
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/feature_matrix.md#L37-L37
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2072-L2085'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L550-L554'
  - >-
    raw:sha256-fe4847400202f87006599b0a2cdadf77abfa6f29726ceade8f56f86925417038.md#L1-L803
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/kvpp.md#L19-L28
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/kvpp.md#L36-L48
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L63-L90'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L92-L111'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/kvpp.md#L57-L65'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/kvpp.md#L57-L65
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/kvpp.md#L23-L151
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/kvpp_cache.py#L13-L18'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L74-L85'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L1743-L1770'
  - 'https://z.ai/blog/scaling-pain'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L200-L211'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L3110-L3145'
  - 'vllm-ascend@921ccc52:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L60-L225'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L38-L110'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/kv_cache_placement.py#L21-L205'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L42-L117'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/kv_cache_placement.py#L21-L201'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L335-L342'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache
    kind: builds-on
    note: 先知道 KV cache 存什么、为什么按块存
  - to: tensor-parallel
    kind: builds-on
    note: 理解 TP 切头之后 MLA 的历史为什么逐卡复制
  - to: mla
    kind: builds-on
    note: 理解各头共用的潜向量为什么切不开
  - to: collective-communication
    kind: builds-on
    note: 理解 Broadcast 由谁发、谁收
  - to: kv-cache-spec
    kind: builds-on
    note: 理解调度器眼里的块规格为什么不变
  - to: pipeline-parallel
    kind: alternative-to
    note: 同叫「流水」，PP 分的是层的权重和计算，KVPP 只分历史放在哪
  - to: context-parallel
    kind: alternative-to
    note: DCP 按序列位置跨卡分存历史，KVPP 按层号整层常驻并提前广播，两者互斥
  - to: context-parallel
    kind: conflicts-with
    note: 仅针对 CP 中的 DCP：DCP 将同层历史按位置分存，KVPP 按层常驻并广播；当前实现明确禁止两者同开。此限制不适用于满足条件的 PCP。
contradicts: []
updated: '2026-11-26'
origin: gap
rawSources:
  - >-
    raw/sha256-0c0e738d4e6a6dece282439e136000d132e31e0e282c6e383be16fec78771bab.md
  - >-
    raw/sha256-fe4847400202f87006599b0a2cdadf77abfa6f29726ceade8f56f86925417038.md
---

## KVPP 是什么？

在多卡 [张量并行（TP）](tensor-parallel.md) 下，标准 `GQA` 模型（如 8 个 KV 头的 `Qwen3-8B`）可以把不同 KV 头均分给不同卡，每张卡存的内容互不重复；但 **[MLA（多头潜在注意力）](mla.md)** 把所有注意力头的键值历史压成了**唯一一条共用的低秩潜向量**，没法再按头切分，结果 `TP=8` 时组内 8 张卡被迫把一模一样的 [KV cache](kv-cache.md#kv-cache-是什么) 各自完整存了一遍（见 [TP 页的稀疏 MLA 一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)）。

**KVPP（KV Pipeline Parallelism，KV 按层流水常驻）是 `vllm-ascend`（自 `v0.30.0` 起合入正式分支）专门用来消除 MLA 组内 KV 重复副本的特性：模型的计算分工保持原样不动，但每一层的 KV cache 只交给组内某一张“常驻卡”长期保存，其余卡仅预留 2 个临时暂存区；前向算到某一层前，由该层常驻卡提前一层把整层历史广播（[Broadcast](collective-communication.md#broadcast)）给同组其他卡，算完立即把暂存区腾给后续层复用。**

用一个 8 层 MLA 模型跑在 `TP=4` 四张卡上的小算例就能一眼看懂：不开 KVPP 时，4 张卡各存满 8 层相同历史（共存 4 遍）；开启 KVPP 后，卡 0 只常驻第 0、1 层，卡 1 常驻第 2、3 层，卡 2 常驻第 4、5 层，卡 3 常驻第 6、7 层，每张卡外加 2 个轮流接数据的暂存区：

```wiki-diagram
file: kvpp
```

新 token 依然从第 0 层顺序算到第 7 层，4 张卡照旧各算自己负责的注意力头。唯一变化的是“本层历史从哪来”：算第 0、1 层前由卡 0 广播，算第 2、3 层前换卡 1 广播，接力棒顺着层号一路往下传。名字里的「流水（Pipeline）」指的就是**各层 KV 历史顺着层序从不同常驻卡流水般广播到位**——千万别和把模型层权重切到不同卡接力计算的 [PP（流水线并行）](pipeline-parallel.md#pp-是什么)混为一谈（源码中把负责长期保存某层历史的卡称为 `owner`，下文统一叫「常驻卡」）。

## 为什么需要 KVPP？

**不开时，TP 组里多出来的那几份 KV cache 全是复制品，而 KV cache 的容量直接决定一次能接多少请求、能留多长的历史。**

接着上面的例子算一下（示意数）：每张卡给 KV cache 留 48 MiB。KV cache 按块存放，一块装固定个数的位置（见 [KV cache 按块存放](kv-cache.md#缓存按块存放一个位置的-kv-写进哪一格)）；一个块号要在 8 层上各占一格，假设每层每块 1 MiB，一个块号就是 8 MiB，每张卡只能分出 48 ÷ 8 = 6 块。4 张卡一共拿出了 192 MiB，装的却只是同样的 6 块历史。块用完以后，调度器只能少接请求，或者把正在跑的请求挤出去、以后再重算。

不是所有 attention 都会这样复制。[GQA](gqa.md) 有好几个 KV 头，TP 可以把不同的头分给不同的卡，每张卡存的是不同的东西：例如标准稠密模型 `Qwen3-8B` 有 8 个 KV 头，开到 `TP ≤ 8` 时每张卡分走不同 KV 头、零重复；MoE 模型 `Qwen3-30B-A3B` 有 4 个 KV 头，`TP=4` 时同样零重复，只有 `TP=8` 头不够分时才两两复制一份（见 [GQA 页](gqa.md#张量并行时kv-头不够分就要复制)），都不属于 KVPP 的目标对象。而 [MLA](mla.md) 只有 1 条共用的潜向量，TP 开到几就复制几份，因此 `v0.30.0` 与 `main` 将 KVPP 的适用模型限定为非混合 MLA/SFA 模型。不过 MLA 也不是非走 KVPP 不可：下表里的 DCP 是把同一层 MLA 历史按序列位置分存到各卡的另一条路，所以 KVPP 和 DCP 不能同开。

**代价是通信，而且是整层的通信。** 常驻卡每次发的是这一层已经分配出去的全部块，不管这一步真正在跑的请求用了其中几块。能装的块多了几倍，每层要搬的字节就跟着多几倍，这是同一件事的两面，具体数在「历史怎样到位」一节演算。

除了通信，还有三笔账：每张卡要多留 2 个暂存区的显存；每层计算前可能要等广播到位；在 `v0.30.0` 主基线与 `main` 上，执行模式只接受 `eager`（算子逐个下发）或 `PIECEWISE` 分段图模式，不支持 `FULL` 全图回放（见 [ACL Graph](acl-graph.md)，更早快照演进见文末[版本差异](#版本差异)）。所以它换来的是容量，不是速度：官方在非混合 SFA 模型上测到能装的 token 多了五六倍，同时长输入的首 token 时间变长、prefill 吞吐下降，数字和测试条件见文末「开销和什么时候别开」。

KVPP 和几种名字相近的做法，改的东西不同：

| 做法 | 改的是什么 | 要用到时怎么办 |
|---|---|---|
| [PP（流水线并行）](pipeline-parallel.md) | 层的权重和计算分到不同的卡 | 段间交接下一段所需的中间状态，具体张量随模型而异；各层历史留在负责该层的阶段 |
| [DCP（decode 上下文并行）](context-parallel.md) | 同一层的历史按位置分到不同的卡 | 各卡用本地那段算出局部结果，再合并 |
| KVPP | 每层历史只由一张卡常驻，计算不动 | 算到这一层前，常驻卡整层广播 |
| KV cache 卸载（[CPU offload](kv-cache-cpu-offload.md)、[外部 KV 池](kv-pool.md)） | 历史搬到主机内存或外部存储 | 用到时搬回显存 |

一句话分辨：PP 换的是每张卡算哪几层，DCP 换的是每张卡存哪些位置，KVPP 两样都不换，只换「每层的历史长期放在哪张卡上」。v0.23 维护分支上还有一个做法相近的 [layer_sharding](../params/layer-sharding.md)：把部分线性层的权重按层号轮流分给几张卡，前向时同样提前一层广播取回；它分的是权重，不是 KV cache，而且只在 v0.23 上有。

## 层怎么分，每张卡要留多少显存？

**层按顺序连续均分，除不尽的余数给排在前面的卡；每张卡要留的是「自己常驻的层 + 2 个暂存区」，再加上不参与划分的 MTP 草稿层。**

分法在启动时一次定死，规则有三条：

1. **按层号排好，连续地分。** 8 层分给 4 张卡，每张 2 层：卡 0 拿第 0、1 层，卡 1 拿第 2、3 层，依此类推。除不尽时，余数由排在前面的卡各多拿一层：10 层分给 4 张卡是 10 ÷ 4 = 2 余 2，卡 0、1 各拿 3 层，卡 2、3 各拿 2 层。开了 PP 时，每一段只分自己那段里的层。
2. **一层要一起存的几份缓存捆在一起，归同一张卡。** 除了主 KV cache，有的模型每层还有索引器缓存、量化用的缩放系数，它们跟着这一层走，在显存里连着放，代码里叫这一层的 bundle。广播也是整个 bundle 一起发。
3. **MTP 草稿层不参与划分。** MTP 是模型自带的草稿层，先猜后面几个 token，再交给主模型验证（见 [投机解码](speculative-decoding.md)）。它的缓存每张卡都完整留一份。

暂存区固定是 2 个，和组里有几张卡无关：一个装正在算的这一层，一个接提前发来的下一层，按层的顺序轮流用。每个暂存区按参与划分的层里最大的那一层 bundle 开，MTP 层不计入。

启动时每张卡按这几项重新算自己能分多少块，引擎取所有卡里最小的块数。**每层大小和各卡预算相同时，拿层最多的那张卡决定整组容量。** 接着上一节的示意数（8 层分 4 张卡，每层每块 1 MiB，每卡有效缓存预算 48 MiB，暂不计分配对齐余量；4 张卡分摊省下的不是 4 倍，因为 2 个暂存区占掉了一半）：

$$\text{BytesPerBlock}_{\max} = \left(\left\lceil \frac{L}{N} \right\rceil + 2\right) \times B = (2 + 2) \times 1\text{ MiB} = 4\text{ MiB}$$

| 配置（8 层、4 卡、预算 48 MiB/卡，示意） | 单个块号每卡占用 | 每卡可分块数 | 容量变化 |
| --- | --- | --- | --- |
| 不开 KVPP | $8\text{ 层} \times 1\text{ MiB} = 8\text{ MiB}$ | $48 \div 8 =$ **6 块** | $1\times$（基准） |
| 开启 KVPP（2 层常驻 + 2 个暂存区） | $(2 + 2) \times 1\text{ MiB} = 4\text{ MiB}$ | $48 \div 4 =$ **12 块** | $12 \div 6 =$ **2 倍** |

卡越多、层越多，这 2 个暂存区摊得越薄。通用式为：共 $L$ 层、组内 $N$ 张卡、每层每块 $B$ 字节时，拿层最多的卡一个块号占 $(\lceil L/N \rceil + 2) \times B$（按每层等大算；层大小不一时按各层实际字节加总，暂存区按最大层开，MTP 层另算；仅计 KV cache，不代表整卡显存降幅）：

- **8 层不同卡数对比**：`8` 卡每卡常驻 1 层，容量约 $8 \div (1 + 2) \approx 2.7$ 倍；`2` 卡每卡常驻 4 层，容量约 $8 \div (4 + 2) \approx 1.3$ 倍；组里只有 `1` 张卡时没有复制品，一字节也省不下。
- **层大小或预算不等时**：分配按层数均分，不按字节再平衡。若各卡可用预算相同，单块实际字节最大的卡决定最少块数（未必是层数最多的卡）；若各卡预算也不同，各卡分别算块数再取最小值。

层太少时，2 个暂存区甚至会让容量反降。例如短 PP 段只有 2 个同大小目标层、组内 4 卡、无 MTP，满卡要留 `1 层常驻 + 2 暂存区 = 3 份`，反而多于不开时的 2 份（48 MiB 预算下由 24 块降至 16 块，对齐余量另计）。长模型切成较短 PP 段后须逐段重算，不能把增容视为必然。

**调度器那一侧的逻辑规格不变。** 每张卡算出块数后，把它乘回「不开 KVPP 时一个块号要占的字节」报给引擎。所以引擎和调度器看到的仍是原来那套块规格、块号和块表（见 [KV cache 规格](kv-cache-spec.md)），只是块数从 6 变成了 12；[前缀缓存](prefix-caching.md)和[块分配](vllm-kv-block-allocation.md)沿用这些逻辑块。调度器眼里每张卡放着 12 × 8 MiB = 96 MiB 的历史，本例每卡有效缓存张量合计 48 MiB，差的那部分靠广播从别的卡借。DCP 则不同，它真的把同一层的历史按位置分开存，每张卡上只有一部分位置。

有效张量之外还有分配开销。固定 main 为每段缓冲额外申请 2 MiB，再从中截出对齐的视图；上例每卡两个常驻层、两个暂存区共四次申请，额外预留 8 MiB。这笔额外申请仍未涵盖底层分配器的管理与取整成本，完整 HBM 占用须由实际分配记录核算。上面的 48 MiB 和容量倍数只计算有效缓存布局。

## 算到某一层时，历史怎样到位？

**每层在第一次读写缓存之前，等这一层的广播到位；一等到，就立刻发下一层的广播。广播走单独的一条传输流，提前一层。** 下面按 MLA 或 SFA 非融合路径说明投影与等待；SFA 融合预处理里包含缓存写入，因此要在融合操作之前等，不能假定每个后端都有同样的投影重叠窗口。

一步前向里，每张卡按这个顺序走：

1. **开头先看这一批有没有历史。** 只要这批里有一条请求已经算过 token（decode、分块 prefill 的后续块、命中前缀缓存都算），就在前向一开始发第 0 层的广播。整批都是全新的 prefill 时，这一步没有历史可读，整步不广播；启动时的试跑和测显存那几步也不广播。
2. **每层先算投影。** 投影是把这一层的输入乘上权重，得到新 token 的 Q（压缩后的中间表示）和要写进缓存的新潜向量。这段计算不碰缓存，可以和广播同时进行。
3. **第一次读写缓存之前，等这一层到位。** 所有卡都要等本层广播任务完成：常驻卡确认广播已读完源数据后使用自己那份，别的卡使用收到的暂存区。
4. **一等到，就发下一层的广播**，然后算这一层的 attention 和后面的计算。下一层的广播就和这些计算同时在跑。

结合下方流水图中的独立广播流节拍看时间线（示意）：第 0 层没有上一层的计算可供重叠，但前向开头已发起广播，首次访问缓存之前的计算仍可能遮住一部分；MLA 路径明确允许 Q/KV 投影与广播重叠。从第 1 层起，还可利用上一层等待点之后的计算。到本层等待点时广播尚未完成，才暴露剩余等待；能藏住多少取决于字节数和具体后端的计算路径。

广播开始前还要确认缓存数据已经就绪，等待返回前要确认设备传输确实完成；这些同步开销也算在通信一侧。上面的触发与等待顺序能由代码确定，实际暴露多长等待、遮挡多少通信则需要同硬件测量。

**新 token 的历史怎么进常驻那份。** 这一层的新潜向量，每张卡都算出了同一份（MLA 的压缩投影在 TP 组里不切），也都写进自己手上这一层的缓存。常驻卡写进的是常驻那份，会一直保留；别的卡写进的是暂存区，隔一层再用这个暂存区时就被覆盖。下一步再算这一层时，常驻卡会把包含新位置的整层重新发出来，所以别的卡丢掉暂存区也不会丢历史。

**整层发，不按请求挑。** 接着上一节的例子：开 KVPP 后每张卡有 12 块。假设这一步只有一条短请求在跑，只用到其中 3 块（块数从 6 翻到 12，一层的 bundle 也从 6 MiB 变成 12 MiB，每层要发的字节跟着翻倍；示意）：

| 通信核算项（接上节 8 层、4 卡、12 块示意） | 算式 | 字节数 |
| --- | --- | --- |
| 单层完整 bundle（每次广播发出） | $12\text{ 块} \times 1\text{ MiB}$ | **12 MiB** |
| 本步短请求真正用到的部分 | $3\text{ 块} \times 1\text{ MiB}$ | **3 MiB** |
| 每张卡每步需要接收的总量 | $(8\text{ 层} - 2\text{ 常驻层}) \times 12\text{ MiB}$ | **72 MiB** |

```wiki-diagram
file: kvpp-fig-layer-residency
```

## 能和 PP、PCP、PD 分离、KV 卸载一起开吗？

**通信组只在一个 DP 请求执行组、一个 PP 段之内（组大小为 `TP × PCP`），不跨 DP 或 PP；与 DCP 严格互斥，且限定非混合 MLA 模型。** 在 **`v0.30.0` 主基线与 `main`** 上，执行模式支持 `eager` 或 `PIECEWISE` 图模式，支持通过 `MultiConnector` 组合连接器，`main` 还新增了 `MooncakePushConnector`（同样拒绝 `kv_consumer`）并明确禁止 Mooncake 逐层 CP 与 `enable_kvpp` 同开（各版连接器与图模式差异见文末[版本差异](#版本差异)）。

先认几个词：PCP（prefill 上下文并行）把一条长 prompt 的位置分给几组卡一起算 prefill，DCP 把 decode 时的历史按位置分到几张卡上，两者见 [上下文并行](context-parallel.md)；Model Runner V2 是 vllm-ascend 新版的 model runner（每步准备输入、执行前向的组件，见 [NPU model runner](npu-model-runner.md)）；PD 分离是把 prefill 和 decode 交给两套实例，中间由连接器交接历史。`v0.30.0` 主基线与 `main` 的组合边界如下：

| 一起开的是 | 能不能 | 条件 |
|---|---|---|
| [PP](pipeline-parallel.md) | 能 | 每一段只把自己那段的层分给段内的卡，各段各建一组、各自广播，组不跨段 |
| [DP（数据并行）](data-parallel.md) | 能 | 每个 DP 请求执行组分别建组，不跨 DP；这不表示专家权重一定完整复制 |
| PCP | 能，要新版 model runner | 组大小为 `size = TP × PCP`（与 `TP` 联合划定复制域）；`PCP > 1` 须配 Model Runner V2 |
| DCP | 不能 | 启动报错（`KVPP and DCP cannot be enabled at the same time.`） |
| 图模式 | 仅支持 `eager` 或 `PIECEWISE` | 不支持 `FULL` 全图模式（各版演进见[版本差异](#版本差异)） |
| MTP / DSpark 投机解码 | 只能固定步数 | MTP 层不参与划分，每卡各留一份；拒绝按 batch 动态步数与自适应验证 |
| [PD 分离](pd-disaggregation.md) | 能（支持 `MultiConnector`） | `v0.30.0` 用 `MooncakeConnectorV2`，`main` 另支持 `MooncakePushConnector`；只在 prefill 实例上开，decode 实例（`kv_consumer`）必须关 |
| [外部 KV 池](kv-pool.md) | 能（支持 `MultiConnector`） | 用 `AscendStoreConnector`；`main` 明确拒绝 Mooncake 逐层 CP 与 `enable_kvpp` 同开；每卡只存常驻层和自己的 MTP 缓存，完整配置见下文 |
| PCP 加 PD 分离 / 外部 KV 池 | 以连接器与版本校验为准 | 配置层 `KVPPConfig.size = TP × PCP` 不单独拦截该组合，但早期用户指南未纳入三者同开验证范围，且 `main` 禁止 Mooncake 逐层 CP 与 `enable_kvpp` 同开 |
| [CPU offload](kv-cache-cpu-offload.md) 等其他连接器 | 启动检查拒绝 | 不在 `_KVPP_SUPPORTED_CONNECTORS` 白名单内，启动直接报 `ValueError` |

与“换出 / 传输”有关的两条单独说明：

- **接外部 KV 池**：每张卡按块只存自己常驻层与本卡 MTP 缓存，暂存区不存；读回时放回常驻份，其余卡照旧在算到该层时靠广播取。查池时须跨所有 PP 段的所有常驻卡分片都在，前缀才算命中。注意 `producer` 在 Memcache 池化中也会加载前缀（并非只写不读），`consumer` 单独使用未通过指南验证；旧 `main` 还要求丢弃不足整块的尾部且不支持 KV 事件与 consumer 回写（Mooncake 逐层池化是另一条路径，见[版本差异](#版本差异)）。
- **接 PD 分离与其他连接器**：prefill 实例各卡只登记常驻层，decode 实例不开 KVPP，直接从各层常驻卡分别拉取。不在白名单里的连接器（例如 CPU offload）在启动检查即被拒（早期快照报错文案写的是“PD 分离要用 MooncakeConnectorV2”，属按代码推断，未实跑）。

## 在 vllm-ascend 里怎么走一遍？

**启动时一次定好分工和容量，每步前向逐层等、逐层提前发。**

它发生在请求主线的[模型执行](npu-model-runner.md)站：调度器已经给出本步批次与块表，执行器在每层第一次访问缓存之前安排广播等待，再继续本层前向。

```wiki-diagram
file: kvpp-flow
```

上两排在启动时走一次。先读开关、定组大小（TP × PCP）；组大小是 1 就什么都不做。大于 1 才做启动检查，不满足任何一条就报错退出。接着每个 DP 请求执行组、每个 PP 段各建一个通信组，把本段的层按上面的规则分给常驻卡，按「常驻层 + MTP 层 + 2 个最大层」算出块数，再换回逻辑字节报给引擎。引擎定下块数后，各卡按块数分配：常驻层各占一段连续显存，别人的层轮流指向 2 个暂存区；最后给每个 attention 层挂上等待点。

下排是每步前向：本批没有任何带历史的请求就整步不广播；否则一开头发第 0 层，之后每层在首次访问缓存前等本层到位、随即发下一层，再做 attention 和其余计算。图按 MLA 的投影位置示意；SFA 融合路径在融合预处理前等待。

## 放到 GLM 双机：这套部署能开 KVPP 吗？

前面讲到，KVPP 要求全模型所有缓存组都是统一块长的纯全注意力层（`FullAttentionSpec`），目前仅面向非混合 MLA/SFA 模型开放。那么遇到像 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)（`2×A2×8`，`TP8 / DP2 / EP16`，`W8A8`）这样的**异构混合架构**，卡点究竟出在哪儿？

除了该双机案例所钉住的旧镜像本身早于 KVPP 合入外，即便切到内置 KVPP 的 `v0.30.0` 或 `main`，启动校验也会明确拦截（报 `KVPP currently supports only non-hybrid MLA models.`）：GLM 主干 45 层里有 34 层是按头切分定长递推状态的 [KDA](linear-attention.md) 线性注意力，只有 11 层是稀疏 MLA，两类截然不同的状态共用同一个物理块池，无法套用 KVPP 单一 `FullAttentionSpec` 预算与整层广播计划（同时 KVPP 仅放行 `eager` 或 `PIECEWISE` 图模式，不支持双机默认开启的全图 Decode 回放）。

尽管启动校验拦住了混合模型，借用 GLM 双机那 11 层稀疏 MLA 的真实字节尺寸做一次**静态变体推演**（无实现、无实测，仅作机制标尺），恰好能把“MLA 去重能省多少字节”与“整层广播每步到底要搬多大体量”两本账算得清清楚楚：

### GLM 的哪一部分缓存，正是 KVPP 想省的？

**GLM 的 11 层稀疏 MLA 加上 MTP 的第 45 层，每层的潜向量和索引器缓存在一台机器的 8 张卡上各存一份，内容完全相同。** 这正是 KVPP 针对的复制。部署页算过：每层每 token 是 1,024 B 潜向量加 64 B 索引器缓存，12 层合计每 token 13,056 B，每张卡都要存这么多（见 [占住一个块号，要用多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）。KDA 的状态不一样：它跟着头一起切，8 张卡存的是各自那几个头的状态，本来就没有复制品（见 [TP 页的 KDA 一节](tensor-parallel.md#kda状态跟着头一起切)）。

两台机器是两个 DP 组，各接各的请求、各存各的历史，彼此也没有复制。所以即使能开，KVPP 的组也只是一台机器上的 8 张卡（TP8 × PCP1），不会跨机器，也不碰 EP16 的专家分工（16 张卡怎么分组见 [部署页](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。

套用前面的规则：11 个主干 MLA 层分给 8 张卡，$11 \div 8 = 1$ 余 $3$，卡 0、1、2 各常驻 2 层（卡 0 是第 3、7 层），卡 3 到卡 7 各常驻 1 层；MTP 的第 45 层不参与划分，每张卡各留一份（块数由最满的卡决定，5 份里有 3 份是暂存区和 MTP 层；以下为每 token 变体推导）：

| 口径（GLM 11 层主干 MLA + 1 层 MTP，每 token 变体推导） | 算式（每层 $1{,}024 + 64 = 1{,}088\text{ B}$） | 每卡每 token 字节 |
| --- | --- | --- |
| 不开 KVPP（当前每卡） | $12\text{ 层} \times 1{,}088\text{ B}$ | **13,056 B** |
| 最满的 3 张卡（2 层常驻 + 1 层 MTP + 2 个暂存区） | $(2 + 1 + 2) \times 1{,}088\text{ B}$ | **5,440 B** |
| 其余 5 张卡（1 层常驻 + 1 层 MTP + 2 个暂存区） | $(1 + 1 + 2) \times 1{,}088\text{ B}$ | **4,352 B** |

这组数只说明 MLA 那部分每 token 的账，不能换算成 GLM 的块数或容量倍数。GLM 的 KV 池里还有 KDA 状态，它和 MLA 页共用同一个块池（见 [为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)），而现在的 KVPP 分配要求所有缓存都是同一种 full attention，混合模型没有对应的算法。

### 整层广播放到 GLM 的尺子上有多大？

**沿用本节的 GLM 变体推导，一层 MLA 的完整缓存约 2.50 GiB，有历史时每层广播都会发送这整份数据。** 这里继续采用部署页的预算算例：每卡 3,855 个块号（见 [剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)），每个块号在每个 MLA 层上占一页主缓存和一页索引器缓存（MTP 层每卡自有、不广播；下表按未增加块数计算，若同预算下实际块数增加，每层广播字节数也会增加）：

| 广播核算项（GLM 变体推导，按 3,855 块算例） | 算式 | 字节数 |
| --- | --- | --- |
| 一层一个块（主缓存 + 索引器） | $655{,}360\text{ B} + 40{,}960\text{ B}$ | **696,320 B** |
| 一层全部块（单层广播载荷） | $3{,}855 \times 696{,}320\text{ B} = 2{,}684{,}313{,}600\text{ B}$ | **$\approx 2.50\text{ GiB}$** |
| 每张卡每步要收（11 层中非本卡常驻的 9 或 10 层） | $(9 \text{ 或 } 10) \times 2.50\text{ GiB}$ | **$\approx 22.5\text{–}25\text{ GiB}$** |

这个量和这一步有几个 token 无关。以 [R1](one-request.md#示例请求-r1-与官方双机部署)（prompt 为 4 个 token 的示例请求）为例：它的第一步是全新的 prefill，整批没有历史，按规则整步不广播；从第一个 decode 步起它有了历史，哪怕整台机器上只有它一条请求、MLA 只用到 1 个块，每层也要把 3,855 块全发一遍。这些字节要传多久，取决于机内卡间链路的实际带宽和广播算法，本站没有测量。

## 常见误解

- **「KVPP 是流水线并行的一种，要多加卡。」** 名字里的「流水」说的是 KV cache 的存放和搬运；TP、EP、PP 的计算分工一点不变，卡数也不变。
- **「常驻卡把这一层的计算也接过去了。」** 没有。每张卡照旧算自己那几个头，常驻卡只是长期保存这一层的历史。
- **「广播只发这一步要用的块。」** 发的是这一层全部已分配的块，不按请求挑。能装的块多几倍，每层要搬的字节就多几倍。
- **「4 张卡分摊，就能省成四分之一。」** 还要算 2 个暂存区和每卡各留一份的 MTP 层，而且拿层最多的卡决定容量；8 层分 4 张卡只省到一半。

- **「开了就更快。」** 它换的是容量。官方测量里大多数首 token 时间上升，单机 32K 有小幅下降，非池化 prefill 吞吐均下降；原来被 KV 容量卡住时，多装下的历史可能换来更高的前缀命中或更少的重算，仍须按负载测量。
- **「一张卡（TP=1）也能靠它装更长的上下文。」** TP=1 又不开 PCP 时组里只有自己，没有复制品，一个字节都省不下。
- **「全新的 prefill 也要等广播。」** 整批都没有历史时整步不广播；但批里只要混进一条 decode 或命中前缀的请求，整步每层都要广播。
- **「开了 KVPP，调度器看到的块一定更多。」** 块规格不变，块数按常驻、草稿和两暂存区的实际成本重算。本页8层示意由6增至12；目标层太少时也可能下降，见前面的短PP段反例。
- **「GLM 里有 MLA 层，所以能开。」** GLM 是 KDA 和稀疏 MLA 的混合模型，启动检查直接拒绝；本站 GLM 双机也没有开。
- **「KVPP 和 DCP 都是分 KV，可以叠着开。」** 两者互斥，同开启动报错。

## 对照源码

### 怎么开

`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）均内置 KVPP，只需一个开关，组大小 `size = TP × PCP` 由并行配置推导、不用单独配。下面示例给出 `--enforce-eager` 写法，在 `v0.30.0` / `main` 上也可改为 `PIECEWISE` 分段图模式（投机与连接器边界见[版本差异](#版本差异)）：

```bash
vllm serve <非混合的 MLA/SFA 模型> \
    --tensor-parallel-size 8 \
    --enforce-eager \
    --additional-config '{"enable_kvpp": true}'
```

- `enable_kvpp` 写在 `--additional-config` 里，默认 `false`，建议使用 JSON 的 `true` / `false`；固定源码通过 Pydantic 的布尔转换校验输入，不能转换时才报错，并非只接受原生 bool。参数页见 [kvpp_config](../params/kvpp-config-0445bd352140.md)。启动命令里已有 `--additional-config` 时，把它并进同一个 JSON。
- 打开后 `KVPPConfig.size = tensor_parallel_size × prefill_context_parallel_size`，没有单独的组大小参数，广播粒度也不可调。`size` 为 1（TP=1 且 PCP=1）时什么都不做，也不跑启动检查。
- 只有 `size > 1` 才建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`；全体 rank 按 DP、PP、PCP、TP 排好后，每个 DP 请求执行组、每个 PP 段的 PCP × TP 张卡各成一组。
- 层分配：`map_kvpp_layers_to_owners` 先按层号排序、剔除 MTP 层（层号在 `num_hidden_layers` 到 `num_hidden_layers + num_nextn_predict_layers` 之间，由 `find_mtp_layers` 找出），再 `divmod(层数, size)`，前 `remainder` 张卡各多一层。bundle 由 `build_layer_cache_bundles` 按层号把主 KV、索引器缓存等捆在一起。
- 预算：`KVPPPhysicalCachePlan.get_num_blocks` 里每块字节 = 常驻（含没有 owner 的 MTP 层）+ `KVPP_SCRATCH_BUFFER_COUNT`（= 2）× 最大 bundle（只在有 owner 的层里取，MTP 层不计入）；worker 的 `_apply_kvpp_memory_budget` 把块数乘回逻辑每块字节报给引擎，引擎再取各卡最小块数。
- 分配：`allocate_kvpp_cache` 给常驻层各开一段按 2 MiB 对齐的连续显存，非本卡的层按目标层序号 `% 2` 轮流指向两个暂存区。V1 runner 在 `_allocate_kv_cache_tensors` 里改走它；V2 在 `attn_utils` 里走它。
- 广播：`BroadcastKVPPTransport.prefetch` 在单独的 NPU 流上先等「缓存就绪」事件，再 `dist.broadcast(..., async_op=True)` 后紧跟 `work.wait()`，记一个完成事件并 `synchronize()`；异步来自 `KVPPScheduler` 里单线程的 `ThreadPoolExecutor`，不是来自 `async_op`。
- 调度：`schedule_forward` 在有历史时立刻给第 0 层发预取；`wait_for_layer` 等上一次预取返回后，马上对下一层 `start_layer_prefetch`。等待点在 MLA 后端投影之后、首次读写缓存之前（`mla_v1.py`），SFA 后端在融合预处理之前（`sfa_v1.py`）。
- 有无历史：V1 runner 看 `num_computed_tokens_cpu` 里有没有大于 0 的；V2 同样判断，开 PCP 时看全局批而不是本 PCP 段；`_dummy_run` 与 V2 的试跑、测显存路径一律按没有历史处理。
- LayerSplit 是 Z.ai 对同类「按层存 KV」做法的叫法，官方 KVPP 指南把它列为底层概念。

**接旧 main 的 Memcache 池还要显式配加载方式。** 先按 [KV Pool 的安装与配置](kv-pool.md#怎么开)准备 SDK、MetaService 和可回连地址，再将下列内容并入服务命令。load_async 在该 worker 默认是 false，而此组合的指南要求 true，不能省略：

```bash
--kv-transfer-config '{
  "kv_connector": "AscendStoreConnector",
  "kv_role": "kv_producer",
  "kv_connector_extra_config": {
    "backend": "memcache",
    "lookup_rpc_port": "0",
    "use_layerwise": false,
    "load_async": true,
    "discard_partial_chunks": true
  }
}'
```

角色可换成 kv_both，两者均可读写前缀。保留整块尾部策略，不打开 consumer_is_to_put 或 KV events。与 PD 的 MooncakeConnectorV2 同机部署时，各 worker 的握手端口还会由基础端口和 rank 推导，应为两个服务保留不重叠端口范围，计数见 [Mooncake 端口](mooncake-connector.md)。这里只列 KVPP 的附加条件，不能代替模型本身的量化、硬件与后端要求。

### 会报什么错

都在启动期抛 `ValueError`。第一条在读开关时就查；其余只在 `size > 1` 时由 `platform.py` 调 `KVPPConfig.validate` 检查，按表中顺序，撞上第一条就停：

| 情形 | 报错 |
|---|---|
| `enable_kvpp` 无法通过 Pydantic 布尔转换 | `additional_config.enable_kvpp must be a boolean, got ...` |
| `decode_context_parallel_size != 1` | `KVPP and DCP cannot be enabled at the same time.` |
| 有 `kv_transfer_config`，连接器不在支持列表（`v0.30.0` 为 `MooncakeConnectorV2` / `AscendStoreConnector`；`main` 另含 `MooncakePushConnector`；均支持 `MultiConnector`） | `KVPP does not support kv connector <name>.`（早期快照 `baa023ad` 报错为 `KVPP PD disaggregation requires MooncakeConnectorV2.`） |
| `MooncakeConnectorV2`（及 `main` 的 `MooncakePushConnector`）且 `kv_role == "kv_consumer"` | `KVPP must be disabled on the decode-only node.` |
| 未设 `--enforce-eager` 且 `cudagraph_mode != CUDAGraphMode.PIECEWISE`（例如 FULL 图模式） | `KVPP supports eager execution or PIECEWISE only.`（早期快照 `baa023ad` 仅支持 eager，报错为 `KVPP currently supports eager execution only; set --enforce-eager.`） |
| `not use_mla or is_hybrid`（GLM 补上执行模式要求后撞这条） | `KVPP currently supports only non-hybrid MLA models.` |
| 投机解码方法不受支持（vLLM 会先把 `deepseek_mtp` 等归一成 `mtp`；`v0.30.0`/`main` 接受固定 `K` 的 `mtp`/`dspark` 等） | `KVPP currently supports speculative decoding only with ...` |
| MTP / DSpark 步数按批量变化或开自适应验证 | `KVPP currently supports only a fixed number of ...` |

还有两条不在 `validate` 里：`create_kvpp_cache_allocation_plan` 要求所有缓存规格都是 `FullAttentionSpec` 且 `block_size` 一致，否则抛 `KVPP requires one full-attention cache group with a common block size.`；main 上用 V1 runner 又设了 PCP > 1，会被通用检查拦下（`PCP (Prefill Context Parallelism) is not supported by vLLM Ascend. ...`），这条不是 KVPP 专有的。

### 开销和什么时候别开

- **容量账**：每卡每块字节从「全部层」变成「常驻层 + MTP 层 + 2 × 最大层」；各卡分别算块数，再取最小值。预算与层大小相同时，拿层最多的卡决定容量。本页示意：8 层分 4 卡是 2 倍，分 8 卡约 2.7 倍，分 2 卡约 1.3 倍。
- **通信账**：每步有历史时，每个参与划分的层广播一次整层 bundle，字节数 = 已分配块数 × 每层每块字节，不按活跃请求或活跃块过滤；容量涨几倍，广播量就涨几倍。GLM 变体推导见上文：每层约 2.50 GiB（按主线算例块数）。

- **官方测量**（main 用户指南；GLM-5.2、950DT；单机 TP8 + EP，双机 TP8 + PP2 + EP、38/40 层分段；eager、Model Runner V1、未开 MTP）：
  - 容量：单机 235,008 → 1,467,904 token，6.25 倍；双机 PP 555,392 → 2,972,416 token，5.35 倍。单机来自池化配置，双机来自非池化启动日志，不能与下面的非池化吞吐拼成同一组实测；两种部署的量化权重也不同，只能各自比较开关前后。
  - 首 token 时间（前缀命中 0%、并发 1）：32K 输入单机 −0.33%、双机 +0.19%；64K 输入单机 +1.52%、双机 +8.53%；128K 输入单机 +3.36%、双机 +11.01%。输入越长，越藏不住。
  - 非池化 prefill 吞吐（128K 输入、并发 12）：单机 −2.30%（命中 0%）/ −5.40%（命中约 90%）；双机 −12.40% / −12.77%。
  - 这些是另一个模型（非混合的 SFA）在另一种硬件上的数，不是本站 GLM-5.3-Flash 双机 A2 的数；本部署没有任何 KVPP 实测。

- **什么时候别开**：TP=1 且 PCP=1（没有复制品）；非混合 MLA/SFA 之外的模型；需要 `FULL` 全图回放（`v0.30.0`/`main` 仅放行 `eager` 或 `PIECEWISE`，不支持全图）；已经开了 DCP；显存并不紧、而对首 token 时间或 prefill 吞吐敏感。官方建议先在受 KV 容量限制的负载上，拿真实的输入长度、并发和前缀分布对比开关前后的容量、时延和吞吐。

Z.ai 的 LayerSplit 文章报告的是 SGLang、GLM-5.1、90%命中率、40K–120K输入的另一组实验。它用索引器计算遮挡主 KV 广播；本文固定 Ascend 路径按完整 bundle 广播、在首次访问缓存前等待，两者的重叠位置与数据布局并不相同。文章中的吞吐收益不能替换上面的 Ascend 测量，也不能外推到本站 A2 GLM 基线。

### 版本差异

**后续官方快照 `921ccc52` 的指南与设计已列出 eager/PIECEWISE 支持。** 投机方法包括固定 K 的 MTP、DSpark，以及不共享目标 KV 的 EAGLE3；动态 K、DCP、hybrid 模型仍在限制范围。Mooncake 逐层池化属于实验能力：AscendStoreConnector 使用 mooncake backend、use_layerwise=true、load_async=false；当前记录的验证是单机 TP8 eager，未覆盖 PP/PCP/DCP，GLM-5.2 的该组合验证仍待完成。每层 owner 先等池加载完成，再广播给其他卡。

这条逐层路径还依赖 Mooncake 客户端的 range/session 接口：按块建立读写会话，再按层传字节范围，结束时提交、撤销或释放会话。配套指南要求包含 Mooncake PR #2881 的七个批量接口；若当前 wheel 没有它们，需按该指南从含接口的版本构建。启动时会检查方法是否存在，方法齐全仍不能证明 ABI、返回码和真实 NPU 行为兼容。安装入口见[官方 Mooncake 逐层指南](https://github.com/vllm-project/vllm-ascend/blob/921ccc52/docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#51-mooncake-version)。

KVPP 的 Mooncake 对象使用独立拓扑命名空间，不能复用普通复制式缓存对象。MultiConnector 还逐个检查子连接器类型与角色：P/D 子连接器用 producer、只在 P 开 KVPP，pool 子连接器另配自身角色与服务；外层角色不能代替子角色。PP 的一般组合声明与上述逐层池化验证范围也不同，且后续 PP 指南仍记录 PP+KVPP 的间歇输出不一致，见 [PP 版本差异](pipeline-parallel.md#版本差异)。

自 `v0.30.0`（含 `main`）起，源码的组合范围已扩展：允许 `eager` 或 `PIECEWISE`（`ValueError("KVPP supports eager execution or PIECEWISE only.")`），投机方法接受 `mtp` / `dspark` 但要求固定 `K`，拒绝按 batch 动态 `K`、DSpark adaptive verification 和 `dynamic_spec_config` 指定的动态长度。早期快照 `baa023ad` 的“只能 eager”不能沿用；若某份用户指南仍只写 eager，需注意指南与源码校验的差异，不能把放宽校验等同于已完成全部 `PIECEWISE` 组合验证。

**`v0.30.0` 与 `main` 均保留 KVPP 的 `TP × PCP` 复制域与连接器白名单边界。** 关闭时 `size = 1`，开启后由 `TP × PCP` 推导，`DCP > 1` 仍被拒绝；共享存储允许 `AscendStoreConnector`，PD 在 `v0.30.0` 允许 `MooncakeConnectorV2`、`main` 新增 `MooncakePushConnector`（两者均支持 `MultiConnector` 且在 `kv_consumer` 上必须关闭 KVPP）。它仍限定非 hybrid MLA，不能把 GLM 混合缓存的每一组都按该尺寸均分，也不能把 `TP × PCP` 当成 DP 或 PP 数。

按四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；例外 B GLM 固定基线 `db701c1f` 同样不含 KVPP 且将 GLM 声明为混合模型，上游 `vllm@0fc695fc` / `vllm@ced6857a` / `vllm@ba15685a` 均不含 KVPP（属 `vllm-ascend` 独有特性）。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| KVPP 代码与开关 | 无 | 无 | 有，默认关；`size = TP × PCP`（`ascend_config.py#L65-L82`） | 同 `v0.30.0`（`ascend_config.py#L69-L86`） |
| 执行模式与模型范围 | 无 | 无 | 放行 `eager` 或 `PIECEWISE`，限定非混合 MLA 模型（`ascend_config.py#L102-L109`）；`kv_cache_placement.py#L21-L205` 校验 2 暂存区、单组 `FullAttentionSpec` 与非共享目标 KV 草稿层 | 同 `v0.30.0`（`ascend_config.py#L109-L116`、`kv_cache_placement.py#L21-L201`） |
| 允许的 KV 连接器与限制 | 无 | 无 | `_KVPP_SUPPORTED_CONNECTORS = ("MooncakeConnectorV2", "AscendStoreConnector")`，支持 `MultiConnector`，`MooncakeConnectorV2` 拒绝 `kv_consumer`（`ascend_config.py#L38, #L87-L100`）；与 `DCP > 1` 互斥 | 新增 `MooncakePushConnector`（同样拒绝 `kv_consumer`，`ascend_config.py#L42, #L91-L108`）；`mooncake_backend.py#L335-L342` 明确拒绝 Mooncake 逐层 CP 与 `enable_kvpp` 同开 |
| GLM 模型与文档状态 | 无 GLM 代码 | 无 GLM 代码 | GLM 声明为混合模型（被 KVPP 校验拒绝）；含用户指南、设计文档与配置说明 | 同 `v0.30.0` |

早期开发快照（`baa023ad`）在 2026-09-11 随 #16094 引入 KVPP，09-15 的 #16444 加上 PD 分离、PCP 和 KV 池。表内配置文档为 `additional_config.md`；用户指南、设计文档和支持矩阵也均有对应入口。

早期 `baa023ad` 的三份官方文档对「能和谁组合」说法不一致：用户指南的支持表写 PCP（需 V2）、PD 分离（MooncakeConnectorV2）、memcache 池化都支持；设计文档第 3 节把 PCP 和 PD 分离列为不支持；`additional_config.md` 写 PCP 可以（需 V2），但不支持 KV 传输连接器。以代码为准：组大小公式 `size = TP × PCP` 乘了 PCP，`validate` 只拦 DCP 和白名单之外的连接器（在 `v0.30.0`/`main` 还支持 `MultiConnector`，`main` 新增 `MooncakePushConnector`）；设计文档和 `additional_config.md` 的旧限制写法与代码不符。

### 源码位置

| 做什么 | 位置 |
|---|---|
| 开关、组大小、启动检查 | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L52-L100`（`KVPPConfig.from_vllm_config` / `validate`） |
| 只在 `size > 1` 时检查；V1 不许 PCP | `vllm-ascend@baa023ad:vllm_ascend/platform.py#L1490-L1502` |
| 建 `kvpp` 通信组 | `vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L60-L89` |
| 2 个暂存区、物理预算、bundle | `vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L18-L56` |
| MTP 层剔除、层分给常驻卡、分配计划 | `vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L107-L178` |
| 块数乘回逻辑字节；按 TP rank 建计划 | `vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L540-L546`；`#L1096-L1103` |
| 引擎取各卡最小块数 | `vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L2072-L2085` |
| 常驻层连续分配、非本卡层轮流指向暂存区 | `vllm-ascend@baa023ad:vllm_ascend/worker/kvpp_cache.py#L30-L57`；V1 入口 `vllm_ascend/worker/model_runner_v1.py#L4772-L4774` |
| 广播本身 | `vllm-ascend@baa023ad:vllm_ascend/distributed/kvpp.py#L9-L36` |
| 挂等待点、提前一层的调度 | `vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L23-L64`；`#L87-L114` |
| 有无历史的判定 | V1 `vllm_ascend/worker/model_runner_v1.py#L2486-L2487`、试跑 `#L4177`；V2 `vllm_ascend/worker/v2/model_states/default.py#L74-L85` |
| attention 里的等待点 | `vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2057-L2061`；`vllm_ascend/attention/sfa_v1.py#L1716-L1719` |
| 外部 KV 池只存常驻层；Mooncake P 侧按常驻登记 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L935-L940`；`vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L214-L246` |
| GLM 声明为混合模型 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2439`；`vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L839`、`#L922-L928` |
| `deepseek_mtp` 归一成 `mtp` | `vllm@0fc695fc:vllm/config/speculative.py#L550-L554` |
| 官方文档 | 用户指南 `docs/source/user_guide/feature_guide/kvpp.md`；设计文档 `docs/source/developer_guide/Design_Documents/kvpp.md`；`docs/source/user_guide/configuration/additional_config.md#L333-L344`；支持矩阵 `docs/source/user_guide/support_matrix/feature_matrix.md#L37` |

待核：

- GLM 这类 KDA 加稀疏 MLA 的混合模型，官方没有 KVPP 的实现，也没有计划说明；本页的 GLM 数字都是变体推导。
- A2 上整层广播的耗时，以及它能被每层计算遮挡多少，缺同硬件实测。
- CPU offload 等其他连接器被拒，是按启动检查代码推断的，缺实跑报错记录；旧 main 的池化限制按指南使用。通用启动校验并未逐项强制这些支持条件，不能把“未启动报错”当作组合验证通过。

容量预算先按层索引划分 owner，再按实际 bundle 字节数计算常驻与暂存空间（来源 4、5）；最大暂存大小只取有 owner 的目标层，MTP 等无 owner 缓存在需要它的 PP 段完整分配（来源 8）。因此按层数均分不等于按字节均衡。

广播流通过就绪与完成事件协调工作（来源 9），执行器判断是否存在历史并逐层等待、预取（来源 11、12），attention 的等待点见来源 16、17。实际等待时长与重叠比例仍需硬件 trace。

`KVPPConfig.from_vllm_config` 在各 DP/PP 内始终按 `size = TP × PCP` 推导通信组大小（`PCP = 1` 时退化为 `TP`；来源 2、3、23）；早期快照用户指南未将 PCP 同时叠加 PD 或 KV 池纳入支持范围，而 `main` 代码另在 `mooncake_backend.py` 明确拒绝 Mooncake 逐层 CP 与 `enable_kvpp` 同开。GLM-5.2 在 950DT 的容量与吞吐是官方报告（来源 25），不证明固定 GLM-5.3-Flash 双机 A2 的支持或收益；后续池化组合的范围见版本差异。

- 来源 32、33：vllm-ascend@baa023ad，docs/source/user_guide/feature_guide/kvpp.md，L19–L28、L36–L48。

来源39给出每次分配额外2MiB及对齐视图；40补单线程预取执行器，41补SFA非融合等待位置。42为LayerSplit原文，相关事故与收益限于文中系统。43给出池加载默认false，旧main组合要求见来源24；44补跨PP/TP分片查找，不只凭常驻层过滤推导命中条件。

来源45列出后续Mooncake逐层路径的七个必需接口及缺失时的启动检查；客户端版本与真实NPU集成须分别验证。
