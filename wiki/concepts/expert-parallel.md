---
id: expert-parallel
title: "Expert Parallel：每张卡整份拿走一批专家，token 追着专家跑"
type: feature
summary: MoE 层按专家切开，每张卡完整持有一批专家的权重；代价是每层多一次把 token 发出去、一次把结果收回来。
aliases: [Expert Parallel, 专家并行, EP, ep_size, enable_expert_parallel, MoECommType, select_moe_comm_method, FusedMoEParallelConfig, MC2 通信, token dispatch, 专家切分]
chapters: ["14"]
order: 10
sources:
  - vllm@0fc695fc:vllm/config/parallel.py#L152-L155
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1073-L1082
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1165-L1168
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1193-L1212
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/expert_map_manager.py#L62-L79
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L937-L943
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L233-L237
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L71-L101
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_utils.py#L73-L83
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L30-L69
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/moe_comm_method.py#L136-L172
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/moe_comm_method.py#L55-L62
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/moe_mlp.py#L461-L462
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L391-L412
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L225-L234
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L502-L512
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L542-L556
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L321-L341
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L446-L457
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L27-L31
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L95-L101
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L202-L217
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L240-L252
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L255-L282
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L285-L300
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L330-L359
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L84-L96
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L25-L25
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L145-L167
  - https://huggingface.co/Qwen/Qwen3-30B-A3B/blob/main/config.json
  - vllm@568afb3a:vllm/model_executor/layers/fused_moe/config.py#L1232-L1240
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L334-L342
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L488-L495
  - vllm-ascend@b255ab59:vllm_ascend/ascend_forward_context.py#L291-L309
  - vllm-ascend@b255ab59:vllm_ascend/ascend_forward_context.py#L360-L364
  - vllm-ascend@b255ab59:vllm_ascend/device/hardware_profile.py#L93-L99
  - vllm-ascend@b255ab59:docs/source/user_guide/support_matrix/supported_features.md#L25-L25
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: 同一批 MoE 权重的两种切法；EP 一开，FusedMoEParallelConfig 把 MoE 的 tp_size 置 1，TP 在 MoE 层里彻底让位
  - to: who-owns-what
    kind: builds-on
    note: ep_size 与 expert_map 由上游 vLLM 算出来，「这一步用哪种通信」全在昇腾侧决定，这条归属线在那一页
  - to: ops-and-kernels
    kind: builds-on
    note: 四种通信方式最后都落到 torch_npu 算子上，FusedMoE 整个类被换成 AscendFusedMoE 走的是那一页的注册表
  - to: quantization
    kind: builds-on
    note: dispatch 要不要顺手把 token 量化成 int8、A3 上能不能走融合的 FUSED_MC2，都由这一层选出的量化类型决定
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

EP 切的是**专家**，不是矩阵：每个专家的三个矩阵完整地留在一张卡上，卡与卡之间分的是「哪几号专家归你」。代价写在每一层里——路由算出的专家号常常落在别的卡上，于是要**把 token 发出去一次、把结果收回来一次**。**EP 一开，MoE 那部分的 `tp_size` 被直接置 1** [C4]：同一层里 TP 和 EP 不叠加，是替代关系。这条路三个版本上都在，差别只在「这一步选哪种通信」那段代码怎么组织。

```wiki-diagram
file: expert-parallel
```

## 那条请求用不到它：Qwen3-0.6B 连一个专家都没有

[那条请求](one-request.md)是 dense 模型、单卡，两道门一道都过不去。`is_moe_model` 扫 `hf_text_config` 里有没有 expert 相关的键，dense 模型直接为假，`select_moe_comm_method` 连通信方式都不选就返回 `None`；就算换成 MoE 模型，`--enable-expert-parallel` 默认是 `False` [C1]，而且 `use_ep` 还要求 `dp_size × pcp_size × tp_size > 1` [C3]——单卡永远为假。

要走到这里，得换模型也换硬件。照官方那篇大规模 EP 的 prefiller 节点最小改一版，本页后面的数都按它算 [A]：

| 这一页的东西 | 两卡 Qwen3-30B-A3B 上是多少 | 怎么来的 |
|---|---|---|
| 模型 | 48 层全是 MoE 层，每层 128 个专家、top-8 | 模型卡的 `num_hidden_layers` / `num_experts` / `num_experts_per_tok` [S30] |
| 启动 | `--tensor-parallel-size 2 --enable-expert-parallel` | 官方示例里开 EP 就这两行 [S29] |
| `ep_size` / MoE 的 `tp_size` | 2 / **1** | TP、DP、PCP 压扁成一维全给 EP，MoE 自己的 TP 归零 |
| 每张卡的专家数 | 128 ÷ 2 = **64** | `local_num_experts = global_num_experts // ep_size` [C7] |
| 每张卡省下的权重 | ≈ 27 GiB | 一个专家 `3 × 2048 × 768 × 2 B = 9 MiB`，128 个 × 48 层 = 54 GiB，两卡对半 [D] |

