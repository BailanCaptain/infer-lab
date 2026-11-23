---
id: enable-pcp-o-proj-weight-sharding-8528cf5af9c6
title: enable_pcp_o_proj_weight_sharding
type: param
summary: >-
  PCP>1 时在加载期按 PCP 组切分输出投影权重，每卡常驻 1/pcp_size；prefill 临时 all-gather，decode
  用本地片加 PCP all-reduce。v0.30.0 与 main 默认 true，覆盖 SFA-PCP 与 DSA-PCP。
origin: seed
aliases:
  - PCP o_proj 权重分片
  - SFA-PCP O-proj 权重切分
  - o_proj weight switch
legacyAnchors:
  一句话: 它怎么在 PCP 组内切 o_proj，和旧 layer_sharding 有何不同？
  事实表: 它怎么在 PCP 组内切 o_proj，和旧 layer_sharding 有何不同？
  为什么存在: 加载期缩片、prefill gather 与 decode all-reduce 的分工
  开了的代价: 通信代价、硬约束回退机制与版本与 GLM 边界
chapters:
  - '15'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: context-parallel
    kind: builds-on
    note: v0.30.0 与 main 同时覆盖 SFA-PCP 与 DSA-PCP（早期 baa023ad 仅 SFA-PCP）；均须满足 PCP 后端和 V2 runner 条件，序列切法见该页
  - to: layer-sharding
    kind: alternative-to
    note: >-
      两者都是为了不让每层都常驻一份全量 o_proj；layer_sharding 按层轮流放、v0.24 起已删，这个按 PCP 组切且只针对
      o_proj / wo_a / wo_b
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
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/attention/context_parallel/sfa_cp.py#L80-L108
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/attention/context_parallel/dsa_cp.py#L2585-L2655
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1652-L1658'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L674-L674'
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/sfa_v1.py#L912-L936'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/attention/context_parallel/dsa_cp.py#L529-L551
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L2107-L2113'
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
## 它怎么在 PCP 组内切 o_proj，和旧 layer_sharding 有何不同？

开启 PCP（[Context Parallel](../concepts/context-parallel.md) 的 prefill 并行）后，prefill 的 token 沿序列维分给多张卡，但 `o_proj` 权重默认仍按 TP 复制给 PCP 组里每张卡（PCP 开到 2 或 4，组内就会多出 1 或 3 份一模一样的 `o_proj`；对 DeepSeek-V3.2 等模型，这是 attention 里最大的一块矩阵）。

`enable_pcp_o_proj_weight_sharding` 把这份冗余换成通信：加载期沿输入维按 PCP 组再切一刀，使每卡常驻权重量降到 `TP-local` 宽度的 `1/pcp_size`。prefill 需要完整权重时临时 All-Gather 拼齐、用完切回本地分片；decode 不拼权重，各 PCP rank 只算本地输入切片再在 PCP 组内 All-Reduce 合并部分和。

**与旧 `layer_sharding` 及旧 DSA-CP 的区别**：
- [layer_sharding](layer-sharding.md)（已于 `v0.24` 移除）是按层号轮流把不同层的整份权重存到不同卡上，并接收自定义层名列表；本键则是**把同一层的输出投影沿 PCP 域切分**，不接受任意层名列表（此外细粒度 TP 也会影响投影分工，本键并非投影权重配置的唯一选项）。
- `v0.30.0` 与 `main` 均把本键默认设为 `True`（早期 `baa023ad` 静态默认 `False`），并将适用范围从 **SFA-PCP** 的 `o_proj` 扩展到了 **DSA-PCP** 的两级输出投影（`wo_a` / `wo_b`）。注意这里的 **DSA-PCP** 是 PCP 后端，**不是**由 `enable_dsa_cp` 控制的旧 DSA-CP（旧 DSA-CP 由 `enable_dsa_cp_full_o_proj()` 决定，判据是有无 KV 池化及是否 producer/kv_both，不消费本键）。

