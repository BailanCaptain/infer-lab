---
id: enable-pcp-o-proj-weight-sharding-8528cf5af9c6
title: enable_pcp_o_proj_weight_sharding
type: param
summary: >-
  加载期按 PCP 组切 o_proj 权重，常驻留 1/pcp_size；prefill all-gather 全量，decode 用本地片。本文讲
  baa023ad 的 SFA-PCP：静态默认 false，v0.23/v0.26 无，对 DSA-CP 无效。rc2 已有且声明默认
  true，实际启用仍须满足 PCP 与 runner 条件；GLM 双机不开 PCP，用不到。
origin: seed
aliases:
  - PCP o_proj 权重分片
  - SFA-PCP O-proj 权重切分
  - o_proj weight switch
chapters:
  - '15'
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
relations:
  - to: context-parallel
    kind: builds-on
    note: baa023ad 由 SFA-PCP 接手，rc2 还覆盖 DSA-PCP；均须先满足 PCP 后端和 runner 条件，序列切法见该页
  - to: layer-sharding
    kind: alternative-to
    note: >-
      两者都是为了不让每层都常驻一份全量 o_proj；layer_sharding 按层轮流放、v0.24 起已删，这个按 PCP 组切且只针对
      o_proj
  - to: ascend-config-system
    kind: builds-on
    note: 读取函数缓存结果；正常配置工厂发布新单例时会清缓存，直接改旧对象不会触发重建
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L468'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L468
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1509-L1519'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L58-L91
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L93-L110
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L112-L158
  - >-
    vllm-ascend@baa023ad:vllm_ascend/attention/context_parallel/sfa_cp.py#L1575-L1590
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L259-L296'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L441-L456'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/o_proj.py#L28-L51'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L211-L215'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L77
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1522-L1537'
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L1281-L1295'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L479
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L494
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L577
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L575
  - >-
    vllm-ascend@4e19cc765510abfa1dd485b2aa72ff83d0945cf8:vllm_ascend/ascend_config.py#L575
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L571
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L580
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L581
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L583
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L584
  - >-
    raw:sha256-b17f872b722cef68e999ca7aa43b95a2dff9cb5b6bf88b1c6a737362adb80ea3.md#L1-L363
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L298-L390'
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L588
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L586
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L581-L585'
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/sfa_cp.py#L82-L109
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/dsa_cp.py#L2551-L2615
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/dsa_cp.py#L2700-L2714
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L584
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1689-L1709'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L429-L538'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/o_proj.py#L59-L83'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1648'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L403'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L589
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L581
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b17f872b722cef68e999ca7aa43b95a2dff9cb5b6bf88b1c6a737362adb80ea3.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bba4b8ba16f2356784298f551ff30efd7aa1b9e1848d90d383e27b039bdd1e98.md
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
  - >-
    raw/sha256-ff36d627c1428c724f802b763def17644ceb02da03d51bf9b02c1ad282055f6e.md
---
## 一句话

**v0.30.0rc2 对照：** 默认改为 True，旧 main 的静态默认是 False；适用范围从 SFA-PCP 扩到 DSA-PCP 的 wo_a/wo_b 两级输出投影。这里的 DSA-PCP 是 PCP 后端，不是 enable_dsa_cp 控制的旧 DSA-CP，不能把两个名字当同一开关。

SFA-PCP 须满足本地输入宽度能被 PCP 整除并支持权重切换；DSA-PCP 须满足本地组数可整除且两级方法都支持。这些前置检查失败时告警并退回未切分权重；后续安装加载器在捕获异常的范围之外，参数的物理形状或加载器不满足要求时仍可报错。rc2 还要求 V2 model runner 才允许 PCP>1。需要完整权重时等待 all-gather，使用后切回本地分片；默认 True 不保证每种方法实际切分。

开了 SFA-PCP（[Context Parallel](../concepts/context-parallel.md) 的 prefill 那一半）之后，`o_proj` 的权重原本还是每张卡一份 TP-local 全量。这个键让它**在加载期就按 PCP 组再切一刀**：常驻的只剩 `1/pcp_size`，prefill 需要全量时现 all-gather 一份、用完切回去，decode 干脆不 gather——各 PCP rank 只算自己那一条输入切片，再 all-reduce 拼回原来的 TP-local 结果。本页机制按 baa023ad 讲解，该钉点静态默认 false；ee29cc6f 与 30ce5af0 的静态声明已是 true，页末参数定义展示的是较新快照，不能据此认定其运行行为与本页旧版机制相同。

