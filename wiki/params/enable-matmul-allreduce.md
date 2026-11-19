---
id: enable-matmul-allreduce
legacyAnchors:
  一句话: 它曾经融合什么，为什么自 v0.25.1rc1 起被移除？
  事实表: 对照源码
  为什么存在: 为什么能藏住通信延迟，以及旧版的派发次序陷阱
  开了的代价: 量化不兼容、GLM 双机推演与升级后的配置清理
title: enable_matmul_allreduce
type: param
summary: >-
  旧版行并行线性通算融合开关：将 RowParallelLinear 的「矩阵乘 + AllReduce」换为 npu_mm_all_reduce_base。
  v0.23.0/v0.24.0rc 可用，v0.25.1rc1 起移除；v0.26 忽略，v0.30.0 与 main 通常拒收（vllm_omni
  告警过滤）。
aliases:
  - matmul allreduce 开关
  - VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE
  - MatmulAllReduce 融合
chapters:
  - '13'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L167-L172'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L353-L365'
  - 'vllm-ascend@2c59ff10:vllm_ascend/envs.py#L69-L71'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L895-L896'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L739'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L420-L441'
  - 'vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L76-L93'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L5-L27
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L96-L96
  - >-
    vllm-ascend@2c59ff10:tests/e2e/pull_request/two_card/test_external_launcher.py#L209-L229
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L36
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L154-L159
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1735-L1779'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/linear_op.py#L311-L318'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L453-L459'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1557-L1563'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1611-L1660'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L7-L25
  - >-
    vllm-ascend@baa023ad:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - 'https://www.hiascend.com/developer/techArticles/20240729-1'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L167
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L74
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L167-L172'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L427-L441'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L127-L128
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353'
  - >-
    raw:sha256-de78bc688edcd6745a0372fb777edca498381112c27bf183d8a970fe9bb5ddfe.md#L1-L553
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/linear_op.py#L422-L430'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1850-L1910'
  - 'vllm-ascend@c09d3e20:vllm_ascend/config_utils.py#L43-L50'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/linear_op.py#L415-L423'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 行并行线性只算出部分和，必须 All-Reduce 合齐；本开关把这一对矩阵乘和归约换成一个融合算子
  - to: collective-communication
    kind: builds-on
    note: 该开关将矩阵乘与 All-Reduce 融合，理解其不改变计算语义，需要先理解 All-Reduce 合齐部分和的语义及其与融合实现的区别。
contradicts: []
updated: 2026-11-19T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-703d348dfed5c48687d7ecc8b88872ff05f85ddde437c775ada624d740514e88.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-d5c125851e3280b711281df305903b41288f91d920a6b6719b01d35509a91043.md
  - >-
    raw/sha256-de78bc688edcd6745a0372fb777edca498381112c27bf183d8a970fe9bb5ddfe.md
---

## 它曾经融合什么，为什么自 v0.25.1rc1 起被移除？

在仍支持此键的旧版本（`v0.23.0` 与 `v0.24.0rc1`）里，当 `TP > 1` 且该层负责归约（`reduce_results and tp_size > 1`）时，`RowParallelLinear` 普通路径先做本 rank 矩阵乘再调用 All-Reduce 合齐部分和；开启 `enable_matmul_allreduce`（默认 `False`）后，符合条件的这一对操作会被替换为昇腾 MC2 通算融合算子 `torch_npu.npu_mm_all_reduce_base`，争取让通信与计算重叠。融合保持目标运算语义，但实际精度、耗时和支持范围取决于具体算子与输入；`TP = 1` 时前提不成立，自动落回普通 `quant_method.apply`。旧版官方说明常把 A2、eager 列为受益场景（且 `v0.10.0rc1` 发布说明曾把它描述为 prefill 优化），但源码并不要求 eager，也不按请求阶段过滤，满足前提的 decode 同样会进入融合调用。