| 关键维度 | `v0.30.0` / `main` 行为 | 说明 |
| --- | --- | --- |
| 类型、默认与缓存读取 | `bool`，默认 `True`（pydantic 宽松转换覆盖 `"true"`，建议写 JSON 布尔值）；读取函数缓存结果 | 正常配置工厂发布新单例或清理配置时会清缓存；直接修改旧对象不清缓存，且清缓存不会重切已加载权重，**不可运行时热切换** |
| 生效前提 | 模型走 SFA-PCP 或 DSA-PCP、`PCP > 1` 且使用 V2 model runner | 早期 `baa023ad` 仅覆盖 `AscendSFAPCPImpl` 及其 PCP+DCP 组合类（且 `enable_dsa_cp` 为假）；`v0.23`/`v0.26` 无此键与 `weight_switch` 目录 |
| 常驻量与缓冲池复用 | 常驻 `1/pcp_size`；完整 gather 缓冲挂在 `o_proj_full_pools`，按方法类名、pool key、属性名、device、dtype、dim、shape 键复用 | 单一同构权重的示意净省约为 `(1 - 1/PCP) × 每层 × 层数 - 1 份全量`；不同池键或量化辅助张量另计缓冲，不能统一只扣一份 |
| prefill / decode 分叉 | `attn_state` 非 `DecodeOnly` / `SpecDecoding` 时 gather 完整权重；decode 走本地片 + PCP All-Reduce | decode 少一次权重 All-Gather、多一次组内输出 All-Reduce |
| 版本与未知键处理 | PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814) 引入；`v0.23`/`v0.26` 忽略；`v0.30.0`/`main` 严格校验拼写（`vllm_omni` 仅过滤未知顶层键） | 官方参数表见 [latest additional_config](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html) |

## 加载期缩片、prefill gather 与 decode all-reduce 的分工

```wiki-diagram
file: param-pcp-o-proj-sharding
```

核心切法沿 row-parallel 的输入维构造 `WeightSwitchConfig.from_group(get_pcp_group(), shard_axis="input")`，由两套机制保证它不是低效的「先全量加载再裁剪」：

1. **加载期直接缩片**：`prepare_layer_for_parallel_weight_load` 在 `model.load_weights` 之前把参数张量 resize 为 `原宽度 / pcp_size` 并替换 `weight_loader`。加载时按 `WeightLoadPartition.from_nested_groups(TP 组, PCP 组)` 直接从 checkpoint 读取局部连续切片（V2 参数临时使用组合后的 `tp_rank` / `tp_size` 并在 `finally` 中恢复；预分片 checkpoint 按形状选本地片）。这避免了先把完整 TP-local checkpoint 权重装入该参数再裁切（构造参数与其他临时缓冲仍会分配内存，整机加载峰值需另测），且前向 TP 分工不变。
2. **前向按阶段切换视图**：
   - **prefill 阶段**：各 PCP rank 处理不同的 token 行，不能直接把不同 token 的部分和相加，因此先 All-Gather 拼回完整投影权重并在完整视图下计算，用完再切回本地分片（完整缓冲挂在 `o_proj_full_pools` 中复用）。
   - **decode 阶段**：decode 的 token 在 PCP 各 rank 上是复制的，因此沿输入 `K` 维在本地分片算出部分和，再在 PCP 组内 All-Reduce 恢复原来的 TP-local 结果。若启用 TP 且该层满足 `reduce_results` 且 `tp_size > 1`，随后还会再做一次 TP 组内 All-Reduce（PCP 归约并不替代 TP 归约）。

未量化整数示意（`PCP = 2`）：输入向量为 `[1, 2, 3, 4]`，单个输出的完整权重为 `[10, 20, 30, 40]`。decode 时 rank 0 用前两项算 $1 \times 10 + 2 \times 20 = 50$，rank 1 用后两项算 $3 \times 30 + 4 \times 40 = 250$，PCP 组内 All-Reduce 相加得 `300`，与完整点积数学等价（因浮点归约次序和量化计算路径变化，不保证逐位一致）。

## 通信代价、硬约束回退机制与版本与 GLM 边界

- **通信代价的权衡**：decode 侧多一次 PCP 组内 All-Reduce（数据量是 hidden 维输出张量，随 token 数增长）；prefill 侧多一次 PCP 组内权重 All-Gather（数据量固定为权重本身，与 token 数无关）。因此 batch 小且 prefill 频繁的场景最吃亏，固定权重 gather 成本难以摊薄。
- **整除约束、量化接口约束与两代回退行为**：核心前提是 SFA-PCP 满足 `input_size_per_partition % pcp_size == 0`（DSA-PCP 要求本地组数 `n_local_groups` 能被 PCP 整除），且对应线性方法实现 `WeightSwitchMixin` 且 `supports_weight_switch` 为真（重复安装同一层 loader 会报 `Loader-time weight sharding has already been installed`）。不满足时的处理随版本演化：

