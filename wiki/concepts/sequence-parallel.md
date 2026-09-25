---
id: sequence-parallel
title: "序列并行（SP）：把那两次 all-reduce 拆成 reduce-scatter 加 all-gather"
type: feature
summary: 配合张量并行用：把一层里那两次 all-reduce 各拆成 reduce-scatter 加 all-gather，归一化这类逐 token 的活只在 1/TP 的 token 上算。BF16 下线上字节一个没省；W8A8 部署下量化挪到 all-gather 之前、搬的是 INT8，通信量才真减半。
aliases: [Sequence Parallel, 序列并行, SP, FlashComm1, FlashComm V1, enable_flashcomm1, enable_sp, sp_min_token_num, maybe_pad_and_reduce, SequenceRowParallelOp, use_sequence_parallel_moe]
chapters: ["15"]
order: 10
sources:
  - vllm@0fc695fc:vllm/compilation/passes/fusion/sequence_parallelism.py#L130-L180
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sequence_parallelism.md#L5-L8
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sequence_parallelism.md#L31-L38
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sequence_parallelism.md#L40-L47
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L903-L929
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L72-L75
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L124-L144
  - vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L23-L91
  - vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L63-L80
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L458-L480
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L548-L613
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L664-L739
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L291-L295
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/sequence_parallelism.py#L13-L20
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L124-L138
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L945-L957
  - vllm@0fc695fc:vllm/config/parallel.py#L618-L640
  - vllm-ascend@baa023ad:vllm_ascend/ops/linear_op.py#L299-L318
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1557-L1563
  - vllm-ascend@baa023ad:vllm_ascend/models/common/ops/sequence_parallel.py#L29-L49
  - vllm-ascend@baa023ad:vllm_ascend/ops/register_custom_ops.py#L88-L97
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/sequence_parallelism.md#L5-L48
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sequence_parallelism.md#L14-L21
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L861-L888
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/linear_op.py#L467-L521
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L252-L257
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L545-L551
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L550-L562
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L636-L648
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L114-L134
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: variant-of
    note: 列切行切一刀没动，改的只是行切末尾那次 all-reduce 的形状——一层两次，位置还是那两处
  - to: graph-mode-layer
    kind: builds-on
    note: 编译 pass 那条路要求 enforce_eager 为假，改图发生在编译期，eager 下 enable_sp_by_pass 恒为 False
  - to: ops-and-kernels
    kind: builds-on
    note: 三个 maybe_* 通信算子靠那一页讲的自定义算子注册挂上去，模型代码里只看得到 torch.ops.vllm.xxx
  - to: fuse-allreduce-rms
    kind: conflicts-with
    note: 两个 pass 盯的是同一段 all_reduce 加 RMSNorm 子图，融合 pass 排在前面，SP 会静默匹配不到；只在 v0.23 上撞得到，v0.26 起那个 pass 已删
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 张量并行之后，还剩一份大家都在重复干的活

[那条请求](one-request.md)本来就开着 TP=2：每层的大矩阵切成两半，两颗 NPU 各算一半，行切矩阵的出口靠一次 all-reduce——每颗 NPU 把自己那份结果发出去，最后各自拿到加总——把答案对齐。这次通信一层有两处，落在哪里，[张量并行](tensor-parallel.md)那页讲过。

对齐完，新的浪费就出现了：加总之后，**每颗 NPU 手里都是全部 token 的完整结果**。接下来归一化、残差相加这类**逐 token** 的活跟矩阵怎么切没有关系，于是两颗 NPU 都在全部 token 上原样做一遍——同一份活，干了两遍。矩阵是切开了，逐 token 的这几步没切。

序列并行（Sequence Parallel，SP，昇腾侧又叫 FlashComm1）就是冲着这份重复来的：**不动张量并行的切法，只在 token 这个方向再切一刀，让逐 token 的那几步一颗只算一半**。

## 接缝本来就在那儿，SP 只是把它撬开

巧的是，all-reduce 常见的实现方式本来就分两步走：先 **reduce-scatter**——把各颗的结果加总，再切开，每颗只留自己那一段；再 **all-gather**——每颗把自己那段发给所有 NPU，最后大家都有全部。两步连着做，效果才等于「各自拿到加总」。

