---
id: batch-invariance
title: 批不变性：相同输入为何会随同批请求改变结果
type: feature
summary: 从浮点归约顺序解释批间数值差异，再说明固定版本的算子替换、覆盖范围与验证层次。
aliases:
- Batch Invariance
- 批不变
- 批不变性
- 批次不变性
- batch_invariant_ops
- init_batch_invariance
- enable_batch_invariant_mode
- npu_mm_batch_invariant
- npu_fused_infer_attention_score_batch_invariant
- matmul_persistent
- 逐位可复现
- HCCL_DETERMINISTIC
chapters:
- '16'
order: 60
sources:
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L31-L73
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L76-L93
- vllm-ascend@db701c1f:vllm_ascend/batch_invariant.py#L99-L163
- vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L63-L98
- vllm-ascend@db701c1f:vllm_ascend/ops/triton/batch_invariant/matmul.py#L101-L140
- vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L428
- vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L3-L31
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/batch_invariance.md#L111-L134
verified: []
evidence: C
relations:
- to: matmul-and-weights
  kind: builds-on
  note: 矩阵乘包含大量乘积与归约。
- to: concurrent-requests
  kind: builds-on
  note: 同一请求可能在不同轮次与不同请求组成批。
- to: ops-and-kernels
  kind: builds-on
  note: 相同算子可选择不同 kernel。
contradicts: []
updated: '2026-09-26'
origin: seed
---

## 批的变化怎样影响数值

[连续批处理](concurrent-requests.md)允许请求进入和离开正在执行的批。即使某个请求的输入不变，它参与计算时的批形状也可能变化。矩阵乘和归约算子会根据形状选择执行方式，包括分块、并行划分和加法顺序。

实数加法满足结合律，浮点加法却需要在每一步舍入。考虑采用通常的“就近舍入，恰好居中时取偶数”规则的 float32，取 `a = 16,777,216`、`b = 1`、`c = −16,777,216`。[A] 两种分组得到：

- `(a + b) + c = 16,777,216 − 16,777,216 = 0`。第一步的真实结果落在两个可表示数之间，被舍入回 a。
- `a + (b + c) = 16,777,216 − 16,777,215 = 1`。这里两个中间结果都能表示。[D]

```wiki-diagram
file: batch-invariance
```

这个例子证明执行顺序能够改变结果，并不是模型的实测误差。模型经过多层计算后，数值差异可能影响 logits；当两个候选分数接近时，连贪心采样也可能选出不同 token。固定随机种子只能控制相关随机过程，不能自动消除计算路径差异。

## 批不变性要固定的是计算路径

批不变性的目标是在支持范围内，使同一个输入的结果不因同批其他请求变化而改变。实现需要约束具体算子的分块和归约方式，同时检查通信、融合、注意力等其他可能改变数值组织的环节。

在 `vllm-ascend@db701c1f` 中，初始化检查可用的 Triton 实现与 AscendC 批不变库，再按条件注册替换。它不是把所有矩阵乘统一替换为同一个 Triton kernel。[C1][C3]

| 条件或算子 | 固定版本的处理 |
|---|---|
| AscendC 批不变库可用 | 优先为 `mm/matmul/sum` 及部分注意力、归一化路径提供替换 |
| 无 AscendC 库，但 Triton 可用 | 为 `mm/matmul/linear` 使用 Triton 回退实现 |
| Triton 可用的其他分支 | 替换 `addmm/bmm/softmax` 等路径 |
| 两种实现均不可用 | 发出警告，跳过批不变算子注册 |

Triton 矩阵乘回退是一个具体例子：使用固定的 `128 × 128 × 64` 分块参数，并沿 K 方向累加。[C4][C5] 这些数字属于这个实现，不能推广为 AscendC 库或整个模型的共同规格。

初始化还关闭权重 NZ 模式与 matmul-allreduce 融合，并设置 HCCL/LCCL 确定性选项。PyTorch 确定性算法设置使用 `warn_only=True`，遇到相关限制时可以警告，而非一律中止。[C2] 开关代表一组有覆盖边界的执行约束，不能当作任意模型、设备和软件版本的数值保证。

## GLM 主线需要逐条确认覆盖

部分路径通过 `enable_custom_op` 判断是否启用自定义算子；批不变模式会让这个门禁返回关闭。[C6] 但直接调用自定义算子的路径并不经过这个门禁。例如固定 GLM 实现的 mHC 前后处理直接调用扩展算子，不能据此推断它们已被全部替换。[C7] KDA、稀疏 MLA 及其通信路径的覆盖也需要单独验证。

固定文档将功能列为 A2/A3 上的 beta，验证列表是若干 Qwen3 模型，并列出 FULL/FULL_DECODE_ONLY 图模式限制和可能的性能损失。[S8][S9] 这不足以证明 GLM 主线具有端到端批不变性；本页没有设备验证结果。

## 怎样判断验证结论覆盖到哪里

比较生成文本，能够判断测试条件下 token 序列是否相同；比较 logits 张量，才能检查对应位置的数值误差或逐 bit 一致性。两者应分别记录。还应固定模型、权重、输入、采样设置与软件版本，只改变同批请求及批形状，才有条件把差异归因到批变化。

执行更固定的 kernel、关闭某些融合，可能牺牲吞吐或增加延迟。是否值得使用，取决于任务需要的是可复现文本、严格的数值对照，还是跨配置调试；不能从“输出相同”反推出所有中间计算逐 bit 相同。
