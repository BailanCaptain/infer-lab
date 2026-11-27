---
id: fuse-allreduce-rms
legacyAnchors:
  一句话: 它曾经融合什么，为什么被删除？
  为什么存在: 为什么和序列并行冲突，v0.23.0 的默认值为什么是分裂的？
  开了的代价: 候选区间、编译分区代价与升级清理
  升级报错编译分区代价以及-glm-双机为什么配不上: 多路残差为什么匹配不上旧版归一化融合
title: fuse_allreduce_rms
type: param
summary: >-
  旧版 ascend_compilation_config 开关：将 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm
  融成单算子；因与序列并行争抢子图而官方默认关闭（v0.23.0 实际注册逻辑存在默认值分裂），自 v0.25.1rc1 起已整体移除，v0.26
  静默吞掉、v0.30.0 与 main 严格校验直接报错。
aliases:
  - ascend_compilation_config.fuse_allreduce_rms
  - Matmul AllReduce RMSNorm 融合
  - MatmulAllReduceAddRMSNormPass
  - matmul_allreduce_add_rmsnorm
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
  - to: npugraph-ex
    kind: builds-on
    note: 该历史开关曾作为 npugraph_ex 编译图融合 pass 之一，按子图 pattern 将 matmul、AllReduce、残差与 RMSNorm 融为单算子
  - to: ascend-config-system
    kind: builds-on
    note: 该嵌套键位于 ascend_compilation_config 下，v0.30.0 与 main 的 extra="forbid" 严格校验会直接拒收残留子键
  - to: sequence-parallel
    kind: conflicts-with
    note: 与旧版序列并行 pass 争抢同一段 AllReduce + RMSNorm 子图，在 v0.23.0 同开时融合 pass 会抢先改写命中节点
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

**`fuse_allreduce_rms` 曾用于把「线性层矩阵乘 → 张量并行 AllReduce → 加残差 → RMSNorm」四步合为一个算子；该键自 `v0.25.1rc1`（PR #12119）起已彻底删除，升级到 `v0.30.0` 与 `main` 时必须从 `ascend_compilation_config` 中清理掉，否则启动校验会直接报错（装有 `vllm_omni` 也不会豁免嵌套子键）。**

这里的 [RMSNorm](../concepts/mlp-residual-norm.md) 是按均方根缩放隐藏向量的归一化层。在仍保留此键的 `v0.23.0` 与 `v0.24.0rc` 中，它是 [AscendConfig](../concepts/ascend-config-system.md) 下 `ascend_compilation_config` 的布尔子键。开启后，`torch.compile` 会在 `GraphFusionPassManager` 中注册 `MatmulAllReduceAddRMSNormPass`，将匹配到的四步子图替换为单算子 `torch.ops._C_ascend.matmul_allreduce_add_rmsnorm`（内部将 `AllReduce` 拆为 `ReduceScatter + AllGather`；保留至今的局部融合规则见 [npugraph_ex](../concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换)）。

即便在 `v0.23.0` 上设为 `true`，也必须同时满足三道门槛才会真正改写计算图：

- 存在多卡 TP AllReduce（单卡 `TP=1` 无从匹配 pattern）；
- 编译区间满足 `compile_range.start > 512`（小于等于 512 的区间不会改写）；
- 经过注册该 pass 的编译流程，且图里完整出现中间层或末层两种 pattern（末层少一路 residual 输出，单独注册一个 pattern）。开启图捕获或把参数设为 `true` 本身都不能证明融合已发生。

## 事实表

跨版本迁移或查阅旧配置模板时，直接核对下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史配置路径 | `additional_config["ascend_compilation_config"]["fuse_allreduce_rms"]` | 曾是嵌套子键；写在顶层在旧版也不会传给子配置 |
| 当前版本状态 | 自 `v0.25.1rc1`（PR #12119）起与 `enable_matmul_allreduce` 同批删除 | `v0.30.0` 与 `main` 开启 `@config(extra="forbid")`，残留该嵌套子键直接启动失败（`vllm_omni` 仅豁免顶层未知键） |
| `v0.26.0rc` 过渡行为 | `AscendCompilationConfig.__init__` 含 `**kwargs` 静默吞掉 | `v0.26` 没报错只因未拦截未知子键，旧融合 pass 早已下线 |
| `v0.23.0` 默认值分裂 | 类型化字段与文档默认 `False`，但 `GraphFusionPassManager.configure` 读原始字典缺省 `True` | `v0.23.0` 不写此键仍会注册该 pass，但因类型化字段为 `False` 不主动向编译区间插入 `512` 切分点 |
| 历史生效门槛 | `TP > 1`、`compile_range.start > 512`、完整命中未量化 `matmul + AR + Add + RMSNorm` | 小批量区间（`<= 512`）、W8A8 量化线性层或 mHC 残差结构均不会命中 |
| 冲突与现存替代 | 在 `v0.23.0` 排在序列并行（SP）pass 之前，会抢先吃掉同一段 `AR + RMSNorm` 子图 | 旧入口下线不等于新版无通算融合（如 `main` 在 `enable_sp` 且硬件支持时注册 `MatmulReduceScatterFusionPass`） |

