---
id: quantization
title: W8A8 量化：权重压成 INT8，算完再乘回缩放系数
type: feature
summary: >-
  量化用较少位数和相应缩放表示数值。本页用 INT8 W8A8 讲缩放、零点、舍入、截断与反量化，再分清动态与静态量化，最后落到 GLM 双机：两个 8
  位分别从哪来、哪些矩阵保持 BF16、缩放系数占多少字节；其他格式、算法、ND/NZ 与验收各有延伸页。
aliases:
  - 量化
  - Quantization
  - W8A8
  - W8A8_DYNAMIC
  - INT8
  - ModelSlim
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
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L83-L214'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L60-L70'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L365-L470'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/methods/registry.py#L19-L62'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L155-L289
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L370
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L33-L141
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_stage_params.py#L91-L119'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L88-L229'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1300'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1540'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1541-L1680'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1881-L1963'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_dynamic.py#L47-L151
  - >-
    vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L59-L127
  - >-
    vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L80-L90
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L47-L65
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2268'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2455-L2459'
  - 'vllm@0fc695fc:vllm/config/model.py#L149-L215'
  - 'vllm@0fc695fc:vllm/config/model.py#L996-L1096'
  - 'vllm@0fc695fc:vllm/config/model.py#L1956-L2085'
  - 'vllm@568afb3a:vllm/config/model.py#L2036-L2125'
  - 'vllm@84030bbe:vllm/config/model.py#L2277-L2366'
  - 'vllm@568afb3a:vllm/config/model.py#L149-L215'
  - 'vllm@84030bbe:vllm/config/model.py#L170-L240'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L140-L145'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L83-L214'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/utils.py#L80-L214'
  - 'vllm-ascend@baa023ad:vllm_ascend/quantization/utils.py#L133-L264'
  - 'vllm@84030bbe:vllm/config/model.py#L1258-L1360'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L91-L134
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_static.py#L89-L134
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelslim_config.py#L459-L498
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelslim_config.py#L722-L737
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/configs/modelslim_config.py#L797-L837
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L85
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L377-L395'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L742-L745'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L875-L889'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L1551-L1553'
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L252'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L150-L260'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L270-L339'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L33-L141'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_static.py#L32-L126'
  - 'vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/w8a8_static.py#L33-L136'
  - >-
    https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/API/aolapi/context/ops-nn/aclnnDynamicQuant.md
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 矩阵乘讲清 Y=XW 与权重的存法，本页讲操作数换成 8 位后多了哪两步
  - to: glm-5-3-flash
    kind: builds-on
    note: 逐部件的文件精度与加载后精度在模型页，本页讲这些精度是怎么被选中的
  - to: expert-parallel
    kind: builds-on
    note: 专家权重和 dispatch 的 int8 载荷都出现在 MoE 这一站
  - to: cann-hccl
    kind: builds-on
    note: 量化改变的是交给通信的张量类型，字节账在通信页
  - to: kv-cache-quantization
    kind: alternative-to
    note: 同样是降精度，但对象是历史状态、写在缓存里，收益和误差都另算
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: direct
---

## 量化是什么？

**量化（quantization）把一个张量换成位数更少的格式，同时保存一组缩放系数（scale），用来把少位数的数换回原来的数值范围。** 张量是模型里成批的数：权重是训练好、长期驻留的参数；激活（activation）是当前这批输入走到某一层时算出的中间结果。

BF16 是 16 位浮点格式，每个数占 2 字节；INT8 是 8 位整数，每个数占 1 字节，一共只能表示 −128 到 127 这 256 个值。从 BF16 换成 INT8，每个数就从 2 字节变成 1 字节。

整数装不下 0.26 这样的小数，所以先定一个缩放系数，比如 0.1（示意），每个数只记「它大约是 0.1 的几倍」：0.26 记成 3，1.04 记成 10，−0.18 记成 −2。要用的时候再乘回 0.1，得到 0.3、1.0、−0.2，和原来只差一点。13 本该记成 130，超出了 INT8 的上限 127，只能记成 127，还原成 12.7。下图就是这四个数：

```wiki-diagram
file: quantization
```

一批数共用一个缩放系数（整个张量一个，或者每行、每列各一个），所以多存的只是少量系数，大头的数都从 2 字节变成了 1 字节。

**本页的 W8A8 是这一层的权重（W）和参与矩阵乘的激活（A）都用 8 位整数。** W/A 后的数字本身只交代位数；是不是 INT8、FP8，还要看具体方案。它不等于模型里所有张量都变成 8 位：整数乘加的累加结果、缩放系数、层与层之间传递的隐藏向量（每个 [token](token.md)，即文本切出的一个小片段，在层间传递的那一排数）都可以是别的格式。

读这一组知识可以按问题前进：本页先讲一个数怎样量化；[数值格式](low-precision-formats.md)比较 BF16、FP16、INT8、FP8、FP4；[量化方法](quantization-methods.md)解释校准、PTQ/QAT、AWQ/GPTQ/SmoothQuant；[ND 与 NZ](tensor-layout.md)解释数值不变时怎样重新排布；[KV cache 量化](kv-cache-quantization.md)讲历史状态；[量化验收](quantization-evaluation.md)把误差、任务质量、容量与速度放到同一次对照里。

## 为什么需要量化？

**在本页的权重常驻部署中，模型权重放在计算卡的内存里，执行时从内存层次读进计算单元；同一批元素存得越宽，权重载荷就越大。** 权重卸载是另一种部署方式，不能把常驻要求扩大到所有推理实现。

