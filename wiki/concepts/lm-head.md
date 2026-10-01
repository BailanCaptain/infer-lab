---
id: lm-head
title: "lm_head：把最后的隐藏向量变成每个 token 的分数"
type: concept
summary: "lm_head 是模型最后一步的输出投影：把最后一层交出的隐藏向量乘一张每个词一列的权重，给词表里每个 token 打一个分数（logits），再交给采样挑下一个 token。本页先用 4 维、6 个词的小例子演示一个分数怎么算，再看 GLM 双机上它按词表切成 8 段、各卡算一段、All-Gather 拼回 154880 个分数。"
aliases: [lm_head, lm head, LM head, 输出头, 语言模型头, 词表投影, 输出投影, logits, ParallelLMHead, unembedding]
chapters: ["03"]
order: 90
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2454-L2467
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2515-L2522
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L574
  - vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L104
  - vllm@0fc695fc:vllm/platforms/interface.py#L858-L862
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L252-L283
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L341
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L64-L73
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L749-L750
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L877-L878
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L320
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L570-L574
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2326-L2327
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1260-L1299
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L121-L136
  - vllm@0fc695fc:vllm/v1/sample/sampler.py#L243-L262
  - vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L341
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L324-L334
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L349
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L344-L345
  - vllm-ascend@baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py#L373-L449
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L805-L820
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L848-L857
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L184-L197
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: layers-and-hidden
    kind: builds-on
    note: lm_head 接在最后一层之后，吃的是那一层交出、再做完最终归一化的隐藏向量
  - to: matmul-and-weights
    kind: builds-on
    note: 打分就是一次「向量 × 权重矩阵」，一个分数就是一次点积
  - to: embedding
    kind: builds-on
    note: 嵌入表在入口按编号取行，lm_head 在出口用同样形状的表给每个词打分，方向相反
  - to: tensor-parallel
    kind: builds-on
    note: 按词表切 lm_head 是列切的一个实例，分数各卡算完即真值，用 All-Gather 拼接
contradicts: []
updated: "2026-09-29"
origin: seed
---

## lm_head 是什么？

**lm_head（language model head，语言模型的输出头，也叫词表投影）是模型最后一步的一次矩阵乘：把最后一层交出的隐藏向量，乘一张「每个词一列」的权重，给词表里每个 token 各算一个分数。分数越高，模型越认为这个 token 该接在后面。**

模型给每个位置维护一条向量，也就是一排数，叫隐藏向量（hidden）；每一层把它读进来、改写一遍、交给下一层，见[层与隐藏表示](layers-and-hidden.md)。这排数对模型有意义，对人没有：它不直接说「下一个词是哪一个」。lm_head 就负责把它翻译回词表。

还用[嵌入页](embedding.md)那张 6 项的示意词表：0「我」、1「你」、2「喜欢」、3「猫」、4「看」、5「。」，隐藏向量每条 4 个数。提示词「我喜欢」走完所有层，最后一个位置留下一条向量；lm_head 给 6 个词各打一个分：

```wiki-diagram
file: lm-head-intuition
```

权重里每个词占一列，一列 4 个数，和隐藏向量一样长。隐藏向量和某一列逐位相乘、再全部加起来，得到的一个数就是这个词的分数。6 列各做一次，就得到 6 个分数。图里「猫」得分最高，所以「我喜欢」后面最可能接「猫」。

