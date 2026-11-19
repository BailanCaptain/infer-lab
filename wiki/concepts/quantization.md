---
id: quantization
title: W8A8 与 Ascend 量化：怎样压到 8 位、按层与硬件怎么选路
type: feature
summary: >-
  量化把权重和激活换成较少位数并保留缩放系数。本页先讲清缩放、零点、舍入、截断与反量化，以及 W8A8 矩阵乘的四步计算，再按 vllm-ascend
  v0.30.0 基线结合 Qwen3-8B 与 Qwen3-30B-A3B 说明显存节省、动态/静态/PD 混合（W8A8_MIX）与原生 block-wise FP8
  在不同昇腾硬件上的选路差异。
aliases:
  - 量化
  - Quantization
  - W8A8
  - W8A8_DYNAMIC
  - W8A8_MIX
  - w8a8_pdmix
  - INT8
  - ModelSlim
  - AscendModelSlimConfig
  - AscendFp8Config
  - fp8_block
  - quant_model_description.json
  - 动态量化
  - 静态量化
  - 缩放系数
  - scale
  - zero-point
  - 零点
  - 对称量化
  - 非对称量化
  - 舍入
  - clipping
  - 截断
  - 反量化
  - dequantization
  - dtype
  - '--dtype'
  - '--quantization'
  - 模型计算精度
chapters:
  - '11'
sources:
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/quantization.md#L1-L179'
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/aolapi/context/ops-nn/aclnnDynamicQuant.md
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L101-L108'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/utils.py#L140-L265'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/utils.py#L140-L235'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L108-L125'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L266-L355'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L465-L522'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L660-L771'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L816-L860'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/registry.py#L20-L62'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/fp8_config.py#L26-L144'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L124-L297'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L129'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L60-L154'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L279-L300'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L407-L501'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_static.py#L33-L145'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/w8a8_pdmix.py#L36-L93'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w4a8/w4a8.py#L44-L60'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w4a8/w4a8.py#L583-L600'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1444-L1515'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/kv_cache/turboquant/config.py#L15-L95'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L281-L343'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L243-L373'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/token_dispatcher.py#L162-L287'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/dataclass/moe_quant.py#L40-L100'
  - 'vllm@ced6857a:vllm/config/model.py#L170-L240'
  - 'vllm@ced6857a:vllm/config/model.py#L1258-L1360'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L105-L120'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L298-L306'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen2.py#L81-L109'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen2.py#L370-L375'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L167-L213'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L279-L295'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L459-L464'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L571-L578'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L167-L229'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L295-L345'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L583-L588'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L849-L855'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L14-L75'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_pdmix.py#L36-L90'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_pdmix.py#L37-L91'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_dynamic.py#L47-L151'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L340-L349'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L425-L433'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L316-L322'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L417-L440'
  - 'vllm-ascend@c09d3e20:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L15'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 矩阵乘讲清 Y=XW 与权重的存法，本页讲操作数换成低精度后多了哪两步
  - to: glm-5-3-flash
    kind: builds-on
    note: 历史 GLM-5.3-Flash 双机部署的逐部件文件精度在模型页，本页保留该历史子表与选路规则
  - to: expert-parallel
    kind: builds-on
    note: 专家权重和 dispatch 的 int8/MXFP 载荷都出现在 MoE 这一站
  - to: cann-hccl
    kind: builds-on
    note: 量化改变的是交给通信的张量类型，字节账在通信页
  - to: kv-cache-quantization
    kind: alternative-to
    note: 同样是降精度，但对象是历史状态、写在缓存里，收益和误差都另算
contradicts: []
updated: '2026-11-18'
origin: direct
---

## 量化是什么？

**量化（quantization）把一个张量换成位数更少的格式，同时保存一组缩放系数（scale），用来把少位数的数换回原来的数值范围。** 张量是模型里成批的数：权重是训练好、长期驻留的参数；激活（activation）是当前这批输入走到某一层时算出的中间结果。

BF16 是 16 位浮点格式，每个数占 2 字节；INT8 是 8 位整数，每个数占 1 字节，一共只能表示 -128 到 127 这 256 个值。从 BF16 换成 INT8，每个数就从 2 字节变成 1 字节。下图先用立体拆解建立整体直觉——左边宽柱是 BF16 连续浮点数，中间经过共用 `scale` 标尺卡进右边窄一倍的 INT8 整数格，超出上限的大数在 `127 CLIP` 红线处被削顶截断：

```wiki-diagram
file: quantization-plate-scale-hook
```

整数装不下 `0.26` 这样的小数，所以先定一个缩放系数，比如 `0.1`（示意），每个数只记「它大约是 `0.1` 的几倍」：`0.26` 记成 `3`，`1.04` 记成 `10`，`-0.18` 记成 `-2`。要用的时候再乘回 `0.1`，得到 `0.3`、`1.0`、`-0.2`，和原来只差一点。`13` 本该记成 `130`，超出了 INT8 的上限 `127`，只能记成 `127`，还原成 `12.7`。下图就是这四个数：

```wiki-diagram
file: quantization
```

一批数共用一个缩放系数（整个张量一个，或者每行、每列、每组各一个），所以多存的只是少量系数，大头的数都从 2 字节变成了 1 字节。

**W8A8 的含义是这一层的权重（W）和参与矩阵乘的激活（A）都用 8 位表示。** W/A 后的数字只交代位数，具体是 INT8 还是 FP8/MXFP8 要看方案：例如 ModelSlim 的 `W8A8_DYNAMIC`、`W8A8` 和 `W8A8_MIX` 用 INT8，而原生 block-wise FP8（`fp8_block`）或 `W8A8_MXFP8` 用 8 位浮点。它也不等于模型里所有张量都变成 8 位：累加结果、缩放系数、层间传递的隐藏向量（每个 [token](token.md)，即文本切出的离散编号在模型里对应的那排数）都可以是别的格式。

读这一组知识可以按问题前进：本页先讲一个数怎样量化与 W8A8/FP8 的执行分派；[数值格式](low-precision-formats.md)比较 BF16、FP16、INT8、FP8、FP4 与 MXFP8；[量化方法](quantization-methods.md)解释校准、PTQ/QAT、AWQ/GPTQ/SmoothQuant；[ND 与 NZ](tensor-layout.md)解释数值不变时怎样重新排布；[KV cache 量化](kv-cache-quantization.md)讲历史状态；[量化验收](quantization-evaluation.md)把误差、任务质量、容量与速度放到同一次对照里。

## 为什么需要量化？

**在权重常驻显存的部署中，模型权重放在计算卡的内存里，执行时从内存层次读进计算单元；同一批元素存得越宽，权重载荷就越大。** 权重卸载是另一种部署方式，不能把常驻要求扩大到所有推理实现。

先看占多少。大模型动辄几百亿、上千亿个参数，按 BF16 每个 2 字节，1,000 亿个参数（示意）光权重就是 200 GB，一张卡通常装不下，要多张卡分着放。卡上的内存（[设备内存](device-memory.md)，也常叫显存）除了权重，还要装 [KV cache](kv-cache.md)：生成文本时，模型把前面每个位置在每一层算出的两组向量（`k` 和 `v`，[attention](attention-qkv.md) 回头读上文时要用）存起来，下一步直接读，不必把旧位置重算一遍。权重占得越多，留给 KV cache 的就越少，能同时处理的请求和上下文长度也跟着变少。

再看搬运。普通自回归 decode 中，每条请求通常为一个新位置做前向，途中要读取本步实际使用的权重；MoE 只执行选中的专家，不能算成每步读取所有专家。批次很小时，同一份权重服务的输入行少，更容易受访存限制；批内复用、缓存和内核分块决定真实读取次数。投机解码还会在一次前向验证多个位置。

换成 8 位，同样权重元素的载荷减半；在读取集合与次数相同的比较里，这部分字节也减半。代价是近似误差，以及额外的系数、量化计算或硬件兼容性要求。下面先看一个数怎么压、差多少，再看一次矩阵乘怎样用 8 位算，最后落到 `vllm-ascend` `v0.30.0` 的标准部署账与选路。

## 一个数怎样压下去、再还原回来

先看最简单的对称量化：零点（下文说的整数偏移）固定为 0，只用一个正的缩放系数 $s$。量化与还原分别是：

$$q = \text{clamp}(\text{round}(x / s), -128, 127), \qquad \hat{x} = s \times q$$

先除以 $s$，$\text{round}$ 舍入到最近的整数，$\text{clamp}$ 把超出 $-128 \dots 127$ 的数截到边上；还原时乘回 $s$。恰好落在半格上的取整规则由具体算子规定，下面的示意数不涉及这种平局。

