---
id: prepare-inputs-flow
title: 准备输入：把一步的请求计划拼成模型能吃的几张表
type: concept
summary: >-
  调度器每步只说「哪些请求、各算几个 token、新借了哪些块」；worker 里的 model runner 把这些 token 首尾相接排成一排，逐个
  token 配上 token id、位置和 KV
  槽位，再按请求记下边界、长度和选行，按缓存组组装成注意力元数据交给各层后端。批次行号、位置、槽位是三套不同的编号。
aliases:
  - prepare_inputs
  - _prepare_inputs
  - 输入准备
  - 准备输入
  - input_ids
  - positions
  - query_start_loc
  - seq_lens
  - slot_mapping
  - attn_state
  - 持久批次
  - persistent batch
  - 注意力元数据
  - attention metadata
chapters:
  - 09
order: 30
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L814-L868'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L945-L962'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1018-L1042'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1075-L1099'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1228-L1254'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1263-L1314'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1470'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1492-L1520'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L765-L813'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2014-L2064'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2327'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3141-L3170'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3254-L3280'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5101-L5125'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L283-L324'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L154-L185'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L284-L288'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1180'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1436-L1447'
  - 'vllm@0fc695fc:vllm/v1/attention/backends/utils.py#L606-L640'
  - 'vllm@0fc695fc:vllm/v1/attention/backend.py#L557-L581'
  - 'vllm@0fc695fc:vllm/v1/worker/block_table.py#L141-L164'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L318'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L5-L20
  - >-
    vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L24-L64
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L862-L885'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L890-L913'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1228-L1251'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3379-L3548'
  - 'vllm@0fc695fc:vllm/v1/attention/backends/gdn_attn.py#L104-L111'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/gdn_attn_builder.py#L283-L302'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1700-L1775'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L957-L997'
  - >-
    raw:sha256-e4f12a5796104845dfab8da750fe0d133bc33ed94c5605efb19d30b92df51244.md#L1-L1129
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L1281-L1343'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L30
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1282-L1382'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L1708-L1735'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L1635-L1645'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L405-L415'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L1435-L1447'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L63'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L488-L508'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1648'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1279-L1340'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1633-L1645'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1706-L1735'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1141-L1168'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/input_batch.py#L29-L90'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L65'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 调度器决定每步算哪些请求、各几个 token、借哪些块；本页从它交出的计划接着往下翻译
  - to: block-table
    kind: builds-on
    note: 位置怎样经块表换成槽位、GLM 的 5 张块表各怎样用，推导在块表页
  - to: attention-backend-family
    kind: builds-on
    note: 注意力元数据交给哪个后端、层怎样按后端和缓存规格分组
  - to: concurrent-requests
    kind: builds-on
    note: 13 条请求拼成 6048 行，以及补到图尺寸、两组对齐的账
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-53d3e72f2725fd66b66b7a4746cd771ba74b46fb5c5e86fa5678e6b07d42a7f8.md
  - >-
    raw/sha256-e4f12a5796104845dfab8da750fe0d133bc33ed94c5605efb19d30b92df51244.md
---

## 调度器只说「算谁、各算几个」，模型要的却是几张对齐的表：中间谁来翻译？

**准备输入（prepare inputs）是每一步前向之前的翻译工作：把调度器这一步安排的所有 token 首尾相接排成一排，给每个 token 写明它是哪个词、在自己请求里排第几、算出的 KV 存进缓存池哪一格，再另记几张短表，标出每条请求占这一排的哪几列。** 模型只收这几张表，不认识「请求」。

先把几个词说清楚。[调度器](vllm-scheduler.md)每一步决定这一步算哪些请求、每条算几个 token，并替需要新空间的请求借好 KV cache 的块（怎么借见 [KV 块分配](vllm-kv-block-allocation.md)），交出一份计划。**worker** 是每张卡上执行前向的进程；它里面的 **model runner** 负责把计划翻译成张量、调用模型、交出采样结果，准备输入就是它的活。[KV cache](kv-cache.md) 是每一层为算过的位置留下的状态，存在一个按块切好的缓存池里；[block table](block-table.md)（块表）记着每条请求的第几个块落在池里哪一块。

把请求拼起来可以一起做矩阵计算，代价是每一步都要重新配齐这些身份表，并将需要的输入送到设备；前向必须等它们准备好。几张表的长度相同还不够，行与请求的对应也必须一致，否则会读写别人的历史。

看一个小例子（数字是示意，一轮就是一步）。A 是一条提示词 4 个 token 的请求，已经跑了两轮：第一轮算完提示词的位置 0–3，生成了 a₄；第二轮算位置 4，生成了 a₅。现在是第三轮，A 已经算过 5 个位置，这一轮只算 a₅ 这 1 个 token；C 是刚进来的新请求，提示词 3 个 token，这一轮全算。调度器这一轮的计划只有这么几句：A 算 1 个，C 算 3 个，C 新借到块 9。准备输入要把它变成下图中间那张表：

