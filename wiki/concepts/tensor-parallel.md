---
id: tensor-parallel
title: "Tensor Parallel：一层切两刀，通信就落在两刀之后"
type: feature
summary: 把一层里的四个大矩阵按列或按行切给多张卡；列切完各算各的，行切完每张卡只有一份部分和，必须 all-reduce 一次——一层两次，位置写死。
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
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L54-L61
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1136-L1164
  - vllm-ascend@b255ab59:vllm_ascend/ops/linear_op.py#L299-L318
  - vllm-ascend@b255ab59:vllm_ascend/config_utils.py#L31-L48
verified: ["main", "releases/v0.23.0"]
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
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

TP 把一层里的四个大矩阵拆给多张卡：`qkv_proj` 和 `gate_up_proj` **按列切**，切完每卡拿着自己那几列往下算，谁也不等谁；`o_proj` 和 `down_proj` **按行切**，切完每卡手里只是一份**部分和**，不加起来就是错的。**所以一层的通信位置是写死的：两次 all-reduce，一次在 attention 末尾，一次在 MLP 末尾**，搬的都是 hidden，和权重多大无关。

```wiki-diagram
file: tensor-parallel
```

## 那条请求用不到它

[那条请求](one-request.md)是单卡 TP=1，`GroupCoordinator.all_reduce` 开头就是 `if self.world_size == 1: return input_` [C2]——那 57 次归约一次都不发包。

要走到这一页，只改硬件设定这一行：一张卡换成两张，启动加 `--tensor-parallel-size 2`。模型、37 个 token 的问题、200 个 token 的回答全不动。改完之后：

| 这一页的东西 | TP=1（原设定） | TP=2 |
|---|---|---|
| `qkv_proj` 的输出列数 | 4096 =（16+8+8）×128 | 每卡 2048 |
| 本卡的 q 头 / kv 头 | 16 / 8 | 8 / 4 |
| 每 token 每卡的 KV | 112 KiB | 56 KiB |
| 一次 forward 里的 all-reduce | 0 次 | 57 次 = 28 层 × 2 + 词表那一次 |
| decode 一步搬多少字节 | 0 | 57 × 1 × 1024 × 2 B ≈ 114 KiB |
| 37 个 token 的 prefill 搬多少 | 0 | 57 × 37 × 1024 × 2 B ≈ 4.1 MiB |

右边四行都是拿 H=1024、28 层、bf16 和下面两节的规则推出来的，没有一个是从源码直接读到的常数 [D]。**注意它们只跟 hidden 大小和 token 数有关，和模型有多少参数无关。** 0.6B 换成 7B、H 从 1024 变成 4096，每次 all-reduce 才跟着变 4 倍；层数变了，次数才跟着变。

## 列切和行切不是两种风格，是必须交替出现的上下两段

`Y = XA` 要切开，只有两条路，而这两条路天生咬合。

- **列切**（`ColumnParallelLinear`）：`A` 按第二维切成 `[A_1 … A_p]`，第 i 卡算 `Y_i = X A_i`。输入要完整的一份，输出天然是切开的——`output_size_per_partition = divide(output_size, tp_size)` [C3]。`gather_output` 默认 `False`，**默认不把输出拼回来** [C4]，因为下一步正好要一份切开的输入。
- **行切**（`RowParallelLinear`）：`A` 按第一维切，输入 `X` 也按最后一维切，第 i 卡算 `X_i A_i`。结果形状是完整的，数值却只对了 `1/p`。`reduce_results` 默认 `True`，`forward` 结尾那句 `tensor_model_parallel_all_reduce` 把 p 份加起来 [C6]。偏置只在 rank 0 加，免得加 p 遍。

于是顺序固定：列切的输出正好喂进行切，中间零通信；行切的输出必须归约才能继续。Qwen3 的一层就是两组这样的搭配——`qkv_proj`（列）→ attention → `o_proj`（行），`gate_up_proj`（列）→ SiLU → `down_proj`（行）。两次 all-reduce 就落在这两个「行」的末尾。

还有一次容易漏掉的，不在那 56 次里：词表 embedding。每卡只存词表的一段，落在别人段里的 token 先填 0，再 all-reduce 拼出来。昇腾侧这一句走的是 `maybe_pad_and_reduce`，默认分支仍是同一个 all-reduce，只有开了 FlashComm v1 / 序列并行才换成 reduce-scatter。

至于「谁和谁一组」：上游 `initialize_model_parallel` 把全部 rank reshape 成 `ExternalDP × DP × PP × TP` 四维，**TP 是最里面那一维**，所以同一个 TP 组的卡编号永远连号 [C1]。一般来说这几张卡在同一台机器里，跨机的那根线留给 PP。

## TP 超过 kv 头数之后，kv 头是被复制，不是被切碎

结论先说：Qwen3-0.6B 只有 8 个 kv 头，**它的 KV Cache 每卡占用从 TP=8 起就不再下降了**。

`QKVParallelLinear.__init__` 里那个 if 写得很直白：`tp_size >= total_num_kv_heads` 时 `num_kv_heads = 1`、`num_kv_head_replicas = divide(tp_size, total_num_kv_heads)`；反过来才是 `divide(total_num_kv_heads, tp_size)` [C7]。模型侧把同一件事写成 `max(1, total_num_kv_heads // tp_size)`，旁边两个 assert 划出了边界：kv 头 ≥ TP 要求整除，kv 头 < TP 要求 TP 被 kv 头数整除 [C8]。

