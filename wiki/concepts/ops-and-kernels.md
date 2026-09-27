---
id: ops-and-kernels
title: 算子与 kernel：从数学语义到设备实现
type: feature
summary: 区分模型运算、框架算子与设备核函数，解释 CustomOp 分派、torch_npu 与自定义扩展的关系，并追踪 GLM 的实际算子入口。
aliases: [ops, register_ascend_customop, aclnn, csrc, torch_npu, 自定义算子, _C_ascend]
chapters: ["16"]
order: 10
sources:
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L110-L207
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L690-L768
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L101-L120
  - vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2129-L2169
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235
  - vllm-ascend@db701c1f:vllm_ascend/ops/__init__.py#L21-L54
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L452
verified: []
evidence: "C"
relations:
  - {to: matmul-and-weights, kind: builds-on, note: 先理解矩阵运算的输入输出}
  - {to: attention-backend-family, kind: builds-on, note: 后端使用设备算子执行具体计算}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 同一段数学计算有几层表达

[模型单层](layers-and-hidden.md)包含矩阵乘、归一化、注意力和前馈等运算。数学公式描述输入如何变成输出；软件还需要决定数据布局、设备实现、任务划分和下发方式。

**算子（operator）**是对一类运算的接口与语义约定，例如矩阵乘或 RMSNorm。**kernel（核函数）**是设备上执行具体任务的程序。一项算子可以启动多个 kernel；多个数学运算也可以融合到一个 kernel。因此“模型有多少个算子”和“设备启动了多少次 kernel”通常不是同一个数量。

```wiki-diagram
file: ops-layers
```

图把已有设备算子和仓库自定义扩展画成不同实现路径。自定义扩展不必是已有算子的下一级。

## 框架怎样把算子交给设备实现

vLLM 的 `CustomOp` 在构造时查询外部实现登记表，再根据启用条件和平台选择前向方法。外部平台路径使用 `forward_oot`；禁用对应设备路径时，可以改走 native 实现。[C1]

Ascend 的 `register_ascend_customop` 将 `RMSNorm`、线性层、激活函数等名称映射到设备实现，并用进程内标记避免重复登记。Worker 构造调用这项注册。[C2][C3] 这里的 CustomOp 是**框架的实现分派机制**，不等价于“每个登记项都是仓库自己编译的 C++ kernel”。

以 `AscendRMSNorm` 为例，不带残差输入时调用 `torch_npu.npu_rms_norm`；带残差时还会根据条件选择融合扩展或已有设备接口。[C4] 一个 Python 类里可以组织多种底层路径。

## 已有接口与自定义扩展各提供什么

`torch_npu` 将 PyTorch 计算接到 NPU 软件栈，提供设备张量与算子接口。仓库自定义扩展则把自身编译的实现登记到 `torch.ops` 等入口。Ascend 的扩展加载采用延迟初始化，以避免过早触发运行时；能否启用还受设备、批不变性和扩展是否成功加载等条件影响。[C8]

两类实现都需要处理形状、数据类型、布局、临时工作区和执行顺序。使用已有接口可以复用成熟实现；自定义实现可针对融合、特殊布局或新模型需求优化，但也增加构建、兼容和正确性验证成本。哪个路径更快，应由具体形状和设备上的测量判断。

## GLM 的两个具体入口

固定 GLM 专用代码构造输入 RMSNorm 与注意力后 RMSNorm。在 mHC 路径中，四路残差先经 `hc_pre` 合成子层输入，再调用 RMSNorm，子层结果经 `hc_post` 回到残差流。[C5][C6]

这里既有框架算子分派，也有显式设备扩展调用：`hc_pre` 和 `hc_post` 调用 `_C_ascend` 命名空间中的专用算子。[C5] 因此不能把模型计算概括为“都只调用现成 torch_npu 算子”或“所有层都由同一张替换表决定”。KDA 与稀疏 MLA 的调用关系见[后端页](attention-backend-family.md)。

本页只追踪源码入口。Python 中出现一个扩展名称不等于已经核实该扩展在专用镜像中的最终安装与运行情况，边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

## 占位和真实计算需要分开阅读

`register_dummy_fusion_op` 为若干融合名称创建占位对象，其 `default` 为 `None`。[C7] 这些对象支持注册或图处理路径识别名称，不能当成已经具有可执行 kernel 的证据。阅读调用链时还要继续查实际消费者，以及图改写或其他路径如何处理它。

追踪一个算子可按以下顺序：确定数学输入输出，找到模型调用点，确认最终类与方法分派，再进入底层接口或扩展。下一页用[归一化的实际路径](op-to-ai-core.md)演示，并用融合归一化作为内存访问的对照。
