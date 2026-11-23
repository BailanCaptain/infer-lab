---
id: pipeline-parallel
title: 流水线并行（PP）：层分段、状态交接与气泡
type: feature
summary: >-
  把模型的隐藏层按先后顺序切成几段放到不同的卡组上，让请求像工件一样依次流过各段；讲清层分段与 TP 的区别、段间状态交接、流水线气泡与微批填充，拆解 v0.30.0 非末段 PPMissingLayer 消除词表峰值并放大批 token 预算的机制，以及 GLM 双机为什么没开 PP。
aliases:
  - Pipeline Parallel
  - 流水线并行
  - 管线并行
  - PP
  - PP stage
  - 流水线气泡
  - pipeline_parallel_size
  - '--pipeline-parallel-size'
  - VLLM_PP_LAYER_PARTITION
  - PPMissingLayer
  - IntermediateTensors
  - get_pp_indices
  - make_layers
  - isend
  - irecv
  - AsyncIntermediateTensors
  - SupportsPP
  - max_concurrent_batches
  - '--headless'
  - 微批
chapters:
  - '04'
order: 20
sources:
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L1-L465'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/features/ray.md#L1-L160'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/feature_guide/pipeline_parallel.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/tutorials/features/ray.md
  - >-
    raw:sha256-c8b1a2c79b32558573476b248571b6ba66e40038fa939a49b27343a5f5c7cf0c.md#L1-L293
  - 'vllm@ced6857a:vllm/config/parallel.py#L120-L132'
  - 'vllm@ced6857a:vllm/config/parallel.py#L888-L895'
  - 'vllm@ced6857a:vllm/config/model.py#L1435-L1444'
  - 'vllm@ced6857a:vllm/distributed/utils.py#L127-L173'
  - 'vllm@ced6857a:vllm/model_executor/models/utils.py#L826-L888'
  - 'vllm@ced6857a:vllm/model_executor/models/llama.py#L377-L401'
  - 'vllm@ced6857a:vllm/model_executor/models/llama.py#L502-L518'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6524-L6535'
  - 'vllm@ced6857a:vllm/config/vllm.py#L588-L604'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1877-L1899'
  - 'vllm@ced6857a:vllm/distributed/parallel_state.py#L1067-L1205'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L775-L843'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4305-L4345'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L724-L780'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1466-L1470'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1740-L1744'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1085'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2238-L2243'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L620-L662'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L69-L74'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L691-L695'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L912-L1013'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L499'
  - 'vllm@0fc695fc:vllm/config/model.py#L1188-L1207'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L662-L702'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L99-L106'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1063-L1064'
  - 'vllm@568afb3a:vllm/config/vllm.py#L512-L522'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L903-L962'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1585-L1603'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/pipeline_parallel.md#L425-L435'
  - 'vllm@ba15685a:vllm/config/compilation.py#L204-L237'
  - 'vllm@ba15685a:vllm/config/vllm.py#L615-L632'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2132-L2169'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2262-L2319'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2462'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L607-L650'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: layers-and-hidden
    kind: builds-on
    note: 先理解层间传递的隐藏状态与 GLM 的四路残差连接
  - to: chunked-prefill
    kind: builds-on
    note: 长提示词切块送入流水线及动态分块 CPP 均以分步预算切块为基础
  - to: collective-communication
    kind: builds-on
    note: 区分段间点对点收发与段内 TP 组的 All-Gather 合并
  - to: tensor-parallel
    kind: builds-on
    note: 对比层内按列/行切分与层间按段切分，以及段内叠加 TP 时的切片交接
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-c503bde9e5acc84299ab340e2282e9a6dfd495d1804cdd4f80a7bdf7ed4947c8.md
  - >-
    raw/sha256-c8b1a2c79b32558573476b248571b6ba66e40038fa939a49b27343a5f5c7cf0c.md
---

## PP 是什么？

**Pipeline Parallelism（PP，流水线并行）把模型的隐藏层按先后顺序切成几段，每段放在不同的卡（或卡组）上；一个请求从第一段流到最后一段，像工件在流水线上一站一站往下传。**

沿着[请求全景](request-overview.md)走到逐层前向时，如果模型太大、单张卡甚至单台机器装不下，先看一个最小例子（示意）：把一个 8 层的模型放到 4 张卡上，PP 按层号从前往后切成 4 段，每段 2 层：

| 段 | 放在 | 负责哪几层 | 这一段另外还放 |
|---|---|---|---|
| 阶段 0 | 卡 0 | 第 0、1 层 | 入口的 `embed_tokens`（embedding：把 token 编号查成一串数） |
| 阶段 1 | 卡 1 | 第 2、3 层 | — |
| 阶段 2 | 卡 2 | 第 4、5 层 | — |
| 阶段 3 | 卡 3 | 第 6、7 层 | 出口：最后的 `norm`（归一化层）、`lm_head` 给词表打分、采样出下一个 token |

一个请求进来时：卡 0 先把 token 查成隐藏向量（hidden state：每个 token 在层与层之间传递的那一串数，详见[层与隐藏表示](layers-and-hidden.md)），算完第 0、1 层，把得到的隐藏向量交给卡 1；卡 1 接着算第 2、3 层，再交给卡 2；卡 3 算完最后两层，打分并采样出下一个 token。

在这个示意里，每张卡只存、只算分给它的那几层，入口与出口阶段还承担表中列出的额外模块。段与段之间交接的是**下一阶段继续计算所需的中间状态**，不是已经生成的文字。上例用单一隐藏向量表示状态；实际模型还要确认是否同时交接残差状态（`residual`，供后续层叠加使用的中间表示），具体张量取决于模型结构。

这里的「段」在代码和文档里叫 `stage`（阶段），本页说「阶段 k」就是负责第 k 段的那组卡。一段不一定只有一张卡：段内还可以叠加 TP 切分每层，具体切片交接见后文「交接在 vLLM 里怎么走？」。

## 为什么需要 PP？

一个模型的权重一张卡放不下时，最基本的两种多卡分法区别在「从哪里下刀」。下面继续用 8 层稠密模型作示意：假设权重矩阵都能均分，每层 attention 与 MLP 先列切、后行切，各在行切后归约一次（实际模型需分别核对分片矩阵与复制矩阵，MoE 路由专家还可按 EP 分布）：

