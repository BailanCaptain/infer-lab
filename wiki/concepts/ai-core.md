---
id: ai-core
title: AI Core：计算单元与数据搬运
type: concept
origin: direct
summary: >-
  从矩阵乘与逐项/归约运算出发，拆解昇腾 AI Core 内 Cube、Vector、Scalar 三类执行单元与各级片上缓冲（L1、L0A/L0B/L0C、UB）及搬运引擎（MTE、FixPipe）的分工；对照三级流水重叠与双缓冲条件，辨析 910B（A2/A3）AIC/AIV 经核外 GM 交接与昇腾 950（A5）L0C→UB 片上直通的架构差异。
aliases:
  - AI Core
  - AICore
  - Cube
  - Vector
  - Scalar
  - AIC
  - AIV
  - AI Cube
  - AI Vector
  - AI 核心
  - 计算单元与数据搬运
chapters:
  - '04'
order: 120
sources:
  - >-
    https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html
  - 'https://www.hiascend.com/developer/techArticles/20240819-1'
  - >-
    https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L155
  - >-
    vllm-ascend@c09d3e20:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L347
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L61-L125
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L365
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L42-L222'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L125
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L409-L453'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_dynamic.py#L74-L124
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L401-L445'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L148-L381'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L544-L588'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L60-L144
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L279-L542
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/shared_experts.py#L448-L540'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L172-L502'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L574-L615'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L60-L144
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/shared_experts.py#L146-L210'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 认识线性投影矩阵乘所需的输入行、权重列与乘加次数
  - to: mlp-residual-norm
    kind: builds-on
    note: 对照 RMSNorm 归约、残差相加与 SwiGLU 逐项门控怎样与矩阵乘交替出现
  - to: roofline-and-metrics
    kind: builds-on
    note: 用算术强度与 Roofline 屋顶判断当前阶段受限于 HBM 搬运带宽还是 Cube 峰值算力
  - to: hardware-devices
    kind: builds-on
    note: 先分清 NPU 裸片、板卡、服务器与四族硬件档案（A2/A3/310P/A5），再进入核内单元
  - to: device-memory
    kind: builds-on
    note: 区分主机内存与设备侧 HBM（GM）的容量及带宽边界
contradicts: []
updated: '2026-11-19'
---

