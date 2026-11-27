---
id: enable-matmul-allreduce
legacyAnchors:
  一句话: 它曾经融合什么，为什么自 v0.25.1rc1 起被移除？
  为什么存在: 为什么能藏住通信延迟，以及旧版的派发次序陷阱
  开了的代价: 把矩阵乘与归约合成一步时量化权重会卡在哪里
  量化不兼容glm-双机推演与升级后的配置清理: 把矩阵乘与归约合成一步时量化权重会卡在哪里
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
  - additional_config.enable_matmul_allreduce
  - npu_mm_all_reduce_base
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
  - to: ascend-config-system
    kind: builds-on
    note: 该历史开关位于 additional_config 顶层，v0.30.0 与 main 启用 AscendConfig 严格校验后保留旧键会触发启动报错
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

**`enable_matmul_allreduce` 曾用于把行并行线性层（`RowParallelLinear`）的「本卡矩阵乘 + 跨卡 AllReduce 求和」两步合为一个融合算子 `torch_npu.npu_mm_all_reduce_base`；该 JSON 键与旧环境变量消费点自 `v0.25.1rc1`（PR #12119）起已全部移除，`v0.30.0` 与 `main` 常规环境会直接拒收残留 JSON 键报错（装有 `vllm_omni` 时告警过滤），残留环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 则无人读取、静默失效。**

在仍支持此键的 `v0.23.0` 与 `v0.24.0rc1` 中，当张量并行满足 `reduce_results and tp_size > 1` 时，开启该开关（默认 `False`）会把两步替换为单次融合调用，争取让计算与通信重叠（`TP = 1` 时前提不成立，自动退回普通 `quant_method.apply`）。旧文档虽常将 Atlas A2 与 eager 模式列为典型受益场景（早期 `v0.10.0rc1` 发布说明曾称其为 prefill 优化），但源码既不强制 eager，也不按请求阶段过滤，满足条件的 Decode 步同样会进入融合算子。

该开关连同包装类 `MatmulAllreduceRowParallelOp`、编译期融合 [fuse_allreduce_rms](fuse-allreduce-rms.md) 同批退场，目的是将 TP 通算优化收拢交回上游，并不代表新版失去了通算融合能力。

## 事实表