- **Tensor Parallel（TP，张量并行）在每一层内部下刀**：本例所画的权重矩阵切成 4 片，每张卡拿每层这些矩阵的 $1/4$。算每一层时 4 张卡一起算、各算一部分，算完要把各卡的部分结果合起来——本例每层合两次（attention 与 MLP 各一次），切分与归约过程见 [TP 页](tensor-parallel.md)。
- **PP 在层与层之间下刀**：每张卡拿完整的几层。对同一批 token 来说，任一时刻只有一段在算，算完把中间状态交给下一段。

```wiki-diagram
file: pipeline-parallel-split
```

同一个 8 层模型、同样 4 张卡，两种切法对一下账（示意）：

| 对比维度 | TP：4 张卡切每一层 | PP：4 段，每段 2 层 |
|---|---|---|
| 每张卡放多少所画层权重 | 每层的 $1/4 \times 8$ 层 $= 2$ 层的量 | 完整的 2 层 |
| 一个 token 跑完一次前向，卡间交接几次 | 本例 $8$ 层 $\times 2$ 次 $= 16$ 次，每次 4 张卡一起归约 | $3$ 次（`0→1`、`1→2`、`2→3` 三个分界），每次点对点一发一收 |
| 同一时刻有几张卡在为这个 token 干活 | 4 张 | 1 张 |

按本例的均分假设，两种切法每张卡放的所画隐藏层权重一样多，都是 $1/4$（入口、出口及复制模块另计）。不只是权重，生成过程中每层要攒下的历史——[KV Cache](kv-cache.md)（前面 token 的 key、value 存下来，后面的 token 反复读取）——也跟着层走：PP 里哪一段负责哪几层，就只存哪几层的历史。所以每段的权重与缓存状态，都由它负责的层区间决定。

真正的取舍在**通信频率与等待气泡**：

- PP 交接次数少，每次只是相邻两段之间的点对点收发（[集合通信](collective-communication.md)对比了点对点收发与多卡集合归约的区别），因此常放在卡间互连较慢的跨机器边界上，让高频的 TP 集合通信留在单机高速互连（如昇腾 HCCS）内部。
- 代价是同一个 token 在任一时刻只有一段在算，其余段在等——也就是下文要展开的「气泡」。TP 没有这种跨段等待，但每层都要同步归约，一旦跨机走慢网络就会每层卡顿。

两者并不互斥：常见多机拓扑正是「机内 TP 切层内矩阵 + 跨机 PP 切层间阶段」。哪种组合更划算，必须结合单卡容量、机内/机间带宽、各段负载与线上并发度实测比较。

## 一个请求怎样流过 4 段？

回到 8 层、4 段的例子。把“今天 / 天气 / 很 / 好”示意分成 4 个 token，每个 token 用 8 个隐藏通道表示，合起来就是一张 **4 行 × 8 列的输入矩阵 X**。行名对应 token，列里的数字是通道值，不是 token 编号；下面的静态图和交互 3D 使用完全相同的一组数。

为了只盯住层间交接，每一层暂用「每个通道值加 1」代替真实计算（示意；真实的一层包含 attention 和 MLP，见[层与隐藏表示](layers-and-hidden.md)）。下图每一格展示一张卡收到的完整输入、留在该卡的两层，以及算完后的完整输出；上一格的输出就是下一格的输入，整张矩阵的行、列一起传递：

```wiki-diagram
file: pipeline-parallel-flow
```

逐步核对时，先盯住“好”这一行的前两个通道 `[1, 0]`（其余行、列也经过同样的示意计算）：

1. **卡 0**：`embed_tokens` 为 4 个 token 查出整张 `4×8` 输入矩阵；其中“好”行的前两格是 `[1, 0]`，过第 0 层得 `[2, 1]`，过第 1 层得 `[3, 2]`。
2. **交接 `0→1`**：卡 0 把更新后的 **整张 `4×8` 隐藏状态矩阵**发给卡 1（不只发那两格）。第 0、1 层的权重和卡 0 攒下的 KV cache 全留在卡 0，不跟着走。
3. **卡 1**：过第 2、3 层，`[3, 2]` → `[4, 3]` → `[5, 4]`，再发给卡 2。
4. **卡 2**：过第 4、5 层得 `[7, 6]`，发给卡 3。
5. **卡 3**：过第 6、7 层得 `[9, 8]`，再经出口的 `norm` 和 `lm_head` 词表打分，采样出下一个 token。

选中的两格从 `[1, 0]` 变成 `[9, 8]`，其余格也各加了 8，对应 8 层——和不切分、在一张卡上连算 8 层的结果完全一致。**PP 不改变算什么，只改变在哪张卡上算。** 同时也能一眼看出代价：卡 1 在收到卡 0 的输出之前只能干等；在这个单批、无交叠的示意里，任一时刻只有一段在计算这批 token。

```wiki-scene
parallel-mechanism:0
```

### 层数除不尽时怎么分？

在 `v0.30.0` 主基线的标准模型上，层数往往能被常见 `PP` 整除：例如 `Qwen3-8B`（`36` 层）切 `PP = 2` 时每段正好 `18` 层（`[0, 18)` 与 `[18, 36)`），`Qwen3-30B-A3B`（`48` 层）切 `PP = 4` 时每段正好 `12` 层。

遇到层数除不尽时，vLLM 的 `get_pp_indices` 先整除均分，再把余层**从倒数第二段起往前每段加 1 层**。最后一段默认不加，用来缓冲出口 `norm`、`lm_head` 与采样的显存开销（当 `PP > 2` 且余数 $\le \text{PP} - 2$ 时，余数全落中间段，首尾两段都能避开）。以 `45` 层模型（例如后文历史 GLM 案例）为例：

- **分 2 段**：`45 ÷ 2 = 22` 余 `1` → 余下的 1 层加给倒数第二段（即阶段 0）→ 两段各 `[23, 22]` 层。阶段 0 负责 `[0, 23)`（第 0–22 层），阶段 1 负责 `[23, 45)`（第 23–44 层）。
- **分 4 段**：`45 ÷ 4 = 11` 余 `1` → 余下的 1 层加给倒数第二段（即阶段 2）→ 四段为 `[11, 11, 12, 11]`。阶段 2 负责 `[22, 34)`，首段与末段均保持 11 层。

想手工指定每段几层，可设置环境变量 `VLLM_PP_LAYER_PARTITION`，写成逗号分隔的整数串（如 `"12,11,11,11"`）。条目数必须等于 `pipeline_parallel_size`，总和必须等于目标隐藏层总数（不含词表、`norm` / `lm_head` 或投机草稿层），否则启动直接抛 `ValueError`。

