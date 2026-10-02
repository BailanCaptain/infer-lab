---
id: expert-parallel
title: "Expert parallel：16 张卡怎样分专家、发 token、收结果"
type: feature
summary: EP 把完整专家分放到不同卡上，让 token 去找选中的专家，算完再收回结果。先看这个过程，再沿 GLM 双机部署跟一个 token 走过 MoE，最后核对通信、陪跑与多请求负载。
aliases: [专家并行, Expert Parallel, EP]
chapters: ["14"]
order: 10
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1074-L1209
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1539
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L188-L289
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L96-L101
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L164-L252
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L193-L314
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L440-L560
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L102-L339
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L342-L438
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L435-L557
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L719
  - vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L159-L167
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653
  - vllm@0fc695fc:vllm/config/parallel.py#L154-L178
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L817-L875
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L139-L177
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L202-L252
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L324-L342
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L482-L497
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L296-L315
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L373-L425
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L256-L269
  - vllm@568afb3a:vllm/config/parallel.py#L163-L187
  - vllm@84030bbe:vllm/config/parallel.py#L167-L198
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L460-L491
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L292-L309
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_comm_method.py#L122-L221
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L294
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_stage_params.py#L92-L119
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L153-L185
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/expert_map_manager.py#L25-L130
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L311-L363
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L241-L275
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: C
relations:
  - {to: moe, kind: builds-on, note: MoE 解释 router 选专家与加权输出，本页解释这些专家分布到多卡后的执行}
  - {to: glm-5-3-flash, kind: builds-on, note: 模型总览是 288 选 8、共享专家和各层维度的出处}
  - {to: concurrent-requests, kind: builds-on, note: 展开场景 M 的 MoE 通信，两组补齐和 dummy run 的推导仍在主线页}
  - {to: collective-communication, kind: builds-on, note: All-Gather、Reduce-Scatter 与 All-Reduce 是两条 MoE 路径的通信基础}
  - {to: tensor-parallel, kind: builds-on, note: 路由专家按完整专家分给 EP，共享专家的矩阵仍由机内 TP8 合切}
contradicts: []
updated: "2026-09-27"
origin: seed
---

## EP 是什么？

**expert parallel（EP，专家并行）是 MoE 模型的一种分卡方法：把一层里的专家整份分到不同的卡上，每张卡只放其中一部分；token 选中了哪个专家，就把它的数据送到放着这个专家的卡上去算，算完再把结果送回来。**

