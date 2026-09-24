---
id: expert-parallel
title: "专家并行（EP）：专家不切开，按编号分给不同的 NPU"
type: feature
summary: MoE 模型每层有几百个专家，一颗 NPU 放不下时，EP 把每层的专家按编号整份分给参与计算的几颗 NPU；每个 token 被送到它选中的专家所在的 NPU 上算完，再送回来。要写 --enable-expert-parallel，而且参与 MoE 的 NPU 多于一颗才生效。
aliases: [Expert Parallel, 专家并行, EP, ep_size, enable_expert_parallel, "--enable-expert-parallel", MoECommType, select_moe_comm_method, FusedMoEParallelConfig, MC2, MC2 通信, ALLGATHER, ALLTOALL, FUSED_MC2, token dispatch, combine, 专家切分, determine_expert_map, PrepareAndFinalizeWithMC2]
chapters: ["14"]
order: 10
sources:
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L5-L5
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L174-L174
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L223
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3-30B-A3B.md#L98-L98
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L155-L161
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L104-L108
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L141-L175
  - vllm@0fc695fc:vllm/model_executor/models/qwen2_moe.py#L90-L103
  - vllm@0fc695fc:vllm/config/parallel.py#L152-L155
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1073-L1082
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1165-L1168
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1193-L1212
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/expert_map_manager.py#L62-L79
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L233-L237
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L937-L943
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L27-L31
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L95-L101
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L185-L188
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L202-L217
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L240-L252
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L255-L282
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L330-L366
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L102-L102
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L249-L300
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L193-L225
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/moe_comm_method.py#L136-L172
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L225-L234
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L391-L412
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L502-L512
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_utils.py#L48-L49
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L150-L150
  - vllm@568afb3a:vllm/model_executor/models/qwen3_5.py#L159-L161
  - vllm@568afb3a:vllm/model_executor/layers/fused_moe/config.py#L1232-L1240
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L414-L430
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L334-L342
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L488-L495
  - vllm-ascend@2ed6cbba:docs/source/user_guide/support_matrix/supported_models.md#L133-L133
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L318-L333
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L270-L280
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L297-L315
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L366-L370
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L87-L97
  - vllm@0fc695fc:vllm/config/parallel.py#L167-L173
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L139-L139
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: 同一批 MoE 权重的两种切法；EP 一开，FusedMoEParallelConfig 把 MoE 的 tp_size 置 1，TP 在 MoE 层里彻底让位，注意力部分照旧按 TP 切
  - to: who-owns-what
    kind: builds-on
    note: ep_size 与 expert_map 由上游 vLLM 算出来，「这一步用哪种通信」全在昇腾侧决定，这条归属线在那一页
  - to: ops-and-kernels
    kind: builds-on
    note: 四种通信方式最后都落到 torch_npu 算子上，FusedMoE 整个类被换成 AscendFusedMoE 走的是那一页的注册表
  - to: quantization
    kind: builds-on
    note: dispatch 要不要顺手把 token 量化成 int8、A3 上能不能走融合的 FUSED_MC2，都由这一层选出的量化类型决定
  - to: data-parallel
    kind: builds-on
    note: ep_size 有一部分是 DP 乘出来的，prepare/finalize 里的 DP all-gather 也建立在 DP rank 齐步走之上
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 256 个专家，一颗 NPU 放不下

这一页用一个具体的例子来讲：在两颗昇腾 NPU 上部署 Qwen3.6-35B-A3B，发一个 37 个 token 的问题，让它回答 200 个 token。整个知识库用的都是这个例子，完整设定见[贯穿全站的例子](one-request.md)。

Qwen3.6-35B-A3B 是一个 MoE 模型。MoE 是 Mixture of Experts 的缩写，意思是「混合专家」：模型的每一层里，除了注意力，还有一组「专家」。每个专家是一个小的前馈网络，说白了就是三块矩阵。这个模型每层有 256 个专家。

一个 token（模型处理文字的最小单位，大约一个词或半个词）走到这一层时，并不会让 256 个专家都算一遍。有一个很小的打分网络，叫路由器，先给 256 个专家打分，只挑分最高的 8 个来算这个 token，其余 248 个这次不动。模型名字里的「35B-A3B」说的就是这件事：参数一共约 350 亿，每个 token 实际用到的只有约 30 亿，A 是 activated（被用到的）的意思。

