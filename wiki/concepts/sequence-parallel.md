---
id: sequence-parallel
title: "Sequence Parallel：把那两次 all-reduce 拆成 reduce-scatter 和 all-gather"
type: feature
summary: 不动 TP 的切法，只把一层里那两次 all-reduce 换成 reduce-scatter + all-gather，让 RMSNorm 这类逐 token 的算子只在 1/TP 的 token 上算。BF16 部署下线上的字节数一个没省；W8A8 部署下 Quant 挪到 all-gather 之前，搬 INT8，通信量确实减半。
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
updated: "2026-09-24"
origin: seed
---

## 一句话

序列并行（SP，昇腾侧又叫 FlashComm1）不动[张量并行](tensor-parallel.md)的切法，只改那两次 all-reduce 的形状：**`all_reduce` 换成 `reduce_scatter` + `all_gather`（都沿第 0 维、也就是 token 维），夹在中间的 RMSNorm 于是只在 1/TP 的 token 上算** [C1]。线上搬的字节数一个没省——省的是 norm 那一段的算力和激活长度，以及两头的通信能不能被吸进 matmul 算子里。

```wiki-diagram
file: sequence-parallel
```

## 那条请求用不到它

[那条请求](one-request.md)单卡 TP=1，压根没有 all-reduce 可换。就算换成两张卡也仍然走不到，因为 dense 模型还有第二道门——`set_ascend_forward_context` 里写的是 `flash_comm_v1_enabled = enable_sp(vllm_config) and num_tokens is not None and num_tokens > 1000`，而 MoE 分支没有这个 token 门槛 [C7]。37 个 token 的 prefill 和每步 1 个 token 的 decode 都够不着 1000。

要落到这一页，改两处设定：**一张卡换成两张（`--tensor-parallel-size 2`），问题从 37 个 token 换成 2049 个**，模型和 200 个 token 的回答都不动 [A]。

| 这一页的东西 | 改后的值 | 怎么来的 |
|---|---|---|
| `pad_size` | (2 − 2049 % 2) % 2 = **1** | 补一行零凑成 2050，每卡分到 2050 / 2 = **1025** 个 token |
| 一次 forward 换掉几处 all-reduce | 28 层 × 2 = **56 处** | 每层 `o_proj`、`down_proj` 各一处 [D] |
| 每处搬多少：换之前 / 换之后 | 4.0 MiB / 0.5 × 4.0 + 0.5 × 4.0 = **一样是 4.0 MiB** | 2050 × 1024 × 2 B；ring all-reduce 本来就是这两段 [D] |
| 200 步 decode 里有几步走 SP | **0 步** | 每步 1 个 token，`> 1000` 不成立 [D] |

后两行是这一页的重点：**通信总量一个字节没省，而且 decode 全程不走这条路。**

## 省的不是字节，是 norm 那一段和它两头的融合机会

官方文档把这件事说得比大多数二手介绍都直白：拆开 AllReduce 本身不带来性能收益，它减少的是 LayerNorm 的计算量，而这点收益很小；真正的两项好处一是量化部署下 LayerNorm 后面跟着 Quant、all-gather 搬的是 INT8 于是通信量减半，二是 reduce-scatter 与 all-gather 能分别和前后的 matmul 融成通算并行算子 [S2]。

第二项在代码里看得见：`SequenceRowParallelOp.matmul_and_reduce` 里，`flash_comm_v1_enabled` 为假时第一句就 `return tensor_model_parallel_all_reduce(...)`；为真且 `mmrs_fusion` 成立时走 `npu_mm_reduce_scatter_base` 一个算子，否则才退回「先 matmul 再 `tensor_model_parallel_reduce_scatter`」两步 [C11]。而 `mmrs_fusion` 自己有两道限制：`tp_world_size <= 8`，且 MoE 模型直接置 False。

## 形状怎么对上：补零、切残差、再补回来

三个自定义算子把形状兜住，模型代码里看到的只是 `torch.ops.vllm.` 开头的三个名字 [C8]：