在代码里，`make_layers` 保留全部层的下标槽位，但非本段层统一放空占位类 `PPMissingLayer`（继承 `torch.nn.Identity`，零参数、零显存），只为本段 `[start_layer, end_layer)` 实例化权重与 KV cache。首段另建 `embed_tokens`，末段另建 `norm` 和 `lm_head`（启用词表权重共享 `tie_word_embeddings` 或特定投机方法时，末段也会按需建 `embed_tokens`）。

注意，**层数分得匀不等于活分得匀**：首段多做词嵌入，末段多做 `norm`、词表打分、采样乃至本地草稿模型；遇到各层注意力/专家类型不均的模型，层数相同的两段在耗时与显存上仍可能相差悬殊。

## 多个请求错开进入时，各卡忙闲怎样？

大模型生成是一个 token 接一个 token 往外吐的自回归过程：请求 A 要生成第 2 个 token，输入正是第 1 个 token 的采样结果（暂不考虑一次先猜几个候选 token 的[投机解码](speculative-decoding.md)）。因此 A 的第 2 轮 `A2` 必须等第 1 轮 `A1` 走完卡 3、采样出结果后，才能回到卡 0 开算。

把时间切成等长的格子，假设每段算一轮正好占 1 格（示意：各段等速，忽略交接和采样耗时），对比单请求与多批次错开进入时每张卡的忙闲：

```wiki-diagram
file: pipeline-parallel-bubble
```

- **上半：只有请求 A。** `A1` 依次走过卡 0..3，第 4 格 `A2` 才能回到卡 0。数一下：`8 格 × 4 张卡 = 32` 个「卡·格」，真正在算的只有 `8` 个（`A1`、`A2` 在每段各占 1 格），设备利用率 $8 \div 32 = 25\% = 1 / \text{PP}$。空着的 `24` 个灰格就是流水线的**气泡**（bubble）：卡空在那里等上一段交数，或首段等同一请求上一轮采样结果返回。更一般地，凡是某个阶段因启动灌入、收尾排空、段间耗时不均或前后轮依赖而无就绪工作可算的空闲时段，都构成气泡。
- **下半：4 个互不依赖的批次 A、B、C、D 错开 1 格进入。** 卡 0 算完 `A1` 立刻接 `B1`，同时卡 1 接手 `A1`；到第 3 格，4 张卡全部满载。前 3 格属于「灌满流水线」，卡 1 空 1 格、卡 2 空 2 格、卡 3 空 3 格，共空 $0 + 1 + 2 + 3 = 6$ 格；8 格里忙了 $32 - 6 = 26$ 格，利用率升至 $26 \div 32 \approx 81\%$，第 3 格起达到 100%，且 `A1` 刚好在第 4 格前走完卡 3 让 `A2` 无缝接续。

规律很直接：**同时在路上的独立微批数（in-flight batches）至少要等于段数 `PP`，流水线才可能填满。** 2 段时 2 批交错即可，4 段至少要 4 批。vLLM 的 `max_concurrent_batches` 正按这一规则设定：开启 PP 后，引擎批队列默认允许 `pp_size` 个批次同时在途；若同时开启[异步调度](async-scheduling.md)（卡还在执行当前步时，调度器提前排好下一步）且启用新版 V2 model runner（`use_v2_model_runner`），队列深度进一步扩为 `pp_size + 1`（引擎如何维护多批入队与出队见[引擎核心](vllm-engine-core.md)）。

上图是各段等时的理想网格。真实服务里各段耗时不一、批次大小浮动且存在同步开销，不能指望固定第几步起永远 100% 满载；同时，长提示词还会经 [Chunked Prefill](chunked-prefill.md) 切成多块送入流水线，在 `v0.30.0` 的昇腾部署上还可进一步打开专为 `PP > 1` 设计的[动态分块 CPP](dynamic-chunked-pp.md)（开关见[动态切块配置](../params/profiling-chunk-config.md)），按预计耗时动态伸缩每块长度，因此绝不能说「PP 从不拆分输入」。

## PP 要付什么代价？

PP 换来的是「跨机装得下」和「高并发流水吞吐」，但必须算清四笔代价：

1. **流水线气泡。** 只有单条请求在跑时，等时示意的阶段利用率只有 $1 / \text{PP}$（4 段仅 $25\%$）；即便并发微批充足，启动灌入和收尾排空仍有空窗。请求稀疏时，开了 PP 的卡大部分时间在等。
2. **分段本身不缩短单请求的串行依赖。** 在等时示意里，同一个 token 仍要依次过完 8 层，一层都没少，还多了 3 次段间交接。相对高效的单机内 TP，低并发单请求解码往往更慢；只有当对照基线被迫使用跨机器慢速 TP 时，PP 把每层高频集合通信收敛回机内的局部性收益才可能反超，必须在同负载下实测对比。
3. **段间通信：单次量不大，但每个分界每步都有一次。** 在单隐藏向量示意布局下，每个分界交接本批 token 的隐藏向量字节数为：

$$\text{Bytes}_{\text{boundary}} = T \times H \times \text{dtype\_bytes}$$

沿用示意数 $H = 2$、BF16 每元素 $2\text{ B}$：一批 $T = 3$ 个 token 单次交接 $3 \times 2 \times 2 = 12\text{ B}$，4 段共 3 个分界合计交接 $3 \times 12 = 36\text{ B}$。注意这个量与段内包了几层无关——段里是 2 层还是 20 层，分界出口只交一次当前状态（而前面 8 层 TP 示意每层要归约两次、共 16 次）。真实模型须逐项核对交接字典里所有非空张量的形状与精度（空值 `None` 仅随元数据传递），不能一刀切套用单一隐藏向量或双倍隐藏向量估算。
4. **最慢的一段卡死全线节奏。** 示意：4 段里阶段 2 算一轮要 2 格，其余段只要 1 格；稳态每 2 格才从阶段 2 吐出一批，其余段每 2 格都得陪等 1 格。一个周期（2 格）共 $4 \times 2 = 8$ 个卡·格，实际干活的只有 $1 + 1 + 2 + 1 = 5$ 格，利用率跌至 $5 \div 8 = 62.5\%$。因此分段要按实测耗时与显存调平，不能只拿「总层数 ÷ 段数」估算。

### `v0.30.0` 显存峰值削减、批预算放大与高阶耦合

把视角切到[显存探测](kv-cache-memory-profiling.md)与每步调度预算：为什么在长上下文或大模型部署里，开启 `PP > 1` 往往能支撑显著更大的 `--max-num-batched-tokens`？核心原因不止「权重和 KV 缓存按段切分」，更在于**非末段彻底砍掉了词表打分与采样的激活尖峰**：

```wiki-diagram
file: pp-fig-memory-and-budget
```

