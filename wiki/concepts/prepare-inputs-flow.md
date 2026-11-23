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
  - to: continuous-batching
    kind: builds-on
    note: 连续批处理在同一轮里混排不同长度的 prefill 与 decode 请求，因此必须首尾相接拍平并配身份表
  - to: paged-attention
    kind: builds-on
    note: 分页注意力按块存历史 KV，本页的 slot_mapping 正是把位置翻译成缓存池里的物理槽位号
  - to: block-table
    kind: builds-on
    note: 位置怎样经块表换成槽位、GLM 的 5 张块表各怎样用，推导在块表页
  - to: chunked-prefill
    kind: builds-on
    note: 长提示词分块送入时只保留未完请求的 KV 并丢弃中间采样，决定选行与形态标签
  - to: request-call-chain
    kind: builds-on
    note: 准备输入对应请求调用链第 3 站，承接 EngineCore 下发的差量 SchedulerOutput 计划
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

下面三张短表按请求记，不按 token 记：**边界** `[0, 1, 4]` 标出 A 占第 0 行、C 占第 1 到 3 行；**长度** `[6, 3]` 记下本步算完后 A 有 6 个位置历史、C 有 3 个；**选行** `[0, 3]` 指明只有第 0 和第 3 行的输出去预测下一个 token。右边是它们的去处：token id 与位置进模型，边界、长度连同块表和槽位交给注意力，选行交给输出头。

同一个 token 身上有三个编号，千万别混：

- **批次行号**：它在这一步拼好的一排里排第几。每一步都重新排。
- **位置**：它在自己那条请求里排第几。一条请求从 0 往后数，跨步累加。
- **槽位**（slot）：它的 KV 写进缓存池的第几格。由位置经块表换算出来。

A 的那个 token 行号 0、位置 5、槽位 9；C 的第一个 token 行号 1、位置 0、槽位 36。三个数各不相同，谁也不能拿来代替谁。

## 为什么要拼成一排再配表？代价在哪？

**因为把多行输入合成矩阵，能增加权重复用的机会，并摊薄调用开销。** 一层里的线性层，是把「若干行 × 隐藏维」的输入乘上同一份权重。4 个 token 一起乘，共用同一张权重；逐条调用则重复组织小矩阵计算。理想情况下，并批可复用已读取的权重；实际 HBM 读量和速度取决于缓存、内核分块与输入形状，不能仅凭 4 行就认定只读一遍。

一起算有两种排法。排法一是每条请求占一行、按最长补齐：A 只有 1 个 token 也要补到 3 个（2×3 = 6 格里白算 2 格）；混批时 decode（每步通常 1 token）撞上 prefill（数千 token），decode 行就要补上几千个空格。vLLM 采用排法二：所有 token 首尾相接，4 个 token 就是 4 行，不为逐请求等长而补齐（后续图尺寸与并行通信仍可能另行补齐）：

```wiki-diagram
file: prepare-inputs-flow-fig-ragged-vs-pad
```

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

异步调度能把 CPU 准备和上一步设备计算重叠起来，却不保证完全省掉从 CPU 到设备的输入拷贝。有上一轮采样结果可复用时，runner 先识别本轮仍与上轮位置衔接的请求，分别数出可复用采样 token 数与这些请求本轮安排的投机候选数。从本轮总输入数扣掉这些投机候选后，若余量仍大于可复用采样数，仍须先把本轮 CPU 输入复制到设备。因此不能只凭「开了异步调度」就断定零拷贝，也不能拿未扣减候选的总数代替这项判断。

**第二，几张表必须对着同一套行号。** 每张表各自形状都对，也不能说明它们对得上。只要其中一张还按旧的行序写，A 的 token 就会带上 C 的位置、写进 C 的槽位、读到 C 的历史。这种错不报异常，只表现为输出变怪。排查时要把同一步的请求 ID、本步 token 数、已算长度、位置、边界、块表和选行放在一起对。

**第三，补出来的行要标清楚。** 为了能回放预先录好的计算图（[graph mode](acl-graph.md)），一步的行数有时要补到固定尺寸。补的行不是真请求，要靠边界、有效 token 数和槽位里的填充值把它们排除在外，后面细讲。

## A/C 第三轮如何拼接？

这一节把上图那四列一格一格填出来，先用一张图对齐持久批次、本步 4 行紧排张量与按请求元数据的对应关系：

```wiki-diagram
file: prepare-inputs-flow-fig-ac-step3
```

