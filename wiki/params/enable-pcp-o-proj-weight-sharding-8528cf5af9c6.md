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
  - additional_config.enable_pcp_o_proj_weight_sharding
  - enable_pcp_o_proj_weight_sharding
legacyAnchors:
  一句话: 它怎么在 PCP 组内切 o_proj，和旧 layer_sharding 有何不同？
  为什么存在: 加载期缩片、prefill gather 与 decode all-reduce 的分工
  开了的代价: 通信代价、回退机制与部署边界
  通信代价硬约束回退机制与版本与-glm-边界: 通信代价、回退机制与部署边界
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
  - to: model-runner-v2
    kind: builds-on
    note: v0.30.0 与 main 仅在 V2 model runner 下允许开启 PCP > 1，从而触发 o_proj / wo_a / wo_b 加载期权重分片
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
  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/dsa_v41.py#L782-L803'
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

这个开关把每张卡重复存的输出投影权重再切一刀：平时每卡只留 `1 / pcp_size` 分片，Prefill 需要完整矩阵时临时拼齐，Decode 则各算本地切片再合并部分和。开启 PCP（[Context Parallel](../concepts/context-parallel.md) 的预填充并行）后，序列虽已沿 token 维分给多张卡，但注意力输出投影（`o_proj` / `wo_a` / `wo_b`）默认仍按 TP 复制给 PCP 组里每张卡；对 DeepSeek-V3.2 等模型，这是注意力层里最大的一块重复权重。

**与旧 `layer_sharding` 及旧 DSA-CP 的区别**：
- [layer_sharding](layer-sharding.md)（已于 `v0.24` 移除）按层号把不同层的整份权重轮流存到不同卡上，并接收自定义层名列表。本键则是**把同一层的输出投影沿 PCP 域再切一刀**，不接受任意层名列表（跨 DP 的投影切分另由细粒度 TP 控制）。
- `v0.30.0` 与 `main` 均把本键默认设为 **`True`**（早期 `baa023ad` 默认 `False`），覆盖 **SFA-PCP** 的 `o_proj` 与 **DSA-PCP** 的两级输出投影（`wo_a` / `wo_b`）；`main` 还在 DeepSeek V4.1 的 DSA 注意力（`dsa_v41.py`）试跑预热与输出投影路径中接入了底层 `projector` 的这一开关。常规长序列 PCP 部署保持默认 `true` 即可省下输出投影显存；仅当小批短序列 prefill 极其密集、每次整层权重 All-Gather 难以摊薄或做对照排障时，才显式传 `false`。注意这里的 **DSA-PCP** 是 PCP 后端，**不是** `enable_dsa_cp` 控制的旧 DSA-CP（后者走 `enable_dsa_cp_full_o_proj()`，不读取本键）。

## 事实表

