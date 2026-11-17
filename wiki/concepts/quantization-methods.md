---
id: quantization-methods
title: 量化方法与校准：PTQ、QAT、AWQ、GPTQ 怎样选择
type: concept
origin: direct
summary: >-
  从权重、激活、缓存分别量化出发，解释 W4A16、W8A8、分组粒度和校准，再比较 PTQ、QAT、RTN、AWQ、GPTQ、SmoothQuant
  的目标与代价；用等价缩放的手算例连接方法、量化产物和昇腾加载器，并区分加载时量化、工具导出格式与 GGUF 插件。
aliases:
  - PTQ
  - Post-Training Quantization
  - QAT
  - Quantization-Aware Training
  - AWQ
  - Activation-aware Weight Quantization
  - GPTQ
  - SmoothQuant
  - RTN
  - Round-to-nearest
  - QLoRA
  - 量化方法
  - 训练后量化
  - 量化感知训练
  - 校准
  - calibration
  - 校准集
  - W4A16
  - W8A16
  - W4A8
  - weight-only
  - per-tensor
  - per-channel
  - per-token
  - per-group
  - group_size
  - 混合精度
  - 量化回退
  - online quantization
  - 加载时量化
  - GGUF
  - bitsandbytes
  - AutoRound
  - ModelOpt
  - Quark
  - TorchAO
  - quantization_config
chapters:
  - '11'
  - '19'
order: 20
sources:
  - 'https://pytorch.org/blog/quantization-in-practice/'
  - 'https://pytorch.org/blog/quantization-aware-training/'
  - 'https://arxiv.org/html/2211.10438v6'
  - 'https://arxiv.org/html/2306.00978v4'
  - 'https://arxiv.org/html/2210.17323v2'
  - 'https://arxiv.org/html/2305.14314v1'
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/quantization.md#L13-L19
  - >-
    vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/quantization.md#L34-L107
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/quantization.html
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L105-L125
  - >-
    vllm-ascend@7d825229:docs/source/user_guide/feature_guide/quantization.md#L105-L125
  - 'vllm-ascend@7d825229:vllm_ascend/quantization/configs/fp8_config.py#L26-L111'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L124-L239
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelslim_config.py#L801-L835
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/user_guide/feature_guide/quantization.md#L105-L125
  - 'vllm@0fc695fc:docs/features/quantization/online.md#L1-L139'
  - 'vllm@0fc695fc:docs/features/quantization/llm_compressor/fp8.md#L1-L139'
  - 'vllm@0fc695fc:docs/features/quantization/llm_compressor/int4.md#L83-L173'
  - 'vllm@0fc695fc:docs/features/quantization/llm_compressor/int8_w4a8.md#L75-L173'
  - 'vllm@0fc695fc:docs/features/quantization/llm_compressor/int8_w8a8.md#L86-L148'
  - 'vllm@0fc695fc:docs/features/quantization/auto_awq.md#L1-L82'
  - 'vllm@0fc695fc:docs/features/quantization/gptqmodel.md#L1-L99'
  - 'vllm@0fc695fc:docs/features/quantization/bnb.md#L1-L56'
  - 'vllm@0fc695fc:docs/features/quantization/inc.md#L1-L89'
  - 'vllm@0fc695fc:docs/features/quantization/modelopt.md#L1-L114'
  - 'vllm@0fc695fc:docs/features/quantization/quark.md#L1-L316'
  - 'vllm@0fc695fc:docs/features/quantization/torchao.md#L1-L43'
  - 'vllm@0fc695fc:vllm/config/quantization.py#L77-L175'
  - 'vllm@568afb3a:vllm/config/quantization.py#L1-L189'
  - 'vllm@ced6857a:vllm/config/quantization.py#L71-L278'
  - 'vllm@84030bbe:vllm/config/quantization.py#L71-L278'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/online/base.py#L1-L165'
  - 'vllm@ced6857a:vllm/model_executor/layers/quantization/online/base.py#L1-L393'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L263-L421'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/weight_utils.py#L240-L422'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/online/fp8.py#L58-L190'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/bitsandbytes_loader.py#L521-L556'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/torchao.py#L172-L211'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/torchao.py#L369-L399'
  - 'vllm@0fc695fc:docs/features/quantization/gguf.md#L1-L87'
  - 'vllm@568afb3a:docs/features/quantization/gguf.md#L1-L93'
  - >-
    https://github.com/vllm-project/vllm-gguf-plugin/blob/e454affe0ca23c9dc8754ec3033270cb30622ed5/README.md#L1-L103
  - >-
    https://github.com/vllm-project/vllm-gguf-plugin/blob/e454affe0ca23c9dc8754ec3033270cb30622ed5/vllm_gguf_plugin/plugin.py#L1-L148
  - >-
    https://github.com/huggingface/transformers/blob/6488cabb56d4bffe6d19ece65e8bd794c642ef93/docs/source/en/quantization/torchao.md#L540-L646
  - >-
    https://github.com/intel/auto-round/blob/a85997e19d97762172155c93c4dfc3fcc3976e71/docs/step_by_step.md#L492-L495
  - >-
    https://github.com/ModelCloud/GPTQModel/blob/be3852bf9871785f5fb8f01f359105590a5928b2/README.md#L1132-L1186
  - 'vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelopt_mxfp8_config.py#L1-L88'
  - 'vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelopt_mxfp8_config.py#L1-L88'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L606-L647'
  - 'vllm@0fc695fc:vllm/config/model.py#L996-L1096'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/quark/quark.py#L145-L220'
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/modelopt.py#L276-L361'
  - >-
    https://github.com/vllm-project/llm-compressor/blob/5dea0c4431bdc7e15d8d802edb250ea50ec2e78c/README.md#L185-L252
  - 'vllm@0fc695fc:vllm/model_executor/layers/quantization/__init__.py#L69-L192'
  - 'https://github.com/Ascend/msmodelslim/blob/3b3f5151521f0b2a0c1f29937fc735ba4938db43/example/Qwen3-MOE/README.md#L1-L115'
  - 'https://github.com/Ascend/msmodelslim/blob/3b3f5151521f0b2a0c1f29937fc735ba4938db43/example/Qwen3-MOE/quant_qwen_moe_w8a8.py#L47-L195'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/quantization.md#L13-L59'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/quantization.md#L13-L59'
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/quantization.md#L13-L59'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/quantization.md#L13-L59'
relations:
  - to: quantization
    kind: builds-on
    note: 先理解 scale、zero-point、舍入和整数矩阵乘，再选择怎样得到量化参数
  - to: low-precision-formats
    kind: builds-on
    note: 方法名不指定全部数值编码；FP8、FP4 与分组缩放由格式页解释
