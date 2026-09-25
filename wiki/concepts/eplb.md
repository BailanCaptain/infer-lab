---
id: eplb
title: "EPLB：把热门专家搬到闲着的 NPU 上，但不改路由"
type: feature
summary: 开了专家并行之后，哪颗 NPU 忙由用户的数据决定。EPLB 先数每个专家分到多少 token，再算出新的摆法，一层一层把专家挪过去，让几颗 NPU 差不多一样忙；每个 token 选哪几个专家不变。
aliases: [EPLB, Expert Parallelism Load Balancer, 专家并行负载均衡, 专家负载均衡, 冗余专家, dynamic_eplb, DYNAMIC_EPLB, EXPERT_MAP_RECORD, expert_map, log2phy, EplbUpdator, SwiftBalanceEplb, FlashLB]
chapters: ["14"]
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L831-L845
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L865-L894
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_utils.py#L46-L107
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_utils.py#L110-L136
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/eplb_updator.py#L79-L101
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/eplb_updator.py#L102-L155
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_worker.py#L337-L410
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/eplb_device_transfer_loader.py#L46-L95
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/core/policy/policy_factory.py#L12-L27
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L72-L124
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L148-L179
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L521-L539
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L249-L256
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L510-L534
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L95-L102
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L57-L68
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L47-L48
  - vllm-ascend@2c59ff10:vllm_ascend/worker/v2/model_runner.py#L72-L73
  - vllm-ascend@2c59ff10:tests/ut/eplb/core/a2/expert_map.json#L1-L17
  - vllm-ascend@2c59ff10:tests/ut/eplb/core/a2/test_eplb_utils.py#L79-L88
  - vllm-ascend@2c59ff10:tests/e2e/pull_request/two_card/test_qwen3_moe_eplb.py#L35-L77
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L31-L40
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L171-L203
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L205-L220
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/expert_parallelism_load_balancer.html
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1193-L1212
  - vllm-ascend@2ed6cbba:vllm_ascend/eplb/core/eplb_utils.py#L46-L56
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L873-L922
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/model_runner_v2_eplb.md#L1-L30
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/model_runner_v1_eplb.md#L19-L40
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L37-L41
  - vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/force_eplb.py#L89-L105
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L564-L570
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L200-L217
  - vllm-ascend@2c59ff10:tests/e2e/weekly/single_node/configs/Qwen3.6-35B-A3B-w8a8-A3-accuracy.yaml#L17-L45
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L225-L264
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L126-L146
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L155-L161
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L307-L310
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: MoE 那几个矩阵上 EP 顶掉了 TP——EP 一开，MoE 的 tp_size 被置 1，每颗 NPU 整份拿走一批专家
  - to: engine-processes
    kind: builds-on
    note: EPLB 要在 Worker 里再起一个子进程，而上游的 Worker 是 daemon=True 起的，那条 daemon=False 的 patch 就是为这件事打的
  - to: ascend-config-system
    kind: builds-on
    note: eplb_config 是 additional_config 拆出来的八个子配置之一，键名与默认值怎么进来的在那一页
  - to: quantization
    kind: builds-on
    note: 能不能搬取决于该量化方法有没有把每个专家的权重和 scale 拆成可按专家寻址的张量，不能拆的格式直接抛错
  - to: enable-force-eplb-b7ec3661121f
    kind: conflicts-with
    note: main 上 enable_force_eplb 与 dynamic_eplb 同时开且模型是 MoE 会直接报错——前者改的是路由结果，不是摆放
  - to: expert-parallel
    kind: builds-on
    note: EPLB 重排的就是 EP 分到各 NPU 上的那批专家；EP 怎么切、token 怎么跨 NPU，在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一颗 NPU 忙不过来，另一颗在干等

