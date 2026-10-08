---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: >-
  PCP>1 时把 embedding 与 LM Head 的权重按 TP×PCP 网格再切一份，每卡只留 1/(TP×PCP)。bool 默认
  true，要旧行为得显式写 false；与细粒度 TP 的 embedding/lmhead 两键互斥。钉住的三个对照版本都还没有它（09-23 才进上游
  main），GLM 双机不开 PCP 也用不到。
aliases:
  - enable_pcp_embedding_lmhead_weight_sharding
  - PCP embedding/LM-head 权重切分
origin: seed
evidence: C
updated: '2026-10-02'
verified:
  - main
relations:
  - to: context-parallel
    kind: builds-on
    note: >-
      PCP 是那一页讲的 prefill 上下文并行；这个键管权重侧——PCP 组里 embedding 和 LM Head 还要不要每卡各存一份完整的
      TP 切片
  - to: fine-grained-tp
    kind: conflicts-with
    note: >-
      和它的 embedding_tensor_parallel_size / lmhead_tensor_parallel_size
      切的是同一批权重，撞上在权重构建期直接 ValueError，二选一
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
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/configuration/additional_config.md#L80-L80
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/feature_guide/context_parallel.md#L67-L67
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L495
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L578
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ops/vocab_parallel_embedding.py#L536-L568
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ops/vocab_parallel_embedding.py#L299-L398
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L576
rawSources:
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

开了 PCP（`prefill_context_parallel_size > 1`，见 [Context Parallel](../concepts/context-parallel.md)）的部署里，embedding 和 LM Head 的权重默认按 **TP × PCP 网格**切开存放（PCP 是内维），每卡只留 1/(TP×PCP) [C2]。这个键是它的开关，**默认 `true`** [C1]：只要 PCP 开着、什么都不写，行为就已经是切开的；要旧行为（PCP 组内每卡各存一份完整 TP 切片）得显式写 `false`。PCP=1 的部署完全不受影响：生效门把 PCP 条件和这个键一起判 [C2]。

**本库钉住的三个对照版本都还没有这个键。** 它 2026-09-23 才随 PR #17159 进上游 main（见[版本谱系](#版本谱系)），比钉住的 main（`baa023ad`，09-21）晚两天；v0.23（`2c59ff10`）、v0.26（`2ed6cbba`）两条发布分支上也没有 [D]。下面「参数定义」那张表读的是参数扫描当时的上游 main（`4d1412d1`，09-26），不是钉住版本。GLM 双机主线不开 PCP，这个键在那套部署上既不生效也开不起来（见事实表「GLM 双机」一行）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:576` [C13] |
| 版本 | main · 4ebb3090fc3c13c26557dcaae353882e70246649 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["enable_pcp_embedding_lmhead_weight_sharding"]` [C1] | 顶层键；配置类 docstring 的全量键示例里列着它，默认 `true` [C3] |
| 类型与默认 | `bool`，默认 `True` | 这是少数「默认开」的实验键：关它才要动手写 |
| 生效门 | 权重前缀是 `embed_tokens` / `head`、这个键为真、且 PCP > 1，三者同时成立 [C2] | 别的权重不看它；PCP=1 时它是死代码 [D] |
| 与细粒度 TP | 逐权重判：`embed_tokens` 这块撞 `embedding_tensor_parallel_size`，名字里带 `head` 的那块撞 `lmhead_tensor_parallel_size`，撞上就 `ValueError` [C2] | 两套机制切同一批权重；两块权重都要建，所以任一开着实际都会在构建期被拦下 |
| 与 `enable_reduce_sample` | 同开且 PCP>1，启动期 `ValueError` [C4] | 见上方「约束线索」引的 validator 原文 |
| 读取方式 | utils 里的访问函数带 `lru_cache` [C5]，`additional_config["refresh"]` 会清缓存 [C6] | 进程内只算一次，运行中改配置不生效 [D] |
| 官方文档 | 参数表与 Context Parallel 指南都已写明：默认开、PCP>1 生效、与 `enable_reduce_sample` 和细粒度 TP 的这两处互斥 [S7] | 和代码行为一致；官方口径的关法就是写 `false` [S8] |
| 覆盖版本 | 只有上游 main，2026-09-23 起（见版本谱系）；钉住的 v0.23 `2c59ff10`、v0.26 `2ed6cbba`、main `baa023ad` 三个版本都没有它，v0.27.1rc / v0.28.0rc / v0.29.0rc 这几条发布分支也没有 [D] | 两条发布分支的配置类逐键 `.get()`，写上被静默忽略；钉住 main 的顶层 `AscendConfig` 是 `extra="forbid"`，在它上面写这个键反而会被当未知键拒掉 [D] |
| GLM 双机 | 这套部署 PCP=1、DCP=1，生效门的 PCP 条件不成立；34 层 KDA 的 prefill 在 PCP > 1 时直接抛 `NotImplementedError`，见 [CP 页的 GLM 一节](../concepts/context-parallel.md#放到-glm-双机这套部署开了-cp-吗) | 主线上它既不生效、也开不起来；每卡 embedding 与 `lm_head` 仍是各一份完整 TP 切片，份额见[每张卡上放了什么](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)（本页不重算） |

## 为什么存在

embedding 和 LM Head 是 `词表 × hidden` 的两块大权重，TP 已经把它们按词表维切成 tp 份；但 PCP 组里的每张卡原本**各存一份完整的 TP 切片**——PCP 越大，重复越多。PR #17159 把 TP × PCP 网格线性化（PCP 为内维）后按整个网格切 [C2]，每卡这两块权重因此**缩到原来的 1/PCP**（省下 (PCP−1)/PCP：PCP=4 时省 3/4）[D]。DSpark 的 markov head 这类声明了 `disable_tp` 的复制权重被显式绕开，不会被误切 [C2]。

## 开了的代价

它默认开，真正的问题是**什么时候要关**：一是和细粒度 TP 的 embedding/lmhead 切分二选一（撞上构建期报错）[C2]；二是配 `enable_reduce_sample` 的 PCP 部署，启动就拦 [C4]；三是想保守升级——PCP 部署从旧 main 升上来，权重摆放方式默认变了，对拍显存或精度时先显式写 `false` 排除它。

**两侧都多出 PCP 组内通信。** embedding 一侧多两次：先在 PCP 组 all-gather 把组里的 token ID 收齐，再拿它们查本卡那片词表，查完在 PCP 组 reduce-scatter 把结果送回各自的 token 行，最后才在 TP 组 all-reduce 补齐词表维——这次 TP 归约只带本 PCP rank 的那些 token 行 [C12]。LM Head 一侧虽然不设这两个组，但常规取分数改走专门的路径：先在 PCP 组、再在 TP 组 all-gather 词表分片，才拼回完整 logits；只切 TP 时只在 TP 组 gather 一次 [C11]。所以常规取一次 logits 比不开它时多一次 PCP 组 all-gather；spec-decode 这类传 `skip_gather` 的调用方两条路径都不 gather，不在此列 [C11]。

**待核：** 一是本库没有任何开着这个键的实测数字（显存、时延都没有），「缩到原来的 1/PCP」只是按切分方式推出来的量级，不能当成实测收益；二是钉住的三个版本里读不到它的实现，上面的机制读的是扫描当时的上游 main（`4d1412d1`）；三是「在钉住 main 上写它会被拒」是按那一版配置类的 `extra="forbid"` 推的，没有实跑过报错文本。

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
