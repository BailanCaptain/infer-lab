---
id: mlp-residual-norm
title: "MLP、residual 与 RMSNorm：一个子层怎样更新 hidden"
type: concept
summary: 每个子层都是「residual 旁路原样保留输入 + 支路先 RMSNorm 再做 MLP 或注意力 + 两路相加」。讲清残差为什么让深网络训得动、推理为什么删不掉，RMSNorm 与 LayerNorm 差在哪，pre-norm 放在哪，SwiGLU 的 gate、up、限幅和 down，再落到 GLM 前 3 层稠密 MLP 与四条流。
aliases: [MLP, FFN, 前馈网络, 前馈, 残差, residual, 残差连接, 归一化, LayerNorm, RMSNorm, 均方根归一化, pre-norm, Pre-Norm, post-norm, SwiGLU, SiLU, 门控前馈, 门控 MLP, swiglu_limit, 限幅, 中间宽度, intermediate_size, gate_up_proj, down_proj, input_layernorm, post_attention_layernorm, AscendGlm5NextMLP]
chapters: ["03"]
order: 70
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2105-L2131
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2189-L2241
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2285-L2318
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1460-L1525
  - vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L46-L56
  - vllm@0fc695fc:vllm/model_executor/layers/activation.py#L154-L184
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L756
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L109-L127
  - vllm@0fc695fc:vllm/model_executor/layers/layernorm.py#L36-L102
  - vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L28-L82
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L90-L138
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L324-L350
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L736-L752
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L707-L723
  - https://arxiv.org/abs/1512.03385
  - https://arxiv.org/abs/1706.03762
  - https://arxiv.org/abs/2002.04745
  - https://arxiv.org/abs/1910.07467
  - https://arxiv.org/abs/2002.05202
  - vllm@0fc695fc:vllm/model_executor/custom_op.py#L332-L337
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L104-L123
  - vllm@0fc695fc:vllm/model_executor/models/deepseek_mtp.py#L44-L60
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L619
verified: []
evidence: "C"
relations:
  - {to: layers-and-hidden, kind: builds-on, note: 本页讲单条 residual；GLM 把它扩成四条流（mHC），混合、Sinkhorn 与代价在该页}
  - {to: one-request, kind: builds-on, note: 第 4 站逐层前向里稠密 MLP 的每卡形状、字节与通信次数在主线页}
  - {to: matmul-and-weights, kind: builds-on, note: gate、up、down 三个投影怎样做矩阵乘、为什么没有偏置、W8A8 权重怎样转置存放}
  - {to: tensor-parallel, kind: builds-on, note: TP8 下稠密 MLP 先列切 gate 与 up、再行切 down，末尾一次 All-Reduce}
  - {to: expert-parallel, kind: builds-on, note: 路由专家怎样按 EP16 分到 16 张卡、token 怎样派发与收回}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一个子层怎样更新 hidden，又不丢掉原来的输入？

**Transformer 的每个子层都由三件东西拼成：一条把输入原样送到出口的 residual（残差连接）旁路；一条先做 RMSNorm、再做 MLP 或注意力的支路；最后把支路算出的改变量加回输入。**

这里的 hidden 是模型给每个输入位置维护的一条中间向量，宽度记作 H（见[层与 hidden](layers-and-hidden.md)）。RMSNorm（均方根归一化）把这条向量除以它自身的均方根、再逐维乘一组学到的系数，让送进支路的数值大小保持稳定。MLP（前馈网络，也叫 FFN）是对每个位置单独做「升宽 → 非线性 → 降回原宽」的一个小网络。下图以 MLP 子层为例：

```wiki-diagram
file: mlp-residual-layer
```

顺着图看三步：

1. **分两路。** 上面的 residual 旁路不乘任何权重，x 原样走到出口。下面的支路才做计算，而且只在支路入口做 RMSNorm；旁路上的 x 不被归一化。这种把归一化放在支路入口的排法叫 pre-norm。
2. **支路算改变量。** gate 和 up 两个投影把 H 维升到更宽的 F 维；gate 这一路过 SiLU（一种平滑的非线性函数），再和 up 逐元素相乘；down 投影把结果降回 H 维，得到改变量 Δ。
3. **相加。** y = x + Δ。两路逐元素相加，形状必须一样，所以支路最后一定回到 H 维。

