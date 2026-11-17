---
id: prefill
title: Prefill 与 Decode：提示词怎样处理，回答怎样接着往下写
type: concept
summary: >-
  Prefill 处理提示词中尚未计算的位置并建立历史，可以一轮完成，也可以跨多轮；处理完成后，用最后一个位置选出回答的第一个 token。随后 decode
  在已有历史上接着生成。两者用同一套权重，区别在输入位置的用途、已有历史以及调度与执行分支。
aliases:
  - Prefill
  - Decode
  - 预填充
  - 解码
  - 首 token 阶段
  - prompt 阶段
  - prefill 阶段
  - P 阶段
  - D 阶段
  - 首 token 延迟
  - prompt_logprobs
  - prompt logprobs
  - 提示词概率
  - 提示词对数概率
chapters:
  - '05'
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L400-L416'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L680-L700'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L70-L84'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L259-L271'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L395-L432'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L838-L856'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1471'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L147-L152'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941'
  - 'vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L306-L327'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L590-L644'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1307'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2326-L2327'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2632-L2686'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2738-L2742'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L428-L436'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L566-L574'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L70-L72'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1505'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1355'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1662-L1690'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L434-L515'
  - >-
    raw:sha256-08c5c80fd562026f77c85a102ffd4cedae609ed7d2c5faa5498ec73d556ed625.md#L1-L700
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L525-L590'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L262-L288'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L478-L484'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L713-L773'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L5399-L5509'
  - 'vllm@568afb3a:vllm/v1/worker/gpu_model_runner.py#L5562-L5679'
  - 'vllm@84030bbe:vllm/v1/worker/gpu_model_runner.py#L5608-L5725'
  - 'vllm@0fc695fc:vllm/v1/engine/logprobs.py#L121-L206'
  - 'vllm@0fc695fc:vllm/logprobs.py#L100-L206'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L110-L155'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L577-L630'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L693-L723'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L275-L333'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L409-L437'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L476-L540'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L475-L487'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L217'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2769-L2773'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2712-L2716'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L3131-L3135'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2834'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L1308-L1324'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2385'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2514-L2531'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2773-L2788'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: R1 的 prefill 与 decode 两圈、每卡形状、块号和通信都只在那一页推导，本页只引结论
  - to: attention-qkv
    kind: builds-on
    note: 因果掩码决定一次送进去的多个位置各能看到哪些历史
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 每步 8192 个位置、32 条请求、MTP 3 个候选等部署取值的出处
  - to: token
    kind: builds-on
    note: Prefill 与 decode 按 token 所占的序列位置组织计算，依赖 token 页定义的分词、编号与位置概念。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-08c5c80fd562026f77c85a102ffd4cedae609ed7d2c5faa5498ec73d556ed625.md
  - >-
    raw/sha256-25219c3037f780c50966b146e2d9ae82e574fdca65a6362f6dec23d8d7a1bfea.md
---

## 回答的第一个字出来之前，模型在算什么？

**prefill（预填充）是处理请求的提示词、建立后续计算所需历史状态的阶段。一轮可以处理多个尚未计算的位置，提示词也可以分多轮处理；处理完成后，用最后一个提示词位置的输出选出第一个生成 token。随后进入 decode（解码）阶段：在普通自回归路径中，通常每轮把上一步刚选出的 token 送进模型，在已有历史状态上计算它所在的位置，再选出下一个输出 token。**

先说清两个词。token 是分词器（把文字切成小段的程序）切出的最小单位，一段提示词被切成若干个 token，每个 token 占一个**位置**。**历史**是模型为每个已经算过的位置留在显存里的中间结果，后面的位置要反复读它。模型每一层都有一步 [attention](attention-qkv.md)（注意力：每个位置按相关程度去读自己和前面各位置的信息），普通模型为此给每个位置存下 K、V 两个向量，供后面的位置来查、来读，这份存储叫 [KV cache](kv-cache.md)；GLM 有两类层：一类按位置往后追加这类历史，另一类每条请求只存一份固定大小的状态、原地更新，两类各是哪些层到 GLM 一节再点名。下文把两类统称为历史。

```wiki-diagram
file: prefill
```

图按时间从左往右走，画的是最普通的生成情况：不分块、不复用别的请求的开头、不猜候选，也没有要求额外的提示词概率记录。

