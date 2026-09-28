---
id: vllm-kv-block-allocation
title: "KV 块分配：块从池里借出、共享、归还"
type: concept
summary: 启动时切好的 KV 块由 BlockPool 记账：请求要写新历史时从空闲队列队头借块号、计数 0 → 1，前缀相同的请求共用同一块，请求结束或被抢占时计数减回 0、块排回队列，数据不擦。GLM 双机上每个 DP 组一个池子，5 个缓存组共用；R1 首步借 15 块，此后尾状态组边借边还、手里 3–4 块，结束时一次还回 16–17 块；池子不够就抢占，不借一半。
aliases: [BlockPool, KVCacheManager, allocate_slots, get_new_blocks, free_blocks, touch, null_block, null block, free block queue, 块池, 块分配, 缓存块分配, 空闲块队列, 引用计数, ref_cnt, 块归还, 块驱逐, 抢占回收]
chapters: ["11"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L130-L177
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L363
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L365-L441
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L88-L119
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L236
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L368-L446
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L101-L180
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L259-L336
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L363-L378
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L448-L501
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L751-L793
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1054-L1120
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1197-L1209
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L459-L509
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L753-L781
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@0fc695fc:vllm/config/model.py#L1851-L1857
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L357-L378
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L926-L930
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L877-L879
  - vllm@568afb3a:vllm/v1/core/block_pool.py#L719-L740
  - vllm@568afb3a:vllm/v1/core/single_type_kv_cache_manager.py#L753-L782
  - vllm@84030bbe:vllm/v1/core/block_pool.py#L734-L758
  - vllm@84030bbe:vllm/v1/core/single_type_kv_cache_manager.py#L817-L836
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L917-L925
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1103-L1106
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341
  - vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L366-L369
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L499-L508
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L354-L368
  - vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L586-L589
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L931-L938
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1025-L1032
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1146-L1158
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: kv-cache-memory-profiling, kind: builds-on, note: 池子里一共有多少块，是启动时量显存切出来的；本页从「块已经切好」开始讲 }
  - { to: kv-cache-spec, kind: builds-on, note: 5 个缓存组怎样编成、block_size 五种含义的唯一出处；本页按组借块，不讲组怎么编 }
  - { to: block-table, kind: builds-on, note: 借到的块号写进块表，worker 按表把位置换算成槽位 }
  - { to: one-request, kind: builds-on, note: R1 在第 2 站借 15 块、第 7 站还块的主线出处 }
  - { to: concurrent-requests, kind: builds-on, note: 池子不够时抢占的整批账：32 条满载、被抢占的一条还回 120–121 块 }
  - { to: vllm-scheduler, kind: builds-on, note: 调度器怎样决定每步算多少 token；本页只讲它向池子要块这一步 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 请求要存 KV 时，块从哪里来、用完去哪里？

**KV 块分配，是调度器替每条请求向一个公共池子借块、记账、还块的过程。** 这里的 KV block（KV 块）是启动时就从 KV cache 的显存里切好的一格格固定大小的存储，每块有一个整数编号，叫块号；一块能装固定个数 token 的历史。池子由 vLLM 的 **BlockPool**（块池）管理，它只记两样东西：

- **空闲块队列**（free block queue）：眼下没人用的块排成一队，借块总是从队头取。
- **引用计数**：每块身上记一个数，表示现在有几条请求在用它。借出时从 0 变 1；几条请求共用同一块时大于 1；一条请求还块就减 1，减到 0 的块才排回队列。

有一块不参加借还：0 号块在池子建好时就被摘出来，当「这里没有块」的占位，叫 null block，永远不借给请求。

```wiki-diagram
file: block-allocation
```

从图里能读出三条规则：

1. **借，只动队列和计数。** 从队头取出块号，计数 0 → 1；分配器自己不碰显存。
2. **共享，只加计数。** B 的开头和 A 一样，直接指向 A 已经写满的块 1，数据不复制，块 1 的计数加到 2。只有写满、登记过内容的块才能被别人共用，所以 B 的后半段仍要自己借块 3。
3. **还，只减计数。** 计数减到 0 的块才回队列；还没到 0 的块留给还在用它的请求。回队的块里数据原样留着，等它下次被队头取走、借给别人，别人往里写时才被覆盖。

**分配器手里只有整数，不碰显存。** 块号怎样换算成「第几个 token 写进哪一格」，由 worker 按 [block table](block-table.md) 算；池子一共切出多少块、一个块号在每张卡上占多少字节，是[启动时量显存](kv-cache-memory-profiling.md)和[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)的事；「一块装几个 token」在不同地方指不同的数，统一见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。

## 为什么按块借、还要记引用计数？代价在哪？

**按块借，是为了让一条请求用多少占多少。** 请求开始时不知道会生成多长。如果按最大长度给每条请求预留整段显存，大多数请求用不完，别的请求也拿不到；按块借时，请求先拿够眼下要写的块，写满一块再借下一块，其余的块留在池子里给别人。

拿我们的部署算一笔账。池子按每个 DP 组（每台机器上的一套引擎，各有自己的池子，见[后文](#池子在哪每个-dp-组一个5-个缓存组共用)）3,855 块算，这是[部署页](glm-5-3-flash-two-node.md#两种块数各在什么时候用)的示例口径；一块覆盖 640 个位置；每条请求除了随长度增长的块，decode 时还常驻 15–16 块存状态（KDA 12 块，尾状态组 3–4 块），原因见[后文](#kda-组和尾状态组借法和普通注意力不同)：

```calc
title: 按最大长度预留，还是按需借块
满长度请求每条 = ceil(133,120 ÷ 640) + 12 + 4 = 208 + 16 = 224 块
按最大长度预留，最多同时放 = floor(3,855 ÷ 224) = 17 条
按需借：32 条先各占状态块 = 32 × 16 = 512 块
> 尾状态组有时 3 块、有时 4 块，这里取 4
剩下给历史用 = (3,855 − 512) × 640 = 3,343 × 640 ≈ 2.14 M token
平均每条能存 = 2.14 M ÷ 32 ≈ 66.9 K token
```

同一个池子，按最大长度预留只能同时跑 17 条；按需借块时，32 条请求（本部署每个 DP 组最多同时运行的条数）只要平均历史不超过约 66.9 K token，就都放得下。

**引用计数是为了共享。** 打开 prefix caching（前缀缓存：几条请求开头相同时，复用已经算好的 KV）以后，几条请求可以指着同一块。这时一块能不能回收，不能看「某条请求结束了没有」，而要看「还有几条请求在用」，这就是计数的用处。没有共享时，计数只在 0 和 1 之间跳。

代价有三处：

- **尾块没写满的部分，别人用不上。** 一块借出去就整块归这条请求。块越大，借块的次数越少，但这部分也越大：主线的示例请求 [R1](one-request.md#示例请求-r1-与官方双机部署)（prompt 只有 4 个 token）首步只需要 7 个位置，也要占下一整块 640 个位置的块。
- **按需借，中途会有借不到的时候。** 预留制下请求一旦开始就一定跑得完；按需借时，几条长请求一起变长会把池子用光，这时调度器只能抢占别的请求，见[后文](#池子不够时宁可抢占也不借一半)。
- **每步都要记账。** 调度器每一步都为每条要继续算的请求问一次「还差几块」。这件事在 CPU 上做，只动整数，不占 NPU 时间。

分配和相邻几页的分工：

| 想知道 | 去哪一页 |
|---|---|
| 一个 token 要存哪些状态、为什么要存 | [KV cache](kv-cache.md) |
| 启动时能切出多少块、每块多少字节 | [KV cache 显存预算](kv-cache-memory-profiling.md) |
| 块里装哪几层、分几组、块大小指哪个数；怎样把 KV 存得更小 | [KV cache 规格](kv-cache-spec.md)、[缓存量化](kv-cache-quantization.md) |
| 块号怎样换算成槽位 | [block table](block-table.md) |

本页只管块切好以后的借、共享、还和驱逐。

## 引用计数什么时候大于 1：共享、登记与驱逐

**只有打开 prefix caching，同一块才会被几条请求同时持有。** 这一节讲这时分配器多做的几件事；什么样的前缀算「相同」、混合模型为什么默认不开，见 [prefix caching](prefix-caching.md)。

**只有写满的块才登记。** 一块写满后，分配器给它记一个「内容身份」：由块里这些 token 连同它前面所有 token 算出的哈希，登记进一张「哈希 → 块」的表。没写满的块不登记。所以前缀命中总是按整块算，prompt 末尾不满一块的那几个 token 永远复用不上；块越大，这截尾巴越长。

**命中时只加计数。** 新请求来时，调度器先按哈希查表，找出开头有几块已经算过。命中的块计数加 1；如果那块计数原来是 0，说明它正排在空闲队列里等着被借，要先从队列里摘出来。正因为会被摘走，命中这种块也要算进本次「池子够不够」的账里。

**最后一个 token 必须重算。** 就算整段 prompt 都命中，也要留最后一个 token 重新算，因为要用它的输出去预测下一个 token。已算位置数又必须对齐块边界，所以 prompt 恰好填满整数块时，为了重算最后 1 个 token，最后一整块都要重算。

**还块不等于删登记。** 计数减到 0 的块回到空闲队列，但登记还在。它被队头取走之前，后来的请求仍能命中它、把它从队列里捡回来；等它真被取走借给别人，旧登记才被抹掉。这就是驱逐：越靠近队头的块越先被借走，也就越先失去登记。

**倒着还，让开头留得最久。** 一条请求还块时，按块的倒序排回队尾：最后一块先排进去，离队头最近，最先被借走；第一块最后排进去，留得最久。前缀就在序列开头，开头的块最容易被下一条请求复用。从来没登记过的块反正不会被命中，较新的版本会把它们插到队头先借出去，见[版本差异](#版本差异)。

GLM 双机上 prefix caching 默认是关的：vLLM 对同时有注意力层和递推状态层的混合模型，把「支持前缀缓存」判为否，启动时没显式打开就不开。于是本部署里没有登记、没有命中，也没有驱逐，每块的计数只在 0 和 1 之间跳。

## 放到 GLM 双机：R1 从借块到还块

部署前提见 [glm-5-3-flash-two-node「部署前提」](glm-5-3-flash-two-node.md#部署前提)。R1 是主线里的示例请求，prompt 为 4 个 token；这是教学设定，真实请求套上 chat 模板后至少有十几个 token，定义见[一条请求](one-request.md#示例请求-r1-与官方双机部署)。下图是它在第 2 站和第 7 站经过的分配路径。

```wiki-diagram
file: block-allocation-flow
```

### 池子在哪：每个 DP 组一个，5 个缓存组共用

**R1 的块由 DP0 的引擎进程借给它。** 两台机器是两个 DP 组，各跑一个 EngineCore（引擎核心进程，在 CPU 上做调度），各有自己的调度器和自己的 BlockPool。R1 被分到 DP0，就只从 node0 这个池子借块；DP1 的池子与它无关，两边的块号互不相干。

**一个 EngineCore 只建一个池子，5 个缓存组共用。** 缓存组是存储格式和分配规则相同的一组层。GLM 分 5 组：full 组（12 层 MLA 的压缩历史和 indexer K）、3 个 KDA 组、1 个 indexer 尾状态组，组怎么编见 [KV cache 规格](kv-cache-spec.md)。每组有自己的管理器，各算各要几块，但都从同一条空闲队列里取；同一时刻一个块号只借给一个组。

**一个块号，在 8 张卡上指同一页。** TP8 的 8 张卡各有一份自己的 KV 显存。调度器只借一次块号，发给 8 个 worker，各卡在自己那份显存里用同一个页号。所以池子的块数按 8 张卡里最少的那张算，见[各卡取最小](kv-cache-memory-profiling.md#切成块各卡取最小块数不等于并发数)。

### 第一步：7 个位置，5 个组一起借，得到 15 块

调度器挑中 R1，先查前缀命中；前缀缓存关着，直接返回「没有命中」，4 个 token 都要算。

接着问池子要块。要留位置的不只是这 4 个 token：MTP（多 token 预测：先草拟 3 个候选，下一步一起验证）的 3 个候选也要先写进 KV cache 才能被验证，所以现在就多预留 3 个位置，一共 7 个。这 3 个预留位置叫 lookahead。

5 个组各算还差几块，加起来和空闲块数比一次：够就全部一起借出，不够就一块都不借。**不会出现借了一半的情况**，请求要么带着整套块进入本步，要么完全不动。

R1 借到 **15 块**：full 组 1 块、3 个 KDA 组共 12 块、尾状态组 2 块，逐组算式见[一条请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。这 15 个块号从队头取出，计数全部 0 → 1，按组分开放进调度结果发给 worker，再由 worker 写进各组的 [block table](block-table.md)。

### decode 每一步：full 组和 KDA 组多数步不借，尾状态组边借边还

此后每一步，R1 要算 1 + 3 = 4 个 token（上一步确定的 1 个，加 MTP 的 3 个候选），再预留 3 个，调度器仍要问一次还差几块。各组的答案不一样：

- **full 组**：已有的块还装得下就不借，写满 640 个位置才借下一块。
- **KDA 组**：每组固定 4 块，不随长度变，一块都不借。
- **尾状态组**：每前进 4 个位置，先还 1 块窗口外的旧块、再借 1 块新块，手里一直是 3 或 4 块。MTP 每步让 R1 前进 1–4 个位置，候选全被接受时每步都借还各 1 块，全被拒时每 4 步一次。为什么是 3 或 4，见下一节。
- **被拒的候选不退块**：候选没被接受时，为它们多借的位置不退回去，下一步接着用。

所以 decode 时，R1 每 1–4 步就要从池子借 1 块（隔几步取决于候选接受了几个），借的都是尾状态组的；full 组和 KDA 组才是「多数步一块都不借」。R1 若生成 200 个 token，最后一步开始时已算 199–202 个位置，再加本步 4 个和 3 个预留，要留的位置最多 209 个，还在 full 组那一块里：full 组从头到尾只借过 1 次块；尾状态组则前后借过 52–53 个块号，其中 49 个途中已经还掉，见[一条请求第 7 站](one-request.md#第-7-站-返回与收尾)。

### 结束：16–17 块一次还清

引擎判定 R1 结束的那一步，调度器就释放它：每个组把自己的块按倒序交给 BlockPool，计数 1 → 0，全部回到空闲队列，等待中的请求下一步就能借到。这时 R1 手里是 full 组 1 块、KDA 组 12 块、尾状态组 3 或 4 块，共 **16 或 17 块**；落在哪个数，看最后一步开始时已算位置除以 4 余几，也就取决于 MTP 候选接受了几个，算法见[下一节](#kda-组和尾状态组借法和普通注意力不同)。块里的数据不擦：GLM 双机上借出和归还都不清零，见[开销和什么时候别开](#开销和什么时候别开)。

前缀缓存关着，这些块从没登记过，排在队列哪一头只影响下一次借块时拿到哪几个号，不影响任何复用。R1 的 ID 随下一次调度结果通知 node0 的 8 个 worker，各自清掉为它保存的记录，包括块表里它那一行。

## KDA 组和尾状态组：借法和普通注意力不同

普通注意力（这里是 full 组）按位置借块：历史每长 640 个位置多借 1 块，请求结束才还。GLM 另外两类状态不是这样。

**KDA 组：一条请求一页，第一步就借够。** KDA（Kimi Delta Attention）是一种线性注意力，每层只为一条请求保存一份固定大小的递推状态，不随序列变长。vLLM 把这类组的「块大小」设成最大长度 133,120，于是任何请求的当前状态都只要 1 块；MTP 的 3 个候选各算出一份状态，再各留 1 块。每组 4 块、三组 12 块，第一步就借齐，直到请求结束才还。R1 首步的 15 块里有 12 块花在这里，这就是短请求一进来就占 15 块的原因，见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)。

KDA 状态和 MLA 历史能共用同一套块号，是因为逻辑块大小 640 本来就是按「一页 MLA 装得下一份 KDA 状态」倒推出来的，见[为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。昇腾镜像替换了 KDA 组的管理器，只改了前缀命中和外部 KV 加载两条分支。本部署两者都不用，真正借出的块和上游相同；但「有没有外部 KV」那条判断写成「已算位置多于命中块覆盖的位置」，没有命中时对每条已经在跑的请求都成立，于是每步问「还差几块」时，每个 KDA 组多报 1 块，三组合计多 3 块。这 3 块只进「够不够」的比较，不真借，所以常驻 15–16 块不变；影响只是池子剩下不到「真实所需 + 3」块时就判借不到，抢占提前约 3 块发生。

**尾状态组：窗口外的块，请求没结束就还。** indexer 每 4 个 token 压成一条写进 indexer K，还没凑满 4 个的先暂存在尾状态组里，压缩本身见 [KV cache 规格](kv-cache-spec.md)。这一组按滑动窗口管理，窗口和块都是 4 个位置。窗口之外的位置以后再也用不到，所以调度器每次问池子要块之前，先把整块落在窗口外的块还回去，并在这条请求自己的块列表里把那一格换成 null block；哪怕这一步最后借不到块，这一步也照做。这是本部署里唯一一种「请求还在跑就还块」的情况。这些块从没登记过，在 v0.23 上会被插到队头，马上借给别人。

**所以尾状态组手里的块数每步都在变，decode 时是 3 或 4 块。** 设这一步开始时已算 c 个位置、本步新算 n 个。调度器先还：窗口是最后 4 个位置，它前面的 c − 3 个位置里凑满整块的都还掉；再借：把块列表补到装得下「已算 + 新算 + 3 个预留」为止。手里的块数就是补到的块数减去已还的块数：

```calc
title: 尾状态组每一步手里有几块
R1 第一步（c = 0，n = 4） = ceil((0 + 4 + 3) ÷ 4) − 0 = 2 块
decode（c = 200，除以 4 余 0） = ceil(207 ÷ 4) − floor(197 ÷ 4) = 52 − 49 = 3 块
decode（c = 202，除以 4 余 2） = ceil(209 ÷ 4) − floor(199 ÷ 4) = 53 − 49 = 4 块
一步 prefill 6,000 个 token（c = 0） = ceil(6,003 ÷ 4) − 0 = 1,501 块
> 前一项是补到的块数，后一项是窗口外已还的块数
```

decode 时 c 除以 4 余 0、1、3 是 3 块，余 2 是 4 块。余几由窗口起点落在块里的哪一格决定，而 MTP 每步让 c 前进 1–4 个位置、前进几个看候选接受了几个，所以这个数没法写成定值，只能说 3 到 4。3 或 4 块的来历：手里要盖住「窗口里 3 个已算位置 + 本步 4 个新 token + 3 个预留」共 10 个连续位置，10 个位置最少跨 3 块；起点落在块内第 4 格（c 除以 4 余 2）时跨 4 块。

**长 prompt 的 prefill 是例外。** 这一步要为本步全部新 token 留格子，尾状态组临时借约 n ÷ 4 块：一条 6,000 token 的 prompt 一步算完，当步借 1,501 块，占 3,855 块池子的近四成；下一步 c 追上来，一次还掉 1,499 块，回到 3 块。预算满载的一个 8,192 token chunk，这一组要借两千多块。

## 池子不够时：宁可抢占，也不借一半

**「不够」是一次整体判断。** 5 个组还差的块数加起来大于空闲块数，就判定借不到，一块都不借；本部署不异步加载外部 KV，不需要再为它扣预留。接下来怎么办，取决于这条请求在调度器的哪个队列：running 放已经在跑的请求，waiting 放还没排进来、或被抢占退回来的请求。

- **running 里的请求借不到**：调度器从 running 队尾取出一条抢占。默认先来先服务时，队尾就是最晚排进来的那条。它所有组的块全部还回池子，已算位置清零、候选清空、抢占次数加 1，退回 waiting 队首；然后再算一次。如果被抢占的正是这条请求自己，本步就不再排它。
- **waiting 里的新请求借不到**：不抢占任何人，本步停止接纳新请求，下一步再试。
- **这一步只要发生过抢占**，也不再接纳任何新请求。

所以池子里的块不会被两条请求同时写，也不会有请求拿着半套块进入前向。

**在我们的部署里，被抢占一次很贵。** decode 时每条请求常驻 15–16 块状态，full 组每 640 个位置 1 块。按 3,855 块的算例，DP0 跑满 32 条、每条走到约 67,000 个位置时池子用光，开始抢占；被抢占的那条一次还回 120–121 块、每卡约 956–964 MiB，但它约 67,000 个位置的 prefill 要从头重算，约 9 步。整批推导见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。贵在三处：

1. **前缀缓存关着**，还回去的块没登记，重算时一块都复用不上。
2. **KDA 状态跟着丢**：抢占对所有组一视同仁，12 块 KDA 状态也还掉了，34 层的递推状态只能把整段重新扫一遍才能重建。
3. **排回来要的块远多于还掉的块**：它退回 waiting 队首，重新排进来时，调度器先按整段 67,000 个位置检查一次放不放得下，尾状态组这一项按上限 2,050 块算，合计约 2,170 块；重算的第一个 chunk 也要借两千多块，大头是上一节说的尾状态组。它只还掉了 120 块左右，waiting 侧借不到就停，所以它和排在后面的新请求都要等别的请求结束、池子空出约 2,170 块才进得来。

## 常见误解

- **「每生成一个 token 都要借一次块。」** 看组。R1 生成 200 个 token，full 组从头到尾只借过 1 块，跨过 640 个位置的边界才借下一块；KDA 组第一步借齐后再也不借。这两类组绝大多数步实际借 0 块；昇腾的 KDA 管理器在「还差几块」的求和里每组多报 1 块、但不真借，见 [KDA 组一节](#kda-组和尾状态组借法和普通注意力不同)。尾状态组不一样，每前进 4 个位置就借 1 块、还 1 块。
- **「池子每条请求一份」或「整台机器只有一个池子」。** 每个 DP 组的引擎进程一个池子，组内所有请求、所有 5 个缓存组共用；两台机器各一个。
- **「还块就是把数据清掉。」** 还块只改计数和排队位置，数据留到下次被借走、写入时才被覆盖。开着 prefix caching 时，这正是还回去的块仍能被命中的前提。借出时清不清零要分平台：上游 GPU 路径上，有递推状态层的混合模型会在借出时把新借的注意力块清零；昇腾只在投机方法为 eagle3 时才这样做，GLM 用 MTP，借出也不清零。
- **「计数到 0 的块就不能再被命中了。」** 开着 prefix caching 时，计数为 0 但登记还在的块，被队头取走之前仍可命中；命中时先从队列里摘出来，再加计数。
- **「借不到块会报错。」** 正常路径上分配器只回答「借不到」，由调度器抢占或让新请求等；抢占也不报错，只在请求上记一次抢占次数。
- **「块大小是分配器选的，可以随手调。」** 分配器只按各组给定的块大小算块数。GLM 双机上，逻辑块大小由昇腾补丁先写成 640，平台随后跳过「改回 128」的那段逻辑；来龙去脉见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。
- **「只有 4 个 token 的请求只占 1 块。」** 在 GLM 上它至少占 15 块，其中 12 块是 KDA 状态，与长度无关。

## 对照源码

### 怎么开

分配没有开关，每一步都在跑。和它有关、能调的是下面几项，都不在分配器里决定：

- **前缀缓存。** `enable_prefix_caching` 没显式给出时，取 `is_prefix_caching_supported` 的结果，混合模型为 False [C17]。关着时 `get_computed_blocks` 第一行就返回空，`allocate_slots` 借完块直接返回、不调 `cache_blocks`，所以不登记也不驱逐。
- **块大小。** 纯注意力模型走昇腾的 `refresh_block_size`：没设时填 128，开着前缀缓存或 chunked prefill 时把不是 128 的值改回 128，只打一条 info 日志；混合模型在这里直接返回，交给模型专用的对齐逻辑 [C26]。GLM 由镜像补丁写成 640，五种含义和启动日志文案见 [KV cache 规格](kv-cache-spec.md#版本差异)。
- **lookahead。** 等于投机 token 数，本部署是 MTP 的 3；每次 `allocate_slots` 都按「已算 + 新算 + 3」留位置，封顶 `max_model_len`。
- **抢占策略。** 默认先来先服务，抢占 `self.running.pop()` 取出的那条；`policy=priority` 时抢占优先级最低、到达最晚的那条。

对象关系：`KVCacheManager` 持有一个 `KVCacheCoordinator`；协调器按 `kv_cache_config.num_blocks` 建**一个** `BlockPool`，再给每个缓存组建一个单组管理器，全部传进同一个池 [C4]。`BlockPool` 建好后先 `popleft` 出 0 号块当 `null_block`，它的计数不维护，还块时也跳过它。

### 会报什么错

- `ValueError("Cannot get {num_blocks} free blocks from the pool")`：`get_new_blocks` 要的块数超过空闲块数时抛出 [C2]。正常路径走不到：`allocate_slots` 先比过总数，不够就返回 `None` [C6]，调度器据此抢占或停止接纳新请求。
- 抢占不报错：`_preempt_request` 把状态改成 `PREEMPTED`、`num_computed_tokens = 0`、`num_preemptions += 1`，开了统计时记一次 `PREEMPTED` 事件，然后 `waiting.prepend_request` [C16]。抢占频繁时要看这个计数，日志里没有报错可找。
- 块大小被改写也不报错：纯注意力模型只有 info 日志 `Block size is set to 128 if prefix cache or chunked prefill is enabled.`；GLM 的日志文案见 kv-cache-spec。
- 排查「借不到块」时，要把 5 个组各差几块、空闲块数、请求的块表、命中记录和抢占计数对起来看。单看剩余显存或一个空闲块数，还原不出混合模型每条请求常驻的 15–16 块状态开销，也看不出长 prompt prefill 那一步尾状态组临时借走的上千块。

### 开销和什么时候别开

- **尾块与状态块的空置。** R1 首步占 15 块、每卡约 119.5 MiB，真正写进去的历史只有几十 KiB，数字见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块) [D]。短请求、高并发时，每条常驻的 15–16 块决定了池子能同时容纳多少条。
- **整块重算。** `get_computed_blocks` 把命中上限压成 `num_tokens - 1`，注释写明因为 `allocate_slots` 要求已算位置对齐块边界，这可能触发整块重算，将来去掉这条限制还能再快一点 [C5]。本部署前缀缓存关，不涉及。
- **只认写满的块。** 基类 `cache_blocks` 只登记 `num_tokens // block_size` 个整块 [C8]。
- **命中空闲队列里的块要占容量。** `get_num_blocks_to_allocate` 把命中块里计数为 0 的那些也算进「要借的块」，因为 `touch` 会把它们从空闲队列摘走 [C7]。
- **抢占。** 一次抢占还回整条请求所有组的块，但已算位置清零；本部署下重算没有前缀可复用，KDA 状态也一起丢 [I]。整批数字见 [concurrent-requests](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)，其中 3,855 块是算例 [A]。
- **KDA 组的一条特殊返回。** 开前缀缓存时，如果本请求要复用的块是本步另一条请求刚生成的，`MambaManager.get_num_blocks_to_allocate` 直接返回 `num_gpu_blocks + 1`，故意制造「不够」，把它推到下一步 [C12]。本部署前缀缓存关，走不到。
- **昇腾 KDA 管理器求块时多报 1 块。** `AscendMambaManager.get_num_blocks_to_allocate` 在上游结果上再判断：`total_computed_tokens > len(new_computed_blocks) × block_size` 且本步有新 token，就 `+1`（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L76-L80`）。运行中的请求传进来的 `new_computed_blocks` 每组都是空的（`vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L171-L173`、`#L339-L342`），所以已算位置大于 0 时每个 KDA 组每步都 `+1`，三组合计 `+3`，只进求和与空闲块的比较。真正借块走上游 `MambaManager.allocate_new_blocks`，none 模式补到 4 块、已有 4 块，借 0；外部 KV 那一块只在 `num_external_computed_tokens > 0` 时才借（`single_type_kv_cache_manager.py#L246`），本部署为 0。替换类经 `vllm_ascend/patch/platform/__init__.py#L43` 导入时改写模块里的 `MambaManager`，上游注册表在第一次取管理器时才按这个名字登记（`single_type_kv_cache_manager.py#L1369`），所以生效。v0.23 `2c59ff10` L76 同式；v0.26 `2ed6cbba` L63、L80 与 main `baa023ad` L66、L83 只是把 `len(new_computed_blocks) × block_size` 提成变量 `local_hit_tokens`，条件不变。影响：抢占约提前 3 块触发；常驻 15–16 块、被抢占那条 120–121 块不受实质影响。
- **尾状态组每一步借几块、还几块。** 窗口 = 块 = `compress_ratio` = 4，这个规格登记给上游 `SlidingWindowManager`；该类不改求块数和借块，走基类。`allocate_slots` 先 `remove_skipped_blocks(c)`、再逐组求和：窗口外 token 数 `max(0, c − 4 + 1)`，整块换成 null 还池；再把块列表（含 null 占位）补到 `cdiv(c + n + 3, 4)`，运行中请求只借 `max(需要 − 已有, 0)`。所以手里是 `cdiv(c + n + 3, 4) − floor((c − 3) / 4)`：首步 2 块，decode 3–4 块，prefill 一步约 n / 4 块。上游对滑动窗口规格的注释写明 chunked prefill 时要装下「窗口内已算的 token + 本步新 token」，每请求准入上限 `cdiv(3 + 8192, 4) + 1 = 2,050`；waiting 侧准入检查（`scheduler_reserve_full_isl` 默认开）先按整段 prompt 用这个上限算一遍。异步调度打开时 `c` 在调度时含上一步未验证的候选，但逐步不减，3–4 块的结论不变 [D]。
- **借出不清零（GLM 双机）。** 调度器侧 `needs_kv_cache_zeroing` 在有 Mamba 组时为真，本步新借块号里规格属于 `FullAttentionSpec`、`TQFullAttentionSpec`、`MLAAttentionSpec` 三种精确类型的，列进待清零清单随调度结果下发。执行侧 `_zero_block_ids` 只在 runner 上有 `_kv_block_zeroer` 时才动手；上游 GPU worker 只要 `needs_kv_cache_zeroing` 为真就建它，昇腾 worker 却只在投机方法为 `eagle3` 且投机 token 数大于 1 时才建。GLM 用 `mtp`，所以清单下发了也不清零，抢占后重新借块也没有清零开销。

**待核。**

1. 异步调度：没有显式指定时自动判定，本部署的 `mtp` 与多进程执行器都满足打开条件，按默认值推断为开；打开时还块与输出回传会错开一步。没有启动日志确认 [!]。
2. 抢占能否改成把 KV 换出到 CPU（昇腾的 recompute 调度器或 KV 卸载），默认是否启用，没有核 [!]。

### 版本差异

钉点：v0.23 为 Ascend `2c59ff10` / vLLM `0fc695fc`，v0.26 为 Ascend `2ed6cbba` / vLLM `568afb3a`，main 为 Ascend `baa023ad` / vLLM `84030bbe`。**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它的分配控制流用 vLLM `0fc695fc`，与 v0.23 一列相同；GLM-5.3-Flash 的模型文件只在镜像里，v0.23、v0.26 两列只说明同一套分配代码在那两版上的行为。本页用到的 Ascend 代码在三个钉点上都在：替换版 KDA 管理器 `patch_mamba_manager.py`、`refresh_block_size`，以及 worker 建清零器的条件。清零条件 v0.23、v0.26 与镜像相同，只有 `eagle3` 且投机 token 数大于 1 才建（`2c59ff10` worker L931–L938、`2ed6cbba` L1025–L1032）；main 多了一个入口，改用 model runner v2 时也建（`baa023ad` L1146–L1158）。所以「用 MTP 的混合模型借出不清零」在 v0.23、v0.26 成立，main 上要看是否用 model runner v2。

| 项 | v0.23 | v0.26 | main | 意味着什么 |
|---|---|---|---|---|
| 一个协调器一个池、0 号块当占位、借不够抛 `ValueError`、`touch` 摘出空闲块 | 有 | 同 v0.23 | 同 v0.23 | 本页借、共享、还三条规则三版一致 |
| 还回的块排在哪头 | `free_blocks` 默认一律 `append_n` 排队尾，另有 `prepend` 开关；只有滑动窗口组还块时把没登记的块 `prepend` 到队头 [C11] | `free_blocks` 自己分两拨：没登记的插队头，登记过的排队尾，`prepend` 参数取消 [C22] | 同 v0.26，另外前缀缓存关时一律插队头，注释写明按后进先出复用、改善局部性 [C24] | GLM 镜像按 v0.23：full 组、KDA 组的块排队尾；尾状态组没登记的块插队头，包括途中还的窗口外块和请求结束时剩下的那 3–4 块 |
| 没写满的块能否登记 | 不能 | 能：full 组块大小不等于哈希粒度时，为 prompt 尾部登记一条「部分」条目 [C23] | 同 v0.26，递推状态组也有对应分支 [C25] | 哈希粒度在前缀缓存和 KV connector 都不开时等于调度块大小，GLM 上是 133,120 [C19]；本部署前缀缓存关，碰不到 |

### 源码位置

R1 在代码里的路径（vLLM `0fc695fc`）：

1. **启动**：`KVCacheCoordinator` 建一个 `BlockPool`，所有缓存组共用；`BlockPool` 持有全部块和 `free_block_queue`，先 `popleft` 出 0 号块当 `null_block`。
2. **查命中**：`Scheduler.schedule` 排 waiting 时先调 `get_computed_blocks`；前缀缓存关，返回空。
3. **借块**：`allocate_slots(request, 4, num_lookahead_tokens=3)` 先 `remove_skipped_blocks`，再逐组 `get_num_blocks_to_allocate` 求和，与 `get_num_free_blocks() - reserved_blocks` 比；够则 `allocate_new_blocks` → `BlockPool.get_new_blocks`：`popleft_n`，开缓存时先 `_maybe_evict_cached_block`，再把 `ref_cnt` 从 0 改成 1。
4. **decode**：每步 running 循环里再调 `allocate_slots`，先 `remove_skipped_blocks` 让尾状态组还掉窗口外的块，再由单组管理器返回 `max(需要 − 已有, 0)`；full 组和 KDA 组已有的块够用时就是 0，尾状态组每跨过一个 4 位置的块边界就是 1。
5. **命中别人的块**（开缓存时）：`touch`，`ref_cnt == 0` 的先从空闲队列 `remove`，再 `ref_cnt += 1`。
6. **结束或抢占**：`KVCacheManager.free` → 协调器 → 各组 `free`，按 `reversed(req_blocks)` 交给 `free_blocks`；`ref_cnt` 减 1，减到 0 且不是 `null_block` 的才回队列。

| 想看什么 | 去哪 |
|---|---|
| 借块、查命中、还块的入口 | `vllm/v1/core/kv_cache_manager.py`：`get_computed_blocks`、`allocate_slots`、`free` |
| 空闲队列、引用计数、登记表 | `vllm/v1/core/block_pool.py`：`BlockPool`、`get_new_blocks`、`touch`、`free_blocks`、`cache_full_blocks`；队列本身是 `kv_cache_utils.py` 的 `FreeKVCacheBlockQueue` |
| 一个协调器一个池 | `vllm/v1/core/kv_cache_coordinator.py` |
| 各组怎样算块数、怎样还 | `vllm/v1/core/single_type_kv_cache_manager.py`：基类、`SlidingWindowManager`、`MambaManager` |
| 抢占 | `vllm/v1/core/sched/scheduler.py`：running 循环里的抢占、waiting 侧借不到就停、`_preempt_request` |
| 昇腾替换的 KDA 管理器 | `vllm_ascend/patch/platform/patch_mamba_manager.py` [C18] |
| 块大小从哪来 | `vllm_ascend/utils.py` 的 `refresh_block_size`；GLM 分支见 kv-cache-spec |
| 尾状态组的窗口和块 | `vllm_ascend/models/glm5_next.py`（窗口 = 块 = `compress_ratio`）；`vllm_ascend/core/kv_cache_interface.py`（登记给 `SlidingWindowManager`） |
| 借出清零的条件 | 上游 `vllm/v1/worker/gpu_worker.py`（建清零器）、`gpu_model_runner.py` 的 `_zero_block_ids`；昇腾 `vllm_ascend/worker/worker.py`（只在 `eagle3` 时建） |

**正文证据索引。** 空闲队列、null block 与借块见 [C1]；命中、驱逐与还块见 [C3]；各组倒序还块见 [C9]；抢占循环与 waiting 侧不抢占见 [C14]。其余出处按 sources 顺序：一个 EngineCore 一个池（第 4 条）、命中上限与前缀缓存关时直接返回（第 5 条）、借块总判断与还块入口（第 6 条）、按组算块数与候选被拒不退块（第 7 条）、只登记整块（第 8 条）、尾状态组中途还块（第 10、11 条）、KDA 组每组 4 块且不中途还块（第 12、13 条）、waiting 侧借不到就停（第 15 条）、昇腾替换版 KDA 管理器（第 18 条）、调度块大小与哈希粒度（第 19 条）、借出清零的调度器侧（第 20、21 条）与执行侧（第 27、28、33 条）、尾状态组的窗口与块（第 29、30 条）、滑动窗口的 prefill 占用与准入上限（第 31、32 条）、三个钉点的清零条件（第 34–36 条）。
