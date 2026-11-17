---
id: combine-quant-mode-2a3f7cd47997
title: combine_quant_mode
type: param
summary: >-
  MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）通信时用哪种量化：非 0 就强行覆盖模型自己推出来的模式，只认
  0/2/3/4，默认 0 不干预。固定 main 与 rc2 有此键，v0.23 与 v0.26 两个旧发布分支上配了会被静默忽略；rc2
  最终模式还受硬件能力与消费者约束。
origin: seed
aliases:
  - MC2 combine 通信量化
  - combine 阶段通信量化模式
  - 强制 combine 量化模式
chapters:
  - '14'
  - '17'
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
relations:
  - to: expert-parallel
    kind: builds-on
    note: >-
      它改的是 MC2 那对 dispatch / combine 算子里 combine 那一半的通信量化位，而 MC2 正是 EP 收发 token
      的通道
  - to: quantization
    kind: builds-on
    note: 默认值 0 的含义是「跟着模型权重声明的 quant_type 走」，要判断覆盖掉了什么，先得知道 quant_type 从哪来
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 main 上 pydantic AscendConfig 的顶层 Literal 字段，v0.23 / v0.26 那套逐键 .get()
      根本不认识这个名字
  - to: collective-communication
    kind: builds-on
    note: 该参数调整 MC2 combine 的通信量化，理解其作用需要先区分 MC2 的派发、返回与普通集合操作。
  - to: moe
    kind: builds-on
    note: 该参数建立在 MoE 的路由专家计算与结果加权合并机制上，控制 MC2 路径中专家结果收回阶段的通信量化。
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L474'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L474
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L274-L287'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L162-L173'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L327-L333'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L215-L232'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L350-L524'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L471-L474'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L435'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L83
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L1632-L1663'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1697'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L359'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L351'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L486
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L501
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L582
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L591
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L587
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L588
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L590
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L591
  - >-
    raw:sha256-331f09bdb42c45cbce3db4b5de7bf2986ed113bd4e7c63a577c6a899adc736af.md#L1-L270
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L595
  - >-
    raw:sha256-aab18758a1e52d9d50ba1357f21458e6b27a4e8ed0a8d8403d62cb9ef855d85a.md#L1-L274
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ops/fused_moe/token_dispatcher.py#L271-L287
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L593
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L588-L591'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/token_dispatcher.py#L265-L287'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L591
  - >-
    https://github.com/Ascend/op-plugin/blob/aed3889c79923863fc9bfb36105cd6f577508cde/docs/zh/custom_APIs/torch_npu/torch_npu-npu_moe_distribute_combine_v2.md#L257-L279
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1689-L1708'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L118-L168'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L150-L170'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L265-L339'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L596
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L588
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-331f09bdb42c45cbce3db4b5de7bf2986ed113bd4e7c63a577c6a899adc736af.md
  - >-
    raw/sha256-3aeecff5a0621aa0037d9185cccbb5f2e89f9301f66f9d573c6ed67e7ff33a71.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-bfacc19702472408b9807eb9cbb7828d3e09d484fa40fe4128d3fa847cc446fa.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ca9a84111a41a3b9f040cdb3251cd2b13e2c00cf22725addb31dac226c9bc3b0.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

**v0.30.0rc2 对照：** 仍接受 0、2、3、4，默认 0。MC2 combine 的选择顺序是用户非零覆盖值、量化方法的 comm_quant_mode、W8A8MXFP 自动模式 4，最后才是 0。因此填 0 表示不强制覆盖，不保证关闭模型本身的通信量化；枚举合法也不证明任意硬件都支持该模式。

`combine_quant_mode` 只管一件事：MoE 的 **MC2 combine 阶段**——专家算完、把结果沿 EP 组收回各自 rank 的那次 all-to-all——在通信时用哪种量化。非 0 就把 `npu_moe_distribute_combine_v2` 的 `comm_quant_mode` 实参**强行**设成这个值，压过模型量化类型推出来的那个；`0`（默认）表示不干预 [C3]。

设为 0 表示不强制覆盖，而不是强制关闭通信量化：此时优先采用模型传来的 comm_quant_mode，只要它不是空值，包括显式的 0；未提供时，W8A8MXFP 回退到模式 4，其他类型回退到 0。


**它只动 combine 那一半。** 同一个 `TokenDispatcherWithMC2` 里，dispatch 方向的 `quant_mode` 是另一段独立的 `if / elif`，从头到尾不看这个键 [C4]。所以它造得出「发出去一种精度、收回来另一种」的不对称状态——这正是它存在的理由，而不是副作用。