**自 `v0.25.1rc1` 起（PR #12119），该开关连同环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`、包装类 `MatmulAllreduceRowParallelOp` 及同族编译期融合 [fuse_allreduce_rms](fuse-allreduce-rms.md) 一并删除。** 升级后留着旧键在不同版本的后果相反：

- **`v0.26.0rc`**：`AscendConfig` 仍逐键 `.get()` 取值，顶层旧键被静默忽略，服务能启动但毫无融合效果；
- **`v0.30.0` 与 `main`**：`AscendConfig` 采用 `ConfigDict(extra="forbid")` 严格校验，且该键不在 `_NON_USER_INPUT_KEYS` 豁免名单中（同批下线的 `enable_flashcomm1` 有废弃告警与剥离，本键没有），传入该顶层键通常直接启动失败；唯一例外是环境里装有 `vllm_omni`（`importlib.util.find_spec("vllm_omni")` 非空）时，工厂会只打一条 warning 并过滤未知顶层键，更易让人误以为开关仍在生效。而残留环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 在新版中无人读取，一律静默忽略。旧键移除只代表昇腾侧旧行并行包装下线（与 FlashComm2、multistream overlap gate、weight prefetch 等同批退场，方向是将 TP 通信优化交回上游），不代表新版完全没有通算融合能力。

## 为什么能藏住通信延迟，以及旧版的派发次序陷阱

