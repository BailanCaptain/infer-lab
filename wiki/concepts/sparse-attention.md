---
id: sparse-attention
title: 稀疏注意力：先挑位置，再只读这些位置
type: concept
summary: >-
  稀疏注意力让每个查询只在因果范围内挑出的少量历史位置上做 attention；GLM 用 indexer 按 4 个位置一池打分，每个查询最多读 2051
  个位置，没选中的历史仍须全部保留。
aliases:
  - 稀疏注意力
  - Sparse Attention
  - 密集注意力
  - Dense Attention
  - 滑动窗口注意力
  - sparse mask
  - top-k 注意力
  - 稀疏 MLA 的位置选择
  - IndexCache
  - 索引缓存
  - 跨层位置复用
chapters:
  - '04'
sources:
  - 'https://arxiv.org/abs/1706.03762'
  - 'https://arxiv.org/abs/1904.10509'
  - 'https://arxiv.org/html/2512.02556v1'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1972-L2028'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1140-L1232'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L419-L504
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L23-L237
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L2317-L2326'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2252-L2259'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L64-L77'
  - 'vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L576-L719'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/device/device_op.py#L473-L612'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L119-L127'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L344-L346'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L51-L248
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L123-L177'
  - >-
    raw:sha256-bfde3167e3bb3bd1c1d300a162b2596e252c581a49d6fa337c47c72863e00bff.md#L1-L1049
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/attention/sfa_v1.py#L125-L139
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L96-L137'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L437-L476'
  - "vllm@0fc695fc:docs/features/index_cache.md#L1-L54"
  - "vllm@0fc695fc:vllm/model_executor/models/deepseek_v2.py#L999-L1074"
  - "vllm@568afb3a:vllm/model_executor/models/deepseek_v2.py#L1075-L1166"
  - "vllm@ced6857a:vllm/model_executor/models/deepseek_v2.py#L1134-L1234"
  - "vllm@84030bbe:vllm/model_executor/models/deepseek_v2.py#L1128-L1227"
  - "vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L610-L655"
  - "vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L604-L639"
  - "vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L550-L594"
  - "vllm-ascend@7d825229:vllm_ascend/attention/sfa_v1.py#L815-L866"
  - "vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L700-L751"
  - "vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L1943-L1973"
  - "vllm-ascend@2ed6cbba:vllm_ascend/attention/sfa_v1.py#L2025-L2063"
  - "vllm-ascend@7d825229:vllm_ascend/attention/sfa_v1.py#L2057-L2109"
  - "vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L1807-L1853"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2000-L2041"
  - "vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L83-L114"
  - "vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L128-L183"
  - "vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1206-L1221"
  - "vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L286-L316"
  - "vllm-ascend@7d825229:vllm_ascend/models/glm5next/mtp.py#L127-L169"
  - "vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L286-L316"
  - "vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L127-L169"
  - "vllm-ascend@7d825229:vllm_ascend/ops/mla.py#L119-L149"
  - "vllm-ascend@baa023ad:vllm_ascend/ops/mla.py#L111-L141"
  - "vllm-ascend@7d825229:vllm_ascend/spec_decode/llm_base_proposer.py#L209-L215"
  - "vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L212-L218"
  - "vllm-ascend@7d825229:vllm_ascend/spec_decode/llm_base_proposer.py#L1489-L1508"
  - "vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L1414-L1432"
  - "vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L432-L467"
  - "vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L574-L600"
  - "vllm-ascend@7d825229:vllm_ascend/models/glm5next/sparse_attn_indexer_kpool.py#L115-L155"
  - "vllm-ascend@baa023ad:vllm_ascend/models/glm5next/sparse_attn_indexer_kpool.py#L111-L147"
  - "vllm@0fc695fc:vllm/transformers_utils/config.py#L855-L860"
  - "https://arxiv.org/html/2603.12201v1"
  - "vllm@ced6857a:vllm/models/deepseek_v32/__init__.py#L15-L29"
  - "vllm@84030bbe:vllm/models/deepseek_v32/__init__.py#L15-L29"
  - "vllm-ascend@7d825229:vllm_ascend/attention/indexer.py#L175-L193"
  - "vllm-ascend@baa023ad:vllm_ascend/attention/indexer.py#L161-L179"
  - "vllm-ascend@c09d3e20:vllm_ascend/attention/sfa_v1.py#L820-L875"
  - "vllm-ascend@c09d3e20:vllm_ascend/attention/sfa_v1.py#L2105-L2140"
  - "vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L484-L525"
  - "vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/mtp.py#L127-L160"
  - "vllm-ascend@8d6180e2:vllm_ascend/attention/sfa_v1.py#L820-L880"
  - "vllm-ascend@8d6180e2:vllm_ascend/attention/sfa_v1.py#L2175-L2215"
  - "vllm-ascend@8d6180e2:vllm_ascend/attention/indexer_kpool.py#L775-L820"
  - "vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/mtp.py#L165-L195"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 评分、softmax、V 汇合和因果掩码（含掩码模式 3）都在那里讲；本页只改变哪些位置参与
  - to: mla
    kind: builds-on
    note: 主 attention 读的是 MLA 压缩后的 512 维潜向量；历史怎样压缩归 MLA 页
  - to: glm-5-3-flash
    kind: builds-on
    note: indexer 五步、压池门控与每个查询最多 2051 个位置的推导出处
  - to: one-request
    kind: builds-on
    note: R1 在第 4 站的位置清单（4 行 × 2051）逐行内容与 11 层稀疏 MLA 的形状
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-37ad68491a3103b2c6e2bf3de7a6c145276bf4de3c992b874484d267d22728b3.md
  - >-
    raw/sha256-bfde3167e3bb3bd1c1d300a162b2596e252c581a49d6fa337c47c72863e00bff.md
