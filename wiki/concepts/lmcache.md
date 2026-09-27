---
id: lmcache
title: LMCache：外部缓存如何接入推理引擎
type: feature
summary: 以两次共享前缀的请求解释外部缓存读写，区分设备页与存储段，以及 Ascend 包装、上游接口和外部插件的职责。
aliases: [LMCache, LMCacheAscendConnector, LMCacheConnectorV1, LMCache-Ascend, use_native, chunk]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L61-L65
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/lmcache_ascend_connector.py#L1-L5
  - vllm@0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py#L83-L115
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md#L3-L24
verified: []
evidence: "C"
relations:
  - {to: kv-pool, kind: builds-on, note: 复用外部缓存匹配和加载的生命周期}
  - {to: prefix-caching, kind: builds-on, note: 外部前缀复用要求一致的数据身份}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 用外部副本延长前缀的可复用时间

请求 A 和 B 都以同一段长文档开头。A 首次处理文档时计算对应状态；B 到来时，如果本地前缀缓存已被回收，仍可能从外部存储取回这些状态，减少重复 Prefill。

LMCache 通过 vLLM 的外部 KV 连接器接口参与这种复用。其职责是管理外部数据并报告可匹配范围，推理引擎继续负责请求调度、本地缓存分配和模型执行。基础交接过程见[外部 KV 池](kv-pool.md)。

```wiki-diagram
file: lmcache
```

图中 A 的保存与 B 的加载处于不同时间。副本被成功保存、仍然存在且与请求状态兼容，B 才能利用它；仅配置了连接器不意味着每次请求都有外部命中。

## 设备页与存储段怎样对应

设备缓存管理器按物理页分配位置，外部缓存实现可能按 chunk，也就是一段连续位置，组织存取。它们的粒度不必相同，适配器需要把外部段映射到正确的本地页。

设一页128个位置、外部段256个位置，且只保存完整段。[A] 一个段覆盖两页。A 已计算600个位置时，可形成两个完整段，共512个位置，剩余88个位置尚不构成第三段。如果 B 共享前500个位置，则可复用多少还要看实现的查找和加载粒度；不能因为存了512个位置就直接把500写成某个通用命中结果。

若每页所有相关本地缓存共2 MiB，两个完整段的主体需要 `2段×2页×2 MiB=8 MiB`。[D] 多个worker的不同分片需分别计入；元数据、对齐、压缩或其他存储表示可能进一步改变字节数。

这些数字是单位换算例子。固定 Ascend 包装本身没有定义 chunk 默认值，不能把其他 adapter 的256位置默认值当作所有 LMCache 安装的约定。

## 接入由三层代码完成

固定 Ascend 快照在注册表中登记 `LMCacheAscendConnector`。[C1] 其包装模块先加载 `lmcache_ascend`，再导出上游 vLLM 的 `LMCacheConnectorV1`；存储策略没有在这几行包装中实现。[C2]

上游连接器还存在 adapter 选择：`use_native` 默认为 false，默认导入外部 `lmcache` 软件包的实现；显式使用 native 时才选择 vLLM 仓库自带的集成。[C3] 因此以下结论需要钉住实际使用的插件和 adapter：

- chunk大小、尾部不完整数据是否保存。
- 使用哪一层主机或远端存储，以及如何淘汰。
- 支持哪些缓存规格和并行布局。
- 异步加载失败后如何处理请求。

Ascend 注册入口存在，只证明可以找到连接器类，不能替代上述行为和兼容性核查。

## 命中收益取决于加载成本

外部缓存节省的是本可重新计算的前缀工作，同时增加查找、加载、格式转换和同步开销。如果重算只需要很短时间，外部加载可能没有优势；长前缀也可能受链路带宽或并发读取影响。

无设备学习时，可以分别列出“B能复用的位置数、对应字节、需要执行的位置数”来检查数据流。实际性能需要在相同模型、输入和并发条件下比较冷启动与外部命中，确认第二次确实加载了第一次计算并保存的缓存，而不只是命中了本地设备副本。

## GLM 与依赖版本的边界

官方 Ascend 部署材料依赖社区 LMCache-Ascend 插件，其中镜像例子带有特定的旧版本组合。[S4] 文档存在于当前源码快照，不表示该镜像已经验证 GLM 主线。实际兼容性需要记录 vLLM、vllm-ascend、LMCache、LMCache-Ascend 以及模型的确切版本。

外部前缀缓存与 [PD 分离](pd-disaggregation.md)共享部分接口，但验证的是不同数据流。PD支持矩阵的一个结果，不能单独推出所有外部前缀缓存都可用或都不可用。

GLM 的外部副本必须包含恢复所需的 KDA 与稀疏注意力状态。本文核对了接入入口和 adapter 分派，未核对外部插件中的全部实现，也未完成 GLM 设备部署验证。
