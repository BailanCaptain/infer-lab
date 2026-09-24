---
id: dyntra-lb
title: "DyntraLB：跨 rank 传的只有块数，没有请求 id"
type: feature
summary: PD 分离的 D 节点上（MoE 模型的多 DP 部署），各 DP rank 每步 all_gather 一遍「每条请求占几个 KV 块」，同一个 planner 算出这一步谁暂停、谁放进来；一条请求都不搬家。
aliases: [DyntraLB, Dynamic Intra-Decoder Data-Parallel Load Balancing, 解码器内部数据并行动态负载均衡, D 节点负载均衡, 负载感知调度器, dyntra_lb_config, DyntraLBScheduler, AsyncDyntraLBScheduler, DyntraLBDPEngineCoreProc, DyntraLBPolicyMixin, bubble_threshold, long_req_block_threshold, dynamic_max_step]
chapters: ["12"]
order: 70
sources:
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L238-L248
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L250-L289
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L291-L292
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L364-L395
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L171-L176
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L442-L443
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L701-L705
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L421-L424
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L1217-L1220
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L132-L138
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L164-L173
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L201-L238
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L304-L322
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L378-L391
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L393-L399
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L401-L452
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L454-L470
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L472-L499
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1362-L1398
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L448-L455
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1450-L1463
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L984-L1012
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1255-L1259
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1471-L1488
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L1028-L1036
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L709-L725
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L3-L12
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L75-L86
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L106-L110
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L136-L153
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L198-L207
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/dyntra_lb.html
  - vllm@568afb3a:vllm/v1/engine/core.py#L2083-L2092
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L33-L41
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1153-L1156
verified: ["main"]
evidence: "C"
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: 它只装在 D 节点上，启动时硬查 kv_role 必须是 kv_consumer；P 和 D 各干什么、kv_role 三个取值在那一页
  - to: data-parallel
    kind: builds-on
    note: 它 all_gather 的就是同一个 DP 组里各 rank 的负载；DP rank 是什么、请求怎么落到某个 rank，在那一页
  - to: balance-scheduling
    kind: conflicts-with
    note: 同是 DP 准入控制的两条路，源码里同开直接 ValueError——那边按条数一刀冻结，这边按 KV 块数真调度
  - to: vllm-engine-core
    kind: builds-on
    note: 计划在忙循环那次 DP 同步之后生成、不在 schedule() 里，循环体一步做哪几件事在那一页
  - to: async-scheduling
    kind: builds-on
    note: 它换了 scheduler_cls，所以得自备一个 Async 版；异步调度改了什么、为什么不能混用同步类在那一页
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 一句话

PD 分离的 D 节点上开了多个 DP rank 时，请求长度一不均匀，最肥的那个 rank 就拖住所有人——DP 组每一步要一起算、一起等。DyntraLB 让每个 rank 每步报一遍**自己手上每条请求占了几个 KV 块**，全组 `all_gather` 成同一张表，再各自跑同一个 planner，算出这一步该暂停哪几条、放进来哪几条。**它一条请求都不搬家**：被暂停的请求 KV 留在原地，以后还由同一个 rank 接着跑 [S30]。

它**只有 main 开发主线上有**。v0.23 维护分支和 v0.26 分支（2026-09-17 源码快照）上 `vllm_ascend/core/dyntra_lb_scheduler.py`、`patch/platform/patch_dyntra_lb_core.py`、`docs/source/user_guide/feature_guide/dyntra_lb.md` 三个路径 `git ls-tree` 全部为空，整仓 `git grep -i dyntra` 一条都搜不到；两个分支挑调度器那段代码里也只有 profiling-chunk、dynamic-batch、batch-job 这些分支，没有它 [C28]。所以下面全篇讲的是 main，随时会变。

```wiki-diagram
file: dyntra-lb
```

## 那条请求连开都开不起来

[那条请求](one-request.md)跑在单卡、PD 混部上，而 DyntraLB 在启动校验里连设三道门：`kv_transfer_config` 为空或 `kv_role` 不是 `kv_consumer`、`data_parallel_size <= 1`、`nnodes_within_dp > 1`，每一条都是直接 `ValueError` [C24]。**把它写进那条请求的启动命令，服务根本起不来。**

三道明门之外还有一道暗门：它的进场方式是把上游 `DPEngineCoreProc` 这个名字换成自己的子类 [C37]，而上游只在模型是 MoE 时才解析这个名字构造 DP 引擎进程 [C38]——**dense 模型上三道校验全过、启动也不报错，但负载均衡循环根本不会跑**。

改成能走到这里的最小设定：一套 1P1D，D 节点单机、MoE 模型、`--data-parallel-size 2`、`kv_role='kv_consumer'`。这时那条请求在它眼里是这么大（默认值全部来自 `DyntraLBConfig` [C21]）：

