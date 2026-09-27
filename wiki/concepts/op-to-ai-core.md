---
id: op-to-ai-core
title: 从 RMSNorm 到设备 kernel：分派、融合与分块
type: concept
summary: 沿 GLM 的 RMSNorm 追踪实际设备接口，再用可选的残差融合分支解释 Host tiling 与设备核函数，区分数学语义、数据访问和性能证据。
aliases: [算子链路, AscendRMSNorm, AscendGemmaRMSNorm, npu_add_rms_norm_bias, AscendC, op_kernel, op_host, tiling, tiling key, UB, 算子四层]
chapters: ["16"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2129-L2169
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L110-L207
  - vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L452
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L19-L108
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.cpp#L23-L71
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L155
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L167-L208
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/add_rms_norm_bias_torch_adpt.h#L21-L50
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L208-L222
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L373-L411
verified: []
evidence: "C"
relations:
  - {to: ops-and-kernels, kind: builds-on, note: 先区分算子接口与设备核函数}
  - {to: mlp-residual-norm, kind: builds-on, note: RMSNorm 的数学定义与残差结构}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从一行隐藏表示开始

RMSNorm 对一行长度为 H 的向量先计算均方，再按倒数平方根与逐通道权重缩放。设输入为 x、权重为 γ：

```text
r = 1 / sqrt(sum(x[j]²) / H + ε)
y[j] = x[j] × r × γ[j]
```

输出仍有 H 个元素。跨通道归约得到一个缩放因子，之后对每个元素应用它。它的计算结构与矩阵乘不同，不能因都运行在 NPU 上就假定都使用同一计算单元。数学解释见[RMSNorm 基础](mlp-residual-norm.md)。

```wiki-diagram
file: op-to-ai-core
```

## GLM 实际从哪里调用 RMSNorm

GLM 每个 Decoder 层构造输入与注意力后两个 RMSNorm。在固定 mHC 路径中，`hc_pre` 得到子层输入，代码再以单个张量调用 `input_layernorm(layer_input)`，没有把 residual 作为第二个参数传入。[C1][C2]

Ascend 把 `RMSNorm` 注册为 `AscendRMSNorm`。在相应 CustomOp 设备路径启用时，调用进入 `forward_oot`；这个无 residual 分支执行 `torch_npu.npu_rms_norm`。[C3][C4][C5] 子层以外还有其他归一化和状态处理，因此不能仅用“层数乘二”推断完整前向的 kernel 总数。

这条主路径到已有设备接口为止。下面另看同一类中的**可选残差融合分支**，用于理解仓库内可读的 Host 与 kernel 源码；它不代表上述 GLM mHC 调用走了这个分支。

## 融合分支改变的是执行组织

若给该类同时传入 x 和 residual，目标可以写成：

```text
s = x + residual
y = RMSNorm(s) + bias     # bias 可为空
返回 y 与更新后的残差 s
```

固定源码有两条实现：自定义扩展可用时调用 `npu_add_rms_norm_bias`；否则调用已有的 `npu_add_rms_norm`，有 bias 时再执行加法。[C5]

融合将相邻运算放到共同的执行单元中，可减少单独下发和中间结果的重复访问。但需要返回给后续层的残差 s 仍要保存，不能说融合后所有中间数据都留在片上，也不能仅凭源码承诺速度提升。批不变性模式和特定设备会影响扩展启用；扩展加载也有失败路径。[C6]

## Host tiling：把张量任务划给设备

Python 调用扩展后，C++ 适配层先分配归一化输出、缩放统计量和更新后的残差张量，再以 `EXEC_NPU_CMD(aclnnAddRmsNormBias, ...)` 接入设备算子执行流程。[C11] 输出分配、Host 规划和设备计算分别承担不同工作。

**tiling（分块规划）**根据张量形状、精度和设备约束，决定工作划分与核函数选择。Host 侧生成参数，设备 kernel 读取参数后处理自己的部分。它不负责算出最终归一化结果。

该扩展的 tiling 源码区分 FP16、FP32、BF16，并定义多种行列分块方式与相应阈值。[C7] 它读取实际核心数和 UB 容量，再结合形状、精度及偏置条件选择分块。[C12][C13] 阈值反映该实现对临时空间和处理方式的选择，不是整颗 NPU 的固定内存容量。修改输入宽度或精度可能改变所选分块方式。

kernel 入口读取 tiling 数据，根据 key 选择模板。[C8] key 是实现内部的分派编码，解释计算时应先读它对应的精度与分块含义，无需记住每个数字。

## 设备侧：搬入、归约、缩放、写回

该扩展的普通模板按块组织 `CopyIn → Compute → CopyOut`。输入从设备全局内存搬到片上局部缓冲区，计算残差相加、平方和、倒数平方根和缩放，再写出结果。[C9][C10]

**设备全局内存**保存较大的张量；**片上局部缓冲区**容量较小，用于当前任务的临时数据。数据不能一次全部放入局部缓冲区时，需要分块并管理访问顺序。这里的归约和逐元素计算由所选核函数实现；详细硬件分工见 [AI Core](ai-core.md)。

一个可复算的容量对照：取 GLM 隐藏宽度 H=4096，以 BF16 保存一行占 `4096 × 2 = 8192` 字节，即 8 KiB。[D] 若某实现把这一行单独写出后再读入，仅该中间张量就有 16 KiB 的逻辑读写量。这个数不含其他输入输出、缓存命中与访问合并，也不是测得的总线流量或延迟。它只说明为什么减少一次中间访问值得研究。

## 怎样判断优化是否成立

先确认输入输出语义和数值误差要求，再看实际分派、精度、布局和 tiling；最后测量设备时间、内存访问与端到端影响。算子融合可能减少访问与下发，也可能增加局部存储压力或限制可用形状。无设备阅读能确定路径与公式，不能验证某个 kernel 比另一个快多少。
