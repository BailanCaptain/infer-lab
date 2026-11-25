---
id: gdn-internal-prefill-checkpoints-50f5ac80d583
title: gdn_internal_prefill_checkpoints
type: param
summary: gdn_internal_prefill_checkpoints 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-11-12'
sources:
  - >-
    vllm-ascend@e8ae04b5c29f0d69b9dd729cbe838215e451045e:vllm_ascend/ascend_config.py#L718
  - >-
    vllm-ascend@775899991f9614052e4836a62e4cb6541897faee:vllm_ascend/ascend_config.py#L741
  - >-
    vllm-ascend@a38556f69529595e70598d0d6203009f5ac3293e:vllm_ascend/ascend_config.py#L774
  - >-
    vllm-ascend@9b8c54e0d189f34259ab5112f2378ccf558a4e18:vllm_ascend/ascend_config.py#L774
rawSources:
  - >-
    raw/sha256-2d13f8c316437a6c76d3586c7c71adb5b9fd8ee8754b97fa101e88fdb28b6374.md
  - >-
    raw/sha256-81685fcf969928dd82668d18ecb202fda0d397667b8b8130345c5faf03886bde.md
  - >-
    raw/sha256-8b62fbf64500d54cd80faa70070cb10e16f3058f0af1c12e30b99970d02309e0.md
  - >-
    raw/sha256-dc561029278178cdc9222d8f07a7cbac8503b71b01ca3817fe405738fd14fd7d.md
---
## 一句话

骨架，待补：gdn_internal_prefill_checkpoints 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["gdn_internal_prefill_checkpoints"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:774` [C4] |
| 版本 | main · 9b8c54e0d189f34259ab5112f2378ccf558a4e18 |

字段注释：

---- derived fields: sentinel default, after-validator overwrites ---- This switches the prefill recurrence; keep opt-in until cold/cache-hit numerical equivalence and performance are qualified on supported NPUs.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

静态事实见上方自动生成区；行为与版本差异待核对。

## 为什么存在

骨架，待补：为什么存在。

## 开了的代价

骨架，待补：开了的代价与互斥关系。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.gdn_internal_prefill_checkpoints` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| releases/v0.13.0 | 无 | `f92eadfc` |
| releases/v0.18.0 | 无 | `35b0fdf7` |
| releases/v0.20.2rc | 无 | `792ea0c6` |
| releases/v0.21.0rc | 无 | `b4884b42` |
| releases/v0.22.1rc | 无 | `6fb87d07` |
| releases/v0.23.0 | 无 | `c399628f` |
| releases/v0.24.0rc | 无 | `b19127c7` |
| releases/v0.25.1rc | 无 | `73953fc0` |
| releases/v0.26.0rc | 无 | `b98aab21` |
| releases/v0.27.1rc | 无 | `0ce12444` |
| releases/v0.28.0rc | 无 | `96df6231` |
| releases/v0.29.0rc | 无 | `b3d3bb68` |
| releases/v0.30.0 | 无 | `07fab1a6` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.31.0rc | 无 | `5e40bc72` |
| releases/v0.32.0rc | 无 | `ec59279f` |
| releases/v0.33.0rc | 有 | `c64ace67` |
| main | 有 | `9b8c54e0` |
