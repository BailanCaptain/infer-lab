---
id: recompute-cpu-offload
title: Recompute CPU Offload：D 节点被抢占的请求，KV 先存主机、排回来再搬回
type: feature
summary: >-
  vllm-ascend 给 PD 分离 D 节点配的连接器：RecomputeScheduler 让出一条请求前先问它，主机块够就把这条的全部 KV
  块同步拷到主机，重新排上时在前向前搬回，完成通知后再调度；旧版保存失败则交代理退回 P。讲清两条恢复路径的取舍（示意数）、和 CPU 备份、KV Pool
  的区别；新版失败路径需按并行设置区分。GLM 双机主线不拆 P/D，没有启用。
aliases:
  - Recompute CPU Offload
  - Preempt Offload
  - RecomputeCPUOffloadConnector
  - PreemptOffloadConnector
  - 抢占卸载
  - 抢占换出
  - 换出换回
  - enable_offload_prefix_caching
  - cpu_bytes_to_use_per_rank
  - offload_host_memory_ratio
chapters:
  - '11'
  - '12'
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L297-L345'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L40-L96
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L63-L118
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L133-L156
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L179-L234
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L236-L368
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L517-L553
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L96-L116
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L175
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L200-L284
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1984-L1989'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L65-L77
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L23-L26'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L40-L61
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L226-L274
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L276-L307
  - 'vllm@0fc695fc:vllm/config/parallel.py#L776-L780'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L553-L562'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L262-L292
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L266-L280
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L45-L63
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L282-L295
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L105-L130'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/model_runner.py#L320-L326'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L118-L123
  - 'https://github.com/vllm-project/vllm-ascend/pull/16510'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L548-L672'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L138-L170'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L286-L305
  - >-
    raw:sha256-26389ffc630503f01c6fc277dd6907472e173d67a567586c2d95ac9da48d27d5.md#L1-L1079
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L40-L79
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L125-L159'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/preempt_offload_connector.md#L40-L79
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L149-L177'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L33-L63'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L384-L472'
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L554-L628'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L44-L113'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L153-L185'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L185-L322'
  - 'https://github.com/vllm-project/vllm-ascend/issues/10820'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L295-L345'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L442-L540'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L107-L238'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L252-L292'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L325-L451'
  - 'vllm-ascend@7d825229:vllm_ascend/core/kv_cache_interface.py#L49-L54'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L41-L115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L70-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L180-L205'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L293-L345'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L95-L120'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L315-L335'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L522-L538'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: recompute-scheduler
    kind: builds-on
    note: 调度器选择保存恢复、退回 P 或新版特定条件下中止
  - to: block-table
    kind: builds-on
    note: 块映射决定需要保存和回填的物理位置
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 同样把 KV 放到主机，但那边算满一段就备份、给开头相同的请求用；这边只在抢占那一刻替这一条存
  - to: kv-pool
    kind: alternative-to
    note: 池按内容指纹存前缀段，谁的开头对上谁能取；换出只存被抢占的这一条，只有它恢复时取回
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-1e794e990136905112a83049f1007774f9cee13b69f4a33fb7f515c0974f52db.md
  - >-
    raw/sha256-26389ffc630503f01c6fc277dd6907472e173d67a567586c2d95ac9da48d27d5.md
  - >-
    raw/sha256-a9b25563333733dc7bd3f6f184c3c76d0afb167dab7d4928730d72748d732a82.md
---

## 被抢占的请求，KV 能不能先存到主机、回来再搬回？

**Recompute CPU Offload（`v0.30.0` 与 `main` 中更名为 `PreemptOffloadConnector`）是 vllm-ascend 给 PD 分离 D 节点配的抢占卸载连接器。D 上块不够、调度器要从正在生成的请求里让出一条时，先问它：能不能把这条请求已经算好的 KV 块存到主机内存？能，就安排保存，在旧内容被覆盖前同步拷走，排回来时再搬回显存、接着算；不能保存时，由调度器按版本和细粒度 TP 设置决定退回 P 重算或中止。**

它用主机内存和搬运时间换取少做历史重算：启动时预留锁页内存，存、取各搬一次，而且两趟拷贝都是同步的，搬完前该 worker 这一步的其他请求也要等。请求越长、状态越大，这两次停顿和主机占用就越需要计入预算。

先把几个词对上：

