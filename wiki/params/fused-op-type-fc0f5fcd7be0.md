---
id: fused-op-type-fc0f5fcd7be0
title: fused_op_type
type: param
summary: fused_op_type 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-09-26'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L1633
  - >-
    vllm-ascend@b64b4d714484feaa6ca71edc99b98318fe6d2f0d:vllm_ascend/ascend_config.py#L1634
rawSources:
  - >-
    raw/sha256-487944627d866213f1a7080123d1b06364fdfd1236bf863485d634bc276f95bc.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

骨架，待补：fused_op_type 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["sparse_kv_offload_config"]["fused_op_type"]` |
| 类型 | `str` |
| 默认表达式 | `'none'` |
| 定义 | `vllm_ascend/ascend_config.py:1634` [C2] |
| 版本 | main · b64b4d714484feaa6ca71edc99b98318fe6d2f0d |

字段注释：

Generalized Q1/MTP LIM + copy-SFA. The C8 operator is built separately but is not selected by this serving path.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.fused_op_type not in ('none', 'fused_copy_sfa'):
    raise ValueError('sparse_kv_offload_config.fused_op_type must be none or fused_copy_sfa')
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
| main | 有（1 个文件） |

- **引入**：2026-09-26 · 1e9e03bc53bdc53f3cc78c7af191794ee7544ad9 · PR [#17392](https://github.com/vllm-project/vllm-ascend/pull/17392) —— [Feature]Support using fused operators to improve performance of layerwise sparse offload (#17392)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/spec_decode/mtp.py` +0 / −50（文本行变化）
  - `vllm_ascend/attention/sfa_kv_offload.py` +552 / −19（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py` +23 / −18（文本行变化）
  - `vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/worker.py` +68 / −9（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +105 / −4（文本行变化）

当前含该标识符的 tag：未找到
