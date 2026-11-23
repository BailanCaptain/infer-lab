---
id: recompute-scheduler
title: RecomputeScheduler：D 节点块不够时，被让出的请求退回 P 重算
type: feature
summary: >-
  PD 分离的 D 节点续块失败时，优先把被抢占请求的状态保存到主机内存，稍后恢复；无法保存时发 recomputed 结束帧，由代理重投 P 节点重做 prefill。客户端结束、引擎收尾与状态保存是不同步骤；v0.30.0 与 main 启用细粒度 TP 时保存失败直接中止。
aliases:
  - RecomputeScheduler
  - AsyncRecomputeScheduler
  - 重计算调度
  - recompute_scheduler_enable
  - recomputed
  - stop_reason recomputed
  - 退回 P 重算
  - D 节点抢占
  - update_state_before_preempt
  - RecomputeReqInfo
chapters:
  - '12'
order: 50
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L280-L345'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L869-L880'
  - >-
    vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L970-L1056
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L138-L169'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L436-L440'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L55-L93'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L98-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L142-L161'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L702-L716'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L892-L900'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/configuration/additional_config.md#L81
  - >-
    vllm-ascend@db701c1f:docs/source/tutorials/features/long_sequence_context_parallel_multi_node.md#L312
  - 'vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L295-L345'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L725'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L128-L146'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L576-L612'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/recompute_proxy.py#L33-L105'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L144-L149
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L85-L166'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L352-L370'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L1024-L1036'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1014-L1044'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2154-L2186'
  - >-
    vllm-ascend@baa023ad:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L1165-L1180
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L295-L345'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L682-L723'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1280'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L484-L500'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L424-L440'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1175-L1181'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L381-L384'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L304-L310'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1255-L1302'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L129-L133'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L708-L710'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L689-L729'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L491-L505
  - 'https://github.com/vllm-project/vllm-ascend/pull/10742'
  - >-
    raw:sha256-57612b2ec822e3076037e0ac4337f65f295e6e8d1c99f1dc325c6add4171929b.md#L1-L1184
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L118-L155'
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L348-L370'
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L165-L178'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1109-L1151'
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L638-L662'
  - 'vllm-ascend@7d825229:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L1170-L1193'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L322-L346'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1175-L1197'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1304-L1361'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1250-L1307'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1164-L1227'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L822-L830'
  - 'vllm-ascend@7d825229:vllm_ascend/core/recompute_scheduler.py#L1045-L1057'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1570-L1581'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L610-L627'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1645-L1680'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1371-L1398'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L101-L126'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1116-L1157'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1380-L1408'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/recompute_scheduler.py#L135-L180'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/recompute_scheduler.py#L1018-L1035'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1288-L1330'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1586-L1630'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/recompute_scheduler.py#L155-L200'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/recompute_scheduler.py#L1032-L1050'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: P、D、代理和状态交接在那一页；本页只讲 D 上块不够时被让出的请求去哪
  - to: vllm-scheduler
    kind: builds-on
    note: 上游调度器怎样续块、抢占、本步禁新在那一页；本页只讲本调度器改了哪几处
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 「借不到块」怎么判定、抢占时块怎样还回池子
  - to: concurrent-requests
    kind: builds-on
    note: 主线满载时被抢占的一条还回多少块、本机重算几步，整批账在那一页
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-57612b2ec822e3076037e0ac4337f65f295e6e8d1c99f1dc325c6add4171929b.md
  - >-
    raw/sha256-8e4168544d26b0389243021ed8d239f503362b21667c412fd23f032438111bbf.md
---

## D 节点的块不够了，被让出的那条请求去哪？

**`RecomputeScheduler` 用于 PD 分离部署中的 D 节点。** 当 D 节点的 KV 块不够续借时，它不再硬挤本机 decode 预算重算，而是优先把被让出请求的状态保存到主机内存、稍后恢复；保存不了时，普通路径把请求退回 P 节点重做 prefill，`v0.30.0` 与 `main` 启用细粒度 TP 分片时则直接中止请求。

先把四个前置词对上：

- **[PD 分离](pd-disaggregation.md)**把一条请求拆给两组实例：P 节点专做 prefill（可分多步处理提示词），D 节点接过历史继续 decode（普通自回归逐个生成 token，投机解码还会同步验证候选）。
- **KV 块**是显存里一格格的存储，保存历史状态，见 [KV 块分配](vllm-kv-block-allocation.md)。
- **连接器**（KV connector）是 vLLM 里把 KV 搬进搬出的插件；**代理**（proxy）是 PD 部署最前面的转发服务。
- **抢占**（preemption）：D 上同时在生成几十条回答，某条续借新块时池子空了，调度器只好从正在跑的请求（`running` 队列）里挑一条让出它的全部 KV 块。

