---
id: kv-cache-cpu-offload
title: CPU 前缀备份：保存完整缓存段并按需回填
type: feature
summary: 从设备缓存淘汰后的前缀复用问题出发，解释完整段的备份、外部命中、回填和传输完成，以及主机容量与搬运成本。
aliases: [KV Cache CPU Offload, CPU Offloading, OffloadingConnector, NPUOffloadingSpec, CPUOffloadingSpec, num_cpu_blocks, blocks_per_chunk]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L721-L806
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/npu.py#L16-L63
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L63-L68
  - vllm-ascend@db701c1f:vllm_ascend/kv_offload/cpu_npu.py#L180-L261
  - vllm@0fc695fc:vllm/v1/kv_offload/cpu/spec.py#L30-L71
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/offloading/scheduler.py#L537-L567
verified: []
evidence: "C"
relations:
  - {to: prefix-caching, kind: builds-on, note: 扩展可复用前缀的存储位置}
  - {to: kv-cache-spec, kind: builds-on, note: 根据实际页规格计算外存段容量}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 本地前缀缓存被回收以后

[前缀缓存](prefix-caching.md)让请求 B 复用请求 A 已经算好的相同开头。复用需要数据仍然存在：设备空间被其他请求使用后，原缓存页可能被回收，B 再次访问时就需要重新计算。

CPU offload 可以在主机内存保存这些前缀的副本。即使设备副本后来被淘汰，只要主机副本仍然有效，就可以将它加载回设备。这个机制扩展了前缀复用的存储层级；它与[抢占时保存活跃请求状态](recompute-cpu-offload.md)具有不同的触发点。

本页对照上游完整段调度和 Ascend 的 CPU/NPU 拷贝实现。两份固定源码用于解释职责，未作为配套安装组合或 GLM 外部缓存部署经过验证。

## 从完成计算到可复用副本

一个缓存段会经历“数据尚未完整、可提交保存、传输中、外存可用”几个阶段。完整性和完成事件分别解决两个问题：内容是否已经计算出来，以及这些内容是否已经安全到达另一处内存。

1. 调度侧根据请求 A 已计算和本批拟计算的位置，规划本批结束后可以形成的完整 offload 段。
2. Worker 等待对应计算完成，再把这些段的字节从 NPU 复制到主机。
3. 保存完成后，主机副本可以用于后续匹配；NPU 页仍由本地缓存管理器管理。
4. 请求 B 在本地缺少相同前缀时查询外存，获得可加载范围。
5. 本地为加载结果分配空间，Worker 回填并报告完成，之后的计算才能读取这些状态。

上游在规划时使用“已计算位置数 + 本批调度位置数”，并将其限制在 token 已知、符合保存策略的范围内。[C1] 因而保存计划可以先于本批计算完成产生，实际拷贝仍必须等待数据就绪；它不以每个 NPU 页即将被淘汰为触发条件。外部匹配与加载计划也由上游连接器调度侧参与处理。[C6]

```wiki-diagram
file: kv-cache-cpu-offload
```

图中的完整段备份和稍后回填发生在不同时间。传输中的源页必须保持有效，目标页也要等拷贝完成后才能使用。

## 页和段是两个粒度

设备缓存管理器按页分配空间，外部存储可以把若干页合成一个段。较大的段减少管理项，但也提高了保存和命中的粒度：规划只覆盖本批预计形成完整段的范围，真实拷贝等待数据就绪；末尾不足一段的部分不会由这条完整段路径保存。[C1]

假设一页表示16个位置、包含所有相关本地缓存张量后占2 MiB，每4页合成一段：[A]

| 对象 | 计算 | 大小 |
|---|---|---:|
| 一个外存段 | 4页×16位置 | 64位置 |
| 一个段的载荷 | 4×2 MiB | 8 MiB |
| 1 GiB主机预算的理想上限 | 1024÷8 | 128段 |

这是忽略额外对齐和管理开销的单 worker 算例。[D] 若只完成了70个位置，可以形成一个完整段，剩余6个位置尚不足以提交第二段。实际字节数必须由全部相关缓存张量求和，不能只算普通 K/V 而遗漏递归状态。

## 异步传输怎样等待

Ascend handler 为两个方向设置传输流。[C3] D2H 保存需要等待产生数据的计算流；同一方向的后续拷贝还会等待前一笔完成事件，再提交批量拷贝并记录本次事件。[C4]

这些依赖使数据读写顺序正确。CPU 可以在部分时间内继续处理其他工作，设备也可能让传输与计算重叠，但二者仍会竞争内存带宽，回填未完成时计算必须等待。

假设需要加载64 MiB，有效带宽为16 GiB/s，仅数据传输时间约为 `64/16384秒≈3.91毫秒`。[A][D] 排队、同步和描述符处理还会增加时间。是否比重新计算该前缀更快，要比较两者在相同配置下的实际成本。

## 配置单位与 GLM 边界

固定 Ascend `NPUOffloadingSpec` 要求 `num_cpu_blocks`，通过设备块大小与倍数构造外存段；该实现还断言只有一个设备 block-size group。[C2] 上游另一份 `CPUOffloadingSpec` 则按 `cpu_bytes_to_use`、worker 数、页字节和对齐换算容量，默认淘汰策略为 LRU。[C5] 这两种配置入口的单位不同，参数不能直接互抄。

外部备份不会自动缩小已经预留的 NPU 缓存池；主机内存和传输缓冲还增加了资源需求。可以在容量规划时重新选择设备池大小，但要同时评估回填频率和延迟。

GLM 的 KDA 与稀疏注意力有不同的状态规格。单 group 的 NPU spec 不能作为其全部混合缓存已支持的依据，也不能用上游另一实现的能力覆盖这个限制。本页不提供可直接运行的 GLM CPU-offload 配置。
