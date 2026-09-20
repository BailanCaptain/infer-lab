---
id: kv-cache-quantization
title: "KV Cache Quantization：KV 存成 int8，两个分支的开关不在同一处"
type: feature
summary: "每层的 K、V 用离线标定的静态 per-channel scale 存成 int8，decode 时连 scale 一起交给算子就地反量化。v0.23 只认 checkpoint 里的 kv_cache_type = C8，main 还要 --kv-cache-dtype 一起点头。"
aliases: [KV Cache Quantization, KV Cache 量化, KV 缓存量化, C8, C8 KV Cache, INT8 KV Cache, FAKQuant]
chapters: ["11", "17"]
sources:
  - vllm-ascend@b255ab59:vllm_ascend/quantization/configs/modelslim_config.py#L880-L898
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L934-L952
  - vllm-ascend@b255ab59:vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L108-L145
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/kv_c8.py#L119-L139
  - vllm-ascend@b255ab59:vllm_ascend/quantization/configs/modelslim_config.py#L388-L400
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L545-L558
  - vllm-ascend@b255ab59:vllm_ascend/quantization/configs/modelslim_config.py#L595-L626
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1925-L1958
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2008-L2029
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2031-L2067
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1756-L1792
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1920-L1923
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2000-L2006
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2195-L2208
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2086-L2144
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L2246-L2261
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L967-L987
  - vllm-ascend@b255ab59:vllm_ascend/quantization/configs/modelslim_config.py#L684-L697
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L866-L890
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L367-L391
  - vllm-ascend@b255ab59:vllm_ascend/models/minimax_m3/msa_m3.py#L680-L688
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L503-L517
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L504-L505
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/quantization.md#L123-L125
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L105-L107
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/quantization.md#L105-L121
  - vllm-ascend@b255ab59:vllm_ascend/utils.py#L1388-L1390
  - vllm-ascend@b255ab59:docs/source/tutorials/models/GLM5.2.md#L1668-L1669
  - vllm@0fc695fc:vllm/utils/torch_utils.py#L396-L402
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L481-L482
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1856-L1884
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1580-L1609
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
    note: 每 token 每层 4096 字节这个基准数在那一页，这一页只是把它对半砍
  - to: kv-pool
    kind: conflicts-with
    note: GQA 模型上 Mooncake 系列连接器与 C8 同开会在启动时抛 ValueError——生产端存 bf16、消费端分配 int8，裸字节传过去会被错解
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 两者都在压 NPU 上的 KV 显存，C8 把每 token 字节减半，offload 改把冷块搬去 host 再取回
contradicts: []
updated: "2026-09-20"
---

## 一句话

vllm-ascend 上的 KV cache 量化叫 **C8**：每层缓存的 K、V 用一组离线标定的静态 per-channel scale 存成 int8，**每 token 的字节数对半砍**。它最容易踩空的地方不是算法，是**开关在哪**——v0.23 维护分支只认 checkpoint 里的 `kv_cache_type = "C8"`，main 开发主线还要 `--kv-cache-dtype` 一起点头，两边对不上就要么安静地少做事、要么启动直接失败 [C22]。

```wiki-diagram
file: kv-cache-quantization
```

## 那条请求走到这里

[那条请求](one-request.md)跑的是原版 Qwen3-0.6B，模型目录里没有 `quant_model_description.json`，**所以它压根走不到这一页**。要走到这里得换两样东西：模型换成 ModelSlim 产出的 `Qwen3-0.6B-W8A8-C8`，启动参数加 `--quantization ascend`——ModelSlim 的 checkpoint 不加这个参数，整套 `AscendModelSlimConfig` 不会被装上，权重量化和 KV 量化一起失效 [S24]。在 main 上还要再加一个 `--kv-cache-dtype int8`，理由见下一节。

换完之后它的账本是这样（28 层、`n_kv = 8`、`d_h = 128`、`block_size` 128）：

| 项 | bf16 | int8 |
|---|---|---|
| 一层每 token | `2 × 8 × 128 × 2 B` = 4 KiB | `2 × 8 × 128 × 1 B` = 2 KiB |
| 全模型每 token | 112 KiB | 56 KiB |
| 一块（128 token）全模型 | 14 MiB | 7 MiB |
| 这条请求的 237 个 token | 25.9 MiB | 13.0 MiB |

