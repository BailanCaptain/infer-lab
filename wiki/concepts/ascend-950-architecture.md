---
id: ascend-950-architecture
title: "昇腾 950：一块数据怎样少绕路、少等候"
type: concept
origin: direct
summary: 沿矩阵结果交给向量计算的小例，理解昇腾 950 的 Cube/Vector 直通、多维搬运与缓冲同步；再区分 SIMD/SIMT、存储层次、低精度和 PR/DT 规格，把硬件能力变成可验证的推理分析假设。
aliases: [Ascend 950, Ascend950, 昇腾950, 950PR, 950DT, A5, DaVinciCore, CV融合, Cube Vector融合, NDDMA, BufferID, Buffer ID, SIMD, SIMT, 950 Unified Buffer, 950 L0C, UMA, DVPP, CMO, AI CPU, Vector Function]
chapters: ["07", "19"]
order: 125
sources:
  - https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L178-L179'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L824-L859'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L170-L171'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L786-L821'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L333-L381'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L561-L561'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L240'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_mxfp8.py#L54-L60'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L441-L499'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L128'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L35-L215'
relations:
  - { to: ai-core, kind: builds-on, note: Cube、Vector、Scalar 与矩阵乘算例由原页解释，本页聚焦 950 的新增通路 }
  - { to: device-memory, kind: builds-on, note: 主机与设备、容量与带宽、权重和 KV 的基本记账继续复用原页 }
  - { to: low-precision-formats, kind: builds-on, note: 元素编码、分组、缩放和文件精度的唯一解释出处 }
  - { to: hardware-devices, kind: builds-on, note: 部署前确认完整产品型号，不把芯片、卡和服务器当成同一层 }
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
contradicts: []
updated: '2026-11-26'
---

**昇腾 950 是执行模型计算的 NPU 芯片。理解它的一个入口，是看一块数据怎样搬到计算单元、怎样交给下一段计算，以及什么时候能够复用原来的缓冲。** 新的通路与指令可以减少绕行和控制工作；是否让请求更快，要看软件是否使用它，以及省下的工作是不是正在拖慢请求。

```wiki-diagram
file: ascend-950-plate-cutaway
```

## 矩阵已经算完，下一步为什么还会等

模型的一段计算可以先做矩阵乘，再逐项处理结果。**Cube** 负责矩阵乘加，**Vector** 负责逐项运算和求和等向量运算；数据必须从前一段交到后一段。**GM** 是设备全局内存空间，保存大张量；**L1、L0、UB** 是计算单元附近较小的片上缓冲，用来暂存正在处理的数据。这里 UB 是 Unified Buffer。

