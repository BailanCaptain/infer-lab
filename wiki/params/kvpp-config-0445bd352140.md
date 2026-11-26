---
id: kvpp-config-0445bd352140
title: kvpp_config
type: param
summary: >-
  AscendConfig 上的冻结 KVPP 派生子配置，仅含 size 字段，由 enable_kvpp 与 TP×PCP 自动算出而非用户输入；直接写进
  additional_config 会被静默剔除，v0.30.0 与 main 均支持。
aliases:
  - additional_config.kvpp_config
  - KVPP 配置对象
  - KVPPConfig.from_vllm_config
  - KVPP 派生子配置
legacyAnchors:
  一句话: 为什么它是派生对象而非用户输入键？
  为什么存在: 统一推导规则与 size > 1 触发的三条链路
  开了的代价: 误写静默过滤、校验条件演变与 GLM 双机分析
chapters:
  - '11'
origin: seed
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
updated: 2026-11-19T00:00:00.000Z
relations:
  - to: kvpp
    kind: builds-on
    note: 这个对象只是 KVPP 那一套机制的开关读数，层怎么分、广播怎么发、收益与限制全在那一页
  - to: ascend-config-system
    kind: builds-on
    note: 它是工厂注入的字段而不是用户输入，能不能写、写了会怎样，由 _NON_USER_INPUT_KEYS 那条构造链决定
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L518'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L518
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L60-L77'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L79-L100'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1629-L1634'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1678'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1500-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L76-L89'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1106'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4772-L4774'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L209-L246
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L135-L159'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L97-L104'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L50'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L532
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L546
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L629
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L627
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L636
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L623
  - >-
    vllm-ascend@8194eceae4a86366bea75309baa22fea4993da8a:vllm_ascend/ascend_config.py#L627
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L636
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L637
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L639
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L640
  - >-
    raw:sha256-4a29a1b7c97c7a3eb8fadfdd1f9a86abf633d860943cd506702d276512a1f764.md#L1-L254
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L644
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L642
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L62-L111'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1834-L1912'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L636
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1603-L1608'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/kvpp.py#L22-L42'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/v2/attn_utils.py#L628-L637'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L116-L126
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L645
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L633
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L38-L38'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L64-L110'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1841-L1914'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L42-L42'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L68-L117'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1955-L2035'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-326471e2deef6c6dd5c19880de4a9327e494e50550a163b06e0edd912c13a89c.md
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-4a29a1b7c97c7a3eb8fadfdd1f9a86abf633d860943cd506702d276512a1f764.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-b0bf7c9b015725026d74fecb76f426e986e63df102a902ae4c3026d7e546bd7d.md
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
## 为什么它是派生对象而非用户输入键？

