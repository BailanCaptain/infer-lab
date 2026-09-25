---
id: tensor-parallel
title: "张量并行（TP）：一层切两刀，每层要对一次答案"
type: feature
summary: 把每层的大矩阵横竖切开分给几颗 NPU，各算一半；切成「每颗只有半份答案」的那一刀之后，几颗必须把结果加一遍才能往下走——所以每层要对一次答案，位置是固定的。
aliases: [Tensor Parallel, 张量并行, TP, tensor_parallel_size, ColumnParallelLinear, RowParallelLinear]
chapters: ["13"]
order: 10
sources:
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1740-L1772
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L607-L624
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L407-L452
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L575-L589
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1389-L1444
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1537-L1558
  - vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1023-L1042
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L78-L113
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L126-L131
  - vllm@0fc695fc:vllm/model_executor/models/qwen2.py#L93-L106
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L477-L497
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L734-L746
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear.py#L307-L313
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear.py#L363-L371
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L88-L140
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L739
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L183-L222
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L266-L299
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L117-L133
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L135-L149
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L529-L534
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L537-L560
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L584-L593
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L143-L161
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_distributed.py#L58-L100
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_distributed.py#L152-L178
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L302-L321
  - vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L73-L91
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L27-L29
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L45-L52
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L91-L101
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L124-L131
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L54-L61
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1140-L1168
  - vllm-ascend@baa023ad:vllm_ascend/ops/linear_op.py#L299-L318
  - vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L31-L48
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/linear_op.py#L497-L521
  - vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L367-L367
  - vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L440-L450
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L219-L258
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L545-L551
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L104-L175
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: 每卡的 num_kv_heads 就是 TP 切完剩下的那个数，spec 的每块字节数直接拿它乘出来
  - to: ops-and-kernels
    kind: builds-on
    note: 昇腾能给某一层换一个通信组，靠的是那一页讲的自定义算子注册表，五个 Linear 类是被它整体换掉的
  - to: who-owns-what
    kind: builds-on
    note: TP 组由上游 initialize_model_parallel 建、昇腾只在其上另开几个细粒度组，这条归属线在那一页
  - to: matmul-and-weights
    kind: builds-on
    note: 列切、行切切的就是那一页讲的权重矩阵；「行切之后是部分和」要先懂矩阵乘是逐项相乘再相加
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 两颗 NPU 怎么一起算同一层

[贯穿全库的那个例子](one-request.md)里，Qwen3.6-35B-A3B 跑在两颗 NPU 上，设定表里写着一句「注意力部分对半切」。这一页就讲这句话：一层的计算怎么拆给两颗，两颗又怎么保证最后算出同一个答案。

这个做法叫张量并行（TP）。它不是把模型按层分成前后两段——那是流水线并行——而是**每一层都拆**：同一层里的几个大权重矩阵（见[矩阵乘与权重](matmul-and-weights.md)），每颗 NPU 只存一半、只算一半。

拆一个矩阵只有两种切法：竖着切（按列）和横着切（按行）。竖着切完，两颗各算各的，谁也不用等谁；横着切完，每颗手里只有**半份答案**，不把两份加起来，结果就是错的。所以 TP 的规律很死板：**每一层里，横着切的那一刀之后，两颗必须对一次答案，才能进下一步。** 对答案的位置是写死的，跟模型多大无关。

```wiki-diagram
file: tensor-parallel
```

## 竖着切：各算各的头，不用通信

矩阵乘就是「输入的一行」去和「权重的每一列」各乘一遍，每一列得出输出的一个数。所以把权重**按列**切成两半，NPU 0 拿前一半列、NPU 1 拿后一半列，两颗都拿着完整的输入，各自算出输出的前一半和后一半。这一步两颗之间一个字节都不用传。

注意力的第一步正是这样切的。算 Q、K、V 的那个大矩阵，输出的列按「头」排（头是什么见[注意力里的 Q、K、V](attention-qkv.md)）。这个模型有 16 个 Q 头、2 个 KV 头，按列对半切之后：

- 每颗 NPU 拿 **8 个 Q 头**；
- 每颗 NPU 拿 **1 个 KV 头**。

切完的输出本来就是按头分开的，而注意力本身也是一个头一个头独立算的，所以这一段两颗继续各算各的，还是不用通信。每颗只给自己那 1 个 KV 头存笔记（也就是 [KV Cache](kv-cache.md)）：每个 token、每层 **1 KiB**。全注意力一共 10 层，每个 token 每颗 NPU 存 10 KiB——这就是例子里那个数的来历。

