---
id: enable-fused-mc2-782bf6f2bf48
title: enable_fused_mc2
type: param
summary: >-
  控制 MoE 层是否把 Dispatch、路由专家 FFN 与 Combine 融合成单个通算融合大算子
  FUSED_MC2（dispatch_ffn_combine 或 CANN MegaMoe）；取代旧环境变量
  VLLM_ASCEND_ENABLE_FUSED_MC2，不同值对应不同融合层级并受芯片档位与并行度门控。
aliases:
  - enable_fused_mc2
  - MoE 通算融合开关
relations:
  - to: moe-comm-dispatch
    kind: builds-on
    note: 在 MoE 通信选路中选择 FUSED_MC2（dispatch_ffn_combine / MegaMoe）路径
  - to: moe
    kind: builds-on
    note: 将 MoE 的路由分发、两层矩阵乘与归约融合成单一算子
  - to: megamoe-shared-expert-fusion-5a99901d47e6
    kind: builds-on
    note: main 分支 enable_fused_mc2=3 自动派生 megamoe_shared_expert_fusion=True
  - to: multistream-overlap-shared-expert-8d7558953faf
    kind: conflicts-with
    note: enable_fused_mc2=1（含 2 归一后）会自动强制关闭多流共享专家重叠
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
origin: seed
evidence: C
updated: '2026-11-28'
sources:
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L605
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L661-L672
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L840-L860
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L1005-L1010
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_forward_context.py#L297-L413
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/device/hardware_profile.py#L281-L343
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ops/fused_moe/moe_comm_method.py#L580-L611
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/lora/fused_moe.py#L176-L180
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L704
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L771-L788
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L1101-L1128
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/envs.py#L102
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L179-L208
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，四个整数档位怎么选？

`enable_fused_mc2` 控制 MoE 路由专家是否把通信分发、两层矩阵计算和结果归约合并成单个通算融合算子（`dispatch_ffn_combine` 或 `CANN MegaMoe`）；它默认 `0`（关闭），取代旧环境变量 `VLLM_ASCEND_ENABLE_FUSED_MC2`。

## 为什么存在

在常规 `AllToAll` 或标准 `MC2` 路径下，MoE 路由层至少要依次经历 Token 分发、门控上投影（GMM1）、激活量化、下投影（GMM2）与通信聚合多步调用。每一步之间的算子启动与全球内存（GM）读写都会放大中小批量的端到端尾延迟（通信选路详情见 [MoE 通信与分发策略](../concepts/moe-comm-dispatch.md)）。

`FUSED_MC2` 把这一整段压缩成片上通算并行核函数，减少核调度与 GM 往返次数，并按硬件代际和融合程度分成不同整数档位：

- **`1`（`dispatch_ffn_combine`）**：早期融合算子实现，主要服务 A3 上的 W8A8（需 `w1_scale_bias`/`w2_scale_bias`）且要求 `ep_world_size <= 32`。
- **`2`（`CANN MegaMoe`）**：借助 `cann_ops_transformer` 提供的 `MegaMoe` 算子与独立 symmetric buffer，支持更大带宽场景并在 `v0.30.0` 内部完成回退归一化（先置 `_MEGA_MOE_SUPPORTED` 标记再将字段归一到 `1`）。
- **`3`（`main` 新增：`MegaMoe + 共享专家融合`）**：把共享专家也吞进同一个 `MegaMoe` 算子，但严格限制在 A5 且非 Latent-MoE 模型上（详见 [megamoe_shared_expert_fusion](megamoe-shared-expert-fusion-5a99901d47e6.md)）。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 取值范围（`v0.30.0`） | `0` / `1` / `2` | `0` 关闭；`1` 启用 `dispatch_ffn_combine`；`2` 尝试启用 `CANN MegaMoe` |
| 取值范围（`main`） | `0` / `1` / `2` / `3` | `3` 额外衍生 `megamoe_shared_expert_fusion=True`，仅 A5 有效 |
| A2 选路 | 不使用 `FUSED_MC2` | `CAPACITY_AND_EXPERT_DENSITY` 只选 `MC2` 或 `ALLGATHER` |
| A3 选路 | `FUSED_OR_CAPACITY` | `use_cann_megamoe` 为真，或 `enable_fused_mc2 == 1` 且 `ep_world_size <= 32` 时进入 `FUSED_MC2`（无 `cann_ops_transformer` 传 `2` 会保留 `1` 并走 `dispatch_ffn_combine`） |
| A5 选路 | `CAPACITY_AND_WORLD_SIZE` | `enable_fused_mc2 == 1` 且 `is_mega_moe_supported()` 为真即进 `FUSED_MC2`；不兼容量化的投机草稿层自动绕过 |
| 静默回退边界 | 已装 `cann_ops_transformer` 但模型不支持 MegaMoe | 仅当 `is_mega_moe_supported()` 为真且 `_is_megamoe_supported_by_config` 为否时，打印警告并将 `enable_fused_mc2` 重置为 `0` |
| 互斥项（自动覆盖） | `multistream_overlap_shared_expert` | `enable_fused_mc2=1` 时自动把多流共享专家重叠关闭为 `False` |
| 旁路与报错边界 | LoRA+EP 旁路；`hierarchy` / MiniMax M3=`1` 报错 | MoE+LoRA+EP 正常前向提前旁路到 `ALLTOALL`；`mc2_comm_alg == "hierarchy"` 或 MiniMax M3 无 MegaMoe 设 `1` 抛异常 |

