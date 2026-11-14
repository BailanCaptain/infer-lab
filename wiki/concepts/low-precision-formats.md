---
id: low-precision-formats
title: BF16、INT8、FP8 与 FP4：位数一样，数值为什么不一样
type: concept
origin: gap
summary: >-
  从 FP32、FP16、BF16 和 INT8 基线出发，分清 FP8、FP4、NF4、MX 与 HiF8 的元素编码和缩放；解释昇腾 910B/910C
  为何不只支持 FP8 推理，区分模型文件精度、加载后权重与实际计算，并核对 A2/A3 的 BF16、FP16、INT8 路径及版本边界。
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
  - '19'
toc:
  part: models
  section: 数值表示与量化
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
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L75-L125
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_models.md#L27-L36
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_models.md#L31-L40
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/support_matrix/supported_models.md#L27-L36
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L75-L107
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/quantization.md#L75-L107
  - 'https://arxiv.org/html/1905.12322v3'
  - 'https://arxiv.org/html/2209.05433v2'
  - 'https://arxiv.org/abs/2305.14314'
  - >-
    https://pytorch.org/blog/empowering-pytorch-on-intel-xeon-scalable-processors-with-bfloat16/
  - >-
    raw:sha256-2f7e401c61e5c890b06122c22dca5c92187461b9d8d14fca1c6b88fc1ec81158.md#L1-L164
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/quantization.md#L105-L116
  - >-
    raw:sha256-8be59806c72e15777245016e3f54cbfc1399ecea07a6a6a354b7c462d9d2b54f.md#L1-L179
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/quantization.md#L105-L121
  - 'vllm-ascend@7d825229:vllm_ascend/quantization/configs/fp8_config.py#L26-L111'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L181
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L124-L239
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L103
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/quantization.md#L105-L121
  - >-
    vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L123-L250
relations:
  - to: quantization
    kind: builds-on
    note: INT8 的基本缩放过程和 GLM W8A8 由原页维护
  - to: kv-cache-quantization
    kind: builds-on
    note: 分清对权重和历史状态量化的不同生命周期与误差
  - to: deepseek-v4-1-flash
    kind: builds-on
    note: 固定模型的状态维度和完整分页字节账在模型页
  - to: ai-core
    kind: builds-on
    note: 区分格式可存储、数据可转换与计算单元能直接执行
  - to: hardware-devices
    kind: builds-on
    note: 按完整产品型号确认 A2/A3 环境，再核对算子与框架的精度支持
  - to: inference-correctness-troubleshooting
    kind: builds-on
    note: 先找首次数值分歧，再定位缩放与格式转换
verified: []
evidence: S
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-8a13605a3f78792aa6388de030d5716f3f3b9a70111131c3c3983706b9876e1b.md
  - >-
    raw/sha256-8be59806c72e15777245016e3f54cbfc1399ecea07a6a6a354b7c462d9d2b54f.md
---

**低精度格式用更少的二进制位保存数值，减少存储和搬运；代价是可表示的数更少，通常还要保存缩放系数。** 判断两个“FP4”能否互换，至少要看每个数怎样编码、哪几个数共用系数、系数是什么格式，以及执行算子怎样解释这些字节。

## 一个数占四位，为什么还要带一把尺子

4 个二进制位只有 16 种编码，不能精确装下任意小数。**FP4** 指四位浮点元素；**scale** 是缩放系数，用来把这组有限的值映射到当前数据的范围。保存时先除以 scale，再选附近一个可表示值；读取时乘回 scale。

例如原值 2.8 除以系数 0.5 得到 5.6，但下面这套 FP4 规则里没有 5.6，只能选附近的 6。保存的是 6 的四位编码和对应系数，读取时算 6×0.5=3。少占了空间，代价是原来的 2.8 变成了 3。

```wiki-diagram
file: low-precision-intuition
```

图中的数值载荷和系数是一个整体。同一份非零载荷配上不同系数，读回的值就变了。若搬运或重排打乱了两者的对应关系，读回值就失去正确解释；排查时要把这种错配与量化本来允许的舍入误差分开。

