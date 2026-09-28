---
id: embedding
title: "Embedding：按编号查表取出 token 的向量"
type: concept
summary: Embedding 按 token 编号从训练好的权重表里取出一行数字，只有查表没有乘法。GLM 的表是 [154880, 4096]；TP8 把它按行切成 8 份，每卡查自己那 19360 行、其余位置填 0，再用 All-Reduce 得到完整的 [4, 4096]。
aliases: [embedding, 词向量, 词嵌入, 嵌入向量, 嵌入层, embedding 表, 词嵌入表, embedding lookup]
chapters: ["01"]
order: 30
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2268
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2300-L2305
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2469-L2470
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2450-L2460
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L77-L78
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L163-L187
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L477-L497
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L164-L168
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L748-L748
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L881-L883
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L513-L513
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L152-L161
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L170-L181
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248
  - vllm-ascend@baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py#L254-L285
  - vllm@84030bbe:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L555
  - vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L84-L95
  - vllm@568afb3a:vllm/model_executor/layers/vocab_parallel_embedding.py#L472-L492
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L879-L880
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L841-L842
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L933-L934
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/register_custom_ops.py#L72-L90
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L75-L75
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: token
    kind: builds-on
    note: 分词得到 token 编号，embedding 用这些编号选择输入向量
  - to: tensor-parallel
    kind: builds-on
    note: 嵌入表按词表轴切分、入口求和的规则以 TP 页为准，本页只讲入口这一次
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 编号不能直接参与计算，模型拿什么算？

**Embedding 是按 token 编号到一张权重表里取出一行数字，作为这个 token 进入模型的第一份表示；整个过程只有查表，没有乘法。**

[分词](token.md)交给模型的是一串编号，编号只是词表里的座位号。8 和 9 挨着，不代表两个单元的意思接近；312 比 8 大，也不代表它更重要；拿编号做加减乘除得不到任何有意义的结果。而模型从头到尾做的是乘法和加法，所以入口必须先把编号换成一串能参与计算、算出来也有意义的数字。

```wiki-diagram
file: embedding.yaml
```

