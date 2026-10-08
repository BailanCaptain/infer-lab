---
id: recompute-scheduler
title: "RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算"
type: feature
summary: vllm-ascend 给 PD 分离 D 节点用的调度器。续块失败、要让出一条正在生成的请求时，先问连接器能否把它的 KV 存走：存得走就排回队首、稍后搬回；存不走就还掉全部块，以 stop_reason="recomputed" 结束，由代理把原问题接上已生成的内容重新发给一对 P/D，重算落在 P 上。GLM 双机主线不拆 P/D，不启用它，抢占走上游的本机重算。
aliases: [RecomputeScheduler, AsyncRecomputeScheduler, 重计算调度, recompute_scheduler_enable, recomputed, stop_reason recomputed, 退回 P 重算, D 节点抢占, update_state_before_preempt, RecomputeReqInfo]
chapters: ["12"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L700
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L280-L345
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L869-L880
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L970-L1056
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L138-L169
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L436-L440
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L55-L93
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L98-L134
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L161
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L702-L716
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L892-L900
  - vllm-ascend@db701c1f:docs/source/user_guide/configuration/additional_config.md#L81
  - vllm-ascend@db701c1f:docs/source/tutorials/features/long_sequence_context_parallel_multi_node.md#L312
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L295-L345
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L725
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L128-L146
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L576-L612
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/recompute_proxy.py#L33-L105
  - vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L144-L149
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L85-L166
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L352-L370
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L1024-L1036
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1014-L1044
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186
  - vllm-ascend@baa023ad:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L1165-L1180
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L295-L345
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L682-L723
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1280
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L484-L500
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L424-L440
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1175-L1181
  - vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L381-L384
  - vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L304-L310
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1255-L1302
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L129-L133
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L708-L710
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L689-L729
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L491-L505
  - https://github.com/vllm-project/vllm-ascend/pull/10742
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: pd-disaggregation, kind: builds-on, note: P、D、代理和状态交接在那一页；本页只讲 D 上块不够时被让出的请求去哪 }
  - { to: vllm-scheduler, kind: builds-on, note: 上游调度器怎样续块、抢占、本步禁新在那一页；本页只讲本调度器改了哪几处 }
  - { to: vllm-kv-block-allocation, kind: builds-on, note: 「借不到块」怎么判定、抢占时块怎样还回池子 }
  - { to: concurrent-requests, kind: builds-on, note: 主线满载时被抢占的一条还回多少块、本机重算几步，整批账在那一页 }
contradicts: []
updated: "2026-09-29"
origin: direct
---

## D 节点的块不够了，被让出的那条请求去哪？

**RecomputeScheduler 是 vllm-ascend 给 PD 分离里 D 节点用的调度器。D 上 KV 块不够、必须从正在生成的请求里让出一条时，它先问负责搬 KV 的连接器能不能把这条的 KV 存走：能，就存走、稍后搬回来接着生成；不能，就把这条的块全部还掉、当场结束它，在结束回复里打一个 recomputed 标记，由最前面负责转发的代理把「原问题 + 已生成的内容」重新发给一对 P/D，重算落在 P 上。**

[PD 分离](pd-disaggregation.md)把一条请求拆成两段：P 节点做 prefill，把整段提示词一次算完；D 节点做 decode，一个 token 一个 token 往下生成。KV 块是显存里一格格的存储，存每个位置算出的历史，见 [KV 块分配](vllm-kv-block-allocation.md)。连接器（KV connector）是 vLLM 里把 KV 搬进搬出的插件，代理（proxy）是 PD 部署最前面的转发服务。

场面是这样的：D 上同时在生成几十条回答，某条要借一块新块时池子空了，调度器只好从正在跑的请求（running 队列）里挑一条让出块，这叫抢占（preemption）。挑中的那条，问题 4 个 token，回答已经写出 2 个，它占的块要全部交出去。它接下来的去向：

```wiki-diagram
file: recompute-scheduler
```

被让出的请求有三种去向，图里都有：

