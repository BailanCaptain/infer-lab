---
id: chunked-prefill-agy
title: Chunked prefill（重构对照版）：长提示词插进来，怎样不卡住别人的回答？
type: feature
summary: >-
  Chunked prefill 把这一步剩余预算装不下的长提示词拆成几段、分多步算完：每步先让正在生成的请求照常前进，只拿剩余位置预算推进长提示词的一段，跨步沿用已存历史与状态，直到最后一段算完才产出首个回答 token。它压住了同批大步对在线生成的拖累，代价是长请求首字更晚、前文历史跨段重读以及步数增加带来的单步杂活。
aliases:
  - Chunked prefill Antigravity 对照版
chapters: []
toc:
  part: references
  section: 新增教学页（待编排）
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L352'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L401-L410'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L678-L700'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1019'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L70-L90'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L238-L272'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2394'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2258-L2267'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2518-L2528'
  - 'vllm@0fc695fc:vllm/config/model.py#L1803-L1811'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L338'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L858-L867'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1078-L1099'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1470'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2671'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L477-L498'
  - 'vllm@0fc695fc:docs/configuration/optimization.md#L41-L62'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L713-L718'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L467'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L153-L156'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1026-L1076'
  - 'vllm@84030bbe:vllm/config/speculative.py#L1811-L1850'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L188
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1350'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225
  - 'https://arxiv.org/abs/2308.16369'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433'
  - >-
    raw:sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md#L1-L725
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L689-L699
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/engine/arg_utils.py#L2370-L2377
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2816'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L70-L74'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L185-L194'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1067-L1075'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L38-L38'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L2015-L2022'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L500'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L828-L835'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1059-L1062'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L2171-L2178'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L606-L645'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1021-L1029'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1289-L1294'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2731'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2569-L2582'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L239-L310'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L249-L283'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L259-L290'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L448-L501'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L767-L793'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1121-L1132'
verified: []
evidence: C
relations:
  - to: chunked-prefill
    kind: alternative-to
    note: 同一机制的重构对照版，保留全部源码事实与 3D 场景并重排认知阶梯
  - to: chunked-prefill-v2
    kind: alternative-to
    note: 与早期循序渐进样板并排对比首屏直觉、收益代价收束与四版本对照
  - to: chunked-prefill-v3
    kind: alternative-to
    note: 同主题并行对照稿，保留不覆盖以便在阅读页并排审阅
  - to: prefill
    kind: variant-of
    note: 同一条请求的 prefill 分到几步做，只有最后一段产出首个 token
  - to: vllm-scheduler
    kind: builds-on
    note: 切多长由调度器每步的「还差几个」和剩余预算决定
  - to: concurrent-requests
    kind: builds-on
    note: 多条请求时 20,000 token 提示词每一步的预算账
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 每一段要借多少块，尾状态组为什么临时借两千多块
  - to: pd-disaggregation
    kind: alternative-to
    note: 分块把 prefill 压到每步预算内；PD 分离让 prefill 和 decode 不在同一步
contradicts: []
updated: '2026-11-14'
origin: gap
rawSources:
  - >-
    raw/sha256-a784826e7872c29e9344402dd0c34d9437753b13b503dd7eb663ea72c2414099.md
  - >-
    raw/sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md
---

## 长提示词插进来，怎样不卡住别人的回答？

**chunked prefill（分块预填充）是调度器拆解长提示词的做法：一条提示词在本步装不下时，只给它排本步剩下的位置预算那么长，先算这一段并存好历史，下一步从断开处接着算，直到整段提示词算完才选出回答的第一个字。**

