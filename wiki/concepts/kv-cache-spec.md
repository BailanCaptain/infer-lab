---
id: kv-cache-spec
title: "KV Cache Spec：每层自己报价，引擎才算得出能分几块"
type: feature
summary: 模型的每一层先向引擎交一份规格，写明自己一块要存多少字节。引擎拿剩下的显存去除这个数，算出能分几块，再回头把显存真正切出来。
aliases: [KV Cache Spec, KV 缓存规格, KV Cache 规格, KV Cache 声明, KVCacheSpec, 按层 KV 规格声明]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1088-L1107
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L891-L892
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5822-L5981
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4946
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5925-L5951
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5005-L5011
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5982-L5995
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L101-L111
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L141-L143
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L180-L180
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1122-L1138
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4457-L4494
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3843-L3865
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4561-L4606
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5019-L5056
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5074-L5092
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4212-L4232
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1580-L1582
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4653-L4672
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5501-L5545
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L5419-L5429
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L115-L136
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L66-L121
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L167-L200
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4678-L4699
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L907-L918
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L33-L47
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
  - vllm-ascend@2ed6cbba:vllm_ascend/core/kv_cache_interface.py#L19-L129
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L616-L625
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L153
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: paged-attention
    kind: builds-on
    note: 规格里的块大小与一页字节数，说的就是分页方案里的那一页：一页装多少 token、一页多少字节
  - to: kv-cache
    kind: builds-on
    note: 规格描述的是「缓存的一块长什么样、多大」；缓存本身为什么存在、存的是什么，在那一页
  - to: linear-attention
    kind: builds-on
    note: 混合模型里线性注意力层交的是另一种规格——一份固定大小的状态，要和注意力的页补成一样大
contradicts: []
updated: "2026-09-25"
---

模型的每一层先交一份规格，写清「我的一块存多少 token、每个 token 存多大、什么精度」；**引擎只从里面取一个数——一块多少字节**，拿剩下的显存去除它，得到能分几块，再把块数发回去，由各颗 NPU 照着把显存真正切出来。**报价和分配是分开的两趟，中间隔着一次显存探测**，顺序倒不过来：分配之前必须先知道单价。

```wiki-diagram
file: kv-cache-spec
```

## 先看一个问题

引擎要在显存里给 [KV Cache](kv-cache.md)（把算过的 K 和 V 存起来，下一步直接读、不重算）划地方。它手里有「还剩多少字节」，缺的是另一半：**一块要多少字节**。

对 [那条请求](one-request.md) 用的 Qwen3.6-35B-A3B，这个问题没有一个统一的答案。它有 40 [层](layers-and-hidden.md)，每 4 层里有 3 层是 [线性注意力](linear-attention.md)，第 4 层是全注意力：第 4、8、12……40 层这 10 层要一个 token 一个 token 地存 K 和 V，剩下 30 层只存一份固定大小的「状态」。两种层要的东西完全不一样，谁也替不了谁报价。

所以引擎不问模型「你一块多大」，而是**挨层问**：每层交一份自己的规格，引擎收齐了再算账。

## 一份规格里写了什么

全注意力层交的规格就四项，都是模型和部署方式定下的：

- **块大小**：一块装多少个 token。这个模型是 2048。
- **KV 头数**：每个 token 存几个 [KV 头](gqa.md)。模型一共 2 个 KV 头；两颗 NPU 做 [张量并行（TP）](tensor-parallel.md) 时对半分，每颗只存 1 个。
- **头维**：每个 KV 头是多长的一串数。这个模型是 256。
- **精度**：每个数占几个字节。这里是 bf16，2 个字节。

一块的字节数就是这四项乘起来，再乘 2——K 一份、V 一份：

| 要的数 | 两颗 NPU（每颗） | 一颗 NPU |
|---|---|---|
| 一层、一个 token | 1 KiB | 2 KiB |
| 一层、一块（2048 个 token） | 2 MiB | 4 MiB |
| 10 层全注意力、一个 token | 10 KiB | 20 KiB |

线性注意力层交的是另一种规格：不按 token 算，只写「我的状态有几份、各是什么形状、什么精度」。它的状态一层约 1 MiB，和回答多长无关。这份状态具体怎么算出来，在 [那条请求](one-request.md) 里已经算过一遍，这里不重算。

## 为什么按层报，不按模型报

因为一个模型里的层本来就不一定长得一样。除了上面这种「全注意力 + 线性注意力」的混搭，还有几种情况：