先看占多少。大模型动辄几百亿、上千亿个参数，按 BF16 每个 2 字节，1,000 亿个参数（示意）光权重就是 200 GB，一张卡通常装不下，要多张卡分着放。卡上的内存（[设备内存](device-memory.md)，也常叫显存）除了权重，还要装 [KV cache](kv-cache.md)：生成文本时，模型把前面每个位置在每一层算出的两组向量（k 和 v，[attention](attention-qkv.md) 回头读上文时要用）存起来，下一步直接读，不必把旧位置重算一遍。权重占得越多，留给 KV cache 的就越少，能同时处理的请求和上下文长度也跟着变少。

再看搬运。普通自回归 decode 中，每条请求通常为一个新位置做前向，途中要读取本步实际使用的权重；MoE 只执行选中的专家，不能算成每步读取所有专家。批次很小时，同一份权重服务的输入行少，更容易受访存限制；批内复用、缓存和内核分块决定真实读取次数。投机解码还会在一次前向验证多个位置。

换成 INT8，同样权重元素的载荷减半；在读取集合与次数相同的比较里，这部分字节也减半。代价是近似误差，以及额外的系数与量化计算。下面先看一个数怎么压、差多少，再看一次矩阵乘怎样用 8 位算，最后算账。

## 一个数怎样压下去、再还原回来

先看最简单的对称量化：零点（下文说的整数偏移）固定为 0，只用一个正的缩放系数 s。量化与还原是 `q = clamp(round(x / s), −128, 127)` 和 `x̂ = s × q`：先除以 s，round 舍入到最近的整数，clamp 把超出 −128…127 的数截到边上；还原时乘回 s。恰好落在半格上的取整规则由具体算子规定，下面的示意数不涉及这种平局。

取 s = 0.1，就是上面那张图：x = 0.26 除以 0.1 是 2.6，舍入得到 q = 3，还原成 0.3，差的 0.04 是舍入误差；x = 13 算出 130，超过 127 的上限，只能存成 127，还原成 12.7，这 0.3 是截断误差。

**s 取多大，本身是一笔取舍。** 没有截断、且先忽略浮点表示误差时，舍入误差最多半格，也就是 s ÷ 2；能存下的范围是 −128s 到 127s。s 取小，格子细，但范围窄，大数容易被截断；s 取大，范围宽，但格子粗。上面的 0.1 是随手取的，所以 13 被截断了。对包含非零有限值的一批数，一种对称取法是 s = 最大绝对值 ÷ 127，让最大绝对值对应整数幅度 127；在这个理想计算里不会截断，全零输入则需要算子单独处理。图里四个数的最大绝对值是 13，按这个取法 s = 13 ÷ 127 ≈ 0.102，13 正好存成 127；但前三个数仍只落在 3、10、−2 上，对它们来说格子很粗。一个特别大的数（离群值）会把 s 拉大，拖累共用这个 s 的其余数，下一节讲系数粒度时还会用到这一点。

**对称方案有一处浪费：0 被放在格子正中，−128…−1 这一半格子专给负数。** 如果一批数全是正的，比如都落在 0 到 25.5 之间，负的那一半格子就全空着；s 仍取 0.1 时，能表示的正数只到 12.7，13 就被截断了。非对称方案多存一个整数偏移 z，叫零点：0 这个数被记成哪个整数，z 就是几。量化与还原变成 `q = clamp(round(x / s) + z, −128, 127)` 和 `x̂ = s × (q − z)`，还原时多一次减法。取 z = −128，0 就记成 −128，25.5 记成 127，整排格子都给了正数：

```calc
title: 非对称量化：同样 s = 0.1，13 不再被截断（示意数）
13 压成整数 = round(13 ÷ 0.1) + (−128) = 130 − 128 = 2
还原 13 = 0.1 × (2 − (−128)) = 0.1 × 130 = 13.0
0.26 压成整数 = round(0.26 ÷ 0.1) + (−128) = 3 − 128 = −125
还原 0.26 = 0.1 × (−125 − (−128)) = 0.1 × 3 = 0.3
```

0.26 的舍入误差和对称时一样是 0.04，13 这次原样还原。GLM 双机走的动态 W8A8 用的其实是对称的算法：激活按 token 对称量化，没有零点；权重文件里每个输出通道虽然也存了一个偏移，矩阵乘并不使用它，所以后文的公式可以忽略零点。真正用上偏移的，是后面静态量化给激活存的那一份。

## 放进一次矩阵乘：W8A8 的四步

线性层做的是矩阵乘：输出里的每个数，是一行激活和一列权重逐个相乘再相加的结果，见[矩阵乘与权重](matmul-and-weights.md)。W8A8 把两边都按上一节的办法压成 INT8，用整数做乘加，最后再把系数乘回来：

```wiki-diagram
file: quantization-intuition
```

图里的四步就是 W8A8 的全过程：

1. **权重按输出通道压。** 输出通道指权重矩阵在输出维度上的一列，这一列负责算出输出向量里的一个位置。每列自己求一个缩放系数，整列的数除以它，再舍入、截断到 INT8 的范围。这一步在部署前离线做完，存进权重文件。
2. **激活按 token 压。** 每次前向都要做一次：激活矩阵里一行是一个 token 的向量，每行自己求一个缩放系数。
3. **整数乘加。** 两份 8 位整数相乘相加，中间结果用更宽的整数累加，降低溢出风险；具体累加类型和可承受的求和长度仍受算子约束。
4. **乘回两个缩放系数。** 一个输出元素来自「这一行激活 × 这一列权重」，所以还原时乘的就是这一行的系数乘这一列的系数，输出重新变回 BF16。

