---
id: rope
title: RoPE：把位置变成旋转，让注意力分数只看相隔多远
type: concept
legacyAnchors:
  放到-glm-双机哪里本该转为什么没转: 复杂异构实战对照：MLA 解耦段与 GLM 双机 NoPE
summary: >-
  RoPE 在 q、k 点积之前按各自的位置编号旋转它们的二维分量对，点积里只剩两者的位置差；频率基数与 YaRN 等缩放决定可覆盖的长度范围。本文先以
  Qwen3-8B（128 维拆 64 对、rope_theta = 1,000,000）讲清标准旋转与写缓存边界，再在文末对照历史 GLM-5.3-Flash
  的零维 NoPE 特例。
aliases:
  - 旋转位置编码
  - 旋转位置嵌入
  - Rotary Position Embedding
  - rotary embedding
  - 位置编码
  - partial rotary
  - 部分旋转
  - rope_theta
  - 旋转基数
  - 频率基数
  - YaRN
  - NoPE
  - qk_rope_head_dim
  - 位置插值
  - position
chapters:
  - '04'
order: 10
sources:
  - 'https://arxiv.org/html/2104.09864v5'
  - 'https://arxiv.org/html/2309.00071v2'
  - 'vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L80-L103'
  - 'vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L160-L201'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/common.py#L143-L183
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L63-L72
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L243-L384
  - 'vllm@0fc695fc:vllm/config/model.py#L2178-L2248'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - >-
    vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L102-L105
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2089-L2103'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1256-L1269'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1357-L1383'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L200-L202
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L70-L71'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L641-L646'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L251'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L863-L868'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L755'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/rotary_embedding.py#L216-L250'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L231-L266'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L308-L313'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L288-L294'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L236-L258'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L841'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L75-L105'
  - >-
    raw:sha256-28929cb7b2a4745396c1f36957c5aaac5593597043f254cf6da2540d943f4ae9.md#L1-L556
  - >-
    vllm@ced6857a:vllm/model_executor/layers/rotary_embedding/__init__.py#L32-L71
  - >-
    vllm@ced6857a:vllm/model_executor/layers/rotary_embedding/__init__.py#L240-L279
  - 'vllm-ascend@7d825229:vllm_ascend/ops/rotary_embedding.py#L141-L171'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/rotary_embedding.py#L331-L357'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/rotary_embedding.py#L383-L426'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/rotary_embedding.py#L708-L743'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L230-L266'
  - >-
    vllm@84030bbe:vllm/model_executor/layers/rotary_embedding/__init__.py#L349-L378
  - >-
    vllm@ced6857a:vllm/model_executor/layers/rotary_embedding/__init__.py#L345-L346
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/rotary_embedding.py#L257-L426'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/rotary_embedding.py#L601-L740'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L231-L266'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/rotary_embedding.py#L303-L472'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/rotary_embedding.py#L647-L805'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/attention.py#L244-L275'
  - >-
    vllm@ba15685a:vllm/model_executor/layers/rotary_embedding/__init__.py#L32-L71
  - >-
    vllm@ba15685a:vllm/model_executor/layers/rotary_embedding/__init__.py#L349-L350
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: RoPE 改的是 q、k 点积打分这一步；打分、softmax、因果掩码本身在那一页
  - to: one-request
    kind: builds-on
    note: 挂靠第 4 站逐层前向；位置编号在第 3 站准备输入时算好
  - to: mla
    kind: builds-on
    note: MLA 为什么要把 RoPE 段和潜向量分开存；GLM 这一段是 0 维
  - to: linear-attention
    kind: builds-on
    note: KDA 不用 RoPE，顺序靠短卷积和逐位置递推
  - to: glm-5-3-flash
    kind: builds-on
    note: 这套模型没有位置编码时，顺序信息从哪三处来
  - to: sparse-attention
    kind: builds-on
    note: 索引器压池时的池内偏置与 RoPE 缓存视图的检查
  - to: block-table
    kind: builds-on
    note: 位置编号决定旋转角度，块表只决定缓存存在哪一格
contradicts: []
updated: 2026-11-19T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-0eb270a31420ce82b08585d1565715149aeb5be0c7246312b0fc3c1e45e24ac8.md
  - >-
    raw/sha256-28929cb7b2a4745396c1f36957c5aaac5593597043f254cf6da2540d943f4ae9.md
---

## 注意力怎样知道两个 token 相隔多远？

