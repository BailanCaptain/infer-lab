---
id: op-to-ai-core
title: 从算子到 AI Core：分工、融合与分块
type: concept
summary: >-
  在 A4 逐层前向中，算子怎样分成矩阵与向量执行段，Host 怎样划分工作，设备怎样搬入、计算、写回；以 GLM 实际 RMSNorm
  路径和可选残差融合分支对照说明。
aliases:
  - 算子链路
  - AscendRMSNorm
  - AscendGemmaRMSNorm
  - npu_add_rms_norm_bias
  - AscendC
  - op_kernel
  - op_host
  - tiling
  - tiling key
  - UB
  - 算子四层
chapters:
  - '16'
order: 20
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2129-L2169'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L768'
  - 'vllm@0fc695fc:vllm/model_executor/custom_op.py#L110-L207'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py#L63-L88'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L409-L467'
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L19-L108
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.cpp#L23-L71
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L155
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L167-L208
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/add_rms_norm_bias_torch_adpt.h#L21-L50
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L208-L222
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L373-L411
  - >-
    https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html
  - 'https://arxiv.org/abs/1910.07467'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L75-L126
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L113-L220'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layernorm.py#L63-L88'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/layernorm.py#L63-L86'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/layernorm.py#L64-L84'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L409-L467'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L401-L459'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L521-L579'
  - >-
    raw:sha256-aff81f9c6042e3957465a5c11de61e00df90aaeb7fb0374c9e78093ed5f01635.md#L1-L1057
  - 'vllm-ascend@7d825229:vllm_ascend/ops/layernorm.py#L83-L103'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L544-L588'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L94-L134
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L225-L349
  - >-
    vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L29-L107
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/layernorm.py#L81-L102'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L544-L588'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L250-L382'
  - >-
    vllm-ascend@c09d3e20:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L19-L108
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/layernorm.py#L81-L120'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L574-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L430-L501'
  - >-
    vllm-ascend@8d6180e2:csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp#L19-L108
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ops-and-kernels
    kind: builds-on
    note: 先区分算子接口与设备核函数
  - to: mlp-residual-norm
    kind: builds-on
    note: RMSNorm 的数学定义与残差结构
  - to: one-request
    kind: builds-on
    note: 回到 A4 逐层前向核对真实形状与通信
  - to: prepare-inputs-flow
    kind: builds-on
    note: 往前追踪 A3 的块表、槽位和注意力元数据
  - to: ai-core
    kind: builds-on
    note: 算子执行段的分工、分块与交接建立在 AI Core 的计算单元和存储搬运机制之上。
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-9cd315276f36a94063a7beec730fc38d97d240379e7e59507b5df5afb6850116.md
  - >-
    raw/sha256-aff81f9c6042e3957465a5c11de61e00df90aaeb7fb0374c9e78093ed5f01635.md
---

## 一次算子调用，卡里究竟谁在干活？

**算子规定要算什么，kernel 是设备上执行它的程序；AI Core 是 NPU 计算芯片中承担计算的核心。** 把算子落到 AI Core，就是把运算拆成适合硬件的执行段，安排数据搬运，再让各段按依赖完成。

```wiki-diagram
file: op-to-aicore-plate-cutaway
```

例如，矩阵乘后接激活：先把输入与权重对应相乘、累加，再对结果里的每个数做非线性变换。**Cube** 是擅长矩阵乘加的计算单元；**Vector** 是处理逐元素运算、归约等工作的向量单元。归约就是把一组数汇成一个数，例如求和。一个融合算子可以把这两类执行段组织在一起。

另一种运算 **RMSNorm** 会先求一行数的均方，用它的倒数平方根调整尺度，再乘逐通道权重，输出仍与输入同宽。它需要归约和逐元素处理，计算结构与矩阵乘不同：放在同一张卡上，不代表都交给 Cube。

```wiki-diagram
file: op-to-ai-core-intuition
```