## 横着切：每颗只有半份答案，必须对一次

注意力算完，还要经过一个输出矩阵，把 16 个头的结果揉回一个 hidden（每个 token 在层与层之间传的那一串数，这个模型是 2048 个数，见[层与 hidden](layers-and-hidden.md)）。

这时每颗手里只有 8 个头的结果，是输入的一半。对应地，输出矩阵就**按行**切：NPU 0 拿前一半行，只跟前 8 个头的结果相乘；NPU 1 拿后一半行，跟后 8 个头相乘。矩阵乘的每个输出数，本来是「所有输入项分别乘上权重再相加」；现在每颗只加了一半的项。所以两颗算出来的东西**形状都是完整的 2048 个数，数值却都只是半份**——两份加起来才是正确答案。

把几颗的半份加起来、再让每颗都拿到加总，这个动作叫 **all-reduce**：每颗 NPU 把自己那份结果发出去，最后各自拿到加总。它就是 TP 里「对答案」的那一步。

竖切和横切不是两种可以随便挑的风格，而是必须**上下咬合**：竖切的输出正好是切开的，直接喂给横切，中间零通信；横切的输出必须 all-reduce 才能继续。一个标准的模型层里有两组这样的搭配——注意力一组（算 QKV 竖切 → 注意力 → 输出矩阵横切），MLP 一组（升维竖切 → 激活 → 降维横切）——所以普通的稠密模型一层 all-reduce 两次，各在一组的末尾。

这个例子的模型稍有不同。它 40 层里有 30 层是线性注意力，但那种层同样是「先竖切、最后一个矩阵横切」，末尾也要 all-reduce 一次。而每层后半段的 256 个专家不走 TP 这一套：专家按编号分给两颗，token 被送去再送回，那是另一种通信，见[专家并行](expert-parallel.md)。所以在这个例子里，**TP 负责的是每层注意力那一半，每层对一次答案**。

## 对一次答案要搬多少数据

all-reduce 搬的是 hidden，不是权重。一个 token 的 hidden 是 2048 个数，每个数 2 字节，所以：

| | 单颗（TP=1） | 两颗（TP=2） |
|---|---|---|
| 每颗的 Q 头 / KV 头 | 16 / 2 | 8 / 1 |
| 每个 token 每层每颗的笔记 | 2 KiB | 1 KiB |
| 10 层全注意力合计 | 20 KiB | 10 KiB |
| 注意力那一半，每走一遍模型要对几次答案 | 0 | 40（每层一次） |
| 回答阶段每步 1 个 token，每次对答案搬多少 | 0 | 4 KiB |
| 第一步 37 个 token 一起算，每次搬多少 | 0 | 148 KiB |

后三行**只跟 hidden 大小和这一步的 token 数有关，跟模型有多少参数无关**。模型换成参数多十倍的，只要 hidden 不变，每次 all-reduce 就一样大；层数变了，次数才跟着变。单颗的时候这些对答案的动作一次都不发生——只有一颗 NPU，没人可对。

还有一次容易漏掉的：词表。模型最开头把 token 编号换成向量的那张表（见 [token 与 embedding](embedding.md)），在 TP 下也被切成两段，每颗只存一段。落在别人那段里的 token，本颗先填 0，再 all-reduce 一次拼出完整结果。昇腾在这里默认也是 all-reduce；只有打开序列并行一类的优化，才换成 **reduce-scatter**——先把各份结果加总，再切开，每颗 NPU 只留自己那段。和它常配对出现的是 **all-gather**：每颗 NPU 把自己那份发给所有 NPU，最后大家都有全部。这两个动作怎么接替 all-reduce，见[序列并行（SP）](sequence-parallel.md)。

## KV 头不够分时，是复制，不是切碎

这个模型只有 2 个 KV 头。TP=2 时正好一颗一个；那 TP=4 呢？一个头没法再切成两半，于是改成**复制**：每颗仍然存 1 个完整的 KV 头，每个头被存两份。

| TP | 每颗 KV 头 | 每个头存几份 | 每个 token 每层每颗 | 所有 NPU 加起来 |
|---|---|---|---|---|
| 1 | 2 | 1 | 2 KiB | 2 KiB |
| 2 | 1 | 1 | 1 KiB | 2 KiB |
| 4 | 1 | 2 | 1 KiB | 4 KiB |
| 8 | 1 | 4 | 1 KiB | 8 KiB |

