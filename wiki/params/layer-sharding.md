---
id: layer-sharding
title: layer_sharding
type: param
summary: >-
  点名一组同构 Linear，让第 i 层的权重常驻在通信组内第 i % K 张卡上，其他卡前向时通过窗口接收广播。
  v0.23 固定代码只允许 P 节点使用非空列表；v0.26、rc2 与 main 固定代码已删除旧路径。
  GLM 双机基线是混部，非空配置会触发启动校验。
aliases:
  - Layer Sharding Linear
  - 层间权重分片
  - 按层切权重
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
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: conflicts-with
    note: >-
      进入 row-parallel 分派后，DSA-CP 的 P 侧 o_proj 先被 ShardedCPRowParallelOp 认领，
      不再继续选择后面的 matmul-allreduce 分支；该判据并不检查列表是否实际包含 o_proj
contradicts: []
updated: 2026-11-03T00:00:00.000Z
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

## 一句话

**v0.30.0rc2 对照：** 没有恢复旧 layer_sharding 顶层键或按层号广播完整权重的分派；正常配置拒收，发现 vllm_omni 时仅告警过滤。rc2 另有默认 True 的 PCP O-projection 权重切分，覆盖 SFA-PCP 与 DSA-PCP；它沿 PCP 域切同一层权重，不是此页历史的“不同层轮流归不同卡”，旧配置不能直接迁成同义开关。

`layer_sharding` 接一个**层名列表**——不是官方表写的 dict——把这些名字对应的 Linear 权重按层号轮流分到一个通信组的 K 张卡上：第 i 层的这块权重在组内 rank i % K 上常驻，其余卡登记时先释放这块完整权重的存储，前向时靠异步 broadcast 提前一层取回。默认 None，也就是不开。

它面向旧版 PD 分离的 P 实例，尤其是同类投影在许多层中重复占用显存的深层模型。非空列表要求角色精确为 kv_producer；通过这道检查后，还要看模型是否登记了这些层、节省的容量能否抵偿广播开销。吞吐和时延收益不能只由开关推出。

**存在范围。** v0.23 维护快照 2c59ff10 和本站 GLM 基线 db701c1f 都有这条路径；它在更早的 v0.13 系列已经出现，不能把 v0.23 当成首次引入。v0.23 发布说明将它列为待废弃；删除提交 #11953 已进入 v0.24.0rc1 tag，本站固定的 v0.26、rc2 与 main 也都没有旧实现。版本谱系记录引入与删除提交，具体使用条件按各版本源码核对。

**新版对旧键的处理不同。** v0.26 的普通配置类忽略这个未知键，不执行旧权重切分；main 与 rc2 通常拒收未知顶层键，能发现 vllm_omni 时先警告再过滤。忽略或过滤只描述此键的处理，服务能否启动仍取决于其他配置和资源。

**本站 GLM 双机用不到它。** 这套部署是混部、没有 KV 传输配置，在 db701c1f 上填写非空列表就会触发启动校验。改成 P 实例也不能据此推断支持：该固定 GLM 后端明确拒绝 DSA-CP，见「开了的代价」末段。

