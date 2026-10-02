---
id: speculative-decoding
title: "Speculative decoding：先猜几个 token，再让主模型一次验完"
type: feature
summary: Speculative decoding（投机解码）先用便宜的办法猜出后面几个 token，再让主模型一次前向验证：猜对几个就多出几个，第一个猜错处换成主模型自己的答案。讲清接受规则、被拒位置的收场、为什么也可能变慢，以及 GLM 双机上 MTP 每步猜 3 个的做法与版本差异。
aliases: [Speculative Decoding, speculative decoding, 投机解码, 推测解码, MTP, Multi-Token Prediction, 草稿模型, 草稿 token, draft token, 候选 token, bonus token, num_speculative_tokens, 拒绝采样, rejection sampling, 接受率]
chapters: ["17"]
order: 30
sources:
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L715-L764
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L835
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L861-L925
  - https://arxiv.org/abs/2211.17192
  - https://arxiv.org/abs/2302.01318
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L518-L535
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L305-L330
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L212-L226
  - vllm@0fc695fc:vllm/config/speculative.py#L550-L554
  - vllm@0fc695fc:vllm/config/speculative.py#L715-L727
  - vllm@0fc695fc:vllm/config/compilation.py#L1475-L1518
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L298-L305
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217-L236
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L893-L916
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L94-L183
  - vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247
  - vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L205-L272
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L778-L781
  - vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L594-L598
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941
  - vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L100-L106
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/__init__.py#L34-L53
  - vllm-ascend@baa023ad:vllm_ascend/spec_decode/__init__.py#L41-L60
  - vllm-ascend@baa023ad:vllm_ascend/spec_decode/multi_kv_cache_group_proposer.py#L17-L35
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L63
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/speculative_decoding.md#L63
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm@568afb3a:vllm/config/speculative.py#L178
  - vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L504-L518
  - vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L430-L455
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1114-L1121
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L36-L98
  - vllm@0fc695fc:vllm/config/vllm.py#L957-L997
  - vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L218-L235
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: prefill, kind: builds-on, note: 在普通逐个生成的路径上多出候选与验证两段 }
  - { to: kv-cache, kind: builds-on, note: 被拒位置写过的 KV 不擦，靠下一步原地覆盖 }
  - { to: graph-mode-layer, kind: builds-on, note: 主模型的验证步要整齐才能回放图，录图尺寸按 1 + K 的倍数取 }
contradicts: []
updated: "2026-10-02"
origin: seed
---

## Speculative decoding 是什么：先猜几个 token，再让主模型一次验完？

模型生成回答，是一个 **token** 一个 token 往外出的（token 是模型读写文字的最小单位，可能是一个词，也可能是半个词，见 [Token](token.md)）。生成回答的这个阶段叫 **decode**：每一步把上一步刚定下的 token 送回模型，算出下一个。第 2 个 token 要等第 1 个定下来才能算，所以一步只能往前走一格。

**speculative decoding**（投机解码）换了个做法：先用一个便宜的办法把后面几个 token **猜**出来，这几个猜测叫**候选**（也叫草稿，draft）；再把「已经确定的 token + 这几个候选」一起交给真正要用的那个大模型（下文叫**主模型**）算一次。主模型在每个位置都会给出它认为的下一个 token，拿这些答案从左往右和候选对：对上的留下；第一个对不上的位置，写下主模型自己的答案；后面的候选全部作废。

```wiki-diagram
file: speculative-decoding
```

看图里的例子（为了好读，这里一个词算一个 token）。已经确定的最后一个 token 是「猫」，草稿猜后面是「坐 在 床」。主模型一次算 4 个位置，每个位置预测的都是**它后面那一格**：读到「猫」时预测下一格是「坐」，读到「猫 坐」时预测「在」，读到「猫 坐 在」时预测「垫子」。候选在输入里正好晚一格出现，所以第 1 格的预测和第 1 个候选比，第 2 格和第 2 个比，依次错开一格。

前两个对上了。第 3 格主模型说「垫子」，候选猜的是「床」，于是写下「垫子」，停在这里。第 4 格的预测是读着错误的「床」算出来的，作废。这一轮一共写下「坐 在 垫子」3 个 token。接着草稿从「垫子」往后再猜 3 个，下一轮主模型再验，如此循环。

从这个例子里就能看出两点：

- **候选只决定一轮能写下几个，写下什么永远由主模型决定。** 对上的候选本来就是主模型的答案；对不上的那一格，写的也是主模型的答案。
- **每一轮至少写下 1 个 token。** 哪怕第 1 个候选就猜错，第 1 格的预测照样有效，它就是不猜时这一步本来会算出的那个 token。

## 为什么需要它：decode 一步只出 1 个 token，权重却要整份读一遍

