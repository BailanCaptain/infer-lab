---
id: prefill
title: "Prefill 与 Decode：提示词怎样一步算完，回答怎样接着往下写"
type: concept
summary: Prefill 是一条请求的第一步，把提示词里已知的全部位置一次送进模型，为每个位置留下历史，并用最后一个位置选出回答的第一个 token；之后每一步是 decode，在已有历史上接着往后写。两者用同一套权重，区别在送进来的是什么、有没有历史可读、调度与执行分支怎样走。
aliases: [Prefill, Decode, 预填充, 解码, 首 token 阶段, prompt 阶段, prefill 阶段, P 阶段, D 阶段, TTFT, TPOT, 首 token 延迟]
chapters: ["05"]
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L400-L416
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L680-L700
  - vllm@0fc695fc:vllm/config/scheduler.py#L70-L84
  - vllm@0fc695fc:vllm/config/scheduler.py#L259-L271
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L395-L432
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L838-L856
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1471
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L147-L152
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L306-L327
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L590-L644
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1307
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2326-L2327
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2632-L2686
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2738-L2742
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L428-L436
  - vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L566-L574
  - vllm@84030bbe:vllm/config/scheduler.py#L70-L72
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1505
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1355
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1662-L1690
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L434-L515
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: one-request, kind: builds-on, note: R1 的 prefill 与 decode 两圈、每卡形状、块号和通信都只在那一页推导，本页只引结论 }
  - { to: attention-qkv, kind: builds-on, note: 因果掩码决定一次送进去的多个位置各能看到哪些历史 }
  - { to: glm-5-3-flash-two-node, kind: builds-on, note: 每步 8192 个位置、32 条请求、MTP 3 个候选等部署取值的出处 }
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 回答的第一个字出来之前，模型在算什么？

**prefill（预填充）是一条请求的第一步：把整段提示词一次送进模型算完，给提示词里每个 token 留下后面还要读的中间结果，并用最后一个 token 的输出选出回答的第一个 token。之后的每一步叫 decode（解码）：只送进上一步刚选出的那个 token，在已经留下的结果上接着往后写。**

先说清两个词。token 是分词器（把文字切成小段的程序）切出的最小单位，一段提示词被切成若干个 token，每个 token 占一个**位置**。**历史**是模型为每个已经算过的位置留在显存里的中间结果，后面的位置要反复读它。模型每一层都有一步 [attention](attention-qkv.md)（注意力：每个位置按相关程度去读自己和前面各位置的信息），普通模型为此给每个位置存下 K、V 两个向量，供后面的位置来查、来读，这份存储叫 [KV cache](kv-cache.md)；GLM 有两类层：一类按位置往后追加这类历史，另一类每条请求只存一份固定大小的状态、原地更新，两类各是哪些层到 GLM 一节再点名。下文把两类统称为历史。

```wiki-diagram
file: prefill
```