| 这一页的东西 | 那条请求上是多少 |
|---|---|
| 它算几个块 | 刚进 D 节点时 `ceil(37 / 128) = 1` 块，生成完是 `ceil(237 / 128) = 2` 块 [D] |
| 多长才算「长请求」 | `long_req_block_threshold = 700` 块 = 700 × 128 = **89 600 个 token** |
| 多失衡才动手 | `bubble_threshold = 5.0`，即 max − avg ≥ 5 块 = 640 个 token |
| 第几步起才可能出计划 | `start_step = 250`，且 `mode` 默认是 `"dynamic"` |

两块对七百块：**默认配置下，一屋子这样的请求也激活不了它**。它盯的是 9 万 token 级别的长对话。

## 负载量的是 KV 块数，不是请求条数

`get_dyntra_lb_request_block_num` 就一行——`(len(request.all_token_ids) + block_size - 1) // block_size`，`block_size` 直接取 `cache_config.block_size`，拿不到正整数就 `RuntimeError` [C1]。**这是它和[均衡调度](balance-scheduling.md)最根本的分水岭**：那一页数的是 `len(self.running)`，一条 37 token 的请求和一条 9 万 token 的请求算同一条；在这里它们是 1 块和 700 块。

两个阈值都以块计、不以 token 计，官方参数表专门补了一句「它们的 token 等价值取决于配置的 block size」[S31]。普通注意力模型在昇腾上 `block_size` 实际固定 128（见 [block 是怎么分出来的](vllm-kv-block-allocation.md)），按 128 换算是一次乘法；但 D 节点常跑的正是例外——`deepseek_v4` 允许 32/64，块小了这两个阈值的 token 等价值就跟着缩，700 块在 block_size=32 时只有 22 400 个 token [D]。

`all_token_ids` 是 prompt 加已生成的全部 token，所以**同一条请求的「重量」随 decode 一步步变大**，planner 每步重算，不缓存 [D]。

## 跨 rank 传的只有块数，没有请求 id

打包出去的是一个定长 int32 向量，长 `2 × max_num_seqs + 2`：前 `2 × max_num_seqs` 格放块数（running 在前、这一步可接纳的 waiting 在后，不足补 0），倒数第二格放 running 的条数当分界线，最后一格放「本步有没有新来的长请求」；缓冲区在 `_init_data_parallel` 里一次性分配，之后每步原地覆盖 [C15]。

计划回来时也只有块数：`{"out_blk": [...], "in_blk": [...], "freeze": bool}`，而 `freeze` 的定义恰好就是 `len(in_blk) == 0` [C14]。`_apply_load_balance_modifications` 拿 `out_blk` 里的数字**去 running 里找块数相同的那一条**，拿 `in_blk` 去候选里找块数相同的那一条 [C3]。**两条块数相同的请求在计划眼里完全可换**——协议里没有 id，最后暂停的是哪一条，由 running 列表的顺序决定 [D]。

挑暂停对象时写了两轮优先级，第一轮只挑 `getattr(r, "lb_newly_added", False)` 为真的。但昇腾侧全仓、以及上游 vLLM v0.26.0 里，都没有任何地方给 `Request` 设过这个属性，所以第一轮永远空手，实际只剩第二轮那个「谁先匹配上就是谁」[I]（main 配套的上游提交本地没有单独钉，这条只能说到 v0.26.0 为止）。

顺序上还有一件要记牢的事：**只要这一步有计划，准入就被计划全权接管**。`_can_admit_waiting_request` 的写法是「`_lb_admit_req_ids is None` 才放行一切」[C4]，而有计划时它是一个具体集合，没被点名的请求在 waiting 循环里一律 `continue` 跳过。为了让被点名的请求真能进来，`prepare_dyntra_lb_step` 在报数之前会先替候选拉远端 KV，上限是 `2 × max_num_running_reqs − len(running)` 条——向量留 `2 × max_num_seqs` 格正是为它留的 [C6]。

## 换不动就丢一条：一个写死的吞吐模型

planner 的主循环是：按总块数排序，先让最轻的 rank 拿一条更重的换进来、再让最重的 rank 拿一条更轻的换进来；两边都换不动，才走 `try_drop_for_throughput`——**直接把最重那个 rank 上的一条请求踢出 running，不换任何东西进来**。凭据是一个写死的单步耗时模型：`耗时 = 20000 + 19.2 × 这个 rank 的总块数`，吞吐取 `全组 running 条数 / 耗时`，踢掉谁之后吞吐更高就踢谁 [C13]。两个常数没有单位也没有注释。