---

## 每个查询都要把全部历史读一遍吗？

[attention](attention-qkv.md) 里，当前位置用自己的 **query（查询向量）** 去和每个历史位置的 **key（键向量）** 打分，softmax 把这排分数换成加起来等于 1 的权重，再按权重把各位置的 **value（值向量）** 加起来。普通的 **dense attention（密集注意力）** 对因果范围内的每个位置都做一遍，因果范围就是当前位置和它之前的全部位置：历史有多长，就要读多少份 K/V、打多少个分。

**sparse attention（稀疏注意力）让每个查询先从因果范围里挑出一小部分位置，再只在这些位置上打分、做 softmax、汇合 V；没挑中的位置这一次不参与计算。**

挑哪些位置由模型决定。GLM-5.3-Flash 沿用 DeepSeek-V3.2 提出的 **DSA**（DeepSeek Sparse Attention）：先用一个很便宜的打分网络 **lightning indexer**（下文简称 indexer，也称索引器）给每个历史位置粗打一个分，按分数取最高的 k 个位置，这一步叫 **top-k**；真正算输出的那次 attention（下文称主 attention）只读这 k 个位置。

这样能少做主 attention 的读取和计算，代价是多做位置选择，而且以后可再次选中的历史必须继续保存。

```wiki-diagram
file: sparse-attention-intuition
```

图里用 12 个历史位置、k = 4 做示意。第一行是缓存里全部可见的历史，每个位置存着一份 K/V。indexer 给每个位置打一个分，深色的是分数最高的 4 个。主 attention 只读这 4 个位置的 K/V，softmax 也只在这 4 项之间分配权重。虚线格这次没被选中，但仍留在缓存里：后续重新选择时，这次落选的位置仍有机会被选中。

