---
id: kv-cache-layerwise-offload
title: "Layerwise KV offload：KV cache 一层一层搬，边算边搬"
type: feature
summary: 把 KV cache 在显存和外部存储之间的搬运，从「整趟前向搬一次」拆成「每层搬一次」：算第 L 层时，下一层的历史在搬进来，上一层刚写好的缓存在存出去。讲清为什么能按层拆、能省多少等待（示意数）、每层什么时候要等、共享槽怎样省显存，以及 GLM 双机主线为什么没开。
aliases: [Layerwise KV Offload, Layerwise KV Pool, 逐层 KV 卸载, 逐层缓存传输, use_layerwise, layerwise_prefetch_layers, layerwise_num_shared_buffers, shared buffer, layerwise_cache_layout]
chapters: ["11", "18"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L108
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L253
  - vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L429-L473
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L210-L294
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L297-L381
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1356-L1430
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L277-L290
  - vllm-ascend@db701c1f:vllm_ascend/memcache_comm_fence.py#L24-L91
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L250-L258
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L565-L591
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1066-L1077
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L77-L83
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L77-L84
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L176-L182
  - vllm-ascend@db701c1f:vllm_ascend/ops/gdn.py#L130-L140
  - vllm-ascend@baa023ad:vllm_ascend/ops/kimi_kda.py#L505-L520
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L505-L556
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2495-L2518
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L55-L76
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L409-L430
  - vllm@0fc695fc:vllm/model_executor/layers/attention/kv_transfer_utils.py#L15-L60
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L365
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L14-L33
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L200-L240
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1728-L1768
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L870-L900
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L620-L632
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L205-L226
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: kv-cache-cpu-offload, kind: builds-on, note: 同样把 KV cache 放到显存之外；本页按层拆开搬，并和计算重叠}
  - {to: kv-pool, kind: builds-on, note: 在外部缓存生命周期中细化每层的传输时机}
  - {to: kv-cache-spec, kind: builds-on, note: 缓存规格决定哪些层可以共享物理缓冲区}
  - {to: pd-disaggregation, kind: builds-on, note: P和D消费历史状态的时间不同}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## Layerwise KV offload 是什么？

**Layerwise KV offload 把 KV cache 在显存和外部存储之间的搬运，从「整趟前向搬一次」拆成「每层搬一次」：算第 L 层的时候，第 L+1 层要用的历史正在搬进来，第 L−1 层刚写好的缓存正在存出去。**

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

两条时间轴搬的字节一样多。逐层搬没有让搬运变快，它把搬运挪到了计算的同时去做，计算只在头尾各等一层。

## 为什么能按层拆，又为什么要拆？

**能拆，是因为每一层的 attention 只读这一层自己的历史；要拆，是因为整趟搬时计算在搬运前后干等。**

**能拆。** 第 L 层的 attention 读的是第 L 层存的 K、V，和别的层的缓存无关。所以第 0 层开算时，第 1 层以后的历史还没到也不要紧，只要轮到它之前到齐就行。反过来，第 L 层算完，它这一步新写的缓存就定下来了，后面的层不会再改它，可以马上开始存出。

**要拆。** 整趟搬的做法是：这一步的前向开始之前，把所有要读的历史搬完；前向结束之后，等新缓存全部存出，这一步才算完。开头越长、层数越多，这两段等待越长，而这段时间计算单元什么也不做。上图里整趟搬有 16 ms 在等，逐层搬只有 4 ms。

它的代价：

