---
id: tensor-layout
title: ND 与 NZ：张量的数值没变，内存里怎样重新排列
type: concept
origin: direct
summary: >-
  ND 是 N-Dimension，NZ 按块间大 N、块内小 z 的遍历形状命名；用同一张矩阵演示分块重排、补齐和地址变化，再区分
  shape、stride、dtype、量化打包与设备格式，核对昇腾权重和 KV cache 的布局边界。
aliases:
  - ND
  - NZ
  - ND NZ
  - ND和NZ
  - NZ和ND
  - N-Dimension
  - FRACTAL_NZ
  - ACL_FORMAT_ND
  - ACL_FORMAT_FRACTAL_NZ
  - ND转NZ
  - NZ格式
  - 张量布局
  - 数据排布
  - 存储格式
  - stride
  - contiguous
  - npu_format_cast
  - weight_nz_mode
  - VLLM_ASCEND_ENABLE_NZ
  - enable_kv_nz
  - 权重NZ模式
  - 权重布局开关
  - additional_config.weight_nz_mode
  - TransdataOperation
  - 分形排布
  - 内存补齐
chapters:
  - '07'
  - '11'
order: 40
sources:
  - >-
    https://www.hiascend.com/document/detail/en/CANNCommunityEdition/910/API/ascendcopapi/docs/en/api/SIMD-API/basic_api/cube_compute_ISASI/cube_compute_fractal_intro/key_fractal_format_detailed_explanation.md
  - >-
    https://www.hiascend.com/doc_center/source/zh/canncommercial/850/devaids/atctool/atlasatc_16_0005.html
  - >-
    https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910/acce/ascendtb/ascendtb_01_0083.html
  - 'https://docs.pytorch.org/docs/2.14/tensor_view.html'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L261-L298'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L48-L152
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L365
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L261-L298'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L253-L290'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L329-L383'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L247-L254'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L333-L346'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L87-L94'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L247-L254'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L262-L269'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L83-L90'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L501-L504'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L537-L540'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L261-L283'
  - 'vllm-ascend@baa023ad:vllm_ascend/envs.py#L1-L100'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L618-L623'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L659-L662'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L376-L389'
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L352-L433'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L178-L239
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_c8_mxfp.py#L155-L191'
  - 'https://modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json'
  - 'https://modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L579-L640'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L31-L50'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L352-L412'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L379-L386'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L615-L657'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L310-L320'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L370-L442'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L395-L402'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L718-L763'
  - 'vllm-ascend@8d6180e2:vllm_ascend/device/hardware_profile.py#L417-L446'
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 先认识矩阵的行列和转置，再看这些元素在物理内存中的顺序
  - to: ai-core
    kind: builds-on
    note: Cube 与片上缓冲说明为什么矩阵算子需要适配数据排布
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
contradicts: []
updated: '2026-11-19'
---

## ND、NZ 是什么，名字从哪里来？

**ND、NZ 规定张量中的数在内存里怎样排列。** 张量是一组带维度的数；同一张矩阵可以逐行存，也可以切成小块后逐块存。只做正确的格式转换时，逻辑位置上的有效数值保持不变。

**ND 是 N-Dimension**，指通用的 N 维张量格式；二维连续矩阵通常按行优先存储，即先存完第一行，再存第二行。这里的 N 表示维数，不是特指 batch 大小。

**NZ 是 FRACTAL_NZ 的常用简称，官方也写作 Nz。** Fractal 在这里指分块的分形排布：块与块之间按列优先遍历，形状像大写 N；每块内部按行优先遍历，形状像小写 z。N、z 是两层遍历形状的命名依据，官方定义没有把它展开为两个英文单词的首字母。

```wiki-diagram
file: tensor-layout-intuition
```

图中用同一张矩阵说明：数字还是原来的数字，改变的是先存谁、后存谁。小块采用 2×2 只是教学示意；真实接口的对齐尺寸另在后文说明。它与[量化](quantization.md)的区别是：量化会用有限的编码近似原数；布局转换负责安排这些编码的位置。

## 为什么矩阵算子关心数据怎样排？

