---
id: pipeline-parallel
title: "流水线并行：按层切开，界线上一步只传一次"
type: feature
summary: 把模型的层一刀切成前后几段，每段放一组 NPU，像接力一样一段算完交给下一段。段与段之间一步只传一次中间结果，通信又少又稀；代价是一步之内各段轮流干活，要同时有好几批请求在路上才能让每一段都不闲着。
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
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L391-L435
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L472-L480
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L755-L810
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/pipeline_parallel.md#L159-L181
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/pipeline_parallel.md#L186-L217
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/pipeline_parallel.md#L311-L334
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/pipeline_parallel.md#L336-L350
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/pipeline_parallel.md#L363-L374
  - vllm@568afb3a:vllm/distributed/parallel_state.py#L1787-L1801
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L423-L429
  - vllm@0fc695fc:vllm/model_executor/models/chatglm.py#L293-L295
  - vllm@0fc695fc:vllm/model_executor/models/gpt2.py#L212-L214
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L236-L241
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L433-L438
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_vl.py#L1602-L1612
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: 同样两颗 NPU 拆同一个模型：TP 在每层里切矩阵、每层都要对答案，PP 按层切段、一步只传一次
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
updated: "2026-09-25"
origin: seed
---

## 两颗 NPU，换一种分法

[那条请求](one-request.md)用两颗 NPU 跑 Qwen3.6-35B-A3B，用的是张量并行（TP）：40 层里的每一层都把大矩阵对半切，两颗 NPU 各算一半。代价是每算完一层都得停下来对一次答案——这个动作叫 **all-reduce**：每颗 NPU 把自己那份结果发出去，最后各自拿到加总后的完整结果。40 层下来，一步要对几十次答案。

那换个问法：**如果层里的矩阵一刀都不切，而是把 40 层切成前 20 层、后 20 层，各放一颗 NPU，会怎么样？**

这就是流水线并行（PP）。第 1 颗 NPU 算完前 20 层，把手里的中间结果交给第 2 颗，第 2 颗接着算后 20 层，最后吐出下一个 token。像接力跑：棒子一步只交一次。

先说清楚：官方给这个模型的部署示例没有用 PP，这一页拿同样的两颗 NPU、把 TP=2 换成 PP=2，是**为了讲清楚机制而做的示意**，模型、问题（37 个 token）、回答（200 个 token）都不变。

```wiki-diagram
file: pipeline-parallel
```

## 切成两段之后，每颗 NPU 手里剩什么

40 能被 2 整除，所以切出来正好 20 + 20。这个模型每 4 层里有 1 层是全注意力（只有它要为每个 token 留 [KV Cache](kv-cache.md) 这份「笔记」），恰好前后两段各分到 5 层全注意力、15 层[线性注意力](linear-attention.md)。

每颗 NPU 只建自己那 20 层，另外 20 层的位置上放一个什么都不做的占位——占位不读权重、不分笔记空间，只为了让层的编号和不切时一模一样。于是：

- **权重**：每颗只装自己那 20 层的权重，大约是整个模型的一半。
- **笔记**：每颗只为自己那 5 层全注意力留笔记。PP 不切头，每层 2 个 KV 头都在，一个 token 一层 2 KiB，5 层就是每个 token 10 KiB。
- **首尾不对称**：把 token 变成向量的词表只在第 1 段，最后的归一化、输出头、挑下一个 token 这几步只在最后一段。

有意思的是第二条：TP=2 时每颗 NPU 每个 token 的笔记也是 10 KiB——TP 是把每层的头对半分（层数不变、每层减半），PP 是把层对半分（每层不变、层数减半），殊途同归。

层数相等不等于活一样多：最后一段比别的段多背了输出头和挑 token 的活，用了投机解码的话，那个草稿模型也整个压在最后一段。所以层数除不尽的时候，多出来的那几层会优先塞给前面的段，不给最后一段；觉得不合适还可以手动指定每段几层。

## 界线上一步传什么、传多少

段与段之间要传的只有一样东西：前一段最后一层算完的中间结果。准确说是两份——每个 token 当前的 [hidden](layers-and-hidden.md)（2048 个数），和一路加过来的[残差](mlp-residual-norm.md)那一份（也是 2048 个数）。残差也得传，不然下一段第一层开头的归一化接不上。

两份各 2048 个 bf16 数，每个 token 就是 2 × 2048 × 2 字节 = 8 KiB。拿那条请求算账：

