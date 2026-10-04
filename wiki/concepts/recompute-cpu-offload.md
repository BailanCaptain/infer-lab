---
id: recompute-cpu-offload
title: "Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回"
type: feature
summary: vllm-ascend 给 PD 分离 D 节点配的连接器：RecomputeScheduler 让出一条请求前先问它，主机块够就把这条的全部 KV 块同步拷到主机，排上那一步在前向前搬回、下一步接着算；不够就整条退回 P 重算。讲清两条恢复路径的取舍（示意数）、和 CPU 备份、KV Pool 的区别；GLM 双机主线不拆 P/D，没有启用。
aliases: [Recompute CPU Offload, Preempt Offload, RecomputeCPUOffloadConnector, PreemptOffloadConnector, 抢占卸载, 抢占换出, 换出换回, enable_offload_prefix_caching, cpu_bytes_to_use_per_rank, offload_host_memory_ratio]
chapters: ["11", "12"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L297-L345
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L40-L96
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L63-L118
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L133-L156
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L179-L234
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L236-L368
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L517-L553
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L96-L116
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L175
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L200-L284
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1984-L1989
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L65-L77
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L23-L26
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L40-L61
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L226-L274
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L276-L307
  - vllm@0fc695fc:vllm/config/parallel.py#L776-L780
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L553-L562
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L262-L292
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L266-L280
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L45-L63
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L282-L295
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L105-L130
  - vllm-ascend@baa023ad:vllm_ascend/worker/v2/model_runner.py#L320-L326
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L118-L123
  - https://github.com/vllm-project/vllm-ascend/pull/16510
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L548-L672
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L138-L170
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L286-L305
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: recompute-scheduler, kind: builds-on, note: 调度器让出请求前先问本连接器能不能存走，存不走才退回 P 重算}
  - {to: block-table, kind: builds-on, note: 块映射决定需要保存和回填的物理位置}
  - {to: kv-cache-cpu-offload, kind: alternative-to, note: 同样把 KV 放到主机，但那边算满一段就备份、给开头相同的请求用；这边只在抢占那一刻替这一条存}
  - {to: kv-pool, kind: alternative-to, note: 池按内容指纹存前缀段，谁的开头对上谁能取；换出只存被抢占的这一条，只有它恢复时取回}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 被抢占的请求，KV 能不能先存到主机、回来再搬回？

**Recompute CPU Offload 是 vllm-ascend 给 PD 分离里 D 节点配的一个连接器。D 上块不够、调度器要从正在生成的请求里让出一条时，先问它：能不能把这条请求已经算好的 KV 块拷到主机内存？能，就先拷走、再让块，这条请求排回来时先把块搬回显存，再从断开的位置接着算；不能，就走原来的重算那条路。**

先把几个词对上：