- **在 D 本机从头重算**（最下面淡色那格）：排回等待队列（waiting）队首，等有了块，把「问题 + 已生成的回答」整段重新 prefill。这是 vLLM 通用[调度器](vllm-scheduler.md)的做法，开了本调度器的 D 不走它。
- **先存起来，等会儿搬回来**（③ 往左）：把它的 KV 搬到主机内存，重新排上时再搬回显存。这要另配一个能存 KV 的连接器，见 [Recompute CPU Offload](recompute-cpu-offload.md)。
- **退回 P 节点**（③ 往右，接着走 ④–⑦）：当场结束这条请求，D 上什么都不重算；代理收到标记后，把问题连同已生成的回答重新发给一对 P/D，P 重做 prefill，再把 KV 交给一台 D 接着生成。

本页的调度器在后两种里选：存得走就走第二种，存不走就走第三种。

## 为什么 D 节点不自己重算，退回 P 又要付什么？

**D 每一步的 token 上限是照 decode 定的，很小；在 D 上重做一次整段 prefill，很容易把显存撑爆（OOM），性能也会大受影响。退回 P 把这份重算挪回 P，代价是整段重算加一次重新交接，已生成的越长越贵。**

不用本调度器时，D 上被抢占的请求清零已算位置、排回 waiting，回来时从头重算，抢占的几个步骤见 [Scheduler](vllm-scheduler.md)。PD 分离下，D 第一次为这条请求分好接收的块之后，就把「状态在 P 那边」这个标记关掉了，P 的块也早已放掉，所以这份重算只能在 D 上自己做，见 [PD 分离的抢占一节](pd-disaggregation.md#抢占失败和超时怎么处理)。

这套机制的设计说明把 D 不适合重算的理由写得很直接：D 的每步 token 上限通常设成「同时在跑的条数 ×（1 + 草稿数）」，刚好够每条 decode 请求走一步；在这样的 D 上重做 prefill，很容易 OOM，性能也会大受影响。上限有多紧，拿示意数算一下：

```calc
title: D 上重做 prefill，每步能分到几个位置（示意）
D 的每步 token 上限 = 16 条 × (1 + 3 个草稿) = 64
其余 15 条 decode 先占 = 15 × (1 + 3) = 60
留给重做 prefill 的 = 64 − 60 = 4
重做 6,400 个位置要的步数 = 6,400 ÷ 4 = 1,600
> 调度器每步先续正在跑的请求，剩下的才给排回来的这条；关掉 chunked prefill 时，整段放不进余量，它根本排不上
```

退回 P 也不是免费的：

- **P 要重算整段。** 原来 P 只算问题本身；退回之后要算「问题 + 已生成的回答」。已生成的越长，这一遍越贵。
- **要再交接一次。** P 算完，要把这整段的 KV 再交给一台 D；第一次交接传过去的那份白传了。
- **中间有停顿。** 这条请求要重新排进 P 的队列，再排进 D 的队列；客户端看到的是输出停一会儿再接着出。
- **没有退回次数上限。** 示例代理不限重试次数，一条运气差的请求可以被一次又一次退回。退回得越频繁，吞吐越低，尾部延迟越长。

所以长问题多、主机内存又够的 D，应当同时配上能存 KV 的连接器，让大部分被让出的请求走「先存起来」那条路；两条路怎么比，见 [Recompute CPU Offload 的成本一节](recompute-cpu-offload.md#搬运与重算之间的成本)。

## 一次「退回 P」怎样走完？

**D 上只做两件事：还块，发一帧带 recomputed 标记的空结束回复。剩下的都在推理引擎外面：代理把已生成的文字接到原问题后面，把生成上限扣掉已生成的，再挑一对 P/D 发出去。**

还用上一节那条请求：问题 4 个 token，记作 p₀ p₁ p₂ p₃；回答已经送出 y₀ y₁ 两个 token；用户要求最多生成 10 个 token，走流式输出，每出一个 token 就往回推一帧。

1. **D 还块、结束。** 调度器发现这条的 KV 存不走，把它的块全部还回池子，记进一张「要退回」的名单。这一步收尾时，给它发一帧结束回复：结束原因写「停止」，没有新 token，只多一个 recomputed 标记。
2. **代理续上问题。** 代理一直在累积这条请求已经收到的文字。认出标记后，它把问题改成「原问题 + 已收到的文字」，也就是 p₀ p₁ p₂ p₃ y₀ y₁ 对应的那段文字，生成上限改成还剩多少。
3. **重新挑一对 P/D。** 改好的请求像一条新请求一样再走一遍 PD 流程：P 做 prefill，把 KV 交给 D，D 接着往下生成 y₂、y₃……
4. **客户端接着收。** 通过代理的客户端看到的是同一条流继续往下出，中间停顿了一下。

生成上限怎么扣，代码里多了一个加项：

```calc
title: 退回一次后，新的生成上限
流式时代理记下的帧数 = 2 帧回答 + 1 帧空的结束回复 = 3
新的生成上限 = 原上限 − 记下的帧数 + 退回次数 = 10 − 3 + 1 = 8
> 示例假设每帧正好 1 个 token：代理每收到一帧就记 1 个，那帧空的结束回复也被记上了，所以再加回退回次数，8 正好是 10 减去真正送出的 2 个。聊天格式的流式输出第一帧只带角色、不带 token，会多记 1 个；D 上开投机解码时一帧能带好几个 token，又会少记。这两种情况下新上限会偏小或偏大
```

这里有四处要留意：

- **每次接的都是最初的问题。** 代理手里一直留着原问题，每次退回都拿它接上到目前为止收到的全部文字，不会把上一轮拼过的问题再拼一遍，已生成的内容不会丢。
- **拼的是文字，不是 token 编号。** v0.23、main 和本站钉住的 GLM 源码快照（含 GLM 代码的那份 vllm-ascend）上，示例代理用字符串拼接，改好的问题要重新切 token；拼接处的切法、聊天模板、结构化输出和停止条件，都会让续写和不中断时不完全一样。设计说明还点明，按文字重拼问题时用不了 tool calling 和 function call，也会带来精度问题。v0.26 分支的代理改成按 token 编号续接，并核对历史有没有变，见文末版本差异。
- **聊天请求接在第一条消息后面。** 聊天格式的请求，代理把已生成的文字接到第一条消息的内容后面。多轮对话或带系统提示的请求，第一条往往不是用户这一轮的问题，接上的位置就错了。
- **不经代理、直连 D 的调用方，会把这一帧当成正常结束。** 回答被截断了，结束原因却是「停止」，没有任何报错；recomputed 标记是唯一的线索。

## 本调度器在上游之上改了哪几处？

**它整段复制了上游的调度函数。和被让出请求直接相关的改动有四处：续块失败时怎样处置被让出的那条；这一步退回过请求，也不再接新请求；D 上投机解码的形状补齐；远端 KV 收完后的一处夹值。此外，调度函数里还改了混合模型的前缀命中，开关本身又牵动 worker 端两处行为；只有 D 节点能开它。**

上游怎样逐条续块、借不到时怎样从 running 队尾抢占、这一步抢占过就不再接纳 waiting，见 [Scheduler](vllm-scheduler.md) 和 [KV 块分配的抢占一节](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。下面只讲本调度器新增的职责。

**岔路口。** 在上游抢占的同一个位置，本调度器先看自己是不是 D：配了 KV 传输、角色又不是 P。是的话：

1. 从 running 队尾取一条。v0.23、v0.26 和 GLM 快照在这里写死取队尾，不看调度策略；main 改成先按上游策略挑。
2. 问连接器：这条能不能存走？把它的块号和已算位置数一起交过去。
3. 连接器说能：记一条「被抢占、块号、已算位置」交给连接器去存，再照上游流程抢占，还块、清零、排回队首。怎么存、什么时候搬回，由连接器负责，见 [Recompute CPU Offload](recompute-cpu-offload.md)。
4. 连接器说不能，或者根本没有这个接口：还掉它的全部块，把请求编号、已生成的 token 和它属于哪个前端记进退回名单；这一步收尾时，按名单逐条发出 recomputed 结束帧。

**本步禁新。** 上游规定这一步只要抢占过，就不再从 waiting 接新请求；本调度器把「退回过」也算进来。刚腾出来的块不会马上被新请求占走，先留给 running 里的请求。

**投机解码的形状补齐。** [投机解码](speculative-decoding.md)每步除了 1 个确定的 token，还带几个草稿 token 一起验证。D 想用预先录好的整图（full graph）跑 decode，就要每条请求每步的位置数固定为 1 + 草稿数。刚从 P 交接过来的请求第一步还没有草稿，形状对不上，就会掉回逐个算子执行的慢路径。v0.23 和 GLM 快照在请求进来时先塞满占位草稿，条件是请求长度加草稿数不超过模型允许的最大长度；v0.26 和 main 改成在排这一步时直接补成 1 + 草稿数。

**远端 KV 收完后夹一下。** 请求的 KV 从 P 或主机内存收完后，要把「已算位置数」更新成收到的数。收回的位置数有可能超过请求的实际长度，本调度器直接取两者中较小的那个，再照上游规则处理：收满了就退回 1 格，留最后一个位置这一步重算，好采样出下一个 token，交接点停在哪见 [PD 分离](pd-disaggregation.md#交接点停在哪个位置)。v0.23 和 GLM 快照上，被抢占过、从主机内存搬回来的请求，这时再补一次占位草稿；v0.26 只留夹值、不补占位；main 不再塞占位草稿，这处改写整个去掉了。

**混合模型的前缀命中按组算。** v0.23、GLM 快照和 v0.26 上，D 遇到带 Mamba 类层的混合模型（GLM 的 KDA 层属于这类），而且块管理器开着前缀缓存时，本地前缀命中改成按缓存组各算各的。上游的做法是各组命中长度取最小值：D 上 Mamba 类组本地没有可复用的状态，命中是 0，一取最小值，full attention 组已经缓存在 D 上的块也被算成没命中，只好再从 P 传一遍。按组算以后，这部分块不用重传。main 上没有这处改写。

**开关还牵动 worker 端两处行为（四个钉点都有）。** 一是 KV 收完、已算位置停在「提示词长度 − 1」的那一步，worker 整理 attention 输入时按 decode 归类，不当成 prefill。二是 MoE 模型在只收 KV 的节点上，decode 要走 [MC2](expert-parallel.md#mc2-还是-allgather) 时，开了本调度器就跳过 DP 组之间对齐 token 数的那次 all-reduce（对齐是什么见[并发页](concurrent-requests.md#再补到两组的最大值)），各组按自己的 token 数跑，MC2 改按全局上限配置。

**只有 D 节点能开。** 在 P 上开会被就地关掉，在不拆 P/D 的部署上开会报错起不来，开了[异步调度](async-scheduling.md)就用它的异步版本；[细粒度 TP](fine-grained-tp.md) 的 attention 输出投影、词表嵌入两项反过来要求必须开它。具体检查和报错见文末「会报什么错」。

## 放到 GLM 双机：主线不启用它

**GLM 双机主线的两台机器合起来是一套 P、D 不分的服务，没配 KV 传输，本调度器的开关保持默认关；真打开会在启动时报错。所以主线上的抢占走上游那条路：在本机从头重算。**

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。官方教程没有传额外的昇腾配置，细粒度 TP 那两项都是默认 0，上一节那条硬依赖也不触发。主线的 prefix caching 也关着，块管理器用的是不带前缀缓存的那一种，上一节「混合模型的前缀命中按组算」那条分支进不去。

主线的抢占有多贵，整批账在[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)：DP0 跑满 32 条、每条走到约 67,000 个位置时池子用光，被抢占的那条一次还回 120–121 块，每卡约 956–964 MiB，却要在本机重算约 9 步；prefix caching 关着，没有可复用的前缀，34 层 KDA 状态也随块丢掉。本调度器要从 D 上挪走的，就是这类重算。

如果把这两台机器拆成一 P 一 D，[PD 分离页](pd-disaggregation.md#把这两台机器拆成一-p-一-d)按同一组显存假设算过：每个实例只剩 8 张卡，D 每卡的块数不到主线的一半，池子更小，抢占会来得更早。这时在 D 上开本调度器：

- 被让出的那条照样一次还掉全部块，KDA 状态也一起还；区别是 D 不再做那几步 prefill，而是结束请求、交给代理，由 P 重算「问题 + 已生成」整段，再交接一次。
- GLM 用 MTP 给投机解码出草稿，D 上的占位草稿、收完 KV 那一步按 decode 归类，这两处都对它生效。
- 跳过 DP 组间 all-reduce 那一条不触发：按 PD 分离页的结论，拆开后每个实例只有 EP8，MoE 用不上 MC2。
- 拆开以后抢占在多长时触发、P 重算要几步、重新交接传多少字节，底稿没有这套部署形状的数。待核：1P1D 的块池大小与交接字节。

## 常见误解

- **「它自己会在 D 上重算 prefill」**——不会。它在 D 上一个位置都不重算，只负责还块、结束请求、打标记；重算发生在 P 上，前提是前面挂着认这个标记的代理。名字里的「重算」说的是 P 要做的事。
- **「开了它，被抢占的请求就不会丢 KV」**——反了。只开它、不配能存 KV 的连接器时，被让出的请求 KV 全部还掉；想不丢，要另配 [Recompute CPU Offload](recompute-cpu-offload.md)，连接器回答「能存」，才会走排回队首那条路。
- **「在 P 上也写上它，会报错拦住」**——官方参数文档说在 P 上或混部时开它会启动失败；代码里 P 上只打一条警告、就地关掉，只有混部和没配 PD 才真的报错。文档和代码不一致，以代码为准。
- **「退回后的输出和不中断时逐 token 一样」**——除 v0.26 分支外，示例代理拼的是文字，重投时要重新切 token，续写不保证逐 token 一致；带 tool calling / function call 的请求按文字重拼后用不了这些调用。
- **「KV 传输失败时的『重算』策略就是它」**——不是一回事。KV 从 P 读失败时，vLLM 可以选「失败」或「重算」，后者是在 D 上补算没读成的位置，见 [PD 分离的失败处理](pd-disaggregation.md#抢占失败和超时怎么处理)；本页是块不够时把整条请求退回 P。昇腾上 GLM 这类混合模型还不许选那种「重算」策略，启动时断言拦下。

## 对照源码

### 怎么开

```bash
# 只写在 D 节点上。kv-transfer-config 的完整写法见 PD 分离那一页
--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer", ...}'
# v0.23 / GLM 快照：顶层键
--additional-config '{"recompute_scheduler_enable": true}'
# v0.26 / main：推荐写进 scheduler_config（顶层写法仍认，已标弃用）
--additional-config '{"scheduler_config": {"recompute_scheduler_enable": true}}'
```

- 开关 `recompute_scheduler_enable` 默认 `false`；四个钉点上 `vllm_ascend/core/recompute_scheduler.py` 都在。GLM 快照在 `ascend_config.py` 读顶层键。官方教程（`long_sequence_context_parallel_multi_node.md` L312）对它的说明是：D 上 KV cache 不够时，请求送回 P 重算。引入存走路径的 PR #10742（commit 6329838c9，v0.23、v0.26、main 的历史里都有；db701c1f 是 orphan，内容相同）写明了 D 不宜自己重算的理由：D 的 `max_num_batched_tokens` 通常设成 `max_num_seqs × (1 + num_spec_tokens)`，在 D 上重做 prefill 很可能 OOM、性能大受影响；原来的退回做法重组 prompt 时用不了 tool calling / function call，也会带来精度问题 [C40]。
- 平台门 [C1]：只有 `kv_role == "kv_consumer"` 才把 `vllm_config.scheduler_config` 整个换成 `RecomputeSchedulerConfig`，由它按 `async_scheduling` 在 `RecomputeScheduler` / `AsyncRecomputeScheduler` 之间挑；P 上和不拆 PD 时怎样处理，以及细粒度 TP 的反向依赖，见下一节。
- 岔路口 [C2]：`schedule()` 里 `allocate_slots` 返回 `None` 的 `while True`，条件是 `kv_transfer_config` 存在且 `not is_kv_producer`。钩子 `update_state_before_preempt(req, block_ids, num_computed_tokens)` 返回真 → 记 `PreemptedRequestData`，再走上游 `_preempt_request` [C24]；返回假或连接器没有这个钩子 → `kv_cache_manager.free()`，记 `RecomputeReqInfo(request_id, output_token_ids, client_index)`。
- 为什么要整段复制上游的 `schedule()`：main 上 `RecomputeScheduler` 的类注释写明，保留本地副本只是为了给第一条 decode 请求补齐投机解码形状、让昇腾整图对得上；抢占的 KV 能卸就卸，卸不掉才送回 P 重做 prefill。
- 本步禁新 [C6]：`if not preempted_reqs and not recomputed_reqs and ...` 才进 waiting 循环。
- 结束帧：`update_from_output()` 对 `recomputed_reqs` 逐条发 `EngineCoreOutput(finish_reason=FinishReason.STOP, new_token_ids=[], stop_reason="recomputed")`。
- 占位草稿 [C8]：`is_mtp_kv_consumer`（有 `speculative_config` 且 `kv_consumer`）为真、且 `max_model_len >= num_tokens + num_spec_tokens` 时，`add_request` 把 `spec_token_ids` 填成 `PLACEHOLDER_TOKEN_ID`。
- 远端 KV 收完 [C5]：先 `min(num_computed_tokens, num_tokens)`，收满再减 1（减 1 是上游原有 [C25]）；`num_preemptions > 0` 且没有草稿时补占位。
- 代理 [C4]：`stop_reason == "recomputed"` → `retry = True`；`prompt` 或 `messages[0]["content"]` 改成 `origin_prompt + generated_token`；`max_tokens = origin_max_tokens - completion_tokens + retry_count`，流式时 `completion_tokens` 按帧加 1；`reassign_instances` 重新挑 P/D。外层 `while retry:` 没有次数上限，`args.max_retries` 管的是单次连接的网络重试。

### 会报什么错

- **启动报错**：没有 `kv_transfer_config`，或 `kv_role` 不是 `kv_consumer` → `ValueError: recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...`。
- **不报错、就地关掉**：P 节点上只打 warning「recompute_scheduler_enable is ignored on PD-disaggregated P nodes」。官方参数表写的是启动失败 [C12]，与代码不一致 [!]。
- **启动断言**：`finegrained_tp_config` 的 `oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 而没开本调度器 → `AssertionError`，信息说跨 DP 的 HCCL 集合通信需要各 DP rank 的 `num_tokens` 一致 [C9]。
- **运行时只有日志**：退回 P 的那一路先打一条 info「Recompute preemption falls back without offload for request %s, computed_tokens=%d.」，收尾发帧时再打一条 warning「[RecomputeScheduler] Recompute triggered for request %s.」；存走的那一路打 info「Recompute preemption offload enabled ...」。客户端收到的是正常结束，没有错误码。
- **名字相近、与本页无关**：混合模型把 `kv_load_failure_policy` 设成 `recompute` → `AssertionError: Hybrid models do not support recompute mode kv load failure policy now.` [C11]。

### 开销和什么时候别开

- 代价：P 重新 prefill「问题 + 已生成」全长，外加一次完整的跨节点 KV 交接；已生成越长越贵 [D]。长问题多、主机内存够的 D，同时配 [Recompute CPU Offload](recompute-cpu-offload.md)，让大部分被让出的请求走存走那一路。
- 必须挂一个认 `stop_reason="recomputed"` 的代理，官方示例是 `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`。直连 D 的调用方会把这一帧当成正常结束：输出截断，`finish_reason` 却是 `stop` [D]。
- 聊天请求接在 `messages[0]` 后面；多轮或带 system 消息的请求接错位置 [D]。v0.26 分支改成按 token 编号续接 [C18]，其余钉点都是字符串拼接。
- 同时开别的调度器变体会让它悄悄失效 [C10]：GLM 快照的平台先按本开关换好 `scheduler_config`，紧接着 `SLO_limits_for_dynamic_batch != -1` 或 `profiling_chunk_config.enabled` 会直接改写 `scheduler_cls`，两者之间没有互斥校验，也没有 warning。v0.26 上 `profiling_chunk_config`、`batch_job_sched_config` 同样排在后面改写；main 上这两项在 `_setup_worker_and_scheduler` 里改写，DyntraLB 是例外，会和本调度器组合成专门的类 [C29]。
- 不拆 P/D 的部署（包括 GLM 双机主线）不要开：启动直接 `ValueError`。

### 版本差异

| 项 | v0.23 维护分支 2c59ff10 | GLM 快照 db701c1f | v0.26 分支 2ed6cbba | main baa023ad | 意味着什么 |
|---|---|---|---|---|---|
| 存不走之后怎么收尾 | 只调 `kv_cache_manager.free()`，不走结束流程，请求仍留在调度器的请求表里 [C14] | 同 v0.23 | `_finish_recomputed_request()` → `finish_requests(FINISHED_ABORTED)` [C16] | 同 v0.26 | 前两列上这条请求在引擎侧没有被正式结束，只有客户端那边结束了 [!] |
| 钩子抛异常 | 没有 try/except | 同 v0.23 | 同 v0.23 | try/except 兜住，warning 后退回 P [C20] | 连接器出错时，前三列会让这一步直接抛异常 |
| 让出哪一条 | D 分支写死 `self.running.pop()` | 同 v0.23 | 同 v0.23 | 先按上游策略挑（`PRIORITY` 下取 `max(priority, arrival_time)`），再决定存走还是退回 [C21] | 开了优先级调度的 D，前三列让出的不一定是最该让的那条 [I] |
| 开关键写在哪 | 只认顶层 | 只认顶层 | 顶层与 `scheduler_config` 嵌套都认，嵌套优先，顶层标弃用 [C19] | 同 v0.26 | 嵌套写法抄到前两列上读不到，开关仍是 `false` |
| P 上关掉后写回配置 | 写回 `additional_config` [C15] | 不写回 | 写回 | 写回 | GLM 快照上 worker 进程重建配置时读到的仍是 `true` [I]，影响未核 |
| 投机解码形状补齐 | `add_request` 塞 `PLACEHOLDER_TOKEN_ID` | 同 v0.23 | `schedule()` 里 `pad_spec_decode` 补成 `1 + num_spec_tokens` [C17] | 同 v0.26 | 实现换了、目的没换：让 D 上 decode 步形状固定，整图才对得上 |
| 远端 KV 收完后的改写 | 夹值，被抢占过的请求补占位 | 同 v0.23 | 只夹值，不补占位 | 不改写，用上游原样 | main 上这处改写和占位草稿一起去掉了 |
| 混合模型前缀命中按组算 | 有 | 有 | 有 | 没有 | 只在 D 端、带 Mamba 类层、开着前缀缓存时才生效 |
| 代理怎么续接 | 字符串拼到 `prompt` / `messages[0]["content"]` | 同 v0.23 | `prompt_token_ids + output_token_ids` 按 token 编号续接，历史对不上就报错 | 字符串拼接，`content` 为列表时追加一段文本 | 只有 v0.26 分支保证续接前后 token 历史一致 |
| 装出来几个类 | 2 个 | 2 个 | 2 个 | 4 个，和 [DyntraLB](dyntra-lb.md) 交叉，由 `_get_recompute_scheduler_cls` 挑 [C22] | main 上 DyntraLB 可和本调度器同开；前三列没有 DyntraLB |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 岔路口（续块失败时怎样处置被让出的那条） | `vllm_ascend/core/recompute_scheduler.py`，`schedule()` 里 `allocate_slots` 的 `while True`（GLM 快照 L280–L345） |
| 上游被替换的那条抢占 | `vllm/v1/core/sched/scheduler.py`，`_preempt_request`（v0.23.0 L974–L995） |
| 本步禁新 | `recompute_scheduler.py` L438 |
| recomputed 结束帧 | `recompute_scheduler.py`，`update_from_output()`（L869–L880） |
| 占位草稿 | `recompute_scheduler.py`，`__init__` 与 `add_request`（L98–L134） |
| 远端 KV 收完后的夹值 | `recompute_scheduler.py`，`_update_waiting_for_remote_kv`（L138–L169） |
| 三道门与挑类 | `vllm_ascend/platform.py`（GLM 快照 L680–L700；main L1014–L1044） |
| 开关与细粒度 TP 的硬依赖 | `vllm_ascend/ascend_config.py`（GLM 快照 L142–L161） |
| 代理认标记、重投 | `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`（GLM 快照 L970–L1056） |
| v0.26 按 token 续接 | `vllm_ascend/patch/recompute_proxy.py`（L33–L105） |
| 混合模型按组算前缀命中 | `recompute_scheduler.py` L484–L500；为什么这样改见 `vllm_ascend/patch/__init__.py` L424–L440；前缀缓存关着时用的是不带前缀缓存的块管理器：`vllm/v1/core/kv_cache_coordinator.py` L689–L729、昇腾 `patch/platform/patch_kv_cache_coordinator.py` L491–L505 |
| 收完 KV 那一步按 decode 归类 | `vllm_ascend/utils.py` 的 `is_pd_decode_recompute_scheduler_enabled`（L1175–L1181）；用处在 `attention/utils.py` L381–L384、`worker/pcp_utils.py` L304–L310 |
| 跳过 DP 组间 all-reduce | `vllm_ascend/utils.py` 的 `should_skip_allreduce_across_dp_group`（L1255–L1302）；用处在 `ops/fused_moe/token_dispatcher.py` L129–L133、`worker/model_runner_v1.py` L708–L710 |