图中的箭头表示前一段产出的数据要交给后一段。矩阵与向量单元怎样组织、数据经过哪些存储，见 [AI Core](ai-core.md)。本页挂靠主线 [A4：逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)，接下来追踪执行段之间怎样交接。

## 为什么要分块和融合，代价在哪？

**数据要先到计算单元能读取的位置，计算才会开始。** 设备全局内存保存大张量；片上缓冲区只容纳当前正在处理的一部分。输入太宽或行数太多时，需要分块搬运和计算。分块要付出搬运、循环和同步的成本：后一段依赖的结果还没准备好，就必须等待。

**融合主要改变相邻运算怎样组织。** 原来先做残差相加、再做归一化，两次调用之间可能要写出并重读一份结果；融合让同一实现接着使用已经取得的数据，可能减少重复访问与单独下发。这里残差指绕过子层、留待相加的输入，详细数学关系见 [MLP、残差和归一化](mlp-residual-norm.md)。

不过，融合仍要保存后续计算需要的结果。仓库中的残差融合扩展实际分配 **3 份输出张量**：归一化结果、每行的缩放统计量、更新后的残差；第三份在搬入并相加后就写回全局内存。因此省多少访问，要逐个张量看它还会不会被使用。融合也会增加片上临时空间压力，可能改变分块。