多卡部署 MLA（多头潜在注意力）模型时，同组各张卡原本都要保存一份**完全相同的全部层历史 KV cache**，显存重复占用了好几倍。[KVPP（KV Cache 流水线并行）](../concepts/kvpp.md#kvpp-是什么)把这些重复保存的层按卡分工——每一层历史 KV 只由组内一张卡常驻保存，算到哪一层再通过广播临时发给同组其他卡。`kvpp_config` 就是 `v0.30.0` 与 `main` 中 [AscendConfig](../concepts/ascend-config-system.md) 用来保存这份分工结果的内部只读对象（冻结子配置 `frozen=True`，**里面只有 `size: int = 1` 一个字段**，表示一共由多少张卡来平分各层历史 KV）。

最重要的边界是：**`kvpp_config` 不是用户填写的配置键，真正的开关是 `enable_kvpp`**。配置工厂调用 `KVPPConfig.from_vllm_config(vllm_config)`，读取 `additional_config["enable_kvpp"]`（默认为 `False`）并结合并行度自动计算 `size`，再作为关键字参数注入 `AscendConfig`；而 `"kvpp_config"` 这个名字直接列在 `_NON_USER_INPUT_KEYS` 中，用户在 `additional_config` 里硬写 `"kvpp_config": {"size": 4}` 会在进入 pydantic 校验之前就被静默剔除（没有任何针对该键的告警），既不会覆盖派生结果，也不会像其他未知顶层键那样触发 `extra="forbid"` 报错。

拿一个具体数字看它怎样工作（**示意**：设 60 层非混合 MLA 模型、无 MTP，跑在 `TP = 8, PCP = 1` 上）：
- 不开 `enable_kvpp` 时，派生出 `kvpp_config.size = 1`，8 张卡各自常驻全部 60 层历史 KV；
- 写 `"enable_kvpp": true` 后，工厂自动派生 $\text{size} = \text{TP} \times \text{PCP} = 8 \times 1 = 8$，按 `divmod(60, 8) = (7, 4)` 把层分给 8 张卡——前 4 张卡各常驻 8 层、后 4 张卡各常驻 7 层，每卡另留 2 层复用的暂存缓冲（scratch buffer），单卡单块物理占用从 60 层降到最多 $8 + 2 = 10$ 层（完整放大比与天花板见 [`kvpp_config.size`](size-40a1c2ca47b8.md)）。

## 事实表

理解 `kvpp_config` 与真正用户入口 `enable_kvpp` 的关系时，先核对下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 对象性质与真入口 | 内部冻结派生对象（唯一字段 `size: int = 1`）；用户入口为 `additional_config["enable_kvpp"]` | 不要在命令行手写 `kvpp_config`，它在 `_NON_USER_INPUT_KEYS` 中会被**静默剔除且无告警** |
| `size` 推导公式 | `enable_kvpp` 为假时 `1`；为真时 `tensor_parallel_size × prefill_context_parallel_size` | `TP=1, PCP=1` 单卡即使写 `enable_kvpp: true`，`size` 仍为 `1`，不会触发 KVPP |
| 生效与校验阈值 | 建组、分层、换缓存分配路径与 `validate()` 均以 `size > 1` 为门槛 | `size == 1` 跳过 KVPP 专属 `ValueError`（开关布尔校验及服务其他检查照常执行） |
| 模型与图模式硬前提 | 非混合 MLA 模型、`DCP == 1`、`--enforce-eager` 或 `PIECEWISE`（`v0.30.0`/`main`） | 混合注意力（如含 KDA/GDN）或整图模式（`FULL_DECODE_ONLY`）在 `size > 1` 时直接报错 |
| 版本存在范围 | `v0.30.0`、`v0.30.0rc2`、`main` 支持；`v0.23.0`、`v0.26.0rc` 与 GLM `db701c1f` 无 | 旧版配置类逐键 `.get()` 静默忽略 `enable_kvpp`；每层广播细节见 [KVPP 概念页](../concepts/kvpp.md) |

## 统一推导规则与 size > 1 触发的三条链路

```wiki-diagram
file: param-kvpp-config
```

`KVPPConfig.from_vllm_config(vllm_config)` 只依赖传入的 `vllm_config`，不要求调用方先拿到 `AscendConfig` 单例。早期 `baa023ad` 上有 7 处（配置工厂、platform 校验、worker 预算、层归属函数、KV 池 worker、新版 runner 缓存分配与运行时构造）各自调用一次该类方法，另有 3 处读单例（不能把这 7 处都概括成「拿不到单例」，因为 worker 在同一函数后文就会调 `get_ascend_config()`；源码确定的是各入口复用同一纯推导规则）。

因为 `size` 固定等于 `PCP × TP`，KVPP 的复制域天然不跨 DP 副本、也不跨 PP stage（DP 把不同请求或批次分配给不同执行组，PP 把模型分成前后阶段接力执行）：当 DCP 关闭时，MLA 缓存在 PCP 收集 KV 之后于 `PCP × TP` 域内各卡一致，层归属只在这个复制域内划分，这是设计边界而非可调项。

一旦 `size > 1`，这一条件同时打开三条链路（具体做法见概念页）：

- **建通信组**：创建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`（组内排布见[怎么开](../concepts/kvpp.md#怎么开)）。
- **按层划分归属**：把目标层按 `size` 分给组内各卡，除不尽时前几张卡各多持有一层（详见[层怎么分](../concepts/kvpp.md#层怎么分每张卡要留多少显存)）。
- **切换缓存分配与元数据发布**：model runner 改走 `allocate_kvpp_cache` 并把 `hybrid_with_attn_and_mamba` 置回 `False`；Mooncake worker 按层-owner 映射过滤对外发布的缓存元数据，仅保留本 rank 常驻目标层与未参与分层的 MTP 缓存，避免发布其他层共用的暂存地址（历史到位流程见[算到某一层时历史怎样到位](../concepts/kvpp.md#算到某一层时历史怎样到位)）。

## 误写静默过滤、校验条件演变与 GLM 双机分析

**真正的启用写法**：在 `--additional-config` 中传 `"enable_kvpp": true`（配合 `--enforce-eager` 或新版支持的 `PIECEWISE`，线上持续更新文档见 [KVPP 文档](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html)）。把 `kvpp_config` 本身写进 JSON 不会报错，而是被 `_NON_USER_INPUT_KEYS` 静默丢弃（没有专门告警），比报错更隐蔽：

```bash
# 满足模型、硬件及其他启动条件时，KVPP 仍采用 size=8（TP×PCP）；传入的 size=4 被静默忽略
vllm serve /models/DeepSeek-V3 --tensor-parallel-size 8 --enforce-eager \
    --additional-config '{"enable_kvpp": true, "kvpp_config": {"size": 4}}'
```

**`size == 1` 跳过专属检查，但 `size > 1` 仍有完整前提**：当 `TP=1`、`PCP=1` 时即使写了 `enable_kvpp: true`，派生 `size` 仍为 `1`，`validate()` 不会被调用，也不会建组或切换缓存路径（但布尔类型校验与服务其他检查照常执行；确认是否真正生效须核对派生大小与通信组）。当 `size > 1` 时，`KVPPConfig.validate()` 的校验条件随版本逐步放宽：

| 版本 / 快照 | 图模式与并行要求 | KV 连接器与投机解码约束 |
| --- | --- | --- |
| 早期 `baa023ad` | `DCP == 1`、必须 `--enforce-eager`、必须非混合 MLA | 存在 KV 传输配置且非 `AscendStoreConnector` 时仅允许非 `kv_consumer` 的 `MooncakeConnectorV2`；投机配置仅允许固定候选数的 `mtp`（共 7 条检查） |
| 过渡 `rc2`（`7d825229`） | 图模式放宽至 eager 或 `PIECEWISE` | 投机解码扩展至固定候选数的 `mtp` / `dspark`（拒绝按批大小变化候选数，DSpark 还拒绝自适应验证和设置了 `method` 的 `dynamic_spec_config`） |
| `v0.30.0`（`c09d3e20`） | `DCP == 1`、eager 或 `PIECEWISE`、非混合 MLA | 扩展支持 `MultiConnector`（逐个展开非空 `connectors` 列表）；白名单 `("MooncakeConnectorV2", "AscendStoreConnector")`，`MooncakeConnectorV2` 拒 `kv_consumer`；`validate()` 内不再硬编码投机解码拦截 |
| `main`（`8d6180e2`） | 同 `v0.30.0` | 连接器名单进一步纳入 `"MooncakePushConnector"`（同样拒绝 `kv_consumer`） |

**放到 GLM 双机（`db701c1f` 固定基线）**：该部署（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）的 `db701c1f` 快照没有 KVPP，写 `enable_kvpp` 与 `kvpp_config` 都会被旧配置类静默忽略。换到 `v0.30.0` 或 `main` 写 `enable_kvpp: true`，TP8 × PCP1 算出 `size = 8 > 1`，进入 `validate()` 后会先撞图模式检查（`FULL_DECODE_ONLY` 不在 eager/`PIECEWISE` 之列）；即使改用 `--enforce-eager` 或 `PIECEWISE`，也会在「只支持非混合 MLA」处被拒（GLM 含 KDA + MLA 混合结构），建组、分层、换分配路径均走不到（报错原文见[会报什么错](../concepts/kvpp.md#会报什么错)，详细原因见[GLM 双机一节](../concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)，本部署无 KVPP 实测数）。

## 对照源码

下表汇总 `kvpp_config` 在四个基线版本的派生对象、图模式与连接器校验对照，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| `KVPPConfig` 与 `kvpp_config` | 不存在（未知键 `.get()` 忽略）[C16] | 不存在（同左）[C15] | 冻结类，唯一字段 `size: int = 1`，由 `enable_kvpp` 与 `TP×PCP` 派生 [C41] | 同 `v0.30.0` [C44] | 用户手写 `kvpp_config` 会被 `_NON_USER_INPUT_KEYS` 静默剔除 [!] |
| 支持的图模式与模型 | — | — | eager 或 `PIECEWISE`；非混合 MLA；`DCP == 1` [C41] | 同 `v0.30.0` [C44] | 早期 `baa023ad` 仅允许 eager |
| 支持的 KV 连接器 | — | — | `MooncakeConnectorV2`（非 `kv_consumer`）、`AscendStoreConnector` 及 `MultiConnector` [C40] | 同左并新增 `MooncakePushConnector`（非 `kv_consumer`）[C43] | 无 KV 传输配置时跳过连接器检查 [D] |

- **定义、工厂过滤与版本演进**：`v0.30.0` 见 `c09d3e20:ascend_config.py#L38, #L64-L110, #L633, #L1841-L1914`（来源 39–42）[C42]；`main` 见 `8d6180e2:ascend_config.py#L42, #L68-L117, #L1955-L2035`（来源 43–45）[C45]。历史 `baa023ad` 与过渡 `rc2`（`7d825229`）校验及官方文档见来源 1–7、13–14、31–34 [S13]。
- **建组、分层与缓存分配调用链**：`parallel_state.py#L76-L89`（来源 8）、`worker.py#L1096-L1106`（来源 9）、`model_runner_v1.py#L4772-L4774`（来源 10）、`mooncake/base_worker.py#L209-L246`（来源 11）、`kv_cache_placement.py#L135-L159`（来源 12），以及 `v2/kvpp.py`、`v2/attn_utils.py`、`ascend_store/pool_worker.py`（来源 35–37）[D]。
- **待核**：本仓库无开启 KVPP 在目标 NPU 上的广播耗时、端到端时延与显存实测对比。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.kvpp_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 字段身份（不代表用户输入入口） | `AscendConfig.kvpp_config` |
| 类型 | `KVPPConfig` |
| 默认表达式 | `dataclasses.field(default_factory=KVPPConfig, kw_only=True)` |
| 定义 | `vllm_ascend/ascend_config.py:633` [C39] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
