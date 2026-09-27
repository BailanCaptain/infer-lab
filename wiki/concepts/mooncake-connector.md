---
id: mooncake-connector
title: Mooncake 连接器：状态生命周期与数据传输
type: feature
summary: 把调度侧的块归属、元数据与完成通知，对应到执行侧的地址注册、分组搬运和逐层重叠；区分固定版本的不同连接器。
aliases: [Mooncake 连接器, Mooncake Connector, KV Connector, KV 连接器, MooncakeConnector, MooncakeLayerwiseConnector, MooncakeHybridConnector, MooncakeConnectorV2, MooncakePullConnector, KVConnectorBase_V1, KVConnectorRole, kv_transfer_config, kv_connector_extra_config, Mooncake TransferEngine, 逐层推 KV]
chapters: ["18"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L21-L55
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1506-L1590
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1822-L1926
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2274-L2298
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2332-L2366
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L11-L40
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3374-L3462
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L908-L962
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L322-L386
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1401-L1416
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L166-L242
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2472-L2492
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2236-L2248
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3197-L3231
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1522-L1547
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L746-L787
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L838-L879
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L477-L516
verified: []
evidence: "C"
relations:
  - {to: pd-disaggregation, kind: builds-on, note: 先理解状态边界与交接生命周期}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 理解块分配与引用释放}
  - {to: npu-model-runner, kind: builds-on, note: 理解执行侧持有的缓存张量}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 连接器连接两类职责

[PD 分离](pd-disaggregation.md)要求框架既能决定“哪些状态可以迁移、何时可继续和释放”，又能完成“从哪些地址向哪些地址搬运”。Mooncake 传输引擎主要承担数据搬运；vllm-ascend 的连接器还负责把请求、块和执行状态接入这一过程。

这里把职责分为**控制面**和**数据面**：前者管理身份、分配与完成事件，后者管理真实地址、布局及字节传输。它们是职责划分，不要求各自只有一个进程或线程。

```wiki-diagram
file: mooncake-connector
```

固定 V1 公开接口分别提供 scheduler 与 worker 侧操作。[C2] 调度侧生成接收计划、保留源块与移交字段；Worker 在实际设备缓存上完成传输。[C3]

## 从块身份到可访问地址

源块编号属于 P 的块池，目的块编号属于 D 的块池。Worker 需要把缓存组、块编号、每块长度、stride、dtype 和并行切分映射到地址与长度。

启动注册保存缓存的物理地址范围，传输元数据再描述各组布局。[C4][C5] Ascend 包装的 TransferEngine 使用相应 transport，并将缓冲注册交给底层引擎。[C6] “地址已注册”只是允许该内存范围被传输访问，不等于内容已经计算完成或目的数据已经到位。

接收端按上下文分片和端口等信息构造任务，再按组和 TP 偏移生成源地址、目的地址与长度，调用批量读取接口。[C7][C8] 一个用户请求可以拆成多个 rank、多个组和多个任务，不能把一次 `batch_transfer_sync_read` 当作整个请求的唯一网络动作。

## 完成通知保护块的生命周期

控制消息包括请求元数据与接收完成通知。接收端报告完成并等待确认，发送端通过计数追踪已完成的接收者。[C9][C10] 连接器再向框架汇报 `finished_sending` / `finished_recving`，调度器据此恢复等待请求或释放保留块。[C12][C13]

数据面完成与调度面回收之间必须保持顺序：如果源块提前复用，远端可能读取到另一个请求的内容；如果完成事件丢失，保留时间可能延长。固定实现包含超时清理，但超时阈值并不意味着任何故障都会让整个块池固定占满同一时长。[C11]

## 整批读取与逐层传输

V1 的逐层 `wait_for_layer_load`、`save_kv_layer` 等公开 hook 在这个快照中为空操作；它使用另一条任务传输路径。[C2] Layerwise 连接器则把相应 hook 接入按层等待与发送。[C16]

```wiki-diagram
file: mooncake-layerwise
```

图用三个层的理想时间线比较：等所有层状态可用后再传，与每层完成后就安排传输。时间只是示意，并假设通信能和后续计算独立推进。[A] 真正执行时，发送线程等待设备事件后发起写传输。[C18]

逐层方式增加重叠机会，却不消除传输字节、链路争用或最后一层的等待。它也不保证所有接收路径在只到了一层时就能立即开始完整 decode；继续执行的条件必须由对应连接器和 Worker 判断。

## 连接器名称不能替代版本检查

`db701c1f` 注册了 V1、Hybrid、Layerwise 等实现。[C1] 随代码演进，它们覆盖的状态类型已经存在交集：

| 固定实现 | 本页核对到的机制或边界 |
|---|---|
| V1 | 包含 Mamba 状态组及按 P/D TP 整除比例处理的逻辑 [C14] |
| Hybrid | 所引路径仍要求两侧 TP 相同 [C15] |
| Layerwise | 同样包含注意力与 Mamba 混合状态及 N−1 边界处理 [C17] |

因此不能把 V1 定义成“只会搬普通 KV”，也不能把 Hybrid 的一条等 TP 限制推广到全部连接器。其他开发快照中的 V2/Pull/Push 名称、角色限制和配置要按各自来源阅读，不倒灌到这里的固定基线。

GLM 的状态类型可帮助理解为何连接器需要按组处理，但这些源码分支并不等于 GLM 整套 PD 部署已跑通。量化布局、KDA 状态、MTP 和图模式仍需按同一套安装版本联合验证。
