---
id: block-table-no-commit-optimize-8328d0d2d00d
legacyAnchors:
  一句话: 它曾经控制什么，为什么只存在了一天？
  为什么存在: 脏区提交与整行 H2D 拷贝的区别，以及 GLM 双机现状
  开了的代价: 在不同版本中残留这个键会发生什么？
title: block_table_no_commit_optimize
type: param
summary: >-
  已移除的历史回退键：曾在 main 短暂存在一天（2026-09-23 随 MRv1 脏区提交优化引入、09-24
  随该优化整体回退），v0.23.0、v0.26.0rc、v0.30.0 与 main 均无此键。当时默认 0 用增量提交的
  OptimizedBlockTable，设 1 才退回整行 H2D 拷贝；新版保留该键通常启动报错。
aliases:
  - block_table_no_commit_optimize
  - 块表脏区提交回退
  - OptimizedBlockTable
origin: seed
evidence: C
updated: 2026-11-19T00:00:00.000Z
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
relations:
  - to: block-table
    kind: builds-on
    note: 它曾选那一页讲的块表往 NPU 提交时的实现——默认只提交脏行区间，写 1 退回整行拷贝；09-24 已随优化回退
  - to: ascend-config-system
    kind: builds-on
    note: 该历史回退开关通过 additional_config 顶层键配置，其解析及未知键处理依赖 AscendConfig 配置系统，并随版本变化。
  - to: prepare-inputs-flow
    kind: builds-on
    note: 块表脏区提交与整行 H2D 拷贝发生在每步准备输入阶段，完整组装流程见该页
  - to: model-runner-v2
    kind: builds-on
    note: 该历史回退键仅作用于 MRv1，MRv2 已内置常驻设备块表与分段更新并退役 MRv1 块表实现
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/block_table.py#L298-L306'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/block_table.py#L519-L522'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1895-L1910'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033'
rawSources:
  - >-
    raw/sha256-14331f991ef69f23ae795740671c89327f10e6f4babb7a526b2eb46799d9ad01.md
  - >-
    raw/sha256-31f95a78e4d4fc2e65fa7aa254c176dbd3863bd11ad06f14ad9b9f1ff80ebd6a.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
---
## 它曾经控制什么，为什么只存在了一天？

**这个键在所有四个核验版本（`v0.23.0`、`v0.26.0rc`、`v0.30.0`、`main`）以及 GLM 固定镜像 `db701c1f` 中均不存在。** 它是 2026-09-23 随 PR #17066（`39fef3f8` / `ad7a731b`）合入 `main` 的 MRv1 临时回退开关，次日（2026-09-24）PR #17470 就将整项块表优化连同这个键一起回退。官方参数表原将其标为「MRv1 退役时删除的临时兼容项」，实际仅存活一日，切勿写入任何部署模板。

先明确三个前置词：块表记录每个请求的逻辑 KV 缓存块映射到哪些物理块；「提交」指把主机侧块表数据复制到设备侧（H2D，Host-to-Device）供模型执行使用；MRv1、MRv2 指两代模型执行器实现（新一代架构见 [Model Runner V2](../concepts/model-runner-v2.md)）。

在它存在的那一天里，PR #17066 将 MRv1 的[块表](../concepts/block-table.md)默认切换为只提交脏行区间的 `OptimizedBlockTable`，而 `block_table_no_commit_optimize` 用来**关闭该优化、退回旧实现**——**命名极易读反**。

## 事实表

下表汇总该单日历史回退键的核心规格与四个正式核验版本中的现状：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史路径与类型 | `additional_config["block_table_no_commit_optimize"]`，`Literal[0, 1] = 0` | 仅限 JSON 顶层整数 `0` 或 `1`，不支持 `VLLM_ASCEND_BLOCK_TABLE_NO_COMMIT_OPTIMIZE` 环境变量 |
| 存活窗口 | 2026-09-23（PR #17066 引入）至 2026-09-24（PR #17470 整体回退） | 仅在 `main` 历史提交存活一天；`v0.23.0`、`v0.26.0rc`、`v0.30.0rc2`、`v0.30.0` 与当前 `main` 均无此键 |
| 历史取值语义 | `0`（当时默认）走脏区增量提交 `OptimizedBlockTable`；`1` 退回整行 H2D 拷贝 | 名字带 `no_commit_optimize`，写 `1` 才是关闭优化退回旧版 |
| 执行器边界 | 仅作用于 MRv1（`_get_block_table_cls()` 构造块表时读一次） | MRv2 自带常驻设备块表与分段更新，当时也完全无视此键 |
| 残留旧键后果 | `v0.30.0` 与 `main` 通常触发 `extra="forbid"` 启动报错（`vllm_omni` 告警过滤） | `v0.23.0` / `v0.26.0rc` 静默忽略；任何部署模板均应彻底删除该键 |

