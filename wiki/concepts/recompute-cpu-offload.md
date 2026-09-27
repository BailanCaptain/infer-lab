---
id: recompute-cpu-offload
title: 抢占卸载：保存请求状态并恢复计算
type: feature
summary: 解释请求被抢占时哪些状态需要保存、传输完成如何决定释放与恢复，以及主机容量不足时的退路。
aliases: [Recompute CPU Offload, Preempt Offload, RecomputeCPUOffloadConnector, PreemptOffloadConnector, 抢占卸载, enable_offload_prefix_caching]
chapters: ["11", "12"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L297-L345
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L56-L90
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L179-L200
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L236-L305
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L517-L550
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L166
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L200-L276
verified: []
evidence: "C"
relations:
  - {to: recompute-scheduler, kind: builds-on, note: 保存状态是调度器处理抢占的一种路径}
  - {to: block-table, kind: builds-on, note: 块映射决定需要保存和回填的物理位置}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 抢占会中断状态的设备驻留

当缓存空间不足，调度器可能暂停一个正在生成的请求，把设备空间让给其他请求。请求已经处理过的 token 和已生成文本仍可记录在 CPU 上，但继续推理还需要对应的模型历史状态；只保留 token ID 不能代替这些缓存。

一种恢复方式是重新计算缺失的历史，另一种是先把请求状态保存到主机内存，之后再回填。后者就是本页讨论的抢占卸载。它发生在[抢占决策](recompute-scheduler.md)附近，与持续保存完整前缀段的 [CPU 备份](kv-cache-cpu-offload.md)有不同的触发时机。

固定 Ascend RecomputeScheduler 在抢占前调用连接器接口，根据是否接受保存采用不同处理路径。[C1] 保存并非无条件成功：主机容量、请求状态和连接器配置都会影响结果。

## 保存、释放和恢复的顺序

假设请求 A 已经处理了一段历史，准备被抢占。它的逻辑生命周期如下：

1. 确定已计算范围和对应设备块，申请主机保存位置。
2. 在设备内容被覆盖前完成必要的拷贝，登记保存任务。
3. 确认原块已不再被保存操作读取后，设备空间才能安全用于其他请求。
4. A 再次获得执行机会时，为恢复数据准备本地空间并建立块映射。
5. 回填完成后，从恢复的计算位置继续执行。

```wiki-diagram
file: recompute-cpu-offload
```

调度器可以在同一步先把块 ID 分配给另一个请求；这里的依赖约束针对物理内容的覆盖。固定 Worker 会在新请求清零或前向写入这些页之前，阻塞完成旧状态的保存。[C6]

固定 manager 区分无保存状态、保存尚未就绪和可恢复状态；未就绪时不能当作普通“缓存未命中”立即开始读取。[C3] 多 worker 保存结果还需要汇总到要求的完成数量，才将该状态标为 ready。[C5]

## 保存的是哪些块

对普通按位置增长的 attention KV，已计算位置数决定最后一个有效页。假设一页4个位置，请求已处理9个位置，就涉及 `ceil(9/4)=3` 页。[A][D] 最后一页只有一个有效位置；复制整个物理页并不使其余3个位置变成已计算历史。

设每页所有相关本地状态共2 MiB，则一次完整保存最多复制这3页的6 MiB有效物理区域；具体实现的填充与视图会影响实际字节。保存后若要全部回填，还需要相应的反向传输。[A]

固定 manager 按缓存组建立 CPU 块列表，并结合已计算范围与块哈希处理保存和复用。[C4] 这道按 token 数向上取整的公式适用于本例的累计 KV。KDA 等递归状态需要保留足够的状态快照，不能直接用“历史长度÷页内位置”替代其恢复规则。

## 共享前缀和请求私有状态

如果多个被抢占请求具有相同的完整前缀，可以在支持的路径下共享相应 CPU 块，减少重复保存。固定 manager 有 `enable_offload_prefix_caching` 选项，其构造默认值为 true；关闭时，各请求保存的块是私有的。[C2]

例如 A 和 B 各需3页，其中前2页的哈希与可复用条件相同，且实现允许共享：关闭共享时需要6页，开启后可以是2个共享页加各自最后一页，共4页。[A][D] 这个例子仅说明已满足共享条件的块如何计数，不保证任意两份模型状态都可通过 token 前缀共享。

## 搬运与重算之间的成本

保存和回填会占用主机内存、链路带宽以及同步时间。固定 Worker 在输入更新、清零或后续前向可能覆盖数据之前处理保存；底层拷贝还包含设备同步，并在要求同步的路径上等待事件完成。[C6][C7] 这份实现不能被描述为完全不阻塞计算的后台任务。

是否值得保存，取决于需要搬多少字节、主机带宽和重新得到这些状态的计算成本。相同请求长度也可能因缓存共享、注意力结构和并行分片不同而具有不同成本。保存失败或不可用时，应由调度器选择相应退路，不能保证所有请求都恢复且完全没有重算。

## 版本与 GLM 的边界

本页使用 GLM 来源基线中的 `RecomputeCPUOffload` 实现名称；其他快照中的 `PreemptOffload` 命名和能力不能直接套入。此 manager 显式要求 PCP=1、DCP=1。[C2]

对 GLM，恢复时必须同时保证稀疏注意力历史、索引状态和 KDA 状态对应同一计算位置。这里核对了抢占保存接口与状态管理，未验证整套 GLM 混合状态的实际恢复，也未给出可直接运行的部署命令。
