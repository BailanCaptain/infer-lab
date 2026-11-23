---
id: fuse-allreduce-rms
legacyAnchors:
  一句话: 它曾经融合什么，为什么被删除？
  事实表: 对照源码
  为什么存在: 为什么和序列并行冲突，v0.23.0 的默认值为什么是分裂的？
  开了的代价: 升级报错、编译分区代价，以及 GLM 双机为什么配不上？
title: fuse_allreduce_rms
type: param
summary: >-
  旧版 ascend_compilation_config 开关：将 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm
  融成单算子；因与序列并行争抢子图而官方默认关闭（v0.23.0 实际注册逻辑存在默认值分裂），自 v0.25.1rc1 起已整体移除，v0.26
  静默吞掉、v0.30.0 与 main 严格校验直接报错。
aliases:
  - Matmul AllReduce RMSNorm 融合
  - MatmulAllReduceAddRMSNormPass
chapters:
  - '13'
sources:
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L131
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L134-L159
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/graph_fusion_pass_manager.py#L36-L79
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/sequence_parallelism.py#L75-L99
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L37-L44'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L659'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L491-L521'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L167-L173'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L135-L142
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1223-L1223'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L103-L118'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L502-L505'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L43-L50'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L793-L797'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L108-L115
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L508
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L607'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L74
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2129-L2241'
  - >-
    raw:sha256-4824a90ea53c298a6c32c3e3ebb80e6bf26742e51f506e6e7d3ca8435d1da9c6.md#L1-L452
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L114-L175'
  - 'vllm-ascend@7d825229:vllm_ascend/config_utils.py#L31-L50'
  - 'vllm-ascend@2c59ff10:csrc/mc2/matmul_allreduce_add_rmsnorm/op_host/matmul_allreduce_add_rmsnorm_tiling.cpp#L303-L381'
  - 'vllm-ascend@2c59ff10:csrc/mc2/matmul_allreduce_add_rmsnorm/op_kernel/matmul_allreduce_add_rmsnorm_aiv_kernel.h#L188-L267'
  - 'vllm-ascend@2c59ff10:csrc/mc2/matmul_allreduce_add_rmsnorm/op_kernel/matmul_allreduce_add_rmsnorm_aiv_kernel.h#L431-L568'
  - 'https://huggingface.co/Qwen/Qwen3-0.6B/blob/c1899de289a04d12100db370d81485cdf75e47ca/config.json'
  - 'vllm@84030bbe:vllm/compilation/passes/pass_manager.py#L143-L164'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1162-L1178'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L112-L130'
  - 'vllm-ascend@c09d3e20:vllm_ascend/config_utils.py#L43-L50'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1895-L1910'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L120-L136'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/compilation/graph_fusion_pass_manager.py#L52-L79
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: alternative-to
    note: >-
      同一个 Matmul+AllReduce 瓶颈的两条路——那个开关在 eager 里直接换用
      npu_mm_all_reduce_base、不吸收后面的 Add+RMSNorm，本项走编译期 pattern 匹配、连 RMSNorm
      一起吃掉；main 上两条一起被删
contradicts: []
updated: 2026-11-19T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-1b13fa05669cfc193ab3a059db39c1352f3711b34153ad83321ca129d84aa01e.md
  - >-
    raw/sha256-4824a90ea53c298a6c32c3e3ebb80e6bf26742e51f506e6e7d3ca8435d1da9c6.md
  - >-
    raw/sha256-59a95308536d065059c9cc558e2d55136e4689c7d61259182be752ea3ba3e582.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 它曾经融合什么，为什么被删除？

`fuse_allreduce_rms` 曾是 `ascend_compilation_config` 下的布尔开关。开启后，`torch.compile` 会在 `GraphFusionPassManager` 中多注册一个 `MatmulAllReduceAddRMSNormPass`，把 `matmul → AllReduce → 加残差 → RMSNorm` 这段连续子图替换为单算子 `torch.ops._C_ascend.matmul_allreduce_add_rmsnorm`（内部将 AllReduce 拆为 ReduceScatter + AllGather）。

它属于 `npugraph_ex` 算子级融合规则中的一条；其余保留规则的适用条件见 [npugraph_ex](../concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换)。

即使在仍保留此键的 `v0.23.0` 与 `v0.24.0rc` 上，设为 `true` 也**不等于必然生效**。触发替换必须同时满足三项条件：

