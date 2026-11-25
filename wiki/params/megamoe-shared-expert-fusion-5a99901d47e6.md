---
id: megamoe-shared-expert-fusion-5a99901d47e6
title: megamoe_shared_expert_fusion
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的 AscendConfig 内部派生布尔标志（默认 false）：由用户设置 enable_fused_mc2=3 自动推导置真，指示
  Atlas A5 的 CANN MegaMoE 融合算子将共享专家一并并入算子内部执行，而非单独跑共享专家前向。
aliases:
  - additional_config.megamoe_shared_expert_fusion
  - MegaMoE 共享专家融合
  - enable_fused_mc2=3
relations:
  - to: moe-comm-dispatch
    kind: builds-on
    note: enable_fused_mc2 各档位与 MoE 分发组合算子路由逻辑在那一页讲，本标志对应档位 3 的共享专家并入行为
  - to: expert-parallel
    kind: builds-on
    note: TP > 1 时融合算子不做跨卡规约，要求搭配 enable_shared_expert_dp 复制共享专家权重
  - to: ascend-950-architecture
    kind: builds-on
    note: >-
      严格依赖 CANN_MEGAMOE_SHARED_EXPERT_FUSION 与 MXFP 硬件能力，仅 Atlas A5（Ascend
      950）支持
  - to: ascend-config-system
    kind: builds-on
    note: 源码注释标明它是从 enable_fused_mc2=3 派生的内部字段，用户应配置 enable_fused_mc2 而非手写本键
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与正确配置入口
  为什么存在: 派生链路与五道融合准入门槛
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L708
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L769-L785'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1100-L1128'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/shared_experts.py#L180-L269'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L646-L660'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与正确配置入口

在带共享专家（Shared Expert）的 MoE 模型中，`enable_fused_mc2=2` 会用 CANN **MegaMoE** 大融合算子处理路由专家的「分发 + 专家 FFN + 合并」，但共享专家依然在算子外单独跑一遍前向再相加。`main` 分支新增档位 `enable_fused_mc2=3`，允许把共享专家的 `gate_up_proj` 与 `down_proj` 权重直接塞进 MegaMoE 算子的 `shared_l1_weights` / `shared_l2_weights` 槽位，由单次大算子一气呵成算完路由专家与共享专家。

`megamoe_shared_expert_fusion` 就是 `AscendConfig` 上记录这一内部状态的**派生布尔标志**（默认 `False`）。源码注释明确指出它是内部派生字段，**用户不应在 `--additional-config` 中直接手写 `megamoe_shared_expert_fusion`，而应配置 `enable_fused_mc2: 3`**：

