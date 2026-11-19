---
id: vllm-kv-block-allocation
title: KV 块分配：块从池里借出、共享、归还
type: concept
summary: >-
  启动时切好的 KV 块由 BlockPool 记账：请求要写新历史时从空闲队列队头借块号、计数 0 →
  1，前缀相同的请求共用同一块，请求结束或被抢占时计数减回 0、块排回队列，数据不擦。GLM 双机上每个 DP 组一个池子，5 个缓存组共用；R1 首步借
  15 块；按完整投机步示意，尾状态组持有 3–4 块，R1 结束时还回 16–17 块。截短步、长度封顶和异步在途计数另按实际块表核算。
aliases:
  - BlockPool
  - KVCacheManager
  - allocate_slots
  - get_new_blocks
  - free_blocks
  - touch
  - null_block
  - null block
  - free block queue
  - 块池
  - 块分配
  - 缓存块分配
  - 空闲块队列
  - 引用计数
  - ref_cnt
  - 块归还
  - 块驱逐
  - 抢占回收
chapters:
  - '11'
order: 10
sources:
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L130-L177'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L363'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L365-L441'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L88-L119'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L236'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L368-L446'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L101-L180'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L259-L336'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L363-L378'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L448-L501'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L751-L793'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1054-L1120'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1197-L1209'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L459-L509'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L753-L781'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@0fc695fc:vllm/config/model.py#L1851-L1857'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L357-L378
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L926-L930'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L877-L879'
  - 'vllm@568afb3a:vllm/v1/core/block_pool.py#L719-L740'
  - 'vllm@568afb3a:vllm/v1/core/single_type_kv_cache_manager.py#L753-L782'
  - 'vllm@84030bbe:vllm/v1/core/block_pool.py#L734-L758'
  - 'vllm@84030bbe:vllm/v1/core/single_type_kv_cache_manager.py#L817-L836'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L917-L925'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1103-L1106'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L366-L369'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L499-L508'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L354-L368'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L586-L589'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L931-L938'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1025-L1032'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1146-L1158'
  - >-
    raw:sha256-5880dc1d5cd47e1b03bbc8cfcc475c3f7a3a19d00400145d91c88cf91632eba6.md#L1-L1185
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L770-L800'
  - 'vllm@ced6857a:vllm/v1/core/single_type_kv_cache_manager.py#L2219-L2250'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_coordinator.py#L375-L380'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L613'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1205-L1221'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_mamba_manager.py#L53-L90'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L998-L1019'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1431'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L67'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1121-L1132'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L228-L258'
  - 'vllm@84030bbe:vllm/v1/core/single_type_kv_cache_manager.py#L1947-L2063'
  - 'vllm@ced6857a:vllm/v1/core/single_type_kv_cache_manager.py#L840-L885'
  - 'vllm@ced6857a:vllm/v1/core/single_type_kv_cache_manager.py#L1989-L2127'
  - 'vllm@0fc695fc:docs/design/hybrid_kv_cache_manager.md#L1-L245'
  - 'vllm@0fc695fc:docs/design/prefix_caching.md#L1-L236'
  - 'vllm@568afb3a:vllm/v1/core/single_type_kv_cache_manager.py#L775-L793'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_manager.py#L51-L84'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_manager.py#L53-L91'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L330-L354'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L731-L739'
  - 'vllm@568afb3a:vllm/v1/core/single_type_kv_cache_manager.py#L1620-L1684'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L370-L410'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_mamba_manager.py#L53-L91'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1215-L1232'
  - 'vllm@ba15685a:vllm/v1/core/block_pool.py#L798-L835'
  - 'vllm@ba15685a:vllm/v1/core/kv_cache_coordinator.py#L390-L420'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_mamba_manager.py#L48-L95'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1305-L1320'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 池子里一共有多少块，是启动时量显存切出来的；本页从「块已经切好」开始讲
  - to: kv-cache-spec
    kind: builds-on
    note: 5 个缓存组怎样编成、block_size 五种含义的唯一出处；本页按组借块，不讲组怎么编
  - to: block-table
    kind: builds-on
    note: 借到的块号写进块表，worker 按表把位置换算成槽位
  - to: one-request
    kind: builds-on
    note: R1 在第 2 站借 15 块、第 7 站还块的主线出处
  - to: concurrent-requests
    kind: builds-on
    note: 池子不够时抢占的整批账：32 条满载、被抢占的一条还回 120–121 块
  - to: vllm-scheduler
    kind: builds-on
    note: 调度器怎样决定每步算多少 token；本页只讲它向池子要块这一步
contradicts: []
updated: '2026-11-10'
origin: gap
rawSources:
  - >-
    raw/sha256-5880dc1d5cd47e1b03bbc8cfcc475c3f7a3a19d00400145d91c88cf91632eba6.md
  - >-
    raw/sha256-b04517d824fad69abd6e4965f36d2e0b1aab52770fbc3c7fc17dda58cb3466c3.md
---

## 请求要存 KV 时，块从哪里来、用完去哪里？

**KV 块分配，是调度器替每条请求向公共池子借块、记账、还块的过程。** 这里的 KV block（KV 块）是启动时从缓存显存里切好的存储单位，每块有一个整数编号，叫块号；普通注意力按位置存历史，一块能装固定个数 token，递推状态等规格另有借法。池子由 vLLM 的 **BlockPool**（块池）管理，先看借还依赖的两笔账：

- **空闲块队列**（free block queue）：眼下没人用的块排成一队，借块总是从队头取。
- **引用计数**：每块身上记一个数，表示现在有几条请求在用它。借出时从 0 变 1；几条请求共用同一块时大于 1；一条请求还块就减 1，减到 0 的块才排回队列。