- **有的层干脆不报。** 有些模型让几层共用同一份 KV，被共用的那层报一次就够，借用它的层不交规格，也就不占块——省下的显存正是从这儿来的。
- **不同结构各报各的。** 普通的分组注意力、压缩 KV 的 MLA、线性注意力、草稿模型的缓存层，形状算法完全不同，各走各的路。
- **量化和挪到主机内存，改的都是规格里的字段。** 精度、每个数的长度、这层放不放主机内存，都在规格里定死（见 [KV Cache 量化](kv-cache-quantization.md)、[稀疏 KV Offload](kv-cache-sparse-offload.md)）——改在规格上，就等于改在了显存账本上。

## 混合模型：两种页要补成一样大

混合模型还多一步，而且这一步**只能等所有层都报完才做得了**，这本身就是「按层报」的直接后果。

两颗 NPU 时，全注意力层一块是 2 MiB，线性注意力层一份状态约 1 MiB。两种层要共用同一套块编号，一块的尺寸就得对齐：线性注意力那份状态被补齐到「一整块注意力页那么大再加一点」，注意力页也跟着被抬到同样大小。块大小 2048 本身就是倒着从状态的大小算出来的，为的就是让这两种页能对得齐。

补齐的代价不小：30 层线性注意力的状态本来合计约 30.7 MiB，补齐之后实际占掉约 60.7 MiB，将近一半是补出来的空白。这笔账的完整推导在 [那条请求](one-request.md) 的「两块地方」一节。

## 先报价，再分配

报价这一趟只产出一张「每层一份规格」的清单。引擎拿它去做 [显存探测](kv-cache-memory-profiling.md)：模型权重和中间结果都装好以后还剩多少字节，除以一块的字节数，就是能分几块。

块数发回各颗 NPU，分配这一趟才开始，只干三件事：

1. 向显存要一大片原始空间；
2. 把这片空间看成「块数 × 每块 2048 个 token × ……」的形状；
3. 挂到每一层上；共用 KV 的层，直接指向被借用的那一层。

中间还有一次复核：每颗 NPU 拿自己手上的字节数反推块数，确认不少于引擎打算发出去的块数。多颗 NPU 时各自的层数和显存可能不同，引擎取的是全场最小值，这一步就是让每颗自己再核一遍。

## 一层的 KV 落到显存里是两条

在昇腾上，一层的 KV 不是一整块连续的显存，而是**两次独立的申请**：K 一条、V 一条，地址之间没有任何关系。原因是 [PD 分离](pd-disaggregation.md)（预填充和解码放在不同机器上跑）时负责搬运 KV 的那一侧，只接受「第一维就是块数」的张量，K 和 V 捆在一起的形状过不去。

还有一处：**申请的时候只按字节，不管精度**。规格写的是 bf16，申请下来的是一片不带类型的原始字节，到第 2 步「看成某个形状」时才套上 bf16。这就是 [KV Cache 量化](kv-cache-quantization.md) 能直接换成显存的原因——字节数是从规格算出来的，不是张量类型带出来的。

## 常见误解

- **「一层的 KV 是一整块连续显存。」** 在昇腾上不是，K 和 V 是两次各自独立的申请。
- **「规格写 bf16，申请的就是 bf16 张量。」** 申请时一律按原始字节，精度要到套形状时才用上。
- **「块大小默认是 128。」** 纯注意力模型上是；混合模型上块大小是按状态大小倒推出来的，这个模型两颗 NPU 时是 2048。自己传一个更小的值不会报错，会被悄悄改大（见 [那条请求](one-request.md)）。
- **「线性注意力的状态 30.7 MiB 就是它占的显存。」** 估显存要用补齐后的 60.7 MiB。

## 对照源码

### 怎么开

规格不需要打开，模型加载完就自动走一遍。入口是 `NPUWorker.get_kv_cache_spec()`，它只转发给 `NPUModelRunner.get_kv_cache_spec()`，后者逐层 `isinstance` 分发、为每层产出一份 `KVCacheSpec` [C1][C3]。能改变规格的是这几样：

