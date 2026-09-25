---
id: dyntra-lb
title: "DyntraLB：跨 rank 传的只有块数，没有请求 id"
type: feature
summary: D 节点上开了好几个 DP rank 时，各 rank 每一步互报「手上每条请求占几个 KV 块」，按同一套算法决定这一步各自暂停谁、放谁进来，免得最重的那个 rank 拖住所有人；请求从头到尾不换 rank。
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_mamba_config.py#L127-L153
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L240-L302
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
updated: "2026-09-25"
origin: seed
---

## 一个 rank 被 26 万 token 的长对话压住

设想一台 D 节点（PD 分离里专管 decode 的那台机器，见 [PD 分离](pd-disaggregation.md)）上跑着 [那条请求](one-request.md)用的模型 Qwen3.6-35B-A3B，开了两份[数据并行（DP）](data-parallel.md)副本：DP0 和 DP1。前端把请求分下来，DP0 碰巧分到一条快 26 万 token 的长对话，外加 3 条和那条请求差不多长的短问答；DP1 手上只有 4 条短问答。

这是个 [MoE](moe.md) 模型，两份副本每一层都要一起把 token 发给专家、再一起收回来，所以**每一步两个 rank 必须一起走**。DP0 这一步要读一大片 KV，算得慢；DP1 早就算完了，也只能干等。最重的那个 rank 决定了全组每一步多快。

DyntraLB 管的就是这件事。每一步末尾，每个 rank 把「手上每条请求各占几个 KV 块」报给全组，大家拿到同一张表，跑同一套算法，算出下一步自己该暂停哪几条、放哪几条新请求进来。**它一条请求都不搬家**：被暂停的请求 KV 留在原地，以后还由同一个 rank 接着跑；它能动的只是「这一步各自让谁上」。

还要先说清楚：这个功能**目前只在开发主线上有**，两个已发布的分支里一行代码都没有，下面讲的随时可能变。

```wiki-diagram
file: dyntra-lb
```

## 开起来要同时满足四件事

前三件写在启动检查里，不满足就直接报错、服务起不来：

1. 必须是 D 节点——PD 分离里接收 KV 的那一方。PD 混部、P 节点都不行。
2. DP 副本至少两份。只有一份没什么可均衡的。
3. 同一组 DP 副本必须都在一台机器上，不能跨机器。

第四件不报错，所以更容易踩：**模型必须是 MoE**。它是靠换掉「MoE 模型才会用到的那种 DP 引擎进程」来进场的；dense 模型的各份 DP 副本彼此完全独立，根本不走那种进程。于是 dense 模型上三道检查全过、启动也不报错，但负载均衡一次都不会跑。

Qwen3.6-35B-A3B 每层 256 个专家，是 MoE，四件事都能满足。不过源码注释里写着验证过的模型只有 Qwen3-30B 和 Qwen3.5-35B，本页用的 Qwen3.6-35B-A3B 不在这份名单里——下面的数都是照代码推出来的，不是实测。

## 它量的是块数，不是请求条数

DyntraLB 衡量一个 rank 有多重，数的是它手上所有请求一共占了几个 [KV 块](vllm-kv-block-allocation.md)。一条请求占几块，就是「问题加已生成的 token 总数 ÷ 每块能放的 token 数」向上取整。

这个模型的块特别大：它是线性注意力和全注意力混着用的模型，块大小要和[线性注意力](linear-attention.md)的状态对齐，算出来是**一块 2048 个 token**，不是常见的 128。代入：

| 这条请求 | 总 token 数 | 占几块 |
|---|---|---|
| 那条请求刚进 D 节点 | 37 | 1 |
| 那条请求答完 | 237 | 1 |
| DP0 上那条长对话 | 约 26 万 | 128 |

128 块就是这个模型的上限：它最多支持 262 144 个 token 的上下文，正好 128 块。

按块数算，长对话和短问答的差别一目了然：128 对 1。对比[均衡调度](balance-scheduling.md)：那一页数的是「手上有几条请求」，一条 37 token 的和一条 26 万 token 的都算一条。这是两者最根本的分别。

还有两点要记住。一是请求的「重量」会变：每 decode 一步，token 总数就多一个，块数跟着涨，所以每一步都要重新数。二是它只数 token 占的块：线性注意力那份状态每条请求固定一份、和长短无关，这部分不在它的账里。

