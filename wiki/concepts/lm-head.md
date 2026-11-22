---
id: lm-head
title: lm_head：把最后的隐藏向量变成每个 token 的分数
type: concept
legacyAnchors:
  放到-glm-双机154880-个词的分数怎样算出来: 复杂异构实战对照
summary: >-
  lm_head 把末层隐藏向量投影到词表空间得到 logits。本页先用 4 维 6 词小例演示打分与采样，再以 Qwen3-8B 的末层
  RMSNorm、独立 lm_head [4096, 151,936]、TP 词表列切与 Prefill 末位精选讲清主干，最后对照 GLM 双机 TP8
  与 MTP 共享输出头。
aliases:
  - lm_head
  - lm head
  - LM head
  - 输出头
  - 语言模型头
  - 词表投影
  - 输出投影
  - logits
  - ParallelLMHead
  - unembedding
chapters:
  - '03'
order: 90
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2454-L2467'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2515-L2532'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L510-L574
  - 'vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L30-L104'
  - 'vllm@0fc695fc:vllm/platforms/interface.py#L858-L862'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L252-L283'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L341'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L64-L135'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L749-L750'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L877-L878'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L320'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L570-L574'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2326-L2327'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1260-L1299
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L121-L136'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L243-L302'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L341'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L324-L339'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/vocab_parallel_embedding.py#L285-L349'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L344-L349'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py#L373-L449'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L805-L820'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L848-L857'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L184-L197'
  - >-
    raw:sha256-7ce8d42352868661ff2d05ff5aca7b71feaa468f0ae4556e91a3b0af79dbddef.md#L1-L645
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/model_executor/layers/vocab_parallel_embedding.py#L563-L569
  - >-
    raw:sha256-5a2db3d2ca32498a221b69cef8b6affb7c7c673fcf35a4b9247f983c606a50ab.md#L1-L655
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L92-L133'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/vocab_parallel_embedding.py#L535-L610'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L956-L964'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L849-L857'
  - 'https://modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json'
  - 'https://modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L515'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L458-L465'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1158-L1171'
  - 'vllm@84030bbe:vllm/model_executor/layers/logits_processor.py#L201-L251'
  - 'vllm@84030bbe:vllm/v1/spec_decode/llm_base_proposer.py#L424-L442'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L1325-L1377'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L1573-L1583'
  - 'vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L1714-L1742'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L580-L586'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2738-L2742'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L5399-L5501'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/vocab_parallel_embedding.py#L459-L630'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L582-L583'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1334-L1335'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L849-L860'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/mtp.py#L184-L197'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/vocab_parallel_embedding.py#L420-L590'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1440-L1452'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L945-L958'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/mtp.py#L219-L232'
  - >-
    vllm@ced6857a:vllm/model_executor/layers/vocab_parallel_embedding.py#L568-L629
  - 'vllm@ced6857a:vllm/model_executor/layers/logits_processor.py#L180-L195'
  - >-
    vllm@ba15685a:vllm/model_executor/layers/vocab_parallel_embedding.py#L582-L647
  - 'vllm@ba15685a:vllm/model_executor/layers/logits_processor.py#L180-L195'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
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
updated: 2026-11-19T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-5a2db3d2ca32498a221b69cef8b6affb7c7c673fcf35a4b9247f983c606a50ab.md
  - >-
    raw/sha256-7ce8d42352868661ff2d05ff5aca7b71feaa468f0ae4556e91a3b0af79dbddef.md
  - >-
    raw/sha256-c4146199ac95311b01a241b68419c6632a6ebe330455efa62eaa15fcfe41954c.md
---

## lm_head 是什么？

**lm_head（language model head，语言模型的输出头，也叫词表投影）是模型最后一步的一次矩阵乘：把最后一层交出的隐藏向量，乘一张「每个词一列」的权重，给词表里每个 token 各算一个分数。分数越高，模型越认为这个 token 该接在后面。**

模型给每个位置维护一条向量，也就是一排数，叫隐藏向量（hidden）；每一层把它读进来、改写一遍、交给下一层，见[层与隐藏表示](layers-and-hidden.md)。这排数对模型有意义，对人没有：它不直接说「下一个词是哪一个」。lm_head 就负责把它翻译回词表。

还用[嵌入页](embedding.md)那张 6 项的示意词表：0「我」、1「你」、2「喜欢」、3「猫」、4「看」、5「。」，隐藏向量每条 4 个数。提示词「我喜欢」走完所有层，最后一个位置留下一条向量；lm_head 给 6 个词各打一个分：

```wiki-diagram
file: lm-head-intuition
```

权重里每个词占一列，一列 4 个数，和隐藏向量一样长。隐藏向量和某一列逐位相乘、再全部加起来，得到的一个数就是这个词的分数。6 列各做一次，就得到 6 个分数。图里「猫」得分最高，所以「我喜欢」后面最可能接「猫」。

