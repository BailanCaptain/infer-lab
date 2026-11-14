---
id: kvpp-config-0445bd352140
title: kvpp_config
type: param
summary: >-
  AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进
  additional_config 会被静默剔掉。固定 main 与 rc2 有此派生对象；旧 GLM 部署没有。rc2 新增 PIECEWISE
  与固定候选数 mtp/dspark 组合，仍须满足完整 KVPP 检查。
aliases:
  - additional_config.kvpp_config
  - KVPP 配置对象
  - KVPPConfig.from_vllm_config
  - KVPP 派生子配置
chapters:
  - '11'
origin: seed
verified:
  - main
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

**v0.30.0rc2 对照：** KVPPConfig 已冻结，继续由 enable_kvpp 与 TP×PCP 派生；用户直接提交 kvpp_config 会被工厂剔除。支持边界已扩到 AscendStoreConnector 或非纯 D 角色的 MooncakeConnectorV2、eager/PIECEWISE、非 hybrid MLA，以及固定候选数的 MTP/DSpark；DCP 必须为 1。两种投机方法均拒绝按批大小改变候选数；DSpark 分支还拒绝自适应验证和设置了 method 的 dynamic_spec_config。不能只看到 size>1 就忽略这些前提。

`kvpp_config` 是 `AscendConfig` 上的一个 frozen 子配置对象，**里面只有 `size` 一个字段**，即 KVPP 那一组有几张卡。[KVPP](../concepts/kvpp.md#kvpp-是什么) 把一组卡里各存一份、内容相同的 MLA KV cache 按层分给组里的卡，每层只由一张常驻卡长期保存；层按几张卡来分，除的就是这个数。真正要记住的是：**它不是你能配的键**。工厂调 `KVPPConfig.from_vllm_config(vllm_config)` 算出它，读的是 `additional_config["enable_kvpp"]` 和 `tensor_parallel_size × prefill_context_parallel_size` [C3]，再作为关键字参数塞进 `AscendConfig`；`"kvpp_config"` 这个名字本身写在 `_NON_USER_INPUT_KEYS` 里，用户传进来的同名键在进 pydantic 之前就被丢掉了 [C5]。

**存在范围。** 固定 main `baa023ad` 与 rc2 有 KVPP，v0.23 `2c59ff10` 和 v0.26 `2ed6cbba` 没有，两个旧快照在代码和文档中检索 KVPP 均无结果 [D]。旧配置类逐键 `.get()`，不认识的键静默忽略 [C16][C15]。GLM 部署 `db701c1f` 同样没有 KVPP、沿用该旧解析方式；字段的引入记录见「版本谱系」，rc2 的支持组合见本页开头。

这一页只讲这个字段本身：谁给它赋值、谁读它、配错了会怎样。KVPP 省的是什么、每层广播多少字节、启动检查分别在拦什么，都在[概念页](../concepts/kvpp.md)。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 字段构成 | frozen `@config` 类，唯一字段 `size: int = 1` [C3] | 没有第二个旋钮——广播粒度、owner 怎么分都不可配，官方文档把这句话直接写了出来 [S13] |
| 谁给它赋值 | `KVPPConfig.from_vllm_config(vllm_config)` | 值是**算出来**的不是读出来的；用户往 `additional_config["kvpp_config"]` 写这条路径不通，所以扫描器现在也不把它当用户参数 [!] |
| `enable_kvpp` 为假时 | `cls()`，即 `size = 1` | 默认路径上它恒等于 1，整套机制等于不存在 |
| `enable_kvpp` 为真时 | `size = tensor_parallel_size × prefill_context_parallel_size` [C3] | TP=1、PCP=1 的单卡上开了也还是 1，什么都不会发生 |
| 写进 `additional_config` | 被 `_NON_USER_INPUT_KEYS` 过滤，没有针对该键的告警 [C6] | main 上其他未知键通常被 `extra="forbid"` 拒收；能发现 vllm_omni 模块时改为告警后丢弃。这个派生键先被过滤，不能覆盖计算结果 |
| 生效阈值 | `size > 1`，部分入口以 `size <= 1` 提前返回表达同一条件 | 校验、建 `kvpp` 通信组、换 KV cache 分配路径，三件事挂的是同一个阈值 |
| 校验时机 | `size > 1` 才调 `validate()` | main 的七条 KVPP `ValueError` 在 `size == 1` 时跳过；输入布尔校验与服务其他检查仍会执行 |
| 重复计算 | main `baa023ad` 上 7 处各自 `from_vllm_config` 一遍，另 3 处读单例 | 它必须是纯推导：配置工厂、platform 启动检查、worker、层划分等处各算一次，结果必须一样 |
| 覆盖版本 | 固定 main 与 rc2 有；此前 v0.28.0rc / v0.29.0rc 分支也包含 | v0.23 / v0.26 和 GLM `db701c1f` 没有 KVPP，rc2 的组合约束见本页开头 |
| GLM 双机（TP8、PCP1） | 钉住版本里没有；换到 main 写 `enable_kvpp: true`，算出 `size = 8` | 过不了启动检查，见下文「开了的代价」末段 |

## 为什么存在

**统一推导规则，能让配置工厂和运行组件使用同一个组大小。** 这个类方法只读取传入的 vllm_config，不要求调用者先取 AscendConfig 单例。main `baa023ad` 的配置工厂、platform 校验、worker 预算、层归属函数、KV 池 worker，以及新版 runner 的缓存分配和运行时构造共 7 处调用它；另有 3 处从 AscendConfig 读取已有结果。不能把这 7 处都解释成“拿不到单例”：worker 在同一函数后面就读取了 get_ascend_config。源码能确定的是这些入口复用同一推导规则，而不是每处调用的设计动机。

`size > 1` 这一个条件同时打开三件事。这里只说它们读这个数，各自怎么做在概念页：

- **建组**：建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`——这条断言等于把上面那条乘法又钉了一次 [C8]；组里的卡怎么排见概念页的[怎么开](../concepts/kvpp.md#怎么开)。
- **分层**：层按这个数分给组里的卡，除不尽时前几张卡各多拿一层 [C12]；怎么分、每卡留多少显存见[层怎么分](../concepts/kvpp.md#层怎么分每张卡要留多少显存)。
- **换分配路径**：model runner 改走 `allocate_kvpp_cache`，并把 `hybrid_with_attn_and_mamba` 置回 `False` [C10]；Mooncake worker 则用层-owner 映射过滤要发布的缓存元数据，只保留本 rank 常驻的目标层和未参与分层的 MTP 缓存，避免发布其他层共用的暂存地址 [C11]。算到某层时历史怎样到位，见[概念页这一节](../concepts/kvpp.md#算到某一层时历史怎样到位)。

## 开了的代价

**它没有「开」这个动作，真正的开关是 `enable_kvpp`。** 启动命令里该写的是 `--additional-config '{"enable_kvpp": true}'`。固定 main 指南配合 `--enforce-eager`，并说明不需要配置广播粒度或独立的 KVPP 并行大小 [S13]。[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html) 会继续更新，其新组合不能直接套到本页固定 main 或 rc2。

**配了 `kvpp_config` 的下场是「什么都不发生」，而且比报错更难查。** main 上的 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，写错一个键通常会让进程起不来；但 `kvpp_config` 在进 pydantic 之前就被过滤掉了 [C6]，所以

```bash
# 满足模型、硬件及其他启动条件时，KVPP 采用 size=8；传入的 size=4 被忽略
vllm serve <非混合的 MLA 模型> --tensor-parallel-size 8 --enforce-eager \
    --additional-config '{"enable_kvpp": true, "kvpp_config": {"size": 4}}'
```

派生的 `size` 是 8（TP × PCP），不是 4；过滤这项输入的代码没有专门记录告警 [!]。

**`size` 落在 1 上，KVPP 专属检查会被跳过。** 固定 main 的 `validate()` 中七条 `ValueError`（DCP 不为 1、连接器不对、decode 侧没关、没给 `--enforce-eager`、模型不是非混合 MLA、投机方法不是 `mtp`、候选数按批大小变化）全挂在 `size > 1` 之后 [C4][C7]，逐条原文见概念页的[会报什么错](../concepts/kvpp.md#会报什么错)。TP=1、PCP=1 时，即使开关为 true，也不会启用 KVPP 建组和缓存分配路径；但开关类型校验、模型和服务的其他启动检查仍在，不能因此保证服务能启动。确认实际启用情况时，应核对派生大小及通信组。

这些检查还各有触发条件。在本页 main 快照中，只有存在 KV 传输配置且连接器不是 AscendStoreConnector 时，才检查连接器必须为 MooncakeConnectorV2，并检查角色不能为 kv_consumer；没有 KV 传输配置或使用 AscendStoreConnector 时，均跳过这两项检查。投机解码的两项检查则只在存在投机配置时执行，因此不要求必须开启 MTP；启用了按批大小变化的草拟数量时会被拒绝，这段校验没有规定固定数量应设为多少。

**按 PP stage 切、按 DP 副本分组的那几件事，也都由这一个数定死。** 组大小既然恒等于 `PCP × TP`，就意味着 KVPP 的复制域永远不跨 DP 副本、不跨 PP stage。`from_vllm_config` 里那两行注释说的就是这个：DCP 关着时，MLA 缓存在 PCP 把 KV 收齐之后各卡一样，层的归属就在这个复制域里分，不跨 DP、PP。这是设计意图，不是可调项。

这里的 DP 把不同请求或批次交给不同执行组；PP 则把模型计算分成前后阶段，让各阶段接力完成计算。

**放到 GLM 双机：这个字段只会算出 8，然后在启动检查里停下。** 本站 GLM 双机（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）钉住的 `db701c1f` 没有 KVPP，`enable_kvpp` 和 `kvpp_config` 写进去都被静默忽略。换到 main 写 `enable_kvpp: true`，TP8、PCP1 算出 `size = 8 × 1 = 8`，大于 1，于是 platform 调 `validate()`：先撞「只支持 eager」那条，补上 `--enforce-eager` 后再撞「只支持非混合 MLA」那条，建组、分层、换分配路径一样都走不到。报错原文见概念页的[会报什么错](../concepts/kvpp.md#会报什么错)，GLM 为什么过不了见概念页的 [GLM 一节](../concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)；本部署没有任何 KVPP 实测数。

旧main baa023ad仅在存在KV传输配置且连接器不是AscendStoreConnector时检查连接器与角色；投机配置非空才检查方法，并拒绝按batch改变草稿数量。外层仍要求size>1才进入validate（来源4、7）。分组边界见来源3、8；rc2放宽的图模式和新增组合按首段区分，旧GLM镜像没有这套配置。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.kvpp_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 字段身份（不代表用户输入入口） | `AscendConfig.kvpp_config` |
| 类型 | `KVPPConfig` |
| 默认表达式 | `dataclasses.field(default_factory=KVPPConfig, kw_only=True)` |
| 定义 | `vllm_ascend/ascend_config.py:636` [C33] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