```wiki-diagram
file: prepare-inputs-flow
```

读图时竖着看一列，一列就是一个要算的 token。第 0 列属于 A，是 A 上一轮生成的 a₅，它在 A 里的位置是 5（从 0 数起），KV 要写进池里第 9 格（这个 9 是格子号，和 C 新借到的块 9 不是一回事）；第 1–3 列属于 C，是提示词 c₀、c₁、c₂，位置 0、1、2，写进第 36、37、38 格。四列从左到右连起来，就是这一步送进模型的一排；在张量里它们是一行叠一行的，所以列号叫**批次行号**。

下面三张短表按请求记，不按 token 记：**边界** [0, 1, 4] 说 A 占第 0 行、C 占第 1 到 3 行；**长度** [6, 3] 说这一步算完以后，A 一共有 6 个位置的历史，C 有 3 个；**选行** [0, 3] 说只有第 0 行和第 3 行的输出要拿去预测下一个 token。右边是这些表的去处：token id 和位置送进模型，边界、长度连同块表和槽位交给注意力，选行交给输出头。

同一个 token 身上有三个编号，千万别混：

- **批次行号**：它在这一步拼好的一排里排第几。每一步都重新排。
- **位置**：它在自己那条请求里排第几。一条请求从 0 往后数，跨步累加。
- **槽位**（slot）：它的 KV 写进缓存池的第几格。由位置经块表换算出来。

A 的那个 token 行号 0、位置 5、槽位 9；C 的第一个 token 行号 1、位置 0、槽位 36。三个数各不相同，谁也不能拿来代替谁。

## 为什么要拼成一排再配表？代价在哪？

**因为把多行输入合成矩阵，能增加权重复用的机会，并摊薄调用开销。** 一层里的线性层，是把「若干行 × 隐藏维」的输入乘上同一份权重。4 个 token 一起乘，共用同一张权重；逐条调用则重复组织小矩阵计算。理想情况下，并批可复用已读取的权重；实际 HBM 读量和速度取决于缓存、内核分块与输入形状，不能仅凭 4 行就认定只读一遍。

一起算有两种排法。一种是每条请求占一行、按最长的补齐：A 只有 1 个 token 也要补到 3 个，一共 2 × 3 = 6 格，其中 2 格白算；请求越参差，白算的越多：一条在 decode（在已有历史上往后生成，一步通常只算 1 个 token），另一条在 prefill（处理提示词，本轮可能安排几千个位置），decode 那一行就要补上几千个空格。vLLM 在这里用另一种排法：所有 token 首尾相接，4 个 token 就是 4 行，不为逐请求等长而补齐；后面的图尺寸、并行通信仍可能要求另行补齐。

排成一排的代价，是 token 丢了身份：光看第 2 行，模型不知道它属于谁、在自己请求里排第几、KV 该往哪写。准备输入配的那几张表，就是把身份补回来，每张回答一个问题：

| 表 | 回答什么 | 谁用它 |
|---|---|---|
| token id | 这一行是词表里的哪个词 | 嵌入层据此取出这个词的向量 |
| 位置 | 它在自己请求里排第几 | 位置编码（[RoPE](rope.md)） |
| 边界与长度 | 哪几行属于同一条请求，各有多长的历史 | 注意力只在本请求的历史里读 |
| 槽位 | 新算出的 KV 写进池里哪一格 | 写 KV cache 的那一步 |

选行不在表里，因为它不影响前向本身：前向算完所有行，只有选中的行再去乘词表、预测下一个 token，其余行的用处是留下 KV。

代价有三处。

**第一，每一步都要做，而且挡在前向前面。** 这几张表每一步都不一样，前向要等它们备好才能开始。所以 model runner 尽量只动变化的部分：它在两步之间保留一份**持久批次**（persistent batch），记着哪些请求在跑、各坐第几行、各自的全部 token 和块表，每步只增删改有变化的请求；块表的拷贝也最先发起，和其余准备同时进行。

异步调度能把 CPU 准备和上一步设备计算重叠起来，却不保证完全省掉从 CPU 到设备的输入拷贝。当存在上一轮采样结果可复用时，runner 会先识别本轮仍与上一轮位置衔接的请求，分别数出可复用的采样 token 数与这些请求本轮安排的投机候选（提前猜出、留待本轮验证的 token）数；从本轮总输入数扣掉这些投机候选后，如果剩余数量仍大于可复用的采样 token 数，就会先把本轮 CPU 输入复制到设备。因此不能只凭「开了异步调度」就断定零拷贝，也不能拿未扣减候选的本轮总数代替这项判断。

**第二，几张表必须对着同一套行号。** 每张表各自形状都对，也不能说明它们对得上。只要其中一张还按旧的行序写，A 的 token 就会带上 C 的位置、写进 C 的槽位、读到 C 的历史。这种错不报异常，只表现为输出变怪。排查时要把同一步的请求 ID、本步 token 数、已算长度、位置、边界、块表和选行放在一起对。