| 版本 / 快照 | 约束失败时的行为 | 说明 |
| --- | --- | --- |
| 早期 `baa023ad`（默认 `False`） | 直接抛 `RuntimeError`，**不降级** | 仅覆及 SFA-PCP |
| `v0.30.0`（`c09d3e20`，默认 `True`） | SFA-PCP 与 DSA-PCP 在前置检查失败时打告警并**回退为未切分权重** | 后续安装 loader 仍在异常捕获之外，物理形状或 loader 不满足要求时仍可报错 |
| `main`（`8d6180e2`，默认 `True`） | SFA-PCP（迁入 `sfa_v1.py`）与 DSA-PCP（`dsa_cp.py`）统一收拢至 `ParallelOProjection.prepare_weight_load()`，直接捕获 `(RuntimeError, ValueError)` 并告警回退未切分权重 | 「默认 `True`」不保证每种量化方法最终都启用分片 |

- **runner、旧 DSA-CP 与 PCP+DCP 边界**：`v0.30.0` 与 `main` 均要求 V2 model runner 才允许 `PCP > 1`。未启用 PCP 或早期走旧 DSA-CP 时不触发本开关的加载期分片（旧 DSA-CP 的 `full_o_proj` 演化见 [layer_sharding](layer-sharding.md)）。此外，`PCP+DCP` 变体虽继承同一权重切换机制，但叠加后的完整 prefill/decode 路径仍待独立核验，不能仅凭继承关系推定组合完全兼容。
- **放到 GLM 双机（`db701c1f` 固定基线）**：该部署 `PCP = 1`、`DCP = 1`，且固定快照 `db701c1f` 尚无本键；同时 GLM 的 34 层 KDA 在 `PCP > 1` 的 prefill 路径直接抛出 `NotImplementedError`，开启 PCP 并非这份代码的可用方案（详见 [CP 页 GLM 一节](../concepts/context-parallel.md#放到-glm-双机这套部署开了-cp-吗)）。11 层稀疏 MLA 的投影仍按 TP8 行切（形状见 [TP 页](../concepts/tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)），不能拿 GLM 主线数字代替本开关的效果。

## 对照源码

下表汇总 `enable_pcp_o_proj_weight_sharding` 在四个基线版本的默认值与后端覆盖范围，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认值 | 无（`.get()` 忽略）[C17] | 无（`.get()` 忽略）[C16] | `bool = True` [C45] | `bool = True` [C49] | 早期 `baa023ad` 曾默认 `False`，`v0.30.0` 起改为默认开启 |
| 覆盖后端与实现位置 | 无 `weight_switch/` | 无 `weight_switch/` | SFA-PCP（`sfa_cp.py`）+ DSA-PCP `wo_a`/`wo_b`（`dsa_cp.py`）[C46][C47] | 统一经 `ParallelOProjection`（`sfa_v1.py` / `dsa_cp.py`）[C50][C51] | 旧 `enable_dsa_cp` 路径不消费本键；`main` 捕获 `prepare_weight_load` 异常并回退 [D] |
| PCP 运行前提 | — | — | 要求 V2 model runner [C48] | 同 `v0.30.0` [C52] | 不支持的方法或维度不整除会告警退回未切分 [!] |

- **配置声明、缓存与历史快照**：`v0.30.0` 与 `main` 定义及未知键校验见 `c09d3e20:ascend_config.py#L581`（来源 45）、`8d6180e2:ascend_config.py#L674`（来源 49）；缓存清理、布尔转换单测与官方文档见 `utils.py#L1509-L1537`、`test_ascend_config.py#L1281-L1295`、`ascend_config.py#L1689-L1709` 与 `additional_config.md#L77`（来源 1–3、11–15、23、39）[S12]。
- **加载期缩片、缓冲池与通信路径**：SFA-PCP 与 `weight_switch` 详见 `sfa_cp.py`（来源 4–7、35、46）、`weight_switch/linear.py` 与 `o_proj.py`（来源 8–10、31、40–41）、`dsa_cp.py`（来源 36–37、47、51）与 `main` `sfa_v1.py#L912-L936`（来源 50）；`sfa_cp.py#L147-L153`（来源 6）先执行 PCP 组求和，仅当 `reduce_results` 且 TP > 1 时继续 TP 组求和；`platform.py` V2 runner 限制见来源 42、48、52；GLM KDA 拒绝 `PCP > 1` 见 `db701c1f:ops/kimi_kda.py#L390-L403`（来源 43）[D]。
- **待核**：常驻 `1/pcp_size`、净省估式与小批 prefill 权重 gather 摊薄代价均为按切法推导，本仓库缺目标 NPU 的实际显存、时延对照与 `PCP+DCP` 组合端到端实测。

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