官方旧版入口：[Layer Sharding Linear Guide](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/layer_sharding.html)、[Additional Configuration](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)、[Release Notes](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)。配置总表仍存在于新版文档，但旧 layer_sharding 字段和实现已移除。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | 有 | **已删除**，此键被忽略 | **已删除**，通常拒收此键 | main / rc2 的 Omni 兼容分支会告警过滤；这些行为均不会恢复旧权重切分 |
| 实际类型 / 默认值 | 按层名列表使用，默认 None | — | — | 官方表的 dict / {} 与使用方式不符；旧构造器不做列表类型校验，字典迭代会取键，且 FlashComm2 的精确列表校验可继续报错 |
| 取值 | 层名，取 prefix 最后一段，如 o_proj、q_b_proj | — | — | MLA / SFA 登记点找不到名字会告警并跳过；不能把这条局部行为理解成所有错误配置都不报错 |
| 子键 | **没有**，它是扁平列表 | — | — | 不存在「dict 里有哪些键」这回事；`prefetch_step` 在两个注册点都写死 1，用户无法调 |
| 权重归属 | 第 `i` 层落在组内 rank `i % K` | — | — | K 是 `shard_weight` 组大小，不是 TP size；TP 切层内、它切层间，两者正交 |
| 常驻缓冲 | `prefetch_step + 1 = 2` 份整权重 / 每个 series | — | — | 等大层的最高卡预算是 `ceil(层数/K)×单层 + 2×单层`，不是简单降到1/K；层数少时两份缓冲会吃掉大半收益 |
| 启用前提 | 非空列表要求角色精确为 kv_producer | — | — | 混部、kv_both、D 节点会被这道校验拒绝；空列表跳过该校验 |
| 配 FlashComm2 时取值 | 只能严格等于 `["o_proj"]`，否则 `ValueError` | FlashComm2 本身也已从 `vllm_ascend/` 删除 | 同左 | 想同时切 `q_b_proj` 就不能开 FlashComm2，只能走 DSA-CP 那条路 |
| 配 RFork 时 | 告警后绕过 RFork，退回默认 loader | — | — | 不再从 seed 传权重；默认 loader 仍可失败，耗时取决于存储和缓存 |
| 官方状态 | 已列入 Ready to Deprecate，与 FlashComm2 同批 | 已执行 | 已执行 | 新部署不要引入；已有部署要准备迁移 |

## 为什么存在

深层模型里有一类权重矩阵，**每层结构相同、数值各不相同**。例如 DeepSeek-V3/R1 这类 61 层模型的 o_proj：所述旧 FlashComm2 或 DSA-CP 路径在执行投影时需要完整矩阵；如果每张卡一直保存所有层的完整矩阵，就会积累 61 份常驻占用。执行到一层时需要完整权重，并不等于所有层必须同时完整常驻；按层分配和提前广播正是利用这个差别减少常驻容量。

