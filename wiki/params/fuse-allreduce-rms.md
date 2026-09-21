---
id: fuse-allreduce-rms
title: fuse_allreduce_rms
type: param
summary: >-
  把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，v0.25.1rc
  起已整体删除，v0.26 上配了被静默吞掉、main 上直接报错。
aliases:
  - Matmul AllReduce RMSNorm 融合
  - MatmulAllReduceAddRMSNormPass
chapters:
  - '13'
sources:
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L84
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
    vllm-ascend@b255ab59:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L73
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L103-L118'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L501-L504'
  - 'vllm-ascend@b255ab59:vllm_ascend/config_utils.py#L43-L50'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L789-L793'
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L104-L111
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L508
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1650-L1661'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L607'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L74
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: alternative-to
    note: >-
      同一个 Matmul+AllReduce 瓶颈的两条路——那个开关在 eager 里直接换用
      npu_mm_all_reduce_base、不吸收后面的 Add+RMSNorm，本项走编译期 pattern 匹配、连 RMSNorm
      一起吃掉；main 上两条一起被删
contradicts: []
updated: '2026-09-21'
rawSources:
  - >-
    raw/sha256-59a95308536d065059c9cc558e2d55136e4689c7d61259182be752ea3ba3e582.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

`fuse_allreduce_rms` 是 `ascend_compilation_config` 下的一个布尔开关。开了它，torch.compile 会多注册一个图改写 pass，把 `matmul → AllReduce → 加残差 → RMSNorm` 这一段连续子图整个换成 `matmul_allreduce_add_rmsnorm` 一个融合算子 [C1]。

官方默认 `False`，理由写在参数表里：与序列并行冲突 [S9]。但 v0.23.0 上真正决定这个 pass 要不要注册的那段代码读的是另一个值、缺省写成 `True`——这个坑单独说，见下文 [!]。

**[那条请求](../concepts/one-request.md)用不到它。** 单卡 TP=1，子图里压根没有那次 TP AllReduce，pattern 无从匹配；就算有，37 个 token 也够不着 512 的门槛 [D]。要碰它得同时满足三件事：TP>1、走图模式、每步 token 数超过 512。

**存在范围。** 它到 v0.24.0rc 为止还在，**v0.25.1rc 起**开关、`allreduce_rmsnorm_fusion_pass.py` 与官方表里的那一行一并删除，v0.26 分支（2026-09-17 的源码快照）和 main 上都没有，PR 号见下面「版本谱系」。**这个键是嵌套键，两边失效的方式不一样** [!]：v0.26 的 `AscendCompilationConfig.__init__` 仍带 `**kwargs`，`fuse_allreduce_rms` 被 kwargs 吞掉、没人再读 [C20]，配了不报错也不生效；main 的同一个类改成了 `extra="forbid"` 的类型化配置，同一份配置启动就被当拼写错误拒掉。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | 有 | 已整体删除，键被 `**kwargs` 吞掉 | 已整体删除，键被 `extra="forbid"` 拒掉 | 两边都得把这个键从配置里摘掉：v0.26 上不摘毫无提示，main 上不摘起不来 |
| 类型 / 官方默认值 | `bool` / `False` | —— | —— | 官方表里写明「默认关是因为与 SP 冲突」 |
| 实际注册用的默认值 | `True`（读原始 dict） | —— | —— | 不写这个键时 pass 照样被注册，与文档的 `False` 对不上 [!] |
| 配置路径 | `additional_config.ascend_compilation_config.fuse_allreduce_rms` | —— | —— | 是嵌套键，写在 `additional_config` 顶层不生效 |
| 替换成的算子 | `torch.ops._C_ascend.matmul_allreduce_add_rmsnorm` | —— | —— | 一次调用吃掉四步，AllReduce 在算子内部拆成 ReduceScatter+AllGather |
| 生效门槛 | `compile_range.start > 512` | —— | —— | decode 的小 batch 完全不走这条路径，只有长 prefill 有意义 |
| tiling 块大小 | 512 token | —— | —— | 不足一块就凑不出通信-计算流水，因此才有上面那道门槛 |
| 注册的 pattern 数 | 2：中间层 / 末层 | —— | —— | 末层少一路 residual 输出，需要单独写一个 pattern |
| 与 SP 的关系 | 争抢同一子图，融合 pass 排在 SP 之前 | 冲突方已删，SP 的两个 pass 仍在 manager 里注册 | 冲突方已删，SP 的注册也一并撤走 | v0.23.0 上两个一起开会让 SP 静默失效；到 v0.26 冲突消失、SP 还是昇腾侧这一对，到 main 才交回上游 |
| 开启的副作用 | 往 `compile_ranges_endpoints` 插入切分点 512 | —— | —— | 编译区间在 512 处断开，上面那道门槛才能干净地按区间开关 |