verified: []
evidence: S
contradicts: []
updated: 2026-11-03T00:00:00.000Z
---

## 一份量化方案究竟决定哪些事？

**量化方案决定压哪些张量、用什么编码、怎样确定缩放，以及推理时如何计算。** 权重是训练后的模型参数，激活是本次输入在层间产生的中间值，KV cache 是留给后续生成使用的历史状态；三个对象可以分别选择精度。

```wiki-diagram
file: quantization-methods-intuition
```

上图中的 scale 是缩放系数，负责把低位编码解释回近似数值；基本舍入过程见 [W8A8 量化](quantization.md)。方法的工作是让这些近似对模型更合适，而最终速度还取决于算子能否直接使用生成的产物。

**W 表示 Weight，A 表示 Activation，后面的数字表示位数。** W4A16 表示权重 4 位、激活 16 位，常见于 weight-only（只量化权重）方案；W8A8 则将两边都压到 8 位。W8A16、W4A8 按同样规则读。位数标签尚未说明是整数还是浮点、怎样分组，也没有规定累加和输出类型。本站固定 GLM 的 W8A8 是 INT8 路径，其他模型要查自己的元数据。

有些部署名追加 C8，C 指 Cache，表示缓存也采用 8 位。权重包写着 W8A8 并不会自动把 KV cache 变成 C8；具体缓存路径见 [KV cache 量化](kv-cache-quantization.md)。

## 为什么同样四位，有的模型误差更大？

**一个张量里数值范围不同，输入对不同权重误差的敏感程度也不同。** 将每个权重独立舍入到最近编码，是 RTN（Round-to-nearest，最近舍入）的基本想法。它容易实施，但只看单个数离格点多远，没有充分利用这个数怎样参与模型计算。

举一个示意：同样 0.01 的权重误差，若对应输入是 100，给点积带来的变化是 1；若输入是 0.1，变化只有 0.001。真实模型中还有正负抵消和通道相关性，所以只比较权重的平均误差，可能错过真正影响输出的部分。

减少误差可以从几处入手：缩小共享系数的分组、调整量化前的数值分布、量化一个权重时补偿其他权重，或者让模型在训练中适应这种误差。它们有不同成本，也能在满足实现条件时组合。

## per-tensor、per-channel、per-token、per-group 差在哪？

这些名称说的是**哪些元素共用一套量化参数**。per-tensor 是整张量一套；per-channel 是一个通道一套；per-token 是一个 token 的向量一套；per-group 则把指定轴切成较短的组，各组一套。