- **块大小。** 纯注意力模型没写 `--block-size` 时，由配置检查里的 `refresh_block_size` 填成 128 [C30]；昇腾 GQA 后端报的 kernel 块大小也是 128 [C10]，官方文档写别的参数时同样拿 `block_size=128` 当前提 [S12]。混合模型不走这条路，改由 `patch_mamba_config` 按「SSM 页对齐」算：`attn_block_size = kernel_block_size × cdiv(ssm_block_page_size, kernel_block_size × attn_single_token_k_page_size)`，用户传小了就改大 [C33]；代入 Qwen3.6-35B-A3B，TP=1 与 TP=2 都是 2048（推导见 [那条请求](one-request.md)）。
- **精度。** KV Cache 量化改的是 spec 的 dtype 与 head_size（[KV Cache 量化](kv-cache-quantization.md)）。
- **放不放主机。** MLA / SFA 的 spec 上带 `store_on_host`，由稀疏 KV Offload 打开。
- **布局。** main 上 `VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时，GQA 的块张量轴序会变，见下面的版本差异 [C8]。

稠密 GQA 层的 spec 由上游造，vllm-ascend 不接管。一块多少字节的式子在上游 `AttentionSpec.real_page_size_bytes` [C26]，开头那个 2 就是「K 一份、V 一份」。代入 Qwen3.6-35B-A3B（官方配置 `num_key_value_heads: 2`、`head_dim: 256`、`dtype: bfloat16`、`num_hidden_layers: 40`、`full_attention_interval: 4` [S34]）、TP=2：

```
real_page_size_bytes = 2 × block_size × n_kv × d_h × sizeof(bf16)
                     = 2 × 2048 × 1 × 256 × 2
                     = 2,097,152 字节 = 2 MiB
