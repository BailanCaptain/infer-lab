---
id: layer-sharding
title: layer_sharding
type: param
summary: >-
  v0.23.0 的层间权重分片列表，将同构 Linear 按层号轮流常驻在组内 rank i % K，其余卡前向异步 broadcast
  取回；仅限 P 节点，v0.24.0rc 起已删，v0.26 忽略、v0.30.0 与 main 拒收。
aliases:
  - Layer Sharding Linear
  - 层间权重分片
  - 按层切权重
  - additional_config.layer_sharding
  - ShardedCPRowParallelOp
legacyAnchors:
  一句话: 它曾如何按层轮放权重，为什么 v0.24 起已删除？
  为什么存在: 层间广播机制、通信组构造与 PP/TP 的区别
  层间广播机制通信组构造与与-pptp-的区别: 层间广播机制、通信组构造与 PP/TP 的区别
  开了的代价: 显存与通信账、冲突边界及向新权重切换机制的迁移
chapters:
  - '13'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L105-L112'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L346'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L39-L56'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L211-L253'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L122-L152'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L285-L296'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L412-L417'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L712-L724'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L191-L226'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1293-L1297'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1309-L1317'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1538-L1549'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L236-L259
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L766-L775'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layer_sharding.md#L5-L18
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layer_sharding.md#L30-L80
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L86
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L128'
  - 'vllm-ascend@2c59ff10:docs/source/tutorials/models/GLM5.md#L359'
  - 'vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-V3.2.md#L486'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L1522-L1537'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L146-L182'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/GLM5.2.md#L1029'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L105
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L439-L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1613-L1661'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L77
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1409-L1423'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/index.md#L27-L27'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359'
  - >-
    raw:sha256-0d0ce7737d0db60b7878b2b8474b96b654c918f40a7c32c901b27de8369a255c.md#L1-L541
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L15-L16'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L58-L120'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L581-L585'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/sfa_cp.py#L82-L109
  - >-
    vllm-ascend@7d825229:vllm_ascend/attention/context_parallel/dsa_cp.py#L2551-L2584
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1515-L1564'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L571'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/flashcomm2_oshard_manager.py#L35-L60'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/o_proj.py#L37-L83'
  - 'vllm-ascend@baa023ad:vllm_ascend/weight_switch/linear.py#L429-L538'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L971-L1027'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/default_loader.py#L381-L394'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1672-L1688'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L168-L174'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L1825-L1844'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L581-L582'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1849-L1907'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L674-L675'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1972-L2030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: conflicts-with
    note: >-
      进入 row-parallel 分派后，DSA-CP 的 P 侧 o_proj 先被 ShardedCPRowParallelOp 认领，
      不再继续选择后面的 matmul-allreduce 分支；该判据并不检查列表是否实际包含 o_proj
  - to: ascend-config-system
    kind: builds-on
    note: 该历史列表键位于 additional_config 顶层，v0.24 移除后在 v0.30.0 与 main 保留旧键会触发 AscendConfig 严格校验报错
  - to: pd-disaggregation
    kind: builds-on
    note: 该功能在 v0.23.0 强限定于 PD 分离的 P 节点（kv_role == "kv_producer"），混部与 D 节点直接启动报错
  - to: collective-communication
    kind: builds-on
    note: 前向按层异步通过独立 shard_weight 通信组的 Broadcast 将常驻卡权重发给同组其他卡
contradicts: []
updated: 2026-11-19T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-0d0ce7737d0db60b7878b2b8474b96b654c918f40a7c32c901b27de8369a255c.md
  - >-
    raw/sha256-45d34afde2227ecda5a1dad641c5f8eb51184a11f3095b8016661f3d4d28a53b.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-d5ae5978ab15999f012c8b4e21f00edf25723b330a507f4453b4a61869032de9.md
  - >-
    raw/sha256-df0884d86ac7d1f22f6ed24c66e989d1b84dc7cfb92ced4ac342522713dfc419.md
---

## 它曾如何按层轮放权重，为什么 v0.24 起已删除？