| | 官方设定：TP=2 | 示意：PP=2 |
|---|---|---|
| 每颗 NPU 建几层 | 40 层，每层半张矩阵 | 20 层，每层整张矩阵 |
| 每颗留笔记的层 | 10 层，每层 1 个 KV 头 | 5 层，每层 2 个 KV 头 |
| 每颗每 token 的笔记 | 10 KiB | 10 KiB |
| 一步两颗之间通信几次 | 每层都要 all-reduce，几十次 | 1 次，单向传给下一段 |
| 回答的每一步（1 个 token）传多少 | — | 8 KiB |
| 第一步（37 个 token）传多少 | — | 37 × 8 KiB = 296 KiB |
| 整条请求一共传多少 | — | 296 KiB + 199 × 8 KiB ≈ 1.8 MiB |

这就是 PP 的卖点：通信又少又稀。它赢在不用一层一层地对答案，不在单层算得更快。所以官方推荐的多机搭法是：**机器内部用 TP**（机内连线快，经得起频繁对答案），**机器之间用 PP**（机间连线慢，一步只过一次正好）。

传的动作本身也被藏起来了：前一段发出去就不管了，留到下一步开始时才确认发完；后一段收的时候也是先挂上号，等真要用那份数据时才停下来等。

如果每段里面还套了 TP（比如每段两颗 NPU），还有一处省流量的做法：每颗只把自己那一小片发给下一段对应的那颗，下一段再在组内做一次 **all-gather** 拼回整块——all-gather 就是每颗 NPU 把自己那份发给组里所有 NPU，最后大家都有全部。

## 气泡：一步之内，两段是轮流干活的

这是从 TP 换到 PP 最容易想歪的地方。一步之内，第 2 段必须等第 1 段算完才能开工；第 2 段在算的时候，第 1 段手上这一步已经没活了。只有一条请求时，下一步又得等这一步吐出 token 才能开始——于是**任何时刻都只有一颗 NPU 在忙，另一颗在空等**。这段空等就叫流水线的**气泡**。

```wiki-diagram
file: pipeline-parallel-bubble
```

填气泡的办法不是把一步拆成更小的几份，而是**让好几批请求同时在路上**：第 2 段在算 A 批这一步的后 20 层时，第 1 段已经在算 B 批的前 20 层了。PP 切成几段，就要同时压住几批，两段都忙起来才不浪费。

由此有两个很实际的结论：

- **一条请求填不满流水线。** 并发低、每步只吐一个 token 的场景下，PP 多出了一段串行等待再加一次跨卡传输，通常比机器内部的 TP 更慢。
- **气泡由最慢那一段决定。** 各段每次耗时不一样，快的就得等慢的。长输入的第一步尤其明显，为此专门有一个[按耗时切块](../params/profiling-chunk-config.md)的开关，只在开了 PP 时才生效。

## 常见误解

- **「PP 和 TP 一样，加卡既省显存又省时间」**——PP 省下的只有权重和笔记（每段只存自己那些层）；时间上反而多出一段串行等待和一次跨卡传输，低并发时通常比机内 TP 慢。
- **「一步会被切成好几小份来填流水线」**——vLLM 里没有这一层。填流水线靠的是同时压住好几批请求。
- **「所有模型都能开 PP」**——模型得专门支持按段切开才行，不支持的一开 PP 启动就失败，跟头数、显存都无关。Qwen3.6 这一系支持。
- **「PP 组里的第一个就是全体的 0 号」**——不是。每段内部如果还套着 TP，PP 组里相邻两颗的全局编号会隔开一整个 TP 组，「第一段」说的是组内第一个。

## 对照源码

### 怎么开