先用几句话回顾 [MoE](moe.md)。**MoE**（mixture of experts，混合专家）把一层里的前馈网络（对每个位置单独做变换的几次矩阵乘）换成一池并排的小前馈网络，每个叫一个 **expert（专家）**。每层还配一个 **router（路由器）**：一个小小的打分网络，给当前 token（文本切出的一个小片段）对每个专家打一个分，只把它交给分最高的 k 个专家，这叫 **top-k**；这几个专家的输出再按 router 给出的**组合权重**加起来。这一池要经过 router 挑选、才有机会被选中的专家叫**路由专家**（routed expert），指整个可供挑选的集合，不是某个 token 这一次选中的那几个。有的模型每层还有**共享专家**（shared expert），不经过 router，每个 token 都要过它，[后面单独讲](#共享专家放在哪)。

EP 要解决的是「放不下」：专家很多，每个都得一直放在卡上，一张卡装不下。于是每张卡只放一部分专家，让 token 去找专家。举一个示意的例子：4 张卡，一层有 8 个路由专家 E0–E7，卡 c 放 E(2c) 和 E(2c+1)，也就是卡 0 放 E0、E1，卡 1 放 E2、E3，依此类推；专家 e 在哪张卡，用 e ÷ 2 向下取整就能算出来。每个 token 选 k = 2 个专家。卡 0 上有一个 token「我」，router 给它选了 E3 和 E4：

```wiki-diagram
file: expert-parallel-intuition
```

图里亮色是「我」选中的专家，灰色是这次没选中的。「我」的数据被送到卡 1 和卡 2，E3、E4 各算一遍，结果送回卡 0 按组合权重加起来，就是「我」在这一层 MoE 的输出。搬来搬去的是这个 token 当前的 **hidden（隐藏向量）**：模型为这个位置保存的一排数，在层与层之间传递，见[层与隐藏表示](layers-and-hidden.md)。专家的权重是训练好的矩阵，一直留在持有它的卡上不动。

这一去一回有各自的名字，后面会反复用到：把 hidden 发给选中专家所在的卡，叫 **dispatch（派发）**；算完把结果送回 token 原来的卡、按组合权重加起来，叫 **combine（收回并组合）**。选中的专家正好放在本卡时，就在本卡算，不用发。

EP 不另外占卡，它是同一批卡在 MoE 层里换了一种分工：别的层该怎么分还怎么分，比如几张卡合算一个矩阵；到了 MoE 层，路由专家按 EP 的放法各归各卡。

## 为什么需要 EP？

**MoE 的参数大头在专家上，而且全部专家都要一直放在卡上；一张卡放不下，就得把专家分给几张卡。EP 的分法是「不切专家，只分专家」。**

为什么全部专家都得常驻？每个 token 选哪几个专家，是 router 看这个 token 当场打分决定的，下一个 token 会选谁事先不知道，所以每层的每个路由专家都要随时可用。MoE 省下的是计算：一个 token 只乘到 k 个专家的参数（见 [MoE 的示意账](moe.md#为什么需要-moe代价在哪)）；显存却要装下全部专家。

用示意数感受一下。沿用 [TP 页](tensor-parallel.md#切开以后要付的代价)那个示意模型：hidden 宽 1024，每个数按 BF16 占 2 B，40 层，这里设每层是 128 个专家的 MoE，一个专家是三块 1024 × 2048 的矩阵。专家权重一共 60 GiB，一张 32 GB 的卡装不下；分给 4 张卡，每张卡每层放 32 个专家，只占 15 GiB，剩下的地方还能放其他权重、计算的中间结果和历史缓存：

```calc
title: 示意模型的专家权重放不放得下（数为示意）
一个专家 = 3 × 1024 × 2048 × 2 B = 12,582,912 B = 12 MiB
全部专家 = 40 层 × 128 个 × 12 MiB = 61,440 MiB = 60 GiB，一张 32 GB 的卡放不下
分给 4 张卡 = 60 GiB ÷ 4 = 15 GiB，每卡每层 32 个专家
```

把专家分给几张卡还有另一种切法：[tensor parallel（TP，张量并行）](tensor-parallel.md)，把**每个专家的矩阵切成几条**，每张卡拿每个专家的一条，几张卡合算同一个专家，最后把各自算出的部分和加起来。这一步相加叫 **All-Reduce**：一组卡把各自手里的数逐元素相加，每张卡都拿到总和，见[集合通信](collective-communication.md#all-reduce)。同样是 4 张卡，两种切法每张卡都只存 1/4 的专家权重：

```wiki-diagram
file: expert-parallel-vs-tp
```

差别在一个 token 来了以后谁动手、要搬什么。下表里 N 是参与的卡数：

| | TP：切开每个专家 | EP：分开整份专家 |
| --- | --- | --- |
| 每张卡放什么 | 每个专家的 1/N | 1/N 的专家，每个都完整 |
| 选中 E3、E4 的 token 谁来算 | 所有卡都算，各算一条 | 只有放着 E3、E4 的两张卡 |
| 算完要做什么 | 每张卡只有部分和，要 All-Reduce 加起来 | 结果在别的卡上，要送回来 |
| 卡越多 | 每个专家的矩阵越切越窄，每次相加的量却不变 | 专家保持完整宽度，多出来的是搬运和等待 |

TP 每次相加搬的是这批 token 的完整 hidden，与切成几条无关（[TP 页](tensor-parallel.md#切开以后要付的代价)算过这笔账）；卡越多，每张卡分到的那一条越窄、一次矩阵乘做的活越少，相加的量却一点没少。EP 让每个专家保持完整宽度，一张卡把命中本卡专家的 token 集中起来算；代价换成了把 token 发过去、把结果收回来，以及各卡工作量不均时的等待，这是[后面代价一节](#代价每层两次交换还要等最慢的卡)的内容。两种切法的真实形状与同等权重账留在[对照源码](#开销和什么时候别开)。实际部署常把两者搭配：稠密部分用 TP，路由专家用 EP，GLM 双机就是这样。

## EP 怎么做？4 个 token 走一遍

**每层 MoE 分三步：dispatch 把每个 token 复制到它选中专家所在的卡；各卡用自己的专家算收到的 token；combine 把结果送回 token 原来的卡，按组合权重加起来。**

接着上面的 4 张卡、8 个专家，这次走一整批 token。句子「我吃了苹果」切成「我」「吃」「了」「苹果」4 个 token（为了好读，一个词算一个），每张卡负责其中一个。为了能手算，把 hidden 缩成一个数，把专家 Ek 的计算缩成「乘 k」，E3 就是乘 3；这些都是示意，真实的 hidden 有几千个数，一个专家是三块矩阵。router 已经给每个 token 选好 2 个专家和组合权重，怎么选、权重怎么算见 [MoE 的手算](moe.md#moe-怎么算跟着一个-token-走一遍)：

| token | 所在卡 | hidden（示意） | 选中的专家（组合权重） | 专家在哪张卡 |
| --- | --- | --- | --- | --- |
| 我 | 卡 0 | 2 | E3（0.5）、E4（0.5） | 卡 1、卡 2 |
| 吃 | 卡 1 | 5 | E2（0.6）、E1（0.4） | 卡 1（本卡）、卡 0 |
| 了 | 卡 2 | 3 | E3（0.5）、E7（0.5） | 卡 1、卡 3 |
| 苹果 | 卡 3 | 4 | E3（0.75）、E5（0.25） | 卡 1、卡 2 |

最后一列就是专家编号 ÷ 2 向下取整。每行两个组合权重加起来是 1，这是为了好算取的示意值；实际模型还可能再乘一个缩放系数，和就不是 1 了（见 [MoE 的手算](moe.md#moe-怎么算跟着一个-token-走一遍)第 ⑤ 步）。下图分五格，从上往下读：第一格里每张卡上方的琥珀色框是它放的专家，下方一排格子按 token 排，第几格就装哪个 token 的数据；① 和 ③ 两格每列是一张收数据的卡，上面的小块是送来的数，小块上方写着从哪张卡来，紫色箭头是经过通信送来的块，灰色虚线是本卡自己的那块，不用发；② 一格里每个 token 往下先经过琥珀色小块（交给哪个本卡专家），再经过灰色小块（乘多少组合权重）。浅色格是收到的数，深色格是算出来的数：

```wiki-diagram
file: expert-parallel-flow
```

**① dispatch。** 「我」在卡 0，选中的 E3、E4 在卡 1 和卡 2，于是它的 hidden（2）复制两份，分别发往卡 1 和卡 2；「了」「苹果」也各发两份。「吃」选中的 E2 就在卡 1 本卡，只需把一份发给卡 0 上的 E1。发完以后，每张卡手里是要交给本卡专家的 token：卡 1 收到 3 份，加上本卡的「吃」一共 4 份，卡 0 和卡 3 各只有 1 份。「我」在卡 0 原来那一格空出来了：卡 0 上没有「我」选中的专家，这一格不进本卡专家的计算；「我」的 hidden 本身仍留在卡 0，后面共享专家和残差（把这一层的输入直接加回输出）还要用它。「了」「苹果」在原卡的那一格也一样。

**② 各卡算自己的专家。** 每张卡只用自己放着的专家，算完乘上这个 token 给该专家的组合权重。以卡 1 为例，E3 要处理「我」「了」「苹果」三份，E2 处理「吃」一份：「我」3 × 2 = 6，乘 0.5 得 3；「吃」2 × 5 = 10，乘 0.6 得 6；「了」3 × 3 = 9，乘 0.5 得 4.5；「苹果」3 × 4 = 12，乘 0.75 得 9。同一个专家的几份用的是同一套 E3 权重，卡上会把它们归成一组一起算。空出来的格不算：卡 0 这一步只算「吃」交给 E1 的那一份。

**③ combine。** 各卡把算好的结果送回 token 所在的卡，加进那一格：空着的格从 0 开始加，「吃」这一格已经有本卡 E2 算出的 6，再加上卡 0 送回的 2。「苹果」的两份结果是卡 1 的 9 和卡 2 的 5，送回卡 3 后 0 + 9 + 5 = 14。四个 token 的路由输出依次是 7、8、15、14。

```calc
title: 跟着「苹果」走一遍（数为示意）
苹果的 hidden = 4，在卡 3，选中 E3 和 E5
卡 1 的 E3 算它 = 3 × 4 = 12
乘组合权重 = 12 × 0.75 = 9
卡 2 的 E5 算它 = 5 × 4 = 20
乘组合权重 = 20 × 0.25 = 5
送回卡 3 相加 = 0 + 9 + 5 = 14
不分卡直接算 = 0.75 × (3 × 4) + 0.25 × (5 × 4) = 14
> 两种算法结果相同
```

最后一行说明：**EP 只改变在哪张卡上算，不改变算出来的数。** 专家没有被切开，每个专家仍对完整的 hidden 做完整的计算，所以结果和一张卡上直接算一样。示意里把乘权重放在专家所在的卡上；有的实现把乘权重放进 combine，收回时一起乘加，先乘后送和先送后乘结果相同。

**一个 token 选了 k 个专家，就变成 k 份工作。** 把「一个 token 交给一个专家」的一份工作叫一个 **token–expert 对**：4 个 token × 2 = 8 对。这 8 对落到哪张卡由 router 的选择决定；把卡 r 收到的对数记作 N_r，这里 N_0 = 1、N_1 = 4、N_2 = 2、N_3 = 1。卡 1 放着 3 个 token 都选中的 E3，一张卡担了一半的工作，这会在[代价](#负载不均最慢的卡决定这一层多久)里变成等待。如果一个 token 选中的两个专家恰好在同一张卡上，两份工作就都交给这一张卡。

同一张卡在这里有两个角色：卡 1 是「吃」的**源卡**，负责把它发出去、把结果收回来；它又是「我」「了」「苹果」的**目的卡**，负责接收、计算、送回。一张卡作为源卡只管自己那几个 token，作为目的卡却要接下所有命中本卡专家的 token，这两边的量一般不一样。

## 代价：每层两次交换，还要等最慢的卡

### 每层两次按目的地交换

**按目的地发的时候，dispatch 和 combine 都是「每张卡把不同的数据分别发给不同的卡」，这类通信叫 All-to-All；EP 在每个 MoE 层都要这样一去一回交换两次。** All-to-All 的机制，也就是每张卡把自己的数据按目的地分块、各块送往对应的卡，在[集合通信](collective-communication.md#all-to-all)里画过。EP 的不同在于：每张卡发给谁、发多少，由 router 这一层的选择当场决定，各对卡之间的长短不一样，有的卡之间这一层根本不用发。具体实现还会带上量化、重排和组合权重，不一定直接调用通用的 All-to-All 操作；GLM 用的实现见[后文](#mc2-还是-allgather)。实际部署在这两次前后还会安排别的收集与归约（把各卡的部分结果相加），GLM 一节逐次数。

把上面的分格图按卡数一数，每一份是一条 hidden：

| 卡 | dispatch 发出 | dispatch 收到 | combine 发出 | combine 收到 |
| --- | --- | --- | --- | --- |
| 卡 0 | 2 份（「我」给卡 1、卡 2） | 1 份（「吃」） | 1 份 | 2 份 |
| 卡 1 | 1 份（「吃」给卡 0） | 3 份（「我」「了」「苹果」） | 3 份 | 1 份 |
| 卡 2 | 2 份（「了」给卡 1、卡 3） | 2 份（「我」「苹果」） | 2 份 | 2 份 |
| 卡 3 | 2 份（「苹果」给卡 1、卡 2） | 1 份（「了」） | 1 份 | 2 份 |

发出的份数看本卡有几个 token、每个选几个专家，减去命中本卡的；收到的份数看有多少 token–expert 对落在本卡的专家上。combine 正好反过来：dispatch 收了多少，就要送回多少。一共 8 对工作，只有「吃」的 E2 在本卡，所以每个方向都有 7 份要跨卡。

每份有多大？一份就是一条完整的 hidden。还用前面那个示意模型（hidden 宽 1024，每个数按 BF16 占 2 B，40 层），设每张卡负责 64 个 token，k = 2：

```calc
title: 一张卡每层发出、收回多少（数为示意）
每份 = 一条 hidden = 1024 × 2 B = 2,048 B = 2 KiB
dispatch 发出 = 64 个 token × 2 个专家 × 2 KiB = 256 KiB
combine 收回 = 64 × 2 × 2 KiB = 256 KiB
一层一去一回 = 256 KiB + 256 KiB = 512 KiB
一次前向 40 层 = 40 × 512 KiB = 20,480 KiB = 20 MiB
> 按源卡的 token 计，选中的专家都不在本卡时是上限；命中本卡的那几份不用发
```

这笔量只跟 token 数、k 和 hidden 宽度有关，跟专家有多大、一共有多少个无关；k 翻倍，搬运也翻倍。收的一方就不一定平均了：热门专家所在的卡要收、要算、要送回的都更多。两次交换还都是**集合点**：dispatch 不齐，专家没法开算；combine 不齐，token 拿不到完整结果，下一层就开始不了。真实部署还会把 hidden 量化成 8 位整数再发，每份更小，GLM 一节按真实格式算。

### 负载不均：最慢的卡决定这一层多久

**每张卡放的专家一样多，只保证权重均分；每张卡要干多少活，由这一批 token 选了谁决定。** 前面的例子里 3 个 token 都选中了 E3，放着 E3 的卡 1 要算 4 份，其他卡 1 到 2 份。combine 要等每张卡都交出结果，算得快的卡只能停下来等卡 1：

```wiki-diagram
file: expert-parallel-wait
```

示意里每份工作占一格时间，两次交换各占一格。计算那一段有多长，由份数最多的那张卡决定：

```calc
title: 4 个 token 的负载（数为示意）
token–expert 对 = 4 个 token × 2 = 8 对
平均每卡 = 8 ÷ 4 = 2 对
实际每卡 = [1, 4, 2, 1]，最多的是卡 1
这一层 = 1 + 4 + 1 = 6 格，dispatch、最慢那张卡的计算、combine
平均分时 = 1 + 2 + 1 = 4 格
```

真实的耗时不一定和份数成正比：一张卡只收到几行时，时间主要花在把专家权重从显存读出来（见[矩阵乘和权重](matmul-and-weights.md#同一片权重为什么能处理多行输入)），行数多到一定程度才接近按行数增长。但不管哪种情况，这一层都要等最后一张卡算完。热门专家所在的卡除了多算，还要多收、多存、多送回，接收用的缓冲也更大。

缓解的办法有两层。训练时，router 的**校正偏置**让各专家被选中的次数更均匀（见 [MoE 的负载一节](moe.md#一批-token-怎样落到专家上负载为什么会不均)）；这是模型参数，推理时固定不变。运行时，**EPLB**（expert parallel load balancing，专家并行负载均衡）按实际热度调整专家放在哪张卡，必要时给热门专家多放几份副本，见 [EPLB](eplb.md)。

### 两种搬法：按目的地发，还是先全收齐

**把 token 送到专家那里有两种做法：只发给需要它的卡；或者先让每张卡都拿到全部 token，各自挑出本卡专家要算的。** 前面的分格图是第一种。第二种换了顺序，用同一个例子走一遍：

1. 先做一次 **All-Gather**（每张卡把自己的一份发给所有卡，各卡都拼出完整的一份，见[集合通信](collective-communication.md#all-gather)），4 张卡都拿到「我」「吃」「了」「苹果」全部 4 个 token。
2. 每张卡在本卡挑出选中自己专家的 token 来算，没选中的记作 0。卡 1 算出「我」3、「吃」6、「了」4.5、「苹果」9；卡 3 只有「了」的 10.5，其余是 0。
3. 最后把 4 张卡的结果逐元素相加，每张卡取回自己 token 的那一格，这一步叫 **Reduce-Scatter**（见[集合通信](collective-communication.md#reduce-scatter)）。「苹果」= 0 + 9 + 5 + 0 = 14，和第一种一样。

两种的结果相同，搬的东西不同：第一种按 token–expert 对发，搬多少随 token 数 × k 和路由的目的地变；第二种不管路由，每张卡先收齐整批 token，搬多少随整批 token 数和参与收集的卡数变。例子里，第一种每个方向跨卡 7 份；第二种光收集就是每卡收 3 份、一共 12 份，最后的相加还要再搬一遍结果。哪种更省，要看批次大小、k、卡怎样分组和具体实现。GLM 双机在两种之间按条件切换，条件和真实的账见[后文](#mc2-还是-allgather)。

## 共享专家放在哪？

**共享专家每个 token 都要过，不用 router 挑，所以不参与 EP 的派发。常见做法是把它当成普通的前馈网络：每张卡直接给自己手里的 token 算，可以每卡放一整份，也可以像 TP 那样切开几张卡合算；算出的输出再和路由部分加起来。**

为什么不把它也放到某一张卡上？所有 token 都要用它：要是只放在卡 0，每个 token 都得发到卡 0，卡 0 就要算全部 token，成了最热的那张卡，每个 token 还多一次搬运。所以按 EP 分到各卡的只有路由专家。

接着「苹果」的例子，设共享专家 S 也缩成「乘 1」。这一层 MoE 的输出就是路由部分加共享部分：

```calc
title: 「苹果」这一层 MoE 的输出（数为示意）
路由部分 = 0.75 × E3(4) + 0.25 × E5(4) = 9 + 5 = 14
共享部分 = S(4) = 1 × 4 = 4
这一层输出 = 路由部分 + 共享部分 = 14 + 4 = 18
```

GLM 的放法见后文[第 4 步](#4-combine拼回-token加共享输出)。

## 放到 GLM 双机：一个 token 走过一层 MoE

**EP16 下每卡持有 18 个完整路由专家，一个 token 选中的 8 个专家按持有卡分头计算，跨机命中的工作也会发到另一台机器。** 请求在[一条请求的第 4 站](one-request.md#42-层-moe每卡-18-个专家)，做完本层 attention（汇集历史信息的计算）后进入这里。

GLM-5.3-Flash 每个 MoE 层有 **288 个路由专家**，每个 token 只选其中 8 个来算（top-8，前面的示意是 k=2）；每层另有 **1 个共享专家**，不经过 router，每个 token 都会用到，它不参与 EP。288 个路由专家都得常驻，供下一个 token 随时选用：只选少数专家省的是本次计算，全部层的专家权重仍要装进显存。主干的路由专家权重按 8 位整数存储，合计约 **283.5 GiB**，而一张 A2 卡标称显存是 **64 GB**，单卡装不下；分摊后的实际容量账见[双机部署](glm-5-3-flash-two-node.md#每张卡上放了什么)。

本页固定使用[官方双机配置](glm-5-3-flash-two-node.md)：两台 Atlas 800 A2、每台 8 卡。**TP8** 把一个矩阵切给机内 8 卡协作，**DP2** 让两台机器各有一个独立调度请求的执行组；**EP16 横跨这两个执行组**，每卡持有 18 个完整路由专家。

### 16 张卡怎样分专家

**rank** 是卡在通信组内的编号。这里 EP rank 与全局 rank 一致：node0 是 0–7，node1 是 8–15；node1 的本机设备号仍从 0 数到 7。每层独立使用 E0–E287 这套专家编号，不同层的 E0 是不同权重。本部署未开专家重排或冗余，按连续编号放置：

| node0 的 rank | 专家编号 | node1 的 rank | 专家编号 |
| --- | --- | --- | --- |
| 0 | E0–E17 | 8 | E144–E161 |
| 1 | E18–E35 | 9 | E162–E179 |
| 2 | E36–E53 | 10 | E180–E197 |
| 3 | E54–E71 | 11 | E198–E215 |
| 4 | E72–E89 | 12 | E216–E233 |
| 5 | E90–E107 | 13 | E234–E251 |
| 6 | E108–E125 | 14 | E252–E269 |
| 7 | E126–E143 | 15 | E270–E287 |

rank r 持有从 E(18r) 开始的连续 18 个专家；专家 e 的目的卡由其编号除以 18 向下取整确定，和前面示意里「除以 2」是同一个规则。同一卡上的专家仍是不同网络。

### 1. router 打分，选出 top-8

**机内 8 卡原本各有同一份输入，先分配源 token，让每行只由一张卡负责派发。** 示例请求 R1 的 prompt 有 4 个 token；处理提示词的阶段叫 **prefill**，此时 DP0 的 8 张卡各持有同一份 [4,4096] hidden。下面跟其中任意一个有效 token 走，同时保留整批 R1 的形状。

每张卡的 router 把 [4,4096] 变成 [4,288] 的 **FP32**（32 位浮点）分数。R1 使用按目的卡派发的 **MC2 路径**，两条路径的实现与选择条件见[后文](#mc2-还是-allgather)。它的 prepare（准备阶段）把 4 行补到 8 行，再按 TP rank 切成每卡 [1,4096] hidden 和 [1,288] 分数；这一步只是本地补零和取切片，没有[集合通信](collective-communication.md)（一组卡共同参与的数据交换或求和）。**mask** 是标明有效行的布尔数组：DP0 的 rank 0–3 各负责一个 R1 token，rank 4–7 只有补位。这和前面示意里「每张卡负责派发一个 token」是同一个局面。

然后每张卡为自己这一行选择 8 个专家（**top-8**），得到两份 [1,8]：专家编号与组合权重。router 用 sigmoid（把数值映射到 0–1 的函数）打分，加校正偏置后决定选谁，组合时用原分数归一化再乘模型规定的 2.5；偏置与组合权重的区别见[模型的 MoE 结构](glm-5-3-flash.md)。top-8 在卡内完成，没有通信。

### 2. dispatch：源卡负责一行，目的卡接到许多行

**dispatch 按这个 token 选中的 8 个专家编号，把 hidden 送到相应持有卡。** 部署采用 **W8A8**：权重与矩阵乘输入为 8 位整数（**INT8**）；层间 hidden 用 **BF16**（16 位浮点）。hidden 在 dispatch 中量化，每个 token–expert 对（沿用前面示意里的定义）携带一条 4096 维 INT8 向量和一个 FP32 scale（恢复数值范围的缩放系数）。本部署的 EP 组与 MC2 专用通信组都覆盖全局 rank 0–15；本卡专家在本卡计算，远端专家经卡间链路接收，目的卡在另一台机器时经过机间链路。

**目的卡的行数不是源卡的一行。** 和示意里一样，把 rank r 收到的有效 token–expert 对数记为 N_r，它从两个 DP 执行组的源卡接收，重排成按本地 18 个专家分组的 [N_r,4096]。dispatch 还留下原 token 的位置、接收计数等关联信息，combine 靠它们把结果送回。

rank 4–7 没有自己的 R1 token 要发，**收到多少专家工作由 R1 的 top-8 决定**。node1 没有 R1 的请求状态，也照常接收命中它所持专家的工作。把“源行是补位”误读为“这张卡不算专家”，就会看错 EP 的负载。

和示意里的卡 1 一样，rank 0 既是源卡（为自己的 token 找专家并收回结果），也是目的卡（接收两个执行组发给 E0–E17 的工作，算完返回）。下图把这两个方向分开画；箭头表示可达关系，实际发往哪张卡由这一层的 top-8 决定。

```wiki-diagram
file: expert-parallel-assign
```

### 3. 各卡计算自己持有的专家

**每张卡把收到的行按 18 个专家分组，各做一次三段矩阵乘。** 一个专家有 gate、up、down 三个矩阵：gate 和 up 各把 hidden 的 4096 维映射到 2048 维，down 再投影回 4096 维。EP 保留完整的 2048 维；一个完整路由专家的三块矩阵占 **24 MiB**。

**grouped matmul** 把这些矩阵乘组织成分组计算，组与组权重不同、行数也不同；dispatch 返回的分组计数记录 18 组各有多少行。**SwiGLU** 把 gate/up 两半向量经门控相乘，形成专家的中间表示。

| 阶段 | rank r 上的逻辑形状 | 集合通信 |
| --- | --- | --- |
| 接收、按专家重排 | [N_r,4096] INT8，附逐行 scale | 已由 EP16 dispatch 完成 |
| gate/up 投影 | [N_r,4096]，每行使用所属专家的权重 | 无 |
| SwiGLU 与再量化 | 两半门控相乘，变成 [N_r,2048] INT8 | 无 |
| down 投影 | [N_r,4096] BF16 | 无 |

这里写逻辑有效形状；实际缓冲按算子容量与布局要求补齐。**trace** 是逐算子、逐次通信的运行记录，各卡 N_r、缓冲分配形状与峰值显存的证据缺口列在页末。权重加载后还会转置、转为昇腾分块格式，上表保留其数学维度。

### 4. combine、拼回 token、加共享输出

**combine 把各专家的结果送回原源卡，加权合成这个 token 的路由输出。** 各专家算出的 BF16 向量通过 EP16 按目的卡交换，回到源卡后得到 [1,4096] 的路由结果。

这一层还有 **1 个共享专家**，让所有 token 都经过同一个 MLP（先投影、做非线性，再投影回 hidden 的前馈网络）。它与选中的路由专家处理同一条 hidden，由每台机器的 **TP8 合切，每卡每层占 3 MiB**；分片形状和字节推导统一见 [tensor-parallel 的共享专家小节](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)。

接下来 **All-Gather** 在 TP8 内收集各卡的 token 切片，拼成 [8,4096]，去掉尾部补位后恢复 [4,4096]。**combine 合齐的是一个 token 的专家贡献，All-Gather 拼回的是 prepare 切开的不同 token 行。** 共享分支从始至终处理完整 [4,4096]，经 TP8 **All-Reduce**（将各卡部分和逐元素相加，让各卡得到完整结果）得到完整共享输出，再与路由输出逐元素相加。该部署没有开启共享专家多流重叠，实际顺序是路由分支完成后执行共享分支。

```calc
title: 一个 token 的 MoE 输出
路由部分 = Σ [8 个选中专家的组合权重 × 各自输出]
最终输出 = 路由部分 + 共享专家输出
输出形状 = [4096]
```

沿途有两种不同的拆分：源卡只负责派发自己的 token 行，目的卡则集中处理命中本卡专家的所有行。combine 先把同一个 token 的专家贡献合齐，收尾阶段才把不同 token 行拼回整批；共享分支始终保留本组完整输入。下表按这条顺序核对每一步的形状与通信。

| R1 每卡的阶段 | 源卡或目的卡形状 | 通信域与本层调用 |
| --- | --- | --- |
| router → prepare → top-8 | [4,288] → [1,288] → 两份 [1,8] | 无 |
| dispatch | 源卡 [1,4096] → 目的卡 [N_r,4096] | EP16，1 次 MC2 dispatch |
| 本地专家 | [N_r,4096] → [N_r,2048] → [N_r,4096] | 无 |
| combine | 回到源卡 [1,4096] | EP16，1 次 MC2 combine |
| finalize（收尾） | [1,4096] → [8,4096] → [4,4096] | TP8，1 次 All-Gather |
| 共享专家与相加 | 完整 [4,4096] 输入 → 同形状 TP 部分和 | TP8，1 次 All-Reduce；相加在卡内 |

这一层共 4 次集合通信调用；主干 42 层重复这套流程。R1 每层 dispatch ≤32,800 B、combine ≤65,536 B、finalize 每卡贡献 8,192 B、共享归约载荷 32,768 B，计算与整次前向账统一见[一条请求的 MoE 与通信账](one-request.md#42-层-moe每卡-18-个专家)。这些调用数描述程序边界，底层协议可以把一次调用拆成多轮传输。

### 其他层与后续生成也这样算吗？

**主干的 42 个 MoE 层都重复上述过程，前 3 层则用普通前馈网络。** 按从 0 开始的层号，MoE 对应第 3–44 层，每层重新从 288 个路由专家中选 8 个，并加上 1 个共享专家的输出。

后续在已有历史上继续生成的阶段叫 **decode**。本部署用 **MTP**（Multi-Token Prediction，先猜候选 token、再交主模型验证的模块）同时验证一个确定 token 和三个候选，主模型这一步也有 4 行，与 R1 prefill 的 MoE 形状相同。

主干路由专家占 **17.72 GiB/卡**，MTP 另有一层专家，占 **432 MiB/卡**；这两项、整卡 **20.58 GiB** 及占比统一见[部署页权重表](glm-5-3-flash-two-node.md#每张卡上放了什么)。缩放系数、通信缓冲和激活另计。

## 放到 GLM 双机：搬法怎么选，两组怎么配合

**单个短请求走按目的地派发的 MC2；一批里有长提示词、执行宽度超过门槛时，两组都改走先全收齐的 AllGather。两台机器的调度彼此独立，MoE 这一步却必须一起进、一起出。**

### MC2 还是 AllGather

前面[两种搬法](#两种搬法按目的地发还是先全收齐)在这套部署里各有名字：按目的地发的是 MC2 路径，先全收齐的是 AllGather 路径。在本页 **A2、开启 EP** 的部署里，每步只在 MC2 和 AllGather 两种路径之间选择。**MC2** 是昇腾上协同执行计算与通信的一类实现，本页具体指按目的卡交换数据的 MoE dispatch/combine 算子；**AllGather** 是先收集两组完整输入、各卡筛出本地专家的工作、再归约输出的 MoE 路径。后者名称不带连字符；**All-Gather** 则是收集各卡数据的集合通信操作，MC2 和 AllGather 两条路径都会用到。其他设备、配置与版本的分支见[版本差异](#版本差异)。

选择看两个 DP 执行组的**最大 token 数**，而且是经过本步 capture size 与 DP 对齐之后传入的数。**capture size**（图尺寸）是预先捕获、可供回放的执行 token 宽度；**graph mode**（图模式）复用已记录的算子执行过程，减少逐次提交的开销。三个条件同时满足才使用 MC2：**每卡专家数 ≤24、EP 规模 ≥16、最大 token 数 ≤128**。本部署前两个条件恒成立，128 是当前配置的 MC2 容量门槛，推导只保留在[one-request 的 MoE 小节](one-request.md#42-层-moe每卡-18-个专家)。

后文的[场景 M](#场景-m多请求时的整批账和负载不均)是 DP0 有 12 条 decode 请求并混入 6000-token prefill、DP1 有 7 条 decode 请求的批次。R1 的 4 行、场景 M 加入 prefill 之前的 64 行都走 MC2；混入长 prefill 后最大值变为 6048，两组都走 AllGather。**切换由宽度越过容量门槛触发**：R1 的短 prefill 仍在容量内。graph mode 是否回放是另一套判断，见[并发页的 capture size 与两组对齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。

```wiki-diagram
file: expert-parallel-fit
```

**为什么单机 EP8 只能走 AllGather。** 对同一个 GLM 模型，EP8 每卡要放 36 个路由专家：EP 规模不足 16，同时每卡专家数超过 24，两个条件都不满足。即使 token 很少，也无法进入此 A2 MC2 分支。EP8 的权重与容量对照见[部署页的单双机比较](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

### AllGather 路径：先拿到所有输入，再只算本卡专家

MC2 先按 token 切片，再按专家目的地发送；AllGather 在本配置下保留本组完整输入，并先与另一个 DP 组交换。这里的 **DP 通信组** 是跨机同一 TP 编号的两张卡，例如 {0,8}；共有 8 对。它与“node0/node1 两个 DP 执行组”的说法区别见[分组说明](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

AllGather 先分别收集 hidden 与 router 分数，再在卡内选专家、重排、计算和加权还原。每卡得到的是本地专家对全部输入的贡献；**Reduce-Scatter** 将两卡的结果逐元素相加，再按 token 所属执行组切回两份。之后加入本组共享专家的 TP 部分和，最后由 TP8 All-Reduce 把全部贡献加齐。场景 M 的双列流程图和逐卡形状放在后面的整批账里。

两种路径都完成“8 个被选中的路由专家输出加权，再加共享输出”，但归约的安排不同：MC2 已在 combine 完成路由汇合，所以共享输出单独 All-Reduce；AllGather 把两种部分和留到最后一起 All-Reduce。**AllGather 每层也只有 4 次集合通信：两次 DP All-Gather、一次 DP Reduce-Scatter、一次 TP All-Reduce。**

两者通信次数相同，搬的数据却不同。下表先对比搬什么；实际批次的载荷与 113 倍差距在场景 M 中展开。

| 路径 | 输入怎样送到专家 | 结果怎样收齐 | 通信量取决于什么 |
| --- | --- | --- | --- |
| MC2 | 选中专家对应的 INT8 hidden 与 FP32 scale | EP combine，再拼回 token 行；共享输出单独归约 | 有效 token–expert 对、路由目的地与补齐宽度 |
| AllGather | 两组完整 BF16 hidden 与 FP32 router 分数 | DP Reduce-Scatter，再把路由与共享贡献一起 TP All-Reduce | 两组补齐后的完整宽度 |

### 两个 DP 组为什么要陪跑

两台机器各有 scheduler（决定本步算哪些请求的组件），请求状态和缓存归所属 DP 执行组管理；专家却分布在一个跨机 EP16 组里。因此“DP1 没有自己的请求”只表示它不用为自己的用户生成结果，**它仍持有供 DP0 路由选择的 E144–E287**。

DP1 空闲时执行 **dummy run**，即用空批次进入同一步模型执行，让通信参与者按相同次序到达。空批次起点为 4 行，纯 decode（在已有历史上继续生成）的对照场景拉到 64 行；场景 M 中 DP1 一条请求都没有的变体 **M′**，混入长 prefill（处理提示词）后拉到 6048 行。对齐、补齐和唤醒的推导统一见[concurrent-requests 的陪跑小节](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

这对 EP 有三个具体含义：

- **空闲组仍处理真实专家工作。** DP1 收到 DP0 的 token 后，用本地专家算出的结果要回到 DP0。被丢弃的是 dummy 请求自身的最终输出；DP1 为 DP0 算的专家贡献必须保留。
- **两组共用 MoE 通信选择。** DP1 自己只有少量 token，也会因为 DP0 的最大宽度超门槛而进入 AllGather，通信载荷仍由 6048 这个宽度决定。
- **通信同步形成共同的等待点。** 任一张持有专家的卡慢下来，依赖它输出的 token 就要等；任一成员没有进入相应通信，其他成员可能等待或超时。把两个调度器视作彼此独立的完整模型，会漏掉这个约束。

### 场景 M：多请求时的整批账和负载不均

[场景 M](concurrent-requests.md#示例场景-m-与变体-m)中，DP0 有 12 条 decode 请求并混入 6000-token prefill，DP1 有 7 条 decode 请求。它的纯 decode 对照，就是先去掉新来的长 prefill。

同一组 12 条与 7 条 decode 请求，加入 6000-token prefill 后，MoE 的每卡每步逻辑载荷从 **≤55.1 MiB** 变成 **6.09 GiB**。变化同时来自执行宽度由 64 增至 6048，以及搬运方式从按路由发送 INT8 hidden，改为收集完整 BF16 hidden 与 FP32 分数；两档账面载荷的比值约 **113 倍**。

```wiki-diagram
file: expert-parallel-split
```

“每步”在这张图里指**主模型一次前向的 42 个 MoE 层**；MTP 草稿层三次执行另计，一次验证实际接受的候选数决定这一轮最终产出多少 token。图中长短按同一线性比例绘制，55.1 MiB 取源侧上界，113 倍描述这两个不同批次的载荷比；同批次更换算法后的耗时需要另做测量。

**计量口径。** MC2 按源卡负责的 token–expert 对计 dispatch 与返回结果；TP All-Gather 计本卡贡献的切片；DP All-Gather 计接收的另一组切片；Reduce-Scatter 计输出切片；All-Reduce 计输入张量。网卡发送加接收的计数还取决于通信算法、本地命中、协议元数据与重复传输；HCCL（昇腾的集合通信库）与网卡的实测证据缺口统一列在页末。

### 场景 M · 纯 decode：补齐后每卡负责 8 行

从场景 M 去掉新来的 6000-token prefill，两个 DP 组分别有 48、28 行真实 token；capture size 与 DP 对齐后，两边都是 64 行。**64 行的推导**在[并发页](concurrent-requests.md#再补到两组的最大值)，MC2 再沿 TP8 分给每卡 8 行。

一个 token–expert 对的 dispatch 发 INT8 hidden 加 FP32 scale，combine 返回 BF16 hidden。**≤55.1 MiB** 的上界按源卡 8 行全有效、每行 8 个专家副本全部计入。有效行 mask 会排除补位，本卡命中在本地完成；TP All-Gather 与共享 All-Reduce 仍使用补齐后的张量。目的卡接收、计算与返回的量由 N_r 决定；本图按源 token 归属记账，热门专家持有卡的收发量另看路由分布。同目的卡副本是否合并由 CANN（昇腾运行与算子库）实现决定，所需证据列在页末。

### 场景 M · 混入长 prefill：每卡收集 12096 行

场景 M 的 DP0 有 6048 行，DP1 只有 28 行真实数据，但该步执行宽度同为 6048；如何补齐见[并发页](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。AllGather 的全局输入宽度为 12096，每卡按下面四步执行。

双列图左边回顾 R1 的 MC2 路径，右边跟场景 M 走 AllGather；两列各自从上往下读。prepare 是准备输入，finalize 是计算后的收尾；Nᵣ 沿用前文定义，表示目的卡 r 收到的有效 token–expert 对数。注意右列的 dispatch/combine 已在卡内完成，跨卡通信安排在它们前后。

```wiki-diagram
file: expert-parallel
```

1. **先算 router，再收集输入。** 每卡本地 hidden 为 [6048,4096] BF16，router 分数为 [6048,288] FP32。每个 DP 两卡通信组分别对 hidden 和分数做一次 All-Gather，得到 [12096,4096] 与 [12096,288]。因为本机 8 卡原本持有同一份输入，跨机交换后，全部 16 卡都能看到两组输入。
2. **top-8 和 dispatch 在卡内完成。** 每卡选择出 [12096,8] 专家编号与权重；本地 routing 算子只保留命中本卡 18 个专家的行，按本地专家范围筛选和重排，并在 W8A8 下量化输入。这里名为 dispatch 的步骤没有额外跨卡发送：完整输入已经在 prepare 阶段收到了。
3. **本地专家与本地 combine。** 专家计算仍是 [N_r,4096] → [N_r,2048] → [N_r,4096]。本地 combine 把行顺序还原，并乘路由权重，形成 [12096,4096]。每卡只贡献自己专家的结果，其他专家贡献为零。
4. **跨两级组归约。** Reduce-Scatter 先把两卡结果逐元素相加，再按 token 所属 DP 组切回两份：[12096,4096] → [6048,4096]。此时每卡得到一对 EP rank 的专家贡献。共享专家在本组 [6048,4096] 上算出自己的 TP 部分和，加进去后，最后一次 TP8 All-Reduce 把 8 对路由贡献和 8 份共享贡献全部加齐，每卡得到本组完整输出 [6048,4096]。

| 场景 | MC2 / AllGather | 每卡每步 MoE 载荷 | 跨机相关载荷 |
| --- | --- | --- | --- |
| 12 条与 7 条纯 decode，执行宽度 64 | MC2 | ≤55.1 MiB | dispatch + combine ≤31.5 MiB；实际跨机量还取决于目的地 |
| DP0 混入 6000-token prefill，执行宽度 6048 | AllGather | 6.09 GiB | 两次 DP All-Gather 加一次 DP Reduce-Scatter，共约 4.15 GiB |

增加通信的两件事都在形状里：DP1 的真实 28 行也被拉到 6048 行；AllGather 跨机收集完整 BF16 hidden 和 FP32 router 分数，MC2 则按选中专家发送 INT8 hidden。

AllGather 还要存全量输入：一份 [12096,4096] BF16 hidden 就是 **94.5 MiB/卡/层**，再加 router 分数、重排激活与结果缓冲；94.5 MiB 的换算即下方算式中 47.25 MiB 的两份。层间会复用临时空间，峰值应通过实际分配与 trace 核定。

### 场景 M 的每卡账：权重均分，工作量看路由

每卡 18 个专家只保证权重均分，道理见前面的[负载不均](#负载不均最慢的卡决定这一层多久)。每个 token 的 top-8 由自己的 router 分数决定；如果一批请求集中命中某几个专家，持有它们的卡会接收更多行，形成更大的重排缓冲与矩阵乘，并让其他卡在 combine 或归约处等待。

纯 decode 的 76 个真实 token 形成 608 个 token–expert 对，理想均分时每卡 38 行；场景 M 的 AllGather 输入包含补位，routing 面对 12096 行。下面把通信账和**理想均分参考量**放在同一个算式块中，真实 N_r 要看路由结果。

```calc
title: 场景 M 与纯 decode 对照的每卡账
纯 decode · MC2 源侧上界
每对 dispatch = 4096 × 1 B + 4 B = 4,100 B
每对 combine = 4096 × 2 B = 8,192 B
本层 dispatch = 8 行 × 8 个专家 × 4,100 B = 262,400 B
本层 combine = 8 行 × 8 个专家 × 8,192 B = 524,288 B
本层 TP All-Gather = 8 × 4096 × 2 B = 65,536 B
本层共享 All-Reduce = 64 × 4096 × 2 B = 524,288 B
MC2 本层合计 = 262,400 + 524,288 + 65,536 + 524,288 = 1,376,512 B
MC2 主干合计 = 42 × 1,376,512 B ÷ 1024² ≈ 55.1 MiB
MC2 的 EP 交换 = 42 × (262,400 + 524,288) B ÷ 1024² ≈ 31.5 MiB

场景 M · AllGather
DP 收 hidden = 6048 × 4096 × 2 B = 49,545,216 B ≈ 47.25 MiB
DP 收 router 分数 = 6048 × 288 × 4 B = 6,967,296 B ≈ 6.64 MiB
DP Reduce-Scatter = 6048 × 4096 × 2 B = 49,545,216 B
TP All-Reduce = 6048 × 4096 × 2 B = 49,545,216 B
AllGather 本层合计 = 3 × 49,545,216 + 6,967,296 = 155,602,944 B
AllGather 主干合计 = 42 × 155,602,944 B ÷ 1024³ ≈ 6.09 GiB
AllGather 的 DP 交换 = 42 × (49,545,216 + 6,967,296 + 49,545,216) B ÷ 1024³ ≈ 4.15 GiB
载荷比值 = 155,602,944 ÷ 1,376,512 ≈ 113 倍

理想均分 · 专家计算行数
纯 decode 的关联 = 76 × 8 = 608 对
纯 decode 每卡 = 608 ÷ 16 = 38 行
场景 M 的关联 = 12096 × 8 = 96,768 对
场景 M 每专家 = 96,768 ÷ 288 = 336 行
场景 M 每卡 = 336 × 18 = 6,048 行
```

AllGather 的 6048 行理想计算量同时包含真实请求与补位。热门专家集中到一张卡，会同时增加它的接收、计算和返回工作；延迟还取决于矩阵乘效率与通信等待，需结合页末列出的逐层、逐专家 trace 判断。

### 这套部署有没有开 EPLB

**EPLB**（expert parallel load balancing）通过调整专家的物理放置、必要时配置冗余副本，缓解热门专家集中到少数卡的问题。对照官方两端命令与默认配置，**本部署未开启 EPLB，也没有冗余专家**。router 的校正偏置作为模型参数影响 top-8；运行时 EPLB 则改变物理放置。这里的“未开启”指按教程启动且未额外覆盖配置，逐项默认值与日志核对方法放在[怎么开](#怎么开)。

## 常见误解

- **“EP 是把每个 token 都发到所有卡上吗？”** MC2 按选中的专家找目的卡；多个被选专家在同一卡时，工作就送到同一卡。AllGather 则先让全部卡看到输入，再只算本卡专家。EP 定义权重归属，数据怎样搬由通信实现决定。
- **“专家越多就一定越慢？”** 固定 top-8 和专家宽度时，单个 token 的专家矩阵乘规模不会随总专家数等比例增加。但更多权重占显存，router 的打分更宽，还要重新核对放置与通信条件；是否变慢要结合批次和路由测量。
- **“TP8 和 EP16 会把每个专家切成更多小片吗？”** 本部署路由专家在 EP 持有卡上完整计算；共享专家才按 TP8 合切。MC2 对 token 的 TP8 切片与切专家矩阵是两件事。
- **“rank 4–7 在 R1 中拿到补位，所以这些卡都没活？”** 它们没有源 token，却仍作为目的卡处理 R1 命中的本地专家；收到多少由 top-8 决定，node1 也一样。
- **“开 EP 就自动均衡，或打开 MC2 就是打开 EPLB？”** EP 决定专家归属，MC2 决定搬运方式，EPLB 才调整负载放置；上节用真实路由行数衡量各卡工作量。
- **“一有 prefill 就改走 AllGather？”** 本配置看最大 token 数是否超过 128，R1 的 4-token prefill 仍走 MC2。
- **“每步 55.1 MiB 是每张网卡的实测流量？”** 它是上述纯 decode 场景、主干 42 层、按源 token 与集合通信载荷统计的上界。目的卡负载、机内与机间分布、协议开销需要另测。
- **“EP 把专家切开算，结果会和一张卡上算的不一样？”** 路由专家没有被切开，每个专家在持有卡上对完整的 hidden 做完整计算，EP 改变的只是在哪张卡上算；示意例子里「苹果」分卡算和不分卡算都得 14。
- **“EP 要另外准备一批卡？”** 不用。EP 是同一批卡在 MoE 层里的分工；本部署的 EP16 由 TP8 与 DP2 推出来，没有单独的 EP 卡数参数，见[怎么开](#怎么开)。

## 对照源码

### 怎么开

两端启动参数的核心组合是 `--tensor-parallel-size 8 --data-parallel-size 2 --data-parallel-size-local 1 --enable-expert-parallel`，模型量化使用 `--quantization ascend`；节点编号、地址和网络配置照[官方双机教程](https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md)填写。

`enable_expert_parallel` 默认 `False`，必须显式开启。**EP16 是并行组配置推出来的规模**，并没有另外传一个 `--ep-size 16`。本部署 TP8 与 DP2 被拍平成 EP16，路由专家内部 `tp_size=1`。去掉 EP 开关后，FusedMoE 转到对专家矩阵做 TP 分片的分支，权重归属和通信都要重新核算。[C3]

| 相关参数 | 本部署的状态 | 控制什么 |
| --- | --- | --- |
| `expert_placement_strategy` | 默认 `linear` | 连续专家编号的放置；本页以此画 16 卡布局 |
| `enable_prefill_mc2` | 默认 `False` | 是否用 token 预算扩大 MC2 容量来源；当前 128 的推导链接见上文 |
| `enable_fused_mc2` | 默认 0 | 另一种融合实现开关；普通 MC2 由 A2 选择器自动选中，开 MC2 不要求把它设为 1 |
| `multistream_overlap_shared_expert`、`multistream_overlap_gate` | 默认 `False` | 共享专家或 gate 是否切到另一执行流重叠计算 |
| `enable_eplb`、昇腾 `eplb_config` | 关闭、零冗余 | 专家放置与动态均衡；详见 [EPLB](eplb.md) |

表中昇腾的 MC2 与多流默认值来自昇腾配置初始化。[C19]

**“开了也没用”的边界：**只有一张卡参与 MoE 时，上游 `use_ep=False`；非 MoE 模型没有路由专家可分，昇腾的选择器直接返回 `None`。这两种情况都不会仅因打开 EP 而报错。对于 MoE，未开 EP 或 EP 通信组只有一个成员时，选择器直接返回 AllGather。[C37]

本页 AllGather 走 DP 两卡组的 prepare/finalize，条件包括未开启 FlashComm1（昇腾的通信优化）与 sequence parallel（沿 token 维分片的执行方式）。改变这些配置后，按 `PrepareAndFinalizeWithAllGather` 的 EP-group 分支重新列张量与通信账。

**专家与共享分支怎样落到配置。** 连续编号放置对应 `linear`。上游并行配置把 DP2 与 TP8 拍平成 16，未开 EP 时保留为专家内部 TP，开 EP 时改为 EP16、专家内部 TP1；`FusedMoEParallelConfig.tp_size` 是 1，机内 TP8 通信组仍然存在。共享专家同样挂在 `FusedMoE` 下，按 EP 分的只有 288 个路由专家；共享 MLP 取 `disable_tp=False` 并沿用 TP8，条件与分片推导见前面的 tensor-parallel 链接。

**EPLB 的逐项核对。** 官方教程未覆盖下列默认值，因此本页按关闭、零冗余记账。

| 检查项 | 默认值与教程配置 | 对本页的影响 |
| --- | --- | --- |
| vLLM `enable_eplb` | 默认 `False`，教程没有 `--enable-eplb` | 不启用上游 EPLB |
| `eplb_config.num_redundant_experts` | 默认 0，教程未覆盖 | 物理专家数仍为 288 |
| 昇腾 `eplb_config.dynamic_eplb` | 默认 `False`，`expert_map_path=None` | 没有动态重排或自定义映射 |
| `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` | 教程没有设置，也没有相应 additional-config | 未启用昇腾动态 EPLB 及采集路径 |
| profile 的强制均分 | `enable_force_load_balance` 取 `in_profile_run` | 启动时用均分负载测显存；线上热度由真实 router 决定 |

实际进程可用 `Dynamic EPLB is ...` 和 `The number of redundant experts is ...` 两行日志核对，并检查页末所列配置转储与环境变量。官方命令与昇腾默认值分别见 [S2]、[C18]。

### 会报什么错

以下是本执行快照中的明确检查，便于把错误定位到具体阶段：

| 报错或现象 | 触发条件 | 先核对什么 |
| --- | --- | --- |
| `Number of global experts mismatch (excluding redundancy)` | W8A8 方法看到的 router 列数与逻辑专家数不一致 | 模型配置、router 权重、量化描述是否匹配；本模型 router 应有 288 列 |
| `expert_map is required for MC2 token dispatch.` | MC2 收到的专家映射为空 | 检查 EP 配置与初始化，确认 prepare 已建立实际执行分支需要的映射 |
| `Missing communication context` [C30] | fused experts 执行时缺少已选通信实现 | 调用是否经过 forward context；自定义直接调用 MoE 的路径是否漏了上下文 |
| `PTA and CANN version is too old to support mc2 hierarchy comm...` | 开启层级通信但 torch_npu 没有 dispatch v2 接口 | torch_npu（PyTorch 的 NPU 扩展）与 CANN（昇腾运行与算子库）的配套版本 |
| `The expert_map is not json.` / `The expert_map is not exist.` | 自定义 EPLB 映射扩展名或可读性不满足要求 | 文件格式、路径和权限 |
| 要求 `DYNAMIC_EPLB or EXPERT_MAP_RECORD ... true` 的断言 | 开动态 EPLB，却未设置所需环境变量 | 按 EPLB 的完整启动条件检查 |

EP8 或超过 128 行**正常返回 AllGather**，不是上述错误。若卡在通信里，先按时间对齐 16 个 worker（每卡执行进程）的日志，检查哪张卡先异常退出、两边是否进入同一轮；定位方法见[请求调用链](request-call-chain.md#出问题时判断它停在哪一站)。

### 开销和什么时候别开

EP 的收益是分摊专家权重与计算，代价是每层 dispatch/combine、重排缓冲、同步等待，以及跨 DP 的陪跑。严格说，触发陪跑的是 MoE 本身，不开 EP 时专家也切在所有卡上（见 [Data parallel](data-parallel.md#moe-模型里两组为什么不能各跑各的)）；本部署开了 EP16，结论相同。本部署 42 个 MoE 层把这些代价重复付出；R1 很小时源 token 分片大量为空，多请求时则可能由热门专家或长 prefill 拉高开销。

**同一批专家权重的两种分法。** 保持 288 个专家和 16 张卡，TP 一栏是同一模型的矩阵分片对照，当前运行的是 EP 一栏。实现把 gate、up 合为 `w13_weight`；当前 EP 权重在每卡打包成 `w13_weight [18,4096,4096]` 与 `w2_weight [18,4096,2048]`。

| 比较项 | 把每个专家按 TP16 切 | 本部署：按 EP16 分专家 |
| --- | --- | --- |
| 每卡持有什么 | 全部 288 个专家各自的 1/16 权重 | 18 个完整专家 |
| 每卡每个专家的矩阵 | gate/up 各 [128,4096]，down [4096,128] | gate/up 各 [2048,4096]，down [4096,2048] |
| 一个 token 选中 8 个专家后 | 16 卡都算这 8 个专家的各自分片；每个专家在本卡的中间结果只有 128 维 | 每个选中专家由其持有卡算完整 2048 维；某卡算几个取决于 top-8 命中 |
| 结果怎样汇合 | 每卡的 down 产生 4096 维部分和，先在本卡按专家权重组合，再跨卡求和；可用 All-Reduce，或按两级通信组分阶段归约 | 把完整专家输出返回源 token 并加权；两条通信路径组织方式不同 |
| 算子形状与代价 | 单个专家越切越窄，down 输出仍是 4096 维，归约张量没有随中间维一起缩小 | 保留专家矩阵宽度，把命中同一专家的行集中计算，付出派发、回收与负载不均的代价 |

TP 可以先合并本卡 8 个专家的贡献，再做整层归约，因此这里按整层部分和计算。下面用 BF16 输出载荷看清“切小矩阵”与“缩小归约”之间的差别。[D]

```calc
title: 同一批专家权重的 TP16 与 EP16 分法
完整专家权重 = 3 × 4096 × 2048 × 1 B = 24 MiB
TP16 中间宽度 = 2048 ÷ 16 = 128 维
TP16 每专家每卡 = 24 MiB ÷ 16 = 1.5 MiB
TP16 每卡每层 = 288 × 1.5 MiB = 432 MiB
EP16 每卡每层 = 18 × 24 MiB = 432 MiB
TP 每 token 的归约张量 = 4096 × 2 B = 8,192 B
TP 的 R1 四行归约张量 = 4 × 4096 × 2 B = 32,768 B
> 归约张量按逻辑输入计；实际链路字节由集合通信算法决定
```

两种分法的每卡路由权重一样大；**选 EP 的理由在计算与通信的组织方式**：每个专家保持 2048 维，token 按专家聚集成批，避免让全部卡都参与每个被选专家的窄分片计算。实际收益取决于批次、路由热度与链路。

对于能在更小通信域内容纳权重、目标又是极小批次延迟的部署，应比较 TP 与 EP 的实测吞吐、首 token 延迟、后续 token 延迟和显存余量，再决定是否扩大 EP。单机 EP8 可少一层机间依赖，但失去本文 A2 的 MC2 资格；[部署页](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)给出容量取舍。**待核：缺同负载的单双机及 TP/EP 对照 trace**，需同时记录上述性能指标与通信耗时。

### 版本差异

这里核对的是**EP 基础能力、默认开关与 A2 通信选择**。GLM 贯穿算例固定在专用镜像提交 `db701c1f`；它与社区 v0.23 维护分支不是同一提交。下表三个分支均按知识库固定 commit 阅读，main 配套 vLLM 提交来自该快照的 `.github/vllm-main-verified.commit`。

执行侧固定为 `vllm-ascend@db701c1f`，控制流为 `vllm@0fc695fc`，与发布分支的对应见[来源基线](../sources/glm-5-3-flash-baseline.md)。执行快照尚无 LoRA（模型的低秩适配模块）优先分支；“无 LoRA”是与 v0.26/main 比较时的共同前提，那两版的 LoRA + EP 会强制走 `ALLTOALL`。枚举中的 `ALLTOALL`（按路由交换）与 `FUSED_MC2`（融合专家计算与通信）由其他设备或配置分支选择。

| 分支 | vllm-ascend commit | vLLM commit |
| --- | --- | --- |
| v0.23 | `2c59ff10` | `0fc695fc` |
| v0.26 | `2ed6cbba` | `568afb3a` |
| main | `baa023ad` | `84030bbe` |

| 项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| EP 与默认值 | 支持；`enable_expert_parallel=False`，`enable_eplb=False`，放置 `linear` | 相同 | 相同 |
| 普通 A2 的选择 | 每卡 ≤24、EP ≥16、token 在容量内 → MC2，否则 AllGather | 同一主判据；另有总专家数 >512 时直接 AllGather | 硬件策略表选容量与专家密度判据；选择器没有 >512 这一条 |
| 容量开关 | `enable_prefill_mc2=False` | 默认仍为 `False`，容量函数还兼顾其他融合路径 | 默认仍为 `False`；普通 MC2 与融合路径分别选择每 rank 上限，MegaMoE 分支还区分节点角色 |
| LoRA + EP | 没有优先覆盖分支，继续按设备选 | 优先强制 `ALLTOALL` | 同 v0.26 |
| GLM-5.3-Flash 专用实现 | 该维护快照无 `glm5_next` 模型文件 | 该发布快照也无此文件 | 模型在 `models/glm5next/` 目录 |

三版都要显式开 EP，且 EP 不会自动开启 EPLB。本部署 288 专家、18/卡，三版的普通 A2 选择结果一致；128 来自固定配置，升级后应重新核算容量。v0.26/main 加上 LoRA 后会离开本页的 MC2／AllGather 二选一前提。

本页 GLM 的形状与调用次序来自专用镜像；发布分支的模型入口状态见表末行。main 的硬件策略名为 `CAPACITY_AND_EXPERT_DENSITY`，容量函数按普通 MC2、融合算子和 MegaMoE 分别限幅；本配置仍取最大 capture size，再按 TP8 对齐。[C38]

普通选择条件分别见 v0.23 [C20]、v0.26 [C21]、main [C23]；LoRA 优先分支见 [C22] 与 [C24]。main 的 A2 硬件策略映射、三版参数默认值及容量开关也列入下方来源列表。`verified` 表示这些 EP 差异已逐项核对，GLM 专用镜像的模型执行账不扩展成发布分支的运行验证。

### 源码位置

按“谁持有权重 → 谁选通信 → 谁搬激活 → 谁归约”读，能把本页机制对回实际实现。

**检索名称。** Expert Parallelism 也叫专家切分。源码中 `FusedMoEParallelConfig` 的 `ep_size` 表示 EP 规模，`determine_expert_map` 建立专家到卡的映射；`select_moe_comm_method` 选择 `MoECommType`，其中 `ALLGATHER` 对应本文的 AllGather 路径，`MC2` 对应本文的 MC2 通信。`PrepareAndFinalizeWithMC2` 负责 MC2 的准备与收尾；token dispatch 和 combine 分别是派发与回收。开关 `enable_expert_parallel` / `--enable-expert-parallel` 见「怎么开」，`ALLTOALL` 与 `FUSED_MC2` 的含义和适用分支见「版本差异」。

正文中的专家编号与组合权重分别是 `topk_ids [1,8]`、`topk_weights [1,8]`，router 的校正偏置是 `e_score_correction_bias`。MC2 的有效行由 `mc2_mask` 标记；dispatch 返回的 `group_list` 记录各专家的行数。Python 优先调用 `npu_moe_distribute_dispatch_v2`，环境没有 v2 接口时调用旧接口；combine 对应 `npu_moe_distribute_combine_v2`（或旧接口）。AllGather 本地筛选使用 `active_expert_range`。

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 上游 FusedMoE 并行配置与专家映射 | `vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1074-L1209`；`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/expert_map_manager.py#L25-L130` |
| GLM 的 router、共享 MLP、专家范围 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1539` |
| 实际昇腾 FusedMoE 分支 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L294`：配 vLLM 0.23.0 时导入旧接口适配；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L435-L557` 是 prepare → apply → finalize |
| 每步选通信、有效行 mask 与容量 | `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L96-L101`；`vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L164-L252` |
| MC2 分 token 与拼回；AllGather 跨 DP 收集与归约 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L193-L314`；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L440-L560` |
| MC2 的 HCCL 通信组、dispatch/combine 调用和恢复元数据 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L102-L339`；AllGather 的本地筛选和还原在 `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L342-L438` |
| W8A8 权重、选专家、专家矩阵乘与通信量化类型 | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L188-L289`；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L292-L309`；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215`；`vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_stage_params.py#L92-L119` |
| 共享输出相加与最终归约 | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L719`；`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L650-L680`；`vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L159-L167` |
| 上游 EP 默认开关与昇腾 EPLB 配置、错误检查 | `vllm@0fc695fc:vllm/config/parallel.py#L154-L178`；`vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L817-L875` |
| 共享 MLP 的 TP 条件 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653`；矩阵推导见上文 tensor-parallel 链接 |

**正文证据索引。** 模型的 288 选 8、共享专家与层数见 [S1]；连续专家范围见 [C4]。R1 的补位、切片与 mask 见 [C8]；EP/MC2 组覆盖范围见 [C33]，派发、恢复元数据与回收见 [C10]；共享输出与归约顺序见 [C14]。A2 的通信选择见 [C7]；AllGather 的收集、归约见 [C9]，本地筛选和还原见 [C11]。

正文算式各自采用以下推导口径：

- 一个 token 的输出按 8 个专家的组合权重相加，再加共享贡献。[D]
- 两档通信载荷按张量形状、精度与主干 42 层的调用次数累计；31.5 MiB 与 4.15 GiB 分别取其中 EP、DP 交换部分。[D]
- 理想均分把 token–expert 对数平摊到专家与持有卡；真实路由分布决定实际 N_r。[D]

**待核：缺部署权重的 `quant_model_description.json`**，用来逐层核对 W8A8 配方；精度假设及其影响见[模型权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。

MC2 的 Python 实现给出了传入张量、HCCL 组与 torch_npu 接口。**待核：缺以下运行材料**，用于把逻辑载荷账落到实际显存、流量与延迟：

- 运行实例的版本、配置转储与环境变量：核对实际 EP、EPLB 及通信优化状态。
- 逐层、逐专家路由与算子 trace：记录各卡 `N_r` 的最大值与平均值、缓冲形状、峰值显存、各阶段耗时与等待时间。
- HCCL/网卡 trace，以及 CANN 内部实现或对应实测：核对分包、同目的卡专家副本合并、机内与机间实际流量。