对照上图的三栏结构与两项工程耦合：

- **非末段（`0 .. PP−2`）用 `PPMissingLayer` 消除 `[T_sample, vocab_size]` 尖峰**：当 `PP = 1` 时，同一组卡既要装全量隐藏层权重和 KV cache，还要承担出口 `norm`、`ParallelLMHead`、词表维 All-Gather 与采样器，撑起 `[采样行数, 词表大小]` 峰值。切分 `PP > 1` 后，各段只建本段约 $1/\text{PP}$ 的隐藏层与 KV cache；所有非末段（`not is_last_rank`）直接把 `norm` 与 `lm_head` 换成零开销的 `PPMissingLayer`，开机显存探测 `profile_run` 跳过 `_dummy_sampler_run`，正常前向也不算 `logits`。末段（`PP−1`）虽保留出口模块，但 `get_pp_indices` 默认不给末段摊余数层来对冲显存。单卡常驻与峰值双降后，可安全拉高 `--max-num-batched-tokens`，并在 `v0.30.0` 下对接[动态分块 CPP](dynamic-chunked-pp.md)（`profiling_chunk_config` 建议设为固定分块的 `2~4` 倍；注：`main` 已移除 CPP）。
- **`v0.30.0` 的 `SP + PP > 1` 自动注入 `+rms_norm` 与昇腾 SP 分支差异**：`v0.30.0` 同开上游 `compilation_config.pass_config.enable_sp` 与 `PP > 1` 时，原生 `rms_norm` 图追踪会因跨段残差形状不匹配报错，因此 `VllmConfig` 会静默向 `custom_ops` 追加 `"+rms_norm"`（显式传 `"-rms_norm"` 则告警；上游 `main` 已移除 `PassConfig.enable_sp`）。昇腾 `FlashComm1` 须区分两条路：MoE 序列并行（`use_sequence_parallel_moe`，即 MoE + EP + `TP > 1`）支持 `PP > 1` + SP；只有稠密 SP（`enable_dense_sp`）限制 `PP = 1`，在 `PP > 1` 时告警并自动关闭。
- **跨机 RoCE `PP × DP` 禁区与 P/D `PP_D == 1` 约束**：跨节点 RoCE 跑 MoE 时，`MoeDistributeDispatch` 不支持 **`PP > 1` 与 `DP > 1` 同开**，且 Python 启动期**无断言拦截**，误配会在运行期报错或挂死，必须保持 `PP = 1` 或 `DP = 1`。在 [PD 分离](pd-disaggregation.md)采用 `MooncakeConnectorV1` 时，P 侧可开 `PP > 1`，但 **D 侧必须固定 `PP_D == 1`**（`decode.pp_size = 1`）。

## 推理和训练用 PP 有什么不同？

PP 最早普及于大模型分布式训练，阅读外部资料时要注意训练流水线图与推理的三个本质差异：

| 对比项 | 分布式训练 PP | 在线推理 PP（本知识库场景） |
|---|---|---|
| 每批流向 | 先前向（阶段 `0 → 3`），再反向（阶段 `3 → 0`）回传梯度 | **只有前向**，无反向传播 |
| 每段驻留状态 | 前向激活值必须一直攒到对应微批反向算完才能释放 | 无需为反向暂存激活；跨步长期驻留的是本段各层的 KV Cache |
| 气泡成因与排空 | 一个大 batch 拆成多个 micro-batch，每轮权重同步更新前必须排空流水线 | 无权重更新排空；同一请求下一轮受自回归依赖限制，但不同请求互不依赖，只要在途并发微批 $\ge \text{PP}$ 即可持续交错填满 |

## 交接在 vLLM 里怎么走？

把段间那根交接箭头拆开，落到上游 `vllm` 与昇腾 `NPUWorker.execute_model` 里，每一步遵循「等上轮发送 → 每步先同步收元数据再异步收张量切片 → 机内拼回（SP 关闭时）→ 异步发下一段」的流水顺序：

```wiki-diagram
file: pp-fig-handover-tp-slice
```

- **先等上轮发送，再同步收元数据并异步收发张量。** 每步开头若有上一轮挂起的发送句柄 `_pp_send_work`，先 `wait()` 收尾。除首段外，先调 `irecv_tensor_dict` 接收并封装为 `AsyncIntermediateTensors`；本段算完后，除末段外调 `isend_tensor_dict` 异步发给下一段（V2 runner 随即返回 `None`；V1 runner 若挂有 KV 连接器则继续透传 `kv_connector_output`）。
- **每步发的是「元数据 + 张量字典」。** 标准 `isend_tensor_dict` / `irecv_tensor_dict` 在**每一步**都会先发并经 `recv_object` **同步接收**键名、形状与 `dtype` 元数据（`None` 等非张量字段只随元数据走，不发空张量），随后才对真实张量逐个发起点对点异步 `irecv` / `isend`。
- **段内叠加 TP 时的切片优化与 SP 例外。** 同一段内的 TP 卡持有相同完整隐藏状态：只要张量元素总数整除 `tp_size`，各卡只跨段点对点发送属于自己的 `1/TP` 切片，接收段再经机内 `tp_group` All-Gather 拼回（如图中 `[3, 2]` 跨段仅传 2 个数而非 4 个）。若开启按 token 分片的[序列并行](sequence-parallel.md)（`v0.30.0` 判 `enable_sp()`，`main` 收窄为 `use_v2_model_runner and enable_sp(vllm_config)`），各卡本就不是完整副本，Worker 会置 `all_gather_group = None` 关掉这步拼接。

## 两台机器怎样加入同一条流水线？

**节点（node）是物理机器，阶段（stage）是模型分段，`rank` 是某个通信组内的成员编号**——三者可以恰好对齐，也可以完全不同。例如两台机器各有 8 个可见 NPU，采用 `TP8 / PP2 / DP1 / PCP1`：每个 PP 阶段由 8 个 TP worker 合算，两个阶段共占 16 个设备，每台机器恰好放一个阶段，合起来服务同一个 DP 执行组。

这里的总逻辑设备账是 **`DP × PP × TP × PCP`**。其中 `PCP`（prefill context parallel）负责把长提示词切给更多 worker 协同计算；`DCP`（decode context parallel）与 `EP`（专家并行）都是在这批已有设备上重新划分通信组或专家归属，**不再额外乘一遍设备数**。在部分双芯片封装形态（如教程中的 Atlas A3）里，“8 张物理卡”在系统内呈现为 16 个逻辑 NPU，数卡时一律以运行时可见设备编号为准，详见[硬件与设备](hardware-devices.md)。