取 $s = 0.1$，就是上面那张图：$x = 0.26$ 除以 $0.1$ 是 $2.6$，舍入得到 $q = 3$，还原成 $0.3$，差的 $0.04$ 是**舍入误差**；$x = 13$ 算出 $130$，超过 $127$ 的上限，只能存成 $127$，还原成 $12.7$，这 $0.3$ 是**截断误差**。

**$s$ 取多大，本身是一笔取舍。** 没有截断、且先忽略浮点表示误差时，舍入误差最多半格，也就是 $s / 2$；能存下的范围是 $-128s$ 到 $127s$。$s$ 取小，格子细，但范围窄，大数容易被截断；$s$ 取大，范围宽，但格子粗。上面的 `0.1` 是随手取的，所以 `13` 被截断了。对包含非零有限值的一批数，一种对称取法是 $s = \max |x| / 127$，让最大绝对值对应整数幅度 `127`；在这个理想计算里不会截断，全零输入则需要算子单独处理。图里四个数的最大绝对值是 `13`，按这个取法 $s = 13 / 127 \approx 0.102$，`13` 正好存成 `127`；但前三个数仍只落在 `3`、`10`、`-2` 上，对它们来说格子很粗。一个特别大的数（离群值）会把 $s$ 拉大，拖累共用这个 $s$ 的其余数，下一节讲系数粒度时还会用到这一点。

**对称方案有一处浪费：`0` 被放在格子正中，$-128 \dots -1$ 这一半格子专给负数。** 如果一批数全是正的，比如都落在 `0` 到 `25.5` 之间，负的那一半格子就全空着；$s$ 仍取 `0.1` 时，能表示的正数只到 `12.7`，`13` 就被截断了。非对称方案多存一个整数偏移 $z$，叫**零点（zero-point）**：`0` 这个数被记成哪个整数，$z$ 就是几。量化与还原变成：

$$q = \text{clamp}(\text{round}(x / s) + z, -128, 127), \qquad \hat{x} = s \times (q - z)$$

还原时多一次减法。取 $z = -128$，`0` 就记成 `-128`，`25.5` 记成 `127`，整排格子都给了正数。下图把两种零点设定在全正数区间上的格位利用率和源码落点并排对照：

```wiki-diagram
file: quantization-fig-zero-point
```

用同样 $s = 0.1$ 对比两者的结果（示意数）：

| 原始数 $x$ | 对称量化（$z = 0$） | 非对称量化（$z = -128$：压成整数 $q \to$ 乘回还原 $\hat{x}$） |
|---|---|---|
| `13` | $q = 127$（`130` 超上限被截断）$\to \hat{x} = 12.7$ | $q = \text{round}(13 / 0.1) + (-128) = 130 - 128 = 2 \to \hat{x} = 0.1 \times (2 - (-128)) = 0.1 \times 130 = 13.0$ |
| `0.26` | $q = 3 \to \hat{x} = 0.3$ | $q = \text{round}(0.26 / 0.1) + (-128) = 3 - 128 = -125 \to \hat{x} = 0.1 \times (-125 - (-128)) = 0.1 \times 3 = 0.3$ |

`0.26` 的舍入误差和对称时一样是 `0.04`，`13` 这次原样还原。在 `vllm-ascend` `v0.30.0` 的 `W8A8_DYNAMIC` 实现（包括 `AscendW8A8DynamicLinearMethod` 与 `AscendW8A8DynamicFusedMoEMethod`）中，激活按 token 对称量化，不存激活零点；权重文件里每个输出通道虽然也带了一个 `weight_offset` 参数，动态矩阵乘内核并不使用它，所以后文的公式可以忽略零点。真正用上激活偏移的，是静态 `W8A8` 给整张激活张量存的那一份 `input_offset`。

## 放进一次矩阵乘：W8A8 的四步

线性层做的是矩阵乘：输出里的每个数，是一行激活和一列权重逐个相乘再相加的结果，见[矩阵乘与权重](matmul-and-weights.md)。INT8 W8A8 把两边都按上一节的办法压成 INT8，用整数做乘加，最后再把系数乘回来：

```wiki-diagram
file: quantization-intuition
```

图里的四步就是 W8A8 的全过程：

1. **权重按输出通道压。** 输出通道指权重矩阵在输出维度上的一列，这一列负责算出输出向量里的一个位置。每列自己求一个缩放系数，整列的数除以它，再舍入、截断到 INT8 的范围。这一步在部署前离线做完，存进权重文件。
2. **激活按 token 压。** 每次前向都要做一次：激活矩阵里一行是一个 token 的向量，每行自己求一个缩放系数。
3. **整数乘加。** 两份 8 位整数相乘相加，中间结果用更宽的整数累加，降低溢出风险；具体累加类型和可承受的求和长度仍受算子约束。
4. **乘回两个缩放系数。** 一个输出元素来自「这一行激活 × 这一列权重」，所以还原时乘的就是这一行的系数乘这一列的系数，输出重新变回 BF16。

把四步合起来看一个输出元素：忽略零点时 $\hat{y} = s_x \times s_w \times \sum_i q_{x,i}\, q_{w,i}$，$\sum$ 表示把每个位置 $i$ 上的两个整数之积全部加起来。整数部分先全部加完，两个系数最后一起乘上去；能这样提到外面，是因为同一行激活共用一个 $s_x$，同一列权重共用一个 $s_w$。

下面的 3 通道数值例子与配套 3D 场景属于**冻结 3D 教学算例（与软件版本无关，只用 3 个数建立手算直觉；其中 `12 B` 与 `6 B` 仅计 6 个元素本身，不含缩放系数与累加器，不代表后文 `Qwen3-8B` / `Qwen3-30B-A3B` 的真实层维度）**。按「最大绝对值 ÷ 127」取系数走一遍：

```wiki-diagram
file: quantization-dot
```

对照上图逐步核对四个环节的数值（历史 3 通道玩具教学示意数）：

| 步骤 | 算式与结果 | 时机与说明 |
|---|---|---|
| 1. 权重按列压成 INT8 | $w = [0.40, -2.54, 0.86]$，$s_w = 2.54 / 127 = 0.02$，$q_w = \text{round}(w / 0.02) = [20, -127, 43]$ | 部署前离线做好，存进权重文件 |
| 2. 激活按行压成 INT8 | $x = [0.523, -0.31, 1.27]$，$s_x = 1.27 / 127 = 0.01$，$q_x = \text{round}(x / 0.01) = \text{round}([52.3, -31, 127]) = [52, -31, 127]$ | 每次前向按当前输入现算 |
| 3. 宽整数乘加 | $52 \times 20 + (-31) \times (-127) + 127 \times 43 = 1040 + 3937 + 5461 = 10438$ | 3 项已超 INT8 上限 `127`，须用更宽整数累加 |
| 4. 乘回系数与原数对照 | $\hat{y} = 0.01 \times 0.02 \times 10438 = 2.0876$；直接用原数算 $y = 0.523 \times 0.40 + (-0.31) \times (-2.54) + 1.27 \times 0.86 = 2.0888$ | 反量化恢复数值范围，与精算值 `2.0888` 仅差 `0.0012` |

$$\hat{y} = 0.01 \times 0.02 \times (52 \times 20 + (-31) \times (-127) + 127 \times 43) = 0.0002 \times 10438 = 2.0876$$

两个结果只差 `0.0012`，来源是 `0.523` 被舍入成了 `0.52`（`0.003 × 0.40 = 0.0012`），其余几个数正好落在格子上。注意第 3 步：3 项就加到 `10438`，早就超出 INT8 的 `127`；真实的一行有几千项，所以累加要用更宽的整数。

缩放系数不参与整数乘加，只在第 4 步用上。数值范围完全靠它恢复，所以系数本身必须用较高精度保存，也必须跟着权重一起搬。

**系数的粒度是一笔取舍。** 整个张量共用一个系数最省元数据（系数这类跟着数据一起存的附加信息），但一个离群值就会把系数拉大，其余的数被挤到很少的几个整数上；按输出通道、按行或按更小的分组（例如 32 个元素一组）各给一个系数，可以把离群值的影响限制在更小范围，同时增加元数据，最终误差仍取决于数据与量化规则，还要看算子支持哪种粒度。

下面的 3D 交互场景沿用这组冻结 3D 教学算例数值。权重的离线量化与激活的运行时量化分开播放，再逐项形成整数乘积、累加和反量化结果；图中 `2.0876` 是乘回系数后的数学值，最终存成 BF16 时还要按该类型舍入，而场景里的 `12 B` 对比 `6 B` 仅比较 6 个元素的存储宽度。

```wiki-scene
inference-mechanism:5
```

## 省下什么，付出什么