## `ep_size` 不是新开的一维，是把 TP 和 DP 压扁全给专家

这是读上游 `FusedMoEParallelConfig.make` 最容易读反的地方：**没有「EP size」这个独立参数**，也没有 `--expert-parallel-size`。`flatten_tp_across_dp_and_pcp` 先把三维压成一个数 `flatten_tp_size = dp_size × pcp_size × tp_size` [C2]，`use_ep` 为真时一句 `ep_size = tp_size` 把它整个接管，同时把 `tp_size` 填成 1。于是：

- TP=2、DP=1 → `ep_size = 2`；TP=1、DP=2 → 也是 `ep_size = 2`；TP=2、DP=2 → `ep_size = 4`。**EP 组就是「所有参与 MoE 的卡」**。
- PP 不算在内。昇腾建 MC2 通信组时先把 pp 那一维转置出去，剩下的 `dp × pcp × tp` 才算一组——EP 不跨流水线段，[Pipeline Parallel](pipeline-parallel.md) 那一页讲的是另一根轴。

谁拿哪几号专家，没开 EPLB 时由上游 `determine_expert_map` 定：均分，除不尽的余数补给前几个 rank，本卡没有的号在 `expert_map` 里记 `-1` [C5]；昇腾在 `init_eplb_config` 里原样转调这一支。有一处对不上要留神：昇腾随后又用 `global_num_experts // ep_size` 覆盖了本地专家数 [C7]，这是整除。`num_experts` 不能被 `ep_size` 整除时两处算出来的数不一样，而我在 `ops/fused_moe/` 和 `eplb/` 下只找到 EPLB 那条 `(n_expert + n_redundant) % ep_size` 检查，没找到挡住普通 EP 这种配比的断言 `[!]`。128 ÷ 2 这种整除的配比踩不到。

把专家权重按号只加载本卡那一份，是加载期的事，和本页这条 forward 路径无关。

## 一个 token 在一层里走四步，只有中间两步跨卡

不管选哪种通信，`MoECommMethod.fused_experts` 的骨架是同一条：

1. **路由** —— `select_experts` 拿 router logits 出 `topk_weights` 和 `topk_ids`，形状都是 `(num_tokens, top_k)`。**它给的是逻辑专家号，和卡无关**，所以开不开 EP 路由结果一样。
2. **dispatch** —— `token_dispatch` 按 `topk_ids` 把 token 送到专家所在的卡。
3. **专家计算** —— `unified_apply_mlp` 在本地这 64 个专家上做一次分组矩阵乘。到这一步每张卡手里只有「该我算的那些 token」。
4. **combine** —— `token_combine` 把结果按来路送回去，再按路由权重加权求和。

外面还套着 `prepare` / `finalize` 一对，负责把各 DP rank 的 token 拼齐、算完再拆回去。这一对搬的东西被写进了源码注释：不开序列并行时是 `Attn → TP AR → DP AG → MoE → DP RS → TP AR`，开了之后 TP 和 DP 的两次收发被合并成一次 EP 级的 all-gather / reduce-scatter。

把逻辑号换成物理副本号的那一步（`log2phy`）只有开了 EPLB 才非空，见 [EPLB](eplb.md)。几十上百卡、PD 分离、外置 DP server 的大规模 EP 另有一整套部署方式，官方文档在 `large_scale_ep.md`，这里不展开。

## 通信方式是每一步 forward 现选的，两卡 A2 上选出来的那种一个 token 都不发

`MoECommType` 只有四个值：`ALLGATHER` / `MC2` / `ALLTOALL` / `FUSED_MC2` [C20]，而且只有 `ep_size > 1` 时四种才全部注册，否则注册表里只有 `ALLGATHER` 一条。**它不是启动参数，是 `set_ascend_forward_context` 每一步 forward 现调 `select_moe_comm_method` 选出来的** [C21]，入参是这一步跨 DP 的最大 token 数。同一次部署里 prefill 那步 token 多、decode 那步 token 少，选出来的可以不是同一种。

v0.23 / v0.26 上的分支顺序是：不是 MoE 模型 → `None`；没开 EP 或 `ep_size == 1` → `ALLGATHER`；之后按 A2 / A3 / A5 / 310P 各走一个函数。三档硬件的判据完全不同：

| 设备 | 判据 | 落到哪 |
|---|---|---|
| A2 | 每卡专家数 ≤ 24 **且** EP 卡数 ≥ 16 **且** token 数 ≤ MC2 容量 [C23] | 全中才 `MC2`，否则 `ALLGATHER` |
| A3 | `enable_fused_mc2` 打开且 EP ≤ 32 走融合算子，否则只看容量 [C24] | `FUSED_MC2` / `MC2` / 超容量 `ALLTOALL` |
| A5 | 容量内且 world size > 1 → `MC2`；world size ≤ top_k → `ALLGATHER` [C25] | 其余 `ALLTOALL` |

