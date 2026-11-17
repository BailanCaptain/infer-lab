---
id: fuse-allreduce-rms
title: fuse_allreduce_rms
type: param
summary: >-
  把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm
  融成一个算子；因与序列并行争抢同一段子图而默认关闭，v0.25.1rc 起已整体删除，v0.26 上配了被静默吞掉、main 上直接报错。
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
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: alternative-to
    note: >-
      同一个 Matmul+AllReduce 瓶颈的两条路——那个开关在 eager 里直接换用
      npu_mm_all_reduce_base、不吸收后面的 Add+RMSNorm，本项走编译期 pattern 匹配、连 RMSNorm
      一起吃掉；main 上两条一起被删
contradicts: []
updated: 2026-11-03T00:00:00.000Z
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

## 一句话

**v0.30.0rc2 对照：** 没有恢复 ascend_compilation_config 下的 fuse_allreduce_rms 子键或旧 pass 的公开入口。该父对象仍是已识别的配置，旧子键会被嵌套的严格类型校验拒收；vllm_omni 的未知顶层键过滤不会放过这个嵌套错误。下面与 SP 的互斥及融合顺序只说明旧实现，不代表 rc2 的全部 RMSNorm 融合策略，也不能由旧键缺失推断新版没有相应融合算子。

`fuse_allreduce_rms` 是 `ascend_compilation_config` 下的一个布尔开关。开了它，torch.compile 会多注册一个图改写 pass，把 `matmul → AllReduce → 加残差 → RMSNorm` 这一段连续子图整个换成 `matmul_allreduce_add_rmsnorm` 一个融合算子 [C1]。它是 npugraph_ex 那套算子级融合规则里的一条，四条规则各自合哪两步、各自的额外条件在 [npugraph_ex](../concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换)；本页只讲这一个开关自己。

官方默认 `False`，理由写在参数表里：与序列并行冲突 [S9]。但 v0.23.0 上真正决定这个 pass 要不要注册的那段代码读的是另一个值、缺省写成 `True`——这个坑单独说，见下文 [!]。

**什么情况下它根本不可能生效。** 单卡（TP=1）时没有那次 TP AllReduce，pattern 无从匹配；融合 pass 还要求编译区间的 token 下界超过 512 [D]。要发生替换，须经过注册该 pass 的编译流程、满足区间门槛，并且图里实际出现完整 pattern。NPU 图捕获或参数设为 true 本身都不足以证明融合已发生。

**存在范围。** 它到 v0.24.0rc 为止还在，**v0.25.1rc 起**开关、`allreduce_rmsnorm_fusion_pass.py` 与官方表里的那一行一并删除，v0.26 分支（2026-09-17 的源码快照）和 main 上都没有，PR 号见下面「版本谱系」。**这个键是嵌套键，两边失效的方式不一样** [!]：v0.26 的 `AscendCompilationConfig.__init__` 仍带 `**kwargs`，`fuse_allreduce_rms` 被 kwargs 吞掉、没人再读 [C20]，配了不报错也不生效；main 的同一个类改成了 `extra="forbid"` 的类型化配置，同一份配置启动就被当拼写错误拒掉。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | 有 | 已整体删除，键被 `**kwargs` 吞掉 | 已整体删除，键被 `extra="forbid"` 拒掉 | 两边都得把这个键从配置里摘掉：v0.26 上不摘毫无提示，main 上不摘起不来 |
| 类型 / 官方默认值 | `bool` / `False` | —— | —— | 官方表里写明「默认关是因为与 SP 冲突」 |
| 实际注册用的默认值 | `True`（读原始 dict） | —— | —— | 不写这个键时 pass 照样被注册，与文档的 `False` 对不上 [!] |
| 配置路径 | `additional_config.ascend_compilation_config.fuse_allreduce_rms` | —— | —— | 是嵌套键，写在 `additional_config` 顶层不生效 |
| 替换成的算子 | `torch.ops._C_ascend.matmul_allreduce_add_rmsnorm` | —— | —— | 一次调用吃掉四步，AllReduce 在算子内部拆成 ReduceScatter+AllGather |
| 生效门槛 | `compile_range.start > 512` | —— | —— | 门槛针对编译区间，不直接按 prefill/decode 分类；小于等于 512 的区间不改写 |
| 512 的含义 | pass 的阈值；注释联系到计算通信分块 | —— | —— | 内核分块由 tiling 决定，不能把这个常量当作所有形状的固定块长 |
| 注册的 pattern 数 | 2：中间层 / 末层 | —— | —— | 末层少一路 residual 输出，需要单独写一个 pattern |
| 与 SP 的关系 | 争抢重叠的子图，融合 pass 排在 SP 之前 | 旧融合方已删，SP 的两个 pass 仍在 manager 里注册 | 旧融合方及 Ascend 这两个 SP pass 的注册已撤走 | 已被融合替换的子图不再交给后续 SP 改写；不能推出整个模型的 SP 都失效 |
| 开启的副作用 | 往 `compile_ranges_endpoints` 插入切分点 512 | —— | —— | 编译区间在 512 处断开，上面那道门槛才能干净地按区间开关 |

