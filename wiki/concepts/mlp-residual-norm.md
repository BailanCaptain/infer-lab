---
id: mlp-residual-norm
title: MLP、residual 与 RMSNorm：一个子层怎样更新 hidden
type: concept
legacyAnchors:
  到-glm-双机r1-的一个-token-怎样走过这三件东西: 复杂异构实战对照：GLM 双机 mHC 四流残差与限幅 SwiGLU
summary: >-
  以单条 residual、Pre-RMSNorm 与 SwiGLU 为主线，讲清「旁路保留输入 + 支路计算改变量 + 两路相加」。本页先走通标准
  Qwen3-8B（eps=1e-6、4096 → 12288 → 4096 无偏置 SwiGLU），再对照 LayerNorm/Post-Norm 与历史
  GLM 四流 mHC。
aliases:
  - MLP
  - FFN
  - 前馈网络
  - 前馈
  - 残差
  - residual
  - 残差连接
  - 归一化
  - LayerNorm
  - RMSNorm
  - 均方根归一化
  - pre-norm
  - Pre-Norm
  - post-norm
  - SwiGLU
  - SiLU
  - 门控前馈
  - 门控 MLP
  - swiglu_limit
  - 限幅
  - 中间宽度
  - intermediate_size
  - gate_up_proj
  - gate_up
  - down_proj
  - input_layernorm
  - post_attention_layernorm
  - AscendGlm5NextMLP
  - down-projection
  - qk-norm
  - Q/K Norm
  - QK归一化
chapters:
  - '03'
order: 70
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2105-L2131'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2189-L2241'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2285-L2318'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1460-L1525'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L46-L56'
  - 'vllm@0fc695fc:vllm/model_executor/layers/activation.py#L154-L184'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L756'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L109-L207'
  - 'vllm@0fc695fc:vllm/model_executor/layers/layernorm.py#L36-L102'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L28-L88'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L324-L350'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L736-L752'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L707-L723'
  - 'https://arxiv.org/abs/1512.03385'
  - 'https://arxiv.org/abs/1706.03762'
  - 'https://arxiv.org/abs/2002.04745'
  - 'https://arxiv.org/abs/1910.07467'
  - 'https://arxiv.org/abs/2002.05202'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L332-L337'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L104-L123'
  - 'vllm@0fc695fc:vllm/model_executor/models/deepseek_mtp.py#L44-L60'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L670'
  - >-
    https://github.com/huggingface/transformers/blob/5f4ecf2d9f867a1255131d2461d75793c0cf1db2/src/transformers/models/qwen3/modeling_qwen3.py#L62-L222
  - 'vllm@0fc695fc:vllm/model_executor/models/gpt2.py#L148-L242'
  - 'vllm@0fc695fc:vllm/model_executor/models/opt.py#L135-L197'
  - >-
    raw:sha256-4ab7e73c387e02fa495bfbe220b05cd5f6cc95516c5ddbc1ec4aa358c22ff820.md#L1-L859
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L324-L349'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L499-L514'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/shared_experts.py#L437-L453'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L841-L866'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L345-L358'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L535-L613'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L153'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L325-L335'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L869-L885'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L118-L160'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L354-L364'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L896-L912'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: gate、up、down 三个投影怎样做矩阵乘、为什么没有偏置、W8A8 权重怎样转置存放
  - to: embedding
    kind: builds-on
    note: 嵌入表查出的初始隐藏向量沿着残差流进入各层的归一化与前馈子层
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-453fdb48c994a96c6b4491804bc60fc5843f28e98d22cbbc3104e5f675b3ed30.md
  - >-
    raw/sha256-4ab7e73c387e02fa495bfbe220b05cd5f6cc95516c5ddbc1ec4aa358c22ff820.md
  - >-
    raw/sha256-893cf753fd3eee39fe5fdc4f2aa6b2c8c385f9f6fa98ce035b2ce514a432809d.md
---

## 一个子层怎样更新 hidden，又不丢掉原来的输入？

**主流大模型（如 `v0.30.0` 标准主基线下的 `Qwen3-8B`）采用「单条 residual（残差连接）+ Pre-RMSNorm + SwiGLU」的子层结构：一条旁路把输入原样送到出口，另一条支路先做 RMSNorm 再做计算，最后把支路算出的改变量加回输入。** 归一化也可以改用 LayerNorm 或放到相加之后（post-norm）；下文先讲清标准单残差流机制与 `Qwen3-8B` 形状，再在后半「复杂异构实战对照」展开多流残差混合。

这里的 hidden 是模型给每个输入位置维护的一条中间向量，宽度记作 H（见[层与 hidden](layers-and-hidden.md)）。RMSNorm（均方根归一化）把这条向量除以它自身的均方根、再逐维乘一组学到的系数，让送进支路的数值大小保持稳定。MLP（前馈网络，也叫 FFN）是对每个位置单独做「升宽 → 非线性 → 降回原宽」的一个小网络。下图以 MLP 子层为例：

```wiki-diagram
file: mlp-residual-layer
```

顺着图看三步：

1. **分两路。** 上面的 residual 旁路不乘任何权重，x 原样走到出口。下面的支路才做计算，而且只在支路入口做 RMSNorm；旁路上的 x 不被归一化。这种把归一化放在支路入口的排法叫 pre-norm。
2. **支路算改变量。** gate 和 up 两个投影把 H 维升到更宽的 F 维；gate 这一路过 SiLU（一种平滑的非线性函数），再和 up 逐元素相乘；down 投影把结果降回 H 维，得到改变量 Δ。
3. **相加。** y = x + Δ。两路逐元素相加，形状必须一样，所以支路最后一定回到 H 维。

MLP 对每个位置各算一遍，所有位置共用同一套权重，位置之间不交换信息；在位置之间搬运信息是注意力子层的事。MLP 的输入已经带着注意力汇总来的上下文，所以它加工的是「这个位置在上下文里的表示」。在这个示例里，一层由两个这样的子层串成：先注意力子层，再 MLP 子层，两段都套着同一种「旁路 + 归一化支路 + 相加」的结构。

## 为什么要这条旁路和归一化，代价在哪？

**旁路让深网络训得动，归一化让每个子层看到的输入尺度稳定；两者在推理时都只花很少的计算，但都删不掉。** 下面分三件讲，最后说 MLP 本身为什么值得占一半子层。

### 残差连接保留一条输入路径

单条 residual 的 pre-norm 子层写成 **Y = X + F(Norm(X))**：F 是注意力或 MLP，Norm 是所选的归一化，本页示例取 RMSNorm，GPT-2 则取 LayerNorm；X 同时沿旁路直接参与最后的相加。

