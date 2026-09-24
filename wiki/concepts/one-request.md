---
id: one-request
title: "贯穿全库的例子：37 个 token 的问题，200 个 token 的回答"
type: concept
summary: 全库只跟一个例子：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，问题 37 个 token，回答 200 个 token。后面每一页讲的都是它走到某一步时，机器在做什么。
aliases:
  [
    那条请求,
    样例请求,
    贯穿例子,
    贯穿全站的例子,
    37 token,
    237 个 token,
    一条请求走到哪,
    Qwen3.6-35B-A3B,
    worked example,
    例子设定,
  ]
chapters: ["00"]
order: 10
sources:
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L216
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L222-L228
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3-30B-A3B.md#L96-L99
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150-L150
  - vllm-ascend@2ed6cbba:docs/source/user_guide/support_matrix/supported_models.md#L133-L133
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L139-L139
  - vllm-ascend@2ed6cbba:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L192-L205
  - vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L195-L208
  - vllm@0fc695fc:vllm/config/model.py#L1289-L1295
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L687-L707
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py#L213-L234
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L534-L560
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L58-L70
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L97
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L102-L107
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L110-L124
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L616-L636
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1400
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2374-L2409
  - vllm@0fc695fc:vllm/config/model.py#L1851-L1856
  - vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2522
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L117
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L153
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1240-L1268
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L1316-L1355
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L249-L262
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2773-L2813
  - vllm@84030bbe:vllm/config/model.py#L2135-L2139
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: expert-parallel
    kind: builds-on
    note: 这个例子的 256 个专家怎么分给两颗 NPU、37 个 token 怎么补成 38 再对半分，整条线在那一页
  - to: tensor-parallel
    kind: builds-on
    note: 注意力部分对半切给两颗 NPU，每颗只剩 1 个 KV 头、每个 token 每层 1 KiB，都是那一页的切法带来的
  - to: kv-cache
    kind: builds-on
    note: 这里说的「笔记」就是 KV Cache；只有 10 层全注意力要存它，另外 30 层不存
  - to: paged-attention
    kind: builds-on
    note: 这条请求占住一个 2048 个位置的块只用掉 237 个，正是分页方案「最多浪费一个块」的上限
  - to: prefix-caching
    kind: builds-on
    note: 这个模型在已发布的版本上默认不开前缀缓存，开了之后第二次提问能省掉哪一段，在那一页
  - to: vllm-scheduler
    kind: builds-on
    note: 第一步算 37 个 token、之后每步算 1 个，是调度器按同一条规则分出来的，不是两套代码
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 你问了一句话，中间这几秒机器在干什么

你在聊天框里打了一句话，按下回车。这句话被切成 token（模型眼里的一个字块，一段话会被切成很多个 token）之后是 37 个。过了几秒，模型回了你一段话，200 个 token。

中间这几秒，机器做的事情是可以一条条数清楚的：它把整个模型从头到尾走了 200 遍；两颗芯片之间来回传了上万次数据；它在显存里给这次提问划了两块地方，一块几乎空着，另一块一上来就占满。

这一页把这次提问的每个数字钉死。后面几十页讲的都是同一个例子走到某一步时发生了什么——它排在哪个队里、谁决定这一步算它、它算出来的东西写进了哪一格。钉死一个例子的好处很实在：每一页都能给出具体的数，而不是「一般来说会……」。

## 这个例子的全部设定

| 项 | 这个例子取什么 | 为什么是它 |
| --- | --- | --- |
| 模型 | Qwen3.6-35B-A3B | 昇腾官方为这个模型写了部署教程，模型结构和支持范围都查得到 |
| 硬件 | 一张 Atlas A3 卡上的两颗 NPU | 官方示例就是两颗；光是这个模型的专家权重就有约 60 GiB，一颗 64 GB 的 NPU 装不下 |
| 怎么摊到两颗上 | 注意力部分对半切，每层的 256 个专家按编号分成两堆 | 官方示例的做法，整条线在[专家并行](expert-parallel.md) |
| 问题长度 | 37 个 token | 短到一步就能算完，不用切成几段分几步算 |
| 回答长度 | 200 个 token | 长到能看清「一步吐一个 token」的过程，又短到一个块就装得下 |
| 版本 | 昇腾适配层的 v0.23 维护分支、v0.26 分支、main 开发主线 | 三个版本本页都核过；取值不一样的地方写在下半 |

这张表里只有「37」和「200」是我挑的，挑的理由写在第三列；其余都是模型和官方示例给定的。

## 40 层里，只有 10 层要记笔记

先看这个模型长什么样。它有 40 层——一层就是一套重复的计算，一个 token 要从第 1 层一路走到第 40 层，才轮到下一个 token。

这 40 层里有两种注意力，这是整页最要紧的一件事。

