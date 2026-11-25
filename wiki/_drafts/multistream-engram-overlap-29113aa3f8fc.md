---
id: multistream-engram-overlap-29113aa3f8fc
title: multistream_engram_overlap
type: param
summary: 布尔配置字段；本次摘录只展示了声明开头，尚不能确认它控制什么、默认是否开启，以及开启后的影响。
aliases: []
chapters: []
order: 10
evidence: I
sources:
  - >-
    raw:sha256-d63955d14e24447b32eb78d00777bf38635b9a63f05dc84275ccc0d9ab63b2af.md#L1-L27
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L569-L576'
  - 'vllm-ascend@7d825229:vllm_ascend/models/deepseek_v41/model.py#L1059-L1084'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L577
  - >-
    vllm-ascend@6e3299ab492ddbadb4c8e3a00b88c982c9a28131:vllm_ascend/ascend_config.py#L576
  - >-
    vllm-ascend@e4d533d33211f0696bcdf65eda47245d52e428c5:vllm_ascend/ascend_config.py#L624
  - >-
    vllm-ascend@e8ae04b5c29f0d69b9dd729cbe838215e451045e:vllm_ascend/ascend_config.py#L639
  - >-
    vllm-ascend@775899991f9614052e4836a62e4cb6541897faee:vllm_ascend/ascend_config.py#L662
  - >-
    vllm-ascend@a38556f69529595e70598d0d6203009f5ac3293e:vllm_ascend/ascend_config.py#L693
  - >-
    vllm-ascend@9b8c54e0d189f34259ab5112f2378ccf558a4e18:vllm_ascend/ascend_config.py#L693
relations: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-2d13f8c316437a6c76d3586c7c71adb5b9fd8ee8754b97fa101e88fdb28b6374.md
  - >-
    raw/sha256-35853e492e0d28c5c68c58db036d9379a18e95a174853ff991a559283df55713.md
  - >-
    raw/sha256-81685fcf969928dd82668d18ecb202fda0d397667b8b8130345c5faf03886bde.md
  - >-
    raw/sha256-8b62fbf64500d54cd80faa70070cb10e16f3058f0af1c12e30b99970d02309e0.md
  - >-
    raw/sha256-b909f1f174d8a217b935475955f0945cdb5b6c1d34c00325d86952e2d862804e.md
  - >-
    raw/sha256-c6bf675098d214a8441b7f9371b85caf3e6e8802740cd4c8424c4961d33be950.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-d63955d14e24447b32eb78d00777bf38635b9a63f05dc84275ccc0d9ab63b2af.md
  - >-
    raw/sha256-dc561029278178cdc9222d8f07a7cbac8503b71b01ca3817fe405738fd14fd7d.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 已有此参数，默认取决于硬件画像：device_adaptor_family 为 FP8_OPTIMIZED 时为 true，否则为 false，用户可以覆盖。DeepSeek V4.1 的 Engram 分支用它准备 hash、lookup 与 DP/TP 交换的副流；hash/state 创建仍以模型确有 Engram 为前提，不能据此推断 GLM 或无 Engram 的模型能获得相同收益。

`multistream_engram_overlap` 是一个类型标注为 `bool` 的配置字段，即声明上使用真或假表示取值；本次材料没有展示它的具体作用、默认值或生效条件。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 字段名 | `multistream_engram_overlap` | 材料中七处声明使用同一个名称。 |
| 类型标注 | `bool` | 声明表示布尔取值，但没有展示运行时如何校验输入。 |
| 定义形式 | `dataclasses.field(` | 摘录在左括号处结束，无法读出默认值或默认值的计算方式。 |
| 摘录位置 | 七个提交各提供一处声明开头 | 可以确认这些摘录都包含该字段，不能据此认定各提交的完整定义和行为一致。 |

材料第 1、5、9、13、17、21、25 行记录了各处源码位置；紧随其后的声明开头相同。材料没有给出这些提交与在册分支的对应关系，因此本稿不登记已核对版本。

## 为什么存在

本次材料不足以解释这个字段解决的问题。摘录没有包含字段注释、完整定义或读取该字段的代码，不能仅凭名称确认它涉及哪些任务、怎样安排执行顺序，以及是否能够减少等待。

要补齐这一节，需要完整字段定义与实际使用位置：前者用于确认配置含义，后者用于确认取值如何改变执行流程。

## 开了的代价

本次材料没有展示启用后的执行路径，无法确认它是否增加资源占用、引入同步等待、限制设备或执行模式，也无法判断它与其他配置是否互斥。

使用前仍需核对默认值、显式配置的读取方式、配置校验及消费该字段的代码。材料也没有提供性能实测，尚不能据此推荐开启或关闭。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.multistream_engram_overlap` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| releases/v0.30.0 | 有 | `07fab1a6` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.31.0rc | 有 | `5e40bc72` |
| releases/v0.32.0rc | 有 | `ec59279f` |
| releases/v0.33.0rc | 有 | `c64ace67` |
| main | 有 | `9b8c54e0` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["multistream_engram_overlap"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `dataclasses.field(default_factory=lambda: get_current_hardware_profile().device_adaptor_family == DeviceAdaptorFamily.FP8_OPTIMIZED)` |
| 定义 | `vllm_ascend/ascend_config.py:693` [C10] |
| 版本 | main · 9b8c54e0d189f34259ab5112f2378ccf558a4e18 |

字段注释：

Prepare Engram hashes, lookups and DP/TP exchanges on an auxiliary stream; FULL graphs wait on descriptor-specific external events at consumers. Default to overlap on A5 only; explicit settings override this policy.

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