表的每一行对应一个编号：第 0 行给 0 号，第 312 行给 312 号。行数由词表大小决定，其中既有普通的词和子词，也有特殊标记和分词器从不产出的预留行，这三段的构成在[编号要落在 154880 行之内](token.md#编号要落在-154880-行之内)。拿到编号只做一件事：找到那一行，整行抄出来。

表里的数字不是人填的，是训练时调出来的权重。固定模型做普通推理时只读这张表，不再改动它。

## 为什么值得为此常驻一张大表？

**编号只标记「它是谁」，一串可学习的数字才给后面的层留下调整表示的空间；代价是这张表成为模型权重里单块最大的表之一。** 训练让这些数字带上对任务有用的统计关系，推理时每个 token 都从这里起步。

每行有多少个数字由模型定死，叫 hidden size（隐藏维度，每个位置用多少个数表示）。token 带着这个宽度从第 1 层走到最后一层，层与层的交界处宽度不变；层内部的投影和专家中间结果可以是别的宽度。把本轮取出的行摞起来就是 `[S, H]`：S 是这一步处理几个 token，H 是每个 token 几个数。这是隐藏向量的起点，decode 每步只送 1 个新 token，也要先查一次表得到 `[1, H]`。

表的形状可以写成 `[V, H]`：V 是词表大小，决定有多少行；H 是 hidden size，决定每行多少个数。编号 t 取的就是第 t 行。后面每一层都拿这些向量做矩阵乘、再和同一序列里的其他位置交互，把它改写成新的表示，所以入口这一行数字是全部后续计算的起点。

代价先看规模。GLM 的文本配置给出词表 154880、hidden size 4096：

```calc
title: 一张表有多大
标量个数 = 154880 × 4096 = 634388480
按每数 2 字节估算的未分片载荷 = 634388480 × 2 B = 1268776960 B ≈ 1.18 GiB
```

这是整张表的逻辑规模，不含词表补齐和额外缓冲，也不是某一张卡上的分片大小——TP 下每张卡只存其中一段，下一节给数。

还有一类代价是这些数字本身不承诺什么：它不保证「猫」和「狗」的行在输入表里最近，不保证两行相加减能得到指定的词，每一维也没有预先指定的人类含义。这些性质要靠后面各层的计算和训练目标来体现，不是查表这一步给的。

## 放到 GLM 双机：8 张卡怎么查同一张表？

**表的逻辑形状是 `[154880, 4096]`，TP8 把它按行切成 8 份，每张卡只查自己那 19360 行；查不到的位置填 0，再用 [All-Reduce](collective-communication.md#all-reduce) 把 8 份结果加起来，每张卡就都有了完整向量。** [GLM 双机部署](glm-5-3-flash-two-node.md)是 2×A2×8 共 16 张卡、TP8 与 DP2，切表和求和发生在每个 TP8 组的 8 张卡之间。

切法是行切：每张卡负责一段连续的编号区间。入口时本轮的每个编号都发给 8 张卡，只有区间覆盖该编号的那张卡查到真正的行，其余 7 张卡把这一位置整行置零。8 份相加，非零的那一份就是答案，所以求和不会算错。切开的是权重表，输入的编号在每张卡上是同一份。这套「入口求和、出口拼接」的分工以[张量并行](tensor-parallel.md#词表入口求和出口拼接)页为准。

入口用 All-Reduce 有一个前提：本部署没有打开 [FlashComm1](sequence-parallel.md)。它是 Ascend 的序列并行开关，默认关，GLM 双机的启动命令也没有另外打开。在 v0.23、v0.26 里打开它，同一个入口归约会改走 [Reduce-Scatter](collective-communication.md#reduce-scatter)，每张卡只拿到一段 token 的完整向量；main 则不论开关都固定为 All-Reduce，见下文版本差异。

表里的数按 BF16 存，BF16 是每个数占 2 字节的 16 位浮点格式。部署虽然是 W8A8，8 位只用在一部分矩阵乘的权重上；embedding 表建层时就没有接量化配置，仍按 BF16 加载，所以下面每个数按 2 B 算。哪些矩阵是 8 位、哪些保持 BF16，见[量化](quantization.md#哪些矩阵是-8-位哪些保持-bf16)。

```calc
title: TP8 下每张卡摊到多少
每卡行数 = 154880 ÷ 8 = 19360
词表补齐 = 154880 mod 64 = 0，无需补行
每卡权重（BF16） = 19360 × 4096 × 2 B = 158597120 B = 151.25 MiB
R1 入口一次 All-Reduce 的载荷 = 4 × 4096 × 2 B = 32768 B
```

沿用单请求主线里 R1 的 4 个输入位置，把查到的行按输入顺序排好，就得到本轮的输入张量：

```wiki-diagram
file: embedding-lookup
```

图中第一个和第四个位置用的是同一个编号 8，在固定权重下取出的初始向量完全相同。它们仍是序列里的两个不同位置，进入后续层后各自的上下文和位置参与计算，隐藏表示随之分开。

这里的「行」对应本轮处理的 token 位置，不对应请求。[多请求并发](concurrent-requests.md)时同样的 4 行来自 A 的 1 个位置加 C 的 3 个位置，请求归属由序列边界和状态映射另行维护。三个形状容易混，分开记：

| 对象 | GLM 文本路径的形状 | 含义 |
|---|---|---|
| 嵌入权重（逻辑整表） | `[154880, 4096]` | 为每个词表编号提供初始向量 |
| 每张卡的分片 | `[19360, 4096]` | TP8 下本卡实际持有的那一段 |
| 本轮 4 个输入的向量 | `[4, 4096]` | 按本轮编号取出并求和后的结果 |

嵌入表属于模型权重，生命周期是整个服务；取出的向量属于本轮输入，随编号和批次变化，下一步就被后面的层改写。

4096 只是入口的宽度。进入 GLM 的 mHC 残差结构后，每个位置维护四路表示，子层计算前再组合成一个 4096 维向量，这些连接在[模型单层图](glm-5-3-flash.md)展开；本页的二维张量描述的是模型入口。出口那一侧的 lm_head 把隐藏表示变成词表分数，它是另一份独立权重，不与嵌入表共享——GLM 的配置把 `tie_word_embeddings` 写成 false。接着读[矩阵乘与权重](matmul-and-weights.md)，看取出来的向量怎样被投影成新的表示。

## 常见误解

- **「编号相近，意思就相近；编号能做算术。」** 编号只是座位号，相邻只说明索引相邻。含义的远近由训练出的那一行数字体现，不由编号大小体现。
- **「embedding 是一次矩阵乘。」** 数学上它等价于 one-hot 向量乘权重表，但实现按行号直接取行，入口没有乘法开销。TP8 下多出来的是一次通信，仍然不是乘法。
- **「切成 8 份后每张卡只查到一段，结果就是不完整的。」** 每张卡把不属于自己的位置整行置零，All-Reduce 求和后 8 张卡拿到的都是完整向量。
- **「`[154880, 4096]` 就是某张卡上的分片大小。」** 这是逻辑整表；TP8 下每张卡持有 19360 行，1.18 GiB 不是单卡占用。
- **「embedding 和 lm_head 都带词表维度，应该算同一份权重。」** 两者一个做「编号到向量」，一个做「隐藏表示到词表分数」；本模型没有共享权重，容量要各算一份。
- **「同一个词在一句话里出现两次，模型看到的表示就一样。」** 入口取出的初始向量相同，后面每一层都把位置和上下文算进去，同词不同位的表示会分开。
- **「decode 每步只生成一个 token，不用再查表。」** 每步的新 token 也要先查一次表得到 `[1, 4096]`，历史位置的表示另由状态保存。

## 对照源码

### 怎么开

文本模型的入口层不需要额外开关：固定 GLM 实现直接用配置里的 `vocab_size` 和 `hidden_size` 建一个 `VocabParallelEmbedding`，TP 大于 1 时它自己负责切行、置零和归约。[C2] 这里没有传量化配置，所以 W8A8 部署下这张表仍走不量化的查表实现，每个数 2 B。Ascend 侧在注册表里把这个类替换成 `AscendVocabParallelEmbedding`，所以实际跑的是 Ascend 版本。[C11]

需要显式打开的是另一件事：细粒度的 embedding tensor parallel。`embedding_tensor_parallel_size` 默认 0，对应的开关判定为假，走的是与上游同形的 `_forward_origin`。[C12][C13] 把它设成大于 0 才切换到专用的 embed-TP 路径。

另有一条绕过查表的入口：模型 `forward` 收到已经准备好的 `inputs_embeds` 时直接使用传入的表示，不再按编号查表；多模态和外部提供向量的调用走这条路。[C3]

### 会报什么错

- `embedding_tp static capacity {capacity} < num_tokens {n}`：ValueError，只在 embed-TP 路径出现。这条路径按启动时算好的静态容量分配交换缓冲，本步 token 数超过容量就直接失败，提示里也写了要调大哪两个上限。[C15]
- `oproj_tensor_parallel_size / embedding_tensor_parallel_size require recompute_scheduler_enable=true`：AssertionError，启动期抛出。细粒度 TP 的跨 DP 集合操作要求各 DP rank 的 token 数一致，只有 recompute scheduler 保证这点。[C14]
- 编号越界不在这一层报错。区间之外的编号会被当成「不属于本卡」，8 张卡都置零，求和结果是一条全 0 向量而不是异常；上界检查在入口的输入处理阶段完成，见 [token 页的报错清单](token.md#会报什么错)。[C7]

### 开销和什么时候别开

查表本身是显存读取，不是乘法，入口的开销主要是两笔：常驻权重按 TP8 每卡 151.25 MiB，以及每次前向一次 All-Reduce，R1 的载荷是 32768 B。[D] 前一笔和 batch 无关，后一笔随本步 token 数线性增长。[D]

归约走的是 Ascend 封装的归约算子：FlashComm1 关着时它就是一次张量并行 All-Reduce；v0.23、v0.26 打开 FlashComm1 后，它先把 token 数补齐，再做 Reduce-Scatter，每张卡只留一段 token。[C20] FlashComm1 由环境变量控制，默认 0；GLM 双机没有改它，所以本部署走的是 All-Reduce。[C26] main 不再经过这个算子，固定发 All-Reduce，注释给出的理由是：第一层期望拿到完整的 token 序列，序列并行要到该层注意力输出之后才开始，在入口换成 reduce-scatter 会让每张卡只剩一段 token。

细粒度 embedding TP 默认关着，它要求同时打开 recompute scheduler，并且吃一个静态容量上限。除了确有需要的大词表场景，保持默认即可。

### 版本差异

核对的是 Ascend 侧的嵌入入口与上游通用层。GLM 双机的数字固定在执行侧 `db701c1f`、控制流 `0fc695fc`；下表的 main 是仓库约定的固定提交，不是浮动分支。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad | 对使用者意味着什么 |
| --- | --- | --- | --- | --- |
| 行切 + 置零 + 归约三步 | 有 | 有 | 有 | 三版查表语义一致，切法和求和不变 |
| 归约调用 | `maybe_pad_and_reduce`[C16] | 同 v0.23[C17] | 换成按 TP 组调用的 all-reduce，并在注释里写明入口不能改成 reduce-scatter[C18] | 升级后入口仍是一次 All-Reduce，载荷算法不变 |
| 打开 FlashComm1 时的入口通信 | 改成补齐后 Reduce-Scatter | 同 v0.23[C25] | 仍是 All-Reduce，开关不影响入口 | 两个旧版上开 FlashComm1 会改变入口通信量，main 不会 |
| 细粒度 embedding TP 开关 | 默认 0[C22] | 默认 0[C23] | 默认 0[C24] | 默认都走与上游同形的路径 |
| 上游通用层 | 掩码取行后置零再归约[C8] | 同形[C21] | 多出融合查表算子与 FP8 按 int8 求和的分支[C19] | 上游新增的是实现路径，取行语义没变 |

三版的差异集中在归约怎么发和上游有没有融合算子，形状、切法与每卡行数都不随版本变化。[D]

### 源码位置

阅读顺序：`models/glm5_next.py` 建 `embed_tokens`，同一文件的 `embed_input_ids` 让外部用同一张表查向量；[C4] 再看 `ops/vocab_parallel_embedding.py` 的 `forward` 按开关分派；[C9] 最后是上游 `layers/vocab_parallel_embedding.py`，单卡的普通查表就是一次 `F.embedding`，多卡才加掩码与归约。[C6] 出口一侧的 `lm_head` 在同一个模型文件里单独建表。[C5]

数值出处：154880、4096 与 `tie_word_embeddings` 为 false 来自固定 revision 的模型配置；[S1] 19360 行、151.25 MiB、32768 B 和 1.18 GiB 由这些形状与精度推导；[D] 首图的编号 312 和第二张图的 `[8, 9, 312, 8]` 是教学假设，与任何实际提示词无关，格子数也只画部分维度。[A]

待核：专用镜像内最终安装的组合与运行时实际走的通信路径尚未实测，本页的字节数是按形状与精度推算的逻辑载荷，不是链路实测值。