要记住的是后两行：**TP 超过 KV 头数之后，再加 NPU 只摊薄权重和计算，不再摊薄笔记**，而且全场白白多存了几份。对这个模型，TP=2 就已经到底了。所以 KV 头少的模型，KV 头数就是 TP 的一道软上限。

**这套「按 KV 头摊薄」的账只适用于普通的多头注意力及其分组变体。** 另一种注意力 MLA（DeepSeek 系模型用的，把 K、V 压成一份共享的潜向量）在代码里把 KV 头数写死成 1——每颗 TP 的 NPU 各存一份完整的潜向量笔记，**TP 开多大都不摊薄 MLA 的笔记**。DeepSeek 配置里写的 128 个 KV 头进不了这笔账。想切这一份笔记要靠上下文并行里的 DCP，见[上下文并行（CP）](context-parallel.md)。

## 哪几颗 NPU 配成一组

一台机器上往往同时开着好几种并行。vLLM 给所有 NPU 排号时，把 TP 放在最里面一层，所以**同一个 TP 组的 NPU 编号总是连着的**。连号的 NPU 一般在同一台机器里，彼此之间连得最快——TP 每层都要对答案，最怕慢；跨机器那根慢线留给流水线并行。这个例子的两颗 NPU 就在同一张卡上。

## 昇腾在上面动了什么

上游的 TP 把「和谁对答案」写死了：永远是全局那个 TP 组。昇腾想让某一层换一组 NPU 来切，就把上游那五种切法的类整个替换成自己的版本，唯一目的就是能给某一层换一个通信组。替换是怎么发生的，见[算子层](ops-and-kernels.md)。

替换后，横切那一步要走哪条通信路径，是按一串**有顺序的条件**挑的，排在前面的先命中，后面的就静默不生效。profiling 里看不到预期的那个通信算子，多半是撞上了这个顺序。

另外，多开几个这种细粒度的组，不等于多建几个底层通信域：同一组 NPU 用同一份设置时，只建一个，后来的直接复用。

昇腾还有一个「细粒度 TP」特性，名字像是给某一层单独设更大的 TP，其实它切的是**数据并行那一维**，普通的 TP 大于 1 时它根本不生效。这是整个特性最容易读反的地方，细节见[细粒度张量并行](fine-grained-tp.md)。

## 常见误解

- **「TP 越大，每颗 NPU 的笔记就越小」**——只在 TP 不超过 KV 头数时成立。越过之后每颗 NPU 的 KV 头数钉在 1，改成复制，每颗的笔记不再变小，全场总量反而翻倍。这个例子的模型从 TP=2 起就是这样。MLA 模型则从头就不适用：每颗都存整份笔记。
- **「TP 的通信量跟模型大小成正比」**——每次 all-reduce 搬的是这一步 token 的 hidden，跟参数量无关；只有 hidden 变宽、层数变多、一步的 token 变多，通信才跟着变。
- **「细粒度 TP 是给某一层单独设更大的 TP，稠密模型也能开」**——两句都不成立：它切的是数据并行那一维，而且对非 MoE 模型在加载配置时就直接报错。见[细粒度张量并行](fine-grained-tp.md)。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个数的依据都在这里。

### 怎么开