**AI Core 是昇腾 NPU（执行模型张量运算的芯片）内部承担计算的核心模块，在同一套硬件原语中把矩阵乘加（Cube）、向量运算（Vector）、控制流（Scalar）与多级片上缓冲及搬运引擎组织在一起。** 当一条请求在[逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里通过[算子与 kernel 分层](ops-and-kernels.md)落到单张昇腾卡上时，[线性投影矩阵乘](matmul-and-weights.md)与 [RMSNorm、残差相加、SwiGLU 门控](mlp-residual-norm.md)并不会直接在[设备显存 HBM](device-memory.md) 里原地相乘，而必须先经搬运引擎分块装入紧挨计算单元的片上缓冲，算完后再按架构约定交接结果。

## AI Core 怎样把矩阵乘变成设备上的计算？

模型里最常见的一组动作是“先把输入向量和权重矩阵相乘，再对结果做逐项激活或整行归约”：前一步要做密集的行列乘加，后一步要做逐元素变换或求和统计，而且两步都必须先拿到操作数。AI Core 按运算形态把工作拆给三类执行部件与配套的存储搬运引擎：

```wiki-diagram
file: ai-core
```

首图按 CANN 8.0.RC2 的典型**分离架构**展开（矩阵侧核心叫 **AIC**，向量侧核心叫 **AIV**，两侧各自配有独立的 Scalar 控制单元与指令流；图中方框只表达功能分工，不代表实际芯片的核数或缓冲容量）。读懂这张图，关键是先分清“核外全局存储”与“核内片上缓冲”，再认准每类单元的职责边界：

| 硬件部件 / 存储层级 | 所在位置与职责 | 典型处理的运算或流向 | 初学者最易混淆的边界 |
| --- | --- | --- | --- |
| **GM 与核外 L2** | 设备侧全局内存空间（对应物理 HBM）及核外共享缓存，长期存放输入、权重、KV 与算子输出 | 算子读入源头与最终落盘终点 | `GM` 是单卡内部地址空间，不是跨卡通信网络 |
| **Cube 与 L1 / L0A / L0B / L0C** | 矩阵侧核心：操作数先入 `L1` 暂存，再拆入 `L0A`（左矩阵）与 `L0B`（右矩阵）喂给 **Cube** 做分块乘加，累加结果落入 `L0C` | 线性层 `GEMM`、专家 `Grouped MatMul`、注意力打分与加权乘 | `L0C` 常以更高位宽（如 `FP32` 或 `INT32`）保存累加值，防止低精度乘加中途溢出 |
| **FixPipe（图中写作 Fixpipe）** | 紧接 `L0C` 的随路后处理与写出引擎，负责量化尺度折算、类型转换与布局搬运 | 将 `L0C` 结果写回 `GM`（或可选写回矩阵侧 `L1`） | 在 910B 分离架构下，写回 `AIC` 的 `L1` **不等于**写进 `AIV` 的 `UB` |
| **Vector 与 UB（Unified Buffer）** | 向量侧核心：数据装入片上缓冲 **UB** 后，由 **Vector** 原地读写完成向量级指令 | 逐项激活（ReLU / SiLU）、类型转换、动态量化，以及求和/求最大值等**归约** | `Vector` 不仅能逐项计算，RMSNorm 求均方、Softmax 求行最大值都靠它归约 |
| **Scalar 与 MTE1 / MTE2 / MTE3** | **Scalar** 负责标量算术、分块地址计算与循环分支控制；**MTE**（Memory Transfer Engine）按指令异步搬运数据块 | `MTE2` 负责 `GM/L2 → L1/UB` 搬入，`MTE1` 负责 `L1 → L0A/L0B`，`MTE3` 负责 `UB → GM/L2` 写出 | 计算单元只消费片上缓冲里就绪的数据，等待 `MTE` 搬运完成同样计入真实耗时 |

## 为什么既要计算单元，也要片上缓冲？

既然权重与激活都已经放在设备显存 `GM` 里，为什么还要在核心内部再建一层只有百 KB 级的 `L1`、`L0` 与 `UB`？答案直接对应 [Roofline 模型](roofline-and-metrics.md)里的带宽墙：HBM 容量达数十 GB，但每次跨核外总线取数延迟高、带宽受限；片上 SRAM 容量虽小，却紧贴计算阵列、读写带宽远高于核外显存。

矩阵乘恰好具备极高的**数据复用潜力**：当同一块权重矩阵在 `L1` / `L0B` 中驻留时，多行输入向量（例如 Prefill 阶段的一批词，或拼批后的多条请求）可以反复拿这块权重做乘加，把一次 `GM → 片上` 搬运摊薄到成百上千次乘加运算上。反过来，因为片上缓冲容量有限，真实的巨型权重与长序列张量装不进单次缓冲，软件必须做 **Tiling（分块）**——先搬入第 0 块、计算、写出结果，再接力处理后续分块。

因此，AI Core 执行一个算子的真实代价从来不只是“一共做了多少次乘法（FLOPs）”，而是**核外访存字节数、片上缓冲占用空间，以及搬入—计算—写出各阶段之间的等待与同步**三者之和。尤其要注意层次边界：这里的 `GM ↔ L1 / UB` 搬运全部发生在一颗 NPU 内部；多张加速卡之间的张量汇聚与专家派发属于跨卡互联层，由 [CANN 与 HCCL](cann-hccl.md) 负责。

## 一块数据怎样经过矩阵计算和逐项计算？

### 矩阵结果如何交给向量侧？

**先由矩阵侧完成乘加得到中间向量，再把这份中间结果交接给向量侧做逐项或归约处理。** 用一组方便手算的**示意数**追踪首图的分离路径：设输入行向量 $x = [1, 2]$，权重矩阵 $W$ 的两行分别为 $[1, -1]$ 与 $[2, -2]$，矩阵乘之后接 $\text{ReLU}$（把负数截断为零的逐项激活函数；此处用 $\text{ReLU}$ 便于心算，GLM 实际采用的门控激活在后文双机一节交代）：

$$\mathbf{z} = xW = [1 \times 1 + 2 \times 2,\; 1 \times (-1) + 2 \times (-2)] = [5,\; -5], \qquad \mathbf{y} = [\max(5, 0),\; \max(-5, 0)] = [5,\; 0]$$

沿首图的存储与执行部件逐步对照，这组数在单颗 910B 分离架构 NPU 内的落点与数值变化如下：

| 流水步序 | 经手部件与存储落点 | 当前数据块数值（示意） | 硬件动作说明 |
| --- | --- | --- | --- |
| **① 矩阵侧备料** | `GM` $\xrightarrow{\text{MTE2}}$ `AIC L1` $\xrightarrow{\text{MTE1}}$ `L0A / L0B` | $x = [1, 2]$，$W = \begin{bmatrix}1 & -1 \\ 2 & -2\end{bmatrix}$ | 搬运单元先把输入行与权重分块搬入 `L1`，再拆进 `L0A`、`L0B` 供矩阵阵列就近读取 |
| **② 矩阵乘加** | `L0A / L0B` $\rightarrow$ **Cube** $\rightarrow$ `L0C` | 第 1 列 $1\times 1 + 2\times 2 = 5$；第 2 列 $1\times(-1) + 2\times(-2) = -5$ | **Cube** 完成行列配对乘加（数学规则见[矩阵乘与权重](matmul-and-weights.md)），`L0C` 接住累加结果 `[5, -5]` |
| **③ 跨侧交接** | `L0C` $\xrightarrow{\text{FixPipe}}$ `GM 中间区` $\xrightarrow{\text{MTE2}}$ `AIV UB` | 中间结果 `[5, -5]` | 走写回 `GM` 的交接路径时，**FixPipe** 把 `[5, -5]` 落盘到 `GM`；向量侧再经 `MTE2` 将它搬入片上缓冲 **UB** |
| **④ 逐项激活与写回** | `UB` $\leftrightarrow$ **Vector** $\xrightarrow{\text{MTE3}}$ `GM 输出` | $[\max(5, 0), \max(-5, 0)] = [5, 0]$ | **Vector** 在 `UB` 内逐项执行 $\text{ReLU}$ 得到 `[5, 0]`，最后经 `MTE3` 写回 `GM` |

上面的二元微型数组只用于看清“数据在哪准备、在哪算完、何时交接”，并不代表真实硬件矩阵指令的最小分块尺寸（实际 Cube 指令按固定分块粒度吞吐数据）。把同一组数放到下面的交互场景里按拍播放：先准备 `L1` 与 `L0A/L0B`，再由 Cube 算出 `[5, -5]` 存入 `L0C`；经 Fixpipe 写入 `GM` 中间区后，向量侧搬入 `UB` 执行 $\text{ReLU}$，最后把 `[5, 0]` 写回 `GM`。底座 NPU 模组上的格阵对应 `GM` 中的输入、权重、中间结果与输出并随写入实时更新；上方立体展开的各级缓冲与连线表达逻辑流向，而非裸片上的物理摆位。

```wiki-scene
inference-mechanism:3
```

### 一块向量的搬运与计算怎样配合？

**逐项计算与归约哪怕算术本身极简单，数据也必须一进一出跨越片上缓冲。** 单独拆出一个只看访存量的**示意小块**：假设向量侧处理 `4` 个 `FP32` 元素（每个 `FP32` 占 `32` 位即 `4 B`），做完一次逐项变换后仍写出 `4` 个 `FP32` 元素，则单块的逻辑读写字节数为：

$$\text{Bytes}_{\text{logical}} = \underbrace{4 \times 4\text{ B}}_{\text{装入输入 } 16\text{ B}} + \underbrace{4 \times 4\text{ B}}_{\text{写回输出 } 16\text{ B}} = 32\text{ B}$$

| 搬运方向 | 元素个数 × 单元素字节（示意） | 逻辑数据量 | 为什么不能直接除以峰值带宽算耗时？ |
| --- | --- | --- | --- |
| **CopyIn（装入输入）** | `4 × 4 B`（`FP32`） | `16 B` | 真实内存事务受最小突发粒度（如缓存行/对齐约束）、核外 `L2` 命中率与指令启动开销支配 |
| **CopyOut（写回输出）** | `4 × 4 B`（`FP32`） | `16 B` | 小块未满对齐宽度时会放大有效流量；单看 `FLOPs` 也测不出等待输入与落盘的停顿 |
| **单块读写合计** | `16 B + 16 B` | **`32 B`** | 必须结合分块尺寸、片上复用次数与流水重叠程度评估真实访存效率 |

同一块数据必须“先搬到、再计算、算完才能写出”，但**不同数据块的不同阶段可以在时间上重叠**。编写昇腾设备算子（kernel，即在 NPU 核心上实际执行的一段程序）的 **Ascend C** 编程模型把向量流水明确拆成 `CopyIn`（搬入）、`Compute`（计算）、`CopyOut`（搬出）三段，用队列（`TQue`）与流水屏障（`PipeBarrier` / 硬件事件标志）协调缓冲就绪与释放（完整算子追踪见[从算子到 AI Core](op-to-ai-core.md)中的融合归一化 kernel）。在此基础上，**双缓冲（`double buffer`，常称 Ping / Pong 缓冲）** 在片上同时开辟两份缓冲槽位：当计算单元正在处理 `Ping` 槽里的第 $k$ 块时，`MTE2` 可以同时往 `Pong` 槽预取第 $k+1$ 块。下图上半部分展示稳态三拍重叠的时间轴，下半部分集中排雷四个最常见的流水与交接误区：

```wiki-diagram
file: aicore-fig-pipeline-myths
```

对照上图时间轴，进入稳态拍 `T3` 后，`CopyIn`（搬第 2 块入 `Ping`）、`Compute`（算 `Pong` 中的第 1 块）与 `CopyOut`（把第 0 块从 `Ping` 写出后释放）在同一时间窗并行推进。但开启双缓冲有两条硬边界：① **空间减半**——同一容量下每份缓冲可用字节折半，若单块被迫切得过碎，指令与同步开销反而抬头；② **不突破物理屋顶**——双缓冲只能掩盖搬运与计算的串行气泡，让有效吞吐逼近 [Roofline](roofline-and-metrics.md) 的带宽斜坡或算力平顶，若算子本身已被计算塞满或总数据量极小，强开双缓冲未必更快。你可以在下方的交互实验室中切换分块与双缓冲，直接观察低比特矩阵乘与后继 `AddRMSNorm` 在 `AIC / AIV` 各级缓冲泳道上的气泡消长：

```wiki-tool
tool: aicore-lab
mode: single
title: 昇腾 AI Core 算子与流水线实验室
summary: 观察低比特矩阵乘与后继 AddRMSNorm 在 AIC / AIV 各级片上缓冲与搬运泳道上的流水重叠
```

## 耦合与分离架构，改变了哪一处交接？

**耦合架构把 Cube 与 Vector 收在同一核心内组织；分离架构则拆成独立的 `AIC`（矩阵核）与 `AIV`（向量核），各自拥有独立的 Scalar 控制单元与指令流。** 在 910B（Atlas A2）及同源分离组织的 Atlas A3 上，按 CANN 8.0.RC2 架构规范，`AIC` 的典型数据链是 `GM → L1 → L0A/L0B → Cube → L0C → FixPipe → GM`（`FixPipe` 也可选择写回矩阵侧 `L1`），`AIV` 则是 `GM → UB → Vector → UB → GM`——**注意 `FixPipe` 写回 `AIC` 的 `L1` 并不等于直接写进 `AIV` 的 `UB`**，跨核交接仍须走核外 `GM / L2` 并做跨核同步。到了新一代**昇腾 950（`AscendDeviceType.A5`）**，一个 AI 子系统集成了 `1` 个 Cube 与 `2` 个 Vector，打通了 **`L0C → UB` 片上直通通路**（含随路数值类型与数据排布转换）及 `L1 ↔ UB` 直接交换。下图把两代架构在同一组 `[1, 2] → [5, -5] → [5, 0]` 示意算例与 `v0.30.0` 软件档案下并排对照：

```wiki-diagram
file: aicore-fig-910b-vs-950
```

把上图中间那次跨侧交接放大为一个 `1024` 个 `FP32` 元素（`1024 × 4 B = 4096 B`）的**示意中间块**，两代硬件的物理通路与软件边界差异一目了然：

| 对比维度 | 910B / Atlas A2 & A3（分离 `AIC + AIV`） | 昇腾 950 / A5（CV 融合子系统） | 阅读与排障时的边界提醒 |
| --- | --- | --- | --- |
| **子系统组织与片上缓冲** | `AIC` 与 `AIV` 分立取指；具体核数、面积与缓冲容量随产品型号变化，不能拿首图框数外推 | 单子系统含 `1 Cube + 2 Vector`；白皮书标明 `L1` `512 KB`、`L0A/L0B` 各 `64 KB`、`L0C` `256 KB`、两个 `UB` 各 `256 KB`（共 `512 KB`） | 产品开放的实际核数按具体型号档位核对，见[硬件设备](hardware-devices.md)与[昇腾 950 的计算与搬运](ascend-950-architecture.md) |
| **Cube → Vector 中间交接** | `L0C → FixPipe → GM / L2 → MTE2 → UB`；`4096 B` 示意块产生 `4096 + 4096 = 8192 B` 逻辑 `GM` 读写 | `L0C → UB` 片上直通（可随路完成支持的精度与排布转换），省去中间块 `8192 B` 核外 `GM` 逻辑往返 | 原路径若命中核外 `L2 cache`，逻辑 `GM` 流量不等于真实外部 HBM 事务，不能直接除以带宽当提速倍数 |
| **缓冲复用同步与精度能力** | 显式流水事件标志协调跨阶段读写；原生主力低比特为 `INT8` / `W4A8` | 引入 `Buffer ID`（`get_buf` / `rel_buf`）按缓冲生命周期同步；Cube 原生新增 `FP8`、`HiF8`、`MXFP8`、`MXFP4` | 看到硬件支持 `FP8` / `FP4` 先查[低精度格式](low-precision-formats.md)核对元素位域、分组缩放与累加精度，类型列表不等于整网加速比 |
| **`v0.30.0` 框架档案选路** | `HardwareProfile` 归入 `STANDARD` 适配族，开启 `RUNTIME_CUSTOM_OPS` 加载自定义 C++ 融合算子库 | 归入 `FP8_OPTIMIZED` 适配族，启用原生 `MXFP` / `FP8` 融合能力，暂门控关闭 `vllm_ascend_C` 自定义算子库 | 这里的 `UB` 是核内 **Unified Buffer**；[CANN 与 HCCL 的 AI QoS 一节](cann-hccl.md#ai-qos-怎样处理共享链路上的争用)里的 **Unified Bus** 是超节点互联协议，仅缩写重名 |

## 放到 GLM 双机：一个 token 在卡上经历什么？

**请求走到 A4「[逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)」这一站时，每一层都在反复交替执行 Vector 归一化/量化、Cube 矩阵乘加与片上/核外数据搬运。** 这里沿用本站冻结场景绑定的[官方 GLM-5.3-Flash 双机部署前提](glm-5-3-flash-two-node.md#部署前提)（`2×A2×8`、`TP8/DP2/EP16`、`W8A8`），跟踪单个 token（分词后的一个文本片段，在层间表示为一行隐藏向量）在本卡上的执行分工：

1. **进入线性层或专家前（Vector 主导）：** 先由向量侧完成 `RMSNorm` 归约与逐元素缩放，再经 `npu_dynamic_quant` 算出 `INT8` 整数激活与每行动态缩放系数（`pertoken_scale`）。
2. **稠密投影与专家第一跳（Cube 主导）：** 稠密前馈层（MLP，以前馈投影与门控激活更新向量的子层）或按需选中的 MoE 专家把 `INT8` 激活与常驻 `GM`、已在加载期整理好分块格式的 `INT8` 权重搬入 `AIC`，由 Cube 完成乘加并结合尺度折算输出。
3. **门控激活、重量化与第二跳（Vector → Cube 接力）：** 中间结果经激活门控（如 `SwiGLU`）与再次量化后，重新交给第二次矩阵乘恢复隐藏维度。[从算子到 AI Core 的量化执行链](op-to-ai-core.md#归一化之后矩阵和向量执行段怎样接上)把这套矩阵段、向量段与搬运交接串成了完整的单卡算子链。

## 常见误解

- **AI Core 就是整张 NPU 卡，或者就等于 Cube？** 一颗 NPU 除多个 AI Core 外，还包含 HBM 控制器、核外 `L2`、AI CPU 与片间互联端口；Cube 只是核内负责矩阵乘加的计算单元，`AIC` / `AIV` 则是分离架构下的两类核心名称，三者处于不同硬件层级。
- **Vector 只会做 ReLU 这类逐项运算？** Vector 同样承担整行求和、求最大值等**归约**运算——[MLP、residual 与 RMSNorm](mlp-residual-norm.md) 里的均方根统计与注意力里的 Softmax 归一化都依赖 Vector 归约，逐项激活只是最易手算的入门例子。
- **算子名叫 `matmul`，就能看出用了几个 Cube 核？** Python 侧函数名只表达数学语义；实际切分给多少个 `AIC / AIV` 核心、每块多大、开不开双缓冲，取决于 Host Tiling 计算结果与设备侧 kernel 实现，必须查运行轨迹（trace）才能确认。
- **经 GM 交接就是跨卡通信？** 首图与 910B 分离交接都在同一颗 NPU 的本地地址空间内完成；跨卡张量并行归约与专家派发走另一层集合通信链路，主机内存与设备显存的分界见[主机内存与显存](device-memory.md)。
- **算子融合得越多、或者打开 `double buffer`，就一定更快？** 扩大融合或开启双缓冲都会挤占有限的片上 `L1 / UB` 容量；当单块数据太小或流水已被计算本身占满时，重叠收益抵不过分块切碎与同步开销，优化结论必须以同一输入、同一精度下的实测时延与访存证据为准。

## 对照源码

### 怎么开

AI Core 是芯片内的物理执行资源，框架没有所谓的“开启 AI Core”布尔开关；模型前向通过[算子与 kernel 分层](ops-and-kernels.md)把张量交给对应设备算子，由算子实现决定调用哪类核心与搬运路径。以稠密 `W8A8` 线性层为例，入口为 `AscendW8A8DynamicLinearMethod.apply`：未提前量化时先调 `torch_npu.npu_dynamic_quant` 生成 `INT8` 激活与每行尺度 `pertoken_scale`，再调 `torch_npu.npu_quant_matmul` 完成矩阵乘并按 `output_dtype` 输出（反量化可随路包含在算子内部，不代表每次都有独立反量化 kernel）。此外，`vllm_ascend/utils.py` 中的 `enable_custom_op()` 负责按需延迟加载自定义 C++ 算子扩展 `vllm_ascend_C`：在 `v0.30.0` 与 `main` 中，它通过 `get_current_hardware_profile().supports(HardwareCapability.RUNTIME_CUSTOM_OPS)` 判断当前硬件档案是否启用自定义算子库；`A2`、`A3`、`310P` 默认开启，而昇腾 950（`AscendDeviceType.A5`）因自定义算子编译执行仍在演进，当前门控返回 `False`，优先走 CANN 原生算子路径。

### 会报什么错

运行报错应顺着软件契约而非“硬件核心损坏”排查：
- 固定 GLM 提交的专家融合分支要求权重为单个张量或单元素列表，`_require_single_tensor_for_swiglu_quant` 收到多元素列表会抛出 `must be a tensor or a single-element list`。
- 分组矩阵乘的分组清单转换函数 `cumsum_group_list` 收到非法模式会报 `group_list_type should be in [0, 1, 2]`。
- 若容器内安装的 `vllm-ascend` 编译目标与宿主机物理芯片代际不一致（如把 `A2` 包跑在 `A5` 设备上），初始化检查会触发断言 `Current device type ... does not match the installed version's device type`。

### 开销和什么时候别开

权衡重点集中在格式转换时机、片上缓冲占用与多流重叠边界：
- **权重分块格式转换只在加载后执行一次：** `process_weights_after_loading` 会将 `W8A8` 线性层与专家权重转置，并转为适配 Cube 分块读写的 `ACL_FORMAT_FRACTAL_NZ` 格式（线性层经 `maybe_trans_nz`，专家层对 `w13_weight`、`w2_weight` 调 `npu_format_cast`）同时展平尺度张量；这是启动期一次性开销，不能算进每个 token 的前向耗时。
- **双缓冲与多流预量化各有适用前提：** `double buffer` 属于 kernel 内部实现选择，并无证据表明模型每个算子都无条件受益；而在 `v0.30.0` 与 `main` 中，`AscendW8A8DynamicLinearMethod.prepare_input_for_overlap` 构造的 `PreparedLinearInput` 主要由 [共享专家多流重叠](moe.md#版本差异)（`shared_experts.py` 在 `shared_experts_calculation_stream` 上提前跑完 AIV 动态量化，供 `apply` 直接复用量化值与尺度）消费，并非全模型线性层无条件提前量化，也不能由 Python 调用次数直接反推物理 kernel 数。

### 版本差异

硬件的耦合或分离组织由芯片代际决定，软件升级不会把 910B 变成 950，但 `vllm-ascend` 的硬件档案抽象、`vllm_ascend_C` 门控与 `W8A8` 线性/专家入口在四个主干版本间有明确演进。历史冻结 3D 场景与下方 `MC2` 执行分支图继续钉住 **GLM 专用提交 `db701c1f`**（其 `w8a8_dynamic.py`、`moe_mlp.py` 与 `utils.py` 行为同 `v0.23.0`，额外包含配套 `vllm@0fc695fc` 的 GLM 模型代码）；四版本对照矩阵如下：

| 核对维度 | `v0.23.0` (`2c59ff10`) | `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| **`W8A8` 线性层路径与调用** | `methods/w8a8_dynamic.py`；`apply` 含内部 `_chunk_size` 检查（缺省 `0` 不拆两次矩阵乘） | 路径同左；保留相同 `_chunk_size` 分支与缺省 `0` 行为 | 迁入 `methods/w8a8/w8a8_dynamic.py`；移除 `_chunk_size` 拆分，新增 `prepare_input_for_overlap` 返回 `PreparedLinearInput` | 延续 `w8a8/w8a8_dynamic.py` 单次 `npu_quant_matmul` 与 `PreparedLinearInput` 接口 |
| **共享专家与 MoE `gmm1/gmm2` 组织** | 专家 `MC2` 三路 `gmm1` 分支集中在 `ops/fused_moe/moe_mlp.py` | 线性入口一致，专家融合细节随分支演进 | `moe_mlp.py` 收敛为统一调度器 `apply_moe_mlp`，`W8A8` 的 `apply_gmm1_act_quant` / `apply_gmm2` 迁回方案类；`shared_experts.py` 在辅助流复用 `PreparedLinearInput` | 延续方案类分发，并在 `shared_experts.py` 新增面向 `A5` `MXFP8/MXFP4` 的 `MegamoeSharedExpertFusion` |
| **昇腾 950（`A5`）硬件档案与 `vllm_ascend_C` 门控** | `utils.py` 的 `enable_custom_op()` 直接判断 `get_ascend_device_type() == AscendDeviceType.A5` 硬编码关闭自定义算子 | 同左，在 `utils.py` 直接按 `AscendDeviceType.A5` 置 `_CUSTOM_OP_ENABLED = False` | 抽离 `device/hardware_profile.py`：`A2/A3` 归 `STANDARD` 并含 `RUNTIME_CUSTOM_OPS`；`A5` 归 `FP8_OPTIMIZED` 且不含 `RUNTIME_CUSTOM_OPS`，由 `enable_custom_op()` 查档案关闭 | `HardwareProfile` 新增 `WeightFormat` 枚举，为 `A5` 显式登记 `FP8/HIF8/MXFP8/MXFP4` 与 `CANN_MEGAMOE_SHARED_EXPERT_FUSION`；`A5` 的 `RUNTIME_CUSTOM_OPS` 仍保持关闭 |

### 源码位置

下图聚焦历史绑定提交 `db701c1f` 的专家 **MC2** 分支（MC2 将跨卡专家派发、收回与本卡计算流水配合起来，容量门槛见[主线 MoE 通信小节](one-request.md#moe-通信走-mc2-还是-allgather)）。**`gmm1` / `gmm2`** 分别指第一次、第二次分组矩阵乘（`grouped matmul`）；图中的 `scale_bias` 与 `offset` 为量化修正项，此处只展开二者为空的常规分支：

```wiki-diagram
file: ai-core-execution
```

读图时先看派发后的输入是否已带量化尺度，再看 `gmm1` 走哪条执行路径：对普通 `W8A8` 分支，当“开启融合、启用动态专家负载均衡（`dynamic_eplb`）且自定义算子可用”同时满足时走自定义融合算子；否则若启用融合且未开 `dynamic_eplb`，则走 `DeviceOperator` 融合入口；其余情况先由 `npu_grouped_matmul` 产出 `INT32` 累加结果，再接激活与动态量化。源码同时支持共享块尺度的 **`MXFP`** 分支：`use_mxfp_quant` 为真时，`moe_mlp.py` 第 156 行的 `and not use_mxfp_quant` 排除自定义融合，而第 115 行的 `use_mxfp_quant or (fusion and not dynamic_eplb)` 命中第 165 行的 `DeviceOperator` 融合入口；三条路径最终都汇入 `gmm2` 恢复隐藏维度（在 `v0.30.0` 与 `main` 中，这组 `W8A8` 分支被封装进 `AscendW8A8DynamicFusedMoEMethod.apply_gmm1_act_quant` 与 `apply_gmm2`）。

页首 `sources` 与正文结论逐条对应如下：

- [S1] [CANN 8.0.RC2「基本架构」](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html)：Cube/Vector/Scalar 职责、耦合与分离架构、`AIC/AIV` 经 `GM` 交接及 `FixPipe` 写回 `GM` 或 `L1` 的路径。
- [S2] [昇腾官方「流水优化」](https://www.hiascend.com/developer/techArticles/20240819-1) §02–03：`CopyIn/Compute/CopyOut` 三段流水、队列同步与 `double buffer` 的片上空间及收益边界。
- [S3] [《昇腾 950 NPU 架构白皮书》](https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf) 物理第 17–25 页：`1 Cube + 2 Vector` 子系统、`L1/L0/UB` 容量、`L0C → UB` 随路转换直通与 `Buffer ID`（`get_buf`/`rel_buf`）同步机制。
- [C4] `db701c1f` `add_rms_norm_bias.h:96–155` 与 [C5] `c09d3e20` `add_rms_norm_bias.h:96–347`：逐行调用 `CopyIn`、`Compute`、`CopyOutY`，配合 `LocalTensor`、`TQue<QuePosition::VECIN, BUFFER_NUM>`、`PipeBarrier<PIPE_V>` 与 `HardEvent::V_MTE2` 实现片上搬运与同步；完整核内走读见[从算子到 AI Core](op-to-ai-core.md)。
- [C6] `db701c1f` `w8a8_dynamic.py:61–125` 与 [C7] `w8a8_dynamic.py:353–365`：固定 GLM 提交的稠密 `W8A8` 动态量化线性入口，以及权重加载后转置与专家 `ACL_FORMAT_FRACTAL_NZ` 格式转换。
- [C8] `db701c1f` `moe_mlp.py:42–222`：两处输入校验报错、`MC2` 下三种 `gmm1` 路径、`MXFP` 分支条件与 `gmm2` 汇合逻辑，`ai-core-execution` 图据此绘制。
- [C9] `2c59ff10` `w8a8_dynamic.py:75–125` 与 [C10] `2c59ff10` `utils.py:409–453`：`v0.23.0` 线性层 `_chunk_size` 分支及 `enable_custom_op()` 对 `AscendDeviceType.A5` 的直接门控。
- [C11] `2ed6cbba` `w8a8_dynamic.py:74–124` 与 [C12] `2ed6cbba` `utils.py:401–445`：`v0.26.0rc` 保持相同的线性层 `_chunk_size` 检查与 `A5` 自定义算子关闭逻辑。
- [C13] `c09d3e20` `hardware_profile.py:148–381` 与 [C14] `c09d3e20` `utils.py:544–588`：`v0.30.0` 建立四族 `HardwareProfile`，`A2/A3` 归 `STANDARD` 并开启 `RUNTIME_CUSTOM_OPS`，`A5` 归 `FP8_OPTIMIZED` 并经档案门控关闭 `vllm_ascend_C` [I]。
- [C15] `c09d3e20` `w8a8/w8a8_dynamic.py:60–144`、[C16] `w8a8/w8a8_dynamic.py:279–542` 与 [C17] `shared_experts.py:448–540`：`v0.30.0` 移除 `_chunk_size`、引入 `PreparedLinearInput` 供共享专家辅助流提前执行 AIV 量化，并将专家 `gmm1/gmm2` 迁回方案类。
- [C18] `8d6180e2` `hardware_profile.py:172–502`、[C19] `utils.py:574–615`、[C20] `w8a8/w8a8_dynamic.py:60–144` 与 [C21] `shared_experts.py:146–210`：`main` 增补 `WeightFormat` 原生低比特枚举与 `A5` `MegamoeSharedExpertFusion`，保持 `PreparedLinearInput` 与 `RUNTIME_CUSTOM_OPS` 门控一致。
- [A] 正文 `x = [1, 2]` 乘矩阵接 $\text{ReLU}$ 为手算示意算例 [A]，`4` 个与 `1024` 个 `FP32` 元素为搬运教学块设定；对应的 `[5, -5] → [5, 0]`、`32 B` 向量读写 [D] 与 `8192 B` 中间块逻辑往返 [D] 均由设定直接算出，不代表实测带宽事务或硬件最小指令块。

**待核：** 稠密 MLP 在固定 GLM 部署下实际命中的 `apply` 子分支及是否采用与共享专家一致的融合组织，仍缺逐层调用追踪（主线底稿保留此项）。专家融合各分支的线上命中率、`AIC / AIV` 实际并发核数、双缓冲流水重叠率、核外真实内存事务量以及端到端吞吐/时延收益，均须以目标镜像的运行 trace 与硬件实测补齐；本页给出的字节数为张量形状与逻辑搬运账，不替代硬件吞吐实测值。