SP 干的事一句话就能说完：**把这两步中间的接缝撬开，把逐 token 的那几步塞进去**。加总切开之后先不急着凑回全长，就在自己那一段上把归一化、残差这些活干完，等要进下一个大矩阵了再凑回去。

```wiki-diagram
file: sequence-parallel
```

所以先记住这一页最容易说反的结论：**线上搬的字节一个没省**——原来那一次 all-reduce 本来就是这两段，SP 只是在中间插了几步计算。真正省出来的东西，往下第二节再数。

## 问题换成 2049 个 token

[那条请求](one-request.md)的问题只有 37 个 token，切一半也就省十几个 token 的活，看不出比例。把问题换成 2049 个 token，把 SP 打开，其余都不动——还是 Qwen3.6-35B-A3B、两颗 NPU、200 个 token 的回答：

| 这一页的东西 | 值 | 怎么来的 |
|---|---|---|
| 先补零 | 补 1 个全零的假 token，凑成 2050 | 2049 除不尽 2；除不尽不报错，只是多算一行零 |
| 逐 token 的活在多少个 token 上算 | 2050 → **1025**（一颗一半） | reduce-scatter 之后每颗只留自己那段 |
| 每处接缝搬多少字节：换之前 / 换之后 | 8.0 MiB / **还是 8.0 MiB** | 2050 个 token × 2048 × 2 B；本来就是这两段 |
| 200 步 decode 走不走这条路 | **步步都走，但没什么可省** | 每步就 1 个 token，补 1 个零后一颗算 1 个 |

后两行是重点。通信量没变，上面说过了。decode 那行要多说一句：这个模型是 MoE，走的是「不看 token 数」的那个分支，一步 1 个 token 也照走；dense 模型另有一道 1000 个 token 的门槛，专门把「一步没几个 token、切了也白切」的场合挡在外面——decode 每步那 1 个 token 差得远，37 个 token 的短问题也一样够不着。

还有一处要说清：**一层里的两处接缝，换法不一样。** 注意力出口那处，40 层一层不落——10 层全注意力和 30 层线性注意力各有一个把结果合并回去的矩阵出口，都按上面说的拆。MLP 那半层是 MoE，token 的收发本来就有自己的一条通路（开专家并行时就是[那一页](expert-parallel.md)讲的 dispatch / combine——把 token 派发出去、算完收回来），开了 SP 之后是这条通路配合着按切好的一半 token 接活，不走矩阵出口这套换法。

## 省出来的到底是什么

官方文档把这件事说得比大多数二手介绍都直白：把 all-reduce 拆开**本身不带来性能收益**；归一化那几步的计算量确实减半，但这点收益很小。真正值钱的是两项：

- **W8A8 部署下，通信量真的减半。** 量化那一步挪到 all-gather 之前做，凑回全长时线上搬的就是 INT8 而不是 BF16。省的这一半来自数据类型变了，不是来自拆算子——BF16 部署（比如本页例子）没有这一项。
- **通信能被藏进计算里。** 拆出来的 reduce-scatter 和 all-gather 可以分别跟它前后的矩阵乘融成一个通算融合（MC2）算子——昇腾把通信和计算揉进同一个算子，边算边传。省的是通信干等的时间，不是通信量。不过要泼一盆冷水：矩阵出口那侧的这项融合对 MoE 模型是直接关着的，本页例子正好吃不到；TP 超过 8 也不行。

## 形状是怎么兜住的

把 token 切一半再凑回来，途中有三件杂活，实现都替你做了：

- **补零**：token 数除不尽卡数时先补几行全零凑成整数倍，所以除不尽不会报错，只是每颗多算几行零；
- **残差跟着切**：残差那条捷径不经过通信，形状对不上时它自己切一刀，跟主路对齐；
- **凑回去时把零丢掉**：all-gather 之后按补了几行切掉几行，下一个大矩阵拿到的还是原来的全长。

至于哪些矩阵出口会被换：按层的**名字**认，而且认档有先后——一个出口只能被一个通信特性接管，排在前面的特性命中之后，SP 这一档就静默轮不上，这套「排队认档」的规则在[张量并行](tensor-parallel.md)那页说全了。共享专家不参加。名单、顺序和版本差异都在下半。