每个 token 只用 8 个专家，但 256 个专家都得放着：路由器下一个 token 会挑谁，事先不知道，所以 256 个专家的权重（训练好的那些矩阵里的数）必须一直待在显存里。算一下有多大。一个专家三块矩阵，每块 2048 × 512 个数，用 BF16 格式存，每个数占 2 字节：

```
3 × 2048 × 512 × 2 B = 6 MiB     一个专家
6 MiB × 256          = 1.5 GiB   一层的专家
1.5 GiB × 40 层      = 60 GiB    整个模型的专家
```

例子跑在 Atlas A3 上。这里说的一颗 NPU，指 vLLM 看到的一个计算设备，作用相当于 GPU；在 A3 上它就是一颗昇腾芯片，一张 A3 卡上有两颗，每颗 64 GB 显存。60 GiB 换算过来约 64.4 GB，光是专家就比一颗 NPU 的显存还大，这还没算注意力部分的权重，也没留地方存 KV Cache。所以这个模型至少要拆到两颗 NPU 上，例子里用的正是两颗。

```wiki-diagram
file: expert-parallel-fit
```

## 两种拆法：把每个专家切开，或者把专家分开

拆到两颗上有两种办法。

第一种是[张量并行（TP）](tensor-parallel.md)的办法：每个专家的每块矩阵都从中间切开，两颗 NPU 各拿一半。一个 token 选中的 8 个专家，两颗 NPU 都要各算每个专家的一半，算完再把两半的结果加起来。

第二种就是专家并行（EP）：专家本身不切，按编号分成两堆。0 到 127 号专家整份放在 NPU 0 上，128 到 255 号整份放在 NPU 1 上。一个 token 选中的专家在哪颗 NPU 上，这个 token 就到哪颗上去算。

```wiki-diagram
file: expert-parallel-split
```

只有两颗 NPU 时，两种办法看不出多大差别；颗数一多就不同了。每个专家的矩阵只有 512 列宽，按 TP 切给 16 颗，每颗只剩 32 列，每次乘法都只是很小的一块，而每层最后「把各份结果加起来」那一步要搬的数据量和切成几份无关，并不会因为切得碎而变少。按 EP 分给 16 颗，每颗整份拿 16 个专家，每个专家的矩阵还是原来那么大。官方给这个模型的部署示例用的就是 EP。

例子的启动命令里同时写了 `--tensor-parallel-size 2` 和 `--enable-expert-parallel`。注意力部分照旧按 TP 切成两半，MoE 部分改成按 EP 分专家。两个开关管的是模型里不同的部分，不冲突。

## 一个 token 在一层 MoE 里走四步

看例子的第一步：问题的 37 个 token 一起进入第 1 层。注意力部分算完时，两颗 NPU 手里都有全部 37 个 token 的数据。进 MoE 之前先分工：37 补一个空位凑成 38，对半分，NPU 0 负责前 19 个，NPU 1 负责后 18 个再加那个空位。

```wiki-diagram
file: expert-parallel-assign
```

每颗 NPU 对自己负责的每个 token 做四件事，编号和下面那张图里圆圈中的数字一一对应：

1. **挑专家。** 路由器挑出 8 个专家的编号。挑谁只看 token 本身，和专家放在哪颗 NPU 上无关，所以开不开 EP，每个 token 选中的专家都一样。
2. **发出去。** 选中的专家有的在本颗，有的在另一颗。在另一颗上的，就把这个 token 发过去。发的是 token 的数据，一个 2048 个数的向量，BF16 下 4 KiB。专家的权重从头到尾待在原地不动。
3. **各算各的。** 每颗 NPU 只算落到自己那 128 个专家上的 token。
4. **收回来。** 算完的结果送回负责这个 token 的那颗 NPU，按路由器打的分加权相加，就是这个 token 在这一层 MoE 的输出。

```wiki-diagram
file: expert-parallel
```

最后两颗 NPU 再把各自负责的结果合到一起，两边又都有了全部 37 个 token，接着进下一层。

除了这 8 个挑出来的专家，每层还有 1 个共享专家，所有 token 都要经过它，不需要路由器挑。它不按 EP 分，而是和注意力部分一样按 TP 切在两颗 NPU 上。

