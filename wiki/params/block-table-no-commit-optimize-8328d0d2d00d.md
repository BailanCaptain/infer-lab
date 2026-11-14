---
id: block-table-no-commit-optimize-8328d0d2d00d
title: block_table_no_commit_optimize
type: param
summary: >-
  已不存在的键：曾是 MRv1 块表优化的回退开关，只在 main 上存在过一天（09-23 引入，09-24
  随优化一起回退），钉住的各版本都没有它。当时默认 0 用只提交脏行区间的 OptimizedBlockTable，写 1 换回整行 H2D
  拷贝的老实现——名字容易读反，它是关优化的。
aliases:
  - block_table_no_commit_optimize
  - 块表脏区提交回退
  - OptimizedBlockTable
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
verified:
  - main
relations:
  - to: block-table
    kind: builds-on
    note: 它曾选那一页讲的块表往 NPU 提交时的实现——默认只提交脏行区间，写 1 退回整行拷贝；09-24 已随优化回退
  - to: ascend-config-system
    kind: builds-on
    note: 该历史回退开关通过 additional_config 顶层键配置，其解析及未知键处理依赖 AscendConfig 配置系统，并随版本变化。
sources:
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L513-L514
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/worker/block_table.py#L339-L518
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
  - >-
    raw:sha256-14331f991ef69f23ae795740671c89327f10e6f4babb7a526b2eb46799d9ad01.md#L1-L89
  - 'vllm-ascend@7d825229:vllm_ascend/worker/block_table.py#L298-L303'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/block_table.py#L519-L521'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L32-L332'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L351'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L359'
  - 'vllm@ced6857a:vllm/v1/utils.py#L110-L143'
rawSources:
  - >-
    raw/sha256-14331f991ef69f23ae795740671c89327f10e6f4babb7a526b2eb46799d9ad01.md
  - >-
    raw/sha256-31f95a78e4d4fc2e65fa7aa254c176dbd3863bd11ad06f14ad9b9f1ff80ebd6a.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 一句话

**v0.30.0rc2 对照：** 不提供这个历史用户键。MRV1 的 BlockTable 直接通过 copy_to_gpu 提交，MultiGroupBlockTable 遍历各组，没有按此键选择实现的分支。下面的 0/1 语义只属于历史提交；在 rc2 把它传作顶层键通常被拒收，能发现 vllm_omni 时仅告警过滤，不会形成回退开关。这不表示 rc2 没有其他块表优化。

**这个键已经不存在了。** 它是 2026-09-23 随 PR #17066 合进 main 的回退开关，第二天（09-24）PR #17470 就把那项优化连同它一起回退（见版本谱系）。钉住的 main（`baa023ad`，09-21）早于它合入，v0.23、v0.26 和 GLM 双机用的 `db701c1f` 也都没有它——这些版本里块表一律走整行拷贝的老路，没有可切换的东西。

它存在的那一天里：PR #17066 把 MRv1 的[块表](../concepts/block-table.md)默认换成**只把脏行区间提交到 NPU** 的 `OptimizedBlockTable`，这个键管回退——`0`（默认）用优化实现，写 `1` 换回原来整行 H2D 拷贝的 `BlockTable` [C2]。**名字容易读反**——它当时不是「开优化」，是「关优化」：写 1 才是退回老路。字段注释写明只对 MRv1 有效 [C1]。