把四步合起来看一个输出元素：忽略零点时 `ŷ = sₓ × s𝑤 × Σ qₓᵢ q𝑤ᵢ`，Σ 表示把每个位置 i 上的两个整数之积全部加起来。整数部分先全部加完，两个系数最后一起乘上去；能这样提到外面，是因为同一行激活共用一个 sₓ，同一列权重共用一个 s𝑤。下面用 3 个数的小例子走一遍，系数按上一节「最大绝对值 ÷ 127」来取（数是编的，示意）：

```wiki-diagram
file: quantization-dot
```

```calc
title: 一个输出元素的四步（示意数）
激活一行 x = [0.523, −0.31, 1.27]
权重一列 w = [0.40, −2.54, 0.86]
激活系数 sₓ = 1.27 ÷ 127 = 0.01
权重系数 s𝑤 = 2.54 ÷ 127 = 0.02
qₓ = round(x ÷ 0.01) = round([52.3, −31, 127]) = [52, −31, 127]
q𝑤 = round(w ÷ 0.02) = [20, −127, 43]
> 权重这一步在部署前离线做好
整数乘加 = 52 × 20 + (−31) × (−127) + 127 × 43 = 1040 + 3937 + 5461 = 10438
乘回两个系数 ŷ = 0.01 × 0.02 × 10438 = 2.0876
直接用原数算 y = 0.523 × 0.40 + (−0.31) × (−2.54) + 1.27 × 0.86 = 2.0888
```

两个结果只差 0.0012，来源是 0.523 被舍入成了 0.52（0.003 × 0.40 = 0.0012），其余几个数正好落在格子上。注意第 3 步：3 项就加到 10438，早就超出 INT8 的 127；真实的一行有几千项，所以累加要用更宽的整数。

缩放系数不参与整数乘加，只在第 4 步用上。数值范围完全靠它恢复，所以系数本身必须用较高精度保存，也必须跟着权重一起搬。

**系数的粒度是一笔取舍。** 整个张量共用一个系数最省元数据（系数这类跟着数据一起存的附加信息），但一个离群值就会把系数拉大，其余的数被挤到很少的几个整数上；按输出通道、按行或按更小的分组各给一个系数，可以把离群值的影响限制在更小范围，同时增加元数据，最终误差仍取决于数据与量化规则。还要看算子（设备上执行某一种运算的程序，比如矩阵乘）支持哪种粒度。本部署的粒度是权重每个输出通道一个、激活每个 token 一个。

下面的交互图沿用这组三通道数值。权重的离线量化与激活的运行时量化分开播放，再逐项形成整数乘积、累加和反量化结果。图中 2.0876 是乘回系数后的数学值，最终存成 BF16 时还要按该类型舍入。

```wiki-scene
inference-mechanism:5
```

## 省下什么，付出什么

按 INT8 存权重，同一批矩阵的字节数正好是 BF16 的一半。拿一个 4096 × 4096 的权重矩阵算一笔（尺寸是示意），系数和偏移按上一节的做法，每个输出通道各一个：

```calc
title: 一个权重矩阵换成 INT8 省多少（示意尺寸）
元素个数 = 4096 × 4096 = 16,777,216
按 BF16 存 = 16,777,216 × 2 B = 33,554,432 B = 32 MiB
按 INT8 存 = 16,777,216 × 1 B = 16,777,216 B = 16 MiB
每个输出通道一个系数、一个偏移 = 4096 × 2 × 2 B = 16,384 B = 16 KiB
INT8 连同系数占 BF16 的比例 = (16,384 KiB + 16 KiB) ÷ 32,768 KiB ≈ 50.05%
> 系数和偏移按每个 2 字节记
```

系数和偏移只有矩阵本身的千分之一，所以换成 INT8 后几乎正好省下一半，这个矩阵省约 16 MiB。

代价有三笔：

- **误差。** 舍入误差和超出范围后的截断误差都会进入这一层的输出，并随层数累积。本部署没有精度对比实测，换权重精度必须重跑评估。
- **多出来的参数和步骤。** 缩放系数、偏移要跟权重一起存、一起加载；动态激活量化需要运行时计算，独立算子、提前量化和融合会改变实际调用次数；权重加载后还要转置并换成设备偏好的分块布局。
- **只有能量化的层才省。** 精度按层生效，后面单独有一节讲哪些层是 8 位。

| 存同一个权重矩阵 | 每个元素 | 另外要存 |
|---|---:|---|
| BF16 | 2 字节 | 无 |
| INT8 | 1 字节 | 每个输出通道一个缩放系数和一个偏移；加载后可能再多一份别的精度的系数副本 |

省下的字节也不会原样变成 KV cache 的额度：设备上还要为权重重排、激活量化和算子执行留工作区，[显存探测](kv-cache-memory-profiling.md)要重新量一遍，才知道剩下多少能装历史状态。

## 动态量化和静态量化，差在什么时候算系数

本页两套 W8A8 实现都以 INT8 保存权重，逐输出通道配置权重系数；主要区别在激活系数何时确定，静态实现还多了相应的偏置和反量化参数。表里的偏置（bias）是矩阵乘之后要加上的一排常数，整数偏置就是把它预先换成整数，直接加进整数累加的结果：

| | 动态量化 | 静态量化 |
|---|---|---|
| 激活的系数什么时候定 | 每次前向按当前输入现算 | 部署前用校准数据定好，和权重一起存进文件 |
| 激活系数的粒度 | 每个 token 一个 | 整个张量一个（本站核对的源码版本如此，下称固定版本） |
| 好处 | 跟着本次输入的范围走，不必离线校准这份激活 scale | 前向少一步求系数，偏移和整数偏置也能预先算好 |
| 代价 | 运行时需要求系数并量化；实际算子数取决于融合与预量化路径 | 真实输入偏离校准范围时可能增加截断等误差 |

