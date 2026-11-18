---
id: collective-communication
title: 通信基础：rank 之间怎样交换和归约张量
type: concept
origin: gap
summary: >-
  集合通信规定一组参与者怎样交换数据以及结束后每张卡持有什么：用 2 卡与 4 卡分格图演示八种通信操作与 ring All-Reduce，区分逻辑载荷与链路传输量、机内 HCCS/UB 与跨机 RoCE 带宽悬崖，再沿 GLM 双机解释 HCCL 与 MC2。
aliases:
  - 集合通信
  - Collective Communication
  - All-Gather
  - All-Reduce
  - Reduce-Scatter
  - All-to-All
  - Broadcast
  - 全归约
  - 全收集
  - 归约分散
  - 全互换
  - 广播
  - Send
  - Recv
  - rank
  - 通信组
  - Scatter
  - Gather
  - Reduce
  - ring All-Reduce
chapters:
  - '04'
sources:
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/850/commlib/hcclug/hcclug_000009.html
  - 'https://docs.pytorch.org/docs/2.14/distributed.html'
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/82RC1alpha001/opdevg/ascendcbestP/CANN%E7%A4%BE%E5%8C%BA%E7%89%88%208.2.RC1.alpha001%20Ascend%20C%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5%2001.pdf
  - >-
    https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2
  - 'vllm@ced6857a:vllm/distributed/parallel_state.py#L721-L805'
  - >-
    vllm@ced6857a:vllm/distributed/device_communicators/base_device_communicator.py#L231-L365
  - 'vllm@ced6857a:vllm/distributed/parallel_state.py#L1067-L1346'
  - 'vllm@ced6857a:vllm/config/parallel.py#L770-L815'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L62
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/device_communicators/pyhccl.py#L105-L185
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/moe_utils.py#L63-L100'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_distributed.py#L39-L175'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1241-L1289'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L194-L343'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L297-L425'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L574-L606'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L239-L360'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L165-L179'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/device_communicators/npu_communicator.py#L23-L68
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L324-L515'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L177-L206'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/device_communicators/npu_communicator.py#L26-L86
  - 'vllm@568afb3a:vllm/distributed/parallel_state.py#L641-L725'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/device_communicators/npu_communicator.py#L46-L90
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_forward_context.py#L340-L470'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L666-L788'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L248-L455'
  - 'vllm@ba15685a:vllm/config/parallel.py#L951-L996'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L607-L681'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L926-L1013'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L683-L707'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L80-L252'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L193-L373'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L440-L560'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L102-L339'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_comm_method.py#L122-L172'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L559-L719'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L157-L167'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931'
  - >-
    raw:sha256-64347e263d97d468f772950b4cba293bf8e7d038833b130b1ace241fdf164bd3.md#L1-L1301
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 分清矩阵按列切产生的独立分片与按行切产生的部分和，是选择拼接还是归约的前提
  - to: hardware-devices
    kind: builds-on
    note: 承接逻辑 Device 与机内 HCCS/UB、跨机 RoCE 带宽边界，解释高频同步为何锁在机内通信域
contradicts: []
updated: '2026-11-18'
rawSources:
  - >-
    raw/sha256-0cf9c30845c054dfd27aba2a44b05dac82bc0225367eb1ff61d8f59c959eec1e.md
  - >-
    raw/sha256-64347e263d97d468f772950b4cba293bf8e7d038833b130b1ace241fdf164bd3.md
---

**集合通信是一组分布式参与者（`rank`）按共同约定交换张量的操作：它明确规定每张卡拿出什么数据，以及经过拼接、分发或逐元素归约后每张卡手里得到什么结果。**

## 两张卡交换以后，各自手里多了什么？

一张卡的显存和算力都有限。模型大到一张卡放不下，或者一张卡算得太慢，就把工作拆给几张卡一起做：[TP](tensor-parallel.md)（张量并行）把同一层的权重矩阵切开，每张卡只拿一片来算；[EP](expert-parallel.md)（专家并行）把 MoE 层里的多个专家网络分到不同卡上，MoE 层是由多个「专家」子网络组成的前馈层；[DP](data-parallel.md)（数据并行）让几组卡各自处理不同的请求。拆开以后，一张卡手里往往只有结果的一部分：要么缺了别的卡上的那几片，要么每个数只加了自己那一份。下一步计算开始前，必须先把它们拼回来或者加起来。

在这里，`rank` 是参与者的整数编号，通常对应一个工作进程，一个进程绑定一个逻辑 `Device`（见[昇腾四族硬件体系](hardware-devices.md)）；**通信组**规定哪些 `rank` 一起参与某类操作。设备、进程和 `rank` 并不是同义词：同一进程可以同时加入 TP、DP、EP 等多个通信组，组内 `rank` 与全局 `rank` 要分别确认。与集合通信相对的是**点对点通信**，只有指定的一个发送方和一个接收方参与，组内其他成员不必介入。

先看最小的例子（数为示意）。输入 `x = [1, 2]`，权重 `W` 有两行：第 1 行 `[1, 2]`，第 2 行 `[5, 10]`。[矩阵乘](matmul-and-weights.md) `x·W` 就是 `x` 的第 1 个数乘 `W` 的第 1 行，加上第 2 个数乘第 2 行：$x \cdot W = 1 \times [1, 2] + 2 \times [5, 10] = [11, 22]$。两张卡用 TP 合算时，把 `W` **按行**切开：

- 卡 0 拿第 1 行，只算 $1 \times [1, 2] = [1, 2]$；
- 卡 1 拿第 2 行，只算 $2 \times [5, 10] = [10, 20]$。

这两份都是**部分和**：形状已经和完整结果一样，但每个位置只加了自己那一行的贡献，两份按位置相加才是 `x·W = [11, 22]`。于是两张卡各把自己的两块发给对方，收到后加进同位置：

```wiki-diagram
file: collective-communication
```

交换后两张卡都是 `[11, 22]`，每个数都加进了两张卡的贡献。这就是后文的 All-Reduce。本页分格图沿用同一套画法：每张图分成「发之前 → 发 → 发之后」几格，从上往下看；**浅青色是发之前各卡原有的数，深青色是通信后得到的结果**；中间那格里每列是一张收数据的卡，块上方写着它来自哪张卡，**紫色箭头是经过通信送来的块，灰色虚线是本卡自己的块，不用发**；空白的格子只是占位，表示这张卡手里没有这一块。

如果把 `W` 改成**按列**切，情况就不一样：卡 0 拿第 1 列 `[1, 5]`，算出 $1 \times 1 + 2 \times 5 = 11$；卡 1 拿第 2 列 `[2, 10]`，算出 $1 \times 2 + 2 \times 10 = 22$。每张卡得到的已经是完整结果里的一个数，两份只要拼起来，不用相加，这对应后文的 All-Gather。切法决定了算完以后是「加」还是「拼」。

判断时还要看数据的含义，不能只看形状：即使两张卡拿着同形状的张量，它们也可能是同一结果的部分和，需要按位置相加；也可能分别对应完整结果的不同片段，需要保留各片段原来的数值再拼接。