有一块不参加借还：0 号块在池子建好时就被摘出来，当「这里没有块」的占位，叫 null block，永远不借给请求。

这一步接在[请求主线的第2站调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)中。按需借能把空闲容量留给别的请求，代价是整块中的尾部空位，以及池子不够时的等待或抢占。

```wiki-diagram
file: block-allocation
```

从图里能读出三条规则：

1. **借，只动队列和计数。** 从队头取出块号，计数 0 → 1；分配器自己不碰显存。
2. **共享，只加计数。** B 的开头和 A 一样，直接指向 A 已经写满、登记过内容的块 1，数据不复制，块 1 的计数加到 2。图按普通整块前缀命中画，B 的后半段不同，仍要自己借块 3；较新版的部分尾块规则见后文。
3. **还，只减计数。** 计数减到 0 的块才回队列；还没到 0 的块留给还在用它的请求。回队的块里数据原样留着，等它下次被队头取走、借给别人，别人往里写时才被覆盖。

**分配器手里只有整数，不碰显存。** 块号怎样换算成「第几个 token 写进哪一格」，由 worker 按 [block table](block-table.md) 算；池子一共切出多少块、一个块号在每张卡上占多少字节，是[启动时量显存](kv-cache-memory-profiling.md)和[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)的事；「一块装几个 token」在不同地方指不同的数，统一见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。

## 为什么按块借、还要记引用计数？代价在哪？

**按块借，是为了让一条请求按当前需要占空间。** 请求开始时不知道会生成多长。如果按最大长度给每条请求预留整段显存，大多数请求用不完，别的请求也拿不到；按块借时，先拿够已算历史、本步新算和必要预留的位置，覆盖范围跨过块边界才补借，其余的块留给别人。

把上图第二步算一遍：池子有 7 块可借，A 持有两块，B 也持有两块，其中块 1 共享。引用次数与实际占住的块数并不相同：

$$N_{\text{ref}} = 2 + 2 = 4, \qquad N_{\text{used}} = 2 + 2 - 1 = 3\text{ 块}, \qquad N_{\text{free}} = 7 - 3 = 4\text{ 块}$$

| 两条请求共用 1 块（示意：总池 7 块可借） | 算式 | 结果 |
| --- | --- | --- |
| 两条请求持有的引用总次数 | $2 + 2$ | **4 次** |
| 实际占住的不同物理块数 | $2 + 2 - 1$ | **3 块**（块 1 共享，只占 1 份空间） |
| 池中还可借出的空闲块数 | $7 - 3$ | **4 块** |

**引用计数是为了共享。** 打开 prefix caching（前缀缓存：几条请求开头相同时，复用已经算好的 KV）以后，几条请求可以指着同一块。这时一块能不能回收，不能看「某条请求结束了没有」，而要看「还有几条请求在用」，这就是计数的用处。没有共享时，计数只在 0 和 1 之间跳。

