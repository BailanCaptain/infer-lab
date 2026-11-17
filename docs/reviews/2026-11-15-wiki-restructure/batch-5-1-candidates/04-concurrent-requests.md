---
id: concurrent-requests
title: 多条请求：在官方双机部署上一步怎样装下它们
type: concept
origin: gap
summary: >-
  沿场景 M（DP0 上 12 条请求在 decode 时来了一条 6000 token 的新请求，DP1 上 7 条在 decode）和 DP1 空闲的变体
  M′，在官方双机部署上看多条请求时每一站多出来的事：选组、分预算、拼输入、抢占、图尺寸补齐与两组对齐、MoE 从 MC2 翻到
  AllGather、空闲组陪跑。
aliases:
  - 多请求推理
  - 并发请求
  - 连续批处理
  - continuous batching
  - 混合批次
  - 请求边界
  - 场景 M
  - 变体 M′
  - 空闲组陪跑
  - 图尺寸补齐
  - 两组对齐
chapters:
  - '00'
order: 15
sources:
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L398-L411'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L259-L267'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L342-L351'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L416'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L570'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L684-L700'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L70-L86'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L238-L398'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L459-L509'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L761-L781'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L830-L868'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1018-L1040'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1726-L1785'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1817-L1864'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1201-L1232'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L76-L96'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2996'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L895-L906'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L90-L101'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L200-L282'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L440-L495'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L543-L560'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3405-L3452'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3640-L3652'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1306'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1080-L1099'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1695-L1711'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1888-L1910'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L160-L166'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L315-L317'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L656'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L103-L105'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217-L236'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L967'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L239-L300'
  - >-
    raw:sha256-56268c111dba253cd766d8dc74f21b8235b22793d8f0848939f1a93a5969ae1f.md#L1-L2018
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L562-L570
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L689-L699
  - 'vllm@ced6857a:vllm/v1/engine/core_client.py#L1546-L1596'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L30
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2079-L2091'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L425-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L529-L559'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L69-L101'
  - 'vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1447'
  - 'vllm@84030bbe:vllm/v1/engine/core_client.py#L1546-L1597'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L709-L747'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L796-L834'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L825-L885'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/llm_base_proposer.py#L239-L258'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L39-L49'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L2089-L2107'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2264-L2282'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L298'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L275-L290'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L644-L680'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L159-L167'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L271-L277'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L477-L504'
  - 'vllm@ced6857a:vllm/config/parallel.py#L143-L146'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L1221-L1225'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2365-L2375'
  - 'vllm@84030bbe:vllm/config/parallel.py#L136-L153'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L1208-L1212'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2347-L2356'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L2264-L2282'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L202-L219'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L243-L260'
  - 'vllm-ascend@7d825229:vllm_ascend/spec_decode/__init__.py#L43-L65'
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南给出主线顺序，本页展开多请求时的变化
  - to: one-request
    kind: builds-on
    note: 在一条请求走完七站的基础上，看多条请求同时在服务里时每一站多出来的事
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 先知道两台机器怎样分成两个 DP 组、16 张卡怎样组成 EP 组，再看请求怎样分到两组、两组为什么每步都要对齐
  - to: collective-communication
    kind: builds-on
    note: 多请求下的通信载荷与 MoE 路径选择，建立在集合通信操作及两条通信路线的基础上。
  - to: glm-5-3-flash
    kind: builds-on
    note: 多请求页以模型总览给出的层结构和批量前向机制为基础，展开各请求共用权重、拼接本轮输入而分别维护历史的执行方式。
  - to: prefill
    kind: builds-on
    note: 多请求页对长提示词按剩余预算分轮处理、与 decode 混合执行的讨论，建立在 prefill 页对提示词跨轮计算及统一调度规则的解释之上。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
  - main
evidence: C
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-56268c111dba253cd766d8dc74f21b8235b22793d8f0848939f1a93a5969ae1f.md
  - >-
    raw/sha256-a4a8bd4475bad23eecaaac04f3b80630bb8b6808ff71c94e6bf1f30c667203e9.md
---

## 多条请求时，七站里哪些地方变了

**continuous batching**（连续批处理）让引擎每一步重新挑选请求、分配计算量：新请求随时加入，结束的请求及时退出，空出的名额和显存随即复用。代价是批次成员、token 数和输入形状每步都可能变化。

[一条请求](one-request.md)跟着提示词为 4 token 的示例请求 R1 走完了七站。现在同一时刻，有的请求刚到、要算提示词（prefill），有的在逐个生成输出（decode），有的即将结束。它们共用权重、16 张卡和引擎的同一步；提示词、输出、保存历史状态的 KV 块和停止条件仍各自独立。

```wiki-diagram
file: concurrent-request-batching
```

七站的顺序不变，多出来的事集中在下面几处：

| 站 | 只有 R1 一条时 | 多条请求同时在服务里时 |
|---|---|---|
| 1 入口 | 进 node0 的引擎 | 先在两台机器（两个执行组）之间挑一个，挑定以后不再换 |
| 2 调度 | R1 独占每步 8192 个 token 的预算 | 在跑的请求先各拿 4 个，剩下的才给新请求；KV 块不够时要有请求让位 |
| 3 准备输入 | 一段 4 个 token | 十几段首尾相接拼成一个张量，另附每段的起止位置 |
| 4 逐层前向 | 只看自己这一组 | 两组交换宽度与执行方式，再按条件补齐；token 一多，专家层的跨机通信换路，载荷也变大 |
| 5 采样与草拟 | 取最后 1 行词表分数 | 每条请求按自己的边界取行 |
| 6 decode 与结果更新 | 自己接受几个候选 | 每条请求各自接受、各自回退 |
| 7 返回与收尾 | 归还 16–17 个块（首步借 15 个，途中尾状态组边借边还） | 归还的块下一步就能分给别的请求 |

## 示例场景 M 与变体 M′