- 启动加 `--tensor-parallel-size 2`（即 `tensor_parallel_size`）。例子的完整启动命令见[贯穿全库的例子](one-request.md)的对照源码一节，那里同时带 `--enable-expert-parallel`，所以专家不走 TP 切分。
- 建组：上游 `initialize_model_parallel` 把全部 rank reshape 成 `ExternalDP × DP × PP × TP` 四维，TP 是最里面那一维，同一个 TP 组的 rank 编号连号 [C1]。
- TP=1 时不发包：`GroupCoordinator.all_reduce` 开头就是 `if self.world_size == 1: return input_` [C2]。
- **列切** `ColumnParallelLinear`：`output_size_per_partition = divide(output_size, tp_size)` [C3]；`gather_output` 默认 `False`，默认不把输出拼回来 [C4]。
- **行切** `RowParallelLinear`：输入按最后一维切，`reduce_results` 默认 `True`，`forward` 结尾 `tensor_model_parallel_all_reduce` 把 p 份加起来 [C5][C6]；偏置只在 rank 0 加，免得加 p 遍。
- **这个模型的注意力**：`Qwen3NextAttention` 里 `num_heads = total_num_heads // tp_size`、`num_kv_heads = max(1, total_num_kv_heads // tp_size)`，`qkv_proj` 是 `QKVParallelLinear`、`o_proj` 是 `RowParallelLinear` [C40]。Qwen3.6 走的是 `qwen3_5.py`，它的 `Qwen3_5DecoderLayer` / `Qwen3_5Model` 继承自 `Qwen3NextDecoderLayer` / `Qwen3NextModel`。配置 `num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256`、`hidden_size: 2048`、`num_hidden_layers: 40` [S43]。
- **线性注意力层**：`out_proj` 同样是 `RowParallelLinear(..., input_is_parallel=True)` [C41]，所以线性注意力层末尾也有一次 all-reduce。
- **专家层**：`Qwen3NextSparseMoeBlock` 把共享专家建成 `reduce_results=False`，交给 `FusedMoE` 一起处理 [C42]；这一段的通信归[专家并行](expert-parallel.md)。
- **稠密 MLP 的那组**（参照上游 Qwen3）：`gate_up_proj` 是 `MergedColumnParallelLinear`、`down_proj` 是 `RowParallelLinear` [C10]；注意力那组 `qkv_proj` → `o_proj` 见 [C8]。
- **KV 头复制**：`QKVParallelLinear.__init__` 里 `tp_size >= total_num_kv_heads` 时 `num_kv_heads = 1`、`num_kv_head_replicas = divide(tp_size, total_num_kv_heads)`，反过来才是 `divide(total_num_kv_heads, tp_size)` [C7]。模型侧写成 `max(1, total_num_kv_heads // tp_size)`，旁边两个 assert 划边界：KV 头 ≥ TP 要求整除，KV 头 < TP 要求 TP 被 KV 头数整除。这个数一路传进 `Attention(num_kv_heads=...)`，[KV Cache Spec](kv-cache-spec.md) 的每块字节数就拿它乘出来。
- **MLA 不摊薄**：MLA 注意力层 `self.num_kv_heads = 1` [C38]，建 impl 时也传 `num_kv_heads=1` [C39]，每张 TP 卡各存一份完整 latent；DeepSeek 配置里的 `num_key_value_heads=128` 不进这笔账。要切这份缓存用 DCP，见 [Context Parallel](context-parallel.md)。
- **词表**：`VocabParallelEmbedding` 每卡只存词表一段，越界 token 填 0 再 all-reduce [C11]；昇腾侧走 `maybe_pad_and_reduce`，默认分支仍是 all-reduce，开了 FlashComm v1 / 序列并行才换成 reduce-scatter [C27][C28]。
- **昇腾替换五个 Linear 类**：`REGISTERED_ASCEND_OPS` 把 `ColumnParallelLinear`、`RowParallelLinear`、`QKVParallelLinear`、`MergedColumnParallelLinear`、`ReplicatedLinear` 映射到各自的 `Ascend*` 版本 [C12]。`Ascend*` 的 `__init__` 不调上游 `__init__`，先问 `get_parallel_op(disable_tp, prefix, self, "row")` 拿回 `(custom_op, tp_rank, tp_size)` 再自己建权重；`forward` 有 `custom_op` 就走它的 `apply`，否则原样落回上游 [C13][C14]。上游 `tensor_model_parallel_all_reduce` 不接受参数、永远问 `get_tp_group()`；昇腾把 `comm_group` 做成 `CustomLinearOp` 上可覆写的 property，`tp_rank` / `tp_size` 都从它取 [C15]。`linear_op.py` 开头注释规定：要加新并行行为就在这里派生，不要改 `linear.py` 那五个。
- **通信域复用**：`GroupCoordinatorPatch` 顶掉上游 `GroupCoordinator`，每个组的 device group 走 `_acquire_hccl_group`，同一组 rank 加同一份 pg_options 只建一个 HCCL 通信域 [C25]。
- **细粒度 TP 切 DP 轴**：`finegrained_tp_config` 建组时 `rank_grid` reshape 成 `(pp, dp, tp)`，每个组取固定 `tp_idx`、连续几个 dp 下标 [C19]；硬约束是整除 `data_parallel_size`，标准 `tensor_parallel_size > 1` 时不生效。四个键的门槛与收益见 [Fine-Grained Tensor Parallelism](fine-grained-tp.md)。