- **`maybe_pad_and_reduce`**——开了就 `F.pad` 补到 TP 的整数倍再 `tensor_model_parallel_reduce_scatter(x, 0)`；没开就原样 `tensor_model_parallel_all_reduce(x)`。
- **`maybe_all_gather_and_maybe_unpad`**——`tensor_model_parallel_all_gather(x, 0)` 之后按 `pad_size` 把补出来的那几行切掉，所以 `qkv_proj` / `gate_up_proj` 拿到的仍是全长。
- **`maybe_chunk_residual`**——残差不经过通信，形状对不上时按 `chunk(residual, tp_size)[tp_rank]` 自己切一刀，调用点就在 `AscendRMSNorm.forward_oot` 的第一行。

`pad_size` 只算一次，存在 forward context 上：`(tp_world_size - (num_tokens % tp_world_size)) % tp_world_size`。**所以 token 数除不尽 TP 不会报错，只是每卡多算几行零。** 另有一处会悄悄改你的配置：SP 与 prefill context parallel 同时开时，`max_num_batched_tokens` 被向上取整到 `tp_size × pcp_size` 的倍数，只留一条 warning [C15]。

哪些层会被换，是两条有序 if 链的最后一档：行切认 `o_proj` / `out_proj` / `down_proj` / `attention.dense` / `wo_b`，列切认 `gate_up_proj` / `in_proj` / `qkv_proj` / `conv1d` / `query_key_value`，两条都先把 `shared_expert` 排除掉 [C12]。顺序即优先级，排在前面的一档命中之后 SP 这一档就静默轮不上，这条规则在 [Tensor Parallel](tensor-parallel.md) 那页说全了。**v0.23 上排在 SP 前面的还有 matmul-allreduce 和 FlashComm2，v0.26 上这两档已经删掉**：行切前面只剩 DSV4 / MLP / OTP，列切前面只剩 DSA-CP / DSV4 / MLP，列切的前缀表则多了一个 `indexer_proj` [C25]。

## 开关有两个，名字都叫 sp

这是最容易踩的地方：`enable_sp()` 和 `pass_config.enable_sp` 互不相干，走两套实现。

`utils.enable_sp()` 从头到尾只读一件事——`additional_config["enable_flashcomm1"]`，缺了退到 `AscendConfig.enable_flashcomm1`，再缺才退到环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`；结果缓存在模块全局 `_ENABLE_SP`，只有 `additional_config["refresh"]` 能让它重算；v0.23 上还有一条——`enable_shared_expert_dp` 会反过来把它顶成 True [C5]，v0.26 起这个参数只为兼容旧调用方保留，不再改动 FlashComm1 的开关 [C24]。**它不看模型类型也不看 token 数**——那两道门在上一节的 forward context 那一层。环境变量默认 `0`，注释里已标着 DEPRECATED [C6]。

另一个 `enable_sp_by_pass()` 读的是 `compilation_config.pass_config.enable_sp`，而且要求 `not enforce_eager` [C13]——这条路靠 Inductor pass 改图，eager 模式下没有图可改。它的 token 门槛也是另一套：`get_sp_min_token_num` 对 dense 返回 1000、对 MoE 返回 1 [C14]。官方文档把两条路称为互补——pass 版是为 VL 类模型做的，FC1 版基于 Custom OP、难以支持 VL [S3]。

两条路的启动命令因此完全不一样：

```bash
# ① FlashComm1（Custom OP 版）：dense 模型走这条
vllm serve Qwen/Qwen3-0.6B --tensor-parallel-size 2 \
    --max-num-batched-tokens 8192 \
    --additional-config '{"enable_flashcomm1": true}'

# ② pass 版：VL 类模型走这条，逐字抄自官方文档
vllm serve Qwen/Qwen3-VL-2B-Instruct --tensor-parallel-size 2 \
    --compilation-config '{"pass_config": {"enable_sp": true}}'
