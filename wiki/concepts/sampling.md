---
id: sampling
title: Sampling：从词表分数里定下一个 token
type: concept
legacyAnchors:
  beam-search为什么同时保留几条没写完的候选: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  对数概率怎样读为什么不是置信度百分比: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  记录的是处理前还是处理后怎样装进返回值: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  思考预算怎样让模型转去回答: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  生成式评分用下一个-token-的概率比较候选: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  分数在进-softmax-之前还会被哪些设置改动: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  内置规则不够时怎样接入自己的改分规则: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
  返回的概率记录怎样对应这次选词: 高阶采样、Beam、Logprobs 与生成式评分延伸导览
summary: >-
  模型给词表里每个词打完分，sampling（采样）按请求设置从中定下一个 token。本页先用 6 词小例手算
  temperature、softmax、top-k、top-p 与指数噪声抽取，走通标准 Qwen3-8B（[B, 151936]）单 token
  采样与参数优先级，再落到历史 GLM 双机 8 卡同步采样与 MTP 候选验证。
aliases:
  - sampling
  - 采样
  - 采样器
  - Sampler
  - temperature
  - 温度
  - top-p
  - nucleus sampling
  - 核采样
  - greedy
  - 贪心
  - 贪心解码
  - SamplingParams
  - 采样参数
  - 停止条件
  - EOS
  - top_p
  - top_k
  - top-k 采样
  - seed
  - 请求随机种子
  - 全局随机种子
  - generation_config
  - generation-config
  - 生成配置
  - override_generation_config
  - override-generation-config
  - 生成配置覆盖
  - min_tokens
  - min tokens
  - 最少输出 token 数
  - 最少输出数
  - enable_reduce_sample
chapters:
  - '05'
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - 'https://arxiv.org/abs/1904.09751'
  - 'vllm@0fc695fc:docs/usage/reproducibility.md#L3-L8'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L280-L330'
  - 'vllm-ascend@2c59ff10:docs/source/faqs.md#L167-L202'
  - 'https://numpy.org/doc/stable/reference/random/legacy.html'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L20-L58'
  - 'vllm@0fc695fc:vllm/v1/sample/sampler.py#L228-L302'
  - 'vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L352-L457'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L235-L265'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L428-L548'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L590-L618'
  - 'vllm@0fc695fc:vllm/config/model.py#L1425-L1510'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L523-L576'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L205'
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L117'
  - 'vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L167-L295'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L95-L142'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L830'
  - 'vllm@0fc695fc:vllm/utils/torch_utils.py#L405-L412'
  - 'vllm@568afb3a:vllm/sampling_params.py#L538-L556'
  - 'vllm@ced6857a:vllm/v1/sample/sampler.py#L250-L299'
  - 'vllm@ced6857a:vllm/v1/sample/logits_processor/builtin.py#L167-L371'
  - 'vllm@ced6857a:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@ba15685a:vllm/v1/sample/sampler.py#L308-L355'
  - 'vllm@ba15685a:vllm/sampling_params.py#L660-L685'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L192'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L269-L302'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L256-L263'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2610'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L200-L215'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1290-L1299'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L498-L499'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L286-L302'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L262-L271'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/sampler.py#L45-L115'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/apply_top_k_top_p.py#L8-L38'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/sample/gumbel.py#L27-L260'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: lm-head
    kind: builds-on
    note: 采样吃的那排分数由 lm_head 算出，按词表切 8 份和 All-Gather 拼回以 lm_head 页为准
  - to: token
    kind: builds-on
    note: 采样选出的是一个 token 编号；编号怎样变回文字、GLM 的三个结束编号见 token 页
  - to: attention-qkv
    kind: builds-on
    note: softmax 和「除以一个数调节尖锐程度」在 attention 页先讲过，本页把它用到词表上
contradicts: []
updated: '2026-11-19'
origin: gap
---

## Sampling 是什么：分数出来了，下一个 token 怎么定？

**Sampling（采样）是生成每个 token 的最后一步：模型给词表里每个词打完分，sampling 按请求的设置把这一排分数变成一个确定的 token 编号。可以每次都取分数最高的那个（greedy，贪心），也可以把分数换成概率，只在排在前面的几个词里按概率抽一个。**

普通自回归生成每次确定一个新 token：提示词先由分词器切成编号（见 [token](token.md)），prefill 处理输入并保存历史状态；此后 decode 通常只输入上一枚新 token，配合历史状态续算而不重算前文（投机解码则可一轮验证多个位置）。

新输入查表变成向量（见 [embedding](embedding.md)），再经各层改写。最后一层后，模型用一次矩阵乘法（权重叫 `lm_head`）把预测位置向量映成一排词表分数，称为 logits（计算细节见 [lm_head](lm-head.md)）。分数越高，模型越看好该词接在后面；但它可正可负、总和不为 1，既不是概率，也不是最终选出的词。

举一个缩到最小的例子，沿用 embedding 页那张 6 个词的词表：我、你、喜欢、猫、看、「。」。前面已经写出「我 喜欢」，模型给 6 个词打的分是：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（数是编的；lm_head 页演示乘法时用过另一组分数，这里换成相差 1 的整数，方便手算）。下一个写什么？

```wiki-diagram
file: sampling-intuition
```

图里有两条路。greedy 那一路最简单：谁的分数最高就选谁，这里永远是「猫」。随机那一路多几步：先把分数除以一个叫 `temperature` 的数，调节分数之间拉开的程度；再用 softmax 换成加起来等于 1 的概率；然后只留下排在前面的几个词（`top_k` 按个数留，`top_p` 按累计概率留），把留下的概率重新凑成 1；最后按概率抽签。图里取 `T = 1`、`top_k = 3`、`top_p = 0.8`，走完这几步只剩两个词：「猫」抽中的机会是 73%，「你」是 27%。每一步的数怎么来，后面「怎么算」一节逐个算。

