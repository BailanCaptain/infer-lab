---
id: collective-communication
title: "通信基础：rank 之间怎样交换和归约张量"
type: concept
summary: 集合通信规定一组参与者怎样交换数据，以及结束后每张卡持有什么。统一定义 All-Reduce、All-Gather、Reduce-Scatter、All-to-All 与 Broadcast，区分逻辑载荷和传输量，再沿 GLM 双机解释 HCCL 与 MC2。
aliases: [集合通信, Collective Communication, All-Gather, All-Reduce, Reduce-Scatter, All-to-All, Broadcast, 全归约, 全收集, 归约分散, 全互换, 广播, Send, Recv, rank, 通信组]
chapters: ["12"]
sources:
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/850/commlib/hcclug/hcclug_000009.html
  - https://docs.pytorch.org/docs/2.14/distributed.html
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L607-L681
  - vllm@0fc695fc:vllm/distributed/device_communicators/base_device_communicator.py#L180-L248
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875
  - vllm-ascend@db701c1f:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L68
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/comm_utils.py#L26-L60
  - vllm-ascend@db701c1f:vllm_ascend/distributed/device_communicators/pyhccl.py#L98-L171
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L252
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L193-L227
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L440-L469
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L543-L560
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L150-L339
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_comm_method.py#L122-L172
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L239-L252
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L324-L497
  - vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L296-L425
  - vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L256-L269
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L165-L165
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L177-L177
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L460-L460
  - https://www.hiascend.com/document/detail/zh/canncommercial/82RC1/opdevg/ascendcbestP/atlas_ascendc_best_practices_10_0043.html
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L926-L1013
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L663-L719
  - vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L157-L167
  - vllm@0fc695fc:vllm/config/parallel.py#L683-L707