**全注意力**层要回头看前面所有 token。为了不每一步都把前面重算一遍，它把每个 token 算出来的两份数据存下来备查——后面把这份存下来的东西叫「笔记」。笔记会随着回答变长而越攒越多。

**线性注意力**层不回头翻。它手里只有一份固定大小的「状态」，每看完一个 token 就把这个 token 揉进状态里，看完就扔。不管回答多长，这份状态都是那么大。

这个模型每 4 层里有 3 层是线性注意力，第 4 层是全注意力。40 层排下来，第 4、8、12……一直到第 40 层是全注意力，一共 10 层；剩下 30 层是线性注意力。

```wiki-diagram
file: one-request-layers
```

这件事决定了后面所有关于显存的账：真正随着回答变长而变大的，只有那 10 层的笔记。

## 每一层还有 256 个专家，一个 token 只用 8 个

除了注意力，每一层还有一组「专家」，每个专家是一小块计算。这个模型每层有 256 个专家，但一个 token 走到这一层时只挑其中 8 个来算，另外还有 1 个所有 token 都要过的共享专家。模型名字里的「35B-A3B」说的就是这件事：参数一共约 350 亿，每个 token 实际用到的只有约 30 亿。

256 个专家整层放不进一颗 NPU，于是按编号分成两堆：0 到 127 号在一颗上，128 到 255 号在另一颗上。一个 token 选中的专家在哪颗上，它就被送到哪颗上去算，算完再送回来。

这里还有一个数值后面会反复出现：进专家这一步之前，两颗 NPU 要先把手上的 token 对半分。37 是奇数，分不匀，于是补一个空位凑成 38，每颗负责 19 个。完整的过程在[专家并行](expert-parallel.md)那一页。

## 200 步：第一步算 37 个 token，之后每步算 1 个

回答 200 个 token，就要把模型从头走 200 遍。

- **第一步**把问题的 37 个 token 一起送进去，走完 40 层，末尾吐出回答的第 1 个 token。这一步通常叫 prefill（预填充：先把问题里所有 token 一起算一遍）。
- **之后的 199 步**，每一步只送进上一步刚吐出来的那 1 个 token，走完 40 层，再吐 1 个。这叫 decode（一次吐一个 token）。

两个名字只是讲给人听的分法。机器每一步做的事是同一套：拿到这一步该算的 token，从第 1 层走到第 40 层。区别只在这一步手里有 37 个 token 还是 1 个。

所以「几秒钟」是这么来的：第一步要算 37 个 token，算得重一点；后面 199 步每步只算 1 个，但每一步都得把 40 层的权重从头到尾读一遍——这 199 步是耗时间的大头。

## 这次提问在一颗 NPU 上占多大地方

前面说机器给这次提问划了两块地方，现在来看这两块各有多大。下面的数都是**一颗 NPU 上的量**，另一颗对称。

**第一块：全注意力那 10 层的笔记。** 两颗 NPU 把注意力对半分之后，每颗每层只需要给每个 token 存 1 KiB 的笔记；10 层就是 10 KiB。一次提问一共 237 个 token（问题 37 + 回答 200），笔记加起来 2.3 MiB——很小。

但笔记不是一个 token 一个 token 现要的，是**一次要一大片**，一片叫一个块。这个模型在两颗 NPU 上的块是 2048 个位置。也就是说，这次提问一开口就占住了一个能放 2048 个 token 的块，只用掉开头 237 个，剩下 1811 个位置空着，别的请求也拿不走。

```wiki-diagram
file: one-request-block
```

为什么块这么大？因为线性注意力那 30 层的状态得和注意力的块摆得一样齐，块的大小是倒着从状态的大小算出来的，不是随手定的。这是「混合」模型特有的，纯注意力模型的块通常小得多。

**第二块：线性注意力那 30 层的状态。** 每层的状态约 1 MiB，30 层合起来约 30.7 MiB。它和回答多长完全无关——回答 200 个也好、2000 个也好，都是这么大。

不过实际占掉的比这更多：每一层的状态在显存里要补齐到和一整个注意力块一样大，于是 30 层实际占掉约 60.7 MiB，其中大约一半是补出来的空白。

```wiki-diagram
file: one-request-memory
```

两块加起来，这次提问在每颗 NPU 上占掉约 80 MiB，其中真正装着数据的约 33 MiB。**和直觉相反的地方在这里**：占地方的大头不是那份「越答越多」的笔记，而是那份从一开始就固定、和回答长短无关的状态。

这些数的前提是：两颗 NPU、按官方示例的配置启动、状态用 4 字节精度存。换成 4 颗、8 颗，块的大小和每颗要存的量都会变，具体值在下半。

## 同样的问题问第二遍，机器还会从头再算一遍