这个数会一路传进 KV Cache——`Attention(num_kv_heads=self.num_kv_heads)`，[KV Cache Spec](kv-cache-spec.md) 那一页的每块字节数就是拿它乘出来的。所以那条请求在不同 TP 上的账是这样（`2 × 每卡 kv 头 × 128 × 2 B × 28 层` [D]）：

| TP | 每卡 kv 头 | 复制份数 | 每 token 每卡 KV | 全场 KV 总量 |
|---|---|---|---|---|
| 1 | 8 | 1 | 112 KiB | 112 KiB |
| 2 | 4 | 1 | 56 KiB | 112 KiB |
| 8 | 1 | 1 | 14 KiB | 112 KiB |
| 16 | 1 | 2 | 14 KiB | 224 KiB —— 多出来的那一半是白存的 |

最后一行才是要记住的：**TP 越过 kv 头数之后，加卡只摊薄权重和算力，不再摊薄 KV**，而且全场多存了一倍的 KV。GQA 模型的 kv 头数就是 TP 的一道软上限。

## 昇腾把这五个 Linear 类整个换掉，只为了换掉那个通信组

`REGISTERED_ASCEND_OPS` 把 `ColumnParallelLinear`、`RowParallelLinear`、`QKVParallelLinear`、`MergedColumnParallelLinear`、`ReplicatedLinear` 五个名字映射到各自的 `Ascend*` 版本；替换是怎么发生的见[算子层](ops-and-kernels.md)。`Ascend*` 的 `__init__` 不调用上游的 `__init__`，而是先问一句 `get_parallel_op(disable_tp, prefix, self, "row")`，拿回 `(custom_op, tp_rank, tp_size)` 再自己建权重；`forward` 只有一个 if——有 `custom_op` 就走它的 `apply`，没有就原样落回上游那段。

**为什么值得这么大动干戈：上游把通信组写死了。** `tensor_model_parallel_all_reduce` 不接受任何参数，它永远问 `get_tp_group()`。昇腾把 `comm_group` 做成 `CustomLinearOp` 上一个可以覆写的 property，`tp_rank` / `tp_size` 都从它身上取 [C15]——这样某一层才能用一个跟全局 TP 完全不同的组去切自己的权重。`linear_op.py` 开头的注释把这条纪律写成了规定：要加新的并行行为就在这里派生一个类，不要改 `linear.py` 里那五个。

`_get_row_parallel_op` 是一条**有序**的 if 链，第一个命中的赢 [C16]。v0.23 上它有七档，`down_proj`（MLP TP）排在 `o_proj`（OTP）前面，再往后才是 [matmul-allreduce](../params/enable-matmul-allreduce.md)、FlashComm2、序列并行；[layer_sharding](../params/layer-sharding.md) 那条排得更靠前。**顺序就是优先级，前面命中之后后面的静默不生效**，profiling 上看不到预期的那个算子多半是撞了这条链。

真正发包的那一层也被换过：`GroupCoordinatorPatch` 顶掉了上游的 `GroupCoordinator`，每个组的 device group 走 `_acquire_hccl_group`，同一组 rank 加同一份 pg_options 只建一个 HCCL 通信域，后来的组直接复用 [C25]。所以多开几个细粒度组，不等于多开几个 HCCL 域。

## Fine-grained TP 切的是 DP 轴，不是 TP 轴

`finegrained_tp_config` 底下那几个 `*_tensor_parallel_size` 看着像「给某一层单独设一个更大的 TP」，可建组那段代码沿的是 DP 轴：`rank_grid` reshape 成 `(pp, dp, tp)` 之后，每个组取的是**固定 `tp_idx`、连续几个 dp 下标**的那一列 [C19]。所以它的硬约束写成「整除 `data_parallel_size`」，标准 `tensor_parallel_size > 1` 时这几项根本不生效——这是整个特性最容易读反的地方。四个键各自的门槛、省下多少显存、通信形状换成了什么，以及为什么 `o_proj` 那一项反而更慢，都在 [Fine-Grained Tensor Parallelism](fine-grained-tp.md)。

## 两个分支在哪儿分的叉

下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`；完整提交号在来源里。标准 TP 的那套（列切/行切/两次 all-reduce/kv 头复制）**两边一字不差**，差异全在昇腾那一侧。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| row-parallel 分派链 | 七档：DSV4 / DSA-CP / MLP / OTP / matmul-allreduce / FlashComm2 / SP | 三档，只剩 DSV4 / MLP / OTP [C35] | matmul-allreduce 与 FlashComm2 整套删干净；序列并行还在，但不再从 Linear 这一层接管 |

细粒度 TP 那几个键在两个分支之间怎么变（配置类怎么建、main 上删掉的第五个键、文档补的那一节），见 [Fine-Grained Tensor Parallelism](fine-grained-tp.md)。

## 常见误解

- **「TP 越大，KV Cache 每卡占用就越小」**——只在 TP ≤ kv 头数时成立。越过之后 `num_kv_heads` 被钉在 1、改由 `num_kv_head_replicas` 记复制了几份，每卡 KV 不再下降，全场总量反倒翻倍。
- **「`finegrained_tp_config` 是给某一层单独设一个更大的 TP，dense 模型也能开」**——两句都不成立：它切的是 DP 轴，而代码在配置加载期对非 MoE 模型直接抛 `AssertionError`。这两条连同其余门槛都在 [Fine-Grained Tensor Parallelism](fine-grained-tp.md) `[!]`。