随机选择能给同一个问题保留多种回答的机会，代价是要多处理、筛选整排词表分数，并维护随机数状态；结果复现还受实际分数和取数顺序影响。greedy 省去随机选择，仍需模型算出词表分数。

抽出来的编号就是这一步的输出，也是下一轮的新输入；前文通过保存的历史状态参与计算，模型再给下一个位置打分。普通逐 token 路径这样继续，直到碰上停止条件。所以 sampling 夹在两次前向之间：前向交出一排分数，sampling 交出一个编号，这个编号又成为下一次前向的输入。

## 为什么不总是选分数最高的词？

**greedy 简单：在每一步分数和并列处理相同的条件下，同一个开头会写出同一段话，但也容易绕进重复；反过来，在整张词表上按概率抽，又会时不时抽中排在很后面、接不上文的词。`temperature`、`top_k`、`top_p` 就是在这两头之间调：保留随机，同时把随机限制在靠谱的候选里。**

先看 greedy 的毛病。分数最高只说明「这一步看起来最像」，一步步都取最高，整段话往往平淡；更糟的是，假设模型写出「我喜欢猫。」之后，下一步最高分又是「我」，接着又是「喜欢」「猫」，于是「我喜欢猫。我喜欢猫。……」绕进循环。研究文本生成的论文《The Curious Case of Neural Text Degeneration》（Holtzman 等，2020）专门分析过这种现象：以「每步选最可能的词」为目标的解码，写出来的文字平淡，并且会反复重复。另一个毛病是没有主动引入变化：同一个问题问十遍，在上述分数不变的条件下，greedy 给出同样的回答，无法靠抽签提供不同候选。

反过来，完全按原始概率抽也不行。真实词表有十几万个词，排在后面的每个词单看概率都很小，可是这一长串小概率加起来并不小；这些尾部的词大多接不上文，抽中一次，句子就跑偏，而且后面每一步都得接着这个错词往下写。上面的小例子里，「喜欢」的概率只有 0.4%，抽中就成了「我喜欢喜欢」；词表越大，尾部的总量越可观。

于是有了几个可以按请求调的旋钮：

