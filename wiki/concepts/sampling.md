---
id: sampling
title: "Sampling：从词表分数里定下一个 token"
type: concept
summary: "模型给词表里每个词打完分，sampling（采样）按请求的设置从中定下一个 token。本页用 6 个词的小例子手算 temperature、softmax、top-k、top-p 和按概率抽取，对照 greedy，再讲停止条件；最后落到 GLM 双机：8 张卡各采一遍、只交回一份，MTP 候选怎样验证。"
aliases: [sampling, 采样, 采样器, Sampler, temperature, 温度, top-p, nucleus sampling, 核采样, greedy, 贪心, 贪心解码, SamplingParams, 采样参数, 停止条件, min_p]
chapters: ["05"]
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json
  - https://arxiv.org/abs/1904.09751
  - vllm@0fc695fc:vllm/v1/sample/sampler.py#L20-L58
  - vllm@0fc695fc:vllm/v1/sample/sampler.py#L228-L302
  - vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L352-L393
  - vllm@0fc695fc:vllm/v1/sample/ops/topk_topp_sampler.py#L426-L457
  - vllm@0fc695fc:vllm/v1/sample/logits_processor/builtin.py#L100-L115
  - vllm@0fc695fc:vllm/model_executor/layers/utils.py#L51-L89
  - vllm@0fc695fc:vllm/sampling_params.py#L235-L265
  - vllm@0fc695fc:vllm/sampling_params.py#L470-L476
  - vllm@0fc695fc:vllm/sampling_params.py#L511-L533
  - vllm@0fc695fc:vllm/sampling_params.py#L590-L618
  - vllm@0fc695fc:vllm/config/model.py#L159-L164
  - vllm@0fc695fc:vllm/config/model.py#L285-L291
  - vllm@0fc695fc:vllm/config/model.py#L1458-L1510
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L523-L576
  - vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L205
  - vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L117
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L830
  - vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L20-L43
  - vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L146-L192
  - vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L269-L302
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L256-L263
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L318-L321
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2610
  - vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247
  - vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L449-L470
  - vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L200-L215
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1290-L1299
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L498-L499
  - vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L286-L302
  - vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L262-L271
  - vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L263-L268
  - vllm@568afb3a:vllm/sampling_params.py#L538-L556
  - vllm@0fc695fc:vllm/v1/sample/sampler.py#L72-L100
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L2730-L2809
  - vllm@0fc695fc:vllm/config/model.py#L229-L235
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - vllm@0fc695fc:vllm/v1/sample/ops/bad_words.py#L1-L30
  - vllm@0fc695fc:vllm/_custom_ops.py#L360-L373
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L280-L330
  - vllm@0fc695fc:vllm/sampling_params.py#L429-L437
  - vllm@0fc695fc:docs/usage/reproducibility.md#L3-L8
  - vllm-ascend@2c59ff10:docs/source/faqs.md#L167-L202
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
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
  - to: one-request
    kind: builds-on
    note: 主线第 5 站在这里选出 y₀、第 6、7 站按停止条件收尾，R1 的形状与字节只在那页推导
  - to: speculative-decoding
    kind: builds-on
    note: 有 MTP 候选时，采样换成对候选的验证，接受规则以投机解码页为准
  - to: structured-output
    kind: builds-on
    note: 结构化输出在采样之前把不合法的词压成负无穷，怎样算 bitmask 以那页为准
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: TP8、MTP 3 个候选、133120 的长度上限等部署取值的出处
contradicts: []
updated: "2026-10-02"
origin: seed
---

## Sampling 是什么：分数出来了，下一个 token 怎么定？

**Sampling（采样）是生成每个 token 的最后一步：模型给词表里每个词打完分，sampling 按请求的设置把这一排分数变成一个确定的 token 编号。可以每次都取分数最高的那个（greedy，贪心），也可以把分数换成概率，只在排在前面的几个词里按概率抽一个。**

大模型一次只往后写一个 token。每写一个，都要把已有的文字送进模型算一遍：文字先由分词器切成 token、换成编号（见 [token](token.md)），再查表变成向量（见 [embedding](embedding.md)），然后一层层改写。最后一层之后，模型用一次矩阵乘法，把最后那个位置的向量变成一排分数，词表里每个词一个；做这次乘法的权重叫 lm_head，这排分数叫 logits（每个分数怎么算出来，见 [lm_head](lm-head.md)）。分数越高，模型越认为这个词适合接在后面；但它只是分数，可正可负，加起来也不等于 1，还不是概率，更不是一个词。

举一个缩到最小的例子，沿用 embedding 页那张 6 个词的词表：我、你、喜欢、猫、看、「。」。前面已经写出「我 喜欢」，模型给 6 个词打的分是：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（数是编的；lm_head 页演示乘法时用过另一组分数，这里换成相差 1 的整数，方便手算）。下一个写什么？

```wiki-diagram
file: sampling-intuition
```

