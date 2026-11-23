---
id: embedding
title: Embedding：按编号查表取出 token 的向量
type: concept
summary: >-
  Embedding 把每个 token 编号换成一条向量：编号是几，就到嵌入表里取第几行，只有查表没有乘法。本页先讲它是什么、为什么需要，再用一张 6
  行的小表演示查表、one-hot 等价和 2 张卡切表求和；最后落到 GLM 双机，看 8 张卡怎样分着查同一张表。
aliases:
  - embedding
  - 词向量
  - 词嵌入
  - 嵌入向量
  - 嵌入层
  - embedding 表
  - 词嵌入表
  - embedding lookup
chapters:
  - '01'
order: 30
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2268'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2300-L2305'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2469-L2470'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2450-L2460'
  - 'vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L32-L78'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L163-L187
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L477-L497
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L164-L168'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L748-L748'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L881-L883'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L513-L513'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L152-L161'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L170-L181'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/vocab_parallel_embedding.py#L229-L248'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py#L254-L285'
  - >-
    vllm@84030bbe:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L555
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L84-L102'
  - >-
    vllm@568afb3a:vllm/model_executor/layers/vocab_parallel_embedding.py#L472-L492
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L529-L534'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L521-L526'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1151-L1154'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/register_custom_ops.py#L72-L90'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L75-L75'
  - >-
    raw:sha256-40ffa97b8ee22d51294851ef9b22a4d7f95e98de09cde6305eda542546010cfb.md#L1-L376
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/models/glm5_next.py#L2301-L2305
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ops/vocab_parallel_embedding.py#L218-L227
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L92-L133'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L293-L308'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L369-L435'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L584-L585'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L124-L144'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L52-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/vocab_parallel_embedding.py#L301-L457'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L582-L583'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1334-L1335'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/vocab_parallel_embedding.py#L301-L418'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L675-L676'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1440-L1452'
  - 'vllm@ced6857a:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L555'
  - 'vllm@ba15685a:vllm/model_executor/layers/vocab_parallel_embedding.py#L527-L560'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: token
    kind: builds-on
    note: 分词得到 token 编号，embedding 用这些编号选择输入向量
  - to: tensor-parallel
    kind: builds-on
    note: 嵌入表按词表轴切分、入口求和的规则以 TP 页为准，本页只讲入口这一次
contradicts: []
updated: 2026-11-19T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-40ffa97b8ee22d51294851ef9b22a4d7f95e98de09cde6305eda542546010cfb.md
  - >-
    raw/sha256-53a4570c99adc94f60889c7977fc909a162a887f47cf4b13bc0da8e538829c96.md
---

## embedding 是什么？

**Embedding（嵌入）把每个 token 编号换成一条向量：模型里有一张嵌入表，每个编号对应表里的一行数，编号是几就取第几行，整行抄出来就是这个 token 进入模型时的样子。整个过程只有查表，没有乘法。**

文字进模型之前，先由[分词器](token.md)切成一块块 token（模型处理文本的基本单位），每块再换成它在词表里的整数编号；词表就是「token ↔ 编号」的对照表。拿一句「我喜欢猫」来看，假设词表只有 6 项：0「我」、1「你」、2「喜欢」、3「猫」、4「看」、5「。」（示意）。这句话切成「我」「喜欢」「猫」3 个 token，编号分别是 0、2、3。embedding 这一步给每个编号换上一条向量，向量就是一排数，这里每条画 4 个：

```wiki-diagram
file: embedding-intuition
```

可以把嵌入表想成一本按编号排的字典：每个编号占一个词条，词条里写的不是文字解释，而是一排数。表的行从 0 开始编，第 0 行给 0 号，第 3 行给 3 号；「猫」是 3 号，就翻到第 3 行，把那一排数原样抄出来。同一个编号不管出现在哪句话里、哪个位置，查到的都是同一行。

取出来的向量从此代表这个 token，送进模型的第 1 层。模型由多层计算叠起来，每层读进这些向量、把它们改写成新的一排数，再交给下一层；不同层可以采用不同的注意力结构，见[层与隐藏表示](layers-and-hidden.md)。

在常规文本路径里，入口收到的是 token 编号，于是按表查出初始向量。

> **边界与例外（直接传入 `inputs_embeds` 绕过查表）**：若调用方在模型首个流水线成员入口已提供非空的输入向量（例如多模态路径拼好的 `inputs_embeds`），模型会直接把它当作隐藏表示往下传，本次不再按编号查表。该分支要求入口已收到合法可用的输入向量，不代表任意外部向量都能直接传入。


## 为什么需要 embedding，代价在哪？

