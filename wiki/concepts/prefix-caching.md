---
id: prefix-caching
title: "前缀缓存：命中的是整块，不是 token"
type: feature
summary: 两条请求开头一样，开头那些块直接拿来用、不重算；但它只认写满的整块，而这个模型一块就是 2048 个 token，而且在已发布的版本上默认是关着的。
aliases: [Prefix Caching, 前缀缓存, 自动前缀缓存, Automatic Prefix Caching, APC]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1344-L1364
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1386-L1406
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1244-L1248
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L669-L671
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1662-L1689
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1506
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1273-L1282
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L146-L151
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L790-L855
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1174-L1210
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L96-L138
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L127-L147
  - vllm-ascend@baa023ad:tests/ut/patch/platform/test_prefix_cache_cp_patches.py#L373-L397
  - vllm-ascend@baa023ad:vllm_ascend/models/layer/attention/layer.py#L133-L139
  - vllm-ascend@2c59ff10:vllm_ascend/models/layer/attention/layer.py#L114-L120
  - vllm-ascend@baa023ad:vllm_ascend/attention/dsa_v1.py#L276-L303
  - vllm-ascend@baa023ad:vllm_ascend/_310p/worker/v2/model_runner.py#L173-L207
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L182-L185
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L141-L143
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/feature_matrix.md#L17-L18
  - vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L2231-L2231
  - vllm-ascend@baa023ad:tests/e2e/pull_request/two_card/test_prefix_caching.py#L63-L90
  - https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
  - vllm-ascend@baa023ad:vllm_ascend/_310p/worker/v2/model_runner.py#L411-L420
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L28-L61
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2374-L2409
  - vllm@0fc695fc:vllm/config/model.py#L1851-L1856
  - vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2522
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2773-L2813
  - vllm@84030bbe:vllm/config/model.py#L2135-L2139
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L394
  - vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L638
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L216
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L141
  - vllm@0fc695fc:vllm/config/cache.py#L133-L141
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L222-L228
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 命中与否在 get_computed_blocks 里判定，「只有写满的块才进哈希表」这条规则也写在那一页
  - to: block-table
    kind: builds-on
    note: 命中的历史块靠 block_tables 接到本请求上，PrefillCacheHit 分支直接把它切片喂给算子
  - to: kv-cache-spec
    kind: builds-on
    note: 哈希粒度 hash_block_size 由各 KV cache group 的 spec.block_size 取 gcd 得出
  - to: paged-attention
    kind: builds-on
    note: 命中后新 token 要读散在别处的历史块，只有按块表寻址的分页算子做得到
  - to: prefill
    kind: builds-on
    note: PrefillCacheHit 只是 AscendAttentionState 五个取值里的一个，整张枚举表在那一页
  - to: linear-attention
    kind: builds-on
    note: 混合模型要命中，除了全注意力层的 KV 块，线性注意力层还得有一份停在块边界上的状态
contradicts: []
updated: "2026-09-25"
---

## 同一份长文档连问两次，第二次能省多少

还是[那条请求](one-request.md)的设定：Qwen3.6-35B-A3B，两颗昇腾 NPU。这回换个用法——你贴进去一份很长的文档，连同固定的开场说明一共 6000 个 token，然后问一个 37 个 token 的问题。答完之后，你对**同一份文档**再问第二个问题，也是 37 个 token。

第二次提问一共 6037 个 token，前 6000 个和第一次一字不差。直觉上，这 6000 个 token 上一次已经算过，它们的 K 和 V 都还在显存里（K 和 V 是什么见[注意力](attention-qkv.md)，存起来的那份就是 [KV Cache](kv-cache.md)），这次应该只算新问题那 37 个。

实际上这次要算的是 **1941 个**。多出来的 1904 个，开头明明相同，还是被重算了一遍。这一页就讲这个差额是怎么来的。

## 它按块认，不按 token 认

KV Cache 不是一个 token 一个 token 地存，而是切成一段一段，一段叫一个 KV 块，后面简称「块」。这个模型的一块能放 2048 个 token。一条请求用到了哪几块，记在一张[块表](block-table.md)里。

前缀缓存认「开头相同」的办法，是给**每个写满的块**算一个指纹。指纹不只看这一块里的 2048 个 token，还连着前面所有块一起算，所以两个块指纹相同，就说明从第一个 token 到这一块末尾全都一样。第二条请求进来时，从第一块开始逐块比指纹：比上一块，就把那一块在显存里的编号直接填进自己的块表，一直比到第一次对不上为止。

没写满的块不算指纹。块还没满，后面随时可能再写进 token，内容不固定，拿它当「开头相同」的凭据不可靠。所以不管开头相同了多少，最后那一段凑不满一块的零头**永远不会被命中**。

代到这次提问上：

