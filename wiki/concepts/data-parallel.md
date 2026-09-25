---
id: data-parallel
title: "数据并行（DP）：把整个引擎复制几份"
type: feature
summary: 模型已经装得下、只是请求排不过来时，把整个引擎再复制一份，请求分给不同副本各自算完。它加的是吞吐，不让单条请求变快；MoE 模型的副本之间每一步还得一起通信，不是完全各算各的。
aliases: [Data Parallel, 数据并行, DP, DP rank, data_parallel_size, dp_size, DPEngineCoreProc, DPCoordinator, DPLBAsyncMPClient, data-parallel-size, 前端负载均衡]
chapters: ["13"]
order: 30
sources:
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1164
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1715-L1717
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1750-L1764
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1890-L1904
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1928-L1932
  - vllm@0fc695fc:vllm/config/parallel.py#L118-L124
  - vllm@0fc695fc:vllm/config/parallel.py#L138-L151
  - vllm@0fc695fc:vllm/config/parallel.py#L500-L504
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L125-L131
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1361-L1362
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L23-L57
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L145-L151
  - vllm@0fc695fc:vllm/config/vllm.py#L560-L580
  - vllm@0fc695fc:vllm/v1/engine/utils.py#L1091-L1095
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1002-L1028
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L686-L691
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L693-L721
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L330-L331
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L321-L340
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L445-L457
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L541-L543
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L344-L374
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L348-L358
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L985-L987
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L632-L637
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L315-L317
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L26-L26
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/feature_matrix.md#L40-L40
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-R1.md#L344-L352
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-R1.md#L269-L288
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/large_scale_ep.md#L139-L141
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/support_matrix/supported_features.html
  - vllm@568afb3a:vllm/v1/engine/core.py#L1288-L1295
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L337-L344
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L729-L732
  - vllm-ascend@2ed6cbba:docs/source/user_guide/release_notes.md#L65-L66
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1498
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1155-L1168
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1852-L1863
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L341-L352
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L255-L282
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 本页 DP=2 的账全是在那条请求的设定上改一个参数算出来的：两颗 NPU 变四颗，注意力照抄一份，专家从每颗 128 个变成每颗 64 个
  - to: vllm-v1-shape
    kind: builds-on
    note: DP 复制的正是那一页讲的「一个 EngineCore 进程 + 它下面的 Worker」，一个 DP rank 一整套
  - to: tensor-parallel
    kind: alternative-to
    note: 同样是加一倍的卡，TP 切矩阵、单请求变快且单卡显存减半；DP 复制引擎、只加吞吐，注意力那部分单卡显存一点不省
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 再给你两颗 NPU，你会怎么用

[贯穿全库的例子](one-request.md)里，Qwen3.6-35B-A3B 跑在两颗 NPU 上：注意力部分对半切，256 个专家按编号分两堆。这套部署跑一条请求没问题。现在请求越来越多，排队的人越来越长，老板又给了你两颗 NPU。

最直接的用法是：**把整套引擎再起一份**，请求来了分给其中一份，两份同时各接各的请求。这就是数据并行（DP）。每一份叫一个 DP rank——rank 就是给每份进程排的号；这里特意带上「DP」前缀，因为下面还会碰到张量并行（TP）的 TP rank，两种号的粒度不一样，裸写一个「rank」会混。

这样做加的是**吞吐**：同一时间能接的请求多了一倍。它不会让任何一条请求变快——一条请求从头到尾只在一个副本里算。

但这个例子偏偏是个 MoE 模型（每层有很多个专家、每个 token 只用其中几个，见 [MoE](moe.md)），而「复制一份」这句话在 MoE 上只说对了一半。下面这张图就是这一页要讲清的事。

```wiki-diagram
file: data-parallel
```

## 多出来的两颗：注意力照抄一份，专家却摊开了

把份数设成 2、其余设定都不动，四颗 NPU 上的东西是这样分的：

| 这一页的东西 | DP=1（原来的例子） | DP=2 |
|---|---|---|
| 占几颗 NPU | 2 | 4：每个副本还是 2 颗 |
| 注意力部分 | 一套，对半切给 2 颗 | **每个副本各存一整套**，各自对半切；每颗 NPU 上的注意力和原来一模一样，每个 token 每层还是 1 KiB 的笔记 |
| 256 个专家 | 分给 2 颗，每颗 128 个 | **分给全部 4 颗，每颗 64 个**；专家权重每颗从约 30 GiB 降到约 15 GiB |
| 这条请求去哪 | 只有一个去处 | DP rank 0（两边都空着时，编号小的那个先被挑中） |
| 它那一个 2048 位置的块在哪 | 那两颗上 | 只在 DP rank 0 的块池里，DP rank 1 一块都没分出去 |
| 这 200 步里 DP rank 1 在干什么 | —— | **每一步都陪着跑一遍**，只喂 1 个假 token |