图里有两条路。greedy 那一路最简单：谁的分数最高就选谁，这里永远是「猫」。随机那一路多几步：先把分数除以一个叫 temperature 的数，调节分数之间拉开的程度；再用 softmax 换成加起来等于 1 的概率；然后只留下排在前面的几个词（top-k 按个数留，top-p 按累计概率留），把留下的概率重新凑成 1；最后按概率抽签。图里取 T = 1、top-k = 3、top-p = 0.8，走完这几步只剩两个词：「猫」抽中的机会是 73%，「你」是 27%。每一步的数怎么来，后面「怎么算」一节逐个算。

抽出来的编号就是这一步的输出。它接到文字末尾，下一步和前面的文字一起送回模型，模型再给下一个位置打分；这样一步出一个 token，直到碰上停止条件。所以 sampling 夹在两次前向之间：前向交出一排分数，sampling 交出一个编号，这个编号又成为下一次前向的输入。

## 为什么不总是选分数最高的词？

**greedy 简单、可复现，但同一个开头永远写出同一段话，而且容易绕进重复；反过来，在整张词表上按概率抽，又会时不时抽中排在很后面、接不上文的词。temperature、top-k、top-p 就是在这两头之间调：保留随机，同时把随机限制在靠谱的候选里。**

先看 greedy 的毛病。分数最高只说明「这一步看起来最像」，一步步都取最高，整段话往往平淡；更糟的是，假设模型写出「我喜欢猫。」之后，下一步最高分又是「我」，接着又是「喜欢」「猫」，于是「我喜欢猫。我喜欢猫。……」绕进循环。研究文本生成的论文《The Curious Case of Neural Text Degeneration》（Holtzman 等，2020）专门分析过这种现象：以「每步选最可能的词」为目标的解码，写出来的文字平淡，并且会反复重复。另一个毛病是没有变化：同一个问题问十遍，greedy 给出十遍一模一样的回答，想让模型给几个不同的候选时就没有意义。

反过来，完全按原始概率抽也不行。真实词表有十几万个词，排在后面的每个词单看概率都很小，可是这一长串小概率加起来并不小；这些尾部的词大多接不上文，抽中一次，句子就跑偏，而且后面每一步都得接着这个错词往下写。上面的小例子里，「喜欢」的概率只有 0.4%，抽中就成了「我喜欢喜欢」；词表越大，尾部的总量越可观。

于是有了几个可以按请求调的旋钮：

- **temperature**（温度，记作 T）调整个分布的尖锐程度：T 小于 1，领先的词更领先；T 大于 1，分布变平，后面的词机会变多。T 调到 0 就退化成 greedy。
- **top-k** 只留分数最高的 k 个词，其余一律不抽。
- **top-p** 把词按概率从高往低累加，留下刚好凑够 p 的那一小撮。它就是上面那篇 2020 年论文提出的 nucleus sampling：候选个数随分布变化，模型很确定时只留一两个，拿不准时多留一些。

代价有两点。一是结果不再可复现：同一个请求发两次，写出来可以不同；要复现，得把随机数的起点（随机种子）也固定下来，后面讲。二是多了一些计算：每一步都要对整排分数做除法和 softmax，top-p 还要把整排分数按大小排序，词表越大、一批里的请求越多，排序越费时。

所以 greedy 也有它的用处：需要稳定、可复现的输出时，比如对标准答案、做评测，它正合适；请求把 temperature 设成 0 就是它。

## 怎么算：6 个词从分数走到一个 token

**随机那一路的顺序固定：分数除以 temperature → softmax 换成概率 → top-k、top-p 截掉尾部 → 留下的重新归一 → 按概率抽一个。greedy 跳过这些，直接取分数最高的词。**

下面一直用上一节的 6 个词和分数：猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2（示意）。前一步的结果就是后一步的输入。为了先看清 softmax，第 ① 步先取 T = 1，这时除以 T 什么都不变；第 ② 步再看 T 换成别的数会怎样。

### ① softmax：把分数换成概率

**softmax 把一排分数换成一排概率：每个分数先变成 e 的这个数次方（e ≈ 2.718），再各自除以它们的总和。结果都是正数、加起来等于 1，分数高的词分到的概率大。**

