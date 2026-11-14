---
id: enable-matmul-allreduce
title: enable_matmul_allreduce
type: param
summary: >-
  把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子
  npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 与 v0.24.0rc 有，v0.25.1rc 起整体移除，v0.26
  上配了被静默忽略、main 通常拒收（可发现 vllm_omni 时告警过滤）。GLM 双机部署没开，W8A8 下按源码看开了也走不通。
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
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 行并行线性只算出部分和，必须 All-Reduce 合齐；本开关把这一对矩阵乘和归约换成一个融合算子
  - to: collective-communication
    kind: builds-on
    note: 该开关将矩阵乘与 All-Reduce 融合，理解其不改变计算语义，需要先理解 All-Reduce 合齐部分和的语义及其与融合实现的区别。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
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

## 一句话

**v0.30.0rc2 对照：** 未恢复此顶层键，且不在兼容过滤名单中；正常环境拒收，vllm_omni 特例只告警剔除。下面的线性算子分派与环境变量优先级保留为旧版本说明，不是 rc2 的 MC2 总开关。旧键移除也不表示新版没有矩阵乘法与通信融合。

TP>1 且该层负责归约时，RowParallelLinear 的普通路径先算本 rank 的矩阵乘，再通过 AllReduce 合齐部分和。打开 `enable_matmul_allreduce`，符合条件的这一对操作被换成昇腾 MC2 通算融合算子 `torch_npu.npu_mm_all_reduce_base`，争取让通信与计算重叠 [C6]。开关默认关闭；融合保留目标运算，实际精度、耗时与支持范围仍取决于具体算子和输入。

旧版官方说明把 A2、eager 列为受益场景，但源码没有把 eager 或 prefill 写成必需条件。真正进入融合调用的前提是 `reduce_results and tp_size > 1`：TP=1 时该类回到普通量化方法调用 [C6]。值得比较哪些负载，要结合每步 token 数与实测，不能从图模式的另一个融合阈值直接推出。

**存在范围。** v0.23.0 上它是官方参数表里的一个开关，迁移期还能用环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 配 [S9]；v0.24.0rc1 中仍有这条配置与派发路径，**v0.25.1rc1 起**这组入口被移除，固定 v0.26 分支与 main 也没有恢复，PR 号见下面「版本谱系」。**两边留着这个键的后果不一样** [!]：v0.26 的 `AscendConfig` 逐个键 `.get()` 取值，不认识的键被静默忽略 [C24]；main 通常拒收未知顶层键，可发现 vllm_omni 时则先过滤它们，详见下文。两种处理都不会启用这条已移除的融合。

GLM 双机部署跑的是含 GLM 代码的 db701c1f 快照，它带着这个开关、默认关，官方双机教程没配，所以没开；开了会怎样，见「开了的代价」里的「放到 GLM 双机」。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 是否存在 | 有，官方参数表在列 | 无，字段、环境变量、算子实现全删；键被静默忽略 | 无，通常拒收；可发现 vllm_omni 时告警过滤 | 升级到这些快照后删掉旧键；服务启动成功不能证明它仍然生效 |
| 类型 / 默认值；GLM 双机 | 文档类型 `bool`、默认 `False`；本部署跑的 db701c1f 有、没开 | — | — | GLM 的 W8A8 权重与这条调用不匹配，按源码推断会在 int8 层出错；具体报错未实测 |
| 环境变量 | `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE`，默认 `"0"`，按 `bool(int(...))` 解析 | 已从 envs.py 与迁移表移除 | 同左 | 建议只写0/1；解析时0为假、可转成整数的非零值为真，字符串true会 ValueError |
| 两者优先级 | `additional_config` 命中就直接返回，环境变量只作回落 | — | — | 两个都设时环境变量无效，且不会有冲突告警 |
| 落地算子 | `torch_npu.npu_mm_all_reduce_base` | — | — | 属昇腾 MC2 通算融合族 |
| 生效前提 | `reduce_results and tp_size > 1` | — | — | TP=1 时开了也等于没开，走回 `quant_method.apply` |
| 作用范围 | 所有未被前面分支认领的 RowParallelLinear，无 prefix 过滤 | — | — | 不只是 o_proj，`mlp.down_proj` 一样被换掉 |
| 派发次序 | 排在 `flashcomm2_enable()` / `enable_sp()` **之前** | — | — | 它认领的层不再判断后面的行并行分支；不是关闭这些特性的全部模块 |
| 硬件范围 | 注释与 release note 写 A2；所引门禁用例只在 `Ascend910B` 上跑 | — | — | 这份用例不能证明 A3/950 的兼容性或收益 |
| 强制关闭点 | batch-invariant 模式下被改回 `False` | — | — | 要复现逐 batch 一致的输出就用不上它 |