后三行都是第一行乘 28 层、乘 128 格推出来的，bf16 那一列的完整推导在 [KV Cache Spec](kv-cache-spec.md) [D]。每层还要额外多背四个常量张量（K、V 各一组 scale 与 offset），per-channel 时每个有 `num_kv_heads × head_size = 1024` 个元素，28 层合起来两百多 KiB——与序列长度无关，相对每 token 省下的 56 KiB 可以忽略。

**代价看一个具体的数。** 设某通道标定出 `scale = 0.0125`，于是 `1/scale = 80`：`k = 1.0` 存成 int8 的 `80`，读回来正好 `1.0`，无损；`k = 1.7` 本该是 `136`，超出 int8 上界被 clamp 到 `127`，读回来是 `1.5875`，误差 `0.1125` [D]。这就是静态标定的软肋——scale 离线定死，运行时碰上比校准集更极端的激活值只能截断。

## v0.23 一把钥匙，main 两把

**当初为什么不做成命令行开关。** 因为 scale 必须来自校准，而校准结果只能跟 checkpoint 一起发；命令行给不出 scale，开关自然落在 checkpoint 上。v0.23 把这条走到底：`_add_kvcache_quant_metadata` 读描述文件里的 `kv_cache_type`，是 `"C8"` 就置上 `enable_c8_quant`，并把出现过 `k_proj.kv_cache_scale` 的层号收进 `c8_quant_layers` [C2]——**所以 C8 是逐层开的，不必全模型一刀切**。`--kv-cache-dtype` 那一侧则根本没人接：昇腾主力 GQA、MLA 后端都没有声明 `supported_kv_cache_dtypes`，全仓只有 MiniMax-M3 的两个稀疏后端声明过 [C21]。

**main 把这个参数请了回来。** GQA 后端构造时先把 `cache_config.cache_dtype` 解析成 torch dtype：落在 fp16/bf16 上，就把刚从 checkpoint 读来的 `enable_c8_quant` 按回 `False`；落在别的 dtype 上而 checkpoint 又没配 C8，直接抛 `ValueError` 叫你改启动参数 [C22]。而 `--kv-cache-dtype` 的默认值 `auto` 解析出来正好就是模型 dtype [C29]，**所以在 main 上拿 C8 checkpoint 按老办法起服务，落进的是第一条分支**。官方文档也跟着改了口径：`--kv-cache-dtype int8` 这个写法在 v0.23 分支的文档里一处都没有，main 的 GLM5.2 教程直接把它列进了特性表 [S28]。

这个标志被按回 `False` 之后只有图捕获那条路读得到它——`full_graph_fia` 靠它决定塞不塞 antiquant 参数、要不要把 layout 换成 BNSD。所以少给参数不会当场报错，它会安静地少做事 [D]。

## 写的时候量化，读的时候不反量化

**写。** 每步先由 `_quantize_kv_to_int8` 算 `clamp(round(x / scale + offset), -128, 127)` [C9]，再交给 `npu_scatter_pa_kv_cache` 按 `slot_mapping` 把 int8 散写进缓存。缓存被看成 NZ 5D：`(num_blocks, num_kv_heads, head_size / 32, block_size, 32)` [C12]，Qwen3-0.6B 上就是 `(num_blocks, 8, 4, 128, 32)`。`head_size` 与 `block_size` 都得被 32 整除，后者在 decode 里还有一句 assert 兜底；昇腾 GQA 后端只报 128 这一个块大小（见 [KV Cache Spec](kv-cache-spec.md)），两条都自动满足。

**读。** decode 这一路**不做任何显式反量化**：int8 缓存的 5D 视图、块表、`key_antiquant_scale` 与 `value_antiquant_scale` 一起塞给 `npu_fused_infer_attention_score`，`input_layout="BNSD"`、三个 antiquant mode 全填 0 [C10]。反量化在算子内部完成，零 gather、零额外显存——**省显存能顺带省时间就靠这一下**，否则省下的带宽会被多出来的搬运吃回去。

这条路上唯一的准备动作是 `_prepare_c8_scales`：首次 forward 时按 TP rank 把 per-channel scale 切成本卡负责的那几个 KV head，整形成 `(num_kv_heads, 1, head_size)`，顺手把 `1/scale` 缓存起来供量化用 [C8]。

## 只有命中前缀的 prefill 才付 gather 的钱

prefill 分两种，代价差一整趟搬运：