**第三，补出来的行要标清楚。** 为了能回放预先录好的计算图（[graph mode](acl-graph.md)），一步的行数有时要补到固定尺寸。补的行不是真请求，要靠边界、有效 token 数和槽位里的填充值把它们排除在外，后面细讲。

## A/C 第三轮如何拼接？

这一节把上图那四列一格一格填出来。填表的原料有两份：调度器这一步的计划（每条请求本步几个 token），和持久批次里记着的东西（每条请求已经算了几个位置、全部 token、块表）。设 A 坐持久批次的第 0 行，C 坐第 1 行；持久批次用一张二维表存每条请求的全部 token，一条请求一行，每行留的格数等于最大长度，这里按 8 格示意，A 那一行存着 a₀ 到 a₅，C 那一行存着 c₀、c₁、c₂；块长按 4 个位置，A 的块表是 [7, 2]，C 的是 [9]。

$$\text{slot} = \text{block\_table}\!\left[r,\; \lfloor p / 4 \rfloor\right] \times 4 + (p \bmod 4), \qquad \text{token\_idx} = r \times 8 + p$$

| 推导字段（示意：本步 token 数 `[1, 3]`，行宽 8，块长 4） | 计算规则 | 本步结果 |
|---|---|---|
| 每行属于谁（持久批次行号） | A 重复 1 次，C 重复 3 次 | `[0, 1, 1, 1]` |
| 组内序号 | 每条请求从 0 递增 | `[0, 0, 1, 2]` |
| 位置（`positions`） | 已算数 `[5, 0]` + 组内序号：`[5+0, 0+0, 0+1, 0+2]` | `[5, 0, 1, 2]` |
| token 表下标 / `input_ids` | `行号 × 8 + 位置 = [5, 8, 9, 10]` | `[a₅, c₀, c₁, c₂]` |
| 边界（`query_start_loc`） | 前缀和 `[0, 0+1, 0+1+3]` | `[0, 1, 4]` |
| 长度（`seq_lens`） | 已算数 + 本步 token 数 `[5+1, 0+3]` | `[6, 3]` |
| 块序号 / 块号 | $\lfloor p / 4 \rfloor = [1, 0, 0, 0]$；查 A 表 `[7, 2]`、C 表 `[9]` | 块号 `[2, 9, 9, 9]` |
| 槽位（`slot_mapping`） | `[2×4+1, 9×4+0, 9×4+1, 9×4+2]` | `[9, 36, 37, 38]` |
| 选行（`logits_indices`） | 每段末尾 `[1-1, 4-1]` | `[0, 3]` |

逐行对着看：