## 为什么存在

[张量并行](../concepts/tensor-parallel.md)下按行切的那半个 Linear 算出的是部分和，要做一次 [All-Reduce](../concepts/collective-communication.md) 把各卡的部分和加齐才能得到完整的 hidden。在采用普通残差连接和 [RMSNorm](../concepts/mlp-residual-norm.md) 的模型中，行并行投影之后可能出现「加残差 + RMSNorm」，于是形成可融合的四步。未融合时，后一步依赖前一步的输出；融合实现则按 token 行分块归约，各卡在负责的行上加残差、做 RMSNorm，再 All-Gather 归一化结果。这样有机会把不同块的计算和通信交叠，减少串行等待，但是否更快仍取决于形状和设备。

源码注释把 pass 的 512 阈值与分块联系起来；内核实际使用 `swizzlCount × m0` 决定一轮处理的行数，八卡分支会按形状选择 m0，不能概括为任何负载都固定切 512。ring All-Reduce 与 ReduceScatter 加 All-Gather 的流量同阶，也不等于已证明此自定义内核在每种拓扑上的线上字节数相等。

```wiki-diagram
file: fuse-allreduce-rms
```

**为什么与 SP 冲突。** 两个 pass 的目标有重叠：SP 的 `MiddleAllReduceRMSNormPattern` 匹配 `all_reduce → npu_add_rms_norm_bias`，融合 pass 也包含这段通信和归一化 [C4]。它们注册在同一个 `GraphFusionPassManager` 里，按 `self.passes` 的顺序逐个改图，融合 pass 排在两个 SP pass 之前。若区间和完整 pattern 都满足，融合 pass 先把某段子图换成单算子，后续 SP 就不能再匹配其中已移除的 All-Reduce。未命中的子图以及融合 pass 不适用的区间仍须分别检查，不能推成全模型 SP 静默失效 [D]。

这不是说两者的通信目标必然相反：所引旧版 SP pattern 也是先 ReduceScatter，在分片上加残差和做 norm，紧接着 All-Gather norm 结果。冲突在于两条改图规则不能重复替换同一批节点；融合方还把前面的 matmul 一起收进去。官方参数表因此建议默认关闭这条融合。

**v0.23.0 的默认值其实是分裂的** [!]。类型化字段 `AscendCompilationConfig.fuse_allreduce_rms` 默认 `False`，但真正决定 pass 是否注册的 `GraphFusionPassManager.configure` 读的是**原始 dict**、缺省值写成 `True` [C3]，而这个 manager 正是昇腾平台实际生效的 pass manager。结果是：用户完全不写这个键时，pass 仍会被 append 进 manager。同一份配置下 `update_compile_ranges_split_points` 的 `enable_npugraph_ex` 分支读的又是类型化字段（`False`），因而 512 这个切分点不会被插入；此时 pass 是否真的改到图，取决于现有编译区间里有没有 `start > 512` 的区间 [D]。main 把这个坑修掉了，`configure` 改读类型化的 `get_ascend_config().ascend_compilation_config`，注释就写在那儿：消费递归校验过的配置，而不是重读原始 `additional_config` dict [C11]。

## 开了的代价

**先确认图里有可融合的地方。** pass 的 `is_applicable_for_range` 要求 `compile_range.start > 512`。以 Qwen3-0.6B 的 H=1024、28 层为数值背景：若每层 attention 输出投影后、MLP 降维投影后各形成一处完整 pattern，最多可据此列出 28×2=56 处候选，其中最后只输出 norm 结果的形态对应 LastLayer pattern。这是候选数，不是已经 dump 图确认的命中数。一个 1024 token、BF16 的 chunk 在每处传递 `1024 × 1024 × 2 B = 2 MiB` 的逻辑张量；示意按 512 行切时是两块，实际块长仍由 tiling 决定。小于等于 512 的编译区间不会被此 pass 改写；大批量 decode 或 prefill 是否命中，按各自区间与图检查，不能按阶段名判断收益。

**在 v0.23.0 上开启：**

```bash
vllm serve Qwen/Qwen3-0.6B \
  --tensor-parallel-size 2 \
  --additional-config '{"ascend_compilation_config": {"fuse_allreduce_rms": true}}'
```

键必须嵌在 `ascend_compilation_config` 里 [C5]；写成顶层的 `{"fuse_allreduce_rms": true}` 不会传给这个子配置。manager 也只读嵌套 dict，所以顶层写法不能控制它；在缺省为 True 的旧 manager 中，写错位置甚至仍可能看到融合。

**代价一：会抢先替换 SP 的候选子图。** 同时打开 `compilation_config.pass_config.enable_sp` 时，SP 的两个 pass 仍被注册，但已被融合方替换的节点不再可用。需要保留该处 SP 改写时，应关闭这条融合，并检查编译日志或图中的实际命中。