**它与旧 layer_sharding 的切法不同。** [layer_sharding](layer-sharding.md) 按层号轮流保存整层投影；本键在 baa023ad 中控制同一层 o_proj 沿 PCP 域的切分，不接受任意层名列表。细粒度 TP 也会影响投影分工，因此不能把本键称为所有投影权重配置中唯一的选择。

**存在范围。** PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814)引入该键；固定main baa023ad与rc2均有，v0.28.0rc、v0.29.0rc也已包含。v0.23 2c59ff10与v0.26 2ed6cbba没有该键和weight_switch目录，旧配置逐键读取，写入会被忽略。固定main与rc2严格检查拼写；发现vllm_omni时只对未知顶层键警告并过滤，不能概括为所有未知键都可忽略。

**GLM 双机主线上它不生效。** 原部署 PCP=1、DCP=1，而且执行侧 db701c1f 尚无这个新键；不能用 baa023ad 的 SFA 实现选择函数解释旧版 GLM 专用后端。该固定 GLM 的 34 层 KDA 在 PCP>1 的 prefill 路径明确抛出 NotImplementedError，所以开启 PCP 也不是这份代码的可用方案。限制统一见 [CP 页的 GLM 一节](../concepts/context-parallel.md#放到-glm-双机这套部署开了-cp-吗)。11 层稀疏 MLA 的投影仍按 TP8 行切，形状见 [TP 页](../concepts/tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)。

官方参数表：[latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)（v0.23.0 与 v0.26.0rc1 两版里没有这一行）。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型 / baa023ad 静态默认 | bool / False，单测覆盖字符串 "true" 转为真 | 并非任意字符串都合法，建议按 JSON 布尔值填写 |
| baa023ad 谁会读它 | AscendSFAPCPImpl 及其 PCP+DCP 组合类 | 要同时满足模型走 SFA、PCP>1、enable_dsa_cp 为假；rc2 的 DSA-PCP 扩展见开头 |
| 对 DSA-CP 的影响 | **没有** | DSA-CP 那条路由 `enable_dsa_cp_full_o_proj()` 决定，判据是有没有 KV 池化 / 本实例是不是 producer，与本键无关 |
| 常驻权重量 | `o_proj` TP-local 宽度的 `1/pcp_size` | 省的是「每层」的量，层数越多省得越多 |
| 额外缓冲 | 相同方法、属性、设备、dtype、维度与形状的池键可跨层复用 | 单一同构权重的示意净省约 (1 − 1/PCP) × 每层 × 层数 − 一份全量；不同池键、量化辅助张量另计 |
| prefill / decode 分叉 | `attn_state` 不是 `DecodeOnly` / `SpecDecoding` 才 gather | decode 走 PCP all-reduce 路径，多一次组内 all-reduce、少一次权重 all-gather |
| 何时必须设 | 权重构建前；读取函数缓存结果 | 配置工厂正常发布新单例时会清缓存；重读开关也不能自动把已建权重改成另一种形状 |
| 整除约束 | `input_size_per_partition % pcp_size != 0` → `RuntimeError` | TP-local 的 `o_proj` 输入宽度必须能被 PCP 卡数整除，否则加载期就失败 |
| 量化方法约束 | linear method 必须是 `WeightSwitchMixin` 且 `supports_weight_switch` 为真，否则 `RuntimeError` | 不支持权重切换的量化实现上开它 = 起不来，不是静默降级 |
| 改的是物理形状 | 参数张量在 `load_weights` 之前就被 resize 成嵌套局部片 | 权重加载器选取 checkpoint 的局部片后装入参数，不先把完整 TP-local checkpoint 权重装入该参数；这不保证整个模型加载过程的显存峰值 |

## 为什么存在

PCP 把 prefill 的 token 沿序列维切到多张卡上，但**权重是复制的**：PCP 组里每张卡都拿着一份一模一样的 TP-local `o_proj`。对 DeepSeek-V3.2 这类模型，`o_proj` 是整个 attention 里最大的那块矩阵，PCP 开到 2、4，组里就存着 2、4 份一模一样的 `o_proj`（比不复制多出 1、3 份）——纯粹的冗余。

这个键把冗余换成通信。切法是沿 **input 维**（row-parallel 的那一维）：`WeightSwitchConfig.from_group(get_pcp_group(), shard_axis="input")`。接下来两件事是它区别于「运行时切一刀」的关键：

1. **加载期就切。** `prepare_layer_for_parallel_weight_load` 在 `model.load_weights` 之前把参数张量 resize 成 `原宽度 / pcp_size`，并换掉 `weight_loader`——加载器按 `WeightLoadPartition.from_nested_groups(TP 组, PCP 组)` 算出的位置，直接从 checkpoint 里取那一段连续切片。这省掉了先把完整 TP-local checkpoint 权重装入该参数、再选 PCP 局部片的步骤；构造参数与其他临时缓冲仍可能分配内存，整个模型加载过程的峰值需要另行测量。加载器只临时使用组合后的分片编号，原来的前向 TP 计算分工保持不变。
2. **前向时按阶段换视图。** prefill 那一趟先 All-Gather，在完整权重视图下做投影，使用后再切回本地片。decode 则不拼权重：每个 PCP rank 拿自己那一段输入做投影，得到部分和，再在 PCP 组里 All-Reduce。它恢复的是同一个矩阵乘法的数学结果；浮点归约次序和量化计算路径变化后，不保证逐位相同。

用一个未量化整数示意看 decode：输入是 [1, 2, 3, 4]，单个输出的权重是 [10, 20, 30, 40]，PCP=2。rank 0 用前两项算 1×10+2×20=50，rank 1 用后两项算 3×30+4×40=250；组内相加得到 300，与完整点积相同。prefill 时，各 rank 处理的 token 行不同，不能把不同 token 的部分和直接相加，所以这条实现先拼回每个 rank 所需的完整投影权重。

decode 的 token 在 PCP 各 rank 上是**复制**的，因此可以沿投影输入的 K 维分块，再把同一 token 的部分结果相加。prefill 各 rank 对应不同 token 行；序列切分并不意味着缺少输入 K 维，而是不能直接套用 decode 的跨 rank 求和方式。这条实现因此选择 gather 权重，再分别计算各自的 token 行。

PCP 组内求和恢复的是原来的 TP-local 投影结果。启用 TP、且该层要求在这里合并各 TP 分片结果时，随后还会执行 TP 组内求和；两次求和分别合并 PCP 与 TP 切分产生的部分结果。若该层不要求在此完成 TP 归约，这条路径便不会额外执行它；PCP 求和本身没有替代 TP 的计算分工。

gather buffer 挂在类变量 o_proj_full_pools 上，按方法类名、pool key、属性名、device、dtype、dim 与形状做键复用。键全部相同的层才能共用一块；不同形状或量化辅助属性需要各自的缓冲，不能给整个模型统一只扣一份。

## 开了的代价

**decode 多一次 all-reduce，prefill 多一次 all-gather。** 两笔通信都在 PCP 组内。decode 侧那次 all-reduce 的量是 hidden 维的输出张量，跟 token 数成正比；prefill 侧那次 all-gather 的量是权重本身，跟 token 数无关。所以 batch 小、prefill 频繁的形态最吃亏：权重 gather 的固定成本摊不下去。

**加载期的两条硬约束都是 `RuntimeError`，不是降级。** `o_proj` 的 TP-local 输入宽度不能被 PCP 卡数整除、或者用的量化方法没实现 `WeightSwitchMixin` 接口（`supports_weight_switch` 为假），都直接抛错。重复安装也拦——同一层被装过两次 loader 会报 `Loader-time weight sharding has already been installed`。这类错发生在加载权重的阶段，好处是快，坏处是换一个量化格式就可能突然起不来。

**baa023ad 的旧 DSA-CP 不消费本键。** 那一支看的是 full_o_proj 判定：DSA-CP 已启用，且没有 KV 传输配置或本实例具备 producer 角色（包括 kv_both）。旧版 layer_shard 与 o_proj_tp 判定曾同时存在，角色范围也不同；演变见 [layer_sharding](layer-sharding.md)。rc2 新增消费本键的 DSA-PCP 是另一条 PCP 后端，不能与旧 DSA-CP 混为一谈。

**baa023ad 没选中 PCP 实现时，本键不参与该路径。** SFA 实现选择函数分别检查 DSA-CP、DCP 和 PCP；没有 PCP，或优先进入旧 DSA-CP 时，不会通过这个开关安装 PCP 权重加载器。其他配置仍可能阻止启动。

**配置必须与已建权重一致。** 读取函数缓存结果；正常配置工厂发布新单例和清理配置时会调用缓存清理函数。直接改旧对象不会自动清缓存，而仅清缓存也不会重切已经加载的权重，所以不能把它当作推理中的热切换选项。

**待核。** 常驻1/pcp_size和净省估式是按切法推导，缺实际显存、时延对照，不能用GLM主线数字代替效果。PCP+DCP变体虽继承同一权重切换机制，叠加后的完整prefill/decode路径仍须核对，继承关系不能单独证明组合兼容。GLM混合模型的PCP限制与NotImplementedError统一见[上下文并行](../concepts/context-parallel.md#放到-glm-双机这套部署开了-cp-吗)。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_pcp_o_proj_weight_sharding` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["enable_pcp_o_proj_weight_sharding"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:581` [C45] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

### 源码位置

来源 8、31 对应 baa023ad 的加载期缩片：V2 参数临时使用组合后的 tp_rank / tp_size，在 finally 中恢复原值；普通参数按组合分片选择切片，预分片 checkpoint 另按形状选择本地片。来源 39 解释配置单例发布后的缓存清理，40、41 解释完整缓冲保留与视图切回。

来源 6 的 147–153 行先在 PCP 组求和，只有 reduce_results 且 TP 组大小大于 1 才继续 TP 组求和。来源 35、36 的 rc2 回退只覆盖前置检查，后续安装加载器仍可失败；来源 42 给出 rc2 的 V2 runner 限制，43 给出固定 GLM KDA 的 PCP 拒绝。PCP+DCP 完整组合路径和设备效果仍未在此验证。

**正文依据索引。** 下列编号与“查看来源”中的编号一致；链接保留固定版本和原文范围。源码与官方说明只支持各行写明的主张，推导、风险和假设另列。

| 正文中的主张 | 对应原文 |
|---|---|
| 加载期沿 input 维分片，以及 prefill/decode 的不同通信路径 | [来源 4](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/attention/context_parallel/sfa_cp.py#L58-L91)、[来源 5](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/attention/context_parallel/sfa_cp.py#L93-L110) |
| 旧配置读取，以及固定 main 的严格检查与未知键过滤 | [来源 15](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L455)、[来源 16](https://github.com/vllm-project/vllm-ascend/blob/2ed6cbba/vllm_ascend/ascend_config.py#L61-L67)、[来源 17](https://github.com/vllm-project/vllm-ascend/blob/2c59ff10/vllm_ascend/ascend_config.py#L32-L38)、[来源 23](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/ascend_config.py#L1660-L1671) |
| baa023ad 静态默认、字符串布尔值转换与读取缓存 | [来源 14](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/tests/ut/test_ascend_config.py#L1281-L1295)、[来源 3](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/utils.py#L1509-L1519) |
| SFA-PCP 消费者及组合类的前提 | [来源 7](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/attention/context_parallel/sfa_cp.py#L1575-L1590) |
| DSA-CP 与本键的边界：官方配置说明及实际判据 | [来源 12](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/docs/source/user_guide/configuration/additional_config.md#L77)、[来源 13](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/utils.py#L1522-L1537) |
| 常驻分片、整除检查、可复用缓冲池键 | [来源 8](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/weight_switch/linear.py#L259-L296)、[来源 9](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/weight_switch/linear.py#L441-L456) |
| 量化方法接口、安装加载器与错误条件 | [来源 10](https://github.com/vllm-project/vllm-ascend/blob/baa023ad/vllm_ascend/weight_switch/o_proj.py#L28-L51) |
| 自动生成参数定义中的声明位置 | [来源 38](https://github.com/vllm-project/vllm-ascend/blob/7d825229c77025cfb185a010c25819c1214b9450/vllm_ascend/ascend_config.py#L584) |

通信代价的推导：decode 归约的量随 token 数变化，prefill 收集的量由权重决定；batch 小且 prefill 频繁时，固定的权重收集成本更难摊薄 [D]。该推导不代替实际耗时测量，也不把权重分片量当成整卡净节省。
