---
id: chunked-prefill
title: "Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住"
type: feature
summary: Chunked prefill 让调度器在一条长提示词装不下这一步时，只给它排剩余预算那么多个位置，下一步从断开处接着算；历史和状态跨段延续，只有最后一段产出首个 token。它让正在 decode 的请求每步照常前进，代价是长请求的首 token 更晚、旧历史要重复读、每步多一点杂活。
aliases: [Chunked Prefill, 分块预填充, 分块 Prefill]
chapters: ["11"]
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L352
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L401-L410
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L678-L700
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1019
  - vllm@0fc695fc:vllm/config/scheduler.py#L70-L90
  - vllm@0fc695fc:vllm/config/scheduler.py#L238-L272
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2394
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2258-L2267
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2518-L2528
  - vllm@0fc695fc:vllm/config/model.py#L1803-L1810
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L330
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L858-L867
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1078-L1099
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1470
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2636
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L477-L498
  - vllm@0fc695fc:docs/configuration/optimization.md#L41-L62
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L713-L718
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L467
  - vllm@568afb3a:vllm/config/scheduler.py#L153-L156
  - vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1026-L1076
  - vllm@84030bbe:vllm/config/speculative.py#L1811-L1850
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L188
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1350
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225
  - https://arxiv.org/abs/2308.16369
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433
verified: []
evidence: "C"
relations:
  - { to: prefill, kind: variant-of, note: 同一条请求的 prefill 分到几步做，只有最后一段产出首个 token }
  - { to: vllm-scheduler, kind: builds-on, note: 切多长由调度器每步的「还差几个」和剩余预算决定 }
  - { to: concurrent-requests, kind: builds-on, note: 多条请求时 20,000 token 提示词每一步的预算账 }
  - { to: vllm-kv-block-allocation, kind: builds-on, note: 每一段要借多少块，尾状态组为什么临时借两千多块 }
  - { to: pd-disaggregation, kind: alternative-to, note: 分块把 prefill 压到每步预算内；PD 分离让 prefill 和 decode 不在同一步 }
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 一条很长的提示词，能不能分几步算完？

**chunked prefill（分块预填充）是调度器处理长提示词的方式：一条提示词在这一步装不下时，只给它排这一步剩下的预算那么多个位置，先算前一段、把这一段的历史存好，下一步从断开的位置接着算，直到整段提示词算完，才选出回答的第一个 token。**