这一页接着[专家并行（EP）](expert-parallel.md)那一页的例子：两颗昇腾 NPU 部署 Qwen3.6-35B-A3B，整个知识库用的都是它，完整设定见[贯穿全站的例子](one-request.md)。这个模型每层有 256 个[专家](moe.md)，开了 EP 之后，0 到 127 号整份放在 NPU 0 上，128 到 255 号整份放在 NPU 1 上。每个 token 由路由器挑 8 个专家，挑中的专家在哪颗 NPU 上，这个 token 就被送到哪颗上去算。

问题出在「挑谁」由数据决定。假如某段时间里用户问的多是编程题，路由器特别爱挑其中几个专家，而这几个专家恰好都在 NPU 0 上。于是同一层、同一步里，NPU 0 要算 650 次「token 找专家」，NPU 1 只有 350 次。一层 MoE 要等两颗都算完才能往下走，NPU 1 早早算完，剩下的时间只能干等。整台机器的速度被最忙的那颗拖住。

```wiki-diagram
file: eplb
```

EPLB 是 Expert Parallelism Load Balancer 的缩写，意思是「专家并行负载均衡」。它做的事是：先数一数每个专家实际分到多少 token，再算出一种新的摆法，把专家挪到合适的 NPU 上，让几颗 NPU 差不多一样忙。

先说清楚一件事：**Qwen3.6-35B-A3B 的官方教程和官方测试都没有开 EPLB。** 代码并不排除这个模型，它的 MoE 层和别的 MoE 模型一样会登记到 EPLB 里；但在它上面开了效果如何，官方没有给过验证。下面的数都是「假如给这个例子开上 EPLB」推出来的。

## 办法：挪位置，或者多放一份

EPLB 手里有两种办法。

第一种是**换位置**。把 NPU 0 上几个热门专家和 NPU 1 上几个冷门专家对调，两边分到的 token 数就接近了。每颗 NPU 放的专家个数不变，还是 128 个。

第二种是**多放一份**。有的专家热到一颗 NPU 都扛不住，挪到哪边都会让那边变忙，那就在两颗 NPU 上各放一份。这种多出来的副本叫**冗余专家**。例子里如果多放 2 份，一层就有 258 个位置，每颗 NPU 放 129 个。副本怎么分活是按编号定死的，不看当下谁忙。在这个例子里，每颗 NPU 负责的 token 都用自己手边那一份，一个热门专家的活就被两颗 NPU 分掉了。

这两种办法改的都只是「专家放在哪颗 NPU 上」。每个 token 挑中哪 8 个专家、得出什么结果，一点不变。所以开不开 EPLB，模型的输出应当逐个 token 相同。

## 先数，再算，再搬

EPLB 不是一开始就知道谁热门，要先看一阵子。它按一个固定的周期反复做三件事：

1. **数。** 每一步推理，每层 MoE 算完之后，记下这一层每个专家分到了几个 token。它只数 token 个数，不量时间也不量算力，「热门」在这里的意思就是「分到的 token 多」。默认数 600 步。
2. **算。** 数够了，把两颗 NPU 的统计拼成一张全表，交给一个单独的子进程去算新摆法。算法在 CPU 上跑，推理照常进行，不用停下来等。默认给它留 50 步的时间。
3. **搬。** 新摆法拿回来以后，按清单把专家的权重在两颗 NPU 之间传过去，一步只搬一层。这个模型 40 层每层都是 MoE，就搬 40 步。

三段加起来，这个例子的一个周期是 600 + 50 + 40 = 690 步。走完一轮，统计清零，从头再数。

```wiki-diagram
file: eplb-cycle
```

搬权重走的是一条单独的通信通道。每层 MoE 本来就要做两次跨 NPU 的传输：dispatch，把 token 发出去；combine，把算完的结果收回来。搬专家的数据不和它们挤在同一条通道里。

## 每颗 NPU 怎么知道专家在哪

摆法挪来挪去，每颗 NPU 每层都要记着两张表。

