---
id: ai-core
title: AI Core：计算单元与数据搬运
type: concept
summary: 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路径理解计算与访存的配合。
aliases: [AI Core, AICore, Cube, Vector, Scalar, AIC, AIV, AI Cube, AI Vector, AI 核心, 计算单元与数据搬运]
chapters: ["07"]
order: 120
sources:
  - https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L155
  - https://www.hiascend.com/developer/techArticles/20240819-1
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L61-L125
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L42-L222
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L365
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_dynamic.py#L74-L124
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L93-L123
verified: []
evidence: "C"
relations:
  - {to: hardware-devices, kind: builds-on, note: 先区分设备与设备内部的核心}
  - {to: device-memory, kind: builds-on, note: 理解设备内存与数据访问}
  - {to: matmul-and-weights, kind: builds-on, note: 认识矩阵计算需要的输入与权重}
  - {to: one-request, kind: builds-on, note: 回到第 4 站，把单卡计算放回请求的逐层前向}
  - {to: ops-and-kernels, kind: builds-on, note: 区分数学算子、软件入口与设备上的执行程序}
contradicts: []
updated: "2026-10-02"
origin: seed
---

## AI Core 怎样把矩阵乘变成设备上的计算？

**AI Core 是 NPU（执行模型计算的芯片）内承担计算的一类核心，配有存储、搬运与控制部件。** 例如模型把输入向量和权重矩阵相乘，再对结果逐项做激活变换：前一步需要许多乘加，后一步需要逐项处理，两步都要先拿到数据。

其中，**Cube** 做矩阵计算，**Vector** 做向量计算（如逐项加法，也包括归约），**Scalar** 做标量运算和地址、循环等控制。搬运单元把数据送到计算单元可用的位置。图用分离架构说明：矩阵侧核心叫 **AIC**，向量侧核心叫 **AIV**，两侧各有 Scalar。

先分清两层存储：**GM** 是设备侧全局内存空间，保存输入、权重和结果；**片上缓冲**是芯片内部暂放当前数据块的空间，让计算单元就近使用数据。沿图中箭头看，数据先搬入片上，算完后再交出结果。

```wiki-diagram
file: ai-core
```

## 为什么既要计算单元，也要片上缓冲？

**矩阵乘需要反复使用输入和权重，先把一块数据放到片上，再让计算单元复用它，才能减少反复从 GM 取数。** 缓冲空间有限，大张量要分块：搬入一块、计算、交出结果，再处理后面的块。

例如一块权重服务多行输入时，搬来的同一块权重可以参与多次乘加；但下一块尚未搬到、或者前一块尚未写完，计算仍会等。这里的**代价**包括搬运、片上空间、流水阶段之间的同步，不只是乘法次数。片上搬运与多张卡之间的通信属于不同层次，后者见 [CANN 与 HCCL](cann-hccl.md)。

## 一块数据怎样经过矩阵计算和逐项计算？

### 矩阵结果如何交给向量侧？

**先算矩阵乘，再把结果交给逐项运算；两侧之间传的是中间结果。** 用一个示意例子追踪首图：输入一行 x = [1, 2]，权重矩阵 W 的两行分别为 [1, −1]、[2, −2]；矩阵结果接 ReLU，即把负数变为零的激活函数。这里用 ReLU 方便手算，GLM 的激活另在双机一节说明。

搬运单元先把 x 和 W 从 GM 搬到矩阵侧的 **L1**，在这里准备输入块；再经 **L0A、L0B** 两个缓冲，把矩阵操作数送给 Cube。Cube 做乘加，**L0C** 接住累加结果。**Fixpipe** 负责矩阵结果的后处理与输出搬运，选择写回 GM 的路径时，它交出中间结果；向量侧再把结果搬到 **UB**（Unified Buffer，向量侧片上缓冲），Vector 逐项激活，并把输出经 UB 写回 GM。

