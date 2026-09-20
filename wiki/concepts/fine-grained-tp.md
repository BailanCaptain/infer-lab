---
id: fine-grained-tp
title: "Fine-Grained Tensor Parallelism：给个别大矩阵单独借几个 DP rank 来切"
type: feature
summary: 全局 TP 之外，单独给 embedding、lm_head、o_proj、dense MLP 各设一个切分数；切的是 DP 轴——从同一份 DP 里借几个 rank 把这张表分掉，省的是重复的权重副本。
aliases:
  [
    Fine-Grained Tensor Parallelism,
    细粒度 TP,
    模块级张量并行,
    FinegrainedTPConfig,
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
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1135-L1164
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1166-L1192
  - vllm-ascend@b255ab59:vllm_ascend/config_utils.py#L38-L48
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L54-L61
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L680-L690
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/Fine_grained_TP.html
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/Fine_grained_TP.html
  - https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/main/config.json
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
updated: "2026-09-21"
origin: seed
---

## 一句话

除了给整个模型设一个 `tensor_parallel_size`，vllm-ascend 还允许**单独给四个模块各设一个切分数**：`embedding`、`lm_head`、`o_proj`、以及 dense 层的 MLP。它不是「把某一层的 TP 开大一点」——**这四个数切的是 DP 轴，说的是「从同一份 DP 里借几个 rank 把这张表分掉」**，所以硬约束写成「整除 `data_parallel_size`」。列切行切那一套规矩不在这一页，在 [Tensor Parallel](tensor-parallel.md)。

三个在册版本上都有：`docs/source/user_guide/feature_guide/Fine_grained_TP.md` 与 `finegrained_tp_config` 在 v0.23 维护分支、v0.26 分支（2026-09-17 源码快照）、main 开发主线上逐个 `git ls-tree` / `git grep` 都查得到，四个键名从 v0.23 到 main 一字未变 [C7][C28]。v0.23 与 v0.26 上还有第五个键 `olora_tensor_parallel_size`，main 上已删 [C28]。主叙述按 v0.23 写。

```wiki-diagram
file: fine-grained-tp
```

## 那条请求用不到它

[那条请求](one-request.md)是 Qwen3-0.6B、单卡、TP=1、DP=1，两道门各挡一次：`model_config.is_moe` 为假就抛 `AssertionError("The finegrained tp sizes can be enabled only for MOE models.")`；就算换成 MoE，`data_parallel_size % 该值 != 0` 同样抛 [C10]。DP=1 时唯一填得进去的数是 1，而「一个 rank 存一份」等于没切。

要有数可算得换一台机器。照官方示例把模型换成 DeepSeek-R1，16 张卡按 `--data-parallel-size 16 --tensor-parallel-size 1 --enable-expert-parallel` 起，各项设 8 [S5]。R1 的形状是 vocab 129280、hidden 7168、61 层、`first_k_dense_replace=3`、128 个注意力头、`v_head_dim=128`、dense 层 `intermediate_size=18432` [S35]：

| 这张表 | 不开时每卡整份 | 切 8 份省下 |
|---|---|---|
| `embed_tokens` | 129280 × 7168 × 2 B = **1.73 GiB** | 1.51 GiB |
| `lm_head` | 同上 = **1.73 GiB** | 1.51 GiB |
| `o_proj`：61 层，每层 (128×128) → 7168 | 61 × 16384 × 7168 × 1 B = **6.67 GiB** | 5.84 GiB |
| dense MLP：前 3 层，每层 3 个 7168×18432 | 3 × 3 × 7168 × 18432 × 1 B = **1.11 GiB** | 0.97 GiB |

合计省 **9.83 GiB**。官方在 32 卡 DP32+EP32 上实测的是 5.8 / 1.51 / 1.51 / 0.9 GB，合计 9.72 GB [S4]——前三项分毫不差，MLP 那项算出 0.97、文档写 0.9，差 7%。对得上这件事反过来钉住了两件文档没写的前提：**`o_proj` 和 MLP 的权重每个 1 字节（W8A8），而 `embed_tokens` 与 `lm_head` 在同一份权重里仍是 bf16**——按 1 字节算那两项只有 0.76 GiB，1.51 就对不上了 [D]。

## 「TP=8」说的是借 8 个 DP rank

`_create_or_get_group` 把全部 rank reshape 成 `(pp, dp, tp)`，然后**固定一个 `tp_idx`、沿 dp 下标连续取 `group_size` 个**建成一组 [C13]。DP=16、组大小 8 就是两组：rank 0–7 一组，8–15 一组。四个模块各要一个组，名字是 `otp` / `lmheadtp` / `emtp` / `mlptp`，大小相同的组只建一次、后来的直接复用。

被切的层不是多收了个参数，是整个换了类。`_get_row_parallel_op` 按 prefix 派活：`o_proj` 换成 `OProjRowParallelOp`、`down_proj` 换成 `MLPRowParallelOp`（还要 `is_moe_layer` 为假），它们的 `comm_group` property 指向对应的细粒度组。`embedding` 与 `lm_head` 则由 `AscendVocabParallelEmbedding.__init__` 按 prefix 里有没有 `head` / `embed_tokens` 挑 `comm_group`，`tp_size` 和 `tp_rank` 全部从这个组上取。量化那条路也跟着改：W8A8 的 `apply` 对这几个 prefix 传的 `tp_rank` 取自细粒度组的 `rank_in_group`，而不是全局 TP 的那个。

照官方示例补齐门槛之后，能直接抄的一段是这样：

```bash
vllm serve deepseek-ai/DeepSeek-R1 \
    --data-parallel-size 16 \
    --tensor-parallel-size 1 \
    --enable-expert-parallel \
    --additional-config '{
        "recompute_scheduler_enable": true,
        "finegrained_tp_config": {
            "embedding_tensor_parallel_size": 8,
            "lmhead_tensor_parallel_size": 8,
            "mlp_tensor_parallel_size": 8
        }
    }'
```

每个值的来由：DeepSeek-R1 是 MoE，Qwen 这类 dense 模型过不了第一道门；`8` 要整除 `--data-parallel-size 16`；`--tensor-parallel-size 1` 既是全 DP 部署的前提也是下一节那三道门之一；`recompute_scheduler_enable` 是 `embedding` 那项的硬前提，**官方 feature guide 的示例里没有这一行，照抄起不来** `[!]`；`oproj_tensor_parallel_size` 没写进去，因为它还要求这是 PD 分离的 D 节点。这套部署形态本身见 [Large-Scale EP](large-scale-ep.md)。

## 61 层和 3 层是两笔完全不同的账

四项的通信形状几乎是同一套：进门 `all_gather` 把组里别的 rank 的 token 收齐，算完 `reduce_scatter` 还回去；`o_proj` 在前面多一次 `dist.all_to_all_single` 把每个 rank 该算的那一段重排过去 [C17]；`lm_head` 是 `all_gather` hidden、算完 `all_to_all` 分 logits。

关键差别不在形状，在**它跑几次**。`mlp_tensor_parallel_size` 只作用在 `is_moe_layer` 为假的层，R1 上就是最前面 3 层 [C19]；`o_proj` 每层都有，61 层。按 decode 时本 rank 24 个 token 算，主项都是那次把 8 倍行数归约回去的 `reduce_scatter`，每层 `7 × 24 × 7168 × 2 B ≈ 2.3 MiB`：

- `o_proj`：每层一次（前面那次 all-to-all 只有 2048 宽，不到 0.1 MiB），61 × 2.3 MiB ≈ **145 MiB**，换来 5.84 GiB 的权重不用从 HBM 读——每省 1 GiB 多搬 25 MiB
- dense MLP：进出各一次，每层 4.6 MiB，只有 3 层，合计 ≈ **14 MiB**，换来 0.97 GiB——每省 1 GiB 多搬 14 MiB
- `lm_head` / `embedding`：整步只跑一次，和层数无关

这正好解释了官方实测表里唯一变差的那一行：`o_proj` TP=8 省得最多，TPOT 却**涨 1.5 ms**，另外三项都在改善 [D]。**所以这四个键不是一个开关的四份，`o_proj` 是拿延迟换显存的那一项。**

还有一处容易忽略：DSV4 的 `_forward_o_proj` 和 `_forward_embed_tp` 用的是**按 `get_potential_max_tokens()` 定死大小的静态交换缓冲区**——设备地址要在 ACL 图捕获和回放之间保持不变，所以每次都把整块缓冲区发出去，和这一批真有多少 token 无关；这个容量取 `max_cudagraph_capture_size` [C23][C25]。[图模式](acl-graph.md)捕到的最大尺寸越大，小 batch 上白搬的字节就越多 [D]。

## 开 `o_proj` 或 `embedding`，就必须先开重算调度器

`AscendConfig.__init__` 里有一条反向硬依赖：这两项任一大于 0 而 `recompute_scheduler_enable` 为假，直接 `AssertionError` [C11]。注释给了理由——它们是**跨 DP rank** 的 HCCL 集合通信，要求各 rank 的 `num_tokens` 一致；只有[重算调度器](recompute-scheduler.md)把这个数对齐，而 MC2 那条「token 数不齐就跳过」的路会让各 rank 各保各的 `num_tokens`，形状一对不上就死锁。库里少见的「特性 A 反过来强制开特性 B」，就是这一条。

`oproj_tensor_parallel_size` 另有三道门，全在配置加载期抛 [C8]：

| 门 | 代码给的理由 |
|---|---|
| `tensor_parallel_size == 1` | `wo_a` / `wo_b` 只由 OTP 组切，而 `_forward_o_proj` 按 `n_local_groups = n_groups // tp_size` 重排输入，两个轴对不上 |
| 不能 `enforce_eager` | 静态交换缓冲区是为图回放准备的，eager 下 `dummy_run` 跑不到整个 attention 模块 |
| 必须 `is_kv_consumer` | 只允许在 [PD 分离](pd-disaggregation.md)的 D 节点上开 |

另外 `lmhead_tensor_parallel_size` 与 `enable_reduce_sample` 互斥，同时配是 `ValueError` [C12]。至于另外三项和标准 TP 的关系，main 的文档补了整整一节说清楚：`tensor_parallel_size > 1` 时它们**不报错也不生效**，因为细粒度组建在固定 `tp_idx` 上，组里每个 rank 拿的本来就是同一份标准 TP 分片 [S31]。

## 版本之间的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 第五个键 `olora_tensor_parallel_size` | 有；`> 0` 就开始查门，但 `olora_tp_enable()` 要 `> 1` 才算真开 | 同 v0.23 | 删了，而 `@config` 带着 `extra="forbid"` [C30] | `[!]` 配过它的启动脚本升到 main 会被当成拼写错误直接拒绝 |
| `FinegrainedTPConfig` 怎么建 | 普通类，`dict.get` 取值 | 同 v0.23 | pydantic dataclass，多一条「不能为负」的 `ValueError`，与 vllm_config 相关的校验挪进显式调用的 `_validate_preconditions()` [C29] | 负数在 v0.23 / v0.26 上不报错、被当成没开；main 上当场拦住 |
| 那条重算依赖读哪个字段 | 顶层 `additional_config.recompute_scheduler_enable` | 改读 `scheduler_config.recompute_scheduler_enable` [C27] | 同 v0.26 | `[!]` 开关写法在[重算调度器](recompute-scheduler.md)那一页已经变过一次，写错位置等于没开，然后被这条断言拦下 |
| 文档说不说「切的是 DP 轴」 | 没说，只写「必须整除 DP size」 | 同 v0.23 | 补了 Standard Tensor Parallelism Requirement 整节 [S31] | `[!]` 只读 v0.23 文档会以为 `tensor_parallel_size > 1` 时这几项照样生效 |

建组那段（`_create_or_get_group` 与四个组名）三版逐字相同，`_forward_embed_tp` 的静态缓冲区写法也一样——差异全在配置层，不在执行层。

## 常见误解

- **「它是给某一层单独设一个更大的 TP。」**——切的是 DP 轴。组按固定 `tp_idx` 沿 dp 下标建出来，所以约束是整除 `data_parallel_size` 而不是整除 `tensor_parallel_size`；标准 TP 一旦大于 1，这几项根本不生效。
- **「官方说它 model-agnostic，dense 模型也能开。」**——文档第一句确实写着支持 Llama、Qwen、DeepSeek 的 dense 变体 [S2]，代码却在配置加载期对非 MoE 模型直接 `AssertionError` [C10]。**以代码为准** `[!]`。
- **「四项一起开，省显存又提速。」**——`o_proj` 省得最多也最贵：同样的两次通信它要跑 61 层，官方实测 TPOT 反而涨 1.5 ms。另外三项才是白捡的，它不是。
