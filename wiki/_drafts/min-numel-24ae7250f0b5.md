---
id: min-numel-24ae7250f0b5
title: min_numel
type: param
summary: min_numel 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-11-10'
sources:
  - >-
    vllm-ascend@e4d533d33211f0696bcdf65eda47245d52e428c5:vllm_ascend/ascend_config.py#L424
rawSources:
  - >-
    raw/sha256-b909f1f174d8a217b935475955f0945cdb5b6c1d34c00325d86952e2d862804e.md
---
## 一句话

骨架，待补：min_numel 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["quantized_all_reduce_config"]["min_numel"]` |
| 类型 | `int` |
| 默认表达式 | `16777216` |
| 定义 | `vllm_ascend/ascend_config.py:424` [C1] |
| 版本 | main · e4d533d33211f0696bcdf65eda47245d52e428c5 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if value < 1:
    raise ValueError('additional_config.quantized_all_reduce_config.min_numel must be >= 1')
````

## 事实表

静态事实见上方自动生成区；行为与版本差异待核对。

## 为什么存在

骨架，待补：为什么存在。

## 开了的代价

骨架，待补：开了的代价与互斥关系。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `QuantizedAllReduceConfig.min_numel` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| releases/v0.30.0 | 无 | `00f74f23` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.31.0rc | 无 | `5e40bc72` |
| releases/v0.32.0rc | 无 | `24487f4f` |
| main | 有 | `e4d533d3` |
