---
id: multistream-overlap-gate
title: multistream_overlap_gate
type: param
summary: >-
  v0.23.0 的 FlashComm3 门控多流重叠开关，把 MoE 共享专家前向与 select_experts 路由放到副流，与 prepare
  阶段的动态量化及 EP All-Gather 并行；v0.24.0rc 起整套实现已删除，v0.26 静默忽略，v0.30.0 与 main
  通常拒收未知键（发现 vLLM-Omni 时告警并过滤）。
aliases:
  - FlashComm3 多流重叠门控
  - 多流门控重叠
legacyAnchors:
  一句话: 它曾做什么，为什么 v0.24 起已移除？
  事实表: 它曾做什么，为什么 v0.24 起已移除？
  为什么存在: 在 v0.23.0 里怎么跨流重叠，消费条件是什么？
  开了的代价: 旧部署的风险、迁移清理与 GLM 双机推演
chapters:
  - '14'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L140'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L78-L79
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L372-L383'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L600-L640'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L655-L658'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L834-L881'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L883-L894'
  - 'vllm-ascend@2c59ff10:vllm_ascend/flash_common3_context.py#L1-L41'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L52-L59'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L351-L399'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L104-L108'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/utils.py#L21-L47'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L269
  - 'vllm-ascend@2c59ff10:vllm_ascend/lora/fused_moe.py#L75-L87'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L143-L184'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L192-L207'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L235-L241'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L59-L61
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L140
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L153-L153'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L438-L494'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L268-L291'
  - >-
    raw:sha256-d38ceded99e5ddc680dc7956be0c8b72c57648f1fe2a604334d6a4d605c3e3d6.md#L1-L507
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ops/fused_moe/prepare_finalize.py#L381-L398
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/distributed/utils.py#L21-L44
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L577-L581'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L832-L847'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_mxfp8.py#L285-L318'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L298'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L673-L721'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L188-L259'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L310-L367'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L575-L575'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L850-L855'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1849-L1907'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L667-L667'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L919-L924'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1972-L2030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 additional_config 里的一个键，v0.30.0 与 main 上通常让启动失败的不是 MoE 代码，而是 AscendConfig 那层
      extra="forbid" 的模式校验
contradicts: []
updated: 2026-11-19T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-36624e5fb90c839df56eefbde64f189759712d22035d7e1b93292fb9afd596fb.md
  - >-
    raw/sha256-46ac2bccb9747d7b0cac39aeb069990d5bde8cc3ad91bd6f37d002973c94897a.md
  - >-
    raw/sha256-88d6f3fe29d6159c03e5648c07ca4bf766dc05c0f6547e10b189260cb1c34c59.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-d38ceded99e5ddc680dc7956be0c8b72c57648f1fe2a604334d6a4d605c3e3d6.md
---

## 它曾做什么，为什么 v0.24 起已移除？

推理走到 MoE（混合专家）层时，NPU 既要把本地隐藏态量化并跨卡汇总（`prepare` 准备阶段），又要算每个 token 必经的**共享专家前向**（含 TP All-Reduce，见 [MoE 的共享专家](../concepts/moe.md#共享专家每个-token-都要过的那一个)）和给每个 token 挑专家的 **`select_experts` 路由**（见[跟着一个 token 走一遍](../concepts/moe.md#moe-怎么算跟着一个-token-走一遍)）。

`multistream_overlap_gate`（上游称 **FlashComm3 multistream-overlap gate**）的思路是把这两段工作拆到不同的 NPU **stream（流）**上并行跑：同一条流中的任务按顺序执行，不同流上的任务可以在设备上重叠运行；一条流停下来等另一条流完成再继续称为 **join（汇合）**——汇合之后才能安全读取对方的输出。

**当前状态（`v0.30.0` `c09d3e20` 与 `main` `8d6180e2`）**：**该开关和整套 FlashComm3 多流门控实现在 `v0.30.0` 与 `main` 中均已删除。** 它在 `v0.23.0` 发版时即被列入「Ready to Deprecate」，自 `v0.24.0rc` 起随 PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) 整套移除（连同 `flash_common3_context.py`、`fc3_quant_x` 通信组与 `fc3_all_gather_and_maybe_unpad_impl` 一起删除），`v0.26.0rc`、`v0.30.0` 与 `main` 均不再保留。若从旧版迁移时把它残留在 `--additional-config` 里，`v0.30.0` 与 `main` 的普通进程会直接被 `extra="forbid"` 拒收（发现 `vllm_omni` 时告警过滤），升级时应直接删掉此键。