这件事会出现在[逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)中：权重加载、激活进入矩阵乘、KV 写入缓存，分别有自己的格式约定。输出累加还可以使用更高精度，因此一个“W4A4”标签没有描述整条计算路径。

## FP32、FP16、BF16 与整数，先分清范围和分辨率

先补上常用格式的参照。**指数**决定能跨多大的数量级，**尾数的小数位**决定同一数量级里能分得多细。通常把数的绝对值写成 1.x × 2ⁿ：n 是指数，x 是二进制小数部分，这称为**规格化表示**。开头的 1 不必单独保存，下表的尾数位只数小数部分。输入、累加和输出还可以分别采用不同类型。

| 元素格式 | 每元素位数 | 符号 / 指数 / 尾数小数位 | 首先要理解的取舍 |
| --- | --- | --- | --- |
| FP32 | 32 | 1 / 8 / 23 | 范围较大、局部分辨率较细，载荷较大 |
| FP16 | 16 | 1 / 5 / 10 | 比 BF16 多三位尾数，但范围较窄 |
| BF16（Brain Floating Point） | 16 | 1 / 8 / 7 | 保留 FP32 的指数位宽；不保留它的局部分辨率 |
| INT8 / INT4 | 8 / 4 | 整数编码，没有指数和浮点尾数 | 量化时由外部 scale、可选零点解释原数值 |
| FP8 E4M3 / E5M2 | 8 | 1 / 4 / 3 或 1 / 5 / 2 | 同样一字节，范围、精细程度和特殊值规则不同 |

以从 1 到不足 2 的正数区间 [1,2) 为例，这些数可写成 1 加上一段二进制小数，指数保持不变。FP16 的 10 位小数能把这段长度为 1 的区间分成 1024 份，相邻可表示值的间距就是 2⁻¹⁰≈0.0009766；BF16 的 7 位只能分成 128 份，间距为 2⁻⁷=0.0078125。这里的“分辨率”就是相邻可表示值有多近。BF16 能容纳更大的数量级，不代表这里更精细。实际运算还要核对舍入、溢出、接近零时的非规格化数和累加规则。

论文所定义的 E4M3 最大有限值是 448，E5M2 是 57344；其他变体可能不同，不能只凭“FP8”互换字节。浮点也常配外部 scale：元素编码解决“格子怎样分布”，scale 再调整整组数落在哪段范围。

原生块量化 FP8 checkpoint 也是一个具体方案：所列文档描述的权重以 float8_e4m3fn 保存，每个权重块另带一个 float32 尺度。因此，一字节权重之外还存在尺度开销；这个存储约定不能推广为所有 FP8 格式都相同。

同一个 FP8 checkpoint 中也可能有未量化层。固定 `baa023ad` 的分块 FP8 加载入口允许在 `ignored_layers` 或 `modules_to_not_convert` 中列出这些层，例如多模态模型的 `visual.merger.*`，这些层仍以未量化方式运行。因此，检查点的 FP8 名称不能确定每一层的数值格式。


**NF4（4-bit NormalFloat）**则来自 QLoRA：根据正态分布设计一组四位编码对应的数值，并配合分组缩放。它没有 E2M1 那样固定的指数/尾数字段，不能当成硬件原生 FP4 的别名。QLoRA 的双重量化是进一步量化缩放常数；其微调流程见[量化方法](quantization-methods.md)。

## FP4 的误差怎样进入一次计算

以 **E2M1** 为例：E 表示指数，影响数值范围；M 表示尾数，影响同一范围内的细分程度。加上一位符号，共四位。它的非负有限值为 0、0.5、1、1.5、2、3、4、6，负数有对应的负值。可以看到间距不均匀，大数附近更粗。

取一组教学数据 0.3、1.2、2.8，共用 scale=0.5，并按最近的可表示值舍入；本例没有恰好处在中点的值。为了看清误差如何传递，用向量 (1,−1,2) 与它做点积，即对应项相乘再相加，点积本身用较高精度计算。

