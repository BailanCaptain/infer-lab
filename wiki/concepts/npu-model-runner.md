---
id: npu-model-runner
title: NPUModelRunner：组织批次、模型前向与采样交接
type: concept
summary: NPUModelRunner 将调度计划转成设备输入，管理本轮模型执行及跨调用中间结果，再将采样结果映射回请求。用 A/C 四输入、两预测行的例子连接张量形状与接口职责。
aliases: [NPUModelRunner, model runner, execute_model, sample_tokens, logits_indices, ExecuteModelState]
chapters: ["09"]
order: 40
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2030-L2067
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2327
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2350-L2427
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5041-L5063
verified: []
evidence: "C"
relations:
  - {to: prepare-inputs-flow, kind: builds-on, note: 先明确 token、位置、边界与状态映射的含义}
  - {to: glm-5-3-flash, kind: builds-on, note: Runner 调用的是已构建的 GLM 模型，各层计算由模型实现组织}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## Runner 处在计划与模型之间

Scheduler 的输出描述本轮处理哪些请求和位置，模型的输入则是张量及元数据。Runner 承担两者之间的转换，并组织执行模式、模型调用、结果选行和采样交接。它不负责决定服务中所有请求的全局调度顺序，也不重新定义 GLM 的层结构。

```wiki-diagram
file: model-runner-layout
```

Worker 持有 Runner 并调用它；Runner 又使用模型、注意力后端和其他执行组件。组件之间的委托关系与进程划分不同，见[进程与执行器](engine-processes.md)。

## 更新持久状态，再准备本轮输入

收到新计划后，Runner 更新请求状态和持久批次；Ascend 实现先执行特定异步回退检查，再委托父类进行状态更新。[C1] 新加入、完成、恢复或重排的请求，都需要与批次映射一致。

本轮没有实际输入时，执行函数存在相应返回路径，不会无条件准备一整批张量再跑模型。[C2] 有输入时，准备 token 编号、位置、边界、槽位和注意力元数据；真实执行还可能有填充和其他布局调整。

持久对象与临时张量的生命周期不同。权重、缓存和请求记录跨轮存在；本轮激活及部分执行中间信息在使用结束后可被覆盖或释放，不能据此推断所有状态都每轮重建。

## 四个输入怎样形成两行预测

沿用[输入准备](prepare-inputs-flow.md)中 A/C 第三轮：A 一行，C 三行，共 T=4。这里忽略填充、投机、多模态输入及分布式分片，按模型逻辑形状说明。[A]

| 位置 | 逻辑形状 | 含义 |
|---|---|---|
| token 编号与位置 | `[4]` | 四个本轮输入位置 |
| 嵌入后普通隐藏宽度 | `[4,4096]` | 每位置的输入表示 |
| GLM 层内残差表示 | 带四路的隐藏表示 | mHC 层内连接见模型介绍 |
| 模型最终输出表示 | `[4,4096]` | 层栈和末端汇合/归一化后的逻辑表示 |
| 选择行 0、3 | `[2,4096]` | A 与 C 分别用于下一个 token 预测 |
| 输出头 logits | `[2,154880]` | 每个请求一行词表分数 |

4096、154880 与四路残差来自[模型固定配置及总览](glm-5-3-flash.md)。固定执行代码先完成模型前向，再通过 `logits_indices` 选取隐藏表示并调用输出头。[C3] 所以四个输入位置不要求为它们全部保留四行用于生成的词表 logits。

两行 logits 共有 `2×154880=309760` 个元素。[D] 这是逻辑元素数，不是 FLOPs、实际 NPU 内存峰值或跨 TP rank 的具体存储形状。物理张量还受输出头分片和实现路径影响。

## 前向和采样为什么可以分开

固定 Ascend 实现把 logits、调度结果及其他本轮信息保存在执行状态对象中，后续 `sample_tokens` 使用该状态，处理采样并清理这份交接状态。[C4] 分离接口便于在前向之后接入采样约束等逻辑，不意味着每个接口都再次运行模型层栈。

普通生成按请求采样；未完成 Prefill 的请求不能把中间位置当作最终提示词预测；投机验证还需要处理多候选接受与状态提交。相关条件见[分块 Prefill](chunked-prefill.md)和[投机解码](speculative-decoding.md)。

PP 非末阶段可返回中间张量，pooling 模型也有不同返回路径。[C3] 本页以 GLM 文本生成解释主线，接口的全部分支不应硬套“一次调用必返回一个 token”。

## 各类注意力如何获得自己的元数据

GLM 的稀疏 MLA 与 KDA 所需状态不同。Runner 按缓存组中的层获取注意力后端，并结合后端身份和缓存规格组织分组。[C5] 这使同一批请求的共同信息能够转成各后端需要的元数据。

从总体计划到后端输入的关系是：请求与位置安排 → 通用批次信息 → 按层/缓存组的后端元数据 → 模型层实际调用。Backend 的具体数学机制在[注意力后端](attention-backend-family.md)继续展开。

## 怎样阅读这个较大的实现文件

阅读顺序可以围绕一组已知输入组织：先确认请求状态更新，再核对本轮输入与模式选择；随后跟踪模型返回值、预测行索引及采样输出。[A] 初始化、缓存分配、图捕获和实际每轮执行属于不同生命周期，不宜把源码中的函数排列顺序直接当作运行顺序。

本页基于 Ascend `db701c1f` 的执行代码；上游安装、有效默认值及设备结果仍以[来源基线](../sources/glm-5-3-flash-baseline.md)的核实范围为准。
