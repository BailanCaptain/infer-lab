---
id: low-precision-formats
title: BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样
type: concept
origin: gap
summary: >-
  从 FP32、FP16、BF16 与 INT8 出发，拆解 FP8、HiF8、NF4、MXFP8、MXFP4 与 NVFP4
  的位域分配和块级缩放；区分权重文件精度、加载后 HBM 驻留格式与 Cube 实际计算类型，对照 vllm-ascend v0.30.0 下
  A2/A3、310P 与 Ascend 950 的四族选路边界。
aliases:
  - FP32
  - FP16
  - BF16
  - bfloat16
  - INT4
  - NF4
  - NormalFloat
  - FP8
  - FP4
  - MXFP8
  - MXFP4
  - NVFP4
  - HiF8
  - HiFloat8
  - E4M3
  - E5M2
  - E2M1
  - E8M0
  - 指数
  - 尾数
  - 低精度格式
  - 分组缩放
  - 浮点量化
  - 910B
  - 910C
  - Ascend910B
  - Ascend910C
  - 昇腾910B
  - 昇腾910C
  - A2精度
  - A3精度
  - 昇腾推理精度
  - FP8模型加载
  - 原生FP8
  - BF16推理
  - FP16推理
chapters:
  - '04'
order: 10
sources:
  - >-
    https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf
  - >-
    https://docs.nvidia.com/deeplearning/transformer-engine-releases/release-2.8/user-guide/examples/fp8_primer.html
  - >-
    https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/
  - 'https://arxiv.org/abs/2409.16626'
  - >-
    https://public-download.obs.cn-east-2.myhuaweicloud.com/ascend/%E6%98%87%E8%85%BE950%20NPU%E6%9E%B6%E6%9E%84%E7%99%BD%E7%9A%AE%E4%B9%A6.pdf#page=17
  - 'https://arxiv.org/html/2609.19969v1'
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/worker/cache_engine.py
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/model_executor/layers/tilelang_ops/asc/kv_quant.py
  - >-
    https://github.com/deepseek-ai/DeepInfer/blob/774ce244b87cc0eb8d4b94ab9f5de2ab22049f01/deepinfer/hugging_face/config.py
  - 'https://github.com/vllm-project/vllm-ascend/issues/16375'
  - >-
    https://www.hiascend.com/doc_center/source/en/canncommercial/850/API/aolapi/context/ops-nn/aclnnMatmul.md
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/850/API/aolapi/context/ops-transformer/aclnnAllGatherMatmulV2.md
  - 'https://arxiv.org/html/1905.12322v3'
  - 'https://arxiv.org/html/2209.05433v2'
  - 'https://arxiv.org/abs/2305.14314'
  - >-
    https://pytorch.org/blog/empowering-pytorch-on-intel-xeon-scalable-processors-with-bfloat16/
  - >-
    raw:sha256-2f7e401c61e5c890b06122c22dca5c92187461b9d8d14fca1c6b88fc1ec81158.md#L1-L164
  - >-
    raw:sha256-8be59806c72e15777245016e3f54cbfc1399ecea07a6a6a354b7c462d9d2b54f.md#L1-L179
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/quantization.md#L75-L125'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/quantization.md#L105-L122'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/support_matrix/supported_models.md#L27-L69'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L75-L107'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L31-L40'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/quantization.md#L75-L107'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/support_matrix/supported_models.md#L27-L36'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/fp8_config.py#L26-L111'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L124-L297'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L128'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L207-L213'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L341-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L425-L433'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L281-L340'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L375-L440'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_mxfp8.py#L54-L91'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w4a4/w4a4_mxfp4.py#L71-L114'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L103'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_pdmix.py#L36-L101'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_pdmix.py#L37-L109'
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先按完整产品型号分清 A2/A3、310P 与 Ascend 950，再核对量化后端与算子精度
  - to: ai-core
    kind: builds-on
    note: 区分格式可存储、加载期可转换与 Cube/Vector 计算单元能直接原生执行
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-18'
rawSources:
  - >-
    raw/sha256-8a13605a3f78792aa6388de030d5716f3f3b9a70111131c3c3983706b9876e1b.md
  - >-
    raw/sha256-8be59806c72e15777245016e3f54cbfc1399ecea07a6a6a354b7c462d9d2b54f.md
---

**低精度格式用更少的二进制位保存数值，减少显存占用与数据搬运；代价是可表示的离散值变少，通常还要额外保存一组缩放系数（scale）。** 判断两个同样写着“FP8”或“FP4”的张量能否互换，至少要核对四件事：单个元素怎样分配比特、哪几个元素共用一把缩放尺、系数本身是什么格式，以及执行算子怎样解释这些字节。

## 一个数占四位，为什么还要带一把尺子

4 个二进制位一共只有 $2^4 = 16$ 种编码，装不下任意连续小数。**FP4** 指 4 位浮点元素；**scale** 是缩放系数，用来把这 16 个离散格映射到当前数据的真实幅度范围。保存时先把原值除以 scale，再就近落到最近的可表示格上；读取时把格上的值乘回 scale。

拿教学示意数 `2.8` 和系数 `0.5` 走一遍：`2.8 ÷ 0.5 = 5.6`，下面这套四位规则里没有 `5.6`，只能落到最近的 `6`。磁盘或显存里真正存下的是 `6` 对应的四位编码以及同组系数 `0.5`；读取时算 $6 \times 0.5 = 3$。每个元素少占了空间，代价是原来的 `2.8` 变成了 `3`。