1. **每行属于谁。** 把每条请求在持久批次里的行号，按它本步的 token 数重复，得到一张和这一排一样长的表。后面几张按 token 的表，都靠它回头查「这一行的请求已经算到哪、token 存在哪」。
2. **位置。** 已算数是持久批次记的进度，A 是 5，C 是 0；再加上它在本步这一组里排第几。A 这一步的 token 接在 5 个旧位置后面，所以是位置 5；C 从 0 数起。位置送进模型给位置编码用；注意力能看到哪些历史，由后面的边界和长度算出，等于只看同一请求里位置不超过自己的那些。
3. **token id。** 把存 token 的二维表压成一维，第 r 行第 p 个 token 的下标就是 r × 行宽 + p。按这 4 个下标一次抓出来，就是送进模型的 `input_ids`。a₅ 是 A 上一步采样出来、已经追加进它那一行的 token。
4. **边界**（`query_start_loc`）。把每条请求本步的 token 数依次累加，前面补一个 0，所以它比请求数多 1 个数：第 k 条请求占第 [边界 k, 边界 k+1) 行。A 占 [0, 1)，C 占 [1, 4)，最后一个 4 是总行数。
5. **长度**（`seq_lens`）。已算数加本步 token 数，是这一步算完以后每条请求一共有几个位置。注意力靠它知道各请求的历史有多长：A 的新 token 要看全部 6 个位置，C 的 3 个 token 各看自己和自己前面的。
6. **槽位**（`slot_mapping`）。位置除以块长，商是这条请求的第几个块，拿去查块表得到块号；余数是块内第几格。A 的位置 5 除以 4 商 1 余 1，块表 [7, 2] 的第 1 格是块 2，槽位 2 × 4 + 1 = 9。C 的 3 个位置都在它的第 0 块（块 9）里。为什么要查表、表怎样随请求变化，见 [block table](block-table.md#表怎样随请求变化槽位每步怎样算)。
7. **选行**（`logits_indices`）。每条请求在这一排里的最后一行，就是边界里除开头那个 0 之外每个数减 1。只有这些行的输出要乘词表、预测下一个 token。

填完以后，模型实际收到两组东西。token id 和位置是**输入**，送进嵌入层和位置编码；边界、长度、块表、槽位，再加上本步的请求数、token 数、最长一段有几行，合起来叫**注意力元数据**（attention metadata），交给每一层的注意力，让它知道去哪读历史、往哪写新 KV、哪几行属于同一条请求。

拼在一起的只是这一步的新 token，历史仍然各归各的。线性层、MLP 这些逐行的计算，4 行一起乘同一份权重，谁也不碍谁；到了要读历史的注意力，A 那一行只在 A 的 6 个位置里读，C 的三行只在 C 的位置里读，靠的就是边界、长度和各自的块表。同样是位置 0，C 的位置 0 和别的请求的位置 0 落在池里不同的格子；同样坐第 0 行，也不表示要写槽位 0。

## 填表前后还有什么：持久批次、形态、元数据、选行与补齐

**准备输入夹在「同步持久批次」和「建注意力元数据」之间，三段合起来是一条请求在主线里的[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。** 下图是一步里 model runner 的先后顺序和岔路：

```wiki-diagram
file: prepare-inputs-code-flow
```

### 先同步持久批次：每步只改变了的那几行

拿到计划后，model runner 先把持久批次改成和这一步一致，顺序是：

1. 删掉已经结束的请求，再删掉这一步没排上的请求（比如被抢占的），空出它们的行；
2. 对继续跑的请求，更新已算数，把调度器新借的块号追加到它那一行块表的末尾；从抢占中恢复的请求则用本次下发的块号替换旧块号，再重新进入持久批次；
3. 把新请求和被抢占后恢复的请求放进空行，号小的空行先填；
4. 把中间的空行压紧，最后一行整行搬进空位；
5. 如果注意力后端（每一层真正去调注意力算子的那层代码）声明了一个 decode 阈值，就按阈值重排：本步 token 数不超过阈值、已经在 decode 的请求排最前面，本步从位置 0 开始的新请求排最后，还在分段算提示词的排中间。

所以**一条请求坐第几行不是终身的**：别的请求结束、新请求加入、重排，都会让它换行。按请求找结果要靠持久批次里「请求 ID → 行号」的对照表，不能把行号记死。如果这一步的计划里一个 token 都没有，就不进入本页这套常规输入准备；按配置仍可能先做 DP 陪跑或 KV 传输协作，再返回相应结果。

这描述的是本页固定的 V1 runner。新版上游把请求的长期存储行与本步计算顺序进一步分开：用索引把本步需要的行取出来，避免为了每一步排列而搬动整份状态。固定行、异步快照与增量写入怎样配合，见 [Model Runner V2 专页](model-runner-v2.md) 与 [NPU Model Runner 中的 V2 状态组织](npu-model-runner.md#model-runner-v2-为什么要重新组织状态)。

### 再给这一步贴一个形态标签

准备输入一开头，model runner 还要判断这一步属于哪种形态（`attn_state`），注意力后端据此挑算子路径。判断里会用到投机解码：先草拟几个候选 token（叫草稿 token），下一步把它们和正常的那个 token 一起送进模型，一次验证。按顺序判断，先命中先算：

- 这一批的请求都还没算过任何位置：纯 prefill，没有历史可读（PrefillNoCache）；
- 每条请求本步都只有 1 个 token：纯 decode（DecodeOnly；投机方法是 MTP 时记成 SpecDecoding，MTP 是 GLM 用的投机方法，后面细讲）；
- 每条请求去掉草稿 token 后都只剩 1 个：投机验证（SpecDecoding；投机方法不是 MTP 时，交给后端的元数据里改记成 ChunkedPrefill）；
- 其余情况：开了 [chunked prefill](chunked-prefill.md)（长提示词切成几段、分几步算）时是混合批（ChunkedPrefill），没开时是带历史的 prefill（PrefillCacheHit）。

这些名字是执行形态标签，不足以单独判断请求阶段。例如带历史的一枚提示词尾块也可能满足“本步 1 个 token”；它仍在完成提示词，不能仅凭 DecodeOnly 名称认定请求早已进入生成阶段，见 [prefill](prefill.md)。

A、C 那一步里 A 有历史、C 本步 3 个 token，前三条都不满足，落在最后一条。

### 位置怎样找到缓存写入处

槽位就按上一节第 6 条那三步算：位置除以块长，商拿去查块表得块号，槽位 = 块号 × 块长 + 余数。一个模型的层按 KV 布局分成几个**缓存组**，每组一张块表，所以槽位按组各算一份；只存一份固定大小状态、不按位置追加的线性注意力组（比如 GLM 的 KDA）不算槽位。槽位在 NPU 上怎样并行算、补齐的尾部填什么、读历史时为什么改用整行块表，都在 [block table](block-table.md#表怎样随请求变化槽位每步怎样算)。

### 注意力元数据：一份底稿，按缓存组换上各自的块表和槽位

边界、长度、请求数、token 数这些全局批次信息对所有层都一样，model runner 会先做一份公共底稿（`AscendCommonAttentionMetadata`）。但一个模型的各层不一定共用一套 KV 布局：不同布局的层分在不同的**缓存组**里，每组持有各自的块表与槽位（怎么分组见 [KV cache 规格](kv-cache-spec.md)）。于是 model runner 对每个缓存组复制一份底稿，换上这一组的块表和槽位，再交给组内每类注意力后端的元数据构建器，整理成对应算子要求的张量格式。

下面这张全景图把整段 Host → Device 打包流水串起来：从 CPU 持久批次与 Pinned Buffer 出发，首行非阻塞发起块表 H2D 拷贝，经 NPU 槽位核写入 `slot_mapping`（补齐行填 `-1`），最终按缓存组拆出「补假请求的稀疏 MLA / 常规边界」与「不含假请求的 KDA / GDN 专用边界」，底部同时标出 `v0.30.0` MRV1 与 `main` MRV2 常驻缓冲的演进分野。后端怎样按层挑选、层怎样按后端归拢成组，见[注意力后端](attention-backend-family.md#runner-怎样把层归拢成组)。

```wiki-diagram
file: prepare-inputs-flow-fig-h2d-packing
```

### 哪几行送去输出头

普通一步里，每条请求只取最后一行，A、C 的例子是 [0, 3]。有两种情形不一样。

**提示词只算了一段。** 如果 C 的提示词其实有 10 个 token，这一步按 chunked prefill 只排了前 3 个，那么第 3 行只是提示词中间的一个位置，拿它预测出来的「下一个 token」没有意义。model runner 照样让这一行走完采样，但会把 C 记进丢弃名单：本步算完后的长度 3 小于 C 已有的 token 数 10，这一步给 C 采出来的结果不交出去。

**投机验证。** 一步里带着草稿 token 的请求（先猜几个 token，再一次验证），每个草稿都要检查，所以要取这条请求最后「1 + 草稿数」行。比如一条请求本步 4 行、带 3 个草稿，4 行全选；同一步里没有草稿的请求仍只选最后一行。投机解码本身见[投机解码](speculative-decoding.md)。

### 补齐的行不是新请求

行数有时会被补大：用图模式时，一步的 token 数要补到最近的一个预先录好的尺寸；两个 DP 组还要把各自的行数对齐。补多少、为什么这样补，见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。补出来的行在几张表里这样处理：

- 槽位填 −1，表示这一行没有要写的格子；
- 长度填 0；
- 边界：有的算子要求边界的最后一个数等于张量的总行数，这时在末尾补一段或几段「假请求」，把补出来的行包进去；
- 线性注意力（比如 GLM 的 KDA）的后端要的是不含假请求的边界，model runner 为它另留一份，补的位置只重复最后一个真边界。

所以数请求要看真实请求数，数 token 要看有效 token 数，都不能直接看张量的第一维。

## 放到 GLM 双机：R1 这一步，每张卡拼出什么？

部署是官方双机：2 台 Atlas 800 A2，每台 8 张卡，TP8、DP2、EP16，W8A8，详见[部署前提](glm-5-3-flash-two-node.md#部署前提)。模型是 GLM-5.3-Flash（下文简称 GLM）。R1 是全库一路跟踪的[示例请求](one-request.md#示例请求-r1-与官方双机部署)，提示词只有 4 个 token（教学设定），落在 DP0，也就是第一台机器。

**8 个 worker 各拼一份一模一样的输入。** TP8 下这 8 张卡算的是同一批 token，只是各持 1/8 的矩阵，所以输入必须完全相同。DP0 的引擎把同一份计划经一块共享内存的广播队列一次发给 8 个 worker，每个 worker 自己把上面的流程走一遍；算完只有其中一个把结果交回引擎。R1 第一步每张卡拼出 4 行、位置 0 到 3、边界 [0, 4]，已列在[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。本页流程里另外几样按同样的规则算出来，和第二步放在一起看：

| 步骤（示例请求 R1） | 长度 `seq_lens` | 选行 `logits_indices` | 形态 `attn_state` 与判据 |
|---|---|---|---|
| **第一步（prefill）** | $0 + 4 = \mathbf{4}$ | $[4 - 1] = \mathbf{[3]}$（无草稿，只取唯一段末行） | **`PrefillNoCache`**（本批请求均未算过任何位置） |
| **第二步（decode + 3 草稿）** | $4 + 4 = \mathbf{8}$ | $\mathbf{[0, 1, 2, 3]}$（$y_0$ 加 3 个草稿，$1+3$ 行全选） | **`SpecDecoding`**（4 个 token 去掉 3 个草稿剩 1 个） |

第一步带 prefill，拿不到只为 decode 录好的计算图，按 eager 方式逐个下发算子。第二步送进来的 4 行，是第一步确定下来的 y₀ 加上 MTP（多 token 预测，每步草拟 3 个候选 token 的草稿层）接着猜的 3 个候选，位置 4 到 7，逐项见[第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。4 行都要拿去验证，所以全选。GLM 双机会自动打开[异步调度](async-scheduling.md)（调度器不等上一步的结果回到 CPU，就先排下一步），所以这一步 y₀ 和 3 个草稿的 token id 不从 CPU 上的 token 表里抓，而是从上一步留在 NPU 上的输出直接拷进输入；长度也先按「上一步的草稿全被接受」乐观地算，需要时再校正。

**槽位要算三套，KDA 不算槽位。** GLM 的各类层分进 5 个缓存组，worker 里就有 5 张块表；R1 第一步借到的块号按组写进这 5 张表，块数怎样算见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。model runner 对每个要算槽位的组各算一份：

- 稀疏 MLA 的主缓存（MLA：多头潜在注意力，每个位置存一份压缩后的历史）和 indexer K（indexer 是给历史位置打分、挑出 MLA 要读哪些位置的模块，它每 4 个位置压出一条 K 存起来）同在 full 组。这一组分配时一块 640 个位置，算子却按 128 个位置一块读，所以块表里一个块号展开成 5 个；indexer K 还要把表和槽位折回 640 的块再换算。
- indexer 尾状态组（还没凑满 4 个位置的那几个先放在这里）一块 4 个位置，直接用本组算出的槽位。
- 3 个 KDA 组不算槽位。KDA（Kimi Delta Attention，一种线性注意力）每条请求只存一份固定大小的状态，块号直接当状态页的编号。

所以要算三套槽位：MLA 主缓存和 indexer 尾状态每个位置各写一格；indexer K 只在凑满 4 个位置时写一条，其余位置的槽位是 −1。三套槽位怎样换算、各用在哪一层，推导在 [block table 的 GLM 一节](block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)。

**两类后端拿到的边界不一样。** GLM 主干 45 层里 34 层是 KDA、11 层是稀疏 MLA，编号 45 的 MTP 层也是稀疏 MLA；两类层报出不同的后端（见[注意力后端](attention-backend-family.md#放到-glm-双机一个-token-走过-45-层要问-45-次)）。稀疏 MLA 的算子要求边界的最后一个数等于补齐后的总行数，用的是补了假请求的那份边界；KDA 的后端用 model runner 另留的那份，不含假请求。

**重排阈值是 4。** GLM 开着 MTP，每步草拟 3 个候选。稀疏 MLA 的元数据构建器把 decode 阈值设为 1 + 3 = 4；KDA 的构建器按投机 token 数算，也是 4。两个阈值必须一样，不一样启动时就报错。于是多条请求混在一步里时，本步不超过 4 个 token 的 decode 请求排在前面，新请求排在最后。[场景 M](concurrent-requests.md#第-3-站-准备输入13-条请求拼成一个-6048-行的张量) 的那一步里，12 条 decode 请求各 4 个 token、1 条新请求 6000 个 token，拼成 6048 行，顺序正是 12 条 decode 在前、新请求在后；这 6048 行的位置和边界，以及补到图尺寸、两组对齐的账，都在那一页。

**DP1 在陪跑，不走这套流程。** DP1 没有请求，但 EP16 下 MoE 的通信要 16 张卡一起参与，所以在这里跟踪的 R1 前两步中，它让自己的 8 个 worker 各跑一次 4 个 token 的空批次（dummy batch），与活跃组对齐。空批次由 model runner 直接造好输入和元数据，不经过调度计划，也不走本页的同步持久批次和填表。

## 常见误解

- **「批次第 k 行就是位置 k，KV 也写进第 k 格。」** 三个编号各管各的：A 的那个 token 行号 0、位置 5、槽位 9。
- **「拼在一起算，请求之间就能互相看到。」** 拼的只是这一步的新 token；注意力按边界和长度只读本请求的历史，块表也是一条请求一行。
- **「位置就是 token id。」** token id 是词表里的编号，决定取哪一行嵌入；位置是它在请求里的序号，给位置编码用。同一个词可以出现在很多位置上。
- **「model runner 每步从头建一遍批次。」** 持久批次跨步保留，每步只删、改、加有变化的请求；持续运行的请求追加新块号，从抢占中恢复的请求替换旧块号。
- **「8 个 worker 分头准备不同请求的输入。」** TP8 的 8 张卡拿同一份计划、拼出同样的张量，差别只在各自持有的权重分片。
- **「每条请求最后一行的预测都会交给用户。」** 提示词只算了一段时，最后一行不是提示词的结尾，这一步的采样结果会被丢弃。
- **「张量的第一维就是这一步的 token 数。」** 补到图尺寸、两组对齐以后，第一维会比有效 token 数大；补的行槽位是 −1，也不算请求。
- **「几张表形状都对，映射就对。」** 形状对只说明长度一致；行号和请求的对应一旦错位，照样读写到别人的历史，而且不报错。

## 对照源码

### 怎么开

准备输入没有开关，每一步前向前都走。决定它怎样走的是这几样：

- **走哪个 model runner。** 昇腾的补丁让 `use_v2_model_runner` 只看环境变量 `VLLM_USE_V2_MODEL_RUNNER`，不设就是假，走 v1 的 `NPUModelRunner`（`vllm_ascend/worker/model_runner_v1.py`），本页讲的都是它。
- **投机配置。** 本步有没有草稿，决定选行走 `query_start_loc[1:] - 1` 还是 `_calc_spec_decode_metadata`；投机方法是不是 `mtp`，影响纯 decode 记成 DecodeOnly 还是 SpecDecoding；投机 token 数决定后端的重排阈值：SFA 构建器 `decode_threshold = 1 + spec_token_num`，上游 GDN 构建器以 `_init_reorder_batch_threshold(1, use_spec_decode)` 取 `1 + num_speculative_tokens`（`parallel_drafting` 时草稿数按 2 倍算）。
- **chunked prefill。** `enable_chunked_prefill` 决定混合批记成 ChunkedPrefill 还是 PrefillCacheHit。
- **图模式与 DP。** 准备输入之后，`_determine_batch_execution_and_padding` 决定这一步补到多少行，`_pad_query_start_loc_for_fia` 按需要给边界补假请求。
- **上下文并行（PCP/DCP）。** PCP 大于 1 时槽位改在切分前、用阻塞拷贝算；PCP 或 DCP 大于 1 时槽位按卡交错另算，不归本卡的位置得 −1，选行另走 `pcp_manager`。GLM 双机不开，这些分支不走。

### 会报什么错

- `assert total_num_scheduled_tokens > 0`、`assert num_reqs > 0`：在 `_prepare_inputs` 开头。正常路径上没有 token 时，`execute_model` 会在必要的 DP 或 KV 协作后提前退出，不进入这里。撞上断言时要核对调用路径、持久批次和计划是否一致；不能把所有零 token 出口都当成 `EMPTY_MODEL_RUNNER_OUTPUT`。
- `Attention backend reorders decodes with threshold ... but other backend uses threshold ...`：启动时 `initialize_attn_backend` 调 `calculate_reorder_batch_threshold`，发现两个后端的重排阈值不一样，抛 `ValueError`。
- `decode_threshold exceeded`：SFA 构建器里 1 + 草稿数超过 16 时的断言。
- `_pad_query_start_loc_for_fia` 的两条断言：全 decode 补齐时要求真实请求数不超过补齐后的请求数，混合批时要求两者相等。
- 映射错位不报错，只表现为输出异常；按常见误解最后一条的做法对表。

### 开销和什么时候别开

- **关不掉，量级随 token 数走。** CPU 侧是按 token 数的 numpy 操作（`np.repeat`、累加、加法）和一次 `torch.index_select` 抓 token id；块表拷贝在 `_prepare_inputs` 第一行就以非阻塞方式发起，和后面的 CPU 工作重叠；槽位在 NPU 上一个 kernel 算完，grid 是请求数 + 1，最后一路把用不到的尾部填成 −1。
- **异步调度。** 开着时上一步采样出的 token 还在 NPU 上，model runner 用 `prev_positions` 等在 NPU 上把它补进 `input_ids`（`_prepare_input_ids`），长度也先按「草稿全被接受」乐观地算，再在需要时校正；见[异步调度](async-scheduling.md)。
- **实际耗时：** 本部署没有逐步 profiling 数据，不能从表的尺寸直接换算准备输入所需时间。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同属此分支期，`_prepare_inputs` 从 L814 起）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 的 MRV1 仍按本文的持久批次与行展平规则在 `model_runner_v1.py` 中拼装输入（`_prepare_inputs` 位于 L1279）；`main` 已彻底移除 `model_runner_v1.py`，全量切入 `worker/v2/`（`worker/v2/model_runner.py#L1141` `prepare_inputs` 与 `worker/v2/input_batch.py` `AscendInputBuffers` / `AscendInputBatch`），常驻设备缓冲与 V2 输入拼装详参 [Model Runner V2](model-runner-v2.md)。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 输入准备入口 | `model_runner_v1.py` `_prepare_inputs` L862（镜像 `db701c1f` L814） | `model_runner_v1.py` `_prepare_inputs` L890 | `model_runner_v1.py` `_prepare_inputs` **L1279**（`#L1279-L1340`） | **`model_runner_v1.py` 已移除**；统一为 `worker/v2/model_runner.py#L1141` `prepare_inputs` → `_prepare_inputs_impl` |
| 形态标签 `_build_attn_state` | L1477 | L1327 | **L1706**（`#L1706-L1735`） | 迁移至 `worker/v2/` 元数据与 `AscendInputBatch`（`worker/v2/input_batch.py#L29-L90`） |
| 无草稿选行 `logits_indices` | L1310 | L1276 | **L1643**（`query_start_loc.gpu[1:num_reqs+1] - 1`，`#L1633-L1645`） | 由 `worker/v2/` 持久设备缓冲与 `sample` 侧统一组织 |
| KDA 专用边界缓冲 | 有（尾部重复最后真实边界，不含假请求） | 有 | 有 | 迁入 `worker/v2/model_states/mamba_hybrid.py` |
| Runner 默认与选择 | 默认 MRV1；已有 V2 目录，0.23.0 有回退门槛 | 默认 MRV1，环境开关切 MRV2 | `patch_use_v2_model_runner.py#L18-L42` 默认 MRV1；MRV1 拒绝 `PCP > 1`，MRV2 另行校验 | **仅保留 MRV2**；`mrv2_utils.py#L29-L65` 恒返 `True`（显式 `=0` 报错），详参 [Model Runner V2](model-runner-v2.md) |

`v0.23.0`、`v0.26.0rc` 与 `v0.30.0` 三个 MRV1 钉点均保持“先非阻塞提交块表 → 按请求 repeat 行归属 → 计算形态与位置 → 无草稿取段末行减 1”的主干顺序，主要形态判据与 KDA 不含假请求的专用边界缓冲一致；`v0.30.0` 的 MRV1 入口不再带旧 GLM 的 CP 分支，且平台入口直接拒绝 MRV1 下 `PCP > 1`。`main` 全面切入 `worker/v2/` 后，旧 MRV1 行号不再适用，需转看 `worker/v2/` 与 [Model Runner V2](model-runner-v2.md)。

### 源码位置

来源 38 补充对账时的块号更新分支：`resumed_req_ids` 标出的恢复请求替换 `block_ids`，其余请求才追加新借块号；不能把持久批次的增量更新理解成块表永远只追加。

来源 39–42 对应 rc2 的形态判断、无草稿选行及线性注意力专用边界；43–44 对应 Worker 的实际选类和环境开关；45–46 对应平台调用校验与 V1 的 PCP 拒绝条件。

| 要找的 | 位置 |
|---|---|
| 一步的入口与提前返回 | `vllm_ascend/worker/model_runner_v1.py` L2014–L2064 [C11] |
| 同步持久批次 | 昇腾外壳 L748–L763；上游 `vllm/v1/worker/gpu_model_runner.py` L1125–L1180、L1436–L1447 [C19] |
| 提交块表、行归属、位置 | L814–L868 [C2] |
| 形态标签 | L1444–L1470 [C8] |
| token id | L945–L962 [C3] |
| 边界、KDA 专用边界、长度 | L1018–L1042 [C4]；NPU 侧长度与槽位调用 L1228–L1254 |
| 丢弃名单 | L1075–L1099 [C5] |
| 选行 | L1263–L1314 [C7]；带草稿 L1492–L1520 [C9]；按选行取隐藏向量 L2287–L2327 |
| 边界补假请求 | L765–L813 [C10] |
| 注意力元数据 | 公共底稿 L3141–L3170；按缓存组换表 L3254–L3280 [C14] |
| 重排阈值 | 一致性检查 L5101–L5125 [C15]；SFA `vllm_ascend/attention/sfa_v1.py` L283–L324 [C16]；GDN 上游 `vllm/v1/attention/backends/gdn_attn.py` L104–L111、昇腾 `vllm_ascend/ops/gdn_attn_builder.py` L283–L302；阈值规则 `vllm/v1/attention/backend.py` L557–L581；四段重排 `vllm/v1/attention/backends/utils.py` L606–L640 |
| 槽位与块表提交 | `vllm_ascend/worker/block_table.py` L154–L185 [C17]、L284–L288；上游 `vllm/v1/worker/block_table.py` L141–L164 |
| 广播给 8 个 worker | `vllm/v1/executor/multiproc_executor.py` L307–L318 |
| 异步调度下的 token id 与自动打开 | 上游 `vllm/v1/worker/gpu_model_runner.py` `_prepare_input_ids` L1700–L1775 [C33]；`vllm/config/vllm.py` L957–L997 |
| 空批次 | `_dummy_run` 从 L3347 起，不调用准备输入 |
| 官方设计文档 | `docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md` L24–L64 [S26] |

**正文推导口径。** A、C 两条请求、token 表每行 8 格、块长 4、块表 [7, 2] 与 [9] 都是为手算设的示意数 [A]。R1 的 4 个 token、位置 0 到 3、边界 [0, 4]、第二步的位置 4 到 7 取自主线底稿 01 §A2.4、§A3 与底稿 03 §A6（第一步取位置 3 那一行、第二步取 4 行也与 03 §A6 一致）；长度和形态是把上面的源码规则代入这些数得出的，阈值 4 是 1 + MTP 的 3 个草稿 [D]。场景 M 的 12 条 decode 排在新请求之前，是按四段重排规则推出来的，没有实跑日志 [D]。每步耗时没有 profiling 数据 [!]。

**异步输入仍可能从 CPU 复制。** 固定上游 0fc695fc 在上一轮采样缓存为空时直接复制输入；已有缓存时，先统计能匹配上一轮位置的采样与候选。如果 num_common_tokens 小于 total_num_scheduled_tokens − total_num_spec_tokens，仍复制本轮整段 CPU 输入；启用提示词嵌入时还复制对应嵌入和标记。因此，不能把异步输入一概算成零主机到设备搬运；设备复制耗时仍需测量。[C33]
