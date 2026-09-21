---
id: pipeline-parallel
title: "Pipeline Parallel：按层切开，界线上一步只过一份 hidden"
type: feature
summary: 按层把模型切成几段、一段一组卡；段与段之间只传 hidden_states 和 residual 两条张量，一步一次。代价是一步之内各段串行，要靠同时在途的多步才填得满。
aliases: [Pipeline Parallel, 流水线并行, 管线并行, PP, pipeline_parallel_size, PPMissingLayer, IntermediateTensors, get_pp_indices, make_layers, VLLM_PP_LAYER_PARTITION, PP stage, 流水线气泡]
chapters: ["13"]
order: 20
sources:
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1740-L1755
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1815-L1831
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L539-L561
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L964-L1019
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1059-L1143
  - vllm@0fc695fc:vllm/distributed/utils.py#L109-L154
  - vllm@0fc695fc:vllm/model_executor/models/utils.py#L619-L664
  - vllm@0fc695fc:vllm/model_executor/models/utils.py#L689-L713
  - vllm@0fc695fc:vllm/model_executor/models/qwen2.py#L355-L384
  - vllm@0fc695fc:vllm/model_executor/models/qwen2.py#L389-L426
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L294-L311
  - vllm@0fc695fc:vllm/sequence.py#L11-L18
  - vllm@0fc695fc:vllm/config/model.py#L1188-L1207
  - vllm@0fc695fc:vllm/config/vllm.py#L495-L506
  - vllm@0fc695fc:vllm/config/vllm.py#L2242-L2258
  - vllm@0fc695fc:vllm/v1/engine/core.py#L188-L198
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L499
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L395-L398
  - vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L85-L114
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L620-L642
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L647-L663
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2337-L2358
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3584-L3603
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4927
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L634-L646
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L30-L52
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L430-L447
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L467-L470
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L69-L74
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L389-L433
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L470-L478
  - vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L755-L810
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/pipeline_parallel.md#L159-L181
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/pipeline_parallel.md#L186-L217
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/pipeline_parallel.md#L311-L334
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/pipeline_parallel.md#L336-L350
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/pipeline_parallel.md#L363-L374
  - vllm@568afb3a:vllm/distributed/parallel_state.py#L1787-L1801
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L423-L429
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: 同样两张卡拆同一个模型：TP 在每层里切矩阵、一层归约两次，PP 按层切段、一步只过一次 hidden
  - to: vllm-engine-core
    kind: builds-on
    note: 流水线靠 EngineCore 的批队列同时压住 pp_size 步才填得满，那个 step_with_batch_queue 就在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 每段只为自己那几层报 spec，所以每卡每 token 的 KV 按本段层数打折，报价规则在那一页
  - to: request-call-chain
    kind: builds-on
    note: 跨段的 irecv / isend 就发生在 NPUWorker.execute_model 这一跳，整条链在那一页
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

PP 按**层**把模型切成几段，一段归一组卡，层里的矩阵一刀不切。于是卡间要过的东西只剩一样：**上一段最后一层算出来的 hidden**——准确说是 `hidden_states` 和 `residual` 两条张量，一步过一次，和模型有多少层、多少参数都无关。代价也摆在明面上：**一步之内各段是串行的**，前一段在算，后一段就空着。

```wiki-diagram
file: pipeline-parallel
```

## 那条请求用不到它

[那条请求](one-request.md)是单卡、PP=1。`isend_tensor_dict` 开头一句 `if self.world_size <= 1: return []`，收发两边都直接短路；`Qwen2Model.forward` 里 `is_first_rank` 和 `is_last_rank` 同时为真，28 层一条路走到底。

要走到这一页，只改一行硬件设定：一张卡换成两张，启动加 `--pipeline-parallel-size 2`（TP 仍然是 1）。模型、37 个 token 的问题、200 个 token 的回答全不动。28 能被 2 整除，`get_pp_indices` 没有余数要分，切出来正好 14 + 14 [C6]。

| 这一页的东西 | PP=1（原设定） | PP=2 |
|---|---|---|
| 本卡真建出来的层 | `[0, 28)` | rank 0 是 `[0, 14)`，rank 1 是 `[14, 28)` |
| 本卡的 `PPMissingLayer` 个数 | 0 | 各 14 个 |
| 每 token 每卡的 KV | 112 KiB | 56 KiB = 14 层 × 4 KiB |
| 一步跨卡过几次 | 0 | 1 次 |
| decode 一步过多少字节 | 0 | 2 × 1 × 1024 × 2 B = 4 KiB |
| 37 个 token 的 prefill 过多少 | 0 | 2 × 37 × 1024 × 2 B = 148 KiB |
| 整条请求一共过多少 | 0 | 148 KiB + 199 × 4 KiB ≈ 944 KiB |

右边几行都是拿 H=1024、bf16 和下面两节的规则算出来的，没有一个是从源码直接读到的常数 [D]。**跟 [TP](tensor-parallel.md) 并排看才看得出 PP 的卖点**：同样两张卡，TP=2 的 decode 一步要发 57 次 all-reduce、约 114 KiB；PP=2 只发 1 次、4 KiB。官方文档把这件事叫 communication locality——PP 赢在通信又少又稀，不在单层算得更快 [S35]。

