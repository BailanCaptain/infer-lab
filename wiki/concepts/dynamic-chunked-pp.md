---
id: dynamic-chunked-pp
title: 动态分块流水线：按预计耗时切 prefill 块
type: feature
summary: 开了 PP 时，长提示词按「已经算了多少、这一块预计要多久」反推每块切多大，让各块耗时相近、后一段少空等；讲清等长块为什么越来越慢、23 格变 17 格的账、二次曲线反解、开机试跑与时间账，以及 GLM 双机 PP=1 开不了的边界。
aliases: [动态分块流水线并行, ProfilingChunkScheduler, ChunkSizePredictor, ProfilingChunkManager, profile_prefill_latency, 动态分块 PP, 等耗时切块]
chapters: ["13"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L212-L271
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L313-L349
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L55-L94
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L273-L320
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L249-L270
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L399-L408
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L178-L220
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L795-L855
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L704-L742
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L702-L715
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_profiling_chunk.py#L47-L126
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L108-L200
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L121-L199
  - vllm-ascend@db701c1f:vllm_ascend/core/profiling_chunk_predictor.py#L339-L420
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3583-L3601
  - vllm@0fc695fc:vllm/config/parallel.py#L776-L780
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L65-L80
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L141-L146
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L78-L84
  - vllm-ascend@db701c1f:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L86-L115
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L725
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L954-L1012
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1256-L1280
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L995-L1026
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L9-L20
  - vllm-ascend@baa023ad:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L80-L131
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1924-L1936
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L17-L20
  - vllm-ascend@db701c1f:vllm_ascend/core/scheduler_profiling_chunk.py#L542-L564
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L18-L22
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L204
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L228-L235
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 理解因果注意力的历史访问范围}
  - {to: chunked-prefill, kind: builds-on, note: 理解 token 预算与前缀进度}
  - {to: pipeline-parallel, kind: builds-on, note: 理解分段执行和流水线空闲}
  - {to: profiling-chunk-config, kind: builds-on, note: 查阅字段及各版本定义}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 长提示词切块送进流水线，每块该切多大？

**动态分块流水线（Dynamic Chunked Pipeline Parallel，官方简称 CPP）是 vLLM-Ascend 给开了 PP 的部署准备的 prefill 切块办法：长提示词照样分几步算完，但每一步给它切多少个 token 不再是一个固定的数，而是按「前面已经算了多少、这一块预计要花多久」反推出来，让各块耗时尽量相等，流水线的后一段就不必一次次空等前一段。**

它建立在两件事上，各用一句话交代：[PP（流水线并行）](pipeline-parallel.md)把模型的层分成几段、每段放在不同的卡上，一批 token 先在第 0 段算完前半层，再把隐藏向量交给第 1 段算后半层；[chunked prefill](chunked-prefill.md)把一条很长的提示词切成几段、分几步算完，每段接着上一段存下的历史往下算。两件事凑到一起，切出来的几块就排着队进流水线：第 0 段算第 2 块的时候，第 1 段正好在算第 1 块——前提是两块花的时间差不多。

下面用一个示意例子感受一下：一条提示词有 400 个位置，走两段流水线，每一步最多给它 100 个位置。

```wiki-diagram
file: dynamic-chunked-pp
```

- **上半：固定切法。** 4 块各 100 个位置，可一块比一块慢，在一段上分别要 1、3、5、7 格。阶段 1 每算完一块，下一块还在阶段 0 里没出来，只能空等（灰格）。4 块走完用了 23 格。
- **下半：按预计耗时切。** 第 1 块仍是 100 个位置，之后越切越薄：41、32、27……最后一块 13 个，一共 16 块，每块都只要 1 格。阶段 0 一块接一块往下送，阶段 1 刚算完上一块，下一块正好到。17 格走完。
- **活一点没少。** 两种切法每段都要算满 16 格，快出来的 6 格全是阶段 1 原来空等的时间。

