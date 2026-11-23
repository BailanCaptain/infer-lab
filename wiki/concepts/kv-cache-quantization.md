---
id: kv-cache-quantization
title: KV cache 量化：以 INT8 C8 为例，历史怎样存窄再读回
type: feature
summary: >-
  KV cache 量化降低历史 k、v（MLA 模型是潜向量）的存储精度；本页以 INT8 C8 为例，演示写入压缩和读取时的缩放。相对 16
  位缓存，元素载荷约减半，代价是量化误差留在缓存里。再区分元素与整卡容量、decode 与 prefill、FP8 与 KIVI，以及 Ascend
  上的三条实现；固定 GLM 双机部署没有开它。
aliases:
  - KV Cache Quantization
  - KV cache quantization
  - C8
  - KV Cache 量化
  - KV 缓存量化
  - 缓存量化
  - INT8 KV cache
  - FP8 KV cache
  - KIVI
  - KV cache 低比特量化
  - kv_cache_type
  - enable_c8_quant
  - fa_quant_type
  - enable_sparse_sfa_c8
  - enable_sparse_li_c8
chapters:
  - '11'
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L964-L980'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/methods/kv_c8.py#L108-L145'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1733-L1754'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1756-L1791'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1794-L1893'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1685-L1731'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L349-L372'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1568-L1643'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1650-L1682'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1895-L1934'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L770-L779'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L760-L765'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3978-L3989'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L54-L71'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L280-L289'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L672-L685'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L77'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L578'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L504-L505'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L83-L86
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L112-L139
  - 'vllm@0fc695fc:vllm/config/cache.py#L19-L35'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/kv_c8.py#L111-L130'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/kv_c8.py#L111-L130'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L111-L130
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L460-L461'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L301-L323'
  - >-
    vllm-ascend@baa023ad:tests/e2e/nightly/multi_node/internal_dp/config/GLM-5.1-W8A8C8-A3_128k_90_50.yaml#L1-L2
  - 'vllm-ascend@db701c1f:vllm_ascend/models/deepseek_v4.py#L152-L155'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L215-L224'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L745-L754'
  - 'vllm-ascend@baa023ad:vllm_ascend/quantization/utils.py#L267-L284'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L217-L220'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/utils.py#L217-L220'
  - 'https://arxiv.org/abs/2402.02750v2'
  - 'https://docs.vllm.ai/en/v0.25.0/features/quantization/quantized_kvcache/'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L905-L943'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L96-L117'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelslim_config.py#L797-L837
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L103
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/mla.py#L189-L218'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L842-L873'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L377-L399'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L723-L803'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L854-L925'
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json
  - >-
    vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L707-L745
  - 'vllm@ced6857a:vllm/config/cache.py#L155-L157'
  - 'vllm@ba15685a:vllm/config/cache.py#L285-L287'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1560-L1615'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_c8_mxfp.py#L85-L115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_c8_mxfp.py#L380-L410'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L85'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L24-L110'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L701-L716'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L920-L935'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L1647-L1700'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_c8_mxfp.py#L393-L408'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/configs/modelslim_config.py#L925-L960'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L865-L880'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L2132-L2441
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L571-L587'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1030-L1043'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/attention_v1.py#L615-L631'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1138-L1161'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: quantization
    kind: builds-on
    note: 一个数怎样压成 8 位、偏移（零点）是什么在量化页，本页讲这些数放进缓存以后怎样写、怎样读
  - to: kv-cache
    kind: builds-on
    note: KV cache 为什么要存、存多少、每步怎样读在那一页，本页讲把它存窄以后省下什么、付出什么
  - to: mla
    kind: builds-on
    note: MLA 缓存的是潜向量，MLA 模型上被压的就是这条潜向量
  - to: kv-cache-spec
    kind: builds-on
    note: 改精度改的是缓存规格里的字段，实际每页几个位置、怎样对齐看规格页
contradicts: []
updated: '2026-11-23'
origin: direct
---

## KV cache 量化是什么？

