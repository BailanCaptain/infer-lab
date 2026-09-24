---
id: block-table-no-commit-optimize-8328d0d2d00d
title: block_table_no_commit_optimize
type: param
summary: block_table_no_commit_optimize 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-09-23'
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L514
rawSources:
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

骨架，待补：block_table_no_commit_optimize 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["block_table_no_commit_optimize"]` |
| 类型 | `Literal[0, 1]` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:514` [C1] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

字段注释：

MRv1 only: 0 uses dirty-range commits; 1 restores a full-table H2D copy.

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
| a71b766ce6fc0a9669a412e15a5cf53f7f827093 | 无 |
| 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f | 有（2 个文件） |

- **引入**：2026-09-23 · ad7a731b9c0db2592bbe1f568a776207745017ed · PR [#17066](https://github.com/vllm-project/vllm-ascend/pull/17066) —— [Performance][MRV1] Commit only dirty block-table ranges (#17066)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/worker/block_table.py` +124 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +3 / −0（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +43 / −0（文本行变化）

当前含该标识符的 tag：未找到
