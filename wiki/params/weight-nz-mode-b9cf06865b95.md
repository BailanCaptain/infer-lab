---
id: weight-nz-mode-b9cf06865b95
title: weight_nz_mode
type: param
summary: >-
  控制模型线性层与 MoE 权重是否转换为昇腾专用 FRACTAL_NZ 分形排布（0 禁用、1 仅量化权重、2 含浮点权重）；默认 1 会在 Sleep
  Mode 唤醒或 RL 权重更新时触发报错，需显式设为 0。
aliases:
  - FRACTAL_NZ 权重模式
  - NZ 权重排布模式
relations:
  - to: tensor-layout
    kind: builds-on
    note: 控制权重从 ND 转换为 FRACTAL_NZ 分形排布的分级模式
  - to: sleep-mode
    kind: conflicts-with
    note: weight_nz_mode != 0 会导致 Sleep Mode wake_up() 直接抛错，需显式设为 0
  - to: ascend-config-system
    kind: builds-on
    note: AscendConfig 字段及 rl_config 自动清零逻辑所在配置体系
  - to: enable-sleep-mode-extra-cleanup
    kind: builds-on
    note: 开启 Sleep Mode 额外清理与安全唤醒时同样受 weight_nz_mode=0 前置约束
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
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L615
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L379-L384
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L655-L656
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/utils.py#L375-L410
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/worker/worker.py#L279-L325
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/device/hardware_profile.py#L310-L320
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/batch_invariant.py#L106-L116
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/quantization/methods/w4a4/w4a4_mxfp4.py#L207
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L718
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/worker/worker.py#L1149-L1155
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/envs.py#L88-L92
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L264-L268
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1392-L1462
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1735-L1778
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，和旧环境变量是什么关系？

`weight_nz_mode` 控制模型加载后把哪些权重从通用 `ND` 排布转成昇腾 AI Core 矩阵单元偏好的 `FRACTAL_NZ` 分形排布；它取代了旧环境变量 `VLLM_ASCEND_ENABLE_NZ`，默认值为 `1`。

## 为什么存在

昇腾 Cube 计算单元按 `16×16`（INT8 为 `16×32`）分块读取权重。标准行优先 `ND` 格式跨块访存带宽利用率较低，因此在模型权重加载后调用 `npu_format_cast` 将其重排为 `FRACTAL_NZ`（详情见 [张量排布](../concepts/tensor-layout.md)）。

不同精度的收益与代价差异明显，所以分成三档：

- **纯浮点模型（BF16 / FP16）**：在 `910B`/`910C` 等卡上默认不强制转 NZ，避免额外重排耗时与格式约束；只有需要极限矩乘吞吐或使用 `xlite` 浮点优化时才手动开到 `2`。
- **低比特量化模型（W8A8 / W4A8 等）**：Decode 访存与 Cube 指令高度依赖分形排布，默认 `1` 即自动转换量化权重。
- **强化学习（RL）权重更新与 Sleep Mode**：分形排布会让原地权重拷入与地址复用的精度控制复杂化，因此运行时要求整卡权重停留在 `ND`（`0`）。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| `0` | 禁用 NZ | 线性层与 MoE 权重保持 `ND`；Sleep Mode / RL 热更新必需此值 |
| `1`（默认） | 仅量化权重转 NZ | W8A8/W4A8 等量化权重转 `FRACTAL_NZ`，BF16/FP16 仍保持 `ND` |
| `2` | 量化 + 浮点均转 NZ | BF16/FP16 权重也一并重排，部分算子（如 `xlite`）可进一步提速 |
| 310P 特例 | `WeightLayoutPolicy.FORCE_NZ` | Atlas 300I DUO 硬件档强制转换，不受 `weight_nz_mode=0` 关闭 |
| MXFP4 例外 | 保持 `ND` | 打包后的 `MXFP4` 权重即使开启 NZ 仍保留 `ND` |
| 自动清零场景 | `rl_config` 或 `VLLM_BATCH_INVARIANT` | 开启 RL 配置或批不变确定性模式时，运行时自动覆盖为 `0` |
| 已退役 env | `VLLM_ASCEND_ENABLE_NZ` | `v0.30.0` 已从 `envs.py` 移除，不可再依赖该环境变量 |

## 开了的代价与常见坑