```wiki-diagram
file: prefix-caching
```

- 第 1 块、第 2 块：装着文档的前 4096 个 token，上一次已经写满，指纹对得上，块号直接拿来用。
- 第 3 块：装着文档剩下的 1904 个 token，再加新问题的 37 个。上一次它只写到 1904 就停了，从来没满过，也就从来没有指纹。这一块只能现算。

所以这一步真正要过一遍模型的，是 6037 − 4096 = 1941 个 token。

## 块越大，零头越大

同样一份 6000 个 token 的文档，换到块是 128 个 token 的普通模型上，能命中 46 块、5888 个 token，只剩 112 个零头要重算。到了这个模型，零头一下变成 1904 个。

块这么大不是谁随手定的。这个模型 40 层里只有 10 层是全注意力、要存 KV；另外 30 层是[线性注意力](linear-attention.md)，每条请求只存一份固定大小的状态。两种东西要放进同一套块里管理，块就得大到让两边的一页对得上，算出来在两颗 NPU 上正好是 2048。

线性注意力层还多一道门槛。它不回看前面的 token，靠的是那份一路更新下来的状态，所以要从第 4096 个 token 接着算，就必须有一份**恰好停在第 4096 个 token 处**的状态。框架只在某一步刚好算到 2048 的整数倍时才顺手留一份。KV 块和这份状态两样都在，才算真的命中。

结论是：在这个模型上，**开头相同的部分不到 2048 个 token，前缀缓存一点用都没有**。[那条请求](one-request.md)问题加回答一共才 237 个 token，原样再问一遍，命中也是 0。

## 省掉的是计算，读一个字节不少

命中的那 4096 个 token，这一步根本不进模型：它们的 embedding、每一层的矩阵乘、注意力、MoE 全都不再算。这次提问要算的 token 从 6037 个降到 1941 个，前向计算省掉约 68%。

但省掉的只是「算」。新算的 1941 个 token 在全注意力那 10 层里，仍然要回头看前面**全部** 6036 个 token 的 K 和 V，命中的那两块一样要从显存里读出来。两颗 NPU 时，每颗 NPU 上每个 token 在每层存 1 KiB，10 层就是 10 KiB。这一步每颗 NPU 要读的 KV 大约是 6037 × 10 KiB ≈ 59 MiB，一个字节也没因为命中而少读。

所以前缀缓存改善最明显的是**第一个 token 出来之前那段等待**：开头越长、相同的比例越高，省下的计算越多。等到开始一个一个吐 token，每一步只算一个新 token，本来就没什么可省，它对这段的速度几乎没有影响。

它不改结果：开和不开，模型吐出来的 token 应该一模一样。昇腾的测试就是这么验收的。

## 在这个模型上，它默认是关着的

对大多数模型，前缀缓存不写也是开着的。但这个模型是全注意力和线性注意力混着用的「混合模型」，情况不一样：

- **v0.23 维护分支**：框架认为混合模型不支持前缀缓存，默认关。
- **v0.26 分支**：已经认为支持了，但对混合模型刻意保持「要你手动打开」，默认还是关。
- **main 开发主线**：改回「支持就默认开」，默认开。

官方教程给这个模型的启动命令三个版本都明确写了打开前缀缓存。所以照教程启动，第二次提问能省；自己写命令什么都不加，在已发布的两个版本上就会老老实实从头再算一遍。

打开它还有两个连带变化：线性注意力层的状态会按块大小分段留存（不开时一条请求只留一份整条的），而且要求同时开着 Chunked Prefill（分块预填充，问题太长就切成几段、分几步算完）。

## 昇腾这边做了什么