以数学权重 W 的“输入维 × 输出维”为例，per-output-channel 是每列共享系数；若 checkpoint 以转置方向保存，文件中的“每行”就对应数学上的“每列”。因此必须同时记录逻辑轴、实际 shape 和分组方向。group size=128 只说明每组 128 项，没说沿哪个轴分。

粒度细通常能减少范围差异的影响，但要多存系数，并要求算子支持。取同一列 256 个 INT4 权重、每组配一个 FP16 scale、无 zero-point 和补齐作为示意：

```calc
title: 分组越细，附加系数越多（示意条件）
四位载荷 = 256 × 4 ÷ 8 = 128 B
每 128 项一组 = 128 B + (256 ÷ 128) × 2 B = 132 B
每 32 项一组 = 128 B + (256 ÷ 32) × 2 B = 144 B
后一方案每权重平均位数 = 144 × 8 ÷ 256 = 4.5 bit
```

这解释了“4 位模型”实际每权重平均占用为何大于 4 位。若真实产物包含零点、高精度层、打包对齐或 [NZ 补齐](tensor-layout.md)，还要把这些开销逐项加进去。

## 校准是在做什么，动态量化还需要吗？

**校准（calibration）是用样本观察数值分布，为量化确定参数或变换。** 方法不同，观测的用途也不同：确定数值范围、选择截断阈值、搜索缩放，或估计层输出对量化误差的敏感性。简单 min-max 保留观测到的最大范围；百分位或误差目标允许舍弃少量极端值，给大多数值留下更细的格点。是否值得截断由评估决定。

校准数据应覆盖准备服务的语言、任务、长度和输入形式。比如只校准短英文问句，很难据此判断长中文材料或多模态输入的数值分布。MoE 是按 token 选择部分专家的结构；样本若没有激活某些专家，就没有为它们提供同等充分的输入证据。另留验证样本检查质量，避免只对校准集作结论。

静态激活量化将系数在部署前定好；动态激活量化在运行时依据当前输入计算系数。**动态只解决“本次激活系数何时产生”，不意味着整个量化流程无须校准。** 动态 W8A8 的离群值处理、AWQ 的权重缩放或 GPTQ 的误差补偿仍可能使用离线样本。

记录一次校准至少要保留数据版本、抽样方式、模板和分词器、样本数与长度分布、量化工具和配方，以及量化后各层的实际精度。不存在不看模型与任务就通用的“足够样本数”。

## PTQ 和 QAT 怎样得到可部署的模型？

**PTQ 是 Post-Training Quantization，训练后量化。** 从已有模型出发，通过统计、搜索或层级重构得到量化参数，不要求完整重跑原模型训练。RTN、AWQ、GPTQ、SmoothQuant 都可出现在训练后量化流程中；“训练后”也不等于没有计算成本。

**QAT 是 Quantization-Aware Training，量化感知训练。** 训练或微调时模拟“量化再还原”的数值误差，让优化过程适应它；这种 fake quantization（伪量化）常仍用浮点张量承载舍入后的值。结束后还需转换、导出成目标算子能读的真正低位产物。

QAT 会增加训练资源和时间，数据与目标格式也必须匹配。它描述训练过程；静态、动态描述推理时激活系数的产生时机，两组分类可以交叉。QLoRA 则是另一项训练技术：冻结量化基座，通过它把梯度传给可训练的低秩适配器；不能仅凭名称中的“量化”把它等同于所有权重都参与更新的 QAT。

## AWQ、GPTQ、SmoothQuant 分别改变什么？

**AWQ（Activation-aware Weight Quantization，激活感知的权重量化）**利用离线激活统计，寻找重要的输入通道，通过通道缩放降低权重量化对输出的影响。它主要面向低位 weight-only；“activation-aware”说的是参考激活分布，不是宣称激活也被压成四位。原方法用缩放保护重要通道，不能简化成“把重要的 1% 权重永远保留 FP16”。

**GPTQ** 是论文《GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers》的方法名。它使用校准输入得到近似二阶信息，逐步量化权重并调整尚未量化的部分，减小层输出的重构误差；工程上采用分块更新等办法控制成本。这里的二阶信息衡量误差对输出损失的影响，不意味着重新训练整个语言模型。原论文聚焦权重量化，没有同时承诺激活量化。

**SmoothQuant** 为 W8A8 路径处理激活离群值：在量化前将部分数值范围从激活转移到权重。它不是增加一个新的数值编码，而是先做保持线性层数学结果不变的变换，再量化。平滑强度过大又会使权重更难量化，需要两边一起权衡。

