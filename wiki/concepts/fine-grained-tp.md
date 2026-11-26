---
id: fine-grained-tp
title: 细粒度 TP：为特定模块选择分片组
type: feature
legacyAnchors:
  放到-glm-双机这套部署开了细粒度-tp-吗: 复杂异构实战对照：GLM 双机为何未启用细粒度 TP
summary: >-
  细粒度 TP 让词表嵌入、lm_head、attention 输出投影与稠密 MLP 沿 DP
  方向把服务不同请求的卡编成一组、合存一份权重，代价是进出该层需收集输入与送回结果；以 Qwen3-30B-A3B D 节点与 GLM 双机反例对照收益与边界。
aliases:
  - Fine-Grained Tensor Parallelism
  - Fine-grained TP
  - FGTP
  - 细粒度 TP
  - 细粒度张量并行
  - 模块级张量并行
  - FinegrainedTPConfig
  - finegrained_tp_config
  - oproj_tensor_parallel_size
  - lmhead_tensor_parallel_size
  - embedding_tensor_parallel_size
  - mlp_tensor_parallel_size
  - olora_tensor_parallel_size
  - qkv_iproj_tensor_parallel_size
  - OProjRowParallelOp
  - get_otp_group
  - lmheadtp
  - emtp
  - mlptp
  - otp
chapters:
  - '13'
order: 20
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L110-L149'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L577'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L164-L227'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L321'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L183-L222'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L258-L299'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L143-L161'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L877-L894'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L52-L73'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L673-L790'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L801-L820'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L88-L170'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1320-L1322'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2975-L2984'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1327-L1352'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/Fine_grained_TP.md#L1-L109
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L524-L595'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L516-L587'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1140-L1220'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py#L330-L426'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2454-L2460'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1416-L1431'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/dsa_v1.py#L1580-L1650'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1848'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3604-L3646'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L806-L817'
  - >-
    raw:sha256-51db7d1760c773e59d975a43ab6da61932765363169112c9f38604e667010453.md#L1-L1231
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1326-L1354'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1362-L1413'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1423-L1438'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L822-L830'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1140-L1151'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1918-L1940'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2050'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L54-L114'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L578'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L683-L693'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1322-L1432'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L830-L840'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1148-L1160'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1431-L1550'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L899-L910'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1320-L1332'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 理解矩阵分片与输出拼接或求和
  - to: tensor-parallel
    kind: variant-of
    note: 细粒度 TP 是张量并行的模块级变体：不再全模型共用同一 TP 组，而是在 DP 维度为词表嵌入、lm_head、稠密 MLP 与 attention 输出投影分别建立独立分片组
  - to: data-parallel
    kind: builds-on
    note: 区分请求副本与并行通信组
  - to: expert-parallel
    kind: builds-on
    note: 理解 MoE 专家与非专家权重的不同布局
  - to: collective-communication
    kind: builds-on
    note: 理解收集与归约分片的输入输出
  - to: sequence-parallel
    kind: alternative-to
    note: SP 在同一 TP 组内拆开 All-Reduce 以省归一化与残差重复激活；细粒度 TP 则沿 DP 方向跨不同请求借卡合存特定模块权重
contradicts: []
updated: '2026-11-26'
origin: gap
rawSources:
  - >-
    raw/sha256-0ffb3feb6e1a9db47775d4122d25d681a736421321b869980b1aed646005633c.md
  - >-
    raw/sha256-51db7d1760c773e59d975a43ab6da61932765363169112c9f38604e667010453.md
---

## 细粒度 TP 是什么？

在大规模 MoE 模型的解码（Decode）节点上，为了避开每层跨卡 [TP](tensor-parallel.md)（张量并行）的通信等待，工程上常把普通 TP 设为 `1`、改开多路 [DP](data-parallel.md)（数据并行，每张卡独立调度一批请求），再配合跨 DP 的 [EP](expert-parallel.md)（专家并行）把占大头的路由专家分散到 8 张、16 张甚至 32 张卡上。可这样一来，不属于路由专家的词表嵌入（[embedding](embedding.md)）、输出词表头（[lm_head](lm-head.md)）、注意力输出投影与稠密 MLP 就必须在每一张 DP 卡上各自完整复制一份——8 张卡存 8 遍，32 张卡存 32 遍，白白挤占了留给 `KV cache` 的显存与每步读权重的带宽。

**Fine-grained TP（细粒度张量并行）正是 `vllm-ascend` 为破解这笔重复权重账提供的模块级切分特性：不改动全局 `TP=1` 的主体布局，而是沿 DP 方向把原本各跑各请求的几张卡在指定模块上临时编成一组，合存一份该模块的权重、每张卡只存其中一片。** 可独立设组的模块涵盖词表嵌入、`lm_head`、注意力输出投影（将多头结果投影回隐藏维度的矩阵）与稠密 MLP（旧版另含面向特定低秩输出投影的 `olora` 字段，`main` 新增面向线性注意力输入投影的 `qkv_iproj` 字段，详见文末版本表）。

理解它只需抓住和普通 TP 的两个核心反差：
- **普通 TP 是“全模型绑死同一组卡”**：设了 `TP4`，词表嵌入、注意力、稠密 MLP 和 `lm_head` 默认共用这 4 张卡合作算同一批 token（个别低秩投影或共享分量仍可能按算子实现保留每卡复制，并非所有矩阵机械除以 4）；
- **细粒度 TP 是“按模块挑人、沿 DP 跨请求组队”**：没被选中的模块照旧各卡独立跑自己的请求，只有被选中的那个模块让 $k$ 张 DP 卡合存一份权重。

看一个 4 卡示意：全局开 `DP4`、普通 `TP=1`，卡 0 到卡 3 分别服务请求 A、B、C、D。原本每张卡都要存一整份非专家权重，开启细粒度 TP 后可以为不同模块各自指定分片组大小：

```wiki-diagram
file: fine-grained-tp-intuition
```

- **词表嵌入 2 张卡一组**：卡 0、1 合存一张词表，各存一半；卡 2、3 合存另一张。
- **attention 不分组**：每张卡仍存一整份。
- **稠密 MLP 2 张卡一组**：和词表嵌入一样两两组队。
- **路由专家照常按 [EP](expert-parallel.md) 分**（expert parallel，专家并行）：每张卡存一部分完整的专家。
- **lm_head 4 张卡一组**：4 张卡合存一份，各存四分之一。