**编号只说明「这是词表里的哪一项」，本身没有大小和远近的含义；模型里的计算绝大多数是乘法和加法，需要给每个 token 一排能参与计算、而且能被训练调整的数。代价是这张表很大，是模型权重里单块最大的表之一。**

编号只是座位号。在上面的例子里，「喜欢」是 2 号、「猫」是 3 号，两个编号挨着，不代表意思接近；3 比 0 大，也不代表「猫」比「我」更重要；把编号相加，2 + 3 = 5，而这张示意词表里 5 号是句号「。」，「喜欢」加「猫」等于句号，没有任何意义。真实词表里也一样：8 和 9 挨着、312 比 8 大，都只是排序上的先后。如果把编号本身当成一个数送进乘法，模型会把 3 号当成 1 号的三倍，平白多出一套并不存在的大小关系。

换成一排数就不一样了：

- **每个 token 各有一行，互不牵连。** 行和行之间没有编号那样的先后，「猫」那一行怎么取值，不受它排在第几号影响。
- **一排数能装下的信息远多于一个编号。** 一个编号只是一个数；一行却有几千个数，每个都能各自取值，后面的层有足够的空间把表示一步步改写。
- **这些数是训练出来的。** 表里的数不是人填的，而是和模型的其他权重一起在训练中调整，调到对预测下一个 token 有用为止，于是带上了对任务有用的统计关系。固定模型做普通推理时只读这张表，不再改动它。

为什么用一张表，而不是拿编号套个公式算出一排数？因为编号除了「是哪一项」之外不带任何信息，公式没有可用的输入；最直接的做法就是给每个编号单独留一行，让训练自己把这一行的数调好。

代价在于这张表的大小。每个编号一行、每行几千个数，整张表的元素数就是「词表项数 × 每行宽度」。真实模型的词表有十几万项，整张表就有数亿个参数；它与其他权重一样在服务期间常驻显存，每个 token 都从这里起步。下面先用小表走清查表过程，再到标准模型 `Qwen3-8B` 算清真实体积。

## embedding 怎么算？用一张 6 行的小表走一遍

**只有一件事：拿编号当行号，到表里取出那一行；一句话切成几个 token 就取几行，按原来的先后摞起来。**

为了把每个数都看清，下面换成一张缩到最小的嵌入表：词表只有 6 个 token，每行 4 个数，真实模型是十几万行、每行几千个数。表记作 E，表里的数是为演示编的，查法和真实模型完全相同：

```wiki-diagram
file: embedding
```

**① 拿到编号。** 分词器给出「我喜欢猫」的编号 [0, 2, 3]。这 3 个 token 按先后占位置 0、1、2：编号回答「是词表里的哪一项」，位置回答「排在第几个」，两者不是一回事。

**② 编号当行号，整行抄出来。** 位置 0 的编号是 0，取 E 的第 0 行；位置 1 的编号是 2，取第 2 行；位置 2 的编号是 3，取第 3 行。取的时候一个数都不改，也不看别的行。

**③ 按输入顺序摞起来。** 3 条向量一条占一行，摞成 3 行、每行 4 个数的一块（形状 $[3, 4]$），交给第 1 层。对编号序列 $[0, 2, 3]$ 的查表结果如下（示意小表）：

| 序列位置 | token 编号 | 取出表 $E$ 的对应行（4 维向量） |
| --- | --- | --- |
| 位置 0（「我」） | 0 | $E[0] = [0.2,\; -0.1,\; 0.5,\; 0.3]$ |
| 位置 1（「喜欢」） | 2 | $E[2] = [-0.3,\; 0.8,\; 0.1,\; 0.0]$ |
| 位置 2（「猫」） | 3 | $E[3] = [0.7,\; 0.2,\; -0.4,\; 0.9]$ |

最后一行的方括号是形状记号，本站各页都这样写：`[3, 4]` 读作「3 行、每行 4 个数」，第一个数是行数，第二个数是每行几个数（列数）。一次处理几个 token 就有几行，记作 $S$；每行几个数记作 $H$；所以 embedding 交出去的结果写成 `[S, H]`，这里 $S = 3$、$H = 4$。嵌入表本身也用同一个记号：行数就是词表的项数，记作 $V$，每行同样是 $H$ 个数，形状写成 `[V, H]`，这张小表是 `[6, 4]`。编号 $t$ 取的就是第 $t$ 行。

**为什么说只查表、没有乘法？** 查表在数学上等价于一次矩阵乘：把编号写成 one-hot 向量（长度等于词表项数、只有编号位为 `1`、其余全为 `0`），再用它乘整张表 $E$。拿「喜欢」（编号 `2`，one-hot 为 $[0, 0, 1, 0, 0, 0]$）算第 1 维结果：

