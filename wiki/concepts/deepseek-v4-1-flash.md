---
id: deepseek-v4-1-flash
title: DeepSeek-V4.1-Flash：长历史怎样少存、少重算
type: concept
origin: direct
summary: 同一份长文，哪些计算可以省、哪些历史必须留下？先用四层模型走一遍，再区分少存、少读和跨层共享，最后核对实际配置与缓存大小。
aliases:
  - DeepSeek V4.1 Flash
  - CED
  - Causal Encoder Decoder
  - CSA2
  - Hierarchical Sparse Indexer
  - DeepSeek 状态布局
  - DeepInfer 模型配置
  - V4.1-Flash
  - DeepSeek-V4.1
chapters:
  - '19'
order: 1
sources:
  - >-
    https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/config.json
  - 'https://arxiv.org/html/2609.19969v1'
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/hugging_face/config.py
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/worker/cache_engine.py
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/models/v4_modules/yoco.py
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/README.md
  - 'https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/tutorials/models/DeepSeek-V4.1-Flash.md'
  - 'https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/user_guide/support_matrix/supported_models.md'
  - 'https://github.com/vllm-project/vllm-ascend/blob/921ccc52c6d8c9864190b981792318a489aeadf4/docs/source/tutorials/models/GLM5.3-Flash.md'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/DeepSeek-V4.1-Flash.md#L1-L65'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/deepseek_v41/cache_config.py#L1-L50'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/DeepSeek-V4.1-Flash.md#L1-L65'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/deepseek_v41/decoder_replay_layers.py#L1-L35'
relations:
  - to: deepseek-serving-case
    kind: builds-on
    note: 生产页说明状态在服务间怎样移动，本页说明这些状态为什么不同
  - to: attention-cost
    kind: builds-on
    note: 回看历史长度怎样影响注意力的计算和读取成本
  - to: inference-performance-analysis
    kind: builds-on
    note: 后半输入截断的收益判断依赖设备耗时与请求关键路径的区分：局部计算变快后，仍须检查交接、排队和其他计算是否决定首字时间。
  - to: sparse-attention
    kind: builds-on
    note: CSA2 与两级稀疏索引器建立在通用稀疏注意力的筛选预算与重归一化机制上
  - to: mla
    kind: builds-on
    note: V4.1 单头 512 维全局 KV 压缩表示与 MLA 低秩压缩共享同一核心降存思路
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: I
contradicts: []
updated: '2026-11-03'
---

**DeepSeek-V4.1-Flash 是一个能读文字和图片、逐步生成文字的模型。它让语言模型的前半部分准备一份可供后半部分读取的长历史，因此读入长文时，后半部分可以少处理许多输入位置。** 要理解这件事，先看普通模型为什么会在每层保存历史，再看它改变了哪条依赖。

## 同一份长文，为什么每一层都要重新准备历史

假设用户让模型读一份说明书。文字先分成 **token**，即模型处理的编号，再变成向量。每层接收上一层的向量，进行计算，交给下一层。**attention** 是其中读取前文信息的步骤：当前位置用查询向量 Q 与历史的 K 比较，再按得到的权重汇总历史的 V。K、V 合起来就是这里说的历史表示。

普通逐层模型的第二层读到的是第一层加工后的向量，第三层又读到第二层加工后的向量。因此，各层的历史表示通常不同；不能把第一层的 KV 原样塞给所有层。**KV cache** 把每层已经算好的 K、V 存起来，让后续生成的新位置直接读取。它省掉的是下一步重复计算旧位置，首次读入这些位置时仍要逐层计算。

V4.1 的 **CED（Causal Encoder-Decoder）** 从模型结构上改变了后半层取得长历史的方式：前半输出先乘权重，生成后半共享的全局 KV。后半每层用自己的查询去读这份 KV，不必各自从全部旧位置重新生成一份长历史。下图把模型缩成四层，比较两条准备路径。

```wiki-diagram
file: deepseek-model-intuition
```

图中蓝色格子是保存下来的历史，绿色格子是这次真正经过该层计算的位置。两种模型都要理解前文，区别在于后半的长历史来自哪里。这是模型训练时就采用的结构，不能给普通模型临时跳过后两层来得到同样结果。