部署与参数沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)，下文的 DP0、DP1 是各自调度、各有 KV 池的两个 DP 执行组（简称 DP2）。每台机器都不是完整模型：路由专家分布在两台机器上，两台合起来才有完整的一份，所以两组每一步仍须一起完成跨机 MoE 通信；后文的「两组对齐」和「空闲组陪跑」都由此而来，详见[为什么是两台机器，不是一台](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

本页计算只需记住：每组每步预算 **8192 个 token**，同时在跑的请求上限 **32 条**。MTP（模型的多 token 预测层）每步猜 3 个草稿，decode 时连同上一步确定的 1 个 token，一条请求通常占 4 个输入位置。图尺寸与 KV 块的取值到对应小节再用。

**场景 M**：某一时刻两组的情况如下。

| | DP0（node0，卡 0–7） | DP1（node1，卡 8–15） |
|---|---|---|
| 正在 decode 的请求 | 12 条，记作 D₁…D₁₂ | 7 条，记作 E₁…E₇ |
| 新到的请求 | 1 条，提示词 6000 个 token，记作 N | 无 |

为了算 KV 块，再设 D₁…D₁₂ 此刻各自已经算到约 20,000 个位置。

**变体 M′**：DP0 与场景 M 相同，DP1 上一条请求都没有。M′ 用来回答一个问题：没活干的那台机器，是不是就能歇着。

下面沿七站的顺序走一遍：先看 N 怎样落到 DP0，再看 DP0 怎样把 N 和 12 条 decode 装进同一步，然后看这一步在 16 张卡上的代价。

## 第 1 站 入口：新请求先挑一个 DP 组

两组的引擎进程各自排队、各自调度。前端是 node0 上的 API server（接 HTTP、做分词的进程），它收到一条请求时，要先决定把它交给哪一组。默认的办法是给每组打一个分，挑分数最小的那组：

```calc
title: 新请求怎样比较两组的负载
score = waiting 队列里的条数 × 4 + running 队列里的条数

场景 M（DP0） = 0 × 4 + 12 = 12
场景 M（DP1） = 0 × 4 + 7 = 7
> → 默认会选 DP1
```

**running 队列**是调度器眼里「已经在算」的请求，**waiting 队列**是「到了但还没开始算」的请求。等待中的请求按 4 倍计入：它们还没开始 prefill，接下来要先占一大段预算。两组的计数由 node0 上的 DP 协调器（汇总两组负载的小进程）定期推给前端，间隔至少 100 ms；前端每派出一条请求，就先在本地给那组的 waiting 计数加 1，免得两次汇总之间把一串请求都派到同一组。

按这个分数，N 本该去 DP1。场景 M 讨论的是它落在 DP0 的情形，有两种来路：一是上游路由通过请求头直接指定组号 0，前端不再打分（写法见页末）；二是一批请求在两次汇总之间密集到达，计数滞后，DP0 的分数一时显得更低。这两条路和计数怎样滞后，见[DP 请求路由](dp-request-routing.md#计数表从哪来为什么会过时)。

**请求一旦派进某一组，就一直留在那组。** 它的 KV 块从那组的池子里分，它的每一步都由那组的调度器安排，两组之间不迁移请求。所以两组的负载可以长期不均：场景 M 里 DP0 有 13 条，DP1 只有 7 条。后面会看到，这种不均的代价不只落在忙的那组，闲的那组也跟着付。

## 第 2 站 调度：一步 8192 个 token 怎样分给 13 条请求

**scheduler**（调度器）在 EngineCore（管理一组请求的引擎进程）里运行，每一步开头决定给哪些请求各算几个 token、各分几个 KV 块。它不区分「prefill 阶段」和「decode 阶段」：每条请求只有两个数，「已经算到第几个位置」和「应该算到第几个位置」，每一步尽量把两者之间的差补上。刚到的 N 差 6000 个位置，于是它这一步要做的就是 prefill；D₁ 只差上一步确定的 1 个 token 和 3 个草稿，于是它这一步就是 decode。两种请求因此可以出现在同一步里。

```wiki-diagram
file: concurrent-request-schedule
```

图的左支先安排 running，右支用剩余预算接纳 waiting；分块成功以后才扣预算。提示词只算了一部分的请求也属于 running，下一轮从剩余位置继续。场景 M 里 N 在第 1 步调度结束后到达，进入 waiting；第 2 步沿右支加入，DP0 的账如下：

```calc
title: 一步预算怎样分给已有请求和新请求
running 每条 = 1 个确定的 token + 3 个草稿 = 4
先排 running 里的 12 条 = 12 × 4 = 48
剩下的预算 = 8192 − 48 = 8144
再排 waiting 里的 N = min(6000, 8144) = 6000
> 一步算完，不用切
running 条数：12 → 13，没到上限 32
这一步 DP0 合计 = 48 + 6000 = 6048 个 token，13 条请求
```

同一步里 DP1 只有 7 条 decode：`7 × 4 = 28` 个 token。两组各自按本地队列分配预算，所以 N 的到来只增加 DP0 的调度量；N 算完提示词后转入 decode，下一步也只取一条 decode 请求的预算。把前后三步排在一起，就能看到这次混合步怎样形成、又怎样结束：

| 步 | DP0 这一步算什么 | DP0 token 数 | DP1 token 数 | 步末 |
|---|---|---|---|---|
| 第 1 步 | 12 条 decode；N 在调度之后才到，进 waiting 队列 | 48 | 28 | N 等下一步 |
| 第 2 步 | 12 条 decode + N 的 6000 个提示词 | 6048 | 28 | N 得到第一个输出 token 和 3 个草稿 |
| 第 3 步 | 13 条 decode | 52 | 28 | 两组都回到纯 decode |

```wiki-diagram
file: concurrent-request-rounds
```

图中每列是一步，列宽只用来对齐，不代表耗时：第 2 步要算 6048 个位置，实际比另外两步慢得多。最下面两行是这三步的实际执行宽度和 MoE 通信方式，它们为什么这样变，后面两节分别讲。

**本步调度与分块准入边界**：分到某一执行组不等于获准进入本轮计算——接纳 waiting 请求还要求调度未暂停，且这里的 `running` 是队列身份，不保证本步一定获得计算（队列中的部分请求可能本步没有被调度，因此运行队列中的请求数与本步实际调度的请求数需要分开看）。此外，按剩余预算先算一部分提示词，需要该路径允许分块；关闭分块时，若新请求所需的位置数超过剩余预算，调度器会停止这一轮的等待队列接纳（上方场景 M 中，N 的 6000 个位置未超过剩余的 8144 个预算，不涉及这种不足情形）。

### 提示词超过剩余预算时，分几步算

**chunked prefill**（分块预填充）把长提示词分配到多轮，每轮只占当时可用的预算，对应调度图中的切分分支。本部署默认开启；N 的 6000 个 token 一步装得下，超过剩余预算的提示词才需要切分：

```calc
title: 新提示词多长才需要分块
提示词 > 8192 − 4 × running 条数 就要切

running 12 条时的门槛 = 8192 − 48 = 8144
running 31 条时的门槛 = 8192 − 124 = 8068（新请求进来后正好 32 条）
running 32 条时：新请求这一步根本进不来，要等有请求结束
```

把 N 换成一条 20,000 token 的提示词，DP0 的四步是：

| 步 | decode 部分 | 新请求这一步算的提示词 | 合计 | 提示词还剩 |
|---|---|---|---|---|
| 1 | 12 条 × 4 = 48 | min(20000, 8144) = 8144 | 8192，预算用满 | 11,856 |
| 2 | 48 | min(11856, 8144) = 8144 | 8192，预算用满 | 3,712 |
| 3 | 48 | 3712 | 3760 | 0，本步末得到第一个输出 token |
| 4 | 13 条 × 4 = 52 | — | 52 | 新请求也进入 decode |

前两步里，这条请求在自己最后一个位置上也会顺手采样出一个 token，但提示词还没算完，这个 token 被丢掉，不返回给客户端；第 3 步算完提示词的最后一段，才得到真正的第一个输出 token。每一步最多 8192 个 token 这个上限，让 12 条 decode 请求在这四步里每步都照常前进，不会被一条长提示词整段卡住。

## 第 3 站 准备输入：13 条请求拼成一个 6048 行的张量

调度结果发到 DP0 的 8 个 Worker（每张卡一个、真正执行前向的进程）以后，每个 Worker 里的 model runner（把调度决定翻译成张量的那部分代码）要把 13 条请求这一步的输入首尾相接，拼成一个张量交给模型。以第 2 步为例，按 `[D₁, …, D₁₂, N]` 的顺序写出来：

```calc
title: 混合批次怎样标出各请求的输入范围
请求顺序 = [D₁, D₂, …, D₁₂, N]
本步输入数量 = [4, 4, …, 4, 6000]
> 合计 6048
步前已计算位置数 = [L₁, L₂, …, L₁₂, 0]

input_ids = [D₁.y, D₁.d₁, D₁.d₂, D₁.d₃, D₂.y, …, D₁₂.d₃, N.p₀, N.p₁, …, N.p₅₉₉₉]
positions = [L₁, L₁+1, L₁+2, L₁+3, L₂, …, L₁₂+3, 0, 1, …, 5999]
query_start_loc = [0, 4, 8, …, 44, 48, 6048]
> 共 14 个数
本步计算后的长度 = [L₁+4, …, L₁₂+4, 6000]
```

逐行看：

- `Dₖ.y` 是 Dₖ 上一步确定下来的那个 token，`Dₖ.d₁…d₃` 是 MTP 层接着猜的 3 个草稿；`N.p₀…p₅₉₉₉` 是 N 的提示词。`input_ids` 里放的都是词表编号。
- `Lₖ` 是 Dₖ 已经算过的位置数，本场景里约 20,000。**positions**（位置编号）按各请求自己的进度写：Dₖ 接着从 `Lₖ` 往后数，N 从 0 开始。同一个张量里，相邻两行可以属于相差两万个位置的两条请求。
- **query_start_loc** 记录每段在拼接张量里的起点：D₁ 占 `[0, 4)`，D₁₂ 占 `[44, 48)`，N 占 `[48, 6048)`，最后一个数 6048 是总行数。后面每一个要读历史的层都靠它知道哪几行属于同一条请求。
- 表里按 `[D₁, …, D₁₂, N]` 排，是为了写得清楚；runner 实际的行序由它的批次管理决定，同时维护一张「请求 ID → 行号」的对照表，后面按请求拆结果时用。

```wiki-diagram
file: concurrent-request-inputs
```

拼好以后，张量在每张卡上的形状和一条请求时同一套规则，只是行数从 4 变成 6048：嵌入后是 `[6048, 4096]`，展开成 mHC（GLM 的四路残差连接）的四路残差后是 `[6048, 4, 4096]`，BF16（每个数 2 字节）下 `6048 × 4 × 4096 × 2 B = 189 MiB`，TP8 的 8 张卡上各有一份完整的。机器内的集合通信也按行数放大：嵌入之后那次 All-Reduce（8 张卡把各自算出的部分加起来，每张卡都拿到总和）的载荷是 `6048 × 4096 × 2 B = 47.25 MiB`，R1 时只有 `4 × 4096 × 2 B = 32 KiB`，差 1512 倍。

**拼在一起的只是这一步的新输入，历史各归各的。** 同一层里，13 条请求的 6048 行一起做矩阵乘，共用同一份权重；到了要读历史的地方，各请求只读自己的。GLM 主干的 45 层里有两种要读历史的层：34 层 KDA（线性注意力，每条请求只存一份固定大小的递推状态）和 11 层稀疏 MLA（把每个历史位置压缩成一小段存下，每次只挑一部分来读）；每层的前馈部分，前 3 层是稠密 MLP，其余 42 层是 MoE。第 2 步里它们这样区分各请求：

| 状态 | 第 2 步里各请求怎样用 |
|---|---|
| 片段边界与序列长度 | 标出 12 段各 4 行、1 段 6000 行，限定每段只能看到自己的历史 |
| KDA 状态的槽位号 | 34 层 KDA 按槽位号读写各请求的递推状态；Dₖ 从自己已有的状态接着更新，N 的状态先清零再开始 |
| 稀疏 MLA 的块表与槽位映射 | **block table**（块表）记录每条请求的逻辑块对应池子里哪个块号；索引器（给历史位置打分、挑出最相关的 2048 个的小网络）只在 Dₖ 自己约 20,000 个历史位置里挑；N 的新 KV 写进它刚分到的块 |
| 请求 ID 与行号的对照 | 采样结果据此交回各请求，下一步批次成员或顺序变了也不会串 |

KDA 与稀疏 MLA 怎样用这些状态，见[线性注意力](linear-attention.md)与[稀疏注意力](sparse-attention.md)。本部署关着 prefix caching（前缀缓存：两条请求提示词开头相同时复用已算好的 KV），所以即使 D₁ 和 N 的提示词开头一模一样，也各算各的。

## KV 块：一组的请求共用一个池子，不够时最后进来的让位

**多个请求同时来时，KV 块怎么分，池子什么时候会不够？** 每组请求共用一个池子：新请求先拿到够用的块，才能排进本步；已有请求随历史增长继续申请。这里沿用每卡 **3,855 个块号**的算例，容量推导与实机日志入口见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

先把每条请求占的块分成两部分：**随历史增长的部分**，以及**保存当前状态和草稿状态的固定部分**。缓存组就是采用同一存储格式和分配规则的一组层；本模型主干 45 层加 MTP 层分成 5 组，各组从池子取块，最后把块数相加：

- **full 组随长度增长。** 它存 12 层 MLA 的压缩 KV 和索引器 key（主干 11 层加 MTP 1 层），每 640 个位置用 1 块，还要为下一步的 3 个草稿预留位置。
- **3 个 KDA 组占固定状态块。** 34 层 KDA 分成 12、11、11 层三组。每组的 **4 块 = 1 块当前状态 + 3 块草稿状态**，因此三组共占 12 块；这里的 4 指块数。
- **索引器状态组（尾状态组）decode 时 3–4 块，prefill 那一步临时约 n ÷ 4 块。** 它采用滑动窗口，窗口和块都是 4 个位置：每前进 4 个位置还 1 块、借 1 块，手里 3 块还是 4 块看已算位置除以 4 余几；一步 prefill n 个位置时要为这 n 个位置都留格子。推导见 [KV 块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。

各组使用池子里统一大小的块号，每占一个块号就是每卡 7.969 MiB。decode 时上述后两项合计 15–16 块，与请求长度无关；只有 full 组随历史增长。令 L 为已算位置数、n 为本步新算位置数，块数公式是：

**块号数 = ceil((L + n + 3) / 640) + 3 × 4 + 尾状态组**，尾状态组 decode 时 3–4 块，从 0 开始一步 prefill n 个位置时是 ceil((n + 3) / 4) 块。

ceil 表示向上取整，不满 640 个位置也要占一整块。下面只有两个设定：第一行仍是场景 M；从第二行起改看“DP0 跑满 32 条请求”的压力情形。decode 时 n = 4（1 个确定 token 加 3 个草稿），所以 L + n + 3 = L + 7；67,000 是池子用光时各条的平均位置数。

decode 历史每增长 640 个位置，才多要 1 块。满载例中，各条走到约 60,000 + (6,700–7,340) ≈ 67,000 个位置时，就会有 running 请求续块失败，触发 **preemption**（抢占）：收回队尾请求的块，争取让当前请求继续。

| 设定与要回答的问题 | 块数或步数怎么算 | 得到什么 |
|---|---|---|
| **场景 M：约 20,000 个位置**，12 条 decode 加 N | 每条 D：ceil(20007 / 640) + (15–16) = 32 + (15–16) = 47–48 块，12 条共 564–576 块；N 第一步：ceil(6003 / 640) + 12 + ceil(6003 / 4) = 10 + 12 + 1,501 = 1,523 块 | 剩 3,855 − (564–576) − 1,523 = **1,756–1,768 块**，装得下；N 下一完整 decode 步先还 1,499 块、再借 1 块，净释放 1,498 块，回到 25 块 |
| **压力情形①满载：60,000 个位置**，32 条都在 decode | 每条：ceil(60007 / 640) + (15–16) = 94 + (15–16) = 109–110 块；共 3,488–3,520 块，剩 335–367 块 | 平均每条还能走约 (335–367) ÷ 32 × 640 ≈ **6,700–7,340 个位置** |
| **压力情形②接近耗尽：约 67,000 个位置**，看一条被抢占的请求 | ceil(67007 / 640) + (15–16) = 105 + (15–16) = **120–121 块**；× 7.969 MiB ≈ **956–964 MiB** | 收回后够其余请求再存 (120–121) × 640 ≈ **77,000 个位置** |
| **压力情形③被抢占后：约 67,000 个位置要重算**，另有 31 条 decode | 其他请求每步占 31 × 4 = 124 个 token，留给它 8192 − 124 = 8068 个；ceil(67000 / 8068) = **9 步**；第一步尾状态组要借 ceil(8071 / 4) = 2,018 块 | 这 9 步都是 prefill 与 decode 混合的大步；排回来之前，准入检查要先有 105 + 12 + 2,050 = **2,167 块**空闲 |

```wiki-diagram
file: concurrent-request-preempt
```

图中的回环表示可以连续回收多条。默认先来先服务时，被抢占者从 running 队尾退回 waiting 队首，已算位置清零；若回收的就是当前请求，本轮停止遍历 running。waiting 新请求拿不到块时则留待下一轮，不进入抢占循环。

这套部署中，抢占后重算没有 prefix caching 可复用，34 层 KDA 的递推状态也随块收回，只能把约 67,000 个位置从头扫一遍重建。这就是表中“释放约 956–964 MiB，却要重算 9 步”的代价。还有一层：被抢占的请求只还了 120 块左右，排回来却要先凑出约 2,167 块，大头是尾状态组为 prefill 临时借的块；waiting 侧借不到就停，它和排在后面的新请求都要等池子空出这么多才进得来。

## 进入第 4 站之前：宽度先按自己补，再按对面补

每一步主干调用的输入宽度要先经过两层判断：先按自己这组能用的图尺寸补，再和另一组交换信息，决定是否进一步补齐。两次补齐的原因不同，分开看；这是调用的输入宽度，各算子仍可按真实 token 数裁剪工作。

### 先补到自己这组的图尺寸

本部署只给纯 decode 的步录了图（graph mode：把一次前向的算子序列预先录好，之后同样尺寸的输入整段回放，省掉 CPU 逐个下发算子的时间），尺寸只有 4、8、16、32、64、96、128 个 token 这 7 档。一步的 token 数落在两档之间时，往上补到最近的一档，多出来的行是空跑的填充：

| decode 请求数 | token 数（× 4） | 补到 | 空跑的行 | 占比 |
|---|---|---|---|---|
| 7（场景 M 的 DP1） | 28 | 32 | 4 | 12.5% |
| 9 | 36 | 64 | 28 | 43.8% |
| 12（场景 M 的 DP0） | 48 | 64 | 16 | 25% |
| 13（N 转入 decode 后） | 52 | 64 | 12 | 18.8% |
| 32（满载） | 128 | 128 | 0 | 0% |

MTP 把每条请求的一步从 1 个 token 变成 4 个，补齐的账也跟着变：同样 12 条请求，不开草拟时是 12 个 token，补到 16，空跑 4 行；开了 MTP 是 48 补到 64，空跑 16 行，绝对量是 4 倍。也正因为每条 4 个，32 条请求需要一路录到 128 这一档；不开草拟时 32 这一档就够了。

```wiki-diagram
file: concurrent-request-graph-decision
```

图的第一个岔口同时检查进度和形状：提示词仍在计算时，即使碰巧也是每条 4 个 token，仍走 eager mode（逐个下发算子）。符合 decode 条件才往上选捕获尺寸。跨 DP 同步还会再约束这一次选择。

按这一层规则，场景 M 里两组各自要的宽度是：DP0 第 1 步 48 → 64，第 2 步 6048（混合步，不补），第 3 步 52 → 64；DP1 三步都是 28 → 32。

### 再补到两组的最大值

两组先交换“这一步有多宽、能不能用图”，才知道该怎样一起执行。这次 All-Reduce 合成一张 2 × 2 小表；图中并列框里的两项都要完成。本部署中，本来能用图的组补到两组最大值，本来就 eager 的组保留真实宽度；MoE 内部再按通信要求补齐。

草拟另有一条规则：GLM 的 MTP 固定 eager，一律补到两组最大值，三遍草拟都按这个宽度跑。

DP1 在这三步里先后出现四个宽度，来历各不相同：

| 宽度 | 出现在哪 | 为什么是这个数 | 由谁决定 |
|---|---|---|---|
| 28 | DP1 每一步的真实 token 数 | 7 条 decode × 4 | 自己的请求 |
| 32 | DP1 每一步本地补齐后 | 28 往上最近的一档图尺寸 | 自己的图尺寸 |
| 64 | DP1 第 1、3 步实际执行 | DP0 的 48 或 52 补到 64，两组取最大值 | DP0 的图尺寸 |
| 6048 | DP1 第 2 步实际执行 | DP0 的 48 + 6000 是混合步、不补图，两组取最大值；执行方式也被压成 eager | DP0 的混合步 |

沿三步走一遍：

| | 第 1 步 | 第 2 步 | 第 3 步 |
|---|---|---|---|
| DP0 真实 token 数 → 本地补齐 | 48 → 64，能用图 | 6048，混合步，不能用图 | 52 → 64，能用图 |
| DP1 真实 token 数 → 本地补齐 | 28 → 32，能用图 | 28 → 32，能用图 | 28 → 32，能用图 |
| 同步后的执行方式 | 两组都回放 64 的图 | 两组都 eager | 两组都回放 64 的图 |
| DP1 实际执行宽度（真实行数） | 64（28 行真实） | **6048（28 行真实）** | 64（28 行真实） |
| 这个宽度由谁定 | DP0 的 48 → 64 | DP0 的混合步 6048 | DP0 的 52 → 64 |
| 草拟宽度（两组相同，跑三遍） | max(48, 28) = 48 | 6048 | max(52, 28) = 52 |

```wiki-diagram
file: concurrent-request-dp-align
```

第 2 步最能说明问题：DP1 自己只有 28 个 token，本来能回放 32 的图；因为 DP0 那边混进了 N 的提示词，它既用不上图，又被拉到 6048 行宽，比自己的真实需要大 216 倍，主干及三遍草拟调用采用这个输入宽度。它不表示每层每个算子都计算 6048 行真实历史：固定 KDA 会按实际 token 数裁剪输入，没有注意力元数据时还会提前返回。**场景 M 这三步中，DP1 的实际宽度与执行方式都受 DP0 约束。** 其他批次仍按前面的条件判断：原本就 eager 的组可以保留本地宽度，MoE 内部再补齐，不能把这个三步算例推广为所有组始终采用相同主干宽度。

## 第 4 站 MoE 通信：6048 个 token 把两台机器一起推过 128 的门槛

GLM 的 42 个 MoE 层各有 288 个路由专家，每个 token 选其中 8 个；EP16 把专家分到两台机器的 16 张卡上，每卡 18 个。所以 DP0 的一个 token 选中的专家，多半有几个在 node1 的卡上，token 的隐藏向量必须过机器之间的链路送过去，算完再送回来。送过去叫 **dispatch**，送回来按路由权重合起来叫 **combine**。

这件事有两种做法，每一步在两者之间选一个：

- **MC2**：昇腾把 dispatch、专家计算、combine 融合在一起的实现。每个 token 只把自己的 int8（每个数 1 字节）副本发给选中的 8 个专家所在的卡，每份 `4096 B + 4 B 缩放系数 = 4,100 B`，结果以 BF16 发回来，每份 8,192 B。[一条请求](one-request.md)里 R1 走的就是这条路。
- **AllGather 路径**：先用 **All-Gather**（收集各成员的数据，拼成完整副本），让同一个 TP 位置上、两台机器的两张卡互相交换整份隐藏向量，每张卡都拿到两组全部 token 的完整副本，各自只算落在自己 18 个专家上的那部分，再用 **Reduce-Scatter**（先把各成员对应位置加起来，再把结果切开分回各成员）把结果加回去、分回各自的 token。这里通信的是[跨机配对的两卡 DP 通信组](glm-5-3-flash-two-node.md#16-张卡怎样分组)，与前面各自调度请求的 DP 执行组不同；AllGather 是整条路径的名字，All-Gather 是其中的集合操作。

选哪一条，规则和门槛 128 的来历在一条请求第 4 站的[「MoE 通信：走 MC2 还是 AllGather」](one-request.md#moe-通信走-mc2-还是-allgather)一节算过：Atlas A2 上只在这两条里选，每卡专家数和 EP 组大小两个条件在本部署恒成立，真正起作用的是「两组这一步 token 数的最大值不超过 128」。多条请求时要紧的是后半句里的**两组最大值**：两组每一步永远用同一种通信方式，由更忙的那组决定。

| | 第 1 步 | 第 2 步 | 第 3 步 |
|---|---|---|---|
| 两组 token 数的最大值 | 64 | 6048 | 64 |
| MoE 通信 | MC2 | **AllGather** | MC2 |

门槛看的是 token 数，不是「有没有 prefill」。场景 M 的 DP0 若来的不是 6000 token 的 N，而是一条 80 token 的短提示词，这一步是 `48 + 80 = 128`，仍走 MC2（只是混合步用不上图）；提示词多 1 个 token，`129 > 128`，两台机器一起翻到 AllGather。满载的纯 decode 步 `32 × 4 = 128` 正好压在线上。

**第 2 步在 AllGather 路径上的张量载荷。** 以 DP1 的任意一张卡为例，它本地只有 28 行真实数据。下表按张量元素计数，不把集合操作的张量大小直接当作物理链路流量：

| 动作 | 张量 | 每卡每层的张量量级 |
|---|---|---|
| 补齐 | 本地 `[28, 4096]` 补到两组最大值 `[6048, 4096]` | 6020 行填充 |
| 两组之间的 All-Gather：隐藏向量 | 收对端 `[6048, 4096]` BF16，本地变成 `[12096, 4096]` | 收 47.25 MiB，缓冲 94.5 MiB |
| 两组之间的 All-Gather：路由分数 | `[6048, 288]` FP32（每个数 4 字节） | 收 6.64 MiB |
| 本卡 18 个专家计算 | 理想均分时 `[6048, 4096] × [18, 4096, 4096]`、`[6048, 2048] × [18, 2048, 4096]`，int8 | 12,096 行 × 8 个专家 ÷ 16 张卡 = 6,048 行 |
| 两组之间的 Reduce-Scatter | `[12096, 4096]` → `[6048, 4096]` BF16 | 47.25 MiB |
| TP8 All-Reduce | `[6048, 4096]` BF16 | 47.25 MiB |

按表中各操作的载荷口径相加，一层约 `47.25 + 6.64 + 47.25 + 47.25 = 148.4 MiB`，42 层约 **6.09 GiB/卡/步**。其中跨 DP 两卡操作的载荷合计为 `42 × (47.25 + 6.64 + 47.25) MiB = 4.15 GiB`。这些数用来比较张量规模；All-Reduce 的输入大小、Reduce-Scatter 的输出大小与网卡实际收发字节不是统一口径，不能再乘卡数当作实测跨机流量。物理流量还取决于集合算法、拓扑和协议开销。

**第 1 步走 MC2 时是多少。** 两组都回放 64 的图，MoE 里按 TP8 沿 token 维切开，每卡最多 `64 ÷ 8 = 8` 行：

```calc
title: 一个 decode 步的 MoE 逻辑载荷上界
dispatch = 8 行 × 8 个专家 × 4,100 B = 262,400 B
combine = 8 行 × 8 个专家 × 8,192 B = 524,288 B
TP8 把 8 份切片拼回完整张量 = 8 行 × 8,192 B = 65,536 B
共享专家的 TP8 all-reduce = 64 行 × 8,192 B = 524,288 B
每层合计 = 1,376,512 B ≈ 1.31 MiB
42 层（约） = 55.1 MiB
> 其中 EP16 范围的 dispatch 与 combine 逻辑载荷约 31.5 MiB，包含同机或本卡的专家去向，不能全算成跨机流量
```

这是按每卡 8 行都参与派发算的逻辑上界；MC2 另用掩码标出真实行，DP0 的 48 行和 DP1 的 28 行都不满 64。两步的真实 token 从 `48 + 28 = 76` 涨到 `6048 + 28 = 6076`，约 80 倍。两条路径的载荷结构也变了：DP1 被补到 6048 行，All-Gather 交换完整 BF16 隐藏向量，而 MC2 按选中的专家传递 int8 副本。由于载荷、填充行和专家去向的口径不同，不能把上面的合计数相除后称作实际跨机通信或耗时的增长倍数；应在相同负载下采集通信与链路 profile。

```wiki-diagram
file: concurrent-request-moe-switch
```

**专家负载。** 第 2 步的补齐张量共有 `12,096 × 8 = 96,768` 个（token，专家）配对位置，按理想均分估算，每个专家 336 行、每卡 6,048 行；真实有效行与填充行应分开统计。一层 MoE 要等参与卡完成，更不均的专家分配可能增加最慢卡耗时，但选中行数翻倍不保证整层时间翻倍，比例还取决于算子吞吐、通信和固定开销。GLM 在训练时用偏置改善专家负载分布，推理时偏置固定，不保证每批均衡；按真实负载搬专家的 [EPLB](eplb.md) 在本部署默认关着。

## 空闲的 DP 组为什么还要陪跑：变体 M′

M′ 里 DP1 一条请求都没有。它的调度器每一步都排不出东西，但它的引擎不能停下来歇着：DP0 的 token 在 42 个 MoE 层里都要把一部分送到 node1 的 8 张卡上算，那 8 张卡如果不进这一层的通信，DP0 就会一直等在那里。

所以引擎的主循环是这样写的：这一步本地没有可算的请求，但全局还有请求没做完，就执行一次 **dummy batch**（空批次：没有真实请求、只为陪另一组走完一步前向的假输入）。它在本地只准备 4 个 token，也就是一条 decode 请求的量，然后和正常的一步一样经过上一节的两组对齐：

| DP0 这一步 | DP1 的空批次：本地 → 对齐后 | 执行方式 | DP1 这一步做了什么 |
|---|---|---|---|
| 12 条 decode，48 → 64 | 4，能用 4 的图 → 64 | 两组都回放 64 的图，MC2 | 调用主干及草拟陪跑；本组 64 个输入位置均无真实请求，各层可另有简化 |
| 12 条 decode + N 的 6000 个提示词，6048 | 4 → 6048 | 两组都 eager，AllGather | 主干调用宽度 6048，草拟也陪跑；本组输入均无真实请求，MoE 按 6048 行做 All-Gather 和 Reduce-Scatter |

按相同的补齐与通信路径推导，M′ 里 DP1 的 MoE 张量载荷与场景 M 接近；其本地假请求的最终输出会丢弃，但替 DP0 真实 token 计算的专家结果仍要送回，不能把 DP1 的全部计算当作无用。空闲组的工作还受对端宽度与专家路由影响；各层是否采用简化路径以及实际开销需另核，见页末。

两组什么时候一起停下来：它们每 32 步做一次 All-Reduce，交换「本地还有没有没做完的请求」，两边都说没有，才一起暂停，等下一条请求到来时由 DP 协调器把两组一起叫醒。这个检查只在第 32、64、96……步做，所以最后一条请求结束以后，两组最多还会一起空跑 31 步。

这也回答了 DP2 部署的一个基本取舍：两组的调度是分开的，前向却必须同步。请求量长期只够喂一组时，另一组没有自己的请求输出，仍承担真实的远端专家计算；额外代价来自填充行和为同步继续执行的工作，不能把另一台全部算力算作没有产出。

## 第 5–7 站 采样、验证与收尾：结果按请求拆回去

第 2 步的主干输出有 6048 行，但只有一部分行要变成词表分数（logits，词表里每个 token 一个分数）。哪几行，由每条请求自己决定：

```calc
title: 混合批次有多少行需要投影到词表
D₁…D₁₂ = 12 × 4 = 48 行，第 0–47 行
> 每条 4 行，拿来验证 3 个草稿，外加一个额外的 token
N = 1 行，第 6047 行
> 只要最后一个提示词位置的那一行
合计 = 49 行
> → 词表分数 [49, 154880]
```

这 49 行以后就按请求各走各的：Dₖ 用自己的 4 行按[一条请求](one-request.md)第 6 站的办法验证草稿，这一步接受几个、退回几个，12 条各不相同，已算到的位置数也各自回退；N 从第 6047 行采样出第一个输出 token，随后 MTP 层也给它猜 3 个草稿，所以第 3 步它和别人一样送 4 个 token。

每条请求追加完新 token 后各自检查停止条件。哪条请求这一步结束了，它的块号就还给池子，running 队列少一条；下一步调度时，多出来的块和名额就能给 waiting 队列里的请求。这就是 continuous batching 在收尾一侧的样子：批次成员在每一步的边界上换，不等整批结束。一条请求结束时前端、引擎和 worker 各删什么，被中止时又怎样走，见[请求收尾](request-teardown.md)。

统计时也要沿用这个区别：运行队列中的请求数不能替代本步调度请求数与输入位置数。

## 常见误解

- **「prefill 和 decode 分开成批。」** [场景 M 的第 2 步](#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)把两者装在同一次前向里。
- **「新请求总去更闲的组。」** [选组](#第-1-站-入口新请求先挑一个-dp-组)还受请求头指定和负载计数滞后影响；派定后不迁移。
- **「6000 token 的提示词肯定要切块。」** [切分看剩余预算](#提示词超过剩余预算时分几步算)：场景 M 剩 8144，一步就装下。
- **「混进 prefill 就走 AllGather。」** 门槛看两组最大的 token 数；[80 token 的短提示词反例](#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)仍走 MC2。
- **「DP1 只有 28 行，这步很轻。」** [两组对齐](#再补到两组的最大值)会把它拉到 6048 行，执行方式也一起变。
- **「空闲组可以歇着。」** [变体 M′](#空闲的-dp-组为什么还要陪跑变体-m)仍须陪跑；全局结束后最多再空跑 31 步。
- **「抢占后回来接着算。」** [回收 KV 块](#kv-块一组的请求共用一个池子不够时最后进来的让位)也会丢掉 KDA 状态，本部署须从头重算。
- **「图尺寸补齐只浪费一点。」** [9 条 decode 请求](#先补到自己这组的图尺寸)就会空跑 43.8%，之后还可能再受另一组拉宽。

## 对照源码

### 怎么开

本页行为沿用[部署前提与官方参数](glm-5-3-flash-two-node.md#部署前提)，无需单独打开。chunked prefill 默认开，单条提示词每步的上限 `long_prefill_token_threshold` 默认 0，即不另设上限。

- 指定一条请求去哪一组：请求头 `X-data-parallel-rank: 0` 或 `1` [C1]；不带时按 `waiting × 4 + running` 打分。
- 让 prefill 步也留在 MC2 上：`--additional-config` 里的 `enable_prefill_mc2`，默认关 [C34]。打开后门槛从 128 升到 4096（算法同[一条请求「MoE 通信：走 MC2 还是 AllGather」](one-request.md#moe-通信走-mc2-还是-allgather)里的门槛 128，只是改按 `--max-num-batched-tokens` 取值，且每卡封顶 512 个 token），场景 M 的 6048 仍然超过，照样走 AllGather [D]。
- 两组每步对齐的那次 All-Reduce 默认走 CPU 通信组，`--additional-config` 里 `dp_allreduce_on_npu` 为真时改走 NPU 通信组 [C35]。

### 会报什么错

- 请求头指定的组号越界时，入口直接报 `ValueError`，信息是 `data_parallel_rank 2 is out of range [0, 2).` [C2]。请求头的值不是整数时不报错，按没指定处理。
- 抢占不报错：被抢占的请求 `num_preemptions` 加 1，开了统计时记一次 `PREEMPTED` 事件，然后回到 waiting 队列最前面（见下表「抢占」一行）。抢占频繁时，日志里没有报错可找，要看这个计数。
- 两组对齐后要按新宽度重新挑一次图尺寸，代码用 `assert batch_descriptor.num_tokens == num_tokens_padded` 确认两组商定的宽度确实可用；这条断言失败说明两组对宽度的理解不一致（见下表「能不能用图」一行）。
- 待核：一组的进程异常退出或卡住时，另一组停在 MoE 通信里的表现和超时时间，缺一份实机日志。

### 开销和什么时候别开

- **陪跑、对齐与补齐。** 代价分别见[变体 M′](#空闲的-dp-组为什么还要陪跑变体-m)、[两组对齐](#再补到两组的最大值)和[图尺寸](#先补到自己这组的图尺寸)；空闲组仍承担真实的远端专家计算，需要把这些工作与填充、同步开销分开 [D]。
- **抢占。** [KV 表](#kv-块一组的请求共用一个池子不够时最后进来的让位)的释放空间与重算代价按 3,855 块的算例推导 [D][A]，真实块数定下来后按同一公式重算。
- **什么时候别让长提示词和 decode 混在一起。** 一条长提示词混进来，两组所有 decode 请求这一步都要 eager、都走 AllGather；按门槛倒推，12 条 decode 在跑时，每步的 prefill 要压到 80 个 token 以内才能留在 MC2 上；想靠调小 `--max-num-batched-tokens` 保住 MC2，就得把它压到 128，一条 6000 token 的提示词要切成 6000 ÷ 80 = 75 步。对 decode 延迟敏感的服务，可以考虑把 prefill 与 decode 分到不同实例，见 [PD 分离](pd-disaggregation.md) [I]。

### 版本差异

下表按上游 `0fc695fc` / `568afb3a` / `ced6857a` / `84030bbe` 与 Ascend `2c59ff10` / `2ed6cbba` / `7d825229` / `baa023ad` 对比前端选组、MRV1 DP 补齐、组间结束共识与草拟模式差异。GLM 专用 `db701c1f` 另列在旧版格内；固定上游 `main` 仅作比较，不推定是某个 Ascend 镜像的实际安装版本。

| 机制 | v0.23 / GLM 旧基线 | v0.26 rc | rc2 | 固定 main |
|---|---|---|---|---|
| 前端选组 | waiting×4+running；同分按既有扫描起点 | 分数不变，但派发后旋转同分扫描起点 | 加入在途下限与 KV 压力，仍旋转起点 | 与 rc2 所列评分相同 |
| MRV1 的 DP 输入补齐 | db：调用方允许补齐或在草拟时统一宽度，否则保留本地宽度 | 所列条件相同 | 按同步后的图模式、通信方式及细粒度 TP 等条件判断 | 仍是旧 allow_dp_padding / 草拟条件，与 rc2 有差异 |
| 组间结束共识 | 每 32 步，旧算例末尾最多额外 31 步 | 仍每 32 步 | 每轮工作首步及配置间隔；默认 16 | 与 rc2 所列节奏相同 |
| GLM 模型与草拟 | 2c 无本页模型；db 专用模型，草拟强制 eager | 无本页同名 GLM 模型链；通用 GLM 判断仍强制草拟 eager | 专用多缓存组 proposer 可支持草拟图，仍尊重显式 eager | 通用 GLM 判断仍强制草拟 eager，没有 rc2 的该例外 |

- **前端选 DP 组的评分（`v0.30.0rc2` / `main`）**：基础分取“API 进程数 × 本前端在途数”与 `waiting + running` 的较大值，KV 使用率超过 50% 后还会增加 `waiting` 的权重，同分时旋转扫描起点。正文 `running + 4 × waiting` 是原固定部署的算法，不能直接用于 `rc2`。这个分数决定新请求进入哪个组，不是每组 Scheduler 的 token 预算；组内执行仍需看实际 runner，Ascend `rc2` 默认仍选 MRV1。
- **MRV1 的 DP 补齐条件（`rc2` vs `main`）**：`rc2` 的补齐不再使用 `allow_dp_padding` 入参。正常进行 DP 同步后，只要同步后的图模式不是 `NONE`、正在草拟、通信选中 MC2/AllGather、选中且使用 CANN MegaMoE 的 `FUSED_MC2`，或输出投影/词表/嵌入/MLP 任一细粒度 TP 大于 1，就统一 runner 输入宽度；否则保留各组本地宽度（另有明确跳过同步的特定路径）。这里比较的是 MRV1，不用这段代码推断 MRV2。固定 `main` 仍保留旧条件，不能按分支名字认定它已经包含 `rc2` 的每一项改变。
- **结束共识参数 `--dp-sync-interval`**：`ParallelConfig` 的 `dp_sync_interval` 为整数 `≥ 1`，默认 `16`，所有 DP rank 必须使用相同值；后续间隔之间至多多等 15 步，但每轮工作的首步还会检查。调小会更频繁地做全局集合通信，调大则可能增加尾部陪跑。它检查是否全局结束，与[调度器的 prefill 间隔](vllm-scheduler.md#多个-dp-组怎样对齐-prefill-的节奏)是两件事；正文“每 32 步、最多 31 步”只对应固定旧配方。
- **基线提交与硬件分支说明**：
  - 调度、选组、陪跑循环按 `vllm@0fc695fc` 读；输入准备、DP 对齐、MoE 通信按 `vllm-ascend@db701c1f` 读，这是官方镜像里跑 GLM 的那一版。
  - 每步两组对齐走的是 vllm-ascend 自己的 `_sync_metadata_across_dp`，一次 All-Reduce 同时带上 token 数和执行方式；上游 vLLM 的 GPU 路径另有一套对齐函数，在昇腾的 model runner 上不走。
  - MC2 与 AllGather 的二选一只在 A2 上成立；A3 的选择函数里另有 All-to-All 分支 [C23]。
  - vllm-ascend 另有 balance scheduling 等调度器变体，开关默认关（`vllm_ascend/envs.py` 103–105 行），本页按上游调度器写。
  - vllm-ascend 的 `main` 分支（`baa023ad`）把 GLM 的实现挪进了 `vllm_ascend/models/glm5next/` 目录，读这一版时模型文件的路径要换。

### 源码位置

| 想核对的事 | 读哪里 |
| --- | --- |
| 前端按 `waiting × 4 + running` 挑组，派出后本地先加计数 | `vllm/v1/engine/core_client.py` 1398–1426 行 |
| 请求头 `X-data-parallel-rank` 怎样取出 | `vllm/entrypoints/openai/engine/serving.py` 398–411 行 |
| 调度器没有 prefill、decode 两个阶段 | `vllm/v1/core/sched/scheduler.py` 342–351 行 |
| running 里的请求本步要几个 token，被预算夹住 | 同文件 403–416 行 |
| 这一步发生过抢占就不接纳新请求；running 满 32 条就停 | 同文件 562–570 行 |
| 新请求的提示词按剩余预算切块 | 同文件 684–700 行 |
| waiting 里的新请求要不到块时只停下、不抢占 | 同文件 761–781 行 |
| 池子里空闲块不够时返回 None | `vllm/v1/core/kv_cache_manager.py` 238–398 行 |
| 续块失败就从 running 末尾抢占一条 | `scheduler.py` 459–509 行 |
| 抢占：收回块号、已算位置清零、退回 waiting 最前面 | `scheduler.py` 974–995 行 |
| positions 与 query_start_loc 怎样拼 | `vllm_ascend/worker/model_runner_v1.py` 830–868、1018–1040 行 |
| KDA 按槽位号读写各请求的状态，新请求的状态先清零 | 模型层构造 `KimiGatedDeltaNetAttention`，v0.23 custom op 注册后落到 `vllm_ascend/ops/kimi_kda.py` 的实际 prefill/recurrent 分支；旧模型文件中的同类逻辑不能代替这条调用链 |
| 稀疏 MLA 按块表和槽位映射读写各请求的历史 | `glm5_next.py` 1201–1232 行 |
| token 数往上补到最近一档图尺寸；按条件选择图模式 | `vllm/v1/cudagraph_dispatcher.py` 的 `_compute_bs_to_padded_graph_size`（76–96 行）、`dispatch`（239–300 行） |
| 能不能用图的五条判据，两组对齐后重挑图尺寸 | `model_runner_v1.py` 2898–2996 行 |
| 两组交换 token 数与执行方式的那次 All-Reduce | `model_runner_v1.py` 692–740 行 |
| GLM 的草拟层强制 eager，所以草拟不补图尺寸 | `vllm_ascend/spec_decode/llm_base_proposer.py` 217–236 行 |
| 草拟模型一律补到两组最大值 | `llm_base_proposer.py` 895–906 行 |
| MoE 通信按两组 token 数的最大值选 | `vllm_ascend/ascend_forward_context.py` 90–101 行 |
| 容量 128 的算法与 A2 上的三个条件 | `ascend_forward_context.py` 200–252 行 |
| AllGather 路径的补齐、交换与 Reduce-Scatter | `vllm_ascend/ops/fused_moe/prepare_finalize.py` 440–495、543–560 行；之后的 TP All-Reduce 在 v0.23 专用文件 `fused_moe_0_23_0.py` 的 `AscendMoERunner._maybe_reduce_final_output`，不能只用 prepare/finalize 证明它 |
| 本地没活但全局有活时执行空批次，每 32 步查一次全局 | `vllm/v1/engine/core.py` 1869–1945 行 |
| 空批次只准备一条 decode 请求的 1 + 3 = 4 个 token | `vllm_ascend/worker/worker.py` 972–973 行，`model_runner_v1.py` 652–656 行 |
| 空批次同样经过两组对齐，草拟模型也陪跑 | `model_runner_v1.py` 3405–3452、3640–3652 行 |
| 混合步取哪 49 行做词表分数 | `model_runner_v1.py` 1262–1306 行 |
| 提示词没算完的请求，这一步采样出的 token 被丢掉 | `model_runner_v1.py` 1080–1099 行 |
| 每条请求各自检查停止条件，结束后归还块号 | `scheduler.py` 1695–1711、1888–1910 行 |

**推导对应与实测范围**

运行队列与本步调度集合的区别，对照固定上游 `scheduler.py` 876–881 行：注释明确部分 running 请求可能未被调度，断言检查本步调度请求数不超过运行队列长度。这是源码依据，不是硬件实测。

图尺寸表与三步对齐表是按给定请求数推导的执行宽度；MoE 两条路径的字节数按每卡、每层载荷累计，MC2 数字为含填充行的上界 [D]。空闲组的通信量由相同对齐路径推得，尚非实机测量 [D]。

- KV 算例里索引器状态组 decode 时 3–4 块、prefill 一步约 n ÷ 4 块，是按滑动窗口管理器的源码推出的，没有实跑确认；推导与出处见 [KV 块分配](vllm-kv-block-allocation.md#开销和什么时候别开)。
- 专家负载：真实流量下最忙的卡比平均多出多少行，缺一次实测的专家负载分布。
- 空批次：`_dummy_run` 的层内分支尚未逐行核对，个别层是否走简化路径仍待核；上文 MoE 通信量相近的判断来自已读代码路径。

- 来源 42、43：`vllm@0fc695fc`，`vllm/v1/core/sched/scheduler.py`，L562–L570、L689–L699。
- 来源 46–49、65：模型构造、v0.23 custom op 注册以及实际 KDA prefill、投机递推与真实 token 截取。来源 15–16 的模型文件中同类代码仅作背景，不能替代实际消费者。
- 来源 50、60–64：v0.23 专用 MoE runner 的选择、构造、输出合并与实际 TP 归约操作；来源 24–25 负责 DP prepare/finalize。
- 来源 51–55：v0.26 与固定 `main` 的路由及补齐规则，以及 `rc2` 不同的 MRV1 补齐条件。
- 来源 56–57、73–75：`rc2` 专用 proposer 的选择与草拟图例外，v0.26/`main` 的 GLM 强制 eager 条件。
- 来源 58–59、66–72：旧版的 32 步结束检查和 `rc2`/`main` 的可配置间隔、CLI、传递与执行条件。
