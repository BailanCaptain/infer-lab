---
id: npu-model-runner
title: "NPUModelRunner：每张卡上把一步计划跑成 token 的执行者"
type: concept
summary: model runner 是每张卡的 Worker 里执行一步的对象：按调度计划对账跨步保留的请求记录，拼输入、定执行方式、跑前向，只把每条请求要预测的那几行变成词表分数，暂存进执行状态；引擎第二次调用时再取出来采样、草拟候选，按请求交回 token。前向和采样拆成两次调用，中间靠执行状态交接。
aliases: [NPUModelRunner, model runner, ModelRunner, GPUModelRunner, execute_model, sample_tokens, logits_indices, ExecuteModelState, 执行状态, 两次调用, 前向与采样交接, need_accepted_tokens, 接受数]
chapters: ["09"]
order: 40
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L269-L285
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1917-L1937
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1991-L2067
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2082-L2096
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2127-L2176
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2198-L2211
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2259-L2291
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2306-L2327
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2349-L2371
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2427
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2455-L2510
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2517-L2582
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2990
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3842-L3862
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5041-L5063
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L521
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L667
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L159-L163
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2439
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1495-L1513
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1304-L1316
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1461-L1494
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463
  - vllm@0fc695fc:vllm/v1/engine/core.py#L508-L597
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L326
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509
  - vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L87
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L496-L499
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L60
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4462-L4486
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L288-L346
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1950-L1970
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1799-L1819
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2183-L2195
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L489-L504
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4480-L4482
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L159-L163
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: prepare-inputs-flow, kind: builds-on, note: 对账之后怎样拼出 token id、位置、槽位和选行，逐行算法在那一页}
  - {to: one-request, kind: builds-on, note: R1 在第 3–5 站的形状、词表分数的字节数和 MTP 草拟三遍}
  - {to: concurrent-requests, kind: builds-on, note: 场景 M 一步 49 行词表分数怎样拆回 13 条请求，以及补齐与两组对齐的账}
  - {to: npu-worker-lifecycle, kind: builds-on, note: runner 在启动时何时建好、装权重、建缓存池、录图}
  - {to: glm-5-3-flash, kind: builds-on, note: Runner 调用的是已构建的 GLM 模型，各层计算由模型实现组织}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 每张卡上，是谁把「这一步算谁」跑成「这一步出了哪些 token」？

**model runner（昇腾实现叫 NPUModelRunner）是每张卡的 Worker 里执行一步的对象：它接过调度器这一步的计划，对照自己跨步记着的请求记录，把计划拼成模型的输入、跑一遍模型，只把每条请求要预测下一个 token 的那一行变成词表分数（词表里每个词一个分数，越高越可能是下一个 token）；等引擎第二次调用时再采样，把新 token 按请求交回去。**

先把几个词说清楚。[调度器](vllm-scheduler.md)每一步决定这一步算哪些请求、每条算几个 token，交出一份计划；它住在引擎进程 [EngineCore](vllm-engine-core.md) 里，只和请求打交道，不碰模型。**Worker** 是每张卡上的执行进程，负责这张卡的设备、通信和启动顺序，见 [Worker 生命周期](npu-worker-lifecycle.md)；它手里有一个 model runner，每一步的活都交给它。模型本身只认识张量：一行一个 token，一层一层往下算，不知道哪几行属于哪条请求。

看一个小例子（数是示意，沿用[准备输入](prepare-inputs-flow.md)的 A、C）。A 已经算过 5 个位置，这一步只算上一步生成的 a₅；C 是刚进来的新请求，提示词 c₀、c₁、c₂ 这一步全算。引擎对 runner 发两次调用，下图从上往下读：

```wiki-diagram
file: model-runner-layout
```

第一次调用带着计划「A 算 1 个，C 算 3 个」。runner 先**对账**（①）：它自己记着这张卡上正在跑哪些请求、各坐第几行、算到第几个位置、块表（这条请求的 KV cache 放在缓存池哪几块）是什么，这份记录叫**持久批次**（persistent batch），跨步一直留着；计划里 C 是新来的，就给它添一行。然后**拼输入**（②），把 a₅、c₀、c₁、c₂ 排成 4 行；**跑模型**（③），4 行进、4 行出，各层顺手把这 4 个位置的历史写进 [KV cache](kv-cache.md)；**选行**（④）：只有第 0 行（A 的最后一行）和第 3 行（C 的最后一行）在预测「下一个 token」，只让这 2 行去乘词表，得到 2 行词表分数。

到这里 runner 没有马上挑 token，而是把词表分数、这一步的计划、隐藏向量（模型最后一层给每一行算出的向量）等打包放进**执行状态**，第一次调用返回空。第二次调用来了，runner **取出并清空**执行状态（⑤），**采样**（⑥），每行分数挑出一个 token，再**按请求交回**（⑦）：A 得到 a₆，C 得到 c₃。