## 为什么存在

TP 把一个 RowParallelLinear 的权重按输入维切开，每个 rank 只算出一份**部分和**，需要归约才能合齐完整输出（为什么是「加起来」，见 [TP 页的两种切法](../concepts/tensor-parallel.md#两种切法各算一遍拼起来还是加起来)）。该层负责归约时，普通路径是 `quant_method.apply` 算完，再调用 HCCL AllReduce。矩阵乘主要使用 Cube 计算单元，通信主要使用互联链路，因此有重叠空间；两者也可能争用显存带宽，不能视为互不影响。

昇腾的 MC2 算子族就是为消掉这段串行而做的：把通信与计算的操作过程融合，使二者流水并行，典型成员包括 `AllGatherMatMul`、`MatMulReduceScatter`、`MatMulAllReduce`，官方给的量级是 GPT-3 整网约 10% [S20]。`enable_matmul_allreduce` 就是在 vllm-ascend 里接上这条路的开关：它让 `_get_row_parallel_op` 返回 `MatmulAllreduceRowParallelOp`，其 `apply_impl` 直接调 `torch_npu.npu_mm_all_reduce_base(input_parallel, weight.t(), hcomm_info, bias=bias_)`。

这里的bias是线性变换额外相加的偏置向量。TP rank为0且未要求延后添加时，当前计算才传入偏置；其他成员传入空值。要求延后添加时，偏置作为第二个返回值交给调用方，当前计算不加它（来源6，2c59ff10 linear_op.py 431–441）。

**融合争取缩短的是通信露在计算之外的等待时间。** 本页的 eager 调用没有传切块大小，Python 源码也没有给出它内部的通信算法。另一个图模式融合 pass 的注释把 AllReduce 描述为 ReduceScatter + AllGather，并使用 512 的门槛 [C11]；这不能证明 eager 算子也按 512 行切块，更不能证明两种实现的线上字节完全相同。

拿一组示意数走一遍：某个行并行线性这一步有 2048 行要过。

- 不融合：2048 行的矩阵乘全部算完，才把整份部分和交给 AllReduce，这段通信全程露在外面。
- 融合示意：**假设**按 512 行切成 4 块，第 1 块算完就开始发，同时算第 2 块，依此类推。若前 3 块通信都能被后续计算完全覆盖，才只剩最后一块通信暴露，约为原通信阶段的 1/4；这是理想流水算例，不是 eager 实现或实测 [A]。
- 只有 1 行时，上面的假设切法无法形成多块流水。但实际算子是否采用这种切法、是否还有其他收益，仍需核对实现和测量；不能据此断言小批次必然变慢。
- 派发分支没有 prefix 过滤，注意力输出投影、稠密 MLP 降维投影这些满足前提的行并行线性一律被换掉（GLM 上是 48 处，见下文「放到 GLM 双机」）。

派发次序是这个开关最容易踩的地方：

```wiki-diagram
file: enable-matmul-allreduce
```

`matmul_allreduce_enable()` 这一支一旦为真就无条件返回，后面的 `flashcomm2_enable()` 与 `enable_sp()` 永远到不了。反过来，细粒度 TP（`oproj_tensor_parallel_size` / `mlp_tensor_parallel_size`）与 [layer_sharding](layer-sharding.md) 的 `o_proj` 路径都排在它前面，那些层轮不到它。

其中细粒度MLP TP分支还要求该层不是MoE层：down_proj名称与开关同时满足后，仍要通过 not is_moe_layer(prefix)。未被前面分支认领的层才继续判断融合开关（来源5，2c59ff10 linear_op.py 716–721）。

## 开了的代价

**怎么开（仅 v0.23.0）。** 推荐用 `additional_config`，环境变量是迁移期的回落写法，命中时会打一条「下个 release 就删」的提示：

两种入口的解析不同：环境变量先转整数再转布尔值，additional_config则直接返回原配置值。因此JSON示例使用布尔值true；字符串"true"在Python条件中虽为真，却没有变成同一种类型（来源2、3，2c59ff10 ascend_config.py 353–365、envs.py 69–71）。

```bash
export HCCL_BUFFSIZE=500          # 所引旧版门禁用例的设置，不是所有负载的必需值
vllm serve <未量化的 BF16 模型> \
  --tensor-parallel-size 2 \
  --enforce-eager \
  --additional-config '{"enable_matmul_allreduce": true}'
```

这个示例使用未量化的 BF16 模型；GLM 双机的 W8A8 部署存在下文所列的不兼容。`--tensor-parallel-size 2` 是下限：算子只在 `reduce_results and tp_size > 1` 时才真正走融合分支。`--enforce-eager` 对应官方那句 eager 收益更好，也避开与图模式里 [fuse_allreduce_rms](fuse-allreduce-rms.md) 那条同族路径重复。`HCCL_BUFFSIZE=500` 来自所引旧版门禁用例。官方参数表见本地 `docs/source/user_guide/configuration/additional_config.md` L96 与线上 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html>。

**什么规模下才划算。** 图模式的另一个 pass 要求 `compile_range.start > 512` [C12]，这是那条 pass 的匹配门槛，不能当作本开关的 eager 性能分界。本开关没有按 token 数过滤调用；比较收益时应覆盖长 prefill、大 chunk 和不同 decode 批量，分别测量算子、通信与整步耗时。

**会改变后续分支的派发。** 对未被更早分支认领的行并行层，融合分支会先于 FlashComm2 的 o_proj 路径和 SP 路径返回，而这段派发没有冲突告警。同时配置这些特性时，需要逐层检查实际命中的分支；不能据此说整个模型的 SP 或 FlashComm2 都被关闭。

**不能沿用量化路径的兼容性结论。** 融合分支直接把 `self.layer.weight.t()` 交给 `npu_mm_all_reduce_base`，绕过 `quant_method.apply`；只有 `reduce_results`/`tp_size` 不满足时才落回量化路径。它不会自动带上量化方法所需的反量化处理。已核 GLM W8A8 动态量化还会在加载后把 int8 权重转成「输入 × 输出」：这里再转置一次，既缺反量化参数，形状也不符，详见下一段。其他量化后端须分别核对，不能仅凭开关存在判断兼容 [D]。

**放到 GLM 双机：本部署没开；按源码看，开了也跑不通。** 本部署跑的是含 GLM 代码的 db701c1f 快照，它带着这个开关、默认关 [C26]，v0.23 维护分支同样带着、同样默认关；官方 GLM 双机教程的启动命令里既没有这个键，也没有对应的环境变量 [S29]，所以本部署停在默认的关闭。

假如打开：TP8 满足生效前提；融合分支在派发里排第五，不看层名或是否量化，前面的几条细粒度切分在本部署均未启用。因此，只计 R1 纯文本请求的语言主干，一遍前向有 48 处行并行线性会尝试调用融合算子：45 层 attention 输出投影加前 3 层稠密 MLP 降维投影。这对应 R1 的 91 次 TP8 All-Reduce 中的 48 次，详见 [TP 通信账](../concepts/tensor-parallel.md#从一层走到整次前向r1-的通信账)；不含视觉塔和 MTP 草拟。词嵌入那 1 次不经过行并行线性；共享专家的 42 次由外层归约，它的降维投影不自己做 All-Reduce，融合调用的前提不成立，见[共享专家切法](../concepts/tensor-parallel.md#共享专家切法仍是列接行归约由外层安排)。

问题出在 W8A8。按源码推出来的链条是这样的：

1. 融合分支不经过量化路径：前提成立时直接把这一层的权重转置一次交给融合算子，只有前提不成立才走量化方法 [C27]。
2. int8 权重加载后排布已经变了：W8A8 动态量化在加载后把权重转成「输入 × 输出」[C28]，融合分支再转置一次就变回「输出 × 输入」，和融合算子要的排布正好相反。以稠密 MLP 的降维投影为例，每卡这一份输入 1536、输出 4096，两边不等，形状必然对不上；而且传进去的是 int8 张量，这条调用没带任何反量化参数。
3. 哪些层是 int8：两版已核量化快照的稠密 MLP 都是 int8，KDA 投影按 BF16 加载；MLA 输出投影在 9e55cbc8 为浮点、3121f187 才是 int8，版本统一见[部署页](../concepts/glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)。KDA 没有上述 int8 布局冲突，不等于已经通过设备兼容性测试。
4. 最早的这类冲突出现在第 0 层稠密 MLP 降维投影：前 3 层 attention 是 KDA，MLP 是 int8。若前面的设备调用正常，启动 profile 首次执行到这里就会遇到上述不匹配；确切报错与是否存在更早的硬件限制仍待实机核对 [D]。

待核：实际报错原文（哪个算子抛、报形状还是报类型），需要在设备上实跑。

只比较 KDA 层的形状：R1 每次归约的输入载荷为 32,768 B（4 个 token × 4096 × 2 B）；场景 M 的 DP0 一步 6,048 行，载荷为 47.25 MiB。若沿用每块 512 行的教学假设，分别对应 1 块和约 12 块；实际 eager 切块与收益尚未核定，不能把这个块数当作调优门槛。

**别把它当 prefill-only。** 来源 13 所在的 v0.10.0rc1 发布说明把它描述为 prefill 优化；而钉住的 v0.23 维护代码只读开关，不检查请求阶段，满足调用条件的 decode 也会走融合 [!]。早期发布说明不能替代当前所核实现的生效条件。

**要 batch-invariant 就别指望它。** `override_envs_for_invariance()` 会在配置生效后把 `enable_matmul_allreduce` 强行改回 `False`——融合算子的分块规约次序随 batch 形状变化，与逐 batch 一致的输出不相容。

**升到 main，这个键通常会让服务起不来，而不是被忽略。** main 上 `_get_row_parallel_op` 只剩 `wo_b` / `down_proj` / `o_proj` 三条细粒度 TP 分支，融合那一支连同 `flashcomm2_enable()`、`enable_sp()` 一起没了 [C14]；`AscendConfig` 也没有这个字段，而 `model_config = ConfigDict(extra="forbid")` 意味着未知 key 在构造时就报错 [C15]。`_NON_USER_INPUT_KEYS` 的豁免名单里只放了同批下线的 `enable_flashcomm1`，没有放它 [C17]。所以 `--additional-config '{"enable_matmul_allreduce": true}'` 在 main 上会被当成拼写错误直接拒绝。**升到 v0.26 分支则相反**：那里没有这层模式校验，同一份配置安静地跑起来，没有任何提示说这一档加速已经没了。

**一个例外要记住：装了 vLLM-Omni 就不报错了。** 构造 `AscendConfig` 之前会先算出 `unknown_keys`，如果非空且 `importlib.util.find_spec("vllm_omni")` 找得到，就只打一条「这些键对 vLLM-Ascend 无效，可能是 vLLM-Omni 在用」的 warning，然后把它们从 kwargs 里剔掉 [C23]。同一份旧配置，在纯 vllm-ascend 环境里起不来，在装了 Omni 的环境里只留一行 warning 就跑起来了——后者更危险，因为你会以为开关生效了。

对比之下 `enable_flashcomm1` 至少还有一条显式的废弃告警 [C16]，`enable_matmul_allreduce` 连告警都没有——环境变量 `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 在 main 上无人读取，设了也只会被静默忽略 [D]。官方迁移表也从 v0.23.0 的 9 行变成了 7 行，`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 那一行不在其中 [S18]；有意思的是 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 反而还留在表里，尽管代码路径上它已被废弃告警加剥离处理 [!]。线上对应 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html>。

**后续版本移除了这里的两条自定义入口。** 钉住的 main 在 `GraphFusionPassManager.configure` 中注册三种归一化或逐元素融合 pass [C19]；v0.26 还按 `pass_config.enable_sp` 注册一对序列并行 pass [C25]。两版都删除了这里的行并行包装类，以及 [fuse_allreduce_rms](fuse-allreduce-rms.md) 对应的 `MatmulAllReduceAddRMSNormPass` 和实现文件；发布说明在 #12119 中记录了这次移除 [S22]。这能说明旧开关的去向，不能据此排除上游编译器、设备库或其他执行路径采用通算融合。

同一份清单里 FlashComm2、multistream overlap gate、weight prefetch config 也都在被移除之列，而 `enable_flashcomm1` 被明确标注为「Use upstream configuration instead」。这些放在一起看，方向是把 TP 通信优化交回上游，而不是继续维护昇腾侧的自定义行并行算子 [I]——仓库里没有写明这条理由，是从这一批同批下线推断的。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（3 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |

- **引入**：2026-05-21 · 958daf83205ecad0afec3784be0b2a8b38725cd8 · PR [#9064](https://github.com/vllm-project/vllm-ascend/pull/9064) —— [Refactor]: migrate env vars to AscendConfig (#9064)
  包含该提交的 tag：v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ops/fused_moe/moe_comm_method.py` +347 / −347（文本行变化）
  - `vllm_ascend/utils.py` +41 / −19（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +7 / −7（文本行变化）
  - `vllm_ascend/batch_invariant.py` +5 / −6（文本行变化）
  - `vllm_ascend/patch/platform/patch_balance_schedule.py` +21 / −5（文本行变化）
- **移除**：2026-07-18 · 2ee50f3847e4873e61d280911b2a24d85f5278d6 · PR [#12119](https://github.com/vllm-project/vllm-ascend/pull/12119) —— [Refactor] Remove matmulallreduce and pass optimization techniques (#12119)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
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