```calc
title: 元素舍入以后，点积怎样改变（示意）
缩放后的三个数 = (0.3, 1.2, 2.8) ÷ 0.5 = (0.6, 2.4, 5.6)
选到的 E2M1 值 = (0.5, 2, 6)
读回的三个数 = (0.5, 2, 6) × 0.5 = (0.25, 1, 3)
原点积 = 0.3 × 1 + 1.2 × (−1) + 2.8 × 2 = 4.7
量化后点积 = 0.25 × 1 + 1 × (−1) + 3 × 2 = 5.25
```

三个元素的变化不完全同向，后续权重的大小与正负又决定这些变化是放大还是抵消。这个例子只能证明误差如何进入计算，不能直接推出回答一定错误或质量一定可接受。真正判断要看首次分歧、任务评测及容许范围。

如果同组突然多出一个 24，为覆盖它而把 scale 改为 4，那么原先三个小数除以 4 后变成 0.075、0.3、0.7，最近的 E2M1 值为 0、0.5、0.5，读回为 0、2、2。大数装进去了，小数却更粗。把哪些数放进同组、组内有没有异常大值、量化前是否做变换，都会影响这把尺子怎样选择，因而需要一起检查。

## FP8、MX、NVFP4 与 HiF8 各在说哪一层规则

先把“一个元素”与“一组元素加缩放”分开。**MX（Microscaling）** 是给小组数据共享缩放的格式约定；它不是另一种单独的八位元素编码。

先看元素规则为何不能混用。同一个八位串 00111100，按 E4M3 分成符号 0、指数 0111、尾数 100；指数扣除偏置 7 后为 0，尾数部分为 1+1/2，所以得到 1.5。按 E5M2 则分成 0、01111、00；指数扣除偏置 15 后为 0，尾数为 1，所以得到 1.0。这是按格式定义读同一字节的推导：字节没有损坏，解释规则错了，值仍会变。

再看分组。32 个四位元素在 MXFP4 中共用一个系数；在 NVFP4 中分成两组，每组 16 个，各有局部系数，另外还有张量级系数。即使元素都叫 E2M1，也不能只复制这 32 个元素就假定能正确还原。下面的表用于核对这些约定，不要求先背缩写。

| 名称 | 元素与分组规则 | 读者应记住的区别 |
| --- | --- | --- |
| FP8 E4M3 / E5M2 | 都是 8 位，指数与尾数的位数分配不同 | 更大的可表示范围与更细的局部分辨率存在取舍；特殊值编码也须按具体变体核对 |
| FP4 E2M1 | 一个四位元素，尚未指定外部缩放方案 | 同为 E2M1 仍不能推出完整张量布局相同 |
| MXFP8 | OCP 约定每 32 个 FP8 元素共享一个 E8M0 scale | E8M0 用指数表示缩放，有限缩放值为 2 的幂 |
| MXFP4 | 每 32 个 E2M1 元素共享一个 E8M0 scale | 三项共同定义数值表示；物理打包和系数排列另由实现规定 |
| NVFP4 | 每 16 个 E2M1 元素共享 E4M3 scale，再配张量级 FP32 scale | 两层缩放，与 MXFP4 的分组和还原规则不同 |
| HiF8 | 八位元素内部含符号、Dot、指数和尾数，Dot 控制指数/尾数的位宽分配 | 它不是 E4M3 的另一个名字；“都占一字节”不代表能按同一种编码解读 |

**HiF8** 改的是元素自身的表达方式，MX 改的是一组低精度元素与系数怎样结合。把一个 HiF8 数当作 E4M3 来解释，并非普通舍入，而是格式用错。FP8/FP4 支持列表也不说明任意两个格式都能在任意算子上直接相乘。

Dot 是 HiF8 编码内部用来决定字段长度的标记，不是点积运算。理解这里的区别后，现场先查三项就有方向：字节按哪种元素规则读；一个系数管哪几个元素；系数本身又按什么规则读。再往下才查算子是否支持这种组合。

## 真正节省多少，系数也要算进去

取一个完整的 32 元素分组，仅比较载荷和系数。BF16 每元素两字节；MXFP4 每元素半字节，再加这一组的一字节 scale。

