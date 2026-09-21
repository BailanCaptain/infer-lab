---
id: shard-axis-036e26ba7f4b
title: shard_axis
type: param
summary: shard_axis 的静态定义，正文待补。
origin: seed
verified: ["main"]
evidence: C
updated: '2026-09-19'
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/weight_switch/linear.py#L52
rawSources:
  - >-
    raw/sha256-1582d6e98f9bda4bd5beee173e02581c418b88eeb5474cfd66b2952dc051a31e.md
---
## 一句话

骨架，待补：shard_axis 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["shard_axis"]` |
| 类型 | `Literal['input', 'output'] \| None` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/weight_switch/linear.py:52` [C1] |
| 版本 | main · b255ab59662d8c665e5534e926f913b1c1179b1c |

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
| releases/v0.27.1rc | 有（1 个文件） |
| releases/v0.28.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-08-07 · a533aed9815e1ba638a1aa5254f0fb11c15df4fd · PR [#12982](https://github.com/vllm-project/vllm-ascend/pull/12982) —— [Refactor][DSA] Move TP weight switching into quantization methods (#12982)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/megakernel
  - `vllm_ascend/attention/context_parallel/dsa_cp.py` +128 / −130（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +56 / −129（文本行变化）
  - `vllm_ascend/quantization/methods/base.py` +38 / −3（文本行变化）
  - `vllm_ascend/attention/context_parallel/sfa_cp.py` +0 / −2（文本行变化）
  - `vllm_ascend/quantization/compressed_tensors_config.py` +3 / −2（文本行变化）

当前含该标识符的 tag：未找到
