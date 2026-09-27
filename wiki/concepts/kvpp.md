---
id: kvpp
title: KVPP：按层共享缓存与提前广播
type: feature
summary: 从 TP 中重复保存的历史状态出发，解释层 owner、暂存区和提前广播；以固定实验实现为边界，不将其写成 GLM 双机基线能力。
aliases: [KVPP, KV Pipeline Parallelism, KV 流水并行, KV 层并行, KV 按层并行, enable_kvpp, KVPPConfig, KVPPScheduler, KVPPPhysicalCachePlan, BroadcastKVPPTransport, LayerSplit]
chapters: ["13"]
order: 60
sources:
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L107-L159
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L19-L44
  - vllm-ascend@baa023ad:vllm_ascend/worker/kvpp_cache.py#L30-L57
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kvpp.py#L9-L36
  - vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L87-L110
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L2056-L2061
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L60-L100
  - vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L65-L89
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1502
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2486-L2487
verified: []
evidence: "C"
relations:
  - {to: tensor-parallel, kind: builds-on, note: 先理解权重切分及结果协作}
  - {to: mla, kind: builds-on, note: 理解压缩历史状态与复制条件}
  - {to: collective-communication, kind: builds-on, note: 理解 Broadcast 的源与接收者}
  - {to: kv-cache-spec, kind: builds-on, note: 理解缓存规格和按块分配}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从重复缓存到按层指定 owner

TP 切分权重与计算后，历史状态不一定按同样的比例切分。在某些 MLA 实现及并行配置中，各 rank 仍保存相同的压缩历史。KVPP 以这种重复为前提：为每层指定一个常驻 owner，其余 rank 在计算该层前取得所需数据。

本页讲的是 **vllm-ascend `baa023ad` 的实验实现**。GLM 专用来源基线 `db701c1f` 中没有这套 KVPP feature，本页不提供 GLM KVPP 部署命令。MLA 是否复制缓存取决于实际实现与配置，也不是“采用低秩压缩就只能复制”的数学定律。

```wiki-diagram
file: kvpp
```

图假设同一 PP stage 有 8 个等大层 bundle，4 个 rank 共同持有。每个 bundle 包含这一层需要一并保存的缓存数据。原来每个 rank 保存全部 8 层；按层分配后，每个 rank 常驻 2 层，另外保留两个暂存区。[A]

## 层归属与暂存空间

固定实现对本 PP stage 的目标层排序并连续均分，余数分给靠前的 owner；MTP 草稿层不参与这部分切分。[C1] 每个 rank 保留自己的常驻层，非本地层复用两个 scratch buffer。[C3]

若每层分配缓存同为 B 字节、共有 L 层、组大小为 N，并且没有额外不分片层，则最满 rank 的容量近似为：

`(ceil(L/N) + 2) × B`

图中为 `(ceil(8/4)+2)B=4B`，原来是 `8B`，理想容量下降一半。[D] 两个暂存区也占设备内存，因此节省比例小于简单除以 N。

实际算法按各层 bundle 大小计算常驻字节，再计入两个最大 bundle 的暂存预算；不等大的层不能直接用平均 B 替代。[C2] 草稿层等额外常驻状态也必须单独计算。这里的容量是 KV 相关分配，不能当作整模型设备内存降幅。

## 数据到位后，计算仍由各 rank 执行

```wiki-diagram
file: kvpp-broadcast
```

以 owner 为 rank 0 的层 1 为例：rank 0 从常驻缓存发起 Broadcast，其他 rank 接收到暂存区；各 rank 继续执行本来属于自己的 TP 计算。owner 改变的是历史状态常驻位置，没有将这一层的权重与全部计算迁到 owner。

执行过程在第一次读取或更新该层缓存前等待广播完成。[C6] 调度器提前请求下一层，尝试让广播与当前层后续计算重叠。[C5] 重叠窗口不只包括 Q/K/V 投影，但也不保证通信完全被覆盖。

本实现广播的是该层**整个已分配的 bundle**，不是只挑本轮活跃请求的若干块。[C4] 因而增加可分配缓存容量也可能增加每次广播的数据量。

当整个前向没有可复用历史时，相应路径跳过预取广播；V1 Runner 与 V2 调度器各有历史判定。[C5][C10] 新 prefill、混合批次和恢复历史的请求需按实际条件区分，不能仅凭“这是 prefill 阶段”就一律省略传输。

## 与 PP、DCP、卸载的区别

| 机制 | 主要改变的对象 | 数据依赖如何满足 |
|---|---|---|
| PP | 层的权重和计算归属 | 阶段间传递中间表示 |
| DCP | 历史位置的分区 | 交换所需信息并合并注意力结果 |
| KVPP | 历史缓存按层的常驻 owner | 计算前从 owner 广播到其他 rank |
| 缓存卸载 | 历史状态所在存储层级 | 从主机或外部存储恢复到执行设备 |

KVPP 的组在固定实现中为 TP×PCP，并隔离 DP 与 PP stage。[C7][C8] 因此 TP=1、PCP=1 时没有多 rank 共享收益；单独看 TP=1 还不够。PCP 组合另要求相应的 V2 Runner 条件。[C9]

## 为什么容量收益仍需要执行验证

这一实验实现只接受非混合 MLA 模型，要求 eager 执行、DCP=1；若启用投机，方法须为 MTP，且推测步数不能按批量动态变化。配置 PD 传输时仅接受 MooncakeConnectorV2，并要求 D consumer 关闭 KVPP；AscendStoreConnector 在这项连接器检查中另作池化路径处理。[C7] GLM 同时包含 KDA 与稀疏 MLA，不能因为其中存在 MLA 层就忽略混合状态限制。

KVPP 可能让更多历史留在设备组中，从而减少容量不足导致的卸载或重算；代价是广播、同步和暂存访问。收益取决于原本是否受容量约束，以及增加的数据移动能否有效重叠。其他模型的吞吐或命中率变化不作为本站 GLM 的实验结果。

无设备读者可先用 L/N/B 复算容量，再跟踪图中层 1 的 owner、接收缓冲与计算位置。这样可以分别理解“保存在哪里”和“在哪里计算”，而无需启用这项实验功能。