- **第 1 步，4 个位置一起进去。** 提示词的 4 个 token 早就知道了，可以并排送进同一次前向（从输入 token 算到输出分数的一次完整计算），一起走完所有层。一起进去不等于互相乱看：attention 里的 **causal mask**（因果掩码，挡住每个位置后面的位置）让位置 i 只能看到 0 到 i，位置 0 只看自己，位置 3 看全部 4 个，规则见 [causal mask](attention-qkv.md#因果掩码限定每个位置能访问的历史)。
- **只有最后一个位置拿去选词。** 位置 3 已经读过整段提示词，它的输出用来预测提示词之后的第一个 token：先做词表投影（把这个位置走完最后一层得到的那排数，叫隐藏向量，变成词表里每个词的分数），再按请求的采样设置选出一个，得到 y₀。前 3 个位置的输出不用来选词，它们这一步真正留下的是写进历史的那几份结果。
- **第 2 步起，一次只能进一个。** 回答的第 2 个 token 要等 y₀ 选出来才知道该接在什么后面，所以第 2 步只把 y₀ 送进去，读前面 4 个位置的历史、再给自己写 1 格，选出 y₁；第 3 步再送 y₁。这就是 decode。

所以 prefill 这一步本身就产出了回答的第 1 个 token。在不分块、不复用开头、不猜候选的普通自回归路径上，生成 200 个 token 等于 1 次 prefill 加 199 次 decode，而不是 200 次 decode。这里数的是这一条请求走了几步，不是引擎（接请求、安排每一步算谁、调用模型的推理程序，比如 vLLM）一共循环了几次：同一时间还有别的请求，引擎也可能排队、空转。

「选出一个 token」和「把这个 token 送进模型」是前后两件事：y₀ 在第 1 步选出，到第 2 步才作为输入进模型。请求遇到停止条件时，最后选出的那个 token 不再进模型，也就没有自己的历史，见 [KV cache](kv-cache.md#已生成的-token为何还可能没有自己的缓存)。

## 为什么把已知的位置合成一步，代价在哪？

**合成一步，是为了让每一步都要付的固定开销只付一次；代价是这一步很宽，首字要等它，同一步里的其他请求也要等它。**

一步里的开销分两类。一类跟送进几个位置走：送进几个位置，就要做几份乘加。另一类每步都要付一遍，跟送进几个位置无关：每一步都要把模型的所有层从头到尾走一遍，走一层，这一层的权重就要从设备内存（卡上的显存）读进计算单元；调度器要先定下这一步算谁，再把一长串算子（矩阵乘、加法这类一个个的计算操作）逐个交给做计算的卡；模型切在多张卡上时，每层还要在卡间交换数据。拿一条提示词 6000 个 token、要回答 200 个 token 的请求来数（数为示意）：

```calc
title: 提示词 6000 个 token、回答 200 个 token：各走几步，一步送进几个位置（示意）
一个一个喂，走到回答的第 1 个 token = 6000 步
> 每步只送进 1 个位置
合成一步 prefill，走到回答的第 1 个 token = 1 步
> 这一步送进全部 6000 个位置
每片权重要和几个提示词位置相乘 = 6000 个
> 两种喂法一样多：逐个喂是 6000 步 × 每步 1 个，prefill 是 1 步 × 6000 个
逐个喂，理想每轮读一次所参与权重 = 6000 轮
> 这是权重复用模型；每轮重复组织前向及对应通信
合成一步，理想批内充分复用 = 1 轮
> 不表示每个算子只有一次下发或一次物理通信
之后的 decode = 200 − 1 = 199 步
> 每步只送进上一步选出的 1 个 token
prefill 一步 ÷ decode 一步 = 6000 ÷ 1 = 6000 倍
> 按一步送进的位置数比
```

上面比较逐个位置处理与将全部提示词安排在一轮处理的两种示意方式：合成一步保留了这些位置所需的数学计算，也增加了批内复用权重、分摊调用开销的机会。这里的 6000 轮与 1 轮是调度与理想复用的对照，不能等同为真实 HBM 读取次数或物理通信次数；各层可采用不同分块、缓存和融合实现。若预算使这条提示词实际分成多块，就需要跨多轮提示词计算才能走到第一个输出；这种按预算分轮处理的机制叫 chunked prefill。分块情况下不能直接套用上面“一步处理全部 6000 个位置”的计数；每轮处理多少位置，要按实际调度安排计算。

prefill 和 decode 要分开讲，就是因为这两种步子宽窄差得这么远：一个一步送进几千个位置，一个一步只送进 1 个。宽窄不同，代价落在哪里、卡在哪里也不同。先看 prefill 这一头，代价落在三处：

- **这一步很宽。** 设想同一台机器上已有 12 条请求在 decode，每条每步送进 1 个位置，一步共 12 个。要是一步能算多少位置不设上限，上面那条新请求一到，它的 6000 个位置就和这 12 个挤进同一步，这一步要算 6012 个位置；前一步只有 12 个、后一步 13 个，要算的位置多出几百倍，一般会慢得多。那 12 条 decode 请求也要等这一步算完，才拿得到自己的下一个 token。
- **首字要等它。** TTFT（time to first token，首 token 延迟）量的是请求到达到第一个 token 回到客户端的时间，排队、调度、prefill 前向、采样和返回都在里面；提示词越长，prefill 这一段越长。
- **所以一步要设上限。** 引擎给每一步能算的位置数定一个上限，叫每步的 token 预算；比这一步剩下的预算还长的提示词，先排剩下的那么多，下一步接着排，这就是 [chunked prefill](chunked-prefill.md)（分块预填充）。

还是上面的例子，把每步预算定成 2048 个位置（示意）：

```calc
title: 每步预算 2048 个位置时，6000 个位置的提示词分几步算（示意）
第 1 步排给新请求 = 2048 − 12 = 2036 个位置
> 同一步里 12 条 decode 请求先各占 1 个
第 2 步排给新请求 = 2048 − 12 = 2036 个位置
第 3 步排给新请求 = 6000 − 2036 − 2036 = 1928 个位置
> 1928 + 12 = 1940，放得下；这一段算完才选出回答的第 1 个 token
```

分块以后，那 12 条 decode 请求每一步都照常拿到下一个 token，同一步最多只陪 2036 个提示词位置一起算；代价是新请求的首 token 要等第 3 段算完。

decode 的处境正好相反。每步只有几个新位置，矩阵很小，但所有层和每步的固定开销一次也省不了，一步只出 1 个 token 很不划算。常见的对策是把很多条请求攒进同一步，像上面那 12 条一样一起走；或者用 [speculative decoding](speculative-decoding.md)（投机解码：先用便宜的办法草拟几个候选 token，下一步由主模型一次验证，猜对几个就多出几个）。衡量输出推进时，要区分 ITL（相邻两个输出 token 的间隔）与请求级 TPOT（首个输出之后的平均每 token 时间）；它们都受同批请求与混入的 prefill 影响。统一的计时事件、平均权重和片段合并口径见[推理测量](inference-benchmarking.md#先把一个请求的几种等待分开)。

两种步子的形状也会改变潜在瓶颈。按权重理想只读一遍且在批内复用的模型，行数越多，每字节权重对应的乘加越多。[矩阵乘页](matmul-and-weights.md#同一片权重为什么能处理多行输入)演过这个口径：权重每个数占 1 字节时，每字节配 2 × 行数 次运算。与设备“每秒运算数 ÷ 每秒可读字节数”的比值比较，可以判断这个简化模型更受带宽还是算力上限约束；它没有计入实际输入输出流量、缓存与通信，不能单独判定真实瓶颈。沿用示意比值 100 次/B：

```calc
title: 同一片权重，每读 1 字节配几次运算（示意：按每步只读一遍权重算，设备比值取 100 次/B）
prefill 一步 = 2 × 6000 = 12,000 次/B
> 不设上限时 6000 行，远高于 100，偏算力受限
分块后的 prefill 一步 = 2 × 2036 = 4072 次/B
> 按上面每步预算 2048 的分法约 2036 行，也还远高于 100
decode 一步 = 2 × 1 = 2 次/B
> 1 行，远低于 100，偏带宽受限
12 条请求攒进同一步 decode = 2 × 12 = 24 次/B
> 12 行，是单条的 12 倍，仍低于 100
```

这里只算了理想权重流量。输入、输出和历史也要搬，权重还可能被重复加载或命中缓存，因此真实算术强度要按实际流量重算。较宽的 prefill 更容易形成大矩阵乘；decode 每条请求新位置少，更容易受访存和每步固定开销影响。这只是形状给出的倾向，具体瓶颈还取决于批大小、模型结构、量化、内核和设备，须实测确认。

模型里有 [MoE](moe.md) 层（mixture of experts，混合专家：普通层里每个位置都要过同一段前馈计算，叫 MLP；MoE 层把它换成很多份并排的 MLP，叫专家，每个 token 只挑其中几个来算）时还要多想一步。decode 每步读的是这一步被选中的那些专家的权重：批小时只占全部专家的一小部分，批一大、token 一多，几乎每个专家都会被选中，读的也就接近全部。所以不能笼统地说 decode 每步都读全部专家，也不能说它总是只读一小部分。prefill 这头也不能把上面的 6000 行直接套到专家权重上：每个专家只分到路由给它的那些行。比如共 64 个专家、每个 token 挑 2 个（示意），6000 个 token 平均每个专家分到 6000 × 2 ÷ 64 ≈ 188 行，比整步的 6000 行少得多，但仍远多于 decode 的几行。

几个容易混的相邻概念：

| 概念 | 和 prefill 的关系 |
|---|---|
| decode | prefill 之后的每一步；普通路径每步送进 1 个新位置，开了 speculative decoding 时再加上待验证的几个候选 |
| chunked prefill | 同一条请求的 prefill 分几步做，只有最后一段产出首 token |
| prefix caching | 开头和之前请求相同的一段直接复用历史，prefill 只算剩下的，见 [prefix caching](prefix-caching.md) |
| PD 分离 | prefill 和 decode 放在不同执行组（各用一组卡），中间传历史，见 [PD 分离](pd-disaggregation.md) |

这里的前缀复用以已有历史状态兼容为条件，相同的开头文本本身不足以说明可以复用。复用减少了需要重新计算的提示词位置；剩余位置仍属于提示词处理，不会因此变成生成输出。

## 提示词已经给定，为什么还要算它的概率？

**提示词概率是在每个已有位置旁边补一份评分：给定前面的内容，模型原本有多可能接出当前这枚 token。** 例如比较两种提示词写法时，除了看最终回答，也可能想观察模型在哪个位置觉得接下来的词不常见。它不重新生成或改写提示词，也不是回答正确率；概率与自然对数的换算统一见[采样页](sampling.md#对数概率怎样读为什么不是置信度百分比)。

沿用前图的四个已知 token，位置 i 的隐藏向量只能用于预测 i+1，不能用已经看过 xᵢ 的向量给 xᵢ 自己评分。开启记录后，会额外拿前三个隐藏向量做词表投影，再从各排分布中取出实际下一枚提示词 token 的值；最后一个隐藏向量仍用来预测回答的第一个 token。

| 要记录的位置 | 用哪一排分数 | 实际取哪个编号 |
|---|---|---|
| x₀ | 本次输入内没有前一个位置 | 普通返回列表首项为空，没有这项条件概率 |
| x₁ | h₀ 投影出的分布 | x₁ 的编号 |
| x₂ | h₁ 投影出的分布 | x₂ 的编号 |
| x₃ | h₂ 投影出的分布 | x₃ 的编号 |

例如设词表只有 6 个词，位置 0 的隐藏向量 h₀ 投影出的原始分数为「猫 3、你 2、看 1、。0、我 −1、喜欢 −2」（做 log-softmax 时，“你”对应的概率为 `e² ÷ (e³ + e² + e¹ + e⁰ + e⁻¹ + e⁻²) ≈ 7.39 ÷ 31.71 ≈ 0.233`，与[采样页](sampling.md#对数概率怎样读为什么不是置信度百分比)六词示意同口径），而已知提示词在位置 1 的 x₁ 恰是“你”，就按 x₁ 的编号从 h₀ 那一排里取“你”的概率约 0.233，存它的自然对数 `ln(0.233) ≈ −1.457`；不会因为“猫”分数更高就把已知 x₁ 改成“猫”。请求前几名时，还会附上该位置的候选记录；数量为 0 仍保留实际提示词 token 的评分。这里的首项指分词及模板处理之后真正进入模型的第一枚 token，可能是特殊 token，不一定是用户输入的第一个汉字。

这项记录增加的是词表投影、整词表归一化和结果搬回，而非再做一遍全部模型层。提示词很长时，额外投影的行数很多，即使只返回实际 token 的值，也不能省去产生这排分布的计算。分块处理会逐段收集，直到提示词完成才交出整份记录；不是每个小块都作为一条独立的提示词响应。

已有 KV cache 只保留后续前向要用的历史，不保存每个位置的完整词表分布。因此按默认派生规则，请求提示词概率时会跳过已有前缀缓存的读取，包括数量为 0 的请求；这不等于全局关闭缓存，也不等于禁止写入缓存。共享与命中机制继续见 [prefix caching](prefix-caching.md#哪些块能被共享)。

## 落到 GLM 双机：R1 的第一步怎样成了 prefill

下面跟着[一条请求](one-request.md)里的示例请求 **R1** 走。R1 的提示词套完聊天模板、分词后是 4 个 token，记作 p₀ p₁ p₂ p₃，也就是首屏图里的 x₀ 到 x₃；4 是为了把每张卡上的形状逐行写出来取的演示长度，真实请求套完模板至少十几个 token，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。

部署沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)：两台服务器、16 张卡，TP8、DP2、EP16，W8A8 量化，开 MTP，每步草拟 3 个候选。这几个缩写各说的是一种分工：

- **TP8**：[tensor parallel](tensor-parallel.md)（张量并行），一台机器里的 8 张卡合算同一层，每张卡只拿这一层权重的一片，算完再把各卡的部分结果合起来。
- **DP2**：[data parallel](data-parallel.md)（数据并行），两台机器各用自己的 8 张卡组成一组，各自接请求、各自调度，这样的一组叫一个 **DP 组**。R1 落在 DP0，也就是 node0 上那一组 8 张卡。
- **EP16**：[expert parallel](expert-parallel.md)（专家并行），MoE 层的专家分放到两台机器的 16 张卡上，每个 token 要到它选中的专家所在的卡上去算。
- **W8A8**：权重和激活都用 8 位整数存、算，见 [quantization](quantization.md)。
- **MTP**：Multi-Token Prediction，模型自带的草稿层，每步末尾先猜 3 个候选 token，下一步由主模型一次验证，是 speculative decoding 的一种。

首屏说 GLM 有两类层，这里点名：模型主体的 45 层里，34 层是 KDA（Kimi Delta Attention，一种 [linear attention](linear-attention.md)：每条请求只存一份固定大小的状态，每来一个位置就原地更新），11 层是稀疏 MLA（MLA 把 K、V 压成一条较短的向量，按位置往后追加着存；「稀疏」指每个 query 只挑一部分历史位置来读，挑哪些由一个便宜的打分网络 indexer（索引器）决定，见 [sparse attention](sparse-attention.md)）。

上一节那几笔账换成本部署的数是这样。每一步都要把模型的 45 层走一遍；卡与卡之间交换数据靠 [collective communication](collective-communication.md)（集合通信：一组卡一起参与的数据交换，比如 All-Reduce 把各卡的部分结果加起来，让每张卡都拿到总和），哪怕 R1 只有 4 个 token，它的一步也要让每张卡做 218 次，账见[一次前向的通信账](one-request.md#一次前向的通信账)。一条 6000 个 token 的提示词如果逐位置执行，就需要推进 6000 轮模型计算。prefill 可以在一轮安排多个尚未计算的位置，减少逐位置执行时反复走模型和发起通信的轮数；但它不保证把整条提示词放进同一步。采用 chunked prefill 时，尚未完成的提示词会分配到多轮调度，每轮处理其中一部分位置，并更新请求的计算进度。因此，不能直接把 R1 一次前向的 218 次通信当作这条提示词完整 prefill 的总通信次数；这笔总账还取决于实际分成多少轮，以及各轮采用的执行路径。decode 这头同样省不掉 45 层和 218 次通信，本部署的对策是 MTP：decode 每步每条请求送进 1 个确定的 token 加 3 个候选，共 1 + 3 个位置。上一节表里那几个相邻概念，本部署默认开启 chunked prefill，默认关闭 prefix caching，也没有用 PD 分离；后两者只作变体了解。

一步之内，「这是 prefill」这件事在几个地方分别被认出来，下图按请求主线的站号（[一条请求](one-request.md)页把一次请求拆成的 7 站）排好先后：

```wiki-diagram
file: prefill-flow
```

### ② 调度：进度差是 4，这一步就是 prefill

**调度器里没有 prefill 阶段，只有一条规则：每条请求本步分到「应算位置数减已算位置数」，再被本步剩余的预算和长度上限夹住。** vLLM 在调度函数开头的注释里直说了这一点：调度器里既没有 decode 阶段，也没有 prefill 阶段，这一条规则同时覆盖 chunked prefill、prefix caching 和 speculative decoding。

本部署每个 DP 组每步的预算是 8192 个位置，同时在跑的请求最多 32 条，长度上限是 133120 个 token。R1 的前两步套用这条规则：

```calc
title: 同一条规则算出 prefill 和 decode
R1 第 1 步 = 应算 4 − 已算 0 = 4
> 4 个提示词位置全部排进这一步，这就是 prefill
R1 第 2 步 = 应算 (5 + 3) − 已算 4 = 4
> 5 = 4 个提示词 + y₀，3 = MTP 草拟的候选，这就是 decode
```

两步都是 4 个位置，差别只在这 4 个位置是什么：第 1 步是还没算过的提示词，第 2 步是刚选出的 y₀ 加 3 个待验证的候选。第 1 步里调度器还要为这 4 个位置和下一步的 3 个候选预留写历史的地方，按缓存组（存法相同的层编成一组，同组的层共用一串块号，见 [KV cache 规格](kv-cache-spec.md)）去要块号（历史按固定大小的块存放，块号就是块的编号，见 [KV cache](kv-cache.md#缓存按块存放一个位置的-kv-写进哪一格)），账只在[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)算。排完以后，调度器当场把 R1 的已算位置数记成 4，下一步就从位置 4 接着排。调度器的完整规则见[调度器](vllm-scheduler.md)。

这条规则带来两个直接后果：同一步里可以既有 prefill 又有 decode，别人的 decode 不用等你的 prefill 做完；提示词比本步剩余的预算还长时，这一步只排剩余预算那么多，下一步接着排。两者在后面的[长提示词](#长提示词和多条请求prefill-混进-decode-批以后)一节展开。

### ③ 准备输入：runner 给这一批贴上「全是新提示词」的标签

**调度器不分阶段，执行侧要分：注意力算子怎样读历史、这一步能不能回放图，都取决于这一批是什么情形。** node0 每张卡上的 runner（worker 进程里把调度结果翻译成张量、调用模型和采样的对象）拿到同一份调度结果，按每条请求算过没有、本步几个位置，给整批贴一个注意力状态标签。本部署常见的是三种：

- **全是新提示词**：这一批所有请求都还一个位置都没算过，贴 PrefillNoCache。R1 第 1 步就是这种。
- **全是 decode**：每条请求本步都是 1 个确定的 token 加若干候选，贴 SpecDecoding。R1 第 2 步起是这种；本部署开了 MTP，纯 decode 批贴的都是这个标签，而不是只送 1 个 token 的 DecodeOnly。
- **其余情况**：decode 和新提示词混在一批，或者长提示词接着算下一段，贴 ChunkedPrefill。场景 M 的第 2 步是这种。

第四个标签 PrefillCacheHit 只在关掉 chunked prefill 时才会被选到，本部署不出现。这几个标签是昇腾后端自己的分类；上游调度器仍然只有上面那一条规则。runner 还顺带记下一个「这一步含不含 prefill」的判断：只要标签不是纯 decode 的那两种，就算含 prefill。

单次只处理一个提示词位置时，这个位置仍属于 prefill；输入宽度与请求语义阶段是两个判断。注意力状态标签描述整批的执行方式。在未启用 MTP 的变体中，整批不满足“每条请求都还没算过任何位置”，且每条请求本轮都只安排一个位置时，会进入纯单位置执行分支；其中仍可包含正在处理最后一个提示词位置的请求。本部署启用了 MTP，同样的输入条件会选用前述投机解码标签。

除了贴标签，runner 还要给每个位置算好位置号和写历史的格号（slot）。按位置存的历史（稀疏 MLA 和它的 indexer 那一类）按格号写：prefill 一次给 4 个位置各算一格，decode 同样给本步的 4 个位置各算一格，两种步用的是同一套办法，差别在后面怎样读。KDA 的状态不按位置格号写，而是按请求的状态槽原地更新。这些张量的具体取值见[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。

### ④ 前向：同一套 45 层，执行方式和读写历史的方式不同

**R1 的 prefill 在每张卡上的张量宽度是 4，走的是同一套 45 层权重；不同的是这一步不回放图，KDA 和稀疏 MLA 也按 prefill 的方式读写历史。**

- **不回放图。** 本部署只给整齐的 decode 批录了图（graph mode：把一次前向的算子序列预先录好，之后同样尺寸的输入整段回放）。R1 第 1 步恰好也是 4 个位置，和一条 decode 请求一样宽，光看形状分不出来；所以开了 speculative decoding 时，runner 还要求「所有请求的提示词都已算完」才把这一批当 decode 批。R1 的提示词还没算完，这一步退回 eager mode（由 CPU 逐个下发算子）；两个 DP 组对齐执行方式时只要一边不能用图，两边都按 eager 走，所以另一台机器上陪跑的空批次也一样（DP1 此刻没有请求，但 MoE 通信要 16 张卡一起参与，它每步都要跑一次空批次）。条件见[图模式](graph-mode-layer.md)和[宽度补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。
- **KDA 层按段并行推进状态。** 34 层 KDA 遇到 prefill 的行，把位置切成每段最多 64 个一起算，R1 的 4 个位置正好一段；没有可接续的旧状态，就从清零的状态开始，算完写回最终状态。decode 的行则逐位置递推。见 [KDA 的两种算法](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **稀疏 MLA 层读自己及之前的位置。** 11 层稀疏 MLA 的 4 个 query 各自按因果范围读历史；R1 只有 4 个位置，挑出来的清单就是全部因果历史，等价于稠密的因果注意力，历史长了才真正挑着读，见 [11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。
- **通信几乎一样。** prefill 和 decode 每卡宽度都是 4，各层的 TP8 All-Reduce 和 MoE 通信次数、字节几乎相同，差别只在最后词表投影要出几行，账在[一次前向的通信账](one-request.md#一次前向的通信账)。

### ⑤ 采样：只取最后一行，选出 y₀

**没有候选的请求，每条只取本步最后一个位置的隐藏向量去算词表分数：R1 第 1 步词表投影只出 1 行，decode 步要出 4 行。**

runner 按每条请求在这一批里的结束位置减 1 找到这一行。R1 在本批里从第 0 行排到第 3 行，所以取第 3 行；位置 3 已经读过 p₀ 到 p₃，这一行的分数每张卡只算了词表的一片，经 TP8 All-Gather（各卡把自己那一片发给其他卡，每张卡都拼出完整的一份）拼成完整的 154880 个词，采样选出 y₀，这就是首 token。紧接着 MTP 拿这一步的隐藏向量和 y₀ 草拟出 3 个候选，留给下一步验证，见[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。decode 步要验 3 个候选，所以每条请求取 1 + 3 行。

请求要 prompt logprobs 时，runner 会另取提示词位置的隐藏向量做词表投影，按上节的错位关系给已知 token 评分，这是图中生成采样行之外的额外计算。R1 的 4 枚提示词对应 3 个有评分的目标位置，首项为空；不能把本节普通生成的“最后 1 行”当成开启记录后的全部投影工作。本部署默认关闭 prefix caching，提示词记录的跳过读取规则不会额外损失既有命中收益；投影与返回开销仍然存在。

### 和第一个 decode 步比：宽度一样，差在哪？

**本部署开了 MTP，R1 的 prefill 和第一个 decode 步都送进 4 个位置；两者的区别不在宽度，而在这 4 个位置是什么、有没有历史可读、走哪条执行路径。**

| 对照项 | 第 1 步 prefill | 第 2 步 decode |
|---|---|---|
| 送进主模型 | p₀ p₁ p₂ p₃，位置 0–3 | y₀ d₁ d₂ d₃，位置 4–7 |
| 读哪些历史 | 没有旧历史，只在本步 4 个位置之间按因果范围看 | 读位置 0–3 已写好的历史，再加本步的因果范围 |
| KDA 怎样算 | 按段并行，从清零的状态开始 | 逐位置递推，为 3 个候选各留一格状态 |
| 注意力状态标签 | PrefillNoCache | SpecDecoding |
| 执行方式 | eager，逐个下发算子 | 回放启动时录好的 4-token 图 |
| 词表分数 | 1 行 | 4 行：3 行验候选，1 行在候选全对时多给一个 token |
| 本步产出 | y₀，再草拟 3 个候选 | 按接受了几个候选，产出 1 到 4 个 token |

表里的 d₁ d₂ d₃ 是 MTP 在第 1 步末尾草拟的 3 个候选。第 2 步接受几个、已算位置数怎样回退，逐格的账在[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

「宽度一样」只在这个短例子里成立。真实提示词套完模板至少十几个 token，最长可到长度上限 133120，prefill 那一步通常远比 decode 宽。反过来，decode 在本部署每步送进 4 个位置、产出 1 到 4 个 token，所以按「每步 1 个 token」去数 decode 的步数会数多：R1 在首 token 之后如果还要 199 个 token，decode 最少要 50 步（每步都出 4 个），最多 199 步（每步只出 1 个），实际步数取决于候选的接受率。

### 长提示词和多条请求：prefill 混进 decode 批以后

**提示词一长，prefill 就会和别人的 decode 挤进同一步：这一步走 eager，MoE 通信改走另一条路径；再长就分几步算，中间几段的采样结果丢掉。**

[第二节](#为什么把已知的位置合成一步代价在哪)那个「12 条 decode 加一条 6000 个 token 的新请求」的例子，在本部署上就是[场景 M](concurrent-requests.md#示例场景-m-与变体-m)：其中一台机器上已有 12 条请求在 decode，又来了一条提示词 6000 个 token 的新请求 N。和第二节不同的是，本部署 decode 每条每步送进 1 + 3 个位置，这一步的宽度要重新数：

```calc
title: 场景 M 第 2 步，这台机器一步要算几个位置
12 条 decode = 12 × (1 + 3) = 48 个位置
N 的整段提示词 = 6000 个位置
这一步合计 = 48 + 6000 = 6048 个位置
> 不超过每个 DP 组每步的预算 8192，N 在这一步里算完了整段提示词
```

前一步只有 48 个位置，后一步 13 条都在 decode、是 52 个，这一步要算的位置是前后两步的上百倍，一般会慢得多（本部署没有实测数）；同一步里那 12 条 decode 请求也要等这一步算完，才拿得到自己的下一批 token。调度账在[并发页第 2 站](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。这一步在执行侧有三处和纯 decode 步不同：

- **标签是 ChunkedPrefill，执行方式是 eager。** N 的提示词还没算完，这一批不整齐，不能回放 decode 图。
- **KDA 按行分两路。** 12 条 decode 的行走逐位置递推，N 的 6000 行走按段并行，各自算完再按原来的行序拼回一份输出。
- **MoE 通信换路径。** 一步超过 128 个 token 就不能走 MC2（通算融合：把专家计算和跨卡收发协同执行的一类昇腾实现，只搬被选中的 token 副本），两台机器一起改走 AllGather（先把两台机器的全部隐藏向量互相收集一遍，每张卡再挑出路由到自己专家的行），门槛 128 的来历在[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)，这一步的通信账在[并发页的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。

提示词比这一步剩余的预算还长，就只排剩余预算那么多，下一步接着排，这就是 chunked prefill，本部署默认开启。多长才需要切、一条 20,000 个 token 的提示词会被切成哪几段，只在[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)推导。切开以后要注意两件事：

- **中间段也会采样，但结果丢掉。** runner 为了简单，对还没算完提示词的请求照样在本步最后一个位置采样一次；这个 token 不追加到请求上，也不返回客户端。请求自带随机种子时，它的随机数生成器还会往回拨，免得这次白采样打乱之后真正的采样。算完最后一段，才得到真正的首 token。
- **历史要跨段接上。** 后一段要读前一段写下的 KV cache，KDA 要在前一段留下的状态上接着算，见[分块预填充](chunked-prefill.md#历史状态必须跨段延续)。

下面几种做法会改变 prefill 的切法，但本部署都没有用，只作为变体了解，没有本部署的实测数：

- **关掉 chunked prefill。** 装不下的新请求这一步就不排，等到装得下再一步排完。本部署每步预算 8192 小于长度上限 133120，这样配置启动时就会报错，报错原文见页末。
- **单条 prefill 每步的额外上限。** 有一个参数能把一条长提示词每步分到的量压得比剩余预算还低；本部署没有设置，默认值 0 表示不另设上限。
- **Ascend 的可选调度器。** 本部署钉住的 vllm-ascend 代码里另带几种调度器，比如按性能剖析动态决定分块大小、按时延目标动态调整每步预算，本部署都没有启用，见[调度器](vllm-scheduler.md)；让短请求先走的[短请求优先](short-request-first.md)从 v0.26 起才有。

每步预算限制一轮安排多少位置，模型长度上限限制请求允许的长度。启用 chunked prefill 可以让提示词跨轮计算，但不会因此放宽模型长度上限。

## 常见误解

- **「prefill 是预处理，不算真正的推理。」** 它完整走一遍 45 层，并产出回答的第 1 个 token；提示词一长，它往往是这条请求单步计算量最大的一步。
- **「prefill 不产出 token。」** 它产出第 1 个 token。只有分块时的中间段不产出：那几次采样的结果被丢掉。
- **「提示词有 N 个 token，prefill 就要选 N 次词。」** 只在最后一个位置选 1 次。前面位置的输出不用来选词，要的是它们留下的历史。
- **「调度器里有一个 prefill 阶段。」** 调度器只按进度差排数量，「prefill」「decode」是按这一步排进来的位置是什么起的名字。runner 贴的注意力状态标签是昇腾后端的执行分类，也不是调度器里的阶段。
- **「prefill 一定比 decode 宽。」** R1 的 prefill 和 decode 都是 4 个位置。真正区分两者的是提示词算完没有、有没有历史可读；runner 判断能否回放图时，看的也是提示词算完没有。
- **「decode 每步只处理 1 个 token。」** 那是普通自回归路径。本部署开了 MTP，每条请求每步送进 1 + 3 个位置，产出 1 到 4 个 token。
- **「开了图模式，整条请求都在回放图。」** 本部署只给整齐的 decode 批录了图；prefill 那一步和任何混进 prefill 的步都走 eager mode。
- **「TTFT 就是 prefill 前向的时间。」** TTFT 还包括排队、调度、采样和返回；提示词被切开时，它跨越好几步，每一步还要和同批的 decode 共用。

## 对照源码

### 怎么开

prefill 不用开，每条请求的第一步都是它。能改变它形态的是下面几个启动参数；本部署的取值来自官方教程，教程没写的按默认值：

| 参数 | 管什么 | 本部署 |
|---|---|---|
| `--max-num-batched-tokens` | 每个 DP 组每步最多算多少个位置，决定多长的提示词要切开 | 8192 |
| `--max-num-seqs` | 同时在跑的请求上限 | 32 |
| `--enable-chunked-prefill` | 提示词能不能分几步算 | 未写，默认开启 |
| `--long-prefill-token-threshold` | 单条长提示词每步的额外上限 | 未写，默认 0，不另设上限 |
| `--enable-prefix-caching` | 相同开头复用历史 | 未写；GLM 这类混合模型默认关闭 |
| `--speculative-config` | MTP 每步草拟几个候选，决定 decode 每步多宽 | 草拟 3 个 |

**请求提示词概率。** `prompt_logprobs` 是 Python SamplingParams、Chat 和 Completion 的逐请求整数或 None/null 字段，三者默认均为 None/null；它不从生成配置文件继承，不是启动 CLI 或 Ascend additional_config。省略/null 通常关闭，echo 派生是下面单列的例外。

| 取值 | 含义 | 返回与前提 |
|---|---|---|
| None / null | 不显式请求 | echo=false 时关闭 |
| 0 | 只记录实际提示词 token | 仍做额外投影，仍按默认规则跳过前缀缓存读取 |
| 正整数 k | 前 k 名加实际 token | 同编号合并后每位置至多 k+1 项 |
| −1 | 请求全词表 | 必须让服务 max_logprobs 覆盖词表；默认 20 不允许 |

Python 的 result.prompt_logprobs 在请求结果顶层，不是 outputs[i].logprobs；普通形式为按提示词位置排列的列表，第一项 None，后续为 token ID → Logprob 字典。字段 logprob 是数值、rank 是名次、decoded_token 是可解码文字。flat_logprobs=true 改用[采样页所述扁平容器](sampling.md#记录的是处理前还是处理后怎样装进返回值)；其首位置为空区间，按位置索引得到空字典 {}，不是普通列表的 None。两者都表示首项没有评分，不能当概率为 0。

**HTTP 示例。** 向已有 glm 服务的 `/v1/completions` 发下面的顶层 JSON，Content-Type 为 application/json；stream=false 让提示词记录随完整响应返回。Chat 可把 prompt 换成 messages，仍把 prompt_logprobs 放请求体顶层；标准兼容 SDK 若没有声明此扩展，使用客户端额外请求体功能，线上不要保留 extra_body 包装。

```json
{
  "model": "glm",
  "prompt": "请解释 KV cache：",
  "max_tokens": 16,
  "prompt_logprobs": 0,
  "stream": false
}
```

完整 HTTP 响应中，Completion 在 choices[i].prompt_logprobs 返回同样按位置排列的结构，Chat 则在响应顶层的 prompt_logprobs 返回；JSON 对象键表现为编号字符串。Chat 包括 chat template 和特殊 token，不能按原始 messages 字数对齐。生成端的 logprobs 可以同时请求，也可关闭，两者独立。Python 可把 `SamplingParams(max_tokens=16, prompt_logprobs=0)` 交给已有 llm.generate，再读返回请求结果的 prompt_logprobs。

**流式与 echo 的精确边界。** 三版普通 HTTP 的请求校验都拒绝显式 stream=true 且 prompt_logprobs>0 或 =−1；0 可过这个校验，但流式响应 schema 没有独立 prompt_logprobs 字段，不能据此承诺会在 SSE 里收到完整提示词记录。引擎自己的 DELTA 输出则在 prefill 结束聚合交出一次，这与 HTTP 是否序列化是两层规则。需要独立记录时使用上面的非流式请求。

echo=true 且 prompt_logprobs 为 null/省略时，Completion 从请求 logprobs 派生提示词数量，Chat 从 top_logprobs 派生（默认 0，即使没有开启生成 logprobs）。这个派生发生在显式字段的流式校验之后；它不构成所有 HTTP 流式提示词记录都支持的承诺。Completion 的 echo 还可把提示词位置并入原有 logprobs 展示，首 token 无评分；Chat 的 echo 文本不能按同样方式推断。想关闭这份额外工作时，别同时用会派生记录的 echo 配置。

服务上限沿用[采样页的 max_logprobs](sampling.md#怎么开)：默认 20，服务 −1 放到词表大小，请求 −1 仍须通过上限检查。skip_reading_prefix_cache 默认 None 时，由 prompt_logprobs 是否为 None 派生；显式 False 可以覆盖派生，但复用的缓存没有所跳过位置的分布，不能用这个覆盖承诺完整记录。本页示例保留默认派生，不手动恢复缓存读取。

### 会报什么错

- **提示词比长度上限长**：输入处理阶段直接拒绝，报 `The decoder prompt (length …) is longer than the maximum model length of …`；本部署上限是 133120。提示词正好等于上限也会被拒，因为至少还要生成 1 个 token。
- **空提示词**：报 `The decoder prompt cannot be empty`。
- **变体：关掉 chunked prefill**：按本部署的其他参数，启动时报 `max_num_batched_tokens (8192) is smaller than max_model_len (133120)`，因为不分块时一条序列最长只能是一步的预算。
- prefill 本身没有专门的运行时报错。分块中间段的采样被丢弃是正常行为，不是错误。
- `prompt_logprobs must be non-negative or -1`：Python 给了小于 −1 的值；HTTP 对应提示为 must be a positive value or -1，但实际允许 0。数量超过服务预算会报 `Requested prompt logprobs … greater than max allowed`；默认上限 20 下直接请求全词表同样被拒绝。
- `prompt_logprobs are not available when stream=True`：显式正数或 −1 与流式请求冲突，改为非流式获取完整提示词记录。直接 prompt embeddings 没有可取值的提示词 token 编号，runner 会跳过这条记录路径，不能把无结果当成正常 token 评分。

### 开销和什么时候别开

prefill 关不掉，能调的是每步多宽：

- 调大预算可能让长提示词少分几段，也可能扩大混合步并改变排队、图模式和通信；首 token 与 decode 间隔是否改善要按负载测量，不能只从段数推断。
- 混进 prefill 的步走 eager、MoE 改走 AllGather，代价账见[并发页](concurrent-requests.md)；只有纯 decode 步才能回放图。
- [PD 分离](pd-disaggregation.md)把两个阶段放到不同执行组，减少长 prefill 对同批 decode 的计算干扰，但还会引入 KV 传输、排队和共享资源竞争；本部署没有用。

提示词概率默认关闭，只在确实需要逐位置评分时开启。数量 0 省的是候选返回量，不能省整排词表计算；−1 则连词表规模的结果都要保存、搬回与序列化。长提示词还可能失去前缀复用的收益；本部署 APC 默认已关，主要新增的是投影和记录开销。实际额外 TTFT、内存峰值与 MTP 并用的设备代价仍需测量。

### 版本差异

本页 KDA 层与 GLM 草稿层相关的执行细节只适用于含 GLM 代码的 `db701c1f` 和 `main`；调度规则与 runner 的通用分支在 `v0.23`、`v0.26` 与 `main` 三版全面核对一致，`v0.30.0rc2` 则针对上游分块/APC 默认值推导（`ced6857a`）与 MRV1 准备输入构造 `attn_state`（`7d825229`）做了专项核对：

| 内容 | v0.23 | v0.26 | v0.30.0rc2（专项已核项） | main |
|---|---|---|---|---|
| 调度器「不分阶段」的注释与进度差规则 | 有（vLLM `0fc695fc`） | 同（vLLM `568afb3a`） | 本页未单列重核此项（见表下核验范围） | 同（vLLM `84030bbe`） |
| 未显式设置 chunked prefill 时的有效默认值 | 由模型的分块支持能力推导 | 同左 | 配套上游（`ced6857a`）仍由模型支持能力推导 chunked prefill 与 APC 默认值；无显式开关时不能仅按版本名断言全部开启或关闭 | 同左 |
| 单条长提示词上限默认 0 | 是 | 是 | 本页未单列重核此项（见表下核验范围） | 是；另外去掉了「同时切分几条提示词」那组选项 |
| runner 注意力状态标签的判断顺序 | 维护分支 `2c59ff10` 与含 GLM 的 `db701c1f` 一致 | `2ed6cbba` 一致 | `7d825229` 中 MRV1 仍在准备输入时按有效 token 数构造 attention state | `baa023ad` 一致 |
| 只取最后一行、中间段丢弃采样 | 一致 | 一致 | 本页未单列重核此项（见表下核验范围） | 一致 |
| GLM 的 KDA 按行分 prefill、decode 两路 | 维护分支没有 GLM 代码；`db701c1f` 在 KDA 算子里分路 | 没有 GLM 代码 | 本文 GLM 的提示词长度、KDA 状态和显存演算继续采用固定旧镜像 `db701c1f`，非 `v0.30.0rc2` 实测数据 | 在 glm5next 的 KDA 层里，同样分两路 |

| 提示词记录 | v0.23 | v0.26 rc | main |
|---|---|---|---|
| 字段与数量 | 默认 None；0/正数/−1；受 max_logprobs 限制 | 相同 | 相同 |
| 对齐与聚合 | 首项无评分；hᵢ 评 xᵢ₊₁；分块聚合 | 相同 | 相同 |
| 模式 | 直接 log-softmax，忽略四模式选择 | raw_logits / processed_logits 返回未归一化的原始分数，其余返回原始对数概率 | 同 rc |
| 采样处理 | 不应用生成端的温度、罚分和截断 | 同；名字含 processed 也不加入这些处理 | 同 |
| HTTP 边界 | 显式流式正数/−1 被拒；0 放行但无独立 SSE 字段；echo 可派生 | 相同 | 相同 |
| 缓存与容器 | 默认派生跳过前缀读取；flat 默认 false | 相同 | 相同 |

Ascend 的 GLM db701c1f、社区维护 2c59ff10、rc 2ed6cbba 与 main baa023ad 均调用继承的提示词记录函数；实际行为还取决于所配套的上游版本，不能只看插件版本就承诺模式语义。固定 GLM 基线无论服务选哪种模式，提示词仍按原始对数概率路径计算；rc/main 中的 processed_logits 名字不意味着它应用了生成罚分。HTTP 的提示词数值处理仅将负无穷换成 −9999，有限的更小值仍保留，与生成端的下界夹断不同。

### 源码位置

读源码可以从 EngineCore 的一步看起：先调度，再把计划交给 worker 执行，最后按结果更新请求；然后进 runner，看它怎样贴标签、选出用来算分数的隐藏行。这些接口给出的是执行结构，真实的首 token 延迟和吞吐要另做测量。

| 看什么 | 位置 |
|---|---|
| EngineCore 的一步 | `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472` |
| 调度器不分阶段的注释 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351` |
| running 请求本步数量 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L400-L416` |
| waiting 请求的切分，关分块时停止接纳 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L680-L700` |
| 分块默认值与单条上限 | `vllm@0fc695fc:vllm/config/scheduler.py#L70-L84` |
| 关分块时的启动校验 | `vllm@0fc695fc:vllm/config/scheduler.py#L259-L271` |
| 提示词长度校验 | `vllm@0fc695fc:vllm/v1/engine/input_processor.py#L395-L432` |
| 注意力状态标签 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L838-L856`；`#L1444-L1471`；`vllm_ascend/attention/attention_v1.py#L147-L152` |
| 能否回放 decode 图 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941`；`vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L306-L327` |
| KDA 按行分两路 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L590-L644` |
| 取哪几行算分数 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1307`；`#L2326-L2327` |
| 中间段丢弃采样 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099`；`#L2632-L2686` |
| prompt logprobs | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2738-L2742` |
| 三版的调度注释 | `vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L428-L436`；`vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L566-L574` |
| main 的分块选项 | `vllm@84030bbe:vllm/config/scheduler.py#L70-L72` |
| 三版的标签判断 | `vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1505`；`vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1355`；`vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1662-L1690` |
| main 的 KDA 分路 | `vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L434-L515` |

**正文证据归档。** 45 层主干与 154880 的词表取自模型配置 [S1]；每步 8192 个位置、32 条请求、MTP 草拟 3 个取自官方教程 [S2]。调度器不分阶段与进度差规则见注释和 running 分支 [C3][C4]，新请求的切分与关分块时停止接纳见 waiting 分支 [C5]。SchedulerConfig 的分块字段静态兜底是 True，但实际启动在未显式设置时按模型能力推导；v0.23、v0.26、main 的解析见来源 51–53，rc2 见来源 49，本部署按模型支持条件开启。单条上限默认 0，只有同时切分多条时才会被自动设值 [C6]，本部署不另设上限 [D]。关分块时的启动报错 [C7]、提示词长度报错 [C8] 的数值按本部署参数代入 [D]。

注意力状态标签的判断顺序与「含不含 prefill」[C10][C9]，标签枚举 [C11]；开了投机解码时要求提示词都算完才当 decode 批 [C12]，不整齐的批找不到图键就不用图 [C13]。R1 两步都是 4 个位置、场景 M 第 2 步贴 ChunkedPrefill，是把这些分支代入示例得到的 [D]。KDA 按行分两路 [C14]；只取最后一行与按行取隐藏向量 [C15][C16]；中间段的丢弃与随机数回拨 [C17][C18]；prompt logprobs [C19]。三版对照见 [C21][C22][C23][C26][C27]。

decode 最少 50 步、最多 199 步是按每步产出 1 到 4 个 token 推出的范围 [D]。「prefill 多受算力限制、decode 多受访存和固定开销限制」以及调大、调小每步预算的影响方向，是按步子形状和调度规则推出的倾向 [I]；TTFT 的构成是按请求路径列出的 [I]。

提示词记录证据：来源 30–32 给类型、缓存默认派生和上限；33–35 给三版按隐藏行与目标编号错位取值、模式差异及分块聚合；36–37 给 CPU 记录容器与首项。38–43 对照两种 HTTP 的响应位置、echo 派生、显式流式校验及返回 schema；44 给提示词负无穷替换，45 给缓存读取门槛，既有 19 和新增 46–48 给四个 Ascend 快照的继承调用。评分例中的 0.233 与 −1.457 是采样页六词分布的近似换算，不是硬件测量。

调度进度和每步预算决定一个提示词要分几轮；关闭分块时还有预算与长度校验，generate 入口也必须为至少一个输出位置留下容量（来源 3–5、7–8）。因此，6000 个位置一次处理的示意不能套到任意请求，R1 单次前向的 218 次通信也不等于任意长提示词的总账；总次数取决于轮数和执行路径。

attn_state 的判断先看整批是否从零开始，再看每条是否只安排一个位置；后一分支可能记为 DecodeOnly，遇到 MTP 则改记 SpecDecoding。投机图调度还会另行区分单位置提示词尾块和已完成提示词的请求。因此执行状态名不能代替请求进度检查；分支位置见来源 10、12、24–26。

前缀身份条件依据已核的来源 29：`generate_block_hash_extra_keys` 汇入 LoRA、多模态、cache salt 和直接输入 embedding 的身份信息，`hash_block_tokens` 再组合前块指纹、本块 token 编号与附加信息。因此，仅有相同的显示文本不足以保证复用；这些源码条件不改变本页固定部署默认关闭 prefix caching 的前提，也不构成本部署的缓存命中率测量。

**待核。**

- 缺本部署的实测：TTFT、场景 M 那种混合步的实际耗时、同批 decode 请求的输出间隔，以及每步预算取不同值时这几项怎样变化。
- 缺 MTP 的真实接受率，因此只能给出 decode 步数的范围，给不出典型值；需要本部署的 benchmark 输出里的投机解码统计。