```

②那条命令与「`sp_min_token_num` 在昇腾上默认 1000、一般不必改」的说法都出自官方文档 [S23]。TP 必须大于 1，否则没有 all-reduce 可换；`--max-num-batched-tokens 8192` 是为了让一步凑得过 1000 那道门，凑不过就等于开了不生效 [D]。**注意 v0.23 官方文档的支持矩阵里 Sequence Parallelism 一行四格全是 `x`，与同一篇文档上面那条 Qwen3-VL 启动命令直接矛盾** [S4] `[!]`——v0.26 那份文档逐行照旧，这处矛盾也照旧。两条命令对应的官网页面是 [Sequence Parallelism（v0.23.0）](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/sequence_parallelism.html)。

## 两个发布分支在一边，main 在另一边

下表 v0.23 维护分支指 `2c59ff10`、v0.26 分支指 `2ed6cbba`，main 开发主线指 2026-09-21 的源码快照 `baa023ad`。**这六行上 v0.26 与 v0.23 完全同边**，所以只摆两列；这一页的差异比库里大多数页都大——**不是参数改名，是整套实现换了地方**；main 的官网页面是 [Sequence Parallelism（latest）](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/sequence_parallelism.html)。

| 项 | v0.23 与 v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `enable_sp()` 读什么 | `enable_flashcomm1` 或同名环境变量，缓存在 `_ENABLE_SP` | `parallel_config.use_sequence_parallel_moe`，上游算好的一个 property | 真相源搬到了上游；main 上再写 `enable_flashcomm1` 只换来一条 `FlashComm is deprecated` 警告，真正生效与否仍看上游那个 property `[!]` |
| dense + 纯 TP 能不能开 | 能，门槛是 `num_tokens > 1000` | 不能。上游那个 property 要求 `enable_expert_parallel` 且 `tensor_parallel_size > 1` 且 `data_parallel_size > 1` [C17] | 单机 dense 模型上的 SP 在 main 已经没有了 `[!]` |
| Linear 这一层 | 两条分派链末尾各有一档 `enable_sp()`，返回 `Sequence*ParallelOp` | 两条链里再没有一档读 `enable_sp`，`Sequence*ParallelOp` 两个类整个删掉 [C18] | 想靠 profiling 找 `SequenceRowParallelOp` 的人在 main 上找不到 |
| `maybe_pad_and_reduce` | 按 `flash_comm_v1_enabled` 在 all-reduce 与 reduce-scatter 之间二选一 | 注释写死 “EP communication only”，只剩 EP 那一路，没有 TP 分支 [C21] | 同名算子换了职责，照旧理解会读错调用链 |
| 补零写在哪 | forward context 的 `pad_size`，整次 forward 共用 | `models/common/ops/sequence_parallel.py` 里每次现算 `(-x.shape[0]) % tp_size` [C20] | 从「一次算好挂在上下文」变成「谁用谁算」 |
| 官方文档 | 109 行，整篇讲 pass 版 SP，没给过 `enable_flashcomm1` 的开法 | 77 行，整篇讲 SP MoE，写明 flashcomm “deprecated since v0.27.1” [S22] | 两版几乎不重叠，拿一版的命令去配另一版会扑空 |

## 常见误解

- **「all-reduce 拆成两半，通信量就减半了」**——BF16 下没有：ring all-reduce 本来就是 reduce-scatter 加 all-gather 两段，SP 只是把中间那个接缝撬开塞进 norm，官方文档原话就是拆开本身不带来性能收益。W8A8 部署下通信量真的减半，但那一半是 Quant 挪到 all-gather 之前、数据类型从 BF16 变 INT8 省出来的，不是拆算子省出来的 [S2]。
- **「`--compilation-config '{"pass_config":{"enable_sp":true}}'` 等于打开了 `enable_sp()`」**——两个开关。`enable_sp()` 只读 `enable_flashcomm1`，pass 那个由 `enable_sp_by_pass()` 读，且 eager 模式下恒假。
- **「开了 SP，decode 也跟着省」**——dense 模型要 `num_tokens > 1000` 才生效，decode 每步那几个 token 差得远；而且在 v0.23 上，与它争抢同一段子图的 [fuse_allreduce_rms](../params/fuse-allreduce-rms.md) 还会让它静默失效、连告警都没有——v0.26 起 `allreduce_rmsnorm_fusion_pass.py` 整个文件已经删掉，这条冲突跟着消失。
