---
id: fuse-norm-quant-65db0ee6a4f3
title: fuse_norm_quant
type: param
summary: >-
  控制 FX 图融合 Pass 是否将 AddRMSNorm 与随后的激活量化（动态 INT8 / 静态 INT8 / MXFP 量化）合并为单颗算子（默认
  True）；消除了独立动态量化算子的额外 AIV 启动与全局内存往返开销，main 分支进一步精确锁定 INT8 与无 bias 分支。
aliases:
  - AddRMSNormQuantFusionPass
  - AddRmsNorm 与量化融合
relations:
  - to: mlp-residual-norm
    kind: builds-on
    note: 融合残差加 RMSNorm 与后续量化算子，消除独立 DynamicQuant 开销
  - to: enable-npugraph-ex-ffc890dd7afe
    kind: builds-on
    note: 挂载于 GraphFusionPassManager，无论是否开启 npugraph_ex 均在 FX 编译期触发
  - to: quantization-methods
    kind: builds-on
    note: 覆盖 W8A8/W4A8/MXFP8 激活量化融合并主动避开 W4A4
  - to: fuse-allreduce-rms
    kind: builds-on
    note: 分别在残差归一化前侧（AllReduce+RMSNorm）与后侧（Norm+Quant）执行图融合
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
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L125
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L64
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L30-L88
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L170-L336
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L339-L405
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/device/hardware_profile.py#L256-L331
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L132
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L153-L255
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L425-L466
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L611-L652
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L604-L652
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L260-L292
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，为什么对动态量化很关键？

`fuse_norm_quant` 控制昇腾 FX 图融合管理器（`GraphFusionPassManager`）是否把 `AddRMSNorm` 和紧随其后的激活量化合并为单颗算子；它默认 `True`，直接决定 W8A8/W4A8 等动态量化链路能否兑现完整加速比。

## 为什么存在

在 W8A8/W4A8 动态激活量化推理中，每层的残差归一化后，都要把 `BF16`/`FP16` 激活值量化成 `INT8`（或 `MXFP8`）再送进矩阵乘。如果归一化与量化拆成两个独立算子执行，Vector 核（AIV）不仅要多一次算子发射延迟，还要先把归一化的浮点结果写回全局内存（GM），再立即全量读出来做极值统计与缩放。

本仓库在 `Ascend 910B3` 上的实测微基准清楚暴露了这个瓶颈：独立动态激活量化（`npu_dynamic_quant`）单次耗时高达 `31.79 µs`，把原本纯量化矩阵乘相对 BF16 的 `1.312×` 算子加速比直接拖低到 `1.128×`（结合归一化流水进一步跌至 `1.095×`）。开启 `fuse_norm_quant` 后，编译器将两步替换成单颗 `npu_add_rms_norm_dynamic_quant` / `npu_add_rms_norm_quant` / `npu_add_rms_norm_dynamic_mx_quant`（见 [残差、RMSNorm 与 MLP 融合](../concepts/mlp-residual-norm.md)），让规约与量化在片上寄存器/UB 内一次完成。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 默认值 | `True` | 无需传参即挂载，前提是开启 FX 图编译（非 Eager / `NONE`） |
| 与 `npugraph_ex` 关系 | 独立运行于 `GraphFusionPassManager` | 即使 `enable_npugraph_ex=False`，只要走 `fusion_pass_compile` 仍会应用此 Pass |
| 支持的数据类型 | `bfloat16` / `float16` | 模型激活非 BF16/FP16 时内部自动跳过匹配 |
| 支持的融合家族 | 静态 `W8A8`、动态 `INT8`、动态 `MXFP`（A5） | 动态 `INT8` 不依赖 custom op 即可匹配；静态量化与带 bias 需 `enable_custom_op()` |
| 匹配 `eps` 范围 | `1e-5` 和 `1e-6` | 仅针对这两个主流 epsilon 注册模式；非标准 `eps` 不会命中融合 |
| 自动跳过的方案 | `W4A4_DYNAMIC` / `W4A4_FLATQUANT_DYNAMIC` | `_model_uses_w4a4_quant()` 检测命中时直接跳过注册 |
| 硬件边界 | `HardwareCapability.GRAPH_NORM_QUANT_FUSION` | Atlas 300I DUO (310P) 不具备该能力，Pass 不会挂载 |
| `main` 分支新修复 | 锁定 `dst_type=torch.int8` + 无 bias 分支 | 防止误匹配 `INT4`/`FP8`，并新增覆盖无 bias RMSNorm 架构（如 Qwen3-Next 系列）的融合模式 |

## 开了的代价与常见坑

