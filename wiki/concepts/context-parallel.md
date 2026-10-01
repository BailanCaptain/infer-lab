---
id: context-parallel
title: 上下文并行（CP）：位置分工与注意力结果合并
type: feature
summary: 从密集因果注意力的跨位置依赖解释 PCP 与 DCP，推导局部 softmax 输出的合并，并明确 GLM 混合注意力的支持边界。
aliases: [Context Parallel, 上下文并行, CP, PCP, DCP, Prefill Context Parallel, Decode Context Parallel, 前缀上下文并行, 解码上下文并行, prefill_context_parallel_size, decode_context_parallel_size, cp_kv_cache_interleave_size, enable_cp, enable_dcp, enable_pcp, AscendAttentionCPImpl, AscendMlaCPImpl, AscendAttentionDCPImpl]
chapters: ["15"]
order: 20
sources:
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L9-L50
  - vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L663-L721
  - vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L751-L780
  - vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L231-L282
  - vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L111-L130
  - vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L186-L197
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1774-L1794
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L403
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L114-L136
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L717-L752
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L508-L509
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L702-L729
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/context_parallel.md#L66-L103
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L348-L356
  - vllm@0fc695fc:vllm/config/parallel.py#L110-L120
  - vllm@0fc695fc:vllm/config/parallel.py#L320-L346
  - vllm@0fc695fc:vllm/config/parallel.py#L774-L782
  - vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L120-L128
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L336-L344
  - vllm-ascend@baa023ad:vllm_ascend/attention/utils.py#L195-L206
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1490-L1500
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L51-L77
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L78-L123
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L124-L172
  - vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L310-L320
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L125-L131
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L726-L762
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L204-L210
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1513-L1525
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L448-L453
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 先理解完整的评分、softmax 与 V 汇合}
  - {to: collective-communication, kind: builds-on, note: 理解交换、收集与归约}
  - {to: block-table, kind: builds-on, note: 理解逻辑位置与物理存储槽位}
  - {to: sequence-parallel, kind: builds-on, note: 区分局部激活分片与跨位置注意力}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 上下文并行是什么？