前缀缓存（两条请求开头一样，开头那些块直接拿来用，不重算）听上去理所当然，但对这个模型，在两个已发布的版本上它默认是**关着**的——不明确打开就不会生效；开发主线上才改回默认打开。

官方教程给这个模型的示例命令里明确打开了它。所以如果你照教程启动，第二次提问确实能省掉重复的开头；如果你什么都不写，就会老老实实从头再算一遍。这一条只对这一类混合注意力模型成立，别的模型的默认值不一样。

## 这个例子看不见什么

它是最简单的一次提问，所以有几件事它看不见：

- **看不到抢位置。** 队列里只有它一条，看不到多条请求抢算力、排队、被挤下去。
- **看不到长上下文。** 237 个 token 一个块就装下了，长问题要切成几段算的那些麻烦，它一样都碰不到。
- **看不到跨机器。** 两颗 NPU 在同一张卡上，不涉及机器之间的网络。
- **看不到分开部署。** 官方支持矩阵里，这个模型把问题和回答拆到不同机器上跑这件事三个版本都写着不支持。
- **权重精度不一样。** 官方示例用的是压缩过的权重，本页算显存时按未压缩的算，所以专家那 60 GiB 是上限值。

后面的页需要这几种情形时，会自己说明它在这个例子上加了什么。加什么要写明白，不能换一个例子重讲。

## 后面各页从哪一刻接手

| 走到哪一刻 | 哪一页接手 |
| --- | --- |
| 文字还没变成 token，进程还没分好 | [vLLM 的形状](vllm-v1-shape.md) |
| 排进队列，等着被挑中 | [引擎的那个循环](vllm-engine-core.md) |
| 被挑中，拿到第一步的 37 个 token 名额 | [调度器：没有 prefill 和 decode 之分](vllm-scheduler.md) |
| 向显存要那个 2048 个位置的块 | [block 是怎么分出来的](vllm-kv-block-allocation.md) |
| 算出「这个 token 写进第几格」 | [从请求到张量](prepare-inputs-flow.md) |
| 注意力对半切给两颗 NPU | [张量并行](tensor-parallel.md) |
| 每层的 256 个专家分成两堆，token 发过去再收回来 | [专家并行](expert-parallel.md) |
| 全注意力那 10 层开始留笔记 | [KV Cache](kv-cache.md) |
| 每种注意力各占多少字节 | [四种注意力的代价](attention-cost.md) |
| 第二次提问想省掉开头 | [前缀缓存](prefix-caching.md) |

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

