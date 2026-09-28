---
id: quantization
title: "W8A8 量化：权重压成 INT8，算完再乘回缩放系数"
type: feature
summary: 量化把权重和激活换成 8 位整数，另存一组缩放系数把结果换回原来的数值范围。先看一个数怎样压下去再还原，再分清动态与静态量化，最后落到 GLM 双机：两个 8 位分别从哪来、哪些矩阵保持 BF16、缩放系数占多少字节。
aliases: [量化, Quantization, W8A8, W8A8_DYNAMIC, INT8, ModelSlim, quant_model_description.json, 动态量化, 静态量化, 缩放系数]
chapters: ["11"]
sources:
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/quantization/utils.py#L83-L205
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L60-L70
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L365-L470
  - vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/registry.py#L19-L62
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L155-L289
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L370
  - vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_static.py#L33-L141
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_stage_params.py#L91-L119
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1300
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1540
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1541-L1680
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1881-L1960
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152
  - vllm-ascend@2ed6cbba:vllm_ascend/quantization/methods/w8a8_dynamic.py#L47-L151
  - vllm-ascend@baa023ad:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L59-L127
  - vllm-ascend@baa023ad:vllm_ascend/quantization/configs/modelslim_config.py#L80-L90
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L47-L65
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2268
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2455-L2459
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: matmul-and-weights, kind: builds-on, note: 矩阵乘讲清 Y=XW 与权重的存法，本页讲操作数换成 8 位后多了哪两步}
  - {to: glm-5-3-flash, kind: builds-on, note: 逐部件的文件精度与加载后精度在模型页，本页讲这些精度是怎么被选中的}
  - {to: expert-parallel, kind: builds-on, note: 专家权重和 dispatch 的 int8 载荷都出现在 MoE 这一站}
  - {to: cann-hccl, kind: builds-on, note: 量化改变的是交给通信的张量类型，字节账在通信页}
  - {to: kv-cache-quantization, kind: alternative-to, note: 同样是降精度，但对象是历史状态、写在缓存里，收益和误差都另算}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 量化是什么，为什么能少存一半字节？

**量化（quantization）把一个张量换成位数更少的格式，同时保存一组缩放系数（scale），用来把少位数的数换回原来的数值范围。** 张量是模型里成批的数：权重是训练好、长期驻留的参数；激活（activation）是当前这批输入走到某一层时算出的中间结果。

BF16 是 16 位浮点格式，每个数占 2 字节；INT8 是 8 位整数，每个数占 1 字节，一共只能表示 −128 到 127 这 256 个值。**W8A8 的意思是这一层的权重（W）和参与乘法的激活（A）都用 8 位整数。** 它不等于模型里所有张量都变成 8 位：整数乘加的累加结果、缩放系数、层与层之间传递的隐藏向量都可以是别的格式。

```wiki-diagram
file: quantization-intuition
```

图里的四步就是 W8A8 的全过程：

1. **权重按输出通道压。** 输出通道指权重矩阵在输出维度上的一列，这一列负责算出输出向量里的一个位置。每列自己求一个缩放系数，整列的数除以它，再舍入、截断到 INT8 的范围。这一步在部署前离线做完，存进权重文件。
2. **激活按 token 压。** 每次前向都要做一次：激活矩阵里一行是一个 token 的向量，每行自己求一个缩放系数。
3. **整数乘加。** 两份 8 位整数相乘相加，中间结果用更宽的整数累加，避免累加溢出。
4. **乘回两个缩放系数。** 一个输出元素来自「这一行激活 × 这一列权重」，所以还原时乘的就是这一行的系数乘这一列的系数，输出重新变回 BF16。

缩放系数不参与整数乘加，只在第 4 步用上。数值范围完全靠它恢复，所以系数本身必须用较高精度保存，也必须跟着权重一起搬。

## 省下什么，付出什么

