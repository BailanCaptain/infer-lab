---
id: paged-attention
title: PagedAttention：分块是布局，那个算子默认不跑
type: feature
summary: 显存里的 KV 被切成一个个定长的块，这个模型一块装 2048 个 token 的笔记：要一块给一块，块和块不用挨着，靠块表找。这套分块布局一直生效；但名字叫 PagedAttention 的那个算子默认一次都不执行，默认按块读缓存的是另一个融合注意力算子。
aliases: [PagedAttention, 分页注意力, 分页 Attention, PA, PagedAttention 算子]
chapters: ["11"]
order: 20
sources:
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L101-L143
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L144
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5501-L5551
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1202-L1223
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1456-L1477
  - vllm-ascend@baa023ad:vllm_ascend/attention/utils.py#L177-L193
  - vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L104-L120
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L228-L351
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L1056-L1075
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L781-L831
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L231-L240
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1338-L1364
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L475-L475
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L242-L246
  - vllm-ascend@baa023ad:vllm_ascend/device/device_op.py#L40-L70
  - vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L47-L52
  - vllm-ascend@baa023ad:vllm_ascend/compilation/updatable_graph.py#L120-L154
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L743-L779
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L463-L490
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L534-L535
  - vllm-ascend@baa023ad:docs/source/faqs.md#L305-L307
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L60-L62
  - vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3-Dense.md#L526-L545
  - vllm-ascend@baa023ad:docs/source/tutorials/features/suffix_speculative_decoding.md#L85-L95
  - vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L55-L65
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L734-L759
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L141
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: kv-cache
    kind: builds-on
    note: 分块要解决的就是 KV Cache 吃显存这件事；缓存里存什么、为什么存得住，在那一页
  - to: graph-mode-layer
    kind: builds-on
    note: PA 的硬门槛是 cudagraph_mode 必须为 FULL_DECODE_ONLY，两个算子唯一的实质分叉也只在图捕获里
contradicts: []
updated: "2026-09-25"
---

显存里的 [KV Cache](kv-cache.md) 被切成一个个定长的 **KV 块**（后文简称块），这个模型一块装 2048 个 token 的笔记：要一块给一块，写满才要下一块，块和块在显存里不用挨着，靠[块表](block-table.md)找。这套分块布局对每条请求一直生效。**名字最误导的一点是：昇腾有个名字里就叫 PagedAttention 的算子，它默认一次都不执行**——默认按块读缓存的是另一个融合注意力算子，那个专名算子只是官方留的临时调优口子。

```wiki-diagram
file: paged-attention
```

## 给 237 个 token 的笔记找地方

[那条请求](one-request.md)一共 237 个 token（问题 37、回答 200），全注意力那 10 层每个 token 要在每颗 NPU 上留 10 KiB 笔记。麻烦在于：请求刚进来时，没人知道回答最终会有多长，显存该给它预留多少？

不分块，就得在请求进来时按部署设定的最长长度预留一段**连续**显存。这个上限通常设得很宽——模型本身最长支持 262 144 个 token——而这条请求从头到尾只写了 237 个位置。预留的地方绝大部分是永远不会写的空洞，并发一上来，显存先被空洞吃光。

分块把预留的粒度从「一整条序列」降到「一块」：这条请求一开口拿到一块 2048 个位置的块，写了 237 个、空着 1811 个，到答完也没要过第二块。**浪费的上限从「最长长度减实际长度」降到了「不足一块」。**

## 定长、按需、不连续

分块布局就三个性质，各自换来一样东西：

- **定长**：块的大小启动时定死，全程序就一个值。显存因此像棋盘格，任何空块都能给任何请求，不会剩下一段「塞不进谁」的碎片。
- **按需**：写满才要下一块。回答多长占多少，不用预知未来。
- **不连续**：新要的块拿到哪算哪，同一条请求的第 1 块和第 2 块中间可能隔着别的请求。第 300 个 token 的笔记在哪，得查块表。

代价也出在第三条：地址要查表翻译，所以**分块必须由注意力算子本身支持**——不能在算子外面先把 KV 拼回连续的再算，那样等于白分。

这套做法借的是操作系统「分页」的主意：内存按定长页管理，逻辑地址查表翻成物理地址——所以叫 PagedAttention。「页」这个字只出现在这个类比和这个专名里，存储单位一律叫「块」。