$$\text{结果}_0 = 0 \times 0.2 + 0 \times 0.1 + 1 \times (-0.3) + 0 \times 0.7 + 0 \times 0.5 + 0 \times 0.0 = -0.3$$

```wiki-diagram
file: embedding-fig-onehot-vs-lookup
```

| 维度 / 统计项 | 等价 one-hot 乘法结果 | 说明 |
| --- | --- | --- |
| 4 个维度的最终输出 | $[-0.3,\; 0.8,\; 0.1,\; 0.0]$ | 正好等于 $E$ 的第 2 行：只有乘 $1$ 的那一项留下，其余全乘 $0$ |
| 等价乘法次数 | $6\text{ 行} \times 4\text{ 列} = 24\text{ 次}$ | 其中 $20$ 次是无意义的乘 $0$ |

结果与直接取第 `2` 行完全一致，却白算了 `20` 次乘 `0`。真实词表有十几万行，实现里直接按行号直取（`F.embedding`），入口零乘法开销。

## 每行多宽、每步查几行？

**每行的宽度 H 叫 hidden size，token 带着这个宽度穿过所有层；每一步查几行，由这一步送进来几个 token 决定。**

每行有多少个数由模型定死，叫 hidden size（隐藏维度，每个位置用多少个数表示）。token 带着这个宽度从第 1 层走到最后一层，层与层的交界处宽度不变；层内部有些中间结果可以是别的宽度，比如线性投影和 [MoE](moe.md) 专家的中间维。取出来摞成的 `[S, H]` 是隐藏向量的起点，后面每一层再拿它做矩阵乘并跨位置交换信息。

每一步查几行，由本步送进来的 token 数 $S$ 决定。处理提示词的 [prefill](prefill.md) 阶段可以整段处理或分块，$S$ 是本步实际送入的位置数；普通 decode 阶段每条请求送入上一步刚生成的 `1` 个 token，查出 `[1, H]`。若开启投机解码（先草拟候选，再一并验证），单步还会带上候选位置，查表行数随之增加。此前各层保存的[历史状态](kv-cache.md)供后续复用，不必每步重查整个前缀的嵌入；多条请求合批时，$S$ 行来自不同请求，归属由调度元数据维护。

同一个编号在一句话里出现两次，两处取出的初始向量完全相同，因为查表只看编号、不看位置。它们仍是序列里的两个不同位置，进入后面各层后，位置和上下文都会参与计算，两处的表示随之分开。

## 这张表占多少，查出来的数意味着什么？

**整张表有 V × H 个数，每个都要常驻存着；查出来的数只是起点，本身不带预先规定的含义，含义要靠后面的层算出来。模型出口还有一张方向相反的词表权重，别和它混在一起。**

表里的每一个数都要存。整张表有 $V \times H$ 个数，乘上单元素字节数就是显存占用：上面的小表是 `6 × 4 = 24` 个数，按 `2 B` 存占 `48 B`。词表里每一项都占一行，不只是普通词与子词，特殊控制标记也各有一行。

这些数本身不承诺什么。它不保证「猫」和「狗」的行在表里挨得最近，不保证两行相加减能得到指定的词，每一个位置上的数也没有预先指定的人类含义。这些性质要靠后面各层的计算和训练目标来体现，不是查表这一步给的。

模型出口还有一张同样带着词表维度的权重，叫 `lm_head`：它把最后一层的隐藏向量映射为词表每一项的分数，用来挑下一个 token。它和嵌入表方向相反，一个做「编号 → 向量」，一个做「向量 → 词表分数」。是否共享由 `config.json` 的 `tie_word_embeddings` 决定：例如 `Qwen3-8B` 设为 `false`（入口与出口各存一份），而 `Qwen3-0.6B` 设为 `true`（共用同一张表）。`lm_head` 的打分与多卡切分见 [lm_head](lm-head.md)。

## 多张卡分着存一张表：每张卡查一段，再加起来

**模型用多张卡一起跑时，可以把表按行切开分给各卡，每张卡只存、只查自己那一段；查不到的位置整行填 0，最后把各卡的结果逐格相加，每张卡就都拿到了完整的向量。**

大模型常把一层的权重切开，分给多张加速卡（NPU、GPU 这类专做矩阵运算的芯片）一起算，叫[张量并行](tensor-parallel.md)（tensor parallel，TP）。嵌入表按行切分，每张卡负责一段连续的编号区间。这样切的原因不一定是一张卡装不下整张表，而是整模型都按 TP 切分，嵌入表跟着一起切，顺带均摊每张卡的显存。沿用上面的小表切给 2 张卡：卡 0 存第 `0～2` 行，卡 1 存第 `3～5` 行。每张卡从 `0` 开始给自己手里的行编号，所以卡 1 手里的第 `0` 行对应整表第 `3` 行。