填表的原料有两份：调度器这一步的计划（每条请求本步几个 token），和持久批次里记着的东西（每条请求已经算了几个位置、全部 token、块表）。设 A 坐持久批次第 0 行、C 坐第 1 行；二维 token 表每条请求占一行（按 8 格示意），A 存 `a₀..a₅`，C 存 `c₀..c₂`。块长按 4 个位置，A 的块表是 `[7, 2]`，C 是 `[9]`：

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
5. **长度**（`seq_lens`）。已算数加本步 token 数，即本步算完后每条请求的总位置数：A 看全部 6 个位置，C 的 3 个 token 各看自己及前面位置。
6. **槽位**（`slot_mapping`）。位置除以块长，商查块表得块号、余数为块内偏移：A 的位置 5 落块 2 第 1 格得槽位 `2×4+1=9`；C 的位置 0–2 均落块 9 得 `36–38`（详见 [block table](block-table.md#表怎样随请求变化槽位每步怎样算)）。
7. **选行**（`logits_indices`）。边界除开头 0 外每项减 1，仅这些末行进输出头预测下一 token。

模型最终收到两组数据：token id 与位置作为**输入**进嵌入层与位置编码；边界、长度、块表、槽位连同请求数、token 数和最长段行数组成**注意力元数据**（attention metadata）交给各层定位历史读写。拼在一起的只是本步新 token，历史仍完全隔离：线性层和 MLP 4 行共乘权重，注意力则按边界、长度与各自块表隔离读取，同为位置 0 也落在不同物理槽位。

## 填表前后还有什么：持久批次、形态、元数据、选行与补齐

**准备输入夹在「同步持久批次」和「建注意力元数据」之间，三段合起来是每步前向前的完整翻译链。** 先以 `v0.30.0` 标准主基线下的 **Qwen3-8B**（单一 `FullAttentionSpec` 缓存组、`block_size = 128`）看一遍完整顺序：拍平 `input_ids [T]`、`positions [T]`、`query_start_loc [B+1]` 与单一 `slot_mapping [T]`，全 36 层共用 1 份 `AscendMetadata`：

```wiki-diagram
file: prepare-inputs-code-flow-qwen3
```

### 先同步持久批次：每步只改变了的那几行

拿到计划后，model runner 先把持久批次（`input_batch`）改成与本步一致，顺序固定：

1. 删掉已经结束的请求，再删掉本步没排上的请求（如被抢占的），空出它们的行；
2. 对继续跑的请求，更新已算数，把调度器新借的块号追加到它那一行块表的末尾；从抢占中恢复的请求则用本次下发的块号替换旧块号，再重新进入持久批次；
3. 把新请求和恢复请求放进空行，号小的空行先填；
4. 把中间空行压紧，将最后一行整行搬进空位；
5. 若注意力后端声明了 decode 阈值，则按阈值重排：本步 token 数不超过阈值且已在 decode 的排最前，本步从位置 0 开始的新请求排最后，分段算提示词的排中间。

因此**一条请求坐第几行不是终身的**：别的请求结束、新请求加入或重排，都会让它换行。按请求找结果必须查「请求 ID → 行号」对照表，不能记死行号。若本步计划 0 个 token，则不进入常规输入准备，直接走提前返回分支（多组 DP 或 KV 传输场景下仍可能先做协作再返回）。

上述描述对应 `v0.30.0` 默认的 V1 runner。新版上游把「请求长期存储行」与「本步计算顺序」解耦，每步只按索引收集，不再为排序搬动整份状态（见 [Model Runner V2 专页](model-runner-v2.md) 与 [NPU Model Runner 中的 V2 状态组织](npu-model-runner.md#model-runner-v2-为什么要重新组织状态)）。

### 再给这一步贴一个形态标签

准备输入一开头，model runner 判断本步形态（`attn_state`），供注意力后端挑算子路径。按顺序判断，先命中先算：

- **纯 prefill（`PrefillNoCache`）**：本批请求都还没算过任何位置，没有历史可读；
- **纯 decode（`DecodeOnly`）**：每条请求本步都只有 1 个 token（若开启 MTP 投机，则记为 `SpecDecoding`）；
- **投机验证（`SpecDecoding`）**：每条请求去掉草稿 token 后都只剩 1 个（非 MTP 投机在后端元数据里改记为 `ChunkedPrefill`）；
- **混合批或带历史 prefill**：开启 [chunked prefill](chunked-prefill.md) 时记为 `ChunkedPrefill`，否则记为 `PrefillCacheHit`。

**边界与例外**：这些名字只代表本步执行形态，不等于请求阶段。例如带历史的 1 token 提示词尾块也会满足「本步 1 个 token」，但它仍在完成提示词，不能仅凭 `DecodeOnly` 名称认定请求已进入生成阶段（见 [prefill](prefill.md)）。

A、C 那一步里 A 有历史、C 本步 3 个 token，前三条都不满足，落在最后一条。

### 位置怎样找到缓存写入处

槽位按前文第 6 条算：位置除以块长，商查块表得块号，槽位 = 块号 × 块长 + 余数。对标准 `Qwen3-8B` 这类单一缓存组模型，NPU 上一次核函数调用就能按 `block_id × 128 + offset` 算出全模型共用的单一 `slot_mapping [T]`。对多缓存组异构模型，则按组各算一份；只存固定大小状态的线性注意力组（如 GLM 的 KDA）不算槽位（NPU 并行计算细节见 [block table](block-table.md#表怎样随请求变化槽位每步怎样算)）。

### 注意力元数据：一份底稿，按缓存组换上各自的块表和槽位

边界、长度、请求数、token 数这些全局批次信息对所有层都一样，model runner 先造一份公共底稿（`AscendCommonAttentionMetadata`）。在 `Qwen3-8B` 上只有一个缓存组，直接产出全 36 层共用的 1 份 `AscendMetadata`；在多缓存组异构模型上，model runner 对每个缓存组复制底稿、换上该组块表与槽位，再交给对应后端的元数据构建器整理成算子张量格式。

下面这张双轨流水与张量格图展示整段 Host → Device 打包（层分组方式见[注意力后端](attention-backend-family.md#runner-怎样把层归拢成组)）。上半看非阻塞块表 **H2D**（Host-to-Device，主机内存拷往设备显存）如何与 CPU 展平重叠并汇入 NPU 槽位核；下半直观对比补齐行在 `slot_mapping`、常规/**SFA**（Sparse Flash Attention，稀疏闪电注意力）边界与 KDA 边界里的真实格值：

```wiki-diagram
file: prepare-inputs-flow-fig-h2d-packing
```

### 哪几行送去输出头

标准无投机路径里，每条请求只取最后 1 行（`query_start_loc[1:] - 1`），A、C 例子就是 `[0, 3]`。有两种常见边界：

- **提示词只算了一段（chunked prefill）**：假设 C 提示词有 10 个 token，本步只排前 3 个。第 3 行照样走完采样，但 model runner 会把 C 放进丢弃名单（算完长度 3 小于已有 token 数 10），不对外交出这一步的采样结果。
- **开启投机验证**：带 $k$ 个草稿 token 的请求需校验每个候选，因此取这条请求最后 `1 + k` 行（同批无草稿的请求仍只取最后 1 行，见[投机解码](speculative-decoding.md)）。

### 补齐的行不是新请求

使用图模式（[ACL Graph](acl-graph.md)）或双 DP 组对齐时，本步行数会被补大到最近的已录档位（补齐账单见[多条请求](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。补出来的行在四张表里分别标记：

- **槽位**：填 `-1`，表示该行不写任何 KV 格子；
- **长度**：填 `0`；
- **常规边界**：要求尾值等于补齐后总行数的算子，在末尾补上一段或几段「假请求」把补齐行包进去；
- **线性注意力边界**：KDA 等后端要求不含假请求，model runner 为其另留一份边界，补齐位只重复最后一个真实边界。

因此数请求要看真实请求数，数 token 要看有效 token 数，都不能直接看张量第一维。

## 放到 GLM 双机：R1 这一步，每张卡拼出什么？

从标准单一缓存组 `Qwen3-8B` 转入例外 B 历史 GLM-5.3-Flash 双机部署（2 台 Atlas 800 A2 各 8 卡、TP8/DP2/EP16、W8A8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)）后，输入准备扩展为 5 个混合缓存组、3 套槽位与 MTP 4 行验证。对应主线[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)的多组代码路径如下图：

```wiki-diagram
file: prepare-inputs-code-flow
```

R1 是主线一路跟踪的[示例请求](one-request.md#示例请求-r1-与官方双机部署)，提示词 4 个 token（教学设定），落在 DP0（第一台机器）。

**8 个 worker 各拼一份一模一样的输入。** TP8 下 8 张卡算同一批 token、仅权重分片不同，因此输入必须完全一致。DP0 引擎经共享内存广播队列把计划发给 8 个 worker，各 worker 独立走完拼表流程，算完仅 0 号卡交回引擎。R1 第一步每卡拼出 4 行、位置 0–3、边界 `[0, 4]`（见[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)），第一步与第二步对照如下：

| 步骤（示例请求 R1） | 长度 `seq_lens` | 选行 `logits_indices` | 形态 `attn_state` 与判据 |
|---|---|---|---|
| **第一步（prefill）** | $0 + 4 = \mathbf{4}$ | $[4 - 1] = \mathbf{[3]}$（无草稿，只取唯一段末行） | **`PrefillNoCache`**（本批请求均未算过任何位置） |
| **第二步（decode + 3 草稿）** | $4 + 4 = \mathbf{8}$ | $\mathbf{[0, 1, 2, 3]}$（$y_0$ 加 3 个草稿，$1+3$ 行全选） | **`SpecDecoding`**（4 个 token 去掉 3 个草稿剩 1 个） |

第一步带 prefill，拿不到纯 decode 计算图，按 eager 逐个下发算子。第二步的 4 行是首词 `y₀` 加 MTP（多 token 预测层）猜出的 3 个候选，位置 4 到 7 且全部送去验证（见[第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)）。GLM 双机自动开启[异步调度](async-scheduling.md)，因此 `y₀` 与 3 个候选的 token id 直接从上一步留在 NPU 的输出拷入输入，不从 CPU token 表抓；长度先按「草稿全接受」乐观计算，需要时再校正。

**槽位要算三套，KDA 不算槽位。** GLM 的 45 层主干加 MTP 分进 5 个缓存组，worker 维护 5 张块表（R1 首步 15 块见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)）：

- **稀疏 MLA 主缓存与 indexer K**（同在 full 组）：分配块长 640，算子按 128 读，块号展开成 5 个；indexer K 每 4 位置压出一条，只在凑满 4 位时写槽位，其余位为 `-1`。
- **indexer 尾状态组**：块长 4，暂存未满 4 位置的尾部，每个位置各写一格。
- **3 个 KDA 组**：每条请求只存固定大小递推状态，块号直接当状态页编号，不算逐位槽位（三套槽位推导见 [block table 的 GLM 一节](block-table.md#放到-glm-双机r1-的-15-个块号进了哪几张表)）。

**两类后端边界与重排阈值。** 主干 34 层 KDA 与 11 层（加第 45 层 MTP）稀疏 MLA 报出不同后端（见[注意力后端](attention-backend-family.md#放到-glm-双机一个-token-走过-45-层要问-45-次)）：稀疏 MLA 用补了假请求的常规边界，KDA 用不含假请求的专用边界。两类构建器均将 decode 重排阈值设为 `1 + 3 = 4`（不一致则启动报错），因此混批时 ≤4 token 的 decode 请求排前、新请求排后。[场景 M](concurrent-requests.md#第-3-站-准备输入13-条请求拼成一个-6048-行的张量)中 12 条 decode（各 4 token）排在 1 条 6000 token 新请求之前，拼成 6048 行，补齐与对齐账在那一页。

**DP1 陪跑不走这套流程。** DP1 没有请求，但 EP16 MoE 通信需 16 卡齐参。R1 前两步中，DP1 的 8 个 worker 直接由 runner 造出 4 token 空批次（`_dummy_run`）对齐宽度，不经过持久批次对账与填表。

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

- **关不掉，量级随 token 数走。** CPU 侧是按 token 数的 numpy 操作（`np.repeat`、累加、加法）和一次 `torch.index_select` 抓 token id；块表拷贝在 `_prepare_inputs` 第一行就以非阻塞方式发起，和后面的 CPU 工作重叠；槽位在满足 `_can_fuse_slot_mapping` 且无压缩位置与 `req_indices` 时于 NPU 上单核融合算完（grid 为请求数 + 1，最后一路将用不到的尾部填成 −1），否则按 KV 缓存组逐组计算（跳过 Mamba/KDA 组）。
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

来源 39–42 对应 `v0.30.0`（及历史候选快照）的形态判断、无草稿选行及线性注意力专用边界；43–44 对应 Worker 的实际选类和环境开关；45–46 对应平台调用校验与 V1 的 PCP 拒绝条件。

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