## 块为什么是 2048，不是 128

昇腾上纯注意力模型的块大小实际只有 128 一个值，自己不写也会被配置检查填上。这个模型不一样：它是混合结构，40 层里 30 层是线性注意力，那 30 层的状态在显存里要和注意力的块摆得一样齐，块大小是倒着从状态的大小算出来的——两颗 NPU 时正好 2048（怎么算的见 [block 是怎么分出来的](vllm-kv-block-allocation.md)，整笔账在[那条请求](one-request.md)）。

块越大，「不足一块」这个浪费上限就越高：一块 2048 个位置、每个位置 10 KiB，一条请求一开口就占住一颗 NPU 上的 20 MiB，哪怕只写 237 个 token。请求平均只有几十上百个 token 的高并发场景，这笔空转比笔记本身还大——大块是混合模型省状态显存的代价，不是白捡的。

## 布局一直在用，那个算子默认不跑

最容易混的是两件事：**分块布局**（上面讲的一切）和**一个恰好叫这个名字的算子**。

昇腾上有两个算子都能按块读这份缓存。默认走的是融合注意力算子，它同样吃块表、同样跳着读块；另一个名字里带 Paged 的，是官方留的临时调优口子——个别批次上它更快，等默认算子把这些场景也优化掉，这个口子就会作废。

要走到它得同时过好几道门：当前批次全在 decode、图模式取一个特定档、没开投机解码、硬件在支持名单里，最后这一步的 token 数还得命中一份手工填的清单——而这份清单默认是空的。所以**默认配置下，它一次都不会执行**。每道门对应哪个参数，在下半「怎么开」。

## 那条请求走到这里

[那条请求](one-request.md)用得上分块布局，但用不到那个专名算子。

| 这一页的东西 | 那条请求上是多少 |
|---|---|
| 一块装几个 token | 2048——混合模型专有的对齐算法定的，不是通用的 128 |
| 它占几块 | 1 块：写了 237 个位置，空着 1811 个 |
| 199 步 decode，全注意力那 10 层走哪个算子 | 全走默认的融合注意力算子——叫 PagedAttention 的那个一次都没执行 |

要走到那个算子不用换硬件也不用换模型，改几个启动参数就行。

## 常见误解

- **「昇腾后端默认就在用 PagedAttention」**——分块布局一直在用，那个同名算子默认不执行；默认按块读缓存的是融合注意力算子。
- **「填了那份 shape 清单就会生效」**——前面还有图模式和投机解码两道门。官方教程里就有一条把投机解码和这份清单一起给的命令，那条命令里它实际开不起来（出处在下半）。
- **「那份 shape 清单填的是块大小」**——填的是一步喂进算子多少个 token，和块大小无关。官方参数表只说它是个 shape 清单，没说是哪个 shape，这是最容易读错的一处。

## 对照源码

### 怎么开

**分块布局不用开，也关不掉。** 普通注意力（GQA）后端声明的缓存形状是 `(2, num_blocks, block_size, num_kv_heads, head_size)`，kernel 块大小只声明 `[128]` 一个值 [C1][C2]（MLA 系存的是潜向量与 RoPE 段两条张量，见 [MLA](mla.md)）。**前导的 2 不是张量的一个维度**——runner 拿到形状后取 `kv_cache_shape[1:]` 当 K 的形状，V 同形，各 `view` 成独立的 4 维张量 [C3]，所以算子收到的永远是 `key_cache`、`value_cache` 两个入参。那条请求 TP=2 下每颗的 K 就是 `(num_blocks, 2048, 1, 256)` [D]：`num_key_value_heads: 2` 切到两颗各剩 1 个，`head_dim: 256` [S27]。

**块大小谁定的**：普通注意力模型不写就由配置检查里的 `refresh_block_size` 填成 128，`deepseek_v4` 显式给 32/64 会保留，混合模型（`model_config.is_hybrid`）在这个函数里直接返回、不参与 [C12]；改由 `patch_mamba_config` 按「SSM 页对齐」算：`attn_block_size = kernel_block_size × cdiv(ssm_block_page_size, kernel_block_size × attn_single_token_k_page_size)`，算出来必然是 kernel 块 128 的整数倍，用户传小了会被静默抬高、只留一条 info 日志 [C28]。本模型 TP=2 代入得 2048，数值以[那条请求](one-request.md)为准。

