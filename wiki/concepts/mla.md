---
id: mla
title: MLA：历史压成一条潜向量，用时再展开
type: concept
summary: >-
  MLA（Multi-head Latent Attention）把每个位置给所有头用的 K/V 压成一条共用的潜向量存进 KV
  cache，读取时由各头的上投影展开，或把展开吸收进查询和输出投影；GLM-5.3-Flash 的稀疏 MLA 每位置只存 512 维潜向量、不带 RoPE
  段，读哪些位置由 indexer 另行决定，主缓存、indexer 缓存与计算开销分别计量。
aliases:
  - MLA
  - Multi-head Latent Attention
  - 多头潜在注意力
  - 潜向量
  - latent
  - kv_lora_rank
  - q_lora_rank
  - 低秩压缩
  - 矩阵吸收
  - absorb
  - decoupled RoPE
  - 稀疏 MLA
  - kv_b_proj
  - q_b_proj
chapters:
  - '04'
order: 30
sources:
  - 'https://arxiv.org/html/2405.04434v5'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1900-L1963'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L744-L788'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L776-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1349-L1361'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1291'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L573-L579'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L12-L30
  - 'vllm@0fc695fc:vllm/config/model.py#L1284-L1288'
  - 'vllm@0fc695fc:vllm/config/model.py#L1646-L1648'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L945-L956'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/mla_v1.py#L1549-L1592'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L1405-L1487'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L180-L230'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_glm5next_config.py#L34-L51
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1606-L1618'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1134-L1214'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L508-L522'
  - >-
    raw:sha256-0ca90b365638f0e0df7f1c1d299c782b807c2247da0745f345d3ffea11e0cd7d.md#L1-L957
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/model.py#L1646-L1648
  - >-
    raw:sha256-415edeed2396d5708daa6647bf1fafceca87f5c424b6404368c83cfc397fd22e.md#L1-L963
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L178-L228'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/mla_v1.py#L1094-L1139'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L909-L922'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L101-L117'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/mla_v1.py#L1153-L1171'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L1052-L1070'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/mla_v1.py#L1487-L1575'
  - 'vllm@ced6857a:vllm/model_executor/utils.py#L70-L143'
  - 'vllm@0fc695fc:vllm/envs.py#L1281-L1282'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/mla_v1.py#L1270-L1320'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/mla_v1.py#L1765-L1860'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L140-L230'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_glm5next_config.py#L34-L51'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/mla_v1.py#L1241-L1285'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/mla_v1.py#L1704-L1800'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/attention.py#L151-L240'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 多头打分、softmax 和 V 汇合在那里讲；本页只改历史怎样存、怎样读
  - to: kv-cache
    kind: builds-on
    note: MLA 的核心目标是把每个位置写入 KV cache 的多头键值压成一条共享潜向量
  - to: rope
    kind: builds-on
    note: 旋转位置编码会阻断 K 上投影的矩阵吸收，因此标准 MLA 另存解耦 RoPE 段（GLM 则设为 0 维）
  - to: gqa
    kind: alternative-to
    note: GQA 靠多个查询头共用同一组 K/V 减缓存；MLA 靠共享潜向量与逐头上投影在更低缓存下保持各头独立 K/V
  - to: linear-attention
    kind: alternative-to
    note: 线性注意力把历史压进固定大小的递推矩阵状态，与按位置保存潜向量的 MLA 形成互补路线
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-0ca90b365638f0e0df7f1c1d299c782b807c2247da0745f345d3ffea11e0cd7d.md
  - >-
    raw/sha256-415edeed2396d5708daa6647bf1fafceca87f5c424b6404368c83cfc397fd22e.md
  - >-
    raw/sha256-afb5aa69e6b6658fec7b6b658e29ea561eb4670c3a4081b671c135967804b0be.md
---

## 每个历史位置都要把各个头的 K 和 V 全存下来吗？

[attention](attention-qkv.md) 让当前位置回头读前文：拿当前位置的 query（查询向量）去和每个历史位置的 key（键向量）打分，再按分数把各位置的 value（值向量）加权求和。多头 attention 把这件事分成几套各自独立的 q、k、v 同时做，每套叫一个注意力头。为了不在每一步重算历史，推理引擎把每个历史位置的 K 和 V 存进 [KV cache](kv-cache.md)，也就是专门保存历史中间结果的一块显存。普通多头 attention 有多少个头，每个位置就要存多少份 K 和 V。

**MLA（Multi-head Latent Attention，多头潜在注意力）把一个位置给所有头用的 K 和 V 先压成一条短得多的向量，叫潜向量（latent），存进 KV cache；用到这个位置时，再由每个头各自的投影矩阵从潜向量得到这个头的 K 和 V，照常参与注意力计算。**

进入矩阵推导前，先把它想成储物间收纳——**塞满货架的蓬松双人床垫 vs 真空压缩潜向量卷筒与独立位置小挂环**：

```wiki-diagram
file: mla-plate-vacuum-latent-roll
```

打个比方：普通多头 attention 给每个头各抄一份笔记；MLA 只记一份所有头共用的摘要，哪个头要读，就用自己的读法从摘要里还原出自己那份。摘要短，存的就少；各头读法不同，还原出来的 K、V 也各不相同。

```wiki-diagram
file: mla-intuition
```

图从上往下读：

1. **压缩。** 新位置的隐藏向量（在层与层之间传递的那条向量）乘一个下投影矩阵，得到潜向量 c。所有头共用这一条，不再每个头各算一份 K、V 去存。
2. **只存潜向量。** KV cache 里每个位置只放一条 c。
3. **只取要用的位置。** 普通做法取因果范围内的全部位置（当前位置和它之前的位置）；GLM 这类稀疏模型只取 indexer（一个给历史位置打分、挑出本次要读哪些位置的小分支）选中的那些，怎么选归[稀疏注意力](sparse-attention.md)。
4. **展开。** 每个头用自己的上投影矩阵，从 c 得到这个头的 Kᵢ 和 Vᵢ。
5. **照常做 attention。** 多头打分、softmax、按权重汇合 V，和普通 attention 一模一样。MLA 改的是历史怎样存、怎样读，不改 attention 本身。

