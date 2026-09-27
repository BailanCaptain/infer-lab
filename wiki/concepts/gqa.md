---
id: gqa
title: "GQA：查询头如何共享 K/V，改变哪些开销"
type: concept
summary: GQA 让一组查询头共享 K/V，减少 K/V 投影宽度和缓存容量；查询头仍分别评分与汇合，实际访存和速度取决于内核、并行方式与工作负载。
aliases: [GQA, Grouped-Query Attention, 分组查询注意力, 分组查询, MQA, Multi-Query Attention, 多查询注意力, MHA, Multi-Head Attention, 多头注意力, num_key_value_heads, num_kv_heads, num_queries_per_kv, KV 头数, 注意力头, head, 多头, Q 头, KV 头]
chapters: ["04"]
order: 15
sources:
  - https://arxiv.org/html/2305.13245v3
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1000-L1042
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L279-L292
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L452-L513
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1359
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1901-L1962
verified: []
evidence: "C"
relations:
  - to: attention-qkv
    kind: builds-on
    note: 在多头评分与汇合的基础上，讨论 Q 头与 KV 头之间的共享关系
  - to: mla
    kind: alternative-to
    note: GQA 减少独立 KV 头数，MLA 采用压缩表示；两者的参数化与缓存对象不同
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 共享 K/V，不合并查询结果

在[多头注意力](attention-qkv.md)中，每个查询头都有自己的 Q，并产生自己的输出。GQA（Grouped-Query Attention，分组查询注意力）让同一组查询头使用相同的 K/V：它们面对同一份键和值，但因 Q 不同，仍各自形成注意力分布。[S1]

设查询头数为 `n_q`，KV 头数为 `n_kv`，等分时每组有 `n_q / n_kv` 个查询头。下图固定四个查询头，比较三种共享关系；数量为教学假设，不对应 GLM 的实际头数。[A]

```wiki-diagram
file: gqa
```

| 结构 | KV 头数 | 对应关系 |
|---|---|---|
| MHA | `n_kv = n_q` | 每个查询头对应一组独立 K/V |
| GQA | `1 < n_kv < n_q` | 每组查询头共享一组 K/V |
| MQA | `n_kv = 1` | 所有查询头共享一组 K/V |

广义的分组表示也可以把 MHA 与 MQA 视为两个端点。[S1] 共享的是模型计算中的 K/V 表示，不是把不同请求的历史混合起来；一个请求中的 KV 仍属于该请求允许访问的上下文。

## 缓存容量按 KV 头数计算

设 K 的每头宽度为 `d_k`，V 的每头宽度为 `d_v`，缓存每个标量占 `b` 字节。普通未压缩 K/V 缓存中，一个 token 在一层的逻辑数据量为：[D]

```text
KV 字节数 = n_kv × (d_k + d_v) × b
```

保持 `n_q = 4`，假设 `d_k = d_v = 128`、BF16 每个数 2 字节，且未作设备分片，则：[A][D]

| 结构 | KV 头数 | 每 token 每层 | 4096 个 token、一层 |
|---|---|---|---|
| MHA | 4 | 2048 B = 2 KiB | 8 MiB |
| GQA | 2 | 1024 B = 1 KiB | 4 MiB |
| MQA | 1 | 512 B = 0.5 KiB | 2 MiB |

这是逻辑元素的容量推导，不含块内空槽、量化比例因子、元数据、临时缓冲或并行复制。相同精度与宽度下，GQA 的逻辑缓存相对 MHA 按 `n_kv/n_q` 缩小；实际分配见 [KV Cache](kv-cache.md)。

## 投影、注意力运算与访存分别变化

“GQA 省显存、不省计算”过于绝对。需要把三部分开销分开：

| 环节 | 保持查询头数和每头宽度不变时 |
|---|---|
| 生成 K/V 的投影 | 输出宽度随 KV 头数减少，参数与乘加量相应减少 |
| QK 评分与加权汇合 V | 每个查询头仍分别计算；普通稠密注意力的算术量不因共享头数等比例缩小 |
| 缓存与读取 | 不同 K/V 的逻辑数据量减少；内核如何重用、读多少次决定实际设备访存 |

例如，输入隐藏宽度为 `H`，忽略偏置的 K/V 两组投影共有 `H × n_kv × (d_k+d_v)` 个参数。与 MHA 相比，减少 KV 头也会减少这一部分计算。[D] 上游的 QKV 投影实现分别按 Q、K、V 的头数与宽度组织输出。[C2]

普通 Decode 中，一个查询位置访问 `S` 个历史位置时，各查询头的 QK 与加权汇合分别需要约 `n_q × S × d_k` 和 `n_q × S × d_v` 次乘加。[D] 这两项与独立 KV 头数不同：多个查询可以共用输入，却仍产生各自的分数和输出。

GQA 因此有降低缓存压力和数据搬运的机会，但不能从缓存缩小比例直接推出加速倍数。Prefill、Decode、批大小、上下文长度和算子实现都会改变瓶颈；本页没有性能实测。

## vLLM 与 Ascend 怎样表达分组

上游 v0.23.0 的普通 `Attention` 分别保存 `num_heads` 与 `num_kv_heads`，并检查前者能被后者整除；前向中 Q 按查询头数整理，K/V 按 KV 头数整理。[C3][C4]

在所引 Ascend v0.23 维护分支中，普通注意力实现计算 `num_queries_per_kv`，相关融合算子调用分别接收查询头数与 KV 头数。[C5][C6] 这条路径无需在调用前把 K/V 显式扩展到查询头数，但不能据接口推断算子内部的数据复制次数或实际读带宽。

这些是**普通注意力接口的版本实例**，并不说明 GLM 专用分支使用相同缓存布局。具体内核支持的头宽、比例、精度和设备组合，需要按部署版本核对。

## 张量并行可能复制 KV 头

KV 头数还影响[张量并行](tensor-parallel.md)的切分。所引 `QKVParallelLinear` 在 KV 头数足够时分片；当 TP 数不少于总 KV 头数时，每个 rank 保留一个 KV 头，并记录复制份数。[C2]

沿用四个 Q 头、两个 KV 头的假设：TP=2 可让每个 rank 持有两个 Q 头和一个 KV 头；TP=4 时每个 rank 一个 Q 头、一个 KV 头，两组 KV 在 rank 间各复制两份。[A][D] 后一种情况下，每个 rank 的注意力接口看起来是一对一，但全局模型仍有两个 KV 头，不能把局部形状变化说成模型权重已转换为 MHA。

KV 头数由模型参数化决定。直接修改配置而保留原权重，既不是无损压缩，也不是普通推理开关；GQA 论文讨论的 checkpoint 转换包含权重处理与后续训练。[S1]

## 为什么 GLM 的缓存不能套用这张表

当前主模型的稀疏层使用 MLA：先得到低维的联合表示，再用于多头注意力计算。固定配置为 `kv_lora_rank = 512`，专用实现通过这一压缩宽度建立 KV 投影。[S7][C8] 这是[模型组件图](glm-5-3-flash.md)所展示的稀疏注意力路径；KDA 则采用另一类状态。

MHA/GQA/MQA 对比说明头共享这一通用结构；GLM 的缓存则需要按实际压缩对象计算容量。其压缩状态与投影细节由 [MLA](mla.md)专题负责，专用镜像的完整安装组合仍以[来源基线](../sources/glm-5-3-flash-baseline.md)记录的待核项为准。