## 为什么和序列并行冲突，v0.23.0 的默认值为什么是分裂的？

[张量并行](../concepts/tensor-parallel.md)下，按行切分的行并行 Linear 只算出各卡部分和，必须做一次 [All-Reduce](../concepts/collective-communication.md) 合齐完整 hidden。在普通残差连接与 [RMSNorm](../concepts/mlp-residual-norm.md) 模型中，投影后紧接「加残差 + RMSNorm」，构成四步连续子图。

未融合时这四步串行依赖。融合算子按 token 行分块归约，各卡在负责的行上加残差并做 RMSNorm，再 All-Gather 归一化结果，借此争取让不同块的计算与通信交叠、减少串行等待（实际是否更快取决于形状与设备）。

注意两个实现边界：

- 源码注释虽把 pass 的 `512` 门槛与计算通信分块挂钩，但底层内核实际按 `swizzlCount × m0` 决定每轮处理行数（八卡分支还会随形状调整 `m0`），不能把 `512` 当成所有形状的固定 tiling 块长；
- ring All-Reduce 与 `ReduceScatter + AllGather` 理论通信量同阶，但该自定义内核在各拓扑上的实际线上流量仍取决于具体实现。

```wiki-diagram
file: fuse-allreduce-rms
```

**它与[序列并行（SP）](../concepts/sequence-parallel.md)冲突，根源是两条规则争抢同一段子图。** 旧版 SP 的 `MiddleAllReduceRMSNormPattern` 匹配 `all_reduce → npu_add_rms_norm_bias`（同样拆成 `ReduceScatter`、分片加残差与归一化、再 `All-Gather`），而本融合 pass 会连同前面的 `matmul` 把这段子图一并吃掉。在 `v0.23.0` 的 `GraphFusionPassManager` 中，本 pass 排在 `SequenceParallelismPass` 与 `SequenceParallelismMoePass` 之前：只要区间满足 `> 512` 且完整命中四步模式，融合 pass 就会抢先改写节点，使后续 SP 找不到原来的 `All-Reduce`；至于未命中该模式的子图或 `<= 512` 的区间，SP 仍独立判断，不能笼统推成整张网 SP 全部失效。因为同一批节点不能被重复改写，官方文档将该开关默认标为 `False`。

**`v0.23.0` 的「注册」与「切分区间」存在默认值分裂**，原因在于两处代码分别读取了类型化字段与原始字典：

| `v0.23.0` 读取位置 | 实际读取来源与缺省值 | 用户不写此键时的后果 |
| --- | --- | --- |
| 文档与 `AscendCompilationConfig.fuse_allreduce_rms` | 类型化字段，默认 `False` | 表面上与官方文档一致 |
| `GraphFusionPassManager.configure` | 读原始 `additional_config` 字典，缺省 `True` | 即使完全不写此键，pass 仍会被注册进 manager |
| `update_compile_ranges_split_points` | 在 `enable_npugraph_ex` 分支读类型化字段（`False`） | 不会往 `compile_ranges_endpoints` 插入 512 切分点；能否改到图取决于现有区间里是否恰好存在 `start > 512` |

到了 `v0.30.0` 与 `main`，`configure` 统一改读类型化配置对象，彻底消除了原始字典与字段默认值脱节的问题。

**删除本融合 pass 与迁移 SP 分两步完成。** `v0.26.0rc` 先删掉了本融合 pass，但仍在三条常规融合规则后保留昇腾侧两个 SP pass 的注册。直到 `v0.30.0` 与 `main`，昇腾侧 `sequence_parallelism.py` 才一并下线，`pass_config.enable_sp` 改由 `enable_sp_by_pass` 与上游 `update_sizes_for_sequence_parallelism` 承接。

## 候选区间、编译分区代价与升级清理