先记住两条工程底线：保存接口答应接单，不等于字节已经从显存搬完；客户端收到结束帧，也不等于引擎完成了全部收尾。两条恢复路线也各付各的账：保存占主机内存与拷贝停顿，退回 P 则增加重新排队、长输入重算与再次交接。

看一个标准示意场景：被挑中的请求原本问题有 4 个 token，回答已经写出 2 个，它占用的 KV 块必须全部交出去。下图把 `v0.30.0` / `main` 下 D 节点续块失败后的三路分流全景，与普通上游调度器的本机重算放在一起对照：

```wiki-diagram
file: recompute-scheduler-fig-d-exhaustion
```

顺着图中的三路分流与底部对照，被让出的请求一共有四类去向：

- **路线 A · 先存到主机内存，排回来再搬回**：调度器调用 `update_state_before_preempt()` 询问连接器。主机空闲块足够时，连接器把该请求的 KV 搬到主机内存、交还显存块并排回等待队首，稍后恢复免重算。这需要另配能存 KV 的连接器（`v0.30.0` 与 `main` 为 `PreemptOffloadConnector`），见 [Recompute CPU Offload](recompute-cpu-offload.md)。
- **路线 B · 退回 P 节点重做 prefill**：连接器拒绝保存或未配置卸载器时，D 正式结束引擎请求、归还块并发送带 `recomputed` 标记的结束帧，不在本地重做这段 prefill。代理认出标记后，把「原问题 + 已生成内容」重投给 P，再由 P 把状态交给 D 继续。
- **路线 C · 细粒度 TP 保存失败直接中止**（`v0.30.0` / `main` 新增分支）：当 `oproj` 或 `mlp` 的细粒度 TP 实际分片大于 1 时，启动即强制要求配置 `PreemptOffloadConnector`。运行时保存失败不再降级退回 P，而是直接把请求置为 `FINISHED_ABORTED`。
- **对照 · 在 D 本机恢复计算**（底部对照条）：未开启 `RecomputeScheduler` 时，通用[调度器](vllm-scheduler.md)会清零进度、排回等待队首，再查可用缓存。没有可复用状态时，请求只能在 D 本机紧缩的 decode 预算里硬挤重算「问题 + 已生成回答」。

## 为什么 D 节点不自己重算，退回 P 又要付什么？

**D 节点通常按 decode 设置较小的每步 token 预算，在本地重做长 prefill 会挤占极多步数、拖垮同批请求。** 退回 P 可以把输入处理送回专为 prefill 配置的节点，代价是重新排队、处理变长的组合输入，以及再次跨机交接状态。至于本机重算是否一定会 OOM，仍取决于模型、执行形状和内存配置，不能仅凭预算小直接断言。