**块表多宽**：元数据构建器把每条请求的最大块数按 `cdiv(max_model_len, 128)` 算——分母取的是后端声明的 kernel 块大小，不是配置里的块大小；列数只由上限决定，和请求实际多长无关 [C11]。

**PA 算子怎么开**：`forward_impl` 里只有一个 if，三个条件全真才走 PA：当前批次是纯 decode（`AscendAttentionState.DecodeOnly`）、这一层不是滑动窗口层、且 `using_paged_attention()` 返回真 [C4]；三个分支这段的判断条件逐字相同 [C5]。第三个条件自己又是四道门，按顺序：开了投机解码直接假；当前硬件档位没有 `PAGED_ATTENTION` 这项能力直接假（哪些硬件有见「版本差异」最后一行）；`head_size == 512` 的大头维层直接真（Gemma4 回退）；`cudagraph_mode` 不是 `FULL_DECODE_ONLY` 假；最后才看这一步的 token 数在不在 `pa_shape_list` 里 [C6][C7]。而 `pa_shape_list` 默认是空表 [C13]，所以最后一句默认恒假。

把它真正打开的配置（官方 Qwen3 高吞吐教程的原例，模型是纯注意力的 Qwen3-0.6B、单 NPU [S23]；对本页的混合模型例子，`--block-size 128` 一行不适用，块会被抬回 2048，见上）：

```bash
vllm serve /path/to/Qwen3-0.6B \
    --max-model-len 5500 \
    --block-size 128 \
    --no-enable-prefix-caching \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[4,8,16,32,48,64,96,128]}' \
    --additional-config '{"pa_shape_list":[32,48,64,96,128]}'
```

每个值的来由：`--block-size 128` 不写也会被 `refresh_block_size` 补成 128，写出来只是让配置自解释；`--no-enable-prefix-caching` **不是 PA 的前提**，它是为了让你写的 `--block-size` 保持不变——开了 prefix caching 或 chunked prefill，同一个函数会把它改回 128；`FULL_DECODE_ONLY` 是硬门槛（图模式的档位见[图模式](graph-mode-layer.md)），别的图模式下 `pa_shape_list` 是死参数；`pa_shape_list` 里填的是**这一步喂进去多少 token**，不是块大小——官方参数表只写了它是「page attention 算子的自定义 shape 列表」，没说是哪个 shape [S22]，官方示例干脆把常用批次逐个列全。还有一条不能出现：`--speculative-config`，第一道门就把它挡了；官方 suffix 投机解码教程同时给了 `--speculative-config` 和 `pa_shape_list`，那条命令里 PA 实际不会启用 [S24] `[!]`。

**开了之后换的是什么**——两个算子看到的 KV 不一样：

- **FIA**（`npu_fused_infer_attention_score`，默认路）先过 `_get_kv_cache_view`：从 `key_cache.shape` 反推出 `block_size`，把 K/V 压成三维 `(num_block, block_size, num_kv_heads × head_size)`，块表照样传；那条请求 TP=2 下每颗就是 `(num_blocks, 2048, 256)` [D]。`_get_fia_params` 的四个分支里，只有 `PrefillNoCache` 那一支把 `block_table` 设成 `None` [C10]——那一步的 K/V 还在手上，还没进缓存。
- **PA**（`_npu_paged_attention`）把 4 维的 `key_cache` / `value_cache` 原样传进去，`AscendMetadata.block_tables` 作 `block_table=`、`seq_lens` 作 `context_lens=` [C9]。

块表和 `seq_lens` 两个算子都要，不同的只是 KV 张量的维数。

### 会报什么错

混合模型的块对齐不了时启动直接断言失败：`patch_mamba_config` 里 `assert attn_single_token_k_page_size * attn_block_size == ssm_block_page_size`，报 `Cannot align ssm_page_size and attn_page_size`。本模型两颗 NPU 下整除，碰不到。

### 开销和什么时候别开