prefill 是一条请求的第一步：把提示词里的 token 一起送进模型算一遍，给每个位置留下后面要读的历史，并用最后一个位置选出回答的第一个 token；之后每步只接着写一个新 token，叫 decode。两者的区别见 [Prefill 与 Decode](prefill.md#回答的第一个字出来之前模型在算什么)。「一步」是模型对一批请求做的一次前向；一步最多算多少个位置，由调度器的 token 预算封顶，这个预算为什么按位置而不按请求条数算，见[调度器](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)。

下面用示意数感受一下。假设每步最多算 8 个位置。A、B 两条请求已经在生成回答，每步各算 1 个位置；这时来了一条新请求 C，提示词有 14 个 token，占位置 0–13。

```wiki-diagram
file: chunked-prefill
```

- **每一步先照顾 A、B。** 它们各拿 1 个，8 个里还剩 6 个，全给 C。
- **C 的 14 个位置分三步算完。** 第 1 步算位置 0–5，第 2 步算 6–11，第 3 步算 12–13。三段不是三份各自独立的提示词：第 2 段从位置 6 接着编号，并读第 1 段存下的历史。
- **只有最后一段产出回答。** 每一步末尾，模型都会在 C 本步最后一个位置上选一个 token，但前两步提示词还没读完，选出来的直接扔掉；第 3 步算完位置 13，选出的 y₀ 才是 C 的第一个输出 token。
- **第 4 步起 C 也转入 decode。** 它送进 y₀，和 A、B 一样每步 1 个位置。
- **A、B 一步也没停。** 这 4 步里它们每步都前进 1 个位置。

## 为什么要切：不切的话，一步会被一条长提示词撑大

没有分块时，一条提示词只能一步算完。要让 C 进得来，每步的预算就得开到装得下整段提示词（真实部署里要装得下允许的最长输入），C 进来的那一步就变大了：

```calc
title: C 进来的那一步有多大（示意）
不切，C 一步算完 = 1 + 1 + 14 = 16 个位置
切开，每步最多 = 1 + 1 + 6 = 8 个位置
> A、B 的下一个 token 都要等所在的那一步整步算完
```

同一步里的请求是一起算完、一起拿结果的。A、B 各只差 1 个位置，也得等这 16 个位置的一整步算完，才拿到下一个 token。提示词越长，这一步越大：一条几万 token 的提示词，会让正在生成的请求在这一步上明显卡一下。切开以后每步最多 8 个位置，A、B 每步照常前进，长提示词的工作量被摊进几步，每步只多出一小段。衡量这种卡顿的指标是 ITL（inter-token latency，同一条请求相邻两个输出 token 之间隔多久）。

分块还带来第二个好处：每一步都能把 decode 和一段提示词拼在一起算。decode 的位置少，一步里的时间主要花在读权重上；提示词的位置多，同一遍读进来的权重能多用很多次。两类工作拼进同一步，读一遍权重同时服务两边，为什么这样更划算见 [Prefill 与 Decode](prefill.md#为什么把已知的位置合成一步代价在哪)。

没有分块还有一个麻烦出在排队上：一条新请求整段装不下这一步的余量时，调度器不会切开它，而是这一步干脆不再接纳新请求，排在它后面的短请求也跟着等。

预算封住的是一步算多少个位置，不是一步花多少毫秒。每步实际多久，还要看模型、历史长度、同批的请求和通信。

## 代价在哪：首个 token 更晚，旧历史要再读几遍

切开不是白来的，代价有三处。

**C 的第一个 token 要等三步。** 不切时，C 在进来那一步末尾就有 y₀，只是那一步很大；切开后前两步都只在「读题」。衡量这段等待的指标是 TTFT（time to first token，从请求到达到第一个输出 token 的时间）。每步预算越小，ITL 越稳，但长提示词要分的步数越多、TTFT 越长；预算越大正好反过来。

**每一段都要把前面的历史再读一遍。** 注意力让每个位置去读自己和前面各位置存下的 K、V（这份存储叫 [KV cache](kv-cache.md)）。第 2 段的位置要读第 1 段的历史，第 3 段要读前两段的：

```calc
title: 切成三段，注意力的账怎样变（示意，普通因果注意力）
不切，读一遍历史 = 14 个位置
切开，三步各读一遍 = 6 + 12 + 14 = 32 个位置
打分的位置对，切不切都一样 = 1 + 2 + … + 14 = 105 对
> 位置 i 只和 0 到 i 打分，与它在哪一步算无关
```

多出来的是旧历史从显存里被重复读出的量，不是打分次数。所以 chunked prefill 从来不是省计算的办法，它做的是把一次很重的 prefill 摊成几次不那么重的。

**每一步都多一点杂活。** 步数多了，调度、准备输入这些每步都有的开销也多做几次；前两步还在 C 的最后一个位置上白做一次词表投影和采样，结果扔掉。白做的只有这一个位置，不是整个前向重走一遍。

调一次预算好不好，要同时看 TTFT、ITL、总吞吐，以及长、短请求各自的分布，并记下当时的并发、输入输出长度和实际生效的预算。只看平均吞吐会掩盖长请求等得久，只看短请求的 ITL 又会忽略长提示词推进得慢。

## 怎么切：每一步都是同一道减法

调度器里没有一个单独的「切块模式」。它对每条请求只记两个数：应该算到第几个位置、已经算到第几个位置，两者之差就是还差几个。每一步先续已经在跑的请求（running 队列），再用剩下的预算接纳刚到的请求（waiting 队列），对每条请求做同一道减法：本步给它的位置数，取「还差几个」和「剩余预算」里小的那个。两个队列和每一关的细节见[调度器](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)。

短提示词一步就差完了；长提示词差不完，剩下的自然留到下一步。切块只是这道减法减不完时留下的余数。C 的三步是：

```calc
title: C 的 14 个位置怎样切成 6、6、2（示意）
第 1 步 = min(14 − 0, 8 − 2) = 6
第 2 步 = min(14 − 6, 8 − 2) = 6
第 3 步 = min(14 − 12, 8 − 2) = 2
> 每步先扣掉 A、B 的 2 个；第 3 步只用掉 4 个，余下的可以再排别的新请求，没有也不必填满
```

第 1 步 C 还在 waiting 里；排进这一步以后，它就留在 running 里，第 2、3 步和 A、B 一起先被续上。每一步排完，调度器不等模型算完，就先把 C 的「已算」往前推：0 → 6 → 12 → 14，下一步直接从新位置接着排；同时记下「这条请求的提示词还没算完」。

这份安排交给执行侧以后，一段提示词在一步里依次经过主线七站（一条请求从进门到返回要走的七个环节，见[一条请求](one-request.md#一条请求要走过七站)）里的第 2 到第 5 站：

```wiki-diagram
file: chunked-prefill-flow
```

1. **第 2 站 调度。** 定下这一段排几个位置，已算数前推。
2. **第 3 站 准备输入。** 执行侧从已算数开始编位置号：第 2 段的位置号是 6、7……11，不从 0 重来。每个位置的历史要写进哪一格（格号），按这条请求的 [block table](block-table.md)（块表：记着请求借到了哪几个 KV 块）查出来。整批还会贴一个执行标签：一批里既有 decode 又有一段提示词，或者一段提示词接着前面算，都贴 ChunkedPrefill，意思是「有一部分历史已经在缓存里」。这些张量怎样拼成一批，见[输入准备](prepare-inputs-flow.md)。
3. **第 4 站 前向。** 注意力读前面各段存下的历史和本段新算的；线性注意力从上一段留下的状态接着推；本段的历史写进格号指定的地方。
4. **第 5 站 采样。** 每条请求都在自己本步最后一个位置选一个 token。C 的提示词还没算完，这个 token 丢掉，下一步回到调度；算完了，选出的就是第一个输出 token，从下一步起 C 按 decode 排。

## 历史状态必须跨段延续

切成几段，听上去像要把几段结果「拼起来」，其实没有拼这一步。靠的是三样东西接得上。

- **位置号接得上。** 第 2 段从位置 6 开始编，[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)（每个位置只能看自己和前面的位置）照常生效：位置 6 看得到 0–6，位置 11 看得到 0–11。所以每个位置算出来的结果和不切时一样，分段不改位置编号，也不改因果关系。
- **历史接得上。** 第 1 段写进 KV cache 的内容原样留着，第 2 段只追加新位置，做注意力时把旧的读进来。[线性注意力](linear-attention.md)（每条请求只存一份固定大小的状态，读新 token 时原地更新）不存逐个位置的历史：分段时，它读入上一段算完的状态作为初始状态，这一段算完再写回最终状态。
- **请求之间互不干扰。** A、B、C 在同一步里一起算，但各用各的位置号、各自的块和状态槽；A 的 decode 读的是 A 的历史，C 的一段读的是 C 的历史。

丢弃只针对本步结束后「已算」还没追上提示词长度的请求：这次选出的 token 不追加到请求上，也不返回给客户端；请求自带随机种子时，随机数生成器还会往回拨，免得这次白采样打乱之后真正的采样。

## 细节：切点、单条上限和关掉分块

- **切点不看 KV 块的边界。** token 预算管一步算多少个位置；KV 块大小管历史按多大一格存、怎样寻址。两者可能碰巧相等，含义不同。调度器按预算切，一段可以停在某个块的中间，下一段接着往这个块里写。例外是混合模型（既有普通注意力层、又有线性注意力层）开了 prefix caching（开头相同的请求复用已经算好的历史），而模型不支持逐块保存线性注意力状态、落到按块对齐存档的模式时：调度器把每段向下取整到块大小的整数倍，最后不足一块的尾巴照常算。支持逐块保存状态的模型不需要这样对齐。
- **单条请求一步的上限。** 可以另设「一条请求一步最多拿多少个位置」，它在剩余预算之前先截一刀，running 和 waiting 两边都截。默认是 0，表示不设。假如示意里把它设成 4，C 就要按 4、4、4、2 分四步，前三步各给别的新请求留出 2 个位置，代价是 C 的第一个 token 再晚一步。
- **关掉分块。** 生成式模型默认开着 chunked prefill。手动关掉后，一条比余量长的新请求不会被切开，这一步停止接纳新请求；为了让最长的输入也能一步装下，启动时要求每步预算不小于允许的最长输入，否则直接报错；上游还会警告，关掉它可能让引擎崩溃或算出错误结果。原文见页末。
- **每步实际切多少，不只看预算。** 在跑的请求数、KV 块够不够、已算进度、为 speculative decoding（投机解码：先草拟几个候选 token，下一步一起验证）预留的位置，以及块不够时的抢占，都会改变某一步排给长提示词的量。示意图里的 6、6、2 是能手算的安排，不代表调度策略对各请求公平。
- **昇腾自带的变体。** 镜像里还有按性能剖析决定每段切多长的 ProfilingChunkScheduler、按时延目标动态调预算的调度器等，本部署都没启用，见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)和 [profiling chunk 配置](../params/profiling-chunk-config.md)。

## 放到 GLM 双机：20,000 个 token 的提示词分三步

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。两台机器各是一个 DP 组（各自独立排请求的执行组），各有一个调度器，每组每步预算 8192 个位置、最多 32 条请求，见[调度器的 GLM 一节](vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)。chunked prefill 本部署按默认开着。每条 decode 请求一步算 4 个位置：1 个确定的 token，加 3 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步先草拟 3 个候选，下一步由主模型一起验证）。

所以新提示词比「8192 − 4 × 在跑的条数」还长才会被切；新请求能进来时，这个门槛最低是 8068，推导见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)。主线的示例请求 [R1](one-request.md#示例请求-r1-与官方双机部署) 提示词只有 4 个 token（教学设定），[场景 M](concurrent-requests.md#示例场景-m-与变体-m)（一个 DP 组里已有 12 条请求在 decode，又来一条 6000 token 的新请求）的新提示词也一步装得下，它们都用不上分块。

把场景 M 的新请求换成一条 20,000 token 的提示词：前两步各算 8144 个位置、把预算用满，第 3 步算最后 3712 个，本步末得到第一个输出 token，第 4 步起它也每步 4 个；逐步的预算账在[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)。和示意图一样，那 12 条 decode 请求在这 4 步里每步都照常前进。

执行侧，这三步和纯 decode 步有几处不同：

- **不回放图，MoE 通信换路径。** 这几步整批贴 ChunkedPrefill 标签，走 eager mode（由 CPU 逐个下发算子），不回放录好的 decode 图；一步超过 128 个 token，MoE 层（每个 token 只挑几个专家来算）的通信改走 AllGather（两台机器先互相收齐这一步全部 token 的隐藏向量，每张卡再挑出路由给自己专家的那些），两台机器一起改，见[并发页的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。
- **34 层 KDA 接着上一段的状态算。** KDA 是 GLM 的线性注意力层，每条请求只存一份固定大小的状态。每一段在 KDA 算子里面还会再切成每 64 个位置一小段并行算，那是 KDA 自己的算法，和调度器的分块是两回事，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **11 层稀疏 MLA 在前面全部位置里挑着读。** 稀疏 MLA 是 GLM 的另一类注意力层，每个查询只挑一部分历史位置来读。第 2 段的查询面前已有 8144 个以上的位置：indexer（一个很便宜的打分网络）先给因果范围内的历史打分，主注意力只读挑中的那部分，清单每行最多 2051 个位置。所以真实读取量不是「各段历史长度之和」，见[稀疏注意力](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。
- **切点不对齐到块。** 一个逻辑块是 640 个位置，8144 = 12 × 640 + 464，第 2 段从第 13 块的第 465 格接着写。本部署关着 prefix caching，KDA 的缓存不按块存档，调度器不需要对齐切分；昇腾为按块对齐准备的 GLM 补丁在本部署不生效。开了 prefix caching 会怎样，见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。

分块还决定了每一步要借多少 KV 块。GLM 的块分 5 个缓存组（存储格式和借块规则相同的一组层）：full 组存稀疏 MLA 和 indexer 的逐位置历史，每 640 个位置一块；三个 KDA 组每组固定 4 块；尾状态组暂存 indexer 还没凑满 4 个的位置，窗口和块都是 4 个位置，见[块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。每一步借块时，还要为下一步的 3 个 MTP 候选多留 3 个位置：

```calc
title: 20,000 token 提示词每一步借块（DP0，这一条请求）
full 组第 1 步 = ceil((8,144 + 3) ÷ 640) = 13 块
full 组第 2 步再借 = ceil((16,288 + 3) ÷ 640) − 13 = 13 块
full 组第 3 步再借 = ceil((20,000 + 3) ÷ 640) − 26 = 6 块
尾状态组第 1 步手里 = ceil(8,147 ÷ 4) − 0 = 2,037 块
尾状态组第 2 步手里 = ceil(16,291 ÷ 4) − floor(8,141 ÷ 4) = 2,038 块
尾状态组第 3 步手里 = ceil(20,003 ÷ 4) − floor(16,285 ÷ 4) = 930 块
> 尾状态组：前一项是到这一步为止累计借过的块号数（含已还的），后一项是窗口外已还的块数；KDA 三组始终 12 块
```

尾状态组的数最扎眼。它要为本步全部新位置留格子，一段 8144 个位置当步就借 2037 块，按每块 7.969 MiB 约 15.9 GiB，占这个 DP 组 3,855 块池子（算例，见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）的一半多，比 full 组的 13 块多两个数量级；下一步已算数追上来，窗口外的整块马上还回去。第 3 段只有 3712 个位置，手里回落到 930 块；第 4 步进入 decode 后回到 3 块，此后在 3–4 块之间变动。所以在这套部署上，每段切多长不只影响这一步的计算量，也决定这一步临时要占多少块。

这些都是按源码推出来的静态账，本页没有 GLM 双机上开关分块或调预算的实测数。没有设备时，可以照上面的算式复算每一步的预算和已算位置，并沿[输入准备](prepare-inputs-flow.md)检查每一段的起始位置号和它读到的历史是否一致。

## 常见误解

- **「chunked prefill 是要手动打开的优化」**——生成式模型默认就开着，本部署也开着。能调的是每步预算多大、单条请求一步最多拿多少，而不是「切不切」。
- **「切开以后总计算量变少了」**——没有变少。打分的位置对切不切都一样多，还多了重复读旧历史和每步的杂活；它换来的是每一步的工作量有上限。
- **「每一段都会吐出一个 token」**——只有最后一段产出第一个输出 token。中间几段也会采样，但结果当场丢掉。
- **「后一段要把前几段的结果拼起来」**——没有拼这一步。后一段从下一个位置号接着算，读前面存下的历史和状态。
- **「关掉它，正在生成的请求就不会被 prefill 拖慢」**——正相反。关掉后每步预算要开到装得下最长输入，一步里涌进来的位置只会更多。真正让 prefill 不和 decode 挤在同一步的做法，是把两者放到不同的节点上，也就是 [PD 分离](pd-disaggregation.md)。
- **「每一段正好是一个 KV 块」**——预算和块大小是两回事。本部署一段 8144 个位置，块是 640 个位置，切点落在块中间。
- **「KDA 的 64 位置分段就是 chunked prefill」**——不是。那是一步之内 KDA 算子重排计算的方式；chunked prefill 是调度器把一条提示词分到好几步里。
- **「每步 8192 个位置，就是每步时延有了固定上限」**——预算封的是位置数，不是毫秒。每步多久还取决于历史长度、同批请求和通信。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。

### 怎么开

- **默认开着。** `SchedulerConfig.enable_chunked_prefill` 字段兜底是 `True`，docstring 说这个默认值主要为测试方便，真正生效的值由 `EngineArgs` 定 [C5]；用户没写时，`_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`，生成式模型只有 encoder-decoder 返回 False [C7]。开着时启动日志有一行 `Chunked prefill is enabled with max_num_batched_tokens=%d.` [C6]，本部署应打出 8192。
- **每步预算**：`--max-num-batched-tokens`，本部署 8192；不给时昇腾上落到多少，见[调度器的怎么开](vllm-scheduler.md#怎么开)。
- **单条上限**：`--long-prefill-token-threshold`，字段默认 0，大于 0 才截。running 一侧先截它、再 `min(num_new_tokens, token_budget)`；waiting 一侧先截它，再判断关没关分块，最后 `min` [C3]。docstring 说它是「prompt 比这个数长就算长请求」的分类阈值，代码里它是直接把本步 token 数截到这个值的一道闸 [!]。只有 `max_num_partial_prefills > 1` 时它才会被自动设成 `max_model_len` 的 4%，而 V1 只要这两个 partial prefill 参数被改过就抛 `NotImplementedError` [C8]，所以它只能手写。
- **切点对齐**：`need_mamba_block_aligned_split` 只在有 mamba 类层且 `mamba_cache_mode == "align"` 时为真；`_mamba_block_aligned_split` 在 prefill 阶段把 `num_new_tokens` 向下取整到 `block_size` 的整数倍，不足一块的尾巴照算 [C12]。GLM 镜像用补丁换掉这个函数：对齐单位改用调度器的 `self.block_size`（完整 KDA 状态能存档的边界），而不是可能被改写成 4 的 `cache_config.block_size` [C13]。本部署 `mamba_cache_mode = "none"`，这些都不生效 [D]。
- **块大小会被顺手改。** 昇腾的 `refresh_block_size` 对普通注意力模型：开着 chunked prefill 或 prefix caching、块大小又不是 128 时，静默改成 128，只打一条 info 日志；`deepseek_v4` 和混合结构模型在更早的分支里返回，不受影响。GLM 属于混合结构，逻辑块 640 另有算法，见 [KV cache 规格](kv-cache-spec.md#配置阶段逻辑块先定成-640)。

### 会报什么错

- **`ValueError: max_num_batched_tokens (...) is smaller than max_model_len (...)`**：关掉分块、且显式给的预算小于 `max_model_len` 时，`verify_max_model_len` 抛出。没显式给预算时，`EngineArgs` 先把预算抬到 `max(max_model_len, 默认值)` 再校验，不报错 [C9]。本部署显式给 8192、`max_model_len` 是 133120，关掉分块就起不来 [D]。
- **warning**：生成式模型手动关分块时打一次 `This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- **`NotImplementedError`（Concurrent Partial Prefill）**：改了 `max_num_partial_prefills` 或 `max_long_partial_prefills` 就抛。
- **断言 `Chunked prefill is required for mamba cache mode 'align'.`**：混合模型落到 align 模式、分块却关着时，启动断言失败 [C21]。
- 关掉分块后，新请求比余量长时 waiting 循环直接 `break`，不报错，只是这一步不再排新请求。

### 开销和什么时候别开

- **已算数在前向之前就前推。** `_update_after_schedule` 把本步数量加进 `num_computed_tokens`，再按「是否仍小于 `num_tokens + num_output_placeholders`」置 `is_prefill_chunk` [C4]；执行侧的位置号是 `num_computed_tokens_cpu` 加本步序号。
- **白采样当场扔掉。** runner 按 `optimistic_seq_lens < num_tokens` 算出 `discard_requests_mask`，下标写进 `discard_request_indices` [C15]；采样之后，对这些请求把带种子的随机数生成器 offset 往回拨 4 [C17]。
- **执行标签。** `_build_attn_state` 依次判断：整批都没算过是 `PrefillNoCache`；整批每条 1 个 token 是 `DecodeOnly`（开 MTP 时改成 `SpecDecoding`）；有效 token 全是 1 且开了投机是 `SpecDecoding`；剩下的，开着分块叫 `ChunkedPrefill`，关着叫 `PrefillCacheHit` [C16]。一条长提示词单独进来时，第 1 段是 `PrefillNoCache`、后几段是 `ChunkedPrefill`；和 decode 混批时每段都是 `ChunkedPrefill` [D]。
- **历史怎样跨段读。** KDA 的 prefill 按 `has_initial_state` 取上一段的状态或清零，`output_final_state=True` 写回 [C18]；稀疏 MLA 的元数据里 KV 长度取 `seq_lens`，即含已算前文的全长，位置清单宽度是 `index_topk + index_kpool − 1` [C19]。
- **预算往哪个方向调。** 官方优化文档：小预算（例如 2048）ITL 更好，大预算 TTFT 更好 [S20]。本部署没有实测数。
- **要逐位可复现时得关。** main 的 batch invariance 文档写明：chunked prefill、prefix caching 和抢占都不支持 batch invariance，要显式关掉前两者，并把关分块和 `--block-size 128` 配在一起 [S27]。本部署照做还要先解决上面那条预算小于最长输入的报错。
- **它不等于 PD 分离。** 分块只把混进 decode 步的 prefill 压到每步预算以内；要让两者不在同一步，见 [PD 分离](pd-disaggregation.md)。

### 版本差异

| 项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 默认开、单条上限默认 0、关分块时 waiting 直接停 | 有 | 同 | 同；截断时多比一道为并行草稿方法预留的输入预算 [C25]，MTP 的预留是 0，GLM 的切法不变 [C26] |
| DP 组之间对齐 prefill 的节流 | 无 | 新增 `throttle_prefills`：`prefill_schedule_interval > 1` 时非对齐步推迟新 prefill；默认 1，不触发 [C23] | 同 v0.26 |
| 昇腾谁会替你打开它 | `2c59ff10` 与 `db701c1f`：设了 `SLO_limits_for_dynamic_batch` 就顺手置 `enable_chunked_prefill = True` [C22] | 这段删掉，不碰这个开关 | 同 v0.26 |
| 执行标签与丢弃采样 | 如上 | 判据相同 [C28] | 相同 |
| batch invariance 文档 | 不提 chunked prefill | 不提 | 写明要关掉 chunked prefill 与 prefix caching，并配 `--block-size 128` |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 「调度器没有 prefill、decode 阶段」的注释 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头 [C1] |
| running、waiting 两道减法，单条上限，关分块时停 | 同文件两个 `while` |
| 已算数前推、`is_prefill_chunk` | 同文件 `_update_after_schedule` |
| 字段默认、自动阈值、启动日志、`verify_max_model_len` | `vllm/config/scheduler.py` |
| 默认开不开、手动关的警告、partial prefill 报错 | `vllm/engine/arg_utils.py` |
| 对齐切分 | 上游 `_mamba_block_aligned_split`，开关在 `__init__`；GLM 补丁 `patch_glm5_next_mamba_scheduler.py`；APC 与 align 同开时的状态块大小在 `patch_mamba_config.py` [C29] |
| 位置号、执行标签、丢弃采样 | `vllm_ascend/worker/model_runner_v1.py` |
| KDA 接状态 | `vllm_ascend/ops/kimi_kda.py` |
| 稀疏 MLA 的 KV 长度与清单宽度 | `vllm_ascend/attention/indexer_kpool_mla_v1.py` |
| 概念出处 | SARATHI 论文：把长 prefill 切成等长的块，让 decode 搭在同一批里一起算 [S30]；vLLM 优化文档里的两条好处与调参方向 |

**待核。**

1. 本部署启动日志里 `Chunked prefill is enabled with max_num_batched_tokens=8192.` 这一行，缺实机日志确认 [!]。
2. 开关分块、调整每步预算对 GLM 双机 TTFT 与 ITL 的影响，没有实测数。