`layer_sharding` 是自 `v0.24.0rc`（PR [#11953](https://github.com/vllm-project/vllm-ascend/pull/11953)）起已彻底移除的历史层间权重轮放列表。**在 `v0.30.0` 与 `main` 中切勿配置该键**：旧脚本残留 `"layer_sharding"` 通常会直接触发 [AscendConfig](../concepts/ascend-config-system.md) 的 `extra="forbid"` 启动报错（仅装有 `vllm_omni` 时告警过滤，`v0.26.0rc` 静默忽略）；若在 `v0.30.0` / `main` 开启 PCP 需要切分输出投影权重，应改看默认开启的 [enable_pcp_o_proj_weight_sharding](enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)（切同一层的 PCP 域，而非按层号轮放）。

在 60 多层的深层大模型里，某些线性投影（如 `o_proj`、`q_b_proj`）在特定并行模式下需要完整权重；如果每张卡都把全部几十层完整常驻在显存中，单这一项就会重复占用数 GiB 显存。在历史 **`v0.23.0`（`2c59ff10`）** 维护快照与本站 GLM 基线（`db701c1f`）中，`layer_sharding` 是一个默认 `None`（关闭）的扁平层名列表（如 `["o_proj"]` 或 `["q_b_proj", "o_proj"]`，无子键，`prefetch_step` 写死为 `1`）。它把几十层轮流分给独立通信组里的 `K` 张卡保管：第 `i` 层常驻在组内 `rank i % K` 上，其余卡登记时换成单元素占位张量，前向时提前一层通过异步 Broadcast 取回；该特性强限定于旧版 [PD 分离](../concepts/pd-disaggregation.md)的 **P 节点**（`kv_role == "kv_producer"`；旧版文档见 [v0.23.0 Guide](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/layer_sharding.html)、[Additional Configuration](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)、[Release Notes](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)）。

## 事实表

核对 `v0.23.0` 历史层间分片规格及跨版本清理要点时，可速查下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史配置路径与类型 | `additional_config["layer_sharding"]`（扁平层名列表，默认 `None`） | 旧官方表曾误标为 `dict / {}`；实际应传 `["o_proj"]` 等列表，传 dict 会按 key 迭代 |
| `v0.30.0` / `main` 现状 | 自 `v0.24.0rc`（PR #11953）起已删除 | 升级必须删键（`v0.30.0`/`main` 常规进程直接报错）；新版 `enable_pcp_o_proj_weight_sharding` 切同层 PCP，不是按层轮放 |
| 角色前提与空列表陷阱 | 非空列表硬性要求 `kv_role == "kv_producer"`（混部、`kv_both`、D 节点报错） | 传空列表 `[]` 虽跳过 P 侧报错且不登记层，但因 `is not None` 成立仍会创建 `shard_weight` 通信组 |
| 归属与常驻缓冲 | 第 `i` 层落在组内 `rank i % K`；每个连续层 series 额外常驻 `2` 份整层窗口 | 等大层的最重卡预算为 `ceil(层数 / K) × 单层 + 2 × 单层`，且登记层号必须连续、至少 `3` 层 |
| 旧版耦合约束 | 配 FlashComm2 时列表只能严格等于 `["o_proj"]`；配 RFork 时告警并退回默认 loader | 想同时切 `q_b_proj` 在 `v0.23` 只能走 DSA-CP 路径（`v0.26` 起 FlashComm2 也已删除） |

## 层间广播机制、通信组构造与 PP/TP 的区别

在深层模型（如 61 层的 DeepSeek-V3/R1）中，旧 FlashComm2 或 DSA-CP 路径在执行投影时需要完整权重；如果每张卡把所有 61 层完整常驻，就会积累 61 份冗余显存。`layer_sharding` 的思路是在维度上与 TP、PP 正交：
- **与 TP 的区别**：TP 切层内（把单个矩阵切给多张卡），`layer_sharding` 切层间（把多层的完整矩阵轮流存到不同卡）。
- **与 [PP（流水线并行）](../concepts/pipeline-parallel.md#pp-是什么)的区别**：PP 连计算一起分、阶段间传递激活中间态；`layer_sharding` 只分权重存放在哪张卡，组内各卡仍执行全部这组层，传递的是权重本身。

登记与加载过程有两处易误解细节：登记时非 owner 卡的完整权重会被换成单元素占位张量并把参数加载函数置为空操作，但一方面底层 safetensors 文件迭代器仍会遍历权重条目（不能保证省磁盘读），另一方面加载后处理会临时给非 owner 分配完整张量以广播真实权重并完成量化后处理，之后再建立两份窗口并释放不再需要的完整存储及 dummy，因此登记后的占位大小不代表整个加载期峰值。

前向时，注意力后端调用预取入口触发异步 [Broadcast](../concepts/collective-communication.md#broadcast)，由常驻卡提前一层（`prefetch_step = 1`）把下一层权重发给组内其余卡，真正执行该 Linear 前包装函数等待权重到位。一个 series 是一组同构 Linear，实现要求登记层号**连续**，且在 `prefetch_step = 1` 时至少需要 **3 层**（不连续的特殊层不能直接组成合法 series）。「仅允许 P 节点开启」的源码设计理由是希望用较重的 prefill 计算尽量遮盖广播耗时（小批 decode 重叠窗口更少；可重叠区间取决于调用位置，不保证总能完全隐藏）。

```wiki-diagram
file: layer-sharding
```

权重分配依赖单独构造的 `shard_weight` 通信组（不是直接复用原 TP 组）：FlashComm2 分支传入其投影 TP 分组信息，普通分支传入全局 TP 分组信息，构造函数按 PP 与模块分片位置重排 rank（有模块 TP 分组时组大小 `K = world_size / (PP × 模块 TP 大小)`）；DSA-CP 的 P 侧传入 `None`，按完整复制模块在同一 PP 阶段内建组。

## 显存与通信账、冲突边界及向新权重切换机制的迁移

**显存与通信示意账（DeepSeek-V3/R1 61 层 `o_proj`、W8A8、16 卡、TP16、PP1，非实测）**：按 `o_proj` 形状 `[7168, 128 × 128]` 计共 `117,440,512` 个 int8 元素，单层 `112 MiB`，61 层全量 `6,832 MiB`（约 `6.67 GiB`）。若 61 层连续进入同一 `K = 16` 组按层号取模，各卡预算分化如下（全组平均 `651 MiB` 与 `15/16` 均值均不能替代单卡预算）：

| 组内 rank 分组 | 常驻层数与显存 | + 两份整层窗口 | 单卡总预算（相对全量） | 单卡每次前向接收广播量 |
| --- | --- | --- | --- | --- |
| `rank 0–12`（前 13 张最高卡） | `4` 层（`448 MiB`） | `224 MiB` | **`672 MiB`**（约省 `6.0 GiB`，格式/scale/额外分配另计） | `57 × 112 = 6,384 MiB`（约 `6.23 GiB`） |
| `rank 13–15`（后 3 张卡） | `3` 层（`336 MiB`） | `224 MiB` | `560 MiB` | `58 × 112 = 6,496 MiB`（约 `6.34 GiB`） |

每次非本地层仍广播整份 `112 MiB` 权重，小批短序列很难摊平；源码在未配 FlashComm2 / DSA-CP 时启用也会告警性能显著退化。

**冲突与模型边界**：
- **与 row-parallel 分支的抢占**：进入 row-parallel 分派后，DSA-CP 的 P 侧 `o_proj` 会先被 `ShardedCPRowParallelOp` 认领，不再落到后面的细粒度 `o_proj` TP、[matmul-allreduce](enable-matmul-allreduce.md) 或 FlashComm2 分支——这一判据只检查 DSA-CP 与实例角色，不检查 `layer_sharding` 列表是否实际包含 `o_proj`（选择执行实现与登记权重分片是两回事）。
- **示例边界与文档残留**：旧 feature guide 与 DeepSeek-V3.2 教程给出 FlashComm1 搭配 `["q_b_proj", "o_proj"]` 的 DSA-CP 示例，旧 GLM5 教程则限制 FlashComm1 下不得包含 `o_proj`；新版仓库的个别模型教程（如 `GLM5.2.md`）或旧目录页仍留有历史示例字样，不能据此误判旧功能仍存在。

**新版本的演化去向（权重切换与 PCP 切分）**：
- `v0.23` 曾并存两套角色判定：`layer_shard` 要求精确 `kv_producer`，`o_proj_tp` 要求无 KV 传输或精确 `kv_both`；到了 `v0.26` 与后续 `full_o_proj` 判定，范围改为「无 KV 配置或具备 producer 角色（含 `kv_both`）」，兼具实现与角色范围变化。
- 新版受支持的权重切换机制由 `vllm_ascend/weight_switch/linear.py` 与 `o_proj.py` 承接（PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814) 将旧 `tp_weight_switch.py` 拆分并将 `TPWeightSwitchMixin` / `supports_tp_weight_switch` 改名为 `WeightSwitchMixin` / `supports_weight_switch`，适用域从 TP 扩展至多并行域）：前向异步 All-Gather 到完整权重缓冲、计算前等待、用完把参数视图切回本地分片（完整缓冲保留在池中复用，不等于立即释放显存）。需要按 PCP 组切同层输出投影见 [enable_pcp_o_proj_weight_sharding](enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)。

**放到 GLM 双机（`db701c1f` 固定基线）**：该部署为混部、无 KV 传输配置（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)），在 `db701c1f` 上给 `layer_sharding` 传非空列表会直接触发启动报错：
> additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.

即使改成 P 实例并打开 DSA-CP 也行不通：GLM 主干中 34 层 KDA 与 11 层稀疏 MLA 交错，其专用 SFA 子类在 `db701c1f` 构造时明确拒绝 DSA-CP（抛 `does not yet support DSA context parallelism`；MTP 共用该后端时同样受限），且交错的 11 层也不满足连续层号 series 约束（GLM 权重预算统一见[每张卡上放了什么](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)）。

## 对照源码

下表汇总 `layer_sharding` 在四个基线版本的存在状态与新版权重切换替代关系，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| `layer_sharding` 键与实现 | 扁平层名列表，默认 `None`；仅允许 `kv_producer` [C1][C2] | **已删除**（PR #11953），`.get()` 忽略 [C32] | **已删除**，通常拒收（`vllm_omni` 告警过滤）[C51] | 同 `v0.30.0` [C53] | 升级须删键，不恢复按层广播 [!] |
| 全量/切分权重替代路径 | FlashComm2 / DSA-CP + `layer_shard_linear.py` | FlashComm2 同步删除；`o_proj_tp` 角色判定放宽 [C30] | `weight_switch` + 默认 `True` 的 `enable_pcp_o_proj_weight_sharding` [C50] | 同 `v0.30.0` [C52] | 新开关切同层 PCP，不是按层轮放的同义替代 |
| 废弃与文档状态 | 发版列入 Ready to Deprecate [S18] | `feature_guide/index.md` 偶有残留目录 | 个别模型教程残留旧文字 [S23] | 同左 | 文档残留不代表功能恢复 |

- **v0.23.0 归属、窗口、建组与登记链路**：`ascend_config.py#L105-L112`（来源 1、24）、`platform.py#L338-L346`（来源 2）、`layer_shard_linear.py#L15-L16, #L39-L152, #L168-L174, #L211-L253, #L285-L296`（来源 3–6、34–35、48）定义按层取模归属、加载期临时全量缓冲与两份窗口、连续层号约束与等待；`parallel_state.py#L191-L226` 与 `utils.py#L1293-L1317, #L1515-L1564`（来源 9–12、40）对应空列表仍建组及角色判定；登记与预取调用见 `linear_op.py`、`mla_v1.py`、`sfa_v1.py`、`flashcomm2_oshard_manager.py`、`rfork_loader.py`（来源 7–8、13–14、42、47、49）[C4]。文件迭代与空加载函数关系见 `vllm@0fc695fc`（来源 45–46）[D]。
- **GLM 拒绝、移除与新版权重切换**：GLM 专用后端拒绝 DSA-CP 见 `db701c1f:indexer_kpool_mla_v1.py#L557-L571`（来源 41）；旧版指南、模型教程与发布说明见来源 15–20、29、31 [S15][S17]；新版 `weight_switch` 拆分与 `enable_pcp_o_proj_weight_sharding` 见来源 21–22、25–28、36–39、43–44 及 `v0.30.0`/`main` 锚点（来源 50–53）[C22][D]。
- **待核**：61 层显存与 6.23–6.34 GiB 通信账均为维度与量化口径静态推导，本仓库无 NPU 实机吞吐/时延与启动加载峰值对照。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（8 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2026-01-08 · f7db812ed7514194f15ef479817997113bf115bd · PR [#5181](https://github.com/vllm-project/vllm-ascend/pull/5181) —— [refactor] Refactor the interface for shard weight and remove the flashcomm2 o_shared interface. (#5181)
  包含该提交的 tag：v0.13.0、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/distributed/parallel_state.py` +67 / −51（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +23 / −34（文本行变化）
  - `vllm_ascend/ops/{shared_weight_layer.py => layer_shard_linear.py}` +56 / −28（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +23 / −27（文本行变化）
  - `vllm_ascend/utils.py` +34 / −15（文本行变化）
- **移除**：2026-07-15 · 896012151dbaaa444e940f19106fde877d616dc9 · PR [#11953](https://github.com/vllm-project/vllm-ascend/pull/11953) —— [Refactor] remove layer sharding (#11953)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/ops/layer_shard_linear.py` +0 / −296（文本行变化）
  - `vllm_ascend/ops/flashcomm2_oshard_manager.py` +0 / −103（文本行变化）
  - `vllm_ascend/ops/linear_op.py` +1 / −72（文本行变化）
  - `vllm_ascend/distributed/parallel_state.py` +1 / −51（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +3 / −37（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["layer_sharding"]` |
| 类型 | `unknown` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:105` [C24] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
