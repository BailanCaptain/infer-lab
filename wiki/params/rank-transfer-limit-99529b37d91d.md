---
id: rank-transfer-limit-99529b37d91d
title: rank_transfer_limit
type: param
summary: rank_transfer_limit 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-09-26'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L222
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

骨架，待补：rank_transfer_limit 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:222` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.rank_transfer_limit != -1 and self.rank_transfer_limit < 1:
    raise ValueError('stair_config.rank_transfer_limit must be -1 or positive')
````

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
| main | 有（2 个文件） |

- **引入**：2026-09-26 · eb31db4d75622a8043703d2cbb55e9df75e70f98 · PR [#17512](https://github.com/vllm-project/vllm-ascend/pull/17512) —— [Feature][EPLB] Add constrained STAIR placement (#17512)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/distributed/eplb/policy/stair.py` +829 / −7（文本行变化）
  - `vllm_ascend/ascend_config.py` +11 / −5（文本行变化）

当前含该标识符的 tag：未找到