例子对应的最小启动命令：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching
```

- 官方教程给 A2/A3 的示例用的是 W8A8 权重，带 `--quantization ascend` 和一组调优项（`--max-model-len 262144`、`--async-scheduling`、`--compilation-config` 等）[S2]，并逐条解释了每个参数。本页只取上面这三项，其余保持默认。
- 模型形状全部来自官方配置 [S1]：`num_hidden_layers: 40`；`layer_types` 里下标 3、7、…、39 是 `full_attention`（10 层），其余 30 层是 `linear_attention`，`full_attention_interval: 4`；`num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256`、`hidden_size: 2048`；`num_experts: 256`、`num_experts_per_tok: 8`、`moe_intermediate_size: 512`；线性注意力部分 `linear_num_key_heads: 16`、`linear_num_value_heads: 32`、`linear_key_head_dim: 128`、`linear_value_head_dim: 128`、`linear_conv_kernel_dim: 4`、`mamba_ssm_dtype: "float32"`。
- 每颗 NPU 的 KV 头数是 `max(1, total_num_kv_heads // tensor_parallel_size)` [C10]，所以 TP=2 时 `max(1, 2 // 2) = 1`。TP=4、8 时同样是 1（复制，不再切）。
- **块大小不用自己设。** 通用那条路（`refresh_block_size` 把块大小定成 128）对混合模型直接返回，不参与 [C19]；改由昇腾的 `patch_mamba_config` 按「SSM 页对齐」算：`attn_block_size = kernel_block_size × cdiv(ssm_block_page_size, kernel_block_size × attn_single_token_k_page_size)`，其中 `kernel_block_size = 128` [C15]。代入这个模型：TP=1 与 TP=2 都得 2048，TP=4 得 1024，TP=8 得 512 [D]。
- 状态的精度不是猜的：`mamba_ssm_cache_dtype` 为 `auto` 时取 HF 配置里的 `mamba_ssm_dtype`，也就是 fp32 [C13]。
- A3 一张卡是双 die，一台机器 8 张卡共 16 个芯片，vLLM 按芯片计数 [S4]；本页的「一颗 NPU」就是一个芯片。
- 「37 补成 38、每颗 19 个」来自 MC2 的 prepare：先补齐到 TP 的整数倍，再按 TP rank 沿 token 维切开 [C27]，细节在[专家并行](expert-parallel.md)。

### 会报什么错

- 用户传的 `--block-size` 比算出来的小时**不报错、静默改大**，只留一条 info 日志 `Setting attention block size to %d tokens ...`；传得比它大则保留原值 [C16]。想按 128 一块来理解这个模型的人会在这里对不上账。
- SSM 页和注意力页对不齐时直接断言失败：`Cannot align ssm_page_size and attn_page_size.` [C15]。
- 补齐 mamba 页时也有一条 info 日志，但它报的**不是「浪费了多少」**：算的是卷积页占补齐后页面的比例，这个例子约 1.2%；真正被补出来的空白占整页约 49% [C17]。照日志估显存会差一倍。
- 把问题和回答拆到不同机器上跑（PD 分离），三个版本的支持矩阵里这个模型都是 ❌，见下面的版本差异表。

### 开销和什么时候别开

以下都是 TP=2、一颗 NPU、bf16 权重下的值。

- **全注意力 KV**：`2（K 与 V）× 1（每颗的 KV 头）× 256（head_dim）× 2 B = 1 KiB`（每 token 每层），10 层合计 **10 KiB/token**。TP=1 时每颗 2 个 KV 头，是 20 KiB。
- **一个块**：`2048 × 10 KiB = 20 MiB`/NPU。这次提问 237 个 token 只写进 `237 × 10 KiB = 2.31 MiB`。块大是这类模型的特点，代价是**短请求、高并发时每条请求至少占住 20 MiB**；请求平均只有几十上百个 token 时，这笔浪费比 KV 本身还大。
- **线性注意力状态**：形状由 `gated_delta_net_state_shape` 给出 [C12]——卷积状态 `(conv_dim / tp, kernel - 1)`，`conv_dim = 128 × 16 × 2 + 128 × 32 = 8192`，TP=2 下 `4096 × 3 × 2 B = 24 KiB`；SSM 状态 `(32 / 2, 128, 128) × 4 B = 1 MiB`。30 层合计 **30.7 MiB/请求/NPU**。这一项和序列长短无关。
- **补齐后的实际占用**：每个 mamba 页被补齐成「一整块注意力页 + 卷积页」，即 `2048 × 1 KiB + 24 KiB = 2 MiB + 24 KiB` [C17]；上游算显存时用的就是补齐后的值 [C18]。30 层合计 **60.7 MiB/请求/NPU**，其中约 30 MiB 是空白 [D]。两个数都要记：讲状态本身用 30.7，估显存容量必须用 60.7。
- 合计约 80.7 MiB/请求/NPU，真正装数据的约 33 MiB。
- 前缀缓存不是白开的：官方教程提醒长上下文场景要盯着显存，它会加重 KV 压力 [S3]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 |
| --- | --- | --- | --- |
| A2/A3 上的支持状态 | ✅ 支持 [S5] | 🔵 实验性 [S6] | 🔵 实验性 [S7] |
| 块大小怎么算 | 按 SSM 页对齐 | 同一段代码 [C23] | 同一套算法，外面多包了一层稀疏索引模型的分支，普通混合模型走的还是这条 [C24] |
| 混合模型跳过通用块大小 | 有 | 有 [C25] | 有 [C26] |
| 前缀缓存的默认值 | 关：上游把混合模型判为「不支持前缀缓存」[C20][C21] | 关：已判为支持，但对混合模型刻意保持手动打开 [C22] | 开：恢复「支持就默认开」，混合模型判为支持 [C28][C29] |
| 官方教程的启动命令 | 显式写了打开前缀缓存 [S2] | 同 | 同 |

「实验性」只指 A2/A3 这张表；同一份文档里 Atlas 300I DUO 那张表三个版本都是 ✅。官方没有写降级为实验性的原因。

### 源码位置

| 看什么 | 在哪 |
| --- | --- |
| 模型结构 | HF 仓库 `Qwen/Qwen3.6-35B-A3B` 的 `config.json`，看 `text_config` |
| 每颗 NPU 分到几个 KV 头 | 上游 `vllm/config/model.py`，`get_num_kv_heads` |
| 线性注意力状态的形状 | 上游 `vllm/model_executor/layers/mamba/mamba_utils.py`，`gated_delta_net_state_shape` |
| 状态用什么精度 | 上游 `vllm/model_executor/models/config.py`，`Qwen3_5ForConditionalGenerationConfig` |
| 块大小怎么算、页怎么补齐 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| 补齐后的页怎么计入显存 | 上游 `vllm/v1/kv_cache_interface.py`，`MambaSpec.page_size_bytes` |
| 混合模型为什么不走通用块大小 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 前缀缓存的默认值 | 上游 `vllm/engine/arg_utils.py`，`_set_default_chunked_prefill_and_prefix_caching_args` |
