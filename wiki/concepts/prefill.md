---
id: prefill
title: "Prefill 与 Decode：输入如何变成连续输出"
type: concept
summary: Prefill 处理已知输入并产生首个输出 token，普通 Decode 逐步输入上一次生成的 token；两者经过相同模型层，但输入规模、状态访问和调度方式不同。
aliases: [Prefill, Decode, 预填充, 解码, TTFT, TPOT]
chapters: ["05"]
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1263-L1277
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2327
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
verified: []
evidence: "C"
relations:
  - { to: one-request, kind: builds-on, note: 对照请求从输入到输出的完整路径 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 首个输出来自输入末位置

设模型已经收到四个输入 token `x₀…x₃`。Prefill 将这些已知位置送入模型，各位置只能使用符合因果约束的历史。最后一个输入位置的隐藏表示经过词表投影和采样，产生第一个输出 token `y₀`。普通生成路径通常只需要这一个位置的词表分数；要求 prompt logprobs 等功能时会有不同需求。[C2][C4]

```wiki-diagram
file: prefill
```

下一轮以 `y₀` 为新输入，延续请求状态，产生 `y₁`。再下一轮输入 `y₁`，产生 `y₂`。因此，“生成某个 token”和“把这个 token 输入模型做前向”是相邻但不同的事件。达到停止条件后，最后生成的 token 不一定再进入模型。

假设不分块、不命中前缀、不启用投机，生成 200 个输出需要一次 Prefill 和 199 次 Decode；这是这个请求的普通自回归路径，不等于整个服务的引擎循环只运行 200 次。服务可能同时处理其他请求，也可能有排队、空轮或不同执行方式。[A][D]

## 两个阶段使用相同的主干权重

GLM-5.3-Flash 的文本主干有 45 层。Prefill 和 Decode 都经过该主干中的注意力、残差和前馈计算；阶段变化不会把模型换成另一套权重。[S1]

区别在于本轮输入的数量与已有状态：Prefill 可以同时处理一段已知位置，Decode 的后续输入则依赖上次生成结果。稀疏 MLA 为新增位置生成历史表示，KDA 延续递推状态；混合模型并非每层都追加普通 K/V。

| 观察项 | Prefill | 普通 Decode |
|---|---|---|
| 本轮输入 | 一段已知 token | 通常是上次生成的一个 token |
| 历史状态 | 新请求为空，后续输入段或前缀命中时已有状态 | 延续已计算历史 |
| 可返回输出 | 输入处理完成后产生首 token | 产生后续 token |
| 主要体验指标 | 首 token 延迟，包含排队等系统时间 | 输出 token 间隔，受并发及调度影响 |

## 分块与并发改变轮次安排

长输入可以分成多段 Prefill。中间段计算并保存状态，但还没有处理到整个 prompt 的末位置，因此不能将其采样结果作为请求的首个回答；固定 Runner 为这类未完成输入标记丢弃采样结果。[C3]

一个执行批次也可以同时包含 A 请求的 Decode 和 C 请求的 Prefill。框架用每个请求本轮的 token 数、位置和序列边界组织张量，再交给模型执行。对应实例见[并发请求](concurrent-requests.md)。

## 性能分析要结合输入规模

Prefill 往往能形成较大的矩阵计算，Decode 则常涉及较小的当前输入和较长历史。是否受计算、权重访存、状态访问或通信限制，还取决于批次、模型结构、量化与设备。不能仅凭“Prefill/Decode”标签判定 NPU 利用率，也不能假设每个 Decode 都从 HBM 完整读取所有专家权重。

阅读源码时，可以先看 EngineCore 如何提交与接收一轮执行，再看 Runner 如何选取用于 logits 的隐藏行。[C4][C5] 从这些接口得到的是执行结构；真实首 token 延迟与吞吐需要另做测量。