这与把工作分给多张卡是两个层次：本页的分块、搬运与等待发生在设备执行内部。跨卡通信在模型需要合并各卡结果时发生，次数由模型与并行方案决定，见 [A4 主线](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。

## 融合分支改变的是执行组织

**融合前后要保留相同的数学目标，改变的是如何下发、搬运和存放中间结果。** 给归一化同时传入当前向量 x 与残差 residual 时，先相加得 s，再归一化。设每行宽 H，逐通道权重为 γ，ε 是防止除零的小数：

```text
s = x + residual
r = 1 / sqrt(sum(s[j]²) / H + ε)
y[j] = s[j] × r × γ[j] + bias[j]   # 没有 bias 时省去末项
返回 y 与更新后的残差 s
```

**不传 residual 时，令 $s = x$，仍按上面的 $r$、$y$ 两式归一化。** 此时接口只返回 $y$，不返回更新后的残差。

用两元素向量走一次数据交接（数为示意）：$x=[1,3]$、$\text{residual}=[1,-1]$、$\gamma=[1,1]$，无 bias。为便于手算，这个非零输入取 $\varepsilon=0$，真实模型使用自己的 $\varepsilon$。先得到 $s$，再由整行算出同一个 $r$，最后逐元素缩放：

$$s = x + \text{residual} = [2, 2], \qquad r = \frac{1}{\sqrt{(2^2 + 2^2)/2}} = 0.5, \qquad y = s \cdot r \cdot \gamma = [1, 1]$$

| 步骤（示意，无 bias，$\varepsilon=0$） | 算式 | 结果 | 数据去向 |
| --- | --- | --- | --- |
| 更新后残差 $s$ | $[1 + 1,\; 3 - 1]$ | **`[2, 2]`** | 写回全局内存供后续层复用 |
| 整行均方 | $(2^2 + 2^2) \div 2$ | **$4$** | 片上中间标量 |
| 缩放因子 $r$ | $1 \div \sqrt{4}$ | **$0.5$** | 片上中间标量 |
| 归一化输出 $y$ | $[2 \times 0.5 \times 1,\; 2 \times 0.5 \times 1]$ | **`[1, 1]`** | 交给下一算子 |

后续计算收到的 $y$ 是 $[1,1]$，保留的残差 $s$ 是 $[2,2]$。它们用途不同，不能拿其中一份替代另一份。上面的式子表达数学语义，真实低精度执行还要核对中间转换和舍入误差。

**边界与例外**：自定义扩展可用时，带 `residual` 的路径调用残差加归一化加偏置的融合接口；不可用则退回已有残差归一化接口，有 bias 时再补加法。扩展是否启用还受批不变性模式（约束不同批次下数值一致性）、设备类型与加载结果影响，具体判断见页末源码区。若模型子层不传 `residual`，则只传一个张量、不进该融合分支。

## Host tiling：把张量任务划给设备

**Host 是主机侧；tiling 是按输入形状与硬件资源制定的分块规划。** 张量隐藏宽不变时，本批包含的 token（文本分词后的单元）数决定输入行数；主机侧必须算出把哪些行或列块交给哪些核、每轮搬入多少数据，再把这份分块计划打包送入设备任务队列，由设备侧 AI Core 真正生成运算结果。

下面这张四段流水图把带残差融合扩展 `npu_add_rms_norm_bias` 从 Python 入口到 AI Core 片上执行串成完整链路（无 residual 分支则直调 `torch_npu.npu_rms_norm`）：

```wiki-diagram
file: op-to-ai-core-fig-execution-pipe
```

Python 调用先进入 C++ 适配层，预分配三份输出（`y`、`rstd` 与更新后残差 `s`），再经 `EXEC_NPU_CMD(aclnnAddRmsNormBias, ...)` 交由 **CANN**（昇腾算子与运行时软件栈）衔接主机规划与设备执行。

主机 tiling 读取可用向量核数与片上 **UB（Unified Buffer）** 容量，按行数、行宽、FP16/FP32/BF16 精度和是否有 bias 挑模板（普通、沿宽拆分、合并多行等），生成每核范围与临时空间参数。分块阈值随精度和偏置改变，元素总数相同也须重挑模板。无编译对象时查平台、有编译对象时读其记录；UB 容量须先扣预留空间，剩余部分才分给数据块。

行分配先按「总行数 $\div$ 可用向量核数」向上取整得普通核配额，再求实际启用核数，末核接余行。以 10 行、4 个可用向量核为例（宽度与精度满足模板条件）：

$$\text{former} = \lceil 10 \div 4 \rceil = 3\text{ 行}, \qquad \text{used\_cores} = \lceil 10 \div 3 \rceil = 4, \qquad \text{tail} = 10 - 3 \times (4 - 1) = 1\text{ 行}$$

| 分核参数（示意：10 行，4 个可用向量核） | 计算公式 | 结果 | 说明 |
| --- | --- | --- | --- |
| 普通核行配额 | $\lceil 10 \div 4 \rceil$ | **3 行** | 前 3 核依次算第 0–2、3–5、6–8 行 |
| 实际使用核数 | $\lceil 10 \div 3 \rceil$ | **4 个核** | 若仅 2 行分 4 核则配额为 1、只启 2 核 |
| 尾核行数 | $10 - 3 \times (4 - 1)$ | **1 行** | 第 4 核处理第 9 行 |

**每核分几行与每轮搬几行是两次划分。** 每轮搬入行数还看行宽、精度、偏置与 UB 余量；普通模板按范围循环，末轮只算余行。设备入口读主机编码的 **tiling key** 跳进对应模板；源码阈值仅是该实现的空间安排，不是整颗 NPU 的固定内存上限，读 key 应对照模板而非背编码。

另须区分 A3 准备输入的缓存块：block table（历史缓存块表）与 slot mapping（新槽位映射）用于注意力读写 KV cache，构造见[准备输入](prepare-inputs-flow.md)；本节 tiling 只划当前算子的计算任务，不动缓存块。

## 设备侧：搬入、归约、缩放、写回

**设备按分块参数循环执行「搬入 → 归约缩放 → 写出」三段流水：**

- **CopyIn**：搬入 `x` 与 `residual` 至片上，做残差相加并写回更新后的残差。
- **Compute**：对整行做平方和归约、加 $\varepsilon$、求倒数平方根，再逐元素缩放。
- **CopyOut**：写出归一化结果，并在对应循环末尾保存缩放统计量 `rstd`。

沿用 `[2,2]` 残差和：缩放必须等归约就绪，代码靠同步屏障与事件保序；低精度模板还在局部缓冲转精度，片上占用大于输入张量本身。这是 Vector 上的归约与逐元素算子；矩阵乘接激活涉及 Cube 与 Vector 交接，不能把算子接口等同于单个硬件单元。Scalar 管控制、搬运单元管传输，完整硬件路径见 [AI Core 算子实验室](ai-core.md#一块数据怎样经过矩阵计算和逐项计算)。

## 怎样判断优化是否成立

先核对语义与数值误差，再看分派、精度、布局和 tiling，最后测设备耗时、访存与端到端收益。重点确认：省掉哪些读写与下发、片上临时空间涨多少、哪些形状能命中。源码定路径与公式，真实加速比须同输入同环境实测。

## 复杂异构实战对照：GLM 双机的 RMSNorm 与算子执行链路

### GLM 实际从哪里调用 RMSNorm

**与单路残差不同，GLM 用 mHC 管理多路残差：进子层前先把多路残差混成单输入，再走不带 residual 的 RMSNorm**（结构见[层与隐藏表示](layers-and-hidden.md)）。沿用[双机部署前提](glm-5-3-flash-two-node.md#部署前提)：2 台 A2 各 8 卡、TP8/DP2/EP16、W8A8（适用层用 8 位整数，归一化保持自身精度）。

跟随[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)（prompt 4 token，教学设定）：A3 备好 token、位置、块表、槽位与注意力元数据；A4 注意力用寻址信息，归一化直读当前层张量（见[准备输入页](prepare-inputs-flow.md)与 [ops-and-kernels](ops-and-kernels.md)）。

**每个解码层在输入与注意力后各有一处 RMSNorm。** 两处都先经 `hc_pre` 得到输入，再单参调归一化。设备分派进 `AscendRMSNorm.forward_oot`：无 residual 分支直调 `torch_npu` RMSNorm，有 bias 再补加偏置。下图把实际路径与带 residual 融合扩展放在同一分叉处对照（C++ 输出 `y`、`rstd` 为归一化结果与缩放统计量）：

```wiki-diagram
file: op-to-ai-core
```

#### 归一化之后，矩阵和向量执行段怎样接上

**稠密层的量化线性层先量化当前输入，再做整数矩阵乘并恢复输出精度。** 激活动态量化会为输入行产生整数值和缩放系数；矩阵乘使用这些系数及权重系数，产出调用者需要的浮点结果。当前 W8A8 线性实现既有普通权重路径，也有按加载时设置拆成两次矩阵乘再拼接的路径，不能只数一次 Python 的线性层调用就断言只有一个 kernel。

**MoE** 把一个前馈网络换成一组可选择的专家网络，每个 token 只交给选中的几个专家。走到这里，先把 token 派到选中专家的持有卡；每张卡再按专家把收到的行分组计算。**grouped matmul** 就是一次接口处理多组“输入行与对应专家权重”的矩阵乘。使用 MC2（把专家派发/收回交给融合通信算子的路径）且第一组权重没有额外缩放偏置与量化偏移时，专家计算有“矩阵乘与激活融合”及“先矩阵乘、再激活量化”的分支。

本部署每卡有 18 个路由专家。设 `rows` 为派发后本卡待处理的行数，输入每行 4096 维。第一组矩阵乘输出两路、合计 4096 维；**SwiGLU** 对其中一路做 SiLU（逐元素平滑非线性激活），再把它作为门与另一路逐元素相乘，得到 2048 维。最后第二组矩阵乘把它变回 4096 维。完整形状与专家分布统一见 [R1 的 MoE 站](one-request.md#42-层-moe每卡-18-个专家)。第一张图中的“矩阵执行段 → 向量执行段”对应这里的矩阵乘和门控激活。

若派发已经产生量化值和动态缩放系数，专家计算直接使用，不重复量化；否则先量化。每个专家接多少行来自派发结果，不能把 R1 的 4 个 prompt token 当成每个专家都收到 4 行。之后的收回、合并与跨卡等待见[主线的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)。

#### 一行中间结果，写出再读回是多少

**宽度和精度决定逻辑数据量，是否能省掉访问要看结果是否还被使用。** 取本部署隐藏宽度 4096，BF16 每个数 2 B。仅考虑一个 token 的一行中间结果，假设它原先要单独写出再读回：

$$M_{\text{row}} = 4096 \times 2\text{ B} = 8{,}192\text{ B} = 8\text{ KiB}, \qquad M_{\text{rw}} = 8\text{ KiB} + 8\text{ KiB} = 16\text{ KiB}$$

| 逻辑访问项（单 token，隐藏宽 4096，BF16） | 算式 | 逻辑数据量 |
| --- | --- | --- |
| 单行张量大小 | $4096 \times 2\text{ B} = 8{,}192\text{ B}$ | **8 KiB** |
| 写出 + 读回一次往返 | $8\text{ KiB} + 8\text{ KiB}$ | **16 KiB** |

16 KiB 的统计范围仅为这一份中间张量的逻辑读写；其他输入输出另计，总线访问还受缓存命中和访问合并影响。只有相应的写出与重读都被消除，这笔逻辑流量才会省下；残差融合扩展仍须写回更新后的残差。R1 整批的形状、字节和通信次数仍以 [A4 主线](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)为唯一出处。

同样的“中间结果是否写出再读”问题也用于比较[昇腾 950 的计算与搬运](ascend-950-architecture.md)。先用本页辨认实际 kernel 和中间张量，再查目标硬件能提供哪种交接路径；有硬件路径不代表当前算子已经采用。

## 常见误解

- **运行在 NPU 就一定用 Cube？** RMSNorm 的主体是向量归约和缩放；矩阵乘与激活融合才涉及矩阵、向量两类执行段。判断分工要看运算和具体模板。
- **模型有残差，就会调用残差融合归一化？** GLM mHC 在归一化之前已混合出子层输入，实际只传一个张量；有没有 residual 实参才是此处的分支条件。
- **融合后所有中间结果都留在片上？** 需要交给后续层的残差仍会写回；局部空间不足时也需要分块搬运。
- **tiling 是再给请求分配一次 KV 块？** 前者安排当前算子的工作，后者安排历史缓存位置；A3 的块表与槽位交给注意力使用。
- **两个 RMSNorm 乘层数，就是前向的 kernel 总数？** 子层之外还有归一化和状态处理，一次算子调用也可能拆成多个 kernel；真实启动次数需要设备 profiling，即记录设备上实际执行事件的性能分析。

## 对照源码

### 怎么开

本页没有一个“使用 AI Core”的总开关。vllm-ascend 注册 `RMSNorm → AscendRMSNorm`，上游 CustomOp 根据启用状态选择设备方法 `forward_oot` 或本地实现；本页流程图以进入设备方法为前提。固定 GLM 调用 `input_layernorm(layer_input)` 与 `post_attention_layernorm(layer_input)`，均不传 residual。

这里还要区分实现类与执行方法。创建组件对象时，CustomOp 查询 OOT 注册表；OOT 指框架主仓之外提供的平台实现。注册表中存在对应名字，就使用登记的实现类，否则仍使用原来的类。对象初始化时，就根据启用状态和平台选好并保存执行方法；随后每次前向直接调用已保存的方法，不在这一层重新做动态选择。因此，登记了平台实现类，并不等于初始化时一定选择设备方法。

固定执行提交 `db701c1f` 的 `enable_custom_op()` 是延迟初始化判断：`VLLM_BATCH_INVARIANT` 开启或设备为 A5 时返回 false，其余条件下尝试加载扩展。A2 不命中该设备禁用条件，最终仍取决于扩展能否加载；无 residual 的 RMSNorm 不需要进入这一残差融合选择。Python 的 CustomOp 设备分派与 C++ 扩展能否加载是两层不同判断。

### 会报什么错

固定提交扩展加载失败时会记录 `Failed to register custom ops, all custom ops will be disabled.`，随后这一带 residual 分支退回 `torch_npu.npu_add_rms_norm`，有 bias 再相加。这里的回退只说明 RMSNorm 此分支的行为，其他算子要逐个检查。扩展 Host 还检查输入输出形状，不合要求记录 `Input shape invalid.` 并返回失败；负 ε 也返回失败。

### 开销和什么时候别开

性能核对顺序是：先检查 y 与残差 s 的数值及误差，再确认精度、权重布局、实际分派和 tiling，最后记录 kernel 时间、内存访问与端到端时延。局部空间压力或受限形状可能抵消融合收益；小批次下，下发和同步也可能占明显比例。保留已有回退适合先排查兼容性，但 main 的分支已经变化，见下一节。

C++ 适配层通过 `EXEC_NPU_CMD(aclnnAddRmsNormBias, ...)` 交给运行库。由此只能定位执行入口；没有设备轨迹时，不给出具体 kernel 数量、占用率或加速比例。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）。**`v0.30.0` 的 `AscendRMSNorm` 残差分支曾去掉 `torch_npu.npu_add_rms_norm` 回退并直接调用 `npu_add_rms_norm_bias`，到了 `main` 又重新恢复了 `if enable_custom_op()` 的回退分支**（以便 `VLLM_BATCH_INVARIANT` 下走 `batch_invariant.py` 补丁版 `npu_add_rms_norm`）。四版 `csrc/moe/add_rms_norm_bias/` 的 AscendC Host tiling 与 `aclnnAddRmsNormBias` 下发链路保持连续；新增预量化输入复用见 [共享专家调用时点](moe.md#版本差异)。

| 核验维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 无 `residual` 路径 | `torch_npu.npu_rms_norm`，有已加载 `bias` 再相加 | 同 `v0.23.0` | 同 `v0.23.0`（`layernorm.py#L97-L101`） | 同 `v0.23.0`（`layernorm.py#L101-L105`） |
| 有 `residual` 分支 | 按 `enable_custom_op()` 在 `npu_add_rms_norm_bias` 与 `torch_npu.npu_add_rms_norm` + `bias` 间二选一 | 同 `v0.23.0` | `layernorm.py#L88-L95` 直接导入 `vllm_ascend_C` 调 `npu_add_rms_norm_bias`，**无 `false` 回退** | `layernorm.py#L88-L99` **恢复 `if enable_custom_op()` 分支**，关闭时回退 `torch_npu.npu_add_rms_norm` + 逐元素 `bias` |
| 扩展能力门控（`enable_custom_op`） | 延迟加载；批不变或 A5 禁用 | 同 `v0.23.0` | `utils.py#L544-L588` 查 `HardwareCapability.RUNTIME_CUSTOM_OPS`；`hardware_profile.py` 对 A5 仍禁用 | `utils.py#L574-L618` 查 `RUNTIME_CUSTOM_OPS`；`hardware_profile.py#L490` 为 A5 恢复该能力 |
| 无 `residual` 后权重预取钩子 | 调用预取后处理方法 | 已移除 | 无此钩子 | 无此钩子 |
| AscendC Host tiling 与 GLM 代码位置 | 含 `csrc/moe/add_rms_norm_bias/`；维护分支不含 GLM5 代码 | 同 `v0.23.0` | 保留 `add_rms_norm_bias_tiling.cpp`（457 行）；GLM 位于 `models/glm5next/`；W8A8 迁入 `quantization/methods/w8a8/` | 延续 `add_rms_norm_bias_tiling.cpp`（457 行）与 `models/glm5next/`；`AscendGemmaRMSNorm` 改为直接调用 `npu_add_rms_norm` / `DeviceOperator` |

固定双机执行使用的 `db701c1f` 是含 GLM 专用代码的独立 orphan commit，不能写成维护分支版本号；它在 RMSNorm 分派、扩展门控及预取钩子方面与 `v0.23.0` 列一致。控制侧另钉 `vllm@0fc695fc`；本文 Host tiling / kernel 逐行走读以 `db701c1f` 源码为准，实际 kernel 数量、总线流量和延迟仍需设备 trace 核定。

### 源码位置

来源序号对应页头 sources，角标在此集中标出代表入口；同组的补充源码共同覆盖该行结论。

| 要核的结论 | 来源索引与位置 |
|---|---|
| 矩阵/向量分工、AIC/AIV 分离架构、典型内存路径 | 来源 14：[CANN 基本架构](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html)。[S14] |
| RMSNorm 均方缩放语义 | 来源 15：[RMSNorm 原论文](https://arxiv.org/abs/1910.07467)；融合残差与 bias 是本页另核的实现组合。[S15] |
| GLM 的两个单参数调用、注册与分派、残差/bias 分支 | 来源 1–5：glm5_next.py 2129–2169、2212–2235；utils.py 735–768；上游 custom_op.py 110–207；layernorm.py 63–88。[C5] |
| Host 按精度、UB、核数与形状选择模板，key 分派 | 来源 7、8、12、13、28：op_host/add_rms_norm_bias_tiling.cpp 的常量、资源读取、行分配与模式选择；op_kernel/add_rms_norm_bias.cpp 23–71。[C7] |
| 普通核行配额、尾核行数与设备循环 | 来源 28 的 CalculateBlockParameters、DetermineModeParameters；来源 29 的 Init、Process 和 SubProcess。10 行与 2 行算例按这些公式推导，非设备实测。[D] |
| 三份输出、搬入时残差写回、归约与缩放顺序 | 来源 9–11：add_rms_norm_bias.h 96–155、167–208；add_rms_norm_bias_torch_adpt.h 21–50。[C9] |
| W8A8 线性层动态量化与矩阵乘分支 | 来源 16：quantization/methods/w8a8_dynamic.py 75–126。[C16] |
| MC2 专家路径：已有量化结果复用、融合/拆分、第二组矩阵乘 | 来源 17：ops/fused_moe/moe_mlp.py 113–220。[C17] |
| 四版本残差分支、预取钩子、扩展门控与 tiling 核验 | 来源 18–23（`v0.23.0`/`v0.26.0rc`）；来源 30–33（`v0.30.0` `c09d3e20` `layernorm.py#L81-L102`、`utils.py#L544-L588`、`hardware_profile.py#L250-L382`、`add_rms_norm_bias_tiling.cpp#L19-L108`）；来源 34–37（`main` `8d6180e2` 对应四处）；固定提交加载失败完整逻辑见来源 6。[C34] |

**待核：** 固定镜像中稠密 MLP 实际命中的 apply 分支、是否采用激活融合，以及 MoE 的实际融合/拆分路径、设备 kernel 数量、流量和加速幅度，仍缺 NPU profiling。CANN 架构文档说明单元职责，不提供本部署的核数、缓冲容量或性能实测。

Host 资源取得与预留空间见来源 12（db701c1f，add_rms_norm_bias_tiling.cpp 208–222），分配调用与 BlockDim 设置见来源 13（373–411），预留量常量见来源 7。来源 28 的 250–258 行给出普通核配额、实际核数和尾核行数，315–322 行按每轮行数继续划分循环与尾部；来源 29 展示普通设备模板怎样按核号偏移地址并消费这些参数。这里追踪的是带 residual 的扩展示例；GLM 实际子层入口仍走前文不带 residual 的路径。

实现类与执行方法是两次选择（来源 4）：`__new__` 查 OOT 注册表选类，`__init__` 调用 `dispatch_forward` 保存 `_forward_method`，`forward` 再调用已保存的方法。启用条件还包含 `enforce_enable`；未启用时选本地实现，启用且平台为 OOT 时选 `forward_oot`。是否最终进入设备实现取决于子类覆盖；基类该入口默认仍调用 `forward_native`。运行时命中情况须结合 trace。