- **`temperature`**（温度，记作 T）调整个分布的尖锐程度：T 小于 1，领先的词更领先；T 大于 1，分布变平，后面的词机会变多。T 调到 0 就退化成 greedy。
- **`top_k`** 按排名缩小候选范围；并列处理与跨后端边界见[采样进阶](sampling-advanced.md#top-ktop-p-与-min_p静态门槛动态门槛与并列重归一差异)。
- **`top_p`** 把词按概率从高往低累加，留下刚好凑够 p 的那一小撮。它就是上面那篇 2020 年论文提出的 nucleus sampling：候选个数随分布变化，模型很确定时只留一两个，拿不准时多留一些。

代价有两点。一是同一个请求发两次，写出来可以不同；要复现，需要控制随机数的起点（随机种子），还要控制实际分数、算法和取数顺序，后面讲。二是多了一些计算：每一步都要对整排分数做除法和 softmax，`top_p` 还要把整排分数按大小排序，词表越大、一批里的请求越多，排序越费时。

所以 greedy 也有它的用处：对标准答案、做评测时，可以先取消随机选择；请求把 `temperature` 设成 0 就是它。运行间的数值一致性还需要另外控制，后面的随机种子一节会区分这两件事。

## 怎么算：6 个词从分数走到一个 token

**下面采用上游 PyTorch 排序掩码路径做手算：分数除以 `temperature` → 按 `top_k` 留候选 → 在保留集合上算概率并做 `top_p` → 重新归一后抽一个。** 为看清概率变化，先列完整词表的 softmax；上游与 Ascend 普通排序在 `top_k + top_p` 重归一上的差异见[采样进阶](sampling-advanced.md#top-ktop-p-与-min_p静态门槛动态门槛与并列重归一差异)。greedy 跳过随机截断与抽取，直接取处理后分数最高的词。

下面一直用上一节的 6 个词和分数：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（示意）。为了先看清 softmax，第 ① 步先取 T = 1，这时除以 T 什么都不变；第 ② 步再看 T 换成别的数会怎样。

### ① softmax：把分数换成概率

**softmax 把一排分数换成一排概率：每个分数先变成 e 的这个数次方（e ≈ 2.718），再各自除以它们的总和。结果都是正数、加起来等于 1，分数高的词分到的概率大。**

softmax 在 attention 里已经出现过，用来把点积换成权重（见 [attention 怎么算](attention-qkv.md#attention-怎么算跟着一个位置走一遍)）；这里算法完全一样，只是作用对象从位置换成了词表里的词。取 $e$ 的次方有两个作用：负分也变成正数，分数之间差 $1$，结果就差 $e \approx 2.7$ 倍，领先的词被明显放大（$T = 1$ 示意，6 个概率四舍五入后和为 $1.001$，误差来自舍入）：

$$Z = e^3 + e^2 + e^1 + e^0 + e^{-1} + e^{-2} = 20.09 + 7.39 + 2.72 + 1 + 0.37 + 0.14 = 31.71$$

| 候选词 | 分数 $z_i$ | $e^{z_i}$ | $T = 1$ 概率（$e^{z_i} \div 31.71$） |
| --- | --- | --- | --- |
| 猫 | $3$ | $20.09$ | $\approx 0.634$ |
| 你 | $2$ | $7.39$ | $\approx 0.233$ |
| 看 | $1$ | $2.72$ | $\approx 0.086$ |
| 「。」 | $0$ | $1.00$ | $\approx 0.032$ |
| 我 | $-1$ | $0.37$ | $\approx 0.012$ |
| 喜欢 | $-2$ | $0.14$ | $\approx 0.004$ |

有一点值得记住：softmax 只看分数之间的差。6 个分数同时加 10，每个 e 次方都乘上同一个 e¹⁰，除以总和时正好约掉，概率一点不变。所以 logits 的绝对大小没有意义，要紧的是谁比谁高多少。

### ② temperature：先除，再 softmax

**每个分数先除以 T，再做 softmax。两个词概率之比是 $e^{\Delta z / T}$：T 越小，分差被拉得越大、分布越尖；T 越大，分差被压得越小、尾部越厚。T 只改差距，不改先后。**

下面把 `T = 0.5 / 1 / 2` 对同一组 6 词分布的拉尖/压平效果，连同后面第 ④ 步的区间抽签与设备端指数噪声法收在同一张图里对照（`T = 0.5` 时分数先变成 `6, 4, 2, 0, −2, −4` 再做 softmax，其余同理）：

```wiki-diagram
file: sampling-fig-temp-and-axis
```

| 词 | 分数 | T = 0.5 | T = 1 | T = 2 |
|---|---|---|---|---|
| 猫 | 3 | 0.865 | 0.634 | 0.414 |
| 你 | 2 | 0.117 | 0.233 | 0.251 |
| 看 | 1 | 0.016 | 0.086 | 0.152 |
| 「。」 | 0 | 0.002 | 0.032 | 0.092 |
| 我 | −1 | 0.0003 | 0.012 | 0.056 |
| 喜欢 | −2 | 0.00004 | 0.004 | 0.034 |

原理与 attention 里分数除以 $\sqrt{d}$ 再做 softmax 完全相通，只是那里除数固定、这里由请求指定（见[为什么要除以 √d](attention-qkv.md#为什么要除以-d)）。

工程上须留意两条边界：真去除以接近 0 的数会溢出，vLLM 会把 `0 < T < 0.01` 直接抬到 `0.01` 并打告警，只有 `T = 0` 走 greedy 不做除法；另外 T 不改变词的先后顺序，因此 greedy 和 `top_k` 留下的词集与 T 无关，但按累计概率截断的 `top_p` 会随 T 改变保留个数。

### ③ top-k 和 top-p：只留排在前面的词

**`top_k` 按最高分缩小候选范围，`top_p` 按概率累计留候选：从高到低累加，跨过 p 的那一项也保留。** 被截掉的词分数置为 $-\infty$、softmax 后贡献为 `0`，留下的词重新归一。取 $T = 1$、$\text{top\_k} = 3$、$\text{top\_p} = 0.8$ 接着手算（`top_k` 后 $Z_k = 20.09 + 7.39 + 2.72 = 30.20$；`top_p` 后 $Z_p = 20.09 + 7.39 = 27.48$）：

| 候选词 | `top_k` 留 3 项重归一概率 | 累计概率（对比 $p = 0.8$） | `top_p` 截断后最终概率 |
| --- | --- | --- | --- |
| 猫 | $20.09 \div 30.20 \approx 0.665$ | $0.665 < 0.8$（继续） | $20.09 \div 27.48 \approx \mathbf{0.731}$ |
| 你 | $7.39 \div 30.20 \approx 0.245$ | $0.665 + 0.245 = 0.910 \ge 0.8$（留下） | $7.39 \div 27.48 \approx \mathbf{0.269}$ |
| 看 | $2.72 \div 30.20 \approx 0.090$ | 前序已达 $0.8$（截掉） | $0$ |

温度会直接改变 `top_p` 留几个：同样 `top_k = 3, top_p = 0.8`，换作 `T = 0.5` 时前 3 名里「猫」独占 `0.867`，第一个词就跨过门槛、只留「猫」。三种截断的关闭值分别为 `top_k = 0`（也接受 `-1`）、`top_p = 1`、`min_p = 0`，默认全关。关于 `min_p`、同分并列与跨后端重归一分岔，见[采样进阶](sampling-advanced.md#top-ktop-p-与-min_p静态门槛动态门槛与并列重归一差异)。

### ④ 按概率抽一个，和 greedy 对照

**如上图左下所示，把留下的概率排在 `[0, 1]` 区间上（猫 `[0, 0.731)`，你 `[0.731, 1)`），抽均匀随机数 `u` 落进哪段就选哪词（`u = 0.42 → 猫`，`u = 0.85 → 你`）。**

greedy 则跳过 ① 到 ④，直接对处理后的分数取最大值（3 分的猫）。批处理时还要区分「单条 greedy」和「整批 greedy」：只有整批全为 greedy（`all_greedy`）才直接早退；只要混进 1 条随机请求，整批仍须跑完随机路径，最后按每条请求各自的 `temperature` 逐行挑回 greedy 或随机结果。

## 真实实现怎样「按概率抽」？

**如上图右下所示，本页核对的上游 PyTorch 与 Ascend 路径给每个词发一个指数分布随机数 $q \sim \text{Exp}(1)$，计算「概率 $\div\ q$」并取 `argmax`。**

区间法要先算累计和再查表，现成算子 `torch.multinomial` 在昇腾上还会迫使 CPU 停下来等 NPU；昇腾源码注释写明换用指数噪声法就是为了避开这次同步（快慢路径剖析见[采样进阶](sampling-advanced.md#昇腾-npu-采样快慢路径剖析v0300)）。数学上「$p_i / q_i$ 最大」等价于「$q_i / p_i$ 最小」，而独立指数变量 $q_i / p_i \sim \text{Exp}(p_i)$ 中第 $i$ 项最小的概率恰好等于 $p_i / \sum_j p_j$；被截掉的词概率为 `0`，除完仍为 `0`，绝不会胜出。

**全局种子与请求种子控制的是两条不同的随机流。** 全局 `--seed` 在 worker 启动时初始化并持续向前走，不带请求种子的请求共用全局流，因此到达顺序或批组成改变就会改变拿到的随机数段。随机请求自带有效 `seed`（`0` 也有效，`-1` 按未指定处理）时会建独立发生器，但也只固定随机数起点——若模型、输入编号、后端或批次引起 logits 微差，结果仍可能分叉（见 [batch invariance](batch-invariance.md)）；greedy 则不消耗随机流。

## 采样参数从哪来？

**每条请求带着一组采样参数进来（`SamplingParams`）。普通 Chat、Completions 的温度和三种截断，先用请求显式给的数值；省略或传 `null` 时继承服务默认，服务没给才退到中性默认。服务默认又来自模型生成配置与启动覆盖。参数在[入口](api-server-entry.md#怎么做从-json-到一串编号①-到-④)收到请求时就定下来，采样这一步只负责照着用。**

vLLM 的中性默认值是：`temperature = 1`、`top_p = 1`、`top_k = 0`、`min_p = 0`、各种罚分关闭。启动参数 `--generation-config` 默认为 `auto`，会读取模型目录的 `generation_config.json`，但仅提取其中六项（`temperature`、`top_p`、`top_k`、`min_p`、`repetition_penalty`、`max_new_tokens`）替换服务默认，并在启动日志打印警告。想回到中性默认需在启动时设成 `vllm`；`presence_penalty`、`frequency_penalty` 与 `seed` 不在这六项读取名单里。

用一组示意配置沿覆盖顺序走一遍：

| 走到哪一层 | 温度 | 累计概率截断（`top_p`） | 按个数截断（`top_k`） |
|---|---:|---:|---:|
| 模型 `generation_config.json` | 1 | 0.95 | 未写 |
| 启动 `--override-generation-config`（温度 `0.8`、`top_k = 20`） | 0.8 | 0.95 | 20 |
| 请求只显式给 `top_p = 0.8` | **0.8** | **0.8** | **20** |

请求若想关闭服务继承来的截断，必须显式给关闭值，而不是删掉字段。启动改为 `vllm` 模式时模型默认不再参与，但显式 `--override-generation-config` 仍生效；模型的 EOS 等特殊编号另走读取链。Python 直接构造 `SamplingParams(...)` 立即填入自身默认值，不经过 HTTP 合并层；离线需要模型默认时应先调 `llm.get_default_sampling_params()` 再新建覆盖对象。

几个必须知道的约定：
- `temperature = 0` 时参数对象自动把 `top_p`、`top_k`、`min_p` 重置为关闭并走 greedy；`0 < T < 0.01` 被抬到 `0.01` 仍走随机；
- 非法取值在入口直接拒绝：`temperature < 0`、`top_p` 不在 `(0, 1]`、`top_k < -1`、`min_p` 不在 `[0, 1]`；
- 最大输出数 `max_tokens`：Chat 无固定 `16` 默认值，Completions 省略默认 `16`，优先级统一见[入口页的输出预算](api-server-entry.md#怎么开)。

## 什么时候停下来？

**每出一个 token，引擎都检查一遍要不要停。** 在标准 `v0.30.0` 与本页固定 GLM 基线中，输出还没到 `min_tokens` 时先跳过判停。达到 `min_tokens` 后，先检查这个 token 是不是结束 token（EOS）或请求指定的 `stop_token_ids`，命中即正常结束（`finish_reason = "stop"`）。若未命中，再检查长度：输出数达到 `max_tokens` 或总长到达模型上限，即截断结束（`finish_reason = "length"`）。

结束 token（EOS）和普通词一样参与打分与采样；模型生成配置里列出的其他结束编号也并进停止 token 集合。请求设 `ignore_eos = true` 只关闭自动 EOS 判停，手工指定的 `stop_token_ids`、`stop` 字符串与长度上限仍有效（详见[请求收尾](request-teardown.md#停止文字停止编号和忽略-eos-怎样配合)）。举例：提示词「我 喜欢」，`max_tokens = 3`，输出「猫」「。」「我」，第 3 枚一追加即以 `length` 截断，接口返回输出「猫。我」。

- **判断位置分工**：EOS、停止编号与长度在引擎进程（CPU 上的 [EngineCore](vllm-engine-core.md)）逐 token 检查，一步交回多枚 token 时命中处后面的直接丢弃；停止字符串（`stop`）需反分词还原文字，放在前端进程判断（见[流式输出的停止字符串](streaming-output.md#停止字符串先扣住结尾几个字)）。

### 最少输出数怎样挡住提前结束

**`min_tokens` 限制的是“多早允许结束”，不是让模型凑字数。** 采样前，若已生成 token 数尚未达到门槛，采样器把 EOS 与停止编号的分数设为 $-\infty$（greedy 下同样生效），达到门槛后才解除屏蔽。在 `v0.30.0 / main` 与结构化输出组合时存在一处例外：若最少长度屏蔽导致全行没有合法候选，会恢复屏蔽前仍为有限分数的停止编号，使已完成结构可提前收尾。

以 `min_tokens = 2`、`max_tokens = 4` 做普通逐 token 示意（假设模型每步都想结束）：

| 即将选择 | 已有输出数 | EOS / 停止编号能否参与 | 假设实际选出 |
|---|---|---|---|
| 第 1 个 token | 0（`< 2`） | 屏蔽（$-\infty$） | 猫 |
| 第 2 个 token | 1（`< 2`） | 仍屏蔽（$-\infty$） | 。 |
| 第 3 个 token | 2（已达门槛） | 解除屏蔽 | EOS，于是结束 |

计数看的是输出编号（不含提示词，也不等于字符数）；前端对停止字符串同样保护最少长度，在门槛内已完整出现的停止串不触发，跨门槛才补齐的仍会命中。`ignore_eos` 也不关闭这层最少长度屏蔽。注意不要把白名单缩成只剩 EOS 同时设 `min_tokens > 0`，否则交集为空；取消或异常仍会随时中止请求。

## 标准主干走读：Qwen3-8B 的 `[B, 151936]` 单 token 采样

在 `v0.30.0` 标准主基线下，**Qwen3-8B**（词表 `151,936`，默认不启投机解码）每步只为批次里每条请求定下 **1 个** `next_token_id`，整条链路干净直接：

```wiki-diagram
file: sampling-flow-qwen3
```

按图中顺序从 NPU Worker 走到 EngineCore：

1. **拿到完整词表分数**：`lm_head` 输出形状 `[B, 151936]` 的 logits。单卡 `TP=1` 本地直接就绪；多卡 `TP>1` 时经一次 All-Gather 拼齐，各卡分数完全一致。
2. **可选语法掩码与惩罚缩放**：若请求带 JSON/正则[结构化输出](structured-output.md)约束，先由 `apply_grammar_bitmask` 把非法词位置为 $-\infty$；随后 `AscendSampler` 施加重复/频率惩罚，随机采样路径把分数除以 `temperature`。
3. **双路选词**：`temperature = 0` 直接 `argmax` 取最高分；随机路径经 Top-k / Top-p 截断、Softmax 与指数噪声除法后 `argmax`，每条在途请求产出 1 个编号 `[B, 1]`。多卡 TP 共享同一起点的全局随机流，各卡得出相同结果。
4. **单卡回传与 CPU 判停**：多卡部署时仅 `output_rank` Worker 将采样结果交回 `EngineCore`（省去重复的跨进程通信 IPC）。`EngineCore` 逐条追加新 token 并执行 `check_stop`：命中 `Qwen3-8B` 的 `eos_token_id = 151645`、用户 `stop_token_ids` 或 `max_tokens` 即触发收尾退块。

开启投机解码（如 MTP）后，解码步不再是「每条请求 1 行分数」，而是扩展为「多行验证 + 额外采样」——下面以历史 GLM 双机配方展示这条多卡验证路径。

## 放到 GLM 双机：采样在哪一步、谁来做？

本节为例外 B 历史绑定算例：2 台 Atlas 800 A2、每台 8 卡，机内 TP8、跨机 DP2 / EP16（部署前提见 [GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)）。前向结束后，每台机器的 8 张卡都拿到完整的 `154880` 个分数，各自执行同一套采样，仅 0 号卡交回引擎；首步只采 1 行，后续 decode 步还需验证 3 个 MTP 候选。

下面沿用主线示例请求 R1（提示词 4 个 token，教学设定，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)）。

### 分数怎样到每张卡上

**词表投影按词表切给 8 张卡，每张卡只算 `19360` 个词（`154880 ÷ 8`）的分数，再经一次 All-Gather 拼齐；采样前 8 张卡手里的分数完全一致。**

R1 第一步 prefill 无候选，只取最后一个位置，每卡形状 `[1, 154880]`。此后每个 decode 步送进 1 个确定 token 与 3 个候选，4 个位置都要打分，形状为 `[4, 154880]`。单机满载 32 条 decode 请求时每卡为 `[128, 154880]`，BF16 占约 `37.8 MiB`（`128 × 154880 × 2 B`；R1 每步字节数唯一出处见[最终归一化与词表投影](one-request.md#最终归一化与词表投影)）。分数进采样前先转 FP32，R1 单个 decode 步里 3 个验证行转出的 FP32 副本约 `1.77 MiB`（`3 × 154880 × 4 B`）。

### 8 张卡各采一遍，只交回一份

**每张卡由一个 worker 进程驱动，采样与前向是引擎下发给 8 个 worker 的两次调用。** 各卡用相同实现处理相同分数，在随机流与取数顺序一致的前提下得到相同结果。8 张卡都在本地保留结果、紧接着执行 MTP 草拟（省去一次广播），最终只由 0 号卡（`8 - 8 × 1 = 0`）交回引擎。

```wiki-diagram
file: sampling-flow
```

官方教程两台机器均设 `--seed 1024`，使 TP 各卡的全局随机流从同一起点出发。在钉住的 GLM 镜像上，A2 的 top-k/top-p 走 `torch_npu` 融合算子，抽取走指数噪声法；另有两个 `--additional-config` 开关（`enable_reduce_sample` 与 `enable_async_exponential`）默认关闭，不生效。

### 请求不写采样参数时，用的是什么

**GLM 的模型目录（固定 revision `690b7052` 的 `generation_config.json`）写着 `temperature = 1.0`、`top_p = 0.95`，未写 `top_k` 与三类 penalty。教程启动命令未覆盖生成配置，所以请求省略时按 `T = 1`、`top_p = 0.95`、`top_k` 关闭、三类罚分全关来采样。**

套到 6 词小例子（$T = 1$、$\text{top\_p} = 0.95$、示意）：

| 候选词 | 原始概率 | 累计概率（对比 $p = 0.95$） | 截断后重归一概率 |
| --- | --- | --- | --- |
| 猫 | $0.634$ | $0.634 < 0.95$（继续） | **$0.665$** |
| 你 | $0.233$ | $0.634 + 0.233 = 0.867 < 0.95$（继续） | **$0.245$** |
| 看 | $0.086$ | $0.867 + 0.086 = 0.953 \ge 0.95$（留下，后 3 词截掉） | **$0.090$** |

想让 GLM 走 greedy，请求把 `temperature` 设 `0`。因本配方开启了 MTP，随机请求须保持 `min_p = 0` 且不传非空 `logit_bias`（详见[采样进阶](sampling-advanced.md#白名单禁词与分数偏置改偏好-vs-删候选)）。

### 有 MTP 候选时：采样变成验证

**decode 的每一步，每条请求有 4 行分数：前 3 行验证 3 个候选，最后 1 行在候选全部通过时再多采一个额外 token。验证前，前 3 行同样走完改分、`temperature`、`top_k`、`top_p` 管线。**

MTP 草拟每步直接取最高分（见[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)）；下一步主模型算出 4 行目标分数后逐个验证：
- **greedy 请求**：候选等于本行最高分即接受；首次不同则改写为最高分并停下。
- **随机请求**：按候选在本行的目标概率 $p$ 接受（抽均匀随机数 $u \le p$ 接受；否则把被拒编号目标概率置零，从剩余分布重抽）。这对应 GLM 确定性草稿路径（通用带草稿分布的恢复规则见[投机解码](speculative-decoding.md#greedy-验证与随机采样分开理解)）。例如目标分布为猫 `0.731`、你 `0.269`、候选为猫时，合起来输出猫的概率仍精确为 `0.731`。

一次验证最多通过 3 个候选，全过时再用最后 1 行多采 1 枚，每步交回 1 到 4 个 token。注意基线里额外 token 仍按本轮开始时的 `min_tokens` 掩码处理，比普通逐 token 略保守（例如步前已有 1 枚、`min_tokens = 4`，3 个候选全过已达 4，额外第 5 枚仍屏蔽 EOS，下一轮才解除）。

### 停止判断和长度上限

**0 号卡交回结果后，引擎把本步接受的 token 逐个追加并判停，命中即丢弃后续 token。GLM 的结束编号有三个（`154820`、`154827`、`154829`，见 [token](token.md#编号要落在-154880-行之内)），长度上限为 `133120`。**

其中 `154820` 为分词器 EOS，`154827` / `154829` 并入 `stop_token_ids`，三者命中均记 `finish_reason = "stop"`。chat 请求不写 `max_tokens` 时最多生成 `133120 - prompt_len`。接近总上限时 MTP 超出上限的候选作废，调度器同步截断本步送入模型的 token 数。

## 高阶采样、Beam、Logprobs 与生成式评分延伸导览

当基础的 `temperature`、`top_k`、`top_p` 与停止条件不够用时，vLLM 在采样管线前后与入口层扩展了七组专题能力；完整公式、手算反例、参数表与四版边界统一收拢在两篇拆分子页：

- **白名单、禁词与分数偏置**：`allowed_token_ids`、`bad_words`（末尾 token 拦截与双重分词）与 `logit_bias`（与投机解码互斥）的执行次序与叠加冲突，见[白名单、禁词与分数偏置](sampling-advanced.md#白名单禁词与分数偏置改偏好-vs-删候选)。
- **三类重复惩罚**：`repetition_penalty` → `frequency_penalty` → `presence_penalty` 的先后顺序、提示词 vs 输出统计范围及 MTP 暂接历史规则，见[三类重复惩罚](sampling-advanced.md#三类重复惩罚公式差别与小算例)。
- **自定义 `LogitsProcessor`**：批级处理器接口、`BatchUpdate` 行号同步、`is_argmax_invariant` 两阶段放置与 `vllm_xargs` 传参，见[自定义 LogitsProcessor](sampling-advanced.md#自定义-logitsprocessor批次状态同步与两阶段接入)。
- **`min_p` 与 Top-k/Top-p 跨后端差异**：相对峰值门槛 `min_p`、并列保留规则，以及上游 PyTorch 与昇腾普通排序在 `k=2, p=0.7` 下的重归一分岔，见[Top-k、Top-p 与 min_p](sampling-advanced.md#top-ktop-p-与-min_p静态门槛动态门槛与并列重归一差异)。
- **思考预算（`thinking_token_budget`）**：如何在推理段用满预算后逐枚抬高 `reasoning_end_str` 切回回答（及 `v0.23/v0.26` Ascend 未接通 vs `v0.30.0+` 生效边界），见[思考预算](sampling-advanced.md#思考预算thinking_token_budget怎样推动模型从思考转向回答)。
- **对数概率（Logprobs）与外置 Beam Search**：$\ln(p)$ 口径、四模式 `--logprobs-mode`、`FlatLogprobs`、`logprob_token_ids` 及 MTP 边界见[Logprobs 专题](sampling-advanced.md#logprobs-四模式扁平容器与指定编号查询)；多路径扩展与含提示词分母长度惩罚见[V1 外置 Beam Search](sampling-advanced.md#v1-外置-beam-search多路径扩展与含提示词长度惩罚)。
- **NPU 采样快慢路径**：昇腾排序截断与指数噪声快慢路径差异见[昇腾快慢路径](sampling-advanced.md#昇腾-npu-采样快慢路径剖析v0300)。
- **生成式评分（`/generative_scoring`）**：复用生成模型下一 token 概率比较候选标签（及与池化 `/score` 的分界），见[生成式评分](pooling-and-non-ar.md#生成式评分generative_scoring与-pooling-score-的边界及概率比较)。

## 常见误解

- **「logits 就是每个词的概率。」** logits 是分数，可正可负，加起来不等于 1；经 softmax 才是概率，且只看分数之差。
- **「`temperature` 改的是模型算出来的分数。」** 前向算出的分数不受它影响，温度只在采样时做除法，且不改先后顺序，故 greedy 结果与温度无关。
- **「`top_p = 0.8` 就是留下前 80% 的词。」** p 是累计概率，不是词数比例；跨过 p 的那一项也留下，留几个随分布和 `temperature` 而变。
- **「`temperature` 设成 0，`top_k`、`top_p` 还在起作用。」** `temperature = 0` 会先把合法截断归零走 greedy；`0 < T < 0.01` 则抬到 `0.01` 仍走随机。
- **「8 张卡各采一遍会抽出 8 个不同的 token。」** 相同分数、相同实现配合同一全局随机流与取数顺序得到一致结果；仅 0 号卡交回引擎。
- **「请求固定了 `seed`，结果就一定逐字复现。」** `seed` 只固定随机数起点；批次与归约导致的 logits 微差仍会改写结果，见 [batch invariance](batch-invariance.md)。
- **「MTP 草拟只取最高分，开了 MTP 的随机请求会变 greedy。」** 候选须按请求的目标概率接受/拒绝并重抽，最终分布与直接采样一致。
- **「返回的 `logprobs` 就是抽签用的概率。」** 默认 `raw_logprobs` 抓取的是改分与温度缩放之前的原始分布（详见[采样进阶](sampling-advanced.md#logprobs-四模式扁平容器与指定编号查询)）。
- **「结束 token 和停止字符串都在加速卡上判断。」** EOS、停止编号与长度在引擎进程（CPU）判停；停止字符串在前端进程反分词后判断。

## 对照源码

同输入得到不同输出时，先保存模板处理后的实际输入编号与最终生效参数再比对首次分歧，完整排查见[输出异常排查](inference-correctness-troubleshooting.md)。

### 怎么开

核心采样参数均为逐请求字段（不放进 Ascend `additional_config`）：

| 参数 | `SamplingParams` 默认与范围 | 普通 HTTP 省略 / `null` | 关闭与特殊值 |
|---|---|---|---|
| `temperature` | `1.0`；`v0.23` 非负，`v0.26+` 有限且 `[0, 2]` | 先服务默认，再 `1.0` | `0` 选 greedy；`1` 不缩放；`0 < T < 0.01` 抬到 `0.01` |
| `top_p` | `1.0`；`(0, 1]` | 先服务默认，再 `1.0` | `1` 关闭；`0` 非法 |
| `top_k` | `0`；整数 `>= -1` | 先服务默认，再 `0` | `0` 或 `-1` 关闭；超词表按词表截断 |
| `min_p` | `0.0`；`[0, 1]` | 先服务默认，再 `0.0` | `0` 关闭；开启 MTP 时 `min_p > 1e-5` 拒绝 |
| 请求 `seed` | `None`；整数或 `None`，`-1` 归一为 `None` | `None`（不继承全局种子） | `0` 有效；HTTP 限有符号 64 位整数 |
| `min_tokens` | `0`；非负整数且 `<= max_tokens` | `0`（HTTP 不接受 `null`） | `0` 关闭；离线 `max_tokens=None` 时跳过大小检查 |

**启动级生成默认与全局种子**（三项均不在 Ascend `additional_config` 中）：

| 启动 CLI / Python `LLM` 关键字 | 默认与合法形状 | 怎样生效 |
|---|---|---|
| `--generation-config` / `generation_config` | `auto`（可选 `vllm` 或配置目录/仓库） | `auto` 读模型 `generation_config.json`（缺失遇 `OSError` 回退模型 `config`）；`vllm` 跳过模型采样默认；仅提取 `temperature/top_p/top_k/min_p/repetition_penalty/max_new_tokens` 六项 |
| `--override-generation-config` | JSON 对象 / dict，默认 `{}` | 按键覆盖读到的默认；`vllm` 模式仍生效；覆盖字典给 `null` 会清除模型默认再过滤回中性值 |
| `--seed` / `seed` | 整数默认 `0`（初始化调 `np.random.seed`，用 `0 <= seed < 2^32`） | 初始化全局随机流（双机须保持一致，GLM 教程两端为 `1024`）；无 `-1` 归一语义 |

离线保留模型默认并覆盖时，先取 `defaults = llm.get_default_sampling_params()` 再新建 `SamplingParams(...)` 以重跑初始化校验（直接改旧对象属性不会重跑温度归一化和校验）：

```python
from vllm import SamplingParams

defaults = llm.get_default_sampling_params()
params = SamplingParams(
    temperature=0.8,
    top_p=defaults.top_p,
    top_k=defaults.top_k,
    min_p=0.0,
    repetition_penalty=defaults.repetition_penalty,
    max_tokens=64,
    seed=2026,
)
outputs = llm.generate(["用一句话描述一只正在休息的猫。"], params)
```

HTTP 传 `top_k` / `min_p` / `min_tokens` 等扩展字段时，兼容 SDK 放 `extra_body`，线上 JSON 仍在顶层：

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "用一句话描述一只正在休息的猫。"}],
  "max_completion_tokens": 64,
  "temperature": 0.8,
  "top_p": 0.8,
  "top_k": 20,
  "min_p": 0.0,
  "min_tokens": 16,
  "seed": 2026
}
```

```bash
# 在 GLM 双机启动命令基础上追加生成默认覆盖示意（两节点保持同步）
--generation-config auto --override-generation-config '{"temperature":0.8,"top_k":20}' --seed 1024
```

高级特性（惩罚项、白名单/禁词/偏置、思考预算、自定义 `LogitsProcessor`、Logprobs、Beam Search）的详细入口见[采样进阶「怎么开」](sampling-advanced.md#怎么开)；生成式评分见[Pooling 与非自回归「怎么开」](pooling-and-non-ar.md#怎么开)。

### 会报什么错

- `temperature must be non-negative`、`temperature must be in [0, 2]`（`v0.26+`）、`temperature must be a finite number`、`top_p must be in (0, 1]`、`top_k must be 0 (disable), or at least 1`、`min_p must be in [0, 1]`：采样参数非法，入口直接拒绝。
- `The min_p and logit_bias sampling parameters are not yet supported with speculative decoding.`：开启 MTP 等投机配置时，`min_p > 1e-5` 或非空 `logit_bias` 被拒绝。
- `min_tokens must be greater than or equal to 0`、`min_tokens must be less than or equal to max_tokens=...`：`min_tokens` 非法或超过生效输出上限（HTTP 不接受 `null`）。
- `Input length (...) exceeds model's maximum context length (...)`：提示词超长。
- 启动警告 `Default vLLM sampling parameters have been overridden by the model's generation_config.json` 与 `temperature ... is less than 0.01`：提示模型覆盖了默认参数或小正温度已抬升至 `0.01`，并非报错。
- `--override-generation-config` 非法 JSON 或全局 `--seed` 超出 NumPy 32 位无符号范围会在启动期失败。

### 开销和什么时候别开

采样的核心开销在三处：每步将整排 logits 转 `FP32`；`top_p` 对全词表（GLM 为 `154880` 维）排序；TP8 下 8 张卡各自算一遍（满载 128 行线性增长）。本页无实测耗时；`v0.26` 与 `v0.30.0` 源码注释指出旧版融合 `npu_top_k_top_p` 在大 $k$ 或混合 $k$ 批下会退化到 `5–28 ms`，而排序掩码稳定在 `~1 ms`。评测需可复现时设 `temperature = 0` 并配合 [batch invariance](batch-invariance.md) 或 `LCCL_DETERMINISTIC`；无复现目标时不必给每条随机请求都设独立 `seed`（避免逐条填充设备发生器的调度开销）；任务允许简短回答时保持 `min_tokens = 0`，避免无谓拉长解码步数与 KV 占用。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；正文 GLM 双机绑定算例固定在例外 B 镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`。

| 核对项 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| Ascend 采样模块位置 | `vllm_ascend/sample/sampler.py`（MRV1） | 同 `v0.23.0` | 同时提供 MRV1 `sample/sampler.py` 与 MRV2 `worker/v2/sample/` | 移除旧 MRV1 `sample/`，收敛至 `worker/v2/sample/` 与 `_310p/worker/v2/sample/` |
| A2 `top_k / top_p` 默认路径 | 融合算子 `npu_top_k_top_p` | 过滤前 Softmax 排序加掩码 | 排序加掩码；开 `VLLM_BATCH_INVARIANT` 回退上游 | MRV2 `apply_top_k_top_p.py` 按硬件分派 NPU/PyTorch；Gumbel 在 `gumbel.py` |
| `enable_async_exponential` / `enable_reduce_sample` | 两者均有，默认关 | 删 `enable_async_exponential`，留 `enable_reduce_sample` | 两者均已移除 | 延续已移除 |
| 温度合法范围与 `BatchChat` 默认 | 仅要求非负；`BatchChat` 温度/`top_p`/`min_p` 有数值默认 | 有限且 `[0, 2]`；`BatchChat` 改 `None` 走服务默认 | 同 `v0.26.0rc`，参数校验统一 `VLLMValidationError` | 同 `v0.30.0` |
| `min_tokens` 判停顺序与结构化恢复 | 引擎先查 `min_tokens` 再查 EOS/停止/长度 | 同 `v0.23.0` | EOS/停止/长度先查（EOS 靠采样屏蔽）；结构化输出全空时恢复有限停止分数 | 同 `v0.30.0` |

高阶特性（三类惩罚、`logit_bias`/`allowed_token_ids`/`bad_words`、思考预算、自定义 `LogitsProcessor`、Logprobs、Beam Search）的四版差异集中在[采样进阶「版本差异」](sampling-advanced.md#版本差异)；生成式评分四版差异见[Pooling 与非自回归「版本差异」](pooling-and-non-ar.md#版本差异)。

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **官方配置、论文与文档**：GLM-5.3-Flash `generation_config.json`（`temperature=1.0`, `top_p=0.95` 与三个结束编号）与 `tokenizer_config.json` 见 [S1][S2]；Top-p 核采样与贪心退化原论文见 [S3]；可复现性文档、GLM 双机教程（`--seed 1024`）、Ascend 确定性 FAQ 与 NumPy 32 位种子约束见 [S4][S5][S6][S7]。文中 6 词手算示例、满载 128 行 `37.8 MiB` 与 3 个验证行 `1.77 MiB` 均按形状与公式推导 [D][D]，本页无实测 MTP 接受率或采样耗时。
- **上游采样、参数合并与判停**：`Sampler` 顺序、`all_greedy` 快退与混合批次逐行选词见 `v1/sample/sampler.py` [C8][C9]；PyTorch `top_k/top_p` 截断与指数噪声抽取见 `topk_topp_sampler.py` [C10]；`SamplingParams` 默认/抬升/范围与 `generation_config.json` 合并见来源 11–16 [C11][C14]；引擎判停 `check_stop`、`MinTokensLogitsProcessor`（含结构化恢复）与前端停止串保护见来源 17–19、25–26 [C17][C18]；多进程 0 号卡交回、投机验证与全局随机种子初始化见来源 20–22；`v0.26 / v0.30.0 / main` 上游演进见来源 23–24、27–28 [C24]。
- **昇腾采样与 MTP 验证**：GLM 镜像 `db701c1f` 的 `AscendSampler`、额外开关、`model_runner_v1._sample`、候选验证与 Triton 核、MTP 草拟与 worker 全局种子见来源 29–36 [C29][C33]；`v0.23.0` / `v0.26.0rc` / `v0.30.0` / `main` 四版演进见来源 37–41 [C39][C40]。
