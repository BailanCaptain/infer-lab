---
id: npugraph-ex
title: 编译图融合：改变算子边界与中间数据流
type: feature
summary: 解释编译器怎样识别计算片段、替换融合实现，以及 npugraph_ex、本地匹配器、静态 kernel 与图捕获之间的关系。
aliases:
- 编译期图融合
- 图融合 pass
- GraphFusionPassManager
- ascend_compilation_config
- enable_npugraph_ex
- enable_static_kernel
- enable_super_kernel
- static kernel
- super kernel
- fuse_qknorm_rope
- fuse_norm_quant
- fuse_muls_add
chapters:
- '16'
order: 50
sources:
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L278-L301
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/base_pattern.py#L41-L63
- vllm-ascend@db701c1f:vllm_ascend/compilation/graph_fusion_pass_manager.py#L36-L79
- vllm-ascend@db701c1f:vllm_ascend/compilation/passes/qknorm_rope_fusion_pass.py#L192-L230
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L71-L146
- vllm-ascend@db701c1f:vllm_ascend/compilation/compiler_interface.py#L149-L223
- vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L579-L640
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L589-L634
verified: []
evidence: C
relations:
- to: ops-and-kernels
  kind: builds-on
  note: 区分算子接口和具体 kernel
- to: graph-mode-layer
  kind: builds-on
  note: 理解编译优化与捕获的先后关系
- to: mlp-residual-norm
  kind: builds-on
  note: 理解归一化和残差的数据依赖
contradicts: []
updated: '2026-09-26'
origin: seed
---

## 中间张量也是执行成本

一个计算片段可以由多个[算子](ops-and-kernels.md)完成。若前一个算子把结果写入设备全局内存，后一个算子再读出它，除了数学运算，还会产生中间数据的存取与任务下发。

**算子融合**把符合条件的计算片段交给一个融合实现，尝试让中间结果在更近的存储或内部流水中继续使用。它保留所定义的计算关系，改变算子边界和数据流组织。融合还可能改变浮点计算次序，因此数值容差和支持范围仍需验证。

用一个抽象片段说明：输入张量有 T 行、H 列，操作 A 的输出只由操作 B 消费。若未融合路径完整写出再读入这个中间张量，元素占 s 字节，这部分存取量为 `2×T×H×s`。[A] 融合实现可能省去这次往返，但实际收益取决于 kernel 的内存访问，而不是仅由节点数量决定。

```wiki-diagram
file: npugraph-ex
```

例如 T=4、H=8、s=2 时，中间张量占 64 B，一写一读共 128 B。[D] 这是用于理解数据流的缩小例子，未描述某个 GLM kernel 的实测访存量。

## 从计算图中识别可替换片段

编译器接收算子及其张量依赖组成的计算图。融合规则包含待匹配的 pattern 和替换实现；匹配还可能要求特定精度、维度、参数和连接方式。两个操作在代码中相邻，不代表它们一定满足融合规则。

固定 Ascend 实现中的 Q/K 归一化与 RoPE 融合，先检查 BF16、可发现的 Attention 层及特定 head size，然后注册候选 pattern；实际图匹配另记录 `matched_count`。[C4] 配置打开、pattern 已注册、某层匹配成功是三个不同状态。GLM 的自定义注意力和 mHC 路径也需要检查真实算子图，不能只用隐藏维度推算全模型命中次数。

## 两条编译路径怎样协作

固定 Ascend 编译器按配置选择外部 npugraph_ex 路径或本地融合路径。[C1] 本地 pass manager 组织归一化量化、Q/K 归一化与 RoPE 等规则，按适用范围运行。[C3]

规则注册同时连接 PyTorch 的 pattern matcher 与外部后端的 replacement 接口。[C2] 因此关闭 `enable_npugraph_ex` 只改变这一编译入口的选择；具体融合还受各 pass 的开关、模式和图匹配结果影响。外部后端也有自己的实现与版本条件，不能把本地规则数量当成所有优化的总数。

这一步与 [ACL Graph](acl-graph.md) 的作用不同：融合改变图中的计算片段；捕获与回放复用执行组织。两者可以先后发生，也可能因所选执行模式而采用不同路径。

## 静态 kernel 进一步依赖执行形状

固定配置提供 `enable_static_kernel`，要求同时启用 npugraph_ex，并为指定尺寸准备静态 kernel。[C7] 编译接口用捕获尺寸与 decode query 长度筛选编译范围；MTP 等配置改变 query 长度时，范围也随之变化。[C5]

这会增加启动或编译缓存成本；支持的尺寸越多，准备工作也可能越多。它不是给所有可能输入预先生成一个通用最快 kernel。本文固定源码未提供 `enable_super_kernel` 的实现，其他分支的同名配置应按其独立版本阅读。

## 固定配置下的限制

本页使用[GLM 来源基线](../sources/glm-5-3-flash-baseline.md)中的 Ascend 固定源码。其平台逻辑在 NONE 或需要 piecewise 编译的模式下关闭 npugraph_ex，310P 还会关闭该后端及静态 kernel。[C7][C8] 字段的默认值不能直接代替最终运行配置。

该编译接口明确关闭 reinplace 相关优化，以避免某些操作回退 CPU 带来的问题；不能据外部后端的一般能力认定当前路径启用了原地恢复。[C5] npugraph_ex 导入失败时有 torchair 兼容分支，这条分支处理的是依赖导入问题，不是对任意编译错误的性能兜底。[C6]

评价融合需要同时看匹配结果、张量访问、数值与端到端耗时。减少两个节点可以帮助解释优化方向，但不足以承诺两次 Host 下发或固定比例的推理时间一定被省去。