```calc
title: 同一行数据先乘矩阵、再逐项激活（示意）
矩阵结果第一个数 = 1 × 1 + 2 × 2 = 5
矩阵结果第二个数 = 1 × (−1) + 2 × (−2) = −5
交接到向量侧 = [5, −5]
逐项激活 = [max(5, 0), max(−5, 0)] = [5, 0]
```

这说明 Cube 与 Vector 分担的是不同运算。矩阵乘怎样从行列配对得到输出，详见[矩阵乘和权重](matmul-and-weights.md)；这里关注的是数据在哪准备、在哪计算、何时交接。上面的微型数组只演示逻辑，不规定实际矩阵指令的最小块尺寸。

### 一块向量的搬运与计算怎样配合？

**逐项计算同样要先搬入数据，再把结果搬出。** 单独看一个只涉及搬运量的教学小块：4 个 FP32 数，FP32 表示每个数占 32 位、即 4 字节；假设做完一次逐项变换后，输出仍是 4 个 FP32 数。读取和写回的逻辑量分别为：

```calc
title: 一块向量输入与输出的逻辑搬运量（示意）
装入输入 = 4 × 4 B = 16 B
写回输出 = 4 × 4 B = 16 B
读写合计 = 16 B + 16 B = 32 B
```

这笔账说明，即使逐项运算很简单，数据仍要进出。真实内存事务还取决于对齐、复用和具体实现；用这 32 B 除以设备标称带宽得不出实际耗时。FLOPs 是浮点运算次数，也只描述计算量，不能单独预测等待输入与保存结果需要多久。

**同一块数据必须先搬到再使用，前一块已完成计算时，后续块的搬入可以与其他阶段重叠。** Ascend C 是编写昇腾设备算子的语言；其向量编程范式把工作拆成 CopyIn（搬入）、Compute（计算）、CopyOut（搬出），用队列协调数据就绪和存储复用。设备上实际执行的一段程序叫 kernel；[算子到 AI Core](op-to-ai-core.md)中的融合归一化 kernel 就能看到这三段。double buffer 是轮换使用两份缓冲的实现方式，使一份供计算时另一份可以搬入；能否获益取决于数据量、空间和搬运计算的时间比例。

## 耦合与分离架构，改变了哪一处交接？

**耦合架构把 Cube 与 Vector 放在同一核心；分离架构由 AIC、AIV 两类核心分别执行，各自有 Scalar 和代码段。** 在本页采用的 CANN 8.0.RC2 分离架构说明中，AIC 与 AIV 通过 GM 传递数据，并协调读写先后。

矩阵侧的典型路径是 GM → L1 → L0A/L0B → Cube → L0C → Fixpipe → GM，结果也可经 Fixpipe 回到 L1；向量侧是 GM → UB → Vector → UB → GM。**回到 L1 不等于直接写进 AIV 的 UB**，跨侧交接仍要按对应架构与 kernel 的存储、同步约定完成。