图上选中的模块各有自己的分组，这就是「细粒度」的意思。右栏写的是进出这一层要做的事：沿 DP 分组后，组里几张卡服务的是**不同的请求**，所以进入模块前要收集输入，结果再送回原请求所在的卡，下一节展开。

## 为什么需要它：DP 让同一份权重存了好几遍？

DP 每多一个请求执行组，通常就多一份该组的非专家权重。MoE 模型（大部分参数在专家里的模型，见 [MoE](moe.md)）配上 EP 以后，专家可以跨 DP 组分布，每卡只存一部分；非专家部分仍按各 DP 组原有的 TP 布局保存。上图 TP1 的示意里，N 个 DP 组就在 N 张卡上各存一份相同的非专家权重。

这会让两样东西变贵：

1. **显存**：同样的数存 N 遍，挤掉了本可以留给 [KV cache](kv-cache.md)（保存历史 token 中间结果的缓存）的空间。
2. **矩阵权重的读取预算**：decode（继续生成 token 的阶段）每步通常只算少量行，读取权重可能成为主要成本，见 lm_head 页的[「算得少、读得多」](lm-head.md#为什么这一步算得少读得多)。对选中的 lm_head、稠密 MLP、attention 输出投影，若按相同工作量、每个权重理想读取一次估算，k 张卡合存使每卡承担的矩阵字节降到 1/k；这表示分摊读取和复用的机会，不是每步实际 HBM 访存或耗时的比例。缓存命中、重复读取、批次变化和额外通信都要结合实现与实测。词表嵌入则是查表，只访问选中行；其分组首先减少常驻容量，不能套用整矩阵读取预算。

那为什么不直接把普通 TP 开大？因为这会改变多类算子的分片与通信规模：各层的归约可能跨更多卡，attention 头数等维度还须满足整除约束（其他限制见 [TP 的代价](tensor-parallel.md#切开以后要付的代价)）。细粒度 TP 可以只调整选中的模块，其余模块保留原来的分组。

代价出在「组里的卡服务不同请求」这一点上。以关闭 SP、采用先列切再行切的稠密 MLP 为例，普通 TP 组的几张卡手里是**同一批 token**：输入本来就一样，各算一片以后，一次 [All-Reduce](collective-communication.md#all-reduce)（各卡的结果按位置相加，每张卡都拿到整份）就收尾了。沿 DP 组队的卡手里是**各自请求的 token**，于是要多做两件事：

- 进这一层前，用 [All-Gather](collective-communication.md#all-gather)（每张卡交出自己那段、收回所有卡的段）让组里每张卡都拿到全组的输入；
- 算完以后，结果只该回到 token 所属的那张卡：各卡结果要相加的，用 [Reduce-Scatter](collective-communication.md#reduce-scatter)（按位置相加，每张卡只拿走属于自己的那一段）；不用相加、只是分段的，用 [All-to-All](collective-communication.md#all-to-all)（每张卡把要给别人的部分分别发过去）。

| | 普通 TP 组（上述稠密 MLP 例子） | 细粒度 TP 组（沿 DP 组队） |
|---|---|---|
| 组里的卡手里是 | 同一批 token | 各自请求的 token |
| 进这一层前 | 不用交换 | 收集全组的输入 |
| 算完以后 | All-Reduce，每卡拿整份 | Reduce-Scatter 或 All-to-All，每卡只拿回自己的 |
| 配置作用范围 | 各层支持普通 TP 的算子；部分分量仍复制 | 为选中的模块另设分组 |

除了这两次通信，还有三样看不见的代价：

- **形状要匹配**：本页这些集合通信路径要求组内输入满足等宽约定，不同请求这一步的 token 数不一样时，需要调度或模块先补齐。补出来的空行也要传、也要算；配置能解析不等于每一种模块和执行模式都自动完成了对齐，具体边界见页末。
- **步调绑在一起**：组里一张卡慢了，其他卡都得等；某个 DP 副本这一步正好没有请求，也要陪着跑完这一层的通信，和 MoE 层要求空闲组[陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)是同一个道理。
- **只是借卡，不改请求**：它只在某一层里临时借组内别的卡算自己那一片，不会把几个请求拼成一条序列，也不改变 MoE 给 token 选专家的规则。

## 怎么算：两张卡各带一个请求，怎样合用一张词表？

用一个能手算的例子（数为示意，算式是真的），后面几节接着用。2 张卡组成一组：卡 0 服务请求 A，卡 1 服务请求 B。词表缩成 8 个词，每个词只用 2 个数表示（真实模型每个词是几千个数）。这张表按编号切成两半：卡 0 存第 0–3 行，卡 1 存第 4–7 行；其中第 1 行是 [1, 3]，第 6 行是 [2, 5]。这一步 A 要查的编号是 6，B 要查的是 1。

麻烦马上出现：A 在卡 0 上，可第 6 行存在卡 1；B 在卡 1 上，第 1 行却存在卡 0。只在本卡查，两张卡都查不到自己要的那一行。

```wiki-diagram
file: fine-grained-tp
```

1. **All-Gather 编号**：两张卡互换编号，都拿到 [6, 1]。第 0 个位置来自卡 0，第 1 个位置来自卡 1，这个顺序后面用来把结果送回原处。
2. **本地查表**：每张卡把两个编号都查一遍，但只查自己存的那几行，不归本卡的编号填 0。卡 0 得到 [0, 0] 和 [1, 3]，卡 1 得到 [2, 5] 和 [0, 0]。
3. **Reduce-Scatter**：两张卡的结果按位置相加，第 0 行留给卡 0，第 1 行留给卡 1（示意）：

| 行号（Reduce-Scatter 按位置相加） | 卡 0 与卡 1 贡献相加 | 归属卡与最终向量 |
| --- | --- | --- |
| 第 0 行（A 的 token，编号 6） | $[0,\, 0] + [2,\, 5]$ | **$[2,\, 5]$**，留在卡 0 |
| 第 1 行（B 的 token，编号 1） | $[1,\, 3] + [0,\, 0]$ | **$[1,\, 3]$**，留在卡 1 |

每一行只有一张卡查到了真值，另一张卡贡献的是 0，所以相加恰好还原出整行，不会多加。A 要的第 6 行是卡 1 替它查的，B 要的第 1 行是卡 0 替它查的。

上例两张卡各处理一个 token，已满足等量输入的条件；如果 A 本轮处理两个、B 只处理一个，就要先按前节的对齐规则处理，不能把未对齐的两批输入直接套进这个示意。

这和[普通 TP 下的词表嵌入](embedding.md#多张卡分着存一张表每张卡查一段再加起来)原理相同，差别只在两头。普通 TP 组里的卡拿的是同一批 token，各查一段后做一次 All-Reduce，每张卡都拿到全部向量。细粒度组里的卡拿的是不同请求的 token，所以入口多一次 All-Gather，出口的 All-Reduce 则换成只把各自那一行送回的 Reduce-Scatter。

两次通信传的东西也不同：All-Gather 收集的是整数编号，一个 token 只占一个整数；Reduce-Scatter 归约的是向量，一个 token 占隐藏维度那么多个数（示意里是 2 个，真实模型几千个）。形状和数据类型都不一样。组里各卡这一步的 token 数不一定相同，实际实现先把编号补到一个固定长度，补出来的行照样查、照样传，送回以后再切掉，每张卡只留本卡真实的那几行。

## 不同模块需要不同通信

同一个套路（收集输入 → 本卡算一片 → 送回结果）用到不同模块上，收集什么、怎样送回并不一样。决定它的是两个问题：

- **本卡这一片权重，要用到全组 token 的哪些数？** 要用每个 token 的整条向量，就 All-Gather 整条；只用每个 token 的一段特征，就用 All-to-All 只把那一段发过来。
- **本卡算出来的是什么？** 如果是要和别的卡相加才完整的**部分和**，就用 Reduce-Scatter 边加边送回；如果本身已经是最终值、只是只有其中一段，就用 All-to-All 把每一段送回它所属的卡，拼起来。

### lm_head：每张卡算出一段最终分数，用 All-to-All 送回

接着用上面的两张卡。A、B 走完所有层，到 lm_head 时各有一条隐藏向量：h_A 在卡 0，h_B 在卡 1。lm_head 是另一张表，同样按词编号切开：卡 0 存词 0–3 的行，卡 1 存词 4–7 的行。

1. **All-Gather 隐藏向量**：两张卡都拿到 h_A 和 h_B。
2. **本卡打分**：卡 0 给 A、B 各打词 0–3 的 4 个分数，卡 1 给 A、B 各打词 4–7 的 4 个分数。一个词的分数只和这个词那一行有关，所以这些分数已经是最终值，不是部分和（见 [lm_head 的切法](lm-head.md#每张卡存-19360-个词算出来的就是最终分数)）。
3. **All-to-All 送回**：卡 0 把 B 的那 4 个分数发给卡 1，卡 1 把 A 的那 4 个分数发给卡 0。

| | 卡 0 算出 | 卡 1 算出 | All-to-All 以后 |
|---|---|---|---|
| A 的分数 | 词 0–3 | 词 4–7 | 8 个分数都在卡 0 |
| B 的分数 | 词 0–3 | 词 4–7 | 8 个分数都在卡 1 |

每张卡最后拿到的是自己请求的一整行分数，接下来的采样照常在本卡做。其中任何一个分数都在一张卡上一次算完，All-to-All 只负责搬运，比如 A 对词 6 的分数就在卡 1 上一次算完再送回卡 0（示意）：

$$\text{score}(A,\, \text{词 } 6) = h_A \cdot w_6 = [1,\, 2] \cdot [1,\, -1] = 1 \times 1 + 2 \times (-1) = -1$$

| 计算项（A 对词 6 的分数，示意） | 数值 | 说明 |
| --- | --- | --- |
| A 的隐藏向量 $h_A$ | $[1,\, 2]$ | 经入口 All-Gather 送达卡 1 |
| 卡 1 上词 6 的权重行 | $[1,\, -1]$ | 本地词段权重 |
| A 对词 6 的最终分数 | $1 \times 1 + 2 \times (-1) =$ **$-1$** | 经 All-to-All 送回卡 0 |

旧版（`v0.23.0` / `v0.26.0rc` / 历史 GLM 快照）`vllm-ascend` 曾提供「按段采样」（`enable_reduce_sample`）实验开关：打开后省去这次 All-to-All，各卡保留本段分数按分段采样。`v0.30.0` 主基线与当前 `main` 已移除该开关，详见 [lm_head 版本差异](lm-head.md#版本差异)。

### 稠密 MLP：切法和 TP 一样，只是两头换了通信

MLP 用的就是 [TP 的成对切法](tensor-parallel.md#为什么总是先列切再行切)：第一个矩阵按列切，每张卡算出中间层的几列、就地做激活；第二个矩阵按行切，每张卡得到形状完整、但只含本卡贡献的部分和。区别只在两头：普通 TP 组的卡输入相同，入口不用通信，出口一次 All-Reduce；细粒度组的卡输入不同，入口先 All-Gather 全组的 token，出口用 Reduce-Scatter 把相加后的结果按 token 送回。这「两头」和 [SP](sequence-parallel.md) 把一次 All-Reduce 拆成两半的手法相同，用处相反：SP 是普通 TP 组里同一批 token 按行分开、省掉重复的活，这里是不同请求的 token 凑到一组来借权重。

一次 All-Reduce 本来就能拆成 Reduce-Scatter 加 All-Gather 两半（见[集合通信](collective-communication.md#all-reduce)）。这里是把两半分放在这一层的两头：入口 All-Gather，出口 Reduce-Scatter。所以一组 k 张卡、每卡 b 个 token 时，每张卡收发的量和在 k × b 个 token 上做一次 All-Reduce 差不多。

源码只替换非 MoE 层里的这两个投影，MoE 层里的共享专家不受影响。

### attention 输出投影：先按特征交换，再按 token 送回

attention 的最后一步是输出投影：每个 token 的各头结果拼成一条长度为 D 的向量，再乘回隐藏维度。细粒度 TP 把这个矩阵按行切，也就是按输入的 D 个特征切成 k 段，卡 j 存第 j 段特征对应的那几行。

卡 j 只用得上每个 token 的第 j 段特征，用不着整条向量。所以入口不做 All-Gather，而是 **All-to-All**：每张卡把自己 token 的第 j 段发给卡 j。交换以后，卡 j 手里是全组所有 token 的第 j 段特征，乘上自己那几行，得到全组 token 的部分和；出口再用 **Reduce-Scatter** 按位置相加，把每个 token 送回原卡。下图上半幅用 2 卡、`D = 4` 演示这条特征交换路径，下半幅顺便按比例对照后文 GLM 双机硬开细粒度 TP 反而权重膨胀 4 倍的反例：

```wiki-diagram
file: fine-grained-tp-fig-oproj-and-glm
```

如上图所示，卡 0 上 A 的结果是 `[a1, a2, a3, a4]`，卡 1 上 B 的是 `[b1, b2, b3, b4]`。All-to-All 后卡 0 拿到 `[a1, a2]` 与 `[b1, b2]`，卡 1 拿到 `[a3, a4]` 与 `[b3, b4]`——与 All-Gather 整条相比，入口只收自己用得上的一半特征。

### 四个模块放在一起看

| 模块 | 进这一层 | 本卡算出 | 送回 |
|---|---|---|---|
| 词表嵌入 | All-Gather 编号 | 本卡那几行的向量，其余填 0 | Reduce-Scatter |
| lm_head | All-Gather 隐藏向量 | 全组 token 在本卡词段上的最终分数 | All-to-All（旧版另含按段采样分支） |
| 稠密 MLP | All-Gather 隐藏向量 | 全组 token 的部分和 | Reduce-Scatter |
| attention 输出投影 | All-to-All 交换特征段 | 全组 token 的部分和 | Reduce-Scatter |

```wiki-diagram
file: fine-grained-tp-fig-dp-group-guard
```

**边界与例外：层名匹配、六道硬前提与图尺寸守卫。**

- **按层名匹配替换**：源码只按层名决定是否替换，不保证所有模型都走同一条路。稠密 MLP 只换非 MoE 层；DeepSeek-V4 压缩式 attention 的两段式输出投影另有一套写在 attention 内部的实现；旧版第五项「低秩输出投影」也只在这类实现里生效。
- **`oproj` / `mlp` 的六道硬前提（`v0.30.0` 与 `main`）**：这两项要求模型为 MoE 且分组大小整除 DP 数。此外还须满足全局 `TP == 1`、`PCP == 1`、非 `NONE` 图模式与 PD 分离 D 节点（`kv_consumer`）。同时必须开启 `recompute_scheduler_enable=true` 与 `PreemptOffloadConnector`（`embedding` 不再绑定重算调度器）。
- **图捕获尺寸静默退回守卫**：系统估算单步最大宽度 `max_step = min(max_num_batched_tokens, max_num_seqs × decode_query_len)`。若最大图捕获尺寸小于该宽度，超宽步落入 eager 会导致跨 DP 集合通信失配甚至死锁，因此启动时会告警并静默关闭 `oproj` / `mlp`（`v0.30.0` 清零为 `0`，`main` 重置为 `1`）。
- **`main` 字段变化**：`main` 将全部字段默认值改为 `1`，并新增面向 KDA 的 `qkv_iproj_tensor_parallel_size`。实际是否替换以启动日志和各层替换日志为准，见页末[对照源码](#对照源码)。

## 省下的和多付的：怎样比？

先算一笔示意账：某个模块整份是 1 GiB，组大小 $k = 4$，这一步每张卡有 $b = 8$ 个 token，隐藏维度 $H = 4096$，每个数 2 字节（BF16）。按稠密 MLP 那种「入口 All-Gather、出口 Reduce-Scatter」的 ring 走法，每卡发出或接收整份（$4 \times 8$ 行）的 $(k - 1)/k$：

$$\text{Traffic}_{\text{AG+RS}} = 2 \times (k - 1) \times b \times H \times 2\text{ B} = 2 \times 3 \times 8 \times 4096 \times 2\text{ B} = 393{,}216\text{ B} = 384\text{ KiB}$$

| 核算项（$k = 4,\; b = 8,\; H = 4096$，BF16，示意） | 算式 | 每卡结果 |
| --- | --- | --- |
| 每卡常驻权重 | $1\text{ GiB} \div 4$ | **0.25 GiB** |
| 每卡节省常驻权重 | $1 - 0.25$ | **0.75 GiB** |
| 入口 All-Gather 每卡收到 | $(4 - 1) \times 8 \times 4096 \times 2\text{ B}$ | **192 KiB** |
| 出口 Reduce-Scatter 每卡发出 | $(4 - 1) \times 8 \times 4096 \times 2\text{ B}$ | **192 KiB** |
| 每卡每轮 AG + RS 单向合计 | $196{,}608\text{ B} + 196{,}608\text{ B}$ | **384 KiB** |

这份示意里，常驻矩阵每卡少 0.75 GiB；若再假设相同工作量下每份矩阵理想读取一次，权重读取预算也少 0.75 GiB。384 KiB 是所列 ring 通信的单方向字节账，不能和容量差直接比较出收益，更不保证实际 HBM 少读这么多。加上第二节讲过的补齐（空行照样算、照样传），还要看三件事：

- **一次前向做几轮**：一轮指「收集一次、送回一次」。词表嵌入和 lm_head 一次前向各只做一轮；稠密 MLP 和 attention 输出投影是每层一轮，有这种层的层数越多轮数越多。
- **每轮的固定开销**：每次集合通信都有启动开销，组里所有卡还要互相等齐才能继续。批量小的时候，这部分往往比传那几百 KiB 更花时间。
- **跨不跨机**：组里的卡不在同一台机器上时，这些通信就包含机间链路；等待取决于实际拓扑、有效带宽、传输大小和拥塞，不能只凭“跨机”给出固定快慢结论。

再拿 `v0.30.0` 标准 MoE 模型 **`Qwen3-30B-A3B`**（`vocab_size = 151,936`、`hidden_size = 2,048`、`tie_word_embeddings = false`，BF16 每个数 `2 B`）落在单机 8 卡 [PD 分离](pd-disaggregation.md) D 节点（`DP=8, TP=1, EP=8`）上算一笔真实权重账：

| 核算项（`Qwen3-30B-A3B` 单机 8 卡 `DP=8, TP=1, EP=8`） | 算式（BF16） | 每卡常驻大小 |
| --- | --- | --- |
| 不开细粒度 TP：单张词表或 `lm_head` | $151{,}936 \times 2{,}048 \times 2\text{ B} = 622{,}329{,}856\text{ B}$ | **$\approx 593.5\text{ MiB}$**（两表共 **$\approx 1.16\text{ GiB}$**） |
| 开启 `embedding = 8, lmhead = 8` 后单表分片 | $593.5\text{ MiB} \div 8$ | **$\approx 74.2\text{ MiB}$**（两表共 **$\approx 148.4\text{ MiB}$**） |
| 每卡为 KV cache 腾出的词表常驻空间 | $1{,}187.0 - 148.4\text{ MiB}$ | **$\approx 1.01\text{ GiB}$**（代价为首尾各多 1 轮机内集合通信） |

这个例子还顺手展示了另一条规则：`Qwen3-30B-A3B` 全部 48 层都是路由 MoE 层、没有前几层稠密 MLP，即便在配置里写了 `mlp_tensor_parallel_size = 8`，按层名只替换非 MoE 层的规则也不会替换任何专家层。

vllm-ascend 特性文档另给出过一组更大规模的参考实测：模型为 DeepSeek-R1 W8A8（权重与激活均量化为 8 位整数），硬件是 32 张 Atlas A2（每卡 64 GB）。测试运行在 PD 分离的 decode 实例上，采用 DP32 + EP32，四个模块的细粒度组大小均为 8，batch 为 24：

| 模块 | 每卡省下的显存 | 每个输出 token 的时延（TPOT） |
|---|---|---|
| attention 输出投影 | 5.8 GB | 慢了 1.5 ms |
| lm_head | 1.51 GB | 快了 1.2 ms |
| 稠密 MLP | 0.9 GB | 快了 1.0 ms |
| 词表嵌入 | 1.51 GB | 快了 1.0 ms |

四项合计每卡省下 9.72 GB。省得最多的输出投影反而变慢；它每层多出的 All-to-All 和 Reduce-Scatter 是值得检查的成本，但文档没有用分项测量证明这就是退化原因。稠密 MLP 虽然也按层算，但 DeepSeek-R1 只有前 3 层是稠密层，一次前向只多 3 轮；lm_head 和词表嵌入一次前向只各多一轮。词表嵌入是查表、每步本来只读用到的几行，表里也快了 1.0 ms，文档没有给分项原因。这组数只对那个模型、那套 32 卡部署成立，不能搬到别的部署当结论。省下的显存也不能直接折算成吞吐：能不能变快，要看批量、链路、精度、计算效率，以及通信能不能被计算盖住。

文档没有报告四项配置同时启用后的总 TPOT；不能把表中的单项时延变化直接相加，作为组合配置的实测收益。组合后的整体时延仍需另行测量。

## 复杂异构实战对照：GLM 双机为何未启用细粒度 TP

前面看到，细粒度 TP 在 `DP=8, TP=1` 的解码节点上能把重复存了 8 遍的词表切回 1/8。反过来，如果一套部署**已经在机内开了很大的普通 TP（如 `TP8`）、而跨机只有很小的 `DP2`**，盲目套用细粒度 TP 会发生什么？本站的 [GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md#部署前提)（`2×A2×8`、`TP8/DP2/EP16`、`W8A8`）正好提供了一个直观的反面标尺。

这套双机部署未传任何 `finegrained_tp_config`（见 [Ascend 配置系统](ascend-config-system.md#落到-glm-双机一个-json-键都没传)），五个分组字段保持默认 `0`，所有非专家模块直接跟随原本的机内 `TP8` 切分：词表嵌入切成 8 段后做机内 All-Reduce（见 [embedding 页](embedding.md#放到-glm-双机8-张卡怎么查同一张表)），`lm_head` 切成 8 段后做机内 All-Gather（见 [lm_head 页](lm-head.md#all-gather-把-8-段拼回-154880-个分数)）。至于稀疏 MLA 内部把首个低秩投影与索引器投影保留每卡复制、其余投影按 `TP8` 切分的做法（见 [TP 页稀疏 MLA 一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)），属于模型自身在 `TP` 组内拿少量复制换少一次通信的设计，与跨 DP 组队的细粒度 TP 方向相反。

**假如在 `TP8 + DP2` 上强行开启细粒度 TP**，按钉住源码规则静态推算，会立刻撞上“分片变粗 + 通信跨机”的双重倒退：

- **组大小只能取 1 或 2**：它必须整除 DP 数，而这套部署 DP 是 2。
- **组沿 DP 方向排，全部跨机**：组大小为 2 时，卡 i 和卡 i+8 一组，也就是两台机器上编号相同的两张卡。vLLM 自己的 DP 组正是这 8 对，见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。
- **换了组就不再按 TP8 切**：分到细粒度组的模块，改成只按这 2 张卡（或 1 张卡）切，每张卡存的反而更多（以下为 GLM 双机 `lm_head` BF16 单矩阵静态估算）：

| GLM 双机 `lm_head` 切分方案（BF16） | 每卡权重字节算式 | 每卡大小 |
| --- | --- | --- |
| 默认按 TP8 切 | $154880 \div 8 \times 4096 \times 2\text{ B} = 158{,}597{,}120\text{ B}$ | **151.25 MiB** |
| 细粒度组大小为 2 | $154880 \div 2 \times 4096 \times 2\text{ B} = 634{,}388{,}480\text{ B}$ | **605 MiB** |
| 细粒度组大小为 1（每卡一整份） | $154880 \times 4096 \times 2\text{ B} = 1{,}268{,}776{,}960\text{ B}$ | **约 1.182 GiB** |

这里只算一张 BF16 权重矩阵，不算补齐、量化元数据和运行时缓冲（组大小 2 对应约 0.591 GiB）。默认的 151.25 MiB 出自 [lm_head 页](lm-head.md#每张卡存-19360-个词算出来的就是最终分数)，其余两行是同一个式子换了除数。稠密 MLP 也一样：前 3 层每层每卡的 int8 权重从 18.0 MiB 变成 72.0 MiB，三层从 54.0 MiB 变成 216.0 MiB（TP8 下的 18.0 MiB 见 [TP 页](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)）。而且同一台机器里的 8 张卡手里 token 相同、存的又是同一半权重，等于把同一份活在机内算 8 遍。

通信也从机内搬到了机间。默认路径下，R1（提示词为 4 个 token 的示例请求，见[一条请求](one-request.md)）decode 一步的 `lm_head` All-Gather 在机内拼出约 1.18 MiB 的整份分数，每张卡收到其中约 7/8。改用组大小 2 后，每步要先跨机收集隐藏向量，打完分再跨机 All-to-All。为了让组内形状一致，实现把打分行数固定补到「每组最多请求数 × 每请求 decode token 数」，按固定部署参数即 128 行（两参数见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）。于是每张卡每步都要把 $128 \times 77440$ 个 BF16 分数（19,824,640 B，约 18.9 MiB）发给另一台机器上的搭档。MTP（multi-token prediction，草拟候选 token 的配套层）共用这张 `lm_head`（见 [lm_head 页](lm-head.md#mtp-用的是同一张-lm_head)），草拟那几遍打分同样走这条路，上面只算了主模型的一遍。

另外三项在这套部署上根本开不起来：

- **attention 输出投影**：要求普通 TP 为 1，TP8 在加载配置时就报错；它还要求 graph mode（把算子序列录下来回放的执行方式），并且只能跑在 PD 分离的 D 节点（负责 decode 的那一组机器）上。
- **词表嵌入**：要求同时打开 [recompute 调度器](recompute-scheduler.md)（D 节点显存不够时把请求退回 prefill 一侧重算的调度器），源码注释给的理由是只有它能保证各 DP 组每步的 token 数一致；而这个调度器只能开在 PD 分离的 D 节点上。这套部署是 prefill、decode 混在同一组卡上跑，打开会在启动时报错。
- **低秩输出投影**：本页核对的分支位于 DeepSeek-V4 压缩式 attention 实现；GLM 的稀疏 MLA 则显式构造 Indexer KPool MLA 后端，复用 SFA 的部分实现，并不经过上述两段式投影分支。这一配置同样要求 graph mode 和 D 节点。

所以这个特性瞄准的是另一种部署：PD 分离以后的 decode 实例常用纯 DP（普通 TP 为 1），每张卡各存一整份非专家权重，组队才有东西可省，官方文档推荐的也是这个场景。固定双机已经用 TP8 在机内把这些模块切成了 8 段，再沿 DP 组队只会把切分变粗、把通信搬到机间。

## 常见误解

- **「细粒度 TP 就是给某一层单独把普通 TP 开大。」** 它沿 DP 方向组队，新组替换的是这个模块原来的 TP 组，不是在 TP 组里再切一刀。普通 TP 已经不小时（比如 GLM 双机的 TP8），换成组大小 2 反而让每张卡存得更多。
- **「组里几张卡的输入一样，最后一次 All-Reduce 就够了。」** 组里的卡服务不同请求，输入各不相同：入口要先收集，出口只把各自的 token 送回，用的是 Reduce-Scatter 或 All-to-All。
- **「组队就是把几个请求拼成一条序列。」** 请求仍各归各的卡，只是在这一层借组内别的卡算自己那一片；MoE 给 token 选专家的规则也不变。
- **「省下多少显存，就能快多少。」** 官方实测的四项里，省得最多的 attention 输出投影反而变慢。能不能变快，要看这一层一次前向做几轮通信、批量多大、走不走机间链路、补了多少空行。
- **「配置写得进去，模块就走了这条路。」** 配置检查只看分组大小和几个前提。稠密 MLP 只替换非 MoE 层，低秩输出投影和输出投影的 attention 内写法只在 DeepSeek-V4 压缩式 attention 里生效；要确认，得看启动日志和各层的替换日志。
- **「官方文档说支持稠密模型，稠密模型也能开。」** 特性文档写着支持标准的稠密模型，但钉住版本的源码在加载配置时就拒绝非 MoE 模型：稠密模型会把 DP 改回 1，没法沿 DP 建组。文档和代码不一致时，以钉住版本的代码为准。
- **「输出投影要求普通 TP 为 1，所以其他模块在 TP 大于 1 时都不能用。」** 这条限制只写在输出投影一项上，其他模块在 TP 大于 1 时能通过配置检查；但反过来，也不能说这些组合都已经验证过。

## 对照源码

### 怎么开

- 开关在 `--additional-config` 的 `finegrained_tp_config` 里。钉住版本有五个字段：`embedding_tensor_parallel_size`、`lmhead_tensor_parallel_size`、`oproj_tensor_parallel_size`、`mlp_tensor_parallel_size`、`olora_tensor_parallel_size`，默认都是 0。前四项大于 0 就启用，`olora_tensor_parallel_size` 要大于 1 才启用（`utils.py` 的五个 `*_tp_enable()`）。
- 例：`--additional-config '{"finegrained_tp_config": {"lmhead_tensor_parallel_size": 8, "mlp_tensor_parallel_size": 8}}'`，要求 `data_parallel_size` 能被 8 整除。官方文档的 DeepSeek-R1 示例还带了 `"embedding_tensor_parallel_size": 8`；这一项要同时写 `"recompute_scheduler_enable": true`，并且只能在 D 节点上跑。
- 前提（都在加载 Ascend 配置时检查）：`model_config.is_moe` 为真；每个正的分组大小整除 `data_parallel_size`。输出投影一项另要 `tensor_parallel_size == 1`、不能 `enforce_eager`、`kv_transfer_config` 是 KV consumer；低秩输出投影一项要求不 eager、是 KV consumer；词表嵌入和输出投影两项要求 `recompute_scheduler_enable=true`，而平台层只在 `kv_role='kv_consumer'` 时接受这个调度器。
- 确认生效：启动 info `finegrained_tp_config enabled: lmhead_tensor_parallel_size=8, ...` 表示配置项开启；线性层被替换时会提交 debug 日志 `get_parallel_op: prefix=..., direct=... -> MLPColumnParallelOp (tp_rank=..., tp_size=...)`。只有 debug 日志被采集时，才能用它核对具体层；没看到这行不能独自证明未替换，还要检查构造出的模块与通信组。

### 会报什么错

| 情况 | 报错 | 何时 |
|---|---|---|
| 非 MoE 模型开了任何一项 | AssertionError：`The finegrained tp sizes can be enabled only for MOE models.` | 加载 Ascend 配置 |
| 分组大小不整除 DP 数 | AssertionError：`finegrained tp sizes must divide by data_parallel_size.` | 加载 Ascend 配置 |
| 输出投影一项，普通 TP 大于 1 | AssertionError：`oproj_tensor_parallel_size currently requires tensor_parallel_size == 1, got 8.` | 加载 Ascend 配置 |
| 输出投影或低秩输出投影，用 eager | AssertionError：`... is only supported in graph mode` | 加载 Ascend 配置 |
| 输出投影或低秩输出投影，不在 D 节点 | AssertionError：`... is only supported in pd scenario and can only be used in D node.` | 加载 Ascend 配置 |
| 词表嵌入或输出投影，没开 recompute 调度器 | AssertionError：`oproj_tensor_parallel_size / embedding_tensor_parallel_size require recompute_scheduler_enable=true: ...` | 加载 Ascend 配置 |
| 在不拆 P/D 的部署上开 recompute 调度器 | ValueError：`recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...`；在 P 节点上只告警并关掉 | 平台检查配置 |
| 输出投影一项和 FlashComm2 的输出投影分组同时开 | AssertionError：`flashcomm2_oproj_tensor_parallel_size cannot be enabled simultaneously with oproj_tensor_parallel_size` | 平台检查配置 |
| 词表嵌入一步的 token 数超过静态缓冲区 | ValueError：`embedding_tp static capacity ... < num_tokens ...; increase max_cudagraph_capture_size or max_num_batched_tokens.` | 前向 |
| DeepSeek-V4 压缩式 attention 的输出投影：本卡的组数不能被分组大小整除 | ValueError：`n_local_groups must be divisible by oproj_tensor_parallel_size, ...` | 前向 |
| `v0.30.0` / `main`：分组大小为负 | ValueError：`finegrained_tp_config.<字段> must be non-negative, got ...` | 加载 Ascend 配置 |
| `v0.30.0` / `main`：lm_head 的打分行数不能被分组大小整除 | ValueError：`logits.shape[0] (...) must be divisible by world_size (...) for lmhead_all_to_all.` | 前向 |

### 开销和什么时候别开

- **新组比原 TP 组小时要谨慎**：新组替换原来的 TP 组，不是叠加。TP8 配组大小 2，每卡存得更多，同机的卡还在重复计算，见 GLM 一节；其他组大小仍须分别比较容量、输入规模和通信成本，不能仅因普通 TP 大于 1 就一律排除。
- **DP 小时收益有限**：组大小不能超过 DP 数，DP 为 2 最多两张卡合存。
- **组跨机时**：组内所有收集、送回都走机间链路。GLM 双机的 DP 组就是跨机的 {i, i+8}。
- **每层都做的模块要谨慎**：输出投影和稠密 MLP 每层多一轮通信；官方实测里输出投影省了 5.8 GB，却慢了 1.5 ms。
- **补齐**：词表嵌入和 DeepSeek-V4 attention 内的输出投影路径使用固定大小的静态缓冲区，大小取可能出现的最大 token 数，graph mode 回放要求地址不变；runner 也将这两项列为允许 DP 对齐的条件。普通输出投影算子和稠密 MLP 不在自己的入口自动补任意不等长输入，后者直接收集传入张量，须由调用侧保证形状约定。lm_head 的打分行数固定补到「最多请求数 × 每请求 decode token 数」。`v0.30.0` 与 `main` 对 `oproj/mlp` 另加的图模式与步宽门槛见下节。
- **空闲组也要陪跑**：开了 lm_head 分组以后，某个 DP 组这一步没有请求，也要按补齐后的行数跑一遍假的打分，让组内通信凑齐。
- **适合的场景**：官方建议用在 PD 分离的 decode 实例上，那里常用纯 DP，每卡各存一整份非专家权重。

### 版本差异

`recompute_scheduler_enable` 的绑定对象自 `v0.30.0`（含 `main`）起由旧版的 `oproj` / `embedding` 改为 `oproj` / `mlp`；`embedding` 不再受这条绑定要求，仍须满足自身的分组与互斥校验。

自 `v0.30.0`（含 `main`）起，`oproj` / `mlp` 组大小 `> 1` 还必须配置 `PreemptOffloadConnector`（可经 `MultiConnector`）；缺少它会在平台后置检查中直接 `AssertionError`。原因是这类分片请求抢占后不能依赖回 P 重算来保持相同精度，这项门槛与下面的 `recompute_scheduler`、图模式条件必须同时满足。

**`v0.30.0` 主基线保留四个默认 `0` 的字段，并在 `oproj` / `mlp` 真正分片前增设六道硬前提与步宽守卫。** 字段仍须非负、用于 MoE 且能整除 DP；当 `oproj` 或 `mlp` 组大小 `> 1` 时，还要求 `TP=1`、非 `NONE` 图模式、D 侧 `kv_consumer`、`PCP=1`。图捕获最大档覆盖不了最大可能步宽时会告警并静默关闭这两项（`v0.30.0` 置 `0`，`main` 重置为 `1`），所以“参数能解析”不表示实际生效。另一道派生校验在 `oproj` / `mlp` 任一启用时要求 `recompute_scheduler_enable=true`，不能仅靠开启图或传入字典满足全部条件。

按四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；GLM 固定镜像 `db701c1f` 的配置类与 `v0.23.0` 逐行一致（过渡快照来源索引见下文源码位置）。vLLM 上游没有这个特性，只在 `vllm-ascend` 里。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 字段与默认值 | 5 项（含 `olora_tensor_parallel_size`），默认全 `0` | 同 `v0.23.0` | 4 项（移除 `olora`），默认全 `0`（`ascend_config.py#L1333-L1336`） | 5 项（新增 KDA 输入投影 `qkv_iproj_tensor_parallel_size`，须整除 `linear_num_heads`）；**全部默认值由 `0` 改为 `1`**（`ascend_config.py#L1446-L1488`） |
| 负数校验与前提 | 仅正值启用；校验 MoE、整除 DP、输出投影三条 | 同 `v0.23.0` | 显式拒绝负值；`oproj/mlp > 1` 须 `TP=1`、非 `NONE` 图模式、D 侧 `kv_consumer`、`PCP=1`、`recompute_scheduler_enable=true` 及 `PreemptOffloadConnector`（`ascend_config.py#L830-L840, #L1358-L1381`、`platform.py#L1148-L1160`） | 延续 `v0.30.0` 校验（`ascend_config.py#L899-L910, #L1489-L1515`、`platform.py#L1320-L1332`） |
| 图尺寸不足静默清零门槛 | 无该降级门槛 | 无该降级门槛 | 当 `max_cudagraph_capture_size`（或显式 `cudagraph_capture_sizes` 最大值）为空或 `< max_step = min(max_num_batched_tokens, max_num_seqs * decode_query_len)` 时，告警并静默将 `oproj / mlp` 清零为 `0`（`ascend_config.py#L1383-L1410`） | 同一判据，告警并静默重置 `oproj / mlp = 1`（`ascend_config.py#L1527-L1540`） |
| `recompute_scheduler` 绑定 | 绑定 `oproj` 与 `embedding` | 同 `v0.23.0` | 改绑 `oproj` 与 `mlp`；`embedding` 不再受此绑定 | 同 `v0.30.0` |
| 建组与 `lm_head` 送回 | 沿 DP 固定 PP/TP 建组；`lm_head` 走组 `all_to_all` | 同 `v0.23.0` | 同建组方式；`lm_head` 改用单次 `all_to_all_single`（行数须整除组大小；组大小 `1` 走普通路径） | 同 `v0.30.0` |

### 源码位置

```wiki-diagram
file: fine-grained-tp-flow
```

- **配置与前提**：`vllm_ascend/ascend_config.py` 的 `FinegrainedTPConfig` 与 `platform.py` / `utils.py` 校验分版本演进——历史 GLM 快照 `db701c1f`（同 `v0.23.0` / `v0.26.0rc`）有五个默认 `0` 字段（含 `olora`），把 `embedding` 和 `oproj` 绑到 `recompute_scheduler_enable`；`v0.30.0`（`c09d3e20`）收敛为四个默认 `0` 字段（移去 `olora`），改绑 `oproj` 与 `mlp` 并增 `PreemptOffloadConnector` 与图步宽清零守卫；`main`（`8d6180e2`）新增 `qkv_iproj_tensor_parallel_size` 为五个字段且全部默认值改为 `1`。`platform.py` 负责 D 节点与 `PreemptOffloadConnector` 校验，`utils.py` 提供 `lmhead_tp_enable()` 等判定与 FlashComm2 冲突检查。
- **建组**：`vllm_ascend/distributed/parallel_state.py` 的 `_create_or_get_group`：把全部 rank 排成 PP × DP × TP 的网格，在每个 PP、TP 坐标上沿 DP 每 k 个切一组；同样大小的组只建一次，缓存复用。组名 otp、lmheadtp、emtp、mlptp。
- **词表嵌入与 lm_head**：`ops/vocab_parallel_embedding.py` 的 `AscendVocabParallelEmbedding.__init__`（按层名换成 `get_embed_tp_group()` 或 `get_lmhead_tp_group()`，词表按新组大小切）、`_forward_embed_tp`（静态缓冲区、`all_gather_into_tensor`、掩码查表、`reduce_scatter_tensor`）、`AscendLogitsProcessor._get_logits_lmheadtp`（收集隐藏向量、打分、送回：`v0.30.0` 与 `main` 走单次 `all_to_all_single` 且已移除 `enable_reduce_sample` 分支；仅旧版 `db701c1f` / `v0.23.0` / `v0.26.0rc` 保留旧 `all_to_all` 与 `enable_reduce_sample` 跳过分支）。
- **线性层**：`ops/linear_op.py` 的 `_get_column_parallel_op` / `_get_row_parallel_op` 按层名挑算子（`gate_up_proj`、`down_proj` 且非 MoE 层 → `MLPColumnParallelOp` / `MLPRowParallelOp`；`o_proj` → `OProjRowParallelOp`；`wo_a` / `wo_b` → DSV4 的两个算子），`is_moe_layer` 按 `first_k_dense_replace` 等判定 MoE 层；`CustomLinearOp` 的通信组同时决定权重切几份。
- **补齐与陪跑**：`worker/model_runner_v1.py` 里开 lm_head 分组时把 `logits_indices` 补到 `max_num_reqs × uniform_decode_query_len`，空跑时照样算假的打分；输出投影或词表嵌入分组时允许 DP 补齐。
- **GLM 的层名与后端**：`models/glm5_next.py` 的 `lm_head`、稠密 MLP 的 `gate_up_proj` / `down_proj`；DeepSeek-V4 压缩式 attention 的两段式输出投影分组写在 `attention/dsa_v1.py`。GLM 则由模型显式构造 `AscendIndexerKPoolMLAAttention`，再选择 `AscendIndexerKPoolMLABackend`；实现继承 SFA，但不能仅凭平台后端映射表把它认成普通 SFA 路径。

正文结论的出处：

- 沿 DP 方向建组、固定 PP 与 TP 坐标、组大小整除 DP 数 [C1][C2]；模块换用新组并按新组大小切权重 [C10]。
- 四个模块的收集与送回：词表嵌入 [C3]，lm_head 与按段采样分支 [C4]，稠密 MLP [C5]，输出投影 [C6]；按层名挑算子、只换非 MoE 层 [C11]。
- 词表嵌入、输出投影绑定 recompute 调度器，调度器只许 D 节点 [C7][C8]；lm_head 打分行数补齐、DP 补齐与陪跑 [C14][C15][C26]。
- 官方实测表和部署建议 [C17]。
- 入口收集加出口归约的通信量与 k × b 行上的一次 All-Reduce 相当，由 ring 通信量公式推得 [D]；示意账里的 1 GiB、k = 4、b = 8 是示意取值 [A]，字节数按同一公式算出 [D]。
- 「每轮固定开销在小批量时占大头」是一般经验，没有在本系统上测过 [I]；官方表里没有给出输出投影退化的分项原因。
- GLM 双机没开：默认值为 0 [C2]，GLM 的层名 [C23]，DP 组为 {i, i+8} [C25]；打开后的每卡权重与跨机通信量，按上述源码规则和底稿数字推算，未实测 [D]；同机 8 张卡重复计算，由同一 TP 组的卡输入相同推得 [D]；DeepSeek-V4 两段式输出投影的写法见来源 24；来源 27 只是平台默认映射表，GLM 实际显式构造链见新增来源 35–37。
- 版本差异：配置类在 v0.23 [C18]、v0.26 [C19] 与固定镜像逐行相同，main 的变化 [C20][C21]。
- 来源 38 是历史快照 `baa023ad` 对 `oproj/embedding` 的 recompute 绑定；`v0.30.0` 周期引入的字段、步宽、recompute 与 `PreemptOffloadConnector` 条件分别对应来源 29–33。来源 16 包含 FlashComm2 正值入口守卫，互斥判断不适用于该功能关闭时。

待核：

- 官方实测表里词表嵌入也快了 1.0 ms，可查表每步只读用到的几行，文档没有给分项数据；缺一次分模块的 profiling。
- GLM 双机打开 lm_head 或稠密 MLP 分组后的真实显存和时延没有实测；缺一次带这项配置的启动日志和 profiling。
- 拆成 PD 分离以后，D 节点的 TP、DP 取值决定这个特性有没有东西可省；GLM 的 PD 分离配方没有核。
- 低秩输出投影一项在 v0.23、v0.26 上作用于哪些模型，只读了按层名挑算子的规则，没有跑过。

等量输入算例对应固定 db701c1f 的前提：词表嵌入与输出投影的跨 DP 通信绑定 recompute 调度器，以保证输入 token 数一致（来源 7）。词表嵌入还使用静态输入缓冲、补齐后通信并裁剪输出（来源 3）；GLM 双机开启后的端到端行为仍缺实测。

官方实验（来源 17）的总计行只有显存 9.72 GB，TPOT 栏为破折号；各模块结果不能相加成组合配置的总时延，也不能作为 GLM 双机的收益预测。