本轮的编号 [0, 2, 3] 同时发给两张卡：切开的是表，编号每张卡拿到的都是同一份。每张卡逐个位置看：编号落在自己那段里，就从自己手里取出那一行；不在，就把这个位置整行填 0。

```wiki-diagram
file: embedding-split
```

两张卡各得到一块 `[3, 4]`，每个位置只有一张卡填了真值，另一张是 0。接着做一次 All-Reduce：每张卡交出一份 `[3, 4]`，结束时每张卡都拿到所有卡逐格相加的结果（见[集合通信](collective-communication.md#all-reduce)）。以位置 2（编号 3）为例（示意）：

| 卡号 / 合并步骤 | 位置 2 的本地向量 | 说明 |
| --- | --- | --- |
| 卡 0（持有第 0–2 行） | $[0,\; 0,\; 0,\; 0]$ | 编号 3 不在本地区间，整行填 $0$ |
| 卡 1（持有第 3–5 行） | $[0.7,\; 0.2,\; -0.4,\; 0.9]$ | 取出本地第 0 行（对应整表第 3 行） |
| All-Reduce 逐格相加 | $[0+0.7,\; 0+0.2,\; 0+(-0.4),\; 0+0.9] = [0.7,\; 0.2,\; -0.4,\; 0.9]$ | 与单卡直接查第 3 行一致；位置 0、1 的真值在卡 0，同样相加还原 |

每个位置恰好只有一张卡填了真值、其余都是 0，所以相加不会算错。这样切，省下的是每张卡的内存：$N$ 张卡各存 $1/N$ 的行；多付的是每次前向多一次 `All-Reduce`，每张卡交出 $S \times H$ 个数，随本步 token 数线性增长。

## 放到标准模型：Qwen3-8B 的词表账与 TP2 查表

**在全站 `v0.30.0` 主基线的标准稠密模型 `Qwen3-8B` 上，嵌入表逻辑形状为 `[151,936, 4096]`（BF16 约 `1.16 GiB`），且与出口 `lm_head` 不共享（`tie_word_embeddings = false`）。`VocabParallelEmbedding` 在 `TP = 2` 下将其按词表维切为每卡 `75,968` 行，单步查表后经一次 `All-Reduce` 还原完整 `[T, 4096]`。**

先核对 `Qwen3-8B` 入口词表与多卡切分的三笔静态账（完整模型静态核算见 [HF 模型目录解剖](hf-model-anatomy.md#完整算账对照qwen3-8b-vs-qwen3-30b-a3b)）：

| `Qwen3-8B` 嵌入层核算项（BF16，`2 B`/元素） | 算式 | 结果 |
| --- | --- | --- |
| 逻辑整表权重（`embed_tokens`） | $151{,}936 \times 4{,}096 \times 2\text{ B}$ | $1{,}244{,}659{,}712\text{ B} = 1{,}187.0\text{ MiB} \approx$ **`1.16 GiB`** |
| 入口 + 出口合计（`tie_word_embeddings = false`） | `embed_tokens` 与独立 `lm_head` 各占 `1.16 GiB` | 合计约 **`2.32 GiB`**（`Qwen3-0.6B` 绑定共享则省去一半） |
| `TP = 2` 每卡行数与词表对齐 | $151{,}936 \div 2 = 75{,}968$；$151{,}936 \bmod 64 = 0$ | **`75,968` 行 / 卡**（整除 64，无需补行） |
| `TP = 2` 每卡嵌入权重 | $75{,}968 \times 4{,}096 \times 2\text{ B}$ | $622{,}329{,}856\text{ B} =$ **`593.5 MiB / 卡`** |
| 单步 `All-Reduce` 逻辑载荷（`T` 个 token） | $T \times 4{,}096 \times 2\text{ B} = 8\text{ KiB} \times T$ | 单请求普通 Decode（`T = 1`）仅 **`8 KiB`**；`T = 2048` Prefill 为 **`16 MiB`** |

在 `vllm-ascend v0.30.0` 中，各卡进入嵌入层时已各自持有本步完整的 `input_ids`，`AscendVocabParallelEmbedding` 的标准 TP 路径（`_forward_standard`，内部不广播 `input_ids`）按四步执行：

1. 按本卡分片区间计算越界掩码，并将非本卡分片的编号映射到安全本地下标（如 `0`）；
2. 执行本地 `F.embedding` 查表；
3. 按掩码把越界位置对应的**输出向量行**清零；
4. 跨 TP 组执行一次 `All-Reduce` 求和，使每张卡拿到完全一致的 `[T, 4096]` 进入第 1 层。

下图串联了这套 `Qwen3-8B` `TP = 2` 流转与四组高频排障误区：

```wiki-diagram
file: embedding-fig-vocab-parallel-qwen3
```

## 复杂异构实战对照

### 放到 GLM 双机：8 张卡怎么查同一张表？

**GLM 的嵌入表逻辑形状是 `[154880, 4096]`；TP8 把它按行切成 8 份，每张卡只存、只查自己那 19360 行，查不到的位置填 0，再用 [All-Reduce](collective-communication.md#all-reduce) 把 8 份结果加起来，每张卡就都有了完整向量。** 做法和上一节的 2 张卡一样，只是卡数和表都变大了。

[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)是 2 台 Atlas 800 A2 服务器、每台 8 张昇腾 NPU，共 16 张卡（2×A2×8）。其中 TP8 指同一台机器里的 8 张卡组成一组，共同切分采用 TP 的权重矩阵；DP2 指这样的组有 2 个，各自处理不同的请求。切表和求和都发生在每个 TP8 组的 8 张卡之间。

GLM 的文本配置给出词表 154880 项、hidden size 4096，所以整表是 154880 行、每行 4096 个数。这 154880 行里既有普通的词和子词，也有特殊标记和分词器从不产出的预留行，三段的构成见 token 页的[编号要落在 154880 行之内](token.md#编号要落在-154880-行之内)。

表里的数按 BF16 存，BF16 是每个数占 2 字节的 16 位浮点格式。部署虽然是 W8A8（权重和激活用 8 位整数，另配缩放系数），8 位只用在一部分矩阵乘的权重上；embedding 表建层时就没有接量化配置，仍按 BF16 加载，所以下面每个数按 2 B 算。哪些矩阵是 8 位、哪些保持 BF16，见[量化](quantization.md#哪些矩阵是-8-位哪些保持-bf16)。

下面一次算清三件事：整张表多大，TP8 下每张卡摊到多少，入口那次 All-Reduce 的载荷（每张卡交出去参与相加的数据量）。载荷按本站贯穿各页的示例请求 R1 算：提示词套上聊天模板、分词后是 4 个 token，服务上此刻只有这一条请求，见[一条请求怎么走](one-request.md#示例请求-r1-与官方双机部署)。R1 这一步查 4 行，每张卡交出的就是 4 行 × 4096 个数：

$$M_{\text{embed,card}} = \frac{154{,}880}{8} \times 4{,}096 \times 2\text{ B} = 19{,}360 \times 4{,}096 \times 2\text{ B} = 158{,}597{,}120\text{ B} = 151.25\text{ MiB}$$

| GLM 嵌入表与入口通信核算项 | 算式 | 结果 |
| --- | --- | --- |
| 逻辑整表元素数与 BF16 规模 | $154{,}880 \times 4{,}096 = 634{,}388{,}480$；$\times 2\text{ B}$ | $1{,}268{,}776{,}960\text{ B} \approx$ **1.18 GiB** |
| TP8 每卡行数与词表补齐 | $154{,}880 \div 8 = 19{,}360$；$154{,}880 \bmod 64 = 0$ | **19,360 行**（无需补行） |
| TP8 每卡嵌入权重（BF16） | $19{,}360 \times 4{,}096 \times 2\text{ B}$ | $158{,}597{,}120\text{ B} =$ **151.25 MiB** |
| R1 入口一次 All-Reduce 逻辑载荷 | $4 \times 4{,}096 \times 2\text{ B}$ | **32,768 B**（32 KiB） |

1.18 GiB 是整张表的逻辑规模，按每数 2 字节估算、没有切分，不含词表补齐和额外缓冲，也不是某一张卡上的大小；TP8 下每张卡实际放的是 151.25 MiB 的那一段。「词表补齐」是因为实现会先把词表行数补到 64 的整数倍再平均切开，154880 正好是 64 的倍数，不用补。

切法是行切：每张卡负责一段连续的编号区间。入口时本轮的每个编号都发给 8 张卡，只有区间覆盖该编号的那张卡查到真正的行，其余 7 张卡把这一位置整行置零；8 份相加，非零的那一份就是答案，所以求和不会算错。切开的是权重表，输入的编号在每张卡上是同一份。这套「入口求和、出口拼接」的分工以[张量并行](tensor-parallel.md#词表入口求和出口拼接)页为准。

> **边界与例外（历史分支 FlashComm1 与 `Reduce-Scatter`）**：本节入口 `All-Reduce` 沿用[基线页的条件性假设](../sources/glm-5-3-flash-baseline.md)，即本步未启用 [FlashComm1](sequence-parallel.md) 序列并行。注意命令未显式开启或环境变量默认 0 都不能单独证明最终状态，配置与共享专家路径仍可能改写它。在 `v0.23`、`v0.26` 普通入口中，仅当 FlashComm1 生效且未命中多模态草稿例外时才改走 [Reduce-Scatter](collective-communication.md#reduce-scatter)；`v0.30.0` 与 `main` 标准 TP 入口则固定保持 `All-Reduce`（见下文版本差异）。这里的 `32,768 B` 为该假设下的逻辑载荷，非运行日志实测通信量。

沿用 R1 的 4 个输入位置，假设它们的编号是 [8, 9, 312, 8]，把查到的行按输入顺序排好，就得到本轮的输入张量：

```wiki-diagram
file: embedding-lookup
```

图中第一个和第四个位置用的是同一个编号 8，在固定权重下取出的初始向量完全相同。前面讲过，它们仍是序列里的两个不同位置，进入后续层后各自的上下文和位置参与计算，隐藏表示随之分开。

R1 之后的 decode 步，入口依然查 4 行，而不是 1 行。原因在于该部署开启了 MTP 投机解码：模型自带的 MTP 层每轮先草拟 `3` 个候选，每请求每步送入 `1` 个确定位置加 `3` 个候选（共 `4` 个 token，见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）。因此 R1 每步 decode 查 4 行，得到的仍是 `[4, 4096]`（逐圈输入见[一条请求的 decode 步](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)）。

这里的「行」对应本轮处理的 token 位置，不对应请求。[多请求并发](concurrent-requests.md)时同样的 4 行来自请求 A 的 1 个位置加请求 C 的 3 个位置，请求归属由序列边界和状态映射另行维护。三个形状容易混，分开记：

| 对象 | GLM 文本路径的形状 | 含义 |
|---|---|---|
| 嵌入权重（逻辑整表） | `[154880, 4096]` | 为每个词表编号提供初始向量 |
| 每张卡的分片 | `[19360, 4096]` | TP8 下本卡实际持有的那一段 |
| 本轮 4 个输入的向量 | `[4, 4096]` | 按本轮编号取出并求和后的结果 |

嵌入表属于模型权重，生命周期是整个服务；取出的向量属于本轮输入，随编号和批次变化，下一步就被后面的层改写。

4096 只是入口的宽度。GLM 层间采用 `mHC` 四路残差结构，每个位置维护四路表示，进入注意力或 MLP 子层前再组合成一条 4096 维向量（连接细节见[模型单层图](glm-5-3-flash.md)）。出口侧的 `lm_head` 与嵌入表不共享（`tie_word_embeddings = false`），容量须单独计算。下图对照保留了 GLM 双机 TP8 词表并行的四步流转与版本边界：

```wiki-diagram
file: embedding-fig-vocab-parallel
```

读完入口查表后，接着看[矩阵乘与权重](matmul-and-weights.md)，了解取出来的向量怎样被一层层投影成新的表示。

## 常见误解

- **「编号相近，意思就相近；编号能做算术。」** 编号只是座位号，相邻只说明索引相邻。含义的远近由训练出的那一行数字体现，不由编号大小体现。
- **「embedding 是一次矩阵乘。」** 数学上它等价于 one-hot 向量乘权重表（上文用小表算过一遍，结果正好是那一行），但实现按行号直接取行，入口没有乘法开销。TP 下多出来的是一次通信，仍然不是乘法。
- **「按 TP 切表后每张卡只查到一段，结果就是不完整的。」** 每张卡把不属于自己的位置整行置零，经 `All-Reduce` 求和后，每张卡拿到的都是完整向量。
- **「`[151,936, 4096]`（或 GLM `[154,880, 4096]`）就是单卡上的分片大小。」** 这是逻辑整表；`Qwen3-8B` 在 `TP=2` 下每卡只持 `75,968` 行（`593.5 MiB`），GLM 在 `TP=8` 下每卡持 `19,360` 行（`151.25 MiB`）。
- **「embedding 和 lm_head 都带词表维度，应该算同一份权重。」** 两者一个做「编号到向量」、一个做「隐藏表示到词表分数」。是否共享看 `tie_word_embeddings`：`Qwen3-8B` 与 `GLM-5.3-Flash` 均为 `false`，容量要各算一份。
- **「同一个词在一句话里出现两次，模型看到的表示就一样。」** 入口取出的初始向量相同，后面每一层都把位置和上下文算进去，同词不同位的表示会分开。
- **「decode 每步只有一个新 token，不用再查表。」** 每步送进来的新 token 都要先查表：普通自回归（如 `Qwen3-8B`）查 `1` 行得到 `[1, 4096]`；开启 MTP（如 GLM 算例）每步含 `1` 个确定位置加 `3` 个候选，查 `4` 行得到 `[4, 4096]`。历史位置的表示另由状态保存，不再重新查表。

## 对照源码

### 怎么开

文本模型的入口层不需要额外开关：固定 GLM 实现直接用配置里的 `vocab_size` 和 `hidden_size` 建一个 `VocabParallelEmbedding`，TP 大于 1 时它自己负责切行、置零和归约。[C2] 这里没有传量化配置，所以 W8A8 部署下这张表仍走不量化的查表实现，每个数 2 B。Ascend 侧在注册表里把这个类替换成 `AscendVocabParallelEmbedding`，所以实际跑的是 Ascend 版本。[C11]

需要显式打开的是另一件事：细粒度的 embedding tensor parallel。`embedding_tensor_parallel_size` 默认 0，对应的开关判定为假，走的是与上游同形的 `_forward_origin`；默认值见来源 13，开关判定见来源 12，两者共同限定这条分派路径。[C12] 把它设成大于 0 才切换到专用的 embed-TP 路径。

另有一条绕过查表的入口：模型 `forward` 收到已经准备好的 `inputs_embeds` 时直接使用传入的表示，不再按编号查表；多模态和外部提供向量的调用走这条路。[C3]

这段直接使用向量的分支位于流水线的首个成员，也就是把模型分成多段接力运行时负责第一段的成员；只有没有提供输入向量时，它才按编号查表。这条分支本身没有给出所有入口的校验过程，不能据此认为任意形状或数据类型的外部向量都能被接受。

### 会报什么错

- `embedding_tp static capacity {capacity} < num_tokens {n}`：ValueError，只在 embed-TP 路径出现。这条路径按启动时算好的静态容量分配交换缓冲，本步 token 数超过容量就直接失败，提示里也写了要调大哪两个上限。[C15]
- `oproj_tensor_parallel_size / embedding_tensor_parallel_size require recompute_scheduler_enable=true`：AssertionError，启动期抛出。细粒度 TP 的跨 DP 集合操作要求各 DP rank 的 token 数一致，只有 recompute scheduler 保证这点。[C14]
- 编号越界不在这一层报错。区间之外的编号会被当成「不属于本卡」，8 张卡都置零，求和结果是一条全 0 向量而不是异常；上界检查在入口的输入处理阶段完成，见 [token 页的报错清单](token.md#会报什么错)。[C7]

### 开销和什么时候别开

查表本身是显存读取，不是乘法，入口的开销主要是两笔：常驻权重按 TP8 每卡 151.25 MiB，以及每次前向一次 All-Reduce，R1 的载荷是 32768 B。[D] 前一笔和 batch 无关，后一笔随本步 token 数线性增长。[D]

归约走的是 Ascend 封装的归约算子：拿不到前向上下文、本步 FlashComm1 未生效，或命中多模态草稿的普通入口例外时，返回张量并行 All-Reduce；其余适用的普通入口先按需补齐 token 数，再做 Reduce-Scatter。[C20] 环境变量默认 0 只是配置来源之一；`enable_sp()` 可从 additional_config、Ascend 配置或环境取值，初始化或刷新时还可能被共享专家条件开启。随后本步上下文还检查模型类型和 token 数，相关条件见来源 34–35。[C26] main 的标准 TP 入口不再经过这个算子，保持 All-Reduce，注释给出的理由是：第一层期望拿到完整的 token 序列，序列并行要到该层注意力输出之后才开始，在入口换成 reduce-scatter 会让每张卡只剩一段 token。

细粒度 embedding TP 默认关着，它要求同时打开 recompute scheduler，并且吃一个静态容量上限。除了确有需要的大词表场景，保持默认即可。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**正文 GLM 双机绑定算例采用例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 的 PCP 词表分片要与标准 TP 路径分开。** 标准路径仍本地查表、将非本片词条置零、TP All-Reduce，不能只因 FlashComm 开启就说它改为 Reduce-Scatter。`PCP > 1` 且模块前缀匹配时，默认 `true` 的 `enable_pcp_embedding_lmhead_weight_sharding` 可选择 `TP × PCP` 分片：先在 PCP 组 All-Gather token ID，再本地查表、PCP Reduce-Scatter 归还 token 行，最后 TP All-Reduce（在 `c09d3e20` 与 `8d6180e2` 中统一走 `_forward_with_token_exchange`）。`disable_tp` 优先返回整表复制；PCP 分片与细粒度 embedding TP 互斥。正文 GLM `PCP=1` 的 TP8 行数保留，但“切法不随版本变化”不能外推到这条 PCP 路径。

| 核对项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 标准 TP 查表与归约 | 行切 + 置零 + `maybe_pad_and_reduce`（本步 FlashComm1 生效且非多模态草稿例外时补齐后 Reduce-Scatter）[C16] | 同 `v0.23.0`[C17][C25] | 标准路径 `_forward_standard` 固定走 `torch.ops.vllm.all_reduce`，不再在入口改为 Reduce-Scatter；`token_exchange_group` 非空时走 `_forward_with_token_exchange`（`L301-L457`） | 延续 `_forward_standard` 与 `_forward_with_token_exchange` 双分支（`L301-L418`），标准 TP 入口仍保持 All-Reduce |
| PCP 词表分片开关 | 无 | 无 | `enable_pcp_embedding_lmhead_weight_sharding` 默认 `True`（`ascend_config.py#L582`），须 `PCP > 1` 且模块匹配才启用 | 默认仍 `True`（`ascend_config.py#L675`），规则同 `v0.30.0` |
| 细粒度 embedding TP 开关 | `embedding_tensor_parallel_size` 默认 `0`（`> 0` 启用）[C22] | 默认 `0`[C23] | 默认 `0`（`ascend_config.py#L1335`），与 PCP 分片互斥 | 对齐 `ParallelConfig` 语义：默认改为 `1`（仅 `> 1` 启用，`0` 作为旧配置禁用别名兼容，`ascend_config.py#L1440-L1452`） |
| 上游 `VocabParallelEmbedding` | 掩码取行后置零再归约[C8] | 同形[C21] | 含融合查表与 FP8 按 int8 视图归约分支（`L510-L555`） | 延续融合查表与标准归约语义（`L527-L560`） |

四版标准 TP 路径的词表切法与每卡行数相同；旧版 `v0.23.0` / `v0.26.0rc` 在 FlashComm1 生效时归约方式可能改变每卡收到的 token 行数，而 `v0.30.0` 与 `main` 标准 TP 入口固定保持完整 token 序列（不含 PCP 分片路径）。[D]

表中上游 FP8 按 int8 处理的行为有适用条件：固定实现先排除 TP 只有一个成员的路径，进入非 fused（不使用融合查表算子）分支后，也只对 `float8_e4m3fn` 与 `float8_e5m2` 两种类型处理。这里是把同一份字节按 int8 视图通信，再恢复原类型视图；不能推广到所有类型，也不能据此认定 GLM 双机镜像或昇腾执行路径采用了该实现。

### 源码位置

固定 GLM 的首个流水线 rank 在 inputs_embeds 非空时直接使用输入向量，否则查 embedding 表；FP8 的加载与转换还有独立分支（来源 3、19）。这些代码分支不能证明任意入口都接受外部向量，也不能代替设备执行验证。

阅读顺序：`models/glm5_next.py` 建 `embed_tokens`，同一文件的 `embed_input_ids` 让外部用同一张表查向量；[C4] 再看 `ops/vocab_parallel_embedding.py` 的 `forward` 按开关分派；[C9] 最后是上游 `layers/vocab_parallel_embedding.py`，单卡的普通查表就是一次 `F.embedding`，多卡才加掩码与归约。[C6] 出口一侧的 `lm_head` 在同一个模型文件里单独建表。[C5]

来源 34–35 对应最终 SP 状态与本步 FlashComm1 判断；来源 36 对应嵌入表构造、词表补齐、分组和不量化回退。三版细粒度 embedding TP 的默认值由来源 22–24 的配置定义给出，是否开启仍按大于 0 判断。

数值出处：154880、4096 与 `tie_word_embeddings` 为 false 来自固定 revision 的模型配置；[S1] 19360 行、151.25 MiB、32768 B 和 1.18 GiB 由这些形状与精度推导；[D] 前几节的 6 行小词表、「我喜欢猫」的编号 [0, 2, 3]、表里的数和 2 张卡的切法，以及 GLM 一节图里的 `[8, 9, 312, 8]`，都是教学假设，与任何实际提示词和实际权重无关，GLM 那张图的格子也只画部分维度。[A]

待核：专用镜像内最终安装的组合与运行时实际走的通信路径尚未实测，本页的字节数是按形状与精度推算的逻辑载荷，不是链路实测值。

- 来源 28：vllm-ascend@db701c1f，vllm_ascend/models/glm5_next.py，L2301–L2305。
- 来源 29：vllm-ascend@db701c1f，vllm_ascend/ops/vocab_parallel_embedding.py，L218–L227。