沿用 [AI Core 的小例](ai-core.md#矩阵结果如何交给向量侧)：输入 [1,2] 与权重相乘，得到 [5,−5]，随后用 ReLU 把负数变为零，得到 [5,0]。乘加过程留在原页；这里追踪同一组数经过哪些地方。

```wiki-diagram
file: ascend-950-cv
```

输入与权重从 GM 进入矩阵侧 L1，再经 L0A、L0B 送给 Cube，结果放在 L0C。950 的内部通路可以把这份矩阵结果直接交给向量侧 UB；Vector 读到的仍是 [5,−5]，计算后才变为 [5,0]，再保存最终输出。**CV 融合**就是把 Cube 与 Vector 的执行段和交接组织在一起；直通不会替它们完成彼此的计算。

如果走“矩阵结果写到 GM，Vector 再从 GM 读入”的交接路径，就多了一次中间结果的写与读。直通减少的是这段绕行，输入仍要搬入，最后的输出仍要按需要保存，Vector 也仍须等结果就绪。950 还支持 L1 与 UB 的直接交换；本图只展开结果从 L0C 到 UB 的一条路径。

这些工作位于[单请求第 4 站的逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。排队、计算和输出交付都影响首字等待；先定位到算子内部的交接，再讨论这条通路才有意义。

## 少一次交接，究竟少了什么

把首图的两个数扩展为一个教学结果块：假设有 1024 个 FP32 元素，每个占 4 字节，而且结果必须完整交给下一段 Vector。先只算中间交接的逻辑数据量：

$$B_{\text{block}} = 1024 \times 4\text{ B} = 4096\text{ B}, \qquad B_{\text{GM-roundtrip}} = 4096\text{ B} + 4096\text{ B} = 8192\text{ B}$$

| 中间交接口径（1024 个 FP32 元素示意） | 算式 | 逻辑字节数 |
| --- | --- | --- |
| 单份中间结果大小 | $1024 \times 4\text{ B}$ | **4,096 B** |
| 经 GM 写出再由向量侧读入 | $4096\text{ B} + 4096\text{ B}$ | **8,192 B** |

采用内部交接后，可以省去这条 GM 路径上的逻辑写出和读入，但仍要把 4096 B 的结果送到 UB。逻辑 GM 访问不等于实际外部内存事务：**L2 cache** 是缓存近期数据的一层存储，原路径可能已经命中它。因此不能直接宣称“必定少读写外部内存 8192 B”，更不能拿这笔数除以标称带宽当作实测提速。

另外，L0C 和 UB 都有容量限制。**分块**是把大计算拆成放得下的小块，**同步**是让消费结果的一段等生产者完成。放大块要权衡两项变化：若同一批数据被重复利用，能少搬几次；若缓冲被占满，其他工作能同时执行的空间就会缩小。判断融合收益要同时记录中间块大小、实际搬运、各段等待与结果精度。

## 数据不连续时，NDDMA 怎样把它搬整齐

**NDDMA** 是多维直接内存搬运引擎。程序描述各维有多少项、相邻项隔多远，由硬件生成地址，把规律分布的数据搬到目标布局。它减少的是为每个小片段反复计算地址、发起搬运和整理布局的工作；不改变这些数本来的含义。

换一个只看搬运的教学小矩阵。GM 中按行存着两行数：[10,11,12,13] 和 [20,21,22,23]；本次只要每行前两项。它们在各自行内相邻，但两行所需片段之间夹着不需要的数。目标是把 [10,11]、[20,21] 紧凑排进 UB，再交给 Vector 使用。

```wiki-diagram
file: ascend-950-nddma
```

从 0 开始数位置，把一个元素的大小暂记为一份地址单位。源矩阵换一行要跳 4 份，目标 UB 换一行只跳 2 份。令 $r$ 为行号、$c$ 为该行选取部分的列号，二者都只取 $0, 1$；源偏移与目标偏移分别为：

$$\text{offset}_{\text{src}}(r, c) = 4r + c, \qquad \text{offset}_{\text{dst}}(r, c) = 2r + c$$

以第二行首元素 $(r=1, c=0)$ 为例，源偏移为 $4 \times 1 + 0 = 4$、目标偏移为 $2 \times 1 + 0 = 2$；把四个元素的搬运映射排在一起（示意）：

| 元素坐标 $(r, c)$ | 源偏移 $4r + c$ | 读到的数值 | 目标 UB 偏移 $2r + c$ |
| --- | --- | --- | --- |
| $(0, 0)$ | $0$ | `10` | $0$ |
| $(0, 1)$ | $1$ | `11` | $1$ |
| $(1, 0)$ | $4$ | `20` | $2$ |
| $(1, 1)$ | $5$ | `21` | $3$ |

这就是布局变化：数没变，位置变得适合下一段使用。实际地址还要加基地址、乘元素字节数，并符合接口的对齐约束。白皮书说明 NDDMA 可做最多五维的重排，由 GM 搬到 UB；内置缓存可把元素级读取组织成 128 B 读取。上面的四个数只说明地址映射，既不是一次指令的最小工作量，也不是四次真实内存事务。

若换布局后结果错了，先给输入填入这种能认出原位置的值，分别比源坐标、源步长、目标步长与边界。比如 UB 第一行正确、第二行却是 [12,13]，就应检查是否把源行步长误填成 2。这个反例比“数据搬运有问题”更接近能验证的原因。

## 下一块能不能覆盖这块缓冲，谁来保证

搬完第一块并不意味着缓冲可以立即复用。Vector 还在读 [10,11,20,21] 时，如果下一次搬运把它覆盖成另一块，计算就会混用两批数据。这类错误随并发和执行次序变化，地址和公式都正确也排除不了。

950 的 **Buffer ID** 同步机制给缓冲的占用与释放一个明确标识。程序按使用次序请求使用该缓冲，完成本段操作后释放，再让下一段取得使用权。白皮书中的搬运与计算例子依次是：搬运段取得缓冲、搬入并释放；Vector 取得同一缓冲、计算并释放；下一轮才能按约定复用。

```wiki-diagram
file: ascend-950-buffer
```

旧式流水标志需要显式表达“搬运完成通知计算”“计算完成通知下一轮搬运”等关系。Buffer ID 把组织方式更集中地放在存储的使用周期上；消费者仍须等生产者交出数据，下一次覆盖仍须等旧数据使用结束。它不保证两个阶段自动重叠，更不意味着可以提前释放尚在使用的缓冲。

现场若只在重叠执行时出错，可以固定输入，比较保守串行实现与重叠实现，并记录同一缓冲标识在各流水段的取得、使用和释放次序。串行结果正确而重叠错误，只支持继续检查同步和生命周期；同时变更了分块、精度或布局时，还要分别排除这些差异。double buffer 的通用原理继续见 [AI Core](ai-core.md#一块向量的搬运与计算怎样配合)。

## Vector 为什么同时提供 SIMD 和 SIMT

**SIMD（Single Instruction Multiple Data，单指令多数据）**用一条指令对一组数据执行同一种操作。比如首图对 [5,−5] 一起取与零的较大值，规则一致，适合成组处理。**SIMT（Single Instruction Multiple Threads，单指令多线程）**以多个线程描述工作，每个线程有自己的位置和控制状态，更容易表达不同元素走不同分支、访问不同位置的部分。

例如按索引 [3,0,2] 从数组取数，读到的地址不连续；再按每个元素的条件决定下一步，控制过程也不一样。程序可以把这种部分交给 SIMT 表达，把后续规则的逐项计算交给 SIMD。它们描述如何组织计算，不改变索引和算式应该得到的结果。

950 以 SIMD 为主、SIMT 为辅。它把一段向量代码组织为 **Vector Function（VF）**，一个 VF 可选其中一种方式，两类 VF 之间可以切换。硬件提供选择，算子作者仍需权衡访存是否集中、分支是否分散、切换和同步要花多少时间。看到“支持 SIMT”不能据此预测所有算子都会更快。

## 大内存、缓存、核内缓冲分别解决什么

前面的 UB 只暂存当前块，不负责装下整个模型。950 在同一封装内集成两个 **AI Die**（计算晶粒）和两个 **IO Die**（通信晶粒），并连接高速内存模块。白皮书把封装整体描述为 **UMA（Uniform Memory Access，统一内存访问）**的整体；软件仍要区分数据放在哪一层、路径经过哪里。

| 层次 | 在前面例子中的用途 | 容易混淆的地方 |
| --- | --- | --- |
| 设备全局内存空间 | 长期保存权重、输入、输出和请求状态 | 能装下多少与每秒能搬多少不同；基本预算见设备内存页 |
| L2 cache | 缓存访问的数据，减少反复访问更远的内存 | 命中率与访问模式有关，标称容量不是一定能留住的有效数据量 |
| L1、L0A/B/C | 给 Cube 准备操作数、保存累加结果 | 是具体计算块的资源，不能拿整芯片内存容量替代 |
| Unified Buffer 与寄存器 | 给 Vector 存当前块和计算中间值 | 不是互联协议 Unified Bus；两者都常缩写为 UB |

白皮书中容量达到 GB 的“高速片上内存”与 AI Core 内的 KB 级 SRAM 缓冲属于不同层次。**SRAM** 是这里核内小容量高速存储的实现类型。后面的规格表分开列，避免把一个词“片上”理解成所有数据都放在 UB 附近。

950 的 L2 以 512 B 缓存行为单位，又分为四个 128 B 的 sector，即可分别处理的子块；它支持软件提供缓存使用提示。对马上还会重复使用的数据，可以争取保留；对只扫一遍的大块数据，可避免把其他有用内容挤走。提示是帮助缓存管理的手段，不把“已发提示”当成“全部命中”。

**CMO（Cache Maintenance Operation，缓存维护操作）**包括预取、写回、失效等不同动作。预取适合提前准备之后会用的数据；写回和失效处理缓存状态，作用不同。是否值得做，要比较命中、有效搬运和这些操作本身的开销，不能把所有 CMO 都理解成加速读取。主机与设备、权重与 KV 的容量账继续使用[设备内存](device-memory.md)的分工。

```wiki-diagram
file: ascend-950-fig-simd-simt-memory
```

## 图片还没交给模型时，哪些单元已经在工作

[生产案例](deepseek-serving-case.md#上传一份带图长文服务要接力做什么)中的图片，进入视觉编码器（Vision Encoder）以前还要准备成像素与合适的尺寸。950 的 **DVPP（Digital Vision Pre-Processing，数字视觉预处理子系统）**专门承担硬件级图像编解码和预处理：其中 `JPEGD` 把压缩的 JPEG 文件解成原始图像数据，`VPC`（视觉预处理核心）完成缩放、裁剪与填充，`JPEGE` 则负责编码回 JPEG。它们处理的只是图像像素与尺寸；随后的视觉编码器才运行神经网络，把像素变成语言模型可读的特征向量。

例如上传一张 JPEG 后，首字迟迟不来，而模型计算核心大部分时间空闲。应先沿“读到图片 → 解码完成 → 尺寸与格式准备好 → 图像模型开始”记录时间。如果慢在前两段，就不能只靠增加文本生成资源解决。需要同时保留图片尺寸、格式、处理路径和队列等待；用相同图片比较实现时，还要检查准备好的像素是否一致。设备具备 DVPP，只说明存在硬件路径，实际服务也可能在主机上完成预处理。

芯片内还有 **AI CPU**，负责通用控制工作，并可执行 CPU 类算子；它与主机 CPU、矩阵计算的 Cube 都不是同一资源。看到 AI Core 空闲，只能说明这类计算核心没有忙起来，不能据此排除设备内部的控制、图像准备或数据搬运瓶颈。要把各段准备与执行接起来，继续看[950 调度与互联](ascend-950-execution-interconnect.md)。

## 低精度增加了算力，为什么还要核对搬运和转换

950 的 Cube 增加了 HiF8、MXFP8、MXFP4 等低位数值计算能力；这些格式怎样解释数值、共享缩放系数，统一见[低精度格式](low-precision-formats.md)。这里关心它们进入计算和离开计算的哪一段。

白皮书同时描述了 L0C 到 UB 的随路格式转换：把结果送给 Vector 时，可以完成支持的数值转换与数据排列转换。例如累加结果与下一段输入可以使用不同类型，软件须按这条路径约定准备缩放和布局。若原来有独立转换，合并后就少一道执行段；若转换后的类型更小，也会减少交接字节。具体采用哪条路径要看实际 **kernel**，即设备上执行该算子的程序。

把“磁盘权重是 FP8”“设备中权重是 FP8”“矩阵乘采用 FP8”“累加结果是 FP8”混在一起，会同时算错容量和误差。诊断时分别记录文件、加载后张量、算子输入、累加和输出类型；已有 A2/A3 文件兼容与实际计算的对照在格式页，本页不再复制。

在 vLLM Ascend `v0.30.0` 与 `main` 源码中，昇腾 950 对应 `AscendDeviceType.A5` 硬件档案（`HardwareProfile`，框架按芯片代际登记硬件能力的配置类）。以全站标尺 **`Qwen3-8B`** 与 **`Qwen3-30B-A3B`** 为例：社区常见的分块 8 位浮点权重（`block-wise FP8`）在 `v0.30.0` 下若跑在 `910B`（A2/A3）上，会被反量化回 `BF16` 计算；而在 950（`A5`）上，`AscendFp8BlockLinearMethod` 会将其重组为原生 `MXFP8` 直接送入 Cube，使 `Qwen3-30B-A3B` 的权重驻留维持在约 `30 GiB` 量级，单颗 `950DT`（`96 / 144 GB` 内存、`4 TB/s` 带宽）即可整模装下并启用 `FP8_ATTENTION`、`CANN_MEGAMOE_MXFP`、`DYNAMIC_MX_QUANT_FUSION` 等能力。注意一处版本差异：`v0.30.0` 的 A5 档案尚未开启运行时自定义算子库（`RUNTIME_CUSTOM_OPS`，`enable_custom_op()` 直接返回关闭），直到 `main` 才将该能力补回 A5 档案。

下面用结构剖面图对照 910B 分离核绕行 GM 与 950 CV 融合子系统 L0C→UB 直通，并按同比例条展示 950PR/DT 内存带宽差距与软件档案演进：

```wiki-diagram
file: ascend-950-architecture-fig-cv-vs-910b
```

## PR 与 DT 的规格，怎样读才不串成一款产品

下面集中维护白皮书中的产品规格。斜线表示该产品家族列出的不同规格值；白皮书没有在这张表内为每个组合给出完整型号，不能跨行任意配成一款产品。例如 DT 核数有三档、内存容量有两档，不宜仅按斜线顺序强行配对。采购与部署应以[完整产品型号](hardware-devices.md)确认实际档位。

| 规格项 | 昇腾 950PR | 昇腾 950DT |
| --- | --- | --- |
| Cube / Vector 数量 | Cube 32/28；Vector 64/56 | Cube 36/32/28；Vector 72/64/56 |
| 封装内存模块数 | 8 | 4 |
| 内存容量 | 128/112 GB | 144/96 GB |
| 内存带宽 | 1.6/1.4 TB/s | 4 TB/s |
| L2 容量 | 128/112 MB | 128 MB |
| Cube+Vector 峰值，MXFP4 | 1784/1561 TFLOPS | 2007/1784/1561 TFLOPS |
| Cube+Vector 峰值，HiF8/MXFP8/FP8 | 919/804 TFLOPS | 1034/919/804 TFLOPS |
| Cube+Vector 峰值，BF16/FP16 | 486/425 TFLOPS | 547/486/425 TFLOPS |
| Cube+Vector 峰值，INT8 | 919/804 TOPS | 1034/919/804 TOPS |
| 仅 Cube 峰值，MXFP4 | 1730/1513 TFLOPS | 1946/1730/1513 TFLOPS |
| 仅 Cube 峰值，BF16/FP16 | 432/378 TFLOPS | 486/432/378 TFLOPS |
| 仅 Vector 峰值，FP32 | 27/23 TFLOPS | 30/27/23 TFLOPS |
| Unified Bus 互联 | 72 路最高 112 Gbps HiLink，分成 18 个端口；标称 2016 GB/s 双向，出框速率受光模块约束 | 同左 |
| UBoE | 2×400 Gbps，与 Unified Bus 共用 2 个端口 | 同左 |
| PCIe | 5.0×16，128 GB/s 双向，与 Unified Bus 共用 4 个端口 | 同左 |

**TFLOPS** 表示每秒万亿次浮点运算，**TOPS** 表示每秒万亿次运算；表中是不同数值类型、不同计算范围的标称峰值。Cube+Vector 的总值不能填进只测矩阵乘的利用率分母；双向互联值也不能当成单方向的持续可用带宽。UBoE 是把 Unified Bus 接入以太网络的方式，端口共用关系意味着各行峰值不能直接相加。

核内缓冲按另一种单位与范围读。白皮书的一个 AI 子系统包含一个 Cube 和两个 Vector；L1 为 512 KB，L0A、L0B 各 64 KB，L0C 为 256 KB；两个 Vector 各有 256 KB 的 UB，合计 512 KB。表中实际开放的核数随产品规格变化，不能把完整设计所述 36 个子系统当成每款 PR 都有 36 个 Cube。

这些值帮助判断容量上限与资源压力。它们不能直接给出某模型的 token/s：请求还要读取权重和 KV、执行向量与转换、等待同步和跨卡通信；负载和实际软件路径都影响最终表现。

这里的互联规格只用于核对产品；设备任务、通信卸载和远端访问怎样影响等待，继续见[950 调度与互联](ascend-950-execution-interconnect.md)。

## 从业者怎样把白皮书变成排查假设

先保留产品型号、驱动与 **CANN**（昇腾算子、编译与运行时软件栈）版本、框架提交、模型文件、输入形状与精度，再在同一输入上确认实际调用的算子和 kernel。**Trace** 是记录执行事件与时间的轨迹；结合 kernel 的分块配置和性能分析工具的搬运、计算指标，才能判断等待发生在哪一段。

```wiki-diagram
file: ascend-950-observe
```

假设一段算子在两种实现中得到相同结果，内部路径的设备时间从 12 μs 降为 9 μs；这是**教学观测**。它支持这段实现更快，还要看 trace 中它是否原来就挡住后续工作。如果请求总等待没变，应继续查其他阶段和重叠关系；不能因白皮书支持 CV 直通就继续扩大融合范围。

| 现象与候选 | 一次改变什么来区分 | 哪种证据支持下一步 |
| --- | --- | --- |
| 矩阵完成后，Vector 长时间等输入；怀疑交接绕行 | 在支持的算子中比较相同块、相同精度的两条交接实现 | 中间搬运与等待下降且结果一致，才支持继续评估 CV 路径 |
| 布局转换花时多；怀疑细碎地址计算和搬运 | 固定源/目标布局，比较已有搬运实现与 NDDMA 实现 | 先逐坐标比值，再比转换时间与真实事务；小块未改善时保留原路径 |
| 只在流水重叠时错数；怀疑缓冲提前复用 | 同分块同精度做串行与重叠对照 | 首次错误对应同一缓冲的读写重叠，才进一步修占用/释放次序 |
| 降精度后不快或结果异常；怀疑转换抵消或格式错配 | 固定同组输入，比较各段类型、scale 与首次数值差异 | 分清合法舍入、格式错误与独立转换开销，再决定格式或实现 |

这些是可操作的取证方向，并非框架已经提供同名开关。若当前工具拿不到核内缓冲事件，可先比较串行参考与中间张量；若没有能切换的 kernel，也先停在已确认的路径与时间上。完整的客户端延迟和达标吞吐验收继续用[性能测量](inference-benchmarking.md)。

## 放回 GLM 双机，哪些分析能用、哪些事实要重查

本站固定主线仍是[官方双机 2×A2×8](glm-5-3-flash-two-node.md#部署前提)。它同样要搬入、计算、交接、保存；可以复用本页按阶段取证、区分逻辑字节与实际事务、对照串行与重叠的分析方法。

950 的直通、NDDMA、Buffer ID 和产品规格属于另一代硬件，不能把它们写成现有 A2 kernel 已采用的路径。固定 GLM 的实际算子入口与分块逻辑见[算子到 AI Core](op-to-ai-core.md)；若迁到 950，需重新核对目标镜像、算子、模型与通信组合，再建立同负载的正确性和性能基线。

## 常见误解

- **“结果直达 UB，输入输出就不用搬了。”** 减少的是指定中间交接；输入准备、最终保存和依赖等待仍在。
- **“NDDMA 能替任何离散访问自动提速。”** 它依据配置生成多维地址；实际布局、数据量、对齐和事务效率决定收益。
- **“Buffer ID 已经同步，所以可以提早复用。”** 同步正确依赖取得、使用和释放的次序，未完成使用就覆盖仍会错。
- **“统一内存访问意味着所有位置延迟一样。”** 统一访问的组织与数据经过的缓存、晶粒和搬运路径是两回事。
- **“支持 MXFP4，就把峰值除以模型运算数得到吞吐。”** 还要确认格式、算子和运行路径，并计入访存、向量、转换与通信。

## 对照源码

### 怎么开

本页的依据是硬件架构白皮书，不提供通用环境变量。CV、NDDMA、SIMD/SIMT 和 Buffer ID 由目标代际的算子与编译路径使用；先确认所调用 kernel 的目标硬件、分块和指令路径。Buffer ID 的 `get_buf` / `rel_buf` 在白皮书图 4-8 中表示取得和释放；不能把该示意直接当成任意 CANN 版本可复制的 API 配方。

### 会报什么错

加载或编译阶段的目标硬件、类型、接口不匹配，要保存完整版本与算子入口；运行中的错数则要保留第一处不一致的源坐标、目标坐标、scale 或缓冲使用次序。白皮书没有给出框架报错字符串，本页不据此编造“见到某条报错就对应某单元故障”的映射。

### 开销和什么时候别开

优先验证当前关键路径中的候选：很小的块可能不值得增加布局转换；融合可能占更多片上空间；同步或分支仍可成为等待；低精度要支付支持路径所需的缩放与转换。为排错保留简单串行、高精度或原有搬运对照，性能结论则回到同一到达负载的端到端验收。

### 版本差异

白皮书快照核实了 950 硬件架构机制与 PR/DT 规格，不替代驱动/CANN/框架兼容矩阵；固定 GLM 执行侧 `db701c1f` 对应本库 A2 双机主线，不能用 950 能力反推 A2 路径。以下按知识库四版本正式钉点核对 vLLM Ascend 中对昇腾 950（`AscendDeviceType.A5`）的软件档案与低精度路径演进：

| 核对维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 950 / A5 设备识别与档案抽象 | 仅在 `utils.py#L178-L179`、`#L824-L859` 定义 `AscendDeviceType.A5` 与 `is_950()`；无统一 `HardwareProfile` | 延续 `utils.py#L170-L171`、`#L786-L821` 枚举判断 | 引入集中式 `HardwareProfile`（`device/hardware_profile.py#L333-L381`），A5 声明 `FP8_OPTIMIZED` 适配器、`FP8_ATTENTION`、`CANN_MEGAMOE_MXFP`、`DYNAMIC_MX_QUANT_FUSION`、`DSV41_PACKED_CACHE`、`NPUGRAPH_EX` 等能力 | 扩展 A5 `HardwareProfile`（`device/hardware_profile.py#L441-L499`），显式声明 `native_weight_formats=_FP8_WEIGHT_FORMATS` 与 `requires_2d_nz_linear_input=True`，新增 `CANN_MEGAMOE_SHARED_EXPERT_FUSION` 等 |
| `RUNTIME_CUSTOM_OPS` 开关 | `enable_custom_op` 在 `utils.py#L426` 硬编码跳过 `AscendDeviceType.A5` | 同左（`utils.py#L418`） | `enable_custom_op` 改查 `HardwareCapability.RUNTIME_CUSTOM_OPS`（`utils.py#L561`），**A5 档案在 `v0.30.0` 仍未开启 `RUNTIME_CUSTOM_OPS`**（仅含 `AUTO_ENABLE_CUSTOM_OPS`） | **A5 档案补回 `HardwareCapability.RUNTIME_CUSTOM_OPS`**（`hardware_profile.py#L490`），解除运行时自定义算子拦截 |
| 原生 `MXFP8` 与 block-wise FP8 路径 | 无原生 `fp8_block` 重组路径 | 无原生 `fp8_block` 重组路径 | 注册 `W8A8_MXFP8`（`w8a8_mxfp8.py#L54-L60`）；`AscendFp8BlockLinearMethod` 在 `is_950()` 下将 block-wise FP8 重组为 `MXFP8`（`fp8_block.py#L178-L240`），非 A5 则反量化回 `model_dtype` | 延续 `W8A8_MXFP8` 与 A5 重组路径；`fp8_block.py#L114-L128` 改为查 `supports_weight_format(WeightFormat.FP8)`，非 A5 直接抛 `NotImplementedError` |
| CV / NDDMA / Buffer ID / SIMD-SIMT 内核实测 | 未逐算子核实底层核内指令路径 | 同左 | 白皮书硬件能力未逐 kernel 映射到框架开关；需结合具体 CANN 与算子 trace 确认 | 同左 |

### 源码位置

来源 [S1] 是华为《昇腾 950 NPU 架构白皮书》，2026-10-26 从页首官方地址取得，PDF 共 40 页。以下统一使用 **PDF 物理页码**，即阅读器从第一页开始计数，避免与目录中的章节页码混用：

- 第 12 页图 3-1、第 13–15 页表 3-1：两个 AI Die、两个 IO Die、UMA、内存模块、PR/DT 核数和峰值、内存、L2 与端口共用关系。
- 第 17 页图 4-1 与第 25 页表 4-2：一个 Cube、两个 Vector 及 L1/L0/UB 的容量；图中两个 256 KB UB 对应表内合计 512 KB。
- 第 17–22 页 §4.1.1–4.1.4、图 4-6：低精度、L0C→UB 随路转换、SIMD/SIMT 与 VF、L1↔UB 及矩阵结果内部交接。没有引用文中的代际提升倍数作为本站推理实测。
- 第 22–24 页 §4.1.5–4.1.6、图 4-7/4-8：NDDMA 多维地址、GM→UB、最多五维、128 B 读取，以及 Buffer ID 的取得/释放示例。
- 第 25–27 页 §4.3：内存层次、L2 缓存行/sector、缓存提示与 CMO；不能把这些能力等同于实际模型命中率。
- 第 24 页 §4.2、第 28–29 页 §4.5：AI CPU 的控制与计算职责，DVPP 的 JPEGD/VPC/JPEGE 分工。图片等待的取证顺序是本站分析，不声明 DeepInfer 或本站 GLM 服务已采用 DVPP。
- vLLM Ascend 四版 A5 设备识别、`HardwareProfile`（`RUNTIME_CUSTOM_OPS` 演进）与原生 `MXFP8` / `fp8_block` 路径对应 `vllm-ascend@2c59ff10:vllm_ascend/utils.py#L178-L179`、`#L824-L859`，`vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L170-L171`、`#L786-L821`，`vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L333-L381`、`utils.py#L561`、`quantization/methods/w8a8/fp8_block.py#L178-L240`、`w8a8_mxfp8.py#L54-L60`，以及 `vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L441-L499`、`fp8_block.py#L114-L128`。[C6][C8][C10][C11]
- [A] 首图复用 AI Core 页的微型矩阵算例；1024 个 FP32 元素、二维数组和 12→9 μs 均为教学设定。[D] 8192 B 与源/目标偏移由这些设定推导，无设备性能实测。

**待核：** 具体 950 产品型号的驱动/CANN 配套、目标模型与各算子支持、实际采用的 CV/NDDMA/Buffer ID/SIMD/SIMT 路径、真实内存事务及服务收益。软件缺口须用目标镜像与运行记录补齐，白皮书不替代这些证据。