这些方法解决的重点不同，原论文报告的硬件、模型和速度也不同。选择时看目标层、目标算子与本任务的精度预算，不能将论文速度直接写成本站 A2 双机的预期收益。

## 等价缩放为什么能改变量化难度？

用同一个点积演示 SmoothQuant 所用变换的数学基础。激活 x=(20,1)，权重 w=(0.1,1)，将第一个输入通道除以 10，同时将对应权重乘以 10。下例只演示变换，取 10 是教学假设，不是校准所得最优值。

```calc
title: 量化前改变范围，原点积保持不变（示意）
原点积 = 20 × 0.1 + 1 × 1 = 3
变换后激活 = (20 ÷ 10, 1) = (2, 1)
变换后权重 = (0.1 × 10, 1) = (1, 1)
变换后点积 = 2 × 1 + 1 × 1 = 3
激活最大绝对值 = 20 ÷ 10 = 2
```

若用对称 INT8 的最大值定系数，激活步长由 20/127 变为 2/127；权重第一项同时变大，所以要检查权重侧能否承担这个变化。一般矩阵形式是 XW=(XD⁻¹)(DW)，D 是对角线上放通道缩放的矩阵。数学等价只对量化前的精确计算成立；两侧分别舍入后，最终误差要重新评估。

AWQ 也使用通道缩放，但选择尺度的目标和量化对象不同。共同的代数形式并不使两个算法成为同一个方法；GPTQ 的核心则是逐步补偿误差。

## 文件已经量化、加载时量化、每步量化，各发生在什么时候？

**先看权重何时转换，再看激活何时转换。** 官方材料里的 online quantization 指在引擎加载原精度权重时转换权重，不是“只有 HTTP 在线服务才能量化”。Python 离线引擎也能走同一路径；它与每次前向计算激活的系数，是两件独立的事。

| 环节 | 输入和工作 | 下一步交出去什么 |
| --- | --- | --- |
| 部署前制作量化包 | 工具读取原模型，按配方校准或直接舍入，选择保留高精度的层 | 量化权重、系数、量化配置、模型配置和分词器文件 |
| 引擎加载 | 读取已量化包；或在支持的 online 路径把原精度权重转换，再按算子要求整理布局 | 模型各层实际驻留的权重与量化方法 |
| 每次前向 | 动态激活方案根据本次输入产生系数和低位激活；静态方案使用事先确定的系数 | 本层输出，交给后续层继续算 |

例如 LLM-Compressor 的 `FP8_DYNAMIC` 配方，权重在制作模型包时已经转换，激活在推理时按 token 动态量化。它使用简单 RTN，不需要校准数据。另一份 W8A8 教程先做 SmoothQuant，再用 GPTQ 处理权重，虽然激活仍是动态方案，却要用样本完成前面的优化。**不能仅凭文件名中的 Dynamic 判断有没有校准，也不能因为调用了 GPTQ 就把产物认作 GPTQ 文件格式。** 该教程保存的是 compressed-tensors 产物。

加载时量化也会占用时间与临时内存。以所列上游 FP8 线性层实现为例，它先接收原精度权重，再生成低位权重和 scale，之后前向调用选中的量化算子。最终文件大小、加载峰值和运行时驻留量是三个口径，不能把“权重每元素从两字节降为一字节”直接当作进程峰值减半。

## 官方列了这么多工具，怎样辨认它们产生的模型？

先把**算法、导出格式和推理实现**分开。工具可能实现多种算法，同一种算法也可能导出不同格式。下面列的是上游教程的承接关系；最后一列是拿到模型包时需要检查的内容，不是昇腾兼容矩阵。