按 INT8 存权重，同一批矩阵元素本身的字节数正好是 BF16 的一半。拿 `v0.30.0` 主基线标准模型 `Qwen3-8B`（`hidden_size = 4096`，32 个注意力头、每头 128 维，共 36 层）里单层注意力输出投影 `o_proj` 的完整矩阵形状 `4096 × 4096` 算一笔，系数和偏移按每个输出通道各一个计：

| 统计项（`Qwen3-8B` 单层 `o_proj`：`4096 × 4096 = 16,777,216` 个元素） | 算式 | 字节数与折算 | 占 BF16 比例 |
|---|---|---|---|
| 按 BF16 存权重 | `16,777,216 × 2 B` | `33,554,432 B = 32,768 KiB = 32 MiB` | `100%` |
| 按 INT8 存权重主体 | `16,777,216 × 1 B` | `16,777,216 B = 16,384 KiB = 16 MiB` | `50.00%` |
| 逐输出通道系数与偏移（按模型参数类型 BF16 各 `2 B` 计） | `4096 × 2 × 2 B` | `16,384 B = 16 KiB`（加载后动态路径另存一份 FP32 scale 副本） | `≈ 0.05%` |
| **INT8 连同系数与偏移合计** | `(16,384 KiB + 16 KiB) ÷ 32,768 KiB` | **`16 MiB + 16 KiB`** | **`≈ 50.05%`** |

把镜头拉到 `Qwen3-8B` 整层的稠密 MLP（`intermediate_size = 12288`，包含 `gate_proj`、`up_proj` 与 `down_proj` 三个 `12288 × 4096` 矩阵）：单层 BF16 占 `288 MiB`，36 层合计 `10.125 GiB`；换成 INT8 后权重主体降到单层 `144 MiB`、36 层合计 `5.0625 GiB`，系数和偏移同样只有权重主体的千分之一量级，几乎正好省下一半。如果再换到更大的稀疏专家模型 `Qwen3-30B-A3B`（48 层、每层 128 个路由专家、`hidden_size = 2048`、`moe_intermediate_size = 768`），128 个专家每层共 `603,979,776` 个权重元素：BF16 单层 `1,152 MiB`、48 层整模型专家部分 `54 GiB`；INT8 单层 `576 MiB`、48 层合计 `27 GiB`，每卡在多卡专家并行下分摊的账见下一节。

但省容量不是无代价的，实际部署至少要看三笔代价：

- **误差。** 舍入误差和超出范围后的截断误差都会进入这一层的输出，并随层数累积；同一模型换权重精度或换导出配方后必须重新跑质量评估。
- **多出来的参数、格式转换与硬件回退。** 缩放系数和偏移要跟权重一起加载；权重加载后还要转置、按需要转成设备偏好的分块布局（如 `FRACTAL_NZ`），动态方法还会为权重系数多建一份 FP32 副本；运行时激活量化会增加算子调用，除非被 `PreparedLinearInput` 或融合算子吃掉。更要注意硬件差异：**在 `v0.30.0` 中，把原生 block-wise FP8（`fp8_block`）权重放到 Atlas A2 / A3 上时，加载期会静默反量化回 `model_dtype`（通常是 BF16，`2 B/元素`），权重要多占回两倍显存，等于 0 节省**，到了社区 `main` 分支则在 A2 / A3 上改为直接抛 `NotImplementedError` 拒绝启动；**至于 300I DUO（310P），由于它走 `QuantizationBackendFamily.COMPATIBILITY` 量化后端、平台预注册时不注册 `AscendFp8Config`（只注册 `AscendModelSlimConfig310`），且其 `model_dtype` 为 FP16 而非 BF16，因此原生 FP8 在 `310P` 上没有 Ascend 执行路径、不受支持**。
- **只有能量化的层才省。** 精度按层生效，模型代码或描述文件留给高精度的投影（例如路由门控、部分注意力分支或输出头）不会变小。

| 存同一个权重矩阵 | 权重元素 | 另外要存与实际落点 |
|---|---|---|
| BF16 | 2 字节 | 无 |
| INT8（`W8A8_DYNAMIC` / `W8A8`） | 1 字节 | 每输出通道 `weight_scale` 与 `weight_offset`（动态方案加载后建 `weight_scale_fp32` 副本；静态方案另存整张量激活 `input_scale`、`input_offset`、`quant_bias`、`deq_scale`） |
| 原生 FP8（`fp8_block`）在 Ascend 950 | 重分组为 MXFP8 1 字节 | 每 32 个归约元素 1 字节 `uint8`/E8M0 缩放（约 `1.031 B/元素`）；`kv_b_proj` 与 `in_features % 32 != 0` 的层退回约 2 字节浮点 |
| 原生 FP8（`fp8_block`）在 A2 / A3（`v0.30.0`） | 加载后静默展开为 `model_dtype`（通常是 BF16，2 字节） | 原 `weight_scale_inv` 解析后释放，但权重本身占 2 字节（`main` 在 A2 / A3 直接抛 `NotImplementedError`） |
| 原生 FP8（`fp8_block`）在 300I DUO（310P） | 无 Ascend 执行路径（不支持） | 310P 使用 `COMPATIBILITY` 量化后端，不注册 `AscendFp8Config`（仅注册 `AscendModelSlimConfig310`），且其 `model_dtype` 为 FP16；`v0.30.0` 与 `main` 均不支持原生 FP8 |

省下的字节也不会原样变成 KV cache 的额度：设备上还要为权重重排、激活量化和算子执行留工作区，[显存探测](kv-cache-memory-profiling.md)要重新量一遍，才知道剩下多少能装历史状态。

## 动态量化、静态量化与 PD 混合（`W8A8_MIX`）

`vllm-ascend` `v0.30.0` 里的 INT8 W8A8 有三套最常碰到的线性层方案，全都以 INT8 保存权重并按输出通道配权重系数，区别在于**激活系数什么时候确定**，以及**在 PD 分离部署里怎么按节点角色切分**：

| 方案名 | 激活系数何时定 | 激活系数粒度 | 覆盖层类型（`v0.30.0`） | 适用场景与代价 |
|---|---|---|---|---|
| `W8A8_DYNAMIC` | 每次前向按当前输入现算 | 每个 token 一个（对称量化） | `linear` + `moe` | 跟着当前输入范围走，免去激活校准；运行时多一步动态量化算子（可被共享专家预量化或融合算子吸收） |
| `W8A8`（静态） | 部署前校准定好，写进权重文件 | 整个张量一个（含 `input_offset`、`quant_bias`、`deq_scale`） | **仅 `linear`**（无 `moe`） | 前向省掉求激活系数那一步；真实输入偏离校准分布时截断误差风险更高 |
| `W8A8_MIX` | 加载静态缓冲区；前向按节点角色选 | `kv_consumer`（D 端 / `kv_both`）走静态，P 端与混部走动态 | **仅 `linear`**（`v0.30.0` 已移除 `moe`） | 同一份带静态参数的权重在 PD 分离时让 D 端吃静态低开销、P 端保动态精度；注册名是 `W8A8_MIX`，不是 `W8A8_PDMIX` |

动态方法只建 INT8 权重和逐输出通道的 `weight_scale`、`weight_offset`；静态方法在建参数时就为激活留了整张量共享的 `input_scale`、`input_offset`，还有 `quant_bias`（把偏置预先换成整数加进累加器）和 `deq_scale`（把整数乘加结果直接乘回输出范围的反量化系数）。`W8A8_MIX` 写在 `w8a8_pdmix.py` 里，它通过组合同时持有一份静态方法对象和一份动态方法对象：加载权重时按静态路径把全套静态系数都装进显存，执行时读取 `kv_transfer_config.is_kv_consumer`——在 PD 分离的 decode 节点或 `kv_both` 上走静态 `AscendW8A8LinearMethod`，在 prefill 节点或未开 PD 分离的混部实例上走动态 `AscendW8A8DynamicLinearMethod`。下图拆出了这套组合对象与 PD 角色分派路径：

```wiki-diagram
file: quantization-fig-w8a8-mix-pd
```

除了这三套 INT8 方案，`v0.30.0` 的 Ascend 注册表与配置系统还覆盖了更高压缩率或浮点低精度的方案家族（各种数值表示细节见[低精度格式](low-precision-formats.md)，离线算法与工具导出见[量化方法](quantization-methods.md)）：