```wiki-diagram
file: low-precision-intuition
```

图里的数值载荷和同组 scale 是一个不可拆开的整体：同一串非零编码一旦配错系数，读回值就会整体漂移。若权重分片、转置或缓存换入打乱了载荷与系数的对应关系，还原结果就会失真；排查异常时必须把这种“系数错配”与量化本来允许的舍入误差分开。

这件事贯穿推理主线的[逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)与[请求生命周期](request-overview.md)：权重从磁盘加载进显存、激活进入 [AI Core](ai-core.md) 的矩阵乘、历史状态写入 KV cache，各自有独立的格式约定，矩阵乘内部累加还会使用更宽的整数或高精度浮点。因此一个简写的 `W8A8` 或 `W4A4` 标签并没有描述整条计算路径；完整的四步量化乘加与工程选路见下一站[量化总览](quantization.md)。

## FP32、FP16、BF16 与整数：范围和分辨率怎样取舍

要看懂 8 位和 4 位新格式，先拿常见基线做参照。在二进制科学计数法中，非零规格化浮点数的绝对值通常写成 $1.x \times 2^n$：**指数 $n$** 决定能跨多大的数量级（动态范围），**尾数的小数位 $x$** 决定在同一个数量级区间里能切得多细（局部分辨率）。规格化数小数点前的 `1` 默认存在、不必占存储位，因此下表的尾数位只统计小数部分；算子输入、内部累加和写回输出还可以各自采用不同类型。

| 元素格式 | 每元素位数 | 符号 / 指数 / 尾数位 | 核心数值特征与取舍 |
|---|---|---|---|
| `FP32` | 32 位（4 B） | `1 / 8 / 23` | 动态范围宽、局部分辨率细，存储与带宽载荷最大 |
| `FP16` | 16 位（2 B） | `1 / 5 / 10` | 比 `BF16` 多 3 位尾数（局部更细），但 5 位指数范围较窄（最大有限值 `65504`） |
| `BF16`（Brain Floating Point） | 16 位（2 B） | `1 / 8 / 7` | 完整保留 `FP32` 的 8 位指数跨度，抗溢出能力强；牺牲了 3 位尾数分辨率 |
| `INT8` / `INT4` | 8 位 / 4 位 | 均匀整数，无指数与尾数 | 格距均匀；量化时完全依赖外部 `scale`（及可选零点 `zero-point`）还原真实幅度 |
| `NF4`（4-bit NormalFloat） | 4 位 | 按正态分布分位数设计的 16 值查表 | 源自 QLoRA，配合分组缩放与双重量化（再量化缩放常数）；无固定 `E/M` 位域，不是硬件原生 FP4 |
| `FP8`（`E4M3` / `E5M2`） | 8 位（1 B） | `1 / 4 / 3` 或 `1 / 5 / 2` | 同占 1 字节：论文定义的 `E4M3` 最大有限值 `448`（更细），`E5M2` 最大有限值 `57344`（更宽），特殊值编码也不同 |
| `HiF8`（HiFloat8） | 8 位（1 B） | `1` + 可变 `Dot` + 可变 `E / M` | 字节内用 `Dot` 字段动态调配指数与尾数位宽，不是 `E4M3` 的别名 |

```wiki-diagram
file: low-prec-fig-bit-anatomy
```

拿区间 $[1, 2)$ 里的正数算一次分辨率：这段数的指数固定为 $n = 0$，完全靠尾数切分长度为 `1` 的区间。`FP16` 有 10 位尾数，能切成 $2^{10} = 1024$ 份，相邻可表示值的间距为 $2^{-10} \approx 0.0009766$；`BF16` 只有 7 位尾数，只能切成 $2^7 = 128$ 份，间距为 $2^{-7} = 0.0078125$，局部比 `FP16` 粗 8 倍。`BF16` 之所以成为大模型主力浮点格式，是因为它保住了大跨度数量级而不易溢出，并不代表它在小区间里更精细。实际运算还要一并核对舍入模式、溢出饱和、零附近的非规格化数（subnormal）以及累加器位宽。

即便是带指数位的 `FP8`，单靠元素自身也往往覆盖不好整张矩阵的幅度，工程上普遍仍配外部 `scale`：元素编码负责“格子怎样疏密分布”，外部 `scale` 负责“整组格子落在哪段区间”。例如 `vllm-ascend` `v0.30.0` 直接支持的原生分块 FP8 检查点（`quant_method: "fp8"`），权重以 `float8_e4m3fn` 存储，同时每个 `weight_block_size` 分块额外配一个 `float32` 的 `weight_scale_inv`；同一个检查点还可以在 `ignored_layers` 或 `modules_to_not_convert` 中保留未量化层（如多模态模型的 `visual.merger.*`），因此光看目录名里的“FP8”既不能漏算尺度开销，也不能假定每一层都是同一精度。QLoRA 的 `NF4` 双重量化与微调校准流程则见[量化方法](quantization-methods.md)。

## FP4 的误差怎样进入一次计算，离群值又怎样拉粗整把尺子

再看四位浮点 **E2M1**：1 位符号、`E = 2` 位指数、`M = 1` 位尾数，共 4 位。它的 8 个非负有限值为 `0, 0.5, 1, 1.5, 2, 3, 4, 6`（负数对称），格距随数值增大而逐级变粗。

