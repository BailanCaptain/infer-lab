---
id: data-parallel
title: "Data Parallel：复制整个引擎，一根权重都不切"
type: feature
summary: 同一份模型起多个副本，每个副本一套 EngineCore、调度器和 KV 块池；请求由前端挑一个 rank 送进去。它加吞吐，不减单请求延迟，也不省单卡显存。
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
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1492-L1499
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 那条请求的 data_parallel_size 就是 1，本页 DP=2 的账全是在它身上改一行参数算出来的
  - to: vllm-v1-shape
    kind: builds-on
    note: DP 复制的正是那一页讲的「一个 EngineCore 进程 + 它下面的 Worker」，一个 rank 一整套
  - to: tensor-parallel
    kind: alternative-to
    note: 同样是加一倍的卡，TP 切矩阵、单请求变快且单卡显存减半，DP 复制引擎、只加吞吐且单卡显存一点不省
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

DP 不动模型的任何一根权重：它把**整个引擎复制 N 份**，一份叫一个 DP rank，各有自己的 EngineCore 进程、自己的调度器、自己的 KV 块池。一条请求由前端挑一个 rank 送进去，之后从头到尾只在那个 rank 上跑完。**所以它加的是吞吐，不减单请求延迟，也不省单卡显存**——`world_size_across_dp` 就是 `world_size × data_parallel_size`，DP 翻倍就是卡翻倍 [C8]。

`--data-parallel-size` 三个版本上都在，启动写法也一致，正文以 v0.23 维护分支为准。真正的分叉不在版本上，在模型上：**DP rank 之间有没有绳子拴着，取决于模型是不是 MoE**——这条判断在两个上游快照上一字不差 [C1][C34]。

```wiki-diagram
file: data-parallel
```

## 那条请求：DP=2 时它只占一个 rank，另一个 rank 在发呆

[那条请求](one-request.md)是 dense、单卡，`data_parallel_size` 就是 1，整套 DP 代码一行都不进：前端建的是普通的 `AsyncMPClient` 而不是带负载均衡的那个，昇腾侧每步的 DP 同步第一句就是 `if self.dp_size == 1: return` [C17]。

要走到这一页，只改一行：启动加 `--data-parallel-size 2`。模型、37 个 token 的问题、200 个 token 的回答、TP=1 全不动。

| 这一页的东西 | DP=1（原设定） | DP=2 |
|---|---|---|
| 占几张卡 | 1 | 2 = `world_size × dp_size` |
| 权重存几份 | 1 份 | 2 份完整的 0.6B，单卡省下的显存是 **0** |
| 这条请求落到哪个 rank | 只有一个去处 | rank 0——两边都空着时分数都是 0，而比较是严格小于，下标小的胜出 [D] |
| 它那 2 个 KV 块在哪 | 那张卡上 | 只在 rank 0 的块池里，rank 1 一块都没分出去 |
| 这 200 步里 rank 1 在干什么 | —— | **什么都不干**，阻塞在自己的输入队列上 |

最后一行是这一页最该记住的事，而且它**只对 dense 成立**。把模型换成 MoE（比如 Qwen3-30B-A3B）、其余照旧，rank 1 就得陪着空跑：每一步调一次 `execute_dummy_batch()`，落到昇腾侧是一次 `_dummy_run(num_tokens=self.model_runner.decode_token_per_req, uniform_decode=True)` 的**真前向**，没开投机解码时那个数就是 1 [C26]。

## dense 的「DP=2」其实是两个 DP=1 的引擎

上游那段分叉写得毫不含糊。engine core 子进程起来时：

```python
if data_parallel and vllm_config.model_config.is_moe:
    # Set data parallel rank for this engine process.
    parallel_config.data_parallel_rank = dp_rank
    engine_core = DPEngineCoreProc(*args, **kwargs)
else:
    # Non-MoE DP ranks are completely independent, so treat like DP=1.
    # Note that parallel_config.data_parallel_index will still reflect
    # the original DP rank.
    parallel_config.data_parallel_size = 1
    parallel_config.data_parallel_size_local = 1
    parallel_config.data_parallel_rank = 0
    engine_core = EngineCoreProc(*args, engine_index=dp_rank, **kwargs)
```

