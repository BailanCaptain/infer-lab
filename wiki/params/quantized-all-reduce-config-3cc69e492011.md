---
id: quantized-all-reduce-config-3cc69e492011
title: quantized_all_reduce_config
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的低精度规约配置（QuantizedAllReduceConfig），在 Atlas A2、TP <= 8 下对满足组大小 2–8 与形状元素门槛的
  BF16 All-Reduce 同步逐末维通道缩放并压缩为对称 int8 求和，折入 enable 与 min_numel 两个子键。
aliases:
  - QuantizedAllReduceConfig
  - QuantizedAllReduce
  - additional_config.quantized_all_reduce_config
  - quantized_all_reduce_config.enable
  - quantized_all_reduce_config.min_numel
  - 量化 AllReduce 配置
relations:
  - to: collective-communication
    kind: builds-on
    note: TP 组内 All-Reduce 的通信原语与带宽瓶颈在那一页讲，本页聚焦对称 int8 量化压缩规约配置
  - to: tensor-parallel
    kind: builds-on
    note: 配置要求 TP <= 8；NPUCommunicator 为所有通信组构造包装器，仅 2–8 卡组进入张量判定，默认 32 MiB 下主要由大批量 Prefill 触发
  - to: sequence-parallel
    kind: builds-on
    note: >-
      同时开启 FlashComm1 与 MoE 序列并行时会把 TP All-Reduce 换成 All-Gather / Reduce-Scatter，本开关会告警并自动关闭
  - to: ascend-config-system
    kind: builds-on
    note: 对应 QuantizedAllReduceConfig 子配置类，包含解析期 TP 上限校验与运行期设备类型校验
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 子键说明与生效门槛
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L727
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L413-L454'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L873-L885'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2047'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/device_communicators/npu_communicator.py#L74-L90
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/device_communicators/quantized_all_reduce.py#L30-L132
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L580-L625'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/device_communicators/npu_communicator.py#L69-L90
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/device_communicators/quantized_all_reduce.py#L85-L134
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

`quantized_all_reduce_config` 的做法很直接：**先让通信组内各卡用同一把逐通道缩放尺，再把 BF16 激活压成更窄的对称 `int8` 整数传输出去求和，最后反量化回 BF16。** 在多卡[张量并行（TP）](../concepts/tensor-parallel.md)中，每层注意力 `o_proj` 与前馈层 `down_proj` 等行并行线性层都要做跨卡 `All-Reduce`。当单次规约张量达到几十 MiB 时，把主载荷字节数减半可缓解 Atlas A2 卡间 HCCS 带宽瓶颈。

它是 `main` 分支新增的 `--additional-config` 顶层子配置（对应 `QuantizedAllReduceConfig`，默认关闭）。默认最小元素门槛 `min_numel = 16,777,216` 在 BF16（每元素 `2 B`）下正好对应 **`32 MiB`**（如末维 `4096` 时需 `4096` 行）。开启后，达标张量的单次规约分三步执行：① 展平为 `[*, C]` 求末维逐通道最大绝对值，做一次仅 `C` 个 FP32 元素的 `MAX` `All-Reduce` 对齐共用缩放尺；② 按共用缩放尺量化成 `int8` 执行跨卡整数求和；③ 乘回缩放尺反量化为 BF16：

```bash
vllm serve /models/Qwen3-32B \
  --tensor-parallel-size 8 \
  --additional-config '{"quantized_all_reduce_config": {"enable": true, "min_numel": 16777216}}'
```

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置入口 | `--additional-config '{"quantized_all_reduce_config": {...}}'` | 默认 `enable=false`，不传时保持标准 BF16 `dist.all_reduce` |
| 支持硬件 | 仅限 Atlas A2（`AscendDeviceType.A2`） | 在 Atlas A3、310P 或 A5 上开启会在构造通信器时直接抛 `RuntimeError` |
| 通信组范围与 TP 上限 | 解析期要求 `tp_size <= 8`；所有 `NPUCommunicator` 组均构造包装器，仅 `2 <= world_size <= 8` 组启用 | 超过 `8` 卡的非 TP 大组（如跨机 EP/MC2）不会启动失败，首次调用打 `warning_once` 后保持 BF16 |
| 运行时张量契约 | `dtype == bfloat16`、`ndim >= 2`、`shape[-1] >= 64` 且 `numel() >= min_numel`（默认 `16777216` 即 `32 MiB`） | 代码只看通信组与输入张量，不看阶段；调低 `min_numel` 后达标的 Decode 张量也会进入 |
| FlashComm1 + MoE SP 联动 | `enable_flashcomm1` 与 `use_sequence_parallel_moe` 同开时告警并置 `enable=False` | 序列并行把 TP `All-Reduce` 换成了 `All-Gather` / `Reduce-Scatter`，启动期打一次性告警并关闭本功能 |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 子键说明与生效门槛

教学固定快照 `main`（`8d6180e2`）中，`QuantizedAllReduceConfig` 包含两个子键，均折入本页统一管理：

| 子键路径 | 类型 | 默认值 | 校验与运行时含义 |
| --- | --- | --- | --- |
| `quantized_all_reduce_config.enable` | `bool` | `False` | 是否在各 `NPUCommunicator` 实例上挂载 `QuantizedAllReduce` 包装器 |
| `quantized_all_reduce_config.min_numel` | `int` | `16777216` | 启用量化规约的最小元素个数（须 `>= 1`，`< 1` 直接抛 `ValueError`）；默认 $16{,}777{,}216 \times 2\text{ B} = 32\text{ MiB}$，例如隐藏维 `4096` 时需单步至少 `4096` 行 |