这个功能改的只是「这一步给这条提示词多少个位置」这一个数。模型有几层、按什么顺序算、段与段之间交接什么、每条请求前后位置的因果依赖，都和普通 PP 一样；decode 一步一个 token 的自回归依赖也照旧。

## 为什么需要它：一样多的 token，为什么越往后越慢？

[注意力](attention-qkv.md)让每个位置和它自己以及前面所有位置打分。第 1 块的位置只能看本块里排在前面的；第 4 块的每个位置除了本块，还要回头看前面 3 块的全部历史。块一样长，要看的东西却越来越多。

数一数合法的「查询–键」组合就清楚了。已经算了 L 个位置，这一步再算 x 个新位置：每个新位置都能看全部 L 个旧位置，新位置之间只能看自己和前面的，所以组合数是 x × L + x(x + 1) ÷ 2。前一项是新位置回头看旧历史，后一项是新块内部的三角形。

```calc
title: 长 8 的序列每次算 2 个位置（示意，普通因果注意力）
第 1 块（已算 0） = 2 × 0 + 2 × 3 ÷ 2 = 3 对
第 2 块（已算 2） = 2 × 2 + 3 = 7 对
第 3 块（已算 4） = 2 × 4 + 3 = 11 对
第 4 块（已算 6） = 2 × 6 + 3 = 15 对
合计 = 3 + 7 + 11 + 15 = 36 对
> 36 = 1 + 2 + … + 8：切不切总数都一样，变的是每块分到多少
```

块再长一些，块内三角形那一项占比变小，四块的比例就趋近 1 : 3 : 5 : 7。原因是第 k 块从 (k − 1)·s 开始算 s 个位置，组合数约为 s² × (k − 1) + s² ÷ 2 = s² × (2k − 1) ÷ 2，随 k 按 1、3、5、7 增长。上图固定切法的四块耗时，用的就是这个比例。