`DPEngineCoreProc.__init__` 第一句就是 `assert vllm_config.model_config.is_moe` [C2]——**这个类根本不收 dense 模型**。dense 的每个 rank 拿到的是一个把 `data_parallel_size` 改回 1 的普通 `EngineCoreProc`：不建 DP 进程组、不做跨 rank all-reduce、也没有空跑那条分支。

这次改写会一路漏到昇腾侧。`NPUModelRunner` 的 `self.dp_size` 直接取 `parallel_config.data_parallel_size`，于是 dense DP 上每步的元数据同步在第一句就返回了。昇腾自己在 `get_global_rank` 的 docstring 里记了同一件事，并且靠上面那个不会被重置的 `data_parallel_index` 才找得回真实 rank 号。

为什么敢这么省：dense 模型一条请求的每一步只跟它自己的 token 有关，rank 之间没有任何一步需要对方的数。MoE + EP 不行——那一层的 token 要发给别的卡上的专家，见 [Expert Parallel](expert-parallel.md)。

## MoE 下没活干也得空跑，因为下一秒有人要跟它 all-gather

`DPEngineCoreProc.run_busy_loop` 的规矩是：这一步没调度出东西、但全场还在一个 wave 里，就必须 `execute_dummy_batch()` [C4]。原因在两层集合通信上：

- **引擎层**：`_has_global_unfinished_reqs` 走一次跨 rank all-reduce 决定 wave 结不结束。它有个优化——`step_counter % 32 != 0` 直接返回 `True`，**真正的同步每 32 步才做一次** [C5]。所以就算全场都空了，各 rank 还会再空转最多 31 步 [D]。
- **模型层**：昇腾的 `_sync_metadata_across_dp` 每步把 `(num_tokens, cudagraph_mode)` 打成一张 `2 × dp_size` 的表 all-reduce 一次，取出 `max_tokens_across_dp` [C18]；MoE 层进门 `_prepare_with_dp_group` 把本地 token 补齐到这个最大值再 `all_gather`，算完 `reduce_scatter` 切回本地长度 [C21]。源码注释把整条顺序写成了 `Attn → TP AR → DP AG → MoE → DP RS → TP AR`。

这两步都是集合通信：**少一个参与者不是变慢，是挂死。** 代到图上那组数——rank 0 这一步 12 个 token、rank 1 只有 3 个——all-gather 之前两边都被 pad 到 12，rank 1 有 9 个 token 位置是纯浪费的算力，占它这一步的 75% [D]。这正是 [Balance Scheduling](balance-scheduling.md) 要拉平各 rank 在跑条数的动机，也是它为什么把自己那次 gather 挂在忙循环上而不是 `schedule()` 里：空跑的 rank 压根不进 `schedule()`。

## 请求落到哪个 rank：一条算术，加一个 100 ms 的时间差

`data_parallel_size > 1` 时前端三选一：

| 模式 | 前端长什么样 | 谁挑 rank |
|---|---|---|
| 内置 LB（默认） | 一个 `DPLBAsyncMPClient` 连着全部 rank | 它自己，按分数挑 |
| 外置 LB（显式给 `--data-parallel-rank`） | 每个 rank 一个客户端 | 你自己的 LB；客户端直接把请求交给本地那一个 |
| 混合 LB（`--data-parallel-hybrid-lb`） | 每节点一个前端 | 节点内 vLLM 挑，节点之间你的 LB 挑 |

内置那条的算式只有一行：`score = waiting * 4 + running`，取最小 [C10]。`waiting` 的权重是 4，意思是「还没开始算的请求比正在跑的更值得躲开」。分数不是实时的：各 rank 把队列长度报给 `DPCoordinator`，它**最快每 100 ms** 向全部前端广播一次 [C13]；两次广播之间前端靠本地给选中的 rank 自加一笔记账，免得把一批请求一口气全塞给同一个 rank。

dense 也有 coordinator，但它只收发统计——wave 协调那套跟着 `model_config.is_moe` 开关，dense 上是关着的。外置 LB 模式官方明写只支持 MoE，dense 请直接起多个独立实例、别带 `--data-parallel-*` [C7]。

## 怎么起，以及什么时候该用 DP 而不是 TP