- 存在多卡 TP AllReduce（单卡 TP=1 无从匹配 pattern）；
- 编译区间满足 `compile_range.start > 512`（小于等于 512 的区间不会改写）；
- 经过注册该 pass 的编译流程，且图里完整出现中间层或末层两种 pattern（末层少一路 residual 输出，因此单独注册一个 pattern）。开启图捕获或把参数设为 `true` 本身都不能证明融合已发生。

**自 `v0.25.1rc1` 起（PR #12119），该开关与 eager 侧的 [enable_matmul_allreduce](enable-matmul-allreduce.md) 一并删除**，对应的 `allreduce_rmsnorm_fusion_pass.py` 与官方参数表条目也同步移除。升级后保留该嵌套键的后果按版本分叉：

| 版本 | 保留 `ascend_compilation_config.fuse_allreduce_rms` 的后果 | 替代与现存融合说明 |
| --- | --- | --- |
| `v0.26.0rc` | `AscendCompilationConfig.__init__` 仍带 `**kwargs`，旧键被静默吞掉，既不报错也不生效 | 旧融合已下线，不能以「未报错」判断仍生效 |
| `v0.30.0` / `main` | `AscendCompilationConfig` 迁至 `@config(extra="forbid")`，启动校验直接报错；`vllm_omni` 的未知顶层键过滤**不会放过嵌套子键** | 仅代表这条旧入口下线，并非缺少通算或归一化融合（例如 `main` 在 `enable_sp` 且硬件支持时注册了 `MatmulReduceScatterFusionPass`） |

## 为什么和序列并行冲突，v0.23.0 的默认值为什么是分裂的？

[张量并行](../concepts/tensor-parallel.md)下，按行切分的行并行 Linear 只算出各卡部分和，必须做一次 [All-Reduce](../concepts/collective-communication.md) 合齐完整 hidden。在普通残差连接与 [RMSNorm](../concepts/mlp-residual-norm.md) 模型中，投影后紧接「加残差 + RMSNorm」，构成四步连续子图。

未融合时这四步串行依赖。融合算子按 token 行分块归约，各卡在负责的行上加残差并做 RMSNorm，再 All-Gather 归一化结果，借此争取让不同块的计算与通信交叠、减少串行等待（实际是否更快取决于形状与设备）。

注意两个实现边界：

- 源码注释虽将 pass 的 512 阈值与计算通信分块联系起来，但内核实际按 `swizzlCount × m0` 决定一轮处理的行数，八卡分支还会按形状选择 `m0`，不能把 512 概括为所有形状的固定块长；
- ring All-Reduce 与 ReduceScatter + AllGather 流量同阶，但不能据此断定该自定义内核在每种拓扑上的线上字节数完全相等。

```wiki-diagram
file: fuse-allreduce-rms
```

**与序列并行（SP）冲突的根源在于子图重叠，而非通信方向相反。** 旧版 SP 的 `MiddleAllReduceRMSNormPattern` 匹配 `all_reduce → npu_add_rms_norm_bias`（同样先 ReduceScatter、在分片上加残差与 norm，再 All-Gather），而融合 pass 把这段通信、归一化连同前面的 matmul 一并吃掉。两者在 `v0.23.0` 同属 `GraphFusionPassManager` 并按 `self.passes` 顺序执行，融合 pass 排在 `SequenceParallelismPass` 与 `SequenceParallelismMoePass` 之前：满足区间和完整 pattern 时融合 pass 抢先替换为单算子，后续 SP 不再匹配已移除的 All-Reduce；未命中的子图与 `≤ 512` 区间仍须分别检查，不能直接推成全模型 SP 静默失效。两条改图规则无法重复改写同一批节点，官方参数表因此将本项默认标为 `False`。

**`v0.23.0` 的默认值存在分裂**，因为不同调用点分别读取了类型化字段与原始字典：

| `v0.23.0` 读取位置 | 实际读取来源与缺省值 | 用户不写此键时的后果 |
| --- | --- | --- |
| 文档与 `AscendCompilationConfig.fuse_allreduce_rms` | 类型化字段，默认 `False` | 表面上与官方文档一致 |
| `GraphFusionPassManager.configure` | 读原始 `additional_config` 字典，缺省 `True` | 即使完全不写此键，pass 仍会被注册进 manager |
| `update_compile_ranges_split_points` | 在 `enable_npugraph_ex` 分支读类型化字段（`False`） | 不会往 `compile_ranges_endpoints` 插入 512 切分点；能否改到图取决于现有区间里是否恰好存在 `start > 512` |

