---
id: kv-cache-layerwise-offload
title: Layerwise KV offload：KV cache 一层一层搬，边算边搬
type: feature
summary: >-
  把 KV cache 在显存和外部存储之间的搬运，从「整趟前向搬一次」拆成「每层搬一次」，通过提前加载让不同层的搬运与计算重叠。
  讲清重叠条件、能省多少等待（示意数）、每层什么时候要等、共享槽怎样省显存，以及 GLM
  双机主线为什么没开。
aliases:
  - Layerwise KV Offload
  - Layerwise KV Pool
  - 逐层 KV 卸载
  - 逐层 KV 池
  - 逐层缓存传输
  - 边算边搬
  - 共享槽
  - use_layerwise
  - layerwise_prefetch_layers
  - layerwise_num_shared_buffers
  - layerwise_independent_layers
  - shared buffer
  - layerwise_cache_layout
  - SfaRemoteD2HConnector
  - RD2H
chapters:
  - '11'
  - '18'
sources:
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L108
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L253
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L429-L473'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L210-L294
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L297-L381
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1356-L1430
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L277-L290
  - 'vllm-ascend@db701c1f:vllm_ascend/memcache_comm_fence.py#L24-L91'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L250-L258
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L565-L591
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1066-L1077
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L77-L83
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L77-L84
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L176-L182
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn.py#L130-L140'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/kimi_kda.py#L505-L520'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L505-L556
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2495-L2518
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L55-L76
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L409-L430
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/attention/kv_transfer_utils.py#L15-L60
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L365'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L14-L33
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L200-L240
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1728-L1768
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L870-L900
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L620-L632'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L205-L226
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L152-L200
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L334-L365
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L27
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L27
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md
  - 'vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L34-L83'
  - 'vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L115-L198'
  - 'vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/kv_pool.md#L33-L43'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/kimi_kda.py#L675-L706'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L22-L25'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L119-L126'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1320-L1398'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2528-L2593'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L249-L258'
  - 'vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/sfa_remote_d2h_connector.md#L25-L248'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/worker.py#L829-L882'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L145-L162'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L174-L193'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L794-L926'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L625-L650'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2795-L2808'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2874-L2906'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/kimi_kda.py#L714-L741'
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L280-L316"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1282-L1333"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1991-L2006"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L31-L95"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L215-L219"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1722-L1739"
  - "vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1550-L1636"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L230-L242"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L612-L627"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2487-L2514"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2011-L2038"
  - "vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2153-L2166"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L722-L737"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2043-L2072"
  - "vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L2185-L2198"
  - "vllm-ascend@2c59ff10:vllm_ascend/utils.py#L690-L821"
  - "vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L665-L740"
  - "vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L779-L783"
  - "vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L250-L713"
  - "vllm-ascend@baa023ad:vllm_ascend/models/kimi_k3.py#L392-L442"
  - "vllm-ascend@baa023ad:vllm_ascend/ops/kimi_kda.py#L500-L529"
  - "vllm-ascend@7d825229:vllm_ascend/models/kimi_k3.py#L412-L462"
  - "vllm-ascend@7d825229:vllm_ascend/ops/kimi_kda.py#L530-L563"
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L395-L425'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L150-L210'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise/layerwise_cache_layout.py#L120-L190'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L430-L460'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L150-L210'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache-cpu-offload
    kind: builds-on
    note: 同样把 KV cache 放到显存之外；本页按层拆开搬，并和计算重叠
  - to: kv-cache-spec
    kind: builds-on
    note: 缓存规格决定哪些层可以共享物理缓冲区
  - to: pd-disaggregation
    kind: builds-on
    note: P 和 D 消费历史状态的时间不同，决定共享槽与远端读取的完成屏障
  - to: prefix-caching
    kind: builds-on
    note: >-
      本页固定 GLM 配置接入外部池进行逐层搬运时，align 状态留档还要求开启 prefix caching，使状态段长落到
      640；前缀缓存页解释了这一配置下按 640 边界留档的机制。
  - to: kv-pool
    kind: variant-of
    note: 把外部 KV 池的整趟前向搬运细化为逐层流水预取与回写，并支持多层轮用共享物理槽以压缩显存占位
  - to: kv-cache-sparse-offload
    kind: alternative-to
    note: 逐层卸载面向 Prefill 阶段按整层与计算流水重叠（并可用共享槽省显存）；稀疏卸载面向 Decode 阶段把主历史常驻主机、每步仅搬热缓冲缺失行，二者常在 P/D 两侧配合部署
contradicts: []
updated: '2026-11-26'
origin: direct
---

## Layerwise KV offload 是什么？

**Layerwise KV offload 把 KV cache 在显存和外部存储之间的搬运，从「整趟前向搬一次」拆成「每层搬一次」，让不同层的搬运有机会与计算重叠。** 例如，提前发起下一层加载、带宽也够时，算第 L 层的同时可以搬入第 L+1 层的历史、存出第 L−1 层刚写好的缓存。

先用三句话接上前置概念：