- 启动加 `--pipeline-parallel-size 2`。门槛是模型类实现了 `SupportsPP`：`pipeline_parallel_size > 1` 而模型没实现，配置期直接 `NotImplementedError`，和头数、显存都无关 [C13]。Qwen3.6 用到的模型类——纯文本的 `Qwen3_5ForCausalLMBase` 和多模态外壳继承的 `Qwen3VLForConditionalGeneration`——类定义上都声明了 `SupportsPP` [C43][C45]。
- **rank 网格。** 上游把全部 rank reshape 成五维 `(ExternalDP, DP, PP, PCP, TP)`，PP 是从外往里数的第三维 [C1]。v0.23 上紧挨着的那行注释只写了四维 `ExternalDP x DP x PP x TP`，PCP 是后来插进 PP 和 TP 中间的，注释没跟着改 `[!]`；v0.26 起注释已补成五维，reshape 本身一字未动 [C38]——昇腾自己的 `init_ascend_model_parallel` 抄的是同一套五维 reshape，头上那行注释却写 `ExternalDP * EP`，更对不上 [C26]。看维度请看 reshape，别看注释。
- PP 组是 `all_ranks.transpose(2, 4).reshape(-1, pp_size)` 取出来的 [C2]，所以同一 PP 组里相邻两个 rank 的全局编号差 `pcp_size × tp_size`：TP=8、PP=2 时组是 `[0, 8]`、`[1, 9]` …，TP 组永远连号。`is_first_rank` 就是 `self.rank == self.ranks[0]`，组内第一个而非全局 rank 0 [C3]。
- **分层。** `get_pp_indices` 平均分，余数从**倒数第二段**起往前加，不给最后一段 [C6]；61 层切 PP4 因此是 `[15, 15, 16, 15]`，官方文档给的也是这个数 [S33]。手动调写 `VLLM_PP_LAYER_PARTITION="15,13"` 这种格式 [S34]。Qwen3.6 的 `num_hidden_layers` 是 40 [S44]，PP=2 没有余数，切成 `[0, 20)` 与 `[20, 40)` [D]。
- **占位层。** `make_layers` 拿到 `[start_layer, end_layer)` 后拼一个**长度仍是总层数**的 `ModuleList`，本段之外填 `PPMissingLayer()`——`torch.nn.Identity` 的子类，forward 把第一个参数原样退回，下标因此和不切时一致 [C7]。`is_pp_missing_parameter` 按名字前缀命中就跳过加载 [C8]。`Attention` 在 `__init__` 时把自己登记进 `static_forward_context`，`get_kv_cache_spec` 遍历的正是这张表 [C18][C15]；没建的层不在表里，每段只为自己那几层报价 [D]。
- **首尾不对称。** `embed_tokens` 只在第一段建，`norm` 只在最后一段建，其余位置是 `PPMissingLayer` [C9]；`lm_head` 同理 [C11]，`tie_word_embeddings` 为真时最后一段的 `lm_head` 复用它自己那份 `embed_tokens`。Qwen3.6 的 `tie_word_embeddings` 是 false [S44]，首尾各自一份词表大小的矩阵。
- **示意数字的推导 [D]。** 全注意力层下标是 3、7、…、39 [S44]，`[0, 20)` 与 `[20, 40)` 各含 5 个。PP 不动 KV 头，每层 `2（K 与 V）× 2（KV 头）× 256（head_dim）× 2 B = 2 KiB`，5 层 10 KiB/token/NPU；和 [那条请求](one-request.md)在 TP=2 下的 10 KiB 相等。
- **中间张量。** `IntermediateTensors` 是一个 `dict[str, Tensor]` 的壳 [C12]。往里放几条由各模型族自己登记：Qwen2/Qwen3 这条线是 `hidden_states` 和 `residual`，形状都是 `(num_tokens, hidden_size)`[C10]；Qwen3.6 的 `Qwen3_5Model` 登记的也是这两条 [C42]；ChatGLM、GPT-2 这类老架构只放 `hidden_states` 一条 [C40][C41]。非首段 forward 第一句就是 `assert intermediate_tensors is not None`。每 token `2 × 2048 × 2 B = 8 KiB`，decode 一步 8 KiB、37 token 的 prefill 296 KiB、整条请求 `296 + 199 × 8 = 1888 KiB ≈ 1.8 MiB` [D]。
- **收发。** 昇腾侧 `NPUModelRunner.execute_model` 末尾分岔：非末段 `return hidden_states`（此时是 `IntermediateTensors`），不算 logits、不采样、不产出 `ModelRunnerOutput`；末段才 `compute_logits` [C22]。真正发包在外一层 `NPUWorker.execute_model`：进门先 `wait()` 掉上一步没发完的 handle，再对非首段 `irecv_tensor_dict()`，包成 `AsyncIntermediateTensors`——它劫持 `.tensors` 的属性访问，谁第一个碰谁负责等 [C19][C20]；出门对非末段 `isend_tensor_dict()`，handle 存进 `self._pp_send_work` 就走，留到下一步进门再等 [C21]。`isend_tensor_dict` 开头 `if self.world_size <= 1: return []`，PP=1 时收发都短路 [C4]。
- **TP>1 时的切片发送。** 传了 `all_gather_group=get_tp_group()` 之后，每个 TP rank 只 P2P 发自己那 1/tp 片，接收侧在 TP 组内 all-gather 拼回整块 [C5]。开了序列并行就得把这个参数置空，否则和 flashcomm1 自己的 all-gather 撞车。

### 会报什么错

- 模型类没实现 `SupportsPP` 而 `pipeline_parallel_size > 1`：配置期 `NotImplementedError`。
- `VLLM_PP_LAYER_PARTITION` 条数不等于 PP size、或总和不等于层数：`ValueError`，启动失败[S34]。
- v0.23：开着 MTP 且 PP>1、节点又不是 `kv_role="kv_producer"`，`_validate_pd_pp_mtp_config` 配置期 `ValueError` [C27]。Qwen3.6 自带 `mtp_num_hidden_layers: 1` [S44]，在 v0.23 上想同时开 MTP 和 PP 要注意这条。
- main：稀疏注意力模型切点落在跳过 Top-K 的层上，`_validate_indexer_pp_config` 报 `ValueError`，写明不支持跨 PP 传 Top-K 索引 [C30]。

