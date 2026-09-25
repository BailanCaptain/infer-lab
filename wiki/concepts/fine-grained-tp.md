---
id: fine-grained-tp
title: "Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切"
type: feature
summary: 模型复制成很多份时，每颗 NPU 都存着一模一样的词表等大矩阵；细粒度 TP 让相邻几份副本把这几张表分着存，省显存，代价是每次用到都要多通信一次。
aliases:
  [
    Fine-Grained Tensor Parallelism,
    Fine-grained TP,
    细粒度 TP,
    细粒度张量并行,
    模块级张量并行,
    FinegrainedTPConfig,
    finegrained_tp_config,
    oproj_tensor_parallel_size,
    lmhead_tensor_parallel_size,
    embedding_tensor_parallel_size,
    mlp_tensor_parallel_size,
    olora_tensor_parallel_size,
    OProjRowParallelOp,
    get_otp_group,
    lmheadtp,
  ]
chapters: ["13"]
order: 20
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L45-L52
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L27-L29
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L33-L43
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L91-L101
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L73-L87
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L107-L109
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L529-L534
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L537-L560
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L561-L570
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L584-L593
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L143-L161
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L319-L332
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L117-L133
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L135-L149
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L875-L893
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L183-L222
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L258-L299
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L719
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L792-L811
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L62-L73
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L170-L227
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L302-L321
  - vllm-ascend@2c59ff10:vllm_ascend/attention/dsa_v1.py#L1580-L1622
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/method_adapters.py#L146-L150
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1187-L1195
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L521-L526
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L164-L173
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1139-L1168
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1156-L1196
  - vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L38-L48
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L54-L61
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L683-L693
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/Fine_grained_TP.html
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/Fine_grained_TP.html
  - https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/main/config.json
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L137-L161
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L252-L258
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/qwen_gdn_linear_attn.py#L545-L552
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 列切 / 行切与那两次 all-reduce 的规矩在那一页；这里只换掉「用哪个通信组」这一件事
  - to: data-parallel
    kind: builds-on
    note: 组是沿 DP 轴连续取 rank 建的，所以每个切分数必须整除 data_parallel_size
  - to: expert-parallel
    kind: builds-on
    note: 配置加载期就拦掉非 MoE 模型，它治的正是 DP+EP 全 DP 部署里注意力侧 TP=1 留下的权重副本
  - to: recompute-scheduler
    kind: builds-on
    note: oproj 与 embedding 两项硬性要求它开着，否则跨 DP 的集合通信会因各 rank num_tokens 不齐挂死
  - to: acl-graph
    kind: builds-on
    note: oproj 那项禁止 enforce_eager，静态交换缓冲区的设备地址要在图捕获与回放之间保持不变
  - to: pd-disaggregation
    kind: builds-on
    note: oproj 那项只允许在 kv_role=kv_consumer 的 D 节点上开，混部环境配了起不来
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 16 颗 NPU 存着 16 份一模一样的词表，能不能少存几份

[那条请求](one-request.md)里的 Qwen3.6-35B-A3B 跑在两颗 NPU 上。现在设想把它铺到 16 颗 NPU 上，而且是最常见的铺法：**整个模型复制 16 份，一颗 NPU 一份，请求分给不同的副本各算各的**。这种铺法叫数据并行（DP），每一份副本有个编号，叫 DP rank，从 0 排到 15。

复制的意思是每颗 NPU 上都有一整套权重。其中有两张特别大的表：

- **输入词表**——把 token 换成一串数字的那张 [embedding](embedding.md) 表。这个模型的词表有 248320 个词，每个词对应 2048 个数，每个数 2 字节，一张表就是 **0.95 GiB**。
- **输出词表**——最后一步把 2048 个数换回「下一个词是谁」的那张表，形状一样，也是 **0.95 GiB**。这个模型的两张表不共用，各存各的。

16 颗 NPU 上就躺着 16 份一模一样的这两张表。能不能让几颗 NPU 分着存，每颗只存一段？