- **PA 是临时调优口子，不是长期方案**：v0.23 维护分支的源码注释写明了引入理由——某些场景下 `_npu_paged_attention` 仍比 `npu_fused_infer_attention_score` 快，等 FIA 在所有场景都更好时这条路就该删掉 [C14]；官方 FAQ 同样把它定位成 FIA 在某些 batch 上表现不佳时的临时调优口子，将来 FIA 优化完这个参数就会作废 [S21]（<https://docs.vllm.ai/projects/ascend/en/latest/faqs.html>）。没实测过收益就别配：`pa_shape_list` 填不准一格都不会命中，还白背上 `FULL_DECODE_ONLY` 和禁投机解码两条约束。
- **大块的浪费不归 PA 算子管，但常被一起问**：一块 2048 个位置、每个位置 10 KiB，一条请求起步就占一颗 NPU 上的 20 MiB；短请求、高并发时这笔浪费比 KV 本身还大，整笔账在[那条请求](one-request.md)。

### 版本差异

下表的 main 指 2026-09-21 的源码快照 `baa023ad`，v0.26 分支指 2026-09-17 的 `2ed6cbba`，v0.23 维护分支指 `2c59ff10`；完整提交号在来源里。前两行 v0.26 已经跟上 main，后两行它还站在 v0.23 这边。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| KV 写入算子 | `torch_npu._npu_reshape_and_cache`，参数名 `slot_indices` | `torch_npu.npu_scatter_pa_kv_cache`，参数名 `slot_mapping` 加 `cache_mode="Norm"` | 同 v0.26，另多一条 `use_bnsd` 的 NHSD 分支 | 对使用者透明，但抓 profiling 时算子名对不上 `[!]` |
| 图重放列表 | 存裸 9 元组，靠 `using_paged_attention` 一次性判定整张图走 PA 还是走 FIA | 存带类型的 `PagedAttentionGraphParam`（多一个 `layer_name`），重放时按 `isinstance` 逐个分流 | 换成 `UpdatableGraph`：捕获时每个算子登记一条 `GraphUpdateTask` 并记下它的 `ParamProvider`，重放时各 provider 自己 `resolve` 出要替换的入参；PA 这条由 `PAParamProvider` 交出 `context_lens` 与 `block_table` | 三种写法的效果一样：v0.26 起 PA 层和 FIA 层就能共存在同一张重放图里。但 main 上 `isinstance` 分流已经不在 `attention_v1.py` 里了，要读或改图更新逻辑得去 `compilation/updatable_graph.py` `[!]` |
| KV 张量布局 | 只有 `(2, num_blocks, block_size, n_kv, d_h)` 一种 | 同 v0.23，仍只有这一种 | 把 vLLM 的 `VLLM_KV_CACHE_LAYOUT` 设成 `HND` 或 `LBHNC` 时换成 `(2, num_blocks, n_kv, block_size, d_h)` | 换了布局 FIA 不再压三维、写入改走 `scatter_mode="NHSD"`；v0.26 上 `VLLM_KV_CACHE_LAYOUT` 在 `vllm_ascend` 里 grep 不到，不用找这个开关 `[!]` |
| PA 的硬件门 | 写死判一句「是不是 A5」 | 同 v0.23，逐字未变 | 查能力表里有没有 `PAGED_ATTENTION`；标准档的 A2、A3 有，A5 与 310P 没有 | A2、A3 的结果不变；判断依据从写死的型号换成了一张能力表 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 缓存形状、kernel 块大小 | `vllm_ascend/attention/attention_v1.py`：`get_kv_cache_shape`、`get_supported_kernel_block_sizes` |
| 形状怎么切成 K/V 两个张量 | `vllm_ascend/worker/model_runner_v1.py`，`kv_cache_shape[1:]` 那段 |
| 分岔的 if | `vllm_ascend/attention/attention_v1.py`，`forward_impl` |
| 四道门 | `vllm_ascend/attention/utils.py`，`using_paged_attention` |
| 两个算子怎么收 KV | 同文件：`_get_kv_cache_view`、`_get_fia_params`、`forward_paged_attention` |
| 普通模型块大小为什么是 128 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 混合模型块大小为什么是 2048 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| 硬件能力表 | `vllm_ascend/device/hardware_profile.py` |
| main 的图更新逻辑 | `vllm_ascend/compilation/updatable_graph.py` |