后半还有另一条读取近邻的路径：**SWA（sliding window attention）** 只读最近一段位置，使用各层自己的窗口状态。共享的全局 KV 不能代替这些窗口。因此，省算路径仍让末尾一段输入经过后半各层，准备窗口；截短输入得到的是**近似窗口**，可能改变数值和任务质量。[下一页](swa-bounded-replay.md#只回放三个位置究竟少看了什么)会用两层计算演示差异怎样产生。

CED 中的 encoder 和 decoder 分别指语言模型前后两半。图片则先经过独立的 Vision Encoder 变成特征，再进入语言模型；这两个 encoder 不是同一个部件。

这项设计发生在[一条请求的逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)阶段。它改变模型怎样生成和复用历史；P/D 分离则改变这些计算放在哪些服务上，两个概念可以配合使用。

## 少算的是什么，仍然要算的是什么

**Prefill** 是首次处理一段输入、准备历史的过程；**decode** 是利用历史继续生成的过程。沿图中的一个历史位置看：它走过前两层，得到向量，再乘投影权重得到后半要读的 KV。这份 KV 可以存下来，供后半多个层读取。后半不再需要为了取得这份全局历史，让该位置依次完成自己所有层的计算。

“投影”没有神秘之处，就是矩阵乘法。例如只演示一个 K 分量：前半输出向量为 (2,1)，投影权重的一列为 (3,−1)，该分量就是 2×3+1×(−1)=5。真实投影会同时得到许多分量；V 也按模型规定准备。这里的数仅说明“从已有向量生成历史表示”，不是模型权重。后半读取它的过程仍是查询、打分、汇总；共享历史也不意味着各层输出相同，因为各层查询和后续计算仍不同。

末尾位置还要经过后半来准备 SWA。进入 decode 后，每个新位置也仍然走完语言模型。省掉的范围因此很明确：**长提示词中、保留末尾之前的那些位置，不再做后半各层的完整前向。**

仍用前后各两层的教学模型，把图中的输入延长到 100 个位置，并让后半保留末尾 4 个位置。一次“一个位置经过一层”暂记为一份工作，另行忽略投影、选取历史和搬运开销。

| prefill 路径对比（示意：4 层模型，100 个输入位置，后半保留末尾 4 个位置） | 算式 | 层-位置工作量 |
| --- | --- | --- |
| 完整逐层处理 | $100 \times 4$ | **400 份** |
| CED 前半处理全部输入 | $100 \times 2$ | **200 份** |
| CED 后半只处理保留末尾 | $4 \times 2$ | **8 份** |
| **CED 两部分合计** | $200 + 8$ | **208 份** |

减少的是后半层上那些不再需要完整前向的输入位置，绝不是删掉模型后半层。这个计数也不等于运行时间减半：投影、窗口恢复、通信和低精度转换仍会花时间。短提示词若原本就落在保留区间，省下的工作更少。现场应同时看前后半层实际处理的位置数和耗时。

## 长历史还怎样减少存储和读取

CED 解释了后半的长历史从哪里来。接下来还有两笔成本：保存这些历史要占空间，每次使用它们又要读取数据。**CSA2（Compressed Sparse Attention 2）** 用压缩、稀疏选择和跨层复用减少这些成本，但三种做法省下的东西不同。

仍用六个历史位置作教学示意。先按模型规定把它们压成三个条目，给条目起名 A、B、C；每个条目都包含供 attention 使用的数值。这只是条目数量的示意，不把真实压缩计算简化成求平均。再假设当前查询只选中了 A、C，而相邻两层可以共享这份历史。

| 做了哪件事 | 保存的内容怎样变 | 这次读取怎样变 |
| --- | --- | --- |
| 压缩六个位置 | 历史用 A、B、C 三个条目表示 | 后续在压缩条目上选择和读取 |
| 稀疏选择 A、C | A、B、C 都还在，B 没被删除 | 本次只读取选中的 A、C |
| 让两层共享历史 | 两层各存一份，变成共同使用一份 A、B、C | 两层仍用自己的查询计算，结果可以不同 |

因此，下一次查询若选中 B，它仍然可以读到 B。看到“这次只读两个条目”，不能把缓存容量也按两个条目计算；看到“两层共享”，也不能以为第二层连查询和汇总都省掉了。前面的 CED 例子减少完整前向的输入位置，这里的三种做法分别改变历史表示、读取范围和保存份数。

那谁来决定读 A 还是 B？**索引器**先给候选历史打分，再选出要读取的条目。用于选择的索引 K，与随后读取的主 KV 是不同对象；执行一次索引计算，也不等于新保存了一整份主 KV。模型可以分别规定索引计算、索引 K 和主 KV 的共享范围，查容量时必须分开数。

后半层的 **Hierarchical Sparse Indexer** 把选择分成两级：先选较大的候选集合，再在这个集合内进一步筛选。它像先确定要查哪些章节，再挑具体段落；候选集合不是最终全部读取的内容，筛选本身也要计算并保存选择结果。一般的选择过程见[稀疏注意力](sparse-attention.md)；下面先算历史占多少，再核对真实模型怎样配置这些对象。

## 一块历史到底存多少，而不是“40 层乘一遍”

**Block KV** 按历史位置分页，**state cache** 则按请求保存固定窗口和运行中的中间态。固定实现里，主 KV 的一个条目占 288 字节，索引 K 占 68 字节；SWA 每位置占 528 字节。这些数字包含各自的低精度数值和缩放系数，具体格式见[低精度格式](low-precision-formats.md#deepseek-为什么几种缓存不用同一种-fp4)。

固定模型有四个主 KV 来源，其余需要全局历史的层按配置复用它们，不能按模型的 40 层各算一份。考虑 128 个原始历史位置这一块：前三个来源采用压缩率 2，每个产生 64 条；后半的来源采用压缩率 1，产生 128 条。以下只算这四份分页主 KV 和索引 K 的载荷，假设该块完整、不计分配对齐。

$$\text{单块分页载荷} = \left(3 \times \frac{128}{2} + 128\right) \times (288 + 68)\text{ B} = 320 \times 356\text{ B} = 113{,}920\text{ B}$$

| 一块 128 位置完整历史的分页载荷（固定布局推导，不含对齐与状态缓存） | 算式 | 结果 |
| --- | --- | --- |
| 每条主 KV 加索引 K 字节 | $288 + 68$ | **356 B** |
| 前三个压缩来源（压缩率 2）条目数 | $3 \times (128 \div 2)$ | **192 条** |
| 第四个后半来源（压缩率 1）条目数 | $1 \times 128$ | **128 条** |
| **本块分页载荷合计** | $(192 + 128) \times 356\text{ B}$ | **113,920 B**（约 890 B/原始位置） |

这还没算 SWA、压缩中间态、草稿状态、块表和空闲预留。**压缩中间态**保存尚未凑齐一个压缩分组时的累积结果；**环形缓冲**循环使用固定数量的位置保存最近窗口，另外还要留出推测回退的空间。[KV cache spec](kv-cache-spec.md)解释为何不同类型不能用一条“每层固定字节数”公式包办。

生产系统只把可复用的前半 SWA 部分保存到主机内存；后半窗口重建后用于当前 decode。运行时丢弃区仍可能在显存里占空间，“不进入持久存储”不等于“不分配”。状态的机器位置与跨服务传递继续见[生产实践](deepseek-serving-case.md#再追问一句哪些历史能找回哪些还得准备)。

## 固定配置里，哪些数字属于哪一部分

现在对照公开的 V4.1-Flash-1017 配置。先看下面这张异构层栈与三笔内存账全景，把 40 层 CED 语言主干、4 个全局 KV 来源层、384+1 MoE、3 层 DSpark 与主机侧 INT8 Engram 对上号，再核对逐项配置表：

```wiki-diagram
file: deepseek-v4-1-flash-fig-layer-stack
```

层号采用源码的**从 0 开始**计数；例如来源层 2 是读者数到的第 3 层。query 是当前位置用来查询历史的向量，多头让它从多个角度查询。

| 历史相关部件 | 配置与作用 |
| --- | --- |
| attention | 64 个 query 头，共享 KV 头数为 1；每条 KV 表示 512 项，含 64 项位置编码分量 |
| 历史压缩 | 前两层只用 SWA；其余前半层使用压缩率 2，后半层使用压缩率 1 |
| 主 KV 来源 | 层 2、8、14、20；其他使用全局历史的层映射到不晚于自己的最近来源层 |
| 索引 | query 头数 32、每头 128 维，最终选择上限 512；索引模块来源为 2、8、14、20、24、28、32、36，索引 K 的来源默认跟随主 KV 来源 |
| 后半候选池 | 来源层 20，最多 2048 个候选块、每块 8 个位置；候选池还不是最终读入的 512 个条目 |
| SWA | 窗口 128；窗口之外的历史仍可通过全局注意力访问 |

例如，源码层号 9 使用来源层 8 的主 KV，层号 25 使用来源层 20 的主 KV。虽然索引模块的来源还包括 24、28 等层，也不能据此把主 KV 多算几份。前面的分页账只按四个主 KV 来源计算；各层的 SWA 窗口仍需另记。

其他配置说明计算经过哪些部件。**MoE** 把一层的部分计算交给若干专家网络，由路由器为每个位置挑选专家；图片的 **patch** 是切分后送入视觉模型的小图块。它们影响工作量，但不是上表的历史条目数。

| 计算部件 | 配置与作用 |
| --- | --- |
| 语言主干 | 40 层，前后各 20 层；隐藏向量 5120 维，即每个位置在层间传递的一排数有 5120 项 |
| MoE | 每层一个共享专家和 384 个可选专家；每个位置选中其中 6 个，再加共享专家的计算 |
| 草稿模块 | 另有 3 个 [DSpark](dspark.md) 层（DeepSeek 用于投机解码的多 token 预测草稿模块），一次提出 5 个候选；不计入前述 40 层主干 |
| 图片路径 | Vision Encoder 32 层、隐藏宽度 1024、patch 边长 14；特征经过空间降采样和投影进入语言主干 |

模型还含 **[Engram 条件记忆](engram-conditional-memory.md)**，即按短 token 组合查询的条件记忆表；以及 **[mHC](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)**，即在多条残差信息流之间混合和传递中间结果的结构。它们不等于请求的 KV cache。参数文件大小、单次激活的参数量、每请求历史状态大小因此是三笔不同的账，不能用其中一个替代另外两个。

## Engram 为什么把另一笔内存账放到主机上？

**[Engram](engram-conditional-memory.md) 是模型学到的条件记忆表：根据短 token 组合查找已有条目，把查得的表示用于当前计算。** 可以把它想成模型自带的短语索引。例如当前短组合是 A、B，查表得到向量 e，再把 e 用于当前层的处理；换成 A、C，就可能查到不同条目。这只是查表流程的示意，真实索引和融合按模型定义执行，不是把文本直接映射成最终回答。关于 N-gram 哈希映射、Host DRAM ACL 钉页直读与跨实例 MemFabric / HIXL 共享池的完整机制，见 [Engram 条件记忆专页](engram-conditional-memory.md)。

这张表属于模型参数，加载后可被多条请求读取。KV cache 则是某条请求处理到当前位置形成的历史，随输入和生成过程变化。两者都可能占主机内存，但内容、生命周期和传输目的不同：把 Engram 放到 CPU，不会顺便把请求的 KV cache 全部搬到 CPU，也不会免去 NPU 上其余权重和算子的显存。

Ascend 的 A3 教程选择把 INT8 Engram 表留在主机内存，再让**同一主机上的 DP rank（[数据并行](data-parallel.md) 中的单个独立副本编号）共享这份分配**。共享省的是重复的主机副本。例如 4 个本地 DP rank 若各需同一份大小为 E 的表，重复保存是 4E；共享这份表后是 E，少掉 3E。这个示意只算相同表的载荷，实际预算还包括索引、对齐、暂存与传输缓冲，也不能把“每台一份”误写成“整个 P/D 集群一份”。

这里还有硬件布局限制。官方 A3 示例暴露 16 个逻辑设备，而模型有 24 个 Engram 头；24÷16=1.5，无法按该设备路径均分，因此教程要求主机卸载与本地 DP 共享同时开启。它不是一个可随意关闭的纯性能建议。A2、A3 的分片条件和容器拓扑分别核对，不能只看 TP2 或 TP4 能整除 24 就认定 A3 的 16 设备路径可用。

代价是主机容量、查表与主机到设备的数据供应。减少显存占用后，要确认主机没有因其他模型权重、KV pool 和 Engram 叠加而超预算；多个 DP rank 共享内存也不代表传输带宽和计算需求合并为一份。容器还必须看见共同的主机 IPC 命名空间（Linux 用于隔离进程间共享内存的命名空间，传 `--ipc=host` 让同机容器共用宿主机 `/dev/shm`），才能共享分配；具体选项在页末。

## Ascend 上的 1P1D 究竟用了多少设备？

**1P1D 首先数的是一组 prefill 服务和一组 decode 服务。每组有多少机器、多少 DP 引擎、每个引擎多少设备，要继续展开。** 以下是 2026-11-02 官方教程快照的 A3 配置，不是前文 DeepInfer 的执行设置，也不是本站旧 GLM 双机案例。

| 服务布局 | 服务器 | DP 与 TP | 逻辑设备账 |
| --- | --- | --- | --- |
| P/D 共置 | 1 台 A3 | DP4 × TP4 | 4×4=16 |
| 1P1D 的 P 组 | 1 台 A3 | DP4 × TP4 | 4×4=16 |
| 1P1D 的 D 组 | 另 1 台 A3 | DP8 × TP2 | 8×2=16 |

因此，这个 1P1D 合计是 **2 台 A3、32 个逻辑设备、4 个 P 引擎和 8 个 D 引擎**。每台为 8 张 128 GB 物理 NPU，对容器呈现 16 个 64 GB 逻辑设备；两种口径描述同一套硬件，容量不能重复相加。单机共置一行是另一种部署，不计入后两行之和。

即使两个模型都写“1P1D”，内部并行也不相同：同快照的 GLM-5.3-Flash A3 示例是 P 侧 DP2/TP8、D 侧 DP4/TP4，仍各占 16 个逻辑设备。DeepSeek 用更小的 TP 安排更多 DP 引擎，并不意味着这些引擎与另一个模型的引擎等价，也不证明吞吐或时延更好。比较资源是否“更少”，须同时对齐权重量化、Engram 放置、上下文长度、并发、图和草稿设置，以及首字与逐字时延目标。

相同 DeepSeek 教程的 A2 1P1D 则需要 4 台服务器：P 组跨两台、D 组跨两台。服务器数、逻辑设备数、物理卡内存和主机内存是不同账目。PP 如何跨机器组织，以及为什么节点编号不能直接当 PP rank，见 [PP 的多机解释](pipeline-parallel.md#两台机器怎样加入同一条流水线)。

## 从业者怎样判断自己有没有走到这些优化

先分清这次要解释的是**长输入处理得慢，还是运行时占的内存多**。留住输入编号、模型文件与执行配置作为比较基线，然后沿对应的一条路查。两类问题需要的第一份记录不同。

```wiki-diagram
file: deepseek-model-flow
```

图中的三处观察点分别回答：加载的是不是预期模型、共享关系是否按配置建立、执行时是否真的缩短后半输入。只看到模型名称或打开一个环境变量，都不能替代后两个检查。

### 占用比预想大，先查多出来的是哪一笔

先把同一运行阶段的占用拆成三笔：**共享的长历史（分页 Block KV）、每条请求自己的状态（State Cache）、其他运行内存**。多个模型层可以共用一份长历史，而每条请求仍要记住自己最近读过的内容以及继续生成所需的临时进度，跨层共享不等于把不同请求的运行状态合成一份；其他运行内存还包括权重与执行时临时使用的空间。

1. **先对齐“逻辑存量”与“物理分配量”**：当前真的存了多少内容，与已经分配了多少空间要分别看。例如池子预先留出了空位，后来请求把空位填上并不一定再次申请显存；是否预分配取决于具体实现，需查实际分配记录（定义见[逻辑容量与分配容量](attention-cost.md)）。
2. **只沿着增大的那一笔下钻**：
   - 若分页长历史没变、每请求状态增加：先核活跃请求数与每条请求保留的窗口槽位；差额仍无法解释时，再细查**压缩中间态**（一组历史尚未压好时保留的累积数据）与**草稿回退空间**（提前猜测后续输出、猜错后恢复所需的空间）。
   - 若有效内容没变、分配容量却增加：先核页对齐与空闲预留。
   - 只有差额指向长历史被多存了，才继续查主 KV、索引 K 各自的来源映射和实际分配，避免把多个别名重复计数；索引计算是否复用是另一项检查，不能用它的模块数量代替缓存份数。

这样可以先回答“差额在哪一类”，再进入页末列出的缓存对象和源码入口。若尚无分项记录，结论就停在“总量还不能说明共享是否失效”，下一步补分项占用，不必同时转储每层全部数值。

### 长输入仍然慢，先看后半实际处理了多少位置

仍用 100 个位置的教学模型，在进入前半、跨到后半边界、调用后半层时各记一次“请求、阶段、原位置范围、实际行数”。一组能支持截断生效的记录是：前半位置 0–99 共 100 行，后半位置 96–99 共 4 行，而且后半仍能读取覆盖长历史的共享 KV。若后半仍有 100 行，先查执行模式；若只有 4 行却把原位置记成 0–3，先查位置映射，不能直接宣布优化成功。这是建议整理的诊断记录，并非框架自带日志格式；源码区的边界函数是取证位置。

行数减少后，再比较设备耗时与请求首字时间。后半设备时间下降、首字时间却不变，说明还要找交接、排队或其他计算；不能继续把同一个截断参数调得更激进来补偿另一段等待。

性能对照应保持相同输入和输出目标，把 prefill 与 decode 分别测量；正确性则沿[首次分歧](inference-correctness-troubleshooting.md)比较相同前缀下的数值和结果。若差异随缓存命中位置改变，接着查[有界回放](swa-bounded-replay.md)，不要立刻把全部差异归给量化。

## 放回 GLM 双机，哪些知识可以共用

本站[固定 GLM 部署](glm-5-3-flash-two-node.md#部署前提)仍是 TP8/DP2/EP16、W8A8，两机共同持有完整专家。可以共用“计算、状态、传输分开记账”的分析方法；模型结构、共享来源层、缓存字节数和草稿配置必须取自各自模型页。

GLM 主线的 KDA、稀疏 MLA 及 MTP，不能直接替换成这里的 CED、CSA2 和 DSpark。对照时先问“当前优化省了哪一段工作”，再问本模型有没有对应的结构条件。

## 常见误解

- **“后半层不算了。”** 大部分提示词免去完整后半前向；窗口准备和新 token 的完整生成仍然存在。
- **“40 层就有 40 份独立长历史。”** 要按实际来源与共享映射算；SWA 等逐层状态另记。
- **“窗口以外的内容都忘了。”** SWA 负责近邻，压缩全局历史负责较远的信息。
- **“模型支持百万上下文，就能按任意并发部署。”** 配置上限不提供显存预算或延迟保证。

## 对照源码

### 怎么开

使用与 DeepInfer 固定快照兼容的 V4.1 HF checkpoint，模型配置与 tokenizer 必须配套。CED 与共享来源是模型结构；后半输入是否实际截断另由 YoCo（You Only Cache Once，CED 后半层共享全局 KV 时的截断执行路径）执行设置决定，入口与检查步骤见[有界回放](swa-bounded-replay.md#怎么开)。

**Ascend A3 是另一套入口。** 官方示例使用 W8A8 权重、INT8 Engram、Model Runner V1（`VLLM_USE_V2_MODEL_RUNNER=0`）和 EP。共置使用 DP4/TP4；P/D 脚本另外配置每轮 5 个候选的 DSpark，并使用上表拓扑与 `MooncakeHybridConnector`，P 开启 prefix caching，D 关闭并使用 recompute 抢占。完整环境、通信检查、代理和启动脚本应连同[官方模型教程 §3–5](https://docs.vllm.ai/projects/ascend/en/latest/tutorials/models/DeepSeek-V4.1-Flash.html)一起使用，不把下面两行当完整服务命令。

```bash
# A3 容器创建参数：让本地 DP 进程共享主机 IPC 命名空间
--ipc=host
# vllm serve 的模型选项：卸载 Engram，并共享本地主机分配
--engram-config '{"cpu_offload":true,"dp_shared_memory":true}'
```

参数是双横线 `--engram-config`。`cpu_offload` 决定表留在主机，`dp_shared_memory` 决定本地 DP rank 是否复用分配；二者含义不同，IPC 选项也不代替它们。先核容器、可见设备、主机内存与配置，再核每个 rank 的加载和分配结果。

加 KV Cache Pool 时，CED 跨层共享布局不支持该教程的逐层保存、加载路径，**P 和 D 都须保持 `use_layerwise=false`**。使用教程给出的 MultiConnector 组合把 P/D 交接与池访问一起配置，不能看到“支持 KV pool”就套通用 layerwise 样例。

### 会报什么错

配置加载器会拒绝不支持的模型架构，以及不符合约束的 `dtype`、KV 头数、量化方法和缩放布局。出现 `Unsupported HF` 一类错误时，对照具体字段与加载器约束，不要只改文件里的名称使检查通过。

Ascend 的 Engram 分配失败先核 24 个头与可见设备分组、卸载和共享选项；本地多个 rank 出现重复主机占用时，核 IPC 命名空间和实际共享情况。P/D 能启动但首请求交接失败时，先对齐两侧连接器及 DP/TP 拓扑；不能用“模型已加载”代替 P/D 验证。

### 开销和什么时候别开

共享历史减少存储，但仍有索引、投影、窗口恢复与元数据成本。短输入和低缓存命中场景应单独测量；有界回放的数值容忍条件由下一页说明。

### 版本差异

本页结构定义与分页字节账以 DeepInfer `774ce244` + HF 模型配置 `1bae0e10` 为固定基线；历史 A3/V1 教程案例对照 `921ccc52` 快照（该快照的支持矩阵仍将 PD 标为不支持，而同快照模型教程已给出 A3/A2 PD 命令，且 A5/V2 测试与 A3/V1 说明并存，不能把 A5/V2 支持范围外推给 A3/V1）。[S7][S8]

在社区四版正式分支上核验结果如下：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| V4.1 模型代码目录 | 仅含 `deepseek_v4.py` / `mtp`，无 `models/deepseek_v41/` | 仅含 `deepseek_v4.py` / `dspark` / `mtp`，无 `models/deepseek_v41/` | 完整合入 `models/deepseek_v41/`（`cache_config.py`、`compressor.py`、`dspark.py`、`engram/`、`indexer.py`、`mixed_quant_attention.py`、`model.py`、`vision.py`、`vl_model.py`）[C11] | 延续 `models/deepseek_v41/`，新增 `decoder_replay_layers.py`（`AscendDecoderReplayLayers`）、`decoder_replay_state.py`、`engram_lifecycle.py` 与 `engram/shared_{host,pool,rdma}.py` [C13] |
| 官方模型教程与硬件配方 | 无 V4.1 教程 | 无 V4.1 教程 | `DeepSeek-V4.1-Flash.md` 以 `v0.30.0` 为验证基线：A3 用 W8A8 + INT8 Engram + Model Runner V1（共置 DP4/TP4；PD 为 P DP4/TP4 + D DP8/TP2）；950DT 用 MXFP + Model Runner V2（DP8/TP1/EP8）[S10] | A2 / A3 / 950DT 全部统一至 **Model Runner V2**；A3 升级为 W4A8 + Prefill `DP4/PCP4/TP1` + Decode `DP16/TP1` + SWA bounded replay + MegaMoE，可选 Memcache 池化 [S12] |
| Engram 卸载与共享 | 不适用 | 不适用 | 支持机内 CPU offload + `dp_shared_memory`（详见 [Engram 条件记忆](engram-conditional-memory.md)） | 扩展跨实例 Shared Engram（Host / Pool / RDMA 共享路径） |
| 与 DeepInfer `774ce244` 的关系 | 仅作架构概念参照，不可混套配置 | 同左 | 共享层映射与 890 B/token 全局 KV 口径同源；A5 打包缓存由 `cache_config.py#uses_a5_packed_cache` 按 `HardwareProfile` 分派 | 同 `v0.30.0`，并在 MRV2 下独立封装 decoder replay 层与状态管理 |

### 源码位置

- 固定配置中的主干、共享来源、MoE、视觉和草稿字段 [S1]；CED、CSA2、Engram、mHC 的结构与动机见报告 §2 [S2]。
- 配置加载与最近来源层映射：`load_hf_model_config`、`_source_map`、`_shared_layer_cfg` [C3]。
- 分页缓存、SWA、压缩中间态、存储区与运行时区：`KVCache`、`StateBlock`、共享层映射 [C4]；`v0.30.0` 昇腾侧缓存规格见 `vllm_ascend/models/deepseek_v41/cache_config.py#L1-L50`（来源 11）。
- 后半层判断与输入收紧：`is_yoco_consumer_layer`、`compact_yoco_boundary` [C5]；`main` 昇腾侧 MRV2 回放层见 `vllm_ascend/models/deepseek_v41/decoder_replay_layers.py#L1-L35`（来源 13）；公开支持硬件和服务边界见 README [S6]。
- 100 个位置的四层模型是教学假设 [A]；113,920 B 是固定布局的分页载荷推导 [D]，不是单请求总显存。
- Ascend Engram 放置、IPC、物理与逻辑设备、DP/TP、连接器、runner 和 CED 的 KV pool 限制见固定官方模型教程 §3–5、§11–12（来源 7）及 `v0.30.0` / `main` 教程（来源 10、12）；支持矩阵范围说明见来源 8；GLM A3 对照来自同快照的 GLM-5.3-Flash 教程 [S9]。4E→E 与设备乘法是明确条件下的推导 [D]；本轮未执行 NPU 部署或性能测量。