这就是细粒度张量并行（细粒度 TP）要做的事。张量并行（TP）本来的意思是「把每层的大矩阵切开分给几颗 NPU」；细粒度 TP 是 vllm-ascend 额外提供的一组开关，**只挑四样东西单独切**：输入词表、输出词表、注意力最后那一步的输出矩阵、普通（非专家）的 MLP 层。每样各设一个切分数，互不影响。

它和平常说的「把 TP 开大一点」不是一回事：切的时候借用的不是 TP 那条轴上的 NPU，而是**几份 DP 副本**。下一节讲这句话的意思。

## 借的是相邻几份副本

把切分数设成 8，意思是：**从 16 份副本里，每相邻 8 份编成一组，组里 8 颗 NPU 把这张表分成 8 段，一颗存一段。**

```wiki-diagram
file: fine-grained-tp
```

16 份副本正好编成两组：DP rank 0–7 一组，8–15 一组。两组各自完整地存着一份表，组内不再重复。每颗 NPU 上的输入词表从 0.95 GiB 降到约 0.12 GiB，输出词表也一样，两张合计每颗省下约 **1.66 GiB**。

从这张图能直接看出两条规矩：

- **切分数必须能整除副本数。** 16 份可以按 2、4、8、16 分组，按 6 分就会剩下几份没人要，启动时直接报错。
- **只有一份副本时它没法用。** 那条请求本身就是这样：两颗 NPU 合起来只是一份副本（DP 份数是 1），它们之间用的是普通 TP——把注意力对半切。切分数只能填 1，而「一颗存一整份」等于没切。

还有一条图上看不出来：**它只给 MoE 模型开**（MoE 就是每层有一堆专家、每个 token 只挑几个来算的那种模型，见 [MoE](moe.md)）。Qwen3.6-35B-A3B 是 MoE，过得了这一关；普通的稠密模型配了会在启动时被拦下。原因是这类全 DP 的铺法本来就是为 MoE 准备的：专家分给各颗 NPU（[专家并行](expert-parallel.md)），注意力那一侧每份副本各存一份——被重复存的正是这些大表。

## 每次用到这张表，都要先凑齐、再还回去

存的时候分开了，算的时候就得把人凑齐。这里要用到几种「一组 NPU 一起收发数据」的动作，第一次遇到先解释一遍：

- **all-gather**：每颗 NPU 把自己那份发给所有 NPU，最后大家都有全部。
- **reduce-scatter**：先把各颗的结果加总，再切开，每颗只留自己那段。
- **all-to-all**：每颗 NPU 给每颗 NPU 都发一份不同的数据。
- 普通 TP 常用的 **all-reduce** 也顺带说一下：每颗把自己那份结果发出去，最后各自拿到加总。

细粒度 TP 切开的表，基本都按同一个套路用：**进门先 all-gather**，把组里 8 颗 NPU 手上的 token 收齐，每颗拿自己那段表把 8 颗的 token 全算一遍；**出门再 reduce-scatter**，把 8 段的半成品加起来，各自只领回自己那几个 token 的结果。注意力的输出矩阵在进门前多一次 all-to-all，把每颗该算的那一段数据先调换过去。

所以细粒度 TP 是**拿通信换显存**。换得划不划算，关键在这张表一步里要用几次：

- **两张词表**：每生成一步各只用一次——输入词表在第一层之前查一次，输出词表在最后一层之后用一次，和模型有多少层无关。每颗省 1.66 GiB，多出来的通信只有一两次——这是最划算的两项。
- **注意力的输出矩阵**：每一层都要过一次。这个模型 40 层里只有 10 层是全注意力，只有这 10 层有这个矩阵，每层 16 MiB，10 层 160 MiB，切 8 份每颗只省约 140 MiB；代价却是这 10 层每层都多一次 all-to-all 加一次 reduce-scatter。在这个模型上它是最不划算的一项。
- **普通 MLP 层**：这个模型 40 层全是 MoE 层，没有前几层那种普通 MLP。这一项是为 DeepSeek 那类「开头几层不是 MoE」的模型准备的，本页不把它算进这个模型的账里。

官方用 DeepSeek 类模型实测过：四项里只有注意力输出那一项让每生成一个 token 的时间**变长**了，其余三项都在变快。别把这四个开关当成「一起开、省显存又提速」。