```bash
vllm serve /models/DeepSeek-V3-MXFP8 \
  --tensor-parallel-size 8 --enable-expert-parallel \
  --additional-config '{"enable_fused_mc2": 3, "enable_shared_expert_dp": true}'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 字段性质与正确入口 | 内部派生字段（`bool = False`）；用户入口为 `enable_fused_mc2: 3` | `enable_fused_mc2=2` 派生为 `False`（独立跑共享专家），`=3` 派生为 `True` |
| 支持硬件 | 仅限 Atlas A5（`CANN_MEGAMOE_SHARED_EXPERT_FUSION`） | 在 Atlas A2 / A3 / 310P 上置真会在启动期直接抛 `NotImplementedError` |
| 模型结构硬约束 | 路由专家与共享专家须同残差宽度（非 Latent-MoE） | 暴露 `routed_expert_hidden_size` 的 Latent-MoE（如 Kimi K3）直接抛 `NotImplementedError` |
| 算子包依赖 | 需安装 `cann_ops_transformer` | 缺失该包时告警并将 `enable_fused_mc2` 降为 `1`，但不会清零已赋真的本标志（非 A5 仍抛 `NotImplementedError`，A5 因 `use_cann_megamoe` 为假不走融合） |
| 路由专家量化要求 | `W8A8MXFP`、`W4A4MXFP` 或 `W4A8MXFP` | 非 MXFP8 / MXFP4 量化类型打印提示并回退独立共享专家前向 |
| TP > 1 并行条件 | 必须让每卡持有完整共享专家权重（如 `enable_shared_expert_dp: true`） | 若共享专家按 TP 切分且未复制，算子内不做跨卡规约，会自动回退独立前向 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 的 `enable_fused_mc2` 仅认 `0 / 1 / 2`，传 `3` 报错；标准 `v0.30.0` 写本字段名被拒收，`v0.23.0`/`v0.26.0rc` 静默忽略 |

## 派生链路与五道融合准入门槛

配置校验器分两阶段把关：
1. **启动期快速失败（`_validate_user_input_ranges` 与 `_validate_megamoe_shared_expert_fusion`）**：当 `enable_fused_mc2` 为 `2` 或 `3` 时，`_validate_user_input_ranges` 先按 `self.enable_fused_mc2 == 3` 给 `self.megamoe_shared_expert_fusion` 赋值（因此 `enable_fused_mc2=2` 会把任何手写的 `megamoe_shared_expert_fusion: true` 覆盖回 `False`），再检查是否安装了 `cann_ops_transformer`——若未安装则告警并将 `self.enable_fused_mc2` 降级为 `1`，但保留 `self.megamoe_shared_expert_fusion` 不清零；随后 `derive_and_validate` 调用 `_validate_megamoe_shared_expert_fusion`，只要本标志为真且设备不支持 `CANN_MEGAMOE_SHARED_EXPERT_FUSION` 或模型含 `routed_expert_hidden_size`，立刻抛 `NotImplementedError` 终止启动。
2. **层构建期精细回退（`shared_experts.py`）**：即便进入 Atlas A5 上的非 Latent-MoE 模型，每个共享专家层还会依次核对五道算子能力门槛，只要有一条不满足就打印日志并退回独立共享专家前向，不影响服务运行：
   - 路由专家量化类型必须属于 MXFP 家族（`W8A8MXFP` / `W4A4MXFP` / `W4A8MXFP`，共享专家自身可与路由专家混合精度并重排为所需布局）；
   - 层上不存在算子外门控 `expert_gate`（如 Qwen3-Next 的输出门控）；
   - `gate_up_proj` 与 `down_proj` 均不带 `bias`；
   - 共享专家与路由专家的激活函数类型及全部超参签名完全一致（MegaMoE 算子全局只执行同一套激活函数）；
   - 当 `moe_config.tp_group.world_size > 1` 时，`self.weights_replicated` 为真（即已开启 `enable_shared_expert_dp`）。

## 代价与互斥边界

- **切勿脱离 `enable_fused_mc2: 3` 单独手写本键**：如果在 `enable_fused_mc2: 0`（或 `1`）时强行手写 `"megamoe_shared_expert_fusion": true`，在非 A5 机器上会白白触发 `_validate_megamoe_shared_expert_fusion` 的 `NotImplementedError`，而在 A5 上又因为 `use_cann_megamoe` 为假根本不会启用融合；若与 `enable_fused_mc2: 2` 同传，则会在 `_validate_user_input_ranges` 被直接覆写回 `False`。
- **共享专家权重复制显存代价**：在 `TP > 1` 拓扑下，为了满足算子内无跨卡规约的数学等价性，必须开启 `enable_shared_expert_dp: true` 让每张卡都保存一份完整共享专家权重（且在 MXFP4 下需重建 `FRACTAL_NZ` / `FRACTAL_NZ_C0_32` 缓冲），用少量每卡静态权重显存换取少跑一整趟独立共享专家前向与跨卡规约。

## 对照源码

下表对照四个固定教学快照中 `enable_fused_mc2=3` 与 `megamoe_shared_expert_fusion` 的状态：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 字段与档位范围 | 无（`.get()` 忽略）[C6] | 无（`.get()` 忽略）[C7] | 无此字段；`enable_fused_mc2` 仅允许 `(0, 1, 2)` [C5][!] | 新增 `megamoe_shared_expert_fusion`，在 `(2, 3)` 分支先按 `== 3` 赋值再查 `cann_ops_transformer` [C1][C2] |
| 硬件与 Latent-MoE 校验 | — | — | — | 只要本标志为真（含缺 `cann_ops_transformer` 降档场景），非 A5 或含 `routed_expert_hidden_size` 均抛 `NotImplementedError` [C2][C3][!] |
| 共享专家层五道准入 | — | — | — | 逐项核对 MXFP、无 `expert_gate`、无 `bias`、激活签名一致及 `TP>1` 权重复制 [C4] |

- **误配行为推导**：手写 `megamoe_shared_expert_fusion: true` 遇 `enable_fused_mc2=2` 被覆写为 `False`、遇 `=0/1` 在非 A5 报错或在 A5 空转，均由 `_validate_user_input_ranges` 赋值顺序与 `shared_experts.py` 先判 `use_cann_megamoe` 两条控制流联立推导 [C2][C4][D]。
- **待核**：尚无 Atlas A5 实机对比 `enable_fused_mc2=2` 与 `=3`（配合 `enable_shared_expert_dp=true`）在 DeepSeek-V3 MXFP8 下的单层微秒收益与显存增量。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["megamoe_shared_expert_fusion"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:708` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

Derived from enable_fused_mc2=3: MegaMoE runs the shared expert inside the operator instead of the separate shared-expert forward. enable_fused_mc2=2 keeps the shared expert separate. Internal flag, not user-settable.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_fused_mc2 in (0, 1):
    _MEGA_MOE_SUPPORTED = False
elif self.enable_fused_mc2 in (2, 3):
    self.megamoe_shared_expert_fusion = self.enable_fused_mc2 == 3
    _MEGA_MOE_SUPPORTED = importlib.util.find_spec('cann_ops_transformer') is not None
    if self.enable_fused_mc2 == 3 and (not _MEGA_MOE_SUPPORTED):
        logger.warning_once('enable_fused_mc2=3 requires the cann_ops_transformer package; MegaMoe (and its shared-expert fusion) will be disabled.')
    self.enable_fused_mc2 = 1
else:
    raise ValueError(f'enable_fused_mc2 must be one of 0, 1, 2 (MegaMoE) or 3 (MegaMoE + shared-expert fusion); got {self.enable_fused_mc2}')
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.megamoe_shared_expert_fusion` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