- **每层多一个等待点。** 本层的历史没到齐，本层就开不了算。每层搬得比算得慢时，等待不再只在头尾，而是在每一层都出现一次（下一节算）。
- **搬的次数变多、每次变小。** 原来一次搬完的数据拆成每层一份，每份都有发起和同步的固定开销。
- **本地已有也要再搬。** 开了逐层以后，只要外部池里有这一段，哪怕显存里还留着，也从第 0 块起按层重新加载一遍。按层搬时，显存里不一定留着每一层的数据（后面讲的共享槽就是这样），实现干脆统一重搬。
- **整张计算图录不下来。** 每层中间要停下来等主机那边的搬运线程，整趟前向没法录成一张图一次回放，开逐层时要退回分段录图，见 [ACL Graph](acl-graph.md)。
- **搬运和计算同时抢带宽。** 叠在一起做，前提是搬运线路和计算用的内存带宽都还有余量。

## 能省多少时间？用示意数算一遍

**整趟搬 = 全部搬入 + 全部计算 + 全部存出；逐层搬（每层搬得不比算得慢时）= 第一层搬入 + 全部计算 + 最后一层存出。** 中间各层的搬入、存出都藏进了别的层的计算里。

接着用上图的示意数：4 层，每层搬入 2 ms、计算 3 ms、存出 2 ms。

```calc
title: 4 层模型一次前向：整趟搬和逐层搬（示意数）
整趟 = 4 × 2 ms + 4 × 3 ms + 4 × 2 ms = 8 + 12 + 8 = 28 ms
逐层 = 2 ms（第 0 层搬入）+ 4 × 3 ms + 2 ms（第 3 层存出） = 16 ms
计算在等（整趟） = 8 + 8 = 16 ms
计算在等（逐层） = 2 + 2 = 4 ms
> 层数越多，头尾那两份越不显眼：32 层时整趟 64 + 96 + 64 = 224 ms，逐层 2 + 96 + 2 = 100 ms
```

这个公式有一个前提：**每层的搬入不比每层的计算慢**。把每层搬入改成 4 ms、计算仍是 3 ms，算第 L 层的 3 ms 里只能搬完第 L+1 层的四分之三，从第 1 层起每层都要多等 1 ms：一次前向 = 4（第 0 层搬入）+ 4 × 3 + 3 × 1 + 2（第 3 层存出）= 21 ms。仍比整趟的 16 + 12 + 8 = 36 ms 快，但等待散到了每一层。

还有一个前提是搬入真的提前发起了：图里画的是「算第 L 层时就在搬第 L+1 层」。如果走到第 L 层才发起第 L 层的搬入，搬入就遮不住，这个例子会变成 4 × (2 + 3) + 2 = 22 ms。提前几层发起由一个参数决定：钉住的 GLM 快照默认值为 1，等于不提前，就是这里 22 ms 的情形；要得到 16 ms 的排法，至少要设为 2。其他版本的默认值见对照源码。

## 一层要搬多少，有多少时间可以遮？

**一层要搬的字节 = 开头的位置数 × 每个位置在这一层的缓存字节；能遮它的，是这一步在前一层上算新位置花的时间。** 开头越长，要搬的越多；这一步新算的位置越少，能遮的越少。