图按时间从左往右走，画的是最普通的情况：不分块、不复用别的请求的开头、不猜候选。

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
逐个喂，每片权重从显存读进来 = 6000 遍
> 按每步读一遍算；算子下发、卡间交换也各是 6000 遍
合成一步 prefill，每片权重从显存读进来 = 1 遍
> 算子下发、卡间交换也各只要 1 遍
之后的 decode = 200 − 1 = 199 步
> 每步只送进上一步选出的 1 个 token
prefill 一步 ÷ decode 一步 = 6000 ÷ 1 = 6000 倍
> 按一步送进的位置数比
```

所以合成一步省的不是计算量：6000 个位置该做的乘加一份也没少，attention 里每个位置该读的前文也一样多。省下的是按步付的那几笔：权重读进来的遍数、算子下发的遍数、卡间交换的遍数，都从 6000 遍变成 1 遍。

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

decode 的处境正好相反。每步只有几个新位置，矩阵很小，但所有层和每步的固定开销一次也省不了，一步只出 1 个 token 很不划算。常见的对策是把很多条请求攒进同一步，像上面那 12 条一样一起走；或者用 [speculative decoding](speculative-decoding.md)（投机解码：先用便宜的办法草拟几个候选 token，下一步由主模型一次验证，猜对几个就多出几个）。衡量 decode 的指标是 TPOT（time per output token，相邻两个输出 token 的间隔），它受同一步里有多少请求、有没有混进别人的 prefill 影响。

两种步子还卡在不同的地方。上面说合成一步省的是读权重的遍数，换个角度看：一片权重读进计算单元一遍以后，要和这一步送进来的每一行（一个位置一行）各做一遍乘加，行数越多，每读 1 字节权重配的运算越多。[矩阵乘页](matmul-and-weights.md#同一片权重为什么能处理多行输入)演过这个口径：权重每个数占 1 字节时，每字节配 2 × 行数 次运算；再拿它和设备自己的「每秒运算数 ÷ 每秒可读字节数」比，低于这个比值，乘加早早做完、在等权重送到，叫带宽受限；高于它，权重来得及、乘加做不完，叫算力受限。沿用那里的示意比值 100 次/B：

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

这里只算了权重的字节；行一多，输入和输出本身也要搬，真实比值会比表里低，要按真实形状去算（见矩阵乘页）。但真实模型的权重每片有几千乘几千个数，几千行的 prefill 仍远在设备比值之上，偏算力受限的方向不变。所以 prefill 容易形成大矩阵乘，常常受算力限制；decode 每步算得少，却要读权重和历史，更容易受访存和每步固定开销限制。这是按两种步子的形状推出来的倾向，具体卡在哪里还取决于批大小、模型结构、量化和设备，要实测才能定。

模型里有 [MoE](moe.md) 层（mixture of experts，混合专家：普通层里每个位置都要过同一段前馈计算，叫 MLP；MoE 层把它换成很多份并排的 MLP，叫专家，每个 token 只挑其中几个来算）时还要多想一步。decode 每步读的是这一步被选中的那些专家的权重：批小时只占全部专家的一小部分，批一大、token 一多，几乎每个专家都会被选中，读的也就接近全部。所以不能笼统地说 decode 每步都读全部专家，也不能说它总是只读一小部分。prefill 这头也不能把上面的 6000 行直接套到专家权重上：每个专家只分到路由给它的那些行。比如共 64 个专家、每个 token 挑 2 个（示意），6000 个 token 平均每个专家分到 6000 × 2 ÷ 64 ≈ 188 行，比整步的 6000 行少得多，但仍远多于 decode 的几行。

几个容易混的相邻概念：

| 概念 | 和 prefill 的关系 |
|---|---|
| decode | prefill 之后的每一步；普通路径每步送进 1 个新位置，开了 speculative decoding 时再加上待验证的几个候选 |
| chunked prefill | 同一条请求的 prefill 分几步做，只有最后一段产出首 token |
| prefix caching | 开头和之前请求相同的一段直接复用历史，prefill 只算剩下的，见 [prefix caching](prefix-caching.md) |
| PD 分离 | prefill 和 decode 放在不同执行组（各用一组卡），中间传历史，见 [PD 分离](pd-disaggregation.md) |

## 落到 GLM 双机：R1 的第一步怎样成了 prefill

下面跟着[一条请求](one-request.md)里的示例请求 **R1** 走。R1 的提示词套完聊天模板、分词后是 4 个 token，记作 p₀ p₁ p₂ p₃，也就是首屏图里的 x₀ 到 x₃；4 是为了把每张卡上的形状逐行写出来取的演示长度，真实请求套完模板至少十几个 token，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。

部署沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)：两台服务器、16 张卡，TP8、DP2、EP16，W8A8 量化，开 MTP，每步草拟 3 个候选。这几个缩写各说的是一种分工：

- **TP8**：[tensor parallel](tensor-parallel.md)（张量并行），一台机器里的 8 张卡合算同一层，每张卡只拿这一层权重的一片，算完再把各卡的部分结果合起来。
- **DP2**：[data parallel](data-parallel.md)（数据并行），两台机器各用自己的 8 张卡组成一组，各自接请求、各自调度，这样的一组叫一个 **DP 组**。R1 落在 DP0，也就是 node0 上那一组 8 张卡。
- **EP16**：[expert parallel](expert-parallel.md)（专家并行），MoE 层的专家分放到两台机器的 16 张卡上，每个 token 要到它选中的专家所在的卡上去算。
- **W8A8**：权重和激活都用 8 位整数存、算，见 [quantization](quantization.md)。
- **MTP**：Multi-Token Prediction，模型自带的草稿层，每步末尾先猜 3 个候选 token，下一步由主模型一次验证，是 speculative decoding 的一种。

首屏说 GLM 有两类层，这里点名：模型主体的 45 层里，34 层是 KDA（Kimi Delta Attention，一种 [linear attention](linear-attention.md)：每条请求只存一份固定大小的状态，每来一个位置就原地更新），11 层是稀疏 MLA（MLA 把 K、V 压成一条较短的向量，按位置往后追加着存；「稀疏」指每个 query 只挑一部分历史位置来读，挑哪些由一个便宜的打分网络 indexer（索引器）决定，见 [sparse attention](sparse-attention.md)）。

上一节那几笔账换成本部署的数是这样。每一步都要把模型的 45 层走一遍；卡与卡之间交换数据靠 [collective communication](collective-communication.md)（集合通信：一组卡一起参与的数据交换，比如 All-Reduce 把各卡的部分结果加起来，让每张卡都拿到总和），哪怕 R1 只有 4 个 token，它的一步也要让每张卡做 218 次，账见[一次前向的通信账](one-request.md#一次前向的通信账)。一条 6000 个 token 的提示词要是一个一个喂，这 45 层和 218 次通信要付 6000 遍；prefill 把 6000 个位置放进同一步，只付一遍。decode 这头同样省不掉 45 层和 218 次通信，本部署的对策是 MTP：decode 每步每条请求送进 1 个确定的 token 加 3 个候选，共 1 + 3 个位置。上一节表里那几个相邻概念，本部署默认开启 chunked prefill，默认关闭 prefix caching，也没有用 PD 分离；后两者只作变体了解。

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

请求要 prompt logprobs（返回提示词每个位置的概率）时，runner 会另拿提示词各位置的隐藏向量去算分数，这是普通生成路径之外的额外计算。

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

### 会报什么错

- **提示词比长度上限长**：输入处理阶段直接拒绝，报 `The decoder prompt (length …) is longer than the maximum model length of …`；本部署上限是 133120。提示词正好等于上限也会被拒，因为至少还要生成 1 个 token。
- **空提示词**：报 `The decoder prompt cannot be empty`。
- **变体：关掉 chunked prefill**：按本部署的其他参数，启动时报 `max_num_batched_tokens (8192) is smaller than max_model_len (133120)`，因为不分块时一条序列最长只能是一步的预算。
- prefill 本身没有专门的运行时报错。分块中间段的采样被丢弃是正常行为，不是错误。

### 开销和什么时候别开

prefill 关不掉，能调的是每步多宽：

- 调大每步预算，长提示词分的段更少、首 token 更早，但混合步更宽，同一步里 decode 请求的输出间隔更长；调小则反过来。
- 混进 prefill 的步走 eager、MoE 改走 AllGather，代价账见[并发页](concurrent-requests.md)；只有纯 decode 步才能回放图。
- 想让长提示词完全不拖累 decode，需要把两个阶段放到不同执行组，也就是 [PD 分离](pd-disaggregation.md)；本部署没有用。

### 版本差异

| 内容 | v0.23 | v0.26 | main |
|---|---|---|---|
| 调度器「不分阶段」的注释与进度差规则 | 有（vLLM `0fc695fc`） | 同（vLLM `568afb3a`） | 同（vLLM `84030bbe`） |
| chunked prefill 默认开、单条长提示词上限默认 0 | 是 | 是 | 是；另外去掉了「同时切分几条提示词」那组选项 |
| runner 注意力状态标签的判断顺序 | 维护分支 `2c59ff10` 与含 GLM 的 `db701c1f` 一致 | `2ed6cbba` 一致 | `baa023ad` 一致 |
| 只取最后一行、中间段丢弃采样 | 一致 | 一致 | 一致 |
| GLM 的 KDA 按行分 prefill、decode 两路 | 维护分支没有 GLM 代码；`db701c1f` 在 KDA 算子里分路 | 没有 GLM 代码 | 在 glm5next 的 KDA 层里，同样分两路 |

本页 KDA 层与 GLM 草稿层相关的执行细节只适用于含 GLM 代码的 `db701c1f` 和 main；调度规则与 runner 的通用分支三版一致。

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

**正文证据归档。** 45 层主干与 154880 的词表取自模型配置 [S1]；每步 8192 个位置、32 条请求、MTP 草拟 3 个取自官方教程 [S2]。调度器不分阶段与进度差规则见注释和 running 分支 [C3][C4]，新请求的切分与关分块时停止接纳见 waiting 分支 [C5]；分块默认开、单条上限默认 0 且只有同时切分多条时才会被自动设值 [C6]，所以本部署不另设上限 [D]。关分块时的启动报错 [C7]、提示词长度报错 [C8] 的数值按本部署参数代入 [D]。

注意力状态标签的判断顺序与「含不含 prefill」[C10][C9]，标签枚举 [C11]；开了投机解码时要求提示词都算完才当 decode 批 [C12]，不整齐的批找不到图键就不用图 [C13]。R1 两步都是 4 个位置、场景 M 第 2 步贴 ChunkedPrefill，是把这些分支代入示例得到的 [D]。KDA 按行分两路 [C14]；只取最后一行与按行取隐藏向量 [C15][C16]；中间段的丢弃与随机数回拨 [C17][C18]；prompt logprobs [C19]。三版对照见 [C21][C22][C23][C26][C27]。

decode 最少 50 步、最多 199 步是按每步产出 1 到 4 个 token 推出的范围 [D]。「prefill 多受算力限制、decode 多受访存和固定开销限制」以及调大、调小每步预算的影响方向，是按步子形状和调度规则推出的倾向 [I]；TTFT 的构成是按请求路径列出的 [I]。

**待核。**

- 缺本部署的实测：TTFT、场景 M 那种混合步的实际耗时、同批 decode 请求的输出间隔，以及每步预算取不同值时这几项怎样变化。
- 缺 MTP 的真实接受率，因此只能给出 decode 步数的范围，给不出典型值；需要本部署的 benchmark 输出里的投机解码统计。