| 方案家族 | 注册 scheme 名与支持层类型（`v0.30.0`） | 核心特征与边界 |
|---|---|---|
| 原生 block-wise FP8 | `fp8`（`linear`, `moe`），`deepseek_v4_fp8`（`ds_linear`, `ds_w4a8_moe`） | `AscendFp8Config` 仅在 `STANDARD` 后端注册，强制要求 `weight_block_size` 且 `activation_scheme == "dynamic"`；950 上转为 MXFP8，A2 / A3 在 `v0.30.0` 静默反量化回 `model_dtype`（通常是 BF16）；310P 为 `COMPATIBILITY` 后端，不注册 `AscendFp8Config`、不支持原生 FP8 |
| FP8 / MXFP8 方案 | `W8A8_MXFP8`（`linear`, `moe`）、`W8A8FP8_DYNAMIC`（`linear`, `moe`） | 使用 E4M3 元素或每 32 元素 E8M0 块缩放；另有独立配置入口 `mxfp8` / `modelopt_mxfp8` |
| W4A8 方案 | `W4A8_DYNAMIC`（`v0.30.0` **仅 `moe`**，`main` 补齐 `linear`）、`W4A8_MXFP`（`linear`, `moe`） | 4 位整数/MXFP4 权重配 8 位动态激活，把权重再减半 |
| W4A4 / Weight-Only | `W4A4_MXFP4`（`linear`, `moe`）、`W4A4_DYNAMIC` / `W4A4_FLATQUANT_DYNAMIC` / `W4A4_MXFP4_FLATQUANT`（`linear`）；`W4A16` / `W4A16_MXFP4`（`moe`）、`W8A16`（`linear`） | `W4A4` 把线性层激活也压到 4 位；`W4A16`/`W8A16` 只压权重、计算前反量化回 16 位 |
| KV Cache 量化（另行配置） | `C8` / `FAKQuant` / `INT8_DYNAMIC` / `C8-MXFP` / `turboquant_4bit_nc` | 压历史 K/V 或潜向量而非权重；`C8-MXFP` 要求 `block_size % 512 == 0`，`TurboQuant` 限 BF16 + A2/A3，详见 [KV cache 量化](kv-cache-quantization.md) |

