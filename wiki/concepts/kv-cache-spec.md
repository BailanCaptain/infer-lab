---
id: kv-cache-spec
title: "缓存规格：把模型状态转成页与缓存组"
type: concept
summary: 缓存规格声明状态形状、精度与页大小，供容量规划、分组和设备张量创建使用。GLM 的主潜向量、索引、尾状态与 KDA 需要联合规划。
aliases: [KV Cache Spec, KVCacheSpec, MambaSpec, 缓存组, cache group, page size]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5124-L5267
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L139
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L348-L396
verified: []
evidence: "C"
relations:
  - { to: kv-cache, kind: builds-on, note: 先识别要保存的状态，再声明其形状和容量 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 模型声明状态，系统规划存储

模型层知道自己需要保存哪些状态，缓存管理器则需要决定这些状态占多少页、属于哪些组、如何随请求分配。缓存规格连接这两类职责：它描述 dtype、形状、块大小及页字节数，执行侧再据此创建和解释设备张量。[C1]

```wiki-diagram
file: kv-cache-spec
```

规格不是一个“每层报价”的单独数字。相同页字节数的两个对象也可能有不同的状态语义、寻址方式和恢复条件。GLM 的不同缓存对象因此不能简单合并成一张统一的 K/V 表。

## GLM 的四类缓存对象

| 对象 | 核心规格 | 管理含义 |
|---|---|---|
| MLA 主潜向量 | 每位置压缩表示、dtype、块大小 | 按历史位置增长 |
| 压缩索引池 | 索引宽度、压缩比例、块大小 | 保存完成池的索引表示 |
| 索引尾状态 | 窗口、双份中间表示、FP32 | 每请求维护未完成池的状态 |
| KDA 状态 | 卷积和递推形状、各自 dtype | 保存延续推理所需状态，投机影响预留 |

专用 Runner 收集各缓存模块规格，识别 GLM 的 cache role；索引池和尾状态由独立模块声明。[C1][C5] KDA 状态形状还依赖 TP 大小、头数、头宽、卷积核和投机 token 数。[C6]

## 用状态字节数确定对齐

GLM 专用配置分支将完整 KDA 原始状态字节数与 MLA 每位置容量比较。设 KDA 原始字节数为 M、MLA 每位置字节数为 a，则初步逻辑块大小为：[C2][D]

```text
B_min = 128 × ceil(M / (128 × a))
```

实现还处理用户显式块大小，并向支持的倍数取整。GLM 的补齐目标取注意力页容量与完整 KDA 原始状态容量的较大值。[C2][C3] 因此，不能只取递推矩阵、漏掉卷积状态，也不能把旧模型的 2048 直接移到 GLM。

作为纯算术例子，假设 M=300 KiB、a=1 KiB，则 `B_min=128×ceil(300/128)=384` 个位置。[A][D] 这里的 M 是教学假设，不是 GLM 的实测状态量。

## 分组保留不同状态的管理方式

专用 GLM 分组逻辑组合主注意力组、状态组和 KDA 组，并要求保留混合缓存管理器。[C4] 各组可以有不同的页规格；“把全模型所有页都补到相同大小”不是这一实现的正确概括。

页规划之后，缓存管理器按请求分配逻辑块，执行侧维护各组块表与张量视图。真正解释一个物理块时，还要知道它属于哪一组、哪个状态对象。

## 调度块、哈希块和内核页分别看

固定 GLM 分支按各组块大小的最小公倍数结合上下文并行规模计算调度粒度；启用前缀缓存或 connector 时，哈希粒度使用显式值或各组块大小的最大公约数，并检查整除关系。[C7]

例如假设两组块大小分别为 4 和 6：能同时落在两组整块边界的位置每隔 12 出现；能共同划分两种块的最大基础单位则是 2。[A][D] 前者解释共同推进边界，后者解释内容哈希可以采用的细粒度；这是帮助理解所引实现的算例。

哈希粒度负责识别前缀，调度粒度约束推进，内核页负责具体寻址。它们可能数值不同。细粒度哈希不意味着系统一定能在每个哈希边界恢复全部混合状态，详见[前缀缓存](prefix-caching.md)。

最终部署容量还受权重、图和工作区、通信缓冲以及运行时配置影响。本页按专用源码解释规划关系，不将这些公式当作最终镜像默认值或设备实测结果。