## 常见误解

- **「all-reduce 拆成两半，通信量就减半了」**——BF16 下没有：本来就是这两段，SP 只是把接缝撬开塞进几步计算，官方文档原话就是拆开本身不带来性能收益。W8A8 部署下通信量真的减半，但那一半是量化挪位、BF16 变 INT8 省出来的。
- **「配置里名字带 sp 的开关都是一回事」**——有两个互不相干的开关、两套实现：一套给普通模型，一套给视觉多模态（VL）模型，各有各的生效条件。哪个管哪条路，见下半「怎么开」。
- **「开了 SP，decode 也跟着省」**——每步就 1 个 token，切不出什么名堂；dense 模型干脆有 1000 个 token 的门槛不让进。在 v0.23 上它还可能被另一个盯着同一段计算的融合特性静默顶掉，见下半「会报什么错」。
- **「名字带 SP 的都是序列并行」**——[上下文并行](context-parallel.md)那页有 CP 和 SP 的逐项对照表，切的东西完全不同；[AI QoS](ai-qos.md) 页里的「SP」是交换机上的**严格优先级**（Strict Priority），和序列并行只是缩写撞了。

## 对照源码

### 怎么开

普通模型走 FlashComm1（Custom OP 版）。本页例子的启动命令：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B --tensor-parallel-size 2 \
    --additional-config '{"enable_flashcomm1": true}'
```

`enable_sp()` 从头到尾只读一件事——`additional_config["enable_flashcomm1"]`，缺了退到 `AscendConfig.enable_flashcomm1`，再缺才退到环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`（默认 `0`，注释已标 DEPRECATED [C6]）；结果缓存在模块全局 `_ENABLE_SP`，只有 `additional_config["refresh"]` 能让它重算；v0.23 上 `enable_shared_expert_dp` 还会反过来把它顶成 True [C5]，v0.26 起这个参数只为兼容旧调用方保留，不再碰 FlashComm1 [C24]。**它不看模型类型也不看 token 数**——那道门在 `set_ascend_forward_context`：MoE 模型 `flash_comm_v1_enabled = enable_sp(vllm_config) and num_tokens is not None`，dense 模型多一个 `num_tokens > 1000` [C7]。dense 模型想让门槛够得着，得配着调大 `--max-num-batched-tokens`，一步凑不过 1000 就等于开了不生效 [D]。

VL 类模型走 pass 版，命令逐字抄自官方文档 [S23]：

```bash
vllm serve Qwen/Qwen3-VL-2B-Instruct --tensor-parallel-size 2 \
    --compilation-config '{"pass_config": {"enable_sp": true}}'
```

`enable_sp_by_pass()` 读的是 `compilation_config.pass_config.enable_sp`，而且要求 `not enforce_eager` [C13]——这条路靠编译 pass 改图，eager 模式下没有图可改。它的 token 门槛是另一套：`get_sp_min_token_num` 对 dense 返回 1000、对 MoE 返回 1 [C14]；`sp_min_token_num` 在昇腾上默认 1000、官方说一般不必改 [S23]。官方文档把两条路称为互补——pass 版是为 VL 类模型做的，FC1 版基于 Custom OP、难以支持 VL [S3]。**注意 v0.23 官方文档的支持矩阵里 Sequence Parallelism 一行四格全是 `x`，与同一篇文档上面那条 Qwen3-VL 启动命令直接矛盾** [S4] `[!]`——v0.26 那份文档逐行照旧，这处矛盾也照旧。官网页面：[Sequence Parallelism（v0.23.0）](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/sequence_parallelism.html)。

哪些矩阵出口会被换（v0.23 / v0.26 的分派链，`shared_expert` 先排除 [C12]）：行切认 `o_proj` / `out_proj` / `down_proj` / `attention.dense` / `wo_b`，列切认 `gate_up_proj` / `in_proj` / `qkv_proj` / `conv1d` / `query_key_value`。本页模型对得上号：全注意力层的出口是 `o_proj` [C27]，线性注意力（gated deltanet）层的出口是 `out_proj` [C28]——前缀表的注释里就写着「gated deltanet of Qwen3 Next」，40 层一层不落 [D]。