交换有好几种约定，用三个问题就能分开：数据是一张卡拿出来，还是每张卡都拿出来；到了对方手里是原样放下（收集），还是按位置相加（归约）；结果只给一张卡，还是每张卡拿到同样的一整份，还是每张卡拿到各不相同的一份。后面八种操作正好各占一种组合，下一节开头给出对照表。归约示意均使用 `SUM`，也就是对应位置求和。输出归属不等于把发送方的输入删掉，输入缓冲是否原地复用由具体后端接口决定。

## 为什么算完还要等其他卡？

当一张卡只拿到结果的一部分时：缺了别人的分片，要收集；形状齐了但数值只是部分和，要归约；下一个计算在另一张卡上，要把输入送过去。下一步要用的数据尚未就绪时，计算就得等待通信。

真实部署里，一次前向要经过很多这样的交接点：普通稠密层在 attention（读取历史信息）的输出投影后、MLP（逐位置前馈变换）的降维后各合齐一次；MoE 是用多个专家网络提供前馈输出的层，还要为专家分发、返回和合并安排通信。哪怕单次只进来几个 token 的小请求，也要逐层穿过这些同步点；高频逐层同步的通信组必须锁在机内高速互联（`HCCS` 或 `Unified Bus`）内，低频交接才适合跨机走 `RoCE` 网络（物理链路规格详见[硬件带宽对照](hardware-devices.md#官方带宽规格能说明什么)与后文通信量标尺）。GLM 双机一次前向有多少个交接点，见[GLM 双机一节](#放到-glm-双机一个-token-会在哪里通信)。

[TP](tensor-parallel.md) 分同一层的矩阵，[EP](expert-parallel.md) 分完整专家，[DP](data-parallel.md) 分请求或批次；它们决定谁负责计算。集合通信决定计算中间怎样交接数据。推理 DP 没有训练时的梯度同步，但在跨组共享专家或协同调度时仍需跨组交换专家输入和运行状态。

## 八种操作各让每张卡得到什么？

下面固定用 **4 张卡**演示，每张卡的数据切成 4 块（数为示意）。要求和的操作里，卡 $k$ 的 4 块是 `[1, 2, 3, 4]` 乘以 $10^k$：卡 0 是 `[1, 2, 3, 4]`，卡 1 是 `[10, 20, 30, 40]`，卡 2 是 `[100, 200, 300, 400]`，卡 3 是 `[1000, 2000, 3000, 4000]`。每张卡的数落在不同的数位上，加完一看就知道加进了谁：`11` 是卡 0 加卡 1，`1111` 是四张卡都加齐了。图中四张卡从左到右排成一行：卡 0、卡 1、卡 2、卡 3。

说到通信量时，固定 **$N$ 张卡，每张卡的输入张量为 $M$ 字节**；Broadcast 的 $M$ 专指根卡提供的数据大小，其他卡只准备同样大的接收空间。均分的操作要求相应维度可整除 $N$，数据类型一致。每种操作先用一句话说它做什么，再看图，最后说推理里谁在用它；它们的通信量与链路映射放到[后面](#通信量里的-n-和-m-到底数什么)统一比较。

图里每一步都按「每张卡直接发给需要它的卡」来画，只表示谁的数据最后到了谁手里。通信库可以换成分几轮传的算法，结果不变；[ring 一节](#ring-all-reduce-每一步在传什么)演示最常见的一种。

按上一节的三个问题，八种操作各占一格：

| 操作 | 谁拿出数据 | 到了对方手里 | 结果给谁 |
| --- | --- | --- | --- |
| Broadcast | 一张根卡 | 原样放下 | 每张卡同样一整份 |
| Scatter | 一张根卡 | 原样放下 | 每张卡各不相同的一份 |
| Gather | 每张卡 | 原样放下 | 只给根卡 |
| All-Gather | 每张卡 | 原样放下 | 每张卡同样一整份 |
| Reduce | 每张卡 | 按位置相加 | 只给根卡 |
| Reduce-Scatter | 每张卡 | 按位置相加 | 每张卡各不相同的一份 |
| All-Reduce | 每张卡 | 按位置相加 | 每张卡同样一整份 |
| All-to-All | 每张卡 | 原样放下 | 每张卡各不相同的一份 |

只差一格的两种最容易混：Broadcast 和 Scatter 只差整份还是各一份；All-Gather 和 All-to-All 都不相加，差在每张卡收到的一样还是不一样；Reduce-Scatter 和 All-Reduce 都相加，差在每张卡留一片还是拿整份。

下面的交互图沿用这组数值。选择一种操作后，看上方保留的输入怎样到达下方接收位置；归约会先显示收到的数，再更新同位置的和。每条路线表示逻辑收发关系，逐条播放便于追踪，不规定通信库的真实包顺序。选择 Ring All-Reduce 可看四张卡每轮同时各发一块，依次完成三轮归约和三轮收集。

```wiki-scene
collective-communication
```

### Broadcast

**Broadcast 把指定根 `rank` 的一份数据复制给通信组的所有成员；其他成员原来的内容不参与组合。** 根是本次操作指定的来源，不必是全局 `rank 0`。

```wiki-diagram
file: collective-communication-broadcast
```

通信前只有根卡 0 有 `[1, 2, 3, 4]`，其余三张卡只有空的接收位置；通信后四张卡都有 `[1, 2, 3, 4]`。根的数据大小为 $M$，$N-1$ 张非根卡各收到 $M$，全组有效传输约 $(N-1)M$。各卡必须就根、长度和类型达成一致。

推理里，启动时用于通信器握手的广播、CPU 上把执行计划交给 worker（每张卡上执行模型的进程）的消息广播，要与设备张量的 HCCL Broadcast 分开记账；HCCL 是昇腾的集合通信库。后文固定双机部署的逐层通信清单没有独立的设备 Broadcast 项；启动元数据的单次字节数也未在底稿给出，见页末待核，不能填成一个假定的隐藏向量大小。

### Scatter

**Scatter 把根卡的数据切成 $N$ 块，第 $k$ 块发给卡 $k$，每张卡只拿到属于自己的那一块。** 它和 Broadcast 都从根卡发出，区别只在发整份，还是切开后各给一块。

```wiki-diagram
file: collective-communication-scatter
```

通信前根卡 0 有 `[1, 2, 3, 4]`；通信后卡 1 拿到 `2`，卡 2 拿到 `3`，卡 3 拿到 `4`，根卡自己留第 0 块的 `1`，另外三块是它发出去的输入，不算它的结果。直接发送时，根卡发出 $N-1$ 块、每块 $M/N$，这里的 $M$ 是根卡的整份数据；其余卡各收一块。后文 GLM 双机主干里出现的是 Reduce-Scatter，它的后半段就是 Scatter 这种「每人一块」。

### Gather

**Gather 是 Scatter 反过来：每张卡各提供一块，全部送到根卡，按组内 `rank` 顺序排好；只有根卡拿到全部。**

```wiki-diagram
file: collective-communication-gather
```

通信前卡 $k$ 手里只有第 $k$ 块：卡 0 是 `1`，卡 1 是 `2`，卡 2 是 `3`，卡 3 是 `4`；通信后根卡 0 收齐 `[1, 2, 3, 4]`，其余卡没有新增内容。直接发送时，每张非根卡发出自己那一块，根卡收下 $N-1$ 块。让每张卡都得到这个结果，就是下一节的 All-Gather。

### All-Gather

**All-Gather 把每张卡提供的分片按组内 `rank` 顺序收齐，使每张卡都得到所有分片。** 从结果看，它等于先 Gather 再 Broadcast。拼接不改变元素数值，即使各片内容碰巧相同，也会按各自 `rank` 保留。

```wiki-diagram
file: collective-communication-all-gather
```

通信前卡 $k$ 只有第 $k$ 块；通信后四张卡都有 `[1, 2, 3, 4]`，中间一格每块上方标着它来自哪张卡。每卡贡献 $M$（这里的 $M$ 是每卡分片），最终得到 $NM$，其中新增的远端数据为 $(N-1)M$。在 ring 模型（每卡只向相邻卡逐轮传块，见[后文](#ring-all-reduce-每一步在传什么)）中，每轮转发一块，$N-1$ 轮后每卡发送、接收各 $(N-1)M$。

拼接可沿 token（分词后的一个位置）行、通道或词表维进行，必须说明是哪一维；它不等于把数值相加。推理里，GLM 在 MoE 收尾收集不同 token 行，在词表输出收集不同词的分数，见[专家返回与词表输出](#专家返回与词表输出)；大批输入走的 AllGather 路径还在两台机器的对应卡之间收集输入，见[大批输入](#大批输入为什么改用-reduce-scatter)。

### Reduce

**Reduce 把所有卡的同位置元素按指定运算归约，结果只给根卡。** 归约是把多份值组合成一份值，除了 `SUM`，还可使用接口支持的 `MAX`、`MIN` 等运算。

```wiki-diagram
file: collective-communication-reduce
```

这 4 张卡的数可以看成 4 份部分和：像开头那样把一层权重按行切给 4 张卡，每张卡算出的都是同一个结果的一部分。通信前四张卡各有 4 块；三张卡把 4 块都发给根卡 0，根卡按位置相加，得到 `[1111, 2222, 3333, 4444]`，每块的个、十、百、千位都是 1，说明四张卡的数都加进来了。其余卡手里没有结果。直接发送时，根卡要收下其余 $N-1$ 张卡的整份输入。

Scatter、Gather、Reduce 都只有一张根卡发出或收下。推理中下一步往往每张卡都要接着算，所以后文 GLM 走读里出现的是后面几种：All-Gather、Reduce-Scatter、All-Reduce，以及按目的地交换的 All-to-All。前三种可以拆成「根操作 + 一次分发」来理解：All-Gather 的结果等于 Gather 后再 Broadcast，Reduce-Scatter 等于 Reduce 后再 Scatter，All-Reduce 等于 Reduce 后再 Broadcast。这里只说结果相同；下面的 ring 算法无需先集中到一张卡，实际通信库仍会按消息规模与拓扑选择实现。

### Reduce-Scatter

**Reduce-Scatter 对所有卡的同位置元素归约，再按约定分片，让每张卡只得到归约结果中属于自己的那一片。** 从结果看，它等于先 Reduce 再 Scatter；「先归约、后分片」描述逻辑结果，实现可以边传边归约，不需要先在每卡生成完整结果。

```wiki-diagram
file: collective-communication-reduce-scatter
```

第 $k$ 块从各卡发到卡 $k$ 相加，所以通信后卡 0 留 `1111`，卡 1 留 `2222`，卡 2 留 `3333`，卡 3 留 `4444`，四个数位都是 1，说明四张卡都加进来了；每张卡原来的另外三块只是发出去的输入，不算它的结果。每卡输入 $M$（这里的 $M$ 是完整张量），输出 $M/N$。ring 共 $N-1$ 轮，每轮发送 $M/N$，因此每卡发送约 $\frac{N-1}{N}M$。只在本卡把 `[1, 2, 3, 4]` 切开，既没有远端贡献，也没有完成 Reduce-Scatter。

它适合「先合齐数值，下一步仍按片计算」的布局。GLM 的大批输入在两张跨机对应卡之间用它交回各执行组的 token 行，具体字节见[大批输入](#大批输入为什么改用-reduce-scatter)；后文的小请求路径不单独调用这一步。

### All-Reduce

**All-Reduce 把所有卡的同位置元素按指定运算归约，并让每张卡都得到完整结果。** 从结果看，它等于 Reduce 后再 Broadcast，也等于 Reduce-Scatter 后再 All-Gather；下图按后一种拆成两步。

这里以 `SUM` 为例：各成员输入是同形状的部分和，且 Reduce-Scatter 与后续 All-Gather 使用一致的分片规则时，两步组合才得到与 `SUM` All-Reduce 相同的逻辑结果。浮点数加法的先后顺序可能不同，因此逻辑结果等价不保证计算结果逐位相同。

```wiki-diagram
file: collective-communication-all-reduce
```

第 1 步和 Reduce-Scatter 一样，卡 $k$ 得到第 $k$ 块的和；第 2 步和 All-Gather 一样，卡 $k$ 把这块和发给其余每张卡。结束后四张卡都是 `[1111, 2222, 3333, 4444]`。每卡输入和输出都是 $M$ 字节，元素个数没有增加。

它适合矩阵分片产生的部分和：各卡先算自己的贡献，再合成同一份结果。[TP](tensor-parallel.md) 把一层的一对矩阵先按列、再按行切给各卡后，每张卡得到形状完整、数值只算了一部分的结果，一次 All-Reduce 就把它们加齐，正是开头两张卡的例子；GLM 里的次数和字节见[从嵌入到逐层投影](#从嵌入到逐层投影)。CPU 上的 DP 状态同步也会用 All-Reduce，见[GLM 双机一节](#放到-glm-双机一个-token-会在哪里通信)。它在环上怎样一步步完成，见[下一节](#ring-all-reduce-每一步在传什么)。

### All-to-All

**All-to-All 让每张卡把输入按目的 `rank` 分块，分别送给对应的卡；每张卡接收所有来源发给自己的块。** 规则一句话：卡 $i$ 的第 $j$ 块发给卡 $j$，放进对方的第 $i$ 格。每个块只有一个目的地，操作本身不做求和。

```wiki-diagram
file: collective-communication-all-to-all
```

通信后卡 0 是 `[1, 10, 100, 1000]`，卡 1 是 `[2, 20, 200, 2000]`，卡 2 是 `[3, 30, 300, 3000]`，卡 3 是 `[4, 40, 400, 4000]`。把通信前四张卡的内容排成一张 $4 \times 4$ 的表，通信后正好行列互换。它和 All-Gather 的区别是：All-Gather 里每张卡收到的内容一样，All-to-All 里每张卡收到的是别人专门发给它的块。等分时每卡把 $M$ 切成 $N$ 份，其中 $M/N$ 留本地（图中卡 $k$ 的第 $k$ 块没动），其余 $\frac{N-1}{N}M$ 发出，最后仍持有 $M$ 字节。

推理里，[EP](expert-parallel.md) 把 token 送到持有被选专家的卡、算完再送回源卡，数据流就是这种按目的地交换。专家路由常用不等长的 **All-to-AllV**：每对来源和目的地约定不同长度。此时卡 $i$ 的发送量是发给其他卡的各块之和，输出大小由收到多少决定，不能套用等分公式。MoE 还会在通信前把一个 token 复制给多个被选专家；复制因子属于路由，不是 All-to-All 自带的行为。后文固定 A2 部署用 **MC2（一类计算与通信协同实现）**完成这类定向派发和返回，具体见 [MC2](#mc2)。

最后，**Send/Recv** 不属于集合通信：指定的发送者发、指定的接收者收，例如卡 0 发 `[1, 2]`，卡 1 收 `[1, 2]`，其他成员不必参与这一条消息。前面的 Scatter、Gather、Reduce 虽然只有根卡一方收齐或发出，仍是组内集合操作。[流水线并行](pipeline-parallel.md)可用点对点通信连接层段；真实接口还支持交接元数据、多个张量及可选的组内重组。

## ring All-Reduce 每一步在传什么？

上一节的图里，一步之内每张卡要同时跟其余每张卡收发。ring（环）是另一种常见的安排：$N$ 张卡首尾相连成一圈，每一步每张卡只把 1 块发给环上的下一张卡（最后一张的下一张是卡 0），同时从上一张卡收 1 块。All-Reduce 在环上分两段走：

1. 前 $N-1$ 步做 Reduce-Scatter：每张卡把一块发给下一张，对方把它加进自己同位置的那一块；下一步，对方再把刚加过的这块接着往下传。一块每经过一张卡就多加进一张卡的数，传满 $N-1$ 次就加齐了。
2. 后 $N-1$ 步做 All-Gather：每张卡把手里加齐的那块沿环传一圈，收到就直接覆盖。

```wiki-diagram
file: collective-communication-ring
```

跟着卡 0 的第 0 块走一遍：第 1 步它从卡 0 发到卡 1，卡 1 的第 0 块变成 $1 + 10 = 11$，加进了两张卡的数；第 2 步卡 1 把 `11` 发到卡 2，变成 $11 + 100 = 111$；第 3 步卡 2 把 `111` 发到卡 3，变成 $111 + 1000 = 1111$，四张卡的数都加进来了，图里变成深色。另外三块同时在环上错开一格做同样的事，所以 3 步后每张卡各有一块加齐的结果：卡 0 的 `2222`、卡 1 的 `3333`、卡 2 的 `4444`、卡 3 的 `1111`。再用第 4–6 步把这四块沿环传一圈，每张卡就都拿到 `[1111, 2222, 3333, 4444]`；最后一格把这 3 步画在一起，圆圈里的数是这块在第几步收到。

为什么要这样绕一圈：每一步每张卡只发 1 块、只收 1 块，没有哪张卡要一次收下所有人的数据，环上每一段链路同时在用。把示意换成一般的 $N$ 和 $M$：把 $M$ 分成 $N$ 块，先用 $N-1$ 轮完成分块归约，再用 $N-1$ 轮收齐各块；每轮发送 $M/N$，所以每卡发送量满足：

$$V_{\text{ring, send}} = 2 \times \frac{N - 1}{N} M \xrightarrow{N = 4} 2 \times \frac{4 - 1}{4} M = 1.5 M$$

公式中的系数 $2$ 来自前后两个阶段，不是把发送和接收重复相加。卡数越多，$2(N-1)/N$ 越接近 $2$，每张卡发出的量大约是自己输入数据的两倍，几乎不随卡数增长。把图中 4 张卡（每卡整份输入 $M$ 对应 `4 块`）的账单拆开对照如下：

| 阶段与统计项 | 步数与单步块大小 | 占每卡整份输入 $M$ 的比例（`4 块` 示意） |
| --- | --- | --- |
| 单步每卡发出 | 每步固定发出 `1 块` | $M \div 4 = 0.25 M$（`1 块`） |
| 第 1 阶段：`Reduce-Scatter` | $(4 - 1) = 3$ 步 $\times (M \div 4)$ | $0.75 M$（发出 `3 块`） |
| 第 2 阶段：`All-Gather` | $(4 - 1) = 3$ 步 $\times (M \div 4)$ | $0.75 M$（发出 `3 块`） |
| **两阶段每卡共发出** | **$2 \times (4 - 1) \div 4 \times M$** | **$1.5 M$（共发出 `6 块`）** |

若各卡有同形状部分和 $Y_i$，完整结果为 $Y = \sum_i Y_i$。**Reduce-Scatter 后接 All-Gather**，在相同分片规则和理想算术下，与一次 All-Reduce 的逻辑结果相同：先各留 $Y$ 的一片，再每卡收齐 $Y$。这里第二步每卡输入已经是 $M/N$，因此两步每卡发送量相加仍为 $2\frac{N-1}{N}M$。浮点加法次序可能改变末位数值，逻辑等价不保证逐位相同。

如果后续计算只用本片，就可推迟 All-Gather，减少中间完整张量的驻留；这也是理解[序列并行](sequence-parallel.md)的基础。All-Gather 之后本地求和也能得到归约数值，但会先复制全部输入，成本不同，不能混淆两种操作的定义。序列并行分 token 的中间表示，[上下文并行](context-parallel.md)分历史位置及其相关计算；两者都要先确认下一阶段需要完整表示、哪些历史数据或哪些局部注意力结果，才能选择收集与归约的位置。

## 通信量里的 N 和 M 到底数什么？

先区分三本账。**逻辑载荷**是传给操作的张量或分片大小；**每卡发送量**是算法执行中这张卡送出去的有效数据；**全组传输量**把所有卡的发送量相加，每次发送只计一次，不再把接收重复加进去。表中按均衡 ring（每卡向相邻卡逐轮传块）、直接交换或无重复转发的树形广播估算，忽略协议头、对齐、重传和物理链路跳数。它们是解释成本的模型，实际 HCCL（昇腾集合通信库）选用的算法可不同。

| 操作 | 每卡输入 → 输出 | 每卡发送量 | 全组传输量 | 按完整张量 $S$ 换算 |
| --- | --- | --- | --- | --- |
| All-Reduce | $M \to M$ | $2(N-1)M/N$，ring | $2(N-1)M$ | $S = M$，每卡发 $2\frac{N-1}{N}S$ |
| All-Gather | $M \to NM$ | $(N-1)M$，ring | $N(N-1)M$ | $S = NM$，每卡发 $\frac{N-1}{N}S$ |
| Reduce-Scatter | $M \to M/N$ | $(N-1)M/N$，ring | $(N-1)M$ | $S = M$，每卡发 $\frac{N-1}{N}S$ |
| All-to-All | $M \to M$，等分交换 | $(N-1)M/N$，直接交换 | $(N-1)M$ | $S = M$，每卡发 $\frac{N-1}{N}S$ |
| Broadcast | 根 $M \to$ 每卡 $M$ | 依树位置不同；全组平均 $(N-1)M/N$ | $(N-1)M$ | $S = M$，同左 |

**除最后一列外，表中的 $M$ 一律按每卡输入计**，与后文 GLM 各处的载荷同一口径。所以 All-Gather 的 $M$ 是每卡分片的大小，Reduce-Scatter 的 $M$ 是完整张量的大小；直接横比这两行，会误以为收集比分片归约贵 $N$ 倍。外部资料常按完整张量 $S$ 计：All-Gather 的 $S$ 是收齐后的输出 $NM$，其余四种的 $S$ 就是每卡输入 $M$。换成 $S$ 后，All-Gather、Reduce-Scatter 和等分 All-to-All 的每卡发送量都是 $\frac{N-1}{N}S$，All-Reduce 正好是前两者之和 $2\frac{N-1}{N}S$。

拿本页 4 张卡、每卡 4 块的例子代一次：All-Gather 每卡输入 1 块，$M$ 就是 1 块，每卡发 $(4 - 1) \times 1 = 3$ 块；Reduce-Scatter 每卡输入 4 块，$M$ 就是 4 块，每卡发 $(4 - 1) \times 4 \div 4 = 3$ 块。两者都发 3 块，换成完整张量 $S = 4$ 块，都是 $\frac{N-1}{N}S$；All-Reduce 是两者之和 6 块，也就是 ring 一节的 $1.5 M$。前四行在上述均衡模型下，每卡接收量等于发送量；若问“发送加接收”，还要乘二。Broadcast 则是每个非根卡接收 $M$：根直接逐个发送时根发 $(N-1)M$，其余卡不转发；树形实现由中间卡转发，不能把全组平均值当成根的发送量。$N=1$ 时都无需跨卡传输。Scatter、Gather、Reduce 的直接发送量写在各自小节。

算清每卡发送量后，还要对照物理链路的带宽悬崖安排并行策略（硬件理论峰值口径详见[昇腾四族硬件体系](hardware-devices.md#官方带宽规格能说明什么)）：以华为《Atlas 800T A2 训练服务器 技术白皮书》标称值为参照，机内每颗处理器由 7 条 **HCCS** 链路聚合提供 `392 GB/s` 理论带宽（昇腾 950 演进为 **Unified Bus**，Atlas A3 SuperPoD 进一步扩展超节点高速池），而跨出单台服务器走 **RoCE RDMA** 时，单个 `200GE` 端口线速仅折 `25 GB/s`（尚未扣除以太网与 RDMA 协议开销），存在 **10 倍以上**的带宽落差：

```wiki-diagram
file: coll-comm-fig-hccs-vs-roce
```

因此，每层执行 2 次阻塞 `All-Reduce`（外加词表 `All-Gather`）的 **TP**，以及将其拆为 `Reduce-Scatter + All-Gather` 的 **SP**，必须优先锁在单机 `HCCS / Unified Bus` 或超节点高速域内；跨机 `RoCE` 网络则适合承载只在层段边界异步交接激活的 **PP**（`isend/irecv`）、请求级独立的 **DP**（仅做几个字节的 CPU 控制面状态归约），或单机装不下全部专家时传递激活的跨机 **EP**。

## 放到 GLM 双机：一个 token 会在哪里通信？

以下历史双机绑定算例固定在 `vllm@0fc695fc + vllm-ascend@db701c1f`（双机 `2×A2×8`，`TP8 / DP2 / EP16`）：**A0 启动时建立通信组，A4 前向时反复使用这些组。** [双机部署的 16 卡分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)给出具体成员：两套机内 TP8 分别合算本机矩阵；八个跨机 DP2 组连接对应卡；EP16 覆盖全部卡以共享完整专家集合。HCCL 是昇腾的集合通信库，HCCS 是机内高速互联；通信库与物理链路分属两层。CPU 状态同步还会用 Gloo 这一 CPU 通信后端，不能全算作 HCCL 流量。

以下沿用[条件性基线](../sources/glm-5-3-flash-baseline.md)：SP（把 token 行分给组内成员的序列并行）关闭，共享专家 DP 与归约替换也未启用。因此嵌入与投影保留完整 token 行，MoE 使用下文的补齐、切分和收尾路径。环境变量默认关闭不足以证明这些运行条件，配置与共享专家初始化还可能改变最终状态。

在这组条件下，GLM 双机主干一次前向有 **218 个通信调用边界**，也就是前面说的交接点：稠密层的两处合齐，加上 MoE 层专家的分发、返回与合并。完整次数账见[一条请求的通信汇总](one-request.md#一次前向的通信账)。一次调用的传输轮数由算法决定，218 不是网络包数，也不表示每次都执行全局屏障。CPU 的 DP 状态同步拿出“是否还有工作、是否请求暂停”两个 32 位整数，输入载荷共 **8 B**，做一次 `SUM` All-Reduce 后各参与者获得两项计数，再据此判断是否继续运行；这是小型控制消息，下文的设备张量和 218 次主干通信账不包含它。

下面跟[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)走过[A4 第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。R1 的提示词有 4 个 token；prefill 是首次一起处理提示词，decode 是利用已有历史继续生成。首次 prefill 处理这 4 行，decode 的主模型验证一步也处理 4 行，其中含 MTP 提出的 3 个候选：MTP 是模型自带草稿层先猜后续 token，再交给主模型验证的机制。hidden 是每个位置的隐藏向量，宽 4096；BF16 每元素 2 字节，FP32 每元素 4 字节，INT8 每元素 1 字节。

### 从嵌入到逐层投影

**词嵌入和投影的部分和都通过 TP8 All-Reduce 合齐。** 嵌入查表时，各卡只保留属于本卡词表段的结果，其余位置填零；归约后所有卡都拿到完整 hidden。attention（读取历史信息）的输出投影、稠密 MLP（逐位置前馈变换）的降维投影，则各自产生对完整 hidden 的部分贡献。

R1 的归约前后，每卡都是 `[4,4096]`，两维分别是 token 行数和隐藏宽度；不同的是数值从部分和变成完整值。单次输入载荷 **32,768 B**，主干共 **91 次**：嵌入 1 次、attention 45 次、稠密 MLP 3 次、共享专家 42 次。逐站推导与次数统一见[请求主线](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)，本页只将载荷代入前面的均衡 ring 通信模型：

$$V_{\text{TP8, send}} = 2 \times \frac{8 - 1}{8} \times 32{,}768\text{ B} = 57{,}344\text{ B}, \qquad V_{\text{TP8, group}} = 8 \times 57{,}344\text{ B} = 458{,}752\text{ B}$$

| 统计口径（一次 `TP8 All-Reduce` 均衡 ring 估算） | 代入算式 | 有效字节数 |
| --- | --- | --- |
| 单次每卡输入载荷 $M$ | $4 \times 4096 \times 2\text{ B}$（`BF16`） | **32,768 B** |
| 每卡有效发送量 | $2 \times (8 - 1) \div 8 \times 32{,}768\text{ B}$ | **57,344 B** |
| 每卡有效接收量 | 与均衡 ring 发送量相等 | **57,344 B** |
| 全组 8 卡发送总量 | $8 \times 57{,}344\text{ B}$ | **458,752 B** |

（注：上表仅按 `32,768 B` 输入载荷演示均衡 ring 模型的有效传输估算，不代表本部署 HCCL 实际选择了 ring 算法。）

### 专家返回与词表输出

**All-Gather 收齐的是不同片段，不再对这些片段求和。** MoE 是由多个专家网络提供前馈输出的层；R1 进入路由分支前，4 行补齐到 8 行并按 TP8 分开，每卡留 `[1,4096]`，其中补位由有效行标记区分。专家结果回来后，每卡已经合齐自己所负责行的专家贡献。

MoE finalize 用一次 TP8 All-Gather：每卡贡献 **8,192 B**，收齐后先得到 `[8,4096]`，再去掉补位，恢复 `[4,4096]`。主干 42 个 MoE 层各做一次。这一操作的 ring 模型每卡发送量是 7 份本卡切片，不能把“贡献 8,192 B”写成线上总共只发送 8,192 B。

走到词表输出，`lm_head` 为每个候选词打分：每卡先持有 `[n,19360]`，TP8 All-Gather 后每卡持有 `[n,154880]`。这里 $n$ 是需要输出分数的位置数。R1 prefill 只取最后位置，$n=1$、每卡贡献 **38,720 B**；decode 主干验证要 4 行，$n=4$、每卡贡献 **154,880 B**。它沿词表维拼接，MoE 则沿 token 维拼接。算式见[请求主线的词表投影](one-request.md#最终归一化与词表投影)。

### MC2

**MC2 是昇腾的一类计算与通信协同实现，不是第六种集合通信语义。** 普通集合通信定义数据如何从输入变成输出；MC2 可以把分块计算与通信安排成相互重叠的流水，让已经就绪的块先传或先算。它仍需要通信组、数据传输和同步条件。

在本页的 MoE 路径里，**dispatch** 按选中的专家把输入派发给持有卡，**combine** 把专家结果送回源 token 所在卡并按路由权重组合。这在数据流上属于按目的地交换，但还涉及量化、重排、路由权重和有效行标记，不能把一次 MC2 调用直接替换成一次等长 All-to-All，也不能假定它内部必然调用 `HcclAlltoAll`。一个 token 交给多个专家，需要上层路由建立多份 token–expert 对应关系，再把输入送往相应设备；这里的多份对应关系来自专家选择，All-to-All 本身只按目的地交换交给它的数据，不自动为 token 增加专家副本。

R1 中每个有效 token 选 8 个专家。按源 token 归属记账，一次 dispatch 的单专家副本是 **4,100 B**，8 份合计至多 **32,800 B**；combine 的单专家结果是 **8,192 B**，8 份返回至多 **65,536 B**。42 层各有一轮 dispatch 和 combine。这些是有效行的逻辑副本上界：本地命中无需跨卡，补位不贡献真实 token，专家热门程度还会改变目的卡接收量。单卡持有一行并不意味着所有卡都持有一行真实请求。推导与形状见[请求主线的 MoE 小节](one-request.md#42-层-moe每卡-18-个专家)。

本部署的 A2、EP16、每卡 18 个专家条件下，两组最大执行宽度在 **128** 容量内选 MC2，超出则选 **AllGather 路径**。AllGather 是整条 MoE 实现路线的名字，All-Gather 是前面定义的单个集合操作；两条路线都会用到 All-Gather。容量推导见[请求主线](one-request.md#42-层-moe每卡-18-个专家)，两组共用选择见[并发请求的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。满足这些条件的短 prefill 也走 MC2，不能只凭 prefill/decode 标签判定。

下面沿 A0 到 A4 画出执行分支。MC2 中专家计算仍在 dispatch 与 combine 之间调用；通算协同不代表整层只有一个融合 kernel（设备上执行的计算程序）。图中的“本地专家”指本卡持有的那些专家。图按结果合并的依赖展开；启用共享专家多流时，共享计算可按事件与路由工作重叠，不能把主机调用先后当成设备上完全串行的时间线。

```wiki-diagram
file: collective-communication-flow
```

两路最后都交回本组完整 hidden。MC2 已合齐路由贡献，所以共享专家单独归约；AllGather 路径先通过 DP2 Reduce-Scatter 合并一对卡的路由贡献，再把它与共享专家部分和一起在 TP8 中归约。两路每个 MoE 层均有四个通信调用边界，attention 的一次另计。

## 大批输入为什么改用 Reduce-Scatter？

**AllGather 路径先让各卡看到两组输入，再把专家贡献合齐并交回 token 所属组。** [场景 M](concurrent-requests.md#示例场景-m-与变体-m)是 DP0 的 12 条 decode 加一条 6000-token prefill，DP1 有 7 条 decode；两边该步的执行宽度都对齐为 6048，进入 AllGather 路径。补齐推导留在并发页，以下引用[EP 页的整批账](expert-parallel.md#场景-m多请求时的整批账和负载不均)。

| 每个 MoE 层的顺序 | 通信前 → 通信后，每卡 | 单次载荷的明确口径 |
| --- | --- | --- |
| DP2 All-Gather hidden | `[6048,4096] → [12096,4096]` BF16 | 每卡贡献且接收远端 **49,545,216 B** |
| DP2 All-Gather 路由分数 | `[6048,288] → [12096,288]` FP32 | 每卡贡献且接收远端 **6,967,296 B** |
| 本地专家算完后 DP2 Reduce-Scatter | `[12096,4096] → [6048,4096]` BF16 | 每卡输入 **99,090,432 B**；输出 **49,545,216 B** |
| 加共享贡献后 TP8 All-Reduce | `[6048,4096] → [6048,4096]` BF16 | 每卡输入 **49,545,216 B** |

两张 DP 对应卡都曾计算全部 12096 行中路由到本地专家的工作，因此 Reduce-Scatter 的输入是同形状的部分和。归约后卡 0 留 DP0 的行、卡 1 留 DP1 的行；再通过机内 TP8 合齐全部专家贡献。对照通用公式，此处 $N=2$、$M$ 是 **99,090,432 B 的输入**，发送量约为一半；底稿把 **47.25 MiB** 记作输出切片载荷，读公式时必须换回输入口径。

四步在主干 42 个 MoE 层中重复。整步的 **6.09 GiB** 是混合口径的逻辑载荷汇总，详细账见 EP 页；机间网卡实际流量还要按算法和物理链路统计，不能仅乘卡数得出。

## 常见误解

把集合通信原语、链路字节换算与 `v0.30.0` 运行时通信域管理放在一起核对，最容易踩中的五组误区对照如下：

```wiki-diagram
file: coll-comm-fig-myths
```

逐条复核现场高频混淆点：

- **“All-Gather 就是求和，或者 All-Reduce 会把张量形状压小。”** All-Gather 保留各来源元素并拼接（$M \to NM$）；All-Reduce 按指定运算合齐同位置数值，输入输出形状都是 $M$。
- **“Reduce-Scatter 就是本地切片。”** 输出每一片都包含所有参与者在该位置的归约贡献，只切本卡张量没有合入远端部分和。
- **“All-to-All 给每个人一份完整输入。”** 每个目的地拿到的只是各来源专门切给它的那一块。
- **“MC2 取代了 HCCL 和所有集合通信，或 `ALLGATHER` 策略只调一次 All-Gather。”** MC2 改变通算组织方式，本部署 MC2 路径仍有 TP All-Gather 和 All-Reduce；而 `MoECommType.ALLGATHER` 是包含两次 All-Gather、一次 Reduce-Scatter 与一次 All-Reduce 的完整 MoE 通信路线名。
- **“创建通信组不占显存，或者同成员通信组每次都会无脑重开一套缓冲。”** HCCL 通信域在初始化时会按配置预留设备中转缓冲（挤压 KV cache 预算），而 `v0.30.0` 的 `HcclPgRegistry` 会按复用域合并相同成员与选项的底层组，详见 [HCCL 缓冲页](hccl-buffer.md)。
- **“异步返回就能读输出。”** 异步提交只允许主机继续往下派发工作，消费输出前仍需满足 `handle` 完成和设备流依赖。
- **“所有通信都跨机，或者所有 DP 组互不通信。”** TP8 锁在机内 HCCS；DP2 与 EP16 跨机。推理没有梯度同步不代表没有控制面状态归约和跨机专家通信。
- **“R1 的 ≤7.3 MiB 就是每卡网卡收发量。”** 该主干账混合归约输入、收集贡献切片和专家副本上界；decode 与 prefill 的词表行数也不同，且不含第 5 站的三遍 MTP 草拟通信，更不能直接除带宽推出实测时延。
- **“All-Reduce 就是 ring，且总会新分配一块输出显存。”** ring 只是理解成本的一种常见算法，实际 HCCL 可按拓扑与大小选别的算法；存储上基础设备通信器可原位写回输入缓冲，独立封装也可另开输出，须沿实际执行分支确认。

## 对照源码

### 怎么开

集合操作没有统一的“开启通信”开关；模型切分和代码路径决定在哪里调用。历史双机算例的 TP8、DP2、EP16 前提统一见[双机部署页](glm-5-3-flash-two-node.md#部署前提)。同一进程可在 TP、DP、EP 的不同组中分别调用通信，核对日志时先确认通信组再看 `rank`。在昇腾文档里，五种操作名称通常去掉连字符；HCCL 的 C API 名与 Python 封装名对照如下：

| 本页术语 | HCCL 操作 / C API | `v0.30.0` 及固定代码中的入口与含义 |
| --- | --- | --- |
| All-Reduce | AllReduce / `HcclAllReduce` | 组 `all_reduce` → `DeviceCommunicatorBase.all_reduce` → `dist.all_reduce`，原位归约部分和 |
| All-Gather | AllGather / `HcclAllGather` | 组 `all_gather` → `dist.all_gather_into_tensor`；MC2 finalize 使用 `dist.all_gather` |
| Reduce-Scatter | ReduceScatter / `HcclReduceScatter` | 组 `reduce_scatter` → `dist.reduce_scatter_tensor`，切分维须可整除组规模 |
| All-to-All | AlltoAll / `HcclAlltoAll`；变长对应 `HcclAlltoAllV` | `v0.30.0` MoE 变长交换由 `moe_utils.async_all_to_all` 调 `dist.all_to_all_single`（`v0.23.0`/`v0.26.0rc` 另有 `NPUCommunicator.all_to_all`）；A2 普通 EP 不走 `ALLTOALL` |
| Broadcast | Broadcast / `HcclBroadcast` | 张量 `dist.broadcast`；独立 `PyHcclCommunicator.broadcast` 也有直接包装 |

普通设备路径由 `torch.distributed` 经 `torch_npu` 的 HCCL 后端承接。`NPUCommunicator` 继承上游 `DeviceCommunicatorBase`；**代码库存在 `PyHcclCommunicator` 不等于主干全部经过该类**。此外，`GroupCoordinatorPatch` 在建组时通过 `create_hccl_pg_options` 按组名配置 `hccl_buffer_size`（`mc2` 组返回 `None` 并改按 `HCCL_BUFFSIZE` 切分通信空间），再经 `HcclPgRegistry`（`_acquire_hccl_group`）按复用域合并同成员与同选项的底层 HCCL 组，防止重复占用通信缓冲。

MC2 的可追踪边界是 `MoECommType.MC2` → `token_dispatch` → 派发算子 → 专家矩阵计算 → 返回算子 → finalize。初始化检测到 `torch_npu` 提供 dispatch v2 时，派发和返回调用 `npu_moe_distribute_dispatch_v2` 与 `npu_moe_distribute_combine_v2`；否则回退无 v2 后缀接口，启用层次通信却缺少 v2 时报错。融合矩阵乘与 All-Reduce 等其他 MC2 用法不改变 All-Reduce 的输入输出语义。

### 会报什么错

同组参与者必须按兼容顺序调用操作，并满足形状、类型、根和分片计数约定；否则可能报错、超时或互相等待。All-to-AllV 要逐对匹配 `input_split_sizes` 与 `output_split_sizes`，不能只核全组字节总和。组通信器缺失会抛出 `No device communicator found`；Reduce-Scatter 检查切分维长度能否整除 `world_size`。异步接口返回的 `handle` 与流事件负责建立数据就绪条件，不能绕过等待直接消费结果。

输入所在设备也有约束：`PyHcclCommunicator.all_reduce` 要求输入位于创建通信器时绑定的设备，源码注释提示设备不匹配可能导致非法内存访问（该检查对应 `PyHccl` 路径，不能据此推定所有后端报错表现相同）。此外，跨机 `RoCE` 下的 MoE 部署不支持同时开启 `PP > 1` 与 `DP > 1`（`MoeDistributeDispatch` 拓扑限制，且启动期无 Python `assert` 拦截），混配会导致运行期通信挂起或报错。

### 开销和什么时候别开

先按输入输出关系选操作，再按模型布局与物理拓扑评估是否值得通信：高频逐层 `All-Reduce` 应留在机内 `HCCS / Unified Bus` 域；后续只用本片时，推迟 All-Gather（如启用序列并行 SP）可减少复制和完整张量驻留；只有根需要结果时，不必让全员拿完整副本。

ring 公式只是有效传输模型；真实耗时还受启动次数、拓扑跳数、网络拥塞、流同步和通算重叠影响。MC2 收益依赖分块计算与通信时长能否匹配，小块效率损失、调度开销与访存竞争也可能抵消重叠收益，不能从调用次数或字节上界直接推出加速比。HCCL 缓冲容量属于显存预留而非每轮实际传输量，详见 [HCCL 缓冲页](hccl-buffer.md)。

### 版本差异

八种通信原语的输入输出数学语义不随框架版本改变，跨版本演进集中在**设备通信器封装、HCCL 组缓冲去重与四族硬件 MoE 通信选路策略**（前文 GLM-5.3-Flash 双机算例固定在例外 B 钉点 `vllm-ascend@db701c1f + vllm@0fc695fc`，其 A2 选路主规则与下表 `v0.23.0` 一致，不混套新版本档位与默认值）：

| 核对维度 | `v0.23.0` (`2c59ff10` / `0fc695fc`) | `v0.26.0rc` (`2ed6cbba` / `568afb3a`) | `v0.30.0` (`c09d3e20` / `ced6857a`) | `main` (`8d6180e2` / `ba15685a`) |
| --- | --- | --- | --- | --- |
| `NPUCommunicator` 与 `All-to-All` | 继承 `DeviceCommunicatorBase` 并重写 `all_to_all`；MoE 异步变长交换位于 `comm_utils.py` | 新增 `_NpuAll2AllManager` 占位（`support_fault_tolerance=False`），保留 `all_to_all` | 移除 `NPUCommunicator.all_to_all` [C9]，MoE 变长交换收口至 `moe_utils.async_all_to_all`（`dist.all_to_all_single`）[C11] | `NPUCommunicator.all_reduce` 新增可选 INT8 `QuantizedAllReduce` 包装（仅 TP 规模组生效）[C24] |
| HCCL 通信域缓冲与去重 | `GroupCoordinatorPatch` 按组配置 `hccl_buffer_size`（`mc2` 走 `HCCL_BUFFSIZE`）并通过 `HcclPgRegistry` 按域去重 | 沿用按组缓冲映射与 `HcclPgRegistry` 去重 | `create_hccl_pg_options` 默认缓冲 `200 MB`、`dp` 动态计算、`mc2` 返 `None` [C13]，`_acquire_hccl_group` 按 `shared/mc2/eplb` 域复用 [C12] | 同 `v0.30.0` 按域去重与缓冲切分架构 |
| MoE 通信选路与四族策略 | 按芯片直接分支：A2 在每卡专家 `≤24`、`EP≥16` 且 `num_tokens` 在容量内选 `MC2`，否则 `ALLGATHER` [C17] | 增加总专家数 `>512` 回退、`num_tokens is None` 兼容及 `LoRA + EP → ALLTOALL` 优先分支 [C20] | 收敛至 `HardwareProfile.moe_comm_policy`（`A2` 密度容量、`A3` 融合或容量、`310P` 固定 `ALLGATHER`、`A5` 容量与组规模，但 `A5` 误含 `PP` 因子）[C14][C15] | 沿用四族策略，修复 `A5` 的 `ep_world_size = world_size_across_dp // pipeline_parallel_size` [C25]（更完整对比见 [EP 页](expert-parallel.md#版本差异)） |
| `enable_prefill_mc2` / `enable_fused_mc2` | `enable_prefill_mc2=False`（`128` 来自固定图档位而非通用上限）；`enable_fused_mc2` 取 `0/1` | 默认同左，增加 `MiniMax M3` 等互斥校验 | `enable_prefill_mc2: bool = False`，`enable_fused_mc2: int = 0`（支持 `2` 映射 MegaMoe 及不兼容配置静默回 `0`）[C16] | `enable_prefill_mc2=False`；`enable_fused_mc2` 扩至 `{0, 1, 2, 3}`（`3` 含 A5 共享专家融合） |
| 上游 `vllm` DP 控制面与 SP | `has_unfinished_dp` 用 `MAX`、`sync_dp_state` 双整数 `8 B` 用 `SUM` [C32]、`sync_kv_cache_memory_size` 用 `MIN`（均走 `dist.all_reduce`） | 同左（位于 `vllm@568afb3a`） | `has_unfinished_dp` 用 `MAX`、`sync_dp_state` 用 `SUM`、`sync_kv_cache_memory_size` 用 `MIN` [C8]；`PP>1` 开 `PassConfig.enable_sp` 自动追加 `+rms_norm` | `sync_dp_state` 迁入带超时的 `cpu_all_reduce_`（`has_unfinished_dp` 仍用 `MAX`、`sync_kv_cache_memory_size` 仍用 `MIN`）[C28]；移除上游 `PassConfig.enable_sp` |

### 源码位置

- 五种集合操作、根操作、变长交换语义及 HCCL C API 名：昇腾 HCCL 官方说明 [S1]；同步与异步 `handle` 语义参照 PyTorch 分布式文档 [S2]。
- CANN 社区版 8.2.RC1.alpha001《Ascend C 最佳实践》§6.4（印刷页 85–90）：分块流水可带来 MC2 通算重叠，但小块效率、调度开销与访存竞争也可能抵消收益 [S3]；机内 7 链聚合 `392 GB/s` HCCS 与 `200GE` RoCE 端口规格见华为《Atlas 800T A2 训练服务器 技术白皮书》第 16 版 §5.1 [S4]，单口 `25 GB/s` 字节线速由十进制位宽换算 [D]。
- 分格图中 `SUM` 为解释归约的示意设定 [A]；均衡 ring / 直接交换的 $(N-1)M/N$ 与 $2(N-1)M/N$ 字节公式由均分传输模型推导 [D]；`Reduce-Scatter + All-Gather` 与 `SUM All-Reduce` 的逻辑等价限定于同形状部分和与一致分片规则，浮点加法次序差异仍可改变末位舍入 [D]。
- `v0.30.0` 上游通信底座：`GroupCoordinator` 的 `all_reduce / all_gather / reduce_scatter` 与缺失通信器异常 [C5]；`DeviceCommunicatorBase` 原地 `dist.all_reduce`（单成员组直接返回输入）与 `all_gather_into_tensor / reduce_scatter_tensor` [C6]；PP 张量字典 `send_tensor_dict / isend_tensor_dict / irecv_tensor_dict`（注意其切片发送与组内重组优化要求待传张量在组内完全复制，SP 分片 residual 不可仅因长度可整除就启用该优化）[C7]。
- `v0.30.0` 昇腾通信实现：`PyHcclCommunicator` 独立输出分配、绑定设备校验与握手 `broadcast`（存在该类不代表主干默认经过它）[C10]；其余 `v0.23.0 / v0.26.0rc / main` 源码锚点对应 `sources` 第 18–19、21–23、26–27 项。
- 例外 B（`db701c1f + 0fc695fc`）双机算例支撑：上游组封装、PP 发送与 DP/EP 建组对应 `sources` 第 29–31 项；A2 容量分流、MC2 补齐切分与 finalize 去补位、AllGather 路径两次收集加 DP `Reduce-Scatter`、dispatch/combine v2 检测与回退、共享专家多流事件重叠与外层归约及 SP 优先级条件对应 `sources` 第 33–40 项（原始摘录留存 `sources` 第 41 项及 `rawSources`）。正文的 218 次调用边界、91 次 All-Reduce 与每层 MoE 四个边界均限定于 SP 及共享专家 DP 未启用的基线条件。

**待核**

- 缺少固定镜像中 HCCL / CANN 运行时的实际算法选择与通信 trace，尚不能给出网卡收发实测字节、MC2 同目的卡副本合并策略或真实通信耗时；HCCL 官方文档用于核对原语语义，不代表已核实镜像内安装的库小版本。
- 底稿未列出启动期 Broadcast 的完整调用清单、张量长度与后端归属，本页不填假定的启动广播字节数。