一颗 NPU 负责 19 个 token，每个挑 8 个专家，就是 152 次「token 找专家」。如果路由完全均匀，其中大约一半要发到另一颗上。实际的路由并不均匀，有的专家特别受欢迎，它所在的那颗 NPU 就更忙，这是 [EPLB](eplb.md) 要解决的问题。

## 代价：每层要在两颗 NPU 之间来回一趟

EP 让每颗 NPU 只放一半专家，也就是 30 GiB。代价是通信：每一层 MoE 都有一次「发出去」和一次「收回来」，也就是上面那张图里紫色的两段。模型有 40 层，模型每往前算一步，两颗 NPU 之间就要来回 80 次。生成回答时每一步只有 1 个新 token，这 80 次通信照样一次不少。

有两种情况开了也没用：只有一颗 NPU 参与时，这个开关不起作用，也不报错；模型本身不是 MoE 的，同样不起作用。

## 对照源码

这一节给要读代码、查配置、排查问题的人。上面讲解里的每个数，依据都在这里。

### 怎么开

例子用的启动命令（BF16 权重），这也是开 EP 的最小写法：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel
```

- `--enable-expert-parallel` 是唯一的开关，默认关 [C10]。官方教程给这个模型的示例用的是 W8A8 权重，多了 `--quantization ascend` 和一组调优参数；EP 的部分就这两行，并注明同一个 MoE 层里不要把 TP 和 EP 混着用 [S4]。教程写明 A3 与 A2 都能部署。
- 没有单独设 EP 大小的参数。上游先把 `dp_size × pcp_size × tp_size` 压成一个数，开了 EP 且这个乘积大于 1，`use_ep` 才为真；然后 `ep_size` 取压扁后的那个数，MoE 自己的 `tp_size` 置 1 [C13]。所以 TP=2、DP=1 得到 `ep_size = 2`，TP=1、DP=2 也是 2。PP 不算在内。
- 专家怎么分：默认 `expert_placement_strategy = "linear"`，按编号连续分；`determine_expert_map` 均分，除不尽时余数补给前几个 rank，本卡没有的专家在 `expert_map` 里记 `-1` [C14]。256 ÷ 2 整除，NPU 0 拿 0–127，NPU 1 拿 128–255。
- 模型侧：文本部分每一层的 MLP 都是 `Qwen3NextSparseMoeBlock`。路由专家交给 `FusedMoE`；共享专家是一个普通 MLP，用 `MergedColumnParallelLinear` 和 `RowParallelLinear` 搭成，所以按 TP 切，不参与 EP [C8]。
- 模型形状（40 层、每层 256 个专家、每个 token 挑 8 个、专家中间宽 512、隐藏维 2048）来自官方配置 [S1]；「总参数 35B、每 token 约 3B」来自教程 [S2]。A3 一张卡上有两颗芯片，系统里一共 16 个设备 [S5]；vLLM 按设备计数，本页的「一颗 NPU」就是一个设备。

### 会报什么错

- 这个开关本身不报错。只有一颗 NPU 参与 MoE 时 `use_ep` 为假，昇腾侧直接选 `ALLGATHER`，也就是不按专家分；只在 debug 级别的日志里记一行 `MoE comm method selected: ...` [C23]。
- 设备不是 A2、A3、A5、310P 之一时，选通信方式那一步抛 `ValueError: Unsupported soc_version: ...`。
- 专家数不能被 `ep_size` 整除时不报错，但两处算出的本地专家数会不一样：上游把余数补给前几个 rank，昇腾随后又用整除 `global_num_experts // ep_size` 覆盖了本地专家数 [C15]。`ops/fused_moe/` 和 `eplb/` 下唯一的整除检查属于 EPLB，报错是 `(n_expert + n_redundant) % ep_size must be 0` [C31]，普通 EP 没有这道检查 [!]。256 个专家配 2、4、8 颗 NPU 都整除，踩不到。
- TP 大小超过专家数时，建层就抛 `Tensor parallel size ... is greater than the number of experts ...` [C7]。这个模型有 256 个专家，实际碰不到。

### 开销和什么时候别开