前三行说的是：注意力被复制了，专家没有被复制。原因在专家的分法上——打开专家并行（EP，把专家按编号分给不同 NPU）时，参与分专家的 NPU 不只是一个副本里的 2 颗，而是**所有副本的 NPU 加起来**。所以对 MoE 模型来说，DP 翻倍会让每颗 NPU 分到的专家减半，而注意力那部分的单卡占用一点不省。

最后一行是这一页最该记住的事，下一节讲为什么。

## 请求只进一个副本，另一个也得陪着走每一步

DP rank 1 手里一条请求都没有，为什么不能歇着？因为 DP rank 0 那条请求的每个 token，走到每一层的专家那里时，要挑 8 个专家来算——而 256 个专家里有一半放在 DP rank 1 的两颗 NPU 上。token 得被**发过去**，在那边算完再**收回来**。如果 DP rank 1 停着不动，这些 token 就没人接，DP rank 0 也卡在原地。

这种「好几颗 NPU 必须同时参加、缺一个就谁都走不了」的通信，叫集合通信。DP 在 MoE 上每一步要做两类：

**第一类：每步开头先对个账。** 各副本这一步要算的 token 数不一样——DP rank 0 这一步可能有 12 个，DP rank 1 只有 3 个，甚至 0 个。专家层要所有人一起收发，所以得先知道全场最多是多少。办法是做一次 all-reduce：每颗 NPU 把自己那个数发出去，最后每颗都拿到汇总的结果（这里汇总成「最大值」）。于是大家都知道「这一步全场最多 12 个」，少的补空位补到 12。

**第二类：专家层里真的搬 token。** 在这个例子的硬件上（A3、打开专家并行），token 是按「选中的专家在哪颗上就发去哪颗」送过去、再收回来的，细节在[专家并行](expert-parallel.md)。如果**没开**专家并行，走的是另一条更粗的路：

- 进专家层之前做一次 all-gather：每颗 NPU 把自己那份 token 发给所有 NPU，最后每颗手里都有全场的 token。
- 算完之后做一次 reduce-scatter：先把各颗算出来的结果加总，再切开，每颗只留下属于自己那段 token 的结果。

两类通信有一个共同点：**少一个参与者不是变慢，是挂死。** 所以一个副本这一步没活干，也必须喂 1 个假 token 走一遍完整的前向，好让自己按时出现在每一次集合通信里。

补空位是有代价的。拿上面那组数说：DP rank 0 有 12 个 token、DP rank 1 只有 3 个，对齐之后 DP rank 1 也按 12 个算，其中 9 个位置是纯浪费，占它这一步的 75%。所以各副本的忙闲越不均，浪费越大——这正是 [Balance Scheduling](balance-scheduling.md) 要把各副本在跑的请求数拉平的原因。

还有一处「陪跑」比较隐蔽：副本们要一起决定「这一波请求是不是全跑完了、可以一起停下」，这个判断也是一次 all-reduce，但为了省通信，**每 32 步才真做一次**。于是全场都空了之后，各副本最多还会再空转 31 步才一起停。

## 模型不是 MoE 时，两个副本真的各算各的

换成一个没有专家的普通模型（dense 模型），上面那些绳子全都没有。一条请求的每一步只跟它自己的 token 有关，副本之间没有任何一步需要对方的数。vLLM 在这里走了一条明确的分叉：dense 模型的每个副本，启动时就被改回「份数 = 1」的普通引擎——不建副本之间的通信组，不对账，也不陪跑。所以 dense 的「DP=2」本质上是两个互不认识的单份引擎，只是共用一个前端在分请求。

所以说到 DP 时要多问一句模型是什么：**MoE 下各副本仍要一起做集合通信，不是完全独立**；只有 dense 才是真正的各算各的。

## 请求落到哪个副本：一条算术，外加最多 100 毫秒的延迟

分请求的是前端（接 HTTP 请求的那个进程），默认它自己挑。挑法只有一条算术：给每个副本算一个分数 = 排队的请求数 × 4 + 正在跑的请求数，挑分数最小的。排队的权重是 4，意思是「还没开始算的请求比正在跑的更值得躲开」。两个副本都空着时分数都是 0，编号小的那个先被挑中——这就是例子里的请求落到 DP rank 0 的原因。