用户仍然一次提交完整提示词，切分只发生在服务内部。理解它只需要先对齐四个词：文本按 **token**（字或词片段）占序列位置；模型把一批输入一起跑完一次前向计算叫**一步**，每一步允许新算的总位置数由调度器的**位置预算**封顶（为什么按位置而非请求条数设上限，见[调度器](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)）。新请求进来先读完提示词、建立后续生成所需的历史并选出首个输出 token，这叫 **prefill**；随后每步接着往后续写（普通路径逐个推进，投机路径可一轮验证多个候选），这叫 **decode**，两者区别见 [Prefill 与 Decode](prefill.md#回答的第一个字出来之前模型在算什么)。

拿一组能手算的示意数直接对比。设每步位置预算为 **8**：请求 **A、B** 已经在 decode，每步各送入上一次选出的 1 个 token、再采样选出下一个；此时新请求 **C** 到达，提示词有 **14 个 token**（位置 0–13）。

```wiki-diagram
file: chunked-prefill-v3-compare
```

把上下两种排法对照着看，差别立竿见影：

- **不切时，同批请求一起被大步拖住。** 在单条请求上限保持默认的场景下，关闭分块要求 C 的 14 个位置一步算完（真实部署则要求预算装得下允许的最长输入）。同一步里的请求必须一起算完才拿结果，A、B 明明各只差 1 个位置，也得陪等这 `1 + 1 + 14 = 16` 个位置的大步跑完。
- **切开后，每步先保住 A、B，拿余量喂给 C。** 预算封在 8 个位置：A、B 先各占 1 个，余下 6 个全给 C。C 按 **6、6、2** 分三步读完位置 0–5、6–11、12–13，第 2、3 段直接读取前段已经存下的历史，而 A、B 在这四步里每步都照常前进 1 个位置。
- **只有最后一段才吐出首个回答。** 模型每一步都会在 C 本段末尾位置顺手采样一次，但前两步提示词还没读完，采出的结果当场丢弃，不追加到请求输出也不返回客户端；第 3 步算完位置 13 选出的 **y₀** 才是真正的首个输出 token。第 4 步起 C 送入 y₀，也转成每步 1 个位置的 decode。

## 收益与代价：救了同批等待，拿什么去换？

把一条长提示词拆进多步，本质上是用「长请求多走几步」去换「单步工作量封顶」。账本两面要放在一起算。

**换来的三项收益：**

1. **压住在线生成的单步停顿。** 正在看回答的用户关心相邻两个输出 token 之间隔了多久，即 **ITL（inter-token latency，词间延迟）**。不切时，一条几万 token 的长提示词一进来就会撑大整步，让同批所有 decode 请求明显卡顿；切开后，长提示词的负担被摊进多步，每步混入的新位置都有预算封顶。
2. **不堵住后面排队的短请求。** 关闭分块且单条请求上限保持默认 0 时，只要等待队列头部的请求装不进本步剩余预算，调度器这一步就不再接纳新请求，排在它后面的短提示词也只能跟着干等；开启分块后，余量有多少就能先吃进多少，短提示词装得进余量还能一步算完。
3. **顺路合批复用权重。** decode 每条请求的新位置很少，和一段提示词合进同一批后，多行输入共用同一份模型权重，也能分摊单步固定的调用开销。理想情况下的复用账见 [Prefill 与 Decode](prefill.md#为什么把已知的位置合成一步代价在哪)，实际显存读量、是否更快以及主要瓶颈仍取决于缓存、内核与批次形状。

**付出的三笔代价：**

1. **长请求自己的首字更晚。** 提交长文的用户关心从请求到达到拿到第一个输出 token 的时间，即 **TTFT（time to first token，首字延迟）**。不切时 C 在进场那一步末尾就拿到 y₀；切开后前两步都只读题不交卷，中间还穿插着 A、B 的计算。
2. **前面存下的历史要跨段再读。** 在保留完整因果历史的普通注意力里，位置 i 必须读取 0 到 i 的历史向量。按「每个调度段内部充分复用、每段把可见历史范围计一次」比较逻辑历史访问范围（这是算法层面的覆盖范围，不是昇腾卡 HBM 高带宽显存的实际读取次数）：

```calc
title: 切成三段后，注意力的逻辑访问范围与打分对数（示意，普通因果注意力）
不切，可见历史范围计一次 = 14 个位置
切开，三段可见历史分别计一次 = 6 + 12 + 14 = 32 个位置
因果打分的位置对，切不切都一样 = 1 + 2 + … + 14 = 105 对
> 位置 i 始终只和 0 到 i 打分，与它落在哪一步算无关
```

分块没有删掉任何一对因果打分，**总算力一丝没省**，反而多出了跨段重复覆盖的前文范围；硬件上到底多读多少次显存，还要看算子内部分块与片上缓存复用。

3. **步数变多，单步固定杂活多做几轮。** 拆成三步就要多跑两轮调度与输入准备；前两步还在 C 本段最后一个位置上白做一次词表投影（把隐藏向量变成全词表候选分数）和采样，再把结果扔掉——好在白做的只有段末这 1 个位置，不是整段前向重走一遍。

看清这本账后，调预算时要守住一条铁律：**位置预算封住的是「一步算几个位置」，不是「一步花多少毫秒」。** 同样 8 个位置，前置历史长短、同批请求构成和跨卡通信不同，真实耗时也不同；因此调小预算不保证 ITL 一定更稳，调大预算也不保证 TTFT 一定更短。判断一次调参好不好，必须在真实负载下同时看长短请求各自的 TTFT、ITL 分布与总吞吐，并记下当时的并发、输入输出长度与实际生效的预算。

## 调度器怎么切：每一步只做同一道减法

调度器里并没有一个单独的「切块模式」，甚至不区分 prefill 阶段和 decode 阶段。它对每条请求只维护两个数：**应该算到第几个位置**、**已经算到第几个位置**，两者相减就是「还差几个」。

每一步开头，调度器按固定先后顺序排两个队列：先续上已经在跑的 **running 队列**，再用剩下的预算接纳刚到或退回等待的 **waiting 队列**（两队列与各道关卡见[调度器](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)）。在允许分块的前提下，每条请求分到多少位置都只做同一道减法——取「还差几个」和「剩余预算」里的较小值（若关闭分块，waiting 里的新请求经单条上限截断后仍超剩余预算时，直接退出本轮接纳循环）：

```calc
title: C 的 14 个位置怎样切成 6、6、2（示意）
第 1 步 = min(14 − 0, 8 − 2) = 6 个位置
第 2 步 = min(14 − 6, 8 − 2) = 6 个位置
第 3 步 = min(14 − 12, 8 − 2) = 2 个位置
> 每步先扣 A、B 的 2 个；第 3 步全批只用 4 个位置，余下预算可继续排别的新请求，没有也不必凑满
```

第 1 步前 C 在 waiting 队列；一旦排进第 1 步，它就转入 running 队列，第 2、3 步和 A、B 一起优先续算。注意记账时机：每步排完当下、前向真正跑起来之前，调度器就先把 C 的「已算位置数」按 `0 → 6 → 12 → 14` 往前推，并打上「提示词尚未算完」的标记，好让下一步直接从新起点接着排。

计划发往执行侧后，长提示词的每一段在单步内依次走过[一条请求七站主线](one-request.md#一条请求要走过七站)的第 2 到第 5 站：

```wiki-diagram
file: chunked-prefill-flow
```

1. **第 2 站 调度**：算出本段排几个位置，提前推进已算计数。
2. **第 3 站 准备输入**：worker 用**本步开始前**的已算位置数给本段编号（第 2 段编为 `6、7……11`，不用调度器刚前推的步末值，更不从 0 重来）；按这条请求的 [block table](block-table.md)（块表：记录该请求借到了哪几个缓存块）查出写入格号；再给整批贴上执行标签 **ChunkedPrefill**（只要批内既有 decode 又有提示词段，或有提示词段正接着前文续算，都贴这个标签，表示部分历史已在缓存里；不同批次的标签分支见页末源码区，张量拼批见[输入准备](prepare-inputs-flow.md)）。
3. **第 4 站 前向**：各层读取前面各段已存下的信息，算出本段新位置并把新历史或新状态写回指定槽位。
4. **第 5 站 采样**：每条请求在自己本步最后一个位置选出 1 个 token。提示词还没算完时，这个 token 当场丢弃（请求若带随机种子，它的随机数生成器还会把偏移往回拨，免得这次白采样打乱后续正式采样），下一步回到调度；算完了，选出的就是首个输出 y₀，下一步起按 decode 排。

下面把 A、B、C 放上同一条交互式调度时间轴。点开播放可逐阶段对照：虚线浅色格是刚排入本步的计划，实色格是执行完成的位置，下方保留 C 已建立的前文历史；横轴只划分调度步序，等宽不代表每步毫秒耗时相等。

```wiki-scene
inference-mechanism:7
```

## 切开不算「拼结果」：后一段靠什么接上前文？

把 14 个 token 切成 `0–5`、`6–11`、`12–13` 三段算，模型最后并没有一步叫「把三段输出拼起来」。之所以分段算出的结果与一次算完 14 个位置一致，靠的是四件事严丝合缝地接上：

- **位置号与因果视野不断。** 第 2 段带着位置号 `6–11` 进入模型，[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)（限定每个位置只能看自己与前面位置）照常生效：位置 6 看 `0–6`，位置 11 看 `0–11`。分段既不重置位置编号，也不改变任何位置的因果关系。
- **普通注意力在原处追加 KV cache。** 普通注意力层为每个位置留下一对向量：K（键，比对相关程度）和 V（值，按权重取用的内容），存在显存的 [KV cache](kv-cache.md) 里。第 1 段写下的 `0–5` 原样保留，第 2 段只按块表往后续格子里追加 `6–11` 的 K、V，做注意力时把前文和本段一起读入，不用重算前段。
- **线性注意力跨步交接递推状态。** 保存「前文历史」不一定都是逐位置存 K、V：[线性注意力](linear-attention.md)层为每条请求只存一份固定大小的状态来汇总前文，随新 token 到来原地更新。分段时，第 1 段算完写回最终状态，第 2 段把它作为初始状态读入、推完 `6–11` 再写回。两类层的存储形态不同，但都能沿着同一条请求无缝续算。
- **同批请求各自隔离。** A、B、C 虽然拼在同一批张量里一起过前向，但各用各的位置号、各自的块表和各自的状态槽；A 的 decode 只读 A 的历史，C 的分段只读 C 的前文，彼此绝不串味。

## 边界与变体：单条上限、关掉分块与块对齐

上面的 `6、6、2` 是默认开关下的手算主干；真实配置里还有几处边界会改变切法：

- **给单条请求另设每步上限。** 除了整批总预算，还可以单独限制「一条请求一步最多拿多少位置」。它在剩余预算之前先截一刀，running 和 waiting 两边都截；默认值 0 表示不设。若在前面的示意里把它设成 4，C 就会按 `4、4、4、2` 分四步算完，前三步各给别的新请求留出 2 个位置，代价是 C 拿到首个输出再晚一步。
- **手动关掉分块。** 用户未显式指定开关时，引擎按模型是否支持分块自动推导（pooling 类请求是否允许分块也须查配置，不能直接套生成模型的默认）。手动关掉分块后有两重后果：在调度上，若单条上限保持 0，超余量的新请求直接让本轮 waiting 接纳停下；若同时设了正的单条上限，代码先按上限截断再查分块开关，截后能排进余量而原请求未完时仍会继续分段（参数组合见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)）。在启动上，关闭分块要求每步预算不小于允许的最长输入，否则启动直接报错；上游还会打印警告，提示手动关闭可引发崩溃或错误输出。
- **切点平时不看 KV 块边界，唯独混合模型对齐存档例外。** 位置预算管「一步算几个位置」，KV 块大小管「历史按多大一格存」，两者哪怕数值相等也是两码事；平时一段完全可以停在某个块中间，下一段接着往同块剩余格子里写。唯一的例外出在「普通注意力 + 线性注意力」的混合模型开启 [prefix caching](prefix-caching.md)（前缀缓存：相同开头的请求复用已算历史）时：若模型不支持逐块保存线性注意力状态、退回按块对齐存档模式，调度器会把每段向下取整到块大小的整数倍，末尾不足一块的尾巴照常算（支持逐块存状态的模型无需对齐）。这里还要分清**物理存储分格**与**完整状态的可复用边界**：即使底层补丁允许最小物理块只装 4 个位置，完整递推状态也只能在调度器认定的公共块边界上存档复用，不能误以为每隔 4 个位置都能留下完整状态。
- **每步实际切多少，还受运行时资源约束。** 在跑请求条数、空闲 KV 块够不够、已算进度、为投机解码（speculative decoding：先猜几个候选，下一步一起验证）预留的位置，以及缺块时的抢占，都会改变某一步实际分给长提示词的长度。示意里的 `6、6、2` 只代表资源充足时的算术结果，不代表调度策略对长短请求绝对公平。
- **昇腾自带的可选调度变体。** 镜像里另带按性能剖析决定段长的 ProfilingChunkScheduler、按时延目标动态调预算的调度器等，本部署均未启用，详见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)与 [profiling chunk 配置](../params/profiling-chunk-config.md)。

## 落到 GLM 双机：20,000 个 token 怎样分三步跑完？

把镜头拉回本站主线的[双机部署前提](glm-5-3-flash-two-node.md#部署前提)：两台机器各是一个独立排队的 DP 执行组，各跑一个调度器，每组每步预算 **8192 个位置**、最多同时跑 **32 条请求**，chunked prefill 按默认开启，见[调度器的 GLM 一节](vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)。GLM 自带 MTP（多 token 预测层，每步猜 3 个草稿留给下一步主模型一起验证），因此每条正在 decode 的请求一步占 `1 + 3 = 4` 个位置。

由此可以直接算出触发分块的门槛：新提示词只有比 `8192 − 4 × 在跑条数` 更长才会被切；新请求还能进场时最多有 31 条在跑，所以门槛最低也是 **8068 个位置**（推导见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)）。主线里 4 个 token 的教学请求 [R1](one-request.md#示例请求-r1-与官方双机部署)，以及[场景 M](concurrent-requests.md#示例场景-m-与变体-m)（DP0 已有 12 条 decode，新到一条 6,000 token 请求）的新提示词都一步装得下，用不上分块。

把场景 M 的新请求换成一条 **20,000 token** 的长提示词，DP0 连续四步的推进节奏如下（完整双组预算账见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)）：

| 步 | 12 条 decode 占用 | 长提示词本步分到 | DP0 本步合计 | 步末状态 |
|---|---|---|---|---|
| 第 1 步 | 12 × 4 = 48 | min(20,000, 8,144) = 8,144 | 8,192（满载） | 已算 8,144，采样结果丢弃 |
| 第 2 步 | 48 | min(11,856, 8,144) = 8,144 | 8,192（满载） | 已算 16,288，采样结果丢弃 |
| 第 3 步 | 48 | min(3,712, 8,144) = 3,712 | 3,760 | 20,000 算完，选出首个输出 token |
| 第 4 步 | 13 条 × 4 = 52 | — | 52 | 长提示词也转入 decode |

和前面的示意一样，12 条 decode 请求在这四步里每轮都被排进批次推进；但这里说的「照常前进」只指每轮都获得调度机会，前两步整批从 48 个位置暴涨到 8,192 个位置，每步耗时与纯 decode 不同，不能当成输出时间间隔不变。

在执行侧，前三步混合批次与纯 decode 步相比有四处关键变化：

- **贴 ChunkedPrefill 走 eager，跨机 MoE 换走 AllGather。** 批内混入未完提示词后无法回放预录的 decode 图，退回 eager mode（由 CPU 逐个下发算子）；整批远超 128 个位置的通信切换门槛，MoE 层（每个 token 只挑少数专家计算）跨两台机器的通信一起改走 AllGather（两台机器先互相收齐本步全部 token 的隐藏向量，每张卡再筛出路由给本卡专家的行），详见[并发页的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。
- **34 层 KDA 跨步接状态，步内再按 64 位置分段。** KDA 是 GLM 的线性注意力层，跨步靠读写每条请求固定大小的递推状态接续；而在单步之内，KDA 算子还会把本段切成每 64 个位置一小段并行推进——那是算子内部重排计算的算法，与调度器跨步分块不是一回事，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **11 层稀疏 MLA 靠 indexer 挑着读前文。** 稀疏 MLA 并不把前面几千上万个历史位置全读一遍：第 2、3 段的查询面前虽已有 8,144 乃至 16,288 个前文位置，但轻量打分网络 indexer 会先在因果范围内筛选，主注意力每行最多只读挑出的 **2,051 个位置**，真实读取量不是各段历史长度直接相加，见[稀疏注意力](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。
- **切点落在块中间，不对齐 640。** 本部署一个逻辑块覆盖 640 个位置，`8,144 = 12 × 640 + 464`，第 2 段直接从第 13 块的第 465 格接着写。本部署默认关着 [prefix caching](prefix-caching.md#glm-双机上它开着吗)，KDA 状态不按块存档，昇腾为按块对齐准备的 GLM 补丁在此不生效。

分块长度还直接牵动每一步要向池子借多少 KV 块。GLM 把缓存分成 5 个组（借还规则详见[块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)）：**full 组**每 640 个位置借 1 块存逐位置历史；**3 个 KDA 组**每组固定 4 块（1 份当前状态加 3 份 MTP 候选状态），共 12 块首步借齐；**尾状态组**按 4 个位置的滑动窗口暂存 indexer 未凑满 4 个位置的零头，先归还窗口外凑满整块的旧页，再为本步全部新位置加 3 个 MTP 预留位置补足块数（下面 ceil 为向上取整，floor 为向下取整）：

```calc
title: 20,000 token 提示词三步借块（DP0，只计这一条请求）
full 组各步新借 = 13 块 → 13 块 → 6 块（由 ceil((已算 + 3) ÷ 640) 递推，累计持有 32 块）
尾状态组第 1 步持有 = ceil(8,147 ÷ 4) − 0 = 2,037 块
尾状态组第 2 步持有 = ceil(16,291 ÷ 4) − floor(8,141 ÷ 4) = 2,038 块
尾状态组第 3 步持有 = ceil(20,003 ÷ 4) − floor(16,285 ÷ 4) = 930 块
KDA 三组常驻持有 = 3 × 4 = 12 块
> full 组列的是每步新借块数；尾状态组列的是先还窗口外旧块、再补齐本步后手里留着的块数
```

最扎眼的是尾状态组的瞬时洪峰：一段 `8,144` 个位置当步就要占住 **2,037 块**，按[每卡每块约 7.969 MiB、池子 3,855 块的预算算例](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)折合约 **15.9 GiB**，一举吃掉单卡 KV 池的一半以上，比 full 组的 13 块高出两个数量级；下一步已算数追上来，窗口外整块立刻归还，第 3 段回落到 930 块，第 4 步进入 decode 后回到 **3 块**，此后完整 decode 步常在 3–4 块之间波动。所以在这套部署上，**每段切多长不只决定单步算力开销，也直接决定单步临时要占住多少缓存块**。

以上切法与块数都是依据源码与部署参数算出的静态账，本页没有双机实机开关分块或调预算的延迟测量；离线核对时可照上述算式复算每步预算与已算位置，并沿[输入准备](prepare-inputs-flow.md)核查各段起始位置号与读取历史的对应关系。

## 常见误解

- **「chunked prefill 是需要手动打开的高级优化」**——本部署默认开着。未显式传开关时，框架按模型是否支持分块推导；生成式 encoder-decoder（编码器先处理输入、解码器再生成输出的结构）返回不支持，因此也不能反过来概括成「所有生成式模型一律默认开启」。是否开启看开关与模型支持能力，开启后怎么切才看每步预算与单条上限。
- **「切开以后总计算量变少了」**——没有变少。因果打分的位置对与不切完全相同，还多了跨段重读前文与每步固定杂活；它换来的是单步工作量有上限。
- **「每一段算完都会吐出一个 token」**——只有最后一段产出首个输出 token。中间几段虽然照常采样，结果都当场丢弃。
- **「后一段要把前几段的输出拼起来」**——没有拼接这一步。后一段顺着位置号接着编，直接读取前段留下的 KV 缓存或递推状态。
- **「关掉分块，正在生成的请求就不会被 prefill 拖慢」**——正好相反。关掉后每步预算必须放大到容纳最长输入，一步涌进来的位置只会更多；真正让 prefill 与 decode 不挤在同一步的方案是 [PD 分离](pd-disaggregation.md)。
- **「每一段长度刚好等于一个 KV 块」**——位置预算与缓存块大小各管各的。本部署一段 8,144 个位置，逻辑块 640 个位置，切点直接停在块中间。
- **「KDA 算子里的 64 位置分段就是 chunked prefill」**——不是。64 位置是单步之内 KDA 算子并行推进内部状态的步长；chunked prefill 是调度器把整条提示词跨多个调度步切开。
- **「每步预算 8,192 个位置，等于每步耗时有了固定毫秒上限」**——预算封住的是位置数，不是毫秒；每步耗时仍随前文长度、同批请求和跨卡通信波动。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支不含 GLM 代码；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，同样配 vLLM `0fc695fc`）；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；v0.30.0rc2 为 vLLM `ced6857a` + Ascend `7d825229`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。

### 怎么开

完整参数类型、启动校验与跨版本变化统一见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)（含两个 partial-prefill 参数在固定版仅接受默认值、在 main 已删除的边界）；本节聚焦分块开关与切分分支：

- **默认推导逻辑**：`SchedulerConfig.enable_chunked_prefill` 字段静态兜底为 `True`（docstring 注明主要供测试方便，见来源 5），实际启动值由 `EngineArgs._set_default_chunked_prefill_and_prefix_caching_args` 读取 `model_config.is_chunked_prefill_supported` 决定；固定上游 `0fc695fc` 中生成式模型仅 encoder-decoder 返回 `False` [C7]（另见来源 10、34）。开启后启动日志打印 `Chunked prefill is enabled with max_num_batched_tokens=%d.` [C6]，本部署应输出 `8192`。
- **每步位置预算**：`--max-num-batched-tokens`，本部署显式设为 `8192`；未显式传入时昇腾平台的落点见[调度器的怎么开](vllm-scheduler.md#怎么开)。
- **单条每步上限**：`--long-prefill-token-threshold`，默认 `0`（大于 `0` 才生效）。`running` 分支先按该阈值截断、再做 `min(num_new_tokens, token_budget)`；`waiting` 分支先按该阈值截断，再检查 `enable_chunked_prefill`，最后取 `min` [C3]（另见来源 33）。字段 docstring 称它是判定长请求的分类阈值，代码实际把它当作直接截断本步 token 数的闸门 [!]。仅当 `max_num_partial_prefills > 1` 时它才自动设为 `max_model_len` 的 4%，但 V1 只要改动这两个 partial-prefill 参数就抛 `NotImplementedError` [C8]，因此只能手动指定。
- **混合模型按块对齐切分**：`need_mamba_block_aligned_split` 仅在含 mamba 类层且 `mamba_cache_mode == "align"` 时为真（来源 11）；`_mamba_block_aligned_split` 将 prefill 本步 `num_new_tokens` 向下取整为 `block_size` 的整数倍，最后不足一块的尾巴照算 [C12]。GLM 专用补丁 `patch_glm5_next_mamba_scheduler.py` 替换了该函数：对齐单位改取调度器的公共块边界 `self.block_size`（完整 KDA 递推状态可存档复用的粒度），而非可能被混合缓存改写为 `4` 的 `cache_config.block_size` [C13]（`4` 只是 indexer-state 物理块分格，不能推出每 4 个 token 都能存完整递推状态；APC 与 align 同开时的状态块计算见 `patch_mamba_config.py` 来源 29）。本部署 `mamba_cache_mode = "none"`，上述对齐均不触发 [D]。
- **普通注意力块大小静默调整**：昇腾 `refresh_block_size`（来源 31）在开启 chunked prefill 或 prefix caching 且块大小非 `128` 时，会将普通注意力模型的块大小静默改为 `128` 并打一条 info 日志；`deepseek_v4` 与混合结构模型在更早分支返回，GLM 的逻辑块 `640` 不受影响，见 [KV cache 规格](kv-cache-spec.md#配置阶段逻辑块先定成-640)。

### 会报什么错

- **`ValueError: max_num_batched_tokens (...) is smaller than max_model_len (...)`**：关闭分块且显式传入的预算严格小于 `max_model_len` 时由 `verify_max_model_len` 抛出；若未显式传预算，`EngineArgs` 会先把预算抬到 `max(max_model_len, 默认值)` 再过校验 [C9]。本部署显式传 `8192` < `133120`，关分块即启动失败 [D]。注意代码判断是严格小于（相等可通过此项校验，但优化文档写作「必须大于」，且过了此项不代表其余启动条件必过，见来源 6、20）。
- **手动关闭警告**：生成式模型手动关分块时打印一次 `This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- **`NotImplementedError`（Concurrent Partial Prefill）**：修改 `max_num_partial_prefills` 或 `max_long_partial_prefills` 时抛出。
- **断言失败 `Chunked prefill is required for mamba cache mode 'align'.`**：混合模型落入 `align` 模式却关掉分块时触发 [C21]。
- **静默停止接纳**：关闭分块后，`waiting` 请求经单条上限截断仍超剩余预算时直接 `break` 退出接纳循环，不抛异常，仅推迟后续等待请求。

### 开销和什么时候别开

- **队列提前记账与位置号起点**：`_update_after_schedule` 在前向执行前就把本步分配量累加进 `num_computed_tokens`，并按「是否仍小于 `num_tokens + num_output_placeholders`」设置 `is_prefill_chunk` [C4]；worker 准备输入时仍用步前的 `num_computed_tokens_cpu` 加本段内偏移生成 `positions_np`（来源 14）。
- **未完 prefill 采样丢弃的三条消费路径**：runner 按 `optimistic_seq_lens < num_tokens` 生成 `discard_requests_mask` 与 `discard_request_indices` [C15]，采样后对带种子的未完请求把随机数生成器 offset 回拨 `4` [C17]。在固定 GLM runner 中：同步普通采样直接清空对应输出行；投机拒绝采样按丢弃掩码过滤；异步路径先从下步输入索引和请求输出追加中排除这些行，再由异步输出消费者待拷回完成后清空或过滤——各路径处理时点不同，最终都不把中间段 token 追加进请求输出（完整消费链路见来源 48–51）。
- **执行标签判定顺序**：`_build_attn_state` 依次检查：整批从未算过为 `PrefillNoCache`；整批每条 1 个 token 为 `DecodeOnly`（开启 MTP 改 `SpecDecoding`）；有效 token 全为 1 且开投机为 `SpecDecoding`；其余情形开分块记 `ChunkedPrefill`，关分块记 `PrefillCacheHit` [C16]。因此单条长请求独跑时首段为 `PrefillNoCache`、后段为 `ChunkedPrefill`；与 decode 混批时三段全为 `ChunkedPrefill` [D]。
- **跨段状态读写与算子内分段**：KDA prefill 按 `has_initial_state` 读入前段状态或清零，并以 `output_final_state=True` 写回 [C18]，算子内部 `64` 位置分段常量独立定义于来源 39；稀疏 MLA 元数据以含已算前文的 `seq_lens` 作为 KV 全长，位置清单宽度为 `index_topk + index_kpool − 1`（来源 19）。保存历史的形态随模型结构而异，不能推广为所有线性注意力都具备相同的分块或缓存复用边界。
- **调优方向与逐位复现限制**：官方优化文档指出小预算（如 `2048`）偏向改善 ITL、大预算偏向改善 TTFT [S20]，但不能同时承诺三项指标最优，须按实际负载测量。main 快照 `baa023ad` 的 batch invariance 文档规定：需要逐位确定性复现时，须显式关闭 chunked prefill 与 prefix caching 并配 `--block-size 128`，且该模式不支持驱逐重算抢占 [S27]（仅针对该特定模式与快照，本部署若照做须先处理 `8192 < 133120` 校验）。要让 prefill 与 decode 彻底不在同一步，应改看 [PD 分离](pd-disaggregation.md)。

### 版本差异

| 维度 | v0.23（`0fc695fc` + `2c59ff10` / `db701c1f`） | v0.26（`568afb3a` + `2ed6cbba`） | v0.30.0rc2（`ced6857a` + `7d825229`） | main（`84030bbe` + `baa023ad`） |
|---|---|---|---|---|
| 未显式指定时的分块默认 | 按模型支持能力推导，见 [Prefill 版本对照](prefill.md#版本差异) | 同左 | 同左（来源 35、36） | 同左 |
| 单条上限与关分块停接纳 | 上限默认 `0`；截后仍超余量时停 `waiting` 接纳 | 同左 | 同左（来源 36） | 同左；截断时多比一道并行草稿输入预算预留 [C25]，MTP 预留为 `0`，GLM 切法不变 [C26] |
| DP 跨组 prefill 节拍门控 | 无 | 新增 `prefill_schedule_interval` 门控，默认 `1` 不触发 [C23] | 同 v0.26，默认 `1` 表示不额外节流 DP 接纳而非关分块（来源 37） | 同 v0.26，固定消费者条件一致 |
| 昇腾动态分块与开关联动 | 设 `SLO_limits_for_dynamic_batch` 会顺手置 `enable_chunked_prefill = True` [C22] | 删除该联动，不再改写分块开关 | 同 v0.26；另 `profiling_chunk` 在 MRV2 下已可配 async，MRV1 仍拒绝（来源 38） | 同 v0.26 |
| runner 执行标签与丢弃采样 | 如上节所述 | 标签判据一致 [C28] | MRV1 判据一致 | 判据一致 |
| batch invariance 文档 | 未单列 chunked prefill 限制 | 未单列 | 未单列 | 明确要求关 chunked prefill 与 prefix caching，并配 `--block-size 128` |

**DP 节拍门控的两层触发条件（v0.26 至 main）：** 引擎侧仅当 `prefill_schedule_interval > 1` 且当前步号不能被该间隔整除时才发出节流请求；Scheduler 侧还必须同时满足 `prefill_capacity_bound == False` 且 `running` 中至少有一条 `is_prefill_chunk == False` 的请求。两层都满足时，已在 `running` 里的 prefill 续算段也会暂缓，而 `waiting` 里仍需本地计算多于 `1` 个位置且未走异步远端 KV 加载的请求会停止本轮接纳。在放行步末尾，`prefill_capacity_bound` 按 `waiting` 是否仍有剩余请求更新：若仍有等待请求，下一步不再因该门控推迟 prefill（它是调度器的排队容量标记，不是显存余量测量；v0.26 见来源 24、40–43，main 见来源 44–47）。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 「调度器不区分 prefill / decode 阶段」注释 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头 [C1] |
| `running` / `waiting` 两道减法、单条上限与关分块 `break` | 同文件两个 `while` 循环（来源 2、3、33） |
| 已算数提前推进与 `is_prefill_chunk` | 同文件 `_update_after_schedule`（来源 4） |
| 字段默认、自动阈值、启动日志与 `verify_max_model_len` | `vllm/config/scheduler.py`（来源 5、6） |
| 默认推导、手动关分块警告、partial prefill 报错 | `vllm/engine/arg_utils.py`（来源 7–9、34） |
| 混合模型块对齐切分与 GLM 补丁 | `scheduler.py` 的 `_mamba_block_aligned_split`、`patch_glm5_next_mamba_scheduler.py`、`patch_mamba_config.py`（来源 11–13、29） |
| 位置号、执行标签、丢弃采样与异步输出消费 | `vllm_ascend/worker/model_runner_v1.py`、`gpu_model_runner.py`、`rejection_sampler.py`（来源 14–17、48–51） |
| KDA 跨段接状态与内部 64 位置分段常量 | `vllm_ascend/ops/kimi_kda.py`（来源 18、39） |
| 稀疏 MLA 的 KV 全长与索引清单宽度 | `vllm_ascend/attention/indexer_kpool_mla_v1.py`（来源 19） |
| full、尾状态与 KDA 缓存组的借块与滑窗归还 | `vllm/v1/core/single_type_kv_cache_manager.py`（full 分配来源 52；滑窗归还来源 53；窗口外整块公式来源 54；KDA 预留来源 55） |
| 概念出处与调参方向 | SARATHI 论文：将长 prefill 切成块与 decode 同批执行 [S30]；vLLM 优化文档（来源 20） |

**待核。**

1. 本部署实机启动日志中 `Chunked prefill is enabled with max_num_batched_tokens=8192.` 原行尚未采集实机日志确认 [!]。
2. GLM 双机上开关分块、调整 `--max-num-batched-tokens` 与 `--long-prefill-token-threshold` 对 TTFT、ITL 及吞吐的实测曲线尚缺。