**代价二：可能增加编译分区。** 配置处理会把 512 加入编译区间的切分点；如果原来没有这个边界，而且两侧区间都实际编译，可能增加编译工作和缓存条目。不能据一次 append 就保证耗时或条目数增加固定值 [D]。

**代价三（main）：旧嵌套键会报错。** main 上 `AscendCompilationConfig` 只剩 `enable_npugraph_ex` / `enable_static_kernel` / `enable_super_kernel` / `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add` 六个字段，没有 `fuse_allreduce_rms` [C12]；它作为 `AscendConfig` 的类型化嵌套字段由 pydantic 做 dict→dataclass 转换 [C13]，而 `@config` 装饰器统一设了 `extra="forbid"` [C14]。沿用旧嵌套键会被拒收；静默吞掉它的是 v0.26 的旧构造器，v0.23 中这个嵌套键仍有作用。升级时应删掉已移除的配置。

唯一的例外在顶层那道检查：构造 `AscendConfig` 前算出的 `unknown_keys` 非空、且 `importlib.util.find_spec("vllm_omni")` 找得到时，只打一条 warning 再把它们剔掉 [C18]。不过这条豁免走的是顶层 `additional_config` 的名单，嵌套进 `ascend_compilation_config` 的键仍由子配置自己的 `extra="forbid"` 处理 [D]——别指望它替你兜底。

**v0.26 不会用同样方式报错**：那里的 `AscendCompilationConfig` 仍保留 `**kwargs`，这个已移除的键会被吞掉。因此升级后不能以“配置未报错”判断特性仍然存在；先核对版本中的配置消费者和 pass，再检查编译图与命中日志。

**它去哪了：删掉的是冲突的融合方，不是 SP。** 上游发布说明把它和 eager 侧的 [enable_matmul_allreduce](enable-matmul-allreduce.md) 记成同一条移除项：「Removed matmul all-reduce and matmul all-reduce RMSNorm fusions. #12119」[S19]。`graph_fusion_pass_manager.configure` 在 main 上只剩 `AddRMSNormQuantFusionPass`、`QKNormRopeFusionPass`、`MulsAddFusionPass` 三条注册，`fuse_allreduce_rms` 分支与 `MatmulAllReduceAddRMSNormPass` 的 import 一并消失 [C11]；`vllm_ascend/compilation/passes/` 下也已不存在 `allreduce_rmsnorm_fusion_pass.py` 和 `sequence_parallelism.py`。

**这两件事不是同一版发生的。** v0.26 的 `configure` 在那三条之后还保留着一支 `if config.compilation_config.pass_config.enable_sp:`，照旧 append `SequenceParallelismPass` 与 `SequenceParallelismMoePass` [C21]；被删的只有融合这一方，所以 v0.26 恰好是「冲突消失、SP 还归昇腾侧管」的中间状态。到 main 才连 SP 那两个 pass 的注册也撤了，但 `pass_config.enable_sp` 仍被 `enable_sp_by_pass` 读取 [C15]，而 `platform.py` 转去调上游的 `update_sizes_for_sequence_parallelism`。合起来看，序列并行改由上游 vLLM 的 pass 承担是 main 才完成的一步 [I]。官方参数表里 `fuse_allreduce_rms` 这一行同步删除 [S16]。

官方参数表见 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html>（v0.23.0），对应本地文件 `docs/source/user_guide/configuration/additional_config.md` 第 141 行。

**放到 GLM 双机：R1 的语言主干没有这条完整 pattern，属于源码推断，尚未在真机 dump 图确认。** 固定 TP8 部署中，R1 纯文本主干一次前向的 TP All-Reduce 为 91 次，不含视觉塔和 MTP（拆分与单次载荷见[逐层通信清单](../concepts/one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)）。不能把这些通信都当成可融合点：

- **34 个 KDA 层的 `o_proj`**：按这份部署的量化配方是 BF16，开头那一端（未量化的 gemm）其实对得上，挡住它的是结尾。
- **11 个 MLA 层的 `o_proj`**：已核量化快照 9e55cbc8 是浮点，3121f187 才改成 W8A8；不能统一说全是量化 gemm。版本依据见[量化版本与权重子账](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。
- **3 个稠密层与 42 层共享专家的 `down_proj`**：两份已核快照均走 W8A8，不能直接匹配未量化 gemm；共享专家还由外层归约，不是该投影自己执行完整 pattern。
- **词嵌入那一次**：前面是查表不是 matmul，pattern 的第一步根本不存在。

更共同的限制在结尾：pattern 要 `npu_add_rms_norm_bias`，而这份语言主干使用 mHC，投影后的状态先经 `hc_post` 更新残差流，下一段再经 `hc_pre` 和独立 RMSNorm。归一化并非都由 `npu_hc_post` 完成，这条调用链也不是所需的普通 Add+RMSNorm pattern [C22]。MTP 在同一 DecoderLayer 中走单独分支，视觉塔也有自己的结构，不能把主干的推断扩大到它们。另一个 MoE MC2 路径的 128 门槛不是这里的编译区间，不能混作融合证明。仍待核的是实际编译图和设备收益。

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