| 工具或入口 | 教程中承担的工作 | 模型包与部署时要核对什么 |
| --- | --- | --- |
| LLM-Compressor | 用 RTN、GPTQ、SmoothQuant 等配方制作 FP8、W4A16、W4A8、W8A8 模型 | compressed-tensors 配置的目标层、位宽、分组、激活方案和忽略层；同为八位仍要区分 INT8 与 FP8 |
| AutoAWQ、GPTQModel | 制作或读取 AWQ/GPTQ 系列量化模型 | 量化配置、权重打包、group size、零点和层级覆盖；仅凭算法名称不保证融合后的层能加载 |
| AutoRound / Intel Neural Compressor | 搜索或调整量化方案，并选择导出格式 | `scheme` 选数值方案，`format` 选产物格式；例如选择 AutoAWQ 格式不等于执行了 AWQ 缩放算法 |
| NVIDIA Model Optimizer | 校准、量化并导出模型 | `hf_quant_config.json` 或模型配置里的量化信息、`quant_algo`、忽略层；FP8、NVFP4、MXFP8 不能只按文件扩展名识别 |
| AMD Quark | 配置权重、激活和可选 KV 方案，校准、冻结并导出 | 导出的量化配置、权重/scale/zero-point 和 export 信息；KV 方案还要与运行时缓存配置相接 |
| TorchAO | 按 PyTorch 量化配置制作张量，或在加载后转换权重 | 量化配置的序列化结构、TorchAO 版本和张量布局；导出环境与加载环境都要匹配 |
| bitsandbytes | 读取预量化模型，或在专用加载路径转换原精度权重 | 两条加载路径的条件不同；固定上游实现拒绝预量化 bitsandbytes 包配 TP>1，不能把加载时转换路径的并行能力套过去 |

固定 AutoAWQ 指南已提示该工具库弃用，新制作 AWQ 模型转向 LLM-Compressor；工具库停止维护不等于 AWQ 方法失效。

