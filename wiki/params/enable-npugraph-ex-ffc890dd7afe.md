---
id: enable-npugraph-ex-ffc890dd7afe
title: enable_npugraph_ex
type: param
summary: >-
  控制图编译后端是否启用 NPUGraphEx（npugraph_ex）对 FX 计算图执行编译优化并与 ACLGraph 协同；默认 True，但在
  PIECEWISE / FULL_AND_PIECEWISE / NONE 图模式及不支持硬件上会被静默覆盖为 False。
aliases:
  - AscendCompilationConfig.enable_npugraph_ex
relations:
  - to: npugraph-ex
    kind: builds-on
    note: 开关昇腾 FX 图优化后端 npugraph_ex 的主配置项
  - to: acl-graph
    kind: builds-on
    note: 在 FULL / FULL_DECODE_ONLY 图捕获前完成算子图级优化；PIECEWISE 下自动停用
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
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L122
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L149-L169
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/platform.py#L1306-L1352
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L128-L253
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L266-L337
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/device/hardware_profile.py#L246-L273
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:docs/source/user_guide/feature_guide/graph_mode.md#L124-L178
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L129
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/platform.py#L1518-L1558
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L607-L660
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L599-L659
rawSources:
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
---
## 它控制什么，和 ACLGraph 是什么关系？

`enable_npugraph_ex` 控制是否在编译期启用增强版昇腾 FX 图优化后端 `npugraph_ex`（并与下游 `ACLGraph` 运行时回放配合）；它默认 `True`，且是 `enable_static_kernel` 和 `enable_super_kernel` 的必需前置。

## 为什么存在

单靠 [ACL 图捕获与回放](../concepts/acl-graph.md) 只能把主机侧算子下发流录成整张静态任务图，却不能把图里相邻的碎小算子合起来重写。反过来，完全关闭图编译只跑 Eager，又会让 Decode 阶段被主机下发延迟拖垮。

`vllm-ascend` 因此在 `Dynamo FX` 图和 `ACLGraph` 捕获之间插了一层编译桥（机制详见 [npugraph_ex 编译器](../concepts/npugraph-ex.md)）：

- **`enable_npugraph_ex=True`**：`AscendCompiler.compile()` 调用 `npugraph_ex_compile()`（未装 `npugraph_ex` 包时回退到 `torchair` `reduce-overhead` 后端），统一配置 `force_eager=True` 与 `inplace_pass=False`，并为静态核（Static Kernel）与超核（Super Kernel）打开通道。
- **`enable_npugraph_ex=False`**：改为调用 `fusion_pass_compile()`，仅靠本地 `GraphFusionPassManager`（如 `fuse_norm_quant`、`fuse_qknorm_rope`）完成 Python FX 图替换后退出，不再进入 `npugraph_ex` / `torchair` 编译流。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 默认值 | `True` | 只要图模式是全图（`FULL` / `FULL_DECODE_ONLY`）且硬件支持，默认开启 |
| 生效前提 | `FULL` 或 `FULL_DECODE_ONLY` | 开启全图捕获且清空 `splitting_ops`，防止图被切分多次编译 |
| 自动清零的图模式 | `PIECEWISE`、`FULL_AND_PIECEWISE`、`NONE` | `platform.py` 会在初始化前把此项连同静态核、超核一并强设为 `False` |
| 硬件限制 | `HardwareCapability.NPUGRAPH_EX` | Atlas 300I DUO (310P) 不支持，校验器打印警告后自动关闭 |
| 下游开关依赖 | `enable_static_kernel` / `enable_super_kernel` | 设 `enable_static_kernel=True` 时，必须保证 `enable_npugraph_ex` 也为 `True` |
| 关闭时的回退路径 | `fusion_pass_compile()` | 只运行本地 FX Fusion Pass，不再执行 `npugraph_ex` 或 `torchair` 后端编译 |
| Triton 图缓存例外 | `triton_kernel_wrapper` | 含进程内 Triton kernel 索引的子图自动跳过落盘缓存，防多进程加载报错 |
| 缓存哈希因子 | `torch_npu` 版本与三个图编译开关 | 变更此开关会使编译缓存键重新计算，触发首次冷启动重编 |

## 开了的代价与常见坑

1. **图模式不对导致的静默失效**：这是最高频的配置误区——用户在 `additional_config` 写明了 `"enable_npugraph_ex": true`，但服务以 `PIECEWISE`、`FULL_AND_PIECEWISE` 或 `--enforce-eager`（`NONE`）启动，结果 `platform.py` 在配置检查阶段悄无声息地把 `enable_npugraph_ex` 覆盖回 `False`。如果要跑 `npugraph_ex`（尤其是再叠静态核），必须确保 `cudagraph_mode` 为 `FULL_DECODE_ONLY` 或 `FULL`。
2. **`enable_static_kernel=True` 搭配 `enable_npugraph_ex=False` 直接启动崩溃**：`AscendCompilationConfig` 内置硬断言 `assert self.enable_npugraph_ex`。想在全图模式下只关 `npugraph_ex` 而保留 `enable_static_kernel=true` 是非法的，启动期就会失败。
3. **排障复杂度与首请求编译耗时**：开启后会引入 `npugraph_ex` / `torchair` 编译时间与 `inplace_pass=False` 等特定图选项约束；遇到未见过的算子报错或图捕获失败时，常先设 `{"ascend_compilation_config": {"enable_npugraph_ex": false}}` 验证是否为编译层问题。