## 默认阈值在这个模型上够不着

DyntraLB 有两个开关阈值，都以块为单位，不以 token 为单位，块多大就决定了它们实际是多少 token：

| 阈值 | 默认值 | 在这个模型上等于 |
|---|---|---|
| 多长算「长请求」 | 700 块 | 700 × 2048 = 1 433 600 个 token |
| 多失衡才动手 | 最重的 rank 比平均多 5 块 | 5 × 2048 = 10 240 个 token |

第一行是关键。默认模式下，DyntraLB 平时不动，**要等进来一条超过 700 块的请求才启动**。可这个模型一条请求最多 128 块，永远到不了 700 块——**默认配置下，这个模型上的 DyntraLB 永远不会自己启动**。要让它工作，得把模式改成「一直开着」，或者把长请求阈值调到 128 块以内。

另外它默认从第 250 步才开始工作，这个步数是**每一波请求从头数**的：所有 rank 都空闲下来后计数清零，下一波请求来了重新数。

## 跨 rank 传的只有块数，没有请求 id

每一步每个 rank 往外报的是一串定长的整数：先是正在跑的每条请求各几块，再是这一步可以放进来的候补请求各几块，最后加上「有几条正在跑」和「有没有新来的长请求」两个数。不够长就补 0。

算回来的计划也只有块数：「暂停一条 1 块的，放进一条 64 块的」。rank 拿到计划后，去自己手上找块数对得上的请求。**两条块数相同的请求在计划眼里完全一样**——计划里没有请求 id，最后暂停的是哪一条，取决于手上请求的排列顺序。

计划一旦生效，放谁进来就全听计划的：计划没点名的候补请求，这一步一律不放行。为了让点名的请求真能进来，每个 rank 在报数之前会先替候补请求把 KV 从 P 节点那边拉过来。

## 这一步的计划是怎么算出来的

回到开头那一帧，假设每个 rank 最多同时跑 4 条请求，模式已经改成一直开着，并且已过第 250 步。这一刻 DP1 的候补里正好来了一条约 13 万 token 的请求，64 块：

| | 正在跑 | 候补 | 正在跑的合计 |
|---|---|---|---|
| DP0 | 128、1、1、1 | 无 | 131 块 |
| DP1 | 1、1、1、1 | 64 | 4 块 |

两边平均 67.5 块，最重的 DP0 比平均多 63.5 块，远超 5 块的门槛，开始算：

1. **先让最轻的 rank 变重。** DP1 最轻，看能不能拿一条正在跑的换一条更重的候补进来。把一条 1 块的短问答换成那条 64 块的，DP1 变成 67 块。
2. **再让最重的 rank 变轻。** DP0 没有候补，换不了。
3. **两边都换不动时，考虑直接从最重的 rank 踢掉一条。** 这一轮 DP1 刚换过，不走这一步；下一轮两边都换不动了才走，但算下来踢哪条都不划算（算法见下半），于是停下。

最后 DP0 131 块、DP1 67 块，差距从 63.5 块降到 32 块，仍然高于门槛，但已经没有可以做的动作了。计划是：

- **DP1**：暂停 1 条 1 块的短问答，放进那条 64 块的请求。
- **DP0**：这一步不放任何新请求进来（冻结）。

这份计划在这一步末尾算出，**下一步开头才执行**，只用一次。两个 rank 拿到的是同一张表、跑的是同一套算法，所以各自算出来的计划一定一致，不需要谁来通知谁。

## 暂停不等于抢占

被计划暂停的请求，状态标成和「被抢占」一样的值，排回候补队伍最前面，但**它占着的 KV 块一个都不还**，下次轮到它直接接着跑。真正的抢占是另一回事：要把 KV 块收回。两者状态值相同、含义不同，看日志时容易混。

## 常见误解

- **「它会把请求从忙的 rank 挪到闲的 rank」**——一条都不挪。它只在每个 rank 自己手上暂停或放行；请求落在哪个 rank 上，仍然是前端决定的。
- **「多失衡才动手是个百分比」**——门槛大于等于 1 时是**块数差**，默认的 5 就是 5 块；小于 1 时才按比例算。
- **「开了它就一直在均衡」**——默认模式要等一条超长请求才启动，之后连续 256 步没有新的超长请求又会自己关掉。上一节说过，这个模型在默认配置下根本等不到那条超长请求。