### 会报什么错

这一页的坑基本都**不报错**：

- token 数除不尽 TP 不报错：`pad_size = (tp_world_size - (num_tokens % tp_world_size)) % tp_world_size`，一次算好存在 forward context 上，多算几行零而已。
- SP 与 prefill context parallel 同开时，`max_num_batched_tokens` 被悄悄向上取整到 `tp_size × pcp_size` 的倍数，只留一条 warning [C15] `[!]`。
- v0.23 上与 [fuse_allreduce_rms](../params/fuse-allreduce-rms.md) 同开：两个 pass 盯同一段 all_reduce 加 RMSNorm 子图，融合 pass 排在前面，SP 静默匹配不到、连告警都没有；v0.26 起那个融合 pass 整个文件已删，冲突跟着消失。
- main 上再写 `enable_flashcomm1` 只换来一条 `FlashComm is deprecated` 警告，真正生效与否看上游那个 property [C16] `[!]`。

### 开销和什么时候别开

- **BF16 下别指望省通信。** 换之前一次 all-reduce 搬 `2050 × 2048 × 2 B ≈ 8.0 MiB`（token 数 × hidden_size × BF16 字宽 [S26]），换之后 reduce-scatter 加 all-gather 合计还是 8.0 MiB [D]。官方文档原话：拆开 AllReduce 本身不带来性能收益，减少的 LayerNorm 计算量收益很小；量化部署下 LayerNorm 后跟着 Quant、all-gather 搬 INT8 于是通信量减半，以及两段通信能分别与前后 matmul 融成通算并行算子，才是两项真收益 [S2]。
- **融合那项有硬条件。** `SequenceRowParallelOp.matmul_and_reduce` 里，`flash_comm_v1_enabled` 为假第一句就 `return tensor_model_parallel_all_reduce(...)`；为真且 `mmrs_fusion` 成立才走 `npu_mm_reduce_scatter_base` 一个算子，否则退回「先 matmul 再 reduce-scatter」两步 [C11]。而 `mmrs_fusion = tp_world_size <= 8`，MoE 模型直接置 False [C31]——本页模型吃不到这项。
- **1000 那道门是经验值。** 代码注释写明：并发超过它收益才拉得满，低于它反而可能因为切换通信方式变慢。MoE 分支没有这道门，decode 每步 1 个 token 也进——进去也没东西可省。
- **MoE 那半层怎么配合。** MoE 块把 `flash_comm_v1_enabled` 传给自己通信实现的 `prepare(replace_allreduce=...)`，token 维的收发由 MoE 通路接手；AllGather 通路下路由权重和专家编号也要走一次 `maybe_all_gather_and_maybe_unpad` 凑齐 [C30]；MC2 / AllToAll 通路的输出在 finalize 里本来就 reduce 完，不再重复加总 [C29]。
- **形状三件杂活的真身** [C8]：`maybe_pad_and_reduce`（开了就 `F.pad` 补零再 `tensor_model_parallel_reduce_scatter(x, 0)`，没开原样 all-reduce）、`maybe_all_gather_and_maybe_unpad`（all-gather 后按 `pad_size` 把补的行切掉）、`maybe_chunk_residual`（残差 `chunk(residual, tp_size)[tp_rank]`，调用点在 `AscendRMSNorm.forward_oot` 第一行 [C9]）。
- **eager 模式下 pass 版恒不生效**：`enable_sp_by_pass()` 要求 `not enforce_eager`。

### 版本差异

