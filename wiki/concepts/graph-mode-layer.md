---
id: graph-mode-layer
title: 图执行：编译、捕获与回放分别做什么
type: feature
summary: 从逐算子下发说明图执行的动机，区分计算图改写与设备任务捕获，解释运行时分派、动态输入和 GLM 混合后端的适用边界。
aliases: [ACL Graph, ACLGraphWrapper, AscendCompiler, 图模式, graph mode, piecewise, xlite, 单算子模式, eager 模式]
chapters: ["16"]
order: 30
sources:
  - vllm@0fc695fc:vllm/config/compilation.py#L37-L69
  - vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L47-L68
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L65-L87
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L170
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L234-L258
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L719
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2910-L2967
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2778-L2835
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5330-L5340
verified: []
evidence: "C"
relations:
  - {to: npu-model-runner, kind: builds-on, note: Runner 决定本轮张量与执行上下文}
  - {to: ops-and-kernels, kind: builds-on, note: 先理解算子和设备任务下发}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从逐算子执行理解图的作用

模型的数学结构已经给定，运行时仍需把计算交给设备。eager 路径按执行进度调用算子，Host 侧安排设备任务。对于许多较短的计算，任务下发和调度开销可能成为延迟的一部分；具体占比依赖模型、批次和硬件。

设备图执行把可复用的一组任务捕获为图，之后通过回放重新提交。它复用执行组织，输入数据与输出结果仍随每轮计算变化。它也不把一次 Python 请求固定为一张图：请求经历多轮，批次同时服务多个请求。

```wiki-diagram
file: graph-mode
```

## 三个动作处理不同对象

| 动作 | 处理对象 | 改变或保留什么 |
|---|---|---|
| 编译与图改写 | 运算表示、形状约束及算子连接 | 可分解或融合运算，生成/选择执行实现 |
| 设备图捕获 | 一次受支持的设备任务序列及依赖 | 记录可复用的执行结构 |
| 回放 | 已捕获的图与本轮准备的数据 | 重新计算当前输入的结果 |

上游分别定义编译模式与 `CUDAGraphMode`；名字保留 CUDA 术语，Ascend 路径也使用该枚举。[C1] Ascend 编译接口中的 pass manager 处理计算图，ACLGraphWrapper 则负责捕获与回放。[C2][C3] 算子融合和图回放可以协同，但二者不是同一项优化。

## Eager、分段与完整图

`NONE` 表示不在该路径捕获/回放设备图；`PIECEWISE` 对支持的片段使用图；`FULL` 对目标执行范围使用完整图。分段允许部分动态或不支持捕获的运算留在图外，完整图要求整个目标范围满足执行约束。

还可以组合策略：`FULL_DECODE_ONLY` 对相应 Decode 批使用 FULL，其他批使用 NONE；`FULL_AND_PIECEWISE` 则搭配 FULL 与 PIECEWISE。[C1] 分段边界和可捕获范围由编译及后端实现决定，不固定为“所有注意力都在图外”。

图减少下发开销的同时，需要捕获时间、图存储及兼容的缓冲区管理。eager 也有设备、算子和形状限制，不能称为“任何形状都能跑”；某一模式的速度同样需要实际测量。

## 本轮怎样找到对应的图

Runner 根据本轮输入数量、是否符合 uniform decode、LoRA 状态及强制 eager 等条件调用 dispatcher，得到运行模式与 `BatchDescriptor`。必要时为受支持的尺寸补齐输入。[C7] token 总数相同，不足以独自证明两轮使用同一图。

沿用[并发例子](concurrent-requests.md)：一个批次有请求 A 的一个位置和请求 C 的三个 Prefill 位置，共四个输入。另一批可能由四个 Decode 请求各一个位置组成。两批都是四行，阶段与请求边界却不同；运行路径仍应根据实际条件分派。

`ACLGraphWrapper` 读取已准备的模式与 descriptor：模式不匹配就直接调用原执行体；匹配时查询条目。已有图则回放，没有图则在**允许捕获的上下文**中创建图，否则捕获合法性检查会拒绝。[C4] 因而不能说遇到任意新形状都会在服务时自动捕获。

## 回放之前仍要更新数据

图通常关联稳定的缓冲区地址，内容则需要写成本轮输入。Wrapper 本身不负责持久输入缓冲区或拷贝，它假定外部组件已经准备好；调试模式会检查输入地址是否一致。[C3][C5]

请求位置、长度、块表和后端元数据同样会变化。图执行必须保持它们与当前批次一致，不能把上一轮的状态当作当前输入。固定 Runner 有完整图参数更新路径，但它还带有 sparse/compress、ENPU 与捕获状态等条件。[C8] GLM 混合 KDA 与稀疏 MLA，具体更新和可捕获范围应逐个后端核对，不能直接套普通注意力路径。

## 启动准备与实际使用之间

Worker 在启动预热阶段按配置调用捕获入口；Ascend Runner 再接入相应捕获流程。[C6][C9] 捕获哪些尺寸由有效配置和支持范围决定，不是所有部署固定一份尺寸表。

实际批次到来后还要通过运行时分派。开启图模式、启动完成、某一轮成功回放是三个不同层次的证据。本库没有 NPU 实测，不把 GLM 的后续 Decode 轮数写成同等次数的图回放或收益数字。

进一步分析可接到 [ACL Graph](acl-graph.md) 的尺寸与分派机制，以及[编译期图融合](npugraph-ex.md)的运算改写。需要评估性能时，分别测量启动成本、回放适用比例、填充开销和端到端延迟。