[attention](attention-qkv.md#attention-怎么算跟着一个位置走一遍)（注意力：每个位置回头看前面的位置，按相关程度把信息取过来）用两条向量给历史打分：当前位置算出的 q（query，查询），和每个历史位置算出的 k（key，键）；两者做点积（dot product：两条一样长的向量对应位置的数相乘，再全部加起来），得到“该从那个位置读多少”的分数。q、k 由各自位置的隐藏向量（每个位置在模型里一层层被改写的那条向量，见[层与隐藏表示](layers-and-hidden.md)）算出，里面没有位置编号，点积里也就没有“谁在前、隔多远”这一项：只要两个 token 的向量不变，挨着还是隔开一百个位置，分数都一样。这为什么是个问题，下一节细说。

**RoPE（Rotary Position Embedding，旋转位置编码）在做点积之前，按各自的位置编号把 `q` 和 `k` 各转一个角度；两者一乘，转角相减，位置对分数的影响就只剩下「相隔几个位置」。**

这一性质的前提是 `q` 和 `k` 采用相同的旋转频率与分量配对约定；内容向量本身仍直接参与点积，因此相同距离的不同词仍会得到不同分数。此外，RoPE 只改写这一步的打分表达式，整模型的最终输出还同时取决于因果掩码、历史范围与后续各层的计算，不能把输出简化成「只由距离决定」。

```wiki-diagram
file: rope
```

图只画 q、k 里的一对分量：两个数当成平面上的一支箭头，每前进一个位置转 20°。左边是旋转前，q 和 k 由各自 token 的内容算出，夹角 30°。中间 k 在位置 3、q 在位置 5，k 转 60°，q 转 100°，夹角变成 30° + 40° = 70°。右边两个位置都往后挪 100，两支箭头各多转 2000°，夹角仍是 70°。

点积等于两支箭头的长度相乘，再乘夹角的余弦。旋转不改长度，所以两组位置得到同一个分数：它只随位置差 2 变化，与位置本身是 5 还是 105 无关。旋转前的 30° 仍由内容决定，换一对 token，同样相隔 2 个位置也会得到不同分数。只有 q 和 k 旋转；v（值，被读走的内容）不转。

请求走到[主线第 4 站：逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)的 attention 层时会遇到这一步。以 `v0.30.0` 主基线 **Qwen3-8B**（`head_dim = 128`、`rope_theta = 1,000,000`）为例，每层投影出 `q`、`k` 并完成逐头 QK-Norm 之后、注意力打分之前，会对全部 128 维（64 对半维分量）施加 RoPE 旋转。少数异构模型（解耦 MLA 或历史 GLM-5.3-Flash 的 NoPE 配置）的差异归入后半[复杂异构实战对照](#复杂异构实战对照mla-解耦段与-glm-双机-nope)。

## 为什么需要位置编码，代价在哪？

**attention 的打分公式里没有“位置”这一项。** 把历史里两个 token 对调，只要它们的向量不变，各自拿到的分数就不变，按分数加权得到的输出也不变。RoFormer 论文开篇就指出，自注意力结构本身对位置是无感的，必须另外把位置信息放进去。[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)只规定一个位置能看哪些位置（自己和之前的），不告诉模型隔了多远；“我打你”和“你打我”用的是同一组词，意思却相反，靠的就是先后。

早期做法是**绝对位置编码**：给每个位置准备一条位置向量，加到词向量上再送进模型。RoPE 换了一种做法：不加向量，而是**乘上一个旋转**。每条 q、k 按自己的绝对位置编号转，点积里却只剩两者的位置差，所以它同时带有绝对位置和相对位置的性质。论文还分析了“远程衰减”：把点积上界拆成内容因子和频率求和因子，后者在默认频率下呈现长距离衰减趋势。这个因子仍会振荡，不能理解为距离每增加一步，上界就必然下降；实际注意力分数更不保证远处一定小。

代价分三处：

- **计算。** 每层给 q、k 中参与旋转的分量各做一次逐元素的乘加，没有要学习的权重。
- **显存。** 一张按位置预先算好的 cos、sin 表；频率固定时，K 以转好的值写进 [KV cache](kv-cache.md)（把历史位置算好的 k、v 存起来，后面的 token 直接读，不再重算），以后不必再转。若扩展方法会随长度改变频率，历史 K 的缓存处理也须与之配套，不能直接复用旧角度。
- **长度。** 训练时没见过的位置可能转出没见过的角度，模型未必会用；想跑更长，需要评估下文的频率缩放、是否续训以及实际长文本质量。

对 MLA（Multi-head Latent Attention：缓存里不存各头完整的 K、V，只存一条压缩过的潜向量，用时再解压）还有一笔额外代价：旋转矩阵随位置变化，夹在 q 的投影和 k 的解压矩阵之间，两者无法提前合并。所以 DeepSeek 式 MLA 让 RoPE 只作用在单独留出的一小段 `q_pe`/`k_pe` 上，这段 k 与潜向量并排存进缓存，详见 [MLA](mla.md#rope-为什么要另存一段)；而历史 GLM-5.3-Flash 则把这一段设为 0 维完全不转，见后文[复杂异构实战对照](#复杂异构实战对照mla-解耦段与-glm-双机-nope)。

几个容易混在一起的“位置”：

| 概念 | 回答的问题 |
|---|---|
| 位置编号 | 这个 token 在本请求里排第几，从 0 起 |
| 因果掩码 | 这个位置能看哪些位置 |
| [block table](block-table.md) | 这个位置的 KV 存在缓存池的哪一格 |
| RoPE | 两个位置相隔多远怎样进入分数 |

## 一条高维向量怎样转：拆成许多二维分量对

图里只转了一个平面。真实的 q、k 有几十到几百维，RoPE 把其中参与旋转的 $d_r$ 维（须为偶数）两两配成 $d_r/2$ 对，每一对 $(x_1, x_2)$ 在位置 $p$ 转过角度 $p\cdot\omega_i$（$i$ 为分量对编号）：

$$x_1' = x_1\cos(p\omega_i) - x_2\sin(p\omega_i), \qquad x_2' = x_1\sin(p\omega_i) + x_2\cos(p\omega_i)$$

工程上不做块对角矩阵乘，而是预先算好每个位置、每一对的 `cos/sin` 表，前向直接按 `[x_1, x_2] ⊙ cos + [-x_2, x_1] ⊙ sin` 做两次逐元素乘加。同时，一个高维头怎样把相邻或半区分量配对、不同对怎样按“秒针到时针”的多频转速分工、以及 `partial_rotary_factor < 1` 如何让尾部维度原样旁路直通，一目了然落在下面这张三合一结构图里：

```wiki-diagram
file: rope-fig-pairing-freq-partial
```

**三处结构细节对照上图核清：**

1. **两种配对布局（训练定死，推理绝不能互换）**：以参与旋转的 4 个分量为例，原论文采用**相邻配对**（GPT-J 风格，`(x₀, x₁)/(x₂, x₃)`，`is_neox_style = False`）；`Qwen3` 等模型采用**前后半区配对**（GPT-NeoX 风格，`(x₀, x₂)/(x₁, x₃)`，`is_neox_style = True`）。两者数学性质相同，但权重排布与之绑定，vLLM 通过布尔开关选择。
2. **多频转速（快对像秒针、慢对像时针）**：论文取 $\omega_i = \theta^{-2i/d_r}$（$i = 0 \dots d_r/2 - 1$，$\theta$ 即配置里的 `rope_theta`，缺省为 `10000`）。以 $d_r = 8, \theta = 10000$ 为例：第 0 对 $\omega_0 = 1$（约 `6.3` 位置一圈），第 1–3 对依次慢 10 倍为 `0.1`（`≈ 63`）、`0.01`（`≈ 628`）与 `0.001`（`≈ 6,283` 位置一圈）。调大 `rope_theta` 会让慢对转得更慢、单圈覆盖更长上下文。
3. **部分旋转（partial rotary）**：允许只转头里的前 $d_r$ 维（按 `(0, 1]` 比例或指定维数截取，如 8 维头只转前 4 维），其余维度原样直通再拼回，`q`、`k` 同步处理。

## 为什么点积里只剩位置差？

下面把首图的旋转与点积一次算清（示意设定：单位长度箭头每位置转 $20^\circ \approx 0.35\text{ rad}$；旋转前 $k$ 指向 $20^\circ$ 即 $(0.940, 0.342)$、$q$ 指向 $50^\circ$ 即 $(0.643, 0.766)$，内容夹角 $30^\circ$，保留三位小数）：

- **单次旋转核验（$k$ 在位置 3 转 $60^\circ$）**：$\cos 60^\circ = 0.500,\; \sin 60^\circ = 0.866$。按逐元素写法，`[0.940, 0.342] ⊙ 0.500 + [-0.342, 0.940] ⊙ 0.866 = (0.470 - 0.296,\; 0.171 + 0.814) = (0.174, 0.985)`，正好等于 $(\cos 80^\circ, \sin 80^\circ)$，模长保持 $\sqrt{0.174^2 + 0.985^2} \approx 1.00$。同理 $q$ 在位置 5 转 $5 \times 20^\circ = 100^\circ$ 指向 $150^\circ$，得 $(-0.866, 0.500)$。
- **整体平移 100 格再算点积**：$k$ 到位置 103 转 $2{,}060^\circ$（5 整圈余 $260^\circ$，停在 $280^\circ$），$q$ 到位置 105 转 $2{,}100^\circ$（5 整圈余 $300^\circ$，停在 $350^\circ$）。三组场景点积对照如下：

| 场景 | $k$ 与 $q$ 分量 | 点积算式 | 结果与夹角 |
| --- | --- | --- | --- |
| 旋转前 | $k=(0.940,\; 0.342)$，$q=(0.643,\; 0.766)$ | $0.940 \times 0.643 + 0.342 \times 0.766 = 0.604 + 0.262$ | **$0.866$**（夹角 $30^\circ$，$\cos 30^\circ = 0.866$） |
| $k$ 在 3、$q$ 在 5 | $k=(0.174,\; 0.985)$，$q=(-0.866,\; 0.500)$ | $0.174 \times (-0.866) + 0.985 \times 0.500 = -0.151 + 0.493$ | **$0.342$**（夹角 $70^\circ$，$\cos 70^\circ = 0.342$） |
| $k$ 在 103、$q$ 在 105 | $k=(\cos 280^\circ,\; \sin 280^\circ)=(0.174,\; -0.985)$，$q=(\cos 350^\circ,\; \sin 350^\circ)=(0.985,\; -0.174)$ | $0.174 \times 0.985 + (-0.985) \times (-0.174) = 0.171 + 0.171$ | **$0.342$**（夹角仍为 $70^\circ$） |

可见旋转只改方向、不改模长：两个位置同时平移 100 格，分量数值全变，点积仍精确守恒于 `0.342`（固定内容向量、频率与配对约定不变）。原因在于旋转矩阵满足正交可逆 $R(p)^\top = R(-p)$ 且连转角度相加，故位置 $p$ 的 $q$ 与位置 $r$ 的 $k$ 做点积只剩相对位置差 $r - p$：

$$(R(p)q)^\top (R(r)k) = q^\top R(p)^\top R(r) k = q^\top R(r - p) k$$

右边只含 r − p。两个位置一起平移，差不变，分数就不变；这正是首图右边那一组、也是上面第三行的情形。按分量对拆开看更直观：第 i 对的贡献等于两段箭头的长度相乘，再乘 cos(内容夹角 + (p − r)·ω_i)；首图里就是 1 × 1 × cos(30° + 2 × 20°) = cos 70° = 0.342。内容夹角由 q、k 本身的数值决定，位置只通过 p − r 进入。

这个等式有三条边界：

- **内容依赖保留。** 相同距离上的不同内容，仍可以得到不同分数；RoPE 只是把距离写进了分数，没有让距离取代内容。
- **只管打分这一步。** 旋转保持每对分量的长度，但这不等于整个模型的输出、语义或长文本质量不受位置影响；因果掩码、内容表示和其他层的计算都会影响结果。
- **不限于 softmax attention。** [线性注意力](linear-attention.md)（linear attention）是 attention 的另一种写法：不对分数做 softmax，而是先把 q、k 各过一个只输出非负数的函数再相乘，这样全部历史可以累加成一个大小固定的状态，不必每一步都和每个历史位置重新打分。没有 softmax，权重要另外除以一个总和（分母）才能加起来等于 1。RoFormer 论文第 3.3 节给出的用法是：旋转只乘在分子里过了非负函数之后的 q、k 上，分母不转。转过之后的点积可能是负数，分母若也跟着转，加起来可能等于 0，就会除以零。

## 频率基数与长上下文：YaRN 这类方法改的是什么？

模型训练时只见过一定长度以内的位置。超过这个长度，慢的那几对分量（转一圈要走的位置数比训练长度还多）可能转到训练中从未出现的角度，质量可能下降。这里讨论的 RoPE 扩展方法会改“位置 → 角度”这张对照关系，减少直接外推带来的问题；是否续训取决于方法和目标质量。YaRN 论文既讨论配合续训的 PI，也报告 NTK-aware、Dynamic NTK 和 YaRN 在不续训条件下的扩展结果，不能把续训当成所有方法的前提。几种方法的区别是：

| 方法 | 改了什么 |
|---|---|
| Position Interpolation（PI，位置插值） | 把位置编号按比例 s 压缩，长序列整体挤回训练长度 |
| NTK-aware | 不压位置，改旋转基数，把压缩分摊到各对分量 |
| NTK-by-parts | 一圈远短于训练长度的快对不动，一圈超过训练长度的慢对插值，中间平滑过渡 |
| YaRN | NTK-by-parts 再加注意力温度；论文对 LLaMA/Llama 2 推荐 q、k 同乘系数 0.1·ln(s) + 1 |

沿用上文 $d_r = 8$、基数 $10000$ 的示意配置算一次：设模型训练时最长见过 $4{,}096$ 个位置，现在想把长度翻倍（$s = 2$），让相隔 $6{,}000$ 个位置的两个 token 也能正常打分。

$$\theta_{\text{NTK}} = 10000 \times 2^{8/6} \approx 25{,}198, \qquad t_{\text{YaRN}} = 0.1 \ln s + 1 = 0.1 \ln 2 + 1 \approx 1.07$$

| 扩展方法（训练长 $4{,}096$，相隔 $6{,}000$，$s = 2$） | 关键分量对转角 / 转速算式 | 结果与含义 |
| --- | --- | --- |
| 训练内基准（快对：第 0 对） | $4{,}096 \times 1 \div 2\pi \approx 652\text{ 圈}$ | $0$ 到 $2\pi$ 的角度早已遍历 |
| 训练内基准（慢对：第 3 对） | $4{,}096 \times 0.001 \approx 4.1\text{ 弧度}$ | 不到一圈（$2\pi \approx 6.283$），$4.1\text{–}6.283$ 弧度未见过 |
| 直接外推（不缩放） | 第 3 对：$6{,}000 \times 0.001 = 6.0\text{ 弧度}$ | 落入训练未见区间 |
| **PI（位置插值）** | 相隔压成 $6{,}000 \div 2 = 3{,}000$；第 3 对 $3{,}000 \times 0.001 = 3.0\text{ 弧度} \le 4.1$ | 慢对安全，但第 0 对相邻差减半为 $1 \div 2 = 0.5$ 弧度 |
| **NTK-aware** | 新基数 $\approx 25{,}198$；第 3 对转速 $25{,}198^{-6/8} = 0.0005$，转角 $6{,}000 \times 0.0005 = 3.0\text{ 弧度}$ | 第 0 对转速 $25{,}198^0 = 1$ 不变；第 1、2 对分别慢 $2^{1/3} \approx 1.26$ 倍、$2^{2/3} \approx 1.59$ 倍 |
| **YaRN 温度系数** | $0.1 \times \ln 2 + 1$ | $\approx \mathbf{1.07}$（并入 cos/sin 缩放表） |

PI 把所有分量对一起压：慢对落回见过的范围，快对分辨相邻位置的本事也跟着减半。NTK-aware 改基数，最快的一对不动，最慢的一对正好慢 s 倍，中间几对少压一些。NTK-by-parts 再细分；按论文示例阈值 α=1、β=32，第 0、1 对一圈只要约 6.3、63 个位置，远短于 4,096，完全不动；第 3 对一圈约 6,283 个位置，超过训练长度，照 PI 插值；第 2 对一圈约 628 个位置，介于两者之间，平滑过渡。

YaRN 的温度也通过缩放 `cos`、`sin` 表实现，不必改 attention 的代码。论文报告，它比此前方法少用约 10 倍的续训 token 和 2.5 倍的训练步数。下图把 PI、NTK-aware、YaRN 对快慢频段的不同处理，以及 NeoX / GPT-J 配对布局、多模态 M-RoPE 与 GLM NoPE 边界放在一起对照：

```wiki-diagram
file: rope-fig-scaling-and-mrope
```

在 vLLM 里，这些都写在模型配置的 RoPE 参数里：基数、缩放类型、缩放倍数、原始训练长度，以及上面说的旋转比例。vLLM 按缩放类型构造对应的旋转模块；类型写错会直接报错。它还会用配置推出允许的最大长度：通常 YaRN 按原始训练长度乘以缩放倍数计算。部署时指定值超过推导上限，而且没有配置中的独立 `model_max_length` 放行时，才进入超限报错；环境变量可以放宽这项校验，但提示会警告 RoPE 超限可能产生 NaN，不能把放行当作质量或数值有效性的保证。

所以**检查点给出了默认的旋转约定；有依据的上下文扩展方法可以调整频率或缩放，但要遵守该方法的适用条件并检验效果。**公式能为任意大的位置算出角度，不等于模型在那个长度上有可靠质量，也不等于设备放得下对应的 KV；只改一个最大长度字段，不能算完成了长上下文扩展。

## 在推理引擎里，旋转发生在哪一步？

对一个使用固定频率 RoPE 的普通 attention 层，一步前向里的顺序是：

1. **位置编号在进层之前就算好。** [主线第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)准备输入时，model runner（vLLM 在每张卡上负责准备本步输入、调用模型前向的那一层）给每个 token 算出位置编号：本请求已经算过的 token 数，加上它在本步里的序号。R1（主线跟踪的示例请求，提示词 4 个 token）第一步的位置编号是 0、1、2、3。
2. **投影出 q、k、v 之后旋转 q 和 k。** 按位置编号取出 cos、sin 表的对应行，只转参与旋转的那部分维度，v 不动。
3. **把转好的 k 写进 KV cache，再打分。** 缓存里存的是旋转后的 k。decode（读完提示词后，一步生成一个新 token 的阶段）时新 token 只转自己的 q 和 k，历史里的 k 在写入时已经转好，不必随生成推进再转一遍。

位置编号和缓存地址是两回事。位置编号说的是 token 在序列里排第几；[block table](block-table.md) 说的是它的状态存在哪个物理块。同一逻辑位置的缓存换到另一块，它的 RoPE 位置不变；多条请求可以各有自己的位置 0，缓存仍各管各的。

压缩注意力要另看缓存里存的是什么、在哪里转。以上文代价一节说的 DeepSeek 式 MLA 为例，缓存每 token 存两段：潜向量从不旋转，只有并排的那一小段 RoPE 键在写入前转好。

在昇腾上，vLLM 的通用旋转模块——包括基础 RoPE、YaRN 缩放、DeepSeek 式缩放与[多模态 M-RoPE](multimodal-inference.md#m-rope怎样把二维空间与视频时间编进注意力旋转角)（按时间、高度、宽度三轴拆分旋转维度，编码图像块与视频帧位置）——在 `vllm-ascend` 启动时均替换为 Ascend 版本并改调 NPU 旋转算子，数学定义不变。

## 标准主干走读：Qwen3-8B 的全维 128 维 RoPE

在 `v0.30.0` 标准主基线下，**Qwen3-8B** 全 36 层同构，走最干净的全维 RoPE 路径：无部分旋转截断（`partial_rotary_factor = 1`），无默认 YaRN 缩放，靠大基数 `rope_theta = 1,000,000` 支撑官方模型卡标称的原生 `32,768` 上下文。`config.json` 的 `max_position_embeddings = 40,960` 是为输入加输出预留的上限配置值（不等同于原生训练长度），超 `32,768` 的长文本场景可按需配合 YaRN 扩展至 `131,072`。

- **执行顺序（逐头 QK-Norm 在 RoPE 之前）**：单卡 `TP=1`、本步 $T$ 个 token 经 `qkv_proj` 得到 `q [T, 32, 128]`、`k [T, 8, 128]`、`v [T, 8, 128]` 后，先对每个 128 维头独立执行 `q_norm` 与 `k_norm`（`eps = 1e-6` 的 RMSNorm），**再**对归一化后的 `q`、`k` 施加全维 128 维 RoPE，`v` 保持不转；随后把已旋转的 `k` 与原样 `v` 写入 KV cache。
- **半维配对与转速（64 对 `[-x_2, x_1]`）**：Qwen3-8B 采用 GPT-NeoX 前后半区配对（`is_neox_style = True`），把每个头的 128 维拆成前半 `x_1`（前 64 维）与后半 `x_2`（后 64 维）共 64 对；每对按 $[x_1, x_2] \odot \cos + [-x_2, x_1] \odot \sin$ 旋转。第 0 对转速 $\omega_0 = 1\text{ rad/位置}$（约 6.3 位置一圈），最慢的第 63 对转速 $\omega_{63} = (10^6)^{-126/128} \approx 1.24 \times 10^{-6}\text{ rad/位置}$（转满一圈约 506 万位置）。

| Qwen3-8B 单层 RoPE 关键步骤（TP=1，本步 $T$ 个 token） | 张量形状 | 说明 |
| --- | --- | --- |
| 投影拆出 `q` / `k` / `v` | `q [T, 32, 128]`、`k/v [T, 8, 128]` | GQA `32Q : 8KV`，头宽 $d_h = 128$ |
| 逐头 QK-Norm（`q_norm` / `k_norm`） | 形状不变 | 在 RoPE 之前对每条 128 维头独立做 RMSNorm |
| 全维 128 维 RoPE（64 对半维旋转） | `q [T, 32, 128]`、`k [T, 8, 128]` | `rope_theta = 1,000,000`，全维旋转，`v` 不转 |
| 写 KV cache 与 GQA 打分 | 缓存每层存旋转后 `k` 与原样 `v` | 后续 decode 直接复用已旋转历史 `k` |

**边界与例外。** 若部署时通过配置覆盖开启长上下文缩放（如 YaRN），触发条件是配置给出非空 `rope_scaling` 与 `factor`，变化结果是频率表按慢频段重算并并入温度缩放，须在文末对照源码核验推导上限与效果；若模型改用 `partial_rotary_factor < 1` 或 MLA 解耦旋转，则只对前 $d_r$ 维或独立位置段施加旋转。

## 复杂异构实战对照：MLA 解耦段与 GLM 双机 NoPE

跳出标准 GQA 的全维 128 维 RoPE，异构大模型在位置编码上会出现两类典型分叉：一是 **DeepSeek 式 MLA 的半维解耦**，把每个头拆成不旋转的内容段（如 128 维 `q_nope`/`k_nope`，可与解压矩阵提前吸收合并）与独立旋转的位置段（如 64 维 `q_pe`/`k_pe`，单独施加 RoPE 并紧邻压缩潜向量写入 KV cache）；二是 **历史 GLM-5.3-Flash 双机部署的彻底零维 NoPE**。

**例外 B 绑定算例结论：固定部署的 GLM-5.3-Flash 在 45 层主干里没有一处做 RoPE 旋转。** 固定配置把 RoPE 维数设为 0，同时声明稀疏 MLA 不用位置编码（NoPE，No Position Embedding），也没有给出任何 RoPE 参数。官方部署是 [2 台 A2 各 8 卡、TP8 / DP2 / EP16、W8A8](glm-5-3-flash-two-node.md#部署前提)；RoPE 不涉及跨卡通信，也没有权重，所以这些切分对本页没有影响，每张卡上的结论都一样。

```wiki-diagram
file: rope-glm
```

位置编号照样算：R1 第一步的 0、1、2、3 仍然传进每一层。区别在于各层拿它做什么。

长度相关的字段也不驱动旋转。固定配置里没有基数，也没有任何 RoPE 缩放字段；最大位置字段写的是 1,048,576，官方双机教程把服务的最大长度设为 133,120。RoPE 维数是 0，这两个数都不驱动任何旋转表，上文 YaRN 那一套缩放在这里无事可做。单条请求最长多少由部署参数给定，显存里能同时装下多少历史由 KV 预算决定，见 [glm-5-3-flash-two-node](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

### 稀疏 MLA：本该转的那一段是 0 维

上文代价一节讲过，一般的 MLA 把每个头的 q、k 分成两部分：不带位置的部分要和解压矩阵提前合并，所以不转；只有单独留出的 RoPE 部分旋转，潜向量也从不旋转。GLM 所用的 Ascend 实现同样按「潜向量 + RoPE 段」两段组织缓存，只是 RoPE 段宽度为 0，写入时只剩潜向量，见 [MLA](mla.md#glm-的这一配置不保存-rope-段)。GLM 的专用实现在构造 11 层稀疏 MLA 时，要同时满足三项才会建主注意力的旋转模块：RoPE 维数大于 0、这一层不是 NoPE、配置里有 RoPE 参数。本配置三项都不满足，旋转模块为空，前向不执行旋转。

| RoPE 维数为 0 时稀疏 MLA 的两处宽度 | 算式 | 结果 |
| --- | --- | --- |
| 每头打分宽度 | $256\text{（不带位置）} + 0\text{（RoPE）}$ | **256 维** |
| 主缓存每 token 每层宽度 | $512\text{（潜向量）} + 0\text{（RoPE 段）}$ | **512 维** |

每头打分宽度决定打分的缩放系数，推导见 [attention](attention-qkv.md#落到-glm-双机两类-attention-各改了哪一步)；512 维潜向量怎样压缩、怎样在潜空间打分，见 [MLA](mla.md)。加载权重时，实现里有一个为 NoPE 检查点补零的分支，只在 RoPE 维数大于 0 时才补；本配置维数为 0，不补。

### 索引器：也不转，压池时另有池内偏置

[稀疏 attention](sparse-attention.md) 的索引器先给历史打分、挑出要读的位置。它的 RoPE 维数直接取模型的 RoPE 维数，本配置为 0：构造时不建旋转模块，前向跳过旋转分支，q、k 保持未旋转。配置里“索引器用相邻配对”的开关只在有旋转时决定配对布局，本配置下不起作用。

索引器仍然用位置编号：它按位置把每 4 个 token 归成一个 pool，并限定因果范围。把 4 个 token 的键压成一个时，每个 token 先得到一组门控分数，再加上它在 pool 里所处槽位（0 到 3）对应的一组学到的偏置，在 4 个槽位间做 softmax 加权求和。这组偏置只区分 token 在池里排第几，是加法偏置，不是旋转，也不表示两个 pool 之间相隔多远。

### KDA：从来不用 RoPE

34 层 [KDA 线性注意力](linear-attention.md)的前向收下位置编号后立刻丢弃。它的顺序信息来自结构本身：q、k、v 先过一个核长 4 的短卷积，每个位置混入前 3 个位置的信息；状态再按位置逐个递推，带遗忘门，旧信息按通道衰减。KDA 不用 RoPE 是这个模型的设计选择，不是线性注意力用不了 RoPE：RoFormer 给出的用法见上文「为什么点积里只剩位置差」的第三条边界。

合起来，这套模型对 token 先后敏感的地方有三处：KDA 的短卷积与递推、索引器压池时的池内偏置、attention 的因果范围。三者的关系见 [GLM-5.3-Flash 的稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

## 常见误解

- **“RoPE 是把一条位置向量加到 q、k 上。”** 加法是绝对位置编码的做法。RoPE 是乘上一个旋转，不增加向量，也不改变每对分量的长度。
- **“RoPE 只编码相对位置，模型不知道绝对位置。”** 每条 q、k 都按自己的绝对位置转；只是两者做点积时，结果只依赖位置差。

- **“v 也要旋转。”** 只转 q 和 k；v 是被读走的内容，不参与打分，也不转。
- **“把最大位置字段或服务的最大长度调大，就能处理更长文本。”** 公式能算出任意位置的角度，但长文本质量仍要检验；采用 YaRN 等扩展方法时，应按方法评估是否需要续训，还要显存放得下对应的 KV。vLLM 的长度校验可能由配置中的 `model_max_length` 或环境变量放行，放行本身不保证效果。
- **“GLM 的稀疏 MLA 把 RoPE 用在 q、k 的 RoPE 部分。”** 一般的 MLA 确实只转那一部分；本配置这一部分是 0 维，主注意力和索引器都没有建旋转模块。
- **“配置里有索引器用相邻配对的开关，说明索引器在做 RoPE。”** 这个开关只在有旋转时选择配对布局；RoPE 维数为 0 时不起作用。
- **“GLM 没有 RoPE，所以模型不知道词序。”** 顺序信息来自 KDA 的短卷积与逐位置递推、索引器压池时的池内偏置，以及因果范围。
- **“线性注意力用不了 RoPE。”** RoFormer 论文给出了与线性注意力结合的写法；GLM 的 KDA 不用 RoPE，是模型结构的选择。
- **“block table 把缓存搬到别的块，RoPE 位置就变了。”** 旋转角度只由位置编号决定；块号只决定存在哪里，而 k 在写入时就已经按位置转好。

沿请求继续看[主线第 4 站的 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)；想知道没有 RoPE 时顺序从哪来，读 [KDA 线性注意力](linear-attention.md)；想看 MLA 为什么要把 RoPE 段分开存，读 [MLA](mla.md)。

## 对照源码

### 怎么开

RoPE 不是服务端开关，而是模型结构的一部分，由 Hugging Face 配置决定：

- `rope_parameters` 里的 `rope_theta`（基数）、`rope_type`（`default`、`linear`、`dynamic`、`yarn`、`llama3`、`longrope`、`deepseek_yarn` 等）、`factor`、`original_max_position_embeddings`，以及 `partial_rotary_factor` 或 `rope_dim`（参与旋转的比例或维数）。vLLM 的 `get_rope` 读取它们；字段缺省时基数按 10000、类型按 `default`、比例按 1.0 处理。
- 服务时如需覆盖配置字段，vLLM 提供 `--hf-overrides`；应采用与模型和扩展方法相符的参数。某些方法支持不续训地调整缩放，某些需要续训，二者都须验证目标长度上的效果。
- 最大长度由 `--max-model-len` 给定，vLLM 会拿它与配置推导出的上限比较。

GLM-5.3-Flash 没有可开的项：检查点写的是 `qk_rope_head_dim: 0`、`qk_nope_head_dim: 256`、`mla_use_nope: true`、`indexer_rope_interleave: true`、`max_position_embeddings: 1048576`，没有 `rope_theta` 和缩放字段。专用配置类把 `mla_use_nope` 映射为 `mla_nope`，`rope_parameters` 缺省为空。把 RoPE 维数改成非 0 不等于“打开 RoPE”：检查点里没有这段权重，镜像的加载函数只会补零，main 的 KPool 索引器会直接拒绝。

### 会报什么错

| 报错 | 在哪一步 | 含义 |
|---|---|---|
| `ValueError: partial_rotary_factor=... must be between 0.0 and 1.0` | vLLM 构造旋转模块 | 参与旋转的比例不在 (0, 1] |
| `ValueError: Unknown RoPE scaling type ...` | vLLM 构造旋转模块 | `rope_type` 不在支持列表里 |
| `User-specified max_model_len (...) is greater than the derived max_model_len (...)` | 引擎读取模型配置 | 最大长度超过推导上限，且独立 `model_max_length` 也未放行；设 `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` 可放宽校验，提示警告 RoPE 超限的 NaN 风险 |
| `GLM-5 Indexer requires rope_parameters when qk_rope_head_dim is non-zero.` | 镜像 GLM 专用实现构造 MLA | RoPE 维数非 0 却没有 RoPE 参数 |
| `GLM-5 Indexer requires rotary embedding when qk_rope_head_dim is non-zero.` | 镜像索引器前向 | RoPE 维数非 0 却没有传入旋转模块 |
| `GLM-Next KPool indexing supports NoPE queries only, got qk_rope_head_dim=...` | main 的 KPool 索引器构造 | main 只支持 RoPE 维数为 0 |

与 RoPE 缓存视图宽度相关的报错（缓存视图少于两份、RoPE 缓存宽度不等于 `qk_rope_head_dim`）属于稀疏 attention 的入口检查，见 [sparse-attention 的会报什么错](sparse-attention.md#会报什么错)。

### 开销和什么时候别开

- **计算**：每层对 q、k 的旋转维做逐元素乘加，与投影矩阵乘相比很小；Ascend 用 NPU 旋转算子执行。设备上的实际耗时尚未实测。
- **显存**：`cos_sin_cache` 形状为 [最大位置数, 旋转维数]，每个旋转模块一份；MLA 的 RoPE 段另外占缓存宽度。GLM 两者都是 0。
- **什么时候别动**：已训练好的模型不能随意开关 RoPE、改基数、改缩放或换配对布局，这些都会改变模型学到的角度含义；GLM 按检查点保持 NoPE。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；执行侧 GLM 双机算例固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`。

`v0.30.0` 与 `main` 保留旋转数学，但更新了 YaRN 参数、缓存归属与硬件分派：配套上游继续从 `rope_parameters` 读取 `rope_theta`（默认 10000）、`rope_type` 和 `partial_rotary_factor`（须在 `(0, 1]`），删除了旧快照的 `telechat3-yarn` 分派（继续传会落到 `Unknown RoPE scaling type`）；YaRN 透传 `mscale`、`mscale_all_dim`、`attention_factor`、`truncate` 等参数。Ascend 侧新增 `AscendGemma4RotaryEmbedding` 保留非旋转频率零填充的缓存构造；相邻配对按硬件 `FUSED_ROTARY_MUL_INTERLEAVE` 能力选择实现（不能拿 NeoX 半区配对套到 GPT-J/Kimi）；MLA/SFA 派生 `cos`/`sin` 登记为 owner 的非持久 buffer，使 sleep level 2 备份能看到它们并保留张量地址与图引用（该处有源码修复依据，无睡眠唤醒实测；固定 GLM 主干 NoPE 也不会因此新增旋转）。

| 核对项 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| vLLM `get_rope` 与缩放分派 | 默认基数 10000，支持 `yarn`、`deepseek_yarn` 等，未知类型报错 | 同 `v0.23.0` | 删除 `telechat3-yarn` 分派，YaRN 透传 `mscale` / `attention_factor` / `truncate`（`__init__.py#L32-L71`、`L345-L346`） | 同 `v0.30.0`（`__init__.py#L32-L71`、`L349-L350`） |
| Ascend 旋转算子替换族 | 替换 `RotaryEmbedding`、`YaRNScalingRotaryEmbedding`、`DeepseekScalingRotaryEmbedding`、`MRotaryEmbedding` | 同 `v0.23.0` | 新增 `AscendGemma4RotaryEmbedding`；相邻配对按 `FUSED_ROTARY_MUL_INTERLEAVE` 能力分派；含 `AscendMRotaryEmbedding`（`ops/rotary_embedding.py#L257-L426`、`L601-L740`） | 延续全部五类 Ascend 旋转子类与 `FUSED_ROTARY_MUL_INTERLEAVE` 能力分派（`ops/rotary_embedding.py#L303-L472`、`L647-L805`） |
| GLM 专用实现 | 维护分支无；专用镜像 `db701c1f` 的 `models/glm5_next.py` 主注意力需三项同时满足才建旋转，索引器维数 `> 0` 才建 | 维护分支无 | `models/glm5next/attention.py#L231-L266`：主注意力看 `skip_rope`（即 `mla_nope`）；稀疏配置下索引器传 0 维调 `get_rope`，KPool 索引器要求维数为 0，MLA 后端为 NoPE 备全零操作数 | 延续 `models/glm5next/attention.py#L244-L275` 同一 `skip_rope` 与 NoPE 约束 |

固定镜像、`v0.30.0` 和 `main` 中已有的 GLM 实现在这份配置下都不做主干 RoPE 旋转；表中没有 GLM 专用实现的 `v0.23.0` / `v0.26.0rc` 维护快照不能据此宣称支持该模型。GLM 配置与专用源码的钉点见[专用配置与源码基线](../sources/glm-5-3-flash-baseline.md)。

### 源码位置

| 位置 | 看什么 |
|---|---|
| vLLM `rotary_embedding/__init__.py` 63–72、243–384 行 | `get_rope` 的缺省值、旋转维数、`yarn` 与 `deepseek_yarn` 分支、未知类型报错 |
| vLLM `rotary_embedding/base.py` 80–103、160–201 行 | 频率 `inv_freq`、`cos_sin_cache`；按 `positions` 取行，前 `rotary_dim` 维旋转后与其余维拼接 |
| vLLM `rotary_embedding/common.py` 143–183 行 | `is_neox_style` 为真时前后半区配对，为假时相邻配对 |
| vLLM `config/model.py` 2178–2248 行 | 用缩放倍数推导最大长度，超限报错 |
| Ascend `worker/model_runner_v1.py` 863–868 行 | 位置编号 = 已算 token 数 + 本步序号 |
| Ascend `utils.py` 735–755 行、`ops/rotary_embedding.py` 216–250 行 | 通用旋转模块替换为 Ascend 版本，调用 NPU 旋转算子 |
| Ascend `models/glm5_next.py` 1965–2000、2089–2103 行 | MLA 与索引器的旋转模块在什么条件下建立；`skip_rope` 取自 `mla_nope` |
| Ascend `models/glm5_next.py` 1256–1269、1357–1383 行 | 索引器的 RoPE 维数、配对布局、池内偏置参数与旋转分支 |
| Ascend `ops/triton/glm5_next_lightning_indexer.py` 75–105 行 | 生产 Triton 路径按位置算因果 pool 数，并限制为已经写入的 pool 范围 |
| Ascend `ops/glm5_next_kpool_state_compress.py` 200–202 行 | 门控分数加池内偏置，在 4 个槽位间 softmax 后压成一个键 |
| Ascend `ops/indexer_kpool_mla.py` 70–71 行、`attention/indexer_kpool_mla_v1.py` 641–646 行 | 主缓存宽度 = 潜向量 + RoPE 段；NoPE 时只写潜向量 |
| Ascend `ops/kimi_kda.py` 244–251 行 | KDA 前向丢弃位置编号 |

索引器还有一处与数值类型有关的处理，见来源 14 的固定镜像 `glm5_next.py` 第 1357–1383 行：仅在 `rope_dim > 0` 时进入，并要求 `rotary_emb` 非空，否则报错。参与旋转的键分量 `k_pe` 先转为 BF16（一种低精度浮点格式），旋转后用 `.float()` 转回 FP32，再与保留 FP32 的 `k_nope` 拼接。第 1370–1374 行注释把这一步归因于旋转算子对 FP32 输入产生的差异超出普通舍入差异；这是该路径的源码解释，没有独立数值实验，不能推广为所有 RoPE 算子的行为。[I]

**来源索引。** RoPE 的定义、旋转公式、频率取值、相对位置等式、远程衰减、与线性注意力的结合、逐元素实现，以及“自注意力对位置无感”的动机，见 [S1]。PI、NTK-aware、NTK-by-parts、YaRN 的温度公式与续训开销，见 [S2]。vLLM 的频率与 cos/sin 表、按位置取行与部分旋转在 base.py [C4]，两种配对布局在 common.py [C5]；缺省基数、旋转比例与缩放类型分支在 get_rope [C7]，最大长度推导与报错在 model.py [C8]。GLM 固定配置字段 [S9]。MLA 与索引器的旋转构造条件 [C11][C12]；索引器的维数、配对布局、池内偏置参数与按位置限定因果 pool [C13][C27]，偏置参与压缩 [C15]；主缓存宽度与 NoPE 时只写潜向量 [C17]；KDA 丢弃位置编号 [C18]；位置编号的计算 [C19]；Ascend 替换旋转模块 [C20]；main 的 NoPE 限制 [C23]。首图每个位置转 20° 与 d_r = 8 的转速表是示意取值 [A]；256 + 0 与 512 + 0 两处宽度由配置字段相加得出 [D]。其余来源是上表各行的原始位置。

**待核。** 设备上 RoPE 算子的耗时未实测；本页不涉及长文本效果，也未实测；main 以 0 维构造的索引器旋转模块在前向中是否执行未核；池内偏置只核对了 PyTorch 写法的那条路径，融合算子内部未逐行核对。

**相对位置条件的推导范围。** 来源 4 的固定 `base.py` 第 160–201 行与来源 5 的 `common.py` 第 143–183 行中，q/k 共用 cos/sin 与分量配对方式，二维公式据此给出 `R(p)ᵀR(r) = R(r−p)`，与 RoFormer 论文的相对位置推导一致。同移位置时还须固定内容向量；这是数学表达式的推导，不保证有限精度计算逐位相同，也不保证所有位置缩放变体满足前提。[D] 设备数值行为仍需实测。