layer_sharding 的做法是换一个维度切：**TP 切的是层内（一个矩阵切给多张卡），它切的是层间（多个矩阵轮流放）**。它和 [PP（流水线并行）](../concepts/pipeline-parallel.md#pp-是什么)都按层分，但 PP 连计算一起分，阶段之间传递后续计算所需的中间状态；它只分「权重存在哪张卡」，组内各卡仍执行这组层，传的是权重本身。注册时，不归本卡的完整权重被换成单元素占位张量，参数加载函数也变为空操作。这能跳过向该参数写入权重，但文件迭代器仍可能先读取整文件或取得张量，不能据此保证省掉磁盘读取。

前向时，注意力后端调用预取入口，发出异步 [Broadcast](../concepts/collective-communication.md#broadcast)：常驻卡把下一层权重发给组内其余卡。真正执行某个 Linear 前，包装函数等待它需要的权重到位。登记点把预取距离设为 1，也就是提前一层；可重叠的计算区间由调用位置决定，并不保证广播总能完全隐藏。一个 series 是一组同构 Linear；这份实现还要求登记层号连续，并且预取距离为 1 时至少有 3 层，不能把不连续的特殊层直接当成合法 series。

```wiki-diagram
file: layer-sharding
```

「只允许 P 实例使用非空列表」是启动期硬校验。源码注释给出的理由是，希望用较重的 prefill 计算隐藏广播。小批 decode 可供重叠的计算通常更少；这里的限制是实现选择，不能进一步推出所有硬件和批次的耗时差都相同。

权重分配组是单独构造的 shard_weight 组。FlashComm2 分支把其投影 TP 分组信息传给构造函数；普通分支传入全局 TP 分组信息。构造函数再按 PP 与模块分片位置重排这些 rank，得到负责保存同一类权重的组；它不是直接复用原 TP 通信组。有模块 TP 分组时，组大小按 world_size / (PP × 模块 TP 大小) 计算。DSA-CP 的 P 侧传入 None，按完整复制模块的情况在同一 PP 阶段内建组。

建组判据是 layer_sharding 不为 None，所以空列表也会进入建组分支；启动期 P 侧校验却先跳过空值。空列表因此不登记任何层，但仍可能创建权重通信组，不能把它理解为所有初始化步骤都被跳过。

## 开了的代价

**显存这笔账（示意预算：DeepSeek-V3/R1 的61层，W8A8，16卡、TP16、PP1）。** 沿用 `o_proj` 形状 `[7168, 128×128]`，共有117,440,512个 int8 元素，单层112 MiB；61层合计6832 MiB，约6.67 GiB。假设这些层从0编号、都进入同一个 K=16 的分配组，按层号取模后，rank0–12各留4层，rank13–15各留3层。再加每卡两份整层窗口224 MiB，前13卡是448+224=**672 MiB**，后3卡是336+224=**560 MiB**。651 MiB只是全组平均，做容量预算要按最高卡672 MiB；最高卡相对全量约省6.0 GiB。模型维度和量化载荷是这个算例的前提，实际格式、scale及额外分配须另计。[D]

**通信这笔账。** 持有4层的卡每次前向要接收其余57层，共57×112=6384 MiB；持有3层的卡接收58层，共6496 MiB，约6.23–6.34 GiB。按15/16折算只能得到全组平均，不能代表每张卡。一次非本地层广播仍搬整份112 MiB权重，需要由提前一层的计算尽量遮住；批次小、序列短时较难摊平通信成本。源码在没有 FlashComm2 / DSA-CP 时启用会告警性能显著退化。[C1][D]

**和谁抢 o_proj。** 进入 row-parallel 分派后，DSA-CP 的 P 侧 o_proj 会先被 ShardedCPRowParallelOp 认领，不再落到后面的细粒度 o_proj TP、[matmul-allreduce](enable-matmul-allreduce.md) 或 FlashComm2 分支。这个条件只检查 DSA-CP 和实例角色，并不检查层名列表里是否实际包含 o_proj；选择执行实现与登记权重分片是两件事。

**官方示例有模型边界。** 旧 feature guide 的 DSA-CP 示例把 FlashComm1 与 q_b_proj、o_proj 列表一起使用；DeepSeek-V3.2 教程也给出该列表。旧 GLM5 教程却限制 FlashComm1 下不能包含 o_proj。前者证明存在这种使用示例，不能替代 GLM 的后端支持检查；本站 GLM 基线的明确拒绝条件见后文。

**升到 main 或 rc2，旧键通常会被拒收。** AscendConfig 使用 Pydantic 的 extra="forbid"；旧 layer_sharding 不在允许预先过滤的非用户字段名单里。v0.26 固定构造器则不读取这个键，留下它也不会执行旧分片。

**Omni 兼容分支会过滤这个旧键。** 构造配置前发现未知顶层键、并且能找到 vllm_omni 模块时，先告警再剔除这些键。该分支只避免这一类未知键错误，不能保证其他校验、模型加载或服务启动成功。

**新版怎样取得全量投影权重。** 旧 v0.23 中两个判定函数同时存在：layer_shard 路径要求角色精确为 kv_producer；o_proj_tp 路径则要求没有 KV 传输配置，或角色精确为 kv_both。v0.26 的 o_proj_tp 和 main 的 full_o_proj 判定改为没有 KV 配置，或具备 producer 角色（包括 kv_both）。这既有实现变化，也有角色范围变化，不能当成同一条件只改了名字。

新版受支持的权重切换路径让本地分片与完整视图共存：先异步 All-Gather 到完整权重缓冲，计算前等待，使用后把层的参数视图切回本地分片。完整缓冲可保留在池中复用；“切回分片”不等于立即释放那块完整缓冲。具体量化方法必须声明支持权重切换。

承接这件事的代码在 main 上也搬了家。`vllm_ascend/quantization/tp_weight_switch.py` 在 `78cd10de`（PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814)）里被拆成 `vllm_ascend/weight_switch/linear.py` 和 `o_proj.py`：`TPWeightSwitchMixin` 改名 `WeightSwitchMixin`，统一开关位 `supports_tp_weight_switch` 改名 `supports_weight_switch`，适用范围从 TP 一个并行域扩到了多个 [C22]。要在 main 上找这套机制，别再照 `tp_weight_switch` 这个名字搜。

**新版另有 [`enable_pcp_o_proj_weight_sharding`](enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md)，但不是同义替代。** 旧 main baa023ad 中它默认 False，只控制 SFA-PCP 的同层权重切分，不影响当时的 DSA-CP；rc2 默认 True，覆盖 SFA-PCP 与 DSA-PCP。两者都不是按层号轮流存整层权重。v0.26 没有这个开关；具体启用条件与视图切换统一见该参数页。[S27]

**新版文档仍可能留下旧限制。** 例如 baa023ad 的 GLM5.2 教程仍提到 layer_sharding，2ed6cbba 的 feature guide 目录还列出已删除页面。这些残留不能证明固定版本恢复了旧运行时功能。

**放到 GLM 双机：非空配置被拒绝，DSA-CP 也不是该固定后端的可用绕过办法。** 本站 GLM 双机（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）是混部，没有 KV 传输配置。db701c1f 的启动校验发现非空列表且实例角色不是 kv_producer，就抛出：

> additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.

登记入口包括 MLA、SFA 后端和 FlashComm2 的投影管理器，不能只检查前两者。本站 GLM 主干中 34 层 KDA 与 11 层稀疏 MLA 交错，稀疏 MLA 使用的专用类继承 SFA；该类在 db701c1f 的构造中明确检查 DSA-CP，并抛出“does not yet support DSA context parallelism”。因此，把实例改成 P，再打开 DSA-CP，不能成为这份固定代码的可用方案；也不能把交错的 11 层直接套进要求连续层号的容量算例。MTP 使用同一专用后端时也受此检查约束。GLM 现有权重预算统一见[每张卡上放了什么](../concepts/glm-5-3-flash-two-node.md#每张卡上放了什么)。

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
  包含该提交的 tag：v0.13.0、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/distributed/parallel_state.py` +67 / −51（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +23 / −34（文本行变化）
  - `vllm_ascend/ops/{shared_weight_layer.py => layer_shard_linear.py}` +56 / −28（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +23 / −27（文本行变化）
  - `vllm_ascend/utils.py` +34 / −15（文本行变化）
- **移除**：2026-07-15 · 896012151dbaaa444e940f19106fde877d616dc9 · PR [#11953](https://github.com/vllm-project/vllm-ascend/pull/11953) —— [Refactor] remove layer sharding (#11953)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
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

## 对照源码

### 源码位置

来源 3–6、34、35 定义归属、占位、连续层号约束和两份预取窗口。加载后处理会临时给非 owner 分配完整张量，广播真实权重并执行量化后处理，再建立窗口、释放不再需要的完整存储及 dummy；登记后的占位大小不能代表整个加载期的峰值。来源 45、46 展示文件迭代与模型加载的前后关系：空的参数加载函数不保证文件读取也被跳过。

来源 2、9、12 对应非空配置的 P 侧限制、空列表仍建组和 DSA-CP 角色判定；来源 40 同时列出旧版的两种角色条件，来源 21、30 给出新版条件。来源 7、14、42 对应登记入口；来源 47–49 对应预取调用与 Linear 执行前等待。来源 41 是固定 GLM 后端拒绝 DSA-CP 的直接依据。来源 43、44 展示新版 gather、等待、视图切换和缓冲复用。

来源 15–20 是旧版指南、配置表和模型示例。配置表的类型、指南的共享占位与零开销措辞须结合实现理解，不能直接当成运行时保证。来源 23、31 只证明文档残留；来源 25、26、28、32、37 解释各版未知键处理；来源 27、36、38、39 解释 PCP 新开关与旧按层广播的区别。来源 33 保存对应旧摘录，来源 24 是自动定义位置。以上为固定源码和文档推导，未提供 NPU 时延或启动实测。
