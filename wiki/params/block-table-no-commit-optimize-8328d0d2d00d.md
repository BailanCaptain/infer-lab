---
id: block-table-no-commit-optimize-8328d0d2d00d
title: block_table_no_commit_optimize
type: param
summary: MRv1 块表优化的回退开关：默认 0 用「只提交脏行区间」的 OptimizedBlockTable，写 1 换回整表 H2D 拷贝的老实现。名字容易读反——它是关优化的，不是开优化的。只在 main 上有。
aliases:
  - block_table_no_commit_optimize
  - 块表脏区提交回退
  - OptimizedBlockTable
origin: seed
evidence: C
updated: '2026-09-24'
verified:
  - main
relations:
  - to: block-table
    kind: builds-on
    note: 它选的是那一页讲的块表往 NPU 提交时的实现——默认只提交脏行区间，写 1 退回整表拷贝
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L514
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/worker/block_table.py#L455-L458
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L329-L354
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/worker/block_table.py#L445-L452
rawSources:
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

上游 2026-09-23 起（PR #17066，只在 main）把 MRv1 的[块表](../concepts/block-table.md)默认换成**只把脏行区间提交到 NPU** 的 `OptimizedBlockTable`；这个键是它的**回退开关**：`0`（默认）用优化实现，写 `1` 换回原来整表 H2D 拷贝的 `BlockTable` [C2]。**名字容易读反**——它不是「开优化」，是「关优化」：写 1 才是退回老路。字段注释写明只对 MRv1 有效 [C1]。

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

| 项 | 值 | 意味着什么 |
|---|---|---|
| 真实配置路径 | `additional_config["block_table_no_commit_optimize"]` [C1] | 顶层键；配置类 docstring 的全量键示例里列着它，默认 `0` [C3] |
| 类型与默认 | `Literal[0, 1]`，默认 `0`（用优化实现） | 只认 0 / 1，别的值在配置校验就被拒 |
| 选择点 | `_get_block_table_cls()`：`1` 返回 `BlockTable`，其余返回 `OptimizedBlockTable` [C2] | 每个 KV cache group 的块表都按它选类，进程起来后不再变 |
| 适用范围 | 字段注释：MRv1 only [C1] | 不跑 MRv1 的部署写它没有效果 |
| 覆盖版本 | 只有 main（2026-09-23 起，见版本谱系） | 两个在册发布分支的配置类逐键 `.get()`，写上被静默忽略 |

## 为什么存在

decode 每步最多往一行块表里追加一个块号，老实现却把整张 `max_num_reqs × 列数` 的表整块拷去 NPU。PR #17066 给每行记一段脏区（`_dirty_begin` / `_dirty_end`，提交后用哨兵值复位 [C4]），每步只搬真动过的那几段。回退开关和优化同一个 PR 进来——刚落地的性能改动出问题时，用户写一个键就能退回旧行为，不用回滚版本。

## 开了的代价

写 `1` 就放弃增量提交、回到整表拷贝——是「更慢但行为最老实」的选择，没有任何告警或日志提示你正跑在回退路径上。反过来这个键什么都不写，就等于接受了新默认：升级到含 PR #17066 的 main，MRv1 的块表提交行为自动变。

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
| main | 有（2 个文件） |

- **引入**：2026-09-23 · ad7a731b9c0db2592bbe1f568a776207745017ed · PR [#17066](https://github.com/vllm-project/vllm-ascend/pull/17066) —— [Performance][MRV1] Commit only dirty block-table ranges (#17066)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/worker/block_table.py` +124 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +3 / −0（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +43 / −0（文本行变化）

当前含该标识符的 tag：未找到
