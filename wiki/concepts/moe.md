---
id: moe
title: "MoE：一层里放很多专家，每个 token 只用几个"
type: concept
summary: MoE 把一层的前馈计算交给许多个专家，router 为每个 token 打分并选出 top-k，输出按组合权重相加。本页讲稀疏激活省的是什么、router 怎样打分选人、路由专家与共享专家的分工、负载为什么不均，并落到 GLM 的 288 选 8。
aliases:
  [
    MoE,
    混合专家,
    Mixture of Experts,
    专家,
    expert,
    路由器,
    router,
    门控,
    gate,
    路由结果,
    routed expert,
    共享专家,
    shared expert,
    top-k,
    top-8,
    稀疏激活,
    组合权重,
    负载不均,
    aux loss,
    辅助损失,
    e_score_correction_bias,
    noaux_tc,
    routed_scaling_factor,
  ]
chapters: ["06"]
order: 80
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - https://arxiv.org/abs/1701.06538
  - https://arxiv.org/abs/2412.19437
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L30-L120
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L139-L232
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L286-L312
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L340-L395
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L672-L719
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L162
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L139-L177
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L726-L800
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/experts_selector.py#L205-L230
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/fused_moe/fused_moe.py#L824-L900
  - vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L126
  - vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/shared_experts.py#L43-L60
  - vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/shared_experts.py#L340-L560
  - vllm-ascend@db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h#L40-L56
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: mlp-residual-norm
    kind: builds-on
    note: 专家内部就是一个门控前馈网络；MoE 在它之外加了选择和加权合并
  - to: glm-5-3-flash
    kind: builds-on
    note: 288 选 8、共享专家、每层维度和全模型参数量的出处
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一层里放很多个专家，每个 token 只用几个

**MoE**（mixture of experts，混合专家）把一层的前馈计算（对每个位置单独做一次变换）交给许多个小网络，每个小网络叫一个 **expert（专家）**。每层配一个 **router**：一个小小的打分网络，它给当前 token 对每个专家打一个分，只让分最高的几个专家处理这个 token，再把这几个专家的输出按分数加权相加。选几个，这个数量叫 **top-k**。

要经过 router 打分才可能被选中的那一批专家叫**路由专家**（routed expert）——它指整个可供挑选的集合，不是某个 token 这一次选中的子集。此外还可以另配**共享专家**（shared expert）：它不经过 router，每个 token 都要过它。

```wiki-diagram
file: moe-intuition
```

图里有三件事值得记住。第一，搬过去的是这个 token 当前的**隐藏向量**（模型为这个位置保存的中间表示），专家的权重是训练好的矩阵，一直留在原地不动。第二，没被选中的专家这一轮完全不参与计算，但它们的参数仍然占着显存。第三，出口把几个专家的输出**按权重相加**，所以这一层的输出宽度和输入一样，后面的层看不出这里换成了多个网络。

同一批里的另一个 token 可以选另外几个专家；同一个 token 进到下一个 MoE 层，那一层有自己的 router 和自己的一池专家，要重新选。

## 省下的是计算，代价有三样

**一层里放得下很多参数，而一个 token 只碰其中一小块——这就是稀疏激活。** 拿 GLM-5.3-Flash 的一个 MoE 层来说，288 个路由专家每个是 4096 → 2048 → 4096 的三段矩阵，一个 token 只选 8 个：

```calc
title: 一层 MoE 里，一个 token 用上多少专家参数
一个专家 = 3 × 4096 × 2048 = 25,165,824
一层 288 个路由专家 = 288 × 25,165,824 = 7,247,757,312
一个 token 这一层用到 = 8 × 25,165,824 = 201,326,592
用到的比例 = 201,326,592 ÷ 7,247,757,312 ≈ 2.8%
> 这四个数只算路由专家的三片矩阵，不含共享专家、router 和注意力
```