推理时，每个新位置都要回头看它前面所有位置留下的 K 和 V（key 供匹配、value 是要取回的内容，见 [attention](attention-qkv.md)），这份存下来的历史叫 [KV cache](kv-cache.md)。位置越靠后，要看的历史越长：一份 12 万 token 的长文档，光是这一条请求的历史，每张卡上就要实打实占一块显存（GLM 这套部署下的具体数字见[后面一节](#放到-glm-双机这套部署开了-cp-吗)），第一步把整篇算一遍也要等很久。

**context parallel（CP，上下文并行）把同一条请求的历史位置分给几张卡：每张卡只存、只算其中一部分，再把各自算出的局部结果合并成一份完整答案。** 名字里的「上下文」指的就是一条请求的位置这一维。

举个例子（示意）：一条请求已经攒了 8 个位置的历史，两张卡。卡 0 拿位置 0、2、4、6，卡 1 拿 1、3、5、7。新来的查询在两张卡上各算一次：卡 0 只用自己这 4 个位置算出一个局部结果，卡 1 也是；最后把两个局部结果按各自占的分量合起来，得到的答案和一张卡看完 8 个位置算出来的一样。

```wiki-diagram
file: context-parallel-intuition
```

CP 是两条路线共用的名字，它们切的东西不同：

| | 切什么 | 卡数 | 想解决的问题 |
|---|---|---|---|
| PCP（prefill context parallel） | prefill（把输入一次性算完的那一步）里的查询位置和它们的计算，写下来的 KV 也跟着按位置分存 | 另外加卡，参与的总卡数变大 | 第一个字出来得太慢 |
| DCP（decode context parallel） | 已经写进 KV cache 的历史位置 | 不加卡，借 TP 那一组卡 | 每张卡重复存了同一份 KV |

这是 vllm-ascend 这套实现的分法：PCP 扩执行设备的维度，DCP 复用 TP 的设备减少重复存储。别的 CP 算法不一定这么分。

同样在位置这一维上动刀的还有[序列并行（SP）](sequence-parallel.md)，两者不是一回事：SP 切的是一层里逐 token 独立那几步的中间结果，算完马上拼回全长，不碰历史；CP 切的是历史本身，以及读它的那次 attention。

## 为什么需要它，代价是什么？

长请求同时带来两种压力：

- **第一步算得久。** 因果注意力里，位置 i 要和 0 到 i 的每个历史位置配一次，长度翻倍，prefill 要算的组合数大约翻四倍，第一个字的等待时间几乎全花在这里。往后每吐一个字只新算一个位置，计算量不大，可它仍要把那条长历史整个读一遍。
- **历史存不下，还可能存了好几份。** 历史随长度线性增长；更麻烦的是张量并行（TP）在有些层切不开 KV——[MLA](mla.md) 只有一个 KV 头，TP 组里每张卡只能各存一份完全相同的历史。长请求把这份重复乘上了长度。

CP 对着这两件事各出一招：PCP 加卡一起分算 prefill，DCP 不加卡、把重复的那几份拆成互不重叠的几段。

代价也有两处，后面几节会具体看到：**卡之间要多传东西**（交换查询、交换局部结果，或者逐层把 KV 收集齐），以及**布局要对齐**（长度要补齐、每个位置要按规则落到某张卡、恢复原顺序还要另记一份下标）。请求不长、批不大时，这些固定开销可能比省下来的还多。

## prefill 的位置怎么分才公平？

[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)让每个位置的工作量都不一样：位置 0 只有 1 个可见的键，位置 7 有 8 个。所以按前后对半分，两张卡的活差得很远：

```calc
title: 长度 8 的因果序列，两种切法各分到多少
全部合法的查询–键组合 = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 = 36 对
对半切 · 卡 0（位置 0–3） = 1 + 2 + 3 + 4 = 10 对
对半切 · 卡 1（位置 4–7） = 5 + 6 + 7 + 8 = 26 对
头尾配对 · 卡 0（位置 0、1、6、7） = 1 + 2 + 7 + 8 = 18 对
头尾配对 · 卡 1（位置 2、3、4、5） = 3 + 4 + 5 + 6 = 18 对
```

```wiki-diagram
file: context-parallel-prefill
```

PCP 用的就是后一种切法：先把这条请求的长度补齐到 2 × PCP 的整数倍，切成 2 × PCP 段，第一段配最后一段、第二段配倒数第二段，依此类推，每张卡拿到一头一尾两段，工作量就接近相等了。补齐了多少、怎么恢复原来的顺序，另外记一份下标，收集结果时按它还原。

**分到哪些查询，不等于只读那一段历史。** 位置 7 仍然要看 0–6 的 K 和 V。切分改变的是「谁来算」，不是「能看见什么」；本地缺的历史靠卡间交换补上，因果掩码一个位置都没放宽。

## 历史位置怎么分着存？

写 KV cache 时不是「卡 0 存前半段、卡 1 存后半段」，而是按位置轮流放：第 0 个位置给第 0 张卡，第 1 个给第 1 张，轮完再回到第 0 张。轮换的粒度默认是 1 个位置。

```wiki-diagram
file: context-parallel
```

这件事 PCP 和 DCP 一视同仁：参与分存的卡数是 PCP × DCP，两条路一起开时按这个乘积轮换。每张卡跑的是同一份[块表](block-table.md)、同一段代码，区别只在于一个位置该落在谁手里——这是算出来的：先把这几张卡的块拼成一个「虚拟块」（大小 = 块大小 × PCP × DCP），看这个位置落在虚拟块里的第几格，就知道它归谁、在本地的哪一格。不归本卡的位置，槽位号填 −1，这一步就跳过不写。

粒度可以改粗，改成一次轮一整块。要把 KV 整块传给别的机器时（[PD 分离](pd-disaggregation.md)、KV 池），必须这么设，否则接收方对不上；GLM 这类稀疏模型的 CP 路径也要求粒度等于块大小。

## 每张卡只有一段历史，结果怎么合成一份？

每张卡照样能为同一个查询算出一个结果，只不过那是「只看本地这一段历史」的答案。问题在于：**这些局部结果不能直接相加，也不能直接平均。** attention 的 softmax 要除以所有参与位置的指数和，而各卡的分母里只有自己那一段，分量天然对不齐。

办法是每张卡交出局部结果时，顺带交出一个记录「我这一段占了多大分量」的数：把本地各位置的评分取指数加起来记作 Z，局部输出 O 就是按 Z 归一化后的加权和。为了数值稳定，实际保存的是 log Z，叫 log-sum-exp（LSE）。合并时先把各段的 LSE 并成全局的 L = log(Σ exp(Lᵣ))，也就是 log(Z₀ + Z₁)——不是把几个 L 相加；再用 exp(Lᵣ − L) 作权重，把各段的 O 加权相加。把指数展开就能看出，这个权重正好等于 Zᵣ ÷ (Z₀ + Z₁)：

```calc
title: 两段历史的局部结果怎么合成一份（数为示意，公式是真的）
分区 0 的指数和 Z₀ = 2
分区 1 的指数和 Z₁ = 6
全局分母 = Z₀ + Z₁ = 2 + 6 = 8
分区 0 的权重 exp(L₀ − L) = 2 ÷ 8 = ¼
分区 1 的权重 exp(L₁ − L) = 6 ÷ 8 = ¾
合并结果 O = ¼ × 10 + ¾ × 30 = 2.5 + 22.5 = 25
> 两段的局部输出分别是 O₀ = 10、O₁ = 30。直接相加得 40、直接平均得 20，都不对。输出是向量时，每个分量用同一组权重
```

```wiki-diagram
file: context-parallel-merge
```

合并成立是有前提的：各段说的必须是同一个查询、同一个头，评分和掩码的定义一致，而且几段合起来正好覆盖这个查询该看的全部历史，不重不漏。实现上，各卡把局部输出和 LSE 拼成一份一起发：DCP 这一轴用 [All-to-All](collective-communication.md#all-to-all) 交换，PCP 这一轴再做一次 [All-Gather](collective-communication.md#all-gather)，然后按上面的公式更新。

上面这套「各算各的、再合并」说的是 **decode**（一次吐一个字）那一步：先在组内把查询的各个头收齐，各卡拿本地历史算出局部结果和 LSE，交换后合并，完整的 KV 自始至终没有在任何一张卡上出现过。

**prefill 那一步，MLA 这一类后端（GLM 的稀疏 MLA 也在内）反过来，搬的是 KV 本身：**

- PCP 的普通 prefill（不分块）各后端一样：逐层把这一层的 KV 收齐再算，用完立刻扔掉，不留着占显存；到了分块 prefill 才分路，MLA 后端收 KV，GQA 后端改成收查询；
- DCP 碰上[分块 prefill](chunked-prefill.md) 时，MLA 后端先把上下文的 KV 收齐（稀疏那条路只收稀疏索引点到的那些块），收完直接算，既不收查询，也不做上面这套 LSE 合并；GQA 后端仍旧收查询、各算各的再合并，和 decode 那条路一样。

所以「CP 搬的是结果还是 KV」既要看这一步是 decode 还是 prefill，也要看用的是哪种 attention 后端，一句话概括不了。

## 复用 TP 的卡，为什么还要建通信组？

DCP 借的是 TP 已有的卡，参与的总卡数不变，但仍然要照常建一个通信组：一个 TP 组被拆成若干个 DCP 组，交换局部结果走的就是这个组。所以「复用 TP 的卡」不等于「不用建通信组」。TP 里的第几张卡、DCP 里的第几张卡、物理上的第几张卡，也是三个不同的下标，读日志和配置时不能混着看。

还有一点常被想当然：**不能把一张卡上的所有缓存统一除以 DCP 的卡数。** 按位置切的只是那部分随长度增长的历史；稀疏路径的索引状态、别的 attention 形式的状态（比如 [KDA](linear-attention.md) 那种固定大小的递推状态）以及临时缓冲，各有各的复制或分片方式，有的反而是每张卡各留一整份。

## 放到 GLM 双机：这套部署开了 CP 吗？

部署是两台 Atlas 800 A2、每台 8 卡，TP8、DP2、EP16，W8A8 量化，完整前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**没有开：PCP = 1、DCP = 1。** 官方启动命令没有传这两个参数，上游默认值都是 1；起卡时建的并行组也是按 pcp=1、dcp=1 初始化的，参与一次 attention 的就是 TP 的那 8 张卡（MoE 另按 EP16 跨两机派发）。所以这套部署上没有 CP 的实测数据。

不过 DCP 想消掉的那种重复，GLM 身上确实存在：11 层稀疏 MLA 加上 MTP 层，KV 只有一个头，TP8 的 8 张卡各存一份**完全相同**的历史（见 [MLA](mla.md)、[TP 页的这一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)）。每个 token 每张卡要存 13,056 B，也就是 12 层各 1024 B 的主 KV 加 64 B 的索引器；一条满长 133,120 token 的请求就是 1.619 GiB，每张卡都一样（推导见 [KV cache](kv-cache.md)）。

**DCP 能省到什么量级？** 平台层认得这类稀疏模型，也定好了布局：主 KV 按位置分片，负责挑历史位置的那套索引每张卡各留一整份（它要看完整的序列，才能挑出和不开 DCP 时同样的位置），并且要求 DCP 等于 TP。但这套布局是给另一族稀疏 attention 后端写的，GLM 用的 kpool 索引器在固定版本里没有这份代码（见下面第二道门）。所以下面只是「照那套布局做能省多少」的量级示意，不是这套部署能开出来的结果：

```calc
title: 照「主 KV 分片、索引复制」的布局把 DCP 开到 8 能省多少（量级示意：本模型没有这份实现，也没有实测）
主 KV 每 token 每层（分给 8 张卡） = 1024 B ÷ 8 = 128 B
索引每 token 每层（每张卡各留一份） = 64 B
12 层每 token 每卡 = 12 × (128 + 64) = 2,304 B
满长请求 133,120 token = 133,120 × 2,304 B = 306,708,480 B ≈ 292.5 MiB（每卡）
> 这条账只算随长度增长的主 KV 和索引，不含每条请求固定大小的状态和临时缓冲——它们未必按位置切
```

在固定版本上真要开 CP，会先撞上三道门：

- **PCP 这条路对 GLM 是关着的。** 34 层 KDA 的 prefill 在 PCP 大于 1 时直接抛 NotImplementedError。别的模型能用 PCP，不等于这个混合模型能用。
- **DCP 这条路，平台层放行了，模型这一层还没实现。** 平台校验按配置认出这是稀疏模型（有 index_topk、没有 compress_ratios），在 PCP = 1、DCP > 1 时切到「主 KV 分片、索引复制」的布局，要求 DCP 等于 TP、轮换粒度等于块大小（粒度配错会被就地改成块大小，只留一条 warning）。但那套布局是给另一族稀疏 attention 后端写的；GLM 用的 kpool 索引器（把相邻位置的索引键压成一条再挑，见[稀疏 attention](sparse-attention.md)）在固定版本的模型、attention 后端、算子三处实现里都没有出现 PCP/DCP 的处理，main 上更是直接抛 NotImplementedError，信息写明 KPool 索引不支持 PCP 或 DCP。
- **开着[前缀缓存](prefix-caching.md)时，上游还有一道。** KV cache 分成多组（GLM 正是稀疏 MLA 与 KDA 两类）时用的那个协调器，要求 DCP、PCP 都是 1。

所以 GLM 的双机主线继续用[官方的 TP/DP 配置](../sources/glm-5-3-flash-baseline.md)，本库不把没验证过的 CP 组合写进部署命令；真要开，上面三条得逐条核过。

## 常见误解

- **「CP 就是 SP，换个说法而已。」** SP 切的是一层里逐 token 独立那几步的中间结果，算完立刻拼回全长；CP 切的是历史本身和读它的那次 attention，每张卡长期只持有一部分。
- **「开了 DCP，attention 每一步都要先把 KV 凑齐。」** decode 那一步不用，凑的是局部结果和 LSE；但 MLA 后端的分块 prefill 确实要把上下文的 KV 收齐（稀疏那条路只收被挑中的块）。反过来记成「DCP 永远不搬 KV」同样不对。
- **「局部结果加起来或者平均一下就行。」** 各段的 softmax 分母不同，必须按 LSE 换算权重；上面那个例子的答案是 25，不是 40 也不是 20。
- **「DCP 复用 TP 的卡，所以不用建通信组。」** 组照建，只是不新增卡；TP rank、DCP rank 和物理卡号是三个下标。
- **「开了 DCP，每张卡的显存就除以 DCP。」** 只有按位置切的那部分历史会除；索引状态、递推状态和临时缓冲各有各的算法，有的每张卡各留一整份。
- **「分到哪些查询，就只读哪一段历史。」** 位置越靠后要看的历史越多，本地缺的靠交换补齐，可见范围和不切时一模一样。

## 对照源码

### 怎么开

两个开关分别管两条路：`--prefill-context-parallel-size`（PCP）和 `--decode-context-parallel-size`（DCP），上游默认都是 1 [C15][C16]；轮换粒度是 `--cp-kv-cache-interleave-size`，默认同样是 1。PCP 要额外的卡：参与的总卡数按 pipeline × tensor × pcp 算 [C17]。DCP 不改总卡数，只把一个 TP 组拆成 tp ÷ dcp 个 DCP 组，所以 dcp 不能超过 tp，而且要能整除 [C7]。

DCP 的上限按 attention 形式分 [S13]：MLA 类要求 tp ≥ dcp 且 tp % dcp == 0；GQA 类把 tp 换成 tp ÷ kv 头数，再套同样两条。稀疏路径另有一套：dcp == tp，而且轮换粒度要等于块大小 [S23]。要做 KV 传输（PD 分离、KV 池）时，粒度同样必须等于块大小。

### 会报什么错

- **PCP 与 DP 同开**：固定版本在 dp > 1 且 pcp > 1 时抛错，信息写明 PCP 和 DP 不能一起用 [C14]。
- **GLM 的 KDA prefill 遇上 PCP**：抛 NotImplementedError，信息是 `Kimi KDA prefill does not yet support PCP.`。
- **稀疏路径的 DCP 不等于 TP**：抛 ValueError，信息写明只支持 dcp_size 等于 tp_size [C10]。
- **轮换粒度和块大小不一致**：稀疏路径下不报错，只打一条 warning，随后把粒度就地改成块大小 `[!]`——不翻日志就看不出配置被换过。
- **开着前缀缓存的混合模型**：上游协调器里有 `assert dcp_world_size == 1, "DCP not support hybrid attn now."`，PCP 同样一条；这个协调器只在开前缀缓存、且 KV cache 分成多组时才用 [C11][C12]。
- **main 上给 GLM 开 CP**：KPool 索引直接抛 `NotImplementedError("GLM-Next KPool indexing does not support PCP or DCP.")` [C25]。
- **投机解码的草稿模型加 DCP**：另有一组按草稿模型的 TP 和 KV 头数算出的上限，见 [Ascend 平台校验](npu-platform.md)。

### 开销和什么时候别开

- **短请求别开。** [示例请求 R1](one-request.md) 一步只有 4 个 token，历史才十几个块，切开省不下什么，补齐和交换的固定开销反而更显眼。
- **PCP 的代价是加卡和逐层收集。** 非分块 prefill 每层做一次 KV 的 All-Gather，用完即扔；[分块 prefill](chunked-prefill.md) 在 GQA 后端改成收集 Q，在 MLA 后端收集 KV 并分段处理，以免峰值显存过高 [S24]。
- **收益主要在第一个字。** 官方在 DeepSeek-R1-W8A8、64 卡 PD 分离环境下测过 128K 输入：PCP2 + DCP8 把 TTFT 从 73.2 秒降到 46.0 秒，每字时延 82 毫秒对 83 毫秒，基本没变 [S13]。这是官方在别的模型上的数，不是本部署的结果。
- **DCP 的代价是交换和合并，prefill 那一侧还要收 KV。** decode 路上先按头维收集 Q，各卡用本地历史算出局部输出和 LSE，再交换、合并 [C6]；分块 prefill 上，MLA 后端改为收齐上下文 KV，稀疏路径只把稀疏块表点到的块收过来，不收 Q、也不做 LSE 合并，GQA 后端则仍走收 Q 那条 [S22]。省的是重复的 KV，付的是每步多几次通信和一次合并。
- **Ring Attention 没有采用。** 设计文档写明是评估后的取舍：开发复杂度高、重叠收益有限 [S24]。

### 版本差异

| 项 | v0.23 维护分支 | 固定版本（含 GLM 代码） | v0.26 | main |
|---|---|---|---|---|
| 开关函数 | `enable_cp()`，一个管两件事 [C18] | 同 v0.23 | 只剩 `enable_dcp()` | `enable_dcp()` 与 `enable_pcp()` 分开 [C20] |
| PCP 什么时候被拦 | dp > 1 时才拦 | 同 v0.23 | 不在 V2 模型执行器上就抛错，信息写死「not supported by vLLM Ascend」[C19] `[!]` | 同一条判定还在 [C21] |
| KDA prefill 遇上 PCP | 分支里没有 GLM 代码 | 抛 NotImplementedError [C8] | 同左 | 这条检查已经不在，PCP 改由 kpool 索引和平台层拦下 |
| 稀疏路径的 DCP 怎么判定 | 无 | 稀疏、DCP > 1 且 PCP = 1 [C9] | 去掉 PCP = 1 这一条，只看「稀疏且 DCP > 1」[C26] | 同 v0.26 [C28] |
| 稀疏路径的 DCP 能取哪些值 | 无 | dcp == tp | 同左；走复制索引时不再强制粒度 = 块大小 [C27] | dcp 可取 pcp，或 tp × pcp [C29] |
| GLM 的 kpool 索引器 | 无 | 模型、后端、算子三处都没有 CP 处理 | 分支里没有 GLM 代码 | 直接拒绝 PCP 与 DCP |

照着一个版本的文档去配另一个版本，大概率出错：同一条命令在 v0.23 上能跑，到 v0.26 得先切到 V2 模型执行器。

### 源码位置

| 看什么 | 去哪 |
|---|---|
| 设计说明：PCP/DCP 分工、交错存放、头尾配对、Ring Attention 的取舍 | vllm-ascend 的 CP 设计文档 |
| 用法、约束与官方实测表 | vllm-ascend 的 CP 用户指南 |
| 位置落到哪张卡、不归本卡的槽位填 −1 | `vllm_ascend/worker/block_table.py` |
| 头尾配对的切分与恢复下标 | `vllm_ascend/worker/pcp_utils.py` |
| 交换局部输出与 LSE、按公式合并 | `vllm_ascend/attention/context_parallel/common_cp.py` |
| DCP、PCP 的通信组怎么建 | 上游 `vllm/distributed/parallel_state.py` |
| 参数默认值与总卡数公式 | 上游 `vllm/config/parallel.py` |
| GLM 稀疏路径的 DCP 判定与平台校验 | `vllm_ascend/utils.py`、`vllm_ascend/platform.py` |
| KDA prefill 拒绝 PCP | `vllm_ascend/ops/kimi_kda.py` |
| GLM kpool 索引器与 CP | 固定版本的 `models/glm5_next.py`、`attention/indexer_kpool_mla_v1.py`、`ops/indexer_kpool_mla.py` 里没有 CP 处理；main 的 `attention/indexer_kpool.py` 明确拒绝 |
| 混合 KV cache 协调器的限制 | 上游 `vllm/v1/core/kv_cache_coordinator.py` |
| 三个版本的开关函数 | `vllm_ascend/attention/utils.py` |

正文里几条不是直接读一处源码得到的，出处如下：

- 本部署 PCP = DCP = 1：启动命令没有传这两个参数，上游默认值为 1，起卡时按 pcp=1、dcp=1 建组，总卡数等于 TP 的 8 张 [D]。
- 每 token 每卡 13,056 B、满长请求 1.619 GiB：取自 [KV cache](kv-cache.md) 与[部署页](glm-5-3-flash-two-node.md)已经推导过的账，本页只引用。
- 「DCP 开到 8」那一段的字节数：按「主 KV 按位置分片、索引每卡各留一份」的布局从 13,056 B 推出，本模型没有这份实现，也没有实测 [D]。
- 待核：kpool 尾状态、KDA 递推状态在 DCP 下怎么放，钉住版本里没有对应代码可核；本部署没有 CP 的时延与吞吐实测数。
