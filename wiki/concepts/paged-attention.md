---
id: paged-attention
title: PagedAttention：分块是布局，那个算子默认不跑
type: feature
summary: 昇腾把每层 KV 切成 128 token 的定长块，算子拿块表跳着读。但叫 _npu_paged_attention 的那个算子默认永远不执行——默认按块读 KV 的是 FIA。
aliases: [分页注意力, 分页 Attention, PA, PagedAttention 算子]
chapters: ["11"]
order: 20
sources:
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L106-L148
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L144
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5225-L5275
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1725-L1746
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1456-L1477
  - vllm-ascend@b255ab59:vllm_ascend/attention/utils.py#L225-L241
  - vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L104-L120
  - vllm-ascend@b255ab59:vllm_ascend/device/hardware_profile.py#L137-L259
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1579-L1598
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1304-L1354
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L236-L245
  - vllm-ascend@b255ab59:vllm_ascend/utils.py#L1274-L1300
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L474-L474
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L242-L246
  - vllm-ascend@b255ab59:vllm_ascend/device/device_op.py#L40-L70
  - vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L47-L52
  - vllm-ascend@b255ab59:vllm_ascend/attention/utils.py#L102-L157
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L824-L849
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L463-L490
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L493-L494
  - vllm-ascend@b255ab59:docs/source/faqs.md#L305-L307
  - vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L60-L62
  - vllm-ascend@b255ab59:docs/source/tutorials/models/Qwen3-Dense.md#L526-L545
  - vllm-ascend@b255ab59:docs/source/tutorials/features/suffix_speculative_decoding.md#L85-L95
evidence: "C"
relations:
  - to: kv-cache
    kind: builds-on
    note: 分块要解决的就是 KV Cache 吃显存这件事；缓存里存什么、为什么存得住，在那一页
  - to: graph-mode-layer
    kind: builds-on
    note: PA 的硬门槛是 cudagraph_mode 必须为 FULL_DECODE_ONLY，两个算子唯一的实质分叉也只在图捕获里
contradicts: []
updated: "2026-09-20"
---

## 一句话

昇腾把每层的 K、V 各存成一个大张量，一块固定装 128 个 token，decode 时算子拿着[块表](block-table.md)逐行跳读，不要求一条序列的 KV 在显存里连续。**名字最误导的一点是：这套分块布局一直生效，叫 `_npu_paged_attention` 的那个算子却默认不执行**——默认按块读 KV 的是 FIA（`npu_fused_infer_attention_score`），它同样吃块表。官方把 PA 定位成 FIA 在某些 batch 上表现不佳时的临时调优口子，将来 FIA 优化完这个参数就会作废 [S21]（<https://docs.vllm.ai/projects/ascend/en/latest/faqs.html>）。

```wiki-diagram
file: paged-attention
```

## 那条请求走到这里

[那条请求](one-request.md)用得上分块布局，但**用不到 PA 算子**。

| 这一页的东西 | 那条请求上是多少 |
|---|---|
| 一块装几个 token | 128。后端只声明支持这一个值 |
| 它占几块 | 2 块；第 0 块 128 格写满，第 1 块只用了 109 格 |
| 块表多宽 | `cdiv(max_model_len, 128)` 列，列数只由上限决定，和它实际多长无关 [C11] |
| 199 步 decode 走哪个算子 | 全走 FIA——`pa_shape_list` 默认是空表 |

最后一行是这一页的要点：**单卡、默认配置下，这条请求一次都碰不到 `_npu_paged_attention`**。要走到它不用换硬件也不用换模型，改几个启动参数就行，配置见「默认跑的不是 PagedAttention 算子」那一节。

## 分块省的是什么，代价是什么

不分块就得按 `max_model_len` 给每条序列预留一段连续显存。那条请求只要 237 个 token 的位置，却要按上限占满；并发一上来，显存全被没写过的空洞吃掉。分块把预留的粒度从「一条序列」降到「128 个 token」，浪费上限从 `max_model_len − 实际长度` 降到不足一块——就是那条请求第 1 块尾巴上空着的 19 格 [D]。

代价是地址不再连续：第 300 个 token 在哪，得查表。所以**分块必须由 attention 算子本身支持**——不能在算子外面先把 KV 拼回连续的再算，那样等于白分。块大小也就没有了选择余地：`get_supported_kernel_block_sizes` 只返回 `[128]` [C1][C2]。

昇腾侧比上游多出来的那件事是：有两个算子都能按块读。v0.23 维护分支的源码注释写明了引入 PA 的理由——在某些场景下 `_npu_paged_attention` 仍比 `npu_fused_infer_attention_score` 快，等 FIA 在所有场景都更好时这条路就该删掉 [C14]。

## 默认跑的不是 PagedAttention 算子

`forward_impl` 里只有一个 if，三个条件全真才走 PA：当前批次是纯 decode（`AscendAttentionState.DecodeOnly`）、这一层不是滑动窗口层、且 `using_paged_attention()` 返回真 [C4][C5]。两版这段逐字相同。