上述两机 `TP8 / PP2` 例子的角色分工如下，注意各行编号分属不同命名空间：

| 层次 | 第 1 台机器 | 第 2 台机器 |
| --- | --- | --- |
| MP 启动的节点编号 | `node rank 0` | `node rank 1` |
| 本例放置的 PP 阶段 | `PP rank 0`（前半段） | `PP rank 1`（后半段） |
| 本阶段内 TP worker 编号 | `TP rank 0–7` | `TP rank 0–7` |
| 面向用户的 HTTP 接口 | 启动 API server | `--headless`（仅加入后端执行组） |

用户请求发往第 1 台的 API server，后端把同一微批依次送过两台机器上的两个阶段，最终采样结果经引擎送回 API。**`--headless` 只代表不暴露前端 HTTP 接口，绝不代表不加载权重、不参与计算，也不代表它固定对应 PP 末段。** 反过来，看到“用了 2 台机器”也不能反推出 `PP = 2`——两台机器同样可以跑跨机 TP，或各自跑独立的 DP 组。

多机拉起有 `mp`（`multiprocessing`，Python 多进程分布式后端）与 `ray`（分布式集群调度框架）两条后端路径：`mp` 要求在每台机器分别执行参数严格匹配的命令，靠同一组 `--master-addr` / `--master-port` 会合。`ray` 则先组建集群并确认 NPU 入池，再在 head 节点只提交一次 `vllm serve`（切忌把 `mp` 两份命令原样提交两次给 Ray）。在 [PD 分离](pd-disaggregation.md)场景中，P 实例可由多机 PP 组成，而 `MooncakeConnectorV1` 下的 D 实例必须保持 `PP = 1`（完整设备账见 [DeepSeek 部署对照](deepseek-v4-1-flash.md#ascend-上的-1p1d-究竟用了多少设备)）。

## GLM 双机为什么没用 PP？

上面讲完通用 `v0.30.0` 多段 PP 机制后，这里单独隔离本站 `09 旗舰异构模型全案` 的历史绑定案例（2 台 × 8 张 A2，`TP8 / DP2 / EP16`，`W8A8`，固定 `vllm@0fc695fc + vllm-ascend@db701c1f`，见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。结论很直接：**该双机方案没有开 PP（`PP = 1`）**，而是机内 TP8 + 双机 DP2，MoE 路由专家走跨机 EP16（[DP](data-parallel.md) 分请求，[EP](expert-parallel.md) 把 288 个专家分到 16 卡，单个 DP 组不独立持有完整专家）。下面的 GLM 分段属于**源码接口变体推演**：只回答「假如给 GLM 开 PP 会怎样分层、分界交什么」，未经真实双机 PP 实测，主线吞吐/时延也不能直接套用。

### 变体：GLM 的 45 层分成 2 段

```wiki-diagram
file: pipeline-parallel
```

按前文的默认分段公式，45 层分 2 段得到 `[0, 23)` 与 `[23, 45)`，即第 0–22 层（23 层）和第 23–44 层（22 层）。固定的 `glm5_next.py` 代码已实现完整 PP 接口：首段建 `embed_tokens`，末段建最终 `norm` 与 `lm_head`，非本段层位放 `PPMissingLayer` 占位，且模型类声明了 `SupportsPP`，可通过启动时的 PP 支持性检查。

但 `23 + 22` 层并不代表两段负载匀称：GLM 前 3 层为稠密 MLP + KDA、后 42 层混排 KDA 与稀疏 MLA 加 MoE，各层算力、状态与缓存开销本就异构，首尾段还分别多出词嵌入与词表采样，不能拿「总显存 ÷ 2」估算单段容量。

### GLM 的分界上交什么？

GLM 采用 mHC 多路残差连接（见[层与隐藏表示](layers-and-hidden.md)）：普通隐藏层输出保留 4 路表示、每路宽 `4096`，直到全局最后一层才把 4 路汇成 1 路。因此段间分界上每个 token 的隐藏状态包含 $4 \times 4096$ 个元素。

代码里交接字典虽然声明了 `hidden_states` 和 `residual` 两个键，但 GLM 这条 mHC 路径每层返回的 `residual` 恒为 `None`——按前文的张量字典规则，`None` 只随元数据传递，不会在链路上发第二份同形状张量。在「4 路表示、BF16 每元素 2 字节、未按序列并行再切分」三条静态前提下，分界上 $T$ 个 token 的隐藏状态逻辑字节数为：

$$\text{Bytes}_{\text{GLM-PP}} = T \times 4 \times 4096 \times 2\text{ B} = T \times 32{,}768\text{ B} = T \times 32\text{ KiB}$$

代入 $T = 1$ 为 `32 KiB`，$T = 4$（如主线示例请求 R1 的 4 行）为 `128 KiB`；实际物理链路流量还受 TP 切片与序列并行开关影响，不能直接当作硬件实测带宽。

### 主线为什么没开？

官方教程没有写明不选 PP 的原因（缺官方对 PP 与 TP/DP 取舍的说明及同硬件开 PP 的对比实测），但顺着本页机制可以清楚看到两点工程背景：

- **不开 PP 已经装得下。** 主线里按 TP 切分的矩阵在每台 8 卡内分片，288 个路由专家靠 EP16 摊到两机 16 卡上（见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），单卡容量已经够用，无需靠 PP 救命。
- **卡数账上 `PP1 × DP2` 避免了跨段气泡。** 在 `PCP = 1` 时，一个 DP 执行组占 `PP × TP` 张卡。主线 `PP1 × TP8` 每组 8 卡，16 卡可排成 `DP2` 两组并行吃请求（专家跨组按 EP16 共享）；若改成 `PP2 × TP8`，单个执行组就吃满 16 卡，只能跑 `DP1` 且还要承担跨机阶段交接与流水线气泡。GLM 双机真实配置以[官方双机来源](../sources/glm-5-3-flash-baseline.md)为准。

## 常见误解

下图汇总线上配置 PP 时最高发的四类工程误判与 `v0.30.0` 源码真相：

```wiki-diagram
file: pp-fig-myths
```

结合上图，逐条核对全部高频误区：

- **「切成两段 PP，就能让同一个 token 的前后半层同时算、降低单请求延迟。」** 错。后段依赖前段输出，单请求只能串行过段并多付交接与气泡开销，相对机内高效 TP 通常更慢；只有并发微批数 $\ge \text{PP}$ 时才能填满流水线换吞吐（除非原方案被迫跑慢速跨机 TP）。
- **「层数分得匀，各段显存和耗时就匀。」** 错。首段多 `embed_tokens`，末段多 `norm`、`lm_head`、采样甚至 MTP 草稿层；异构层与专家负载也不同，末段往往最先 OOM，需实测各段并用 `VLLM_PP_LAYER_PARTITION` 把层数往前挪。
- **「两机卡数够乘积，跨机 RoCE 跑 MoE 就能同时开 `PP > 1` 和 `DP > 1`。」** 错。`v0.30.0` 与 `main` 下跨节点 RoCE MoE 的 `MoeDistributeDispatch` 不支持 `PP > 1` 与 `DP > 1` 同开，且**没有 Python 启动报错拦截**，误配后会在运行期挂死或失败，必须固定其中一个为 `1`。
- **「P/D 分离里 P 侧开了 PP，D 侧也能照抄开 PP，或把 `VLLM_PP_LAYER_PARTITION` 拷给 D。」** 错。当前 `MooncakeConnectorV1` 强制 D 侧 `decode.pp_size = 1`；双端 `kv_connector_extra_config` 虽都要填相同的 `prefill.pp_size`（及自定义 `prefill.pp_layer_partition`），但环境变量 `VLLM_PP_LAYER_PARTITION` 只能在真正分段的 P 进程设置。
- **「分界上传的是权重或整份 KV Cache；或者字典有两个键就要传两份等大张量。」** 都错。权重和 KV cache 留在所属阶段，分界只传下一段继续算所需的中间激活；像 GLM mHC 路径中 `residual` 为 `None`，仅随元数据走，不占张量传输体积。
- **「图上一根交接箭头就是一次物理发包；或者 PP 从不拆分输入。」** 都错。代码里先发元数据再逐张量收发，段内有 TP 时还默认按 `1/TP` 切片发送再在段内 All-Gather；而长输入可经 Chunked Prefill 或 `v0.30.0` 的动态分块 CPP 拆成多块交错入线。
- **「GLM 双机主线是用 PP 把模型切到两台机器上的。」** 错。主线是 `TP8 / DP2 / EP16`（`PP = 1`）；本页的 GLM `23 + 22` 两段切分只是源码接口推演变体。

## 对照源码

### 怎么开

- **启动参数**：`--pipeline-parallel-size`（简写 `-pp`），对应 `ParallelConfig.pipeline_parallel_size`，默认 `1`（不开）[C6]。单个 DP 执行组占用的逻辑设备数为 `PP × TP × PCP`（启用跨 DP 的 EP 时，单组不单独持有全部路由专家）。
- **自动与手动分层**：默认由 `get_pp_indices` 按「先整除均分、余数从倒数第二段往前逐段加 1」切分；需要手动指定时导出环境变量 `VLLM_PP_LAYER_PARTITION`（如 `"12,11,11,11"`）[C9]。
- **并发在途微批数**：`VllmConfig.max_concurrent_batches` 在开启 PP 后默认设为 `pp_size`；同时开启 `async_scheduling` 且使用 V2 model runner（`use_v2_model_runner`）时为 `pp_size + 1` [C14]。

下面以官方 PP 指南的双机 `mp` 拓扑为例（每机 8 个可见 NPU，`TP8 / PP2`）[S1]；实际模型路径、HCCL 网卡环境变量与模型参数按目标模型教程准备，把示例地址 `192.0.2.10` 换成两机互通的主节点 IP 并选择空闲端口：

```bash
# 节点 0：暴露 HTTP API 并承担一段
vllm serve /path/to/model \
  --distributed-executor-backend mp \
  --tensor-parallel-size 8 --pipeline-parallel-size 2 \
  --nnodes 2 --node-rank 0 \
  --master-addr 192.0.2.10 --master-port 29500

# 节点 1：加入同一执行组（--headless 不起前端 API）
vllm serve /path/to/model \
  --distributed-executor-backend mp \
  --tensor-parallel-size 8 --pipeline-parallel-size 2 \
  --nnodes 2 --node-rank 1 \
  --master-addr 192.0.2.10 --master-port 29500 --headless
```

`--nnodes` 为参与本次实例的节点总数，`--node-rank` 在 `0 .. nnodes-1` 内唯一，两边模型、TP、PP、节点数与 `--master-addr` / `--master-port`（进程会合端口，不可混同于 HTTP 服务端口）必须严格一致。若改用 `ray` 后端，须先在**每个节点启动 Ray 前**配好通信与 `VLLM_PP_LAYER_PARTITION` 等环境变量（已启动的 Ray worker 不会自动继承后续在另一终端导出的变量），按[官方 Ray 集群步骤](https://docs.vllm.ai/projects/ascend/en/latest/tutorials/features/ray.html)组建集群并核验 NPU 资源后，只在 head 节点执行一次 `vllm serve /path/to/model --distributed-executor-backend ray --tensor-parallel-size 8 --pipeline-parallel-size 2` [S2]。

与 P/D 分离配合时，`MooncakeConnectorV1` 要求 D 侧固定 `PP = 1`（`_decode_pp_size == 1`）[C23]：P、D 双端 `kv_connector_extra_config` 都必须填写一致的 `prefill.pp_size`（自定义分层时双端还要填相同的 `prefill.pp_layer_partition`），但环境变量 `VLLM_PP_LAYER_PARTITION` 只在真正分段的 P 进程导出，绝不能复制给 `PP = 1` 的 D 进程；同时 P 侧 TP 须不小于 D 侧 TP 且为其整数倍。

### 会报什么错

| 触发情形 | 报错类型与关键文本 | 核查与处理 |
|---|---|---|
| 模型未实现 `SupportsPP` 却设了 `PP > 1` | `NotImplementedError: Pipeline parallelism is not supported for this model...` [C8] | 检查模型类是否接入 `SupportsPP` 与 `make_layers`（GLM 已声明支持） |
| `VLLM_PP_LAYER_PARTITION` 段数 ≠ `pp_size`、总和 ≠ `num_hidden_layers` 或含非整数 | `ValueError: ... does not match pp_size` / `... does not match num_hidden_layers` / `Invalid partition string` | 确认逗号分隔整数个数等于 `-pp` 且总和等于隐藏层数（不含词表、末段 `norm` 或草稿层） |
| 弹性专家并行（Elastic EP）与 `PP > 1` 同开 | `ValueError: Elastic EP is not supported with pipeline parallelism...` [C7] | 关闭 Elastic EP 或把 `pipeline_parallel_size` 设回 `1` |
| 昇腾 `xlite_graph_config` 与 `PP > 1` 同开 | `RuntimeError: xlite graph is not compatible with pipeline parallelism. Please set pipeline_parallel_size to 1.` | 关闭 Xlite 图模式或改用 `PP = 1` |
| `sparse_kv_offload_config` 直接与 `PP > 1` 同开 | `ValueError: Sparse KV offload don't support pipeline parallel now.` | 该配置分支拒绝 `PP > 1`；若需稀疏卸载配 PP，须按指南走 layerwise connector 路径并区分 P/D 角色（见[稀疏 KV offload](kv-cache-sparse-offload.md)） |
| 开启 `profiling_chunk_config`（CPP）但 `PP <= 1`，或 `v0.30.0` 下配 `async_scheduling` 未开 V2 runner | `ValueError: profiling_chunk_config requires pipeline parallelism (pp > 1).` [C19] / `... requires the v2 model runner`（`main` 已移除该配置） | 仅在 `v0.30.0` 且 `PP > 1` 时启用 CPP，配异步调度须设 `VLLM_USE_V2_MODEL_RUNNER=1` |
| `MooncakeConnectorV1` 在 `decode` 侧配置 `pp_size != 1` | `AssertionError: decode pp size must be 1` | 保持 D 侧 `PP = 1`，仅在 P 侧开启 PP |
| 跨节点 RoCE MoE 同时设 `PP > 1` 与 `DP > 1` | **无 Python 启动报错拦截**，首请求或运行期通信失败/挂死 | `MoeDistributeDispatch` 不支持该组合拓扑，跨机 RoCE MoE 必须固定 `PP = 1` 或 `DP = 1` |

### 开销和什么时候别开

- **单机装得下且以低并发时延为首要目标时优先机内 TP**：单请求等时示意利用率仅 $1 / \text{PP}$ [D]，微批不足段数时流水线填不满；只有模型必须跨机、用 PP 把高频 TP 归约限制在机内时，才可能靠通信局部性抵消交接和气泡开销。
- **非末段省掉 `lm_head` 尖峰，但末段仍是显存瓶颈**：阶段 `0 .. PP−2` 用 `PPMissingLayer` [C10] 省掉 `[T_sample, vocab_size]` 词表与采样峰值 [C12][C13]，从而允许调高 `--max-num-batched-tokens`；一旦单 rank OOM，优先检查是否落在承担 `norm` + `lm_head` + 草稿模型的末段，并用 `VLLM_PP_LAYER_PARTITION` 把 1–2 层往前段挪。
- **段间流量按实际非空张量核计**：$T \times H \times \text{字节数}$ 仅对应单隐藏向量示意，GLM 的 `32 KiB/token` 也依赖 4 路 BF16 且未按序列并行再切分的前提 [D]。

### 版本差异

在 **`v0.30.0`（主基线 `c09d3e20` + `ced6857a`）** 与 **`main`（`8d6180e2` + `ba15685a`）** 中，PP 执行链与高阶特性的组合边界要重点区分以下几处：

- **非末段返回路径区分 Runner 版本**：`NPUWorker.execute_model` 在非末段调 `isend_tensor_dict` 发出中间张量后，V2 model runner（`use_v2_model_runner`）直接返回 `None`；V1 model runner 则继续检查并透传 `kv_connector_output`（用于 PP + KV 传输场景），不能笼统简化为“发送后立即返回” [C17]。
- **序列并行（SP）与 PP 的两处版本演进**：第一，上游 `v0.30.0` 在开启 `PassConfig.enable_sp` 且 `PP > 1` 时静默向 `custom_ops` 追加 `"+rms_norm"` [C15]，而上游 `main (ba15685a)` 已移除 `PassConfig.enable_sp`；昇腾 `FlashComm1` 在两版中对 `use_sequence_parallel_moe`（MoE + EP + `TP > 1`）均支持 `PP > 1` + SP，仅稠密 SP（`enable_dense_sp`）要求 `pp_size == 1`（超界告警并自动关闭）；第二，段间收发关闭 `tp_group` All-Gather 的条件在 `v0.30.0` 为 `enable_sp()`，到 `main (8d6180e2)` 收窄为 `self.use_v2_model_runner and enable_sp(self.vllm_config)`。
- **动态分块 CPP 的生命周期**：`v0.23.0` 挂在 `ascend_config.profiling_chunk_config`，`v0.26.0rc` 与 `v0.30.0` 迁至 `ascend_config.scheduler_config.profiling_chunk_config`（且 `v0.30.0` 支持在 `VLLM_USE_V2_MODEL_RUNNER=1` 下叠开 `async_scheduling`）；到了 `main (8d6180e2)`，`profiling_chunk_config` 与 CPP 调度器已被整体移除。
- **投机解码、KVPP、稀疏卸载与跨机 RoCE MoE 组合边界**：官方 PP 指南（含 `921ccc52` 与 `c09d3e20` / `8d6180e2`）明确，V2 runner 可将 PP 与 MTP 组合（草稿模型放在最后阶段，不计入目标隐藏层分段数）；`EAGLE3 + PP` 仅限 MiniMax-M3 sparse，`DFlash + PP` 不支持，`DSpark + PP` 须核对模型与特征抽取限制；`PP + KVPP` 虽可配 eager 或 `PIECEWISE`，但指南记录端到端测试仍有间歇性输出不一致在排查；稀疏 KV 卸载在 `sparse_kv_offload_config` 分支仍拒绝 `PP > 1`，经 layerwise connector 支持 PP 时还须区分 P/D 角色（D 侧限制见[稀疏卸载版本差异](kv-cache-sparse-offload.md#版本差异)）；跨节点 RoCE 的 MoE 路径在 `v0.30.0` 与 `main` 均暂不支持 `PP > 1` 与 `DP > 1` 同开 [S3][S36]。

下表汇总四版本基线（及 `09 旗舰异构模型全案` 历史绑定钉点 `db701c1f + 0fc695fc`）的核心核验矩阵：

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` **[主基线]** | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| **段间异步收发与 TP 切片拼接** | 等上次发送 → 非首段异步收 → 非末段异步发；整除 TP 时切片后 All-Gather，开 SP 关拼接 | 与 `v0.23.0` 相同（`worker.py#L662-L702`） | 新增 `AsyncIntermediateTensors`；非末段区分 MRV2（返 `None`）与 MRV1（透传 `kv_connector_output`）；`enable_sp()` 关拼接 | 延续 MRV2/MRV1 分流；关拼接条件收窄为 `use_v2_model_runner and enable_sp(vllm_config)` |
| **非末段 `PPMissingLayer` 削峰** | `make_layers` 非本段层与非末段 `lm_head` 置 `PPMissingLayer` | 同左 | 延续 `PPMissingLayer` 并在 `profile_run` 非末段跳过 `_dummy_sampler_run`，释放更大批预算 | 延续相同非末段削峰机制（`utils.py#L949-L1008`） |
| **上游 `max_concurrent_batches`** | `pp_size`（异步调度 + V2 runner 时 `pp_size + 1`） | 相同（`vllm.py#L512-L522`） | 相同（`vllm.py#L588-L604`） | 相同（`vllm.py#L615-L632`） |
| **上游 `SP + PP > 1` 注入 `+rms_norm` 与昇腾 SP** | 旧版编译 pass 形态；MoE+EP 支持 `PP>1`+SP | 过渡演进 | `PassConfig.enable_sp` 且 `PP > 1` 静默追加 `"+rms_norm"`（传 `"-rms_norm"` 则告警）；稠密 SP（`enable_dense_sp`）限 `PP=1`；MoE+EP 支持 `PP>1`+SP | **上游移除 `PassConfig.enable_sp`**（`compilation.py#L204-L237`）；稠密 SP（`enable_dense_sp`）限 `PP=1`；MoE+EP 支持 `PP>1`+SP |
| **动态切块 CPP（`profiling_chunk_config`）** | 挂在 `ascend_config` 下，要求 `PP > 1` | 迁入 `ascend_config.scheduler_config`，要求 `PP > 1` | 要求 `PP > 1`；新增 `async_scheduling` 须配 V2 runner 校验 | **已移除 `profiling_chunk_config` 与 CPP**（`platform.py#L1585-L1603`） |
| **Xlite / 稀疏卸载 / RoCE MoE / Mooncake** | Xlite 与 PP 互斥；尚无稀疏 KV offload | Xlite 互斥；新增 `sparse_kv_offload_config` 拒 `PP > 1` | Xlite 互斥（文案统一）；`sparse_kv_offload_config` 拒 `PP > 1`（layerwise 另计）；`MooncakeConnectorV1` 限 `PP_D == 1`；跨机 RoCE MoE 禁 `PP>1 × DP>1` | 同 `v0.30.0` 互斥与跨机 RoCE MoE / `PP_D == 1` 边界 |
| **历史绑定 GLM 分段算例（例外 B）** | 维护分支无 `glm5_next.py`；本页 45 层 `[23, 22]` 与 mHC 4 路交接固定取自 `db701c1f + 0fc695fc` | 同左 | 社区仓迁入 `models/glm5next/`；绑定算例继续锁定 `db701c1f` 单标尺 | 延续 `models/glm5next/`；绑定算例锁定 `db701c1f` |

### 源码位置

| 核查模块 | 固定源码锚点（主基线 `v0.30.0` 及跨版/GLM 对照） |
|---|---|
| PP 参数、设备账 `DP×PP×TP×PCP` 与 Elastic EP 互斥 | `vllm@ced6857a:vllm/config/parallel.py#L120-L132, #L888-L895`（`main`: `ba15685a:#L1070-L1074`） |
| 模型 `SupportsPP` 启动检查 | `vllm@ced6857a:vllm/config/model.py#L1435-L1444`（`v0.23.0`: `0fc695fc:#L1188-L1207`） |
| `get_pp_indices` 分段公式与 `VLLM_PP_LAYER_PARTITION` | `vllm@ced6857a:vllm/distributed/utils.py#L127-L173`（`main`: `ba15685a:#L211-L256`） |
| `PPMissingLayer`、`make_layers` 与非末段跳过 `lm_head`/采样 | `vllm@ced6857a:vllm/model_executor/models/utils.py#L826-L888`；`llama.py#L377-L401, #L502-L518`；`gpu_model_runner.py#L6524-L6535`；`vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4305-L4345` |
| 批队列深度 `max_concurrent_batches` 与 `SP+PP` `+rms_norm` | `vllm@ced6857a:vllm/config/vllm.py#L588-L604, #L1877-L1899`（`v0.26.0`: `568afb3a:#L512-L522`；`main`: `ba15685a:vllm.py#L615-L632`、`compilation.py#L204-L237`） |
| 张量字典元数据与 TP 切片点对点收发 | `vllm@ced6857a:vllm/distributed/parallel_state.py#L1067-L1205`（`v0.23.0`: `0fc695fc:#L912-L1013`） |
| Ascend `NPUWorker` 段间收发与 MRV2/MRV1 返回路径 | `vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L775-L843`（`v0.23.0`: `2c59ff10:#L620-L662`；`v0.26.0rc`: `2ed6cbba:#L662-L702`；`main`: `8d6180e2:#L903-L962`） |
| CPP、FlashComm1/SP、Xlite、稀疏卸载与 Mooncake `PP_D==1` | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L724-L780, #L1466-L1470, #L1740-L1744`、`utils.py#L1058`；`platform.py#L1075-L1085`（`main`: `8d6180e2:platform.py#L1585-L1603`）；`mooncake_connector.py#L2238-L2243` |
| GLM-5.3-Flash 45 层分段、mHC 四路交接与 `SupportsPP` | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2132-L2169, #L2212-L2241, #L2262-L2319, #L2437-L2462`；`worker.py#L607-L650` |

**来源与结论对应：**
- 跨节点 `mp` / `ray` 命令、首尾段调平、P/D 拓扑交接、投机解码/KVPP/layerwise 组合边界以及跨机 RoCE MoE 禁同开 `PP > 1` 与 `DP > 1` 见官方 PP 与 Ray 指南（来源 1–4、36）；由于 `platform.py` 与 `ascend_config.py` 未实现跨机 RoCE `PP×DP` 启动断言，误配后落入运行期故障属静态代码缺省推断 [I]。
- 8 层 4 卡教学矩阵 `[1, 0] → [9, 8]`、等时气泡网格（$25\%$ vs $81\%$）与慢段周期（$62.5\%$）为教学示意设定与算术推导 [A][D]；GLM 45 层 `[23, 22]` 切分与 mHC 四路 BF16 每 token `32 KiB`（4 行 `128 KiB`）按 `db701c1f` 模型实现 [C41] 与形状静态推出 [D]。

**待核：** 官方未给出 GLM-5.3-Flash 双机主线不选 PP 的取舍说明，本站亦未在双机 NPU 上实测 GLM 开启 PP 的链路流量与端到端吞吐；`PP + KVPP` 的间歇性输出不一致进展及跨节点 RoCE MoE 未来是否放开 `PP > 1 × DP > 1` 仍待上游后续版本确认。