通用调度器在抢占时会清零已算位置并排回 `waiting`，恢复时仍可能命中本地或外部缓存；只有没有可用副本时才需重算，步骤见 [Scheduler](vllm-scheduler.md)。首次 PD 交接完成后，不能假设 P 还为这条请求保留着原块或会自动重新 prefill；再次交给 P 必须由代理重投，见 [PD 分离的抢占处理](pd-disaggregation.md#抢占失败和超时怎么处理)。

这套机制的设计说明把 D 不适合重算的理由写得很直接：D 的每步 token 上限通常设成「同时在跑的条数 ×（1 + 草稿数）」，刚好够每条 decode 请求走一步；在这样的 D 上重做 prefill，很容易 OOM，性能也会大受影响。

下面用一组示意数衡量预算有多紧：设并发 16 条请求、每条带 3 个草稿，其余 15 条 decode 持续占满 60 个位置且无缓存命中；关闭 chunked prefill 时，整段放不进余量甚至无法在当前步接纳。这些数字仅用于展示步数放大效应，不代表任意负载的实际耗时：

$$N_{\text{steps}} = \frac{6{,}400}{64 - 60} = 1{,}600\text{ 步}$$

| D 上重做 prefill 的余量核算（示意数：16 条、3 个草稿） | 算式 | 结果 |
| --- | --- | --- |
| D 的每步 token 上限 | $16 \times (1 + 3)$ | **64** |
| 其余 15 条 decode 占用 | $15 \times (1 + 3)$ | **60** |
| 每步剩余可用额度 | $64 - 60$ | **4 个位置/步** |
| 重做 6,400 个位置所需步数 | $6{,}400 \div 4$ | **1,600 步** |

退回 P 也不是免费的：

- **P 处理的输入变长。** 原来只有问题，退回后包含已生成回答；没有可复用前缀时需重算全段，有命中时可省去相应部分。
- **要再次交接。** P 处理后重新向 D 交付所需状态；已有兼容缓存可减少具体传输量，不能把第一次交接说成从未有用。
- **中间有停顿。** 这条请求要重新排进 P 的队列，再排进 D 的队列；客户端看到的是输出停一会儿再接着出。
- **没有退回次数上限。** 示例代理不限重试次数，一条运气差的请求可以被一次又一次退回。退回得越频繁，吞吐越低，尾部延迟越长。

长输入多、主机内存足够时，可以评估保存路线；是否能让多数抢占通过保存恢复，还取决于模型支持、主机容量、传输速度与请求分布。比较方法见 [Recompute CPU Offload 的成本](recompute-cpu-offload.md#搬运与重算之间的成本)。

## 一次「退回 P」怎样走完？

**D 上只做两件事：还块，发一帧带 `recomputed` 标记的空结束回复。** 剩下的都在推理引擎外面完成：代理把已生成的文字接到原问题后面，把生成上限扣掉已生成的部分，再挑一对 P/D 发出去。

还用上一节那条示意请求：问题 4 个 token，记作 $p_0, p_1, p_2, p_3$；回答已经送出 $y_0, y_1$ 两个 token；用户要求最多生成 10 个 token，走流式输出，每出一个 token 就往回推一帧。

1. **D 还块、发结束帧。** 调度器发现连接器不接受保存，先结束该引擎请求、还掉 KV 块并记入退回名单。本步收尾发出 `STOP`、无新 token、带 `recomputed` 标记的回复。
2. **代理续上问题。** 代理一直在累积这条请求已经收到的文字。认出标记后，它把问题改成「原问题 + 已收到的文字」，即 $p_0, p_1, p_2, p_3, y_0, y_1$ 对应的文本，并重算剩余生成上限。
3. **重新挑一对 P/D。** 改好的请求像一条新请求一样再走一遍 PD 流程：P 做 prefill，把 KV 交给 D，D 接着往下生成 $y_2, y_3, \dots$。
4. **客户端接着收。** 示例代理在重投成功时保持同一个外部流继续输出，中间会有停顿；这不保证重投前后的分词、生成轨迹或计数完全等同于不中断运行。

生成上限怎么扣，代码里多了一个加项：代理每收到一帧就记 1 个，那帧空的结束回复也被记上了，所以要再加回退回次数。下面先假设流式输出每帧正好携带 1 个 token：

$$\text{max\_tokens}' = \text{max\_tokens}_0 - N_{\text{chunks}} + N_{\text{retry}} = 10 - 3 + 1 = 8$$

| 退回一次后的新生成上限核算（原上限 10，已出 2 token） | 算式 | 结果 |
| --- | --- | --- |
| 流式时代理记下的帧数 | $2\text{ 帧回答} + 1\text{ 帧空结束回复}$ | **3 帧** |
| 新的生成上限 | $10 - 3 + 1$ | **8**（正好等于 $10 - 2$） |

```wiki-diagram
file: recompute-scheduler-fig-proxy-retry
```

**边界与例外**：

- **帧数与 token 数不等时的偏差**：聊天格式流式输出第一帧若只带角色、不带 token，代理会多记 1 个导致新上限偏小；D 开投机解码、一帧带多个 token 时又会少记，导致新上限偏大。
- **每次接的都是最初的问题**：代理手里一直留着原问题，每次退回都拿它接上到目前为止收到的全部文字，不会把上一轮拼过的问题再拼一遍，已生成的内容不会丢。
- **拼的是文字，不是 token 编号**：`v0.30.0`、`main` 与早期的 `v0.23.0` 示例代理都用字符串拼接，改好的问题要重新切 token。拼接处的切法、聊天模板、结构化输出和停止条件，都会让续写结果与不中断时不完全一样；设计说明还点明，按文字重拼时用不了 tool calling 和 function call，也会带来精度问题。`v0.26.0rc` 分支的代理改为按 token 编号续接并核对历史是否变化，详见文末版本差异。
- **聊天请求接在第一条消息后面**：聊天格式的请求，示例代理把已生成的文字接到第一条消息的内容后面。多轮对话或带系统提示的请求，第一条往往不是用户这一轮的问题，接上的位置就会出错。
- **直连 D 的调用方会把这一帧当成正常结束**：不经代理时，回答被截断了，结束原因却是 `stop`，没有任何报错；`recomputed` 标记是唯一的线索。

## 本调度器在上游之上改了哪几处？

**它整段复制了上游的调度函数。** 和被让出请求直接相关的改动集中在三处：续块失败时的处置分流、退回后本步禁止接纳新请求，以及 D 节点上投机解码的形状补齐；只有 D 节点能开启它。

上游怎样逐条续块、借不到时怎样从 `running` 队尾抢占、这一步抢占过就不再接纳 `waiting`，见 [Scheduler](vllm-scheduler.md) 和 [KV 块分配的抢占一节](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。下面按 `v0.30.0` / `main` 主线讲清本调度器新增的职责：

**岔路口。** 在上游抢占的同一个位置，本调度器先看自己是不是 D：配了 KV 传输、角色又不是 P。是的话按四步走：

1. **选出待让出请求。** 先检查连接器的 pending frees 与候选块能否即时释放；拿不到即时可用块就停止本轮抢占，否则按上游调度策略（支持 `PRIORITY`）挑出请求。
2. **询问连接器能否存走。** 把这条请求的块号和已算位置数一起交给 `update_state_before_preempt()`；若该钩子抛出异常，直接捕获并按保存失败处理。
3. **连接器接受保存**：记一条「被抢占、块号、已算位置」交给连接器去存，再照上游流程抢占——还块、清零、排回队首。怎么存、什么时候搬回，由连接器负责，见 [Recompute CPU Offload](recompute-cpu-offload.md)。
4. **连接器拒绝保存或无此接口**：普通路径先正式结束引擎请求、还掉全部块，再把请求编号、已生成 token 和前端索引记进退回名单，本步收尾时逐条发出 `recomputed` 结束帧。若 `oproj` 或 `mlp` 的细粒度 TP 实际分片大于 1，则不降级退回 P，直接置为 `FINISHED_ABORTED`。

放回[一条请求的七站](one-request.md)，分支发生在第 2 站；退回名单要到第 6 站更新结果时才变成输出，最后由代理决定是否发起新请求。被退回的请求不会在这一轮再做一次前向。

```wiki-diagram
file: recompute-scheduler-flow
```

**本步禁新。** 上游规定这一步只要抢占过，就不再从 `waiting` 接新请求；本调度器把「退回过」也算进来。刚腾出来的块不会马上被新请求占走，先留给 `running` 里的请求。

**投机解码的形状补齐。** [投机解码](speculative-decoding.md)每步除了 1 个确定的 token，还带几个草稿 token 一起验证。D 用预先录好的整图（full graph）跑统一宽度的 decode 时，需要匹配 `1 + 草稿数` 的形状。刚从 P 交接过来的请求还没有草稿，形状不匹配会影响该整图路径，具体回退方式由运行模式决定。调度时，若请求有静态草稿、需要采样、仅差 1 个位置且本步尚未排 prefill，调度器会尝试补成 `1 + 草稿数` 并为采样位留出空间；长度不够时保留原来的 1 个位置继续排，长度够但补齐后超过本请求预算才停止本次接纳。开着投机解码也不表示所有请求都必然补齐。

**只有 D 节点能开。** 在 P 上开会被就地关掉，在不拆 P/D 的部署上开会报错，开了[异步调度](async-scheduling.md)就用它的异步版本；`main` 开启本开关时还会自动关闭 SWA bounded replay。[细粒度 TP](fine-grained-tp.md) 把特定模块另分并行组：当注意力输出投影（`oproj`）或 MLP 投影（`mlp`）配置值大于 0 时要求开它；实际并行尺寸大于 1 时，还强制要求配置 `PreemptOffloadConnector`。具体检查和报错见文末。

**边界与例外（早期版本与历史镜像差异）**：

- **早期版本选抢占请求与收尾**：`v0.23.0`、`v0.26.0rc` 与旧 GLM 快照写死取 `running` 队尾，不看 `PRIORITY` 策略；旧 GLM 镜像与 `v0.23.0` 在不能保存时只还 KV 块并发结束帧，未调用完整的引擎结束流程（`v0.26.0rc` 起补齐正式 finish）。
- **早期占位草稿与远端 KV 夹值**：`v0.23.0` 与旧 GLM 快照在 `add_request` 时预先塞入占位草稿（要求请求长度加草稿数不超过模型上限）。远端 KV 收完后，本调度器会把已算位置夹到不超过请求实际长度，再按上游规则收满退回 1 格（交接点见 [PD 分离](pd-disaggregation.md#交接点停在哪个位置)）；`v0.23.0` 与旧 GLM 快照对从主机内存搬回的请求还会再补一次占位草稿，`v0.26.0rc` 只留夹值，`v0.30.0` 与 `main` 已移除这处重写。
- **早期混合模型按组算前缀命中**：`v0.23.0`、`v0.26.0rc` 与旧 GLM 快照在 D 遇到带 Mamba 类层的混合模型（如 GLM 的 KDA 层）且开启前缀缓存时，改为按缓存组分别算本地命中。上游原本对各组取最小值，导致 Mamba 组无本地状态（命中 0）时连带拖累 full attention 组已缓存的块被迫重传；`v0.30.0` 与 `main` 已移除该特例。
- **旧镜像细粒度 TP 与 worker 两处联动**：旧 GLM 镜像的细粒度 TP 强依赖对象是 `oproj` 与词表嵌入（`embedding`）。该旧镜像开启本开关还牵动 worker 两处行为：一是收到 KV 且已算位置停在「提示词长度 − 1」、本步查询量在 decode 阈值内时，按 decode 整理 attention 输入；二是仅收 KV 的节点在 decode 选 MC2 或融合 MC2 且未启分层通信时，可跳过 DP 组间对齐 token 数的 all-reduce，改按全局上限配置 MC2（见[并发页](concurrent-requests.md#再补到两组的最大值)）。较新版增加了 MegaMoe 等排除条件，不能只凭开关为真认定省掉通信。

## 复杂异构实战对照：GLM 双机与 1P1D 改造分析

### 放到 GLM 双机：主线不启用它

前面走通了 PD 分离 D 节点在续块失败后的三路分流与代理重投机制。下面切入**例外 B 历史绑定算例**[GLM 双机主线](glm-5-3-flash-two-node.md#部署前提)：两台机器合起来是一套 P、D 不分的服务，没配 KV 传输，本调度器开关保持默认关；真打开会在启动时报错，因此主线上的抢占仍走上游路线（在本机从头重算）。

部署前提（2×A2×8、TP8/DP2/EP16、W8A8）见[部署页](glm-5-3-flash-two-node.md#部署前提)。官方教程没有传额外的昇腾配置，细粒度 TP 两项都是默认 0，不会触发硬依赖。主线的 prefix caching 也关着，块管理器不带前缀缓存，「混合模型按组算前缀命中」分支进不去。

主线的抢占代价记录在[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)：DP0 跑满 32 条、每条走到约 67,000 个位置时池子用光。被抢占的那条一次还回 120–121 块（每卡约 956–964 MiB），却要在本机重算约 9 步；由于 prefix caching 关闭，没有可复用前缀，34 层 KDA 状态也随块丢掉。本调度器要从 D 上挪走的，正是这类重算。

如果把这两台机器拆成一 P 一 D，[PD 分离页](pd-disaggregation.md#把这两台机器拆成一-p-一-d)按同一组显存假设算过：每个实例只剩 8 张卡，D 每卡的块数不到主线的一半，池子更小，抢占会来得更早。这时在 D 上开本调度器：

- **被抢占的请求仍要让出全部设备块（含 KDA 状态块），区别在于能否另存历史。** 连接器接受保存时，调度器记录要保存的块和进度，再按抢占流程清零已算进度、排回 D 的等待队首，保存和搬回由连接器负责。连接器拒绝或无保存接口时，调度器记录退回请求并向客户端发 `recomputed` 结束帧，由代理重投 P 处理「问题 + 已生成」并再次交接；没有可复用缓存时才重算全段。客户端结束不等于所有版本都完成了引擎正式收尾，区别见文末版本表。
- **投机解码与按 decode 归类仍生效。** GLM 用 MTP 给投机解码出草稿，旧镜像中 D 上的占位草稿以及收完 KV 那一步按 decode 归类，这两处都会对它生效。
- **跳过 DP 组间 all-reduce 不触发。** 拆成 1P1D 后每个实例只有 EP8，按 PD 分离页结论，MoE 用不上 MC2。
- **容量账须按单机重算。** 拆开后的抢占长度、P 重算步数与交接字节，要按 P、D 各自的块池和状态布局重算，不能直接套双机合用的容量账。

## 常见误解

- **「它自己会在 D 上重算 prefill」**——退回路径是把整段 prefill 交给 P，前提是代理能识别 `recomputed` 标记。能另存历史的请求则排回 D 等待搬回，随后接着生成；不能把所有抢占都理解为退回 P，也不能把恢复已保存的历史说成在 D 上重算整段提示词。
- **「开了它，被抢占的请求就不会丢 KV」**——反了。只开它、不配能存 KV 的连接器时，被让出的请求 KV 全部还掉；想不丢，要另配 [Recompute CPU Offload](recompute-cpu-offload.md)，连接器回答「能存」，才会走排回队首那条路。
- **「在 P 上也写上它，会报错拦住」**——官方参数文档说在 P 上或混部时开它会启动失败；代码里 P 上只打一条警告、就地关掉，只有混部和没配 PD 才真的报错。文档和代码不一致，以代码为准。
- **「退回后的输出和不中断时逐 token 一样」**——旧版及 `v0.30.0` / `main` 示例代理按文字重拼，需要重新分词；`v0.26.0rc` 虽按 token 历史续接，也不保证随机采样、执行顺序和所有结构化请求状态完全不变。工具调用要单独核对代理如何保存结构，不能只靠 `recomputed` 标记判断支持。
- **「KV 传输失败时的『重算』策略就是它」**——不是一回事。KV 从 P 读失败时，vLLM 可以选「失败」或「重算」，后者是在 D 上补算没读成的位置，见 [PD 分离的失败处理](pd-disaggregation.md#抢占失败和超时怎么处理)；本页是块不够时把整条请求退回 P。昇腾上 GLM 这类混合模型还不许选那种「重算」策略，启动时断言拦下。

## 对照源码

### 怎么开

```bash
# 只写在 D 节点上。kv-transfer-config 的完整写法见 PD 分离那一页
--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer", ...}'
# v0.23 / GLM 快照：顶层键
--additional-config '{"recompute_scheduler_enable": true}'
# v0.26 / rc2 / main：写进 scheduler_config（顶层写法仍认，已标弃用）
--additional-config '{"scheduler_config": {"recompute_scheduler_enable": true}}'
```

- 开关 `recompute_scheduler_enable` 默认 `false`；四个钉点上 `vllm_ascend/core/recompute_scheduler.py` 都在。GLM 快照在 `ascend_config.py` 读顶层键。官方教程（`long_sequence_context_parallel_multi_node.md` L312）对它的说明是：D 上 KV cache 不够时，请求送回 P 重算。引入存走路径的 PR #10742（合并提交 6329838c9）由作者说明设计动机：D 的 `max_num_batched_tokens` 通常设成 `max_num_seqs × (1 + num_spec_tokens)`，在 D 上重做 prefill 很可能 OOM、性能大受影响；原来的退回做法重组 prompt 时用不了 tool calling / function call，也会带来精度问题 [S40]。这是 PR 作者对当时实现的说明，具体请求格式和现场版本仍要对照实际调用路径，不能据此断言所有工具调用都不可用。
- 平台门 [C1]：只有 `kv_role == "kv_consumer"` 才把 `vllm_config.scheduler_config` 整个换成 `RecomputeSchedulerConfig`，由它按 `async_scheduling` 在 `RecomputeScheduler` / `AsyncRecomputeScheduler` 之间挑；P 上和不拆 PD 时怎样处理，以及细粒度 TP 的反向依赖，见下一节。
- 岔路口 [C2]：`schedule()` 里 `allocate_slots` 返回 `None` 的 `while True`，条件是 `kv_transfer_config` 存在且 `not is_kv_producer`。钩子 `update_state_before_preempt(req, block_ids, num_computed_tokens)` 返回真 → 记 `PreemptedRequestData`，再走上游 `_preempt_request` [C24]；返回假或连接器没有这个钩子 → `kv_cache_manager.free()`，记 `RecomputeReqInfo(request_id, output_token_ids, client_index)`。
- 为什么要整段复制上游的 `schedule()`：main 上 `RecomputeScheduler` 的类注释写明，保留本地副本只是为了给第一条 decode 请求补齐投机解码形状、让昇腾整图对得上；抢占的 KV 能卸就卸，卸不掉才送回 P 重做 prefill。
- 本步禁新 [C6]：`if not preempted_reqs and not recomputed_reqs and ...` 才进 waiting 循环。
- 结束帧：`update_from_output()` 对 `recomputed_reqs` 逐条发 `EngineCoreOutput(finish_reason=FinishReason.STOP, new_token_ids=[], stop_reason="recomputed")`。
- 占位草稿 [C8]：`is_mtp_kv_consumer`（有 `speculative_config` 且 `kv_consumer`）为真、且 `max_model_len >= num_tokens + num_spec_tokens` 时，`add_request` 把 `spec_token_ids` 填成 `PLACEHOLDER_TOKEN_ID`。
- 远端 KV 收完 [C5]：先 `min(num_computed_tokens, num_tokens)`，收满再减 1（减 1 是上游原有 [C25]）；`num_preemptions > 0` 且没有草稿时补占位。
- 代理 [C4]：`stop_reason == "recomputed"` → `retry = True`；`prompt` 或 `messages[0]["content"]` 改成 `origin_prompt + generated_token`；`max_tokens = origin_max_tokens - completion_tokens + retry_count`，流式时 `completion_tokens` 按帧加 1；`reassign_instances` 重新挑 P/D。外层 `while retry:` 没有次数上限，`args.max_retries` 管的是单次连接的网络重试。

### 会报什么错

- **启动报错**：没有kv_transfer_config，或角色既非kv_producer也非kv_consumer，报`ValueError: recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...`。producer先走下一条警告关闭分支，不落入这条报错。
- **不报错、就地关掉**：P 节点上只打 warning「recompute_scheduler_enable is ignored on PD-disaggregated P nodes」。官方参数表写的是启动失败 [S12]，与代码不一致 [!]。
- **旧GLM镜像的启动断言**：`finegrained_tp_config` 的 `oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于0而没开本调度器，触发AssertionError；信息说跨DP的HCCL集合通信需要各DP rank的num_tokens一致[C9]。rc2把依赖对象改为oproj/mlp，大于0要求本开关，大于1另有下述连接器要求。
- **运行时只有日志**：退回 P 的那一路先打一条 info「Recompute preemption falls back without offload for request %s, computed_tokens=%d.」，收尾发帧时再打一条 warning「[RecomputeScheduler] Recompute triggered for request %s.」；存走的那一路打 info「Recompute preemption offload enabled ...」。客户端收到的是正常结束，没有错误码。
- **名字相近、与本页无关**：混合模型把 `kv_load_failure_policy` 设成 `recompute` → `AssertionError: Hybrid models do not support recompute mode kv load failure policy now.` [C11]。
- **rc2细粒度TP还有连接器要求**：oproj或mlp实际并行尺寸大于1时，启动配置还必须包含PreemptOffloadConnector；没有时断言失败。运行时保存失败则直接abort，不发recomputed供代理退P，不能用普通退回路径兜底（来源42、45、53）。

### 开销和什么时候别开

- 代价：无可复用缓存时P重算“问题 + 已生成”全长，再交接所需状态；实际重算和传输量要扣可用命中。保存路线的模型支持、容量和速度见[Recompute CPU Offload](recompute-cpu-offload.md)，不由主机内存够用单独保证。
- 必须挂一个认 `stop_reason="recomputed"` 的代理，官方示例是 `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`。直连 D 的调用方会把这一帧当成正常结束：输出截断，`finish_reason` 却是 `stop` [D]。
- 旧示例聊天请求接在 `messages[0]` 后面，多轮或system场景会改错续接位置（来源4）。v0.26按token编号续接并检查历史（来源18）；rc2/main仍按文本拼接，列表content追加文本片段（来源26、47）。保存token历史也不是全部请求语义、采样结果一致性的保证。
- 同时开别的调度器变体会让它悄悄失效 [C10]：GLM 快照的平台先按本开关换好 `scheduler_config`，紧接着 `SLO_limits_for_dynamic_batch != -1` 或 `profiling_chunk_config.enabled` 会直接改写 `scheduler_cls`，两者之间没有互斥校验，也没有 warning。`v0.26.0rc` 与 `v0.30.0 (c09d3e20)` 上 `profiling_chunk_config.enabled`、`batch_job_sched_config.enabled` 按序排在后面，开启即静默覆写 `scheduler_cls`；`main (8d6180e2)` 移除了 `profiling_chunk_config`，只剩 `batch_job_sched_config.enabled` 仍排在后面静默覆写。DyntraLB 是例外，会和本调度器组合成专门的 4 个类，不再互相覆盖 [C29]。
- 不拆 P/D 的部署（包括 GLM 双机主线）不要开：启动直接 `ValueError`。

### 版本差异

本文“存不走就回 P”的流程图与首屏例子按固定旧部署绘制；`v0.30.0` 与 `main` 下述细粒度 TP 的直接 abort 分支不在旧图范围内。

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 的卸载失败不再一律回 P 重算。** 当 `finegrained_tp_config` 中 `oproj` 或 `mlp` 的并行尺寸实际大于 1 时，启动校验强制要求包含 `PreemptOffloadConnector`，运行时 KV offload 失败会直接置 `FINISHED_ABORTED`；尺寸为 1、没有真实分片时才保留原来的回 P 降级。分配失败后还会先检查 connector 的 pending frees 及候选块能否立即释放，拿不到即时可用块就停止本轮抢占，避免反复触发无收益的卸载/重算。此外，`main (8d6180e2)` 在启用 `recompute_scheduler_enable` 时会通过 `_swa_bounded_replay_unsupported_mode` 自动关闭 SWA bounded replay，并移除 `profiling_chunk_config` 覆写分支。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 仅限 D 节点与在 P 误开 | D 节点启用；P 节点警告关闭并写回 `additional_config`；混部 `ValueError` | 关闭并写回嵌套 `scheduler_config` | 同 v0.26.0rc，且强制 `kv_role == "kv_consumer"` | 同 v0.30.0 |
| 多调度器静默覆盖顺序 | `SLO_limits` / `profiling_chunk` 排后覆写 `scheduler_cls` | `profiling_chunk` → `batch_job_sched` 按序静默覆写 | 同 v0.26.0rc（`platform.py#L1387-L1407`）；DyntraLB 走 4 类组合不覆写 | 移除 `profiling_chunk`，仅剩 `batch_job_sched` 排后静默覆写（`#L1593-L1601`）；另自动关闭 SWA bounded replay |
| 不能保存的收尾与细粒度 TP | 只 free KV 并发客户端帧，未正式结束引擎请求 | 先正式 finish，再发 `recomputed` 帧 | 普通退回正式 finish 并发帧；细粒度 TP（`oproj`/`mlp` > 1）要求 `PreemptOffloadConnector` 且失败直接 `FINISHED_ABORTED` | 延续 v0.30.0 |
| 保存钩子抛异常与选抢占请求 | 不捕获异常；D 分支写死取 running 队尾 | 同左 | 捕获后按失败分支处理；按调度策略选择，且含 pending frees 与即时还块前置检查 | 延续 v0.30.0 |
| 开关默认及位置 | `false`，只读顶层 | `false`，嵌套优先，顶层兼容但弃用 | 同 v0.26.0rc | 同 v0.26.0rc |
| 首个 decode 补形状与接收后重写 | `add_request` 塞占位草稿；接收后夹值并补占位 | 调度时按条件补齐；接收后只夹值 | 调度时补齐并为采样位留空间；移除本地接收后重写，直接用上游；无旧混合组命中特例 | 同 v0.30.0 |
| 示例代理续接与同步/异步类 | 字符串拼 prompt 或首条 message；2 类 | token 历史拼接并检查一致；2 类 | 文本拼接，列表 content 追加文本；4 类（可与 DyntraLB 组合） | 延续 v0.30.0 |

固定 GLM 镜像 `db701c1f` 的主要行为沿用 `v0.23.0`，但在 P 上关闭开关后**没有写回 `additional_config`**，worker 重新构建配置仍可能读到 `true`；且不能保存时发出客户端结束帧而未调用完整引擎收尾。

`v0.30.0` / `main` 在 `PRIORITY` 策略下用 `max(priority, arrival_time)` 选择被抢占请求，其他策略取队尾；旧 D 分支始终取队尾，因此不遵循所设 `PRIORITY` 顺序。启用后应核对最终生效的 `scheduler_cls`、保存/退回日志及客户端 `stop_reason` 标记。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 岔路口与细粒度 TP 中止分支 | `vllm_ascend/core/recompute_scheduler.py`：GLM 快照 `L280–L345`；`v0.30.0 (c09d3e20)` 见 `#L135-L180`、`#L1018-L1035`；`main (8d6180e2)` 见 `#L155-L200`、`#L1032-L1050` |
| 上游被替换的那条抢占 | `vllm/v1/core/sched/scheduler.py`，`_preempt_request`（v0.23.0 L974–L995） |
| 本步禁新 | `recompute_scheduler.py` L438（`v0.30.0` L465；`main` L491） |
| recomputed 结束帧 | `recompute_scheduler.py`，`update_from_output()`（GLM 快照 L869–L880） |
| 占位草稿与远端 KV 夹值（旧版） | `recompute_scheduler.py`（GLM 快照 `__init__`/`add_request` L98–L134，`_update_waiting_for_remote_kv` L138–L169） |
| 三道门、细粒度 TP 检查与多调度器覆盖顺序 | `vllm_ascend/platform.py`：GLM 快照 L680–L700；`v0.30.0 (c09d3e20)` 见 `#L1116-L1157`、`#L1380-L1408`；`main (8d6180e2)` 见 `#L1288-L1330`、`#L1586-L1630` |
| 开关与细粒度 TP 的硬依赖 | `vllm_ascend/ascend_config.py`（GLM 快照 L142–L161） |
| 代理认标记、重投 | `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`（GLM 快照 L970–L1056） |
| v0.26 按 token 续接 | `vllm_ascend/patch/recompute_proxy.py`（L33–L105） |
| 混合模型按组算前缀命中 | `recompute_scheduler.py` L484–L500；为什么这样改见 `vllm_ascend/patch/__init__.py` L424–L440；前缀缓存关着时用的是不带前缀缓存的块管理器：`vllm/v1/core/kv_cache_coordinator.py` L689–L729、昇腾 `patch/platform/patch_kv_cache_coordinator.py` L491–L505 |
| 收完 KV 那一步按 decode 归类 | `vllm_ascend/utils.py` 的 `is_pd_decode_recompute_scheduler_enabled`（L1175–L1181）；用处在 `attention/utils.py` L381–L384、`worker/pcp_utils.py` L304–L310 |
| 跳过 DP 组间 all-reduce | `vllm_ascend/utils.py` 的 `should_skip_allreduce_across_dp_group`（L1255–L1302）；用处在 `ops/fused_moe/token_dispatcher.py` L129–L133、`worker/model_runner_v1.py` L708–L710 |

固定 db701c1f 在已配置 KV 传输且不是 P 的抢占分支中，若 `update_state_before_preempt` 返回真，就记录 `PreemptedRequestData` 后调用上游抢占；接口缺失或返回假时则调用 `free` 并记入重算名单（来源 2）。上游还块、清零进度并排回等待队首（来源 24）。返回真只表示选择保存路径，不是设备拷贝已完成，也不保证连接器支持 GLM 的全部状态类型。

固定 db701c1f 返回的客户端帧是 STOP、空新 token，并带有 stop_reason="recomputed"；代理据此重投（来源 3、4）。该分支没有正式结束引擎请求的调用，也没有捕获保存接口异常；v0.26 与旧 main 增加了正式结束流程，旧 main 还捕获接口异常并退回 P（来源 16、20）。这些版本的端到端恢复行为与耗时仍须在对应部署上验证。

待核：GLM改成1P1D后的块池大小、实际交接字节，以及对应连接器对全部状态的保存与恢复。本站没有这套改造的NPU运行证据。