### 开销和什么时候别开

- **一步之内串行。** vLLM V1 没有「一步切成几个 micro-batch」：一次 `execute_model` 就是一段接一段顺过去。填流水线在 EngineCore：`max_concurrent_batches` 直接返回 `pipeline_parallel_size`，注释写 "PP requires PP-size concurrent batches to fill the pipeline" [C14]；这个数就是批队列长度，大于 1 才建队列 [C16]。`step_with_batch_queue` 先把队列填满再取结果：队列没满且还有请求可调度时，调完直接返回、不阻塞等上一步 [C17]。所以第 i 段上跑的是更早某一步的后半段。
- **低并发 decode 别开。** 队列里只有一条请求时任一时刻只有一段在忙；官方判断跨段与通信通常让延迟比机内 TP 更差 [S36]。PP 的优势官方叫 communication locality——通信又少又稀 [S35]。
- **末段更重。** 末段还背 norm、lm_head、logits 和采样；投机解码的 drafter 也整个压在它身上（`if get_pp_group().is_last_rank: self.drafter = ...`）[C25]。这是 `get_pp_indices` 余数不给末段的原因。
- **气泡由最慢一段决定。** `profiling_chunk_config` 量出耗时曲线、反解每步该切多少 token，让各段每块耗时拉平，硬门槛正是 `pipeline_parallel_size > 1`；它治的是「同样大的块越往后越慢」这一种气泡，见[动态切块配置](../params/profiling-chunk-config.md)。

### 版本差异

PP 的主干——分层函数、`PPMissingLayer`、两条张量、只在末段采样、异步 isend/irecv——三个分支一字不差：`worker.py` 里那段收发到 main 上只是行号从 620 挪到了 755 [C32]。叉都分在外围的校验和文档上。main 指 2026-09-21 的源码快照，v0.26 分支指 2026-09-17 的快照；完整提交号在来源里。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| PP + MTP | `_validate_pd_pp_mtp_config`：开着 MTP 且 PP>1，节点又不是 `kv_role="kv_producer"`，配置期直接 `ValueError` | `check_and_update_config` 的校验清单里已经没有这一条 | 同 v0.26，也没有这一条 | 在 v0.23 上想在 D 节点或混部环境同时开 MTP 和 PP，起都起不来；v0.26 起撤掉了这道闸，但撤闸不等于那条路已经验证过 `[!]` |
| 稀疏注意力模型的切点 | 没有这项检查 | 也没有这项检查 | 新增 `_validate_indexer_pp_config`：切点落在一个跳过 Top-K 的层上就 `ValueError`，并写明「不支持跨 PP 传 Top-K 索引」 | 层与层之间除了 hidden 还有别的依赖时，切点不能随便放 |
| 官方 PP 使用指南 | 没有这份文档 | 也没有这份文档 | `docs/source/user_guide/feature_guide/pipeline_parallel.md` 一整篇 [S37] | 在 v0.23 和 v0.26 上部署也只能去读 main 那篇（<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/pipeline_parallel.html>）。它讲的自动切分规则跟这两个分支配套上游的 `get_pp_indices` 对得上；但那份「不兼容清单」（PCP、Xlite 图模式、Sparse KV Offload、Mooncake 的 D 侧 PP=1）是照 main 写的，别直接搬 `[!]` |

### 源码位置

- rank 网格与 PP 组：`vllm/distributed/parallel_state.py`（五维 reshape、PP 组、`is_first_rank`、收发与切片发送）；昇腾侧 `vllm_ascend/distributed/parallel_state.py`。
- 分层：`vllm/distributed/utils.py` 的 `get_pp_indices`；`vllm/model_executor/models/utils.py` 的 `make_layers`、`PPMissingLayer`、`is_pp_missing_parameter`。
- 模型侧：`qwen2.py` / `qwen3.py`，Qwen3.6 的 `qwen3_5.py` 与 `qwen3_vl.py`。
- 引擎批队列：`vllm/config/vllm.py`、`vllm/v1/engine/core.py`。
- 昇腾 worker 收发：`vllm_ascend/worker/worker.py`（v0.23，main）；runner 末尾分岔与 drafter：`vllm_ascend/worker/model_runner_v1.py`。
- 校验：`vllm_ascend/platform.py`（v0.23、v0.26、main）。