取一组教学示意向量 $x = (0.3, 1.2, 2.8)$，共用缩放系数 $s = 0.5$ 按最近可表示值舍入（本例无平局中点），再与高精度向量 $w = (1, -1, 2)$ 做点积（逐项相乘再以高精度相加），对比正常范围与混入离群值 `24`（被迫把同组系数拉大到 $s = 4$）时的传递过程：

| 推演步骤（教学示意数） | 正常同组（共用 $s = 0.5$） | 同组混入离群大值 `24`（被迫改用 $s = 4$） |
|---|---|---|
| 1. 原值除以 `scale` | $(0.3, 1.2, 2.8) \div 0.5 = (0.6, 2.4, 5.6)$ | 前三项除以 $4$ 得 $(0.075, 0.3, 0.7)$（`24 ÷ 4 = 6` 刚好不溢出） |
| 2. 舍入到最近的 `E2M1` 格 | 落到 $(0.5, 2, 6)$ | 前三项被挤到 $(0, 0.5, 0.5)$ |
| 3. 乘回 `scale` 得读回值 $\hat{x}$ | $(0.5, 2, 6) \times 0.5 = (0.25, 1, 3)$ | $(0, 0.5, 0.5) \times 4 = (0, 2, 2)$，小数细节严重塌缩 |
| 4. 与 $w = (1, -1, 2)$ 做点积 | 精算 $y = 4.7$；量化后 $\hat{y} = 5.25$（差 $+0.55$） | 前三项子点积变为 $0 \times 1 + 2 \times (-1) + 2 \times 2 = 2.0$ |

$$y = 0.3 \times 1 + 1.2 \times (-1) + 2.8 \times 2 = 4.7, \qquad \hat{y}_{s=0.5} = 0.25 \times 1 + 1 \times (-1) + 3 \times 2 = 5.25$$

三个元素的舍入方向并不相同，乘上后续权重的正负号与幅度后可能相互抵消，也可能叠加放大。这个玩具算式只展示单步误差怎样产生，不能直接推断整模型回答一定出错或一定达标——工程判定必须结合首次数值分歧、下游评测集与容许阈值。同时第二列直观暴露了低比特最核心的痛点：**只要同一个缩放组里闯入一个异常大值（outlier），整把尺子就会被迫拉粗，组内原本占多数的小数纷纷塌向 `0` 或相邻粗格**。把多少个元素划进同一组、组内离群值如何隔离、量化前是否做平滑或旋转变换，直接决定了尺子的可用精度。

## FP8、HiF8、MX 与 NVFP4 各在定哪一层规则

阅读规范和代码时，必须先把“单个元素的二进制位域”与“一组元素如何共享缩放尺”拆成两层。**MX（Microscaling，微缩放）** 规定的是小组数据怎样共享一把块级指数尺，它本身不是一种新的 8 位单元素编码。

先看单元素规则为何不能混读。拿完全相同的 8 位比特串 `00111100` 举例：按 `E4M3`（偏置 `7`）与按 `E5M2`（偏置 `15`）切分位域，解码出的是两个不同的数：

| 解读格式 | 符号 / 指数 / 尾数切分 | 偏置与阶码还原 | 尾数还原 $(1 + m)$ | 读出的十进制值 |
|---|---|---|---|---|
| 按 `FP8 E4M3` 读 `00111100` | `0` / `0111` / `100` | $7 - 7 = 0 \Rightarrow 2^0 = 1$ | $1 + 2^{-1} = 1.5$ | **`1.5`** |
| 按 `FP8 E5M2` 读 `00111100` | `0` / `01111` / `00` | $15 - 15 = 0 \Rightarrow 2^0 = 1$ | $1 + 0 = 1.0$ | **`1.0`** |

底层字节一比特都没坏，只是解释规则换了，数值就从 `1.5` 变成 `1.0`。同理，**HiF8** 在单字节内部引入专门的 `Dot` 标记位（用于动态指示本字节分配几位指数、几位尾数，不是点积运算），把 `HiF8` 字节当成 `E4M3` 直读属于格式错配而非普通舍入误差。

再看分组缩放怎样把离群值关在笼子里。OCP 的 `MXFP8` 与 `MXFP4` 约定沿归约维每 **32 个元素**组成一个微块，共用 1 字节的 **`E8M0` 共享指数**（只存 $2^k$ 形式的 2 的幂次缩放，无符号位与尾数位）：块与块之间各自拥有独立的 `E8M0` 指数，某一个 32 元素块里出现离群大值时，只会抬高该块自己的共享指数，不会跨块污染整行或整张矩阵；而在同一个 32 元素块内部，细粒度数值分辨仍靠各元素自己的 `E4M3` 或 `E2M1` 编码承担。相比之下，NVIDIA 的 **NVFP4** 把同样 32 个 `E2M1` 元素拆成两个 **16 元素小组**，每组配一个精度更细的 `E4M3` 局部 scale，整张量外层再套一个 `FP32` 全局 scale。下表汇总这几层约定的边界：

