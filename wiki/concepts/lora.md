---
id: lora
title: LoRA：低秩更新与多适配器推理
type: feature
summary: 从线性层的低秩更新解释 LoRA，再连接适配器槽位、批处理与昇腾执行路径。
aliases:
- LoRA
- LoRA 适配器
- 低秩适配
- Low-Rank Adaptation
- Multi-LoRA
- 多 LoRA
- 多租户适配器
- PunicaWrapperNPU
- punica
- bgmv
- sgmv
- LoRARequest
- enable-lora
- lora-modules
chapters:
- '17'
sources:
- https://arxiv.org/abs/2106.09685
- vllm@0fc695fc:vllm/lora/model_manager.py#L273-L308
- vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L15-L49
- vllm@0fc695fc:vllm/lora/punica_wrapper/utils.py#L54-L115
- vllm@0fc695fc:vllm/lora/layers/base_linear.py#L99-L145
- vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L589-L602
- vllm-ascend@db701c1f:vllm_ascend/platform.py#L861-L862
- vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L21-L104
- vllm-ascend@db701c1f:vllm_ascend/lora/punica_npu.py#L324-L410
- vllm-ascend@db701c1f:vllm_ascend/lora/utils.py#L74-L88
- vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2945-L2964
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/lora.md#L9-L30
verified: []
evidence: C
relations:
- to: matmul-and-weights
  kind: builds-on
  note: 先理解线性层输入、权重与输出形状。
- to: concurrent-requests
  kind: builds-on
  note: 不同适配器的请求可以共同组成执行批。
- to: acl-graph
  kind: builds-on
  note: 适配器状态参与捕获图分派。
contradicts: []
updated: '2026-09-26'
origin: seed
---

## 从完整权重更新到低秩更新

线性层用权重 W 将输入映射到输出。全参数微调可以把 W 改成 `W + ΔW`；LoRA 保留基座 W，把更新量约束为两个较小矩阵的乘积 `ΔW = sBA`，只训练这些附加参数。[S1] 这里低秩的是更新量，基座矩阵仍然存在。一个模型适配器通常包含多个目标层的多对 A、B，并不是整个模型只有两个矩阵。

采用行向量输入，设输入宽度为 `d_in`、输出宽度为 `d_out`、秩为 r：

`y = xWᵀ + s(xAᵀ)Bᵀ`

其中 `W: [d_out, d_in]`，`A: [r, d_in]`，`B: [d_out, r]`。基座分支照常计算；旁路先把输入映射到 r 维，再映射回输出宽度，最后按比例 s 加到基座结果上。适配器参数量是 `r(d_in + d_out)`，完整权重更新需要 `d_in × d_out` 个参数。[D]

```wiki-diagram
file: lora
```

## 一个可以手算的线性层

取 `d_in = 4`、`d_out = 3`、`r = 1`、`s = 1`，输入与适配器为：[A]

`x = [2, 1, 1, 0]`，`A = [1, 0, −1, 0]`，`B = [1, 2, −1]ᵀ`。

先得到 `xAᵀ = 2 − 1 = 1`，因此更新分支输出 `[1, 2, −1]`。若基座分支结果是 `[3, 4, 5]`，相加后得到 `[4, 6, 4]`。[D] 这对适配器有 `4 + 3 = 7` 个参数，完整更新有 `4 × 3 = 12` 个参数。大维度、小秩时比例差距更明显，但更低的秩也限制可表达的更新空间。

## 多个请求怎样共享基座

同一个服务实例可保留基座的既有并行布局，同时为不同请求选择不同适配器。所有输入行都要经过基座计算；带适配器的行额外计算对应更新，无适配器的行将更新视为零。不能把两条分支画成互斥路径。

vLLM 区分适配器 ID、设备槽位和逐 token 行映射。管理器将已激活适配器放入槽位，再将请求所用 ID 转换为计算所需槽号；无适配器行使用 `−1`。[C2][C4] 相邻行使用同一槽位时，还可以按连续段组织执行。[C3]

例如某批四行映射为 `[0, 1, 0, −1]`：四行全部计算基座输出，第 1、3 行加槽 0 的更新，第 2 行加槽 1 的更新，第 4 行保持基座输出。[A] 这个映射不要求同一适配器只能出现在一段连续位置。

设备端张量按允许适配器数、最大秩及分片形状等条件预留。[C5] 每批活跃适配器名额与 CPU 侧注册、缓存容量是不同限制；调度器达到 `max_loras` 后，暂时跳过需要引入新适配器的请求。[C6] 限制的是本轮适配器集合，不是把所有 LoRA 请求逐个串行执行。

## 昇腾如何执行低秩旁路

平台提供 NPU 的适配器执行包装类，层替换机制把受支持线性层接入相应实现。[C7][C10] 普通 dense 路径中，prefill 可按段执行 SGMV，decode 可逐行执行 BGMV；310P 或最大秩达到 128 等条件下选择基于 PyTorch 操作的回退。[C8] 两者都计算低秩旁路，区别在行如何分组、矩阵怎样被索引和执行。

MoE 路径还要把适配器索引与专家索引组合起来，对已展开的专家输入行计算更新，并结合路由权重。[C9] 这建立在[MoE](moe.md)的 token 到专家分派之上，比普通线性层多一层索引关系。图执行也受影响：固定 Runner 的分派条件同时包含是否有 LoRA 和活跃适配器数量。[C11]

## 能力边界与成本

本页固定 `vllm-ascend@db701c1f` 和上游 `0fc695fc`。该版本文档对 MoE 的 LoRA 仍列出 EP、量化相关限制。[S12] 因而，GLM 主线的量化 MoE 与并行部署不能直接作为 LoRA 已支持、已验证的案例；线性层公式成立，也不等于对应模型全部目标模块已被适配。

LoRA 节省的是每个任务需要另存的更新参数。服务仍需存储和计算基座，还要为适配器槽位、低秩中间结果与混批索引付出额外成本。增加秩或同批适配器种类，会影响容量、执行效率和可复用图形状；本页缩小例子只计算参数与数值，不给出 NPU 性能结论。
