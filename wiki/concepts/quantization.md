---
id: quantization
title: 权重与激活量化：表示范围、存储和计算
type: feature
summary: 从浮点数映射到整数的算例出发，区分离线权重转换、运行时激活量化以及真实的容量和精度代价。
aliases: [量化, Quantization, W8A8, W8A8_DYNAMIC, INT8, ModelSlim, quant_model_description.json]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L95-L138
  - vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L171-L214
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/registry.py#L19-L49
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L82
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L108-L157
verified: []
evidence: "C"
relations:
  - {to: matmul-and-weights, kind: builds-on, note: 量化改变矩阵操作数的数值表示}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 同一个矩阵，可以用不同精度保存

[矩阵乘与权重](matmul-and-weights.md)中的线性层计算 `Y=XW`。W 是长期保存的模型参数，X 是当前批次的输入激活。量化为这些数选择较低位宽的表示，并保存恢复数值尺度所需的参数。

例如 BF16 每个元素占2字节，INT8 每个整数占1字节。把适合量化的权重存成 INT8，可以减少其存储和读取载荷，但整数所能表示的值更少。量化需要在表示范围和精细程度之间取舍，误差也会进入后续计算。

W8A8 表示相应算子的权重和激活操作数采用8位量化表示。累加器、缩放参数和输出可以采用其他格式；它不意味着模型中所有张量都变成8位。

## 用缩放系数连接整数和实数

先考虑对称量化，零点为0。给定正的缩放系数 s，量化与近似恢复为：

`q = clamp(round(x/s), −128, 127)`

`x̂ = s×q`

取 s=0.1，x=0.26 对应 q=3，恢复值为0.3；x=13对应130，超过上限后成为127，恢复值12.7。[A][D] 前者是舍入误差，后者还包含截断误差。带零点的方案会增加偏移项。

不同张量、输出通道或分组可以使用不同尺度。尺度划分越细，通常需要保存更多元数据；某种划分是否适合模型，还取决于数值分布和对应算子支持。

```wiki-diagram
file: quantization
```

## 离线权重转换与运行时激活量化

模型权重可以在部署前转换并保存为量化 checkpoint。静态激活量化也可以用校准数据预先确定尺度，再由推理引擎在运行时把输入激活转换成整数。动态激活量化则根据当前输入计算尺度；固定 Ascend 的动态 W8A8 路径在前向中调用 `npu_dynamic_quant(x)`。[C4]

设一个输出值为 `y=Σ xᵢwᵢ`。在忽略零点的简化条件下，量化计算近似为：

`ŷ = sₓs𝑤 × Σ qₓᵢq𝑤ᵢ`

整数乘加得到中间结果后，需要恢复尺度。固定静态 W8A8 实现把相关缩放参数交给量化矩阵乘算子，并指定输出 dtype；缩放可以融合在算子内部完成。[C5] 输出张量是浮点格式，也仍包含低精度操作数带来的近似误差。

静态方案减少了运行时求尺度的工作，动态方案适应当前激活范围；哪一种在特定模型上更快或误差更小，需要结合算子和评测确定。

## 容量节省怎样计算

假设一个权重矩阵恰好有 `2²⁰` 个元素：[A]

| 表示 | 权重主体 | 另需计入 |
|---|---:|---|
| BF16 | 2 MiB | 该实现需要的其他参数 |
| INT8 | 1 MiB | scale、offset、可能的填充或重排 |

这是同一矩阵的存储对比。[D] 整个模型要逐项求和：已量化张量按实际格式计算，未量化层仍按原格式计算。GLM 的[专家结构](moe.md)、共享专家、注意力和词表等部分不能只按一个“W8A8”名称统一减半。

设备端还可能为权重重排、激活量化及算子执行分配工作区。权重主体减少1 GiB，并不自动证明 KV 预算增加1 GiB；[显存探测](kv-cache-memory-profiling.md)还要重新测量运行开销。

量化也可能减少计算阶段的权重读取量。实际带宽收益取决于缓存、批内复用、专家选择和算子融合，不能把单 token 的激活参数量直接当作每一步的设备总流量。

## Ascend 如何选择具体实现

固定源码优先探测模型目录里的 `quant_model_description.json`，也识别配置中的 compressed-tensors 信息，并包含限定硬件的 FP8 检测分支。[C1] 用户显式指定的量化方式与检测结果不一致时，这个更新函数发出警告并保留用户值；是否能加载仍取决于后续配置和建层检查。[C2]

描述文件确定具体层使用的方案；注册表再用“量化类型、层类型”这一对键寻找实现。[C3] 因此普通线性层、MoE 层或注意力缓存的支持需要分别确认。一个模型有可加载的量化 checkpoint，不代表所有方法都可任意组合。

GLM 教学主线采用[来源基线](../sources/glm-5-3-flash-baseline.md)固定的模型与部署材料。更换权重精度时，需要记录 checkpoint、描述文件、Ascend/vLLM版本、硬件和精度评估结果；本页未验证另一套 GLM 量化部署。请求历史的压缩涉及不同数据和读写位置，接着看[缓存量化](kv-cache-quantization.md)。