第三个条件自己又是四道门，按顺序：开了投机解码直接假；当前硬件档位没有 `PAGED_ATTENTION` 这项能力直接假（哪些硬件有这项能力见下面那张表）；`head_size == 512` 的大头维层直接真（Gemma4 回退）；`cudagraph_mode` 不是 `FULL_DECODE_ONLY` 假；最后才看这一步的 token 数在不在 `pa_shape_list` 里 [C6][C7]。而 `pa_shape_list` 默认是空表 [C13]，所以最后一句默认恒假。

把它真正打开的配置（照官方 Qwen3 高吞吐示例裁到单卡 [S23]）：

```bash
vllm serve /path/to/Qwen3-0.6B \
    --max-model-len 5500 \
    --block-size 128 \
    --no-enable-prefix-caching \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[4,8,16,32,48,64,96,128]}' \
    --additional-config '{"pa_shape_list":[32,48,64,96,128]}'
```

每个值的来由：`--block-size 128` 是后端唯一支持的值，不写也会被 `refresh_block_size` 补成 128，写出来只是让配置自解释；`--no-enable-prefix-caching` **不是 PA 的前提**，它是为了让你写的 `--block-size` 保持不变——开了 prefix caching 或 chunked prefill，同一个函数会把它改回 128 [C12]；`FULL_DECODE_ONLY` 是硬门槛，别的图模式下 `pa_shape_list` 是死参数；`pa_shape_list` 里填的是**这一步喂进去多少 token**，不是块大小，官方示例干脆把 32 到 256 逐个列全。还有一条不能出现：`--speculative-config`，第一道门就把它挡了。

## 两个算子看到的 KV 不一样

后端声明的形状是 `(2, num_blocks, 128, num_kv_heads, head_size)`。**前导的 2 不是张量的一个维度**——runner 拿到形状后取 `kv_cache_shape[1:]` 当 K 的形状，V 同形，各 `view` 成一个独立的 4 维张量 [C3]。所以算子收到的永远是 `key_cache`、`value_cache` 两个入参，不是一个 5 维张量。从这里开始两条路分开：

- **PA** 把 4 维的 `key_cache` / `value_cache` 原样传进去，`AscendMetadata.block_tables` 作 `block_table=`、`seq_lens` 作 `context_lens=` [C9]。
- **FIA** 先过 `_get_kv_cache_view`：从 `key_cache.shape` 反推出 `block_size`，再把 K/V 压成三维 `(num_block, 128, num_kv_heads × head_size)`，块表照样传。那条请求上就是 `(num_blocks, 128, 1024)`。

`_get_fia_params` 的四个分支里，只有 `PrefillNoCache` 那一支把 `block_table` 设成 `None` [C10]——那一步的 K/V 还在手上，还没进缓存。

## v0.23 维护分支与 main 的四处差异

下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`；完整提交号在来源里。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| KV 写入算子 | `torch_npu._npu_reshape_and_cache`，参数名 `slot_indices` [C16] | `torch_npu.npu_scatter_pa_kv_cache`，参数名 `slot_mapping` 加 `cache_mode="Norm"` [C15] | 对使用者透明，但抓 profiling 时算子名对不上 `[!]` |
| 图重放列表 | 存裸 9 元组，靠 `using_paged_attention` 一次性判定整张图走 PA 还是走 FIA [C19] | 存带类型的 `PagedAttentionGraphParam`（多一个 `layer_name`），重放时按 `isinstance` 逐个分流 [C17][C18] | 只有 main 能让 PA 层和 FIA 层共存在同一张重放图里 `[!]` |
| KV 张量布局 | 只有 `(2, num_blocks, 128, n_kv, d_h)` 一种 | 把 vLLM 的 `VLLM_KV_CACHE_LAYOUT` 设成 `HND` 或 `LBHNC` 时换成 `(2, num_blocks, n_kv, 128, d_h)` [C1] | 换了布局 FIA 不再压三维、写入改走 `scatter_mode="NHSD"` [C20]；不设这个环境变量就还是原来那套 `[!]` |
| PA 的硬件门 | 写死判一句「是不是 A5」 | 查能力表里有没有 `PAGED_ATTENTION`；标准档的 A2、A3 有，A5 与 310P 没有 [C8] | A2、A3 的结果不变；判断依据从写死的型号换成了一张能力表 |

## 常见误解

- **「昇腾后端默认在用 PagedAttention 算子」**——分块布局一直在用，但 `_npu_paged_attention` 默认不执行：`pa_shape_list` 默认空，`using_paged_attention` 最后一句恒假。默认按块读 KV 的是 FIA。
- **「配了 `pa_shape_list` 就会生效」**——还得 `cudagraph_mode == FULL_DECODE_ONLY` 且没开投机解码。官方的 suffix 投机解码教程同时给了 `--speculative-config` 和 `pa_shape_list`，而第一道门就在 `speculative_config` 非 None 时返回 False——那条命令里 PA 实际不会启用 [S24] `[!]`。
- **「`pa_shape_list` 填的是块大小或候选块大小」**——填的是这一步喂进去的 token 数，和 `--block-size` 无关。官方参数表只写了它是「page attention 算子的自定义 shape 列表」，没说是哪个 shape [S22]，这是最容易读错的一处。