张量并行把 `RowParallelLinear` 的权重沿输入维切分，各 rank 只算出部分和，必须归约相加才能得到完整输出（见[TP 两种切法](../concepts/tensor-parallel.md#两种切法各算一遍拼起来还是加起来)）。普通路径里矩阵乘（主要占 Cube 单元）与 HCCL All-Reduce（主要占互联链路）串行执行，两者有交叠空间（也可能争用显存带宽，不能视为互不影响）。昇腾 MC2 算子族把通算流水化（如 `AllGatherMatMul`、`MatMulReduceScatter`、`MatMulAllReduce`，昇腾技术文章给出 GPT-3 整网约 10% 的参考量级）；`enable_matmul_allreduce` 让 `_get_row_parallel_op` 返回 `MatmulAllreduceRowParallelOp`，在 `apply_impl` 中直接调 `torch_npu.npu_mm_all_reduce_base(input_parallel, weight.t(), hcomm_info, bias=bias_)`。这里的 `bias` 是线性变换额外相加的偏置向量：仅在 TP rank 为 0 且未要求延后添加时传入当前计算，其他 rank 传入空值；要求延后添加时作为第二个返回值交给调用方。

融合争取缩短的是通信暴露在计算之外的等待时间。拿一组**教学示意数**（假设 2048 行、按 512 行切 4 块）来建立直觉：不融合时 2048 行全部算完才发整份部分和；理想切块流水下第 1 块算完即发、与第 2 块计算重叠，若前 3 块通信均被后续计算覆盖，则只剩最后 1 块通信暴露（约原通信阶段的 1/4）；只有 1 行时这种假设切法无法形成多块流水。注意：这里的 Python 调用并未传切块大小，源码也未披露 eager 算子内部通信算法，不能把图模式融合 pass 的 `compile_range.start > 512` 阈值（或 ReduceScatter + AllGather 描述）当作本开关的切块长、流量证明或小批次必然变慢的依据；比较收益须覆盖长 prefill、大 chunk 与不同 decode 批量实测。

旧版 `_get_row_parallel_op` 的派发次序是最容易踩的陷阱：

```wiki-diagram
file: enable-matmul-allreduce
```

- 细粒度 TP（`oproj_tensor_parallel_size` / `mlp_tensor_parallel_size`，其中细粒度 MLP TP 分支还要求 `down_proj` 且 `not is_moe_layer(prefix)`）与 [layer_sharding](layer-sharding.md) 的 `o_proj` 分支排在它前面，被它们认领的层轮不到本开关；
- `matmul_allreduce_enable()` 排在第五且**不做 prefix 过滤**，一旦为真即无条件返回——因此不仅 `o_proj`，`mlp.down_proj` 也会被替换，并且排在后面的 `flashcomm2_enable()` 与 `enable_sp()` 分支对这些行并行层永远不会走到（且没有任何冲突告警；这只影响被本分支认领的行并行层，不等于关闭整个模型的 SP 或 FlashComm2）。

此外，在 `v0.23.0` 中若开启 batch-invariant 模式，`override_envs_for_invariance()` 会把 `enable_matmul_allreduce` 强行改回 `False`，因为融合算子的分块规约次序随 batch 形状变化，与逐 batch 输出一致不相容。

## 量化不兼容、GLM 双机推演与升级后的配置清理

在仍支持的 `v0.23.0` 上开启时，推荐通过 `additional_config` 传入 JSON 布尔值 `true`（环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 为迁移期回落写法，默认 `"0"`、按 `bool(int(...))` 解析，传 `"true"` 会报 `ValueError`，且 `additional_config` 命中时环境变量静默失效、无冲突告警；而 `additional_config` 直接返回原值，不自动转换字符串类型）：

```bash
export HCCL_BUFFSIZE=500          # 所引旧版门禁用例的设置，不是所有负载的必需值
vllm serve <未量化的 BF16 模型> \
  --tensor-parallel-size 2 \
  --enforce-eager \
  --additional-config '{"enable_matmul_allreduce": true}'
```

这里使用未量化 BF16 模型、`--tensor-parallel-size 2`（触发 `tp_size > 1` 的下限）与 `--enforce-eager`（避开图模式同族融合 [fuse_allreduce_rms](fuse-allreduce-rms.md)）；所引旧门禁用例仅在 `Ascend910B`（A2）上运行，不能证明 A3/950 的兼容性或收益。

**为什么不能直接用于 W8A8 等量化路径**：融合分支直接把 `self.layer.weight.t()` 交给 `npu_mm_all_reduce_base`，完全绕过 `quant_method.apply`（仅当 `reduce_results` 或 `tp_size > 1` 不满足时才回退量化路径），因此不会自动带上反量化参数，也无法适配已改变权重排布的量化后端。

**放到 GLM 双机部署（历史例外 B 算例：固定镜像 `db701c1f`，默认关闭、官方双机教程未配）**：假如在 `db701c1f` 上强行开启，TP8 满足前提且前四条细粒度切分均未启用，仅计 R1 纯文本语言主干就有 **48 处**行并行线性会尝试进入融合分支（45 层 attention `o_proj` + 前 3 层稠密 MLP `down_proj`，对应 R1 91 次 TP8 All-Reduce 中的 48 次，见 [TP 通信账](../concepts/tensor-parallel.md#从一层走到整次前向r1-的通信账)；不含视觉塔与 MTP，词嵌入不经行并行，42 层共享专家 `down_proj` 由外层归约故 `reduce_results` 不成立，见[共享专家切法](../concepts/tensor-parallel.md#共享专家切法仍是列接行归约由外层安排)）。但按源码推演会在 W8A8 层卡死：

1. W8A8 动态量化在加载后把 `int8` 权重转成了「输入 × 输出」，融合分支再调一次 `.t()` 又变回「输出 × 输入」——以稠密 MLP `down_proj`（每卡输入 1536、输出 4096）为例，形状必然不匹配，且传入 `int8` 张量缺少任何反量化参数；
2. 哪些层是 `int8`：两版已核快照的稠密 MLP 均为 `int8`，KDA 投影按 BF16 加载，MLA `o_proj` 在 `9e55cbc8` 为浮点、`3121f187` 改为 `int8`（见[部署页](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)）；
3. 最早冲突落在第 0 层稠密 MLP `down_proj`（前 3 层 attention 为 KDA、MLP 为 `int8`），启动 profile 首次执行到此处即会不匹配（确切报错原文与是否存在更早硬件限制仍待真机验证）。仅看 KDA 层形状：R1 每次归约输入载荷为 `32,768 B`（`4 × 4096 × 2 B`），场景 M 的 DP0 一步 `6,048` 行载荷为 `47.25 MiB`（若沿用每块 512 行教学示意分别约 1 块与 12 块，不构成实际 eager 切块或调优门槛）。

**升级到 `v0.30.0` / `main` 时的配置清理**：这两版的 `_get_row_parallel_op` 只保留 `wo_b`、`down_proj`、`o_proj` 三条细粒度 TP 分支；旧键既不在 `AscendConfig` 也不在 `_NON_USER_INPUT_KEYS` 豁免名单，必须从 `--additional-config` 与环境变量中删除。注意官方文档的环境变量迁移表虽已删去 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`（从 9 行减为 7 行），但代码已废弃剥离的 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 仍留在旧表里，排查时以代码为准。

## 对照源码

下表对照 `enable_matmul_allreduce` 在四个固定版本快照中的移除状态、行并行派发分支与互斥规则：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 开关与环境变量 | 存在（默认 `False`，`additional_config` 优先于 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`）[C1][S9] | 已整体移除（PR #12119），顶层键被 `.get()` 静默忽略 [C24] | 已移除，通常被 `extra="forbid"` 拒收；可发现 `vllm_omni` 时告警过滤 [C34][C35][!] | 同 `v0.30.0` [C37] |
| 行并行派发分支 | 排在细粒度 TP / `layer_sharding` 之后、`flashcomm2` / `enable_sp` 之前 [C5] | 已删融合包装类，SP 仍由昇腾 pass 注册 [C25] | `_get_row_parallel_op` 仅剩 `wo_b` / `down_proj` / `o_proj` 三条细粒度 TP 分支 [C33] | 同 `v0.30.0` [C36] |
| 落地算子与前提 | `torch_npu.npu_mm_all_reduce_base`，条件 `reduce_results and tp_size > 1` [C6] | — | — | — |
| batch-invariant 互斥 | `override_envs_for_invariance()` 强行置回 `False` [C7] | — | — | — |

- **旧版解析、派发与文档差异**：`v0.23.0` 的 `additional_config` 原值返回与环境变量 `bool(int(...))` 解析见来源 2、3；`v0.23.0` 官方参数表见[线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)（来源 8、9），`v0.10.0rc1` 发布说明写 prefill 优化而 `v0.23.0` 代码不区分阶段见来源 13 [S13][!]；昇腾 MC2 通算融合参考量级见来源 20 [S20]；2048 行按 512 行切 4 块为理想流水假设 [A]；PR #12119 移除记录与迁移表变化见来源 18、22 [S18][S22]，TP 通信优化交回上游为结合同批下线清单推断 [I]。
- **GLM 双机与待核**：`db701c1f` 默认关闭、双机教程未配及 W8A8 动态量化权重排布转置见来源 26–29，第 0 层稠密 MLP `down_proj` 形状与反量化冲突为静态源码推导 [D]。**待核**：GLM W8A8 下强制开启本开关在设备上的确切报错原文，以及不同 batch 规模下的 eager 切块与收益实测。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（3 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2026-05-21 · 958daf83205ecad0afec3784be0b2a8b38725cd8 · PR [#9064](https://github.com/vllm-project/vllm-ascend/pull/9064) —— [Refactor]: migrate env vars to AscendConfig (#9064)
  包含该提交的 tag：v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ops/fused_moe/moe_comm_method.py` +347 / −347（文本行变化）
  - `vllm_ascend/utils.py` +41 / −19（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +7 / −7（文本行变化）
  - `vllm_ascend/batch_invariant.py` +5 / −6（文本行变化）
  - `vllm_ascend/patch/platform/patch_balance_schedule.py` +21 / −5（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +0 / −159（文本行变化）
  - `vllm_ascend/ops/linear_op.py` +0 / −45（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −40（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +0 / −5（文本行变化）
  - `vllm_ascend/utils.py` +0 / −4（文本行变化）

当前含该标识符的 tag：v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_matmul_allreduce"]` |
| 类型 | `unknown` |
| 默认表达式 | `ascend_envs.VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` |
| 定义 | `vllm_ascend/ascend_config.py:167` [C21] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