softmax 在 attention 里已经出现过，用来把点积换成权重（见 [attention 怎么算](attention-qkv.md#attention-怎么算跟着一个位置走一遍)）；这里算法完全一样，只是作用对象从位置换成了词表里的词。取 e 的次方有两个作用：负分也变成正数，分数之间差 1，结果就差 e ≈ 2.7 倍，领先的词被明显放大。

```calc
title: T = 1 时 6 个词的概率（示意）
总和 = e³ + e² + e¹ + e⁰ + e⁻¹ + e⁻² = 20.09 + 7.39 + 2.72 + 1 + 0.37 + 0.14 = 31.71
猫 = 20.09 ÷ 31.71 ≈ 0.634
你 = 7.39 ÷ 31.71 ≈ 0.233
看 = 2.72 ÷ 31.71 ≈ 0.086
「。」 = 1 ÷ 31.71 ≈ 0.032
我 = 0.37 ÷ 31.71 ≈ 0.012
喜欢 = 0.14 ÷ 31.71 ≈ 0.004
> 6 个概率四舍五入后加起来是 1.001，误差来自舍入
```

有一点值得记住：softmax 只看分数之间的差。6 个分数同时加 10，每个 e 次方都乘上同一个 e¹⁰，除以总和时正好约掉，概率一点不变。所以 logits 的绝对大小没有意义，要紧的是谁比谁高多少。

### ② temperature：先除，再 softmax

**每个分数先除以 T，再做 softmax。两个词概率之比是 e 的「分差 ÷ T」次方：T 越小，分差被放得越大，分布越尖；T 越大，分差被压得越小，分布越平。T 只改差距，不改先后。**

把 T 分别取 0.5、1、2，同样 6 个词的概率变成下表（T = 0.5 时分数先变成 6、4、2、0、−2、−4，再做 softmax；其余同理）：

| 词 | 分数 | T = 0.5 | T = 1 | T = 2 |
|---|---|---|---|---|
| 猫 | 3 | 0.865 | 0.634 | 0.414 |
| 你 | 2 | 0.117 | 0.233 | 0.251 |
| 看 | 1 | 0.016 | 0.086 | 0.152 |
| 「。」 | 0 | 0.002 | 0.032 | 0.092 |
| 我 | −1 | 0.0003 | 0.012 | 0.056 |
| 喜欢 | −2 | 0.00004 | 0.004 | 0.034 |

看猫和你这一对：分差是 1，T = 0.5 时概率之比是 e² ≈ 7.4（0.865 ÷ 0.117），T = 1 时是 e ≈ 2.7，T = 2 时只剩 e^0.5 ≈ 1.65。T = 0.5 时猫独占 86.5%，几乎每次都抽到它；T = 2 时，原本只有 0.4% 的「喜欢」涨到 3.4%，尾部的词明显多了机会。这和 attention 里分数先除以 √d 再做 softmax 是同一个道理，只是在那里除数是固定的，这里由请求决定（见[为什么要除以 √d](attention-qkv.md#为什么要除以-d)）。

T 越接近 0，最高分的词越接近独占全部概率，极限就是 greedy。真去除以一个接近 0 的数会让分数大到溢出，所以 vLLM 把 0 到 0.01 之间的 T 直接抬到 0.01，并打一条警告；只有 T 等于 0 按 greedy 处理，不做除法。另外，三列里猫永远第一、喜欢永远最后：T 不改变先后，所以 greedy 的结果和 T 无关，top-k 留下哪几个词也和 T 无关；但 top-p 按累计概率截，留下几个会随 T 变，下一步就能看到。

### ③ top-k 和 top-p：只留排在前面的词

**top-k 只留分数最高的 k 个词。top-p 把词按概率从高到低排，一个个累加，累计概率一旦达到 p 就停，跨过 p 的那个词也留下。被截掉的词分数改成负无穷，e 的负无穷次方是 0，softmax 之后概率就是 0，留下的词自动重新凑成 1。两者同时用时，先按 k 截，再在留下的词里重新算概率、按 p 截。**

取 T = 1、top-k = 3、top-p = 0.8，接着第 ① 步的数往下算：

```calc
title: T = 1、top-k = 3、top-p = 0.8 的截断（示意）
top-k 留 3 个后的总和 = 20.09 + 7.39 + 2.72 = 30.20，「。」、我、喜欢记 0
猫 = 20.09 ÷ 30.20 ≈ 0.665
你 = 7.39 ÷ 30.20 ≈ 0.245
看 = 2.72 ÷ 30.20 ≈ 0.090

累加到猫 = 0.665 < 0.8，还没够，继续
累加到你 = 0.665 + 0.245 = 0.910 ≥ 0.8，你留下，看截掉
top-p 后的总和 = 20.09 + 7.39 = 27.48
猫 = 20.09 ÷ 27.48 ≈ 0.731
你 = 7.39 ÷ 27.48 ≈ 0.269
```

最后只剩猫和你，概率 0.731 和 0.269，就是直觉图第三列的数。判断「留不留」的规则可以换一种说法：排在一个词前面的那些词，概率加起来还不到 p，这个词就留下。猫前面没有词，加起来是 0；你前面是猫的 0.665，不到 0.8，留下；看前面是 0.910，已经够了，截掉。

温度会改变 top-p 留几个。同样 top-k = 3、top-p = 0.8，把 T 换成 0.5：前 3 名里猫一个就占 0.867，第一个词就够了，只剩猫一个，效果和 greedy 一样。温度调高，分布变平，要凑够 p 就得多留几个词。

还有一个不太常用的 min_p：只留概率不低于「最高概率 × min_p」的词，vLLM 在除以 temperature 之后、top-k 之前做它。例如 T = 1、min_p = 0.1，门槛是 0.634 × 0.1 ≈ 0.063，留下猫、你、看三个，和 top-k = 3 的结果碰巧一样。三个截断都有「关闭」的取值：top-k 取 0（也接受 −1）、top-p 取 1、min_p 取 0，默认都是关的。

### ④ 按概率抽一个，和 greedy 对照

**把留下的概率首尾相接排在 0 到 1 之间，猫占 [0, 0.731)，你占 [0.731, 1)；取一个 0 到 1 之间均匀分布的随机数 u，落在哪一段就选哪个词。**

u = 0.42 落在猫那段，这一步输出猫；换一次随机数 u = 0.85，落在你那段，输出你。每段的长度就是它的概率，抽很多次，大约 73% 是猫、27% 是你；被截掉的看、「。」、我、喜欢一次也不会出现。

greedy 对照：它不做 ① 到 ④，直接在原始分数里找最大的，3 分的猫，每次都是猫。随机那一路在 T = 0.5、top-p = 0.8 这类设置下也会只剩猫一个，结果和 greedy 一样；但只要留下的词多于一个，同一个开头就可以写出不同的下一句。

## 分数在进 softmax 之前，还会被哪些设置改动？

**除以 temperature 之前，vLLM 先按请求的设置把分数改一遍，顺序是：只允许指定的词 → 屏蔽指定的词串 → 还没写够最少 token 数时屏蔽结束 token → 给指定的词加减分 → 按出现过的次数罚分。这些改动在 greedy 之前做，会改变谁是最高分；min_p、top-k、top-p 则只在随机那一路做。**

这几项默认都不开，请求里设了才生效：

- **只允许 / 屏蔽**：给了允许的词编号清单，清单外所有词的分数改成负无穷；给了要屏蔽的词串，快要写出这个词串时，把补完它的那个词压成负无穷。
- **最少 token 数**（min_tokens）：输出还没到这个数，结束 token 和请求指定的停止 token 一律压成负无穷，想停也停不下来。
- **加减分**（logit_bias）：请求给某些词编号指定一个数，直接加到它们的分数上。
- **罚分**：frequency penalty 按一个词在输出里已经出现的次数扣分，出现 2 次扣 2 份；presence penalty 只看出现过没有，出现过就扣 1 份；repetition penalty 对提示词和输出里出现过的词，正分除以它、负分乘以它，系数大于 1 时两种情况都让分数变低。

拿罚分演一次，看它怎么打破前面「为什么」一节里的循环。假设 greedy 已经输出「猫。我喜欢」，这个位置模型给的分数仍是猫 3、你 2、看 1、「。」0、我 −1、喜欢 −2，请求设了 presence penalty = 1.5。猫、「。」、我、喜欢都在输出里出现过，各扣 1.5，变成 1.5、−1.5、−2.5、−3.5；你和看没出现过，不变。最高分从猫（1.5）换成了你（2），greedy 这一步写出「你」，循环就断了。

另外两项不在这条链里，但作用在同一排分数上：一是[结构化输出](structured-output.md#4-每张卡把-bitmask-作用到-logits)，它在采样之前把不符合格式的词压成负无穷；二是请求要的 logprobs（每个词的对数概率），vLLM 默认按原始分数算，也就是上面这些改动和 temperature 之前的分数，不是最后抽签用的概率。

## 真实实现怎样「按概率抽」？

**vLLM 和昇腾都不去累加概率、找区间，而是给每个词各发一个服从指数分布的随机数 q，算「概率 ÷ q」，取最大的那个词。这样抽中每个词的机会恰好等于它的概率，而且全程只有逐元素除法加一次取最大，结果留在加速卡上，不用拷回 CPU。**

第 ④ 步的区间法要先算累计和，再拿 u 逐段去比；按区间抽的现成函数（torch.multinomial）在昇腾上会让 CPU 停下来等 NPU，昇腾的源码注释写明换掉它就是为了避开这次同步。指数噪声的做法只需要一次除法和一次取最大。继续用猫 0.731、你 0.269，抽两次：

```calc
title: 用指数噪声抽两次（示意）
猫（第 1 次，q = 1.30） = 0.731 ÷ 1.30 ≈ 0.562
你（第 1 次，q = 0.20） = 0.269 ÷ 0.20 ≈ 1.345，最大，这次输出你
猫（第 2 次，q = 0.50） = 0.731 ÷ 0.50 ≈ 1.462，最大，这次输出猫
你（第 2 次，q = 0.90） = 0.269 ÷ 0.90 ≈ 0.299
> q 是编的；真实的 q 每步每个词重新抽
```

为什么这样抽到猫的机会正好是 0.731？「概率 ÷ q」最大，等价于「q ÷ 概率」最小。q 服从平均值为 1 的指数分布，q ÷ 概率就服从平均值为「1 ÷ 概率」的指数分布：概率越大，这个数平均越小，越容易成为最小的那个。几个互相独立的指数分布随机数比大小，第 i 个最小的机会正好等于它的「概率 ÷ 所有概率之和」，这里就是 0.731 ÷ 1 = 0.731。被截掉的词概率是 0，除完还是 0，永远不会是最大的。

同一批里常常既有 greedy 请求，也有随机请求。只要这一批不全是随机请求，vLLM 就先对每一行都算一遍 greedy 的结果；只要不全是 greedy 请求，再对每一行都走一遍随机那一路；最后按每条请求自己的 T 逐行挑：T 小于 0.00001 的行取 greedy 结果，其余取随机结果。

随机数从哪来：请求自己带了 seed，就给这条请求单独建一个随机数发生器，它那一行的 q 都由它产生，同样的 seed 得到同样的 q；没带 seed 的请求共用全局发生器，全局发生器的起点是启动时设的种子。

## 采样参数从哪来？

**每条请求带着一组采样参数进来（在 vLLM 里是一个 SamplingParams 对象）。请求里写了的用请求的；没写的，先看模型自带的生成配置文件（generation_config.json）有没有给，再退到 vLLM 的中性默认值。参数在入口收到请求时就定下来，采样这一步只负责照着用。**

vLLM 的中性默认值是：temperature 1、top-p 1、top-k 0、min_p 0、各种罚分都不罚，也就是「在整张词表上按原始概率抽」。启动参数里生成配置默认取 auto，意思是去模型目录读 generation_config.json，里面写了 temperature、top-p、top-k、min_p、repetition penalty 或最大新 token 数的，就替换成默认值，启动日志里会打一条警告说明默认值被模型配置改了；想回到中性默认值，启动时把它设成 vllm。

几个值得知道的约定：

- temperature 设成 0 时，参数对象自己把 top-p、top-k、min_p 重置成关闭，按 greedy 处理；0 到 0.01 之间的取值被抬到 0.01，仍按随机采样。
- 取值不合法的请求在入口就被拒绝，不会进入采样：temperature 为负、top-p 不在 0 到 1 之间（0 不行，1 可以）、top-k 小于 −1、min_p 不在 0 到 1 之间。
- 最大输出数 max_tokens：chat 接口不写时，取「模型长度上限 − 提示词长度」（生成配置里给了最大新 token 数的，再和它取小）；老的 completions 接口不写时默认只有 16。
- seed 是每条请求自己的随机种子，见上一节。

## 什么时候停下来？

**每出一个 token，引擎都检查一遍要不要停：输出还没到 min_tokens，不停；到了，就看这个 token 是不是结束 token、是不是请求指定的停止 token，是就正常结束；再看长度，输出数到了 max_tokens，或者提示词加输出到了模型的长度上限，就截断结束。**

结束 token（EOS，end of sequence）是词表里的特殊 token，模型在训练时学会了「话说完了就输出它」；它和普通词一样参与打分和采样，被抽中就说明模型认为该收尾了。停止 token 是请求额外指定的编号，模型生成配置里列出的其他结束编号也并进这一类。请求设了 ignore_eos，抽到结束 token 也不停，一直写到长度上限。

两类结束在返回给客户端时写法不同：结束 token 和停止 token 记作正常结束（finish reason 为 stop），长度到限记作被截断（finish reason 为 length）。用小例子看长度：提示词「我 喜欢」，max_tokens = 3，输出依次是猫、「。」、我，第 3 个 token 一追加就停，哪怕句子没写完：接口返回的输出部分是「猫。我」（连同提示词读起来是「我喜欢猫。我」），结束原因是 length。

还有两点：

- 停止判断不在加速卡上做，而是在一圈圈推进请求的引擎进程里（CPU 上，见 [EngineCore](vllm-engine-core.md)），在采样结果交回之后逐个 token 检查；一步如果交回好几个 token，中间某个命中停止条件，后面的直接丢掉。
- 请求设的停止字符串（stop）要把编号还原成文字才能比对，而一个字符串可以横跨好几个 token，所以放在负责还原文字的前端进程里判断，见主线[第 7 站](one-request.md#第-7-站-返回与收尾)。

## 放到 GLM 双机：采样在哪一步、谁来做？

**GLM 双机是 2 台机器、每台 8 张卡；每台机器是一个 DP 组，各管各的请求，组内 8 张卡按 TP8 合算同一个模型（部署前提见 [GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)）。前向结束后，每台机器的 8 张卡都拿到完整的 154880 个分数，8 张卡用同一个随机种子各自采一遍，只有 0 号卡把结果交回引擎。第一步只采 1 行；之后每一步还要验证 3 个候选 token——候选来自 MTP，GLM 自带的一层预测层，每步先猜后面 3 个，下文单独讲。**

下面沿用主线的示例请求 R1：提示词 4 个 token，这是教学设定，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。

### 分数怎样到每张卡上

**词表投影按词表切给 8 张卡，每张卡只算 19360 个词（154880 ÷ 8）的分数，再做一次 All-Gather 拼成完整的一份；采样前 8 张卡手里的分数一模一样。**

All-Gather 是一种集合通信：每张卡交出自己算的那一段，拼成完整的一份发给所有卡，见 [All-Gather](collective-communication.md#all-gather)。每条请求要取几行分数，看这一步有没有候选：R1 第一步是 prefill（一次算完提示词的全部位置，见 [prefill](prefill.md)），没有候选，只取最后一个位置那一行，每张卡上是 `[1, 154880]`；此后每一步送进 1 个确定 token 和 3 个候选，4 个位置都要分数，是 `[4, 154880]`。一台机器满载时 32 条请求都在 decode（提示词算完之后逐个往后生成的阶段），每张卡上就是 `[128, 154880]`，BF16 约 37.8 MiB（128 × 154880 × 2 B）。为什么按词表切、All-Gather 怎么拼，见 [lm_head](lm-head.md)；R1 每一步的字节数只在主线的[最终归一化与词表投影](one-request.md#最终归一化与词表投影)推导，这里不重算。分数进采样前先转成 fp32（每个数 4 字节）；R1 的一个 decode 步里，3 个验证行转出的 fp32 副本约 1.77 MiB（3 × 154880 × 4 B）。

### 8 张卡各采一遍，只交回一份

**每张卡由一个 worker 进程驱动。采样和前向是引擎发给这 8 个 worker 的两次调用：第一次跑前向、算出分数，第二次才采样。8 张卡拿着同样的分数、同样的随机种子，各自跑一遍同样的采样，结果必然相同；8 张卡都留着结果接着做 MTP 草拟，0 号卡另外把结果交回引擎。**

```wiki-diagram
file: sampling-flow
```

结果相同靠的是种子。vLLM 在每个 worker 启动时用同一个全局种子初始化随机数发生器，参数说明里专门写了原因：不这样，TP 的各张卡会抽出不同的 token。官方教程的启动命令在两台机器上都设了 `--seed 1024`。同一个种子首先保证的是 8 张卡抽得一致；跨次运行的逐字复现不由种子单独保证——vLLM 的文档写明默认不保证复现，在线服务的批组成每一步都在变，昇腾上跨卡归约默认也不保证逐位一致，要复现见 [batch invariance](batch-invariance.md)。请求自己带了 seed 的，那一行用它自己的发生器，8 张卡上也是同一个 seed，照样一致。

谁交回结果由一个公式定：这个 DP 组的卡数，减去「TP 数 × 上下文并行数」；本部署上下文并行数是 1，8 − 8 × 1 = 0，所以是 0 号卡。为什么不让 0 号卡一张卡采样、再把结果广播给另外 7 张？因为紧接着的 MTP 草拟在每张卡上都要用这个 token：各卡自己采一遍，结果当场就在本卡，省掉一次广播。

采样本身按前面讲的顺序走，昇腾换了其中两件实现：

- **top-k 和 top-p**：在 A2 上换成 torch_npu 提供的一个融合算子，一次完成截断。
- **抽取**：用上一节的指数噪声，每个词发一个 q，取「概率 ÷ q」最大的词。

这台部署还有两个默认关着的昇腾开关，都要额外配置才打开：一个让每张卡先在自己那 19360 个词里挑出前几名、只把候选拼到一起，从而少传数据；另一个在前向进行的同时，提前在另一条流上把指数噪声 q 抽好。部署没有给额外配置，两者都不生效。

### 请求不写采样参数时，用的是什么

**GLM 的模型目录里带着生成配置（固定 revision 690b7052 的官方 generation_config.json）：temperature 1.0、top-p 0.95，没写 top-k。教程的启动命令没有改生成配置的来源，所以请求里不写这几项时，按 T = 1、top-p = 0.95、top-k 关闭来采样。**

这组值的意思是「分数不缩放，只截掉累计概率 95% 之外的尾巴」。套到前面 6 个词的小例子上，看它会留下几个：

```calc
title: T = 1、top-p = 0.95、top-k 关闭，套到 6 个词的小例子（示意）
累加到猫 = 0.634 < 0.95，还没够，继续
累加到你 = 0.634 + 0.233 = 0.867 < 0.95，还没够，继续
累加到看 = 0.867 + 0.086 = 0.953 ≥ 0.95，看留下，后面 3 个截掉
留下 3 个后猫、你、看各占 = 0.665、0.245、0.090
```

留下的是猫、你、看，概率和第 ③ 步 top-k = 3 之后一样。在真实的 154880 个词上，每一步留下几个词随分布变：模型很确定的位置可能只剩一两个，拿不准的位置会留下更多。请求显式写了 temperature 或 top-p，就以请求为准；想让 GLM 按 greedy 输出，请求把 temperature 设成 0。

### 有 MTP 候选时：采样变成验证

**decode 的每一步，每条请求有 4 行分数：前 3 行用来验证 3 个候选，最后 1 行在候选全部通过时再多出一个 token。验证之前，这 3 行照样经过改分数、temperature、top-k、top-p 这一整套；greedy 请求比较候选是不是最高分，随机请求按目标概率决定接受还是拒绝。**

候选是 MTP 草拟出来的：每一步采样结束后，MTP 接着刚采出的 token 往后猜 3 个，过程见主线[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。它每一遍都直接取最高分的词，不看请求自己的 temperature 和 top-p。

下一步主模型把 1 个确定 token 和 3 个候选一起算完，每个候选位置得到一行完整的目标分数，按请求的设置处理成目标概率，再逐个判断：

- **greedy 请求**：候选和这一行的最高分相同就接受，接着看下一个；第一次不同，就改写成这一行的最高分并停下。
- **随机请求**：按候选在这一行里的目标概率接受。以小例子为例，某个位置的目标概率是猫 0.731、你 0.269，候选是猫：抽一个 0 到 1 之间的随机数 u，u 不超过 0.731 就接受猫；否则拒绝，从去掉猫之后的概率里重新抽一个，这里只剩你。合起来，这个位置输出猫的机会是 0.731、输出你的机会是 0.269，和直接采样完全一样。候选如果是看，它已被 top-p 截掉、目标概率是 0，一定被拒。

一次验证最多通过 3 个候选，全部通过时再用最后 1 行采一个额外的 token，所以每一步交回 1 到 4 个 token。接受规则的一般原理见[投机解码](speculative-decoding.md#greedy-验证与随机采样分开理解)；R1 两圈 decode 各接受几个、计数怎么回退，见主线[第 6 站](one-request.md#第-6-站-结果更新接受几个候选回退几格)。

### 停止判断和长度上限

**0 号卡交回结果后，引擎把这一步接受的 token 逐个追加到请求上，每追加一个就检查一次停止条件；命中了，后面的 token 丢掉。GLM 的结束编号有三个，长度上限是 133120。**

GLM 的生成配置列了 154820、154827、154829 三个结束编号（各是什么，见 [token](token.md#编号要落在-154880-行之内)）。分词器自己的结束 token 是 154820，按结束 token 处理；154827、154829 并进停止 token。三者被抽中都算正常结束。部署把单请求总长度上限设成 133120，chat 请求不写 max_tokens 时，最多能写到 133120 减去提示词长度。R1 在 max_tokens 到限时怎样截断、只返回前几个 token，见主线[第 7 站](one-request.md#第-7-站-返回与收尾)。

接近长度上限时，候选也要收口：MTP 草拟到超出上限的位置，那些候选直接作废；调度器也会把这一步能送进模型的 token 数截到上限以内，于是这一步少于 4 个位置。

## 常见误解

- **「logits 就是每个词的概率。」** logits 是分数，可正可负，加起来也不等于 1；要经过 softmax 才是概率。而且只有分数之间的差有意义，所有分数同时加一个数，概率不变。
- **「temperature 改的是模型算出来的分数。」** 前向算出的分数不受它影响，temperature 只在采样时把分数除一下。它也不改变先后，所以 greedy 的结果和 temperature 无关。
- **「top-p = 0.8 就是留下前 80% 的词。」** p 是累计概率，不是词的个数比例。在 T = 1、top-k = 3 的例子里，0.8 只留下 2 个词，跨过 0.8 的那个词也留下；留几个随分布而变。
- **「top-p 留几个词和 temperature 无关。」** top-k 留下哪几个与 temperature 无关，top-p 不是：同样 top-k = 3、top-p = 0.8，T = 1 留 2 个，T = 0.5 只剩 1 个。
- **「temperature 设成 0，top-k、top-p 还在起作用。」** temperature 等于 0 就按 greedy 处理，参数对象会把 top-k、top-p、min_p 都重置成关闭。反过来，传一个 0 到 0.01 之间的小正数也换不来「更确定的随机」：它会被抬到 0.01，仍按随机抽。
- **「8 张卡各采一遍，会抽出 8 个不同的 token。」** 8 张卡拿到的分数相同，随机数发生器的种子也相同，抽出的 token 必然相同；只有 0 号卡把它交回引擎。
- **「请求固定了 seed，结果就一定可以逐字复现。」** seed 固定的是随机数。分数本身如果随同批请求的组合出现细微的数值差别，抽出的 token 仍会不同；这类一致性见 [batch invariance](batch-invariance.md)。
- **「MTP 草拟只取最高分，所以开了 MTP 的随机请求会变得像 greedy。」** 候选只是提议，每个候选都要按请求自己的目标概率接受或拒绝，拒绝后再从剩下的概率里重抽；输出每个词的机会和直接采样一样。
- **「返回的 logprobs 就是抽签用的概率。」** vLLM 默认用改分数和 temperature 之前的原始分数算 logprobs，和最后抽签用的概率不是同一组数。
- **「结束 token 和停止字符串都在加速卡上判断。」** 结束 token、停止 token 和长度在引擎进程里（CPU 上）判断；停止字符串要先还原成文字，在前端进程里判断。

## 对照源码

### 怎么开

采样没有总开关，每个请求都要经过它；行为由请求里的采样参数决定：`temperature`、`top_p`、`top_k`、`min_p`、`seed`，罚分三项，`logit_bias`、`min_tokens`、`max_tokens`、`stop`、`stop_token_ids`、`ignore_eos`。参数的默认值、合法范围和 greedy 的归一化都在 `SamplingParams` 里；0 到 0.01 之间的温度也是在这里被抬到 0.01 的。[C9][C43]

启动时影响采样的选项有三个：`--generation-config` 决定缺省参数从哪来，默认 `auto` 读模型目录的 generation_config.json，设成 `vllm` 用中性默认值，也可以给一个目录；`--override-generation-config` 在它之上再覆盖几项；`--seed` 是全局种子，默认 0。[C14] 官方双机教程两台机器都设了 `--seed 1024`，没有设 `--generation-config`，缺省参数走 auto。[S42] GLM 的生成配置给了 temperature 1.0、top-p 0.95 和三个结束编号。[S1] chat 接口在入口把请求字段和这些缺省值合并成 `SamplingParams`，max_tokens 不写时按长度上限推算。

昇腾侧有两个额外开关，都放在 `--additional-config` 里、默认关：`enable_reduce_sample`（先在每卡本地取前几名再拼接）和 `enable_async_exponential`（在另一条流上提前抽指数噪声）；后者只在 v0.23 与 GLM 的固定提交里有。[C24] 候选验证另有两条替代判据（按整块累乘概率判、按目标分布的熵调阈值），同样在额外配置里、默认关，本部署走的是正文讲的标准判据。

### 会报什么错

- `temperature must be non-negative`、`top_p must be in (0, 1]`：请求参数不合法，入口直接拒绝，请求不会进调度。[C11]
- `top_k must be 0 (disable), or at least 1`、`min_p must be in [0, 1]`：同上，top-k 传 −1 会被当作关闭而接受。
- `temperature must be in [0, 2]`、`temperature must be a finite number`：vLLM v0.26 新加的检查，v0.23 不报，温度大于 2 的请求在 v0.26 上会被拒绝。[C35]
- `Input length (…) exceeds model's maximum context length (…)`：提示词本身已超过长度上限，推算 max_tokens 时报出。[C17]
- 启动日志 `Default vLLM sampling parameters have been overridden by the model's generation_config.json`：这是警告，不是错误，说明缺省采样参数被模型的生成配置替换了；GLM 双机启动时会看到它。

### 开销和什么时候别开

采样的开销主要在三处：每一步把整排分数转成 fp32；top-p 要把每一行 154880 个分数排序；8 张卡把同一件事各做一遍。满载时每张卡要处理 128 行，这些都随行数线性增长。[D] 本页没有采样耗时的实测数。v0.26 与 main 的源码注释给过一组对比：昇腾的融合 top-k/top-p 算子在 k 很大、或同一批里各请求 k 不同时会慢到 5–28 ms，而排序加掩码稳定在 1 ms 左右，所以这两个版本在默认路径上改回了排序实现。[C33]

需要可复现、可比对的输出（评测、回归测试）时用 greedy：temperature 设 0 是前提，但要逐字一致还得开 [batch invariance](batch-invariance.md) 或昇腾的确定性环境变量（`LCCL_DETERMINISTIC` 等，见 vllm-ascend 的 FAQ）；[S44][S45]需要多样性时再调 temperature 和 top-p，不必三种截断同时用。罚分会让每一步多做一次对历史 token 的统计，开了 MTP 时还要把候选并进历史，没有重复问题时不必开。

### 版本差异

核对的是 vllm-ascend 的采样实现与上游的参数检查。GLM 双机的行为固定在执行侧 `db701c1f`、控制流 `0fc695fc`。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad | 对使用者意味着什么 |
| --- | --- | --- | --- | --- |
| A2 上 top-k、top-p 的默认路径 | 融合算子 `npu_top_k_top_p`[C32] | 改回排序加掩码的通用实现[C33] | 同 v0.26[C34] | 升级到 v0.26 后截断的实现换了，截断规则不变 |
| 按概率抽取 | 指数噪声取最大 | 同 v0.23 | 同 v0.23 | 三版的抽取方法一致 |
| 提前抽噪声的开关 | 有，默认关 | 已删除 | 已删除 | 只有旧版能开 |
| 本地先取前几名的开关 | 有，默认关 | 有，默认关 | 有，默认关 | 默认都走「先拼完整分数再采样」 |
| 上游温度上限 | 只要求非负 | 要求有限且不超过 2[C35] | 未单独核对配套的上游提交 | 从 v0.23 升到 v0.26，温度大于 2 的请求会被拒绝 |

GLM 固定提交 `db701c1f` 与 v0.23 维护分支在这些项上一致，融合算子和提前抽噪声开关都在。[C23]

### 源码位置

阅读顺序：先看上游 `v1/sample/sampler.py` 类注释，它按顺序列出改分数、greedy、temperature、min_p、top-k/top-p、抽取这几步，`sample()` 里是 greedy 与随机两路的合并；[C4] 再看 `v1/sample/ops/topk_topp_sampler.py` 的截断和指数噪声抽取；[C5] 然后是昇腾的 `sample/sampler.py`，看 A2 上换了哪些实现；[C22] 最后看昇腾 runner 的 `_sample` 怎样在普通采样和候选验证之间分流。[C26] 候选验证在昇腾的 `sample/rejection_sampler.py` 与 `ops/triton/reject_sample.py`，greedy 比较与随机接受分别在两处。[C27][C29] 停止判断在上游 `v1/core/sched/utils.py` 的 `check_stop`。[C18]

数值出处：154880、19360、每步 1 行或 4 行、满载 128 行约 37.8 MiB、验证行 fp32 约 1.77 MiB、133120 的长度上限，都来自主线底稿 03 §A5 与 02 §7.3 的形状推导；[D] temperature 1.0、top-p 0.95 和三个结束编号来自固定 revision 690b7052 的生成配置；[S1] `--seed 1024` 来自官方教程固定提交的两台机器启动命令；[S42] greedy 退化与 top-p 的出处是 nucleus sampling 的原论文。[S2] 前几节的 6 个词、分数、温度、截断参数、随机数 u 和 q 都是为演示编的。

待核：MTP 在真实负载下的接受率；采样在昇腾上的耗时没有实测。