图里的东西寿命不同：最上面三样跨步保留；执行状态只活在两次调用之间；拼出来的输入和每层的中间结果，用完就被下一步覆盖。

## 为什么需要它，代价在哪？

**因为计划说的是「请求」，模型认的是「行」，两边之间的翻译、记账和交接，要有一个每步都在、而且记得上一步的对象来做。** 没有 runner，会卡在三处：

- **计划只写变化。** 调度器不会每步把每条请求的全部历史重发一遍：新请求发全量，继续跑的请求只发增量，比如这一步新借的块、已经算到第几个位置。卡上必须有人记着完整的请求记录，再用增量去改它。所以 runner 是一个从启动活到退出的对象，不是每步调用一次的函数。
- **模型的输出是行，不是请求。** 前向完 4 行输出，第 0 行给 A，第 3 行给 C，第 1、2 行不用预测。只有 runner 手里有这张行和请求的对照表，也只有它能把采样结果拆回每条请求。
- **挑 token 之前可能还要插一手。** 比如要求输出必须是合法 JSON 时，得先把不合规的词压掉，这张「允许哪些词」的表由引擎算。把前向和采样拆成两次调用，引擎就能在卡上跑前向的同时算这张表，第二次调用时一起送来，见[结构化输出](structured-output.md)。

代价有三处。

