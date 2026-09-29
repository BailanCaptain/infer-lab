---
id: kv-cache-quantization
title: "KV cache 量化：历史的 k、v 改用 8 位存，读时再乘回系数"
type: feature
summary: KV cache 量化把缓存里每个历史位置的 k、v（MLA 模型是潜向量）在写入时压成 8 位（常用 INT8）、读取时乘回缩放系数；同一段显存能多存约一倍历史，decode 每步读的缓存字节也减半，代价是写入误差一直留在缓存里。先演一个块压下去、读回来差多少，再讲 decode 与 prefill 怎样读、为什么页和整卡不一定跟着减半、Ascend 上的三条量化路；GLM 双机部署没有开它。
aliases: [KV Cache Quantization, KV cache quantization, C8, KV Cache 量化, KV 缓存量化, 缓存量化, INT8 KV cache, kv_cache_dtype, kv_cache_type, enable_c8_quant, fa_quant_type, enable_sparse_sfa_c8, enable_sparse_li_c8]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L964-L980
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/kv_c8.py#L108-L145
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1733-L1754
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1756-L1791
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1794-L1875
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1685-L1731
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L349-L372
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1568-L1606
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1650-L1682
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L1895-L1934
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L770-L779
  - vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L760-L765
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3978-L3989
  - vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L54-L71
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L280-L289
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L672-L685
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L77
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L578
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L504-L505
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L83-L86
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L112-L139
  - vllm@0fc695fc:vllm/config/cache.py#L19-L35
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/kv_c8.py#L111-L130
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/kv_c8.py#L111-L130
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L111-L130
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L460-L461
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L20-L23
  - vllm-ascend@baa023ad:tests/e2e/nightly/multi_node/internal_dp/config/GLM-5.1-W8A8C8-A3_128k_90_50.yaml#L1-L2
  - vllm-ascend@db701c1f:vllm_ascend/models/deepseek_v4.py#L152-L155
  - vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L215-L224
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L745-L754
  - vllm-ascend@baa023ad:vllm_ascend/quantization/utils.py#L267-L284
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L217-L220
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/utils.py#L217-L220
verified: []
evidence: "C"
relations:
  - {to: quantization, kind: builds-on, note: 一个数怎样压成 8 位、偏移（零点）是什么在量化页，本页讲这些数放进缓存以后怎样写、怎样读}
  - {to: kv-cache, kind: builds-on, note: KV cache 为什么要存、存多少、每步怎样读在那一页，本页讲把它存窄以后省下什么、付出什么}
  - {to: mla, kind: builds-on, note: MLA 缓存的是潜向量，MLA 模型上被压的就是这条潜向量}
  - {to: kv-cache-spec, kind: builds-on, note: 改精度改的是缓存规格里的字段，实际每页几个位置、怎样对齐看规格页}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## KV cache 量化是什么？

**KV cache 量化（KV cache quantization）把缓存里的历史换成位数更少的格式存：每个位置的 k、v 写进缓存时压成 8 位（常用 INT8 整数），读出来参与 attention 时再乘回缩放系数。** [KV cache](kv-cache.md) 是每一层为已经处理过的位置留下的 k、v，之后每生成一个 token 都要回头读它；[量化](quantization.md)是把一批数换成更窄的格式，另存一组缩放系数（scale），用的时候乘回原来的数值范围。两件事合在一起：缓存里记的还是那些历史，只是每个数从 BF16 的 2 字节变成 INT8 的 1 字节。

压的对象跟着 attention 的种类走。普通 attention 每层存 k、v 两张缓存，两张都压；[MLA](mla.md) 每个位置只存一条所有头共用的潜向量（latent），要压的就是这条潜向量。

```wiki-diagram
file: kv-cache-quantization-intuition
```

上排按 BF16 存：留给缓存的这段显存装得下 4 块。下排是同样大小的显存按 INT8 存：每块装的位置数不变，每个数只占一半宽，于是装得下 8 块，历史能多存一倍。代价是写入时多一步「压成 8 位」，读取时多一步「乘回系数」。系数本身很少：本页主讲的实现每层 k、v 各一套（各配一个偏移），随权重一起加载，不占这段显存。

## 为什么需要：缓存会占满显存，decode 每步都要读它