## 对照源码

### 怎么开

- 一段可以直接抄到 D 节点的配置（模型路径和连接器按实际改）：

  ```bash
  vllm serve /path/to/model \
    --data-parallel-size 2 \
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}' \
    --additional-config '{"scheduler_config": {"dyntra_lb_config": {"enabled": true}}}'
  ```

  `enabled` 默认 `false`；其余键的默认值：`mode="dynamic"`、`start_step=250`、`end_step=-1`、`bubble_threshold=5.0`、`long_req_block_threshold=700`、`dynamic_max_step=256`、`enable_diagnostics=False` [C21]。官方示例同样只写 `enabled` 这一个键。
- **`dyntra_lb_config` 必须嵌在 `scheduler_config` 里**：它是这组调度键里唯一不走 `_resolve` 兼容路径的那个，而 `AscendConfig` 对未知顶层键是 `extra="forbid"`、只给另外五个老键留了 deprecation 通道 [C22]——写到 `additional_config` 顶层就是一个配置错误，不会像老键那样打条警告照样生效 `[!]`。
- **本页模型要想让它工作**：`mode` 设 `"static"`，或把 `long_req_block_threshold` 调到 128 以下。依据：`add_request` 只在 `mode == "dynamic"` 时比较 `blk_num > long_req_block_threshold` 并记下长请求 [C16]，`run_balance_load` 在 dynamic 模式下要等这个标志经 `all_reduce` 汇总为真才置 `_lb_dynamic_enable` [C17]；而 Qwen3.6-35B-A3B 的 `max_position_embeddings = 262144` [S39]，块大小 2048 时一条请求最多 `262144 / 2048 = 128` 块 [D]。排障时官方同样建议 `start_step` 设 0 并切 `static`，否则短跑一轮可能根本没走到它 [S32]。
- **块大小从哪来**：`get_dyntra_lb_request_block_num` 就一行——`(len(request.all_token_ids) + block_size - 1) // block_size`，`block_size` 直接取 `cache_config.block_size`，拿不到正整数就 `RuntimeError` [C1]。混合模型的 `cache_config.block_size` 由昇腾的 `patch_mamba_config` 按 SSM 页对齐改大 [C40]；按 [那条请求](one-request.md) 下半的推导，这个模型 TP=1 与 TP=2 都是 2048。官方参数表专门补了一句两个阈值「的 token 等价值取决于配置的 block size」[S31]。普通注意力模型在昇腾上 `block_size` 实际固定 128（见 [block 是怎么分出来的](vllm-kv-block-allocation.md)），700 块 = 89 600 个 token；D 节点常跑的 `deepseek_v4` 允许 32/64，700 块在 block_size=32 时只有 22 400 个 token [D]。
- **装上去是四个类加一个换掉的引擎核心进程**：校验通过后分两路挑类——没开 recompute 调度走 `_get_dyntra_lb_scheduler_cls`，同步 `DyntraLBScheduler`、异步 `AsyncDyntraLBScheduler`；开了 recompute 则换成 `_get_recompute_scheduler_cls(dyntra_lb_enabled=True)` 给出的另两个。四个类都只是把 `DyntraLBPolicyMixin` 混进不同基类，policy 代码只有一份。进程侧：`run_engine_core` 启动时把 `vllm.v1.engine.core.DPEngineCoreProc` 这个名字整个换成 `DyntraLBDPEngineCoreProc`，这一支排在均衡调度那一支前面（`elif`）[C20]。装法本身的规矩在 [patch 系统](ascend-patch-system.md)。
- **MoE 这道暗门**：进场方式是替换上游 `DPEngineCoreProc` 这个名字 [C37]，而上游只在 `data_parallel and vllm_config.model_config.is_moe` 时才构造 `DPEngineCoreProc`，非 MoE 的 DP rank 按 DP=1 处理 [C38]——dense 模型三道校验全过、启动不报错，但 `run_balance_load` 永远不会被调用。
- **计划何时算、何时用**：`run_balance_load` 挂在 `_has_global_unfinished_reqs` 返回真之后 [C18]——和均衡调度同一个位置、同一个理由（空转的 rank 也得参加集合通信）。本步末尾算出的计划，下一步 `schedule()` 开头由 `_apply_load_balance_modifications` 执行，一份只用一次 [S33]。`start_step` 比的是 `step_counter`，上游在一波请求跑完后把它清零 [C36]，所以 250 是每一波从头数 [D]。
- **跨 rank 的向量**：定长 int32，长 `2 × max_num_seqs + 2`——前 `2 × max_num_seqs` 格放块数（running 在前、可接纳的 waiting 在后，不足补 0），倒数第二格放 running 条数作分界，最后一格放「本步有没有新来的长请求」；缓冲区在 `_init_data_parallel` 里一次性分配，之后每步原地覆盖 [C15][C19]。本页那一帧 `max_num_seqs = 4`，DP1 报出去的是 `[1, 1, 1, 1, 64, 0, 0, 0, 4, 0]` [D]。
- **计划的格式**：`{"out_blk": [...], "in_blk": [...], "freeze": bool}`，`freeze` 的定义恰好就是 `len(in_blk) == 0`；返回前还会把同一 rank 里块数相同的一出一进两两抵消 [C14]。`_apply_load_balance_modifications` 拿 `out_blk` 的数字去 running 里找块数相同的那一条，拿 `in_blk` 去候选里找块数相同的那一条；`freeze` 为真时 `remaining_in` 直接置空 [C3]。
- **挑暂停对象的两轮优先级**：第一轮只挑 `getattr(r, "lb_newly_added", False)` 为真的。昇腾侧全仓、以及上游 vLLM v0.26.0 里，都没有任何地方给 `Request` 设过这个属性，所以第一轮永远空手，实际只剩第二轮「按 running 顺序谁先匹配上就是谁」[I]（main 配套的上游提交本地没有单独钉，这条只能说到 v0.26.0 为止）。注意 `_balance_load` 内部的 `_RequestItem["newly_added"]` 是另一回事，只在 planner 里用于打平 [C12]。
- **计划全权接管准入**：`_can_admit_waiting_request` 是「`_lb_admit_req_ids is None` 才放行一切」[C4]；有计划时它是一个具体集合，没被点名的请求在 waiting 循环里一律 `continue`。`prepare_dyntra_lb_step` 在报数之前先替候选拉远端 KV，上限 `2 × max_num_running_reqs − len(running)` 条——向量留 `2 × max_num_seqs` 格正是为它留的 [C6][C2]。
- **暂停与抢占**：`_lb_pause_request` 只把状态改成 `PREEMPTED`、记进 `_lb_paused_req_ids`、`prepend_request` 塞回队头，一个块都不释放；上游真正的抢占走 `_preempt_request`，它第一件事就是把 id 从这个集合里划掉 [C5]。
- **`bubble_threshold` 的两种单位**：`calc_bubble` 里 `if threshold < 1` 分岔——大于等于 1 时返回 `max − avg`（绝对块数差），小于 1 时返回 `(max − avg) / max` [C11]。官方参数表特意写明「`1` 表示一个 KV 块，不是 100%」[S31]。