位置选择与主 attention 的执行是两个环节，一次调用不一定重新评分。SFA 是执行稀疏 attention 的实现路径：跳过本次 top-k 计算时，会从索引缓存取得已有的位置清单；不跳过时，由 indexer 参与本次选择。复用位置的调用仍可能更新 indexer 的历史 key，所以“跳过选择”不能概括成“整个 indexer 都不执行”。跨层复用和 GLM 的实际边界见[下面的 IndexCache](#相邻层能否沿用同一份位置清单indexcache)。

## 为什么能省，代价在哪？

先看密集 attention 要做多少工作。以没有缓存前缀、整段处理 n 个提示词位置为例，第 0 行只能看自己，第 1 行看前两个，形成下三角，共 n(n+1)/2 个「查询–键」位置对；prefill 也可以分块，不能把整段一次处理当成定义。Decode 的每个新查询要考虑可见历史，单查询工作量随长度 L 增长。若每个查询只选 k 个位置，主 attention 对 L 个查询的工作量降到 L×k 量级；DeepSeek-V3.2 报告给出 O(L²) 到 O(Lk) 的核心 attention 换算，其中 k 远小于 L。

落到 GLM，k 对应 2048 个位置，另加最多 3 个「尾部」位置；历史要多长才真正开始挑、最长时只读几分之一，见[后文](#稀疏什么时候才真的起作用)。

本页重点的 DSA 按内容选择，为此付出三笔代价：

1. **indexer 自己也要扫一遍全部历史。** 它要给每个可见位置打分，工作量仍按 L² 增长，只是它比主 attention 轻得多：头少、每头维度小，DeepSeek 原版还可用 FP8（8 位浮点）来算。所以省下的是主 attention 那一份，不是全部。
2. **历史一条也不能丢。** 落选的位置下一次还可能被选中，所以全部历史仍要留在 [KV cache](kv-cache.md) 里；indexer 还要另存一份自己的 key。读得少，不等于存得少。
3. **输出变了，模型必须为此训练过。** softmax 只在选中位置之间归一化，结果和密集 attention 不同，下一节有例子。DeepSeek-V3.2 分两段训练：先冻住其他参数、只训练 indexer，用 KL 散度（衡量两个概率分布差多远）让它的打分分布去逼近主 attention 的注意力分布；再打开 top-k 选择，训练全部参数。所以稀疏模式是模型结构的一部分，不是部署时能给任意模型打开的开关。

“必须保留全部历史”针对以后仍可能选回任意旧位置的 DSA，不是所有稀疏模式的通则。纯局部窗口不再访问窗口外位置，满足模型语义时可释放旧缓存；有全局位置等混合结构时还要分别保留。对比如下：

| 做法 | 每个查询读哪些位置 | 历史怎样存 |
|---|---|---|
| 密集 attention | 因果范围内的全部位置 | 每个位置一份 K/V |
| 按内容选的 DSA | 因果范围内挑出的一部分 | 为以后重新选择保留历史；可与 MLA 压缩叠加 |
| 纯局部窗口 | 当前窗口内的位置 | 只需保留后续仍会访问的窗口状态 |
| [MLA](mla.md) | 与选哪些位置无关，可以和稀疏叠加 | 每个位置压成一条潜向量 |
| [KDA](linear-attention.md) | 不再逐个位置读取 | 整段历史折进一个固定大小的状态 |

## 在允许的历史里再挑一次：公式与掩码

稀疏 attention 给每个查询位置 t 定一个位置集合 J(t)，只让集合里的位置参与主 attention。打分、softmax、汇合的形式都不变，只是求和范围从「因果范围内全部位置」换成 J(t)：

```text
对 j ∈ J(t)：sⱼ = qₜ · kⱼ / √dₖ
pⱼ = exp(sⱼ) / Σ_{u∈J(t)} exp(sᵤ)
oₜ = Σ_{j∈J(t)} pⱼ vⱼ
```

softmax 的分母也只包含 $J(t)$，所以限制位置通常会改变输出。这和「先算完密集 attention、再把几项结果删掉」不一样：删掉以后剩下的权重加起来不到 1，稀疏 attention 则在选中的位置之间重新归一化。看一个 4 个位置的教学例子，分数为 $[\ln 2,\; 0,\; 0,\; 0]$，只保留位置 0 和 3：

| 路径 | 分母计算 | 位置 0 权重 | 位置 1 / 2 权重 | 位置 3 权重 | 权重之和 |
|---|---|---|---|---|---|
| 密集 attention | $e^{\ln 2} + 3 e^0 = 2 + 3 = 5$ | $2 \div 5 = 0.4$ | 各 $1 \div 5 = 0.2$ | $1 \div 5 = 0.2$ | $1.0$ |
| 稀疏 attention（保留 0、3） | $e^{\ln 2} + e^0 = 2 + 1 = 3$ | $2 \div 3 \approx 0.667$ | 不参与 | $1 \div 3 \approx 0.333$ | $1.0$ |
| 反例：密集结果直删 1、2 | 沿用原分母 $5$ | $0.4$ | 删去 | $0.2$ | $0.6$（不到 1） |

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

## 相邻层能否沿用同一份位置清单：IndexCache

**IndexCache 保存 indexer 挑出的位置编号，让后面的层沿用这份清单，减少重复的 top-k 计算。** 它针对的是“多层挑出的历史位置往往相近”这一现象。沿用清单的层仍拿自己的 Q、K、V 做主 attention，随后继续本层的前馈计算；省下的工作在位置选择这一环。

用一个五层、每次选两个历史位置的示意说明。F 表示本层重新选择并保存清单，S 表示读取最近一次保存的清单。假设层序列为 F、S、S、F、S：

| 层（从 0 数） | 选择方式 | 本层使用的位置 | 本层后，清单缓冲里有什么 |
|---|---|---|---|
| 0 | F：计算分数并选出两个位置 | [1, 4] | 保存 [1, 4] |
| 1、2 | S：读取层 0 保存的清单 | 各自都用 [1, 4] | 仍是 [1, 4] |
| 3 | F：本层重新选，结果可能不同 | 假设选出 [0, 5] | 改存 [0, 5] |
| 4 | S：读取层 3 保存的清单 | [0, 5] | 仍是 [0, 5] |

原来五层各选一次，现在选择两次、复用三次，但五层的主 attention 都执行。层 1 即使使用和层 0 相同的位置，也会用自己的分数重新做 softmax，通常得到不同的权重和输出。这里假设清单对应同一批请求、同一批查询行；换请求、换行顺序或进入新一轮计算，必须由执行链重新建立正确的对应关系，不能任意读缓冲里的旧数据。

代价是复用层放弃了按本层状态重新挑选的机会。假如层 2 自己选择时最需要位置 5，沿用 [1, 4] 就会漏掉这个位置。因此复用比例和层模式要验证任务质量、吞吐与时延，不能按“少算三次”直接推出加速倍数。它也没有免除主 attention 的历史缓存：清单保存的是编号，各层仍需保留供后续选择读取的 K/V。

vLLM 官方入口以 DeepSeek-V3.2 的 DSA 实现为例。IndexCache 论文还比较了直接共享与配合训练的方案；论文中的模型、层数、GPU 和推理框架与本页 GLM 双机不同，论文速度与质量结果不能作为本部署实测。模型先具备相应的共享路径，配置才有作用，不能给任意模型加一个同名字段就得到跨层复用。

### 草稿的后几步复用，与主干跨层复用有什么区别？

[MTP](speculative-decoding.md) 是一次尝试生成多个候选 token 的草稿过程。它的另一种复用方式是在这轮草稿的第 0 步算出位置清单，后面的步骤继续使用；下一轮草稿再从第 0 步重新计算。这沿着草稿的步骤复用，而上面的 F/S 例子沿着主干的层复用。

新版 GLM 的这条草稿路径还要把第 0 步保留的查询行移到后续步骤所需的位置。即便后几步不重选位置，仍会更新 indexer 的压缩 key 和尚未凑满池的尾部状态，保证下一轮选择能够读到新增历史。各版是否接通这个入口，见[版本差异](#版本差异)；不能把新版行为套回固定 GLM 镜像。

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

按长历史的上界，一个查询在一层稀疏 MLA 里每张卡要做多少打分和汇合，可以直接从清单宽度算出来（不含 softmax、各投影和内核补齐；短历史按实际选中的位置数算）：

| 统计项（每卡 8 头、512 维潜向量） | 算式 | 上界结果 |
|---|---|---|
| $QK$ 打分乘加次数 | $8 \times 2051 \times 512$ | $\approx 8.40\text{ M}$ 次乘加 |
| $PV$ 汇合乘加次数 | $8 \times 2051 \times 512$ | $\approx 8.40\text{ M}$ 次乘加 |
| 单层合计浮点运算量 | $(8.40\text{ M} + 8.40\text{ M}) \times 2\text{ FLOP}$ | $\approx 33.6\text{ MFLOP}$ |
| 主干 11 层合计 | $11 \times 33.6\text{ MFLOP}$ | $\approx 370\text{ MFLOP}$ |

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

**DeepSeek DSA 的 IndexCache 配置入口。** 官方示例通过 `--hf-overrides` 覆盖模型配置，例如下列片段；它应并入该模型已经核对的部署命令，不能作为固定 GLM 双机的替换参数：

```bash
--hf-overrides '{"use_index_cache":true,"index_topk_freq":4}'
```

| 字段 | 所核 DeepSeek 模型消费者的缺省值 | 实际作用 |
|---|---|---|
| use_index_cache | false | 昇腾 SFA 完整选择层据此保存清单，供复用层读；按官方示例显式设 true |
| index_topk_freq | 1 | 没给显式模式时，用层号决定哪些层重新选择；1 表示每层都选，设为正整数 |
| index_skip_topk_offset | 2 | 频率方式中先保留的完整选择层数；官方简表未列这个消费者默认 |
| index_topk_pattern | None | 一旦非 None，就优先于频率；对应位置为大写 S 时复用，其余情况不跳过 |

频率不是简单地从第 0 层开始写 F、S、S、S。默认偏移为 2、频率为 4 时，判定整数按 $\max(\text{层号} - 2 + 1,\; 0) = \max(\text{层号} - 1,\; 0)$ 计算，除以 4 余数为 0 才重新选择（层号从 0 数）：

| 层号（从 0 数） | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| 判定整数 $\max(l - 1, 0)$ | 0 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| 除以 4 的余数 | 0 | 0 | 1 | 2 | 3 | 0 | 1 | 2 | 3 | 0 |
| 行为（`F` 重选 / `S` 复用） | F | F | S | S | S | F | S | S | S | F |

前十层合计重新选择 4 次（第 0、1、5、9 层）、复用 6 次（$10 - 4 = 6$）。

显式模式应使用与主干层对应的 F/S 字符串，并在需要共享的一段前先安排 F，让清单先被写入。所核消费者没有替用户完整校验模式：小写 s 不会触发共享，超出字符串长度的层恢复为完整选择；长度、首层和质量都需要调用方检查。模型选出 S 层与后端保存清单是两件事：DeepSeek 构造函数读取频率与模式时没有用 use_index_cache 作守卫，这不意味着可以省去负责发布清单的开关。

MTP 的步间共享另读草稿模型配置的 `index_share_for_mtp_iteration`，所核新版 proposer 默认 false。需要模型暴露切换与清单行整理入口，不能只看参数能否被配置系统接收。固定 GLM 镜像的模型没有接通这一切换；rc2/main 的 GLM 才在本页所核链路中接通，详见下表。

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

IndexCache 还有两处初始化检查：没有 indexer 却要求完整选择会报 `Indexer is required for DSA unless skip_topk is enabled.`；没有 indexer、打算复用，但没提供清单缓冲，也会报缺少 topk_indices_buffer。这只检查对象是否齐全，不验证缓冲中的每一行是否已由正确请求写入。遇到错误时要先查模型类型、F/S 模式、共享缓冲和实际后端，不能只补一个空缓冲绕过。

### 开销和什么时候别开

这个模型不能关掉稀疏：它的权重是按稀疏方式训练的。能看的是开销落在哪里。

- **固定 GLM 镜像的 indexer 每层都跑。** 11 个稀疏 MLA 层，每层的每个查询都要给全部完整池打分，工作量随历史长度增长，TP8 下每张卡还各算一遍。历史不超过 2051 个位置时，主 attention 没省下任何读取，indexer 这一份就是纯开销。前面的 DeepSeek 跨层共享配置不能改变这个专用 GLM 构造路径。
- **读取量和计算量有上界。** 见[稀疏什么时候才真的起作用](#稀疏什么时候才真的起作用)里的表格算例。
- **位置清单要常驻显存。** 主干 11 层共用一块，MTP 层另开一块（8192 是调度上限；MTP 把宽度 2051 向上取到 128 的倍数 2176，编号为 `int32` 各占 4 B）：

| 缓冲归属 | 形状与元素字节 | 字节数 | MiB |
|---|---|---|---|
| 主干 11 层共用 | $8192 \times 2051 \times 4\text{ B}$ | $67{,}207{,}168\text{ B}$ | $\approx 64.09\text{ MiB}$ |
| MTP 草稿层 | $8192 \times 2176 \times 4\text{ B}$ | $71{,}303{,}168\text{ B}$ | $\approx 68.0\text{ MiB}$ |
| 合计 | $64.09\text{ MiB} + 68.0\text{ MiB}$ | $138{,}510{,}336\text{ B}$ | $\approx 132.1\text{ MiB}$ |

这两块缓冲算在模型常驻显存里，KV cache 能分到多少块见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）的 GLM KPool 继续先选池、再展开位置，缓存职责明确拆离。** `models/glm5next/attention.py` 为完成池构造 BF16 的索引缓存，为未完成池构造 FP32 的 K/gate 环形尾状态；`indexer_kpool.py` 的 `Glm5NextKPoolIndexerBackend` 独立于标准 SFA indexer，要求 NoPE 查询（`qk_rope_head_dim == 0`）。关键演进在于上下文并行：**`v0.30.0` 明确拒绝 PCP 与 DCP；`main` 放开了 PCP（支持行分片通信与 `pcp_local_token_count`，并在建层阶段为行交换预留共享工作区、保持 `wk_weights_proj` 为 ND 不转 NZ），目前仅继续拒绝 DCP。** 普通 SFA 的复制索引 DCP 路径仍不能推广到 GLM KPool。

因此，本文“先筛候选、再对候选算 attention”的推演仍适用；旧镜像 `db701c1f` 的缓存类名、槽位组织与每 token 预算保留历史绑定版本标签。新版模型侧索引调用经 `IndexerWrapper` 进入专用后端，不能直接调用模型 `Indexer.forward`。

**四版本核验矩阵（本页 GLM 双机算例固定于专用镜像 `db701c1f`；上游 DeepSeek 消费者对照 `0fc695fc` / `568afb3a` / `ced6857a` / `84030bbe`）：**

| 检查项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| DeepSeek-V3.2 式逐位置选择 | 设备层调用 lightning indexer，预算 2048、掩码模式 3 | 同 `v0.23.0` | 通用 DSA 路径 + `sfa_v1.py` | 同 `v0.30.0` |
| GLM 按池 indexer 与 CP 边界 | 维护快照无；镜像 `db701c1f` 有 2051 宽清单 | 无 GLM 模型与按池 indexer | `Glm5NextKPoolIndexerBackend`，拒绝 PCP 与 DCP | 同后端但**新增 PCP 行分片支持**，仅拒绝 DCP，且 `wk_weights_proj` 跳过转 NZ |
| 稀疏 attention 内核调用 | 镜像经子类入口到设备算子，无 RoPE、掩码模式 3 | 通用路径，掩码模式默认 3 | 模型 indexer 与 SFA 执行分离（`sparse_mode=3`） | 同 `v0.30.0` |
| GLM 模型文件 | 镜像为 `models/glm5_next.py` | 无 | `models/glm5next/` | 同 `v0.30.0` |
| Ascend DeepSeek 的 F/S 生成 | 频率 1、偏移 2、模式 None；模式优先 | 同 `v0.23.0` | 同 `v0.23.0`；NPU 入口回到 `deepseek_v2` 消费者 | 同 `v0.30.0` |
| DeepSeek 主干 S 层是否构造 indexer | 仍构造，选择时跳过 | 不构造；MTP 保留 indexer 且初始不跳 | 同 `v0.26.0rc` | 同 `v0.26.0rc` |
| SFA 保存与读取共享位置 | 按 `use_index_cache` 保存，S 层读取 | 同 `v0.23.0` | 保留；区分静态共享层与运行时 MTP 共享（`skip_indexer_pre_process`） | 同 `v0.30.0` |
| GLM 主干跨层复用 | 镜像未接入，默认不跳 top-k | 无此路径 | 构造时明确不跳，不读取 DeepSeek 主干模式 | 同 `v0.30.0` |
| GLM MTP 步间共享 | 镜像无切换入口 | 无此路径 | `set_skip_topk` 接通：默认 false，开启后第 0 步重选、后续步复用并整理行，仍更新压缩 key 与尾部 | 同 `v0.30.0` |

`v0.30.0` 与 `main` 的上游 DeepSeek 注册入口会按平台选择实现：CUDA 使用新的模型目录，其余平台回到 `deepseek_v2`；所列 Ascend 平台使用后者。各版本能否在固定双机整套跑通、共享后的精度和性能，仍需设备验证。

两个维护快照在通用稀疏路径上都按实际 KV 数据类型选择量化算子。v0.23 维护分支的量化路径委托对应算子后直接返回；非量化路径得到元组时，才解包并调用格式化辅助函数。v0.26 分支则把量化或非量化算子的结果交给共同的返回逻辑：结果为元组时，按调用方是否请求 LSE（注意力归一化所用指数和的对数）返回整个元组或首项。两处所述返回逻辑遇到非元组时，若请求了 LSE 就报错，未请求才直接返回。这些分支条件只描述所列快照的通用路径，不决定 GLM 按池路径的支持范围或默认值，也不等于两个版本的输出语义不同。

### 源码位置

IndexCache 的官方入口见来源 25；DeepSeek 四版频率、偏移、模式优先级及 MTP 构造例外见 26–29。SFA 的开关、初始化守卫和选择后保存/复用见 30–38 及既有来源 5；模型选 S 和后端保存的职责要合起来读。rc2/main 的平台分派见 59–60，通用 DSA indexer 不自行保留上游共享缓冲的适配见 61–62。

固定 GLM 的构造、包装、MTP 模型和 proposer 条件见 39–42；新版 GLM 构造与 MTP 切换见 43–46，包装到后端的属性传递见 47–48，草稿配置默认和第 0 步/后续步调用见 49–52。结果写入与共享时继续更新历史的证据是 53–56。配置覆盖入口见 57，论文机制与实验适用范围见 58。五层 F/S 表和前十层频率演算是教学示例；它们没有测量设备耗时，也没有给固定 GLM 开启跨层共享。

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

**正文证据索引。** 密集因果 attention 的定义见 [S1]；Sparse Transformer 的结构化稀疏见 [S2]；DSA 的 indexer 公式、k = 2048、核心 attention 从 O(L²) 降到 O(Lk) 而 indexer 仍是 O(L²)、两段训练、MLA 的 MQA 模式见 [S3]；位置预算 2048 与每池 4 个位置见 [S4]。推理调用链依次为 [C5]、[C6]、[C7]、[C8]、[C9]、[C10]、[C11]、[C12]：来源 9 里只给完整池打分、其余记负无穷后填 −1、展开与尾部数的写法对应四步中的前三步；[C10] 从三份缓存里取出打包的潜向量并传掩码模式 3；[C11] 以打包缓存同时作为 key 和 value，逐位置读取、不传 RoPE。报错表的前四条在 [C10]，LSE、掩码模式与清单行数在 [C11]，最后一条在 [C5]。位置清单缓冲见 [C13] 与 [C14]。版本差异依据 [C15]、[C16]、[C17]、[C18]、[C19]、[C20]；各版本文件是否存在，是列出对应 commit 的全部文件后检索得到的。

正文算式和结论各自采用以下推导口径：

- n(n+1)/2、21 格与 15 格、四位置 softmax 例子，都是按定义直接计算的教学例子。[D]
- 直觉图的 12 个位置和 k = 4、掩码图右侧的选位规则，都是教学假设，不是 GLM 的实际选择。[A]
- 历史不超过 2051 时等于密集、133120 个位置时读 1/65，按来源 9 的池数与尾部公式推出；133120 是[固定 GLM 部署](../sources/glm-5-3-flash-baseline.md)的最大上下文长度。[D]
- 计算上界、逻辑读取量与清单缓冲，按每卡 8 个头、清单宽 2051、BF16 潜向量与 int32 编号计算；潜向量接口见来源 11，主干与 MTP 缓冲分配及对齐见来源 13–14。[D]

专用镜像的 GLM MTP 路径还会将位置清单的缓冲宽度向上对齐到 128 的整数倍。因此，上述清单宽度的计算口径与 MTP 路径分配缓冲区时采用的对齐宽度需要区分。

**实测边界：** 没有固定双机上稀疏 attention 内核的设备 trace，缺算子耗时、实际分块方式和 HBM 读写量；上面的读取量与计算量都是逻辑上界。indexer 在长历史下的实际耗时占比也没有实测。

**位置清单与版本边界。**

固定 GLM 的 SFA 分支在 skip_topk 为真时读取索引缓存，为假时要求 indexer 存在（来源 5）。专用模型构造及包装没有传入跳过条件，MTP 模型也没有供 proposer 调用的 set_skip_topk；所以这份固定实现并不因共享缓冲存在就跨层或跨草稿步复用。rc2/main 的 GLM MTP 通过模型切换入口、包装属性和 SFA 执行分支接通步间共享，索引结果确实写入后续读取的同一缓冲；使用时仍须核对行整理、模式和设备实测，不能仅据父类有分支推断生效。


后续 main 的一条 A5 稀疏 MLA 路径还会把已选中的 token 位置升序排列，将无效占位移到末尾，再恢复为 -1。排序保持选中的位置集合，目的是配合 DMA 合并相邻列；它没有重新计算 Top-K，也不单凭这段代码保证实际加速。

2c59ff10 的量化分支直接返回；2ed6cbba 的量化和非量化分支汇合到共同返回逻辑，非元组结果与请求 LSE 的组合会报错（来源 15–16）。各量化算子的内部返回结构、GLM 按池路径的支持范围与双机运行结果仍须分别验证。

固定 GLM 的 MTP 位置清单缓冲区按 index_topk + index_kpool − 1 计算宽度，再向上对齐到 128 的整数倍（来源 14）。对齐增加的是分配宽度，不是多选了历史位置；该规则只对应这里的专用实现。

- 来源 22：vllm-ascend@baa023ad，vllm_ascend/attention/sfa_v1.py，L125–L139。
- `v0.30.0`（`c09d3e20`）的 SFA 守卫、前向跳过/保存分支、`Glm5NextKPoolIndexerBackend` 拒绝 PCP/DCP 与 MTP `set_skip_topk` 见来源 63–66；`main`（`8d6180e2`）的对应入口及放开 PCP、保留 ND 与行交换缓冲预留见来源 67–70。