在仍包含它的历史 **`v0.23.0`（`2c59ff10`）** 中，它是默认 `False` 的布尔开关：开启后把共享专家前向与 `select_experts` 路由整体搬到副流 `gate_stream` 上，让它们与主线里的「动态量化 + EP All-Gather 隐藏态」并行执行。迁移时不要把它和至今仍在 `v0.30.0` / `main` 中保留的 `multistream_overlap_shared_expert` 混为一谈：

| 对比维度 | `multistream_overlap_gate`（历史开关） | `multistream_overlap_shared_expert`（现存开关） |
| --- | --- | --- |
| 存在版本 | 仅 `v0.23` 维护线（`v0.24.0rc` 起移除） | `v0.23`、`v0.26.0rc`、`v0.30.0`、`main` 均有，默认 `False` |
| 搬到副流的计算 | 共享专家前向（含 TP All-Reduce）+ `select_experts` 路由 | 仅共享专家计算（移至 `shared_experts_calculation_stream()`） |
| 升级后留着旧键 | `v0.26.0rc` 静默忽略；`v0.30.0`/`main` 通常拒收（发现 `vllm_omni` 时告警过滤） | 正常字段；但 `enable_fused_mc2 == 1` 时会被自动告警关闭 |

在 `v0.23.0` 上若同时开启这两个开关，共享专家由 `gate_stream` 接管，取结果时直接读取 `fc3_context.shared_out`，`_forward_shared_experts` 里的 `multistream_overlap_shared_expert` 分支会沦为死代码。升级后被删除的只是 gate 开关，不要把 `multistream_overlap_shared_expert` 一并误当废弃项删掉。

## 在 v0.23.0 里怎么跨流重叠，消费条件是什么？

