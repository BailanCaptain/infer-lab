---
id: npu-model-runner
title: NPUModelRunner：每张卡上把一步计划跑成 token 的执行者
type: concept
summary: >-
  model runner 是每张卡的 Worker
  里执行一步的对象：按调度计划对账跨步保留的请求记录，拼输入、定执行方式、跑前向，只把每条请求要预测的那几行变成词表分数，暂存进执行状态；引擎第二次调用时再取出来采样、草拟候选，按请求交回
  token。前向和采样拆成两次调用，中间靠执行状态交接。
aliases:
  - NPUModelRunner
  - model runner
  - ModelRunner
  - GPUModelRunner
  - execute_model
  - sample_tokens
  - logits_indices
  - ExecuteModelState
  - 执行状态
  - 两次调用
  - 前向与采样交接
  - need_accepted_tokens
  - 接受数
chapters:
  - 09
order: 40
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L269-L285'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1917-L1937'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1991-L2067'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2082-L2096'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2127-L2176'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2198-L2211'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2259-L2291'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2306-L2347'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2349-L2371'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2427'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2455-L2510'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2517-L2582'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L2990'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3842-L3862'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5041-L5063'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L521'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L667'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L159-L163'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2439'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1495-L1513'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1304-L1316'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1461-L1494'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L463'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L508-L597'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L326'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509'
  - 'vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L45-L87'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L496-L499'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/abstract.py#L44-L60'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4462-L4486'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L288-L346'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1950-L1970'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1799-L1819'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2183-L2195'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L489-L504'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4480-L4482'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L159-L163'
  - >-
    raw:sha256-08b2629ad53c5d2df4de57ac7458ea4a818913d4a5f5922312985de50f6fed55.md#L1-L1241
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/model_runner_v1.py#L2914-L2940
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506'
  - 'vllm@ced6857a:vllm/config/vllm.py#L675-L724'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L43
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L969-L995'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L858-L862'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L140'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L160-L175'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L346-L361'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2229-L2241'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2657-L2678'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2764-L2814'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L961-L976'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L2288-L2311'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L178-L198'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L63'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L370-L380'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L4604-L4616'
  - 'vllm@ced6857a:docs/design/model_runner_v2.md#L1-L206'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L424-L480'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L498-L521'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L31'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L353-L375'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2227-L2245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4604-L4615'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L89'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L7'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L144-L160'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: model-runner-v2
    kind: variant-of
    note: V2 执行器的常驻设备缓冲、独立状态组织，以及 main 全面收敛至 MRV2 的架构演进
  - to: prepare-inputs-flow
    kind: builds-on
    note: 对账之后怎样拼出 token id、位置、槽位和选行，逐行算法在那一页
  - to: one-request
    kind: builds-on
    note: R1 在第 3–5 站的形状、词表分数的字节数和 MTP 草拟三遍
  - to: concurrent-requests
    kind: builds-on
    note: 场景 M 一步 49 行词表分数怎样拆回 13 条请求，以及补齐与两组对齐的账
  - to: npu-worker-lifecycle
    kind: builds-on
    note: runner 在启动时何时建好、装权重、建缓存池、录图
  - to: glm-5-3-flash
    kind: builds-on
    note: Runner 调用的是已构建的 GLM 模型，各层计算由模型实现组织
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-08b2629ad53c5d2df4de57ac7458ea4a818913d4a5f5922312985de50f6fed55.md
  - >-
    raw/sha256-685c3b63ded8756226cf666453ca6d9b98befd8d2d8fac481f3340f589f43953.md
  - >-
    raw/sha256-a547875ecafc880d24081e0098a918b75e51c650b206006073998e5a2a2e317c.md
---

## 每张卡上，是谁把「这一步算谁」跑成「这一步出了哪些 token」？

**model runner（昇腾实现叫 NPUModelRunner）是每张卡的 Worker 里执行一步的对象：它接过调度器这一步的计划，对照自己跨步记着的请求记录，把计划拼成模型的输入、跑一遍模型，只把要预测的行变成词表分数（词表里每个词一个分数，越高越可能是下一个 token）；等引擎第二次调用时再采样，把新 token 按请求交回去。**

它让连续多步复用请求记录，也省去不需要的输出头计算；代价是每步前向之前要在 CPU 上整理输入和状态，两次调用之间还得保留张量，直到采样、草拟用完。批次越复杂，记账与传输越可能挤占设备等待的时间。

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
| 调度器 | 这一步算哪些请求、各算几个、借哪些块 | 不执行模型前向或张量计算 |
| Worker | 一张卡的设备、通信组、启动顺序；把两次调用转给 runner | 不拼输入 |
| model runner | 每一步的对账、拼输入、定执行方式、前向、选行、采样交接 | 不决定算谁 |
| 模型与注意力后端 | 各层怎么算、每层的注意力算子要什么格式 | 不认识请求 |