第 4 步画成「展开」，是为了看清数学关系。GLM 的稀疏 MLA 在推理时一次都不展开，而是把 K 的上投影挪到查询一侧、V 的上投影挪到汇合之后再乘，这叫**吸收**（absorb）；推导和什么时候仍会展开，见[后文](#吸收不展开也能打分和汇合)。

是否另存一段 [RoPE](rope.md) 位置编码由模型配置决定：尽管源码保留了位置段宽度大于 `0` 的分支，本页 `GLM-5.3-Flash` 实配 `qk_rope_head_dim=0`、`mla_use_nope=true`，主缓存仅存 `512` 维潜向量，不含 RoPE 段（其他 MLA 模型按各自配置核对）。

## 为什么要压，代价在哪？

**KV cache 会随历史长度、层数、头数一起涨。** 每处理一个 token，这个位置要在每一层都留下 K 和 V；存的量是「位置数 × 层数 × 每层每位置存的数」，普通多头 attention 的最后一项又和头数成正比。decode（逐个生成 token）的每一步，还要把可见历史的 K、V 从显存里读一遍。缓存越大，一张卡能同时容纳的请求和上下文越少，每一步要搬的字节越多，见 [KV cache](kv-cache.md)。

**省缓存的两条路。** [GQA（grouped-query attention，分组查询注意力）](gqa.md)让几个查询头共用同一份 K、V，存的份数从头数降到组数，代价是同组的头读到的 K、V 完全一样。MLA 换了个省法：所有头共用一条潜向量，每个头再用自己的上投影从它得到自己的 K、V，各头读到的仍然不同。DeepSeek-V2 论文的对比实验里，GQA 和 MQA（所有头只共用一份 K、V）省了缓存，效果却比不上普通多头；MLA 缓存更少，效果还好于普通多头。

**MLA 省多少。** 以 GLM-5.3-Flash 的稀疏 MLA 层为例：64 个注意力头，每头 K、V 各 256 维。按普通多头 attention 存，每个位置每层要存 $64 \times (256 + 256) = 32{,}768$ 个数；MLA 只存一条 512 维潜向量（RoPE 段在 GLM 为 0 维，原因见后文）：

| 方案（单位置、单层主缓存） | 计算式 | 缓存数值个数 | 相对普通多头压缩比 |
|---|---|---|---|
| 普通多头（MHA） | $64 \times (256 + 256)$ | $32{,}768$ | $1\times$ |
| GLM 稀疏 MLA | $\text{潜向量 } 512 + \text{RoPE 段 } 0$ | $512$ | $32{,}768 \div 512 = 64\times$ |

换成字节、再乘上层数，每个 token 要占多少显存，放到后面 [GLM 双机一节](#哪些层是-mla每层存什么)交代。

这里比较的是主缓存表示的宽度，不能直接把 64 倍当作全部历史状态的显存节省比例；其他状态怎样计入，见[每个位置缓存多少字节](#每个位置缓存多少字节)。

**代价有四笔：**

1. **模型必须按 MLA 训练。** 下投影、上投影都是模型参数，和模型一起训练。不能把一个已训练好的普通多头 attention 模型直接改成 MLA，还指望输出不变。
2. **读的时候多做矩阵乘。** 要么把读到的潜向量展开成各头的 K、V，要么用吸收把展开并进查询和输出投影。吸收以后，每个头在 512 维的潜空间里打分，比展开后的 256 维宽一倍。省下的显存有一部分换成了计算，最后快还是慢，要看历史长度、读取的位置数和内核实现，不能一概而论。
3. **TP 切不开潜向量。** [TP（张量并行）](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)把一层的头平分给几张卡，各卡只算自己那几个头。普通 K/V 按头存，分给 8 张卡，每卡只存八分之一；潜向量是所有头共用的，每张卡都要存完整一份。
4. **RoPE 挡住吸收。** 旋转位置编码 RoPE 会按位置旋转 K，让吸收失效，DeepSeek-V2 为此另存一小段带 RoPE 的 K，见[后文](#rope-为什么要另存一段)。GLM 没有这一段。

几种做法存的东西不一样：

| 做法 | 每个位置、每层存什么 | 每位置每层存多少个数 |
|---|---|---|
| 普通多头 attention（MHA） | 每个头一份 K、一份 V | 2 × 头数 × 每头维度 |
| [GQA](gqa.md) | 一组头共用一份 K、V | 2 × 组数 × 每头维度 |
| MLA | 一条所有头共用的潜向量，外加可选的 RoPE 段 | 潜向量维度 + RoPE 段维度 |
| [稀疏注意力](sparse-attention.md) | 决定每次访问哪些位置；内容选取型可保留全部历史，纯窗口型可回收不再访问的历史 | 取决于存法与允许访问的历史范围 |

MLA 和稀疏注意力管的是两件事，可以叠加：GLM 的「稀疏 MLA」就是按 MLA 存、按稀疏选择读，[后文](#稀疏选择是压缩之上的另一层机制)专门讲两者怎样配合。

## 低秩压缩：一条潜向量怎样变回每个头的 K 和 V

MLA 由 DeepSeek-V2 提出。全页用行向量记法：向量写在左边，乘右边的矩阵。设 hₜ 是位置 t 的隐藏向量，所有头共用的下投影是 W_DKV，第 i 个头的上投影是 W_UKᵢ 和 W_UVᵢ：

```text
cₜ   = hₜ W_DKV       压缩：隐藏向量 → 潜向量，宽 d_c
kₜ,ᵢ = cₜ W_UKᵢ       第 i 个头的 K，从同一条 cₜ 上投影
vₜ,ᵢ = cₜ W_UVᵢ       第 i 个头的 V，用另一块矩阵
```

KV cache 里只存 cₜ。d_c 远小于「头数 × 每头维度」，所以叫**低秩**：把所有头的 K 投影拼成一个宽矩阵看，从隐藏向量到 K 等于先乘 W_DKV 压到 d_c 维、再乘拼起来的 W_UK 放大，是两片矩阵的乘积，秩不超过 d_c；V 也一样。不看中间的归一化时，这就是一个大矩阵被拆成了两片小矩阵。

用一组编出来的小数走一遍（示意）：隐藏向量只有 4 个数，潜向量 2 个数（d_c = 2），2 个头，每头的 K、V 各 2 个数。位置 0 的隐藏向量 h₀ = [1, 1, 0, 1]。图里的「下投影」就是 W_DKV，「头 i 的 K 上投影」「头 i 的 V 上投影」就是 W_UKᵢ、W_UVᵢ。向量乘矩阵时，结果的第 j 个数是向量和矩阵第 j 列的点积，见[矩阵乘和权重](matmul-and-weights.md)。

```wiki-diagram
file: mla-lowrank-calc
```

把位置 0 先压缩进 KV cache、再分别还原成两个头的 K 和 V（示意）：

| 步骤 | 算式 | 结果 | 是否进 KV cache |
|---|---|---|---|
| 压缩潜向量 $c_0$ | $h_0 W_{DKV} = [1{\cdot}1 + 1{\cdot}0 + 0{\cdot}1 + 1{\cdot}0,\; 1{\cdot}0 + 1{\cdot}1 + 0{\cdot}0 + 1{\cdot}1]$ | $[1, 2]$（仅 2 个数） | 是（唯一存入项） |
| 还原头 1 的 $k_{0,1}, v_{0,1}$ | $c_0 W_{UK_1} = [1{\cdot}1 + 2{\cdot}0,\; 1{\cdot}2 + 2{\cdot}1]$；$c_0 W_{UV_1} = [1{\cdot}1 + 2{\cdot}1,\; 1{\cdot}1 + 2{\cdot}0]$ | $k_{0,1}=[1,4]$，$v_{0,1}=[3,1]$ | 否（用时展开） |
| 还原头 2 的 $k_{0,2}, v_{0,2}$ | $c_0 W_{UK_2} = [1{\cdot}0 + 2{\cdot}1,\; 1{\cdot}1 + 2{\cdot}0]$；$c_0 W_{UV_2} = [1{\cdot}0 + 2{\cdot}1,\; 1{\cdot}1 + 2{\cdot}1]$ | $k_{0,2}=[2,1]$，$v_{0,2}=[2,3]$ | 否（用时展开） |

按此示意，普通多头每个位置要存 $2 \times (2 + 2) = 8$ 个数，而 MLA 每个位置只存 $2$ 个数。

k₀,₁ 表示位置 0、头 1 的 K。这里的「还原」就是前面五步里说的「展开」，两个词指同一件事。同一条 c₀，头 1 还原出 [1, 4]，头 2 还原出 [2, 1]，因为两个头的上投影不同。图右边这四条就是普通多头要为位置 0 存的东西，共 8 个数；MLA 只存左边的 2 个数，要用时再算右边。「低秩」在例子里也看得见：从 h₀ 的 4 个数到两个头的 K 共 4 个数，中间只经过 c₀ 这 2 个数。真实模型的比例见上一节：64 个头 × (256 + 256) 对 512。

实际模型比上面三行公式多两样东西。一是潜向量后面有一个 [RMSNorm](mlp-residual-norm.md#rmsnorm-怎样调整向量尺度)（一种只按均方根缩放的归一化），论文说是为了训练稳定；GLM 的实现在把潜向量写进缓存之前做这一步。二是 Q 也走一条压缩路线：先压成 d_c′ 维的中间表示，再上投影成各头的 Q。论文说 Q 的压缩是为了减少训练时的激活显存；它**不进 KV cache**，因为 Q 只属于当前位置，用完就丢。GLM 里 Q 的中间表示是 1536 维（配置项 q_lora_rank），缓存里的潜向量是 512 维（配置项 kv_lora_rank），这是两个不同的张量。

论文里的 DeepSeek-V2 取 128 个头、每头 128 维、d_c = 512、d_c′ = 1536，另有 64 维的 RoPE 段（见[后文](#rope-为什么要另存一段)）。于是每个位置每层缓存 512 + 64 = 576 个数，而普通多头要 2 × 128 × 128 = 32,768 个；论文把 MLA 的缓存量折算成「只有 2.25 组的 GQA」，效果却好于普通多头（见[上一节](#为什么要压代价在哪)）。GLM-5.3-Flash 沿用同样的结构，只是头数、每头维度不同，而且没有 RoPE 段。

完整模型中的压缩与展开可在[模型探索：低秩 Q 与 KV](#/model?view=play&segment=28)连续播放，随后接第 29 段的多头展开。该入口对应模型示例中的展开路径；下面单独说明吸收算法怎样避免逐历史位置展开。

## 吸收：不展开也能打分和汇合

**吸收要解决的是：decode 时不想把历史位置的潜向量先还原成每个头的 K、V 再算，那样既费计算又费搬运。它利用矩阵乘法的结合律，把还原那一步挪到 q 这一边和汇合之后，历史位置从头到尾只以潜向量的样子参与计算。**

先还原为什么不划算：decode 每生成一个 token，都要拿新位置的 q 和历史位置打分、再按权重汇合 V。每一步都先还原的话，每个历史位置、每个头每步都要做一次矩阵乘（还原结果不能存下来留给下一步，存了就等于没压）；还原出来的 K、V 合起来又是潜向量的几十倍，写进显存再读出来，搬运量也回去了。

接着上一节的例子，看头 1 怎样给位置 0 打分。当前位置头 1 的查询 q = [2, 1]（示意）。先还原的算法：用头 1 的 K 上投影 W_UK₁ 把 c₀ 还原成 k₀,₁，再和 q 点积。吸收的算法：把 W_UK₁ 行列互换（转置，记作 W_UK₁ᵀ）后先乘进 q，得到一条和潜向量一样长的 q̃，再直接和 c₀ 点积。

```wiki-diagram
file: mla-absorb-calc
```

两边都得 6。为什么一定相等？把 6 拆开，它是四个乘积之和，每个乘积是「q 的一个数 × c₀ 的一个数 × W_UK₁ 里对应的一个数」：2×1×1 + 2×2×0 + 1×1×2 + 1×2×1 = 2 + 0 + 2 + 2。先还原是先按 k₀,₁ 的两个数分组相加：(2 + 0) + (2 + 2) = 2 + 4；吸收是先按 c₀ 的两个数分组相加：(2 + 2) + (0 + 2) = 4 + 2。四个乘积一个不少，只是先加哪几个不同。这就是矩阵乘法的结合律：先算 c₀ W_UK₁ 再和 q 点积，与先算 q W_UK₁ᵀ 再和 c₀ 点积，结果一样。

好处在历史位置多的时候显出来。再加一个历史位置 1：$h_1 = [1, 0, 1, 0]$，按同一个 $W_{DKV}$ 压成 $c_1 = [2, 0]$。吸收路径先一次性算出潜空间查询 $\tilde{q} = q W_{UK_1}^\top = [2{\cdot}1 + 1{\cdot}2,\; 2{\cdot}0 + 1{\cdot}1] = [4, 1]$，两个历史位置直接共用；V 侧同理，先用权重汇总潜向量，最后只乘一次 $W_{UV_1}$。

| 计算项（头 1 读位置 0、1，示意） | 先还原路径 | 吸收路径（$\tilde{q}=[4,1]$ 共用） | 结果 |
|---|---|---|---|
| 位置 0 打分 | $q \cdot k_{0,1} = [2,1]\cdot[1,4]$ | $\tilde{q} \cdot c_0 = [4,1]\cdot[1,2]$ | $6$ |
| 位置 1 打分 | $q \cdot (c_1 W_{UK_1}) = [2,1]\cdot[2,4]$ | $\tilde{q} \cdot c_1 = [4,1]\cdot[2,0]$ | $8$ |
| 归一化权重（保留两位小数） | $\text{softmax}([6,8]\div\sqrt{2}) = \text{softmax}([4.24, 5.66])$ | 同左 | $[0.20, 0.80]$ |
| V 汇合输出 | $0.20\,(c_0 W_{UV_1}) + 0.80\,(c_1 W_{UV_1}) = 0.20[3,1] + 0.80[2,2]$ | $(0.20\,c_0 + 0.80\,c_1)W_{UV_1} = [1.8, 0.4]W_{UV_1}$ | $[2.2, 1.8]$ |

吸收只是换了算法，分数本身不变，所以缩放除的仍是每头维度的平方根（例子里每头 2 维，除以 √2），不是潜向量维度的平方根。例子里两者碰巧都是 2，看不出差别；在 GLM 里每头 256 维、潜向量 512 维，除的是 √256 而不是 √512。带 RoPE 段的模型，分母还要加上 RoPE 段的宽度，DeepSeek-V2 是 √(128 + 64)。再数打分用的乘法次数：先还原时，每个历史位置还原要 4 次乘法、点积要 2 次，2 个位置共 12 次；吸收算 q̃ 用 4 次，之后每个位置只点积 2 次，共 8 次。历史有 1,000 个位置时是 6,000 次对 2,004 次，而且吸收全程不用把还原出来的 K 写进显存。

把例子写成一般形式：把历史潜向量按位置排成矩阵 C（每行一个位置），第 i 个头展开后的 K、V 和这个头的打分、汇合可以改写成：

```text
Kᵢ = C W_UKᵢ
Vᵢ = C W_UVᵢ
qᵢ Kᵢᵀ = (qᵢ W_UKᵢᵀ) Cᵀ
pᵢ Vᵢ  = (pᵢ C) W_UVᵢ
```

qᵢ 是当前位置第 i 个头的查询，pᵢ 是打分经过缩放、掩码和 softmax 之后的权重。第三行把 K 的上投影挪到了查询一侧：先把 qᵢ 乘上 W_UKᵢᵀ，得到一条 d_c 维的「潜空间查询」（就是例子里的 q̃），直接和潜向量 C 打分。第四行把 V 的上投影挪到了汇合之后：先用权重把潜向量加起来，得到 d_c 维的结果，再乘一次 W_UVᵢ。W_UKᵢ 和 W_UVᵢ 与位置无关，先乘哪一边结果都一样。挪到查询一侧更省：本轮新算的 token 只有几个，历史却可能有成千上万个位置，这样就不用把每个历史位置逐个展开。

这样一来，打分和汇合用的是**同一份** C：打分时它当 K，汇合时它当 V。GLM 在昇腾上的实现正是这样做的：

1. **加载权重后拆矩阵。** KV 的展开投影（kv_b_proj）被拆成 K 的一块和 V 的一块，转好布局存下，原来的投影随即释放，所以显存里不会同时放两份。
2. **查询进潜空间。** 每个头的查询先由 Q 展开投影得到（每头 256 维），再乘 K 的那一块，变成每头 512 维。
3. **内核只读潜向量。** 稀疏 FlashAttention 内核把同一份 512 维潜向量缓存同时当作 key 和 value 传入，按位置清单在 512 维内融合完成打分、softmax 与汇合（中间分数矩阵不写回显存）。缩放仍按每头 256 维除以 $\sqrt{256} = 16$，不是按 512 维。
4. **汇合后再回到每头维度。** 内核输出每头 512 维，乘 V 的那一块回到每头 256 维，再交给输出投影。

吸收不是唯一路径。vllm-ascend 给 DeepSeek 这类模型用的通用 MLA 后端，在 prefill 新 token 多的阶段不走吸收：本轮新潜向量连同已缓存前文（来自[分块 prefill](chunked-prefill.md)前段或[前缀缓存](prefix-caching.md)命中块）会经 KV 展开投影还原成各头 K、V，按普通多头计算，仅 decode 阶段走吸收。GLM 稀疏 MLA 后端在加载权重后即释放 `kv_b_proj`，因此 prefill 与 decode 全程走吸收。

```wiki-diagram
file: mla-fig-latent-absorb
```

上图把前两节收在一张全景里：上半区对照主缓存 64 倍宽度压缩、TP8 逐卡复制及 RoPE 零宽边界；下半区串联查询吸收、内核直读潜缓存与汇合后乘 `W_UV` 的四步链路。压缩减少的是长期状态，真实快慢由投影、潜空间宽度与内核实现共同决定。

## RoPE 为什么要另存一段

[RoPE（旋转位置编码）](rope.md)按位置把 Q 和 K 各旋转一定角度；如果直接加在展开后的 K 上，打分就会在 $q_i$ 和 $W_{UK_i}^\top$ 之间夹进随相对位置变化的旋转矩阵 $R(t - s)$，矩阵乘法不可交换，吸收立刻失效。下图并排对比这一冲突与 DeepSeek-V2、GLM-5.3-Flash 两种工程解法：

```wiki-diagram
file: mla-fig-decoupled-rope
```

- **DeepSeek-V2 的 Decoupled RoPE**：把位置信息拆到独立小通道——每头多算一小段带 RoPE 的查询，所有头共用一条 `64` 维已旋转共享键 $k_s^R$ 存入缓存。不带位置的 `512` 维主通道照常吸收，位置小段独立点积相加（$6 + q^R \cdot k^R$），因为 $k_s^R$ 不经过 $W_{UK}$，所以不挡吸收；代价是每位置多存 $d_h^R = 64$ 个数（合计 `576` 维）。

### GLM 的这一配置不保存 RoPE 段

GLM-5.3-Flash 将 `qk_rope_head_dim` 设为 `0`、`mla_use_nope` 设为 `true`。主 attention、indexer 与写缓存函数均只在宽度大于 `0` 时才构造或执行旋转，因此每层主缓存仅留 `512` 维纯潜向量，吸收零阻碍（详见 [RoPE](rope.md)）。

没有 RoPE 不等于没有位置信息：位置感来自 34 层 [KDA](linear-attention.md) 逐词递推、indexer 压池的池内位置偏置，以及 attention 自身的因果掩码（细节见[模型页稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)）。

### 每个位置缓存多少字节

一个 MLA 层每位置存「潜向量 + RoPE 段」一条向量，每层字节数为 $(d_c + d_h^R) \times b_{\text{dtype}}$。vLLM 将 MLA 层记作只有 `1` 个 KV 头、头宽 $d_c + d_h^R$，没有普通 K/V 的系数 `2`；配置文件里的 `num_key_value_heads = 64` 不能直接代进普通 K/V 公式。

GLM 实取潜向量 `512` 维、RoPE 段 `0` 维、主缓存固定 BF16。每层每 token 字节数与 12 层（11 主干 + 1 MTP）含 indexer 压缩缓存的合计推导统一见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)与[块字节账](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)，结论见下节。

主潜向量之外，一层稀疏 MLA 还有 indexer 的压缩缓存和尾状态；块里有空位，前向还有临时张量。只算主潜向量得不到这一层的全部状态。三份缓存各自的规格、怎样对齐成页、分成几个组，见 [KV Cache Spec · 每张卡报四份规格](kv-cache-spec.md#每张卡报四份规格)。

这些状态也不能统一按 BF16 估算。本页固定的 GLM 专用路径中，完整 MLA 主缓存使用 BF16，压缩器窗口保留 FP32 状态，压缩结果进入 indexer 缓存时再舍入。BF16 与 FP32 是不同的浮点数表示格式，计算容量时需要分别采用对应状态的元素字节数。

```wiki-tool
tool: formula-ruler
mode: mla-compression
model: qwen3-8b
title: 随文活体算例标尺 · 标准 KV 与 MLA 潜向量压缩对照
summary: 对照当前目标机器模型的单 token 缓存与 DeepSeek MLA 潜向量规则，或一键切至 MLA 样例实算压缩比与跨 TP 复制特征。
```

## 放到 GLM 双机：一个 token 走过一层稀疏 MLA

这一站在主线的[第 4 站 · 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。部署是 2 台 A2 × 8 卡、机内 TP8，前提统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

### 哪些层是 MLA，每层存什么

GLM-5.3-Flash 主干 45 层里，第 3、7、11……43 层共 11 层是稀疏 MLA，其余 34 层是 [KDA](linear-attention.md)。开了 MTP（模型自带的草稿层，先猜后面几个 token）的部署里，第 45 层也是一个稀疏 MLA 层，有自己的一套缓存，所以存 KV 的 MLA 层按 12 层计。每个稀疏 MLA 层在本轮为新位置产生潜向量和 indexer 状态，并读取可见的历史；层输出接着送进残差连接和后面的前馈部分。

换成字节、乘上层数，每个 token 要占多少显存、一张卡能装多少块，只在部署页推一次：主潜向量每层每 token 1,024 B，连同 indexer 的压缩缓存，主干 11 层加 MTP 层合计每 token 13,056 B，见[部署页 · 剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

配置里和 MLA 有关的几项：

| 配置项 | GLM 的值 | 管什么 |
|---|---|---|
| hidden_size | 4096 | 进出这一层的隐藏向量宽度 |
| num_attention_heads | 64 | 主 attention 的头数，TP8 下每卡 8 个 |
| kv_lora_rank | 512 | 缓存里潜向量的宽度 |
| q_lora_rank | 1536 | Q 中间表示的宽度，不进缓存 |
| qk_nope_head_dim / qk_rope_head_dim | 256 / 0 | 每头 K 的不带位置部分 / RoPE 段 |
| v_head_dim | 256 | 每头 V 的宽度 |

**因为 `q_lora_rank` 有值，每层只建四个投影**：Q/KV 合并压缩投影（`4096 → 1536 + 512`）、Q 展开投影（`1536 → 64 × 256`）、KV 展开投影（`512 → 64 × 512`）和输出投影（`64 × 256 → 4096`）；只有 `q_lora_rank` 为空的模型才改建独立压缩投影。两个 RMSNorm 仅带缩放向量不算投影；四块投影实际走 8 位还是 BF16 由量化描述文件决定（见[量化](quantization.md#哪些矩阵是-8-位哪些保持-bf16)）。

分工上，vLLM 为这些状态规划容量、管理请求与块的对应关系；vllm-ascend 的 GLM 专用层和后端负责具体的缓存布局与算子执行。

### 一个 token 走过一层：每张卡做什么

跟着一个新 token 看它在一层稀疏 MLA 里的六步，形状都按每张卡写：

1. **压缩。** 本卡用一整份合并压缩投影（不按 TP 切，每卡各算一遍）把 4096 维隐藏向量变成 2048 维，切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm。
2. **写历史。** 512 维潜向量写进本层主缓存里这个位置的槽位；RoPE 段为 0，跳过旋转。TP 组 8 张卡写的是同一份完整潜向量。
3. **选位置。** indexer 用同一份 1536 维 Q 中间表示和隐藏向量给历史打分，交出这个 token 的位置清单，每行最多 2051 个位置（来历见[稀疏注意力](sparse-attention.md#候选位置从哪里来)）。
4. **准备查询。** Q 展开投影按头切，本卡只算 8 个头、每头 256 维；再乘 K 的上投影块，吸收成每头 512 维。
5. **读和汇合。** 稀疏 FlashAttention 内核按清单经 [block table](block-table.md) 找到各位置的潜向量，一次取一个位置，把它同时当 K 和 V，在 512 维里算完本卡 8 个头的打分、softmax 和汇合。
6. **回到隐藏维。** 每头 512 维乘 V 的上投影块回到 256 维，8 个头拼成 2048 维，经输出投影（按行切）得到 4096 维的部分和；最后一次 TP8 [All-Reduce](collective-communication.md#all-reduce) 把 8 张卡的部分和加起来。

```wiki-diagram
file: mla
```

图里三列分别负责写历史、准备查询与选位置，三路在内核处汇合，全层仅第 6 步做一次集合通信。indexer 与选位置均在卡内无通信完成（每卡各算一遍、各存一份权重），切分规则与 R1 具体张量形状见[稀疏注意力](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)、[张量并行](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)与[一条请求](one-request.md#11-层稀疏-mla)。

### 稀疏选择是压缩之上的另一层机制

压缩后的 MLA 本身仍可以对全部可见历史打分。稀疏结构再加一个较轻的 indexer 分支：先选候选位置，再做主 attention。所以 **MLA 决定历史怎样表示，稀疏选择决定这次查询用哪些历史位置**；新增的成本是 indexer 的计算和它自己的状态。indexer 怎样压池、打分、选池、补尾，归[稀疏注意力 · 候选位置从哪里来](sparse-attention.md#候选位置从哪里来)，这里只讲两者怎样接上。

GLM 的 indexer 取 32 个查询头、每头 128 维，每 4 个位置压成一池，每个查询的位置预算 index_topk 为 2048（不是缓存块大小），这几个数怎样用见[稀疏注意力 · 候选位置从哪里来](sparse-attention.md#候选位置从哪里来)。

两者在一层里有三个接口：

1. **共用 Q 的中间表示。** indexer 的查询投影从 MLA 那条 1536 维 Q 中间表示出发，展开成 32 头 × 128 维；它的 K 另由隐藏向量算出。所以 MLA 的合并压缩投影同时在给 indexer 备料。
2. **indexer 交位置编号，MLA 按编号读潜向量。** indexer 的输出是一张位置清单；主 attention 按清单去读 MLA 主缓存里对应位置的 512 维潜向量，一次一个位置。清单里的 −1 是空名额，不读。
3. **状态各存各的。** 一层稀疏 MLA 挂三份缓存：MLA 主潜向量、indexer 已完成池的压缩缓存，以及未凑满一池的位置留下的高精度尾状态。池化让一个完整的池只占一条 indexer 条目；没凑满的池还在更新，要另外留着。三份各有缓存规格，见 [KV Cache Spec](kv-cache-spec.md#每张卡报四份规格)。

几条边界：查询先筛候选、再在候选范围内做主 attention，因果范围和有效位置照样要检查。候选变少不代表 indexer 阶段不花时间，也不代表没选中的历史可以从缓存里删掉：不同查询会选不同位置，后面的 token 仍可能用到此前落选的历史。历史不超过 2051 个位置时，稀疏 MLA 读到的就是全部因果历史，见[稀疏什么时候才真的起作用](sparse-attention.md#稀疏什么时候才真的起作用)。容量与计算两种代价怎样分开比较，见[注意力代价](attention-cost.md)。

## 常见误解

- **「decode 时要先把潜向量解压回每个头的 K 和 V。」** 不用。吸收把 K 的上投影挪到查询一侧、V 的上投影挪到汇合之后；GLM 的内核把同一份潜向量同时当 K 和 V 读，见[吸收](#吸收不展开也能打分和汇合)。
- **「配置里 num_key_value_heads 是 64，所以每个位置存 64 份 K/V。」** 不对。vLLM 把 MLA 层按 1 个 KV 头处理，每位置每层只存一条潜向量（外加 RoPE 段，GLM 为 0），见[每个位置缓存多少字节](#每个位置缓存多少字节)。
- **「TP8 下每张卡只存八分之一的潜向量。」** 不对。潜向量是所有头共用的，TP 组里每张卡都存完整一份；按头切的只有 Q 展开、KV 展开和输出三个投影。
- **「Q 的 1536 维中间表示也进了缓存。」** 不对。它只属于当前位置，用来展开 Q 和喂给 indexer，用完就丢；缓存里只有 512 维潜向量。
- **「GLM 的 MLA 也有 64 维 RoPE 段。」** 64 维是 DeepSeek-V2 的配置。GLM 的 RoPE 段宽度为 0，主缓存只有 512 维潜向量。
- **「MLA 和稀疏注意力是一回事。」** MLA 决定每个位置存成什么，稀疏决定这次读哪些位置；GLM 两者都用，但可以分开理解。
- **「压缩了 64 倍，attention 就快 64 倍。」** 64 倍说的是缓存大小。吸收以后每个头在 512 维里打分，比展开后的 256 维还宽；快慢要看读取的位置数、内核和访存，没有实测不能折算。
- **「只算潜向量就能得到稀疏 MLA 层的全部显存。」** 还要加 indexer 的压缩缓存和尾状态，以及块里的空位；12 层合计的账见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。

## 对照源码

### 怎么开

MLA 的启用取决于模型配置和模型代码的识别，运行时还可通过 VLLM_MLA_DISABLE 禁用 vLLM 的 MLA 路径。模型侧的识别与实现要满足三处：

1. **vLLM 认出这是 MLA 模型。** vLLM 用 `use_mla` 判断：模型在 MLA 白名单里，且环境变量 `VLLM_MLA_DISABLE` 未设置或值为 0。vLLM 0.23 的白名单里没有 GLM 的模型类型，GLM 镜像的插件补丁改成「配置里有 `kv_lora_rank` 就算 MLA」。于是 `use_mla` 为真，缓存头宽取 `kv_lora_rank + qk_rope_head_dim`（512 + 0），每卡 KV 头数取 1。
2. **模型按层号建稀疏 MLA 层。** 不在 KDA 层号表里的层建成稀疏 MLA；`q_lora_rank` 有值，所以走合并压缩投影那一支，只建 `fused_qkv_a_proj`、`q_b_proj`、`kv_b_proj`、`o_proj` 四个投影。
3. **GLM 子类关掉两条融合路径。** 注意力后端的 GLM 子类在初始化时把 `enable_sfa_prolog_v3` 和 `enable_mlapo` 强制设为假，本部署一定走分步的原生路径，也就是流程图画的那一条。

部署命令统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。`VLLM_MLA_DISABLE` 本部署不设置；GLM 专用层自己报缓存规格（固定 1 个头、512 维），设置这个变量后行为会怎样，没有核对。

### 会报什么错

| 条件 | 报错 | 本部署上怎样判断 |
| --- | --- | --- |
| 头数不能被 TP 大小整除 | 建层时 `assert num_heads % tp_size == 0` 失败 | 64 个头、TP8，每卡 8 个，不会触发 |
| 缓存份数不对 | `ValueError: Indexer KPool MLA expects ... caches, got ...` | 一层应挂主潜向量、indexer 状态、indexer 缓存三份 |
| 三份缓存的角色顺序不对 | `ValueError: Indexer KPool MLA metadata roles must match cache order ...` | 顺序固定为主缓存、indexer 状态、indexer 缓存 |
| 潜向量缓存宽度不对 | `ValueError: Indexer KPool MLA latent cache dim must be ...` | 应等于 `kv_lora_rank`，本配置为 512 |
| RoPE 缓存宽度不对 | `ValueError: Indexer KPool MLA RoPE cache dim must be ...` | 应等于 `qk_rope_head_dim`，本配置为 0 |
| 取不到打包的潜向量缓存 | `ValueError: Indexer KPool MLA sparse attention requires the packed MLA cache.` | 内核读的是打包后的整份主缓存 |

以上都是源码里的检查点，没有在 NPU 上故意触发。和位置清单、掩码模式有关的报错见[稀疏注意力的报错表](sparse-attention.md#会报什么错)。

### 开销和什么时候别开

这个模型不能关掉 MLA：权重就是按 MLA 训练的。能看的是开销落在哪里。

- **潜向量每卡一整份。** TP 分不掉 512 维主缓存；每 token 每层的字节数和能切出多少 KV 块，见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。
- **合并压缩投影和 indexer 每卡一整份。** 它们不按 TP 切，每卡各存、各算一遍，换掉一次通信；每卡每层的权重见[部署页 · 每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。
- **KV 展开投影不占两份。** 加载后拆成 K、V 两块，原投影立即释放。
- **打分宽度变成 512。** 吸收后每头在 512 维里打分和汇合；按清单宽度算的每卡计算上界和读取量见[稀疏注意力](sparse-attention.md#稀疏什么时候才真的起作用)。
- **主缓存精度写死为 BF16。** 缓存规格里直接写了 bfloat16，启动参数 `--kv-cache-dtype` 改不了它，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）保留 MLA 吸收数学，权重刷新采用 `replace_parameter` 保持图捕获地址稳定。** `kv_b_proj` 后处理仍要求未量化线性方法，恢复 ND 后拆出 `W_UK` / `W_UV`；GLM 该层显式不传量化配置（`quant_config=None`），不能据此推断整模型都不量化。旧 `v0.23.0`、`v0.26.0rc` 曾直接用 `copy_` 刷新吸收权重；`v0.30.0`（含其前置 `rc2`）改用 `replace_parameter(..., prefer_copy=True)`，仅在 shape/dtype/device 兼容时原位刷新、否则重绑定；`main` 进一步改为默认保址的 `replace_parameter(self, "W_UV"/"W_UK_T", ...)`，在 `dcp_q_replicate_enabled` 时对 `w_uk_t` 做 DCP `All-Gather`，并把 `mlapo_W_UK_T` 指向 `W_UK_T`。GLM 有 Q 低秩分支时合并 Q/KV 入口，否则仍分别投影。

缓存精度也须另看：`v0.30.0` 与 `main` 主 SFA C8 的推导已覆盖 KPool，所以主缓存不再只能 BF16；完成的索引池仍 BF16、tail 仍 FP32。正文旧 BF16 容量与“待核”保持旧 GLM 专用镜像 `db701c1f` 绑定范围，不能把主 KV 变化当成全部状态统一量化。

**“不旋转位置切片”与“位置段宽度为零”要分开。** 前者仍把那一段原始数据写入缓存，只跳过 RoPE 旋转；后者根本没有那一段有效数据。`v0.30.0` 与 `main` 的通用 MLA 后端先检查 `use_mla_rope`：为假时走 `_exec_kv_no_rope` 保留未旋转切片；否则再检查 `qk_rope_head_dim == 0`，为 0 时走 `_exec_kv_mla_nope` 零宽 NoPE 写缓存分支。这里说明通用后端的条件，GLM 专用调用链仍须按版本另查。

**四版本核验矩阵（本页 GLM 算例仍固定于专用镜像 `db701c1f`）：**

| 检查项 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
| --- | --- | --- | --- | --- |
| 通用 MLA 后端吸收与权重刷新 | 加载后拆出 `W_UK`/`W_UV`，刷新直接 `copy_` | 同 `v0.23.0` | `replace_parameter(..., prefer_copy=True)` 条件原位刷新 | `replace_parameter` 保址刷新，支持 `dcp_q_replicate_enabled` 聚合 `w_uk_t` 并绑定 `mlapo_W_UK_T` |
| 保留位置切片但不旋转（`use_mla_rope=False`） | 通用后端无此分支 | 新增 `_exec_kv_no_rope`，原样保留未旋转位置切片 | 保留 `_exec_kv_no_rope` | 同 `v0.30.0` |
| 零宽 NoPE 分支（`qk_rope_head_dim==0`） | 维护快照无 GLM；镜像 `db701c1f` 专用子类跳过旋转只写主潜向量 | 无 GLM 模型；`_exec_kv_no_rope` 不等于零宽 NoPE | 通用后端具 `_exec_kv_mla_nope` 零宽写缓存分支 | 同 `v0.30.0` |
| GLM 模型与四个投影 | 维护快照无；镜像在 `models/glm5_next.py` | 无 GLM 模型文件 | 拆至 `models/glm5next/attention.py`，`kv_b_proj` 设 `quant_config=None` | 同 `v0.30.0`（`models/glm5next/attention.py`） |
| 把 GLM 认作 MLA（`is_deepseek_mla`） | vLLM 0.23 白名单无 GLM；镜像补丁按 `kv_lora_rank` 判断 | 无 GLM，不涉及 | `patch_glm5next_config.py` 覆写 `is_deepseek_mla` 按 `kv_lora_rank` 识别 | 退役 `patch_glm5next_config.py` 与下游 `models/glm5next/config.py`，转由上游配置承接 |

四版本能否在双机上整套跑通本页 GLM 部署，未做设备运行验证。

### 源码位置

按「建层 → 写缓存 → 吸收 → 读取 → 输出」的顺序读，可以把流程图对回实现：

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 四个投影、按 `q_lora_rank` 分支、头数整除检查 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1900-L1963` |
| RoPE 只在宽度大于 0 时构造 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000` |
| 写缓存：RMSNorm、按条件旋转、写槽位 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L744-L788` |
| 加载后拆出 K、V 两块上投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L776-L793` |
| 查询吸收 K 的上投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1349-L1361` |
| 推理用的稀疏 attention 入口（子类重写） | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| 设备算子：潜向量同时当 K、V，不传 RoPE | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| V 的上投影、输出投影与 All-Reduce | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028` |
| 主缓存规格：头宽、BF16、1 个 KV 头 | `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134` |
| 三份缓存的份数与角色检查 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855` |
| indexer 压缩缓存与尾状态的规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362` |
| indexer 接收 Q 中间表示 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134`；`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1291` |
| 融合路径强制关闭 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L573-L579` |
| 通用 MLA 后端：prefill 按块取回已缓存前文、经 KV 展开投影展开 | `vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1134-L1214`；前文长度取已算 token 数：`vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L508-L522` |
| 插件把 GLM 认作 MLA | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L12-L30` |
| vLLM：MLA 每卡 1 个 KV 头；`use_mla` 与禁用变量 | `vllm@0fc695fc:vllm/config/model.py#L1284-L1288`；`vllm@0fc695fc:vllm/config/model.py#L1646-L1648` |

流程图的分支：`q_lora_rank` 有值时建合并压缩投影，否则建单独的 `kv_a_proj_with_mqa` 和 `q_proj`；写缓存时 RoPE 段宽度大于 0 才旋转。读取侧执行子类重写的入口，A2 落到基础设备适配器，见[稀疏注意力的源码位置](sparse-attention.md#源码位置)。

**生产入口与测试参考计算要分开。** `indexer_kpool_mla_v1.py` 的 `_sparse_attention_pytorch` 是测试使用的参考实现；本页的推理链路走上表「推理用的稀疏 attention 入口」，再调用「设备算子」。参考函数怎样展开和读取张量，不能直接当成生产内核的访存行为。

**正文证据索引。** 低秩联合压缩、上投影可吸收进查询与输出投影、Q 的压缩只为减少训练激活显存、潜向量后的 RMSNorm、decoupled RoPE 的动机与结构、各种注意力每位置缓存量的公式与「2.25 组 GQA」、DeepSeek-V2 的头数和各维度，见 [S1]。GLM 的头数、各维度、RoPE 段为 0、num_key_value_heads、indexer 参数与层号，见 [S2]。四个投影与分支见 [C3]；RoPE 的条件见 [C4]、[C5]；吸收见 [C6]、[C7]，通用后端在 prefill 时仍展开见 [C25]；推理读取见 [C8]、[C9]；V 的上投影、输出投影与通信见 [C10]；主缓存规格见 [C11]；三份缓存见 [C12]、[C13]；indexer 接 Q 中间表示见 [C14]、[C15]；融合路径见 [C16]；把 GLM 认作 MLA 见 [C17]、[C24]；每卡 1 个 KV 头与禁用变量见 [C18]、[C19]。版本差异依据 [C20]、[C21]、[C22]、[C23]；v0.23 通用后端没有无 RoPE 分支，是在 2c59ff10 的 `mla_v1.py` 中检索 `use_mla_rope` 与 `_exec_kv_no_rope` 无结果得出的。

正文算式和结论各自采用以下推导口径：

- 64 倍压缩比按来源 2 的模型维度直接计算，比较的是主潜向量与展开后的 K/V，不含索引状态。[D]
- 四个投影的形状、每卡 8 个头、合并压缩投影与 indexer 不按 TP 切、一层一次 All-Reduce，分别由来源 3、10、15 的固定实现和 TP8 部署条件推出。[D]
- 三份缓存的规格见来源 11–13；每层每 token 1,024 B 与 12 层每 token 13,056 B 的推导在[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)，R1 的形状见[单请求主线](one-request.md)。[D]
- 直觉图的 10 个位置、选中 4 个是教学假设，不是 GLM 的实际选择。[A]

容量边界按本页固定 `db701c1f` 核对：来源 11 第 74–76 行指定主缓存为 BF16，来源 12 第 818–846 行区分三份缓存，来源 13 第 312–335 行规定压缩器窗口保留 FP32、压缩池进入 indexer 时再舍入为 BF16。估算总量仍需各类状态的页规格、分配数量与设备布局，不能从主缓存宽度推出全部显存的节省比例；历史按位置保存，一次未被查询选中也不是释放证明。这些容量与释放边界保留为分析结论，实际设备分配和开销仍未测量。[I]

**待核：** 本页依据固定源码和论文分析，没有在 NPU 上运行，也没有验证最终镜像；部署依据与未决项统一记录在[来源基线](../sources/glm-5-3-flash-baseline.md)。缺稀疏 FlashAttention 内核的设备 trace，吸收后 512 维打分的实际耗时、分块方式和 HBM 读写量都没有实测。四个投影的实际精度缺量化描述文件。main 的 GLM 调用链与主缓存精度未逐行核对。`VLLM_MLA_DISABLE` 对 GLM 专用层的影响未核。

- 来源 29：vllm@0fc695fc，vllm/config/model.py，L1646–L1648。

- 旧版吸收权重的原位刷新见来源 20、35、36；`v0.30.0`（`c09d3e20`）条件复制、零宽 NoPE 分支、GLM 投影与配置补丁见来源 40–43；`main`（`8d6180e2`）保址刷新与 DCP `w_uk_t` 聚合、零宽分支及 GLM 投影见来源 44–46；`rc2` 对照见来源 32、37、38。
- 禁用变量按整数转换为布尔值，未设置时默认 0，见来源 39；环境变量对 GLM 专用层的最终影响仍按上面的待核边界处理。

位置段条件已按来源 2 的固定模型配置，以及来源 4、5 的 `db701c1f` 构造和写缓存分支核对：主 attention 构造 RoPE 还受 `skip_rope` 与 `rope_parameters` 限制，indexer 构造及写缓存也分别检查位置段宽度。当前 GLM 配置宽度为 0，不能以这些条件分支证明它启用了 RoPE；此结论限定于该配置与专用实现，不代替设备运行或性能测量。