**矩阵计算要成块读取数据，合适的排布能让算子按约定取到连续的小块。** Cube 是昇腾里执行矩阵乘加的计算单元；数据先从设备内存搬入片上缓冲，再参与计算，路径见 [AI Core](ai-core.md)。若输入排布不满足算子接口，框架或算子内部就需要转换，有些接口则直接拒绝这种输入。

这项工作会在[模型加载后处理](npu-worker-lifecycle.md)和[请求第 4 站逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)相遇：权重长期复用，适合在加载后先整理；激活和缓存由运行时生成，按各自算子的接口组织。把权重提前转好，可以将转换移出重复执行的前向路径，但要付一次搬运、分配；尺寸未对齐时还要增加补齐空间。

内存中的权重格式、算子接口接收的格式、Cube 各级缓冲中的格式是不同层次。某个接口接受 ND，可以在内部完成搬运与转换；某个融合接口要求 NZ，也只说明该接口的约束。具体硬件代际的矩阵操作数格式不同，不能由“NPU 有 Cube”推出所有输入都必须在设备内存里存成 NZ。

## 同一张矩阵怎样从 ND 变成 NZ？

沿用首图的 4×4 矩阵。原来的四行依次是 (1,2,3,4)、(5,6,7,8)、(9,10,11,12)、(13,14,15,16)。ND 的线性顺序就是 1 到 16。

按示意的 2×2 小块切开，左上块是 (1,2;5,6)，左下块是 (9,10;13,14)，右上块是 (3,4;7,8)，右下块是 (11,12;15,16)。外层先沿第一列的块向下，再转到第二列；块内部仍逐行读。于是 NZ 顺序为：

**(1,2,5,6) → (9,10,13,14) → (3,4,7,8) → (11,12,15,16)。**

取原矩阵第 2 行第 1 列的 5，行列均从 1 开始。它在 ND 中是第 5 个元素，在 NZ 中是第 3 个元素；其逻辑坐标仍是第 2 行第 1 列。转置则会交换它的行列坐标，这说明转置与 NZ 转换并非同一操作。

用零起始坐标写出一般映射更容易核对。原矩阵有 M 行、N 列，小块大小为 m₀×n₀；补齐后有 M₁ 个块行、N₁ 个块列。逻辑坐标 (i,j) 对应物理维度顺序 **(⌊j/n₀⌋, ⌊i/m₀⌋, i mod m₀, j mod n₀)**，也就是 (N₁,M₁,m₀,n₀) 的索引。它明确区分了块间顺序和块内顺序。

下面按这组 4×4 数值实际搬一次：上方保留逻辑矩阵与 ND 地址，下方另开 NZ 空间。每个 2×2 小块先展开，再依次写入；地址按元素从 0 编号，可以跟踪数值 5 的逻辑坐标和新旧地址。

```wiki-scene
inference-mechanism:4
```

## 行列不能整除块大小，要补多少空间？

**补齐让尾部也能容纳完整小块；新增位置不属于原矩阵的有效元素。** CANN 9.1 的 ATB TransdataOperation 约定：FP16/BF16 的 m₀、n₀ 都是 16；INT8 的 m₀ 是 16、n₀ 是 32。ATB 是 Ascend Transformer Boost 加速库，这里引用的是这个具体转换接口的尺寸规则。

假设一张 $17 \times 17$ 的 FP16 矩阵（示意尺寸），每元素占 2 字节，按上述接口 $m_0 = n_0 = 16$ 补齐为完整小块：

$$M_{\text{pad}} = \lceil 17 \div 16 \rceil \times 16 = 32, \qquad N_{\text{pad}} = \lceil 17 \div 16 \rceil \times 16 = 32, \qquad \Delta = 2{,}048 - 578 = 1{,}470\text{ B}$$

| 核算项（$17 \times 17$ FP16 示意尺寸） | 算式 | 结果 |
| --- | --- | --- |
| 补齐后的行数 / 列数 | $\lceil 17 \div 16 \rceil \times 16$ | 各 **32** |
| 有效数据载荷 | $17 \times 17 \times 2\text{ B}$ | **578 B** |
| 分块后载荷 | $32 \times 32 \times 2\text{ B}$ | **2,048 B** |
| 补齐增加空间 | $2{,}048\text{ B} - 578\text{ B}$ | **1,470 B** |