表里说的是谁持有谁、谁调谁：Worker 持有 runner，runner 调模型和注意力后端。这和进程怎样划分是两回事，本部署里它们都在同一个 Worker 进程内，进程与执行器的关系见[进程与执行器](engine-processes.md)。

## 一步怎么走：A、C 这一步，runner 手里的数怎么变？

**第一次调用做到「每条请求一行分数」为止，第二次调用才把分数变成 token。** 用 A、C 这一步把中间的数走一遍。词表按 5 个词示意（真实模型有十几万个）；采样设温度为 0，直接取分数最大的词，叫 greedy。很小的正温度仍属于随机采样，不能用“接近 0”代替这个条件；配置与采样规则见[采样](sampling.md)。

1. 对账后，持久批次里记着：A 已算 5 个位置；C 是新请求，已算 0 个，排在 A 后面。
2. 准备输入按这份记录拼出 4 行，同时算好**选行**：每条请求本步最后一行的行号，这里是 [0, 3]，推导见[准备输入](prepare-inputs-flow.md#哪几行送去输出头)。
3. 前向完，4 行输出都在。runner 按选行挑出第 0、3 行，只让这 2 行过**输出头**（lm_head：把一行隐藏向量乘成词表上每个词一个分数的那一层）。
4. 2 行分数连同计划等一起存进执行状态，第一次调用返回空。
5. 第二次调用取出分数，逐行采样，再按「第 0 行是 A、第 3 行是 C」交回。

按 5 词示意词表，前向 4 行全部照算，但只有选中行进入输出头，省下 $(4 - 2) \times 5 = 10$ 个词表分数（$\text{greedy}$ 采样直接取最大分数的下标）：

$$\text{logits\_count} = 2\text{ 行} \times 5\text{ 词} = 10 \quad (\text{全过输出头需 } 4 \times 5 = 20)$$

| 步骤与对象 | 示意数值（5 词表，下标 `0..4`） | 选词与去向 |
| --- | --- | --- |
| 前向输出 | 4 行（第 0 行属 A，第 1–3 行属 C） | 仅选第 `0, 3` 行过 `lm_head` |
| A（第 0 行 logits） | `[0.3, 2.1, -0.5, 1.4, 0.2]` | $\text{argmax} = 1$（即 $a_6$） |
| C（第 3 行 logits） | `[1.2, -0.3, 0.8, 3.0, 0.1]` | $\text{argmax} = 3$（即 $c_3$） |
| 暂存与交回 | 10 个分数暂存在执行状态，第二次调用按请求拆回 | `{A: 第 1 个词, C: 第 3 个词}` |

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
- **本步没有 token 就走提前返回分支。** 普通情况对完账就返回空结果，不进入后面的输入准备与正常模型前向。外部启动器配合多组 DP 时，会先跑一次 dummy 计算保持组间协调；有 KV 传输组时，还要走不做正常前向的 connector 协作路径。空计划不等于所有配置下设备都没有工作。
- **定执行方式。** 这一步究竟是回放预先录好的计算图（graph mode：把整次前向录成一张图，到时整张回放），还是逐算子下发（eager）；张量要往上补到多宽；两个 DP 组之间又如何对齐宽度和图模式。规则见 [ACL Graph](acl-graph.md)，补多宽的账见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)，runner 在这里负责每步查询一次并把结论带进前向。需要留意的是，固定镜像在启用投机解码时，以「已计算位置数不少于提示词长度」来判断请求是否已进入 decode，再据此检查批次是否整齐——单看「已经算过一些位置」或「本步宽度恰好等于 1 + 草稿数」并不足够，因为单 token 的 PD 交接块或恰好等宽的尾部提示词块仍处在 prefill 阶段；非投机分支的局部检查不同，最终图模式仍由后续分派器落定。

- **在前向上下文里跑模型。** runner 把本步宽度、两组各自的 token 数、图模式、注意力元数据放进一个前向上下文，各层在里面自己取，不靠函数参数一层层往下传。
- **发出前向之后才补上一步的账。** 异步调度下，上一步到底接受了几个草稿，要等上一步的采样结果拷回 CPU 才知道。runner 先按乐观的数把本步前向发出去，存完执行状态、返回之前再回头修正已算位置数，等结果的时间就不挡在前向前面。这是 GLM 这种配置下的顺序；模型开着按块边界搬线性注意力状态（align 模式）或带压缩配置时，修正会提前到前向之前。