1. **BF16 跑 Sleep Mode 默认也会在唤醒时崩溃**：很多人以为默认值 `1` 对 BF16 没转 NZ 就安全，但 `NPUWorker.wake_up()` 和 `start_weight_update()` 直接检查 `weight_nz_mode != 0`。在 `Ascend 910B3` 实测 `Qwen3-8B`（BF16）时，默认 `weight_nz_mode=1` 可以成功进入 `sleep(level=1)` 释放 48.37 GiB 显存，但在 `wake_up()` 时立刻抛出 `ValueError: FRACTAL_NZ mode is enabled...`；必须显式加 `--additional-config '{"weight_nz_mode": 0}'`（或开启 `rl_config.enabled=true`），唤醒才成功并给出完全一致的文本。
2. **首次格式转换的冷启动延迟**：进程首次调用 `torch_npu.npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)` 会触发 CANN/ACL 流与转换算子懒初始化。`910B3` 微基准测得第一次转换耗时 `7.1618 s`，第二次骤降至 `0.0007 s`（需与设备初始化和算子预热合并看待）。
3. **权重清零与分层重载约束**：在 `main` 分支上，`reset_weights()` 当 `weight_nz_mode != 0` 时会发出警告，提示此时无法用 weight transfer 更新，只能走 checkpoint `reload_weights`；部分权重预取/offload 路径也要求关闭 NZ。

## 何时改用其他组合

- 需要启用 `--enable-sleep-mode`、RL 在线改写权重或 `VLLM_BATCH_INVARIANT`：必须传 `{"weight_nz_mode": 0}`（或使用 `rl_config: {"enabled": true}` 自动覆盖）。
- 使用 `enable_fused_mc2=1`（`dispatch_ffn_combine`）或 `enable_fused_mc2=2`（`CANN MegaMoe`，校验期将外部 `2` 归一为内部 `1`）及量化推理服务：保留默认值 `1`（路由专家融合与量化路径依赖 NZ 排布）。
- 在 BF16/FP16 大模型上调优 `xlite` 或特定密集/Kimi K3 路径且不走 Sleep Mode：可评估设为 `2` 后对比端到端吞吐。

想把 `weight_nz_mode` 和 Sleep Mode、RL 权重更新、`enable_fused_mc2` 放在同一份配方里检查是否互斥或被静默改写，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=weight-nz-mode-b9cf06865b95&q=weight_nz_mode&sel=%7B%22cfg_weight_nz_mode%22%3A0%7D)。链接预装 `weight_nz_mode: 0`，在卡片上切到 `1` 或 `2` 即可对比。

## 对照源码

| 版本 | 字段与默认值 | 环境变量 `VLLM_ASCEND_ENABLE_NZ` | 关键运行时差异 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `_get_config_value` 读取 | 存在，默认 `1`（`envs.py:92`） | 支持 `0/1/2`，`worker.py:242` 与 `_check_nz_disabled` 检查非零报错 |
| `releases/v0.26.0rc` (`2ed6cbba`) | `_get_config_value` 读取 | 存在，默认 `1`（`envs.py:88`） | 新增与 `batch_invariant` 联动强制设 `0` |
| `releases/v0.30.0` (`c09d3e20`) | `AscendConfig.weight_nz_mode: int = 1` | 已移除，仅保留配置字段 [!] | 强校验 `(0, 1, 2)`；`rl_config` 自动改写为 `0`；310P 由 `FORCE_NZ` 接管 [!] |
| `main` (`8d6180e2`) | `AscendConfig.weight_nz_mode: int = 1` | 已移除 | `worker.py:1149` `reset_weights()` 增加 NZ 非零警告 [!] |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L615` [C1]、`#L379-L384` [C2]、`#L655-L656` [C3]：字段定义、`rl_config` 覆盖与 `(0, 1, 2)` 枚举校验。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/utils.py#L375-L410` [C4] 与 `hardware_profile.py#L310-L320` [C6]、`batch_invariant.py#L106-L116` [C7]、`w4a4_mxfp4.py#L207` [C8]：`maybe_trans_nz` 分流逻辑、`310P FORCE_NZ`、批不变强制清零与 `MXFP4` 例外。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/worker/worker.py#L279-L325` [C5] 与 `8d6180e2:ascend_config.py#L718` [C9]、`worker.py#L1149-L1155` [C10]：`wake_up()`、`_check_nz_disabled()` 及 `main` 的 `reset_weights()` 拦截。
- `vllm-ascend@2c59ff10:vllm_ascend/envs.py#L88-L92` [C11] 与 `2ed6cbba:vllm_ascend/ascend_config.py#L264-L268` [C12]：旧环境变量 `VLLM_ASCEND_ENABLE_NZ` 与 `v0.26.0rc` 配置读取来源。
- `raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md`（§06 [M13] & §07 [M14]）：`Ascend 910B3` 上 `Qwen3-8B`（`v0.30.0`）`weight_nz_mode=0` Sleep Mode 实测及首帧 `npu_format_cast` `7.1618 s` 耗时 [M13]，以及默认 `weight_nz_mode=1` 唤醒失败 traceback [M14]。
- **待核**：Atlas A3 / A5 上将 BF16 模型由 `weight_nz_mode=1` 改为 `2` 后的实际 TTFT/TPOT 收益尚未在本机实测。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["weight_nz_mode"]` |
| 所属类 | `AscendConfig` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:615` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.weight_nz_mode not in (0, 1, 2):
    raise ValueError(f'weight_nz_mode must be one of 0, 1, or 2; got {self.weight_nz_mode}')
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.weight_nz_mode` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