| 名称 | 元素编码与块缩放规则 | 现场核对要点 |
|---|---|---|
| `FP8 E4M3 / E5M2` | 8 位单元素，指数与尾数分配不同 | 范围与局部分辨率互有取舍，特殊值（NaN/Inf）编码也须按具体变体核对 |
| `HiF8` | 8 位单元素，含符号、`Dot`、可变指数与尾数 | 改变的是单元素内部表达；不能与 `E4M3` 互换字节 |
| `FP4 E2M1` | 4 位单元素，尚未绑定外部缩放粒度 | 仅声明 `E2M1` 不能确定完整张量布局，物理上常两元素打包进 `uint8` |
| `MXFP8` | 每 32 个 `FP8`（常为 `E4M3`）共享 1 个 `E8M0` scale | `E8M0` 为 2 的幂跨块隔离离群值，块内靠 `E4M3` 分辨；每元素有效占 `1.03125 B` |
| `MXFP4` | 每 32 个 `E2M1` 元素共享 1 个 `E8M0` scale | 元素编码、32 项分组、`E8M0` 尺度三者缺一不可；打包顺序由算子规定 |
| `NVFP4` | 每 16 个 `E2M1` 配 1 个 `E4M3` 局部 scale + 张量级 `FP32` scale | 双层缩放且分组长度为 16，不能把 `MXFP4` 张量原样喂给 `NVFP4` 内核 |

遇到任何低精度权重或缓存张量，按顺序查三项就能定性：① 单元素按什么位域读；② 一个 scale 管哪几个元素；③ scale 自身是什么类型。三项对齐后，再去核对目标算子是否支持该组合。

## 真正节省多少，缩放系数也要算进字节账

算显存和带宽账时，不能只看“4 位是 16 位的四分之一”，必须把伴随块级尺度的元数据算进去。以一个完整的 32 元素微块为基准：`BF16` 占 $32 \times 2 = 64\text{ B}$；`MXFP8` 含 $32\text{ B}$ 载荷加 $1\text{ B}$ 的 `E8M0` 尺度共 $33\text{ B}$；`MXFP4` 含 $32 \times 0.5 = 16\text{ B}$ 载荷加 $1\text{ B}$ 的 `E8M0` 尺度共 $17\text{ B}$：

$$\text{Bytes}_{\text{MXFP8}} = \frac{32 + 1}{32} = 1.03125\text{ B/elem}, \qquad \text{Bytes}_{\text{MXFP4}} = \frac{16 + 1}{32} = 0.53125\text{ B/elem} \quad (\text{较 BF16 省 } 73.4375\%)$$

把这笔精确格式账落到 `v0.30.0` 主基线标准模型 **`Qwen3-8B`**（单层 `o_proj` 形状 `4096 × 4096 = 16,777,216` 元素）与 **`Qwen3-30B-A3B`**（48 层、每层 128 个路由专家，单专家 `3 × 2048 × 768`，归约维均整除 `32`）的纯权重与块尺度字节上对比：

| 格式方案 | 32 元素微块合计（每元素有效字节） | `Qwen3-8B` 单层 `o_proj`（`16.78M` 元素） | `Qwen3-30B-A3B` 48 层路由专家总计（`28.99B` 元素） | 较 `BF16` 变化 |
|---|---|---|---|---|
| `BF16` 基线 | `64 B`（`2.00000 B`） | `32.00 MiB` | `54.00000 GiB` | `100.00%` |
| `INT8`（逐输出通道 `BF16` scale+offset） | 载荷 `32 B` + 通道级摊销 | `16.00 MiB + 16 KiB` | `27.00 GiB` 主体 + `84 MiB` 通道尺度 | `8B o_proj ≈ 50.05%` / `30B-A3B 专家 ≈ 50.15%` |
| `MXFP8`（`32×E4M3 + 1B E8M0`） | `33 B`（`1.03125 B`） | `16.00 + 0.50 = 16.50 MiB` | `27.00 + 0.84375 = 27.84375 GiB` | `51.5625%`（省 `48.44%`） |
| `MXFP4`（`32×E2M1 + 1B E8M0`） | `17 B`（`0.53125 B`） | `8.00 + 0.50 = 8.50 MiB` | `13.50 + 0.84375 = 14.34375 GiB` | `26.5625%`（省 `73.44%`） |
| `NVFP4`（`16×E2M1 + 1B E4M3` + 张量 `FP32`） | 局部两小组 `18 B`（`0.56250 B`）+ `4 B`/张量 | `8.00 + 1.00 = 9.00 MiB`（另加 `4 B`） | `13.50 + 1.6875 = 15.1875 GiB`（另加每张量 `4 B`） | `≈ 28.13%`（省 `71.88%`） |

上表仍是纯矩阵与缩放尺度的静态格式账，尚未计入 `FRACTAL_NZ` 分形对齐填充、运行时激活量化缓冲区、未量化的嵌入层/路由门控以及算子工作区，因此整机可用显存不能直接按“除以 4”估算。格式省下的是搬运与驻留字节；只有目标硬件拥有高效消费该格式的算子、且这段访存确实处在关键路径上，才会转化为端到端提速。

## DeepSeek 为什么几种缓存不用同一种 FP4