在 `v0.30.0` / `main` 开启 `PCP > 1` 前，可按以下维度核对本开关的生效范围、显存净省与回退行为：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["enable_pcp_o_proj_weight_sharding"]`（`bool = True`） | `v0.30.0` 与 `main` 默认开启；读取函数缓存结果，已加载权重不支持运行期热切换 |
| 生效模型与运行前提 | SFA-PCP、DSA-PCP（`main` 含 V4.1 DSA 挂载点）、`PCP > 1` 且启用 [Model Runner V2](../concepts/model-runner-v2.md) | 普通稠密/GQA 模型、`PCP = 1` 或旧 `enable_dsa_cp` 路径均不进入本逻辑 |
| 常驻显存与复用池 | 每卡仅常驻 `1 / pcp_size` 分片，完整 gather 缓冲挂在 `o_proj_full_pools` 按规格复用 | 同构层示意净省约为 `(1 - 1/PCP) × 单层 × 层数 - 1 份全量缓冲`（不同规格池键另计） |
| prefill / decode 分叉 | prefill 临时在 PCP 组内 All-Gather 完整权重；decode 算本地片再做 PCP All-Reduce | 小批频繁 prefill 需反复搬运固定大小权重；decode 则只归约与 token 数成正比的输出向量 |
| 整除与量化回退 | 要求本地分区输入维（或组数）可被 `pcp_size` 整除且量化方法支持 `WeightSwitchMixin` | `v0.30.0` 与 `main` 在前置条件不满足时打印告警并自动回退为未切分权重（早期 `baa023ad` 直接抛错） |
| 历史版本行为 | PR #14814 引入；`v0.23.0`、`v0.26.0rc` 与 GLM `db701c1f` 均无此键 | 旧分支静默忽略；`v0.30.0` / `main` 严格校验键名拼写 |

## 加载期缩片、prefill gather 与 decode all-reduce 的分工

```wiki-diagram
file: param-pcp-o-proj-sharding
```

核心切法沿 row-parallel 的输入维构造 `WeightSwitchConfig.from_group(get_pcp_group(), shard_axis="input")`，由两套机制保证它不是低效的「先全量加载再裁剪」：

1. **加载期直接缩片**：`prepare_layer_for_parallel_weight_load` 在 `model.load_weights` 之前把参数张量缩为 `原宽度 / pcp_size`，并替换 `weight_loader`。加载时按 `WeightLoadPartition.from_nested_groups(TP 组, PCP 组)` 直接从 checkpoint 读取本卡连续切片（V2 参数临时借用组合后的 `tp_rank` / `tp_size` 并在 `finally` 中恢复，预分片权重按形状取本地片）。这样无需先把整份 TP-local 权重装进该参数再裁切；但构造参数与其他临时缓冲仍占内存，整机加载峰值需另测。
2. **前向按阶段切换视图**：
   - **prefill 阶段**：各 PCP rank 处理不同的 token 行，不能直接把不同 token 的部分和相加。前向会先在 PCP 组内 All-Gather 拼回完整投影权重（挂在 `o_proj_full_pools` 按规格复用），算完立即把参数视图切回本地分片。
   - **decode 阶段**：decode 的输入 token 在 PCP 各 rank 上相同，各卡直接用本地分片沿输入 `K` 维算出部分和，再经 PCP 组内 All-Reduce 恢复 TP-local 结果。若启用了 TP 且满足 `reduce_results` 与 `tp_size > 1`，随后仍继续执行原有的 TP 组内 All-Reduce。

未量化整数示意（`PCP = 2`）：输入向量为 `[1, 2, 3, 4]`，单个输出的完整权重为 `[10, 20, 30, 40]`。decode 时 rank 0 用前两项算 $1 \times 10 + 2 \times 20 = 50$，rank 1 用后两项算 $3 \times 30 + 4 \times 40 = 250$，PCP 组内 All-Reduce 相加得 `300`，与完整点积数学等价。实际运行中因浮点归约次序与量化路径差异，不保证逐位一致。

## 通信代价、回退机制与部署边界

- **Prefill 与 Decode 的通信权衡**：Decode 侧多一次 PCP 组内 All-Reduce，通信量随本步 token 数线性增长。Prefill 侧多一次 PCP 组内权重 All-Gather，通信量固定等于整层投影权重，因此小批量短序列 prefill 频繁时最难摊平这笔固定开销。
- **整除约束、量化接口与版本回退差异**：SFA-PCP 要求 `input_size_per_partition % pcp_size == 0`（DSA-PCP 要求本地组数 `n_local_groups` 可被 `pcp_size` 整除），且线性层量化方法须实现 `WeightSwitchMixin` 并声明 `supports_weight_switch` 为真（同一层重复安装 loader 会抛 `Loader-time weight sharding has already been installed`）。不满足前置条件时的处理随版本演进：

| 版本 / 快照 | 约束失败时的行为 | 说明 |
| --- | --- | --- |
| 早期 `baa023ad`（默认 `False`） | 直接抛 `RuntimeError`，**不降级** | 仅覆及 SFA-PCP |
| `v0.30.0`（`c09d3e20`，默认 `True`） | SFA-PCP 与 DSA-PCP 在前置检查失败时打告警并**回退为未切分权重** | 后续安装 loader 仍在异常捕获之外，物理形状或 loader 不满足要求时仍可报错 |
| `main`（`8d6180e2`，默认 `True`） | SFA-PCP（`sfa_v1.py`）与 DSA-PCP（`dsa_cp.py`）统一收拢至 `ParallelOProjection.prepare_weight_load()`，捕获 `(RuntimeError, ValueError)` 告警回退；DeepSeek V4.1 DSA（`dsa_v41.py`）在无元数据预热及输出投影中同样复用底层 `projector` 的该开关状态 | 「默认 `True`」不保证每种量化方法最终都启用分片 |

- **Runner、旧 DSA-CP 与混合架构边界**：`v0.30.0` 与 `main` 均要求 V2 model runner 才允许 `PCP > 1`；`PCP = 1` 或走旧 `enable_dsa_cp` 路径时不触发本分片（旧 `full_o_proj` 演化见 [`layer_sharding`](layer-sharding.md)），`PCP+DCP` 叠加组合仍待独立实测。历史双机部署因 `PCP = 1` 及旧 KDA 预填充限制而不进入本路径的完整说明，见[固定双机的参数边界](../concepts/glm-5-3-flash-two-node.md#固定双机的参数边界)（TP8 行切形状见 [TP 页](../concepts/tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)）。

## 对照源码

下表汇总 `enable_pcp_o_proj_weight_sharding` 在四个基线版本的默认值与后端覆盖范围，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认值 | 无（`.get()` 忽略）[C17] | 无（`.get()` 忽略）[C16] | `bool = True` [C45] | `bool = True` [C49] | 早期 `baa023ad` 曾默认 `False`，`v0.30.0` 起改为默认开启 |
| 覆盖后端与实现位置 | 无 `weight_switch/` | 无 `weight_switch/` | SFA-PCP（`sfa_cp.py`）+ DSA-PCP `wo_a`/`wo_b`（`dsa_cp.py`）[C46][C47] | 统一经 `ParallelOProjection`（`sfa_v1.py` / `dsa_cp.py`），V4.1 DSA 经 `dsa_v41.py` 复用 [C50][C51][C53] | 旧 `enable_dsa_cp` 路径不消费本键；`main` 捕获 `prepare_weight_load` 异常并回退 [D] |
| PCP 运行前提 | — | — | 要求 V2 model runner [C48] | 同 `v0.30.0` [C52] | 不支持的方法或维度不整除会告警退回未切分 [!] |

- **配置声明、缓存与历史快照**：`v0.30.0` 与 `main` 定义及未知键校验见 `c09d3e20:ascend_config.py#L581`（来源 45）、`8d6180e2:ascend_config.py#L674`（来源 49）；缓存清理、布尔转换单测与官方文档见 `utils.py#L1509-L1537`、`test_ascend_config.py#L1281-L1295`、`ascend_config.py#L1689-L1709` 与 `additional_config.md#L77`（来源 1–3、11–15、23、39）[S12]。
- **加载期缩片、缓冲池与通信路径**：SFA-PCP 与 `weight_switch` 详见 `sfa_cp.py`（来源 4–7、35、46）、`weight_switch/linear.py` 与 `o_proj.py`（来源 8–10、31、40–41）、`dsa_cp.py`（来源 36–37、47、51）及 `main` 的 `sfa_v1.py#L912-L936`、`dsa_v41.py#L782-L803`（来源 50、53）；`sfa_cp.py#L147-L153`（来源 6）先执行 PCP 组求和，仅当 `reduce_results` 且 TP > 1 时继续 TP 组求和；`platform.py` V2 runner 限制见来源 42、48、52；GLM KDA 拒绝 `PCP > 1` 见 `db701c1f:ops/kimi_kda.py#L390-L403`（来源 43）[D]。
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