准备输入的最后一段是建注意力元数据：公共底稿按缓存组、按每类注意力后端各整理一份；层在建缓存时就按「后端是谁 + 缓存规格是什么」归拢成组，所以同一批请求的公共信息能一次换成各后端要的格式，见[准备输入](prepare-inputs-flow.md#注意力元数据一份底稿按缓存组换上各自的块表和槽位)和[注意力后端](attention-backend-family.md#runner-怎样把层归拢成组)。

前向之后有两个常见出口不走选行。[流水线并行](pipeline-parallel.md)（PP，把层按段分到不同卡上）未启用输出广播时，非末段把中间张量交给下一段就返回；pooling 模型（只要整段输入的向量表示、不生成 token 的模型）直接交出池化结果，引擎不再发采样调用。这些分支不存执行状态，但 PP 的无状态采样入口仍可能接收末段广播的采样编号、传回 KV connector 的进度，处理完才返回；具体条件见页末源码位置。启用 PP 输出广播时，非末段则接收末段的 logits 后继续保存执行状态。所以接口并不是「一次调用必返回一个 token」。

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

**执行状态（`ExecuteModelState`）是一个只装一份的单槽位暂存格：第一次调用 `execute_model` 在前向与选行输出头之后，把第二次调用 `sample_tokens` 要用的张量引用全部放进去；第二次调用一开头就取出并清空。** 它既不是 KV cache，也不是跨步保留的持久批次，寿命仅限于两次 RPC 之间这一小段。下面这张状态机图把「严格交替锁槽」「不写状态的早退/DP 陪跑分岔」和「Runner 三层对象寿命」合在一起对照：

```wiki-diagram
file: npu-model-runner-fig-step-lifecycle
```

这份执行状态里一共 12 项，按用途分成以下几类：

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

**在本页不做运行期权重更新的普通推理中，runner 手里的东西按寿命分三层：启动时建好并跨步复用的；跨步保留、每步改一点的；只活一步、甚至只活两次调用之间的。** 分清这三层，读代码和排查问题时就知道某个值该不该在这一步变。训练后换权重、sleep/wake 或重新录图属于额外的生命周期操作，见[训推联动](vllm-ascend-for-rl.md)。

| 寿命 | 有哪些 | 什么时候建、什么时候变 |
|---|---|---|
| 整个服务期间 | 权重、KV cache 缓存池、录好的计算图、各层按后端归好的组 | 启动时按固定顺序建好，见 [Worker 生命周期](npu-worker-lifecycle.md) |
| 跨步 | 持久批次（请求记录、块表、已算位置数）、接受数表、异步调度下留在 NPU 上的上一步 token | 每步只增、删、改有变化的请求 |
| 一步之内 | 拼出来的输入、各层的中间结果、执行状态 | 下一步重新填写；执行状态在第二次调用开头就清空 |

输入缓冲和中间结果是同一批缓冲区每步重新填，上一步留下的内容不代表这一步。

这一层划分也是读 runner 源码的钥匙。那个五千多行的文件里混着四类代码：启动时只跑一次的（建对象、装权重、量显存、建缓存池、录图）；每步都走的（两次调用和它们往下调的方法）；拿假批次试跑的路径（启动时量显存、录图用它，空闲的 DP 组陪跑也用它）；以及本部署不走的分支（流水线并行、上下文并行、KV 传输、多模态、pooling）。读的时候先想清楚要看的是哪一类、哪一步，再从两次调用的入口顺着调用往下跟。

## Model Runner V2 为什么要重新组织状态？

MRV2 改的是每步执行器怎样保存状态、准备输入和组织设备工作。上游设计把“请求长期占哪一行”与“这一步模型输入按什么顺序排列”分开：请求活着时有固定状态行，每一步再按实际批次顺序收集输入。比如示意中 A 的状态在第 7 行，C 在第 2 行，本步顺序为 C、A，就按 [2, 7] 取出两行；不用为了本步排序而搬动长期状态。被抢占的请求按结束处理，恢复时重新登记。

这样也更容易处理异步拷贝。若 CPU 在设备还读取上一份缓冲时原地改写它，两步就会串数据。上游 V2 的一种办法是保留普通 CPU 状态，再为本次传输生成临时的 pinned 快照——pinned 是可供异步设备传输使用的固定主机内存。示意状态从 5 改成 6 时，设备仍可读本步快照中的 5；新的 6 留给下一步。代价是快照的空间与复制，收益是减少为了保护同一块共享缓冲而等待。

大块表则不必每步全拷：StagedWriteTensor 把设备上的基表保留下来，在 CPU 收集变更，打包传过去，再用一次设备计算写入。例如只改第 2 行的三个块号，就传这三个值和它们的位置；仍要付出打包、传输和应用变更的开销。输入编号、位置、边界等还可以在设备侧准备，减少 Python 逐项操作。

上游设计也把采样、图管理和试跑职责拆开。采样用独立的设备实现管理随机数与概率；试跑委托正常执行入口，录图有单独路径。将多次草拟合在一张图里时，注意力后端还必须正确更新随位置变化的派生元数据；更新函数的 Python 部分在捕获时执行，回放依靠录下来的设备操作，不能假定每次回放都会重新执行 Python。

这段解释对应固定上游 MRV2 设计。在昇腾侧，**`v0.30.0` 默认仍走 `model_runner_v1.py` 的 MRV1 执行器**，设环境变量 `VLLM_USE_V2_MODEL_RUNNER` 才会切换到 `worker/v2/model_runner.py`。到了 **`main` 分支，仓库已物理删除 `model_runner_v1.py`，全面收敛至 `worker/v2/model_runner.py`**（纯多模态编码器专用模型改走 `MMEncoderModelRunner`，详参 [Model Runner V2](model-runner-v2.md) 与 [v0.30.0 与 main 演进](model-runner-v2.md#v0300-按需开启-vs-main-彻底统一)）。上述 GPU、UVA 或 Triton 路径不能仅因开启环境变量就当作 NPU 已支持；本站 GLM 旧配方仍用 V1，后面的执行状态与两次调用算例保持该前提，迁移时先看[版本差异](#版本差异)，再核实际 runner 的输入、图和模型限制。

## 标准主干走读：Qwen3-8B 单组推理的两次调用

在 `v0.30.0` 标准主基线下，**Qwen3-8B**（36 层同构 GQA，默认不开启投机解码）在 `NPUModelRunner` 中走的是最干净的一条主线：

1. **第一次调用（`execute_model`）**：先确认 `execute_model_state` 为空并增量对账 `input_batch`，再拍平一维 `input_ids [T]`、`positions [T]` 与单一 `slot_mapping [T]`。随后判定图模式与补齐宽度（纯 decode 命中 `ACLGraph`，prefill / 混合批走 eager 或分段图），构建全 36 层共用的 **1 份 `AscendMetadata`** 并跑完前向。最后仅取每条请求末行经 `lm_head` 算出 `[B, 151936]` 词表分数，存入 `ExecuteModelState` 并返回 `None`。
2. **第二次调用（`sample_tokens`）**：先取出并清空 `ExecuteModelState`，按需施加结构化语法掩码。随后走普通 `AscendSampler` 为每条请求选出 **1 个** `next_token_id`，过滤未完 chunked prefill 请求后打包交回引擎（TP>1 时仅 `output_rank` 回传）。由于未开投机解码，**不会触发 MTP 候选草拟，也不会统计线性注意力接受数**。

只有当你显式开启投机解码（如 MTP）或部署含线性注意力（KDA / Mamba）的混合模型时，第二次调用末尾才会追加「草拟下一步候选」与「记录接受数」两段逻辑——下文的历史 GLM 双机案例正是这种完整形态。

## 放到 GLM 双机：16 个 runner，R1 的两步各做了什么？

从这里转入例外 B 历史绑定算例：2 台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。模型是 GLM-5.3-Flash（下文简称 GLM）；R1 是全库跟踪的[示例请求](one-request.md#示例请求-r1-与官方双机部署)，提示词 4 个 token（教学设定），落在 DP0（第一台机器）。

**16 张卡，16 个 runner，各算各的那一份。** 每张卡由一个 Worker 进程守护，每个 Worker 在选卡后建一个 runner。DP0 引擎经共享内存广播队列把同一份计划发给本机 8 个 Worker，8 个 runner 各自对账并拼出同样的 4 行输入，差别只在权重分片（每卡 KDA 8 头、MLA 8 头、路由专家 18 个，见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)）。DP1 无请求时，其 8 个 runner 不走常规两次调用，而是跑一次空批次（dummy batch）与 DP0 对齐宽度，让 MoE 通信凑齐 16 张卡（见[请求调用链](request-call-chain.md#同一条请求第-1-步和第-2-步走的分支不同)）。

**第一步（prefill，把提示词一次算完）。** 对账时 R1 坐进持久批次第 0 行；准备输入拼出 4 行（位置 0–3），选行仅第 3 行。本步含 prefill，无法命中纯 decode 图，runner 按 eager 执行并与 DP1 对齐宽度。建注意力元数据时，稀疏 MLA 与 KDA 各拿一份（见[准备输入的 GLM 一节](prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)）。前向跑完 45 层输出 `[4, 4096]`，仅第 3 行进入输出头：8 张卡各算 19,360 个词的分数，经一次 [All-Gather](collective-communication.md#all-gather) 拼齐为 `[1, 154880]`（切法见[张量并行的词表一节](tensor-parallel.md#词表入口求和出口拼接)），存入执行状态后返回空。

**第一步第二次调用（采样 + 3 遍 MTP 草拟）。** R1 无结构化输出、无草稿，走普通采样器。8 个 runner 各自采样并在分数、实现与随机流一致的前提下得到相同的首 token $y_0$（复现条件见[采样](sampling.md)）。接着 MTP 草稿层读取执行状态里的隐藏向量连跑 3 遍，猜出 $d_1, d_2, d_3$（GLM 开投机时草拟强制走 eager，输入错位见[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)）。最终仅 0 号卡将结果交回引擎；异步调度自动开启，$y_0$ 与 3 个候选留在 NPU 上供下一步直接拼输入。

**第二步（第一个 decode 步，验证 1 + 3 个 token）。** 计划为「R1 算 4 个」（$y_0$ 加 3 个候选，位置 4–7）。本步只有 R1 一条请求且整齐满足纯 decode 条件，runner 命中并回放 4-token 的已录计算图。4 行全部进入输出头，拼齐后每卡词表分数为 `[4, 154880]`（从第三步起，对账才会先按乐观接受记账、前向后再修正）。

**第二步第二次调用（拒绝采样 + KDA 接受数记账）。** 本步走拒绝采样器：前 3 行逐位验证 3 个候选，全过时第 4 行多给 1 个 token，因此交回 1 到 4 个 token。随后 runner 整理结果、草拟下一轮 3 个候选，并因主干含 34 层 KDA 线性注意力而统计 R1 本步接受数写入接受数表，供第三步 KDA 从对应候选状态续算。

这一步执行状态里最大的几样，每张卡（4 行全被选中，词表分数 `[4, 154880]` BF16 推导见一条请求第二圈）：

$$M_{\text{state,top3}} = 1{,}239{,}040 + 32{,}768 + 32{,}768 = 1{,}304{,}576\text{ B} \approx 1.24\text{ MiB}$$

| 暂存张量（R1 第二步，单卡） | 形状与精度 | 字节算式与大小 |
| --- | --- | --- |
| 词表分数（logits） | `[4, 154880]`，BF16 | $4 \times 154{,}880 \times 2\text{ B} =$ **1,239,040 B** |
| 全部行的隐藏向量 | `[4, 4096]`，BF16 | $4 \times 4{,}096 \times 2\text{ B} =$ **32,768 B** |
| 选中行的隐藏向量 | `[4, 4096]`，BF16（4 行全选中） | $4 \times 4{,}096 \times 2\text{ B} =$ **32,768 B** |
| **三项合计** | 存引用不拷贝，活到第二次调用开头清空 | **1,304,576 B ≈ 1.24 MiB** |

这个单请求算例的暂存较小，仍必须留到第二次调用用完，下一次前向才能开始；批次扩大时暂存量也随之改变。这里首先要理解的是这道顺序约束。词表分数那一项的推导在[一条请求的第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

多条请求一起跑时，一步要交接的行数随请求变：[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里 DP0 一步有 13 条请求，runner 要把 49 行词表分数拆回 13 条，账在[多条请求的第 5–7 站](concurrent-requests.md#第-57-站-采样验证与收尾结果按请求拆回去)。

## 常见误解

- **「runner 决定这一步算谁。」** 算谁、各算几个、借哪些块都由调度器定；runner 只执行计划。零 token 计划也照样收到，随后按配置处理必要的组间或 KV 传输协作，再提前返回。
- **「第一次调用就交回 token。」** 第一次调用在前向之后返回空，词表分数暂存在执行状态里；token 由第二次调用交回。
- **「两次调用各跑一遍模型。」** 主模型的全部层只在第一次调用里跑一遍。第二次调用做采样；开着投机解码时还会跑草稿层（GLM 是 1 层 MTP 连跑三遍），但不重跑主模型。
- **「每一行输出都要算词表分数。」** 只有选中的行过输出头；其余行的价值在前向中已经兑现，就是给各层留下历史。
- **「把 A、C 这一步放到 GLM 上，两行词表分数有 2 × 154880 = 309,760 个数，显存和乘法量都按这个数算。」** 309,760 只是逻辑上的分数个数。输出头按 TP 切开时，每卡先只算自己那 1/8 的词，拼齐前每卡一行只有 19,360 个；乘法量还要乘上隐藏维度 4096；实际显存峰值还取决于实现路径。这三样都不能拿逻辑个数直接代替。
- **「runner 每一步从头建一遍所有状态。」** 普通推理跨步复用权重、KV 池和已录好的图；持久批次只改有变化的请求；输入缓冲、中间结果和执行状态每步更新。换权重或重建图另有生命周期流程。
- **「只有 0 号卡的 runner 在采样。」** TP 组里 8 个 runner 都拿到完整词表分数并各自采样，引擎只收 0 号卡那份。结果一致还依赖实际分数、实现、随机流与调用顺序一致，不能单由相同 seed 保证。
- **「DP1 没有请求，它的 runner 就闲着。」** DP1 的 runner 每步跑一次空批次陪 DP0，MoE 通信才凑得齐 16 张卡。
- **「一次调用必返回一个 token。」** 流水线非末段交出中间张量，pooling 模型交出池化结果；投机解码一步可以交回 1 到 4 个 token；提示词没算完的请求，这一步采到的结果不交出去。
- **「按函数在文件里的先后读，就是运行顺序。」** 同一个文件里混着启动时只跑一次的建池、录图代码和每步都跑的代码，要从两次调用的入口顺着调用往下读。

## 对照源码

### 怎么开

model runner 没有开关：每个 Worker 在 `init_device` 选好卡之后一定建一个。决定它走哪条路的是这几样：

- **v1 还是 v2。** 在 `v0.30.0`（`c09d3e20`）及之前版本，`use_v2_model_runner` 为真时建 `vllm_ascend/worker/v2/model_runner.py` 里的实现，否则默认建 `vllm_ascend/worker/model_runner_v1.py` 的 `NPUModelRunner`（继承上游 `GPUModelRunner`）[C17]；昇腾补丁让该开关只读环境变量 `VLLM_USE_V2_MODEL_RUNNER`，未设时默认返回 `False`（走 V1）[C20]。到了 `main`（`8d6180e2`），`model_runner_v1.py` 已物理删除，`mrv2_utils.use_v2_model_runner` 恒返回 `True`，普通模型统一实例化 `worker/v2/model_runner.py` 的 `NPUModelRunner`（多模态编码器专用模型改走 `MMEncoderModelRunner`），详解见 [Model Runner V2](model-runner-v2.md) [C68]。本页 GLM 执行走读是 V1；实际支持条件按下表区分版本。

- **投机解码。** 配了 `speculative_config` 时，`sample_tokens` 在 `_bookkeeping_sync` 之后调 `propose_draft_token_ids` 草拟 [C12]。异步调度下，上游 `_update_states` 按「上一步草稿全接受」先记账，返回一个修正函数；`execute_model` 存完 `ExecuteModelState`、返回之前才调用它 [C24]。
- **混合模型的接受数。** `need_accepted_tokens` 在 `initialize_kv_cache` 里按「注意力分组里有没有 `MambaSpec`」定 [C15]；上游 `_update_states_after_model_execute` 只在开了投机解码且 `model_config.is_hybrid` 时才数接受数 [C22]。GLM 的 KDA 层类继承 `MambaBase`，报出的是 `MambaSpec`，模型类 `AscendGlm5NextForCausalLM` 声明了 `IsHybrid`，所以 GLM 双机每步采样后都会数 [D]。
- **结构化输出。** 第二次调用带了 `grammar_output` 才走 `apply_grammar_bitmask`，昇腾在这里把 logits 拷到 CPU 转 fp32 再拷回。
- **GLM 镜像下不走的两段。** `mamba_cache_mode == "align"` 时才在建元数据前调 `preprocess_mamba`、在前向上下文里调 `do_mamba_copy_block`（按块边界搬线性注意力状态）；`use_compress` 为真时才算压缩位置 [C6]。本部署 `mamba_cache_mode=none`（见[请求调用链](request-call-chain.md#七站逐站从哪个函数进往下调谁)第 2 站），GLM 配置没有 `compress_ratios`，两段都不执行。

### 会报什么错

- `RuntimeError("State error: sample_tokens() must be called after execute_model() returns None.")`：第一次调用进来时执行状态还没被取走 [C3]。说明两次调用的交替被打乱，要查调用方，不是模型算错。
- `RuntimeError("unexpected error")`：批次队列路径上第二次调用返回了 `None`。引擎把它当作第一次调用出了错，先去取第一次调用的异常重新抛出，取不到才抛这一句 [C26]。
- `VLLM_USE_V2_MODEL_RUNNER is not supported on vllm 0.23.0; falling back to v1 model runner.`：配套 vLLM 是 0.23.0 时设了 v2 开关，打这条 warning 后仍用 v1 [C19]。`v0.26.0rc` 与 `v0.30.0` 选上 v2 时另打 `npu model runner v2 is in developing, some features doesn't work for now.`。
- `ValueError("Model Runner V1 has been removed from vllm-ascend, so VLLM_USE_V2_MODEL_RUNNER=0 cannot be honored. Unset it to run Model Runner V2.")`：`main`（`8d6180e2`）已删除 V1 执行器，`mrv2_utils.apply_v2_model_runner_config_patch` 显式拦截遗留脚本中的 `VLLM_USE_V2_MODEL_RUNNER=0`（避免被静默忽略）[C69]。
- 异步调度下，上一步被丢弃或因 KV 加载失败要重算的请求：不报错。昇腾先把它们的 `prev_num_draft_len` 清零，重算回退的在 `_update_states` 里清 [C2]，被丢弃的在 `execute_model` 对账之前清 [C4]。按源码注释，被丢弃的那类不清零，父类 `_update_states` 会在 `prev_req_id_to_index` 里查不到而抛 `KeyError`。

### 开销和什么时候别开

- runner 本身不能关，能选的是它的分支。
- **前向前的主机端工作。** 对账、准备输入、定执行方式、建元数据每步都在前向前做完；异步调度让它和上一步的设备计算重叠，图模式则省掉逐个下发算子的开销，见[异步调度](async-scheduling.md)与 [ACL Graph](acl-graph.md)。
- **执行状态。** 只存引用；R1 第二步每卡最大的几样合计约 1.24 MiB [D]。引用延长张量寿命，两次调用还必须满足前述顺序约束。
- **套允许词表。** 昇腾 V1 在 CPU 上做：整张 logits 拷到 CPU、转 fp32、改完拷回 [C11]。行数越多来回越重，满载 decode 一步 128 行时的字节数见[结构化输出](structured-output.md)。
- **只让选中行过输出头。** 省的是「(本步行数 − 选中行数) × 词表宽度」的投影，前向本身省不掉；R1 第一步 4 行只投 1 行 [D]。
- **接受数在另一条流上数。** 采样后记一个事件，在全局流上等这个事件再更新接受数，不挡主流上的后续工作 [C13]。
- **词表分数如何汇总。** LogitsProcessor 从当前平台读取 use_all_gather，再决定 Gather 或 All-Gather。本页固定 NPUPlatform 继承平台基类，未重写该方法；基类返回 true，因此本部署走 All-Gather。选择分支、平台基类与 NPU 继承关系分别见来源 29、48、49。
- **计时校准。** `profiling_chunk_config.need_timing` 为真时，第一次调用开头和第二次调用结尾各做一次设备同步来计时；校准结束的标志 `disable_profiling_timing` 挂在调度计划上跨进程传给 Worker，因为在调度器进程里改配置对象影响不到 Worker 进程 [来源 3](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/model_runner_v1.py#L1917-L1937)。同步会打断异步流水，只在校准期间发生。
- **读代码时可以先跳过的分支。** 流水线并行、上下文并行（PCP、DCP）、KV 传输、多模态编码、pooling、ngram 草稿，本部署都不走 [A]。

### 版本差异

**`v0.30.0` 保留 V1 默认 + V2 可选，`main` 已物理删除 `model_runner_v1.py` 全面收敛至 MRV2。** 在 `v0.30.0`（`c09d3e20`），`worker.py#L510-L516` 按 `self.use_v2_model_runner` 选择 `model_runner_v1.py` 或 `worker/v2/model_runner.py`；配套上游 `VllmConfig.use_v2_model_runner` 原属性结合平台与功能白名单判断，Ascend 的 `patch_use_v2_model_runner.py#L18-L31` 覆写为纯读 `VLLM_USE_V2_MODEL_RUNNER`（未设即 `False`，默认走 MRV1），模型兼容性交由 NPU runner 自身校验。到了 `main`（`8d6180e2`），`vllm_ascend/worker/model_runner_v1.py` 已被物理删除，新增 `vllm_ascend/mrv2_utils.py#L29-L89` 将 `VllmConfig.use_v2_model_runner` 固定返回 `True`，并在 `worker.py#L603-L613` 直接实例化 `worker/v2/model_runner.py`（或针对多模态编码器专用模型实例化 `MMEncoderModelRunner`），若仍传入 `VLLM_USE_V2_MODEL_RUNNER=0` 则直接抛 `ValueError`。V2 的常驻缓冲、PCP 与 EPLB 集成详见 [Model Runner V2](model-runner-v2.md) 与 [CP 版本差异](context-parallel.md#版本差异)。

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `vllm@0fc695fc`，无 GLM 代码；本文 GLM 绑定算例另钉专用镜像 `db701c1f`）、`v0.26.0rc`（`2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `vllm@ced6857a`）与 `main`（`8d6180e2` / `vllm@ba15685a`）：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 默认执行器与 `model_runner_v1.py` | 默认 MRV1（`model_runner_v1.py`，5251 行；GLM 镜像 `db701c1f` 为 5480 行） | 默认 MRV1（5314 行）；删除 0.23.0 V2 退回分支，按开关选 V1/V2 | 默认 MRV1（6771 行，L2227 `execute_model` / L2763 `sample_tokens`）；未设 `VLLM_USE_V2_MODEL_RUNNER` 即走 V1 | **物理删除 `model_runner_v1.py`**；全面收敛至 `worker/v2/model_runner.py`（1690 行，L691 `execute_model` / L363 `sample_tokens`；纯编码器走 `MMEncoderModelRunner`） |
| `VLLM_USE_V2_MODEL_RUNNER` 开关行为 | 0.23.0 上设 V2 警告并退回 V1 | 按环境变量开关走 V1/V2，未设走 V1 | `patch_use_v2_model_runner.py#L18-L31` 只读环境变量，未设返回 `False`（走 V1） | `mrv2_utils.py#L29-L89` 恒返回 `True`；显式传 `=0` 直接抛 `ValueError` |
| V1 两次调用、12 项状态与 `State error` | 有（GLM 镜像同） | 有 | 有（`ExecuteModelState` 位于 L353），采样取出并清空状态 | V1 已移除；由 `worker/v2/model_runner.py` 的 V2 状态组织替代 |
| V1 CPU 语法掩码与异步调度防护 | 有（logits 拷回 CPU 套允许词表；异步两处清零） | 有 | 有 | V1 已移除；V2 另按设备采样与状态模型处理 |
| 父类初始化前为 PCP 临时加大批 token 上限 | 有（GLM 镜像为 `8192 + 1×2×32 = 8256`） | 已删 | 已删（V1 启动期直接拒绝 `PCP > 1`） | 已删；PCP 统一由 `worker/v2/pcp_manager.py` 承接 |
| 判断是否计数接受数（混合模型） | 扫注意力分组找 `MambaSpec` | 同 `v0.23.0` | 直接读 `kv_cache_config.has_mamba_layers`（L4608） | V2 独立 `model_states/mamba_hybrid.py` 承接 |

`v0.30.0` 改读 `has_mamba_layers` 是因为新的打包布局把递推状态规格放进统一类型的组里，旧的「看每组第一个规格」认不出来 [D]；`v0.26.0rc` 的 Worker 构造器已删除 0.23.0 的退回分支，`init_device` 按最终开关选类。PCP 临时加宽那段在 GLM 镜像 `db701c1f` 里仍在（`8192 + 1 × 2 × 32`）[C33]。`main` 收敛后本文旧 V1 的 12 项状态与逐行行号仅适用于 `v0.30.0` 及之前的 MRV1 路径，不再作为 `main` 的内部状态表 [I]。

和上游 GPUModelRunner 比，昇腾 V1 有两处行为不同：上游在设备上原地套允许词表，昇腾在 CPU 上做；上游用设备上的采样结果草拟时不等整理结果，先草拟再整理 [C32]，昇腾先整理再草拟。本页的 GLM 算例基于 db701c1f 的执行代码；上游安装、有效默认值和设备实测，以[来源基线](../sources/glm-5-3-flash-baseline.md)的核实范围为准。

### 源码位置

无执行状态时，异步调度、PP 段数大于 1 且不是 PP 的 KV producer 才接收上轮采样广播；随后按有无 connector 输出决定返回空值、空结果或传输进度，见来源 11。前向的非末段提前返回受 `broadcast_pp_output` 关闭条件控制，见来源 9。来源 47 是 Worker 发送响应前检查 `output_rank` 的分支，与来源 28 的输出卡选择公式合起来说明本部署仅 0 号卡回传。

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

**实测边界：** R1 第二步执行状态里的隐藏向量按 BF16 计，依据是一条请求页里 [4, 4096] 取 32,768 B 的口径，未在设备上实测张量的 dtype；异步调度是否真的打开，要看启动日志里 `Asynchronous scheduling is` 那一行。

**版本判断的边界。** 固定 db701c1f 的 0.23.0 是 Worker 回退分支的版本匹配值；配置补丁另按环境值控制 V2 Runner，未设置时返回 False。这些分支不能证明其他版本完整支持 V2，实际选路与设备行为还须按安装版本验证。[来源 19](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/worker/worker.py#L159-L163)、[来源 20](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20)

- 来源 41：vllm-ascend@db701c1f，vllm_ascend/worker/model_runner_v1.py，L2914–L2940。
- 来源 51–56：`v0.30.0`（及历史候选快照）V1 的 12 项执行状态、两次调用和异步防护；CPU 语法处理也在来源 54。
- 来源 57–60：`v0.30.0`（及历史候选快照）Worker 与环境开关、V1 初始化和接受数判断；PCP 的启动拒绝条件回到[输入准备版本表](prepare-inputs-flow.md#版本差异)。
- 来源 61：固定上游 MRV2 设计全文，支撑固定请求状态、本步 gather、pinned 快照、StagedWriteTensor 和捕获/回放边界；其中设备实现不能直接推广成 NPU 能力 [S61]。
- 来源 62：小正数温度的下限修正及 temperature=0 的贪心判定 [D]。
- 来源 63–67：`v0.30.0`（`c09d3e20`）Worker 默认实例化 MRV1（`worker.py#L498-L521`）、`patch_use_v2_model_runner.py#L18-L31`、`model_runner_v1.py` 的 `ExecuteModelState`（L353）、`execute_model`（L2227）与 `has_mamba_layers`（L4608）。
- 来源 68–71：`main`（`8d6180e2`）删除 `model_runner_v1.py` 后的 `worker.py#L589-L618`、`mrv2_utils.py#L29-L89`、`patch_use_v2_model_runner.py#L1-L7` 与 `worker/v2/model_runner.py#L144-L160`。