MC2 容量不是常数：`min(ceil(max_num_tokens / tp_size), 512) × tp_size`，**每个 TP rank 封顶 512 写死在代码里** [C22]。

把两卡那组配置代进 A2 那一行：每卡 64 个专家 > 24，EP 卡数 2 < 16，两个条件都不满足，**选出来的是 `ALLGATHER`**。而 `ALLGATHER` 压根不把 token 发给别人——它让每张卡都拿着全部 token，调 `npu_moe_init_routing` 时用 `active_expert_range=[first, last]` 只挑落在本卡专家区间里的那些行算 [C14]；DP=1 时连 all-gather 都不发（那段有 `if dp_size > 1` 挡着 [C19]），算完在 MoE 末尾做一次 TP all-reduce 把两张卡的部分和加起来 [C8]。**所以「开了 EP 就会有 all-to-all」在这个配置上是错的。** 真正按路由发包的是 `ALLTOALL`（`async_all_to_all` 去回各一趟）和 `MC2` / `FUSED_MC2`（昇腾融合算子 `npu_moe_distribute_dispatch_v2`）。

这个模型在 A2 上要走到 MC2，得把卡加到 16 张：`128 ÷ 16 = 8 ≤ 24`，且 `16 ≥ 16` [D]。换成 A3，同一条命令两卡、token 数在容量内时走的就是 MC2——那边的判据里根本没有「≥ 16 卡」这一条。

能直接抄的最小一段（其余按官方 prefiller 示例，在官网是 [Distributed DP Server With Large-Scale Expert Parallelism](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/large_scale_ep.html)）：

```bash
vllm serve Qwen/Qwen3-30B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel
```

两个值的来由：`--enable-expert-parallel` 是唯一的总开关，没有第二个参数能调 EP 大小；`2` 既是 TP 大小也是压扁之后的 `ep_size`。约束面官方只写了一行——支持矩阵里 Expert Parallel 标 🟢 Functional，备注是「Support dynamic EPLB」[S28]，既没列硬件限制也没列模型限制，真正的门槛全在上面那张判据表里。

## 三个版本上的差别

主叙述以 v0.23 维护分支（`2c59ff10`，配套 vLLM v0.23.0）为准。上游那套 `ep_size = tp_size`、`tp_size = 1` 在 v0.23.0 与 v0.26.0 上一字不差，四个枚举值三个版本也一字不差。差的全在「怎么挑」。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 按什么分派 | `if soc_version == A2 / A3 / A5 / 310P` 一条 elif 链 | 同 v0.23 | 改成查硬件画像上的 `moe_comm_policy` 字段：四种策略枚举加一张 `_MOE_COMM_SELECTORS` 字典 [C35] | 加一代新硬件不再改这条链，只加一份 profile；读代码得先去 `device/hardware_profile.py` 查这代卡挂的是哪条策略 |
| A2 上专家特别多时 | 没有特判 | 多一条 `num_experts > 512` 直接 `ALLGATHER` [C32] | 同名那条策略里**没有**这一条 [C34] | `[!]` 专家数超过 512 的模型，v0.26 上强制回退 all-gather，v0.23 和 main 仍按密度和卡数判 |
| MoE 模型挂 LoRA 又开 EP | 没有特判，照常按硬件走 | 插在硬件分派之前，直接强制 `ALLTOALL` [C33] | 同 v0.26 | `[!]` 注释写明 MC2 / FUSED_MC2 这条融合算子的路 LoRA 打不了补丁；v0.23 上这个组合仍会走进去 |

## 常见误解

- **「EP 和 TP 可以在 MoE 层里叠着用」**——不能。`use_ep` 为真那个分支返回的配置里 `tp_size=1`、`tp_rank=0`，注释写得很直白：EP 下每张卡完整持有一批专家，没有张量并行。attention 那半边的 TP 不受影响，只有 MoE 这一层让位，详见 [Tensor Parallel](tensor-parallel.md)。
- **「开了 EP，token 就会被 all-to-all 发出去」**——取决于这一步选中的 `MoECommType`。两卡 A2 上选的是 `ALLGATHER`，一个 token 都不发；它靠「每张卡都拿全部 token、只算自己那段专家区间」加末尾一次 all-reduce 出结果。发不发包看设备代次、EP 卡数和这一步的 token 数，不看有没有写 `--enable-expert-parallel`。
- **「通信方式在启动时就定死了」**——它每一次 forward 重选一遍。入参是这一步跨 DP 的最大 token 数，超过 MC2 容量就掉到别的分支，所以同一个服务的 prefill 步和 decode 步完全可能走不同的算子。
- **「`ep_size` 可以单独设」**——没有这个参数。它等于 `dp_size × pcp_size × tp_size`，要调只能调那三个；`--enable-expert-parallel` 只决定这个乘积拿去做 EP 还是做 TP。