“动态”没有承诺整个量化流程都不需要数据。若离线权重处理还用到异常值平滑、裁剪搜索或输出误差优化，仍可能需要代表性样本；详见[量化方法中的校准](quantization-methods.md#校准是在做什么动态量化还需要吗)。

## 放到 `v0.30.0` 标准部署：两个 8 位分别从哪来

把视野放回 `v0.30.0` 主基线的标准模型：一个稠密代表 `Qwen3-8B`（TP 部署），一个稀疏 MoE 代表 `Qwen3-30B-A3B`（128 个专家，若按 EP8 分到 8 张卡，每卡放 16 个路由专家）。它们加载 ModelSlim 导出的 `W8A8_DYNAMIC` 权重包时，两个 8 位分别这样走过：

**权重侧是离线结果，加载后只做搬运、转置和布局转换。**
- 在普通线性层（`AscendW8A8DynamicLinearMethod`）里，按「输出维 × 输入维」建 INT8 `weight` 与逐输出通道 `weight_scale`、`weight_offset`；权重装完后，统一在 `process_weights_after_loading` 里把矩阵转置成 `[输入维, 输出维]` 并连续化，若 `act_quant_type == torch.int8` 再视策略转成昇腾偏好的 `FRACTAL_NZ` 分块格式，并把 `weight_scale` 压平后多转一份 `weight_scale_fp32`（`to(torch.float32)`）。转置方向与数学形状的对应见[矩阵乘与权重](matmul-and-weights.md#开销和什么时候别开)。
- 在 MoE 层（`AscendW8A8DynamicFusedMoEMethod`）里，每卡分到的本地专家合成两块 3 维大权重：`w13_weight`（合并 gate 与 up）和 `w2_weight`（down）。加载后同样转置为算子方向；当 `quant_type == QuantType.W8A8` 时，直接通过 `torch_npu.npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)` 转成 NZ 布局，同时构造 `w13_weight_scale_fp32`（注意：`w2_weight_scale` 在普通分支下**不**额外复制一份 FP32 副本，只有在 `enable_fused_mc2 == 1` 时才会把 `w13_weight_scale` 和 `w2_weight_scale` 一起转成 INT64 打包的 `fused_w1_scale` / `fused_w2_scale`）。

**激活侧每次前向现算，或沿融合/预量化路径复用。** 普通动态 Linear 拿到 BF16 输入，先调 `npu_dynamic_quant` 按 token 算出 INT8 激活和每行一个 FP32 `pertoken_scale`，再调 `npu_quant_matmul` 把权重和两份系数一起送进核函数，输出恢复成 BF16；在支持通信计算重叠（如共享专家与通信重叠）的路径里，`prepare_input_for_overlap` 会把提前量化的结果打包成 `PreparedLinearInput`，线性层直接复用这份预量化张量而不再重复量化。到了 MoE 阶段，如果前一步 **dispatch**（把 token 向量发给持有它选中专家的卡）已经带着 `quant_mode=2` 传回了 INT8 激活和 `dynamic_scale`，专家计算入口就直接复用；进入 `apply_gmm1_act_quant` 时，开启 `fusion` 的 MC2 路径可以调融合算子 `grouped_matmul_swiglu_quant_weight_nz` 把第一次分组矩阵乘、SwiGLU 激活与第二次矩阵乘前的再量化合在一起做完，而非融合 MC2 路径则先做 INT32 输出的 `npu_grouped_matmul`，再调 `npu_dequant_swiglu_quant` 反量化、激活并量化，prefill 阶段再按条件走 `swiglu_quant` 或 `npu_swiglu` + `npu_dynamic_quant`。下图把稠密 Linear 与稀疏 MoE 两条执行轨道并排对照：

```wiki-diagram
file: quantization-fig-linear-moe-pipeline
```

拿 `Qwen3-30B-A3B` 按 EP8（每卡 16 个专家，`hidden_size = 2048`，`moe_intermediate_size = 768`）算一笔单卡单层 MoE 权重与缩放系数的比例：

| 张量项（`Qwen3-30B-A3B` EP8 每卡 16 专家，单层） | 元素数与算式 | 单卡单层字节数 | 全模型 48 层与占比 |
|---|---|---|---|
| `w13` + `w2` INT8 权重主体 | `w13`: `16 × (2 × 768) × 2048 = 50,331,648`；`w2`: `16 × 2048 × 768 = 25,165,824`；合计 `75,497,472 × 1 B` | `73,728 KiB = 72.0 MiB`（BF16 为 `144 MiB`） | **48 层 INT8 主体 `48 × 72 MiB = 3.375 GiB`**（BF16 为 `6.75 GiB`） |
| `w13` 系数与偏移（BF16） | `16 × 1536 × (2 B + 2 B)` | `98,304 B = 96.0 KiB` | 随离线权重加载 |
| `w2` 系数与偏移（BF16） | `16 × 2048 × (2 B + 2 B)` | `131,072 B = 128.0 KiB` | 随离线权重加载 |
| 加载后另存 `w13_weight_scale_fp32` | `16 × 1536 × 4 B` | `98,304 B = 96.0 KiB` | 动态路径加载后构造 FP32 副本 |
| **辅助缩放参数合计** | `(96.0 + 128.0 + 96.0) KiB = 320.0 KiB` | **`320.0 KiB`** | **`320.0 KiB ÷ 73,728.0 KiB ≈ 0.43%`** |

辅助参数只有千分之四量级，真正占字节的是权重主体。但和前面一样，加载后的 NZ 对齐填充、运行时量化输出和工作区另占显存，实际可用容量仍以显存探测为准。

> **历史部署对照（例外 B：GLM-5.3-Flash 双机 `2×A2×8` TP8/DP2/EP16，固定 `db701c1f` 快照）：** 站内 `09 旗舰异构模型全案` 沿用的历史双机部署案例中，GLM-5.3-Flash 的 45 层里有 42 层 MoE（每层 288 个路由专家，EP16 下每卡 18 个专家、通道维 4096）。在 `W8A8_DYNAMIC` 下，每卡每层路由专家 INT8 主体为 `432.0 MiB`、42 层合计 `17.72 GiB`（对照 `3121f187` 快照所列语言权重子账 `20.58 GiB`，尚不含视觉塔与 MTP 旋转矩阵）；每层每卡 `w13`/`w2` 系数与偏移 `576.0 KiB` 加上 FP32 系数副本 `288.0 KiB` 共 `864.0 KiB`（约占权重主体的 `0.2%`），完整整卡账见[GLM 双机部署边界](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。

### 哪些矩阵是 8 位，哪些保持 BF16

**量化不是全模型一键开关，而是「模型建层是否接配置」与「配置类逐层查表/硬件适配」两道门共同决定的。** 下图画出了 `v0.30.0` 下 `AscendModelSlimConfig`（ModelSlim 路线）与 `AscendFp8Config`（原生 block-wise FP8 路线）两套主流配置的完整分流路径：

```wiki-diagram
file: quantization-flow
```

走 ModelSlim 路线（`AscendModelSlimConfig`）时，先查模型目录里的 `quant_model_description.json`。对于接了 `quant_config` 的 `LinearBase` 和 `FusedMoE`：如果某组融合模块（如 `qkv_proj`、`gate_up_proj`）的几个分片在描述文件里标了不同精度，会直接报错；查到的值为 `"FLOAT"` 时返回 `None`，换成 `AscendUnquantizedLinearMethod` 或 `AscendUnquantizedFusedMoEMethod`；否则拿 `(quant_type, layer_type)` 去方法注册表里查实现类。**`VocabParallelEmbedding` 有明确例外**：如果在描述文件里找不到它的条目，它不会像普通 Linear 那样报 `KeyError`，而是退回 `UnquantizedEmbeddingMethod` 按浮点加载；其他未匹配分支则返回 `None` 交给上层原有实现。

走原生 block-wise FP8 路线（`AscendFp8Config`）时，除了遵循 `ignored_layers` 跳过名单外，在 Ascend 950 上重分组为 MXFP8 还有两类自动回退：凡是被 MLA/SFA 注意力后端吸收的 `kv_b_proj`（`layer.prefix` 以 `kv_b_proj` 结尾），以及输入归约维 `in_features` 不能被 `32` 整除的层，都保持 `model_dtype` 浮点而不转成 MXFP8。

落到 `v0.30.0` 主基线代表模型 **`Qwen3-8B` 与 `Qwen3-30B-A3B`** 上（模型构造源码见上游 `vllm@ced6857a`；实际哪一层压成 8 位、哪一层标 `"FLOAT"`，仍以具体下载权重包内的 `quant_model_description.json` 为准）：

| 模型与模块 | 建层时是否传入 `quant_config` | `AscendModelSlimConfig` 默认/常见行为（取决于权重包描述） |
|---|---|---|
| `Qwen3-8B` 注意力与 MLP（`qkv_proj`、`o_proj`、`gate_up_proj`、`down_proj`） | 是 | 查 `quant_model_description.json`：标 `W8A8_DYNAMIC` / `W8A8` 等则走量化方法，标 `"FLOAT"` 则保持模型浮点 |
| `Qwen3-8B` `embed_tokens` 与 `lm_head` | 是 | `embed_tokens` 缺条目或标 `"FLOAT"` 时均走 `UnquantizedEmbeddingMethod`；`lm_head` 在常规配方里通常标 `"FLOAT"` 保持 BF16 |
| `Qwen3-30B-A3B` 注意力、路由专家 `experts` 与共享专家 `shared_expert` | 是 | 注意力投影与 `experts`（及有共享专家时的 `shared_expert`）由描述文件决定；常规 MoE 配方下多设为 `W8A8_DYNAMIC` 或 `W8A8` |
| `Qwen3-30B-A3B` 路由器 `gate`（及同系带共享专家变体的 `shared_expert_gate`） | `gate` 传 `quant_config`；配置 `shared_expert_intermediate_size > 0` 时其 `shared_expert_gate` 传 `None` | `Qwen3-30B-A3B` 本身无共享专家，在同构 `Qwen3MoeSparseMoeBlock` 带共享专家变体中 `shared_expert_gate` 代码写死不量化；`gate`（`ReplicatedLinear`）在标准 ModelSlim 配方里标 `"FLOAT"` 保留高精度打分 |

对于历史参考模型 **GLM-5.3-Flash**（历史钉点 `db701c1f` 的 `glm5_next.py`；在 `v0.30.0` 已迁至 `vllm_ascend/models/glm5next/model.py`），逐部件的「代码写死不量化」与「描述文件决定」边界如下，供对照 [MLA](mla.md)、[算子与内核](ops-and-kernels.md#量化矩阵乘w8a8) 与 [Embedding](embedding.md#放到-glm-双机8-张卡怎么查同一张表) 的入站链接核查：

| 依据（GLM-5.3-Flash 历史对照） | 覆盖的部件 | 结论强度与快照差异 |
|---|---|---|
| 模型代码建层时不接 `quant_config`（含 `c09d3e20` `glm5next/model.py`） | KDA 层的九个投影（Q、K、V、两组门控投影、`b` 投影、输出投影）；索引器的 K 投影与打分投影；嵌入表 `embed_tokens`；router 打分矩阵 `GateLinear`（非 CUDA 上按 FP32 建权重与算分）；多模态视觉塔 `visual` | 与描述文件无关，一定不走量化实现 |
| 建层时接了 `quant_config`，实际精度由描述文件决定 | 前 3 层稠密 MLP；路由专家与共享专家；稀疏 MLA 的四组投影；索引器 Q 投影；词表头 `lm_head` | 历史快照 `9e55cbc8` 与 `3121f187` 均标稠密 MLP 与专家为 `W8A8_DYNAMIC`、KV 展开/索引器 Q/`lm_head` 为 `FLOAT`；**差异在主干 11 层 + MTP 1 层稀疏 MLA 的 Q 压缩、KV 压缩、Q 展开与输出四组投影**：`9e55cbc8` 标 `FLOAT`，`3121f187` 改为 `W8A8_DYNAMIC`（代码把 Q/KV 压缩合为单个模块，但描述文件仍分别列两组权重） |

请求历史的降精度是另一件事：对象是 KV cache，写在缓存里、按块读出，收益和误差都另算，见[缓存量化](kv-cache-quantization.md)。

### 为什么 EP dispatch 搬的是 int8

MoE 的 dispatch 要把 token 的隐藏向量发到持有它选中专家的卡上。在 `v0.30.0` 里，MoE 选哪条通信路径由硬件家族的 `moe_comm_policy` 决定（LoRA + EP 例外走 `ALLTOALL`）：
- **Atlas A2**（`CAPACITY_AND_EXPERT_DENSITY`）：同时满足「每卡专家数 $\le 24$、EP $\ge 16$、本轮 token 数 $\le$ `mc2_tokens_capacity`」时选 [MC2](collective-communication.md#mc2)，否则选 AllGather。
- **Atlas A3**（`FUSED_OR_CAPACITY`）：优先按条件选 `FUSED_MC2`、其次 `MC2` 或 `ALLTOALL`。
- **Ascend 950 / A5**（`CAPACITY_AND_WORLD_SIZE`）：在 `FUSED_MC2`、`MC2`、`ALLGATHER`、`ALLTOALL` 之间按容量与规模选路。
- **310P**：固定走 `ALLGATHER`。

一旦进入 MC2 路径，在 `token_dispatcher.py` 与 `moe_quant.py` 中：对于 `QuantType.W8A8` 和 `QuantType.W4A8` 这类整数权重/激活方案，`dispatch_with_quant` 为真，未显式覆盖 `comm_quant_mode` 时派发固定传入 **`quant_mode = 2`**，把隐藏向量就地按动态缩放压成 **INT8** 并附带每个 token 一个 FP32 `dynamic_scale` 一起发出；这样既把 dispatch 的隐藏向量张量载荷压到近一半，又让专家端直接复用这份缩放、省掉入口重复量化。而专家算完输出变回 BF16，**combine 阶段**默认 **`quant_mode = 0`**（不压缩通信），除非模型属于 `W8A8MXFP`（combine 默认走 `4`）或用户通过 `combine_quant_mode` / `comm_quant_mode` 显式覆盖；至于 A5 上的 MXFP 方案，dispatch 则使用 **`quant_mode = 4`**（FP8 E4M3FN / MXFP4 + E8M0 缩放）。W8A8FP8 与 MXFP 有各自的目标类型，不能仅凭「8 位」推断所有方案的 dispatch 都传 INT8；而普通整数方案下 combine 默认不量化的原因，源码注释没有解释。下图把四族策略选路、去程 INT8 dispatch、专家端直接复用与返程 BF16 combine 串在同一张立体拆解图上：

```wiki-diagram
file: quantization-plate-mc2-dispatch
```

以 `Qwen3-30B-A3B`（`hidden_size = 2048`）与通用 `hidden_size = 4096`（如 GLM）为例，对比单个 `(token, 专家)` 副本在 MC2 dispatch 时的纯张量载荷（实际链路字节还需加上路由索引、对齐填充与通信元数据，整次通信账见[通信库 · 数据精度和本地计算](cann-hccl.md#数据精度和本地计算怎样影响通信)，路径见[expert parallel](expert-parallel.md)）：

| 隐藏维设定 | BF16 单 `(token, 专家)` 载荷 | `quant_mode = 2`（INT8 激活 + FP32 `dynamic_scale`） | 压缩后占比 |
|---|---|---|---|
| `Qwen3-30B-A3B`（`H = 2048`） | `2048 × 2 B = 4,096 B` | `2048 × 1 B + 4 B = 2,052 B` | **`≈ 50.10%`** |
| 通用 `H = 4096`（如 GLM） | `4096 × 2 B = 8,192 B` | `4096 × 1 B + 4 B = 4,100 B` | **`≈ 50.05%`** |

把前文的静态权重显存压缩、原生 `fp8_block` 在不同昇腾芯片上的实际落点，以及此处 MoE `MC2 dispatch` 的单副本通信载荷合在一张比例图里对照，可以直接看清哪些环节按预期减半、哪些环节因缩放元数据或硬件回退而产生偏移：

```wiki-diagram
file: quantization-savings-and-dispatch
```

## 常见误解

- **「开了 W8A8 就是整个模型都用 8 位。」** 量化按层生效：嵌入表、router 门控、标记 `"FLOAT"` 的输出头或特定模型代码排除的层（如 GLM 的 KDA 与索引器 K/打分）仍保持 BF16 或 FP32；各层的真实状态见[上文选路表](#哪些矩阵是-8-位哪些保持-bf16)。
- **「原生 FP8 权重包放到 Atlas A2 / A3 或 310P 上也能用 / 也能省一半显存。」** 在 `v0.30.0` 中，Atlas A2 / A3 加载 `fp8_block` 权重包会静默反量化回 `model_dtype`（通常是 BF16，`2 B/元素`，显存翻倍到与纯浮点包相当），在 `main` 分支则直接抛 `NotImplementedError` 拒绝启动；而 300I DUO（310P）采用 `COMPATIBILITY` 量化后端，平台不注册 `AscendFp8Config`（仅注册 `AscendModelSlimConfig310`，且其 `model_dtype` 为 FP16），原生 FP8 在 310P 上没有 Ascend 执行路径、不受支持。
- **「量化以后这一层就没有浮点计算了。」** 只有矩阵乘的操作数变成低精度。归一化、SwiGLU 激活门控、router 打分、combine 的加权相加都还在浮点里，输出通常也回到 BF16。
- **「量化后所有通信都减半。」** W8A8 MC2 dispatch 分支传 INT8 加 FP32 系数，不代表其他通信也变成 INT8；普通 TP 部分和与默认整数 combine 路径（`quant_mode=0`）仍是 BF16。通信量按实际执行分支交给通信操作的张量类型算。
- **「权重省下 1 GiB，KV cache 就多 1 GiB。」** 还有 `FRACTAL_NZ` 布局填充、FP32 scale 副本、`W8A8_MIX` 双缓冲区和算子工作区；显存预算要重新做[显存探测](kv-cache-memory-profiling.md)。
- **「静态量化一定更快，动态量化一定更准。」** 静态省掉求激活系数的一步，动态跟着当前输入范围走；谁更快、谁误差更小取决于算子实现、输入分布和模型校准质量，不能脱离评估直接下结论。
- **「省下的字节等比例变成带宽收益。」** 读权重的量确实少了，但缓存命中、批内复用、专家选择和算子融合共同决定实际流量，不能把权重字节比例直接当成加速比。

## 对照源码

### 怎么开

加载时先区分三件事，不能用同一个“精度参数”概括：

| 作用 | 入口与默认 | 改变什么 |
|---|---|---|
| 浮点类型 | `--dtype`；Python `dtype` 默认 `"auto"` | 配置模型的浮点权重/激活类型，仍受各层实现及量化方法约束 |
| 量化实现 | `--quantization`；Python `quantization` 默认 `None` | 选择与权重描述匹配的方法；省略仍可能从模型文件自动识别量化 |
| 读取方式 | `--load-format`；默认 `"auto"` | 选择加载器与文件读取路径，详见 [Worker 加载入口](npu-worker-lifecycle.md#怎么开) |

`dtype` 接受 `auto`、`half`/`float16`、`bfloat16`、`float`/`float32` 或对应 `torch.dtype`；`auto` 会读取模型声明的类型并结合平台与架构支持列表过滤（FP32 会降到平台偏好类型，pooling 在允许 FP16 时优先 FP16）。显式 `dtype` 不会把代码写死 FP32 的 router 改掉，也不会把量化层的 INT8 权重改成浮点矩阵。

`quantization` 接受已注册方法名或 `None`（`None` 表示未显式指定，**不是关闭模型自带量化**）。在 `v0.30.0` 中，`NPUPlatform.supported_quantization` 共有 **6 项** 入口：`ascend`、`compressed-tensors`、`fp8`、`deepseek_v4_fp8`、`modelopt_mxfp8`、`mxfp8`。其中 `ascend` 对应 ModelSlim（`AscendModelSlimConfig`），`W8A8_DYNAMIC`、`W8A8`、`W8A8_MIX` 等逐层方案写在权重目录的 `quant_model_description.json` 里，不直接填在 `--quantization` 上；若要用原生 block-wise FP8 权重包，则对应 `fp8`（`AscendFp8Config`）。以下是开启 ModelSlim 量化包的最小参数片段：

```bash
--dtype bfloat16 --quantization ascend
```

在 PD 分离部署中若要让 `W8A8_MIX` 在 D 端走静态、P 端走动态，只需使用包含 `"W8A8_MIX"` 条目及静态缓冲区的 ModelSlim 权重包，并以 `--quantization ascend` 配合 `--kv-transfer-config`（区分 `kv_consumer`/`kv_both` 与 `kv_producer`）启动。若要开启基于 ModelSlim recipe 的 FP8 KV cache（`C8-MXFP`），必须显式传递 `--kv-cache-dtype mxfp8`；`TurboQuant` 则对应 `--kv-cache-dtype turboquant_4bit_nc`。如果看到上游教程写 `--quantization online`、`bitsandbytes` 或 `GGUF`，参见[量化发生在哪个环节](quantization-methods.md#文件已经量化加载时量化每步量化各发生在什么时候)，不要把 CUDA 入口直接套回昇腾。

量化识别分两层：第一层上游 `ModelConfig._verify_quantization` 先读模型配置里的量化标记、允许方法覆盖并校验平台与显式参数冲突（冲突可直接抛错）；第二层由 `NPUPlatform` 调用 `maybe_auto_detect_quantization` 补充探测——在 `v0.30.0` 中，`detect_quantization_method` 按顺序检查 `quant_model_description.json`（→ `ascend`）、`config.json` 里的 `compressed-tensors` 与 `fp8`（而在 `main` 分支中已收敛为**仅探测 `quant_model_description.json`**，其余交给第一层上游完成）。**仅在这第二层**，若用户已显式传入不同的方法名，会打印 warning 并保留用户值；未传入时才写回探测结果并重建 `quant_config`。

选中 `ascend` 后，`AscendModelSlimConfig` 按层类型分派：`LinearBase` 与 `FusedMoE` 先做 `"FLOAT"` 跳过与分片一致性检查，再按 `(quant_type, layer_type)` 查方法注册表；`VocabParallelEmbedding` 在缺量化条目时回退到 `UnquantizedEmbeddingMethod`；`AttentionLayerBase` 按 `fa_quant_type`、indexer、`C8` 或 `--kv-cache-dtype mxfp8` 分别进入对应缓存量化方法。

### 会报什么错

`dtype` 拼错报 `Unknown dtype`；`quantization` 未注册报 `Unknown quantization method`；模型配置与显式方法冲突报 `does not match the quantization method specified`。下面汇总加载与执行期最关键的逐层报错与前置校验失败：

| 报错信息或异常 | 触发条件 | 先查什么 |
|---|---|---|
| `ValueError: Not all shards of {prefix} are quantized with same quant type.` | 融合层（如 `qkv_proj`、`gate_up_proj`）的分片在描述 JSON 里标了不同精度 | 检查 `quant_model_description.json` 里同组各分片条目是否一致 |
| `KeyError: '<前缀>.weight'` | `LinearBase`/`FusedMoE` 未命中跳过条件且描述 JSON 缺少该权重键（Embedding 缺键不走此错） | 核对层前缀、模型名或后补 MTP 层是否漏写描述键 |
| `ValueError: Could not determine quantization type for layer ...` | 键存在但精度值为空（如 `null`） | 检查该层条目在 JSON 里的取值是否完整 |
| `NotImplementedError: Currently, vLLM Ascend doesn't support quant_type=%s for layer_type=%s.` | `(quant_type, layer_type)` 未注册实现（例如将 `W8A8` 或 `W8A8_MIX` 标到 `moe`，或误写未注册的 `"W8A8_PDMIX"`） | 确认注册名是 `"W8A8_MIX"`（仅 `linear`）或改用 `W8A8_DYNAMIC` / 保持 `"FLOAT"` |
| `Number of global experts mismatch (excluding redundancy)` | MoE `W8A8_DYNAMIC` 运行时看到 router 列数与逻辑专家数不匹配（如 `Qwen3-30B-A3B` 应为 128 列） | 核对模型权重、config 专家数与描述文件是否匹配；MoE 侧其余排查见 [EP 会报什么错](expert-parallel.md#会报什么错) |
| `NotImplementedError: vLLM Ascend serves native FP8 checkpoints only when quantization_config.weight_block_size is present...` | 原生 FP8 checkpoint 为 per-tensor 或 per-channel（缺少 `weight_block_size`） | 无法直接加载，改用 block-wise FP8 包或经 ModelSlim / LLM-Compressor 重量化 |
| `NotImplementedError: ... activation_scheme: ...`（非 `"dynamic"`） | 原生 block-wise FP8 checkpoint 声明了静态等非动态激活方案 | 仅支持 `activation_scheme == "dynamic"` 的 block-wise FP8 |
| `NotImplementedError: Native block-wise FP8 checkpoints run on Ascend 950 only...`（**仅 `main`**） | 在 `main (8d6180e2)` 上把原生 `fp8_block` 包放到 A2 / A3（已注册 `AscendFp8Config` 但不支持 `WeightFormat.FP8`） | `v0.30.0` 在 A2 / A3 会静默转回 `model_dtype`（通常是 BF16），`main` 直接阻断；310P 因 `COMPATIBILITY` 后端不注册 `AscendFp8Config`，原生 FP8 全程无执行路径；请改用对应浮点原版或 ModelSlim 量化包 |
| `ValueError: C8_MXFP requires --block-size to be a multiple of 512.` | 开启 `--kv-cache-dtype mxfp8` 且用户显式传了非 512 倍数的 `--block-size` | 改传 512 的倍数（若未显式传，系统会静默改写为 `512`） |
| `ValueError`（`turboquant_4bit_nc` 校验失败） | 未满足 BF16 + A2/A3 共同前提；或 Route A（SFA）混开 `enable_sparse_sfa_c8` / `xlite_graph_config` / 维度不符；或 Route B（DeepSeek V4）未配 `VLLM_USE_V2_MODEL_RUNNER=1`（`v0.30.0`）/ 开了 CP、KVPP、PD 传输或缺 `NnopbaseSupportTensorV2` | 逐项核对模型类型、硬件、并行开关与 `v0.30.0` 的 MRV2 环境变量要求 |

### 开销和什么时候别开

普通动态 Linear 对未量化输入调用 `npu_dynamic_quant`；静态 Linear 可直接接收 INT8；`v0.30.0` 中 `W8A8_DYNAMIC`、`W8A8` 与 `W8A8_MIX` 的 Linear 方法均支持 `PreparedLinearInput` 复用预量化激活。MoE 段可复用 MC2 dispatch 返回的动态系数，融合算子分支（`grouped_matmul_swiglu_quant_weight_nz`）也会把分组矩阵乘与激活量化合并，不能按「固定多几个算子」一刀切估算。加载后执行的转置、连续化、`FRACTAL_NZ` 转换、FP32 scale 副本与 `W8A8_MIX` 静态缓冲都会计入加载时间与常驻/峰值内存；早期 `v0.23.0` / `v0.26.0rc` 动态 Linear 针对超大投影维的 `_chunk_size` 拆块分支在 `v0.30.0` 已移除。

什么时候别开：没有配套的量化权重包与描述文件时；需要与浮点实现严格逐位对齐时；层类型与 scheme 组合未注册时；或**在 A2 / A3（`v0.30.0` 会静默展开为 `model_dtype`，通常是 2 字节 BF16，既不省显存也无 FP8 算力收益）以及 310P（`COMPATIBILITY` 后端不注册 `AscendFp8Config`、无 Ascend 执行路径）上直接部署原生 `fp8_block` 包时**。在 Ascend 950 上运行 `fp8_block` 时，也要注意 `kv_b_proj` 与 `in_features % 32 != 0` 的层会自动退回密集 `model_dtype`。已量化的层要退回浮点，必须提供该层真实的浮点权重，只把 JSON 里的标签改回 `"FLOAT"` 或改 `--dtype` 都不能恢复丢失的精度。每次切换权重精度与配方，都要连带记录 checkpoint 版本、描述文件、`vllm-ascend` 与 `vllm` 版本、硬件型号和端到端评估结果。

### 版本差异

`v0.30.0` 面向标准 full Attention 的 ModelSlim **`C8-MXFP`** 需要显式传 `--kv-cache-dtype mxfp8` 启用，兼容模型级和逐层 recipe（权重包自带 `fa_v.scale` 等 recipe 但未传 `--kv-cache-dtype mxfp8` 时仅告警不生效；若同时声明 `fa_quant_type` 则 `FAKQuant` 自动让位给 `C8-MXFP`）。开启时 K 按动态 MXFP8、V 使用静态 E8M0 通道缩放（`fa_v.scale` 映射为 `v_cache_scale`，无消费者的 Q/K 静态 scale/offset 被过滤；缺 recipe 时 V scale 用中性默认并告警）。该路径强制 `block_size % 512 == 0`：用户显式指定非 512 倍数时直接抛 `ValueError`，未显式指定时静默改写为 `512`；在 `kv-cache-quantization` 一侧还受 full Attention、因果掩码、无 PCP/DCP 滑窗及 Mooncake 四张量传输等约束，详见[缓存量化版本差异](kv-cache-quantization.md#版本差异)。

下表按站内统一四列版本基线核对核心变化（其中执行侧基线为 `v0.30.0 (c09d3e20)`，上游 `vllm` 对应核对 `0fc695fc` / `568afb3a` / `ced6857a`）：

| 维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` **[主基线]** | `main (8d6180e2)` |
|---|---|---|---|---|
| **量化代码目录** | `quantization/modelslim_config.py` 与 `methods/w8a8_*.py` | 同 `v0.23.0` | 拆分为 `quantization/configs/*.py` 与 `methods/w8a8/*.py` | 同 `v0.30.0` |
| **平台 `supported_quantization`** | 4 项（`ascend`、`compressed-tensors`、`fp8`、`deepseek_v4_fp8`） | 同 `v0.23.0`（4 项） | **6 项**（新增 `modelopt_mxfp8`、`mxfp8`） | 同 `v0.30.0`（6 项） |
| **`detect_quantization_method`** | 探测 ModelSlim + `compressed-tensors` + `fp8`（限 A5） | 取消 `fp8` 探测的 A5 限制 | `configs/modelslim_config` 路径更新，继续探测这三类 | **仅探测 ModelSlim**（`quant_model_description.json`），其余交上游 |
| **`W8A8_DYNAMIC` 线性/MoE** | `linear`+`moe`；含 `_chunk_size` 拆块；无 `PreparedLinearInput` | 同 `v0.23.0` | 移除 `_chunk_size` 拆块；新增 `PreparedLinearInput` 与 MoE `w13_weight_scale_fp32` | 同 `v0.30.0` |
| **`W8A8_MIX`（`w8a8_pdmix.py`）** | 注册 `("W8A8_MIX", "linear")` 与 `("W8A8_MIX", "moe")` | 同 `v0.23.0` | **仅注册 `("W8A8_MIX", "linear")`**（移除 `moe`）；按 `is_kv_consumer` 分派静态/动态 | 同 `v0.30.0` |
| **原生 FP8（`fp8_block.py`）** | 无此重分组执行路径 | 无此重分组执行路径 | 950 转 MXFP8（`kv_b_proj` 与 `in_features%32!=0` 保持浮点）；**A2/A3 静默反量化回 `model_dtype`（通常 BF16）**；310P `COMPATIBILITY` 后端不注册 `AscendFp8Config`（仅注册 `AscendModelSlimConfig310`，无原生 FP8 执行路径） | 950 同 `v0.30.0`；**A2/A3 `_require_fp8_weight_matmul()` 抛 `NotImplementedError`**；310P 仍为 `COMPATIBILITY` 后端且不注册 `AscendFp8Config`（无执行路径、不支持） |
| **`W4A8_DYNAMIC` / `C8-MXFP` / `TurboQuant`** | 无 `C8-MXFP` 与 `TurboQuant` | 无 `C8-MXFP` 与 `TurboQuant` | `W4A8_DYNAMIC` 仅注册 `moe`；`C8-MXFP` 要求 `block_size%512==0`；`TurboQuant` Route B 要求 `use_v2_model_runner` | `W4A8_DYNAMIC` 新增 `linear` 注册；`TurboQuant` Route B 移除 `use_v2_model_runner` 校验 |

上游 `vllm` 侧在三版（`0fc695fc` / `568afb3a` / `ced6857a`）均保留 `dtype` 默认 `"auto"` 与 `quantization` 默认 `None`，以及 `ModelConfig._verify_quantization` 的方法名与平台校验；`ced6857a` 的具体入参与模型建层接口见上文 `Qwen3-8B` / `Qwen3-30B-A3B` 对照。

### 源码位置

| 入口（以 `v0.30.0 c09d3e20` + `vllm@ced6857a` 为主） | 对照什么 | 意味着什么 |
|---|---|---|
| `platform.py` L101–108、L340–349（`main` L425–433）、`quantization/utils.py` L140–265 | 6 项 `supported_quantization`、仅 `STANDARD` 后端注册 `AscendFp8Config`（`COMPATIBILITY` 仅 `AscendModelSlimConfig310`）、自动探测顺序与 warning 规则 | 「开了量化」与「选中哪种量化」是两件事，且 310P 不注册原生 FP8 配置 |
| `quantization/configs/modelslim_config.py` L108–860 | `quant_model_description.json` 查表、`FLOAT` 跳过、分片一致性、Embedding 回退与 `C8-MXFP` | ModelSlim 精度是按层的属性，不是全模型开关 |
| `quantization/methods/registry.py` L20–62 | 以 `(quant_type, layer_type)` 注册与查表 | 层类型缺注册就会加载报错 |
| `quantization/configs/fp8_config.py` L26–144 与 `methods/w8a8/fp8_block.py` L17–297 | `weight_block_size` / `dynamic` 校验、950 转 MXFP8 与例外层、A2/A3 回退 `model_dtype`（`main` 改报错） | 原生 FP8 在不同芯片代际和版本上行为截然不同 |
| `quantization/methods/w8a8/w8a8_dynamic.py` L60–501 | 线性/MoE 静态权重、逐 token 量化、`PreparedLinearInput`、NZ 与 `w13_weight_scale_fp32` | 权重离线量化、激活运行时现算，且 MoE 参数按专家分组 |
| `quantization/methods/w8a8/w8a8_static.py` L33–145 与 `w8a8_pdmix.py` L36–93 | 静态整张量激活参数；`W8A8_MIX`（仅 `linear`）按 `is_kv_consumer` 切换动/静态 | `W8A8_MIX` 加载全套静态缓冲，执行期按 PD 角色分派 |
| `quantization/methods/w4a8/w4a8.py`、`utils.py` L1444–1515、`turboquant/config.py` L15–95 | `W4A8_DYNAMIC`、`C8-MXFP` 512 倍数约束、`TurboQuant` 两路校验 | 新方案与 KV 量化有严格的硬件与块大小约束 |
| `device/hardware_profile.py` L281–343（`main` L316–322、L417–440）、`ascend_forward_context.py`、`token_dispatcher.py`、`moe_quant.py` | 芯片量化后端家族（`310P` 为 `COMPATIBILITY`）、MoE 选路策略、dispatch `quant_mode=2/4` 与 combine 默认 `0` | 310P 量化后端隔离，且 EP dispatch 传 INT8/MXFP 由量化方案与通信策略共同决定 |
| `vllm@ced6857a` `qwen3.py` / `qwen2.py` / `qwen3_moe.py`、`glm5next/model.py`、`gate_linear.py` | Qwen3-8B / Qwen3-30B-A3B 建层传参，与历史 GLM-5.3-Flash 边界对照 | 模型代码决定哪些模块有资格查量化描述 |

**来源与结论对应：**

- ModelSlim、LLM-Compressor 与原生 block-wise FP8 的官方使用入口及 950 vs 非 950 硬件差异概述见官方量化指南 [S1]；CANN `aclnnDynamicQuant` 逐 token 对称量化与按行绝对最大值求 scale 公式见 CANN 文档 [S2]；历史 GLM 双机启动命令见教程 [S3]，两份固定模型快照配方差异（`9e55cbc8` vs `3121f187`）见模型描述文件 [S4][S5]。
- 平台 `supported_quantization` 6 项列表与 `v0.30.0` vs `main` 的 `detect_quantization_method` 收敛差异（来源 6–8），对照 `platform.py` 与两版 `quantization/utils.py` [C6][C8]。
- `AscendModelSlimConfig` 读取 `quant_model_description.json`、融合分片一致性检查、`"FLOAT"` 跳过、`VocabParallelEmbedding` 缺键回退、`C8-MXFP` 开关与 `fa_v.scale` 映射（来源 9–13）及方案注册表，对照 `modelslim_config.py` 与 `registry.py` [C10][C14]。
- 原生 FP8 的 `weight_block_size` 与 `activation_scheme == "dynamic"` 强制校验、`fp8_block.py` 在 950 上重分组 MXFP8 及 `kv_b_proj`/`in_features % 32 != 0` 例外、A2/A3 在 `v0.30.0` 静默反量化回 `model_dtype`（通常 BF16）而 `main` 抛 `NotImplementedError`，以及 310P 因 `QuantizationBackendFamily.COMPATIBILITY` 不注册 `AscendFp8Config`（仅注册 `AscendModelSlimConfig310`，且 `model_dtype` 为 FP16）导致原生 FP8 无执行路径、不受支持（来源 15–18、28、51–55），对照 `fp8_config.py`、两版 `fp8_block.py`、`platform.py` 与 `hardware_profile.py` [C15][C18][C51][C52]。
- `W8A8_DYNAMIC` 的 `PreparedLinearInput`、转置、`FRACTAL_NZ`、`w13_weight_scale_fp32` 与 MoE 融合/非融合路径（来源 19–21）、静态 `W8A8` 整张量激活参数及 `v0.23.0`/`v0.26.0rc` 的 `_chunk_size` 差异（来源 49–50），对照各版 `w8a8_dynamic.py` 与 `w8a8_static.py` [C19][C22]。
- `W8A8_MIX`（`w8a8_pdmix.py`）仅注册 `linear`（对比 `v0.23.0`/`v0.26.0rc` 含 `moe`，来源 47–48）以及按 `is_kv_consumer` 分派静态/动态与加载静态缓冲，对照三版 `w8a8_pdmix.py` [C23][C48]。
- `W4A8_DYNAMIC` 在 `v0.30.0` 与 `main` 的 `moe`/`linear` 注册差异（来源 24–25）、`C8-MXFP` 的 `block_size % 512 == 0` 校验/静默改写，以及 `TurboQuant` 共同前提与 Route A/B 约束，对照 `w4a8.py`、`utils.py` 与 `turboquant/config.py` [C24][C26][C27]。
- MoE 芯片家族选路策略与 EP dispatch `quant_mode=2/4`、combine 默认 `0` 的判定逻辑（来源 28–31），对照 `hardware_profile.py`、`ascend_forward_context.py`、`token_dispatcher.py` 与 `moe_quant.py` [C29][C30]。
- 上游 `dtype`/`quantization` 默认与校验逻辑（来源 32–33）、`Qwen3-8B` / `Qwen3-30B-A3B` 各子模块 `quant_config` 传参（来源 34–41），以及历史 GLM `glm5next/model.py` 与 `GateLinear` 的 FP32 边界（来源 42–46），对照 `vllm@ced6857a` 与 `glm5next/model.py` [C33][C42][C46]。
- 量化半格舍入与截断误差公式界为算术推导 [D]；`Qwen3-8B`（`o_proj` `50.05%`、MLP `288 MiB/层` 与 36 层 `10.125 GiB -> 5.0625 GiB`）与 `Qwen3-30B-A3B`（128 专家 48 层 `54 GiB -> 27 GiB`、EP8 单卡 `72 MiB/层` 与 `320 KiB ≈ 0.43%` 辅助账）按公开模型结构参数与 `w8a8_dynamic.py` 张量形状推导 [D]；EP dispatch `quant_mode=2` 的单副本张量载荷（`4,096 B -> 2,052 B` 与 `8,192 B -> 4,100 B`）按元素宽度推导 [D]；历史 GLM-5.3-Flash 双机 `432 MiB/层`、`17.72 GiB` 与 `864 KiB ≈ 0.2%` 规模按历史部署子账与张量形状推导 [D]。

**待核：** 本轮只核验了 `vllm@ced6857a` 中 `Qwen3-8B` / `Qwen3-30B-A3B` 的建层传参与 `AscendModelSlimConfig` 调度代码，未联网抓取具体 `Qwen3-8B-w8a8` / `Qwen3-30B-A3B-w8a8` 权重包的 `quant_model_description.json`，实际逐层精度仍须以所部署权重包内文件为准；同样缺少各方案在昇腾 NPU 上的实测 trace（动态量化耗时、NZ 对齐与工作区峰值字节、各精度端到端评测分差），以及普通整数方案下 combine 默认 `quant_mode=0` 的设计原因说明。
