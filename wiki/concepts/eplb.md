---
id: eplb
title: "EPLB：把热门专家搬到闲着的卡上，但不改路由"
type: feature
summary: 开了 EP 之后哪张卡忙由数据决定，EPLB 数每个专家吃了多少 token，交给一个独立子进程算新摆法，再一层一层把专家权重 P2P 搬过去。
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
  - vllm-ascend@2c59ff10:vllm_ascend/eplb/adaptor/vllm_adaptor.py#L106-L124
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
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L871-L920
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/model_runner_v2_eplb.md#L1-L30
  - vllm-ascend@b255ab59:docs/source/developer_guide/Design_Documents/model_runner_v1_eplb.md#L19-L40
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L37-L41
  - vllm-ascend@b255ab59:vllm_ascend/ops/fused_moe/force_eplb.py#L89-L105
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L561-L567
  - https://huggingface.co/Qwen/Qwen3-30B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: tensor-parallel
    kind: alternative-to
    note: MoE 那几个矩阵上 EP 顶掉了 TP——EP 一开，MoE 的 tp_size 被置 1，每张卡整份拿走一批专家
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
    note: EPLB 重排的就是 EP 分到各卡上的那批专家；EP 怎么切、token 怎么跨卡，在那一页
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

MoE 开了专家并行（EP）之后，每张卡**整份**持有一批专家，token 去哪个专家由路由算出来——热门专家所在的那张卡就成了整批的瓶颈。EPLB 在每一步 forward 里数每个专家吃进多少 token，攒满一个窗口后把统计交给一个**独立的子进程**算新摆法，再一层一层把专家权重用 P2P 搬到新位置。**它换的是「哪张卡上放哪个专家」，不换路由结果**，开关前后的输出应当逐 token 相同 [C21]。`vllm_ascend/eplb/` 这条路三个版本上都在，main 另外多出一条走上游控制面的新路。

```wiki-diagram
file: eplb
```

## 那条请求用不到它：Qwen3-0.6B 一个专家都没有

[那条请求](one-request.md)是 dense 模型、单卡，两道门一道都过不去：dense 模型不注册任何 MoE 层，`num_moe_layers` 是 0，没有东西可数；就算换成 MoE 模型，单卡 `ep_size == 1` 时 `init_eplb_config` 第一件事就是 `assert not eplb_enable, "EPLB must used in expert parallelism."` [C3]。

要走到这里，最小的改动是照仓库里那条两卡 e2e 用例来：`vllm-ascend/Qwen3-30B-A3B-W8A8`、`--tensor_parallel_size 2 --enable_expert_parallel`、`DYNAMIC_EPLB=true`，外加一段 `eplb_config`。本页后面的数都按它算 [A]：

| 这一页的东西 | 两卡 Qwen3-30B-A3B 上是多少 | 怎么来的 |
|---|---|---|
| `ep_size` | 2 | EP 一开 `ep_size = tp_size`、MoE 那部分的 `tp_size` 置 1，每张卡完整拿走一批专家 |
| 逻辑专家 / MoE 层数 | 128 / 48 | 模型卡：48 层每层都是 MoE 层，每层 128 个专家、top-8 [S34] |
| 物理槽 / 每张卡装几个 | 130 / **65** | 128 加上 `num_redundant_experts: 2`，平摊到 2 张卡 [D] |
| 一个完整周期几步 forward | 100 + 20 + 48 = **168** | 三段长度分别是两个配置项和 MoE 层数 [C5] |

## 它数的只有 token 数

统计量只有一个：`moe_load`，每个 MoE 层一份、长度是**本地**专家数的 int64 张量，fused MoE 算完之后由 `expert_tokens` 换算成每个专家的 token 数直接 `add_` 上去 [C12]。不数时延、不数 FLOPs、不数通信量——**「热」在这里的定义就是「分到的 token 多」**。跨卡的对比靠一次 all-gather，把本卡的 `[层数, 本地专家数]` 拼成全局那张表再写进共享字典；判均衡程度用的是每层各 rank 负载的峰均比，算完新旧两版各打一行日志，官方文档教人 grep `[Expert Hotness]` 就是这个。

