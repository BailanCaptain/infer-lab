---
id: library-path-9522b077c0b2
title: library_path
type: param
summary: library_path 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-11-13'
sources:
  - >-
    vllm-ascend@775899991f9614052e4836a62e4cb6541897faee:vllm_ascend/ascend_config.py#L460
rawSources:
  - >-
    raw/sha256-81685fcf969928dd82668d18ecb202fda0d397667b8b8130345c5faf03886bde.md
---
## 一句话

骨架，待补：library_path 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["shared_engram"]["library_path"]` |
| 类型 | `str \| None` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:460` [C1] |
| 版本 | main · 775899991f9614052e4836a62e4cb6541897faee |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if isinstance(options, dict) and options.get('backend') == 'a3':
    defaults = {'capacity': 65536, 'library_path': None, 'listen_port': None, 'local_comm_res': None}
    if any((name in options and options[name] != default for name, default in defaults.items())):
        raise ValueError('A3 does not accept A2/A5 shared Engram options')
````

## 事实表

静态事实见上方自动生成区；行为与版本差异待核对。

## 为什么存在

骨架，待补：为什么存在。

## 开了的代价

骨架，待补：开了的代价与互斥关系。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `SharedEngramConfig.library_path` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| releases/v0.30.0 | 无 | `4113fd86` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.31.0rc | 无 | `5e40bc72` |
| releases/v0.32.0rc | 无 | `39955127` |
| main | 有 | `77589999` |