单机多 rank 只要一个参数，跨机要把五个对齐。照官方 DeepSeek-R1 两机教程的 node 0 [S31]：

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

node 1 上同一条命令再加 `--data-parallel-start-rank 2 --headless`，`--data-parallel-address` 换成 node 0 的 IP。每个值的来由：`--data-parallel-size` 是全场 rank 总数，`-size-local` 是本机起几个（两机各 2），`--data-parallel-address` 与 `-rpc-port` 必须两机一致，`--headless` 只加在非主节点上。4 × 4 = 16 张卡；官方对单机的建议是 `dp4 tp4` 而不是 `dp2 tp8`。那份大规模 EP 文档的启动脚本里还多一行 `export VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED=1` [S32]，但这个名字在三个昇腾快照的 `vllm_ascend/` 和两个上游快照里 `git grep` 都找不到，照抄只是设了个没人读的环境变量 `[!]`。

取舍摆在一起才看得清（对照 [Tensor Parallel](tensor-parallel.md)、[Pipeline Parallel](pipeline-parallel.md)）：

| 同样把卡加一倍 | 单卡权重 | 单卡 KV | 单请求延迟 | 每层跨卡通信 |
|---|---|---|---|---|
| TP=2 | 减半 | 减半 | 变好 | 两次 all-reduce |
| PP=2 | 减半 | 减半 | 变差 | 一次 hidden |
| DP=2 | **不变** | **不变** | **不变** | dense 0 次；MoE 进出各一次 |

所以 DP 只解决一个问题：**模型已经装得下，但请求排不过来。** 装不下得靠 TP / PP。昇腾官方给 DP 的定位也就一句——支持矩阵里 Data Parallel 标 🟢 Functional，备注写的是「Data Parallel support for Qwen3 MoE」[S28]（<https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/support_matrix/supported_features.html>）。

## 三个版本上的差别

DP 的主干——进程形状、dense/MoE 分叉、打分路由、每 32 步一次的 wave 同步、MoE 的 AG/RS——三个快照上一字不差。叉都分在昇腾那一侧的一条校验和一个被删掉的配置键上。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| DP 和 PCP 同开 | 专门一条检查：两个都 > 1 就 `ValueError`，报错点名说是这两者撞了 [C24] | 这条没了，改成 model runner v1 上 `pcp > 1` 一律 `ValueError` [C35] | 同 v0.26 [C38] | 两边都起不来，但新版的报错不再提 DP；支持矩阵的脚注仍写着「只有 dcp 支持 dp，pcp 不支持」[S29] |
| 每步那次 DP all-reduce 走哪条组 | 可配：`dp_allreduce_on_npu: true` 改走 NPU device group，注释写明「某些设备上 CPU 侧 all_reduce 会返回脏数据」，默认 `false` [C27] | 键已移除，写死 `cpu_group` [C36] | 同 v0.26 | `[!]` 靠这个键绕开脏数据的部署升到 v0.26 会**静默失效**：`additional_config` 里多余的键不报错，服务照起，走的却是 CPU 组。release note 记了这次移除 [S37] |

## 常见误解

- **「DP 把模型切成 N 份」**——一根权重都不切，是把整个引擎复制 N 份。官方教程那句 "the model is split across 4 DP ranks total" 的措辞会把人带偏 [S30]；同一份 CLI 里 `--data-parallel-size-local` 的 help 写的才准：number of data parallel **replicas** [C16]。
- **「DP 能省显存」**——反着的。每个 rank 各存一份完整权重、各管一套 KV 块池，单卡占用和 DP=1 时一模一样，总量乘 N。要摊薄单卡显存得用 TP 或 PP。
- **「开了 DP，请求会在 rank 之间自动匀」**——不会。挑 rank 只发生在前端 `add_request` 的那一瞬间，用的还是最多 100 ms 前的队列快照；进了某个 rank 的请求不会再被搬走，[Balance Scheduling](balance-scheduling.md) 做的也只是「全体停收」而不是搬运。
- **「dense 开 DP 和 MoE 开 DP 是一回事」**——不是。dense 的 rank 之间连 DP 进程组都不建，开销为零；MoE 的 rank 每一步都拴在一起，空着也得跑一次 1 token 的假前向，还要把 token 补齐到全场最大值。