## 开了的代价与常见坑

1. **与共享专家多流重叠静默打架**：很多教程同时复制了 `multistream_overlap_shared_expert: true` 和 `enable_fused_mc2: 1/2`。注意 `AscendConfig` 在校验阶段只要发现 `enable_fused_mc2 == 1`，就会把 `multistream_overlap_shared_expert` 强制改回 `False` 并只记一次 warning；而在 `v0.30.0` 传 `2` 会先归一化成 `1`，同样把多流重叠关闭。
2. **传 `2` 时的两类不同回退行为**：传入 `enable_fused_mc2=2` 后，构造前验证会先把 `self.enable_fused_mc2` 归一化为 `1`，并用能否找到 `cann_ops_transformer` 包设定 `_MEGA_MOE_SUPPORTED`。之后只有当 `is_mega_moe_supported()` 为 `True`（已安装该包）而 `_is_megamoe_supported_by_config()` 返回 `False` 时，才会将 `enable_fused_mc2` 重置为 `0`；如果环境根本未安装 `cann_ops_transformer`（`is_mega_moe_supported()` 为 `False`），该清零分支不会触发，`enable_fused_mc2` 会保留为 `1`，因此 A3 在 `ep_world_size <= 32` 且权重支持时仍会走常规 `dispatch_ffn_combine`（而 A5 会跳过 `FUSED_MC2` 进入常规选路）。
3. **LoRA 旁路与显式硬报错边界**：MoE + LoRA + EP 在正常推理前向与 `_dummy_run` 中，会在 `select_moe_comm_method()` 进入 `_MOE_COMM_SELECTORS` 之前被提前拦截并干净旁路到 `MoECommType.ALLTOALL`（不会改动 `AscendConfig.enable_fused_mc2`，也不会报错）；`lora/fused_moe.py` 中的 `AssertionError` 只是绕过 `ascend_forward_context` 直调融合路径时的防御性断言。真正会在启动期直接抛错的是：`mc2_comm_alg: "hierarchy"`（`ValueError`）、MiniMax M3 在无 MegaMoe 时使用 `1`（`AssertionError`），以及 `main` 上把 `3` 传给 A3 或 Kimi K3。

## 何时改用其他组合

- **A3/A5 大 EP 低延迟 Decode 或高密度 MoE（无 LoRA、无 `hierarchy`）**：尝试 `1`（A3 W8A8 `ep <= 32`）或 `2`（A3/A5 `MegaMoe`），A5 若有共享专家再评估 `main` 的 `3`。
- **必须开启 MoE LoRA、动态 EPLB 边界或 `mc2_comm_alg: "hierarchy"`**：设为 `enable_fused_mc2: 0`，按需开启 `multistream_overlap_shared_expert: true`。