## PP 是 rank 网格里的第三维，同组 rank 之间隔着一整个 TP 组

上游把全部 rank reshape 成五维 `(ExternalDP, DP, PP, PCP, TP)`，PP 是从外往里数的第三维 [C1]。**v0.23 上紧挨着的那行注释只写了四维 `ExternalDP x DP x PP x TP`，PCP 是后来插进 PP 和 TP 中间的，注释没跟着改** `[!]`；v0.26 起这行注释已经补成五维，reshape 本身一字未动 [C38]——昇腾自己那份 `init_ascend_model_parallel` 抄的是同一套五维 reshape，头上那行注释写的却是 `ExternalDP * EP`，更对不上 [C26]。看维度请看 reshape，别看注释。

PP 组是 `all_ranks.transpose(2, 4).reshape(-1, pp_size)` 取出来的 [C2]，所以**同一个 PP 组里相邻两个 rank 的全局编号差 `pcp_size × tp_size`**：TP=8、PP=2 时组是 `[0, 8]`、`[1, 9]` … 而 TP 组永远连号。这正是官方推荐的两机拓扑的由来——TP 关在机内走高频集合通信，PP 拉到机间，一步只过一次。

两个容易绊倒的点：

- **`is_first_rank` 说的是组内第一个，不是全局 rank 0。** 它就是 `self.rank == self.ranks[0]` [C3]。TP=8 PP=2 时，全局 rank 8 是 PP 组的第二段，却是它那个 TP 组的头一个。
- **PP 的门槛和 TP 不是一类东西。** TP 卡的是 `total_num_attention_heads % tensor_parallel_size != 0`；PP 卡的是模型类有没有实现 `SupportsPP`，没有就 `NotImplementedError`，和头数、显存都无关 [C13]。

## 每卡的 28 层里有 14 层是 `PPMissingLayer`，它连权重都不读

`make_layers` 拿 `get_pp_indices` 要到 `[start_layer, end_layer)`，然后拼一个**长度仍然是 28** 的 `ModuleList`：前面填 `PPMissingLayer()`，中间才真建层，后面再填 `PPMissingLayer()` [C7]。`PPMissingLayer` 是 `torch.nn.Identity` 的子类，forward 把第一个参数原样退回。下标因此和不切时完全一致——这是它不直接建一个 14 层列表的原因。

三件事跟着这一步走：

- **权重不加载。** `is_pp_missing_parameter` 按名字前缀命中就跳过，那一段的权重连读都不读。
- **KV 不分配。** `Attention` 在 `__init__` 时把自己登记进 `static_forward_context`，而 `get_kv_cache_spec` 遍历的正是这张表。层都没建，表里就没有它，这一段自然只为自己那 14 层报价 [D]——每卡每 token 的 KV 也就从 112 KiB 降到 56 KiB。
- **首尾两段不对称。** `embed_tokens` 只在第一段建，`norm` 只在最后一段建，其余位置一律是 `PPMissingLayer` [C9]；`lm_head` 也一样，而 `tie_word_embeddings` 为真时最后一段的 `lm_head` 直接复用它自己那份 `embed_tokens`。

所以**层数相等不等于负载相等**：最后一段还要背 norm、lm_head、logits 和采样，投机解码的 drafter 也整个压在它身上（`if get_pp_group().is_last_rank: self.drafter = ...`）[C25]。上游的自动切分对此有个专门的让步：`num_hidden_layers % pp_size` 的余数从**倒数第二段**开始往前加，不给最后一段——61 层切 PP4 因此是 `[15, 15, 16, 15]`，官方文档给的也是这个数 [S33]。要手动调就写 `VLLM_PP_LAYER_PARTITION="15,13"`：条数必须等于 PP size、总和必须等于层数，错一个启动就失败 [S34]。

## 中间只过两条张量；logits 和采样只在最后一段

`IntermediateTensors` 就是一个 `dict[str, Tensor]` 的壳，Qwen2/Qwen3 这条线往里放的键固定是 `hidden_states` 和 `residual`，形状都是 `(num_tokens, hidden_size)` [C8]。**是两条不是一条**——`residual` 也得过界，否则下一段第一层的 RMSNorm 接不上。非首段 forward 的第一句就是 `assert intermediate_tensors is not None`。

昇腾侧 `NPUModelRunner.execute_model` 走到末尾时分岔：不是最后一段就 `return hidden_states`（此时它是 `IntermediateTensors`），**不算 logits、不采样、不产出 `ModelRunnerOutput`**；是最后一段才 `compute_logits` [C22]。

真正发包的地方在更外面一层的 `NPUWorker.execute_model`，不在 runner 里：