**第一，runner 的活挡在前向前面。** 对账、拼输入、定执行方式大多是主机端（CPU）上的工作，每一步都要做完才能发出前向。runner 尽量只动有变化的部分，块表拷贝也尽早发起，见[准备输入的代价](prepare-inputs-flow.md#为什么要拼成一排再配表代价在哪)。

**第二，两次调用必须严格交替。** 执行状态只有一个位置，上一份没被取走就来了下一次前向，runner 直接报错，原因见[执行状态一节](#两次调用之间执行状态里存了什么)。

**第三，代码难读。** 昇腾的这个类继承 vLLM 的 GPUModelRunner，只重写一部分方法，没重写的直接用上游那份；固定镜像里这一个文件有五千四百多行，混着启动时只跑一次的代码和每步都跑的代码，怎样分开读见[寿命三层一节](#哪些东西跨步留着哪些每步重来)。

几个相邻角色容易混：

| 角色 | 管什么 | 不管什么 |
|---|---|---|
| 调度器 | 这一步算哪些请求、各算几个、借哪些块 | 不碰张量和模型 |
| Worker | 一张卡的设备、通信组、启动顺序；把两次调用转给 runner | 不拼输入 |
| model runner | 每一步的对账、拼输入、定执行方式、前向、选行、采样交接 | 不决定算谁 |
| 模型与注意力后端 | 各层怎么算、每层的注意力算子要什么格式 | 不认识请求 |

表里说的是谁持有谁、谁调谁：Worker 持有 runner，runner 调模型和注意力后端。这和进程怎样划分是两回事，本部署里它们都在同一个 Worker 进程内，进程与执行器的关系见[进程与执行器](engine-processes.md)。

## 一步怎么走：A、C 这一步，runner 手里的数怎么变？

**第一次调用做到「每条请求一行分数」为止，第二次调用才把分数变成 token。** 用 A、C 这一步把中间的数走一遍。词表按 5 个词示意（真实模型有十几万个）；采样用最简单的一种：温度接近 0 时直接取分数最大的词，叫 greedy。

1. 对账后，持久批次里记着：A 已算 5 个位置；C 是新请求，已算 0 个，排在 A 后面。
2. 准备输入按这份记录拼出 4 行，同时算好**选行**：每条请求本步最后一行的行号，这里是 [0, 3]，推导见[准备输入](prepare-inputs-flow.md#哪几行送去输出头)。
3. 前向完，4 行输出都在。runner 按选行挑出第 0、3 行，只让这 2 行过**输出头**（lm_head：把一行隐藏向量乘成词表上每个词一个分数的那一层）。
4. 2 行分数连同计划等一起存进执行状态，第一次调用返回空。
5. 第二次调用取出分数，逐行采样，再按「第 0 行是 A、第 3 行是 C」交回。

```calc
title: A、C 这一步：4 行输出怎样变成 2 个 token（词表按 5 个词示意）
前向输出 = 4 行
> 第 0 行属于 A，第 1–3 行属于 C
过输出头的行 = 2 行（第 0、3 行）
词表分数 = 2 行 × 5 个词 = 10 个
> 4 行全过要 20 个；前向本身 4 行照算，省的只是输出头这一步
A 这一行 = [0.3, 2.1, −0.5, 1.4, 0.2]
A 取的词 = 分数最大的位置 = 第 1 个（从 0 数）
C 这一行 = [1.2, −0.3, 0.8, 3.0, 0.1]
C 取的词 = 分数最大的位置 = 第 3 个
交回 = {A: 第 1 个词, C: 第 3 个词}
> 就是图里的 a₆ 和 c₃；10 个分数在两次调用之间一直存在执行状态里
```

**为什么第 1、2 行不过输出头？** 每一行输出预测的是「它后面那个 token」。第 1 行是 c₀ 的输出，预测的是 c₁，而 c₁ 就在提示词里，答案早就知道；只有最后一行预测的是还没人写出来的那个 token。第 1、2 行也不是白算：前向时它们在每一层留下了 c₀、c₁ 的历史，C 之后每生成一个 token 都要读。所以省下的只是输出头那一次乘法，词表越大省得越多。

**有两种情形，选行不只是最后一行。** 提示词只算了一段时（[chunked prefill](chunked-prefill.md)，长提示词切成几段分几步算），最后一行落在提示词中间，照样采样，但结果要丢掉；带投机解码的草稿 token 时（先猜几个 token，下一步一起验证），每个草稿都要检查，一条请求要选「1 + 草稿数」行。两条规则都在[准备输入](prepare-inputs-flow.md#哪几行送去输出头)。落到 runner 这一侧：丢弃发生在第二次调用整理结果时，逐位验证发生在采样时。

## 两次调用各走哪几段，在哪里分岔？

**两次调用各走一条固定的主路，中途有几处提前离开的出口。除了准备输入，runner 还要定执行方式、建各层的注意力元数据、把结果按请求分发回去。** 下图把两次调用画在一起，左列对应主线的[第 3、4 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)，右列对应[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)：

```wiki-diagram
file: npu-model-runner-code-flow
```

左列里的「准备输入」是[准备输入](prepare-inputs-flow.md)一页的内容。runner 在它前后多做的几件事：

- **先查执行状态已被取走。** 这是两次调用严格交替的那道闸。
- **对账前多两处防护。** 开着[异步调度](async-scheduling.md)（调度器不等上一步的结果回到 CPU，就先排下一步）又开着投机解码时，runner 按「上一步的草稿全被接受」乐观地记账，事后再补。昇腾在交给上游对账之前，先把两类请求的「上一步草稿数」清零：上一步采样后被丢弃、已经不在上一步结果里的请求，以及因 KV 加载失败要重算、进度往回退了的请求。不清零的话，补账时要么找不到对应的行，要么补错数。
- **本步没有 token 就提前返回。** 对完账发现计划里一个 token 都没有，直接返回空结果，不拼输入、不跑模型，引擎也不再发第二次调用。
- **定执行方式。** 这一步是回放预先录好的计算图（graph mode：把整次前向录成一张图，到时整张回放），还是一个算子一个算子地下发（eager）；张量要补到多宽；两个 DP 组（数据并行的两组卡）之间还要对齐宽度和模式。规则见 [ACL Graph](acl-graph.md)，补多宽的账见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。runner 在这里的职责只是每步问一次，把答案带进前向。
- **在前向上下文里跑模型。** runner 把本步宽度、两组各自的 token 数、图模式、注意力元数据放进一个前向上下文，各层在里面自己取，不靠函数参数一层层往下传。
- **发出前向之后才补上一步的账。** 异步调度下，上一步到底接受了几个草稿，要等上一步的采样结果拷回 CPU 才知道。runner 先按乐观的数把本步前向发出去，存完执行状态、返回之前再回头修正已算位置数，等结果的时间就不挡在前向前面。这是 GLM 这种配置下的顺序；模型开着按块边界搬线性注意力状态（align 模式）或带压缩配置时，修正会提前到前向之前。

准备输入的最后一段是建注意力元数据：公共底稿按缓存组、按每类注意力后端各整理一份；层在建缓存时就按「后端是谁 + 缓存规格是什么」归拢成组，所以同一批请求的公共信息能一次换成各后端要的格式，见[准备输入](prepare-inputs-flow.md#注意力元数据一份底稿按缓存组换上各自的块表和槽位)和[注意力后端](attention-backend-family.md#runner-怎样把层归拢成组)。

前向之后有两个出口不走选行。[流水线并行](pipeline-parallel.md)（PP，把层按段分到不同卡上）的非末段只算了前几层，把中间张量交给下一段就返回；pooling 模型（只要整段输入的向量表示、不生成 token 的模型）直接交出池化结果，引擎不再发第二次调用。这两种情况都不存执行状态：PP 非末段在第二次调用里没有东西可取，返回空。所以接口并不是「一次调用必返回一个 token」。

右列按顺序：

1. **取出并清空执行状态。** 取出后立刻清空，下一次前向才能进来。
2. **套允许词表。** 只在有[结构化输出](structured-output.md)时发生。昇腾的 V1 runner 把整张词表分数拷回 CPU、转成 fp32 改完再拷回 NPU，和 GPU 版在显卡上原地改不同。
3. **采样。** 本步没有草稿 token 时走普通采样器；有草稿时走拒绝采样器（rejection sampler），逐位检查草稿对不对。两种采样怎样挑词见[一条请求](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)和[投机解码](speculative-decoding.md)。
4. **整理结果。** 把每行采到的 token 按请求拆开；提示词还没算完的请求，这一步采到的结果丢掉。
5. **草拟下一步候选。** 开着投机解码时，草稿层（GLM 用 MTP，多 token 预测层）接着猜下一步要验证的候选。它要用执行状态里的隐藏向量、位置和注意力元数据，这些东西也要暂存，就是为了它。昇腾在整理结果之后才草拟；上游 GPU 版对 MTP 这类直接用设备上采样结果草拟的方法反过来，先草拟再整理，ngram 等方法仍在整理之后。
6. **打包输出。** 每条请求这一步的新 token、需要时的概率信息，装进一个输出对象。
7. **记下每条请求接受了几个。** 模型里有线性注意力（每条请求只存一份固定大小状态的注意力）又开着投机解码时，runner 在另一条流上等采样结束，数出每条请求这一步接受了几个 token，写进一张接受数表。线性注意力给每个候选位置各存了一份状态，下一步按这个数决定从哪一份接着算，见[线性注意力](linear-attention.md#矩阵状态之外还有短卷积历史)。
8. **交回引擎。** 异步调度时交回的是一个带「待拷贝」标记的输出对象：token 留在 NPU 上，直接给下一步拼输入用，CPU 那份稍后才拷完，见[异步调度](async-scheduling.md)。

## 两次调用之间，执行状态里存了什么？

**执行状态是一个只装一份的暂存格：第一次调用在前向之后把第二次调用要用的东西全放进去，第二次调用一开头就取走并清空。** 它不是 KV cache，也不是持久批次，寿命只有两次调用之间这一小段。里面一共 12 项，按用途分：

| 存的东西 | 第二次调用拿它做什么 |
|---|---|
| 本步的调度计划 | 知道每行属于哪条请求、哪些请求的结果要丢 |
| 选中行的词表分数 | 套允许词表、采样 |
| 草稿相关的元数据 | 决定普通采样还是逐位验证；草拟时定每条请求从哪一行接着猜 |
| 全部行和选中行的隐藏向量、位置、注意力元数据 | 草稿层接着猜候选时的输入 |
| 本步补齐后的尺寸描述、图统计 | 草拟沿用本步尺寸；统计随输出交回 |
| 某些草稿方法要的辅助隐藏向量、多模态编码缓存的传输结果 | 对应功能开着时才有内容，GLM 文本生成用不到 |

存进去的是这些张量的引用，不是拷贝，所以暂存本身几乎不花时间；代价在于这些张量要一直活到第二次调用用完。

**为什么顺序必须严格。** 格子只有一个。如果允许下一次前向直接覆盖，上一步的分数就丢了，那一步里的请求再也拿不到 token，所以 runner 选择报错。用图模式回放时还有一层：回放的输出落在录图时固定下来的那块缓冲区里，执行状态里的隐藏向量指的正是这块缓冲，下一次回放会原地改写它；草拟要读这份隐藏向量，也就必须赶在下一次前向之前用完。

**谁来保证交替。** 两次调用由引擎成对发出：结构化输出要等上一批的 token 时，第二次调用会推迟，但中间不会插进新的第一次调用；worker 又按收到的顺序一个一个执行，所以 runner 手里任何时刻最多只有一份执行状态。引擎怎样排这两次调用、异步调度怎样把两步叠在一起，见[请求调用链](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。

**两次调用拆开，改变的是「谁在什么时候等谁」，不是算了几遍。** 主模型的全部层只在第一次调用里跑一遍；第二次调用里跑的是采样器，开着投机解码时再加上草稿层。

## 哪些东西跨步留着，哪些每步重来？

**runner 手里的东西按寿命分三层：启动时建好、之后不动的；跨步保留、每步改一点的；只活一步、甚至只活两次调用之间的。** 分清这三层，读代码和排查问题时就知道某个值该不该在这一步变。

| 寿命 | 有哪些 | 什么时候建、什么时候变 |
|---|---|---|
| 整个服务期间 | 权重、KV cache 缓存池、录好的计算图、各层按后端归好的组 | 启动时按固定顺序建好，见 [Worker 生命周期](npu-worker-lifecycle.md) |
| 跨步 | 持久批次（请求记录、块表、已算位置数）、接受数表、异步调度下留在 NPU 上的上一步 token | 每步只增、删、改有变化的请求 |
| 一步之内 | 拼出来的输入、各层的中间结果、执行状态 | 下一步重新填写；执行状态在第二次调用开头就清空 |

输入缓冲和中间结果是同一批缓冲区每步重新填，上一步留下的内容不代表这一步。

这一层划分也是读 runner 源码的钥匙。那个五千多行的文件里混着四类代码：启动时只跑一次的（建对象、装权重、量显存、建缓存池、录图）；每步都走的（两次调用和它们往下调的方法）；拿假批次试跑的路径（启动时量显存、录图用它，空闲的 DP 组陪跑也用它）；以及本部署不走的分支（流水线并行、上下文并行、KV 传输、多模态、pooling）。读的时候先想清楚要看的是哪一类、哪一步，再从两次调用的入口顺着调用往下跟。

## 放到 GLM 双机：16 个 runner，R1 的两步各做了什么？

部署是官方双机：2 台 Atlas 800 A2，每台 8 张卡，TP8、DP2、EP16，W8A8，详见[部署前提](glm-5-3-flash-two-node.md#部署前提)。模型是 GLM-5.3-Flash（下文简称 GLM）。R1 是全库一路跟踪的[示例请求](one-request.md#示例请求-r1-与官方双机部署)，提示词只有 4 个 token（教学设定），落在 DP0，也就是第一台机器。

**16 张卡，16 个 runner，各算各的那一份。** 每张卡一个 Worker 进程，每个 Worker 在选卡之后建一个 runner。DP0 的引擎把同一份计划经共享内存的广播队列一次发给本机 8 个 Worker，8 个 runner 对同一份计划做同样的对账、拼出同样的 4 行输入；差别只在各自持有的权重分片，每卡 KDA 8 个头、MLA 8 个头、路由专家 18 个（[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)）。DP1 没有请求，它的 8 个 runner 每步不走这两次调用，而是被叫去跑一次空批次（dummy batch），和 DP0 对齐宽度，好让 MoE 通信凑齐 16 张卡，见[请求调用链](request-call-chain.md#同一条请求第-1-步和第-2-步走的分支不同)。

**第一步（prefill，把提示词一次算完）。** 对账时 R1 是新请求，坐进持久批次第 0 行；准备输入拼出 4 行、位置 0 到 3，选行只有第 3 行。这一步带 prefill，拿不到只为纯 decode 录的图，runner 定下按 eager 跑，并和 DP1 对齐宽度。建注意力元数据时，稀疏 MLA 和 KDA 两类层各拿到自己那份：稀疏 MLA 要按位置换算出的块表和槽位，KDA 不算槽位、直接拿块号当自己那份固定大小状态的编号，逐项见[准备输入的 GLM 一节](prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)。前向走完 45 层（层内的四路残差见[一条请求](one-request.md#词嵌入与四路残差)），最后一层输出 [4, 4096]，第 3 行的隐藏向量过输出头：输出头按词表切成 8 份，每卡先算出本卡那 19,360 个词的分数，再经 TP 组内一次 [All-Gather](collective-communication.md#all-gather) 拼成完整的 154,880 个，每张卡都拿到一份（切法见[张量并行的词表一节](tensor-parallel.md#词表入口求和出口拼接)）。分数存进执行状态，第一次调用返回空。

第二次调用：R1 没有结构化输出，不套允许词表；本步没有草稿，走普通采样器。8 个 runner 用同一个随机种子各自采样，得到同一个 y₀，这就是首 token。接着 MTP 草稿层用执行状态里的隐藏向量连跑三遍，猜出 d₁、d₂、d₃；GLM 加投机解码时草拟被强制走 eager，三遍的输入怎样错位见[一条请求的第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。8 个 runner 都交回结果，引擎只收 0 号卡那份。本部署按自动判定会打开异步调度，y₀ 和 3 个候选留在 NPU 上，下一步直接拿来拼输入。

**第二步（第一个 decode 步，在已有历史上继续往后生成）。** 计划是「R1 算 4 个」：y₀ 加 3 个候选，位置 4 到 7。第一步没有草稿，这一步对账不用补乐观账；从第三步起，runner 才要按「上一步 3 个候选全被接受」先记、事后修正。这一批只有 R1 一条请求、本步 4 个 token，满足纯 decode 的整齐条件，runner 定下回放 4 个 token 的那张图。4 行都要验证，选行是全部 4 行，拼齐后每卡的词表分数是 [4, 154880]。

第二次调用走拒绝采样器，前 3 行逐位验证 3 个候选，第 4 行在候选全对时多给一个 token，所以这一步交回 1 到 4 个 token。GLM 的 45 层主干里有 34 层 KDA，属于线性注意力，模型类又声明了自己是混合模型，所以 runner 采样完还要数出 R1 接受了几个，写进接受数表，第三步 KDA 从对应的那份候选状态接着算。最后再草拟下一轮 3 个候选。

这一步执行状态里最大的几样，每张卡：

```calc
title: R1 第二步，每张卡的执行状态里最大的几样
词表分数 = 1,239,040 B
> [4, 154880]，BF16；推导见一条请求第二圈
全部行的隐藏向量 = 4 × 4,096 × 2 B = 32,768 B
选中行的隐藏向量 = 4 × 4,096 × 2 B = 32,768 B
> 4 行全被选中，所以和上一行一样大
合计 = 1,239,040 B + 32,768 B + 32,768 B = 1,304,576 B ≈ 1.24 MiB
```

这点暂存放在每卡几十 GiB 的显存里微不足道。拆成两次调用的代价不在显存，而在前面说的顺序约束：这 1.24 MiB 要一直留到第二次调用用完，下一次前向才能开始。词表分数那一项的推导在[一条请求的第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

多条请求一起跑时，一步要交接的行数随请求变：[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里 DP0 一步有 13 条请求，runner 要把 49 行词表分数拆回 13 条，账在[多条请求的第 5–7 站](concurrent-requests.md#第-57-站-采样验证与收尾结果按请求拆回去)。

## 常见误解

- **「runner 决定这一步算谁。」** 算谁、各算几个、借哪些块都由调度器定；runner 只执行计划，连一个 token 都没有的计划也照样收到，对完账直接返回空。
- **「第一次调用就交回 token。」** 第一次调用在前向之后返回空，词表分数暂存在执行状态里；token 由第二次调用交回。
- **「两次调用各跑一遍模型。」** 主模型的全部层只在第一次调用里跑一遍。第二次调用做采样；开着投机解码时还会跑草稿层（GLM 是 1 层 MTP 连跑三遍），但不重跑主模型。
- **「每一行输出都要算词表分数。」** 只有选中的行过输出头；其余行的价值在前向中已经兑现，就是给各层留下历史。
- **「把 A、C 这一步放到 GLM 上，两行词表分数有 2 × 154880 = 309,760 个数，显存和乘法量都按这个数算。」** 309,760 只是逻辑上的分数个数。输出头按 TP 切开时，每卡先只算自己那 1/8 的词，拼齐前每卡一行只有 19,360 个；乘法量还要乘上隐藏维度 4096；实际显存峰值还取决于实现路径。这三样都不能拿逻辑个数直接代替。
- **「runner 每一步从头建一遍所有状态。」** 权重、KV cache 缓存池、录好的图从不重建；持久批次只改有变化的请求；只有输入缓冲、中间结果和执行状态每步更新。
- **「只有 0 号卡的 runner 在采样。」** TP 组里 8 个 runner 都拿到完整的词表分数、各自采样，用同一个随机种子，所以结果一致；只是引擎只收 0 号卡那份。
- **「DP1 没有请求，它的 runner 就闲着。」** DP1 的 runner 每步跑一次空批次陪 DP0，MoE 通信才凑得齐 16 张卡。
- **「一次调用必返回一个 token。」** 流水线非末段交出中间张量，pooling 模型交出池化结果；投机解码一步可以交回 1 到 4 个 token；提示词没算完的请求，这一步采到的结果不交出去。
- **「按函数在文件里的先后读，就是运行顺序。」** 同一个文件里混着启动时只跑一次的建池、录图代码和每步都跑的代码，要从两次调用的入口顺着调用往下读。

## 对照源码

### 怎么开

model runner 没有开关：每个 Worker 在 `init_device` 选好卡之后一定建一个。决定它走哪条路的是这几样：

- **v1 还是 v2。** `use_v2_model_runner` 为真时建 `vllm_ascend/worker/v2/model_runner.py` 里的实验性实现，否则建 `vllm_ascend/worker/model_runner_v1.py` 的 `NPUModelRunner`，它继承上游 `GPUModelRunner` [C17]。昇腾补丁让这个开关只看环境变量 `VLLM_USE_V2_MODEL_RUNNER`，不设就是 v1 [C20]。本页讲的都是 v1。
- **投机解码。** 配了 `speculative_config` 时，`sample_tokens` 在 `_bookkeeping_sync` 之后调 `propose_draft_token_ids` 草拟 [C12]。异步调度下，上游 `_update_states` 按「上一步草稿全接受」先记账，返回一个修正函数；`execute_model` 存完 `ExecuteModelState`、返回之前才调用它 [C24]。
- **混合模型的接受数。** `need_accepted_tokens` 在 `initialize_kv_cache` 里按「注意力分组里有没有 `MambaSpec`」定 [C15]；上游 `_update_states_after_model_execute` 只在开了投机解码且 `model_config.is_hybrid` 时才数接受数 [C22]。GLM 的 KDA 层类继承 `MambaBase`，报出的是 `MambaSpec`，模型类 `AscendGlm5NextForCausalLM` 声明了 `IsHybrid`，所以 GLM 双机每步采样后都会数 [D]。
- **结构化输出。** 第二次调用带了 `grammar_output` 才走 `apply_grammar_bitmask`，昇腾在这里把 logits 拷到 CPU 转 fp32 再拷回。
- **GLM 镜像下不走的两段。** `mamba_cache_mode == "align"` 时才在建元数据前调 `preprocess_mamba`、在前向上下文里调 `do_mamba_copy_block`（按块边界搬线性注意力状态）；`use_compress` 为真时才算压缩位置 [C6]。本部署 `mamba_cache_mode=none`（见[请求调用链](request-call-chain.md#七站逐站从哪个函数进往下调谁)第 2 站），GLM 配置没有 `compress_ratios`，两段都不执行。

### 会报什么错

- `RuntimeError("State error: sample_tokens() must be called after execute_model() returns None.")`：第一次调用进来时执行状态还没被取走 [C3]。说明两次调用的交替被打乱，要查调用方，不是模型算错。
- `RuntimeError("unexpected error")`：批次队列路径上第二次调用返回了 `None`。引擎把它当作第一次调用出了错，先去取第一次调用的异常重新抛出，取不到才抛这一句 [C26]。
- `VLLM_USE_V2_MODEL_RUNNER is not supported on vllm 0.23.0; falling back to v1 model runner.`：配套 vLLM 是 0.23.0 时设了 v2 开关，打这条 warning 后仍用 v1 [C19]。真正选上 v2 时另打 `npu model runner v2 is in developing, some features doesn't work for now.`。
- 异步调度下，上一步被丢弃或因 KV 加载失败要重算的请求：不报错。昇腾先把它们的 `prev_num_draft_len` 清零，重算回退的在 `_update_states` 里清 [C2]，被丢弃的在 `execute_model` 对账之前清 [C4]。按源码注释，被丢弃的那类不清零，父类 `_update_states` 会在 `prev_req_id_to_index` 里查不到而抛 `KeyError`。

### 开销和什么时候别开

- runner 本身不能关，能选的是它的分支。
- **前向前的主机端工作。** 对账、准备输入、定执行方式、建元数据每步都在前向前做完；异步调度让它和上一步的设备计算重叠，图模式则省掉逐个下发算子的开销，见[异步调度](async-scheduling.md)与 [ACL Graph](acl-graph.md)。
- **执行状态。** 只存引用；R1 第二步每卡最大的几样合计约 1.24 MiB [D]。代价是顺序约束，不是显存。
- **套允许词表。** 昇腾 V1 在 CPU 上做：整张 logits 拷到 CPU、转 fp32、改完拷回 [C11]。行数越多来回越重，满载 decode 一步 128 行时的字节数见[结构化输出](structured-output.md)。
- **只让选中行过输出头。** 省的是「(本步行数 − 选中行数) × 词表宽度」的投影，前向本身省不掉；R1 第一步 4 行只投 1 行 [D]。
- **接受数在另一条流上数。** 采样后记一个事件，在全局流上等这个事件再更新接受数，不挡主流上的后续工作 [C13]。
- **计时校准。** `profiling_chunk_config.need_timing` 为真时，第一次调用开头和第二次调用结尾各做一次设备同步来计时；校准结束的标志 `disable_profiling_timing` 挂在调度计划上跨进程传给 Worker，因为在调度器进程里改配置对象影响不到 Worker 进程 [C3]。同步会打断异步流水，只在校准期间发生。
- **读代码时可以先跳过的分支。** 流水线并行、上下文并行（PCP、DCP）、KV 传输、多模态编码、pooling、ngram 草稿，本部署都不走 [A]。

### 版本差异

按知识库固定快照核对：v0.23 维护分支 Ascend 2c59ff10（配 vLLM 0fc695fc，没有 GLM 代码）；GLM 专用镜像 Ascend db701c1f 单列；v0.26 rc 分支 Ascend 2ed6cbba（没有 GLM 代码）；main 为 Ascend baa023ad（GLM 在 `models/glm5next/`）。

| 项 | v0.23（2c59ff10） | GLM 镜像（db701c1f） | v0.26（2ed6cbba） | main（baa023ad） |
|---|---|---|---|---|
| 两次调用、12 项执行状态、State error | 有 | 有 | 有 | 有，内容相同 |
| logits 拷到 CPU 套允许词表 | 有 | 有 | 有 | 有 |
| 异步调度下的两处防护 | 有 | 有 | 有 | 有 |
| 在 vLLM 0.23.0 上设 v2 开关 | 警告并退回 v1 | 同左 | 这段退回已删，按开关走 | 同 v0.26 |
| `super().__init__()` 前为 PCP 临时加大批 token 上限（标 TODO） | 有 | 有 | 已删 | 已删 |
| 判断要不要数接受数 | 扫注意力分组找 `MambaSpec` | 同左 | 同左 | 直接读 `has_mamba_layers` |
| 文件行数 / `execute_model` 起始行 | 5251 / L1950 | 5480 / L1917 | 5314 / L1799 | 6242 / L2183 |

main 改读 `has_mamba_layers`，注释说新的打包布局把递推状态规格放进统一类型的组里，旧的「看每组第一个规格」认不出来 [C38]；v0.26 的 `init_device` 已没有 0.23.0 的退回分支 [C37]；PCP 那段在 db701c1f 里仍在：父类初始化前把批 token 上限加上「PCP 大小 × 2 × 最大并发请求数」，初始化完再减回去，本部署是 8192 临时加 1 × 2 × 32 = 64 [C33]。表中其余各行是在四个 commit 上逐项检索同名方法和字符串得到的 [D]。

和上游 GPUModelRunner 比，昇腾 V1 有两处行为不同：上游在设备上原地套允许词表，昇腾在 CPU 上做；上游用设备上的采样结果草拟时不等整理结果，先草拟再整理 [C32]，昇腾先整理再草拟。本页的 GLM 算例基于 db701c1f 的执行代码；上游安装、有效默认值和设备实测，以[来源基线](../sources/glm-5-3-flash-baseline.md)的核实范围为准。

### 源码位置

读法：先定要看两次调用里的哪一段，再从入口顺着调用往下跟 [A]。下表行号都是 `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py`，另注的除外。

| 你想看的事 | 进哪里 | 行号 |
|---|---|---|
| 执行状态的 12 项 | `ExecuteModelState` | L269–L285 [C1] |
| runner 在哪建、Worker 怎样转交两次调用 | `worker.py` 的 `init_device`、`execute_model`、`sample_tokens` | L505–L521、L599–L667 |
| 顺序闸、计时校准 | `execute_model` 开头 | L1917–L1937 |
| 异步防护、对账、空步返回、准备输入 | `execute_model` 的「prepare input」段；`_update_states` | L1991–L2067；L748–L763 |
| 乐观记账与事后修正（上游） | `vllm@0fc695fc` `gpu_model_runner.py` 的 `_update_states` | L1304–L1316、L1461–L1494 |
| 定执行方式 | `_determine_batch_execution_and_padding` | 调用 L2082–L2096；定义 L2898–L2990 |
| 建注意力元数据、层按后端分组 | `_build_attention_metadata`；`get_attn_backends_for_group` | L2198–L2211；L5041–L5063 |
| 前向上下文与前向 | `set_ascend_forward_context`、`_model_forward` | L2259–L2291 |
| PP 与 pooling 出口、选行、输出头 | `execute_model` 的「post process」段 | L2306–L2327 |
| 词表分数的 All-Gather | `vllm@0fc695fc` `logits_processor.py` 的 `_gather_logits` | L75–L87 |
| 存执行状态、补上一步的账 | `execute_model` 末尾 | L2349–L2371 |
| 取出、清空、套允许词表、采样 | `sample_tokens` | L2373–L2427 |
| 整理结果、草拟、打包输出 | `_bookkeeping_sync`、`propose_draft_token_ids` | L2455–L2510 |
| 数接受数、异步输出 | `_update_states_after_model_execute`、`AsyncGPUModelRunnerOutput` | L2517–L2582；上游定义 L1495–L1513 |
| 引擎怎样发两次调用、只收一份 | `vllm@0fc695fc` `engine/core.py` 的 `step` 与批次队列；`multiproc_executor.py` 的 RPC 与输出卡号 | L443–L463、L508–L597 [C25]；L307–L326、L495–L509 |
| 8 张卡同一个随机种子 | `worker.py` 初始化 | L496–L499 |

**待核：** R1 第二步执行状态里的隐藏向量按 BF16 计，依据是一条请求页里 [4, 4096] 取 32,768 B 的口径，未在设备上实测张量的 dtype；异步调度是否真的打开，要看启动日志里 `Asynchronous scheduling is` 那一行。