## 为什么存在

张量并行下每个 Linear 的列切分结果都要做一次 AllReduce 才能拼回完整的 hidden，而 AllReduce 的下一步几乎总是「加残差 + RMSNorm」。朴素实现里这是四个背靠背的算子：通信整段阻塞，RMSNorm 只能等全部数据到齐才开始算。融合算子把 AllReduce 改写成 ReduceScatter + AllGather 两段，于是 RMSNorm 可以在 ReduceScatter 落下的那 1/tp 分片上先算起来，与还在飞的通信按 512 token 一块交叠。注意省下的不是字节数——ring AllReduce 与 RS+AG 的线上流量是同一量级——省的是串行等待。

```wiki-diagram
file: fuse-allreduce-rms
```

**为什么与 SP 冲突。** 两个 pass 盯的是同一段子图：SP 的 `MiddleAllReduceRMSNormPattern` 匹配 `all_reduce → npu_add_rms_norm_bias`，正是融合 pass 所匹配 pattern 的后半截 [C4]。它们注册在同一个 `GraphFusionPassManager` 里，`__call__` 按 `self.passes` 的列表顺序逐个改图，而融合 pass 的 append 排在两个 SP pass 之前。所以两个都开时，融合 pass 先把子图换成单算子，SP 再来匹配已经找不到 `all_reduce` 节点，序列并行静默失效——没有报错、没有告警，只是没生效 [D]。

更根本的是两者对这次通信的归宿要求相反：融合算子在内部 AllGather 回全长，后续算子仍看到完整序列；SP 要的恰恰是让 norm 及其下游停在 1/tp 长度上以省显存和算力，直到必要时才 AllGather。同一次 AllReduce 只能按其中一种方式拆，二者不可叠加 [!]。官方选择让默认值站在 SP 这边。

**v0.23.0 的默认值其实是分裂的** [!]。类型化字段 `AscendCompilationConfig.fuse_allreduce_rms` 默认 `False`，但真正决定 pass 是否注册的 `GraphFusionPassManager.configure` 读的是**原始 dict**、缺省值写成 `True` [C3]，而这个 manager 正是昇腾平台实际生效的 pass manager。结果是：用户完全不写这个键时，pass 仍会被 append 进 manager。同一份配置下 `update_compile_ranges_split_points` 的 `enable_npugraph_ex` 分支读的又是类型化字段（`False`），因而 512 这个切分点不会被插入；此时 pass 是否真的改到图，取决于现有编译区间里有没有 `start > 512` 的区间 [D]。main 把这个坑修掉了，`configure` 改读类型化的 `get_ascend_config().ascend_compilation_config`，注释就写在那儿：消费递归校验过的配置，而不是重读原始 `additional_config` dict [C11]。

## 开了的代价

**先确认它对你的负载有意义。** pass 的 `is_applicable_for_range` 要求 `compile_range.start > 512`，即编译区间的 token 数下界超过 512 才应用。以 Qwen3-0.6B（H=1024、28 层）TP=2 为例：每层有两处可融合点（attention 的 `o_proj` 后接 post-attention norm、MLP 的 `down_proj` 后接下一层 input norm），28 层共约 56 处，其中末尾那处走 `LastLayerMatmulAllReduceAddRMSNormPattern`；一个 1024 token 的 prefill chunk 在每处要 AllReduce 的张量是 `1024 × 1024 × 2 B = 2 MiB`，恰好切成 2 个 512 tiling 块。而 decode 阶段每步的 token 数通常远小于 512，这 56 处一处都不会被改写——**这个开关对纯 decode 场景基本没有收益**（本段的层数、可融合点数与字节数均由模型配置推算 [D]）。

**在 v0.23.0 上开启：**

```bash
vllm serve Qwen/Qwen3-0.6B \
  --tensor-parallel-size 2 \
  --additional-config '{"ascend_compilation_config": {"fuse_allreduce_rms": true}}'
```

键必须嵌在 `ascend_compilation_config` 里 [C5]；写成顶层的 `{"fuse_allreduce_rms": true}` 会被静默忽略，因为 v0.23.0 用 `AscendCompilationConfig(**dict)` 构造、多余键由 `**kwargs` 吞掉。

**代价一：序列并行会失效。** 若同时打开了 `compilation_config.pass_config.enable_sp`，SP 的两个 pass 仍会被注册，但匹配不到任何子图 [D]。想要 SP 就别开这个；想要这个就接受没有 SP。

**代价二：多一次图编译切分。** 开启后 `compile_ranges_endpoints` 会被插入 512，编译区间在此断开，意味着同一段图在 512 上下各编译一份，编译耗时与缓存条目相应增加 [D]。