这些分数叫 **logits**。它们只用来比大小：可以是负数，加起来也不等于 1，还不是概率。把分数换成概率、再按规则挑出一个编号，是紧接着的采样一步；挑出的编号再由分词器变回文字，见 [token 页](token.md#生成的编号怎样变回文字)。

## 为什么需要 lm_head，代价在哪？

**模型内部只有向量，而生成要回答「下一个是哪个 token」；lm_head 给词表里每一项一个能比较的分数，采样才有东西可挑。代价是这张权重和词表一样宽：它占的内存和嵌入表一样大，每一步打分都要把它从头读一遍，而真正要打分的往往只有寥寥几行。**

**没有它会怎样。** 最后一层交出的是一排数，没有哪一位对应某个词。要从词表里挑一个，先得给每个候选一个数，数大的更可能被挑中；「给十几万个候选各一个数」这件事，就是 lm_head。

**为什么用乘法打分。** 两排数逐位相乘再相加（点积），结果的大小反映它们是否「同向」：隐藏向量和哪一列越同向，那个词的分数越高。训练时，模型在每个位置都被要求让真实的下一个 token 得高分、其他词得低分，前面各层和这张权重就是一起被这样调出来的。所以 lm_head 本身只是一次线性的读出：它不再做新的推理，只把前面各层写进隐藏向量的倾向，逐词换成分数。

**只对要出 token 的位置打分。** 每个位置都能打分，但生成只关心「接下来是什么」。提示词一次送进来时，只有最后一个位置的分数用来挑第一个新 token，前面的位置不必过 lm_head；执行侧会先挑出需要打分的那几行，再交给 lm_head。

**代价。** 整张权重有「词表大小 V × 隐藏宽度 H」个数。真实模型十几万个词、每列几千个数，就是几亿个数，和嵌入表一样大，服务运行期间一直放在加速卡的内存里。每打一行分，都要让这一行和每个词的那一列各做一次点积，所以整张表（多卡时是本卡那一段）每一步都要完整读一遍；decode（提示词处理完后、逐个生成新 token 的阶段）时一步只有很少几行，读进来的每个数只用上那几次，这一步的时间主要花在读权重上。GLM 上的具体数字放在后面 GLM 一节。

## lm_head 怎么算？用 4 维、6 个词走一遍

**一个分数就是隐藏向量和这个词那一列的点积：对齐的位置相乘，再全部加起来。6 个词做 6 次，合起来就是一次 [1, 4] × [4, 6] 的矩阵乘，得到 [1, 6] 的一排分数。**

下面换上具体的数。隐藏向量和权重里的数都是为演示编的，算法和真实模型相同：

```wiki-diagram
file: lm-head-score
```

**① 拿到隐藏向量。** 最后一个位置的隐藏向量 h = [1.0, 0.5, −1.0, 2.0]。它已经做过最终的归一化：最后一层之后先把整条向量缩放到稳定的数值范围，再送进 lm_head，做法见 [RMSNorm](mlp-residual-norm.md#rmsnorm-怎样调整向量尺度)。

**② 取「猫」那一列，对齐相乘。** 「猫」那一列是 [0.6, 0.2, −0.4, 0.5]。第 1 位 1.0 × 0.6，第 2 位 0.5 × 0.2，依此类推，得到 [0.6, 0.1, 0.4, 1.0]。

**③ 加起来。** 0.6 + 0.1 + 0.4 + 1.0 = 2.1，这就是「猫」的分数。

**④ 其余 5 列照做。** 6 个分数依次是 [−0.4, −0.5, 0.2, 2.1, 0.8, 1.0]，对应「我」「你」「喜欢」「猫」「看」「。」。「我」这一列和 h 大体不同向，分数是负的：

```calc
title: 两个分数怎么来
「猫」的分数 = 1.0 × 0.6 + 0.5 × 0.2 + (−1.0) × (−0.4) + 2.0 × 0.5 = 0.6 + 0.1 + 0.4 + 1.0 = 2.1
「我」的分数 = 1.0 × 0.2 + 0.5 × (−0.4) + (−1.0) × 0.6 + 2.0 × 0.1 = 0.2 − 0.2 − 0.6 + 0.2 = −0.4
> 你、喜欢、看、。四列的权重未逐一列出，分数按同样算法得出（示意）
```

一次送进 n 行（几个位置，或几条请求各自的位置）时，就是 [n, 4] × [4, 6] → [n, 6]：每行各得 6 个分数，同一张权重被这 n 行共用。打一行分要做 V × H 次乘和同样多次加，所以计算量和行数 n 成正比，而权重不管 n 是几都只读一遍，这是矩阵乘的一般规律，见[一个数是怎么算出来的](matmul-and-weights.md#输出里的一个数是怎么算出来的)和[权重被复用几次](matmul-and-weights.md#一步有多少行权重被复用几次)。

图里把权重画成「每个词一列」，是为了和矩阵乘的写法对上。代码里这张表按「每个词一行」存，形状是 [V, H]，和嵌入表一模一样，乘的时候按转置来用；两种画法是同一组数。

## 分数之后：softmax 与采样怎样挑出一个 token？

**logits 只能比大小，接下来由 sampling（采样）把这排分数变成一个确定的编号：greedy（贪心）直接挑分数最大的词；随机采样先用 softmax（归一化指数：每个分数取指数、再除以总和）把分数换成一组加起来等于 1 的概率，再按概率抽。采样本身另有专页，这里只看本页那 6 个分数会变成什么。**

```calc
title: 6 个分数经过 softmax
指数之和 = e^(−0.4) + e^(−0.5) + e^(0.2) + e^(2.1) + e^(0.8) + e^(1.0) = 0.670 + 0.607 + 1.221 + 8.166 + 2.226 + 2.718 = 15.608
「猫」的概率 = 8.166 ÷ 15.608 ≈ 52.3%
「。」的概率 = 2.718 ÷ 15.608 ≈ 17.4%
「看」的概率 = 2.226 ÷ 15.608 ≈ 14.3%
其余三个合计 = (0.670 + 0.607 + 1.221) ÷ 15.608 ≈ 16.0%
> 指数值保留 3 位小数
```

取指数让分数全变成正数，也把差距放大：「猫」只比「。」高 1.1 分，概率却差不多是它的 3 倍。贪心挑的就是「猫」——softmax 不改变大小次序，贪心不必真算它，在 logits 上找最大值就行；随机抽时「猫」也占一半多的机会，「。」和「看」还有希望。temperature、top-k / top-p 这些让抽取更稳或更活的设置都作用在这排分数上，逐项讲解见 [sampling](sampling.md)；GLM 双机上采样在哪一步、由谁做，见 [sampling 的 GLM 一节](sampling.md#放到-glm-双机采样在哪一步谁来做)。

「贪心只要最大值」还带来一个省通信的思路：多张卡各算一段分数时，贪心只需每张卡报出自己那段里的最大值和它的编号，比一比就知道全局最大，不必把完整的分数拼齐。GLM 双机默认没走这条路，后文 GLM 一节会讲。

## lm_head 和 embedding 是同一张表吗？

**两张表形状一样，每个词一行、一行 H 个数，用法相反：embedding 按编号取出一行，lm_head 拿隐藏向量和每一行做点积。有的模型让两者共用同一份数，叫权重共享（tied embeddings）；GLM-5.3-Flash 不共用，各存一份。**

形状相同，所以可以共用：共用时，一个词在入口拿到的向量，和出口给它打分用的那一行，是同一排数。vLLM 的 lm_head 类本身就是嵌入表类的子类，按词表切、按行存的方式完全一样，要共用时直接让它的权重指向嵌入表。嵌入表那一侧的讲法见 [embedding](embedding.md#这张表占多少查出来的数意味着什么)。

共用的好处是省下一整份 V × H 的权重。它是训练之前就定下的结构选择，训练好的模型推理时改不了：两张表是否是同一份，决定了训练出来的是哪一组数。

GLM-5.3-Flash 的模型配置里，权重共享开关在文本配置和顶层都写成 false。所以模型文件里有一份独立的 lm_head 权重，加载时照常读入（只有共用的模型才会跳过它），两张表各占一份显存；每张卡上各多少，见下一节。

## 放到 GLM 双机：154880 个词的分数怎样算出来？

**GLM-5.3-Flash 的 lm_head 是一张 154880 个词、每个词 4096 个数的权重。TP8 把它按词编号切成 8 段，每张卡存连续的 19360 个词；8 张卡拿同一批隐藏向量各算自己那段的分数，再用一次 All-Gather 拼回完整的 154880 个。**

固定部署是两台 Atlas 800 A2、每台 8 张卡，TP8 / DP2 / EP16，权重 W8A8，详见[部署前提](glm-5-3-flash-two-node.md#部署前提)。下面的走读用主线的示例请求 R1：提示词 4 个 token 的一条请求，设定见[一条请求](one-request.md#示例请求-r1-与官方双机部署)。

### 从最后一层走到 lm_head

**第 44 层结束后，四条残差流先取平均折回一条，再做一次最终 RMSNorm；执行侧只挑出要打分的那几行送进 lm_head。**

GLM 在层与层之间传四条残差流，最后一层末尾把四条取平均，变回每个位置一条 4096 维的隐藏向量，再做最终 RMSNorm，见[层与隐藏表示](layers-and-hidden.md#很多层叠起来hidden-怎样从头走到尾)。这时 TP 组里 8 张卡手里是同一份完整的隐藏向量：每层末尾的 TP 通信已经把各卡的结果合齐了。

要打分的行由执行侧按请求挑出。R1 的 prefill（第一次把整段提示词一起算的那一步，见 [prefill](prefill.md)）一次送进 4 个位置，只有最后一个位置要出 token，lm_head 只算 1 行；之后的 decode 步开着 MTP（GLM 自带的草拟层，每步先猜 3 个候选 token，本节最后专门讲它），每步是 1 个确定的 token 加 3 个候选，4 个位置都要打分，前 3 行用来验证候选，第 4 行留给候选全对时多出的那个 token。prefill 这 1 行的形状见[最终归一化与词表投影](one-request.md#最终归一化与词表投影)，decode 步为什么出 4 行见[一次前向的通信账](one-request.md#一次前向的通信账)。

每张卡上从最后一层到采样的先后如下。左边一列是本部署走的默认路径，右边两条是开关打开时的分支，本部署不经过，放在本节最后讲：

```wiki-diagram
file: lm-head-flow
```

### 每张卡存 19360 个词，算出来的就是最终分数

**154880 正好被 8 整除，每张卡存其中 19360 个词的行；每张卡算出的是这 19360 个词的完整分数，不是要和别的卡相加的部分和。**

每卡 19360 个词不在本页重算：154880 ÷ 8 = 19360，这笔推导连同每卡区间和字节见[张量并行的词表出口](tensor-parallel.md#词表入口求和出口拼接)和 [embedding 的 GLM 一节](embedding.md#放到-glm-双机8-张卡怎么查同一张表)。切之前，vLLM 会把词表长度补到 64 的倍数再平均分给各卡；154880 本来就是 64 和 8 的倍数，不用补任何空行，流程图里「去掉词表补齐的列」这一步什么也不删。卡 0 存第 0 到 19,359 号词，卡 1 存第 19,360 到 38,719 号词，依此类推，卡 7 存第 135,520 到 154,879 号词。

```wiki-diagram
file: lm-head-split
```

每张卡上这一段是 [19360, 4096] 的权重，按 BF16 算约 151.25 MiB。W8A8 量化的主要是 MLP 和部分注意力投影；按原版权重里「不转换」的清单推断，lm_head 和嵌入表一样不量化，仍存 BF16。两张表每卡各占一份，整卡的账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

为什么各卡的分数不用相加：一个词的分数只和这个词那一行有关，而这一行整行都在同一张卡上，隐藏向量的 4096 维也是完整的，点积在本卡就算完了。按矩阵乘的说法，这是沿输出维切，也就是 TP 的列切。入口的嵌入表同样按词表切，却要把 8 张卡的结果相加，因为查表切的是输入那一维；两者的对照见[张量并行的词表一节](tensor-parallel.md#词表查表后相加打分后拼接)。

### All-Gather 把 8 段拼回 154880 个分数

**本卡乘完以后，一次 TP8 All-Gather 把 8 段按词编号首尾相接，8 张卡都拿到同一份完整的分数，再各自做同样的采样。**

All-Gather（全收集）让每张卡交出自己的一段、收回所有卡的段，按卡的顺序拼好，见[集合通信](collective-communication.md#all-gather)。这里卡的顺序就是词编号的顺序，拼出来的第 j 个分数就属于第 j 号词。vLLM 的平台接口默认用 All-Gather，而不是只收到一张卡上的 Gather，Ascend 没有改这个默认值，所以 8 张卡都有完整分数。

R1 的量：prefill 只打 1 行分，每卡本地 [1, 19360]，BF16 是 38,720 B，拼完是 [1, 154880]、309,760 B；decode 打 4 行，每卡本地 154,880 B，拼完是 [4, 154880]、1,239,040 B，约 1.18 MiB。prefill 那 1 行的数在[一条请求](one-request.md#最终归一化与词表投影)推导，decode 4 行的数连同这次 All-Gather 在整次前向里的位置见[张量并行的 R1 通信账](tensor-parallel.md#从一层走到整次前向r1-的通信账)。

TP 组 {0…7} 和 {8…15} 各在一台机器里，两台机器各服务自己那组请求，各自存一份完整的、切成 8 段的 lm_head，这次 All-Gather 也只在机器内部发生，不跨机。

### 为什么这一步「算得少、读得多」

**R1 decode 一步里，每张卡为 4 行分数只做约 0.63 GFLOP 的运算，却要把本卡 151.25 MiB 的 lm_head 权重完整读一遍；每读 1 字节权重只做 4 次运算，时间主要花在读权重上。**

```calc
title: R1 decode 一步里，每卡 lm_head 的算与读
每卡运算次数（乘和加各算 1 次） = 2 × 4 × 4096 × 19360 = 634,388,480 次 ≈ 0.63 GFLOP
每卡要读的权重 = 158,597,120 B ≈ 151.25 MiB
每读 1 字节做的运算 = 634,388,480 ÷ 158,597,120 = 4 次
```

每个权重数占 2 字节，被 4 行各用一次，每次一乘一加，所以每字节正好做 4 次运算，这个数就等于打分的行数。读一遍权重只换来这么少的运算，这一步的时间主要花在把权重从显存读出来，而不是乘加本身。行数变多时，同一次读取被更多行复用，每字节的运算次数跟着行数一起涨，见[权重被复用几次](matmul-and-weights.md#一步有多少行权重被复用几次)。

对照 MoE 层：每张卡每层存 18 个路由专家、共 432 MiB，但 R1 这种 4 个 token 的小批量，每卡平均只有 2 行落到本卡专家上，大多数专家这一步根本不读，见[一条请求的 MoE 站](one-request.md#42-层-moe每卡-18-个专家)。lm_head 不到每卡权重（约 20.58 GiB）的 1%，却每一步都被整张读一遍。

### MTP 用的是同一张 lm_head

**MTP 层没有自己的一份输出权重：加载完成后，草拟模型的输出头被换成主模型的 lm_head，模型文件里也没有另一份。所以它不多占显存，草拟时打分也走上面同一条路。**

MTP 是 GLM 主干之外的第 45 层，用来一次猜出后面几个候选 token，见 [GLM 的 MTP](glm-5-3-flash.md#mtp主干之外的第-45-层)。它在构造时也建了一个输出头，但这个头从不单独加载权重：启动时草拟一侧确认方法是 MTP、模型属于 DeepSeek 式 MLA 这一类（Ascend 的补丁让 GLM 也算在内），就把这个输出头整个换成主模型的 lm_head；模型文件里也只有一份 lm_head 权重。MTP 层每卡约 540.75 MiB 的权重里因此不含这 151.25 MiB。

草拟时，MTP 每遍同样先算出本卡那段分数，All-Gather 拼齐，再直接取分数最大的词作为候选，与请求自己的温度设置无关。三遍的细节见[一条请求第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

### 两个默认关着的开关

**Ascend 还提供两条改写 lm_head 通信的路：给输出头单独设 TP 规模，或者不拼齐分数、让采样按分段做。固定部署两个都没设，走的是上面的默认路径。**

- **给输出头单独设 TP 规模。** 这属于[细粒度 TP](fine-grained-tp.md#不同模块需要不同通信)：输出头换到一个自己的分组上切，先收集组内各卡的隐藏向量，分段打分，再用 All-to-All 把每行分数送回它所属的卡。它只允许 MoE 模型用，规模还要能整除 DP 数。默认规模是 0，表示输出头跟着整体的 TP8 走。
- **采样归约。** 不拼齐分数，各卡留着自己那段，采样按分段完成。前面讲过的「贪心只要最大值」就用在这里：MTP 草拟取最大时，每张卡只交出本段的最大值和它的编号，8 对数一比就选出全局最大。这个开关默认关；固定部署没有传任何 Ascend 配置，它就保持关闭，见[落到 GLM 双机的 Ascend 配置](ascend-config-system.md#落到-glm-双机一个-json-键都没传)。

## 常见误解

- **「lm_head 输出的就是概率。」** 它输出 logits，只能比大小，可以是负数，加起来也不是 1；概率要经过 softmax 才有，贪心取最大时连 softmax 都不用算。
- **「每个位置都要过 lm_head。」** 只有要出 token 的行才打分。R1 的 prefill 送进 4 个位置，只算最后 1 行；带 3 个候选的 decode 步算 4 行。
- **「lm_head 和嵌入表形状一样，就是同一份权重。」** 形状一样只说明可以共用。GLM-5.3-Flash 的配置写明不共用，两张表各占一份显存。
- **「按词表切开以后，各卡的分数是部分和，要 All-Reduce 相加。」** 一个词的那一行整行在同一张卡上，点积在本卡就算完了；各卡交出的是不同词的分数，用 All-Gather 拼接。要相加的是入口的嵌入表。
- **「All-Gather 之后只有一张卡拿到完整分数。」** Ascend 沿用平台默认的 All-Gather，8 张卡都有同一份完整分数，各自做同样的采样。
- **「lm_head 运算量小，不占时间。」** decode 时它受读权重所限：每一步都要把本卡 151.25 MiB 整张读一遍，只为 4 行分数。
- **「MTP 有自己的一份 lm_head，要多算 151.25 MiB。」** 草拟一侧的输出头在启动时被换成主模型的 lm_head，模型文件里也只有一份。
- **「W8A8 部署里 lm_head 也是 8 位整数。」** 按原版权重的不转换清单推断，它和嵌入表一样仍是 BF16。

## 对照源码

### 怎么开

lm_head 不需要开关。固定 GLM 实现只在流水线并行的最后一段按配置的 `vocab_size` 与 `hidden_size` 建一个 `ParallelLMHead`，并配一个 `LogitsProcessor`；配置里没有 `logit_scale`，按 1.0 处理，分数不缩放。[S1][C2] 本部署没开流水线并行，唯一的一段就是最后一段；其他段上换成占位层，不建这张表。`compute_logits` 把选出的行交给 `LogitsProcessor`，权重共享开关 `tie_word_embeddings` 为真时加载会跳过 `lm_head.` 开头的权重，GLM 为假，照常加载。[C3] 执行侧先按 `logits_indices` 取行，再调 `compute_logits`。[C14]

Ascend 在注册表里把 `ParallelLMHead`、`LogitsProcessor` 换成 `AscendParallelLMHead`、`AscendLogitsProcessor`。[C10] 前者和上游的差别只在构造：按开关选通信组，默认就是整体的 TP 组，所以每卡行数是词表除以 8。[C9] 后者的 `_get_logits` 先看细粒度输出头 TP 是否打开（`lmhead_tensor_parallel_size` 大于 0 才算开），默认走 `_get_logits_normal`：`quant_method.apply` 做本卡乘法，`enable_reduce_sample` 为假时调上游的 `_gather_logits`，再切到 `org_vocab_size`；`enable_reduce_sample` 默认为假。[C8][C12] 上游 `_gather_logits` 在 `use_all_gather()` 为真时发 `tensor_model_parallel_all_gather`，平台接口默认返回真，Ascend 没有覆写。[C5][C6]

### 会报什么错

- `LMHead's weights should be used in the sampler.`：RuntimeError。`ParallelLMHead.forward` 故意抛这个错：lm_head 不能像普通层那样直接调用，它的权重只能由 `LogitsProcessor` 通过量化方法的 `apply` 使用。[C4]
- `Target language model does not expose lm_head required by the MLA MTP draft model.`：AttributeError。MTP 草拟要借主模型的 lm_head，主模型没有这个属性时启动失败。[C15]
- `The finegrained tp sizes can be enabled only for MOE models.`、`finegrained tp sizes must divide by data_parallel_size.`：AssertionError，给输出头设细粒度 TP 规模时的两条前置检查。[C13]
- v0.23 维护分支和 main 上，打开 `enable_reduce_sample` 会先打一条实验特性警告；同时设了 `lmhead_tensor_parallel_size` 会抛 ValueError（两者不兼容），在 PD 分离的 KV 发送端打开也会抛 ValueError。`db701c1f` 与 v0.26 没有这几条检查。[C20][C24]

### 开销和什么时候别开

- **常驻显存。** 每卡 151.25 MiB（BF16），与嵌入表各一份，不随 batch 变化。[D]
- **每步读取。** 本卡那段权重每一步完整读一遍；R1 decode 每读 1 字节只做 4 次运算，受读权重所限，行数越多越划算。[D]
- **通信。** 每次前向一次 TP8 All-Gather，R1 prefill 每卡发出 38,720 B，decode 发出 154,880 B，随打分行数线性增长。[D]
- **细粒度输出头 TP。** 代码注释说它面向纯 DP 的场景：把输出头分到自己的分组上切，让每卡只存输出头的一段，代价是多一次隐藏向量收集和一次 All-to-All，且只能用于 MoE 模型、规模须整除 DP 数。固定部署已经按 TP8 切了输出头，不需要它。
- **采样归约。** 省掉拼齐完整分数的那次 All-Gather，采样按分段完成；它是实验特性，不能和细粒度输出头 TP 同开，在本部署上的收益没有实测数。

### 版本差异

核对的是 Ascend 侧的打分路径和 GLM 模型代码。GLM 双机的数字固定在执行侧 `db701c1f`（含 GLM 代码的独立提交）和控制流 `0fc695fc`；下表的 main 是仓库约定的固定提交。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad | 对使用者意味着什么 |
| --- | --- | --- | --- | --- |
| GLM 模型代码 | 无 | 无 | 在 `models/glm5next/`，同样建 `ParallelLMHead`，`logit_scale` 从配置读[C25] | GLM 的数只在 `db701c1f` 和 main 上能对照 |
| 默认打分路径 | 本卡乘 → All-Gather → 去补齐[C19] | 同上，多出 `_apply_head` 钩子[C21] | 同上；输出头没切（每组 1 卡）时跳过 All-Gather，另有 `skip_gather` 参数让调用方拿本卡未拼的结果[C23] | TP8 下三版的通信一样 |
| 采样归约开关 | 默认关，带实验警告和两条互斥检查 | 默认关，没有检查[C22] | 默认关，检查同 v0.23[C24] | 固定部署三版都不开 |
| MTP 草拟取最大 | 无 GLM | 无 GLM | GLM 的 MTP 模块提供按分段取最大的接口：各卡本地取最大，再交换每行 2 × TP 个值与编号，不拼齐完整分数[C26] | 由谁调用取决于配套的 vLLM，见待核 |

`db701c1f` 的默认路径与 v0.23 相同，采样归约没有检查；MTP 草拟默认先拼齐分数再取最大，只有打开采样归约才改走分段取最大。[C16]

### 源码位置

阅读顺序：`models/glm5_next.py` 里 `AscendGlm5NextForCausalLM` 的构造函数建 `lm_head` 和 `logits_processor`，同一个类的 `compute_logits` 只有一行调用；`worker/model_runner_v1.py` 按 `logits_indices` 取行后调用它；然后看 `ops/vocab_parallel_embedding.py` 的 `AscendLogitsProcessor` 两条路径，最后是上游 `logits_processor.py` 的 `_gather_logits` 和 `vocab_parallel_embedding.py` 的 `ParallelLMHead`，后者的 `tie_weights` 就是共享权重时的做法。MTP 共用输出头看 `spec_decode/llm_base_proposer.py` 里替换 `shared_head.head` 的那段，草拟取最大和分段取最大的 `greedy_sample` 在同一个文件；温度与贪心的分流在上游 `v1/sample/sampler.py` 的 `sample`。

数值出处：154880、4096 与权重共享为 false 来自固定 revision 的模型配置；[S1] 19360 行、151.25 MiB、38,720 / 309,760 / 154,880 / 1,239,040 B、0.63 GFLOP 与每字节 4 次由这些形状与精度推导；[D] lm_head 为 BF16 按原版权重的不转换清单推断；[I] 6 个词的小词表、h 与权重里的数、softmax 算出的概率都是教学假设，与任何实际权重无关。[A]

待核：固定部署实际使用的 W8A8 量化描述文件本机没有，lm_head 为 BF16 仍是推断；main 配套的 vLLM 在 MTP 草拟时是否调用分段取最大的接口，没有核到调用方；lm_head 这一步在 A2 上的实测耗时和访存占比没有现场数据。