如果这一层是个参数量相同的稠密前馈网络，这 72 亿个参数每个 token 都要乘一遍。**MoE 把这一层的参数量做到了 8 个专家的 36 倍（288 ÷ 8），每个 token 的矩阵乘法量却仍然是 8 个专家那么多**，模型因此可以把容量做得很大而不成比例地变慢。全模型的总参数与每个 token 的激活参数是另一套口径，统一见[模型总览的参数量一节](glm-5-3-flash.md#参数量3133-亿里-97-是路由专家)。

省下计算不等于免费，代价有三样：

1. **参数还是得全放着。** 下一个 token 可能选到任何一个专家，所以一层 288 个专家的权重必须常驻显存。单卡放不下就得把专家分到多张卡上，这是[专家并行](expert-parallel.md)要解决的事。
2. **多了一步 router，还多了一次搬运。** 打分本身很小，但选中的专家要是在别的卡上，就得把隐藏向量发过去、把结果收回来。发和收怎么做、每层几次通信，见[专家并行](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。
3. **负载不均。** 选谁由数据决定，热门专家会分到更多 token，一层的耗时由最慢的那张卡决定。机制在[后面那一节](#一批-token-怎样落到专家上负载为什么会不均)。

四个容易混的名字先分清楚，后面各节都按这张表的说法用：

| 名字 | 要不要经过 router | 哪些 token 用到它 |
| --- | --- | --- |
| 路由专家 | 要打分，可能选中也可能不选中 | 每个 token 选 k 个 |
| 共享专家 | 不打分，直接算 | 所有 token 都过 |
| router | 它本身就是打分的那个网络 | 所有 token 都过 |
| 专家内部的 gate 分支 | 与选专家无关，是一个专家内部逐通道的强弱开关 | 所有走进这个专家的 token |

## router 怎样打分、怎样选 top-k

**router 是一个宽度为「隐藏宽度 → 专家个数」的线性层，一个 token 过一次得到一排分数，排序取前 k 个。** 分数的去处有两个，一定要分开看：一个是**决定选谁**，一个是**决定各专家的输出按什么比例相加**。后者叫**组合权重**。

打分到组合权重之间有四个可调的环节，GLM 四个都用上了：

1. **打分函数。** 对这排原始分数做 sigmoid（把每个数单独压到 0 到 1 之间），或者做 softmax（让一排数加起来等于 1）。sigmoid 是逐个专家独立算的，所以它给出的不是概率分布。
2. **选择用的校正偏置。** 每个专家有一个自己的偏置，加在分数上**只用来排序选人**；选完之后，组合权重用的是加偏置之前的原始分数。偏置因此只改变「选谁」，不直接改变「按什么比例相加」。
3. **归一化。** 把选中的 k 个分数除以它们的和，得到一组加起来为 1 的比例。
4. **整体缩放。** 再乘一个模型规定的缩放系数。缩放之后这 k 个系数的和就不再是 1，所以**不能把最终的组合权重当成「和为 1 的选择概率」**。

```wiki-diagram
file: moe-pick
```

写成式子，`zⱼ` 是 router 给专家 `j` 的原始分数，`bⱼ` 是它的校正偏置，`S` 是选中的 k 个专家，`r` 是缩放系数：

```text
sⱼ = sigmoid(zⱼ)
S  = 取 sⱼ + bⱼ 最大的 k 个专家
αⱼ = r × sⱼ / Σ(i ∈ S) sᵢ           j ∈ S
路由分支输出 = Σ(j ∈ S) αⱼ Eⱼ(x)
```

`Eⱼ(x)` 是专家 `j` 对当前隐藏向量算出的输出。上面这组式子说明的是路由关系；换成低精度或融合算子执行时，数值细节以对应算子为准。

还有一个更粗一层的选法叫**分组选择**：先把专家按编号切成若干组，给每组算一个「代表分」，按代表分先选出几组，再只在这几组里选专家。代表分有两种取法：原生实现取组内的最高分；GLM 实际走的融合算子固定取组内前 2 名的分数之和。它是为跨设备部署省通信用的——一个 token 命中的组少，要联系的卡就少。组数和选组数都是模型配置里的固定值；两个值都设成 1 时，只有一组且必然入选，两种取法结果相同，这一层退化成「在全部专家里直接选 k 个」。

## 路由专家和共享专家的区别

**共享专家不经过 router，每个 token 都要过它；路由专家要打分，每个 token 只选其中 k 个。** 两者结构相同，都是一个门控前馈网络；差别只在「要不要被挑」。层出口把路由分支的加权和与共享专家的输出**直接相加**，共享专家不参与那次归一化，也不带组合权重。

这样安排的用意是分工：所有 token 都需要的那部分共性计算交给共享专家，路由专家就可以各自专门化，不必每个都重复学一遍共性。共享专家越多，固定要算的部分就越多，稀疏省下的计算越少；GLM 只配 1 个。

还有一处同名不同事要区分：共享专家和路由专家的**内部**都有 gate 和 up 两条分支，gate 过一个非线性后与 up 逐元素相乘。那是**逐通道**的强弱开关，作用在一个专家里面；选专家是在**一层的专家之间**做选择。两件事都叫「门控」，但不是一回事，内部那一层见[前馈网络](mlp-residual-norm.md)。

在部署侧，两者的切法也不同：路由专家整份整份地分到各卡，是[专家并行](expert-parallel.md)的对象；共享专家在本部署里不参与专家并行，它的矩阵按机内 TP8 合切，分片形状与每卡字节见[张量并行的共享专家小节](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)。

## 落到 GLM：45 层里 42 层是 MoE

**GLM-5.3-Flash 的 45 层文本主干里，前 3 层用稠密前馈网络，第 3–44 层这 42 层用 MoE；每个 MoE 层有 288 个路由专家、每个 token 选 8 个，另有 1 个共享专家。** 请求在[一条请求的第 4 站](one-request.md#42-层-moe每卡-18-个专家)走到这里，前提是[官方双机配置](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、每台 8 卡、TP8/DP2/EP16、W8A8（权重和激活都按 8 位整数算，见[量化](quantization.md)）。

前 3 层为什么不用 MoE，官方没有给出公开的权衡说明；这三层的稠密前馈网络见[前馈网络](mlp-residual-norm.md)。

router 侧的固定配置是：打分用 sigmoid；每层有一份 288 个数的校正偏置，只参与选人；选中的 8 个分数先归一到和为 1，再整体乘 **2.5**；分组的两个值都是 1，也就是上一节说的退化情形——直接在 288 个里选 8 个。所以一个 token 的 8 个组合权重加起来是 2.5，不是 1。

打分这一步按 **FP32**（每个数 32 位浮点）计算，这是全模型少数几处不降精度的地方之一，原因见[量化的 FP32 链](quantization.md)。以示例请求 R1（prompt 为 4 个 token，见[一条请求](one-request.md)）为例，这一层 router 的形状是 `[4, 4096] × [4096, 288] → [4, 288]`，然后每行取 8 个。

```wiki-diagram
file: glm-flash-moe
```

一个专家是 4096 → 2048 → 4096 的 gate、up、down 三个投影，三个都不带偏置项；中间宽度只有 2048，比前 3 层稠密前馈网络的 12288 窄得多：GLM 走的是「专家切得细、数量多」这条路。路由专家占了全模型参数的绝大部分，具体占比见[模型总览](glm-5-3-flash.md#参数量3133-亿里-97-是路由专家)；每张卡实际放多少字节，见[双机部署的权重表](glm-5-3-flash-two-node.md#每张卡上放了什么)。

## 共享专家走的是哪条计算路径

**在这套 W8A8 部署里，共享专家不走它自己那个前馈模块的激活函数，而是走一条把反量化、限幅 SwiGLU 与再量化合在一起的融合算子。** 这一点和前 3 层的稠密前馈网络不同：稠密那边的限幅激活因为注册名对不上，退回了逐元素的写法（见[前馈网络](mlp-residual-norm.md#对照源码)）；共享专家不受这件事影响，因为这条路径根本没有调用那个模块的前向，而是直接取它的两份权重和缩放系数去调算子。

```wiki-diagram
file: moe-branches
```

四步依次是：把隐藏向量按 token 动态量化成 8 位整数；用量化矩阵乘算出 gate 和 up；把这两半反量化、按上限夹住、做 SwiGLU、再量化成 8 位整数（这三件事在一个融合算子里）；最后再做一次量化矩阵乘降回隐藏宽度。成立条件是两个投影都带着量化缩放系数、且量化方式是 W8A8 或 W4A8；权重没有量化时才退回模块自己的两段调用。

这条路径还有两点值得知道：

- **共享专家和路由专家在本部署里是串行的。** 代码里留了把共享分支切到另一条执行流、与路由专家的派发和矩阵乘重叠的开关，但默认关闭，官方教程也没开。所以共享分支照样执行，只是不与路由分支重叠。
- **共享专家算的是完整的 token 集合**，路由分支在 MC2 路径下已经在回收时把贡献汇齐了，所以两份结果的归约安排不同，不会重复做一次整层求和。具体次数与路径见[专家并行](expert-parallel.md#mc2-还是-allgather)。

## 一批 token 怎样落到专家上，负载为什么会不均

一个 token 的 top-k 只约束它自己。把一批 token 放在一起看，用到的专家个数通常远多于 k。假设两个位置各选 8 个：

| 输入位置 | 选中的专家编号 |
| --- | --- |
| A | 0、1、2、3、4、5、6、7 |
| B | 4、5、6、7、8、9、10、11 |

这 2 个 token 产生 16 个 token–专家配对，涉及 12 个不同专家：4–7 各收到 2 个 token，其余各收到 1 个。执行时可以按专家把输入行归拢在一起，一个专家做一次矩阵乘，再把结果关联回原来的 token 并加权——**所以「每个 token 选 8 个」绝不等于「一批只用 8 个专家」**，批次越大，一层里几乎所有专家都会被用到。

**负载不均就是这么来的：** 选谁由每个 token 自己的隐藏向量决定，没有任何机制保证 288 个专家被选到的次数一样多。分到行数多的专家算得久，而 MoE 一层结束前有回收和归约这样的同步点，**整层的耗时由最慢的那张卡决定**；某张卡上的专家被选得多一倍，这一层就慢一倍，42 层累加。整批的配对数、每专家和每卡的理想行数，见[多请求同时在跑](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。

训练侧有两类办法把负载压平，GLM 用的是后一类：

- **辅助损失（aux loss）**：在训练目标里额外加一项，惩罚「专家被选到的次数分布太不均」，让模型自己学着摊平。这是稀疏门控 MoE 最早的做法。代价是这一项和语言建模目标在拔河，压得太狠会掉效果。
- **校正偏置**：不动训练目标，改为给每个专家一个偏置，训练中看谁被选得多就把它的偏置调低一点——偏置只加在选择用的分数上，不进组合权重，所以均衡压力不会直接扭曲输出。GLM 的配置正是这一类。

要注意的是：**推理时这个偏置是固定不变的权重，只能提供统计上的大致均衡**，不会根据当前批次实时调整。真实批次照样可能偏。按实测负载搬动或复制专家的做法叫 [EPLB](eplb.md)，在本部署默认关闭。

## 常见误解

- **「每个 token 选 8 个，所以一层只用 8 个专家。」** 只对单个 token 成立。一批里不同 token 各选各的，上面 2 个 token 就已经用到 12 个专家。
- **「路由专家就是被选中的专家。」** 路由专家指整个可供 router 挑选的集合（GLM 每层 288 个）；被选中的 8 个是它的子集。共享专家不在这个集合里。
- **「组合权重是一组和为 1 的概率。」** 归一化之后还有一次整体缩放，GLM 的 8 个系数和是 2.5。sigmoid 打分本身也不构成概率分布。
- **「共享专家也要先打分才轮到它。」** 它不经过 router，所有 token 都过；它的输出是直接加上去的，不带组合权重。
- **「专家没被选中就等于没占资源。」** 没被选中省的只是这一次的矩阵乘；权重照样常驻显存，这正是要做专家并行的原因。
- **「把不常被选中的专家删掉，是一种部署优化。」** 改专家数或 k 都会改变模型的计算，输出随之改变，那是换了一个模型，不是同一个模型跑得更快。
- **「总参数乘 8/288 就是每个 token 的计算量。」** 稀疏只发生在路由专家这一块；注意力、共享专家、embedding 等每个 token 都要全算。

## 对照源码

### 怎么开

MoE 没有开关：一层是稠密前馈网络还是 MoE、288 选 8、共享专家有几个，全由模型配置决定，改不了。配置里对应的字段是 `n_routed_experts=288`、`num_experts_per_tok=8`、`n_shared_experts=1`、`moe_intermediate_size=2048`，router 侧是 `scoring_func=sigmoid`、`topk_method=noaux_tc`、`norm_topk_prob=true`、`routed_scaling_factor=2.5`、`n_group=1`、`topk_group=1`。[S1][C4]

`topk_method` 的取值 `noaux_tc` 意思就是「不用辅助损失、改用校正偏置」：只有这个取值下，模型才会建出那份 288 个数的偏置参数。

能开关的是部署侧的三处，都不改数学：专家怎么分卡（`enable_expert_parallel`，见[专家并行的怎么开](expert-parallel.md#怎么开)）、要不要按真实负载搬专家（`enable_eplb`，见 [EPLB](eplb.md)）、共享分支要不要切到另一条流与路由分支重叠（`multistream_overlap_shared_expert`、`multistream_overlap_gate`，两个默认都是 `False`，本部署没开）。

### 会报什么错

选专家这一步有两条硬边界。第一，打分函数只认三种：softmax、sigmoid 和 sqrtsoftplus，改成别的值会在选专家时抛 `Unsupported scoring function`。[C9] 第二，分组选择要求组数和选组数自洽（选组数不能超过组数），否则走不进融合算子。

融合算子走不通时不会报错，而是**静默回退**到逐步骤的 Python 实现：自定义路由函数、sigmoid 打分但关掉归一化、以及分组参数不满足条件，都会让那个检查返回 false，转去走等价的原生实现。[C6][C7] 两条路径的数学一致，但耗时和数值细节不同——排查性能时要先确认走的是哪条。这个检查里判断「专家够不够多」用的是隐藏宽度 4096 而不是专家数 288，GLM 下两者都够大，所以结论不受影响。

### 开销和什么时候别开

MoE 本身的额外开销有三块，都比专家的矩阵乘小得多，但在小批次下占比会变高：router 的一次窄矩阵乘加排序；按专家归拢输入行、算完再散回原 token 的重排；以及跨卡时的派发与回收。[C12] 每层的通信次数和字节数在[专家并行](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

不值得追求更大的 k 或更多共享专家：k 每加 1，这一层的专家矩阵乘和要搬的行数都按比例涨；共享专家是所有 token 都要付的固定成本。反过来，专家数和 k 都是训练定下来的结构，推理侧不能拿来当调优旋钮。

小批次下真正的浪费不在 MoE 的算法，而在并行安排：单条请求时一层 MoE 里有一半的卡拿不到真 token，全靠补位走空，见[专家并行的 router 那一步](expert-parallel.md#1-router-打分选出-top-8)。这笔账怎么随批次变化，见[多请求同时在跑](concurrent-requests.md)。

### 版本差异

三个分支的路由数学一致，位置不同。

| 分支 | router 打分与选择 | 共享专家的 W8A8 路径 |
| --- | --- | --- |
| v0.23（本站钉住 `db701c1f`；维护分支 `2c59ff10`） | `experts_selector.py`：偏置只用于选人、原始分数归一化后乘缩放系数 [C7] | `_forward_shared_experts` 里的量化分支，用融合的反量化-SwiGLU-量化算子 [C10][C16] |
| v0.26（`2ed6cbba`） | 同上，逻辑逐行相同，行号不同 [C17] | 同上，同一段逻辑搬到了 `fused_moe.py` 的后面 [C18] |
| main（`baa023ad`） | 重构成 `router/` 目录下的 `AscendGroupedTopKRouter`，语义不变 [C19] | 重构成 `AscendSharedExperts`，把这条路径显式命名为 `A8_INT_FUSED`（注释写明是「显式 A8 量化 + 融合激活量化」），未量化时才走 `LINEAR_WRAPPER` [C20][C21] |

main 里这个枚举名反过来印证了上一节的结论：上游自己把「显式量化 + 融合激活」和「走 Linear 包装」分成了两条命名不同的路径，前者才是量化部署走的那条。GLM 这个模型的入口在三个分支里的状态（v0.23 维护分支与 v0.26 都没有模型文件，main 在 `models/glm5next/` 有）见[模型总览的版本差异](glm-5-3-flash.md#版本差异)。

### 源码位置

按「谁打分 → 谁选人 → 谁算 → 两支怎么合」读，能把本页机制对回实现。

**检索名称。** 路由专家在源码里是 `FusedMoE` 管的 `num_experts` 那一批，共享专家是挂在同一个模块下的 `shared_experts`；选人的入口是 `select_experts`，融合算子版本是 `moe_gating_top_k`，原生版本是 `_native_select_experts`，分组选择在 `_native_grouped_topk`。选择结果的两半分别是 `topk_ids`（专家编号）和 `topk_weights`（组合权重），校正偏置是 `e_score_correction_bias`，缩放系数是 `routed_scaling_factor`。路由专家的矩阵乘按专家分组进行，分到每个本地专家的行数由 `group_list` 给出。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 288 选 8、共享专家、router 建成 FP32、偏置只在 `noaux_tc` 下创建 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1445-L1538` |
| 专家内部就是一个门控前馈网络（共享专家用的同一个类） | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442` |
| 选专家的入口、融合与原生两条路的分岔、原生路径最后乘缩放系数 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L30-L120` |
| 偏置只用于排序、归一化、分组选择（原生取组内最高分） | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L139-L232` |
| 融合算子的参数：k、组数、组代表分取法、归一化、sigmoid、缩放、偏置 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L286-L312` |
| 融合算子组代表分的两种取法（0 取最高分，1 取前 2 名之和） | `vllm-ascend@db701c1f:csrc/moe/moe_gating_top_k/op_host/moe_gating_top_k_proto.h#L40-L56` |
| 原生实现的打分函数分支与不支持时的报错 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L340-L395` |
| 共享专家的四步计算、串行与多流开关、单独归约 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L671` |
| 路由分支与共享分支怎么进来、两份结果怎么返回 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L672-L719`；`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680` |
| 路由专家的分组矩阵乘与 SwiGLU 融合 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215` |
| 共享专家的两个投影确实带着量化缩放系数；该方案的量化类型登记为 W8A8 | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L162` |
| 多流重叠开关的默认值 | `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L139-L177` |

**正文证据索引。** 模型的 288 选 8、共享专家个数、专家宽度、sigmoid 与 2.5 见 [S1][C4]；专家内部结构见 [C5]。原生路径最后才乘缩放系数见 [C6]；偏置只用于选人、先归一化、原生分组取组内最高分见 [C7]；融合算子的同一组参数（分组时固定取组内前 2 名之和）见 [C8]，这种取法的定义见 [C22]。原生实现的报错与路由专家的分组矩阵乘，已在「会报什么错」「开销和什么时候别开」两节就地标注。共享专家的四步融合路径、串行与单独归约见 [C10]，这条路径要求的 W8A8 量化类型见 [C13]，两支结果的合并见 [C11][C15]，多流开关默认值见 [C14]。稀疏门控 MoE 与辅助损失的原始做法见 [S2]；用每个专家一个偏置代替辅助损失的做法见 [S3]（与本模型 `noaux_tc` 同名同做法）。这两份论文只用来说明训练侧两类办法的分工，页面未联网核对原文；推理侧的结论全部来自钉住 commit 的源码。

正文算式的推导口径：一层路由专家的参数量与一个 token 用到的比例按「三片矩阵 × 专家个数」静态相乘，不含共享专家、router、注意力，也不是量化后的字节数。[D] 2 个 token 选出 12 个专家的例子是为说明批次与 top-k 的关系而设的示例，不是某次真实路由的记录。[A]

**待核。** 一是前 3 层用稠密前馈网络、42 层用 MoE 的具体权衡，缺 GLM 官方技术报告；二是校正偏置在训练中如何调整，缺官方训练说明；三是共享专家的融合算子在图编译后与路由分支的实际时间关系，缺 profiling；四是专用镜像里最终装的算子组合，缺部署权重的量化配方清单，精度假设的影响见[模型权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。本页没有设备实测。