这个分数不是实时的。各副本把自己的队列长度报给一个协调进程，协调进程**最快每 100 毫秒**向前端广播一次。两次广播之间，前端每挑中一个副本就在本地给它记上一笔，免得一批请求一口气全塞给同一个。

请求一旦进了某个副本，就不会再被搬走。「开了 DP，请求会在副本之间自动匀」只在挑的那一瞬间成立。

前端也可以不自己挑：交给你自己的负载均衡器，或者节点内 vLLM 挑、节点之间你来挑。三种模式的开法在下半。

## 什么时候用 DP，而不是 TP

TP 是把每层的大矩阵切开分给几颗 NPU，每层要对一次答案；流水线并行（PP）是把 40 层分段交给不同的 NPU。同样把卡加一倍，三者的账摆在一起：

| 同样把卡加一倍 | 单卡注意力权重 | 单卡 KV 笔记 | 单请求延迟 | 副本之间每层通信 |
|---|---|---|---|---|
| TP 翻倍 | 减半 | 减半 | 变好 | 每层多两次 all-reduce |
| PP 翻倍 | 减半 | 减半 | 变差 | 每段交接一次 |
| DP 翻倍 | **不变** | **不变** | **不变** | dense 没有；MoE 每步对账 + 专家层收发 |

（MoE 打开专家并行时，DP 翻倍会让单卡的**专家**权重减半，见上面第一张表；注意力那部分仍是上表的「不变」。）

所以 DP 解决的就是开头那个问题：**模型已经装得下，但请求排不过来。** 装不下要靠 [TP](tensor-parallel.md) 或 [PP](pipeline-parallel.md)。dense 模型想加吞吐，官方的建议甚至是干脆起几个独立实例，别开 DP。

## 常见误解

- **「DP 把模型切成 N 份」**——引擎是整套复制的。唯一被「切」的是 MoE 打开专家并行时的专家：它们摊在所有副本的 NPU 上。
- **「DP 能省显存」**——注意力和 KV 一点不省：每个副本各存一套、各管一个块池，总量乘 N。MoE 的专家部分会摊薄，但那是专家并行的效果，不是「复制」的效果。
- **「开了 DP，请求会在副本之间自动匀」**——不会。挑副本只在请求进门那一瞬间，用的还是最多 100 毫秒前的队列快照。
- **「dense 开 DP 和 MoE 开 DP 是一回事」**——不是。dense 的副本之间没有任何通信、开销为零；MoE 的副本每一步都拴在一起，空着也得跑一次 1 个 token 的假前向，还要把 token 补齐到全场最大值。

## 对照源码

这一节给要去核对源码、查配置、排查问题的人。上半每个说法的依据都在这里。

### 怎么开