**图里先要有候选子图，且编译区间起点必须超过 `512`。** 以 `Qwen3-0.6B`（隐藏维 `1024`、28 层）为例：若每层注意力输出投影后和 MLP 降维投影后各出现一次完整四步结构，全网最多有 `28 × 2 = 56` 处结构候选（末层少一路残差输出，由单独的 `LastLayer` 模式承接；这只是结构候选上限，实际是否命中仍须看编译图 dump）。

按 `1024` 个 token、`BF16` 计算，每处传递的逻辑张量为 $1024 \times 1024 \times 2\text{ B} = 2\text{ MiB}$；示意按 `512` 行切分是两块，真实分块尺寸仍由算子 tiling 决定。起点 `<= 512` 的编译区间一律跳过改写；大批量 Decode 或 Prefill 能否命中，取决于各自落入的编译区间与算子图结构，不能单凭阶段名称判断。

在仍保留该键的 `v0.23.0` 上显式开启时，必须把键嵌在 `ascend_compilation_config` 内（写在 `additional_config` 顶层不会生效；若完全省略子键，旧管理器因原始字典缺省 `True` 仍会注册该 pass）：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --tensor-parallel-size 2 \
  --additional-config '{"ascend_compilation_config": {"fuse_allreduce_rms": true}}'
```

启用或跨版本迁移时有三项直接代价：

- **挤占命中位置的 SP 改写**：在 `v0.23.0` 与 `compilation_config.pass_config.enable_sp` 同开时，已被本 pass 替换的节点无法再应用 SP。若希望保留 SP 分片归一化，应显式传 `"fuse_allreduce_rms": false` 并核对图编译产物。
- **切碎编译区间**：显式设为 `true` 会把 `512` 插入 `compile_ranges_endpoints`。若原区间跨越 `512` 且切开后的两侧区间都在运行期被触发，就会多出一轮图编译与对应的缓存条目。
- **升级到新版必须删键**：`v0.26.0rc` 靠 `**kwargs` 静默忽略未知子键而未报错，但融合早已下线。`v0.30.0` 与 `main` 的 `AscendCompilationConfig` 仅保留六个有效字段并启用 `extra="forbid"`，残留 `fuse_allreduce_rms` 会直接阻断启动；`vllm_omni` 的未知键过滤只管顶层 `additional_config`，救不了嵌套子键。

## 多路残差为什么匹配不上旧版归一化融合

旧版融合模式不仅挑前端线性层（要求未量化 `matmul`），更挑后端残差拓扑（要求紧跟标准单路 `npu_add_rms_norm_bias`）。一旦模型改用多路残差混合（如 mHC 流式残差），哪怕存在高频 `TP All-Reduce` 也无法匹配。以双机 `TP8` 下的历史 `GLM-5.3-Flash` 纯文本主干为例（静态源码推演，尚未真机 dump 编译图），一次前向共 `91` 次 `TP All-Reduce`（拆分见[逐层通信清单](../concepts/one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)），逐类核对均被拦在模式之外：

| 通信位置（共 91 次） | 权重与前置算子 | 无法匹配旧 pattern 的原因 |
| --- | --- | --- |
| 34 个 KDA 层的 `o_proj` | 权重为 BF16，前端未量化 gemm 对得上 | 后端被 mHC 结构挡住 |
| 11 个 MLA 层的 `o_proj` | 量化快照 `9e55cbc8` 为浮点、`3121f187` 改为 W8A8，不可一概而论（见[量化版本与权重子账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)） | 后端同样被 mHC 挡住；W8A8 版本连前端也对不上 |
| 3 个稠密层 + 42 层共享专家 `down_proj` | 两版快照均走 W8A8 | 不直接匹配未量化 gemm，且共享专家由外层归约 |
| 1 次词嵌入 | 前置是查表而非 matmul | 第一步根本不存在 |

最共性的拦截点在尾部：该主干投影后先经 `hc_post` 更新多路残差流，进入下一子层前再经 `hc_pre` 与独立 `RMSNorm`，不存在旧 pass 所需的紧邻 `npu_add_rms_norm_bias` 子图。MTP 层与视觉塔结构独立，需另行按各自算子图核对；MoE 的 MC2 `128` token 门槛属于通信派发分界，也与这里的 `512` 编译区间无关。

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
  包含该提交的 tag：v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +6 / −1（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +5 / −0（文本行变化）
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +153 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +12 / −0（文本行变化）
  - `vllm_ascend/patch/worker/__init__.py` +1 / −0（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
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