**缓存随历史长度和同时处理的请求数线性增长，而 decode 每生成一个 token 都要把可见的历史读一遍。每个数少一半字节，同一段显存就能多装一倍历史，每步要读的缓存字节也少一半。**

先看占多少。沿用 KV cache 页的示意模型（每层 8 个 KV 头、每头 128 维，共 32 层），BF16 下一条 4,096 token 的请求占 512 MiB，16 条同时跑就是 8 GiB，推导见[存一份要多少](kv-cache.md#存一份要多少从一个位置一层往上乘)。留给缓存的显存在启动时一次切定，装满以后新请求只能等，有时还要抢占已经在跑的请求（见[省了重算，要付什么代价](kv-cache.md#省了重算要付什么代价)）。同样 8 GiB 改按 INT8 存，能装下 32 条这样的请求，或者让 16 条请求各自的上下文长一倍。

再看读多少。decode 每步通常只给一个新位置算 q、k、v，可这个位置要和全部历史打分、再按分数取 v，所以每层每步都要把历史的 k、v 从显存读进计算单元。每读进一个数只做很少几次乘加，时间主要花在读上；缓存字节减半，这部分读取也减半。

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

取一个块里 k 的某一维，三个位置上的值是 1.0、1.006、1.7；这一维的系数 s = 0.0125，偏移取 0（都是示意数）：

```calc
title: 一维的三个历史值写进缓存再读回（示意数：s = 0.0125，偏移 0）
位置 0 存的整数 = round(1.0 ÷ 0.0125) = round(80) = 80
> 读回 0.0125 × 80 = 1.0，原样还原
位置 1 存的整数 = round(1.006 ÷ 0.0125) = round(80.48) = 80
> 读回 0.0125 × 80 = 1.0，差 0.006，这是舍入误差
位置 2 存的整数 = clamp(round(1.7 ÷ 0.0125), −128, 127) = clamp(136, −128, 127) = 127
> 读回 0.0125 × 127 = 1.5875，差 0.1125，这是截断误差
```

这一例里舍入误差最多半格，即 0.00625；1.7 超出了 127 × 0.0125 = 1.5875 这个上限，所以被截断。把 s 调大到 1.7 ÷ 127 ≈ 0.0134，截断没了，最大舍入误差却升到约 0.0067；格子粗细与范围宽窄怎样取舍，见[量化页](quantization.md#一个数怎样压下去再还原回来)。实际权重包里的系数和偏移，由它的量化方案决定。

**为什么一维一个系数。** 同一个头里不同维的数值范围可以差很多。整层共用一个系数，它就得照顾范围最大的那一维，范围小的维只能用很粗的格子；一维一个系数，各取各的。本页主讲的实现里，系数可以细到「KV 头 × 头内维度」每格一个，另配一个偏移，k、v 各一套；[tensor parallel](tensor-parallel.md) 把 KV 头分到几张卡上时，每张卡只取自己那几个头的系数。

### 一块省多少：有效数据减半，按页分配也减半

设本卡上的一层有 2 个 KV 头、每头 64 维，一条请求的历史有 100 个位置，每页装 32 个位置（示意数）：

```calc
title: 一层 k、v 两张缓存占多少（示意数：2 个 KV 头 × 64 维，100 个位置）
BF16 有效数据 = 2 × 100 × 2 × 64 × 2 B = 51,200 B = 50 KiB
> 第一个 2 是 k、v 两张缓存
INT8 有效数据 = 2 × 100 × 2 × 64 × 1 B = 25,600 B = 25 KiB
页数 = ceil(100 ÷ 32) = 4 页，共 128 个位置
BF16 实际分配 = 2 × 128 × 2 × 64 × 2 B = 65,536 B = 64 KiB
INT8 实际分配 = 2 × 128 × 2 × 64 × 1 B = 32,768 B = 32 KiB
```

最后一页只用了 4 个位置（100 − 96），剩下 28 个空着，两种格式空着的位置一样多。系数另算：k、v 各一套系数和偏移，每套 2 × 64 = 128 个数，这一层一共 512 个数，历史再长也不变。这里有效数据和按页分配都正好减半，前提是每页的位置数保持 32、没有别的对齐要求；[后面一节](#页和整卡为什么不一定跟着减半)讲这个前提什么时候不成立。

## 读回来：decode 直接读 8 位，prefill 接历史时先展开

**写入只有一种做法，读取分阶段：decode 让 attention 算子直接按块读 8 位数、在计算里乘回系数；prefill 里新算出的 k、v 直接用浮点，只有要接续已有历史时，才先把历史展开成一份临时的 BF16。**

```wiki-diagram
file: kv-cache-quantization
```

在普通 attention 模型上开 C8 时，这一段对应主线[第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里 attention 的位置；写入要用的块表和槽位，由[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)准备。GLM 的 attention 是 KDA 和稀疏 MLA，不走这条路，见[后文](#放到-glm-双机这套部署没有开-kv-cache-量化)。按图里的编号走一遍：

1. 这一层给新位置算出 k、v，此时还是 BF16。
2. 乘系数的倒数、加偏移、舍入、截断，得到 INT8。
3. 按这个位置的槽位写进块里；槽位怎样由块表和位置算出，见[位置怎样找到缓存写入处](prepare-inputs-flow.md#位置怎样找到缓存写入处)。prefill 时，第 1 步的浮点那份也留着，本步接着用。
4. prefill 没有历史（整段提示词都是这一步新算的）：直接用第 1 步的浮点 k、v。
5. prefill 要接历史（[prefix caching](prefix-caching.md) 命中了前面的块，或 [chunked prefill](chunked-prefill.md#历史状态必须跨段延续) 的后面几段）：先按块表把这条请求用到的块收拢（gather）成一张连续的临时张量，掩掉块尾空着的位置，再乘回系数得到 BF16，然后才算 attention。这张临时张量要额外的显存，还多一次格式转换。
6. decode：attention 算子拿到块表和 k、v 的系数，直接按块读 8 位数，边读边乘回系数。它不用先把整段历史展开成一份 BF16 副本，从显存读的就是 8 位的字节。

所以反量化的开销取决于执行阶段和算子接口，不只看有没有命中前缀缓存：分块 prefill 的后面几段，本来就要读前面几段留下的历史。decode 和 prefill 混在同一批时，decode 那部分仍按第 6 步直接读。第 4、5 步的分路按整批判断：chunked prefill 的一批里只要有一条 prefill 要接历史，这一批所有 prefill 都走第 5 步；收拢的内容也包括这一步刚写进去的新位置，它们读回来同样是 8 位的近似值。

**读回时只乘系数、不减偏移。** 写入时加了偏移，但按块读的两条路（decode 的融合算子、prefill 的展开）都只乘系数，源码注释写明按对称量化处理；只有不分页的那条旁路会先减偏移再乘。也就是说，这套实现实际要求偏移为 0。

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

在固定版本里，三条路的开关都不在上游 vLLM 的 kv-cache-dtype 选项上：C8 和 FA 量化写在权重包的量化描述文件里（FA 量化这个名字就取自打开它的键 fa_quant_type），稀疏 C8 写在启动时的附加配置里，具体键名见[怎么开](#怎么开)；main 上 FA 量化另要求 kv-cache-dtype 设成 fp8 或 int8，见[版本差异](#版本差异)。FA 量化在 A2、A3 上还有一道门槛：实例必须是 [PD 分离](pd-disaggregation.md)里做 decode、接收缓存的那一端（KV consumer），普通部署在描述文件里写了它也不会压缓存。MLA 那一行只压潜向量，是因为 vllm-ascend 的 MLA 缓存把潜向量放在 K 一侧、RoPE 段放在 V 一侧，而 FA 量化对 MLA 模型只压 K 一侧，源码注释说这样做是为了保精度。个别模型在自己的代码里另定缓存精度，例如 DeepSeek-V4 在 A5 上直接把缓存建成 FP8，不属于这三条路。

### PD 分离时，两端的缓存格式不一样

C8 只让「不是 KV producer」的实例把缓存建成 INT8：普通部署，以及 [PD 分离](pd-disaggregation.md)里做 decode、接收缓存的那一端。做 prefill、把缓存发出去的 producer 仍按 BF16 存，但同样换上 C8 的 attention 实现。于是同一份历史，两端的字节格式不同：原样整块搬过去，接收端会把 BF16 的字节当成 INT8 来读。

固定版本在启动时专门拦这一种组合：普通 GQA 模型开了 C8、又用 [MooncakeConnector](mooncake-connector.md) 整块传输，直接报错，提示关掉 C8，或者改用逐层传输的 MooncakeLayerwiseConnector，它在发送前先把缓存压成 8 位。这条检查说明的是接口约束，不是 GLM 或某种 PD 组合的实测结论。

## 放到 GLM 双机：这套部署没有开 KV cache 量化

**[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)的 KV cache 全部按原精度存：稀疏 MLA 的主缓存（潜向量）和索引器的压缩缓存是 BF16，索引器的尾状态是 FP32。上面三条量化路，这套部署一条都没走。本节讲为什么没走、要是想开会碰到什么，不是这套部署的量化效果。**

### 三处代码把缓存精度定死

- GLM 的稀疏 MLA 缓存层建主缓存时，直接把精度写成 BF16，代码注释说所有设备上都保持 BF16。
- GLM 用的 attention 后端继承自稀疏 MLA 的通用后端，但在构造时把稀疏 C8 的两个开关（主缓存、索引器缓存）强制关掉；如果启动时打开了索引器 C8 的重排优化，会直接报错。
- 带索引器的模型（配置里有 index_topk，GLM 取 2,048）在 Ascend 平台初始化时，缓存精度被改回模型本身的精度，启动时传了 kv-cache-dtype 也不生效。这套部署的启动参数本来也没写这一项，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

FA 量化还多一条走不到的理由：它在 A2 上只对 PD 分离的 decode 端生效，这套部署没有做 PD 分离。

W8A8 只管权重和激活（见[哪些矩阵是 8 位](quantization.md#哪些矩阵是-8-位哪些保持-bf16)），和缓存精度是两件事：这套部署开着 W8A8，缓存仍是 BF16。

### 缓存里的字节主要是潜向量

每张卡上，每个 token 在 12 个存 KV 的层（主干 11 层稀疏 MLA 加 MTP 第 45 层；[MTP](speculative-decoding.md) 是模型自带、用来生成投机草稿的预测层）里合计占 13,056 B，其中潜向量 12,288 B、索引器压缩缓存 768 B，都是 BF16；推导见[占住一个块号，要用多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。要压的话，对象主要是潜向量这一份，也就是 [MLA 页](mla.md#每个位置缓存多少字节)讲的那条 512 维潜向量。

### 假如只把潜向量压成 1 字节，块数会翻倍吗

**不会简单翻倍，因为 GLM 的块大小是按缓存精度凑出来的。** 一个逻辑块取 640 个 token，是为了让一块的 MLA 页装得下一层 [KDA](linear-attention.md)（GLM 用的线性 attention）在一条请求上的递推状态（561,152 B），推导见[为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。这条规则按缓存精度的字节数算每个 token 的页大小。把同一条规则代入 1 字节：

```calc
title: 同一条定块规则代入 1 字节（假设推算，不是部署状态）
每 token 每层的潜向量 = 512 × 1 B = 512 B
要几个 128 token 的 kernel 块 = ceil(561,152 ÷ (128 × 512)) = ceil(8.5625) = 9
逻辑块大小 = 128 × 9 = 1,152 个 token
```

逻辑块从 640 个 token 变成 1,152 个，每个块号占多少字节、预算能切出多少块，都要整个重算；KDA 递推状态本身（每层每条请求 561,152 B，一条请求固定占 12 个块号，见[为什么短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)）不属于潜向量缓存，压潜向量不会让它变小。所以「潜向量字节减半」推不出「块数翻倍」或「能多装一倍请求」。这里只是把规则代进去看方向：固定版本里 GLM 的缓存精度不会变成 1 字节。

## 常见误解

- **「开了 W8A8，KV cache 自然也是 8 位。」** W8A8 只管权重和激活，缓存精度由另外的开关决定。GLM 双机开着 W8A8，缓存仍是 BF16。
- **「缓存量化以后，块数和能跑的请求数都翻倍。」** 翻倍的只是有效数据。每页的位置数、混合模型的页对齐、不是 k、v 的状态、临时工作区都会让实际容量偏离一倍；GLM 的定块规则代入 1 字节后，块大小本身就变了。
- **「读 8 位缓存要先把整段历史还原成 BF16。」** decode 的融合算子直接读 8 位、边读边乘回系数；只有 prefill 接历史时才展开一份临时副本。
- **「量化误差只影响当前这一步。」** 每个位置只在写入时压一次，之后每一步读的都是这份近似值，误差会带进后面所有步的打分和加权求和。
- **「只有前缀缓存命中才有反量化开销。」** 分块 prefill 的后面几段同样要读前面几段的历史，也走展开这条路。
- **「名字里带 C8 的配置，这套部署也能照开。」** v0.23、v0.26、main 三个对照版本的测试里有 GLM-5.1、GLM-5.2 带 C8 的多机配置（W8A8C8，部分版本的 GLM-5.2 是 W4A8C8；固定镜像里只有 GLM-4.7-W8A8C8），那是别的模型；GLM-5.3-Flash 的后端把稀疏 C8 强制关掉，主缓存精度写死为 BF16。
- **「系数和缓存块一起增长。」** 要看是哪条路：C8 和 FA 量化的系数每层一组、随权重加载，和历史长短无关；稀疏 C8 把系数打包进缓存块，随块一起分配。

## 对照源码

### 怎么开

**C8。** 权重包的量化描述文件 `quant_model_description.json` 里写 `kv_cache_type: C8`，并为要压的层带上缓存系数条目（键名含 `k_proj.kv_cache_scale`），再按量化权重加载（`--quantization ascend`，见[量化页 · 怎么开](quantization.md#怎么开)）。`AscendModelSlimConfig` 读到后打开 `enable_c8_quant`、记下这些层号；C8 方法给每层建 k、v 的系数与偏移参数，把这一层的 attention 实现换成 `AscendC8AttentionBackendImpl`，实例不是 KV producer 时再把缓存类型设成 INT8。开关在权重包里，启动参数不用另加。

**FA 量化。** 描述文件里 `fa_quant_type` 非空，带 `fa_k.scale` 条目的层走这条路。缓存类型由 `get_kv_quant_dtype` 决定：A5 上 FP8，其余设备 INT8；MLA 模型只压 K 一侧，也就是潜向量。生效还有门槛：`enable_fa_quant` 在 A5 以外的设备上先要求实例是 KV consumer，逐层的 `enabling_fa_quant` 再要求它是 consumer 且不是 producer，也就是 PD 分离的 decode 实例。main 上 `enable_fa_quant` 还先检查 `--kv-cache-dtype` 是否为 fp8 或 int8，设备判断改成看硬件是否支持 FP8 attention。

**稀疏 C8。** 启动参数 `--additional-config` 里的 `enable_sparse_sfa_c8`（主缓存）和 `enable_sparse_li_c8`（索引器缓存），只对稀疏模型生效；索引器 C8 可以按描述文件逐层筛选，`c8_enable_reshape_optim` 只在索引器 C8 打开时起作用。

**上游 `--kv-cache-dtype`。** vLLM v0.23.0 的可选值有 auto、bfloat16、fp8 系列、int8_per_token_head 等，是另一套入口。固定版本的 Ascend 平台对带索引器的模型会把它改回模型精度；GLM 双机的启动参数也没写它，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

### 会报什么错

| 报错 | 什么条件 | 先看什么 |
|---|---|---|
| `C8 INT8 KV cache requires block_size to be a multiple of 32, got …` | C8 的 decode（含 chunked prefill 批里的 decode 部分）读分页缓存时，每页的位置数不是 32 的倍数（断言失败） | block size 的设置 |
| `MooncakeConnector does not support C8 KV cache quantization on GQA models. …` | 启动检查：开了 C8、走 GQA 后端、KV 传输用 MooncakeConnector | 关掉 C8，或改用 MooncakeLayerwiseConnector |
| `fused output quantization is not yet supported for AscendC8AttentionBackendImpl` | C8 层的 attention 被要求直接输出量化结果 | 关掉 attention 输出的融合量化 |
| `The current MLA‑related models adopt static quantization. …`（仅 main） | main 上 kv-cache-dtype 设成 fp8 或 int8、实例满足 FA 量化的设备门槛，但权重包里没有 FA 量化条目 | 权重包的描述文件是否带 `fa_quant_type` |
| `GLM-5 Indexer KPool MLA does not support c8_enable_reshape_optim because its indexer state cache has an independent slot mapping.` | GLM 上同时打开了索引器 C8 和它的重排优化 | 去掉这两个开关；GLM 的后端不支持稀疏 C8 |

GLM 上写了 `enable_sparse_sfa_c8` 或 `enable_sparse_li_c8`（不带重排优化），attention 后端不报错，构造时直接把它们关掉，缓存仍是 BF16。判断缓存到底是什么精度，看最终的缓存规格和启动日志，不看配置里写没写开关。

### 开销和什么时候别开

- **写入：** 每层每步多一次量化（乘、加、舍入、截断），只作用在这一步新写入的位置上；prefill 时浮点的 k、v 还要多留一份给本步用。
- **读取：** decode 不展开，读的就是 8 位；prefill 接历史时，临时张量按「这一批里最长的块表 × 每页位置数」补齐，再掩掉空位，峰值随批里最长的历史增长。
- **偏移：** 按块读回只乘系数，偏移非零的权重包读回来和写入时对不上。
- **什么时候别开：** 没有带缓存系数的权重包；任务对精度敏感、又没有评估结果；PD 分离要用整块搬运的连接器（上表第二条）；模型的 attention 后端不支持，GLM-5.3-Flash 就是这种情况。
- **怎么评估：** 同时比任务质量、实际能容纳的状态、临时显存峰值、prefill 与 decode 的延迟。本页核实的是固定源码的机制，数字都是示意数演算，没有设备上的性能或精度实测。

### 版本差异

三个对照版本都有 C8、FA 量化和稀疏 C8 三条路，C8 的 producer 规则、32 倍数断言和 Mooncake 启动检查也一致；差别在文件位置、带索引器模型的缓存精度改写、FA 量化的生效门槛，以及有没有 GLM-5.3-Flash 的代码。

| 对照版本 | C8 方法所在 | 带索引器模型的缓存精度 | FA 量化的生效门槛 | GLM-5.3-Flash |
|---|---|---|---|---|
| v0.23：Ascend 2c59ff10 | `quantization/methods/kv_c8.py` | 平台初始化时改回模型精度 | A5 全部生效；其余设备只在 decode 实例生效；不看 kv-cache-dtype | 没有模型代码 |
| 固定镜像：Ascend db701c1f | 同上 | 同上 | 同上 | 主缓存写死 BF16，稀疏 C8 强制关 |
| v0.26：Ascend 2ed6cbba | 同上 | 同上 | 同上 | 没有模型代码 |
| main：Ascend baa023ad | 移到 `quantization/methods/kv_cache/kv_c8.py`，配置类移到 `quantization/configs/` | 平台里这段改写已去掉 | 先要求 kv-cache-dtype 为 fp8 或 int8；设备判断改成硬件是否支持 FP8 attention；缺 FA 量化条目时报错 | 移到 `models/glm5next/`，主缓存改由上游 MLA 层建 |

上游 vLLM 只核了 v0.23.0（0fc695fc）的 kv-cache-dtype 可选值。固定镜像与 v0.23 维护分支的 C8 代码行号相同，但固定镜像以 db701c1f 为准，不能只凭同属 v0.23 就互相代替。

### 源码位置

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| quantization/modelslim_config.py，964–980、770–779、745–754 行 | 读缓存量化类型、登记各层；FA 量化选 INT8 或 FP8，MLA 只压 K；非 A5 只在 decode 实例逐层生效 | 开关写在权重包的描述文件里 |
| quantization/utils.py，215–224 行 | FA 量化总开关：非 A5 且不是 KV consumer 直接返回否 | 普通 A2 部署走不到 FA 量化 |
| quantization/methods/kv_c8.py，108–145 行 | 建系数与偏移、换 C8 实现、非 producer 才改 INT8 | 同一份历史在 PD 两端格式不同 |
| attention/attention_v1.py，1568–1606 行 | C8 前向：先量化写入，再按阶段分路；不支持输出融合量化 | 写入一种做法，读取分阶段 |
| 同文件 1650–1682、1733–1754 行 | 按 KV 头切系数、预算倒数；写入时乘倒数、加偏移、舍入、截断 | 一维一个系数 |
| 同文件 1685–1731、1756–1791、1794–1875、1895–1934 行 | 收拢展开、decode 直接读 8 位、分块 prefill 分路、整段 prefill 与前缀命中 | 只有 prefill 接历史时才展开 |
| ascend_config.py，280–289、349–372 行 | 稀疏 C8 的两个开关；C8 与 MooncakeConnector 的启动检查 | 开关与接口约束 |
| attention/mla_v1.py，760–765 行；worker/model_runner_v1.py，3978–3989 行 | FA 量化层的缓存类型；MLA 缓存的 K 一侧是潜向量、V 一侧是 RoPE 段 | FA 量化压的是潜向量 |
| core/kv_cache_interface.py，54–71 行；attention/sfa_v1.py，672–685 行 | 稀疏 C8 的缓存布局与两个含义 | 系数随块存 |
| ops/indexer_kpool_mla.py，69–77 行；attention/indexer_kpool_mla_v1.py，557–578 行；platform.py，504–505 行 | GLM 主缓存写死 BF16；稀疏 C8 强制关；带索引器模型改回模型精度 | GLM 双机没有开缓存量化 |
| patch/platform/patch_mamba_config.py，83–86、112–139 行 | 定块规则按缓存精度的字节数算每 token 页大小 | 改精度会改块大小 |
| 上游 vllm 的 config/cache.py，19–35 行 | kv-cache-dtype 的可选值 | 上游入口与 Ascend 的描述文件是两套 |

**来源与结论对应：**

- 写入时乘倒数、加偏移、舍入、截到 −128…127，对照第 3 项来源。[C3] 系数按「KV 头 × 头内维度」取、TP 下按 KV 头切、预先算好倒数，对照第 9 项来源。[C9]
- C8 前向先量化写入、prefill 保留浮点 k、v、按 decode / 分块 prefill / 其他三路分派，以及不支持输出融合量化，对照第 8 项来源。[C8] decode 直接读分页 INT8、只传系数、要求每页位置数是 32 的倍数，对照第 4 项来源。[C4]
- 分块 prefill 的分路、整段 prefill 用浮点与前缀命中时展开，对照第 5、10 项来源；展开时的收拢、掩码与只乘系数，对照第 6 项来源。[C6] 「这套实现实际要求偏移为 0」是由两条读路都不减偏移推出的。[I]
- C8 由描述文件登记，对照第 1 项来源。[C1] 建系数与偏移、换实现、只有非 producer 改 INT8，对照第 2 项来源。[C2] Mooncake 启动检查与改用逐层连接器的提示，对照第 7 项来源。[C7]
- FA 量化选 INT8 或 FP8、MLA 只压 K，对照第 11、12 项来源。[C11] 非 A5 设备只在 KV consumer / decode 实例生效，对照第 30、31 项来源（v0.23、v0.26 同样写法见第 33、34 项）。[C30] main 上先查 kv-cache-dtype、按硬件能力判断、缺条目报错，对照第 32 项来源。 MLA 缓存的 K 一侧是潜向量、V 一侧是 RoPE 段，对照第 13 项来源。[C13] 稀疏 C8 的缓存布局与两个开关，对照第 14–16 项来源。[C14] DeepSeek-V4 在 A5 上自定 FP8，对照第 29 项来源。
- GLM 主缓存写死 BF16、稀疏 C8 强制关与重排优化报错、带索引器模型改回模型精度，对照第 17–19 项来源。[C17][C18][C19]
- 定块规则按缓存精度的字节数算页大小，对照第 20、21 项来源。[C21] 代入 1 字节得到 1,152 个 token 是本页推算，不是部署状态。[D]
- 上游 kv-cache-dtype 的可选值对照第 22 项来源。[C22] 三个版本的 C8 方法、平台改写与 main 上 GLM 主缓存的建法，对照第 23–27 项来源；GLM-5.1 的 W8A8C8 测试配置对照第 28 项来源。
- 示意模型（每层 8 个 KV 头、128 维、32 层）、s = 0.0125 的三个值、2 个 KV 头 × 64 维 × 100 个位置都是教学设定。[A] 同样 8 GiB 装 32 条请求、有效数据与按页分配减半，是按每个数 1 字节推出的。[D] GLM 每 token 13,056 B 及其拆分、561,152 B 的 KDA 状态、每条请求 12 个 KDA 块号，引自[双机部署](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)的统一账单。[D]

**待核：** 部署权重包的 `quant_model_description.json` 本机没有，无法从文件本身确认里面没有 `kv_cache_type`、`fa_quant_type` 等缓存量化条目，文件到手后先查这几个键；已发布的 C8 权重包里缓存偏移是否全为 0；main 上 GLM 主缓存改由上游 MLA 层建，精度是否仍固定为 BF16、能否接 FA 量化；三条量化路在 A2 上的精度与性能没有实测数，GLM-5.3-Flash 没有可开的缓存量化路，收益无从测。