到了 `v0.30.0` 与 `main`，`configure` 改读递归校验后的类型化 `get_ascend_config().ascend_compilation_config`，消除了原始 dict 与类型化字段脱节的问题。

**移除融合方与迁移 SP 并非同一版完成**：`v0.26.0rc` 删掉了融合 pass，但 `configure` 仍在 `AddRMSNormQuantFusionPass`、`QKNormRopeFusionPass`、`MulsAddFusionPass` 三条之后保留 `if config.compilation_config.pass_config.enable_sp:` 注册昇腾侧两个 SP pass，属于「冲突消失、SP 仍由昇腾侧管」的过渡态。到了 `v0.30.0` 与 `main`，这两个昇腾侧 SP pass 的注册与 `sequence_parallelism.py` 文件也已撤走，`pass_config.enable_sp` 转由 `enable_sp_by_pass` 与平台层调用上游 `update_sizes_for_sequence_parallelism` 承接，SP 改由上游 vLLM pass 承担。

## 升级报错、编译分区代价，以及 GLM 双机为什么配不上？

**先确认图里有可融合的候选位置。** 旧 pass 的 `is_applicable_for_range` 要求 `compile_range.start > 512`。以 `Qwen3-0.6B`（`H = 1024`、28 层）作数值背景：若每层 attention 输出投影后、MLP 降维投影后各形成一处完整 pattern，最多可列出 `28 × 2 = 56` 处候选（最后只输出 norm 结果的形态对应 LastLayer pattern；这是候选数，不是已经 dump 图确认的命中数）。

一个 1024 token、BF16 的 chunk 在每处传递 $1024 \times 1024 \times 2\text{ B} = 2\text{ MiB}$ 逻辑张量；示意按 512 行切分时为两块，实际块长仍由 tiling 决定。小于等于 512 的编译区间不会被此 pass 改写；大批量 decode 或 prefill 是否命中，应按各自区间与实际图检查，不能只按阶段名判断收益。

在仍支持的 `v0.23.0` 上显式开启时，键必须嵌在 `ascend_compilation_config` 里（写在 `additional_config` 顶层不会传给子配置，而缺省为 `True` 的旧 manager 甚至仍可能默默注册该 pass）：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --tensor-parallel-size 2 \
  --additional-config '{"ascend_compilation_config": {"fuse_allreduce_rms": true}}'