**KV cache 量化（KV cache quantization）把缓存里的历史换成位数更少的数值表示；本页主讲 INT8 C8：写入时压成 8 位整数，读取时结合缩放系数参与 attention。** 它也可以使用 FP8 或更低位数，支持范围随算法与后端变化。[KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的历史表示，之后每生成一个 token 都要回头读它；[量化](quantization.md)让缓存中的数以更窄的格式保存。本页的具体算例从 BF16 的 2 字节变成 INT8 的 1 字节，不代表所有 KV 量化都这样实现。

压的对象跟着 attention 的种类走。普通 attention 的这条 C8 路径存 k、v 两张缓存，两张都压；[MLA](mla.md) 缓存各头共用的潜向量以及模型所需的位置编码部分。后面的 FA 量化只压潜向量、保留 RoPE 段，稀疏 C8 则另有打包规则，不能把 MLA 缓存统一理解成一张都被压窄的向量。

```wiki-diagram
file: kv-cache-quantization-intuition
```

上排按 BF16 存：留给缓存的这段显存装得下 4 块。下排是同样大小的显存按 INT8 存：每块装的位置数不变，每个数只占一半宽，于是装得下 8 块，历史能多存一倍。代价是写入时多一步「压成 8 位」，读取时多一步「乘回系数」。本页主讲的静态 C8 实现每层 k、v 各一套系数与偏移，随权重加载，另占显存；图中的缓存池只计算块载荷，没有把这些参数画进去。

## 为什么需要：缓存会占满显存，decode 每步都要读它

**先看普通全注意力、各层分别保留历史的示例：缓存载荷随历史长度和请求数增长，decode 要读取可见历史。保持元素数量、分页与访问方式不变，BF16 改成 INT8 后，载荷字节减半。** 滑动窗口、稀疏选择、跨层共享和线性 attention 会改变留下或读取哪些状态，不能直接套用这个容量模型。

先看占多少。沿用 KV cache 页的示意模型（每层 8 个 KV 头、每头 128 维，共 32 层），BF16 下一条 4,096 token 的请求占 512 MiB，16 条同时跑就是 8 GiB，推导见[存一份要多少](kv-cache.md#存一份要多少从一个位置一层往上乘)。留给缓存的显存在启动时一次切定，装满以后新请求只能等，有时还要抢占已经在跑的请求（见[省了重算，要付什么代价](kv-cache.md#省了重算要付什么代价)）。同样 8 GiB 改按 INT8 存，能装下 32 条这样的请求，或者让 16 条请求各自的上下文长一倍。

再看读多少。普通全注意力的 decode 通常给一个新位置算 q、k、v，再与可见历史打分、按分数取 v。INT8 缩小了同一组历史元素的载荷；若这部分读取是瓶颈，就有减少等待的机会。实际 HBM 流量和耗时还受分组查询的复用、算子分块、缓存命中、尺度读取与格式转换影响，应通过运行记录确认。

**代价有三处。**

- **误差一直留在缓存里。** 一个位置的 k、v 只在写入时压一次，之后每一步 attention 读到的都是这份近似值，不会重算纠正：k 的误差改变打分，v 的误差改变加权求和的结果。
- **读的一方要认得系数。** attention 算子要么边读 8 位数边乘回系数，要么先把 8 位的历史展开成一份临时的 BF16；后一种要额外的临时显存和一次格式转换，下文细讲。
- **系数要事先定好。** 本页主讲的实现用静态系数：量化工具离线算好、放进权重包，推理时不再调整；实际的数超出系数能表示的范围，就只能截断。

它和[权重量化](quantization.md)都是「降精度 + 乘回系数」，但对象和时机不同：

| | 权重量化（W8A8） | KV cache 量化 |
|---|---|---|
| 压的是什么 | 模型参数，加载后不再变 | 推理中生成、随请求增长的历史 k、v 或潜向量 |
| 什么时候压 | 权重离线压一次；激活每次前向现压 | 每个位置写进缓存时压一次 |
| 省下什么 | 权重显存，以及每步读权重的字节 | 缓存显存，以及 decode 读历史的字节 |

## 一个缓存块怎样压下去、读回来差多少

**写入时每个数乘上系数的倒数、加上偏移，舍入成整数，再截到 −128…127；读回时乘回系数。本页主讲的实现里，系数最细可以每一维一个。** 一个数怎样压、偏移（也叫零点）是什么，[量化页](quantization.md#一个数怎样压下去再还原回来)已经讲过；这里看放进缓存以后，一个块压下去差多少、占多少。

### 写进缓存：误差从哪来

取一个块里 $k$ 的某一维，三个位置上的值是 $1.0, 1.006, 1.7$；这一维的系数 $s = 0.0125$，偏移取 $0$（都是示意数）：

$$q = \text{clamp}\!\left(\text{round}\!\left(\frac{x}{s}\right),\, -128,\, 127\right), \qquad \hat{x} = s \cdot q$$

| 位置（示意：$s = 0.0125$，偏移 $0$） | 原值 $x$ | 写入整数 $q$ | 读回值 $\hat{x} = s \cdot q$ | 误差与类型 |
| --- | --- | --- | --- | --- |
| 位置 0 | $1.0$ | $\text{round}(1.0 \div 0.0125) = \mathbf{80}$ | $0.0125 \times 80 = \mathbf{1.0}$ | $0$（原样还原） |
| 位置 1 | $1.006$ | $\text{round}(80.48) = \mathbf{80}$ | $0.0125 \times 80 = \mathbf{1.0}$ | 差 **0.006**（舍入误差） |
| 位置 2 | $1.7$ | $\text{clamp}(136, -128, 127) = \mathbf{127}$ | $0.0125 \times 127 = \mathbf{1.5875}$ | 差 **0.1125**（截断误差） |

这一例里舍入误差最多半格，即 0.00625；1.7 超出了 127 × 0.0125 = 1.5875 这个上限，所以被截断。把 s 调大到 1.7 ÷ 127 ≈ 0.0134，截断没了，最大舍入误差却升到约 0.0067；格子粗细与范围宽窄怎样取舍，见[量化页](quantization.md#一个数怎样压下去再还原回来)。实际权重包里的系数和偏移，由它的量化方案决定。

**为什么一维一个系数。** 同一个头里不同维的数值范围可以差很多。整层共用一个系数，它就得照顾范围最大的那一维，范围小的维只能用很粗的格子；一维一个系数，各取各的。本页主讲的实现里，系数可以细到「KV 头 × 头内维度」每格一个，另配一个偏移，k、v 各一套；[tensor parallel](tensor-parallel.md) 把 KV 头分到几张卡上时，每张卡只取自己那几个头的系数。

### 一块省多少：有效数据减半，按页分配也减半

设本卡上的一层有 2 个 KV 头、每头 64 维，一条请求的历史有 100 个位置，每页装 32 个位置（示意数）。所需页数为 $\lceil 100 \div 32 \rceil = 4$ 页（共 $4 \times 32 = 128$ 个位置），下式前导系数 `2` 代表 $k, v$ 两张缓存：

$$B_{\text{valid}}(\text{dtype}) = 2 \times 100 \times 2 \times 64 \times b, \qquad B_{\text{alloc}}(\text{dtype}) = 2 \times 128 \times 2 \times 64 \times b$$

| 存储格式（2 个 KV 头 × 64 维，100 位置，32 位置/页示意） | 有效数据（100 位置） | 按页实际分配（4 页 = 128 位置） |
| --- | --- | --- |
| **BF16**（$b = 2\text{ B}$） | $2 \times 100 \times 2 \times 64 \times 2\text{ B} = 51{,}200\text{ B} =$ **50 KiB** | $2 \times 128 \times 2 \times 64 \times 2\text{ B} = 65{,}536\text{ B} =$ **64 KiB** |
| **INT8**（$b = 1\text{ B}$） | $2 \times 100 \times 2 \times 64 \times 1\text{ B} = 25{,}600\text{ B} =$ **25 KiB** | $2 \times 128 \times 2 \times 64 \times 1\text{ B} = 32{,}768\text{ B} =$ **32 KiB** |

```wiki-diagram
file: kv-cache-quant-fig-clip-and-pages
```

最后一页只用了 4 个位置（100 − 96），剩下 28 个空着，两种格式空着的位置一样多。系数另算：k、v 各一套系数和偏移，每套 2 × 64 = 128 个数，这一层一共 512 个数，历史再长也不变。这里有效数据和按页分配都正好减半，前提是每页的位置数保持 32、没有别的对齐要求；[后面一节](#页和整卡为什么不一定跟着减半)讲这个前提什么时候不成立。

## 读回来：decode 直接读 8 位，prefill 接历史时先展开

**下面沿不做 PD 分离、输入为 BF16 的普通 C8 路径讲解：新 k、v 量化后写入，读取按阶段分路。** decode 的融合算子直接接收分页 INT8；prefill 全是新位置且浮点 k、v 仍在时，使用这份浮点值；接续历史则先收拢并反量化。图中读回 BF16 是所选输入类型的结果，实现实际转换到 query 的 dtype。图捕获及 PD 的入口另有分支。

```wiki-diagram
file: kv-cache-quantization
```

在普通 attention 模型上开 C8 时，这一段对应主线[第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里 attention 的位置；写入要用的块表和槽位，由[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)准备。混合架构（如 KDA 与稀疏 MLA）不走这条普通 C8 路径，见[后文复杂异构对照](#放到-glm-双机这套部署没有开-kv-cache-量化)。按图里的编号走一遍：

1. 这一层给新位置算出 k、v，此时还是 BF16。
2. 乘系数的倒数、加偏移、舍入、截断，得到 INT8。
3. 按这个位置的槽位写进块里；槽位怎样由块表和位置算出，见[位置怎样找到缓存写入处](prepare-inputs-flow.md#位置怎样找到缓存写入处)。prefill 时，第 1 步的浮点那份也留着，本步接着用。
4. prefill 没有历史（整段提示词都是这一步新算的）：直接用第 1 步的浮点 k、v。
5. prefill 要接历史（[prefix caching](prefix-caching.md) 命中旧块，或 [chunked prefill](chunked-prefill.md#历史状态必须跨段延续) 后续分块）：先按块表把用到的块收拢（gather）成连续临时张量，掩掉块尾空位，再乘回系数得到 BF16 才算 attention。这张临时张量要额外的显存，还多一次格式转换。
6. decode：attention 算子拿到块表和 k、v 的系数，直接按块读 8 位数，边读边乘回系数。它不用先把整段历史展开成一份 BF16 副本，从显存读的就是 8 位的字节。

所以反量化的开销取决于执行阶段和算子接口，不只看有没有命中前缀缓存：分块 prefill 的后面几段，本来就要读前面几段留下的历史。decode 和 prefill 混在同一批时，decode 那部分仍按第 6 步直接读。第 4、5 步按整批分路：chunked prefill 一批里只要有一条 prefill 接历史或浮点 k、v 不可用，整批 prefill 都走第 5 步。收拢的内容也包括本步刚写入的新位置，它们读回来同样是 8 位近似值。

**按块读回只传或乘系数，不减偏移。** 写入时加了偏移，但 decode 的融合调用没有传偏移，prefill 展开也只乘系数，注释按对称量化处理；不分页的旁路才先减偏移再乘。要让每个缓存数值按同一量化公式还原，分页路径需要零偏移配方；这几处代码没有主动拒绝非零偏移，应检查实际权重包。

## 页和整卡为什么不一定跟着减半

**每个数减半，只保证有效数据减半。每页装几个位置、要不要和别的状态对齐、还有哪些状态根本不是 k、v、临时工作区多大，都会让实际分配和整卡显存偏离「一半」。**

- **每页的位置数有约束。** 这套实现在 decode（包括 chunked prefill 批里的 decode 部分）读分页缓存时，要求每页的位置数（block size）是 32 的倍数。上一节的 32 满足这一条，但满足它不等于别的配置都兼容。
- **混合模型要对齐页大小。** 一个缓存池里有几类状态时，vLLM 要把它们的页对齐成同样大小，见[页大小不同的层怎样放进同一个池](kv-cache-spec.md#页大小不同的层怎样放进同一个池)。某一类缓存改了精度，每个位置的字节数就变了；为了对齐，每页装几个位置、填充多少都会跟着变。[GLM 一节](#假如只把潜向量压成-1-字节块数会翻倍吗)有一个具体例子。
- **不是所有状态都是逐位置追加的 k、v。** [线性 attention](linear-attention.md) 存的是固定大小的递推状态；[稀疏 attention](sparse-attention.md) 还有索引器自己的缓存。只压其中一种缓存，推不出所有缓存、整个模型或整卡显存都减半。
- **临时工作区不在缓存池里。** prefill 展开历史用的临时张量另占显存，大小随这一批里最长的历史增长。

所以评估容量时，要读最终的[缓存规格](kv-cache-spec.md)，把有效数据、实际分配和临时工作区分开报。

## Ascend 上的三条 KV cache 量化路

**固定版本的 vllm-ascend 按 attention 的种类，把通用的 KV cache 量化分成三条互不相通的路，各有各的开关；前面几节讲的是普通 attention 的那条，叫 C8。**

| 路 | 用在哪种 attention | 压什么、压成什么 | 系数放在哪 |
|---|---|---|---|
| C8 | 普通 attention（含 [GQA](gqa.md)：几个查询头共读一组 k、v） | k、v 两张缓存都压成 INT8 | 每层 k、v 各一套，随权重加载 |
| FA 量化 | MLA | 只压潜向量那一份，RoPE 段保持原精度。A5（另一代昇腾设备）上压成 FP8，所有实例都生效；A2、A3 上压成 INT8，只在 PD 分离的 decode 端生效 | 每层一组，随权重加载 |
| 稀疏 C8 | 带索引器的稀疏 MLA | 主缓存连同系数打包成一份 8 位缓存；索引器的缓存由另一个开关单独压 | 和数据一起存进缓存块 |

在旧版固定实现中，三条路的开关都不在上游 `--kv-cache-dtype` 上：C8 和 FA 量化写在权重包描述文件里（FA 量化键名为 `fa_quant_type`），稀疏 C8 写在启动附加配置里，键名见[怎么开](#怎么开)。到 `v0.30.0` 与 `main` 主基线，KV 量化体系进一步扩展出三条重要规则：

- **GQA `INT8 C8`**：仍依赖 ModelSlim 量化权重包（`quant_model_description.json` 含 `kv_cache_type: C8` 与每层 scale）和 `block_size % 32 == 0` 约束。
- **`MXFP8 C8`（`--kv-cache-dtype mxfp8`）**：面向标准 full Attention（K 动态量化、V 静态 E8M0 scale）。其 `AscendC8MXFPAttentionBackend` 强制 kernel 页大小为 **512 的倍数**（`get_supported_kernel_block_sizes()` 返回 `[512]`），且拒绝 PCP/DCP、非因果与滑窗。
- **`TurboQuant`（`--kv-cache-dtype turboquant_4bit_nc`）**：仅支持 A2/A3，按模型家族分为 SFA 打包主缓存与 DeepSeek V4 压缩缓存两路。其中后者还要求 `VLLM_USE_V2_MODEL_RUNNER=1` 与 `indexer_kv_dtype='int8'`。
- **按层跳过选项 `--kv-cache-dtype-skip-layers`**：上游支持按层号或注意力类型跳过 KV 量化；例如 Ascend 在 A5 上自动将 MiniMax-M3 的 GQA 层加入跳过列表以保持 BF16。

下图将 `v0.30.0` 昇腾上四条 KV cache 量化路径（`INT8 C8`、`MXFP8 C8`、FA 量化、`TurboQuant 4-bit`）的入口、页大小对齐和跳过/PD 边界并排对照：

```wiki-diagram
file: kv-cache-quantization-fig-c8-mxfp8-turboquant
```

FA 量化在 A2、A3 上还有一道门槛：实例必须是 [PD 分离](pd-disaggregation.md)里做 decode、接收缓存的一端（KV consumer），普通部署写了它也不会压缓存。在 `v0.30.0` 与 `main` 上，FA 量化还另要求 `--kv-cache-dtype` 设成 `fp8` 或 `int8`，见[版本差异](#版本差异)。MLA 那一行只压潜向量，是因为 vllm-ascend 的 MLA 缓存把潜向量放在 K 一侧、RoPE 段放在 V 一侧，而 FA 量化对 MLA 模型只压 K 一侧，源码注释说这样做是为了保精度。个别模型在自己的代码里另定缓存精度，例如 DeepSeek-V4 在 A5 上直接把缓存建成 FP8，不属于这三条路。

### PD 分离时，两端的缓存格式不一样

C8 只让「不是 KV producer」的实例把缓存类型改为 INT8。producer 不做这次类型覆盖，但同样换上 C8 实现；它的 prefill 分支直接写原类型缓存，不经过前面图中的 INT8 写入。以本页 BF16 为基线，P 端保留 BF16、D 端分配 INT8，两端字节格式不同，不能直接原样整块搬运。判断条件是 producer 标志，也要识别同时标为 producer 和 consumer 的角色组合。

启动检查专门拦截一种禁配组合：普通 GQA 模型开了 C8，又用 [MooncakeConnector](mooncake-connector.md) 整块传输时会直接报错。报错会提示关掉 C8，或改用发送前先量化成 8 位的逐层 `MooncakeLayerwiseConnector`。这条检查说明的是接口约束，不是具体部署的实测结论。

在 `Ascend 910B3` 真机排障（详见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）中，必须严格区分两道互不替代的 GQA 报错守卫，不能看到命令行同时带了 Mooncake 与 `--kv-cache-dtype int8` 就混为一谈：

- **守卫一（未量化 BF16 GQA 模型直传 `--kv-cache-dtype int8` → `attention_v1.py` 静态权重缺失报错）**：对没有经过离线 C8 校准的普通 BF16 GQA 模型传 `--kv-cache-dtype int8` 时，`enable_c8_quant` 为 `False` 且不属于 `mxfp8` 动态分支，实例在构建注意力层时直接于 `attention_v1.py`（`v0.30.0` 第 `583` 行）抛出首错 `ValueError: The current GQA‑related models adopt static quantization...`（源码原文中的连字符为不换行连字符 `U+2011` `‑`）。即使启动命令同时配了 PD 分离，真机故障标本（`err3`）抛出的也是这道权重缺失错误。
- **守卫二（已带 C8 静态权重的 GQA 模型配普通 `MooncakeConnector` → `ascend_config.py` 整块传输保护）**：只有权重包真正开启了 `enable_c8_quant = True`，同时属于 GQA 后端并选用普通 `MooncakeConnector` 时，才会命中 `ascend_config.py`（`v0.30.0` 第 `1030–1042` 行）的独立传输检查，拦截“P 端 BF16 字节被 D 端原样当作 INT8 读取”的错位风险。

对照其他模型时，还要核对不同状态是否使用不同精度。[DeepSeek 的主 KV、索引 K 与窗口格式](low-precision-formats.md#deepseek-为什么几种缓存不用同一种-fp4)放在格式页统一说明；本页继续维护 Ascend 路径及后文复杂异构实战对照。

## C8、FP8 与更低位缓存，区别不只是位数

| 路线 | 主要改变 | 使用边界 |
| --- | --- | --- |
| 本页固定 Ascend INT8 C8 | 八位整数载荷，按该方法加载 K/V 系数与偏移 | 前面的写入、读取与断言对应这一实现，不直接套给其他后端 |
| 上游 vLLM FP8 KV | 八位浮点元素，也需要核对缩放 | 所引 v0.25 文档区分逐张量与逐头缩放；逐头路径还有 FlashAttention 与产物要求 |
| KIVI 研究方案 | 二位 KV；针对分布差异，K 采用逐通道、V 采用逐 token 量化 | 是论文算法依据，尚未证明本站固定 Ascend 镜像实现了该方案 |

“逐通道”和“逐 token”描述系数共享的方向。沿历史位置看同一个通道，与沿一个 token 看全部通道，看到的异常值分布可能不同，因此 K、V 不必采用同一分组方式。更小的位宽还要算系数、分组尾部和保留高精度状态，不能把二位方案的整卡容量直接乘八。

上游 FP8 文档也提醒：缺失 scale 而使用默认值可能影响精度；所引 v0.25 的运行时估计在预热时用一批随机 token 计算系数，随后固定使用，不是每次前向重新计算，也不同于用代表性数据离线校准。本站部署是否适用，仍应查所用版本、attention 后端和模型缓存结构。验收应覆盖长上下文、不同长度与任务质量，详见[量化验收](quantization-evaluation.md)。

缓存改成 [NZ 布局](tensor-layout.md)只表示重排与对齐；它本身没有把 BF16 压成 INT8。权重 W8A8、缓存 C8、缓存 ND/NZ 是分别选择和验证的事项。

## 复杂异构实战对照：GLM 双机为何未启用与定块边界

### 放到 GLM 双机：这套部署没有开 KV cache 量化

**按[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的固定源码与配置，稀疏 MLA 主缓存和索引器的压缩缓存为 BF16，索引器尾状态为 FP32，没有启用上面三条 KV 量化路径。** 本节据此解释旧部署的缓存格式和容量。公开权重包的两个固定快照也未登记 C8 / FA 缓存量化条目；现场下载的是哪一版，仍要由部署记录确定。

#### 三处代码把缓存精度定死

- GLM 的稀疏 MLA 缓存层建主缓存时，直接把精度写成 BF16，代码注释说所有设备上都保持 BF16。
- GLM 用的 attention 后端继承自稀疏 MLA 的通用后端，但在构造时把稀疏 C8 的两个开关（主缓存、索引器缓存）强制关掉；如果启动时打开了索引器 C8 的重排优化，会直接报错。
- 带索引器的模型（配置里有 index_topk，GLM 取 2,048）在 Ascend 平台初始化时，缓存精度被改回模型本身的精度，启动时传了 kv-cache-dtype 也不生效。这套部署的启动参数本来也没写这一项，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

FA 量化还多一条走不到的理由：它在 A2 上只对 PD 分离的 decode 端生效，这套部署没有做 PD 分离。

W8A8 只管权重和激活（见[哪些矩阵是 8 位](quantization.md#哪些矩阵是-8-位哪些保持-bf16)），和缓存精度是两件事：这套部署开着 W8A8，缓存仍是 BF16。

#### 缓存里的字节主要是潜向量

每张卡上，12 个存 KV 的层（主干 11 层稀疏 MLA 加 [MTP](speculative-decoding.md) 第 45 层）合计每 token 占 13,056 B，其中潜向量 12,288 B、索引器压缩缓存 768 B，均为 BF16。推导见[占住一个块号，要用多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。要压的话，对象主要是潜向量这一份，也就是 [MLA 页](mla.md#每个位置缓存多少字节)讲的那条 512 维潜向量。

#### 假如只把潜向量压成 1 字节，块数会翻倍吗

**不会简单翻倍，因为 GLM 的块大小是按缓存精度凑出来的。** 一个逻辑块取 640 个 token，是为了让一块的 MLA 页装得下一层 [KDA](linear-attention.md)（GLM 用的线性 attention）在一条请求上的递推状态（561,152 B），推导见[为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。这条规则按缓存精度的字节数算每个 token 的页大小；若没有显式指定更大的块，把同一条规则代入 1 字节（假设推算，不是部署状态）：

$$n_{\text{kblk}} = \left\lceil \frac{561{,}152}{128 \times 512} \right\rceil = \lceil 8.5625 \rceil = 9, \qquad B_{\text{logical}} = 128 \times 9 = 1{,}152\text{ token}$$

| 推算项（同一条定块规则代入 1 字节假设） | 算式 | 结果 |
| --- | --- | --- |
| 每 token 每层潜向量 | $512 \times 1\text{ B}$ | **512 B** |
| 所需 128-token kernel 块数 | $\lceil 561{,}152 \div (128 \times 512) \rceil = \lceil 8.5625 \rceil$ | **9 块** |
| 重算后的逻辑块大小 | $128 \times 9$ | **1,152 个 token** |

```wiki-diagram
file: kv-cache-quant-fig-glm-block-realign
```

逻辑块从 640 个 token 变成 1,152 个，每个块号占多少字节、预算能切出多少块，都要整个重算。KDA 递推状态本身（每层每条请求 561,152 B，固定占 12 个块号，见[为什么短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)）不属于潜向量缓存，压潜向量不会让它变小。所以「潜向量字节减半」推不出「块数翻倍」或「能多装一倍请求」；这里只是代入规则看方向，固定版本里 GLM 缓存精度不会变成 1 字节。

## 常见误解

- **「开了 W8A8，KV cache 自然也是 8 位。」** W8A8 只管权重和激活，缓存精度由另外的开关决定。GLM 双机开着 W8A8，缓存仍是 BF16。
- **「缓存量化以后，块数和能跑的请求数都翻倍。」** BF16 改 INT8 时，同一组元素的载荷减半。只有分页、预算和其他开销都满足示例条件，理想容量才翻倍；GLM 的定块规则代入 1 字节后，块大小本身就变了。
- **「读 8 位缓存要先把整段历史还原成 BF16。」** 旧普通 C8 的 decode 融合算子直接读 8 位、边读边乘回系数；prefill 接历史，或没有可直接使用的浮点 K/V 时，才收拢并展开临时副本。新版 C8-MXFP 的分页读取路径见版本差异。
- **「量化误差只影响当前这一步。」** 一个位置写入量化缓存后，后续读取它时使用的仍是近似值，误差会继续影响相关打分与加权求和；窗口或稀疏选择不再读取它时，访问范围又不同。
- **「只有前缀缓存命中才有反量化开销。」** 分块 prefill 的后面几段同样要读前面几段的历史，也走展开这条路。
- **「名字里带 C8 的配置，这套部署也能照开。」** 例如 `main` 快照有 GLM-5.1-W8A8C8 多机测试配置，但模型名称、后端和版本要一起核对。旧镜像 `db701c1f` 的 GLM-5.3-Flash 将稀疏 C8 强制关闭、主缓存固定为 BF16；`v0.30.0` 与 `main` 的变化另见[版本差异](#版本差异)。
- **「系数和缓存块一起增长。」** 要看是哪条路：C8 和 FA 量化的系数每层一组、随权重加载，和历史长短无关；稀疏 C8 把系数打包进缓存块，随块一起分配。

## 对照源码

### 怎么开

kv_cache_dtype 的默认、完整枚举、CLI/Python 字段名及 GLM 配置改写统一见[KV 规格参数参考](kv-cache-spec.md#怎么开)；本页继续说明量化实现、缩放系数与后端支持条件。

**C8。** 权重包的量化描述文件 `quant_model_description.json` 里写 `kv_cache_type: C8`，并为要压的层带上缓存系数条目（键名含 `k_proj.kv_cache_scale`），再按量化权重加载（`--quantization ascend`，见[量化页 · 怎么开](quantization.md#怎么开)）。`AscendModelSlimConfig` 读到后打开 `enable_c8_quant`、记下这些层号；C8 方法给每层建 k、v 的系数与偏移参数，把这一层的 attention 实现换成 `AscendC8AttentionBackendImpl`，实例不是 KV producer 时再把缓存类型设成 INT8。开关在权重包里，启动参数不用另加。

**FA 量化。** 描述文件里 `fa_quant_type` 非空，带 `fa_k.scale` 条目的层走这条路。缓存类型由 `get_kv_quant_dtype` 决定：A5 上 FP8，其余设备 INT8；MLA 模型只压 K 一侧，也就是潜向量。生效还有门槛：`enable_fa_quant` 在 A5 以外的设备上先要求实例是 KV consumer，逐层的 `enabling_fa_quant` 再要求它是 consumer 且不是 producer，也就是 PD 分离的 decode 实例。main 上 `enable_fa_quant` 还先检查 `--kv-cache-dtype` 是否为 fp8 或 int8，设备判断改成看硬件是否支持 FP8 attention。

**稀疏 C8。** 启动参数 `--additional-config` 里的 `enable_sparse_sfa_c8`（主缓存）和 `enable_sparse_li_c8`（索引器缓存），只对稀疏模型生效；索引器 C8 可以按描述文件逐层筛选，`c8_enable_reshape_optim` 只在索引器 C8 打开时起作用。

**上游 `--kv-cache-dtype`。** vLLM v0.23.0 的可选值有 auto、bfloat16、fp8 系列、int8_per_token_head 等，是另一套入口。固定版本的 Ascend 平台对带索引器的模型会把它改回模型精度；GLM 双机的启动参数也没写它，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

| 报错 | 什么条件 | 先看什么 |
|---|---|---|
| `C8 INT8 KV cache requires block_size to be a multiple of 32, got …` | C8 的 decode（含 chunked prefill 批里的 decode 部分）读分页缓存时，每页的位置数不是 32 的倍数（断言失败） | block size 的设置 |
| `The current GQA‑related models adopt static quantization. …` | 未带 C8 静态校准权重的普通 GQA 模型在启动时传入 `--kv-cache-dtype int8`（非 `mxfp8` 分支），`attention_v1.py:583`（`main:627`）抛 `ValueError` [C63][M62] | 换用含 `kv_cache_type: C8` 与每层 scale 的 ModelSlim 权重包，或移除 `--kv-cache-dtype int8`（改用 `mxfp8` 须核对 512 页大小） |
| `MooncakeConnector does not support C8 KV cache quantization on GQA models. …` | 启动独立传输保护（`ascend_config.py:1030-1042` / `main:1138-1161`）：权重已开 `enable_c8_quant`、走 GQA 后端且 KV 传输用普通 `MooncakeConnector` [C64] | 关掉 C8，或改用发送前先量化的 `MooncakeLayerwiseConnector` |
| `fused output quantization is not yet supported for AscendC8AttentionBackendImpl` | C8 层的 attention 被要求直接输出量化结果 | 关掉 attention 输出的融合量化 |
| `The current MLA‑related models adopt static quantization. …`（仅 main） | main 上 kv-cache-dtype 设成 fp8 或 int8、实例满足 FA 量化的设备门槛，但权重包里没有 FA 量化条目 | 权重包的描述文件是否带 `fa_quant_type` |
| `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim because its indexer state cache has an independent slot mapping.` | GLM 上同时打开了索引器 C8 和它的重排优化 | 去掉这两个开关；GLM 的后端不支持稀疏 C8 |

GLM 上写了 `enable_sparse_sfa_c8` 或 `enable_sparse_li_c8`（不带重排优化），attention 后端不报错，构造时直接把它们关掉，缓存仍是 BF16。判断缓存到底是什么精度，看最终的缓存规格和启动日志，不看配置里写没写开关。

### 开销和什么时候别开

- **写入：** 每层每步多一次量化（乘、加、舍入、截断），只作用在这一步新写入的位置上；prefill 时浮点的 k、v 还要多留一份给本步用。
- **读取：** decode 不展开，读的就是 8 位；prefill 接历史时，临时张量按「这一批里最长的块表 × 每页位置数」补齐，再掩掉空位，峰值随批里最长的历史增长。
- **偏移：** 按块读回只乘系数，偏移非零的权重包读回来和写入时对不上。
- **什么时候别开：** 没有带缓存系数的权重包；任务对精度敏感、又没有评估结果；PD 分离要用整块搬运的连接器（上表第二条）；模型的 attention 后端不支持，GLM-5.3-Flash 就是这种情况。
- **怎么评估：** 同时比任务质量、实际能容纳的状态、临时显存峰值、prefill 与 decode 的延迟。本页演算数字均为教学示意设定；`Ascend 910B3` 已复现未量化 BF16 GQA 模型误传 `--kv-cache-dtype int8` 的静态权重缺失报错，带离线校准 C8 权重后的设备端精度与性能仍需按现场配置实测。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；历史 GLM-5.3-Flash 双机另钉 `db701c1f`（主缓存写死 BF16、稀疏 C8 强制关，与 `v0.23.0` 同支但不互相替代）。

| 核对维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| GQA `INT8 C8` 与页大小约束 | `quantization/methods/kv_c8.py`；需 ModelSlim 权重描述与 scale，`block_size % 32 == 0`，拦 `MooncakeConnector` 整块传输 | 同左 | 迁至 `quantization/methods/kv_cache/kv_c8.py`；仍要求 ModelSlim 量化权重、`block_size % 32 == 0`（`attention_v1.py#L1560-L1615`）与非 producer 改 INT8 | 延续同等规则与断言（`attention_v1.py#L1647-L1700`） |
| `MXFP8 C8`（`--kv-cache-dtype mxfp8`） | 无该路径 | 无该路径 | 新增面向标准 full Attention 的 `AscendC8MXFPKVCacheAttentionMethod`（`mxfp_c8.py#L51-L85`）：K 动态量化、V 静态 E8M0 scale；`AscendC8MXFPAttentionBackend.get_supported_kernel_block_sizes()` 返回 `[512]` 强制 `block_size` 为 **512 倍数**（`attention_c8_mxfp.py#L380-L410`；V scale 校验 64 整除，`#L85-L115`）；prefill/decode 统一走 QFA，拒绝 PCP/DCP、非因果与滑窗 | 延续 `MXFP8 C8` 与 `512`-token kernel 页约束（`attention_c8_mxfp.py#L393-L408`） |
| FA 量化与稀疏 SFA / LI 推导 | FA 量化在 A5 全生效、非 A5 仅 decode 生效，不看 `kv-cache-dtype`；带索引器模型平台改回模型精度 | 同左 | FA 量化先查 `--kv-cache-dtype` 为 `fp8`/`int8` 且按 `HardwareCapability.FP8_ATTENTION` 放宽角色；主 SFA KV（`cache_dtype`）与 LightningIndexer 缓存（`indexer_kv_dtype`）分别推导；GLM-5.3-Flash KPool 索引仍 BF16、尾状态 FP32 | 延续 FA 量化与稀疏推导（`modelslim_config.py#L925-L960`）；`models/glm5next/` 经可替换 MLA wrapper 决定缓存格式 |
| `TurboQuant` 与 `--kv-cache-dtype-skip-layers` | 无 `TurboQuant` 与按层跳过选项 | 同左 | 识别 `turboquant_4bit_nc`（仅 A2/A3，经 `turboquant/config.py#L24-L110` 校验 SFA 打包主缓存与 DeepSeek V4 V2-runner 压缩缓存两路，`ascend_config.py#L920-L935`）；上游支持 `--kv-cache-dtype-skip-layers`（`cache.py#L155-L157`），Ascend 在 A5 上自动将 MiniMax-M3 GQA 层加入跳过列表（`platform.py#L701-L716`） | 延续 `TurboQuant`（扩展 V2 runner 支持）与 `--kv-cache-dtype-skip-layers`（`cache.py#L285-L287`、`platform.py#L865-L880`） |

相同的“8 bit”名称不代表相同缓存对象或可互换布局；启用新精度会改变缓存 spec 与传输布局，不能直接把旧 GLM 字节账除以二。

### 源码位置

KIVI 的二位缓存、K/V 不同量化方向和未满分组保留高精度状态见论文正文与算法 [S35]；FP8 的缩放粒度、默认系数与后端限制见上游 v0.25 文档 [S36]。两者补充通用知识，不是本站设备实测结果。

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| `quantization/modelslim_config.py` / `configs/modelslim_config.py` | 读缓存量化类型、登记各层；FA 量化选 INT8/FP8，MLA 只压 K；非 A5 仅 decode 逐层生效 | 开关与逐层配方写在权重包描述文件里 |
| `quantization/methods/kv_c8.py` & `kv_cache/kv_c8.py` | 建系数与偏移、换 C8 实现、非 producer 才改 INT8 | 同一份历史在 PD 两端格式不同 |
| `attention/attention_v1.py`（`c09d3e20#L571-L587, #L1560-L1615` / `8d6180e2#L615-L631, #L1647-L1700`） | 未量化 GQA 传 `int8` 的静态权重缺失校验、C8 前向分派、写入量化、decode 直接读 8 位与 `block_size % 32 == 0` 断言、prefill 接历史展开 | 未校准权重直接拦截；分页读回不减偏移，实际配方须零偏移 |
| `ascend_config.py`（`c09d3e20#L1030-L1043` / `8d6180e2#L1138-L1161`） | `_check_mooncake_c8_kv_cache_quant`：仅在 `enable_c8_quant=True` 时拦截 GQA + 普通 `MooncakeConnector` | 与 `attention_v1.py` 的未量化权重校验分属两道独立守卫 |
| `attention/attention_c8_mxfp.py` & `kv_cache/mxfp_c8.py`（`c09d3e20` / `8d6180e2`） | `MXFP8 C8` 的 512-token kernel 页、统一 QFA 路径、PCP/DCP/滑窗拒绝与四份缓存传输 | `MXFP8 C8` 与旧 INT8 C8 传输和页约束不同 |
| `kv_cache/turboquant/config.py` & `platform.py` / `vllm/config/cache.py` | `TurboQuant` A2/A3 校验与 `--kv-cache-dtype-skip-layers`（含 A5 MiniMax-M3 GQA 自动跳过） | 稀疏低位缓存与按层回退由独立入口校验 |
| `ops/indexer_kpool_mla.py`、`attention/indexer_kpool_mla_v1.py`、`patch_mamba_config.py` | 固定 GLM `db701c1f` 主缓存 BF16、稀疏 C8 强制关与 640-token 定块规则 | 固定镜像 GLM 双机未开缓存量化 |

**来源与结论对应：**

- 写入量化公式、逐维系数、decode 直接读 8 位（`block_size % 32 == 0`）与 prefill 接历史展开见来源 1–10 及 `c09d3e20#L1560-L1615`、`8d6180e2#L1647-L1700` [C1][C3][C4][C6][C8]；「分页读回须零偏移」由两条读路均不减偏移推出 [I]。
- FA 量化与稀疏 C8、GLM 固定镜像主缓存 BF16 及 640-token 定块规则见来源 11–21、29–34、46–47 [C11][C14][C17][C21]；两份公开 GLM 快照逐键筛查未见 C8/FA/indexer 量化条目。
- `v0.30.0` / `main` 的 `MXFP8 C8`（512 页大小）、`TurboQuant`、`--kv-cache-dtype-skip-layers` 以及 GQA 静态量化权重校验与 Mooncake 独立传输保护见来源 49–66（`ced6857a`/`ba15685a` `cache.py`、`c09d3e20`/`8d6180e2` `attention_c8_mxfp.py`、`mxfp_c8.py`、`turboquant/config.py`、`platform.py`、`attention_v1.py`、`ascend_config.py` 及 `Ascend 910B3` 真机 `err3` 报错标本）[C49][C53][C55][C56][M62]。
- 示意模型（8 KV 头 × 128 维 × 32 层）、$s = 0.0125$ 算例与 2 KV 头 × 64 维 × 100 位置为教学设定 [A]；有效/按页字节减半及 GLM 代入 1 字节重算得 1,152 token 均为推导 [D]，GLM 13,056 B/token 与 561,152 B KDA 状态回链[双机部署](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)单一出处 [D]。

**待核：** `Ascend 910B3` 已复现未量化 GQA 传 `--kv-cache-dtype int8` 在 `attention_v1.py:583` 的静态权重缺失报错；现场量化产物与公开快照是否一致、实际采用的 C8 产物偏移是否为 0，以及带静态 C8 校准权重后在 A2/A5 上的精度和性能数据仍待实测。`v0.30.0` / `main` 下主缓存精度、FA 量化、MXFP8 C8 与 TurboQuant 的具体模型组合仍须按实机配置验收；“GLM 没有可开的缓存量化路”仅限定旧镜像 `db701c1f`。