## 有两项开之前还要先满足别的条件

- **输入词表和注意力输出这两项，要求先开重算调度器。** 这两项的通信跨了好几份副本，而集合通信要求组里每颗 NPU 这一步手上的 token 数一样，否则大家等不齐就卡死。[重算调度器](recompute-scheduler.md)负责把各份副本的 token 数对齐，没它就拦着不让启动。一个特性反过来强制开另一个特性，库里很少见。
- **注意力输出那一项门槛最高。** 普通 TP 必须是 1（每份副本就一颗 NPU）、必须开[图模式](acl-graph.md)、而且只能在 [PD 分离](pd-disaggregation.md)的 D 节点上开。两颗 NPU 普通 TP=2 的那条请求，三条里第一条就过不去。

这套全 DP 加专家并行的大规模部署形态，整体见 [Large-Scale EP](large-scale-ep.md)。

## 容易想错的地方

- **「它是给某一层单独开一个更大的 TP。」**——借的是 DP 副本，所以规矩是「整除副本数」。每份副本内部的普通 TP 一旦大于 1，另外三项配了也不生效，注意力输出那一项直接报错。
- **「官方说它和模型无关，稠密模型也能开。」**——文档开头确实这么写，代码却在启动时拦掉所有非 MoE 模型。以代码为准。
- **「四项一起开，省显存又提速。」**——两张词表是白捡的；注意力输出每层都要多两次通信，官方实测反而变慢。

## 对照源码

### 怎么开

写在 `--additional-config` 的 `finegrained_tp_config` 里，四个键都是整数，默认 0 表示不开：`embedding_tensor_parallel_size`、`lmhead_tensor_parallel_size`、`oproj_tensor_parallel_size`、`mlp_tensor_parallel_size` [C7]。v0.23 与 v0.26 上还有第五个键 `olora_tensor_parallel_size`，main 上已删 [C28]。

上半那个假设场景（16 颗 NPU 全 DP + 专家并行，两张词表各切 8 份）写成命令是这样（v0.23 写法）：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --data-parallel-size 16 \
    --tensor-parallel-size 1 \
    --enable-expert-parallel \
    --additional-config '{
        "recompute_scheduler_enable": true,
        "finegrained_tp_config": {
            "embedding_tensor_parallel_size": 8,
            "lmhead_tensor_parallel_size": 8
        }
    }'
```

每个值的来由：Qwen3.6-35B-A3B 是 MoE，过得了 `is_moe` 那道门 [C10]；`8` 要整除 `--data-parallel-size 16`；`--tensor-parallel-size 1` 是全 DP 部署的前提，main 文档写明 `tensor_parallel_size > 1` 时这几项不生效 [S31]；`recompute_scheduler_enable` 是 `embedding` 那项的硬前提 [C11]——**官方 feature guide 的示例里没有这一行，照抄起不来** `[!]`（官方示例是 DeepSeek-R1、各项设 8 [S5]）；v0.26 起这个开关改读 `scheduler_config` 里的字段 [C27]，写法见[重算调度器](recompute-scheduler.md)那一页。`oproj_tensor_parallel_size` 没写，因为它还要求这是 PD 分离的 D 节点 [C8]；`mlp_tensor_parallel_size` 没写，理由见「开销和什么时候别开」。这个场景是为讲清机制设的，不是官方给 Qwen3.6-35B-A3B 的部署示例。

### 会报什么错

全部在配置加载期抛出：

| 条件 | 报错 | 出处 |
|---|---|---|
| 任一项 `> 0` 而模型不是 MoE | `AssertionError("The finegrained tp sizes can be enabled only for MOE models.")` | |
| 任一项不整除 `data_parallel_size` | `AssertionError("finegrained tp sizes must divide by data_parallel_size.")` | |
| `oproj` 或 `embedding` 项 `> 0` 而 `recompute_scheduler_enable` 为假 | `AssertionError` | |
| `oproj` 项且 `tensor_parallel_size > 1` | `AssertionError`：`wo_a` / `wo_b` 只由 OTP 组切，而 `_forward_o_proj` 按 `n_local_groups = n_groups // tp_size` 重排输入，两个轴对不上 | |
| `oproj` 项且 `enforce_eager` | `AssertionError("oproj_tensor_parallel_size is only supported in graph mode")`：静态交换缓冲区是为图回放准备的，eager 下 `dummy_run` 跑不到整个 attention 模块 | |
| `oproj` 项且不是 `is_kv_consumer` | `AssertionError`：只允许在 PD 分离的 D 节点上开 | |
| `lmhead` 项与 `enable_reduce_sample` 同时配 | `ValueError` | |

