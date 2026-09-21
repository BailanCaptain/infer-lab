---
id: enable-force-eplb-b7ec3661121f
title: enable_force_eplb
type: param
summary: enable_force_eplb 的静态定义，正文待补。
origin: seed
verified:
  - main
evidence: C
updated: '2026-09-19'
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/ascend_config.py#L466
  - >-
    vllm-ascend@c173a64a44dec4ba97aaba6277b1dfc1562eda19:vllm_ascend/ascend_config.py#L467
rawSources:
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

骨架，待补：enable_force_eplb 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_force_eplb"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:467` [C2] |
| 版本 | main · c173a64a44dec4ba97aaba6277b1dfc1562eda19 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_force_eplb and self.eplb_config.dynamic_eplb and (vc.model_config is not None) and vc.model_config.is_moe:
    raise ValueError('enable_force_eplb cannot be mixed with dynamic_eplb.')
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
| releases/v0.28.0rc | 有（3 个文件） |
| main | 有（3 个文件） |

- **引入**：2026-09-02 · 2825e368b0ee0cd5ecfddc075cee92be658508f9 · PR [#15499](https://github.com/vllm-project/vllm-ascend/pull/15499) —— [Feature] add force EPLB Feature through additional config (#15499)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor、origin/rfc/megakernel
  - `vllm_ascend/ops/fused_moe/routed_experts.py` +4 / −4（文本行变化）
  - `vllm_ascend/ascend_config.py` +9 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/force_eplb.py` +142 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +4 / −0（文本行变化）

当前含该标识符的 tag：未找到
