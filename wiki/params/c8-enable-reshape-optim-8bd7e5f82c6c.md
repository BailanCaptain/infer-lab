---
id: c8-enable-reshape-optim-8bd7e5f82c6c
title: c8_enable_reshape_optim
type: param
summary: c8_enable_reshape_optim 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-09-20'
sources:
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L526
rawSources:
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
---
## 一句话

骨架，待补：c8_enable_reshape_optim 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["c8_enable_reshape_optim"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:526` [C1] |
| 版本 | main · c173a64a44dec4ba97aaba6277b1dfc1562eda19 |

字段注释：

See https://github.com/vllm-project/vllm-ascend/issues/15896

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
| releases/v0.21.0rc | 有（2 个文件） |
| releases/v0.22.1rc | 有（2 个文件） |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.24.0rc | 有（2 个文件） |
| releases/v0.25.1rc | 有（2 个文件） |
| releases/v0.26.0rc | 有（2 个文件） |
| releases/v0.27.1rc | 有（2 个文件） |
| releases/v0.28.0rc | 无 |
| main | 有（1 个文件） |

- **引入**：2026-06-10 · a53f8a023016219a3d5246a881d74d4d8d892f0c · PR [#10292](https://github.com/vllm-project/vllm-ascend/pull/10292) —— [Feature] add ascendc ops store_kv_block (#10292)
  包含该提交的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/attention/sfa_v1.py` +51 / −10（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +3 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −0（文本行变化）
  - `vllm_ascend/attention/utils.py` +4 / −0（文本行变化）
  - `vllm_ascend/spec_decode/llm_base_proposer.py` +3 / −0（文本行变化）
- **移除**：2026-09-07 · c30092741be0829dfb387103a32f433f5c0ecb5c · PR [#15752](https://github.com/vllm-project/vllm-ascend/pull/15752) —— [Refactor] Auto-enable LI C8 reshape optimization (#15752)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/ascend_config.py` +21 / −10（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +2 / −2（文本行变化）
- **引入**：2026-09-20 · 1e0742722d149b99f91ece504180aa9bdf8b69af · PR [#16952](https://github.com/vllm-project/vllm-ascend/pull/16952) —— [Misc][Config] Restore C8 reshape optimization switch (#16952)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ascend_config.py` +7 / −3（文本行变化）

当前含该标识符的 tag：v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2
