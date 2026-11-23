---
id: kv-pool-range-debug-83e8b165addd
title: kv_pool_range_debug
type: param
summary: 布尔配置字段，四份材料中的静态初值均为 False；具体检查什么、怎样启用及运行开销尚缺读取代码佐证。
aliases: []
chapters:
  - '20'
order: 10
evidence: I
sources:
  - >-
    raw:sha256-5701f7e5c8ac343ee79d5d180736a03c390c118ca28b3afc4e008734e955d6b9.md#L1-L15
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L585
  - >-
    vllm-ascend@6e3299ab492ddbadb4c8e3a00b88c982c9a28131:vllm_ascend/ascend_config.py#L584
  - >-
    vllm-ascend@e4d533d33211f0696bcdf65eda47245d52e428c5:vllm_ascend/ascend_config.py#L632
  - >-
    vllm-ascend@e8ae04b5c29f0d69b9dd729cbe838215e451045e:vllm_ascend/ascend_config.py#L647
  - >-
    vllm-ascend@775899991f9614052e4836a62e4cb6541897faee:vllm_ascend/ascend_config.py#L670
  - >-
    vllm-ascend@a38556f69529595e70598d0d6203009f5ac3293e:vllm_ascend/ascend_config.py#L702
relations: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-2d13f8c316437a6c76d3586c7c71adb5b9fd8ee8754b97fa101e88fdb28b6374.md
  - >-
    raw/sha256-5701f7e5c8ac343ee79d5d180736a03c390c118ca28b3afc4e008734e955d6b9.md
  - >-
    raw/sha256-703d348dfed5c48687d7ecc8b88872ff05f85ddde437c775ada624d740514e88.md
  - >-
    raw/sha256-81685fcf969928dd82668d18ecb202fda0d397667b8b8130345c5faf03886bde.md
  - >-
    raw/sha256-b909f1f174d8a217b935475955f0945cdb5b6c1d34c00325d86952e2d862804e.md
  - >-
    raw/sha256-c6bf675098d214a8441b7f9371b85caf3e6e8802740cd4c8424c4961d33be950.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-dc561029278178cdc9222d8f07a7cbac8503b71b01ca3817fe405738fd14fd7d.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 没有 kv_pool_range_debug 用户字段或运行时消费点；其他 main 扫描提交的定义不代表 rc2 也提供它。传入这个顶层键会触发未知键拒收，Omni 特例只告警过滤，不能用它控制 rc2 的 KV Pool 调试。

`kv_pool_range_debug` 是一个声明为布尔类型、静态初值为 `False` 的配置字段；本次材料只展示字段声明，尚不能确定它控制的具体检查行为。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 声明类型 | `bool` | 字段声明接受真假值，具体生效条件仍需检查配置读取与使用位置。 |
| 材料覆盖 | 四份摘录中的声明一致 | 在提供的四个源码快照摘录中，类型与静态初值没有差异；这不证明运行行为一致。 |
| 行为证据 | 只有字段声明 | 尚无法据此给出启用步骤、诊断输出或性能建议。 |

材料第 3、7、11、15 行均记录该字段的布尔声明与静态初值 `False`。静态初值表示声明时提供的初始值；启动过程中是否被覆盖、最终采用什么值，材料没有展示。

## 为什么存在

本次摘录没有字段注释、设计说明或读取该字段的代码，因此用途仍待核实。字段名称不足以证明它检查的是地址范围、缓存块范围，还是其他对象。

要补齐用途，需要找到读取该字段的分支，并确认检查的输入、触发时机、判断条件，以及检查结果如何影响后续执行。材料也未提供提交与在册分支的对应关系，因此本页不据此登记已核对版本或判断各分支是否支持该功能。

## 开了的代价

材料没有展示值为真时执行的操作，暂时无法判断它是否增加日志、同步、内存访问或其他检查，也无法确定性能开销、副作用与互斥关系。材料中的静态初值为假，不能单独作为启用或关闭建议的依据。

待核事项包括：配置如何传入、启动时是否覆盖初值、哪些代码读取该字段、检查失败时如何处理，以及启用后的实际开销。本次仅核对提供的文本摘录，没有运行或设备验证。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.kv_pool_range_debug` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| releases/v0.13.0 | 无 | `f92eadfc` |
| releases/v0.18.0 | 无 | `35b0fdf7` |
| releases/v0.20.2rc | 无 | `792ea0c6` |
| releases/v0.21.0rc | 无 | `b4884b42` |
| releases/v0.22.1rc | 无 | `6fb87d07` |
| releases/v0.23.0 | 无 | `c399628f` |
| releases/v0.24.0rc | 无 | `b19127c7` |
| releases/v0.25.1rc | 无 | `73953fc0` |
| releases/v0.26.0rc | 无 | `b98aab21` |
| releases/v0.27.1rc | 无 | `0ce12444` |
| releases/v0.28.0rc | 无 | `96df6231` |
| releases/v0.29.0rc | 无 | `b3d3bb68` |
| releases/v0.30.0 | 无 | `0c002b4b` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.31.0rc | 有 | `5e40bc72` |
| releases/v0.32.0rc | 有 | `49007fd8` |
| main | 有 | `a38556f6` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["kv_pool_range_debug"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:702` [C9] |
| 版本 | main · a38556f69529595e70598d0d6203009f5ac3293e |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