固定版本的两套实现正好对上这张表。动态方法只建 INT8 权重和逐输出通道的系数、偏移，激活的系数在前向里现算；静态方法在建参数时就为激活留了整张量共享的系数和偏移，还有整数偏置和反量化系数（反量化就是本页说的「还原」，这个系数把整数结果乘回原来的范围），前向直接取用，不再求系数。

本页先用整数解释缩放与误差；若遇到 FP8、MXFP4、NVFP4 或 HiF8，接着读[低精度格式](low-precision-formats.md)。它用一组数演示浮点舍入怎样进入点积，并分清元素格式、分组系数和物理打包；相同位数不代表相同格式。

“动态”没有承诺整个量化流程都不需要数据。若离线权重处理还用到异常值平滑、裁剪搜索或输出误差优化，仍可能需要代表性样本；详见[量化方法中的校准](quantization-methods.md#校准是在做什么动态量化还需要吗)。

## 放到 GLM 双机：两个 8 位分别从哪来

用[官方双机前提](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2 各 8 张卡，TP8（机内 8 卡合切一个矩阵）、DP2（两台各有一个独立调度请求的执行组）、EP16（专家分布在全部 16 卡），权重取 W8A8 量化包。请求走到[第 4 站逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)以后，每个走量化实现的线性层都按上面四步过一遍。

本部署的量化层走动态这一路：教程按 `--quantization ascend` 加载 W8A8 权重包，每层用哪套方法由权重目录里的量化描述文件决定。该包的 9e55cbc8 与 3121f187 两个固定快照都标明 W8A8_DYNAMIC，但逐层精度有差异，下面分别说明。名字里的「动态」只描述激活，权重仍然是离线转好、加载即用的；实际部署须记录下载的快照，不能只留模型目录名。

**权重侧是离线结果，加载时只做搬运和整形。** 加载按「输出维 × 输入维」建 INT8 权重，并为每个输出通道建一个缩放系数和一个偏移；加载结束后把权重转置成算子要的方向，再换成设备偏好的分块布局。转置方向与数学形状的对应关系在[矩阵乘与权重](matmul-and-weights.md#开销和什么时候别开)讲过，这里不重复。

**激活侧每次现算。** 普通动态 Linear 拿到 BF16 输入，先按 token 量化成 INT8 并得到每行一个系数，再调量化矩阵乘，把权重的系数和这一行的系数一起交给算子；这条路径的输出类型跟随输入，也就是 BF16。这描述线性层的浮点输入、输出，不表示所有中间张量都保持 BF16：下文 MC2 派发和专家中间结果就会携带 INT8。

**每张卡的权重大头是专家。** GLM 45 层里有 42 层是 [MoE](moe.md)（混合专家：一层里并排放很多个小网络，每个叫一个专家，每个 token 只交给其中几个去算）。其中最大的一块是**路由专家**（可供 router 打分挑选的全部专家，每层 288 个，不是某个 token 选中的那几个）：按 INT8 记，每卡每层 432 MiB，42 层合计 17.72 GiB。作为比较，3121f187 快照下每卡所列语言权重子账是 20.58 GiB，专家占了这个子账的绝大部分；它还没计视觉塔、MTP 旋转矩阵等表外项，见[双机部署的统一边界](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。同一批专家矩阵若按 BF16 存，就要多占同样多的字节，实际 KV 余量仍需重新 profile。

**专家是同一套方法的 MoE 版本。** 每张卡本地的 18 个专家（288 个路由专家按 EP16 分，分法见[expert parallel](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)）合成两块大权重：一块是 gate 与 up 合并的矩阵，一块是 down。系数按专家、按输出通道保存。若 **dispatch**（把 token 的向量发给持有它选中专家的卡）已返回量化数据及系数，专家段会复用它们；没有动态系数时则在专家计算入口量化。MC2 的对应分支在两次分组矩阵乘之间执行 SwiGLU（先算门控再逐元素相乘的激活）和再量化；根据融合开关，它可以把第一段矩阵乘也合进去，或先做整数矩阵乘，再做反量化、SwiGLU 与再量化的融合算子。不能把这些分支合称每次都走同一个融合内核。

```calc
title: 缩放系数比权重主体小多少（每卡每层的路由专家）
权重主体（引自部署页） = 432.0 MiB
系数与偏移 = 4 组 × 18 个专家 × 4096 × 2 B = 589,824 B = 576.0 KiB
加载后另存一份 FP32 系数 = 18 × 4096 × 4 B = 294,912 B = 288.0 KiB
辅助合计占权重主体 = 864.0 KiB ÷ 442,368.0 KiB ≈ 0.2%
> 4 组 = 两块权重各一个系数、一个偏移；两块的通道数都是 4096
```

所以「INT8 权重加上系数」仍然接近 BF16 权重的一半：辅助参数是千分之二这个量级，真正占字节的是权重主体。但辅助参数不止系数——加载后的布局转换、运行时的量化输出和临时空间都另占显存，这些在部署页的每卡账里单独记。

### 哪些矩阵是 8 位，哪些保持 BF16

**精度按层生效。** 接量化配置的 Linear 与 MoE 先检查是否命中描述文件中的 FLOAT 跳过条件；否则取精度，按「精度名称、层类型」这一对键到注册表里找方法类。取精度所需的权重条目缺失会报错，注册表缺对应实现也会报错；融合在一起的几个矩阵还必须标同一种精度。

**Embedding 有明确例外。** 固定实现先检查有没有量化权重条目，没有就返回不量化的嵌入实现；未匹配到处理分支的其他层返回 None，交给上层原有处理。因此不能说“接了量化配置的所有层缺条目都报错”。本模型的嵌入表在建层时就没有传量化配置，又是更早的一道区别。下图只画 Linear/MoE 的选择与普通动态 Linear 前向。

```wiki-diagram
file: quantization-flow
```

逐部件的分层表在[矩阵乘与权重](matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影)，本页不重复。这里分清精度由哪一层决定：有些部件在代码里关闭量化，另一些才读取描述文件。先认表里的几个部件：KDA 与稀疏 MLA 是 GLM 的两种 attention 层，主干分别有 34 层和 11 层（KDA 见[线性注意力](linear-attention.md)）；索引器给历史位置打分，router 给专家打分。

| 依据 | 覆盖的部件 | 结论强度 |
|---|---|---|
| 模型代码建层时就不接量化配置 | KDA 层的九个投影（Q、K、V、两组门控投影、b 投影、输出投影）；索引器的 K 投影与打分投影；嵌入表；router 的打分矩阵（按 FP32） | 与描述文件无关，一定不走量化实现 |
| 建层时接了量化配置，实际精度由描述文件决定 | 前 3 层稠密 MLP；路由专家与共享专家；MLA 投影；索引器 Q 投影；词表投影 | 按实际量化目录固定快照逐项确认；两个同名模型快照也会不同 |

第一行的部件建层时传的量化配置是空的，或者没有传这个参数，因此不会走该量化实现；router 还明确按 FP32 建权重和算分。第二行中，两个固定快照的稠密 MLP、路由专家和共享专家都是 W8A8_DYNAMIC；MLA 的 KV 展开投影、索引器 Q 投影和词表输出头都标 FLOAT，按本部署浮点类型加载。

差异出在 MLA 的 Q 压缩、KV 压缩、Q 展开和输出这四组投影：9e55cbc8 标 FLOAT，3121f187 改为 W8A8_DYNAMIC，覆盖主干 11 层和 MTP 的 1 层。代码可能把 Q/KV 压缩合成一个模块，描述文件仍分别列两组权重，不能混淆模块数与矩阵数。相应容量差额和表外权重统一见[部署页](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。这证明两个文件的逐层配方，不证明现场下载的目录一定是哪一版。

请求历史的降精度是另一件事：对象是 KV cache，写在缓存里、按块读出，收益和误差都另算，见[缓存量化](kv-cache-quantization.md)。

### 为什么 EP dispatch 搬的是 int8

MoE 的 dispatch 要把 token 的隐藏向量发到持有它选中专家的卡上。固定 A2 选路要求每卡专家数不超过 24、EP 至少 16，且本轮 token 数不超过 MC2 容量，才选 [MC2](collective-communication.md#mc2)，否则选 AllGather。双机的 18 专家/卡、EP16 满足前两项，仍要检查本轮 token 数。MC2 是昇腾把分块计算与通信排成相互重叠的流水的一类实现，不是新的集合通信语义。

在这里讨论的 W8A8 MC2 分支中，派发量化判定为真，调用使用 quant_mode=2，返回 INT8 激活及 FP32 动态系数供专家计算复用；专家输出为 BF16，combine 的对应通信量化模式为 0。这个分支减少了派发的激活载荷，专家入口也省掉重复量化。W8A8FP8、MXFP 等其他 8 位方案有不同目标类型，不能只凭“8 位”推断通信必为 INT8。

一个 token–专家副本的字节数、整次前向的通信账在[通信库 · 数据精度和本地计算](cann-hccl.md#数据精度和本地计算怎样影响通信)算过，本页只引用不重算；派发与回收的路线见[expert parallel](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。combine 为什么不一起量化，固定版本的源码没有写理由，本页不下结论。

## 常见误解

- **「W8A8 就是整个模型都用 8 位。」** 它按层生效：不少部件保持 BF16 或 FP32，逐部件精度见[矩阵乘与权重的分层表](matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影)，哪些是源码写死、哪些是推断见[上文的依据表](#哪些矩阵是-8-位哪些保持-bf16)，文件里怎么存、加载后变成什么见[模型页的权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。
- **「量化以后这一层就没有浮点计算了。」** 只有矩阵乘的操作数变成整数。归一化、SwiGLU 的门控、router 打分、combine 的加权相加都还在浮点里，输出也是 BF16。
- **「量化后所有通信都减半。」** 上述 W8A8 MC2 dispatch 分支传 INT8 加系数，不代表其他通信也变成 INT8；本部署普通 TP 部分和与该 combine 路径仍是 BF16。通信量按实际执行分支交给通信操作的张量类型算。
- **「权重省下 1 GiB，KV cache 就多 1 GiB。」** 还有布局填充、运行时副本和算子工作区；显存预算要重新探测。
- **「静态量化一定更快，动态量化一定更准。」** 静态省掉求系数的一步，动态跟着当前输入的范围走；谁更快、谁误差更小取决于算子实现和真实输入分布，本部署没有两者的对比数据。
- **「省下的字节等比例变成带宽收益。」** 读权重的量确实少了，但缓存命中、批内复用、专家选择和算子融合共同决定实际流量，不能把权重字节的比例直接当成加速比。

## 对照源码

### 怎么开

加载时先区分三件事，不能用同一个“精度参数”概括：

| 作用 | 入口与默认 | 改变什么 |
|---|---|---|
| 浮点类型 | --dtype；Python dtype 默认 auto | 配置模型的浮点权重/激活类型，仍受各层实现及量化方法约束 |
| 量化实现 | --quantization；Python quantization 默认 None | 选择与权重描述匹配的方法；省略仍可能从模型文件识别量化 |
| 读取方式 | --load-format；默认 auto | 选择加载器与文件读取路径，详见 [Worker 加载入口](npu-worker-lifecycle.md#怎么开) |

dtype 的字符串值为 auto、half/float16、bfloat16、float/float32；斜线两侧分别是同一种 FP16 或 FP32 的别名，Python 也接受对应 torch.dtype。auto 会读取模型声明的类型，再结合平台支持列表和模型架构限制选择：已支持的非 FP32 类型保留；FP32 会降到平台偏好类型，不支持的声明类型也回退到偏好类型。普通生成使用过滤后的支持列表首项，pooling 在允许 FP16 时优先 FP16，所以不能把 auto 一律解释为 FP16。显式 dtype 仍需过模型和后端校验；它不会把 router 强制 FP32 的实现改掉，也不会把量化层的 INT8 权重改成普通浮点矩阵。

quantization 接受已注册的方法名或 Python None；None 的意思是未显式指定，**不是强制关闭模型自带量化**。固定 NPU 平台的支持列表包括 ascend、compressed-tensors、fp8、deepseek_v4_fp8；注册入口存在还要满足硬件、模型、权重包和算子的条件，不能套用 CUDA 方法列表。ascend 是 ModelSlim 的加载/执行入口，W8A8_DYNAMIC 等逐层精度名写在量化描述中，不直接填到此启动参数。

官方双机教程用 `--quantization ascend` 加载 W8A8 权重包，其余启动参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)。下面是用于理解两项关系的**参数片段**，不是整套双机启动命令，也不声称教程额外显式设置了 dtype：

```bash
--dtype bfloat16 --quantization ascend
```

它让普通浮点部分使用 BF16，由 ascend 方法管理量化层；对应离线引擎关键字是 dtype="bfloat16"、quantization="ascend"。要跑纯浮点对照，应使用匹配的真实浮点权重包与模型配置，再按该包选择 dtype。

如果看到上游教程使用 `--quantization online`、bitsandbytes 或 GGUF，先看[量化发生在哪个环节](quantization-methods.md#文件已经量化加载时量化每步量化各发生在什么时候)：预先制作量化包、加载时转换权重、每步动态量化激活分别有自己的条件。该页还对照工具的导出格式与四版接口，避免把一条 CUDA/ROCm 示例直接当成 Ascend 权重包的替换方法。

量化识别分两层。上游 ModelConfig 先读模型配置的量化标记、允许方法专用的识别覆盖，再检查方法名与平台；显式方法和最终识别值冲突可以直接抛错。随后 Ascend 的自动探测检查模型目录：有 quant_model_description.json 优先选 ascend，否则识别 config.json 中 compressed-tensors 标记，固定镜像在 A5 上还识别 fp8。**仅在这第二层**，已有非空方法与探测值不同时保留已有值并 warning；没有已有值才写回探测结果并重建量化配置。不能把“用户值优先”扩大成所有冲突都只告警。

选中 ascend 以后，`AscendModelSlimConfig` 按层类型决定实现：Linear/MoE 的 FLOAT 跳过判断、逐层或融合分片精度查询与注册表选择按上文执行；Embedding 还允许缺量化条目时返回浮点实现。注册表的键是「精度名称、层类型」这一对，`W8A8_DYNAMIC` 注册了 linear 与 moe 两个方法类，静态的 `W8A8` 只注册了 linear。

### 会报什么错

dtype 不在允许的字符串映射中会报 `Unknown dtype`；模型架构禁止该浮点类型时会在类型校验失败，后端或量化方法也可能进一步拒绝不支持的激活类型。quantization 未注册会报 `Unknown quantization method`；模型配置与所选方法不匹配会报 `does not match the quantization method specified`，平台不支持则在平台检查失败。先核完整模型配置和运行后端，再查下表的逐层错误；命令能解析不等于权重能加载。

| 报错 | 什么条件 | 先看什么 |
|---|---|---|
| `Not all shards of {prefix} are quantized with same quant type.` | 融合成一个矩阵的几个分片在描述文件里标了不同精度 | 量化包里这几个分片的条目是否一致 |
| `KeyError: '<前缀>.weight'` | Linear/MoE 等路径在融合分片检查或取精度时直接索引缺失键；普通 Linear 未命中 FLOAT 跳过条件时会继续取精度。Embedding 缺量化条目的回退不属于此条件 | 先看报错层类型，再核描述文件中的实际前缀，MTP 等后补层是否漏写 |
| `Could not determine quantization type for layer ...` | 条目查到了，但精度值是空的（例如 JSON 里写成 null） | 该层条目的值是否写全 |
| `Currently, vLLM Ascend doesn't support quant_type=%s for layer_type=%s.` | 精度名称与层类型的组合没有注册实现 | 换成已注册的组合，或让该层加载原始浮点权重 |
| `Number of global experts mismatch (excluding redundancy)` | W8A8 的 MoE 方法看到的 router 列数与逻辑专家数不一致 | router 权重、模型配置与量化描述是否匹配；本模型 router 应有 288 列 |

前四条在加载阶段抛出，第五条在 MoE 方法执行时抛出；MoE 侧的排查顺序见[expert parallel 的会报什么错](expert-parallel.md#会报什么错)。

### 开销和什么时候别开

普通动态 Linear 对未量化输入调用激活量化；静态 Linear 可以直接接收 INT8，rc2 的两种 Linear 还可复用 PreparedLinearInput。专家段能复用 dispatch 返回的动态系数，融合分支也改变调用次数，所以不能按「每层固定多一个算子」或「三个逻辑矩阵、三次量化」估算。固定加载实现还执行转置、连续化和设备布局转换，需要计入加载工作与临时空间；实际耗时、峰值内存须测量。

固定版本的动态 linear 方法另有一条针对超大权重维度的拆块分支，只在某个特定投影且开启对应特性时生效，本部署的稠密 MLP 与专家不走它。权重字节减少不自动等于 KV 预算增加，也不能按字节比例反推带宽收益：前者要重新做显存探测，后者取决于缓存命中、批内复用与算子融合。

什么时候别开：没有配套的量化权重包与描述文件时；需要与浮点实现严格数值对齐时；某个层类型没有注册实现时（会报不支持精度与层类型的组合）。已量化的层要退回浮点，须提供该层真实的浮点权重，并让描述与加载实现一致；只把 INT8 权重的描述标签改成 FLOAT，或只换 dtype，都不能恢复丢失的精度。FP32 相对 BF16 每个浮点元素占用加倍，实际整卡增量仍要考虑混合精度及工作区，不能按全模型统一翻倍估计。

换一套权重精度要连带记录：checkpoint 与量化描述文件、Ascend 与 vLLM 的版本、硬件型号、精度评估结果。本页只核实了固定版本的实现与本部署的精度划分依据，没有验证另一套 GLM 量化部署。

### 版本差异

**v0.30.0rc2 的动态/静态 W8A8 保留各自缩放方式，两种 Linear 都可接收预量化输入。** 普通 Tensor 仍分别使用逐 token 动态 scale 或离线静态激活 scale；PreparedLinearInput 允许共享专家 overlap 提前完成量化后复用，不代表取消量化开销。

新增 ModelSlim C8-MXFP 必须显式设置 kv-cache-dtype=mxfp8，兼容模型级和逐层 recipe。开启时 FAKQuant 让位，fa_v.scale 映射为 v_cache_scale，无消费者的 Q/K 静态 scale/offset 被过滤；缺少 recipe 时 V scale 使用中性默认并告警。K/V 元素为 FP8 E4M3，另有 E8M0 scale 缓存，K 动态、V 静态。该 dense attention 后端拒绝 PCP/DCP、非因果、sliding-window 等组合；PD 还须选可携带四份缓存张量的 Mooncake 路径，不能只看报错文本里的 V1 名称。这与 GLM KPool 主 SFA C8、LightningIndexer C8 是不同机制，预算要把 scale 张量算进去。

三个对照版本都有动态与静态两套 W8A8 实现：动态方法默认 INT8 激活、逐 token 求系数；静态方法使用已加载的整张量激活系数，两者的权重都逐输出通道配系数。下表只比较这些入口与所列分支，不表示全部执行细节相同。

执行侧钉点依次为 v0.23 的 2c59ff10、v0.26 分支 2026-09-17 快照的 2ed6cbba、main 的 baa023ad。前两版动态与静态文件在 methods/w8a8_dynamic.py、methods/w8a8_static.py；main 分别移到 methods/w8a8/w8a8_dynamic.py、methods/w8a8/w8a8_static.py，配置类移到 quantization/configs/modelslim_config.py。

| 对照版本 | 动态 W8A8 | 静态 W8A8 | 描述文件与自动探测 |
|---|---|---|---|
| v0.23 | linear 与 moe 各一个；含超大投影的拆块分支 | 激活系数是整张量一个 | 与固定镜像一致；固定镜像用 db701c1f，不能仅凭同属 v0.23 就互换执行源码 |
| v0.26 | 动态文件路径、默认 INT8 与所列拆块分支同上 | 仍为整张量系数；旧版静态 apply 内的 FlashComm2 量化通信分支不在此文件中 | ModelSlim/compressed-tensors 识别顺序不变，fp8 探测取消 A5 判断；不代表所有设备算子可用。该分支没有 GLM-5.3-Flash 模型代码，见 [KV cache 版本差异](kv-cache.md#版本差异) |
| main | 移到上述新路径；通用路径去掉了拆块分支 | 移到上述新路径 | 配置类移位，描述文件名与探测顺序不变；fp8 探测同 v0.26 |

INT8 是选中该方法后的默认，不代表所有模型默认启用 W8A8；三版整模型的运行兼容性未核。

上游另按 0fc695fc / 568afb3a / 84030bbe 核对：三版 dtype 默认 auto、上述浮点别名和平台偏好分支都存在；quantization 默认 None，均经过模型标记识别、方法注册与平台检查。三版也都有 quantization_config 与在线量化简写的配置入口，但这不等于本部署的 ascend 自动生成 W8A8 权重包；本页 GLM 仍按固定镜像的离线量化包加载。硬件插件的探测变化与上游参数变化必须分别核对。

### 源码位置

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| quantization/utils.py，83–214 行 | 探测顺序、第二层用户值优先与 warning、重建配置 | 「开了量化」与「选中哪种量化」是两件事 |
| quantization/modelslim_config.py，60–70、365–470、632–736 行 | 描述文件名、逐层取精度、分片一致性、查注册表、换不量化实现 | 精度是按层的属性，不是全模型开关 |
| quantization/methods/registry.py，19–62 行 | 以「精度名称、层类型」为键注册与查找 | 层类型缺实现就没有量化路径 |
| quantization/methods/w8a8_dynamic.py，48–152 行 | INT8 权重、逐通道系数与偏移、逐 token 量化、量化矩阵乘、加载后转置 | 权重侧离线、激活侧运行时 |
| 同文件 155–289、353–370 行 | 专家两块权重的 INT8 形状、系数形状、router 列数检查、加载后转置与 FP32 系数副本 | MoE 的量化参数按专家分组保存 |
| quantization/methods/w8a8_static.py，33–141 行 | 整张量激活系数与偏移、整数偏置、反量化系数 | 静态方案把激活系数变成加载期参数 |
| ops/fused_moe/moe_stage_params.py，91–119 行 | 派发是否带量化、目标类型与系数类型 | dispatch 传 int8 由量化方案决定 |
| ops/fused_moe/moe_mlp.py，88–229 行 | 专家入口动态系数判断、MC2 与融合条件、分组矩阵乘和中间再量化 | 算子次数与逻辑矩阵数不是一一对应 |
| models/glm5_next.py，1235–1300、1403–1540、1541–1680、1881–1963、2263–2268、2455–2459 行 | 索引器、稠密 MLP 与 MoE、KDA、稀疏 MLA、嵌入表、词表投影建层时接不接量化配置 | 哪些部件的精度与描述文件无关 |
| 上游 vllm 的 model_executor/layers/fused_moe/router/gate_linear.py，47–65 行 | router 打分矩阵写死不接量化配置；非 CUDA 平台上要求 FP32 计算时参数按 FP32 建 | router 在昇腾上按 FP32 存、按 FP32 算 |

**来源与结论对应：**

- `--quantization ascend`、W8A8 权重包与双机启动参数出自官方双机教程；量化包的 revision 与核查范围见[来源基线](../sources/glm-5-3-flash-baseline.md)。[S1]
- 上游模型配置说明结构；实际逐层精度以量化目录的固定描述文件为准，不能仅由上游不量化清单推断。[S2]
- 自动探测顺序、用户显式取值优先与 warning，对照[来源 3](https://github.com/vllm-project/vllm-ascend/blob/db701c1f/vllm_ascend/quantization/utils.py#L83-L214)。
- 描述文件名、逐层取精度、`FLOAT` 判定、融合层分片一致性检查、换成不量化实现，以及前三条报错，对照第 4–6 项来源。[C4][C5][C6]
- 注册表以「精度名称、层类型」为键查找方法类，对照第 7 项来源。[C7]
- INT8 权重与逐输出通道的系数、偏移；逐 token 动态量化、量化矩阵乘、输出类型跟随输入；加载后的转置、设备布局与拆块分支，对照第 8 项来源。[C8]
- 专家两块权重的 INT8 形状与系数形状、router 列数检查、加载后的转置与 FP32 系数副本，对照第 9、10 项来源。[C9][C10]
- 静态方案的整张量激活系数、偏移、整数偏置与反量化系数，以及它只注册 linear，对照第 11 项来源。[C11]
- dispatch 对 8 位方案返回真、目标类型 int8、系数类型 FP32；专家段跳过重复量化与中间再量化，对照第 12、13 项来源。[C12][C13]
- 索引器的 K 与打分投影、KDA 九个投影建层时不接量化配置；稠密 MLP、路由专家、共享专家、稀疏 MLA 的四个投影与索引器 Q 投影接量化配置，对照第 14–17 项来源。[C14][C15][C16][C17]
- router 的打分矩阵在模型代码里建层时不传量化配置，上游的 GateLinear 类也写死不接，并在非 CUDA 平台按 FP32 建参数，对照第 15、22 项来源。[C15][C22]
- 嵌入表建层时没传量化配置；词表投影接了量化配置，两个量化快照均标 FLOAT。建层入口对照 23、24，实际配方对照 47、48。[C23][C24]
- 每卡每层路由专家 432 MiB、42 层 17.72 GiB、3121f187 的所列语言权重子账 20.58 GiB，引自[双机部署](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)，不是完整整卡占用；系数与偏移 576 KiB、FP32 副本 288 KiB 及约 0.2% 比例按上述参数形状推导。[D]
- 权重省下的字节不等于 KV 预算增加、也不等比例变成带宽收益，是按显存与访存的组成推出的结论，没有本部署的实测支撑。[D]
- 两份量化描述的 model_quant_type 均为 W8A8_DYNAMIC；MLA 四组投影在 9e55cbc8 为 FLOAT、在 3121f187 为 W8A8_DYNAMIC，KV 展开、索引器 Q 投影和词表头仍为 FLOAT。对应固定文件 47、48；每层条目而非全局名字决定具体精度。[S47][S48]
- 三个版本的方法存在性、默认值、文件位置与拆块分支差异，对照第 18–21 项来源。[C18][C19][C20][C21]
- 常用入口证据：25 是 dtype/quantization 字段，26 是上游量化识别与冲突校验，27–29 是三版实际 dtype 映射和 auto 分支，30–31 对照新版字段，32 是固定 NPU 平台支持列表；33–35 对照 Ascend 探测，36 限定 main 的量化识别行为。浮点回退须匹配真实权重，依据前述不量化层与量化层不同的参数表示及加载路径。
- MC2 选路的 A2 三项条件见来源 49；真实 dispatch 参数、输出及 combine 模式见来源 50–51，与来源 12–13 的量化属性和专家消费者配合阅读。三版静态方法的整张量系数、INT8 输入复用及旧版 FlashComm2 分支范围见来源 52–54。
- rc2 的预量化 Linear 输入见来源 37–38；C8-MXFP 开关、recipe 映射与标准全注意力层限制见来源 39–42，后端限制及 Mooncake 名称判定见来源 43–46。其完整缓存执行链见[KV cache 量化](kv-cache-quantization.md)。
- CANN 9.1.X 的 DynamicQuant 文档给出逐 token 对称量化及按行绝对值最大值求 scale 的公式，见来源 55；本页固定 Python 调用的输入、输出与系数使用见来源 8。公式示例与半格误差界是上述理想量化规则的算术推导，不替代特定设备的数值测试。[S55][D]

**待核：** 现场部署目录究竟对应哪个量化快照，需用实际文件的哈希与上述固定文件比对；教程的模型名称不能代替这一证据。缺固定双机的设备 trace：量化算子耗时、辅助参数与工作区实占字节、INT8 与 BF16 精度差均未实测；静态与动态在本模型上的速度与误差对比也没有数据。combine 不一起量化的原因，固定源码没有写。这些缺口限制容量和性能结论，不能用描述文件存在替代运行验收。