```

TP=1 时 `n_kv = 2`，是 4 MiB [D]。

线性注意力层的 spec 是上游的 `MambaSpec`，页字节是各份状态 `prod(shape) × dtype 大小` 之和；设了 `page_size_padded` 时返回补齐后的值 [C32]。形状来自上游 `gated_delta_net_state_shape`，这个模型 TP=2 下是卷积状态 24 KiB + SSM 状态 1 MiB（fp32），推导在 [那条请求](one-request.md)。

补齐分两处：昇腾的 `patch_mamba_config` 把 `mamba_page_size_padded` 定成 `attn_page_size + conv_block_page_size`，也就是一整块注意力页再加一份卷积页；`get_kv_cache_spec()` 收齐所有 spec 后，再把比它小的注意力层的 `page_size_padded` 顶到这个值 [C7]。所以 TP=2 时两种页最后都是 2 MiB + 24 KiB，注意力页也被抬高了 24 KiB [D]。

分发里另外三处痕迹：

- 跨层 KV 共享的层被记进 `shared_kv_cache_layers` 后直接 `continue`，不产生 spec。
- 只有 MLA 这一支被昇腾接管：用自己的 `AscendMLAAttentionSpec` 重建一遍，因为昇腾的 nope/rope 拆法和上游不同。
- draft model 的 cache-only 层重建成 `HiddenStateCacheSpec`，单独成组。

分配趟的入口是 `NPUWorker.initialize_from_config()`，引擎把探测好的 `KVCacheConfig` 递进来 [C13]。`initialize_kv_cache()` 先改写 config（补 encoder-only 层、补 KV 共享层）、选注意力后端、按各组 block_size 重建[块表](block-table.md) [C14]，然后才进 `initialize_kv_cache_tensors()`，它只做三件事：申请原始 buffer（`_allocate_kv_cache_tensors` [C17]）、view 成目标形状（`_reshape_kv_cache_tensors` [C22]）、把 KV 共享层的指针指到目标层上（`bind_kv_cache` [C16]）。

K、V 两条张量是这么来的：

1. `_get_attention_kv_cache_dims()` 取出 K 维和 V 维，GQA 下两者都等于 `head_size`；
2. `calc_split_factor([k_dim, v_dim])` 返回 `[total/k_dim, total/v_dim]`，GQA 下就是 `[2.0, 2.0]` [C20]；
3. 这一层的字节预算被这两个因子各除一次，K 和 V 各占一半；
4. 两条张量各自 `torch.zeros(..., dtype=torch.int8)`——申请阶段一律按原始字节；配了 `kv_transfer_config` 时还会多申请 2 MiB 把首地址对齐 [C27]。拆成两条的理由写在注释里：PD 分离的传输侧只接受首维是 `num_blocks` 的张量；
5. dtype 到 reshape 才用上：`raw_k_tensor.view(dtype).view(k_shape)`，`k_shape` 就是 `get_kv_cache_shape()` 的返回值砍掉首维。

main 上还多一条纪律：同一条 `KVCacheTensor` 里的每一层各拿一对私有的 `(k_tensor, v_tensor)`，块下标不可能在层与层之间撞上 [C18]。

### 会报什么错

- `_reshape_kv_cache_tensors()` 里先断言 `sum_page_size_bytes % page_size_bytes == 0`，再拿「K 字节 + V 字节」除以 `page_size_bytes` 反推块数，断言 `num_blocks >= kv_cache_config.num_blocks` [C23]。多卡时 `kv_cache_config.num_blocks` 取全场最小值，这句断言让每张卡自己复核块够不够。
- 混合模型上 SSM 页和注意力页对不齐时直接断言失败：`Cannot align ssm_page_size and attn_page_size.`。
- `page_size_padded` 比真实页还小时，上游 `AttentionSpec.page_size_bytes` / `MambaSpec.page_size_bytes` 里的 `assert self.page_size_padded >= ...` 会失败。

### 开销和什么时候别开

规格本身不花显存，花显存的是它算出来的那个数：

- 混合模型的补齐：TP=2 下 30 层线性注意力状态 30.7 MiB/请求/NPU，补齐后 60.7 MiB，约 30 MiB 是空白；估显存容量必须用 60.7。补齐日志里报的百分比是卷积页占补齐后页面的比例（约 1.2%），不是空白的比例。两处都见 [那条请求](one-request.md)。
- 块大：TP=2 下一块 2048 个 token，10 层全注意力一块合计 20 MiB/NPU，一条再短的请求也至少占住一块（[那条请求](one-request.md)）。

### 版本差异

v0.26 分支（`2ed6cbba`）在前三行上还站在 v0.23 这边；后两行它已经跟上 main：MLA 那支改叫了 `real_page_size_bytes`，indexer 也已经是独立的 `AscendSFAIndexerCacheSpec`，只是还没有 `get_storage_block_size()` 这层间接，块大小仍直接取 `block_size` [C31]。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 一层的字节预算 | 引擎给的 `KVCacheTensor.size` 除以切分因子 | 同 v0.23 | 自己算 `num_blocks × page_size_bytes` | main 上一条 `KVCacheTensor` 描述的是整组层，再按 size 平分就会算错 `[!]` |
| sleep mode 的 KV 池边界 | 包住整个 `initialize_kv_cache` | 同 v0.23 | 只包住原始 buffer 的申请 | 睡一觉醒来，块表和后端这些元数据不会跟着被丢掉 |
| GQA 块张量布局 | 固定 `(2, num_blocks, block_size, num_kv_heads, head_size)` | 同 v0.23 | `VLLM_KV_CACHE_LAYOUT` 取 `HND` / `LBHNC` 时换成 `(2, num_blocks, num_kv_heads, block_size, head_size)` | 字节数一个不差，但块内的轴序变了 `[!]` |
| MLA 的页字节 | 覆写 `page_size_bytes` | 覆写 `real_page_size_bytes`，块大小直接用 `block_size` | 同名覆写，物理块大小统一走 `get_storage_block_size()` | 按属性名取 MLA 页大小的脚本跨版本会读到不同的值 `[!]` |
| SFA indexer | 跳过该层，k_cache 由 `IndexerWrapper` 顶替 | 同 main | 独立的 `AscendSFAIndexerCacheSpec`，走自己的物理张量 | v0.26 起 indexer 是一等公民，v0.23 上它和 MLA 主缓存共用一次分配 |

前两行稠密 GQA 也吃得到，后三行都在 MLA / SFA 那一侧。

spec 里的 `block_size` 是不是算子看到的块大小，也分版本：稠密 GQA 上成立；MLA 上 main 里算子用的物理块大小是 `block_size // tokens_per_state`，调度器用的才是 `block_size` [C29]；v0.26 上还没有这层区分，`tokens_per_state` 在它的 `vllm_ascend` 里 grep 不到。

### 源码位置

| 要找的 | 位置 |
|---|---|
| 声明趟入口 | `vllm_ascend/worker/worker.py`，`NPUWorker.get_kv_cache_spec` |
| 逐层分发、混合模型对齐注意力页 | `vllm_ascend/worker/model_runner_v1.py`，`get_kv_cache_spec` |
| 稠密层一块多少字节 | 上游 `vllm/v1/kv_cache_interface.py`，`AttentionSpec.real_page_size_bytes` |
| 线性注意力层一页多少字节 | 上游 `vllm/v1/kv_cache_interface.py`，`MambaSpec.page_size_bytes` |
| 混合模型块大小与补齐 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| GQA 块张量形状 | `vllm_ascend/attention/attention_v1.py`，`get_kv_cache_shape` |
| 分配趟入口 | `vllm_ascend/worker/worker.py`，`initialize_from_config` |
| 申请 / 改形状 / 挂层 | `model_runner_v1.py`，`_allocate_kv_cache_tensors`、`_reshape_kv_cache_tensors`、`bind_kv_cache` |
| MLA / SFA 的 spec | `vllm_ascend/core/kv_cache_interface.py` |