### 会报什么错

- 启动校验按顺序连设五道 `ValueError` [C24]：
  - 同开 `enable_balance_scheduling`：`DyntraLB cannot be used with enable_balance_scheduling.`
  - `kv_transfer_config` 为空或 `kv_role` 不是 `kv_consumer`：`DyntraLB is only supported on PD-disaggregated D nodes ...`
  - `data_parallel_size <= 1`：`DyntraLB requires data_parallel_size > 1.`
  - `nnodes_within_dp > 1`：`DyntraLB only supports decoder instances that run on a single node ...`
  - 同开 `profiling_chunk_config`：`DyntraLB cannot be used with profiling_chunk_config.`
- 同一段注释写着 `Verified models: Qwen3-30B, Qwen3.5-35B`；本页的 Qwen3.6-35B-A3B 不在名单内，本页关于它的数字都是 [D]。
- `DyntraLBConfig` 自身的校验：`mode` 不在 `{"static", "dynamic"}`、`start_step < 0`、`end_step < -1`、`end_step` 设了却不大于 `start_step`、`bubble_threshold <= 0`、`long_req_block_threshold <= 0`、`dynamic_max_step <= 0`，各报一条 `ValueError`。
- `cache_config.block_size` 不是正整数：`RuntimeError: Invalid DyntraLB block size: ...`。
- **不报错的那种**：dense 模型上一切正常启动但均衡从不运行；`dyntra_lb_config` 写在 `additional_config` 顶层是配置错误。