没有这个功能时，chunked prefill 每一步按 token 预算切，块与块一样长（最后一块可能短些），耗时却一块比一块长。在一张卡上，这只是「后面几步慢一些」；放进流水线，后一段每算完一块就得等前一段把下一块送来，每次等的正好是相邻两块的耗时之差（例子里 3 − 1、5 − 3、7 − 5，每次 2 格）。这些等待加起来就是[流水线的气泡](pipeline-parallel.md#多个请求错开进入时各卡忙闲怎样)，块越多、耗时差越大，累计空等越多。

读这个例子时有两点别读过头：

- **组合数不等于耗时。** 一层里还有投影、MLP 和通信，这些只和本块多长有关，和历史多长无关；算子还要按自己的粒度分片执行、读写显存。所以 1 : 3 : 5 : 7 是「只剩注意力」时最极端的情况，真实模型会温和得多。
- **不是每种层都回头读全部历史。** [线性注意力](linear-attention.md)把历史压成一份固定大小的状态，算一块的时间只看这一块多长；[稀疏注意力](sparse-attention.md)只从历史里挑一部分候选来细读。混了这类层的模型，越往后越慢的程度更小，具体多少只能在目标机器上实测。

## 按耗时切，流水线能快多少？

先把开头那张图的账算清楚。设两段一样快，交接不花时间，1 格 = 第 1 块在一段上的耗时。一块要在阶段 1 上开始，得同时满足两件事：它已经在阶段 0 算完，阶段 1 也算完了上一块。所以阶段 1 上每块的开始时刻，取「这块离开阶段 0 的时刻」和「上一块离开阶段 1 的时刻」里晚的那个。

```calc
title: 固定切法四块的完成时刻（单位：格）
阶段 0 依次完成 = 1，1 + 3，4 + 5，9 + 7 = 1，4，9，16
阶段 1 第 1 块 = 1 + 1 = 2
阶段 1 第 2 块 = max(4, 2) + 3 = 7
阶段 1 第 3 块 = max(9, 7) + 5 = 14
阶段 1 第 4 块 = max(16, 14) + 7 = 23
> 阶段 1 在 0–1、2–4、7–9、14–16 格空等，共 7 格；阶段 0 在 16–23 格也闲着
```

换成 16 块、每块 1 格：阶段 0 在第 1、2、……、16 格末各送出一块；阶段 1 算完第 k 块正好是第 k + 1 格末，这时第 k + 1 块刚好从阶段 0 出来，一格不用等。第 16 块在第 17 格末走完，阶段 1 只在开头第 0–1 格等过第一块。

比一比：

- **同样的活，从 23 格缩到 17 格。** 每段都是 16 格的活，少掉的 6 格约占 26%。
- **这是理想上限。** 块从 4 个变成 16 个，每一步都有一笔和块大小无关的固定开销：调度器排一次、段间交接一次、卡上启动一遍算子。块越多，这笔账付的次数越多；两段实际快慢不一、块大小还要凑整，也会把一部分空等带回来。官方在别的模型上实测到的收益比这个理想值低，数字见[动态切块配置](../params/profiling-chunk-config.md#收益有多少)。
- **总计算量一格没少。** 按耗时切不是省计算，而是让两段的忙闲对上。

## 下一块切多大：从已经算了多少反推

要按耗时切，调度器得先知道「已经算了 L 个位置，再算 x 个要花多久」。昇腾的实现在开机时试跑出一条曲线，用二次函数描述从零算 n 个位置的耗时：

f(n) = a·n² + b·n + c

a 管随长度平方增长的那部分（注意力回头看历史），b 管按长度线性增长的部分（投影、MLP 等），c 是和长度无关的固定开销。已经算了 L 个、再算 x 个，耗时就是 f(L + x) − f(L)。

目标耗时 τ 定为第一块的耗时：从零算满一步预算要花多久，τ = f(base) − f(0)。这里的 base 就是每步最多排多少个 token 的那个上限（开头例子里是 100）。之后每一步都问一句：「已经算了 L 个，这一块要刚好花 τ，能装几个？」把 f(L + x) − f(L) = τ 展开，得到一个关于 x 的一元二次方程：

a·x² + (2aL + b)·x = τ

取它的正根就是这一块的理想大小。按开机曲线算，L = 0 时正根正好等于 base：第一块就是满预算。

用开头的例子算几步。只留平方项（b = c = 0，a 取 1），base = 100，τ = 100² = 10000。方程化成 x² + 2Lx = 10000，正根 x = √(L² + 10000) − L：

```calc
title: 只留平方项时逐块反推（示意，a = 1，τ = 10000）
第 1 块（已算 0） = √(0 + 10000) − 0 = 100
第 2 块（已算 100） = √(10000 + 10000) − 100 ≈ 141.4 − 100 ≈ 41
第 3 块（已算 141） = √(19881 + 10000) − 141 ≈ 172.9 − 141 ≈ 32
第 4 块（已算 173） = √(29929 + 10000) − 173 ≈ 199.8 − 173 ≈ 27
> 只有平方项时，第 n 块算完累计 100 × √n 个位置；400 个位置要 √n = 4，即 16 块
```

算出来的正根还要再过三道手，才成为这一步真正排给它的数：

1. **平滑。** 结果 = base + s × (x − base)，s 是 smooth_factor，取值在 0 到 1 之间（含 1），默认 1，即直接用正根。s 越小，结果越往 base 靠：s = 0.8 时，第 2 块是 100 + 0.8 × (41.4 − 100) ≈ 53。
2. **下限。** 不小于 min_chunk（默认 4096 个 token），免得块太碎、算子效率掉下去。
3. **向上凑整。** 凑成 max(块大小, 64) 的整数倍。块大小就是 [KV cache](kv-cache.md) 一个块装多少个位置。把粒度缩成 16 来示意（真实实现至少是 64）：41 凑成 48，27 凑成 32。

凑整是向上凑，所以实际块会比理想值大一点，耗时略超 τ，空等又回来一点；凑整粒度相对块越粗，拉得越不平。

最后，这个数还要和「原本这一步能给它多少」取小的那个。原本的数已经受剩余提示词、token 预算等限制（见 [chunked prefill 的那道减法](chunked-prefill.md#怎么切每一步都是同一道减法)）。所以它**只会把块切小，不会切大**，每步 token 上限仍是天花板。混合模型如果用 align 缓存模式，取小之后还要再把切点按状态块对齐一次（见 [chunked prefill 的切点细节](chunked-prefill.md#细节切点单条上限和关掉分块)），最终排下去的数和预测器给的数不一定相同。

base 该设多大，官方文档的说法是：首 token 延迟对它很敏感，太大会白算，太小算子效率会掉；序列越长 base 应越大，给后面的动态调整留余地，并给出 64k 输入配 20480、128k 输入配 32768。从上面的反推能看出原因：base 太小时，后面的正根很快跌到下限以下，被 min_chunk 顶住，就又退回等长切了。

## 细节：曲线从哪来，一步里几条请求怎样分时间

上一节的反推要用到 a、b、c 和 τ。这一节讲它们从哪来、什么时候开始生效，以及一步里同时有好几条请求时怎样分。整个机制有三样东西：**测量样本**说明「这台机器、这套配置下，算多大的块要多久」；**预测器**把「已经算了多少」和「还剩多少时间」换成块大小；**调度器**再决定这一步真正接纳哪些工作。

### 曲线是开机时真跑出来的

引擎准备好之后、开始接请求之前，调度器会让各卡真跑一轮试算：从 base 往下均匀取 64 种块大小（base、base 的 63/64、……、base 的 1/64），每种都让一条从零开始的请求真算一遍 prefill 并计时，最前面多跑的一次当热身丢掉。开了 PP 时所有段都要跑，否则彼此对不上。拿到的点用最小二乘拟合出 a、b、c，再算出 τ。

有两处要看清：

- **有效点少于 8 个就放弃。** 只打一条告警，功能不生效，之后一直按原来的等长切走，不报错。
- **试跑时各段各算各的。** 后段拿一份预先备好的空中间结果当输入，不等前段真的交接；调度器取回的是编号为 (PP − 1) × TP × 上下文并行数 的那张卡的计时，按常规排法正是最后一段的第一张卡。所以开机曲线量的是最后一段自己那几层的耗时，不含段间交接。

开了它，启动会明显变慢：官方文档说试跑大约多出 64 次前向，几十秒。这不是故障。

### 边跑边校准

服务起来以后，默认还会一边跑一边校准（开关 need_timing 默认跟着功能一起开）。校准期间每一步，卡上都会先同步一次再计时，把这一步真实花了多久报回调度器：

1. **先定目标耗时。** 校准期间每条请求的第一块故意不截，按原来的预算整块算。整批都是「从零开始」的步，量到的耗时直接拿来当 τ；这样的步攒满 3 次，τ 就定下来。
2. **再拟一条带历史的曲线。** 每一步都记成一个样本，按 T = a·x·(x + H) + b·(x + H) + c 的形状拟合：x 是这一步给某条请求的新位置数，H 是它已经算过的位置数；一步里每条请求（decode 也算）各出一项，加起来对应这一步的实测耗时。攒到 5 个点开始拟合，之后预测就改用这条曲线。
3. **攒满就停。** 样本到 max_fit_chunk（默认 30）个以后不再重拟；τ 和这条曲线都定下来后，卡上也不再每步同步计时，省掉这笔开销。

校准不是可有可无的步骤。官方建议上线前先用真实数据把校准跑一遍；main 的用户指南还专门提醒：校准默认开着，就一定要按标准流程走完，否则性能会严重变差。也可以一开始就关掉 need_timing，只用开机曲线、省掉校准期的同步，但官方的说法是这样结果不一定最优。怎样跑校准见[动态切块配置](../params/profiling-chunk-config.md#在线校准是默认开的而且不做会更慢)。

### 一步里有好几条请求：时间账

token 预算管「这一步最多排多少个位置」，这个功能又加了一本时间账：每一步开头，时间预算等于 τ（曲线还没好时是无穷大）。排队的两个循环——先续在跑的请求、再接新请求——除了要求 token 预算没用完，还要求时间预算大于 0。

- **预测时用的是剩下的时间。** 每给一条还在 prefill 的请求切块，传给预测器的目标是「还剩多少时间预算」，不是 τ。所以同一步里越靠后的请求，分到的块越薄。
- **排进来就扣账。** 每排进一条还在 prefill 的请求，就按曲线扣掉它这一块的预计耗时。
- **decode 不扣。** 已经在生成回答的请求每步只算极少几个位置，扣它们的时间只会把 prefill 挤掉，所以不记账。

示意：τ = 10000，a = 1，其余为 0，先只看预测器给的理想值。这一步先排到请求 A，它已算 300 个位置：x = √(300² + 10000) − 300 ≈ 16，扣掉 316² − 300² = 9856，只剩 144。再排到请求 B，它已算 100 个位置：x = √(100² + 144) − 100 ≈ 0.7。这么小的块在真实实现里会被下限和凑整抬高，按抬高后的块扣账，预算就成了负数，这一步不再接新的 prefill。

曲线还没好时，整段截块逻辑直接跳过，请求按原来的数走。曲线好了，预测器也会给不出数：拟合出的 a 为 0、方程无解或根不是正数。这时分三种情况：

- **还在校准期：** 打一条「在线校准阶段」的日志，这条请求按原来的数走。
- **这一步的时间预算还没动过：** 打一次「Profiling Failed. Degenerated to a fixed chunk size」告警，按原来的数走，也就是退回等长切。
- **时间预算已经扣过一部分：** 这一步到此为止，不再往里排。

所以「预测失败就照常切」只说对了一半：预算已经用过时，它是停下来，不是继续往里塞。

### 换掉的是整个调度器

打开这个功能，vLLM 的[调度器](vllm-scheduler.md)会被整个换成昇腾的一份副本（ProfilingChunkScheduler）。它继承上游的调度器，把排一步的那一大段整段照抄过来，只在上面这些地方插了改动：时间预算的初值、两个循环的条件、两处截块和两处扣账。代价是上游一改这段代码，这份副本就得跟着手改；文件头写着它对应 vLLM v0.15 的调度器，上游重构后要跟着更新。

开它有几个前提：必须开 PP 且段数大于 1，否则启动报错；必须开 chunked prefill（官方文档列为硬要求）；不能和负载均衡调度（balance scheduling）同开。和其他调度器变体一起开时会怎样，见「对照源码」的报错表。

## 放到 GLM 双机：本部署没开，开了会怎样？

**先说结论：官方 GLM 双机方案（2 台 × 8 张 A2，TP8 / DP2 / EP16，W8A8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)）的 PP 是 1，这个功能在这套部署上开不了——配置里打开它，启动时就会因为「需要 PP 大于 1」直接报错。** 下面分两部分：主线实际怎样切块，以及一个没有经过部署验证的变体推导。本页没有 GLM 的试跑曲线，也不把主线的任何性能数字当成这个功能的效果。

### 主线：按 token 预算等长切

主线每步的 token 预算是 8192。12 条请求在 decode、每条每步占 4 个位置（1 个真 token 加 3 个草稿，见[投机解码](speculative-decoding.md)）时，一条 20,000 个 token 的提示词分三步算完：8144、8144、3712，推导见 [chunked prefill 的 GLM 一节](chunked-prefill.md#放到-glm-双机20000-个-token-的提示词分三步)。

前两块一样长，第 2 块却要多读第 1 块留下的历史，这就是本页说的「等长不等时」。只是 PP = 1 时一步里整个模型在同一组卡上算完，不存在后一段等前一段，所以它只让第 2 步比第 1 步慢一些，不产生流水线气泡；慢多少没有实测数。

### 变体：GLM 开 PP = 2 时，这个功能会怎样

假设把 GLM 的 45 层按源码的分法分成两段（第 0–22 层和第 23–44 层，见 [PP 的 GLM 变体](pipeline-parallel.md#变体glm-的-45-层分成-2-段)），段内仍是 TP8。这套组合没有部署验证过，下面只是按机制和源码推导：

1. **越往后越慢的程度会小得多。** GLM 的 45 层里，34 层是 KDA 线性注意力，历史压在固定大小的状态里，算一块只看这一块多长（见[线性注意力的 GLM 一节](linear-attention.md#放到-glm-双机34-层-kda-的状态有多大)）。另外 11 层是稀疏 MLA：索引器要给全部历史打分，但先把每 4 个位置压成一组再打；真正的注意力只读挑出来的 2048 个位置，外加最多 3 个还没凑满一组的尾巴（见[稀疏注意力的 GLM 一节](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)）。所以历史超过 2048 个位置以后，随历史增长的主要只剩索引器打分这一小部分，拟合出来的 a 相对 b 会很小，离 1 : 3 : 5 : 7 很远，能拉平的空等也就少。具体收益要等 GLM 的试跑曲线。
2. **能调的范围很窄。** base 就是每步预算 8192；min_chunk 默认 4096。凑整粒度按块大小算：主线的逻辑块是 640 个位置，它由每张卡每层的 KDA 状态和 MLA 页决定，PP 只改一张卡负责哪几层、不改每层在卡上的形状，所以按推理 PP = 2、TP = 8 时仍是 640。4096 向上凑成 640 的倍数是 4480（4096 ÷ 640 = 6.4，凑成 7 块）。再算上 12 条 decode 先占掉 48 个位置、原本只能给这条提示词 8144，动态块就只能在 4480 到 8144 之间取值（提示词的最后一块剩多少算多少，可以比 4480 小）。这个区间是沿用主线 base = 8192 算出来的。main 的用户指南建议先按固定块调出最好的预算，开动态分块时再把 base 设成它的 2 到 4 倍，并给 128k 输入推荐 32768；base 调大，区间就放宽，但同一步里跟着跑的 decode 也要等得更久。
3. **decode 不挤时间账。** 投机解码下每条 decode 每步 4 个位置，占 token 预算，但不扣时间预算。
4. **不用再额外对齐。** 主线的混合模型缓存模式是 none，切点不必对齐到 KDA 状态的边界；这一条和 PP 无关，变体里照旧。
5. **前提要一起满足。** chunked prefill 在主线本来就开着；负载均衡调度不能同开；v0.26 起官方只把这个功能定位在 [PD 分离](pd-disaggregation.md)的 prefill 节点上，而主线是 prefill、decode 混跑。

变体还要付 PP 本身的账：一份模型副本从 8 张卡变成 16 张，两台机器只剩一份副本（卡数算术见 [PP 页「主线为什么没开」](pipeline-parallel.md#主线为什么没开)）。

## 常见误解

- **「它是个调优开关，打开试试就行。」** 不是。它要求 PP 大于 1，打开就把整个调度器换成一份副本，还要先跑完开机那一轮试算才开始服务；启动明显变慢不是故障。
- **「切得更细，每步更快，所以总时间一定更短。」** 总计算量不变，快的只是后一段不用空等；块数变多，每步的固定开销也多付几次。开头的例子里 23 格变 17 格是理想上限。
- **「动态块会比固定块切得更大。」** 不会。它只把原来的数往小里截，每步 token 上限还是天花板；第一块最多就是满预算。
- **「一开机预测就生效。」** 开机试跑的有效点不够 8 个就一直按等长切，而且只告警不报错；在线校准期间，每条请求的第一块也不截。
- **「预测失败时就照常切，不影响别的请求。」** 只有这一步时间预算还没动过时才照常切；预算已经扣过一部分时，这一步到此为止，后面的请求等下一步。
- **「1 : 3 : 5 : 7 就是真实的耗时比。」** 那是只算注意力时的极端情况。投影、MLP 和通信不随历史增长；GLM 这样以 KDA 和稀疏 MLA 为主的模型，差距要小得多。
- **「GLM 双机用了动态分块。」** 没有。主线 PP = 1，这个功能开不了；8144、8144、3712 是普通 chunked prefill 按 token 预算切出来的。

## 对照源码

钉点：vLLM v0.23.0 = `0fc695fc`；vllm-ascend 的 v0.23 维护分支 `2c59ff10`（没有 GLM 代码）、GLM 专用的 `db701c1f`（孤立提交，用 `git show db701c1f:<path>` 读）、v0.26 = `2ed6cbba`、main = `baa023ad`。本功能在四个提交上都有；下面行号按 `db701c1f`，只在版本差异里提其他分支。

### 怎么开

- **开关**：`additional_config` 里的 `profiling_chunk_config`，`enabled` 设为 true。字段与默认值：`smooth_factor` 1.0（须在 (0, 1]）、`min_chunk` 4096（须为正）、`need_timing` 默认跟 `enabled` 相同、`max_fit_chunk` 30（须大于 5）[C9]。各字段怎么调见[动态切块配置](../params/profiling-chunk-config.md)；v0.26 起配置写在哪变了，见版本差异。
- **必须同时给**：`--pipeline-parallel-size` 大于 1，`--enable-chunked-prefill`（文档列为必需）[S18]。
- **换调度器**：`platform.py` 在 `enabled` 为真时把 `scheduler_cls` 设成 `vllm_ascend.core.scheduler_profiling_chunk.ProfilingChunkScheduler`，并 import `patch_profiling_chunk`，由它包住 `EngineCore.__init__`、在引擎就绪后调 `run_profiling_chunk_init` [C10]。
- **两个输入**：`base_chunk_size` 取调度器的 `max_num_scheduled_tokens`（即 `--max-num-batched-tokens`），`page_size` 取 `cache_config.block_size`；`min_chunk` 大于每步预算时，启动告警并把它截成预算 [C3]。
- **官方教程**：DeepSeek-V3.1-W8A8，1 台 Atlas 800T A3（16 卡），PP2 × TP8，`--max-num-batched-tokens 32768`，`smooth_factor` 1.0、`min_chunk` 4096 [S20]。

### 会报什么错

| 情形 | 结果 | 在哪 |
|---|---|---|
| PP = 1 | 启动 `ValueError`：profiling_chunk_config requires pipeline parallelism (pp > 1) | `ascend_config.py` [C3] |
| 与 `enable_balance_scheduling` 同开 | 启动 `ValueError`，四个提交一致 | 同上 |
| `smooth_factor`、`min_chunk`、`max_fit_chunk` 越界 | `ValueError` | `ProfilingChunkConfig._validate` |
| 没开 chunked prefill | 文档列为硬约束，代码里没有对应的检查 [!] | 用户指南 Constraints |
| 与 SLO 动态批（`SLO_limits_for_dynamic_batch`）同开 | 不报错：动态批先设 `scheduler_cls`，本功能后设，动态批被静默盖掉 | `platform.py` [C10] |
| 开机试跑有效点少于 8 | 告警「Profiling failed: only N/8 samples collected」，功能一直不生效，按等长切 | `run_profiling_chunk_init` [C12] |
| 运行中预测为空 | 校准期打 info「Online calibration stage」；本步预算未动时 `warning_once`「Profiling Failed. Degenerated to a fixed chunk size」；否则本步 `break` | RUNNING、WAITING 两侧各一处 [C2] |

v0.26 与 main 上还有几条和其他调度器变体的关系（批作业感知调度、ShortRequestFirst、DyntraLB），见版本差异。

### 开销和什么时候别开

- **启动**：1 次热身加 64 次试跑，每次一条请求、强制执行注意力、走 eager；文档称约 64 次前向、几十秒 [S18]。
- **校准期每步两次设备同步**：卡上在执行前后各同步一次计时 [C27]。关掉 `need_timing` 就没有这笔开销，但只剩开机曲线。校准完成后，调度器进程改不到 worker 进程里的配置单例，所以在 `SchedulerOutput` 上挂 `disable_profiling_timing`，由 worker 自己关掉。
- **步数变多**：理想例子里 4 块变 16 块，调度、段间交接、算子启动的固定开销多付 12 次 [D]；官方实测收益见配置页。
- **凑整粒度粗时拉不平**：粒度是 `max(page_size, 64)`，向上凑 [C1]；设计文档把这一步写成向下取整，以代码为准 [!]。
- **维护**：`schedule()` 是整段副本，文件头写着对应 vLLM v0.15.x、上游重构后要跟着改。
- **试跑计时口径**：`_build_rpc_kwargs` 把 `unique_reply_rank` 设为 `world_size − tp × pcp` [C7]，而 `world_size = pp × tp × pcp` [C16]，取回的是最后一段第一张卡的计时；试跑时非首段用预先分配的空中间张量 [C15]，这份计时只含本段。worker 里的注释却说「只用首段的计时」，两处说法不一致 [!]。
- **别开的场景**：PP = 1（开不了）；输入短、一步就算完；不是跑长提示词 prefill 的节点；要用负载均衡调度的部署；main 教程还建议 PP 的 P 节点不开异步调度 [S26]，本功能也没有异步版本的调度器类。

### 版本差异

| 项 | v0.23（`2c59ff10`、`db701c1f`） | v0.26 | main |
|---|---|---|---|
| 配置写在哪 | 只认顶层 `additional_config.profiling_chunk_config`；写进 `scheduler_config` 下会被忽略 | 推荐写进 `additional_config.scheduler_config`；顶层仍认，但打弃用告警，两处都写以嵌套的为准 [C24] | 同 v0.26 |
| 官方定位 | 「recommended for PD disaggregation」[S30] | 改成「designed to be used on the Prefiller (P) node」，D 节点不用配 [S25] | 同 v0.26；教程另建议 P 节点关异步调度 |
| 用户指南对校准和 base 的提醒 | 只说上线前用真实数据校准 | 同 v0.23 | 加上「校准默认开，须按标准流程走完，否则严重劣化；关 `need_timing` 结果不一定最优」[S32]，以及「先调固定块，开动态分块时 base 取其 2 到 4 倍」[S31] |
| 批作业感知调度 | 无此功能 | 同开不报错，批作业那段在后，把本功能静默盖掉 [C21] | 同 v0.26 [C23] |
| ShortRequestFirst | 无此功能 | 同开 `ValueError` | 放行，但要求同步调度 [C22] |
| DyntraLB | 无 | 无 | 同开 `ValueError` |
| PP > 1、与负载均衡调度互斥 | 有 | 有 | 有 |

### 源码位置

| 看什么 | 在哪（`db701c1f`） |
|---|---|
| 字段与校验、PP > 1、与 balance scheduling 互斥、`min_chunk` 截到预算 | `vllm_ascend/ascend_config.py` |
| 换 `scheduler_cls` | `vllm_ascend/platform.py` |
| 调度器副本、时间预算、两处截块、两处扣账 | `vllm_ascend/core/scheduler_profiling_chunk.py` |
| 开机试跑、取哪张卡的计时 | 同上 `run_profiling_chunk_init`、`_build_rpc_kwargs` |
| 二次拟合、目标耗时、求根、平滑、下限、凑整、带历史的模型 | `vllm_ascend/core/profiling_chunk_predictor.py` |
| 包住 `EngineCore.__init__`、在线校准记账 | `vllm_ascend/patch/platform/patch_profiling_chunk.py` |
| 试跑入口、每步同步计时 | `vllm_ascend/worker/worker.py` 的 `profile_prefill_latency`；`vllm_ascend/worker/model_runner_v1.py` |
| 设计文档 / 用户指南 / 教程 | `docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md`、`docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md`、`docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md` |

**待核。**

1. 试跑计时到底该取首段还是末段：代码取末段首卡、只含本段，worker 注释说用首段；缺作者说明或实机日志。
2. GLM 在 PP = 2 下的试跑曲线、块大小是否仍为 640、动态分块的收益：没有部署，也没有实测数。