- **抢占**：KV 块不够时，调度器把一条正在跑的请求暂停，收回它的全部块让给别人，这条请求排回等待队列，见 [KV 块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。
- **PD 分离**：P 节点做 prefill，D 节点做 decode，见 [PD 分离](pd-disaggregation.md)。本页只在 D 节点上起作用。
- **连接器**（KV connector）：vLLM 里把 KV 搬进搬出的插件。
- **[RecomputeScheduler](recompute-scheduler.md)**：D 节点上的调度器。它让出请求前先问连接器能不能存走，存不走就结束这条请求，交给 P 重算。
- **[KV cache CPU offload](kv-cache-cpu-offload.md)**：另一种把 KV 放到主机内存的做法，算满一段就备份，给开头相同的请求用。本页不一样：只在抢占那一刻、只替被抢占的这一条存。

看一个例子（示意数）：一块装 4 个位置。请求 A 已经算了 9 个位置，占 3 块，第 3 块只用了 1 格。池子不够了，调度器挑中 A 让出块。同一次抢占，A 有两条恢复路径：

```wiki-diagram
file: recompute-cpu-offload
```

- **上面：换出、换回（本页）。** 先把 A 的 3 块从显存拷到主机，拷完才把块号让给 C。等池子空出来、A 排上时，调度器给它分 3 个空块（块号不必和原来相同），这一步先把主机那 3 块搬回来，下一步 A 才从第 10 个位置接着算。搬回以后，主机那份就释放了。
- **下面：重算。** 3 块直接还给池子，A 手里只剩 token 编号。开了 RecomputeScheduler 的 D 不在本机算，而是结束 A、交给 P 把这 9 个位置整段重算，再交给一台 D 接着生成，图里画的就是这条；不拆 P/D 的部署没有这一步，A 排回来后在本机从头重算。

两条路是这样接起来的：RecomputeScheduler 每次让出请求都先问本连接器；主机里的空闲块够存下整条，走上面；不够、没配本连接器，或者这条请求还一个位置都没算，走下面。所以本连接器不取代重算，而是在重算前面加了一道「存得下就先存」。

## 为什么需要它，又要付什么？

**D 节点每步能算的位置很少，被抢占的请求如果重算，要么退回 P 把整段再算一遍、再交接一次，要么在 D 上排很多步；可它的 KV 其实已经算好，只是显存暂时放不下。换出换回把这份 KV 交给主机内存保管，代价是搬两趟字节：主机内存要预先划出来，而且这一版的两趟搬运都是同步的，搬的时候 D 上这一步的所有请求都在等。**

D 为什么不适合重算、退回 P 又要付什么，[RecomputeScheduler 的这一节](recompute-scheduler.md#为什么-d-节点不自己重算退回-p-又要付什么)算过：D 的每步 token 上限按 decode 定，通常只够每条请求走一步，在 D 上重做整段 prefill 要很多步，还容易把显存撑爆；退回 P 则要整段重算、再把 KV 交接一次，已经生成的越长越贵。

主机内存是 CPU 一侧的内存，比显存大得多，离 NPU 远一些，两者分开记账，见[主机内存与显存](device-memory.md)。被抢占的请求交出去的是显存块，它算好的 KV 本身没有错；只要在块被别人覆盖之前把字节拷走，回来时原样搬回，就一个位置都不用重算。

代价有四条：

- **主机内存预先划出、一直占着。** 启动时按预算一次开好锁页内存（不会被操作系统换出，传输更快），用不用都占着。
- **两趟搬运都同步。** 存发生在抢占的那一步、这一步的计算开始之前；取发生在它排回来的那一步、前向开始之前。每趟都先等这张卡上已经排队的计算全部做完，再一块一块、一个张量一个张量地发拷贝，拷完才往下走。D 上同一步的其他请求都跟着等。官方说明这一版拷贝只求正确，还没为吞吐优化。
- **全有或全无。** 一条请求要么全部块都存下，要么一块不存。主机剩下的块不够整条，就走重算；主机预算给少了，等于没开。
- **显存池不会变大。** 显存里的块数没变，省下的是重算。

## 一次换出、换回怎样走完？

**分两半做：调度侧（调度器所在的进程）决定存不存，记下「显存块 → 主机块」的对照；worker 侧（每张卡上跑模型的进程）真正拷字节。存，要赶在块被别人写之前拷完；取，要等每张卡都报告存好了才能开始。**

继续用 A（9 个位置，3 块）。设这个 D 实例用 2 张卡做 [TP](tensor-parallel.md)，每张卡上都有 A 的 3 块，块号相同，装的是这张卡自己那一份。

1. **问。** RecomputeScheduler 续块失败，挑中 A，把 A 的块号和已算位置数 9 交给连接器。
2. **记账（调度侧）。** 连接器按 9 个位置算出要存 3 块，再看主机块池还剩几块空的。不够 3 块，打一条 warning，答「不能」，A 整条走重算；够，就从主机块池拿 3 块，记下「显存块 → 主机块」的对照，把 A 标成「存着、还没好」，答「能」。调度器接着照常抢占：还掉 A 的显存块，已算位置清零，把 A 排回等待队列的队首。
3. **拷走（worker 侧，同步）。** A 刚还掉的块号，调度器在同一步里就能再分给别人，比如 C。所以每张卡在这一步整理输入之前，也就是在给 C 的新块清零、前向往里写 KV 之前，先把 A 的 3 块从显存拷到主机，拷完才往下走。
4. **集齐。** 每张卡拷完报一声。调度侧把报告加起来，凑满实例里的卡数（这里是 2），才把 A 从「存着、还没好」改成「可恢复」。A 要是在这之前就结束了（比如被客户端取消），主机块也要等这笔拷贝报完才回收。
5. **排回来，先问能接上多少。** 调度器排到 A 时，问连接器能从主机接上多少个位置：
   - 还没集齐：回答「说不清」。调度器这一步跳过 A，下一步再问。这不能当成「0 个」，否则 A 会被当成新请求，从头重算。
   - 已经可恢复：能接上的位置 = min(存下的已算位置, 请求现在的总长) − 本地已算 = 9 − 0 = 9 个。
6. **分块、搬回，A 这一步不算。** 连接器回答能接上 9 个位置时，同时告诉调度器「这些要先搬过来」。调度器给 A 分 3 个空块，把 A 标成「等 KV 到齐」，这一步不给 A 排任何位置；连接器记下「主机块 → 新显存块」。这一步前向开始之前，每张卡把 3 块从主机拷回显存，拷完前向才开始，同一步的其他请求也等着这笔拷贝。
7. **下一步接着算。** 这一步结束时，每张卡报告 A 的 KV 已经收齐；下一步调度器把 A 的已算位置定为 9，放回可以排的队里，A 从第 10 个位置接着算。已算位置要是正好等于请求总长，就退回 1 个，留最后一个位置重算，好采样出下一个 token，这条规则见 [RecomputeScheduler](recompute-scheduler.md#本调度器在上游之上改了哪几处)。主机那 3 块在收齐以后释放。

和 [KV cache CPU offload](kv-cache-cpu-offload.md#搬运在后台进行计算什么时候要等) 比，两边都要把请求挂起：排上那一步只搬不算，搬完以后的下一步才接着算。区别在搬的方式：那边在后台传输流上搬，搬多久就挂多久，同一步的其他请求照常算；这里是同步拷贝，这一步前向之前就搬完，搬的时候整步都停着。

## 存哪些块，主机要留多少？

**存的单位就是显存池里的块：一条请求已算位置覆盖到的每一块都整块拷走，最后一块没写满也整块拷。主机那边按「每卡预算 ÷ 每块字节」切成同样大小的块；一条请求要的块数超过主机剩下的空闲块，就整条不存。**

要存几块：已算位置数 ÷ 每块位置数，向上取整。A 是 ceil(9 ÷ 4) = 3 块。第 3 块只有 1 格有效，也整块拷过去；另外 3 格照样是空的，不会因此变成「已算」，恢复时只把前 9 个位置当作已算。

一块的字节，要把这个块号在所有缓存张量里占的空间加起来。沿用 [KV cache 页的示意模型](kv-cache.md#存一份要多少从一个位置一层往上乘)，每个位置 32 层共 128 KiB，一块 4 个位置就是 512 KiB，A 的 3 块是 1.5 MiB：存一趟 1.5 MiB，搬回再一趟 1.5 MiB。

主机预算有三种写法：直接写每张卡的预算（推荐）；写整个实例的预算，按实例里的卡数平分；都不写，发布分支按整个实例 8 GiB 平分。「实例里的卡数」是 TP × PP × PCP，也就是[张量并行](tensor-parallel.md)、[流水线并行](pipeline-parallel.md)和 prefill 阶段的 [context parallel](context-parallel.md) 三者的份数相乘，不含 DP。

算预算要注意口径：每张卡只存这张卡自己那份 KV。上面每个位置 128 KiB，是一张卡跑整个模型时的量；8 张卡按 KV 头切成 TP8 时，每卡每个位置只剩 16 KiB，不写预算时每卡也只分到 1 GiB，两边一起缩小。也有 TP 下每卡各存一整份的缓存，比如 [MLA](mla.md)，那时每卡字节不缩小。下面按单卡实例、不写预算，算一笔：

```calc
title: 单卡实例不写预算时，主机能存多少（示意数）
每卡预算 = 8 GiB ÷ 1 张卡 = 8 GiB
每块的字节 = 4 位置 × 128 KiB = 512 KiB
主机块数 = 8 GiB ÷ 512 KiB = 16,384 块
主机能存的位置 = 16,384 块 × 4 = 65,536 个
一条 32,768 个位置的请求要 = 32,768 ÷ 4 = 8,192 块
同时存得下 = 16,384 ÷ 8,192 = 2 条
> 第三条同时被抢占的装不下整条，就一块也不存、退回重算；TP8 时每卡 1 GiB、每块 64 KiB，块数和位置数都一样
```

主机块池在启动时就按这个块数整块开好。main 分支不写预算时改成「主机块数 = 显存块数」，等于把整个显存 KV 池在主机上原样再锁一份。

还有几种块要单独处理：

- **混合模型的缓存组。** 一个块号在每个缓存组里各占一格（组是什么见 [KV 缓存规格](kv-cache-spec.md)），连接器按组逐个记，所有组的块一起存。[Linear attention](linear-attention.md) 这类递推状态不随位置增长，不能按「位置 ÷ 每块位置数」去数：v0.26 和 main 对这类组只存最后 1 + 草稿数 块，也就是当前状态一块、[投机解码](speculative-decoding.md)的每个草稿位置各一块；v0.23 和 GLM 快照没有这条特殊处理，按和 attention 组一样的办法截取这类组的块表，存下的是不是完整的当前状态，待核。
- **滑动窗口。** 窗口外的位置在块表里是空块号，连接器保留它们的位置、只拷有内容的块，块表前后仍然对齐。
- **投机解码。** 排回来时调度器还会为草稿位置多留几块；搬回按这一步实际分到的块截断。

## 搬运与重算之间的成本

**换出换回要把这条请求的字节搬两趟，存一趟、取一趟，每趟都停住 D 上的一步；重算不占主机内存、不搬这些字节，但要把这些位置再算一遍，退回 P 时还要再交接一次、两边重新排队。请求越长，两边都越贵：换出省下的计算越多，D 被停住的时间也越长，主机也越容易装不下整条。**

两条路的账记在不同地方：

- **换出换回**：D 付两次停顿；主机付内存。这条请求自己恢复得快：排上那一步搬回，下一步就接着算。
- **退回 P 重算**：P 付整段 prefill，网络付再一次交接；这条请求自己要在 P、D 各排一次队，客户端看到输出停一会儿。D 不用停步子，再收一次 KV 时别的请求照常往下算。

先比这条请求自己多久能接上。两边都换成时间：换出换回 = 2 × 字节 ÷ 主机与设备之间的有效带宽，重算 = 位置数 ÷ 每秒能 prefill 的位置数。沿用 [KV cache CPU offload 那一页的示意数](kv-cache-cpu-offload.md#搬回和重算各花多少)：每个位置 128 KiB，有效带宽 16 GiB/s，每秒 prefill 16,384 个位置。那一页只搬回一趟，这里存、取各一趟：

```calc
title: 三种长度下，换出换回和重算各花多少（示意数）
256 个位置，存 + 取 = 2 × 32 MiB ÷ 16 GiB/s ≈ 3.9 ms
256 个位置，重算 = 256 ÷ 16,384 个/s ≈ 15.6 ms
4,096 个位置，存 + 取 = 2 × 512 MiB ÷ 16 GiB/s = 62.5 ms
4,096 个位置，重算 = 4,096 ÷ 16,384 个/s = 250 ms
32,768 个位置，存 + 取 = 2 × 4 GiB ÷ 16 GiB/s = 500 ms
32,768 个位置，重算 = 32,768 ÷ 16,384 个/s = 2,000 ms
> 字节 = 位置数 × 128 KiB；重算按固定速度估，长开头实际更慢；都没算排队、交接和同步的固定开销
```

线性估算下，两边的比例不随长度变，始终是 1 比 4；长短的差别来自不随长度缩短的固定开销、D 被停住的时长和主机容量。按长度读这组数：

- **短，几百个位置。** 两边都只要几毫秒到十几毫秒。可退回 P 那条路另有不随长度缩短的固定开销：[代理重投](recompute-scheduler.md#一次退回-p怎样走完)、P 和 D 各排一次队、再交接一次。短请求换出恢复得更快，D 停的那几毫秒也不显眼。
- **中，几千个位置。** 换出约是重算的四分之一。但这 62.5 ms 是分两次停在 D 上的：抢占那一步停约 31 ms，排回来那一步再停约 31 ms。
- **长，几万个位置。** 换出仍然省计算，0.5 s 对 2 s 以上；可 D 每次要停约 0.25 s。主机也吃紧：一条就要 8,192 块，按[上一节](#存哪些块主机要留多少)单卡不写预算时的 16,384 块，同时只存得下两条，第三条同时被抢占的只能退回 P。

还有三处要补：

- **有效带宽要实测。** 存、取两趟都要搬，持平点是那一页单趟算法的两倍：2 × 128 KiB × 16,384 个/s = 4 GiB/s。有效带宽高于它，换出换回比重算快；低于它，反而更慢。这一版逐块、逐张量发拷贝，有效带宽要按实测算，不能拿链路的标称值代入。
- **同样长度，字节也不同。** 每个位置的字节随模型结构变：层数多少、是不是混合模型、有没有固定大小的递推状态；TP 下每张卡只存自己那一份。
- **实现本身不做这笔比较。** 主机存得下就存，存不下才退回 P；这笔账是用来决定开不开、预算给多少的。

## 和 KV cache CPU offload、KV Pool 有什么不同？

**三者都把 KV 放到显存之外，区别在存什么、按多大粒度、什么条件下取回：换出存的是被抢占的这一条请求当时的全部块，只有它排回来、而且每张卡都报告存好了才取回；CPU 备份和 KV Pool 存的是按内容认出来的前缀段，谁的开头对上谁就能取。**

| | 换出换回（本页） | [KV cache CPU offload](kv-cache-cpu-offload.md) | [KV Pool](kv-pool.md) |
|---|---|---|---|
| 存什么 | 被抢占那条请求已算位置覆盖的全部块，所有缓存组 | 算满的前缀段，默认只存提示词部分 | 写满的前缀段，按内容指纹登记 |
| 按多大粒度 | 块；一条请求全有或全无 | 段，相邻几页拼成；不满一段的尾巴不存 | 段 |
| 什么时候存 | 抢占那一刻，只存这一条 | 算满一段就存，和显存满不满无关 | 每写满一段就存 |
| 存在哪、谁能用 | 本机主机内存；只有这条请求 | 本机主机内存；本实例开头相同的请求 | 共享存储；接同一个池的所有实例 |
| 什么时候取回 | 这条请求排回来，且每张卡都报告存好 | 进场时显存没命中、主机能接上 | 开头指纹对上、本地又没有 |
| 搬运 | 同步，存、取都停住这一步；请求挂起一步 | 后台传输流，请求挂起到搬完 | 见 [KV Pool](kv-pool.md#查到以后分配搬运使用写回) |

最容易混的是恢复条件。被抢占的请求如果只靠 CPU 备份或 KV Pool，排回来时已算位置清零，像新请求一样按开头去查；这两条路默认只管提示词里的整段，它 decode 时生成出来的那部分查不到，照样要重算。换出存的是抢占那一刻的全部块，生成出来的部分也在里面，恢复时也不需要「开头相同」这个条件。KV Pool 那边的对照见[它的这一节](kv-pool.md#和抢占换出cpu-备份有什么不同)。

换出也有一种按内容共用的情形：两条被抢占的请求开头相同，主机里可以只存一份相同的块。比如 A、B 都算了 9 个位置、前 8 个一样，各占 3 块；前 2 块写满、内容相同，可以共用，第 3 块只写了 1 格，各存各的。不共用要 6 块，共用只要 4 块。三个条件都要满足：

- 打开共用开关。它默认关，官方标为实验性。
- 显存那边开着 [prefix caching](prefix-caching.md)。共用靠块的内容哈希来认，显存块只有 prefix caching 开着时才会算哈希。
- 块已经写满。没写满的块没有哈希，照样私有；v0.26 和 main 上，递推状态那类块也不参与共用。

同一步里先后被抢占的两条，后一条可以挂到前一条正在拷的那份上，不再重复拷；它的「可恢复」也要等那笔拷贝报完。这个例子只说明满足条件的块怎么计数，不保证任意两条请求的全部状态都能按开头共用。

## 放到 GLM 双机：主线不启用它

**GLM 双机主线的两台机器合起来是一套 P、D 不分的服务，没配 KV 传输，RecomputeScheduler 的开关保持默认关；本连接器只能跟着 RecomputeScheduler 用，所以主线上它不起作用。主线的抢占走上游那条路：还掉全部块，排回来在本机从头重算。**

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。RecomputeScheduler 为什么在主线上开不了、硬开会怎样，见[它的 GLM 一节](recompute-scheduler.md#放到-glm-双机主线不启用它)。

主线的抢占有多贵，整批账在[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)：DP 组 0 跑满 32 条、每条走到约 67,000 个位置时池子用光，被抢占的那条每卡还回 120–121 个块号，约 956–964 MiB，排回来要在本机重算约 9 步；prefix caching 关着，没有可复用的前缀，34 层 KDA 的递推状态也随块一起丢掉。换出想省掉的，就是这类重算。

如果把两台机器拆成一 P 一 D，在 D 上开它，先拿默认预算和主线那条请求的大小对照一下量级。这不是这项特性在 GLM 上的效果；1P1D 下 D 的块池多大、什么时候触发抢占，还没有算过：

```calc
title: 在 D 上开它：默认预算装得下几条主线那样的请求（对照）
每卡预算 = 8 GiB ÷ 8 张卡 = 1 GiB，TP8 一个实例
一个块号每卡 = 8,355,840 B ≈ 7.969 MiB
主机块数 = 1,024 MiB ÷ 7.969 MiB ≈ 128 个块号
主线被抢占的那条 = 120~121 个块号 ≤ 128 个块号
> 只够存一条；同时被抢占的第二条只能退回 P。块号字节见部署页，块数见多条请求页
```

一个块号的字节见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。真要在 GLM 上用，还有几处没有核过：

- **停多久。** 每趟每卡约 956–964 MiB，存、取各一趟；主机与 NPU 之间的有效带宽没有实测，D 每次要停多久，待核。
- **混合状态能不能存对。** 稀疏 MLA 的历史、索引器的尾状态、34 层 KDA 的递推状态，必须对应同一个位置才能接着算。GLM 快照和 v0.23 是同一份连接器代码，没有给递推状态组特殊处理，KDA 那 3 组存下的是不是完整的当前状态，待核。v0.26 和 main 对这类组只存最后 1 + 草稿数块，GLM 用 MTP 出 3 个草稿，正好是每组 4 块的布局（见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)）；但 GLM 的模型代码只在 GLM 快照和 main 上，main 上能不能走通，待核。
- **共用走不到。** 主线 prefix caching 关着，显存块没有哈希，被抢占的请求之间不会共用主机块。
- **context parallel 这条满足。** 连接器要求 PCP、DCP 都是 1，主线没开 context parallel。

## 常见误解

- **「它就是 KV cache CPU offload」**——不是一回事，官方问答也专门澄清过。那边算满一段就备份、按内容给开头相同的请求用；这边只在抢占那一刻、只替被抢占的这一条存，见[上面的对照](#和-kv-cache-cpu-offloadkv-pool-有什么不同)。两边搬运的代码也各是各的。
- **「开了它，被抢占的请求就不会再重算」**——不一定。主机空闲块不够存下整条、这条还一个位置都没算，都会退回 P 重算；main 上连接器出错也兜底退回。退回时只有日志，客户端看到的是输出停一会儿再接着出。
- **「只配这个连接器就行」**——还要同时开 RecomputeScheduler，而它只能在 PD 分离的 D 节点上开。不拆 P/D 的部署只配连接器，没人来问它，照常在本机重算；开了 context parallel 则启动时断言失败。
- **「存到主机是后台做的，不影响别的请求」**——这一版存、取两趟都同步，搬的时候整步停住，同一步的其他请求都跟着等。
- **「整个实例的预算按 DP 数平分」**——官方文档这么写，代码按 TP × PP × PCP 平分，不含 DP。DP2、TP8 的 D 写 16 GiB，每卡是 2 GiB，不是 8 GiB。直接写每卡预算最不容易错。
- **「开了它，显存能多装请求」**——显存池的块数不变，它省的是重算，不是显存。

## 对照源码

### 怎么开

```bash
# 只写在 D 节点上；P 节点照常只配 MooncakeConnectorV1（kv_producer）
--additional-config '{"recompute_scheduler_enable": true}'
--kv-transfer-config '{
  "kv_connector": "MultiConnector", "kv_role": "kv_consumer",
  "kv_connector_extra_config": {"connectors": [
    {"kv_connector": "MooncakeConnectorV1", "kv_role": "kv_consumer", ...},
    {"kv_connector": "RecomputeCPUOffloadConnector", "kv_role": "kv_consumer",
     "kv_connector_extra_config": {"cpu_bytes_to_use_per_rank": 17179869184}}
  ]}}'
# main：连接器名改成 PreemptOffloadConnector
```

- 两样都要：`recompute_scheduler_enable`（只在 D 上开，各版本写法见 [RecomputeScheduler 的「怎么开」](recompute-scheduler.md#怎么开)）加本连接器。D 上既要从 P 收 KV、又要换出，所以用 `MultiConnector` 把两个连接器串起来；昇腾把注册表里的 `MultiConnector` 换成 `AscendMultiConnector` [C13]，它把 `update_state_before_preempt` 逐个转给子连接器，有一个答「能」就算能 [C12]。
- 预算 [C2]：`cpu_bytes_to_use_per_rank` 优先，和按实例平分的值对不上时打 warning、仍用它；`cpu_bytes_to_use` 默认 `8 * 1024**3`，除以 `parallel_config.world_size`，后者 = PP × TP × PCP，不含 DP [C17]。官方文档说按 Decode 的 DP 数平分，与代码不一致 [C14][!]。main 另有 `offload_host_memory_ratio`（默认 1），两个字节参数都不写时按它定块数 [C21]。
- 共用开关 `enable_offload_prefix_caching`：连接器读配置时默认 `False`，不是布尔值就 `ValueError` [C2]；manager 构造参数的默认值写的是 `True`，但连接器总是把配置值显式传进去 [C3]，所以实际默认关。官方标为实验性。
- 主机块数 [C4]：`max(1, num_gpu_blocks * cpu_capacity_bytes // gpu_total_bytes)`，`gpu_total_bytes` 是所有带 `shared_by` 的显存 KV 张量之和，等价于「预算 ÷ 每块字节」；worker 端按同一块数开 `pin_memory=True` 的 CPU 张量 [C8]。
- 容器：官方建议 A3 上每卡 16 GiB 时给 Docker `--shm-size=1024g`，给小了启动阶段会出问题。
- 确认生效：日志里有 `Recompute preemption offload enabled for request`、`Created recompute offload state for request`、`Prepared recompute offload H2D load for request` 这几条。

### 会报什么错

- **RecomputeScheduler 不在 D 上**：启动 `ValueError`，P 上只打 warning 就地关掉，见 [RecomputeScheduler 的「会报什么错」](recompute-scheduler.md#会报什么错)。
- **DCP 或 PCP 不是 1**：manager 构造时 `assert dcp_world_size == 1 and pcp_world_size == 1` 失败。
- **共用开关不是布尔值**：`ValueError: enable_offload_prefix_caching must be a boolean`。
- **主机不够：不报错**。`_create_preempt_state` 发现需要的块数大于空闲块数，打 warning「Skip recompute offload for request %s: CPU cache has %d free blocks, but %d new blocks are required.」并返回 `False` [C6]；调度器再打 info「Recompute preemption falls back without offload for request %s ...」，请求退回 P [C1]。已算位置为 0 时直接返回 `False`，不打日志。
- **搬回准备失败**：分好显存块以后建不出「主机块 → 新显存块」的对照，`update_state_after_alloc` 抛 `RuntimeError: Failed to prepare recompute H2D load after KV block allocation`。
- **main 上写旧名**：main 只注册 `PreemptOffloadConnector` / `PreemptOffloadConnectorV1` [C25]，照抄 `RecomputeCPUOffloadConnector` 找不到连接器 [!]。
- **只配连接器、没开 RecomputeScheduler**：不报错，也不生效，走普通重算 [C15]。
- **官方已知限制**：Qwen3.5 配异步调度尚未完全支持，用它时要关掉异步调度。

### 开销和什么时候别开

- 同步存：模型执行器在 `_update_states()` 之前调 `handle_preemptions()` [C11]，注释写明调度器可能在同一步复用这些块号，所以这次 D2H 必须在清零和前向之前阻塞做完 [C9]。
- 同步取：`start_load_kv()` 在前向前提交，`sync=True`；`wait_for_layer_load()` 再让前向流等 load 流。调度侧 `get_num_new_matched_tokens` 命中时返回 `(命中数, True)` [C5]，第二项 `True` 让调度器走异步加载那条状态：分好块后把请求置为 `WAITING_FOR_REMOTE_KVS`、本步新 token 数为 0；worker 在 `get_finished` 里报 `finished_recving`，下一步 `_update_waiting_for_remote_kv` 才把它放回。状态走的是异步那条路，拷贝本身是同步的。
- 拷贝本身 [C10]：`_submit_transfer` 先 `torch.npu.synchronize()`，再按块、按张量逐个 `copy_(..., non_blocking=True)`，源码 TODO 说还没换成 NPU 专用拷贝；`sync=True` 时 `event.synchronize()` 等完。官方限制写明这版拷贝只求正确、未为吞吐优化。
- 集齐：每个 worker 报 `{event_idx: 1}`，调度侧累加到 `parallel_config.world_size` 才置 `ready` [C7]；之前 `get_num_new_matched_tokens` 返回 `(None, False)`，调度器把它放进本步跳过的队列，下一步再问。
- 主机内存：启动时按块数一次开满锁页张量；main 不写预算时块数与显存池相同，等于把整个 KV 池在主机上再锁一份。
- 什么时候别开：不拆 P/D（开不了）；主机内存紧；被抢占的多是超长请求，预算装不下整条，白占主机内存；实测有效带宽低于持平带宽 [D]；D 对单步时延敏感，每次换出、换回都停一整步 [I]。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 | GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad | 意味着什么 |
|---|---|---|---|---|---|
| 目录与连接器名 | `kv_pool/recompute_cpu_offload/`，`RecomputeCPUOffloadConnector` | 同 v0.23 | 同 v0.23 | `kv_pool/kv_offload/preempt_offload/`，`PreemptOffloadConnector`，9eb752ab 改名 [C26] | 旧名抄到 main 上建不出连接器 [!] |
| 两个字节参数都不写 | 整实例 8 GiB，除以 `world_size` | 同 v0.23 | 同 v0.23 | 没有字节默认值，按 `offload_host_memory_ratio`（默认 1），主机块数 = 显存块数 | 同样「什么都不写」，main 锁掉的主机内存多得多 |
| 递推状态组（Mamba 类） | 和 attention 组一样按已算位置截取块表 | 同 v0.23 | 只存最后 `1 + num_spec_tokens` 块，不参与共用 [C20] | 同 v0.26 | 混合模型只有后两列专门处理 [I] |
| 摘掉没写进去的前缀缓存块 | 有：本步刚打上哈希、前向还没写的显存块，从前缀缓存里摘掉 [C19] | 同 v0.23 | 删了 | 删了 | 只在显存侧开着 prefix caching 时有影响 |
| 钩子抛异常 | 不兜 | 同 v0.23 | 同 v0.23 | try/except，warning 后退回 P [C23] | 前三列连接器出错会让这一步直接抛异常 |
| 调 `handle_preemptions` 的执行器 | `model_runner_v1` | 同 v0.23 | 同 v0.23 | v1、v2 两个执行器都调 [C24] | main 的 MRV2 上也能用，这正是改名那个 PR 的主题 |
| worker 与连接器代码 | 基准 | 与 v0.23 逐字相同 | 与 v0.23 逐字相同 | 改了名和预算入口，拷贝仍是先整卡同步、再逐块 `copy_` | 同步拷贝四个钉点都一样 |

让出哪一条、退回 P 怎样收尾的版本差异，见 [RecomputeScheduler 的「版本差异」](recompute-scheduler.md#版本差异)。

### 源码位置

| 看什么 | 在哪（GLM 快照 db701c1f，目录 `vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/`） |
|---|---|
| 岔路口：问连接器能不能存走 | `vllm_ascend/core/recompute_scheduler.py` L297–L345 |
| 连接器入口、预算参数 | `recompute_cpu_offload_connector.py` L40–L96 |
| 实例卡数、DCP/PCP 断言、集齐计数 | `manager.py` `__init__` L63–L118 |
| 主机块数 | `manager.py` `_derive_cpu_config` L133–L156 |
| 能接上多少、抢占钩子 | `manager.py` `get_num_new_matched_tokens`、`update_state_before_preempt` L179–L234 |
| 挑哪些块、全有或全无、共用 | `manager.py` `_create_preempt_state` L236–L368 |
| 集齐存好、登记共用块 | `manager.py` `update_connector_output`、`_process_preempt_store_event` L517–L553 |
| 锁页主机缓冲 | `worker.py` `register_kv_caches` L96–L116 |
| 存、取、等 | `worker.py` `handle_preemptions`、`start_load_kv`、`wait_for_layer_load` L134–L175；`_submit_transfer` L200–L284 |
| 执行器调用点 | `vllm_ascend/worker/model_runner_v1.py` L1984–L1989 |
| 排上那一步只搬不算、下一步放回 | `vllm_ascend/core/recompute_scheduler.py` L548–L672（`load_kv_async` → `WAITING_FOR_REMOTE_KVS`）、`_update_waiting_for_remote_kv` L138–L170；`worker.py` `get_finished` L286–L305 |
| MultiConnector 转问 | `vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py` L65–L77；注册替换在同目录 `__init__.py` L23–L26 |
| `world_size` 的定义 | `vllm/config/parallel.py` L776–L780（vllm@0fc695fc） |
| 显存块什么时候有哈希 | `vllm/v1/core/kv_cache_manager.py` L553–L562（vllm@0fc695fc） |
| 官方说明 | `docs/source/user_guide/feature_guide/recompute_cpu_offload.md`（参数 L40–L61，流程与限制 L226–L274，问答 L276–L307） |
| main 的新位置 | `kv_pool/kv_offload/preempt_offload/`：预算入口 `preempt_offload_connector.py` L45–L63，递推状态组 `manager.py` L282–L295 |