```calc
title: 32 个元素的存储比较（格式推导）
BF16 载荷 = 32 × 2 = 64 B
MXFP4 载荷 = 32 × 4 ÷ 8 = 16 B
MXFP4 载荷与系数合计 = 16 + 1 = 17 B
理想节省比例 = (64 − 17) ÷ 64 = 73.4375 %
```

这是完整分组的格式账，尚未计入张量对齐、元数据、转置副本或未量化部件，所以模型总内存不能简单按“四分之一”估算。格式节省的是字节；只有相应算子能高效使用它、且这段工作确实决定等待，才可能变成端到端加速。

## DeepSeek 为什么几种缓存不用同一种 FP4

V4.1 的主 KV、索引 K 和 SWA 各有用途，也有不同的精度敏感性。**主 KV** 提供 attention 真正读取的历史表示；**索引 K** 用于筛选历史；SWA 则是近期窗口。固定模型的维度、字节数与来源层统一见[模型状态账](deepseek-v4-1-flash.md#一块历史到底存多少而不是40-层乘一遍)。

| 对象 | 本快照采用的格式 | 为什么不能一律称为 MXFP4 |
| --- | --- | --- |
| 分页主 KV | E2M1 数据，每 16 项一个 E4M3 scale | 借用 NVFP4 的局部分组，但省去其张量级全局 scale；读取后反量化再参与 attention |
| 索引 K | E2M1 数据，每 32 项一个 E8M0 scale | 对应 MXFP4 分组，索引计算和存储都要按此解释 |
| SWA KV | FP8 数据，每 32 项一个 E8M0 scale | 保留 MXFP8，以照顾窗口状态的精度敏感性 |

报告说明主 KV 的范围足够受控，才采用省去全局 scale 的形式，并通过量化感知训练适配误差。**量化感知训练**是在训练中让模型面对类似量化误差，不是推理时随便改一个格式名称。主 KV 用 FP4 主要为了少存数据，并不要求 attention 所有乘法都原生用 FP4 执行。

专家权重则是另一条路径：模型文件中的量化元数据由加载器检查，不能从 KV 格式反推出专家的执行类型。文件格式、加载后的打包形式、通信载荷、计算与累加类型应分别记录。

## 数值异常或没有提速，按哪几层比较

```wiki-diagram
file: low-precision-flow
```

先保存原始高精度值、量化载荷、对应 scale 和读回值，检查它们是不是同一个分组、同一个位置。若还原范围已经明显不对，先查 scale 的编码、方向、广播维度与顺序；若误差合理，再沿后续计算找何时放大。完整输出排查仍按[正确性诊断](inference-correctness-troubleshooting.md)先对齐模板、输入和采样，避免把接口问题误判为精度问题。

沿首节的数据，载荷 (0.5,2,6) 配系数 0.5 应读回 (0.25,1,3)。如果换入缓存后变成 (2,8,24)，而载荷未变，就去查是否误用了另一组的系数 4。这样的记录可以排查“数据搬对了，系数配错了”；它与量化本来造成的 2.8→3 属于不同问题。应在量化写入、缓存换出换入、反量化读取三处保存同组索引及系数，避免只比较最终文本。

| 现象 | 能区分原因的对照 | 验收方法 |
| --- | --- | --- |
| 只有部分分组突然异常 | 同一载荷分别用保存的 scale 和参考 scale 还原，检查分组/转置后的对应位置 | 首次异常是否随系数映射修正而消失 |
| 大值附近误差明显 | 保持输入，比较饱和比例、分组内范围和读回误差 | 同时看任务质量，不能只比较平均误差 |
| 降精度后更慢 | 比较取数、转换、矩阵计算与同步的分段时间 | 在同负载下检查目标延迟与达标吞吐，包含转换开销 |
| 单算子正常，缓存复用后异常 | 固定同一历史，对比写入、换出、换入后数据与系数的布局 | 对齐首次分歧和存储格式版本，确认载荷与元数据成套恢复 |

如果目标是排查实现错误，用参考量化实现或高精度路径形成可比较的中间值；如果目标是选择格式，就必须同时评价质量、速度与容量。二者使用同一套证据，但结论不同。

## 昇腾 910B、910C 只能跑 FP8 推理吗？

**不是。910B、910C 对应的 A2/A3 部署存在 BF16 推理和 INT8 W8A8 路径，CANN 的相关矩阵乘算子也支持 FP16。** BF16 与 FP16 都用 16 位保存浮点数，但指数和尾数分配不同；INT8 则用 8 位保存整数，配合缩放系数参与量化计算。它们不能因都属于“低精度”就统称为 FP8。

这里按上游讨论中 A2（Ascend 910B）、A3（Ascend 910C）的称呼对照平台；实际部署还要记录[完整产品型号](hardware-devices.md)，不能仅从型号中的一个 B、C 或数字判断支持范围。下面分清算子能力与整模型支持：

| 所问精度 | 已核对的 A2/A3 依据 | 如何用于部署判断 |
| --- | --- | --- |
| BF16 | vLLM-Ascend 三个在册快照的 Qwen3-Dense 支持表均列为支持 | 已有整模型推理路径；其他模型仍查自己的支持项 |
| FP16 | CANN 矩阵乘接口明确支持 FP16 输入，产品列表含 A2/A3 | 证明相关算子支持，具体模型能否全程使用 FP16 要继续核对框架与模型 |
| INT8 W8A8 | 三个快照均有 W8A8 指南；指南中的动态量化示例使用 INT8，支持表列出 A2/A3 的 Qwen3-Dense W8A8 | 权重与激活按整数路径量化；完整缩放和输出过程见 [W8A8](quantization.md) |
| 加载 FP8 模型文件 | main 固定快照支持特定分块 FP8 文件；指南说明非 950 代际走 BF16，线性层实现实际按配置中的 model dtype 展开权重 | 先核对加载后的类型；读取 FP8 文件不证明原生 FP8 矩阵计算或任意 FP8 文件可用 |

“能跑 FP8 模型”涉及三个不同位置。**模型文件**是磁盘上的权重与量化元数据；**加载后权重**是为当前设备准备的内存表示；**实际计算**是算子执行时使用的数值类型。服务先在模型加载阶段准备权重，随后在[逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)反复使用它；文件中的位数不会自动决定后面两处。

以本页核对的 main 分块 FP8 线性层为例，加载器先按每块缩放系数还原权重，再转换到配置中的模型类型。非 950 路径保留这份权重，由普通矩阵乘使用；指南描述的是 BF16 情形，实现没有把模型类型硬编码为 BF16。950 路径优先重新量化为 MXFP8，但归约维不满足 MX 分组时仍保留模型类型；供 MLA 吸收的 `kv_b_proj` 也保留解析后的矩阵，不走该线性层自己的矩阵乘。

因此，把 FP8 文件中每个量化权重的一字节直接用于驻留权重预算，会漏掉这些分支。以 BF16 展开为例，每个权重元素需要两字节，整模型还要另算未量化层、缓存和工作区；重新量化为 MXFP8 的层则另算尺度。恢复成 BF16 不会找回原先舍去的信息，重新量化也不能保证逐位不变。

对某个模型作决定时，应同时确定产品型号、CANN 与框架版本、模型量化元数据，再查目标算子的输入、累加与输出类型。“只能 FP8”已能被上述反例否定；“所有精度都能用”或“两代芯片所有算子原生支持哪些格式”，则需要更完整的逐算子证据。

## 放回 GLM 双机和昇腾硬件

本站 GLM 双机的 **W8A8** 是八位整数权重与激活路径，具体算子和保留高精度的部件见[量化页](quantization.md)。它不是 FP8，更不能因为某代芯片增加 FP4 支持，就假定原 A2 部署已经使用 FP4。

昇腾 950 架构白皮书列出 HiF8、FP8、MXFP8、MXFP4 等类型，并说明 Cube 结果回写时的数值转换能力。判断某条推理路径是否可用，仍需要同时满足模型产物、CANN/算子、框架调度与硬件条件；[AI Core](ai-core.md)解释数据怎样进入计算单元，[950 架构页](ascend-950-architecture.md)接着分析低精度计算与搬运、转换的关系，并集中列出 PR/DT 产品规格。

## 常见误解

- **“FP4 就是 INT4。”** 一个是浮点编码，一个是整数编码，数值集合与缩放解释不同。
- **“FP8 就不用 scale。”** 元素能表示浮点，不代表整个张量的范围已经合适；很多实际方案仍用缩放。
- **“910B/910C 只能用 FP8，W8A8 就是 FP8。”** A2/A3 有 BF16 与整数 W8A8 推理路径；本站 GLM 的 W8A8 是 INT8。能读 FP8 权重文件也要继续查看加载后的实际计算类型。
- **“同为 FP4 就能原样搬到另一个内核。”** 分组、系数类型、打包顺序和布局都要匹配。
- **“占用下降多少，推理就快多少。”** 转换、计算、通信、排队共同决定服务时间。

## 对照源码

### 怎么开

先读取模型产物的量化元数据，再核对当前加载器与算子支持。GLM 的 ModelSlim 配置见原量化页；V4.1 固定加载器检查 `quant_method`、`expert_dtype`、`weight_block_size` 和 `scale_fmt` 等字段。不要把手改元数据当成完成量化转换。

上述 `baa023ad` 分块 FP8 入口所说的“直接加载”，是指用户无需预先离线重新量化；加载器仍会按硬件路径重组尺度或转换为运行时所需的表示。它不表示运行时字节布局原封不动，也不能推广到任意 FP8 检查点。

上面 A2/A3 的分块 FP8 示例依据 main 的量化指南：模型配置须带 `quant_method: fp8` 与 `weight_block_size`，加载器据此识别；同一指南说明不带分块信息的 per-tensor / per-channel FP8 文件没有这条执行路径。这里的限制针对该快照与该加载入口，不能换成“芯片不能运行任何 FP8 模型”。[S13]

### 会报什么错

类型/形状不支持可能直接报错；载荷与 scale 错配也可能正常运行却产生错数。记录实际 dtype、分组长度、scale 形状、打包维度与第一次异常的中间值，比只提交“开 FP4 后乱码”更能定位。

### 开销和什么时候别开

额外系数、格式转换、重排与高精度累加都会增加成本。若目标算子不支持、质量不达标，或转换已超过节省的访存，应保留已验证路径；不能只凭硬件峰值决定上线。

### 版本差异

**v0.30.0rc2 的格式名字不能直接当成每层的驻留格式。** 原生 FP8 指南与已钉 main 相同，但实际 loader 要求 block-wise 权重和 dynamic activation_scheme，跳过层走普通方法。950 优先将原生 block FP8 重组为 MXFP8，归约维不满足 MX 分组时仍回退 model dtype，MLA 吸收后的矩阵也可能保留解析权重；因此不能写成“950 全部权重始终一字节”。

新增 dense attention 的 C8-MXFP 缓存又是另一对象：元素为 FP8 E4M3，另有 E8M0 scale，K 采用动态 token/group scale，V 采用静态 channel scale。它与 FP8 checkpoint、MXFP8 权重量化、稀疏 SFA/LI C8 分别计量，不能只用“FP8”三个字合并预算。

格式规范与框架支持是两项核对。下表记录实际读过的文档快照；核对了某一模型的支持项，不等于验证该版本的全部 FP8/FP4 算子，因此本页不据此扩展页头的已验证版本标记。

| 范围 | 本页适用边界 |
| --- | --- |
| OCP MX v1.0 / NVIDIA 所引格式说明 | 定义元素、分组与缩放；不是本站框架支持列表 |
| DeepInfer `774ce244` | 本页 V4.1 缓存布局、格式校验及 Ascend 转换实现的固定依据 |
| vLLM-Ascend v0.23 维护分支，2026-09-09 快照 | Qwen3-Dense 在 A2/A3 的 BF16、W8A8 均列为支持；量化指南有 INT8 W8A8 示例，未包含后述原生 FP8 文件加载章节，不能由文档未写反推所有 FP8 路径不存在 |
| vLLM-Ascend v0.26 rc 分支，2026-09-17 快照 | 上述 BF16、W8A8 支持项相同，量化指南同样未包含该 FP8 章节；其他模型、算子与默认值仍按本分支核对，不沿用 DeepInfer 的格式开关 |
| vLLM-Ascend main，2026-09-22 固定快照 | 上述支持项相同；新增分块 FP8 文件加载说明。不带分块信息的 FP8 文件不适用这条入口；线性层实际按模型类型、硬件、MX 分组和权重吸收条件选择驻留表示，不能只照指南概括为两条无例外分支 |

### 源码位置

- MX 分组与 E2M1 数值集合见 OCP 规范 [S1]；FP8 与 MXFP8 的区别见固定文档版本 [S2]；NVFP4 的两级缩放见 NVIDIA 官方说明 [S3]。
- HiF8 的 Dot 字段与可变指数/尾数分配见原论文 [S4]；950 的格式支持和 Cube 回写转换见架构白皮书第 17–20 页，含图 4-3、4-4 与表 4-1 [S5]。
- 主 KV 与窗口采用不同精度的动机见 V4.1 报告 §2.4.4 [S6]，具体字节布局见 `KVCache` 与索引字节计算 [C7]。
- Ascend 主 KV 转换先编码 scale，再用该编码读回值计算逆 scale，确保量化使用的系数与保存的系数相符，见 `make_kv_scale_impl` [C8]；模型产物约束见 `load_hf_model_config` [C9]。
- 上游 RFC 使用 A2（910B）、A3（910C）的称呼（来源第 10 条，社区讨论）[I]；这里只对照命名，不把 RFC 的计划项当成已实现功能或官方硬件规格。2026-11-03 已联网核对。
- CANN 官方 `aclnnMatmul` 的产品列表、输入类型表及 `cubeMathType` 约束支撑 A2/A3 的 FP16、BF16 算子能力 [S11]；`aclnnAllGatherMatmulV2` 明列 A2/A3 的 INT8、FP16、BF16 输入路径 [S12]。两份 8.5.0 路径文档于 2026-11-03 联网核读；接口类型不等同于每条硬件指令的原生类型，FP32 输入的实际计算还受降精度选项控制。
- main 的 INT8 示例、分块 FP8 元数据、950/其他代际分支和内存提示见固定指南 [S13]；A2/A3 的 Qwen3-Dense BF16 与 W8A8 支持项分别见 main、v0.23、v0.26 rc 的支持表 [S14][S15][S16]。两个发布分支指南的 INT8 示例与章节边界见 [S17][S18]。
- 点积、异常大值为教学假设 [A]，17 B 是完整 MXFP4 分组的格式推导 [D]。没有本站设备性能、任务质量或全格式互换实测。
- FP32/FP16/BF16 的字段位宽见 BFLOAT16 原论文表 1 [S19]，BF16 定义交叉核对 PyTorch 官方说明 [S22]；[1,2) 的间距是由尾数位数推导 [D]。FP8 的字段、特殊值和最大有限值对应原论文表 1 的两个具体变体 [S20]；NF4 和双重量化见 QLoRA 原论文 [S21]。

**待核：** 910B/910C 的完整硬件指令类型、每种 FP8 变体和 FP4/INT4 的逐算子支持矩阵，以及指定模型在指定镜像上的加载、精度与性能实测。本页已核资料足以回答“是否只能 FP8”，尚不能给任意硬件、模型与量化包作通用兼容保证。

- main 的线性层展开、950 分组回退、MLA 权重吸收与实际矩阵乘分派见 [C32]；rc2 的入口检查和同类权重处理见 [C27][C29]，其中模型类型初始化也单列为来源 28。文档所说无需离线重新量化，不等于没有加载期转换，也不决定所有层的驻留字节。
- dense attention 的 C8-MXFP 格式约定与静态 V scale 加载见 [C30]；它的逐 token 缓存写入和容量预算继续见[KV 量化页](kv-cache-quantization.md)。