## 何时改用其他组合

- **标准 `910B`/`A3`/`A5` 全图 Decode 或 `FULL` 模式**：保持默认 `enable_npugraph_ex: true`。
- **使用 `PIECEWISE` / `FULL_AND_PIECEWISE`、310P 设备或隔离编译器报错**：无需强开或显式设为 `false`，保留本地 `fusion_pass_compile` 即可。

想看 `enable_npugraph_ex` 在不同图模式与设备下何时被静默置为 `false`，以及与 `enable_static_kernel` 的联动，可以[在调优旋钮雷达中试配本参数与互斥组合 →](#/tools?tab=knobs&fromPage=enable-npugraph-ex-ffc890dd7afe&q=ascend_compilation_config.enable_npugraph_ex&sel=%7B%22cfg_enable_npugraph_ex%22%3Atrue%7D)。链接预装 `enable_npugraph_ex: true`。

## 对照源码

| 版本 | 类定义位置 | 硬件判别方式 | 平台覆盖与编译分支演变 |
| --- | --- | --- | --- |
| `releases/v0.23.0` (`2c59ff10`) | `AscendCompilationConfig.__init__`（`:609`） | `is_310p()` | `platform.py:595-643` 在非全图模式强制置 `False`；支持 `npugraph_ex` 回退 `torchair` [!] |
| `releases/v0.26.0rc` (`2ed6cbba`) | `AscendCompilationConfig.__init__`（`:601`） | `is_310p()` | `platform.py:551-604` 沿用覆盖规则，同步联动 `enable_super_kernel` |
| `releases/v0.30.0` (`c09d3e20`) | `@config` 字段（`ascend_config.py:122`） | `HardwareCapability.NPUGRAPH_EX` | 重构为硬件能力合约判别；新增 Triton kernel 图跳过写缓存保护 [!] |
| `main` (`8d6180e2`) | `@config` 字段（`ascend_config.py:129`） | `HardwareCapability.NPUGRAPH_EX` | 主逻辑一致；`platform.py:1518-1558` 分段拆分算子列表新增 `glm5next_kda_forward_with_output` |

- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L122` [C1]、`#L149-L169` [C2]、`hardware_profile.py#L246-L273` [C6] 与 `8d6180e2:ascend_config.py#L129` [C8]：字段声明、硬件能力裁剪及 `enable_static_kernel` 依赖断言。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/platform.py#L1306-L1352` [C3] 与 `8d6180e2:platform.py#L1518-L1558` [C9]：各 `CUDAGraphMode` 分支下强制写 `False` 或清空 `splitting_ops`。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/compilation/compiler_interface.py#L128-L253` [C4]、`#L266-L337` [C5]：`npugraph_ex_compile()` vs `fusion_pass_compile()` 分流、Triton 缓存跳过及哈希因子。
- `vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:docs/source/user_guide/feature_guide/graph_mode.md#L124-L178` [S7]：官方默认行为与全图模式用法说明。
- `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L660` [C10] 与 `2ed6cbba:ascend_config.py#L599-L659` [C11]：早期 `__init__` 签名与 `is_310p()` 判别。
- **待核**：本机 `910B3` 未单独隔离测量开启与关闭 `enable_npugraph_ex`（不叠静态核时）的端到端 TPOT 差值。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["ascend_compilation_config"]["enable_npugraph_ex"]` |
| 所属类 | `AscendCompilationConfig` |
| 类型 | `bool` |
| 默认表达式 | `True` |
| 定义 | `vllm_ascend/ascend_config.py:122` [C1] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX):
    if self.enable_npugraph_ex:
        logger.warning('npugraph_ex is not supported by the current hardware profile. Disabling it.')
    if self.enable_static_kernel:
        logger.warning('static kernel requires npugraph_ex, which is not supported by the current hardware profile. Disabling it.')
    if self.enable_super_kernel:
        logger.warning('super kernel requires static kernel, which is not supported by the current hardware profile. Disabling it.')
    self.enable_npugraph_ex = False
    self.enable_static_kernel = False
    self.enable_super_kernel = False
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendCompilationConfig.enable_npugraph_ex` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 有 | `2c59ff10` |
| releases/v0.26.0rc | 有 | `2ed6cbba` |
| releases/v0.30.0 | 有 | `c09d3e20` |