MLP 对每个位置各算一遍，所有位置共用同一套权重，位置之间不交换信息；在位置之间搬运信息是注意力子层的事。MLP 的输入已经带着注意力汇总来的上下文，所以它加工的是「这个位置在上下文里的表示」。一层 Transformer 由两个这样的子层串成：先注意力子层，再 MLP 子层，两段都套着同一种「旁路 + 归一化支路 + 相加」的结构。

## 为什么要这条旁路和归一化，代价在哪？

**旁路让深网络训得动，归一化让每个子层看到的输入尺度稳定；两者在推理时都只花很少的计算，但都删不掉。** 下面分三件讲，最后说 MLP 本身为什么值得占一半子层。

### 残差连接保留一条输入路径

单条 residual 的子层写成 **Y = X + F(Norm(X))**：F 是注意力或 MLP，Norm 是 RMSNorm，X 同时沿旁路直接参与最后的相加。

**为什么深网络需要它。** ResNet 的作者发现，没有旁路时把网络加深，连训练误差都会变高，这不是过拟合，而是深层网络本身难以优化；改成让每层只学「在输入上改多少」（F(x) = 目标 − x），再把输入加回来，几十上百层也能训下去。恒等旁路不带参数，也几乎不增加计算。从梯度（训练时告诉每个权重该往哪个方向改、改多少的信号，从输出一层层往前传）看，Y 对 X 的导数是「单位矩阵 + F 的导数」，其中单位矩阵那一项让梯度不必穿过每一层的权重，就能沿旁路直接传回前面的层。

**为什么推理时不能去掉。** 每个子层训练出来的就是「改变量」，不是一份完整的新表示。拿掉加法，子层输出就不再是模型训练时的那个函数，结果会完全不同。residual 和 dropout 这类只在训练时起作用的手段不同，它是模型结构的一部分。

**边界情况。** 相加要求两路形状一致，这就是支路最后一定回到 H 维的原因。加法本身不限制改变量的大小：子层输出可以很大，也可以接近零。原输入参与新结果，但下一层拿到的是相加后的 y，旁路并不把一份永远不变的原始表示一直传到最后。

**代价。** 每个子层多一次逐元素加法；从子层开始到相加之前，要一直留着 x（每个位置 H 个数）。和 MLP 的矩阵乘比，这点计算与显存都很小。GLM 把一条旁路扩成了四条并加上可学习的混合，这部分代价才变得可观，见本页后文和[层与 hidden 的代价一节](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)。

### RMSNorm 怎样调整向量尺度

**RMSNorm 把一个位置的 H 维向量除以它的均方根，再逐维乘可学习的增益 γ；它和 LayerNorm 的区别只在于不先减均值。**

层层把改变量加到 residual 上，这条向量的数值大小会随层数漂移；归一化让每个子层拿到的输入落在可控的尺度上。LayerNorm 对同一位置的各维先减去均值、再除以标准差，然后乘 γ、加偏移；RMSNorm 的论文认为起作用的主要是「按大小缩放」而不是「减均值」，于是去掉了减均值这一步，只按均方根缩放。论文在多种模型上报告，效果与 LayerNorm 相当，运行时间更短。

对一个位置的向量 x：

```text
r  = sqrt((x₀² + x₁² + … + x_{H−1}²) / H + ε)
yᵢ = γᵢ × xᵢ / r
```

ε 是一个很小的常数，防止分母过小。这个运算只在同一个位置的 H 维之间求平方均值，不在不同 token（模型输入的一个个单位，每个 token 占一个输入位置）之间求平均，输出宽度不变。它也不会把各维变得一样大：除以同一个 r 保留了各维之间的比例，γ 又是每维各学一个。拿两维的小例子对照两种归一化：

```calc
title: x = [3, 4] 分别过 RMSNorm 与 LayerNorm（γ 取 1，ε 取 0）
RMSNorm 均方根 = sqrt((3² + 4²) ÷ 2) = sqrt(12.5) ≈ 3.536
RMSNorm 输出第 0 维 = 3 ÷ 3.536 ≈ 0.849
RMSNorm 输出第 1 维 = 4 ÷ 3.536 ≈ 1.131
LayerNorm 均值 = (3 + 4) ÷ 2 = 3.5
LayerNorm 标准差 = sqrt(((3 − 3.5)² + (4 − 3.5)²) ÷ 2) = 0.5
LayerNorm 输出第 0 维 = (3 − 3.5) ÷ 0.5 = −1
LayerNorm 输出第 1 维 = (4 − 3.5) ÷ 0.5 = 1
```

