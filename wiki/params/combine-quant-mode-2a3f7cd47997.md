---
id: combine-quant-mode-2a3f7cd47997
title: combine_quant_mode
type: param
summary: combine_quant_mode 的静态定义，正文待补。
origin: seed
verified: ["main"]
evidence: C
updated: '2026-09-19'
sources:
  - >-
    vllm-ascend@b255ab59662d8c665e5534e926f913b1c1179b1c:vllm_ascend/ascend_config.py#L473
rawSources:
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

骨架，待补：combine_quant_mode 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["combine_quant_mode"]` |
| 类型 | `Literal[0, 2, 3, 4]` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:473` [C1] |
| 版本 | main · b255ab59662d8c665e5534e926f913b1c1179b1c |

字段注释：

When non-zero, force the MC2 combine stage's comm quant_mode to this value (e.g. 4 = MXFP float8_e4m3 communication quantization) regardless of the model's quant_type, 0 means disabled (use the model's own quant).

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
| 28bf3a2e8e8db396ee5dcfa6812626eee2d394ab | 无 |
| b255ab59662d8c665e5534e926f913b1c1179b1c | 有（2 个文件） |

- **引入**：2026-09-07 · 203ae3eb0a734c3a7ba638d84e116bcca24b1a09 · PR [#15441](https://github.com/vllm-project/vllm-ascend/pull/15441) —— [Feature][Quant] Introduce combine_quant_mode to force MC2 combine stage communication quantization (#15441)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +6 / −1（文本行变化）
  - `vllm_ascend/ascend_config.py` +4 / −0（文本行变化）

当前含该标识符的 tag：未找到
