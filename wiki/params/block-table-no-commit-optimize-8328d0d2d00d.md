---
id: block-table-no-commit-optimize-8328d0d2d00d
title: block_table_no_commit_optimize
type: param
summary: 已不存在的键：曾是 MRv1 块表优化的回退开关，只在 main 上存在过一天（09-23 引入，09-24 随优化一起回退），钉住的各版本都没有它。当时默认 0 用只提交脏行区间的 OptimizedBlockTable，写 1 换回整行 H2D 拷贝的老实现——名字容易读反，它是关优化的。
aliases:
  - block_table_no_commit_optimize
  - 块表脏区提交回退
  - OptimizedBlockTable
origin: seed
evidence: C
updated: '2026-10-02'
verified:
  - main
relations:
  - to: block-table
    kind: builds-on
    note: 它曾选那一页讲的块表往 NPU 提交时的实现——默认只提交脏行区间，写 1 退回整行拷贝；09-24 已随优化回退
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L514
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/worker/block_table.py#L455-L458
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L329-L354
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/worker/block_table.py#L445-L452
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/configuration/additional_config.md#L76-L76
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:docs/source/user_guide/configuration/additional_config.md#L26-L26
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1660-L1679
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/worker/block_table.py#L284-L288
rawSources:
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

**这个键已经不存在了。** 它是 2026-09-23 随 PR #17066 合进 main 的回退开关，第二天（09-24）PR #17470 就把那项优化连同它一起回退（见版本谱系）。钉住的 main（`baa023ad`，09-21）早于它合入，v0.23、v0.26 和 GLM 双机用的 `db701c1f` 也都没有它——这些版本里块表一律走整行拷贝的老路，没有可切换的东西。

它存在的那一天里：PR #17066 把 MRv1 的[块表](../concepts/block-table.md)默认换成**只把脏行区间提交到 NPU** 的 `OptimizedBlockTable`，这个键管回退——`0`（默认）用优化实现，写 `1` 换回原来整行 H2D 拷贝的 `BlockTable` [C2]。**名字容易读反**——它当时不是「开优化」，是「关优化」：写 1 才是退回老路。字段注释写明只对 MRv1 有效 [C1]。

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

前六行记的是它存在那一天（09-23 的 main，`ad7a731b` 起）的行为，最后两行才是现在的情况。

| 项 | 值 | 意味着什么 |
|---|---|---|
| 当时的配置路径 | `additional_config["block_table_no_commit_optimize"]` [C1] | 顶层键；当时配置类 docstring 的全量键示例里列着它，默认 `0` [C3] |
| 当时的类型与默认 | `Literal[0, 1]`，默认 `0`（用优化实现） | 当时只认 0 / 1，别的值在配置校验就被拒 |
| 当时的选择点 | `_get_block_table_cls()`：`1` 返回 `BlockTable`，其余返回 `OptimizedBlockTable` [C2] | 每个 KV cache group 的块表都按它选类，进程起来后不再变 |
| 当时的适用范围 | 字段注释：MRv1 only [C1]；官方参数表写明 MRv2 有自己的分段增量更新、**无视这个键** [S5] | 当时也只对 MRv1 生效；现在任何版本写它都没有效果（见最后两行） |
| 寿命 | 官方参数表把它标成临时的 MRv1 兼容项，**MRv1 退役时会被删掉** [S5] | 实际没等到那天：一天后就随回退删掉了，别把它写进部署模板 |
| 当时的环境变量 | `VLLM_ASCEND_BLOCK_TABLE_NO_COMMIT_OPTIMIZE` **不被支持**，只认 additional-config 里的 0/1 [S6] | 当时设环境变量也等于没设 |
| 覆盖版本 | 只在 main 的 09-23 至 09-24 之间存在（PR #17066 引入、#17470 回退，见版本谱系）；钉住的 v0.23、v0.26、main `baa023ad` 与 GLM 用的 `db701c1f` 都没有 | 任何发布 tag 和回退后的 main 里都找不到它 |
| 在没有它的版本里写它 | v0.23、v0.26、`db701c1f` 的配置类逐键 `.get()`，多写的键被静默忽略；main 的配置类禁止未知键，构造时直接报错（装了 vLLM-Omni 时改为告警并丢弃）[C7] | 老部署脚本里留着它，换到 main 起服务会失败，删掉即可 |

## 为什么存在

decode 时一条请求一步通常只多出零到一个块号，老实现却每步把这一批前 `num_reqs` 行**整行**拷去 NPU [C8]——一行有多宽由最大长度决定，和这一步改没改无关。PR #17066 给每行记一段脏区（`_dirty_begin` / `_dirty_end`，提交后用哨兵值复位 [C4]），每步只搬真动过的那几段，一行都没动就整步不拷。回退开关和优化同一个 PR 进来——刚落地的性能改动出问题时，用户写一个键就能退回旧行为，不用回滚版本；结果这项优化自己第二天就被回退了。

放到 GLM 双机：它用的 `db701c1f` 走 MRv1 runner，每步准备输入时整行提交块表（[准备输入页](../concepts/prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)），没有这个键，也没有脏区优化；每步拷多少字节见[块表页](../concepts/block-table.md#表本身占多少每步花多少)。这个开关没有实测收益数，待核：PR #17066 在昇腾上的提交耗时对比。

## 开了的代价

在它存在的那一天里：写 `1` 就放弃增量提交、回到整行拷贝——是「更慢但行为最老实」的选择，没有任何告警或日志提示你正跑在回退路径上；什么都不写就等于接受了新默认，MRv1 的块表提交行为跟着升级自动变。

回退之后代价反过来落在「留着它」上：main 不认识这个键，留在 `--additional-config` 里会让启动失败（见事实表）；发布分支则静默忽略。两边 MRv1 的块表都已经回到整行拷贝，不需要任何键去「关掉优化」。

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
| main | 无 |

- **引入**：2026-09-23 · ad7a731b9c0db2592bbe1f568a776207745017ed · PR [#17066](https://github.com/vllm-project/vllm-ascend/pull/17066) —— [Performance][MRV1] Commit only dirty block-table ranges (#17066)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/worker/block_table.py` +124 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +3 / −0（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +43 / −0（文本行变化）
- **移除**：2026-09-24 · 4b4da9fae9cdbde1248b196681c86dbb7ffca9e1 · PR [#17470](https://github.com/vllm-project/vllm-ascend/pull/17470) —— [nightly][bugfix] Revert MRV1 dirty block-table optimization (#17066) (#17470)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/worker/block_table.py` +2 / −124（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +0 / −43（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −3（文本行变化）

当前含该标识符的 tag：未找到