拿图上那一帧算（`max_num_seqs = 4`，`bubble_threshold` 取默认 5.0）：planner 先把两个 rank 的 running 各补满到 4 条，于是 DP0 = 700 + 2 + 2 + 2 = 706 块、DP1 = 2 × 4 = 8 块，全组 8 条；两边 waiting 都空了，换不动，进 `try_drop_for_throughput`：

```
现在：            20000 + 19.2 × 706 = 33 555.2  →  8 / 33 555.2 = 2.384e-4
踢掉 700 块那条：  max(706 − 700, 8) = 8
                  20000 + 19.2 × 8   = 20 153.6  →  7 / 20 153.6 = 3.473e-4   高 1.46 倍
```

于是 DP0 拿到 `out=[700] in=[2]`、DP1 拿到 `out=[] in=[2]`——把这段 `_balance_load` 原样抠出来单独跑一遍，输出就是这两行 [D]。**代价一目了然：那条 9 万 token 的请求被停在原地，换另外 7 条快 1.46 倍。** 官方文档自己也把这套估算限定成「不是对每个模型、每种流量分布的延迟或吞吐保证」[S34]。

## 装上去是四个类，加一个换掉的引擎核心进程

校验通过后分两路挑类：没开 recompute 调度就走 `_get_dyntra_lb_scheduler_cls`，同步 `DyntraLBScheduler`、异步 `AsyncDyntraLBScheduler`；开了 recompute 则换成 `_get_recompute_scheduler_cls(dyntra_lb_enabled=True)` 给出的另两个。四个类都只是把 `DyntraLBPolicyMixin` 混进不同基类，policy 那份代码只有一份。另一半在进程上：`run_engine_core` 启动时把 `vllm.v1.engine.core.DPEngineCoreProc` 这个名字整个换成 `DyntraLBDPEngineCoreProc`，而且这一支排在均衡调度那一支前面（`elif`）[C20]。装法本身的规矩在 [patch 系统](ascend-patch-system.md)。

`run_balance_load` 挂在 `_has_global_unfinished_reqs` 的返回值之后——和均衡调度同一个位置、同一个理由（空转的 rank 也得参加集合通信）。本步末尾算出的计划，下一步 `schedule()` 开头才执行，一份只用一次 [S33]。`start_step` 比的是 `step_counter`，而上游在一波请求跑完后把它清零 [C36]，所以 250 是**每一波从头数**，不是服务启动以来的总步数 [D]。

一段可以直接抄到 D 节点的配置：

```bash
vllm serve /path/to/model \
  --data-parallel-size 2 \
  --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}' \
  --additional-config '{"scheduler_config": {"dyntra_lb_config": {"enabled": true}}}'
```

`enabled` 默认 `false`，其余五个阈值默认就是上面那张表，官方示例同样只写 `enabled` 这一个键。**`dyntra_lb_config` 必须嵌在 `scheduler_config` 里**：它是这组调度键里唯一不走 `_resolve` 兼容路径的那个，而 `AscendConfig` 对未知顶层键是 `extra="forbid"`、只给另外五个老键留了 deprecation 通道 [C22]——写到 `additional_config` 顶层就是一个配置错误，不会像老键那样打条警告照样生效 `[!]`。互斥项两条，各一个 `ValueError`：`enable_balance_scheduling`、`profiling_chunk_config`。

## 常见误解

- **「它会把请求从忙的 rank 挪到闲的 rank」**——一条都不挪，文档第一段就点名否掉了；它只在本 rank 内部暂停或放行，被暂停的请求以后还由同一个 rank 接着跑。决定请求落在哪个 rank 上的仍是前端路由。
- **「被它暂停 = 被抢占，KV 会被回收」**——`_lb_pause_request` 只把状态改成 `PREEMPTED`、记进 `_lb_paused_req_ids`、塞回队头，一个块都不释放；上游真正的抢占是另一条路，`_preempt_request` 第一件事就是把 id 从这个集合里划掉 [C5]。两者状态值相同、含义不同，看日志时容易混。
- **「`bubble_threshold` 是个百分比」**——大于等于 1 时是**绝对块数差**，小于 1 时才是 `(max − avg) / max` 的比例。官方参数表特意写明「`1` 表示一个 KV 块，不是 100%」[S31]，代码里就是 `if threshold < 1` 那一行分的岔。
- **「开了它就一直在均衡」**——默认 `mode="dynamic"`，在收到一条超过 700 块的新请求之前完全不动，之后连着 `dynamic_max_step = 256` 步没有新长请求又会自己关掉。所以排障时官方让你把 `start_step` 设成 0 并切 `static`，否则短跑一轮可能根本没走到它 [S32]。