沿用 [CPU offload 页的示意模型](kv-cache-cpu-offload.md#搬回和重算各花多少)：32 层，每个位置 32 层共存 128 KiB；开头 4,096 个位置；外部到显存的有效带宽 16 GiB/s；这张卡每秒能算 16,384 个位置（粗算，不细分开头长短对速度的影响）。

```calc
title: 一层的搬入和一层的计算（示意数）
每个位置在一层的缓存 = 128 KiB ÷ 32 层 = 4 KiB
一层要搬 = 4,096 位置 × 4 KiB = 16 MiB
一层搬入 = 16 MiB ÷ 16 GiB/s ≈ 0.98 ms
这一步算 512 个新位置，一层的计算 = 512 ÷ 16,384 位置/s ÷ 32 层 ≈ 0.98 ms
这一步只算 128 个新位置，一层的计算 = 128 ÷ 16,384 位置/s ÷ 32 层 ≈ 0.24 ms
> 512 个新位置时刚好遮住；只有 128 个时，每层还要多等约 0.73 ms
```

所以同一个开头，后面接一大段新内容时逐层搬最划算；多轮对话里长开头后面只追问一句，每层的计算太短，搬入基本遮不住，每层都在等。存出方向反过来：一层要存的只是这一步新写的位置，512 个新位置在一层只有 2 MiB，比搬入小得多。

要判断一套配置到底能遮多少，得同时看设备里给缓存留了多少空间、每层实际搬多少字节、每层的等待事件耗时和整趟前向的时间。有效带宽也要实测：搬入、存出和别的请求共用同一条线路。

## 一层的缓存什么时候搬，什么时候能用，什么时候能覆盖？

**搬入以「第 L 层 attention 开算之前到齐」为界，存出以「传输真正完成」为界；交出存出任务不等于这块显存已经可以给别人用。**

搬入方向：

1. 这一步开始前，调度侧已经给要搬的位置借好了本地块，和整趟搬一样（借块和命中的规则见 [KV Pool](kv-pool.md)）。
2. 执行侧走到第 L 层的 attention 之前，先把该发起的搬入交给后台接收线程：第 0 层时一次发起若干层，之后每走一层补发一层，保持同时在搬的层数不变。
3. 提前发起的那几层不会立刻动手，要等计算流真的走到本层 attention 才开始搬。主机下发命令比 NPU 执行跑得快，这道门让搬运跟着 NPU 的实际进度走，不去和前面还没执行完的计算、通信抢线路。
4. 第 L 层 attention 开算之前，等第 L 层的搬入完成。

存出方向：

1. 第 L 层 attention 把本层新位置写进显存后，在计算流上记一个事件，再把本层的存出任务交给后台发送线程。
2. 发送线程先等这个事件完成，确认数据真的写好了，才去读这块显存往外写。
3. 传输完成之前，这块显存不能被覆盖；否则外部存储可能收到新旧混在一起的数据。每层各有自己空间时不存在这个问题；多层共用一块显存时，下一位使用者必须等上一位存完（见[共享槽](#更进一步显存里只留几层的槽)）。
4. 最后一层交出存出任务后，前向当场等最后一层存完；发送线程按顺序处理，最后一层完了就是全部完了。请求结束时，它的块也立刻归还，不像整趟搬那样延后释放。代码注释给的理由是：逐层模式不登记发送完成事件，延后释放的块等不到释放信号，会一直占着。

## 和整趟搬、CPU offload 比：搬什么、按多大搬、什么时候能用

**三者都把 KV cache 放到显存之外；逐层搬和整趟搬搬的是同一批前缀块，只是切法不同，CPU offload 则是另一套存法。**

| | 整趟搬（KV Pool 默认） | 逐层搬（本页） | [CPU offload](kv-cache-cpu-offload.md) |
|---|---|---|---|
| 搬的对象 | 池里按内容指纹命中的前缀块 | 同一批前缀块 | 本机主机内存里的完整段 |
| 一次搬多大 | 一段 × 全部层，一起搬 | 一层 × 这些块，一层一批 | 一段（若干页）× 全部层 |
| 存储里的一条记录 | 一块覆盖这张卡的所有层 | memcache 后端（KV Pool 可选的一种存储后端）下按层分开登记 | 主机缓冲里的一段 |
| 取回的历史什么时候能用 | 这一步前向开始前全部搬完 | 第 L 层开算前，第 L 层到齐即可 | 搬完以后的某一步；搬的期间请求挂起 |
| 新缓存什么时候算存好 | 这一步末尾等发送队列排空 | 每层交出即走，前向末尾等最后一层 | 后台拷贝完成时 |
| 本地已有时 | 只搬本地缺的 | 池里有就从第 0 块起按层重搬 | 本地有就不搬 |
| 显存占用 | 每层各有自己的块 | 默认同左；可配成只留几层的槽 | 缓存池大小不变 |

PD 分离里还有一个同样按层搬的 MooncakeLayerwiseConnector，但对象不同：它是 P（专做 prefill 的实例）每算完一层，就把这层历史直接推给 D（专做 decode 的实例），点对点交接，不经过外部池，见 [PD 分离](pd-disaggregation.md)。

## 更进一步：显存里只留几层的槽

**按层搬以后，一层的数据只在「搬入开始」到「存出完成」这段时间里需要占显存；不同层的这段时间大多不重叠，就可以让几层轮流用同一块显存。** 这是和逐层搬分开的另一个能力：逐层搬改的是时间安排，共享槽改的是显存怎么分。

v0.26 分支和 main 的 memcache 后端实现了这种布局：指定几层独占自己的空间（默认只有第 0 层），其余各层按顺序轮流用 N 个共享槽，第 k 个参与轮换的层用第 k mod N 个槽。下面假设 8 个缓存规格完全相同的层，每层的缓存占 P 字节，配两个共享槽：

```wiki-diagram
file: kv-cache-layerwise-offload
```

```calc
title: L0 独占 + 7 层轮用 2 个共享槽：显存省多少（示意数）
各层独占 = 8 × P = 8P
L0 独占 + 两个共享槽 = 1P + 2P = 3P
比例 = 3P ÷ 8P = 37.5%
P = 16 MiB（接上一节的一层）时 = 8 × 16 MiB = 128 MiB → 3 × 16 MiB = 48 MiB
> 外部池、传输工作区和元数据另算
```

省下显存的代价是时间上的约束：

- **换人之前要等存完。** S0 先给 L1 用，L3 要搬进 S0，必须等 L1 存出完成。实现里为每个共享槽记着「下一位要等哪一位」。
- **共享槽越少，能提前搬的层越少。** 两个共享槽时，算 L1 的同时最多把 L2 搬进 S1，L3 只能等 L1 让位。提前层数的默认值不超过共享槽数，也不超过 8。
- **每一步都要重搬、重存。** 槽里的数据下一位一来就被覆盖，下一步开始时显存里已经没有这些层的历史。所以开了共享槽，每一步都要把参与轮换各层的全部历史从外部池搬回来；这一步新写的位置也每步都存出，decode 一步只写一个位置、不满一块也存。上一节算的「一层要搬多少」，这时每一步都要付一次。
- **默认不共享。** 不配共享槽数时，槽数等于层数，每层照样一格，只开逐层搬不省显存。

省下的显存用来多切块：启动时把 KV cache 的显存预算乘上「层数 ÷ 实际分出去的格数」，上面的例子是 8 ÷ 3 ≈ 2.67 倍，同样的显存能切出更多块，装下更多、更长的请求。换来的是每一步都在搬全部历史，所以减少槽位不是白捡的：槽少了，预取和存出的窗口变窄，每步搬运更可能遮不住。

**不同规格要分开算。** 实际布局先按每层的主缓存规格分桶，每桶各自分共享槽；合并时还检查同槽各层的规格和字节数完全一致。缓存的数据类型、头数、维度、附加的索引状态、层的类型，任何一项不同都是不同规格。8 层分成两种规格时，每种规格各要自己的槽，不能再用「总共 3 槽」去算。另外，只要真的发生了共用，而模型里又有不是 attention 类的缓存（例如线性 attention 的递推状态），构造时直接报不支持。

## 放到 GLM 双机：主线没开，开了一层要搬多少？

**[官方双机部署](glm-5-3-flash-two-node.md#部署前提)没有开：启动参数里没有 KV 传输配置，连外部池都没接，逐层搬无从谈起。** 下面只按底稿的形状算「要是开了，每层要搬多少」，不给时间数字。

GLM 的层很不均匀（见[模型结构](glm-5-3-flash.md)）：

- 主干 45 层里，只有 11 层稀疏 [MLA](mla.md) 按位置存历史，位于第 3、7、11……43 层，每 4 层一层；MTP 的第 45 层也是 MLA，一共 12 层。
- 另外 34 层是 [KDA](linear-attention.md)，每条请求每层存一份固定大小的递推状态，和开头多长无关；一份占 4 页、每页 640 KiB，来历见[线性 attention 页](linear-attention.md#放到-glm-双机34-层-kda-的状态有多大)。
- 一层 MLA 每个位置在每张卡上存 1,088 B（压缩表示 1,024 B + 索引器 64 B，TP 各卡存同一份）。一个块号 640 个位置，12 层合起来 8,355,840 B ≈ 7.969 MiB，推导见[部署页的块大小](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。

借[多条请求页](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)里被抢占的那条请求来感受规模：它约 67,000 个位置，按位置存的那一组占 105 个块。假如它的历史在外部池里、回来时按层取回：

```calc
title: 被抢占的那条要是按层取回，每层搬多少（每张卡）
一层 MLA 一块 = 640 位置 × 1,088 B = 696,320 B = 680 KiB
一层 MLA = 105 块 × 680 KiB ≈ 69.7 MiB
12 层 MLA 合计 = 105 块 × 7.969 MiB ≈ 836.7 MiB
一层 KDA（一条请求） = 4 页 × 640 KiB = 2.5 MiB
> 大头集中在 12 层 MLA；其余 34 层每层只有 2.5 MiB 固定状态
```

这个形状对逐层搬有两面：搬运量很不均匀，每 4 层才来一个 69.7 MiB 的大块；两层 MLA 之间隔着 3 层 KDA 的计算，如果能提前 4 层发起，一层 MLA 的搬入可以摊在前面几层的计算里。实现能不能这样排，取决于它怎样给 KDA 层计数，下面第 1 处卡点就是这个问题。

先说一件不是卡点的事：AscendStore 要求 KDA 这类线性 attention 状态用 align 缓存模式（按块的边界留档，而不是只留最新一份），而 vllm-ascend 在检测到接的是 AscendStore、模型又是混合模型时，会把默认的 none 自动改成 align，所以这里不会报错。它带来的连带要求（GLM 上还要同时开 prefix caching，段长才落到 640）和成本见 [KV Pool 的 GLM 一节](kv-pool.md#放到-glm-双机这套部署没有开-kv-pool)，本页不重讲。

就算要开，钉住的 GLM 快照上还卡在两处（均按代码，未实跑）：

1. **KDA 层不经过逐层入口。** 逐层的「等本层到齐」「交出本层存出」挂在 attention 层上；GLM 快照里 34 层 KDA 的实现没有调用这两个入口，而逐层的层计数只在存出入口加一，MLA 层的计数和实际层号对不上。main 上的 KDA 实现补上了这两个入口。
2. **换到 main 也还有两道限制。** Mooncake 后端的逐层遇到带递推状态的混合模型直接报错；memcache 后端一旦配了共享槽，模型里又有 KDA 这类非 attention 状态，也会报不支持。memcache 不配共享槽时能否走通，没有核到。

待核：外部池到 NPU 的有效带宽和每层实际计算时间（决定每层能不能遮住）；main 上 memcache 后端不配共享槽时 GLM 能否走通；01 §B3 场景下被抢占请求的历史是否真的在池里。

## 常见误解

- **「逐层搬让搬运变快了」**——没有。搬的字节一样多，本地已有时还要重搬；省的是等待，把搬运藏进计算里。每层搬得比算得慢时，照样每层都等。
- **「开了逐层，显存就省了」**——只开逐层不省：默认共享槽数等于层数，每层照样有自己的空间。要省显存得另配共享槽，而且只有 v0.26 和 main 的 memcache 后端有这套布局。
- **「配了共享槽，只是省显存」**——还多了搬运：每一步都要把参与轮换各层的全部历史重新搬进来。省下的显存换成了更多块，代价是每步的搬运量。
- **「交出存出任务，这块显存就能给别人用了」**——不能。存出是后台线程在做，交出只是排上了队；要等传输完成，下一位才能用这块显存。
- **「开头越长，逐层越划算」**——不一定。开头越长每层要搬的越多，而能遮它的是这一步新算的位置；长开头后面只追问一句时，每层的计算太短，搬入遮不住。
- **「提前搬的层越多越好」**——提前得越多，占着的临时缓冲越多，提前搬的也和正在算的抢带宽；共享槽模式下，提前层数还受槽数限制。
- **「PD 分离的 MooncakeLayerwiseConnector 就是这个」**——都按层搬，但那是 P 把刚算的历史逐层推给 D 的点对点交接，本页是和外部池之间的存取。

## 对照源码

### 怎么开

```bash
# GLM 快照 / v0.23 维护分支：逐层只支持 memcache 后端
--kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_both",
  "kv_connector_extra_config":{"backend":"memcache","use_layerwise":true,
    "layerwise_prefetch_layers":2}}'
# v0.26、main 的 memcache 后端另可配共享槽（不配时槽数 = 层数，不共享）
#   "layerwise_num_shared_buffers":2, "layerwise_independent_layers":[0]
```

- `use_layerwise` 是总开关，默认 false，写在 `kv_connector_extra_config` 里 [C1]。PD 分离时 `kv_role` 改成 `kv_producer` / `kv_consumer`，并换用官方的逐层代理；`kv_consumer` 在逐层存出入口直接返回，不往池里存 [C2]。
- `layerwise_prefetch_layers`：按代码，它是第 0 层时一次发起的层数，含本层，之后每层补一层 [C7]；所以值为 1 时只在走到某层才发起该层，值为 2 才是「算本层、搬下一层」。官方指南把它写成「提前几层」，和代码差一层 [!]。
- 预取门：非本层的搬入要等 attention 开算的事件 [C9]；attention 开算前等本层、attention 写完缓存后交出本层存出。
- 调度侧：开逐层后从第 0 块起查池；池里有就强制加载，且关掉异步加载 [C11]；请求结束时块立即释放。
- GLM 双机主线没有 `--kv-transfer-config`，见[部署页](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

- **混合线性 attention 的缓存模式**：接上 AscendStore 时，vllm-ascend 的补丁把混合模型的 `mamba_cache_mode` 从 none 自动改成 align，不报错 [C29]；手动设成 align 以外的值 → `AssertionError: mamba_cache_mode only support 'align' when kv_transfer enabled now!`。调度侧另有一道要求 align 的 `NotImplementedError` [C14]，自动改写之后不会触发。
- **共享槽遇到非 attention 状态**（v0.26、main）：`NotImplementedError`，提示逐层复用只支持 attention 类缓存规格 [C5]；同槽各层规格或字节数不一致 → `ValueError`。
- **共享槽参数不合法**：`layerwise_num_shared_buffers`、`layerwise_prefetch_layers` 小于 1，或独立层号越界 → `ValueError`；传了布尔值 → `TypeError` [C4]。
- **main 上 Mooncake 后端**：PP、PCP、DCP 任一大于 1 → `ValueError`（只支持纯 TP）；混合模型带递推状态 → `ValueError` [C20]。
- **GLM 快照上等太久不报错**：本层搬入或最后一层存出等 10 秒没等到，只打一行 `Layerwise %d load wait timed out` 日志就往下走 [C7]；v0.26、main 改成一直等、后台线程出错时抛出 [C19]。
- **KDA 层计数对不上**（GLM 快照）：Qwen3.5 那类线性 attention 层用空参数调一次存出入口来推进层计数 [C16]，GLM 快照的 KDA 没有这一步，main 补上了 [C17]；GLM 快照上的表现未实跑 [I]。
- 官方指南说混合 KV cache 会 `NotImplementedError`，GLM 快照的逐层代码里没有这道检查 [!]，改为把各层映射到各自的缓存组；实际能否跑通见上一条。

### 开销和什么时候别开

- **每层一个同步点**：本层没到齐就阻塞主机线程；搬入慢于计算时，每层都等（见[示意数](#能省多少时间用示意数算一遍)）。
- **图模式退到分段**：连接器声明开了逐层就要 PIECEWISE [C13]，整图回放的收益没了。
- **重搬本地已有的前缀**，多付一份搬入；配了共享槽时更重，每一步都要重搬参与轮换各层的全部历史、每步都存出新位置 [C27]。
- **适合开**：开头长、这一步新算的位置也多（长开头后接一大段新内容）、外部带宽实测足够；或想配共享槽省显存。
- **别开**：多是长开头 + 短追问；模型有线性 attention 等非 attention 状态而又想用共享槽；GLM 这类混合模型停在钉住快照上。
- **怎么测**：日志里的逐层加载、存出等待时间，和整趟前向时间一起看；调提前层数时，同时看显存占用。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 / GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad | 意味着什么 |
|---|---|---|---|---|
| 逐层代码 | 两者逐字相同 | 新增共享槽布局，等待改为一直等 | 再按后端协议分成两种数据面 | GLM 快照的行为就是 v0.23 的行为 |
| 支持的后端 | 只有 memcache（官方指南） | 同左 | memcache（全局地址）和 Mooncake（按块的键）两种 | main 起 Mooncake 也能逐层 |
| 提前层数默认 | 1 | memcache 取 min(槽数, 8)，槽数默认等于层数；其余 1 | memcache 同左；其余 2 | 同一份配置换版本，重叠程度会变 |
| 共享槽 | 无 | 有（memcache） | 有（memcache） | 省显存只在后两版可配 |
| 等超时 | 等 10 秒后照常往下走 | 一直等，出错抛出 | 一直等，出错抛出 | 旧版超时后可能读到没搬完的数据（按代码推断）[I] |
| KDA 层接入逐层入口 | 无 | 无 | 有 | GLM 在 main 上才有可能对上层号 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 开关、后端、角色 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py`（GLM 快照 L85–L108） |
| 连接器的逐层等待与存出 | 同文件 L229–L253；要求 PIECEWISE：L77–L83 |
| attention 里调用的入口 | `vllm_ascend/attention/utils.py`（L429–L473）；上游同类装饰器 `vllm/model_executor/layers/attention/kv_transfer_utils.py`（v0.23.0 L15–L60） |
| 发起、等待、存出、层计数 | `.../ascend_store/pool_worker.py`（GLM 快照 L1356–L1430）；提前层数默认：L277–L290 |
| 预取门 | `vllm_ascend/memcache_comm_fence.py`（L24–L91） |
| 从第 0 块查、强制加载、关异步 | `.../ascend_store/pool_scheduler.py`（L250–L258、L565–L591） |
| 结束时立即释放 | 同文件 L1066–L1077；按层登记：L176–L182 |
| 混合线性 attention 要求 align | 同文件 L77–L84；自动改成 align：`vllm_ascend/patch/platform/patch_mamba_config.py`（GLM 快照 L26–L42、L205–L226；v0.23 / v0.26 L137，main L176） |
| 共享槽布局 | `.../ascend_store/layerwise_cache_layout.py`（main L128–L192、L210–L294、L297–L381） |
| 共享槽时每步重搬、每步存出 | `.../ascend_store/pool_scheduler.py`（main L870–L900） |
| 按层数 ÷ 格数放大 KV 预算 | `vllm_ascend/worker/worker.py`（main L620–L632） |
| main 的提前层数与等待 | `.../ascend_store/pool_worker.py`（main L505–L556、L2495–L2518） |
| main 的 Mooncake 逐层限制 | `.../ascend_store/backend/mooncake_layerwise.py`（main L55–L76） |
