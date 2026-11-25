---
id: quantized-all-reduce-config-3cc69e492011
title: quantized_all_reduce_config
type: param
origin: seed
evidence: C
summary: >-
  main 分支新增的张量并行低精度规约配置（QuantizedAllReduceConfig），在 Atlas A2、TP <= 8 场景下按最后一维通道做全局
  amax 对齐并将大张量 BF16 All-Reduce 压缩为对称 int8 载荷传输以削减 HCCS 跨芯片流量，折入 enable 与 min_numel
  两个子键。
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
    note: 仅挂载在 TP 通信组（world_size <= 8）的 all_reduce 上，大批量 Prefill 跨卡规约时触发
  - to: sequence-parallel
    kind: builds-on
    note: >-
      同时开启 FlashComm1 与序列并行时会把 All-Reduce 拆成 ReduceScatter +
      AllGather，本开关会自动告警关闭
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
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

在多卡[张量并行（TP）](../concepts/tensor-parallel.md)的大批量 Prefill 阶段，每一层线性层输出都要做一次跨卡 BF16 `All-Reduce`。当单次规约张量达到几十 MiB 时，Atlas A2 卡间 HCCS 链路带宽会成为明显瓶颈。

`quantized_all_reduce_config` 是 `main` 分支新增的 `--additional-config` 顶层子配置（对应 `QuantizedAllReduceConfig`，默认关闭）。开启后，TP 通信器会在满足门槛的 BF16 张量上改走对称逐最后一维通道（per-last-dim-channel）`int8` 量化规约：先将张量展平为 `[*, C]` 求长度为 `C` 的逐通道全局绝对值上界（一次极小开销的 FP32 `MAX` `All-Reduce` 同步缩放因子），再把主载荷量化成 `int8` 做整数求和并异地反量化回 BF16，使主规约载荷字节数减半：

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
| TP 并行度上限 | `tp_size <= 8`（`_MAX_VALID_WORLD_SIZE = 8`） | `int8` 累加防溢出预算为 `max_q = 127 // world_size`，`TP > 8` 在解析期即抛 `ValueError` |
| 默认触发体积门槛 | `min_numel = 16777216`（BF16 下即 `32 MiB`） | 仅大批量 Prefill 大张量走量化规约，小批量 Decode 自动回退原生 BF16 规约 |
| 与 FlashComm1 + SP 关系 | 互斥并静默关闭本功能 | 开启 `enable_flashcomm1` 与序列并行后无 `All-Reduce` 可走，启动时打印警告并置 `enable=False` |
| 版本可用性 | 仅 `main`（`8d6180e2`）支持 | `v0.30.0` 标准 `vllm-ascend`（未装 `vllm_omni`）拒收未知键报错；`v0.23.0` / `v0.26.0rc` 用 `.get()` 静默忽略 |

## 子键说明与生效门槛

教学固定快照 `main`（`8d6180e2`）中，`QuantizedAllReduceConfig` 包含两个子键，均折入本页统一管理：

| 子键路径 | 类型 | 默认值 | 校验与运行时含义 |
| --- | --- | --- | --- |
| `quantized_all_reduce_config.enable` | `bool` | `False` | 是否在 `NPUCommunicator` 上实例化 `QuantizedAllReduce` 规约器 |
| `quantized_all_reduce_config.min_numel` | `int` | `16777216` | 启用量化规约的最小元素个数（须 `>= 1`，`< 1` 直接抛 `ValueError`）；默认 $16{,}777{,}216 \times 2\text{ B} = 32\text{ MiB}$，例如隐藏维 `4096` 时需单步总 token 数至少 `4096` |

即便 `enable: true` 通过了启动校验，单次 `all_reduce` 调用也只有在同时满足以下运行时条件时才会走量化通路，否则无感回退原生 BF16 `dist.all_reduce`：
1. 通信组大小满足 `2 <= world_size <= 8`（超大 EP / 跨机通信组自动跳过）；
2. 输入张量 `dtype == torch.bfloat16`，维度 `ndim >= 2`，且最后一维长度 `shape[-1] >= 64`；
3. 输入总元素数 `input_.numel() >= min_numel`。

## 代价与互斥边界

- **整数累加动态范围限制（`TP <= 8`）**：为了保证 `world_size` 张卡的 `int8` 求和绝对不溢出 `[-127, 127]`，每张卡的量化上限被收紧为 $\lfloor 127 / \text{world\_size} \rfloor$（`TP=8` 时每卡仅用 `[-15, 15]` 共 31 个量化台阶）。这会带来一定数值舍入误差，且当 `tp_size > 8` 时有效位宽过低，源码直接在 `_validate_preconditions` 抛出 `ValueError` 拒绝启动。
- **硬件硬拦截**：`8d6180e2` 仅在 Atlas A2 的 HCCS 互联延迟/带宽比上完成了收支平衡标定；非 A2 设备实例化 `QuantizedAllReduce` 时会立即抛 `RuntimeError`。
- **与 FlashComm1 + 序列并行静默互斥**：当 `enable_flashcomm1` 配合序列并行激活（`sp_active`）时，线性层通信已被改写为 `ReduceScatter + AllGather`，不再调用 `All-Reduce`。`derive_and_validate` 会输出告警并将 `quantized_all_reduce_config.enable` 静默重置为 `False`。
- **阈值调得过小的反效果**：若人为把 `min_numel` 调到几千元素的 Decode 小张量区间，两端量化/反量化 kernel 的启动开销会高于省下的微秒级传输时间，反而拖慢 TPOT。

## 对照源码

下表对照四个固定教学快照中 `quantized_all_reduce_config` 的定义、校验时机与通信器接入点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 字段定义与子键 | 无 [C7] | 无 [C8] | 无（严格模式拒收未知键）[C9][!] | `QuantizedAllReduceConfig`（`enable: bool = False`, `min_numel: int = 16777216`）[C1][C2] |
| 启动校验与 SP 互斥 | — | — | — | `min_numel >= 1`、`tp_size <= 8` 抛 `ValueError`；遇 `sp_active` 告警并置 `enable=False` [C3][!] |
| 通信器挂载与设备门控 | — | — | — | `NPUCommunicator` 挂载 `QuantizedAllReduce`；非 Atlas A2 设备抛 `RuntimeError` [C5][C6] |

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