MoE 层在进入路由专家计算之前有一段准备期（`prepare`）。开启序列并行且 MoE 走 AllGather 路径时，主线会先在当前流量化本卡隐藏态，再在 EP 组内收集隐藏态与量化尺度。共享专家 FFN 只需要本地隐藏态，`select_experts` 只需要已算出的 `router_logits`，因此这两段工作可以提前提交到副流 `gate_stream` 执行。需要注意，AllGather 路径仍须汇集选专家结果，并非完全免通信，仅凭源码也不能证明准备期所有计算单元都处于空闲状态（组和载荷见[序列并行接法](../concepts/sequence-parallel.md#vllm-ascend-里的-sp-是怎样接进去的)，通信路径选择见[专家并行](../concepts/expert-parallel.md#mc2-还是-allgather)）。

**三条实现核心事实**：
- **为何冠以 FlashComm3（SP 依赖）**：`PrepareAndFinalizeWithAllGather.prepare` 只有在 `enable_sp()`（FlashComm1）或 `enable_sp_by_pass()`（非强制 eager 且编译配置开启 `enable_sp`）为真时，才走 `_prepare_with_ep_group`。两者均未开启时走按 DP 组收集的另一分支，`quant_stream` 那半边逻辑完全不会执行。
- **跨流传值与类级单例流**：跨流传递结果依靠模块级全局单例 `FlashCommon3Context`，本开关实际写入 `topk_weights`、`topk_ids`、`shared_experts`、`shared_out` 四个字段（类里另有 `gate`、`row_idx` 两个字段未由本开关写入）。两条副流都是**类级单例**，首次构造时创建、不随层数增长：`gate_stream` 挂在 MoE 层类上（配套 vLLM 0.23.0 实际导入的 legacy 实现为 `AscendFusedMoE`，新实现为 `AscendMoERunner`），`quant_stream` 挂在 `PrepareAndFinalize` 上。
- **副流通信与硬汇合点**：量化本身仍在当前流完成，随后才切到 `quant_stream`（先等待当前流），借助专门新建的 HCCL 通信组 `fc3_quant_x`（rank 划分与 `mc2` 组共用同一份 `group_ranks`）调用纯 Python 的 `fc3_all_gather_and_maybe_unpad_impl`（而非主线自定义算子 `torch.ops.vllm.maybe_all_gather_and_maybe_unpad`，推测是为规避自定义算子在非默认流上的行为问题）汇集隐藏向量并按各 DP 成员有效长度去填充；量化尺度仍在当前流另行收集。两条副流均有硬汇合点：`quant_stream` 在 `prepare` 结束前等待回来，`gate_stream` 在专家量化方法执行前等待回来。

```wiki-diagram
file: multistream-overlap-gate
```

**收益边界与消费端**：
- **理想模型 ≠ 实测收益**：理想情况下两段独立耗时 A 与 B 无额外同步与资源争用时，串行 `A + B` 可缩为 `max(A, B)`（最多省 `min(A, B)`）；但实际路径包含选专家结果收集、量化尺度收集与设备资源竞争，不能把理想差额直接当实测收益。
- **仅两种量化方法消费**：消费端位于量化方法的 `apply()` 中——检测到开关开启后跳过自身 `select_experts`，改从 `FlashCommon3Context` 读取预先算好的 `topk_weights` 与 `topk_ids`。只有 `w8a8_dynamic` 与 `w8a8_mxfp8` 实现了该读取分支；未量化（BF16）MoE 没有接收端，而开启本开关后 `_prepare_with_ep_group` 又不再 All-Gather `router_logits`，两边无法衔接。稠密模型无 MoE 入口；单卡部署无跨卡 All-Gather 可隐藏（配置层本身不禁止单卡）。
- **日志不等于收益证明**：构造阶段打印的 `info_once` 日志 `[fused_moe/layer] Multistream overlap gate is enabled.` 只能证明配置分支开启，不能证明首次前向成功、设备上发生有效重叠或性能提升。[v0.23.0 官方参数表](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)仅给出功能与默认值，没有同负载开关对照（引入 PR 另有图片记录，不能因参数表无数字推断上游未测）。仅凭源码也不能断言「小 decode 收益最大」或「长序列收益趋零」——例如 A2 小批走 MC2 时 `prepare` 只做补齐与切片、并无 EP All-Gather，无法套用通信隐藏窗口，是否省时仍须同负载实测对比完整执行时间。

## 旧部署的风险、迁移清理与 GLM 双机推演

```wiki-diagram
file: param-multistream-overlap-gate-guards
```

在仍停留在 `v0.23` 的部署上开启它，需同时满足多项前置条件并承担额外开销：

| 风险 / 边界场景 | 实际行为与源码触发点 | 工程提醒 |
| --- | --- | --- |
| 无共享专家的 MoE | `self.multistream_overlap_gate` 直接取开关值（仅 `shared_multistream_overlap_gate` 才与 `has_shared_experts` 做与）；`fc3_context` 仅在 `shared_forward_impl` 初始化。若进程未建立该 context，legacy `forward_impl`（或新实现 `no_shared_forward_impl`）进门控分支首句命中裸断言 `assert fc3_context is not None`（源码推导，尚无实机日志） | 不会静默降级；开启前须核对实际模型结构、量化方法、prepare 路径与张量形状，勿仅凭模型家族名判断 |
| 量化方法与序列并行缺失 | 仅 `w8a8_dynamic` / `w8a8_mxfp8` 消费预路由结果；须开 FlashComm1 或图编译 pass 版 SP，否则 `quant_stream` 不执行，多卡下主线 MC2 切片或 AllGather 按 DP 汇集均会与副流路由发生行数失配 | 仅开图编译 pass 版 SP 时，AllGather 路径会补收路由结果，但 MC2 是否补齐切片只看 FlashComm1，该组合行数对齐尚待实测核验 |
| MoE LoRA v1 硬互斥 | `vllm_ascend/lora/fused_moe.py` 第 82–87 行抛 `AssertionError`（`multistream_overlap_gate=True interleaves quant_method.apply calls on multiple streams; ...`）；带共享专家层在第 75–81 行更早被拒 | 均无自动降级 |
| Ascend 310P 双实现分叉 | 非 vLLM 0.23.0 的 `AscendMoERunner310` 构造器把 `multistream_overlap_gate`、`shared_multistream_overlap_gate`、`multistream_overlap_shared_expert` 一并置为 `False`；legacy `AscendFusedMoE310` 无这三行覆盖，但自实现的 `shared_forward_impl` 先算路由专家再算共享专家，同样不走门控重叠 | 不能仅凭新 runner 的字段覆盖断言所有 310P 配置静默通过或零初始化开销 |
| 额外资源占用 | 增加 2 条类级单例 NPU stream、1 个 `fc3_quant_x` HCCL 通信组（分布式初始化时创建）及跨流等待和中间张量存活占用 | 流数不能推导独立内存池数或固定显存增量，具体峰值与耗时须实测 |
| 升级迁移与未知键处理 | `v0.26.0rc` 逐键 `.get()` 静默忽略（不保证其他配置通过）；`v0.30.0` 与 `main` 按 `ConfigDict(extra="forbid")` 拒收普通进程中的该未知顶层键；发现 `vllm_omni` 时先打告警 `"The following additional_config keys are invalid for vLLM-Ascend: %s. They may be used by vLLM-Omni or another project. Please remove them if they are not needed for your use case."` 再过滤 | 忽略与过滤均不恢复已删除功能，升级须直接删键 |

**放到 GLM 双机（`db701c1f` 固定基线）**：该部署为两台 A2、TP8 / DP2 / EP16、W8A8（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)），官方启动命令未传此键（默认 `False`），42 层 MoE 走无门控直路，共享专家在路由专家之后串行计算（见 [MoE 共享专家](../concepts/moe.md#共享专家按-tp8-切走融合算子)）。它虽具备共享专家与 W8A8-dynamic 两条前提，但未开启序列并行（见[序列并行 GLM 说明](../concepts/sequence-parallel.md#放到-glm-双机这套部署开了-sp-吗)）。

按 `db701c1f` 源码推演强行开启的后果（以示例请求 R1 每边 4 token 走 MC2 为例，见[单请求 MoE 通信](../concepts/one-request.md#moe-通信走-mc2-还是-allgather)）：
- **启动阶段**：建立 2 条副流与 `fc3_quant_x` 通信组，并打印 legacy 的 `info_once` 日志。
- **MC2 路径（行数失配）**：每层 MoE 副流先算共享专家及 TP8 All-Reduce，再对完整 4 token 算路由得到 **4 行**结果；主线 MC2 准备把 4 行补到 8 行并按 TP8 每卡切出 **1 行**隐藏态（且无通信可隐藏）。汇合后量化方法拿 4 行路由去配 1 行隐藏态，MC2 路径无对应切分导致行数不一致。
- **AllGather 路径**：超出 MC2 容量转入 AllGather 时，未开 SP 同样使主线按 DP 组汇集隐藏态，而路由辅助收集不执行相同变换，存在同样行数风险；具体报错或数值后果仍待实机验证。

## 对照源码

下表汇总 `multistream_overlap_gate` 在四个基线版本的存在状态与替代开关对照，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| `multistream_overlap_gate` 键与默认 | 存在，`bool`，默认 `False` | 已删除，`.get()` 静默忽略 [C23] | 已删除，通常拒收（`vllm_omni` 告警过滤）[C40] | 同 `v0.30.0` [C43] | 升级必须删键；忽略或过滤均不恢复旧重叠 [!] |
| 消费方法与 SP 条件 | `w8a8_dynamic` / `w8a8_mxfp8`，`enable_sp() or enable_sp_by_pass()` [C10] | — | — | — | 未量化 MoE 无接收端，未开 SP 失去 `quant_stream` 并可能行数失配 [D] |
| 替代关系与 `multistream_overlap_shared_expert` | 两开关并存，同开时 gate 接管共享专家 | 仅 `multistream_overlap_shared_expert` 保留 | 默认 `False`，`enable_fused_mc2 == 1` 时告警关闭 [C39] | 同 `v0.30.0` [C42] | 现存键并非旧 gate 的别名，有独立适用条件 [S18] |
| 上游状态 | 发版即列入 Ready to Deprecate [S17] | PR #11956 已移除 [S21] | 已移除 | 已移除 | 仅作历史排错参考，勿在新部署使用 |

- **v0.23.0 定义与实现链路**：配置字段见 `2c59ff10:ascend_config.py#L139-L140`（来源 1、20）及 `additional_config.md#L78-L79`（来源 2）；MoE 分支、类级 `gate_stream`、无共享专家断言与 legacy 导入见 `fused_moe.py#L290-L298, #L372-L383, #L600-L640, #L655-L658, #L834-L894` 与 `fused_moe_0_23_0.py#L192-L207, #L673-L721`（来源 3–7、16、34–35）；上下文单例见 `flash_common3_context.py#L1-L41`（来源 8）[C8]。
- **副流 All-Gather、消费端与限制**：`prepare_finalize.py#L52-L59, #L351-L399`（来源 9–10、28）说明量化在当前流执行、隐藏态收集切 `quant_stream`、量化尺度仍在当前流收集；`fc3_quant_x` 建组与纯 Python 实现见 `parallel_state.py#L104-L108` 与 `distributed/utils.py#L21-L47`（来源 11–12、29）[I]。消费端见 `w8a8_dynamic.py#L262-L269` 与 `w8a8_mxfp8.py#L285-L318`（来源 13、33）；MoE LoRA v1 互斥见 `lora/fused_moe.py#L75-L87`（来源 14）；310P 新 runner 与 legacy 分叉见 `_310p/fused_moe/fused_moe.py#L143-L259, #L310-L367`（来源 15、36–37）[C14]。
- **GLM 基线与跨版清理**：`db701c1f:fused_moe_0_23_0.py#L438-L494` 与 `prepare_finalize.py#L268-L291`（来源 25–26）支撑 GLM MC2 4 行路由对 1 行隐藏态的源码推演 [I]。移除与未知键处理见 `v0.26` `2ed6cbba:ascend_config.py#L56-L73, #L153`（来源 23–24）、`v0.30.0` `c09d3e20:ascend_config.py#L575, #L850-L855, #L1849-L1907`（来源 38–40）与 `main` `8d6180e2:ascend_config.py#L667, #L919-L924, #L1972-L2030`（来源 41–43），以及历史 `baa023ad`/`7d825229` 快照（来源 17–19、21–22、30–32）[D]。
- **待核**：仅开图编译 pass 版 SP 时 MC2 准备期隐藏态行数是否与副流路由对齐，以及 GLM 双机强制开启后的实机报错日志与同负载性能对照，本工作区均无实机验证 [!] 。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（9 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2025-12-14 · ba28d54f359278c83ed0f55ba78de9b1996f2b12 · PR [#4065](https://github.com/vllm-project/vllm-ascend/pull/4065) —— [Perf]enable prefill flashcommon3 (#4065)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ops/fused_moe/fused_moe.py` +87 / −21（文本行变化）
  - `vllm_ascend/quantization/w8a8_dynamic.py` +22 / −12（文本行变化）
  - `vllm_ascend/ops/fused_moe/prepare_finalize.py` +29 / −5（文本行变化）
  - `vllm_ascend/distributed/parallel_state.py` +21 / −1（文本行变化）
  - `vllm_ascend/distributed/utils.py` +32 / −1（文本行变化）
- **移除**：2026-07-15 · 77baade98ded755b3e5ea30091bcf40a30ae0335 · PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) —— [Refactor] Remove multistream overlap gate (#11956)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
  - `vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py` +11 / −76（文本行变化）
  - `vllm_ascend/ops/fused_moe/fused_moe.py` +11 / −75（文本行变化）
  - `vllm_ascend/flash_common3_context.py` +0 / −41（文本行变化）
  - `vllm_ascend/distributed/utils.py` +1 / −34（文本行变化）
  - `vllm_ascend/quantization/methods/w8a8_dynamic.py` +18 / −29（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["multistream_overlap_gate"]` |
| 类型 | `unknown` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:140` [C20] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