**为什么深网络需要它。** 残差网络 ResNet 的作者发现，没有旁路时把网络加深，连训练误差都会变高，这不是过拟合，而是深层网络本身难以优化；改成让每层只学「在输入上改多少」（F(x) = 目标 − x），再把输入加回来，几十上百层也能训下去。恒等旁路不带参数，也几乎不增加计算。从梯度（训练时告诉每个权重该往哪个方向改、改多少的信号，从输出一层层往前传）看，Y 对 X 的导数是「单位矩阵 + F 的导数」，其中单位矩阵那一项让梯度不必穿过每一层的权重，就能沿旁路直接传回前面的层。

**为什么推理时不能去掉。** 每个子层训练出来的就是「改变量」，不是一份完整的新表示。拿掉加法，子层输出就不再是模型训练时的那个函数，结果会完全不同。residual 和 dropout（训练期随机丢弃部分神经元以防过拟合的手段）这类只在训练时起作用的手段不同，它是模型结构的一部分。

**边界情况。** 相加要求两路形状一致，这就是支路最后一定回到 H 维的原因。加法本身不限制改变量的大小：子层输出可以很大，也可以接近零。原输入参与新结果，但下一层拿到的是相加后的 y，旁路并不把一份永远不变的原始表示一直传到最后。

**代价。** 每个子层多一次逐元素加法；从子层开始到相加之前，要一直留着 x（每个位置 H 个数）。和 MLP 的矩阵乘比，这点计算与显存都很小。GLM 把一条旁路扩成了四条并加上可学习的混合，这部分代价才变得可观，见本页后文和[层与 hidden 的代价一节](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)。

### RMSNorm 怎样调整向量尺度

**RMSNorm 按一个位置的 H 维向量的均方根缩放，再逐维乘可学习的增益 γ；与 LayerNorm 的核心区别是不用均值做中心化。** 下面采用没有偏移项的 RMSNorm 公式；是否另带偏移由具体模型与实现决定。

层层把改变量加到 residual 上，这条向量的数值大小会随层数漂移；归一化让每个子层拿到的输入落在可控的尺度上。LayerNorm 对同一位置的各维先减去均值、再除以标准差，然后乘 γ、加偏移；RMSNorm 的论文认为起作用的主要是「按大小缩放」而不是「减均值」，于是去掉了减均值这一步，只按均方根缩放。论文在多种模型上报告，效果与 LayerNorm 相当，运行时间更短。

对一个位置的向量 x：

```text
r  = sqrt((x₀² + x₁² + … + x_{H−1}²) / H + ε)
yᵢ = γᵢ × xᵢ / r
```

ε 是一个很小的常数，防止分母过小。这个运算只在同一个位置的 H 维之间求平方均值，不在不同 token（模型输入的一个个单位，每个 token 占一个输入位置）之间求平均，输出宽度不变。它也不会把各维变得一样大：除以同一个 r 保留了各维之间的比例，γ 又是每维各学一个。拿两维的小例子对照两种归一化：

| 归一化方式（示意：$x = [3, 4]$，$\gamma = 1$，偏移与 $\varepsilon$ 取 0） | 统计量计算 | 逐维输出 |
| --- | --- | --- |
| **RMSNorm** | 均方根 $r = \sqrt{(3^2 + 4^2) \div 2} = \sqrt{12.5} \approx 3.536$ | 第 0 维 $3 \div 3.536 \approx \mathbf{0.849}$；第 1 维 $4 \div 3.536 \approx \mathbf{1.131}$ |
| **LayerNorm** | 均值 $\mu = (3 + 4) \div 2 = 3.5$；标准差 $\sigma = \sqrt{((3 - 3.5)^2 + (4 - 3.5)^2) \div 2} = 0.5$ | 第 0 维 $(3 - 3.5) \div 0.5 = \mathbf{-1}$；第 1 维 $(4 - 3.5) \div 0.5 = \mathbf{1}$ |

RMSNorm 的输出仍是 `3 : 4`，方向不变，只是把长度缩放到均方根为 `1`；LayerNorm 先扣掉两维均值 `3.5`，输出落到 `[-1, 1]`。RMSNorm 省去求均值与减均值，每次只需一次平方和归约。

下图把本节最核心的三处几何与结构对照合在一张画布上：左栏看 RMSNorm 与 LayerNorm 的二维向量变化，中栏看 Pre-Norm 与 Post-Norm 的残差轨位置，右栏看 Qwen3 逐头 Q/K Norm 与共享增益顺序：

```wiki-diagram
file: mlp-fig-norm-placement-and-qknorm
```

### 归一化为什么放在支路入口

**pre-norm 只归一化支路输入，旁路从头到尾保持恒等；原始 Transformer 则把归一化放在相加之后，叫 post-norm。**

原始 Transformer 的子层写法是 `Norm(x + F(x))`：先相加，再对和做归一化。pre-norm 分析论文在其初始化假设下发现，post-norm 靠近输出的几层梯度偏大，直接用大学习率可能不稳定（学习率「预热」指训练初期先小步更新、再逐步加大幅度）。

在所测翻译与 BERT 设置中，改用 pre-norm（`x + F(Norm(x))`）可以去掉预热并稳定训练；但论文也报告 RAdam 能在某次 post-norm 翻译实验中不预热训练，不能把预热说成由归一化位置决定的必要条件。此外，pre-norm 只规定归一化的位置，不规定用 RMSNorm 还是 LayerNorm。下面对比单条残差的两种排法（末行列出常见模型设计）：

| | post-norm | pre-norm |
|---|---|---|
| 归一化的位置 | 两路相加之后 | 支路入口 |
| 旁路上的 hidden | 每个子层都被归一化一次 | 从第一层到最后一层都不经过归一化 |
| 最后一层之后（常见设计） | 子层输出已经过归一化 | 通常另设最终归一化，再做输出投影 |

pre-norm 的旁路保留累加后的数值，因此模型常在整叠层之后另设最终归一化，调整送入输出投影的尺度；是否设置、采用哪种归一化仍由模型结构决定。固定源码中的 GPT-2 末尾用 LayerNorm，本页 GLM 末尾用 RMSNorm，不能仅凭 pre-norm 这个排法推出末尾必须是 RMSNorm。

### Q/K Norm：先按头归一化，再加入位置