verified: []
evidence: "C"
relations:
  - { to: one-request, kind: builds-on, note: A4 的逐层通信次数和 R1 字节账统一引用请求主线 }
  - { to: matmul-and-weights, kind: builds-on, note: 分清独立输出分片与部分和是选择通信操作的前提 }
  - { to: hardware-devices, kind: builds-on, note: 通信组的逻辑参与者运行在具体设备上 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 两张卡交换以后，各自手里多了什么？

**集合通信是一组参与者共同完成的数据操作：它规定各自拿出什么，以及交换、拼接或求和后，各自得到什么。** rank 是参与者的编号，通常对应一个进程；通信组规定哪些 rank 一起参与。下图每个进程用一张卡，a、b、c、d 代表向量里的元素，箭头表示输入怎样成为输出。

```wiki-diagram
file: collective-communication
```

每一行都是从左侧重新开始的一次独立操作。**All-Gather 收齐分片，All-Reduce 合齐数值，Reduce-Scatter 合齐数值后各留一片，All-to-All 按目的卡交换分片，Broadcast 复制指定来源。** 下文逐项定义；归约示意均使用 SUM，也就是对应位置求和。输出归属不等于把发送方的输入删掉，输入缓冲是否复用由接口决定。

## 为什么算完还要等其他卡？

当一张卡只拿到结果的一部分时：缺了别人的分片，要收集；形状齐了但数值只是部分和，要归约；下一个计算在另一张卡上，要把输入送过去。下一步要用的数据尚未就绪时，计算就得等待通信。

在我们的 GLM 双机部署中，主干一次前向有 **218 个通信调用边界**。普通稠密层在 attention（读取历史信息）的输出投影后、MLP（逐位置前馈变换）的降维后各合齐一次；MoE 是用多个专家网络提供前馈输出的层，还要为专家分发、返回和合并安排通信。小请求也要经过这些交接点，数据未就绪就得等待。完整次数账见[一条请求的通信汇总](one-request.md#一次前向的通信账)。一次调用的传输轮数由算法决定，218 不是网络包数，也不表示每次都执行全局屏障。

[TP](tensor-parallel.md) 分同一层的矩阵，[EP](expert-parallel.md) 分完整专家，[DP](data-parallel.md) 分请求或批次；它们决定谁负责计算。集合通信决定计算中间怎样交接数据。推理 DP 没有训练时的梯度同步，但本部署仍需跨组交换专家输入和运行状态。

## 五种操作各让每张卡得到什么？

以下固定 **N 张卡，每张卡的输入张量为 M 字节**；Broadcast 的 M 专指根卡提供的数据大小，其他卡只准备同样大的接收空间。均分的操作要求相应维度可整除 N，数据类型一致。先逐个看五种操作的输入和输出，再到[下一节](#通信量里的-n-和-m-到底数什么)把它们的通信量放进同一张表比较。

### All-Reduce

**All-Reduce 把所有卡的同位置元素按指定运算归约，并让每张卡都得到完整结果。** 归约是把多份值组合成一份值，除了 SUM，还可使用接口支持的 MAX、MIN 等运算。

通信前卡 0 有 [a,b]，卡 1 有 [c,d]；SUM 之后两卡都有 [a+c,b+d]。每卡输入和输出都是 M 字节，元素个数没有增加。它适合矩阵分片产生的部分和：各卡先算自己的贡献，再合成同一份结果。

在 ring 模型（每卡只向相邻卡逐轮传块）中，把 M 分成 N 块，先用 N−1 轮完成分块归约，再用 N−1 轮收齐各块；每轮发送 M/N，所以每卡发送约 2(N−1)M/N。公式中的二来自两阶段，不是收发相加。GLM 的单次输入载荷见后文[从嵌入到逐层投影](#从嵌入到逐层投影)。

### All-Gather

**All-Gather 把每张卡提供的分片按组内 rank 顺序收齐，使每张卡都得到所有分片。** 拼接不改变元素数值，即使各片内容碰巧相同，也会按各自 rank 保留。

通信前卡 0 有 [a,b]，卡 1 有 [c,d]；结束后两卡都有 [a,b,c,d]。每卡贡献 M（这里的 M 是每卡分片），最终得到 NM，其中新增的远端数据为 (N−1)M。ring 每轮转发一块，N−1 轮后每卡发送、接收各 (N−1)M。

拼接可沿 token（分词后的一个位置）行、通道或词表维进行，必须说明是哪一维；它不等于把数值相加。GLM 在 MoE 收尾收集不同 token 行，在词表输出收集不同词的分数，见[专家返回与词表输出](#专家返回与词表输出)。

### Reduce-Scatter

**Reduce-Scatter 对所有卡的同位置元素归约，再按约定分片，让每张卡只得到归约结果中属于自己的那一片。** “先归约、后分片”描述逻辑结果；实现可以边传边归约，不需要先在每卡生成完整结果。

通信前卡 0 有 [a,b]，卡 1 有 [c,d]；结束后卡 0 有 [a+c]，卡 1 有 [b+d]。每卡输入 M（这里的 M 是完整张量），输出 M/N。ring 共 N−1 轮，每轮发送 M/N，因此每卡发送约 (N−1)M/N。只在本卡把 [a,b] 切开，既没有远端贡献，也没有完成 Reduce-Scatter。

它适合“先合齐数值，下一步仍按片计算”的布局。GLM 的大批输入在两张跨机对应卡之间用它交回各执行组的 token 行，具体字节见[大批输入](#大批输入为什么改用-reduce-scatter)；后文的小请求路径不单独调用这一步。

### All-to-All

**All-to-All 让每张卡把输入按目的 rank 分块，分别送给对应的卡；每张卡接收所有来源发给自己的块。** 每个块只有一个目的地，操作本身不做求和。

通信前卡 0 有 [a,b]，卡 1 有 [c,d]，各自第一项给卡 0、第二项给卡 1；结束后卡 0 有 [a,c]，卡 1 有 [b,d]。等分时每卡把 M 切成 N 份，其中 M/N 留本地，其余 (N−1)M/N 发出，最后仍持有 M 字节。

专家路由常用不等长的 **All-to-AllV**：每对来源和目的地约定不同长度。此时卡 i 的发送量是发给其他卡的各块之和，输出大小由收到多少决定，不能套用等分公式。MoE 还会在通信前把一个 token 复制给多个被选专家；复制因子属于路由，不是 All-to-All 自带的行为。固定 A2 部署用 **MC2（一类计算与通信协同实现）**完成这类定向派发和返回，具体见 [MC2](#mc2)。

### Broadcast

**Broadcast 把指定根 rank 的一份数据复制给通信组的所有成员；其他成员原来的内容不参与组合。** 根是本次操作指定的来源，不必是全局 rank 0。

通信前根卡 0 有 [a,b]，卡 1 有接收空间；结束后两卡都有 [a,b]。根的数据大小为 M，N−1 张非根卡各收到 M，全组有效传输约 (N−1)M。各卡必须就根、长度和类型达成一致。

启动时用于通信器握手的广播、CPU 上把执行计划交给 worker 的消息广播，与设备张量的 HCCL Broadcast 要分开记账。本文固定部署的逐层通信清单没有独立的设备 Broadcast 项；启动元数据的单次字节数也未在底稿给出，见页末待核，不能填成一个假定的隐藏向量大小。

## 通信量里的 N 和 M 到底数什么？

先区分三本账。**逻辑载荷**是传给操作的张量或分片大小；**每卡发送量**是算法执行中这张卡送出去的有效数据；**全组传输量**把所有卡的发送量相加，每次发送只计一次，不再把接收重复加进去。表中按均衡 ring（每卡向相邻卡逐轮传块）、直接交换或无重复转发的树形广播估算，忽略协议头、对齐、重传和物理链路跳数。它们是解释成本的模型，实际 HCCL（昇腾集合通信库）的算法可不同。

| 操作 | 每卡输入 → 输出 | 每卡发送量 | 全组传输量 | 按完整张量 S 换算 |
|---|---|---|---|---|
| All-Reduce | M → M | 2(N−1)M/N，ring | 2(N−1)M | S=M，每卡发 2(N−1)S/N |
| All-Gather | M → NM | (N−1)M，ring | N(N−1)M | S=NM，每卡发 (N−1)S/N |
| Reduce-Scatter | M → M/N | (N−1)M/N，ring | (N−1)M | S=M，每卡发 (N−1)S/N |
| All-to-All | M → M，等分交换 | (N−1)M/N，直接交换 | (N−1)M | S=M，每卡发 (N−1)S/N |
| Broadcast | 根 M → 每卡 M | 依树位置不同；全组平均 (N−1)M/N | (N−1)M | S=M，同左 |

**除最后一列外，表中的 M 一律按每卡输入计**，与后文 GLM 各处的载荷同一口径。所以 All-Gather 的 M 是每卡分片的大小，Reduce-Scatter 的 M 是完整张量的大小；直接横比这两行，会误以为收集比分片归约贵 N 倍。外部资料常按完整张量 S 计：All-Gather 的 S 是收齐后的输出 NM，其余四种的 S 就是每卡输入 M。换成 S 后，All-Gather、Reduce-Scatter 和等分 All-to-All 的每卡发送量都是 (N−1)S/N，All-Reduce 正好是前两者之和。

前四行在上述均衡模型下，每卡接收量等于发送量；若问“发送加接收”，还要乘二。Broadcast 则是每个非根卡接收 M：根直接逐个发送时根发 (N−1)M，其余卡不转发；树形实现由中间卡转发，不能把全组平均值当成根的发送量。N=1 时都无需跨卡传输。

## 归约和收集怎样组合，根操作又差在哪里？

若各卡有同形状部分和 Yᵢ，完整结果为 Y=ΣYᵢ。**Reduce-Scatter 后接 All-Gather**，在相同分片规则和理想算术下，与一次 All-Reduce 的逻辑结果相同：先各留 Y 的一片，再每卡收齐 Y。这里第二步每卡输入已经是 M/N，因此两步每卡发送量相加为 2(N−1)M/N。浮点加法次序可能改变末位数值，逻辑等价不保证逐位相同。

如果后续计算只用本片，就可推迟 All-Gather，减少中间完整张量的驻留；这也是理解[序列并行](sequence-parallel.md)的基础。All-Gather 之后本地求和也能得到归约数值，但会先复制全部输入，成本不同，不能混淆两种操作的定义。

序列并行分 token 的中间表示，[上下文并行](context-parallel.md)分历史位置及其相关计算；两者都要先确认下一阶段需要完整表示、哪些历史数据或哪些局部注意力结果，才能选择收集与归约的位置。

| 操作 | 谁提供输入 | 谁拿到结果 | 两卡对照 |
|---|---|---|---|
| Gather | 每卡一片 | 只有根得到全部片段 | 根得到 [a,b,c,d] |
| Scatter | 根提供全部片段 | 每卡得到指定的一片 | 根给卡 0 [a,b]，给卡 1 [c,d] |
| Reduce | 每卡一份同形状输入 | 只有根得到归约结果 | SUM 的根得到 [a+c,b+d] |
| Send/Recv | 指定发送者 | 指定接收者 | 卡 0 发 [a,b]，卡 1 收 [a,b] |

前三种仍是组内集合操作；Send/Recv 是点对点交接，其他成员不必参与这一条消息。[流水线并行](pipeline-parallel.md)可用点对点通信连接层段；真实接口还支持交接元数据、多个张量及可选的组内重组。设备、进程和 rank 也不是同义词：同一进程可以加入多个通信组，组内 rank 与全局 rank 要分别确认。

## 放到 GLM 双机：一个 token 会在哪里通信？

**A0 启动时建立通信组，A4 前向时反复使用这些组。** [双机部署的 16 卡分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)给出具体成员：两套机内 TP8 分别合算本机矩阵；八个跨机 DP2 组连接对应卡；EP16 覆盖全部卡以共享完整专家集合。HCCL 是昇腾的集合通信库，HCCS 是机内高速互联；通信库与物理链路分属两层。CPU 状态同步还会用 Gloo 这一 CPU 通信后端，不能全算作 HCCL 流量。

CPU 的 DP 状态同步拿出“是否还有工作、是否请求暂停”两个 32 位整数，输入载荷共 **8 B**，做一次 SUM All-Reduce 后各参与者获得两项计数，再据此判断是否继续运行。这是小型控制消息；下文的设备张量和 218 次主干通信账不包含它。

下面跟[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)走过[A4 第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。R1 的提示词有 4 个 token；prefill 是首次一起处理提示词，decode 是利用已有历史继续生成。首次 prefill 处理这 4 行，decode 的主模型验证一步也处理 4 行，其中含 MTP 提出的 3 个候选：MTP 是模型自带草稿层先猜后续 token，再交给主模型验证的机制。hidden 是每个位置的隐藏向量，宽 4096；BF16 每元素 2 字节，FP32 每元素 4 字节，INT8 每元素 1 字节。

### 从嵌入到逐层投影

**词嵌入和投影的部分和都通过 TP8 All-Reduce 合齐。** 嵌入查表时，各卡只保留属于本卡词表段的结果，其余位置填零；归约后所有卡都拿到完整 hidden。attention（读取历史信息）的输出投影、稠密 MLP（逐位置前馈变换）的降维投影，则各自产生对完整 hidden 的部分贡献。

R1 的归约前后，每卡都是 [4,4096]，两维分别是 token 行数和隐藏宽度；不同的是数值从部分和变成完整值。单次输入载荷 **32,768 B**，主干共 **91 次**：嵌入 1 次、attention 45 次、稠密 MLP 3 次、共享专家 42 次。逐站推导与次数统一见[请求主线](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)，本页只将载荷代入前面的通信模型。

```calc
title: 一次 TP8 All-Reduce 的 ring 有效传输估算
每卡发送 = 2 × (8 − 1) ÷ 8 × 32,768 B = 57,344 B
每卡接收 = 57,344 B
全组发送 = 8 × 57,344 B = 458,752 B
> 输入载荷为 32,768 B；估算不代表本部署实际选择了 ring 算法
```

### 专家返回与词表输出

**All-Gather 收齐的是不同片段，不再对这些片段求和。** MoE 是由多个专家网络提供前馈输出的层；R1 进入路由分支前，4 行补齐到 8 行并按 TP8 分开，每卡留 [1,4096]，其中补位由有效行标记区分。专家结果回来后，每卡已经合齐自己所负责行的专家贡献。

MoE finalize 用一次 TP8 All-Gather：每卡贡献 **8,192 B**，收齐后先得到 [8,4096]，再去掉补位，恢复 [4,4096]。主干 42 个 MoE 层各做一次。这一操作的 ring 模型每卡发送量是 7 份本卡切片，不能把“贡献 8,192 B”写成线上总共只发送 8,192 B。

走到词表输出，lm_head 为每个候选词打分：每卡先持有 [n,19360]，TP8 All-Gather 后每卡持有 [n,154880]。这里 n 是需要输出分数的位置数。R1 prefill 只取最后位置，n=1、每卡贡献 **38,720 B**；decode 主干验证要 4 行，n=4、每卡贡献 **154,880 B**。它沿词表维拼接，MoE 则沿 token 维拼接。算式见[请求主线的词表投影](one-request.md#最终归一化与词表投影)。

### MC2

**MC2 是昇腾的一类计算与通信协同实现，不是第六种集合通信语义。** 普通集合通信定义数据如何从输入变成输出；MC2 可以把分块计算与通信安排成相互重叠的流水，让已经就绪的块先传或先算。它仍需要通信组、数据传输和同步条件。

在本页的 MoE 路径里，**dispatch** 按选中的专家把输入派发给持有卡，**combine** 把专家结果送回源 token 所在卡并按路由权重组合。这在数据流上属于按目的地交换，但还涉及量化、重排、路由权重和有效行标记，不能把一次 MC2 调用直接替换成一次等长 All-to-All，也不能假定它内部必然调用 HcclAlltoAll。

R1 中每个有效 token 选 8 个专家。按源 token 归属记账，一次 dispatch 的单专家副本是 **4,100 B**，8 份合计至多 **32,800 B**；combine 的单专家结果是 **8,192 B**，8 份返回至多 **65,536 B**。42 层各有一轮 dispatch 和 combine。这些是有效行的逻辑副本上界：本地命中无需跨卡，补位不贡献真实 token，专家热门程度还会改变目的卡接收量。单卡持有一行并不意味着所有卡都持有一行真实请求。推导与形状见[请求主线的 MoE 小节](one-request.md#42-层-moe每卡-18-个专家)。

本部署的 A2、EP16、每卡 18 个专家条件下，两组最大执行宽度在 **128** 容量内选 MC2，超出则选 **AllGather 路径**。AllGather 是整条 MoE 实现路线的名字，All-Gather 是前面定义的单个集合操作；两条路线都会用到 All-Gather。容量推导见[请求主线](one-request.md#42-层-moe每卡-18-个专家)，两组共用选择见[并发请求的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。满足这些条件的短 prefill 也走 MC2，不能只凭 prefill/decode 标签判定。

下面沿 A0 到 A4 画出执行分支。MC2 中专家计算仍在 dispatch 与 combine 之间调用；通算协同不代表整层只有一个融合 kernel（设备上执行的计算程序）。图中的“本地专家”指本卡持有的那些专家。

```wiki-diagram
file: collective-communication-flow
```

两路最后都交回本组完整 hidden。MC2 已合齐路由贡献，所以共享专家单独归约；AllGather 路径先通过 DP2 Reduce-Scatter 合并一对卡的路由贡献，再把它与共享专家部分和一起在 TP8 中归约。两路每个 MoE 层均有四个通信调用边界，attention 的一次另计。

## 大批输入为什么改用 Reduce-Scatter？

**AllGather 路径先让各卡看到两组输入，再把专家贡献合齐并交回 token 所属组。** [场景 M](concurrent-requests.md#示例场景-m-与变体-m)是 DP0 的 12 条 decode 加一条 6000-token prefill，DP1 有 7 条 decode；两边该步的执行宽度都对齐为 6048，进入 AllGather 路径。补齐推导留在并发页，以下引用[EP 页的整批账](expert-parallel.md#场景-m多请求时的整批账和负载不均)。

| 每个 MoE 层的顺序 | 通信前 → 通信后，每卡 | 单次载荷的明确口径 |
|---|---|---|
| DP2 All-Gather hidden | [6048,4096] → [12096,4096] BF16 | 每卡贡献且接收远端 **49,545,216 B** |
| DP2 All-Gather 路由分数 | [6048,288] → [12096,288] FP32 | 每卡贡献且接收远端 **6,967,296 B** |
| 本地专家算完后 DP2 Reduce-Scatter | [12096,4096] → [6048,4096] BF16 | 每卡输入 **99,090,432 B**；输出 **49,545,216 B** |
| 加共享贡献后 TP8 All-Reduce | [6048,4096] → [6048,4096] BF16 | 每卡输入 **49,545,216 B** |

两张 DP 对应卡都曾计算全部 12096 行中路由到本地专家的工作，因此 Reduce-Scatter 的输入是同形状的部分和。归约后卡 0 留 DP0 的行、卡 1 留 DP1 的行；再通过机内 TP8 合齐全部专家贡献。对照通用公式，此处 N=2、M 是 **99,090,432 B 的输入**，发送量约为一半；底稿把 **47.25 MiB** 记作输出切片载荷，读公式时必须换回输入口径。

四步在主干 42 个 MoE 层中重复。整步的 6.09 GiB 是混合口径的逻辑载荷汇总，详细账见 EP 页；机间网卡实际流量还要按算法和物理链路统计，不能仅乘卡数得出。

## 常见误解

- **“All-Gather 就是求和。”** 它保留各来源元素并拼接；All-Reduce 才按指定运算合齐同位置数值。
- **“Reduce-Scatter 就是本地切片。”** 输出每一片都包含所有参与者在该位置的贡献。
- **“All-to-All 给每个人一份完整输入。”** 每个目的地拿到的是给自己的块。
- **“MC2 取代了 HCCL 和所有集合通信。”** 它改变通算组织方式；本部署 MC2 路径仍有 TP All-Gather 和 All-Reduce。
- **“异步返回就能读输出。”** 异步提交只允许主机继续工作，消费输出前仍需满足通信完成和设备流依赖。
- **“所有通信都跨机，或者所有 DP 组互不通信。”** TP8 在机内；DP2 与 EP16 跨机。没有梯度同步不代表没有状态和专家通信。
- **“R1 的 ≤7.3 MiB 就是每卡网卡收发量。”** 该主干账混合归约输入、收集贡献切片和专家副本上界；decode 与 prefill 的词表行数也不同。它不含第 5 站的三遍 MTP 草拟通信，更不能推出实测时延。

## 对照源码

### 怎么开

集合操作没有统一的“开启通信”开关；模型切分和代码路径决定在哪里调用。固定部署的 TP8、DP2、EP16 与版本前提统一见[部署页](glm-5-3-flash-two-node.md#部署前提)。同一进程可在 TP、DP、EP 的不同组中分别调用通信，核对日志时先确认通信组再看 rank。

在昇腾文档里，五种操作名称通常去掉连字符；HCCL 的 C API 名与 Python 封装名大小写也不同：

| 本页术语 | HCCL 操作 / C API | 固定代码中的入口及含义 |
|---|---|---|
| All-Reduce | AllReduce / `HcclAllReduce` | 组 `all_reduce` → 设备通信器 → `dist.all_reduce`，归约部分和 |
| All-Gather | AllGather / `HcclAllGather` | 组 `all_gather` → `dist.all_gather_into_tensor`；MC2 finalize 使用 `dist.all_gather` |
| Reduce-Scatter | ReduceScatter / `HcclReduceScatter` | 组 `reduce_scatter` → `dist.reduce_scatter_tensor`，输出按维度均分 |
| All-to-All | AlltoAll / `HcclAlltoAll`；变长对应 `HcclAlltoAllV` | `NPUCommunicator.all_to_all` 与 `async_all_to_all` 分别用列表或 split sizes 交接；固定 A2 MoE 不选普通 ALLTOALL 分支 |
| Broadcast | Broadcast / `HcclBroadcast` | 张量 `dist.broadcast`；独立 `PyHcclCommunicator.broadcast` 也有直接包装 |

普通设备路径由 torch.distributed 经 torch_npu 的 HCCL 后端承接。固定代码中 NPUCommunicator 继承上游设备通信器；**存在 PyHcclCommunicator 不等于主干全部经过这个类**，初始化处还保留未整合到 NPUCommunicator 的说明。上表对照 API 语义，不承诺一次上层调用与一次底层 C API 一一对应。

MC2 的可追踪边界是 `MoECommType.MC2` → `token_dispatch` → `npu_moe_distribute_dispatch_v2` → 专家矩阵计算 → `npu_moe_distribute_combine_v2` → finalize。固定 A2 选择器依据卡数、专家数与容量选择 MC2/ALLGATHER；不应用其他设备的 ALLTOALL 分支解释它。融合矩阵乘与 All-Reduce 等其他 MC2 用法也不改变 All-Reduce 的输入输出语义。

### 会报什么错

同组参与者必须按兼容顺序调用操作，并满足形状、类型、根和分片计数约定；否则可能报错、超时或互相等待。All-to-AllV 要逐对匹配发送与接收计数，不能只核全组字节总和。组通信器缺失会抛出 `No device communicator found`；Reduce-Scatter 检查切分维长度能否整除组大小。异步接口的返回值和事件负责建立数据就绪条件，不能绕过等待直接消费结果。

### 开销和什么时候别开

先按输入输出关系选操作，再按模型布局评估是否值得通信。后续只用本片时，立即 All-Gather 会增加复制和显存；只有根需要结果时，全员都拿完整结果也会增加代价。下一算子需要完整数据时，则必须完成必要归约。

ring 公式只是有效传输模型；延迟还受启动次数、拓扑、拥塞、同步和计算重叠影响。MC2 收益依赖通信与计算能否重叠，不应从调用次数或字节上界直接推出加速比。HCCL 缓冲容量是资源预留，也不是每轮实际传输量，见 [HCCL 缓冲页](gap-a5164fe10fa9184412f8.md)。

### 版本差异

五个集合通信名定义的是输入输出关系，不随 vLLM 版本重新定义，也没有“默认开/关”值；具体后端和 MoE 分支才随版本变化。以下核对社区钉点及固定执行钉点，不把社区 main 当成固定镜像。

| 项目 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad | 对本页的影响 |
|---|---|---|---|---|
| A2 普通 EP 容量分流 | 每卡专家≤24、EP≥16、token 在容量内选 MC2，否则 ALLGATHER | 相同主规则；多了总专家数>512 回退和 token 数未知的处理 | 硬件策略选择器执行同类规则，token 数可未知 | 本部署 288 专家、EP16、已知宽度时仍是两路选择 |
| `enable_prefill_mc2` | 默认 False | 默认 False | 默认 False | 128 来自固定配置与图档位，不是 MC2 通用上限 |
| 普通 All-to-All 与 MC2 | 独立的操作 / 实现路径 | 仍分开；LoRA+EP 可有额外 ALLTOALL 分支 | 同样需看硬件策略及额外条件 | 本部署未启用 LoRA，不能推广为所有 A2 配置永远没有 ALLTOALL |

固定执行钉点 `db701c1f` 的 A2 条件与表内 v0.23 主规则一致。此表只核分流条件与默认值，不宣称三版 GLM 算子布局、缓冲和性能完全一致，因此未把整页标记为三版全部 verified。

### 源码位置

- 五种操作、根操作、变长交换语义及 C API 名：HCCL 官方说明；同步、异步约定同时参照 PyTorch 文档。[S1][S2]
- 图中的 a、b、c、d 是任意元素，SUM 是解释归约的约定；图不模拟底层通信轮次。N、M 公式由均分和传输模型推导。[A][D]
- 上游组封装与设备通信器实现；DP/EP 通信域由并行状态初始化建立。[C3][C4][C5]
- 昇腾普通 All-to-All、变长异步 split sizes、PyHccl 握手广播和设备张量包装；后者存在不证明它是主干默认入口。[C6][C7][C8]
- 固定 A2 选择器、MC2 finalize 收集后去补位、AllGather 路径两次收集与 DP Reduce-Scatter，支撑流程图。[C9][C10][C11][C12]
- MC2 dispatch/combine 与其间的专家计算，支撑定向派发与等分 All-to-All 的区别；通算重叠原理参照昇腾 MC2 性能说明。[C13][C14][S22]
- 共享专家在路由分支收尾后执行、MC2 单独归约与 AllGather 合并后归约：共享专家实现和外层归约补丁。[C24][C25]
- “开销”小节所述重叠收益取决于计算与通信时长的匹配，依据 MC2 官方性能调优说明；不同于前述接口语义。[S22]
- 三版容量分流、main A2 硬件映射及 prefill MC2 默认值，支撑版本表；更完整比较见[EP 页](expert-parallel.md#版本差异)。[C15][C16][C17][C18][C19][C20][C21]
- 点对点张量字典与可选组内重组，说明流水线交接可组合多种通信。[C23]
- CPU DP 运行状态的两个 int32、SUM 归约及暂停共识判断，支撑 8 B 控制载荷的对照。[C26]

**待核：** 缺少固定镜像中 HCCL/CANN 实际算法选择与通信 trace，尚不能给出网卡收发实测、MC2 同目的卡副本合并策略或通信耗时；底稿未列启动 Broadcast 的具体调用清单、张量长度和后端，因此不提供其每次部署字节数。HCCL 文档用于接口语义，不代表已核实镜像安装的库版本。
