---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: enable_pcp_embedding_lmhead_weight_sharding 的静态定义，正文待补。
origin: seed
evidence: C
updated: '2026-09-23'
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L480
rawSources:
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

骨架，待补：enable_pcp_embedding_lmhead_weight_sharding 的静态参数定义。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:480` [C1] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_reduce_sample:
    logger.warning_once('enable_reduce_sample is an experimental feature. Use with caution.')
    if self.finegrained_tp_config.lmhead_tensor_parallel_size > 0:
        raise ValueError('enable_reduce_sample is incompatible with finegrained_tp_config.lmhead_tensor_parallel_size. Please disable one of them.')
    if self.enable_pcp_embedding_lmhead_weight_sharding and vc.parallel_config.prefill_context_parallel_size > 1:
        raise ValueError('enable_reduce_sample is incompatible with enable_pcp_embedding_lmhead_weight_sharding when PCP is enabled. Please disable one of them.')
    kv_transfer_config = getattr(vc, 'kv_transfer_config', None)
    kv_role = getattr(kv_transfer_config, 'kv_role', None)
    if kv_role == 'kv_producer':
        raise ValueError('enable_reduce_sample is not supported on PD-disaggregated scenarios. Please disable enable_reduce_sample.')
````

````python
if self.enable_pcp_embedding_lmhead_weight_sharding and vc.parallel_config.prefill_context_parallel_size > 1:
    raise ValueError('enable_reduce_sample is incompatible with enable_pcp_embedding_lmhead_weight_sharding when PCP is enabled. Please disable one of them.')
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
| a71b766ce6fc0a9669a412e15a5cf53f7f827093 | 无 |
| 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f | 有（3 个文件） |

- **引入**：2026-09-23 · f4ee3b53a2f8ed91e443cb166cf0ef108da8cb16 · PR [#17159](https://github.com/vllm-project/vllm-ascend/pull/17159) —— [Feature][PCP] Shard embedding and LM head weights across PCP (#17159)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ops/vocab_parallel_embedding.py` +223 / −59（文本行变化）
  - `vllm_ascend/ascend_config.py` +11 / −0（文本行变化）
  - `vllm_ascend/utils.py` +9 / −0（文本行变化）

当前含该标识符的 tag：未找到
