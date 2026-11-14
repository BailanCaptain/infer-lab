---
id: kv-pool-range-debug-83e8b165addd
title: kv_pool_range_debug
type: param
summary: kv_pool_range_debug 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-10-25'
sources:
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@30ce5af06cb89f941e98c5a6a5b56c30d9938006:vllm_ascend/ascend_config.py#L579
  - >-
    raw:sha256-07156a7238cda1addec0d0fcea21e118eda3ce8d4c3f7fcee5645259812ffc43.md#L1-L3
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L583
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L582
rawSources:
  - >-
    raw/sha256-07156a7238cda1addec0d0fcea21e118eda3ce8d4c3f7fcee5645259812ffc43.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-bfacc19702472408b9807eb9cbb7828d3e09d484fa40fe4128d3fa847cc446fa.md
  - >-
    raw/sha256-ca9a84111a41a3b9f040cdb3251cd2b13e2c00cf22725addb31dac226c9bc3b0.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
---
## 一句话

**v0.30.0rc2 对照：** 不提供此用户字段或运行时消费点；其他 main 扫描快照的定义不能当作 rc2 的调试功能。传入顶层 additional_config 时通常拒收，vllm_omni 特例告警过滤，启动成功也不表示此开关已生效。下面的输出内容和默认值保持原扫描版本范围。

骨架，待补：kv_pool_range_debug 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["kv_pool_range_debug"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:582` [C5] |
| 版本 | main · acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

静态事实见上方自动生成区；行为与版本差异待核对。

## 为什么存在

骨架，待补：为什么存在。

## 开了的代价

骨架，待补：开了的代价与互斥关系。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| releases/v0.30.0 | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.31.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-10-19 · 0301f7ec2d6d00ac5efad45c71c8fe0b5ce69541 · PR [#19170](https://github.com/vllm-project/vllm-ascend/pull/19170) —— [Refactor][KV Pool] Migrate KVPOOL_RANGE_DEBUG toggle to additional_config (#19170)
  包含该提交的 tag：未找到；分支：origin/arc-fedsched-e2e-lab、origin/main、origin/releases/v0.31.0rc、origin/zxy_fix_boradash
  - `vllm_ascend/envs.py` +0 / −10（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py` +3 / −3（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py` +2 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 对照源码

### 源码位置

来源 1 的 ee29cc6f `ascend_config.py` 578 行已核对，仅声明布尔字段及静态默认 False。本轮归档没有注释、设计说明或读取分支，不能仅凭名字认定它检查什么范围。

待核：哪些代码读取该字段、诊断对象、启用方式、启动时是否覆盖默认值，以及值为真时的检查、输出、日志、同步和内存访问；性能开销、副作用与互斥关系也缺实际分支证据。此轮没有部署或设备验证，旧骨架的用途与机制仍待补齐。
