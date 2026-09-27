---
id: npu-platform
title: NPUPlatform：配置校验与设备实现选择
type: feature
summary: 将 Platform 契约对应到 Ascend 的启动准备、配置调整、Worker 选择和后端选择，并说明 GLM 模型专用绑定的边界。
aliases: [NPUPlatform, platform.py, 平台类, 昇腾平台类, PlatformEnum.OOT, check_and_update_config, get_device_total_memory]
chapters: ["10"]
order: 60
sources:
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L204
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L700
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L282
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2492-L2553
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L831
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L78-L84
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L232-L233
verified: []
evidence: "C"
relations:
  - {to: vllm-platform-interface, kind: builds-on, note: 先理解平台契约}
  - {to: ascend-config-system, kind: builds-on, note: 配置来源与合并规则}
  - {to: attention-backend-family, kind: builds-on, note: 区分通用选择接口和模型专用后端}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 把接口落实到 Ascend

[Platform](vllm-platform-interface.md)规定调用方式，`NPUPlatform`提供 Ascend 的具体行为。它声明 NPU 设备身份、可见设备环境变量和支持的量化名称，并在启动路径参与注册、配置校验和执行组件选择。[C1]

```wiki-diagram
file: platform-surface
```

图中的连线表示配置和选择结果流向相应组件；模型计算本身发生在 Worker 内的 Runner、模型与算子中。

## 启动准备先建立可用的实现

`pre_register_and_update()` 调用平台补丁，并准备量化相关注册。[C2] 这些动作影响随后解析与构造配置时能识别的类型和实现。GLM 的配置类型与模型实现还分别通过补丁模块、通用模型插件登记，见[插件页](platform-plugin-registration.md)和[补丁页](ascend-patch-system.md)。

注册量化名称与模型可按某种量化运行是不同层次。后者还要求权重格式、模型实现、算子与硬件组合相符，不能从平台的名称列表直接推断。

## 校验与改写怎样影响执行

`check_and_update_config` 先检查设备与模型配置条件，再进行量化识别、layer sharding、draft/DCP、并行组合及 PD/PP/MTP 等校验。处理不兼容配置后初始化 `AscendConfig`。[C3]

在后续分支中，`worker_cls="auto"` 会根据设备与 Xlite 配置选择 Worker；常规路径指向 `vllm_ascend.worker.worker.NPUWorker`。同一方法还更新块大小相关设置，并检查调度与 KV 传输组合。[C4]

一个具体例子是 `enable_balance_scheduling`：它只允许 PD 混合角色或未配置 KV 传输的情形；显式 producer/consumer 角色会触发错误。`recompute_scheduler_enable` 又有自己的角色限制。[C4] 这些检查说明开关的含义依赖周围配置，不能逐个独立开启后就认为组合成立。

## 默认预算为何不能只看一个数字

固定 Ascend 实现的 `get_device_total_memory()` 主动抛出 `NotImplementedError`，注释说明要避免过早触发 NPU 初始化。[C5] 上游默认预算计算捕获设备查询异常，采用回退基础档。[C6]

但基础档仍不是最终预算：后续代码考虑 batched DP、吞吐模式、是否启用分块 Prefill、最大模型长度与总量上限。[C7] 因此无法据此说“Ascend 默认每轮 2048 token”，更无法把调度预算解释成缓存块大小。

本库 GLM 双机路径以[官方来源基线](../sources/glm-5-3-flash-baseline.md)记录的显式参数为依据；教学请求另有简化预算。调度预算限制一轮安排的输入数量，缓存块大小描述历史状态的分配单位，两者见[调度器](vllm-scheduler.md)和[缓存规格](kv-cache-spec.md)。

## 通用后端选择与 GLM 专用绑定

通用的 `get_attn_backend_cls()` 根据 MLA、稀疏与压缩等标志选择后端，并为特定设备和 FA3 条件分流。[C8] 这是调用该接口的层所走的选择路径。

GLM 专用实现还存在直接绑定：IndexerKPoolMLA 的算子类直接指定 `AscendIndexerKPoolMLABackend`；KDA 算子提供 GDN 后端接口。[C9][C10] 因而不能在通用映射表中选一个名称，就把它当成 GLM 两类层的实际实现。完整连接与版本条件在[注意力后端](attention-backend-family.md)。

## 从配置结果继续读代码

读完本页可以沿三条具体结果向下追踪：`worker_cls` 进入 [Worker 启动](npu-worker-lifecycle.md)，缓存规格进入[状态池分配](vllm-kv-block-allocation.md)，后端类进入 Runner 的元数据构造与注意力执行。遇到组合被拒绝时，先找到相应校验及其输入；组合通过校验则只证明进入下一阶段，仍不等于模型已成功部署。
