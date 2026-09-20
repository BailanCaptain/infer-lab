---
id: use-fused-overlap-75a180fff6ab
title: use_fused_overlap
type: param
summary: use_fused_overlap 的静态定义，正文待补。
origin: seed
verified:
  - main
evidence: C
updated: '2026-09-19'
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/ascend_config.py#L1468
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L1478
rawSources:
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

骨架，待补：use_fused_overlap 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["use_fused_overlap"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:1478` [C2] |
| 版本 | main · c173a64a44dec4ba97aaba6277b1dfc1562eda19 |

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
| b255ab59662d8c665e5534e926f913b1c1179b1c | 有（3 个文件） |
| c173a64a44dec4ba97aaba6277b1dfc1562eda19 | 有（3 个文件） |

- **引入**：2026-09-07 · 1493369b754840da75c117651b50034a4cc7ae2d · PR [#14957](https://github.com/vllm-project/vllm-ascend/pull/14957) —— [Feature][Attention] Add fused sparse attention overlap decode support for Ascend SFA KV offload (#14957)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp` +0 / −336（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py` +498 / −40（文本行变化）
  - `vllm_ascend/attention/sfa_kv_offload.py` +687 / −1（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −0（文本行变化）

当前含该标识符的 tag：未找到