**存在范围。** 固定 main 与 rc2 有此键；它在 2026-09-07 由 PR [#15441](https://github.com/vllm-project/vllm-ascend/pull/15441) 引入。v0.23 维护分支与 v0.26 固定快照在代码和文档中均无此名；两个旧配置类逐键 `additional_config.get(...)`，配上既不报错也不生效 [C14]。固定 main 和 rc2 使用严格配置，拼错通常启动失败；能发现 vllm_omni 时才警告并过滤未知顶层键 [C12][C13]，不等于旧键开始生效。

**放到 GLM 双机。** 它管的是每个 MoE 层里专家算完、结果送回源卡的那一步，路线见 [expert parallel 的 combine 一节](../concepts/expert-parallel.md#4-combine拼回-token加共享输出)。[GLM 固定部署](../sources/glm-5-3-flash-baseline.md)使用的 db701c1f 没有这个键；本项目另作对照的 v0.23 维护快照也没有。走 MC2 路径且模型未显式提供通信量化模式时，GLM 的 W8A8 专家使 dispatch 选 int8、combine 选 0；如果切到 AllGather，则不经过这对算子 [C37][C38]。按隐藏维度 4096 计算，单个（token, 专家）副本的 BF16 张量为 8,192 B，int8 数据加一个 FP32 系数为 4,100 B。这里是张量载荷算例，不是实际链路字节数；路由、归并、对齐和通信元数据另算，完整推导见[量化 · 为什么 EP dispatch 搬的是 int8](../concepts/quantization.md#为什么-ep-dispatch-搬的是-int8)。迁移到支持此键的版本后，仍须匹配算子与硬件：下面的官方算子快照在 A2 上只列 0、2，并对 2 限定通信算法与驱动，不能因配置接受 4 就认为 A2 支持它。此 GLM 部署改变 combine 模式后的速度和精度尚无实测。

官方参数表：[latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)（v0.23.0 与 v0.26.0rc1 两版的表里没有这一行）。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 合法取值 | `Literal[0, 2, 3, 4]`，别的整数一律 `ValueError` [C1] | 官方表写「int，取值范围请查算子文档」[S10]，实际只有这四个过得了校验——照算子文档填 1 会在启动期被挡回来 [!] |
| 默认值 | `0` | 不覆盖，按 `quant.comm_quant_mode` / `quant_type` 那两级默认推 |
| `2` / `3` / `4` 的含义 | 算子文档分别定义为 int8、MXFP E5M2、MXFP E4M3FN [S34] | 不是所有硬件都支持这三个值；见下方硬件条件 |
| 传字符串 | `"4"` 直接抛 `ValueError` [C11] | 与 `weight_nz_mode` 这类 lax 强转的 int 键**不一样**，JSON 里带引号就起不来 |
| 生效路径 | 固定实现中，`MC2CommImpl` 经公共 `fused_experts` 调用 MC2 `token_combine` [C6][C36] | 已选中的 `FusedMC2CommImpl` 重写这段执行路径，不读取此覆盖值 [C7]；仅看启动参数不足以确认最终选中了哪条路径 |
| 生效阶段 | 只有 combine | dispatch 侧那段 `quant_mode` 不看它 |
| 优先级 | 高于 `combine_metadata.quant.comm_quant_mode`，也高于 W8A8MXFP 默认的 4 | 它是**第一顺位**，不是兜底默认，上游单测专门锁了这条 |
| 此字段的校验范围 | 枚举白名单，不是硬件兼容性清单 | 合法值仍可能不符合所用算子的产品、驱动和输入约束；配置接受不保证执行成功或精度达标 |
| 官方示例 dict | **没收录它** [C9] | `AscendConfig` 文档字符串里那份自称「列出每个支持的键」的样例配置漏了这一行，别拿它当键的全集 [!] |

**硬件条件。** Ascend op-plugin 固定快照 `aed3889c` 的 `npu_moe_distribute_combine_v2` 文档列出：A2 支持 0、2，模式 2 还要求所列 hierarchy 通信方式与驱动条件；A3 支持 0、2，模式 2 要求 `tp_world_size != 2`；950DT 才在这一版文档中同时列出 0、2、3、4。这里的 TP 值是算子实参，不能直接用模型 `--tensor-parallel-size` 代替。A2 文档给出的具体条件为 `comm_alg="hierarchy"`，或 `HCCL_INTRA_PCIE_ENABLE=1`、`HCCL_INTRA_ROCE_ENABLE=0` 且驱动不低于 `25.0.RC1.1`；其通信算法说明同时推荐 hierarchy 搭配该驱动或更新版本。部署时应按实际安装的 torch_npu/CANN 配套文档复核，不能把这个新快照的格式定义当成旧容器已经支持的证明 [S34]。

## 为什么存在

MC2 是昇腾上 EP 的那对收发算子：`npu_moe_distribute_dispatch_v2` 把 token 按路由发到持有专家的 rank，专家算完，`npu_moe_distribute_combine_v2` 再按权重把结果收回来 [C5]。两次都是真·跨卡通信，量越大越贵，所以算子本身留了一个 `comm_quant_mode` 参数——通信时先把张量压到低精度再发。

这个精度原本是**推**出来的，不是配的。combine 侧的顺序是三级兜底：模型侧显式给了 `quant.comm_quant_mode` 就用它，否则 `quant_type` 是 `W8A8MXFP` 就用 4，再否则 0（不量化）[C3]。dispatch 侧是另一套相似但不同的推断。推断的前提是「通信精度跟着权重量化类型走」；想在不改权重量化的前提下单独换掉 combine 的通信精度（比如调优、对比精度），前两级都帮不上——于是加了一个把前两级全部短路掉的开关：

```python
combine_quant_mode = get_ascend_config().combine_quant_mode
if combine_quant_mode:
    quant_mode = combine_quant_mode
elif comm_quant_mode is not None:
    ...
```

`if combine_quant_mode:` 用的是真值判断，所以 `0` 既是默认值，也是关闭**人工覆盖**的表达方式，不需要额外的 `enable_` 开关。消费者每次调用都从当前配置读取；配置工厂可在 refresh 时重建并发布单例，不能把它理解为进程终生不可变的常量。这里也没有提供给在线请求逐次切换模式的接口 [C35]。

**为什么只给 combine、不给 dispatch。** 未显式提供模型级 `comm_quant_mode` 时，两侧的默认推断本来就不对称：dispatch 还根据 `dispatch_with_quant` 和硬件／MXFP 条件选 2 或 4；combine 则在 W8A8MXFP 时选 4，其余选 0。模式 0 表示通信不再量化，不代表所有模型的专家输出一定是 BF16 [C3][C4]。引入它的 PR 说明写的目的，是让非 MXFP 模型不改权重量化，也能给 combine 指定一种通信量化（举的例子是 4）。至于上游为什么不让 combine 默认跟着 dispatch 一起量化，代码和 PR 没有给出设计理由。

## 开了的代价

**比较速度时也要比较数值。** 通信量化降低数据表示精度，可能引入量化误差；能否减少端到端耗时，还取决于量化开销、通信算法和瓶颈位置。不能只把每个元素的位数相除，就保证实际链路流量或总时延按同样比例下降，也不能断言模型指标必然变差。字段本身没有按模型精度验证模式 4 的兼容性，仍须按算子条件运行并比较精度。

**选中 fused MC2 时，这个覆盖值不参与执行。** `FusedMC2CommImpl` 的 `fused_experts` 走 `torch.ops._C_ascend.dispatch_ffn_combine` 或 CANN MegaMoe，没有调用读取此字段的 `token_combine`。这只证明该路径不使用这个覆盖值：融合路径本身仍有权重格式等前提，例如非 MegaMoe 分支要求两份 scale bias 非空，不能由此承诺组合配置一定启动成功或结果正确。判断是否生效，要确认实际选中了非融合 `MC2CommImpl`。官方表把这一行描述为「Fused MC2 configuration」[S10]，但该措辞与这里的消费者范围不一致，不能据它要求先开融合 MC2。

**取值卡得比文档紧。** `Literal[0, 2, 3, 4]` 是启动期由 pydantic 校验的白名单：`1` 不在白名单里，会被 pydantic 拒收；`"4"`、`"true"` 这类字符串同样拒收，上游为这两种字符串各写了一个单测，`1` 没有专门的单测，靠白名单本身挡住 [C11]。引入它的 PR 说明里写的是字符串 `"4"` 会被宽松转成 4、显式的 `comm_quant_mode` 优先于这个键，这两条都和合入的代码与单测相反，以代码为准。官方表让你「参考算子文档的有效取值范围」[S10]，但算子文档里合法的值不一定在这四个里——以代码为准，超出白名单的值根本递不到算子手上 [!]。

配置白名单不等于算子的兼容性清单：模式 3 的格式虽有官方定义，仍须满足上面的产品与版本条件。0、2、4 的配置接受测试也只表达解析预期，不能替代实际通信与数值验收。

**旧快照不会应用这个覆盖值。** 在本页固定的 v0.23 / v0.26 配置与消费者中，这个名字没有入口，逐键 `.get()` 也不拒绝它，因此单独添加这项不能改变 combine 模式 [C14][C15]。迁移到 main 或 rc2 后，它才可能真正改变算子实参；这一步仍需重新检查硬件条件和数值结果，不能推断升级后必然无兼容性问题。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.combine_quant_mode` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["combine_quant_mode"]` |
| 所属类 | `AscendConfig` |
| 类型 | `Literal[0, 2, 3, 4]` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:588` [C40] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

When non-zero, force the MC2 combine stage's comm quant_mode to this value (e.g. 4 = MXFP float8_e4m3 communication quantization) regardless of the model's quant_type, 0 means disabled (use the model's own quant).

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

- 来源 29：vllm-ascend@baa023ad，vllm_ascend/ops/fused_moe/token_dispatcher.py，L271–L287。