- [KV cache](kv-cache.md) 是每一层为算过的位置存下的 K、V，后面的 token 每一步都要回头读它。
- 模型由很多[层](layers-and-hidden.md#hidden-是什么一层又在做什么)串起来，一次前向从第 0 层依次算到最后一层，每一层都有自己的一份 KV cache。
- [KV cache CPU offload](kv-cache-cpu-offload.md) 把 KV cache 在显存之外多存一份，用到时搬回来，省掉重算。本页和它是同一个思路，但走的是另一套连接器：KV cache 存在 [KV Pool](kv-pool.md) 这类外部池里（显存之外的一块存储，按内容存算好的开头，别的实例也能取回）。不同之处在于按层拆开搬，而且和计算叠在一起做。

举个例子。一个 4 层的模型，一条请求的开头已经算过、存在外部，现在要接着算后面的新 token。

- **整趟搬**：先把 4 层的历史全部搬进显存，才开始算第 0 层；4 层都算完，再把这一步新写的缓存 4 层一起存出去。搬的时候计算在等，存的时候也在等。
- **逐层搬**：只等第 0 层的历史到齐就开算。算第 0 层时，第 1 层的历史在路上；算第 1 层时，第 0 层新写的缓存在存出、第 2 层的历史在搬进来……像一条流水线，搬运躲在计算后面。

```wiki-diagram
file: kv-cache-layerwise-offload-overlap
```

图中两条时间轴搬的字节一样多。这是提前加载已启用、双向传输能并行且没有争用的理想排法：逐层搬没有让搬运变快，而是与计算同时做，只在头尾各等一层。实际每层也可能等，下面分别算。

## 为什么能按层拆，又为什么要拆？

**能拆，是因为每一层的 attention 只读这一层自己的历史；要拆，是因为整趟搬时计算在搬运前后干等。**

**能拆。** 第 L 层的 attention 读的是第 L 层存的 K、V，和别的层的缓存无关。所以第 0 层开算时，第 1 层以后的历史还没到也不要紧，只要轮到它之前到齐就行。反过来，第 L 层算完，它这一步新写的缓存就定下来了，后面的层不会再改它，可以马上开始存出。

**要拆。** 整趟搬的做法是：这一步的前向开始之前，把所有要读的历史搬完；前向结束之后，等新缓存全部存出，这一步才算完。开头越长、层数越多，这两段等待越长，而这段时间计算单元什么也不做。上图里整趟搬有 16 ms 在等，逐层搬只有 4 ms。

它的代价：

- **每层多一个等待点。** 本层的历史没到齐，本层就开不了算。每层搬得比算得慢时，等待不再只在头尾，而是在每一层都出现一次（下一节算）。
- **搬的次数变多、每次变小。** 原来一次搬完的数据拆成每层一份，每份都有发起和同步的固定开销。
- **本地已有也要再搬。** 开了逐层以后，只要外部池里有这一段，哪怕显存里还留着，也从第 0 块起按层重新加载一遍。按层搬时，显存里不一定留着每一层的数据（后面讲的共享槽就是这样），实现干脆统一重搬。
- **图模式受限制。** 固定旧连接器声明逐层路径要求分段录图；后续共享槽 prefill 指南进一步要求 eager，也就是不用图回放。只开逐层和复用共享槽的部署条件分别检查，见 [ACL Graph](acl-graph.md)。
- **搬运和计算同时抢带宽。** 叠在一起做，前提是搬运线路和计算用的内存带宽都还有余量。受支持的 A3 网络上还能按流量类别安排谁先走，见 [AI QoS](ai-qos.md)。

## 能省多少时间？用示意数算一遍

**整趟搬 = 全部搬入 + 全部计算 + 全部存出；逐层搬（每层搬得不比算得慢时）= 第一层搬入 + 全部计算 + 最后一层存出。** 中间各层的搬入、存出都藏进了别的层的计算里。

接着用上图的示意数：4 层模型，每层搬入 2 ms、计算 3 ms、存出 2 ms。层数越多，头尾那两份等待越不显眼（例如 32 层时整趟需 $64 + 96 + 64 = 224\text{ ms}$，逐层仅需 $2 + 96 + 2 = 100\text{ ms}$）：

$$T_{\text{layerwise}} = t_{\text{load},0} + L \cdot t_{\text{comp}} + t_{\text{save},L-1} = 2 + 4 \times 3 + 2 = 16\text{ ms}$$

| 4 层模型一次前向（示意数：单层搬入 2 ms、计算 3 ms、存出 2 ms） | 总耗时算式 | 总耗时 | 计算等待时间 |
| --- | --- | --- | --- |
| **整趟搬** | $4 \times 2 + 4 \times 3 + 4 \times 2$ | **28 ms** | **16 ms** |
| **逐层搬（理想重叠）** | $2 + 4 \times 3 + 2$ | **16 ms** | **4 ms** |

这个公式采用理想流水线：**每层搬入和存出都不比可用于重叠的计算慢，两个传输方向可并行，也没有额外带宽争用和同步开销。** 这里把每层 3 ms 都视为可重叠窗口；实际预取门在 attention 开始时打开，不能把此前的所有层计算时间都算作窗口。若把每层搬入改成 4 ms、可重叠计算仍是 3 ms，算第 L 层的 3 ms 里只能搬完第 L+1 层的四分之三，从第 1 层起每层都要多等 1 ms。此时一次前向耗时 $4 + 4 \times 3 + 3 \times 1 + 2 = 21\text{ ms}$，仍比整趟的 $16 + 12 + 8 = 36\text{ ms}$ 快，但等待散到了每一层。

还有一个前提是搬入真的提前发起了：图里画的是「算第 L 层时就在搬第 L+1 层」。如果走到第 L 层才发起第 L 层的搬入，搬入就遮不住，这个例子会变成 $4 \times (2 + 3) + 2 = 22\text{ ms}$。提前几层发起由一个参数决定：旧版（`v0.23.0` 与历史快照）默认值为 1，等于不提前，对应这里的 22 ms；要得到 16 ms 的排法，至少要设为 2。其他版本的默认值见[对照源码](#对照源码)。

## 一层要搬多少，有多少时间可以遮？

**一层要搬的字节 = 开头的位置数 × 每个位置在这一层的缓存字节；能遮它的，是这一步在前一层上算新位置花的时间。** 开头越长，要搬的越多；这一步新算的位置越少，能遮的越少。

沿用 [CPU offload 页的示意模型](kv-cache-cpu-offload.md#搬回和重算各花多少)：32 层，每个位置 32 层共存 128 KiB；开头 4,096 个位置；外部到显存的有效带宽 16 GiB/s；这张卡每秒能算 16,384 个位置（粗算，不细分开头长短对速度的影响）。对比本步新算 512 个与 128 个位置：512 个时刚好遮住，只有 128 个时每层还要多等约 0.73 ms：

$$t_{\text{load,layer}} = \frac{4{,}096 \times (128\text{ KiB} \div 32)}{16\text{ GiB/s}} = \frac{16\text{ MiB}}{16\text{ GiB/s}} \approx 0.98\text{ ms}$$

| 单层搬入与计算对比（示意数：32 层、4,096 开头、16 GiB/s） | 算式 | 数值 | 能否遮住 |
| --- | --- | --- | --- |
| 每个位置在一层的缓存 | $128\text{ KiB} \div 32$ | **4 KiB** | — |
| 一层要搬字节数 | $4{,}096 \times 4\text{ KiB}$ | **16 MiB** | — |
| 一层搬入耗时 | $16\text{ MiB} \div 16\text{ GiB/s}$ | **约 0.98 ms** | — |
| 本步算 512 个新位置的单层计算时间 | $512 \div 16{,}384 \div 32$ | **约 0.98 ms** | 刚好遮住 |
| 本步算 128 个新位置的单层计算时间 | $128 \div 16{,}384 \div 32$ | **约 0.24 ms** | 每层多等约 0.73 ms |

所以同一个开头，后面接一大段新内容时逐层搬最划算；多轮对话里长开头后面只追问一句，每层的计算太短，搬入基本遮不住，每层都在等。存出方向反过来：一层要存的只是这一步新写的位置，512 个新位置在一层只有 2 MiB，比搬入小得多。顺带对照 `v0.30.0` 标准模型 **`Qwen3-8B`**（36 层 GQA，8 个 KV 头、头宽 128，BF16）：单卡 `TP=1` 时每个位置在一层正好也是 $2 \times 8 \times 128 \times 2\text{ B} = 4\text{ KiB}$，4,096 开头单层搬入就是上表的 **`16 MiB`**（`TP=4` 每卡单层降至 **`4 MiB`**）。而且它全模型 36 层规格完全一致，天然契合下文 `memcache` 共享槽轮换。

要判断一套配置到底能遮多少，得同时看设备里给缓存留了多少空间、每层实际搬多少字节、每层的等待事件耗时和整趟前向的时间。有效带宽也要实测：搬入、存出和别的请求共用同一条线路。

## 一层的缓存什么时候搬，什么时候能用，什么时候能覆盖？

**搬入以「第 L 层 attention 开算之前到齐」为界，存出以「传输真正完成」为界；交出存出任务不等于这块显存已经可以给别人用。**

请求走到[模型执行](npu-model-runner.md)后，每层的 attention 入口和出口负责交接这些任务。下图汇总 `v0.30.0` / `main` 的三流并跑时序（明确 `prefetch ≥ 2` 遇到搬慢于算时仍暴露等待，以及末层无 PUT 任务时事件直接置位），并在下半幅用物理槽 `S0`（`L1 → L3` 轮换）的占有条直连两道完成栅栏：

```wiki-diagram
file: kv-cache-layerwise-offload-fig-pipeline-sync
```

搬入方向：

1. 这一步开始前，调度侧已经给要搬的位置借好了本地块，和整趟搬一样（借块和命中的规则见 [KV Pool](kv-pool.md)）。
2. 执行侧走到第 L 层的 attention 之前，先把该发起的搬入交给后台接收线程：第 0 层时一次发起若干层，之后每走一层补发一层，保持同时在搬的层数不变。
3. 提前提交的后续层任务，共用提交时的当前层 attention 开始事件：例如在 L 层提交 L+1 的搬入，等计算流到达 L 层 attention 就可开始搬，不是等 L+1 自己开算。主机下发命令比 NPU 执行跑得快，这道门让搬运跟着设备实际进度走。
4. 第 L 层 attention 开算之前，等第 L 层的搬入完成。

存出方向：

1. 第 L 层 attention 把本层新位置写进显存后，在计算流上记一个事件，再把本层的存出任务交给后台发送线程。
2. 发送线程先等这个事件完成，确认数据真的写好了，才去读这块显存往外写。
3. 传输完成之前，这块显存不能被覆盖；否则外部存储可能收到新旧混在一起的数据。各层独占空间可以避免同一次前向内的跨层覆盖，但下一步或别的请求复用仍要守住完成条件。多层共用一块显存时，下一位使用者必须等上一位存完（见[共享槽](#更进一步显存里只留几层的槽)）。
4. 最后一层走到存出入口时，会等它的完成事件。各层都有存出任务且后台顺序处理时，末层完成表示前面的任务也处理完了；末层没有任务时，事件会直接置位，不能把它当作整条队列已排空的通用证明。固定旧快照还只等 10 秒，超时记日志后继续，传输返回错误也不能当作保存成功。后续版本循环等待并检查后台异常，见[版本差异](#版本差异)。

请求结束时，固定旧逐层路径立即归还块；代码注释的理由是它不登记供延迟释放使用的发送完成事件，延后释放会等不到信号。这是旧实现的资源回收行为，不能反过来证明每层数据已经成功存入池。非逐层路径各版本等待的位置也有变化，统一见 [KV Pool](kv-pool.md#版本差异)。

## 和整趟搬、CPU offload 比：搬什么、按多大搬、什么时候能用

**三者都把 KV cache 放到显存之外；逐层搬和整趟搬搬的是同一批前缀块，只是切法不同，CPU offload 则是另一套存法。**

| | 整趟搬（KV Pool 默认） | 逐层搬（本页） | [CPU offload](kv-cache-cpu-offload.md) |
|---|---|---|---|
| 搬的对象 | 池里按内容指纹命中的前缀块 | 同一批前缀块 | 本机主机内存里的可复用状态；普通完整段与新版部分尾状态分开 |
| 一次搬多大 | 一段 × 全部层，一起搬 | 一层 × 这些块，一层一批 | 普通路径按段；支持部分块时按有效范围 |
| 存储里的一条记录 | 一块覆盖这张卡的所有层 | memcache 后端（KV Pool 可选的一种存储后端）下按层分开登记 | 主机缓冲里的一段 |
| 取回的历史什么时候能用 | 这一步前向开始前全部搬完 | 第 L 层开算前，第 L 层到齐即可 | 搬完以后的某一步；搬的期间请求挂起 |
| 新缓存什么时候算存好 | 固定旧快照在这一步末尾等发送队列排空；后续见 KV Pool 版本表 | 后台处理本层任务后置完成事件；末层等待与旧超时边界见上文 | 后台拷贝完成时 |
| 本地已有时 | 只搬本地缺的 | 池里有就从第 0 块起按层重搬 | 本地有就不搬 |
| 显存占用 | 每层各有自己的块 | 默认同左；可配成只留几层的槽 | 缓存池大小不变 |

PD 分离里还有一个同样按层搬的 `MooncakeLayerwiseConnector`，但对象不同。它是 P（专做 prefill 的实例）每算完一层，就把这层历史直接推给 D（专做 decode 的实例），属于点对点交接，不经过外部池（见 [PD 分离](pd-disaggregation.md)）。

## 更进一步：显存里只留几层的槽

**按层搬以后，一层的数据只在「搬入开始」到「存出完成」这段时间里需要占显存；不同层的这段时间大多不重叠，就可以让几层轮流用同一块显存。** 这是和逐层搬分开的另一个能力：逐层搬改的是时间安排，共享槽改的是显存怎么分。

`v0.26.0rc`、`v0.30.0` 与 `main` 的 memcache 路径实现了这种布局：指定几层独占自己的空间（默认只有第 0 层），其余各层按顺序轮流用 $N$ 个共享槽，第 $k$ 个参与轮换的层用第 $k \bmod N$ 个槽。下面假设 8 个缓存规格完全相同的层，每层的缓存占 $P$ 字节，配 2 个共享槽（外部池、传输工作区和元数据另算）：

```wiki-diagram
file: kv-cache-layerwise-offload
```

$$\text{ratio} = \frac{1P + 2P}{8P} = \frac{3}{8} = 37.5\%$$

| L0 独占 + 7 层轮用 2 个共享槽的显存对比（示意数） | 符号算式 | 占比 | 代入 $P = 16\text{ MiB}$ |
| --- | --- | --- | --- |
| 各层独占（默认不共享） | $8P$ | $100\%$ | **128 MiB** |
| L0 独占 + 2 个共享槽 | $1P + 2P = 3P$ | $37.5\%$ | **48 MiB** |

省下显存的代价是时间上的约束：

- **换人之前要等存完。** S0 先给 L1 用，L3 要搬进 S0，必须等 L1 存出完成。实现里为每个共享槽记着「下一位要等哪一位」。
- **共享槽越少，能提前搬的层越少。** 两个共享槽时，算 L1 的同时最多把 L2 搬进 S1，L3 只能等 L1 让位。提前层数的默认值不超过共享槽数，也不超过 8。
- **每一步都要重搬、重存。** 槽里的数据下一位一来就被覆盖，下一步开始时显存里已经没有这些层的历史。所以开了共享槽，每一步都要把参与轮换各层的全部历史从外部池搬回来；这一步新写的位置也每步都存出，decode 一步只写一个位置、不满一块也存。上一节算的「一层要搬多少」，这时每一步都要付一次。
- **默认不共享。** 不配共享槽数时，槽数等于层数，每层照样一格，只开逐层搬不省显存。

省下的显存用来多切块：启动时把 KV cache 的显存预算乘上「层数 ÷ 实际分出去的格数」，上面的例子是 8 ÷ 3 ≈ 2.67 倍，同样的显存能切出更多块，装下更多、更长的请求。换来的是每一步都在搬全部历史，所以减少槽位不是白捡的：槽少了，预取和存出的窗口变窄，每步搬运更可能遮不住。

**不同规格要分开算。** 实际布局先按每层的主缓存规格分桶，每桶各自分共享槽；合并时还检查同槽各层的规格和字节数完全一致。缓存的数据类型、头数、维度、附加的索引状态、层的类型，任何一项不同都是不同规格。8 层分成两种规格时，每种规格各要自己的槽，不能再用「总共 3 槽」去算。另外，只要真的发生了共用，而模型里又有不是 attention 类的缓存（例如线性 attention 的递推状态），构造时直接报不支持。

搬回已有状态与重建缺失状态是两种工作。某类窗口没有保存时，仅提高搬运速度无法补齐它；[SWA 回放](swa-bounded-replay.md)解释需要重算哪些位置、什么时候会引入近似。分层搬运的依赖与重叠仍按本页核对。

## 同一块 P 端缓冲还要给 D 读，什么时候才能换层？

**联合部署有两道独立的完成条件：存入外部池完成，远端 D 也读完。** 后续的 SFA Remote D2H 连接器让 D 主动从 P 读取：P 通知某层数据就绪，D 将主 KV 拉到自己的主机池、将 indexer 拉到自己的设备，然后回复这一层成功或失败。P 不能仅凭“已经通知 D”就覆盖共享槽。

沿用两个共享槽的示意：L1 用过 S0 后，L3 想搬入同一槽，即使 L1 已存入 Memcache，只要 D 还在读 L1，L3 仍须等待。实现按实际内存地址对应的物理槽等待读取完成，主 KV 与 indexer 的槽分别管理。收到失败回复时会释放等待并抛错，避免无限等；失败不代表数据可用于后续 attention。

这还不同于“整个请求可以在 D 开始 decode”。后者要等映射到该 D rank 的全部 P 贡献者报告最后一层完成，并汇合所有 D TP rank 的终态；全部成功才能消费这批拉取的 KV，失败会标记无效目标块并进入错误处理。P、D 的 TP 数不相等时，有的贡献者可能本层没有块，也仍须回复，不能用“没搬数据”省掉完成消息。连接器的数据读取失败不自动重试。

组合连接器按 RD2H 完成保护先于 AscendStore 复用的顺序执行。它保护的是共享物理缓冲；普通逐层池存取、P/D 点对点交接和 D 侧稀疏热缓存仍是三件事。D 侧主机共享与端口计数见[稀疏卸载的部署配置](kv-cache-sparse-offload.md#怎么开)。

**点对点 Layerwise 推送与池组合时，也需要这道保护，但完成的方向不同。** 后续实现按底层地址为各层归并物理槽：发送任务发布前关闭对应槽的完成事件，发送线程处理完后释放事件，失败则保留错误。组合连接器把这个等待函数交给 AscendStore；有加载任务时先等再覆盖槽，没有加载任务时，也在本层入口等待。这样即使本层只准备重新计算，也不能提前覆盖仍在发送的同一块内存。

这组保护从 v0.26 起存在于指定组合，旧版 `v0.23.0` 与历史快照没有。v0.26 由池连接器的 GVA 逐层条件接入，`v0.30.0` 与 `main` 改由实际 worker 的逐层传输条件接入，且 `main` 已把逐层布局与数据面拆入独立子包 `ascend_store/layerwise/` 解耦。保存入口会先处理负责关闭槽事件的连接器，再处理可能允许复用的池连接器；「本层已写好」的早期通知只是记录计算事件，不能代替这次关闭。这里解释的是物理槽的轮换，单独 Layerwise 的请求结束是否延迟还块仍看[连接器生命周期](mooncake-connector.md#完成通知块什么时候放请求什么时候算)。

## 复杂异构实战对照：GLM 双机为何未启用与每层搬运量

### 放到 GLM 双机：主线没开，开了一层要搬多少？

前面用均匀层的通用模型（4 层 / 8 层 / 32 层）算清了逐层流水与共享槽的代价。下面切入**例外 B 历史绑定算例**[官方双机部署](glm-5-3-flash-two-node.md#部署前提)：它的启动参数里没有 KV 传输配置，连外部池都没接，逐层搬无从谈起。下面只按底稿形状算「要是开了，每层要搬多少」，不给时间数字。

GLM 的层很不均匀（见[模型结构](glm-5-3-flash.md)）：

- 主干 45 层里，只有 11 层稀疏 [MLA](mla.md) 按位置存历史，位于第 3、7、11……43 层，每 4 层一层；MTP 的第 45 层也是 MLA，一共 12 层。
- 另外 34 层是 [KDA](linear-attention.md)，基线每条请求每层预留 4 页、每页 640 KiB，包含当前状态、3 份草稿状态和页内填充。这是预留页容量，不能当作单份有效状态或每次搬运量，三种口径见[线性 attention 页](linear-attention.md#放到-glm-双机34-层-kda-的状态有多大)。
- 一层 MLA 每个位置在每张卡上存 1,088 B（压缩表示 1,024 B + 索引器 64 B，TP 各卡存同一份）。一个块号 640 个位置，12 层合起来 8,355,840 B ≈ 7.969 MiB，推导见[部署页的块大小](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。

借[多条请求页](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)里被抢占的那条请求来感受规模：它约 67,000 个位置，按位置存的那一组占 105 个块。以下 MLA 按 105 个整块全部取回估算；KDA 另列基线预留页容量（含草稿页和填充，接池后实际搬哪些状态、多少块须按 `align` 布局与传输任务另算，不能与 MLA 相加当作实传流量）：

$$B_{\text{MLA,12L}} = 105\text{ 块} \times 7.969\text{ MiB} \approx 836.7\text{ MiB}$$

| MLA 整块取回估算与 KDA 基线页容量（每张卡） | 算式 | 结果 |
| --- | --- | --- |
| 一层 MLA 单块（640 位置 × 1,088 B） | $640 \times 1{,}088\text{ B} = 696{,}320\text{ B}$ | **680 KiB** |
| 一层 MLA（105 块全取） | $105 \times 680\text{ KiB}$ | **约 69.7 MiB** |
| 12 层 MLA 合计 | $105 \times 7.969\text{ MiB}$ | **约 836.7 MiB** |
| 一层 KDA 基线预留页容量（含草稿页与填充） | $4\text{ 页} \times 640\text{ KiB}$ | **2.5 MiB** |

在这个全量取回的假设里，每 4 层有一层 MLA 要读约 69.7 MiB。两层 MLA 之间隔着 3 层 KDA 的计算，如果能提前 4 层发起，就有机会用前面几层的计算覆盖这次搬入。KDA 的 2.5 MiB 只描述未接池基线的页容量；改成 align 留档后，实际任务的状态块数和传输布局要另核。实现能不能正确排层，先看下面这张 GLM 层节拍与两处卡点图：

```wiki-diagram
file: kv-cache-layerwise-offload-fig-glm-cadence
```

先说一件不是卡点的事：AscendStore 要求 KDA 这类线性 attention 状态用 align 缓存模式（按块边界留档，而非只留最新一份）。检测到接入 AscendStore 且为混合模型时，vllm-ascend 会把默认的 none 自动改成 align，所以这里不会报错。它带来的连带要求（GLM 上还要同时开 prefix caching，段长才落到 640）和成本见 [KV Pool 的 GLM 一节](kv-pool.md#放到-glm-双机这套部署没有开-kv-pool)，本页不重讲。

就算要开，钉住的 GLM 快照上还卡在两处（均按代码，未实跑）：

1. **KDA 层不经过逐层入口。** 逐层的「等本层到齐」「交出本层存出」挂在 attention 层上；GLM 快照里 34 层 KDA 的实现没有调用这两个入口，而逐层的层计数只在存出入口加一，MLA 层的计数和实际层号对不上。固定 main 的 KDA 文件补上了这两个入口，但该快照的算子注册表已没有旧 KDA 替换项，不能把“文件里有 hook”当作 GLM 实际会走它；注册与执行的区别见[算子页](ops-and-kernels.md#版本差异)。
2. **换到 `v0.30.0` / `main` 仍有边界限制。** `memcache` 后端配了共享槽时，若模型含 KDA 等非 attention 状态，构造会直接报不支持。`Mooncake` 逐层路径自 `v0.30.0` 起已放开 `PP > 1` 与混合递推状态（更早快照曾拒绝递推状态，详见文末[版本差异](#版本差异)）。此外，全版本仍要求 P/D 两端 TP 一致、PP 各阶段覆盖全部缓存组；`memcache` 不配共享槽时 GLM 能否端到端走通仍未实跑。

## 常见误解

- **「逐层搬让搬运变快了」**——没有。搬的字节一样多，本地已有时还要重搬；省的是等待，把搬运藏进计算里。每层搬得比算得慢时，照样每层都等。
- **「开了逐层，显存就省了」**——只开逐层不省：默认共享槽数等于层数，每层照样有自己的空间。要省显存得另配共享槽；`v0.26.0rc`、`v0.30.0` 和 `main` 的 memcache 路径有这套布局，旧 GLM 快照没有。
- **「配了共享槽，只是省显存」**——还多了搬运：每一步都要把参与轮换各层的全部历史重新搬进来。省下的显存换成了更多块，代价是每步的搬运量。
- **「交出存出任务，这块显存就能给别人用了」**——不能。存出是后台线程在做，交出只是排上了队；要等传输完成，下一位才能用这块显存。
- **「开头越长，逐层越划算」**——不一定。开头越长每层要搬的越多，而能遮它的是这一步新算的位置；长开头后面只追问一句时，每层的计算太短，搬入遮不住。
- **「提前搬的层越多越好」**——提前得越多，占着的临时缓冲越多，提前搬的也和正在算的抢带宽；共享槽模式下，提前层数还受槽数限制。
- **「PD 分离的 MooncakeLayerwiseConnector 就是这个」**——都按层搬，但那是 P 把刚算的历史逐层推给 D 的点对点交接，本页是和外部池之间的存取。

## 对照源码

### 怎么开

先让外部池可用，再开逐层。固定旧指南要求安装并配置 Memcache、启动 MetaService、加载 Memcache/MemFabric 环境，节点间统一 PYTHONHASHSEED；设备传输还要求足够的大页。大页数量须按本机页大小和预算计算，不能把指南里的 200000 页当作所有机器的通用值。后端与内存准备从 [KV Pool 的配置入口](kv-pool.md#怎么开)进入，设备连通性见[网络预检](cann-hccl.md#启动多机前先检查哪一层网络)。

```bash
# GLM 快照 / v0.23 维护分支：逐层只支持 memcache 后端
--kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"backend":"memcache","use_layerwise":true,
    "layerwise_prefetch_layers":2}}'
# v0.26、main 的 memcache 后端另可配共享槽（不配时槽数 = 层数，不共享）
#   "layerwise_num_shared_buffers":2, "layerwise_independent_layers":[0]
```

- `use_layerwise` 是总开关，默认 false，写在 `kv_connector_extra_config` 里 [C1]。producer 负责向池存出，consumer 负责取回，both 兼具两者；具体可用角色还受版本和模型限制。固定旧 consumer 在逐层存出入口直接返回，不往池里存 [C2]；v0.26 起另看 consumer_is_to_put，完整差异见 [KV Pool](kv-pool.md#版本差异)。
- `layerwise_prefetch_layers`：按代码，它是第 0 层时一次发起的层数，含本层，之后每层补一层 [C7]；所以值为 1 时只在走到某层才发起该层，值为 2 才是「算本层、搬下一层」。官方指南把它写成「提前几层」，和代码差一层 [!]。
- 预取门：非本层的搬入要等 attention 开算的事件 [C9]；attention 开算前等本层、attention 写完缓存后交出本层存出。
- 调度侧：开逐层后从第 0 块起查池；池里有就强制加载，且关掉异步加载 [C11]；请求结束时块立即释放。
- GLM 双机主线没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

**旧文档的 D 端支持说明存在冲突。** 同一 GLM 快照的逐层专门指南给了 producer/consumer 和逐层代理示例，KV Pool 总指南却把 use_layerwise 限定在 P 端；旧 consumer 又不进入推进层计数的保存函数。因此不能只把上述配置的角色改成 consumer 就认定旧 D 路径受支持。固定 GLM 混合模型的入口缺口也仍成立。

旧专门指南使用带 `/v1/metaserver` 的逐层代理，普通代理没有这个交接端点。其 host 参数要填 D 能连回的地址，不能填通配地址 0.0.0.0；示例的回环地址仅用于同机。后续 RD2H 联合部署按对应指南的代理与协议配置，不直接套用旧池示例。

同一旧指南还给出三个调节入口：layerwise_max_transfer_blocks 和 layerwise_max_transfer_bytes 分别限制一批传输的块数与字节数，默认 0 表示不设上限；h2d_stagger_us 默认 0，可让 TP rank 错开发起 H2D，减少同时争用。这些调节会改变批量和时序，是否改善耗时需要测量，不能代替前面的预取深度与共享槽限制。

**共享槽 prefill 要按另一组前提部署。** `v0.30.0`、`main` 及配套指南要求 producer、Memcache 和 eager，并列出 MLA、SFA、DSA attention 后端。启动时按指南加 `--enforce-eager`，不能只依据旧连接器的 PIECEWISE 声明判断共享槽支持图回放。与稀疏 D 组合时采用 SFA Remote D2H，P TP 不小于 D TP 且能整除；P/D 都是各自的资源预算，完整配置见[稀疏卸载](kv-cache-sparse-offload.md#怎么开)。

### 会报什么错

- **混合线性 attention 的缓存模式**：接上 AscendStore 时，vllm-ascend 的补丁把混合模型的 `mamba_cache_mode` 从 none 自动改成 align，不报错 [C29]；手动设成 align 以外的值 → `AssertionError: mamba_cache_mode only support 'align' when kv_transfer enabled now!`。调度侧另有一道要求 align 的 `NotImplementedError` [C14]，自动改写之后不会触发。
- **共享槽遇到非 attention 状态**（v0.26、main）：`NotImplementedError`，提示逐层复用只支持 attention 类缓存规格 [C5]；同槽各层规格或字节数不一致 → `ValueError`。
- **共享槽参数不合法**：`layerwise_num_shared_buffers`、`layerwise_prefetch_layers` 小于 1，或独立层号越界 → `ValueError`；传了布尔值 → `TypeError` [C4]。
- **Mooncake 逐层后端的并行与混合模型约束**：早期开发快照（`baa023ad`）在 PP、PCP、DCP 任一 `> 1` 或遇到递推状态时直接报 `ValueError` [C20]；**`v0.30.0` 主基线（`c09d3e20`）** 已支持 `PP > 1`（但要求每个 PP 阶段覆盖全部缓存组，且不含仅草稿组）且 `validate_runtime` 不再因 `has_recurrent_state` 报错，仅拒绝 `PCP > 1` / `DCP > 1` 与 P/D TP 不一致；**`main`（`8d6180e2`）** 进一步放开互斥的 `PCP > 1` 或 `DCP > 1`（禁止同时 `PCP > 1` 与 `DCP > 1`，禁止 CP 与 `enable_kvpp` 同开；`DCP > 1` 时另校验 `put_step >= dcp_size` 以及 `validate_dcp_groups` 拒绝 SWA 与非 align Mamba）。
- **GLM 快照上等太久不报错**：本层搬入或最后一层存出等 10 秒没等到，只打一行 `Layerwise %d load wait timed out` 日志就往下走 [C7]；v0.26、main 改成一直等、后台线程出错时抛出 [C19]。
- **KDA 层计数对不上**（GLM 快照）：Qwen3.5 那类线性 attention 层用空参数调一次存出入口来推进层计数 [C16]，GLM 快照的 KDA 没有这一步；main 的等待和存出入口分别见来源17、38。GLM 快照上的表现未实跑 [I]。
- 官方指南说混合 KV cache 会 `NotImplementedError`，GLM 快照的逐层代码里没有这道检查 [!]，改为把各层映射到各自的缓存组；实际能否跑通见上一条。

### 开销和什么时候别开

- **每层一个同步点**：本层没到齐就阻塞主机线程；搬入慢于计算时，每层都等（见[示意数](#能省多少时间用示意数算一遍)）。
- **图模式限制**：旧连接器声明开了逐层就要 PIECEWISE [C13]；后续共享槽 prefill 指南要求 eager，不能用前一条声明替代后一条部署条件。
- **重搬本地已有的前缀**，多付一份搬入；配了共享槽时更重，每一步都要重搬参与轮换各层的全部历史、每步都存出新位置 [C27]。
- **适合开**：开头长、这一步新算的位置也多（长开头后接一大段新内容）、外部带宽实测足够；或想配共享槽省显存。
- **别开**：多是长开头 + 短追问；模型有线性 attention 等非 attention 状态而又想用共享槽；GLM 这类混合模型停在钉住快照上。
- **怎么测**：日志里的逐层加载、存出等待时间，和整趟前向时间一起看；调提前层数时，同时看显存占用。

### 版本差异

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 清晰区分逐层池存取、P 侧共享槽缓冲复用与 D 侧稀疏卸载。** `AscendStore` 的逐层路径按后端协议分流（memcache 全局地址 vs Mooncake 按块键）；`v0.30.0` 的 Mooncake block-key 路径已支持 TP/PP（要求每 PP 阶段覆盖全部缓存组）与混合缓存组递推状态延后复制，拒绝 `PCP > 1` / `DCP > 1` 与 P/D TP 不一致；`main (8d6180e2)` 进一步放开互斥的 `PCP > 1` 或 `DCP > 1`（禁止 `PCP` 与 `DCP` 同开、禁止 CP 与 `enable_kvpp` 同开，并在 `DCP > 1` 时校验 `put_step >= dcp_size` 与非 SWA / 非 align Mamba 约束）。memcache 预取数取自共享槽布局（`min(槽数, 8)`，槽数默认等于层数），非 GVA 路径默认 2；加载按 10 秒间隔循环等待并检查后台异常，前向末尾先等后台 PUT 队列排空再等末层完成事件。**`main (8d6180e2)` 进一步将逐层池实现从 `ascend_store/` 根目录拆入独立子包 `ascend_store/layerwise/`**（包含 `layerwise_cache_layout.py`、`kv_transfer.py`、`metadata.py`、`pool_scheduler.py`、`pool_worker.py`），并将整趟与逐层逻辑解耦。

与稀疏 decode 卸载组合的官方指南列出 GLM-5.1、GLM-5.2、DeepSeek-V3.2；D 侧稀疏卸载暂不支持 950PR/950DT 且与 `PreemptOffloadConnector` 互斥（见[稀疏卸载版本差异](kv-cache-sparse-offload.md#版本差异)）。本站 A2 的 GLM-5.3-Flash 旧算例不能从该列表自动获得组合支持。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 逐层数据面与代码组织 | 仅 `ascend_store/` 根目录旧实现（与镜像 `db701c1f` 数据面同源） | 新增共享槽布局，等待改为循环并检查异常 | 按后端协议分流（memcache 全局地址 + Mooncake block-key）；末层先排空 PUT 队列再等事件 | 拆出独立子包 `ascend_store/layerwise/`（`layout`/`kv_transfer`/`scheduler`/`worker` 解耦） |
| 支持的后端与混合模型 | 仅 memcache（官方指南） | 同 v0.23.0 | memcache + Mooncake（block-key 支持 TP/PP 与混合组，拒 PCP/DCP 与 P/D 不等 TP） | memcache + Mooncake（block-key 新增互斥 `PCP` 或 `DCP` 支持，拒 PCP+DCP、CP+KVPP 与 `DCP` 下 SWA/非 align Mamba） |
| 提前层数默认与共享槽 | 默认 1；无共享槽 | memcache 取 `min(槽数, 8)`，其余 1；memcache 支持共享槽 | memcache 取 `min(槽数, 8)`，非 GVA 默认 2；memcache 共享槽 prefill 按指南配 eager | 同 v0.30.0 |
| 超时等待与后台异常 | 等 10 秒超时打日志继续（可能读未完数据）[I] | 持续等待，后台异常抛出 | 按 10 秒间隔循环等待并检查后台异常，排空队列后再复用槽 | 同 v0.30.0 |
| KDA 逐层入口 | `2c59ff10` 无 Ascend Kimi 文件；`db701c1f` 旧替换无 wait/save | 仍注册旧 Kimi 实现，无 wait/save | Kimi K3 decoder 直接构造新类，含读取前 wait 与空参数 save 入口 | 同 v0.30.0 |

表中“持续等待”描述事件等待与后台异常检查，不把完成事件等同于每次后端写入均成功。固定旧后台即使收到非零拷贝返回码也会记录错误并置完成事件；使用时须一起检查错误日志。新版只加载角色在等待入口推进层号，和旧版依靠保存入口推进层号不同。

### 源码位置

Layerwise 推送的槽完成事件、发送前关闭和发送后释放见来源 54–56；MultiConnector 的等待传递和保存顺序见 57，v0.26 的池接入及实际覆盖前等待见 58–60。`v0.30.0` / `main` 共享槽布局、连接器 `wait_for_save` 与 Mooncake 逐层后端见下表对应条目。

| 看什么 | 在哪 |
|---|---|
| 开关、后端、角色与 `wait_for_save` | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L395-L425`；`main (8d6180e2)` 见 `#L430-L460`（GLM 快照 L77–L108、L229–L253） |
| attention 里调用的入口 | `vllm_ascend/attention/utils.py`（L429–L473）；上游同类装饰器 `vllm/model_executor/layers/attention/kv_transfer_utils.py`（v0.23.0 L15–L60） |
| 发起、等待、存出、层计数与预取门 | `.../ascend_store/pool_worker.py`（GLM 快照 L277–L290、L1356–L1430）；`vllm_ascend/memcache_comm_fence.py`（L24–L91） |
| 调度侧查池、强制加载、立即释放与 align | `.../ascend_store/pool_scheduler.py`（L77–L84、L176–L182、L250–L258、L565–L591、L1066–L1077）；`patch_mamba_config.py`（GLM 快照 L205–L226） |
| 共享槽布局（`v0.30.0` 与 `main` 拆包路径） | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192`；`main (8d6180e2)` 移至 `.../ascend_store/layerwise/layerwise_cache_layout.py#L120-L190` |
| Mooncake 逐层后端 | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L150-L210`；`main (8d6180e2)` 见 `#L150-L210` |
| 按层数 ÷ 格数放大 KV 预算与共享槽重搬 | `vllm_ascend/worker/worker.py`（L620–L632）；`.../ascend_store/pool_scheduler.py`（L870–L900） |

新增部署依赖、旧代理回连地址及角色冲突分别见来源35–37；main KDA 保存入口见38，默认上限与整数解析见39–40。旧后台处理与完成事件见41，main 只加载角色计数及末层等待见42，v0.26 保存角色门槛见43。联合部署的物理槽、请求终态和失败边界见44，main 实际槽等待与报错见45；两种完成条件不能互相代替。

`v0.30.0`（及 `7d825229` 快照）共享槽默认与分配见来源 46；`v0.30.0` 与 `main` 的 eager、角色和后端要求见 47–48，后续指南见 34。

来源 49 是早期开发主线的完整算子注册函数，未登记旧 `KimiGatedDeltaNetAttention`；新版 Kimi K3 由 decoder 直接构造，不依赖这个旧替换项。固定 GLM 的真实旧注册和缺少逐层调用，统一见[Mooncake 的 GLM 条件](mooncake-connector.md#放到-glm-双机这套部署没有开-mooncake-连接器)。

`v0.30.0`（及 `7d825229` 快照）的默认预取、加载等待、末层队列排空与 KDA 空参数保存分别见来源 50–53；其 KDA 等待入口在同一文件的 549 行，位于状态读取前，不能只从文件末尾的保存调用判断完整时序。

待核：外部池到 NPU 的有效带宽和每层实际计算时间（决定每层能不能遮住）；main 上 memcache 后端不配共享槽时 GLM 能否走通；01 §B3 场景下被抢占请求的历史是否真的在池里；GLM 改为 align 后每层 KDA 实际传输的有效状态、块数与填充范围。