```

开启或升级迁移时主要面临三项代价与边界：

- **抢先替换 SP 候选子图**：在 `v0.23.0` 同时开启 `compilation_config.pass_config.enable_sp` 时，SP 两个 pass 虽仍注册，但已被融合 pass 替换的节点不再可用；需要保留该处 SP 改写时应关闭本开关，并核对编译日志或图命中结果。
- **可能增加编译分区**：开启该字段会把 `512` 加入 `compile_ranges_endpoints` 切分点；若原来没有这一边界且两侧区间都实际编译，可能增加编译开销与缓存条目，但不能据此断言耗时或条目数必然增加固定值。
- **升级后必须删掉该嵌套键**：`v0.26.0rc` 虽因 `**kwargs` 静默吞掉而「能启动」，但融合并未生效；`v0.30.0` 与 `main` 的 `AscendCompilationConfig` 仅保留 `enable_npugraph_ex`、`enable_static_kernel`、`enable_super_kernel`、`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_muls_add` 六个字段并开启 `extra="forbid"`，残留该嵌套键会直接启动失败——即便环境里装有 `vllm_omni`，其未知键警告剔除只作用于顶层 `additional_config`，不会放过嵌套在 `ascend_compilation_config` 里的无效子键。

**放到 GLM 双机部署（历史例外 B 算例，源码推断、尚未真机 dump 图确认）**：固定 TP8 部署下，R1 纯文本主干一次前向有 91 次 TP All-Reduce（不含视觉塔与 MTP，拆分见[逐层通信清单](../concepts/one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)），但逐类核对后都配不上该 pattern：

| 通信位置（共 91 次） | 权重与前置算子 | 无法匹配旧 pattern 的原因 |
| --- | --- | --- |
| 34 个 KDA 层的 `o_proj` | 权重为 BF16，前端未量化 gemm 对得上 | 后端被 mHC 结构挡住 |
| 11 个 MLA 层的 `o_proj` | 量化快照 `9e55cbc8` 为浮点、`3121f187` 改为 W8A8，不可一概而论（见[量化版本与权重子账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)） | 后端同样被 mHC 挡住；W8A8 版本连前端也对不上 |
| 3 个稠密层 + 42 层共享专家 `down_proj` | 两版快照均走 W8A8 | 不直接匹配未量化 gemm，且共享专家由外层归约 |
| 1 次词嵌入 | 前置是查表而非 matmul | 第一步根本不存在 |

更共同的限制在结尾：旧 pattern 需要 `npu_add_rms_norm_bias`，而该语言主干使用 mHC——投影后经 `hc_post` 更新残差流、下一段再经 `hc_pre` 与独立 RMSNorm（归一化并非都由 `npu_hc_post` 完成），与普通 Add+RMSNorm pattern 不符。此外，MTP 与视觉塔结构独立、不适用此推断，且 MoE MC2 的 128 门槛不是这里的编译区间。

## 对照源码

下表对照 `fuse_allreduce_rms` 在四个固定版本快照中的存续状态、校验方式与图融合 pass 注册变化：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 开关与旧 pass | 存在（2 个 pattern，要求 `start > 512`）[C1] | 已整体删除（PR #12119），嵌套键被 `**kwargs` 静默吞掉 [C20] | 已删除，`@config(extra="forbid")` 启动报错 [C34] | 同 `v0.30.0`，启动报错 [C38] |
| 类型与默认值 | 文档与类型化字段为 `False` [S9]，但 `configure` 读原始 dict 缺省 `True` [!] | — | — | — |
| `vllm_omni` 顶层豁免 | 不适用 | 不适用 | 仅过滤顶层未知键，不放过嵌套子键 [C37][D] | 同 `v0.30.0` [C40] |
| `GraphFusionPassManager` 注册项 | 融合 pass 排在 Ascend 两个 SP pass 之前 [C3] | 删融合方；仍保留 Ascend 两个 SP pass [C21] | 保留 `norm_quant` / `qknorm_rope` / `muls_add` 三条；SP 迁至上游 vLLM [C36][I] | 三条基础 pass 之外，在 `enable_sp` 且硬件支持时新增 `MatmulReduceScatterFusionPass` [C39] |

- **旧实现、默认分裂与 512 阈值**：`v0.23.0` 的 `allreduce_rmsnorm_fusion_pass.py`（来源 1、2）定义中间层/末层两套 pattern 并检查 `compile_range.start > 512`，对应自定义算子 tiling 与内核见来源 28–30；`GraphFusionPassManager.configure` 读原始 dict 缺省 `True` 而 `update_compile_ranges_split_points` 读类型化字段 `False`（来源 3、5–7）[D][!]；与 SP `MiddleAllReduceRMSNormPattern` 的子图重叠见来源 4 [C4]。
- **移除与官方文档**：官方 `v0.23.0` 参数表见 `additional_config.md#L135-L142`（[线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)）；`v0.25.1rc1` 起由 PR #12119 与 `enable_matmul_allreduce` 同批删除（发布说明见来源 19 [S19]，参数表同步删除见来源 16 [S16]）。
- **新版配置与校验**：`v0.30.0`（`c09d3e20:ascend_config.py#L112-L130`、`config_utils.py#L43-L50` [C35]）与 `main`（`8d6180e2:ascend_config.py#L120-L136`）均由 pydantic `@config(extra="forbid")` 校验嵌套子配置；SP 经 `enable_sp_by_pass` 与 `update_sizes_for_sequence_parallelism` 承接见来源 15、33。
- **GLM 双机与待核**：mHC 残差与归一化结构见 `db701c1f:vllm_ascend/models/glm5_next.py#L2129-L2241`（来源 22）；`Qwen3-0.6B` 维度配置见来源 31。**待核**：本仓库尚无该 pass 的实际编译图 dump 与设备收益实测。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2026-01-19 · c929bd1e8d4f955a0b5434bf72ba7061068ccd14 · PR [#5034](https://github.com/vllm-project/vllm-ascend/pull/5034) —— [Fusion] [Graph]Add Matmul Allreduce Rmsnorm fusion Pass (#5034)
  包含该提交的 tag：v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ascend_config.py` +6 / −1（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +5 / −0（文本行变化）
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +153 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +12 / −0（文本行变化）
  - `vllm_ascend/patch/worker/__init__.py` +1 / −0（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +0 / −159（文本行变化）
  - `vllm_ascend/ops/linear_op.py` +0 / −45（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −40（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +0 / −5（文本行变化）
  - `vllm_ascend/utils.py` +0 / −4（文本行变化）

当前含该标识符的 tag：v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `vllm_config.additional_config.get('ascend_compilation_config', {})["fuse_allreduce_rms"]` |
| 类型 | `unknown` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:508` [C17] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