同一模型内部的不同状态，也会因为数值分布与误差敏感度不同而选用不同的低精度变体。以 V4.1 的三类历史状态为例：**主 KV** 提供 attention 真正参与加权求和的历史表示；**索引 K** 用于稀疏筛选相关历史位置；**SWA** 则保存近期滑动窗口状态。该模型的完整维度与分页字节账统一见[模型状态账](deepseek-v4-1-flash.md#一块历史到底存多少而不是40-层乘一遍)。

| 缓存对象 | 固定快照采用的编码与分组 | 为什么不能笼统都叫 `MXFP4` |
|---|---|---|
| 分页主 KV | `E2M1` 载荷，每 16 项配 1 个 `E4M3` scale | 借用 `NVFP4` 的 16 项细粒度局部分组，但省去了张量级全局 `FP32` scale；读出后先反量化再参与 attention |
| 索引 K | `E2M1` 载荷，每 32 项配 1 个 `E8M0` scale | 标准 `MXFP4` 分组，索引打分与字节偏移都必须按 32 项一尺解释 |
| SWA 窗口 KV | `FP8` 载荷，每 32 项配 1 个 `E8M0` scale | 保留 `MXFP8`（8 位而非 4 位），照顾近期窗口对精度的更高敏感性 |

报告指出，主 KV 的动态范围在结构上足够受控，才省去全局张量级 scale，并配合**量化感知训练（QAT）**在训练阶段让模型提前适应量化舍入误差——这绝不是上线推理时随手改个配置字段就能替代的。主 KV 存成 4 位的首要收益是压缩历史缓存容量与带宽，并不要求 attention 内部所有乘法都在原生 FP4 上完成。至于专家权重则走独立的模型加载器校验（核对 `quant_method`、`expert_dtype`、`weight_block_size`、`scale_fmt`），不能拿 KV 缓存格式反推权重的执行类型。

## 数值异常或没有提速，按哪几层比较

```wiki-diagram
file: low-precision-flow
```

遇到乱码、精度跳变或降精度后反而变慢，按上图自上而下分层取证：先同时落盘同一分组、同一坐标处的原始高精度值、量化载荷、保存的 `scale` 与反量化读回值。沿用首节例子，载荷 `(0.5, 2, 6)` 配本组 `scale = 0.5` 应读回 `(0.25, 1, 3)`；如果经历缓存换出换入或分片重排后读回变成了 `(2, 8, 24)` 而载荷字节未变，就能立即锁定是错配了另一组的 `scale = 4`——这种错配与 `2.8 → 3` 的正常舍入误差性质完全不同。端到端排查仍按[正确性诊断](inference-correctness-troubleshooting.md)先固定提示词模板、输入与贪心采样，避免把前后处理差异误判成数值格式故障。

| 现场现象 | 区分根因的最小对照实验 | 验收判据 |
|---|---|---|
| 只有部分分组数值突刺 | 用保存的 `scale` 与参考重算 `scale` 分别还原同一载荷，核对转置/分片后的索引映射 | 修正系数索引映射后，首次异常分歧是否消失 |
| 大幅度激活附近误差陡增 | 固定同一输入，对比饱和截断比例、组内最大最小值跨度与读回均方误差 | 结合下游任务指标验收，不单看张量平均误差 |
| 降为低比特后端到端更慢 | 拆出取数、在线量化/反量化、Cube 乘加与同步四段耗时 | 同并发负载下核对 TPOT/TTFT 与吞吐，计入格式转换开销 |
| 单算子正常，开启缓存复用后异常 | 固定同一段历史前缀，对比写入、换出、换入三处的载荷与尺度布局 | 确认载荷张量与尺度张量按同一块号成套恢复 |

## 昇腾 910B、910C 只能跑 FP8 推理吗？

**不是。Atlas A2（Ascend 910B）与 Atlas A3（Ascend 910C）的主力推理路径是 `BF16` 与 `INT8 W8A8`，CANN 的矩阵乘接口（`aclnnMatmul`、`aclnnAllGatherMatmulV2`）也明确支持 `FP16` 输入。** `BF16` 与 `FP16` 都是 16 位浮点（指数与尾数位宽不同），`INT8` 则是配缩放系数的 8 位整数；不能因为它们都属于低精度计算就统称为 `FP8`。

社区与上游讨论常以 A2 指代 910B、以 A3 指代 910C，但工程选型仍须核对[完整产品型号](hardware-devices.md)，不能仅凭卡名里的单个字母或数字推断能力。更重要的是把“跑某个模型”拆成三个独立阶段——**① 磁盘上的模型文件类型**、**② 加载后驻留 HBM 的权重格式**、**③ 送入 Cube 单元实际执行矩阵乘的类型**。文件中的位数不会自动决定后两处：

```wiki-diagram
file: low-prec-fig-ascend-matrix
```

对照上图，把 `vllm-ascend` `v0.30.0` 下四族昇腾硬件的实际路径逐一拆开：

| 昇腾硬件家族 | 常规主力精度与量化路径 | 加载原生分块 `FP8` 检查点（`quant_method: "fp8"`）的实际行为 |
|---|---|---|
| **Atlas A2 / A3**（910B / 910C，`STANDARD` 后端） | 整模型支持 `BF16` 与 ModelSlim `INT8 W8A8`；CANN 矩阵乘算子支持 `FP16` | **`v0.30.0` 静默反量化回 `model_dtype`（通常为 `BF16`，约 `2 B/元素`，显存翻倍）**，走普通 `unquantized_gemm`；**`main` 分支启动即抛 `NotImplementedError` 阻断** |
| **Ascend 950**（A5，950PR / 950DT，`FP8_OPTIMIZED`） | 原生支持 `BF16`、`FP8`、`HiF8`、`MXFP8`、`MXFP4` 及 Cube 回写数值转换 | 加载期调用 `resolve_block_scales` 后重组为 **`MXFP8`（约 `1.03125 B/元素`）** 走 `npu_quant_matmul`；但被 MLA/SFA 吸收的 `kv_b_proj` 与 `in_features % 32 != 0` 的层保留 `model_dtype` 浮点 |
| **Atlas 300I DUO**（`310P`，`COMPATIBILITY` 后端） | **仅支持 `FP16`（`--dtype float16`）与 ModelSlim `INT8`**；不支持 `BF16` | 平台仅注册 `AscendModelSlimConfig310`，**不导入/不注册 `AscendFp8Config`**；`v0.30.0` 与 `main` 均无原生 FP8 执行路径（也不会展开成 `BF16`） |

这套三段分离解释了两个高频现场困惑：
- **为什么在 A2/A3 上拉起原生 `FP8` 检查点会意外 OOM？** 在 `v0.30.0` 中，虽然文件里每个量化权重只占 `1 B`（另带每块 `float32` 的 `weight_scale_inv`），但加载器在 `process_weights_after_loading` 中还原分块尺度后释放 `weight_scale_inv`，把权重保留为 `2 B` 的 `BF16` 张量交给普通矩阵乘——既没有省下一半权重显存，也没有找回量化时已经舍去的信息。
- **为什么站内历史 GLM 双机案例的 `W8A8` 不是 `FP8`，而 950 也不是“所有层一律 1 字节”？** 站内历史 GLM 双机部署采用的是 ModelSlim `INT8` 权重与动态 `INT8` 激活（逐层选路与校准边界见[量化总览](quantization.md)），不能因为新一代芯片支持 `FP8/FP4` 就反推旧 A2 部署跑在 `FP8` 上；而在 Ascend 950 上，除了 `ignored_layers` 未量化层外，注意力吸收投影 `kv_b_proj` 与归约维不整除 `32` 的线性层同样退回约 `2 B` 的 `model_dtype`，驻留预算仍须按层核算。数据如何送入 Cube/Vector 单元见 [AI Core](ai-core.md)，950 的低比特搬运与回写转换细节见 [950 架构页](ascend-950-architecture.md)。

## 常见误解

- **“FP4 就是 INT4。”** `FP4`（如 `E2M1`）按指数与尾数做非均匀浮点编码，`INT4` 是均匀整数格，可表示集合与缩放还原公式都不同；`NF4` 则是正态分位数查表，三者不能混用。
- **“FP8 自带指数位，就不需要 scale 了。”** 单字节指数范围有限，实际权重量化、块级 `fp8_block`、`MXFP8` 与 `C8-MXFP` 缓存普遍仍带块级、通道级或动态 token 级缩放系数。
- **“910B/910C 只能跑 FP8，W8A8 就是 FP8。”** A2/A3 具备成熟的 `BF16`、`FP16` 算子与 `INT8 W8A8` 整模型推理路径；`W8A8` 只表示 8 位权重加 8 位激活，ModelSlim 默认方案是 `INT8`。
- **“原生 FP8 权重包放到 A2/A3 或 310P 上也能省一半显存。”** `v0.30.0` 在 A2/A3 上会把 `fp8_block` 静默展开成 `2 B/元素` 的 `model_dtype`（通常 `BF16`），`main` 直接报错拦截；`310P` 走 `COMPATIBILITY` 后端（`model_dtype` 为 `FP16`，不注册 `AscendFp8Config`），原生 FP8 全程不支持。
- **“同叫 FP4（E2M1）就能直接喂给任意 FP4 内核。”** `MXFP4`（32 项配 `E8M0`）、`NVFP4`（16 项配 `E4M3` 加全局 `FP32`）以及省去全局尺度的定制 KV 缓存，在分组粒度、尺度类型与物理打包顺序上互不兼容。
- **“每个元素位数减半，推理速度就翻倍。”** 在线量化/反量化、块重排、通信、未量化层占比与批大小共同决定端到端耗时。

## 对照源码

### 怎么开

部署前先读取模型目录的量化元数据，再对照当前硬件家族的量化后端：
- **ModelSlim 量化包（`INT8` / `MXFP8` / `MXFP4` 等）**：目录含 `quant_model_description.json`，启动传 `--quantization ascend`（`310P` 必须同时显式传 `--dtype float16`，A2/A3/950 常规用 `--dtype bfloat16`）；PD 分离混合方案在描述文件中标 `"W8A8_MIX"`（定义于 `w8a8_pdmix.py`，注意注册名不是 `"W8A8_PDMIX"`），完整 CLI 入口见[量化总览](quantization.md#怎么开)。
- **原生分块 FP8 检查点（无需离线重量化）**：`config.json` 须同时声明 `"quant_method": "fp8"`、`weight_block_size` 与 `activation_scheme: "dynamic"`。所谓“直接加载”是指免去用户离线重新导出权重，加载器在内存中仍会执行分块尺度解析与按硬件重组；不带 `weight_block_size` 的 per-tensor / per-channel FP8 文件没有这条执行路径，须改用 ModelSlim 或 LLM-Compressor 重量化。
- **V4.1 定制状态与专家加载**：DeepInfer 固定加载器显式核对 `quant_method`、`expert_dtype`、`weight_block_size` 与 `scale_fmt`；严禁只手改 JSON 标签而不转换真实权重字节。

### 会报什么错

- **原生 FP8 配置拦截（`fp8_config.py`）**：缺少 `weight_block_size` 或 `activation_scheme != "dynamic"` 时，`AscendFp8Config._verify_block_quantization()` 直接抛 `NotImplementedError`。
- **非 950 硬件拦截与后端隔离**：在 `main (8d6180e2)` 分支将原生 `fp8_block` 包部署到 A2/A3 时，`_require_fp8_weight_matmul()` 启动即抛 `NotImplementedError: Native block-wise FP8 checkpoints run on Ascend 950 only...`（而在 `v0.30.0` 中不报错，但静默展开成 `model_dtype` 可能导致 HBM 翻倍 OOM）；在 `310P` 上因 `COMPATIBILITY` 后端不注册 `AscendFp8Config`，原生 FP8 配置直接无法走 Ascend 执行路径。
- **静默错数（无异常退出）**：载荷与 `scale` 分组错位、转置方向反置或误按错误位域读取时，算子不会抛类型错，而会输出乱码或局部突刺；提交排障记录时应附上实际 `dtype`、分组长度、`scale` 形状与首次异常层的还原中间值。

### 开销和什么时候别开

块级/通道级系数存储、加载期 `resolve_block_scales` 与 `_mx_quantize` 重排、在线激活量化以及宽累加器都会引入额外成本。当目标芯片无对应原生低比特矩阵乘（如在 A2/A3 上强跑原生 `fp8_block` 只会得到 `2 B/元素` 的浮点展开）、下游评测质量跌破红线，或转换耗时已超过省下的访存时间时，应直接选用该硬件原生高效的 `BF16`、`FP16` 或经校准的 `INT8 W8A8` 权重包。

### 版本差异

`v0.30.0` 新增面向稠密 full Attention 的 **`C8-MXFP` KV 缓存**（`--kv-cache-dtype mxfp8`，`mxfp_c8.py`）：K/V 元素存为 `float8_e4m3fn` 并配 `E8M0` 尺度，其中 K 在写入时动态计算逐 token 组尺度，V 使用 ModelSlim 权重包提供的静态逐通道 `v_cache_scale`（全零通道校准值 `0` 清洗为中性值 `127`，即 $2^{127-127}=1$）。它与原生 `fp8_block` 权重、`W8A8_MXFP8` 线性层及稀疏注意力缓存各自独立计量，详见 [KV cache 量化](kv-cache-quantization.md)。

下表汇总外部规范快照与 `vllm-ascend` 四版本基线的核心差异：

| 核对维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` **[主基线]** | `main (8d6180e2)` |
|---|---|---|---|---|
| **A2/A3 `BF16` 与 `INT8 W8A8`** | 支持表列出 Qwen3-Dense `BF16` 与 `W8A8`；指南含动态 `INT8` 示例 | 同 `v0.23.0` | 支持表覆盖 Qwen3-Dense / `Qwen3-30B-A3B` 的 `BF16` 与 `W8A8` | 支持表改版按特性矩阵展示，`BF16` 与 `W8A8` 主干保持 |
| **原生分块 FP8（`fp8_config.py` / `fp8_block.py`）** | 量化指南与代码无此原生分块重分组入口 | 同 `v0.23.0` | 要求 `weight_block_size` + `dynamic`；**950 重组 `MXFP8`（`kv_b_proj` 与 `K%32!=0` 保浮点），A2/A3 静默展开为 `model_dtype`（通常 `BF16` `2×`）** | 950 保持 `MXFP8`；**A2/A3 新增 `_require_fp8_weight_matmul()` 启动即抛 `NotImplementedError`**（指南同步改为拒绝启动） |
| **`310P`（Atlas 300I DUO）精度与后端** | 仅 `FP16` / ModelSlim `INT8` | 同 `v0.23.0` | `hardware_profile.py` 划入 `COMPATIBILITY` 后端，`platform.py` 仅注册 `AscendModelSlimConfig310`（不注册 `AscendFp8Config`），支持表明列 `BF16` ❌、`float16` 运行 | 同 `v0.30.0`（`COMPATIBILITY` 后端无原生 FP8 路径） |
| **`W8A8_MIX`（`w8a8_pdmix.py`）与 `MXFP`** | `w8a8_pdmix.py` 同时注册 `("W8A8_MIX", "linear")` 与 `moe`；无 `C8-MXFP` | 同 `v0.23.0`，但 `W8A8_MIX` 的 `moe` 类标记弃用告警 | **移除 `moe`，仅保留 `("W8A8_MIX", "linear")`**；完备 `W8A8_MXFP8`、`W4A4_MXFP4` 与稠密 `C8-MXFP` | 同 `v0.30.0` |

此外，OCP MX v1.0 与 NVIDIA 文档仅定义通用数值编码与分组规则，不代表本站框架支持矩阵；DeepInfer `774ce244` 仅作为本页 V4.1 三类缓存格式与 Ascend scale 转换逻辑的固定对照快照。

### 源码位置

| 模块与文件（主基线 `v0.30.0 c09d3e20` + `main 8d6180e2`） | 核对内容 |
|---|---|
| `quantization/configs/fp8_config.py` L26–111 | `AscendFp8Config`：`weight_block_size`、`activation_scheme == "dynamic"` 与 `ignored_layers` 跳过逻辑 |
| `quantization/methods/w8a8/fp8_block.py` L17–34、L124–297（`main` L114–128、L207–213） | `resolve_block_scales`、`is_950()` 重组 `MXFP8`、`kv_b_proj` 与 `in_features % 32 == 0` 回退、A2/A3 `unquantized_gemm` vs `main` `_require_fp8_weight_matmul()` |
| `platform.py` L341–349（`main` L425–433）与 `device/hardware_profile.py` L281–340（`main` L375–440） | `STANDARD` 后端注册 `AscendFp8Config`；`_310P` 归入 `COMPATIBILITY` 仅注册 `AscendModelSlimConfig310`；`A5` 标记 `FP8_OPTIMIZED` |
| `quantization/methods/w8a8/w8a8_mxfp8.py` L54–91 与 `methods/w4a4/w4a4_mxfp4.py` L71–114 | `group_size = 32`、`float8_e4m3fn`、`float4_e2m1fn_x2` 两元素打包 `uint8` 与 `E8M0` `weight_scale` |
| `quantization/methods/kv_cache/mxfp_c8.py` L51–103 与 `methods/w8a8/w8a8_pdmix.py` L36–93 | `C8-MXFP` 的 `E4M3` 缓存 + `E8M0` `v_cache_scale` 中性值 `127`；`W8A8_MIX` 在 `v0.30.0` 仅注册 `linear` |

**来源与结论对应：**

- OCP `MXFP8` / `MXFP4` 的 32 元素微块、`E8M0` 共享指数与 `E2M1` 有限值集合见 OCP 规范 [S1]；`FP8` 与 `MXFP8` 对比见 Transformer Engine 说明 [S2]；`NVFP4` 的 16 元素 `E4M3` 局部尺度加 `FP32` 全局尺度见 NVIDIA 技术博客 [S3]。
- `HiF8` 的 `Dot` 字段与可变指数/尾数分配见原论文 [S4]；Ascend 950 对 `HiF8`、`FP8`、`MXFP8`、`MXFP4` 及 Cube 回写数值转换的硬件说明见架构白皮书第 17–20 页 [S5]。
- DeepSeek V4.1 主 KV、索引 K 与 SWA 窗口采用不同精度的动机及 QAT 说明见技术报告 §2.4.4 [S6]；具体分页字节布局、先编码再取逆 scale 的 `make_kv_scale_impl` 与 `load_hf_model_config` 元数据校验（来源 7–9）对照 DeepInfer 固定源码 [C7][C8]。
- 社区讨论中 A2（910B）、A3（910C）的平台简称对照上游 RFC（来源 10）[I]；CANN `aclnnMatmul` 与 `aclnnAllGatherMatmulV2` 对 A2/A3 `FP16`、`BF16`、`INT8` 输入与 `cubeMathType` 的算子支持见官方文档 [S11][S12]。
- `FP32` / `FP16` / `BF16` 位宽分配见 BFLOAT16 论文表 1 [S13]（交叉核对 PyTorch 说明，来源 16）；`FP8` 的 `E4M3`（上限 `448`）与 `E5M2`（上限 `57344`）定义见原论文表 1 [S14]；`NF4` 与双重量化见 QLoRA 论文 [S15]。
- `v0.30.0` 与 `main` 的量化指南分块 FP8 硬件分支、支持矩阵（950 `MXFP8/MXFP4`、A2/A3 `BF16/W8A8`、`300I DUO` `BF16` ❌ 与 `--dtype float16`，以及 `v0.23.0` / `v0.26.0rc` 对照，来源 19–26）见各版官方文档 [S19][S21]。
- `AscendFp8Config` 块尺度与动态激活校验、`fp8_block.py` 在 950 重组 `MXFP8` 与 `kv_b_proj`/`in_features % 32 != 0` 例外、A2/A3 在 `v0.30.0` 展开 `model_dtype` 而在 `main` 抛错，以及 `310P` `COMPATIBILITY` 后端隔离（来源 27–35），对照源码 [C27][C29][C30][C32]。
- `W8A8_MXFP8` / `W4A4_MXFP4` 的 32 元素块与 `uint8` 打包、`C8-MXFP` 缓存尺度及 `W8A8_MIX` 在 `v0.30.0` 移除 `moe` 注册（对比 `v0.23.0`/`v0.26.0rc`，来源 36–41），对照源码 [C36][C38][C39]。
- $[1, 2)$ 间距、`00111100` 双格式解码、`MXFP8` `1.03125 B/elem` 与 `MXFP4` `0.53125 B/elem`（`17 B / 64 B` 省 `73.4375%`），以及 `Qwen3-8B` 单层 `o_proj`（`32 MiB → 16.5 MiB / 8.5 MiB`）与 `Qwen3-30B-A3B` 48 层路由专家（`54 GiB → 27.84375 GiB / 14.34375 GiB`）字节对比由格式定义与模型预设配置推导 [D]；点积向量与离群值 `24` 为教学示意假设 [A]。

**待核：** 910B/910C 底层全量指令级数值类型清单、各 FP8/FP4 变体的逐算子兼容矩阵，以及 `Qwen3-8B` / `Qwen3-30B-A3B` 在指定昇腾镜像上开启 `MXFP8` / `MXFP4` / `C8-MXFP` 后的实测吞吐、显存峰值与评测分差。
