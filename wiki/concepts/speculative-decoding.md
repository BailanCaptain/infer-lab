---
id: speculative-decoding
title: "投机解码：提出候选、验证与提交状态"
type: feature
summary: 投机解码先提出多个候选，再由目标模型验证并提交可接受的前缀；收益取决于接受率和额外开销，GLM 的 MTP 与混合注意力状态需要共同管理。
aliases: [Speculative Decoding, 投机解码, 推测解码, MTP, Multi-Token Prediction, 草稿模型, num_speculative_tokens, 拒绝采样]
chapters: ["17"]
order: 30
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L40-L123
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L530-L558
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L735-L764
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L835
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1329-L1425
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L157-L181
verified: []
evidence: "C"
relations:
  - { to: prefill, kind: builds-on, note: 在普通自回归路径上增加候选与验证阶段 }
  - { to: kv-cache, kind: builds-on, note: 只提交已接受位置对应的有效状态 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 用候选换取一次推进多个位置的机会

普通 Decode 的下一个输入依赖刚生成的 token，目标模型通常逐位置推进。投机解码先由较便宜的提议过程给出多个候选，再让目标模型验证这些候选。若连续多个候选可接受，一轮验证就能提交多个输出。

```wiki-diagram
file: speculative-decoding
```

图中采用 **greedy、三个候选**的教学假设。输入依次为已确定 token、候选 d₁、d₂、d₃，目标模型在四个位置形成后继预测。若前两项匹配、第三项不匹配，则接受 d₁、d₂，在第三项使用目标预测 z，后面的候选路径作废。本轮得到三个新输出。[A][C4]

若三个候选全部匹配，还可以使用末位置形成的额外预测。候选数量与本轮提交数量因此是不同的量。

## Greedy 验证与随机采样分开理解

Greedy 路径可以逐位比较候选与目标选择是否一致，遇到首个不匹配便结束候选前缀。随机采样则需要相应的接受与拒绝采样规则，不能简单用“候选是不是目标概率最大的 token”替代。[C4][C6] greedy 与随机采样本身的区别、目标概率怎样从分数算出来，见[采样](sampling.md)。

数学上的分布保持需要满足算法假设；具体实现还涉及数值和采样设置，不能据此承诺任何设备与设置下都产生完全相同的 token 序列。

## GLM 用 MTP 提供候选

候选可以由独立小模型提出，也可以来自复用目标模型中间表示的预测模块。GLM 的 MTP（Multi-Token Prediction，多 token 预测）属于后者：推理时利用额外预测模块提出候选，是否接受仍由目标模型验证。这里讲的是推理用途，不据此推导训练损失或训练流程。

固定配置的主干为 45 层，另有一个 MTP 预测层。[S5] 专用 MTP 路径接收 token embedding 和此前隐藏表示，分别归一化、拼接投影，再通过预测块与输出路径生成提议所需表示。[C1]

在所引顺序提议路径中，首个候选产生后，循环将候选作为后续输入、增加位置，并携带隐藏表示再次调用预测模型。GLM 按提议步索引对 MTP 层数取模选择层；只有一个 MTP 层时，多次调用复用同一层权重。[C7][C8] 因而“一个预测层”与“一轮提出三个候选”可以同时成立，前者描述模型结构，后者描述调用次数。官方 GLM 双机示例设置三个投机 token，具体命令与固定来源见[部署基线](../sources/glm-5-3-flash-baseline.md)；这是官方示例选择，不是本知识库实测得到的最佳值。

## 验证结果决定哪些状态有效

验证会暂时处理候选位置，但只有接受前缀及相应后继推进可以成为正式历史。MLA 的位置缓存、KDA 递推状态和卷积状态需要保持一致；未接受分支不能继续影响后续输出。

固定 KDA 投机路径传递接受数量与投机状态索引，专用状态形状函数还为卷积保留与投机数量相关的空间。[C2][C3] 因而投机不仅改变采样，还改变输入准备、状态管理和内存预留。

## 为什么也可能变慢

提议过程、目标验证、候选元数据与状态处理都有成本。接受率低时，多做的工作可能超过减少的轮次；在较大批次、不同模型或设备条件下，目标执行本就高效，也可能削弱收益。因此“最差也不会比不开慢”不成立。

评估时应同时记录候选数、接受长度分布、首 token 与输出延迟、吞吐、显存和并发条件。无设备可以先沿图核对输入与预测错开一位的关系，以及拒绝后恢复到哪个有效状态；性能结论需要实测。