比指纹、决定用哪些块、块没人用了再回收，这些都是 vLLM 本体的活，昇腾这边没有另写一份，细节在 [block 是怎么分出来的](vllm-kv-block-allocation.md)。昇腾只在三处插手：块定多大、指纹按多大一段算、命中之后注意力算子怎么接收「前面已经有一段」这件事。三处在下半各有对应。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching
```

- 官方教程给这个模型的示例命令显式带了 `--enable-prefix-caching` [S35]；上游文档同样要求显式设置 `enable_prefix_caching` 才开启 [S24]。默认值三版本不同，见下面的版本差异表。
- 模型形状来自官方配置 [S27]：`num_hidden_layers: 40`、`full_attention_interval: 4`（10 层全注意力、30 层线性注意力）、`num_key_value_heads: 2`、`head_dim: 256`。
- **块大小（普通模型）**：平台层在配置检查里调一次 `refresh_block_size`。只要 `enable_prefix_caching` 或 `enable_chunked_prefill` 为真、而 `block_size` 又不是 128，就把它改成 128 [C1]。128 也是 `AscendAttentionBackend.get_supported_kernel_block_sizes()` 报的唯一 kernel 块大小 [C20]，两者对得上；但定这个值的是上面那个函数，不是这个列表。
- **块大小（本模型）**：`deepseek_v4` 和混合模型（`model_config.is_hybrid`）在上面那条分支之前就 `return`；本模型的块大小改由 `patch_mamba_config` 按「SSM 页对齐」算：`attn_block_size = kernel_block_size × cdiv(ssm_block_page_size, kernel_block_size × attn_single_token_k_page_size)` [C36]，TP=1 与 TP=2 都得 2048（推导在[那条请求](one-request.md)的下半）。
- **混合模型开 APC 时的状态缓存模式**：上游 `MambaModelConfig.verify_and_update_config` 在开了 APC 且 `mamba_cache_mode == "none"` 时，按模型是否声明 `SupportsMambaPrefixCaching` 改成 `"all"` 或 `"align"` [C33]。v0.23 配套上游里实现这个接口的只有 mamba、mamba2、jamba、bamba、zamba2、falcon_h1、nemotron_h、granitemoehybrid 几个模型文件，`qwen3_5.py` 及其父类所在的 `qwen3_next.py`、`qwen3_vl.py` 都不在其中，所以本模型走 `"align"` [D]。`"align"` 只在一步的最后一个 token 恰好落在 `i × block_size` 时留一份状态 [C37]。
- 昇腾在 `patch_mamba_config` 末尾补了一条：`enable_prefix_caching` 且 `mamba_cache_mode == "align"` 时 `mamba_block_size = block_size`，否则 `mamba_block_size = max_model_len`，即状态整条分配 [C19]。
- **哈希粒度**：vllm-ascend 用 `_ascend_resolve_kv_cache_block_sizes` 覆盖上游同名函数，返回 `(scheduler_block_size, hash_block_size)` 二元组——「哈希以块为单位」直接写在了接口形状里。不开上下文并行时，main 与 v0.23 都落回上游实现 [C12][C13]；上游多 group 时哈希块取各 group `block_size` 的 gcd [C34]。多 group 且开了上下文并行时，昇腾自己算：调度块取各 group 块大小的 lcm 再乘 CP 因子，哈希块在开 APC 时取 gcd，匹配粒度比调度粒度更细；单元测试把 `lcm(16, 32) × 2` 与 `gcd(16, 32)` 钉死 [C14]。本模型在 `"align"` 下 mamba group 与全注意力 group 的 `block_size` 都是 2048，gcd 仍是 2048，**哈希按 2048 一块算** [D]。
- 昇腾上 APC 和 chunked prefill 是同一批打通的——release note 记的是 CANN 升到 8.1.RC1 才同时支持了两者 [S22]，这个历史耦合留在 `refresh_block_size` 那个共用的 `if` 里。两者不互斥，官方矩阵里那一格是 ✅ [S21]。

### 会报什么错

- **普通模型**：`--block-size 64` 配 APC 会被静默改成 128，不报错、不警告，只留一条 info 日志。以为自己在用 64 的人，显存估算会全盘偏掉。
- **本模型**：传的 `--block-size` 比 2048 小时同样静默改大，info 日志是 `Setting attention block size to %d tokens ...`；比 2048 大则保留原值。
- `"align"` 模式下没开 chunked prefill 会直接断言失败：`Chunked prefill is required for mamba cache mode 'align'.`；开着时还会打一条 info，提示 Mamba 层的前缀缓存仍是实验性的。
- 看到 `layer.py` 里那句 `cache_config.enable_prefix_caching = False`，别以为昇腾会在某些模型上自动关掉 APC：那条分支要求后端名等于 `TRITON_MLA` 或 `FLASHINFER`，两版一字不差 [C15][C16]；而这条路径上取得到的后端只有 `AscendDSA*` 系列，main 上是 `ASCEND_DSA_C4` / `ASCEND_DSA_C128` / `ASCEND_DSA_SWA` [C17]。它是从 CUDA 侧照搬过来的死分支 [D]。

### 开销和什么时候别开

以下是 TP=2、每颗 NPU、bf16 下的值，场景是上半「6000 token 文档 + 37 token 问题，问第二遍」。

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 能命中几块 | ⌊6000 / 2048⌋ = **2 块 = 4096 token** | 第 3 块没写满，拿不到哈希 [D] |
| 本轮进前向的 token | 6037 − 4096 = **1941** | `num_computed_tokens_cpu[0] = 4096`，`positions` 从 4096 起 [C7] |
| 块表给出几个块号 | ⌈6037 / 2048⌉ = **3** | 注意力要读的是全长，不是没命中的 1941 个 |
| 省掉的前向 | 4096 / 6037 ≈ **67.8%** | [D] |
| 这一步要读的 KV | 6037 × 10 KiB ≈ **59 MiB** | 每 token 每层每颗 1 KiB（TP=1 时 2 KiB）× 10 层，见[那条请求](one-request.md) [D] |
| 对照：块为 128 的普通模型 | ⌊6000 / 128⌋ = 46 块 = 5888 token，零头 112 | [D] |

- **命中的 token 不进输入张量**：调度器把命中数写进 `num_computed_tokens_cpu`，position 从它起算。`_build_attn_state` 要求整批 `num_computed_tokens_cpu` 全为 0 才算 `PrefillNoCache`；有一条命中，这一批就落到 `PrefillCacheHit`（没开 chunked prefill）或 `ChunkedPrefill`（开了）[C5][C6]。本模型的 `"align"` 模式强制开着 chunked prefill，所以落的是后者 [D]。
- **KV 按全长读**：两条路在 `_get_fia_params` 里都走带 `block_table` 的分页路径，`actual_seq_lengths_kv` 都是 `seq_lens_list`，即含已命中部分的完整序列长度 [C10]；区别只在 `PrefillCacheHit` 会把 `block_table` 按 batch_size 切一刀。这就是 APC 改善 TTFT 明显、对 decode 吞吐几乎没影响的原因。
- **无损**：昇腾 CI 把开 APC 与关 APC 的输出做逐 token 相等断言，MHA（Qwen3-8B）与 MLA（DeepSeek-V2-Lite）各跑一遍 [C23]。
- **显存**：开了 APC 后 mamba 状态按块留存而不是整条一份；官方教程提醒长上下文场景要盯着显存，APC 会加重 KV 压力 [S38]。
- **什么时候别指望它**：共享开头不到 2048 个 token 时，本模型一块都命中不了；短对话、每条请求开头各不相同的负载，开了只有开销。

### 版本差异

默认值这一行是本模型最需要注意的；其余行（开关名、普通模型强制 128、命中后按全长读 KV）三版一致。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 本模型的 APC 默认值 | 关：上游把混合模型判为「不支持前缀缓存」[C28][C29] | 关：已判为支持，但对混合模型刻意保持手动打开 | 开：恢复「支持就默认开」，混合模型判为支持[C32] | [!] 同一条启动命令不写开关，两个发布版不命中、main 命中 |
| 官方教程的启动命令 | 显式打开 APC [S35] | 同 | 同 | 照教程启动三版都开着 |
| CP 因子 | `lcm(...) × dcp × pcp`，`pcp ≠ 1` 单独就触发 | 同 main，`pcp` 在这个补丁里已经删干净 | `lcm(...) × dcp`，只有 `dcp ≠ 1` 触发 | [!] 同一套 PCP 配置，v0.23 与 v0.26 起算出的调度块大小不同 |
| 多 group 时筛不筛组 | 不筛 | 同 v0.23 | 先用 `is_prefix_cacheable` 筛掉不可缓存的组（DeepSeek V4.1 的缓存例外，另走一条保留全部组、只把哈希块取 gcd 的分支）；筛完只剩一组时改用该组自己的 `block_size` | main 上「固定尾块」这类私有组不再参与块大小计算 |
| `_get_fia_params` 取 KV 视图 | 分支里直接 `.view(...)` | 同 v0.23 | 抽成 `_get_kv_cache_view`，多一条 BNSD 布局分支 | 只是重构：命中后拿到的块表切片和全长 `seq_lens_list` 没变 |
| 310P 的 model runner v2 | 该路径不存在 | 同 v0.23，仍只有 `worker_310p.py` | 支持 APC | [!] 「开 APC 直接 `NotImplementedError`」只在 main 上不成立；代价是开了 FULL 图时命中批次被强制退回 eager |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 普通模型块大小强制 128、混合模型提前返回 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 本模型块大小 2048 怎么算、`mamba_block_size` 怎么定 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| 调度块与哈希块 | `vllm_ascend/patch/platform/patch_kv_cache_utils.py`，`_ascend_resolve_kv_cache_block_sizes`；上游 `vllm/v1/core/kv_cache_utils.py`，`resolve_kv_cache_block_sizes` |
| 混合模型开 APC 时的 `mamba_cache_mode` | 上游 `vllm/model_executor/models/config.py`，`MambaModelConfig.verify_and_update_config`；模式含义在 `vllm/config/cache.py` |
| APC 默认值 | 上游 `vllm/engine/arg_utils.py`，`_set_default_chunked_prefill_and_prefix_caching_args` |
| 命中后的注意力状态 | `vllm_ascend/worker/model_runner_v1.py`，`_build_attn_state`；`vllm_ascend/attention/attention_v1.py`，`AscendAttentionState`、`_get_fia_params` |
| 命中、引用计数、淘汰 | 上游 `KVCacheManager`，见 [block 是怎么分出来的](vllm-kv-block-allocation.md) |
