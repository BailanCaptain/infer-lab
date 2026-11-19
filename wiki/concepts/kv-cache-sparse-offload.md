---
id: kv-cache-sparse-offload
title: Sparse KV offload：历史放主机，每步只搬这次要读的几行
type: feature
summary: >-
  主 attention 的完整历史放在主机内存，设备上只留 indexer cache 和一小块热缓冲；每步 sparse attention
  选完位置，只把热缓冲里缺的行搬回来。讲清它与 CPU offload、抢占换出在存的对象、粒度、取回条件上的区别，一步里的顺序与代价，以及它只支持
  Atlas A3、GLM 双机（A2）为什么用不上。
aliases:
  - Sparse KV Offload
  - 稀疏 KV 卸载
  - sparse_kv_offload
  - SFA
  - resident buffer
  - index_topk
chapters:
  - '11'
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1466-L1533'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L862-L869'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L284-L311'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5878-L5890'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L196-L224'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L346-L393'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1001-L1156'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1215-L1337
  - 'vllm-ascend@baa023ad:csrc/torch_binding.cpp#L2266-L2400'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L213-L297
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L107-L140
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L154-L193
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L22
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L211-L282
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1042-L1090'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L618-L636'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L76-L86
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1645-L1663
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L90-L104
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L23-L27
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L42-L50
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L16-L21
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1064-L1078
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware.py#L16-L76'
  - >-
    raw:sha256-251a0f96459cdfefbae7a7039b8d662f8f3e6447070384f2bc3d8360984c7d09.md#L1-L1130
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L27
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L289-L333
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L391-L437
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L459-L466
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L166
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L320-L333
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L919-L922'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L27
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L289-L333
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L391-L437
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L459-L466
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L166
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L320-L333
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L119-L163
  - 'vllm-ascend@921ccc52:vllm_ascend/ascend_config.py#L1655-L1672'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L29-L143'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L145-L172'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L162-L197'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L528-L574'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1121-L1213'
  - 'vllm-ascend@921ccc52:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L196-L222'
  - 'vllm-ascend@921ccc52:docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L662-L686'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L244-L260'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1684-L1772'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L217-L290'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1480-L1490'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1775-L1855'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L216-L289'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1515-L1526'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: sparse-attention
    kind: builds-on
    note: 先看懂每个查询怎样挑出这一步要读的位置
  - to: kv-cache
    kind: builds-on
    note: 分清哪几类状态要保留，才知道搬走的是哪一份
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样用主机内存，但那边是多存一份副本、按段取回
  - to: pd-disaggregation
    kind: builds-on
    note: 它只能开在 PD 分离的 D 端，先看两端怎样交接历史
  - to: device-memory
    kind: builds-on
    note: >-
      稀疏 KV 卸载的容量规划与搬运代价建立在主机内存、设备内存分别记账以及 H2D 传输的基础上；卸载将主 KV
      放到主机，并未消除容量约束或恢复传输成本。
contradicts: []
updated: '2026-11-10'
origin: gap
rawSources:
  - >-
    raw/sha256-2156c1d8806c7256e4e9cad16b37de3e441fbfb730e387519f6da3ec001a4bd7.md
  - >-
    raw/sha256-251a0f96459cdfefbae7a7039b8d662f8f3e6447070384f2bc3d8360984c7d09.md
  - >-
    raw/sha256-c8ab167c9edc3abbeacc66f4b9dfd5d9146b44ef43da29d04ef3befb85487376.md
---

## 历史全放在主机内存里，每一步只搬回这次要用的几行？

**Sparse KV offload（稀疏 KV 卸载）把主 attention 的完整历史挪到主机内存，设备上只留一小块热缓冲；每一步选出这次要读的位置之后，只把热缓冲里还没有的那几行搬回设备。**