- **抢占**：KV 块不够时，调度器把一条正在跑的请求暂停，收回它的全部块让给别人，这条请求排回等待队列，见 [KV 块分配](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。
- **PD 分离**：P 节点做 prefill，D 节点做 decode，见 [PD 分离](pd-disaggregation.md)。本页只在 D 节点上起作用。
- **连接器**（KV connector）：vLLM 里把 KV 搬进搬出的插件。
- **[RecomputeScheduler](recompute-scheduler.md)**：D 节点上的调度器。它让出请求前先问连接器能不能存走；普通路径不能保存时发退回标记由代理交给 P，`v0.30.0` 与 `main` 启用细粒度 TP 分片时则直接中止。
- **[KV cache CPU offload](kv-cache-cpu-offload.md)**：另一种把 KV 放到主机内存的做法，算满一段就备份，给开头相同的请求用。本页不一样：只在抢占那一刻、只替被抢占的这一条存。

下面先用固定旧部署的示意数直观对比「换出换回」和「退回重算」两条恢复路径（一块装 4 个位置，请求 A 已算 9 个位置、占 3 块，第 3 块只用了 1 格；重算路线假设没有可复用缓存）：

```wiki-diagram
file: recompute-cpu-offload
```

- **上面：换出、换回（本页）。** 调度器先登记 A 的 3 块要换出，并把块号还给池子；块号可以立即分给 C，但 worker 必须先把 A 的旧内容拷到主机，才允许 C 的计算覆盖这些块。等池子空出来、A 排上时，调度器给它分 3 个空块（块号不必和原来相同），这一步先把主机那 3 块搬回来，下一步 A 才从第 10 个位置接着算。搬回以后，主机那份就释放了。
- **下面：重算。** 3 块直接还给池子，A 手里只剩 token 编号。开了 `RecomputeScheduler` 的 D 不在本机算，而是结束 A、交给 P 把这 9 个位置整段重算，再交给一台 D 接着生成，图里画的就是这条；不拆 P/D 的部署没有这一步，A 排回来后在本机从头重算。

在普通路径里，`RecomputeScheduler` 每次让出请求都先问本连接器；满足保存前提且主机空闲块够用，走上面；不够、没配本连接器，或者这条请求还一个位置都没算，走下面。在 `v0.30.0` 与 `main` 下，如果细粒度 TP（`oproj` 或 `mlp`）实际分片大于 1，保存失败会直接中止请求，细节见[版本差异](#版本差异)。

新建一份保存记录还要求设备块池已经设置，并且这条请求至少有一个实际有效的设备块；不满足这些前提，即使主机容量足够，也会拒绝保存。答应保存和完成新的字节复制是两回事；需要搬运时按下面的流程等齐报告，能够完全共用已保存主机块时则可以直接成为可恢复状态。

## 为什么需要它，又要付什么？

**D 通常按 decode 配置较小的每步位置预算，被抢占的请求若缺少可复用缓存，要么退回 P 重算并重新交接，要么在 D 上分许多步处理；可它的 KV 其实已经算好，只是显存暂时放不下。换出换回把这份 KV 交给主机内存保管，代价是搬两趟字节：主机内存要预先划出来，而且这一版的两趟搬运都是同步的，搬的时候 D 上这一步的其他请求也要等。**

D 为什么不适合重算、退回 P 又要付什么，[RecomputeScheduler 的这一节](recompute-scheduler.md#为什么-d-节点不自己重算退回-p-又要付什么)算过。每步预算较小会让长 prefill 挤占许多步，是否 OOM 还取决于模型、执行形状和内存配置；退回 P 则会增加排队与交接，并在无可用前缀时重算整段输入。

主机内存是 CPU 一侧的内存，通常容量较大，和 NPU 之间还要传输，两者分开记账，见[主机内存与显存](device-memory.md)。被抢占的请求交出去的是显存块，它算好的 KV 本身没有错；在完整状态能正确保存和恢复的前提下，就能省去重做整段历史。恢复边界若正好达到请求总长，仍可能重算末位置以采样，下面会具体说明。

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

把这七步接到[一条请求的七站](one-request.md)：第 2 站只作调度决定，第 3 站整理输入前保存旧内容，第 6 站处理执行结果时收集完成报告；恢复又要经过后续调度与搬运。下图以 TP=2 为例，用 Scheduler、两张卡和 Host Pool 四条泳道画清「D2H 完 C 才覆写、双卡集齐 A 才恢复」的同步屏障，并在下半幅按比例展开 `16,384 - 1 = 16,383` 主机块为何装不下第 2 条 8,192 块请求：

```wiki-diagram
file: recompute-cpu-offload-fig-preempt-swap
```

图中的等待发生在不同地方：worker 的同步等待保护旧字节，调度侧等报告才知道哪条请求可恢复，恢复就绪后还要等到获得调度预算。若已经完全共用现成的主机块，保存阶段可以直接 ready，不必再复制一份；它仍须满足恢复分配和完成通知的条件。

和 [KV cache CPU offload](kv-cache-cpu-offload.md#搬运在后台进行计算什么时候要等) 比，两边都要把请求挂起：排上那一步只搬不算，搬完以后的下一步才接着算。区别在搬的方式：那边在后台传输流上搬，搬多久就挂多久，同一步的其他请求照常算；这里是同步拷贝，这一步前向之前就搬完，搬的时候整步都停着。

这里的“下一步”表示完成通知处理后才具备继续调度的条件；实际还有预算和排队，不能承诺下一轮一定生成 token。“释放主机块”也是把请求占用交回预分配块池，锁页张量仍在；若块还有其他请求引用，要等那些引用也释放。

与 P/D 连接器组合时，保存过的请求会优先查询这份恢复记录，与两个子连接器在配置中的先后无关。尚未存好就继续等，命中后由本连接器恢复；这样才能带回普通前缀查找无法找到的未满尾块。它没有这条记录或无法贡献新位置时，才回到其他连接器的普通查询规则。

## 存哪些块，主机要留多少？

**存的单位就是显存池里的块：一条请求已算位置覆盖到的每一块都整块拷走，最后一块没写满也整块拷。主机那边按「每卡预算 ÷ 每块字节」切成同样大小的块；一条请求要的块数超过主机剩下的空闲块，就整条不存。**

要存几块：已算位置数 ÷ 每块位置数，向上取整。A 是 ceil(9 ÷ 4) = 3 块。第 3 块只有 1 格有效，也整块拷过去；另外 3 格照样是空的，不会因此变成「已算」，恢复时只把前 9 个位置当作已算。

一块的字节，要把这个块号在所有缓存张量里占的空间加起来。沿用 [KV cache 页的示意模型](kv-cache.md#存一份要多少从一个位置一层往上乘)，每个位置 32 层共 128 KiB，一块 4 个位置就是 512 KiB，A 的 3 块是 1.5 MiB：存一趟 1.5 MiB，搬回再一趟 1.5 MiB。

主机预算可以直接写每张卡的预算（推荐），也可以写一个模型并行实例的预算、按其中的卡数平分；都不写时，v0.23、v0.26 和 GLM 快照按该实例 8 GiB 平分，`v0.30.0` / `main` 则按主机与显存块数比例配置。这里的卡数是 TP × PP × PCP，也就是[张量并行](tensor-parallel.md)、[流水线并行](pipeline-parallel.md)和 prefill 阶段的 [context parallel](context-parallel.md) 三者的份数相乘，不含 DP。

**每卡预算还要乘上本机实际分配缓存的 worker 数，才能得到本机总占用。** 例如 PP、PCP 都为1，两个 DP 组各有 TP8，给每组写总字节16 GiB，每个 worker 分到2 GiB；若16个 worker 都在同一主机，合计约32 GiB，再考虑块粒度取整和其他进程内存。分到两台主机就按各自本地 worker 数分别求和。本连接器每个 worker 都建自己的锁页张量；它的“前缀共享”是各 rank 内的请求共用块，与[Engram 的本地 DP 共享](deepseek-v4-1-flash.md#engram-为什么把另一笔内存账放到主机上)不同：这里不会让多个 DP 进程共用同一张主机表。公式中有 PCP 不代表支持任意 PCP：`v0.30.0` 及以前版本在初始化时断言 `PCP=1` 且 `DCP=1`，`main` 才解除 `DCP` 限制并按 `resolve_dcp_kv_block_size` 核算本地跨度。

算预算要注意口径：每张卡只存这张卡自己那份 KV。上面每个位置 128 KiB，是一张卡跑整个模型时的量；8 张卡按 KV 头切成 TP8 时，每卡每个位置只剩 16 KiB，不写预算时每卡也只分到 1 GiB，两边一起缩小。也有 TP 下每卡各存一整份的缓存，比如 [MLA](mla.md)，那时每卡字节不缩小。下面按单卡实例、旧版不写预算（默认 8 GiB），并假设请求之间没有命中可共享的主机块，算一笔（第二条需要 8,192 块，但只剩 8,191 块，整条退回重算；TP8 时每卡 1 GiB、每块 64 KiB，块数和位置数都一样）：

$$B_{\text{usable}} = \left\lfloor \frac{8\text{ GiB}}{4 \times 128\text{ KiB}} \right\rfloor - 1 = 16{,}384 - 1 = 16{,}383\text{ 块}$$

| 旧版单卡实例不写预算的主机容量核算（示意数，每块 `4` 位置） | 算式 | 结果 |
| --- | --- | --- |
| 每卡主机预算 | $8\text{ GiB} \div 1$ | **8 GiB** |
| 每块字节数（`4` 位置 × `128 KiB`） | $4 \times 128\text{ KiB}$ | **512 KiB/块** |
| 主机总块数 | $8\text{ GiB} \div 512\text{ KiB}$ | **16,384 块** |
| 普通请求可借块数（扣 `1` 个 `null_block`） | $16{,}384 - 1$ | **16,383 块**（可存 `65,532` 位置） |
| 单条 `32,768` 位置请求所需块数 | $32{,}768 \div 4$ | **8,192 块** |
| 同时可存的完整条数 | $\lfloor 16{,}383 \div 8{,}192 \rfloor$ | **1 条**（余 `8,191` 块，不够第 2 条） |

主机块池在启动时就按这个块数整块开好。`v0.30.0` 与 `main` 不写字节预算且保留默认比例 1 时，主机块数等于显存块数，等于把整个显存 KV 池在主机上原样再锁一份。

还有几种块要单独处理：

- **混合模型的缓存组。** 每个缓存组有各自的块表（组是什么见 [KV 缓存规格](kv-cache-spec.md)），连接器逐组登记需要恢复的块，再合成搬运计划；不能把各组都理解成占用同一个块号。[Linear attention](linear-attention.md) 这类递推状态不随位置增长，不能按「位置 ÷ 每块位置数」去数。`v0.26`、`v0.30.0` 和 `main` 对这类组只存最后 `1 + 草稿数` 块（当前状态一块，每个[投机解码](speculative-decoding.md)草稿位置各一块）。`v0.23` 和 GLM 快照没有这条特殊处理，仍按普通 attention 方式截取块表，存下的是否为完整当前状态仍待核。
- **滑动窗口。** 窗口外的位置在块表里是空块号，连接器保留它们的位置、只拷有内容的块，块表前后仍然对齐。
- **投机解码。** 排回来时调度器还会为草稿位置多留几块；搬回按这一步实际分到的块截断。

`v0.30.0` 与 `main` 又单独处理了两类状态。**固定大小的环形缓存**循环使用有限槽位，每个请求在相应组里持有一个私有块，不按已经走过多少 token 增加保存块数，也不参加前缀哈希共享；恢复时仍回到该组块表的第 0 格。它与上面的「窗口外位置用空块号占位」的分页滑窗不是同一种块表。

**带因果卷积历史的递推状态**还要对齐已经接受的草稿边界。这里的卷积历史指下一次计算仍要读取的最近几行输入；它和较大的递推状态并非总是从同一个保存槽恢复。`v0.30.0` / `main` 先选接受边界对应的递推状态块做普通搬回，再从运行状态块选取正确的历史窗口，校正设备端的卷积状态。跨过缓存边界时，只应用块内剩余偏移，避免重复移动。

例如卷积状态总宽度为 5 行，其中 2 行是草稿工作区，本次校正需要 3 行因果历史；行从 0 编号，若源偏移为 1，就把主机第 1–3 行放到设备第 0–2 行。这是布局示意。其余工作区不参与这次校正；只有通过接受检验的草稿才能计入已接受历史。具体后端必须能辨认哪些张量是卷积、哪些是递推状态，不能只看它们都属于 Mamba 缓存组。

## 搬运与重算之间的成本

**换出换回要把这条请求的字节搬两趟，存一趟、取一趟，每趟都停住 D 上的一步；重算不占主机内存、不搬这些字节，但要把这些位置再算一遍，退回 P 时还要再交接一次、两边重新排队。请求越长，两边都越贵：换出省下的计算越多，D 被停住的时间也越长，主机也越容易装不下整条。**

两条路的账记在不同地方：

- **换出换回**：D 付两次停顿；主机付内存。它省去整段历史重算，搬回并收到完成报告后可以继续调度；是否更快仍要比较下面的搬运与计算时间。
- **退回 P 重算**：没有可复用缓存时，P 付整段 prefill，网络付再一次交接；这条请求自己要在 P、D 各排一次队。代理识别退回标记且重投成功时，客户端同一条流暂停后可以继续；直连 D、重投失败或直接中止时，不能保证这种续流。具体接收时能否与其他计算重叠，还取决于 P/D 连接器。

先比这条请求自己多久能接上。两边都换成时间：换出换回 = $2 \times \text{字节} \div \text{有效带宽}$，重算 = $\text{位置数} \div \text{每秒 prefill 位置数}$。沿用 [KV cache CPU offload 页的示意数](kv-cache-cpu-offload.md#搬回和重算各花多少)：每个位置 `128 KiB`，有效带宽 `16 GiB/s`，每秒 prefill `16,384` 个位置。下表字节按 $\text{位置数} \times 128\text{ KiB}$ 计，重算按固定速度估（长开头实际更慢），均未计排队、交接与同步的固定开销：

$$t_{\text{swap}} = \frac{2 \times N \times 128\text{ KiB}}{16\text{ GiB/s}}, \qquad t_{\text{recompute}} = \frac{N}{16{,}384\text{ token/s}}$$

| 序列长度 $N$（示意数） | 换出 + 换回（两趟拷贝） | 重算时间（固定速度估算） |
| --- | --- | --- |
| **256 个位置**（32 MiB） | $2 \times 32\text{ MiB} \div 16\text{ GiB/s} \approx$ **3.9 ms** | $256 \div 16{,}384 \approx$ **15.6 ms** |
| **4,096 个位置**（512 MiB） | $2 \times 512\text{ MiB} \div 16\text{ GiB/s} =$ **62.5 ms** | $4{,}096 \div 16{,}384 =$ **250 ms** |
| **32,768 个位置**（4 GiB） | $2 \times 4\text{ GiB} \div 16\text{ GiB/s} =$ **500 ms** | $32{,}768 \div 16{,}384 =$ **2,000 ms** |

```wiki-diagram
file: recompute-cpu-offload-fig-cost-comparison
```

线性估算下，两边的比例不随长度变，始终是 1 比 4；长短的差别来自不随长度缩短的固定开销、D 被停住的时长和主机容量。按长度读这组数：

- **短，几百个位置。** 两边都只要几毫秒到十几毫秒。可退回 P 那条路另有不随长度缩短的固定开销：[代理重投](recompute-scheduler.md#一次退回-p怎样走完)、P 和 D 各排一次队、再交接一次。短请求换出恢复得更快，D 停的那几毫秒也不显眼。
- **中，几千个位置。** 换出约是重算的四分之一。但这 62.5 ms 是分两次停在 D 上的：抢占那一步停约 31 ms，排回来那一步再停约 31 ms。
- **长，几万个位置。** 换出仍然省计算，0.5 s 对 2 s 以上；可 D 每次要停约 0.25 s。主机也吃紧：一条就要 8,192 块，按[上一节](#存哪些块主机要留多少)单卡不写预算时的 16,384 块，扣除 null block 后只存得下一条完整请求，第二条同时被抢占的就只能退回 P。

还有三处要补：

- **有效带宽要实测。** 存、取两趟都要搬，持平点是那一页单趟算法的两倍：2 × 128 KiB × 16,384 个/s = 4 GiB/s。有效带宽高于它，换出换回比重算快；低于它，反而更慢。这一版逐块、逐张量发拷贝，有效带宽要按实测算，不能拿链路的标称值代入。
- **同样长度，字节也不同。** 每个位置的字节随模型结构变：层数多少、是不是混合模型、有没有固定大小的递推状态；TP 下每张卡只存自己那一份。
- **实现本身不做这笔时延比较。** 满足保存前提且主机存得下就选择保存，失败后按版本退回 P 或中止；这笔账是用来决定开不开、预算给多少的。

## 和 KV cache CPU offload、KV Pool 有什么不同？

**三者都把 KV 放到显存之外，区别在存什么、按多大粒度、什么条件下取回：换出存的是被抢占的这一条请求当时的全部块，只有它排回来、而且每张卡都报告存好了才取回；CPU 备份和 KV Pool 存的是按内容认出来的前缀段，谁的开头对上谁就能取。**

| | 换出换回（本页） | [KV cache CPU offload](kv-cache-cpu-offload.md) | [KV Pool](kv-pool.md) |
|---|---|---|---|
| 存什么 | 被抢占那条请求已算位置覆盖的全部块，所有缓存组 | 算满的前缀段，默认只存提示词部分 | 写满的前缀段，按内容指纹登记 |
| 按多大粒度 | 块；一条请求全有或全无 | 段，相邻几页拼成；不满一段的尾巴不存 | 段 |
| 什么时候存 | 抢占那一刻，只存这一条 | 算满一段就存，和显存满不满无关 | 每写满一段就存 |
| 存在哪、谁能用 | 本机主机内存；只有这条请求 | 本机主机内存；本实例开头相同的请求 | 共享存储；接同一个池的所有实例 |
| 什么时候取回 | 这条请求排回来，且每张卡都报告存好 | 进场时显存没命中、主机能接上 | 开头指纹对上、本地又没有 |
| 搬运 | 同步，存、取都停住执行；请求挂起等待完成报告 | 后台传输流，请求挂起到搬完 | 见 [KV Pool](kv-pool.md#查到以后分配搬运使用写回) |

最容易混的是恢复条件。被抢占的请求如果只靠 CPU 备份或 KV Pool，排回来时已算位置清零，像新请求一样按开头去查；这两条路默认只管提示词里的整段，它 decode 时生成出来的那部分查不到，照样要重算。换出存的是抢占那一刻的全部块，生成出来的部分也在里面，恢复时也不需要「开头相同」这个条件。KV Pool 那边的对照见[它的这一节](kv-pool.md#和抢占换出cpu-备份有什么不同)。

换出也有一种按内容共用的情形：两条被抢占的请求开头相同，主机里可以只存一份相同的块。比如 A、B 都算了 9 个位置、前 8 个一样，各占 3 块；前 2 块写满、内容相同，可以共用，第 3 块只写了 1 格，各存各的。不共用要 6 块，共用只要 4 块。三个条件都要满足：

- 打开共用开关。它默认关，官方标为实验性。
- 显存那边开着 [prefix caching](prefix-caching.md)。共用靠块的内容哈希来认，显存块只有 prefix caching 开着时才会算哈希。
- 块已经写满。没写满的块没有哈希，照样私有；v0.26 和 main 上，递推状态那类块也不参与共用。

同一步里先后被抢占的两条，后一条可以挂到前一条正在拷的那份上，不再重复拷；它的「可恢复」也要等那笔拷贝报完。这个例子只说明满足条件的块怎么计数，不保证任意两条请求的全部状态都能按开头共用。

## 复杂异构实战对照：GLM 双机为何未启用与预算对照

### 放到 GLM 双机：主线不启用它

前面用通用单组 KV 模型（4 位置/块）推完了换出换回的时序与容量账。下面切换标尺，对照**例外 B 历史绑定算例**[GLM 双机主线](glm-5-3-flash-two-node.md#部署前提)：两台机器合起来是一套 P、D 不分的服务，没配 KV 传输，`RecomputeScheduler` 开关默认关闭；本连接器只能跟着 `RecomputeScheduler` 使用，因此主线上不起作用，抢占仍走上游路线（还掉全部块，排回本机从头重算）。

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。RecomputeScheduler 为什么在主线上开不了、硬开会怎样，见[它的 GLM 一节](recompute-scheduler.md#放到-glm-双机主线不启用它)。

主线的抢占有多贵，整批账在[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。DP 组 0 跑满 `32` 条、每条走到约 `67,000` 个位置时池子用光，被抢占的那条每卡还回 `120–121` 个块号（约 `956–964 MiB`），排回来要在本机重算约 `9` 步。由于 prefix caching 关着，没有可复用前缀，`34` 层 KDA 的递推状态也随块一起丢掉；换出想省掉的正是这类重算。

如果把两台机器拆成一 P 一 D 并在 D 上开它，可先拿旧版默认预算（整实例 `8 GiB`）对照这条请求的量级。假设请求间没有可共享主机块，这笔预算只够存一条，同时被抢占的第二条只能退回 P。块号字节见部署页、块数见多条请求页；这不是该特性在 GLM 上的实测效果（1P1D 下 D 的块池大小与抢占触发点尚未推算）：

$$B_{\text{usable,GLM}} = \left\lfloor \frac{1{,}024\text{ MiB}}{7.969\text{ MiB}} \right\rfloor - 1 = 128 - 1 = 127\text{ 个块号}$$

| 在 D 上开旧版默认预算的对照项（TP8 一实例） | 算式 | 结果 |
| --- | --- | --- |
| 每卡主机预算 | $8\text{ GiB} \div 8$ | **1 GiB** |
| 单块字节（每卡） | $8{,}355{,}840\text{ B}$ | **约 7.969 MiB/块** |
| 主机总块数 | $\lfloor 1{,}024 \div 7.969 \rfloor$ | **128 个块号** |
| 普通请求可借块数（扣 `1` 个 `null_block`） | $128 - 1$ | **127 个块号** |
| 主线被抢占的那条请求（`120–121` 块） | $120\text{–}121 \le 127$ | **仅够存 1 条** |

一个块号的字节见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。真要在 GLM 上用，还有几处没有核过：

- **停多久。** 每趟每卡约 956–964 MiB，存、取各一趟；主机与 NPU 之间的有效带宽没有实测，D 每次要停多久，待核。
- **混合状态能不能存对。** 稀疏 MLA 的历史、索引器的尾状态、34 层 KDA 的递推状态，必须对应同一个位置才能接着算。GLM 快照和 v0.23 是同一份连接器代码，没有给递推状态组特殊处理，KDA 那 3 组存下的是不是完整的当前状态，待核。`v0.26`、`v0.30.0` 和 `main` 对这类组只存最后 `1 + 草稿数` 块；GLM 用 MTP 出 `3` 个草稿，正好是每组 `4` 块的布局（见[部署页](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)）。这组对照版本里仅 GLM 快照、`v0.30.0` 和 `main` 含模型代码，且模型存在本身不替代混合状态恢复的端到端验证。
- **共用走不到。** 主线 prefix caching 关着，显存块没有哈希，被抢占的请求之间不会共用主机块。
- **context parallel 这条满足。** `v0.30.0` 及以前版本要求 PCP、DCP 都是 1（`main` 已解除断言并改按 `resolve_dcp_kv_block_size` 核算跨度），主线本身没开 context parallel。

## 常见误解

- **「它就是 KV cache CPU offload」**——不是一回事，官方问答也专门澄清过。那边算满一段就备份、按内容给开头相同的请求用；这边只在抢占那一刻、只替被抢占的这一条存，见[上面的对照](#和-kv-cache-cpu-offloadkv-pool-有什么不同)。两边搬运的代码也各是各的。
- **「开了它，被抢占的请求就不会再重算」**——不一定。主机空闲块不足、尚无已算位置等情况都会拒绝保存。普通路径会退回 P 重算（`v0.30.0` 与 `main` 捕获保存钩子异常后也可退回），但开启细粒度 TP（`oproj`/`mlp` > 1）时失败会直接中止，不保证退回；外部流续传也依赖代理正确识别与重投。
- **「只配这个连接器就行」**——还要同时开 RecomputeScheduler，而它只能在 PD 分离的 D 节点上开。不拆 P/D 的部署只配连接器，没人来问它，照常在本机重算；开了 context parallel 则启动时断言失败。
- **「存到主机是后台做的，不影响别的请求」**——这一版存、取两趟都同步，搬的时候整步停住，同一步的其他请求都跟着等。
- **「整个实例的预算按 DP 数平分」**——官方文档这么写，代码按 TP × PP × PCP 平分，不含 DP。DP2、TP8 的 D 写 16 GiB，每卡是 2 GiB，不是 8 GiB。直接写每卡预算最不容易错。
- **「开了它，显存能多装请求」**——显存池的块数不变，它省的是重算，不是显存。

## 对照源码

### 怎么开

下面是 v0.23/GLM 快照的选项片段，省略号须用实际 P/D 地址与并行设置替换，不能原样作为 JSON 执行。完整配置对照[旧版指南](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/docs/source/user_guide/feature_guide/recompute_cpu_offload.md)或[rc2 指南](https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/preempt_offload_connector.md)，并保留下文指出的预算和失败分支区别。

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
# rc2 / main：连接器名改成 PreemptOffloadConnector，调度开关写法见下方链接
```

- 两样都要：`recompute_scheduler_enable`（只在 D 上开，各版本写法见 [RecomputeScheduler 的「怎么开」](recompute-scheduler.md#怎么开)）加本连接器。D 上既要从 P 收 KV、又要换出，所以用 `MultiConnector` 把两个连接器串起来；昇腾把注册表里的 `MultiConnector` 换成 `AscendMultiConnector`（登记位置见来源 13），它把 `update_state_before_preempt` 逐个转给子连接器，有一个答「能」就算能 [C12]。
- 旧版预算 [C2]：`cpu_bytes_to_use_per_rank` 优先，和按实例平分的值对不上时打 warning、仍用它；`cpu_bytes_to_use` 默认 `8 * 1024**3`，除以 `parallel_config.world_size`，后者 = PP × TP × PCP，不含 DP [C17]。官方文档说按 Decode 的 DP 数平分，与代码不一致 [S14][!]。`v0.30.0` / `main` 另有 `offload_host_memory_ratio`（默认 1），两个字节参数都不写时按它定块数 [C21]；新版优先级与校验见来源38。
- 共用开关 `enable_offload_prefix_caching`：连接器读配置时默认 `False`，不是布尔值就 `ValueError` [C2]；manager 构造参数的默认值写的是 `True`，但连接器总是把配置值显式传进去 [C3]，所以实际默认关。官方标为实验性。
- 主机块数 [C4]：`max(1, num_gpu_blocks * cpu_capacity_bytes // gpu_total_bytes)`，`gpu_total_bytes` 是所有带 `shared_by` 的显存 KV 张量之和，等价于「预算 ÷ 每块字节」；worker 端按同一块数开 `pin_memory=True` 的 CPU 张量 [C8]。
- 容器：官方建议 A3 上每卡 16 GiB 时给 Docker `--shm-size=1024g`，给小了启动阶段会出问题。
- 验证入口：旧版日志中的 `Recompute preemption offload enabled for request` 表示选中了保存路径，`Created recompute offload state for request` 表示建好了记录，`Prepared recompute offload H2D load for request` 只表示搬回映射已准备；rc2/main 后两条名称改为 preempt offload。它们不能单独证明恢复完成。
- 继续按同一 request ID 核保存事件是否集齐、搬回的 `finished_recving` 是否到达、请求是否退出等待并继续生成；再比较同一模型/输入/采样配置的质量和单步停顿。测试环境可降低设备缓存预算以制造抢占，但应分别覆盖有足够主机块、不足整条、取消、未满尾块、滑窗及投机场景。官方 RFC 的 DeepSeek-V4 自测与拟议的异步改进不等于本站对 GLM 或所有混合状态完成验证。

### 会报什么错

- **RecomputeScheduler 不在 D 上**：启动 `ValueError`，P 上只打 warning 就地关掉，见 [RecomputeScheduler 的「会报什么错」](recompute-scheduler.md#会报什么错)。
- **DCP 或 PCP 不是 1**：manager 构造时 `assert dcp_world_size == 1 and pcp_world_size == 1` 失败。
- **共用开关不是布尔值**：`ValueError: enable_offload_prefix_caching must be a boolean`。
- **rc2/main 的容量参数无效**：实际每 rank 字节须为正；比例须为正且有限。即使设置了优先级更高的字节参数，比例仍先检查，不能用0、负数或无穷值当作“关闭比例”。比例或字节只够分出一个 null block 时，也没有可供普通请求使用的块。
- **旧版主机块不够：连接器返回失败**。`_create_preempt_state` 发现需要的块数大于空闲块数，打 warning「Skip recompute offload for request %s: CPU cache has %d free blocks, but %d new blocks are required.」并返回 `False` [C6]；旧调度器再打 info「Recompute preemption falls back without offload for request %s ...」，发退回 P 的标记 [C1]。已算位置为 0 时直接返回 `False`，不打日志。rc2 的细粒度 TP 失败会中止，不能照这条旧流程判断结果。
- **搬回准备失败**：分好显存块以后建不出「主机块 → 新显存块」的对照，`update_state_after_alloc` 抛 `RuntimeError: Failed to prepare recompute H2D load after KV block allocation`。
- **rc2的状态布局不符合约束**：环形组不是单个有效块、Mamba恢复的源或目标块无效，会在准备映射时抛错；卷积状态须符合规格中的二维形状且每块一行物理缓存。缺少已注册的卷积张量、偏移越界或可恢复历史长度非正，也会抛错，不能仅把主机预算加大来处理。
- **main 上写旧名**：该注册入口的配置名是 `PreemptOffloadConnector`，对应实现类 `PreemptOffloadConnectorV1` [C25]；启动参数使用配置名，不能把旧的 `RecomputeCPUOffloadConnector` 当成这一入口 [!]。
- **只配连接器、没开 RecomputeScheduler**：不报错，也不生效，走普通重算 [S15]。
- **官方已知限制**：Qwen3.5 配异步调度尚未完全支持，用它时要关掉异步调度。

### 开销和什么时候别开

- 同步存：模型执行器在 `_update_states()` 之前调 `handle_preemptions()` [C11]，注释写明调度器可能在同一步复用这些块号，所以这次 D2H 必须在清零和前向之前阻塞做完 [C9]。
- 同步取：`start_load_kv()` 在前向前提交，`sync=True`；`wait_for_layer_load()` 再让前向流等 load 流。调度侧 `get_num_new_matched_tokens` 命中时返回 `(命中数, True)` [C5]，第二项 `True` 让调度器走异步加载那条状态：分好块后把请求置为 `WAITING_FOR_REMOTE_KVS`、本步新 token 数为 0；worker 在 `get_finished` 里报 `finished_recving`，下一步 `_update_waiting_for_remote_kv` 才把它放回。状态走的是异步那条路，拷贝本身是同步的。
- 拷贝本身 [C10]：`_submit_transfer` 先 `torch.npu.synchronize()`，再按块、按张量逐个 `copy_(..., non_blocking=True)`，源码 TODO 说还没换成 NPU 专用拷贝；`sync=True` 时 `event.synchronize()` 等完。官方限制写明这版拷贝只求正确、未为吞吐优化。
- 集齐：每个 worker 报 `{event_idx: 1}`，调度侧累加到 `parallel_config.world_size` 才置 `ready` [C7]；之前 `get_num_new_matched_tokens` 返回 `(None, False)`，调度器把它放进本步跳过的队列，下一步再问。
- 主机内存：启动时按块数一次开满锁页张量；main 不写预算时块数与显存池相同，等于把整个 KV 池在主机上再锁一份。
- 什么时候别开：不拆 P/D（开不了）；主机内存紧；被抢占的多是超长请求，预算装不下整条，白占主机内存；实测有效带宽低于持平带宽 [D]；D 对单步时延敏感，每次换出、换回都停一整步 [I]。

### 版本差异

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均使用 `PreemptOffloadConnector`（实现类 `PreemptOffloadConnectorV1`），预算优先级为每 rank 字节、实例总字节、主机/显存块数比例。** 两个字节选项都未设置时，`offload_host_memory_ratio` 默认 `1`；CPU 前缀块共享默认关闭。它仍面向 PD 分离的 D 侧，并须启用 `RecomputeScheduler`，不是通用 CPU prefix offload 的同义词。

失败回退还受细粒度 TP 约束：如果 `oproj` 或 `mlp` 实际分片大小大于 1，卸载保存失败后调度器会终止请求，不能再按旧路径假定总会回 P 重算；没有这类分片时保留回 P 的分支。在混合状态恢复上，`v0.30.0` 与 `main` 均保留 Mamba 尾部 `1 + 草稿数` 块的保存方式，恢复时另选接受边界对应的状态块、处理环形私有块和卷积历史偏移，并按保存事件编号去重（实际 D2H/H2D 仍同步）。**`main (8d6180e2)` 进一步解除 `manager.py` 的 `dcp_world_size == 1 and pcp_world_size == 1` 硬断言**，在保存与恢复路径按 `resolve_dcp_kv_block_size` 核算本地 KV 块跨度，并将本地 `cpu_coordinator` 的 `pcp_world_size` 固定为 1（PCP 扩展 worker 数量而非单 worker 块跨度）。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 目录与连接器名 | `kv_pool/recompute_cpu_offload/`，`RecomputeCPUOffloadConnector` | 同 v0.23.0 | `kv_pool/kv_offload/preempt_offload/`，`PreemptOffloadConnector`（`PreemptOffloadConnectorV1`） [S26] | 同 v0.30.0 |
| 两个字节参数都不写 | 整实例 8 GiB，除以 `world_size` | 同 v0.23.0 | 按 `offload_host_memory_ratio`（默认 `1`），主机块数 = 显存块数 | 同 v0.30.0 |
| 递推状态与混合状态恢复 | 和 attention 组一样按已算位置截取块表；含摘掉未写前缀块逻辑 [C19] | 只存最后 `1 + num_spec_tokens` 块，不参与共用；删摘块逻辑 [C20] | 延续尾部保存，新增环形单私有块、接受边界与卷积历史偏移校正及保存事件去重 | 同 v0.30.0 |
| DCP / PCP 限制 | 断言 `DCP=1` 且 `PCP=1` | 同 v0.23.0 | 仍断言 `dcp_world_size == 1 and pcp_world_size == 1` | 解除 `DCP=1`/`PCP=1` 断言，改用 `resolve_dcp_kv_block_size` 核算块跨度 |
| 钩子抛异常与细粒度 TP 失败 | 不捕获异常 | 同 v0.23.0 | 捕获异常；普通场景退回 P，细粒度 TP（`oproj`/`mlp` > 1）保存失败直接中止 [C23] | 同 v0.30.0 |
| 执行器与拷贝方式 | `model_runner_v1`；同步逐块 `copy_` | 同 v0.23.0 | `model_runner_v1` 与 `v2` 均调用 `handle_preemptions` [C24]；拷贝仍同步 | 同 v0.30.0 |

固定 GLM 镜像 `db701c1f` 的连接器名、预算默认值与实现与 `v0.23.0` 同源；这些代码处理不等于所有混合模型和异步组合都已通过验证（`v0.30.0` 官方指南仍要求 Qwen3.5 关闭异步调度，GLM 全部状态的恢复质量仍需端到端实测）。让出哪一条、退回 P 怎样收尾的版本差异，见 [RecomputeScheduler 的「版本差异」](recompute-scheduler.md#版本差异)。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 岔路口：问连接器能不能存走 | `vllm_ascend/core/recompute_scheduler.py`（GLM 快照 L297–L345） |
| `v0.30.0` / `main` 连接器入口、预算优先级与容量校验 | `vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L41-L115`；`manager.py#L70-L120`、`#L180-L205`、`#L293-L345` |
| `main` 解除 DCP/PCP 断言与 `resolve_dcp_kv_block_size` | `vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L95-L120`、`#L315-L335`、`#L522-L538` |
| 旧版入口、实例卡数、DCP/PCP 断言与块数计算 | `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/`：`recompute_cpu_offload_connector.py` L40–L96，`manager.py` L63–L156 |
| 能接上多少、抢占钩子、全有或全无与集齐 | 同目录 `manager.py` L179–L368、L517–L553 |
| 锁页主机缓冲、存、取、等 | 同目录 `worker.py` L96–L116、L134–L175、L200–L305 |
| 执行器调用点与排上搬运 | `vllm_ascend/worker/model_runner_v1.py` L1984–L1989；`vllm_ascend/core/recompute_scheduler.py` L548–L672、L138–L170 |
| MultiConnector 转问与注册 | `vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py` L65–L77；`__init__.py` L23–L26 |
| `world_size` 与显存块哈希 | `vllm@0fc695fc:vllm/config/parallel.py` L776–L780；`vllm/v1/core/kv_cache_manager.py` L553–L562 |
| 官方说明 | 旧版 `docs/source/user_guide/feature_guide/recompute_cpu_offload.md`；新版 `preempt_offload_connector.md` |

固定 db701c1f 的官方说明要求 vLLM V1 引擎、RecomputeScheduler 和 P/D 分离的 D 节点（来源 15）；管理器断言 prefill、decode 的上下文并行份数均为 1（来源 3）。这些条件不能代替模型缓存类型与版本支持检查。

新建保存状态会在没有已算位置、设备块池、有效设备块或足够主机空块时被拒绝（来源 6）；已有保存状态直接接受（来源 5）。已完成的共享主机块不必重搬，尚待保存的块则要等搬运报告全部到齐后才 ready（来源 6、7）。恢复长度取存量与请求长度的较小值，扣除本地已算量并截到非负（来源 5）。GLM 全部混合缓存组的恢复正确性和实际耗时仍缺端到端验证。

主机协调器也使用上游 BlockPool（来源 3），初始化时永久摘出一个 null block（来源 34）。容量算例必须扣除它；“按预算切出多少块”和“请求能借多少块”相差一块。

组合连接器的恢复优先与选中后分派见来源35；准备映射的日志和实际恢复完成分别见36、29、7，主机块回收及reset限制见37。每worker独立锁页分配见8，按本地worker求和是预算推导。rc2容量校验见38，main比例取整和至少1块见39；新指南的日志、使用前提及限制见40。RFC10820正文和作者自测说明见41，其异步稳定边界与未来专用拷贝、合并连接器均属于计划，不能当现有能力。

rc2保存时的环形单私有块与Mamba尾块见42，接受边界、目标状态块和卷积偏移见43；注册去重、形状及后端识别见44，保存事件去重和恢复入口见45，普通块搬回后的卷积校正及范围校验见46。环形能力的分组判定见47。宽5、草稿2、偏移1的例子是对该切片规则的教学演算，不是GLM实际张量记录。