例子对应的启动命令，只在[那条请求](one-request.md)的命令上加一行：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --data-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching
```

- 占几颗 NPU：`world_size_across_dp` 就是 `world_size × data_parallel_size` [C8]，这里 `2 × 2 = 4`。
- 专家怎么分：上游 `FusedMoEParallelConfig.make` 的 docstring 正好写了 TP=2、DP=2、EP=True 这一格——四个设备 `EP = {4, 0..3}`、"There are 2 engine instances and the experts are split between the 4 devices"；`use_ep` 的条件是 `dp_size_ * pcp_size_ * tp_size_ > 1 and enable_expert_parallel` [C39]；`data_parallel_size` 字段自己的说明也写着 "MoE layers will be sharded according to the product of the tensor parallel size and data parallel size" [C6]。EP 进程组按 `data_parallel_size × prefill_context_model_parallel_size × tensor_model_parallel_size` 切，且只对 MoE 模型建 [C40]。于是每颗 `256 / 4 = 64` 个专家；专家权重按 [one-request](one-request.md) 的 bf16 上限约 60 GiB 算，每颗约 `60 / 4 = 15` GiB [D]。
- 注意力侧不变：TP 组仍按每个副本 2 颗建，每颗 KV 头数 `max(1, 2 // 2) = 1`、每 token 每层 1 KiB，与 one-request 同一套算式；块大小只看 TP，仍是 2048 [D]。
- MoE 判断：engine core 子进程起来时 `if data_parallel and vllm_config.model_config.is_moe` 才建 `DPEngineCoreProc`，否则把 `data_parallel_size` / `_size_local` / `_rank` 改回 1 / 1 / 0，建普通 `EngineCoreProc`，源码注释是 "Non-MoE DP ranks are completely independent, so treat like DP=1"；真实编号仍保留在 `data_parallel_index` 里 [C1]。`DPEngineCoreProc.__init__` 第一句就是 `assert vllm_config.model_config.is_moe` [C2]，它的 `_init_data_parallel` 建无状态 DP 进程组 [C3]。
- 这一改会漏到昇腾侧：`NPUModelRunner.dp_size` 直接取 `parallel_config.data_parallel_size` [C19]，dense DP 上每步的元数据同步在第一句 `if self.dp_size == 1: return` 就返回 [C17]；昇腾 `get_global_rank` 靠不会被重置的 `data_parallel_index` 找回真实 rank 号 [C23]。
- 例子这条请求在 DP=1 时前端建的是普通 `AsyncMPClient` 而不是带负载均衡的那个 [C9]。

前端三种负载均衡模式（`data_parallel_size > 1` 时）[C7][C14]：

| 模式 | 前端长什么样 | 谁挑 DP rank |
|---|---|---|
| 内置 LB（默认） | 一个 `DPLBAsyncMPClient` 连着全部 rank | 它自己，按分数挑 |
| 外置 LB（显式给 `--data-parallel-rank`） | 每个 rank 一个客户端 | 你自己的 LB；客户端直接把请求交给本地那一个 [C11] |
| 混合 LB（`--data-parallel-hybrid-lb`） | 每节点一个前端 | 节点内 vLLM 挑，节点之间你的 LB 挑 |

- 挑法：`get_core_engine_for_request` 里 `score = waiting * 4 + running`，严格小于才替换，从 `eng_start_index` 开始轮 [C10]；单前端、两边都为 0 时选中下标 0 [D]。选中后 `current_counts[eng_index][0] += self.client_count` 本地记账，注释写明是为了填补 coordinator 两次更新之间的空档（"which happen every 100ms"）。
- `DPCoordinator` 收各 rank 的 waiting/running 并广播给全部前端，同时管 wave 编号 [C12]；`DPCoordinatorProc` 的 `min_stats_update_interval_ms` 默认 100 [C13]。dense 也有 coordinator，但 wave 协调那套跟着 `model_config.is_moe` 开关，dense 上关着 [C15]。
- 外置 LB 模式官方明写只支持 MoE，dense 请直接起多个独立实例、别带 `--data-parallel-*`。
- `--data-parallel-size-local` 的 CLI help 写的是 number of data parallel **replicas** [C16]。

跨机照官方 DeepSeek-R1 两机教程的 node 0 [S31]：

```bash
vllm serve vllm-ascend/DeepSeek-R1-W8A8 \
  --data-parallel-size 4 \
  --data-parallel-size-local 2 \
  --data-parallel-address $local_ip \
  --data-parallel-rpc-port 13389 \
  --tensor-parallel-size 4 \
  --enable-expert-parallel \
  --max-num-seqs 16
```

node 1 上同一条命令再加 `--data-parallel-start-rank 2 --headless`，`--data-parallel-address` 换成 node 0 的 IP。`--data-parallel-size` 是全场 rank 总数，`-size-local` 是本机起几个（两机各 2），`--data-parallel-address` 与 `-rpc-port` 必须两机一致，`--headless` 只加在非主节点上。4 × 4 = 16 张卡；官方对单机的建议是 `dp4 tp4` 而不是 `dp2 tp8` [S30]。

昇腾支持矩阵里 Data Parallel 标 🟢 Functional，备注「Data Parallel support for Qwen3 MoE」[S28]（<https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/support_matrix/supported_features.html>）。

### 会报什么错

- **DP 和 PCP 同开**：v0.23 上有专门一条检查，两个都 > 1 就 `ValueError`，报错点名说是这两者撞了 [C24]；v0.26 / main 改成 model runner v1 上 `pcp > 1` 一律 `ValueError`，报错不再提 DP [C35][C38]。支持矩阵的脚注写着「只有 dcp 支持 dp，pcp 不支持」[S29]。
- **照抄大规模 EP 文档的环境变量不生效**：那份文档的启动脚本里多一行 `export VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` [S32]，但这个名字在三个昇腾快照的 `vllm_ascend/` 和两个上游快照里都找不到，照抄只是设了个没人读的环境变量 `[!]`。
- **挂死而不是报错**：MoE 下任何一个 DP rank 不进某次集合通信，其余 rank 会一直等在那里。正常路径上忙循环会补一次 `execute_dummy_batch()` 保证不缺席 [C4]；自己改调度或忙循环时别破坏这一点。

### 开销和什么时候别开

- **陪跑的假前向**：`DPEngineCoreProc.run_busy_loop` 里，这一步没调度出东西但全场仍在一个 wave 里，就调 `execute_dummy_batch()`；落到昇腾侧是 `_dummy_run(num_tokens=self.model_runner.decode_token_per_req, uniform_decode=True)` 的真前向 [C25][C26]，没开投机解码时那个数是 1。
- **每步对账**：昇腾 `_sync_metadata_across_dp` 把 `(num_tokens, cudagraph_mode)` 打成 `2 × dp_size` 的表 all-reduce 一次，取出 `max_tokens_across_dp` [C18]。
- **不开 EP 时的 AG / RS**：`PrepareAndFinalizeWithAllGather` 的 docstring 把顺序写成 `Attn → TP AR → DP AG → MoE → DP RS → TP AR` [C20]；`_prepare_with_dp_group` 把本地 token 补到最大值再 `all_gather`，`_finalize_with_dp_group` 用 `reduce_scatter` 切回本地长度 [C21][C22]。12 对 3 的浪费：`(12 − 3) / 12 = 75%` [D]。
- **例子这套配置走哪条**：v0.23 上 `select_moe_comm_method` 在没开 EP 或 EP 组只有 1 颗时选 `ALLGATHER`；A3 开 EP 时进 `_select_a3_moe_comm_method`，token 数在 MC2 容量内选 `MC2`（或 `FUSED_MC2`），否则 `ALLTOALL` 或 `FUSED_MC2` [C41][C42]。所以例子的专家层是 dispatch / combine，不是上面那对 AG / RS；两者都要求全部 DP rank 同步到场。v0.26 / main 上这段选择逻辑本页未逐行核。
- **wave 结束判断每 32 步一次**：`_has_global_unfinished_reqs` 里 `step_counter % 32 != 0` 直接返回 `True` [C5]，所以全场都空了之后各 rank 最多再空转 31 步 [D]。
- **什么时候别开**：dense 模型开 DP 没有通信开销，但官方推荐直接起多个独立实例；模型装不下时 DP 帮不上，要靠 TP / PP；各 rank 在跑条数长期不均时，补齐浪费会很可观，看 [Balance Scheduling](balance-scheduling.md)（它把自己那次 gather 挂在忙循环上而不是 `schedule()` 里，因为空跑的 rank 压根不进 `schedule()`）。

### 版本差异

DP 的主干——进程形状、dense/MoE 分叉、打分路由、每 32 步一次的 wave 同步、MoE 的 AG/RS——在三个快照上一致；dense/MoE 那段分叉在两个上游快照上一字不差[C34]。叉都分在昇腾那一侧：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| DP 和 PCP 同开 | 专门一条检查：两个都 > 1 就 `ValueError`，报错点名说是这两者撞了 | 这条没了，改成 model runner v1 上 `pcp > 1` 一律 `ValueError` | 同 v0.26 | 两边都起不来，但新版的报错不再提 DP；支持矩阵的脚注仍写着「只有 dcp 支持 dp，pcp 不支持」[S29] |
| 每步那次 DP all-reduce 走哪条组 | 可配：`dp_allreduce_on_npu: true` 改走 NPU device group，注释写明「某些设备上 CPU 侧 all_reduce 会返回脏数据」，默认 `false` | 键已移除，写死 `cpu_group` | 同 v0.26 | `[!]` 靠这个键绕开脏数据的部署升到 v0.26 会**静默失效**：`additional_config` 里多余的键不报错，服务照起，走的却是 CPU 组。release note 记了这次移除 [S37] |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| dense / MoE 分叉、`DPEngineCoreProc`、忙循环与 32 步同步 | `vllm/v1/engine/core.py` |
| 挑 DP rank 的打分 | `vllm/v1/engine/core_client.py`，`get_core_engine_for_request` |
| 队列统计广播与 wave 协调 | `vllm/v1/engine/coordinator.py` |
| DP / LB 相关配置与 CLI | `vllm/config/parallel.py`、`vllm/config/vllm.py`、`vllm/engine/arg_utils.py` |
| 专家怎么跨 DP 摊开、EP 组怎么建 | `vllm/model_executor/layers/fused_moe/config.py`，`FusedMoEParallelConfig.make`；`vllm/distributed/parallel_state.py` |
| 昇腾每步 DP 元数据同步、假前向 | `vllm_ascend/worker/model_runner_v1.py`，`_sync_metadata_across_dp`、`_dummy_run`；`vllm_ascend/worker/worker.py` |
| MoE 通信方式选择 | `vllm_ascend/ascend_forward_context.py`，`select_moe_comm_method` |
| DP 维度的 AG / RS | `vllm_ascend/ops/fused_moe/prepare_finalize.py` |
| DP 与 PCP 冲突检查 | `vllm_ascend/platform.py` |