- **全新 prompt。** 量化之前留了一份 float K/V，chunked prefill 里 `all_new_prefill` 为真就直接拿这份算，缓存里的 int8 根本不读；`PrefillNoCache` 是同一个意思——`_get_fia_params` 不给块表，传下去的还是 float KV。
- **命中了前缀缓存。** 要算的这段 K/V 有一部分已经躺在缓存里，只能按块表把分页 int8 gather 出来、拼成 dense、再乘 scale 还原 [C14]。

那条 37 token 的请求是第一次提问，没有前缀命中，走的是便宜的那条（见 [Prefix Caching](prefix-caching.md)）。

## offset 写的时候加了，读的时候没减回去

量化式子里是加了 offset 的，可 decode 的算子只收 scale、不收 offset；`_dequant_paged_kv_to_dense` 也只乘 scale，注释写明 "Scale-only dequant for NZ (symmetric)" [C13]。三条读路径里唯一把 offset 减回去的，是不分页的那条分支。把它们并起来看，**C8 实际上是按对称量化在跑**；默认 offset 是 0，常规场景撞不上，只有带非零 offset 的 checkpoint 才会把这个不一致暴露出来 [D]。

**MLA 不走这条路。** DeepSeek 一类的 MLA 模型认的不是 `kv_cache_type` 而是 `fa_quant_type`，scale 挂在 `fa_q` / `fa_k` / `fa_v` 上；dtype 由 `get_kv_quant_dtype` 定——硬件支持 FP8 注意力时用 `float8_e4m3fn`、其余用 int8，而且 **MLA 只量化 K，V 保持模型 dtype**，注释给的理由就是保精度 [C18]。它存的东西和 GQA 根本不是一回事，见 [四种注意力的代价](attention-cost.md)。

## 两个分支在这一步的差别

下表对照 **v0.23 维护分支**（源码快照 `2c59ff10`）与 **main 开发主线**（源码快照 `b255ab59`）。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 开关 | 只看 checkpoint 的 `kv_cache_type` | 还要 `--kv-cache-dtype` 配合，对不上就关掉、或者启动失败 | 同一个 checkpoint、同一条命令，两个分支跑的不是一件事 `[!]` |
| scale 改名 | `get_cache_scale(name)` 逐个名字映射 | 改成返回 `WeightsMapper` 的 `get_cache_scale_mapper()` [C5] | 接口换了签名，按老办法挂 scale 的外部代码过不去 `[!]` |
| 图捕获判断的位置 | 嵌在 `DecodeOnly` 分支里面 | 提到了 `attn_state` 判断之前 [C31] | main 上非 decode 的步也可能走进捕获那条路 `[!]` |
| 与 Mooncake 互斥的名单 | `MooncakeConnector`、`MooncakeConnectorV1` | 多了 `MooncakeConnectorV2` [C27] | GQA + C8 + 名单里任一个，启动即 `ValueError` |
| `index_topk` 模型的 cache_dtype | 平台层静默改写回模型 dtype | 这段删了，改成给 `fp8` 时断言硬件支持 FP8 注意力 [C30] | v0.23 上这类模型给了 `--kv-cache-dtype` 也是白给 `[!]` |

主路径——量化式子、NZ 5D 布局、decode 的 antiquant 调用、chunked prefill 的两条岔路——两个分支逐字一致。

## 常见误解

- **「加 `--kv-cache-dtype int8` 就能开」**——两个分支都不行，但不行的方式不一样：v0.23 上没有后端认领这个参数，C8 只看 checkpoint；main 上它是必要条件而不是充分条件，没有配套 checkpoint 会直接抛 `ValueError`。
- **「FP8 checkpoint 就是 FP8 KV cache」**——不是一回事。官方指南里的 Native FP8 那一节讲的是**权重**存成 `float8_e4m3fn`，而且只支持带 `weight_block_size` 的块量化 [S26]；量化 KV 走的是 `kv_cache_type` / `fa_quant_type` 这条完全独立的线。
- **「checkpoint 没带 scale 也能跑，顶多退化成不量化」**——不会。`create_weights` 注册的默认 scale 是 `torch.ones(1)` [C3]，而 `_prepare_c8_scales` 要把它 view 成 `(num_kv_heads, 1, head_size)`，1 个元素 view 成 1024 个元素会在第一次 forward 就抛出来 [D]。
- **「C8 和权重量化是两个独立开关」**——同一份描述文件、同一次 `get_quant_method` 分发：`LinearBase` 拿到权重量化方法，`AttentionLayerBase` 且 `is_c8_quant_layer` 为真才拿到 KV 量化方法，剩下的注意力层直接 `return None` [C7]。