需要注意**配置上限**与**通信组挂载范围**的区别：解析期只检查 `tp_size <= 8`；而在分布式初始化时，DP、EP、MC2 等所有使用 `NPUCommunicator` 的通信组都会构造 `QuantizedAllReduce`。单次 `all_reduce` 调用按以下顺序分流：
1. `world_size == 1` 直接走父类原路；`world_size > 8`（`supported=False`，如 16 卡 EP/MC2 组）打印一次 `quantized all-reduce disabled for this %d-rank group` 告警并执行原生 BF16 `dist.all_reduce`；
2. 对 `2 <= world_size <= 8` 的通信组，同时满足 `input_.dtype == torch.bfloat16`、`input_.ndim >= 2`、`input_.shape[-1] >= 64` 且 `input_.numel() >= min_numel` 时走对称 `int8` 量化规约，任一条不满足则回退原生 BF16（判定不区分 Prefill 与 Decode）。

## 代价与互斥边界

- **整数累加范围与舍入代价（`TP <= 8`）**：为保证 `world_size` 张卡的 `int8` 求和不溢出 `[-127, 127]`，每卡量化上限按 $\lfloor 127 / \text{world\_size} \rfloor$ 收紧。`TP=8` 时每卡仅使用 `[-15, 15]` 共 31 个整数台阶，会引入一定数值舍入误差。若配置 `tp_size > 8`，因有效位宽过低，`_validate_preconditions` 直接抛 `ValueError` 拒绝启动。
- **硬件硬拦截**：`8d6180e2` 仅在 Atlas A2 的 HCCS 互联延迟/带宽比上完成了标定；非 A2 设备实例化 `QuantizedAllReduce` 时会立即抛 `RuntimeError`（HCCL 链路调优与实测取证见[昇腾运行期与调优](../concepts/ascend-runtime-and-tuning.md)）。
- **与 FlashComm1 + MoE 序列并行联动关闭**：当有效启用 FlashComm1 且 `parallel_config.use_sequence_parallel_moe` 为真（`sp_active`）时，TP `All-Reduce` 已被替换为 `All-Gather` / `Reduce-Scatter`。`derive_and_validate` 会打一次性告警并将 `quantized_all_reduce_config.enable` 重置为 `False`。
- **应用建议（为何默认瞄准大批量 Prefill）**：默认 `32 MiB` 门槛下，通常只有大批量 Prefill 张量能跨过阈值，小批量 Decode 自然留在原生 BF16。若人为调低 `min_numel`，满足末维 `>= 64` 等契约的 Decode 张量也会进入量化通路，但两端量化、反量化与 `MAX` 同步的固定开销往往大于微秒级传输节省，反而可能拉高 TPOT。

## 对照源码

下表对照四个固定教学快照中 `quantized_all_reduce_config` 的定义、校验时机与通信器接入点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 字段定义与子键 | 无 [C7] | 无 [C8] | 无（严格模式拒收未知键）[C9][!] | `QuantizedAllReduceConfig`（`enable: bool = False`, `min_numel: int = 16777216`）[C1][C2] |
| 启动校验与 SP 互斥 | — | — | — | `min_numel >= 1`、`tp_size <= 8` 抛 `ValueError`；遇 FlashComm1 + MoE SP 告警并置 `enable=False` [C3][!] |
| 通信器范围与运行门槛 | — | — | — | 所有 `NPUCommunicator` 组均构造包装器，`>8` 卡组一次性告警回退 BF16，`2–8` 卡组按 BF16/`ndim>=2`/`shape[-1]>=64`/`min_numel` 判定 [C5][C6][C10][C11] |

- **阈值与量化阶数推导**：默认 `16,777,216` 个 BF16 元素折合 `32 MiB`（隐藏维 `4096` 时对应 `4096` tokens），以及 `TP=8` 下 `127 // 8 = 15` 量化半径均由 `QuantizedAllReduceConfig`（来源 2、4）与 `quantized_all_reduce.py` 常量直接算出 [D]。
- **版本边界说明**：固定教学快照 `8d6180e2` 中该子配置仅含 `enable` 与 `min_numel` 两个子键（固定对称 `int8` 路径），不含后续巡检提交才出现的额外精度选择键。
- **待核**：尚缺 Atlas A2 8 卡上不同 `min_numel` 阈值对长上下文 TTFT 与 PPL/评测精度的实机对照曲线。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["quantized_all_reduce_config"]` |
| 所属类 | `AscendConfig` |
| 类型 | `QuantizedAllReduceConfig` |
| 默认表达式 | `dataclasses.field(default_factory=QuantizedAllReduceConfig)` |
| 定义 | `vllm_ascend/ascend_config.py:727` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if sp_active and self.quantized_all_reduce_config.enable:
    logger.warning_once('additional_config.quantized_all_reduce_config is enabled together with FlashComm1/SP. Sequence parallelism replaces TP all-reduce with all-gather/reduce-scatter, so the int8 quantized all-reduce would never be used. Disabling quantized_all_reduce_config.')
    self.quantized_all_reduce_config = dataclasses.replace(self.quantized_all_reduce_config, enable=False)
````

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.quantized_all_reduce_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