块表记录请求的逻辑缓存块对应哪些物理块。这里的“提交”指把主机侧的块表信息复制到设备侧，供模型执行使用；H2D 即从主机到设备的数据传输。开关改变的是这份映射表的提交方式。材料中的 MRv1、MRv2 指两代模型执行实现。[I]

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
| 当时的选择点 | `_get_block_table_cls()`：`1` 返回 `BlockTable`，其余返回 `OptimizedBlockTable` [C2] | 构造各 KV cache group 的块表时选类；已经创建的块表不随配置变更重新选类 |
| 当时的适用范围 | 字段注释：MRv1 only [C1]；官方参数表写明 MRv2 有自己的分段增量更新、**无视这个键** [S5] | 当时只对 MRv1 生效；本页钉住的四版和 GLM 基线均不提供此开关 |
| 寿命 | 官方参数表把它标成临时的 MRv1 兼容项，**MRv1 退役时会被删掉** [S5] | 实际没等到那天：一天后就随回退删掉了，别把它写进部署模板 |
| 当时的环境变量 | `VLLM_ASCEND_BLOCK_TABLE_NO_COMMIT_OPTIMIZE` **不被支持**，只认 additional-config 里的 0/1 [S6] | 当时设环境变量也等于没设 |
| 覆盖版本 | 该实现由 09-23 的 PR #17066 引入、09-24 的 #17470 回退；钉住的 v0.23、v0.26、v0.30.0rc2、main `baa023ad` 与 GLM 用的 `db701c1f` 都没有 | 版本表中的“无”只描述所核快照；提交存在于 tag 的历史中，不代表该 tag 仍保留开关 |
| 在没有它的版本里写它 | v0.23、v0.26、`db701c1f` 的配置类逐键读取，多写的这个键被静默忽略；rc2 与 main 拒绝未知键，能发现 vllm_omni 时才告警并过滤 [C7][C12] | 旧脚本迁往 rc2 或 main 时应删掉此键，不能依赖旧版的忽略行为 |

## 为什么存在

decode 时一条请求一步通常只多出零到一个块号，老实现却每步把这一批前 `num_reqs` 行**整行**拷去 NPU [C8]——一行有多宽由最大长度决定，和这一步改没改无关。PR #17066 给每行记一段脏区（`_dirty_begin` / `_dirty_end`，提交后用哨兵值复位 [C4]），每步只搬真动过的那几段，一行都没动就整步不拷。回退开关和优化同一个 PR 进来——刚落地的性能改动出问题时，用户写一个键就能退回旧行为，不用回滚版本；结果这项优化自己第二天就被回退了。

放到 GLM 双机：它用的 `db701c1f` 走 MRv1 runner，每步准备输入时整行提交块表（[准备输入页](../concepts/prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)），没有这个键，也没有这里的脏区优化；每步拷多少字节见[块表页](../concepts/block-table.md#表本身占多少每步花多少)。PR #17066 提供过另一模型负载下的性能记录，不能把它移作本部署收益；本站尚未实机复现这一开关的性能差异。

## 开了的代价

在它存在的那一天里：写 `1` 就放弃增量提交、回到整行拷贝，选择函数本身不打印回退提示。只有少量位置改变时，整行路径会复制更多表项；具体耗时还取决于整理脏区、提交和算子调度的开销，不能仅凭复制字节数断言总会更慢。什么都不写则采用当时的优化默认值。

旧脚本保留此键的后果取决于版本：本页钉住的 v0.23、v0.26 与 GLM 基线忽略它；rc2 与 main 通常拒收，能发现 vllm_omni 时告警过滤。上述版本的 MRv1 提交路径都不由它选择，无需设置这个键。旧配置读取见来源 13–15；rc2 的前若干行复制还可沿来源 16 核对，不能把“忽略未知键”推广到所有发布分支。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |

- **引入**：2026-09-23 · ad7a731b9c0db2592bbe1f568a776207745017ed · PR [#17066](https://github.com/vllm-project/vllm-ascend/pull/17066) —— [Performance][MRV1] Commit only dirty block-table ranges (#17066)
  包含该提交的 tag：v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/main、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/zxy_fix_boradash
  - `vllm_ascend/worker/block_table.py` +124 / −2（文本行变化）
  - `vllm_ascend/ascend_config.py` +3 / −0（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +43 / −0（文本行变化）
- **移除**：2026-09-24 · 4b4da9fae9cdbde1248b196681c86dbb7ffca9e1 · PR [#17470](https://github.com/vllm-project/vllm-ascend/pull/17470) —— [nightly][bugfix] Revert MRV1 dirty block-table optimization (#17066) (#17470)
  包含该提交的 tag：v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/main、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/zxy_fix_boradash
  - `vllm_ascend/worker/block_table.py` +2 / −124（文本行变化）
  - `vllm_ascend/ops/triton/block_table_scatter.py` +0 / −43（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −3（文本行变化）

当前含该标识符的 tag：未找到