- 「发出去、收回来」用哪种通信方式，不是启动时定的，而是每一步现选：`set_ascend_forward_context` 拿这一步跨 DP 的最大 token 数调 `select_moe_comm_method` [C18]。可选的只有四种：`ALLGATHER`、`MC2`、`ALLTOALL`、`FUSED_MC2`。
- 例子在 A3 上：`FUSED_MC2` 默认关，`VLLM_ASCEND_ENABLE_FUSED_MC2` 默认 0 [C24]；于是 token 数不超过 MC2 容量就走 `MC2`，超过就走 `ALLTOALL` [C22]。MC2 容量是 `min(ceil(max_num_tokens / tp_size), 512) × tp_size`，每个 TP rank 封顶 512 [C20]。prefill 那步 37 个 token、decode 每步 1 个，都在容量内，两种步都走 `MC2`，由融合算子 `npu_moe_distribute_dispatch_v2` 把 token 真的发过去。
- 「对半分」的来历：`padded_num_tokens = ceil(37 / 2) × 2 = 38` [C19]；MC2 的 prepare 先补齐，再按 TP rank 沿 token 维切开；finalize 再 all-gather 回全量，并去掉补的那一行。decode 时 1 补成 2，NPU 1 拿到的那一行是空位。
- 不管选哪种通信，一层 MoE 的骨架都一样：dispatch、本地专家计算、combine。
- 换到 A2 上结果不同。A2 要同时满足「每颗专家数 ≤ 24、EP 颗数 ≥ 16、在容量内」才走 `MC2`，否则走 `ALLGATHER` [C21]。这个模型两颗 A2 时每颗 128 个专家，选出来的是 `ALLGATHER`：每颗都拿全部 token，只挑落在自己专家区间里的那些算 [C29]，一个 token 都不按路由发。要在 A2 上走到 `MC2`，得 16 颗以上：256 ÷ 16 = 16 ≤ 24 [D]。
- `ALLTOALL` 是按路由真发包、去一趟回一趟的通用路径。
- 负载不均时看 [EPLB](eplb.md)。这个模型的官方教程没有提 EPLB，EPLB 在它上面有没有验证过，教程里查不到。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 这个模型的支持状态 | 支持 | 实验性支持 [S38] | 实验性支持 | v0.26 起降为实验性，官方没写原因 |
| A3 上怎么选 | 按设备代次分支，`_select_a3_moe_comm_method` | 同名函数前面多两条优先分支（MegaMoE、融合 MC2），容量还可能被 dispatch v2 的容量覆盖 [C35] | 改成按硬件画像查策略，A3 挂的是 `FUSED_OR_CAPACITY`，判断顺序和 v0.26 相同 [C39] | 默认配置下三个版本都走 `MC2`；MegaMoE 要 `enable_fused_mc2 == 1` 才会开 |
| A2 上专家数超过 512 | 无特判 | 直接 `ALLGATHER` [C36] | 无此条 | 这个模型 256 个专家，不受影响 |
| MoE 模型挂 LoRA 又开 EP | 照常按硬件选 | 强制 `ALLTOALL` [C37] | 同 v0.26 | [!] MC2 那条融合算子的路，LoRA 打不了补丁；v0.23 上这个组合仍会走进去 |

上游这边，`ep_size` 取压扁后的数、MoE 的 `tp_size` 置 1，在 vLLM v0.23.0 与 v0.26.0 上一字不差 [C34]；Qwen3.5 系列每层用 `Qwen3NextSparseMoeBlock` 这一点，v0.26.0 上也一样。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| EP 大小怎么算 | 上游 `vllm/model_executor/layers/fused_moe/config.py`，`FusedMoEParallelConfig.make` |
| 专家分给谁 | 上游 `vllm/model_executor/layers/fused_moe/expert_map_manager.py`，`determine_expert_map` |
| 这个模型的 MoE 层 | 上游 `vllm/model_executor/models/qwen3_next.py`，`Qwen3NextSparseMoeBlock` |
| 每步选哪种通信 | `vllm_ascend/ascend_forward_context.py`，`select_moe_comm_method` |
| token 怎么分给两颗、怎么合回来 | `vllm_ascend/ops/fused_moe/prepare_finalize.py`，`PrepareAndFinalizeWithMC2` |
| 发和收 | `vllm_ascend/ops/fused_moe/token_dispatcher.py` |