### 开销和什么时候别开

- **每一步的集合通信**：生效期间每步一次 `all_gather`，每个 rank 传 `2 × max_num_seqs + 2` 个 int32；dynamic 模式在未激活时每步还有一次两个 int32 的 `all_reduce`。
- **「踢掉一条」的吞吐模型是写死的**：两边都换不动时走 `try_drop_for_throughput`——单步耗时按 `20000 + 19.2 × 这个 rank 的总块数` 估，吞吐取 `全组 running 条数 / 耗时`，踢掉谁之后吞吐更高就踢谁 [C13]。两个常数没有单位也没有注释。本页那一帧（DP0 131 块、DP1 67 块、全组 8 条）代进去 [D]：

  ```
  现在：          20000 + 19.2 × 131 = 22 515.2  →  8 / 22 515.2 = 3.553e-4
  踢掉 128 块那条：max(131 − 128, 67) = 67
                  20000 + 19.2 × 67  = 21 286.4  →  7 / 21 286.4 = 3.289e-4
  踢掉一条 1 块的：max(131 − 1, 67) = 130
                  20000 + 19.2 × 130 = 22 496.0  →  7 / 22 496.0 = 3.112e-4
  ```

  两个都比现在低，`best_drop` 为空，循环以「本轮既没换也没踢」退出 [C41]。这些常数按**块**计，块大小一变含义就跟着变：固定项 20000 相当于 `20000 / 19.2 ≈ 1042` 块，在块大小 2048 时约合 213 万 token [D]；而这个模型一条请求最多 128 块，只有一个 rank 上堆了大量长请求、总块数接近这个量级时，踢一条才可能划算。官方文档自己也把这套估算限定成「不是对每个模型、每种流量分布的延迟或吞吐保证」[S34]。
- **什么时候别开**：dense 模型（开了也不跑）；PD 混部或 P 节点（起不来）；块大、上下文上限短于 `long_req_block_threshold × block_size` 的模型又不改默认值时（dynamic 模式永远不激活，开了只多一次 `all_reduce`）[D]。
- 设计上它一条请求都不跨 rank 迁移，被暂停的请求以后还由同一个 rank 接着跑 [S30]；源 rank 的 KV 一直占着，所以它能缓解「一步要等最重的 rank」，缓解不了「某个 rank 显存被占满」。

### 版本差异

| | v0.23 | v0.26 | main |
|---|---|---|---|
| DyntraLB | 无 | 无 | 有 |

v0.23 维护分支和 v0.26 分支（2026-09-17 源码快照）上 `vllm_ascend/core/dyntra_lb_scheduler.py`、`patch/platform/patch_dyntra_lb_core.py`、`docs/source/user_guide/feature_guide/dyntra_lb.md` 三个路径 `git ls-tree` 全部为空，整仓 `git grep -i dyntra` 一条都搜不到；两个分支挑调度器那段代码里也只有 profiling-chunk、dynamic-batch、batch-job 这些分支，没有它 [C28][C29]。所以本页全篇讲的是 main，随时会变。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 块数怎么算 | `vllm_ascend/core/dyntra_lb_scheduler.py`，`get_dyntra_lb_request_block_num` |
| 计划落地、准入、暂停 | 同上，`_apply_load_balance_modifications`、`_can_admit_waiting_request`、`_lb_pause_request` |
| 候补 KV 预取 | 同上，`_run_lb_kv_prefetch`、`prepare_dyntra_lb_step` |
| planner | `vllm_ascend/patch/platform/patch_dyntra_lb_core.py`，`DyntraLBDPEngineCoreProc._balance_load` |
| 何时启动、何时关掉 | 同上，`add_request`、`run_balance_load` |
| 跨 rank 打包与 all_gather | 同上，`_init_data_parallel`、`_do_lb_allgather` |
| 引擎进程替换 | `vllm_ascend/patch/platform/patch_engine_core.py` |
| 配置项与默认值 | `vllm_ascend/ascend_config.py`，`DyntraLBConfig` |
| 启动校验 | `vllm_ascend/platform.py` |
| 官方说明 | `docs/source/user_guide/feature_guide/dyntra_lb.md` |