## 脏区提交与整行 H2D 拷贝的区别，以及 GLM 双机现状

decode 阶段一条请求每步通常只新增 0 到 1 个物理块号。MRv1 普通 `BlockTable.commit_block_table(num_reqs)` 每步都经 `copy_to_gpu(num_reqs)` 把前 `num_reqs` 行**整行**拷往 NPU（行宽由最大序列长度决定，无论该步是否改动大部分槽位）；`MultiGroupBlockTable` 则逐组遍历调用。

```wiki-diagram
file: param-block-table-no-commit
```

PR #17066 为每行维护一对脏区边界 `_dirty_begin` / `_dirty_end`（提交后以哨兵值复位），每步只搬真正修改过的片段，一行未动则整步跳过。回退开关本意是刚上线遇到问题时不用回滚镜像即可切回整行拷贝，最终随整个优化次日回退而消失。

需注意：在它存在的那一天，设 `1` 退回整行拷贝会在只有少量槽位改动时复制更多表项，但实际耗时仍受脏区整理、提交调度与小块传输开销影响，不能仅凭拷贝字节数断言整行一定更慢。

**放到 GLM 双机部署（历史例外 B 算例）**：固定镜像 `db701c1f` 运行 MRv1 runner，每步准备输入时整行提交块表（见[准备输入页](../concepts/prepare-inputs-flow.md#放到-glm-双机r1-这一步每张卡拼出什么)与[块表显存和拷贝账](../concepts/block-table.md#表本身占多少每步花多少)），没有此键也没有脏区提交优化。PR #17066 在其他模型负载下给出的性能记录不能移作本部署收益，本站也未实机复现该历史开关的差异。

## 在不同版本中残留这个键会发生什么？

| 版本 | 残留 `block_table_no_commit_optimize` 的行为 | 块表提交现状 |
| --- | --- | --- |
| `v0.23.0`、`v0.26.0rc` 与 GLM 镜像 `db701c1f` | 配置类逐键读取，多写的顶层键被静默忽略 | 均走普通整行拷贝 |
| `v0.30.0`（`c09d3e20`） | 无此键；通常被 [AscendConfig](../concepts/ascend-config-system.md) 的 `@config(extra="forbid")` 直接拒收报错（仅环境可发现 `vllm_omni` 时告警过滤，不构成回退开关） | MRv1 `BlockTable` 直接调 `copy_to_gpu(num_reqs)` |
| `main`（`8d6180e2`） | 同 `v0.30.0`（历史脚本迁往新版须删掉此键） | 已退役 MRv1 `worker/block_table.py`，转用 `worker/v2/block_table.py`（不代表新版没有其他块表优化） |

## 对照源码

下表对照历史回退键 `block_table_no_commit_optimize` 在四个固定版本快照中的缺席状态与块表提交路径：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 开关是否存在 | 无，逐键读取静默忽略 [C14] | 无，逐键读取静默忽略 [C15] | 无，通常拒收；可发现 `vllm_omni` 时告警过滤 [C19][!] | 无，通常拒收；可发现 `vllm_omni` 时告警过滤 [C20] |
| 块表提交实现 | 普通 `BlockTable` 整行提交 | 普通 `BlockTable` 整行提交 | MRv1 `BlockTable` / `MultiGroupBlockTable` 直接 `copy_to_gpu(num_reqs)` [C17][C18] | MRv1 `worker/block_table.py` 已退役，转向 `worker/v2/block_table.py` |

- **单日历史快照（PR #17066 引入于 09-23 `39fef3f8`，PR #17470 回退于 09-24）**：字段 `Literal[0, 1] = 0`（`MRv1 only`）与 docstring 示例见来源 1、3；`_get_block_table_cls()` 及 `OptimizedBlockTable` 的 `_dirty_begin` / `_dirty_end` 脏区逻辑见来源 2、4 [C2]；官方旧表注明“MRv2 无视、MRv1 退役时删除、不支持环境变量”见来源 5、6 [S5][S6]。
- **普通整行拷贝与待核**：`db701c1f` 整行提交及旧配置读取见来源 8、13；上游 `vllm@ced6857a` `copy_to_gpu` 实现见来源 16；MRv1/MRv2 术语及块表提交语义为结合代码上下文概括 [I]。**待核**：本仓库无该单日优化在真实 NPU 负载下的端到端时延复测。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.block_table_no_commit_optimize` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |

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