主模型每算一步，都要把自己的全部**权重**（模型学到的那些矩阵，见[权重与矩阵乘](matmul-and-weights.md)）从设备显存读进计算单元。decode 时一条请求一步只送进 1 个新位置，读进来的权重只乘 1 行输入就用完了；请求少的时候，这一步的时间大部分花在读权重上，乘法本身很快就做完（带宽怎样卡住 decode，[prefill 一页](prefill.md#为什么把已知的位置合成一步代价在哪)演算过）。

同一份权重读进来一次，乘 1 行和乘 4 行，读的字节一样多。speculative decoding 利用的就是这一点：把 1 个已确定的位置和 3 个候选位置一起送进去，多出来的 3 行几乎不增加读取量。猜得准，一步就能写下好几个 token，步数跟着减少。下文把每轮猜几个记作 K，例子里 K = 3。

```calc
title: 一个 200 个 token 的回答要走几步（示意，K = 3）
不开 = 200 ÷ 1 = 200 步
每轮 3 个候选全对 = ⌈200 ÷ 4⌉ = 50 步，每步写下 3 + 1 个
每轮第 1 个候选就错 = 200 ÷ 1 = 200 步，每步只写下主模型自己那 1 个
```

步数不会比不开更多，但这不等于不会更慢，因为每一步都多付了几笔账：

- **草稿本身要算。** 猜 3 个，草稿就要接连跑 3 遍，后一遍要等前一遍的结果。
- **主模型每步多算 3 个位置。** 请求一多，一步里本来就有很多行，算力开始吃紧，多出的行就不再「几乎免费」。
- **猜错的位置白算。** 第一个不符之后的位置，主模型和草稿都白做了。
- **要多留地方。** 候选位置也要写 [KV cache](kv-cache.md)（为每个位置存下、供后面回头读的 key 和 value）和状态，一条请求比不开时多占几格。

这几笔账什么时候赚得回来、什么时候会亏，在[为什么也可能变慢](#为什么也可能变慢)一节算。下面这张小表把它和「多条请求一起算」分开：两者都是让一次读进来的权重多服务几行，只是这些行的来路不同。

| 做法 | 一次读权重服务几行 | 这些行从哪来 |
|---|---|---|
| 普通 decode，1 条请求 | 1 行 | 这条请求最新的 1 个 token |
| 多条请求一起 decode（batching） | 每条请求 1 行 | 不同的请求，各算各的 |
| speculative decoding | 每条请求 1 + K 行 | 同一条请求往后的 K 个猜测 |

## 一轮怎么走：送进 1 + K 个位置，写下 1 到 K + 1 个

把一轮的规则写成步骤：

1. **送进去**：1 个已确定的 token，加上 K 个候选，一共 K + 1 个位置。
2. **主模型一次算完**：每个位置都给出「下一格该是什么」，一共 K + 1 个预测。
3. **错开一格去比**：第 i 格的预测和第 i 个候选比（i 从 1 数到 K）。从左往右，对上就留下候选，接着比下一个；第一次对不上，写下这一格的预测，停止。
4. **全对时多送一个**：K 个候选全部对上，第 K + 1 格的预测也成立，再写下它。这个多出来的 token 叫 **bonus token**。
5. **草稿接着猜**：从这一轮最后写下的 token 往后，草稿再猜 K 个，交给下一轮。

所以一轮写下的 token 数 = 对上的候选数 + 1，最少 1 个，最多 K + 1 个。K = 3 时：

| 对上几个候选 | 这一轮写下 | 用上了哪几格的预测 |
|---|---|---|
| 0 | 1 个（主模型第 1 格的答案） | 第 1 格 |
| 1 | 2 个 | 第 1、2 格 |
| 2 | 3 个（图里的例子） | 第 1、2、3 格 |
| 3 | 4 个（3 个候选 + bonus token） | 全部 4 格 |

为什么第一次对不上就必须停？第 i + 1 格的预测是读着前面所有输入算出来的，其中包括第 i 个候选。第 i 个候选一旦是错的，后面各格读到的历史就和真实的不一样，它们的预测都不能用。图里第 4 格读过错误的「床」，所以作废；反过来，只有全对时，最后一格才是在正确的历史上算出来的，bonus token 才成立。

一轮之内的先后也要记住：**先验证，再猜下一轮的候选。** 草稿要从「这一轮最后写下的 token」往后猜，而这个 token 要等主模型验完才知道；有些草稿（比如后面讲的 MTP）还要用主模型这一轮刚算出的中间结果。所以一个 decode 步的顺序是：主模型前向 → 逐位接受 → 草稿猜下一轮。这一步验的候选，是上一步末尾猜出来的。

## Greedy 验证与随机采样分开理解

上面「对上就留下」的比法，只适用于 **greedy**（每一步都取分数最高的那个词）。主模型按 greedy 生成时，它在每一格的答案是确定的一个 token，候选和它一样就对，不一样就错。

请求开了随机采样（temperature 大于 0，按概率抽词，见[采样](sampling.md)）时，主模型在每一格给出的是一份**概率分布**，「答案」本身要靠抽，没法拿候选去和一个确定的词比。这时用的是 **rejection sampling**（拒绝采样）：按一个概率决定候选留不留，被拒时再从一份调整过的分布里补抽一个。规则设计成这样，是为了让每一格最终输出各个词的概率，**和主模型自己直接抽完全一样**。

记主模型在这一格给某个词 x 的概率为 p(x)，草稿给它的概率为 q(x)：

- **接受**：草稿抽到 x，以 min(1, p(x) ÷ q(x)) 的概率留下它。主模型比草稿更看好 x（p 不小于 q），一定留下；没那么看好，就按比例留。
- **补抽**：被拒时，从 max(0, p − q) 归一化后的分布里抽一个，写在这一格，然后停止。这份分布只保留「主模型比草稿更看好」的那部分词。

用 3 个词的小例子验算一遍。主模型的概率是猫 0.6、你 0.3、看 0.1；草稿的概率是猫 0.8、你 0.1、看 0.1。

```calc
title: 接受加补抽，输出概率正好等于主模型的 p（示意）
草稿抽到猫时留下的机会 = min(1, 0.6 ÷ 0.8) = 0.75
这一格被拒的总机会 = 0.8 × (1 − 0.75) + 0.1 × 0 + 0.1 × 0 = 0.2
补抽用的分布 = max(0, p − q) = (0, 0.2, 0)，归一化后只剩「你」
最终输出猫 = 0.8 × 0.75 = 0.6
最终输出你 = 0.1 × 1 + 0.2 × 1 = 0.3
最终输出看 = 0.1 × 1 + 0.2 × 0 = 0.1
```

三个结果正好是主模型的 0.6、0.3、0.1：草稿猜得偏，影响的只是一轮能留下几个，不改变输出的概率。greedy 是这条规则的特例：主模型的概率全压在最高分的那个词上，候选是它就一定留下，不是它就一定被拒，补抽出来的正是最高分的词。

草稿自己如果也是 greedy（每次只挑它最看好的一个词），它的概率就全压在候选那一个词上，q(x) = 1。规则化简成：以 p(x) 的概率留下候选；被拒时，从去掉候选之后的主模型分布里补抽。GLM 的 MTP 草稿就是这种情况，[采样](sampling.md#有-mtp-候选时采样变成验证)一页用「猫 0.731、你 0.269」演过一遍。

「输出概率不变」是数学上的结论，前提是每一格的 p 和不开时算得一样。实际运行时一步多了几行、批次形状变了，浮点加法的先后次序可能跟着变，最后几位的误差偶尔会让两个分数很接近的词换个先后，所以不能保证在任何设备、任何设置下逐个 token 都和不开时相同，见 [Batch invariance](batch-invariance.md)。昇腾另外提供了两种可选判法，默认都关：一种把一段候选按累积概率整块判（block verify，候选不少于 3 个时才生效）；另一种按主模型这一格的分布有多「拿不准」（熵）放宽接受门槛（entropy verify），候选因此更容易留下，输出分布也就不再严格等于主模型的。

## 候选从哪来：文本匹配、小模型，或模型自带的 MTP 层

草稿只负责猜，越便宜、越准越好。常见的有三类：

- **从已有文字里找重复**（vLLM 里叫 ngram、suffix 等）：看前文有没有出现过同样的几个 token，照着往下接。不跑模型、不占额外的 KV cache，但只在回答大段复述原文（改写、抽取、改代码）时猜得中；找不到可接的，这一步就不提候选，退回普通 decode。
- **另配一个小模型**（draft model）：同系列的小模型先跑 K 步给出候选。要另外加载一份权重，也要它自己的 KV cache。
- **借主模型的中间结果往后猜**（EAGLE、MTP 等）：不从头读文字，而是拿主模型刚算出的隐藏向量（每个位置的一串数，汇总了读到这一格为止的内容，见[层与隐藏向量](layers-and-hidden.md)），再加上刚确定的 token，往后猜。

**MTP**（Multi-Token Prediction，多 token 预测）属于第三类，而且是模型自带的：训练时就在主干之外多接了一个或几个预测层，学「再往后一格是什么」。推理时把这些层当草稿用，不用另外指定草稿模型，vLLM 直接从同一份模型文件里把它们加载出来。

只有 1 个 MTP 层、却要每轮猜 3 个时，就把这一层**接连跑 3 遍**：第 1 遍用主模型的隐藏向量和刚写下的 token 猜出候选 1；第 2 遍把候选 1 当输入、位置加 1、隐藏向量换成第 1 遍的输出，猜出候选 2；第 3 遍同理。「模型只有一个预测层」和「一轮猜三个」并不矛盾，前者说的是结构，后者说的是调用次数。代价是后一遍要等前一遍；而且这一层训练时只学往后多猜一格，接连拿来猜第二、第三格，越往后越不准，vLLM 启动时会为此打一条提醒。

GLM 的 MTP 层长什么样、两路输入为什么差一个位置，见 [GLM-5.3-Flash 的 MTP 层](glm-5-3-flash.md#mtp主干之外的第-45-层)；R1 第一次草拟时每一行配什么输入，见[一条请求的第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

## 验证完，被拒的位置怎么收场

候选位置是真正进过主模型的。主模型算它们时，已经把这些位置的 KV cache（为每个位置存下的 key 和 value，后面的 token 要回头读，见 [KV cache](kv-cache.md)）写进去了。候选被拒以后，这些格子怎么办？

**按位置存的 KV：不擦，下一步原地覆盖。** 调度器记着每条请求「已经算到第几个位置」。排这一步时，它先按 K + 1 个位置全算完记账；结果回来，有几个候选被拒，就把这个数退回几格。下一步从退回后的位置接着往后写，而一个位置写进哪一格，是按位置号查 [block table](block-table.md)（块表）得出的，所以写的正是上一步被拒的那几格，旧内容直接被盖掉。不存在专门「回收」被拒 KV 的动作。

用图里的例子记一遍账：「猫」在位置 5，此前位置 0–4 已经算完。

```calc
title: 被拒 1 个时，已算位置怎样退回（示意，K = 3）
这一步送进 = 猫、坐、在、床，位置 5–8
排的时候先记成全算完 = 5 + 4 = 9 个位置
被拒的候选 = 3 − 2 = 1 个，即位置 8 的「床」
结果回来后退回 = 9 − 1 = 8 个位置
下一步从位置 8 写起 = 垫子 + 3 个新候选，位置 8–11
> 位置 8 那一格原来存的是「床」的 KV，被「垫子」的直接盖掉
```

**只有验证过的 token 才登记进 prefix caching。** 多条请求开头相同时，KV 可以按块共享（[prefix caching](prefix-caching.md)）。登记可共享的块时只算到已经验证的 token 为止，没验证的候选不会被别的请求读到。

**给草稿多留 K 格。** MTP 和小草稿模型自己也要为候选位置写 KV，所以调度器给每条请求分 KV 位置时，在这一步要算的位置之外再多留 K 个（vLLM 叫 lookahead；DFlash 这种一次填出整段候选的草稿多留 K + 1 个）。只做文本匹配的草稿不跑模型，不用多留。

**递推状态：没法覆盖回去，就多存几份。** 有一类注意力不按位置存 KV，而是只留一份不断往前推的状态，每读一个 token 就更新一次，例如 [KDA 这类线性注意力](linear-attention.md)。这份状态被错误的候选推过一次就回不去了，没法像 KV 那样退回几格、下一步盖掉。办法是把每推进一个位置后的状态都存下来：一轮 K + 1 个位置，就为每条请求准备 K + 1 份状态的位置，下一步按上一步留下了几个，挑出最后一个有效位置之后的那份接着推。图里的例子留下了「坐 在」，有效输入到位置 7 为止，下一步就从「读完位置 7」的那份状态接着推，「读完位置 8（床）」的那份丢掉。这类层前面常有一个短卷积，要记住最近几个位置的输入，它的缓存也要为候选多留 K 格。

## 为什么也可能变慢

一轮能写下几个 token，取决于候选有多准。设每个候选被接受的概率都是 α（接受率；实际上越往后的候选越难被接受，这里为了估算按相同算），一轮猜 K 个，平均每轮写下的 token 数是 (1 − α 的 K + 1 次方) ÷ (1 − α)。α 越接近 1，结果越接近 K + 1；α 为 0 时正好是 1。

但开了以后，每一步本身也更贵：草稿要接连跑 K 遍，主模型每条请求多算 K 行，还要准备验证用的下标和状态。把「每步贵了多少」也算进来，才是实际的快慢。下面按开了以后每步耗时是不开时的 1.3 倍来演算，这个倍数是编的，实际会随批次大小、模型和设备变。

```calc
title: 接受率决定赚不赚得回来（示意，K = 3，每步耗时按 1.3 倍算）
α = 0.6 时每轮平均写下 = (1 − 0.6⁴) ÷ (1 − 0.6) ≈ 2.18 个 token
折合加速 = 2.18 ÷ 1.3 ≈ 1.68 倍
α = 0.2 时每轮平均写下 = (1 − 0.2⁴) ÷ (1 − 0.2) ≈ 1.25 个 token
折合加速 = 1.25 ÷ 1.3 ≈ 0.96 倍，比不开还慢
```

所以「每步至少写下 1 个 token，最差也不会比不开慢」不成立：步数确实不会更多，但每一步更贵，接受率低时总时间反而更长。下面几种情形会让收益缩水：

- **并发高。** 请求一多，一步里本来就有很多行，读权重的成本已经被这些请求分摊；再给每条请求加 K 行，换来的主要是更多计算。收益最大的是请求少、对时延敏感的场景。
- **回答难猜。** 开放式的生成、温度高的随机采样，候选更容易被拒。
- **K 太大。** 越往后的候选越不准，多猜的几个大多被拒，草稿却要多跑几遍。
- **和录图尺寸叠加。** 一条请求一步占 K + 1 个位置，批次补齐到固定尺寸时，空跑的位置也跟着放大，见下一节和 GLM 多条请求那一节。
- **占的地方更多。** KV 和状态都要为候选多留，同样的显存能同时放下的请求变少。

评估时要同时记下：每轮猜几个、每轮实际留下几个的分布、首 token 时延和之后每个 token 的间隔、吞吐、显存占用、当时的并发数。只看其中一项，容易得出相反的结论。

## 和调度、图模式怎样配合

开了 speculative decoding，一条 decode 请求每步不再是 1 个位置，而是 1 + K 个。调度、显存预留、图模式都要跟着这个数走。下图是一步在两个进程里的走法，站号对应[一条请求](one-request.md)走过的七站：

```wiki-diagram
file: speculative-decoding-flow
```

**调度：候选占普通名额，放不下先砍候选。** 调度器每步有一个 token 预算（一步最多算多少个位置）。它先定这一步给这条请求几个位置，再倒推放得下几个候选；不够时把候选截短，而不是把整条请求推到下一步。被排进来的候选记在这一步的计划里，请求手上的候选清空，等这一步末尾草稿猜出新的再写回去。

**图模式：只有整齐的 decode 步能回放。** [图模式](graph-mode-layer.md)把一整步要下发的算子事先录好，运行时一次提交。录图按固定的几个 token 数录，开了 speculative decoding 后：

- 每条 decode 请求固定占 1 + K 个位置，所以录图尺寸要是 1 + K 的倍数。配置的尺寸不是倍数时，vLLM 自动向上凑整；凑完一个都不剩（比如最大尺寸比 1 + K 还小），启动时报错。
- 一步能不能回放，要看它是否**整齐**：所有请求的提示词都已算完、每条请求正好 1 + K 个位置、总数不超过录过的最大尺寸；用了数据并行时，另一组也要整齐。混进一条还在算提示词的请求，这一步就整步退回 eager mode（不用图，算子逐个下发），判据见[这一轮回放哪一张图](graph-mode-layer.md#这一轮回放哪一张图五条判据)。
- 草稿层也可以单独录图，但那样要求草稿的批次也补齐到录图尺寸：草稿要录图、图模式又含 FULL（把整步前向录成一整张图的那一档，见[图模式的几档](graph-mode-layer.md#录多少nonepiecewisefull-和两个组合档)）时，关掉草稿批次补齐会在启动时报错。GLM 系列的草稿层固定不录图，见下一节。

**昇腾注意力：一条请求一轮最多 16 个位置。** 昇腾的融合注意力算子在 decode 时一条请求一轮最多处理 16 个 token，所以 1 + K 不能超过 16，即 K 最多 15。超了启动时直接断言失败。

**异步调度会不会被关掉。** [异步调度](async-scheduling.md)（调度器不等这一步的结果回来，先把下一步排好）在没有明确设置时默认就是开的，开不开 speculative decoding 都一样。开了 speculative decoding 以后，它只在两种情况下被自动关掉：草稿方法不属于 EAGLE 一类（MTP 属于这一类；只做文本匹配的 CPU 版 ngram、小草稿模型都不属于），或者关掉了草稿批次补齐。保留时，调度器先按候选全被接受把下一步排好，结果回来再改正。

**PagedAttention 那条算子路径不走。** 昇腾普通注意力后端里有一条 PagedAttention 算子路径，开了 speculative decoding 就一律不用它。

## 落到 GLM 双机：每步 1 + 3 个位置，MTP 层连跑 3 遍

官方双机部署是 2 台 Atlas 800 A2、每台 8 张 NPU：每台机器内 8 张卡合跑一份模型（TP8），两台各接各的请求（DP2，每台是一个 DP 组），路由专家分到全部 16 张卡（EP16），权重是 W8A8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。这套部署开着 MTP，每轮猜 3 个。启动参数里写的方法名是 deepseek_mtp，vLLM 会把它改名成 mtp 并提示旧名已弃用；草稿就是模型自带的第 45 层，不另给草稿模型。完整命令见[部署基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)。3 是官方示例的选择，不是本知识库实测出的最佳值。

**MTP 层是什么样的。** 它在 45 层主干之外，结构和主干里的稀疏 MLA + MoE 层相同，只有单条残差；嵌入表和最后的词表投影（lm_head）与主模型共用同一份。它在每张卡上占多少权重，账在[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

**一个 decode 步。** 用 R1 来看（贯穿全库的示例请求，提示词 4 个 token，见[一条请求](one-request.md)）。R1 每步送进主模型 1 个已确定的 token 和 3 个候选，主模型 45 层都按 4 行算，词表投影出 4 行分数：前 3 行验候选，第 4 行留作 bonus token。验完以后，草稿层接着跑 3 遍。

```calc
title: GLM 双机一个 decode 步多做了多少
每步前向的层次 = 45（主干）+ 3 × 1（MTP 层连跑 3 遍）= 48 层
R1 每步送进主模型 = 1 + 3 = 4 个位置
一个 DP 组满载一步 = 32 条 × 4 = 128 个位置，正好是最大的录图尺寸
满载一步最少交回 = 32 × 1 = 32 个 token
满载一步最多交回 = 32 × 4 = 128 个 token
```

一步交回的这 1 到 4 个 token 还只是词表编号。它们回到前端后，由反分词接上已有的文字，拼成一段新增文字再推给客户端，所以客户端一次看到的可能是几个字，见[流式输出](streaming-output.md)。

R1 前两圈 decode 各接受几个、已算位置怎样从 8 退到 6、位置 6 和 7 怎样被覆盖，在[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)逐格算过：两圈一共写下 2 + 4 = 6 个 token，平均每圈 3 个。那里的「接受 1 个」「全部接受」是为了把账走通设的例子，这套部署真实的接受率还没有测量数据。

**验证怎么判。** greedy 请求逐位比最高分的词。随机采样的请求按前面的规则判：GLM 的草稿每遍都取最高分的词，与请求自己的温度设置无关，昇腾实现里也不保留草稿的概率，所以就是那个特例，主模型给候选的概率不小于一个随机数就留下。验证前，这 3 行分数照样经过惩罚项、温度、top-k、top-p 那一整套处理，见[采样](sampling.md#有-mtp-候选时采样变成验证)。

**草稿层固定 eager。** vllm-ascend 遇到 GLM 系列加 speculative decoding 的组合，会把草稿层强制切回 eager mode；主模型那一侧不受影响，仍按 FULL_DECODE_ONLY（只给整齐的 decode 步录 FULL 图，混合步不录）回放录好的图。这条强制附带一条警告，但只有草稿原本要录图时才打：官方命令已经给草稿写了不录图的选项，草稿本来就是 eager，所以这套部署的启动日志里看不到这条警告。草稿不录图，所以不补到录图尺寸；它的宽度另按两个 DP 组对齐，见下一节。

**每遍草稿的额外开销。** 每遍都要过一次完整的稀疏 MLA 和 MoE，并在 8 卡之间至少多做两次通信：草稿层出来后一次 [All-Reduce](collective-communication.md#all-reduce)，算候选分数时一次 All-Gather 把按词表切开的分数拼回来。稀疏 MLA 的索引器（先为每个位置挑出要读的历史，见[稀疏注意力](sparse-attention.md)）三遍各算一次，不复用第一遍挑出的结果。草稿第一遍的批次和主模型这一步一样宽，被拒的位置也跟着算，只是不从它们那几行取候选；后两遍沿用第一遍的宽度。

**录图尺寸与上限。** 主模型录了 4、8、16、32、64、96、128 七个尺寸，都是 4 的倍数，不用再凑整，分别对应 1 到 32 条请求。1 + 3 = 4，在昇腾注意力 16 个的上限之内。

**KV 和状态多留的那几格。** 存 KV 的层是主干 11 层稀疏 MLA 加 MTP 这一层，一共 12 层，每 token 每卡 13,056 B，账在[剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；每条请求为候选多留 3 个位置。34 层 KDA 分成三组，每组每条请求占 4 块：1 块当前状态 + 3 块候选状态，见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。KDA 前面短卷积的核长是 4，它的缓存本来记 3 个位置，为候选多留 3 格，变成 6 格。

**快到长度上限时。** 草拟时位置超过模型长度上限的候选按作废处理；调度器也会把这一步能排的位置截到不超过上限，所以那一步进模型的位置会少于 4 个，整齐条件不成立，这一步不回放图。

## GLM 双机上多条请求时：补齐和陪跑跟着放大

多条请求一起跑时，MTP 让每条请求一步占 4 个位置，两件和批次有关的事都跟着放大。推导在[多条请求](concurrent-requests.md)一页，这里只给结论。

- **补齐到录图尺寸。** 一步的 token 数要向上补到最近的录图尺寸。同样 12 条 decode 请求，不开时是 12 个 token，补到 16，空跑 4 格；开了 MTP 是 48 个，补到 64，空跑 16 格，绝对浪费放大 4 倍，见[先补到自己这组的图尺寸](concurrent-requests.md#先补到自己这组的图尺寸)。不开 MTP 时 32 条请求只需要 32 这一档，开了才要一路录到 128。
- **两组对齐，草稿陪跑。** 两个 DP 组每步要对齐宽度：主模型补到两组里较大的那个，草稿层三遍也按较大的那组跑。一组混进一条长提示词，两组这一步都用不上图，草稿层也被一起拉宽；没有请求的那一组也要带着草稿层空跑，见[再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)和[空闲组为什么陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

## 常见误解

- **「被拒的候选等于白算。」** 不全是。第一个对不上的位置写下的，正是不开时这一步本来会算出的 token；真正白做的，只是它后面那些位置的计算和 KV 写入，以及草稿多跑的那几遍。
- **「开了以后输出会变差。」** 按默认判法，每一格输出各个词的概率和主模型直接生成一样，greedy 时逐个 token 相同（不计浮点误差）。会改变输出分布的是昇腾可选的 entropy verify，它默认关着。
- **「每步至少写下 1 个，所以最差也不会比不开慢。」** 步数不会更多，但每步更贵；接受率低或并发高时，总时间可以更长。
- **「一个 MTP 层只能猜一个。」** 可以接连跑多遍，每遍把上一遍的候选当输入，只是越往后越不准。
- **「草稿先跑，主模型后跑。」** 一步之内顺序反过来：主模型先验这一步的候选，草稿再用刚算出的结果猜下一步的。
- **「被拒位置的 KV 要专门回收。」** 不用。已算位置退回几格，下一步原地覆盖；递推状态是事先多存几份，按接受数挑。
- **「GLM 的草稿也回放图。」** 不回放。主模型回放 FULL 图，草稿层被强制成 eager。
- **「MTP 是一套独立的实现。」** 在 v0.23、v0.26 和 GLM 固定提交上，mtp 和 eagle 走同一个草稿类；main 才给 GLM 这种 KV cache 分成多组的 MTP 单独分出一个子类。

## 对照源码

### 怎么开

GLM 双机按官方命令开 MTP（这里只摘投机那一项，完整命令见[部署基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)）：

```bash
--speculative-config '{"method": "deepseek_mtp", "num_speculative_tokens": 3, "enforce_eager": true}'
```

- 不给 `--speculative-config`：Worker 里没有草稿器，调度器的候选表一直为空，验证那条路一次都不进。
- `deepseek_mtp` 在上游的 MTP 方法名单里，配置解析时打弃用日志、改名成 `mtp`；昇腾补丁再把草稿的 `model_type` 改写成 `glm5_next_mtp`，并把它加进 MTP 名单。
- `method` 为 `mtp` 又没给 `model` 时，草稿直接用目标模型同一路径；GLM 的 MTP 层数来自 config 的 `num_nextn_predict_layers = 1`。
- `num_speculative_tokens` 就是 K；它同时决定 decode 每请求每步的 query 长度 `uniform_decode_query_len = 1 + K`。
- 草稿的 `enforce_eager`：GLM 上不写也会被强制成 eager，只是不写时启动会多一条 GLM 警告。`disable_padded_drafter_batch`：关掉草稿批次补齐，异步调度会因此被自动关掉。
- 昇腾 `--additional-config` 里的 `rejection_sampler_config`：`enable_block_verify`、`enable_entropy_verify` 默认 `False`，`posterior_threshold` 默认 0.95、`posterior_alpha` 默认 0.4。本部署没写 `--additional-config`，按默认走。

### 会报什么错

- 注意力元数据构建器里 `decode_threshold = 1 + K`，紧接 `assert decode_threshold <= 16`，报错串写明 `npu_fused_infer_attention_score` 的 TND 布局一轮最多 16 个 token。GLM 走的 SFA 后端、MLA 与普通注意力后端都有这一句。
- `ValueError: No valid cudagraph sizes after rounding to multiple of ...`：录图尺寸凑成 1 + K 的倍数后一个都不剩。
- `NotImplementedError: Speculative Decoding with cudagraph mode containing full cudagraphs only supports padded drafter batch`：关了草稿批次补齐、草稿又按用户配置要录图、且图模式含 FULL。这一检查排在 GLM 强制 eager 之前，所以 GLM 上只要草稿配置里没写 `enforce_eager`，同样会触发。
- 警告 `method deepseek_mtp is deprecated and replaced with mtp`：上面说的改名。
- 警告 `Enabling num_speculative_tokens > 1 will run multiple times of forward on same MTP layer, which may result in lower acceptance rate`：K 大于 1 且草稿是 MTP（`step3p5_mtp` 除外），GLM 的 K = 3 会触发。
- 警告 `GLM series models with speculative decoding currently do not support graph mode ...`：GLM 草稿被切回 eager。只在草稿原本要录图时打印（主模型开着图模式、草稿配置里没写 `enforce_eager`）；官方命令写了 `enforce_eager: true`，所以 GLM 双机的启动日志里没有这一条。
- `RuntimeError: Expected num_accepted_tokens for Ascend GDN speculative conv1d path.`：KDA 这类递推层的投机路径缺了「上一步留下几个」。正常运行不会出现，出现说明元数据没传对。
- 上游拒绝采样器要求每条请求的候选数不超过 128（`MAX_SPEC_LEN`）。

### 开销和什么时候别开

- 低并发、看重单条请求时延时收益最大；并发高、只看吞吐时收益缩水，要实测再定。GLM 官方命令开着 MTP，但本知识库没有这套部署的接受率与开关对照数据。
- 草稿是自回归的：MTP、EAGLE 在一步末尾串行跑 K 遍（第一遍之后再跑 K − 1 遍），K 越大这段越长。
- 只做文本匹配的草稿不跑模型、不多占 KV，但匹配不到就一个候选也不提，这一步退回普通 decode。
- 录图尺寸补齐的空跑按 1 + K 倍放大；两个 DP 组时草稿层也按较大一组的宽度陪跑。
- 开了 speculative decoding 就不走昇腾的 PagedAttention 算子路径。
- 每条请求多占 K 个 KV 位置；递推层多占 K 份状态，卷积缓存多 K 格。

### 版本差异

下表 v0.23 指维护分支 `2c59ff10`，v0.26 指 `2ed6cbba`，main 指 2026-09-21 的快照 `baa023ad`；GLM-5.3-Flash 的模型代码只在孤立提交 `db701c1f`（本知识库的固定镜像）和 main 里有，单列一栏。核心流程（排 1 + K 个位置、第一个不符就停、被拒位置原地覆盖）四处一致，`assert decode_threshold <= 16` 也一致。

| 项 | v0.23 | db701c1f（GLM） | v0.26 | main |
|---|---|---|---|---|
| GLM-5.3-Flash 的 MTP 层 | 无此模型 | `glm5_next_mtp.py` | 无此模型 | 挪到 `glm5next/mtp.py`，首位清零与两路归一化、拼接融成一个算子，数学等价 |
| GLM 系列草稿强制 eager | 有 | 有 | 有 | 有 |
| `mtp` 落到哪个草稿类 | 与 `eagle` 共用 `AscendEagleProposer` | 同 v0.23 | 同 v0.23，另多一个 `dspark` 分支 | `glm5_next_mtp` 走 `AscendMultiKVCacheGroupMTPProposer`，按物理 KV cache 组重写 eager 下的元数据；Gemma4 的 MTP 也单独分出 |
| 文档写的 1 + K 上限 | 文档同一句先说算子最多 16 个，又写 ≤ 15；代码是 16 | 代码 16 | 文档改成 ≤ 16 | 文档 ≤ 16 |
| block / entropy verify | 默认关 | 默认关 | 默认关 | 默认关，配置改成数据类 |
| 草稿滑动窗口 | 无 | 无 | 从 `additional_config` 直接读，不分方法，MTP 也会被套上 | 进 `AscendConfig`，草稿是 MTP 时警告并忽略 |
| 每步猜几个能否随批大小变 | 固定 K | 固定 K | 上游配置多了 `num_speculative_tokens_per_batch_size`，昇腾侧未见引用 | 昇腾另有 `dynamic_spec_config`，只认 `dspark`、`dflash`；按批大小变的写法与 decode context parallel 不能同开 |

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| greedy 与随机接受、补抽分布（上游） | `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py`，`rejection_greedy_sample_kernel`、`rejection_random_sample_kernel`、`sample_recovered_tokens_kernel` |
| 昇腾拒绝采样与两种可选判法 | `vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py`；`vllm_ascend/ops/triton/reject_sample.py` |
| 预算截短候选、被拒回退、lookahead | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`；`vllm/v1/core/kv_cache_manager.py` 的 `allocate_slots` 注释 |
| 方法改名、K > 1 警告 | `vllm@0fc695fc:vllm/config/speculative.py` |
| 录图尺寸凑整与报错 | `vllm@0fc695fc:vllm/config/compilation.py`，`adjust_cudagraph_sizes_for_spec_decode` |
| 注意力 16 个上限 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py`（另有 `mla_v1.py`、`attention_v1.py`） |
| 草稿类分流 | `vllm_ascend/spec_decode/__init__.py`，`get_spec_decode_method` |
| GLM 强制 eager、草稿三遍、DP 对齐 | `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py`，`_is_glm_model`、`_run_merged_draft`、`_propose` |
| GLM 的 MTP 层 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py` |
| 递推层的候选状态 | `vllm_ascend/ops/gdn_attn_builder.py`；`vllm_ascend/ops/kimi_kda_state.py` |
| 整齐 decode 的判据 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` |

一步之内的先后：昇腾先做 Worker 侧的记账（`_bookkeeping_sync`）再草拟，上游 vLLM 是先草拟再记账；两者都在验证之后。GLM 的 config 里 `index_share_for_mtp_iteration` 为 `true`，但 `db701c1f` 里没有对应的复用实现，三遍草拟都重算索引器。

**正文证据归档。** 第一个不符之前逐位比最高分、全对补 bonus [C1]；随机请求按 p ÷ q 与随机数比、草稿概率缺省时取 1 [C2]；补抽用 max(0, p − q)，草稿概率缺省时去掉候选再抽 [C3]；接受加补抽保持主模型分布 [S4][S5]，3 个词的验算、平均每轮写下数与加速比都由此推出 [D]。entropy verify 把随机数乘一个不超过 0.95 的系数 [C19]，两种判法默认关 [C20]；昇腾侧整套验证顺序见来源第 18 条。

预算不够时截短候选 [C6]，结果回来按被拒数退回 [C7]（下一步原地覆盖由退回后的位置号推出），只登记已验证 token、为草稿多留位置 [C8]（各草稿方法多留几格见第 9 条）。方法改名与 K > 1 警告 [C10][C11]；录图尺寸凑整与报错 [C12]；16 个上限 [C13]；整齐判据 [C23]；异步调度自动打开 [C36]；PagedAttention 互斥见第 24 条。

GLM 强制 eager 与补齐检查的先后 [C14]，三遍草拟取最高分 [C15]，草拟补到两组最大宽度 [C16]，MTP 层结构与按步取模选层 [C17]；MTP 层数 [S30]。递推层取 K + 1 份状态 [C21]，卷积缓存多留 K 格 [C22]。「训练时只学往后多猜一格」是按 MTP 层数为 1 推断的解释 [I]。

版本表：main 的 GLM 草稿子类 [C27]，文档上限 [S28][S29]，上游按批大小变的配置 [C31]，v0.26 的草稿滑动窗口 [C32]；其余各行依次见来源第 25、26、33、34、35、37 条。

**待核。**

- 这套部署的真实接受率、每轮留下个数的分布，以及开、关 MTP 的首 token 时延、生成间隔与吞吐对照（需要 benchmark 输出）。
- 开了 MTP 以后每步实际贵了多少：草稿三遍各自的耗时、主模型 4 行与 1 行的耗时差。
- block verify 的具体算法是否严格保持主模型分布：本页只核了它的开关条件，没有逐行核算法。
- KDA 递推状态在下一步具体取第几份：本页按「最后一个有效位置之后的那份」描述，没有逐行核 KDA 内核的取法。
- v0.26 上 MTP 被套上草稿滑动窗口后的实际影响：只核到「不分方法」，没有实跑。