RMSNorm 的输出仍是 3 : 4，方向没变，只是长度被缩放到均方根为 1；LayerNorm 先扣掉两维共有的 3.5，输出变成 [−1, 1]。RMSNorm 少了求均值和减均值两步，每次只需一次平方和归约。

### 归一化为什么放在支路入口

**pre-norm 只归一化支路的输入，旁路从头到尾保持恒等；原始 Transformer 则把归一化放在相加之后，叫 post-norm。**

原始 Transformer 的子层是 Norm(x + F(x))：先相加，再对和做归一化。后来的分析发现，post-norm 在训练初期靠近输出的几层梯度偏大，必须先用很小的学习率「预热」一段（学习率是每一步训练改动权重的幅度，预热指训练开头先用很小的幅度、再逐步调大）；换成 pre-norm，即 x + F(Norm(x))，梯度更平稳，可以去掉预热。现在的大模型基本都用 pre-norm。

| | post-norm | pre-norm |
|---|---|---|
| 归一化的位置 | 两路相加之后 | 支路入口 |
| 旁路上的 hidden | 每个子层都被归一化一次 | 从第一层到最后一层都不经过归一化 |
| 最后一层之后 | 输出已经归一化 | 还要补一次最终归一化，再做输出投影 |

表的最后一行是 pre-norm 的直接后果：旁路上的数值一路累加却从不归一化，所以最后一层之后必须再做一次 RMSNorm，才能交给输出投影算每个词的分数。

### MLP 为什么值得占一半子层