下表 v0.23 维护分支指 `2c59ff10`、v0.26 分支指 `2ed6cbba`，main 开发主线指 2026-09-21 的源码快照 `baa023ad`。**这六行上 v0.26 与 v0.23 完全同边**，所以只摆两列；这一页的差异比库里大多数页都大——**不是参数改名，是整套实现换了地方**；main 的官网页面是 [Sequence Parallelism（latest）](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/sequence_parallelism.html)。

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `enable_sp()` 读什么 | `enable_flashcomm1` 或同名环境变量，缓存在 `_ENABLE_SP` | `parallel_config.use_sequence_parallel_moe`，上游算好的一个 property | 真相源搬到了上游；main 上再写 `enable_flashcomm1` 只换来一条 deprecated 警告 `[!]` |
| 本页例子（MoE，纯 TP=2）能不能开 | 能，MoE 分支连 token 门槛都没有 | 不能。上游那个 property 要求 all2all 后端在名单里、`enable_expert_parallel`、`tensor_parallel_size > 1` 且 `data_parallel_size > 1` 同时成立 | 「两颗 NPU 开 SP」这个例子在 main 上不成立；dense + 纯 TP 的 SP 在 main 更是整个没了 `[!]` |
| Linear 这一层 | 两条分派链末尾各有一档 `enable_sp()`，返回 `Sequence*ParallelOp` | 两条链里再没有一档读 `enable_sp`，`Sequence*ParallelOp` 两个类整个删掉 [C18] | 想靠 profiling 找 `SequenceRowParallelOp` 的人在 main 上找不到 |
| `maybe_pad_and_reduce` | 按 `flash_comm_v1_enabled` 在 all-reduce 与 reduce-scatter 之间二选一 | 注释写死 “EP communication only”，只剩 EP 那一路，没有 TP 分支 | 同名算子换了职责，照旧理解会读错调用链 |
| 补零写在哪 | forward context 的 `pad_size`，整次 forward 共用 | `models/common/ops/sequence_parallel.py` 里每次现算 `(-x.shape[0]) % tp_size` [C20] | 从「一次算好挂在上下文」变成「谁用谁算」 |
| 官方文档 | 109 行，整篇讲 pass 版 SP，没给过 `enable_flashcomm1` 的开法 | 77 行，整篇讲 SP MoE，写明 flashcomm “deprecated since v0.27.1” [S22] | 两版几乎不重叠，拿一版的命令去配另一版会扑空 |

分派链自己也有一处 v0.23 到 v0.26 的变化：v0.23 上排在 SP 前面的还有 matmul-allreduce 和 FlashComm2 两档，v0.26 已删；行切前面只剩 DSV4 / MLP / OTP，列切前面只剩 DSA-CP / DSV4 / MLP，列切的前缀表多了一个 `indexer_proj` [C25]。

### 源码位置

| 看什么 | 去哪 |
|---|---|
| 开关与缓存 `_ENABLE_SP` | `vllm_ascend/utils.py`，`enable_sp()`（v0.23 / v0.26）；main 的 deprecated 警告也在这里 |
| token 门槛、`pad_size`、`mmrs_fusion` | `vllm_ascend/ascend_forward_context.py`，`set_ascend_forward_context` |
| 三个 `maybe_*` 通信算子 | `vllm_ascend/ops/register_custom_ops.py`，挂法见[自定义算子](ops-and-kernels.md) |
| 残差切一刀的调用点 | `vllm_ascend/ops/layernorm.py`，`AscendRMSNorm.forward_oot` |
| 两条分派链与前缀名单 | `vllm_ascend/ops/linear_op.py`，`_get_column_parallel_op` / `_get_row_parallel_op`（v0.23 / v0.26） |
| matmul 融合分支 | `vllm_ascend/ops/linear_op.py`，`SequenceRowParallelOp.matmul_and_reduce`；列切侧 `SequenceColumnParallelOp` |
| MoE 那半层的接口 | `vllm_ascend/ops/fused_moe/fused_moe.py`，`prepare(replace_allreduce=...)` 与 `_fused_output_is_reduced` |
| pass 版（VL 那条路） | 昇腾 `vllm_ascend/compilation/passes/sequence_parallelism.py`；上游 `vllm/compilation/passes/fusion/sequence_parallelism.py` |
| pass 版的开关判断 | `vllm_ascend/ascend_config.py`，`enable_sp_by_pass()`；SP + PCP 的取整也在这个文件 |
| main 的新家 | `vllm_ascend/models/common/ops/sequence_parallel.py`；上游 `vllm/config/parallel.py` 的 `use_sequence_parallel_moe` |
| 本页模型的两种注意力出口 | 上游 `vllm/model_executor/models/qwen3_next.py`（`o_proj`）；`vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py`（`out_proj`） |
| 模型形状 | Qwen3.6-35B-A3B 官方 config [S26] |