第一张回答「这个专家在不在我这儿，在第几格」。以没有冗余、刚启动时的摆法为例，站在 NPU 1 上看：200 号专家在，是本地第 72 格（200 − 128）；5 号专家不在，记成「没有」。

第二张回答「这个专家有好几份时，我用哪一份」。假如多放 2 份，刚启动时 NPU 0 放 0 到 127 号外加一份 128 号，NPU 1 放 128 到 255 号外加一份 0 号。0 号和 128 号专家这时都有两份，每颗 NPU 查第二张表都会指向自己手边那一份。

搬权重的最后一步就是把这两张表换成新的。表一换，下一个 token 就按新位置去找专家。

## 代价

**显存。** 这个例子用 BF16 权重，一个专家 6 MiB。多放 2 份冗余时，每颗 NPU 每层多放 1 个专家，40 层就是 240 MiB。另外还要常驻一块接收区，用来收别的 NPU 传过来的专家，大小等于一层的本地专家：129 × 6 MiB = 774 MiB。两项加起来每颗约 1 GiB，放在 64 GB 的 NPU 上不算多。

**搬运。** 每换一个专家就要在 NPU 之间传 6 MiB，而且一层的搬运要在一步推理的时间里传完。传的时候推理照常进行，但这一步结束时必须等它传完，没传完就是白等。

**有时候不划算。** 官方文档提醒：输入很短的场景、每颗 NPU 上专家本来就不多的场景，均衡带来的好处可能抵不过这些开销。

## 常见误解

- **「开了 EPLB，模型输出会变」**：不该变。它只换专家的位置，不换每个 token 挑中哪几个专家。名字很像、真会改输出的是另一个压测用的开关，见下面「会报什么错」。
- **「重排时整个模型要停下来」**：不会。权重按层搬，一步搬一层，40 层摊到 40 步里。但每一步末尾确实要等这一层传完，传得慢就是纯开销。
- **「把某一次的摆法存下来，下次直接用，就等于轻量版 EPLB」**：存下来的摆法只是固定的初始摆法，不再统计也不再重排；这个功能官方文档还写着计划移除。

## 对照源码

这一节给要读代码、查配置、排查问题的人。上面讲解里的每个数，依据都在这里。

### 怎么开

假如给例子开 EPLB，写法如下。这个模型的官方教程与测试都没有这样开过 [S35][S36]，下面只是按配置项推出来的写法：

```bash
export DYNAMIC_EPLB=true
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --additional-config '{"eplb_config": {"dynamic_eplb": true, "num_redundant_experts": 2}}'
```

```jsonc
// 配合 export DYNAMIC_EPLB="true"；缺了环境变量，EplbConfig 里那句 assert 会直接把服务拦下 [C2]
{"eplb_config": {
  "dynamic_eplb": true,                    // 真正的总开关，默认 false [C1]
  "expert_heat_collection_interval": 600,  // 数多少步，默认 600
  "algorithm_execution_interval": 50,      // 留给算法多少步，默认 50
  "num_redundant_experts": 2,              // 默认 0；(逻辑专家数 + 它) 必须整除 ep_size [C3]
  "eplb_policy_type": 2,                   // 0 Random / 1 DefaultEplb / 2 SwiftBalanceEplb / 3 FlashLB，默认 2 [C9]
  "eplb_heat_collection_stage": "all"      // 只在 prefill / decode / 全部步里数，默认 all
}}
```