工具名称后面的支持列表有自己的硬件范围。例如上游 W4A8 教程明确介绍 Arm CPU 的 KleidiAI 路径，ModelOpt 与 Quark 的示例分别有 NVIDIA、AMD 的部署条件。这些材料说明“另一条路径怎样工作”；本站 NPU 部署仍以 [Ascend 的逐层配置与算子选择](quantization.md#怎么开)为准。

拿到包后可以先做一个不加载权重的检查：查看 `config.json` 的量化信息、是否另有 `quant_model_description.json` / `hf_quant_config.json`、实际张量名称与形状，以及生成工具记录的版本和配方。vLLM 会据此选择方法，再检查平台、层类型、激活 dtype 等条件；**`--dtype bfloat16` 管普通浮点部分，不会把不兼容的四位文件变成另一种量化包。**

混合精度还要对齐推理时的融合边界。假设源模型把 Q、K、V 写成三个模块，加载器将它们拼成一个 QKV 层，那么只让 Q 保持浮点、K/V 使用另一种打包，并不保证这个融合层有对应实现。GPTQModel 的逐模块覆盖说明专门提醒了这一点；它那里叫 `dynamic` 的配置指按模块覆盖精度，与每个 token 动态计算激活系数也不是同一含义。

## 用 ModelSlim 制作模型时，哪些材料要一起交给推理端？

**先选择模型专用配方，再把权重、量化描述与原模型的配置一起交付。** ModelSlim 负责制作量化产物，vLLM Ascend 负责读取并执行；二者的环境和版本分别核对。制作阶段还要加载原模型、处理校准样本并保存结果，需要主机内存、设备内存与磁盘空间。

以官方量化指南链接的 Qwen3-MoE 配方为例，流程是：读取浮点模型和 tokenizer，用一组样本做反异常值处理，调整不利于量化的数值分布，再用校准样本确定量化参数，最后保存权重与描述文件并复制模型配置。这两组数据各有用途；只看到最后的动态 MoE 精度，不能省去前面的样本处理。

该配方还有一个具体的混合精度例子：attention 使用 W8A8，MoE 使用动态 W8A8，负责选择专家的 gate 保留高精度。同一个模型包里已经有不同的处理规则，所以推理端要读逐层描述，而不能把文件名里的 W8A8 当作每层唯一格式。配方的设备可见性和多卡设置用于制作阶段，服务部署的 TP / DP 则要另按模型大小、硬件和执行支持选择。

交付时保留原模型版本、工具提交、配方、两组样本及 tokenizer，检查输出目录中的权重分片、量化描述、模型配置和分词器文件是否齐全。先验证目标运行时能识别并加载，再用独立样本比较质量、容量和稳态速度，验收方法统一见[量化验收](quantization-evaluation.md)。Qwen3 的配方只证明这个示例怎样制作；本站 GLM 量化包的具体校准过程仍需它自己的记录。

## GGUF 为什么还要配置分词器或安装插件？

**GGUF 是模型容器格式，里面可以承载不同量化类型。** 它没有自动解决模型结构识别、tokenizer 转换和设备算子的兼容问题。上游示例既支持本地 `.gguf` 文件，也支持 `仓库名:量化类型` 的选择方式；建议使用原模型的 tokenizer，避免大型词表的转换耗时与兼容问题。若 GGUF 元数据不能被转换成模型配置，还需要匹配的 `--hf-config-path`。

四个教学版本也有差别：v0.23 对应上游快照保留内置 GGUF 路径，只接受单个 GGUF 文件，多分片要先合并；v0.26 起所列固定文档改为独立的 `vllm-gguf-plugin`，rc2 与 main 对应文档相同。旧内置路径的单文件限制不能直接套给后续插件。插件注册量化方法、模型加载器和配置解析器，安装与正常加载是两个需要接上的步骤，机制见[插件入口](platform-plugin-registration.md)。固定插件 README 的设备前提是 CUDA 或 ROCm，不能据此给 GLM 的 Ascend 双机命令换上 GGUF 包。

TorchAO 也有类似的“能保存不等于任意环境能重载”问题。所列 Transformers 文档区分 TorchAO 0.15 前后的序列化方式，并提示 INT4 布局与设备有关；这是该工具链的条件，不应照抄旧教程里的保存参数后就认定所有版本兼容。应同时检查本次 vLLM 的 TorchAO 读取结构与实际重打包分支。

## 从方法到 GLM 双机，中间还差哪些环节？

**方法产出的是量化模型；加载器必须读懂它，后端算子必须能执行它。** ModelSlim 是面向昇腾的模型压缩工具；LLM-Compressor 是另一个量化工具链；它们与 AWQ、GPTQ 这类算法名称、W8A8 这类精度标签属于不同层次。

```wiki-diagram
file: quantization-methods-flow
```

模型产物至少要把低位权重、系数、零点或其他元数据，以及哪些层保留浮点说明清楚。若文件方向或打包方式与算子要求不同，加载后还要转置、[打包或转 NZ](tensor-layout.md)。仅修改模型配置中的精度名字不会产生相应权重数据，也不能把任意算法产物变成另一个加载器接受的格式。

本站 [GLM 双机前提](glm-5-3-flash-two-node.md#部署前提)使用配套 W8A8 包，主线位置是加载阶段准备权重、[第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)使用量化算子。实际每层方案由描述文件决定。已取得并核对两份固定快照的逐层描述，二者的 MLA 投影精度存在差异，详见 [GLM 的逐层量化范围](quantization.md#哪些矩阵是-8-位哪些保持-bf16)。这些文件说明每层采用的精度，尚不能还原离线校准数据与工具配方，因此不能从“W8A8”推断它采用了 AWQ、GPTQ 或某一种平滑算法。

混合精度允许敏感层保留更高精度，以较小容量代价换取质量。这里的“回退”是重新生成或加载具有相应高精度权重的层；已经舍入丢失的信息不会因改回浮点 dtype 自动恢复。选好候选后，还需做[精度、容量与性能验收](quantization-evaluation.md)。

## 常见误解

- **动态量化等于 PTQ，静态量化等于 QAT？** 一个区分运行时系数，一个区分训练流程。
- **AWQ 参考激活，就一定量化激活？** 原方法重点是低位权重，激活用于选择缩放。
- **group size 越小一定越好？** 系数成本、算子支持和实际质量都需要一起比较。
- **支持 INT4 的芯片能直接跑任意四位模型？** 元素编码、分组、打包、加载器和算子接口仍要一致。
- **同属 W8A8，换个包就等价？** 这个标签没有描述分组、校准、保留浮点的层及量化元数据，换包时要逐项核对。

## 对照源码

### 怎么开

固定文档将 ModelSlim 产物通过 `--quantization ascend` 接入；LLM-Compressor 产物使用自身的配置识别。实际格式仍由加载器校验，完整逐层选择见 [W8A8 源码区](quantization.md#怎么开)。可阅读对应的[官方量化指南](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/quantization.html)。

该指南使用 ModelSlim 26.0.0。其 Qwen3-MoE 示例要求制作环境的 Transformers 4.51.0；这是该工具配方的要求，推理环境仍按[Ascend 软件配套](cann-hccl.md#装了-cann为什么还不能直接运行模型)准备。以下片段对应 **Qwen3-30B-A3B 的 W8A8 混合量化**，在配方的 `example/Qwen3-MOE` 目录运行，两个模型路径换成实际输入与输出目录，校准 JSON 使用配方自带文件或经验证的对应数据；自定义模型代码需要可信来源：

```bash
python3 quant_qwen_moe_w8a8.py \
  --model_path /path/to/float-model \
  --save_path /path/to/quantized-model \
  --anti_dataset ../common/qwen3-moe_anti_prompt_50.json \
  --calib_dataset ../common/qwen3-moe_calib_prompt_50.json \
  --trust_remote_code True
```

同一指南为 Qwen3-235B-A22B 的 W8A8 配方另加 `--rot`，开启基于旋转矩阵的预处理；模型换了，应使用对应配方。在本文固定配方中，`layer_count=0` 才处理全部层；调试时仅选前几层的结果不能当作完整模型。默认导出 `ascendV1` 格式和 `quant_model_description.json`；`mindie_format` 切换为面向旧 MindIE 的保存方式及另一描述文件名，不能仅因后缀仍是 safetensors 就认作同一加载格式。进入推理阶段后指向输出目录；`--quantization ascend` 选择的是加载方法，不会替你执行这段离线校准脚本。

若研究的是**上游支持设备上的加载时量化**，`--quantization` 选择方法，`--quantization-config` 描述该方法要处理哪些层。下面是固定上游四版都能表达的参数结构片段，模型与设备还须支持所选方法；它不用于替换上面的 Ascend 双机配置：

```bash
--quantization online \
--quantization-config '{"linear":{"weight":"fp8_per_tensor_static"},"ignore":["lm_head"]}'
```

Python 对应 `quantization="online"` 与 `quantization_config={...}`。此例只给 `linear`，没有给 `moe`，所以不能理解成全模型所有权重都会变成 FP8。默认 `linear=None`、`moe=None`、`ignore=[]`；`online` 本身没有替你选择数值格式。只传配置而不选方法，也不能保证一个普通浮点模型会走 online 路径。

`--quantization fp8_per_tensor` 之类简写会展开为预设。显式配置覆盖的是整份 linear 或 moe 规格，不是替预设逐个补字段。例如仅填写 `linear.activation`，不会自动保留预设的 `linear.weight`。所列纯 online 消费者在 weight 未设时不启动该层的在线权重量化；选好已实现的 weight 方案后，再显式填写 activation 会被拒绝。已有量化 checkpoint 的激活覆盖另由相应配置类决定，不能从字段存在推断任意组合都可用。

### 会报什么错

缺层描述、融合分片的精度不一致、方法与层类型组合未注册，都可能在加载时失败。能够加载也只证明通过了这部分契约，质量与执行收益继续由验收页判断。

上游还会拒绝显式方法与识别到的 checkpoint 方法冲突、不支持的设备能力或激活 dtype，以及缺少所需量化配置的情况。按“模型包 → 方法识别 → 配置解析 → 层与融合分片 → 算子”的顺序定位，能区分文件格式问题和执行支持问题；改一个方法名无法补出缺失的权重或 scale。

### 开销和什么时候别开

PTQ 要承担校准、搜索或重构成本，QAT 还需要训练；推理阶段有系数、动态量化、反量化和布局成本。缺少目标算子、校准覆盖或质量余量时，先保留已验证的高精度方案，缩小候选到某些层再比较。

### 版本差异

四个 Ascend 教学快照的量化指南均将 ModelSlim 26.0.0 和 Qwen3-MoE 示例作为制作入口；指南相同只说明推荐入口相同。本页额外核对的是该工具 26.0.0 分支的固定提交及脚本，不能由此补出 GLM 模型包未公开的配方，也不把较新 ModelSlim 快速开始里的模型、Transformers 版本或卡数套回这个示例。

**v0.30.0rc2 继续区分量化算法、存储格式和实际执行 scheme。** 官方量化指南与已钉 main 相同，原生 FP8 loader 仍只接受 block-wise、dynamic activation_scheme，跳过层走普通方法。950 上满足分组条件的线性层可重组为 MXFP8；被 attention 吸收的 kv_b_proj、分组不匹配的层和其他硬件走 model dtype。这不能作为 AWQ/GPTQ 等算法自动获得支持的证据。

ModelSlim 新增 C8-MXFP attention scheme，只有显式 kv-cache-dtype=mxfp8 才开启；checkpoint 的模型级 kv_cache_type 或逐层 self_attn.quant_type 只说明 scale recipe。它面向标准 full Attention，不把 GDN/Mamba/encoder 状态套成同一种 KV 方法；具体 PCP/DCP、PD 和缓存张量限制见 [量化版本对照](quantization.md#版本差异)。

本页方法定义依据论文和工具文档，不把三条 Ascend 分支标为全部算法已验证。下面比较的是实际读过的量化指南，不能当作每种算法、硬件与模型的兼容矩阵。

| 文档快照 | 已核对的内容 | 使用时意味着什么 |
| --- | --- | --- |
| v0.23 维护分支，2026-09-09 | 量化指南与固定 GLM 提交相同，介绍 ModelSlim、LLM-Compressor 与 W8A8 示例 | 按产物类型选加载入口 |
| v0.26 rc 分支，2026-09-17 | 该指南文件内容与上述快照相同 | 文档相同不代表全部执行实现相同 |
| v0.30.0rc2，固定快照 | 指南包含原生 FP8 增量，另有 ModelOpt MXFP8 配置类 | 仍按实际硬件与逐层方法确定执行路径 |
| main，2026-09-22 固定快照 | 指南另增原生 block-wise FP8 checkpoint 的说明：950 与其他代际采用不同加载后路径 | 文件里一字节不保证所有硬件上驻留权重仍一字节 |

加载时量化的上游接口另外按四个固定点比较。main 这里只作独立比较点，不据此认定它与 Ascend main 精确配套。

| 教学版本对应上游 | 配置与消费者变化 | 不能省略的条件 |
| --- | --- | --- |
| v0.23 / `0fc695fc` | linear、moe、ignore；预设包含 per-tensor、per-block FP8 等 | 显式预量化方法再叠加 quantization-config 被入口拒绝；纯 online 只执行已实现的 weight 组合 |
| v0.26 / `568afb3a` | 新增 per-channel FP8 与仅 MoE 的 nvfp4_per_token 预设 | 后者的 Blackwell / FlashInfer 条件不代表 NPU 支持；原有入口组合限制仍在 |
| v0.30.0rc2 / `ced6857a` | 新增按层 targets；预量化配置可与 online 配置组合；MXFP4/MXFP8 可等待 checkpoint 信息后再决定 | targets 与 linear/moe 不能混填；融合分片必须一致；组合不表示任意已量化层都能再次转换 |
| main / `84030bbe` | 本表涉及的配置定义及 online 消费者与 rc2 同文 | 同文范围不扩展为全部加载器、算子或设备行为相同 |

Ascend rc2 与 main 还会将 `mxfp8` / `modelopt_mxfp8` 注册到自己的 ModelOpt MXFP8 配置类，由它选择 Ascend 的线性层或 MoE 方法。上游注册表允许插件替换同名类，因此看到相同字符串不能直接推出“这里执行的就是上游在线转换”。

### 源码位置

- 校准和量化粒度的基础见 PyTorch 实践说明 [S1]；QAT 的伪量化、导出与训练成本见 PyTorch QAT 说明 [S2]。
- SmoothQuant 的等价缩放见论文 §4 [S3]；AWQ 的激活统计、通道缩放和 weight-only 范围见 §3 [S4]；GPTQ 的目标与分块补偿见 §3–4 [S5]；QLoRA 的冻结基座和适配器训练见原论文 [S6]。
- 工具与加载入口对应来源表第 7–9 项；main 的原生 FP8 增量对应第 10 项。四版所列的 ModelSlim 安装与 Qwen3-MoE 配方入口见来源 57–60。
- ModelSlim Qwen3-MoE 的安装依赖、模型范围和示例命令见来源 55；反异常值与量化数据的分别读取、gate 跳过、混合精度、保存格式及配置复制见来源 56。这里核对的是工具流程，未执行 NPU 量化。
- rc2 的 FP8 配置校验、跳过层与线性层实际转换分支见 [C12][C13]；C8-MXFP 的启用开关与 recipe 区别见 [C14]。逐层精度以 [GLM 的量化描述](quantization.md#哪些矩阵是-8-位哪些保持-bf16)所列固定文件为准。
- 0.01 的误差传播、256 项分组账和通道缩放小例子采用教学数据 [A]，相应算术为推导 [D]；没有本站各算法的 NPU 对比实测。
- 制作模型包、加载转换与动态激活的区别对应来源 16–20 的在线量化及四种 LLM-Compressor 配方，工具主流程另见来源 53。各工具与产物入口对应来源 21–27；算法与导出格式的独立性对应 AutoRound 固定说明（45），逐模块覆盖和融合限制对应 GPTQModel（46）。
- 上游四版配置定义对应来源 28–31，纯 online 消费者及组合分支对应 32–33；模型配置读取与加载后 FP8 转换对应 34–36，方法识别、平台/dtype 校验对应 49–50。bitsandbytes 预量化 TP 限制对应来源 37。
- TorchAO 的读取与加载后处理对应来源 38–39，工具序列化条件对应 44；Quark、ModelOpt 读取的元数据对应 51–52。GGUF 的内置/插件文档差异对应 40–41，插件设备前提和注册消费者对应 42–43。
- Ascend rc2/main 的同名 MXFP8 注册与层方法选择对应来源 47–48；上游允许自定义量化类覆盖注册表的实现对应来源 54。此处没有执行任何量化工具或 NPU/GPU 推理，工具支持与运行效果仍须按目标环境验收。
