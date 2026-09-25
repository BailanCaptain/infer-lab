---
id: kv-cache-quantization
title: "KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处"
type: feature
summary: "把存起来的 K、V 从 bf16 换成 int8，每个 token 占的地方减半；代价是超出标定范围的大数会被截掉。它由模型文件决定开不开，开发主线上还要启动参数一起同意。"
aliases: [KV Cache Quantization, KV Cache 量化, KV 缓存量化, C8, C8 KV Cache, INT8 KV Cache, FAKQuant]
chapters: ["11", "17"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L928-L946
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L934-L952
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L108-L145
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/kv_c8.py#L119-L139
  - vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L430-L442
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L545-L558
  - vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L601-L674
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1400-L1433
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1483-L1504
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1506-L1542
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1756-L1792
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1395-L1398
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1435-L1481
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1670-L1683
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1561-L1619
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1721-L1736
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L609-L629
  - vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L732-L745
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L870-L894
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L367-L391
  - vllm-ascend@baa023ad:vllm_ascend/models/minimax_m3/msa_m3.py#L680-L688
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L544-L558
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L504-L505
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L123-L125
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L105-L107
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L105-L121
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1412-L1454
  - vllm-ascend@baa023ad:docs/source/tutorials/models/GLM5.2.md#L1667-L1668
  - vllm@0fc695fc:vllm/utils/torch_utils.py#L396-L402
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L483-L484
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1331-L1359
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1580-L1609
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L455-L460
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/modelslim_config.py#L586-L596
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1348-L1351
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L460-L461
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1765-L1774
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L64-L141
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: int8 是靠 create_weights 改写 layer.kv_cache_torch_dtype 进到 spec 的 dtype 里的，每块字节数随之减半
  - to: paged-attention
    kind: builds-on
    note: decode 不先解包量化 KV，而是把 int8 分页缓存和块表原样交给同一个 npu_fused_infer_attention_score
  - to: attention-cost
    kind: builds-on
    note: 每 token 每层存多少字节的基准算法在那一页，这一页只是把每个数从 2 字节换成 1 字节
  - to: kv-pool
    kind: conflicts-with
    note: GQA 模型上 Mooncake 系列连接器与 C8 同开会在启动时抛 ValueError——生产端存 bf16、消费端分配 int8，裸字节传过去会被错解
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 两者都在压 NPU 上的 KV 显存，C8 把每 token 字节减半，offload 改把冷块搬去 host 再取回
contradicts: []
updated: "2026-09-25"
---

KV Cache（模型把算过的 K 和 V 存起来、下一步直接读的那份笔记）里的每个数，原本用 2 个字节的 bf16 存；KV Cache 量化把它换成 1 个字节的 int8，**每个 token 占的地方减半**。代价是：比事先标定的范围更大的数会被截掉。在昇腾上这件事叫 **C8**，最容易踩空的不是算法，而是**开关在哪**——两个已发布的版本只看模型文件，开发主线还要启动参数一起同意。

```wiki-diagram
file: kv-cache-quantization
```

## 那条请求的笔记能不能少存一半

[那条请求](one-request.md)跑的是 Qwen3.6-35B-A3B：问题 37 个 token，回答 200 个，一共 237 个。它有 40 层，其中只有 10 层是全注意力（见[注意力：Q、K、V](attention-qkv.md)），只有这 10 层要给每个 token 存 K 和 V；另外 30 层是[线性注意力](linear-attention.md)，存的是一份固定大小的状态。

先看一颗 NPU 独跑整个模型时的基准：全注意力的一层，每个 token 要存 K 和 V 各一份，每份 2 个 KV 头、每头 256 个数，每个数 2 字节——

> 2 × 2 × 256 × 2 字节 = **2 KiB**（每 token、每层）

换成 int8，每个数 1 字节，就是 **1 KiB**。10 层加起来，每个 token 从 20 KiB 变成 10 KiB。

那条请求实际是两颗 NPU 分着跑（张量并行（TP），每颗分到 1 个 KV 头），下面的数都是**一颗 NPU 上的量**：

| 项 | bf16（原样） | int8（量化后） |
|---|---|---|
| 一层、每 token | 1 KiB | 512 字节 |
| 10 层全注意力、每 token | 10 KiB | 5 KiB |
| 这条请求 237 个 token 的 K、V | 2.3 MiB | 1.2 MiB |
| 30 层线性注意力的状态 | 30.7 MiB，实际占 60.7 MiB | **不变** |

最后一行不变，是因为量化只动存 K、V 的那几层；线性注意力那份状态不在它管的范围里。

## 存一半的代价：大数会被截掉

int8 只能表示 -128 到 127 这 256 个整数。要把一个小数塞进去，先除以一个叫 **scale** 的比例、四舍五入，超出范围的就截到边上；读的时候再乘回 scale。

看一个具体的数。假设某个通道事先标定出 scale = 0.0125，也就是乘 80：

- 1.0 存成 80，读回来正好 1.0，没有损失；
- 1.7 本该是 136，超过 127 被截成 127，读回来是 1.5875，差了 0.1125。

scale 是**离线用一批样本标定好、跟模型文件一起发的**，运行时改不了。样本里没见过的大数，只能被截断——这就是它的软肋，和[权重量化](quantization.md)的静态方案是同一个问题。

除了 K、V 本身，每层还要多存几小份 scale（K、V 各一份比例、一份偏移）。它们只和头数、头的大小有关，和请求多长无关，10 层加起来几十 KiB，可以忽略。

## 在这个模型上，省下的会被块吃掉

上面那张表说 K、V 少了一半，可这条请求**实际占的显存并不一定少**。原因在块。

显存不是一个 token 一个 token 分的，是一次给一整个 KV 块。这个模型的块大小不是随便定的，是倒着从线性注意力状态的大小算出来的：一块 KV 的字节数要和一份状态对齐（见[那条请求](one-request.md)）。原样存时，一块是 2048 个位置、每颗 NPU 20 MiB。

照开发主线上算块大小的代码推下去：每个数从 2 字节变 1 字节，为了还和状态对齐，一块的位置数翻倍成 **4096**，一块的字节数**还是 20 MiB**。于是：

- **那条 237 个 token 的请求**：原样存占 1 块 20 MiB，量化后还是 1 块 20 MiB，加上状态 60.7 MiB，一共约 80.7 MiB——**一点没省**。
- **一条 20480 个 token 的长请求**：原样存要 10 块、200 MiB；量化后一块装 4096 个，只要 5 块、100 MiB——**省一半**。

所以在这类混合模型上，KV 量化是给**长请求**省显存的；请求大多很短时，它省下的都被块的空位吃掉了。这一节是按代码推出来的，没有在这个模型上实测过。

## 开关不在命令行上

**为什么开关落在模型文件上。** scale 必须来自标定，标定结果只能跟模型文件一起发；启动参数给不出 scale。所以两个已发布的版本（v0.23、v0.26）都只看模型目录里那份量化描述文件：写明 KV 用 C8，就开；而且只给文件里标了 scale 的那些层开——**是逐层开的，不必全模型一刀切**。启动参数里的 KV 精度选项在这两个版本上没人理会。

**开发主线把启动参数请了回来，而且要两边都同意。** 模型文件说 C8、启动参数也说 int8，才开；启动参数留默认（等于模型原来的精度），就算模型文件写了 C8 也**悄悄关掉**；启动参数说 int8、模型文件却没标 scale，**直接启动失败**。最坑的是第一种：按老办法起服务，不报错，只是没量化。

还有一个例外：在把 prefill 和 decode 分到两组机器上跑的部署（[PD 分离](pd-disaggregation.md)）里，负责 prefill、往外送 KV 的那一端**不存 int8**，照样存原精度。

## 写的时候压，读的时候不先解开

**写。** 每一步先把新算出来的 K、V 按上一节的办法压成 int8，再按槽位（一个块里放一个 token 的格子）散写进 KV 块。昇腾上的 KV 块按一种特别的五维排法存，要求头的大小和块大小都是 32 的倍数；这个模型的头大小 256、块大小 2048 或 4096，都满足。

**读（decode）。** 一次吐一个 token 的时候，**不先把 int8 解回小数**：int8 的 KV 块、块表（记着请求的第几块在显存哪一块）、K 和 V 的 scale，一起交给注意力算子，还原在算子内部顺手完成。不用多搬一趟、不用额外的显存——**省显存还能顺带省时间，靠的就是这一下**；否则省下的带宽会被多出来的搬运吃回去。

## 只有命中前缀时才要多搬一趟

prefill（把问题里所有 token 一起算一遍）分两种，代价差一整趟搬运：

- **全新的问题。** 压成 int8 之前，手里还留着一份原精度的 K、V，直接拿它算，存进去的 int8 根本不用读。
- **命中了[前缀缓存](prefix-caching.md)。** 有一段 K、V 早就存在块里了，只能按块表把 int8 一块块捡出来、拼成连续的一片、乘回 scale，再算。

那条请求是第一次提问，没有前缀可命中，走的是便宜的那条。

## 一处写读不对称

压的时候除了除以 scale，还加了一个偏移；可 decode 那条路只认 scale、不认偏移，命中前缀那条路也只乘 scale。所以 **C8 实际上是按「偏移为 0」在跑**。默认偏移就是 0，平常撞不上；只有带非零偏移的模型文件才会把这个不一致暴露出来。

## MLA 模型走另一条线

DeepSeek 一类的 MLA 模型（把 K、V 压成一份更小的潜向量来存）不走 C8，认的是模型文件里另一个字段；精度看硬件——支持 FP8 注意力就用 FP8，否则用 int8；而且**只量化 K，V 保持原精度**，理由是保精度。它存的东西和普通注意力不是一回事，见[四种注意力的代价](attention-cost.md)。

## 常见误解

- **「启动时指定 KV 用 int8 就能开」**——哪个版本都不行，但不行的方式不一样：两个已发布版本上这个参数没人理，只看模型文件；开发主线上它是必要条件，不是充分条件，模型文件没标 scale 会直接启动失败。
- **「FP8 模型就是 FP8 KV Cache」**——不是一回事。官方指南里讲的原生 FP8 说的是**权重**存成 FP8，而且只支持分块量化；KV 量化是完全独立的另一条线。
- **「模型文件没带 scale 也能跑，顶多退化成不量化」**——不会。没带 scale 时每份只有一个数，第一次 decode 前要把它摆成「每头每维一个」的形状，摆不开，直接报错。
- **「KV 量化和权重量化是两个独立开关」**——出自同一份描述文件、同一次分发：矩阵层拿到权重量化，标了 scale 的注意力层拿到 KV 量化，其余注意力层照常。

## 对照源码

### 怎么开

- **发布分支（v0.23、v0.26）只认描述文件。** `_add_kvcache_quant_metadata` 读 `quant_model_description.json` 里的 `kv_cache_type`，等于 `"C8"` 就置 `enable_c8_quant`，并把出现过 `k_proj.kv_cache_scale` 的层号收进 `c8_quant_layers` [C2][C1]；`is_c8_quant_layer` 按层号查这张名单，所以是逐层开的。v0.26 上的开关判断见 [C33]。
- **一次分发同时决定权重和 KV。** `get_quant_method` 里 `LinearBase` 拿权重量化方法；`AttentionLayerBase` 依次看 `is_fa_quant_layer`、`is_indexer_quant_layer`、`is_c8_quant_layer`，命中 C8 才拿到 `AscendC8KVCacheAttentionMethod`，其余注意力层 `return None` [C7]。Qwen3.6 的 30 层线性注意力没有 `k_proj`，描述文件里不会有它们的 `k_proj.kv_cache_scale`，所以进不了名单 [D]。
- **`--quantization ascend` 可以不写。** `check_and_update_config` 会先探测模型目录，看到 `quant_model_description.json` 就自己装上量化配置，细节在[权重量化](quantization.md) [!]。
- **main 还要 `--kv-cache-dtype int8`。** GQA 后端构造时用 `kv_cache_dtype_str_to_dtype` 解析 `cache_config.cache_dtype`：落在 fp16/bf16 上就把 `enable_c8_quant` 按回 `False`；落在别的 dtype 上而描述文件没配 C8 就抛 `ValueError` [C22]。`--kv-cache-dtype` 默认 `auto` 解析出来正好是模型 dtype [C29]，所以在 main 上拿 C8 checkpoint 按老办法起服务，落进的是第一条分支。官方文档跟着改了口径：`--kv-cache-dtype int8` 在 v0.23 分支文档里一处都没有，main 的 GLM5.2 教程直接把它列进特性表 [S28]。发布分支上 `--kv-cache-dtype` 没人接：昇腾主力 GQA、MLA 后端都没声明 `supported_kv_cache_dtypes`，全仓只有 MiniMax-M3 的两个稀疏后端声明过 [C21]。
- **PD 分离的生产端不存 int8。** `create_weights` 只在 `is_kv_producer` 为假时把 `layer.kv_cache_torch_dtype` 改成 `torch.int8`，并把 `layer.impl` 换成 `AscendC8AttentionBackendImpl` [C3]。
- **scale 的准备。** 首次 forward 时 `_prepare_c8_scales` 按 TP rank 把 per-channel scale 切成本卡负责的 KV 头，整形成 `(num_kv_heads, 1, head_size)`，顺手缓存 `1/scale` 供量化用 [C8]。Qwen3.6 在 TP=2 下每颗 `num_kv_heads = 1`、`head_size = 256` [S39]。

### 会报什么错

- **main：`--kv-cache-dtype` 给了非 16 位精度、描述文件却没配 C8** → 构造 GQA 后端时 `ValueError`，提示改启动参数并准备量化权重 [C22]。
- **描述文件说 C8、却没带 scale** → `create_weights` 注册的默认 scale 是 `torch.ones(1)` [C3]；`_prepare_c8_scales` 对单元素张量原样返回，随后 `view((num_kv_heads, 1, head_size))` 需要 `num_kv_heads × head_size` 个元素（Qwen3.6 TP=2 每颗是 256），1 个元素 view 不过去，第一次 forward 就抛出来 [C8][D]。
- **GQA + C8 + Mooncake 系列连接器** → 启动即 `ValueError`；名单见下面「版本差异」[C27]。
- **块大小不是 32 的倍数** → decode 里 `assert block_size % 32 == 0` [C10]。

### 开销和什么时候别开

- **字节账（TP=2、一颗 NPU）** [D]：全注意力每 token 每层 `2 × 1 × 256 × 1 B = 512 B`（bf16 为 1 KiB，与[那条请求](one-request.md)同口径）；10 层合计 5 KiB/token；237 token 合 `237 × 5 KiB ≈ 1.16 MiB`（bf16 为 2.31 MiB）。TP=1 基准是每层 `2 × 2 × 256 × 2 B = 2 KiB` → 1 KiB [S39]。线性注意力状态（30.7 MiB，补齐后 60.7 MiB）不受 C8 影响。
- **混合模型的块大小随 `--kv-cache-dtype` 变** [C38][D]：`patch_mamba_config` 用 `cache_config.cache_dtype`（`auto` 时取模型 dtype）算 `attn_single_token_k_page_size = head_size × num_kv_heads × dtype_size`，再按 `attn_block_size = 128 × cdiv(ssm_block_page_size, 128 × attn_single_token_k_page_size)` 对齐 SSM 页。TP=2 下 `ssm_block_page_size = 16 × 128 × 128 × 4 B = 1 MiB`：bf16 时 `128 × cdiv(1 MiB, 128 × 512 B) = 2048`；int8 时 `128 × cdiv(1 MiB, 128 × 256 B) = 4096`，断言 `256 B × 4096 = 1 MiB` 成立。一块仍是 `4096 × 5 KiB = 20 MiB`，mamba 页补齐目标 `block_size × attn_token_page_size + conv 页`也不变。所以短请求的实占不降，只有跨多块的长请求才按一半算。**C8 与 Qwen3.6 这类混合模型整条路是否跑得通、是否有官方 C8 checkpoint，本页没核到。**
- **scale 的常驻开销** [D]：每个 C8 层四个张量（K、V 各一组 scale 与 offset），per-channel 时每个 `2 × 256 = 512` 个元素，按默认 dtype（bf16）存；10 层合 `10 × 4 × 512 × 2 B = 40 KiB`，与序列长度无关。
- **精度代价** [D]：`scale = 0.0125` 时 `k = 1.7` 量化成 `round(136) → clamp 127`，读回 1.5875，误差 0.1125。量化式子是 `clamp(round(x / scale + offset), -128, 127)` [C9]。
- **写与读的路径**：`npu_scatter_pa_kv_cache` 按 `slot_mapping` 把 int8 散写进缓存 [C16]；缓存看成 NZ 5D `(num_blocks, num_kv_heads, head_size / 32, block_size, 32)` [C12]，Qwen3.6 TP=2 下是 `(num_blocks, 1, 8, block_size, 32)`。decode 把 int8 5D 视图、块表、`key_antiquant_scale`、`value_antiquant_scale` 交给 `npu_fused_infer_attention_score`，`input_layout="BNSD"`、三个 antiquant mode 全填 0 [C10]，反量化在算子内部完成。
- **prefill 的两条岔路**：chunked prefill 里 `all_new_prefill` 为真就直接用量化前留下的 float K/V；否则按块表走 `_dequant_paged_kv_to_dense` gather + 乘 scale [C15]。`PrefillNoCache` 是同一个意思：`_get_fia_params` 不给块表，传下去的仍是 float KV；只有 `key.dtype == int8` 且带块表时才 gather [C14]。
- **offset 只写不读**：`_dequant_paged_kv_to_dense` 只乘 scale，注释写明 "Scale-only dequant for NZ (symmetric)" [C13]；decode 算子只收 scale；三条读路径里唯一减回 offset 的是不带块表的那条分支 [C14]。默认 offset 为 0，只有非零 offset 的 checkpoint 才会暴露 [D]。
- **MLA 走 `fa_quant_type`**：scale 挂在 `fa_q` / `fa_k` / `fa_v` 上；`get_kv_quant_dtype` 在硬件支持 FP8 注意力时用 `float8_e4m3fn`、否则 int8，`use_mla` 时只量化 K、V 保持模型 dtype [C18]。
- **什么时候别开**：请求普遍很短的混合模型（见上面块大小那条）；PD 分离里用了 Mooncake 系列连接器（启动即失败）；要开稀疏 KV Offload 时主 KV 必须 bf16（见[稀疏 KV Offload](kv-cache-sparse-offload.md)）；激活值分布明显超出校准集时（截断误差）。原生 FP8 指的是权重存成 `float8_e4m3fn`、只支持带 `weight_block_size` 的块量化 [S26]，与 KV 量化无关。

### 版本差异

下表对照 **v0.23 维护分支**（`2c59ff10`）、**v0.26 分支**（`2ed6cbba`）与 **main 开发主线**（`baa023ad`）。v0.26 不是整齐地站在哪一边：开关和两处名单还是 v0.23 的样子，scale 映射和图捕获判断已经跟了 main。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 开关 | 只看 checkpoint 的 `kv_cache_type` | 同 v0.23 | 还要 `--kv-cache-dtype` 配合，对不上就关掉、或者启动失败 [C22] | 同一个 checkpoint、同一条命令，发布分支和 main 跑的不是一件事 `[!]` |
| scale 改名 | `get_cache_scale(name)` 逐个名字映射 | 同 main | 改成返回 `WeightsMapper` 的 `get_cache_scale_mapper()` [C5] | 接口换了签名，按老办法挂 scale 的外部代码在 v0.26 上就已经过不去 `[!]` |
| 图捕获判断的位置 | 嵌在 `DecodeOnly` 分支里面 | 同 main | 提到了 `attn_state` 判断之前 [C31] | v0.26 起非 decode 的步也可能走进捕获那条路 `[!]` |
| 与 Mooncake 互斥的名单 | `MooncakeConnector`、`MooncakeConnectorV1` | 同 v0.23 | 多了 `MooncakeConnectorV2` [C27] | GQA + C8 + 名单里任一个，启动即 `ValueError` |
| `index_topk` 模型的 cache_dtype | 平台层静默改写回模型 dtype | 同 v0.23 | 这段删了，改成给 `fp8` 时断言硬件支持 FP8 注意力 [C30] | 两个发布分支上这类模型给了 `--kv-cache-dtype` 也是白给 `[!]` |

- **图捕获读的是被按掉的标志。** main 上 `enable_c8_quant` 被按回 `False` 之后，只有图捕获那条路读得到它——`full_graph_fia` 靠它决定塞不塞 antiquant 参数、要不要把 layout 换成 BNSD。所以少给参数不会当场报错，它会安静地少做事 [D]。
- **混合模型块大小**：main 的 `patch_mamba_config` 按 `--kv-cache-dtype` 算块大小 [C38]；发布分支上 C8 不经过 `--kv-cache-dtype`，块大小按模型 dtype 算，与 int8 缓存怎么对齐本页没核到。
- 主路径——量化式子、NZ 5D 布局、decode 的 antiquant 调用、chunked prefill 的两条岔路——三个分支逐字一致。

### 源码位置

| 看什么 | 文件（main） |
|---|---|
| 描述文件里的 C8 开关与层名单 | `vllm_ascend/quantization/configs/modelslim_config.py`，`_add_kvcache_quant_metadata`、`is_c8_quant_layer` |
| 按层分发量化方法 | 同上，`get_quant_method` |
| MLA 的 KV 量化 dtype | 同上，`get_kv_quant_dtype` |
| 改写层 dtype 与 impl、注册 scale | `vllm_ascend/quantization/methods/kv_cache/kv_c8.py`，`AscendC8KVCacheAttentionMethod.create_weights` |
| main 的双钥匙判断 | `vllm_ascend/attention/attention_v1.py`，GQA 后端构造函数 |
| 量化写入、decode、prefill gather | 同上，`_quantize_kv_to_int8`、`_forward_c8_decode`、`_forward_c8_chunked_prefill`、`_dequant_paged_kv_to_dense`、`_reshape_and_cache` |
| 混合模型块大小 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| Mooncake 互斥名单 | `vllm_ascend/utils.py` |
| `auto` 怎么解析成 dtype | 上游 `vllm/utils/torch_utils.py`，`kv_cache_dtype_str_to_dtype` |
