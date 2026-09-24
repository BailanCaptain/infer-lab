---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: PCP>1 时把 embedding 与 LM Head 的权重按 TP×PCP 网格再切一份，每卡只留 1/(TP×PCP)。bool 默认 true——开着 PCP 升级到含它的 main，行为自动就是切开的；要旧行为得显式写 false。与细粒度 TP 的 embedding/lmhead 两键互斥。只在 main 上有。
aliases:
  - enable_pcp_embedding_lmhead_weight_sharding
  - PCP embedding/LM-head 权重切分
origin: seed
evidence: C
updated: '2026-09-24'
verified:
  - main
relations:
  - to: context-parallel
    kind: builds-on
    note: PCP 是那一页讲的 prefill 上下文并行；这个键管权重侧——PCP 组里 embedding 和 LM Head 还要不要每卡各存一份完整的 TP 切片
  - to: fine-grained-tp
    kind: conflicts-with
    note: 和它的 embedding_tensor_parallel_size / lmhead_tensor_parallel_size 切的是同一批权重，撞上在权重构建期直接 ValueError，二选一
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L480
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ops/vocab_parallel_embedding.py#L95-L125
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L329-L354
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L820-L845
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/utils.py#L1493-L1498
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/utils.py#L195-L198
rawSources:
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

开了 PCP（`prefill_context_parallel_size > 1`，见 [Context Parallel](../concepts/context-parallel.md)）的部署里，embedding 和 LM Head 的权重默认按 **TP × PCP 网格**切开存放（PCP 是内维），每卡只留 1/(TP×PCP) [C2]。这个键是它的开关，**默认 `true`** [C1]——2026-09-23 起（PR #17159，只在 main）什么都不写、只要 PCP 开着，行为就已经是切开的；要旧行为（PCP 组内每卡各存一份完整 TP 切片）得显式写 `false`。PCP=1 的部署完全不受影响：生效门把 PCP 条件和这个键一起判 [C2]。

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

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` [C1] | 顶层键；配置类 docstring 的全量键示例里列着它，默认 `true` [C3] |
| 类型与默认 | `bool`，默认 `True` | 这是少数「默认开」的实验键：关它才要动手写 |
| 生效门 | 权重前缀是 `embed_tokens` / `head`、这个键为真、且 PCP > 1，三者同时成立 [C2] | 别的权重不看它；PCP=1 时它是死代码 [D] |
| 与细粒度 TP | `embedding_tensor_parallel_size` / `lmhead_tensor_parallel_size` 任一开着就 `ValueError` [C2] | 两套机制切同一批权重，构建期就拦，报错点名两个键 |
| 与 `enable_reduce_sample` | 同开且 PCP>1，启动期 `ValueError` [C4] | 见上方「约束线索」引的 validator 原文 |
| 读取方式 | utils 里的访问函数带 `lru_cache` [C5]，`additional_config["refresh"]` 会清缓存 [C6] | 进程内只算一次，运行中改配置不生效 [D] |
| 覆盖版本 | 只有 main（2026-09-23 起，见版本谱系） | 两个在册发布分支的配置类逐键 `.get()`，写上被静默忽略 |

## 为什么存在

embedding 和 LM Head 是 `词表 × hidden` 的两块大权重，TP 已经把它们按词表维切成 tp 份；但 PCP 组里的每张卡原本**各存一份完整的 TP 切片**——PCP 越大，重复越多。PR #17159 把 TP × PCP 网格线性化（PCP 为内维）后按整个网格切 [C2]，每卡权重因此再省 1/PCP [D]。DSpark 的 markov head 这类声明了 `disable_tp` 的复制权重被显式绕开，不会被误切 [C2]。

## 开了的代价

它默认开，真正的问题是**什么时候要关**：一是和细粒度 TP 的 embedding/lmhead 切分二选一（撞上构建期报错）[C2]；二是配 `enable_reduce_sample` 的 PCP 部署，启动就拦 [C4]；三是想保守升级——PCP 部署从旧 main 升上来，权重摆放方式默认变了，对拍显存或精度时先显式写 `false` 排除它。

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
| main | 有（3 个文件） |

- **引入**：2026-09-23 · f4ee3b53a2f8ed91e443cb166cf0ef108da8cb16 · PR [#17159](https://github.com/vllm-project/vllm-ascend/pull/17159) —— [Feature][PCP] Shard embedding and LM head weights across PCP (#17159)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ops/vocab_parallel_embedding.py` +223 / −59（文本行变化）
  - `vllm_ascend/ascend_config.py` +11 / −0（文本行变化）
  - `vllm_ascend/utils.py` +9 / −0（文本行变化）

当前含该标识符的 tag：未找到