`recompute_scheduler_enable` 那条的注释给了理由：这两项是**跨 DP rank** 的 HCCL（昇腾卡间通信库）集合通信，要求各 rank 的 `num_tokens` 一致；MC2 那条「token 数不齐就跳过」的路会让各 rank 各保各的 `num_tokens`，形状一对不上就死锁。

文档与代码的冲突：feature guide 第一句写支持 Llama、Qwen、DeepSeek 的 dense 变体 [S2]，代码却对非 MoE 模型直接 `AssertionError`。**以代码为准** `[!]`。另外 `tensor_parallel_size > 1` 时，除 `oproj` 外三项**不报错也不生效**——细粒度组建在固定 `tp_idx` 上，组里每个 rank 拿的本来就是同一份标准 TP 分片 [S31]。

### 开销和什么时候别开

**Qwen3.6-35B-A3B 上的显存账**（bf16，与[那条请求](one-request.md)一致；形状取自官方 config [S36]）：

| 这张表 | 不开时每颗整份 | 切 8 份每颗省下 |
|---|---|---|
| `embed_tokens` | 248320 × 2048 × 2 B = **0.95 GiB** | 0.83 GiB |
| `lm_head`（`tie_word_embeddings: false`，单独一份） | 同上 = **0.95 GiB** | 0.83 GiB |
| `o_proj`：10 层全注意力，每层 (16 × 256) → 2048 | 10 × 4096 × 2048 × 2 B = **160 MiB** | 140 MiB |
| dense MLP | 无——40 层全是 MoE 块 [C37] | — |

合计每颗约省 **1.8 GiB** [D]。`o_proj` 只按 10 层算，是因为只有全注意力层建 `self_attn`（`Qwen3NextAttention`，输出层 prefix 为 `.o_proj`）[C38]；线性注意力层的输出层 prefix 是 `.out_proj` [C39]，而 `_get_row_parallel_op` 只认 `"o_proj" in prefix` [C18]，所以不受影响。

**MLP 那项在这个模型上别开。** `is_moe_layer` 用 `n_routed_experts` / `first_k_dense_replace` / `moe_layer_freq` 判断一层是不是 MoE [C19]，这是 DeepSeek 的字段名；Qwen3.6 的 config 里没有这两个字段（专家数叫 `num_experts`）[S36]，`first_k_dense_replace` 落到默认值 `inf`，于是**每一层都被判成「不是 MoE 层」**，凡是 prefix 里带 `down_proj` / `gate_up_proj` 的普通线性层都会换成 MLP TP 的实现。这个模型里还剩哪些线性层带这两个名字（共享专家是否走这条路、是否被 `shared_expert_dp` 截走），本页没有核到，所以**不给结论、不算进账** `[!]`。

**通信账**。四项的通信形状几乎是同一套：进门 `all_gather` 把组里别的 rank 的 token 收齐，算完 `reduce_scatter` 还回去；`o_proj` 在前面多一次 `dist.all_to_all_single` 把每个 rank 该算的那一段重排过去 [C17]；`lm_head` 是 `all_gather` hidden、算完 `all_to_all` 分 logits [C22]。按组大小 8、本 rank 每个 token 算，`o_proj` 每层要送出去的量 [D]：

- `reduce_scatter`：输出 8 倍行数、hidden 2048，送出 7/8：`7 × 2048 × 2 B = 28 KiB`
- `all_to_all_single`：输入 4096 宽送出 7/8：`3584 × 2 B = 7 KiB`
- 10 层合计每 token 每步约 **350 KiB**，换来每颗少存 140 MiB；而两张词表每步只各跑一次，和层数无关。

