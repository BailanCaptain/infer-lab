---
id: multistream-engram-overlap-29113aa3f8fc
title: multistream_engram_overlap
type: param
summary: multistream_engram_overlap 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-10-08'
sources:
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L573
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L560
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L569
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L570
  - >-
    vllm-ascend@ee29cc6fc24d20d47948776764059f05601170a6:vllm_ascend/ascend_config.py#L571
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L575
  - >-
    vllm-ascend@acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe:vllm_ascend/ascend_config.py#L574
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-921fbe7716cbd40fb8e821e8e7a64041b9406e2d298949703847854e5f605d34.md
  - >-
    raw/sha256-bfacc19702472408b9807eb9cbb7828d3e09d484fa40fe4128d3fa847cc446fa.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 一句话

**v0.30.0rc2 对照：** 已提供此键，默认依硬件画像而定：FP8_OPTIMIZED 为 True，其余为 False，用户可显式覆盖。DeepSeek V4.1 将它用于 Engram 哈希、查表和 DP/TP 交换的副流准备，但哈希与状态对象仍要求模型确实启用 Engram。不能把硬件相关的默认写成所有设备都开，也不适用于本站无 Engram 的旧 GLM 算例。

骨架，待补：multistream_engram_overlap 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["multistream_engram_overlap"]` |
| 类型 | `bool` |
| 默认表达式 | `dataclasses.field(default_factory=lambda: get_current_hardware_profile().device_adaptor_family == DeviceAdaptorFamily.FP8_OPTIMIZED)` |
| 定义 | `vllm_ascend/ascend_config.py:574` [C7] |
| 版本 | main · acbab0ef0722f0a1aab7e6a4ac90c6c93f888efe |

字段注释：

Prepare Engram hashes, lookups and DP/TP exchanges on an auxiliary stream; FULL graphs wait on descriptor-specific external events at consumers. Default to overlap on A5 only; explicit settings override this policy.

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
| releases/v0.30.0 | 有（2 个文件） |
| releases/v0.30.0rc2 | 有（2 个文件） |
| releases/v0.31.0rc | 有（2 个文件） |
| main | 有（2 个文件） |

- **引入**：2026-10-08 · 6fd763c2844f22c7355e5442a4f2e64c8e68e6d2 · PR [#17927](https://github.com/vllm-project/vllm-ascend/pull/17927) —— [Feature][Model] Add DeepSeek V4.1 support and execution optimizations on Ascend A5 (#17927)
  包含该提交的 tag：v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/main、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/zxy_fix_boradash
  - `vllm_ascend/models/deepseek_v41/engram/hash_state.py` +5 / −150（文本行变化）
  - `vllm_ascend/attention/dsa_v41.py` +464 / −130（文本行变化）
  - `vllm_ascend/models/deepseek_v41/engram/npu.py` +14 / −99（文本行变化）
  - `vllm_ascend/models/deepseek_v41/model.py` +440 / −95（文本行变化）
  - `vllm_ascend/models/deepseek_v41/indexer.py` +97 / −34（文本行变化）

当前含该标识符的 tag：v0.30.0、v0.30.0rc1、v0.30.0rc2