注意力按权重汇总其他位置的信息，但每个位置内部各维怎样组合、怎样非线性地变换，要靠 MLP 来做。稠密模型的大部分参数和矩阵乘都在 MLP 里，下一节展开它的结构；它的代价就是 gate、up、down 三次矩阵乘，在张量并行（TP，把一个矩阵切到多张卡上一起算）下还要在末尾合一次数值（见[TP 页的稠密 MLP 一节](tensor-parallel.md#再过稠密-mlp本地升维和门控降维后再合齐)）。

## 前馈网络怎样变换一个位置的特征

**MLP 对每个位置单独做「升宽 → 非线性 → 降回」；GLM 用的门控写法 SwiGLU 多一个投影，由输入自己决定中间每一维放大多少。**

### 普通两投影 MLP：非线性不能省

原始 Transformer 的 MLP 是两个投影夹一个激活：**Y = φ(X·W₁)·W₂**。W₁ 把 H 维映射到中间宽度 F，φ 是逐元素的非线性激活（原文用 ReLU），W₂ 再映射回 H 维。这里省掉了偏置：原文两个投影各带一个偏置，写作 max(0, X·W₁ + b₁)·W₂ + b₂；GLM 的三个投影都去掉了偏置，所以后文一律不写。如果省掉 φ，两次线性变换 X·W₁·W₂ 等于乘一个合并后的矩阵，再多的参数也只相当于一次线性变换；非线性让中间 F 维可以表达「某些特征组合出现时才起作用」这类关系。

### 门控 MLP：SwiGLU

**门控（gating）是把同一个输入投影成两路：一路算「内容」，一路算「中间每一维开多大」，两路按元素相乘。门开得大的维度，内容多传过去；门接近零的维度，内容几乎被关掉。**

为什么要单独一路门：普通 MLP 里，中间一维传出多少只由这一维自己的值决定，比如 ReLU 把负数整个砍成 0，「传不传」和「传什么」是同一个数。门控 MLP 让另一路投影专门决定每一维放行多少，「开多大」和「传什么」各有一组权重，分开学。SwiGLU 的论文在参数量和计算量对齐的条件下比较，门控写法训练出的模型效果好于普通两投影 MLP；论文只报告了实验结果，没有解释为什么更好。

门控 MLP 保留「H 维进、H 维出」的接口，在中间多加一条由同一输入产生的投影，用逐元素乘法去调节另一条。SwiGLU 用 SiLU 构造这道门，GLM 的稠密 MLP 和每个专家都是这种结构。把一个位置的输入记作 X，宽度 H；中间宽度记作 F：

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

```calc
title: 一个 MLP 子层的手算（数为示意；每步用上一行写出的数接着算，保留两位小数，sigmoid 保留三位）
n = RMSNorm([3, 4]) ≈ [0.85, 1.13]
> 就是 RMSNorm 一节算出的 [0.849, 1.131]
W_gate 的四列 = [1, 1]、[−1, −3]、[−1, 1]、[0, 1]
g 的第 0 个数 = 0.85 × 1 + 1.13 × 1 = 1.98
g = [1.98, −4.24, 0.28, 1.13]
> 另外三个数同样是 n 和 W_gate 一列的点积
W_up 的四列 = [0, 1]、[1, 1]、[−2, 0]、[1, −2]
u = [1.13, 1.98, −1.70, −1.41]
sigmoid(g) = 1 ÷ (1 + e⁻ᵍ) = [0.879, 0.014, 0.570, 0.756]
SiLU(g) = g × sigmoid(g) = [1.74, −0.06, 0.16, 0.85]
z = SiLU(g) ⊙ u = [1.74 × 1.13, −0.06 × 1.98, 0.16 × (−1.70), 0.85 × (−1.41)] = [1.97, −0.12, −0.27, −1.20]
W_down 的两列 = [1, 1, −1, 1]、[0, 1, 1, −1]
Δ 的第 0 个数 = 1.97 × 1 + (−0.12) × 1 + (−0.27) × (−1) + (−1.20) × 1 = 0.92
Δ 的第 1 个数 = 1.97 × 0 + (−0.12) × 1 + (−0.27) × 1 + (−1.20) × (−1) = 0.81
y = x + Δ = [3 + 0.92, 4 + 0.81] = [3.92, 4.81]
```

四列对照着看：内容最大的是第 1 维（1.98），但它的 g 是 −4.24，门只有 −0.06，这一维几乎被关掉，只剩 −0.12；第 0 维的门是 1.74，内容 1.13 被放大到 1.97；第 2 维的 g 接近 0，门 0.16 把 −1.70 压到 −0.27；第 3 维的门 0.85，把 −1.41 略缩成 −1.20。放大、关掉还是压小，都是同一个输入 n 经 gate 投影算出来的，这就是「由输入自己决定中间每一维放大多少」。第 1 维的门略小于 0，是因为 SiLU 在负半轴会给出很小的负数，乘出来的符号也跟着翻了，但量已经很小。

SiLU 是连续的函数：g 越大越接近 g 本身（g = 1.98 时已是 1.74），g 很负时接近 0（g = −4.24 时只有 −0.06）。所以门控分支给出的是一组连续的缩放系数，由输入决定 u 的每一维被放大、缩小还是压到接近零，并不是一组离散的开或关。SwiGLU 改变的是中间计算的结构，三组权重要按这个结构训练出来；它不是运行时可以给普通两投影 MLP 随手打开的开关。

### 限幅：gate 只限上界，up 两边都限

GLM 的配置里有一项 `swiglu_limit = 10`，实现会在 SiLU 之前先把两路输入夹住：**gate 只限上界（不超过 10），up 限在 −10 到 10 之间**，然后才算 SiLU(gate) ⊙ up。夹的是门控的输入，不是乘完之后的输出。

gate 只需要限上界，是因为 SiLU 在负半轴本来就有界：输入很负时输出趋于 0，最小值约为 −0.28；正半轴则随输入线性增长。上界夹在 10 之后，SiLU(gate) 最大约为 10，再乘上绝对值不超过 10 的 up，中间向量每个元素的绝对值都不超过约 100。为什么要限：中间值是两路相乘，gate 和 up 都大时，乘积会比任何一路都大得多，不截断就会出现远超常规的值（下面的例子里是 −156）；截断给这个乘积设了上界。配置没有说明为什么取 10，这里只说明它的效果：中间值被限制在有限范围内。

换一组大一些的示意数看限幅怎样起作用：某一维 gate = 13、up = −12，另一维 gate = −15。

```calc
title: 限幅示意（上限 10，数为示意）
截断后的 gate = min(13, 10) = 10
截断后的 up = max(−10, min(−12, 10)) = −10
SiLU(10) = 10 × sigmoid(10) = 10 × 0.99995 ≈ 10.00
这一维的中间值 = 10.00 × (−10) = −100
> 不截断时是 SiLU(13) × (−12) ≈ 13.00 × (−12) = −156，超出约 100 的范围
SiLU(−15) = −15 × sigmoid(−15) ≈ −0.0000046
> gate = −15 没有超过上界，不截断；SiLU 在负半轴自己就趋于 0，所以 gate 不用限下界
```

```wiki-diagram
file: gated-ffn
```

形状上，输入和输出都是 [T, H]，中间两路各是 [T, F]，T 是本轮输入的位置数。实现把 gate 和 up 两个投影合并成一次矩阵乘，输出 [T, 2F]，前一半当 gate、后一半当 up，交给激活函数拆开；合并只是少发一次调用，两组权重和之后的拆分都还在。

### 中间宽度 F

**中间宽度 F 是 MLP 升宽后的那一维，它决定 MLP 的参数量和计算量。** 原始 Transformer 取 F = 4H（H = 512 时 F = 2048）。SwiGLU 有三个投影，比普通 MLP 多一个；SwiGLU 的论文为了和普通 MLP 保持相同的参数量与计算量，把 F 缩到原来的 2/3，也就是约 8H/3。

模型可以自己选 F：GLM 的稠密 MLP 取 F = 12288，是 H = 4096 的 3 倍，比「与 4H 普通 MLP 等参数」的 8H/3 略宽；每个专家取 F = 2048，只有 H 的一半，窄得多，靠多个专家一起分担。数字对照见下一节的宽度表；三组权重各有多少参数、一次前向算多少，推导见[矩阵乘和权重](matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影)。

## 到 GLM 双机：R1 的一个 token 怎样走过这三件东西？

固定部署是两台 A2、每台 8 张卡，TP8/DP2/EP16，权重 W8A8（详见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。下面跟着 R1 走：R1 是主线用的示例请求，prompt 有 4 个 token（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），prefill 这一步一次前向处理 T = 4 个位置。三件东西都在主线第 4 站「逐层前向」里，下图是一层的走法：

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

- **第 0 层入口。** 词嵌入给出的是一条 [4, 4096]，进第 0 层时先复制成四条，之后才有「四条混成一条」。
- **第 44 层出口。** MLP 段写回之后，四条流直接求平均回到一条。然后在层外做一次最终 RMSNorm，也就是 pre-norm 表里「最后一层之后还要补一次」的那一次，结果交给输出投影算每个词的分数。
- **MTP 层。** 模型附带的第 45 层，用来给投机解码草拟候选，不属于 45 层主干。它不走 mHC，是本页首图的单条 pre-norm 写法：暂存 x、RMSNorm、稀疏 MLA、相加，再暂存、RMSNorm、MLP、相加。它的 MLP 是 MoE：配置里逐层标注 MLP 类型的列表只覆盖 45 层主干，编号 45 超出列表，代码取最后一项，也就是 MoE。MTP 层的用途和两路输入见[模型总览的 MTP 一节](glm-5-3-flash.md#mtp主干之外的第-45-层)。除了块内两个子层前各 1 次，块外还有 3 次 RMSNorm，公式和子层前那次相同，各有一组 4096 个数的 γ：
  - **进块前 2 次。** MTP 层有两路输入：下一个 token 的词嵌入，和主干传来的 hidden。两路来源不同，各做一次 RMSNorm（词嵌入这一路叫 enorm，hidden 这一路叫 hnorm），先各自调到均方根为 1、再乘各自的 γ，拼接时两半的尺度就由各自的 γ 决定，不取决于来源。然后拼成 8192 维，由一个 8192 → 4096 的无偏置投影压回一条，才送进上面的单条 pre-norm 块。
  - **出块后 1 次。** 块内旁路一路累加、没有归一化，和主干最后一层之后的情况相同，所以交给词表投影算每个词的分数之前，也要补一次 RMSNorm。
- **稀疏 MLA 内部。** 11 层稀疏 MLA 在注意力内部还对 Q 的 1536 维低秩向量和 KV 的 512 维低秩向量各做一次 RMSNorm。它们属于注意力的计算，不在子层入口，细节见 [MLA](mla.md)。

## 常见误解

- **「residual 只是训练技巧，推理时可以省掉。」** 不能省。每个子层学到的是在输入上的改变量，拿掉相加就换成了另一个函数，输出会完全不同。
- **「RMSNorm 把每一维变成一样大，或者在 token 之间求平均。」** 都不对。它只在同一个位置的 H 维之内求平方均值，所有维除以同一个数，比例保留；γ 每维各学一个。
- **「RMSNorm 就是 LayerNorm 换了个名字。」** 差一步：LayerNorm 先减均值再除以标准差，RMSNorm 不减均值、直接除以均方根。[3, 4] 的例子里前者给出 [−1, 1]，后者保留 3 : 4。
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

- **RMSNorm。** 每个位置读一遍 H 个数、做一次平方和归约，算量很小。Ascend 版调用 NPU 的 RMSNorm 算子；调用时带上 residual，就换成「加法 + RMSNorm」融合算子。GLM 主干的相加发生在 mHC 写回里，子层前 RMSNorm 不带 residual，走单独的 RMSNorm 算子。
- **residual。** 单条时每个子层一次逐元素加法。GLM 四条流每层要多做两次小矩阵乘和两次 20 轮的 Sinkhorn 迭代，这部分见[层与 hidden 的代价一节](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)。
- **MLP。** 三次矩阵乘，TP8 下末尾一次 All-Reduce；算量和通信见[矩阵乘和权重](matmul-and-weights.md)与 [TP](tensor-parallel.md)。
- **限幅。** 按静态读码，GLM 的稠密 MLP 实际走的是上游 vLLM 的 PyTorch 写法：两次截断、一次 SiLU、一次相乘，共 4 个逐元素算子，不调用 NPU 的 SwiGLU 融合算子；比不限幅的写法多两次截断。Ascend 另写了一个「截断后拼回两半、再调 NPU SwiGLU 融合算子」的版本，但注册键和类名对不上，这个版本没有生效；图编译会不会把这 4 个逐元素算子再合并，也没有 profiling 确认，见页末待核。shared expert 不是这种写法：本部署是 W8A8，fused MoE 直接取它的两份权重和缩放系数，走「动态量化 → 量化矩阵乘 → 反量化 + 限幅 SwiGLU + 再量化 → 量化矩阵乘」这条融合链，上限作为参数传进融合算子，不调用 shared expert 模块自己的前向，见[共享专家：按 TP8 切，走融合算子](moe.md#共享专家按-tp8-切走融合算子)。routed experts 走 fused MoE 自己的限幅参数，也不受影响。

### 版本差异

GLM 双机的行为固定在执行侧 `db701c1f`。两个发布分支都没有 GLM-5.3-Flash 的模型代码（对 `vllm_ascend/models/` 做 `git ls-tree`，没有任何 glm 文件），通用的限幅激活与 RMSNorm 替换三版都有。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad |
|---|---|---|---|
| GLM 稠密 MLP 类 | 没有 | 没有 | `Glm5NextMLP`：gate/up 合并列切、down 行切、无偏置，与固定版本相同[C13] |
| 激活函数检查 | — | — | `hidden_act` 不是 silu 就抛错[C13] |
| 按层选稠密 MLP 或 MoE | — | — | 只读 `mlp_layer_types`，不再回退到 `first_k_dense_replace`；超出列表的 MTP 层取最后一项[C14] |
| 稠密 MLP 与序列并行 | — | — | 打开序列并行时 MLP 不切、不归约[C14] |
| Ascend 限幅激活的注册键 | `SiluAndMulClamp`[C15] | `SiluAndMulClamp`[C16] | `SiluAndMulClamp` |
| Ascend RMSNorm 替换 | 注册为 `RMSNorm`[C15] | 注册为 `RMSNorm`[C16] | 注册为 `RMSNorm` |

main 对子层前 RMSNorm 与 mHC 的改动（RMSNorm 挪进入口混合的同一个函数）只影响调用方式，不改数学，见[层与 hidden 的版本差异](layers-and-hidden.md#版本差异)。

### 源码位置

阅读顺序：先看 `glm5_next.py` 的 `AscendGlm5NextMLP`（1403–1442 行）：`gate_up_proj` 是合并的列切投影，`act_fn` 按 `swiglu_limit` 选带限幅的激活，`down_proj` 是行切投影，三者都 `bias=False`。[C2] 再看 `AscendGlm5NextDecoderLayer.__init__` 按层号选 MLP、建两个子层前 RMSNorm，[C3] 和 `forward` 里的两条路径：`not self.mhc or self.is_mtp_layer` 为真时走单条 residual，否则走 `hc_pre` → RMSNorm → 子层 → `hc_post`，第 0 层先复制成四条、第 44 层求平均。[C4] 最终 RMSNorm 在模型的 `forward` 末尾。[C5] MoE 的 routed experts 和 shared expert 同样传入限幅，shared expert 宽度为 `moe_intermediate_size × n_shared_experts`。[C6]

激活与归一化的实现：Ascend 限幅激活先把前一半夹到不超过上限、后一半夹到正负上限之间，再调用 `npu_swiglu`，但按下面待核第一条，这个版本实际没有生效；[C7] 上游 vLLM 的同名数学为 `silu(clamp(gate)) * clamp(up)`，GLM 实际跑的是这个写法。[C8] vLLM 的 RMSNorm 定义为 x → w · x / sqrt(E[x²] + eps)，[C11] Ascend 版不带 residual 时调用 `npu_rms_norm`，带 residual 时调用 `npu_add_rms_norm`。[C12] MTP 层块外的三次 RMSNorm：`glm5_next_mtp.py` 先对词嵌入做 enorm、对主干 hidden 做 hnorm，拼接后过 eh_proj 再进块，出块后交给 shared_head；[C23] shared_head 的 forward 就是一次 RMSNorm，词表投影另在 logits 计算时调用。[C24]

来源与结论的对应：

- 深网络不加旁路会训练退化、恒等旁路不加参数：ResNet 原论文。[S17]
- 原始 Transformer 的 post-norm 写法、MLP 取 F = 4H 与 ReLU：Transformer 原论文。[S18]
- post-norm 需要学习率预热、pre-norm 梯度更平稳：pre-norm 分析论文。[S19]
- RMSNorm 去掉减均值、只按均方根缩放，效果与 LayerNorm 相当且更快：RMSNorm 原论文。[S20]
- SwiGLU 的三投影结构、为等参数把 F 缩到 2/3：GLU 变体论文。[S21]
- GLM 的 45 层、H、两种中间宽度、逐层 MLP 类型、限幅、ε、四条流：模型配置 `690b7052`。[S1] 该配置与旧 revision 及母版配置一致性的核对见[GLM-5.3-Flash 固定配置](../sources/glm-5-3-flash-baseline.md)。
- 部署数字（每卡 3072 / 1536 列、32,768 B）取自主线底稿「逐层前向」的稠密 MLP 与四路残差两节，本页只引结论，推导在[一条请求](one-request.md#前-3-层的稠密-mlp)。

待核：

- **限幅激活实际走哪个实现。** Ascend 把 `AscendSiluAndMulWithClamp` 以 `SiluAndMulClamp` 为键注册，[C9] 而 vLLM 登记时用给定的名字作键、[C22] 实例化自定义算子时却按类名 `SiluAndMulWithClamp` 查替换表，[C10] 两个名字不同，三个版本一样。静态读码推断：GLM 实例化的是上游类，在 NPU 上走默认的 PyTorch 写法（先截断、再 SiLU、再相乘），不调用 `npu_swiglu`。影响范围只有前 3 层稠密 MLP。42 层的 shared expert 不受影响：W8A8 下 `_forward_shared_experts` 直接取 gate_up 与 down 的权重和缩放系数，走 `npu_dynamic_quant` → `npu_quant_matmul` → `npu_dequant_swiglu_quant`（上限经 `clamp_limit` 传入）→ `npu_quant_matmul`，不调用模块的 forward，[C25] 见 [MoE](moe.md#共享专家按-tp8-切走融合算子)；routed experts 走 fused MoE 自己的限幅参数，也不受影响。连带后果：Ascend 版里为 down 投影预取权重的两个钩子也不会触发。两种写法数学相同，差别只在算子和性能；缺运行日志或 profiling 确认。
- 稠密 MLP 的 W8A8 具体命中哪个计算分支、是否把反量化与 SwiGLU 融合，没有逐行跟到底，见[量化](quantization.md)。
- NPU 的 RMSNorm 算子与公式的数值等价没有实测，也没有这三件东西的内核耗时数据；专用镜像内最终安装的包组合未核。
