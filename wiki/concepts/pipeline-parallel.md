---
id: pipeline-parallel
title: 流水线并行（PP）：层分段、状态交接与气泡
type: feature
summary: 把模型的层按顺序切成几段放到不同的卡上，一个请求依次流过各段；讲清为什么这样切、段间交接什么、气泡从哪来，以及 GLM 双机为什么没开 PP。
aliases: [Pipeline Parallel, 流水线并行, 管线并行, PP, PP stage, 流水线气泡, pipeline_parallel_size, VLLM_PP_LAYER_PARTITION, PPMissingLayer, IntermediateTensors, get_pp_indices, make_layers]
chapters: ["13"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2319
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2132-L2169
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L607-L650
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L912-L949
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L987-L1013
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L499
  - vllm@0fc695fc:vllm/config/model.py#L1188-L1207
verified: []
evidence: "C"
relations:
  - {to: layers-and-hidden, kind: builds-on, note: 先理解层间表示与 GLM 的四路连接}
  - {to: collective-communication, kind: builds-on, note: 理解点对点收发与组内收集}
  - {to: vllm-engine-core, kind: builds-on, note: 理解引擎批队列与结果更新}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## PP 是什么？

**Pipeline Parallelism（PP，流水线并行）把模型的层按先后顺序切成几段，每段放在不同的卡上；一个请求从第一段流到最后一段，像工件在流水线上一站一站往下传。**

先看一个小例子（示意）：一个 8 层的模型要放到 4 张卡上。PP 按层号从前往后切成 4 段，每段 2 层：

| 段 | 放在 | 负责哪几层 | 这一段另外还放 |
|---|---|---|---|
| 阶段 0 | 卡 0 | 第 0、1 层 | 入口的 embedding：把 token 编号查成一串数 |
| 阶段 1 | 卡 1 | 第 2、3 层 | — |
| 阶段 2 | 卡 2 | 第 4、5 层 | — |
| 阶段 3 | 卡 3 | 第 6、7 层 | 出口：最后的 norm（归一化层）、给词表打分、采样出下一个 token |

一个请求进来时：卡 0 先把 token 查成隐藏向量（hidden state：每个 token 在层与层之间传递的那一串数，详见 [层与隐藏表示](layers-and-hidden.md)），算完第 0、1 层，把得到的隐藏向量交给卡 1；卡 1 接着算第 2、3 层，再交给卡 2；卡 3 算完最后两层，打分并采样出下一个 token。

所以 PP 里每张卡只做两件事：**存自己那几层的权重，算自己那几层**；段与段之间只交接隐藏向量。这里的「段」在代码和文档里叫 stage（阶段），本页说「阶段 k」就是负责第 k 段的那组卡。一段不一定只有一张卡：段内还可以再把每一层切开、分给几张卡一起算（这叫 TP，下一节就讲），后文「交接在 vLLM 里怎么走？」一节会讲这种情况下怎么交接。

## 为什么需要 PP？

一个模型的权重一张卡放不下时，只能分到多张卡上。基本分法有两种，区别在「从哪里下刀」：

- **Tensor Parallel（TP，张量并行）在每一层内部下刀**：每层的权重矩阵切成 4 片，每张卡拿每一层的 1/4。算每一层时 4 张卡一起算、各算一部分，算完要把各卡的部分结果合起来——每层至少合两次（一层里先算 attention、再算 MLP，这两大块各算完合一次），详见 [TP 页](tensor-parallel.md)。
- **PP 在层与层之间下刀**：每张卡拿完整的几层。算的时候一次只有一段在算，算完把隐藏向量交给下一段。

```wiki-diagram
file: pipeline-parallel-split
```

同一个 8 层模型、同样 4 张卡，两种切法对一下账（示意）：

| | TP：4 张卡切每一层 | PP：4 段，每段 2 层 |
|---|---|---|
| 每张卡放多少权重 | 每层的 1/4 × 8 层 = 2 层的量 | 完整的 2 层 |
| 一个 token 算完一次前向，卡之间交接几次 | 8 层 × 至少 2 次 = 至少 16 次，每次 4 张卡一起合 | 3 次（0→1、1→2、2→3 三个分界），每次一张卡发、一张卡收 |
| 同一时刻有几张卡在为这个 token 干活 | 4 张 | 1 张 |

两种切法每张卡放的权重一样多，都是 1/4。不只是权重，生成过程中每层要攒下的历史——[KV Cache](kv-cache.md)（前面 token 的 key、value 存下来，后面的 token 要反复用）——也跟着层走：PP 里哪一段负责哪几层，就存哪几层的历史。所以每段的权重与状态，都由它负责的层决定。

差别在通信和等待：

- PP 交接次数少，每次只是一张卡发给下一张卡的点对点收发（[集合通信](collective-communication.md) 页讲了点对点收发和多卡一起合的区别），所以常被放在卡间连接较慢的位置，比如两台机器之间。
- 代价是同一个 token 在任一时刻只有一段在算，其余段在等——后面要画出来的「气泡」。TP 没有这种等待，但每层都要通信，更依赖卡之间的带宽。

两者并不互斥：一段里可以有好几张卡再用 TP 切开。哪种组合更好，要结合每张卡的容量、网络、各段负载和并发量去测，本页不给通用结论。

## 一个请求怎样流过 4 段？

还是那个 8 层、4 段的例子。为了看清数在哪张卡上变，把隐藏向量缩成 2 个数，把每一层的计算简化成「每个数加 1」（示意；真实的一层是 attention 加 MLP，见 [层与隐藏表示](layers-and-hidden.md)）。点「下一步」，看这 2 个数怎样从卡 0 走到卡 3：

```wiki-diagram
file: pipeline-parallel-flow
```

逐步对一下数：

1. 卡 0：token 查 embedding 得到 `[1, 0]`；过第 0 层每个数加 1 得 `[2, 1]`，过第 1 层得 `[3, 2]`。
2. 卡 0 把这 2 个数发给卡 1。发的只是隐藏向量：第 0、1 层的权重、卡 0 攒下的 KV Cache 都留在卡 0，不跟着走。
3. 卡 1 过第 2、3 层：`[3, 2]` → `[4, 3]` → `[5, 4]`，发给卡 2。
4. 卡 2 过第 4、5 层得 `[7, 6]`，发给卡 3。
5. 卡 3 过第 6、7 层得 `[9, 8]`，再经出口的 norm 和词表打分，采样出下一个 token。

从起点 `[1, 0]` 到终点 `[9, 8]`，每个数正好加了 8，对应 8 层——和不切、在一张卡上连算 8 层的结果一样。**PP 不改变算什么，只改变在哪张卡上算。** 同时也看得出：卡 1 在第 3 步之前拿不到输入，只能等；任何时刻都只有一张卡在为这个 token 干活。

### 层数除不尽时怎么分？

例子里 8 ÷ 4 正好每段 2 层。除不尽时，vLLM 默认先平均分，余下的层从倒数第二段起往前每段加一层；最后一段不加，因为它还要放出口的 norm 和词表。拿 45 层演算（后文的 GLM 正好是 45 层）：

- 分 2 段：45 ÷ 2 = 22 余 1 → 余下的 1 层加给倒数第二段，也就是阶段 0 → 两段各 `[23, 22]` 层。每段从第几层开始 = 前面各段层数之和，所以阶段 0 负责 `[0, 23)`（第 0–22 层），阶段 1 负责 `[23, 45)`（第 23–44 层）。
- 分 4 段：45 ÷ 4 = 11 余 1 → 余下的 1 层加给倒数第二段，也就是阶段 2 → `[11, 11, 12, 11]`；阶段 2 从 11 + 11 = 22 开始，到 22 + 12 = 34 为止，负责 `[22, 34)`。

想自己指定每段几层，可以用环境变量 `VLLM_PP_LAYER_PARTITION` 写一串逗号分隔的层数（比如 `12,11,11,11`）；个数必须等于段数、总和必须等于总层数，否则启动时报错（见「对照源码」）。

每张卡上的模型对象仍然保留全部层的位置，只是不归本段的位置放一个什么都不做的占位（placeholder）；真正建出权重的只有本段那几层。首段另外建 embedding，末段另外建最后的 norm 和词表输出层。

层数分得匀不等于活分得匀：首段多做 embedding，末段多做 norm 和采样；遇到各层类型不同、专家负载不同的模型，层数相同的两段，计算量和显存也可能差不少（GLM 的情况见后文）。

## 多个请求错开进入时，各卡忙闲怎样？

生成是一个 token 一个 token 往外吐的（自回归）：请求 A 要生成第 2 个 token，输入就是第 1 个 token 的采样结果（这里不考虑一次先猜几个候选 token 的 [投机解码](speculative-decoding.md)）。所以 A 的第 2 轮必须等第 1 轮走完卡 3、采样出 token，才能回到卡 0 开始。

把时间切成等长的格子，假设每段算一轮正好一格（示意：各段一样快，忽略交接和采样的耗时），画出每张卡每一格在干什么：

```wiki-diagram
file: pipeline-parallel-bubble
```

**上半：只有请求 A。** A1 在卡 0 算第 0 格，在卡 1 算第 1 格……第 4 格 A1 走完卡 3、采样出 token，A2 才能回到卡 0。数一下：8 格 × 4 张卡 = 32 个「卡·格」，真正在算的只有 8 个（A1、A2 在每段各 1 格），利用率 8 ÷ 32 = 25%，正好是 1 ÷ 段数。空着的 24 格（图里的灰格）就是流水线的**气泡**（bubble）：卡在那里，却在等上一段的数。

**下半：4 个互不相关的批次 A、B、C、D 错开一格进入。** 卡 0 算完 A1 马上去算 B1，同时卡 1 接手 A1；到第 3 格，4 张卡都在忙。再数一次：前 3 格是在「灌满流水线」，卡 1 空 1 格、卡 2 空 2 格、卡 3 空 3 格，一共空 0 + 1 + 2 + 3 = 6 格；8 格里忙了 32 − 6 = 26 格，利用率 26 ÷ 32 ≈ 81%，第 3 格以后是 100%。A2 能在第 4 格开始，正是因为 A1 在第 4 格之前刚好走完卡 3。

规律是：**同时在路上的批次数至少要等于段数，流水线才可能填满。** 2 段时 2 批交错就够——阶段 1 算 A 时，阶段 0 算 B；4 段就要 4 批。vLLM 也是按这个设的：开了 PP 后，引擎的批队列允许同时在路上的批次数等于段数（开了[异步调度](async-scheduling.md)——卡还在算这一步时，调度器就先把下一步排好——且用新版 model runner（每张卡上负责执行模型的组件）时再多 1；引擎怎样排队见 [引擎核心](vllm-engine-core.md)），一批还在后面几段上算时，调度器就可以把下一批送进第一段。

这张图是理想情形。真实部署里各段快慢不一、每批大小不同、还要同步，不能保证从第几格起就一直满载；具体怎么拆批、怎么重叠，也受调度方式和更进阶的 PP 实现影响（比如昇腾的动态切块：把很长的输入切成几块、分几步送进流水线，每块多大动态决定，只能在 PP > 1 时开；「把长输入切块分步算」的基本做法见 [Chunked Prefill](chunked-prefill.md)，开关见 [动态切块配置](../params/profiling-chunk-config.md)），所以也不能一概说「PP 不会拆分输入」。

## PP 要付什么代价？

PP 换来的是「放得下」和「很多请求一起跑时的吞吐」，要付四笔账：

**1. 气泡。** 上一节数过：只有一个请求时，利用率只有 1 ÷ 段数（4 段就是 25%）；并发批次够多时，也还有开头灌满的空格。请求稀少的时候，开了 PP 的卡大部分时间在等。

**2. 单个请求不会变快。** 一个 token 仍然要依次过完 8 层，一层都没少，还多了 3 次交接。每一段都要等上一段的输入：交接可以和别的批次的计算重叠，但取消不了这种先后依赖。

**3. 段间通信：量小，但每个分界每轮都有一次。** 每个分界交接的是这一批 token 的隐藏向量：

`交接的字节数 = token 数 T × 隐藏向量宽度 H × 每个数的字节数`

接着用示意数：H = 2，每个数按 BF16 存占 2 字节。一批 3 个 token：3 × 2 × 2 = 12 字节；4 段有 3 个分界，一次前向一共交接 3 × 12 = 36 字节。注意这个量和每段有几层无关——段里是 2 层还是 20 层，出口处都只剩一个隐藏向量要交。TP 每层合的也是 T × H 这么大的张量，只是每层都要合（「为什么需要 PP？」那张表里算过：至少 16 次）。GLM 规模下每个 token 是多少，见后文 GLM 一节。

**4. 各段要切得匀。** 流水线的节奏由最慢的一段决定。示意：4 段里阶段 2 算一轮要 2 格，其余段 1 格；满载时每 2 格才能从阶段 2 出来一批，其他段每 2 格只忙 1 格。一个周期（2 格）里 4 张卡共 8 个卡·格，忙的是 1 + 1 + 2 + 1 = 5 个，利用率 5 ÷ 8 = 62.5%。所以分段要按真实的计算量来匀，而不是只数层数；每段的显存同理，要看它那几层各放了什么，不能拿「总量 ÷ 段数」去估。

## 推理和训练用 PP 有什么不同？

PP 最早大量用在训练上，读资料时常看到训练的流水线图，和推理不一样：

| | 训练 | 推理（本知识库讲的） |
|---|---|---|
| 每批走的方向 | 先前向（阶段 0 → 3），再反向（阶段 3 → 0）算梯度 | 只有前向，没有反向 |
| 每段要留下的东西 | 前向的中间结果要一直留到反向用完 | 不用为反向留中间结果；要留的是各层的 KV Cache |
| 气泡从哪来 | 一大批拆成若干小批，全部走完前向和反向、统一更新一次权重；同步的做法在每次更新前都要把流水线排空 | 同一请求的下一个 token 要等上一个 token 走完所有段；不同请求互不依赖，请求源源不断时可以一直错开往里送 |

所以推理的流水线不会因为更新权重被周期性排空；要填满它，靠的是同时在路上的请求足够多（前面「多个请求错开进入」一节：批次数 ≥ 段数）。

## 交接在 vLLM 里怎么走？

前面把交接画成一支箭头。落到 vLLM 和 Ascend 的代码里，一次交接是这样走的：

- **异步收、异步发。** 每一步开始前，除第一段外，每段先异步接收上一段发来的中间结果；本段算完后，除最后一段外，把 model runner（每张卡上执行模型的组件）返回的中间结果异步发给下一段；下一步开始前，先等上一步的发送完成。异步让收发可以和别的计算重叠，但本段仍然要拿到输入才能开算，依赖不会消失。
- **发的是一个「张量字典」。** 先发一份元数据：每个键叫什么、张量的形状和数据类型；不是张量的值（比如空值 None）也直接放在元数据里。然后对字典里的每个张量逐个收发。
- **段内还有 TP 时，只发一片再拼回。** 同一段的几张 TP 卡上，隐藏向量各有一份完整的、内容相同。如果张量的元素个数能被 TP 卡数整除，vLLM 让每张卡只发自己那一片，下一段对应的卡收到后，在本段的 TP 组里做一次 All-Gather（组内每张卡把自己那一片发给其余卡，最后人人拿到完整的一份，见 [集合通信](collective-communication.md)）。示意：沿用 `[3, 2]`，每段 TP = 2：上一段的卡 a 把 `[3]` 发给下一段的卡 a′，卡 b 把 `[2]` 发给卡 b′；a′ 和 b′ 各拿到一半，All-Gather 后都得到 `[3, 2]`。跨段的线路上一共走了 2 个数，而不是 2 张卡 × 2 个数 = 4 个。开启 Ascend 的 flashcomm1 这类[序列并行](sequence-parallel.md)优化时——序列并行是把一批 token 按先后切开，TP 组里每张卡只拿其中一部分 token 的隐藏向量——卡上本来就不是完整的一份，而且它自己也要做 All-Gather；为了不冲突，这一步拼接会被关掉。

所以图上的一条交接箭头只表示「下一段依赖这份数据」，不代表一次物理发送、一个网络包，也不代表固定的字节数。

## GLM 双机为什么没用 PP？

先说结论：GLM 双机的官方方案（2 台 × 8 张 A2，TP8 / DP2 / EP16，W8A8，见 [部署前提](glm-5-3-flash-two-node.md#部署前提)）**没有开 PP**，走的是 TP 和 DP，专家层另用 EP。这里 [DP](data-parallel.md)（数据并行）是把整份模型复制几份、各自接请求；[EP](expert-parallel.md)（专家并行）是把 MoE 层的各个专家分到不同的卡上；W8A8 是权重和激活都用 8 位整数存算。下面的 GLM 分段是一个**变体**：只说明「如果给 GLM 开 PP，按源码会怎样分、分界上交什么」，没有经过部署验证；主线的任何性能数字也都不能当成 PP 的效果。

### 变体：GLM 的 45 层分成 2 段

```wiki-diagram
file: pipeline-parallel
```

按前面的分层公式，45 层分 2 段得到 `[0, 23)` 与 `[23, 45)`，即第 0–22 层和第 23–44 层。固定的 GLM 模型代码已经按段建层：首段建 embedding，末段建最后的 norm 和词表输出层，不归本段的层位置放占位；GLM 的模型类也声明了支持 PP，能通过 vLLM 启动时「模型是否支持 PP」的检查。每段的权重与状态由它负责的层决定。

但 23 层和 22 层不意味着两段负载接近：GLM 的各层类型不同、专家负载不同，首尾段还有额外的计算。同理，GLM 两类 attention 和专家层消耗的资源并不均匀，不能用「总层数 ÷ 段数」去估每段的全部显存。

### GLM 的分界上交什么？

GLM 用了 mHC（把残差连接拆成多路的连接方式，见 [层与隐藏表示](layers-and-hidden.md)）：普通层的输出保留四路表示，每路宽 4096，到最后一层才把四路汇成一路。所以分界上交的隐藏向量，每个 token 是 4 × 4096 个数。

代码里交接的字典有 `hidden_states` 和 `residual` 两个键，但 GLM 这条路径上每层返回的 `residual` 是空值（None）——按前面讲的张量字典规则，它只随元数据走。不能因为有两个键，就以为要传两份等大的张量。

用「代价」一节的公式做一次容量推导（只是推导，不是实测）：假设分界处有 T 个 token，每个 token 四路、每路 H = 4096、按 BF16 存，也没有按 token 再切分，那么

`T × 4 × 4096 × 2 字节 = T × 32768 字节 = T × 32 KiB`

T = 1 时是 32 KiB，T = 4 时是 4 × 32 = 128 KiB。这个数要同时满足上面的表示、精度和布局三条假设；实际分界还受序列并行等实现影响，不能当作实测的链路流量。

### 主线为什么没开？

官方来源没有说明不选 PP 的理由（待核：缺官方对 PP 与 TP / DP 取舍的说明，也缺同一套硬件上开 PP 的对比测量）。从本页讲的机制能看出两点背景，但它们只是推理，不是官方结论：

- **主线不开 PP 也放得下。** 每台机器的 8 张卡用 TP8 切开每一层，专家再用 EP16 分到 16 张卡上（见 [每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），PP 最主要的好处「放得下」在这里不是瓶颈。
- **卡数算得过来。** vLLM 里一个模型副本占的卡数 = PP × TP（上下文并行为 1 时）。主线是 PP1 × TP8 = 8 张卡一份副本，两台机器正好两份（DP2）；若改成 PP2 × TP8，一份副本就占满 2 × 8 = 16 张卡，两份副本只剩一份，还要额外承担前面讲的气泡。这只是卡数算术，效果没有测过。

本页核对了固定 GLM 源码里的分段接口（见「对照源码」），没有验证 GLM 开 PP 的完整部署组合；GLM 双机的启动案例以 [官方双机来源](../sources/glm-5-3-flash-baseline.md) 为准。

## 常见误解

- **「PP 把一个请求拆开并行算，单个请求会更快。」** 不会。一个 token 仍然依次过完每一层，一次只有一段在为它算，还多了段间交接。PP 解决的是放得下和多请求时的吞吐。
- **「分界上传的是权重，或者整份 KV Cache。」** 都不是。权重和各层的 KV Cache 留在各自的段里，分界只交接这一批 token 的隐藏向量，量按 T × H × 字节数估。
- **「交接字典里有 `hidden_states` 和 `residual` 两个键，所以要传两份一样大的张量。」** 不一定。GLM 的 mHC 路径上 `residual` 是空值，只随元数据走。
- **「层数分得匀，负载就匀。」** 不是。45 层分成 23 + 22，首尾段还有 embedding、norm 和采样；GLM 各层类型和专家负载也不同，每段显存也不能用总层数 ÷ 段数估。
- **「错开几批之后，流水线就一直满载。」** 那只是各段等时、不计传输的理想图。4 段至少要 4 批在路上才可能填满；真实部署还受负载不均、批次形状和同步影响。
- **「PP 从不拆分输入。」** 具体怎么拆批、怎么重叠，取决于调度方式和更进阶的 PP 实现，不能一概而论。
- **「图上一条交接箭头就是一次网络发送。」** 箭头只表示数据依赖；实际是先发元数据、再逐个张量收发，段内有 TP 时还是每卡发一片、收完再 All-Gather。
- **「GLM 双机用 PP 把模型分到了两台机器上。」** 没有。主线是 TP8 / DP2 / EP16；本页的 GLM 两段分法只是变体。

## 对照源码

### 怎么开

- 启动参数 `--pipeline-parallel-size`（简写 `-pp`），对应配置 `pipeline_parallel_size`，默认 1，即不开。一个副本占的卡数 = PP × TP × prefill 上下文并行数。
- 分段默认由 vLLM 按「先平均、余数从倒数第二段往前加」自动算；要手动指定，设环境变量 `VLLM_PP_LAYER_PARTITION`，如 `12,11,11,11`。
- 开 PP 后，引擎的批队列默认允许「段数」个批次同时在路上；开了异步调度且用新版 model runner 时是段数 + 1。

### 会报什么错

| 情形 | 报错 |
|---|---|
| 模型没实现 PP 接口却设了 PP > 1 | `NotImplementedError`：`Pipeline parallelism is not supported for this model.`（GLM 模型类声明了支持，不会触发） |
| `VLLM_PP_LAYER_PARTITION` 的个数 ≠ 段数、总和 ≠ 总层数，或写了非数字 | `ValueError`：`... does not match pp_size` / `... does not match num_hidden_layers` / `Invalid partition string` |
| elastic EP（弹性专家并行）与 PP 同开 | `ValueError`：`Elastic EP is not supported with pipeline parallelism` |
| Ascend 的 Xlite 图模式与 PP 同开 | `RuntimeError`，要求把 `pipeline_parallel_size` 设回 1（三个版本都有） |
| 稀疏 KV offload 与 PP 同开 | `ValueError`：`Sparse KV offload don't support pipeline parallel now.`（v0.26 起，见 [稀疏 KV offload](kv-cache-sparse-offload.md)） |
| 开了动态切块（`profiling_chunk_config`）却没开 PP | `ValueError`：`profiling_chunk_config requires pipeline parallelism (pp > 1).`（三个版本都有） |

### 开销和什么时候别开

- **并发低、看重单请求延迟时别开。** 单请求利用率只有 1 ÷ 段数；同时在路上的批次少于段数时流水线填不满；单请求延迟不降反增（多了段间交接）。
- **通信：** 每个分界每轮一次，量 = T × H × 字节数（GLM 推导为每 token 32 KiB），和段内层数无关；次数少、点对点，适合放在较慢的链路上。
- **负载：** 最慢的一段决定节奏；层类型不均的模型需要按实际计算量调整分段，必要时用 `VLLM_PP_LAYER_PARTITION` 手动指定。
- **模型已经放得下时**（比如 GLM 双机主线 TP8 / DP2 / EP16），PP 最主要的好处用不上。
- 不能与 Xlite 图模式、稀疏 KV offload（v0.26 起）、elastic EP 同开。

### 版本差异

| 要核对什么 | v0.23.0 | v0.26.0rc | main |
|---|---|---|---|
| Ascend Worker 段间收发：先等上次发送、非首段异步收、非末段异步发、TP 切片后 All-Gather、开序列并行时关掉拼接 | 有 | 与 v0.23 相同 | 与 v0.23 相同 |
| Xlite 图模式与 PP 互斥 | 有 | 有 | 有（报错文案改写） |
| 稀疏 KV offload 与 PP 互斥 | 无此特性 | 新增 | 保留 |
| 动态切块要求 PP > 1 | 有，配置挂在 Ascend 配置下 | 有，配置挪到调度配置下 | 同 v0.26 |
| 上游批队列大小 = 段数（异步调度 + 新版 runner 时 +1） | 配套 vLLM 有 | 配套 vLLM 相同 | 待核：main 未单独钉配套 vLLM |
| GLM 模型文件 | 三个钉住版本里都没有；本页 GLM 分段接口取自 GLM 基线提交 `vllm-ascend@db701c1f` | 同左 | 同左 |

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| PP 参数、副本卡数 = PP × TP × PCP | `vllm@0fc695fc:vllm/config/parallel.py#L112`；`#L775-L779`；`vllm@0fc695fc:vllm/engine/arg_utils.py#L951-L952` |
| 模型必须支持 PP 的检查 | `vllm@0fc695fc:vllm/config/model.py#L1200-L1207` |
| elastic EP 与 PP 互斥 | `vllm@0fc695fc:vllm/config/parallel.py#L787-L793` |
| 分段公式、余数分配、手动分段与报错 | `vllm@0fc695fc:vllm/distributed/utils.py#L109-L154` |
| 按段建层、非本段放占位 | `vllm@0fc695fc:vllm/model_executor/models/utils.py#L649-L663` |
| 批队列大小 = 段数 | `vllm@0fc695fc:vllm/config/vllm.py#L497-L507`；`vllm@0fc695fc:vllm/v1/engine/core.py#L192-L198`；`#L484-L500`；v0.26 配套 `vllm@568afb3a:vllm/config/vllm.py#L512-L522` |
| 张量字典：先发元数据、再逐个张量；能整除 TP 卡数时只发一片 | `vllm@0fc695fc:vllm/distributed/parallel_state.py#L81-L104`；`#L912-L924`；`#L990-L1019` |
| Ascend Worker 段间收发 | `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L620-L662`（v0.23.0）；`vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L662-L702`（v0.26.0rc）；`vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L755-L791`（main） |
| Xlite 图模式与 PP 互斥 | `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L691-L695`；`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L693-L697`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1250-L1253` |
| 稀疏 KV offload 与 PP 互斥 | `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1063-L1064`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1509-L1510` |
| 动态切块要求 PP > 1 | `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L69-L74`；`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L99-L106`；`vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L586-L590` |
| GLM：首段 embedding、按段建层、末段 norm | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2262-L2291` |
| GLM：非首段取交接字典、非末段返回 `hidden_states` / `residual` | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2301-L2319` |
| GLM：第 0 层展开四路、末层汇合、残差返回空值 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241` |
| GLM：模型类声明支持 PP、末段才建词表输出层 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437`；`#L2454-L2462` |