清理旧启动脚本或核对历史分支行为时，可速查下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史配置入口 | `additional_config["enable_matmul_allreduce"]`（优先）或环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` | 旧版 JSON 原值返回不转类型；环境变量默认 `"0"` 按 `bool(int(...))` 解析，传 `"true"` 报 `ValueError` |
| 当前版本状态 | 自 `v0.25.1rc1`（PR #12119）起整体删除 | `v0.30.0` 与 `main` 不豁免该 JSON 键，常规环境直接启动报错（`vllm_omni` 告警过滤）；环境变量静默忽略 |
| `v0.26.0rc` 过渡行为 | [AscendConfig](../concepts/ascend-config-system.md) 逐键 `.get()` 静默忽略 | 启动成功只代表未拦截未知键，融合算子并未运行 |
| 历史生效前提 | `v0.23.0` 下 `reduce_results and tp_size > 1` 且为未量化浮点权重 | 融合分支直接调 `self.layer.weight.t()` 绕过 `quant_method.apply`，W8A8 等量化层缺少反量化参数且形状转置不匹配 |
| 派发截断与互斥 | `_get_row_parallel_op` 排第五且无 prefix 过滤；`VLLM_BATCH_INVARIANT=1` 强制将其改回 `False` | 开启后 `o_proj` 与 `mlp.down_proj` 均被抢占，排在后面的 `flashcomm2` / `enable_sp` 行并行分支走不到且无告警 |

## 为什么能藏住通信延迟，以及旧版的派发次序陷阱

张量并行把 `RowParallelLinear` 的权重沿输入维切分，各 rank 只算出部分和，必须归约相加才能得到完整输出（见[TP 两种切法](../concepts/tensor-parallel.md#两种切法各算一遍拼起来还是加起来)）。普通路径里矩阵乘（主要占 Cube 单元）与 HCCL All-Reduce（主要占互联链路）串行执行，两者存在交叠空间（并发执行时仍共享片上与 HBM 显存带宽，并非完全无争用）。

昇腾 MC2 算子族把计算和集合通信改成切块流水（如 `AllGatherMatMul`、`MatMulReduceScatter`、`MatMulAllReduce`，昇腾技术文章给出 GPT-3 整网约 10% 的参考量级）。开启 `enable_matmul_allreduce` 后，`_get_row_parallel_op` 返回 `MatmulAllreduceRowParallelOp`，在 `apply_impl` 中直调 `torch_npu.npu_mm_all_reduce_base(input_parallel, weight.t(), hcomm_info, bias=bias_)`。偏置向量 `bias` 仅在 `TP rank == 0` 且未要求延后相加时传入当前算子，其余 rank 传空值；若调用方要求延后加偏置，则作为第二个返回值原样交回。

用一组**教学示意数**（设本步有 `2048` 行、按 `512` 行切 `4` 块）理解流水收益：不融合时要等 `2048` 行全部算完才能发部分和；理想流水下第 `1` 块算完即发、与第 `2` 块矩阵乘重叠，若前 `3` 块通信都被计算掩盖，裸露在外的通信等待就只剩最后 `1` 块（约原通信耗时的 $1/4$），而单行输入无法形成多块流水。注意 Python 调用并未传入切块尺寸，源码也未公开 eager 算子内部通信算法，不能拿图融合 pass 的 `512` 区间门槛当成这里的切块长，实际收益须在长 Prefill 与不同 Decode 批量下分别实测。

旧版 `_get_row_parallel_op` 的派发顺序藏着三个容易忽略的约束：

```wiki-diagram
file: enable-matmul-allreduce
```

- **前四条细粒度规则优先认领**：细粒度 TP（`oproj_tensor_parallel_size` 与非 MoE 层的 `mlp_tensor_parallel_size`）及 [layer_sharding](layer-sharding.md) 的 `o_proj` 分支排在前面，已被它们接管的行并行层不会走到本开关。
- **第五条无前缀过滤，直接截断后两条**：`matmul_allreduce_enable()` 排第五且不检查层名前缀，一旦为真，普通 `o_proj` 与 `mlp.down_proj` 都会被它接管。排在后面的 `flashcomm2_enable()` 与 `enable_sp()` 行并行分支便再也走不到，且不会打印任何冲突告警（仅影响被本分支接管的行并行层，不等于关掉整网 SP 或 FlashComm2）。
- **批不变性模式强制覆盖**：在 `v0.23.0` 开启 `VLLM_BATCH_INVARIANT=1` 时，`override_envs_for_invariance()` 会把 `enable_matmul_allreduce` 强行改回 `False`，避免分块归约次序随批次大小改变输出。

## 把矩阵乘与归约合成一步时量化权重会卡在哪里

**融合分支绕过了 `quant_method.apply`，只认未转置的浮点权重。** 开启本开关且满足 `reduce_results and tp_size > 1` 时，代码直接把 `self.layer.weight.t()` 塞进 `npu_mm_all_reduce_base`，既不附带任何反量化缩放参数，也不会适配量化方法改写过的权重内存排布。

把「静态结构上有多少候选层」与「运行时执行到哪一层就会报错」分开核对，以双机 `TP8` 下的历史 `GLM-5.3-Flash` 纯文本主干为例（镜像 `db701c1f` 默认关闭且官方教程未配，以下为静态源码推演）：

1. **结构上的候选规模（`48` 处）**：`TP8` 满足多卡归约前提且未开前四条细粒度切分时，主干内共有 **48 处** `RowParallelLinear` 在结构上符合接管条件——即 `45` 层注意力 `o_proj` 加前 `3` 层稠密 MLP `down_proj`（占 R1 全网 `91` 次 `TP8 All-Reduce` 中的 `48` 次，见 [TP 通信账](../concepts/tensor-parallel.md#从一层走到整次前向r1-的通信账)；不含视觉塔与 MTP，词嵌入不经行并行，`42` 层共享专家 `down_proj` 因外层归约使 `reduce_results` 为假，见[共享专家切法](../concepts/tensor-parallel.md#共享专家切法仍是列接行归约由外层安排)）。
2. **权重方向翻转与缺反量化实参**：W8A8 动态量化在加载完成后已把 `int8` 权重转置成「输入维 × 输出维」布局；融合分支再调一次 `.t()` 又把它翻回「输出维 × 输入维」。以稠密 MLP `down_proj`（每卡输入 `1536`、输出 `4096`）为例，传入算子的矩阵内维当场失配，且裸 `int8` 权重缺少反量化 scale 实参。
3. **首个运行冲突点与浮点层载荷口径**：两版量化快照的前 `3` 层稠密 MLP 均为 `int8`，`34` 层 KDA 投影为 `BF16`，`11` 层 MLA `o_proj` 在 `9e55cbc8` 为浮点、在 `3121f187` 为 `int8`（见[部署页](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)）。因此前向（含启动期 profile 试跑）并走不完 `48` 处候选，执行到**第 `0` 层稠密 MLP `down_proj`** 这第一个不兼容量化层时，就会触发形状或算子实参不兼容异常（静态源码推演，未采集真机报错原文）。仅单独看浮点 KDA 层的通信载荷：单请求 R1 每次归约输入为 $4 \times 4096 \times 2\text{ B} = 32{,}768\text{ B}$，并发场景 M 的 DP0 单步 `6,048` 行输入为 `47.25 MiB`（套用前文 `512` 行教学示意分别约 `1` 块与 `12` 块，仅作体量对照）。

## 旧版启用写法与升级后的配置清理

在仍保留此键的 `v0.23.0` 历史分支上测试未量化模型时，应通过 `additional_config` 传入 JSON 布尔值 `true`（直接取原值，不转字符串）；旧环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 默认 `"0"` 并按 `bool(int(...))` 解析，误传 `"true"` 会抛 `ValueError`，且一旦 JSON 配了同名键就会把环境变量静默盖掉：

```bash
export HCCL_BUFFSIZE=500          # 所引旧版门禁用例的设置，不是所有负载的必需值
vllm serve Qwen/Qwen3-8B \
  --tensor-parallel-size 2 \
  --enforce-eager \
  --additional-config '{"enable_matmul_allreduce": true}'
```

该命令仅对应 `v0.23.0` 未量化 `BF16` 模型场景（`--enforce-eager` 避开图模式同族融合 [fuse_allreduce_rms](fuse-allreduce-rms.md)；旧门禁用例仅跑在 Atlas A2 上，本工作区无 NPU 实机验证）。

升级到 `v0.30.0` 与 `main` 时，`_get_row_parallel_op` 仅保留 `wo_b`、`down_proj`、`o_proj` 三条细粒度 TP 分支；必须从 `--additional-config` 与启动脚本环境变量中一并删掉 `enable_matmul_allreduce` 及 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`（顺带留意官方环境变量迁移表虽已删去本项，但仍残留已退役的 `VLLM_ASCEND_ENABLE_FLASHCOMM1`，清理时以代码定义为准）。

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
  包含该提交的 tag：v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ops/fused_moe/moe_comm_method.py` +347 / −347（文本行变化）
  - `vllm_ascend/utils.py` +41 / −19（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +7 / −7（文本行变化）
  - `vllm_ascend/batch_invariant.py` +5 / −6（文本行变化）
  - `vllm_ascend/patch/platform/patch_balance_schedule.py` +21 / −5（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
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
