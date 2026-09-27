---
id: vllm-ascend-repo-map
title: 源码目录地图：把文件放回推理架构
type: concept
summary: 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。
aliases: [目录结构, 代码结构, 仓库结构, repo map, vllm_ascend 目录]
chapters: ["20"]
order: 10
sources:
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L77
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L666
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2427
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L482
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2075-L2105
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L78-L84
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L545
verified: []
evidence: "C"
relations:
  - {to: vllm-ascend-overview, kind: builds-on, note: 先认识上游框架和设备适配的协作}
  - {to: request-call-chain, kind: builds-on, note: 用实际数据交接定位源文件}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 目录是职责的入口

阅读仓库之前，先明确要解释的是启动、调度、模型计算、状态管理还是通信。[框架总览](vllm-v1-shape.md)给出这些职责；目录地图将它们对应到源文件。目录大小和文件行数不表示一个组件在请求路径中的重要程度。

```wiki-diagram
file: vllm-ascend-repo-map
```

图中的运行时主线连接 EngineCore、Worker/Runner、模型和算子。启动配置与注册为它们提供实现选择；通信和图执行参与具体路径，不是每次请求额外依次经过的固定站点。

## 上游保留哪些职责

vLLM 的 `v1/engine` 组织引擎迭代，`v1/core` 中有调度与缓存管理，`v1/executor` 封装执行方式。一次迭代由 EngineCore 调度、提交执行并更新结果。[C8] 这些共同框架与 Ascend 插件协作；找完整调用链时需要同时打开两个仓库。

Ascend 的 `core/` 提供部分调度或资源机制适配，不能因名称相同就把它当成整个 EngineCore，也不能断言它完全没有运行时推理逻辑。阅读时以实际类、派生关系和调用点确定职责。

## Ascend 目录与学习问题

以下路径相对固定专用代码中的 `vllm_ascend/`；仓库根的 `csrc/` 另行标出。

| 路径 | 主要阅读问题 | 从哪里接入 |
|---|---|---|
| `__init__.py`、`platform.py`、`ascend_config.py` | 实现怎样注册，配置怎样检查和解析 | 插件发现与启动配置 |
| `worker/` | 设备如何初始化，调度结果怎样变成输入张量 | `NPUWorker`、`NPUModelRunner` |
| `models/`、`transformers_utils/` | 特定模型的结构与配置类型如何表达 | GLM 架构登记及 `glm5_next.py` |
| `attention/`、`ops/` | 各层怎样解释状态并执行设备计算 | 层的后端绑定、算子分派或直接调用 |
| `distributed/` | rank 与组怎样组织，数据怎样传递 | Worker 通信初始化、并行层与连接器 |
| `compilation/`、`xlite/` | 如何进行图变换与执行结构复用 | 配置选择、Runner 与图包装 |
| `patch/` | 哪些已加载的行为或登记表被适配 | 平台与 Worker 导入路径 |
| `model_loader/`、`quantization/` | 权重从哪里来，以何种布局解释 | 实际加载器与量化实现 |
| `spec_decode/`、`sample/` | 候选生成、验证与采样怎样执行 | 对应生成模式的执行路径 |
| `kv_offload/`、`simple_kv_offload/` | 状态在设备内外怎样搬运 | 所选卸载与缓存机制 |
| `_310p/`、`device/`、`device_allocator/` | 设备专用实现与资源分配 | 硬件条件和分配器选择 |
| 根目录 `csrc/` | 自定义设备扩展如何构建与计算 | `torch.ops` 等扩展调用 |

这是按职责组织的阅读索引，不是完整目录清单。某段功能可以跨多个目录，同一目录也可包含互斥的实现。

## 沿 GLM 执行路径读一组文件

先从 `worker/worker.py` 的执行入口看 Worker 接收什么，再进入 `worker/model_runner_v1.py` 的输入准备、模型前向和采样交接。[C3][C4] 对照[并发输入页](prepare-inputs-flow.md)，记录 token 行、位置与块表如何对应。

模型前向进入已注册的 GLM 类；`models/glm5_next.py` 负责选择混合层，并连接 mHC、注意力与前馈计算。[C5][C9] 进入具体层后再追 `attention/` 或 `ops/`。例如 GLM 的索引压缩注意力在 `ops/` 中包装注意力层并绑定后端，后端类则定义在 `attention/` 中；阅读时沿对象的构造和调用继续追踪。[C10][C11]

如果张量在设备间分片，接着读并行层与 `distributed/`；Worker 初始化为这些计算建立通信组。[C6] 若要解释某个算子为何走 Ascend 实现，回查 `utils.py` 的 CustomOp 登记和相应启用条件。[C7]

启动时的插件与平台准备则沿 `__init__.py → platform.py` 另行展开。[C1][C2] 把启动和运行时分开追踪，才不会把注册动作误写成每轮模型计算的一部分。

## 先确认正在读哪份代码

本页按[GLM 固定来源基线](../sources/glm-5-3-flash-baseline.md)定位 Ascend 专用代码，通用上游作为明确标记的参考。部署使用的已安装代码、源码工作树和某个社区发布分支不自动等价。

版本变化可能迁移文件或改变同名函数。稳定的阅读线索是职责、符号、输入输出与调用关系；行号用于定位某份固定快照。下一页给出[问题驱动的阅读方法](reading-vllm-ascend.md)，包括配置追踪、异常边界和版本对照。