按 INT8 存权重，同一批矩阵的字节数正好是 BF16 的一半。本部署里最大的一块是 [MoE](moe.md)（每个 token 只交给少数几个专家计算的前馈层）里的**路由专家**（可供 router 这个打分网络挑选的全部专家，每层 288 个，不是某个 token 选中的那几个）：按 INT8 记，每张卡每层 432 MiB，42 层合计 17.72 GiB，而每张卡的全部权重是 20.58 GiB——专家占了绝大部分。每卡明细见[双机部署 · 每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。同一批专家矩阵若按 BF16 存，就要多占同样多的字节，留给 KV cache 的余量相应减少。

代价有三笔：

- **误差。** 舍入误差和超出范围后的截断误差都会进入这一层的输出，并随层数累积。本部署没有精度对比实测，换权重精度必须重跑评估。
- **多出来的参数和步骤。** 缩放系数、偏移要一起存、一起读；激活的系数每次前向现算，多一个算子；权重加载后还要转置并换成设备偏好的分块布局。
- **只有能量化的层才省。** 精度按层生效，后面单独有一节讲哪些层是 8 位。

| 存同一个权重矩阵 | 每个元素 | 另外要存 |
|---|---:|---|
| BF16 | 2 字节 | 无 |
| INT8 | 1 字节 | 每个输出通道一个缩放系数和一个偏移；加载后可能再多一份别的精度的系数副本 |

省下的字节也不会原样变成 KV cache 的额度：设备上还要为权重重排、激活量化和算子执行留工作区，[显存探测](kv-cache-memory-profiling.md)要重新量一遍，才知道剩下多少能装历史状态。

## 一个数怎样压下去、再还原回来

先看最简单的对称量化：零点固定为 0，只用一个正的缩放系数 s。量化与还原是 `q = clamp(round(x / s), −128, 127)` 和 `x̂ = s × q`。

取 s = 0.1：x = 0.26 得到 q = 3，还原成 0.3，差的 0.04 是舍入误差；x = 13 算出 130，超过 127 的上限，只能存成 127，还原成 12.7，这 0.3 是截断误差。带零点的非对称方案多一个整数偏移，可以把不对称的分布用满整个范围，代价是还原时多一次减法。

把两步合起来看一个输出元素：忽略零点时 `ŷ = sₓ × s𝑤 × Σ qₓᵢ q𝑤ᵢ`，整数部分先全部加完，两个系数最后一起乘上去。

```wiki-diagram
file: quantization
```

**系数的粒度是一笔取舍。** 整个张量共用一个系数最省元数据，但一个离群值就会把系数拉大，其余的数被挤到很少的几个整数上；按输出通道、按行或按更小的分组各给一个系数，误差小而元数据多，还要看算子支持哪种粒度。本部署的粒度是权重每个输出通道一个、激活每个 token 一个。

## 动态量化和静态量化，差在什么时候算系数

两者的权重侧一样，区别只在激活：

| | 动态量化 | 静态量化 |
|---|---|---|
| 激活的系数什么时候定 | 每次前向按当前输入现算 | 部署前用校准数据定好，和权重一起存进文件 |
| 激活系数的粒度 | 每个 token 一个 | 整个张量一个（固定版本的实现） |
| 好处 | 跟着本次输入的范围走，不需要校准数据 | 前向少一步求系数，偏移和整数偏置也能预先算好 |
| 代价 | 每层多一个量化算子 | 真实输入偏离校准数据时误差变大 |

固定版本的两套实现正好对上这张表。动态方法只建 INT8 权重和逐输出通道的系数、偏移，激活的系数在前向里现算；静态方法在建参数时就为激活留了整张量共享的系数和偏移，还有整数偏置和反量化系数，前向直接取用，不再求系数。

本部署走动态这一路：教程按 `--quantization ascend` 加载 W8A8 权重包，每层用哪套方法由权重目录里的量化描述文件决定。这份文件本机没有，按上游配方推断是动态 W8A8。名字里的「动态」只描述激活，权重仍然是离线转好、加载即用的。

## 放到 GLM 双机：两个 8 位分别从哪来

用[官方双机前提](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2 各 8 张卡，TP8（机内 8 卡合切一个矩阵）、DP2（两台各有一个独立调度请求的执行组）、EP16（专家分布在全部 16 卡），权重取 W8A8 量化包。请求走到[第 4 站逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)以后，每个走量化实现的线性层都按上面四步过一遍。

**权重侧是离线结果，加载时只做搬运和整形。** 加载按「输出维 × 输入维」建 INT8 权重，并为每个输出通道建一个缩放系数和一个偏移；加载结束后把权重转置成算子要的方向，再换成设备偏好的分块布局。转置方向与数学形状的对应关系在[矩阵乘与权重](matmul-and-weights.md#开销和什么时候别开)讲过，这里不重复。

**激活侧每次现算。** 线性层拿到 BF16 输入，先按 token 量化成 INT8 并得到每行一个系数，再调量化矩阵乘，把权重的系数和这一行的系数一起交给算子；输出类型跟随输入，也就是 BF16。层与层之间传的一直是 BF16，只有进乘法的那一刻是 INT8。

**专家是同一套方法的 MoE 版本。** 每张卡本地的 18 个专家（288 个路由专家按 EP16 分，分法见[expert parallel](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)）合成两块大权重：一块是 gate 与 up 合并的矩阵，一块是 down。系数按专家、按输出通道保存。专家段的输入在 **dispatch**（把 token 的向量发给持有它选中专家的卡）阶段已经量化过，所以这里直接用带回来的系数，不再量化一次；两次分组矩阵乘之间的 SwiGLU（先算门控再逐元素相乘的激活）由融合算子完成，中间结果再量化一次才交给第二块权重。

```calc
title: 缩放系数比权重主体小多少（每卡每层的路由专家）
权重主体（引自部署页） = 432.0 MiB
系数与偏移 = 4 组 × 18 个专家 × 4096 × 2 B = 589,824 B = 576.0 KiB
加载后另存一份 FP32 系数 = 18 × 4096 × 4 B = 294,912 B = 288.0 KiB
辅助合计占权重主体 = 864.0 KiB ÷ 442,368.0 KiB ≈ 0.2%
> 4 组 = 两块权重各一个系数、一个偏移；两块的通道数都是 4096
```

所以「INT8 权重加上系数」仍然接近 BF16 权重的一半：辅助参数是千分之二这个量级，真正占字节的是权重主体。但辅助参数不止系数——加载后的布局转换、运行时的量化输出和临时空间都另占显存，这些在部署页的每卡账里单独记。

## 哪些矩阵是 8 位，哪些保持 BF16

**精度按层生效。** 加载每一层时查权重目录里的量化描述文件：这一层的权重标成 FLOAT 就换成不量化的实现；否则按「精度名称、层类型」这一对键到注册表里找方法类，找不到就报错。所以接了量化配置的每一层都要在描述文件里有条目：没有条目时既不算 FLOAT，也不会按浮点兜底，而是在取精度时直接报错。同一次部署里，线性层、MoE 层和嵌入层因此可以各走不同实现，融合在一起的几个矩阵还必须标同一种精度。

```wiki-diagram
file: quantization-flow
```

逐部件的分层表在[矩阵乘与权重](matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影)，本页不重复。要补的是这份划分的依据分两级，强弱不一样。先认表里的几个部件：KDA 与稀疏 MLA 是 GLM 的两种 attention 层，分别占 34 层和 11 层（KDA 的机制见[线性注意力](linear-attention.md)）；索引器是稀疏 MLA 里给历史位置打分、挑出要读哪些位置的小网络；router 是 MoE 层里给专家打分的路由网络。

| 依据 | 覆盖的部件 | 结论强度 |
|---|---|---|
| 模型代码建层时就不接量化配置 | KDA 层的九个投影（Q、K、V、两组门控投影、b 投影、输出投影）；索引器的 K 投影与打分投影；嵌入表；router 的打分矩阵（按 FP32） | 与描述文件无关，一定不走量化实现 |
| 建层时接了量化配置，实际精度由描述文件决定 | 前 3 层稠密 MLP 的三个矩阵；路由专家与共享专家；稀疏 MLA 的四个投影（Q 与 KV 合并的压缩投影、Q 展开投影、输出投影这三个大投影，加上 KV 展开投影）；索引器的 Q 投影；词表投影 | 描述文件缺失，按上游配方的不量化清单推断 |

第一行是本页核实的结果：这些部件建层时传的量化配置是空的，或者干脆没传这个参数，描述文件写什么都不会让它们变成 INT8。router 的打分矩阵同样连量化配置都没接，而且权重按 FP32 建，打分也强制在 FP32 里算。第二行才是推断，也是分层表标「推断」的原因：比如稀疏 MLA 的 KV 展开投影、索引器的 Q 投影和词表投影都接了量化配置，它们按 BF16 算，依据只是上游清单把它们列为不量化。描述文件到手后如果与上游清单不同，变的是字节数，形状和切法不变。

请求历史的降精度是另一件事：对象是 KV cache，写在缓存里、按块读出，收益和误差都另算，见[缓存量化](kv-cache-quantization.md)。

## 为什么 EP dispatch 搬的是 int8

MoE 的 dispatch 要把 token 的隐藏向量发到持有它选中专家的卡上。本部署的 MoE 走 [MC2](collective-communication.md#mc2) 路径——MC2 是昇腾把分块计算与通信排成相互重叠的流水的一类实现，不是新的集合通信语义。派发前的判定对 W8A8 这类 8 位方案返回真，于是发出去的目标类型是 int8，每个 token 另带一个 FP32 系数；专家算完由 combine 送回的结果是 BF16。量化在这里省的不只是显存，还有跨卡搬运的字节数，专家段也省掉一次重复量化。

一个 token–专家副本的字节数、整次前向的通信账在[通信库 · 数据精度和本地计算](cann-hccl.md#数据精度和本地计算怎样影响通信)算过，本页只引用不重算；派发与回收的路线见[expert parallel](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。combine 为什么不一起量化，固定版本的源码没有写理由，本页不下结论。

## 常见误解

- **「W8A8 就是整个模型都用 8 位。」** 它按层生效：不少部件保持 BF16 或 FP32，逐部件精度见[矩阵乘与权重的分层表](matmul-and-weights.md#到-glm-双机一个-token-怎样走过前馈投影)，哪些是源码写死、哪些是推断见[上文的依据表](#哪些矩阵是-8-位哪些保持-bf16)，文件里怎么存、加载后变成什么见[模型页的权重精度](glm-5-3-flash.md#权重精度文件里怎么存加载后变成什么)。
- **「量化以后这一层就没有浮点计算了。」** 只有矩阵乘的操作数变成整数。归一化、SwiGLU 的门控、router 打分、combine 的加权相加都还在浮点里，输出也是 BF16。
- **「量化后所有通信都减半。」** 只有 MoE dispatch 这一段改传 int8 加系数；TP 的归约仍然是 BF16 部分和，combine 也是 BF16。通信量按实际交给通信操作的张量类型算。
- **「权重省下 1 GiB，KV cache 就多 1 GiB。」** 还有布局填充、运行时副本和算子工作区；显存预算要重新探测。
- **「静态量化一定更快，动态量化一定更准。」** 静态省掉求系数的一步，动态跟着当前输入的范围走；谁更快、谁误差更小取决于算子实现和真实输入分布，本部署没有两者的对比数据。
- **「省下的字节等比例变成带宽收益。」** 读权重的量确实少了，但缓存命中、批内复用、专家选择和算子融合共同决定实际流量，不能把权重字节的比例直接当成加速比。

## 对照源码

### 怎么开

官方双机教程用 `--quantization ascend` 加载 W8A8 权重包，其余启动参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)。不写这个参数时也能自动探测：模型目录里有 `quant_model_description.json` 就选 ascend，`config.json` 里写着 compressed-tensors 就选它，特定硬件上还能识别 fp8 标记。用户显式指定的方式与探测结果不一致时，保留用户值并打一条 warning；能否加载仍取决于后续的建层检查。

选中 ascend 以后，`AscendModelSlimConfig` 逐层决定实现：读描述文件里 `<层前缀>.weight` 的取值，`FLOAT` 换成不量化的 linear、MoE 或嵌入实现，其余交给注册表。注册表的键是「精度名称、层类型」这一对，`W8A8_DYNAMIC` 注册了 linear 与 moe 两个方法类，静态的 `W8A8` 只注册了 linear。

### 会报什么错

| 报错 | 什么条件 | 先看什么 |
|---|---|---|
| `Not all shards of {prefix} are quantized with same quant type.` | 融合成一个矩阵的几个分片在描述文件里标了不同精度 | 量化包里这几个分片的条目是否一致 |
| `KeyError: '<前缀>.weight'` | 描述文件里没有这一层的条目：跳过判断只认明确标成 FLOAT 的条目，缺条目不算跳过，接着按键直接取精度就抛错；缺条目不会退回浮点 | 描述文件是否覆盖该层前缀，MTP 等后补层是否漏写 |
| `Could not determine quantization type for layer ...` | 条目查到了，但精度值是空的（例如 JSON 里写成 null） | 该层条目的值是否写全 |
| `Currently, vLLM Ascend doesn't support quant_type=%s for layer_type=%s.` | 精度名称与层类型的组合没有注册实现 | 换成已注册的组合，或让该层加载原始浮点权重 |
| `Number of global experts mismatch (excluding redundancy)` | W8A8 的 MoE 方法看到的 router 列数与逻辑专家数不一致 | router 权重、模型配置与量化描述是否匹配；本模型 router 应有 288 列 |

前四条在加载阶段抛出，第五条在 MoE 方法执行时抛出；MoE 侧的排查顺序见[expert parallel 的会报什么错](expert-parallel.md#会报什么错)。

### 开销和什么时候别开

每层多一个激活量化算子；权重加载后要转置并转成设备分块布局，加载时间和临时内存都会增加。专家段在 dispatch 已量化时跳过一次量化，中间结果由融合算子重新量化，所以不能按「三个逻辑矩阵、三次量化」估算算子次数。

固定版本的动态 linear 方法另有一条针对超大权重维度的拆块分支，只在某个特定投影且开启对应特性时生效，本部署的稠密 MLP 与专家不走它。权重字节减少不自动等于 KV 预算增加，也不能按字节比例反推带宽收益：前者要重新做显存探测，后者取决于缓存命中、批内复用与算子融合。

什么时候别开：没有配套的量化权重包与描述文件时；需要与浮点实现严格数值对齐时；某个层类型没有注册实现时（会直接报上表第三条）。已量化的层想退回浮点，改的是描述文件里对应条目，不是启动参数。

换一套权重精度要连带记录：checkpoint 与量化描述文件、Ascend 与 vLLM 的版本、硬件型号、精度评估结果。本页只核实了固定版本的实现与本部署的精度划分依据，没有验证另一套 GLM 量化部署。

### 版本差异

三个对照版本都有动态与静态两套 W8A8 实现，激活默认 INT8、逐 token 量化、权重逐输出通道配系数的做法一致；差别在文件位置和一条分支。

| 对照版本 | 动态 W8A8 | 静态 W8A8 | 描述文件与自动探测 |
|---|---|---|---|
| v0.23：Ascend 2c59ff10 | `methods/w8a8_dynamic.py`，linear 与 moe 各一个；含超大投影的拆块分支 | `methods/w8a8_static.py`，激活系数是整张量一个 | 与固定镜像一致；固定镜像用 db701c1f，不能仅凭同属 v0.23 就互换执行源码 |
| v0.26：Ascend 2ed6cbba | 路径、默认值与执行顺序同上 | 同上 | 同上。该分支没有 GLM-5.3-Flash 的模型代码，本文的 GLM 部署不适用于这一版，逐版对照见 [KV cache 的版本差异](kv-cache.md#版本差异) |
| main：Ascend baa023ad | 移到 `methods/w8a8/w8a8_dynamic.py`；通用路径去掉了拆块分支 | 移到 `methods/w8a8/w8a8_static.py` | 配置类移到 `quantization/configs/modelslim_config.py`，描述文件名与自动探测函数不变 |

INT8 是选中该方法后的默认，不代表所有模型默认启用 W8A8；三版整模型的运行兼容性未核。

### 源码位置

| 入口 | 对照什么 | 意味着什么 |
|---|---|---|
| quantization/utils.py，83–205 行 | 探测顺序、用户值优先与 warning | 「开了量化」与「选中哪种量化」是两件事 |
| quantization/modelslim_config.py，60–70、365–470、632–736 行 | 描述文件名、逐层取精度、分片一致性、查注册表、换不量化实现 | 精度是按层的属性，不是全模型开关 |
| quantization/methods/registry.py，19–62 行 | 以「精度名称、层类型」为键注册与查找 | 层类型缺实现就没有量化路径 |
| quantization/methods/w8a8_dynamic.py，48–152 行 | INT8 权重、逐通道系数与偏移、逐 token 量化、量化矩阵乘、加载后转置 | 权重侧离线、激活侧运行时 |
| 同文件 155–289、353–370 行 | 专家两块权重的 INT8 形状、系数形状、router 列数检查、加载后转置与 FP32 系数副本 | MoE 的量化参数按专家分组保存 |
| quantization/methods/w8a8_static.py，33–141 行 | 整张量激活系数与偏移、整数偏置、反量化系数 | 静态方案把激活系数变成加载期参数 |
| ops/fused_moe/moe_stage_params.py，91–119 行 | 派发是否带量化、目标类型与系数类型 | dispatch 传 int8 由量化方案决定 |
| ops/fused_moe/moe_mlp.py，133–215 行 | 专家段跳过重复量化、分组矩阵乘与中间再量化 | 算子次数与逻辑矩阵数不是一一对应 |
| models/glm5_next.py，1235–1300、1403–1540、1541–1680、1881–1960、2263–2268、2455–2459 行 | 索引器、稠密 MLP 与 MoE、KDA、稀疏 MLA、嵌入表、词表投影建层时接不接量化配置 | 哪些部件的精度与描述文件无关 |
| 上游 vllm 的 model_executor/layers/fused_moe/router/gate_linear.py，47–65 行 | router 打分矩阵写死不接量化配置；非 CUDA 平台上要求 FP32 计算时参数按 FP32 建 | router 在昇腾上按 FP32 存、按 FP32 算 |

**来源与结论对应：**

- `--quantization ascend`、W8A8 权重包与双机启动参数出自官方双机教程；量化包的 revision 与核查范围见[来源基线](../sources/glm-5-3-flash-baseline.md)。[S1]
- 上游模型配置的不量化清单，是本页第二级依据与分层表「推断」标注的来源。[S2]
- 自动探测顺序、用户显式取值优先与 warning，对照第 3 项来源。[C3]
- 描述文件名、逐层取精度、`FLOAT` 判定、融合层分片一致性检查、换成不量化实现，以及前三条报错，对照第 4–6 项来源。[C4][C5][C6]
- 注册表以「精度名称、层类型」为键查找方法类，对照第 7 项来源。[C7]
- INT8 权重与逐输出通道的系数、偏移；逐 token 动态量化、量化矩阵乘、输出类型跟随输入；加载后的转置、设备布局与拆块分支，对照第 8 项来源。[C8]
- 专家两块权重的 INT8 形状与系数形状、router 列数检查、加载后的转置与 FP32 系数副本，对照第 9、10 项来源。[C9][C10]
- 静态方案的整张量激活系数、偏移、整数偏置与反量化系数，以及它只注册 linear，对照第 11 项来源。[C11]
- dispatch 对 8 位方案返回真、目标类型 int8、系数类型 FP32；专家段跳过重复量化与中间再量化，对照第 12、13 项来源。[C12][C13]
- 索引器的 K 与打分投影、KDA 九个投影建层时不接量化配置；稠密 MLP、路由专家、共享专家、稀疏 MLA 的四个投影与索引器 Q 投影接量化配置，对照第 14–17 项来源。[C14][C15][C16][C17]
- router 的打分矩阵在模型代码里建层时不传量化配置，上游的 GateLinear 类也写死不接，并在非 CUDA 平台按 FP32 建参数，对照第 15、22 项来源。[C15][C22]
- 嵌入表建层时没传量化配置；词表投影接了量化配置，其 BF16 精度按上游清单推断，对照第 23、24 项来源。[C23][C24]
- 每卡每层路由专家 432 MiB、42 层 17.72 GiB、整卡 20.58 GiB 引自[双机部署](glm-5-3-flash-two-node.md#每张卡上放了什么)的统一账单；系数与偏移的 576 KiB、FP32 副本 288 KiB、辅助占权重主体约 0.2%，为本页按来源里的参数形状推导。[D]
- 权重省下的字节不等于 KV 预算增加、也不等比例变成带宽收益，是按显存与访存的组成推出的结论，没有本部署的实测支撑。[D]
- 「本部署走动态 W8A8」是推断：教程只给出 `--quantization ascend`，方法名写在缺失的描述文件里。[I]
- 接了量化配置的那些部件实际是否 INT8，同样是按上游清单推断。[I]
- 三个版本的方法存在性、默认值、文件位置与拆块分支差异，对照第 18–21 项来源。[C18][C19][C20][C21]

**待核：** 部署权重包 `Eco-Tech/GLM-5.3-Flash-w8a8` 里逐层标精度的 `quant_model_description.json` 本机没有，所以「本部署用动态方法」和「接量化配置的层实际是 INT8」都还是推断；文件到手后，本页第二级依据与分层表要一起修订。缺固定双机的设备 trace：量化算子的耗时、辅助参数与工作区的实占字节、INT8 与 BF16 的精度差都没有实测，静态与动态在本模型上的速度与误差对比也没有数据。combine 不一起量化的原因，固定版本源码没有写。这些缺口不改变量化本身的计算顺序，但限制了容量与性能结论的适用范围。