这是格式载荷的账，分配器对齐和临时副本另算。矩阵很小、边长刚越过对齐边界时，补齐比例会特别大；大而已对齐的矩阵则没有这笔尾部浪费。由此不能把“NZ 更适合某些算子”理解为“NZ 一定省内存”。

该 ATB 接口将 batch、块列、补齐后的行、块内列写成四维输出；框架张量则可能仍对外展示原逻辑 shape，并用设备格式元数据记录实际存储。判断搬多少字节，要同时查接口、格式和实际分配，不能仅凭打印出的 shape。

## shape、stride、dtype、打包各管什么？

这几个词描述同一个张量的不同方面。shape 是各维长度；dtype 是一个元素的数值编码，例如 BF16 或 INT8；stride 是普通带步长张量中，某一维下标加一要在存储里跨过多少个元素。

| 操作或属性 | 直接改变什么 | 核对重点 |
| --- | --- | --- |
| shape / reshape | 怎样按维度解释元素 | reshape 可能共享存储，也可能复制 |
| transpose / contiguous | 交换维度、必要时生成连续副本 | 普通 PyTorch 转置通常是视图；连续副本才可能真正搬数据 |
| 量化与反量化 | 编码及其与近似数值的对应 | 位数、scale、zero-point、分组必须一起解释 |
| INT4 打包、ND/NZ 转换 | 编码如何放进字节、元素如何排进物理存储 | 半字节顺序和分块顺序属于不同约定 |

比如两个 4 位编码可以放进一个 8 位字节，但“哪个编码在高半字节”仍由格式规定。它们还可以继续按某个矩阵布局排列。量化、打包、转置和设备格式转换可以连续发生，任一步都不能替代其余步骤。

普通张量的连续性不等于昇腾的设备格式编号。仅调用 contiguous，并不能证明张量已经成为 NZ；同样，仅有相同的 shape 和 dtype，也不能证明两份设备字节可以直接互拷。

## 权重模式 0、1、2，是在哪一步作决定？

**它决定普通权重后处理是否调用 NZ 转换。** 权重先经过该层需要的转置、连续化等处理，再由普通策略检查类型和设备；策略允许才调用转换，拒绝则原样返回传进来的张量。所以模式 0 的含义是“本入口不再转 NZ”，并不会把已经为 NZ 的输入反向还原为 ND。

以固定 A2 上一块进入普通策略的 INT8 权重、另一块 BF16 权重作对照，暂不考虑直接转换的专家分支：

| 模式 | INT8 权重 | BF16 / FP16 权重 | FP32 或只有元信息的 meta 张量 |
|---|---|---|---|
| 0 | 原样返回 | 原样返回 | 原样返回 |
| 1（默认） | 调用 NZ 转换 | 原样返回 | 原样返回 |
| 2 | 调用 NZ 转换 | 调用 NZ 转换 | 原样返回 |

这张表回答“是否发起转换”，具体张量能否通过转换仍取决于算子支持；`meta` 张量只携带形状和类型，没有实体数据。在 `v0.30.0` 与 `main` 主基线中，普通策略统一由 `additional_config.weight_nz_mode`（`0` / `1` / `2`，默认 `1`）控制，旧环境变量 `VLLM_ASCEND_ENABLE_NZ` 已退役不再读取。判定入口 `_should_trans_nz` 先排除 FP32、`meta` 以及至少二维且末两维含 `1` 的张量，再检查硬件档案的强制策略——**310P 通过 `WeightLayoutPolicy.FORCE_NZ` 强制转换 `FRACTAL_NZ`**，且优先级高于 `weight_nz_mode`，因此不能拿 A2 上模式 `0` 的结果直接套给 310P。

模式 1 和 2 的差别在于是否将半精度权重也送去转换，不会把 INT8 权重变成 BF16，也不会把所有激活与缓存一并改格式。开关的覆盖范围必须沿具体层的后处理入口确认，下面的专家层就是例外。

把前面的大 N / 小 z 分形遍历、$17 \times 17 \to 32 \times 32$ 真实补齐面积、`_should_trans_nz` 决策闸门以及四个正交概念边界放在同一张图里对照：