**Q/K Norm 在注意力内部调整 Q、K 的尺度：每个 token 的每个头，分别按头内各维做归一化。** Q 是当前位置的查询向量，K 是被查询位置的键向量，两者做点积得到注意力分数；一个头是独立计算这组分数的一条通道，见 [Attention 与 Q/K/V](attention-qkv.md#多头同一个位置同时按几套方式去读)。下面讲课程采用的 **Qwen3 / Transformers v4.51.3 实现**：它在 Q、K 投影后做逐头 RMSNorm，再做 [RoPE](rope.md)（按位置旋转 Q、K）。V 是用来加权汇总的内容向量，这一步不对 V 做归一化。

为什么在这里再调一次尺度：Q、K 已经过各自的投影，大小可以不同；点积同时受方向和两条向量的大小影响。逐头 RMSNorm 先按各自的均方根缩放，再乘学到的增益，让进入打分的尺度由这一层的计算和参数共同控制。它是 Qwen3 模型结构的一部分，推理时应沿用训练时的顺序，不能把普通模型临时加上这一步当作等价优化。

| 比较项 | 子层入口的 pre-norm | 这里的 Q/K Norm |
|---|---|---|
| 处理哪条向量 | 每个 token 的整条 hidden | 每个 token 的每个 Q 头、每个 K 头 |
| 求平方均值的范围 | hidden 宽度 H | 单个头的宽度 dₕ |
| 在注意力里的位置 | Q/K/V 投影之前 | Q/K 投影之后、RoPE 之前 |

计算沿用上面的 RMSNorm 公式，只把求平均的范围从 H 换成 dₕ。接着同一组示意数：某个头的 q = [3, 4]，取 γ = 1、ε = 0，输出仍是已经算出的 [0.849, 1.131]；另一个头即使是 [6, 8]，也要用它自己的均方根 7.071，输出同样约为 [0.849, 1.131]。两个头各算各的，不能把四个数拼起来求一个均方根。这里调到的是均方根为 1，向量的长度为 √2；一般的可学习 γ 和非零 ε 又会改变这个结果，所以不能把它叫作“单位长度归一化”。

把批大小记作 B、token 数记作 T，Q/K 头数分别记作 n_q、n_kv，Q 的形状是 [B, T, n_q, dₕ]，K 是 [B, T, n_kv, dₕ]。这一步只沿最后一维求均值，形状不变，不混合不同 token 或不同头。**计算按头独立，增益参数却在同一层的各个头之间共享**：Q 一组 dₕ 个参数、K 另一组 dₕ 个参数，共 2dₕ 个；并非每个头各学一套。每个 token 多做 n_q + n_kv 次头内归一化，每次处理 dₕ 个数；实际耗时取决于实现，本页没有硬件实测。

GLM 主线里也有注意力内部的 RMSNorm，但处理的是低秩向量，具体范围见后文“哪几层和一般走法不一样”。不能把上面的 Qwen3 逐头顺序直接套到 GLM 双机。

### MLP 为什么值得占一半子层

注意力按权重汇总其他位置的信息，MLP 再对每个位置内部的各维做非线性变换。它通常占稠密 Transformer 的很大一部分参数和矩阵乘；具体占比取决于中间宽度、注意力结构和词表大小。这里的 SwiGLU 有 gate、up、down 三个逻辑投影；本页实现把 gate/up 合并，所以前向有两次投影调用。普通张量并行（TP，把一个矩阵切到多张卡上一起算）基线还在末尾合一次数值；序列并行可能改成 Reduce-Scatter，见[TP 页的稠密 MLP 一节](tensor-parallel.md#再过稠密-mlp本地升维和门控降维后再合齐)。

## 前馈网络怎样变换一个位置的特征

**MLP 对每个位置单独做「升宽 → 非线性 → 降回」；主流大模型（如 `Qwen3-8B` 与 GLM）采用的门控写法 SwiGLU 多一个投影，由输入自己决定中间每一维放大多少。**

### 普通两投影 MLP：非线性不能省

原始 Transformer 的 MLP 是两个投影夹一个激活：**Y = φ(X·W₁)·W₂**。W₁ 把 H 维映射到中间宽度 F，φ 是逐元素的非线性激活（原文用 ReLU），W₂ 再映射回 H 维。这里省掉了偏置：原文两个投影各带一个偏置，写作 max(0, X·W₁ + b₁)·W₂ + b₂；`Qwen3-8B` 与 GLM 的三个投影都去掉了偏置，所以后文一律不写。如果省掉 φ，两次线性变换 X·W₁·W₂ 等于乘一个合并后的矩阵，再多的参数也只相当于一次线性变换；非线性让中间 F 维可以表达「某些特征组合出现时才起作用」这类关系。

### 门控 MLP：SwiGLU

**门控（gating）是把同一个输入投影成两路：一路算「内容」，一路算「中间每一维开多大」，两路按元素相乘。门开得大的维度，内容多传过去；门接近零的维度，内容几乎被关掉。**

为什么要单独一路门：普通 MLP 里，中间一维传出多少只由这一维自己的值决定，比如 ReLU 把负数整个砍成 0，「传不传」和「传什么」是同一个数。门控 MLP 让另一路投影专门决定每一维放行多少，「开多大」和「传什么」各有一组权重，分开学。SwiGLU 的论文在参数量和计算量对齐的条件下比较，门控写法训练出的模型效果好于普通两投影 MLP；论文只报告了实验结果，没有解释为什么更好。

门控 MLP 保留「H 维进、H 维出」的接口，在中间多加一条由同一输入产生的投影，用逐元素乘法去调节另一条。SwiGLU 用 SiLU 构造这道门，`Qwen3-8B` 的 36 层稠密 MLP，以及 GLM 的稠密 MLP 和每个专家都是这种结构。把一个位置的输入记作 X，宽度 H；中间宽度记作 F：

```text
g = X · W_gate        W_gate: [H, F]
u = X · W_up          W_up:   [H, F]
z = SiLU(g) ⊙ u       ⊙：对应元素相乘
Y = z · W_down        W_down: [F, H]
```

g 这一路算门，u 这一路是内容。SiLU(g) = g × sigmoid(g)，其中 sigmoid(g) = 1 ÷ (1 + e⁻ᵍ)，把任意一个数压到 0 和 1 之间。

拿首图那个子层手算一遍：接着 RMSNorm 一节的 x = [3, 4]，所以 H = 2；中间宽度取 F = 4，三组权重都是编的小整数。下图每一列是中间的一维，从上往下看：g 过 SiLU 变成门，门和同一列的内容 u 相乘得到 z；最后 down 投影把 4 个数缩回 2 个，得到改变量 Δ，再加回旁路上的 x。

```wiki-diagram
file: mlp-swiglu-calc
```

$$\text{SiLU}(g) = g \cdot \sigma(g) = \frac{g}{1 + e^{-g}}, \qquad z = \text{SiLU}(g) \odot u, \qquad y = x + \Delta$$

以下用示意数逐步手算（每步沿用上一行保留两位小数的结果，$\sigma(g)$ 保留三位小数）：

| 步骤 | 权重列 / 算式 | 结果向量 |
| --- | --- | --- |
| ① 入口归一化 $n$ | $\text{RMSNorm}([3, 4])$（即前文 $[0.849, 1.131]$ 两位取舍） | $[0.85, 1.13]$ |
| ② 门控投影 $g = n W_{\text{gate}}$ | $W_{\text{gate}}$ 四列为 $[1, 1]$、$[-1, -3]$、$[-1, 1]$、$[0, 1]$；如第 0 维 $0.85 \times 1 + 1.13 \times 1 = 1.98$（其余三列同理点积） | $[1.98, -4.24, 0.28, 1.13]$ |
| ③ 内容投影 $u = n W_{\text{up}}$ | $W_{\text{up}}$ 四列为 $[0, 1]$、$[1, 1]$、$[-2, 0]$、$[1, -2]$ | $[1.13, 1.98, -1.70, -1.41]$ |
| ④ 门系数 $\text{SiLU}(g)$ | $\sigma(g) = [0.879, 0.014, 0.570, 0.756]$，再逐维乘 $g$ | $[1.74, -0.06, 0.16, 0.85]$ |
| ⑤ 逐维相乘 $z = \text{SiLU}(g) \odot u$ | $[1.74 \times 1.13,\; -0.06 \times 1.98,\; 0.16 \times (-1.70),\; 0.85 \times (-1.41)]$ | $[1.97, -0.12, -0.27, -1.20]$ |
| ⑥ 降维投影 $\Delta = z W_{\text{down}}$ | $W_{\text{down}}$ 两列 $[1, 1, -1, 1]$、$[0, 1, 1, -1]$：第 0 维 $1.97 \times 1 + (-0.12) \times 1 + (-0.27) \times (-1) + (-1.20) \times 1 = 0.92$；第 1 维 $1.97 \times 0 + (-0.12) \times 1 + (-0.27) \times 1 + (-1.20) \times (-1) = 0.81$ | $[0.92, 0.81]$ |
| ⑦ 残差相加 $y = x + \Delta$ | $[3 + 0.92,\; 4 + 0.81]$ | **$[3.92, 4.81]$** |

四列对照着看：内容最大的是第 1 维（1.98），但它的 g 是 −4.24，门只有 −0.06，这一维几乎被关掉，只剩 −0.12；第 0 维的门是 1.74，内容 1.13 被放大到 1.97；第 2 维的 g 接近 0，门 0.16 把 −1.70 压到 −0.27；第 3 维的门 0.85，把 −1.41 略缩成 −1.20。放大、关掉还是压小，都是同一个输入 n 经 gate 投影算出来的，这就是「由输入自己决定中间每一维放大多少」。第 1 维的门略小于 0，是因为 SiLU 在负半轴会给出很小的负数，乘出来的符号也跟着翻了，但量已经很小。

SiLU 是连续的函数：g 越大越接近 g 本身（g = 1.98 时已是 1.74），g 很负时接近 0（g = −4.24 时只有 −0.06）。所以门控分支给出的是一组连续的缩放系数，由输入决定 u 的每一维被放大、缩小还是压到接近零，并不是一组离散的开或关。SwiGLU 改变的是中间计算的结构，三组权重要按这个结构训练出来；它不是运行时可以给普通两投影 MLP 随手打开的开关。

### 限幅：gate 只限上界，up 两边都限

标准 `Qwen3-8B` 直接计算无截断的 $\text{SiLU}(\text{gate}) \odot \text{up}$。部分异构模型（例如后文历史 GLM 配方中 `swiglu_limit = 10`）则会在 SiLU 之前先把两路输入夹住：**`gate` 只限上界（不超过 10），`up` 限在 −10 到 10 之间**，再相乘。夹的是门控的输入，不是乘完之后的输出。

`gate` 只需限上界，是因为 SiLU 在负半轴天然有界：输入很负时输出趋于 0（最小值约 −0.28），正半轴则随输入线性增长。上界夹在 10 后，$\text{SiLU}(\text{gate})$ 最大约 10；再乘绝对值不超过 10 的 `up`，中间向量每维绝对值被压在约 100 以内，避免两路同时偏大导致乘积失控（下例不截断为 −156）。配置未解释为何选 10，这里只记录它把中间值限在有限范围内的效果。

换一组大一些的示意数看限幅怎样起作用：某一维 gate = 13、up = −12，另一维 gate = −15。

$$\text{gate}' = \min(\text{gate},\; 10), \qquad \text{up}' = \text{clamp}(\text{up},\; -10,\; 10)$$

| 限幅示意维度（上限 10，数为示意） | 截断与计算过程 | 结果与对比 |
| --- | --- | --- |
| $\text{gate} = 13,\; \text{up} = -12$ | $\text{gate}' = \min(13, 10) = 10$；$\text{up}' = \max(-10, \min(-12, 10)) = -10$；$\text{SiLU}(10) = 10 \times 0.99995 \approx 10.00$ | 中间值 $10.00 \times (-10) = \mathbf{-100}$（不截断为 $\text{SiLU}(13) \times (-12) \approx -156$，超出约 100 范围） |
| $\text{gate} = -15$ | 未超过上界 10，不截断；$\text{SiLU}(-15) = -15 \times \sigma(-15)$ | 约 $\mathbf{-0.0000046}$（SiLU 负半轴天然趋于 0，故 `gate` 不必限下界） |

```wiki-diagram
file: gated-ffn
```

形状上，输入和输出都是 [T, H]，中间两路各是 [T, F]，T 是本轮输入的位置数。实现把 gate 和 up 两个投影合并成一次矩阵乘，输出 [T, 2F]，前一半当 gate、后一半当 up，交给激活函数拆开；合并只是少发一次调用，两组权重和之后的拆分都还在。

### 中间宽度 F

**中间宽度 F 是 MLP 升宽后的那一维，它决定 MLP 的参数量和计算量。** 原始 Transformer 取 $F = 4H$（$H = 512$ 时 $F = 2048$）。SwiGLU 有三个投影，比普通 MLP 多一个；SwiGLU 原论文为与普通 MLP 保持等量参数与计算，把 $F$ 缩到原来的 $2/3$，即约 $8H/3$。

实际模型按算力与对齐需求选定 $F$。以 `v0.30.0` 标准主基线下的 **Qwen3-8B** 为例：隐藏宽度 $H = 4096$，稠密 SwiGLU 中间宽度 $F = 12288 = 3H$（比 $8H/3$ 略宽，且是 128 的整数倍，便于硬件分块与 TP 切分）。若是 MoE 模型（如后文 GLM 专家），单个专家则用更窄的 $F$，靠多个专家并联分担。

## 标准主干走读：Qwen3-8B 的单残差流 Pre-RMSNorm 与 SwiGLU

在 `v0.30.0` 标准主基线下，**Qwen3-8B** 全 36 层结构完全同构，是最标准的「单残差流 Pre-RMSNorm + 无偏置 SwiGLU」样板：

- **单条残差与 Pre-RMSNorm**：每层包含 Attention 与 MLP 两个子层，全部遵循 $y = x + F(\text{RMSNorm}(x))$，其中 $\varepsilon = 10^{-6}$（`rms_norm_eps = 1e-6`）。上一子层输出与残差相加时，昇腾 NPU 直接走融合算子 `npu_add_rms_norm`，把「残差加回 + 下一子层入口归一化」合并执行，省去一次中间 HBM 读写。
- **SwiGLU 形状流转（`4096 → 12288 → 4096`）**：三个投影均无偏置（`bias = false`）。实现将 `gate_proj` 与 `up_proj` 合并为一次 `gate_up_proj` 输出 `[T, 24576]`，再由 `AscendSiluAndMul` 拆半计算 $\text{SiLU}(\text{gate}) \odot \text{up}$ 得到 `[T, 12288]`（无 `swiglu_limit` 限幅）。最后经 `down_proj` 压回 `[T, 4096]` 加回单残差流。

| Qwen3-8B MLP 子层步骤（单卡 TP=1，T 个 token） | 输入形状 | 权重或运算 | 输出形状 |
| --- | --- | --- | --- |
| 入口 Pre-RMSNorm（`eps = 1e-6`） | `[T, 4096]` | 增益 $\gamma\;[4096]$（可与上步残差融合） | `[T, 4096]` |
| 合并门控投影 `gate_up_proj` | `[T, 4096]` | `[4096, 24576]`（无偏置） | `[T, 24576]` |
| 门控融合激活 `AscendSiluAndMul` | `[T, 24576]` | 拆半计算 $\text{SiLU}(\text{gate}) \odot \text{up}$ | `[T, 12288]` |
| 降维投影 `down_proj` | `[T, 12288]` | `[12288, 4096]`（无偏置） | `[T, 4096]` |
| 单流残差加回 | `[T, 4096] + [T, 4096]` | 逐元素相加（合并进下一子层 `npu_add_rms_norm`） | `[T, 4096]` |

全部 36 层都重复这张表，最后一层结束后再补一次最终 RMSNorm，才送入 `lm_head`。只有遇到多流残差混合或带限幅激活的异构架构时，才会跳出这条简洁主线——下面转入历史 GLM 双机对照。

## 复杂异构实战对照：GLM 双机 mHC 四流残差与限幅 SwiGLU

本节为例外 B 历史绑定算例：两台 Atlas 800 A2、每台 8 卡，TP8 / DP2 / EP16、权重 W8A8（详见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。沿用主线示例请求 R1（prompt 4 个 token，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），prefill 一次处理 $T = 4$ 个位置。三件东西位于主线第 4 站「逐层前向」，下图对照主干四流与 MTP 单流：

```wiki-diagram
file: mlp-residual-norm-flow
```

左栏是主干 45 层的走法，右栏是 MTP 层的走法。两栏的 RMSNorm 和 MLP 一样，区别只在「旁路」怎么接：右栏就是本页首图的单条 residual；左栏把旁路换成了四条流。

### 子层入口：四条流先混成一条，再做 RMSNorm

**GLM 主干不是直接算 x + F(Norm(x))。它在层与层之间传四条并行的 residual 流，每个子层入口先把四条按由当前输入算出的系数混成一条 [4, 4096]，再做本页的 RMSNorm；子层输出也按系数写回四条，代替单条的相加。** 这套多路残差连接叫 mHC，混合、写回怎样计算，每层因此多花多少，都在[层与 hidden](layers-and-hidden.md#一层接过什么交出什么glm-为什么在层间传四条)讲。

子层前的 RMSNorm 和前文公式完全一致：作用在混出来的 4096 维向量上，γ 有 4096 个数，每个子层各有一组，ε 取配置里的 0.00001。主干每层两个子层，45 层共有 90 个子层前 RMSNorm，最后一层之后还有 1 个。mHC 入口混合时也做了一次 RMSNorm，但那一次作用在四条拼起来的 16384 维长向量上，不带 γ，只用来算混合系数；两种别混，区别见[层与 hidden 的逐层走读](layers-and-hidden.md#r1-的-hidden-一路走下来)。

### 前 3 层：稠密 MLP

**第 0–2 层的 MLP 子层是 4096 → 12288 → 4096 的 SwiGLU，限幅为 10，所有 token 共用同一套权重。** 这 3 层的注意力是 [KDA](linear-attention.md)（一种用固定大小状态汇总历史的线性注意力），只有 MLP 是稠密的。

TP8 下，这对矩阵按「先列后行」切：每卡持有 gate 和 up 各 1536 个输出通道，合并投影输出 3072 列；本卡直接做限幅 SwiGLU，剩下 1536 列；down 投影接住这 1536 列，算出形状完整、数值只是部分和的 [4, 4096]，末尾一次 TP8 All-Reduce 合齐。R1 的每卡路径是 [4, 4096] → [4, 3072] → [4, 1536] → [4, 4096]，这次 All-Reduce 的载荷是 32,768 B。为什么非得先列后行，见[TP 页的稠密 MLP 一节](tensor-parallel.md#再过稠密-mlp本地升维和门控降维后再合齐)；每卡形状、字节和通信次数的账在[主线的稠密 MLP 一站](one-request.md#前-3-层的稠密-mlp)。三个投影都没有偏置，W8A8 的 int8 权重怎样转置存放、怎样做量化矩阵乘，见[矩阵乘和权重](matmul-and-weights.md#gate-与-up-扩宽down-再缩回去)。

下面的 3D 把 GLM 主干单层里的「四流残差入口混合 → 限幅 SwiGLU 前馈 → 写回增量」缩小为一组 **4 → 6 → 4 的独立示意算例**，让完整结构与权重矩阵的行列更容易逐格辨认；它与前文标准节 2 → 4 → 2 手算表使用不同数值，计算规则相同。输入 n 为 `[0.85,1.13,0.5,−0.75]`，两组 4×6 权重分别生成六通道的 gate 和 up；所有权重格保留在图中，当前计算列突出显示。图中展开当前列的四项乘加，结果写回对应的输出格；其他列按同样规则得到，可切换通道检查。

完整前馈结构始终保留，放大的计算完成后写回原位。门控将六个通道按列对齐：上排原值，中排系数，下排结果，同一列相乘，不跨列相加。空心轮廓保留原值，实体深度对照放大、压小和变号，得到 `[3.73,−0.07,−0.06,0.01,−0.99,−0.29]`。最后读取全部六个通道，乘 6×4 的 down 权重，分别求出四列的和 `[3.44,−1.13,4.38,−4.49]`。数值按图中精度逐步取舍；可切换中间通道和 down 输出，检查每个结果对应哪一列。

```wiki-scene
model-compute:2
```

### 后 42 层：MLP 换成 MoE

**第 3–44 层把一个稠密 MLP 换成 MoE：每层有 288 个 routed experts 和 1 个 shared expert。** routed experts（路由专家）指整个可供 router 选择的专家集合，router 为每个 token 从这 288 个里选 8 个；shared expert（共享专家）是所有 token 都要经过的那一个。每个专家内部仍是本页的门控 MLP，限幅同样是 10，只是中间宽度窄得多：

| 前馈部件 | 输入 H | 中间 F | 输出 H |
|---|---:|---:|---:|
| 稠密 MLP（第 0–2 层，每层 1 个） | 4096 | 12288 | 4096 |
| 单个 routed expert（第 3–44 层，每层 288 个） | 4096 | 2048 | 4096 |
| shared expert（第 3–44 层，每层 1 个） | 4096 | 2048 | 4096 |

稠密 MLP 用一个很宽的中间层服务所有 token；MoE 用很多窄专家，每个 token 只经过其中 8 个 routed experts 加 1 个 shared expert。子层外面的 RMSNorm 和四条流与稠密层完全一样，变的只是支路里的 MLP。router 怎样打分、选中的结果怎样加权合并，见 [MoE](moe.md)；288 个 routed experts 怎样按 EP16 分到 16 张卡，见[专家并行](expert-parallel.md)；shared expert 不按 EP 分，它在 TP8 下的切法见[TP 页的共享专家一节](tensor-parallel.md#共享专家切法仍是列接行归约由外层安排)。

## 哪几层和一般走法不一样？

**一般层就是上面的「入口混合 → RMSNorm → 子层 → 写回混合」；特殊的只有首尾两层、MTP 层（块外另有三次 RMSNorm），以及稀疏 MLA 内部多出的两次 RMSNorm。**

- **第 0 层入口。** 词嵌入给出的是一条 `[4, 4096]`，进第 0 层时先复制成四条，之后才有「四条混成一条」。
- **第 44 层出口。** MLP 段写回之后，四条流沿同一 token 位置的残差流维直接求平均回到一条（保留 token 位置和 hidden 宽度，区别于子层入口按可学习系数混合）。随后在层外补做一次最终 RMSNorm（即 pre-norm 表里的末尾归一化），最后交给输出投影算每个词的分数。
- **MTP 层。** 模型附带的第 45 层用于投机解码草拟候选，不属于 45 层主干。它不走 mHC，而是标准单条 pre-norm 写法：暂存 x、RMSNorm、稀疏 MLA、相加，再暂存、RMSNorm、MLP、相加。它的 MLP 是 MoE：配置里逐层标注 MLP 类型的列表只覆盖 45 层主干，编号 45 超出列表时代码取最后一项（MoE；用途与两路输入见[模型总览的 MTP 一节](glm-5-3-flash.md#mtp主干之外的第-45-层)）。除块内两个子层前各 1 次外，块外还有 3 次 RMSNorm（公式相同，各有一组 `4096` 个数的 $\gamma$）：
  - **进块前 2 次。** MTP 层有两路输入：下一个 token 的词嵌入与主干传来的 hidden。词嵌入先做 `enorm`；hidden 在量化配方启用旋转矩阵时先过 `rot`，再做 `hnorm`。两次 RMSNorm 各自缩放并乘以对应 $\gamma$，拼成 `8192` 维后经 `8192 → 4096` 无偏置投影压回一条，才送进单条 pre-norm 块。它们缩小两路尺度差异，但不保证输出均方根恰为 `1`（$\varepsilon$ 和 $\gamma$ 均会影响结果，位置 0 的词嵌入还会先清零；旋转配方版本条件见[模型总览的 MTP 一节](glm-5-3-flash.md#mtp主干之外的第-45-层)）。
  - **出块后 1 次。** 块内旁路一路累加、没有归一化，因此交给词表投影算分前，也要补做一次最终 RMSNorm。
- **稀疏 MLA 内部。** 11 层稀疏 MLA 在注意力内部还对 Q 的 `1536` 维低秩向量和 KV 的 `512` 维低秩向量各做一次 RMSNorm。它们属于注意力内部计算，不在子层入口，细节见 [MLA](mla.md)。

下图把后半程最易混淆的两道昇腾运行时边界合在一处对照：上方对比 `swiglu_limit = 10` 为何对 `gate` 只限上界而对 `up` 双边限幅，下方对比单流残差融合 `npu_add_rms_norm` 与四流 `mHC` 独立 `npu_rms_norm`：

```wiki-diagram
file: mlp-residual-norm-fig-swiglu-fusion
```

## 常见误解

- **「residual 只是训练技巧，推理时可以省掉。」** 不能省。每个子层学到的是在输入上的改变量，拿掉相加就换成了另一个函数，输出会完全不同。
- **「RMSNorm 把每一维变成一样大，或者在 token 之间求平均。」** 都不对。它只在同一个位置的 H 维之内求平方均值，所有维除以同一个数，比例保留；γ 每维各学一个。
- **「RMSNorm 就是 LayerNorm 换了个名字。」** 差一步：LayerNorm 先减均值再除以标准差，RMSNorm 不减均值、直接除以均方根。[3, 4] 的例子里前者给出 [−1, 1]，后者保留 3 : 4。
- **「Q/K Norm 把所有头一起归一化，或每个头各学一套增益。」** 本页的 Qwen3 实现按每个 token、每个头单独求均方根；同一层内 Q 的各头共享一组增益，K 的各头共享另一组。它在 RoPE 之前，不能和投影前的 pre-norm 互换。
- **「门控就是开关，gate 决定某一维开或关。」** SiLU 是连续函数，门控给出的是连续的缩放系数（手算例子里是 1.74、−0.06、0.16、0.85），不是离散的开或关。
- **「限幅 10 是把 MLP 的输出夹到 ±10。」** 夹的是 SiLU 之前的两路输入：gate 只限上界，up 两边都限。中间值的绝对值上限约为 100，经过 down 投影后的输出也不受 10 的约束。
- **「SwiGLU 是运行时给普通 MLP 打开的选项。」** 它多一个投影，结构不同，三组权重要按这个结构训练；已有的两投影 MLP 不能靠开关变成 SwiGLU。
- **「gate 和 up 合并成一次调用，就只剩一组权重。」** 两组权重都在，只是拼在一起存、一次乘完，再在激活函数里拆成两半。
- **「GLM 的每一层就是 x + F(Norm(x))。」** 主干 45 层用四条流的 mHC，子层入口混合、出口写回；只有 MTP 层是单条相加。
- **「一个 RMSNorm 就对应一个独立的设备算子。」** 公式描述的是数学。实现可以把 RMSNorm 和残差加法融合成一个算子，也可以转换精度、换用设备专用算子，不能从公式反推算子个数。

## 对照源码

### 怎么开

MLP、residual 和 RMSNorm 都是模型结构，没有单独的开关，随模型配置生效。决定它们的是 `config.json` 里 `text_config` 的这几项：

| 字段 | GLM-5.3-Flash 的值 | 作用 |
|---|---|---|
| `mlp_layer_types`、`first_k_dense_replace` | 前 3 项 dense、其余 42 项 sparse；3 | 逐层选稠密 MLP 还是 MoE。固定版本先读列表，没有列表才按层号是否小于 3 判断 |
| `intermediate_size`、`moe_intermediate_size` | 12288、2048 | 稠密 MLP 与每个专家的中间宽度 F；shared expert 宽度为 2048 × shared expert 数 1 |
| `hidden_act`、`swiglu_limit` | silu、10.0 | 门控用 SiLU；限幅不为空就换用带限幅的激活 |
| `rms_norm_eps` | 1e-05 | 所有 RMSNorm 的 ε |
| `mhc`、`hc_mult` | true、4 | 主干把 residual 扩成四条流；为假或 MTP 层时走单条 residual |

TP、EP、量化这些部署参数不改变上面的结构，只改变矩阵怎样切、权重怎样存。main 分支里打开序列并行时，稠密 MLP 不再按 TP 切分，也不做末尾的 All-Reduce，见[序列并行](sequence-parallel.md)。

### 会报什么错

固定版本 `db701c1f` 里这三件东西没有专门的报错：`AscendGlm5NextMLP` 接收 `hidden_act` 却不检查它，门控一律用 SiLU。main 的 `Glm5NextMLP` 加了检查，`hidden_act` 不是 silu 时在构造阶段抛出：

```text
ValueError: Unsupported activation: <hidden_act>. Only silu is supported for now.
```

投影层自身的偏置组合报错属于矩阵乘，见[矩阵乘和权重的报错一节](matmul-and-weights.md#会报什么错)。

### 开销和什么时候别开

三件东西都不能关，只能了解代价落在哪里：

- **RMSNorm。** 每个位置对 H 个分量求平方和并缩放，逻辑工作量随 H 线性增长；实际访存和耗时取决于内核实现。Ascend 版调用 NPU 的 RMSNorm 算子；调用时带上 residual，就换成「加法 + RMSNorm」融合算子。GLM 主干的相加发生在 mHC 写回里，子层前 RMSNorm 不带 residual，走单独的 RMSNorm 算子。
- **residual。** 单条时每个子层一次逐元素加法。GLM 四条流每层要多做两次小矩阵乘和两次 20 轮的 Sinkhorn 迭代，这部分见[层与 hidden 的代价一节](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)。
- **MLP。** 三个逻辑投影，本页 gate/up 合并为一次、down 一次。按[双机教学基线](../sources/glm-5-3-flash-baseline.md#双机示例与教学视图)的普通 TP8 路径，末尾一次 All-Reduce；启用序列并行时另核归约与形状，见[矩阵乘和权重](matmul-and-weights.md)与 [TP](tensor-parallel.md)。
- **限幅。** 按固定注册链，稠密 MLP 选择上游 PyTorch 写法：两次截断、一次 SiLU、一次相乘，是 4 个逻辑逐元素操作；这不能直接当作编译后的设备 kernel 数。Ascend 另有截断后调用 NPU SwiGLU 的实现，但所引注册键与实例化类名不一致。shared expert 只有在两组投影均带 weight_scale、且 fused MoE 量化类型为 W8A8/W4A8 时，才走「动态量化 → 量化矩阵乘 → 反量化 + 限幅 SwiGLU + 再量化 → 量化矩阵乘」融合链；普通后备路径仍会调用模块的 act_fn。具体分支与通信条件见[共享专家](moe.md#共享专家按-tp8-切走融合算子)，源码分派与尚缺的运行证据见下文。

### 版本差异

**`v0.30.0` 与 `main` 均已合入社区版 `models/glm5next/model.py`，保留了 `Glm5NextMLP` 的分支条件与激活检查，且 `main` 修复了限幅激活的注册键错配。** `gate/up` 合并列切，接 `SiluAndMul` 或带 `swiglu_limit` 的限幅激活，再由 `down` 行切，`bias` 均为 `False`；`hidden_act` 非 `silu` 时在构造阶段抛错。序列并行（SP）路径的输入输出已按 token 切分，稠密 MLP 权重复制且关闭 `reduce_results`，不能把普通 TP 的层尾 All-Reduce 无条件套上去。`dense/sparse` 仍由 `mlp_layer_types` 决定，MTP 越界取最后项。`v0.30.0` 与 `main` 的共享专家支持预量化输入以便多流重叠，但不改变残差/RMSNorm 数学；mHC 入口仍可能另调 RMSNorm，函数合并不等于单 kernel。

GLM 双机绑定算例固定在例外 B 镜像 `db701c1f`。`v0.23.0` 与 `v0.26.0rc` 维护分支均未包含 GLM-5.3-Flash 模型代码（对 `vllm_ascend/models/` 做 `git ls-tree` 无 `glm5` 文件），但通用的限幅激活与 RMSNorm 替换四版均存在：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| GLM 稠密 MLP 类 | 无（绑定算例在镜像 `db701c1f`） | 无 | `models/glm5next/model.py` `Glm5NextMLP`（L90–L138）：gate/up 合并列切、down 行切、无偏置 | 同 `v0.30.0`（L118–L160） |
| 激活函数检查 | — | — | `hidden_act != "silu"` 抛 `ValueError`（L126） | 同 `v0.30.0`（L154） |
| 按层选稠密 MLP 或 MoE | — | — | `config.py` 规范化 `mlp_layer_types`，`model.py` 按列表选层、MTP 越界取末项（L325–L335） | 同 `v0.30.0`（L354–L364） |
| 稠密 MLP 与序列并行 | — | — | 打开序列并行时稠密 MLP 不切、不归约 | 同 `v0.30.0` |
| Ascend 限幅激活注册键 | `SiluAndMulClamp`（`utils.py#L738`） | `SiluAndMulClamp`（`utils.py#L709`） | 仍为 `SiluAndMulClamp`（`utils.py#L870`），与上游 `SiluAndMulWithClamp` 类名不一致 | **已修复为 `SiluAndMulWithClamp`**（`utils.py#L897`），与上游实例化查表键对齐 |
| Ascend RMSNorm 替换 | 注册为 `RMSNorm`（`utils.py#L751`） | 注册为 `RMSNorm`（`utils.py#L722`） | 注册为 `RMSNorm`（`utils.py#L884`，310P 另注册 `AscendRMSNorm310`） | 同 `v0.30.0`（`utils.py#L911`） |

`v0.30.0` / `main` 对子层前 RMSNorm 与 mHC 的改动（RMSNorm 挪进入口混合的同一个函数）只影响调用方式，不改数学，见[层与 hidden 的版本差异](layers-and-hidden.md#版本差异)。

### 源码位置

阅读顺序：先看 `glm5_next.py` 的 `AscendGlm5NextMLP`（1403–1442 行）：`gate_up_proj` 是合并的列切投影，`act_fn` 按 `swiglu_limit` 选带限幅的激活，`down_proj` 是行切投影，三者都 `bias=False`；再看 `AscendGlm5NextDecoderLayer.__init__` 按层号选 MLP、建两个子层前 RMSNorm，和 `forward` 里的两条路径：`not self.mhc or self.is_mtp_layer` 为真时走单条 residual，否则走 `hc_pre` → RMSNorm → 子层 → `hc_post`，第 0 层先复制成四条、第 44 层求平均；最终 RMSNorm 在模型的 `forward` 末尾；MoE 的 routed experts 和 shared expert 同样传入限幅，shared expert 宽度为 `moe_intermediate_size × n_shared_experts`（来源 2–6）。[C2]

激活与归一化的实现：Ascend 限幅激活先把前一半夹到不超过上限、后一半夹到正负上限之间，再调用 `npu_swiglu`；上游 vLLM 的数学为 `silu(clamp(gate)) * clamp(up)`，固定镜像与 `v0.30.0` 注册链选择该写法（来源 7–8）。[C7] vLLM 的 RMSNorm 定义为 `x -> w * x / sqrt(E[x^2] + eps)`；Ascend 版不带 residual 时调用 `npu_rms_norm`，带 residual 时按自定义算子开关选 `npu_add_rms_norm_bias` 或 `npu_add_rms_norm`，量化配方带来的偏移另按加载状态处理（来源 11–12）。[C11] MTP 块外先把位置 0 的词嵌入清零再做 `enorm`；hidden 按 `is_rot_used` 条件过 `rot`，再做 `hnorm`，拼接后过 `eh_proj` 进入块，出块后先做 TP All-Reduce 再交给 `shared_head`；`shared_head` 的 `forward` 是一次 RMSNorm，词表投影另在 logits 计算时调用（来源 23–24）。[C23]

版本表的来源按结论分组：`v0.30.0` 与 `main` 的稠密 MLP 投影、无偏置、激活检查、按层选择及序列并行开关分别见来源 38–39、41–42，注册键修复见来源 40、43；`v0.23.0` 与 `v0.26.0rc` 注册键分别见来源 15、16。[C38][C43]

来源 4 的 2195、2237–2241 行限定了末层均值的分支：mHC 启用且不是 MTP 层时，在最后一个基础层把 hidden 重排为“位置 × 残差流 × hidden 宽度”，只沿残差流维取均值，返回的 residual 为 `None`。来源 2 的 1403–1442 行没有激活类型检查，构造时仍选择 SiLU 类；`v0.30.0` / `main` 则显式拒绝非 `silu`。检查缺失不能证明其他激活受支持；这些结论来自固定源码，不代表设备运行或安装包组合已验证。

来源与结论的对应：

- 归一化类型与位置是不同选择：固定 vLLM 的 GPT-2 子层在支路入口和整叠层末尾都用 LayerNorm；OPT 根据配置把 LayerNorm 放在支路入口或残差相加之后（来源 27–28）。[C27] 这两处是首屏示例适用范围的源码反例，GLM 的 RMSNorm 仍以本页来源 3–5 为依据。
- Qwen3 的逐头归一化范围、共享增益及投影 → RMSNorm → RoPE 顺序：Transformers v4.51.3 固定提交 `5f4ecf2d`。`Qwen3RMSNorm` 沿最后一维求均值，`Qwen3Attention` 为 Q、K 各建立一份长度为 `head_dim` 的权重，forward 先归一化再旋转。[C26] 该来源只支持上文 Qwen3 小节，不替代“版本差异”一节的 vLLM-Ascend 四版本 GLM 对照。
- 深网络不加旁路会训练退化、恒等旁路不加参数：ResNet 原论文。[S17]
- 原始 Transformer 的 post-norm 写法、MLP 取 F = 4H 与 ReLU：Transformer 原论文。[S18]
- 初始化下的梯度分析、指定训练设置的 warm-up 试验及 RAdam 反例：pre-norm 分析论文 §3–4。[S19]
- RMSNorm 去掉减均值、只按均方根缩放，效果与 LayerNorm 相当且更快：RMSNorm 原论文。[S20]
- SwiGLU 的三投影结构、为等参数把 F 缩到 2/3：GLU 变体论文。[S21]
- GLM 的 45 层、H、两种中间宽度、逐层 MLP 类型、限幅、ε、四条流：模型配置 `690b7052`。[S1] 该配置与旧 revision 及母版配置一致性的核对见[GLM-5.3-Flash 固定配置](../sources/glm-5-3-flash-baseline.md)。
- 手算示例（$x=[3,4]$、2→4→2 SwiGLU 与限幅 10）为教学示意推导，部署数字（每卡 3072 / 1536 列、32,768 B）按普通 TP8、4 个位置和 BF16 的教学条件计算，完整推导在[一条请求](one-request.md#前-3-层的稠密-mlp)。[D]

固定分派与验证边界：

- **限幅激活的静态选择。** 旧镜像、`v0.23.0`、`v0.26.0rc` 与 `v0.30.0` 均以 `SiluAndMulClamp` 为键注册（来源 9、15、16、40），vLLM 登记时使用给定键（来源 22）、实例化却按类名 `SiluAndMulWithClamp` 查表（来源 10），因而静态路径回落上游原生 PyTorch 实现；`main`（`8d6180e2`）已修正注册键为 `SiluAndMulWithClamp`（来源 43）。[C9] 共享专家的 W8A8/W4A8 融合分支要求两个投影都有 `weight_scale`；不满足时可进入调用 `act_fn` 的后备路径，不能把影响范围无条件限于前 3 层（来源 25、35）。[C25] routed experts 的限幅由 fused MoE 参数传入；运行包是否与固定代码完全相同、编译后多少 kernel 及性能如何，仍缺运行日志或 profiling。[I]
- **稠密 W8A8 的计算边界。** 固定方法在投影内动态量化，再调用量化矩阵乘并返回输入 dtype；稠密 MLP 的 `act_fn` 位于 gate/up 与 down 两次投影调用之间。这个路径与共享专家直接调用 dequant-swiglu-quant 的分支不同，见来源 37 的 48–153 行及[量化](quantization.md)。编译器是否进一步融合仍需实际图或 profiling。
- NPU 的 RMSNorm 算子与公式的数值等价没有实测，也没有这三件东西的内核耗时数据；专用镜像内最终安装的包组合未核。

来源 36 的 535–613 行区分本步未启用 FlashComm1 时的 All-Reduce 与启用后可选的 Reduce-Scatter，支撑本页 TP 算例的适用条件。