### 会报什么错

- 模型侧 assert：`total_num_heads % tp_size == 0`；KV 头 ≥ TP 时要求 `total_num_kv_heads % tp_size == 0`，KV 头 < TP 时要求 `tp_size % total_num_kv_heads == 0`。这个模型 16 个 Q 头、2 个 KV 头，这几条 assert 在 TP 取 1、2、4、8 时都能过（线性注意力层另有自己的整除要求，这里没核）。
- 专家层另有一道：`tp_size > num_experts` 时抛 `ValueError`（256 个专家，实际碰不到）。
- `finegrained_tp_config` 对非 MoE 模型在配置加载期直接抛 `AssertionError` `[!]`，见 [Fine-Grained Tensor Parallelism](fine-grained-tp.md)。

### 开销和什么时候别开

- 每次 all-reduce 的字节数 = 这一步 token 数 × `hidden_size` × 2 B（bf16）[D]：decode 一步 `1 × 2048 × 2 B = 4 KiB`；37 个 token 的 prefill `37 × 2048 × 2 B = 148 KiB`。注意力一侧每次 forward 次数 = 40 层 × 1 [D]——这是上游通用路径、不开任何通信优化时的数；昇腾的行切分派链命中别的档（见下）时会换成别的通信形状。
- 每 token 每层每卡 KV = `2（K 与 V）× 每卡 KV 头 × 256 × 2 B` [D]：TP=1 为 2 KiB，TP≥2 为 1 KiB；全场总量 = 每卡值 × TP，TP=4、8 时分别是 4 KiB、8 KiB，多出的是复制。与[贯穿全库的例子](one-request.md)的 10 层合计 10 KiB 一致。
- **TP 超过 KV 头数就别指望再省 KV**：这个模型 TP>2 之后每卡 KV 不变，全场翻倍。再往上加卡只为摊薄权重和算力时才值得。
- TP 组应放在同一台机器内：每层都要同步，跨机链路会直接拖慢每一步。

### 版本差异

下表的 main 指 2026-09-21 的源码快照，v0.26 分支指 2026-09-17 的那个快照；完整提交号在来源里。标准 TP 的那套（列切/行切/每组末尾 all-reduce/KV 头复制）**三边一字不差**，差异全在昇腾那一侧。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| row-parallel 分派链 | 七档：DSV4 / DSA-CP / MLP / OTP / matmul-allreduce / FlashComm2 / SP | 四档：DSV4 / MLP / OTP / SP [C37] | 三档，只剩 DSV4 / MLP / OTP [C35] | matmul-allreduce、FlashComm2、DSA-CP 三档在 v0.26 上就已经删干净——照 v0.23 配这几项的人升到 v0.26 会发现这条链上没有它们了 `[!]`；序列并行到 v0.26 为止还从 Linear 这一层接管，main 上才不再接管 |

`_get_row_parallel_op` 是有序 if 链，第一个命中的赢 [C16]。v0.23 上 `down_proj`（MLP TP）排在 `o_proj`（OTP）前面，再往后是 [matmul-allreduce](../params/enable-matmul-allreduce.md)、FlashComm2、序列并行；[layer_sharding](../params/layer-sharding.md) 那条排得更靠前。

细粒度 TP 那几个键在这几个分支之间怎么变（配置类怎么建、main 上删掉的第五个键、文档补的那一节），见 [Fine-Grained Tensor Parallelism](fine-grained-tp.md)。

### 源码位置

- 建组与 all-reduce 入口：`vllm/distributed/parallel_state.py`（）。
- 列切 / 行切 / QKV 切分：`vllm/model_executor/layers/linear.py`（–）。
- 本例模型：`vllm/model_executor/models/qwen3_next.py`（注意力、专家层），线性注意力 `vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py`（）。
- 稠密参照：`vllm/model_executor/models/qwen3.py`、`qwen2.py`（[C9]）。
- MLA：`vllm/model_executor/layers/attention/mla_attention.py`（）。
- 昇腾替换与分派：`vllm_ascend/utils.py`、`vllm_ascend/ops/linear.py`、`vllm_ascend/ops/linear_op.py`（–[C18]）；建组与通信域 `vllm_ascend/distributed/parallel_state.py`、`vllm_ascend/patch/worker/patch_distributed.py`（[C20][C26]）。