两个前置词先说清楚。[KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的历史，后面每一步都要回头读它；[sparse attention](sparse-attention.md) 让每个查询先从全部历史里挑出一小部分位置，只在这些位置上打分、汇合，没挑中的位置这一次不参与计算——但仍要留着，下一步还要跟着一起挑。挑位置的是 sparse attention 里一个很轻的打分模块 **indexer**：它给全部历史各打一个分，取分最高的若干个；因为要看全部历史，它自己也存一份 indexer cache，和主 attention 的那份历史是两码事。

稀疏读取留下一个空子：**每一步真正读到的只是历史的一小部分，而全部历史都占着显存。** 稀疏卸载就把这份「读得少、占得多」的历史整个放到主机内存，设备上只按「这一步读到什么」保留。挑哪些位置仍由模型决定，它改的只是这些数据从哪里取。

```wiki-diagram
file: kv-cache-sparse-offload
```

先说结论：钉住版本的这套实现只在 Atlas A3 上初始化，本部署是两台 Atlas 800 A2，**用不上它**；本页把它当变体讲清楚，全部门槛见后面的 GLM 一节。

图里历史有 8 个位置，热缓冲有 4 个槽。这一步选中 2、5、6：2 和 6 上一步搬过、还在槽里，5 不在，于是只有 5 这一行从主机搬回来，装进本步没被选中、又最久没用的那个槽。位置 0 被顶掉，但它在主机那份历史里还在，下一步再被选中就再搬一次。

## 为什么不整层搬回来：decode 一步算得太少

把 KV 放到主机不是新想法，难点在于**什么时候搬**。prefill 一次算一大段，有机会让整层搬运与其他层计算重叠，能掩盖多少取决于计算量和带宽；普通 decode 每步每条请求处理一个新 token，投机解码还会验证候选，通常仍比长段 prefill 少，完整层搬运更难被计算掩盖。所以这套实现把两头分开：prefill 侧整层搬，decode 侧只搬这一步选中且热缓冲里缺失的行。

这也决定了它的部署前提：**它按 PD 分离设计**——整层搬的那一半在 prefill 实例上，只搬选中行的这一半在 decode 实例上，两者放在同一个实例只剩调试路径；`v0.30.0` 与 `main` 均只放行 **Atlas A3**（启动即拦 `950PR&950DT` 及与 `PreemptOffloadConnector` 同开，管理器初始化对非 A3 报 `RuntimeError`），`v0.26` 该入口还不判型号，各版本差异见[版本差异](#版本差异)。

搬得少，是因为 sparse attention 已经先挑过一遍。挑完之后还能再省一道：**相邻两步选中的位置常有重合**，上一步搬过的行留在热缓冲里，这一步命中就不用再搬。

代价有四笔：

- **缺失行搬运挡在关键路径上。** 默认 decode 路径先查表、再把缺的行搬进设备，attention 才能开算；全命中时没有历史行载荷，仍要完成计划与必要同步。
- **省多少由模型和输入决定。** 相邻两步选中的集合重合得多就搬得少，重合得少就接近全搬，没法预先保证。
- **主机内存要预先开满**：按后面三条上限里最小的那条一次开好，而且是锁页内存（不会被操作系统换出）。
- **多出一块定额显存。** 热缓冲按「一步最多几个查询行 × 每行热槽数」开好，和上下文多长无关，开了就一直占着。

换来的是设备上不再为主 attention 的历史留整份空间。同样是把数据放到主机，站里另外两种做法存的对象、粒度和取回条件都不一样：

| | Sparse KV offload | [KV cache CPU offload](kv-cache-cpu-offload.md) | [抢占卸载](recompute-cpu-offload.md) |
|---|---|---|---|
| 主机上存什么 | 这些层主 attention 的**完整历史**；设备热槽只缓存选中过的部分 | 可复用前缀状态的**副本**，显存池照常使用 | 被抢占请求已算状态的保存记录 |
| 设备上还有什么 | indexer cache + 热缓冲；不再开完整主 KV 分页池 | 缓存池照旧 | 请求让出块的占用；新计算覆盖前必须完成旧内容保存 |
| 一次搬多大 | 一行 = 一个位置、一层 | 常规路径按前缀段；新版部分尾状态有额外条件 | 已算位置覆盖的有效 KV 块；可复用已保存主机块时无需重拷 |
| 什么时候搬回 | 每一步，本步选中且不在热缓冲的行 | 新请求或重排请求查到可用主机状态时 | 该请求重排且保存已经就绪后 |

最容易混的是第一列和第二列：CPU offload 是**多存一份**，显存那份还在，省的是重算；稀疏卸载是**搬走完整历史**，设备不再分配完整主 KV 分页池，省的是显存。每步先复用热槽命中的行，只有缺失行必须从主机补齐；全部命中时不搬历史行。缺失位置仍要参与本次 attention，不能把主机取回直接替换成前缀备份未命中时的重算流程。

## 一步里搬几行：命中、缺失、换出（示意数）

设一层里的历史有 8 个位置，每个位置一行；一行 1 KiB（示意数）。热缓冲给这个查询在这一层留了 4 个槽——槽是按「查询行」分的，一排槽跟着一个查询走，不同请求不共用同一排。上一步之后，槽里装着位置 0、2、4、6，最久没用的排在前面：0、4、2、6。这一步 indexer 选中 3 个位置：2、5、6。

1. **查表。** 2 在槽里、6 在槽里，都算命中，直接用；5 不在，记成缺失 1 行。
2. **挑槽。** 能腾的只有这一步没被选中的槽：装 0 的和装 4 的。按最久没用先换的顺序，5 装进原来放 0 的那个槽。
3. **搬运。** 从主机读 1 行进这个槽。
4. **换算槽号。** 这一步的清单 2、5、6 换成槽号：2 在第 2 个槽、5 在第 1 个槽、6 在第 4 个槽；attention 按槽号读热缓冲。

5. **更新表。** 槽里现在装着 5、2、4、6，最久没用的顺序变成 4、5、2、6——这一步没被碰的 4 排到了最前面。

以每行 1 KiB 为示意，三种方案本步从主机搬回的载荷如下（省下的 2 行是位置 2 和 6：上一步搬过、仍在热槽里）：

$$B_{\text{H2D}} = N_{\text{miss}} \times B_{\text{row}} = 1 \times 1\text{ KiB} = 1\text{ KiB}$$

| 方案（示意数：一行 1 KiB，本步选中 3 行） | 搬回行数与算式 | 本步 H2D 载荷 |
| --- | --- | --- |
| 不卸载也不稀疏（整段历史常驻设备） | $0 \times 1\text{ KiB}$ | **0 KiB** |
| 卸载后每步搬全部选中行（无热缓冲） | $3 \times 1\text{ KiB}$ | **3 KiB** |
| 卸载 + 热缓冲（仅搬缺失行） | $1 \times 1\text{ KiB}$ | **1 KiB** |

第一行是基准：不卸载时设备上就有全部历史，一步 0 字节搬运，代价是显存要一直装着 8 行。往下两行是卸载之后的两种情况，热缓冲把 3 行压成 1 行。

**重合度不由实现决定。** 下一步若还选 2、5、6，三行全命中，搬 0 行；若选 1、3、7，三行全缺失，搬 3 行。热缓冲只减少搬运，不能省掉这一步选中、但还没到设备的行——那些行必须搬完才能算 attention。

上面的搬运字节数只统计历史行数据，按每行占用相同字节数计算；位置映射、缓存管理元数据和传输协议的额外开销没有计入。因此，零行缺失表示本步无需搬回历史行，不能据此认定整个执行过程没有其他数据传输或管理开销。

**热槽数必须不小于一次选中的位置数。** 上面 4 个槽装得下 3 个选中位置，所以腾得出槽；如果槽比选中的位置还少，就会有选中的位置没地方放。配置里那条「热缓冲不小于 top-k」的检查管的就是这件事。

该实现还要求热缓冲容量是缓存块大小的整数倍。缓存块是框架分配和管理历史状态的单位；能容纳本步全部选中位置与满足块大小对齐，是两项独立约束，两项都满足才能通过对应的启动检查。

## 一步 decode 的顺序：写新行、选、查表、搬、换号、算

```wiki-diagram
file: kv-cache-sparse-offload-step
```

有三处值得单独看：

- **新算出的 K/V 不写完整的设备分页主缓存。** 新行先是设备计算的临时张量，再从设备复制到主机池；它没有先存进一份完整设备历史、再把那份历史卸载的步骤。
- **查表和挑槽在 CPU 上算。** 命中、缺失、换哪个槽都是整数运算，交给主机侧的一段原生代码做（并发时按行分给多个线程）；设备那边只负责按算好的地址表做拷贝。
- **每个启用卸载的稀疏层都有组内等待。** 共同计算同一层的卡组叫 TP 组（[tensor parallel](tensor-parallel.md)），各自调度请求的执行组叫 DP 组（[data parallel](data-parallel.md)）；专家跨 DP 分布时，一组不等于一份完整模型。一个 DP 组的主机池由组内第 0 号卡负责写新行，同组各卡共用这一份；TP 大于 1 时，每层搬回前先确认第 0 号卡已写完，各卡才各自补齐自己缺的行。

还有一条容易被忽略的清理规则：热槽里如果装着**超出稳定前缀**的位置（[MTP](speculative-decoding.md) 草稿那几个还可能被改写的位置），这一步会先把这些槽作废，宁可重搬，也不拿可能过期的行去算。

## 设备上还剩什么

主 attention 的历史搬走以后，设备上留下三类东西：

| 留在设备上的 | 为什么不能搬走 | 多大 |
|---|---|---|
| indexer cache | 它要给**全部**历史打分，才能选出这一步读哪些位置；搬来搬去等于没卸载 | 随上下文长度增长，每张卡各一份 |
| 每层一对热缓冲 | attention 真正读的就是它 | 定额：一步最多几个查询行 × 每行热槽数 × 每个槽的字节 |
| 槽表、缺失清单、地址与句柄缓冲 | 每层一套，记着哪个槽装着哪个位置 | 小，但随并发和层数线性增加 |

「一对」不是 attention 的 K 和 V：[MLA](mla.md) 每个位置只存一条压缩过的潜向量，两块缓冲分别装潜向量段和 RoPE 段，而 GLM 这一配置不保存 RoPE 段，只剩前一块（见 [MLA 的 RoPE 段](mla.md#glm-的这一配置不保存-rope-段)）。

热缓冲的**查询行数**不是并发数，而是一步里最多有几个查询：取「一步的 token 预算」和「最大并发 × 每条请求每步几个 token」里小的那个。开了 [MTP](speculative-decoding.md) 的部署，后者要按每步验证的 token 数算，不是每条请求一个查询行。每一排槽跟着一个查询行走，这一排换给别的请求时整排清空，重新开始攒命中。

主机那一侧按 [data parallel](data-parallel.md) 的请求执行组记账：每个 DP rank 一个池子，要装得下这一组全部请求的完整历史；组内由 [tensor parallel](tensor-parallel.md) 共同计算同一层的那几张卡共用同一片主机内存，每张卡另外持有自己那份 indexer 数据。这里的池归属不表示专家权重也在每个 DP 组完整复制。

## 池子能开多大：三条上限取最小

开了它以后，能装多少个块不再只看显存。`v0.30.0` 与 `main` 的 `plan_sparse_kv_offload_memory` 把三条上限一起算出来，取最小的那条作为最终块数，并在日志里写明 `limiting_factor` 是哪条卡住了：

```wiki-diagram
file: kv-cache-sparse-offload-fig-a3-three-bucket
```

- **设备上限（`npu`）**：可用显存 ÷ 一个块在设备上占的字节（也就是不含主 KV、只含 indexer 等设备侧缓存的那部分）。
- **主机上限（`dram`）**：配置给这个 DP rank 的主机内存（`v0.30.0` / `main` 默认 `dram_size_per_dp_GB = 110` GiB），先扣掉每主机层 `6 MiB`（`3 × 2 MiB`）的最大对齐预留，再除以一个块在主机上占的字节。
- **工作负载上限（`workload`）**：一条满长请求要几个块 × 最大并发，再加 1 个空块。

主机上限比设备上限还小时，实现会专门打一条 warning 提示调大它：主机内存给少了，设备显存再多也用不上。在 `v0.30.0` 与 `main` 中，decode 默认走融合 LIM + Copy-SFA 路径（`topk_buffer_size` 默认 `-1`，自动解析为 `(1 + 投机草稿数) × 2048`，并由运行时另加 2 个尾块，满足 256 对齐且不超过 32,512；`main` 另增 `store_port_base = 8500` 区分多服务端口基址），且与 `PreemptOffloadConnector` 互斥。这也说明卸载没有把容量问题变没，只是把它从显存搬到了主机内存：上下文长度和并发仍受最紧的那条约束，只不过约束的对象换了。

## 放到 GLM 双机：硬件这一关就过不去

**这套部署没有开 Sparse KV offload。** 主线跑的是 GLM 快照 db701c1f，那份代码里根本没有这套实现（见[版本差异](#版本差异)）；下面列的是「假如换到 main」之后仍然过不去的五道门槛。部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。

1. **硬件不对：只支持 Atlas A3，本部署是 Atlas 800 A2。** main 在初始化卸载管理器时先判设备型号，不是 A3 就直接 `RuntimeError`；官方指南写的是支持 A3 与 950PR&950DT 两类节点，但代码只放行 A3（950 系列在型号映射里属于另一档）。这一条与模型、配置都无关，是本部署用不上它的根本原因。
2. **必须是 PD 分离的 D 端。** 不保留设备主 KV 时，实现要求启动参数里配了 KV 传输、且本实例是 kv consumer。主线的启动命令里没有这一项（见[部署页的启动参数](glm-5-3-flash-two-node.md#怎么开)），启动时直接断言失败。PD 分离本身是另一条变体路线，见 [PD 分离](pd-disaggregation.md)。
3. **模型不在支持清单里（这一道不报错，是「官方未验证」）。** 配置侧只检查模型带不带 `index_topk`，GLM 有，过得去；但官方指南列的是 GLM-5.1、GLM-5.2、DeepSeek-V3.2，并写明其他稀疏 attention 模型未验证，GLM-5.3-Flash 不在其中。其余四道都会当场抛异常。
4. **混合缓存布局不支持。** 内存规划先要求全部缓存规格共用一个块大小，管理器还要求只有一个缓存组；仅把块大小改相同仍不够。GLM 的状态分成 5 个组（full 组、尾状态组、3 个 KDA 组，见 [KV 缓存规格](kv-cache-spec.md#对齐成两档页编成五个组)），尾状态组的块大小也不是 640。
5. **热缓冲默认值对不上块大小。** 实现要求热槽数是块大小的整数倍；GLM 的逻辑块是 640 个 token，而默认热缓冲是 4,096，除不尽。既要不小于 `index_topk` = 2,048、又要是 640 的整数倍，最小可用值是 2,560。

假如前四道都放开（换 A3 机器、按 PD 分离部署、模型进清单、缓存布局对齐），按源码公式代入这套部署的其余参数，热缓冲要占的显存是固定的一笔（不受支持的 GLM 布局假设）：

$$M_{\text{hot}} = 12\text{ 层} \times 128\text{ 行} \times (2{,}560 \times 512 \times 2\text{ B}) = 3{,}840\text{ MiB} = 3.75\text{ GiB}$$

| 不受支持的 GLM 布局假设：每卡热缓冲容量 | 算式 | 结果 |
| --- | --- | --- |
| 一步最多查询行数 | $\min(8{,}192,\; 32 \times 4)$ | **128 个查询行** |
| 一个查询行单层容量（2,560 槽 × 512 维 × BF16） | $2{,}560 \times 512 \times 2\text{ B}$ | $2{,}621{,}440\text{ B} =$ **2.5 MiB** |
| 单层全部查询行 | $128 \times 2.5\text{ MiB}$ | **320 MiB** |
| 12 层合计（11 层稀疏 MLA + 1 层 MTP） | $12 \times 320\text{ MiB}$ | $3{,}840\text{ MiB} =$ **3.75 GiB** |

这 3.75 GiB 和上下文多长无关，开了就占着。省下的则随长度增长：每个位置每层的主 KV 是 1,024 B（[一个块号占多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)里 13,056 B 的 12,288 B 那部分），12 层合起来，一条 133,120 个位置的满长请求约 1.52 GiB，32 条约 48.8 GiB——这些都挪到主机，默认给每个 DP rank 的 128 GiB 装得下。留在设备上的是 indexer 的 768 B/token 和尾状态。

有缺失行时还要付搬运代价。继续只做不受支持的 GLM 布局变体估算：每个查询最多读 2,048 个位置再加 0–3 个尾部（清单容量 2,051，见[稀疏什么时候才真的起作用](sparse-attention.md#稀疏什么时候才真的起作用)）。只计 2,048 个主体位置，全不命中时一行一层是 2 MiB，12 层是 24 MiB，128 行合计 3 GiB；若 3 个尾部也全部搬入，还要加 128 × 12 × 3 × 1,024 B = 4.5 MiB。TP8 每张卡各搬自己的完整潜向量，不按卡切。这是载荷估算，不含主机地址计算、TP 同步与链路争用，也不是 GLM 可执行路径的流量实测。收益同时取决于容量压力、命中率、实际带宽和同步成本。v0.26 的用户指南转述 RFC #48203 的实验，说它「有潜力显著提高序列长度或并发」，同一句也写明实际效果取决于模型、硬件和配置；main 的指南已不再写这句。

## 常见误解

- **「它和 CPU offload 一样，是在主机多存一份完整历史。」** 完整主 attention 历史放在主机，设备只保留部分热槽；`keep_device_kv_cache` 设成真才会保留完整设备分页缓存，那是调试用的路径，官方指南写明生产环境保持关闭。

  保留完整设备历史的调试路径仍然占用完整设备缓存，因此不能通过卸载增加可容纳的序列长度或批次容量；实现将它定位为 prefill 与 decode 同部署时的调试选项。
- **「读得少，那存也能少。」** 不行。每一步都重新挑一次，这一步落选的位置下一步照样参与挑选，所以全部历史都要留着，只是留在主机。它省的是显存，不是存储总量。
- **「每个查询读 2,048 个位置，所以每步搬 2,048 行。」** 只搬缺的那些；上一步搬过、还在槽里的不搬。反过来说，最坏情况（全不命中）确实是这一批位置都要搬——GLM 每行清单最多 2,048 个位置加 0–3 个尾部。
- **「热缓冲越大越好。」** 它是定额显存，开大了别处就少了；而且必须不小于 `index_topk`，还要是块大小的整数倍，不是随便填一个数。
- **「GLM 有稀疏 MLA，所以能开。」** 模型带 `index_topk` 只过了模型这一道检查，前面还有硬件只限 A3、必须是 PD 分离的 D 端、缓存不能是混合布局几道，见上一节。（Model Runner V1 这一道主线本来就用 V1，能过。）
- **「开了它，indexer 的缓存也跟着省了。」** 没有。indexer cache 全量留在设备，它要给全部历史打分；卸载搬走的只有主 attention 那一份。

## 对照源码

### 怎么开

先把运行库、主机内存与网络准备好，再检查启动配置。**旧 main 的 A3 指南要求 P、D 两侧都装 MemFabric Hybrid 1.2，驱动至少 25.5.1；P 侧还要 Memcache，D 侧要 Clang 与匹配的 OpenMP。** MemFabric 负责注册内存和搬运，Memcache 管 P 的外部 KV 存储；它们不能用“已安装 vllm-ascend”一句代替。D 侧可先查 `clang --version` 和 Clang 资源目录中的 `include/omp.h`，再核 MemFabric 环境脚本及扩展库路径。依赖安装与 P 侧服务步骤在[固定官方指南](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L29-L143)；网络连通性从[设备网络预检](cann-hccl.md#启动多机前先检查哪一层网络)进入。后续镜像与融合路径的要求按对应版本核对。

先看硬件：官方指南的安装步骤按硬件分组，写的是支持 A3 与 950PR&950DT 两类节点 [C20]；但 main 的代码只放行 A3，不是 A3 就直接 `RuntimeError` [C18]，而 950 系列在型号映射里被判成另一档（A5）[C24]——按这份代码，指南里的第二类机器同样过不去。硬件对了，再在 decode 侧加两段配置（prefill 侧相反，必须关着）[C14][C17]：

```bash
--additional-config '{
    "sparse_kv_offload_config": {
        "enabled": true,
        "topk_buffer_size": 4096,
        "dram_size_per_dp_GB": 128
    }
}' \
--kv-transfer-config '{
    "kv_connector": "SfaRemoteD2HConnector",
    "kv_role": "kv_consumer",
    "kv_port": 20050,
    "kv_connector_extra_config": {
        "transfer_backend": "memfabric",
        "use_layerwise": true
    }
}'
```

- `enabled` 一开，SFA 后端的实现类和 metadata builder 就换成带卸载的那一对，稀疏 MLA 层的缓存规格也被标成「放在主机」[C3]。
- `topk_buffer_size` 是每行的热槽数，要求不小于 `index_topk`，并且能被块大小整除；官方参数表建议取 `index_topk` 的两倍。
- `dram_size_per_dp_GB` 是给每个 DP rank 的主机内存，要装得下这一组的全部主 KV，组内 TP 各卡共用。
- decode 侧要从 `kv_port` 起预留 `DP 数 × TP 数` 个连续端口，端口号按 `kv_port + dp_rank × d_tp_size + tp_rank` 分配 [C12]。
- main 上还有一个 `use_fused_overlap`（默认关），打开后 decode 换成另一条融合路径，本页讲的是默认路径；见[参数页](../params/use-fused-overlap-75a180fff6ab.md)。
- GLM 双机主线的启动参数里没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

以同一主机上 D 侧 DP2、TP8 为示意：每个 DP rank 的主机上限给 128 GiB，两池预算合计 256 GiB；组内 8 个 TP rank 共用池子，不再乘 8。旧 main 实际按规划块数和对齐预留申请，不保证占满配置上限。控制端口则按 DP×TP 分成 16 个，从 20050 到 20065；内存共享不表示端口也共享。其他模型内存、进程与系统占用另留空间，P 侧 Memcache 容量另算。

### 会报什么错

启动时的前置检查，按源码里的顺序 [C1]：

| 情况 | 报什么 |
|---|---|
| 模型 config 里有 `compress_ratios` | `ValueError: Sparse KV offload don't support compress now.` |
| 模型 config 里没有 `index_topk` | `ValueError: Sparse KV offload only support sparse attention model.` |
| 开了 context parallel | `ValueError: Sparse KV offload don't support context parallel now.` |
| 开了 pipeline parallel | `ValueError: Sparse KV offload don't support pipeline parallel now.` |
| 没配 KV 传输、或本实例不是 kv consumer（且 `keep_device_kv_cache` 为假） | `AssertionError: Sparse KV offload is only supported in PD disaggregate scenario and can only be used in D node.` |
| 用了 Model Runner V2 | `ValueError: Sparse KV offload doesn't support model_runner_v2 now.` |
| 热槽数小于 `index_topk` | `ValueError: sparse_kv_offload_config.topk_buffer_size must be >= topk` |

再往后是建对象和分配内存时的检查：热槽数不能被块大小整除 → `ValueError: … must be divisible by block_size` [C5]；主 cache 同时开着 sparse SFA C8 量化 → `NotImplementedError`，报文里写明 indexer 那份 C8 不受影响 [C2]；缓存规格里没有「放在主机」的层、或全部都在主机 → `ValueError`，因为设备侧至少要留 indexer；各缓存组的块大小不一致 → `ValueError: Sparse KV offload memory planning requires one shared block size`，GLM 这类多组混合缓存卡在这里（按代码推断，未实跑）[I][C10]。运行中还有两条：一步的行数超过预留的工作区、metadata 里缺请求编号映射，都直接抛错 [C8]。

还有两条和硬件有关：设备型号不是 A3 → `RuntimeError: Sparse KV offload is only support on A3`，发生在建管理器时，比上面那些配置检查更晚 [C18]；自定义算子没编进来 → `RuntimeError`，报文里直接提示「Rebuild vllm_ascend_C with Atlas A3 support」[C19]。

配置通过后若报 `Sparse KV offload offload.initialize failed.`，还要检查主机注册内存是否实际分配成功。后续官方指南把连续主机内存不足列为主要原因，并回链 MemFabric 前置检查；`free -h` 的总可用量不能替代 A3 的连续内存扫描。按[官方前置检查](https://github.com/vllm-project/vllm-ascend/blob/921ccc52/docs/source/user_guide/feature_guide/kv_cache_pool_ascend_store.md#L662-L686)查看 `mem_scan.py` 的 1 GiB 与 2 MiB 扫描结果，再调整每 DP 预算或 DP 数。内存整理是有条件的运维操作，不是每次启动必执行的步骤。

在 GLM 的块大小（640）上，示例里的默认热缓冲 4,096 除不尽，照抄就起不来 [!]；既要不小于 `index_topk` = 2,048、又要是 640 的整数倍，最小可用值是 2,560 [D]。

### 开销和什么时候别开

- **每层缺失行的 H2D 挡在 attention 前面**：查表、挑槽、算地址在主机侧做，缺失行拷贝完才能算；全命中时历史行载荷为零，默认流程仍有计划和必要同步。搬运量正比于「缺失行数」，不是历史长度 [C8]。

- **全不命中的载荷有多大**：GLM 变体估算只计 2,048 个主体位置为每步每卡 3 GiB，另计最多 3 个尾部为 4.5 MiB；TP8 各搬各的。是否划算还取决于带宽、同步及容量收益 [D]。
- **热缓冲是定额显存**，按「一步最多几个查询行 × 每行热槽数 × 每个槽的字节」一次开满，两块缓冲一起分配 [C11]。
- **主机池要锁页**，并按 2 MiB 对齐，每个主机层预留三份对齐余量；三条上限里哪一条卡住会写进日志。
- **TP 大于 1 时，每个启用卸载的稀疏层有一次广播式等待**，确保 rank 0 的新行写完再各自搬。
- **适合开**：上下文很长、显存装不下全部历史，且相邻步选中的位置重合度高（热缓冲命中率高），部署本来就是 PD 分离。
- **别开**：硬件不是 Atlas A3（本部署的 Atlas 800 A2 就在此列，连管理器都建不起来）[D]；上下文不长（热缓冲这笔定额显存比省下的还多）；模型不是 SFA/MLA 这类稀疏 attention 模型；缓存是混合布局；只有 PD 合置。
- **怎么测**：按层记录实际选中位置、缺失清单和搬回字节，再测 H2D 与同步耗时。默认路径已有缺失计数工作区；它用于生成拷贝计划，不能直接当作已经采集的服务命中率或耗时报告。

### 版本差异

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均以融合 LIM + Copy-SFA 作为默认路径（`use_fused_copy_sfa = enabled and not use_fused_overlap`），并收紧硬件与互斥边界。** 组合部署列出 GLM-5.1、GLM-5.2、DeepSeek-V3.2，D 侧支持 DP/TP，不支持 CP 与 D 侧 PP；启动配置直接拦截 `950PR&950DT`（`is_950()` 报 `ValueError`）以及与 `PreemptOffloadConnector` 同开（经 `MultiConnector` 也拦截），管理器初始化仍只放行 Atlas A3（`RuntimeError: Sparse KV offload is only support on A3`）。主 KV 要求 BF16，不支持 sparse SFA C8；设备上常驻的 LightningIndexer 可以另用 LI C8（`attention_config.indexer_kv_dtype=int8`，不支持 `fp8`）。

在默认参数与三路木桶预算上，`v0.30.0` 与 `main` 将 `topk_buffer_size` 默认改为 `-1`（自动解析为 `(1 + num_speculative_tokens) × 2048`），`dram_size_per_dp_GB` 默认改为 `110` GiB，热槽须满足 256 对齐且不超过 32,512（运行时另自动加 `COPY_SFA_TAIL_BLOCKS` 两个尾块，无需手工多加）；`plan_sparse_kv_offload_memory` 统一按 **NPU 上限、扣除每主机层 `6 MiB`（`3 × 2 MiB`）最大对齐预留后的 DRAM 上限、工作负载上限（`max_blocks_per_request × max_num_seqs + 1`）** 三路木桶取最小值并打印 `limiting_factor`（DRAM 比 NPU 紧时告警）。`main (8d6180e2)` 另新增 `store_port_base: int = 8500` 以区分共享网络命名空间的多服务端口基址。P 端支持 PP（如 GLM-5.2 的 DP1×PP2×TP8 按 38/40 分层），D 端仍固定 PP=1；开启 DSpark 投机解码须配 Model Runner V2。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 实现与配置入口 | 无 | 有：`sfa_kv_offload.py` + `sparse_kv_offload/`；4 个字段，多余键静默忽略 [C15] | 完整配置类校验，默认 `topk_buffer_size=-1`（自动乘 `2048`）、`dram_size_per_dp_GB=110`、`use_fused_overlap=False` | 延续 v0.30.0，另增 `store_port_base=8500` |
| 默认 decode 路径 | 无 | 默认 LRU 常规搬运路径 | 默认走融合 LIM + Copy-SFA（`use_fused_copy_sfa`）；开 `use_fused_overlap` 才切融合重叠路径 | 同 v0.30.0 |
| 容量规划口径 | 无 | 按主机/设备页字节比估算所需主机内存并加回显存额度 [C16] | `plan_sparse_kv_offload_memory` 三路木桶（`npu` / `dram` / `workload`）取最小值并记录瓶颈 | 同 v0.30.0 |
| 硬件、连接器与 Runner 约束 | 无 | 建管理器时不判设备型号 [C23]；仅 MRV1 | 启动拦截 `950PR&950DT` 及 `PreemptOffloadConnector`；管理器仅放行 Atlas A3；支持 MRV2（DSpark 强制 MRV2） | 同 v0.30.0 |
| 官方文档与支持模型 | 无 | 用户指南（GLM-5.2、DeepSeek-V3.2） | 合并 Layerwise Prefill + Sparse Decode 指南与设计文档（GLM-5.1、GLM-5.2、DeepSeek-V3.2） [C13] | 同 v0.30.0 |

固定 GLM 镜像 `db701c1f` 与 `v0.23.0` 一样不包含 `sparse_kv_offload/` 目录，本部署（Atlas 800 A2 + 混部 + 5 组混合缓存）无法启用 [I]。所有存在该实现的版本均维持：主 KV 必须是 BF16、MemFabric 为唯一传输后端、D 端不支持 CP/PP，且联合部署要求 `prefill_tp_size >= decode_tp_size` 且整除 [C14]。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 配置字段、默认 `-1`/`110` 与前置校验 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1684-L1772`；`main (8d6180e2)` 见 `#L1775-L1855`（含 `store_port_base=8500`） |
| 开关换哪两个类 | `vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py`（L284–L311） |
| 把稀疏 MLA 规格标成「放在主机」 | `vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py`（L5878–L5890） |
| 新算出的 K/V 写进主机池与 decode 主流程 | `vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py`（`exec_kv` L346–L393；decode L1001–L1156） |
| 搬运入口、热缓冲公式与 LRU 槽重映射 | `sparse_kv_offload_manager.py`（`onload_topk_kv` L1215–L1337、热缓冲 L107–L140）；`csrc/torch_binding.cpp`（L2266–L2400） |
| 三路木桶预算与仅限 A3 校验 | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L217-L290`、`#L1480-L1490`；`main (8d6180e2)` 见 `#L216-L289`、`#L1515-L1526` |
| 一步 decode 的官方描述 | `docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md`（L154–L193） |

待核：设备运行中热缓冲的实际命中率、主机到设备的有效带宽与单步耗时；GLM-5.3-Flash 会不会进入后续版本的支持清单；混合缓存布局若被放开，GLM 的 5 个缓存组怎样适配分组与块大小要求；默认路径与融合路径的浮点输出是否逐位一致。

搬运算例假设每行 1 KiB，0、1、3 KiB 是缺失行数乘行字节数；实际拷贝按缺失行与槽位组织（来源 8）。这些数只统计历史行载荷，不含映射、管理元数据和协议开销，不能换算成实测带宽或时延。

旧 main 的容量条件有两处：配置检查热缓冲不少于选中行数（来源 1），注意力实现检查块对齐（来源 5）；固定指南同时列出两项约束（来源 14）。后续 Copy-SFA 的额外范围见版本差异。

旧 main 的 `keep_device_kv_cache` 保留完整设备缓存，用于 prefill/decode 同部署调试，不会通过卸载增加序列长度或批次容量（来源 1）。它不是让固定 GLM 基线获得稀疏卸载支持的开关。

安装依赖与 rc2 融合原生接口分别见来源41、42；对齐预留、实际主机池申请与单组约束见43、44；新行临时设备张量到主机的复制见45。后续融合接口和注册内存边界见46，主机扫描入口见47，rc2 的P端PP与38/40分层见48。CPU备份的部分尾状态、抢占保存的就绪与共用块条件分别由[CPU offload](kv-cache-cpu-offload.md)和[抢占卸载](recompute-cpu-offload.md)统一解释。