- **两道门。** 单 NPU 或没开 EP 时 `ep_size == 1`，`init_eplb_config` 第一件事就是 `assert not eplb_enable, "EPLB must used in expert parallelism."`；dense 模型不建 MoE 层，没有东西可登记。每个 `AscendFusedMoE` 建层时都会 `VllmEplbAdaptor.register_layer(self)` [C40]，适配器取 `len(_registered_moe_layers)` 当 `num_moe_layers`，多模态模型取 `model.language_model` 与 `config.text_config` [C10]。Qwen3.6 的文本层 `model_type == "qwen3_5_moe_text"` 时每层 MLP 都是 `Qwen3NextSparseMoeBlock` [C39]，config 里 40 层、256 专家、top-8、`moe_intermediate_size` 512、`hidden_size` 2048 [S34]，所以 `num_moe_layers = 40` [D]。
- **本页的数怎么来。** 周期 = `expert_heat_collection_interval + algorithm_execution_interval + num_moe_layers` [C5] = 600 + 50 + 40 = 690 [D]。冗余 2 时 `global_num_experts = 256 + 2`、`local_num_experts = 258 // 2 = 129`，MoE 权重按 `local_num_experts` 建 [C37]。一个专家 BF16：`w13` 为 `2 × 512 × 2048`、`w2` 为 `2048 × 512`，合计 `3 × 2048 × 512 × 2 B = 6 MiB` [D]。
- **数的是什么。** `moe_load` 每个 MoE 层一份、长度是本地专家数的 int64 张量 [C13]，fused MoE 算完之后由 `expert_tokens` 换算成每个专家的 token 数直接 `add_` 上去，且只在 `eplb_heat_collection_status` 为真时数 [C12]。跨 NPU 的对比靠一次 all-gather（每颗 NPU 把自己那份发给所有 NPU，最后每颗都拿到拼好的全表）：把本颗的 `[层数, 本地专家数]` 拼成全局那张表再写进共享字典 [C6]；判均衡程度用的是每层各 rank 负载的峰均比，算完新旧两版各打一行日志，官方文档教人 grep `[Expert Hotness]` 就是这个。FlashLB（`eplb_policy_type: 3`）是例外：它要时间序列而不是一个累加值，`moe_load` 被开成 `(expert_heat_collection_interval, 本地专家数)` 的 int32 环形缓冲，每步写一行。
- **三段怎么比出来。** `EplbUpdator` 只维护一个计数器 `cur_iterations`。数：第 0 到第 `expert_heat_collection_interval - 1` 步，最后一步在 `forward_end` 末尾 all-gather 并 `planner_q.put(1)` 唤醒子进程。算：接下来 `algorithm_execution_interval` 步主进程什么都不做，到第 `heat + algo - 1` 步才在 `forward_before` 里 `block_update_q.get()` 一次取回**全部层**的结果。搬：再往后 `num_moe_layers` 步，第 k 步在 `forward_before` 里按清单发一批 `dist.P2POp(isend/irecv)`，和这一步的 forward 并行；`forward_end` 里 `req.wait()`、把收到的权重 copy 进原张量，同时换掉这一层的 `expert_map` 和 `log2phy`[C8]。数的阶段里，只有 `eplb_heat_collection_status` 为真的步才推进计数器；进入算和搬以后每步都推进。三段走完计数器归零、`moe_load` 清零。
- **子进程。** `EplbProcess._launch_process()` 用 spawn 起第二个进程，两条 `Queue` 一去一回，统计走 `Manager().dict()` [C7]。vLLM 用 `daemon=True` 创建 Worker，而 daemon 进程不允许再有子进程，于是有了那条把 `daemon` 改成 `False` 的 patch，并且只在 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` 打开时才导入 [C16][C17]。来龙去脉在 [三个进程与 patch 注入点](engine-processes.md)，按环境变量决定导不导入的机制在 [Patch 机制](ascend-patch-system.md)。
- **通信组。** `dynamic_eplb` 组和 MC2 组的 rank 集合相同，但另起一个 group_name [C15]，搬权重的 P2P 不和 MoE 的 dispatch / combine 挤在同一个 group 上。MC2 是昇腾把通信和计算揉进一个算子、边算边传的做法，省的是通信被干等的时间，不是通信量。
- **两张表。** `expert_map` 长度是逻辑专家数，不在本 NPU 就是 `-1`，否则是本地槽号；`log2phy` 给出本 NPU 该用的那一份副本的**全局物理号**，物理号 = 本地槽号 + rank × 每 rank 槽数[C4]。副本挑谁按编号错开、不看负载：v0.23 检出里适配器传入 `tensor_parallel_size`，大于 1 时取 `(ep_rank % tp + ep_rank // tp + 逻辑号) % 副本数`，否则取 `ep_rank % 副本数`。例子（TP=2、EP=2、冗余 2、v0.23 冷启动）：NPU 1 上逻辑 0 在本地第 128 槽、物理号 257；逻辑 128 在本地第 0 槽、物理号 129；两颗 NPU 查 `log2phy` 都指向自己那份 [D]。
- **静态 map。** `expert_map_record_path` 让 rank 0 在每个周期结束时导出当前摆法[C11]，下次 `expert_map_path` 直接加载，不需要环境变量、也不再统计和重排；给了 `expert_map_record_path` 会把 `dynamic_eplb` 强制置真。

### 会报什么错

- `The environment variable DYNAMIC_EPLB or EXPERT_MAP_RECORD of the EPLB must be set to true.`：配置里开了 `dynamic_eplb`，环境变量没设。
- `EPLB must used in expert parallelism.`：`ep_size == 1` 却开了 EPLB。
- `(n_expert + n_redundant) % ep_size must be 0`：冗余数配错。例子 256 + 2 = 258，两颗整除；若给 1 份冗余，257 除不尽就会在这里报错[D]。
- `EPLB not support ... with fused MC2 ...` / `EPLB not support W4A8MXFP`：适配器按 `(量化类型, 是否 fused MC2)` 查每个专家要搬哪几个张量，查不到的组合直接抛错 [C38]，见 [Quantization](quantization.md)。
- `eplb_policy_type must in [0, 1, 2, 3]`、`eplb_heat_collection_stage must be one of [...]`、`The expert_map is not json.` 等是配置校验。
- main 上 `enable_force_eplb cannot be mixed with dynamic_eplb.`：`enable_force_eplb` 把 `topk_ids` 整个换成轮转序列，专门用来压测，会改输出；和 `dynamic_eplb` 同时开且模型是 MoE 时直接报错 [C32][C33]。
- v0.23 / v0.26 的 model runner v2 上开 `dynamic_eplb` 直接 `NotImplementedError` [C18]。
- 一个常见的认错：`--enable-eplb` 在 v0.23 / v0.26 的 model runner v1 上不是开关——runner 只看 `ascend_config.eplb_config.dynamic_eplb` [C14]，而且 `dynamic_eplb: true` 单独还不够，环境变量那句 assert 才是最后一道闸。`--enable-eplb` 是 main 上 model runner v2 那条路的开关 [C28]。

### 开销和什么时候别开

- **常驻显存。** 适配器给每个本地专家预留一份等形状的接收缓冲，数量等于本地专家数；缓冲按 `(量化类型, 是否 fused MC2)` 只建一套，各层共用，所以是**一层**的本地专家权重。例子 BF16、冗余 2：`129 × 6 MiB = 774 MiB`；冗余专家本身每颗每层多 1 个，`40 × 6 MiB = 240 MiB` [D]。
- **搬运带宽。** 一次重排要把换掉的专家都搬一遍，每个 6 MiB，且必须在一步 forward 的时间里传完——发是异步的，等是同步的，遮不住就是净开销[D]。官方因此要求各 NPU 显存与算力一致、网络 ≥ 10 Gbps、容器挂上 shm [S24]。
- **不该开的场景。** 输入短于 1024 token 的 P 节点、每 die 专家数在 8 附近的 D 节点，收益可能抵不过开销 [S22]。
- **验收方式。** 仓库里那条两卡 e2e 用例用的是 `Qwen3-30B-A3B-W8A8`，对开关前后的输出做逐 token 相等断言 [C21]——这正是「只换摆放、不换路由」的检验。Qwen3.6-35B-A3B 没有对应用例 [S36]。
- **静态 expert map** 官方文档在三个快照上都写着「计划在 v0.25.1 移除」，可加载这条路三个快照上都还在 [!]。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 没给 map 文件时的初始摆放 | 连续切块后从尾部往前追加副本。例子 256 专家、2 颗、冗余 2：NPU 0 = 0–127 + 128，NPU 1 = 128–255 + 0 [D] | 改成与 vLLM 加载权重时的物理布局一致：物理号 `[0..255, 0, 1]` 按 2 颗切开。例子：NPU 0 = 0–128，NPU 1 = 129–255 + 0 + 1 [D] | 同 v0.26 | [!] 同一份配置，冷启动时专家摆在哪颗 NPU 上两边不同，连哪几个专家有副本都不同；显式给了 `expert_map_path` 才不受影响 |
| model runner v2 上的 EPLB | `dynamic_eplb` 直接 `NotImplementedError` | 同 v0.23 | 走上游 vLLM 的控制面：`--enable-eplb` + `--eplb-config`，昇腾只补一个 Gloo CPU 中转的通信器和 `load_collection_phase`[S29] | [!] 两条路开关名、配置位置都不同；把 `DYNAMIC_EPLB` 或 MRv1 的键带进 MRv2，启动校验会直接报错 |
| 与 `enable_force_eplb` | 无此参数 | 无此参数 | 同时开且是 MoE 模型直接报错 | 压测开关和均衡开关互斥 |
| 文档写的硬件限制 | 只提 950 系列不支持某几种 W4 量化 | 同 v0.23 | 多一条「A2 不支持冗余专家」[S31] | A2 上按 main 的说法只能靠换位置均衡，`num_redundant_experts` 该不该给非 0 值得先问 |

顺带一提：main 的 MRv1 设计文档里那棵模块树对不上代码——它列的 `vllm_ascend/eplb/utils.py` 和 `model_register` 函数，在整个 `vllm_ascend/` 下 `git grep` 都找不到，文档里的 DFX 示例（`check_iterations`、`check_expert_map_path`）同样不存在 [S30][!]。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 配置项与默认值、环境变量校验 | `vllm_ascend/ascend_config.py`，`EplbConfig` |
| 初始摆放、两张表 | `vllm_ascend/eplb/core/eplb_utils.py`，`generate_global_placement` / `init_eplb_config` / `generate_log2phy_map` |
| 三段周期 | `vllm_ascend/eplb/eplb_updator.py`，`EplbUpdator` |
| 子进程与策略 | `vllm_ascend/eplb/core/eplb_worker.py`，`EplbProcess`；`vllm_ascend/eplb/core/policy/policy_factory.py` |
| P2P 搬权重 | `vllm_ascend/eplb/core/eplb_device_transfer_loader.py` |
| 接收缓冲、按量化查要搬的张量 | `vllm_ascend/eplb/adaptor/vllm_adaptor.py`，`VllmEplbAdaptor` |
| 每步数 token | `vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py`，`moe_load` |

两张表的期望值可以拿仓库里那份 8 专家 / 2 颗 / 每颗 5 槽的测试 map 对一遍：NPU 0 装 `[7,2,0,3,5]`，NPU 1 装 `[6,1,4,7,2]`，物理槽 10 个，冗余 = 10 − 8 = 2，多出来的两份正是逻辑专家 7 和 2。站在 NPU 1 上（测试不传 `tp_size`，按 `ep_rank % 副本数` 挑）：

```
expert_map = [-1, 1, 4, -1, 2, -1, 0, 3]   # 逻辑 6 在本地第 0 槽；逻辑 0/3/5 不在本 NPU
log2phy    = [ 2, 6, 9,  3, 7,  4, 5, 8]   # 逻辑 7 有 0 和 8 两份，ep_rank=1 → 取 8
```

两行都是单元测试里钉死的期望值，v0.26 与 main 上同一组断言一字不差。逻辑 0 只有一份，两颗 NPU 都指向物理 2。