FlashLB（`eplb_policy_type: 3`）是例外：它要时间序列而不是一个累加值，`moe_load` 被开成 `(expert_heat_collection_interval, 本地专家数)` 的 int32 环形缓冲，每步写一行。

## 一个周期分三段，中间那段在另一个进程里

`EplbUpdator` 只维护一个计数器 `cur_iterations`，三段全靠它和三个阈值比出来：

- **数**：第 0 到第 `expert_heat_collection_interval - 1` 步（默认 600，上面那组配置是 100）。最后一步末尾 all-gather，并 `planner_q.put(1)` 唤醒子进程。
- **算**：接下来 `algorithm_execution_interval` 步（默认 50，这里是 20）。主进程什么都不做，到第 `heat + algo - 1` 步才 `block_update_q.get()` 一次取回**全部层**的结果。
- **搬**：再往后 `num_moe_layers` 步，**每步搬一层**。第 k 步在 `forward_before` 里按清单发一批 `dist.P2POp(isend/irecv)`，让它和这一步的 forward 并行；`forward_end` 里 `req.wait()`、把收到的权重 copy 进原张量，同时换掉这一层的 `expert_map` 和 `log2phy`。

三段走完计数器归零、`moe_load` 清零，下一轮重来。**算法不在 Worker 进程里跑**：`EplbProcess._launch_process()` 用 spawn 起第二个进程，两条 `Queue` 一去一回，统计走 `Manager().dict()`。这既是好事（几十毫秒的组合优化不占 forward），也是这个特性要动上游进程模型的原因——vLLM 用 `daemon=True` 创建 Worker，而 daemon 进程不允许再有子进程，于是有了那条把 `daemon` 改成 `False` 的 patch，并且只在 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` 打开时才导入 [C16]。来龙去脉在 [三个进程与 patch 注入点](engine-processes.md)，按环境变量决定导不导入的机制在 [Patch 机制](ascend-patch-system.md)。

权重走的是一条**单开的通信组**：`dynamic_eplb` 组和 MC2 组的 rank 集合相同，但另起一个 group_name [C15]，搬权重的 P2P 不和 MoE 的 all-to-all 挤在同一个 group 上。

## 摆法落地就是每层两张表

`expert_map` 回答「这个逻辑专家在不在我这儿、在第几个本地槽」，长度是逻辑专家数，不在本卡就是 `-1`；`log2phy` 回答「本卡要用的那一份副本的**全局物理号**是多少」，副本多于一份时按 `ep_rank % 副本数` 挑 [C4]。拿仓库里那份 8 专家 / 2 卡 / 每卡 5 槽的测试 map 走一遍 [C19]：卡 0 装 `[7,2,0,3,5]`，卡 1 装 `[6,1,4,7,2]`，物理槽一共 10 个，冗余数 = 10 − 8 = 2，多出来的两份正是逻辑专家 7 和 2。站在卡 1 上：

```
expert_map = [-1, 1, 4, -1, 2, -1, 0, 3]   # 逻辑 6 在本地第 0 槽；逻辑 0/3/5 不在本卡
log2phy    = [ 2, 6, 9,  3, 7,  4, 5, 8]   # 逻辑 7 有 0 和 8 两份，ep_rank=1 → 取 8
```

两行都是单元测试里钉死的期望值 [C20]，v0.26 与 main 上同一组断言一字不差。逻辑 0 只有一份，两张卡都指向物理 2——**副本挑谁是按 rank 错开的，不看负载**；负载只决定下一轮摆到哪里。静态 expert map 就是把这张表存成 json：`expert_map_record_path` 让 rank 0 在每个周期结束时导出，下次 `expert_map_path` 直接加载，不需要环境变量、也不再统计和重排。

## 怎么开，开了要付什么

```jsonc
// 配合 export DYNAMIC_EPLB="true"；缺了环境变量，EplbConfig 里那句 assert 会直接把服务拦下 [C2]
{"eplb_config": {
  "dynamic_eplb": true,                    // 真正的总开关，默认 false [C1]
  "expert_heat_collection_interval": 100,  // 数多少步，默认 600
  "algorithm_execution_interval": 20,      // 留给算法多少步，默认 50
  "num_redundant_experts": 2,              // 默认 0；(逻辑专家数 + 它) 必须整除 ep_size [C3]
  "eplb_policy_type": 2                    // 0 Random / 1 DefaultEplb / 2 SwiftBalanceEplb / 3 FlashLB，默认 2 [C9]
}}
```

1. **常驻显存。** 适配器给每个本地专家预留一份等形状的接收缓冲，数量等于本地专家数，相当于**一整层的本地专家权重**。W8A8 下一个专家是 `2 × 768 × 2048 + 2048 × 768 = 4.5 MiB`，65 个就是 **≈ 293 MiB**，从服务起来一直占到结束 [D]。
2. **搬运带宽。** 一次重排要把换掉的专家都搬一遍，每个 4.5 MiB，且必须在一步 forward 的时间里传完——发是异步的，等是同步的，遮不住就是净开销 [D]。官方因此要求各卡显存与算力一致、网络 ≥ 10 Gbps、容器挂上 shm [S24]。
3. **不该开的场景。** 输入短于 1024 token 的 P 节点、每 die 专家数在 8 附近的 D 节点，收益可能抵不过开销 [S22]；另外量化格式得配合：适配器按 `(量化类型, 是否 fused MC2)` 查每个专家要搬哪几个张量，查不到的组合直接抛错，见 [Quantization](quantization.md)。

## 三个版本上的差别

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 没给 map 文件时的初始摆放 | 连续切块后从尾部往前追加副本，8 专家 2 卡 2 冗余得 `[[0,1,2,3,4],[4,5,6,7,0]]` [C3] | 改成与 vLLM 加载权重时的物理布局一致：`[[0,1,2,3,4],[5,6,7,0,1]]` [C27] | 同 v0.26 | [!] 同一份配置，冷启动时专家摆在哪张卡上两边不同；显式给了 `expert_map_path` 才不受影响 |
| model runner v2 上的 EPLB | `dynamic_eplb` 直接 `NotImplementedError` [C18] | 同 v0.23 | 走上游 vLLM 的控制面：`--enable-eplb` + `--eplb-config`，昇腾只补一个 Gloo CPU 中转的通信器和 `load_collection_phase` [C28] | [!] 两条路开关名、配置位置都不同；把 `DYNAMIC_EPLB` 或 MRv1 的键带进 MRv2，启动校验会直接报错 |
| 文档写的硬件限制 | 只提 950 系列不支持某几种 W4 量化 | 同 v0.23 | 多一条「A2 不支持冗余专家」[S31] | A2 上按 main 的说法只能靠换位置均衡，`num_redundant_experts` 该不该给非 0 值得先问 |

顺带一提：main 的 MRv1 设计文档里那棵模块树对不上代码——它列的 `vllm_ascend/eplb/utils.py` 和 `model_register` 函数，在整个 `vllm_ascend/` 下 `git grep` 都找不到，文档里的 DFX 示例（`check_iterations`、`check_expert_map_path`）同样不存在 [!]。

## 常见误解

- **「开了 EPLB 模型输出会变」**——不该变。它只换专家摆在哪张卡，路由算出的逻辑专家 id 不变；那条两卡用例的验收方式就是对开关前后的输出做逐 token 相等断言。真会改输出的是名字很像的 `enable_force_eplb`（main 才有）：它把 `topk_ids` 整个换成轮转序列，专门用来压测，和 `dynamic_eplb` 同时开会直接报错 [C33]。
- **「`--enable-eplb` 就是开关」**——在 v0.23 / v0.26 的 model runner v1 上不是：runner 只看 `ascend_config.eplb_config.dynamic_eplb`，而且 `dynamic_eplb: true` 单独还不够，环境变量那句 assert 才是最后一道闸。`--enable-eplb` 是 main 上 model runner v2 那条路的开关。
- **「重排会停住整个模型」**——不会一次停完：权重按层搬，第 k 层的 isend/irecv 发在这一步 forward 之前、等在这一步结束时，48 层摊到 48 步。但它确实是同步等待，算不过来就是纯开销。
- **「静态 expert map 是 EPLB 的轻量替代」**——它只是把某一次跑出来的摆法记下来下次直接加载，不再统计也不再重排；而且官方文档在三个快照上都写着「计划在 v0.25.1 移除」，可加载这条路三个快照上都还在 [!]。