```wiki-diagram
file: tensor-layout-fig-nd-nz-cube
```

## 放到 GLM 双机，权重和 KV cache 分别怎样处理？

下面转入例外 B 历史绑定算例——[GLM-5.3-Flash 官方双机部署](glm-5-3-flash-two-node.md#部署前提)（`2 × Atlas 800 A2`，采用 W8A8 权重包，W、A 分别指权重与激活）。**对于实际选中动态 W8A8 方法的线性层**，固定源码在加载后先将权重转到算子方向，再按策略转成 NZ；前向对输入激活量化、执行矩阵乘，并按输入类型（本部署为 BF16）输出。两份固定量化描述中，MLP 都采用 `W8A8_DYNAMIC`；12 个 MLA 层的 `q_a`、`kv_a`、`q_b`、`o` 四组权重从旧 `9e55cbc8` 的 `FLOAT` 改为新 `3121f187` 的 `W8A8_DYNAMIC`，而 KDA 等保留浮点的层不走整条量化路径。逐层配方与执行类选择应一起核对（版本明细见[双机量化账](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)，计算方法见 [W8A8 页](quantization.md)）。

专家层还存在更直接的分支：固定实现的 W8A8 专家权重转置后直接调用 NZ 格式转换，注释指向分组矩阵乘与 SwiGLU 量化融合接口的要求。这里的 SwiGLU 是专家中间的门控激活。因此，普通线性层的权重 NZ 策略不能代表所有专家分支。

**权重 NZ 与 KV cache NZ 分别配置、分别核对。** KV cache 是推理过程中留下的历史状态；将其转成 NZ 只改变布局，把它量化成 C8 才涉及每元素位数和缩放。官方配置页将 KV NZ 限定于 MLA 模型的相应路径，MLA 是用潜向量压缩 attention 历史的一种结构；它不是所有缓存的通用开关。本站固定 GLM 部署是否启用缓存量化，以 [KV cache 量化页](kv-cache-quantization.md)的结论为准。

## 常见误解

- **NZ 是一种 8 位精度？** NZ 描述布局，FP16/BF16/INT8 都可能采用它。
- **ND 就表示未量化？** INT8 也可以按 ND 排；精度和排布要分别记录。
- **转 NZ 就是转置或 reshape？** 前者改变分块存储，转置交换逻辑轴，reshape 重新解释维度。
- **同一个矩阵直接按地址复制就行？** 接收方必须按相同格式解释有效数据、补齐和元数据；实际跨实例要求见 [RFork 布局](rfork-layout.md)。
- **NZ 总能更快？** 收益取决于算子与负载，转换、补齐和工作区也占时间与空间。

## 对照源码

### 怎么开

普通权重转换入口是 `maybe_trans_nz`，按 `_should_trans_nz` 的返回值决定是否调用格式转换；具体的 0/1/2 与类型顺序见上表。模式 0 返回原张量，未做反向转换。[C5]

**正式入口为 additional_config 顶层的 `weight_nz_mode`，使用整数 0、1、2，默认 1。** 它与 ascend_compilation_config 平级，不嵌在编译子对象中。固定 GLM、v0.23 维护分支和 v0.26 rc 还兼容环境变量 `VLLM_ASCEND_ENABLE_NZ`：环境值先用 int 解析，未设置为 1；JSON 中存在该键就取 JSON 值，否则才取已解析的环境值。[C11]

下面是加入原有 vllm serve 启动命令的片段；双机各自的启动环境与 JSON 都应一致。已有 additional-config 时合并到同一对象，其余配置沿用[固定双机部署](glm-5-3-flash-two-node.md#部署前提)。

```bash
--additional-config '{"weight_nz_mode":1}'
```

Python 对应的参数片段为 `additional_config={"weight_nz_mode": 1}`，可传给 LLM 或 EngineArgs。若同时要关闭乘加融合，层级如下；三个融合布尔开关的用途与门控统一见[编译图融合](npugraph-ex.md#怎么开)。

```json
{
  "weight_nz_mode": 1,
  "ascend_compilation_config": {
    "fuse_muls_add": false
  }
}
```

旧镜像也能在每台机器启动服务前设置 `export VLLM_ASCEND_ENABLE_NZ=2`，但已有 JSON 键时它不覆盖 JSON。优先级按“键是否存在”判断，不是按真假值回退：

| JSON 顶层值 | 旧环境值 | 固定 GLM / v0.23 / v0.26 rc 的结果 |
|---|---|---|
| 未写 | 未设 | 模式 1 |
| 未写 | 2 | 模式 2，并记录环境入口弃用提示 |
| 0 | 2 | 模式 0；不会因 0 为假而回退到 2 |
| null | 2 | 保留 None，普通非 310P 路径因假值跳过转换；不是“使用默认” |
| 1 | false（文本） | 环境值 int 解析先失败，尚未进入 JSON 优先级选择 |

上述异常输入用于解释故障，实际配置应写整数。旧版未经严格校验，字符串 "2" 虽然为真却不等于整数 2，会让半精度分支跳过；布尔值也参与 Python 的整数比较，不能依赖它表达三态策略。优先级与环境解析分别见来源 13、14；通用配置生命周期见 [Ascend 配置系统](ascend-config-system.md#怎么开)。

官方配置表将默认列为 1，并说明旧环境变量已不再支持；`enable_kv_nz` 是独立字段。[S12] 该网页会继续更新，迁移说明中还有过渡期表述；应按字段说明与固定源码核对，不能据当前表格断言旧镜像不再读取环境值。`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）已退役该环境变量入口，固定 GLM 与 `v0.23.0` / `v0.26.0rc` 则仍读取它（来源 11、15–18、21）。

W8A8 专家后处理直接调用转换接口，未经过上述普通权重策略，所以 0 不是所有权重的全局“禁止 NZ”保证。[C7]

### 会报什么错

| 情况 | 固定版本行为 | 修正方式 |
|---|---|---|
| 旧环境变量不是整数文本 | int 解析抛 ValueError；即使 JSON 有合法值也先失败 | 删除遗留环境值或改为 0/1/2，不能只覆盖 JSON |
| JSON 模式超出范围 | GLM / v0.23 / v0.26 rc 不在这里校验范围；如 3 为真，但半精度仍因不等于 2 跳过 | 使用整数 0/1/2，不能把“不报错”当成合法 |
| `v0.30.0` / `main` 模式非法 | 递归字段校验拒绝 `null`、不可转整数的文本；范围校验要求 `0`、`1`、`2`，否则报 `weight_nz_mode must be one of 0, 1, or 2` | 对照 `v0.30.0` / `main` 的正式字段与范围校验，来源 18、19 |
| 写进编译子对象 | 旧版未知子键被忽略，顶层仍按原默认或环境决定；`v0.30.0` / `main` 未知子键校验失败 | 移到 `additional_config` 顶层 |

格式、dtype、对齐尺寸或算子组合不支持时，转换或执行可能报错；两端按不同布局解释同一批字节，也可能不报错却算错。记录逻辑 shape、dtype、设备格式、实际存储大小、调用接口及具体版本，才能区分两类问题。具体算子错误文本以现场日志为准。

### 开销和什么时候别开

检查转换发生在加载一次还是每次前向；同时记录转换临时峰值、补齐后的载荷和目标算子耗时。频繁更新权重的场景还要检查新权重是否重新完成后处理，见 [RL 权重更新](vllm-ascend-for-rl.md)。

模式 2 扩大了半精度权重的转换范围，应在相同负载下比较启动耗时、峰值显存、稳定时延与数值；不能只凭模式数字更大就推定更快。模式改变的是加载与执行路径，按修改后的启动配置重新加载并核对每类权重；它不支持在单个 HTTP 请求里切换已经加载的格式。`v0.30.0` 与 `main` 启用 `rl_config.enabled` 后会警告并将模式改为 `0`，便于 RL 路径保持其要求的布局；这仍不替代硬件策略和直接调用分支的检查（来源 20）。在 `Ascend 910B3` 真机冷启动与休眠实测中（完整档案见[Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)），首次 `npu_format_cast(NZ)` 懒加载耗时 `7.1618 s`（二次仅 `0.0007 s`），且默认 `weight_nz_mode=1` 会触发 `Sleep Mode` `wake_up()` 的 `FRACTAL_NZ` 守卫报错，启用休眠唤醒须显式设 `weight_nz_mode=0`。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；例外 B 的历史 GLM 双机绑定算例另钉 `db701c1f`（与 `v0.23.0` 的 `weight_nz_mode` 入口一致，W8A8 专家层另有直接 NZ 转换）。

| 核对维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 配置入口与退役环境变量 | `weight_nz_mode` 默认 `1`；JSON 键优先，兼容旧环境 `VLLM_ASCEND_ENABLE_NZ`；无 `0/1/2` 范围校验 | 默认、环境兼容与 JSON 优先级同 `v0.23.0` | 正式顶层整数字段 `weight_nz_mode: int = 1`（`ascend_config.py#L615-L657`），Pydantic `model_validator` 强校验 `0/1/2`；**已退役 `VLLM_ASCEND_ENABLE_NZ`**（`envs.py` 不再登记）；`rl_config.enabled` 覆写为 `0`（`#L379-L386`） | 同 `v0.30.0`（`ascend_config.py#L718-L763`、`#L395-L402`），旧环境变量彻底移除 |
| `_should_trans_nz` 判定与 `310P` 强制策略 | 排除 FP32/`meta` → `310P` 特例直接转 NZ → 按模式 `0/1/2` 判断 | 判定顺序同 `v0.23.0` | 排除 FP32/`meta` 及末两维含 `1` 的 ≥2D 张量 → 查 `HardwareProfile.weight_layout_policy is WeightLayoutPolicy.FORCE_NZ`（`310P` 在 `hardware_profile.py#L317` 强制 `FRACTAL_NZ`，先于 `mode=0` 生效）→ 按 `weight_nz_mode` 判断（`utils.py#L352-L412`） | 同 `v0.30.0`（`utils.py#L370-L442`、`hardware_profile.py#L424`）；`A5` 档案新增 `requires_2d_nz_linear_input=True`（`hardware_profile.py#L443`） |
| 联动转置与数值格式路径 | 普通线性层按 `maybe_trans_nz`，W8A8 专家另有直接转换 | 同上 | `maybe_trans_nz_with_scale` 同步转置权重与 scale，仅需 NZ 时才 `contiguous` 并转换（关 NZ 时保留非连续转置）；原生 FP8 block 按硬件重组 MXFP8 或反量化，C8-MXFP cache 另含 E8M0 尺度张量 | 同 `v0.30.0`；`maybe_trans_nz` 与 `maybe_trans_nz_with_scale` 延续统一入口 |

FP8 block 重组为 MXFP8 与 C8-MXFP 附加 E8M0 尺度张量属于数值格式与缓存对象变化，不只是 ND/NZ 排布重排，不能与数学矩阵方向混为一谈。

### 源码位置

- ND 的 N-Dimension 名称与硬件代际边界见 CANN 分形格式说明 [S1]；NZ 的大 N、小 z 命名、分块维度顺序见 ATC 格式说明 [S2]。
- 转换前后 dtype 一致、FP16/BF16 与 INT8 的不同对齐位、ATB 输出维度见 TransdataOperation [S3]；视图、reshape 和连续副本的行为见 PyTorch Tensor Views [S4]。
- 普通策略与 `310P` `FORCE_NZ` 四版实现见来源 8–10 与 32–39（`c09d3e20` 的 `utils.py#L352-L412`、`hardware_profile.py#L310-L320`、`ascend_config.py#L379-L386`/`#L615-L657`；`8d6180e2` 的 `utils.py#L370-L442`、`hardware_profile.py#L417-L446`、`ascend_config.py#L395-L402`/`#L718-L763`）[C8][C9][C32][C35][C36][C39]；固定线性层与专家后处理见 [C6][C7]。
- 旧版配置优先级与 `VLLM_ASCEND_ENABLE_NZ` 解析见来源 11、13–17；固定量化描述见来源 28–29；编译子对象与 `extra=forbid` 校验见来源 30–31。
- 2×2 分块是教学假设 [A]；坐标映射和 $17 \times 17$ 补齐账是按格式规则的推导 [D]。本页未做 NPU 时延、内存峰值或跨框架互拷实测。
