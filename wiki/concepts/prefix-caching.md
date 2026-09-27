---
id: prefix-caching
title: "前缀缓存：复用已计算输入的条件与边界"
type: feature
summary: 相同前缀只有在身份匹配、状态驻留且各缓存组可共同恢复时才能复用。APC 是否启用和有效块大小依赖版本与配置，2048 不是 GLM 的通用默认值。
aliases: [Prefix Caching, 前缀缓存, 自动前缀缓存, Automatic Prefix Caching, APC]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L198-L225
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L525-L589
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L659-L707
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L348-L396
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L312-L362
verified: []
evidence: "C"
relations:
  - { to: kv-cache, kind: builds-on, note: 跨请求共享之前先明确需复用的历史状态 }
  - { to: kv-cache-spec, kind: builds-on, note: 混合状态的恢复边界取决于各缓存组规格 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 复用的是前缀状态

多个请求可能共享相同系统提示、文档或历史对话。若这些输入已经计算过，系统可以为新请求接入匹配的前缀状态，从未命中的部分继续前向。它主要减少重复 Prefill，后续生成仍然需要执行模型。

```wiki-diagram
file: prefix-caching
```

图中采用普通单组分页教学假设：B=4，两个请求共享前 10 个 token，且前两个完整块仍然驻留并允许复用。可复用前 8 个位置，后面的 2 个公共 token 与新后缀一起处理。[A] 这是为了说明整块边界，不代表 GLM 的实际命中粒度。

## 命中需要同时满足什么

首先需要启用缓存读取，且请求没有要求跳过这条路径。上游通用接口在 APC 关闭或请求标记跳过时直接返回未命中。[C1]

其次需要匹配输入身份。块哈希与此前前缀关联，除了 token，还可能纳入 LoRA、多模态、salt、输入嵌入等额外信息；文本显示相同不保证模型输入身份相同。[C2] 完整哈希块的形成也有长度边界。[C3]

最后需要缓存仍可用，以及模型所需的状态可以恢复。被淘汰的数据不能因为哈希曾经存在就直接拿来计算；混合模型还必须检查不同状态组能否在同一前缀位置继续。

## GLM 的状态恢复涉及多个缓存组

GLM 同时有 MLA 主历史、索引池、索引尾状态和 KDA 状态。尾状态是每请求的高精度滑动窗口；KDA 状态保存的是某个处理边界的递推结果，而不是可随意切取的逐 token K/V。[C6]

专用实现分别计算调度块与哈希块：调度粒度基于各组的最小公倍数，APC 或 connector 使用的哈希粒度可以取各组最大公约数。[C4] **哈希匹配到更细位置，不自动证明所有组都能恢复到该位置。** 最终可复用前缀还受各组状态、对齐和缓存模式约束。

## 2048 与默认启用情况

2048 不是本页假定的默认块大小。GLM 配置中的 `index_topk=2048` 是索引候选参数；缓存块大小需要结合状态形状与运行配置计算，见[缓存规格](kv-cache-spec.md)。

官方双机命令没有显式声明 APC 启停和块大小；当前已定位专用 Ascend 源码，但最终安装组合与默认行为尚未完整核实，见[来源基线](../sources/glm-5-3-flash-baseline.md)。因此本知识库不宣称该双机部署默认启用 APC，也不宣称默认关闭。读取 dataclass 字段只能说明一层兜底值，不能代替核对启动后的有效配置。

固定专用分支还将 APC 与 Mamba 对齐模式一起用于确定状态块大小。[C5] 实际排查应记录有效配置、缓存组规格和命中统计，再对照版本分析。

## 省下的输入位置不等于等比例加速

上述教学例子若新请求总长 14，复用 8 个位置，则本次只需从位置 8 开始处理剩余 6 个输入位置；这是前向输入位置数的减少。[A][D]

后缀计算仍要使用匹配的历史状态，缓存查询、状态接入和后端执行也有成本。不能将 `8/14` 直接称为 FLOPs、HBM 流量或延迟减少比例。对完整 prompt 全部匹配的情况，所引通用接口还预留最后位置重算以得到 logits，受块对齐影响可能重算整块。[C1]

正确复用应保持模型计算语义；但浮点执行顺序、内核与采样设置可能影响逐 token 结果，不能以“每次输出字节完全一致”代替完整正确性条件。无设备时可检查匹配键、边界和状态完整性；性能收益需要实际请求负载验证。