普通块的缓存命中省去重算，却仍可能占用空闲容量，两种引用状态见[共享、登记与驱逐](#引用计数什么时候大于-1共享登记与驱逐)。

代价有三处：

- **尾块没写满的部分，不能另借给无关请求。** 借出的整块占着容量；块越大，借块的次数越少，但尾部空位也可能越多。后面的GLM短请求算例会把这笔开销具体算出来。
- **按需借，中途会有借不到的时候。** 按完整运行峰值预留，能避免单因KV增长超出预留而缺块；它不保证其他资源或执行都成功。按需借时，几条长请求一起增长可能用光池子，需要等待或抢占，见[后文](#池子不够时宁可抢占也不借一半)。
- **每步都要记账。** 调度器每一步都为每条要继续算的请求问一次「还差几块」。这件事在CPU上做，本身不下发NPU算子，但会占用CPU时间，慢了也会拖延下一批计算。

分配和相邻几页的分工：

| 想知道 | 去哪一页 |
|---|---|
| 一个 token 要存哪些状态、为什么要存 | [KV cache](kv-cache.md) |
| 启动时能切出多少块、每块多少字节 | [KV cache 显存预算](kv-cache-memory-profiling.md) |
| 块里装哪几层、分几组、块大小指哪个数；怎样把 KV 存得更小 | [KV cache 规格](kv-cache-spec.md)、[缓存量化](kv-cache-quantization.md) |
| 块号怎样换算成槽位 | [block table](block-table.md) |

本页只管块切好以后的借、共享、还和驱逐。

## 引用计数什么时候大于 1：共享、登记与驱逐

**打开 prefix caching 后，命中路径会让几条请求同时持有同一块。** 这一节按固定 v0.23 普通整块缓存路径讲它多做的几件事；什么样的前缀算「相同」、混合模型的默认与限制，见 [prefix caching](prefix-caching.md)。

下面这张图把 `FreeKVCacheBlockQueue` 双向链表里「队头优先驱逐、队尾保护前缀」的顺序、`null_block` 隔离、`touch()` 命中记账以及 `v0.30.0` / `main` 跨池归还串在一起：

```wiki-diagram
file: vllm-kv-block-allocation-fig-lru-queue
```

拆开来看，前缀共享与驱逐依赖五条精细规则：

- **只登记完整块（v0.23 整块路径）。** 分配器给可缓存的完整块记一个「内容身份」：由块里这些 token、前面的前缀及必要的附加身份算出哈希，登记进查询表。这里 prompt 末尾不满一块的部分不能单独命中；块越大，这截尾巴可能越长。v0.26 起的部分尾块分支还要区分缓存块和哈希粒度，不能把“永远不能复用尾部”推广到所有版本，具体边界见[版本差异](#版本差异)。
- **命中时只加计数，但可能消耗空闲容量。** 新请求来时，调度器先按哈希查表，找出开头有几块已经算过。命中的块计数加 1；如果那块计数原来是 0，说明它正排在空闲队列里等着被借，要先从队列里摘出来。正因为会被摘走，命中这种块也要算进本次「池子够不够」的账里。
- **最后一个 token 必须重算。** 就算整段 prompt 都命中，也要留最后一个 token 重新算，因为要用它的输出去预测下一个 token。已算位置数又必须对齐块边界，所以 prompt 恰好填满整数块时，为了重算最后 1 个 token，最后一整块都要重算。
- **还块不等于删登记，且 `null_block` 例外。** 计数减到 0 的普通块回到空闲队列，但登记还在。它被队头取走之前，后来的请求仍能命中它、把它从队列里捡回来；等它真被取走借给别人，旧登记才被抹掉。这就是驱逐：越靠近队头的块越先被借走，也就越先失去登记。`null_block` 在初始化时从空闲队列取出，不按普通块维护引用计数，释放时也跳过普通归还逻辑，因此池中总块数不能直接当作普通请求可借出的块数。
- **倒着还，让开头留得最久。** 一条请求还块时，按块的倒序排回队尾：最后一块先排进去，离队头最近，最先被借走；第一块最后排进去，留得最久。前缀就在序列开头，开头的块最容易被下一条请求复用。从来没登记过的块反正不会被命中，较新的版本会把它们插到队头先借出去，见[版本差异](#版本差异)。

GLM 双机上 prefix caching 默认是关的：vLLM 对同时有注意力层和递推状态层的混合模型，把「支持前缀缓存」判为否，启动时没显式打开就不开。于是本部署里没有登记、没有命中，也没有驱逐，每块的计数只在 0 和 1 之间跳。

## 放到 GLM 双机：R1 从借块到还块

固定部署是2台A2、每台8卡，TP8 / DP2 / EP16、W8A8，完整[部署前提](glm-5-3-flash-two-node.md#部署前提)另有一页。R1是主线里的示例请求，prompt为4个token；这是教学设定，真实请求套上chat模板后长度另算，定义见[一条请求](one-request.md#示例请求-r1-与官方双机部署)。下图是它在第2站和第7站经过的分配路径。

```wiki-diagram
file: block-allocation-flow
```

### 池子在哪：每个 DP 组一个，5 个缓存组共用

**R1 的块由 DP0 的引擎进程借给它。** 两台机器是两个 DP 组，各跑一个 EngineCore（引擎核心进程，在 CPU 上做调度），各有自己的调度器和自己的 BlockPool。R1 被分到 DP0，就只从 node0 这个池子借块；DP1 的池子与它无关，两边的块号互不相干。

**这个固定部署中，一个EngineCore建一个池子，5个缓存组共用。** 缓存组是共用块号清单、管理规则兼容的一组层，并不要求每层页大小和内容完全一样。GLM分5组：full组（12层MLA的压缩历史和indexer K）、3个KDA组、1个indexer尾状态组，组怎么编见[KV cache规格](kv-cache-spec.md)。每组有自己的管理器，各算各要几块，但都从同一条空闲队列里取；同一时刻一个块号只借给一个组。

这里的KDA是线性注意力，为每条请求保留固定大小的递推状态；indexer是挑选历史位置的索引器，每4个位置压成一条索引键K，未凑满4个的位置先保留为尾状态。前者按请求留状态，后者既有随历史增长的索引键，也有不断替换的小段尾状态，所以两者的借块方法不同。

**一个块号，在8张卡上使用相同编号，各卡存储独立。** TP8的8张卡各有自己的KV显存。调度器借一次块号，发给8个worker，各卡在自己的显存里找到对应页。所以池子的块数按8张卡里最少的那张算，见[各卡取最小](kv-cache-memory-profiling.md#切成块各卡取最小块数不等于并发数)。

### 按最大长度预留，还是按需借块

每个 DP 组的池子按 3,855 块算，这是[部署页的示例口径](glm-5-3-flash-two-node.md#两种块数各在什么时候用)；full 组每块覆盖 640 个位置。完整投机 decode 步中，历史之外还有 KDA 12 块与尾状态 3–4 块，借法见后文。先用较保守的 16 块状态（扣除永久保留的 1 个 null block）做容量比较：

$$B_{\text{req,max}} = \lceil 133{,}120 \div 640 \rceil + 12 + 4 = 208 + 16 = 224\text{ 块}, \qquad \bar{L}_{32} = \frac{(3{,}855 - 1 - 32 \times 16) \times 640}{32} = 66{,}840\text{ token}$$

| 容量安排方式（总池 3,855 块，扣 1 个 null block） | 算式 | 容量结果 |
| --- | --- | --- |
| 按单条完整 decode 步上界预留 | 单条 $208 + 16 = 224$ 块；$\lfloor 3{,}854 \div 224 \rfloor$ | 仅能静态预留 **17 条** |
| 按需借块（32 条先留状态块） | 状态 $32 \times 16 = 512$ 块；余 $3{,}342$ 块给历史 | 共 $2{,}138{,}880$ token，均摊 **66,840 token（约 66.8 K）/条** |

224是完整decode步按最大历史与状态占用组合的静态上界，不是请求全程峰值；长prefill单步的尾状态临时块可以远多于4块，准入和那一步的峰值须另算。它也不是满长度最后一步的固定占用：位置需求封顶133,120后，尾状态可只剩2块，得到208 + 12 + 2 = 222块，见[KV cache的满长度算例](kv-cache.md)。17条只能作这里的静态容量比较，不能直接当作可服务并发或吞吐。按需借时，32条请求（本部署每DP组的运行条数上限）共享历史槽位；还要逐请求向上取整成块，并满足分配器额外准入需求，所以平均长度低于66.8K并不保证都放得下。

### 第一步：7 个位置，5 个组一起借，得到 15 块

调度器挑中 R1，先查前缀命中；前缀缓存关着，直接返回「没有命中」，4 个 token 都要算。

接着问池子要块。要留位置的不只是这 4 个 token：MTP（多 token 预测：先草拟 3 个候选，下一步一起验证）的 3 个候选也要先写进 KV cache 才能被验证，所以现在就多预留 3 个位置，一共 7 个。这 3 个预留位置叫 lookahead。

5 个组各算还差几块，加起来和空闲块数比一次：够就全部一起借出，不够就一块都不借。**不会出现借了一半的情况**。不过，没有借到新块，不代表请求原先持有的块完全不变：分配前可能先归还本次计算已不再访问的旧块，例如滑动窗口之外的块；即使随后因容量不足而无法调度，这部分归还也可能已经完成。是否可以提前归还取决于缓存规格；这里 full 组的历史仍需保留，不能仅因某个位置已经算完就归还对应块。

R1 借到 **15 块**：full 组 1 块、3 个 KDA 组共 12 块、尾状态组 2 块，逐组算式见[一条请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。这 15 个块号从队头取出，计数全部 0 → 1，按组分开放进调度结果发给 worker，再由 worker 写进各组的 [block table](block-table.md)。

尾块空位在这里很明显：full组首步只需要7个位置，也要占下一整块640个位置的页；其中尚未使用的位置不能另借给无关请求。

### decode 每一步：full 组和 KDA 组多数步不借，尾状态组边借边还

下面先看完整验证3个候选、未被本步预算或长度上限截短的decode步：R1要算1 + 3 = 4个token（上一步确定的1个，加MTP的3个候选），再预留3个位置。候选不足或预算截短时应代入实际新算数；接近模型长度上限时，连同预留的位置也会封顶。调度器每步都要问一次还差几块，各组的答案不一样：

- **full组**：已有块能覆盖已算、本步新算和预留就不借；所需位置跨过640的块边界才补借，不必等实际历史写满。
- **KDA 组**：每组固定 4 块，不随长度变，一块都不借。
- **尾状态组**：在上述完整步、需求持续向前的情况下，每前进4个位置，先还1块窗口外旧块、再借1块新块，持有3或4块。MTP每步确认前进1–4个位置，候选全接受时每步借还各1块，全拒时每4步一次；起步过渡和截短步另按实际位置算。为什么是3或4，见下一节。
- **被拒的候选不退块**：候选没被接受时，为它们多借的位置不退回去，下一步接着用。

按这个完整步示意，R1每1–4步从池子借1块尾状态；full组和KDA组才是多数步不借。R1若生成200个token，且最后仍安排完整4位置验证，最后一步开始时已算199–202个位置，加本步4个和3个预留，最多209个，还在full组第一块里。full组从头到尾只借1次；尾状态组前后借过52–53个块号，其中49个途中已还，见[一条请求第7站](one-request.md#第-7-站-返回与收尾)。这组计数是所列步形状的推导，不能替代截短步或异步在途状态的逐步记录。

### 结束：16–17 块一次还清

引擎判定R1结束后，调度器释放它：每个组把自己的块按倒序交给BlockPool，计数1 → 0，全部回队列，后续调度就能再借。按上述最后完整步算，R1持有full组1块、KDA组12块、尾状态组3或4块，共**16或17块**；取决于最后一步的起点与实际步长，算法见[下一节](#kda-组和尾状态组借法和普通注意力不同)。块里的数据不擦：GLM固定镜像使用MTP与V1 runner，借出和归还都不做这里的清零，见[开销和什么时候别开](#开销和什么时候别开)。

前缀缓存关着，这些块从没登记过，排在队列哪一头只影响下一次借块时拿到哪几个号，不影响任何复用。R1 的 ID 随下一次调度结果通知 node0 的 8 个 worker，各自清掉为它保存的记录，包括块表里它那一行。块之外，引擎、前端和 worker 各删了什么、worker 为什么晚一步才删，见[请求收尾](request-teardown.md#落到-glm-双机r1-结束时三处各还了什么)。

## KDA 组和尾状态组：借法和普通注意力不同

普通注意力（这里是full组）按需要覆盖的位置借块：历史、本步和预留合计每跨过640的位置边界，多借1块，请求结束才还。GLM另外两类状态不是这样。

**KDA 组：一条请求一页，第一步就借够。** KDA（Kimi Delta Attention）是一种线性注意力，每层只为一条请求保存一份固定大小的递推状态，不随序列变长。vLLM 把这类组的「块大小」设成最大长度 133,120，于是任何请求的当前状态都只要 1 块；MTP 的 3 个候选各算出一份状态，再各留 1 块。每组 4 块、三组 12 块，第一步就借齐，直到请求结束才还。R1 首步的 15 块里有 12 块花在这里，这就是短请求一进来就占 15 块的原因，见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)。

KDA 状态和 MLA 历史能共用同一套块号，是因为逻辑块大小 640 本来就是按「一页 MLA 装得下一份 KDA 状态」倒推出来的，见[为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。昇腾镜像替换了 KDA 组的管理器，只改了前缀命中和外部 KV 加载两条分支。本部署两者都不用，真正借出的块和上游相同；但「有没有外部 KV」那条判断写成「已算位置多于命中块覆盖的位置」，没有命中时对每条已经在跑的请求都成立，于是每步问「还差几块」时，每个 KDA 组多报 1 块，三组合计多 3 块。这 3 块只进「够不够」的比较，不真借，所以常驻 15–16 块不变；影响只是池子剩下不到「真实所需 + 3」块时就判借不到，抢占提前约 3 块发生。

**尾状态组：窗口外的块，请求没结束就还。** indexer 每 4 个 token 压成一条写进 indexer K，还没凑满 4 个的先暂存在尾状态组里，压缩本身见 [KV cache 规格](kv-cache-spec.md)。这一组按滑动窗口管理，窗口和块都是 4 个位置。窗口之外的位置以后再也用不到，所以调度器每次问池子要块之前，先把整块落在窗口外的块还回去，并在这条请求自己的块列表里把那一格换成 null block；哪怕这一步最后借不到块，这一步也照做。这是本部署里唯一一种「请求还在跑就还块」的情况。这些块从没登记过，在 v0.23 上会被插到队头，马上借给别人。

这里用 null block 保留列表中的位置，不表示请求仍持有原来的状态块。

**尾状态组的块数要按步形状算，完整 decode 步常见 3 或 4 块。** 设分配这一步时已算 $c$ 个位置、本步新算 $n$ 个。调度器先还：窗口是最后 4 个位置，它前面的 $c - 3$ 个位置里凑满整块的还掉；再借：补到装得下「已算 + 新算 + 3 个预留」，但不超过模型最大长度。以下算例都未触及长度上限，而且所需块列表长度没有缩短，所以可用「补到的块数减去窗口外已还的块数」：

$$B_{\text{tail}}(c, n) = \left\lceil \frac{c + n + 3}{4} \right\rceil - \left\lfloor \frac{\max(0,\; c - 3)}{4} \right\rfloor$$

| 步形状场景（未封顶、需求未缩短） | 补到块数 $-$ 窗口外已还块数 | 本步持有尾状态块数 |
| --- | --- | --- |
| R1 第一步（$c = 0, n = 4$） | $\lceil 7 \div 4 \rceil - 0 = 2 - 0$ | **2 块** |
| decode（$c = 200 \equiv 0 \pmod 4,\; n = 4$） | $\lceil 207 \div 4 \rceil - \lfloor 197 \div 4 \rfloor = 52 - 49$ | **3 块** |
| decode（$c = 202 \equiv 2 \pmod 4,\; n = 4$） | $\lceil 209 \div 4 \rceil - \lfloor 199 \div 4 \rfloor = 53 - 49$ | **4 块** |
| 一步 prefill 6,000 token（$c = 0, n = 6000$） | $\lceil 6{,}003 \div 4 \rceil - 0$ | **1,501 块** |

在上述n = 4的条件下，c除以4余0、1、3时是3块，余2时是4块。3或4的来历是：要盖住「窗口里3个已算位置 + 本步4个新token + 3个预留」共10个连续位置，最少跨3块；起点落在块内第4格时跨4块。实际步长更短、接近长度上限或之前已多借时，须结合当前块列表重算，不能固定套3–4。

异步调度还要分清“已经排入计算”和“输出确认接受”：调度时先推进已算计数，输出返回后会减去被拒候选，因而单看这个计数不能认定它从不回退。已多借的尾部块不会仅因需求变小立即退掉；精确占用要同时看列表长度、已经换成null的旧位置和本步新增块。源码区给出这三个量的关系，R1的上述数字仍只表示已声明条件下的静态演算。

**长 prompt 的 prefill 是例外。** 这一步要为本步全部新 token 留格子，尾状态组临时借约 n ÷ 4 块：一条 6,000 token 的 prompt 一步算完，当步借 1,501 块，占 3,855 块池子的近四成。下一完整 decode 步，c = 6000、n = 4，先把窗口外的 floor((6000 − 3) / 4) = 1,499 块归还；块列表再增长到 ceil((6000 + 4 + 3) / 4) = 1,502 项，因此还要新借 1 块。尾状态最终持有 1,502 − 1,499 = 3 块；本轮净释放 1,498 块。预算满载的一个 8,192 token chunk，这一组要借两千多块。

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

- **「每生成一个token都要借一次块。」** 看组与步形状。R1生成200个token仍在full组第一块里，KDA第一步借齐后不再借；昇腾KDA求和每组多报1块却不真借，见[KDA组一节](#kda-组和尾状态组借法和普通注意力不同)。尾状态则边借边还，完整验证步的具体演算见上文。
- **「池子每条请求一份」或「整台机器只有一个池子」。** 每个 DP 组的引擎进程一个池子，组内所有请求、所有 5 个缓存组共用；两台机器各一个。
- **「还块就是把数据清掉。」** 还块只改计数和排队位置。开着 prefix caching 时，数据仍在是归还后还能命中的前提。借出是否另有清零步骤要看平台和 runner：固定上游 GPU 混合路径会准备清零器；旧 Ascend 的 V1 路径要求 eagle3 且投机数大于 1，GLM 用 MTP，借出不做此清零。`v0.30.0` 与 `main` 的 V2 入口见版本表。
- **「计数到 0 的块就不能再被命中了。」** 开着 prefix caching 时，计数为 0 但登记还在的块，被队头取走之前仍可命中；命中时先从队列里摘出来，再加计数。

- **「借不到块会报错。」** 正常路径上分配器只回答「借不到」，由调度器抢占或让新请求等；抢占也不报错，只在请求上记一次抢占次数。
- **「块大小是分配器选的，可以随手调。」** 分配器只按各组给定的块大小算块数。GLM 双机上，逻辑块大小由昇腾补丁先写成 640，平台随后跳过「改回 128」的那段逻辑；来龙去脉见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。
- **「只有 4 个 token 的请求只占 1 块。」** 在 GLM 上它至少占 15 块，其中 12 块是 KDA 状态，与长度无关。

## 对照源码

### 怎么开

分配没有开关，每一步都在跑。和它有关、能调的是下面几项，都不在分配器里决定：

- **前缀缓存。** 固定旧版中，`enable_prefix_caching` 没显式给出时取 `is_prefix_caching_supported` 的结果，混合模型为False（来源17）。关着时 `get_computed_blocks` 第一行就返回空，`allocate_slots` 借完块直接返回、不调 `cache_blocks`，所以不登记也不驱逐。
- **块大小。** 固定镜像的 `refresh_block_size` 对未设值先填128，再处理专用分支：`deepseek_v4` 允许32、64或128，其他显式值会警告并改为32；混合模型随后直接返回，交给专用对齐逻辑。其余走通用注意力分支的模型，开前缀缓存或chunked prefill时把非128改回128，只打一条info日志 [C26]。GLM由镜像补丁写成640，五种含义和启动日志文案见[KV cache规格](kv-cache-spec.md#版本差异)。
- **lookahead。** 等于投机 token 数，本部署是 MTP 的 3；每次 `allocate_slots` 都按「已算 + 新算 + 3」留位置，封顶 `max_model_len`。
- **抢占策略。** 默认先来先服务，抢占 `self.running.pop()` 取出的那条；`policy=priority` 时抢占优先级最低、到达最晚的那条。

对象关系：`KVCacheManager` 持有一个 `KVCacheCoordinator`；协调器按 `kv_cache_config.num_blocks` 建**一个** `BlockPool`，再给每个缓存组建一个单组管理器，全部传进同一个池（来源4）。`BlockPool` 建好后先 `popleft` 出 0 号块当 `null_block`，它的计数不维护，还块时也跳过它。

### 会报什么错

- `ValueError("Cannot get {num_blocks} free blocks from the pool")`：`get_new_blocks` 要的块数超过空闲块数时抛出 [C2]。正常路径走不到：`allocate_slots` 先比过总数，不够就返回 `None` [C6]，调度器据此抢占或停止接纳新请求。
- 抢占不报错：`_preempt_request` 把状态改成 `PREEMPTED`、`num_computed_tokens = 0`、`num_preemptions += 1`，开了统计时记一次 `PREEMPTED` 事件，然后 `waiting.prepend_request` [C16]。抢占频繁时要看这个计数，日志里没有报错可找。
- 块大小自动改写不一定报错：上述通用分支只打info日志 `Block size is set to 128 if prefix cache or chunked prefill is enabled.`；`deepseek_v4` 非法块长则打warning并改为32。GLM的日志文案见kv-cache-spec。
- 排查「借不到块」时，要把 5 个组各差几块、空闲块数、请求的块表、命中记录和抢占计数对起来看。单看剩余显存或一个空闲块数，还原不出混合模型每条请求常驻的 15–16 块状态开销，也看不出长 prompt prefill 那一步尾状态组临时借走的上千块。

### 开销和什么时候别开

- **尾块与状态块的空置。** R1 首步占 15 块、每卡约 119.5 MiB，真正写进去的历史只有几十 KiB，数字见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块) [D]。短请求、高并发时，每条常驻的 15–16 块决定了池子能同时容纳多少条。
- **整块重算。** `get_computed_blocks` 把命中上限压成 `num_tokens - 1`，注释写明因为 `allocate_slots` 要求已算位置对齐块边界，这可能触发整块重算，将来去掉这条限制还能再快一点 [C5]。本部署前缀缓存关，不涉及。
- **只认写满的块。** 基类 `cache_blocks` 只登记 `num_tokens // block_size` 个整块 [C8]。
- **命中空闲队列里的块要占容量。** `get_num_blocks_to_allocate` 把命中块里计数为 0 的那些也算进「要借的块」，因为 `touch` 会把它们从空闲队列摘走 [C7]。

- **抢占。** 一次抢占还回整条请求所有组的块，但已算位置清零；本部署下重算没有前缀可复用，KDA 状态也一起丢 [I]。整批数字见 [concurrent-requests](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)，其中 3,855 块是算例 [A]。
- **KDA 组的一条特殊返回。** 开前缀缓存时，如果本请求要复用的块是本步另一条请求刚生成的，`MambaManager.get_num_blocks_to_allocate` 直接返回 `num_gpu_blocks + 1`，故意制造「不够」，把它推到下一步 [C12]。本部署前缀缓存关，走不到。
- **昇腾 KDA 管理器求块时多报 1 块。** `AscendMambaManager.get_num_blocks_to_allocate` 在上游结果上再判断：`total_computed_tokens > len(new_computed_blocks) × block_size` 且本步有新 token，就 `+1`（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L76-L80`）。运行中的请求传进来的 `new_computed_blocks` 每组都是空的（`vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L171-L173`、`#L339-L342`），所以已算位置大于 0 时每个 KDA 组每步都 `+1`，三组合计 `+3`，只进求和与空闲块的比较。真正借块走上游 `MambaManager.allocate_new_blocks`，none 模式补到 4 块、已有 4 块，借 0；外部 KV 那一块只在 `num_external_computed_tokens > 0` 时才借（`single_type_kv_cache_manager.py#L246`），本部署为 0。替换类经 `vllm_ascend/patch/platform/__init__.py#L43` 导入时改写模块里的 `MambaManager`，上游注册表在第一次取管理器时才按这个名字登记（`single_type_kv_cache_manager.py#L1369`），所以生效。v0.23 `2c59ff10` L76 同式；v0.26 `2ed6cbba` L63、L80 与 main `baa023ad` L66、L83 只是把 `len(new_computed_blocks) × block_size` 提成变量 `local_hit_tokens`，条件不变。影响：抢占约提前 3 块触发；常驻 15–16 块、被抢占那条 120–121 块不受实质影响。
- **尾状态组每一步借几块、还几块。** 窗口 = 块 = `compress_ratio` = 4，规格登记给上游`SlidingWindowManager`；求块数和借块走基类。设分配前列表长度为L，开头已经换成null的项数为Z，已算位置c、本步新算n、最大长度M。先归还窗口外的已有块，null项数变为`Z' = max(Z, min(floor(max(0,c−3)/4), L))`；成功分配后列表长度为`L' = max(L, ceil(min(c+n+3,M)/4))`，实际持有`L'−Z'`块。只有需求没有缩短、尚未封顶时，才简化为正文的ceil减floor；完整n=4步为3–4块。较短步可能继续持有之前多借的块，不能直接从新需求反推实占。[C6][C7][C8][C10][C11]

  chunked prefill还要容纳“窗口内已算 + 本步全部新token”，每请求准入上限为`cdiv(3 + 8192, 4) + 1 = 2,050`；waiting侧整段准入先用此上限检查。[C31][C32] 异步调度时c可能含尚未验证的候选，调度后先加、输出后按拒绝数减；实际追踪须同时保留列表与null位置，不能宣称计数始终不回退。[C44][C45][C46]
- **借出不清零（GLM 双机）。** 调度器侧 `needs_kv_cache_zeroing` 在有 Mamba 组时为真，本步新借块号里规格属于 `FullAttentionSpec`、`TQFullAttentionSpec`、`MLAAttentionSpec` 三种精确类型的，列进待清零清单随调度结果下发。执行侧 `_zero_block_ids` 只在 runner 上有 `_kv_block_zeroer` 时才动手；上游 GPU worker 只要 `needs_kv_cache_zeroing` 为真就建它，昇腾 worker 却只在投机方法为 `eagle3` 且投机 token 数大于 1 时才建。GLM 用 `mtp`，所以清单下发了也不清零，抢占后重新借块也没有清零开销。

**待核。**

1. 异步调度：没有显式指定时自动判定，本部署的 `mtp` 与多进程执行器都满足打开条件，按默认值推断为开；打开时还块与输出回传会错开一步。没有启动日志确认 [!]。
2. 固定 GLM 教程未配 KV connector，抢占仍在本机重算；[抢占卸载](recompute-cpu-offload.md#放到-glm-双机主线不启用它)要求 PD 分离的 D 侧与 RecomputeScheduler，[通用 CPU offload](kv-cache-cpu-offload.md#放到-glm-双机主线没开它开了要搬多少)在该固定组合还有接口和多组布局障碍。GLM 混合状态的端到端恢复仍待设备验证 [!]。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`）、`v0.26.0rc`（`vllm@568afb3a` / `vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm@ced6857a` / `vllm-ascend@c09d3e20`）与 `main`（`vllm@ba15685a` / `vllm-ascend@8d6180e2`）。**本页 GLM 绑定算例仍按专用镜像 `db701c1f` 与 `vllm@0fc695fc` 核对**；`v0.23.0`、`v0.26.0rc` 社区钉点不含同一 GLM 模型文件。

**`v0.30.0` 起上游打破了“一协调器一池”的单一前提，到 `main` 则用弱引用管理跨池归还、且昇腾侧因收敛至 MRV2 简化了 KV 清零器判定**：无 hash 或关闭 APC 的块仍插队首作 LIFO 重用，有 hash 的缓存块排队尾作 LRU 淘汰；HiSparse 源管理器可绑定独立 CPU host pool，块携带所属 pool 并在释放时转交所属池。

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
| --- | --- | --- | --- | --- |
| 池归属与共享 KV 底板 | 协调器建唯一 `BlockPool` 供各组共用 | 同 `v0.23.0` | `block_pool.py#L783` 与 `kv_cache_coordinator.py#L378` 支持 HiSparse 绑定独立 host pool，归还按 `block.pool` 转交 | `block_pool.py#L819` 改用弱引用 `self._weak_self` 转交所属池防循环引用；常规协调器仍按组共享池 |
| 还回块的队列顺序 | 默认排队尾；滑窗未登记块可插队头 | 未登记插队头，登记过排队尾 | 无 hash 或关闭 APC 插队头，其余排队尾（支持跨池转交） | 同 `v0.30.0` |
| full 组与 Mamba 部分尾块登记 | full 组仅登记完整块；Mamba 无尾状态分支 | 缓存块与哈希粒度不等时登记最后有效边界；Mamba `align` 登记尾状态 | 延续部分尾块登记；Mamba `align` 含检查点与 `retention=0` 临时状态限制 | 同 `v0.30.0` |
| 昇腾建 KV 清零器（`worker.py`） | 有 Mamba、且 `eagle3` + 投机数 > 1 | 同 `v0.23.0` | `worker.py#L1222`：V1 保留旧 `eagle3` 条件，V2 按规格要求清零即可初始化 | `worker.py#L1311`：收敛至 MRV2 后**直接取 `kv_cache_config.needs_kv_cache_zeroing`**，去除旧 V1 特判 |
| 昇腾 `AscendMambaManager` 额外需求计数 | 本地命中不足已算数且有新 token 时 `+1` | 条件相同，提取 `local_hit_tokens` 变量 | `patch_mamba_manager.py#L53-L91` 延续 `+1` 额外容量检查（适配新上游参数） | `patch_mamba_manager.py#L48-L95` 同 `v0.30.0` |

本部署关闭前缀缓存且无 KV connector，哈希粒度等于调度块大小 133,120，部分尾块登记不参与 R1 算例。四版共同的基础借还仍须区分普通块与保留的 `null_block`；新增 host pool 亦有独立保留块，不能把设备池总数直接搬作主机可用容量。

### 源码位置

R1 在代码里的路径（vLLM `0fc695fc`）：

1. **启动**：`KVCacheCoordinator` 建一个 `BlockPool`，所有缓存组共用；`BlockPool` 持有全部块和 `free_block_queue`，先 `popleft` 出 0 号块当 `null_block`。
2. **查命中**：`Scheduler.schedule` 排 waiting 时先调 `get_computed_blocks`；前缀缓存关，返回空。
3. **借块**：`allocate_slots(request, 4, num_lookahead_tokens=3)` 先 `remove_skipped_blocks`，再逐组 `get_num_blocks_to_allocate` 求和，与 `get_num_free_blocks() - reserved_blocks` 比；够则 `allocate_new_blocks` → `BlockPool.get_new_blocks`：`popleft_n`，开缓存时先 `_maybe_evict_cached_block`，再把 `ref_cnt` 从 0 改成 1。

容量检查也可以阻止尚不满足执行依赖的请求进入当前步。固定上游 Mamba 管理器不能复用其他请求在当前步骤刚生成的递推缓存，因此返回一个大于整个池容量的需求值，使申请失败。这表示缓存本步尚不可用，不等于物理显存耗尽；昇腾替换的 KDA 管理器须另按自身实现判断。
4. **decode**：每步running循环里再调`allocate_slots`，先让尾状态组归还窗口外旧块，再求各组容量需求。full组已有块够用时需求为0；固定Ascend的KDA容量检查每组仍多报1块，实际`allocate_new_blocks`才是借0块。尾状态组按上文L/Z关系求新增量；完整、未截短且需求向前的decode步跨过一个4位置边界时补1块，其他步形状须重算。
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
| 借出清零的条件 | 上游 `vllm/v1/worker/gpu_worker.py`（建清零器）、`gpu_model_runner.py` 的 `_zero_block_ids`；Ascend固定V1与新V2入口按版本表区分 |

**正文证据索引。** 空闲队列、null block与借块见来源1；命中、驱逐与还块见来源3；各组倒序还块见来源9；抢占循环与waiting侧不抢占见来源14。其余出处按sources顺序：一个EngineCore一个池（4）、命中上限与前缀缓存关时直接返回（5）、借块总判断与还块入口（6）、按组算块数与候选被拒不退块（7）、只登记整块（8）、尾状态组中途还块（10、11）、KDA组每组4块且不中途还块（12、13）、waiting侧借不到就停（15）、昇腾替换版KDA管理器（18）、调度块大小与哈希粒度（19）、借出清零的调度器侧（20、21）与执行侧（27、28、33）、尾状态组的窗口与块（29、30）、滑动窗口的prefill占用与准入上限（31、32）、三个钉点的清零条件（34–36）。

固定 block_pool 的 `touch` 对引用计数为零的普通块先移出空闲队列再加计数，已有持有者时直接加计数（来源 3）。所以命中省重算，却不一定省空闲容量；此结论排除 null block，适用于启用 prefix caching 的命中路径，固定 GLM 部署并未开启它。

null block 的初始化与引用计数例外见来源 1、3，列表占位与窗口外块归还见来源 10。池总块数包含不能作为普通块借出的占位块，因此总块数与可借容量不能直接等同；具体容量还取决于缓存规格和当前持有情况。

固定 `kv_cache_manager.py` 在容量判断前先调用 `remove_skipped_blocks`（来源 6 的 375–398 行），所以后续申请失败时，部分不再访问的旧块可能已经归还。前提是缓存规格允许释放；full 组不能因为某位置已算过就回收历史。

Mamba 的同一步缓存依赖检查见固定 `single_type_kv_cache_manager.py` 的 1063–1072 行（来源 12）：命中本步新缓存时返回 `num_gpu_blocks + 1` 使容量检查失败。这是该管理器的控制流，不能推广到所有缓存组或昇腾替换版 KDA 管理器。

- `v0.30.0`（及历史候选快照）清零器与 KDA 需求计数见 42–43，v0.26/main 计数分支见 55–56。调度提前推进、输出扣除拒绝候选及异步占位见 44–46。
- none模式实际借块见47，外部已算位置大于0时的追加路径见48，运行请求默认空命中列表见57。waiting只有异步加载且use_eagle时取消lookahead（58），固定GLM不走此例外。
- full组部分尾块入口见25，实际登记调用、边界和Mamba状态条件见49–51、54；v0.26 Mamba的align尾状态登记见59。
- 上游设计全文与配套图见52–53。混合管理指南基于较早提交458e74，其分层接口和普通块示意可用于理解管理结构；单页大小、分组启发式及Mamba“仍在开发”的描述须结合本页固定源码和GLM专用两档页阅读。普通前缀设计中的整块与倒序归还规则按本页版本表区分。
- `v0.30.0`（`ced6857a` / `c09d3e20`）与 `main`（`ba15685a` / `8d6180e2`）跨池归还、清零器判定与 `AscendMambaManager` 核验见文首 `sources` 末尾 7 条（`kv_cache_manager.py`、`block_pool.py`、`kv_cache_coordinator.py`、`patch_mamba_manager.py`、`worker.py`）。