- 进门先 `wait()` 掉上一步还没发完的 handle，再对非首段 `irecv_tensor_dict()`，把结果包成 `AsyncIntermediateTensors`。这个壳劫持了 `.tensors` 的属性访问，谁第一个碰它谁负责等通信 [C19]——**收是异步发起的，等被推迟到真要用的那一刻**。
- 出门对非末段 `isend_tensor_dict()`，handle 存进 `self._pp_send_work` 就走，留到下一步进门再等 [C21]——跨段发送因此是拿下一步的准备时间盖掉的。

还有一处只在 TP>1 时才看得见的优化：传了 `all_gather_group=get_tp_group()` 之后，每个 TP rank 只 P2P 发**自己那 1/tp 片**，接收侧再在 TP 组内 all-gather 拼回整块 [C5]。开了序列并行就得把这个参数置空，否则和 flashcomm1 自己的 all-gather 撞车。

## 一步之内各段是串的，填流水线靠的是同时在途的多步

这是从 TP 换到 PP 最容易想歪的地方。**vLLM V1 里没有「一步切成几个 micro-batch」这回事**：一次 `execute_model` 就是一段接一段顺过去，前一段算的时候后一段真的在等。

填满流水线的机关在 EngineCore 那一层。`max_concurrent_batches` 直接返回 `pipeline_parallel_size`，注释写得很直白："PP requires PP-size concurrent batches to fill the pipeline" [C14]；这个数就是批队列的长度，大于 1 才建队列。`step_with_batch_queue` 的规矩是**先把队列填满、再去取结果**：队列没满且还有请求可调度时，调完直接返回、不阻塞等上一步。换句话说，**第 i 段上跑的不是同一步的后半段，而是更早某一步的后半段**。

两个很实际的推论：

- **一条请求填不满流水线。** 队列里只有那条请求时，任一时刻只有一段在忙，另一段是纯气泡；官方对低并发 decode 的判断也是如此——跨段与通信通常让延迟比机内 TP 更差 [S36]。
- **气泡由最慢那一段决定。** 长序列 prefill 把这件事放大成了一个专门的开关：`profiling_chunk_config` 量出耗时曲线、反解每步该切多少 token，好让各段每块耗时拉平，硬门槛正是 `pipeline_parallel_size > 1`。它治的是「同样大的块越往后越慢」这一种气泡，细节在[动态切块配置](../params/profiling-chunk-config.md)。

## 三个分支在哪儿分的叉

PP 的主干——分层函数、`PPMissingLayer`、两条张量、只在末段采样、异步 isend/irecv——三个分支**一字不差**：`worker.py` 里那段收发到 main 上只是行号从 620 挪到了 755 [C32]。叉都分在外围的校验和文档上。下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.26 分支指 `2ed6cbba`，v0.23 维护分支指 `2c59ff10`。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| PP + MTP | `_validate_pd_pp_mtp_config`：开着 MTP 且 PP>1，节点又不是 `kv_role="kv_producer"`，配置期直接 `ValueError` [C27] | `check_and_update_config` 的校验清单里已经没有这一条 [C39] | 同 v0.26，也没有这一条 | 在 v0.23 上想在 D 节点或混部环境同时开 MTP 和 PP，起都起不来；v0.26 起撤掉了这道闸，但撤闸不等于那条路已经验证过 `[!]` |
| 稀疏注意力模型的切点 | 没有这项检查 | 也没有这项检查 | 新增 `_validate_indexer_pp_config`：切点落在一个跳过 Top-K 的层上就 `ValueError`，并写明「不支持跨 PP 传 Top-K 索引」[C30] | 提醒了一件通用的事——层与层之间除了 hidden 还有别的依赖时，切点不能随便放 |
| 官方 PP 使用指南 | 没有这份文档 | 也没有这份文档 | `docs/source/user_guide/feature_guide/pipeline_parallel.md` 一整篇 [S37] | 在 v0.23 和 v0.26 上部署也只能去读 main 那篇（<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/pipeline_parallel.html>）。它讲的自动切分规则跟这两个分支配套上游的 `get_pp_indices` 对得上；但那份「不兼容清单」（PCP、Xlite 图模式、Sparse KV Offload、Mooncake 的 D 侧 PP=1）是照 main 写的，别直接搬 `[!]` |

## 常见误解

- **「PP 和 TP 一样，加卡就摊薄单卡显存又摊薄延迟」**——PP 摊薄的只有权重和 KV（每段只存自己那些层），延迟反而多出一段串行加一次跨卡传输；官方对低并发 decode 的结论就是通常比机内 TP 更慢。
- **「`is_first_rank` 指的是全局 rank 0」**——它是 `self.rank == self.ranks[0]`，组内第一个。TP=8 PP=2 时全局 rank 8 是 PP 组的第二段，同时是自己 TP 组的头一个。
- **「一步里会切成多个 micro-batch 来填流水线」**——V1 没有这一层。填流水线靠的是 EngineCore 的批队列同时压住 `pipeline_parallel_size` 步。
- **「所有模型都能开 PP」**——模型类没实现 `SupportsPP` 而 `pipeline_parallel_size > 1` 时，配置期直接 `NotImplementedError`，和头数、显存都无关。