官方在 32 卡 DP32+EP32 上实测（DeepSeek 类模型、W8A8）：`o_proj` TP=8 省得最多，TPOT 却**涨 1.5 ms**，另外三项都在改善 [S4]。在 DeepSeek 上 `o_proj` 有 61 层，在 Qwen3.6 上只有 10 层，但省下的也只有 140 MiB——**两边都是拿延迟换显存的那一项**。

**静态交换缓冲区**：DSV4 的 `_forward_o_proj` 和 `_forward_embed_tp` 用的是按 `get_potential_max_tokens()` 定死大小的缓冲区——设备地址要在 ACL Graph 捕获和回放之间保持不变，所以每次都把整块缓冲区发出去，和这一批真有多少 token 无关；容量取 `max_cudagraph_capture_size` [C23][C25]。捕到的最大尺寸越大，小 batch 上白搬的字节就越多 [D]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 特性本身 | 有 | 有 | 有 | `Fine_grained_TP.md` 与 `finegrained_tp_config` 三版都在，四个键名一字未变 |
| 第五个键 `olora_tensor_parallel_size` | 有；`> 0` 就开始查门，但 `olora_tp_enable()` 要 `> 1` 才算真开[C15] | 同 v0.23 | 删了，而 `@config` 带着 `extra="forbid"` | `[!]` 配过它的启动脚本升到 main 会被当成拼写错误直接拒绝 |
| `FinegrainedTPConfig` 怎么建 | 普通类，`dict.get` 取值 | 同 v0.23 | pydantic dataclass，多一条「不能为负」的 `ValueError`，与 vllm_config 相关的校验挪进显式调用的 `_validate_preconditions()` | 负数在 v0.23 / v0.26 上不报错、被当成没开；main 上当场拦住 |
| 那条重算依赖读哪个字段 | 顶层 `additional_config.recompute_scheduler_enable` | 改读 `scheduler_config.recompute_scheduler_enable` | 同 v0.26 | `[!]` 写错位置等于没开，然后被这条断言拦下 |
| 文档说不说「切的是 DP 轴」 | 没说，只写「必须整除 DP size」 | 同 v0.23 | 补了 Standard Tensor Parallelism Requirement 整节 [S31] | `[!]` 只读 v0.23 文档会以为 `tensor_parallel_size > 1` 时这几项照样生效 |

建组那段（`_create_or_get_group` 与四个组名）三版逐字相同，`_forward_embed_tp` 的静态缓冲区写法也一样——差异全在配置层，不在执行层。主叙述按 v0.23 写。

### 源码位置

- **配置与校验**：`FinegrainedTPConfig.__init__` 读四（五）个键，`oproj` / `olora` 的门，MoE 与整除两道门；`AscendConfig.__init__` 里的重算依赖 与 `enable_reduce_sample` 互斥。
- **建组**：`_create_or_get_group` 把全部 rank reshape 成 `(pp, dp, tp)`，**固定一个 `tp_idx`、沿 dp 下标连续取 `group_size` 个**建成一组。DP=16、组大小 8 就是 rank 0–7、8–15 两组。四个组名是 `otp` / `lmheadtp` / `emtp` / `mlptp`，大小相同的组只建一次、后来的直接复用。
- **层怎么换**：被切的层不是多收了个参数，是整个换了类。`_get_row_parallel_op` 按 prefix 派活：`o_proj` 换成 `OProjRowParallelOp`、`down_proj` 换成 `MLPRowParallelOp`（还要 `is_moe_layer` 为假），它们的 `comm_group` property 指向对应的细粒度组。`AscendVocabParallelEmbedding.__init__` 按 prefix 里有没有 `head` / `embed_tokens` 挑 `comm_group`，`tp_size` 与 `tp_rank` 全部从这个组上取；前向见。
- **量化**：W8A8 的 `apply` 对这几个 prefix 传的 `tp_rank` 取自细粒度组的 `rank_in_group`，而不是全局 TP 的那个。
- **Qwen3.6 的层结构**：全注意力 / 线性注意力 / MoE 块的构造，`o_proj`，`out_proj`。