这些分数叫 **logits**。它们是未归一化的实数，可以为负，加起来也不等于 1，还不是概率。大小次序决定贪心选择，分数之间的差距还会影响换算后的概率。把分数换成概率、再按规则挑出一个编号，是紧接着的采样一步；挑出的编号再由分词器变回文字，见 [token 页](token.md#生成的编号怎样变回文字)。

## 为什么需要 lm_head，代价在哪？

**模型内部只有向量，而生成要回答「下一个是哪个 token」；lm_head 给词表里每一项一个能比较的分数，采样才有东西可挑。代价是这张权重和词表一样宽：同精度时它与嵌入表占一样大的元素载荷，完整词表投影要用到所有词的权重，而真正要打分的往往只有寥寥几行。实际从显存读取多少次，还取决于缓存和内核。**

即使输入与输出共享同一张权重表，`lm_head` 也不是 `embedding` 的逆运算：输入时是按编号直接取一行，输出时则是用经过多层改写后的隐藏向量与各词对应的权重向量逐一做点积，目的是给下一个 token 打分，而不是找回最初输入的编号。

**没有它会怎样。** 最后一层交出的是一排数，没有哪一位对应某个词。要从词表里挑一个，先得给每个候选一个数，数大的更可能被挑中；「给十几万个候选各一个数」这件事，就是 lm_head。

**为什么用乘法打分。** 两排数逐位相乘再相加（点积），结果同时受方向和向量长度影响；在长度相同时，方向越接近，点积越大。训练时，参与损失的位置被要求提高真实下一个 token 的相对概率，前面各层和这张权重一起调整。所以 lm_head 本身是一次线性读出，把前面各层写进隐藏向量的倾向逐词换成分数。

**生成时只对需要的位置打分。** 每个位置都能打分。普通生成且没有请求提示词 logprobs 时，完整提示词最后一个位置的分数用来挑第一个新 token；执行侧会先挑出需要打分的行，再交给 lm_head。若还要返回提示词概率，或验证投机候选，所需行数会增加，不能把“一条请求一行”作为通用规则。

**代价。** 整张权重有「词表大小 V × 隐藏宽度 H」个数。十几万个词、每列几千个数，就是几亿个数；同精度时与嵌入表一样大，常驻权重部署下加载后一直留在显存里。每个待打分位置都和所有词的权重做点积，多卡时由各卡负责自己的词表分片。这是逻辑上的使用量，不等于每行都从显存重读整表。decode 的待打分行数较少时，批内复用机会少，可能对带宽敏感；实际瓶颈还要看内核、缓存、通信和设备轨迹。`Qwen3-8B` 标准路径与异构双机的具体数字见后文两节。

## lm_head 怎么算？用 4 维、6 个词走一遍

**一个分数就是隐藏向量和这个词那一列的点积：对齐的位置相乘，再全部加起来。6 个词做 6 次，合起来就是一次 [1, 4] × [4, 6] 的矩阵乘，得到 [1, 6] 的一排分数。**

如果一次有多个位置需要打分，就把这些位置的隐藏向量按行排在一起。设需要打分的位置数为 N、每条隐藏向量的长度为 H、词表大小为 V，输入便有 N 行、H 列，输出有 N 行、V 列。输出的每一行对应一个输入位置，每一列对应一个 token 编号；增加待打分的位置，只是让同一张输出头权重为更多行计算分数。

下面换上具体的数。隐藏向量和权重里的数都是为演示编的，算法和真实模型相同：

```wiki-diagram
file: lm-head-score
```

**① 拿到隐藏向量。** 最后一个位置的隐藏向量 h = [1.0, 0.5, −1.0, 2.0]。它已经做过最终的归一化：最后一层之后先把整条向量缩放到稳定的数值范围，再送进 lm_head，做法见 [RMSNorm](mlp-residual-norm.md#rmsnorm-怎样调整向量尺度)。

**② 取「猫」那一列，对齐相乘。** 「猫」那一列是 [0.6, 0.2, −0.4, 0.5]。第 1 位 1.0 × 0.6，第 2 位 0.5 × 0.2，依此类推，得到 [0.6, 0.1, 0.4, 1.0]。

**③ 加起来。** 0.6 + 0.1 + 0.4 + 1.0 = 2.1，这就是「猫」的分数。

**④ 其余 5 列照做。** 6 个分数依次是 $[-0.4, -0.5, 0.2, 2.1, 0.8, 1.0]$，对应「我」「你」「喜欢」「猫」「看」「。」。「我」这一列和 $h$ 大体不同向，分数是负的（你、喜欢、看、「。」四列的权重未逐一列出，分数按同样点积算法得出，示意）：

| 候选词 | 与隐藏向量 $h = [1.0,\; 0.5,\; -1.0,\; 2.0]$ 的点积算式 | 得分（logit） |
| --- | --- | --- |
| 「猫」 | $1.0 \times 0.6 + 0.5 \times 0.2 + (-1.0) \times (-0.4) + 2.0 \times 0.5 = 0.6 + 0.1 + 0.4 + 1.0$ | **$2.1$** |
| 「我」 | $1.0 \times 0.2 + 0.5 \times (-0.4) + (-1.0) \times 0.6 + 2.0 \times 0.1 = 0.2 - 0.2 - 0.6 + 0.2$ | **$-0.4$** |

一次送进 n 行（几个位置，或几条请求各自的位置）时，就是 [n, 4] × [4, 6] → [n, 6]：每行各得 6 个分数，同一张权重被这 n 行共用。按一次乘和一次加各计一次运算，计算量约为 2nVH；权重元素数量不随 n 增长。若已读取的权重能在批内充分复用，增加输入行就能摊薄读取成本，但真实读取次数取决于缓存和内核分块。见[点积](matmul-and-weights.md#输出里的一个数是怎么算出来的)与[权重复用](matmul-and-weights.md#一步有多少行权重被复用几次)。

图里把权重画成「每个词一列」，是为了和矩阵乘的写法对上。代码里这张表按「每个词一行」存，形状是 [V, H]，和嵌入表一模一样，乘的时候按转置来用；两种画法是同一组数。

## 分数之后：softmax 与采样怎样挑出一个 token？

**logits 尚未归一化，接下来由 sampling（采样）把这排分数变成一个确定的编号：greedy（贪心）直接挑分数最大的词；随机采样先用 softmax（归一化指数：每个分数取指数、再除以总和）把分数换成一组加起来等于 1 的概率，再按概率抽。采样本身另有专页，这里只看本页那 6 个分数会变成什么。**

$$Z = e^{-0.4} + e^{-0.5} + e^{0.2} + e^{2.1} + e^{0.8} + e^{1.0} = 0.670 + 0.607 + 1.221 + 8.166 + 2.226 + 2.718 = 15.608$$

| 候选词（指数值保留 3 位小数） | 指数值与归一化算式 | 概率 |
| --- | --- | --- |
| 「猫」 | $8.166 \div 15.608$ | $\approx$ **52.3%** |
| 「。」 | $2.718 \div 15.608$ | $\approx$ **17.4%** |
| 「看」 | $2.226 \div 15.608$ | $\approx$ **14.3%** |
| 其余三个（「我」「你」「喜欢」）合计 | $(0.670 + 0.607 + 1.221) \div 15.608$ | $\approx$ **16.0%** |

取指数让分数全变成正数，也把差距放大：「猫」只比「。」高 1.1 分，概率却差不多是它的 3 倍。贪心挑的就是「猫」——softmax 不改变大小次序，贪心不必真算它，在 logits 上找最大值就行；随机抽时「猫」也占一半多的机会，「。」和「看」还有希望。temperature、top-k / top-p 这些让抽取更稳或更活的设置都作用在这排分数上，逐项讲解见 [sampling](sampling.md)；异构双机上采样在哪一步、由谁做，见 [sampling 的 GLM 一节](sampling.md#放到-glm-双机采样在哪一步谁来做)。

「贪心只要最大值」还带来一个省通信的思路：多张卡各算一段分数时，贪心只需每张卡报出自己那段里的最大值和它的编号，比一比就知道全局最大，不必把完整的分数拼齐。标准路径默认先拼齐完整分数，不走分段归约。

如果多个候选并列最高，还需要一致的同分选择规则。所核实现以连续的词表分片按 rank（通信组内的成员编号）顺序排列为前提：各卡先在自己的最高分候选中取最低编号，跨卡比较时再优先选择最低 rank 的获胜项，便能选出全局编号最低的最高分候选。这里利用的是贪心只取最大值的性质；任意概率采样不能直接照搬这套做法。

## lm_head 和 embedding 是同一张表吗？

**两张表形状一样，每个词一行、一行 H 个数，用法相反：embedding 按编号取出一行，lm_head 拿隐藏向量和每一行做点积。有的模型让两者共用同一份数，叫权重共享（tied embeddings）；标准标尺模型 `Qwen3-8B` 不共用，各存一份。**

形状相同，所以可以共用：共用时，一个词在入口拿到的向量，和出口给它打分用的那一行，是同一排数。vLLM 的 `ParallelLMHead` 类本身就是嵌入表类的子类，按词表切、按行存的方式完全一样，要共用时直接让它的权重指向嵌入表。嵌入表那一侧的讲法见 [embedding](embedding.md#这张表占多少查出来的数意味着什么)。

共用的好处是省下一整份 $V \times H$ 的权重。它是训练之前就定下的结构选择，训练好的模型推理时改不了：两张表是否是同一份，决定了训练出来的是哪一组数。例如 `Qwen3-0.6B` 将 `tie_word_embeddings` 设为 `true`（共用省去一半词表显存），而 `Qwen3-8B` 将其设为 `false`，权重文件里独立保存 `lm_head.weight`，入口嵌入表与出口 `lm_head` 各占约 `1.16 GiB`（BF16）；后文异构对照的 GLM-5.3-Flash 同样为 `false`。

## 放到标准模型：Qwen3-8B 的末层归一化、词表切分与出口流转

**在全站 `v0.30.0` 主基线的标准稠密模型 `Qwen3-8B` 上，单条残差流走出第 35 层后先经最终 `RMSNorm`，再按 `logits_indices` 精选采样行送入独立非绑定的 `lm_head`（`[4096, 151,936]`，BF16 整表约 `1.16 GiB`）。普通生成下，Prefill 无论提示词多长，仅取每条请求的末位 1 个 token 过 `lm_head`。**

与嵌入层入口（见 [embedding 的 Qwen3-8B 词表账](embedding.md#放到标准模型qwen3-8b-的词表账与-tp2-查表)）成对称配合，先核对 `Qwen3-8B` 出口投影在单卡（`TP = 1`）与双卡（`TP = 2`）下的静态账（完整模型口径见 [HF 模型目录解剖](hf-model-anatomy.md#完整算账对照qwen3-8b-vs-qwen3-30b-a3b)）：

$$M_{\text{lm\_head}} = 151{,}936 \times 4{,}096 \times 2\text{ B} = 1{,}244{,}659{,}712\text{ B} = 1{,}187.0\text{ MiB} \approx 1.16\text{ GiB}$$

| `Qwen3-8B` 出口 `lm_head` 核算项（BF16，`tie_word_embeddings = false`） | 算式 | 结果 |
| --- | --- | --- |
| 整表元素数与 BF16 权重 | $151{,}936 \times 4{,}096 \times 2\text{ B}$ | **`1,187.0 MiB`**（约 **`1.16 GiB`**） |
| `TP = 2` 每卡词表分片（`ParallelLMHead` 列切） | $151{,}936 \div 2 = 75{,}968$；$151{,}936 \bmod 64 = 0$ | **`75,968` 行 / 卡**（整除 64，无补齐列），每卡 **`593.5 MiB`** |
| 单请求末位 1 行打分（Prefill 末位或 Decode） | `[1, 4096] × [4096, 75968]`（`TP = 2`） | 每卡约 **`0.62 GFLOP`**，理想单次读取口径仅 **`1 FLOP/B`** |
| `TP = 2` 出口一次 `All-Gather` 逻辑载荷（1 行） | 每卡发 `[1, 75968]` BF16，拼回 `[1, 151936]` | 每卡发出 **`148.4 KiB`**，拼齐后 **`296.8 KiB`**（`TP = 1` 为 `0` 通信） |

下面沿请求走完一次 `Qwen3-8B`（`TP = 2`）从末层输出到采样的完整链路：

```wiki-diagram
file: lm-head-flow-qwen3
```

1. **末层 `RMSNorm` 与精选打分行**：第 35 层输出 `[T, 4096]` 经最终 `RMSNorm` 后，执行侧先按 `logits_indices` 抽出需要采样的行。若未请求提示词 logprobs，一条长度 2,048 的 Prefill 请求也只抽出最后 `1` 行 `[1, 4096]` 进 `lm_head`，避免对前 2,047 个位置白算十几万维词表点积。
2. **`ParallelLMHead` TP 列切与 `All-Gather` 拼接**：`TP = 1` 时单卡直接乘完 `[1, 151,936]` 交 `Sampler`；`TP = 2` 时两卡各持半张词表（卡 0 持 `0..75,967`，卡 1 持 `75,968..151,935`），拿同一份 `[1, 4096]` 本地算出真值分数，再用一次 `TP All-Gather` 拼成完整 `[1, 151,936]`。`151,936` 本身被 64 整除，末尾按 `org_vocab_size` 裁剪不删列。
3. **单行算术强度低**：单请求仅打 1 行分时，每卡需要搬运整段 `593.5 MiB` 权重却只做 `0.62 GFLOP`（理想单次读取仅 `1 FLOP/B`），典型对显存带宽敏感；多请求合批把打分行增至 $N$ 行后，整段权重被 $N$ 行复用，算术强度同比例抬升。

## 复杂异构实战对照

当部署升级到多机异构架构（多残差流、更大词表、W8A8 量化与投机草拟层共享输出头）时，核心流程仍是「末层归一化 → 选行 → 按词表列切打分 → `All-Gather` 拼齐」，但每卡切分账目与附加分支会更复杂。下面以例外 B 固定基线的 **GLM-5.3-Flash 双机 TP8** 为对照，看 `[4096, 154,880]` 词表与 MTP 共享输出头怎样落盘：

**GLM-5.3-Flash 的 lm_head 是一张 154880 个词、每个词 4096 个数的独立权重（配置中文本与顶层 `tie_word_embeddings` 均为 `false`）。TP8 把它按词编号切成 8 段，每张卡存连续的 19360 个词；8 张卡拿同一批隐藏向量各算自己那段的分数，再用一次 All-Gather 拼回完整的 154880 个。**

固定部署是两台 Atlas 800 A2、每台 8 张卡，TP8 / DP2 / EP16，权重 W8A8，详见[部署前提](glm-5-3-flash-two-node.md#部署前提)。下面的走读用主线的示例请求 R1：提示词 4 个 token 的一条请求，设定见[一条请求](one-request.md#示例请求-r1-与官方双机部署)。

### 从最后一层走到 lm_head

**第 44 层结束后，四条残差流先取平均折回一条，再做一次最终 RMSNorm；执行侧只挑出要打分的那几行送进 lm_head。**

GLM 在层与层之间传四条残差流，最后一层末尾把四条取平均，变回每个位置一条 4096 维的隐藏向量，再做最终 RMSNorm，见[层与隐藏表示](layers-and-hidden.md#很多层叠起来hidden-怎样从头走到尾)。下面沿用普通 TP、SP 关闭的教学基线，此时 TP 组里 8 张卡持有同一批完整隐藏向量；SP 开启时，层内 token 分片及输出头之前的恢复位置须另查实现，不能把“每层末尾都拿齐”推广过去。

要打分的行由执行侧按请求挑出。R1 的提示词只有 4 个位置，本例 [prefill](prefill.md) 一轮完成；没有请求提示词概率时，只用最后一个位置预测首个输出，lm_head 只算 1 行。prefill 本身是处理提示词的阶段，也可以分多轮完成。之后的 decode 步开着 MTP（GLM 自带的草拟层，每步先猜 3 个候选 token，本节最后专门讲它），每步是 1 个确定的 token 加 3 个候选，4 个位置都要打分，前 3 行用来验证候选，第 4 行留给候选全对时多出的那个 token。prefill 这 1 行的形状见[最终归一化与词表投影](one-request.md#最终归一化与词表投影)，decode 步为什么出 4 行见[一次前向的通信账](one-request.md#一次前向的通信账)。

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

每张卡上这一段是 [19360, 4096] 的权重，按 BF16 算约 151.25 MiB。公开 W8A8 产物的 `9e55cbc8` 与 `3121f187` 两个固定精度描述都将 lm_head 和主干嵌入表标为 FLOAT；结合 BF16 加载基线，这两张表按 BF16 计，不是根据上游 FP8 清单猜测。FLOAT 本身只表示不采用该量化方法，不能脱离加载配置推断 dtype。两张表每卡各占一份，固定来源与整卡账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

为什么各卡的分数不用相加：一个词的分数只和这个词那一行有关，而这一行整行都在同一张卡上，隐藏向量的 4096 维也是完整的，点积在本卡就算完了。按矩阵乘的说法，这是沿输出维切，也就是 TP 的列切。入口的嵌入表同样按词表切，却要把 8 张卡的结果相加，因为查表切的是输入那一维；两者的对照见[张量并行的词表一节](tensor-parallel.md#词表查表后相加打分后拼接)。

### All-Gather 把 8 段拼回 154880 个分数

**本卡乘完以后，一次 TP8 All-Gather 把 8 段按词编号首尾相接，8 张卡都拿到同一份完整的分数，再各自做同样的采样。**

All-Gather（全收集）让每张卡交出自己的一段、收回所有卡的段，按卡的顺序拼好，见[集合通信](collective-communication.md#all-gather)。这里卡的顺序就是词编号的顺序，拼出来的第 j 个分数就属于第 j 号词。vLLM 的平台接口默认用 All-Gather，而不是只收到一张卡上的 Gather，Ascend 没有改这个默认值，所以 8 张卡都有完整分数。

R1 的量：prefill 只打 1 行分，每卡本地 [1, 19360]，BF16 是 38,720 B，拼完是 [1, 154880]、309,760 B；decode 打 4 行，每卡本地 154,880 B，拼完是 [4, 154880]、1,239,040 B，约 1.18 MiB。prefill 那 1 行的数在[一条请求](one-request.md#最终归一化与词表投影)推导，decode 4 行的数连同这次 All-Gather 在整次前向里的位置见[张量并行的 R1 通信账](tensor-parallel.md#从一层走到整次前向r1-的通信账)。

TP 组 {0…7} 和 {8…15} 各在一台机器里，两台机器各服务自己那组请求，各自存一份完整的、切成 8 段的 lm_head，这次 All-Gather 也只在机器内部发生，不跨机。

### 为什么这一步「算得少、读得多」

**R1 decode 一步里，每张卡为 4 行分数做约 0.63 GFLOP 运算，参与计算的本卡 `lm_head` 权重为 151.25 MiB。** 按权重从显存恰读一次的理想复用口径，每字节对应 4 次运算；是否受带宽限制，还要结合设备带宽、算力和实测轨迹判断，不能只凭这个比值下结论：

$$\text{算术强度} = \frac{2 \times 4 \times 4{,}096 \times 19{,}360}{19{,}360 \times 4{,}096 \times 2\text{ B}} = \frac{634{,}388{,}480}{158{,}597{,}120\text{ B}} = 4\text{ FLOP/B}$$

| R1 decode 每卡 `lm_head` 核算项（按权重从显存读一次估算） | 算式 | 结果 |
| --- | --- | --- |
| 每卡运算次数（乘和加各计 1 次） | $2 \times 4 \times 4{,}096 \times 19{,}360$ | $634{,}388{,}480\text{ 次} \approx$ **0.63 GFLOP** |
| 参与计算的权重元素载荷（BF16） | $19{,}360 \times 4{,}096 \times 2\text{ B}$ | $158{,}597{,}120\text{ B} \approx$ **151.25 MiB** |
| 每读 1 字节做的运算 | $634{,}388{,}480 \div 158{,}597{,}120$ | **4 次（4 FLOP/B）** |

每个权重数占 2 字节，被 4 行各用一次，每次一乘一加，所以在这个估算口径下每字节对应 4 次运算。输入输出流量、片上缓存命中和重复加载都未计入；实际耗时还需看设备轨迹。行数变多时有更多批内复用机会，见[权重被复用几次](matmul-and-weights.md#一步有多少行权重被复用几次)。

对照 MoE 层：每张卡每层存 18 个路由专家、共 432 MiB，但 R1 这种 4 个 token 的小批量，每卡平均只有 2 行落到本卡专家上，大多数专家不参与这步计算，见[MoE 站](one-request.md#42-层-moe每卡-18-个专家)。lm_head 不到[每卡主要语言权重子账](glm-5-3-flash-two-node.md#每张卡上放了什么)（3121f187 配方约 20.58 GiB）的 1%，却每次都要为整段词表打分，不能只凭常驻占比判断它的耗时；这份子账还没有计入视觉塔、MTP 旋转矩阵和量化辅助张量等项目。

### MTP 用的是同一张 lm_head

**本部署的 MTP 输出头在加载后引用主模型的 lm_head，不再额外常驻一份输出权重。草拟仍要计算 logits，也需要自己的中间张量和历史状态；共享权重不等于草拟没有额外显存或计算开销。**

MTP 是 GLM 主干之外的第 45 层，用来草拟后续候选 token，见 [GLM 的 MTP](glm-5-3-flash.md#mtp主干之外的第-45-层)。它在构造时也建了一个输出头；启动时草拟一侧确认方法是 MTP、模型属于 DeepSeek 式 MLA 这一类（Ascend 的配置适配把 GLM 也识别为此类），就把这个输出头换成主模型的 lm_head。公开固定权重元数据中也只有一份完整 lm_head 权重，具体核对范围见[模型权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。3121f187 配方下，MTP 每卡约 540.75 MiB 的主要语言权重子账因此不重复计入这 151.25 MiB；旋转矩阵等另计，完整口径见[量化版本与额外权重](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。

草拟时，MTP 每遍同样先算出本卡那段分数，All-Gather 拼齐，再直接取分数最大的词作为候选，与请求自己的温度设置无关。三遍的细节见[一条请求第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

### 两个默认关着的开关

**Ascend 还提供两条改写 lm_head 通信的路：给输出头单独设 TP 规模，或者不拼齐分数、让采样按分段做。固定部署两个都没设，走的是上面的默认路径。**

- **给输出头单独设 TP 规模。** 这属于[细粒度 TP](fine-grained-tp.md#不同模块需要不同通信)：输出头换到一个自己的分组上切，先收集组内各卡的隐藏向量，分段打分，再用 All-to-All 把每行分数送回它所属的卡。它只允许 MoE 模型用，规模还要能整除 DP 数。默认规模是 0，表示输出头跟着整体的 TP8 走。
- **采样归约。** 不拼齐分数，各卡留着自己那段，采样按分段完成。前面讲过的「贪心只要最大值」就用在这里：MTP 草拟取最大时，每张卡只交出本段的最大值和它的编号，8 对数一比就选出全局最大。这个开关默认关；固定部署没有传任何 Ascend 配置，它就保持关闭，见[落到 GLM 双机的 Ascend 配置](ascend-config-system.md#落到-glm-双机一个-json-键都没传)。

下面把 `logits_indices` 精选打分行、TP8 `All-Gather`、权重共享开关 `tie_word_embeddings` 与三组高频误区收在一张总览图里，方便核对整条出口链路：

```wiki-diagram
file: lm-head-fig-gather-and-myths
```

## 常见误解

- **「lm_head 输出的就是概率。」** 它输出未归一化的 logits，可以为负，加起来也不必是 1；softmax 用分数差距换算概率，贪心只取最大时则不必计算 softmax。
- **「每个位置都要过 lm_head。」** 普通生成只给所需位置打分；返回提示词概率会额外计算相应位置。标准 `Qwen3-8B` 的 Prefill 无论提示词多长都只算最后 1 行；GLM 双机 R1 没有请求提示词概率，prefill 送进 4 个位置只算最后 1 行，带 3 个候选的 decode 步算 4 行。
- **「lm_head 和嵌入表形状一样，就是同一份权重。」** 形状一样只说明可以共用。`Qwen3-8B` 与 GLM-5.3-Flash 的配置都写明不共用（`tie_word_embeddings = false`），两张表各占一份显存；只有像 `Qwen3-0.6B` 那样将开关设为 `true` 的模型才共享。
- **「按词表切开以后，各卡的分数是部分和，要 All-Reduce 相加。」** 一个词的那一行整行在同一张卡上，点积在本卡就算完了；各卡交出的是不同词的分数，用 All-Gather 拼接。要相加的是入口的嵌入表。
- **「All-Gather 之后只有一张卡拿到完整分数。」** Ascend 沿用平台默认的 All-Gather，TP 组内各卡（如 `Qwen3-8B` TP2 两卡或 GLM TP8 八卡）都拿到同一份完整分数，各自做同样的采样。
- **「lm_head 运算量小，不占时间。」** `Qwen3-8B` 单行打分按理想单次读取口径仅 1 FLOP/B，GLM 双机 R1 的 4 行分数要使用本卡 151.25 MiB 权重、仅 4 FLOP/B，均可能对带宽敏感；是否位于关键路径仍须测量。
- **「MTP 有自己的一份 lm_head，要多算 151.25 MiB。」** 草拟一侧的输出头在启动时被换成主模型的 lm_head，模型文件里也只有一份。
- **「W8A8 部署里 lm_head 也是 8 位整数。」** 两个固定 W8A8 精度描述均将它标为 FLOAT，本页结合 BF16 加载基线计算它的字节数。

## 对照源码

### 怎么开

lm_head 不需要开关。固定 GLM 实现只在流水线并行的最后一段按配置的 `vocab_size` 与 `hidden_size` 建一个 `ParallelLMHead`，并配一个 `LogitsProcessor`；配置里没有 `logit_scale`，按 1.0 处理，分数不缩放。[S1][C2] 本部署没开流水线并行，唯一的一段就是最后一段；其他段上换成占位层，不建这张表。`compute_logits` 把选出的行交给 `LogitsProcessor`，权重共享开关 `tie_word_embeddings` 为真时加载会跳过 `lm_head.` 开头的权重，GLM 为假，照常加载。[C3] 执行侧先按 `logits_indices` 取行，再调 `compute_logits`。[C14]

Ascend 在注册表里把 `ParallelLMHead`、`LogitsProcessor` 换成 `AscendParallelLMHead`、`AscendLogitsProcessor`。[C10] 前者和上游的差别只在构造：按开关选通信组，默认就是整体的 TP 组，所以每卡行数是词表除以 8。[C9] 后者的 `_get_logits` 先看细粒度输出头 TP 是否打开（`lmhead_tensor_parallel_size` 大于 0 才算开），默认走 `_get_logits_normal`：`quant_method.apply` 做本卡乘法，`enable_reduce_sample` 为假时调上游的 `_gather_logits`，再切到 `org_vocab_size`；`enable_reduce_sample` 默认为假。[C8][C12] 上游 `_gather_logits` 在 `use_all_gather()` 为真时发 `tensor_model_parallel_all_gather`，平台接口默认返回真，Ascend 没有覆写。[C5][C6]

### 会报什么错

- `LMHead's weights should be used in the sampler.`：RuntimeError。`ParallelLMHead.forward` 故意抛这个错：lm_head 不能像普通层那样直接调用，它的权重只能由 `LogitsProcessor` 通过量化方法的 `apply` 使用。[C4]
- `Target language model does not expose lm_head required by the MLA MTP draft model.`：AttributeError。MTP 草拟要借主模型的 lm_head，主模型没有这个属性时启动失败。[C15]
- `The finegrained tp sizes can be enabled only for MOE models.`、`finegrained tp sizes must divide by data_parallel_size.`：AssertionError，给输出头设细粒度 TP 规模时的两条前置检查。[C13]
- 仅在 `v0.23.0` 维护分支（及早期历史快照 `baa023ad`）上，打开 `enable_reduce_sample` 会先打一条实验特性警告；同时设了 `lmhead_tensor_parallel_size` 会抛 ValueError（两者不兼容），在 PD 分离的 KV 发送端打开也会抛 ValueError。`db701c1f` 与 `v0.26.0rc` 的这处配置入口未附上述检查，不能把它当作组合已获支持；`v0.30.0` 主基线（`c09d3e20`）与当前 `main`（`8d6180e2`）已彻底移除 `enable_reduce_sample` 开关与运行分支。[C20][C24]

### 开销和什么时候别开

- **常驻显存。** 每卡 151.25 MiB（BF16），与嵌入表各一份，不随 batch 变化。[D]
- **每步读取。** 按本卡权重恰读一次估算，R1 decode 为 4 FLOP/B；这是复用机会的静态说明，实际流量与瓶颈须由 trace 核对。[D]
- **通信。** 每次前向一次 TP8 All-Gather，R1 prefill 每卡发出 38,720 B，decode 发出 154,880 B，随打分行数线性增长。[D]
- **细粒度输出头 TP。** 代码注释说它面向纯 DP 的场景：把输出头分到自己的分组上切，让每卡只存输出头的一段，代价是多一次隐藏向量收集和一次 All-to-All，且只能用于 MoE 模型、规模须整除 DP 数。固定部署已经按 TP8 切了输出头，不需要它。
- **采样归约。** 省掉拼齐完整分数的那次 All-Gather，采样按分段完成；它是实验特性，不能和细粒度输出头 TP 同开，在本部署上的收益没有实测数。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**正文 GLM 双机绑定算例采用例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`，与四版社区分支分别核对。**

**`v0.30.0` 与 `main` 要区分标准 TP、PCP 词表分片与细粒度 LMHead。** 标准路径仍本卡打分、`TP > 1` 才拼 logits、最后裁原词表；`skip_gather` 提前返回未拼且未裁的本卡结果（上游 `logits_processor.py#L180-L195` 与 Ascend `vocab_parallel_embedding.py` 一致）。`PCP × TP` 分片先做 PCP 词表 All-Gather，再做 TP All-Gather，最后去 padding，这时 PCPManager 已恢复 token 顺序，拼的是词表轴。默认分片开关 `enable_pcp_embedding_lmhead_weight_sharding` 为 `true` 也须 `PCP > 1` 和模块匹配才生效；`disable_tp` 优先返回复制头，避免 DSpark Markov head 被误切。细粒度路径仍交换 hidden 行并 All-to-All 重排 logits，与 PCP 分片互斥；MRV2 batch-sharded sampling 也与启用细粒度 LMHead TP 互斥。固定 GLM `PCP = 1` 的 TP8 数字继续保留。

| 核对项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 默认打分与 `skip_gather` | 本卡乘 → All-Gather → 去补齐[C19] | 同 `v0.23.0`，多出 `_apply_head` 钩子[C21] | 新增 `skip_gather` 提前返回未拼未裁本卡结果；`PCP > 1` 时支持 `_get_logits_pcp_weight_sharding`（`vocab_parallel_embedding.py#L459-L630`） | 延续 `skip_gather`、PCP 词表分片与标准 TP All-Gather（`vocab_parallel_embedding.py#L420-L590`） |
| 细粒度 LMHead TP 开关 | `lmhead_tensor_parallel_size` 默认 `0` | 默认 `0` | 默认 `0`（`ascend_config.py#L1334`），与 PCP 分片及 MRV2 batch-sharded sampling 互斥 | 对齐 `ParallelConfig` 语义：默认改为 `1`（仅 `> 1` 启用，`0` 作为旧配置禁用别名兼容，`ascend_config.py#L1440-L1452`） |
| 采样归约开关 `enable_reduce_sample` | 默认关，带实验警告与互斥检查 | 默认关，无额外检查[C22] | 已移除该配置开关与旧分支 | 延续已移除状态 |
| `ParallelLMHead` 与 `tie_weights` | 上游 `ParallelLMHead.tie_weights` 绑定或返回嵌入层[C4] | 同 `v0.23.0` | 同形（`vocab_parallel_embedding.py#L568-L629`） | 同形（`vocab_parallel_embedding.py#L582-L647`） |
| GLM 模型与 MTP `get_top_tokens` | 维护分支无（镜像 `db701c1f` 单独包含） | 维护分支无 | `models/glm5next/model.py#L849-L860` 建 `ParallelLMHead`；`mtp.py#L184-L197` 提供 `get_top_tokens` | 延续 `models/glm5next/model.py#L945-L958` 与 `mtp.py#L219-L232` |

`db701c1f` 的默认路径与 `v0.23.0` 相同，采样归约没有检查；MTP 草拟默认先拼齐分数再取最大，只有打开采样归约才改走分段取最大。[C16]

`skip_gather` 分支直接返回 `_apply_head` 结果，也绕过后面的 `org_vocab_size` 裁剪。因此，调用方除了确认分数是否已跨设备拼齐，还要确认是否保留了为分片计算补齐的词表位置，不能直接把该返回结果当成原始词表的完整分数。这一条件只针对该分支，不改变前面固定部署的默认路径。

还须区分**模型提供的接口与执行侧实际调用**。上游 `_greedy_sample` 在 `use_local_argmax_reduction` 为真时调用 `get_top_tokens`；该接口先屏蔽补齐项，再收集最大值与全局词编号。所读 Ascend 的 `_run_merged_draft` 中，MTP 首轮及后续默认路径则先 `compute_logits`，再从 logits 采样；旧版开启 `enable_reduce_sample` 时调用的 `compute_draft_token_ids` 也是另一条实现。因此不能把这两个开关视为同一个机制，也不能仅凭模型存在 `get_top_tokens` 就承诺当前 Ascend 路径省掉完整 logits 的通信。

### 源码位置

阅读顺序：`models/glm5_next.py` 里 `AscendGlm5NextForCausalLM` 的构造函数建 `lm_head` 和 `logits_processor`，同一个类的 `compute_logits` 只有一行调用；`worker/model_runner_v1.py` 按 `logits_indices` 取行后调用它；然后看 `ops/vocab_parallel_embedding.py` 的 `AscendLogitsProcessor` 两条路径，最后是上游 `logits_processor.py` 的 `_gather_logits` 和 `vocab_parallel_embedding.py` 的 `ParallelLMHead`，后者的 `tie_weights` 就是共享权重时的做法。MTP 共用输出头看 `spec_decode/llm_base_proposer.py` 里替换 `shared_head.head` 的那段，草拟取最大和分段取最大的 `greedy_sample` 在同一个文件；温度与贪心的分流在上游 `v1/sample/sampler.py` 的 `sample`。

权重绑定方法提供的是共享能力；判断具体模型是否共享，还要看它是否调用此方法，以及配置与权重加载过程。固定上游的非 GGUF 分支把输出头的 weight 指向 embedding 权重，GGUF 分支则直接返回 embedding 模块（来源 4）。这不能证明 GLM-5.3-Flash 实际共享这两张权重。

数值出处：154880、4096 与权重共享为 false 来自固定 revision 的模型配置；[S1] 19360 行、151.25 MiB、38,720 / 309,760 / 154,880 / 1,239,040 B、0.63 GFLOP 与每字节 4 次由这些形状及 BF16 加载基线推导；[D] 两个固定量化描述中的 FLOAT 由来源 34、35 确认。6 个词的小词表、h 与权重是教学假设，softmax 概率由这些数推导，与任何实际权重无关。[A][D]

实现与实测边界：公开精度描述已经核到，但现场加载目录是否对应该 revision、加载后实际占用、A2 上的耗时与访存占比仍需设备记录确认。上面区分了固定源码中的调用路径，没有将静态接口核对当成开关收益或部署验证。

多位置打分中的 N 是实际需要打分的位置数，不等于请求数或提示词总长度。固定上游投影后还要收集分数并裁去补齐词表（来源 5）；具体路径可能含量化、偏置或缩放，所以形状推导不代表完整执行路径或性能测量。

分段贪心先取各 rank 的本地最大值和编号，再收集候选选出全局结果。连续且按 rank 排序的词表分片使同分时可选最低全局编号（来源 17、26、39）；这不证明任意概率采样都能用同样方法归约。固定部署默认关闭采样归约，main 的接口与执行侧路径见上文版本条件。

- 来源 28：vllm@0fc695fc，vllm/model_executor/layers/vocab_parallel_embedding.py，L563–L569。

来源 23 的 `baa023ad:vllm_ascend/ops/vocab_parallel_embedding.py` L386–L449 显示 `skip_gather` 在选择普通或细粒度输出头路径之前直接返回；后两条路径中的词表裁剪因此都不会执行。未据此扩大其他快照或固定部署的启用范围。

来源 36、37 补充细粒度 LMHead TP 的默认 0 与早期快照（`baa023ad`）采样归约默认 false（`v0.30.0` 与当前 `main` 均已移除 `enable_reduce_sample`）；来源 38 给出固定 db 草拟的分段贪心调用。来源 39–43 对照上游最大值接口、上游调用与 Ascend 实际草拟分支；来源 44 是 `v0.30.0` 周期引入的 PCP 词表分片默认值，来源 45 是 GLM 的 MLA 配置适配。上述记录不改变固定部署默认关闭额外采样归约的条件。

提示词 logprobs 的额外打分见来源 46、47：Ascend runner 调用继承的 `_get_prompt_logprobs_dict`，按提示词分块选取所需 hidden 行并另调 `compute_logits`，所以“只给最后一个位置打分”须限定没有请求提示词 logprobs 的普通生成。