核数、缓冲容量和芯片面积属于具体产品规格，首图的一组框只表达分工，不能据此外推 A3 或后续产品的这些规格。设备、卡、服务器的层级见[硬件设备](hardware-devices.md)。这里的 UB 是片上 **Unified Buffer**；[CANN 与 HCCL 的 AI QoS 一节](cann-hccl.md#ai-qos-怎样处理共享链路上的争用)中的 **Unified Bus** 是互联概念，两者只是缩写相同。

## 放到 GLM 双机：一个 token 在卡上经历什么？

**请求在 A4「逐层前向」这一站，反复经过矩阵计算、逐项计算和数据搬运。** A4 是[单请求主线第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)；token 是分词后的一个文本片段，在层间由一行隐藏向量表示。本页沿用[官方双机部署前提](glm-5-3-flash-two-node.md#部署前提)，跟踪这一行在本卡的工作。

从稠密 MLP（用矩阵乘、激活和后续投影变换向量的前馈网络）到按需选择的 MoE 专家，[量化执行链](op-to-ai-core.md#归一化之后矩阵和向量执行段怎样接上)把本页介绍的矩阵计算、向量计算与数据搬运串成了实际的模型计算。

## 常见误解

- **AI Core 就是一张 NPU，或者就是 Cube？** NPU 内还有内存、互联等资源；Cube 是计算单元，AIC/AIV 是分离架构下的核心称呼，不能混用层级。
- **Vector 只会逐项计算？** 它也能做归约等向量运算，例如把一组数求和；归一化就需要这种工作。逐项激活只是本页的入门例子。
- **算子名带 matmul，就能知道用了多少个 Cube 核？** 软件调用能说明做什么，核数、分块与流水安排要看对应 kernel 和运行记录，不能由函数名倒推。
- **GM 交接就是跨卡通信？** 首图是在同一张 NPU 内组织计算；跨卡派发与收回走另一层通信路径。设备内存和主机内存的区别见[设备内存](device-memory.md)。
- **多融合一点，或启用 double buffer，就一定更快？** 复用可能减少搬运，也会占用片上空间；数据太少或计算已占主导时，流水重叠未必有收益。需要同一输入、同一精度下的实际耗时与访存证据。

## 对照源码

### 怎么开

AI Core 是硬件执行资源，没有通用的「打开 AI Core」开关。模型计算通过[算子与 kernel 分层](ops-and-kernels.md)交给设备，具体核型和搬运安排由算子实现选择。W8A8 的线性层入口是 `AscendW8A8DynamicLinearMethod.apply`：`npu_dynamic_quant` 产生整数输入与每行尺度，`npu_quant_matmul` 使用这些尺度并指定输出类型。反量化可包含在算子内，不意味着每次都有单独的反量化 kernel。

### 会报什么错

错误应沿软件入口定位。例如本页所示专家融合分支要求权重是单个张量或只有一个元素的列表；`_require_single_tensor_for_swiglu_quant` 收到多元素列表会抛出 `must be a tensor or a single-element list`。分组格式转换收到非法类型也会报 `group_list_type should be in [0, 1, 2]`。两者都是输入约定检查，不能据此诊断硬件核心损坏。

### 开销和什么时候别开

需要权衡的是融合、分块与流水重叠。固定实现为 W8A8 专家权重做转置，并转成 `ACL_FORMAT_FRACTAL_NZ`，即适合相关矩阵算子的分块存储格式。格式转换发生在权重加载后，不能记成每个 token 重做一次的开销。

double buffer 属于 kernel 实现变体，本页没有证据说明 GLM 的每个算子都采用它。判断优化应分别观察搬入、计算、搬出与同步；数据很小或主要受计算限制时，不应仅凭「重叠更多」决定启用。

### 版本差异

**硬件组织由产品决定，软件版本不会把耦合架构变成分离架构。** 下表比较 vllm-ascend 的软件入口；AI Core 本身在各列均不是配置特性，也无布尔默认值。架构图依据 CANN 8.0.RC2，不据此外推 A3 或后续产品的核数、面积与缓冲容量。

| 版本钉点 | 本页核对到的入口和行为 | 使用时的边界 |
|---|---|---|
| v0.23 维护分支 `2c59ff10` | 有 W8A8 动态量化与量化矩阵乘；线性层检查内部 `_chunk_size`，缺省取 0，即不走拆成两次矩阵乘的分支 | 此维护分支没有 GLM 模型代码，不能当作固定部署提交 |
| 固定 GLM 提交 `db701c1f` | 上述线性层与专家 MLP 文件和 v0.23 维护分支一致；本页流程图按此提交画 | 含 GLM 代码的独立 orphan commit；控制流配套 vLLM `0fc695fc` |
| v0.26 `2ed6cbba` | 动态量化后调用量化矩阵乘；仍有同样的 `_chunk_size` 分支及缺省 0 | 此处行为一致，不意味着整个专家融合实现一致 |
| main `baa023ad` | 文件移入 `quantization/methods/w8a8/`；该线性层 apply 直接调用量化矩阵乘，已无上述拆分分支 | 按新路径核对；不能拿 main 的分支覆盖固定部署 |

### 源码位置

下面的图聚焦固定提交的专家 **MC2** 分支；MC2 是把专家派发、收回与本地计算配合起来的执行路径，适用门槛见[主线 MoE 通信小节](one-request.md#moe-通信走-mc2-还是-allgather)。**gmm1 / gmm2** 分别指第一次、第二次 grouped matmul；分组清单说明每个本地专家处理哪些行。图中的 `scale_bias` 和 `offset` 是量化修正参数，这里只展开它们为空的分支。

```wiki-diagram
file: ai-core-execution
```

读图时先看输入是否已经量化，再看第一次矩阵乘如何执行。对本页的普通 W8A8 分支，自定义融合条件是融合已启用、动态专家负载均衡已启用且自定义算子可用；动态专家负载均衡是运行中重新平衡专家工作的一种变体。若不满足这一条件，但启用融合且未启用动态专家负载均衡，则用 DeviceOperator（设备算子适配层）的融合入口；否则先生成整数矩阵乘结果，再调用激活与量化。两种融合路径和分开调用的路径最后都进入第二次矩阵乘。

源码还支持 **MXFP**，即一组低位浮点数共享尺度的量化方式，与本图的普通 W8A8 分开看：`use_mxfp_quant` 为真时，第 156 行的 `and not use_mxfp_quant` 会排除自定义融合；第 115 行的 `use_mxfp_quant or (fusion and not dynamic_eplb)` 则选中 DeviceOperator 融合入口，进入第 165 行的分支。这里列的是源码可选路径，实际部署是否命中变体需以运行配置和 trace 核实。

来源与结论对应如下；编号与页首 sources 的顺序一致：

- [S1] [CANN 8.0.RC2「基本架构」](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html)：三类计算单元、耦合/分离组织、AIC/AIV 经 GM 交接，以及两条矩阵结果路径。
- [C2] 固定提交 `add_rms_norm_bias.h:96–155`：逐行调用 CopyIn、Compute、CopyOutY，并在搬入阶段使用局部张量、队列和向量流水屏障，支撑搬运与同步的具体对照；完整追踪见[算子到 AI Core](op-to-ai-core.md)。
- [S3] [昇腾官方「流水优化」](https://www.hiascend.com/developer/techArticles/20240819-1) §02–03：三段流水、队列同步、double buffer 的空间与收益条件。
- [C4] 固定提交 `w8a8_dynamic.py:61–125`：整数权重、逐通道尺度、输入动态量化与量化矩阵乘，支撑稠密部分的软件入口说明。
- [C5] 固定提交 `moe_mlp.py:42–222`：自定义融合条件、两处输入校验、已有尺度的复用、MC2 下三种 gmm1 组织方式及 gmm2；流程图据此绘制。
- [C6] 固定提交 `w8a8_dynamic.py:353–365`：加载后转置、W8A8 专家 NZ 格式转换和权重尺度整理。
- [C7] v0.23 维护分支 `w8a8_dynamic.py:75–125`：动态量化及拆分分支；已与固定提交该文件逐项比对。
- [C8] v0.26 `w8a8_dynamic.py:74–124`：相同的动态量化与拆分分支条件。
- [C9] main `methods/w8a8/w8a8_dynamic.py:93–123`：移动后的路径、直接量化矩阵乘与加载后格式处理。

**待核：** 稠密 MLP 在固定部署实际命中的 apply 子分支、是否采用与共享专家相同的融合组织，还缺逐层调用追踪；主线底稿保留此项。专家融合各分支的实际命中情况、AIC/AIV 使用数量、流水重叠、内存事务量与吞吐/时延，缺目标镜像的运行 trace 和硬件实测。本页数字是形状与逻辑数据量，不提供硬件吞吐测量值。
