---
id: ucm
title: UCM：前缀存储与两种 PD 数据流
type: feature
summary: 区分共享前缀缓存、集中式存储转交和Mooncake直接传输，解释调度计划、数据到达及持久化的边界。
aliases: [UCM, Unified Cache Manager, UCMConnector, UCMConnectorV1, UCM_CONFIG_FILE, 集中式 KV 存储]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L59
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L100-L159
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L194-L218
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L90-L110
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L202-L246
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md#L373-L416
verified: []
evidence: "C"
relations:
  - {to: kv-pool, kind: builds-on, note: 先理解外部缓存匹配与加载生命周期}
  - {to: pd-disaggregation, kind: builds-on, note: 区分P生成状态与D继续使用状态}
  - {to: mooncake-connector, kind: builds-on, note: P2P模式由Mooncake承担P到D传输}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 同一份缓存可能服务不同目的

外部缓存可以保留多个请求共用的前缀，也可以承担一次请求从 Prefill 节点到 Decode 节点的状态交接。前者关注后续请求能否复用已有计算，后者关注本次请求能否在另一处继续生成；两者可以使用相同存储，也可以采用不同路径。

UCM 通过外部连接器参与状态管理。固定 Ascend 文档给出的集中式 PD 和 P2P PD 使用方式具有不同的数据归属与传输路径。[S5][S6] 阅读部署结构时，需要具体指出哪份缓存经过哪一段传输。

## 集中式：共享存储连接 P 和 D

在集中式示例中，P 节点计算历史状态并保存到共享后端，D 节点从同一后端取得这些状态，随后继续 Decode。[S5] 后端需要让两端看到同一份数据；仅在两台机器配置同名本地目录，并不能形成共享存储。

这条数据流有两次交接：P保存到外部，外部再加载到D。P的保存任务尚未完成时，D不能把“已计划保存”当成“数据已经可读”。外部实现还需要协调身份匹配、完成状态和失败处理。

## P2P：请求状态由 Mooncake 直接发送

固定文档的 P2P 模式由 Mooncake 从 P 直接传输到 D，UCM 在 P 端提供前缀缓存复用。[S6] P可能先利用外部前缀减少计算，再把本次请求需要的状态交给D；D接收本次状态的路径由Mooncake承担。

```wiki-diagram
file: ucm
```

假设本次P→D需要的状态载荷为64 MiB。[A] 集中式路径在不考虑压缩、共享命中和元数据时，涉及一次64 MiB写入及一次64 MiB读取；P2P路径的P→D主体为一次64 MiB传输。[D] 这只是两段与一段的数据流计数，不能推出延迟一定翻倍：缓存命中、并行传输、存储布局和链路拓扑都会改变实际成本。

## 调度计划与 Worker 执行

调度侧先询问外部引擎可加载多少新增位置，再把实际分配情况反馈给它；接口也允许查询尚未得到确定结果。[C4] 这一步得到的是后续计算可以利用的外部状态计划。

Worker侧提供开始加载、等待层数据、保存及等待保存等接口。[C3] 计算读取目标数据之前，必须满足相应加载依赖；保存仍在使用源数据时，源空间不能随意覆盖。

接口中出现“按层等待”不表示所有部署都按层传输。集中式PD示例配置 `use_layerwise: false`，P2P的P端与混部示例则使用逐层模式。[S5][S6][S7] 实际调用顺序取决于外部UCM选择的实现和配置。

## 持久性和缓存兼容性

外部后端如果提供持久存储，并在重启前成功保存所需内容，服务才可能跨重启复用缓存。内存后端、未完成写入和不可访问的存储具有不同结果；Ascend连接器包装无法单独证明后端的持久性、淘汰和故障恢复保证。

复用还要求内容可解释。换模型会改变权重、状态类型、层结构、形状或dtype，改变并行布局也可能改变每个rank的数据。兼容性因此超出“KV占多少字节”的问题。

GLM 的完整外部状态需要覆盖 KDA递归状态、稀疏注意力历史和索引状态。验证一个普通注意力模型的UCM示例，不能直接作为这套混合结构已支持的证据。

## Ascend 适配与版本边界

固定 Ascend 注册 `UCMConnector`，构造外部引擎并适配vLLM接口。[C1][C2] 其中还包含 reserved hook 的委托逻辑：根据外部dispatcher是否显式实现接口，选择dispatcher或内部connector，避免基类默认行为遮蔽真正实现。[C2]

缓存策略和存储能力主要在外部软件包中。确认组合时，需要同时固定外部UCM版本、后端、缓存格式和vLLM/Ascend版本；本页仅核对仓内适配与官方示例的数据流，未做GLM部署或存储故障恢复实测。