1. **`v0.30.0` 下无 `dst_type` 过滤的风险与 `W4A4` 排除**：在 `v0.30.0`（`c09d3e20`）中，`AddRMSNormDynamicQuantPattern` 匹配时未在模式中写死 `dst_type=torch.int8`，主要依赖 `_model_uses_w4a4_quant()` 提前把 `W4A4_DYNAMIC`/`W4A4_FLATQUANT_DYNAMIC` 模型拦在门外。到了 `main`（`8d6180e2`），才在模式匹配签名中显式钉住 `dst_type=torch.int8`，避免 Inductor 忽略未声明关键字而把非 INT8 量化替换错。
2. **部分新模型在未适配分支上曾有兼容回归**：例如在 `v0.30.0` 文档教程中，`MiniMax-M3` 某些配置主动设置 `"fuse_norm_quant": false`；而 Qwen3.5 / Qwen3-Next 因为无偏置 RMSNorm 走 `_C_ascend.npu_add_rms_norm_bias(..., beta=None)` 分支，直到 `main` 新增 `AddRMSNormDynamicQuantPatternNoBias` 才真正吃上这步融合。
3. **非主流 `eps` 或非编译模式（`--enforce-eager`）不生效**：因为属于 FX 编译器模式匹配 Pass，关闭图编译（`NONE`）或模型层归一化采用 `1e-5`/`1e-6` 之外的 `eps` 时都会自然退回未融合的两颗算子。

## 何时改用其他组合

- **W8A8 / W4A8 / MXFP8 推理（默认推荐）**：保留 `fuse_norm_quant: true`，不要关闭，否则独立动态激活量化额外开销会显著侵蚀量化收益。
- **调试精度差异、`W4A4`/特殊自定义量化冲突或特定模型说明禁用**：设 `"ascend_compilation_config": {"fuse_norm_quant": false}` 排查是否与融合模式匹配有关。

想把 `fuse_norm_quant` 和 `--quantization`、图编译相关开关放在一起检查生效条件，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=fuse-norm-quant-65db0ee6a4f3&q=ascend_compilation_config.fuse_norm_quant&sel=%7B%22cfg_fuse_norm_quant%22%3Atrue%7D)。链接预装 `fuse_norm_quant: true`。

## 对照源码

| 版本 | 默认值与 Pass 载体 | 匹配模式范围 | 关键缺陷修复与演变 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `__init__`（`:611`）, `True` | 含独立 SP/Non-SP Pattern（`:33-695`） | `is_310p()` 判硬件；依赖 raw dict 读取而非校验后实例 [!] |
| `releases/v0.26.0rc` (`2ed6cbba`) | `__init__`（`:604`）, `True` | 同上（`:33-695`） | 保持 SP/Non-SP 双套规则 |
| `releases/v0.30.0` (`c09d3e20`) | `@config`（`ascend_config.py:125`） | 精简为 6 个核心模式（`norm_quant_fusion_pass.py:30-405`） | `GraphFusionPassManager` 改用类型校验后的配置及 `GRAPH_NORM_QUANT_FUSION` 判硬件（模式未锁 `dst_type`）[!] |
| `main` (`8d6180e2`) | `@config`（`ascend_config.py:132`） | 新增 `AddRMSNormDynamicQuantPatternNoBias`（`:201-255`） | 显式将动态量化模式锁定至 `dst_type=torch.int8`，补齐无 bias RMSNorm 融合 [!] |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L125` [C1] 与 `8d6180e2:ascend_config.py#L132` [C7]：字段声明与默认 `True`。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/graph_fusion_pass_manager.py#L51-L64` [C2] 与 `hardware_profile.py#L256-L331` [C6]：Pass 管理器条件挂载与 310P 剔除。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L30-L88` [C3]、`#L170-L336` [C4]、`#L339-L405` [C5]：各量化分支替换模式、`W4A4` 排除与 `eps=[1e-5, 1e-6]` 范围。
- `vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/compilation/passes/norm_quant_fusion_pass.py#L153-L255` [C8]、`#L425-L466` [C9]：`main` 新增 `dst_type=torch.int8` 锁定与 `AddRMSNormDynamicQuantPatternNoBias`。
- `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L611-L652` [C10] 与 `2ed6cbba:ascend_config.py#L604-L652` [C11]：早期字段定义历史。
- `raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md`（§01 `01_aicore_ops_bf16_and_w8a8`）[M12]：`Ascend 910B3` 微基准测得独立动态量化算子耗时 `31.79 µs`，直接把 W8A8 GEMM 净加速比从 `1.312×` 拉低至 `1.128×` / `1.095×`。
- **待核**：本机暂未采集开关 `fuse_norm_quant` 对 `Qwen3-8B` / `Qwen3-30B-A3B` W8A8 整网 TPOT 的隔离对比实测。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["fuse_norm_quant"]` |
| 所属类 | `AscendCompilationConfig` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:125` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendCompilationConfig.fuse_norm_quant` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 有 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
