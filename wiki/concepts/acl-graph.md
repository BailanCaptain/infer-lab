---
id: acl-graph
title: ACL Graph：捕获、批形状与重复执行
type: feature
summary: 从 Host 下发开销出发，解释稳定缓冲、批描述符、补齐与三种执行路径，以及捕获和回放各自的成本。
aliases:
- ACLGraph
- ACL 图
- cudagraph_mode
- cudagraph_capture_sizes
- FULL_DECODE_ONLY
- FULL_AND_PIECEWISE
- npugraph_ex
- 图捕获与回放
chapters:
- '16'
order: 40
sources:
- vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L170
- vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L185-L258
- vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L276-L328
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5269-L5299
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2778-L2835
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L570-L644
verified: []
evidence: C
relations:
- to: graph-mode-layer
  kind: builds-on
  note: 先区分编译图优化、捕获和回放
- to: concurrent-requests
  kind: builds-on
  note: 理解每轮变化的请求数与 token 总数
- to: npu-model-runner
  kind: builds-on
  note: 了解输入缓冲、元数据和执行模式的组织
contradicts: []
updated: '2026-09-26'
origin: seed
---

## 重复前向为什么还会有 Host 开销

模型前向由矩阵乘、归一化、注意力等操作组成。普通执行中，CPU 上的运行时不断准备并下发设备任务；当每轮设备计算较短时，这些下发间隔也会占据明显时间。[图模式](graph-mode-layer.md)把可重复的执行序列捕获下来，再通过回放提交后续工作。模型仍计算本轮输入，历史状态也继续更新。

ACL Graph 是这里的 Ascend 捕获与回放实现。它继承模型的计算依赖，改变的是运行时组织任务的方式。编译器可能先优化算子图；捕获记录随后实际执行的设备任务；回放再复用捕获结果。这三个阶段有不同的输入和成本。

本页按[模型与双机来源基线](../sources/glm-5-3-flash-baseline.md)固定的 Ascend 源码解释通用运行机制。GLM 的具体执行模式还受混合注意力、MTP 和并行配置约束。

## 稳定的是执行结构，输入内容可以变化

捕获时需要保存输入缓冲地址、执行序列和输出所在的空间。回放前，新 token 编号、位置及相应元数据写入这些可复用缓冲。因而两轮可以共用执行结构，同时读取不同的数据、产生不同的输出。

固定实现用 **batch descriptor（批描述符）**管理捕获条目：运行模式不匹配时调用原始执行函数；需要捕获时建立条目，回放时复用图和输出引用。调试模式还检查输入地址是否与捕获时一致。[C1][C2] 捕获图没有替请求保存整个会话语义；历史内容仍由缓存和本轮元数据表达。

真实批次持续变化。假设某条路径预先捕获了总 token 数为 4 和 8 的档位，本轮有 6 个实际位置，且其他条件满足对应图的要求，则可以补齐到 8 个位置。[A] 有效位置仍为 6，额外的 2 个位置用于满足执行形状；有效输出由运行器选取。

```wiki-diagram
file: acl-graph
```

这个例子只解释尺寸补齐。实际描述符还包括请求形状、是否为适合该图的 decode 批、LoRA 状态等信息；不能仅根据 `6≤8` 判断一定回放。固定运行器还会进行跨 DP 的尺寸与模式协调，必要时重新分派。[C4]

## FULL、PIECEWISE 与普通执行

三种运行路径分别表示：

| 路径 | 复用的执行范围 | 本轮仍需做的事 |
|---|---|---|
| FULL | 捕获范围内的完整模型执行序列 | 准备输入、元数据并满足该图的约束 |
| PIECEWISE | 编译切分后的若干片段 | 片段间的操作继续按各自路径执行 |
| NONE | 本轮不回放这些捕获图 | 按普通运行方式执行模型 |

PIECEWISE 同样包含图回放。它放宽部分整图约束，代价是仍有片段边界和相应的运行时工作。

固定分派器优先查询允许使用的 FULL 描述符，再尝试 PIECEWISE 的较宽松描述符；超过捕获上限、尚未初始化 key 或没有匹配项时，按条件返回 NONE。[C3] 因此“启用了图模式”描述的是可用能力，本轮实际选择还由输入和支持条件决定。

带 MTP 等投机路径时，若每请求都恰好调度相同数量的 token，仍要辨别这些位置属于 prompt 还是 decode。固定运行器额外检查 prompt 进度，防止最后一个 prefill 块因形状相似而使用 decode 图。[C4] 模型含多个注意力后端时，图模式解析还要考虑各后端的支持等级。[C5]

## 动态注意力参数如何参与回放

查询长度、已计算位置和块表会随请求变化。某些后端通过稳定张量缓冲传递这些数据；另一些路径还需要更新已捕获的算子任务参数。

固定运行器中的通用 FULL 参数更新路径只在相应模式、非捕获阶段且非 sparse/compress 路径下执行；`enable_enpu` 还会改变更新与模型调用的先后顺序。[C6] GLM 包含稀疏 MLA，其具体后端执行依据见[注意力后端](attention-backend-family.md)。这里的通用更新函数不能覆盖所有模型层。

## 复用执行需要付出什么

捕获增加启动工作与设备内存需求；更多尺寸、模式和适配器组合可能产生更多条目。补齐也会扩大部分计算或缓冲范围。在上面的教学例子中，位置数从 6 增加到 8，增加了 `2/6≈33.3%` 的位置，但整体耗时不按这个比例增长。[D]

回放还要满足流和事件的顺序。固定 Wrapper 在部分 FULL 路径回放前同步当前流，避免上一轮执行与下一轮参数更新交错。[C2] 最终收益取决于减少的 Host 开销、设备工作量、补齐成本和同步等待。

固定平台会按模式处理编译与切分配置，并拒绝 `ASCEND_LAUNCH_BLOCKING=1` 与图模式同时使用。[C7] 排查时可对比普通执行，但不能将某次图模式配置视为所有模型、尺寸和设备的性能保证。
