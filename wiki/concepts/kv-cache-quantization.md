---
id: kv-cache-quantization
title: 缓存量化：写入、读取与容量边界
type: feature
summary: 解释缓存写入时的整数化、读取时的尺度恢复，并区分有效数据减半、物理页容量和混合注意力状态。
aliases: [KV Cache Quantization, C8, KV Cache 量化, kv_cache_dtype, kv_cache_type, enable_c8_quant]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L964-L980
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/kv_c8.py#L108-L145
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1733-L1754
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1756-L1791
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1794-L1875
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1685-L1731
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L349-L372
verified: []
evidence: "C"
relations:
  - {to: quantization, kind: builds-on, note: 使用量化尺度与误差的基本概念}
  - {to: kv-cache, kind: builds-on, note: 缓存量化改变历史状态的存储格式}
  - {to: kv-cache-spec, kind: builds-on, note: 分配容量取决于页规格与布局}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 历史状态的格式影响容量与读取量

[权重量化](quantization.md)处理模型参数，缓存量化处理推理过程中生成并保留的历史状态。常规注意力把 K、V 写入缓存，之后的 query 反复读取它们。将这些缓存从 BF16 改成 INT8，可减少相同元素数的有效载荷，但会引入量化误差，也需要读取算子理解相应尺度。

本页用普通 K/V 缓存解释写入和读取，再对照固定 Ascend 的 C8 路径。GLM-5.3-Flash 同时使用 KDA 与稀疏注意力；其缓存对象见[KV Cache](kv-cache.md)。这里的普通 K/V 算例不是 GLM 全部状态都能采用 C8 的支持声明。

## 一次写入怎样产生误差

固定 C8 写入将输入乘逆尺度、加偏移，再舍入并截断到 `[-128,127]`。[C3] 为了手算，取偏移为0、尺度 s=0.0125：[A]

| 输入 x | x/s | 保存的 q | 恢复值 s×q |
|---|---:|---:|---:|
| 1.0 | 80 | 80 | 1.0 |
| 1.006 | 80.48 | 80 | 1.0 |
| 1.7 | 136 | 127 | 1.5875 |

第一行可精确表示，第二行有舍入误差，第三行超出表示范围后发生截断。[D] 减小尺度能细化零点附近的间隔，也会缩小可表示范围。实际 checkpoint 的尺度和偏移由其量化方案决定。

```wiki-diagram
file: kv-cache-quantization
```

## Decode 和 Prefill 怎样读取

在固定的普通 C8 Decode 路径中，缓存保持 paged INT8 表示；注意力算子接收块表和 K/V 的反量化尺度，在计算中使用这些数据。[C4] 它不要求先把整个历史缓存永久展开成一份 BF16 副本。

Prefill 还要区分新计算的浮点 K/V 和已有历史。固定的 chunked prefill 路径为新片段与继续处理历史选择不同处理方式；后者可能需要 gather 与反量化。[C5] gather/dequant 实现创建临时密集张量，并对有效历史位置做掩码处理。[C6] 因此量化缓存仍可能带来运行时临时内存和格式转换成本。

这些差异来自执行阶段和算子接口，不只来自是否命中了前缀缓存。分块 Prefill 的后续片段本身也要访问先前片段留下的历史。

## 有效载荷减半，物理页未必减半

设一个普通注意力层在本 rank 上有2个 KV 头，每头维度64，历史长度100。[A] 两张缓存的有效数据为：

`K 与 V 字节 = 2 × 100 × 2 × 64 × 每元素字节`

BF16为50 KiB，INT8为25 KiB。[D] 若每页容纳32个位置，需要4页；按128个可分配位置算，缓存主体分别为64 KiB和32 KiB，另加量化元数据。固定 C8 Decode 实现要求页内位置数是32的倍数；32满足这项条件，但不单独保证其余配置都兼容。[C4]

上面的页容量成立于“页内位置数保持32、没有额外对齐”的假设。混合缓存管理器可能要求不同状态类型的页对齐，改变dtype后，页内位置数或填充也可能变化。容量评估应读取最终[缓存规格](kv-cache-spec.md)，分别报告有效载荷、实际分配和临时工作区。

GLM 的 KDA 递归状态不是逐 token 追加的普通 K/V；稀疏注意力还包含索引所需的状态。单独量化某个缓存张量，不能据此推断所有缓存、整个模型或整卡显存都减半。

## 固定实现的配置边界

这份 Ascend 快照通过量化描述中的 `kv_cache_type: C8` 及逐层 scale 条目登记普通 C8 层。[C1] 相应方法创建 scale/offset 参数，并在层已有 `impl` 时替换为 C8 注意力实现。只有非 producer 路径将缓存 dtype 改为 INT8，producer 保留原格式；实现替换本身不受这个 producer 分支控制。[C2] 参数名称相同的其他快照可能采用不同的dtype开关逻辑，需要分别核对。

这种两端格式差异也影响跨机器传输。固定配置检查拒绝普通 GQA C8 与 `MooncakeConnector` 的这一组合，因为 producer 的浮点缓存不能按 consumer 的 INT8布局直接解释；该检查指向逐层连接器作为相应路径的选择。[C7] 这条检查解释的是具体接口约束，不构成 GLM 全模型量化或 PD 组合的实测证据。

评估缓存量化时，应同时比较任务质量、可容纳的实际状态、临时内存峰值和 Prefill/Decode 延迟。本页提供源码机制与算例，未给出设备性能或精度测试结果。