**代价三（main）：配置通常会直接报错，不再是静默忽略。** main 上 `AscendCompilationConfig` 只剩 `enable_npugraph_ex` / `enable_static_kernel` / `enable_super_kernel` / `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add` 六个字段，没有 `fuse_allreduce_rms` [C12]；它作为 `AscendConfig` 的类型化嵌套字段由 pydantic 做 dict→dataclass 转换 [C13]，而 `@config` 装饰器统一设了 `extra="forbid"` [C14]。所以沿用旧配置继续传这个键，启动时会被当成拼写错误拒掉，而不是像 v0.23.0 那样默默无视。升级时直接删掉。

唯一的例外在顶层那道检查：构造 `AscendConfig` 前算出的 `unknown_keys` 非空、且 `importlib.util.find_spec("vllm_omni")` 找得到时，只打一条 warning 再把它们剔掉 [C18]。不过这条豁免走的是顶层 `additional_config` 的名单，嵌套进 `ascend_compilation_config` 的键仍由子配置自己的 `extra="forbid"` 处理 [D]——别指望它替你兜底。

**v0.26 分支上这一条完全不成立**——那里的 `AscendCompilationConfig` 还是普通类，构造签名末尾留着 `**kwargs`（见上面「存在范围」），多传的键连一条 warning 都没有。也就是说从 v0.23.0 升到 v0.26，这个开关的行为从「默认被注册、可能在长 prefill 上改图」变成「彻底不存在」，而启动命令一字不改、日志一行不多——真要确认它有没有生效，只能看图里还有没有 `matmul_allreduce_add_rmsnorm`。

**它去哪了：删掉的是冲突的融合方，不是 SP。** 上游发布说明把它和 eager 侧的 [enable_matmul_allreduce](enable-matmul-allreduce.md) 记成同一条移除项：「Removed matmul all-reduce and matmul all-reduce RMSNorm fusions. #12119」[S19]。`graph_fusion_pass_manager.configure` 在 main 上只剩 `AddRMSNormQuantFusionPass`、`QKNormRopeFusionPass`、`MulsAddFusionPass` 三条注册，`fuse_allreduce_rms` 分支与 `MatmulAllReduceAddRMSNormPass` 的 import 一并消失 [C11]；`vllm_ascend/compilation/passes/` 下也已不存在 `allreduce_rmsnorm_fusion_pass.py` 和 `sequence_parallelism.py`。

**这两件事不是同一版发生的。** v0.26 的 `configure` 在那三条之后还保留着一支 `if config.compilation_config.pass_config.enable_sp:`，照旧 append `SequenceParallelismPass` 与 `SequenceParallelismMoePass` [C21]；被删的只有融合这一方，所以 v0.26 恰好是「冲突消失、SP 还归昇腾侧管」的中间状态。到 main 才连 SP 那两个 pass 的注册也撤了，但 `pass_config.enable_sp` 仍被 `enable_sp_by_pass` 读取 [C15]，而 `platform.py` 转去调上游的 `update_sizes_for_sequence_parallelism`。合起来看，序列并行改由上游 vLLM 的 pass 承担是 main 才完成的一步 [I]。官方参数表里 `fuse_allreduce_rms` 这一行同步删除 [S16]。

官方参数表见 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html>（v0.23.0），对应本地文件 `docs/source/user_guide/configuration/additional_config.md` 第 141 行。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 有（2 个文件） |
| releases/v0.20.2rc | 有（2 个文件） |
| releases/v0.21.0rc | 有（2 个文件） |
| releases/v0.22.1rc | 有（2 个文件） |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.24.0rc | 有（2 个文件） |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| main | 无 |

- **引入**：2026-01-19 · c929bd1e8d4f955a0b5434bf72ba7061068ccd14 · PR [#5034](https://github.com/vllm-project/vllm-ascend/pull/5034) —— [Fusion] [Graph]Add Matmul Allreduce Rmsnorm fusion Pass (#5034)
  包含该提交的 tag：v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +6 / −1（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +5 / −0（文本行变化）
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +153 / −0（文本行变化）
  - `vllm_ascend/patch/__init__.py` +12 / −0（文本行变化）
  - `vllm_ascend/patch/worker/__init__.py` +1 / −0（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py` +0 / −159（文本行变化）
  - `vllm_ascend/ops/linear_op.py` +0 / −45（文本行变化）
  - `vllm_ascend/ascend_config.py` +1 / −40（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +0 / −5（文本行变化）
  - `vllm_ascend/utils.py` +0 / −4（文本行变化）

当前含该标识符的 tag：v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1

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
