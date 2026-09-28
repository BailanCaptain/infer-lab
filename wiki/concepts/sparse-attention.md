---
id: sparse-attention
title: "稀疏注意力：先挑位置，再只读这些位置"
type: concept
summary: 稀疏注意力让每个查询只在因果范围内挑出的少量历史位置上做 attention；GLM 用 indexer 按 4 个位置一池打分，每个查询最多读 2051 个位置，没选中的历史仍须全部保留。
aliases: [稀疏注意力, Sparse Attention, 密集注意力, Dense Attention, 滑动窗口注意力, sparse mask, top-k 注意力, 稀疏 MLA 的位置选择]
chapters: ["04"]
sources:
  - https://arxiv.org/abs/1706.03762
  - https://arxiv.org/abs/1904.10509
  - https://arxiv.org/html/2512.02556v1
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1972-L2028
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1140-L1232
  - vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L419-L504
  - vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L23-L237
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2252-L2259
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L64-L77
  - vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L576-L719
  - vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L473-L612
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L119-L127
  - vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L344-L346
  - vllm-ascend@baa023ad:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L122-L146
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L123-L177
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: attention-qkv, kind: builds-on, note: 评分、softmax、V 汇合和因果掩码（含掩码模式 3）都在那里讲；本页只改变哪些位置参与 }
  - { to: mla, kind: builds-on, note: 主 attention 读的是 MLA 压缩后的 512 维潜向量；历史怎样压缩归 MLA 页 }
  - { to: glm-5-3-flash, kind: builds-on, note: indexer 五步、压池门控与每个查询最多 2051 个位置的推导出处 }
  - { to: one-request, kind: builds-on, note: R1 在第 4 站的位置清单（4 行 × 2051）逐行内容与 11 层稀疏 MLA 的形状 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 每个查询都要把全部历史读一遍吗？

[attention](attention-qkv.md) 里，当前位置用自己的 **query（查询向量）** 去和每个历史位置的 **key（键向量）** 打分，softmax 把这排分数换成加起来等于 1 的权重，再按权重把各位置的 **value（值向量）** 加起来。普通的 **dense attention（密集注意力）** 对因果范围内的每个位置都做一遍，因果范围就是当前位置和它之前的全部位置：历史有多长，就要读多少份 K/V、打多少个分。

**sparse attention（稀疏注意力）让每个查询先从因果范围里挑出一小部分位置，再只在这些位置上打分、做 softmax、汇合 V；没挑中的位置这一次不参与计算。**

挑哪些位置由模型决定。GLM-5.3-Flash 沿用 DeepSeek-V3.2 提出的 **DSA**（DeepSeek Sparse Attention）：先用一个很便宜的打分网络 **lightning indexer**（下文简称 indexer，也称索引器）给每个历史位置粗打一个分，按分数取最高的 k 个位置，这一步叫 **top-k**；真正算输出的那次 attention（下文称主 attention）只读这 k 个位置。

```wiki-diagram
file: sparse-attention-intuition
```

图里用 12 个历史位置、k = 4 做示意。第一行是缓存里全部可见的历史，每个位置存着一份 K/V。indexer 给每个位置打一个分，深色的是分数最高的 4 个。主 attention 只读这 4 个位置的 K/V，softmax 也只在这 4 项之间分配权重。虚线格这次没被选中，但仍留在缓存里：每个查询都重新打分、重新挑选，这次落选的位置下一次照样有机会被选中。

## 为什么能省，代价在哪？

先看密集 attention 要做多少工作。一次 prefill（把整段 prompt 一次算完）有 n 个位置时，第 0 行只能看自己，第 1 行看前两个，依次形成下三角，共 n(n+1)/2 个「查询–键」位置对要打分；decode（逐个生成 token）时，每个新查询也要把已有历史连同自己读一遍。每个查询的工作量跟历史长度 L 成正比，L 个查询合起来就按 L² 增长。稀疏以后每个查询最多读 k 个位置，主 attention 的工作量降到 L × k 量级。DeepSeek-V3.2 报告给出的正是这个换算：核心 attention 从 O(L²) 降到 O(Lk)，其中 k 远小于 L。

落到 GLM，k 对应 2048 个位置，另加最多 3 个「尾部」位置；历史要多长才真正开始挑、最长时只读几分之一，见[后文](#稀疏什么时候才真的起作用)。

省下这些要付三笔代价：

1. **indexer 自己也要扫一遍全部历史。** 它要给每个可见位置打分，工作量仍按 L² 增长，只是它比主 attention 轻得多：头少、每头维度小，DeepSeek 原版还用 FP8（8 位浮点）来算。所以省下的是主 attention 那一份，不是全部。
2. **历史一条也不能丢。** 落选的位置下一次还可能被选中，所以全部历史仍要留在 [KV cache](kv-cache.md) 里；indexer 还要另存一份自己的 key。读得少，不等于存得少。
3. **输出变了，模型必须为此训练过。** softmax 只在选中位置之间归一化，结果和密集 attention 不同，下一节有例子。DeepSeek-V3.2 分两段训练：先冻住其他参数、只训练 indexer，用 KL 散度（衡量两个概率分布差多远）让它的打分分布去逼近主 attention 的注意力分布；再打开 top-k 选择，训练全部参数。所以稀疏模式是模型结构的一部分，不是部署时能给任意模型打开的开关。

和相邻的几种做法相比，稀疏 attention 只改「读哪些位置」，不改「历史怎样存」：

| 做法 | 每个查询读哪些位置 | 历史怎样存 |
|---|---|---|
| 密集 attention | 因果范围内的全部位置 | 每个位置一份 K/V |
| 稀疏 attention | 因果范围内挑出的一部分 | 仍是每个位置一份，全部保留 |
| [MLA](mla.md) | 与选哪些位置无关，可以和稀疏叠加 | 每个位置压成一条潜向量 |
| [KDA](linear-attention.md) | 不再逐个位置读取 | 整段历史折进一个固定大小的状态 |

## 在允许的历史里再挑一次：公式与掩码

稀疏 attention 给每个查询位置 t 定一个位置集合 J(t)，只让集合里的位置参与主 attention。打分、softmax、汇合的形式都不变，只是求和范围从「因果范围内全部位置」换成 J(t)：

```text
对 j ∈ J(t)：sⱼ = qₜ · kⱼ / √dₖ
pⱼ = exp(sⱼ) / Σ_{u∈J(t)} exp(sᵤ)
oₜ = Σ_{j∈J(t)} pⱼ vⱼ
```

softmax 的分母也只包含 J(t)，所以限制位置通常会改变输出。这和「先算完密集 attention、再把几项结果删掉」不一样：删掉以后剩下的权重加起来不到 1，稀疏 attention 则在选中的位置之间重新归一化。看一个 4 个位置的教学例子，分数为 [ln2, 0, 0, 0]，只保留位置 0 和 3：

```calc
title: 只留两个位置，权重怎样重新分配
密集的分母 = e^ln2 + 3 × e⁰ = 2 + 3 = 5
密集时位置 0 的权重 = 2 ÷ 5 = 0.4
密集时其余每个位置 = 1 ÷ 5 = 0.2
稀疏的分母 = e^ln2 + e⁰ = 2 + 1 = 3
稀疏时位置 0 的权重 = 2 ÷ 3 ≈ 0.667
稀疏时位置 3 的权重 = 1 ÷ 3 ≈ 0.333
> 若从密集结果里直接删掉位置 1 和 2，剩下 0.4 + 0.2 = 0.6，不到 1
```

下图换个角度看同一件事：每一行是一个查询，每一列是一个键，有颜色的格表示这对位置参与计算。

```wiki-diagram
file: dense-sparse-attention
```

左图是 6 个位置的密集因果范围，共 6 × 7 ÷ 2 = 21 个有效格。右图用一个教学假设：每个查询只看自身、前一个位置和位置 0，重复的位置只算一次，共 15 个有效格。右图不是 GLM 的稀疏模式；GLM 按内容挑选，每一行各选各的。

**因果掩码和稀疏模式是两层约束。** 因果掩码规定不能看未来；稀疏模式规定在允许的历史里读哪些。两者同时生效：挑出的位置也必须在因果范围内。多个请求合成一批计算时，还不能越过请求边界读别人的历史。GLM 的稀疏 attention 内核用的是右下对齐的因果掩码（掩码模式 3），它的含义和报错条件见 [attention 的报错表](attention-qkv.md#会报什么错)。

## 候选位置从哪里来？

挑位置的规则大致有三类：

| 方式 | 按什么挑 | 好处与取舍 |
|---|---|---|
| 局部窗口 | 最近的若干位置 | 访问规整；远处的信息要靠别的路径传过来 |
| 固定结构 | 预设的跨距、块或几个全局位置 | 模式规整，但挑哪些不看当前内容 |
| 按内容选 | indexer 或路由网络打出的分数 | 每个查询挑自己需要的历史，代价是多一次打分和多一份状态 |

早期的 Sparse Transformer 展示了结构化的稀疏分解和对应的内核，是「改变连接方式」这条思路的原始研究之一。这三类只是概念上的对照，不是每个模型都依次走过的版本路线。GLM 用的是第三类。

**DSA 的 indexer 怎样打分。** indexer 有自己的几个小 query 头、一条所有头共用的小 key，以及每个头一个权重。对当前查询 t 和历史位置 s：

```text
I(t, s) = Σⱼ wₜ,ⱼ · ReLU(qₜ,ⱼ · kₛ)
```

j 遍历 indexer 的各个头；ReLU 把负数置零；wₜ,ⱼ 决定每个头的分数占多少。top-k 按 I 取，DeepSeek-V3.2 取 k = 2048。这些分数只用来排序，不进入主 attention 的 softmax；主 attention 用自己的 Q、K 重新打分。

DSA 建在 [MLA](mla.md) 上：每个位置只存一条潜向量，所有查询头读的都是这一条，报告称之为 MLA 的 MQA 模式（多个 query 头共用同一份 K/V）。因此一次选择由全部头共用。

**GLM 在 DSA 上主要改了三处**：按池选，相邻 4 个位置的 indexer key 压成一条池 key（**kpool**），原版逐个位置挑；打分不做 ReLU，直接对带符号的点积加权求和；还没凑满一池的最新位置叫**尾部**，不打分、直接补进清单。压池门控和完整五步见[模型页的稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

## 放到 GLM 双机：一个查询在一层稀疏 MLA 里怎样挑、怎样读

GLM-5.3-Flash 有 11 个稀疏 MLA 层（第 3、7、11……43 层），另外 34 层是 [KDA](linear-attention.md)。部署是 2 台 A2 × 8 卡，机内 TP8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)；TP8 下每张卡负责 64 个主 attention 头里的 8 个。一个查询位于位置 p 时，每一层稀疏 MLA 按下面四步走：

1. **indexer 只给完整池打分。** 因果范围 0…p 里有 ⌊(p+1)/4⌋ 个完整池，只有这些池参与打分；还没凑满的池和未来的池一律记成负无穷，不会被选中。
2. **最多选 512 个池。** 位置预算 2048 ÷ 每池 4 个位置 = 512 个池。完整池不到 512 个时全部选中，多出的名额填 −1。
3. **展开并补尾。** 每个选中的池展开成 4 个位置编号；再把 p 所在那组里还没凑满一池的 0–3 个位置直接补进来。所以清单每行留 2048 + 3 = 2051 个名额，2051 是容量，不是实际选中的个数，也不是头数。
4. **主 attention 按清单读潜向量。** 清单交给昇腾的稀疏 FlashAttention 内核：它经 [block table](block-table.md) 找到每个位置在缓存里的 512 维潜向量，一次选一个位置（选择粒度为 1），用右下对齐的因果掩码算本卡的 8 个头；之后做 V 解压和输出投影，最后用一次 [All-Reduce](collective-communication.md#all-reduce) 把 8 张卡的部分和加起来。

```wiki-diagram
file: sparse-attention-path
```

图上 indexer 有两条路：NPU 上满足输入条件时走 triton（一种用 Python 写设备内核的语言）写的算子，其余情况走公式相同的 PyTorch 回退实现。图上其余分支的含义见[源码位置](#源码位置)。

TP8 下有两样东西不按卡切：indexer 在每张卡上各算一遍，512 维潜向量也在每张卡上各存完整一份，供本卡 8 个头共用；切法见 [tensor parallel 的稀疏 MLA](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)。潜向量怎样压缩、为什么不带 RoPE，见 [MLA](mla.md)。

### 稀疏什么时候才真的起作用

历史不超过 2051 个位置时，512 个池加 0–3 个尾部就能盖住全部历史，结果等于密集因果 attention。主线的示例请求 R1（prompt 只有 4 个 token）就是这样：清单形状 [4, 2051]，每行读到的都是自己的全部因果历史，其余名额是 −1，逐行内容见[一条请求的 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。

历史更长时才开始真正挑选。以本部署允许的最长上下文 133120 个位置为例，最后一个查询面前有 33280 个完整池，只选其中 512 个，约占 1.5%；这时尾部为 0，读 2048 个位置，即全部历史的 1/65。

按长历史的上界，一个查询在一层里做多少打分和汇合，可以直接从清单宽度算出来：

```calc
title: 一个查询在一层稀疏 MLA 里的计算上界（每卡）
QK 打分的乘加次数 = 8 个头 × 2051 个位置 × 512 维 ≈ 8.40 M
PV 汇合的乘加次数 = 8 个头 × 2051 个位置 × 512 维 ≈ 8.40 M
一层合计 = (8.40 M + 8.40 M) 次乘加 × 2 FLOP ≈ 33.6 MFLOP
主干 11 层 = 11 × 33.6 MFLOP ≈ 370 MFLOP
> 不含 softmax、各投影和内核补齐；短历史按实际选中的位置数算
```

同样按上界，选中潜向量的逻辑读取量是 2051 × 512 × 2 B ≈ 2.00 MiB（每个 token、每层、每卡），主干 11 层 22.0 MiB，加上 [MTP](speculative-decoding.md) 层（生成投机草稿的配套层，也是稀疏 MLA）共 12 层 24.0 MiB。潜向量在 TP 组内每卡各存一份，所以每张卡都要读这些。这是逻辑数据量，没有计入内核的分块、重复加载和缓存复用，也没有实测。

## 常见误解

- **「稀疏就是把密集 attention 的结果删掉几项。」** 不是。权重会在选中位置之间重新归一化，直接删项则剩下的权重加起来不到 1，见[公式与掩码](#在允许的历史里再挑一次公式与掩码)的例子。
- **「每个查询只读 2051 个位置，所以只要缓存 2051 个位置。」** 不对，全部历史都要保留，理由见上面第 2 笔代价。GLM 的稀疏层还要另存 indexer 的池 key 和未满一池的尾部状态，布局见 [MLA](mla.md#稀疏选择是压缩之上的另一层机制) 和 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。
- **「连接数少几倍，耗时就少几倍。」** 不能这样折算。indexer 仍要扫过全部完整池；内核会按块访问、补齐清单宽度、做融合计算；形状规整的密集内核在某些规模下未必更慢。前面掩码图里 15 格对 21 格，只是那种模式的逻辑连接数。
- **「稀疏是个部署开关，任何模型都能打开。」** 不是，见第 3 笔代价：给按密集方式训练的模型随手删掉历史连接，会改变输出，不是无损的。后端要做的是正确实现模型规定的稀疏模式和对应的状态读取。
- **「MLA 和稀疏 attention 是一回事。」** MLA 决定每个位置存成什么形状（一条潜向量），稀疏决定这次读哪些位置；GLM 的稀疏 MLA 两者都用，但可以分开理解。

## 对照源码

### 怎么开

稀疏 attention 没有单独的开关，由模型配置和模型代码决定。GLM-5.3-Flash 的配置里 `index_topk=2048` 是每个查询的位置预算，`index_kpool=4` 是每池的位置数；indexer 的头数与每头维度见[模型页的配置表](glm-5-3-flash.md)。模型按层号构造稀疏 MLA 层或 KDA 层，选层方式见 [attention 的「怎么开」](attention-qkv.md#怎么开)；部署命令统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

模型初始化时，只要配置里有 `index_topk`，就开一块位置清单缓冲，宽度为 `index_topk + index_kpool - 1`，即 2051；行数取调度上限 `max_num_batched_tokens`。配置里的 `index_kpool_always_select_tail` 在这条推理路径上只保留为配置字段，尾部总是追加。MTP 草稿层三遍是否复用 indexer 结果，见[一条请求的实现细节](one-request.md#源码位置)。

### 会报什么错

| 条件 | 报错 | 本部署上怎样判断 |
| --- | --- | --- |
| 缓存视图少于两份 | `ValueError: Indexer KPool MLA sparse attention requires latent and RoPE cache views.` | 子类入口先检查潜向量与 RoPE 两份视图都在 |
| 潜向量缓存宽度不对 | `ValueError: Indexer KPool MLA latent cache dim must be ...` | 应等于 `kv_lora_rank`，本配置为 512 |
| RoPE 缓存宽度不对 | `ValueError: Indexer KPool MLA RoPE cache dim must be ...` | 应等于 `qk_rope_head_dim`，本配置为 0 |
| 取不到整份打包缓存 | `ValueError: Indexer KPool MLA sparse attention requires the packed MLA cache.` | 内核读的是打包后的潜向量缓存，不是拆开的两份 |
| 调用方要求返回 LSE | `NotImplementedError: Indexer KPool MLA attention does not expose LSE.` | 这条路径固定不返回，上下文并行合并时才需要 |
| 掩码模式不是 3 | `ValueError: Indexer KPool MLA only supports sparse_mode=3, got ...` | 默认就是 3，含义见 [attention 的报错表](attention-qkv.md#会报什么错) |
| 清单行数对不上查询行数 | `RuntimeError: topk_indices rows ... align with neither query tokens ... nor actual tokens ...` | 见下文 |
| 该选位置时没有 indexer | `RuntimeError: skip_topk is False but indexer is None. ...` | 父类前向在调用 indexer 之前检查 |

清单行数这一条和 MTP 有关：eager 模式（不走图模式）下，草稿步会把整块首遍输入缓冲送进来，而 indexer 只为真实的查询行出清单。设备入口会把清单用 0 补到查询的行数；内核只处理前面真实的那些行，补出来的行不会被读。补不齐时才报上面的错。以上都是源码里的检查点，没有在 NPU 上故意触发。

### 开销和什么时候别开

这个模型不能关掉稀疏：它的权重是按稀疏方式训练的。能看的是开销落在哪里。

- **indexer 每层都跑。** 11 个稀疏 MLA 层，每层的每个查询都要给全部完整池打分，工作量随历史长度增长，TP8 下每张卡还各算一遍。历史不超过 2051 个位置时，主 attention 没省下任何读取，indexer 这一份就是纯开销。
- **读取量和计算量有上界。** 见[稀疏什么时候才真的起作用](#稀疏什么时候才真的起作用)里的 calc。
- **位置清单要常驻显存。** 主干 11 层共用一块，MTP 层另开一块：

```calc
title: 位置清单的常驻缓冲
主干一块 = 8192 行 × 2051 列 × 4 B = 67,207,168 B ≈ 64.09 MiB
MTP 一块 = 8192 行 × 2176 列 × 4 B = 71,303,168 B ≈ 68.0 MiB
合计 = 64.09 MiB + 68.0 MiB ≈ 132.1 MiB
> 8192 是调度上限；MTP 把宽度 2051 向上取到 128 的倍数 2176
```

这两块缓冲算在模型常驻显存里，KV cache 能分到多少块见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

### 版本差异

**选位置、读位置的思路三版一致；差别在有没有 GLM 的按池 indexer，以及文件怎样组织。** 按知识库的固定快照核对：v0.23 为 Ascend 2c59ff10 维护快照，v0.26 为 Ascend 2ed6cbba，main 为 Ascend baa023ad；本页的 GLM 行为按专用镜像 db701c1f 解释。

| 检查项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| DeepSeek-V3.2 式逐位置选择 | 有：设备层调用 lightning indexer 算子，每个查询选 2048 个位置，掩码模式 3 | 同 v0.23 | 仍有通用稀疏 attention 路径 |
| GLM 的按池 indexer 与 2051 宽清单 | 维护快照没有；专用镜像 db701c1f 有 | 没有 GLM 模型文件，也没有按池的 indexer | 有：indexer 后端移到 `attention/indexer_kpool.py`，清单宽度仍是位置预算 + 每池位置数 − 1；triton 选池公式相同 |
| 稀疏 attention 内核调用 | 镜像：子类入口 → 设备算子；逐位置读取、无 RoPE、掩码模式 3 | 通用路径，掩码模式默认 3 | `sfa_v1.py` 的 `sparse_mla` 用同一组内核参数 |
| GLM 模型文件 | 镜像中为 `models/glm5_next.py` | 无 | 拆到 `models/glm5next/`，attention 文件里指定的 indexer 后端为 `Glm5NextKPoolIndexerBackend` |

main 的 GLM 从模型层一直到 `sparse_mla` 的完整调用链没有逐行核对；三个版本能否整套跑通本文的部署，也没有核验。

### 源码位置

按「谁调 indexer → indexer 怎样选 → 谁读位置 → 谁调内核」的顺序读，可以把上文的流程图对回实现：

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 父类前向：先选位置，再读位置，最后 V 解压与输出投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1972-L2028` |
| 子类把选位置交给 GLM 的 indexer | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134` |
| indexer 先压池、再选择 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1140-L1232` |
| triton 与 PyTorch 回退的分派条件 | `vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L419-L504` |
| 只给完整池打分、选池、展开、补尾，宽 2051 | `vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L23-L237` |
| 推理用的稀疏 attention 入口（子类重写） | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| 设备算子：调用稀疏 FlashAttention 内核 | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| A2 落到基础设备适配器 | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326` |
| 位置清单缓冲：主干与 MTP | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2252-L2259`；`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L64-L77` |

流程图的分支：装有 triton、在 NPU 上、输入非空、头维 128、池预算不超上限时走 triton，核内只算池分，选池、展开、补尾是同一包装函数里的 torch 操作；否则走 PyTorch 回退。读取侧执行子类重写的入口，A2 不属于 A5、310P，落到基础设备适配器。

同一文件里的 `_sparse_attention_pytorch`（`indexer_kpool_mla_v1.py` 第 857–1064 行）没有生产调用点，只有单测调用，它每 16 个查询一块的常量也不代表 NPU 内核的分块；模型文件里 `top_k_per_row_prefill`、`indexer_kpool_topk_pytorch` 等静态方法也只供单测参考。父类 `sfa_v1.py` 里同名的稀疏 attention 方法被子类重写，也不在这条路上。这些都不作为推理路径的出处。

**正文证据索引。** 密集因果 attention 的定义见 [S1]；Sparse Transformer 的结构化稀疏见 [S2]；DSA 的 indexer 公式、k = 2048、核心 attention 从 O(L²) 降到 O(Lk) 而 indexer 仍是 O(L²)、两段训练、MLA 的 MQA 模式见 [S3]；位置预算 2048 与每池 4 个位置见 [S4]。推理调用链依次为 [C5]、[C6]、[C7]、[C8]、[C9]、[C10]、[C11]、[C12]：[C9] 里只给完整池打分、其余记负无穷后填 −1、展开与尾部数的写法对应四步中的前三步；[C10] 从三份缓存里取出打包的潜向量并传掩码模式 3；[C11] 以打包缓存同时作为 key 和 value，逐位置读取、不传 RoPE。报错表的前四条在 [C10]，LSE、掩码模式与清单行数在 [C11]，最后一条在 [C5]。位置清单缓冲见 [C13] 与 [C14]。版本差异依据 [C15]、[C16]、[C17]、[C18]、[C19]、[C20]；各版本文件是否存在，是列出对应 commit 的全部文件后检索得到的。

正文算式和结论各自采用以下推导口径：

- n(n+1)/2、21 格与 15 格、四位置 softmax 例子，都是按定义直接计算的教学例子。[D]
- 直觉图的 12 个位置和 k = 4、掩码图右侧的选位规则，都是教学假设，不是 GLM 的实际选择。[A]
- 历史不超过 2051 时等于密集、133120 个位置时读 1/65，按池数与尾部公式推出，取自主线底稿 02 §5.4；133120 是部署的最大上下文长度，见底稿 02 部署表。[D]
- 计算上界、逻辑读取量与清单缓冲，取自主线底稿 02 §5.4、§5.5，按每卡 8 个头、清单宽 2051、BF16 潜向量与 int32 编号计算。[D]

**待核：** 没有固定双机上稀疏 attention 内核的设备 trace，缺算子耗时、实际分块方式和 HBM 读写量；上面的读取量与计算量都是逻辑上界。indexer 在长历史下的实际耗时占比也没有实测。