想逐档对比 `enable_fused_mc2` 与 `multistream_overlap_shared_expert`、`HCCL_BUFFSIZE`、`weight_nz_mode` 的互斥与依赖，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=enable-fused-mc2-782bf6f2bf48&q=enable_fused_mc2&sel=%7B%22cfg_enable_fused_mc2%22%3A0%7D)。链接从 `0` 档起步；在卡片上切到 `1`、`2` 或 `3`，再叠加 `multistream_overlap_shared_expert` 等旋钮，就能逐项检查互斥与依赖。

## 对照源码

| 版本 | 类型与支持值 | `VLLM_ASCEND_ENABLE_FUSED_MC2` | 关键选路与校验演变 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `_get_config_value` int | 存在，默认 `0`（`envs.py:102`） | 支持与多流重叠互斥覆盖，选路在 `ascend_forward_context` 分 Prefill/Decode [!] |
| `releases/v0.26.0rc` (`2ed6cbba`) | `_get_config_value` int | 存在，默认 `0`（`envs.py:96`） | 严格断言 `(0, 1)`，增加 MiniMax M3 与 MegaMoe 回退逻辑 [!] |
| `releases/v0.30.0` (`c09d3e20`) | `AscendConfig.enable_fused_mc2: int = 0` | 已移除 [!] | 接收 `0/1/2` 并将 `2` 内部映射为 `1`；按 `HardwareProfile` 三策略选路；A3 `ep <= 32` [!] |
| `main` (`8d6180e2`) | `AscendConfig.enable_fused_mc2: int = 0` | 已移除 | 新增 `3`（MegaMoe 融合共享专家），限制仅 A5 且非 Latent-MoE [!] |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L605` [C1]、`#L661-L672` [C2]、`#L840-L860` [C3]、`#L1005-L1010` [C4]：`AscendConfig` 定义、`2->1` 归一化、多流互斥及 `hierarchy` 冲突检查。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_forward_context.py#L297-L413` [C5] 与 `hardware_profile.py#L281-L343` [C6]：A2 / A3 / A5 三档 `moe_comm_policy` 路由条件与 LoRA+EP 提前旁路 `ALLTOALL`。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ops/fused_moe/moe_comm_method.py#L580-L611` [C7] 与 `lora/fused_moe.py#L176-L180` [C8]：`dispatch_ffn_combine` 执行体与直调时的 LoRA 防御性断言。
- `vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L704` [C9]、`#L771-L788` [C10]、`#L1101-L1128` [C11]：`main` 新增取值 `3` 及硬件/Latent-MoE 拒绝边界。
- `vllm-ascend@2c59ff10:vllm_ascend/envs.py#L102` [C12] 与 `2ed6cbba:vllm_ascend/ascend_config.py#L179-L208` [C13]：旧环境变量历史及早期的断言互斥规则。
- **待核**：本机 `910B3`（A2 类，不路由 `FUSED_MC2`）未实际运行 A3/A5 上的 `dispatch_ffn_combine` 与 `MegaMoe` 吞吐基准。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_fused_mc2"]` |
| 所属类 | `AscendConfig` |
| 类型 | `int` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:605` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

---- A-family (envs fallback): default = envs module value, before-validator injects ----

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.enable_fused_mc2 in (0, 1):
    _MEGA_MOE_SUPPORTED = False
elif self.enable_fused_mc2 == 2:
    _MEGA_MOE_SUPPORTED = importlib.util.find_spec('cann_ops_transformer') is not None
    self.enable_fused_mc2 = 1
````

````python
if self.enable_fused_mc2 == 1 and self.multistream_overlap_shared_expert:
    self.multistream_overlap_shared_expert = False
    logger.warning_once('enable_fused_mc2 and multistream_overlap_shared_expert cannot be enabled at the same time. Setting multistream_overlap_shared_expert to False.')
````

````python
if self.enable_fused_mc2 == 1 and is_mega_moe_supported() and (not self._is_megamoe_supported_by_config(vc)):
    self.enable_fused_mc2 = 0
    logger.warning_once('MegaMoe is not supported for this model config; additional_config.enable_fused_mc2 will be set to 0.')
````

````python
if self.enable_fused_mc2:
    raise ValueError('fused mc2 op cannot be used with hierarchy communication. Please set additional_config.enable_fused_mc2 to 0.')
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.enable_fused_mc2` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
